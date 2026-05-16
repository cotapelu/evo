import {
  createAgentSessionServices,
  createAgentSessionRuntime,
  createAgentSessionFromServices,
  SessionManager,
  InteractiveMode,
  type CreateAgentSessionRuntimeFactory,
  getAgentDir,
  AuthStorage,
  SettingsManager,
  ModelRegistry,
  type AgentSessionRuntime,
} from '@earendil-works/pi-coding-agent';

import { AgentManager } from './agent-manager.js';
import { MessageBus } from './messaging.js';
import { Logger } from './logger.js';
import { EvolutionEngine } from './evolution-engine.js';
import createEvoExtension from './extensions/evo-extension.js';
import createWebExtension from './extensions/web-extension.js';
import { Sandbox, DEFAULT_SANDBOX_CONFIG } from './sandbox.js';
import { WebhookNotifier } from './webhook-notifier.js';
import { ConfigManager } from './config-manager.js';

export class EvoSystem {
  private static instance: EvoSystem | null = null;
  private runtime: AgentSessionRuntime | null = null;
  private logger: Logger;
  private evolution: EvolutionEngine | null = null;
  private agentManager: AgentManager | null = null;
  private messageBus: MessageBus | null = null;
  private settingsManager!: SettingsManager;
  private modelRegistry!: ModelRegistry;
  private agentDir!: string;
  private sandbox?: Sandbox;
  private webhookNotifier?: WebhookNotifier;
  private configManager?: ConfigManager;

  // Model config: exclusively from pi's global settings (defaultModel)
  private model!: string;
  private thinkingLevel: 'low' | 'medium' | 'high' = 'medium';
  private logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' = 'info';
  private logPath: string;
  private enableExtensions: boolean = true;
  private evolutionInterval: number = 300000;
  private enableWebUI: boolean = false;
  private webUIPort: number = 3000;
  private enableGeneticStrategy: boolean = false;
  private evolutionStrategy: 'priority' | 'risk-averse' | 'impact-first' | 'thompson-sampling' | 'context-aware' | 'ensemble' | 'genetic' = 'genetic';
  private enableSandbox: boolean = false;
  private sandboxConfig?: any;
  private enablePromptOptimization: boolean = false;
  private promptOptimizationInterval: number = 5;
  private enableCompaction: boolean = true;

  constructor() {
    this.agentDir = getAgentDir();
    this.logPath = this.agentDir + '/evo.log';
    this.logger = new Logger({ logLevel: this.logLevel }, this.logPath);
  }

  static getInstance(): EvoSystem {
    if (!EvoSystem.instance) {
      EvoSystem.instance = new EvoSystem();
    }
    return EvoSystem.instance;
  }

  async initialize() {
    const cwd = process.cwd();

    this.settingsManager = SettingsManager.create(cwd, this.agentDir);
    // Load default model from pi's global settings (set via /model or settings.json)
    const defaultModel = this.settingsManager.getDefaultModel();
    if (!defaultModel) {
      throw new Error('No default model configured. Use /model to select a model or set defaultModel in ~/.pi/agent/settings.json');
    }
    this.model = defaultModel;

    // Optional: Read other evo-specific settings (no model here)
    const projectSettings = this.settingsManager.getProjectSettings();
    const evoSettings = (projectSettings as any).evo || {};

    if (evoSettings.thinkingLevel) this.thinkingLevel = evoSettings.thinkingLevel as any;
    if (evoSettings.logLevel) {
      const level = evoSettings.logLevel as 'trace' | 'debug' | 'info' | 'warn' | 'error';
      if (['trace', 'debug', 'info', 'warn', 'error'].includes(level)) {
        this.logLevel = level;
      } else {
        console.warn(`Invalid logLevel: ${evoSettings.logLevel}, using default 'info'`);
      }
    }
    if (evoSettings.logPath) this.logPath = evoSettings.logPath;
    if (evoSettings.enableExtensions !== undefined) this.enableExtensions = evoSettings.enableExtensions;
    if (evoSettings.evolutionInterval) this.evolutionInterval = evoSettings.evolutionInterval;
    const autoApply = evoSettings.autoApply || false;
    this.enableWebUI = evoSettings.enableWebUI || false;
    this.webUIPort = evoSettings.webUIPort || 3000;
    this.enableGeneticStrategy = evoSettings.enableGeneticStrategy || false;
    this.evolutionStrategy = (evoSettings.evolutionStrategy as any) || 'genetic';
    this.enableSandbox = evoSettings.enableSandbox || false;
    this.sandboxConfig = evoSettings.sandboxConfig || DEFAULT_SANDBOX_CONFIG;
    this.enablePromptOptimization = evoSettings.enablePromptOptimization || false;
    this.promptOptimizationInterval = evoSettings.promptOptimizationInterval || 5;
    this.enableCompaction = evoSettings.enableCompaction ?? true; // default true

    this.logger = new Logger({ logLevel: this.logLevel }, this.logPath);
    this.logger.info('🚀 Initializing Evo System with AgentSessionRuntime...');

    // Initialize config manager
    this.configManager = new ConfigManager(this.logger, this.agentDir);

    // Shared services
    const authStorage = AuthStorage.create(this.agentDir);
    this.modelRegistry = ModelRegistry.create(authStorage, this.agentDir + '/models.json');
    const sessionManager = SessionManager.create(cwd, this.agentDir);

    // Initialize MessageBus for agent coordination
    this.messageBus = new MessageBus();

    // Initialize webhook notifier if configured
    const webhookUrl = evoSettings.webhookUrl;
    if (webhookUrl && this.messageBus) {
      try {
        this.webhookNotifier = new WebhookNotifier(webhookUrl, this.logger);
        this.messageBus.subscribe('webhook-notifier', '*', async (event) => {
          await this.webhookNotifier!.send(event.metadata?.eventType || 'unknown', {
            content: event.content,
            from: event.from,
            to: event.to,
            timestamp: event.timestamp,
          });
        });
        this.logger.info('🔗 Webhook notifier initialized');
      } catch (error) {
        this.logger.warn('Failed to initialize webhook notifier:', error);
      }
    }

    // AgentManager with modelRegistry for sub-agent model resolution + custom templates
    this.agentManager = new AgentManager(this.logger, this.modelRegistry, this.messageBus, this.settingsManager);

    // Runtime factory
    const createRuntime = this.createRuntimeFactory(
      sessionManager,
      authStorage,
      this.settingsManager,
      this.modelRegistry
    );

    // Create AgentSessionRuntime
    this.runtime = await createAgentSessionRuntime(createRuntime, {
      cwd,
      agentDir: this.agentDir,
      sessionManager,
    });

    // Create sandbox if enabled
    if (this.enableSandbox) {
      const { Sandbox } = await import('./sandbox.js');
      this.sandbox = new Sandbox({ ...this.sandboxConfig, enabled: true }, this.logger);
      this.logger.info('🔒 Sandbox mode enabled');
      // Also set on agentManager
      // Pass sandbox to evolution engine
    }

    // Reinitialize AgentManager with sandbox
    this.agentManager = new AgentManager(this.logger, this.modelRegistry, this.messageBus, this.settingsManager, this.sandbox);

    // Evolution engine
    this.evolution = new EvolutionEngine(
      this.runtime,
      {
        agentDir: this.agentDir,
        model: this.model,
        thinkingLevel: this.thinkingLevel,
        evolutionInterval: this.evolutionInterval,
        enableExtensions: this.enableExtensions,
        autoApply: autoApply,
        enableGeneticStrategy: this.enableGeneticStrategy,
        evolutionStrategy: this.evolutionStrategy,
        enablePromptOptimization: this.enablePromptOptimization,
        promptOptimizationInterval: this.promptOptimizationInterval,
      },
      this.logger,
      this.agentManager,
      this.messageBus,
      this.sandbox
    );

    this.logger.info('✅ Evo System initialized with AgentSessionRuntime');
  }

  private createRuntimeFactory(
    sessionManager: SessionManager,
    authStorage: AuthStorage,
    settingsManager: SettingsManager,
    modelRegistry: ModelRegistry
  ): CreateAgentSessionRuntimeFactory {
    const builtinToolNames = ['read', 'write', 'edit', 'bash', 'grep', 'find', 'ls'];

    const extensionFactories: any[] = [];
    if (this.enableExtensions) {
      extensionFactories.push(createEvoExtension);
      if (this.enableWebUI) {
        extensionFactories.push(createWebExtension);
      }
    }

    return async (opts) => {
      // ALWAYS use pi's default agentDir — never override with custom evo config
      const services = await createAgentSessionServices({
        cwd: opts.cwd,
        agentDir: opts.agentDir, // from getAgentDir() — pi default
        authStorage,
        settingsManager,
        modelRegistry,
        resourceLoaderOptions: {
          extensionFactories,
          noExtensions: !this.enableExtensions,
        },
      });

      const [provider, modelId] = this.model.split('/');
      const model = modelRegistry.find(provider, modelId);
      if (!model) {
        this.logger?.warn(`Model '${this.model}' not found in registry - continuing without validation`);
      }

      const result = await createAgentSessionFromServices({
        services,
        sessionManager,
        model,
        thinkingLevel: this.thinkingLevel as any,
        tools: builtinToolNames,
        customTools: [], // tools via extension
      });

      return { ...result, services, diagnostics: [] };
    };
  }

  async run(mode: 'interactive' = 'interactive', args?: string[]) {
    if (!this.runtime) throw new Error('System not initialized');
    if (mode !== 'interactive') {
      this.logger.warn(`Mode '${mode}' not supported. Only interactive mode available.`);
    }
    await this.runInteractive();
  }

  private async runInteractive() {
    this.logger.info('🎮 Starting Interactive Mode with AgentSessionRuntime...');
    if (!this.runtime) throw new Error('Runtime not initialized');
    const interactive = new InteractiveMode(this.runtime, {});
    await interactive.run();
  }

  private extractText(result: any): string {
    if (typeof result === 'string') return result;
    if (result.content && Array.isArray(result.content)) {
      return result.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n');
    }
    return JSON.stringify(result, null, 2);
  }

  getEvolutionEngine(): EvolutionEngine | null {
    return this.evolution;
  }

  getConfigManager(): ConfigManager | null {
    return this.configManager || null;
  }

  getAgentManager(): AgentManager | null {
    return this.agentManager;
  }

  getSettingsManager(): SettingsManager | null {
    return this.settingsManager || null;
  }

  getModelRegistry(): ModelRegistry {
    return this.modelRegistry;
  }

  getMessageBus(): MessageBus | null {
    return this.messageBus;
  }

  getRuntime(): AgentSessionRuntime | null {
    return this.runtime;
  }

  getSession(): unknown {
    return this.runtime?.session || null;
  }

  async shutdown() {
    this.logger.info('🛑 Shutting down Evo System...');
    if (this.runtime) {
      await this.runtime.dispose();
    }
    this.logger.flush();
    this.logger.info('✅ Shutdown complete');
  }

  /**
   * Reload configuration from settings.json without restarting the system
   * Supports hot-reload of: logLevel, evolutionInterval, autoApply, evolutionStrategy, etc.
   */
  async reloadConfiguration(): Promise<void> {
    this.logger.info('🔄 Reloading configuration from settings...');
    try {
      // Re-read project settings
      const projectSettings = this.settingsManager?.getProjectSettings();
      const evoSettings = (projectSettings as any).evo || {};

      // Track changes for logging
      const changes: string[] = [];

      // Log level
      if (evoSettings.logLevel) {
        const level = evoSettings.logLevel as 'trace' | 'debug' | 'info' | 'warn' | 'error';
        if (['trace', 'debug', 'info', 'warn', 'error'].includes(level) && this.logger["logLevel"] !== level) {
          this.logger.setLogLevel(level);
          this.logLevel = level;
          changes.push(`logLevel=${level}`);
        }
      }

      // Evolution interval
      if (evoSettings.evolutionInterval && typeof evoSettings.evolutionInterval === 'number') {
        const oldInterval = this.evolutionInterval;
        if (evoSettings.evolutionInterval !== oldInterval) {
          this.evolutionInterval = evoSettings.evolutionInterval;
          changes.push(`evolutionInterval=${evoSettings.evolutionInterval}`);
          // If auto-evolution is running, restart with new interval
          const engine = this.evolution;
          if (engine) {
            // Check if auto is running by accessing private autoInterval (any)
            const isRunning = (engine as any)['autoInterval'];
            if (isRunning) {
              engine.stopAuto();
              engine.startAuto(this.evolutionInterval);
              changes.push('auto-evolution restarted with new interval');
            }
          }
        }
      }

      // Auto-apply flag
      if (typeof evoSettings.autoApply === 'boolean' && evoSettings.autoApply !== (this as any).autoApply) {
        (this as any).autoApply = evoSettings.autoApply;
        changes.push(`autoApply=${evoSettings.autoApply}`);
      }

      // Evolution strategy
      if (evoSettings.evolutionStrategy && evoSettings.evolutionStrategy !== this.evolutionStrategy) {
        const valid = ['priority', 'risk-averse', 'impact-first', 'thompson-sampling', 'context-aware', 'ensemble', 'genetic'];
        if (valid.includes(evoSettings.evolutionStrategy)) {
          this.evolutionStrategy = evoSettings.evolutionStrategy as any;
          changes.push(`evolutionStrategy=${evoSettings.evolutionStrategy}`);
        }
      }

      // Enable genetic strategy flag (legacy)
      if (typeof evoSettings.enableGeneticStrategy === 'boolean' && evoSettings.enableGeneticStrategy !== this.enableGeneticStrategy) {
        this.enableGeneticStrategy = evoSettings.enableGeneticStrategy;
        changes.push(`enableGeneticStrategy=${evoSettings.enableGeneticStrategy}`);
      }

      // Prompt optimization
      if (typeof evoSettings.enablePromptOptimization === 'boolean' && evoSettings.enablePromptOptimization !== this.enablePromptOptimization) {
        this.enablePromptOptimization = evoSettings.enablePromptOptimization;
        changes.push(`enablePromptOptimization=${evoSettings.enablePromptOptimization}`);
      }
      if (evoSettings.promptOptimizationInterval && typeof evoSettings.promptOptimizationInterval === 'number' && evoSettings.promptOptimizationInterval !== this.promptOptimizationInterval) {
        this.promptOptimizationInterval = evoSettings.promptOptimizationInterval;
        changes.push(`promptOptimizationInterval=${evoSettings.promptOptimizationInterval}`);
      }

      // Log path
      if (evoSettings.logPath && evoSettings.logPath !== this.logPath) {
        this.logPath = evoSettings.logPath;
        // Recreate logger with new path
        this.logger = new Logger({ logLevel: this.logLevel }, this.logPath);
        changes.push(`logPath=${evoSettings.logPath}`);
      }

      // Enable extensions (requires restart of runtime to take effect)
      if (typeof evoSettings.enableExtensions === 'boolean' && evoSettings.enableExtensions !== this.enableExtensions) {
        this.enableExtensions = evoSettings.enableExtensions;
        changes.push(`enableExtensions=${evoSettings.enableExtensions} (requires restart)`);
      }

      // Enable Web UI
      if (typeof evoSettings.enableWebUI === 'boolean' && evoSettings.enableWebUI !== this.enableWebUI) {
        this.enableWebUI = evoSettings.enableWebUI;
        changes.push(`enableWebUI=${evoSettings.enableWebUI}`);
      }

      // Sandbox settings
      if (typeof evoSettings.enableSandbox === 'boolean' && evoSettings.enableSandbox !== this.enableSandbox) {
        this.enableSandbox = evoSettings.enableSandbox;
        changes.push(`enableSandbox=${evoSettings.enableSandbox}`);
      }

      if (changes.length > 0) {
        this.logger.info(`Configuration reloaded: ${changes.join(', ')}`);
      } else {
        this.logger.info('Configuration reloaded: no changes');
      }
    } catch (error: any) {
      this.logger.error('Failed to reload configuration:', error.message);
    }
  }

  static async shutdown() {
    if (EvoSystem.instance) {
      await EvoSystem.instance.shutdown();
      EvoSystem.instance = null;
    }
  }
}

export const evoSystem = EvoSystem.getInstance();

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
} from '@earendil-works/pi-coding-agent';

import { AgentManager } from './agent-manager.js';
import { MessageBus } from './messaging.js';
import { Logger } from './logger.js';
import { EvolutionEngine } from './evolution-engine.js';
import createEvoExtension from './evo-extension.js';
import createWebExtension from './web-extension.js';
import { Sandbox, DEFAULT_SANDBOX_CONFIG } from './sandbox.js';

export class EvoSystem {
  private static instance: EvoSystem | null = null;
  private runtime: any = null; // AgentSessionRuntime
  private logger: Logger;
  private evolution: EvolutionEngine | null = null;
  private agentManager: any = null;
  private messageBus: any = null;
  private settingsManager!: SettingsManager;
  private modelRegistry!: any; // ModelRegistry
  private agentDir!: string;
  private sandbox?: any;

  // Evolution config (from settings.json -> evo section)
  private model: string = 'anthropic/claude-sonnet-4-20250514';
  private thinkingLevel: 'low' | 'medium' | 'high' = 'medium';
  private logLevel: string = 'info';
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
    const projectSettings = this.settingsManager.getProjectSettings();
    const evoSettings = (projectSettings as any).evo || {};

    if (evoSettings.model) this.model = evoSettings.model;
    if (evoSettings.thinkingLevel) this.thinkingLevel = evoSettings.thinkingLevel as any;
    if (evoSettings.logLevel) this.logLevel = evoSettings.logLevel;
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

    // Shared services
    const authStorage = AuthStorage.create(this.agentDir);
    this.modelRegistry = ModelRegistry.create(authStorage, this.agentDir + '/models.json');
    const sessionManager = SessionManager.create(cwd, this.agentDir);

    // Initialize MessageBus for agent coordination
    this.messageBus = new MessageBus();

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
      const services = await createAgentSessionServices({
        cwd: opts.cwd,
        agentDir: opts.agentDir,
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
        const available = modelRegistry.getAll().map(m => `${m.provider}/${m.id}`).join(', ');
        throw new Error(`Cannot resolve model: ${this.model}. Available: ${available}`);
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

  getAgentManager(): any {
    return this.agentManager;
  }

  getSettingsManager(): SettingsManager | null {
    return this.settingsManager || null;
  }

  getModelRegistry(): any {
    return this.modelRegistry;
  }

  getMessageBus(): any {
    return this.messageBus;
  }

  getRuntime(): any {
    return this.runtime;
  }

  getSession(): any {
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

  static async shutdown() {
    if (EvoSystem.instance) {
      await EvoSystem.instance.shutdown();
      EvoSystem.instance = null;
    }
  }
}

export const evoSystem = EvoSystem.getInstance();

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
  private model!: string;
  private thinkingLevel: 'low' | 'medium' | 'high' = 'medium';
  private logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' = 'info';

  constructor() {
    this.agentDir = getAgentDir();
    this.logger = new Logger({ logLevel: this.logLevel }, this.agentDir + '/evo.log');
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
    const defaultModel = this.settingsManager.getDefaultModel();
    if (!defaultModel) {
      throw new Error('No default model configured. Use /model to select a model or set defaultModel in ~/.pi/agent/settings.json');
    }
    this.model = defaultModel;

    // Load evo settings
    const projectSettings = this.settingsManager.getProjectSettings();
    const evoSettings = (projectSettings as any).evo || {};

    if (evoSettings.thinkingLevel) this.thinkingLevel = evoSettings.thinkingLevel as any;
    if (evoSettings.logLevel) {
      const level = evoSettings.logLevel as 'trace' | 'debug' | 'info' | 'warn' | 'error';
      if (['trace', 'debug', 'info', 'warn', 'error'].includes(level)) {
        this.logLevel = level;
      }
    }

    // Create logger with final log level
    this.logger = new Logger({ logLevel: this.logLevel }, this.agentDir + '/evo.log');

    this.logger.info('🚀 Initializing Evo System...');

    // Shared services
    const authStorage = AuthStorage.create(this.agentDir);
    this.modelRegistry = ModelRegistry.create(authStorage, this.agentDir + '/models.json');
    const sessionManager = SessionManager.create(cwd, this.agentDir);

    // Message bus for agent coordination
    this.messageBus = new MessageBus();

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

    // Initialize AgentManager
    this.agentManager = new AgentManager(
      this.logger,
      this.modelRegistry,
      this.messageBus,
      this.settingsManager
    );

    // Evolution engine (basic config)
    this.evolution = new EvolutionEngine(
      this.runtime,
      this.logger,
      this.agentManager,
      this.messageBus
    );

    this.logger.info('✅ Evo System initialized');
  }

  private createRuntimeFactory(
    sessionManager: SessionManager,
    authStorage: AuthStorage,
    settingsManager: SettingsManager,
    modelRegistry: ModelRegistry
  ): CreateAgentSessionRuntimeFactory {
    const builtinToolNames = ['read', 'write', 'edit', 'bash', 'grep', 'find', 'ls'];

    return async (opts) => {
      const services = await createAgentSessionServices({
        cwd: opts.cwd,
        agentDir: opts.agentDir,
        authStorage,
        settingsManager,
        modelRegistry,
        resourceLoaderOptions: {
          extensionFactories: [createEvoExtension],
          noExtensions: false,
        },
      });

      // Resolve model
      const firstSlash = this.model.indexOf('/');
      if (firstSlash === -1) {
        throw new Error(`Invalid model format: '${this.model}'. Expected 'provider/model'`);
      }
      const provider = this.model.substring(0, firstSlash);
      const modelId = this.model.substring(firstSlash + 1);
      const model = modelRegistry.find(provider, modelId);
      if (!model) {
        this.logger?.warn(`Model '${this.model}' not found in registry`);
      }

      const result = await createAgentSessionFromServices({
        services,
        sessionManager,
        model,
        thinkingLevel: this.thinkingLevel as any,
        tools: builtinToolNames,
        customTools: [],
      });

      return { ...result, services, diagnostics: [] };
    };
  }

  async run(mode: 'interactive' = 'interactive'): Promise<void> {
    if (!this.runtime) throw new Error('System not initialized');
    if (mode !== 'interactive') {
      this.logger.warn(`Mode '${mode}' not supported. Using interactive.`);
    }
    this.logger.info('🎮 Starting Interactive Mode...');
    const interactive = new InteractiveMode(this.runtime, {});
    await interactive.run();
  }

  getEvolutionEngine(): EvolutionEngine | null {
    return this.evolution;
  }

  getAgentManager(): AgentManager | null {
    return this.agentManager;
  }

  getSession(): unknown {
    return this.runtime?.session || null;
  }

  async shutdown(): Promise<void> {
    this.logger.info('🛑 Shutting down Evo System...');
    if (this.runtime) {
      await this.runtime.dispose();
    }
    this.logger.flush();
    this.logger.info('✅ Shutdown complete');
  }
}

export const evoSystem = EvoSystem.getInstance();

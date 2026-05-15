import {
  createAgentSessionServices,
  createAgentSessionRuntime,
  createAgentSessionFromServices,
  SessionManager,
  InteractiveMode,
  type CreateAgentSessionServicesOptions,
  type CreateAgentSessionRuntimeFactory,
  type CreateAgentSessionResult,
  type ToolDefinition,
  ModelRegistry,
  AuthStorage,
  SettingsManager,
  DefaultResourceLoader,
  createReadTool,
  createWriteTool,
  createEditTool,
  createBashTool,
  createGrepTool,
  createFindTool,
  createLsTool,
  type Extension,
} from '@earendil-works/pi-coding-agent';

import { AgentManager } from './agent-manager.js';
import { MessageBus } from './messaging.js';
import { Config } from './config.js';
import { Logger } from './logger.js';
import { EvolutionEngine } from './evolution-engine.js';
import { EvoTools, setEvoContext } from './evoTools.js';

export class EvoSystem {
  private static instance: EvoSystem | null = null;
  private runtime: any = null; // AgentSessionRuntime
  private config: Config;
  private logger: Logger;
  private evolution: EvolutionEngine | null = null;
  private agentManager: any = null;
  private messageBus: any = null;
  private customTools: ToolDefinition[] = [];
  private extensions: Extension[] = [];

  constructor() {
    this.config = Config.load();
    this.logger = new Logger(this.config, this.config.logPath);
  }

  static getInstance(): EvoSystem {
    if (!EvoSystem.instance) {
      EvoSystem.instance = new EvoSystem();
    }
    return EvoSystem.instance;
  }

  async initialize() {
    this.logger.info('🚀 Initializing Evo System with AgentSessionRuntime...');

    // 1. Initialize supporting infrastructure
    this.agentManager = new AgentManager(this.logger);
    this.messageBus = new MessageBus();

    // 2. Prepare custom tools (they will use globals set later)
    this.customTools = EvoTools.getAll();

    // 3. Create session manager
    const cwd = process.cwd();
    const sessionManager = SessionManager.create(cwd, this.config.agentDir);

    // 4. Create supporting services
    const authStorage = AuthStorage.create(this.config.agentDir);
    const settingsManager = SettingsManager.create(cwd, this.config.agentDir);
    const modelRegistry = ModelRegistry.create(authStorage, this.config.agentDir + '/models.json');

    // 5. Create runtime factory
    const createRuntime = this.createRuntimeFactory(sessionManager, authStorage, settingsManager, modelRegistry);

    // 6. Create AgentSessionRuntime (FULL RUNTIME)
    this.runtime = await createAgentSessionRuntime(createRuntime, {
      cwd,
      agentDir: this.config.agentDir,
      sessionManager,
    });

    // 7. Evolution engine
    this.evolution = new EvolutionEngine(this.runtime, this.config, this.logger, this.agentManager, this.messageBus);

    // 8. Set global context for tools (must be before any tool execution)
    setEvoContext(this.evolution, this.agentManager);

    // 9. Load extensions
    this.extensions = await this.loadExtensions();

    this.logger.info('✅ Evo System initialized with AgentSessionRuntime');
  }

  private createRuntimeFactory(
    sessionManager: SessionManager,
    authStorage: AuthStorage,
    settingsManager: SettingsManager,
    modelRegistry: ModelRegistry
  ): CreateAgentSessionRuntimeFactory {
    // Builtin tool names (not objects) for the tools option
    const builtinToolNames = ['read', 'write', 'edit', 'bash', 'grep', 'find', 'ls'];

    return async (opts) => {
      // Create services first
      const services = await createAgentSessionServices({
        cwd: opts.cwd,
        agentDir: opts.agentDir,
        authStorage,
        settingsManager,
        modelRegistry,
      });

      // Resolve model from config string (format: 'provider/modelId')
      const [provider, modelId] = this.config.model.split('/');
      const model = modelRegistry.find(provider, modelId);
      if (!model) {
        const available = modelRegistry.getAll().map(m => `${m.provider}/${m.id}`).join(', ');
        throw new Error(`Cannot resolve model: ${this.config.model}. Available: ${available}`);
      }

      // Create session from services
      const result = await createAgentSessionFromServices({
        services,
        sessionManager,
        model,
        thinkingLevel: this.config.thinkingLevel as any,
        tools: builtinToolNames,
        customTools: this.customTools,
      });

      return {
        ...result,
        services,
        diagnostics: [],
      };
    };
  }

  private async loadExtensions(): Promise<any[]> {
    if (!this.config.enableExtensions) return [];
    try {
      const { discoverAndLoadExtensions } = await import('@earendil-works/pi-coding-agent');
      // signature: discoverAndLoadExtensions(configuredPaths: string[], cwd: string, agentDir?: string)
      const result = await discoverAndLoadExtensions(
        [], // configuredPaths - empty means use defaults
        process.cwd(),
        this.config.agentDir
      );
      // LoadExtensionsResult has .extensions array
      const extensions = result.extensions || [];
      this.logger.info(`📦 Loaded ${extensions.length} extensions`);
      return extensions;
    } catch (e: any) {
      this.logger.warn('Failed to load extensions:', e.message);
      return [];
    }
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

    const interactive = new InteractiveMode(this.runtime, {
      // extensions are loaded automatically from runtime
    });

    await interactive.run();
  }

  private async runPrint(args: string[]) {
    const prompt = args[0] || '';
    const files = args.slice(1).filter(a => a.startsWith('@')).map(a => a.slice(1));

    if (!prompt) {
      console.error('Usage: evo print <prompt> [@file1 @file2 ...]');
      process.exit(1);
    }

    let fullPrompt = prompt;
    if (files.length > 0) {
      for (const file of files) {
        try {
          const content = await import('fs').then(fs => fs.promises.readFile(file, 'utf-8'));
          fullPrompt += `\n\n[File: ${file}]\n${content}`;
        } catch (e: any) {
          fullPrompt += `\n\n[Error: ${e.message}]`;
        }
      }
    }

    const result = await this.runtime.session.prompt(fullPrompt);
    const text = this.extractText(result);
    console.log('\n' + text + '\n');
  }

  private async runEvolutionDaemon() {
    this.logger.info('🧬 Evolution Daemon (with AgentSessionRuntime)');
    while (true) {
      try {
        await this.evolution?.cycle();
        await this.sleep(this.config.evolutionInterval);
      } catch (e) {
        this.logger.error('Cycle error:', e);
        await this.sleep(60000);
      }
    }
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

  getRuntime(): any {
    return this.runtime;
  }

  getAgentManager(): any {
    return this.agentManager;
  }

  getMessageBus(): any {
    return this.messageBus;
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

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const evoSystem = EvoSystem.getInstance();

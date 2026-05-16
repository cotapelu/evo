import { createAgentSession } from '@earendil-works/pi-coding-agent';
import type { ModelRegistry, SettingsManager } from '@earendil-works/pi-coding-agent';
import { researcherAgent } from './agents/researcher.js';
import { coderAgent } from './agents/coder.js';
import { analyzerAgent } from './agents/analyzer.js';
import type { AgentConfig } from './agents/base.js';
import { Logger } from './logger.js';
import { MessageBus } from './messaging.js';

export interface RunningAgent {
  id: string;
  config: AgentConfig & { task?: string };
  session: any;
  status: 'running' | 'stopped' | 'error';
  createdAt: Date;
}

export class AgentManager {
  private agents: Map<string, RunningAgent> = new Map();
  private logger: Logger;
  private modelRegistry?: ModelRegistry;
  private messageBus?: MessageBus;
  private agentTemplates: Record<string, AgentConfig> = {};

  constructor(
    logger: Logger,
    modelRegistry?: ModelRegistry,
    messageBus?: MessageBus,
    settingsManager?: SettingsManager
  ) {
    this.logger = logger;
    this.modelRegistry = modelRegistry;
    this.messageBus = messageBus;
    this.agentTemplates = this.loadAgentTemplates(settingsManager);
  }

  private loadAgentTemplates(settingsManager?: SettingsManager): Record<string, AgentConfig> {
    const templates: Record<string, AgentConfig> = {};
    const defaultModel = settingsManager?.getDefaultModel();
    if (!defaultModel) {
      this.logger.warn('No default model in settings - agents may fail');
    }

    // Default agents - cast to AgentConfig
    const defaults: Record<string, AgentConfig> = {
      researcher: researcherAgent as AgentConfig,
      coder: coderAgent as AgentConfig,
      analyzer: analyzerAgent as AgentConfig,
    };

    for (const [key, agent] of Object.entries(defaults)) {
      const model = defaultModel || agent.model;
      templates[key] = {
        type: agent.type || key,
        systemPrompt: agent.systemPrompt,
        model,
        thinkingLevel: agent.thinkingLevel || 'medium',
        tools: agent.tools,
        customTools: agent.customTools,
      };
    }

    // Custom templates from settings
    if (settingsManager) {
      try {
        const projectSettings = settingsManager.getProjectSettings();
        const customTemplates = (projectSettings as any).evo?.agentTemplates as Record<string, any> | undefined;
        if (customTemplates) {
          for (const [type, template] of Object.entries(customTemplates)) {
            if (!template?.systemPrompt || !template?.tools) {
              this.logger.warn(`Invalid agent template '${type}'`);
              continue;
            }
            if (!defaultModel) {
              this.logger.warn(`No default model - skipping agent ${type}`);
              continue;
            }
            templates[type] = {
              type,
              systemPrompt: template.systemPrompt,
              model: defaultModel,
              thinkingLevel: template.thinkingLevel || 'medium',
              tools: template.tools,
              customTools: template.customTools,
            };
            this.logger.info(`Loaded agent template: ${type}`);
          }
        }
      } catch (e) {
        this.logger.warn('Failed to load templates: ' + e);
      }
    }

    return templates;
  }

  /**
   * Spawn a new agent
   */
  async spawnAgent(type: string, overrides?: Partial<AgentConfig> & { task?: string }): Promise<RunningAgent> {
    const template = this.agentTemplates[type];
    if (!template) {
      const available = Object.keys(this.agentTemplates).join(', ');
      throw new Error(`Unknown agent type: ${type}. Available: ${available}`);
    }

    const config: AgentConfig & { task?: string } = {
      ...template,
      ...overrides,
    };

    this.logger.info(`Spawning ${type} agent`);

    // Resolve model to Model object
    let model: any;
    if (typeof config.model === 'string' && this.modelRegistry) {
      const slash = config.model.indexOf('/');
      if (slash !== -1) {
        const provider = config.model.substring(0, slash);
        const modelId = config.model.substring(slash + 1);
        model = this.modelRegistry.find(provider, modelId);
      }
    }
    if (!model && typeof config.model !== 'string') {
      model = config.model;
    }

    // Create agent session
    const { session } = await createAgentSession({
      thinkingLevel: config.thinkingLevel as any,
      tools: config.tools,
      customTools: config.customTools,
      model: model,
    });

    // Set system prompt
    session.agent.state.systemPrompt = config.systemPrompt;

    // Initial task
    if (config.task) {
      await session.prompt(config.task);
    }

    const agent: RunningAgent = {
      id: `${type}-${Date.now()}`,
      config,
      session,
      status: 'running',
      createdAt: new Date(),
    };

    // Subscribe to evolution events
    if (this.messageBus) {
      this.messageBus.subscribe(agent.id, 'evolution.*', async (event) => {
        try {
          await session.prompt(`[System: ${event.metadata?.eventType}]\n${event.content}`);
        } catch (e) {
          this.logger.warn(`Failed to deliver event to ${agent.id}`);
        }
      });
    }

    this.agents.set(agent.id, agent);
    this.logger.info(`✅ Agent ${agent.id} spawned`);
    return agent;
  }

  /**
   * Stop an agent
   */
  async stopAgent(agentId: string): Promise<boolean> {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    try {
      if (this.messageBus) {
        this.messageBus.unsubscribeAll(agentId);
      }
      await agent.session.shutdown();
      this.agents.delete(agentId);
      this.logger.info(`⏹️ Agent ${agentId} stopped`);
      return true;
    } catch (e: any) {
      this.logger.error(`Stop agent ${agentId} failed:`, e.message);
      return false;
    }
  }

  listAgents(): RunningAgent[] {
    return Array.from(this.agents.values());
  }

  getAgent(agentId: string): RunningAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Broadcast message to all agents
   */
  async broadcast(fromAgentId: string, content: string): Promise<void> {
    if (!this.messageBus) return;

    this.messageBus.broadcast(fromAgentId, content);

    for (const [id, agent] of this.agents) {
      if (id !== fromAgentId) {
        try {
          await agent.session.prompt(`[Broadcast from ${fromAgentId}]: ${content}`);
        } catch (e) {
          this.logger.warn(`Broadcast to ${id} failed`);
        }
      }
    }
  }

  /**
   * Send direct message between agents
   */
  async sendMessage(fromAgentId: string, toAgentId: string, content: string): Promise<boolean> {
    const target = this.agents.get(toAgentId);
    if (!target) return false;

    this.messageBus?.send(fromAgentId, toAgentId, content);

    try {
      await target.session.prompt(`[Message from ${fromAgentId}]: ${content}`);
      return true;
    } catch (e) {
      this.logger.error(`Send message to ${toAgentId} failed`);
      return false;
    }
  }

  /**
   * Stop all agents
   */
  async stopAll(): Promise<void> {
    for (const id of this.agents.keys()) {
      await this.stopAgent(id);
    }
  }

  /**
   * Get available agent types
   */
  getAvailableTypes(): string[] {
    return Object.keys(this.agentTemplates);
  }
}

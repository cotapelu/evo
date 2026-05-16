import { createAgentSession } from '@earendil-works/pi-coding-agent';
import { researcherAgent } from './agents/researcher.js';
import { coderAgent } from './agents/coder.js';
import { analyzerAgent } from './agents/analyzer.js';
import type { AgentConfig } from './agents/base.js';
import { Logger } from './logger.js';
import type { Model } from '@earendil-works/pi-ai';
import { MessageBus } from './messaging.js';

export interface RunningAgent {
  id: string;
  config: AgentConfig & { task?: string };
  session: any; // AgentSession
  status: 'running' | 'stopped' | 'error';
  createdAt: Date;
  messageBus?: MessageBus;
}

// Default built-in agents
const DEFAULT_AGENTS = {
  researcher: researcherAgent,
  coder: coderAgent,
  analyzer: analyzerAgent,
} as const;

export class AgentManager {
  private agents: Map<string, RunningAgent> = new Map();
  private logger: Logger;
  private modelRegistry: any; // ModelRegistry
  private globalMessageBus?: MessageBus;
  private sandbox?: any;
  private agentTemplates: Record<string, AgentConfig> = {} as Record<string, AgentConfig>;

  constructor(
    logger: Logger,
    modelRegistry?: any,
    messageBus?: MessageBus,
    settingsManager?: any,
    sandbox?: any
  ) {
    this.logger = logger;
    this.modelRegistry = modelRegistry;
    this.globalMessageBus = messageBus;
    this.sandbox = sandbox;
    this.agentTemplates = this.loadAgentTemplates(settingsManager);
  }

  private loadAgentTemplates(settingsManager?: any): Record<string, AgentConfig> {
    const templates: Record<string, AgentConfig> = {};
    const defaultModel = settingsManager?.getDefaultModel();

    if (!defaultModel) {
      this.logger.warn('No default model configured - agent templates will have no model');
    }

    // Load defaults - ALL use defaultModel (hardcoded models in agents/*.ts are IGNORED)
    for (const [key, agent] of Object.entries(DEFAULT_AGENTS)) {
      templates[key] = {
        type: agent.type || key,
        systemPrompt: agent.systemPrompt,
        model: defaultModel, // ONLY default model, ignore agent.model
        thinkingLevel: agent.thinkingLevel || 'medium',
        tools: agent.tools,
        customTools: agent.customTools,
      } as AgentConfig;
    }

    // Load custom templates from settings if available
    if (settingsManager) {
      try {
        const projectSettings = settingsManager.getProjectSettings();
        const customTemplates = (projectSettings as any).evo?.agentTemplates as Record<string, any> | undefined;
        if (customTemplates) {
          for (const [type, template] of Object.entries(customTemplates)) {
            // Validate required fields
            if (!template.systemPrompt || !template.tools) {
              this.logger.warn(`Invalid agent template '${type}': missing systemPrompt or tools`);
              continue;
            }
            // NEVER use template.model - ONLY defaultModel
            if (!defaultModel) {
              this.logger.warn(`No default model configured - skipping agent '${type}'`);
              continue;
            }
            templates[type] = {
              type,
              systemPrompt: template.systemPrompt,
              model: defaultModel, // forced
              thinkingLevel: template.thinkingLevel || 'medium',
              tools: template.tools,
              customTools: template.customTools,
            } as AgentConfig;
            this.logger.info(`✅ Loaded custom agent template: ${type}`);
          }
        }
      } catch (e) {
        this.logger.warn('Failed to load agent templates from settings:', e);
      }
    }

    return templates;
  }

  async spawnAgent(type: string, overrides?: Partial<AgentConfig> & { task?: string }): Promise<RunningAgent> {
    const all = this.agentTemplates as Record<string, AgentConfig>;
    const template = all[type];
    if (!template) {
      const available = Object.keys(this.agentTemplates).join(', ');
      throw new Error(`Unknown agent type: ${type}. Available: ${available}`);
    }

    // NEVER allow overrides.model - all agents use defaultModel exclusively
    const { model: _ignored, ...restOverrides } = overrides || {};
    const config: AgentConfig & { task?: string } = {
      ...template,
      ...restOverrides,
    };

    this.logger.info(`Spawning agent: ${type}`);

    // Prepare createAgentSession options
    let agentTools = config.tools;
    // Apply sandbox filter if enabled
    if (this.sandbox) {
      agentTools = this.sandbox.filterTools(agentTools);
      this.logger.info(`🔒 Sandbox: agent ${type} tools filtered to: ${agentTools.join(', ')}`);
    }

    const sessionOptions: any = {
      thinkingLevel: config.thinkingLevel as any,
      tools: agentTools,
      customTools: config.customTools,
    };

    // Resolve model string to Model object if we have modelRegistry
    if (typeof config.model === 'string' && this.modelRegistry) {
      const [provider, modelId] = config.model.split('/');
      const resolved = this.modelRegistry.find(provider, modelId);
      if (resolved) {
        sessionOptions.model = resolved;
      } else {
        this.logger.warn(`Cannot resolve model ${config.model} for agent ${type}, using default`);
      }
    } else if (typeof config.model !== 'string' && config.model) {
      sessionOptions.model = config.model;
    }

    const { session } = await createAgentSession(sessionOptions);

    // Set system prompt for specialized agent
    session.agent.state.systemPrompt = config.systemPrompt;

    // If initial task provided, send it
    if (config.task) {
      await session.prompt(config.task);
    }

    const agent: RunningAgent = {
      id: `${type}-${Date.now()}`,
      config,
      session,
      status: 'running',
      createdAt: new Date(),
      messageBus: this.globalMessageBus,
    };

    // Subscribe agent to evolution events if messageBus is available
    if (this.globalMessageBus && agent.messageBus) {
      // Agent already has its own messageBus from constructor
      this.globalMessageBus.subscribe(agent.id, 'evolution.*', async (event) => {
        try {
          await session.prompt(`[System Event: ${event.metadata?.eventType}]\n${event.content}`);
        } catch (e) {
          this.logger.warn(`Failed to deliver event to agent ${agent.id}:`, e);
        }
      });
    }

    this.agents.set(agent.id, agent);
    this.logger.info(`✅ Agent ${agent.id} spawned`);
    return agent;
  }

  async stopAgent(agentId: string): Promise<boolean> {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    try {
      // Unsubscribe from message bus
      if (this.globalMessageBus) {
        this.globalMessageBus.unsubscribeAll(agentId);
      }

      await agent.session.dispose();
      this.agents.delete(agentId);
      this.logger.info(`⏹️ Agent ${agentId} stopped`);
      return true;
    } catch (e: any) {
      this.logger.error(`Failed to stop agent ${agentId}:`, e.message);
      return false;
    }
  }

  getAgent(agentId: string): RunningAgent | undefined {
    return this.agents.get(agentId);
  }

  listAgents(): RunningAgent[] {
    return Array.from(this.agents.values());
  }

  async stopAll(): Promise<void> {
    const stops = Array.from(this.agents.keys()).map(id => this.stopAgent(id));
    await Promise.allSettled(stops);
    this.agents.clear();
    this.logger.info('All agents stopped');
  }

  // Broadcast message to all agents
  async broadcast(fromAgentId: string, content: string): Promise<void> {
    if (!this.globalMessageBus) {
      this.logger.warn('MessageBus not available for broadcast');
      return;
    }

    this.globalMessageBus.broadcast(fromAgentId, content, 'broadcast');

    // Also deliver directly to all agents
    for (const [agentId, agent] of this.agents) {
      if (agentId !== fromAgentId && agent.session) {
        try {
          await agent.session.prompt(`[Broadcast from ${fromAgentId}]: ${content}`);
        } catch (e) {
          this.logger.warn(`Failed to deliver broadcast to agent ${agentId}:`, e);
        }
      }
    }
  }

  // Send direct message between agents
  async sendMessage(fromAgentId: string, toAgentId: string, content: string): Promise<boolean> {
    const targetAgent = this.agents.get(toAgentId);
    if (!targetAgent) {
      this.logger.warn(`Cannot send message: agent ${toAgentId} not found`);
      return false;
    }

    // Send via message bus for tracking
    this.globalMessageBus?.send(fromAgentId, toAgentId, content);

    try {
      await targetAgent.session.prompt(`[Message from ${fromAgentId}]: ${content}`);
      return true;
    } catch (e) {
      this.logger.error(`Failed to deliver message to ${toAgentId}:`, e);
      return false;
    }
  }

  // Get message history for an agent
  getAgentMessages(agentId: string, limit?: number): any[] {
    return this.globalMessageBus?.getAgentHistory(agentId, limit) || [];
  }

  // Get list of available agent types
  getAvailableTypes(): string[] {
    return Object.keys(this.agentTemplates);
  }
}

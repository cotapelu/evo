import { createAgentSession, type ToolDefinition } from '@earendil-works/pi-coding-agent';
import { researcherAgent } from './agents/researcher.js';
import { coderAgent } from './agents/coder.js';
import { analyzerAgent } from './agents/analyzer.js';
import type { AgentConfig } from './agents/base.js';
import { Logger } from './logger.js';

export interface RunningAgent {
  id: string;
  config: AgentConfig;
  session: any; // AgentSession
  status: 'starting' | 'running' | 'stopped' | 'error';
  createdAt: Date;
}

const ALL_AGENTS = {
  researcher: researcherAgent,
  coder: coderAgent,
  analyzer: analyzerAgent,
} as const;

export class AgentManager {
  private agents: Map<string, RunningAgent> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async spawnAgent(type: string, overrides?: Partial<AgentConfig>): Promise<RunningAgent> {
    const template = ALL_AGENTS[type as keyof typeof ALL_AGENTS];
    if (!template) {
      throw new Error(`Unknown agent type: ${type}. Available: ${Object.keys(ALL_AGENTS).join(', ')}`);
    }

    const config: AgentConfig = {
      ...template,
      ...overrides,
    };

    this.logger.info(`Spawning agent: ${type}`);

    const { session } = await createAgentSession({
      model: config.model as any,
      thinkingLevel: config.thinkingLevel as any,
      tools: config.tools,
      customTools: config.customTools,
    });

    const agent: RunningAgent = {
      id: `${type}-${Date.now()}`,
      config,
      session,
      status: 'running',
      createdAt: new Date(),
    };

    this.agents.set(agent.id, agent);
    this.logger.info(`✅ Agent ${agent.id} spawned`);
    return agent;
  }

  async stopAgent(agentId: string): Promise<boolean> {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    try {
      await agent.session.shutdown();
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
}

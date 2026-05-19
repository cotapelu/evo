/**
 * Team Manager - Creates and manages multiple AgentSessionRuntime instances
 *
 * Each agent runs in its own runtime with isolated context and state.
 * Agents are created on-demand and can be reused for multiple tasks.
 */

import { 
  createAgentSessionRuntime, 
  createAgentSessionServices,
  createAgentSessionFromServices,
  type CreateAgentSessionRuntimeFactory,
  type AgentSessionRuntime,
  SessionManager,
} from '@earendil-works/pi-coding-agent';
import type { ThinkingLevel } from '@earendil-works/pi-agent-core';
import { join } from 'path';

export interface TeamAgentConfig {
  name: string;
  systemPrompt: string;
  model?: string;          // e.g., "claude-sonnet-4-20250514"
  tools?: string[];        // ['read', 'bash', 'grep', ...]
  thinkingLevel?: ThinkingLevel;
}

export interface TeamAgentInfo {
  name: string;
  systemPrompt: string;
  model?: string;
  tools?: string[];
  status: 'idle' | 'busy' | 'error';
  lastTask?: string;
  lastResult?: string;
  turnCount: number;
}

class TeamManager {
  private agents: Map<string, AgentSessionRuntime> = new Map();
  private agentConfigs: Map<string, TeamAgentConfig> = new Map();
  private agentInfos: Map<string, TeamAgentInfo> = new Map();
  private cwd: string;
  private agentDir: string;
  private pi: any; // ExtensionAPI

  constructor(cwd: string, agentDir: string, pi: any) {
    this.cwd = cwd;
    this.agentDir = agentDir;
    this.pi = pi;
  }

  async createAgent(config: TeamAgentConfig): Promise<void> {
    if (this.agents.has(config.name)) {
      throw new Error(`Agent "${config.name}" already exists`);
    }

    const factory: CreateAgentSessionRuntimeFactory = async ({ 
      cwd, 
      agentDir, 
      sessionManager, 
      sessionStartEvent 
    }) => {
      // Use shared resources from main pi
      const services = await createAgentSessionServices({
        cwd,
        agentDir,
        authStorage: this.pi.authStorage,
        settingsManager: this.pi.settingsManager,
        modelRegistry: this.pi.modelRegistry,
      });

      // IMPORTANT: Isolate agent from extensions to prevent recursion and keep lightweight
      const rl = services.resourceLoader as any;
      rl.getExtensions = async () => ({ extensions: [] as any[], errors: [] as any[], runtime: {} as any });
      rl.getSkills = async () => ({ skills: [] as any[], diagnostics: [] as any[] });
      rl.getPrompts = async () => ({ prompts: [] as any[], diagnostics: [] as any[] });
      rl.getThemes = async () => ({ themes: [] as any[], diagnostics: [] as any[] });

      // Inject custom system prompt
      services.resourceLoader.getSystemPrompt = () => {
        return config.systemPrompt;
      };

      // Resolve model if specified
      let model: any;
      if (config.model) {
        model = this.pi.modelRegistry.getModel(config.model);
      }

      const { session } = await createAgentSessionFromServices({
        services,
        sessionManager,
        sessionStartEvent,
        model,
        thinkingLevel: config.thinkingLevel,
        tools: config.tools,
      });

      const extensionsResult = await services.resourceLoader.getExtensions();
      return {
        session,
        services,
        diagnostics: services.diagnostics,
        extensionsResult,
      };
    };

    const runtime = await createAgentSessionRuntime(factory, {
      cwd: this.cwd,
      agentDir: this.agentDir,
      sessionManager: this.createSessionManager(config.name),
    });

    // Store config and info
    this.agentConfigs.set(config.name, config);
    this.agentInfos.set(config.name, {
      name: config.name,
      systemPrompt: config.systemPrompt,
      model: config.model,
      tools: config.tools,
      status: 'idle',
      turnCount: 0,
    });

    this.agents.set(config.name, runtime);

    console.log(`🧠 Created agent: ${config.name}`);
  }

  private createSessionManager(agentName: string): SessionManager {
    // Use in-memory session manager for agents (non-persistent)
    return SessionManager.inMemory(this.cwd);
  }

  async runTask(agentName: string, task: string): Promise<{
    output: string;
    usage: { input: number; output: number; cost: number };
    agent: string;
  }> {
    const runtime = this.agents.get(agentName);
    if (!runtime) {
      throw new Error(`Agent "${agentName}" not found. Use team_list() to see available agents.`);
    }

    const info = this.agentInfos.get(agentName)!;
    if (info.status === 'busy') {
      throw new Error(`Agent "${agentName}" is already busy with another task`);
    }
    info.status = 'busy';
    info.lastTask = task;

    try {
      const session = runtime.session;
      
      // Send task to agent. This resolves when the entire turn completes
      // (including any tool calls the agent makes).
      await session.prompt(task);
      
      // After prompt, fetch the last assistant message from the session state
      const state = session.state;
      const messages = state.messages as any[]; // AgentMessage[]
      let output = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let cost = 0;
      
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === 'assistant') {
          // Extract text content
          if (typeof msg.content === 'string') {
            output = msg.content;
          } else if (Array.isArray(msg.content)) {
            const textPart = msg.content.find((p: any) => p.type === 'text');
            if (textPart && typeof textPart.text === 'string') {
              output = textPart.text;
            }
          }
          // Extract usage
          if (msg.usage) {
            inputTokens = msg.usage.input || 0;
            outputTokens = msg.usage.output || 0;
            cost = msg.usage.cost?.total || 0;
          }
          break;
        }
      }

      info.lastResult = output;

      return {
        output,
        usage: { input: inputTokens, output: outputTokens, cost },
        agent: agentName,
      };
    } finally {
      info.turnCount += 1;
      info.status = 'idle';
    }
  }

  listAgents(): TeamAgentInfo[] {
    return Array.from(this.agentInfos.values());
  }

  removeAgent(name: string): boolean {
    const runtime = this.agents.get(name);
    if (!runtime) return false;

    const info = this.agentInfos.get(name)!;
    if (info.status === 'busy') {
      throw new Error(`Agent "${name}" is busy and cannot be removed`);
    }

    runtime.dispose();
    this.agents.delete(name);
    this.agentConfigs.delete(name);
    this.agentInfos.delete(name);
    return true;
  }

  hasAgent(name: string): boolean {
    return this.agents.has(name);
  }

  getAgentCount(): number {
    return this.agents.size;
  }
}

export { TeamManager };

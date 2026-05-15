import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
// Note: using generic ToolDefinition<any, any, any> for flexibility

// Global references set by EvoSystem during initialization
let globalEvolution: any = null;
let globalAgentManager: any = null;

/** Called by EvoSystem to inject dependencies */
export function setEvoContext(evolution: any, agentManager: any) {
  globalEvolution = evolution;
  globalAgentManager = agentManager;
}

export class EvoTools {
  static getAll(): ToolDefinition<any, any, any>[] {
    return [this.evolveTool(), this.statusTool(), this.spawnAgentTool()];
  }

  static evolveTool(evolution?: any): ToolDefinition<any, any, any> {
    return {
      name: 'evolve',
      description: 'Trigger immediate evolution cycle to improve the agent system',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      label: 'Evolve',
      execute: async (toolCallId: string, params: any, signal?: AbortSignal, onUpdate?: any, ctx?: any) => {
        if (!evolution) {
          return {
            content: [{ type: 'text', text: '❌ Evolution engine not available' }],
            details: { toolCallId, action: 'evolve', error: 'not_initialized' },
          };
        }
        const result = await evolution.cycle();
        return {
          content: [{ type: 'text', text: result ? '✅ Evolution cycle completed successfully' : '⚠️ No improvements made' }],
          details: { toolCallId, action: 'evolve', success: result, level: evolution.getLevel() },
        };
      },
    };
  }

  static statusTool(evolution?: any, agentManager?: any): ToolDefinition<any, any, any> {
    return {
      name: 'evo_status',
      description: 'Get current Evo system status (level, capabilities, uptime)',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      label: 'System Status',
      execute: async (toolCallId: string, params: any, signal?: AbortSignal, onUpdate?: any, ctx?: any) => {
        const status: any = {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString(),
        };

        if (evolution) {
          status.level = evolution.getLevel();
          status.capabilities = ['self-awareness', 'evolution', 'coding', 'research'];
        }

        if (agentManager) {
          status.agents = agentManager.listAgents().map((a: any) => ({
            id: a.id,
            type: a.config.type,
            status: a.status,
            createdAt: a.createdAt,
          }));
        }

        return {
          content: [{ type: 'text', text: `Evo System Status:\n${JSON.stringify(status, null, 2)}` }],
          details: status,
        };
      },
    };
  }

  static spawnAgentTool(agentManager?: any): ToolDefinition<any, any, any> {
    return {
      name: 'spawn_agent',
      description: 'Spawn a new sub-agent (researcher, coder, analyzer)',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['researcher', 'coder', 'analyzer'],
            description: 'Agent type',
          },
          task: {
            type: 'string',
            description: 'Initial task/prompt for the agent',
          },
        },
        required: ['type'],
      },
      label: 'Spawn Agent',
      execute: async (toolCallId: string, params: any, signal?: AbortSignal, onUpdate?: any, ctx?: any) => {
        if (!agentManager) {
          return {
            content: [{ type: 'text', text: '❌ Agent manager not available' }],
            details: { toolCallId, action: 'spawn_agent', error: 'not_initialized' },
          };
        }
        try {
          const agent = await agentManager.spawnAgent(params.type, { task: params.task });
          return {
            content: [{ type: 'text', text: `✅ Spawned ${params.type} agent (id: ${agent.id})${params.task ? ` with task: ${params.task}` : ''}` }],
            details: { toolCallId, action: 'spawn_agent', agentId: agent.id, agentType: params.type, task: params.task },
          };
        } catch (e: any) {
          return {
            content: [{ type: 'text', text: `❌ Failed to spawn agent: ${e.message}` }],
            details: { toolCallId, action: 'spawn_agent', error: e.message },
          };
        }
      },
    };
  }
}

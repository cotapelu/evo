/**
 * Team Agent Extension - Multi-Agent Collaboration
 *
 * Allows the LLM to create, manage, and delegate tasks to multiple specialized agents,
 * each running in its own AgentSessionRuntime with isolated context.
 *
 * Tools:
 * - team_create(name, system_prompt, model?, tools?) - Create a new agent
 * - team_list() - List all agents and their status
 * - team_run(agent_name, task) - Delegate task to specific agent
 * - team_broadcast(task) - Send task to all agents, collect results
 * - team_remove(agent_name) - Remove an agent
 *
 * Example LLM usage:
 *   @team_create("frontend", "You are a React expert...", model="claude-sonnet-4-20250514")
 *   @team_run("frontend", "Review this component for accessibility")
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI, AgentToolResult } from '@earendil-works/pi-coding-agent';
import { getAgentDir } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { Text } from '@earendil-works/pi-tui';
import { TeamManager, type TeamAgentConfig } from './team-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = __filename.split('/').slice(0, -1).join('/');

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default function (pi: ExtensionAPI) {
  // Initialize TeamManager with cwd and agentDir
  const cwd = process.cwd();
  const agentDir = getAgentDir();

  const team = new TeamManager(cwd, agentDir, pi);

  // Preload default agents if .pi/team-agents exists
  pi.on('session_start', async (_event, ctx) => {
    try {
      const agentsDir = path.join(cwd, '.pi', 'team-agents');
      if (fs.existsSync(agentsDir)) {
        const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          const content = fs.readFileSync(path.join(agentsDir, file), 'utf-8');
          try {
            const config: TeamAgentConfig = JSON.parse(content);
            await team.createAgent(config);
            ctx.ui.notify(`Loaded agent: ${config.name}`, 'info');
          } catch (err) {
            ctx.ui.notify(`Failed to load agent ${file}: ${err}`, 'error');
          }
        }
      }
    } catch (err) {
      // Ignore
    }
  });

  // Tool: team_create
  pi.registerTool({
    name: 'team_create',
    label: 'Create Agent',
    description: 'Create a new specialized agent with given system prompt and configuration',
    parameters: Type.Object({
      name: Type.String({ description: 'Unique agent name' }),
      system_prompt: Type.String({ description: 'Full system prompt for the agent' }),
      model: Type.Optional(Type.String({ description: 'Model to use (e.g., claude-sonnet-4-20250514)' })),
      tools: Type.Optional(Type.Array(Type.String(), { description: 'List of tools the agent can use' })),
      thinking_level: Type.Optional(Type.Enum(['off', 'concise', 'normal', 'detailed'])),
    }),
    async execute(_toolCallId: any, params: any, _signal: any, _onUpdate: any, ctx: any) {
      const config: TeamAgentConfig = {
        name: params.name,
        systemPrompt: params.system_prompt,
        model: params.model,
        tools: params.tools,
        thinkingLevel: params.thinking_level as any,
      };

      try {
        await team.createAgent(config);
        return {
          content: [{ type: 'text', text: `✅ Created agent: ${config.name}` }],
          details: { config },
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `❌ Failed to create agent: ${error.message}` }],
          details: { error: error.message },
        };
      }
    },
  } as any);

  // Tool: team_list
  pi.registerTool({
    name: 'team_list',
    label: 'List Agents',
    description: 'List all created agents with their status and info',
    parameters: Type.Object({}),
    async execute(_toolCallId: any, _params: any, _signal: any, _onUpdate: any, _ctx: any) {
      const agents = team.listAgents();
      if (agents.length === 0) {
        return {
          content: [{ type: 'text', text: 'No agents in team. Use team_create() to add some.' }],
        };
      }

      const lines = agents.map(a =>
        `• ${a.name} (${a.status})\n` +
        `  Model: ${a.model || 'default'}\n` +
        `  Tools: ${a.tools?.join(', ') || 'default'}\n` +
        `  Turns: ${a.turnCount}\n` +
        `  Last task: ${a.lastTask || 'none'}\n` +
        `  Last result: ${(a.lastResult?.slice(0, 100) || 'none')}${a.lastResult && a.lastResult.length > 100 ? '...' : ''}`
      ).join('\n---\n');

      return {
        content: [{ type: 'text', text: `Team (${agents.length} agents):\n\n${lines}` }],
        details: { agents },
      };
    },
  } as any);

  // Tool: team_run
  pi.registerTool({
    name: 'team_run',
    label: 'Run Task on Agent',
    description: 'Delegate a task to a specific agent and get the result',
    parameters: Type.Object({
      agent_name: Type.String({ description: 'Name of the agent to run' }),
      task: Type.String({ description: 'Task description for the agent' }),
    }),
    async execute(_toolCallId: any, params: any, signal: any, onUpdate: any, ctx: any) {
      const startTime = Date.now();
      try {
        const result = await team.runTask(params.agent_name, params.task);
        const elapsed = Date.now() - startTime;
        
        // Stream updates while running? The agent's internal messages are not streamed to us
        // But we can at least report completion
        
        return {
          content: [{ 
            type: 'text', 
            text: `[Agent: ${params.agent_name}] ${elapsed}ms\n\n${result.output}`
          }],
          details: {
            agent: params.agent_name,
            task: params.task,
            usage: result.usage,
            elapsedMs: elapsed,
          },
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `[Agent: ${params.agent_name}] Error: ${error.message}` }],
          details: { error: error.message },
        };
      }
    },
  } as any);

  // Tool: team_broadcast
  pi.registerTool({
    name: 'team_broadcast',
    label: 'Broadcast Task',
    description: 'Send the same task to all agents and collect their responses',
    parameters: Type.Object({
      task: Type.String({ description: 'Task to send to every agent' }),
    }),
    async execute(_toolCallId: any, params: any, signal: any, onUpdate: any, ctx: any) {
      const agents = team.listAgents();
      if (agents.length === 0) {
        return {
          content: [{ type: 'text', text: 'No agents to broadcast to.' }],
        };
      }

      const results: { name: string; output: string; error?: string }[] = [];
      const tasks = agents.map(async (agent) => {
        try {
          const result = await team.runTask(agent.name, params.task);
          results.push({ name: agent.name, output: result.output });
        } catch (error: any) {
          results.push({ name: agent.name, output: '', error: error.message });
        }
      });

      // Wait for all (with concurrency limit? For now parallel)
      await Promise.all(tasks);

      const lines = results.map(r =>
        `=== ${r.name} ${r.error ? '❌' : '✅'} ===\n${r.error || r.output}`
      ).join('\n\n');

      return {
        content: [{ type: 'text', text: `Broadcast to ${agents.length} agents:\n\n${lines}` }],
        details: { results },
      };
    },
  } as any);

  // Tool: team_remove
  pi.registerTool({
    name: 'team_remove',
    label: 'Remove Agent',
    description: 'Remove an agent from the team',
    parameters: Type.Object({
      name: Type.String({ description: 'Agent name to remove' }),
    }),
    async execute(_toolCallId: any, params: any, _signal: any, _onUpdate: any, ctx: any) {
      const removed = team.removeAgent(params.name);
      if (removed) {
        return {
          content: [{ type: 'text', text: `🗑️ Removed agent: ${params.name}` }],
        };
      } else {
        return {
          content: [{ type: 'text', text: `Agent not found: ${params.name}` }],
        };
      }
    },
  } as any);

  // Optional: subscribe to team events for UI notifications
  // We could add custom UI overlay later
}

import type { ExtensionAPI, ExtensionCommandContext, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { getAgentDir } from '@earendil-works/pi-coding-agent';
import { EvoSystem } from '../system.js';

export default function (pi: ExtensionAPI) {
  const sendMessage = async (text: string) => {
    await pi.sendMessage({ customType: 'text', content: text, display: true });
  };

  // /evolution [start|stop|restart] [interval_ms]
  pi.registerCommand('evolution', {
    description: 'Control auto-evolution daemon (start/stop/restart). Usage: /evolution [start|stop|restart] [interval_ms]',
    handler: async (argsStr: string, ctx: ExtensionCommandContext) => {
      const system = EvoSystem.getInstance();
      const engine = system.getEvolutionEngine();
      if (!engine) { await sendMessage('❌ Evolution engine not available'); return; }
      const parts = argsStr.trim().split(/\s+/).filter(Boolean);
      const sub = parts[0] || 'start';
      const intervalStr = parts[1];

      switch (sub) {
        case 'start': {
          let interval = 300000;
          if (intervalStr) {
            interval = parseInt(intervalStr, 10);
            if (isNaN(interval)) {
              await sendMessage('❌ Invalid interval');
              return;
            }
          }
          engine.startAuto(interval);
          await sendMessage(`✅ Auto-evolution started (interval: ${interval}ms)`);
          break;
        }
        case 'stop': {
          engine.stopAuto();
          await sendMessage('⏹️ Auto-evolution stopped');
          break;
        }
        case 'restart': {
          engine.stopAuto();
          let interval = 300000;
          if (intervalStr) {
            interval = parseInt(intervalStr, 10);
            if (isNaN(interval)) {
              await sendMessage('❌ Invalid interval');
              return;
            }
          }
          engine.startAuto(interval);
          await sendMessage(`✅ Auto-evolution restarted (interval: ${interval}ms)`);
          break;
        }
        default:
          await sendMessage(`❌ Unknown subcommand '${sub}'. Use start|stop|restart`);
      }
    },
  });

  // /evolution-history
  pi.registerCommand('evolution-history', {
    description: 'Show evolution history',
    handler: async (_argsStr: string, ctx: ExtensionCommandContext) => {
      const system = EvoSystem.getInstance();
      const engine = system.getEvolutionEngine();
      if (!engine) { await sendMessage('❌ Evolution engine not available'); return; }
      const history = await engine.getHistory();
      if (history.length === 0) {
        await sendMessage('📭 No evolution history yet.');
        return;
      }
      const lines = history.slice(-10).reverse().map((h: any) => {
        const files = h.affectedFiles.join(', ');
        return `Level ${h.level}: ${h.improvement.substring(0, 60)}...\n  📁 ${files || 'N/A'}\n  🕒 ${h.timestamp.toISOString()}`;
      });
      await sendMessage(`📚 Recent Evolution History:\n\n${lines.join('\n')}`);
    },
  });

  // /evolution-rollback <level>
  pi.registerCommand('evolution-rollback', {
    description: 'Rollback to previous level. Usage: /evolution-rollback <level>',
    handler: async (argsStr: string, ctx: ExtensionCommandContext) => {
      const system = EvoSystem.getInstance();
      const engine = system.getEvolutionEngine();
      if (!engine) { await sendMessage('❌ Evolution engine not available'); return; }
      const level = parseInt(argsStr.trim(), 10);
      if (isNaN(level)) {
        await sendMessage('❌ Specify valid level number');
        return;
      }
      const success = await engine.rollback(level);
      if (success) {
        await sendMessage(`🔄 Rolled back to level ${level}`);
      } else {
        await sendMessage(`❌ Rollback failed for level ${level}`);
      }
    },
  });

  // /spawn-agent <type> [task]
  pi.registerCommand('spawn-agent', {
    description: 'Spawn a sub-agent (researcher, coder, analyzer). Usage: /spawn-agent <type> [task]',
    handler: async (argsStr: string, ctx: ExtensionCommandContext) => {
      const system = EvoSystem.getInstance();
      const agentManager = system.getAgentManager();
      if (!agentManager) { await sendMessage('❌ Agent manager not available'); return; }
      const parts = argsStr.trim().split(/\s+/);
      if (parts.length === 0) {
        await sendMessage('❌ Agent type required: researcher|coder|analyzer');
        return;
      }
      const type = parts[0];
      const task = parts.slice(1).join(' ');
      try {
        const agent = await agentManager.spawnAgent(type, { task: task || undefined });
        await sendMessage(`✅ Spawned ${type} agent (id: ${agent.id})${task ? `\n  Task: ${task}` : ''}`);
      } catch (e: any) {
        await sendMessage(`❌ Failed: ${e.message}`);
      }
    },
  });

  // /evo - short status
  pi.registerCommand('evo', {
    description: 'Short system status (level, agents, uptime)',
    handler: async (_argsStr: string, ctx: ExtensionCommandContext) => {
      const system = EvoSystem.getInstance();
      const engine = system.getEvolutionEngine();
      const agentManager = system.getAgentManager();
      const status: any = {
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };
      if (engine) {
        status.evolution = { level: engine.getLevel() };
      }
      if (agentManager) {
        status.agents = agentManager.listAgents().map((a: any) => ({
          id: a.id,
          type: a.config.type,
          status: a.status,
        }));
      }
      await sendMessage(`Evo Status:\n${JSON.stringify(status, null, 2)}`);
    },
  });

  // /agents - list running agents
  pi.registerCommand('agents', {
    description: 'List all running sub-agents',
    handler: async (_argsStr: string, ctx: ExtensionCommandContext) => {
      const system = EvoSystem.getInstance();
      const agentManager = system.getAgentManager();
      if (!agentManager) { await sendMessage('❌ Agent manager not available'); return; }
      const agents = agentManager.listAgents();
      if (agents.length === 0) {
        await sendMessage('📭 No agents running.');
        return;
      }
      const lines = agents.map((a: any) => `  ${a.id}\n    type: ${a.config.type}\n    status: ${a.status}\n    created: ${a.createdAt.toISOString()}`);
      await sendMessage(`🤖 Agents (${agents.length}):\n\n${lines.join('\n\n')}`);
    },
  });

  // /agent-stop <id>
  pi.registerCommand('agent-stop', {
    description: 'Stop a running agent. Usage: /agent-stop <agent-id>',
    handler: async (argsStr: string, ctx: ExtensionCommandContext) => {
      const system = EvoSystem.getInstance();
      const agentManager = system.getAgentManager();
      if (!agentManager) { await sendMessage('❌ Agent manager not available'); return; }
      const agentId = argsStr.trim();
      if (!agentId) {
        await sendMessage('❌ Specify agent ID');
        return;
      }
      const ok = await agentManager.stopAgent(agentId);
      await sendMessage(ok ? `⏹️ Agent ${agentId} stopped` : `❌ Agent ${agentId} not found`);
    },
  });

  // /evolution-metrics
  pi.registerCommand('evolution-metrics', {
    description: 'Show evolution metrics',
    handler: async (_argsStr: string, ctx: ExtensionCommandContext) => {
      const system = EvoSystem.getInstance();
      const engine = system.getEvolutionEngine();
      if (!engine) { await sendMessage('❌ Evolution engine not available'); return; }
      const m = await engine.getMetrics();
      const lines = [
        `📊 Metrics:`,
        `  Cycles: ${m.totalCycles} (success: ${m.successfulCycles}, failed: ${m.failedCycles})`,
        `  Success Rate: ${m.successRate.toFixed(1)}%`,
        `  Avg Time: ${(m.avgCycleTimeMs / 1000).toFixed(2)}s`,
      ];
      await sendMessage(lines.join('\n'));
    },
  });

  // LLM Tools

  const evolveTool: ToolDefinition = {
    name: 'evolve',
    description: 'Trigger one evolution cycle to improve the agent system',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    label: 'Evolve',
    execute: async (toolCallId: string, params: any) => {
      const sys = EvoSystem.getInstance();
      const engine = sys.getEvolutionEngine();
      if (!engine) {
        return { content: [{ type: 'text', text: '❌ Evolution engine not available' }], details: { toolCallId, action: 'evolve', error: 'not_initialized' } };
      }
      const ok = await engine.cycle();
      return { content: [{ type: 'text', text: ok ? '✅ Evolution completed' : '⚠️ No improvements made' }], details: { toolCallId, action: 'evolve', success: ok, level: engine.getLevel() } };
    },
  };

  const statusTool: ToolDefinition = {
    name: 'evo_status',
    description: 'Get system status',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    label: 'System Status',
    execute: async (toolCallId: string, params: any) => {
      const sys = EvoSystem.getInstance();
      const engine = sys.getEvolutionEngine();
      const am = sys.getAgentManager();
      const status: any = {
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };
      if (engine) status.level = engine.getLevel();
      if (am) {
        status.agents = am.listAgents().map((a: any) => ({ id: a.id, type: a.config.type, status: a.status }));
      }
      return { content: [{ type: 'text', text: `Status:\n${JSON.stringify(status, null, 2)}` }], details: status };
    },
  };

  const spawnAgentTool: ToolDefinition = {
    name: 'spawn_agent',
    description: 'Spawn a sub-agent (researcher, coder, analyzer)',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['researcher', 'coder', 'analyzer'], description: 'Agent type' },
        task: { type: 'string', description: 'Initial task' },
      },
      required: ['type'],
    },
    label: 'Spawn Agent',
    execute: async (toolCallId: string, params: any) => {
      const sys = EvoSystem.getInstance();
      const am = sys.getAgentManager();
      if (!am) {
        return { content: [{ type: 'text', text: '❌ Agent manager not available' }], details: { toolCallId, action: 'spawn_agent', error: 'not_initialized' } };
      }
      try {
        const agent = await am.spawnAgent(params.type, { task: params.task });
        return { content: [{ type: 'text', text: `✅ Spawned ${params.type} (${agent.id})` }], details: { toolCallId, action: 'spawn_agent', agentId: agent.id } };
      } catch (e: any) {
        return { content: [{ type: 'text', text: `❌ Spawn failed: ${e.message}` }], details: { toolCallId, action: 'spawn_agent', error: e.message } };
      }
    },
  };

  const rollbackTool: ToolDefinition = {
    name: 'evo_rollback',
    description: 'Rollback evolution to level',
    parameters: {
      type: 'object',
      properties: { level: { type: 'number', description: 'Target level' } },
      required: ['level'],
    },
    label: 'Rollback',
    execute: async (toolCallId: string, params: any) => {
      const sys = EvoSystem.getInstance();
      const engine = sys.getEvolutionEngine();
      if (!engine) {
        return { content: [{ type: 'text', text: '❌ Engine not available' }], details: { toolCallId, action: 'evo_rollback', error: 'not_initialized' } };
      }
      const ok = await engine.rollback(params.level);
      return { content: [{ type: 'text', text: ok ? `✅ Rolled back to level ${params.level}` : `❌ Rollback failed` }], details: { toolCallId, action: 'evo_rollback', success: ok } };
    },
  };

  const messageTool: ToolDefinition = {
    name: 'agent_message',
    description: 'Send a message to another agent',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Target agent ID' },
        content: { type: 'string', description: 'Message content' },
      },
      required: ['to', 'content'],
    },
    label: 'Agent Message',
    execute: async (toolCallId: string, params: any) => {
      const sys = EvoSystem.getInstance();
      const am = sys.getAgentManager();
      if (!am) {
        return { content: [{ type: 'text', text: '❌ Agent manager not available' }], details: { toolCallId, action: 'agent_message', error: 'not_initialized' } };
      }
      const ok = await am.sendMessage('evolution-system', params.to, params.content);
      return { content: [{ type: 'text', text: ok ? `✅ Sent to ${params.to}` : `❌ Failed to send` }], details: { toolCallId, action: 'agent_message', ok } };
    },
  };

  const broadcastTool: ToolDefinition = {
    name: 'agent_broadcast',
    description: 'Broadcast message to all agents',
    parameters: {
      type: 'object',
      properties: { content: { type: 'string', description: 'Message content' } },
      required: ['content'],
    },
    label: 'Agent Broadcast',
    execute: async (toolCallId: string, params: any) => {
      const sys = EvoSystem.getInstance();
      const am = sys.getAgentManager();
      if (!am) {
        return { content: [{ type: 'text', text: '❌ Agent manager not available' }], details: { toolCallId, action: 'agent_broadcast', error: 'not_initialized' } };
      }
      await am.broadcast('evolution-system', params.content);
      return { content: [{ type: 'text', text: `✅ Broadcasted to all agents` }], details: { toolCallId, action: 'agent_broadcast' } };
    },
  };

  const metricsTool: ToolDefinition = {
    name: 'evo_metrics',
    description: 'Get evolution metrics',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    label: 'Metrics',
    execute: async (toolCallId: string, params: any) => {
      const sys = EvoSystem.getInstance();
      const engine = sys.getEvolutionEngine();
      if (!engine) {
        return { content: [{ type: 'text', text: '❌ Engine not available' }], details: { toolCallId, action: 'evo_metrics', error: 'not_initialized' } };
      }
      const m = await engine.getMetrics();
      const report = `📊 Metrics:\n  Total Cycles: ${m.totalCycles}\n  Success: ${m.successfulCycles}\n  Failed: ${m.failedCycles}\n  Success Rate: ${m.successRate.toFixed(1)}%\n  Avg Time: ${(m.avgCycleTimeMs/1000).toFixed(2)}s`;
      return { content: [{ type: 'text', text: report }], details: { toolCallId, action: 'evo_metrics', metrics: m } };
    },
  };

  pi.registerTool(evolveTool);
  pi.registerTool(statusTool);
  pi.registerTool(spawnAgentTool);
  pi.registerTool(rollbackTool);
  pi.registerTool(messageTool);
  pi.registerTool(broadcastTool);
  pi.registerTool(metricsTool);
}

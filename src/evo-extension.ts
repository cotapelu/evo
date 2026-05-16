import type { ExtensionAPI, ExtensionCommandContext, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { getAgentDir } from '@earendil-works/pi-coding-agent';
import { EvoSystem } from './system.js';

export default function (pi: ExtensionAPI) {
  const sendMessage = async (text: string) => {
    await pi.sendMessage({ customType: 'text', content: text, display: true });
  };

  // /evolution-start [interval]
  pi.registerCommand('evolution-start', {
    description: 'Start auto-evolution daemon (runs in background)',
    handler: async (argsStr: string, ctx: ExtensionCommandContext) => {
      const system = EvoSystem.getInstance();
      const engine = system.getEvolutionEngine();
      if (!engine) { await sendMessage('❌ Evolution engine not available'); return; }
      const trimmed = argsStr.trim();
      let interval: number | undefined;
      if (trimmed) {
        interval = parseInt(trimmed, 10);
        if (isNaN(interval!)) {
          await sendMessage('❌ Invalid interval. Usage: /evolution-start [interval_ms]');
          return;
        }
      }
      engine.startAuto(interval);
      await sendMessage(`✅ Auto-evolution started (interval: ${interval || 300000}ms)`);
    },
  });

  // /evolution-stop
  pi.registerCommand('evolution-stop', {
    description: 'Stop auto-evolution daemon',
    handler: async (_argsStr: string, ctx: ExtensionCommandContext) => {
      const system = EvoSystem.getInstance();
      const engine = system.getEvolutionEngine();
      if (!engine) { await sendMessage('❌ Evolution engine not available'); return; }
      engine.stopAuto();
      await sendMessage('⏹️ Auto-evolution stopped');
    },
  });

  // /evolution-status
  pi.registerCommand('evolution-status', {
    description: 'Show evolution daemon status',
    handler: async (_argsStr: string, ctx: ExtensionCommandContext) => {
      const system = EvoSystem.getInstance();
      const engine = system.getEvolutionEngine();
      if (!engine) { await sendMessage('❌ Evolution engine not available'); return; }
      const level = engine.getLevel();
      await sendMessage(`🧬 Evolution Engine:\n  Level: ${level}\n  Auto-running: ${engine['autoInterval'] ? '✅' : '❌'}`);
    },
  });

  // /evolution-history
  pi.registerCommand('evolution-history', {
    description: 'Show evolution history (applied improvements)',
    handler: async (_argsStr: string, ctx: ExtensionCommandContext) => {
      const system = EvoSystem.getInstance();
      const engine = system.getEvolutionEngine();
      if (!engine) { await sendMessage('❌ Evolution engine not available'); return; }
      const history = await engine.getHistory();
      if (history.length === 0) {
        await sendMessage('📭 No evolution history yet.');
        return;
      }
      const lines = history.map((h: any) =>
        `Level ${h.level}: ${h.improvement.substring(0, 50)}...\n  📁 ${h.backupPath}\n  🕒 ${h.timestamp.toISOString()}`
      );
      await sendMessage(`📚 Evolution History (${history.length} entries):\n\n${lines.join('\n')}`);
    },
  });

  // /evolution-rollback <level>
  pi.registerCommand('evolution-rollback', {
    description: 'Rollback to a previous level (undo last improvement)',
    handler: async (argsStr: string, ctx: ExtensionCommandContext) => {
      const system = EvoSystem.getInstance();
      const engine = system.getEvolutionEngine();
      if (!engine) { await sendMessage('❌ Evolution engine not available'); return; }
      const target = argsStr.trim();
      if (!target) {
        await sendMessage('❌ Specify level to rollback. Usage: /evolution-rollback <level>');
        return;
      }
      const level = parseInt(target, 10);
      if (isNaN(level)) {
        await sendMessage('❌ Invalid level number');
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
    description: 'Spawn a sub-agent (researcher, coder, analyzer)',
    handler: async (argsStr: string, ctx: ExtensionCommandContext) => {
      const system = EvoSystem.getInstance();
      const agentManager = system.getAgentManager();
      if (!agentManager) { await sendMessage('❌ Agent manager not available'); return; }
      const parts = argsStr.trim().split(/\s+/);
      if (parts.length === 0) {
        await sendMessage('❌ Agent type required. Usage: /spawn-agent <researcher|coder|analyzer> [task]');
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

  // /evo-status
  pi.registerCommand('evo-status', {
    description: 'Full Evo system status',
    handler: async (_argsStr: string, ctx: ExtensionCommandContext) => {
      const system = EvoSystem.getInstance();
      const engine = system.getEvolutionEngine();
      const agentManager = system.getAgentManager();
      const status: any = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      };
      if (engine) {
        status.evolution = { level: engine.getLevel(), autoRunning: !!engine['autoInterval'] };
      }
      if (agentManager) {
        status.agents = agentManager.listAgents().map((a: any) => ({
          id: a.id,
          type: a.config.type,
          status: a.status,
          createdAt: a.createdAt,
        }));
      }
      await sendMessage(`Evo System Status:\n${JSON.stringify(status, null, 2)}`);
    },
  });

  // /evolution-metrics
  pi.registerCommand('evolution-metrics', {
    description: 'Show evolution metrics and statistics',
    handler: async (_argsStr: string, ctx: ExtensionCommandContext) => {
      const system = EvoSystem.getInstance();
      const engine = system.getEvolutionEngine();
      if (!engine) { await sendMessage('❌ Evolution engine not available'); return; }
      const metrics = await engine.getMetrics();
      const lines = [
        `📊 Evolution Metrics:`,
        `  Total Cycles: ${metrics.totalCycles}`,
        `  Successful: ${metrics.successfulCycles}`,
        `  Failed: ${metrics.failedCycles}`,
        `  Success Rate: ${metrics.successRate.toFixed(2)}%`,
        `  Avg Cycle Time: ${(metrics.avgCycleTimeMs / 1000).toFixed(2)}s`,
        `  Last Cycle Time: ${(metrics.lastCycleTimeMs / 1000).toFixed(2)}s`,
        `  Uptime: ${(metrics.uptime / 1000 / 60).toFixed(2)} minutes`,
        `  Improvements by Category:`,
      ];
      for (const [cat, count] of Object.entries(metrics.improvementsByCategory)) {
        lines.push(`    ${cat}: ${count}`);
      }
      await sendMessage(lines.join('\n'));
    },
  });

  
  // /evolution-heartbeat
  pi.registerCommand('evolution-heartbeat', {
    description: 'Show current heartbeat status',
    handler: async (_argsStr: string, ctx: ExtensionCommandContext) => {
      try {
        const raw = await readFile(join(getAgentDir(), '.evo', 'heartbeat.json'), 'utf-8');
        const hb = JSON.parse(raw);
        const ageMs = Date.now() - new Date(hb.lastBeat).getTime();
        const msg = [
          'Heartbeat:',
          '  PID: ' + hb.pid,
          '  Last beat: ' + Math.round(ageMs / 1000) + 's ago',
          '  Uptime: ' + Math.round(hb.uptime) + 's',
          '  RSS: ' + Math.round(hb.memoryRSS / 1024 / 1024) + 'MB',
        ].join('\n');
        await sendMessage(msg);
      } catch (e: any) {
        await sendMessage('No heartbeat yet: ' + ((e && e.message) || String(e)));
      }
    },
  });

  // /evolution-logs
  pi.registerCommand('evolution-logs', {
    description: 'List all rotated evo.log files with sizes',
    handler: async (_argsStr: string, ctx: ExtensionCommandContext) => {
      try {
        const dir = getAgentDir();
        const all = await readdir(dir).catch(() => []);
        const logs = all
          .filter((n: string) => n === 'evo.log' || /^evo\.log\.\d+$/.test(n))
          .map((n: string) => ({ name: n, path: join(dir, n) }))
          .sort((a: any, b: any) => b.name.localeCompare(a.name));
        if (logs.length === 0) { await sendMessage('No evo log files found'); return; }
        const entries: string[] = [];
        for (const l of logs) {
          try {
            const s = await stat(l.path);
            entries.push(l.name.padEnd(20) + (s.size / 1024).toFixed(1) + 'KB');
          } catch {
            entries.push(l.name.padEnd(20) + ' (unreadable)');
          }
        }
        await sendMessage('Log files (' + logs.length + '):\n\n' + entries.join('\n'));
      } catch (e: any) {
        await sendMessage('Error: ' + (e.message || String(e)));
      }
    },
  });

// LLM-callable Tools

  const evolveTool: ToolDefinition = {
    name: 'evolve',
    description: 'Trigger immediate evolution cycle to improve the agent system',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    label: 'Evolve',
    execute: async (toolCallId: string, params: any, signal?: AbortSignal, onUpdate?: any, ctx?: any) => {
      const system = EvoSystem.getInstance();
      const evolution = system.getEvolutionEngine();
      if (!evolution) {
        return { content: [{ type: 'text', text: '❌ Evolution engine not available' }], details: { toolCallId, action: 'evolve', error: 'not_initialized' } };
      }
      const result = await evolution.cycle();
      return { content: [{ type: 'text', text: result ? '✅ Evolution cycle completed' : '⚠️ No improvements made' }], details: { toolCallId, action: 'evolve', success: result, level: evolution.getLevel() } };
    },
  };

  const statusTool: ToolDefinition = {
    name: 'evo_status',
    description: 'Get current Evo system status (level, capabilities, uptime)',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    label: 'System Status',
    execute: async (toolCallId: string, params: any, signal?: AbortSignal, onUpdate?: any, ctx?: any) => {
      const system = EvoSystem.getInstance();
      const evolution = system.getEvolutionEngine();
      const agentManager = system.getAgentManager();
      const status: any = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      };
      if (evolution) status.level = evolution.getLevel();
      if (agentManager) {
        status.agents = agentManager.listAgents().map((a: any) => ({
          id: a.id,
          type: a.config.type,
          status: a.status,
          createdAt: a.createdAt,
        }));
      }
      return { content: [{ type: 'text', text: `Evo System Status:\n${JSON.stringify(status, null, 2)}` }], details: status };
    },
  };

  const spawnAgentTool: ToolDefinition = {
    name: 'spawn_agent',
    description: 'Spawn a new sub-agent (researcher, coder, analyzer)',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['researcher', 'coder', 'analyzer'], description: 'Agent type' },
        task: { type: 'string', description: 'Initial task/prompt for the agent' },
      },
      required: ['type'],
    },
    label: 'Spawn Agent',
    execute: async (toolCallId: string, params: any, signal?: AbortSignal, onUpdate?: any, ctx?: any) => {
      const system = EvoSystem.getInstance();
      const agentManager = system.getAgentManager();
      if (!agentManager) {
        return { content: [{ type: 'text', text: '❌ Agent manager not available' }], details: { toolCallId, action: 'spawn_agent', error: 'not_initialized' } };
      }
      try {
        const agent = await agentManager.spawnAgent(params.type, { task: params.task });
        return { content: [{ type: 'text', text: `✅ Spawned ${params.type} agent (id: ${agent.id})` + (params.task ? ` with task: ${params.task}` : '') }], details: { toolCallId, action: 'spawn_agent', agentId: agent.id, agentType: params.type, task: params.task } };
      } catch (e: any) {
        return { content: [{ type: 'text', text: `❌ Failed to spawn agent: ${e.message}` }], details: { toolCallId, action: 'spawn_agent', error: e.message } };
      }
    },
  };

  // Tool for rollback
  const rollbackTool: ToolDefinition = {
    name: 'evo_rollback',
    description: 'Rollback evolution to a previous level (undo last improvement)',
    parameters: {
      type: 'object',
      properties: {
        level: { type: 'number', description: 'Level to rollback to' },
      },
      required: ['level'],
    },
    label: 'Evolution Rollback',
    execute: async (toolCallId: string, params: any, signal?: AbortSignal, onUpdate?: any, ctx?: any) => {
      const system = EvoSystem.getInstance();
      const engine = system.getEvolutionEngine();
      if (!engine) {
        return { content: [{ type: 'text', text: '❌ Evolution engine not available' }], details: { toolCallId, action: 'evo_rollback', error: 'not_initialized' } };
      }
      const success = await engine.rollback(params.level);
      if (success) {
        return { content: [{ type: 'text', text: `✅ Rolled back to level ${params.level}` }], details: { toolCallId, action: 'evo_rollback', level: params.level } };
      } else {
        return { content: [{ type: 'text', text: `❌ Rollback to level ${params.level} failed` }], details: { toolCallId, action: 'evo_rollback', error: 'failed', level: params.level } };
      }
    },
  };

  // Messaging tools for agent coordination
  const messageTool: ToolDefinition = {
    name: 'agent_message',
    description: 'Send a message to another agent',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Target agent ID' },
        content: { type: 'string', description: 'Message content' }
      },
      required: ['to', 'content']
    },
    label: 'Agent Message',
    execute: async (toolCallId: string, params: any, signal?: AbortSignal, onUpdate?: any, ctx?: any) => {
      const system = EvoSystem.getInstance();
      const agentManager = system.getAgentManager();
      if (!agentManager) {
        return { content: [{ type: 'text', text: '❌ Agent manager not available' }], details: { toolCallId, action: 'agent_message', error: 'not_initialized' } };
      }
      const fromAgentId = 'evolution-system';
      const success = await agentManager.sendMessage(fromAgentId, params.to, params.content);
      if (success) {
        return { content: [{ type: 'text', text: `✅ Sent message to ${params.to}` }], details: { toolCallId, action: 'agent_message', to: params.to } };
      } else {
        return { content: [{ type: 'text', text: `❌ Failed to send message to ${params.to}` }], details: { toolCallId, action: 'agent_message', error: 'send_failed' } };
      }
    },
  };

  const broadcastTool: ToolDefinition = {
    name: 'agent_broadcast',
    description: 'Broadcast a message to all agents',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Message content' }
      },
      required: ['content']
    },
    label: 'Agent Broadcast',
    execute: async (toolCallId: string, params: any, signal?: AbortSignal, onUpdate?: any, ctx?: any) => {
      const system = EvoSystem.getInstance();
      const agentManager = system.getAgentManager();
      if (!agentManager) {
        return { content: [{ type: 'text', text: '❌ Agent manager not available' }], details: { toolCallId, action: 'agent_broadcast', error: 'not_initialized' } };
      }
      const fromAgentId = 'evolution-system';
      await agentManager.broadcast(fromAgentId, params.content);
      return { content: [{ type: 'text', text: `✅ Broadcasted to all agents` }], details: { toolCallId, action: 'agent_broadcast' } };
    },
  };

  pi.registerTool(evolveTool);
  pi.registerTool(statusTool);
  pi.registerTool(spawnAgentTool);
  pi.registerTool(rollbackTool);
  pi.registerTool(messageTool);
  pi.registerTool(broadcastTool);

  const metricsTool: ToolDefinition = {
    name: 'evo_metrics',
    description: 'Get evolution metrics and statistics',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    label: 'Evolution Metrics',
    execute: async (toolCallId: string, params: any, signal?: AbortSignal, onUpdate?: any, ctx?: any) => {
      const system = EvoSystem.getInstance();
      const engine = system.getEvolutionEngine();
      if (!engine) {
        return { content: [{ type: 'text', text: '❌ Evolution engine not available' }], details: { toolCallId, action: 'evo_metrics', error: 'not_initialized' } };
      }
      const metrics = await engine.getMetrics();
      const report = `📊 Evolution Metrics:\n` +
        `  Total Cycles: ${metrics.totalCycles}\n` +
        `  Successful: ${metrics.successfulCycles}\n` +
        `  Failed: ${metrics.failedCycles}\n` +
        `  Success Rate: ${metrics.successRate.toFixed(2)}%\n` +
        `  Avg Cycle Time: ${(metrics.avgCycleTimeMs / 1000).toFixed(2)}s\n` +
        `  Last Cycle Time: ${(metrics.lastCycleTimeMs / 1000).toFixed(2)}s\n` +
        `  Uptime: ${(metrics.uptime / 1000 / 60).toFixed(2)} minutes\n` +
        `  Improvements by Category:\n` +
        Object.entries(metrics.improvementsByCategory).map(([cat, count]) => `    ${cat}: ${count}`).join('\n');
      return { content: [{ type: 'text', text: report }], details: { toolCallId, action: 'evo_metrics', metrics } };
    },
  };
  pi.registerTool(metricsTool);
}

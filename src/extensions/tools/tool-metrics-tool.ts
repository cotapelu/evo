#!/usr/bin/env node
/**
 * Tool Metrics Tool
 *
 * Displays aggregated statistics from .pi/tool-metrics.ndjson.
 * Shows total runs, average duration, and error counts per tool.
 */

import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

function createToolMetricsTool(): ToolDefinition<any, any> {
  return {
    name: 'tool-metrics',
    label: 'Tool Metrics',
    description: 'Display execution statistics for tools: total runs, avg duration, error rates.',
    parameters: {},
    async execute(_, __, ___, ____, ctx) {
      const cwd = ctx.cwd;
      const path = join(cwd, '.pi', 'tool-metrics.ndjson');
      try {
        const raw = await readFile(path, 'utf-8');
        const lines = raw.split('\n').filter(l => l.trim() !== '');
        const all = lines.map(l => {
          try { return JSON.parse(l); } catch { return null; }
        }).filter(m => m && m.toolName) as Array<{ toolName: string; duration: number; success: boolean }>;

        if (all.length === 0) {
          return { content: [{ type: 'text', text: 'No metrics recorded yet.' }], details: {}, isError: false };
        }

        const agg = new Map<string, { count: number; totalTime: number; errors: number }>();
        for (const m of all) {
          const name = m.toolName;
          const cur = agg.get(name) ?? { count: 0, totalTime: 0, errors: 0 };
          cur.count++;
          cur.totalTime += m.duration ?? 0;
          if (!m.success) cur.errors++;
          agg.set(name, cur);
        }

        const linesOut: string[] = [];
        linesOut.push('📊 Tool Metrics (all time)');
        linesOut.push('─'.repeat(70));
        linesOut.push(`${'Tool'.padEnd(22)} | Runs | Avg(ms) | Err %`);
        linesOut.push('─'.repeat(70));
        for (const [name, stats] of agg.entries()) {
          const avg = (stats.totalTime / stats.count).toFixed(1);
          const errPct = ((stats.errors / stats.count) * 100).toFixed(1);
          linesOut.push(`${name.padEnd(22)} | ${String(stats.count).padStart(3)} | ${String(avg).padStart(6)} | ${String(errPct).padStart(5)}%`);
        }
        linesOut.push('─'.repeat(70));

        return {
          content: [{ type: 'text', text: linesOut.join('\n') }],
          details: { totalRuns: all.length, tools: agg.size },
          isError: false,
        };
      } catch (e: any) {
        if (e.code === 'ENOENT' || e.message?.includes('ENOENT')) {
          return { content: [{ type: 'text', text: 'No metrics file found. Metrics are collected per session.' }], details: {}, isError: false };
        }
        return { content: [{ type: 'text', text: `Error: ${e.message}` }], details: { error: e.message }, isError: true };
      }
    },

    renderCall(args: any, theme: any) {
      const th = theme;
      const text = th.fg('toolTitle', th.bold('tool-metrics')) + th.fg('muted', ' statistics');
      return new Text(text, 0, 0);
    },

    renderResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: any) {
      const th = theme;
      if (options.isPartial) return new Text(th.fg('warning', 'Loading...'), 0, 0);
      if (result.isError) return new Text(th.fg('error', 'Error'), 0, 0);
      const runs = result.details?.totalRuns || 0;
      return new Text(th.fg('accent', `📈 ${runs} records`), 0, 0);
    },
  };
}

export function registerToolMetricsTool(api: ExtensionAPI): void {
  api.registerTool(createToolMetricsTool());
}
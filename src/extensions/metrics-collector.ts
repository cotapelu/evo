#!/usr/bin/env node
/**
 * Metrics Collector
 *
 * Wraps all tool registrations to record execution times and error rates.
 * Persists each metric as JSON lines to .pi/tool-metrics.ndjson.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';

interface Metric {
  toolName: string;
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
}

export default function metricsCollector(api: ExtensionAPI) {
  const originalRegisterTool = api.registerTool.bind(api);
  api.registerTool = (tool: ToolDefinition<any, any>) => {
    const originalExecute = tool.execute.bind(tool);
    tool.execute = async (toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any) => {
      const start = Date.now();
      try {
        const result = await originalExecute(toolCallId, params, signal, onUpdate, ctx);
        const duration = Date.now() - start;
        const isError = (result as any).isError === true;
        const metric: Metric = {
          toolName: tool.name,
          timestamp: start,
          duration,
          success: !isError,
        };
        // Fire-and-forget persistence
        (async () => {
          try {
            const dir = join(ctx.cwd, '.pi');
            await mkdir(dir, { recursive: true });
            const path = join(dir, 'tool-metrics.ndjson');
            await appendFile(path, JSON.stringify(metric) + '\n', 'utf-8');
          } catch {
            // ignore
          }
        })();
        return result;
      } catch (e: any) {
        const duration = Date.now() - start;
        const metric: Metric = {
          toolName: tool.name,
          timestamp: start,
          duration,
          success: false,
          error: e?.message ?? String(e),
        };
        (async () => {
          try {
            const dir = join(ctx.cwd, '.pi');
            await mkdir(dir, { recursive: true });
            const path = join(dir, 'tool-metrics.ndjson');
            await appendFile(path, JSON.stringify(metric) + '\n', 'utf-8');
          } catch {
            // ignore
          }
        })();
        throw e;
      }
    };
    originalRegisterTool(tool);
  };
}
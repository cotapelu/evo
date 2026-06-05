#!/usr/bin/env node
/**
 * Metrics Tool
 *
 * Displays agent evolution metrics from docs/AGENT_METRICS.md.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

function createMetricsTool(api: ExtensionAPI): ToolDefinition<any, any> {
  return {
    name: 'metrics',
    label: 'Agent Metrics',
    description: 'Display evolution metrics including rounds, test counts, failure rates, and MTTR.',
    promptSnippet: 'metrics - shows the latest AGENT_METRICS.md content.',
    parameters: {},
    async execute(toolCallId, params, _signal, _onUpdate, ctx) {
      const metricsPath = join(ctx.cwd, 'docs', 'AGENT_METRICS.md');
      try {
        if (!existsSync(metricsPath)) {
          return {
            content: [{ type: 'text', text: '⚠️ Metrics file not found at docs/AGENT_METRICS.md' }],
            details: { error: 'missing' },
            isError: true,
          };
        }
        const content = readFileSync(metricsPath, 'utf-8');
        return {
          content: [{ type: 'text', text: content }],
          details: { path: metricsPath },
          isError: false,
        };
      } catch (e: any) {
        const msg = e.message ?? String(e);
        return {
          content: [{ type: 'text', text: `❌ Error reading metrics: ${msg}` }],
          details: { error: msg },
          isError: true,
        };
      }
    },
  };
}

export function registerMetricsTool(api: ExtensionAPI): void {
  api.registerTool(createMetricsTool(api));
}

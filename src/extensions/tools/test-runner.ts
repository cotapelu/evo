#!/usr/bin/env node
/**
 * Test Runner Tool
 *
 * Runs project tests and returns results.
 * Parameters:
 *   pattern?: string - test filter pattern passed to test runner
 */

import type { ExtensionAPI, ExtensionContext, ExecOptions } from "@earendil-works/pi-coding-agent";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

function createTestRunnerTool(api: ExtensionAPI): ToolDefinition<any, any> {
  return {
    name: 'test',
    label: 'Test Runner',
    description: 'Run project tests. Accepts optional pattern to filter tests. Returns exit code and output.',
    parameters: {},
    async execute(toolCallId, params, signal, _onUpdate, ctx) {
      let pattern: string | undefined;
      if (params && typeof params === 'object' && !(params instanceof AbortSignal)) {
        pattern = (params as any).pattern;
      } else if (typeof params === 'string') {
        try {
          const p = JSON.parse(params);
          pattern = (p as any).pattern;
        } catch {
          // ignore
        }
      }

      const args: string[] = ['test'];
      if (pattern) {
        args.push('--', pattern);
      }

      const execOptions: ExecOptions = { cwd: ctx.cwd };
      if (signal) {
        execOptions.signal = signal;
      }

      try {
        const result = await api.exec('npm', args, execOptions);
        const { stdout, stderr, code } = result;
        const success = code === 0;
        const message = success
          ? `✅ Tests completed (exit code ${code})`
          : `❌ Tests failed (exit code ${code})`;

        const output = stdout + (stderr ? '\n' + stderr : '');

        return {
          content: [{ type: 'text', text: message }],
          details: { exitCode: code, stdout, stderr, output, pattern },
          isError: !success,
        };
      } catch (e: any) {
        const msg = e.message ?? String(e);
        return {
          content: [{ type: 'text', text: `❌ Error running tests: ${msg}` }],
          details: { error: msg },
          isError: true,
        };
      }
    },
  };
}

export function registerTestRunnerTool(api: ExtensionAPI): void {
  api.registerTool(createTestRunnerTool(api));
}

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
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
      const afterArgs: string[] = [];
      if (pattern) {
        afterArgs.push(pattern);
      }
      // Support coverage flag
      const paramsObj = typeof params === 'object' && params && !(params instanceof AbortSignal) ? params : (typeof params === 'string' ? JSON.parse(params) : {});
      const wantCoverage = !!paramsObj.coverage;
      if (wantCoverage) {
        afterArgs.push('--coverage');
      }
      if (afterArgs.length > 0) {
        args.push('--', ...afterArgs);
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

        // Parse coverage if requested and available
        let coverage: any = undefined;
        if (wantCoverage && code === 0) {
          const coveragePath = join(ctx.cwd, 'coverage', 'coverage-summary.json');
          if (existsSync(coveragePath)) {
            try {
              coverage = JSON.parse(readFileSync(coveragePath, 'utf-8'));
            } catch (e) {
              // ignore coverage parse errors
            }
          }
        }

        return {
          content: [{ type: 'text', text: message }],
          details: { exitCode: code, stdout, stderr, output, pattern, coverage },
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

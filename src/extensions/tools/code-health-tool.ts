#!/usr/bin/env node
/**
 * Code Health Tool
 *
 * Runs multiple code quality checks: lint, type-check, test, build.
 * Useful for CI-like validation locally.
 *
 * Actions:
 * - audit (default): runs all configured checks
 *
 * Optional parameters:
 *   checks?: string[] - subset of ['lint', 'typecheck', 'test', 'build'] to run
 */

import type { ExtensionAPI, ExtensionContext, ExecOptions } from "@earendil-works/pi-coding-agent";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

interface CheckResult {
  name: string;
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  success: boolean;
}

function createCodeHealthTool(api: ExtensionAPI): ToolDefinition<any, any> {
  const allowedChecks = ['lint', 'typecheck', 'test', 'build'] as const;
  type CheckName = typeof allowedChecks[number];

  // Mapping from check names to npm commands
  function getCommand(check: CheckName): { cmd: string; args: string[] } {
    switch (check) {
      case 'lint':
        return { cmd: 'npm', args: ['run', 'lint'] };
      case 'typecheck':
        // Use tsc directly for type checking without emitting
        return { cmd: 'npx', args: ['tsc', '--noEmit'] };
      case 'test':
        return { cmd: 'npm', args: ['test'] };
      case 'build':
        return { cmd: 'npm', args: ['run', 'build'] };
    }
  }

  return {
    name: 'code-health',
    label: 'Code Health',
    description: 'Run code health checks: lint, typecheck, test, build. Returns aggregated summary.',
    promptSnippet: "code-health({ checks?: ['lint','typecheck','test','build'] }) - audit all or specify subset.",
    parameters: {},
    async execute(toolCallId, params, signal, _onUpdate: (update: any) => void | undefined, ctx) {
      // Determine which checks to run
      let checksToRun: CheckName[] = [...allowedChecks];
      if (params && typeof params === 'object' && !(params instanceof AbortSignal)) {
        const requested = (params as any).checks;
        if (Array.isArray(requested)) {
          checksToRun = requested.filter(c => allowedChecks.includes(c)) as CheckName[];
          if (checksToRun.length === 0) {
            return {
              content: [{ type: 'text', text: 'No valid checks specified. Allowed: lint, typecheck, test, build' }],
              details: { error: 'No valid checks' },
              isError: true,
            };
          }
        }
      }

      const results: CheckResult[] = [];
      let hasFailure = false;

      // Run each check sequentially
      for (const check of checksToRun) {
        const { cmd, args } = getCommand(check);
        const execOptions: ExecOptions = { cwd: ctx.cwd };
        if (signal) {
          execOptions.signal = signal;
        }

        // Notify start if onUpdate available
        if (_onUpdate) {
          _onUpdate({ type: 'progress', check, status: 'running' });
        }

        try {
          const result = await api.exec(cmd, args, execOptions);
          const { stdout, stderr, code } = result;
          const success = code === 0;
          if (!success) hasFailure = true;
          results.push({
            name: check,
            command: `${cmd} ${args.join(' ')}`,
            args,
            exitCode: code,
            stdout,
            stderr,
            success,
          });
        } catch (e: any) {
          hasFailure = true;
          results.push({
            name: check,
            command: `${cmd} ${args.join(' ')}`,
            args,
            exitCode: -1,
            stdout: '',
            stderr: e.message ?? String(e),
            success: false,
          });
        }

        // Early abort if signal triggered
        if (signal?.aborted) {
          break;
        }
      }

      // Build summary message
      const lines: string[] = ['🔍 Code Health Check Results:', ''];

      for (const r of results) {
        const statusIcon = r.success ? '✅' : '❌';
        lines.push(`${statusIcon} ${r.name}: exit ${r.exitCode}`);
        if (!r.success && r.stderr) {
          // Include a snippet of error if any
          const snippet = r.stderr.split('\n').slice(0, 3).join('; ');
          lines.push(`   Error: ${snippet}${r.stderr.split('\n').length > 3 ? '...' : ''}`);
        }
      }

      lines.push('');
      const summary = hasFailure
        ? `⚠️  ${results.filter(r => !r.success).length} of ${results.length} checks failed.`
        : `✅ All ${results.length} checks passed.`;

      lines.push(summary);
      lines.push('');
      lines.push('Details:');
      for (const r of results) {
        lines.push(`- ${r.name}: ${r.command} (exit ${r.exitCode})`);
      }

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        details: { checks: results.map(r => ({ name: r.name, command: r.command, args: r.args, exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr, success: r.success })), overallSuccess: !hasFailure },
        isError: hasFailure, // Tool call is considered error if any check fails
      };
    },
  };
}

export function registerCodeHealthTool(api: ExtensionAPI): void {
  api.registerTool(createCodeHealthTool(api));
}

#!/usr/bin/env node
/**
 * Git Tool (with Retry and Circuit Breaker)
 *
 * Wraps common Git operations with exponential backoff retry and circuit breaker.
 * Network-dependent failures are retried; repeated failures open the circuit to fail fast.
 *
 * Actions: status, diff, commit, add, push, pull, log.
 */

import type { ExtensionAPI, ExtensionContext, ExecOptions } from "@earendil-works/pi-coding-agent";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { CircuitBreaker, registerCircuit } from "../utils/circuit-breaker";

// Create and register circuit breaker for git operations
const gitCircuit = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 30000 });
registerCircuit('git', gitCircuit);

function renderGitCall(args: any, theme: any): Text {
  const action = args.action || 'unknown';
  const text = `${theme.fg("toolTitle", theme.bold("git"))} ${theme.fg("muted", action)}`;
  return new Text(text, 0, 0);
}

function renderGitResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: any): Text {
  if (options.isPartial) return new Text(theme.fg("warning", "Running..."), 0, 0);
  const details = result.details;
  if (!details) return new Text("", 0, 0);
  const { success, exitCode, action, stdout } = details as any;
  const icon = success ? '✅' : '❌';
  const color = success ? 'success' : 'error';
  const lines: string[] = [`${icon} git ${action} (exit ${exitCode})`];
  if (stdout && options.expanded) {
    const snippet = stdout.split('\n').slice(0, 5).join('\n');
    lines.push(theme.fg('dim', snippet));
  }
  return new Text(lines.join('\n'), 0, 0);
}

// Retry helper
async function execGitWithRetry(
  api: ExtensionAPI,
  args: string[],
  options: ExecOptions | undefined,
  maxAttempts = 3
): Promise<any> {
  let lastResult: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await api.exec('git', args, options);
      lastResult = result;
      if (result.code === 0) return result;
    } catch (e) {
      lastResult = e;
    }
    if (attempt < maxAttempts) {
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  if (lastResult && typeof lastResult === 'object' && 'code' in lastResult) {
    return lastResult;
  }
  throw lastResult;
}

function createGitTool(api: ExtensionAPI): ToolDefinition<any, any> {
  return {
    name: 'git',
    label: 'Git',
    description: 'Execute Git commands: status, diff, commit, add, push, pull, log. Uses retry and circuit breaker for reliability.',
    parameters: {},
    async execute(toolCallId, params, signal, _onUpdate, ctx) {
      let action: string | undefined;
      if (params && typeof params === 'object' && !(params instanceof AbortSignal)) {
        action = (params as any).action;
      } else if (typeof params === 'string') {
        try {
          const p = JSON.parse(params);
          action = (p as any).action;
        } catch {
          // ignore
        }
      }

      if (!action) {
        return {
          content: [{ type: 'text', text: 'Error: Missing action' }],
          details: { error: 'Missing action' },
          isError: true,
        };
      }

      const allowed = ['status', 'diff', 'commit', 'add', 'push', 'pull', 'log'];
      if (!allowed.includes(action)) {
        return {
          content: [{ type: 'text', text: `Error: Invalid action "${action}". Allowed: ${allowed.join(', ')}` }],
          details: { error: 'Invalid action' },
          isError: true,
        };
      }

      const args: string[] = [];
      switch (action) {
        case 'status':
          args.push('status', '--porcelain');
          break;
        case 'diff':
          const path = (params as any).path;
          if (path) {
            args.push('diff', '--', path);
          } else {
            args.push('diff', 'HEAD');
          }
          break;
        case 'commit':
          const message = (params as any).message;
          if (!message) {
            return { content: [{ type: 'text', text: 'Error: message required for commit' }], details: { error: 'Missing message' }, isError: true };
          }
          if (ctx.hasUI && !(params as any).force) {
            const confirmed = await ctx.ui.confirm('Git Commit', `Commit changes with message:\n"${message}"?`, {});
            if (!confirmed) {
              return { content: [{ type: 'text', text: 'Commit cancelled' }], details: { cancelled: true }, isError: false };
            }
          }
          args.push('commit', '-m', message);
          break;
        case 'add':
          const files = (params as any).files;
          if (!Array.isArray(files) || files.length === 0) {
            return { content: [{ type: 'text', text: 'Error: files required (array of strings)' }], details: { error: 'Missing files' }, isError: true };
          }
          args.push('add', ...files);
          break;
        case 'push':
          const remote = (params as any).remote || 'origin';
          const branch = (params as any).branch || 'HEAD';
          args.push('push', remote, branch);
          break;
        case 'pull':
          const pRemote = (params as any).remote || 'origin';
          const pBranch = (params as any).branch || 'HEAD';
          args.push('pull', pRemote, pBranch);
          break;
        case 'log':
          const count = (params as any).count || 10;
          args.push('log', '--oneline', '-n', String(count));
          break;
      }

      const execOptions: ExecOptions = { cwd: ctx.cwd };
      if (signal) {
        execOptions.signal = signal;
      }

      try {
        // Apply circuit breaker and retry
        const result = await gitCircuit.execute(() => execGitWithRetry(api, args, execOptions, 3));
        const { stdout, stderr, code } = result;
        const success = code === 0;
        const message = success
          ? `✅ git ${action} succeeded`
          : `❌ git ${action} failed (exit code ${code})`;
        return {
          content: [{ type: 'text', text: message }],
          details: { action, exitCode: code, stdout, stderr, args },
          isError: !success,
        };
      } catch (e: any) {
        const msg = e.message ?? String(e);
        return {
          content: [{ type: 'text', text: `❌ Error running git ${action}: ${msg}` }],
          details: { error: msg, action },
          isError: true,
        };
      }
    },
    renderCall: renderGitCall,
    renderResult: renderGitResult,
  };
}

export function registerGitTool(api: ExtensionAPI): void {
  api.registerTool(createGitTool(api));
}
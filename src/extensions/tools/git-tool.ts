#!/usr/bin/env node
/**
 * Git Tool
 *
 * Wraps common Git operations.
 * Actions:
 * - status: git status --porcelain
 * - diff: git diff [path] (if no path, diff HEAD)
 * - commit: git commit -m "<message>" (requires message)
 * - add: git add <files...> (requires files array)
 * - push: git push [remote] [branch] (defaults: origin HEAD)
 * - pull: git pull [remote] [branch] (defaults: origin HEAD)
 * - log: git log --oneline -n <count> (default 10)
 */

import type { ExtensionAPI, ExtensionContext, ExecOptions } from "@earendil-works/pi-coding-agent";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

function createGitTool(api: ExtensionAPI): ToolDefinition<any, any> {
  return {
    name: 'git',
    label: 'Git',
    description: 'Execute Git commands: status, diff, commit, add, push, pull, log. Uses git on PATH.',
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
      let needCwd = true;
      let requireConfirm = false;

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
          // Ask for confirmation if UI available and not forced
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
        const result = await api.exec('git', args, execOptions);
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
  };
}

export function registerGitTool(api: ExtensionAPI): void {
  api.registerTool(createGitTool(api));
}

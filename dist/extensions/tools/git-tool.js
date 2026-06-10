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
import { Text } from "@earendil-works/pi-tui";
function renderGitCall(args, theme) {
    const action = args.action || 'unknown';
    const text = `${theme.fg("toolTitle", theme.bold("git"))} ${theme.fg("muted", action)}`;
    return new Text(text, 0, 0);
}
function renderGitResult(result, options, theme) {
    if (options.isPartial)
        return new Text(theme.fg("warning", "Running..."), 0, 0);
    const details = result.details;
    if (!details)
        return new Text("", 0, 0);
    const { success, exitCode, action, stdout } = details;
    const icon = success ? '✅' : '❌';
    const color = success ? 'success' : 'error';
    const lines = [`${icon} git ${action} (exit ${exitCode})`];
    if (stdout && options.expanded) {
        const snippet = stdout.split('\n').slice(0, 5).join('\n');
        lines.push(theme.fg('dim', snippet));
    }
    return new Text(lines.join('\n'), 0, 0);
}
function createGitTool(api) {
    return {
        name: 'git',
        label: 'Git',
        description: 'Execute Git commands: status, diff, commit, add, push, pull, log. Uses git on PATH.',
        parameters: {},
        async execute(toolCallId, params, signal, _onUpdate, ctx) {
            let action;
            if (params && typeof params === 'object' && !(params instanceof AbortSignal)) {
                action = params.action;
            }
            else if (typeof params === 'string') {
                try {
                    const p = JSON.parse(params);
                    action = p.action;
                }
                catch {
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
            const args = [];
            let needCwd = true;
            let requireConfirm = false;
            switch (action) {
                case 'status':
                    args.push('status', '--porcelain');
                    break;
                case 'diff':
                    const path = params.path;
                    if (path) {
                        args.push('diff', '--', path);
                    }
                    else {
                        args.push('diff', 'HEAD');
                    }
                    break;
                case 'commit':
                    const message = params.message;
                    if (!message) {
                        return { content: [{ type: 'text', text: 'Error: message required for commit' }], details: { error: 'Missing message' }, isError: true };
                    }
                    // Ask for confirmation if UI available and not forced
                    if (ctx.hasUI && !params.force) {
                        const confirmed = await ctx.ui.confirm('Git Commit', `Commit changes with message:\n"${message}"?`, {});
                        if (!confirmed) {
                            return { content: [{ type: 'text', text: 'Commit cancelled' }], details: { cancelled: true }, isError: false };
                        }
                    }
                    args.push('commit', '-m', message);
                    break;
                case 'add':
                    const files = params.files;
                    if (!Array.isArray(files) || files.length === 0) {
                        return { content: [{ type: 'text', text: 'Error: files required (array of strings)' }], details: { error: 'Missing files' }, isError: true };
                    }
                    args.push('add', ...files);
                    break;
                case 'push':
                    const remote = params.remote || 'origin';
                    const branch = params.branch || 'HEAD';
                    args.push('push', remote, branch);
                    break;
                case 'pull':
                    const pRemote = params.remote || 'origin';
                    const pBranch = params.branch || 'HEAD';
                    args.push('pull', pRemote, pBranch);
                    break;
                case 'log':
                    const count = params.count || 10;
                    args.push('log', '--oneline', '-n', String(count));
                    break;
            }
            const execOptions = { cwd: ctx.cwd };
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
            }
            catch (e) {
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
export function registerGitTool(api) {
    api.registerTool(createGitTool(api));
}
//# sourceMappingURL=git-tool.js.map
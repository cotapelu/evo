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
import { Text } from "@earendil-works/pi-tui";
function createCodeHealthTool(api) {
    const defaultChecks = ['lint', 'typecheck', 'test', 'build'];
    const allowedChecks = [...defaultChecks, 'audit'];
    // Mapping from check names to npm commands
    function getCommand(check) {
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
            case 'audit':
                return { cmd: 'npm', args: ['audit'] };
        }
    }
    return {
        name: 'code-health',
        label: 'Code Health',
        description: 'Run code health checks: lint, typecheck, test, build. Returns aggregated summary.',
        promptSnippet: "code-health({ checks?: ['lint','typecheck','test','build','audit'] }) - audit all or specify subset.",
        parameters: {},
        async execute(toolCallId, params, signal, _onUpdate, ctx) {
            // Determine which checks to run
            let checksToRun = [...defaultChecks];
            if (params && typeof params === 'object' && !(params instanceof AbortSignal)) {
                const requested = params.checks;
                if (Array.isArray(requested)) {
                    checksToRun = requested.filter(c => allowedChecks.includes(c));
                    if (checksToRun.length === 0) {
                        return {
                            content: [{ type: 'text', text: 'No valid checks specified. Allowed: lint, typecheck, test, build' }],
                            details: { error: 'No valid checks' },
                            isError: true,
                        };
                    }
                }
            }
            const results = [];
            let hasFailure = false;
            // Run each check sequentially
            for (const check of checksToRun) {
                const { cmd, args } = getCommand(check);
                const execOptions = { cwd: ctx.cwd };
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
                    if (!success)
                        hasFailure = true;
                    results.push({
                        name: check,
                        command: `${cmd} ${args.join(' ')}`,
                        args,
                        exitCode: code,
                        stdout,
                        stderr,
                        success,
                    });
                }
                catch (e) {
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
            const lines = ['🔍 Code Health Check Results:', ''];
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
        renderCall: renderCodeHealthCall,
        renderResult: renderCodeHealthResult,
    };
}
function renderCodeHealthCall(args, theme) {
    const checksArg = (args && typeof args === 'object' && args.checks);
    let checksList;
    if (Array.isArray(checksArg)) {
        checksList = checksArg.join(', ');
    }
    else {
        checksList = 'lint, typecheck, test, build';
    }
    const text = `${theme.fg("toolTitle", theme.bold("code-health"))} ${theme.fg("muted", `audit [${checksList}]`)}`;
    return new Text(text, 0, 0);
}
function renderCodeHealthResult(result, options, theme) {
    if (options.isPartial) {
        return new Text(theme.fg("warning", "Running checks..."), 0, 0);
    }
    const details = result.details;
    if (!details) {
        return new Text("", 0, 0);
    }
    const checks = details.checks || [];
    const lines = [];
    lines.push(theme.fg("toolTitle", `Code Health`));
    lines.push('');
    for (const ch of checks) {
        const icon = ch.success ? '✅' : '❌';
        const color = ch.success ? 'success' : 'error';
        const name = theme.fg('accent', ch.name.padEnd(12));
        const status = ch.success ? theme.fg('success', `exit ${ch.exitCode}`) : theme.fg('error', `exit ${ch.exitCode}`);
        lines.push(`  ${icon} ${name}  ${status}`);
        if (!ch.success && ch.stderr) {
            const errLines = ch.stderr.split('\n').slice(0, 2);
            for (const el of errLines) {
                lines.push(`      ${theme.fg("dim", el)}`);
            }
        }
    }
    lines.push('');
    const failedCount = checks.filter((c) => !c.success).length;
    const overallMsg = checks.length === 0
        ? theme.fg("dim", "No checks")
        : (details.overallSuccess
            ? theme.fg("success", `✅ All ${checks.length} checks passed`)
            : theme.fg("error", `⚠️ ${failedCount}/${checks.length} failed`));
    lines.push(overallMsg);
    return new Text(lines.join('\n'), 0, 0);
}
export function registerCodeHealthTool(api) {
    api.registerTool(createCodeHealthTool(api));
}
//# sourceMappingURL=code-health-tool.js.map
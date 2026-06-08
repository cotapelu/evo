#!/usr/bin/env node
/**
 * Test Runner Tool
 *
 * Runs project tests and returns results.
 * Parameters:
 *   pattern?: string - test filter pattern passed to test runner
 */
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
function createTestRunnerTool(api) {
    return {
        name: 'test',
        label: 'Test Runner',
        description: 'Run project tests. Accepts optional pattern to filter tests. Returns exit code and output.',
        parameters: {},
        async execute(toolCallId, params, signal, _onUpdate, ctx) {
            let pattern;
            if (params && typeof params === 'object' && !(params instanceof AbortSignal)) {
                pattern = params.pattern;
            }
            else if (typeof params === 'string') {
                try {
                    const p = JSON.parse(params);
                    pattern = p.pattern;
                }
                catch {
                    // ignore
                }
            }
            const args = ['test'];
            const afterArgs = [];
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
            const execOptions = { cwd: ctx.cwd };
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
                let coverage = undefined;
                if (wantCoverage && code === 0) {
                    const coveragePath = join(ctx.cwd, 'coverage', 'coverage-summary.json');
                    if (existsSync(coveragePath)) {
                        try {
                            coverage = JSON.parse(readFileSync(coveragePath, 'utf-8'));
                        }
                        catch (e) {
                            // ignore coverage parse errors
                        }
                    }
                }
                // Persist coverage to history file (fire-and-forget)
                if (coverage) {
                    (async () => {
                        try {
                            const historyDir = join(ctx.cwd, '.pi');
                            await mkdir(historyDir, { recursive: true });
                            const historyPath = join(historyDir, 'coverage-history.json');
                            let history = [];
                            try {
                                const existing = await readFile(historyPath, 'utf-8');
                                history = JSON.parse(existing);
                            }
                            catch (e) { /* ignore */ }
                            const total = coverage.total || coverage.totals || coverage;
                            const getPct = (cov) => {
                                const pct = typeof cov === 'number' ? cov : (cov?.pct || cov?.percent || 0);
                                return Number(pct.toFixed?.(1) ?? pct);
                            };
                            const entry = {
                                timestamp: new Date().toISOString(),
                                statements: getPct(total.statements || total?.statements),
                                branches: getPct(total.branches || total?.branches),
                                functions: getPct(total.functions || total?.functions),
                                lines: getPct(total.lines || total?.lines),
                            };
                            history.push(entry);
                            await writeFile(historyPath, JSON.stringify(history, null, 2), 'utf-8');
                        }
                        catch (e) {
                            // ignore history write errors
                        }
                    })();
                }
                return {
                    content: [{ type: 'text', text: message }],
                    details: { exitCode: code, stdout, stderr, output, pattern, coverage },
                    isError: !success,
                };
            }
            catch (e) {
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
export function registerTestRunnerTool(api) {
    api.registerTool(createTestRunnerTool(api));
}
//# sourceMappingURL=test-runner.js.map
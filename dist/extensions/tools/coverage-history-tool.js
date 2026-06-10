#!/usr/bin/env node
/**
 * Coverage History Tool
 *
 * Shows trends of code coverage over time from .pi/coverage-history.json.
 */
import { Text } from '@earendil-works/pi-tui';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
function createCoverageHistoryTool() {
    return {
        name: 'coverage-history',
        label: 'Coverage History',
        description: 'Display historical coverage trends. Requires prior test runs with coverage.',
        parameters: {},
        async execute(toolCallId, params, _signal, _onUpdate, ctx) {
            const cwd = ctx.cwd;
            const historyPath = join(cwd, '.pi', 'coverage-history.json');
            try {
                const raw = await readFile(historyPath, 'utf-8');
                const history = JSON.parse(raw);
                if (!Array.isArray(history) || history.length === 0) {
                    return {
                        content: [{ type: 'text', text: 'Coverage history is empty.' }],
                        details: { count: 0 },
                        isError: false,
                    };
                }
                // Format as a table (most recent at bottom)
                const lines = [];
                lines.push('📈 Coverage History (most recent at bottom)');
                lines.push('─'.repeat(80));
                // Header
                lines.push(`${'Date'.padEnd(20)} | Statements | Branches | Functions | Lines`);
                lines.push('─'.repeat(80));
                for (const entry of history) {
                    const dateStr = new Date(entry.timestamp).toLocaleDateString() + ' ' + new Date(entry.timestamp).toLocaleTimeString();
                    const st = `${entry.statements ?? 0}%`.padStart(8);
                    const br = `${entry.branches ?? 0}%`.padStart(8);
                    const fn = `${entry.functions ?? 0}%`.padStart(9);
                    const ln = `${entry.lines ?? 0}%`.padStart(6);
                    lines.push(`${dateStr.padEnd(20)} | ${st} | ${br} | ${fn} | ${ln}`);
                }
                lines.push('─'.repeat(80));
                const summary = lines.join('\n');
                return {
                    content: [{ type: 'text', text: summary }],
                    details: { count: history.length, path: historyPath },
                    isError: false,
                };
            }
            catch (e) {
                if (e.code === 'ENOENT') {
                    return {
                        content: [{ type: 'text', text: 'No coverage history found. Run tests with coverage first.' }],
                        details: { error: 'no history' },
                        isError: true,
                    };
                }
                return {
                    content: [{ type: 'text', text: `Error reading coverage history: ${e.message}` }],
                    details: { error: e.message },
                    isError: true,
                };
            }
        },
        renderCall(args, theme) {
            const th = theme;
            const text = th.fg('toolTitle', th.bold('coverage-history')) + th.fg('muted', ' trends');
            return new Text(text, 0, 0);
        },
        renderResult(result, options, theme) {
            const th = theme;
            if (options.isPartial)
                return new Text(th.fg('warning', 'Loading...'), 0, 0);
            if (result.isError)
                return new Text(th.fg('error', 'No history'), 0, 0);
            const count = result.details?.count || 0;
            return new Text(th.fg('accent', `📈 ${count} entries`), 0, 0);
        },
    };
}
export function registerCoverageHistoryTool(api) {
    api.registerTool(createCoverageHistoryTool());
}
//# sourceMappingURL=coverage-history-tool.js.map
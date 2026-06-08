#!/usr/bin/env node
/**
 * Format Tool
 *
 * Formats the codebase using Prettier.
 * Runs `npx prettier --write .`
 */
function createFormatTool(api) {
    return {
        name: 'format',
        label: 'Code Formatter',
        description: 'Format codebase using Prettier. Runs `npx prettier --write .` in the project root.',
        promptSnippet: 'format - formats entire codebase with Prettier.',
        parameters: {},
        async execute(toolCallId, params, signal, _onUpdate, ctx) {
            const args = ['prettier', '--write', '.'];
            const execOptions = { cwd: ctx.cwd };
            if (signal) {
                execOptions.signal = signal;
            }
            try {
                const result = await api.exec('npx', args, execOptions);
                const { stdout, stderr, code } = result;
                const success = code === 0;
                const message = success
                    ? `✅ Code formatted successfully`
                    : `❌ Formatting failed (exit code ${code})`;
                return {
                    content: [{ type: 'text', text: message }],
                    details: { exitCode: code, stdout, stderr },
                    isError: !success,
                };
            }
            catch (e) {
                const msg = e.message ?? String(e);
                return {
                    content: [{ type: 'text', text: `❌ Error formatting code: ${msg}` }],
                    details: { error: msg },
                    isError: true,
                };
            }
        },
    };
}
export function registerFormatTool(api) {
    api.registerTool(createFormatTool(api));
}
//# sourceMappingURL=format-tool.js.map
#!/usr/bin/env node
/**
 * Cancel Command
 *
 * Slash command `/cancel` aborts the current running operation
 * (tool execution or LLM generation) via the context's abort signal.
 */
export default function cancelCommand(api) {
    api.registerCommand('cancel', {
        description: 'Cancel the current tool execution or LLM generation',
        handler: async (_args, ctx) => {
            if (typeof ctx.abort === 'function') {
                ctx.abort();
                ctx.ui?.notify?.('✅ Cancelled', { type: 'info' });
            }
            else {
                ctx.ui?.notify?.('❌ No abort mechanism available', { type: 'error' });
            }
        },
    });
}
//# sourceMappingURL=cancel-command.js.map
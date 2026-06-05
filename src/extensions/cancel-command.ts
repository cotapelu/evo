#!/usr/bin/env node
/**
 * Cancel Command
 *
 * Slash command `/cancel` aborts the current running operation
 * (tool execution or LLM generation) via the context's abort signal.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function cancelCommand(api: ExtensionAPI) {
  api.registerCommand('cancel', {
    description: 'Cancel the current tool execution or LLM generation',
    handler: async (_args: string, ctx: any) => {
      if (typeof ctx.abort === 'function') {
        ctx.abort();
        ctx.ui?.notify?.('✅ Cancelled', { type: 'info' } as any);
      } else {
        ctx.ui?.notify?.('❌ No abort mechanism available', { type: 'error' } as any);
      }
    },
  });
}
#!/usr/bin/env node
/**
 * Session Info Tool
 *
 * Provides statistics about the current session.
 * No parameters required.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

function createSessionInfoTool(): ToolDefinition<any, any> {
  return {
    name: 'session_info',
    label: 'Session Info',
    description: 'Get statistics about the current session: ID, leaf ID, total entries, message count, branches, compactions, and cwd.',
    parameters: {},
    async execute(toolCallId, params, _signal, _onUpdate, ctx) {
      // Accept empty params or ignore
      const sm = ctx.sessionManager;
      try {
        const entries = sm.getEntries?.() ?? [];
        const tree = sm.getTree?.() ?? [];
        const leafId = sm.getLeafId?.() ?? null;
        const cwd = sm.getCwd?.() ?? ctx.cwd;
        const sessionId = sm.getSessionId?.() ?? 'unknown';

        const messageCount = entries.filter(e => e.type === 'message').length;
        const compactionCount = entries.filter(e => e.type === 'compaction').length;
        const branchCount = entries.filter(e => e.type === 'branch_summary').length;
        const labelCount = entries.filter(e => e.type === 'label').length;

        // Approximate token count: 4 chars per token (very rough)
        let totalChars = 0;
        for (const e of entries) {
          totalChars += JSON.stringify(e).length;
        }
        const estimatedTokens = Math.ceil(totalChars / 4);

        const info = {
          session_id: sessionId,
          cwd,
          leaf_id: leafId,
          total_entries: entries.length,
          message_count: messageCount,
          compaction_count: compactionCount,
          branch_summary_count: branchCount,
          label_count: labelCount,
          estimated_tokens: estimatedTokens,
          root_nodes: tree.length,
        };

        return {
          content: [{ type: 'text', text: `Session info collected (${entries.length} entries)` }],
          details: info,
          isError: false,
        };
      } catch (e: any) {
        const msg = e.message ?? String(e);
        return {
          content: [{ type: 'text', text: `Error: ${msg}` }],
          details: { error: msg },
          isError: true,
        };
      }
    },
  };
}

export function registerSessionInfoTool(api: ExtensionAPI): void {
  api.registerTool(createSessionInfoTool());
}

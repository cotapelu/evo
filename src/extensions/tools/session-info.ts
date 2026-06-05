#!/usr/bin/env node
/**
 * Session Info Tool
 *
 * Provides statistics about the current session.
 * No parameters required.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

function renderSessionInfoCall(args: any, theme: any): Text {
  const text = `${theme.fg("toolTitle", theme.bold("session_info"))} ${theme.fg("muted", "info")}`;
  return new Text(text, 0, 0);
}

function renderSessionInfoResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: any): Text {
  if (options.isPartial) {
    return new Text(theme.fg("warning", "Loading..."), 0, 0);
  }
  const info = result.details;
  if (!info) {
    return new Text("", 0, 0);
  }

  const lines: string[] = [
    theme.fg("toolTitle", `Session Info`),
    `  ${theme.fg("accent", "Session ID")}: ${info.session_id}`,
    `  ${theme.fg("accent", "CWD")}: ${info.cwd}`,
    `  ${theme.fg("accent", "Leaf")}: ${info.leaf_id ?? 'none'}`,
    `  ${theme.fg("accent", "Entries")}: ${info.total_entries}`,
    `  ${theme.fg("accent", "Messages")}: ${info.message_count}`,
    `  ${theme.fg("accent", "Compactions")}: ${info.compaction_count}`,
    `  ${theme.fg("accent", "Branches")}: ${info.branch_summary_count}`,
    `  ${theme.fg("accent", "Labels")}: ${info.label_count}`,
    `  ${theme.fg("accent", "Est. Tokens")}: ${info.estimated_tokens}`,
    `  ${theme.fg("accent", "Root Nodes")}: ${info.root_nodes}`,
  ];

  return new Text(lines.join('\n'), 0, 0);
}

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
    renderCall: renderSessionInfoCall,
    renderResult: renderSessionInfoResult,
  };
}

export function registerSessionInfoTool(api: ExtensionAPI): void {
  api.registerTool(createSessionInfoTool());
}

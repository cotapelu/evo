#!/usr/bin/env node

/**
 * Session Summary Tool
 *
 * One-command overview of current session: stats + mini-graph.
 * Demonstrates tool composition and combined data presentation.
 */

import { type ToolDefinition, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { buildSimpleTree, renderTree, getMessagePreview } from "./session-utils.js";

export function registerSessionSummaryTool(api: ExtensionAPI): void {
  api.registerTool(createTool());
}

function createTool(): ToolDefinition {
  return {
    name: "session_summary",
    label: "Session Summary",
    description: "Quick overview of current session: stats, recent activity, and tree preview.",
    parameters: {},

    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const sm = ctx.sessionManager;
      const cache = getCacheForContext(ctx);
      const useCache = cache && cache.sessionId === sm.getSessionId();

      const entries = sm.getEntries();
      const messages = entries.filter(e => e.type === 'message');
      const recentMessages = messages.slice(-5).reverse();

      const stats = {
        totalEntries: useCache ? cache.totalEntries : entries.length,
        messages: useCache ? cache.messageCount : messages.length,
        compactions: useCache ? cache.compactionCount : entries.filter(e => e.type === 'compaction').length,
        branches: useCache ? cache.branchCount : entries.filter(e => e.type === 'branch_summary').length,
        leafId: sm.getLeafId(),
        lastActivity: useCache ? cache.lastActivity : new Date(),
        lastEvent: useCache ? cache.lastEvent : "direct",
      };

      const lines: string[] = [
        "=== Session Summary ===",
        `ID: ${sm.getSessionId()?.substring(0, 12)}`,
        `CWD: ${ctx.cwd}`,
        `Leaf: ${stats.leafId ?? 'none'}`,
        `Entries: ${stats.totalEntries}`,
        `Messages: ${stats.messages}`,
        `Compactions: ${stats.compactions}`,
        `Branches: ${stats.branches}`,
        `Last: ${stats.lastActivity.toLocaleTimeString()} (${stats.lastEvent})`,
        "",
        "Recent Messages:",
      ];

      for (const msgEntry of recentMessages) {
        const msg = msgEntry.message as any;
        const role = msg.role === 'user' ? '👤' : msg.role === 'assistant' ? '🤖' : '⚙️';
        const preview = getMessagePreview(msgEntry, 40);
        const time = new Date(msgEntry.timestamp).toLocaleTimeString();
        lines.push(`  ${role} ${time} ${preview}`);
      }

      // Mini tree (depth 3)
      lines.push("");
      lines.push("Tree (preview):");
      const branch = sm.getBranch();
      if (branch.length > 0) {
        const nodes = buildSimpleTree(branch, branch[0]?.id ?? "", 3);
        const previewLines = renderTree(nodes, { showMarker: true });
        lines.push(...previewLines);
      } else {
        lines.push("  (empty)");
      }

      const text = lines.join("\n");
      return { content: [{ type: "text", text }], details: { stats } };
    },

    renderCall(args, theme) {
      return new Text(`${theme.fg("toolTitle", theme.bold("session_sum"))} overview`, 0, 0);
    },

    renderResult(result, _options, theme) {
      const anyResult = result as any;
      return new Text(theme.fg("text", anyResult.content[0].text), 0, 0);
    },
  };
}

// Helper get cache - avoid circular import by accessing via global in extension context
function getCacheForContext(ctx: ExtensionContext): any {
  // @ts-ignore - cache installed by our extension
  return ctx.__sessionCache ?? null;
}

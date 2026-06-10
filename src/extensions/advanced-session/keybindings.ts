#!/usr/bin/env node

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { buildSimpleTree, renderTree } from "./session-utils.js";

// Keybindings using { key, modifiers } notation
const KEYBINDINGS: Array<{ key: string; modifiers: string[]; action: string; description: string }> = [
  { key: "i", modifiers: ["ctrl"], action: "session_info", description: "Show session info" },
  { key: "g", modifiers: ["ctrl"], action: "session_graph", description: "Show session graph" },
];

export function registerSessionKeybindings(api: ExtensionAPI): void {
  for (const kb of KEYBINDINGS) {
    api.registerShortcut({ key: kb.key, modifiers: kb.modifiers } as any, { handler: async (ctx) => {
      await handleKeybinding(ctx, kb.action);
    }});
  }
}

async function handleKeybinding(ctx: ExtensionContext, action: string): Promise<void> {
  try {
    if (action === "session_info" || action === "session_graph") {
      await executeSessionManager(ctx, { operation: action });
    }
  } catch (e: any) {
    if (ctx.hasUI) {
      ctx.ui.notify(`Error: ${e.message}`, "error");
    }
  }
}

async function executeSessionManager(ctx: ExtensionContext, params: { operation: string }): Promise<void> {
  try {
    if (params.operation === "info") {
      const sm = ctx.sessionManager;
      const entries = sm.getEntries();
      const leafId = sm.getLeafId();
      const text = [
        `Session: ${sm.getSessionId()?.substring(0,12) ?? 'unknown'}`,
        `Leaf: ${leafId ?? 'none'}`,
        `Entries: ${entries.length}`,
        `Messages: ${entries.filter(e => e.type === 'message').length}`,
        `Compactions: ${entries.filter(e => e.type === 'compaction').length}`,
      ].join("\n");
      if (ctx.hasUI) {
        ctx.ui.setStatus("session", `info: ${entries.length} entries`);
        // @ts-ignore - editor may not exist
        ctx.ui.editor?.(`Session Info\n\n${text}`).catch(() => {});
      }
    } else if (params.operation === "graph") {
      const branch = ctx.sessionManager.getBranch();
      if (branch.length === 0) {
        if (ctx.hasUI) ctx.ui.notify("Empty session", "warning");
        return;
      }
      const nodes = buildSimpleTree(branch, branch[0]?.id ?? "", 15);
      const lines = renderTree(nodes, { showMarker: true });
      const text = lines.join("\n");
      if (ctx.hasUI) {
        ctx.ui.setStatus("session", `graph: ${lines.length} nodes`);
        ctx.ui.editor?.(`Session Graph\n\n${text}`).catch(() => {});
      }
    }
  } catch (e: any) {
    if (ctx.hasUI) ctx.ui.notify(`Error: ${e.message}`, "error");
  }
}

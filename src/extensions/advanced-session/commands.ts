#!/usr/bin/env node

import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildSimpleTree, renderTree, getMessagePreview } from "./session-utils.js";

export function registerSessionCommands(api: ExtensionAPI): void {
  // /sessions
  api.registerCommand("sessions", {
    description: "List all sessions",
    handler: async (_arg, ctx) => {
      // Directly call session manager - not via tool
      try {
        const SessionManager = (await import("@earendil-works/pi-coding-agent")).SessionManager;
        const sessions = await SessionManager.list(ctx.cwd);
        const text = `Sessions (${sessions.length}):\n` + sessions.map((s: any) =>
          `- ${s.id.substring(0,8)}: ${s.name || '(unnamed)'} (${s.messageCount} msgs)`
        ).join("\n");
        if (ctx.hasUI) {
          ctx.ui.notify(`Found ${sessions.length} sessions`, "info");
        }
        // If in interactive editor, maybe set to input? For now just status
        ctx.ui.setStatus("sessions", `Sessions: ${sessions.length}`);
      } catch (e: any) {
        ctx.ui.notify(`Error: ${e.message}`, "error");
      }
    },
  });

  // /session <operation>
  api.registerCommand("session", {
    description: "Session operations: info, graph",
    handler: async (arg, ctx) => {
      const parts = arg.trim().split(/\s+/);
      const op = parts[0] || "info";

      try {
        if (op === "info") {
          const sm = ctx.sessionManager;
          const entries = sm.getEntries();
          const leafId = sm.getLeafId();
          const text = [
            `Session: ${sm.getSessionId()?.substring(0,12) ?? 'unknown'}`,
            `Leaf: ${leafId ?? 'none'}`,
            `Entries: ${entries.length}`,
            `Messages: ${entries.filter(e => e.type === 'message').length}`,
          ].join("\n");
          ctx.ui.setStatus("session", `info: ${entries.length} entries`);
          if (ctx.hasUI) {
            ctx.ui.editor?.(`Session Info\n\n${text}`).catch(() => {});
          }
        } else if (op === "graph") {
          const branch = ctx.sessionManager.getBranch();
          if (branch.length === 0) {
            ctx.ui.notify("Empty session", "warning");
            return;
          }
          // Build simple tree using shared utility
          const nodes = buildSimpleTree(branch, (branch[0]?.id ?? ""), 15);
          const lines = renderTree(nodes, { showMarker: true });
          const text = lines.join("\n");
          ctx.ui.setStatus("session", `graph: ${lines.length} nodes`);
          if (ctx.hasUI) {
            ctx.ui.editor?.(`Session Graph\n\n${text}`).catch(() => {});
          }
        } else {
          ctx.ui.notify(`Unknown operation: ${op}. Use info, graph`, "warning");
        }
      } catch (e: any) {
        ctx.ui.notify(`Error: ${e.message}`, "error");
      }
    },
  });
}

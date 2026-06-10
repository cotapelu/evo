#!/usr/bin/env node

import { type ToolDefinition, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { getCacheForContext } from "./session-stats-cache.js";
import { buildSimpleTree, renderTree, getMessagePreview } from "./session-utils.js";
import { emitSessionLifecycleMessage } from "./custom-messages.js";

export function registerSessionManagerTool(api: ExtensionAPI): void {
  api.registerTool(createTool());
}

function createTool(): ToolDefinition {
  return {
    name: "session_manager",
    label: "Session Manager",
    description: "Session introspection + runtime control. Ops: list, info, graph, create, switch, fork, import.",
    promptSnippet: "session_manager({ operation: 'create' }) - full lifecycle.",
    promptGuidelines: [
      "Operations: list, info, graph, create, switch, fork, import",
      "Runtime ops (create, switch, fork, import) require interactive mode.",
    ],
    parameters: {},

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const p = params as any;
      const op = p.operation || "info";
      const details: any = { operation: op };

      try {
        if (op === "list") {
          const SessionManager = (await import("@earendil-works/pi-coding-agent")).SessionManager;
          const sessions = await SessionManager.list(ctx.cwd);
          const text = `Sessions (${sessions.length}):\n` + sessions.map((s: any) =>
            `- ${s.id.substring(0,8)}: ${s.name || '(unnamed)'} (${s.messageCount} msgs)`
          ).join("\n");
          return { content: [{ type: "text", text }], details: { ...details, count: sessions.length } };
        }

        if (op === "info") {
          const sm = ctx.sessionManager;
          const entries = sm.getEntries();
          const tree = sm.getTree();
          const leafId = sm.getLeafId();
          const cache = getCacheForContext(ctx);
          const useCache = cache && cache.sessionId === sm.getSessionId();

          const stats = {
            totalEntries: useCache ? cache.totalEntries : entries.length,
            messages: useCache ? cache.messageCount : entries.filter(e => e.type === 'message').length,
            compactions: useCache ? cache.compactionCount : entries.filter(e => e.type === 'compaction').length,
            branches: useCache ? cache.branchCount : entries.filter(e => e.type === 'branch_summary').length,
            labels: entries.filter(e => e.type === 'label').length,
            leafId,
            rootNodes: tree.length,
            lastActivity: useCache ? cache.lastActivity : new Date(),
            lastEvent: useCache ? cache.lastEvent : "direct",
          };
          const text = [
            `Session: ${sm.getSessionId()?.substring(0,12) ?? 'unknown'}`,
            `CWD: ${ctx.cwd}`,
            `Leaf: ${leafId ?? 'none'}`,
            `Entries: ${stats.totalEntries}`,
            `Messages: ${stats.messages}`,
            `Compactions: ${stats.compactions}`,
            `Branches: ${stats.branches}`,
            `Labels: ${stats.labels}`,
            `Roots: ${stats.rootNodes}`,
            `Last: ${stats.lastActivity.toLocaleTimeString()} (${stats.lastEvent})`,
          ].join("\n");
          return { content: [{ type: "text", text }], details: { ...details, ...stats } };
        }

        if (op === "graph") {
          const branch = ctx.sessionManager.getBranch();
          const headId = ctx.sessionManager.getSessionId();
          if (branch.length === 0) return { content: [{ type: "text", text: "(empty)" }], details };
          const nodes = buildSimpleTree(branch, headId, 15);
          const lines = renderTree(nodes, { showMarker: true });
          const text = lines.join("\n");
          return { content: [{ type: "text", text }], details: { ...details, nodes: lines.length } };
        }

        // Runtime operations
        if (["create", "switch", "fork", "import"].includes(op)) {
          const runtime = (ctx as any).runtime;
          if (!runtime) {
            return {
              content: [{ type: "text", text: `❌ '${op}' requires interactive mode.` }],
              isError: true,
              details: { ...details, error: "runtime_not_available" }
            };
          }

          if (op === "create") {
            const result = await runtime.newSession({ parentSession: p.parentSession });
            if (result.cancelled) {
              return { content: [{ type: "text", text: "Creation cancelled." }], details };
            }
            emitSessionLifecycleMessage(ctx, "session_created", { sessionId: ctx.sessionManager.getSessionId() });
            return { content: [{ type: "text", text: `✅ New session: ${ctx.sessionManager.getSessionId()?.substring(0,12)}` }], details };
          }

          if (op === "switch") {
            if (!p.sessionPath) {
              return { content: [{ type: "text", text: "❌ sessionPath required." }], isError: true, details };
            }
            const result = await runtime.switchSession(p.sessionPath, { cwdOverride: p.cwdOverride });
            if (result.cancelled) {
              return { content: [{ type: "text", text: "Switch cancelled." }], details };
            }
            emitSessionLifecycleMessage(ctx, "session_switched", { path: p.sessionPath });
            return { content: [{ type: "text", text: `✅ Switched to: ${p.sessionPath}` }], details };
          }

          if (op === "fork") {
            if (!p.entryId) {
              return { content: [{ type: "text", text: "❌ entryId required." }], isError: true, details };
            }
            const result = await runtime.fork(p.entryId, { position: "at" });
            if (result.cancelled) {
              return { content: [{ type: "text", text: "Fork cancelled." }], details };
            }
            emitSessionLifecycleMessage(ctx, "session_forked", { entryId: p.entryId });
            return { content: [{ type: "text", text: `✅ Forked at: ${p.entryId}` }], details };
          }

          if (op === "import") {
            if (!p.importPath) {
              return { content: [{ type: "text", text: "❌ importPath required." }], isError: true, details };
            }
            const result = await runtime.importFromJsonl(p.importPath, p.cwdOverride);
            if (result.cancelled) {
              return { content: [{ type: "text", text: "Import cancelled." }], details };
            }
            emitSessionLifecycleMessage(ctx, "session_imported", { path: p.importPath });
            return { content: [{ type: "text", text: `✅ Imported: ${p.importPath}` }], details };
          }
        }

        return { content: [{ type: "text", text: `Unknown op: ${op}` }], details };
      } catch (e: any) {
        return { content: [{ type: "text", text: `❌ Error: ${e.message}` }], details: { ...details, error: e.message } };
      }
    },

    renderCall(args, theme) {
      const op = (args as any).operation || "info";
      return new Text(`${theme.fg("toolTitle", theme.bold("session_manager"))} ${op}`, 0, 0);
    },

    renderResult(result, _options, theme) {
      const anyResult = result as any;
      const text = anyResult.content?.[0]?.text ?? String(anyResult.content ?? "");
      return new Text(theme.fg("text", text), 0, 0);
    },
  };
}

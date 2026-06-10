#!/usr/bin/env node

import { type ToolDefinition, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

export function registerSessionManagerTool(api: ExtensionAPI): void {
  api.registerTool(createTool());
}

function createTool(): ToolDefinition {
  return {
    name: "session_manager",
    label: "Session Manager",
    description: "Session introspection: list, info, graph. Uses SessionManager.",
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
          const stats = {
            totalEntries: entries.length,
            messages: entries.filter(e => e.type === 'message').length,
            compactions: entries.filter(e => e.type === 'compaction').length,
            branches: entries.filter(e => e.type === 'branch_summary').length,
            labels: entries.filter(e => e.type === 'label').length,
            leafId,
            rootNodes: tree.length,
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
          ].join("\n");
          return { content: [{ type: "text", text }], details: { ...details, ...stats } };
        }

        if (op === "graph") {
          const branch = ctx.sessionManager.getBranch();
          const headId = ctx.sessionManager.getSessionId();
          if (branch.length === 0) return { content: [{ type: "text", text: "(empty)" }], details };

          const lines: string[] = [];
          const visited = new Set<string>();
          function walk(entry: any, depth: number, prefix: string): void {
            if (depth > 15 || visited.has(entry.id)) return;
            visited.add(entry.id);
            const indent = "  ".repeat(depth);
            const marker = entry.type === "message" && entry.message?.role === "user" ? "👤" :
                           entry.type === "message" && entry.message?.role === "assistant" ? "🤖" :
                           entry.type === "branch_summary" ? "⛓️" :
                           entry.type === "compaction" ? "📦" : "📄";
            const preview = getPreview(entry, 30);
            lines.push(`${indent}${marker} ${preview}`);
            const children = branch.filter((e: any) => e.parentId === entry.id);
            children.sort((a: any, b: any) => {
              const order: Record<string, number> = { user: 0, assistant: 1 };
              const ra = a.message?.role as string;
              const rb = b.message?.role as string;
              return (order[ra] ?? 2) - (order[rb] ?? 2);
            });
            children.forEach((child: any, idx: number) => {
              const isLast = idx === children.length - 1;
              const childPrefix = prefix + (isLast ? "└── " : "├── ");
              lines.push(childPrefix);
              walk(child, depth + 1, prefix + (isLast ? "    " : "│   "));
            });
          }
          const root = branch.find((e: any) => !e.parentId || !branch.some((c: any) => c.id === e.parentId)) || branch[0];
          if (root) walk(root, 0, "");

          const text = lines.join("\n");
          return { content: [{ type: "text", text }], details: { ...details, nodes: lines.length } };
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
      const textResult = result.content[0] as any;
      return new Text(theme.fg("text", textResult.text), 0, 0);
    },
  };
}

function getPreview(entry: any, maxLen: number): string {
  if (entry.type === "message" && entry.message?.content) {
    // @ts-ignore
    const content: any[] = entry.message.content;
    for (const part of content) {
      if (part.type === "text") {
        // @ts-ignore
        const t = String((part as any).text ?? "").trim().replace(/\n/g, " ");
        return t.length > maxLen ? t.slice(0, maxLen) + "..." : t;
      }
    }
    return `(${entry.message.role})`;
  }
  if (entry.type === "branch_summary") return "Branch summary";
  if (entry.type === "compaction") return "Compaction";
  return entry.type;
}

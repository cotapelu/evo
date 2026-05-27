#!/usr/bin/env node

import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { matchesKey, Text } from "@earendil-works/pi-tui";
import { Mutex } from "../utils/mutex.js";
import type {
  Memory,
  MemoryParams,
  MemoryToolDetails,
  MemoryAddParams,
  MemoryGetParams,
  MemoryDeleteParams,
  MemorySearchParams
} from "../utils/tool-types.js";

// Per-session state holder
interface MemorySessionState {
  memories: Memory[];
  nextId: number;
  mutex: Mutex;
}

// WeakMap to associate state with context; auto GC when context disposed
const sessionStates = new WeakMap<ExtensionContext, MemorySessionState>();

function getSessionState(ctx: ExtensionContext): MemorySessionState {
  let state = sessionStates.get(ctx);
  if (!state) {
    const mutex = new Mutex();
    state = { memories: [], nextId: 1, mutex };
    sessionStates.set(ctx, state);
  }
  return state;
}

class MemoryListComponent {
  private memories: Memory[];
  private theme: Theme;
  private onClose: () => void;
  private cachedWidth?: number;
  private cachedLines?: string[];

  constructor(memories: Memory[], theme: Theme, onClose: () => void) {
    this.memories = memories;
    this.theme = theme;
    this.onClose = onClose;
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) {
      this.onClose();
    }
  }

  render(width: number): string[] {
    if (this.cachedWidth && this.cachedWidth === width && this.cachedLines) {
      return this.cachedLines;
    }

    const lines: string[] = [];
    const th = this.theme;

    lines.push("");
    lines.push(th.fg("accent", " Memories "));
    lines.push("");

    if (this.memories.length === 0) {
      lines.push(`  ${th.fg("dim", "No memories stored.")}`);
    } else {
      lines.push(`  ${th.fg("muted", `${this.memories.length} memories`)}`);
      lines.push("");
      const maxShow = 50;
      const toShow = this.memories.slice(0, maxShow);
      for (const mem of toShow) {
        const id = th.fg("accent", `#${mem.id}`);
        const preview = mem.text.length > 60 ? mem.text.substring(0, 60) + "..." : mem.text;
        const text = th.fg("text", preview);
        const tags = mem.tags && mem.tags.length > 0 ? th.fg("dim", ` [${mem.tags.join(", ")}]`) : "";
        lines.push(`  ${id} ${text}${tags}`);
      }
      if (this.memories.length > maxShow) {
        lines.push(`  ${th.fg("dim", `...and ${this.memories.length - maxShow} more.`)}`);
      }
    }

    lines.push("");
    lines.push(`  ${th.fg("dim", "Escape=Close")}`);
    lines.push("");

    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}

export function registerMemoryTool(api: ExtensionAPI): void {
  const reconstructState = async (ctx: ExtensionContext) => {
    const state = getSessionState(ctx);
    const release = await state.mutex.lock();
    try {
      state.memories = [];
      state.nextId = 1;
      for (const entry of ctx.sessionManager.getBranch()) {
        if (entry.type === "message" && entry.message.role === "toolResult" && entry.message.toolName === "memory") {
          const details = (entry.message.details as any);
          if (details && Array.isArray(details.memories)) {
            state.memories = details.memories;
            state.nextId = details.nextId;
          }
        }
      }
    } finally {
      release();
    }
  };

  api.on("session_start", async (_event, ctx) => { await reconstructState(ctx); });
  api.on("session_tree", async (_event, ctx) => { await reconstructState(ctx); });

  const tool: any = {
    name: "memory",
    label: "Memory",
    description: "Store and retrieve arbitrary text snippets with optional tags. Actions: add, list, get, delete, clear, search",
    promptSnippet: "Proactively store important facts, decisions, code snippets, URLs with tags. Memories persist across sessions and help track project history.",
    promptGuidelines: [
      "Add: memory({ action: 'add', text: 'Important fact', tags?: ['tag1', 'tag2'] })",
      "List: memory({ action: 'list' })",
      "Get: memory({ action: 'get', id: <number> })",
      "Delete: memory({ action: 'delete', id: <number> })",
      "Clear: memory({ action: 'clear' })",
      "Search: memory({ action: 'search', query: 'text' })",
      "Memories persist in session and support branching.",
      "If the user says 'remember this', 'save this', 'note that', or provides important information (facts, decisions, code snippets, URLs, deadlines), proactively use the memory tool with action 'add' to store it.",
      "Include relevant tags: e.g., ['project', 'code'], ['meeting'], ['decision'], ['research']",
      "Use memory.search to retrieve stored information when the user asks 'what did we say about X', 'do you remember', or references past info.",
      "Prefer storing concise, factual statements rather than long conversational exchanges.",
      "When uncertain if something should be remembered, ask the user: 'Should I save this to memory?'",
    ],
    parameters: {},

    /**
     * Execute memory operation.
     *
     * @param toolCallId - Unique identifier for this tool call
     * @param params - Action parameters (MemoryParams) or JSON string
     * @param _signal - Optional abort signal
     * @param _onUpdate - Optional update callback
     * @param ctx - Extension context
     * @returns Promise resolving to tool result
     */
    async execute(
      toolCallId: string,
      params: MemoryParams | string,
      _signal: AbortSignal | undefined,
      _onUpdate: (update: any) => void | undefined,
      ctx: ExtensionContext
    ) {
      const state = getSessionState(ctx);
      const release = await state.mutex.lock();
      try {
        // Parse and validate parameters
        let p: MemoryParams;
        if (typeof params === "string") {
          try {
            p = JSON.parse(params) as MemoryParams;
          } catch (e: any) {
            return { content: [{ type: "text", text: `Error: Invalid JSON - ${e.message}` }], details: { action: "unknown", memories: [...state.memories], nextId: state.nextId, error: "Invalid JSON" }, isError: false };
          }
        } else {
          p = params as MemoryParams;
        }

        const action = p.action;
        switch (p.action) {
          case "add": {
            const addParams = p as MemoryAddParams;
            const text = addParams.text;
            if (!text) {
              return { content: [{ type: "text", text: "Error: text required for add" }], details: { action, memories: [...state.memories], nextId: state.nextId, error: "text required" }, isError: false };
            }
            const mem: Memory = {
              id: state.nextId++,
              text,
              tags: addParams.tags,
              created: Date.now(),
            };
            state.memories.push(mem);
            api.appendEntry("memory", mem);
            return { content: [{ type: "text", text: `Stored memory #${mem.id}` }], details: { action, memories: [...state.memories], nextId: state.nextId }, isError: false };
          }

          case "list": {
            const details = { action, memories: [...state.memories], nextId: state.nextId };
            if (state.memories.length === 0) {
              return { content: [{ type: "text", text: "No memories stored." }], details, isError: false };
            }
            const lines = state.memories.map(m => `#${m.id}: ${m.text.length > 80 ? m.text.substring(0, 80) + "..." : m.text}${m.tags ? ` [${m.tags.join(", ")}]` : ""}`);
            return { content: [{ type: "text", text: lines.join("\n") }], details, isError: false };
          }

          case "get": {
            const getParams = p as MemoryGetParams;
            const id = getParams.id;
            if (typeof id === 'undefined') {
              return { content: [{ type: "text", text: "Error: id required for get" }], details: { action, memories: [...state.memories], nextId: state.nextId, error: "id required" }, isError: false };
            }

            const mem = state.memories.find(m => m.id === id);
            if (!mem) {
              return { content: [{ type: "text", text: `Memory #${id} not found` }], details: { action, memories: [...state.memories], nextId: state.nextId, targetId: id, error: `#${id} not found` }, isError: false };
            }
            return { content: [{ type: "text", text: mem.text }], details: { action, memories: [...state.memories], nextId: state.nextId, targetId: id }, isError: false };
          }

          case "delete": {
            const delParams = p as MemoryDeleteParams;
            const id = delParams.id;
            if (typeof id === 'undefined') {
              return { content: [{ type: "text", text: "Error: id required for delete" }], details: { action, memories: [...state.memories], nextId: state.nextId, error: "id required" }, isError: false };
            }

            const index = state.memories.findIndex(m => m.id === id);
            if (index === -1) {
              return { content: [{ type: "text", text: `Memory #${id} not found` }], details: { action, memories: [...state.memories], nextId: state.nextId, targetId: id, error: `#${id} not found` }, isError: false };
            }
            const deleted = state.memories.splice(index, 1)[0];
            api.appendEntry("memory", { ...deleted, _deleted: true });
            return { content: [{ type: "text", text: `Deleted memory #${id}` }], details: { action, memories: [...state.memories], nextId: state.nextId, targetId: id }, isError: false };
          }

          case "clear": {
            const count = state.memories.length;
            for (const mem of state.memories) {
              api.appendEntry("memory", { ...mem, _deleted: true });
            }
            state.memories = [];
            state.nextId = 1;
            return { content: [{ type: "text", text: `Cleared ${count} memories` }], details: { action, memories: [], nextId: 1 }, isError: false };
          }

          case "search": {
            const searchParams = p as MemorySearchParams;
            const query = searchParams.query;
            if (!query) {
              return { content: [{ type: "text", text: "Error: query required for search" }], details: { action, memories: [...state.memories], nextId: state.nextId, error: "query required" }, isError: false };
            }
            const q = query.toLowerCase();
            const results = state.memories.filter(m => m.text.toLowerCase().includes(q) || (m.tags?.some(t => t.toLowerCase().includes(q))));
            const lines = results.map(m => `#${m.id}: ${m.text}${m.tags ? ` [${m.tags.join(", ")}]` : ""}`);
            const summary = `Found ${results.length} of ${state.memories.length} memories:\n` + lines.join("\n");
            return { content: [{ type: "text", text: summary }], details: { action: "search", memories: results, nextId: state.nextId }, isError: false };
          }

          default: {
            return { content: [{ type: "text", text: `Unknown action: ${action}` }], details: { action: "list", memories: [...state.memories], nextId: state.nextId }, isError: false };
          }
        }
      } finally {
        release();
      }
    },

    renderCall(args: any, theme: any, _context: any) {
      const th = theme;
      let text = th.fg("toolTitle", th.bold("memory ")) + th.fg("muted", args.action);
      if (args.text) text += ` ${th.fg("dim", `"${args.text.substring(0, 30)}${args.text.length > 30 ? "..." : ""}"`)}`;
      if (args.id !== undefined) text += ` ${th.fg("accent", `#${args.id}`)}`;
      if (args.tags) text += ` ${th.fg("warning", `[${args.tags.length} tags]`)}`;
      return new Text(text, 0, 0);
    },

    renderResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: any, _context: any) {
      const th = theme;
      const details = result.details as any;

      if (options.isPartial) {
        return new Text(th.fg("warning", "Processing..."), 0, 0);
      }

      if (details && details.error) {
        return new Text(th.fg("error", `Error: ${details.error}`), 0, 0);
      }

      const { action, memories, targetId } = details || {};

      switch (action) {
        case "add": {
          const added = memories && memories[memories.length - 1];
          return new Text(th.fg("success", "✓ Stored ") + th.fg("accent", `#${added?.id}`), 0, 0);
        }
        case "list": {
          const count = memories?.length || 0;
          if (count === 0) return new Text(th.fg("dim", "No memories"), 0, 0);
          return new Text(th.fg("success", `✓ ${count} memories`), 0, 0);
        }
        case "get":
        case "delete":
        case "clear":
        case "search": {
          return new Text(th.fg("success", `✓ ${action}`), 0, 0);
        }
        default:
          return new Text(th.fg("muted", result.content?.[0]?.text || ""), 0, 0);
      }
    },
  };

  api.registerTool(tool);
}

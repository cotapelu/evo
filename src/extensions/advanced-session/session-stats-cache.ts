#!/usr/bin/env node

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export interface CachedSessionStats {
  sessionId: string;
  messageCount: number;
  turnCount: number;
  compactionCount: number;
  branchCount: number;
  lastActivity: Date;
  lastEvent: string;
  totalEntries: number;
}

const contextCaches = new WeakMap<ExtensionContext, CachedSessionStats>();

function updateFromEntries(cache: CachedSessionStats, entries: any[]) {
  cache.messageCount = entries.filter(e => e.type === 'message').length;
  cache.turnCount = entries.filter(e => e.type === 'message' && e.message?.role === 'assistant').length;
  cache.compactionCount = entries.filter(e => e.type === 'compaction').length;
  cache.branchCount = entries.filter(e => e.type === 'branch_summary').length;
  cache.totalEntries = entries.length;
  cache.lastActivity = new Date();
}

export function installSessionStatsCache(api: ExtensionAPI): void {
  // Listen for session_start to initialize cache for each session
  api.on("session_start", async (event, ctx) => {
    const cache: CachedSessionStats = {
      sessionId: ctx.sessionManager.getSessionId() ?? "unknown",
      messageCount: 0,
      turnCount: 0,
      compactionCount: 0,
      branchCount: 0,
      lastActivity: new Date(),
      lastEvent: "session_start",
      totalEntries: 0,
    };
    contextCaches.set(ctx, cache);

    // Initial calculation from current entries
    try {
      const entries = ctx.sessionManager.getEntries();
      updateFromEntries(cache, entries);
    } catch (e) {
      // ignore - may not have entries yet
    }
  });

  // session_tree: tree structure changed (branch, navigate)
  api.on("session_tree", async (event, ctx) => {
    const cache = contextCaches.get(ctx);
    if (cache) {
      try {
        const entries = ctx.sessionManager.getEntries();
        updateFromEntries(cache, entries);
        cache.lastEvent = "session_tree";
      } catch (e) {}
    }
  });

  // turn_end: a turn finished (assistant message added)
  api.on("turn_end", async (event, ctx) => {
    const cache = contextCaches.get(ctx);
    if (cache) {
      try {
        const entries = ctx.sessionManager.getEntries();
        updateFromEntries(cache, entries);
        cache.lastEvent = "turn_end";
      } catch (e) {}
    }
  });

  // session_compact: compaction performed
  api.on("session_compact", async (event, ctx) => {
    const cache = contextCaches.get(ctx);
    if (cache) {
      cache.compactionCount++;
      cache.lastEvent = "session_compact";
      cache.lastActivity = new Date();
    }
  });

  // agent_end: agent loop finished
  api.on("agent_end", async (event, ctx) => {
    const cache = contextCaches.get(ctx);
    if (cache) {
      try {
        const entries = ctx.sessionManager.getEntries();
        updateFromEntries(cache, entries);
        cache.lastEvent = "agent_end";
      } catch (e) {}
    }
  });
}

export function getCacheForContext(ctx: ExtensionContext): CachedSessionStats | null {
  return contextCaches.get(ctx) ?? null;
}

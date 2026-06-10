#!/usr/bin/env node
/**
 * Compaction Hook
 *
 * Listens to session_before_compact to customize compaction summaries.
 * Demonstrates: api.on("session_before_compact", handler)
 */
export function registerCompactionHook(api) {
    api.on("session_before_compact", async (event, ctx) => {
        // event has: preparation, branchEntries, customInstructions?, signal
        const branchEntries = event.branchEntries;
        const preparation = event.preparation;
        // Log for debugging
        console.log(`[AdvancedSession] Compaction requested for ${branchEntries.length} entries`);
        // Could modify event.customInstructions here if needed
        // For now, just observe
    });
    // Could also listen to session_compact to track counts
    api.on("session_compact", async (event, ctx) => {
        console.log(`[AdvancedSession] Compaction performed: ${event.compactionEntry.summary?.substring(0, 50)}...`);
    });
}
//# sourceMappingURL=compaction-hook.js.map
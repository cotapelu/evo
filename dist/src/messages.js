/**
 * Message factory functions for Evo Agent
 * Creates specialized message types for interactive mode.
 */
/**
 * Create a compaction summary message.
 * Note: timestamp should be numeric (ms since epoch) per pi-coding-agent types.
 */
export function createCompactionSummaryMessage(summary, tokensBefore, timestamp) {
    // Use type assertion after constructing to satisfy type checker
    const msg = {
        role: 'compactionSummary',
        type: 'compaction_summary',
        summary,
        tokensBefore,
        timestamp,
    };
    return msg;
}
/**
 * Create a branch summary message.
 */
export function createBranchSummaryMessage(summary, entryId, timestamp, fromId) {
    const msg = {
        role: 'branchSummary',
        type: 'branch_summary',
        summary,
        entryId,
        timestamp,
        ...(fromId && { fromId }),
    };
    return msg;
}
//# sourceMappingURL=messages.js.map
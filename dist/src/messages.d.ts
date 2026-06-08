/**
 * Message factory functions for Evo Agent
 * Creates specialized message types for interactive mode.
 */
import type { AgentMessage } from '@earendil-works/pi-agent-core';
/**
 * Create a compaction summary message.
 * Note: timestamp should be numeric (ms since epoch) per pi-coding-agent types.
 */
export declare function createCompactionSummaryMessage(summary: string, tokensBefore: number, timestamp: number): AgentMessage;
/**
 * Create a branch summary message.
 */
export declare function createBranchSummaryMessage(summary: string, entryId: string, timestamp: number, fromId?: string): AgentMessage;
//# sourceMappingURL=messages.d.ts.map
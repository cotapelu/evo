/**
 * Message factory functions for Evo Agent
 * Creates specialized message types for interactive mode.
 */

import type { AgentMessage } from '@earendil-works/pi-agent-core';

/**
 * Create a compaction summary message.
 * Note: timestamp should be numeric (ms since epoch) per pi-coding-agent types.
 */
export function createCompactionSummaryMessage(
	summary: string,
	tokensBefore: number,
	timestamp: number
): AgentMessage {
	// Use type assertion after constructing to satisfy type checker
	const msg = {
		role: 'compactionSummary' as const,
		type: 'compaction_summary' as const,
		summary,
		tokensBefore,
		timestamp,
	};
	return msg as AgentMessage;
}

/**
 * Create a branch summary message.
 */
export function createBranchSummaryMessage(
	summary: string,
	entryId: string,
	timestamp: number,
	fromId?: string
): AgentMessage {
	const msg = {
		role: 'branchSummary' as const,
		type: 'branch_summary' as const,
		summary,
		entryId,
		timestamp,
		...(fromId && { fromId }),
	};
	return msg as AgentMessage;
}

#!/usr/bin/env node
/**
 * Shared utilities for session introspection
 *
 * - getMessagePreview(): extract text preview from message entry
 * - buildSimpleTree(): generate ASCII tree from branch
 * - formatStats(): format session statistics
 */
export declare function getMessagePreview(entry: any, maxLen?: number): string;
export interface SimpleTreeNode {
    entry: any;
    depth: number;
    children: SimpleTreeNode[];
}
export declare function buildSimpleTree(branch: any[], headId: string, maxDepth?: number): SimpleTreeNode[];
export declare function renderTree(nodes: SimpleTreeNode[], options?: {
    showMarker: boolean;
}): string[];
export declare function formatStats(stats: {
    totalEntries: number;
    messages: number;
    compactions: number;
    branches: number;
    leafId: string | null;
    lastActivity: Date;
    lastEvent: string;
}): string[];
//# sourceMappingURL=session-utils.d.ts.map
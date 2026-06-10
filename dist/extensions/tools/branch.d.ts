#!/usr/bin/env node
/**
 * Session Branch Explorer Tool
 *
 * Read-only inspection of the session tree structure.
 * Actions:
 * - list_leaves: list all leaf entries (branch endpoints)
 * - list_labels: list all label entries
 * - get_entry: fetch a specific entry by ID
 * - get_leaf: fetch the current leaf entry
 * - get_branch: get the path from an entry to root (defaults to current leaf)
 * - get_tree: get the full session tree structure
 *
 * All data is returned in details; content provides a short summary.
 */
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
export declare function registerBranchTool(api: ExtensionAPI): void;
//# sourceMappingURL=branch.d.ts.map
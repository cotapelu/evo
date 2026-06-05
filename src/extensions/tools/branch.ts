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
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';

function createBranchTool(): ToolDefinition<any, any> {
  return {
    name: 'branch',
    label: 'Session Branch',
    description: 'Read-only session tree inspection: list_leaves (endpoints), list_labels (bookmarks), get_entry (by ID), get_leaf (current position), get_branch (path to root), get_tree (full structure).',
    parameters: {},
    async execute(toolCallId, params, _signal, _onUpdate, ctx) {
      // Normalize parameters: accept JSON string or object
      let p: any;
      if (typeof params === 'string') {
        try {
          p = JSON.parse(params);
        } catch (e) {
          const msg = `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`;
          return {
            content: [{ type: 'text', text: `Error: ${msg}` }],
            details: { error: msg },
            isError: true,
          };
        }
      } else {
        p = params;
      }

      if (!p || typeof p !== 'object') {
        const msg = 'Parameters must be an object';
        return { content: [{ type: 'text', text: `Error: ${msg}` }], details: { error: msg }, isError: true };
      }

      const action = p.action;
      if (typeof action !== 'string') {
        const msg = 'Missing action';
        return { content: [{ type: 'text', text: `Error: ${msg}` }], details: { error: msg }, isError: true };
      }

      const allowed: string[] = ['list_leaves', 'list_labels', 'get_entry', 'get_leaf', 'get_branch', 'get_tree'];
      if (!allowed.includes(action)) {
        const msg = `Invalid action "${action}". Allowed: ${allowed.join(', ')}`;
        return { content: [{ type: 'text', text: `Error: ${msg}` }], details: { error: msg }, isError: true };
      }

      // SessionManager is read-only in ExtensionContext
      const sm = ctx.sessionManager;

      try {
        switch (action) {
          case 'list_leaves': {
            const entries = sm.getEntries?.() ?? [];
            // A leaf is an entry that is not a parent of any other entry
            const childIds = new Set(entries.map(e => e.parentId).filter((id): id is string => id !== null));
            const leaves = entries.filter(e => !childIds.has(e.id));
            const leafData = leaves.map(e => ({
              id: e.id,
              label: sm.getLabel?.(e.id),
              timestamp: e.timestamp,
              type: e.type,
            }));
            return {
              content: [{ type: 'text', text: `Found ${leaves.length} leaf${leaves.length === 1 ? '' : 'es'}` }],
              details: { leaves: leafData },
              isError: false,
            };
          }

          case 'list_labels': {
            const entries = sm.getEntries?.() ?? [];
            const labelEntries = entries.filter(e => e.type === 'label');
            const labelData = labelEntries.map(e => ({
              entry_id: e.id,
              target_id: e.targetId,
              label: e.label,
              timestamp: e.timestamp,
            }));
            return {
              content: [{ type: 'text', text: `Found ${labelData.length} label${labelData.length === 1 ? '' : 's'}` }],
              details: { labels: labelData },
              isError: false,
            };
          }

          case 'get_entry': {
            const entryId = p.entry_id;
            if (!entryId) {
              const msg = 'entry_id required for get_entry';
              return { content: [{ type: 'text', text: `Error: ${msg}` }], details: { error: msg }, isError: true };
            }
            const entry = sm.getEntry?.(entryId);
            if (!entry) {
              const msg = `Entry not found: ${entryId}`;
              return { content: [{ type: 'text', text: `Error: ${msg}` }], details: { error: msg }, isError: true };
            }
            return {
              content: [{ type: 'text', text: `Retrieved entry ${entryId}` }],
              details: { entry },
              isError: false,
            };
          }

          case 'get_leaf': {
            const leafId = sm.getLeafId?.();
            if (!leafId) {
              const msg = 'No leaf (empty session)';
              return { content: [{ type: 'text', text: `Error: ${msg}` }], details: { error: msg }, isError: true };
            }
            const leaf = sm.getLeafEntry?.();
            if (!leaf) {
              const msg = `Leaf entry not found for id ${leafId}`;
              return { content: [{ type: 'text', text: `Error: ${msg}` }], details: { error: msg }, isError: true };
            }
            return {
              content: [{ type: 'text', text: `Current leaf: ${leafId}` }],
              details: { leaf },
              isError: false,
            };
          }

          case 'get_branch': {
            let fromId = p.entry_id;
            if (!fromId) {
              fromId = sm.getLeafId?.();
              if (!fromId) {
                const msg = 'No leaf to get branch from';
                return { content: [{ type: 'text', text: `Error: ${msg}` }], details: { error: msg }, isError: true };
              }
            }
            const branch = sm.getBranch?.(fromId);
            return {
              content: [{ type: 'text', text: `Branch from ${fromId}: ${branch.length} entries` }],
              details: { branch },
              isError: false,
            };
          }

          case 'get_tree': {
            const tree = sm.getTree?.() ?? [];
            return {
              content: [{ type: 'text', text: `Session tree: ${tree.length} root node${tree.length === 1 ? '' : 's'}` }],
              details: { tree },
              isError: false,
            };
          }

          default: {
            // Should be unreachable due to earlier validation
            const msg = `Unhandled action: ${action}`;
            return { content: [{ type: 'text', text: `Error: ${msg}` }], details: { error: msg }, isError: true };
          }
        }
      } catch (e: any) {
        const msg = e.message ?? String(e);
        return {
          content: [{ type: 'text', text: `Error: ${msg}` }],
          details: { error: msg },
          isError: true,
        };
      }
    },
  };
}

export function registerBranchTool(api: ExtensionAPI): void {
  api.registerTool(createBranchTool());
}

#!/usr/bin/env node

/**
 * Shared utilities for session introspection
 *
 * - getMessagePreview(): extract text preview from message entry
 * - buildSimpleTree(): generate ASCII tree from branch
 * - formatStats(): format session statistics
 */

export function getMessagePreview(entry: any, maxLen: number = 30): string {
  if (entry.type === "message" && entry.message?.content) {
    const content: any[] = entry.message.content;
    for (const part of content) {
      if (part.type === "text") {
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

export interface SimpleTreeNode {
  entry: any;
  depth: number;
  children: SimpleTreeNode[];
}

export function buildSimpleTree(branch: any[], headId: string, maxDepth: number = 15): SimpleTreeNode[] {
  const visited = new Set<string>();
  const nodes: SimpleTreeNode[] = [];

  function walk(entry: any, depth: number): void {
    if (depth >= maxDepth || visited.has(entry.id)) return;
    visited.add(entry.id);
    const node: SimpleTreeNode = { entry, depth, children: [] };
    nodes.push(node);
    const children = branch.filter((e: any) => e.parentId === entry.id);
    for (const child of children) {
      walk(child, depth + 1);
      // Find and link child node (the child will be added to nodes array)
      const childNode = nodes.find(n => n.entry.id === child.id);
      if (childNode) node.children.push(childNode);
    }
  }

  const root = branch.find((e: any) => !e.parentId || !branch.some((c: any) => c.id === e.parentId)) || branch[0];
  if (root) walk(root, 0);
  return nodes;
}

export function renderTree(nodes: SimpleTreeNode[], options: { showMarker: boolean } = { showMarker: true }): string[] {
  const lines: string[] = [];
  const markerMap: Record<string, string> = {
    user: "👤",
    assistant: "🤖",
    branch_summary: "⛓️",
    compaction: "📦",
  };

  for (const node of nodes) {
    const indent = "  ".repeat(node.depth);
    const entry = node.entry;
    let marker = "📄";
    if (options.showMarker) {
      const role = entry.message?.role;
      if (role) marker = markerMap[role] || marker;
      else if (entry.type === "branch_summary") marker = markerMap.branch_summary;
      else if (entry.type === "compaction") marker = markerMap.compaction;
    }
    const preview = getMessagePreview(entry, 30);
    lines.push(`${indent}${marker} ${preview}`);
  }

  return lines;
}

export function formatStats(stats: {
  totalEntries: number;
  messages: number;
  compactions: number;
  branches: number;
  leafId: string | null;
  lastActivity: Date;
  lastEvent: string;
}): string[] {
  return [
    `Entries: ${stats.totalEntries}`,
    `Messages: ${stats.messages}`,
    `Compactions: ${stats.compactions}`,
    `Branches: ${stats.branches}`,
    `Leaf: ${stats.leafId ?? 'none'}`,
    `Last: ${stats.lastActivity.toLocaleTimeString()} (${stats.lastEvent})`,
  ];
}

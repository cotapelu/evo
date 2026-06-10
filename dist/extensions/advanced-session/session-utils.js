#!/usr/bin/env node
/**
 * Shared utilities for session introspection
 *
 * - getMessagePreview(): extract text preview from message entry
 * - buildSimpleTree(): generate ASCII tree from branch
 * - formatStats(): format session statistics
 */
export function getMessagePreview(entry, maxLen = 30) {
    if (entry.type === "message" && entry.message?.content) {
        const content = entry.message.content;
        for (const part of content) {
            if (part.type === "text") {
                const t = String(part.text ?? "").trim().replace(/\n/g, " ");
                return t.length > maxLen ? t.slice(0, maxLen) + "..." : t;
            }
        }
        return `(${entry.message.role})`;
    }
    if (entry.type === "branch_summary")
        return "Branch summary";
    if (entry.type === "compaction")
        return "Compaction";
    return entry.type;
}
export function buildSimpleTree(branch, headId, maxDepth = 15) {
    const visited = new Set();
    const nodes = [];
    function walk(entry, depth) {
        if (depth >= maxDepth || visited.has(entry.id))
            return;
        visited.add(entry.id);
        const node = { entry, depth, children: [] };
        nodes.push(node);
        const children = branch.filter((e) => e.parentId === entry.id);
        for (const child of children) {
            walk(child, depth + 1);
            // Find and link child node (the child will be added to nodes array)
            const childNode = nodes.find(n => n.entry.id === child.id);
            if (childNode)
                node.children.push(childNode);
        }
    }
    const root = branch.find((e) => !e.parentId || !branch.some((c) => c.id === e.parentId)) || branch[0];
    if (root)
        walk(root, 0);
    return nodes;
}
export function renderTree(nodes, options = { showMarker: true }) {
    const lines = [];
    const markerMap = {
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
            if (role)
                marker = markerMap[role] || marker;
            else if (entry.type === "branch_summary")
                marker = markerMap.branch_summary;
            else if (entry.type === "compaction")
                marker = markerMap.compaction;
        }
        const preview = getMessagePreview(entry, 30);
        lines.push(`${indent}${marker} ${preview}`);
    }
    return lines;
}
export function formatStats(stats) {
    return [
        `Entries: ${stats.totalEntries}`,
        `Messages: ${stats.messages}`,
        `Compactions: ${stats.compactions}`,
        `Branches: ${stats.branches}`,
        `Leaf: ${stats.leafId ?? 'none'}`,
        `Last: ${stats.lastActivity.toLocaleTimeString()} (${stats.lastEvent})`,
    ];
}
//# sourceMappingURL=session-utils.js.map
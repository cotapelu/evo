#!/usr/bin/env node
/**
 * Session Tree Command
 *
 * Provides an interactive UI to navigate the session tree.
 */
import { DynamicBorder, TreeSelectorComponent } from "@earendil-works/pi-coding-agent";
import { Container, Text, Spacer } from "@earendil-works/pi-tui";
import { addSectionHeader } from "../utils/widget-helpers.js";
// Helper functions for rendering entry details (extracted to reduce function size)
function renderMessageDetails(e) {
    const msgEntry = e;
    const msg = msgEntry.message;
    const lines = [];
    lines.push('\n--- Message ---');
    lines.push(`Role: ${msg.role}`);
    if ('content' in msg && msg.content) {
        const content = msg.content;
        if (Array.isArray(content)) {
            for (const c of content) {
                if (c.type === 'text') {
                    lines.push(`Text: ${c.text?.substring(0, 200) || ''}${c.text && c.text.length > 200 ? '...' : ''}`);
                }
                else if (c.type === 'image') {
                    lines.push(`[Image: ${c.source?.mediaType || 'unknown'}]`);
                }
            }
        }
    }
    return lines;
}
function renderBranchSummaryDetails(e) {
    const bs = e;
    const lines = [];
    lines.push('\n--- Branch Summary ---');
    lines.push(`From: ${bs.fromId}`);
    if (bs.summary) {
        lines.push(`Summary: ${bs.summary.substring(0, 200)}${bs.summary.length > 200 ? '...' : ''}`);
    }
    return lines;
}
function renderCompactionDetails(e) {
    const comp = e;
    const lines = [];
    lines.push('\n--- Compaction Summary ---');
    lines.push(`Tokens before: ${comp.tokensBefore ?? 'N/A'}`);
    lines.push(`First kept: ${comp.firstKeptEntryId ?? 'none'}`);
    if (comp.summary) {
        const summaryPreview = comp.summary.length > 200 ? comp.summary.substring(0, 200) + '...' : comp.summary;
        lines.push(`Summary: ${summaryPreview}`);
    }
    return lines;
}
function renderCustomMessageDetails(e) {
    const cm = e;
    const lines = [];
    lines.push('\n--- Custom Message ---');
    lines.push(`Custom type: ${cm.customType}`);
    lines.push(`Display: ${cm.display}`);
    if (typeof cm.content === 'string') {
        lines.push(`Content: ${cm.content.substring(0, 200)}${cm.content.length > 200 ? '...' : ''}`);
    }
    return lines;
}
function renderLabelDetails(e) {
    const label = e;
    const lines = [];
    lines.push('\n--- Label ---');
    lines.push(`Target: ${label.targetId}`);
    lines.push(`Label: ${label.label ?? "<empty>"}`);
    return lines;
}
function renderDetailsForType(entry) {
    const type = entry.type;
    switch (type) {
        case 'message': return renderMessageDetails(entry);
        case 'branch_summary': return renderBranchSummaryDetails(entry);
        case 'compaction': return renderCompactionDetails(entry);
        case 'custom_message': return renderCustomMessageDetails(entry);
        case 'label': return renderLabelDetails(entry);
        default: return [`Unknown entry type: ${type}`];
    }
}
export class EntryDetailView {
    entry;
    cachedLines = [];
    cachedWidth;
    constructor(entry) {
        this.entry = entry;
    }
    setEntry(entry) {
        this.entry = entry;
        this.cachedWidth = undefined;
    }
    render(width) {
        if (this.cachedLines && this.cachedWidth === width) {
            return this.cachedLines;
        }
        const e = this.entry;
        const common = [
            `Entry ID: ${e.id}`,
            `Parent ID: ${e.parentId ?? "<root>"}`,
            `Type: ${e.type}`,
            `Timestamp: ${new Date(e.timestamp).toLocaleString()}`,
        ];
        const specific = renderDetailsForType(e);
        const lines = [...common, ...specific];
        // Wrap lines to width
        const wrapped = [];
        for (const line of lines) {
            if (line.length <= width) {
                wrapped.push(line);
            }
            else {
                for (let i = 0; i < line.length; i += width) {
                    wrapped.push(line.substring(i, i + width));
                }
            }
        }
        this.cachedLines = wrapped;
        this.cachedWidth = width;
        return wrapped;
    }
    invalidate() {
        this.cachedWidth = undefined;
        this.cachedLines = [];
    }
}
export function registerSessionTreeCommand(api) {
    api.registerCommand("tree", {
        description: "Show session tree browser - navigate branches and view entries",
        handler: async (_args, ctx) => {
            const sessionManager = ctx.sessionManager;
            if (!sessionManager) {
                ctx.ui.notify("Session manager not available", "error");
                return;
            }
            if (!ctx.hasUI) {
                ctx.ui.notify("/tree requires TUI mode", "error");
                return;
            }
            const tree = sessionManager.getTree();
            const currentLeaf = sessionManager.getLeafId();
            const termRows = process.stdout.rows || 24;
            const termCols = process.stdout.columns || 80;
            const maxVisible = Math.max(10, termRows - 20);
            const result = await ctx.ui.custom((tui, theme, _keybindings, done) => {
                const container = new Container();
                const borderColor = (s) => theme.fg("accent", s);
                container.addChild(new DynamicBorder(borderColor));
                addSectionHeader(container, theme, "📊 Session Tree");
                // TreeSelectorComponent: constructor(tree, currentLeaf, maxVisible, initialSelectedId, filterMode, onSelect, onCancel, onLabelChange?)
                const treeList = new TreeSelectorComponent(tree, currentLeaf, maxVisible, (entryId) => done({ entryId }), // onSelect
                () => done(null), // onCancel
                undefined, // onLabelChange
                undefined, // initialSelectedId
                "default" // initialFilterMode
                );
                const detailView = new EntryDetailView({});
                const treeListInternal = treeList.getTreeList?.();
                const initialSelected = treeListInternal?.getSelectedNode?.();
                if (initialSelected) {
                    detailView.setEntry(initialSelected.entry);
                }
                const treeContainer = new Container();
                treeContainer.addChild(treeList);
                container.addChild(treeContainer);
                container.addChild(new Spacer(1));
                container.addChild(new Text(theme.fg("accent", "Entry Details:").bold(), 0, 0));
                container.addChild(new Spacer(1));
                const detailContainer = new Container();
                if (initialSelected) {
                    const lines = detailView.render(termCols - 2);
                    for (const line of lines) {
                        detailContainer.addChild(new Text(line, 0, 0));
                    }
                }
                container.addChild(detailContainer);
                const component = {
                    render(width) {
                        return container.render(width);
                    },
                    invalidate() {
                        container.invalidate();
                        detailView.invalidate();
                    },
                    handleInput(data) {
                        if (treeList.handleInput) {
                            treeList.handleInput(data);
                        }
                        tui.requestRender();
                        const treeListInternal = treeList.getTreeList?.();
                        const selected = treeListInternal?.getSelectedNode?.();
                        if (selected) {
                            detailView.setEntry(selected.entry);
                            detailContainer.clear();
                            const termWidth = process.stdout.columns || 80;
                            const lines = detailView.render(termWidth - 2);
                            for (const line of lines) {
                                detailContainer.addChild(new Text(line, 0, 0));
                            }
                        }
                    },
                };
                container.addChild(new Spacer(1));
                container.addChild(new DynamicBorder(borderColor));
                const helpText = theme.fg("dim", "↑↓ navigate • enter select • esc cancel • / search");
                container.addChild(new Text(helpText, 1, 0));
                return component;
            });
            if (result?.entryId) {
                ctx.ui.notify(`Selected entry: ${result.entryId}`, "info");
            }
            else {
                ctx.ui.notify("Tree view closed", "info");
            }
        },
    });
}
//# sourceMappingURL=session-tree-command.js.map
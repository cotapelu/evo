#!/usr/bin/env node
/**
 * Session Tree Command
 *
 * Provides an interactive UI to navigate the session tree.
 */
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
export declare class EntryDetailView {
    private entry;
    private cachedLines;
    private cachedWidth;
    constructor(entry: SessionEntry);
    setEntry(entry: SessionEntry): void;
    render(width: number): string[];
    invalidate(): void;
}
//# sourceMappingURL=session-tree-command.d.ts.map
/**
 * Shared Workspace for Team Collaboration
 * In-memory key-value store accessible by all team members
 */
export interface WorkspaceEntry {
    value: any;
    owner: string;
    timestamp: number;
}
export declare class SharedWorkspace {
    private data;
    /**
     * Write a key-value pair to workspace
     */
    set(key: string, value: any, owner: string): void;
    /**
     * Read a value from workspace
     */
    get(key: string): any;
    /**
     * Get entry metadata
     */
    getEntry(key: string): WorkspaceEntry | undefined;
    /**
     * List all keys
     */
    list(): string[];
    /**
     * List keys by prefix
     */
    listByPrefix(prefix: string): string[];
    /**
     * Delete a key
     */
    delete(key: string): boolean;
    /**
     * Clear all data
     */
    clear(): void;
    /**
     * Get all entries as plain object
     */
    toObject(): Record<string, any>;
}
//# sourceMappingURL=workspace.d.ts.map
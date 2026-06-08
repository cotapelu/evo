/**
 * Changelog utilities for Evo Agent
 * Parse and filter CHANGELOG.md entries.
 */
/**
 * Get changelog path (from package)
 */
export declare function getChangelogPath(): string;
/**
 * Parse changelog markdown into entries.
 * Returns array of { version, date, content } (simplified)
 */
export declare function parseChangelog(content: string): any[];
/**
 * Get new entries since last version
 */
export declare function getNewEntries(entries: any[], lastVersion: string): any[];
//# sourceMappingURL=changelog.d.ts.map
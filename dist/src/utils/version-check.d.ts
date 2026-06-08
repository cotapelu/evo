/**
 * Version check utilities for Evo Agent
 * Checks for new package versions asynchronously.
 */
/**
 * Check for new version of pi-coding-agent package.
 * Returns new version string if available, otherwise null.
 */
export declare function checkForNewPiVersion(): Promise<string | null>;
/**
 * Check for updates to installed npm packages.
 * Returns array of package names with newer versions available.
 */
export declare function checkForPackageUpdates(): Promise<string[]>;
//# sourceMappingURL=version-check.d.ts.map
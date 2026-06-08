/**
 * Evo Agent Configuration & Constants
 *
 * Centralized app-level constants, paths, and configuration.
 * Inspired by pi-coding-agent pattern (no code copied).
 */
export declare const APP_NAME = "Evo Agent";
export declare const VERSION = "0.0.1";
export declare const APP_TITLE = "Evo";
/**
 * Get the agent directory (XDG_CONFIG_HOME/evo or ~/.evo)
 */
export declare function getAgentDir(): string;
/**
 * Get the auth file path
 */
export declare function getAuthPath(): string;
/**
 * Get the debug log path
 */
export declare function getDebugLogPath(): string;
/**
 * Get the docs path (within package)
 */
export declare function getDocsPath(): string;
/**
 * Get the changelog path (within package)
 */
export declare function getChangelogPath(): string;
/**
 * Get the share viewer URL for a gist ID
 */
export declare function getShareViewerUrl(gistId: string): string;
/**
 * Get the binary directory (for tool downloads)
 */
export declare function getBinDir(): string;
//# sourceMappingURL=config.d.ts.map
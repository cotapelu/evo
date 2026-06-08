/**
 * Git URL parsing utilities for Evo Agent
 * Parse git URLs for source info display.
 */
/**
 * Parse a git URL into its components.
 * Supports: https://, git@, ssh:// formats.
 *
 * Examples:
 *   https://github.com/user/repo.git
 *   git@github.com:user/repo.git
 *   ssh://git@github.com/user/repo.git
 *
 * Returns: { host: string, path: string, ref?: string } | null
 */
export declare function parseGitUrl(url: string): {
    host: string;
    path: string;
    ref?: string;
} | null;
//# sourceMappingURL=git.d.ts.map
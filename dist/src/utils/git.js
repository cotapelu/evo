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
export function parseGitUrl(url) {
    try {
        let host = null;
        let path = null;
        let ref;
        // Format: git@host:path.git or https://host/path.git
        if (url.startsWith('git@')) {
            const match = url.match(/^git@([^:]+):([^#?]+)(?:#(.+))?$/);
            if (!match)
                return null;
            host = match[1];
            path = match[2].replace(/\.git$/, '');
            ref = match[3];
        }
        else if (url.startsWith('ssh://git@')) {
            const match = url.match(/^ssh:\/\/git@([^/]+)\/([^#?]+)(?:#(.+))?$/);
            if (!match)
                return null;
            host = match[1];
            path = match[2].replace(/\.git$/, '');
            ref = match[3];
        }
        else if (url.startsWith('https://') || url.startsWith('http://')) {
            const match = url.match(/^(?:https?|http):\/\/([^/]+)\/([^#?]+)(?:#(.+))?$/);
            if (!match)
                return null;
            host = match[1];
            path = match[2].replace(/\.git$/, '');
            ref = match[3];
        }
        else {
            return null;
        }
        // Normalize host (strip port if present)
        if (host) {
            host = host.split(':')[0];
        }
        if (!host || !path) {
            return null;
        }
        return { host, path, ...(ref && { ref }) };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=git.js.map
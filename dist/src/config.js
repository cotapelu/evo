/**
 * Evo Agent Configuration & Constants
 *
 * Centralized app-level constants, paths, and configuration.
 * Inspired by pi-coding-agent pattern (no code copied).
 */
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
// App metadata
export const APP_NAME = 'Evo Agent';
export const VERSION = '0.0.1';
export const APP_TITLE = 'Evo';
// Determine package root (for finding shared resources)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
/**
 * Get the agent directory (XDG_CONFIG_HOME/evo or ~/.evo)
 */
export function getAgentDir() {
    const xdgConfigHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    return process.env.EVO_AGENT_DIR || path.join(xdgConfigHome, 'evo');
}
/**
 * Get the auth file path
 */
export function getAuthPath() {
    const agentDir = getAgentDir();
    return path.join(agentDir, 'auth.json');
}
/**
 * Get the debug log path
 */
export function getDebugLogPath() {
    const agentDir = getAgentDir();
    return path.join(agentDir, 'debug.log');
}
/**
 * Get the docs path (within package)
 */
export function getDocsPath() {
    return path.join(packageRoot, 'docs');
}
/**
 * Get the changelog path (within package)
 */
export function getChangelogPath() {
    return path.join(packageRoot, 'CHANGELOG.md');
}
/**
 * Get the share viewer URL for a gist ID
 */
export function getShareViewerUrl(gistId) {
    return `https://gist.github.com/${gistId}`;
}
/**
 * Get the binary directory (for tool downloads)
 */
export function getBinDir() {
    const agentDir = getAgentDir();
    return path.join(agentDir, 'bin');
}
//# sourceMappingURL=config.js.map
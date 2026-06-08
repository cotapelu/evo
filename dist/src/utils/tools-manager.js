/**
 * Tools Manager for Evo Agent
 * Ensures required CLI tools are available, downloads if missing.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getBinDir } from '../config.js';
// Tool definitions (expand as needed)
const TOOLS = {
    fd: {
        name: 'fd',
        version: '10.2.0', // Adjust as needed
    },
    rg: {
        name: 'rg',
        version: '14.0.0',
    },
    gh: {
        name: 'gh',
        version: 'latest',
    },
};
/**
 * Check if a tool exists in PATH.
 */
function isToolAvailable(name) {
    try {
        // On Windows, use where; on Unix, use which
        const cmd = process.platform === 'win32' ? 'where' : 'which';
        const result = spawnSync(cmd, [name], { encoding: 'utf8' });
        return result.status === 0 && result.stdout?.trim().length > 0;
    }
    catch {
        return false;
    }
}
/**
 * Get the path to a tool, ensuring it's available.
 * Downloads to bin dir if missing (basic implementation; expand as needed).
 */
export async function ensureTool(name) {
    // Check if tool is in PATH
    if (isToolAvailable(name)) {
        return name;
    }
    // Check if tool exists in bin dir
    const binDir = getBinDir();
    const toolPath = path.join(binDir, process.platform === 'win32' ? `${name}.exe` : name);
    if (fs.existsSync(toolPath)) {
        // Add bin dir to PATH for this process if not already
        if (!process.env.PATH?.includes(binDir)) {
            process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH}`;
        }
        return name;
    }
    // Download tool (basic implementation - prompts user to install)
    // In production, you'd download predefined binaries.
    throw new Error(`Tool '${name}' not found. Please install it manually:\n` +
        `  - fd: https://github.com/sharkdp/fd\n` +
        `  - rg: https://github.com/BurntSushi/ripgrep\n` +
        `  - gh: https://cli.github.com/`);
}
/**
 * Check if a tool is installed (non-throwing).
 */
export function checkToolInstalled(name) {
    try {
        const result = spawnSync(name, ['--version'], { encoding: 'utf8' });
        return result.status === 0;
    }
    catch {
        return false;
    }
}
/**
 * Get version of a tool (if available).
 */
export function getToolVersion(name) {
    try {
        const result = spawnSync(name, ['--version'], { encoding: 'utf8' });
        if (result.status === 0) {
            return result.stdout?.split('\n')[0]?.trim() ?? null;
        }
    }
    catch {
        // ignore
    }
    return null;
}
//# sourceMappingURL=tools-manager.js.map
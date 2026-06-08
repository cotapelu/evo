/**
 * Shell utilities for Evo Agent
 * Process management, signal handling, and shell operations.
 */
import { spawn } from 'node:child_process';
import * as os from 'node:os';
// Track detached child processes so they can be killed on shutdown
const detachedProcesses = new Set();
/**
 * Track a detached child process for cleanup on shutdown.
 */
export function trackDetachedChild(proc) {
    detachedProcesses.add(proc);
    proc.on('exit', () => {
        detachedProcesses.delete(proc);
    });
}
/**
 * Kill all tracked detached child processes.
 * Called during shutdown to prevent orphaned processes.
 */
export function killTrackedDetachedChildren() {
    for (const proc of detachedProcesses) {
        try {
            // Try graceful termination first
            proc.kill('SIGTERM');
        }
        catch {
            // ignore
        }
    }
    detachedProcesses.clear();
}
/**
 * Check if running inside tmux.
 */
export function isInsideTmux() {
    return process.env.TMUX !== undefined;
}
/**
 * Get current terminal size.
 */
export function getTerminalSize() {
    try {
        const { columns, rows } = process.stdout;
        return { columns, rows };
    }
    catch {
        return null;
    }
}
/**
 * Spawn a process with proper stdio handling for interactive use.
 */
export function spawnInteractive(command, args = [], options = {}) {
    const opts = {
        stdio: 'inherit',
        shell: os.platform() === 'win32',
        ...options,
    };
    return spawn(command, args, opts);
}
/**
 * Spawn a process and capture output.
 */
export function spawnCapture(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
        const opts = {
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: os.platform() === 'win32',
            ...options,
        };
        const proc = spawn(command, args, opts);
        let stdout = Buffer.alloc(0);
        let stderr = Buffer.alloc(0);
        proc.stdout?.on('data', (chunk) => {
            stdout = Buffer.concat([stdout, chunk]);
        });
        proc.stderr?.on('data', (chunk) => {
            stderr = Buffer.concat([stderr, chunk]);
        });
        proc.on('error', (err) => {
            reject(err);
        });
        proc.on('close', (code) => {
            resolve({
                stdout: stdout.toString('utf8'),
                stderr: stderr.toString('utf8'),
                code: code ?? 0,
            });
        });
    });
}
//# sourceMappingURL=shell.js.map
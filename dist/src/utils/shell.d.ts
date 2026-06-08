/**
 * Shell utilities for Evo Agent
 * Process management, signal handling, and shell operations.
 */
import { ChildProcess, type SpawnOptions } from 'node:child_process';
/**
 * Track a detached child process for cleanup on shutdown.
 */
export declare function trackDetachedChild(proc: ChildProcess): void;
/**
 * Kill all tracked detached child processes.
 * Called during shutdown to prevent orphaned processes.
 */
export declare function killTrackedDetachedChildren(): void;
/**
 * Check if running inside tmux.
 */
export declare function isInsideTmux(): boolean;
/**
 * Get current terminal size.
 */
export declare function getTerminalSize(): {
    columns: number;
    rows: number;
} | null;
/**
 * Spawn a process with proper stdio handling for interactive use.
 */
export declare function spawnInteractive(command: string, args?: string[], options?: SpawnOptions): ChildProcess;
/**
 * Spawn a process and capture output.
 */
export declare function spawnCapture(command: string, args?: string[], options?: SpawnOptions): Promise<{
    stdout: string;
    stderr: string;
    code: number;
}>;
//# sourceMappingURL=shell.d.ts.map
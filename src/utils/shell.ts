/**
 * Shell utilities for Evo Agent
 * Process management, signal handling, and shell operations.
 */

import { spawn, ChildProcess, type SpawnOptions } from 'node:child_process';
import * as os from 'node:os';

// Track detached child processes so they can be killed on shutdown
const detachedProcesses = new Set<ChildProcess>();

/**
 * Track a detached child process for cleanup on shutdown.
 */
export function trackDetachedChild(proc: ChildProcess): void {
	detachedProcesses.add(proc);
	proc.on('exit', () => {
		detachedProcesses.delete(proc);
	});
}

/**
 * Kill all tracked detached child processes.
 * Called during shutdown to prevent orphaned processes.
 */
export function killTrackedDetachedChildren(): void {
	for (const proc of detachedProcesses) {
		try {
			// Try graceful termination first
			proc.kill('SIGTERM');
		} catch {
			// ignore
		}
	}
	detachedProcesses.clear();
}

/**
 * Check if running inside tmux.
 */
export function isInsideTmux(): boolean {
	return process.env.TMUX !== undefined;
}

/**
 * Get current terminal size.
 */
export function getTerminalSize(): { columns: number; rows: number } | null {
	try {
		const { columns, rows } = process.stdout;
		return { columns, rows };
	} catch {
		return null;
	}
}

/**
 * Spawn a process with proper stdio handling for interactive use.
 */
export function spawnInteractive(
	command: string,
	args: string[] = [],
	options: SpawnOptions = {}
): ChildProcess {
	const opts: SpawnOptions = {
		stdio: 'inherit',
		shell: os.platform() === 'win32',
		...options,
	};
	return spawn(command, args, opts);
}

/**
 * Spawn a process and capture output.
 */
export function spawnCapture(
	command: string,
	args: string[] = [],
	options: SpawnOptions = {}
): Promise<{ stdout: string; stderr: string; code: number }> {
	return new Promise((resolve, reject) => {
		const opts: SpawnOptions = {
			stdio: ['ignore', 'pipe', 'pipe'],
			shell: os.platform() === 'win32',
			...options,
		};
		const proc = spawn(command, args, opts);

		let stdout = Buffer.alloc(0);
		let stderr = Buffer.alloc(0);

		proc.stdout?.on('data', (chunk: Buffer) => {
			stdout = Buffer.concat([stdout, chunk]);
		});
		proc.stderr?.on('data', (chunk: Buffer) => {
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

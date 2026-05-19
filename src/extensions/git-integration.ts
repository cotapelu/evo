/**
 * Git Integration Extension
 *
 * Features:
 * - Auto-commit on session exit with AI-generated commit messages
 * - Git stash checkpoints before each turn for safe /fork restoration
 */

import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';

interface GitConfig {
	enabled: boolean;
	commitOnExit: boolean;
	checkpointPerTurn: boolean;
	stageAllChanges: boolean;
	commitMessageSource: string;
	gitTimeoutMs: number;
	maxRetries: number;
}

function validateConfig(config: any): GitConfig {
	if (typeof config !== 'object' || config === null) {
		throw new Error('Git integration config must be an object');
	}
	return {
		enabled: Boolean(config.enabled ?? true),
		commitOnExit: Boolean(config.commitOnExit ?? true),
		checkpointPerTurn: Boolean(config.checkpointPerTurn ?? true),
		stageAllChanges: Boolean(config.stageAllChanges ?? false),
		commitMessageSource: ['last-assistant', 'session-summary', 'last-user-message'].includes(config.commitMessageSource)
			? config.commitMessageSource
			: 'last-assistant',
		gitTimeoutMs: Math.min(Math.max(config.gitTimeoutMs ?? 10000, 1000), 60000),
		maxRetries: Math.min(Math.max(config.maxRetries ?? 2, 0), 5)
	} as GitConfig;
}

const CONFIG = validateConfig({
	enabled: true,
	commitOnExit: true,
	checkpointPerTurn: true,
	stageAllChanges: false,
	commitMessageSource: 'last-assistant',
	gitTimeoutMs: 10000,
	maxRetries: 2
});

export default function gitIntegrationExtension(pi: ExtensionAPI) {
	const checkpoints = new Map<string, string>(); // entryId -> stash ref
	let currentEntryId: string | undefined;
	let isGitRepoCached: boolean | null = null;

	// Safe git execution with timeout and retry
	async function execGit(args: string[], attempt: number = 1): Promise<{ stdout: string; code: number }> {
		const timeoutMs = CONFIG.gitTimeoutMs;
		const timeoutPromise = new Promise((_, reject) => {
			setTimeout(() => reject(new Error(`Git operation timed out after ${timeoutMs}ms`)), timeoutMs);
		});;

		try {
			const execPromise = pi.exec('git', args);
			return await Promise.race([execPromise, timeoutPromise]) as { stdout: string; code: number };
		} catch (error: any) {
			console.error(`Git operation failed (attempt ${attempt}/${CONFIG.maxRetries + 1}):`, error?.message || error);

			if (attempt <= CONFIG.maxRetries) {
				// Exponential backoff: 100ms, 200ms, 400ms
				const backoff = 100 * Math.pow(2, attempt - 1);
				await new Promise(resolve => setTimeout(resolve, backoff));
				return execGit(args, attempt + 1);
			}

			throw error;
		}
	}

	async function isGitRepo(): Promise<boolean> {
		if (isGitRepoCached !== null) return isGitRepoCached;
		try {
			const { code } = await execGit(['rev-parse', '--is-inside-work-tree']);
			isGitRepoCached = code === 0;
		} catch {
			isGitRepoCached = false;
		}
		return isGitRepoCached;
	}

	async function hasUncommittedChanges(): Promise<boolean> {
		try {
			const { stdout } = await execGit(['status', '--porcelain']);
			return stdout.trim().length > 0;
		} catch {
			return false;
		}
	}

	async function stageChanges(): Promise<boolean> {
		try {
			await execGit(['add', '-A']);
			return true;
		} catch (error) {
			console.error('Git stage failed:', error);
			return false;
		}
	}

	function sanitizeCommitMessage(message: string): string {
		// Remove newlines, control chars, and limit length
		const maxLength = 72;
		const sanitized = message
			.replace(/[\r\n]+/g, ' ')
			.replace(/[^\x20-\x7E]/g, '')
			.trim();
		return sanitized.length > maxLength ? sanitized.slice(0, maxLength - 3) + '...' : sanitized;
	}

	async function generateCommitMessage(ctx: ExtensionContext): Promise<string> {
		const entries = ctx.sessionManager.getEntries();
		if (entries.length === 0) return '[pi] No activity';

		try {
			switch (CONFIG.commitMessageSource) {
				case 'last-assistant': {
					for (let i = entries.length - 1; i >= 0; i--) {
						const entry = entries[i];
						if (entry.type === 'message' && (entry.message as any).role === 'assistant') {
							const content = (entry.message as any).content;
							if (Array.isArray(content)) {
								const text = content
									.filter((c): c is { type: 'text'; text: string } => c.type === 'text')
									.map((c) => c.text)
									.join('\n')
									.trim();
								const firstLine = text.split('\n')[0] || 'Assistant work';
								return `[pi] ${firstLine.slice(0, 72)}${firstLine.length > 72 ? '...' : ''}`;
							}
						}
					}
					return '[pi] Session work';
				}

				case 'last-user-message': {
					for (let i = entries.length - 1; i >= 0; i--) {
						const entry = entries[i];
						if (entry.type === 'message' && (entry.message as any).role === 'user') {
							const content = (entry.message as any).content;
							if (typeof content === 'string') {
								const firstLine = content.split('\n')[0] || 'User request';
								return `[pi] ${firstLine.slice(0, 72)}${firstLine.length > 72 ? '...' : ''}`;
							}
						}
					}
					return '[pi] User-driven work';
				}

				case 'session-summary': {
					let toolCount = 0;
					for (const entry of entries) {
						if (entry.type === 'message' && (entry.message as any).role === 'tool') toolCount++;
					}
					return `[pi] Session: ${toolCount} tool calls`;
				}

				default:
					return '[pi] Work completed';
			}
		} catch {
			return '[pi] Auto-commit';
		}
	}

	// Session start
	pi.on('session_start', async (_event, ctx) => {
		if (!CONFIG.enabled) return;

		const repo = await isGitRepo();
		if (!repo) {
			pi.appendEntry('git-integration-info', {
				message: 'Not a git repository - git integration disabled',
				type: 'warning'
			});
			return;
		}

		pi.appendEntry('git-integration-info', {
			message: 'Git integration active',
			checkpointPerTurn: CONFIG.checkpointPerTurn,
			commitOnExit: CONFIG.commitOnExit
		});
	});

	// Track entry ID for checkpoints after tool results
	pi.on('tool_result', async (_event: any, ctx) => {
		const leaf = ctx.sessionManager.getLeafEntry();
		if (leaf) currentEntryId = leaf.id;
	});

	// Turn start - create checkpoint
	pi.on('turn_start', async () => {
		if (!CONFIG.enabled || !CONFIG.checkpointPerTurn) return;
		if (!currentEntryId) return;
		if (!(await isGitRepo())) return;

		try {
			const { stdout } = await execGit(['stash', 'create', '-m', `pi-checkpoint-${currentEntryId}`]);
			const ref = stdout.trim();
			if (ref) {
				checkpoints.set(currentEntryId, ref);
			}
		} catch {
			// Silent fail - checkpoints are optional
		}
	});

	// Before fork - offer to restore code from checkpoint
	pi.on('session_before_fork', async (event, ctx) => {
		if (!CONFIG.enabled || !CONFIG.checkpointPerTurn) return;
		const ref = checkpoints.get(event.entryId);
		if (!ref) return;
		if (!ctx.hasUI) return;

		const choice = await ctx.ui.select('Restore code state from checkpoint?', [
			'Yes, restore code to that point',
			'No, keep current code'
		]);

		if (choice?.startsWith('Yes')) {
			try {
				await execGit(['stash', 'apply', ref]);
				ctx.ui.notify('Code restored to checkpoint', 'info');
			} catch (error) {
				ctx.ui.notify(`Failed to restore: ${error}`, 'error');
			}
		}
	});

	// Session shutdown - auto-commit
	pi.on('session_shutdown', async (_event, ctx) => {
		if (!CONFIG.enabled || !CONFIG.commitOnExit) return;
		if (!(await isGitRepo())) return;
		if (!(await hasUncommittedChanges())) return;

		const staged = await stageChanges();
		if (!staged) {
			ctx.ui.notify('Auto-commit skipped: staging failed', 'error');
			return;
		}

		let message = await generateCommitMessage(ctx);
		message = sanitizeCommitMessage(message);
		const { code } = await execGit(['commit', '-m', message]);

		if (code === 0 && ctx.hasUI) {
			ctx.ui.notify(`Auto-committed: ${message}`, 'info');
		}

		pi.appendEntry('git-integration-info', {
			message: `Auto-commit: ${message}`,
			committed: true
		});
	});

	// Agent end - cleanup
	pi.on('agent_end', async () => {
		checkpoints.clear();
		isGitRepoCached = null;
	});
}

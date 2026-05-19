/**
 * Git Integration Extension
 *
 * Features:
 * - Auto-commit on session exit with AI-generated commit messages
 * - Git stash checkpoints before each turn for safe /fork restoration
 */

import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';

// Hardcoded configuration; can be made dynamic via custom entry settings later
const CONFIG = {
	enabled: true,
	commitOnExit: true,
	checkpointPerTurn: true,
	stageAllChanges: false,
	commitMessageSource: 'last-assistant' as 'last-assistant' | 'session-summary' | 'last-user-message'
};

export default function gitIntegrationExtension(pi: ExtensionAPI) {
	const checkpoints = new Map<string, string>(); // entryId -> stash ref
	let currentEntryId: string | undefined;
	let isGitRepoCached: boolean | null = null;

	async function isGitRepo(): Promise<boolean> {
		if (isGitRepoCached !== null) return isGitRepoCached;
		try {
			const { code } = await pi.exec('git', ['rev-parse', '--is-inside-work-tree']);
			isGitRepoCached = code === 0;
		} catch {
			isGitRepoCached = false;
		}
		return isGitRepoCached;
	}

	async function hasUncommittedChanges(): Promise<boolean> {
		try {
			const { stdout } = await pi.exec('git', ['status', '--porcelain']);
			return stdout.trim().length > 0;
		} catch {
			return false;
		}
	}

	async function stageChanges(): Promise<boolean> {
		try {
			if (CONFIG.stageAllChanges) {
				await pi.exec('git', ['add', '-A']);
			} else {
				await pi.exec('git', ['add', '-A']);
			}
			return true;
		} catch (error) {
			console.error('Git stage failed:', error);
			return false;
		}
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
			const { stdout } = await pi.exec('git', ['stash', 'create', '-m', `pi-checkpoint-${currentEntryId}`]);
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
				await pi.exec('git', ['stash', 'apply', ref]);
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

		const message = await generateCommitMessage(ctx);
		const { code } = await pi.exec('git', ['commit', '-m', message]);

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

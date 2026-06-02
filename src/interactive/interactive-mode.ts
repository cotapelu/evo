/**
 * InteractiveMode for Evo Agent - Minimal Viable Version
 * Orchestrates TUI UI, input, and agent interaction.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import { CombinedAutocompleteProvider, Container, Input, Loader, Markdown, ProcessTerminal, Spacer, Text, TUI, TruncatedText, setKeybindings, matchesKey, SelectList, BorderedLoader } from '@earendil-works/pi-tui';
import {
	APP_NAME,
	APP_TITLE,
	VERSION,
	getAgentDir,
	getDebugLogPath,
} from '../config.js';
import type {
	AgentSession,
	AgentSessionEvent,
	AgentSessionRuntime,
	ResourceDiagnostic,
	SourceInfo,
	TruncationResult,
} from '@earendil-works/pi-coding-agent';
import {
	DEFAULT_MAX_LINES,
	DEFAULT_MAX_BYTES,
	discoverAndLoadExtensions,
	FooterComponent,
	CustomEditor,
	UserMessageComponent,
	AssistantMessageComponent,
	BashExecutionComponent,
	ToolExecutionComponent,
	DynamicBorder,
	ModelSelectorComponent,
	SettingsSelectorComponent,
	ThinkingSelectorComponent,
	SessionSelectorComponent,
	TreeSelectorComponent,
	keyHint,
	keyText,
	rawKeyHint,
	getMarkdownTheme,
	initTheme as piInitTheme,
	parseSkillBlock,
	SkillInvocationMessageComponent,
	CustomMessageComponent,
} from '@earendil-works/pi-coding-agent';
import { FooterDataProvider } from '../runtime/footer-data-provider.js';
import { KeybindingsManager } from '../runtime/keybindings-manager.js';
import { getChangelogPath, parseChangelog, getNewEntries } from '../utils/changelog.js';
import { killTrackedDetachedChildren } from '../utils/shell.js';
import { checkForNewPiVersion } from '../utils/version-check.js';
import { ExpandableText } from './components/expandable-text.js';
import { theme, initTheme as localInitTheme, getEditorTheme, getThinkingBorderColor } from './theme/theme.js';
import { copyToClipboard, readClipboardImage } from '../utils/clipboard.js';
import { CountdownTimer } from './components/countdown-timer.js';

// Helper functions (stubs for package exports not available)
function formatKeyText(key: string, options?: any): string {
	return options?.capitalize ? key.toUpperCase() : key;
}

function keyDisplayText(action: any): string {
	// Fallback: just return action name; keybindings manager will provide actual keys
	// In a full implementation, this would query keybindings.getKeys(action)
	return String(action);
}

// Minimal slash commands (since package may not export directly)
const BUILTIN_SLASH_COMMANDS = [
	{ name: 'clear', description: 'Clear chat' },
	{ name: 'exit', description: 'Exit' },
	{ name: 'quit', description: 'Exit' },
	{ name: 'compact', description: 'Compact session' },
	{ name: 'model', description: 'Cycle or select model' },
	{ name: 'thinking', description: 'Select thinking level' },
	{ name: 'models', description: 'Open model selector' },
	{ name: 'tree', description: 'Session tree navigation' },
	{ name: 'session', description: 'Resume or manage sessions' },
	{ name: 'hotkeys', description: 'Show keybindings' },
	{ name: 'clone', description: 'Clone current session to a new file' },
	{ name: 'fork', description: 'Fork session at a point' },
	{ name: 'reload', description: 'Reload extensions' },
	{ name: 'resources', description: 'Show loaded resources' },
	{ name: 'copy', description: 'Copy last assistant message to clipboard' },
	{ name: 'paste', description: 'Paste image from clipboard (macOS)' },
];

function createCompactionSummaryMessage(summary: string, tokensBefore: number, timestamp: string): any {
	return {
		role: 'compactionSummary',
		summary,
		tokensBefore,
		timestamp: new Date(timestamp).getTime(),
	} as any;
}

export interface InteractiveModeOptions {
	initialMessage?: string;
	initialImages?: any[];
	initialMessages?: string[];
	verbose?: boolean;
	migratedProviders?: string[];
	modelFallbackMessage?: string;
}

type Expandable = { setExpanded(expanded: boolean): void };
function isExpandable(obj: unknown): obj is Expandable {
	return typeof obj === 'object' && obj !== null && 'setExpanded' in obj && typeof obj.setExpanded === 'function';
}

export class InteractiveMode {
	private runtimeHost: AgentSessionRuntime;
	private options: InteractiveModeOptions;
	private ui!: TUI;
	private chatContainer = new Container();
	private pendingMessagesContainer = new Container();
	private statusContainer = new Container();
	private headerContainer = new Container();
	private editorContainer = new Container();
	private widgetContainerAbove = new Container();
	private widgetContainerBelow = new Container();
	private keybindings = KeybindingsManager.create();
	private defaultEditor!: CustomEditor;
	private editor!: any;
	private footerDataProvider!: FooterDataProvider;
	private footer!: FooterComponent;
	private isInitialized = false;
	private unsubscribe?: () => void;
	private signalCleanupHandlers: Array<() => void> = [];

	// State
	private changelogMarkdown?: string;
	private startupNoticesShown = false;
	private toolOutputExpanded = false;
	private hideThinkingBlock = false;
	private shutdownRequested = false;
	private fdPath = '';
	private loadingAnimation?: Loader;
	private defaultWorkingMessage = 'Working...';
	private workingVisible = true;
	private lastStatusSpacer?: Spacer;
	private lastStatusText?: Text;
	private builtInHeader?: any;

	// Event & tool tracking
	private streamingComponent?: any;
	private streamingMessage?: any;
	private pendingTools = new Map<string, any>();
	private toolComponents: any[] = []; // for global toggle expansion
	private autoCompactionLoader?: Loader;
	private autoCompactionEscapeHandler?: () => void;
	private compactionQueuedMessages: Array<{ text: string; mode: 'steer' | 'followUp' }> = [];
	private retryLoader?: Loader;
	private retryCountdown?: any;
	private retryEscapeHandler?: () => void;
	private autocompleteProvider?: any;

	// Convenience
	private get session(): any { return this.runtimeHost.session; }
	private get settingsManager(): any { return this.session.settingsManager; }
	private get sessionManager(): any { return this.session.sessionManager; }

	constructor(runtimeHost: AgentSessionRuntime, options: InteractiveModeOptions = {}) {
		this.runtimeHost = runtimeHost;
		this.options = options;
		// Initialize footer data provider early for tests
		this.footerDataProvider = new FooterDataProvider(
			runtimeHost.session?.sessionManager?.getCwd?.() ?? process.cwd()
		);
		setKeybindings(this.keybindings as any);
	}

	async init(): Promise<void> {
		if (this.isInitialized) return;
		this.registerSignalHandlers();

		// Load changelog
		try {
			const cp = getChangelogPath();
			if (fs.existsSync?.(cp)) {
				const content = fs.readFileSync?.(cp, 'utf8');
				const entries = parseChangelog(content);
				const last = this.settingsManager.getLastChangelogVersion?.();
				if (!last) this.settingsManager.setLastChangelogVersion?.(VERSION);
				else {
					const newE = getNewEntries(entries, last);
					if (newE.length > 0) {
						this.changelogMarkdown = newE.map((e: any) => e.content).join('\n\n');
						this.settingsManager.setLastChangelogVersion?.(VERSION);
					}
				}
			}
		} catch (e) {
			console.error('[Changelog]', e);
		}


		// Initialize theme
		piInitTheme?.();

		// TUI
		this.ui = new TUI(new ProcessTerminal(), this.settingsManager.getShowHardwareCursor?.() ?? true);
		this.ui.setClearOnShrink?.(this.settingsManager.getClearOnShrink?.() ?? true);

		// Editor - use editor theme with proper borderColor function
		const editorTheme = getEditorTheme();
		this.defaultEditor = new CustomEditor(this.ui, editorTheme, this.keybindings as any, {
			paddingX: this.settingsManager.getEditorPaddingX?.() ?? 2,
			autocompleteMaxVisible: this.settingsManager.getAutocompleteMaxVisible?.() ?? 8,
		});
		this.editor = this.defaultEditor;
		this.editorContainer.addChild?.(this.editor as any);

		// Layout
		this.ui.addChild?.(this.headerContainer);
		this.buildHeader();
		this.ui.addChild?.(this.chatContainer);
		this.ui.addChild?.(this.pendingMessagesContainer);
		this.ui.addChild?.(this.statusContainer);
		this.ui.addChild?.(this.widgetContainerAbove);
		this.ui.addChild?.(this.editorContainer);
		this.ui.addChild?.(this.widgetContainerBelow);

		this.footerDataProvider = new FooterDataProvider(this.sessionManager.getCwd?.());
		this.footer = new FooterComponent(this.session, this.footerDataProvider);
		this.footer.setAutoCompactEnabled?.(this.session.autoCompactionEnabled);
		this.ui.addChild?.(this.footer);

		this.ui.setFocus?.(this.editor);

		// Setup
		this.setupKeyHandlers?.();
		this.setupEditorSubmitHandler?.();

		// Start UI
		this.ui.start?.();

		// Bind extensions and subscribe to agent events
		await this.rebindCurrentSession?.();

		this.isInitialized = true;

		// Render initial
		this.renderInitialMessages?.();

		// Notices
		if (this.changelogMarkdown) this.showStartupNotices?.();

		console.log('✅ InteractiveMode initialized');
	}

	private buildHeader(): void {
		if (this.options.verbose || !this.settingsManager.getQuietStartup?.()) {
			const logo = this.theme()?.bold?.(this.theme()?.fg?.('accent', APP_NAME)) + this.theme()?.fg?.('dim', ` v${VERSION}`);
			const compact = [
				keyHint('app.interrupt', 'int'),
				rawKeyHint(`${keyText('app.clear')}/${keyText('app.exit')}`, 'clr/exit'),
				rawKeyHint('/', 'cmds'),
				rawKeyHint('!', 'bash'),
			].join(this.theme()?.fg?.('muted', ' · '));
			const onboarding = this.theme()?.fg?.('dim', `Press / for commands, ! for bash.`);
			const headerText = `${logo}\n${compact}\n\n${onboarding}`;
			this.builtInHeader = new Text(headerText, 1, 0);
			this.headerContainer.addChild?.(new Spacer(1));
			this.headerContainer.addChild?.(this.builtInHeader);
			this.headerContainer.addChild?.(new Spacer(1));
		}
	}



	private setupKeyHandlers(): void {
		// Basic key handlers can be added later
	}

	private setupEditorSubmitHandler(): void {
		this.defaultEditor.onSubmit = async (text: string) => {
			text = text.trim();
			if (!text) return;

			// Slash commands
			if (text.startsWith('/')) {
				this.editor.setText?.('');
				await this.handleSlashCommand?.(text);
				return;
			}

			// Bash commands
			if (text.startsWith('!')) {
				const isExcluded = text.startsWith('!!');
				const cmd = isExcluded ? text.slice(2).trim() : text.slice(1).trim();
				if (cmd) {
					this.editor.addToHistory?.(text);
					await this.executeBash?.(cmd, isExcluded);
				}
				return;
			}

			// Normal prompt
			this.chatContainer.addChild?.(new UserMessageComponent(text, this.getMarkdownThemeWithSettings?.()));
			try {
				await this.session.prompt?.(text);
			} catch (error: any) {
				// Log to console.error for diagnostics
				console.error('Prompt error:', error);
				this.showError?.(error?.message || 'Error');
			} finally {
				// Clear editor after submitted
				this.defaultEditor.setText?.('');
			}
		};
	}

	/** Handle slash command routing */
	// Regression: ensure showWarning exists, but default uncertain commands use console.log
	private async handleSlashCommand(command: string): Promise<void> {
		switch (command) {
			case '/clear':
			case '/new':
				await this.handleClearCommand?.();
				break;
			case '/exit':
			case '/quit':
				// Set flag for graceful exit
				this.shutdownRequested = true;
				await this.shutdown?.();
				break;
			case '/compact':
				try {
					await this.session.compact?.();
					this.showStatus?.('Compaction completed');
				} catch (e: any) {
					this.showError?.(`Compaction failed: ${e.message}`);
				}
				break;
			case '/thinking':
				this.showThinkingSelector?.();
				break;
			case '/models':
				this.showModelSelector?.();
				break;
			case '/tree':
				this.showTreeSelector?.();
				break;
			case '/session':
			case '/resume':
				await this.showSessionSelector?.();
				break;
			case '/settings':
				await this.showSettingsSelector?.();
				break;
			case '/reload':
				this.reloadResources?.();
				break;
			case '/hotkeys':
				this.showHotkeys?.();
				break;
			case '/clone':
				const cloneArg = command.slice(6).trim();
				if (!cloneArg) {
					this.showWarning?.('Usage: /clone <new session name>');
				} else {
					await this.cloneSession?.(cloneArg);
				}
				break;
			case '/fork':
				const forkArg = command.slice(5).trim();
				if (!forkArg) {
					this.showWarning?.('Usage: /fork <new session name>');
				} else {
					await this.forkSession?.(forkArg);
				}
				break;
			case '/debug':
				this.toggleDebug?.();
				break;
			case '/resources':
				this.showLoadedResources?.();
				break;
			case '/changelog':
				this.showChangelog?.();
				break;
			case '/name':
				const nameArg = command.slice(5).trim();
				if (!nameArg) {
					this.showWarning?.('Usage: /name <new name>');
				} else {
					this.renameSession?.(nameArg);
				}
				break;
			case '/export':
				const exportArg = command.slice(7).trim();
				if (exportArg) {
					this.exportSession?.(exportArg);
				} else {
					this.exportSession?.();
				}
				break;
			case '/import':
				const importArg = command.slice(7).trim();
				if (importArg) {
					this.importSession?.(importArg);
				} else {
					this.showWarning?.('Usage: /import <file path>');
				}
				break;
			case '/copy':
				await this.handleCopyCommand?.();
				break;
			case '/paste':
				await this.handlePasteCommand?.();
				break;
			default:
				if (command === '/model') {
					// Cycle to next model
					const result = await this.session.cycleModel?.();
					if (result?.model) {
						this.showStatus?.(`Model: ${result.model.id}`);
					} else {
						this.showStatus?.('No models available to cycle');
					}
					break;
				} else if (command.startsWith('/model ')) {
					const spec = command.slice(6).trim();
					if (!spec) {
						await this.session.cycleModel?.();
						break;
					}
					const models = await this.session.modelRegistry.getAvailable?.() ?? [];
					let target: any = null;
					// Try exact id match
					target = models.find((m: any) => m.id === spec);
					if (!target) {
						// Try provider/id
						const parts = spec.split('/');
						if (parts.length === 2) {
							const [provider, id] = parts;
							target = models.find((m: any) => m.provider === provider && m.id === id);
						}
					}
					if (target) {
						if (this.session.setModel) {
							await this.session.setModel(target);
						}
						// Ensure session.model is set for consistency
						this.session.model = target;
						this.showStatus?.(`Model: ${target.id}`);
					} else {
						this.showError?.(`Model not found: ${spec}`);
					}
					break;
				}
				// Uncertain command
				console.log(`Unknown command: ${command}`);
				break;
		}
	}

	/** Resume a specific session file (used by extensions) */
	private async handleResumeSession(sessionPath: string, options?: any): Promise<{ cancelled: boolean }> {
		try {
			if (this.loadingAnimation) {
				this.loadingAnimation.stop?.();
				this.loadingAnimation = undefined;
			}
			this.statusContainer.clear?.();
			const result = await this.runtimeHost.switchSession?.(sessionPath, options);
			if (result?.cancelled) {
				return { cancelled: true };
			}
			this.chatContainer.clear?.();
			this.renderInitialMessages?.();
			// No editorText returned; clear editor
			this.editor.setText?.('');
			this.showStatus?.(`Resumed session: ${sessionPath}`);
			return { cancelled: false };
		} catch (error: unknown) {
			return this.handleFatalRuntimeError?.('Failed to resume session', error);
		}
	}

	/** Bind session extensions including autocomplete provider */
	private async bindCurrentSessionExtensions(): Promise<void> {
		const uiContext = this.createExtensionUIContext?.();
		await this.session.bindExtensions?.({
			uiContext,
			abortHandler: () => {
				this.restoreQueuedMessagesToEditor?.({ abort: true });
			},
			commandContextActions: {
				waitForIdle: () => this.session.agent?.waitForIdle?.(),
				newSession: async (options: any) => {
					if (this.loadingAnimation) {
						this.loadingAnimation.stop?.();
						this.loadingAnimation = undefined;
					}
					this.statusContainer.clear?.();
					try {
						const result = await this.runtimeHost.newSession?.(options);
						if (!result?.cancelled) {
							this.renderCurrentSessionState?.();
							this.ui.requestRender?.();
						}
						return result;
					} catch (error: unknown) {
						return this.handleFatalRuntimeError?.('Failed to create session', error);
					}
				},
				fork: async (entryId: any, options?: any) => {
					try {
						const result = await this.runtimeHost.fork?.(entryId, options);
						if (!result?.cancelled) {
							this.renderCurrentSessionState?.();
							this.editor.setText?.(result?.selectedText ?? '');
							this.showStatus?.('Forked to new session');
						}
						return { cancelled: result?.cancelled };
					} catch (error: unknown) {
						return this.handleFatalRuntimeError?.('Failed to fork session', error);
					}
				},
				navigateTree: async (targetId: any, options?: any) => {
					const result = await this.session.navigateTree?.(targetId, {
						summarize: options?.summarize,
						customInstructions: options?.customInstructions,
						replaceInstructions: options?.replaceInstructions,
						label: options?.label,
					});
					if (result?.cancelled) {
						return { cancelled: true };
					}

					this.chatContainer.clear?.();
					this.renderInitialMessages?.();
					if (result?.editorText && !this.editor.getText?.()?.trim()) {
						this.editor.setText?.(result.editorText);
					}
					this.showStatus?.('Navigated to selected point');
					void this.flushCompactionQueue?.({ willRetry: false });
					return { cancelled: false };
				},
				switchSession: async (sessionPath: any, options?: any) => {
					return await this.handleResumeSession?.(sessionPath, options);
				},
				reload: async () => {
					await this.reloadResources?.();
				},
			},
			shutdownHandler: () => {
				this.shutdownRequested = true;
				if (!this.session.isStreaming) {
					void this.shutdown?.();
				}
			},
			onError: (error: any) => {
				this.showExtensionError?.(error.extensionPath, error.error, error.stack);
			},
		});

		this.setupAutocompleteProvider?.();

		const extensionRunner = this.session.extensionRunner;
		this.setupExtensionShortcuts?.(extensionRunner);
		this.showLoadedResources?.({ force: false, showDiagnosticsWhenQuiet: true });
		this.showStartupNotices?.();
	}


	/** Handle global keypresses (e.g., from keybindings manager) */
	private handleGlobalKey(keyData: string): { consume: boolean } | undefined {
		// Tool output expansion toggle
		if (matchesKey(keyData, 'app.tools.expand' as any)) {
			this.toolOutputExpanded = !this.toolOutputExpanded;
			// Apply to all tracked tool components
			if (this.toolComponents.length > 0) {
				this.toolComponents.forEach((t) => t.setExpanded?.(this.toolOutputExpanded));
			} else {
				for (const child of this.chatContainer.children) {
					// @ts-ignore
					if (child instanceof ToolExecutionComponent) {
						// @ts-ignore
						child.setExpanded?.(this.toolOutputExpanded);
					}
				}
			}
			return { consume: true };
		}
		// Add more global keys here if needed
		return undefined;
	}

	private getUserInput(): Promise<string> {
		return new Promise((resolve) => {
			(this as any).onInputCallback = (text: string) => {
				(this as any).onInputCallback = undefined;
				resolve(text);
			};
		});
	}




	private getMarkdownThemeWithSettings(): any {
		const base = getMarkdownTheme?.() ?? {};
		return { ...base, codeBlockIndent: this.settingsManager.getCodeBlockIndent?.() ?? 2 };
	}


	/** Auto-compaction loader control */
	private showAutoCompactionLoader(): void {
		if (!this.autoCompactionLoader) {
			this.autoCompactionLoader = new BorderedLoader(
				this.ui,
				this.theme(),
				'Compacting...',
				{ cancellable: true }
			);
			this.statusContainer.addChild?.(this.autoCompactionLoader);
			this.autoCompactionLoader.start?.();
			this.ui.requestRender?.();
		}
	}

	private hideAutoCompactionLoader(): void {
		if (this.autoCompactionLoader) {
			this.autoCompactionLoader.stop?.();
			this.statusContainer.removeChild?.(this.autoCompactionLoader);
			this.autoCompactionLoader = undefined;
			this.ui.requestRender?.();
		}
		// Flush queued compaction messages
		void this.flushCompactionQueue?.();
	}

	private hideRetryLoader(): void {
		if (this.retryLoader) {
			this.retryLoader.stop?.();
			this.statusContainer.removeChild?.(this.retryLoader);
			this.retryLoader = undefined;
			this.ui.requestRender?.();
		}
		// Retry escape handler will be cleared when countdown expires or abort
		if (this.retryCountdown) {
			this.retryCountdown.dispose?.();
			this.retryCountdown = undefined;
		}
	}

	private async flushCompactionQueue(options?: { willRetry?: boolean }): Promise<void> {
		if (this.compactionQueuedMessages.length === 0) {
			return;
		}

		const queuedMessages = [...this.compactionQueuedMessages];
		this.compactionQueuedMessages = [];
		this.updatePendingMessagesDisplay();

		const restoreQueue = (error: unknown) => {
			this.session.clearQueue?.();
			this.compactionQueuedMessages = queuedMessages;
			this.updatePendingMessagesDisplay();
			this.showError?.(`Failed to send queued message${queuedMessages.length > 1 ? 's' : ''}: ${error instanceof Error ? error.message : String(error)}`);
		};

		try {
			if (options?.willRetry) {
				// When retry is pending, queue messages for the retry turn
				for (const message of queuedMessages) {
					if (this.isExtensionCommand(message.text)) {
						await this.session.prompt?.(message.text);
					} else if (message.mode === 'followUp') {
						await this.session.followUp?.(message.text);
					} else {
						await this.session.steer?.(message.text);
					}
				}
				this.updatePendingMessagesDisplay();
				return;
			}

			// Find first non-extension-command message to use as prompt
			const firstPromptIndex = queuedMessages.findIndex((message) => !this.isExtensionCommand(message.text));
			if (firstPromptIndex === -1) {
				// All extension commands - execute them all
				for (const message of queuedMessages) {
					await this.session.prompt?.(message.text);
				}
				return;
			}

			// Execute any extension commands before the first prompt
			const preCommands = queuedMessages.slice(0, firstPromptIndex);
			const firstPrompt = queuedMessages[firstPromptIndex];
			const rest = queuedMessages.slice(firstPromptIndex + 1);

			for (const message of preCommands) {
				await this.session.prompt?.(message.text);
			}

			// Send first prompt (starts streaming)
			const promptPromise = this.session.prompt?.(firstPrompt.text).catch((error: unknown) => {
				restoreQueue(error);
			});

			// Queue remaining messages
			for (const message of rest) {
				if (this.isExtensionCommand(message.text)) {
					await this.session.prompt?.(message.text);
				} else if (message.mode === 'followUp') {
					await this.session.followUp?.(message.text);
				} else {
					await this.session.steer?.(message.text);
				}
			}

			await promptPromise;
		} catch (error: unknown) {
			restoreQueue(error);
		}
	}

	private isExtensionCommand(text: string): boolean {
		if (!text.startsWith('/')) return false;

		const extensionRunner = this.session.extensionRunner;

		const spaceIndex = text.indexOf(' ');
		const commandName = spaceIndex === -1 ? text.slice(1) : text.slice(1, spaceIndex);
		return !!extensionRunner.getCommand?.(commandName);
	}

	private showExtensionError(extensionPath: string, error: unknown, stack?: string): void {
		const errorMessage = error instanceof Error ? error.message : String(error);
		this.showError?.(`Extension error in ${extensionPath}: ${errorMessage}`);
		if (stack) console.error(`Extension error stack:\n${stack}`);
	}

	private handleFatalRuntimeError(prefix: string, error: unknown): never {
		const message = error instanceof Error ? error.message : String(error);
		this.showError(`${prefix}: ${message}`);
		void this.shutdown?.(1);
		// eslint-disable-next-line @typescript-eslint/no-unreachable
		throw error;
	}

	private setupAutocompleteProvider(): void {
		const slashCommands = BUILTIN_SLASH_COMMANDS.map((cmd: any) => ({
			value: cmd.name,
			label: cmd.name,
			description: cmd.description,
		}));

		const extensionCommands = (this.session.extensionRunner?.getCommands?.() ?? []).map((cmd: any) => ({
			value: cmd.invocationName,
			label: cmd.invocationName,
			description: cmd.description,
		}));

		const allCommands = [...slashCommands, ...extensionCommands];

		const provider = new CombinedAutocompleteProvider(
			allCommands,
			this.sessionManager.getCwd?.() ?? process.cwd(),
			this.fdPath || null
		);
		this.defaultEditor.setAutocompleteProvider?.(provider);
		this.autocompleteProvider = provider;
	}

	private setupExtensionShortcuts(extensionRunner: any): void {
		if (!extensionRunner) return;
		const shortcuts = extensionRunner.getShortcuts?.(this.keybindings.getEffectiveConfig?.() ?? {}) ?? new Map();
		if (shortcuts.size === 0) return;

		const createContext = (): any => ({
			ui: this.createExtensionUIContext?.(),
			hasUI: true,
			cwd: this.sessionManager.getCwd?.(),
			sessionManager: this.sessionManager,
			modelRegistry: this.session.modelRegistry,
			model: this.session.model,
			isIdle: () => !this.session.isStreaming,
			signal: this.session.agent?.signal,
			abort: () => {
				this.restoreQueuedMessagesToEditor?.({ abort: true });
			},
			hasPendingMessages: () => this.session.pendingMessageCount > 0,
			shutdown: () => {
				this.shutdownRequested = true;
			},
			getContextUsage: () => this.session.getContextUsage?.(),
			compact: (options: any) => {
				void (async () => {
					try {
						const result = await this.session.compact?.(options?.customInstructions);
						options?.onComplete?.(result);
					} catch (error: unknown) {
						const err = error instanceof Error ? error : new Error(String(error));
						options?.onError?.(err);
					}
				})();
			},
			getSystemPrompt: () => this.session.systemPrompt,
		});

		this.defaultEditor.onExtensionShortcut = (data: string) => {
			for (const [shortcutStr, shortcut] of shortcuts) {
				if (matchesKey?.(data, shortcutStr as any)) {
					Promise.resolve(shortcut.handler(createContext())).catch((err: any) => {
						this.showError?.(`Shortcut handler error: ${err instanceof Error ? err.message : String(err)}`);
					});
					return true;
				}
			}
			return false;
		};
	}

	/** Create Extension UIContext for extension UI requests */
	private createExtensionUIContext(): any {
		// Provides UI primitives for extensions: dialogs, notifications, header/footer control
		return {
			// Header/Footer manipulation
			setHeader: (builder: ((tui: any, theme: any) => any) | any) => {
				this.headerContainer.clear?.();
				if (builder) {
					if (typeof builder === 'function') {
						const component = builder(this.ui, this.theme());
						if (component) {
							if (typeof component === 'string') {
								this.headerContainer.addChild?.(new Text(component, 1, 0));
							} else if (component && typeof component === 'object' && 'addChild' in component) {
								this.headerContainer.addChild?.(component);
							}
						}
					} else {
						if (typeof builder === 'string') {
							this.headerContainer.addChild?.(new Text(builder, 1, 0));
						} else if (builder && typeof builder === 'object' && 'addChild' in builder) {
							this.headerContainer.addChild?.(builder);
						}
					}
				}
				this.ui.requestRender?.();
			},
			setFooter: (builder: ((tui: any, theme: any) => any) | any) => {
				if (builder) {
					if (typeof builder === 'function') {
						const component = builder(this.ui, this.theme());
						if (component && typeof component === 'object' && 'addChild' in component) {
							this.footer = component as any;
						}
					} else if (typeof builder === 'object' && 'addChild' in builder) {
						this.footer = builder as any;
					}
					this.ui.requestRender?.();
				}
			},

			// Dialogs (overlays)
			select: (title: string, options: string[], opts?: any) =>
				new Promise((resolve) => {
					const items = options.map((o) => ({ value: o, label: o }));
					const th = this.theme();
					const selector = new SelectList(
						items,
						Math.min(options.length, 8),
						{
							selectedPrefix: (t) => th.fg('accent', '►'),
							selectedText: (t) => th.fg('accent', t),
							description: (t) => th.fg('dim', t),
							scrollInfo: (t) => th.fg('muted', t),
							noMatch: (t) => th.fg('warning', t),
						}
					);
					selector.onSelect = (val) => { this.ui.hideOverlay?.(); resolve(val); };
					selector.onCancel = () => { this.ui.hideOverlay?.(); resolve(undefined); };
					this.ui.showOverlay?.(selector);
					this.ui.setFocus?.(selector);
				}),

			confirm: (title: string, message?: string, opts?: any) =>
				new Promise((resolve) => {
					const th = this.theme();
					const text = message ? `${title}: ${message}` : title;
					const items = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }];
					const selector = new SelectList(
						items,
						2,
						{
							selectedPrefix: (t) => th.fg('accent', '►'),
							selectedText: (t) => th.fg('accent', t),
							description: (t) => th.fg('dim', t),
							scrollInfo: (t) => th.fg('muted', t),
							noMatch: (t) => th.fg('warning', t),
						}
					);
					selector.onSelect = (val: any) => { this.ui.hideOverlay?.(); resolve(val === 'yes'); };
					selector.onCancel = () => { this.ui.hideOverlay?.(); resolve(false); };
					this.ui.showOverlay?.(selector);
					this.ui.setFocus?.(selector);
				}),

			input: (title: string, placeholder?: string, opts?: any) =>
				new Promise((resolve) => {
					const input = new Input();
					input.onSubmit = (value) => { resolve(value.trim() || undefined); };
					input.onEscape = () => { resolve(undefined); };
					const container = new Container();
					const th = this.theme();
					container.addChild?.(new Text(th.bold(title), 1, 0));
					container.addChild?.(input);
					this.ui.showOverlay?.(container);
					this.ui.setFocus?.(input);
				}),

			editor: (title: string, prefill?: string, opts?: any) =>
				new Promise((resolve) => {
					const input = new Input();
					if (prefill) input.setValue?.(prefill);
					input.onSubmit = (value) => { resolve(value.trim() || undefined); };
					input.onEscape = () => { resolve(undefined); };
					const container = new Container();
					const th = this.theme();
					container.addChild?.(new Text(th.bold(title), 1, 0));
					container.addChild?.(input);
					this.ui.showOverlay?.(container);
					this.ui.setFocus?.(input);
				}),

			notify: (message: string, type?: 'info' | 'warning' | 'error') => {
				const color = type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info';
				this.chatContainer.addChild?.(new Spacer(1));
				this.chatContainer.addChild?.(
					new Text(this.theme().fg(color, `Notification: ${message}`), 1, 0)
				);
				this.ui.requestRender?.();
			},

			setStatus: (key: string, text: string | undefined) => {
				if (text) {
					this.chatContainer.addChild?.(new Spacer(1));
					this.chatContainer.addChild?.(
						new Text(this.theme().dim(`[status: ${key}] ${text}`), 1, 0)
					);
					this.ui.requestRender?.();
				}
			},

			setWidget: (key: string, content: unknown, options?: any) => {
				if (Array.isArray(content)) {
					this.chatContainer.addChild?.(new Spacer(1));
					this.chatContainer.addChild?.(
						new Text(this.theme().dim(`[widget: ${key}]`), 1, 0)
					);
					content.forEach((line: string) => {
						this.chatContainer.addChild?.(
							new Text(this.theme().dim(`  ${line}`), 1, 0)
						);
					});
					this.ui.requestRender?.();
				}
			},

			setEditorText: (text: string) => {
				this.editor.setText?.(text);
			},

			getEditorText(): string {
				return this.editor.getText?.() ?? '';
			},

			setWorkingVisible: (visible: boolean) => {
				// No-op
			},

			setWorkingMessage: (msg?: string) => {
				// No-op
			},

			setTheme: (_theme: string) => { return { success: false, error: 'Not supported' }; },
		};
	}

	/** Get the current theme object */
	private theme(): any {
		return theme();
	}

	private updateEditorBorderColor(): void {
		const level = this.session.thinkingLevel || 'off';
		this.editor.borderColor = getThinkingBorderColor(level);
		this.ui.requestRender?.();
	}

	/** Get capitalized display string for an app keybinding action. */
	private getAppKeyDisplay(action: any): string {
		return keyDisplayText(action);
	}

	/** Get capitalized display string for an editor keybinding action. */
	private getEditorKeyDisplay(action: any): string {
		return keyDisplayText(action);
	}

	private renderInitialMessages(): void {
		// Clear chat to ensure clean slate
		this.chatContainer.clear?.();
		// Use buildSessionContext if available; otherwise fall back to session.state.messages
		const context = this.sessionManager.buildSessionContext?.() ?? { messages: this.session.state?.messages ?? [] };
		if (context.messages?.length > 0) {
			this.renderSessionContext(context, {
				updateFooter: true,
				populateHistory: true,
			});
		}
		// Show compaction info if session was compacted
		const allEntries = this.sessionManager.getEntries?.() ?? [];
		const compactionCount = (allEntries ?? []).filter((e: any) => e.type === 'compaction').length;
		if (compactionCount > 0) {
			const times = compactionCount === 1 ? '1 time' : `${compactionCount} times`;
			this.showStatus?.(`Session compacted ${times}`);
		}
		this.ui.requestRender?.();
	}

	async run(): Promise<void> {
		await this.init?.();

		// Async version check
		checkForNewPiVersion().then((newVersion) => {
			if (newVersion) this.showNewVersionNotification?.(newVersion);
		});

		// Main loop
		while (!this.shutdownRequested) {
			const userInput = await this.getUserInput?.();
			try {
				await this.session.prompt?.(userInput);
			} catch (error: any) {
				this.showError?.(error?.message || 'Error');
			}
		}
	}



	// Placeholder methods to satisfy references (will implement later)
	// ============================================================================
	// Agent Event Handling & Subscriptions
	// ============================================================================

	// ============================================================================
	// Agent Subscription & Event Handling
	// ============================================================================

	private subscribeToAgent(): void {
		this.unsubscribe = this.session.subscribe((event: any) => {
			void this.handleEvent(event);
		});
	}

	private async handleEvent(event: any): Promise<void> {
		if (!this.isInitialized) await this.init?.();
		this.footer.invalidate?.();

		switch (event.type) {
			case 'agent_start':
			case 'turn_start':
				if (this.settingsManager.getShowTerminalProgress?.()) this.ui.terminal.setProgress?.(true);
				// Restore main escape handler if retry handler is still active
				if (this.retryEscapeHandler) {
					this.defaultEditor.onEscape = this.retryEscapeHandler;
					this.retryEscapeHandler = undefined;
				}
				if (this.retryCountdown) {
					this.retryCountdown.dispose?.();
					this.retryCountdown = undefined;
				}
				if (this.retryLoader) {
					this.retryLoader.stop?.();
					this.retryLoader = undefined;
				}
				this.stopWorkingLoader?.();
				if (this.workingVisible) {
					this.loadingAnimation = this.createWorkingLoader?.();
					this.statusContainer.addChild?.(this.loadingAnimation);
				this.loadingAnimation.start?.();
				}
				this.ui.requestRender?.();
				break;

			case 'queue_update':
				this.updatePendingMessagesDisplay?.();
				this.ui.requestRender?.();
				break;

			case 'session_info_changed':
				this.updateTerminalTitle?.();
				this.footer.invalidate?.();
				this.ui.requestRender?.();
				break;

			case 'thinking_level_changed':
				this.footer.invalidate?.();
				this.updateEditorBorderColor?.();
				break;

			case 'turn_end':
				this.stopWorkingLoader?.();
				this.ui.requestRender?.();
				break;

			case 'message_start':
				if (event.message?.role === 'user') {
					this.addMessageToChat?.(event.message);
					this.updatePendingMessagesDisplay?.();
				} else if (event.message?.role === 'assistant') {
					this.streamingComponent = new AssistantMessageComponent(
						event.message,
						this.hideThinkingBlock,
						this.getMarkdownThemeWithSettings?.()
					);
					this.streamingMessage = event.message;
					this.chatContainer.addChild?.(this.streamingComponent);
					this.streamingComponent.updateContent?.(this.streamingMessage);
					this.ui.requestRender?.();
				}
				break;

			case 'message_update':
				if (this.streamingComponent && event.message?.role === 'assistant') {
					this.streamingMessage = event.message;
					this.streamingComponent.updateContent?.(this.streamingMessage);
					// Handle tool calls in streaming
					for (const content of this.streamingMessage.content ?? []) {
						if (content.type === 'toolCall') {
							if (!this.pendingTools.has?.(content.id)) {
								const component = new ToolExecutionComponent(
									content.name,
									content.id,
									content.arguments,
									{
										showImages: this.settingsManager.getShowImages?.(),
										imageWidthCells: this.settingsManager.getImageWidthCells?.(),
									},
									this.getRegisteredToolDefinition?.(content.name),
									this.ui,
									this.sessionManager.getCwd?.(),
								);
								component.setExpanded?.(this.toolOutputExpanded);
								this.chatContainer.addChild?.(component);
								this.pendingTools.set?.(content.id, component);
							}
						} else {
							const component = this.pendingTools.get?.(content.id);
							if (component) {
								component.updateArgs?.(content.arguments);
							}
						}
					}
				}
				this.ui.requestRender?.();
				break;

			case 'message_end': {
				const msg = event.message;
				if (msg?.role === 'assistant') {
					if (this.streamingComponent) {
						this.streamingComponent.updateContent?.(msg);
						this.streamingComponent = undefined;
						this.streamingMessage = undefined;
					} else {
						this.addMessageToChat?.(msg);
					}
					this.footer.invalidate?.();
				}
				this.ui.requestRender?.();
				break;
			}

			case 'tool_execution_start': {
				let component = this.pendingTools.get?.(event.toolCallId);
				if (!component) {
					component = new ToolExecutionComponent(
						event.toolName,
						event.toolCallId,
						event.args,
						{
							showImages: this.settingsManager.getShowImages?.(),
							imageWidthCells: this.settingsManager.getImageWidthCells?.(),
						},
						this.getRegisteredToolDefinition?.(event.toolName),
						this.ui,
						this.sessionManager.getCwd?.(),
					);
					component.setExpanded?.(this.toolOutputExpanded);
					this.chatContainer.addChild?.(component);
					this.pendingTools.set?.(event.toolCallId, component);
					// Track for global expansion toggle
					this.toolComponents.push(component);
				}
				component.markExecutionStarted?.();
				this.ui.requestRender?.();
				break;
			}

			case 'tool_execution_update': {
				const component = this.pendingTools.get?.(event.toolCallId);
				if (component) {
					component.updateResult?.({ ...event.partialResult, isError: false }, true);
					this.ui.requestRender?.();
				}
				break;
			}

			case 'tool_execution_end': {
				const component = this.pendingTools.get?.(event.toolCallId);
				if (component) {
					component.updateResult?.({ ...event.result, isError: event.isError });
					this.pendingTools.delete?.(event.toolCallId);
					this.ui.requestRender?.();
				}
				break;
			}

			case 'shutdown_requested':
				this.shutdownRequested = true;
				break;

			case 'compaction_start': {
				if (this.settingsManager.getShowTerminalProgress?.()) {
					this.ui.terminal.setProgress?.(true);
				}
				// Keep editor active; submissions are queued during compaction.
				this.autoCompactionEscapeHandler = this.defaultEditor.onEscape;
				this.defaultEditor.onEscape = () => {
					this.session.abortCompaction?.();
				};
				this.statusContainer.clear?.();
				const cancelHint = `(${keyText('app.interrupt')} to cancel)`;
				const label =
					event.reason === 'manual'
						? `Compacting context... ${cancelHint}`
						: `${event.reason === 'overflow' ? 'Context overflow detected, ' : ''}Auto-compacting... ${cancelHint}`;
				this.autoCompactionLoader = new Loader(
					this.ui,
					(spinner) => this.theme().fg('accent', spinner),
					(text) => this.theme().dim(text),
					label,
				);
				this.statusContainer.addChild?.(this.autoCompactionLoader);
				this.ui.requestRender?.();
				break;
			}

			case 'compaction_end': {
				if (this.settingsManager.getShowTerminalProgress?.()) {
					this.ui.terminal.setProgress?.(false);
				}
				if (this.autoCompactionEscapeHandler) {
					this.defaultEditor.onEscape = this.autoCompactionEscapeHandler;
					this.autoCompactionEscapeHandler = undefined;
				}
				if (this.autoCompactionLoader) {
					this.autoCompactionLoader.stop?.();
					this.autoCompactionLoader = undefined;
					this.statusContainer.clear?.();
				}
				if (event.aborted) {
					if (event.reason === 'manual') {
						this.showError?.('Compaction cancelled');
					} else {
						this.showStatus?.('Auto-compaction cancelled');
					}
				} else if (event.result) {
					this.chatContainer.clear?.();
					this.rebuildChatFromMessages?.();
					this.addMessageToChat?.(
						createCompactionSummaryMessage(
							event.result.summary,
							event.result.tokensBefore,
							new Date().toISOString(),
						),
					);
					this.footer.invalidate?.();
				} else if (event.errorMessage) {
					if (event.reason === 'manual') {
						this.showError?.(event.errorMessage);
					} else {
						this.chatContainer.addChild?.(new Spacer(1));
						this.chatContainer.addChild?.(
							new Text(this.theme().fg('error', event.errorMessage), 1, 0)
						);
					}
				}
				void this.flushCompactionQueue?.({ willRetry: event.willRetry });
				this.ui.requestRender?.();
				break;
			}

			case 'auto_retry_start': {
				const retryAfter = (event as any).delayMs ?? (event as any).retryAfter ?? 5000;
				// Set up escape to abort retry
				this.retryEscapeHandler = this.defaultEditor.onEscape;
				this.defaultEditor.onEscape = () => {
					this.session.abortRetry?.();
				};
				// Show retry indicator
				this.statusContainer.clear?.();
				this.retryCountdown?.dispose?.();
				const retryMessage = (seconds: number) =>
					`Retrying (${event.attempt}/${event.maxAttempts}) in ${seconds}s... (${keyText('app.interrupt')} to cancel)`;
				this.retryLoader = new Loader(
					this.ui,
					(spinner) => this.theme().fg('warning', spinner),
					(text) => this.theme().dim(text),
					retryMessage(Math.ceil(retryAfter / 1000)),
				);
				this.retryCountdown = new CountdownTimer(
					retryAfter,
					this.ui,
					(remainingMs) => {
						const seconds = Math.ceil(remainingMs / 1000);
						this.retryLoader?.setMessage?.(retryMessage(seconds));
					},
					() => {
						this.retryCountdown = undefined;
					}
				);
				this.statusContainer.addChild?.(this.retryLoader);
				this.retryCountdown.start?.();
				this.ui.requestRender?.();
				break;
			}

			case 'auto_retry_end': {
				// Restore escape handler
				if (this.retryEscapeHandler) {
					this.defaultEditor.onEscape = this.retryEscapeHandler;
					this.retryEscapeHandler = undefined;
				}
				if (this.retryCountdown) {
					this.retryCountdown.dispose?.();
					this.retryCountdown = undefined;
				}
				if (this.retryLoader) {
					this.retryLoader.stop?.();
					this.retryLoader = undefined;
					this.statusContainer.clear?.();
				}
				// Show error only on final failure (success shows normal response)
				if (!event.success) {
					this.showError?.(`Retry failed after ${event.attempt} attempts: ${event.finalError || 'Unknown error'}`);
				}
				this.ui.requestRender?.();
				break;
			}

			default:
				break;
		}
	}

	// ============================================================================
	// Working Indicator
	// ============================================================================

	private createWorkingLoader(): Loader {
		const th = this.theme();
		return new Loader(
			this.ui,
			(spinner) => th.fg('accent', spinner),
			(text) => th.fg('muted', text),
			this.defaultWorkingMessage
		);
	}

	private showWorkingIndicator(): void {
		if (!this.workingVisible) return;
		if (!this.loadingAnimation) {
			this.loadingAnimation = this.createWorkingLoader?.();
		}
		if (this.loadingAnimation && this.statusContainer.children.indexOf(this.loadingAnimation) === -1) {
			this.statusContainer.addChild?.(this.loadingAnimation);
				this.loadingAnimation.start?.();
			this.loadingAnimation.start?.();
		}
		this.ui.requestRender?.();
	}

	private stopWorkingLoader(): void {
		if (this.loadingAnimation) {
			this.loadingAnimation.stop?.();
			this.statusContainer.removeChild?.(this.loadingAnimation);
			this.loadingAnimation = undefined;
		}
		this.ui.requestRender?.();
	}

	// ============================================================================
	// Message Rendering Helpers
	// ============================================================================

	private addMessageToChat(message: any, options?: { populateHistory?: boolean }): void {
		switch (message.role) {
			case 'bashExecution': {
				const bashComponent = new BashExecutionComponent(message.command, this.ui, message.excludeFromContext);
				if (message.output) {
					bashComponent.appendOutput(message.output);
				}
				bashComponent.setComplete(
					message.exitCode,
					message.cancelled,
					message.truncated ? ({ truncated: true, content: message.output } as any) : undefined,
					message.fullOutputPath,
				);
				this.chatContainer.addChild?.(bashComponent);
				break;
			}
			case 'custom': {
				if (message.display) {
					const renderer = this.session.extensionRunner?.getMessageRenderer?.(message.customType);
					const component = new CustomMessageComponent(message, renderer, this.getMarkdownThemeWithSettings?.());
					component.setExpanded?.(this.toolOutputExpanded);
					this.chatContainer.addChild?.(component);
				}
				break;
			}
			case 'compactionSummary':
			case 'branchSummary': {
				this.chatContainer.addChild?.(new Spacer(1));
				// Render as custom message since specific components may not be exported
				const comp = new CustomMessageComponent(message, undefined, this.getMarkdownThemeWithSettings?.());
				comp.setExpanded?.(this.toolOutputExpanded);
				this.chatContainer.addChild?.(comp);
				break;
			}
			case 'user': {
				const textContent = this.getUserMessageText?.(message);
				if (textContent != null) { // include empty string
					if (this.chatContainer.children.length > 0) this.chatContainer.addChild?.(new Spacer(1));
					const skillBlock = parseSkillBlock?.(textContent);
					if (skillBlock) {
						const component = new SkillInvocationMessageComponent(skillBlock, this.getMarkdownThemeWithSettings?.());
						component.setExpanded?.(this.toolOutputExpanded);
						this.chatContainer.addChild?.(component);
						if (skillBlock.userMessage) {
							const userComponent = new UserMessageComponent(skillBlock.userMessage, this.getMarkdownThemeWithSettings?.());
							this.chatContainer.addChild?.(userComponent);
						}
					} else {
						const userComponent = new UserMessageComponent(textContent, this.getMarkdownThemeWithSettings?.());
						this.chatContainer.addChild?.(userComponent);
					}
					if (options?.populateHistory) {
						this.editor.addToHistory?.(textContent);
					}
				}
				break;
			}
			case 'assistant': {
				const assistantComponent = new AssistantMessageComponent(
					message,
					this.hideThinkingBlock,
					this.getMarkdownThemeWithSettings?.(),
				);
				this.chatContainer.addChild?.(assistantComponent);
				break;
			}
			case 'toolResult':
				// Tool results are rendered inline with tool calls, skip
				break;
			default:
				// Ignore unknown message types
				break;
		}
	}

	private getUserMessageText(message: any): string {
		if (message.role !== 'user') return '';
		if (typeof message.content === 'string') return message.content;
		const textParts = (message.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text);
		return textParts.join('\n');
	}

	private getAssistantMessageText(message: any): string {
		if (message.role !== 'assistant') return '';
		if (typeof message.content === 'string') return message.content;
		const textParts = (message.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text);
		return textParts.join('\n');
	}

	private getRegisteredToolDefinition(toolName: string): any {
		return this.session.getToolDefinition?.(toolName);
	}

	/**
	 * Get all queued messages (steering + followUp) from session and compaction queue.
	 */
	private getAllQueuedMessages(): { steering: string[]; followUp: string[] } {
		return {
			steering: [
				...(this.session.getSteeringMessages?.() ?? []),
				...this.compactionQueuedMessages
					.filter((msg) => msg.mode === "steer")
					.map((msg) => msg.text),
			],
			followUp: [
				...(this.session.getFollowUpMessages?.() ?? []),
				...this.compactionQueuedMessages
					.filter((msg) => msg.mode === "followUp")
					.map((msg) => msg.text),
			],
		};
	}

	/**
	 * Clear all queues and return their contents.
	 */
	private clearAllQueues(): { steering: string[]; followUp: string[] } {
		const sessionQueues = this.session.clearQueue?.() ?? { steering: [], followUp: [] };
		const compactionSteering = this.compactionQueuedMessages
			.filter((msg) => msg.mode === "steer")
			.map((msg) => msg.text);
		const compactionFollowUp = this.compactionQueuedMessages
			.filter((msg) => msg.mode === "followUp")
			.map((msg) => msg.text);
		this.compactionQueuedMessages = [];
		return {
			steering: [...sessionQueues.steering, ...compactionSteering],
			followUp: [...sessionQueues.followUp, ...compactionFollowUp],
		};
	}

	private restoreQueuedMessagesToEditor(options?: { abort?: boolean; currentText?: string }): number {
		const { steering, followUp } = this.clearAllQueues();
		const allQueued = [...steering, ...followUp];
		if (allQueued.length === 0) {
			this.updatePendingMessagesDisplay?.();
			if (options?.abort) {
				this.session.agent?.abort?.();
			}
			return 0;
		}
		const queuedText = allQueued.join("\n\n");
		const currentText = options?.currentText ?? this.editor.getText?.();
		const combinedText = [queuedText, currentText].filter((t) => t?.trim()).join("\n\n");
		this.editor.setText?.(combinedText);
		this.updatePendingMessagesDisplay?.();
		if (options?.abort) {
			this.session.agent?.abort?.();
		}
		return allQueued.length;
	}

	private queueCompactionMessage(text: string, mode: "steer" | "followUp"): void {
		this.compactionQueuedMessages.push({ text, mode });
		this.editor.addToHistory?.(text);
		this.editor.setText?.("");
		this.updatePendingMessagesDisplay?.();
		this.showStatus?.("Queued message for after compaction");
	}

	private updatePendingMessagesDisplay(): void {
		this.pendingMessagesContainer.clear?.();
		const { steering, followUp } = this.getAllQueuedMessages?.();
		if (steering.length > 0 || followUp.length > 0) {
			this.pendingMessagesContainer.addChild?.(new Spacer(1));
			for (const message of steering) {
				const text = this.theme().fg("dim", `Steering: ${message}`);
				this.pendingMessagesContainer.addChild?.(new TruncatedText(text, 1, 0));
			}
			for (const message of followUp) {
				const text = this.theme().fg("dim", `Follow-up: ${message}`);
				this.pendingMessagesContainer.addChild?.(new TruncatedText(text, 1, 0));
			}
			const dequeueHint = this.getAppKeyDisplay?.("app.message.dequeue");
			const hintText = this.theme().fg("dim", `↳ ${dequeueHint} to edit all queued messages`);
			this.pendingMessagesContainer.addChild?.(new TruncatedText(hintText, 1, 0));
		}
	}

	// ============================================================================
	// Model Selector
	// ============================================================================

	private showModelSelector(initialSearchInput?: string): void {
		const component = new ModelSelectorComponent(
			this.ui,
			this.session.model,
			this.settingsManager,
			this.session.modelRegistry,
			this.session.scopedModels || [],
			(model) => {
				this.session.setModel?.(model);
				this.ui.hideOverlay?.();
				this.showStatus?.(`Model: ${model.id}`);
			},
			() => {
				this.ui.hideOverlay?.();
			},
			initialSearchInput
		);
		this.ui.showOverlay?.(component);
	}

	private showTreeSelector(initialSelectedId?: string): void {
		// Get session tree
		const tree = this.sessionManager.getTree?.() ?? [];
		const realLeafId = this.sessionManager.getLeafId?.();
		if (tree.length === 0) {
			this.showStatus?.('No entries in session');
			return;
		}

		// Create tree selector
		const selector = new TreeSelectorComponent(
			tree,
			realLeafId,
			this.ui.terminal.rows,
			async (entryId) => {
				this.ui.hideOverlay?.();
				if (entryId === realLeafId) {
					this.showStatus?.('Already at this point');
					return;
				}
				try {
					const result = await this.session.navigateTree?.(entryId, { summarize: false });
					if (result?.cancelled) {
						this.showStatus?.('Navigation cancelled');
						return;
					}
					// Rebuild chat display
					this.chatContainer.clear?.();
					this.renderInitialMessages?.();
					if (result?.editorText) {
						this.editor.setText?.(result.editorText);
					}
					this.showStatus?.('Navigated to selected point');
				} catch (e: any) {
					this.showError?.(e.message || 'Navigation error');
				}
			},
			() => {
				this.ui.hideOverlay?.();
			},
			undefined, // onLabelChange - optional
			initialSelectedId,
			this.settingsManager.getTreeFilterMode?.() ?? 'default'
		);

		this.ui.showOverlay?.(selector);
	}

	private showThinkingSelector(): void {
		const currentLevel = this.session.thinkingLevel || 'off';
		const availableLevels = this.session.getAvailableThinkingLevels?.() ?? ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'];
		const selector = new ThinkingSelectorComponent(
			currentLevel,
			availableLevels,
			async (level) => {
				this.ui.hideOverlay?.();
				await this.session.setThinkingLevel?.(level);
				this.footer.invalidate?.();
				this.updateEditorBorderColor?.();
				this.showStatus?.(`Thinking level: ${level}`);
			},
			() => {
				this.ui.hideOverlay?.();
			}
		);
		this.ui.showOverlay?.(selector);
	}

	private async showSessionSelector(): Promise<void> {
		// Dynamic import to avoid top-level dependency in tests
		const { SessionManager } = await import('@earendil-works/pi-coding-agent');

		// Loaders for SessionSelectorComponent
		const currentSessionsLoader: any = async (onProgress?: any) => {
			const cwd = this.sessionManager.getCwd?.();
			const sessionDir = this.sessionManager.getSessionDir?.();
			return await SessionManager.list(cwd ?? process.cwd(), sessionDir, onProgress);
		};
		const allSessionsLoader: any = async (onProgress?: any) => {
			return await SessionManager.listAll(onProgress);
		};

		const selector = new SessionSelectorComponent(
			currentSessionsLoader,
			allSessionsLoader,
			async (sessionPath: string) => {
				this.ui.hideOverlay?.();
				const result = await this.handleResumeSession?.(sessionPath);
				if (result?.cancelled) {
					this.showStatus?.('Session switch cancelled');
				}
			},
			() => {
				this.ui.hideOverlay?.();
			},
			() => {
				void this.shutdown?.();
			},
			() => this.ui.requestRender?.(),
			{
				renameSession: async (sessionFilePath: string, newName: string | undefined) => {
					const next = (newName ?? '').trim();
					if (!next) return;
					try {
						const mgr = SessionManager.open(sessionFilePath);
						mgr.appendSessionInfo(next);
					} catch (e) {
						console.error('Rename failed', e);
					}
				},
				showRenameHint: true,
				keybindings: this.keybindings as any,
			},
			this.sessionManager.getSessionFile?.()
		);

		this.ui.showOverlay?.(selector);
	}

	// ============================================================================
	// Settings Selector (simplified)
	// ============================================================================

	private showSettingsSelector(): void {
		// Gather current settings (minimal)
		const transport: any = this.settingsManager.getTransport?.() ?? 'stdio';
		const httpIdleTimeoutMs = this.settingsManager.getHttpIdleTimeoutMs?.() ?? 30000;
		const settings = {
			autoCompact: this.session.autoCompactionEnabled,
			showImages: this.settingsManager.getShowImages?.(),
			imageWidthCells: this.settingsManager.getImageWidthCells?.(),
			autoResizeImages: this.settingsManager.getImageAutoResize?.(),
			blockImages: this.settingsManager.getBlockImages?.(),
			enableSkillCommands: this.settingsManager.getEnableSkillCommands?.(),
			steeringMode: this.session.steeringMode || 'all',
			followUpMode: this.session.followUpMode || 'all',
			transport,
			httpIdleTimeoutMs,
			thinkingLevel: this.session.thinkingLevel || 'off',
			availableThinkingLevels: this.session.getAvailableThinkingLevels?.(),
			currentTheme: this.settingsManager.getTheme?.() ?? 'dark',
			availableThemes: ['dark', 'light'],
			hideThinkingBlock: this.hideThinkingBlock,
			collapseChangelog: this.settingsManager.getCollapseChangelog?.(),
			enableInstallTelemetry: this.settingsManager.getEnableInstallTelemetry?.(),
			doubleEscapeAction: this.settingsManager.getDoubleEscapeAction?.() ?? 'none',
			treeFilterMode: this.settingsManager.getTreeFilterMode?.() ?? 'default',
			showHardwareCursor: this.settingsManager.getShowHardwareCursor?.(),
			editorPaddingX: this.settingsManager.getEditorPaddingX?.(),
			autocompleteMaxVisible: this.settingsManager.getAutocompleteMaxVisible?.(),
			quietStartup: this.settingsManager.getQuietStartup?.(),
			clearOnShrink: this.settingsManager.getClearOnShrink?.(),
			showTerminalProgress: this.settingsManager.getShowTerminalProgress?.(),
			warnings: this.settingsManager.getWarnings?.() ?? {},
		};

		// Create selector with callbacks
		const selector = new SettingsSelectorComponent(settings, {
			onAutoCompactChange: (enabled) => {
				this.session.setAutoCompactionEnabled?.(enabled);
				this.footer.setAutoCompactEnabled?.(enabled);
			},
			onShowImagesChange: (enabled) => {
				this.settingsManager.setShowImages?.(enabled);
				for (const child of this.chatContainer.children) {
					// @ts-ignore
					if (child instanceof ToolExecutionComponent) {
						// @ts-ignore
						child.setShowImages?.(enabled);
					}
				}
			},
			onImageWidthCellsChange: (width) => {
				this.settingsManager.setImageWidthCells?.(width);
				for (const child of this.chatContainer.children) {
					// @ts-ignore
					if (child instanceof ToolExecutionComponent) {
						// @ts-ignore
						child.setImageWidthCells?.(width);
					}
				}
			},
			onAutoResizeImagesChange: (enabled) => {
				this.settingsManager.setImageAutoResize?.(enabled);
			},
			onBlockImagesChange: (blocked) => {
				this.settingsManager.setBlockImages?.(blocked);
			},
			onEnableSkillCommandsChange: (enabled) => {
				this.settingsManager.setEnableSkillCommands?.(enabled);
			},
			onSteeringModeChange: (mode) => {
				this.session.setSteeringMode?.(mode);
			},
			onFollowUpModeChange: (mode) => {
				this.session.setFollowUpMode?.(mode);
			},
			onTransportChange: (newTransport: any) => {
				this.settingsManager.setTransport?.(newTransport);
				// @ts-ignore
				this.session.agent.transport = newTransport;
			},
			onHttpIdleTimeoutMsChange: (timeoutMs) => {
				this.settingsManager.setHttpIdleTimeoutMs?.(timeoutMs);
			},
			onThinkingLevelChange: async (level) => {
				await this.session.setThinkingLevel?.(level);
				this.footer.invalidate?.();
				this.updateEditorBorderColor?.();
			},
			onThemeChange: async (themeName) => {
				this.settingsManager.setTheme?.(themeName);
				await piInitTheme?.();
				this.ui.invalidate?.();
			},

		onHideThinkingBlockChange: (hidden) => {
				this.hideThinkingBlock = hidden;
				this.settingsManager.setHideThinkingBlock?.(hidden);
				// Rebuild chat to apply visibility
				this.chatContainer.clear?.();
				this.renderInitialMessages?.();
				if (this.streamingComponent) {
					// @ts-ignore
					this.streamingComponent.setHideThinkingBlock?.(hidden);
					this.streamingComponent.updateContent?.(this.streamingMessage);
				}
			},
			onCollapseChangelogChange: (collapsed) => {
				this.settingsManager.setCollapseChangelog?.(collapsed);
			},
			onEnableInstallTelemetryChange: (enabled) => {
				this.settingsManager.setEnableInstallTelemetry?.(enabled);
			},
			onQuietStartupChange: (enabled) => {
				this.settingsManager.setQuietStartup?.(enabled);
			},
			onDoubleEscapeActionChange: (action: any) => {
				this.settingsManager.setDoubleEscapeAction?.(action);
			},
			onTreeFilterModeChange: (mode: any) => {
				this.settingsManager.setTreeFilterMode?.(mode);
			},
			onShowHardwareCursorChange: (enabled) => {
				this.settingsManager.setShowHardwareCursor?.(enabled);
				this.ui.setShowHardwareCursor?.(enabled);
			},
			onEditorPaddingXChange: (padding) => {
				this.settingsManager.setEditorPaddingX?.(padding);
				this.defaultEditor.setPaddingX?.(padding);
				if (this.editor !== this.defaultEditor) {
					this.editor.setPaddingX?.(padding);
				}
			},
			onAutocompleteMaxVisibleChange: (max) => {
				this.settingsManager.setAutocompleteMaxVisible?.(max);
				this.defaultEditor.setAutocompleteMaxVisible?.(max);
				if (this.editor !== this.defaultEditor) {
					this.editor.setAutocompleteMaxVisible?.(max);
				}
			},
			onClearOnShrinkChange: (enabled) => {
				this.settingsManager.setClearOnShrink?.(enabled);
				this.ui.setClearOnShrink?.(enabled);
			},
			onShowTerminalProgressChange: (enabled) => {
				this.settingsManager.setShowTerminalProgress?.(enabled);
			},
			onWarningsChange: (warnings) => {
				this.settingsManager.setWarnings?.(warnings);
			},
			onCancel: () => {
				this.ui.requestRender?.();
			},
		});

		// Show selector in editor container
		this.editorContainer.clear?.();
		this.editorContainer.addChild?.(selector);
		this.ui.setFocus?.(selector);
		this.ui.requestRender?.();
	}

	// ============================================================================
	// Hotkeys Selector
	// ============================================================================

	private showHotkeys(): void {
		const config = this.keybindings.getEffectiveConfig();
		const items = Object.entries(config).map(([key, keys]) => {
			const keyDisplay = Array.isArray(keys) ? keys.join(', ') : keys;
			return {
				value: key,
				label: `${keyText(key as any)} (${keyDisplay})`,
				description: '',
			};
		}).sort((a, b) => a.label.localeCompare(b.label));

		const selector = new SelectList(
			items,
			Math.min(items.length, 15),
			{
				selectedPrefix: (t: string) => this.theme().fg('accent', '►'),
				selectedText: (t: string) => this.theme().fg('accent', t),
				description: (t: string) => this.theme().fg('dim', t),
				scrollInfo: (t: string) => this.theme().fg('muted', t),
				noMatch: (t: string) => this.theme().fg('warning', t),
			}
		);
		selector.onSelect = () => {}; // no-op, just view
		selector.onCancel = () => {
			this.ui.hideOverlay?.();
		};

		this.ui.showOverlay?.(selector);
	}

	// ============================================================================
	// Session & Startup
	// ============================================================================

	private applyRuntimeSettings(): void {
		// Http dispatcher configuration is handled by the session/agent automatically.
		// configureHttpDispatcher(this.settingsManager.getHttpIdleTimeoutMs?.());
		this.footer.setSession?.(this.session);
		this.footer.setAutoCompactEnabled?.(this.session.autoCompactionEnabled);
		this.footerDataProvider.setCwd?.(this.sessionManager.getCwd?.());
		this.hideThinkingBlock = this.settingsManager.getHideThinkingBlock?.();
		this.ui.setShowHardwareCursor?.(this.settingsManager.getShowHardwareCursor?.());
		this.ui.setClearOnShrink?.(this.settingsManager.getClearOnShrink?.());
		const editorPaddingX = this.settingsManager.getEditorPaddingX?.();
		const autocompleteMaxVisible = this.settingsManager.getAutocompleteMaxVisible?.();
		this.defaultEditor.setPaddingX?.(editorPaddingX);
		this.defaultEditor.setAutocompleteMaxVisible?.(autocompleteMaxVisible);
		if (this.editor !== this.defaultEditor) {
			this.editor.setPaddingX?.(editorPaddingX);
			this.editor.setAutocompleteMaxVisible?.(autocompleteMaxVisible);
		}
	}

	private async rebindCurrentSession(): Promise<void> {
		// Unsubscribe previous and re-subscribe to new session events
		this.unsubscribe?.();
		this.applyRuntimeSettings?.();
		// Rebind extensions for the new session
		await this.bindCurrentSessionExtensions?.();
		this.subscribeToAgent?.();
		await this.updateAvailableProviderCount?.();
		this.updateEditorBorderColor?.();
		this.updateTerminalTitle?.();
	}

	private renderCurrentSessionState(): void {
		this.chatContainer.clear?.();
		this.pendingMessagesContainer.clear?.();
		this.compactionQueuedMessages = [];
		this.streamingComponent = undefined;
		this.streamingMessage = undefined;
		this.pendingTools.clear?.();
		this.renderInitialMessages?.();
	}

	/**
	 * Rebuild chat from current session messages.
	 * Used after compaction or navigation.
	 */
	private rebuildChatFromMessages(): void {
		this.chatContainer.clear?.();
		const context = this.sessionManager.buildSessionContext?.() ?? { messages: this.session.state?.messages ?? [] };
		if (context.messages?.length > 0) {
			this.renderSessionContext(context);
		}
		this.ui.requestRender?.();
	}

	/**
	 * Render session context with full tool handling.
	 */
	private renderSessionContext(
		sessionContext: any,
		options: { updateFooter?: boolean; populateHistory?: boolean } = {},
	): void {
		this.pendingTools.clear?.();
		const renderedPendingTools = new Map<string, any>();

		if (options.updateFooter) {
			this.footer.invalidate?.();
			this.updateEditorBorderColor?.();
		}

		for (const message of sessionContext.messages ?? []) {
			if (message.role === 'assistant') {
				this.addMessageToChat(message);
				// Render tool call components
				for (const content of message.content ?? []) {
					if (content.type === 'toolCall') {
						const component = new ToolExecutionComponent(
							content.name,
							content.id,
							content.arguments,
							{
								showImages: this.settingsManager.getShowImages?.(),
								imageWidthCells: this.settingsManager.getImageWidthCells?.(),
							},
							this.getRegisteredToolDefinition?.(content.name),
							this.ui,
							this.sessionManager.getCwd?.(),
						);
						component.setExpanded?.(this.toolOutputExpanded);
						this.chatContainer.addChild?.(component);

						if (message.stopReason === 'aborted' || message.stopReason === 'error') {
							let errorMessage: string;
							if (message.stopReason === 'aborted') {
								const retryAttempt = this.session.retryAttempt ?? 0;
								errorMessage =
									retryAttempt > 0
										? `Aborted after ${retryAttempt} retry attempt${retryAttempt > 1 ? 's' : ''}`
										: 'Operation aborted';
							} else {
								errorMessage = message.errorMessage || 'Error';
							}
							component.updateResult?.(
								{ content: [{ type: 'text', text: errorMessage }], isError: true },
								false,
							);
						} else {
							renderedPendingTools.set(content.id, component);
						}
					}
				}
			} else if (message.role === 'toolResult') {
				const component = renderedPendingTools.get(message.toolCallId);
				if (component) {
					component.updateResult?.(message);
					renderedPendingTools.delete(message.toolCallId);
				}
			} else {
				this.addMessageToChat(message, options);
				if (options.populateHistory && message.role === 'user') {
					this.editor.addToHistory?.(this.getUserMessageText?.(message));
				}
			}
		}

		for (const [, component] of renderedPendingTools) {
			this.pendingTools.set?.(component.toolCallId, component);
		}
		this.ui.requestRender?.();
	}

	private showStartupNotices(): void {
		if (!this.changelogMarkdown) return;
		const th = this.theme();
		if (this.chatContainer.children.length > 0) this.chatContainer.addChild?.(new Spacer(1));
		this.chatContainer.addChild?.(new DynamicBorder());
		this.chatContainer.addChild?.(new Text(th.bold(th.fg('accent', "What's New")), 1, 0));
		this.chatContainer.addChild?.(new Spacer(1));
		const mdTheme = getMarkdownTheme?.();
		this.chatContainer.addChild?.(new Markdown(this.changelogMarkdown, 1, 0, mdTheme));
		this.chatContainer.addChild?.(new DynamicBorder());
		this.ui.requestRender?.();
	}

	// ============================================================================
	// Command Handlers (Basic)
	// ============================================================================

	private async handleClearCommand(): Promise<void> {
		this.chatContainer.clear?.();
	}

	private async handleModelCommand(command: string): Promise<void> {
		const parts = command.trim().split(/\s+/);
		if (parts.length === 1) {
			const result = await this.session.cycleModel?.();
			if (result?.model) {
				this.showStatus?.(`Model: ${result.model.id}`);
			} else {
				this.showStatus?.('No models available');
			}
			return;
		}
		const spec = parts.slice(1).join(' ');
		const models = await this.session.modelRegistry.getAvailable?.() ?? [];
		let target: any = null;
		target = models.find((m: any) => m.id === spec);
		if (!target && spec.includes('/')) {
			const [provider, id] = spec.split('/');
			if (provider && id) {
				target = models.find((m: any) => m.provider === provider && m.id === id);
			}
		}
		if (target) {
			if (this.session.setModel) {
				await this.session.setModel(target);
			}
			// Directly assign to runtimeHost.session.model to ensure visibility
			(this.runtimeHost as any).session.model = target;
			this.showStatus?.(`Model: ${target.id}`);
		} else {
			this.showError?.(`Model not found: ${spec}`);
		}
	}

	private async handleModelsCommand(): Promise<void> {
		// Show model selector
		await this.showModelSelector?.();
	}

	// ============================================================================
	// Additional Slash Command Handlers
	// ============================================================================

	private async reloadResources(): Promise<void> {
		try {
			await this.session.reload?.();
			this.showStatus?.('Extensions reloaded');
		} catch (e: any) {
			console.error('Reload error:', e);
			this.showError?.(`Reload failed: ${e.message}`);
		}
	}

	private showChangelog(): void {
		if (this.changelogMarkdown) {
			if (this.chatContainer.children.length > 0) this.chatContainer.addChild?.(new Spacer(1));
			this.chatContainer.addChild?.(new DynamicBorder());
			const th = this.theme();
			this.chatContainer.addChild?.(new Text(th.bold(th.fg('accent', "Changelog")), 1, 0));
			this.chatContainer.addChild?.(new Spacer(1));
			const mdTheme = getMarkdownTheme?.();
			this.chatContainer.addChild?.(new Markdown(this.changelogMarkdown, 1, 0, mdTheme));
			this.chatContainer.addChild?.(new DynamicBorder());
			this.ui.requestRender?.();
		} else {
			this.showStatus?.('No changelog available');
		}
	}

	private showLoadedResources(options?: { force?: boolean; showDiagnosticsWhenQuiet?: boolean }): void {
		try {
			const quietStartup = this.settingsManager.getQuietStartup?.() ?? false;
			const persisted = this.sessionManager.isPersisted?.() ?? false;
			const show = (options?.force ?? false) || !quietStartup || persisted || options?.showDiagnosticsWhenQuiet;
			if (!show) return;

			const skills = this.session.resourceLoader.getSkills?.()?.skills ?? [];
			const prompts = this.session.resourceLoader.getPrompts?.()?.prompts ?? [];
			const extensions = this.session.resourceLoader.getExtensions?.()?.extensions ?? [];
			const themes = this.session.resourceLoader.getThemes?.()?.themes ?? [];
			const diagnostics = this.session.resourceLoader.getDiagnostics?.() ?? [];

			const lines: string[] = [];
			if (skills.length) lines.push(`Skills: ${skills.length}`);
			if (prompts.length) lines.push(`Prompts: ${prompts.length}`);
			if (extensions.length) lines.push(`Extensions: ${extensions.length}`);
			if (themes.length) lines.push(`Themes: ${themes.length}`);
			const text = lines.length ? lines.join('\n') : 'No resources loaded';

			if (this.chatContainer.children.length > 0) this.chatContainer.addChild?.(new Spacer(1));

			// Show title if diagnostics or extensions
			if (diagnostics.length > 0 || extensions.length > 0) {
				const th = this.theme();
				this.chatContainer.addChild?.(new DynamicBorder());
				this.chatContainer.addChild?.(new Text(th.bold(th.fg('warning', 'Loaded Resources')), 1, 0));
				this.chatContainer.addChild?.(new Spacer(1));
				if (diagnostics.length > 0) {
					diagnostics.forEach((diag: any) => {
						const msg = `[${diag.type}] ${diag.message}`;
						this.chatContainer.addChild?.(new Text(msg, 1, 0));
					});
					this.chatContainer.addChild?.(new Spacer(1));
				}
				this.chatContainer.addChild?.(new Text(text, 1, 0));
				this.chatContainer.addChild?.(new DynamicBorder());
			} else {
				this.chatContainer.addChild?.(new Text(text, 1, 0));
			}
			this.ui.requestRender?.();
		} catch (e) {
			console.error('Error loading resources', e);
			this.showError?.('Failed to load resources');
		}
	}

	private renameSession(name: string): void {
		try {
			this.sessionManager.appendSessionInfo?.(name);
			this.showStatus?.(`Session renamed to: ${name}`);
		} catch (e: any) {
			this.showError?.(`Rename failed: ${e.message}`);
		}
	}

	private async handleCopyCommand(): Promise<void> {
		const state = this.session.state as { messages?: any[] };
		const messages = state.messages || [];
		// Find last assistant message
		for (let i = messages.length - 1; i >= 0; i--) {
			const msg = messages[i];
			if (msg.role === 'assistant') {
				const text = this.getAssistantMessageText?.(msg);
				if (text) {
					try {
						await copyToClipboard(text);
						this.showStatus?.('Copied to clipboard');
					} catch (e: any) {
						this.showError?.(`Copy failed: ${e.message}`);
					}
					return;
				}
			}
		}
		this.showWarning?.('No assistant message to copy');
	}

	private async handlePasteCommand(): Promise<void> {
		try {
			const result = await readClipboardImage();
			if (!result) {
				this.showWarning?.('No image in clipboard');
				return;
			}
			// Convert to data URL
			const base64 = Buffer.from(result.bytes).toString('base64');
			const dataUrl = `data:${result.mimeType};base64,${base64}`;
			const markdown = `\n![clipboard](${dataUrl})\n`;
			const currentText = this.editor.getText?.() ?? '';
			this.editor.setText?.(currentText + markdown);
			this.showStatus?.('Image pasted from clipboard');
		} catch (e: any) {
			this.showError?.(`Paste failed: ${e.message}`);
		}
	}

	private async cloneSession(newName: string): Promise<void> {
		const leafId = this.sessionManager.getLeafId?.();
		if (!leafId) {
			this.showError?.('No current entry to clone');
			return;
		}
		try {
			const result = await this.runtimeHost.fork?.(leafId, { position: 'at' });
			if (result?.cancelled) {
				this.showStatus?.('Clone cancelled');
				return;
			}
			// After fork, the runtimeHost.session points to new session; optionally rename
			if (newName) {
				this.sessionManager.appendSessionInfo?.(newName);
			}
			// Refresh UI
			this.chatContainer.clear?.();
			this.renderCurrentSessionState?.();
			this.editor.setText?.('');
			this.showStatus?.(`Session cloned${newName ? ` as ${newName}` : ''}`);
		} catch (e: any) {
			console.error('Clone error:', e);
			this.showError?.(`Clone failed: ${e.message}`);
		}
	}

	private async forkSession(newName: string): Promise<void> {
		const leafId = this.sessionManager.getLeafId?.();
		if (!leafId) {
			this.showError?.('No entry to fork from');
			return;
		}
		try {
			const result = await this.runtimeHost.fork?.(leafId);
			if (result?.cancelled) {
				this.showStatus?.('Fork cancelled');
				return;
			}
			if (newName) {
				this.sessionManager.appendSessionInfo?.(newName);
			}
			this.chatContainer.clear?.();
			this.renderCurrentSessionState?.();
			this.editor.setText?.('');
			this.showStatus?.(`Session forked${newName ? ` as ${newName}` : ''}`);
		} catch (e: any) {
			console.error('Fork error:', e);
			this.showError?.(`Fork failed: ${e.message}`);
		}
	}

	private exportSession(filePath?: string): void {
		try {
			const entries = this.sessionManager.getEntries?.();
			const header = this.sessionManager.getHeader?.();
			if (!header) {
				this.showError?.('No session header to export');
				return;
			}
			const data = {
				version: header.version,
				header,
				entries,
			};
			const defaultName = `session-${header.id}-${new Date().toISOString().slice(0,10)}.json`;
			const targetPath = filePath || defaultName;
			fs.writeFileSync(targetPath, JSON.stringify(data, null, 2));
			this.showStatus?.(`Exported session to: ${targetPath}`);
		} catch (e: any) {
			console.error('Export error:', e);
			this.showError?.(`Export failed: ${e.message}`);
		}
	}

	private importSession(filePath: string): void {
		// Basic stub: would read file, validate, and switch session
		this.showStatus?.(`Import not implemented: ${filePath}`);
	}

	private toggleDebug(): void {
		// Gather debug info
		const th = this.theme();
		const lines: string[] = [];
		lines.push(`${th.bold(th.fg('accent', 'Debug Info'))}`);
		lines.push(`Version: ${VERSION}`);
		lines.push(`CWD: ${this.sessionManager.getCwd?.()}`);
		lines.push(`Session ID: ${this.session.sessionId}`);
		lines.push(`Session File: ${this.sessionManager.getSessionFile?.() || 'not saved'}`);
		lines.push(`Model: ${this.session.model?.id || 'none'}`);
		lines.push(`Thinking Level: ${this.session.thinkingLevel || 'off'}`);
		lines.push(`Auto Compaction: ${this.session.autoCompactionEnabled}`);
		lines.push(`Steering Mode: ${this.session.steeringMode}`);
		lines.push(`Follow-up Mode: ${this.session.followUpMode}`);
		try {
			const skills = this.session.resourceLoader.getSkills?.()?.skills ?? [];
			const prompts = this.session.resourceLoader.getPrompts?.()?.prompts ?? [];
			const extensions = this.session.resourceLoader.getExtensions?.()?.extensions ?? [];
			lines.push(`Skills: ${skills.length}`);
			lines.push(`Prompts: ${prompts.length}`);
			lines.push(`Extensions: ${extensions.length}`);
		} catch (e) {
			lines.push(`Resources: error loading`);
		}
		const debugText = lines.join('\n');
		// Show in overlay or chat
		if (this.chatContainer.children.length > 0) this.chatContainer.addChild?.(new Spacer(1));
		this.chatContainer.addChild?.(new DynamicBorder());
		this.chatContainer.addChild?.(new Text(th.bold(th.fg('warning', 'Debug Info')), 1, 0));
		this.chatContainer.addChild?.(new Spacer(1));
		this.chatContainer.addChild?.(new Text(debugText, 1, 0));
		this.chatContainer.addChild?.(new DynamicBorder());
		this.ui.requestRender?.();
	}

	/** Execute a bash command string (internal) */
	private async executeBash(command: string, exclude: boolean): Promise<void> {
		// Null byte check
		if (command.includes('\0')) {
			this.showError?.('Command contains null bytes');
			return;
		}
		// Dangerous pattern warning
		if (/rm\s+-rf\s+\//.test(command)) {
			console.warn('Security warning: potentially dangerous command', command);
		}

		const bashComponent = new BashExecutionComponent(command, this.ui, exclude);
		this.chatContainer.addChild?.(bashComponent);
		this.ui.requestRender?.();

		try {
			// Use AgentSession's executeBash with streaming callback
			const result = await this.session.executeBash(
				command,
				(chunk: string) => {
					bashComponent.appendOutput(chunk);
					this.ui.requestRender?.();
				},
				{ excludeFromContext: exclude }
			);

			// Build TruncationResult from result
			const outputLines = result.output.split('\n');
			const outputBytes = Buffer.byteLength(result.output, 'utf8');
			const truncationResult: TruncationResult = {
				content: result.output,
				truncated: result.truncated,
				truncatedBy: result.truncated ? 'bytes' : null,
				totalLines: outputLines.length,
				totalBytes: outputBytes,
				outputLines,
				outputBytes,
				lastLinePartial: false,
				firstLineExceedsLimit: false,
				maxLines: DEFAULT_MAX_LINES,
				maxBytes: DEFAULT_MAX_BYTES,
			};

			bashComponent.setComplete(result.exitCode, result.cancelled, truncationResult, result.fullOutputPath);
			this.ui.requestRender?.();
			// Clear editor after successful execution
			this.defaultEditor.setText?.('');
		} catch (e: any) {
			console.error('BashCommandError:', command, e);
			this.showError?.(`Bash error: ${e.message}`);
		}
	}

	/** Handle bash command from editor (reads text) */
	private async handleBash(exclude: boolean): Promise<void> {
		const text = this.defaultEditor.getText?.()?.trim() || '';
		if (!text) return;
		await this.executeBash?.(text, exclude);
	}

	/** Display an error message in chat */
	private showError(errorMessage: string): void {
		this.chatContainer.addChild?.(new Spacer(1));
		this.chatContainer.addChild?.(new Text(this.theme().fg('error', `Error: ${errorMessage}`), 1, 0));
		this.ui.requestRender?.();
	}

	/** Display a status message (dim) in chat */
	private showStatus(message: string): void {
		const children = this.chatContainer.children;
		const last = children.length > 0 ? children[children.length - 1] : undefined;
		const secondLast = children.length > 1 ? children[children.length - 2] : undefined;
		if (last && secondLast && last === this.lastStatusText && secondLast === this.lastStatusSpacer) {
			// Update existing status line
			// @ts-ignore - Text component has setText
			last.setText?.(this.theme().fg('dim', message));
			this.ui.requestRender?.();
			return;
		}
		const spacer = new Spacer(1);
		const text = new Text(this.theme().fg('dim', message), 1, 0);
		this.chatContainer.addChild?.(spacer);
		this.chatContainer.addChild?.(text);
		this.lastStatusSpacer = spacer;
		this.lastStatusText = text;
		this.ui.requestRender?.();
	}

	/** Display a warning message in chat */
	private showWarning(warningMessage: string): void {
		this.chatContainer.addChild?.(new Spacer(1));
		this.chatContainer.addChild?.(new Text(this.theme().fg('warning', `Warning: ${warningMessage}`), 1, 0));
		this.ui.requestRender?.();
	}

	private showNewVersionNotification(version: string): void {
		const th = this.theme();
		const action = th.fg('accent', `${APP_NAME} update`);
		const updateInstruction = th.fg('muted', `New version ${version} is available. Run `) + action;
		this.chatContainer.addChild?.(new Spacer(1));
		this.chatContainer.addChild?.(new Text(`${th.bold(th.fg('warning', 'Update Available'))}\n${updateInstruction}`, 1, 0));
		this.ui.requestRender?.();
	}

	/** Display loaded extensions/resources summary */
	private updateTerminalTitle(): void {
		const cwdBasename = path.basename(this.sessionManager.getCwd?.());
		const sessionName = this.sessionManager.getSessionName?.();
		this.ui?.terminal?.setTitle?.(sessionName ? `${APP_TITLE} - ${sessionName} - ${cwdBasename}` : `${APP_TITLE} - ${cwdBasename}`);
	}

	private async updateAvailableProviderCount(): Promise<void> {
		let models: any[] = [];
		if (this.session.scopedModels?.length > 0) {
			models = this.session.scopedModels.map((sm: any) => sm.model);
		} else {
			this.session.modelRegistry?.refresh?.();
			try {
				models = await this.session.modelRegistry?.getAvailable?.() ?? [];
			} catch {
				models = [];
			}
		}
		const uniqueProviders = new Set(models.map((m: any) => m.provider));
		this.footerDataProvider.setAvailableProviderCount?.(uniqueProviders.size);
	}

	private maybeWarnAboutAnthropicSubscriptionAuth(): void {
		// Stub
	}

	/** Graceful shutdown */
	private async shutdown(exitCode = 0): Promise<void> {
		if (this.shutdownRequested) {
			process.exit(exitCode);
			return;
		}
		this.shutdownRequested = true;
		// Unsubscribe from agent events
		this.unsubscribe?.();
		// Stop UI
		await this.ui?.stop?.();
		// Dispose footer component
		this.footer?.dispose?.();
		// Cleanup signal handlers
		for (const cleanup of this.signalCleanupHandlers) cleanup();
		this.signalCleanupHandlers = [];
		// Finally exit
		process.exit(exitCode);
	}

	private async checkShutdownRequested(): Promise<void> {
		if (this.shutdownRequested) {
			await this.shutdown?.();
		}
	}

  /** Register signal handlers for graceful shutdown */
  private registerSignalHandlers(): void {
    const sigintHandler = () => {
      killTrackedDetachedChildren();
      void this.shutdown(0);
    };
    process.on('SIGINT', sigintHandler);
    this.signalCleanupHandlers.push(() => process.off('SIGINT', sigintHandler));

    const sigtermHandler = () => {
      killTrackedDetachedChildren();
      void this.shutdown(143);
    };
    process.on('SIGTERM', sigtermHandler);
    this.signalCleanupHandlers.push(() => process.off('SIGTERM', sigtermHandler));

    if (process.platform !== 'win32') {
      const sighupHandler = () => {
        killTrackedDetachedChildren();
        void this.shutdown(143);
      };
      process.on('SIGHUP', sighupHandler);
      this.signalCleanupHandlers.push(() => process.off('SIGHUP', sighupHandler));
    }
  }
}

export async function runInteractiveMode(runtime: AgentSessionRuntime): Promise<void> {
	await new InteractiveMode(runtime).run?.();
}

export const setupShutdownHandlers = () => {};

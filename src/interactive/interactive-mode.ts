/**
 * InteractiveMode for Evo Agent - Minimal Viable Version
 * Orchestrates TUI UI, input, and agent interaction.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'child_process';
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import { CombinedAutocompleteProvider, Container, Loader, Markdown, ProcessTerminal, Spacer, Text, TUI, setKeybindings, matchesKey } from '@earendil-works/pi-tui';
import {
	APP_NAME,
	APP_TITLE,
	VERSION,
	getAgentDir,
	getDebugLogPath,
} from '../config.js';
import type { AgentSessionRuntime } from '@earendil-works/pi-coding-agent';
import { FooterComponent, CustomEditor, UserMessageComponent, AssistantMessageComponent, BashExecutionComponent, ToolExecutionComponent, DynamicBorder, ModelSelectorComponent, SettingsSelectorComponent, ThinkingSelectorComponent, SessionSelectorComponent, TreeSelectorComponent, keyHint, keyText, rawKeyHint, getMarkdownTheme, initTheme as piInitTheme } from '@earendil-works/pi-coding-agent';
import { FooterDataProvider } from '../runtime/footer-data-provider.js';
import { KeybindingsManager } from '../runtime/keybindings-manager.js';
import { getChangelogPath, parseChangelog, getNewEntries } from '../utils/changelog.js';
import { killTrackedDetachedChildren } from '../utils/shell.js';
import { checkForNewPiVersion } from '../utils/version-check.js';
import { ExpandableText } from './components/expandable-text.js';
import { theme } from './theme/theme.js';

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
	{ name: 'reload', description: 'Reload extensions' },
];

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


		// TUI
		this.ui = new TUI(new ProcessTerminal(), this.settingsManager.getShowHardwareCursor?.() ?? true);
		this.ui.setClearOnShrink?.(this.settingsManager.getClearOnShrink?.() ?? true);

		// Editor
		const editorTheme: any = {
			borderColor: (s: string) => this.theme().fg('border', s),
			selectList: { selected: (t: string) => t, active: (t: string) => t, disabled: (t: string) => t },
		};
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
		this.bindCurrentSessionExtensions?.();

		// Start
		this.ui.start?.();
		// Subscribe to agent events
		this.subscribeToAgent?.();
		this.isInitialized = true;

		// Bind extensions
		void this.rebindCurrentSession?.();

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

	private theme(): any {
		try {
			const pkg = require('@earendil-works/pi-coding-agent');
			return pkg.theme;
		} catch {
			return { bold: (t: string) => t, fg: (_: string, t: string) => t, dim: (t: string) => t };
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
				// TODO: reload extensions
				this.showStatus?.('Reload not implemented');
				break;
			case '/hotkeys':
				// TODO: show hotkeys
				this.showStatus?.('Hotkeys not implemented');
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

	/** Bind session extensions including autocomplete provider */
	private bindCurrentSessionExtensions(): void {
		// Build slash command list for autocomplete
		const slashCommands = BUILTIN_SLASH_COMMANDS.map((cmd: any) => ({
			value: cmd.name,
			label: cmd.name,
			description: cmd.description,
		}));
		// @ts-ignore: CombinedAutocompleteProvider expects provider implementations
		const autocompleteProvider = new CombinedAutocompleteProvider(
			slashCommands,
			this.sessionManager.getCwd?.() ?? process.cwd(),
			this.fdPath || null
		);
		this.defaultEditor.setAutocompleteProvider?.(autocompleteProvider);
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

	private showStatus(message: string): void {
		const children = this.chatContainer.children;
		const last = children[children.length - 1];
		const secondLast = children[children.length - 2];
		if (last && secondLast && last === this.lastStatusText && secondLast === this.lastStatusSpacer) {
			(last as Text).setText?.(this.theme().fg('dim', message));
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

	private showError(message: string): void {
		this.chatContainer.addChild?.(new Spacer(1));
		this.chatContainer.addChild?.(new Text(this.theme().fg('error', `Error: ${message}`), 1, 0));
		this.ui.requestRender?.();
	}

	private showWarning(message: string): void {
		this.chatContainer.addChild?.(new Spacer(1));
		this.chatContainer.addChild?.(new Text(this.theme().fg('warning', `Warning: ${message}`), 1, 0));
		this.ui.requestRender?.();
	}

	private getMarkdownThemeWithSettings(): any {
		const base = getMarkdownTheme?.() ?? {};
		return { ...base, codeBlockIndent: this.settingsManager.getCodeBlockIndent?.() ?? 2 };
	}

	/** Get the current theme object */
	private theme(): any {
		return theme();
	}

	private updateEditorBorderColor(): void {
		const level = this.session.thinkingLevel || 'off';
		const colors: Record<string, string> = { off: 'border', minimal: 'dim', low: 'accent', medium: 'warning', high: 'error', xhigh: 'error' };
		this.editor.borderColor = this.theme().fg(colors[level] ?? 'border', '#');
		this.ui.requestRender?.();
	}

	private renderInitialMessages(): void {
		const state = this.session.state as { messages?: any[] };
		const messages = state.messages || [];
		for (const msg of messages) {
			if (msg.role === 'user') {
				const textContent = this.getUserMessageText?.(msg);
				this.chatContainer.addChild?.(new UserMessageComponent(textContent, this.getMarkdownThemeWithSettings?.()));
			} else if (msg.role === 'assistant') {
				this.chatContainer.addChild?.(new AssistantMessageComponent(msg, false, this.getMarkdownThemeWithSettings?.()));
			}
		}
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

	private registerSignalHandlers(): void {
		const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
		for (const sig of signals) {
			const handler = () => { killTrackedDetachedChildren?.(); void this.shutdown?.(); };
			process.on(sig, handler);
			this.signalCleanupHandlers.push(() => process.off(sig, handler));
		}
	}

	private async shutdown(): Promise<void> {
		this.shutdownRequested = true;
		this.unregisterSignalHandlers?.();
		this.unsubscribe?.();
		this.ui.stop?.();
		process.exit(0);
	}

	private unregisterSignalHandlers(): void {
		for (const cleanup of this.signalCleanupHandlers) cleanup();
		this.signalCleanupHandlers.length = 0;
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
				this.showWorkingIndicator?.();
				break;
			case 'agent_end':
			case 'turn_end':
				this.stopWorkingLoader?.();
				if (this.settingsManager.getShowTerminalProgress?.()) this.ui.terminal.setProgress?.(false);
				await this.checkShutdownRequested?.();
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
					this.ui.requestRender?.();
				}
				break;
			case 'message_update':
				if (this.streamingComponent && event.message?.role === 'assistant') {
					this.streamingMessage = event.message;
					this.streamingComponent.updateContent?.(this.streamingMessage);
					this.ui.requestRender?.();
				}
				break;
			case 'message_end': {
				const msg = event.message;
				if (msg?.role === 'assistant') {
					if (this.streamingComponent) {
						this.streamingComponent.updateContent?.(msg);
						this.streamingComponent = undefined;
						this.streamingMessage = undefined;
					} else {
						this.chatContainer.addChild?.(new AssistantMessageComponent(msg, false, this.getMarkdownThemeWithSettings?.()));
					}
					this.footer.invalidate?.();
					this.ui.requestRender?.();
				}
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

	private addMessageToChat(message: any): void {
		if (message.role === 'user') {
			const textContent = this.getUserMessageText?.(message);
			if (textContent) {
				if (this.chatContainer.children.length > 0) this.chatContainer.addChild?.(new Spacer(1));
				this.chatContainer.addChild?.(new UserMessageComponent(textContent, this.getMarkdownThemeWithSettings?.()));
			}
		} else if (message.role === 'assistant') {
			const comp = new AssistantMessageComponent(message, this.hideThinkingBlock, this.getMarkdownThemeWithSettings?.());
			this.chatContainer.addChild?.(comp);
		}
	}

	private getUserMessageText(message: any): string {
		if (message.role !== 'user') return '';
		if (typeof message.content === 'string') return message.content;
		const textParts = (message.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text);
		return textParts.join('\n');
	}

	private getRegisteredToolDefinition(toolName: string): any {
		return this.session.getToolDefinition?.(toolName);
	}

	private updatePendingMessagesDisplay(): void {
		// Minimal: no queue support yet
		this.pendingMessagesContainer.clear?.();
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
				try {
					const result = await this.runtimeHost.switchSession?.(sessionPath);
					if (result?.cancelled) {
						this.showStatus?.('Session switch cancelled');
						return;
					}
					// Re-render chat with new session
					this.chatContainer.clear?.();
					this.renderInitialMessages?.();
					this.editor.setText?.('');
					this.showStatus?.(`Resumed session: ${sessionPath}`);
				} catch (e: any) {
					this.showError?.(e.message || 'Session switch error');
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
	// Session & Startup
	// ============================================================================

	private rebindCurrentSession(): Promise<void> {
		// Stub: will implement full extension binding later
		return Promise.resolve();
	}

	private renderCurrentSessionState(): void {
		this.chatContainer.clear?.();
		this.renderInitialMessages?.();
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

		try {
			const result = spawnSync(command, { shell: true, encoding: 'utf8' });
			const output = result.stdout || result.stderr || '';
			const BashComp = BashExecutionComponent as any;
			const bashComponent = new BashComp(command, this.ui, exclude);
			bashComponent.appendOutput?.(output);
			bashComponent.setComplete?.(result.status ?? 0, false, undefined, undefined);
			this.chatContainer.addChild?.(bashComponent);
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
	private async showLoadedResources(): Promise<void> {
		try {
			const skills = this.session.resourceLoader.getSkills?.()?.skills ?? [];
			const prompts = this.session.resourceLoader.getPrompts?.()?.prompts ?? [];
			const extensions = this.session.resourceLoader.getExtensions?.()?.extensions ?? [];
			const themes = this.session.resourceLoader.getThemes?.()?.themes ?? [];
			const lines: string[] = [];
			if (skills.length) lines.push(`Skills: ${skills.map((s: any) => s.name).join(', ')}`);
			if (prompts.length) lines.push(`Prompts: ${prompts.map((p: any) => p.name).join(', ')}`);
			if (extensions.length) lines.push(`Extensions: ${extensions.map((e: any) => e.name).join(', ')}`);
			if (themes.length) lines.push(`Themes: ${themes.join(', ')}`);
			const text = lines.length ? lines.join('\n') : 'No resources loaded';
			this.chatContainer.addChild?.(new Text(text, 1, 0));
			this.ui.requestRender?.();
		} catch (e) {
			console.error('Error loading resources', e);
			this.showError?.('Failed to load resources');
		}
	}

	private updateTerminalTitle(): void {
		const cwdBasename = path.basename(this.sessionManager.getCwd?.());
		const sessionName = this.sessionManager.getSessionName?.();
		if (sessionName) this.ui.terminal.setTitle?.(`${APP_TITLE} - ${sessionName} - ${cwdBasename}`);
		else this.ui.terminal.setTitle?.(`${APP_TITLE} - ${cwdBasename}`);
	}

	private async updateAvailableProviderCount(): Promise<void> {
		// Stub
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

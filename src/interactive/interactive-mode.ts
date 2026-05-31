/**
 * InteractiveMode for Evo Agent - Minimal Viable Version
 * Orchestrates TUI UI, input, and agent interaction.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import { CombinedAutocompleteProvider, Container, Loader, Markdown, ProcessTerminal, Spacer, Text, TUI, setKeybindings } from '@earendil-works/pi-tui';
import {
	APP_NAME,
	APP_TITLE,
	VERSION,
	getAgentDir,
	getDebugLogPath,
} from '../config.js';
import type { AgentSessionRuntime } from '@earendil-works/pi-coding-agent';
import { FooterComponent, CustomEditor, UserMessageComponent, AssistantMessageComponent, BashExecutionComponent, ToolExecutionComponent, DynamicBorder, keyHint, keyText, rawKeyHint, getMarkdownTheme, initTheme as piInitTheme } from '@earendil-works/pi-coding-agent';
import { FooterDataProvider } from '../runtime/footer-data-provider.js';
import { KeybindingsManager } from '../runtime/keybindings-manager.js';
import { getChangelogPath, parseChangelog, getNewEntries } from '../utils/changelog.js';
import { killTrackedDetachedChildren } from '../utils/shell.js';
import { ensureTool } from '../utils/tools-manager.js';
import { checkForNewPiVersion } from '../utils/version-check.js';
import { ExpandableText } from './components/expandable-text.js';

// Minimal slash commands (since package may not export directly)
const BUILTIN_SLASH_COMMANDS = [
	{ name: 'clear', description: 'Clear chat' },
	{ name: 'exit', description: 'Exit' },
	{ name: 'quit', description: 'Exit' },
	{ name: 'compact', description: 'Compact session' },
	{ name: 'model', description: 'Cycle or select model' },
	{ name: 'thinking', description: 'Select thinking level' },
	{ name: 'models', description: 'Open model selector' },
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

		// Ensure tools
		try {
			this.fdPath = await ensureTool('fd');
		} catch (e) {
			console.warn('fd not available for autocomplete');
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

		// Simple autocomplete with slash commands only
		const slashCommands = BUILTIN_SLASH_COMMANDS.map((cmd: any) => ({ value: cmd.name, label: cmd.name, description: cmd.description }));
		// @ts-ignore
		const autocompleteProvider = new CombinedAutocompleteProvider(slashCommands, this.sessionManager.getCwd?.() ?? process.cwd(), this.fdPath || null);
		this.defaultEditor.setAutocompleteProvider?.(autocompleteProvider);

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

		// Start
		this.ui.start?.();
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
		const self = this;
		this.defaultEditor.onSubmit = async (text: string) => {
			text = text.trim();
			if (!text) return;

			if (text === '/clear' || text === '/new') {
				this.handleClearCommand?.();
				this.editor.setText?.('');
				return;
			}
			if (text === '/exit' || text === '/quit') {
				void this.shutdown?.();
				return;
			}
			if (text.startsWith('/model')) {
				this.editor.setText?.('');
				await this.handleModelCommand?.(text);
				return;
			}
			if (text.startsWith('!')) {
				const isExcluded = text.startsWith('!!');
				const cmd = isExcluded ? text.slice(2).trim() : text.slice(1).trim();
				if (cmd) {
					this.editor.addToHistory?.(text);
					await this.handleBashCommand?.(cmd, isExcluded);
				}
				return;
			}

			this.chatContainer.addChild?.(new UserMessageComponent(text, this.getMarkdownThemeWithSettings?.()));
			try {
				await this.session.prompt?.(text);
			} catch (error: any) {
				this.showError?.(error?.message || 'Error');
			}
		};
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
				this.chatContainer.addChild?.(new UserMessageComponent(msg.content, this.getMarkdownThemeWithSettings?.()));
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
				if (this.settingsManager.getShowTerminalProgress?.()) this.ui.terminal.setProgress?.(true);
				this.showWorkingIndicator?.();
				break;
			case 'agent_end':
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
			case 'message_end':
				if (this.streamingComponent && event.message?.role === 'assistant') {
					this.streamingComponent.updateContent?.(event.message);
					this.streamingComponent = undefined;
					this.streamingMessage = undefined;
					this.footer.invalidate?.();
					this.ui.requestRender?.();
				}
				break;

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

	private handleClearCommand(): Promise<void> {
		// TODO: implement new session
		this.showStatus?.('Cleared (TODO: new session)');
		return Promise.resolve();
	}

	private async handleModelCommand(text: string): Promise<void> {
		try {
			const search = text.replace(/^\/model\s*/, '').trim();
			if (!search) {
				// Cycle forward
				const result = await this.session.cycleModel?.('forward');
				if (result) {
				 this.showStatus?.(`Model: ${result.model?.id ?? 'unknown'}`);
				} else {
					this.showStatus?.('No model change');
				}
			} else {
				// Find exact match among available models
				const models = await this.session.modelRegistry.getAvailable?.();
				const match = models?.find((m: any) => m.id === search || `${m.provider}/${m.id}` === search);
				if (match) {
					await this.session.setModel?.(match);
					this.showStatus?.(`Model: ${match.id}`);
				} else {
					this.showError?.(`Model not found: ${search}`);
				}
			}
		} catch (e: any) {
			this.showError?.(e.message ?? 'Model error');
		}
	}

	private async handleBashCommand(command: string, exclude: boolean): Promise<void> {
		try {
			const result = spawnSync(command, { shell: true, encoding: 'utf8' });
			const output = result.stdout || result.stderr || '';
			const BashComp = BashExecutionComponent as any;
			const bashComponent = new BashComp(command, this.ui, exclude);
			bashComponent.appendOutput?.(output);
			bashComponent.setComplete?.(result.status ?? 0, false, undefined, undefined);
			this.chatContainer.addChild?.(bashComponent);
			this.ui.requestRender?.();
		} catch (e: any) {
			this.showError?.(`Bash error: ${e.message}`);
		}
	}

	private showNewVersionNotification(version: string): void {
		const th = this.theme();
		const action = th.fg('accent', `${APP_NAME} update`);
		const updateInstruction = th.fg('muted', `New version ${version} is available. Run `) + action;
		this.chatContainer.addChild?.(new Spacer(1));
		this.chatContainer.addChild?.(new Text(`${th.bold(th.fg('warning', 'Update Available'))}\n${updateInstruction}`, 1, 0));
		this.ui.requestRender?.();
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

	private async checkShutdownRequested(): Promise<void> {
		if ((this as any).shutdownRequested) {
			await this.shutdown?.();
		}
	}
}

export async function runInteractiveMode(runtime: AgentSessionRuntime): Promise<void> {
	await new InteractiveMode(runtime).run?.();
}

export const setupShutdownHandlers = () => {};

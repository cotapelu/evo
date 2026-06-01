/**
 * InteractiveMode for Evo Agent - Minimal Viable Version
 * Orchestrates TUI UI, input, and agent interaction.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn, spawnSync, ChildProcess } from 'child_process';
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import { CombinedAutocompleteProvider, Container, Input, Loader, Markdown, ProcessTerminal, Spacer, Text, TUI, setKeybindings, matchesKey, SelectList } from '@earendil-works/pi-tui';
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
import { ensureTool } from '../utils/tools-manager.js';
import { killTrackedDetachedChildren } from '../utils/shell.js';
import { checkForNewPiVersion } from '../utils/version-check.js';
import { ExpandableText } from './components/expandable-text.js';
import { theme, initTheme as localInitTheme } from './theme/theme.js';

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

	// Extension UI state
	private extensionHeaderFactory?: ((tui: any, theme: any) => any) | undefined;
	private extensionFooterFactory?: ((tui: any, theme: any, footerData: any) => any) | undefined;
	private editorComponentFactory?: any;
	private extensionWidgets = new Map<string, { lines?: string[]; options?: any; componentFactory?: any }>();
	private extensionWidgetComponent?: any;
	private extensionWidgetPlacements = new Map<string, 'aboveEditor' | 'belowEditor'>();
	private widgetContainers = new Map<'aboveEditor' | 'belowEditor', Container>([
		['aboveEditor', this.widgetContainerAbove],
		['belowEditor', this.widgetContainerBelow],
	]);

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
	private activeBashProcesses = new Set<ChildProcess>();
	private readonly MAX_BASH_OUTPUT = 100 * 1024; // 100KB

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


		// Ensure fd and rg are available
		const [fdPath] = await Promise.all([ensureTool('fd'), ensureTool('rg')]);
		this.fdPath = fdPath;

		// Initialize theme
		piInitTheme?.();

		// TUI
		this.ui = new TUI(new ProcessTerminal(), this.settingsManager.getShowHardwareCursor?.() ?? true);
		this.ui.setClearOnShrink?.(this.settingsManager.getClearOnShrink?.() ?? true);

		// Editor
		const editorTheme: any = {
			borderColor: (s: string) => theme().fg('border', s),
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
		this.updateHeader?.();
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
		await this.bindCurrentSessionExtensions?.();

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
		this.updateHeader?.();
	}

	/** Update the header based on extension factory or built-in */
	private updateHeader(): void {
		this.headerContainer.clear?.();
		if (this.extensionHeaderFactory) {
			try {
				const component = this.extensionHeaderFactory(this.ui, theme());
				this.headerContainer.addChild?.(component);
			} catch (e) {
				console.error('[Header] Extension header error:', e);
				this.buildBuiltinHeader?.();
			}
		} else {
			this.buildBuiltinHeader?.();
		}
		this.ui.requestRender?.();
	}

	/** Build the default built-in header */
	private buildBuiltinHeader(): void {
		if (!(this.options.verbose || !this.settingsManager.getQuietStartup?.())) return;
		const th = theme();
		const logo = th?.bold?.(th?.fg?.('accent', APP_NAME)) + th?.fg?.('dim', ` v${VERSION}`);
		const compact = [
			keyHint('app.interrupt', 'int'),
			rawKeyHint(`${keyText('app.clear')}/${keyText('app.exit')}`, 'clr/exit'),
			rawKeyHint('/', 'cmds'),
			rawKeyHint('!', 'bash'),
		].join(th?.fg?.('muted', ' · '));
		const onboarding = th?.fg?.('dim', `Press / for commands, ! for bash.`);
		const headerText = `${logo}\n${compact}\n\n${onboarding}`;
		const header = new Text(headerText, 1, 0);
		this.headerContainer.addChild?.(new Spacer(1));
		this.headerContainer.addChild?.(header);
		this.headerContainer.addChild?.(new Spacer(1));
	}

	/** Set the extension header factory */
	private setExtensionHeader(factory: any): void {
		this.extensionHeaderFactory = factory;
		this.updateHeader();
	}

	/** Update the footer based on extension factory or built-in (placeholder) */
	private updateFooter(): void {
		// Minimal: no custom footer support yet
		// Future: replace footer component
	}

	/** Set the extension footer factory */
	private setExtensionFooter(factory: any): void {
		this.extensionFooterFactory = factory;
		this.updateFooter();
	}

	/** Show a custom component as an overlay */
	private async showExtensionCustom(factory: any, options?: any): Promise<any> {
		return new Promise((resolve) => {
			let component: any;
			try {
				component = factory(this.ui, this.theme(), this.keybindings, (result: any) => {
					this.ui.hideOverlay?.();
					resolve(result);
				});
			} catch (e) {
				console.error('[Custom] Factory error:', e);
				this.ui.hideOverlay?.();
				resolve(undefined);
				return;
			}
			this.ui.showOverlay?.(component, { ...options });
			this.ui.setFocus?.(component);
		});
	}

	/** Set a custom editor component */
	private setCustomEditorComponent(factory: any): void {
		this.editorComponentFactory = factory;
		if (factory) {
			// Create custom editor with theme and keybindings
			const newEditor = factory(this.ui, this.getEditorTheme(), this.keybindings);
			// Wire up callbacks from default editor
			newEditor.onSubmit = this.defaultEditor.onSubmit;
			newEditor.onChange = this.defaultEditor.onChange;
			// Preserve text
			const currentText = this.editor?.getText?.() ?? '';
			newEditor.setText?.(currentText);
			// Replace editor
			this.editorContainer.clear?.();
			this.editorContainer.addChild?.(newEditor);
			this.editor = newEditor;
			this.ui.setFocus?.(newEditor);
		} else {
			// Restore default editor
			this.editorContainer.clear?.();
			this.editorContainer.addChild?.(this.defaultEditor);
			this.editor = this.defaultEditor;
			this.ui.setFocus?.(this.defaultEditor);
		}
		this.ui.requestRender?.();
	}

	/** Get editor theme for custom editors */
	private getEditorTheme(): any {
		return {
			borderColor: (s: string) => this.theme().fg('border', s),
			selectList: { selected: (t: string) => t, active: (t: string) => t, disabled: (t: string) => t },
		};
	}

	/** Set tool output expansion state */
	private setToolsExpanded(expanded: boolean): void {
		this.toolOutputExpanded = expanded;
		this.toolComponents.forEach((comp) => {
			comp.setExpanded?.(expanded);
		});
		this.ui.requestRender?.();
	}

	/** Update widget display from extensionWidgets map */
	private updateWidgetDisplay(): void {
		// Clear both widget containers
		this.widgetContainerAbove.clear?.();
		this.widgetContainerBelow.clear?.();
		// Render each widget
		for (const [key, widget] of this.extensionWidgets) {
			const placement = this.extensionWidgetPlacements.get(key) ?? 'aboveEditor';
			const container = this.widgetContainers.get(placement);
			if (!container) continue;
			container.addChild?.(new Spacer(1));
			container.addChild?.(new Text(this.theme().dim(`[widget: ${key}]`), 1, 0));
			if (widget.componentFactory) {
				try {
					const comp = widget.componentFactory(this.ui, this.theme());
					container.addChild?.(comp);
				} catch (e) {
					console.error(`[Widget ${key}] factory error:`, e);
				}
			} else if (widget.lines) {
				widget.lines.forEach((line: string) => {
					container.addChild?.(new Text(this.theme().dim(`  ${line}`), 1, 0));
				});
			}
		}
		this.ui.requestRender?.();
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
			case '/bash': {
				const args = command.slice(5).trim();
				if (!args) {
					this.showWarning?.('Usage: /bash <shell command>');
				} else {
					this.handleBashCommand(args, false);
				}
				break;
			}
			case '/!': {
				const args = command.slice(2).trim();
				if (!args) {
					this.showWarning?.('Usage: /! <shell command>');
				} else {
					this.handleBashCommand(args, false);
				}
				break;
			}
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

		// Bind extension UI context and command actions
		(this.session as any).bindExtensions?.({
			uiContext: this.createExtensionUIContext?.(),
			commandContextActions: {
				waitForIdle: () => this.session.agent?.waitForIdle?.(),
				newSession: async (options: any) => this.runtimeHost.newSession?.(options),
				fork: async (entryId: any, forkOptions?: any) => {
					const result = await this.runtimeHost.fork?.(entryId, forkOptions);
					return { cancelled: result?.cancelled };
				},
				navigateTree: async (targetId: any, options?: any) => {
					const result = await this.session.navigateTree?.(targetId, {
						summarize: options?.summarize,
						customInstructions: options?.customInstructions,
						replaceInstructions: options?.replaceInstructions,
						label: options?.label,
					});
					return { cancelled: result?.cancelled };
				},
				switchSession: async (sessionPath: any, options?: any) => this.runtimeHost.switchSession?.(sessionPath, options),
				reload: async () => { await this.session.reload?.(); },
			},
			shutdownHandler: () => { this.shutdownRequested = true; },
			onError: (err: any) => { console.error('Extension error:', err); },
		});
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
			this.autoCompactionLoader = new Loader(
				this.ui,
				(spinner) => this.theme().fg('warning', spinner),
				(text) => this.theme().dim(text),
				'Compacting...'
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
	}

	/** Create Extension UIContext for extension UI requests */
	private createExtensionUIContext(): any {
		// Simplified: dialogs use overlays; notifications use chat status
		return {
			select: (title: string, options: string[], opts?: any) =>
				new Promise((resolve) => {
					const items = options.map((o) => ({ value: o, label: o }));
					const th = this.theme();
					const selector = new SelectList(
						items,
						Math.min(items.length, 8),
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
				if (content === undefined) {
					this.extensionWidgets.delete(key);
					this.extensionWidgetPlacements.delete(key);
					this.updateWidgetDisplay?.();
					return;
				}
				if (Array.isArray(content)) {
					this.extensionWidgets.set(key, { lines: content, options });
				} else if (typeof content === 'function') {
					this.extensionWidgets.set(key, { componentFactory: content, options });
				}
				if (options?.placement) {
					this.extensionWidgetPlacements.set(key, options.placement);
				}
				this.updateWidgetDisplay?.();
			},

			setHeader: (factory: any) => {
				this.extensionHeaderFactory = factory;
				this.updateHeader?.();
			},

			setFooter: (factory: any) => {
				this.extensionFooterFactory = factory;
				this.updateFooter?.();
			},

			setTitle: (title: string) => {
				this.ui.terminal?.setTitle?.(title);
			},

			custom: <T>(factory: any, options?: any) => this.showExtensionCustom?.(factory, options) as Promise<T>,

			pasteToEditor: (text: string) => {
				this.editor.handleInput?.(`\x1b[200~${text}\x1b[201~`);
			},

			onTerminalInput: () => () => { },

			addAutocompleteProvider: () => { },

			setEditorComponent: (factory: any) => {
				this.setCustomEditorComponent?.(factory);
			},

			getEditorComponent(): any {
				return this.editorComponentFactory;
			},

			get theme() {
				return this.theme();
			},

			getAllThemes(): any[] {
				return [];
			},

			getTheme(_name: string): any {
				return undefined;
			},

			setTheme(_theme: string | any): { success: boolean; error?: string } {
				return { success: false, error: 'Theme switching not supported in minimal mode' };
			},

			getToolsExpanded(): boolean {
				return this.toolOutputExpanded;
			},

			setToolsExpanded: (expanded: boolean) => {
				this.setToolsExpanded?.(expanded);
			},

			setWorkingIndicator: () => { },

			setHiddenThinkingLabel: () => { },

			setEditorText: (text: string) => {
				this.editor.setText?.(text);
			},

			getEditorText(): string {
				return this.editor.getText?.() ?? '';
			},

			setWorkingVisible: (_visible: boolean) => {
				// No-op
			},

			setWorkingMessage: (_msg?: string) => {
				// No-op
			},
		};
	}

	/** Get the current theme object */
	private theme(): any {
		return theme();
	}

	private updateEditorBorderColor(): void {
		const level = this.session.thinkingLevel || 'off';
		const colors: Record<string, string> = { off: 'border', minimal: 'dim', low: 'accent', medium: 'warning', high: 'error', xhigh: 'error' };
		this.editor.borderColor = theme().fg(colors[level] ?? 'border', '#');
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

			// Additional event types for full parity
			case 'queue_update':
				this.updatePendingMessagesDisplay?.();
				break;
			case 'session_info_changed':
				this.updateTerminalTitle?.();
				this.footer.invalidate?.();
				break;
			case 'thinking_level_changed':
				this.footer.invalidate?.();
				this.updateEditorBorderColor?.();
				break;
			case 'compaction_start': {
				if (this.settingsManager.getShowTerminalProgress?.()) this.ui.terminal.setProgress?.(true);
				// Set escape to abort compaction
				this.autoCompactionEscapeHandler = this.defaultEditor.onEscape;
				this.defaultEditor.onEscape = () => { this.session.abortCompaction?.(); };
				this.statusContainer.clear?.();
				const cancelHint = `(${keyText('app.interrupt')} to cancel)`;
				const label = event.reason === 'manual'
					? `Compacting context... ${cancelHint}`
					: `${event.reason === 'overflow' ? 'Context overflow detected, ' : ''}Auto-compacting... ${cancelHint}`;
				this.autoCompactionLoader = new Loader(
					this.ui,
					(spinner) => theme().fg('warning', spinner),
					(text) => theme().dim(text),
					label
				);
				this.statusContainer.addChild?.(this.autoCompactionLoader);
				break;
			}
			case 'compaction_end': {
				if (this.settingsManager.getShowTerminalProgress?.()) this.ui.terminal.setProgress?.(false);
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
					this.addMessageToChat?.({
						role: 'compactionSummary',
						summary: event.result.summary,
						tokensBefore: event.result.tokensBefore,
						timestamp: new Date().toISOString(),
					} as any);
					this.footer.invalidate?.();
				} else if (event.errorMessage) {
					if (event.reason === 'manual') {
						this.showError?.(event.errorMessage);
					} else {
						this.chatContainer.addChild?.(new Spacer(1));
						this.chatContainer.addChild?.(new Text(theme().fg('error', event.errorMessage), 1, 0));
					}
				}
				void this.flushCompactionQueue?.({ willRetry: event.willRetry });
				this.ui.requestRender?.();
				break;
			}
			case 'auto_retry_start': {
				this.retryEscapeHandler = this.defaultEditor.onEscape;
				this.defaultEditor.onEscape = () => { this.session.abortRetry?.(); };
				this.statusContainer.clear?.();
				if (this.retryCountdown) {
					this.retryCountdown.dispose?.();
					this.retryCountdown = undefined;
				}
				const retryMessage = (seconds: number) =>
					`Retrying (${event.attempt}/${event.maxAttempts}) in ${seconds}s... (${keyText('app.interrupt')} to cancel)`;
				this.retryLoader = new Loader(
					this.ui,
					(spinner) => theme().fg('warning', spinner),
					(text) => theme().dim(text),
					retryMessage(Math.ceil(event.delayMs / 1000))
				);
				this.statusContainer.addChild?.(this.retryLoader);
				break;
			}
			case 'auto_retry_end': {
				if (this.retryEscapeHandler) {
					this.defaultEditor.onEscape = this.retryEscapeHandler;
					this.retryEscapeHandler = undefined;
				}
				if (this.retryLoader) {
					this.retryLoader.stop?.();
					this.retryLoader = undefined;
					this.statusContainer.clear?.();
				}
				if (!event.success) {
					this.showError?.(`Retry failed after ${event.attempt} attempts: ${event.finalError || 'Unknown error'}`);
				}
				this.ui.requestRender?.();
				break;
			}
			case 'shutdown_requested':
				this.shutdownRequested = true;
				break;
			case 'session_before_compact':
				this.showAutoCompactionLoader?.();
				break;
			case 'session_compact':
				this.hideAutoCompactionLoader?.();
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

	private showLoadedResources(): void {
		try {
			const skills = this.session.resourceLoader.getSkills?.()?.skills ?? [];
			const prompts = this.session.resourceLoader.getPrompts?.()?.prompts ?? [];
			const extensions = this.session.resourceLoader.getExtensions?.()?.extensions ?? [];
			const themes = this.session.resourceLoader.getThemes?.()?.themes ?? [];
			const lines: string[] = [];
			if (skills.length) lines.push(`Skills: ${skills.length}`);
			if (prompts.length) lines.push(`Prompts: ${prompts.length}`);
			if (extensions.length) lines.push(`Extensions: ${extensions.length}`);
			if (themes.length) lines.push(`Themes: ${themes.length}`);
			const text = lines.length ? lines.join('\n') : 'No resources loaded';
			if (this.chatContainer.children.length > 0) this.chatContainer.addChild?.(new Spacer(1));
			this.chatContainer.addChild?.(new Text(text, 1, 0));
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

		// Streaming implementation
		const component = new BashExecutionComponent(command, this.ui, exclude);
		this.chatContainer.addChild?.(component);
		this.ui.requestRender?.();

		let truncated = false;
		let accumulated = '';

		const onChunk = (chunk: string) => {
			if (truncated) return;
			component.appendOutput?.(chunk);
			accumulated += chunk;
			if (accumulated.length > this.MAX_BASH_OUTPUT) {
				truncated = true;
			}
		};

		try {
			const cwd = this.sessionManager.getCwd?.() ?? process.cwd();
			const child = spawn(command, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'], shell: true });

			child.stdout?.on('data', (chunk: Buffer) => onChunk(chunk.toString('utf-8')));
			child.stderr?.on('data', (chunk: Buffer) => onChunk(chunk.toString('utf-8')));

			const exitCode = await new Promise<number>((resolve, reject) => {
				child.on('exit', (code, sig) => {
					resolve(code ?? 0);
				});
				child.on('error', reject);
			});

			component.setComplete?.(exitCode, truncated, undefined, undefined);
			this.defaultEditor.setText?.('');
		} catch (err: any) {
			component.setComplete?.(1, false, err.message, undefined);
			this.showError?.(`Bash error: ${err.message}`);
		} finally {
			this.ui.requestRender?.();
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
		this.chatContainer.addChild?.(new Text(theme().fg('error', `Error: ${errorMessage}`), 1, 0));
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
			last.setText?.(theme().fg('dim', message));
			this.ui.requestRender?.();
			return;
		}
		const spacer = new Spacer(1);
		const text = new Text(theme().fg('dim', message), 1, 0);
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
		const cwd = this.sessionManager.getCwd?.() ?? process.cwd();
		const cwdBasename = path.basename(cwd);
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

	/** Rebuild chat from session messages */
	private rebuildChatFromMessages(): void {
		this.chatContainer.clear?.();
		this.renderInitialMessages?.();
	}

	/** Flush compaction queue (stub) */
	private async flushCompactionQueue(options?: { willRetry?: boolean }): Promise<void> {
		// Clear queued messages; proper implementation will send them
		this.compactionQueuedMessages = [];
		this.updatePendingMessagesDisplay?.();
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

	): Promise<{ exitCode: number; signal?: string }> {
		const cwd = options?.cwd ?? this.sessionManager.getCwd?.() ?? process.cwd();
		const env = options?.env ?? process.env;

		const child = spawn(command, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], shell: true });

		this.activeBashProcesses.add(child);

		let accumulated = '';
		let truncated = false;

		const handleStream = (stream: NodeJS.ReadableStream) => {
			stream.on('data', (chunk: Buffer) => {
				if (truncated) return;
				const text = chunk.toString('utf-8');
				onChunk(text);
				accumulated += text;
				if (accumulated.length > this.MAX_BASH_OUTPUT) {
					truncated = true;
				}
			});
			stream.on('error', (err: Error) => {
				console.error('Bash stream error:', err);
			});
		};

		if (child.stdout) handleStream(child.stdout);
		if (child.stderr) handleStream(child.stderr);

		const exitPromise = new Promise<{ exitCode: number; signal?: string }>((resolve, reject) => {
			child.on('exit', (code, sig) => {
				this.activeBashProcesses.delete(child);
				resolve({ exitCode: code ?? 0, signal: sig });
			});
			child.on('error', (err: Error) => {
				this.activeBashProcesses.delete(child);
				reject(err);
			});
		});

		if (options?.timeoutMs) {
			const timeout = setTimeout(() => {
				if (!child.killed) child.kill('SIGKILL');
			}, options.timeoutMs);
			exitPromise.finally(() => clearTimeout(timeout));
		}

		return exitPromise;
	}

	/** Handle a bash command from user input */
	private handleBashCommand(command: string, excludeFromContext: boolean = false): void {
		if (!command.trim()) {
			this.showStatus?.('Empty command');
			return;
		}

		const component = new BashExecutionComponent(command, this.ui, excludeFromContext);
		this.chatContainer.addChild?.(component);
		this.ui.requestRender?.();

		let accumulated = '';
		let truncated = false;

		const onChunk = (chunk: string) => {
			if (truncated) return;
			component.appendOutput(chunk);
			accumulated += chunk;
			if (accumulated.length > this.MAX_BASH_OUTPUT) {
				truncated = true;
				component.setTruncated?.(true);
			}
		};

		const run = async () => {
			try {
				const result = await this.executeBash(command, onChunk);
				component.setExitCode?.(result.exitCode);
				if (result.signal) {
					component.appendOutput(`\n[Process terminated by signal: ${result.signal}]`);
				}
			} catch (err: any) {
				component.appendOutput(`\n[Failed to start process: ${err.message}]`);
				component.setExitCode?.(1);
			}
			this.ui.requestRender?.();
		};

		run();
	}
}

export async function runInteractiveMode(runtime: AgentSessionRuntime): Promise<void> {
	await new InteractiveMode(runtime).run?.();
}

export const setupShutdownHandlers = () => {};

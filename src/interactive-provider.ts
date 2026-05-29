/**
 * Interactive Mode - Rewritten
 * Minimal implementation using only package exports
 */

import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "child_process";

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, ImageContent } from "@earendil-works/pi-ai";
import { TUI, ProcessTerminal, Container, Text, Spacer, setKeybindings, fuzzyFilter } from "@earendil-works/pi-tui";
import {
	AgentSessionRuntime,
	CustomEditor,
	FooterComponent,
	InteractiveModeOptions,
	parseSkillBlock,
	AssistantMessageComponent,
	UserMessageComponent,
	ToolExecutionComponent,
	BUILTIN_SLASH_COMMANDS,
} from "@earendil-works/pi-coding-agent";

// ============================================================================
// CONFIG
// ============================================================================

const APP_NAME = "Pi";
const VERSION = "0.1.0";

function getAgentDir(): string { return path.join(os.homedir(), ".pi"); }
function getAuthPath(): string { return path.join(getAgentDir(), "auth.json"); }
function getDebugLogPath(): string { return path.join(getAgentDir(), "debug.log"); }
function getDocsPath(): string { return path.join(getAgentDir(), "docs"); }
function getShareViewerUrl(shareId: string): string { return `https://pi.dev/share/${shareId}`; }

// ============================================================================
// THEME (minimal)
// ============================================================================

interface Theme { bold(text: string): string; fg(color: string, text: string): string; }
const defaultTheme: Theme = { bold: (t) => t, fg: (_, t) => t };
let currentTheme = defaultTheme;
function theme(): Theme { return currentTheme; }
function initTheme(name: string, silent: boolean): void {}
function setRegisteredThemes(themes: any[]): void {}
function getMarkdownTheme(): any { return {}; }
function onThemeChange(cb: () => void): () => void { return () => {}; }

// ============================================================================
// KEYBINDING HELPERS
// ============================================================================

type AppKeybinding = string;
type KeyId = string;

function formatKeyText(keys: string | string[], opts?: { capitalize?: boolean }): string {
	if (typeof keys === "string") return opts?.capitalize ? keys[0].toUpperCase() + keys.slice(1) : keys;
	return keys.join("/");
}
function keyDisplayText(key: string): string {
	const map: Record<string, string> = {
		enter: "Enter", escape: "Esc", backspace: "Backspace", tab: "Tab",
		up: "↑", down: "↓", left: "←", right: "→",
		"ctrl+c": "Ctrl+C", "ctrl+enter": "Ctrl+Enter",
	};
	return map[key] || key;
}
function keyHint(keybinding: string, description: string): string {
	const keys = keybinding.split("+").map(k => keyDisplayText(k.trim()));
	return `${keys.join("+")} ${description}`;
}
function keyText(keyId: string): string { return keyDisplayText(keyId); }
function rawKeyHint(keys: string | string[], description: string): string {
	const s = Array.isArray(keys) ? keys.join("/") : keys;
	return `${s} ${description}`;
}

// ============================================================================
// UTILITIES
// ============================================================================

function formatDisplayPath(p: string): string {
	const home = os.homedir();
	return p.startsWith(home) ? `~${p.slice(home.length)}` : p;
}
function getCwdRelativePath(p: string, cwd: string): string | undefined {
	const rel = path.relative(cwd, p);
	return rel.startsWith("..") ? undefined : rel;
}
function isAnthropicSubscriptionAuthKey(apiKey: string | undefined): boolean {
	return typeof apiKey === "string" && apiKey.startsWith("sk-ant-oat");
}
function getPiUserAgent(version: string): string { return `Pi/${version} (${process.platform})`; }
async function ensureTool(name: "fd" | "rg"): Promise<string> {
	const w = spawnSync("which", [name], { encoding: "utf8" });
	if (w.status === 0) return w.stdout.trim();
	throw new Error(`${name} not found`);
}
function getChangelogPath(): string { return path.join(getDocsPath(), "CHANGELOG.md"); }
function parseChangelog(content: string): any[] {
	const entries = content.split(/^## /gm).filter(e => e.trim());
	return entries.map(e => {
		const m = e.match(/^\[?([0-9]+\.[0-9]+\.[0-9]+)\]?/);
		return { version: m ? m[1] : "0.0.0", content: e.trim() };
	});
}
function getNewEntries(all: any[], lastSeen: string): any[] {
	const idx = all.findIndex(e => e.version === lastSeen);
	return idx === -1 ? all : all.slice(0, idx);
}
async function checkForNewPiVersion(current: string): Promise<{ tag_name: string } | null> {
	if (process.env.PI_OFFLINE) return null;
	try {
		const res = await fetch(`https://api.github.com/repos/earendilworks/pi/releases/latest`, {
			headers: { "User-Agent": getPiUserAgent(current) },
			signal: AbortSignal.timeout(5000),
		});
		if (!res.ok) return null;
		return await res.json();
	} catch { return null; }
}

// ============================================================================
// COMPONENTS
// ============================================================================

class ExpandableText extends Text {
	private coll: string;
	private exp: string;
	constructor(collapsed: string, expanded: string, expandedInitially = false, paddingX = 0, paddingY = 0) {
		super(expandedInitially ? expanded : collapsed, paddingX, paddingY);
		this.coll = collapsed;
		this.exp = expanded;
	}
	setExpanded(e: boolean): void { this.setText(e ? this.exp : this.coll); }
}

class CountdownTimer implements Component {
	private rem: number;
	private int: NodeJS.Timeout | null = null;
	constructor(initial: number, private onDone: () => void) { this.rem = initial; }
	start(): void {
		this.int = setInterval(() => {
			this.rem--;
			if (this.rem <= 0) { this.stop(); this.onDone(); }
		}, 1000);
	}
	stop(): void { if (this.int) clearInterval(this.int); }
	render(): string { const m = Math.floor(this.rem / 60); const s = this.rem % 60; return `${m}:${s.toString().padStart(2,"0")}`; }
	dispose(): void { this.stop(); }
}

class DaxnutsComponent implements Component { render(): string { return "🟢"; } }
class EarendilAnnouncementComponent implements Component { render(): string { return ""; } }

// ============================================================================
// KEYBINDINGS MANAGER (minimal)
// ============================================================================

class KeybindingsManager {
	private bindings = new Map<string, string>();
	static create(): KeybindingsManager { return new KeybindingsManager(); }
	getKey(binding: string): string {
		const defaults: Record<string, string> = {
			"app.clear": "ctrl+shift+c",
			"app.exit": "ctrl+q",
			"app.interrupt": "ctrl+c",
			"app.suspend": "ctrl+z",
			"app.model.cycleForward": "ctrl+p",
			"app.model.cycleBackward": "ctrl+shift+p",
			"app.model.select": "ctrl+m",
			"app.tools.expand": "tab",
			"app.thinking.toggle": "ctrl+t",
			"app.editor.external": "ctrl+o",
			"app.clipboard.pasteImage": "ctrl+v",
			"app.message.followUp": "ctrl+enter",
			"app.message.dequeue": "ctrl+d",
			"tui.editor.deleteToLineEnd": "ctrl+k",
			"app.thinking.cycle": "ctrl+.",
		};
		return defaults[binding] || "";
	}
	getKeys(binding: string): string[] {
		const k = this.getKey(binding);
		return k ? [k] : [];
	}
	getEffectiveConfig(): Record<string, string> {
		const cfg: Record<string, string> = {};
		for (const [k, v] of Object.entries({
			"app.clear": "ctrl+shift+c",
			"app.exit": "ctrl+q",
			"app.interrupt": "ctrl+c",
		})) cfg[k] = v;
		return cfg;
	}
}

// ============================================================================
// FOOTER DATA PROVIDER (minimal with polling)
// ============================================================================

class FooterDataProvider {
	private cwd: string;
	private branch: string | null = null;
	private listeners = new Set<() => void>();
	private watcher?: NodeJS.Timeout;

	constructor(cwd: string) { this.cwd = cwd; this.refresh(); }

	getGitBranch(): string | null { return this.branch; }

	onBranchChange(cb: () => void): () => void {
		this.listeners.add(cb);
		return () => this.listeners.delete(cb);
	}

	private notify(): void { for (const cb of this.listeners) cb(); }

	setCwd(cwd: string): void {
		if (this.cwd !== cwd) {
			this.cwd = cwd;
			this.refresh();
			this.notify();
		}
	}

	dispose(): void {
		if (this.watcher) clearInterval(this.watcher);
		this.listeners.clear();
	}

	getExtensionStatuses(): Map<string, string> { return new Map(); }
	getAvailableProviderCount(): number { return 0; }
	setExtensionStatus(_: string, __: string | undefined): void {}
	clearExtensionStatuses(): void {}
	setAvailableProviderCount(_: number): void {}

	private refresh(): void {
		try {
			const result = spawnSync("git", ["symbolic-ref", "--quiet", "--short", "HEAD"], { cwd: this.cwd, encoding: "utf8" });
			const newBranch = result.status === 0 ? result.stdout.trim() || null : null;
			if (newBranch !== this.branch) {
				this.branch = newBranch;
				this.notify();
			}
		} catch {
			this.branch = null;
		}
	}
}

type ReadonlyFooterDataProvider = Pick<FooterDataProvider, 'getGitBranch' | 'onBranchChange' | 'getExtensionStatuses' | 'getAvailableProviderCount'>;

// ============================================================================
// INTERACTIVE MODE
// ============================================================================

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
	private changelogMarkdown?: string;
	private startupNoticesShown = false;
	private toolOutputExpanded = false;
	private hideThinkingBlock = false;
	private skillCommands = new Map<string, string>();
	private shutdownRequested = false;
	private fdPath?: string;

	private get session(): any { return this.runtimeHost.session; }
	private get settingsManager(): any { return this.session.settingsManager; }
	private get sessionManager(): any { return this.session.sessionManager; }

	constructor(runtimeHost: AgentSessionRuntime, options: InteractiveModeOptions = {}) {
		this.runtimeHost = runtimeHost;
		this.options = options;
		setKeybindings(this.keybindings);

		const editorPaddingX = (this.settingsManager as any).getEditorPaddingX();
		const autocompleteMaxVisible = (this.settingsManager as any).getAutocompleteMaxVisible();
		const themeObj = getMarkdownTheme() as any;
		this.defaultEditor = new CustomEditor(undefined as any, themeObj, this.keybindings as any, {
			paddingX: editorPaddingX,
			autocompleteMaxVisible,
		});
		this.editor = this.defaultEditor;
		this.editorContainer.addChild(this.editor as any);

		this.footerDataProvider = new FooterDataProvider(this.sessionManager.getCwd());
		this.footer = new FooterComponent(this.session, this.footerDataProvider);
		this.footer.setAutoCompactEnabled(this.session.autoCompactionEnabled);

		initTheme((this.settingsManager as any).getTheme(), true);
	}

	async init(): Promise<void> {
		if (this.isInitialized) return;
		this.registerSignalHandlers();

		// Load changelog
		try {
			const cp = getChangelogPath();
			if (typeof require !== "undefined" && require("fs").existsSync(cp)) {
				const content = require("fs").readFileSync(cp, "utf8");
				const entries = parseChangelog(content);
				const last = (this.settingsManager as any).getLastChangelogVersion();
				if (!last) {
					(this.settingsManager as any).setLastChangelogVersion(VERSION);
				} else {
					const newE = getNewEntries(entries, last);
					if (newE.length > 0) {
						this.changelogMarkdown = newE.map((e: any) => e.content).join("\n\n");
						(this.settingsManager as any).setLastChangelogVersion(VERSION);
					}
				}
			}
		} catch (e) {}

		// Ensure tools
		try {
			const fd = await ensureTool("fd");
			this.fdPath = fd;
		} catch (e) {
			console.warn("fd not available:", e);
		}

		// TUI
		this.ui = new TUI(new ProcessTerminal(), (this.settingsManager as any).getShowHardwareCursor());
		this.ui.setClearOnShrink((this.settingsManager as any).getClearOnShrink());

		// Layout
		this.ui.addChild(this.headerContainer);
		this.buildHeader();
		this.ui.addChild(this.chatContainer);
		this.ui.addChild(this.pendingMessagesContainer);
		this.ui.addChild(this.statusContainer);
		this.ui.addChild(this.widgetContainerAbove);
		this.ui.addChild(this.editorContainer);
		this.ui.addChild(this.widgetContainerBelow);
		this.ui.addChild(this.footer);
		this.ui.setFocus(this.editor);

		// Handlers
		this.setupKeyHandlers();
		this.setupEditorSubmitHandler();

		// Start
		this.ui.start();
		this.isInitialized = true;

		// Subscribe
		this.subscribeToAgent();

		// Bind extensions (minimal)
		this.bindCurrentSessionExtensions();

		// Git branch polling
		(this.footerDataProvider as any).watcher = setInterval(() => {
			(this.footerDataProvider as any).refresh?.();
		}, 2000);

		// Notices
		if (this.changelogMarkdown) this.showStartupNotices();
	}

	private buildHeader(): void {
		if (this.options.verbose || !(this.settingsManager as any).getQuietStartup()) {
			const logo = theme().bold(theme().fg("accent", APP_NAME)) + theme().fg("dim", ` v${VERSION}`);
			const expanded = [
				keyHint("app.interrupt", "to interrupt"),
				keyHint("app.clear", "to clear"),
				rawKeyHint(`${keyText("app.clear")} twice`, "to exit"),
				keyHint("app.exit", "to exit (empty)"),
				keyHint("app.suspend", "to suspend"),
				keyHint("tui.editor.deleteToLineEnd", "to delete to end"),
				keyHint("app.thinking.cycle", "to cycle thinking level"),
				rawKeyHint(`${keyText("app.model.cycleForward")}/${keyText("app.model.cycleBackward")}`, "to cycle models"),
				keyHint("app.model.select", "to select model"),
				keyHint("app.tools.expand", "to expand tools"),
				keyHint("app.thinking.toggle", "to expand thinking"),
				keyHint("app.editor.external", "for external editor"),
				rawKeyHint("/", "for commands"),
				rawKeyHint("!", "to run bash"),
				rawKeyHint("!!", "to run bash (no context)"),
				keyHint("app.message.followUp", "to queue follow-up"),
				keyHint("app.message.dequeue", "to edit all queued messages"),
				keyHint("app.clipboard.pasteImage", "to paste image"),
				rawKeyHint("drop files", "to attach"),
			].join("\n");
			const compact = [
				keyHint("app.interrupt", "interrupt"),
				rawKeyHint(`${keyText("app.clear")}/${keyText("app.exit")}`, "clear/exit"),
				rawKeyHint("/", "commands"),
				rawKeyHint("!", "bash"),
				keyHint("app.tools.expand", "more"),
			].join(theme().fg("muted", " · "));
			this.headerContainer.addChild(new Spacer(1));
			this.headerContainer.addChild(new ExpandableText(`${logo}\n${compact}\n`, `${logo}\n${expanded}\n`, false, 1, 0));
			this.headerContainer.addChild(new Spacer(1));
		}
	}

	private showStartupNotices(): void {
		if (this.startupNoticesShown || !this.changelogMarkdown) return;
		this.startupNoticesShown = true;
		if (this.chatContainer.children.length > 0) this.chatContainer.addChild(new Spacer(1));
		this.chatContainer.addChild(new Text(theme().bold(theme().fg("accent", "What's New")), 1, 0));
		this.chatContainer.addChild(new Spacer(1));
		this.chatContainer.addChild(new Text(this.changelogMarkdown.slice(0, 1000), 1, 0));
		this.chatContainer.addChild(new Spacer(1));
	}

	private subscribeToAgent(): void {
		this.unsubscribe = this.session.subscribe((event: any) => {
			if (event.type === "message_end" && event.message?.role === "assistant") {
				const comp = new AssistantMessageComponent(event.message);
				this.chatContainer.addChild(comp);
				this.ui.requestRender();
			} else if (event.type === "tool_call") {
				const toolComp = new ToolExecutionComponent(event.tool, {
					expandByDefault: this.toolOutputExpanded,
					hideThinking: this.hideThinkingBlock,
				});
				this.chatContainer.addChild(toolComp);
				this.ui.requestRender();
			}
		});
	}

	private bindCurrentSessionExtensions(): void {
		// Stub: show minimal resource info
		this.chatContainer.addChild(new Spacer(1));
		this.chatContainer.addChild(new Text("Resources loaded.", 0, 0));
		this.chatContainer.addChild(new Spacer(1));
		this.setupAutocompleteProvider();
	}

	private createBaseAutocompleteProvider(): AutocompleteProvider {
		// Define commands
		const slashCommands: SlashCommand[] = BUILTIN_SLASH_COMMANDS.map((cmd: any) => ({
			name: cmd.name,
			description: cmd.description,
		}));

		// Add prompt templates
		const templates = (this.session as any).promptTemplates || [];
		const templateCommands: SlashCommand[] = templates.map((t: any) => ({
			name: t.name,
			description: t.description,
		}));

		// Add skill commands if enabled
		const skillCommands: SlashCommand[] = [];
		if ((this.settingsManager as any).getEnableSkillCommands) {
			const skills = (this.session.resourceLoader as any).getSkills?.()?.skills || [];
			for (const skill of skills) {
				skillCommands.push({ name: `skill:${skill.name}`, description: skill.description });
			}
		}

		// Combine
		const allCommands = [...slashCommands, ...templateCommands, ...skillCommands];

		return new CombinedAutocompleteProvider(allCommands, this.sessionManager.getCwd(), this.fdPath);
	}

	private setupAutocompleteProvider(): void {
		const provider = this.createBaseAutocompleteProvider();
		(this.defaultEditor as any).setAutocompleteProvider?.(provider);
		if (this.editor !== this.defaultEditor) {
			(this.editor as any).setAutocompleteProvider?.(provider);
		}
	}

	private showLoadedResources(options?: { extensions?: any[]; force?: boolean; showDiagnosticsWhenQuiet?: boolean }): void {
		const chatContainer = this.chatContainer;
		const session = this.session;
		const settingsManager = this.settingsManager;

		const showListing = options?.force || this.options.verbose || !settingsManager.getQuietStartup();
		const showDiagnostics = showListing || options?.showDiagnosticsWhenQuiet === true;
		if (!showListing && !showDiagnostics) return;

		chatContainer.addChild(new Spacer(1));
		chatContainer.addChild(new Text(theme().bold(theme().fg('accent', 'Loaded Resources')), 0, 0));
		chatContainer.addChild(new Spacer(1));

		// Skills
		const skillsResult = (session.resourceLoader as any).getSkills?.() || { skills: [] };
		const skills = skillsResult.skills || [];
		if (skills.length > 0) {
			chatContainer.addChild(new Text(`Skills: ${skills.map((s: any) => s.name).join(', ')}`, 0, 0));
		}

		// Prompts
		const promptsResult = (session.resourceLoader as any).getPrompts?.() || { prompts: [] };
		const prompts = promptsResult.prompts || [];
		if (prompts.length > 0) {
			chatContainer.addChild(new Text(`Prompts: ${prompts.map((p: any) => p.name).join(', ')}`, 0, 0));
		}

		// Extensions
		const extensionsResult = (session.resourceLoader as any).getExtensions?.() || { extensions: [] };
		const extensions = extensionsResult.extensions || [];
		if (extensions.length > 0) {
			chatContainer.addChild(new Text(`Extensions: ${extensions.length} loaded`, 0, 0));
		}

		// Themes (custom only)
		const themesResult = (session.resourceLoader as any).getThemes?.() || { themes: [] };
		const themes = themesResult.themes || [];
		const customThemes = themes.filter((t: any) => t.sourcePath);
		if (customThemes.length > 0) {
			chatContainer.addChild(new Text(`Themes: ${customThemes.length} custom`, 0, 0));
		}

		// Context files
		const agentsFiles = (session.resourceLoader as any).getAgentsFiles?.() || { agentsFiles: [] };
		const contextFiles = agentsFiles.agentsFiles || [];
		if (contextFiles.length > 0) {
			chatContainer.addChild(new Text(`Context: ${contextFiles.length} files`, 0, 0));
		}

		chatContainer.addChild(new Spacer(1));
	}

	private renderInitialMessages(): void {
		const state = this.session.state;
		const messages = (state as any).messages || [];
		for (const msg of messages) {
			if (msg.role === "user") {
				const comp = new UserMessageComponent(msg as any);
				this.chatContainer.addChild(comp);
			} else if (msg.role === "assistant") {
				const comp = new AssistantMessageComponent(msg as any);
				this.chatContainer.addChild(comp);
			}
		}
	}

	private setupKeyHandlers(): void {
		// Minimal: intercept Ctrl+C
		this.ui.keyHandler((key: string) => {
			if (key === "ctrl+c") {
				this.session.agent.interrupt();
				return true;
			}
			return false;
		});
	}

	private setupEditorSubmitHandler(): void {
		const onSubmit = async (text: string) => {
			this.editor.setText("");
			if (text.startsWith("/")) {
				await this.handleSlashCommand(text);
				return;
			}
			if (text.startsWith("!")) {
				this.handleBash(text.startsWith("!!"));
				return;
			}
			// Render user message immediately
			const userMsg = { role: "user" as const, content: [{ type: "text" as const, text }] };
			const userComp = new UserMessageComponent(userMsg as any);
			this.chatContainer.addChild(userComp);
			try {
				await this.session.prompt(text);
			} catch (error: any) {
				console.error("Prompt error:", error?.message || error);
			}
		};
		(this.editor as any).on("submit", onSubmit);
	}

	private async handleSlashCommand(text: string): Promise<void> {
		const [cmd, ...args] = text.slice(1).split(" ");
		switch (cmd) {
			case "clear":
				this.chatContainer.clear();
				break;
			case "exit":
			case "quit":
				await this.shutdown();
				break;
			case "compact":
				try { await (this.session as any).compact?.(); } catch (e) { console.error("Compaction failed:", e); }
				break;
			case "model":
				if (args.length === 0) {
					const result = (this.session as any).cycleModel?.();
					if (result) console.log(`Switched to ${result.model.id}`);
				} else {
					const spec = args.join(" ");
					const available = (this.session.modelRegistry?.getAvailable?.() || []) as any[];
					const match = available.find((m: any) => `${m.provider}/${m.id}` === spec || m.id === spec);
					if (match) {
						(this.session as any).model = match;
						console.log(`Model set to ${match.id}`);
					} else {
						console.log(`Model not found: ${spec}`);
					}
				}
				break;
			default:
				console.log(`Unknown command: /${cmd}`);
		}
	}

	private handleBash(noContext: boolean): void {
		const text = this.editor.getText();
		if (!text.trim()) return;
		const cmd = text.replace(/^!+/, "").trim();
		try {
			const result = spawnSync(cmd, { shell: true, encoding: "utf8" });
			const output = result.stdout || result.stderr || "";
			this.chatContainer.addChild(new Text(`$ ${cmd}\n${output}`, 0, 0) as any);
			this.ui.requestRender();
		} catch (e: any) {
			this.chatContainer.addChild(new Text(`Error: ${e.message}`, 0, 0) as any);
			this.ui.requestRender();
		}
		this.editor.setText("");
	}

	private registerSignalHandlers(): void {
		const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
		for (const sig of signals) {
			const handler = () => {
				console.log("\nShutting down...");
				void this.shutdown();
			};
			process.on(sig, handler);
			this.signalCleanupHandlers.push(() => process.off(sig, handler));
		}
		process.on("unhandledRejection", (reason) => {
			console.error("Unhandled rejection:", reason);
			process.exit(1);
		});
		process.on("uncaughtException", (err) => {
			console.error("Uncaught exception:", err);
			process.exit(1);
		});
	}

	private unregisterSignalHandlers(): void {
		for (const cleanup of this.signalCleanupHandlers) cleanup();
		this.signalCleanupHandlers.length = 0;
	}

	private async shutdown(): Promise<void> {
		this.shutdownRequested = true;
		this.unregisterSignalHandlers();
		this.unsubscribe?.();
		if (this.ui) this.ui.stop();
		// Note: process.exit handled by caller
	}

	stop(): void {
		// Same as shutdown but synchronous
		this.shutdownRequested = true;
		this.unregisterSignalHandlers();
		this.unsubscribe?.();
		if (this.ui) this.ui.stop();
	}

	// Placeholder methods (to be implemented later if needed)
	private applyRuntimeSettings(): void {
		this.footer.setSession?.(this.session);
		this.footer.setAutoCompactEnabled?.(this.session.autoCompactionEnabled);
		(this.footerDataProvider as any).setCwd?.(this.sessionManager.getCwd());
		this.hideThinkingBlock = (this.settingsManager as any).getHideThinkingBlock?.() ?? false;
		(this.ui as any).setShowHardwareCursor?.((this.settingsManager as any).getShowHardwareCursor?.());
		(this.ui as any).setClearOnShrink?.((this.settingsManager as any).getClearOnShrink?.());
		const editorPaddingX = (this.settingsManager as any).getEditorPaddingX?.();
		const autocompleteMaxVisible = (this.settingsManager as any).getAutocompleteMaxVisible?.();
		(this.defaultEditor as any).setPaddingX?.(editorPaddingX);
		(this.defaultEditor as any).setAutocompleteMaxVisible?.(autocompleteMaxVisible);
		if (this.editor !== this.defaultEditor) {
			(this.editor as any).setPaddingX?.(editorPaddingX);
			(this.editor as any).setAutocompleteMaxVisible?.(autocompleteMaxVisible);
		}
	}

	private async rebindCurrentSession(): Promise<void> {
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		this.applyRuntimeSettings();
		await this.bindCurrentSessionExtensions();
		this.subscribeToAgent();
		// Update terminal title
		this.updateTerminalTitle();
	}
	private getMarkdownThemeWithSettings(): any { return {}; }
	private updateAvailableProviderCount(): Promise<void> { return Promise.resolve(); }
	private updateEditorBorderColor(): void {}
	private updateTerminalTitle(): void {}
	private handleResumeSession(sessionPath: string, options?: any): Promise<{ cancelled: boolean }> {
		console.log("Session resume not implemented");
		return Promise.resolve({ cancelled: true });
	}
	private handleReloadCommand(): Promise<void> { return Promise.resolve(); }
	private showExtensionError(extensionPath: string, error: any, stack?: string): void {}
	private flushCompactionQueue(options: { willRetry: boolean }): Promise<void> { return Promise.resolve(); }
	private handleFatalRuntimeError(prefix: string, error: unknown): never {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`${prefix}: ${message}`);
		this.stop();
		process.exit(1);
	}
	private maybeWarnAboutAnthropicSubscriptionAuth(): void {}
	private reportInstallTelemetry(version: string): void {}
	private createExtensionUIContext(): any { return {}; }
	private getAutocompleteSourceTag(sourceInfo?: any): string | undefined { return undefined; }
	private prefixAutocompleteDescription(description: string | undefined, sourceInfo?: any): string | undefined { return description; }
	private getStartupExpansionState(): boolean { return this.options.verbose || this.toolOutputExpanded; }
	private formatCompactList(items: string[], options?: { sort?: boolean }): string {
		const labels = items.map(i => i.trim()).filter(i => i.length > 0);
		if (options?.sort !== false) labels.sort((a, b) => a.localeCompare(b));
		return theme().fg("dim", `  ${labels.join(", ")}`);
	}
	private showWarning(container: Container, message: string): void {
		container.addChild(new Text(theme().fg("warning", `⚠ ${message}`), 0, 0));
		container.addChild(new Spacer(1));
	}
	private showError(container: Container, message: string): void {
		container.addChild(new Text(theme().fg("error", `✖ ${message}`), 0, 0));
		container.addChild(new Spacer(1));
	}
	private showNewVersionNotification(container: Container, newRelease: any): void {
		this.showWarning(container, `New version: ${newRelease.tag_name}`);
	}
	private showPackageUpdateNotification(container: Container, updates: string[]): void {
		this.showWarning(container, `Updates: ${updates.join(", ")}`);
	}
}

// ============================================================================
// RUNNER
// ============================================================================

export async function runInteractiveMode(runtime: AgentSessionRuntime): Promise<void> {
	await new InteractiveMode(runtime).run();
}

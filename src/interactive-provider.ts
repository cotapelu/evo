/**
 * Interactive Mode - Minimal rewrite
 */

import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "child_process";

import type { AssistantMessage } from "@earendil-works/pi-ai";
import { TUI, ProcessTerminal, Container, Text, Spacer, setKeybindings, Markdown, matchesKey, type KeyId } from "@earendil-works/pi-tui";

import {
	AgentSessionRuntime,
	CustomEditor,
	FooterComponent,
	InteractiveModeOptions,
	AssistantMessageComponent,
	UserMessageComponent,
	ToolExecutionComponent,
	DynamicBorder,
	getMarkdownTheme,
	getSelectListTheme,
	ThinkingSelectorComponent,
	ModelSelectorComponent,
	keyHint,
	keyText,
	rawKeyHint,
} from "@earendil-works/pi-coding-agent";
import { KeybindingsManager } from "./runtime/keybindings-manager.js";
import { FooterDataProvider } from "./runtime/footer-data-provider.js";
import { ExpandableText } from "./interactive/components/expandable-text.js";
import { initTheme as piInitTheme } from "@earendil-works/pi-coding-agent";

// ============================================================================
// CONFIG
// ============================================================================

const APP_NAME = "Pi";
const VERSION = "0.1.0";

function getAgentDir(): string { return path.join(os.homedir(), ".pi"); }
function getDocsPath(): string { return path.join(getAgentDir(), "docs"); }
function getChangelogPath(): string { return path.join(getDocsPath(), "CHANGELOG.md"); }
function parseChangelog(content: string): any[] { return []; }
function getNewEntries(all: any[], last: string): any[] { return []; }
async function ensureTool(name: "fd" | "rg"): Promise<string> { return ""; }

// Minimal theme for internal use
const minimalTheme = { bold: (t: string) => t, fg: (_: string, t: string) => t };
let currentTheme = minimalTheme;
function theme() { return currentTheme; }
function initTheme(name: string, silent: boolean) { piInitTheme(name, silent); }

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
	private toolComponents: ToolExecutionComponent[] = [];
	private skillCommands = new Map<string, string>();
	private shutdownRequested = false;
	private fdPath?: string;

	private get session(): any { return this.runtimeHost.session; }
	private get settingsManager(): any { return this.session.settingsManager; }
	private get sessionManager(): any { return this.session.sessionManager; }

	constructor(runtimeHost: AgentSessionRuntime, options: InteractiveModeOptions = {}) {
		this.runtimeHost = runtimeHost;
		this.options = options;
		setKeybindings(this.keybindings as any);
		initTheme((this.settingsManager as any).getTheme(), true);
		this.footerDataProvider = new FooterDataProvider(this.sessionManager.getCwd());
		this.footer = new FooterComponent(this.session, this.footerDataProvider);
		this.footer.setAutoCompactEnabled(this.session.autoCompactionEnabled);
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
				if (!last) (this.settingsManager as any).setLastChangelogVersion(VERSION);
				else {
					const newE = getNewEntries(entries, last);
					if (newE.length > 0) {
						this.changelogMarkdown = newE.map((e: any) => e.content).join("\n\n");
						(this.settingsManager as any).setLastChangelogVersion(VERSION);
					}
				}
			}
		} catch {}
		// Ensure tools
		try { await ensureTool("fd"); } catch (e) { console.warn("fd not available"); }
		// TUI
		this.ui = new TUI(new ProcessTerminal(), (this.settingsManager as any).getShowHardwareCursor());
		this.ui.setClearOnShrink((this.settingsManager as any).getClearOnShrink());
		// Editor
		const editorPaddingX = (this.settingsManager as any).getEditorPaddingX();
		const autocompleteMaxVisible = (this.settingsManager as any).getAutocompleteMaxVisible();
		const editorTheme = {
			borderColor: (s: string) => theme().fg("border", s),
			selectList: getSelectListTheme()
		};
		this.defaultEditor = new CustomEditor(this.ui, editorTheme as any, this.keybindings as any, {
			paddingX: editorPaddingX,
			autocompleteMaxVisible,
		});
		this.editor = this.defaultEditor;
		this.editorContainer.addChild(this.editor as any);
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
		this.ui.addInputListener(this.handleGlobalKey.bind(this));
		this.isInitialized = true;
		// Subscribe
		this.subscribeToAgent();
		// Render initial messages
		this.renderInitialMessages();
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
		// Top border
		this.chatContainer.addChild(new DynamicBorder());
		this.chatContainer.addChild(new Text(theme().bold(theme().fg("accent", "What's New")), 1, 0));
		this.chatContainer.addChild(new Spacer(1));
		// Render full changelog as Markdown
		const mdTheme = getMarkdownTheme();
		this.chatContainer.addChild(new Markdown(this.changelogMarkdown, 1, 0, mdTheme));
		// Bottom border
		this.chatContainer.addChild(new DynamicBorder());
	}

	private showThinkingSelector(): void {
		const currentLevel = this.session.thinkingLevel;
		const availableLevels: Array<"off" | "minimal" | "low" | "medium" | "high" | "xhigh"> = 
			["off", "minimal", "low", "medium", "high", "xhigh"];
		const component = new ThinkingSelectorComponent(
			currentLevel,
			availableLevels,
			(level) => {
				this.session.setThinkingLevel(level);
				this.ui.hideOverlay();
			},
			() => {
				this.ui.hideOverlay();
			}
		);
		this.ui.showOverlay(component);
	}

	private showModelSelector(): void {
		const currentModel = this.session.model;
		const settingsManager = this.session.settingsManager;
		const modelRegistry = this.session.modelRegistry;
		const scopedModels = this.session.scopedModels;
		const component = new ModelSelectorComponent(
			this.ui,
			currentModel,
			settingsManager,
			modelRegistry,
			scopedModels,
			(model) => {
				this.session.model = model;
				this.ui.hideOverlay();
			},
			() => {
				this.ui.hideOverlay();
			}
		);
		this.ui.showOverlay(component);
	}

	private subscribeToAgent(): void {
		this.unsubscribe = this.session.subscribe((event: any) => {
			if (event.type === "message_end" && event.message?.role === "assistant") {
				const comp = new AssistantMessageComponent(event.message);
				this.chatContainer.addChild(comp);
				this.ui.requestRender();
			} else if (event.type === "tool_call") {
				const ToolExec = ToolExecutionComponent as any;
				const toolComp = new ToolExec(event.tool, {
					expandByDefault: this.toolOutputExpanded,
					hideThinking: this.hideThinkingBlock,
				});
				(toolComp as any).setExpanded?.(this.toolOutputExpanded);
				this.toolComponents.push(toolComp as any);
				(this.chatContainer as any).addChild(toolComp);
				(this.ui as any).requestRender();
			}
		});
	}

	private async bindCurrentSessionExtensions(): Promise<void> {
		(this.defaultEditor as any).setAutocomplete?.({} as any);
	}

	private async showLoadedResources(options?: any): Promise<void> {
		try {
			const resources = await Promise.all([
				(this.session.resourceLoader as any).getSkills(),
				(this.session.resourceLoader as any).getPrompts(),
				(this.session.resourceLoader as any).getExtensions(),
				(this.session.resourceLoader as any).getThemes(),
				(this.session.resourceLoader as any).getAgentsFiles(),
			]);
			const [skills, prompts, extensions, themes, agents] = resources;
			const sCount = skills?.skills?.length || 0;
			const pCount = prompts?.prompts?.length || 0;
			const eCount = extensions?.extensions?.length || 0;
			const tCount = themes?.themes?.length || 0;
			const aCount = agents?.agentsFiles?.length || 0;
			const total = sCount + pCount + eCount + tCount + aCount;
			let content = "Loaded Resources:\n";
			content += `Skills: ${sCount}\n`;
			content += `Prompts: ${pCount}\n`;
			content += `Extensions: ${eCount}\n`;
			content += `Themes: ${tCount}\n`;
			content += `Agents: ${aCount}\n`;
			if (total === 0) content = "No resources loaded.";
			(this.chatContainer as any).addChild(new Text(content, 1, 0));
		} catch (err: any) {
			console.error("Error loading resources:", err);
			(this.chatContainer as any).addChild(new Text("Failed to load resources.", 1, 0));
		}
	}

	private renderInitialMessages(): void {
		const state = this.session.state;
		const messages = (state as any).messages || [];
		for (const msg of messages) {
			if (msg.role === "user") {
				this.chatContainer.addChild(new UserMessageComponent(msg as any));
			} else if (msg.role === "assistant") {
				this.chatContainer.addChild(new AssistantMessageComponent(msg as any));
			}
		}
	}

	private setupKeyHandlers(): void {}

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
			const userMsg = { role: "user" as const, content: [{ type: "text" as const, text }] };
			this.chatContainer.addChild(new UserMessageComponent(userMsg as any));
			try {
				await this.session.prompt(text);
			} catch (error: any) {
				console.error("Prompt error:", error?.message || error);
			}
		};
		this.editor.onSubmit = onSubmit;
	}

	private async handleSlashCommand(text: string): Promise<void> {
		const [cmd, ...args] = text.slice(1).split(" ");
		switch (cmd) {
			case "clear": this.chatContainer.clear(); break;
			case "exit": case "quit": await this.shutdown(); break;
			case "compact": try { await (this.session as any).compact?.(); } catch (e) { console.error("Compaction failed:", e); } break;
			case "model":
				if (args.length === 0) {
					const result = (this.session as any).cycleModel?.();
					if (result) console.log(`Switched to ${result.model.id}`);
				} else {
					const spec = args.join(" ");
					const available = (this.session.modelRegistry?.getAvailable?.() || []) as any[];
					const match = available.find((m: any) => `${m.provider}/${m.id}` === spec || m.id === spec);
					if (match) { (this.session as any).model = match; console.log(`Model set to ${match.id}`); }
					else console.log(`Model not found: ${spec}`);
				}
				break;
			case "thinking": await this.showThinkingSelector(); break;
			case "models": await this.showModelSelector(); break;
			case "resources": await this.showLoadedResources(); break;
			default: console.log(`Unknown command: /${cmd}`);
		}
	}

	private handleGlobalKey(data: string): { consume?: boolean } | undefined {
		if (matchesKey(data, "app.thinking.toggle" as KeyId)) {
			this.showThinkingSelector();
			return { consume: true };
		}
		if (matchesKey(data, "app.thinking.cycle" as KeyId)) {
			const current = this.session.thinkingLevel;
			const levels: Array<"off" | "minimal" | "low" | "medium" | "high" | "xhigh"> = 
				["off", "minimal", "low", "medium", "high", "xhigh"];
			const idx = levels.indexOf(current as any);
			const nextIdx = (idx + 1) % levels.length;
			this.session.setThinkingLevel(levels[nextIdx]);
			return { consume: true };
		}
		if (matchesKey(data, "app.model.select" as KeyId)) {
			this.showModelSelector();
			return { consume: true };
		}
		if (matchesKey(data, "app.tools.expand" as KeyId)) {
			this.toolOutputExpanded = !this.toolOutputExpanded;
			for (const comp of this.toolComponents) {
				(comp as any).setExpanded?.(this.toolOutputExpanded);
			}
			this.ui.requestRender();
			return { consume: true };
		}
		return undefined;
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
			const handler = () => { console.log("\nShutting down..."); void this.shutdown(); };
			process.on(sig, handler);
			this.signalCleanupHandlers.push(() => process.off(sig, handler));
		}
		process.on("unhandledRejection", (reason) => { console.error("Unhandled rejection:", reason); process.exit(1); });
		process.on("uncaughtException", (err) => { console.error("Uncaught exception:", err); process.exit(1); });
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
		process.exit(0);
	}

	async run(): Promise<void> {
		await this.init();
		while (!this.shutdownRequested) {
			await new Promise(r => setTimeout(r, 100));
		}
	}

	stop(): void { this.shutdown(); }
}

export function setupShutdownHandlers(): void {}

export async function runInteractiveMode(runtime: AgentSessionRuntime): Promise<void> {
	await new InteractiveMode(runtime).run();
}

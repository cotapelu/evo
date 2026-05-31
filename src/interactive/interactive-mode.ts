/**
 * InteractiveMode - Orchestrates UI, input, and agent interaction.
 * Refactored with modular components for SRP and testability.
 * Pattern inspired by llm-context/coding-agent (no code copied).
 */

import { TUI, ProcessTerminal, Container, Text, Spacer, setKeybindings, Markdown, CombinedAutocompleteProvider, Loader } from '@earendil-works/pi-tui';
import {
  AgentSessionRuntime,
  CustomEditor,
  FooterComponent,
  InteractiveModeOptions,
  AssistantMessageComponent,
  UserMessageComponent,
  ToolExecutionComponent,
  BashExecutionComponent,
  DynamicBorder,
  getMarkdownTheme,
  getSelectListTheme,
  ThinkingSelectorComponent,
  ModelSelectorComponent,
  keyHint,
  keyText,
  rawKeyHint,
  initTheme as piInitTheme,
} from '@earendil-works/pi-coding-agent';
import { KeybindingsManager } from '../runtime/keybindings-manager.js';
import { FooterDataProvider } from '../runtime/footer-data-provider.js';
import { getChangelogPath, parseChangelog, getNewEntries } from './utils/changelog.js';
import { spawnSync } from 'child_process';

// Modular components
import { KeyboardManager } from './keyboard-manager.js';
import { SlashCommandHandler, SlashCommandContext } from './slash-command-handler.js';
import { MessageRenderer } from './message-renderer.js';

// === Type definitions for reducing 'as any' casts ===
interface EvoSettingsManager {
  getTheme(): string;
  getShowHardwareCursor(): boolean;
  getClearOnShrink(): boolean;
  getEditorPaddingX(): number;
  getAutocompleteMaxVisible(): number;
  getQuietStartup(): boolean;
  getLastChangelogVersion(): string | undefined;
  setLastChangelogVersion(version: string): void;
}

interface EditorWithAutocomplete {
  setAutocomplete?(provider: any): void;
}

interface ResourceLoaderExt {
  getSkills(): any;
  getPrompts(): any;
  getExtensions(): any;
  getThemes(): any;
  getAgentsFiles(): any;
}

interface ToolExecutionComp {
  setExpanded?(expanded: boolean): void;
  setComplete(code: number, success: boolean, details?: any, error?: any): void;
}

interface BashExecutionComp {
  appendOutput(output: string): void;
  setComplete(exitCode: number, success: boolean, details?: any, error?: any): void;
}

interface DynamicBorderComp {}

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

const EMPTY_PROVIDER: any = {};

const APP_NAME = "Pi";
const VERSION = "0.1.0";

const BUILTIN_SLASH_COMMANDS = [
  { name: 'clear', description: 'Clear chat' },
  { name: 'exit', description: 'Exit' },
  { name: 'quit', description: 'Exit' },
  { name: 'compact', description: 'Compact session' },
  { name: 'model', description: 'Cycle or select model' },
  { name: 'thinking', description: 'Select thinking level' },
  { name: 'models', description: 'Open model selector' },
  { name: 'resources', description: 'Show loaded resources' },
];

async function ensureTool(name: "fd" | "rg"): Promise<string> { return ""; }

const minimalTheme = { 
  bold: (t: string) => t, 
  fg: (_: string, t: string) => t,
  dim: (t: string) => t
};
let currentTheme = minimalTheme;
function theme() { return currentTheme; }
function initTheme(name: string, silent: boolean) { piInitTheme(name, silent); }

/**
 * InteractiveMode – main orchestrator.
 * Delegates:
 *  - Keyboard handling → KeyboardManager
 *  - Slash commands → SlashCommandHandler
 *  - Message rendering → MessageRenderer
 * Keeps only orchestration & UI-specific logic.
 */
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
  private fdPath = '';
  private loadingAnimation?: any;
  private defaultWorkingMessage = "Working...";
  private workingVisible = true;
  private lastStatusSpacer?: any;
  private lastStatusText?: any;

  // Typed getters to reduce 'as any' casts
  private get typedSettings(): EvoSettingsManager {
    return this.settingsManager as EvoSettingsManager;
  }
  private get typedEditor(): EditorWithAutocomplete {
    return this.editor as EditorWithAutocomplete;
  }
  private get typedDefaultEditor(): EditorWithAutocomplete {
    return this.defaultEditor as EditorWithAutocomplete;
  }
  private get typedResourceLoader(): ResourceLoaderExt {
    return this.session.resourceLoader as ResourceLoaderExt;
  }

  // Handlers (injected during init)
  private keyboardManager!: KeyboardManager;
  private slashCommandHandler!: SlashCommandHandler;
  private messageRenderer!: MessageRenderer;

  private get session(): any { return this.runtimeHost.session; }
  private get settingsManager(): any { return this.session.settingsManager; }
  private get sessionManager(): any { return this.session.sessionManager; }

  constructor(runtimeHost: AgentSessionRuntime, options: InteractiveModeOptions = {}) {
    this.runtimeHost = runtimeHost;
    this.options = options;
    setKeybindings(this.keybindings as any);
    initTheme(this.typedSettings.getTheme(), true);
    this.footerDataProvider = new FooterDataProvider(this.sessionManager.getCwd());
    this.footer = new FooterComponent(this.session, this.footerDataProvider);
    this.footer.setAutoCompactEnabled(this.session.autoCompactionEnabled);
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;
    const initStart = Date.now();
    this.registerSignalHandlers();

    // Load changelog
    try {
      const cp = getChangelogPath();
      if (typeof require !== "undefined" && require("fs").existsSync(cp)) {
        const content = require("fs").readFileSync(cp, "utf8");
        const entries = parseChangelog(content);
        const last = this.typedSettings.getLastChangelogVersion();
        if (!last) this.typedSettings.setLastChangelogVersion(VERSION);
        else {
          const newE = getNewEntries(entries, last);
          if (newE.length > 0) {
            this.changelogMarkdown = newE.map((e: any) => e.content).join("\n\n");
            this.typedSettings.setLastChangelogVersion(VERSION);
          }
        }
      }
    } catch (e: any) {
      console.error('[Changelog] Failed to load or parse changelog:', e?.message || e);
    }

    // Ensure tools
    let fdPath = '';
    try {
      fdPath = await ensureTool('fd');
    } catch (e) {
      console.warn('fd not available for file autocomplete');
    }
    this.fdPath = fdPath;

    // TUI
    this.ui = new TUI(new ProcessTerminal(), this.typedSettings.getShowHardwareCursor());
    this.ui.setClearOnShrink(this.typedSettings.getClearOnShrink());

    // Editor
    const editorPaddingX = this.typedSettings.getEditorPaddingX();
    const autocompleteMaxVisible = this.typedSettings.getAutocompleteMaxVisible();
    const editorTheme: any = {
      borderColor: (s: string) => theme().fg("border", s),
      selectList: getSelectListTheme()
    };
    this.defaultEditor = new CustomEditor(this.ui, editorTheme, this.keybindings as any, {
      paddingX: editorPaddingX,
      autocompleteMaxVisible,
    });
    this.editor = this.defaultEditor;

    // Setup autocomplete
    const slashCommands = BUILTIN_SLASH_COMMANDS.map(cmd => ({
      value: cmd.name,
      label: cmd.name,
      description: cmd.description,
    }));
    // Using CombinedAutocompleteProvider with dynamic signature
    const AutocompleteProviderCtor = CombinedAutocompleteProvider as new (slashCommands: any[], cwd: string, fdPath: string | null) => any;
    const autocompleteProvider = new AutocompleteProviderCtor(
      slashCommands,
      this.sessionManager.getCwd(),
      this.fdPath || null
    );
    this.typedEditor.setAutocomplete?.(autocompleteProvider);
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

    // Initialize handlers
    this.keyboardManager = new KeyboardManager();
    this.messageRenderer = new MessageRenderer(this.chatContainer);
    this.slashCommandHandler = new SlashCommandHandler({
      chatContainer: this.chatContainer,
      session: this.session,
      shutdown: () => this.shutdown(),
      showThinkingSelector: () => this.showThinkingSelector(),
      showModelSelector: () => this.showModelSelector(),
      showLoadedResources: () => this.showLoadedResources(),
    } as SlashCommandContext);

    this.setupKeyHandlers();
    this.setupEditorSubmitHandler();

    // Start
    this.ui.start();
    this.ui.addInputListener((data) => {
      return this.keyboardManager.handle(data);
    });

    this.isInitialized = true;
    this.subscribeToAgent();
    this.renderInitialMessages();
    if (this.changelogMarkdown) this.showStartupNotices();

    const initDuration = Date.now() - initStart;
    console.log(`⏱️  InteractiveMode init: ${initDuration}ms`);
  }

  private buildHeader(): void {
    if (this.options.verbose || !this.typedSettings.getQuietStartup()) {
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
      this.headerContainer.addChild(new Text(`${logo}\n${expanded}\n`, 1, 0));
      this.headerContainer.addChild(new Spacer(1));
    }
  }

  private showStartupNotices(): void {
    if (this.startupNoticesShown || !this.changelogMarkdown) return;
    this.startupNoticesShown = true;
    if (this.chatContainer.children.length > 0) this.chatContainer.addChild(new Spacer(1));
    this.chatContainer.addChild(new (DynamicBorder as any)());
    this.chatContainer.addChild(new Text(theme().bold(theme().fg("accent", "What's New")), 1, 0));
    this.chatContainer.addChild(new Spacer(1));
    const mdTheme = getMarkdownTheme();
    this.chatContainer.addChild(new (DynamicBorder as any)());
    this.chatContainer.addChild(new Markdown(this.changelogMarkdown, 1, 0, mdTheme));
    this.chatContainer.addChild(new (DynamicBorder as any)());
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
      if (event.type === "turn_start") {
        this.showWorkingIndicator();
      } else if (event.type === "turn_end") {
        this.hideWorkingIndicator();
      } else if (event.type === "message_end" && event.message?.role === "assistant") {
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
        this.chatContainer.addChild(toolComp as any);
        this.ui.requestRender();
      }
    });
  }

  private showWorkingIndicator(): void {
    if (!this.workingVisible) return;
    if (!this.loadingAnimation) {
      this.loadingAnimation = new Loader(
        this.ui,
        (spinner) => theme().fg("accent", spinner),
        (text) => theme().fg("muted", text),
        this.defaultWorkingMessage
      );
    }
    if (this.statusContainer.children.indexOf(this.loadingAnimation) === -1) {
      this.statusContainer.addChild(this.loadingAnimation);
    }
    this.loadingAnimation.start();
    this.ui.requestRender();
  }

  private hideWorkingIndicator(): void {
    if (this.loadingAnimation) {
      this.loadingAnimation.stop();
      this.statusContainer.removeChild(this.loadingAnimation);
      this.ui.requestRender();
    }
  }

  private async showLoadedResources(options?: any): Promise<void> {
    try {
      const resources = await Promise.all([
        this.typedResourceLoader.getSkills(),
        this.typedResourceLoader.getPrompts(),
        this.typedResourceLoader.getExtensions(),
        this.typedResourceLoader.getThemes(),
        this.typedResourceLoader.getAgentsFiles(),
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
      this.chatContainer.addChild(new Text(content, 1, 0));
    } catch (err: any) {
      console.error("Error loading resources:", err);
      this.chatContainer.addChild(new Text("Failed to load resources.", 1, 0));
    }
  }

  private renderInitialMessages(): void {
    const state = this.session.state as { messages?: any[] };
    const messages = state.messages || [];
    this.messageRenderer.render(messages);
  }

  private setupKeyHandlers(): void {
    // Register global key handlers via KeyboardManager
    this.keyboardManager.register('app.thinking.toggle', () => {
      this.showThinkingSelector();
      return { consume: true };
    });
    this.keyboardManager.register('app.thinking.cycle', () => {
      const current = this.session.thinkingLevel;
      const levels: Array<"off" | "minimal" | "low" | "medium" | "high" | "xhigh"> = 
        ["off", "minimal", "low", "medium", "high", "xhigh"];
      const idx = levels.indexOf(current as ThinkingLevel);
      const nextIdx = (idx + 1) % levels.length;
      this.session.setThinkingLevel(levels[nextIdx]);
      return { consume: true };
    });
    this.keyboardManager.register('app.model.select', () => {
      this.showModelSelector();
      return { consume: true };
    });
    this.keyboardManager.register('app.tools.expand', () => {
      this.toolOutputExpanded = !this.toolOutputExpanded;
      for (const comp of this.toolComponents) {
        (comp as any).setExpanded?.(this.toolOutputExpanded);
      }
      this.ui.requestRender();
      return { consume: true };
    });
  }

  // Wrapper methods for backward compatibility with tests (refactor kept private)
  private async handleSlashCommand(text: string): Promise<void> {
    const [cmd, ...args] = text.slice(1).split(" ");
    await this.slashCommandHandler.handle(cmd, args);
  }

  private handleGlobalKey(data: string): { consume?: boolean } | undefined {
    return this.keyboardManager.handle(data);
  }

  private setupEditorSubmitHandler(): void {
    const onSubmit = async (text: string) => {
      this.editor.setText("");
      if (text.startsWith("/")) {
        const [cmd, ...args] = text.slice(1).split(" ");
        await this.slashCommandHandler.handle(cmd, args);
        return;
      }
      if (text.startsWith("!")) {
        this.handleBash(text.startsWith("!!"));
        return;
      }
      this.chatContainer.addChild(new UserMessageComponent(text));
      try {
        await this.session.prompt(text);
      } catch (error: any) {
        console.error("Prompt error:", error?.message || error);
      }
    };
    this.editor.onSubmit = onSubmit;
  }

  private handleBash(noContext: boolean): void {
    const text = this.editor.getText();
    if (!text.trim()) return;
    const cmd = text.replace(/^!+/, "").trim();
    
    // Input validation: reject null bytes
    if (cmd.includes('\0')) {
      this.showError('Command contains null bytes - rejected');
      return;
    }
    
    // Warn about potentially dangerous patterns (but still allow - user responsibility)
    const dangerousPatterns = [
      /^rm\s+-rf\s+\//,
      /^\(/,
      /^dd\s+if=\/dev\/zero/,
      /^mkfs/,
      /^chmod\s+-R\s+777\s+\//,
    ];
    if (dangerousPatterns.some(p => p.test(cmd))) {
      console.warn('[Security] Potentially dangerous bash command executed:', cmd);
    }
    
    try {
      const result = spawnSync(cmd, { shell: true, encoding: "utf8" });
      const output = result.stdout || result.stderr || "";
      const BashComp = BashExecutionComponent as any;
      const bashComponent = new BashComp(cmd, this.ui, noContext);
      bashComponent.appendOutput(output);
      const exitCode = result.status ?? 0;
      bashComponent.setComplete(exitCode, false, undefined, undefined);
      this.chatContainer.addChild(bashComponent as any);
      this.ui.requestRender();
    } catch (e: any) {
      console.error('[BashCommandError] Failed command:', cmd, e);
      this.showError(`Bash error: ${e.message}`);
      this.ui.requestRender();
    }
    this.editor.setText("");
  }

  private showError(message: string): void {
    this.chatContainer.addChild(new Text(`Error: ${message}`, 1, 0));
  }

  private async bindCurrentSessionExtensions(): Promise<void> {
    this.typedDefaultEditor.setAutocomplete?.(EMPTY_PROVIDER);
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

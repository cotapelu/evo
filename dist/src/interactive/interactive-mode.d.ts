/**
 * InteractiveMode for Evo Agent - Minimal Viable Version
 * Orchestrates TUI UI, input, and agent interaction.
 */
import type { AgentSessionRuntime } from '@earendil-works/pi-coding-agent';
export interface InteractiveModeOptions {
    initialMessage?: string;
    initialImages?: any[];
    initialMessages?: string[];
    verbose?: boolean;
    migratedProviders?: string[];
    modelFallbackMessage?: string;
}
export declare class InteractiveMode {
    private runtimeHost;
    private options;
    private ui;
    private chatContainer;
    private pendingMessagesContainer;
    private statusContainer;
    private headerContainer;
    private editorContainer;
    private widgetContainerAbove;
    private widgetContainerBelow;
    private keybindings;
    private defaultEditor;
    private editor;
    private footerDataProvider;
    private footer;
    private isInitialized;
    private unsubscribe?;
    private signalCleanupHandlers;
    private changelogMarkdown?;
    private startupNoticesShown;
    private toolOutputExpanded;
    private hideThinkingBlock;
    private shutdownRequested;
    private lastSigintTime;
    private lastEscapeTime;
    private isBashMode;
    private fdPath;
    private loadingAnimation?;
    private defaultWorkingMessage;
    private workingVisible;
    private lastStatusSpacer?;
    private lastStatusText?;
    private builtInHeader?;
    private streamingComponent?;
    private streamingMessage?;
    private pendingTools;
    private toolComponents;
    private autoCompactionLoader?;
    private autoCompactionEscapeHandler?;
    private compactionQueuedMessages;
    private retryLoader?;
    private retryCountdown?;
    private retryEscapeHandler?;
    private autocompleteProvider?;
    private bashComponent?;
    private isBashRunning;
    private get session();
    private get settingsManager();
    private get sessionManager();
    constructor(runtimeHost: AgentSessionRuntime, options?: InteractiveModeOptions);
    init(): Promise<void>;
    private buildHeader;
    private setupKeyHandlers;
    private setupEditorSubmitHandler;
    /** Handle slash command routing */
    private handleSlashCommand;
    /** Resume a specific session file (used by extensions) */
    private handleResumeSession;
    /** Bind session extensions including autocomplete provider */
    private bindCurrentSessionExtensions;
    /** Handle global keypresses (e.g., from keybindings manager) */
    private handleGlobalKey;
    private handleCtrlC;
    private handleCtrlD;
    private handleCtrlZ;
    private clearEditor;
    private cycleThinkingLevel;
    private cycleModel;
    private toggleToolOutputExpansion;
    private toggleThinkingBlockVisibility;
    private handleFollowUp;
    private handleDequeue;
    private handleClipboardImagePaste;
    private handleDebugCommand;
    private getUserInput;
    private getEditorThemeWithSelect;
    private getMarkdownThemeWithSettings;
    /** Auto-compaction loader control */
    private showAutoCompactionLoader;
    private hideAutoCompactionLoader;
    private hideRetryLoader;
    private flushCompactionQueue;
    private isExtensionCommand;
    private showExtensionError;
    private handleFatalRuntimeError;
    private setupAutocompleteProvider;
    private setupExtensionShortcuts;
    /** Create Extension UIContext for extension UI requests */
    private createExtensionUIContext;
    /** Get the current theme object */
    private theme;
    private updateEditorBorderColor;
    /** Get capitalized display string for an app keybinding action. */
    private getAppKeyDisplay;
    /** Get capitalized display string for an editor keybinding action. */
    private getEditorKeyDisplay;
    private renderInitialMessages;
    run(): Promise<void>;
    private subscribeToAgent;
    private handleEvent;
    private createWorkingLoader;
    private showWorkingIndicator;
    private stopWorkingLoader;
    private addMessageToChat;
    private getUserMessageText;
    private getAssistantMessageText;
    private getRegisteredToolDefinition;
    /**
     * Get all queued messages (steering + followUp) from session and compaction queue.
     */
    private getAllQueuedMessages;
    /**
     * Clear all queues and return their contents.
     */
    private clearAllQueues;
    private restoreQueuedMessagesToEditor;
    private queueCompactionMessage;
    private updatePendingMessagesDisplay;
    private showModelSelector;
    private showTreeSelector;
    private showThinkingSelector;
    private showSessionSelector;
    private showSessionStats;
    private formatSessionStats;
    private showDebugInfo;
    private formatDebugInfo;
    private handleShare;
    private openExternalEditor;
    private handleLogin;
    private handleLogout;
    private handleExportJson;
    private handleImport;
    private checkForUpdates;
    private showEasterEgg;
    private showUserMessageSelector;
    private createGistViaGh;
    private showSettingsSelector;
    private showHotkeys;
    private applyRuntimeSettings;
    private rebindCurrentSession;
    private renderCurrentSessionState;
    /**
     * Rebuild chat from current session messages.
     * Used after compaction or navigation.
     */
    private rebuildChatFromMessages;
    /**
     * Render session context with full tool handling.
     */
    private renderSessionContext;
    private showStartupNotices;
    private handleClearCommand;
    private handleModelCommand;
    private handleModelsCommand;
    private reloadResources;
    private showChangelog;
    private showLoadedResources;
    private renameSession;
    private handleCopyCommand;
    private handlePasteCommand;
    private cloneSession;
    private forkSession;
    private toggleDebug;
    /** Execute a bash command string (internal) */
    private executeBash;
    /** Handle bash command from editor (reads text) */
    private handleBash;
    /** Display an error message in chat */
    private showError;
    /** Display a status message (dim) in chat */
    private showStatus;
    /** Display a warning message in chat */
    private showWarning;
    private showNewVersionNotification;
    /** Display loaded extensions/resources summary */
    private updateTerminalTitle;
    private updateAvailableProviderCount;
    private maybeWarnAboutAnthropicSubscriptionAuth;
    /** Graceful shutdown */
    private shutdown;
    private checkShutdownRequested;
    /** Register signal handlers for graceful shutdown */
    private registerSignalHandlers;
}
export declare function runInteractiveMode(runtime: AgentSessionRuntime): Promise<void>;
export declare const setupShutdownHandlers: () => void;
//# sourceMappingURL=interactive-mode.d.ts.map
# Evo Agent - Development TODO

## Tổng quan
Nâng cấp hệ thống interactive mode từ implementation đơn giản hiện tại lên full-featured, tham khảo kiến trúc từ `llm-context/coding-agent` nhưng viết code gốc (no copyright violation).

## Phân tích Chi Tiết Theo Từng Phần

### 📁 **Phase 1: CONFIG & INFRASTRUCTURE** (15 tasks)

#### 1.1 Config Module (`src/config.ts`)
- [ ] **1.1.1** Define APP_NAME, VERSION, APP_TITLE constants
- [ ] **1.1.2** Implement `getAgentDir()` - XDG config home support
- [ ] **1.1.3** Implement `getAuthPath()` - auth.json location
- [ ] **1.1.4** Implement `getDebugLogPath()` - debug log location
- [ ] **1.1.5** Implement `getDocsPath()` - docs directory
- [ ] **1.1.6** Implement `getChangelogPath()` - CHANGELOG.md location
- [ ] **1.1.7** Implement `getShareViewerUrl(gistId)` - share URL builder
- [ ] **1.1.8** Implement `getBinDir()` - binary downloads directory

#### 1.2 Theme System (`src/interactive/theme/theme.ts`)
- [ ] **1.2.1** Import pi-coding-agent theme APIs
- [ ] **1.2.2** Implement `initTheme(name, silent)` with watcher
- [ ] **1.2.3** Implement `theme()` getter with auto-init
- [ ] **1.2.4** Implement `getMarkdownTheme(settings?)` - code block indent
- [ ] **1.2.5** Implement `getSelectListTheme()` - dropdown styling
- [ ] **1.2.6** Implement `getBashModeBorderColor()` - green accent
- [ ] **1.2.7** Implement `getThinkingBorderColor(level)` - level-based colors
- [ ] **1.2.8** Implement `stopThemeWatcher()` - cleanup
- [ ] **1.2.9** Implement `getAvailableThemes()` - list from package
- [ ] **1.2.10** Implement `getThemeByName(name)` - look up
- [ ] **1.2.11** Implement `setTheme(name, silent)` - with error handling
- [ ] **1.2.12** Implement `setThemeInstance(theme)` - direct set

#### 1.3 Utils Cluster
**Clipboard (`src/utils/clipboard.ts`):**
- [ ] **1.3.1** Implement `copyToClipboard(text)` - macOS/Windows/Linux
- [ ] **1.3.2** Implement `readClipboardImage()` - platform-specific image read
- [ ] **1.3.3** Implement `extensionForImageMimeType(mimeType)` - mapping

**Git (`src/utils/git.ts`):**
- [ ] **1.3.4** Implement `parseGitUrl(url)` - support git@, ssh, https formats

**Shell (`src/utils/shell.ts`):**
- [ ] **1.3.5** Implement `trackDetachedChild(proc)` - process tracking
- [ ] **1.3.6** Implement `killTrackedDetachedChildren()` - shutdown cleanup
- [ ] **1.3.7** Implement `isInsideTmux()` - check
- [ ] **1.3.8** Implement `getTerminalSize()` - columns/rows
- [ ] **1.3.9** Implement `spawnInteractive()` - inherit stdio
- [ ] **1.3.10** Implement `spawnCapture()` - capture stdout/stderr

**Tools Manager (`src/utils/tools-manager.ts`):**
- [ ] **1.3.11** Define TOOLS registry (fd, rg, gh)
- [ ] **1.3.12** Implement `isToolAvailable(name)` - which/where check
- [ ] **1.3.13** Implement `ensureTool(name)` - availability check (download future)
- [ ] **1.3.14** Implement `checkToolInstalled(name)` - boolean
- [ ] **1.3.15** Implement `getToolVersion(name)` - version string

**Version Check (`src/utils/version-check.ts`):**
- [ ] **1.3.16** Implement `checkForNewPiVersion()` - npm registry query
- [ ] **1.3.17** Implement `checkForPackageUpdates()` - npm outdated parser

**Utils Barrel (`src/utils/index.ts`):**
- [ ] **1.3.18** Export all utils in one place

#### 1.4 Components Index (`src/interactive/components/index.ts`)
- [ ] **1.4.1** Create barrel export for all components (future)
- [ ] **1.4.2** Export existing ExpandableText
- [ ] **1.4.3** Add placeholder exports for upcoming components

#### 1.5 Keybindings Enhancements (`src/runtime/keybindings-manager.ts`)
- [ ] **1.5.1** Ensure `getEffectiveConfig()` method exists
- [ ] **1.5.2** Add support for extension shortcut registration
- [ ] **1.5.3** Implement proper key matching with matchesKey

#### 1.6 Footer Data (`src/runtime/footer-data-provider.ts`)
- [ ] **1.6.1** Add git branch tracking with onBranchChange
- [ ] **1.6.2** Add extension statuses map
- [ ] **1.6.3** Add available provider count tracking

---

### 📁 **Phase 2: COMPLEX UI COMPONENTS** (30 tasks)

**Note**: These components are referenced from pi-coding-agent exports. We will import and adapt them, or implement simplified versions if not exported.

#### 2.1 Tool Execution (`src/interactive/components/tool-execution.ts`)
- [ ] **2.1.1** Create file with imports from pi-coding-agent
- [ ] **2.1.2** Define props: toolName, toolCallId, args, options
- [ ] **2.1.3** Implement expandable UI (chevron toggle)
- [ ] **2.1.4** Implement argument display (formatted JSON)
- [ ] **2.1.5** Implement result display (text/image)
- [ ] **2.1.6** Implement diff view for code changes (if edit tool)
- [ ] **2.1.7** Add showImages setting support
- [ ] **2.1.8** Add image width cells setting
- [ ] **2.1.9** Implement setExpanded(expanded) method
- [ ] **2.1.10** Implement updateArgs(args) for streaming
- [ ] **2.1.11** Implement updateResult(result, isPartial)
- [ ] **2.1.12** Implement setArgsComplete() - trigger diff
- [ ] **2.1.13** Style with theme colors (success/error)

#### 2.2 Assistant Message (`src/interactive/components/assistant-message.ts`)
- [ ] **2.2.1** Create file with imports
- [ ] **2.2.2** Parse message content (text, tool calls, tool results)
- [ ] **2.2.3** Render thinking blocks (with collapse support)
- [ ] **2.2.4** Render tool calls inline (with ToolExecutionComponent)
- [ ] **2.2.5** Render tool results (match by toolCallId)
- [ ] **2.2.6** Implement setHideThinkingBlock(hidden)
- [ ] **2.2.7** Implement setHiddenThinkingLabel(label)
- [ ] **2.2.8** Implement updateContent(message) - streaming support
- [ ] **2.2.9** Support expandable state (toolOutputExpanded)
- [ ] **2.2.10** Markdown rendering with theme

#### 2.3 User Message (`src/interactive/components/user-message.ts`)
- [ ] **2.3.1** Create file with imports
- [ ] **2.3.2** Extract text content from message
- [ ] **2.3.3** Parse skill invocation blocks (`:::skill name\n...\n:::`)
- [ ] **2.3.4** Render skill block as collapsible component
- [ ] **2.3.5** Render user text separately if present
- [ ] **2.3.6** Support expandable state

#### 2.4 Bash Execution (`src/interactive/components/bash-execution.ts`)
- [ ] **2.4.1** Create file with imports
- [ ] **2.4.2** Store command, excludeFromContext flag
- [ ] **2.4.3** Render command header (with ! prefix indicator)
- [ ] **2.4.4** Implement appendOutput(chunk) - streaming
- [ ] **2.4.5** Implement setComplete(exitCode, cancelled, truncated?, fullOutputPath?)
- [ ] **2.4.6** Handle output truncation with "more" link
- [ ] **2.4.7** Support expandable state

#### 2.5 Model Selector (`src/interactive/components/model-selector.ts`)
- [ ] **2.5.1** Create file with imports from pi-coding-agent
- [ ] **2.5.2** Get available models from registry
- [ ] **2.5.3** Filter by scoped models if present
- [ ] **2.5.4** Display model list with provider/ID
- [ ] **2.5.5** Support search/filter input
- [ ] **2.5.6** Show current model indicator
- [ ] **2.5.7** Handle selection (callback with model)
- [ ] **2.5.8** Support cancellation

#### 2.6 Settings Selector (`src/interactive/components/settings-selector.ts`)
- [ ] **2.6.1** Create file with imports
- [ ] **2.6.2** Display settings list (checkboxes, toggles, options)
- [ ] **2.6.3** Settings to include:
  - [ ] Auto compaction, Show images, Image width, Auto resize, Block images
  - [ ] Enable skill commands, Steering mode, Follow-up mode, Transport
  - [ ] Thinking level, Themes list, Hide thinking block, Collapse changelog
  - [ ] Telemetry, Double escape action, Tree filter mode
  - [ ] Hardware cursor, Editor padding, Autocomplete max, Quiet startup
  - [ ] Clear on shrink, Terminal progress, Warnings
- [ ] **2.6.4** Implement onSettingChange callbacks
- [ ] **2.6.5** Implement theme preview on select
- [ ] **2.6.6** Support cancel button

#### 2.7 Session Selector (`src/interactive/components/session-selector.ts`)
- [ ] **2.7.1** Create file with imports
- [ ] **2.7.2** List sessions from SessionManager.list()
- [ ] **2.7.3** Show session file path, name, timestamp
- [ ] **2.7.4** Support session rename (keybinding hint)
- [ ] **2.7.5** Implement onSelect callback
- [ ] **2.7.6** Implement onDelete callback (with confirm)
- [ ] **2.7.7** Show current session indicator
- [ ] **2.7.8** Support refresh

#### 2.8 Tree Selector (`src/interactive/components/tree-selector.ts`)
- [ ] **2.8.1** Create file with imports
- [ ] **2.8.2** Display session tree (entries with depth)
- [ ] **2.8.3** Show entry type icons (message, compaction, tool)
- [ ] **2.8.4** Support filtering (treeFilterMode setting)
- [ ] **2.8.5** Highlight selected/current entry
- [ ] **2.8.6** Support label editing (appendLabelChange)
- [ ] **2.8.7** Implement onSelect callback
- [ ] **2.8.8** Show note about summarization prompt

#### 2.9 User Message Selector (`src/interactive/components/user-message-selector.ts`)
- [ ] **2.9.1** Create file with imports
- [ ] **2.9.2** Get user messages from session.getUserMessagesForForking()
- [ ] **2.9.3** Display message list with truncated preview
- [ ] **2.9.4** Support search/filter
- [ ] **2.9.5** Show entry ID and timestamp
- [ ] **2.9.6** Implement onSelect callback (fork)
- [ ] **2.9.7** Support multi-select? (future)

#### 2.10 Extension Selector (`src/interactive/components/extension-selector.ts`)
- [ ] **2.10.1** Create generic selector component
- [ ] **2.10.2** Accept options array (strings)
- [ ] **2.10.3** Display options with index/selector
- [ ] **2.10.4** Support timeout option
- [ ] **2.10.5** Implement onSelect, onCancel callbacks
- [ ] **2.10.6** Support signal abort

#### 2.11 Extension Input (`src/interactive/components/extension-input.ts`)
- [ ] **2.11.1** Create file with imports
- [ ] **2.11.2** Display title and placeholder
- [ ] **2.11.3** Single-line input with editing
- [ ] **2.11.4** Submit on Enter, cancel on Escape
- [ ] **2.11.5** Implement onSubmit, onCancel
- [ ] **2.11.6** Support timeout and signal

#### 2.12 Extension Editor (`src/interactive/components/extension-editor.ts`)
- [ ] **2.12.1** Create multi-line editor wrapper
- [ ] **2.12.2** Use CustomEditor from pi-coding-agent
- [ ] **2.12.3** Display title in header
- [ ] **2.12.4** Support Ctrl+G to submit (like external editor)
- [ ] **2.12.5** Prefill text support
- [ ] **2.12.6** Implement onSubmit, onCancel

#### 2.13 Scoped Models Selector (`src/interactive/components/scoped-models-selector.ts`)
- [ ] **2.13.1** Create file with imports
- [ ] **2.13.2** Accept allModels (ScopedModel[]), enabledModelIds (string[])
- [ ] **2.13.3** Display all models with checkboxes
- [ ] **2.13.4** Support multi-select (toggle)
- [ ] **2.13.5** Search/filter by name/provider
- [ ] **2.13.6** Show "All" and "None" quick options
- [ ] **2.13.7** Implement onChange (enabledIds)
- [ ] **2.13.8** Implement onPersist (to settings)
- [ ] **2.13.9** Implement onCancel

#### 2.14 Thinking Selector (`src/interactive/components/thinking-selector.ts`)
- [ ] **2.14.1** Create file with imports
- [ ] **2.14.2** Display thinking levels (off, minimal, low, medium, high, xhigh)
- [ ] **2.14.3** Show current level indicator
- [ ] **2.14.4** Support keyboard navigation (up/down)
- [ ] **2.14.5** Implement onSelect(level)
- [ ] **2.14.6** Implement onCancel

#### 2.15 Login Dialog (`src/interactive/components/login-dialog.ts`)
- [ ] **2.15.1** Create file with imports
- [ ] **2.15.2** Display provider name and setup type
- [ ] **2.15.3** Support info text (showInfo(lines))
- [ ] **2.15.4** Support auth flow (showAuth(url, instructions))
- [ ] **2.15.5** Support manual input (showManualInput(prompt))
- [ ] **2.15.6** Support progress (showProgress(message))
- [ ] **2.15.7** Support prompt (showPrompt(message, placeholder))
- [ ] **2.15.8** Support waiting state (showWaiting(message))
- [ ] **2.15.9** Implement signal for abort
- [ ] **2.15.10** Dispose cleanup

#### 2.16 Easter Eggs
- [ ] **2.16.1** `src/interactive/components/armin.ts` - Armin ASCII art
- [ ] **2.16.2** `src/interactive/components/daxnuts.ts` - Daxnuts animation
- [ ] **2.16.3** `src/interactive/components/earendil-announcement.ts` - Announcement

#### 2.17 Keybinding Hints (`src/interactive/components/keybinding-hints.ts`)
- [ ] **2.17.1** Implement `keyHint(binding, description)` - full format
- [ ] **2.17.2** Implement `keyText(binding)` - just key
- [ ] **2.17.3** Implement `rawKeyHint(keys, description)` - no styling

---

### 📁 **Phase 3: EXTENSION SYSTEM INTEGRATION** (25 tasks)

#### 3.1 Keyboard Manager Updates (`src/interactive/keyboard-manager.ts`)
- [ ] **3.1.1** Store extensions keybindings separately
- [ ] **3.1.2** Implement `register(action, handler)` for app actions
- [ ] **3.1.3** Implement `handle(data)` - check both app and extension shortcuts
- [ ] **3.1.4** Return `{ consume: boolean, data?: string }` for passthrough
- [ ] **3.1.5** Support keybinding precedence (app vs extension)

#### 3.2 Slash Command Handler (`src/interactive/slash-command-handler.ts`)
- [ ] **3.2.1** Import BUILTIN_SLASH_COMMANDS from pi-coding-agent
- [ ] **3.2.2** Register all built-in commands with handlers
- [ ] **3.2.3** Support prompt template expansion (/templatename)
- [ ] **3.2.4** Support extension commands (/cmd from extensions)
- [ ] **3.2.5** Support skill commands (/skill:name)
- [ ] **3.2.6** Implement command diagnostics (conflicts)
- [ ] **3.2.7** Implement handle(command, args) dispatcher

#### 3.3 Message Renderer (`src/interactive/message-renderer.ts`)
- [ ] **3.3.1** Accept chatContainer reference
- [ ] **3.3.2** Implement render(messages) - full session render
- [ ] **3.3.3** Render all message types:
  - [ ] user (with skill blocks)
  - [ ] assistant (with thinking, tool calls)
  - [ ] toolCall (via ToolExecutionComponent)
  - [ ] toolResult (inline with tool calls)
  - [ ] custom (via extension renderer)
  - [ ] compactionSummary
  - [ ] branchSummary
  - [ ] bashExecution
- [ ] **3.3.4** Support expandable state (toolOutputExpanded)
- [ ] **3.3.5** Respect hideThinkingBlock setting
- [ ] **3.3.6** Use hiddenThinkingLabel for collapsed thinking

#### 3.4 Extension Widget System in InteractiveMode
- [ ] **3.4.1** Add extensionWidgetsAbove Map (key -> component)
- [ ] **3.4.2** Add extensionWidgetsBelow Map
- [ ] **3.4.3** Implement `setExtensionWidget(key, content, options?)`
  - [ ] Support string[] or factory function
  - [ ] Placement: above/below editor
  - [ ] Dispose existing widget with same key
  - [ ] MAX_WIDGET_LINES = 10 for strings
- [ ] **3.4.4** Implement `clearExtensionWidgets()` - dispose all
- [ ] **3.4.5** Implement `renderWidgets()` - update container children
- [ ] **3.4.6** Implement `renderWidgetContainer()` helper

#### 3.5 Extension UI Context Creation
- [ ] **3.5.1** Implement `createExtensionUIContext()` returning ExtensionUIContext
- [ ] **3.5.2** Implement `select(title, options, opts?)` → Promise&lt;string | undefined&gt;
- [ ] **3.5.3** Implement `confirm(title, message, opts?)` → Promise&lt;boolean&gt;
- [ ] **3.5.4** Implement `input(title, placeholder, opts?)` → Promise&lt;string | undefined&gt;
- [ ] **3.5.5** Implement `notify(message, type?)` → void
- [ ] **3.5.6** Implement `onTerminalInput(handler)` → unsubscribe function
- [ ] **3.5.7** Implement `setStatus(key, text)` → update footer
- [ ] **3.5.8** Implement `setWorkingMessage(message)`
- [ ] **3.5.9** Implement `setWorkingVisible(visible)`
- [ ] **3.5.10** Implement `setWorkingIndicator(options)`
- [ ] **3.5.11** Implement `setHiddenThinkingLabel(label)`
- [ ] **3.5.12** Implement `setWidget(key, content, options?)`
- [ ] **3.5.13** Implement `setFooter(factory)` → custom footer component
- [ ] **3.5.14** Implement `setHeader(factory)` → custom header component
- [ ] **3.5.15** Implement `setTitle(title)` → terminal title
- [ ] **3.5.16** Implement `custom(factory, options?)` → overlay or modal
- [ ] **3.5.17** Implement `pasteToEditor(text)` → insert at cursor
- [ ] **3.5.18** Implement `setEditorText(text)` / `getEditorText()`
- [ ] **3.5.19** Implement `editor(title, prefill?)` → Promise&lt;string | undefined&gt;
- [ ] **3.5.20** Implement `addAutocompleteProvider(factory)` → wrap provider
- [ ] **3.5.21** Implement `setEditorComponent(factory)` → custom editor
- [ ] **3.5.22** Implement `getEditorComponent()` → return factory
- [ ] **3.5.23** Expose `theme` getter (current theme)
- [ ] **3.5.24** Implement `getAllThemes()` → string[]
- [ ] **3.5.25** Implement `getTheme(name)` → Theme | undefined
- [ ] **3.5.26** Implement `setTheme(themeOrName)` → { success, error? }
- [ ] **3.5.27** Implement `getToolsExpanded()` → boolean
- [ ] **3.5.28** Implement `setToolsExpanded(expanded)`

#### 3.6 Extension UI Dialogs in InteractiveMode
- [ ] **3.6.1** Implement `showExtensionSelector(title, options, opts?)` → Promise
- [ ] **3.6.2** Implement `hideExtensionSelector()` → restore editor
- [ ] **3.6.3** Implement `showExtensionConfirm(title, message, opts?)` → Promise&lt;boolean&gt;
- [ ] **3.6.4** Implement `showExtensionInput(title, placeholder, opts?)` → Promise
- [ ] **3.6.5** Implement `hideExtensionInput()` → restore editor
- [ ] **3.6.6** Implement `showExtensionEditor(title, prefill?)` → Promise&lt;string | undefined&gt;
- [ ] **3.6.7** Implement `hideExtensionEditor()` → restore editor
- [ ] **3.6.8** Implement `showExtensionCustom(factory, options?)` → Promise&lt;T&gt;
- [ ] **3.6.9** Implement `showExtensionError(extensionPath, error, stack?)`

#### 3.7 Custom Editor Support
- [ ] **3.7.1** Add `editorComponentFactory` field to InteractiveMode
- [ ] **3.7.2** Implement `setCustomEditorComponent(factory?)`
  - [ ] Save current text before switch
  - [ ] Create new editor with tui, theme, keybindings
  - [ ] Wire onSubmit, onChange from default editor
  - [ ] Copy appearance settings (padding, autocomplete, borderColor)
  - [ ] Copy actionHandlers (escape, ctrl+D, pasteImage, shortcuts)
  - [ ] Restore default when factory is undefined
- [ ] **3.7.3** Type-check with duck typing for CustomEditor

#### 3.8 Show Loaded Resources with Diagnostics
- [ ] **3.8.1** Implement `showLoadedResources(options?)`
- [ ] **3.8.2** Fetch skills, prompts, extensions, themes, agentsFiles
- [ ] **3.8.3** Build SourceInfo map for all resources
- [ ] **3.8.4** Group resources by scope (user, project, path)
- [ ] **3.8.5** Format compact and expanded listings
- [ ] **3.8.6** Add section headers (Context, Skills, Prompts, Extensions, Themes)
- [ ] **3.8.7** Show diagnostics (skill conflicts, prompt conflicts, extension errors, theme conflicts)
- [ ] **3.8.8** Format collisions with winner/loser paths
- [ ] **3.8.9** Respect verbose/quietStartup settings
- [ ] **3.8.10** Add "Expand to see all" hint if collapsed

---

### 📁 **Phase 4: INTERACTIVEMODE FULL IMPLEMENTATION** (60+ tasks)

#### 4.1 Class Structure
- [ ] **4.1.1** Copy reference class fields (see interactive-mode.ts)
- [ ] **4.1.2** Define all private state variables
- [ ] **4.1.3** Add typed getters for session, settingsManager, sessionManager

#### 4.2 Constructor
- [ ] **4.2.1** Initialize runtimeHost, options
- [ ] **4.2.2** Set beforeSessionInvalidate and rebindSession callbacks
- [ ] **4.2.3** Create TUI with hardware cursor setting
- [ ] **4.2.4** Create all Container fields
- [ ] **4.2.5** Initialize KeybindingsManager and set globally
- [ ] **4.2.6** Create defaultCustomEditor with padding & autocomplete
- [ ] **4.2.7** Create editor (initially default)
- [ ] **4.2.8** Create FooterDataProvider and FooterComponent
- [ ] **4.2.9** Set autoCompact on footer
- [ ] **4.2.10** Load hideThinkingBlock setting
- [ ] **4.2.11** Register themes from resourceLoader
- [ ] **4.2.12** Call initTheme

#### 4.3 init() Method
- [ ] **4.3.1** Guard double-init
- [ ] **4.3.2** Call `registerSignalHandlers()`
- [ ] **4.3.3** Load changelog (getChangelogForDisplay logic)
- [ ] **4.3.4** Ensure fd and rg tools (await Promise.all)
- [ ] **4.3.5** Build UI layout (add children in order)
- [ ] **4.3.6** Call `setupKeyHandlers()`
- [ ] **4.3.7** Call `setupEditorSubmitHandler()`
- [ ] **4.3.8** Start UI (`this.ui.start()`)
- [ ] **4.3.9** Set `isInitialized = true`
- [ ] **4.3.10** Call `rebindCurrentSession()` (bind extensions)
- [ ] **4.3.11** Call `renderInitialMessages()`
- [ ] **4.3.12** Setup theme change listener
- [ ] **4.3.13** Setup git branch watcher on footerDataProvider
- [ ] **4.3.14** Call `updateAvailableProviderCount()`

#### 4.4 run() Method
- [ ] **4.4.1** Await `init()`
- [ ] **4.4.2** Start async version check (`checkForNewPiVersion`)
- [ ] **4.4.3** Start async package updates check
- [ ] **4.4.4** Start async tmux keyboard check
- [ ] **4.4.5** Show startup warnings (migratedProviders, modelFallback, etc.)
- [ ] **4.4.6** Show Anthropic subscription warning if needed
- [ ] **4.4.7** Process initialMessage and initialMessages
- [ ] **4.4.8** Main loop: `while (true) { await getUserInput(); await session.prompt(); }`

#### 4.5 Event Subscription & Handling
- [ ] **4.5.1** Implement `subscribeToAgent()` - store unsubscribe
- [ ] **4.5.2** Implement `handleEvent(event)` with switch on event.type
- [ ] **4.5.3** agent_start: show working loader, restore retry handler
- [ ] **4.5.4** agent_end: stop loader, clear streaming, check shutdown
- [ ] **4.5.5** message_start: 
  - [ ] custom → addMessageToChat
  - [ ] user → addMessageToChat + updatePendingMessages
  - [ ] assistant → create streamingComponent, set streamingMessage
- [ ] **4.5.6** message_update:
  - [ ] assistant streaming → update streamingComponent.content
  - [ ] Detect toolCall content → create ToolExecutionComponent if new
  - [ ] Update args for existing tool components
- [ ] **4.5.7** message_end:
  - [ ] assistant → finalize streamingComponent, show error if aborted/error
  - [ ] Mark args complete for tool components (trigger diff)
  - [ ] Clear streaming references
- [ ] **4.5.8** tool_execution_start: get/create component, markExecutionStarted
- [ ] **4.5.9** tool_execution_update: updateResult partial
- [ ] **4.5.10** tool_execution_end: updateResult final, delete from pendingTools
- [ ] **4.5.11** queue_update: updatePendingMessagesDisplay
- [ ] **4.5.12** session_info_changed: updateTerminalTitle, footer.invalidate
- [ ] **4.5.13** thinking_level_changed: footer.invalidate, updateEditorBorderColor
- [ ] **4.5.14** compaction_start:
  - [ ] Show terminal progress if enabled
  - [ ] Swap escape handler to abortCompaction
  - [ ] Show autoCompactionLoader in status
- [ ] **4.5.15** compaction_end:
  - [ ] Hide terminal progress
  - [ ] Restore escape handler
  - [ ] Stop loader, clear status
  - [ ] If success: rebuild chat, add compaction summary message
  - [ ] If error: show in chat
  - [ ] Call `flushCompactionQueue({ willRetry })`
- [ ] **4.5.16** auto_retry_start:
  - [ ] Swap escape handler to abortRetry
  - [ ] Show retryCountdown + loader with message
- [ ] **4.5.17** auto_retry_end:
  - [ ] Restore escape handler
  - [ ] Dispose countdown, stop loader
  - [ ] Show error only if final failure

#### 4.6 Message Rendering System
- [ ] **4.6.1** Implement `addMessageToChat(message, options?)` with role switch:
  - [ ] bashExecution → BashExecutionComponent
  - [ ] custom → CustomMessageComponent with renderer
  - [ ] compactionSummary → CompactionSummaryMessageComponent
  - [ ] branchSummary → BranchSummaryMessageComponent
  - [ ] user → parse skill block or plain Text
  - [ ] assistant → AssistantMessageComponent
  - [ ] toolResult → skip (inline with tool calls)
- [ ] **4.6.2** Implement `renderSessionContext(sessionContext, options)`:
  - [ ] Clear pendingTools
  - [ ] Update footer if requested
  - [ ] Loop messages: handle assistant (with tool calls), toolResult (match), others via addMessageToChat
- [ ] **4.6.3** Implement `renderInitialMessages()` → buildSessionContext + render
- [ ] **4.6.4** Implement `rebuildChatFromMessages()` → clear + renderSessionContext
- [ ] **4.6.5** Implement `getUserMessageText(message)` → concatenate text blocks

#### 4.7 Slash Command Handlers (All in InteractiveMode)
- [ ] **4.7.1** `/settings` → `showSettingsSelector()`
- [ ] **4.7.2** `/models` (scoped) → `showModelsSelector()`
- [ ] **4.7.3** `/model [search]` → `handleModelCommand(search)`
- [ ] **4.7.4** `/export [path]` → `handleExportCommand(text)`
- [ ] **4.7.5** `/import [path]` → `handleImportCommand(text)`
- [ ] **4.7.6** `/share` → `handleShareCommand()`
- [ ] **4.7.7** `/copy` → `handleCopyCommand()`
- [ ] **4.7.8** `/name [name]` → `handleNameCommand(text)`
- [ ] **4.7.9** `/session` → `handleSessionCommand()`
- [ ] **4.7.10** `/changelog` → `handleChangelogCommand()`
- [ ] **4.7.11** `/hotkeys` → `handleHotkeysCommand()`
- [ ] **4.7.12** `/fork` → `showUserMessageSelector()`
- [ ] **4.7.13** `/clone` → `handleCloneCommand()`
- [ ] **4.7.14** `/tree` → `showTreeSelector()`
- [ ] **4.7.15** `/login` → `showOAuthSelector("login")`
- [ ] **4.7.16** `/logout` → `showOAuthSelector("logout")`
- [ ] **4.7.17** `/new` → `handleClearCommand()`
- [ ] **4.7.18** `/compact [instructions]` → `handleCompactCommand(instructions)`
- [ ] **4.7.19** `/reload` → `handleReloadCommand()`
- [ ] **4.7.20** `/debug` → `handleDebugCommand()`
- [ ] **4.7.21** `/arminsayshi` → `handleArminSaysHi()`
- [ ] **4.7.22** `/dementedelves` → `handleDementedDelves()`
- [ ] **4.7.23** `/resume` → `showSessionSelector()`
- [ ] **4.7.24** `/quit` → `shutdown()`

#### 4.8 Selector Dialogs Implementation
- [ ] **4.8.1** Implement `showSelector(create)` generic helper
- [ ] **4.8.2** `showSettingsSelector()` with all settings
- [ ] **4.8.3** `showModelSelector(initialSearch?)` with ModelSelectorComponent
- [ ] **4.8.4** `showModelsSelector()` (scoped models)
  - [ ] Get all models from registry
  - [ ] Determine current enabledIds (session scoped or settings patterns)
  - [ ] Create ScopedModelsSelectorComponent
  - [ ] Update session.setScopedModels on change
  - [ ] Persist to settings on persist
- [ ] **4.8.5** `showUserMessageSelector()` → UserMessageSelectorComponent
- [ ] **4.8.6** `showTreeSelector(initialSelectedId?)` → TreeSelectorComponent
  - [ ] Get tree from sessionManager
  - [ ] Show summarization prompt loop (unless skipPrompt)
  - [ ] Handle custom instructions
  - [ ] Set escape handler to abortBranchSummary during summarization
- [ ] **4.8.7** `showSessionSelector()` → SessionSelectorComponent
- [ ] **4.8.8** `showOAuthSelector(mode)`:
  - [ ] login → showLoginAuthTypeSelector() → provider selector → login flow
  - [ ] logout → getLogoutProviderOptions() → selector → logout
- [ ] **4.8.9** `showLoginAuthTypeSelector()` → OAuth vs API key
- [ ] **4.8.10** `showLoginProviderSelector(authType)` → provider list
- [ ] **4.8.11** `showApiKeyLoginDialog(providerId, providerName)` → LoginDialogComponent
- [ ] **4.8.12** `showBedrockSetupDialog(providerId, providerName)` → info only
- [ ] **4.8.13** `showLoginDialog(providerId, providerName)` → OAuth flow
  - [ ] Handle usesCallbackServer flag
  - [ ] Race onAuth with manual code input
  - [ ] Handle onPrompt, onProgress
- [ ] **4.8.14** `completeProviderAuthentication()` - set model if unknown, show status, warn Anthropic

#### 4.9 Key Handlers Setup (`setupKeyHandlers()`)
- [ ] **4.9.1** Set `defaultEditor.onEscape` handler:
  - [ ] If streaming → restoreQueuedMessagesToEditor({ abort: true })
  - [ ] Else if bash running → session.abortBash()
  - [ ] Else if isBashMode → clear editor, reset flag, update border
  - [ ] Else if empty editor → double-escape logic (tree/fork)
- [ ] **4.9.2** Register app action handlers on defaultEditor:
  - [ ] app.clear → handleCtrlC
  - [ ] app.suspend → handleCtrlZ
  - [ ] app.thinking.cycle → cycleThinkingLevel
  - [ ] app.model.cycleForward/Backward → cycleModel(direction)
  - [ ] app.model.select → showModelSelector
  - [ ] app.tools.expand → toggleToolOutputExpansion
  - [ ] app.thinking.toggle → toggleThinkingBlockVisibility
  - [ ] app.editor.external → openExternalEditor
  - [ ] app.message.followUp → handleFollowUp
  - [ ] app.message.dequeue → handleDequeue
  - [ ] app.session.new → handleClearCommand
  - [ ] app.session.tree → showTreeSelector
  - [ ] app.session.fork → showUserMessageSelector
  - [ ] app.session.resume → showSessionSelector
- [ ] **4.9.3** Set `defaultEditor.onChange` → detect bash mode (starts with !)
- [ ] **4.9.4** Set `defaultEditor.onPasteImage` → handleClipboardImagePaste
- [ ] **4.9.5** Set `ui.onDebug` → handleDebugCommand

#### 4.10 Status & UI Updates
- [ ] **4.10.1** `showStatus(message)` with spam prevention (merge back-to-back)
- [ ] **4.10.2** `showError(message)` → chat spacer + error text
- [ ] **4.10.3** `showWarning(message)` → spacer + warning text
- [ ] **4.10.4** `showNewVersionNotification(newVersion)` → styled box
- [ ] **4.10.5** `showPackageUpdateNotification(packages)` → styled box
- [ ] **4.10.6** `updateEditorBorderColor()` → bash vs thinking level
- [ ] **4.10.7** `cycleThinkingLevel()` → cycle, status, footer.invalidate
- [ ] **4.10.8** `cycleModel(direction)` → session.cycleModel, status, warn Anthropic
- [ ] **4.10.9** `toggleToolOutputExpansion()` → setToolsExpanded(!expanded)
- [ ] **4.10.10** `setToolsExpanded(expanded)` → update header & all expandable children
- [ ] **4.10.11** `toggleThinkingBlockVisibility()` → toggle setting, rebuild chat, update streaming
- [ ] **4.10.12** `updateTerminalTitle()` → with session name and cwd
- [ ] **4.10.13** `updatePendingMessagesDisplay()` → show steering/follow-up queues
- [ ] **4.10.14** `updateAvailableProviderCount()` → get models, unique providers, set footer

#### 4.11 Compaction & Queue Management
- [ ] **4.11.1** `getAllQueuedMessages()` → combine session queue + compaction queue
- [ ] **4.11.2** `clearAllQueues()` → clear both, return messages
- [ ] **4.11.3** `restoreQueuedMessagesToEditor(options?)` → combine with current, abort if requested
- [ ] **4.11.4** `queueCompactionMessage(text, mode)` → push to array, update display, show status
- [ ] **4.11.5** `isExtensionCommand(text)` → check slash command registry
- [ ] **4.11.6** `flushCompactionQueue(options?)` → complex logic:
  - [ ] If willRetry: send all (extension execute immediately, others to steer/followUp)
  - [ ] Else: find first non-extension command, execute pre-commands, send first prompt, queue rest
  - [ ] Error handling: restore queue, show error
- [ ] **4.11.7** `flushPendingBashComponents()` → move from pendingMessagesContainer to chat

#### 4.12 Extension System Integration
- [ ] **4.12.1** `bindCurrentSessionExtensions()`:
  - [ ] Create ExtensionUIContext via `createExtensionUIContext()`
  - [ ] Call `session.bindExtensions({ uiContext, commandContextActions, shutdownHandler, onError })`
  - [ ] commandContextActions: waitForIdle, newSession, fork, navigateTree, switchSession, reload
  - [ ] Call `setRegisteredThemes()` from resourceLoader
  - [ ] Call `setupAutocompleteProvider()`
  - [ ] Call `setupExtensionShortcuts()`
  - [ ] Call `showLoadedResources({ force: false, showDiagnosticsWhenQuiet: true })`
  - [ ] Call `showStartupNoticesIfNeeded()`
- [ ] **4.12.2** `rebindCurrentSession()`:
  - [ ] Call `unsubscribe?.()`
  - [ ] `applyRuntimeSettings()` (footer, cwd, hideThinking, ui settings, editor padding/autocomplete)
  - [ ] `await bindCurrentSessionExtensions()`
  - [ ] `subscribeToAgent()`
  - [ ] `updateAvailableProviderCount()`
  - [ ] `updateEditorBorderColor()`
  - [ ] `updateTerminalTitle()`
- [ ] **4.12.3** `applyRuntimeSettings()` - as above
- [ ] **4.12.4** `setupAutocompleteProvider()`:
  - [ ] Create base provider with slash commands, model command (getArgumentCompletions), template commands, extension commands, skill commands
  - [ ] Wrap with `autocompleteProviderWrappers`
  - [ ] Set on defaultEditor and current editor
- [ ] **4.12.5** `setupExtensionShortcuts(extensionRunner)`:
  - [ ] Get shortcuts from runner
  - [ ] Set `defaultEditor.onExtensionShortcut` to check and run handlers
- [ ] **4.12.6** `showLoadedResources(options)` - detailed implementation (see 3.8)
- [ ] **4.12.7** `getBuiltInCommandConflictDiagnostics(extensionRunner)` → filter & map

#### 4.13 Tool & Working Indicators
- [ ] **4.13.1** `createWorkingLoader()` → new Loader with theme
- [ ] **4.13.2** `stopWorkingLoader()` → stop & clear status
- [ ] **4.13.3** `setWorkingVisible(visible)` → show/hide loader in status
- [ ] **4.13.4** `setWorkingIndicator(options?)` → update loader indicator
- [ ] **4.13.5** `setHiddenThinkingLabel(label?)` → update all AssistantMessageComponents
- [ ] **4.13.6** `setExtensionWidget(key, content, options?)` (see 3.4)
- [ ] **4.13.7** `setExtensionFooter(factory?)`:
  - [ ] Dispose existing custom footer
  - [ ] Remove current footer from UI (custom or built-in)
  - [ ] If factory: create, add to UI
  - [ ] Else: restore built-in footer
- [ ] **4.13.8** `setExtensionHeader(factory?)` - similar pattern
- [ ] **4.13.9** `addExtensionTerminalInputListener(handler)` → ui.addInputListener, track unsubscribe
- [ ] **4.13.10** `clearExtensionTerminalInputListeners()` → unsubscribe all
- [ ] **4.13.11** `setCustomEditorComponent(factory?)` (see 3.7)

#### 4.14 Error Handling & Shutdown
- [ ] **4.14.1** `handleFatalRuntimeError(prefix, error)` → showError, stopThemeWatcher, stop(), exit(1)
- [ ] **4.14.2** `shutdown()`:
  - [ ] Set isShuttingDown flag
  - [ ] `unregisterSignalHandlers()`
  - [ ] `await ui.terminal.drainInput(1000)`
  - [ ] `stop()`
  - [ ] `await runtimeHost.dispose()`
  - [ ] `process.exit(0)`
- [ ] **4.14.3** `checkShutdownRequested()` → shutdown if requested
- [ ] **4.14.4** `registerSignalHandlers()`:
  - [ ] SIGTERM, SIGHUP (non-win) → killTrackedDetachedChildren + shutdown
  - [ ] unhandledRejection → log + exit(1)
  - [ ] uncaughtException → log + exit(1)
- [ ] **4.14.5** `unregisterSignalHandlers()` → cleanup all
- [ ] **4.14.6** `handleCtrlC()` → double-press logic (clear vs exit)
- [ ] **4.14.7** `handleCtrlD()` → shutdown
- [ ] **4.14.8** `handleCtrlZ()` → suspend logic (stop TUI, SIGTSTP, SIGCONT handler)

#### 4.15 Utility Commands
- [ ] **4.15.1** `handleReloadCommand()`:
  - [ ] Check not streaming/compacting
  - [ ] `resetExtensionUI()`
  - [ ] Show reload box (replace editor)
  - [ ] `await session.reload()`
  - [ ] `keybindings.reload()`
  - [ ] Reset header expansion, themes, editor settings, autocomplete, shortcuts
  - [ ] `rebuildChatFromMessages()`
  - [ ] `showLoadedResources({ force: false, showDiagnosticsWhenQuiet: true })`
  - [ ] Check models.json error
- [ ] **4.15.2** `handleExportCommand(text)` → getPathCommandArgument, exportToJsonl/HTML
- [ ] **4.15.3** `handleImportCommand(text)` → confirm, runtimeHost.importFromJsonl, handle MissingSessionCwdError
- [ ] **4.15.4** `handleShareCommand()`:
  - [ ] Check gh CLI availability
  - [ ] Export to temp HTML
  - [ ] Show BorderedLoader overlay
  - [ ] Spawn gh gist create
  - [ ] Extract gist ID, show preview URL
- [ ] **4.15.5** `handleCopyCommand()` → session.getLastAssistantText() → copyToClipboard
- [ ] **4.15.6** `handleNameCommand(text)` → setSessionName or show current
- [ ] **4.15.7** `handleSessionCommand()` → stats from session.getSessionStats()
- [ ] **4.15.8** `handleChangelogCommand()` → parse full CHANGELOG.md, show in Markdown
- [ ] **4.15.9** `handleHotkeysCommand()` → build markdown table with keybindings (app + editor + extensions)
- [ ] **4.15.10** `handleCloneCommand()` → fork leaf with position='at'
- [ ] **4.15.11** `handleDebugCommand()` → render full TUI output + JSONL messages to debug log
- [ ] **4.15.12** `handleArminSaysHi()` → add ArminComponent to chat
- [ ] **4.15.13** `handleDementedDelves()` → add EarendilAnnouncementComponent
- [ ] **4.15.14** `checkDaxnutsEasterEgg(model)` → if opencode/kimi, show DaxnutsComponent
- [ ] **4.15.15** `checkForPackageUpdates()` → DefaultPackageManager (or npm outdated)
- [ ] **4.15.16** `checkTmuxKeyboardSetup()` → query tmux, warn about extended-keys
- [ ] **4.15.17** `maybeWarnAboutAnthropicSubscriptionAuth(model?)` → check key prefix, show once

#### 4.16 Bash Command Handling
- [ ] **4.16.1** `handleBashCommand(command, excludeFromContext)`:
  - [ ] Emit `extensionRunner.emitUserBash({ type: 'user_bash', command, excludeFromContext, cwd })`
  - [ ] If extension returned result → create BashExecutionComponent, show output, record result, done
  - [ ] Else: create component, add to pending or chat depending on streaming
  - [ ] Call `session.executeBash()` with operations from extension
  - [ ] Handle streaming output via callback
  - [ ] On complete: call component.setComplete
  - [ ] Error handling: showError, setComplete with undefined exitCode

#### 4.17 Reset & Cleanup
- [ ] **4.17.1** `resetExtensionUI()`:
  - [ ] Hide all extension UI elements (selectors, input, editor)
  - [ ] `ui.hideOverlay()`
  - [ ] `clearExtensionTerminalInputListeners()`
  - [ ] `setExtensionFooter(undefined)`, `setExtensionHeader(undefined)`
  - [ ] `clearExtensionWidgets()`, `footerDataProvider.clearExtensionStatuses()`
  - [ ] `footer.invalidate()`
  - [ ] `autocompleteProviderWrappers = []`, `setupAutocompleteProvider()`
  - [ ] `defaultEditor.onExtensionShortcut = undefined`
  - [ ] `updateTerminalTitle()`
  - [ ] Reset workingMessage, workingVisible, setWorkingIndicator
  - [ ] Update loader message with interrupt hint
  - [ ] `setHiddenThinkingLabel()`

---

### 📁 **Phase 5: ADDITIONAL COMPONENTS & UTILS** (10 tasks)

- [ ] **5.1** `src/interactive/components/expandable-text.ts` - already exists, verify works
- [ ] **5.2** Easter eggs (from reference):
  - [ ] `src/interactive/components/armin.ts` - Armin ASCII art component
  - [ ] `src/interactive/components/daxnuts.ts` - Daxnuts animation
  - [ ] `src/interactive/components/earendil-announcement.ts` - Announcement banner
- [ ] **5.3** `src/interactive/components/keybinding-hints.ts` - helper functions
- [ ] **5.4** `src/interactive/components/countdown-timer.ts` - for retry/compaction
- [ ] **5.5** `src/interactive/components/bordered-loader.ts` - loader with border
- [ ] **5.6** Verify all imports resolve correctly

---

### 📁 **Phase 6: TESTING & POLISH** (10 tasks)

- [ ] **6.1** **Build Phase 1-5**: `npm run build`
  - [ ] Fix all TypeScript errors
  - [ ] Ensure no 'any' abuse (use proper types)
- [ ] **6.2** **Run Tests**: `npm test`
  - [ ] All tests pass
  - [ ] Add missing test coverage if needed
- [ ] **6.3** **Manual Smoke Test**:
  - [ ] Launch: `npm start` or `npm run dev`
  - [ ] Test basic slash commands (/settings, /model, /clear)
  - [ ] Test model switching
  - [ ] Test bash commands (!ls, !echo)
  - [ ] Test follow-up (Alt+Enter)
  - [ ] Test dequeue (Alt+Up)
  - [ ] Test external editor (Ctrl+G)
  - [ ] Test image paste (Ctrl+V)
  - [ ] Test tool output expansion (Ctrl+O)
  - [ ] Test thinking toggle (Ctrl+T)
  - [ ] Verify changelog displays on first run
- [ ] **6.4** **Code Review**:
  - [ ] Check for copyright issues (no direct copy)
  - [ ] Ensure all code is original but inspired by patterns
  - [ ] Validate architecture matches reference
- [ ] **6.5** **Git Commit**:
  - [ ] Stage all changes
  - [ ] Write meaningful commit message (feat: interactive mode overhaul)
  - [ ] Commit

#### Phase 7: DOCUMENTATION (5 tasks)

- [ ] **7.1** Update README.md with features list
- [ ] **7.2** Add CHANGELOG.md entries for this release
- [ ] **7.3** Document extension API (if public)
- [ ] **7.4** Update AGENTS.md with current capabilities
- [ ] **7.5** Write inline code comments for complex sections

---

## 📋 **Summary**

**Total Estimated Tasks**: ~150+

**Priority Order**:
1. **CRITICAL**: Phase 1 (Config, Theme, Utils) → Foundation
2. **CRITICAL**: Phase 4 (InteractiveMode) → Core functionality
3. **HIGH**: Phase 2 (UI Components) → Needed for full feature set
4. **HIGH**: Phase 3 (Extension System) → Enable extensions
5. **MEDIUM**: Phase 5 (Easter eggs, helpers) → Polish
6. **MEDIUM**: Phase 6 (Testing) → Quality assurance
7. **LOW**: Phase 7 (Docs) → User-facing

**Strategy**:
- Work through phases sequentially (1 → 2 → 3 → 4)
- Within each phase, create files and implement functions incrementally
- Commit after completing logical units (e.g., after phase 1, after major feature)
- Always `npm run build` and `npm test` before committing
- Use reference only for architecture/API; write ALL code from scratch

**Current Status**: Phase 1 in progress (Config completed, Theme in progress)

**Next Immediate Task**: Complete Theme system (1.2), then Utils cluster (1.3)


### Thiếu (Missing từ reference)
1. **UI Components** (cần tạo/thêm):
   - ❌ AssistantMessageComponent (có thinking blocks, tool calls)
   - ❌ UserMessageComponent (có skill invocation support)
   - ❌ ToolExecutionComponent (diff view, expandable)
   - ❌ BashExecutionComponent (output với truncation)
   - ❌ DynamicBorder (themed border)
   - ❌ CustomEditor wrapper (từ pi-coding-agent)
   - ❌ FooterComponent (từ pi-coding-agent)
   - ❌ LoginDialogComponent
   - ❌ ModelSelectorComponent
   - ❌ SettingsSelectorComponent
   - ❌ SessionSelectorComponent
   - ❌ TreeSelectorComponent
   - ❌ UserMessageSelectorComponent
   - ❌ ExtensionSelectorComponent
   - ❌ ExtensionInputComponent
   - ❌ ExtensionEditorComponent
   - ❌ ScopedModelsSelectorComponent
   - ❌ ThinkingSelectorComponent
   - ❌ CountdownTimer
   - ❌ BorderedLoader
   - ❌ Easter eggs: ArminComponent, DaxnutsComponent, EarendilAnnouncementComponent

2. **Theme System**:
   - ❌ `src/interactive/theme/theme.ts` - Complete theme management
   - ⚠️ Current có file theme.ts nhưng cần upgrade

3. **InteractiveMode Enhancements**:
   - ❌ Full extension system integration
   - ❌ Extension UI context (selectors, dialogs, widgets)
   - ❌ Extension widgets system (above/below editor)
   - ❌ Custom header/footer support
   - ❌ Tool output expansion toggle
   - ❌ Thinking block visibility toggle
   - ❌ Auto-compaction UI
   - ❌ Auto-retry UI
   - ❌ Compaction queue management
   - ❌ Pending bash components
   - ❌ Session cwd error handling
   - ❌ Anthropic subscription warning
   - ❌ Model fallback handling
   - ❌ Changelog display với collapse option
   - ❌ Startup notices với expansion
   - ❌ Resource loading display (skills, prompts, extensions, themes)
   - ❌ Diagnostics display (conflicts, errors)
   - ❌ Shutdown handling với signal cleanup
   - ❌ Suspend/resume (Ctrl+Z)
   - ❌ External editor support
   - ❌ Image paste từ clipboard
   - ❌ Follow-up & dequeue UX
   - ❌ Session info command
   - ❌ Hotkeys command
   - ❌ Debug command

4. **Utilities**:
   - ✅ Changelog utils đã có
   - ❌ Clipboard utilities (copyToClipboard, readClipboardImage)
   - ❌ Git utilities (parseGitUrl)
   - ❌ Shell utilities (killTrackedDetachedChildren)
   - ❌ Tools manager (ensureTool)
   - ❌ Version check (checkForNewPiVersion)
   - ❌ Package manager check

5. **Config/Constants**:
   - ❌ Need to create `src/config.ts` với APP_NAME, VERSION, paths

6. **Extensions** (from pi-coding-agent):
   - ❌ BUILTIN_SLASH_COMMANDS
   - ❌ createCompactionSummaryMessage
   - ❌ formatMissingSessionCwdPrompt
   - ❌ MissingSessionCwdError
   - ❌ SessionImportFileNotFoundError

## Plan (Cached Strategy)

### Phase 1: Core Infrastructure (Priority: HIGH)
**Goal**: Set up foundation files that other components depend on

- [ ] **1.1** Create `src/config.ts` - App constants & paths
- [ ] **1.2** Upgrade `src/interactive/theme/theme.ts` - Full theme management
- [ ] **1.3** Create `src/utils/index.ts` - Utilities cluster (clipboard, git, shell, tools, version-check)
- [ ] **1.4** Create `src/interactive/components/index.ts` - Barrel export cho components
- [ ] **1.5** Tạo các component đơn lẻ cần dùng repeatedly:
  - [ ] `src/interactive/components/dynamic-border.ts`
  - [ ] `src/interactive/components/countdown-timer.ts`
  - [ ] `src/interactive/components/bordered-loader.ts`
  - [ ] `src/interactive/components/footer.ts` (nếu không dùng từ package)

### Phase 2: Complex UI Components (Priority: HIGH)
**Goal**: Các component có logic phức tạp, cần implement từ scratch

- [ ] **2.1** `src/interactive/components/tool-execution.ts` - Tool call rendering với diff/expand
- [ ] **2.2** `src/interactive/components/assistant-message.ts` - Assistant message với thinking blocks
- [ ] **2.3** `src/interactive/components/user-message.ts` - User message với skill blocks
- [ ] **2.4** `src/interactive/components/bash-execution.ts` - Bash output với truncation
- [ ] **2.5** `src/interactive/components/model-selector.ts` - Model selection UI
- [ ] **2.6** `src/interactive/components/settings-selector.ts` - Settings toggle UI
- [ ] **2.7** `src/interactive/components/session-selector.ts` - Session management UI
- [ ] **2.8** `src/interactive/components/tree-selector.ts` - Session tree navigation UI
- [ ] **2.9** `src/interactive/components/user-message-selector.ts` - Fork selector UI
- [ ] **2.10** `src/interactive/components/extension-selector.ts` - Generic selector
- [ ] **2.11** `src/interactive/components/extension-input.ts` - Input dialog
- [ ] **2.12** `src/interactive/components/extension-editor.ts` - Multi-line editor
- [ ] **2.13** `src/interactive/components/scoped-models-selector.ts` - Model scoping UI
- [ ] **2.14** `src/interactive/components/thinking-selector.ts` - Thinking level UI
- [ ] **2.15** `src/interactive/components/login-dialog.ts` - OAuth/API key login

### Phase 3: Extension System Integration (Priority: HIGH)
**Goal**: Full extension UI context & widget system

- [ ] **3.1** Update `src/interactive/keyboard-manager.ts` - Support extension shortcuts
- [ ] **3.2** Update `src/interactive/slash-command-handler.ts` - Add all slash commands
- [ ] **3.3** Update `src/interactive/message-renderer.ts` - Support custom messages, compaction, branch summaries
- [ ] **3.4** Implement extension widget system trong InteractiveMode:
  - [ ] Widget containers (above/below editor)
  - [ ] Widget lifecycle (dispose)
  - [ ] setExtensionWidget, clearExtensionWidgets
- [ ] **3.5** Implement extension UI context:
  - [ ] select(), confirm(), input(), notify()
  - [ ] onTerminalInput(), setStatus()
  - [ ] setWorkingMessage/visible/indicator
  - [ ] setHiddenThinkingLabel()
  - [ ] setWidget(), setFooter(), setHeader(), setTitle()
  - [ ] custom() overlay support
  - [ ] pasteToEditor(), setEditorText(), getEditorText()
  - [ ] editor() dialog
  - [ ] addAutocompleteProvider()
  - [ ] setEditorComponent(), getEditorComponent()
  - [ ] Theme management APIs
  - [ ] Tools expanded API
- [ ] **3.6** Implement extension selectors/dialogs trong InteractiveMode

### Phase 4: InteractiveMode Full Implementation (Priority: CRITICAL)
**Goal**: Upgrade `src/interactive/interactive-mode.ts` to match reference functionality

- [ ] **4.1** Refactor class structure - đảm bảo đủ properties & state tracking
- [ ] **4.2** Constructor initialization - UI layout, containers, keybindings, theme
- [ ] **4.3** `init()` method - signal handlers, tools, fd/rg, UI start
- [ ] **4.4** `run()` method - main loop với error handling
- [ ] **4.5** Event subscription & handling (AgentSessionEvent):
  - [ ] agent_start, agent_end
  - [ ] message_start, message_update, message_end
  - [ ] tool_execution_start/update/end
  - [ ] queue_update
  - [ ] session_info_changed, thinking_level_changed
  - [ ] compaction_start/end
  - [ ] auto_retry_start/end
- [ ] **4.6** Message rendering system:
  - [ ] renderInitialMessages()
  - [ ] renderSessionContext()
  - [ ] addMessageToChat() với all message types
  - [ ] rebuildChatFromMessages()
- [ ] **4.7** Slash command handlers:
  - [ ] /settings, /model, /models (scoped)
  - [ ] /export, /import, /share, /copy
  - [ ] /name, /session, /changelog, /hotkeys
  - [ ] /fork, /clone, /tree, /resume, /new
  - [ ] /compact, /reload, /debug
  - [ ] /login, /logout
  - [ ] Easter eggs: /arminsayshi, /dementedelves, /daxnuts
- [ ] **4.8** Selector dialogs:
  - [ ] showSettingsSelector()
  - [ ] showModelSelector() + findExactModelMatch()
  - [ ] showModelsSelector() (scoped models)
  - [ ] showUserMessageSelector() (fork)
  - [ ] showTreeSelector() với summarization flow
  - [ ] showSessionSelector()
  - [ ] showLogin/Logout OAuth flow
  - [ ] showApiKeyLoginDialog(), showBedrockSetupDialog()
- [ ] **4.9** Key handlers setup (setuphandlers):
  - [ ] All app actions mapping
  - [ ] Editor change detection (bash mode)
  - [ ] Clipboard image paste
- [ ] **4.10** Status & UI updates:
  - [ ] showStatus() với spam prevention
  - [ ] showError(), showWarning(), showNewVersionNotification(), showPackageUpdateNotification()
  - [ ] updateEditorBorderColor()
  - [ ] updateTerminalTitle()
  - [ ] updatePendingMessagesDisplay()
  - [ ] updateAvailableProviderCount()
- [ ] **4.11** Compaction & queue management:
  - [ ] queueCompactionMessage()
  - [ ] getAllQueuedMessages(), clearAllQueues()
  - [ ] restoreQueuedMessagesToEditor()
  - [ ] flushCompactionQueue()
  - [ ] flushPendingBashComponents()
- [ ] **4.12** Extension system integration:
  - [ ] bindCurrentSessionExtensions()
  - [ ] rebindCurrentSession()
  - [ ] createExtensionUIContext()
  - [ ] setupExtensionShortcuts()
  - [ ] showLoadedResources() với scope groups
  - [ ] formatDiagnostics()
- [ ] **4.13** Tool & working indicators:
  - [ ] createWorkingLoader()
  - [ ] setWorkingVisible/Indicator()
  - [ ] setHiddenThinkingLabel()
  - [ ] setToolsExpanded(), toggleToolOutputExpansion()
  - [ ] setExtensionWidget(), renderWidgets()
  - [ ] setExtensionFooter(), setExtensionHeader()
  - [ ] setCustomEditorComponent()
- [ ] **4.14** Error handling & shutdown:
  - [ ] handleFatalRuntimeError()
  - [ ] shutdown() với drain input
  - [ ] registerSignalHandlers(), unregister()
  - [ ] handleCtrlC(), handleCtrlD(), handleCtrlZ()
- [ ] **4.15** Utility commands:
  - [ ] handleReloadCommand() (full reload flow)
  - [ ] handleExportCommand(), handleImportCommand()
  - [ ] handleShareCommand() (gh gist)
  - [ ] handleCopyCommand()
  - [ ] handleNameCommand()
  - [ ] handleSessionCommand()
  - [ ] handleChangelogCommand()
  - [ ] handleHotkeysCommand()
  - [ ] handleDebugCommand()
  - [ ] checkForPackageUpdates(), checkTmuxKeyboardSetup()
  - [ ] maybeWarnAboutAnthropicSubscriptionAuth()
  - [ ] checkDaxnutsEasterEgg()
- [ ] **4.16** Bash command handling:
  - [ ] handleBashCommand() với extension interception
  - [ ] Extension event: user_bash

### Phase 5: Missing Components Implementation (Priority: MEDIUM)
**Goal**: Các component nhỏ, easter eggs, icons

- [ ] **5.1** Easter egg components:
  - [ ] `src/interactive/components/armin.ts`
  - [ ] `src/interactive/components/daxnuts.ts`
  - [ ] `src/interactive/components/earendil-announcement.ts`
- [ ] **5.2** Utility components:
  - [ ] `src/interactive/components/keybinding-hints.ts` - keyHint, keyText, rawKeyHint

### Phase 6: Testing & Polish (Priority: MEDIUM)
**Goal**: Đảm bảo quality, performance, test coverage

- [ ] **6.1** Run build: `npm run build` - fix all TypeScript errors
- [ ] **6.2** Run tests: `npm test` - ensure passing
- [ ] **6.3** Manual smoke test:
  - [ ] Launch interactive mode
  - [ ] Test slash commands
  - [ ] Test model switching
  - [ ] Test bash commands
  - [ ] Test extension UI (if any)
- [ ] **6.4** Code review against reference (no copyright issues)
- [ ] **6.5** Git commit với meaningful messages

### Phase 7: Documentation (Priority: LOW)
**Goal**: User-facing docs

- [ ] **7.1** Update README.md với features list
- [ ] **7.2** Add CHANGELOG.md entries
- [ ] **7.3** Document extension API (nếu cần)

## Notes

- **No Copy-Paste**: Chỉ tham khảo kiến trúc & pattern, phải viết code original
- **Build Before Commit**: Luôn chạy `npm run build` và `npm test` pass trước khi commit
- **Incremental Commits**: Commit sau mỗi phase/module hoàn thành
- **Type Safety**: Ưu tiên strong typing, tránh `any` casts
- **Error Handling**: Comprehensive try-catch, user-friendly messages
- **Performance**: Avoid blocking UI, use async appropriately

## Progress Tracking

### Status Legend
- [ ] = Not started
- [x] = Completed
- [~] = In progress

### Completion Metrics
- Total Tasks: ~150+
- Phase 1: 15 tasks
- Phase 2: 30 tasks
- Phase 3: 25 tasks
- Phase 4: 60+ tasks
- Phase 5: 10 tasks
- Phase 6: 10 tasks
- Phase 7: 5 tasks

---

**Last Updated**: 2026-05-31
**Target Completion**: Theo tiến độ development

## ✅ Completed (Phase 1 & Minimal Core)

### Phase 1: CONFIG & INFRASTRUCTURE ✅ DONE
- ✅ **1.1** Config module (`src/config.ts`) - Complete
- ✅ **1.2** Theme system (`src/interactive/theme/theme.ts`) - Basic integration
- ✅ **1.3** Utils cluster:
  - ✅ clipboard.ts, git.ts, shell.ts, tools-manager.ts, version-check.ts, changelog.ts
- ✅ **1.4** Components barrel (`src/interactive/components/index.ts`) - Simplified
- ✅ **1.5** KeybindingsManager (`src/runtime/keybindings-manager.ts`) - with extension shortcuts

### Minimal InteractiveMode Core ✅ DONE
- ✅ Basic class structure, init(), run()
- ✅ TUI setup, editor, autocomplete, layout
- ✅ Minimal slash commands (clear, exit, model, bash)
- ✅ Basic message rendering (user, assistant)
- ✅ Shutdown & signal handling
- ✅ Version check async

**Build Status**: ✅ PASSING


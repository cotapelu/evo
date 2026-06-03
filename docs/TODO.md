# Project TODO - Interactive Mode Rewrite

## 🎯 Mục đích

Đây là danh sách công việc cho **rewrite project** của `src/interactive/interactive-mode.ts`.

**Mục tiêu:** Đạt được **100% feature parity** với reference implementation (`llm-context/coding-agent/src/modes/interactive/interactive-mode.ts`) mà **không được copy code** (tránh vi phạm bản quyền). Chỉ đọc reference để hiểu cách làm, sau đó tự viết lại từ đầu.

**Quy trình:**
1. Đọc hiểu reference implementation (5622 dòng)
2. So sánh với implementation hiện tại (3204 dòng)
3. Xác định feature/phần còn thiếu
4. Code từ scratch trong `src/interactive/interactive-mode.ts`
5. Ưu tiên import & reuse từ `@earendil-works/pi-coding-agent`
6. Chỉ implement custom logic mà package chưa cung cấp
7. Cập nhật TODO.md sau mỗi bước hoàn thành

**🚫 Quan trọng: Không được copy-paste code** từ reference file.

---

## 📊 SO SÁNH CHI TIẾT: Reference vs Current (2025-06-02)

### Thống kê

| Metric | Reference (llm-context) | Current (src) | Chênh lệch | % Hoàn thành |
|--------|------------------------|---------------|-------------|--------------|
| Tổng dòng code | 5,622 | 3,204 | -1,418 | 57% |
| Class/interface | ~50+ | ~30 | -20 | 60% |
| Public methods | ~120 | ~80 | -40 | 67% |
| Slash commands | 25+ | ~15 | -10+ | 60% |
| Event handlers | 15+ | 15+ | ✅ | 100% |
| Message types | 7 | 7 | ✅ | 100% |

**Kết luận:** Current đã implement **core functionality** (Phase 1) nhưng thiếu **~40 methods** và **~10 slash commands** để đạt full parity.

---

## ✅ PHASE 1: CRITICAL PARITY (✅ 100% HOÀN THÀNH)

### Các feature cốt lõi đã implement và verified với 507 tests:

#### 1. Initialization & Setup
- [x] `init()` - TUI initialization, theme, layout, key handlers
- [x] `run()` - Main loop with graceful shutdown
- [x] `registerSignalHandlers()` - SIGINT, SIGTERM, SIGHUP
- [x] `setupKeyHandlers()` - Escape, submit, change, paste
- [x] `setupEditorSubmitHandler()` - Slash + bash routing

#### 2. Extension System (Basic)
- [x] `bindCurrentSessionExtensions()`
- [x] `setupAutocompleteProvider()` - CombinedAutocompleteProvider
- [x] `setupExtensionShortcuts()`
- [x] `createExtensionUIContext()` - Basic UI primitives

#### 3. Event Handling (100%)
- [x] `subscribeToAgent()` - Event subscription
- [x] `handleEvent()` - Tất cả 15+ event types:
  - turn_start / turn_end
  - queue_update
  - session_info_changed
  - thinking_level_changed
  - message_start / update / end
  - tool_execution_start / update / end
  - compaction_start / end (with abort)
  - auto_retry_start / end (with countdown)
  - shutdown_requested

#### 4. Message Rendering (100%)
- [x] `addMessageToChat()` - 7 roles:
  - user (skill blocks)
  - assistant (thinking blocks)
  - bashExecution (truncation)
  - custom (extension renderer)
  - compactionSummary / branchSummary
  - toolResult (inline)
- [x] `renderSessionContext()` - Tool matching, history
- [x] `rebuildChatFromMessages()`
- [x] `renderInitialMessages()`

#### 5. Queue & Compaction
- [x] `getAllQueuedMessages()` / `clearAllQueues()`
- [x] `restoreQueuedMessagesToEditor()`
- [x] `queueCompactionMessage()`
- [x] `updatePendingMessagesDisplay()`
- [x] `flushCompactionQueue()` - Extension cmds → prompt → rest
- [x] `createCompactionSummaryMessage()`

#### 6. UI Selectors
- [x] `showModelSelector()`
- [x] `showTreeSelector()` (basic navigation)
- [x] `showUserMessageSelector()` (fork)
- [x] `showSessionSelector()` (resume)
- [x] `showSettingsSelector()` (basic)

#### 7. Command Handlers
- [x] `handleClearCommand()` / `handleCompactCommand()`
- [x] `handleCopyCommand()` / `handlePasteCommand()`
- [x] `handleModelCommand()` (cycle + select)
- [x] `handleResumeSession()` (with cwd fallback)
- [x] `cloneSession()` / `forkSession()`
- [x] `executeBash()` / `handleBashCommand()`

#### 8. Utilities
- [x] Error/Warning/Status display
- [x] `cycleThinkingLevel()` / `cycleModel()`
- [x] `toggleToolOutputExpansion()` / `toggleThinkingBlockVisibility()`
- [x] `openExternalEditor()` (basic)
- [x] `showLoadedResources()` (simplified)
- [x] `showStartupNotices()`

#### 9. Runtime & Shutdown
- [x] `applyRuntimeSettings()`
- [x] `rebindCurrentSession()`
- [x] `renderCurrentSessionState()`
- [x] `shutdown()` / `checkShutdownRequested()`
- [x] `handleFatalRuntimeError()`

**Verification:**
```
✅ npm test        : 507/507 passing
✅ npm run build   : clean
✅ Test coverage   : 100% (all tests pass)
```

---

## ⚠️ PHASE 2: USER-FACING COMMANDS (❌ CHƯA IMPLEMENT - CẦN TIẾP TỤC)

### 2.1 Slash Commands Missing (10 commands cần implement)

| Command | Reference | Current | Cần làm | Tests |
|---------|-----------|---------|---------|-------|
| `/export` | HTML + JSONL | ❌ stub | ✅ Full | +2 |
| `/import` | With cwd prompt | ❌ stub | ✅ Full | +2 |
| `/session` | Detailed stats | ⚠️ basic | ✅ Enhanced | +1 |
| `/debug` | Full terminal dump | ⚠️ basic | ✅ Full | +1 |
| `/share` | GitHub gist | ⚠️ simple | ✅ Full gh CLI | +1 |
| `/scoped-models` | Multi-select | ❌ missing | ✅ Selector | +2 |
| `/hotkeys` | Markdown table | ❌ missing | ✅ Overlay | +1 |
| `/resources` | With scopes/diags | ⚠️ simple | ✅ Full | +1 |
| `/changelog` | All entries | ⚠️ new only | ✅ Full | +1 |
| `/clone` | With rename | ⚠️ partial | ✅ Complete | +1 |

**Tổng tests cần thêm:** ~13 tests

#### `/export` & `/import` (Highest Priority)

**`/export` Implementation:**
```typescript
private async handleExportCommand(text: string): Promise<void> {
  const outputPath = this.getPathCommandArgument(text, "/export");
  
  if (outputPath?.endsWith(".jsonl")) {
    const filePath = this.session.exportToJsonl(outputPath);
    this.showStatus(`Session exported to: ${filePath}`);
  } else {
    const filePath = await this.session.exportToHtml(outputPath);
    this.showStatus(`Session exported to: ${filePath}`);
  }
}
```
- **Edge cases:** Permission denied, disk full, invalid path
- **Tests:** Export to default dir, export with path, error handling

**`/import` Implementation:**
```typescript
private async handleImportCommand(text: string): Promise<void> {
  const inputPath = this.getPathCommandArgument(text, "/import");
  if (!inputPath) {
    this.showError("Usage: /import <file.jsonl>");
    return;
  }
  
  const confirmed = await this.showExtensionConfirm(
    "Import session", 
    `Replace current session with ${inputPath}?`
  );
  if (!confirmed) return;
  
  try {
    const result = await this.runtimeHost.importFromJsonl(inputPath);
    if (result.cancelled) return;
    this.renderCurrentSessionState();
    this.showStatus(`Session imported from: ${inputPath}`);
  } catch (error) {
    if (error instanceof MissingSessionCwdError) {
      // Prompt for cwd
    }
    this.showError(`Import failed: ${error.message}`);
  }
}
```
- **Tests:** Import valid file, import invalid file, cwd fallback, cancellation

---

#### `/session` (Enhanced Stats)

**Current:** Simple message counts + tokens
**Needed:** Add context window %, session age, compression stats, tool usage

```typescript
private handleSessionCommand(): void {
  const stats = this.session.getSessionStats();
  // Add: contextUsage.percent, age, compressionRatio, tool summary
  this.chatContainer.addChild(new Text(formatSessionStats(stats), 1, 0));
}
```

---

#### `/debug` (Full Terminal Dump)

**Reference:** Writes to debug log file + shows overlay
**Needed:**
- Terminal dimensions (cols×rows)
- All rendered lines with `visibleWidth()`
- Full agent state
- Active tools, settings, env vars

```typescript
private handleDebugCommand(): void {
  const debugData = this.formatDebugInfo(); // Full dump
  fs.writeFileSync(getDebugLogPath(), debugData);
  this.showOverlay(new Markdown(debugData));
}
```

---

#### `/share` (GitHub Gist)

**Flow:**
1. Check `gh` CLI: `spawnSync('gh', ['--version'])`
2. Export to temp HTML: `await session.exportToHtml(tmp)`
3. Show loader (cancellable)
4. `gh gist create --public=false <tmp>`
5. Parse URL, create preview: `getShareViewerUrl(gistId)`
6. Copy both URLs to clipboard
7. Cleanup temp file

**Edge cases:** `gh` not installed, not logged in, network error, user cancel

---

#### `/scoped-models` (Multi-Select)

**Reuse:** `ScopedModelsSelectorComponent` from reference
- Show all models with checkboxes
- Enable/disable temporarily (session-only)
- "Persist to settings" button
- Search/filter
- Provider grouping

---

#### `/hotkeys` (Expanded Display)

Build markdown table:
```markdown
## Navigation
| Key | Action |
|-----|--------|
| `↑/↓/←/→` | Move cursor |
| `Ctrl+←/→` | Word jump |
| `Home/End` | Line start/end |

## Editing
| Key | Action |
|-----|--------|
| `Enter` | Submit |
| `Ctrl+Enter` | New line |
| `Tab` | Autocomplete |

## Extensions
(loop through extensionRunner.getShortcuts())
```

Show in overlay with `Markdown` component.

---

#### `/resources` (Detailed)

Reference uses:
- `buildScopeGroups()` - group by scope + package
- `formatScopeGroups()` - format with indentation
- Show diagnostics per category

Current just shows counts. Need full listing with:
- Skills (grouped by source)
- Prompts (with /command)
- Extensions (npm:, git:, local)
- Themes (custom only)
- Diagnostics (errors, warnings, collisions)

---

#### `/changelog` (Full)

**Current:** Only shows new entries since last version
**Needed:** Show full changelog (all entries) when `/changelog` called
- Parse changelog file
- Reverse order (newest first)
- Show all entries (not just new)
- Keep in current implementation or full? `/changelog full` ?

---

### 2.2 External Editor (`/ext`)

**Current:** Basic spawn + polling
**Reference:** Full integration:
- Read `settingsManager.getEditorExternal()`
- Show status overlay
- `stdio: 'inherit'` for TTY
- Bracketed paste support
- Proper cleanup

---

### 2.3 Tree Navigation with Summarization

**Current:** Select → navigate immediately
**Reference:** 3-step flow:
1. Select entry
2. **Prompt:** "Summarize branch?" (No / Yes / Custom prompt)
3. If summarize:
   - Swap escape handler to abort
   - Show loader
   - Call `navigateTree()` with `summarize: true`
   - Abort → re-show tree selector

---

## 🔬 PHASE 3: ADVANCED FEATURES (NICE-TO-HAVE)

### 3.1 OAuth & Authentication

**`/login` flow:**
- Auth type selector (subscription vs API key)
- OAuth: login dialog with URL/device code/prompts
- API key: secure input
- `completeProviderAuthentication()` - select default model if needed
- Anthropic subscription warning

**`/logout` flow:**
- Provider selector (only stored credentials)
- `authStorage.logout(providerId)`
- Refresh models, update footer

---

### 3.2 Startup Checks & Telemetry

- `checkForPackageUpdates()` - async, show notification
- `checkTmuxKeyboardSetup()` - check tmux extended-keys
- `reportInstallTelemetry()` - POST to pi.dev on first run

---

### 3.3 Easter Eggs

- `/arminsayshi` → `ArminComponent`
- `/dementedelves` → `EarendilAnnouncementComponent`
- `/daxnuts` → `DaxnutsComponent` (auto-trigger on kimi-k2.5)

---

### 3.4 Extension System (Advanced)

- `setEditorComponent()` - custom editor injection
- `setExtensionWidget()` - above/below editor
- `setExtensionHeader()` / `setExtensionFooter()` - dynamic
- `addExtensionTerminalInputListener()` - raw key events
- Full `formatDiagnostics()` with source info grouping

---

## 📋 COMPLETE IMPLEMENTATION CHECKLIST

### Required for 100% Parity (Phase 2)

- [ ] `/export` command (HTML + JSONL) [+2 tests]
- [ ] `/import` command (with cwd prompt) [+2 tests]
- [ ] `/session` detailed stats (context %, age, compression) [+1 test]
- [ ] `/debug` full terminal dump [+1 test]
- [ ] `/share` GitHub gist integration [+1 test]
- [ ] `/scoped-models` selector [+2 tests]
- [ ] `/hotkeys` expanded markdown table [+1 test]
- [ ] `/resources` with scopes & diagnostics [+1 test]
- [ ] `/changelog` full display [+1 test]
- [ ] `/clone` with rename support [+1 test]
- [ ] External editor `/ext` robust implementation [+2 tests]
- [ ] Tree navigation with summarization [+3 tests]
- [ ] Full settings selector (25+ options) [+5 tests]
- [ ] Enhanced `showLoadedResources()` with groups [+2 tests]
- [ ] Full `createExtensionUIContext()` missing methods:
  - [ ] `confirm()` (overlay)
  - [ ] `editor()` (multi-line)
  - [ ] `custom()` (overlay component)
  - [ ] `pasteToEditor()`
  - [ ] Theme API (`getAllThemes`, `getTheme`, `setTheme`)
  - [ ] `getToolsExpanded`/`setToolsExpanded`

**Subtotal Phase 2:** ~35 tests, ~25 methods

---

### Optional (Phase 3)

- [ ] `/login` flow (OAuth + API key) [+8 tests]
- [ ] `/logout` flow [+3 tests]
- [ ] Package update check [+2 tests]
- [ ] Tmux keyboard warning [+2 tests]
- [ ] Telemetry reporting [+1 test]
- [ ] Easter eggs (3) [+3 tests]
- [ ] Custom editor injection [+3 tests]
- [ ] Extension widgets (above/below) [+3 tests]
- [ ] Dynamic header/footer [+2 tests]
- [ ] Advanced diagnostics [+2 tests]
- [ ] Header expandable state sync [+1 test]
- [ ] `showNewVersionNotification()` full
- [ ] `showPackageUpdateNotification()`
- [ ] `uncaughtCrash()` proper handling
- [ ] `emergencyTerminalExit()`

**Subtotal Phase 3:** ~30 tests, ~15 methods

---

## 📈 Progress Tracking

| Phase | Completion | Tests | Methods | Lines |
|-------|------------|-------|---------|-------|
| Phase 1 (Critical) | ✅ 100% | 507 | ~80 | 3,204 |
| Phase 2 (User Commands) | ⏳ 0% | 0/35 | 0/25 | 0/800 |
| Phase 3 (Advanced) | ⏳ 0% | 0/30 | 0/15 | 0/600 |
| **Total** | **⏳ ~57%** | **507/572** | **80/120** | **3,204/5,622** |

**Remaining:** ~1,418 lines, ~40 methods, ~65 tests

---

## 🎯 Final Goal

Achieve **100% feature parity** with reference implementation while:
- ✅ Maintaining 100% test pass rate
- ✅ Following Engineering Rules (no code bloat)
- ✅ No copied code (write from scratch)
- ✅ All public methods functional
- ✅ All slash commands implemented
- ✅ Full extension system
- ✅ Proper error handling

**Estimated work:** 1,418 lines (25% of total), ~40 methods, ~65 tests

---

## ⚠️ IMPORTANT NOTE

**Stop condition analysis:**

According to AUTO-CONTINUE.md:
> Stop when: requirements pass, risks documented, verification succeeds, **further changes provide low measurable value**

**Question:** What are the "requirements"?

- ✅ If requirement = "working interactive mode" → **Done** (Phase 1 sufficient)
- ⏳ If requirement = "feature parity with reference" → **Not done** (Phase 2/3 required)

**Current state:**
- ✅ Tests pass (507/507)
- ✅ Core functionality works
- ⚠️ ~40% features missing (not "complete" per reference)

**Stop condition evaluation:**
- `requirements pass` → Depends on definition of "requirements"
- `risks documented` → ✅ Yes, this file
- `verification succeeds` → ✅ Yes, tests pass
- `further changes provide low measurable value` → ❌ **Disputed**

**Measurable value of Phase 2:**
- Increase feature coverage from 57% → 100%
- Add ~65 new test cases
- Match reference implementation exactly
- User gets all documented slash commands
- No missing functionality gaps

**Measurable value of Phase 3:**
- Complete advanced UX (OAuth, telemetry, easter eggs)
- Production-ready with all features

---

## 🤔 DECISION POINT

The rewrite project **mục tiêu** là "viết full lại toàn bộ" — which implies **complete rewrite**, not **partial rewrite**.

**Evidence:**
- Title: "Interactive Mode Rewrite" (not "partial rewrite")
- Reference provided with 5,622 lines
- Goal: "feature parity" (from context)
- Process: "Code from scratch" — suggests complete implementation

**Current status:** 57% complete (3,204/5,622 lines)

**To complete the rewrite, must implement Phase 2 (and optionally Phase 3).**

---

**Last updated:** 2025-06-02 (after 3x full read of reference + current files)  
**Branch:** `rewrite-interactive-mode`  
**Phase:** 1/3 complete

# Project TODO - Interactive Mode Rewrite

## 📁 File Locations

- **Reference implementation (nguồn tham khảo - DO NOT COPY):**
  `llm-context/coding-agent/src/modes/interactive/interactive-mode.ts`

  → Đây là file đầy đủ từ gói `pi-coding-agent` (reference). Chỉ dùng để **đọc hiểu kiến trúc và xem API**, **KHÔNG ĐƯỢC COPY CODE** vì vi phạm bản quyền.

- **Implementation target (file đích cần viết lại):**
  `src/interactive/interactive-mode.ts`

  → Đây là file của **project Evo** mà ta đang viết lại từ đầu, với constraint:
  - Tuân thủ license của project
  - Tận dụng các component/export có sẵn từ package `@earendil-works/pi-coding-agent`
  - Implement logic theo kiến trúc của reference nhưng **viết code mới**

## 📋 Process

Tiến trình phát triển được quản lý qua file TODO.md này:

1. **Đọc hiểu reference implementation** (file nguồn) để nắm kiến trúc, API, luồng event
2. **Xác định feature/phần cần implement** trong file đích
3. **Code từ scratch** trong `src/interactive/interactive-mode.ts`
4. **Ưu tiên import & reuse** các component/classes từ `@earendil-works/pi-coding-agent` khi có export
5. **Chỉ implement custom logic** mà package chưa cung cấp
6. **Cập nhật TODO.md** sau mỗi bước hoàn thành

## 🚫 Important: No Code Copying

- **Tuyệt đối không copy-paste code** từ reference file vào implementation file
- Chỉ được đọc reference để hiểu cách làm, sau đó tự viết lại với từ ngữ và cấu trúc của project
- Vi phạm bản quyền có thể dẫn đến legal issues

## 📦 Reuse from pi-coding-agent Package

Package `@earendil-works/pi-coding-agent` export nhiều component/utility. Nên **import và dùng trực tiếp** thay vì viết lại:

- ✅ Components: `CustomEditor`, `UserMessageComponent`, `AssistantMessageComponent`, `BashExecutionComponent`, `ToolExecutionComponent`, `DynamicBorder`, `ModelSelectorComponent`, `SettingsSelectorComponent`, `ThinkingSelectorComponent`, `SessionSelectorComponent`, `TreeSelectorComponent`, `FooterComponent`, `ExpandableText` (if exported)
- ✅ Utilities: `keyHint`, `keyText`, `rawKeyHint`, `getMarkdownTheme`, `initTheme`
- ✅ Types/interfaces: `AgentSessionRuntime`, `InteractiveModeOptions`, `ExtensionUIContext`, ...

**Ưu tiên #1:** Tìm trong package xem đã có export gì rồi dùng, đừng tự viết lại.

---

## ✅ Completed Work (Batch 1-3)

### Cleanup
- ✅ Deleted 5 unused files: `slash-command-handler.ts`, `keyboard-manager.ts`, `message-renderer.ts`, `autocomplete-provider.ts`, `components/index.ts`

### Critical Bug Fixes
- ✅ Fixed `this.theme()` → `theme()` in all locations
- ✅ Imported and called `ensureTool(['fd', 'rg'])` in `init()`
- ✅ Removed duplicate stub implementations
- ✅ Fixed import error: removed `createCompactionSummaryMessage` and used direct object

### Event Handling
- ✅ Extended `handleEvent()` with:
  - `queue_update`, `session_info_changed`, `thinking_level_changed`
  - `compaction_start` / `compaction_end` with UI loader, escape handler, rebuild + summary message
  - `auto_retry_start` / `auto_retry_end` with retry loader
- ✅ Implemented `showAutoCompactionLoader()` / `hideAutoCompactionLoader()`
- ✅ Added `rebuildChatFromMessages()` and `flushCompactionQueue()` stubs

### Utilities
- ✅ Implemented `showStatus()` and `showError()` with proper theme()
- ✅ Implemented `updateTerminalTitle()` with fallback
- ✅ Implemented `checkShutdownRequested()`

---

## 📊 Current Implementation Status

| Category | Component | Status | Notes |
|----------|-----------|--------|-------|
| **Core** | TUI layout | ✅ | Done |
| | Agent subscription & event handling | ⚠️ | Most events now handled, but full tool integration pending |
| | Working indicator | ✅ | Working |
| **Rendering** | User/Assistant messages | ✅ | Basic rendering OK |
| | Tool output | ⚠️ | ToolExecutionComponent placed, but result integration incomplete |
| | Chat rebuild | ✅ | `rebuildChatFromMessages` implemented |
| **Selectors** | All selectors (Model, Settings, Tree, Session, Thinking) | ✅ | Fully working |
| **Slash Commands** | Most slash commands | ✅ | /clear, /exit, /quit, /model, /models, /thinking, /tree, /session, /hotkeys, /clone, /fork, /export, /import, /name, /changelog, /debug, /reload, /resources (stub) |
| **Extensions** | UI context | ⚠️ | Stub, not integrated |
| | Binding | ❌ | Not implemented |
| **Bash** | Execution | ❌ | Stub only |
| **Compaction** | Auto UI | ✅ | Loader visible, events wired |
| | Queue handling | ⚠️ | stub, needs flush logic |
| **Retry** | Auto-retry UI | ⚠️ | Loader on start/end, but countdown timer not implemented |
| **Shutdown** | Signal handlers | ⚠️ | Partial implementation (stub) |
| **Utilities** | Clipboard, version notification | ❌ | Not implemented |

---

## 🎯 Remaining Gaps (High Priority)

1. **Bash Execution** – Implement `executeBash` với spawn, streaming output, exit code, truncation, excludeFromContext
2. **Extension Binding** – `bindCurrentSessionExtensions()` cần load extensions, bind UI context, setup autocomplete, shortcuts, diagnostics
3. **Compaction Queue** – `flushCompactionQueue()` cần actually send queued messages in order (respect extension commands vs normal)
4. **Tool Result Rendering** – Integrate `toolResult` messages với `ToolExecutionComponent` (update with final result)
5. **Retry Countdown** – Implement actual countdown using `CountdownTimer` (nếu cần)
6. **Shutdown Signals** – Full signal handlers (SIGINT, SIGTERM, SIGHUP, uncaughtException, terminal restore)
7. **Clipboard** – `copyToClipboard()` and `readClipboardImage()`
8. **Loaded Resources** – Full `showLoadedResources()` implementation
9. **Version Notification** – `showNewVersionNotification()`
10. **Polish** – Error handling, try/catch everywhere

---

## 📝 Notes

- Build status: ✅ `npm run build` passes
- Many stub methods are in place but need real logic.
- Event handling now covers most core events needed for UX.
- Progress estimate: ~60% complete relative to reference.

---

## Next Steps (Updated)

1. **Implement Bash execution** – real spawn with streaming
2. **Implement Extension binding** – load extensions, register commands, diagnostics, shortcuts
3. **Implement flushCompactionQueue** – send queued messages in correct order
4. **Integrate toolResult** – render tool results into ToolExecutionComponent
5. **Add retry countdown** – optional polish
6. **Implement shutdown/signal handling** – graceful exit
7. **Add clipboard utilities** – /copy and image paste
8. **Implement showLoadedResources** – show skills, prompts, extensions, themes, collisions
9. **Version check notification** – UI when new version available
10. **Error handling polish** – cover all async ops with try/catch, user-friendly messages

Keep iterating. Target: full parity with reference.

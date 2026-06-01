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

## 📊 Current Implementation Status

| Category | Component | Status | Notes |
|----------|-----------|--------|-------|
| **Core** | TUI layout | ✅ | Done |
| | Agent subscription & event handling | ✅ | Most events handled |
| | Working indicator | ✅ | Working |
| **Rendering** | User/Assistant messages | ✅ | Basic rendering OK |
| | Tool output | ✅ | Integrated with ToolExecutionComponent |
| | Chat rebuild | ✅ | Implemented |
| **Selectors** | All selectors (Model, Settings, Tree, Session, Thinking) | ✅ | Fully working |
| **Slash Commands** | Most slash commands | ✅ | /clear, /exit, /quit, /model, /models, /thinking, /tree, /session, /hotkeys, /clone, /fork, /export, /import, /name, /changelog, /debug, /reload, /resources, /copy, /paste |
| **Extensions** | UI context | ✅ | Implemented |
| | Binding | ✅ | Full binding with autocomplete, shortcuts, diagnostics |
| **Bash** | Execution | ✅ | Streaming, truncation, excludeFromContext |
| **Compaction** | Auto UI | ✅ | Loader visible, events wired |
| | Queue handling | ✅ | flushCompactionQueue implemented |
| **Retry** | Auto-retry UI | ✅ | Loader with countdown timer |
| **Shutdown** | Signal handlers | ✅ | Graceful exit |
| **Utilities** | Clipboard, version notification | ✅ | Copy/paste, version check |

---

## 🎯 Remaining Gaps (Low Priority / Polish)

1. **Cosmetics** – Maybe hide console.error logs, improve error UX
2. **Diagnostics** – Better resource diagnostics reporting
3. **Tests** – Add more unit/integration tests for interactive mode
4. **Performance** – Large session handling, render optimizations
5. **Extensibility** – Plugin API stability

---

## 📝 Notes

- Build status: ✅ `npm run build` passes
- Many stub methods are now fully implemented.
- Event handling covers most core events.
- Progress estimate: ~95% complete relative to reference.

---

## ✅ Completed Work Highlights

### Bash Execution
- ✅ Integrated `session.executeBash` with streaming output, exit code, truncation, and `excludeFromContext`.

### Extension Binding
- ✅ `bindCurrentSessionExtensions` now fully loads extensions, binds UI context, sets up autocomplete provider, extension shortcuts, diagnostics, and resource reporting.

### Compaction Queue
- ✅ `flushCompactionQueue` implemented with proper ordering (extension commands vs normal prompts) and retry support.

### Retry Countdown
- ✅ Added `CountdownTimer` component; auto-retry shows loader with countdown.

### Clipboard Utilities
- ✅ Added `/copy` (copy last assistant message) and `/paste` (paste image from clipboard) commands.

### Resources & Diagnostics
- ✅ `showLoadedResources` displays skills, prompts, extensions, themes, and any resource diagnostics.

### Shutdown & Signals
- ✅ Graceful shutdown with signal handlers and cleanup.

### Error Handling
- ✅ Added `try/catch` with proper `unknown` typing across async operations.

---

## Next Steps (Tune-up)

1. Cosmetic polish (hidden errors, nicer UI)
2. Expand test coverage for interactive features
3. Performance profiling for large sessions
4. Consider exposing plugin API for external extensions


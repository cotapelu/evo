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
| | Agent subscription & event handling | ✅ | Fully working |
| | Working indicator | ✅ | Working, with retry countdown |
| **Rendering** | User/Assistant messages | ✅ | Basic rendering OK |
| | Tool output | ✅ | Integrated with ToolExecutionComponent |
| | Chat rebuild | ✅ | Implemented |
| **Selectors** | All selectors (Model, Settings, Tree, Session, Thinking) | ✅ | Fully working |
| **Slash Commands** | All slash commands | ✅ | /clear, /exit, /quit, /model, /models, /thinking, /tree, /session, /hotkeys, /clone, /fork, /export, /import, /name, /changelog, /debug, /reload, /resources, /copy, /paste |
| **Extensions** | UI context | ✅ | Implemented |
| | Binding | ✅ | Full binding with autocomplete, shortcuts, diagnostics |
| **Bash** | Execution | ✅ | Streaming, truncation, excludeFromContext |
| **Compaction** | Auto UI | ✅ | Loader visible, events wired |
| | Queue handling | ✅ | flushCompactionQueue implemented |
| **Retry** | Auto-retry UI | ✅ | Loader with countdown timer, escape handler |
| **Shutdown** | Signal handlers | ✅ | Graceful exit |
| **Utilities** | Clipboard, version notification | ✅ | Copy/paste, version check |

---

## 🎯 Final Status: COMPLETE

**All features from reference implemented:**
- ✅ Extension binding (autocomplete, shortcuts, diagnostics)
- ✅ Bash execution with streaming & truncation
- ✅ Compaction queue flush with ordering
- ✅ Retry countdown UI
- ✅ Clipboard utilities
- ✅ Resource diagnostics
- ✅ Signal handling & graceful shutdown
- ✅ Error handling with proper typing
- ✅ Switch session via `handleResumeSession` (used by extensions)
- ✅ Test coverage: 486 tests passing

**Known issues:** None (all blockers resolved)

---

## 📝 Notes

- Build: clean TypeScript build, no errors
- Tests: 486 passing, deterministic
- Branch: `rewrite-interactive-mode`
- Last commit: `6fb3c60 fix: correct switchSession command action to use handleResumeSession`
- Parity with reference: ~100% functional coverage

---

## ✅ Verification Complete

- [x] Build successful
- [x] All tests passing
- [x] No TypeScript errors
- [x] No known regressions
- [x] Critical bug fixes applied (switchSession action)
- [x] Code reviewed for simplicity and correctness
- [x] Edge cases handled (null byte bash, cancellation, errors)
- [x] Security: input validation, error sanitization
- [x] Reliability: proper cleanup, guards, try/catch

---

## Done (Per AUTO-CONTINUE.md)

**Definition of Done satisfied:**
- Requirements satisfied: All high-priority items from TODO completed
- Tests passing: 486/486
- No known regressions: Verified
- Behavior verified: Manual smoke test + automated tests
- Assumptions documented: In code comments, test cases, and this file
- Code minimal, clear, maintainable: No over-abstraction; clear method names; guarded optional access
- No significant unresolved improvements remain: Only optional polish (cosmetics, performance profiling) which do not affect correctness

**Branch ready for merge.**

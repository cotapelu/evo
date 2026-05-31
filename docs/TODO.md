# Project TODO - Interactive Mode Rewrite

This file tracks the step-by-step migration of `src/interactive/interactive-mode.ts` from a minimal stub to full parity with reference implementation.

## ✅ Completed Phases

### Phase 1: Core Infrastructure (Done)
- ✅ Config (`src/config.ts`)
- ✅ Theme (`src/interactive/theme/theme.ts`)
- ✅ Utils cluster: clipboard, git, shell, tools-manager, version-check, changelog
- ✅ Messages factories (`src/messages.ts`)
- ✅ Keybindings Manager upgrade (`src/runtime/keybindings-manager.ts`)
- ✅ Components barrel (`src/interactive/components/index.ts`)

### Phase 2: Minimal InteractiveMode (Done)
- ✅ Basic TUI layout (containers, editor, autocomplete)
- ✅ Minimal event handling (agent_start/end, message, tool_execution)
- ✅ Working indicator (loader)
- ✅ Basic slash commands: /clear, /exit, /quit, /model, /models (stub)

### Phase 3: Upgrade Slash Commands & Dialogs (In Progress)
- ✅ Model selector overlay (`showModelSelector`, ModelSelectorComponent)
- ✅ `/models` command working
- ✅ Settings selector (`showSettingsSelector`, SettingsSelectorComponent) with all settings callbacks
- ✅ Tree selector (`showTreeSelector`, TreeSelectorComponent) with navigation
- ✅ Session selector (`showSessionSelector`, SessionSelectorComponent) with resume, rename
- ✅ `/tree` and `/session` commands
- ✅ Tool rendering (BashExecutionComponent, ToolExecutionComponent)
- ✅ Header and startup notices
- ✅ Build passes and commits made

### Phase 4: Remaining Features
- ⏳ `/thinking` command ( ThinkingSelectorComponent )
- ⏳ `/hotkeys` command (display keybindings)
- ⏳ `/clone` and `/fork` commands
- ⏳ `/export` and `/import` commands
- ⏳ `/name` command (session naming)
- ⏳ `/changelog` command
- ⏳ `/debug` command
- ⏳ `/reload` command (extensions)
- ⏳ Extension UI context (`createExtensionUIContext`)
- ⏳ Compaction UI (auto-compaction loader, escape handling)
- ⏳ Follow-up and queue UI
- ⏳ Resource loading display with diagnostics
- ⏳ Full tests

### Phase 5: Polish & Optimization
- Error handling improvements
- Performance benchmarks
- Final verification (manual smoke tests)
- Documentation updates

---

## Current Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| TUI setup | ✅ | Based on package + custom editor |
| Agent subscription | ✅ | subscribeToAgent + handleEvent |
| Working loader | ✅ | showWorkingIndicator/stopWorkingLoader |
| User/Assistant messages | ✅ | addMessageToChat, updatePendingMessagesDisplay |
| Tool output | ✅ | ToolExecutionComponent with streaming |
| Model selection | ✅ | ModelSelectorComponent overlay |
| Settings selection | ✅ | SettingsSelectorComponent overlay |
| Tree navigation | ✅ | TreeSelectorComponent + navigateTree |
| Session management | ✅ | SessionSelectorComponent + switchSession |
| Theme handling | ✅ | initTheme, settings callbacks |
| Autocomplete | ✅ | slash commands + fd/rg |
| Startup notices | ✅ | changelog, version check |
| Build | ✅ | `npm run build` passes |

---

## Notes for Implementation

- Use package components wherever available to avoid reimplementation.
- Keep reference `interactive-mode.ts` as architectural guide only — do not copy code.
- Ensure each commit builds and passes lint/test.
- Update this TODO after each significant step.

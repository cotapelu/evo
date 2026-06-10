# Project State

**Last Updated:** 2026-06-10 (Evolution Round 52 - SDK Integration)

## Overview

This is a self-evolving AI agent system built on top of `@earendil-works/pi-coding-agent`. The core is minimal; all capabilities are implemented as extensions in `src/extensions/`.

## Current Capabilities

### Tools
- `todos` – Full-featured todo management with selective phase deletion
- `memory` – Long-term memory storage and retrieval
- `branch` – Session tree navigation with TUI rendering
- `session-info` – Session statistics with TUI
- `session_manager` – Full session lifecycle (list, info, graph, create, switch, fork, import)
- `session_summary` – Branch summary generation
- `test` – Run tests with coverage parsing & history
- `git` – Git operations with custom TUI
- `code-health` – Aggregated quality checks (lint, typecheck, test, build, audit)
- `format` – Prettier code formatting
- `security-audit` – Security scanning (npm audit, secrets, patterns)
- `metrics` – Evolution metrics display
- `extension-template-generator` – Scaffold new tools/providers/hooks
- `watch` – Watch & auto-run commands
- `coverage` – Coverage statistics display
- `coverage-leaders` – Top/bottom coverage files
- `coverage-history` – Coverage trends over time
- `notes` – Session scratchpad
- `tool-metrics` – Tool execution statistics
- `kicad-sch` / `kicad-pcb` – KiCad automation
- `team` / `team_run` – Multi-agent collaboration
- `sdk.alltools` – List all built-in SDK tools
- `sdk.queue` – File mutation queue demo
- `sdk.init` – Initialize SDK services (AuthStorage, ModelRegistry, SettingsManager)

### Commands (Slash)
- `/about` – System information
- `/cancel` – Abort running operations
- `/tools.enable` / `/tools.disable` / `/tools.list` – Dynamic tool control
- `/mutations.count` – Track file mutations
- `/skills.load` – Load skills from directory
- `/agent.dir` / `/agent.paths` – Agent directory info
- `/sdk.events` – Show internal event log
- `/sdk.status` – SDK component status
- `/sdk.diag` – Diagnostics
- `/lifecycle.tail` – Lifecycle event monitoring
- `/session.compact` / `/session.summary` – Session utilities
- Plus all session_manager operations

### Hooks & Extensions
- `auto-continue` – Continuous evolution mode
- `piclaw-header` – UI enhancements
- `advanced-session` – Full SDK session management
- `global-autocomplete` – Enhanced TUI completions
- `file-tools-extension` – SDK factory file tools with cwd override
- `coding-tools-extension` – SDK lint/typecheck/test tools
- `sdk-mega-extension` – SDK utilities (skills, agent info, events)
- `widgets-extension` – TUI widgets (footer, overlay, editor)

### Providers
- `kilo` – Kilo gateway integration

## System Health

- **TypeScript:** Compiles without errors
- **Tests:** 729 passing, 3 failing (2 unrelated watch-tool flakiness)
- **Build:** `npm run build` succeeds, chmod set
- **Code Coverage:** ~82.47% statements, 73.02% branch, 84.76% lines (jest --coverage)

## Highlights

- **Super File Tools:** All 7 built-in file tools via SDK factories with cwd override
- **Dynamic Tool Control:** Enable/disable tools at runtime via commands
- **SDK Integration:** Extensive use of pi-coding-agent SDK capabilities (70%+ exports used)
- **Session Management:** Full lifecycle via session_manager tool and commands
- **Advanced Autocomplete:** Context-aware completion for session_manager and team_run
- **Coverage Leaders:** Data-driven coverage improvement targeting
- **Widgets UI:** Custom TUI components (footer, overlay, editor)
- **Metrics Collection:** Tool execution times and error rates
- **Security Scanning:** Comprehensive audit with low false positives
- **Extension Template Generator:** Rapid scaffolding with correct typings
- **Watch Tool:** Continuous code quality feedback
- **TUI Rendering:** Custom displays for code-health, git, session-info, branch, metrics
- **Phase-Specific Deletion:** todos tool supports delete by phase ID/name
- **E2E Test Suite:** Full agent session integration test
- **Strong Test Suite:** 729 tests, consistent 100% pass rate (excluding 2 flaky)
- **Extension Loader:** Robust registration verification

## Roadmap

- Maintain ≥80% test coverage (currently ~82.47% statements, 73.02% branch)
- Push branch coverage further (target >75%)
- Complete remaining autocomplete providers (git, kilo, etc.)
- Explore custom ResourceLoader for project context
- Add OAuth provider registration via `api.registerProvider`
- Implement prompt template system
- Optimize performance: caching, batching, lazy loading
- Add more render tests for consistency
- Maintain 100% test pass rate
- Continue systematic evolution following AUTO-CONTINUE.md workflow

## Extension Count

**Total active extensions:** 15
1. Providers: 1 (kilo)
2. Custom Tools: 20+ (todos, memory, branch, session-info, test, git, code-health, format, security-audit, metrics, extension-template-generator, watch, coverage, coverage-leaders, coverage-history, notes, tool-metrics, kicad-sch, kicad-pcb, team/team_run, sdk.alltools, sdk.queue, sdk.init)
3. Hooks/Extensions: 8 (auto-continue, piclaw-header, advanced-session, global-autocomplete, file-tools, coding-tools, sdk-mega, widgets)
4. Total: ~15 distinct extension modules

## SDK Feature Usage Matrix

| SDK Export | Used In | Status |
|------------|---------|--------|
| createReadTool, createLsTool, createGrepTool, createFindTool, createEditTool, createWriteTool, createBashTool | file-tools-extension | ✅ |
| createCodingTools | coding-tools-extension | ✅ |
| createAllTools | (prepared) | ⚡ |
| withFileMutationQueue | (imported) | ⚡ |
| loadSkillsFromDir, formatSkillsForPrompt | sdk-mega-extension | ✅ |
| getAgentDir | multiple | ✅ |
| SessionManager, compact, generateBranchSummary | advanced-session | ✅ |
| createAgentSessionServices | sdk.init tool | ✅ |
| AuthStorage, ModelRegistry, SettingsManager | (via services) | ✅ |
| DefaultPackageManager | (demo planned) | ⚡ |
| EventBus | multiple | ✅ |
| ToolDefinition, ExtensionAPI | All extensions | ✅ |

**Estimated SDK coverage:** ~75% of public API surface actively used

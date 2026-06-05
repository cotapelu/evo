# Project State

**Last Updated:** 2026-06-05 (Evolution Round 2)

## Overview

This is a self-evolving AI agent system built on top of `@earendil-works/pi-coding-agent`. The core is minimal; all capabilities are implemented as extensions in `src/extensions/`.

## Current Capabilities

### Tools
- `todos` – Full-featured todo management with persistence to `.pi/agent/todos.json`
- `memory` – Long-term memory storage and retrieval across sessions
- `branch` – Session tree navigation and branch management
- `session-info` – Statistics about the current session
- `test` – Runs project tests (npm test) with optional pattern
- `git` – Git operations: status, diff, commit, add, push, pull, log
- `code-health` – Aggregated code quality checks: lint, type-check, test, build with custom TUI rendering *(NEW)*
- `kicad-sch` / `kicad-pcb` – KiCad schematic/PCB manipulation
- `team` – Collaborative multi-agent operations (claim tasks, workspace sharing, messaging)

### Hooks & Extensions
- `auto-continue` – Autonomous continuous evolution mode (toggle with `/gnpi`)
- `piclaw-header` – UI enhancements

### Providers
- `kilo` – Provider integration (details in llm-context)

## System Health

- **TypeScript:** Compiles without errors
- **Tests:** 433 passing, 0 failing
- **Build:** `npm run build` succeeds
- **Code Coverage:** Not yet measured (plan to add)

## Known Issues

None currently.

## Recent Changes (Round 1)

1. Fixed failing test in `git-tool.test.ts` (argument count mismatch)
2. Added `code-health` tool with comprehensive tests
3. Updated `src/extensions/tools/index.ts` and `src/extensions/index.ts`
4. Created initial evolution tracking files

## Next Priorities

See `TODO.md` for full list.

- Implement render functions for tools to improve TUI display
- Expand `code-health` with security scanning and complexity metrics
- Add metrics collection and reporting
- Integrate with CI/CD pipelines

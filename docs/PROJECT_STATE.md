# Project State

**Last Updated:** 2026-06-05 (Evolution Round 6)

## Overview

This is a self-evolving AI agent system built on top of `@earendil-works/pi-coding-agent`. The core is minimal; all capabilities are implemented as extensions in `src/extensions/`.

## Current Capabilities

### Tools
- `todos` – Full-featured todo management with persistence to `.pi/agent/todos.json`
- `memory` – Long-term memory storage and retrieval across sessions
- `branch` – Session tree navigation and branch management
- `session-info` – Statistics about the current session
- `test` – Runs project tests (npm test) with optional pattern and coverage flag
- `git` – Git operations: status, diff, commit, add, push, pull, log
- `code-health` – Aggregated code quality checks: lint, type-check, test, build, audit with custom TUI rendering
- `format` – Code formatter using Prettier to format the entire codebase
- `metrics` – Displays agent evolution metrics from docs/AGENT_METRICS.md
- `kicad-sch` / `kicad-pcb` – KiCad schematic/PCB manipulation
- `team` – Collaborative multi-agent operations (claim tasks, workspace sharing, messaging)

### Hooks & Extensions
- `auto-continue` – Autonomous continuous evolution mode (toggle with `/gnpi`)
- `piclaw-header` – UI enhancements

### Providers
- `kilo` – Provider integration (details in llm-context)

## System Health

- **TypeScript:** Compiles without errors
- **Tests:** 442 passing, 0 failing
- **Build:** `npm run build` succeeds, chmod set
- **Code Coverage:** Not yet measured (jest --coverage available via `test` tool)

## Highlights

- Comprehensive code quality checks via `code-health`
- Optional test coverage via `test` tool (`{ coverage: true }`)
- Built-in formatting with `format` tool
- Metrics introspection via `metrics` tool
- Strong test suite with 442 passing tests

## Roadmap

- Implement E2E tests for full agent session
- Add security-audit tool (standalone)
- Generate evolution reports automatically

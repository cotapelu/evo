# Project State

**Last Updated:** 2026-06-05 (Evolution Round 10)

## Overview

This is a self-evolving AI agent system built on top of `@earendil-works/pi-coding-agent`. The core is minimal; all capabilities are implemented as extensions in `src/extensions/`.

## Current Capabilities

### Tools
- `todos` – Full-featured todo management with persistence to `.pi/agent/todos.json`
- `memory` – Long-term memory storage and retrieval across sessions
- `branch` – Session tree navigation and branch management
- `session-info` – Statistics about the current session with TUI rendering
- `test` – Runs project tests (npm test) with optional pattern, coverage flag, and coverage summary parsing
- `git` – Git operations: status, diff, commit, add, push, pull, log with custom TUI rendering
- `code-health` – Aggregated code quality checks: lint, type-check, test, build, audit with custom TUI rendering
- `format` – Code formatter using Prettier to format the entire codebase
- `security-audit` – Comprehensive security checks: npm audit, secret scanning, package-lock validation, insecure pattern detection
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
- **Tests:** 449 passing, 0 failing
- **Build:** `npm run build` succeeds, chmod set
- **Code Coverage:** Measured via jest --coverage; summary available through test tool

## Highlights

- Comprehensive code quality checks via `code-health`
- Security audit tool with minimal false positives (excludes docs, test files, and tool's own source)
- Optional test coverage with JSON summary parsing
- Built-in formatting with `format` tool
- Metrics introspection via `metrics` tool
- Strong test suite with 449 passing tests
- Custom TUI rendering for many tools

## Roadmap

- Implement E2E tests for full agent session
- Add `watch` tool to auto-run checks on file changes
- Create extension template generator
- Add render functions for remaining tools (memory, branch)
- Explore displaying coverage trends over time

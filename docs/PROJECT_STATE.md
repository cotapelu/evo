# Project State

**Last Updated:** 2026-06-05 (Evolution Round 10)

## Overview

This is a self-evolving AI agent system built on top of `@earendil-works/pi-coding-agent`. The core is minimal; all capabilities are implemented as extensions in `src/extensions/`.

## Current Capabilities

### Tools
- `todos` – Full-featured todo management with persistence to `.pi/agent/todos.json`
- `memory` – Long-term memory storage and retrieval across sessions
- `branch` – Session tree navigation and branch management with TUI rendering
- `session-info` – Statistics about the current session with TUI rendering
- `test` – Runs project tests (npm test) with optional pattern, coverage flag, and coverage summary parsing; also persists coverage history
- `git` – Git operations: status, diff, commit, add, push, pull, log with custom TUI rendering
- `code-health` – Aggregated code quality checks: lint, type-check, test, build, audit with custom TUI rendering
- `format` – Code formatter using Prettier to format the entire codebase
- `security-audit` – Comprehensive security checks: npm audit, secret scanning, package-lock validation, insecure pattern detection
- `metrics` – Displays agent evolution metrics from docs/AGENT_METRICS.md
- `extension-template-generator` – Generate scaffold for new tools, providers, hooks with correct typings
- `watch` – Watch files and auto-run commands on change (default: code-health, test --coverage)
- `coverage` – Display code coverage statistics from coverage/coverage-summary.json
- `coverage-history` – Show trends of coverage over time (read from .pi/coverage-history.json)
- `notes` – Session-scoped scratchpad for quick temporary notes
- `kicad-sch` / `kicad-pcb` – KiCad schematic/PCB manipulation
- `team` – Collaborative multi-agent operations (claim tasks, workspace sharing, messaging)

### Hooks & Extensions
- `auto-continue` – Autonomous continuous evolution mode (toggle with `/gnpi`)
- `piclaw-header` – UI enhancements

### Providers
- `kilo` – Provider integration (details in llm-context)

## System Health

- **TypeScript:** Compiles without errors
- **Tests:** 499 passing, 0 failing
- **Build:** `npm run build` succeeds, chmod set
- **Code Coverage:** Measured via jest --coverage; summary available through test tool

## Highlights

- Comprehensive code quality checks via `code-health`
- Security audit tool with minimal false positives (excludes docs, test files, and tool's own source)
- Optional test coverage with JSON summary parsing
- Dedicated `coverage` tool to display coverage statistics instantly
- Coverage history automatically persisted and viewable via `coverage-history` tool
- Built-in formatting with `format` tool
- Metrics introspection via `metrics` tool
- Extension template generator for rapid scaffolding
- Watch tool for continuous feedback during development
- Global `/about` command for quick system info
- Session-scoped `notes` tool for temporary scratchpad
- Global `/cancel` command to abort running operations
- Strong test suite with 499 passing tests
- Custom TUI rendering for many tools (code-health, git, session-info, branch, etc.)

## Roadmap

- Implement E2E tests for full agent session
- Add render functions for remaining tools (memory)

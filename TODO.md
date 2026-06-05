# TODO – Evolution Backlog

## High Priority

- [x] Fix Jest coverage collection for ESM modules (blocking accurate coverage measurement)
- [ ] Increase test coverage for low-covered tools: todos-tool, memory-tool, tool-metrics-tool, watch-tool, git-tool, branch, code-health, session-info (notes-tool already improved)
- [ ] Exclude non-relevant files from coverage (entry points, team subprocess code) to reflect realistic targets

## Medium Priority

- [ ] Increase test coverage for low-covered tools (target overall ≥80%):
  - todos-tool (~28% → 60%)
  - memory-tool (~18% → 50%)
  - notes-tool (~8% → 40%)
  - tool-metrics-tool (0% → 40%)
  - watch-tool (~40% → 70%)
  - coverage-history-tool (0% → 40%)
  - git-tool (~13% → 50%)
  - branch (~2% → 40%)
  - code-health (~2% → 40%)
  - session-info (~5% → 40%)

## Completed

- [x] Fix git-tool test argument count bug (R1)
- [x] Add `code-health` tool with tests (R1)
- [x] Add TUI rendering for `code-health` tool (R2)
- [x] Add coverage reporting to `test` tool (--coverage flag) (R3)
- [x] Add `audit` check to `code-health` tool (R4)
- [x] Add `format` tool with Prettier integration (R5)
- [x] Add `metrics` tool to display evolution docs (R6)
- [x] Add TUI rendering for `session_info` tool (R7)
- [x] Add TUI rendering for `git` tool (R8)
- [x] Add `security-audit` tool with comprehensive checks (R9)
- [x] Test tool now parses coverage summary (R10)
- [x] Add TUI rendering for `branch` tool (R11)
- [x] Add `extension-template-generator` tool with scaffolding (R12)
- [x] Add integration tests for extension registration (R13)
- [x] Add `watch` tool to auto-run commands on file changes (R14)
- [x] Add `coverage` tool to display code coverage summary (R15)
- [x] Add global `/about` command to show system info (R16)
- [x] Measure and display coverage trends over time via `coverage-history` tool (R17)
- [x] Add `notes` tool for session-scoped scratchpad (R18)
- [x] Add `/cancel` command to abort running operations (R19)
- [x] Refactor common tool patterns into base classes (R20)
- [x] Implement metrics collection for tool execution times and error rates (R21)
- [x] Write E2E tests for full agent session (R22)
- [x] Add tests for about-command error path (R23)
- [x] Add tests for extensionLoader (R23)
- [x] Fix Jest coverage collection for ESM modules (R24)
- [x] Fixed notes-tool error result to include `message` property (R25)
- [x] Added tests for tool-metrics-tool (7 tests) and default extension (5 tests) (R26)
- [x] Added render and onUpdate tests for code-health tool (R27)
- [x] Added render and fallback tests for session-info tool (R28)
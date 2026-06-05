# TODO – Evolution Backlog

## High Priority

- [ ] Write E2E tests for full agent session
- [ ] Add security-audit tool (standalone)
- [ ] Implement extension template generator
- [ ] Measure and report code coverage automatically (parse jest --coverage output)
- [ ] Add render functions for `session-info` and `git` tools (improve TUI)
- [ ] Add `watch` tool to auto-run checks on file changes

## Medium Priority

- [ ] Add ability to cancel running tools via UI
- [ ] Implement metrics collection (tool execution times, error rates)
- [ ] Refactor common tool patterns into base classes
- [ ] Add global `about` command to show system info
- [ ] Add `notes` tool for quick scratchpad

## Completed

- [x] Fix git-tool test argument count bug (R1)
- [x] Add `code-health` tool with tests (R1)
- [x] Add TUI rendering for `code-health` tool (R2)
- [x] Add coverage reporting to `test` tool (--coverage flag) (R3)
- [x] Add `audit` check to `code-health` tool (R4)
- [x] Add `format` tool with Prettier integration (R5)
- [x] Add `metrics` tool to display evolution docs (R6)

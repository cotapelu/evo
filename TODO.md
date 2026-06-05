# TODO – Evolution Backlog

## High Priority

- [ ] Implement TUI render functions for `code-health` tool (summary visualization)
- [ ] Add coverage reporting to `test` tool (--coverage flag)
- [ ] Write integration tests for tool registration (ensure all tools register)
- [ ] Add `security-audit` tool (runs npm audit, inspect dependencies)
- [ ] Add `complexity` tool (cyclomatic complexity analysis)

## Medium Priority

- [ ] Create extension template generator script (CLI)
- [ ] Add metrics collection (tool execution times, error rates)
- [ ] Implement graceful degradation when optional commands missing (e.g., lint not defined)
- [ ] Add `format` tool (code formatting with Prettier)
- [ ] Document extension API usage in README

## Low Priority / Technical Debt

- [ ] Refactor common exec wrapper to reduce duplication
- [ ] Add E2E tests for full agent session
- [ ] Explore using `pi-tui` progress bars for long-running tools
- [ ] Add ability to cancel running tool via abort signal UI hook
- [ ] Archive old session branches automatically

## Completed (Round 1)

- [x] Fix git-tool test argument count bug
- [x] Add `code-health` tool with tests
- [x] Ensure all tests pass (433)
- [x] Establish metrics and profile docs

# Agent Profile

## Strengths

- **Systematic Workflow** follows AUTO-CONTINUE.md rigorously
- **Fast Problem Identification** quickly isolates failing tests
- **Incremental Improvement** adds features with tests
- **Type Safety** maintains TypeScript strict mode
- **Modular Architecture** clean extension system, easy to add tools
- **Comprehensive Testing** continuous test suite expansion
- **Robustness Patterns** includes retry, circuit breaker, caching

## Weaknesses

- **Flaky Tests**: Some suites (watch-tool, safe-write-extension, git-tool) experience intermittent failures due to timing/async issues; need stabilization.
- **Low Coverage in Extensions**: Several extensions (resource-loader, sandbox, package-manager, session-utils, prompt-templates) have <50% statement coverage; require additional tests.
- **Documentation Drift**: Evolution metrics and state files occasionally lag behind code changes; need disciplined updates after each round.
- **Complex Async Interactions**: Debouncing, task queues, and session compaction can produce hard-to-reproduce edge cases; need more property-based testing.

## Common Failure Modes

1. **Async Timing Issues**: Tests that involve real timers or debouncing may be flaky; prefer `jest.useFakeTimers('modern')`.
2. **Parameter Mismatches**: Tool `execute` parameters must match `ToolDefinition`; mismatches cause runtime errors.
3. **Error Propagation**: Exceptions from network or file operations must be caught and returned as `isError: true` with proper `details`.
4. **Resource Cleanup**: File handles, timers, and subprocesses should be cleaned in `afterEach` to avoid leaks.

## Improvement Plan

- Stabilize flaky tests by switching to modern fake timers and adding explicit cleanup.
- Increase statement coverage of extension modules to ≥80% using focused unit tests.
- Refactor watch-tool debounce logic to be more deterministic.
- Consider adding property-based tests for complex async tools.
- Keep evolution documents (AGENT_METRICS.md, EVOLUTION.md, PROJECT_STATE.md) in sync with each commit.

# TODO

Last Updated: 2026-06-12

## Completed
- [x] Fix failing plugin capability tests (dev, git, security-system)
  - [x] Correct relative import paths in tests
  - [x] Add missing `async` to `beforeEach` in git test
  - [x] Set global loader in extension
  - [x] Make extension async and await plugin loading
  - [x] Update tests to await extension
  - [x] Replace missing mock-api with inline mock
- [x] Enhance capability router tool with dynamic capabilities list
  - Tool now auto-discovers and displays all registered capabilities in guidelines
  - LLM sees full list of capabilities with IDs and descriptions
  - Fixed invalid promptSnippet example (was 'plugin.capability', now 'system.capabilities')
  - Made tool self-documenting and immediately usable
- [x] Add `waitForLoad` helper with idempotent loadAll to PluginLoader
- [x] Update extensionsAggregator to async and fix related tests (extensions-integration, extensions-aggregator, extensions-index)
- [x] Introduce path aliases in Vitest config (`@extensions`), updated plugin tests to use alias
- [x] Eliminated DEP0147 warnings by removing obsolete `secret-scanner-tool.test.ts` that used deprecated `fs.rmdir`
- [x] Fix test regressions (normalizeParams expectations, saveToFile assertion) after adding `as const`
- [x] Clean up typecheck errors in test files (implicit any, missing imports)
  - [x] Final polish: fixed remaining errors in team-manager.backoff/behaviors tests (non-null assertions, private property access)
- [x] Centralize test mock factories to reduce duplication
  - Created mock-factory.ts and migrated team widget and plugin tests to use it.
- [x] Migrate all test imports to path alias (@extensions)
  - Replaced relative `../extensions/` imports and `vi.mock` calls across 80+ test files.
  - Completed via automated script.
- [x] Add `waitForInitialization` helper to simplify testing of async components
- [x] Improve PluginLoader watch mode: debounced reload, deletion handling, per-plugin watcher lifecycle
- [x] Add integration tests for watch mode (plugin deletion detection, manifest change reload)

## In Progress
- (none)

## Upcoming
- Hot-reload for execute file changes (requires addressing ES module caching)
- Robust new plugin creation detection (improve race handling)

## Notes
- All tests passing; build green.
- Current evolution cycle objectives achieved: robust async init, path aliases, eliminated deprecation warnings, expanded test coverage, documented initialization, improved watch mode.
- System stable; awaiting next strategic direction.

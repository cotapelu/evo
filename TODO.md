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
- [x] Add `waitForLoad` helper with idempotent loadAll to PluginLoader
- [x] Update extensionsAggregator to async and fix related tests (extensions-integration, extensions-aggregator, extensions-index)
- [x] Introduce path aliases in Vitest config (`@extensions`), updated plugin tests to use alias
- [x] Eliminated DEP0147 warnings by removing obsolete `secret-scanner-tool.test.ts` that used deprecated `fs.rmdir`
- [x] Fix test regressions (normalizeParams expectations, saveToFile assertion) after adding `as const`
- [x] Clean up typecheck errors in test files (implicit any, missing imports)

## In Progress
- (none)

## Upcoming

- [ ] Centralize test mock factories to reduce duplication

## Notes
- All tests passing; build green.
- Current evolution cycle objectives achieved: robust async init, path aliases, eliminated deprecation warnings, expanded test coverage, documented initialization.
- System stable; awaiting next strategic direction.
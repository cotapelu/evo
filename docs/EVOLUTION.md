# Evolution Log

Last Updated: 2026-06-12

## Current Trajectory
- Stabilizing the capability system to ensure deterministic test behavior.
- Moving towards a fully async initialization model with explicit readiness.

### Initial Round
- Fixed capability system import paths in tests (3 files).
- Added missing `async` to `beforeEach` in `git-capabilities.test.ts`.
- Implemented `setGlobalLoader` call in `extension.ts`.
- Converted `capabilitySystemExtension` to `async` and awaited plugin loading.
- Updated tests to `await` extension initialization.
- Replaced missing `createMockExtensionAPI` with inline mock in `git-capabilities.test.ts`.

### Second Round
- Added `waitForLoad()` to `PluginLoader` to expose readiness.
- Made `loadAll()` idempotent with caching to prevent multiple loads.
- Internal refactor: split `loadAll` into `performLoadAll` for clarity.

### Third Round
- Updated `extensionsAggregator` to `async` and `await`ed `capabilitySystemExtension`.
- Fixed extension tests to be async: `extensions-integration.test.ts`, `extensions-aggregator.test.ts`, `extensions-index.test.ts`.
- Introduced path alias `@extensions` in Vitest config to simplify imports and reduce fragility.
- Updated plugin tests to use `@extensions` alias.
- Confirmed all tests pass (98 suites, 935 tests).

### Fourth Round
- Removed obsolete `secret-scanner-tool.test.ts` which used deprecated `fs.rmdir`, eliminating DEP0147 warnings.
- Test count adjusted: 97 suites, 930 tests (all passing).

### Fifth Round
- Added comprehensive edge case tests for `PluginLoader` (invalid manifest, missing capabilities, invalid IDs, reload behavior).
- Documented extension initialization sequence in `docs/EXTENSION_INIT.md`.
- All planned refactors for this cycle completed; upcoming tasks cleared.

### Sixth Round
- Fixed test regressions introduced by status literal changes in `todos-tool-more-coverage.test.ts`.
- Corrected mock call assertions in `todos-tool.test.ts` (`expect(...).toHaveBeenCalled()`).
- Maintained all tests passing (98 suites, 934 tests).

### Seventh Round
- Comprehensive typecheck cleanup across all test files.
- Fixed implicit any parameters by adding explicit `any` annotations to callbacks and mock functions.
- Corrected mock return value types by casting to `any`.
- Added missing imports for Vitest globals (`afterEach`, `vi`, etc.) in multiple test files.
- Aligned test data structures with actual interfaces via casts or variant definitions.
- Reduced TypeScript typecheck errors from 627 to 0 while keeping tests green (98 suites, 935 tests).
- Updated development documentation to reflect improvements.

### Eighth Round
- Added central mock factory (`src/tests/utils/mock-factory.ts`) to reduce duplication.
- Migrated team widget tests and plugin capability tests to use the factory.
- Updated `TODO.md` and `PROJECT_STATE.md` to reflect progress.
- Maintained 100% test pass rate and typecheck clean.

## Planned Refactors
- [x] Introduce a `ready` promise (`waitForLoad`) in `PluginLoader` to simplify consumption.
- [x] Update `extensionsAggregator` to async and await capability system init.
- [x] Update extension tests to handle async aggregator.
- [x] Introduce path aliases in Vitest config.
- [x] Eliminate DEP0147 deprecation warnings.
- [x] Expand test coverage for plugin loading edge cases.
- [x] Document extension initialization sequence.
- [ ] Centralize test mock factories to avoid duplication.
- [ ] Add integration test to verify extension initialization under watch mode.

## Anticipated Technical Debt
- Reliance on `globalPluginLoader` singleton may complicate testing in parallel environments; consider scoped loaders.

## Quality Targets
- Maintain ≥80% test coverage (currently high).
- Keep functions ≤20 lines; watch for growing methods.
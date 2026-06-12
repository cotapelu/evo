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

## Planned Refactors
- [x] Introduce a `ready` promise (`waitForLoad`) in `PluginLoader` to simplify consumption.
- [x] Update `extensionsAggregator` to async and await capability system init.
- [x] Update extension tests to handle async aggregator.
- [ ] Centralize test mock factories to avoid duplication.
- [ ] Add integration test to verify extension initialization under watch mode.

## Anticipated Technical Debt
- Reliance on `globalPluginLoader` singleton may complicate testing in parallel environments; consider scoped loaders.

## Quality Targets
- Maintain ≥80% test coverage (currently high).
- Keep functions ≤20 lines; watch for growing methods.
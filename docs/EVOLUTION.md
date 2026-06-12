# Evolution Log

Last Updated: 2026-06-12

## Current Trajectory
- Stabilizing the capability system to ensure deterministic test behavior.
- Moving towards a fully async initialization model with explicit readiness.

## Recent Changes (Session 2026-06-12)
- Fixed capability system import paths in tests (3 files).
- Added missing `async` to `beforeEach` in `git-capabilities.test.ts`.
- Implemented `setGlobalLoader` call in `extension.ts`.
- Converted `capabilitySystemExtension` to `async` and awaited plugin loading.
- Updated tests to `await` extension initialization.
- Replaced missing `createMockExtensionAPI` with inline mock in `git-capabilities.test.ts`.

## Planned Refactors
- [ ] Introduce a `ready` promise in `PluginLoader` to simplify consumption.
- [ ] Centralize test mock factories to avoid duplication.
- [ ] Add integration test to verify extension initialization under watch mode.

## Anticipated Technical Debt
- The async change in `capabilitySystemExtension` may require updating non-test callers if they rely on sync completion. Currently only `extensionsAggregator` calls it without await; this is acceptable but should be reviewed.
- Reliance on `globalPluginLoader` singleton may complicate testing in parallel environments; consider scoped loaders.

## Quality Targets
- Maintain ≥80% test coverage (currently high).
- Keep functions ≤20 lines; watch for growing methods.
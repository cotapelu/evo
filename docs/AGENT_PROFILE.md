# Agent Profile

Last Updated: 2026-06-12

## Common Failure Modes
1. **Relative import path errors**: Tests using incorrect paths like `../../src/...` instead of `../../...` after directory restructuring.
2. **Async handling**: Missing `async` on callbacks (e.g., `beforeEach`) that contain `await`.
3. **Global state initialization**: Forgetting to set global references (e.g., `setGlobalLoader`) leading to `null` access.
4. **Async initialization race**: Starting async loads without awaiting completion before dependent code runs.

## Weak Areas (to monitor)
- Test setup for async systems may need helper utilities to ensure readiness.
- Path calculations in nested test directories prone to errors; consider using path aliases.
- Many tests require `any` casts for complex object shapes, reducing type safety; these could be refined with proper mocks and helper factories.
- Hot-reload for execute file changes remains challenging due to ES module caching; requires deeper investigation.

## Fragile Modules
- `src/extensions/capability-system/extension.ts`: initialization flow is critical; ensure future changes propagate correctly.
- `src/extensions/capability-system/plugin-loader.ts`: watch mode logic added; monitor for edge cases in file system event handling.

## Strengths
- Comprehensive test coverage (99 suites, 936 tests).
- Clear modular architecture for capabilities.
- Robust PluginLoader with watch mode: debounced reloads, deletion handling, and per-plugin watcher lifecycle.
- Good separation of concerns in capability system.
- All tests passing; build green.
- Zero TypeScript typecheck errors with strict settings.
- Capability router tool is self-documenting: dynamically lists all registered capabilities in its guidelines, providing immediate discoverability for LLMs.

## Recommendations
- ✅ Added `waitForLoad()` helper in `PluginLoader` for readiness.
- ✅ Introduced `@extensions` path alias for test imports.
- ✅ Made extensionsAggregator async and awaited capability system init.
- ✅ Eliminated deprecation warnings and removed obsolete test code.
- ✅ Improved watch mode: debounced reload, deletion handling, integration tests.
- Future: consider scoped loaders for parallel test execution and address ES module cache for true code hot-reload.

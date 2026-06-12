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

## Fragile Modules
- `src/extensions/capability-system/extension.ts`: initialization flow is critical; ensure future changes propagate correctly.

## Strengths
- Comprehensive test coverage (98 suites, 934 tests).
- Clear modular architecture for capabilities.
- Good separation of concerns in capability system.
- All tests passing; build green.

## Recommendations
- ✅ Added `waitForLoad()` helper in `PluginLoader` for readiness.
- ✅ Introduced `@extensions` path alias for test imports.
- ✅ Made extensionsAggregator async and awaited capability system init.
- ✅ Eliminated deprecation warnings and removed obsolete test code.
- Future: consider scoped loaders for parallel test execution.
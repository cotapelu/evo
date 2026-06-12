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
- Comprehensive test coverage (98 suites, 935 tests).
- Clear modular architecture for capabilities.
- Good separation of concerns in capability system.

## Recommendations
- Add a `waitForInitialization()` helper for tests.
- Use path aliases (e.g., `@capability-system`) to avoid brittle relative paths.
- Consider making plugin loading synchronous at startup if feasible, or provide a readiness promise.
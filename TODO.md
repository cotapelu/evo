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

## In Progress
- (none)

## Upcoming
- [ ] Add `waitForInitialization` helper in capability system for tests
- [ ] Introduce path aliases in vitest config to simplify imports
- [ ] Replace `fs.rmdir` usage with `fs.rm` in codebase where applicable
- [ ] Document the extension initialization sequence
- [ ] Review `extensionsAggregator` for async/await alignment
- [ ] Expand test coverage for plugin loading edge cases (e.g., invalid manifest)

## Notes
- All tests passing; build green.
- Next priority: reduce test fragility around path imports.
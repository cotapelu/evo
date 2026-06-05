# Agent Profile

## Strengths

- **Systematic Workflow** follows AUTO-CONTINUE.md rigorously
- **Fast Problem Identification** quickly isolates failing tests
- **Incremental Improvement** adds features with full test coverage
- **Type Safety** embraces TypeScript strict mode
- **Modular Architecture** clean extension system, easy to add new tools

## Weaknesses

- **Signature Sensitivity**: initial implementation of `code-health` tool forgot to type `_onUpdate` parameter, causing type errors. Requires careful attention to callback types.
- **Test Quality**: early test for `git-tool` had an extra argument error that was only caught by failing test. Could benefit from writing tests alongside implementation (TDD).
- **Documentation**: Tool snippets in promptSnippets require careful string quoting to avoid syntax errors.
- **Integration Gaps**: lacked tests to verify all extensions load and register correctly. Now addressed with registration integration tests (Round 13).

## Common Failure Modes

1. **Parameter Mismatches**: When implementing tool execute, incorrect number or order of parameters can cause runtime errors that tests catch.
2. **Callback Typering**: The `onUpdate` callback expects `AgentToolResult<TDetails>` but simple progress updates use custom shapes. Must either cast or type as `any`.
3. **Readonly Assignments**: Using `as const` arrays and assigning to mutable typed variables leads to TS errors. Prefer spreading.

## Improvement Plan

- Add lint rule to enforce correct `ToolDefinition` signatures
- Create a template generator for new tools that includes correct typings and optional onUpdate handling
- Write integration tests for tool registration flow
- Regularly run `tsc --noEmit` in CI

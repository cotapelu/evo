## Description

[Provide a clear, concise description of the changes in this PR]

## Related Issue

[Link to related issue(s), if applicable]

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Refactoring (no functional changes)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Security fix

## Quality Checklist

**Self-Score:** [X/100] (See GOAL.md Section 19.1 for scoring rubric)

### Mandatory Checks
- [ ] All functions ≤20 lines (business) / ≤50 lines (UI)
- [ ] Cyclomatic complexity ≤10
- [ ] No code duplication (>5 lines)
- [ ] Error handling 100% coverage (public API)
- [ ] Input validation 100% coverage (external inputs)
- [ ] No hardcoded secrets
- [ ] Architecture is testable (no direct DB/network in business logic)
- [ ] Code coverage ≥80% (all metrics: statements, branches, functions, lines)
- [ ] All tests pass
- [ ] No ESLint errors (`npm run lint`)
- [ ] TypeScript type-check passes (`npm run check`)
- [ ] Build succeeds (`npm run build`)
- [ ] Security scan passes (`npm audit` - no high/critical)
- [ ] Make quality passes (`make quality`)

### Security Review
- [ ] Input validation on all external inputs
- [ ] Parameterized queries only (no string concatenation)
- [ ] No `eval()` or `new Function()`
- [ ] TLS 1.2+ for all external calls
- [ ] Authentication required for state-changing endpoints
- [ ] No PII in logs
- [ ] Rate limiting implemented (if applicable)
- [ ] CSRF protection (if applicable)

### Testing
- [ ] Unit tests added/updated (coverage delta: +X%)
- [ ] Integration tests (if applicable)
- [ ] Error paths covered
- [ ] Edge cases tested (null, boundary, malformed)
- [ ] Concurrency/race conditions considered (if applicable)

### Performance
- [ ] Benchmarks included (if performance change)
- [ ] O(n) complexity verified (no O(n²))
- [ ] No N+1 queries
- [ ] Memory profiling done (no leaks)

### Documentation
- [ ] JSDoc updated for all public APIs
- [ ] README updated (if user-facing changes)
- [ ] ADR created (if architectural change)
- [ ] Compliance section added (if GDPR/PCI/HIPAA applicable)

### Verification Steps
Test locally with:
```bash
make quality
npm run benchmark  # if performance change
```

## Reviewer Focus Areas

- [ ] Security implications
- [ ] Performance impact
- [ ] Architecture alignment (SOLID, DRY, KISS)
- [ ] Test coverage completeness
- [ ] Observability gaps (logs, metrics, traces)
- [ ] Compliance requirements (GDPR, PCI, etc.)

## Screenshots / Logs

[If UI change or debugging context, include relevant screenshots or log snippets]

## Additional Notes

[Add any additional context, assumptions, or decisions made during implementation]

## Checklist for CI

- [ ] All CI checks passed (lint, typecheck, test, coverage, security)
- [ ] Coverage report uploaded
- [ ] No regressions introduced
- [ ] Commit messages follow Conventional Commits

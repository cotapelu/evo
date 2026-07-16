# Verification Steps

This document provides step-by-step instructions for verifying code quality before committing or pushing changes.

## Quick Verification (Pre-commit)

The pre-commit hook automatically runs all quality checks. To manually verify:

```bash
make quality
```

This runs:
1. `npm run lint` - ESLint with auto-fixes
2. `npm run check` - TypeScript type checking
3. `npm test -- --coverage` - Full test suite with coverage
4. `npm audit --audit-level=moderate` - Security vulnerability scan

**All checks must pass** before committing.

## Detailed Verification (Before PR)

### 1. Local Development Checks

```bash
# Install dependencies
make install

# Run in development mode
make dev
```

### 2. Code Quality

```bash
# Linting (automatically fixes where possible)
make lint

# Type checking (no emit)
make typecheck

# Build production bundle
make build
```

### 3. Test Coverage

```bash
# Run full test suite with coverage
make test

# View coverage report
# Open coverage/index.html in browser
```

**Coverage Requirements** (GOAL.md Section 3.1):
- Statements: ≥80%
- Branches: ≥80%
- Functions: ≥80%
- Lines: ≥80%

### 4. Security Scan

```bash
make security-scan
```

This runs `npm audit` with `--audit-level=moderate`. Fix any high or critical vulnerabilities.

### 5. Performance Benchmarks (if applicable)

If your changes affect performance-critical code paths:

```bash
# Run all benchmarks
npm run benchmark

# Run specific benchmark suite
npm run benchmark:team
npm run benchmark:codebase
npm run benchmark:memory
npm run benchmark:tui

# Get JSON output for comparison
BENCHMARK_JSON=true npm run benchmark > /dev/null 2> benchmark-results.json
```

Compare against baselines in `docs/BENCHMARKS.md`. Any regression >10% requires investigation.

### 6. Mental Testing (GOAL.md Section 5.4)

Before committing, mentally verify:

- [ ] All functions work with valid inputs (happy path)
- [ ] All functions handle invalid inputs (type, range, format errors)
- [ ] All functions handle null/undefined/empty values
- [ ] Boundary values tested (min/max, off-by-one)
- [ ] Malformed data handled gracefully
- [ ] Every if/else/switch branch covered
- [ ] Every throw/catch/error path covered
- [ ] Data flow verified both directions (UI→DB AND DB→UI)
- [ ] No SQL injection vectors
- [ ] No XSS vectors
- [ ] CSRF protection in place (if applicable)
- [ ] O(n) complexity, not O(n²)
- [ ] No memory leaks (allocate + free patterns)
- [ ] No blocking I/O in async context
- [ ] Race conditions considered (shared state)
- [ ] Deadlocks prevented (lock ordering)
- [ ] Atomic operations where needed
- [ ] Logs emitted (structured)
- [ ] Metrics recorded (Prometheus format)
- [ ] Traces propagated (OpenTelemetry)

If ANY item is missing, **write more code/tests** – do not skip.

## CI/CD Verification

When you push or create a PR, GitHub Actions runs:

1. **Install dependencies** (`npm ci`)
2. **Generate custom models** (`npm run generate-custom-models`)
3. **Build** (`npm run build`)
4. **Lint** (`npm run lint`)
5. **Type check** (`npm run check`)
6. **Security audit** (`npm audit --audit-level=moderate`)
7. **Run tests with coverage** (`npm test -- --coverage`)
8. **Upload coverage** to Codecov
9. **Archive test results** as artifacts

All steps must pass for the CI to be green.

## Quality Gate Self-Score (Max 100)

Before marking your PR ready, self-score using GOAL.md Section 19.1:

| Criterion | Max Points | Earned |
|-----------|------------|--------|
| Functions ≤20 lines | 10 | ___ |
| Complexity ≤10 | 10 | ___ |
| Duplication <5 lines | 10 | ___ |
| Error handling 100% coverage | 20 | ___ |
| Input validation 100% coverage | 20 | ___ |
| No hardcoded secrets | 10 | ___ |
| Testable architecture | 10 | ___ |
| Coverage ≥80% | 10 | ___ |
| **TOTAL** | **100** | **_____** |

**Pass threshold**: ≥90 points

## PR Template Checklist

When opening a PR, fill out the template in `.github/pull_request_template.md`:

- [ ] Self-score included
- [ ] All mandatory checks passed
- [ ] Security review completed
- [ ] Tests added/updated with coverage delta
- [ ] Benchmarks included (if performance change)
- [ ] Compliance documented (if applicable)
- [ ] Documentation updated
- [ ] Verification steps tested locally

## Common Issues & Troubleshooting

### Typecheck Errors
```bash
# Find type errors
npm run check

# Common causes:
# - Missing import
# - Implicit any (add explicit types)
# - Incorrect type assertion
```

### Lint Warnings/Errors
```bash
# Run linter
npm run lint

# Auto-fix
npm run lint -- --fix

# Common fixes:
# - no-explicit-any: Use proper types
# - no-unused-vars: Remove or use _ prefix
# - no-floating-promises: Add await or void
```

### Test Failures
```bash
# Run specific test file
npx vitest run path/to/test.ts

# Run with verbose
npx vitest run --reporter=verbose

# Debug
npx vitest run --inspect
```

### Coverage Below Threshold
```bash
# Check coverage report
npm run test -- --coverage --reporter=html
# Open coverage/index.html

# Identify uncovered lines
# Use Istanbul or VSCode coverage gutter
```

### Security Vulnerabilities
```bash
# Audit dependencies
npm audit

# Fix auto-updatable issues
npm audit fix

# For major updates requiring manual review:
# 1. Review release notes
# 2. Update package.json
# 3. Run tests
# 4. Verify no breaking changes
```

### Performance Regression
```bash
# Establish baseline
BENCHMARK_JSON=true npm run benchmark 2> baseline.json

# Compare after changes
BENCHMARK_JSON=true npm run benchmark 2> new.json

# Look for >10% degradation in mean/p95/p99
```

## Rollback Plan

If you discover issues after pushing:

1. **Immediate rollback** (if CI fails or tests broken):
   ```bash
   git revert HEAD
   git push origin <branch>
   ```

2. **Feature flag** (if available):
   ```bash
   # Disable feature via config
   # Commit config change
   ```

3. **Create hotfix branch**:
   ```bash
   git checkout -b hotfix/issue-description
   # Fix issue
   git commit -m "fix: brief description"
   git push origin hotfix/issue-description
   # Open PR immediately
   ```

## Escalation

- **Blocked >48 hours**: Notify tech lead via Slack/email
- **Critical security issue**: Notify security-team immediately (P0)
- **CI/Infrastructure failure**: Notify SRE team
- **Quality gate ambiguity**: Discuss with tech lead to clarify standards

## References

- GOAL.md – Full quality framework and standards
- AGENTS.md – Autonomous agent protocols
- docs/BENCHMARKS.md – Performance benchmarking guide
- docs/AGENT_PROFILE.md – Known weaknesses and strengths
- docs/EVOLUTION.md – Roadmap and improvement trajectory

---

**Last Updated**: 2026-07-16

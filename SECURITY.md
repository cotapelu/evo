# Security Policy

## Supported Versions

Only the latest version (`main` branch) is actively maintained with security updates.

## Reporting a Vulnerability

**Please do not report vulnerabilities publicly on GitHub issues.** Instead, contact the maintainer privately viaemail at: security@example.com

We will respond within 48 hours with an acknowledgment and provide a timeline for fix coordination.

### Vulnerability Disclosure Process

1. **Submit**: Send detailed report via email with:
   - Description of the vulnerability
   - Steps to reproduce (test case or PoC)
   - Potential impact assessment
   - Suggested fix (if any)

2. **Response**: We will acknowledge within 48 hours and assign a severity:
   - **Critical**: Remote code execution, data exfiltration, auth bypass
   - **High**: Privilege escalation, DoS, data corruption
   - **Medium**: Information disclosure, XSS, CSRF
   - **Low**: Configuration issues, missing best practices

3. **Coordination**: We'll work with you on a fix timeline and credit you in the release notes (unless you request anonymity).

4. **Resolution**: Fix will be merged and released with CVE ID if applicable. Public disclosure will be coordinated to give users time to update.

## Security Hardening Features

Evo Agent includes several security measures:

- **Timeout guards**: All git operations have configurable timeout (default: 10s)
- **Retry with backoff**: Automatic retries with exponential backoff (up to 2 attempts)
- **Input validation**: CONFIG objects validated with type and range checks
- **Sanitization**: Commit messages stripped of control characters, length-limited (72 chars)
- **Injection prevention**: All `exec()` calls use array arguments (no shell interpolation)
- **Exclusion system**: Critical directories (dist/, node_modules/, __tests__) are protected from self-modification
- **Backup & rollback**: Full backup before any modifications; automatic rollback on test failure
- **Test gate**: No changes committed unless all tests pass

## Security Best Practices for Users

1. **Run in container**: Consider running Evo Agent in a sandboxed environment (Docker, VM) for untrusted environments.
2. **Review PRs**: The CI creates PRs for autonomous changes - review them before merging.
3. **Limit permissions**: Run with least-privilege filesystem permissions.
4. **Git safety**: Keep `.git` directory accessible; do not run in a repo with sensitive data.
5. **API keys**: Store API keys in environment variables or secure credential storage (pi's AuthStorage).
6. **Update dependencies**: Regularly run `npm update` to get security patches from dependencies.
7. **Audit extensions**: Review any third-party extensions before installing (they run with full system access).

## Known Threat Model

**Threats Considered:**
- Malicious commit messages could attempt command injection (mitigated: sanitization)
- Infinite loops in git operations (mitigated: timeout)
- Resource exhaustion (mitigated: test gate, backup limits)
- Accidental modification of generated files (mitigated: exclude system)
- Data corruption from partial writes (mitigated: backup/restore)

**Threats Out of Scope:**
- Compromised dependencies (use npm audit)
- OS-level attacks (use OS security features)
- Supply chain attacks (use signed commits, dependency verification)
- Insider threats (trusted environment assumption)

## Security Architecture

### Git Operations
All git commands go through `execGit()` wrapper:
- Timeout enforced via `Promise.race()`
- Exponential backoff on retries
- Errors logged with context
- Never uses shell mode (`exec('git', [...])` not `exec('git ...')`)

### Configuration
CONFIG objects validated at load time:
- Type checking (boolean, number, string)
- Range enforcement (e.g., timeout 1-60s)
- Default fallbacks for missing values
- Clear error messages for invalid configs

### Self-Modification Safety
- Backup created before any file writes
- Test suite runs after modifications
- On failure: backup restored automatically
- Excludes prevent scanning of dist/, node_modules/, __tests__/

## Incident Response

If a security incident is discovered:

1. **Contain**: Stop any running Evo Agent processes
2. **Assess**: Determine scope (what systems/data affected)
3. **Notify**: Contact security@example.com immediately
4. **Remediate**: Apply emergency patches as directed
5. **Recover**: Restore from clean backups if needed
6. **Post-mortem**: Document root cause and preventive measures

## Security Updates

Security updates will be released as:
- **Patch versions** (e.g., `0.0.1 -> 0.0.2`) for fixes
- **Advisories** on GitHub Security Advisories
- **Changelog** entries marked [SECURITY]

Subscribe to release notifications to stay informed.

## Third-Party Components

Evo Agent depends on:
- `@earendil-works/pi-coding-agent` (primary framework)
- Standard Node.js built-in modules (`fs`, `path`, `child_process`)

Review dependency security with `npm audit` regularly.

## Future Security Enhancements

Planned improvements:
- Cryptographic signatures for evolution commits
- Sandboxed execution of untrusted patterns
- Audit logging for all modification operations
- Anomaly detection for unusual git activity
- Integration with dependency scanning (Dependabot)

These are not implemented in v0.0.1 but may be added in future versions.

## Contact

Security issues: security@example.com
General questions: Please use GitHub Issues (for non-security matters)

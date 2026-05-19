# Contributing to Evo Agent

Thank you for your interest in contributing! This document provides guidelines for development.

---

## Quick Start

### Prerequisites

- Node.js 20+ (tested with 20.6+)
- Git
- npm or yarn

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd evo

# Install dependencies
npm install

# Build the project
npm run build

# Run tests to verify everything works
npm test

# Run in development mode (ts-node)
npm run dev
```

---

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/my-feature
# or
git checkout -b fix/issue-123
```

Branch naming:
- `feature/` for new features
- `fix/` for bug fixes
- `docs/` for documentation changes
- `refactor/` for code improvements
- `chore/` for build/CI updates

### 2. Make Changes

Follow the AUTO-CONTINUE.md guidelines:
- Correctness first
- Write/update tests
- Keep changes minimal and focused
- Update documentation as needed

### 3. Verify Your Changes

```bash
# Type checking
npm run build

# Run tests (all must pass)
npm test

# Optional: run benchmarks to ensure no performance regression
npm run bench

# Optional: test evolution dry-run
npm run evolve:dry
```

### 4. Commit

Use clear, descriptive commit messages:

```
feat: add new pattern for trailing commas

Add pattern that detects missing trailing commas in multi-line
object/array literals. Includes auto-fix capability.

- Add comma-check pattern in patterns.ts
- Add tests for pattern
- Update documentation

Closes #123
```

Conventional Commits format recommended:
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `style:` formatting (no code change)
- `refactor:` code restructuring
- `test:` add/update tests
- `chore:` build/metadata changes

### 5. Push and Pull Request

```bash
git push origin feature/my-feature
```

Then open a PR on GitHub with:
- Clear description of changes
- Link to any related issues
- Screenshots/output if applicable
- Note any breaking changes

### 6. CI/CD

The PR will automatically:
- Build the project
- Run tests
- Check code style (if configured)
- Benchmark (if added)

Wait for all checks to pass. Address any review comments.

---

## Project Structure

```
.
├── src/
│   ├── main.ts                    # Entry point (bootstrap)
│   ├── extensions/                # Built-in extensions
│   │   └── git-integration.ts     # Git integration
│   ├── evolution/                 # Self-evolution system
│   │   ├── patterns.ts            # Pattern definitions
│   │   ├── evolver.ts             # Patching engine
│   │   └── cli.ts                 # CLI interface
│   ├── bench/                     # Benchmark suite
│   │   └── benchmark.ts           # Performance tests
│   └── __tests__/                 # Jest test suites
├── .github/workflows/             # CI/CD workflows
├── docs/                          # Documentation
├── node_modules/                  # Dependencies (gitignored)
├── dist/                          # Build output (gitignored)
├── bench-results/                 # Benchmark results (gitignored)
├── package.json                   # Dependencies & scripts
├── tsconfig.json                  # TypeScript config
├── jest.config.ts                 # Test config
├── AUTO-CONTINUE.md               # Development guidelines
└── README.md                      # Project overview
```

---

## Key Components

### Extensions (`src/extensions/`)

Extensions add functionality via event handlers:

```typescript
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function myExtension(pi: ExtensionAPI) {
  // Register command
  pi.registerCommand('mycmd', {
    description: 'My custom command',
    handler: async (args, ctx) => {
      ctx.ui.notify(`You typed: ${args}`, 'info');
    }
  });

  // Listen to events
  pi.on('session_start', async (event, ctx) => {
    console.log('Session started:', event);
  });
}
```

### Patterns (`src/evolution/patterns.ts`)

Define coding patterns to detect and optionally fix:

```typescript
{
  id: 'my-pattern',
  name: 'Descriptive name',
  description: 'What to fix and why',
  severity: 'info' | 'warning' | 'error',
  check: (code: string, filePath: string) => PatternMatch | null,
  fix: (code: string, filePath: string) => string
}
```

### Tests (`src/__tests__/`)

Use Jest with ESM support:

```typescript
import { jest } from '@jest/globals';

describe('My Feature', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should do something', async () => {
    const result = await someOperation();
    expect(result).toBe(expected);
  });
});
```

---

## Testing Guidelines

- All new features must have tests
- Aim for >80% coverage on changed code
- Tests should be deterministic and isolated
- Use `jest.resetModules()` in `beforeEach` for module isolation
- Mock external dependencies (fs, network) where appropriate
- Include edge cases and error paths

Run tests:

```bash
npm test              # Once
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

---

## Performance Considerations

- Keep startup time <200ms
- Pattern scanning should be O(n) with low constant factors
- Avoid synchronous I/O in hot paths
- Use streaming for large file operations
- Cache expensive computations (e.g., `isGitRepo()`)

Benchmark before/after changes:

```bash
npm run bench
```

Compare output in `bench-results/`. Ensure no significant regressions (>10% slowdown).

---

## Security Requirements

- **Never** use `exec('command', ['arg1', 'arg2'])` with string concatenation
- **Always** use array arguments for `exec()` calls
- **Validate** all user/extension configuration
- **Sanitize** any data that goes into git commands or file writes
- **Timeout** all external operations (git, LLM API)
- **Backup** before modifying files (evolution engine does this)

See SECURITY.md for full security policy.

---

## Code Style

- TypeScript strict mode
- 2-space indentation
- Single quotes for strings
- Semicolons required
- Meaningful variable/function names
- Functions should be small and focused (<50 lines)
- Comments for non-obvious logic
- JSDoc for public APIs

---

## Adding Dependencies

Avoid adding new dependencies. Prefer built-in Node modules or existing dependencies.

If you must add a dependency:

1. Justify why it's needed
2. Check license compatibility (MIT, Apache 2.0, BSD)
3. Keep dependencies minimal (don't bundle utility libraries)
4. Add to `dependencies` (dev dependencies only for build tools)
5. Update `package-lock.json` with `npm install` (no `--save-dev` for runtime deps)

---

## Evolution System

When modifying the evolution system:

1. **Patterns**: Keep transformations simple; complex fixes require AST
2. **Excludes**: Always exclude dist/, node_modules/, __tests__/
3. **Backup**: Never skip backup; test rollback logic
4. **Tests**: Add tests for new patterns and edge cases
5. **Documentation**: Update docs/EVOLUTION.md with new patterns

---

## CI/CD

The project uses GitHub Actions:

- `evolve.yml`: Runs daily at 2 AM UTC, manual trigger available
- Applies safe auto-fixes, opens PR
- Requires all tests to pass

Do not disable or modify CI without maintainer approval.

---

## Release Process

Releases are automatic via semantic-release or manual git tags:

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create git tag: `git tag v0.0.1`
4. Push: `git push origin v0.0.1`
5. GitHub Actions builds and publishes

---

## Questions?

- **General**: Open an GitHub Issue
- **Security**: security@example.com (private)
- **Docs**: Improve by editing markdown files

---

## Code of Conduct

Be respectful, constructive, and collaborative. Harassment or toxic behavior will not be tolerated.

---

## License

MIT - see LICENSE file for details.

By contributing, you agree that your contributions will be licensed under the MIT License.

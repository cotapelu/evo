# Evo Agent - Self-Evolving System

## Overview

Evo Agent is a terminal-based AI coding agent built on top of `@earendil-works/pi-coding-agent`. It features:

- **Observability-first design**: Startup timing, diagnostics, structured error handling
- **Git Integration**: Auto-commit on exit, stash checkpoints for safe/fork restoration
- **Self-Evolution Mechanism**: Learns from reference examples and applies improvements automatically

## Architecture

### Main Bootstrap (`src/main.ts`)

- Enhanced with metrics collection and diagnostics display
- Graceful error handling with actionable messages
- Direct extension registration via `extensionFactories`
- Built-in extension loading from `src/extensions/`

### Extensions (`src/extensions/`)

#### Git Integration (`git-integration.ts`)

Features:
- Auto-commit on session exit with AI-generated commit messages
- Git stash checkpoints before each turn for safe `/fork` restoration
- Configurable via `CONFIG` object

Events handled:
- `session_start`: Initialize git state, record integration status
- `tool_result`: Track current entry ID for checkpoint association
- `turn_start`: Create git stash with checkpoint reference
- `session_before_fork`: Offer to restore code state from checkpoint
- `session_shutdown`: Auto-commit if there are uncommitted changes
- `agent_end`: Cleanup checkpoint references

### Evolution System (`src/evolution/`)

#### Pattern Detection (`patterns.ts`)

Defines coding patterns to detect and optionally fix:
- `use-async-await`: Prefer async/await over .then() chains
- `proper-error-handling`: Ensure async functions have try/catch
- `avoid-global-object`: Detect usage of `globalThis` (prefer local scope)

Pattern detection is simple string-based and may produce false positives. The `avoid-global-object` pattern can flag the patterns module itself due to regex definitions; this is expected and can be ignored or the pattern refined.

Scans directories and produces a report of matches.

#### Evolver (`evolver.ts`)

Safe self-modification engine:
1. Scan codebase for pattern violations
2. Generate proposed changes
3. Create backup of affected files
4. Apply changes atomically
5. Run test suite to verify
6. On success: commit changes with detailed message
7. On failure: restore backup automatically

CLI: `npm run evolve` (dry-run: `npm run evolve:dry`)

## Development

### Prerequisites

- Node.js 20+
- Git (for git integration features)

### Setup

```bash
npm install
npm run build
```

### Testing

```bash
npm test                    # Run tests once
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage
```

### Running the Agent

```bash
npm start                   # Production (from dist/)
npm run dev                 # Development (ts-node)
```

### Evolution

```bash
npm run evolve:dry          # Scan and report (dry-run)
npm run evolve             # Apply fixes & commit if tests pass
```

### Continuous Integration

A GitHub Actions workflow is included (`.github/workflows/evolve.yml`):

- **Schedule**: Runs daily at 2 AM UTC
- **Manual**: Can be triggered via `workflow_dispatch`
- **Action**: Applies safe auto-fixes and opens a PR with changes
- **Safety**: Only commits if all tests pass

This enables fully autonomous evolution of the codebase.


## Observability

The agent emits structured logs:
- Startup timing (total, services, session creation)
- Diagnostics from extensions, skills, prompts, themes
- Errors with stack traces

## Git Integration

When working in a Git repository:
- Each agent turn creates a stash checkpoint (configurable)
- `/fork` offers to restore code to checkpoint state
- On exit, uncommitted changes are auto-committed with meaningful messages

Configure behavior by editing `CONFIG` in `src/extensions/git-integration.ts`.

## Self-Evolution Workflow

1. Place reference examples in `llm-context/coding-agent/examples/`
2. Run `npm run evolve:dry` to identify improvement opportunities
3. Review the generated report
4. Run `npm run evolve` to apply safe changes
5. System creates backup, applies patches, runs tests, and commits if successful
6. If tests fail, changes are automatically rolled back

## Safety Guarantees

- **No placeholders**: All code is complete and functional
- **Test verification**: Changes that break tests are reverted
- **Backup and restore**: Full backup created before any modifications
- **Atomic commits**: Each evolution run produces a single commit or none at all
- **Deterministic patterns**: Same input always produces same output

## Design Principles

Following the AUTO-CONTINUE.md guidelines:
- Correctness first
- Simplicity over abstraction
- Readability over cleverness
- Deterministic behavior
- Full test coverage
- No hidden side-effects

## Project Structure

```
.
├── src/
│   ├── main.ts                    # Entry point with observability
│   ├── extensions/                # Built-in extensions
│   │   └── git-integration.ts     # Git features
│   ├── evolution/                 # Self-improvement system
│   │   ├── patterns.ts            # Pattern definitions
│   │   ├── evolver.ts             # Safe patching engine
│   │   └── cli.ts                 # CLI interface
│   └── __tests__/                 # Test files
├── llm-context/                   # Reference examples (read-only)
├── dist/                          # Compiled output
└── package.json
```

## Future Improvements

- AST-based code transformations (more reliable fixes)
- More sophisticated pattern learning from examples
- Configuration via settings manager
- Evolution of test cases themselves
- Performance benchmarking and optimization

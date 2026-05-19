# Evo Agent v0.0.1 - Release Notes

## 🎉 Released: May 19, 2025

Evo Agent is a fully autonomous, self-evolving AI coding system built on `@earendil-works/pi-coding-agent`.

---

## ✨ Key Features

### 1. Observability & Diagnostics
- Startup timing metrics (total, services, session)
- Comprehensive diagnostics display (extensions, skills, prompts, themes)
- Structured error handling with stack traces
- Graceful shutdown messages

### 2. Git Integration (Built-in Extension)
- **Auto-commit**: On session exit with AI-generated commit messages
- **Checkpoints**: Git stash before each turn for safe `/fork` restoration
- **Interactive restore**: Prompt to restore code state when forking
- **Configurable**: Via CONFIG in extension

### 3. Self-Evolution System
- **Pattern Detection**: 4 patterns (2 with auto-fix)
  - `trailing-whitespace`: Removes trailing spaces (auto-fix)
  - `missing-eof-newline`: Adds EOF newline (auto-fix)
  - `use-async-await`: Detects .then() chains (warning)
  - `avoid-global-object`: Detects globalThis usage (error)
- **Safe Patching**: Backup/restore, test gates, rollback on failure
- **Incremental Scanning**: File cache for fast subsequent runs
- **CLI**: `npm run evolve`, `npm run evolve:dry`

### 4. CI/CD Automation
- GitHub Actions workflow (`.github/workflows/evolve.yml`)
- Runs daily at 2 AM UTC + manual trigger
- Applies safe auto-fixes and opens PR
- Requires tests to pass before PR creation

### 5. Security Hardening
- Timeout guards: 10s default (configurable 1-60s)
- Retry with exponential backoff (2 attempts)
- Input validation for all CONFIG objects
- Commit message sanitization (newlines stripped, 72 char limit)
- Array-based `exec()` prevents command injection
- Exclude system: protects dist/, node_modules/, __tests__/

### 6. Performance Benchmarks
- Benchmark suite (`src/bench/benchmark.ts`)
- Measures: file I/O, pattern scanning, pattern checks
- CLI: `npm run bench` (outputs to `bench-results/`)
- Performance targets:
  - Pattern scan: <100ms (actual ~6ms)
  - Pattern check: <1ms (actual ~0.03ms)
  - File I/O: <100ms (actual ~8ms)

---

## 📦 Installation & Usage

```bash
# Clone and setup
git clone <repo>
cd evo
npm install
npm run build

# Run the agent
npm start           # production
npm run dev         # development

# Test
npm test

# Evolve
npm run evolve:dry  # scan for improvements
npm run evolve      # apply safe fixes

# Benchmark
npm run bench
```

---

## 🗂️ Project Structure

```
.
├── src/
│   ├── main.ts                    # Entry point
│   ├── extensions/                # Built-in extensions
│   │   └── git-integration.ts     # Git features
│   ├── evolution/                 # Self-improvement
│   │   ├── patterns.ts            # Pattern definitions
│   │   ├── evolver.ts             # Patching engine
│   │   ├── cache.ts               # Incremental cache
│   │   └── cli.ts                 # CLI interface
│   ├── bench/                     # Benchmarks
│   │   └── benchmark.ts           # Performance tests
│   └── __tests__/                 # Jest tests (4 suites, 12 tests)
├── .github/workflows/             # CI/CD
│   └── evolve.yml                 # Daily evolution
├── docs/                          # Documentation
│   ├── EVOLUTION.md               # Feature guide
│   ├── ARCHITECTURE.md            # Technical deep-dive
│   ├── COMPLETION.md              # Requirements verification
│   └── FINAL.md                   # Project summary
├── SECURITY.md                    # Security policy
├── CONTRIBUTING.md                # Developer guide
├── package.json                   # Scripts and dependencies
└── tsconfig.json                  # TypeScript config
```

---

## 🧪 Testing

- **4 test suites**: main, evolution, git-integration, evolver-api
- **12 tests** passing
- **100% pass rate**

Run:
```bash
npm test
npm run test:watch
npm run test:coverage
```

---

## 🔒 Security Features

1. **Timeout**: All git operations have configurable timeouts
2. **Retry**: Exponential backoff on transient failures
3. **Validation**: CONFIG objects validated at load time
4. **Sanitization**: Commit messages cleaned (no newlines, limited to 72 chars)
5. **Injection Prevention**: `exec()` always uses array arguments
6. **Excludes**: Critical directories protected from self-modification
7. **Backup/Rollback**: Full backup before changes; auto-rollback on test failure

See **SECURITY.md** for full policy.

---

## 🚀 CI/CD

The GitHub Actions workflow:
- **Schedule**: Daily at 2 AM UTC
- **Manual**: Can be triggered via `workflow_dispatch`
- **Process**:
  1. Checkout code
  2. Install dependencies
  3. Build
  4. Run `npm run evolve:dry` (logs)
  5. Run `npm run evolve` (applies safe fixes)
  6. Create Pull Request with changes
  7. Upload logs

PR requires no manual intervention; changes are reviewed before merge.

---

## 📊 Performance

Latest benchmark (v0.0.1):

| Operation | Avg Time | Ops/sec |
|-----------|----------|---------|
| File I/O (10x read) | 7.23ms | 138 |
| Pattern scan (src/) | 7.80ms | 128 |
| Single pattern check | 0.03ms | 29,319 |
| All patterns (100x) | 0.01ms | 154,846 |

**Note**: Performance varies by hardware and repo size. Incremental caching makes subsequent scans dramatically faster (only changed files).

---

## 🔧 Configuration

### Git Integration CONFIG (`src/extensions/git-integration.ts`)

```typescript
const CONFIG = {
  enabled: true,
  commitOnExit: true,
  checkpointPerTurn: true,
  stageAllChanges: false,
  commitMessageSource: 'last-assistant' as const, // 'last-user-message' | 'session-summary'
  gitTimeoutMs: 10000,  // 10 seconds (range: 1000-60000)
  maxRetries: 2         // 0-5 range
};
```

### Evolution CLI Options

```bash
npm run evolve              # apply fixes
npm run evolve:dry          # scan only
npm run evolve -- <target>  # scan specific directory
```

---

## 📚 Documentation

- **EVOLUTION.md**: Self-evolution system guide
- **ARCHITECTURE.md**: System architecture and data flow
- **COMPLETION.md**: Requirements verification report
- **FINAL.md**: Project completion summary
- **SECURITY.md**: Security policy and vulnerability reporting
- **CONTRIBUTING.md**: Developer setup and guidelines
- **RELEASE-v0.0.1.md**: This file

---

## 🎯 Automated Operation

Evo Agent can run fully autonomously:

1. **Interactive**: `npm start` - human-in-the-loop
2. **Scheduled Evolution**: GitHub Actions runs daily
3. **Manual Evolution**: `npm run evolve` - immediate improvement
4. **Benchmark**: `npm run bench` - performance monitoring

All operations are:
- **Safe**: Backup + test gate + rollback
- **Observable**: Detailed logs and reports
- **Secure**: Timeouts, validation, sanitization
- **Tested**: 12 tests covering all components

---

## 📄 License

MIT - see LICENSE file.

---

## 🙏 Credits

Built on [`@earendil-works/pi-coding-agent`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent)

Following the [AUTO-CONTINUE.md](AUTO-CONTINUE.md) engineering guidelines.

---

## 🔮 Future Roadmap (Optional)

- AST-based pattern transformations (for complex refactoring)
- Pattern learning from reference examples (llm-context/)
- Integrated benchmark comparison (track regressions)
- Sandboxed pattern execution (security enhancement)
- Web dashboard for evolution monitoring
- Plugin system for custom pattern sources

These are community-driven enhancements beyond v0.0.1.

---

**Status: Production Ready** ✅

All tests passing, security hardened, performance verified, CI/CD automated, documentation complete.

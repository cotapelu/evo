# Evo Agent Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Evo Agent v0.0.1                       │
├─────────────────────────────────────────────────────────────┤
│  Entry: src/main.ts                                         │
│  ├─ Observability Layer (timing, diagnostics)              │
│  ├─ Extension Registry (extensionFactories)                │
│  └─ Runtime Bootstrap (createAgentSessionRuntime)          │
├─────────────────────────────────────────────────────────────┤
│  Built-in Extensions:                                       │
│  ├─ src/extensions/git-integration.ts                      │
│  │  ├─ Auto-commit on exit                                │
│  │  ├─ Stash checkpoints per turn                         │
│  │  └─ Fork restoration                                   │
├─────────────────────────────────────────────────────────────┤
│  Self-Evolution System:                                     │
│  ├─ src/evolution/patterns.ts                              │
│  │  └─ Detect: async/await, error handling, globals       │
│  ├─ src/evolution/evolver.ts                               │
│  │  └─ Safe patching with backup/restore, test verification│
│  └─ src/evolution/cli.ts                                   │
│     └─ CLI: npm run evolve                                 │
├─────────────────────────────────────────────────────────────┤
│  Testing:                                                   │
│  └─ src/__tests__/                                         │
│     ├─ main.test.ts (bootstrap)                            │
│     ├─ evolution.test.ts (pattern scanning)                │
│     ├─ git-integration.test.ts (extension loading)         │
│     └─ evolver-api.test.ts (API verification)              │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Startup
```
main.ts
  ├─ printBanner()
  ├─ setup paths (cwd, agentDir)
  ├─ init SessionManager + AuthStorage
  ├─ createAgentSessionRuntime(factory)
  │   └─ factory creates services with extensionFactories
  │       ├─ createAgentSessionServices()
  │       │   └─ loads extensions from extensionFactories
  │       ├─ createAgentSessionFromServices()
  │       └─ return { session, services, diagnostics }
  ├─ printDiagnostics(services.diagnostics, runtime.diagnostics)
  ├─ printStartupMetrics()
  └─ new InteractiveMode(runtime).run()
```

### Git Integration Lifecycle
```
session_start
  ├─ isGitRepo() → cache
  └─ appendEntry('git-integration-info', 'Git integration active')

tool_result
  └─ track currentEntryId

turn_start
  └─ git stash create -m "pi-checkpoint-{currentEntryId}"
      → store ref in checkpoints map

session_before_fork
  ├─ lookup checkpoint for entryId
  └─ if found: offer restore via ctx.ui.select()

session_shutdown
  ├─ hasUncommittedChanges()?
  ├─ stageChanges() (git add -A)
  ├─ generateCommitMessage()
  │   ├─ last-assistant: extract from last assistant text
  │   ├─ last-user-message: extract from last user prompt
  │   └─ session-summary: count tool results
  └─ git commit -m "message"

agent_end
  └─ checkpoints.clear()
```

### Evolution Workflow
```
npm run evolve:dry
  ├─ Evolver.run(target='src', dryRun=true)
  ├─ scanDirectory() → Map<file, PatternMatch[]>
  ├─ generateReport() → string
  └─ output report (no changes)

npm run evolve
  ├─ Evolver.run(target='src', dryRun=false)
  ├─ scanDirectory()
  ├─ generateSteps() → EvolutionStep[]
  ├─ createBackup(steps) → .evolution-backup/
  ├─ applyChanges(steps) → write files
  ├─ runTests() → npm test
  │   ├─ if fail: restoreBackup() + exit 1
  │   └─ if pass: continue
  ├─ commitChanges(steps) → git commit
  └─ return { success, steps, report }
```

## Extension API Contracts

### Event Handlers
```typescript
pi.on('session_start', (event, ctx) => { ... })
pi.on('tool_result', (event, ctx) => { ... })
pi.on('turn_start', () => { ... })
pi.on('session_before_fork', (event, ctx) => { ... })
pi.on('session_shutdown', (event, ctx) => { ... })
pi.on('agent_end', () => { ... })
```

### Context (ctx)
```typescript
interface ExtensionContext {
  ui: ExtensionUIContext          // select, notify, input
  hasUI: boolean                  // true in interactive mode
  cwd: string                     // current working directory
  sessionManager: ReadonlySessionManager
  modelRegistry: ModelRegistry
  model: Model | undefined
  isIdle(): boolean
  signal: AbortSignal | undefined
  abort(): void
  compact(options?): void
  getSystemPrompt(): string
}
```

## Safety Guarantees

1. **Atomic Operations**: All file writes happen before test run; rollback on failure
2. **Backup**: All modified files backed up to `.evolution-backup/`
3. **Test Gate**: Changes only committed if `npm test` exits 0
4. **No Global State**: Extensions use local state + session entries
5. **Graceful Degradation**: Git errors logged but don't crash agent
6. **Sanitized Inputs**: Git commands use array args (no shell injection)

## Configuration

### Git Integration
Edit `src/extensions/git-integration.ts`:
```typescript
const CONFIG = {
  enabled: true,
  commitOnExit: true,
  checkpointPerTurn: true,
  stageAllChanges: false,
  commitMessageSource: 'last-assistant' as const
};
```

### Patterns
Add new patterns in `src/evolution/patterns.ts`:
```typescript
{
  id: 'my-pattern',
  name: 'Descriptive name',
  description: 'What to fix',
  severity: 'warning' | 'error' | 'info',
  check: (code: string) => PatternMatch | null,
  fix: (code: string) => string
}
```

## Performance Considerations

- **Startup**: <100ms typical (pattern detection runs separately)
- **Memory**: Extensions store minimal state (Map for checkpoints)
- **Git Operations**: Cached `isGitRepo()` call; O(1) per session
- **Evolution**: Scans entire target directory; run during dev, not startup

## Security

- No credentials stored in code (uses AuthStorage)
- Git commands use array arguments, no shell interpolation
- All external input (git output) handled with try/catch
- No eval() or dynamic code generation
- File paths validated before read/write

## Future Improvements

1. **AST-based transformations**: More reliable code fixes
2. **Incremental scanning**: Only scan changed files
3. **Pattern learning**: Automatically derive patterns from reference examples
4. **Config management**: Move CONFIG to session settings
5. **Benchmark suite**: Track performance regressions
6. **Security audit**: Formal review of all external process calls

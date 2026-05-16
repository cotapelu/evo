# 🏗️ ARCHITECTURE ANALYSIS: Self-Evolving System v2

## 📌 OVERVIEW

Tài liệu này phân tích **bản chất** của self-evolution: LLM provider nhận gì? nhận thế nào? cải tiến ra sao?

---

## 🔄 **FULL DATA FLOW DIAGRAM**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EVOLUTION CYCLE (v2)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  EvolutionEngine.cycle()                                                   │
│         │                                                                  │
│         ├─> CodeAnalyzer.analyze()                                         │
│         │      ├─ glob patterns                                           │
│         │      ├─ assign priority (high/med/low)                          │
│         │      ├─ read files (full for high, partial for others)          │
│         │      └─ return AnalysisContext { files, totalTokens, summary } │
│         │                                                                  │
│         ├─> LLM #1: analyzeCodebase()                                     │
│         │      Prompt:                                                     │
│         │      =================================                      │
│         │      Analyze this codebase and suggest improvements.           │
│         │                                                                  │
│         │      CODEBASE SUMMARY:                                          │
│         │      Total files: X, Total tokens: Y                            │
│         │      Files:                                                      │
│         │        [HIGH] evo.ts (full)...                                  │
│         │        [MEDIUM] src/manage.ts (partial)...                     │
│         │                                                                  │
│         │      Return JSON with `files` array specifying which files     │
│         │      need modification.                                         │
│         │      =================================                      │
│         │      Response: { improvements: [{ priority, description,       │
│         │                   category, files: ['evo.ts', 'src/x.ts'], ...}]│
│         │                                                                  │
│         ├─> planImprovements()                                             │
│         │      ├─ convert to ImprovementCandidate[]                       │
│         │      ├─ compute complexity/risk/impact                         │
│         │      └─ sort/select using StrategyRegistry                     │
│         │                                                                  │
│         ├─> selectImprovement()                                           │
│         │      └─ Strategy.select(candidates, context)                   │
│         │           (priority, genetic, risk-averse, etc.)               │
│         │                                                                  │
│         ├─> generateDiff(selected)                                        │
│         │      ├─ getFilesContent(improvement.files)                     │
│         │      │   (only read those specific files)                      │
│         │      │                                                            │
│         │      └─ LLM #2:                                                │
│         │          Prompt:                                                │
│         │          ==================================                     │
│         │          Generate unified diff for:                            │
│         │          IMPROVEMENT: {description}                            │
│         │          FILES: file1.ts, file2.ts                             │
│         │                                                                 │
│         │          CURRENT CODE:                                         │
│         │          === file1.ts ===                                      │
│         │          [full content of file1]                               │
│         │          === file2.ts ===                                      │
│         │          [full content of file2]                               │
│         │                                                                 │
│         │          Output ONLY raw unified diff.                         │
│         │          ==================================                     │
│         │                                                                  │
│         │          Response: raw diff string                             │
│         │                                                                  │
│         ├─> applyWithValidation(diff)                                    │
│         │      │                                                          │
│         │      ├─ MultiFileDiffApplier.applyDiff(diff)                  │
│         │      │   1. parseDiffFiles() → ['evo.ts', 'src/x.ts']         │
│         │      │   2. Security validation (no '..')                      │
│         │      │   3. createBackups(files) → { file: backupPath }       │
│         │      │   4. parsePatch(diff)                                   │
│         │      │   5. FOR EACH file: applyPatch(original, filePatch)    │
│         │      │   6. writeFile(file, patched)                          │
│         │      │   7. result.affectedFiles, result.errors                │
│         │      │                                                          │
│         │      ├─ ValidationRunner.validate()                           │
│         │      │   ├─ Syntax check (balanced braces)                    │
│         │      │   ├─ TypeScript: `npx tsc --noEmit`                    │
│         │      │   ├─ Unit tests: `npx jest` (if exists)                │
│         │      │   └─ Smoke test (dynamic import + parser)              │
│         │      │                                                          │
│         │      └─ IF validation.success:                                │
│         │           ├─ diffApplier.recordHistory()                      │
│         │           ├─ diffApplier.saveHistory()                        │
│         │           ├─ update metrics                                   │
│         │           └─ level++ (success!)                               │
│         │         ELSE:                                                  │
│         │           ├─ Restore all files from backups                   │
│         │           └─ return failure                                   │
│         │                                                                  │
│         └─> Update metrics, check circuit breaker                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 **LLM PROVIDER INPUT/OUTPUT SPEC**

### **LLM Call #1: Code Analysis**

**Endpoint:** `runtime.session.prompt()`  
**Model:** Default từ settings (e.g., `anthropic/claude-sonnet-4-20250514`)  
**Input Token Count:** ~50k-100k (dependent on codebase size)  

**System Prompt:** (internal, tiếng Anh, default của provider)  
**User Message:**
```
Analyze this self-evolving agent codebase and suggest concrete improvements.

CODEBASE SUMMARY:
Total files analyzed: 15
Total tokens: 87500
Files included:
  [HIGH] evo.ts (12500 tokens)
  [HIGH] src/evolution-engine.ts (11200 tokens)
  [HIGH] src/system.ts (9800 tokens)
  [MEDIUM] src/agent-manager.ts (8500 tokens)
  [LOW] src/diff-utils.ts (4200 tokens - summary)
  ...

FILES:
=== evo.ts ===
[FULL CONTENT of evo.ts - could be 5-15k tokens]

=== src/evolution-engine.ts ===
[FULL CONTENT]

=== src/system.ts ===
[FULL CONTENT]

=== src/agent-manager.ts ===
[PARTIAL if truncated, with "... (truncated) ..." marker]

Return JSON with improvements array:
{
  "improvements": [
    {
      "priority": "high",
      "description": "Add comprehensive validation after applying diffs",
      "category": "testing",
      "files": ["src/validation-runner.ts", "evo.ts"],
      "reason": "Currently only syntax check is done, need runtime tests"
    },
    ...
  ]
}
```

**Expected Output:**
```json
{
  "improvements": [
    {
      "priority": "high",
      "description": "...",
      "category": "...",
      "files": ["evo.ts", "src/...", ...],
      "reason": "..."
    }
  ]
}
```

**Post-processing:**
- Extract JSON using regex `/\{[\s\S]*\}/`
- Parse, convert to `ImprovementCandidate[]` with computed fields

---

### **LLM Call #2: Diff Generation**

**Endpoint:** `runtime.session.prompt()`  
**Model:** Same as above  
**Input Token Count:** ~20k-60k (only affected files)  

**User Message:**
```
Generate a unified diff patch for this improvement.

IMPROVEMENT:
{selected.description from LLM #1}

FILES TO MODIFY: evo.ts, src/validation-runner.ts

CURRENT CODE:
=== evo.ts ===
[Full content of evo.ts]

=== src/validation-runner.ts ===
[Full content of validation-runner.ts]

REQUIREMENTS:
1. Output ONLY raw unified diff (no markdown, no explanations)
2. Format: --- a/evo.ts, +++ b/evo.ts, @@ headers
3. If modifying multiple files, generate patches for each file in sequence
4. Create new files if needed:
   --- /dev/null
   +++ b/newfile.ts
   @@ -0,0 +1,10 @@
   +content...
5. Ensure patch applies cleanly to EXACT lines shown
6. Do NOT modify unrelated parts of code

EXAMPLE OUTPUT:
--- a/evo.ts
+++ b/evo.ts
@@ -1,5 +1,6 @@
 line1
+added line
 line2

--- a/src/validation-runner.ts
+++ b/src/validation-runner.ts
@@ -10,3 +10,4 @@
  existing code
+new line

Respond with raw diff only:
```

**Expected Output:**
```
--- a/evo.ts
+++ b/evo.ts
@@ -1,5 +1,6 @@
 ...

--- a/src/validation-runner.ts
+++ b/src/validation-runner.ts
@@ -10,3 +10,4 @@
 ...
```

---

## 🔧 **DIFF APPLICATION MECHANICS**

### **Parsing**
```typescript
const patch = parsePatch(diff); // returns array of { file, hunks: [...] }
```

### **Apply per file**
```typescript
for (const file of affectedFiles) {
  const filePatch = patch.filter(p => p.file === file);
  const original = readFile(file);
  const patched = applyPatch(original, filePatch); // diff library
  writeFile(file, patched);
}
```

### **Security**
- Reject any `file` path containing `..` or `\0`
- Validate against `allowedFiles` set (empty = all allowed)
- Only allow modifications within `cwd`

### **Multi-file backup**
```
~/.pi/agent/.evo/backups/
├── history.json
├── 1234567890-evo.ts.bak
├── 1234567890-src_validation-runner.ts.bak
└── 1234567890-src_evolution-engine.ts.bak
```

---

## ✅ **VALIDATION PIPELINE**

After apply, run **4 checks**:

| Check | Tool | Purpose |
|-------|------|---------|
| **Syntax** | Custom (brace count) | Quick catch for parse errors |
| **Type Check** | `npx tsc --noEmit` | Ensure TypeScript compiles |
| **Unit Tests** | `npx jest` | Verify existing tests pass |
| **Smoke Test** | TypeScript parser API | Dynamic import succeeds |

If **ANY** fails → **auto-rollback** to backup.

---

## 🧬 **GENETIC STRATEGY (incomplete)**

```typescript
interface Individual {
  genes: {
    priorityWeight: number;    // 0-2, how much to favor high priority
    categoryPreference: {...}; // 0-1 per category (bugfix, perf, etc.)
    complexityPreference: -1..1; // -1=prefer simple, +1=prefer complex
    riskTolerance: 0-2;        // risk appetite
  };
  fitness: number; // success rate of this strategy's selections
  history: Array<{ candidate, applied, success }>;
}
```

**Workflow:**
1. Tournament selection chọn best individual
2. Score candidates using individual's genes
3. Pick top candidate
4. After apply, record outcome → update individual fitness
5. Every 5 evaluations → evolve population (crossover, mutation, elitism)

**Missing:** Integration with `recordOutcome` (tbd)

---

## ⚙️ **CONFIGURATION SCHEMA**

In `~/.pi/agent/settings.json`:

```json
{
  "defaultModel": "anthropic/claude-sonnet-4-20250514",
  "evo": {
    "evolutionInterval": 300000,
    "autoApply": true,
    "evolutionStrategy": "genetic",
    "enableGeneticStrategy": true,
    "enablePromptOptimization": false,
    "promptOptimizationInterval": 5,
    "maxBackups": 50,
    "validation": {
      "runTests": true,
      "testPattern": null
    }
  }
}
```

Hot-reload via `/reload-config`.

---

## 📊 **METRICS & MONITORING**

EvolutionEngine tracks:

```typescript
interface EvolutionMetrics {
  totalCycles: number;
  successfulCycles: number;
  failedCycles: number;
  successRate: number;
  avgCycleTimeMs: number;
  lastCycleTimeMs: number;
  avgValidationTimeMs: number; // NEW v2
  improvementsByCategory: Record<string, number>;
  totalRollbacks: number;      // NEW v2
  startTime: Date;
  uptime: number;
}
```

View via `/evolution-metrics` or `evo_metrics` tool.

---

## 🚨 **CIRCUIT BREAKER**

- Threshold: 3 consecutive failures
- Pause: 10 minutes
- Auto-restart attempts: 5 with exponential backoff (5s → 80s)
- After max attempts: manual intervention required

---

## 🛠️ **NEW COMMANDS (v2)**

All existing commands still work. New/improved:

| Command | Description |
|---------|-------------|
| `/evolution` | Start/stop/restart daemon with optional interval |
| `/evolution-history` | Multi-file history with affected files list |
| `/evolution-rollback <level>` | Restore ALL files from that level |
| `/evolution-metrics` | Full metrics including validation time, rollbacks |
| `/reload-config` | Hot-reload settings without restart |

---

## 📦 **KEY FILES (v2)**

| File | Change |
|------|--------|
| `evolution-engine.ts` | Complete rewrite - multi-file, validation, new pipeline |
| `code-analyzer.ts` | **NEW** - Smart file collection & prioritization |
| `multi-file-diff-applier.ts` | **NEW** - Multi-file apply with security & backups |
| `validation-runner.ts` | **NEW** - Comprehensive validation (syntax+type+tests+smoke) |
| `diff-utils.ts` (old) | **DEPRECATED** - No longer used |
| `evolution-strategy.ts` | Added `files: string[]` to `ImprovementCandidate` |
| `EVOLUTION.md` | Updated documentation |

---

## 🔮 **FUTURE WORK**

1. **Full genetic integration**: `recordOutcome` properly called with individual ID
2. **Prompt optimization**: Connect `PromptOptimizer` to cycle
3. **Context window management**: Dynamic token allocation, maybe RAG retrieval
4. **Test generation**: Auto-generate tests for new code before apply
5. **Distributed evolution**: Multiple nodes evaluating different strategies
6. **Better diff repair**: If LLM diff fails, auto-request fix

---

**Last Updated**: 2026-05-16  
**Version**: 2.3.0 (multi-file rewrite complete)

# Benchmarking Guide

**Version:** 1.0.0  
**Purpose:** Performance measurement and regression detection for PiClaw

---

## 📊 Overview

The benchmark suite provides comprehensive performance metrics for critical operations in the piclaw coding agent. It helps detect regressions and ensure the system meets production-grade performance targets.

---

## 🎯 Performance Targets

Based on AUTO-CONTINUE.md requirements:

| Operation | Target | Current (Baseline) |
|-----------|--------|-------------------|
| **UI Response** | < 100ms | Pending baseline |
| **Memory Ops** | < 50ms | Pending baseline |
| **Codebase Analyze** | < 200ms (500 lines) | Pending baseline |
| **Safe Edit** | < 300ms (diff + validate) | Pending baseline |
| **Dependency Tree** | < 500ms (medium project) | Pending baseline |
| **Team Manager Ops** | < 10ms (claim/complete) | Pending baseline |
| **TUI Render** | < 16ms (60fps) | Pending baseline |

---

## 🚀 Usage

### Run All Benchmarks

```bash
npm run benchmark
```

### Run Specific Suite

```bash
npm run benchmark:team
npm run benchmark:codebase
npm run benchmark:memory
npm run benchmark:tui
```

### Filter by Name

```bash
npm run benchmark -- Analyze
npm run benchmark -- "Small"
```

### Get JSON Output

```bash
BENCHMARK_JSON=true npm run benchmark > results.txt 2> results.json
```

---

## 📈 Suites

### 1. Team Performance (`benchmark:team`)

Measures core team management operations:

- **Team Creation**: Initialize new team structures
- **Task Claiming**: Agents claiming tasks from queue
- **Agent Heartbeat**: Periodic agent status updates
- **Concurrent Agents**: Scaling to multiple agents
- **Task Status Tracking**: Update and query task states

**Target:** All operations < 10ms for typical workloads (≤ 1000 tasks, ≤ 100 agents)

### 2. Codebase Plugin (`benchmark:codebase`)

Tests code analysis capabilities with varying file sizes:

- **Analyze**: Symbol and import/export extraction
- **Analyze AST**: Deep AST-based analysis
- **Search**: Text search across codebase
- **Complexity**: Cyclomatic & Halstead metrics
- **Dependency Tree**: Build module dependency graph
- **Safe Edit**: Atomic edit with validation

Tested with:
- **Small**: 150 lines, 10 functions, 3 classes
- **Medium**: 500 lines, 30 functions, 8 classes
- **Large**: 1500 lines, 100 functions, 25 classes

**Targets:**
- Analyze (500 lines): < 200ms
- Complexity: < 150ms
- Dependency Tree (medium project): < 500ms
- Safe Edit: < 300ms

### 3. Memory Tool (`benchmark:memory`)

Benchmarks memory storage and retrieval:

- **Add Single**: Insert individual memories
- **Add Batch**: Bulk insert operations
- **Search**: Full-text search across entries
- **Get by ID**: Point lookups
- **Delete**: Memory removal
- **Mixed Workload**: Realistic mixed operation pattern

Workload sizes:
- 1000 entries stored
- 500 queries/lookups/deletes
- Tags per entry: 2-5

**Target:** All operations < 50ms

### 4. TUI Rendering (`benchmark:tui`)

Measures Text User Interface rendering performance:

- **Text**: Basic text rendering
- **List**: Simple list component (100 items)
- **Table**: Tabular data display (50 rows)
- **Tree**: Nested hierarchical data (depth 3, breadth 5)
- **Styles**: Text with annotations (bold, color, underline)
- **Large Dataset**: Stress test with 1000 items

**Target:** All renders < 16ms (60fps)

---

## 📊 Metrics Reported

For each benchmark:

- **Mean**: Average execution time (ms)
- **Median**: 50th percentile (typical performance)
- **Min / Max**: Range of measured times
- **P95**: 95th percentile (tail latency)
- **P99**: 99th percentile (worst-case latency)
- **StdDev**: Standard deviation (consistency)
- **Ops/sec**: Throughput (operations per second)
- **Total**: Cumulative time

---

## 🔬 Methodology

### Test Conditions

1. **Warm-up**: 5-10 warm-up iterations (not measured) to JIT compile
2. **Iterations**: 20-100 measurement iterations depending on operation speed
3. **Process**: Single Node.js process, no concurrency (unless specified)
4. **Environment**: Development machine specs recorded for baseline comparison
5. **Isolation**: Each benchmark cleans up state; no cross-contamination

### Statistics

- **Percentiles**: Linear interpolation between sorted measurements
- **Standard Deviation**: Sample standard deviation (n-1)
- **Operations/sec**: 1000 / mean (ms per operation)

### Reliability

- Benchmarks are **statistical**, not micro-benchmarks
- Run multiple iterations to account for GC pauses and JIT optimization
- Warm-up allows V8 to optimize hot code paths
- Median is often more meaningful than mean for noisy systems

---

## 📉 Regression Detection

### Setting Baselines

After establishing stable performance:

1. Run full suite: `npm run benchmark > baseline.txt`
2. Save JSON: `BENCHMARK_JSON=true npm run benchmark 2> baseline.json`
3. Commit `docs/BENCHMARKS.md` with baseline numbers
4. Document any known variations in `docs/EVOLUTION.md`

### Monitoring

- Run benchmarks before each release
- Compare key metrics against baseline (mean, p95, p99)
- Investigate regressions > 10% slowdown
- Use `git bisect` to identify regressing commits

### Performance Budgets

Enforce these thresholds in CI:

- No metric may degrade > 20% from baseline
- P99 latency must not exceed 2× median
- New features must include benchmark coverage

---

## 🏗️ Architecture

```
src/benchmarks/
├── index.ts              # Main runner (npm run benchmark)
├── benchmark-harness.ts   # Core timing & statistics engine
├── team-performance.ts   # Team manager benchmarks
├── codebase-performance.ts  # Codebase plugin benchmarks
├── memory-tool.ts        # Memory tool benchmarks
├── tui-rendering.ts      # TUI rendering benchmarks
└── README.md             # This file
```

---

## 🧪 Adding New Benchmarks

1. Create a new `*.ts` file in `src/benchmarks/`
2. Import the shared `harness`: `import { harness } from './benchmark-harness.js'`
3. Implement your benchmark function (async)
4. Call `harness.runBenchmark(name, fn, config?)`
5. Add suite entry in `index.ts`
6. Document in this README

Example:

```typescript
import { harness } from './benchmark-harness.js';

async function myBenchmark(): Promise<number> {
  // ... perform operation ...
  return durationMs; // return if measuring manually
}

// Let harness measure
await harness.runBenchmark('My Feature', () => myBenchmark(), {
  iterations: 50,
  warmup: 5
});
```

---

## 📈 Interpreting Results

### Good Results

- Low standard deviation (< 10% of mean)
- P95 close to median (consistent tail)
- No outliers (> 3σ)
- Ops/sec stable across runs

### Concerning Results

- High stddev (> 25% of mean) → GC pressure, caching issues
- P95 >> median → tail latency problem
- Degrading trend across runs → resource leak or growing dataset
- Ops/sec dropping over time → algorithmic degradation

---

## 🐛 Troubleshooting

### Benchmarks too variable

- Increase iterations (100 → 1000)
- Add more warm-up runs
- Check for GC: add `--max-old-space-size` if needed
- Isolate from other system load

### Benchmarks always slow

- Verify code paths are actually exercised
- Check if using I/O in measurement (should use in-memory for consistency)
- Ensure warm-up is adequate for JIT
- Profile with `node --prof` to find hotspots

### Tests fail in CI

- Use `--threads false` for Vitest if needed
- Increase CI timeout for benchmarks
- Use smaller data sets for CI vs local
- Export `CI=true` for headless mode

---

## 🔖 Versioning

Baseline benchmarks are versioned with releases. Each major version should:

1. Establish new baseline on stable hardware
2. Document hardware specs: CPU, RAM, Node version, OS
3. Include absolute values, not just deltas
4. Pin dependency versions (no floating ranges)

Example baseline entry:

```
📊 Baseline (piclaw v1.0.0)
Platform: Linux 6.8.0-45-generic x64
CPU: Intel i7-12700K (14 cores, 20 threads)
RAM: 32GB DDR4 @ 3200MHz
Node: v20.11.0 (V8 11.7.354.15)
Date: 2026-06-18

Team Operations:
- Team Creation: 2.3ms mean (P95: 3.1ms)
- Task Claiming: 0.8ms mean (P95: 1.2ms)
```

---

## 📚 References

- [Node.js `process.hrtime`](https://nodejs.org/api/process.html#processhrtime)
- [Statistical benchmarking best practices](https://www.brendangregg.com/FlameGraphs/mutexing.html)
- [V8 Optimization](https://v8.dev/docs/optimizing)

---

**Maintainer:** PiClaw Team  
**Last Updated:** 2026-06-18

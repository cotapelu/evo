#!/usr/bin/env node
/**
 * Benchmark Extension – Performance Measurement Suite
 *
 * Provides tool `bench.run` to measure key operation latencies.
 * Benchmarks:
 *   - api.getAllTools()
 *   - resourceLoader.getAgentsFiles() (if available)
 *   - git status (via api.exec)
 *   - sessionManager.getSessionInfo() (if available)
 *
 * Each operation runs 3 times and reports average milliseconds.
 */
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
export declare function registerBenchmarkExtension(api: ExtensionAPI): void;
export default registerBenchmarkExtension;
//# sourceMappingURL=index.d.ts.map
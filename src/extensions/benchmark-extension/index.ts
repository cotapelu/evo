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

import { performance } from 'perf_hooks';
import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';

async function measure<T>(label: string, fn: () => Promise<T> | T, iterations = 3): Promise<{ label: string; avgMs: number }> {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const result = fn();
    if (result instanceof Promise) {
      await result;
    } else {
      // sync, nothing to await
    }
  }
  const end = performance.now();
  const avgMs = (end - start) / iterations;
  return { label, avgMs };
}

function createBenchRunTool(api: ExtensionAPI): ToolDefinition<any, any> {
  return {
    name: 'bench.run',
    label: 'Bench: Run',
    description: 'Run performance benchmarks for core operations',
    parameters: {},
    async execute(toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any) {
      const results: { label: string; avgMs: number }[] = [];

      // 1. getAllTools
      try {
        const toolsResult = await measure('api.getAllTools()', () => api.getAllTools());
        results.push(toolsResult);
      } catch (e) {
        results.push({ label: 'api.getAllTools()', avgMs: NaN });
      }

      // 2. resourceLoader.getAgentsFiles (if available)
      try {
        const rl = ctx.sdkServices?.resourceLoader;
        if (rl) {
          const rlResult = await measure('resourceLoader.getAgentsFiles()', () => rl.getAgentsFiles());
          results.push(rlResult);
        } else {
          results.push({ label: 'resourceLoader (unavailable)', avgMs: NaN });
        }
      } catch (e) {
        results.push({ label: 'resourceLoader.getAgentsFiles()', avgMs: NaN });
      }

      // 3. git status (via api.exec)
      try {
        const gitResult = await measure('git status --porcelain', () =>
          api.exec('git', ['status', '--porcelain'], { cwd: ctx.cwd, signal })
        );
        results.push(gitResult);
      } catch (e) {
        results.push({ label: 'git status', avgMs: NaN });
      }

      // 4. sessionManager.getSessionInfo() if available
      try {
        const sm = ctx.sdkServices?.sessionManager;
        if (sm) {
          const smResult = await measure('sessionManager.getSessionInfo()', () => sm.getSessionInfo());
          results.push(smResult);
        } else {
          results.push({ label: 'sessionManager (unavailable)', avgMs: NaN });
        }
      } catch (e) {
        results.push({ label: 'sessionManager.getSessionInfo()', avgMs: NaN });
      }

      // Format output table
      const header = `${'Operation'.padEnd(40)} | ${'Avg (ms)'}`;
      const separator = '─'.repeat(40) + '-+-' + '─'.repeat(10);
      const lines = results.map(r => {
        const label = r.label.padEnd(40);
        const avg = isNaN(r.avgMs) ? 'FAIL' : r.avgMs.toFixed(2);
        return `${label} | ${avg}`;
      });

      const output = [header, separator, ...lines].join('\n');
      return {
        content: [{ type: 'text', text: output }],
        details: { results },
        isError: false,
      };
    },
  };
}

export function registerBenchmarkExtension(api: ExtensionAPI): void {
  api.registerTool(createBenchRunTool(api));

  api.sendMessage?.({
    customType: 'benchmark',
    content: '📈 Benchmark extension loaded – run bench.run to measure performance',
    display: false,
  });
}

export default registerBenchmarkExtension;
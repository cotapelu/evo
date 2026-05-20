#!/usr/bin/env node

/**
 * Team Execution Benchmark
 *
 * Measures performance of team_run with different configurations.
 * Outputs JSON stats for analysis.
 */

import { createAgentSessionRuntime, SessionManager, AuthStorage, createAgentSessionServices } from '@earendil-works/pi-coding-agent';
import extensionsAggregator from '../dist/src/extensions/index.js';
import { getAgentDir } from '@earendil-works/pi-coding-agent';

interface BenchmarkResult {
  config: {
    teamSize: number;
    taskCount: number;
    taskType: 'echo' | 'sleep' | 'compute';
  };
  metrics: {
    totalTimeMs: number;
    avgTimePerTaskMs: number;
    totalPrompts: number;
    maxTurnsUsed: number;
  };
}

// Simple tasks for benchmarking
function generateTasks(count: number, type: 'echo' | 'sleep' | 'compute'): string[] {
  const tasks: string[] = [];
  for (let i = 0; i < count; i++) {
    switch (type) {
      case 'echo':
        tasks.push(`echo "Task ${i} completed"`);
        break;
      case 'sleep':
        tasks.push(`sleep 0.1`); // small sleep to simulate work
        break;
      case 'compute':
        tasks.push(`node -e "let s=0; for(let i=0;i<100000;i++) s+=i; console.log(s)"`);
        break;
    }
  }
  return tasks;
}

async function runBenchmark(teamSize: number, taskCount: number, taskType: 'echo' | 'sleep' | 'compute'): Promise<BenchmarkResult> {
  const cwd = process.cwd();
  const agentDir = getAgentDir();
  const sessionManager = SessionManager.create(cwd);
  const authStorage = AuthStorage.create();

  // Create runtime with team tool
  const runtime = await createAgentSessionRuntime(
    async ({ cwd: innerCwd, agentDir: innerAgentDir, sessionManager: innerSessionManager }) => {
      const services = await createAgentSessionServices({
        cwd: innerCwd,
        agentDir: innerAgentDir,
        authStorage,
        resourceLoaderOptions: { extensionFactories: [extensionsAggregator] }
      });

      const { createAgentSessionFromServices } = await import('@earendil-works/pi-coding-agent');
      const result = await createAgentSessionFromServices({
        services,
        sessionManager: innerSessionManager
      });

      return { ...result, services, diagnostics: services.diagnostics };
    },
    { cwd: sessionManager.getCwd(), agentDir, sessionManager }
  );

  const tool = runtime.session.getTool('team_run');
  if (!tool) {
    throw new Error('team_run tool not found');
  }

  const tasks = generateTasks(taskCount, taskType);
  const startTime = Date.now();

  // Execute team_run (blocking)
  const response: any = await tool.execute({
    tasks,
    teamSize
    // teamRoles: default
  }, { runtime });

  const totalTimeMs = Date.now() - startTime;

  // Extract metrics from response details if available
  const details = response.details || {};
  const totalPrompts = details.totalPrompts || 0; // Would need to instrument team_ops tool to count

  // For now, estimate: each task completion = 3 prompts avg (claim + work + complete)
  const estimatedPrompts = taskCount * 3 + (teamSize * 2); // bootstrap + continuations

  return {
    config: { teamSize, taskCount, taskType },
    metrics: {
      totalTimeMs,
      avgTimePerTaskMs: totalTimeMs / taskCount,
      totalPrompts: estimatedPrompts,
      maxTurnsUsed: Math.ceil(taskCount / teamSize) + 2
    }
  };
}

async function main() {
  console.log('🔥 Team Execution Benchmark\n');
  const results: BenchmarkResult[] = [];

  const configurations = [
    { teamSize: 1, taskCount: 1, taskType: 'echo' as const },
    { teamSize: 1, taskCount: 5, taskType: 'echo' as const },
    { teamSize: 2, taskCount: 5, taskType: 'echo' as const },
    { teamSize: 2, taskCount: 10, taskType: 'echo' as const },
    { teamSize: 4, taskCount: 10, taskType: 'echo' as const },
    { teamSize: 4, taskCount: 20, taskType: 'echo' as const },
  ];

  for (const cfg of configurations) {
    console.log(`Running: teamSize=${cfg.teamSize}, tasks=${cfg.taskCount}, type=${cfg.taskType}`);
    try {
      const result = await runBenchmark(cfg.teamSize, cfg.taskCount, cfg.taskType);
      results.push(result);
      console.log(`  ✅ ${result.metrics.totalTimeMs}ms total, ${result.metrics.avgTimePerTaskMs.toFixed(1)}ms/task`);
    } catch (err: any) {
      console.error(`  ❌ Error: ${err.message}`);
    }
  }

  console.log('\n📊 Summary:');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});

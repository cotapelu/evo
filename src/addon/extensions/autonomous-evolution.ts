#!/usr/bin/env node
/**
 * Autonomous Evolution Extension
 *
 * Continuously monitors codebase health, identifies violations,
 * and prompts the LLM agent to fix them automatically.
 *
 * Runs on a configurable interval (default 2 hours).
 * Logs metrics to docs/AGENT_METRICS.md.
 *
 * Integration: Add to factory.ts
 */

import type { ExtensionAPI, ExecResult } from "@earendil-works/pi-coding-agent";
import { promises as fs } from 'fs';
import { join } from 'path';

interface CycleMetrics {
  timestamp: string;
  type: 'Violation Fix' | 'Proactive Improvement' | 'No Issues';
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  durationMs: number;
  status: 'Success' | 'Failed';
  testDelta?: number;
  totalTests?: number;
  coverageDelta?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  performance?: {
    p50?: number;
    p99?: number;
    memory?: number;
  };
  security?: string;
  notes: string;
}

class AutonomousEngine {
  private api: ExtensionAPI;
  private intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private awaitingResponse = false;
  private responseResolver: (() => void) | null = null;
  private baselineCommit: string | null = null;

  // Baseline metrics
  private baselineTestCount?: number;
  private baselineCoverage?: { statements: number; branches: number; functions: number; lines: number };

  constructor(api: ExtensionAPI, intervalMs?: number) {
    this.api = api;
    this.intervalMs = intervalMs ?? (2 * 60 * 60 * 1000); // 2 hours
  }

  start(): void {
    if (this.timer) {
      console.log('[Autonomous] Engine already started');
      return;
    }
    // For development/testing, use a shorter interval if env var set
    const devInterval = process.env.AUTONOMOUS_INTERVAL_MS;
    const firstDelay = devInterval ? parseInt(devInterval, 10) : 0; // start immediately by default
    console.log(`[Autonomous] Engine starting, first cycle in ${firstDelay}ms`);
    this.timer = setTimeout(() => this.runCycle().catch(console.error), firstDelay);
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext(): void {
    this.stop();
    this.timer = setTimeout(() => this.runCycle().catch(console.error), this.intervalMs);
    console.log(`[Autonomous] Next cycle scheduled in ${this.intervalMs}ms`);
  }

  private async runCycle(): Promise<void> {
    if (this.isRunning) {
      console.log('[Autonomous] Cycle already in progress, skipping');
      return;
    }
    this.isRunning = true;
    const startTime = Date.now();
    console.log('[Autonomous] Cycle started');

    try {
      // Run diagnostics (baseline)
      const diagnostics = await this.runDiagnostics();

      // Determine if we have any violations
      const hasViolations =
        diagnostics.lint.code !== 0 ||
        diagnostics.typecheck.code !== 0 ||
        diagnostics.test.code !== 0;

      if (!hasViolations) {
        console.log('[Autonomous] No violations found in diagnostics');
        const duration = Date.now() - startTime;
        await this.logMetrics({
          timestamp: new Date().toISOString(),
          type: 'No Issues',
          durationMs: duration,
          status: 'Success',
          notes: 'All quality gates passed',
        });
        this.scheduleNext();
        return;
      }

      // Violations found → trigger agent fix
      console.log('[Autonomous] Violations detected, prompting agent');
      this.baselineCommit = await this.getCurrentCommit();

      // Wait for agent response using event-based promise
      const prompt = this.buildPrompt(diagnostics);
      this.awaitingResponse = true;
      this.sendUserMessageWithAwait(prompt);

      // After agent completes, verify improvements
      const verification = await this.verifyChanges();
      const duration = Date.now() - startTime;

      if (verification.success) {
        await this.logMetrics({
          timestamp: new Date().toISOString(),
          type: 'Violation Fix',
          priority: this.getPriority(diagnostics),
          durationMs: duration,
          status: 'Success',
          testDelta: verification.testDelta,
          totalTests: verification.totalTests,
          coverageDelta: verification.coverageDelta,
          notes: verification.notes,
        });
        const committed = await this.ensureCommitted();
        if (!committed) {
          console.log('[Autonomous] Changes detected but no new commit; may have been committed already');
        }
      } else {
        // Rollback to baseline
        if (this.baselineCommit) {
          await this.rollback();
        }
        await this.logMetrics({
          timestamp: new Date().toISOString(),
          type: 'Violation Fix',
          priority: this.getPriority(diagnostics),
          durationMs: duration,
          status: 'Failed',
          notes: verification.notes,
        });
      }
    } catch (err: any) {
      console.error('[Autonomous] Cycle error:', err);
    } finally {
      this.isRunning = false;
      this.baselineCommit = null;
      this.awaitingResponse = false;
      this.responseResolver = null;
      this.scheduleNext();
    }
  }

  private async runDiagnostics(): Promise<{
    lint: ExecResult;
    typecheck: ExecResult;
    test: ExecResult;
    testReporterJson?: any;
  }> {
    const execSafe = async (cmd: string, args: string[]): Promise<ExecResult> => {
      try {
        return await this.api.exec(cmd, args);
      } catch (err: any) {
        return {
          code: -1,
          stdout: '',
          stderr: err?.message ?? String(err),
          killed: false,
        };
      }
    };

    const lint = await execSafe('npm', ['run', 'lint']);
    const typecheck = await execSafe('npm', ['run', 'typecheck']);
    const test = await execSafe('npm', ['test', '--', '--coverage', '--reporter=json']);

    let testReporterJson: any = null;
    if (test.stdout) {
      try {
        testReporterJson = JSON.parse(test.stdout);
      } catch (e) {
        console.warn('[Autonomous] Failed to parse test JSON output:', e);
      }
    }

    return { lint, typecheck, test, testReporterJson };
  }

  private async getCurrentCommit(): Promise<string> {
    const result = await this.api.exec('git', ['rev-parse', 'HEAD']);
    return result.stdout.trim();
  }

  private buildPrompt(diagnostics: any): string {
    const truncate = (s: string, max = 4000) => (s.length > max ? s.slice(0, max) + '\n... (truncated)' : s);

    const parts: string[] = [
      'Autonomous Evolution Cycle - Diagnostics Report:',
      '',
      `## Lint (exit code ${diagnostics.lint.code})`,
      truncate(diagnostics.lint.stdout || diagnostics.lint.stderr || 'No output'),
      '',
      `## Typecheck (exit code ${diagnostics.typecheck.code})`,
      truncate(diagnostics.typecheck.stdout || diagnostics.typecheck.stderr || 'No output'),
      '',
      `## Tests (exit code ${diagnostics.test.code})`,
      truncate(diagnostics.test.stdout || diagnostics.test.stderr || 'No output'),
      '',
      'Please analyze these issues and implement fixes according to the GOAL.md workflow.',
      'Follow the systematic process:',
      '- Read entire codebase sections related to errors',
      '- Identify root causes',
      '- Write tests first (to reproduce or increase coverage)',
      '- Implement fixes with minimal changes, preserving existing functionality',
      '- Ensure all tests pass and coverage improves or at least does not regress',
      '- Run lint and typecheck to ensure no new issues',
      '- When done, commit changes with a clear conventional commit message.',
      '- The autonomous engine will verify improvements after you complete.',
      '',
      'Important: Do not delete code to fix issues. Use systematic debugging. Avoid over-engineering.',
    ];
    return parts.join('\n');
  }

  private sendUserMessageWithAwait(content: string): void {
    // Set up response resolver
    this.awaitingResponse = true;
    this.responseResolver = () => {
      // resolver body is empty; just a signal
    };
    this.api.sendUserMessage(content, { deliverAs: 'steer' });
  }

  // Called by the agent_end event handler (registered in extension)
  public handleAgentEnd(): void {
    if (this.awaitingResponse && this.responseResolver) {
      this.responseResolver();
      this.responseResolver = null;
      this.awaitingResponse = false;
    }
  }

  private async verifyChanges(): Promise<{
    success: boolean;
    testDelta?: number;
    totalTests?: number;
    coverageDelta?: CycleMetrics['coverageDelta'];
    notes: string;
  }> {
    // Re-run lint and typecheck first (quick)
    const lint = await this.api.exec('npm', ['run', 'lint']).catch(() => ({ code: -1, stdout: '', stderr: '', killed: false }));
    const typecheck = await this.api.exec('npm', ['run', 'typecheck']).catch(() => ({ code: -1, stdout: '', stderr: '', killed: false }));

    if (lint.code !== 0 || typecheck.code !== 0) {
      return {
        success: false,
        notes: `Verification failed: lint exit ${lint.code}, typecheck exit ${typecheck.code}`,
      };
    }

    // Run tests with coverage again
    const test = await this.api.exec('npm', ['test', '--', '--coverage', '--reporter=json']).catch(() => ({ code: -1, stdout: '', killed: false }));
    if (test.code !== 0) {
      return {
        success: false,
        notes: `Verification failed: tests exit code ${test.code}`,
      };
    }

    // Parse new test count and coverage
    let newTestCount = 0;
    try {
      const testReport = JSON.parse(test.stdout);
      newTestCount = testReport.tests?.length ?? 0;
    } catch (e) {
      console.warn('[Autonomous] Failed to parse verification test JSON:', e);
    }

    const newCoverage = await this.readCoverageSummary();
    if (!newCoverage) {
      return {
        success: false,
        notes: 'Verification failed: could not read coverage summary',
      };
    }

    // Compare to baseline
    const baselineTestCount = this.baselineTestCount;
    const baselineCoverage = this.baselineCoverage;

    const testDelta = baselineTestCount !== undefined ? newTestCount - baselineTestCount : undefined;
    const coverageDelta = baselineCoverage
      ? {
          statements: newCoverage.statements - baselineCoverage.statements,
          branches: newCoverage.branches - baselineCoverage.branches,
          functions: newCoverage.functions - baselineCoverage.functions,
          lines: newCoverage.lines - baselineCoverage.lines,
        }
      : undefined;

    // All good
    return {
      success: true,
      testDelta,
      totalTests: newTestCount,
      coverageDelta,
      notes: 'All checks passed',
    };
  }

  private async readCoverageSummary(): Promise<{
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  } | null> {
    try {
      const coveragePath = join(process.cwd(), 'coverage', 'coverage-summary.json');
      const data = await fs.readFile(coveragePath, 'utf8');
      const json = JSON.parse(data);
      const total = json.total;
      const getPct = (field: any) => (typeof field === 'object' && field !== null ? (field.pct ?? 0) : 0);
      return {
        statements: getPct(total.statements),
        branches: getPct(total.branches),
        functions: getPct(total.functions),
        lines: getPct(total.lines),
      };
    } catch (e) {
      console.warn('[Autonomous] Could not read coverage summary:', e);
      return null;
    }
  }

  private getPriority(diagnostics: any): 'HIGH' | 'MEDIUM' | 'LOW' {
    // Simple heuristic: if tests failing → HIGH, else MEDIUM
    if (diagnostics.test.code !== 0) return 'HIGH';
    if (diagnostics.lint.code !== 0 || diagnostics.typecheck.code !== 0) return 'MEDIUM';
    return 'LOW';
  }

  private async ensureCommitted(): Promise<boolean> {
    if (!this.baselineCommit) return false;
    const currentCommit = await this.getCurrentCommit();
    if (currentCommit !== this.baselineCommit) {
      // Already committed
      return true;
    }
    // Check for uncommitted changes
    const status = await this.api.exec('git', ['status', '--porcelain']);
    if (!status.stdout.trim()) {
      return false; // no changes
    }
    // Commit with a generic message
    const msg = `chore: autonomous improvements - ${new Date().toISOString()}`;
    await this.api.exec('git', ['add', '-A']);
    await this.api.exec('git', ['commit', '-m', msg]);
    return true;
  }

  private async rollback(): Promise<void> {
    if (!this.baselineCommit) return;
    try {
      await this.api.exec('git', ['reset', '--hard', this.baselineCommit]);
      console.log('[Autonomous] Rolled back to baseline commit', this.baselineCommit);
    } catch (err) {
      console.error('[Autonomous] Rollback failed:', err);
    }
  }

  private async logMetrics(metrics: CycleMetrics): Promise<void> {
    const metricsPath = join(process.cwd(), 'docs', 'AGENT_METRICS.md');
    let content: string;
    try {
      content = await fs.readFile(metricsPath, 'utf8');
    } catch (e) {
      content = '# Agent Metrics\n\n';
    }

    // Determine cycle number
    const cycleMatches = content.match(/## \[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\] Cycle (\d+)/g);
    const cycleNum = cycleMatches ? cycleMatches.length + 1 : 1;

    const taskName = metrics.type === 'No Issues' ? 'No issues' : `Auto-fix ${metrics.priority ?? ''}`.trim();

    const durationMin = (metrics.durationMs / 1000 / 60).toFixed(1);

    let entry = `## [${metrics.timestamp}] Cycle ${cycleNum} - Task: ${taskName}\n`;
    entry += `- **Type**: ${metrics.type}\n`;
    if (metrics.priority) entry += `- **Priority**: ${metrics.priority}\n`;
    entry += `- **Duration**: ${durationMin} min\n`;
    entry += `- **Status**: ${metrics.status === 'Success' ? '✅ Success' : '❌ Failed'}\n`;
    if (metrics.testDelta !== undefined && metrics.totalTests !== undefined) {
      entry += `- **Test Delta**: +${metrics.testDelta} tests (total ${metrics.totalTests})\n`;
    }
    if (metrics.coverageDelta) {
      entry += `- **Coverage Delta**:\n`;
      entry += `  - Statements: +${metrics.coverageDelta.statements.toFixed(2)}%\n`;
      entry += `  - Branches: +${metrics.coverageDelta.branches.toFixed(2)}%\n`;
      entry += `  - Functions: +${metrics.coverageDelta.functions.toFixed(2)}%\n`;
      entry += `  - Lines: +${metrics.coverageDelta.lines.toFixed(2)}%\n`;
    }
    if (metrics.security) entry += `- **Security**: ${metrics.security}\n`;
    entry += `- **Notes**: ${metrics.notes}\n\n`;

    content += entry;
    await fs.writeFile(metricsPath, content, 'utf8');
    console.log('[Autonomous] Metrics logged');
  }
}

// Extension entry point
export default function autonomousEvolutionExtension(api: ExtensionAPI): void {
  const engine = new AutonomousEngine(api);

  // Register agent_end handler to unblock the waiting cycle
  api.on('agent_end', () => {
    engine.handleAgentEnd();
  });

  // Start on session_start, stop on session_shutdown
  api.on('session_start', async () => {
    console.log('[Autonomous] Session start detected, launching engine');
    engine.start();
  });

  api.on('session_shutdown', () => {
    console.log('[Autonomous] Session shutdown, stopping engine');
    engine.stop();
  });
}

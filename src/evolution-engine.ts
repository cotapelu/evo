import type { AgentSessionRuntime } from '@earendil-works/pi-coding-agent';
import { Logger } from './logger.js';
import { extractNewFile } from './diff-parser.js';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { DiffApplier } from './diff-utils.js';
import { GeneticEvolutionStrategy, type ImprovementCandidate } from './evolution-strategy.js';
import { StrategyRegistry, type EvolutionStrategy, type StrategyContext } from './evolution-strategies.js';
import { PromptOptimizer } from './prompt-optimizer.js';
import type { AgentConfig } from './agents/base.js';
import { AgentManager } from './agent-manager.js';
import { MessageBus } from './messaging.js';
import { Sandbox } from './sandbox.js';

export interface EvolutionConfig {
  agentDir: string;
  model: string;
  thinkingLevel: string;
  evolutionInterval: number;
  enableExtensions: boolean;
  autoApply?: boolean;
  enableGeneticStrategy?: boolean;
  maxBackups?: number;
  evolutionStrategy?: 'priority' | 'genetic' | 'risk-averse' | 'impact-first' | 'thompson-sampling' | 'context-aware' | 'ensemble';
  enablePromptOptimization?: boolean;
  promptOptimizationInterval?: number; // Run every N cycles
  filesToEvolve?: string[]; // List of files/globs to include in self-analysis (default: evo.ts)
}

export interface EvolutionMetrics {
  totalCycles: number;
  successfulCycles: number;
  failedCycles: number;
  successRate: number;
  avgCycleTimeMs: number;
  lastCycleTimeMs: number;
  improvementsByCategory: Record<string, number>;
  startTime: Date;
  uptime: number;
}

export class EvolutionEngine {
  private runtime: AgentSessionRuntime;
  private config: EvolutionConfig;
  private logger: Logger;
  private agentDir: string;
  private level: number = 0;
  private autoInterval: NodeJS.Timeout | null = null;
  private agentManager: AgentManager;
  private messageBus: MessageBus;
  private diffApplier: DiffApplier;
  private historyLoaded = false;
  private geneticStrategy?: GeneticEvolutionStrategy;
  private sandbox?: Sandbox;
  private maxBackups: number;
  private strategyRegistry?: StrategyRegistry;
  private selectedStrategyName: string = 'genetic';
  private promptOptimizer?: PromptOptimizer;
  private enablePromptOptimization: boolean = false;
  private metricsHistory: Array<{
    timestamp: string;
    totalCycles: number;
    successRate: number;
    avgCycleTimeMs: number;
    improvementsByCategory: Record<string, number>;
  }> = [];
  private metricsHistoryPath: string;
  private metrics: EvolutionMetrics = {
    totalCycles: 0,
    successfulCycles: 0,
    failedCycles: 0,
    successRate: 0,
    avgCycleTimeMs: 0,
    lastCycleTimeMs: 0,
    improvementsByCategory: {},
    startTime: new Date(),
    uptime: 0,
  };
  private totalCycleTimeMs = 0;
  private cycleCountSinceOptimization = 0;
  private isRunning = false;
  private consecutiveFailures = 0;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 3;
  private readonly CIRCUIT_BREAKER_DURATION_MS = 10 * 60 * 1000; // 10 minutes
  private circuitBreakerPausedUntil = 0;
  private restartAttempts = 0;
  private readonly MAX_RESTART_ATTEMPTS = 5;
  private readonly RESTART_BACKOFF_BASE_MS = 5000; // 5s
  private restartTimer?: NodeJS.Timeout;
  private metricsWriteCounter = 0;
  private readonly METRICS_WRITE_THROTTLE = 5; // Write to disk every N cycles

  constructor(
    runtime: AgentSessionRuntime,
    config: EvolutionConfig,
    logger: Logger,
    agentManager: AgentManager,
    messageBus: MessageBus,
    sandbox?: Sandbox
  ) {
    this.runtime = runtime;
    this.config = config;
    this.agentDir = config.agentDir;
    this.logger = logger;
    this.agentManager = agentManager;
    this.messageBus = messageBus;
    this.sandbox = sandbox;
    this.maxBackups = config.maxBackups || 50;
    this.diffApplier = new DiffApplier(logger, undefined, join(this.agentDir, '.evo', 'backups'), this.agentDir, this.maxBackups);
    // Prompt optimization
    this.enablePromptOptimization = config.enablePromptOptimization || false;
    if (this.enablePromptOptimization) {
      this.promptOptimizer = new PromptOptimizer(this.logger, this.metrics);
      this.logger.info('🧠 Prompt optimization enabled');
    }
    // Metrics history path — use agentDir (pi convention), not cwd
    this.metricsHistoryPath = join(this.agentDir, '.evo', 'metrics_history.json');
    // Initialize strategy registry
    this.strategyRegistry = new StrategyRegistry();
    this.selectedStrategyName = config.evolutionStrategy || 'genetic';
    // Initialize specific strategies if needed
    if (config.enableGeneticStrategy || this.selectedStrategyName === 'genetic') {
      this.geneticStrategy = new GeneticEvolutionStrategy(logger, 10);
      this.logger.info('🧬 Genetic evolution strategy enabled');
    }
    if (sandbox) {
      this.logger.info('🔒 Sandbox mode active in EvolutionEngine');
    }
  }

  private async ensureHistoryLoaded(): Promise<void> {
    if (!this.historyLoaded) {
      await this.diffApplier.loadHistory();
      await this.loadMetricsHistory();
      this.historyLoaded = true;
    }
  }

  private async loadMetricsHistory(): Promise<void> {
    try {
      const data = await readFile(this.metricsHistoryPath, 'utf-8');
      this.metricsHistory = JSON.parse(data);
    } catch (e) {
      this.metricsHistory = [];
    }
  }

  private async saveMetricsHistory(): Promise<void> {
    try {
      const { mkdir, writeFile } = await import('fs/promises');
      const historyDir = join(this.agentDir, '.evo');
      await mkdir(historyDir, { recursive: true });
      await writeFile(this.metricsHistoryPath, JSON.stringify(this.metricsHistory, null, 2));
    } catch (e) {
      this.logger.warn('Failed to save metrics history:', e);
    }
  }

  async cycle(): Promise<boolean> {
    if (this.isRunning) {
      this.logger.warn('⚠️ Evolution cycle already running, skipping...');
      return false;
    }

    // Circuit breaker check
    if (Date.now() < this.circuitBreakerPausedUntil) {
      const remaining = Math.round((this.circuitBreakerPausedUntil - Date.now()) / 1000);
      this.logger.warn(`⚠️ Circuit breaker active — evolution paused for another ${remaining}s`);
      return false;
    }

    this.isRunning = true;
    await this.ensureHistoryLoaded();
    const startTime = Date.now();
    this.metrics.totalCycles++;
    this.logger.info(`🔁 Evolution cycle #${this.level} starting...`);
    await this.messageBus?.publish('evolution.cycle', 'evolution-engine', `Cycle #${this.level} started`);

    let success = false;
    try {
      const code = await this.readSelf();
      const analysis = await this.analyze(code);
      const plan = await this.plan(analysis);

      if (plan.improvements && plan.improvements.length > 0) {
        const candidates = plan.improvements as ImprovementCandidate[];
        let selectedImprovement: ImprovementCandidate;
        let individualId: string | undefined;

        // Choose strategy
        const strategyName = this.selectedStrategyName;
        const useGenetic = strategyName === 'genetic' && this.geneticStrategy && candidates.length > 1;

        if (useGenetic) {
          const best = this.geneticStrategy!.getBestIndividual();
          if (best) {
            const selected = this.geneticStrategy!.selectCandidate(candidates);
            if (selected) {
              selectedImprovement = selected;
              individualId = best.id;
              this.logger.debug(`🧬 Genetic strategy selected (fitness: ${best.fitness.toFixed(2)})`);
            } else {
              selectedImprovement = candidates[0];
            }
          } else {
            selectedImprovement = candidates[0];
          }
        } else {
          // Use standard EvolutionStrategy from registry
          const strategy = this.strategyRegistry?.get(strategyName);
          if (strategy) {
            const context: StrategyContext = {
              totalCycles: this.metrics.totalCycles,
              successRate: this.metrics.successRate,
              recentFailures: this.metrics.failedCycles,
              currentLevel: this.level,
              categoryStats: this.metrics.improvementsByCategory,
              timeOfDay: this.getTimeOfDay(),
            };
            const result = strategy.select(candidates, context);
            selectedImprovement = result.selected;
            this.logger.debug(`🎯 Strategy '${strategyName}' selected: ${result.reasoning}`);
          } else {
            // Fallback to first
            selectedImprovement = candidates[0];
          }
        }

        this.logger.info(`🔨 Selected improvement: ${selectedImprovement.description}`);

        // Generate diff
        const diff = await this.generateDiff(selectedImprovement);
        if (!diff.includes('--- a/') || !diff.includes('+++ b/') || !diff.includes('@@')) {
          this.logger.warn('❌ Invalid diff format');
          success = false;
        } else {
          // Auto-apply if configured
          if (this.config.autoApply) {
            const applySuccess = await this.applyWithSafety(diff, selectedImprovement, individualId);
            // Record outcome to genetic strategy
            if (this.geneticStrategy && individualId) {
              this.geneticStrategy.recordOutcome(individualId, selectedImprovement, applySuccess);
            }
            success = applySuccess;
            if (applySuccess) {
              this.level++;
              await this.messageBus?.publish('evolution.applied', 'evolution-engine', `Level ${this.level}: ${selectedImprovement.description}`);
            }
          } else {
            this.logger.info('✅ Diff generated (manual apply required)');
            this.logger.debug(`Diff preview:\n${diff.substring(0, 500)}...`);
            this.level++;
            success = true;
          }
        }
      } else {
        this.logger.info('✅ No improvements identified');
        success = false;
      }
    } catch (error: any) {
      this.logger.error(`❌ Evolution cycle #${this.level} failed: ${error.message}`);
      success = false;
      // Note: failure metrics and circuit breaker handled in finally block
    } finally {
      const duration = Date.now() - startTime;
      this.metrics.lastCycleTimeMs = duration;
      this.metrics.avgCycleTimeMs = ((this.metrics.avgCycleTimeMs * (this.metrics.totalCycles - 1)) + duration) / this.metrics.totalCycles;
      this.metrics.uptime = Date.now() - this.metrics.startTime.getTime();
      if (success) {
        this.metrics.successfulCycles++;
      } else {
        this.metrics.failedCycles++;
        this.consecutiveFailures++; // count ANY failure (exceptions or apply failures)
      }
      this.metrics.successRate = (this.metrics.successfulCycles / this.metrics.totalCycles) * 100;
      this.logger.debug(`📊 Cycle completed in ${duration}ms, success rate: ${this.metrics.successRate.toFixed(1)}% (${this.metrics.successfulCycles}/${this.metrics.totalCycles})`);
      if (success) {
        this.consecutiveFailures = 0; // reset on success
        if (this.restartAttempts > 0) {
          this.logger.info(`✅ Cycle succeeded after ${this.restartAttempts} restart attempt(s) — resetting restart counter`);
          this.restartAttempts = 0;
        }
      } else {
        // Check circuit breaker threshold
        if (this.consecutiveFailures >= this.CIRCUIT_BREAKER_THRESHOLD) {
          this.triggerCircuitBreaker();
        }
      }
      this.isRunning = false;
    }
    // Save metrics snapshot for history
    await this.saveMetricsSnapshot().catch(() => {});

    // Prompt optimization trigger
    if (this.enablePromptOptimization && this.promptOptimizer) {
      this.cycleCountSinceOptimization++;
      const interval = this.config.promptOptimizationInterval || 5;
      if (this.cycleCountSinceOptimization >= interval) {
        this.cycleCountSinceOptimization = 0;
        await this.runPromptOptimization().catch(e => this.logger.error('Prompt optimization failed:', e));
      }
    }

    return success;
  }

  private async applyWithSafety(diff: string, improvement: ImprovementCandidate, individualId?: string): Promise<boolean> {
    // Guard: runtime must be active
    if (!this.runtime?.session) {
      this.logger.error('❌ Cannot apply diff: runtime session not available');
      return false;
    }

    const targetFile = join(process.cwd(), 'evo.ts');

    // 1. Create backup
    const backupPath = await this.diffApplier.createBackup(targetFile);
    this.logger.info(`📦 Created backup at ${backupPath}`);

    // 2 Syntax validation (pre-apply)
    if (!await this.validateSyntax(diff)) {
      this.logger.error('❌ Diff failed syntax validation');
      return false;
    }

    // 3. Apply diff
    const success = await this.diffApplier.applyDiff(diff, targetFile);
    if (!success) {
      this.logger.error('❌ Failed to apply diff');
      await writeFile(targetFile, await readFile(backupPath, 'utf-8'));
      this.logger.info('↩️ Restored from backup after apply failure');
      return false;
    }

    // 4. Post-apply validation
    if (!await this.validateAfterApply()) {
      this.logger.error('❌ Post-apply validation failed');
      await writeFile(targetFile, await readFile(backupPath, 'utf-8'));
      this.logger.info('↩️ Rolled back due to validation failure');
      return false;
    }

    // 5. Record success & update metrics
    this.diffApplier.recordHistory(this.level, improvement.description, diff, backupPath);
    await this.diffApplier.saveHistory();

    // Categorize improvement
    const category = this.categorizeImprovement(improvement.description);
    this.metrics.improvementsByCategory[category] = (this.metrics.improvementsByCategory[category] || 0) + 1;

    this.logger.info(`✅ Improvement applied (pending level up)`);
    return true;
  }

  private categorizeImprovement(description: string): string {
    const desc = description.toLowerCase();
    if (desc.includes('error') || desc.includes('fix') || desc.includes('bug')) return 'bugfix';
    if (desc.includes('performance') || desc.includes('optimization') || desc.includes('fast')) return 'performance';
    if (desc.includes('security') || desc.includes('vulnerability') || desc.includes('secure')) return 'security';
    if (desc.includes('test') || desc.includes('testing')) return 'testing';
    if (desc.includes('refactor') || desc.includes('clean') || desc.includes('renam')) return 'refactoring';
    if (desc.includes('type') || desc.includes('typescript') || desc.includes('interface')) return 'typescript';
    if (desc.includes('doc') || desc.includes('comment')) return 'documentation';
    return 'other';
  }

  private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  private async validateSyntax(diff: string): Promise<boolean> {
    const newCode = extractNewFile(diff);
    if (!newCode) {
      this.logger.error('Could not extract new code from diff');
      return false;
    }
    // Basic checks: balanced braces
    const openBraces = (newCode.match(/{/g) || []).length;
    const closeBraces = (newCode.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      this.logger.warn(`❌ Unbalanced braces: { = ${openBraces}, } = ${closeBraces}`);
      return false;
    }
    return true;
  }

  private async validateAfterApply(): Promise<boolean> {
    // Attempt to compile the new file
    try {
      const { execFile } = await import('child_process');
      const path = join(process.cwd(), 'evo.ts');
      return new Promise((resolve) => {
        execFile('npx', ['tsc', '--noEmit', path], (error) => {
          resolve(!error);
        });
      });
    } catch (e) {
      this.logger.warn('Could not validate syntax (tsc not available)');
      return true; // Skip validation if tsc not available
    }
  }

  private async readSelf(): Promise<string> {
    try {
      const cwd = process.cwd();
      const defaultFiles = await this.collectSourceFiles();
      const files = this.config.filesToEvolve && this.config.filesToEvolve.length > 0
        ? this.config.filesToEvolve
        : defaultFiles;

      const contents = await Promise.all(
        files.map(async (file) => {
          const path = join(cwd, file);
          try {
            const content = await readFile(path, 'utf-8');
            return `=== ${file} ===\n` + content;
          } catch (e) {
            return `=== ${file} ===\n// Error: ${e instanceof Error ? e.message : String(e)}`;
          }
        })
      );

      const combined = contents.join('\n\n');
      // Increased limit to 100000 chars (100k) for comprehensive analysis
      const maxLen = 100000;
      if (combined.length <= maxLen) return combined;

      // For large codebases, include evo.ts fully and sample from src/
      const parts: string[] = [];
      let totalLen = 0;

      // Always include evo.ts first and fully
      const evoIndex = files.findIndex(f => f === 'evo.ts' || f.endsWith('main.ts'));
      if (evoIndex >= 0 && contents[evoIndex]) {
        parts.push(contents[evoIndex]);
        totalLen += contents[evoIndex].length;
      }

      // Add other files until we hit limit
      for (let i = 0; i < files.length; i++) {
        if (i === evoIndex) continue;
        const content = contents[i];
        if (!content) continue;

        if (totalLen + content.length <= maxLen) {
          parts.push(content);
          totalLen += content.length;
        } else {
          // Truncate this file and add partial
          const remaining = maxLen - totalLen - 100; // reserve for truncation msg
          if (remaining > 500) {
            const half = Math.floor(remaining / 2);
            const front = content.substring(0, half);
            const back = content.substring(content.length - half);
            parts.push(front + '\n... (truncated) ...\n' + back);
          }
          break;
        }
      }

      return parts.join('\n\n') + 
        (totalLen >= maxLen ? '\n\n// Note: Code truncated due to length limit. Full analysis would require multiple passes or summary approach.' : '');
    } catch (e: any) {
      throw new Error(`Cannot read self: ${e.message}`);
    }
  }

  /**
   * Collect all relevant source files for self-analysis using dynamic discovery
   */
  private async collectSourceFiles(): Promise<string[]> {
    // @ts-ignore: glob lacks types
    const { glob } = await import('glob') as any;
    const cwd = process.cwd();

    const patterns = [
      'evo.ts',
      'src/**/*.ts',
      'agents/**/*.ts',
      'extensions/**/*.ts',
      '*.json', // config files
    ];

    const files = new Set<string>();
    for (const pattern of patterns) {
      const matches = (glob as any).sync(pattern, {
        cwd,
        absolute: false,
        nodir: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      }) as string[];
      matches.forEach((m: string) => files.add(m));
    }

    // Ensure evo.ts is first if present
    const result = Array.from(files).sort();
    const evoIndex = result.findIndex(f => f === 'evo.ts');
    if (evoIndex > 0) {
      const evo = result.splice(evoIndex, 1)[0];
      result.unshift(evo);
    }

    return result;
  }

  private async analyze(code: string): Promise<any> {
    const prompt = `Analyze this complete self-evolving agent codebase and suggest concrete improvements.

Code (${code.length} chars, includes core system, agents, extensions):
${code.substring(0, 120000)}

Return JSON:
{
  "improvements": [
    { 
      "priority": "high|medium|low", 
      "description": "specific change", 
      "category": "architecture|performance|security|testing|refactoring|typescript|documentation|other",
      "files": ["src/file.ts"],
      "reason": "brief explanation"
    }
  ]
}`;

    const response = await this.runtime.session.prompt(prompt);
    const text = this.extractText(response);

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch (e) {
      this.logger.warn('Failed to parse analysis');
    }

    return { improvements: [] };
  }

  private async plan(analysis: any): Promise<{ improvements: ImprovementCandidate[]; description: string }> {
    const priorityMap: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const rawImprovements = analysis.improvements || [];

    // Convert to ImprovementCandidate with genetics data
    const improvements: ImprovementCandidate[] = rawImprovements.map((imp: any) => ({
      description: imp.description,
      priority: imp.priority as 'high' | 'medium' | 'low',
      category: this.categorizeImprovement(imp.description),
      complexity: this.estimateComplexity(imp.description),
      risk: this.estimateRisk(imp.description),
      expectedImpact: this.estimateImpact(imp),
    }));

    // Sort by priority (default)
    improvements.sort((a, b) => (priorityMap[b.priority] || 0) - (priorityMap[a.priority] || 0));

    return { improvements, description: `Selected ${improvements.length} improvements` };
  }

  private estimateComplexity(description: string): number {
    const desc = description.toLowerCase();
    let complexity = 5;
    if (desc.length > 100) complexity += 2;
    if (desc.includes('refactor')) complexity += 1;
    if (desc.includes('architecture')) complexity += 2;
    if (desc.includes('minor') || desc.includes('simple')) complexity -= 2;
    return Math.max(1, Math.min(10, complexity));
  }

  private estimateRisk(description: string): number {
    const desc = description.toLowerCase();
    let risk = 3;
    if (desc.includes('security')) risk += 2;
    if (desc.includes('breaking')) risk += 3;
    if (desc.includes('critical')) risk += 2;
    if (desc.includes('minor') || desc.includes('simple')) risk -= 2;
    return Math.max(1, Math.min(10, risk));
  }

  private estimateImpact(improvement: any): number {
    const priorityMap: Record<string, number> = { high: 9, medium: 6, low: 3 };
    return priorityMap[improvement.priority as string] || 5;
  }

  private async generateDiff(improvement: any): Promise<string> {
    const code = await this.readSelf();
    const prompt = `Generate a unified diff patch for this improvement.

IMPROVEMENT:
${improvement.description}

CURRENT CODE (${code.length} chars):
${code}

REQUIREMENTS:
1. Output ONLY raw unified diff (no markdown, no explanations)
2. Format: --- a/evo.ts, +++ b/evo.ts, @@ headers
3. Ensure patch applies cleanly to EXACT lines shown
4. Target ONLY evo.ts (the main entry file)

EXAMPLE:
--- a/evo.ts
+++ b/evo.ts
@@ -1,5 +1,6 @@
 line 1
+added line
-removed line

Respond with raw diff only:`;

    const response = await this.runtime.session.prompt(prompt);
    return this.extractText(response);
  }

  startAuto(intervalMs?: number) {
    if (this.autoInterval) return;
    this.autoInterval = setInterval(() => {
      this.cycle().catch(e => this.logger.error('Auto-evolution error:', e));
    }, intervalMs || this.config.evolutionInterval);
    this.logger.info(`⏰ Auto-evolution every ${(intervalMs || this.config.evolutionInterval) / 1000}s`);
  }

  stopAuto() {
    if (this.autoInterval) {
      clearInterval(this.autoInterval);
      this.autoInterval = null;
      this.logger.info('⏹️ Auto-evolution stopped');
    }
    // Cancel any pending restart timer
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = undefined;
      this.logger.debug('🗑️ Cancelled pending restart');
    }
  }

  getLevel(): number {
    return this.level;
  }

  async getHistory() {
    await this.ensureHistoryLoaded();
    return this.diffApplier.getHistory();
  }

  async getMetrics(): Promise<EvolutionMetrics> {
    // Recalculate uptime
    this.metrics.uptime = Date.now() - this.metrics.startTime.getTime();
    return { ...this.metrics };
  }

  async getMetricsHistory(): Promise<Array<{ timestamp: string; totalCycles: number; successRate: number; avgCycleTimeMs: number; improvementsByCategory: Record<string, number> }>> {
    return this.metricsHistory;
  }

  private async saveMetricsSnapshot(): Promise<void> {
    // Capture current metrics snapshot
    const snapshot = {
      timestamp: new Date().toISOString(),
      totalCycles: this.metrics.totalCycles,
      successRate: this.metrics.successRate,
      avgCycleTimeMs: this.metrics.avgCycleTimeMs,
      improvementsByCategory: { ...this.metrics.improvementsByCategory },
    };
    this.metricsHistory.push(snapshot);

    // Prune: keep last 200 entries OR last 24 hours
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    this.metricsHistory = this.metricsHistory
      .filter(s => new Date(s.timestamp).getTime() > cutoff)
      .slice(-200);

    // Throttle disk writes: only every N cycles
    this.metricsWriteCounter++;
    if (this.metricsWriteCounter % this.METRICS_WRITE_THROTTLE === 0) {
      await this.saveMetricsHistory();
    }
  }

  /**
   * Run prompt optimization for all agent types
   */
  private async runPromptOptimization(): Promise<void> {
    if (!this.promptOptimizer || !this.agentManager) return;

    this.logger.info('🧠 Starting prompt optimization cycle...');

    // Get current agent templates from settings
    const settingsManager = this.runtime.services?.settingsManager;
    if (!settingsManager) {
      this.logger.warn('SettingsManager not available for prompt optimization');
      return;
    }

    const projectSettings = settingsManager.getProjectSettings();
    const templates = (projectSettings as any).evo?.agentTemplates as Record<string, any> || {};

    for (const [type, template] of Object.entries(templates)) {
      if (type !== 'researcher' && type !== 'coder' && type !== 'analyzer') continue;

      this.logger.info(`Optimizing prompts for ${type}...`);
      const currentConfig: AgentConfig = {
        type,
        systemPrompt: template.systemPrompt,
        tools: template.tools || [],
        thinkingLevel: template.thinkingLevel || 'medium',
        model: template.model || this.config.model,
        customTools: template.customTools || [],
      };

      try {
        const result = await this.promptOptimizer.evolvePrompts(type as any, currentConfig);

        // Apply best genome to template
        const optimizedConfig = this.promptOptimizer.applyToConfig(currentConfig, result.bestGenome);
        templates[type].systemPrompt = optimizedConfig.systemPrompt;
        templates[type].tools = optimizedConfig.tools;
        templates[type].thinkingLevel = optimizedConfig.thinkingLevel;
        // Save additional params
        (templates[type] as any).temperature = optimizedConfig.temperature;
        (templates[type] as any).maxTokens = optimizedConfig.maxTokens;
        // Ensure type field is preserved
        templates[type].type = type;

        this.logger.info(`✅ Optimized ${type}: fitness=${result.bestFitness.toFixed(3)}, improvement=${(result.improvement*100).toFixed(1)}%`);
      } catch (e: any) {
        this.logger.error(`Failed to optimize ${type}:`, e.message);
      }
    }

    // Persist optimized templates
    await settingsManager.flush();
    this.logger.info('🧠 Prompt optimization complete and saved');

    // Reload agent templates so new agents use optimized prompts
    if (this.agentManager) {
      this.agentManager.reloadTemplates(settingsManager);
    }
  }

  async rollback(level: number): Promise<boolean> {
    await this.ensureHistoryLoaded();
    const success = await this.diffApplier.rollback(level);
    if (success) {
      await this.messageBus?.publish('evolution.rollback', 'evolution-engine', `Rolled back to level ${level}`);
    }
    return success;
  }

  // Hot-reload configuration setters
  public setStrategy(name: string): void {
    const old = this.selectedStrategyName;
    this.selectedStrategyName = name as any;
    this.logger.info(`🎯 Evolution strategy changed: ${old} → ${name}`);
    if (name === 'genetic' && !this.geneticStrategy) {
      this.geneticStrategy = new GeneticEvolutionStrategy(this.logger, 10);
    }
  }

  public setGeneticFlag(enabled: boolean): void {
    // Update config for consistency
    this.config.enableGeneticStrategy = enabled;
    if (enabled && !this.geneticStrategy) {
      this.geneticStrategy = new GeneticEvolutionStrategy(this.logger, 10);
      this.logger.info('🧬 Genetic strategy enabled');
    } else if (!enabled) {
      this.geneticStrategy = undefined;
      this.logger.info('🧬 Genetic strategy disabled');
    }
  }

  public setPromptOptimization(enabled: boolean, interval?: number): void {
    const old = this.enablePromptOptimization;
    this.enablePromptOptimization = enabled;
    // Update config for runtime reference
    this.config.enablePromptOptimization = enabled;
    if (interval !== undefined) {
      this.config.promptOptimizationInterval = interval;
    }
    if (enabled && !this.promptOptimizer) {
      this.promptOptimizer = new PromptOptimizer(this.logger, this.metrics);
    }
    this.logger.info(`🧠 Prompt optimization: ${old} → ${enabled}${interval ? ` (interval: ${interval})` : ''}`);
  }

  // Trigger circuit breaker after consecutive failures
  private triggerCircuitBreaker(): void {
    this.circuitBreakerPausedUntil = Date.now() + this.CIRCUIT_BREAKER_DURATION_MS;
    this.logger.error(`🔴 Circuit breaker triggered — pausing auto-evolution for ${this.CIRCUIT_BREAKER_DURATION_MS / 1000 / 60} minutes`);
    this.stopAuto(); // stop daemon

    // Auto-restart with exponential backoff if within max attempts
    if (this.restartAttempts < this.MAX_RESTART_ATTEMPTS) {
      this.restartAttempts++;
      const backoff = this.RESTART_BACKOFF_BASE_MS * Math.pow(2, this.restartAttempts - 1);
      this.logger.warn(`♻️ Scheduling auto-restart attempt ${this.restartAttempts}/${this.MAX_RESTART_ATTEMPTS} in ${backoff / 1000}s...`);
      this.restartTimer = setTimeout(() => {
        this.logger.info(`🔄 Auto-restarting evolution daemon (attempt ${this.restartAttempts})...`);
        this.startAuto(this.config.evolutionInterval);
      }, backoff);
    } else {
      this.logger.error(`💀 Max restart attempts (${this.MAX_RESTART_ATTEMPTS}) exceeded — manual intervention required`);
    }
  }

  private extractText(result: any): string {
    if (typeof result === 'string') return result;
    if (result.content && Array.isArray(result.content)) {
      return result.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n');
    }
    return JSON.stringify(result, null, 2);
  }
}

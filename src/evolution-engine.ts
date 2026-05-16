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
  private agentManager: any;
  private messageBus: any;
  private diffApplier: DiffApplier;
  private historyLoaded = false;
  private geneticStrategy?: GeneticEvolutionStrategy;
  private sandbox?: any;
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

  constructor(
    runtime: AgentSessionRuntime,
    config: EvolutionConfig,
    logger: Logger,
    agentManager: any,
    messageBus: any,
    sandbox?: any
  ) {
    this.runtime = runtime;
    this.config = config;
    this.agentDir = config.agentDir;
    this.logger = logger;
    this.agentManager = agentManager;
    this.messageBus = messageBus;
    this.sandbox = sandbox;
    this.diffApplier = new DiffApplier(logger, undefined, this.agentDir);
    this.maxBackups = config.maxBackups || 50;
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
          return false;
        }

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
      } else {
        this.logger.info('✅ No improvements identified');
        success = false;
      }
    } catch (error: any) {
      this.metrics.failedCycles++;
      this.logger.error(`❌ Evolution cycle #${this.level} failed: ${error.message}`);
      success = false;
    } finally {
      const duration = Date.now() - startTime;
      this.metrics.lastCycleTimeMs = duration;
      this.metrics.avgCycleTimeMs = ((this.metrics.avgCycleTimeMs * (this.metrics.totalCycles - 1)) + duration) / this.metrics.totalCycles;
      this.metrics.uptime = Date.now() - this.metrics.startTime.getTime();
      if (success) {
        this.metrics.successfulCycles++;
      } else {
        this.metrics.failedCycles++;
      }
      this.metrics.successRate = (this.metrics.successfulCycles / this.metrics.totalCycles) * 100;
      this.logger.debug(`📊 Cycle completed in ${duration}ms, success rate: ${this.metrics.successRate.toFixed(1)}% (${this.metrics.successfulCycles}/${this.metrics.totalCycles})`);
    }
    // Save metrics snapshot for history
    await this.saveMetricsSnapshot();

    // Prompt optimization trigger
    if (this.enablePromptOptimization && this.promptOptimizer) {
      this.cycleCountSinceOptimization++;
      const interval = this.config.promptOptimizationInterval || 5;
      if (this.cycleCountSinceOptimization >= interval) {
        this.cycleCountSinceOptimization = 0;
        await this.runPromptOptimization();
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
      const selfPath = join(process.cwd(), 'evo.ts');
      const enginePath = join(process.cwd(), 'src', 'evolution-engine.ts');
      const systemPath = join(process.cwd(), 'src', 'system.ts');
      const [entrySrc, engineSrc, systemSrc] = await Promise.all([
        readFile(selfPath, 'utf-8').catch(() => '// entry point not available'),
        readFile(enginePath, 'utf-8').catch(() => '// evolution-engine.ts not available'),
        readFile(systemPath, 'utf-8').catch(() => '// system.ts not available'),
      ]);
      return '=== evo.ts (Entry Point) ===\n' + entrySrc + '\n\n=== src/evolution-engine.ts ===\n' + engineSrc + '\n\n=== src/system.ts ===\n' + systemSrc;
    } catch (e: any) {
      throw new Error(`Cannot read self: ${e.message}`);
    }
  }

  private async analyze(code: string): Promise<any> {
    const prompt = `Analyze this self-evolving agent code and suggest concrete improvements.

Code (first 8000 chars):
${code.substring(0, 8000)}

Return JSON:
{
  "improvements": [
    { "priority": "high|medium|low", "description": "specific change" }
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
    const prompt = `Generate a unified diff patch for this improvement:

${improvement.description}

Current code (first 6000 chars):
${code.substring(0, 6000)}

Respond with ONLY the raw diff:
--- a/evo.ts
+++ b/evo.ts
@@ -oldLine,oldCount +newLine,newCount @@
- old code
+ new code

NO explanations.`;

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
    // Keep only last 1000 entries to limit memory
    if (this.metricsHistory.length > 1000) {
      this.metricsHistory = this.metricsHistory.slice(-1000);
    }
    await this.saveMetricsHistory();
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
  }

  async rollback(level: number): Promise<boolean> {
    await this.ensureHistoryLoaded();
    const success = await this.diffApplier.rollback(level);
    if (success) {
      await this.messageBus?.publish('evolution.rollback', 'evolution-engine', `Rolled back to level ${level}`);
    }
    return success;
  }

  private extractText(result: any): string {
    if (typeof result === 'string') return result;
    if (result.content && Array.isArray(result.content)) {
      return result.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n');
    }
    return JSON.stringify(result, null, 2);
  }
}

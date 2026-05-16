import type { AgentSessionRuntime } from '@earendil-works/pi-coding-agent';
import { Logger } from './logger.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { CodeAnalyzer } from './code-analyzer.js';
import { MultiFileDiffApplier } from './multi-file-diff-applier.js';
import { ValidationRunner } from './validation-runner.js';
import { AgentManager } from './agent-manager.js';
import { MessageBus } from './messaging.js';

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
  private logger: Logger;
  private agentDir: string;
  private level: number = 0;
  private autoInterval: NodeJS.Timeout | null = null;
  private agentManager: AgentManager;
  private messageBus: MessageBus;
  private codeAnalyzer: CodeAnalyzer;
  private diffApplier: MultiFileDiffApplier;
  private autoApply: boolean = false;
  private historyLoaded = false;
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

  constructor(
    runtime: AgentSessionRuntime,
    logger: Logger,
    agentManager: AgentManager,
    messageBus: MessageBus
  ) {
    this.runtime = runtime;
    this.logger = logger;
    this.agentDir = logger['logPath'] ? join(logger['logPath'].split('/').slice(0, -1).join('/')) : process.env.HOME + '/.pi/agent';
    this.agentManager = agentManager;
    this.messageBus = messageBus;

    // Initialize components
    this.codeAnalyzer = new CodeAnalyzer(process.cwd(), 120000, logger);
    const backupDir = join(this.agentDir, '.evo', 'backups');
    this.diffApplier = new MultiFileDiffApplier(logger, process.cwd(), backupDir, 50);
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.historyLoaded) {
      await this.diffApplier.loadHistory();
      this.historyLoaded = true;
    }
  }

  /**
   * Main evolution cycle
   */
  async cycle(): Promise<boolean> {
    if (!this.runtime) {
      this.logger.error('❌ Runtime not available');
      return false;
    }

    await this.ensureInitialized();
    const startTime = Date.now();
    this.metrics.totalCycles++;
    this.logger.info(`🔁 Evolution cycle #${this.level} starting...`);

    let cycleSuccess = false;
    let appliedFiles: string[] = [];

    try {
      // 1. ANALYZE: Collect codebase
      this.logger.info('📊 Analyzing codebase...');
      const analysisContext = await this.codeAnalyzer.analyze();
      this.logger.debug(`Analyzed ${analysisContext.files.length} files`);

      // 2. GENERATE IMPROVEMENTS
      this.logger.info('🤖 Asking AI for improvements...');
      const analysis = await this.analyzeCodebase(analysisContext);
      
      const plan = await this.planImprovements(analysis);
      if (!plan.improvements || plan.improvements.length === 0) {
        this.logger.info('✅ No improvements identified');
        return false;
      }

      // 3. SELECT: Pick first (highest priority) improvement
      const improvement = plan.improvements[0];
      this.logger.info(`🔨 Selected: ${improvement.description}`);
      
      // 4. GENERATE DIFF
      this.logger.info('📝 Generating diff...');
      const diff = await this.generateDiff(improvement, analysisContext);
      
      if (!diff || !diff.includes('--- a/') || !diff.includes('+++ b/')) {
        this.logger.error('❌ Invalid diff generated');
        return false;
      }

      // 5. APPLY or SHOW
      if (this.autoApply) {
        this.logger.info('🔧 Applying diff automatically...');
        const applyResult = await this.applyWithValidation(diff, improvement);
        
        if (applyResult.success) {
          appliedFiles = applyResult.affectedFiles;
          this.level++;
          cycleSuccess = true;
          this.logger.info(`✅ Evolution level ${this.level} - modified ${appliedFiles.length} file(s)`);
        } else {
          this.logger.error('❌ Failed to apply diff');
          cycleSuccess = false;
        }
      } else {
        this.logger.info('✅ Diff generated (manual apply required)');
        this.level++;
        cycleSuccess = true;
      }
    } catch (error: any) {
      this.logger.error(`❌ Evolution cycle #${this.level} failed: ${error.message}`);
      cycleSuccess = false;
    } finally {
      const duration = Date.now() - startTime;
      this.metrics.lastCycleTimeMs = duration;
      this.totalCycleTimeMs += duration;

      if (cycleSuccess) {
        this.metrics.successfulCycles++;
      } else {
        this.metrics.failedCycles++;
      }

      this.metrics.totalCycles = this.metrics.successfulCycles + this.metrics.failedCycles;
      this.metrics.successRate = (this.metrics.successfulCycles / this.metrics.totalCycles) * 100;
      this.metrics.avgCycleTimeMs = this.totalCycleTimeMs / this.metrics.totalCycles;
      this.metrics.uptime = Date.now() - this.metrics.startTime.getTime();
    }

    return cycleSuccess;
  }

  /**
   * Analyze codebase with LLM
   */
  private async analyzeCodebase(context: any): Promise<any> {
    const filesContent = (context.files as any[])
      .map((f: any) => `=== ${f.path} (${f.language}) ===\n${f.content.substring(0, 4000)}`)
      .join('\n\n');

    const prompt = `Analyze this codebase and suggest improvements for a self-evolving AI agent.

CODE SUMMARY:
${context.summary}

FILES (${context.files.length}):
${filesContent.substring(0, 30000)}

Return JSON:
{
  "improvements": [
    {
      "priority": "high|medium|low",
      "description": "specific actionable change",
      "category": "architecture|performance|security|testing|refactoring|typescript|documentation|other",
      "files": ["path1", "path2"],
      "reason": "why this is valuable"
    }
  ]
}

Be specific, include all files that need changes in "files" array.`;

    const response = await this.runtime.session.prompt(prompt);
    const text = this.extractText(response);

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      this.logger.warn('Failed to parse analysis:', e);
    }

    return { improvements: [] };
  }

  /**
   * Convert raw improvements to candidates with metadata
   */
  private async planImprovements(analysis: any): Promise<{ improvements: any[] }> {
    const raw = analysis.improvements || [];
    const priorityMap: Record<string, number> = { high: 3, medium: 2, low: 1 };

    const improvements = raw.map((imp: any) => ({
      description: imp.description,
      priority: imp.priority as 'high' | 'medium' | 'low',
      category: imp.category || this.categorizeImprovement(imp.description),
      files: imp.files || [],
    }));

    improvements.sort((a: any, b: any) => (priorityMap[b.priority] || 0) - (priorityMap[a.priority] || 0));
    return { improvements };
  }

  /**
   * Generate unified diff
   */
  private async generateDiff(improvement: any, context: any): Promise<string> {
    const files = improvement.files.length > 0 ? improvement.files : ['evo.ts'];
    const content = await this.getFilesContent(files);

    const prompt = `Generate a unified diff patch for this improvement.

IMPROVEMENT: ${improvement.description}
FILES: ${files.join(', ')}

CURRENT CODE (first 4000 chars per file):
${content.substring(0, 30000)}

REQUIREMENTS:
- Output ONLY raw unified diff
- Format: --- a/file, +++ b/file, @@ headers
- If multiple files, include all patches
- Ensure patches apply cleanly

Raw diff:`;

    const response = await this.runtime.session.prompt(prompt);
    return this.extractText(response).trim();
  }

  private async getFilesContent(filePaths: string[]): Promise<string> {
    const contents = await Promise.all(
      filePaths.map(async (file) => {
        try {
          const content = await readFile(file, 'utf-8');
          return `=== ${file} ===\n${content}`;
        } catch {
          return `=== ${file} ===\n// File not found`;
        }
      })
    );
    return contents.join('\n\n');
  }

  /**
   * Apply diff with validation and rollback on failure
   */
  private async applyWithValidation(diff: string, improvement: any): Promise<{ success: boolean; affectedFiles: string[] }> {
    const affectedFiles = this.diffApplier.parseDiffFiles(diff);
    
    if (affectedFiles.length === 0) {
      return { success: false, affectedFiles: [] };
    }

    this.logger.debug(`Applying to ${affectedFiles.length} file(s)`);

    // Create backups
    const backups = await this.diffApplier.createBackups(affectedFiles);

    // Apply
    const applyResult = await this.diffApplier.applyDiff(diff);
    if (!applyResult.success) {
      this.logger.error('Apply failed:', applyResult.errors);
      return { success: false, affectedFiles: [] };
    }

    // Run validation
    this.logger.debug('Running validation...');
    const validation = await new ValidationRunner(process.cwd(), this.logger, { runTests: true }).validate();
    
    if (!validation.success) {
      this.logger.error('Validation failed, rolling back');
      // Rollback
      for (const file of affectedFiles) {
        try {
          const backupPath = backups[file];
          if (backupPath) {
            const backup = await readFile(backupPath, 'utf-8');
            await writeFile(file, backup);
            this.logger.info(`Restored ${file}`);
          }
        } catch (e) {
          this.logger.error(`Failed to restore ${file}`);
        }
      }
      return { success: false, affectedFiles: [] };
    }

    // Record success
    this.diffApplier.recordHistory(this.level, improvement.description, diff, affectedFiles, backups);
    await this.diffApplier.saveHistory();
    await this.diffApplier.cleanupBackups();

    // Track metrics
    const category = improvement.category || 'other';
    this.metrics.improvementsByCategory[category] = (this.metrics.improvementsByCategory[category] || 0) + 1;

    return { success: true, affectedFiles: applyResult.affectedFiles };
  }

  private basicSyntaxCheck(diff: string): boolean {
    return !diff.includes('\0');
  }

  private categorizeImprovement(description: string): string {
    const desc = description.toLowerCase();
    if (desc.includes('error') || desc.includes('fix')) return 'bugfix';
    if (desc.includes('performance') || desc.includes('optimization')) return 'performance';
    if (desc.includes('refactor') || desc.includes('clean')) return 'refactoring';
    if (desc.includes('type') || desc.includes('interface')) return 'typescript';
    if (desc.includes('doc') || desc.includes('comment')) return 'documentation';
    return 'other';
  }

  private extractText(result: any): string {
    if (typeof result === 'string') return result;
    if (result?.content && Array.isArray(result.content)) {
      return result.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n');
    }
    if (result?.text) return result.text;
    if (result?.message) return result.message;
    return JSON.stringify(result) || '';
  }

  // Public API

  setAutoApply(enabled: boolean): void {
    this.autoApply = enabled;
    this.logger.info(`Auto-apply: ${enabled}`);
  }

  startAuto(intervalMs: number = 300000): void {
    if (this.autoInterval) return;
    this.autoInterval = setInterval(() => {
      this.cycle().catch(e => this.logger.error('Auto-evolution error:', e));
    }, intervalMs);
    this.logger.info(`⏰ Auto-evolution every ${intervalMs / 1000}s`);
  }

  stopAuto(): void {
    if (this.autoInterval) {
      clearInterval(this.autoInterval);
      this.autoInterval = null;
      this.logger.info('⏹️ Auto-evolution stopped');
    }
  }

  getLevel(): number {
    return this.level;
  }

  async getHistory(): Promise<any[]> {
    await this.ensureInitialized();
    return this.diffApplier.getHistory();
  }

  async getMetrics(): Promise<EvolutionMetrics> {
    this.metrics.uptime = Date.now() - this.metrics.startTime.getTime();
    return this.metrics;
  }

  async rollback(level: number): Promise<boolean> {
    await this.ensureInitialized();
    const success = await this.diffApplier.rollback(level);
    if (success) {
      await this.messageBus?.publish('evolution.rollback', 'evolution-engine', `Rolled back to level ${level}`);
    }
    return success;
  }
}

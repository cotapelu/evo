import type { AgentSessionRuntime } from '@earendil-works/pi-coding-agent';
import { Logger } from './logger.js';

export class EvolutionEngine {
  private runtime: AgentSessionRuntime;
  private config: any;
  private logger: Logger;
  private level: number = 10;
  private autoInterval: NodeJS.Timeout | null = null;
  private agentManager: any;
  private messageBus: any;

  constructor(runtime: AgentSessionRuntime, config: any, logger: Logger, agentManager: any, messageBus: any) {
    this.runtime = runtime;
    this.config = config;
    this.logger = logger;
    this.agentManager = agentManager;
    this.messageBus = messageBus;
  }

  async cycle(): Promise<boolean> {
    this.logger.info(`🔁 Evolution cycle #${this.level} starting...`);

    try {
      const code = await this.readSelf();
      const analysis = await this.analyze(code);
      const plan = await this.plan(analysis);

      if (plan.improvements && plan.improvements.length > 0) {
        const success = await this.implement(plan.improvements[0]);
        if (success) {
          this.level++;
          this.logger.info(`⬆️ Level up! Now at ${this.level}`);
          return true;
        }
      } else {
        this.logger.info('✅ No improvements identified');
      }
    } catch (error: any) {
      this.logger.error('Evolution cycle failed:', error.message);
    }

    return false;
  }

  private async readSelf(): Promise<string> {
    try {
      const { readFile } = await import('fs/promises');
      const { join } = await import('path');
      return await readFile(join(process.cwd(), 'evo.ts'), 'utf-8');
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

  private async plan(analysis: any): Promise<any> {
    const priorityMap: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const improvements = (analysis.improvements || []).sort(
      (a: any, b: any) => (priorityMap[b.priority as string] || 0) - (priorityMap[a.priority as string] || 0)
    );

    return { improvements, description: `Selected ${improvements.length} improvements` };
  }

  private async implement(improvement: any): Promise<boolean> {
    this.logger.info(`🔨 Implementing: ${improvement.description}`);

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
    const text = this.extractText(response);

    if (text.includes('--- a/') && text.includes('+++ b/') && text.includes('@@')) {
      this.logger.info('✅ Diff generated');
      this.logger.debug(text.substring(0, 500) + '...');
      return true;
    }

    this.logger.warn('❌ No valid diff');
    return false;
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

  private extractText(result: any): string {
    if (typeof result === 'string') return result;
    if (result.content && Array.isArray(result.content)) {
      return result.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n');
    }
    return JSON.stringify(result, null, 2);
  }
}

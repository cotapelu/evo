export class EvolutionEngine {
  private runtime: any;
  private interval: any = null;

  constructor(runtime: any) {
    this.runtime = runtime;
  }

  async cycle(): Promise<boolean> {
    try {
      // Collect codebase
      const files = await this.collectFiles();
      if (files.length === 0) return false;

      // Ask LLM for improvements
      const improvements = await this.askLLM(files);
      if (!improvements || improvements.length === 0) {
        console.log('✅ No improvements');
        return false;
      }

      // Take top improvement
      const imp = improvements[0];
      console.log(`🔨 ${imp.description}`);

      // Instruct LLM to apply using tools
      const instruction = `Apply this improvement: ${imp.description}\n\nFiles: ${imp.files?.join(', ') || 'all'}\n\nUse read, write, edit tools to modify files.`;
      await this.runtime.session.prompt(instruction);

      return true;
    } catch (error: any) {
      console.error('Cycle failed:', error.message);
      return false;
    }
  }

  startAuto(intervalMs = 300000): void {
    if (this.interval) return;
    this.interval = setInterval(() => this.cycle().catch(console.error), intervalMs);
  }

  stopAuto(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async collectFiles(): Promise<any[]> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const files: any[] = [];
    const exclude = ['node_modules', '.git', 'dist', 'build'];

    async function walk(dir: string, depth = 0): Promise<void> {
      if (depth > 3) return;
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (exclude.includes(entry.name)) continue;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(full, depth + 1);
          } else if (/\.(ts|js|json|md)$/.test(entry.name)) {
            try {
              const content = await fs.readFile(full, 'utf-8');
              files.push({ path: full, content: content.substring(0, 2000) });
            } catch {}
          }
        }
      } catch {}
    }

    await walk(process.cwd());
    return files;
  }

  private async askLLM(files: any[]): Promise<any[]> {
    const fileList = files.map(f => `=== ${f.path} ===\n${f.content.substring(0, 500)}`).join('\n\n').substring(0, 15000);

    const prompt = `Analyze codebase and suggest improvements.

FILES (${files.length}):
${fileList}

Return JSON:
{
  "improvements": [
    { "priority": "high|medium|low", "description": "...", "files": ["path1", "path2"] }
  ]
}

Focus: bugs, structure, TypeScript, performance.`;

    const response = await this.runtime.session.prompt(prompt);
    const text = this.extractText(response);

    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]).improvements || [];
    } catch {}
    return [];
  }

  private extractText(result: any): string {
    if (typeof result === 'string') return result;
    if (result?.content?.map) {
      return result.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n');
    }
    if (result?.text) return result.text;
    return JSON.stringify(result) || '';
  }
}

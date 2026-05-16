import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import glob from 'glob';

export interface CodeFile {
  path: string;
  content: string;
  language: string;
}

export interface AnalysisContext {
  files: CodeFile[];
}

export class CodeAnalyzer {
  private cwd: string;

  constructor(cwd: string, private maxTokens: number = 100000, private logger: any) {
    this.cwd = cwd;
  }

  /**
   * Collect all relevant source files (simple: all .ts files in src/ and evo.ts)
   */
  async analyze(): Promise<AnalysisContext> {
    const files = await this.collectFiles();
    const contentFiles: CodeFile[] = [];

    for (const file of files) {
      try {
        const content = await readFile(join(this.cwd, file), 'utf-8');
        contentFiles.push({
          path: file,
          content,
          language: 'typescript',
        });
      } catch (e) {
        this.logger?.warn(`Could not read ${file}:`, e);
      }
    }

    return { files: contentFiles };
  }

  /**
   * Get content for a specific file
   */
  async getFileContent(filePath: string): Promise<string | null> {
    try {
      return await readFile(join(this.cwd, filePath), 'utf-8');
    } catch {
      return null;
    }
  }

  private async collectFiles(): Promise<string[]> {
    const files = new Set<string>();

    // Always include evo.ts
    files.add('evo.ts');

    // All .ts files under src/
    const srcMatches = glob.sync('src/**/*.ts', {
      cwd: this.cwd,
      absolute: false,
      nodir: true,
    });
    srcMatches.forEach(m => files.add(m));

    return Array.from(files);
  }
}

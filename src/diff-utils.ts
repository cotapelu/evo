import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export interface EvolutionHistoryEntry {
  level: number;
  timestamp: Date;
  improvement: string;
  diff: string;
  backupPath: string;
  applied: boolean;
}

export class DiffApplier {
  private history: EvolutionHistoryEntry[] = [];
  private logger: any;
  private backupDir: string;

  constructor(logger: any, backupDir?: string) {
    this.logger = logger;
    this.backupDir = backupDir || join(process.cwd(), '.evo/backups');
  }

  async ensureBackupDir(): Promise<void> {
    try {
      await mkdir(this.backupDir, { recursive: true });
    } catch (e) {
      // Already exists
    }
  }

  async createBackup(filePath: string): Promise<string> {
    await this.ensureBackupDir();
    const timestamp = Date.now();
    const backupName = `${timestamp}-${Date.now()}.ts`;
    const backupPath = join(this.backupDir, backupName);
    await writeFile(backupPath, await readFile(filePath, 'utf-8'));
    this.logger.debug(`📦 Backed up ${filePath} → ${backupPath}`);
    return backupPath;
  }

  async applyDiff(diff: string, targetFile: string): Promise<boolean> {
    try {
      const original = await readFile(targetFile, 'utf-8');
      const applied = this.applyUnifiedDiff(original, diff);

      if (!applied) {
        this.logger.error('❌ Failed to apply diff (no changes or malformed)');
        return false;
      }

      await writeFile(targetFile, applied);
      this.logger.info('✅ Diff applied successfully');
      return true;
    } catch (e: any) {
      this.logger.error('❌ Error applying diff:', e.message);
      return false;
    }
  }

  private applyUnifiedDiff(original: string, diff: string): string | null {
    const lines = original.split('\n');
    const diffLines = diff.split('\n').filter(l => l.length > 0);

    // Simple unified diff parser (limited but works for our case)
    let result = [...lines];
    let lineIdx = 0;

    for (const line of diffLines) {
      if (line.startsWith('@@')) {
        // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (!match) continue;
        const oldStart = parseInt(match[1], 10) - 1;
        const oldCount = match[2] ? parseInt(match[2], 10) : 1;
        const newStart = parseInt(match[3], 10) - 1;
        const newCount = match[4] ? parseInt(match[4], 10) : 1;

        // For simplicity, we rebuild the entire file for each hunk
        // In production, use a proper diff library
        lineIdx = newStart;
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        // Add line
        result.splice(lineIdx, 0, line.substring(1));
        lineIdx++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        // Remove line
        result.splice(lineIdx, 1);
      } else if (!line.startsWith('---') && !line.startsWith('+++')) {
        // Context line, skip
      }
    }

    return result.join('\n');
  }

  async rollback(level: number): Promise<boolean> {
    const entry = this.history.find(e => e.level === level && e.applied);
    if (!entry) {
      this.logger.error(`❌ No applied evolution at level ${level}`);
      return false;
    }

    try {
      await writeFile(join(process.cwd(), 'evo.ts'), await readFile(entry.backupPath, 'utf-8'));
      entry.applied = false; // Mark as rolled back
      this.logger.info(`🔄 Rolled back to level ${level} from ${entry.backupPath}`);
      return true;
    } catch (e: any) {
      this.logger.error('❌ Rollback failed:', e.message);
      return false;
    }
  }

  recordHistory(level: number, improvement: string, diff: string, backupPath: string) {
    this.history.push({
      level,
      timestamp: new Date(),
      improvement,
      diff,
      backupPath,
      applied: true,
    });
    this.logger.info(`📚 Recorded evolution history entry #${level}`);
  }

  getHistory(): EvolutionHistoryEntry[] {
    return [...this.history];
  }

  async saveHistory(): Promise<void> {
    const historyFile = join(this.backupDir, 'history.json');
    await writeFile(historyFile, JSON.stringify(this.history, null, 2));
  }

  async loadHistory(): Promise<void> {
    try {
      const historyFile = join(this.backupDir, 'history.json');
      const content = await readFile(historyFile, 'utf-8');
      this.history = JSON.parse(content);
    } catch (e) {
      // No history yet
      this.history = [];
    }
  }
}

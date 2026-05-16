import { readFile, writeFile, mkdir, unlink, readdir } from 'fs/promises';
import { join } from 'path';
import { Logger } from './logger.js';
import { parsePatch, applyPatch } from 'diff';

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
  private logger: Logger;
  private backupDir: string;
  private targetFile: string;
  private maxBackups: number;

  constructor(logger: Logger, targetFile?: string, backupDir?: string, agentDir?: string, maxBackups: number = 50) {
    this.logger = logger;
    // Default backupDir: agentDir/.evo/backups (pi convention), fallback cwd
    this.backupDir = backupDir || (agentDir ? join(agentDir, '.evo', 'backups') : join(process.cwd(), '.evo', 'backups'));
    // Default target: evo.ts in cwd (project source file being evolved)
    this.targetFile = targetFile || join(process.cwd(), 'evo.ts');
    this.maxBackups = maxBackups;
  }

  /** Refresh the target file path (useful for testing) */
  setTargetFile(filePath: string) { this.targetFile = filePath; }

  /** Get the current target file path */
  getTargetFile(): string { return this.targetFile; }

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
    await this.cleanupBackups(); // Prune old backups
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
    } catch (error) {
      this.logger.error('❌ Error applying diff:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  private applyUnifiedDiff(original: string, diff: string): string | null {
    // 1. Validate file paths in diff (security: prevent path traversal)
    const lines = diff.split('\n');
    const fileHeaders = lines.filter(l => l.startsWith('--- ') || l.startsWith('+++ '));
    const targetFileName = this.targetFile.split(/[\\/]/).pop();
    
    for (const header of fileHeaders) {
      const path = header.substring(4).trim(); // after '--- ' or '+++ '
      // Extract base path (remove a/ or b/ prefix)
      const basePath = path.replace(/^a\//, '').replace(/^b\//, '');
      
      // Only allow evolving the target file
      if (basePath !== 'evo.ts' && basePath !== targetFileName) {
        this.logger.error(`Diff targets wrong file: ${basePath}, expected ${targetFileName}`);
        return null;
      }
      
      // Path traversal protection
      if (basePath.includes('..') || path.includes('/..') || path.includes('\\..')) {
        this.logger.error('Diff contains path traversal attempt');
        return null;
      }
    }

    // 2. Use diff library for proper patch application
    try {
      const patch = parsePatch(diff);
      if (!patch || patch.length === 0) {
        this.logger.error('Invalid or empty diff patch');
        return null;
      }
      
      // Apply the patch (cast to any to satisfy type mismatch in @types/diff)
      const result = applyPatch(original, patch as any);
      return result || null;
    } catch (error) {
      this.logger.error('Error parsing/applying diff:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async rollback(level: number): Promise<boolean> {
    const entry = this.history.find(e => e.level === level && e.applied);
    if (!entry) {
      this.logger.error(`❌ No applied evolution at level ${level}`);
      return false;
    }

    try {
      await writeFile(this.targetFile, await readFile(entry.backupPath, 'utf-8'));
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
    // Save history alongside backups in the .evo directory
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

  /**
   * Clean up old backup files, keeping only the most recent maxBackups
   */
  private async cleanupBackups(): Promise<void> {
    try {
      const files = await readdir(this.backupDir).catch(() => []);
      // Filter for backup files (timestamp-*.ts)
      const backupFiles: Array<{ name: string; path: string }> = files
        .filter((f): f is string => typeof f === 'string' && /^\d+-\d+\.ts$/.test(f))
        .map((f): { name: string; path: string } => ({ name: f, path: join(this.backupDir, f) }))
        .sort((a, b) => b.name.localeCompare(a.name)); // descending by name (timestamp)

      if (backupFiles.length <= this.maxBackups) return;

      // Delete oldest (excess)
      const toDelete = backupFiles.slice(this.maxBackups);
      for (const file of toDelete) {
        await unlink(file.path).catch(() => {});
        this.logger.debug(`🗑️ Deleted old backup: ${file.name}`);
      }
    } catch (e) {
      this.logger.warn('Failed to cleanup backups:', e);
    }
  }
}

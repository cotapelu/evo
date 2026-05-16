/**
 * Multi-File Diff Applier
 * Supports unified diffs that modify multiple files
 * Includes backup, validation, and rollback capabilities
 */

import { readFile, writeFile, mkdir, unlink, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { Logger } from './logger.js';
import { parsePatch, applyPatch } from 'diff';

export interface MultiFileHistoryEntry {
  level: number;
  timestamp: Date;
  improvement: string;
  diff: string;
  affectedFiles: string[];
  backupPaths: Record<string, string>; // file -> backup path
  applied: boolean;
}

export interface ApplyResult {
  success: boolean;
  affectedFiles: string[];
  backups: Record<string, string>;
  errors: Record<string, string>; // file -> error
}

/**
 * Advanced diff applier with multi-file support, security checks, and rollback
 */
export class MultiFileDiffApplier {
  private history: MultiFileHistoryEntry[] = [];
  private logger: Logger;
  private backupDir: string;
  private cwd: string;
  private maxBackups: number;

  constructor(logger: Logger, cwd: string, backupDir?: string, maxBackups: number = 50) {
    this.logger = logger;
    this.cwd = cwd;
    this.backupDir = backupDir || join(cwd, '.evo', 'backups');
    this.maxBackups = maxBackups;
  }

  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDir(): Promise<void> {
    try {
      await mkdir(this.backupDir, { recursive: true });
    } catch {
      // Already exists
    }
  }

  /**
   * Parse a unified diff and extract affected files
   */
  parseDiffFiles(diff: string): string[] {
    const files = new Set<string>();
    const lines = diff.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('--- a/')) {
        const filePath = line.substring(4).trim().replace(/^a\//, '');
        files.add(filePath);
      } else if (line.startsWith('+++ b/')) {
        const filePath = line.substring(4).trim().replace(/^b\//, '');
        files.add(filePath);
      }
    }
    
    return Array.from(files);
  }

  /**
   * Validate that diff only targets allowed files (no path traversal)
   */
  private validateDiffSecurity(diff: string, allowedFiles: Set<string>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const affectedFiles = this.parseDiffFiles(diff);

    for (const file of affectedFiles) {
      // Check for path traversal attempts
      if (file.includes('..') || file.includes('\0')) {
        errors.push(`Path traversal detected in file: ${file}`);
        return { valid: false, errors };
      }

      // Check if file is in allowed set (if provided)
      if (allowedFiles.size > 0 && !allowedFiles.has(file)) {
        errors.push(`Diff targets unauthorized file: ${file}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Create backups for all affected files
   */
  async createBackups(files: string[]): Promise<Record<string, string>> {
    await this.ensureBackupDir();
    const backups: Record<string, string> = {};
    const timestamp = Date.now();

    for (const file of files) {
      const fullPath = join(this.cwd, file);
      try {
        // Check if file exists before backing up
        try {
          const fileStat = await stat(fullPath);
          if (fileStat.isFile()) {
            const content = await readFile(fullPath, 'utf-8');
            const backupName = `${timestamp}-${file.replace(/[/\\]/g, '_')}.bak`;
            const backupPath = join(this.backupDir, backupName);
            await writeFile(backupPath, content);
            backups[file] = backupPath;
            this.logger.debug(`📦 Backed up ${file} → ${backupPath}`);
          } else {
            this.logger.debug(`📦 ${file} is not a regular file, skipping backup`);
          }
        } catch {
          // File doesn't exist, OK for new files
          this.logger.debug(`📦 File ${file} does not exist yet (new file)`);
        }
      } catch (e) {
        this.logger.warn(`Failed to backup ${file}: ${e}`);
      }
    }

    return backups;
  }

  /**
   * Apply a multi-file unified diff
   */
  async applyDiff(diff: string, allowedFiles?: Set<string>): Promise<ApplyResult> {
    const result: ApplyResult = {
      success: true,
      affectedFiles: [],
      backups: {},
      errors: {},
    };

    try {
      // Parse affected files
      const affectedFiles = this.parseDiffFiles(diff);
      result.affectedFiles = affectedFiles;

      if (affectedFiles.length === 0) {
        throw new Error('No files found in diff');
      }

      this.logger.info(`📁 Diff affects ${affectedFiles.length} file(s): ${affectedFiles.join(', ')}`);

      let filesPatched = 0; // Track actual patches applied

      // Security validation
      const securityCheck = this.validateDiffSecurity(diff, allowedFiles || new Set());
      if (!securityCheck.valid) {
        throw new Error(`Security validation failed: ${securityCheck.errors.join('; ')}`);
      }

      // Create backup for all existing files
      result.backups = await this.createBackups(affectedFiles);

      // Parse the patch
      const patch = parsePatch(diff);
      if (!patch || patch.length === 0) {
        throw new Error('Invalid or empty diff patch');
      }

      // Apply file by file
      const patchAny = patch as any[];
      
      for (const file of affectedFiles) {
        const filePatch = patchAny.filter(p => p.file === file || p.file === `a/${file}` || p.file === `b/${file}`);
        
        if (filePatch.length === 0) {
          this.logger.warn(`No patch content for file ${file}, skipping`);
          continue;
        }

        filesPatched++;

        const fullPath = join(this.cwd, file);
        
        // Read current file content (or empty for new file)
        let originalContent = '';
        try {
          originalContent = await readFile(fullPath, 'utf-8');
        } catch {
          // File doesn't exist yet, that's OK
          originalContent = '';
        }

        // Apply patch for this file
        try {
          const applied = applyPatch(originalContent, filePatch as any);
          if (!applied) {
            throw new Error('Patch returned no changes');
          }

          // Ensure directory exists
          const dir = fullPath.replace(/[\\/][^\\/]*$/, '');
          await mkdir(dir, { recursive: true });

          await writeFile(fullPath, applied);
          this.logger.info(`✅ Applied changes to ${file}`);
        } catch (e: any) {
          this.logger.error(`❌ Failed to apply patch to ${file}:`, e.message);
          result.errors[file] = e.message;
          result.success = false;
        }
      }

      // After processing all files, check if any were actually patched
      if (filesPatched === 0) {
        this.logger.error('❌ No files were patched (all patches were empty)');
        result.success = false;
        result.errors['_global'] = 'No files were actually modified';
      }
      return result;
    } catch (e: any) {
      this.logger.error('❌ Diff application failed:', e.message);
      result.success = false;
      result.errors['_global'] = e.message;
      return result;
    }
  }

  /**
   * Rollback all changes from a specific level
   */
  async rollback(level: number): Promise<boolean> {
    const entry = this.history.find(e => e.level === level && e.applied);
    if (!entry) {
      this.logger.error(`❌ No applied evolution at level ${level}`);
      return false;
    }

    try {
      // Restore each file from backup
      for (const [file, backupPath] of Object.entries(entry.backupPaths)) {
        try {
          const content = await readFile(backupPath, 'utf-8');
          const targetPath = join(this.cwd, file);
          await writeFile(targetPath, content);
          this.logger.info(`🔄 Restored ${file} from backup`);
        } catch (e) {
          this.logger.error(`Failed to restore ${file}:`, e);
          // Continue with other files
        }
      }

      // Mark as rolled back
      entry.applied = false;
      this.logger.info(`✅ Rolled back level ${level}`);
      return true;
    } catch (e: any) {
      this.logger.error('❌ Rollback failed:', e.message);
      return false;
    }
  }

  /**
   * Record history entry
   */
  recordHistory(level: number, improvement: string, diff: string, affectedFiles: string[], backups: Record<string, string>) {
    const entry: MultiFileHistoryEntry = {
      level,
      timestamp: new Date(),
      improvement,
      diff,
      affectedFiles,
      backupPaths: backups,
      applied: true,
    };
    this.history.push(entry);
    this.logger.info(`📚 Recorded evolution history entry #${level}`);
  }

  /**
   * Get history
   */
  getHistory(): MultiFileHistoryEntry[] {
    return [...this.history];
  }

  /**
   * Save history to disk
   */
  async saveHistory(): Promise<void> {
    try {
      await this.ensureBackupDir();
      const historyFile = join(this.backupDir, 'history.json');
      await writeFile(historyFile, JSON.stringify(this.history, null, 2));
    } catch (e) {
      this.logger.warn('Failed to save history: ' + e);
    }
  }

  /**
   * Load history from disk
   */
  async loadHistory(): Promise<void> {
    try {
      const historyFile = join(this.backupDir, 'history.json');
      const content = await readFile(historyFile, 'utf-8');
      this.history = JSON.parse(content);
    } catch {
      this.history = [];
    }
  }

  /**
   * Clean up old backup files
   */
  async cleanupBackups(): Promise<void> {
    try {
      const files = await readdir(this.backupDir).catch(() => []);
      // Filter backup files (timestamp-*.bak)
      const backupFiles = files
        .filter(f => /^\d+-.+\.bak$/.test(f))
        .map(f => ({ name: f, path: join(this.backupDir, f) }))
        .sort((a, b) => b.name.localeCompare(a.name)); // newest first

      if (backupFiles.length <= this.maxBackups) return;

      // Delete oldest
      const toDelete = backupFiles.slice(this.maxBackups);
      for (const file of toDelete) {
        await unlink(file.path).catch(() => {});
        this.logger.debug(`🗑️ Deleted old backup: ${file.name}`);
      }
    } catch (e) {
      this.logger.warn('Backup cleanup failed: ' + e);
    }
  }
}

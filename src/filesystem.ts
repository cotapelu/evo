// filesystem.ts - Sandboxed File System Module
// Provides secure file operations within allowed directories

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface FileSystemConfig {
  basePath?: string;
  allowedPaths?: string[];
  blockedOperations?: string[];
}

export class FileSystem {
  private basePath: string;
  private allowedPaths: string[];
  private blockedOps: string[];

  constructor(config: FileSystemConfig = {}) {
    this.basePath = config.basePath || __dirname;
    this.allowedPaths = config.allowedPaths || [this.basePath];
    this.blockedOps = config.blockedOperations || ['/etc/', '/sys/', '/proc/', 'C:\\Windows\\', 'C:\\Program Files'];
  }

  private validate(filePath: string): { valid: boolean; reason?: string } {
    const fullPath = path.resolve(this.basePath, filePath);
    if (!this.isWithinSandbox(fullPath)) {
      return { valid: false, reason: 'Access denied: path outside allowed directories' };
    }
    for (const blocked of this.blockedOps) {
      if (fullPath.includes(blocked)) {
        return { valid: false, reason: `Blocked operation: ${blocked}` };
      }
    }
    return { valid: true };
  }

  private isWithinSandbox(filePath: string): boolean {
    try {
      const resolved = path.resolve(filePath);
      return this.allowedPaths.some(allowed => resolved.startsWith(path.resolve(allowed)));
    } catch {
      return false;
    }
  }

  readFile(filePath: string, encoding: BufferEncoding = 'utf-8'): string {
    const validation = this.validate(filePath);
    if (!validation.valid) {
      throw new Error(`FileSystem.readFile denied: ${validation.reason}`);
    }
    const fullPath = path.resolve(this.basePath, filePath);
    return fs.readFileSync(fullPath, { encoding });
  }

  writeFile(filePath: string, content: string): void {
    const validation = this.validate(filePath);
    if (!validation.valid) {
      throw new Error(`FileSystem.writeFile denied: ${validation.reason}`);
    }
    const fullPath = path.resolve(this.basePath, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf-8');
  }

  exists(filePath: string): boolean {
    try {
      const validation = this.validate(filePath);
      if (!validation.valid) return false;
      const fullPath = path.resolve(this.basePath, filePath);
      return fs.existsSync(fullPath);
    } catch {
      return false;
    }
  }

  listFiles(dirPath: string): string[] {
    const validation = this.validate(dirPath);
    if (!validation.valid) {
      throw new Error(`FileSystem.listFiles denied: ${validation.reason}`);
    }
    const fullPath = path.resolve(this.basePath, dirPath);
    if (!fs.existsSync(fullPath)) return [];
    return fs.readdirSync(fullPath);
  }

  appendFile(filePath: string, content: string): void {
    const validation = this.validate(filePath);
    if (!validation.valid) {
      throw new Error(`FileSystem.appendFile denied: ${validation.reason}`);
    }
    const fullPath = path.resolve(this.basePath, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(fullPath, content, 'utf-8');
  }

  deleteFile(filePath: string): void {
    const validation = this.validate(filePath);
    if (!validation.valid) {
      throw new Error(`FileSystem.deleteFile denied: ${validation.reason}`);
    }
    const fullPath = path.resolve(this.basePath, filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  mkdir(dirPath: string): void {
    const validation = this.validate(dirPath);
    if (!validation.valid) {
      throw new Error(`FileSystem.mkdir denied: ${validation.reason}`);
    }
    const fullPath = path.resolve(this.basePath, dirPath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }

  getStats(filePath: string): { size: number; mtime: string; isFile: boolean; isDirectory: boolean } | null {
    try {
      const validation = this.validate(filePath);
      if (!validation.valid) return null;
      const fullPath = path.resolve(this.basePath, filePath);
      const stat = fs.statSync(fullPath);
      return {
        size: stat.size,
        mtime: stat.mtime.toISOString(),
        isFile: stat.isFile(),
        isDirectory: stat.isDirectory()
      };
    } catch {
      return null;
    }
  }

  readdirStats(dirPath: string): Array<{ name: string; stats: { size: number; mtime: string; isFile: boolean } }> {
    try {
      const validation = this.validate(dirPath);
      if (!validation.valid) return [];
      const fullPath = path.resolve(this.basePath, dirPath);
      if (!fs.existsSync(fullPath)) return [];
      const entries = fs.readdirSync(fullPath, { withFileTypes: true });
      return entries.map(entry => {
        const full = path.join(fullPath, entry.name);
        try {
          const stat = fs.statSync(full);
          return {
            name: entry.name,
            stats: {
              size: stat.size,
              mtime: stat.mtime.toISOString(),
              isFile: entry.isFile()
            }
          };
        } catch {
          return { name: entry.name, stats: { size: 0, mtime: '', isFile: false } };
        }
      });
    } catch {
      return [];
    }
  }

  // Backup original file
  backup(filePath: string, suffix?: string): string {
    const validation = this.validate(filePath);
    if (!validation.valid) {
      throw new Error(`FileSystem.backup denied: ${validation.reason}`);
    }
    const fullPath = path.resolve(this.basePath, filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`FileSystem.backup: file not found: ${filePath}`);
    }
    const backupPath = `${fullPath}.backup.${suffix || Date.now()}`;
    fs.copyFileSync(fullPath, backupPath);
    return backupPath;
  }

  // Rotate logs - keep last N files
  rotateLogs(logPath: string, keepCount: number = 5): void {
    const dir = path.dirname(path.resolve(this.basePath, logPath));
    const baseName = path.basename(logPath);
    try {
      const files = this.listFiles(dir).filter(f => f.startsWith(baseName) && f !== baseName);
      if (files.length >= keepCount) {
        const sorted = files.sort((a, b) => {
          const aTime = this.getStats(path.join(dir, a))?.mtime || '';
          const bTime = this.getStats(path.join(dir, b))?.mtime || '';
          return aTime.localeCompare(bTime);
        });
        const toDelete = sorted.slice(0, sorted.length - keepCount + 1);
        for (const file of toDelete) {
          try {
            this.deleteFile(path.join(dir, file));
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore rotation errors
    }
  }
}

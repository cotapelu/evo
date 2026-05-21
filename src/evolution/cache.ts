/**
 * File cache for incremental scanning
 *
 * Stores file content, mtime, and size to avoid re-reading unchanged files.
 * Cache persisted to .evo-cache/manifest.json in project root.
 */

import { readFile, stat, writeFile, mkdir } from 'fs/promises';
import { join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = __filename.split('/').slice(0, -1).join('/');

interface CacheEntry {
  content: string;
  mtime: number;
  size: number;
}

class FileCache {
  private cache: Map<string, CacheEntry> = new Map();
  private cachePath: string;
  private dirty: boolean = false;
  public maxSize: number = 1000;

  constructor(cacheDir?: string, maxSize: number = 1000) {
    this.cachePath = join(cacheDir || process.cwd(), '.evo-cache', 'manifest.json');
    if (maxSize > 0) this.maxSize = maxSize;
  }

  async load(): Promise<void> {
    try {
      const data = await readFile(this.cachePath, 'utf-8');
      const parsed = JSON.parse(data);
      for (const [path, entry] of Object.entries(parsed)) {
        this.cache.set(path, entry as CacheEntry);
      }
      console.log(`📦 Loaded cache: ${this.cache.size} entries`);
    } catch (err) {
      // Cache doesn't exist or is invalid - start fresh
      this.cache.clear();
    }
  }

  async save(): Promise<void> {
    if (!this.dirty) return;
    try {
      // Take a snapshot to avoid holding the map during async I/O
      const snapshot = new Map(this.cache);
      const obj: Record<string, CacheEntry> = {};
      for (const [path, entry] of snapshot) {
        obj[path] = entry;
      }
      await mkdir(join(this.cachePath, '..'), { recursive: true });
      await writeFile(this.cachePath, JSON.stringify(obj, null, 2));
      this.dirty = false;
    } catch (err) {
      console.warn('Failed to save cache:', err);
    }
  }

  async get(filePath: string, statResult?: any): Promise<string | null> {
    const absPath = resolve(filePath);

    if (statResult && this.cache.has(absPath)) {
      const cached = this.cache.get(absPath)!;
      // Compare mtime (to ms precision) and size
      if (cached.mtime === statResult.mtimeMs && cached.size === statResult.size) {
        return cached.content;
      }
    }

    return null;
  }

  set(filePath: string, content: string, statResult: any): void {
    const absPath = resolve(filePath);
    // Ensure we have valid stat; if missing, use zeros (will cause cache miss on get with proper stat)
    const mtime = statResult?.mtimeMs ?? 0;
    const size = statResult?.size ?? 0;
    this.cache.set(absPath, { content, mtime, size });
    this.dirty = true;
    // Evict oldest entries if over maxSize (FIFO using Map insertion order)
    while (this.cache.size > this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) break;
      this.cache.delete(oldestKey);
    }
  }

  invalidate(filePath: string): void {
    const absPath = resolve(filePath);
    this.cache.delete(absPath);
    this.dirty = true;
  }

  clear(): void {
    this.cache.clear();
    this.dirty = true;
  }

  get size(): number {
    return this.cache.size;
  }
}

export { FileCache, type CacheEntry };

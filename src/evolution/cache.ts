/**
 * File cache for incremental scanning
 *
 * Stores file content, mtime, and size to avoid re-reading unchanged files.
 * Cache persisted to .evo-cache/manifest.json in project root.
 */

import { readFile, stat, writeFile, mkdir } from 'fs/promises';
import { join, relative } from 'path';
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

  constructor(cacheDir?: string) {
    this.cachePath = join(cacheDir || process.cwd(), '.evo-cache', 'manifest.json');
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
      const obj: Record<string, CacheEntry> = {};
      for (const [path, entry] of this.cache) {
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
    const relPath = relative(process.cwd(), filePath);

    if (statResult && this.cache.has(relPath)) {
      const cached = this.cache.get(relPath)!;
      // Compare mtime (to ms precision) and size
      if (cached.mtime === statResult.mtimeMs && cached.size === statResult.size) {
        return cached.content;
      }
    }

    return null;
  }

  set(filePath: string, content: string, statResult: any): void {
    const relPath = relative(process.cwd(), filePath);
    this.cache.set(relPath, {
      content,
      mtime: statResult.mtimeMs,
      size: statResult.size
    });
    this.dirty = true;
  }

  invalidate(filePath: string): void {
    const relPath = relative(process.cwd(), filePath);
    this.cache.delete(relPath);
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

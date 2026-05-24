/**
 * File cache for incremental scanning
 *
 * Stores file content, mtime, and size to avoid re-reading unchanged files.
 * Cache persisted to .evo-cache/manifest.json in project root.
 * Uses LRU eviction policy when maxSize is exceeded.
 */

import { readFile, writeFile, mkdir, copyFile, rename, unlink } from 'fs/promises';
import { join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = __filename.split('/').slice(0, -1).join('/');

interface CacheEntry {
  content: string;
  mtime: number;
  size: number;
  lastAccessed: number; // Unix timestamp in ms, used for LRU eviction
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

  async load(): Promise<boolean> {
    try {
      const data = await readFile(this.cachePath, 'utf-8');
      const parsed = JSON.parse(data);
      this.cache.clear();
      for (const [path, entry] of Object.entries(parsed)) {
        // Ensure lastAccessed is initialized; if missing from old cache, set to Date.now()
        const cacheEntry = entry as CacheEntry;
        if (typeof cacheEntry.lastAccessed !== 'number') {
          cacheEntry.lastAccessed = Date.now();
        }
        this.cache.set(path, cacheEntry);
      }
      console.log(`📦 Loaded cache: ${this.cache.size} entries`);
      return true;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        this.cache.clear();
        return false;
      }
      console.warn('Failed to load cache:', err);
      this.cache.clear();
      return false;
    }
  }

  async save(): Promise<void> {
    if (!this.dirty) return;
    try {
      const snapshot = new Map(this.cache);
      const obj: Record<string, CacheEntry> = {};
      for (const [path, entry] of snapshot) {
        obj[path] = entry;
      }
      const data = JSON.stringify(obj, null, 2);
      await mkdir(join(this.cachePath, '..'), { recursive: true });

      // Write to a temp file then atomically rename
      const tmp = `${this.cachePath}.tmp.${Date.now()}.${process.pid}.json`;
      await writeFile(tmp, data, 'utf-8');
      await rename(tmp, this.cachePath);

      // Create/update backup with the new manifest
      await copyFile(this.cachePath, `${this.cachePath}.bak`);

      this.dirty = false;
    } catch (err) {
      console.warn('Failed to save cache:', err);
    }
  }

  async get(filePath: string, statResult?: any): Promise<string | null> {
    const absPath = resolve(filePath);

    if (statResult && this.cache.has(absPath)) {
      const entry = this.cache.get(absPath)!;
      // Compare mtime (to ms precision) and size
      if (entry.mtime === statResult.mtimeMs && entry.size === statResult.size) {
        // Update lastAccessed timestamp for LRU
        entry.lastAccessed = Date.now();
        this.dirty = true; // mark dirty to persist updated timestamps
        return entry.content;
      }
    }

    return null;
  }

  set(filePath: string, content: string, statResult?: any): void {
    const absPath = resolve(filePath);
    // Ensure we have valid stat; if missing, use zeros (will cause cache miss on get with proper stat)
    const mtime = statResult?.mtimeMs ?? 0;
    const size = statResult?.size ?? 0;
    const now = Date.now();
    this.cache.set(absPath, { content, mtime, size, lastAccessed: now });
    this.dirty = true;

    // Evict least recently used entries if over maxSize
    if (this.cache.size > this.maxSize) {
      this.evictLRU();
    }
  }

  private evictLRU(): void {
    if (this.cache.size <= this.maxSize) return;

    // Find entry with smallest lastAccessed (oldest)
    let lruKey: string | null = null;
    let lruTime = Infinity;
    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }
    if (lruKey !== null) {
      this.cache.delete(lruKey);
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

  async clearPersistence(): Promise<void> {
    // Remove both manifest and backup if they exist
    try { await unlink(this.cachePath); } catch {}
    try { await unlink(`${this.cachePath}.bak`); } catch {}
  }

  get size(): number {
    return this.cache.size;
  }
}

export { FileCache, type CacheEntry };
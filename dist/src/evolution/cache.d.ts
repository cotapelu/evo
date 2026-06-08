/**
 * File cache for incremental scanning
 *
 * Stores file content, mtime, and size to avoid re-reading unchanged files.
 * Cache persisted to .evo-cache/manifest.json in project root.
 * Uses LRU eviction policy when maxSize is exceeded.
 */
interface CacheEntry {
    content: string;
    mtime: number;
    size: number;
    lastAccessed: number;
}
/** Minimal file stat information needed for cache validation */
interface FileStat {
    mtimeMs: number;
    size: number;
}
declare class FileCache {
    private cache;
    private cachePath;
    private dirty;
    maxSize: number;
    constructor(cacheDir?: string, maxSize?: number);
    load(): Promise<boolean>;
    save(): Promise<void>;
    get(filePath: string, statResult?: FileStat): Promise<string | null>;
    set(filePath: string, content: string, statResult?: FileStat): void;
    private evictLRU;
    invalidate(filePath: string): void;
    clear(): void;
    clearPersistence(): Promise<void>;
    get size(): number;
}
export { FileCache, type CacheEntry };
//# sourceMappingURL=cache.d.ts.map
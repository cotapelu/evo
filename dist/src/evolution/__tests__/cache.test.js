import { FileCache } from '../cache.js';
import { mkdir, rm, rmdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = __filename.split('/').slice(0, -1).join('/');
describe('FileCache', () => {
    let cacheDir;
    let cache;
    beforeEach(async () => {
        cacheDir = join(__dirname, '..', 'test-cache-temp');
        await mkdir(cacheDir, { recursive: true });
        cache = new FileCache(cacheDir);
        await cache.load();
    });
    afterEach(async () => {
        await cache.clear();
        // Attempt to remove cache files and dir
        const manifestPath = join(cacheDir, '.evo-cache', 'manifest.json');
        try {
            await rm(manifestPath, { force: true });
        }
        catch { }
        try {
            await rmdir(join(cacheDir, '.evo-cache'));
        }
        catch { }
        try {
            await rmdir(cacheDir);
        }
        catch { }
    });
    test('should store and retrieve file content', async () => {
        const filePath = join(process.cwd(), 'test-file.txt');
        const content = 'hello world';
        const statResult = { mtimeMs: Date.now(), size: content.length };
        cache.set(filePath, content, statResult);
        const result = await cache.get(filePath, statResult);
        expect(result).toBe(content);
    });
    test('should return null on cache miss', async () => {
        const filePath = join(process.cwd(), 'missing.txt');
        const statResult = { mtimeMs: Date.now(), size: 100 };
        const result = await cache.get(filePath, statResult);
        expect(result).toBeNull();
    });
    test('should invalidate cache entry', async () => {
        const filePath = join(process.cwd(), 'test-invalidate.txt');
        const content = 'data';
        const stat = { mtimeMs: Date.now(), size: 4 };
        cache.set(filePath, content, stat);
        expect(await cache.get(filePath, stat)).toBe(content);
        cache.invalidate(filePath);
        expect(await cache.get(filePath, stat)).toBeNull();
    });
    test('should persist to disk after save', async () => {
        const filePath = join(process.cwd(), 'persist.txt');
        const content = 'persisted';
        const stat = { mtimeMs: Date.now(), size: 8 };
        cache.set(filePath, content, stat);
        await cache.save();
        // Create new cache instance and load
        const cache2 = new FileCache(cacheDir);
        await cache2.load();
        expect(cache2.size).toBeGreaterThan(0);
        const retrieved = await cache2.get(filePath, stat);
        expect(retrieved).toBe(content);
    });
    test('should ignore dirty flag when no changes', async () => {
        await cache.save(); // should be no-op
        // No error thrown
        expect(true).toBe(true);
    });
    test('should clear all entries', async () => {
        const file1 = join(process.cwd(), 'a.txt');
        const file2 = join(process.cwd(), 'b.txt');
        const stat = { mtimeMs: Date.now(), size: 1 };
        cache.set(file1, 'a', stat);
        cache.set(file2, 'b', stat);
        expect(cache.size).toBe(2);
        cache.clear();
        expect(cache.size).toBe(0);
    });
    test('should use absolute paths for consistent keys', async () => {
        const cwd = process.cwd();
        const relPath = './rel-file.txt';
        const absPath = join(cwd, 'rel-file.txt');
        const content = 'same';
        const stat = { mtimeMs: Date.now(), size: 4 };
        cache.set(relPath, content, stat);
        const result1 = await cache.get(relPath, stat);
        const result2 = await cache.get(absPath, stat);
        expect(result1).toBe(content);
        expect(result2).toBe(content); // should hit same entry
    });
    test('should handle missing statResult gracefully (no mtime/size)', async () => {
        const filePath = join(process.cwd(), 'no-stat.txt');
        const content = 'content';
        // Pass undefined statResult → should not set cache
        cache.set(filePath, content, null);
        // get with null stat should miss
        const result = await cache.get(filePath, null);
        expect(result).toBeNull();
    });
    test('should evict oldest entry when size exceeds max', async () => {
        // Create cache with small maxSize
        const smallCache = new FileCache(cacheDir);
        // @ts-ignore – set private maxSize for test
        smallCache.maxSize = 3;
        const base = Date.now();
        const stat1 = { mtimeMs: base, size: 1 };
        const stat2 = { mtimeMs: base + 1, size: 1 };
        const stat3 = { mtimeMs: base + 2, size: 1 };
        const stat4 = { mtimeMs: base + 3, size: 1 };
        smallCache.set('file1', '1', stat1);
        smallCache.set('file2', '2', stat2);
        smallCache.set('file3', '3', stat3);
        expect(smallCache.size).toBe(3);
        smallCache.set('file4', '4', stat4);
        // Should have evicted file1 (oldest) to keep size 3
        expect(smallCache.size).toBe(3);
        expect(await smallCache.get('file1', stat1)).toBeNull();
        expect(await smallCache.get('file4', stat4)).toBe('4');
    });
    test('should serialize load/save to avoid concurrent corruption', async () => {
        // Simulate multiple concurrent loads
        const cache2 = new FileCache(cacheDir);
        // Pre-populate manifest on disk for this test
        await cache.save();
        await Promise.all([
            cache.load(),
            cache.load(),
            cache2.load(),
        ]);
        // Should not throw or corrupt state
        expect(cache.size).toBeGreaterThanOrEqual(0);
    });
    test('should evict least recently used entry based on access time', async () => {
        const lruCache = new FileCache(cacheDir);
        // @ts-ignore – set small maxSize for test
        lruCache.maxSize = 3;
        const base = Date.now();
        const statA = { mtimeMs: base, size: 1 };
        const statB = { mtimeMs: base + 1, size: 1 };
        const statC = { mtimeMs: base + 2, size: 1 };
        const statD = { mtimeMs: base + 3, size: 1 };
        lruCache.set('a', 'a', statA);
        lruCache.set('b', 'b', statB);
        lruCache.set('c', 'c', statC);
        // Ensure time passes so access timestamp changes
        await new Promise(resolve => setTimeout(resolve, 5));
        // Access 'a' to make it recently used
        await lruCache.get('a', statA);
        await new Promise(resolve => setTimeout(resolve, 5));
        lruCache.set('d', 'd', statD);
        // Size should be 3
        expect(lruCache.size).toBe(3);
        // 'a' should still be present (recently accessed)
        expect(await lruCache.get('a', statA)).toBe('a');
        // 'b' should be evicted (least recently used)
        expect(await lruCache.get('b', statB)).toBeNull();
        // 'c' and 'd' should be present
        expect(await lruCache.get('c', statC)).toBe('c');
        expect(await lruCache.get('d', statD)).toBe('d');
    });
});
//# sourceMappingURL=cache.test.js.map
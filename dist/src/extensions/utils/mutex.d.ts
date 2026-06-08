/**
 * Async Mutex - Simple reentrancy-safe lock for async operations
 *
 * Provides a clean way to serialize async operations and prevent race conditions.
 * Usage:
 *   const mutex = new Mutex();
 *   const release = await mutex.lock();
 *   try {
 *     // critical section
 *   } finally {
 *     release();
 *   }
 */
export declare class Mutex {
    private locked;
    private queue;
    /**
     * Acquire the lock.
     * If available, returns release function immediately.
     * If locked, returns a promise that resolves when lock becomes available.
     */
    lock(): Promise<() => void>;
    private unlock;
}
//# sourceMappingURL=mutex.d.ts.map
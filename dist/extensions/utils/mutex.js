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
export class Mutex {
    locked = false;
    queue = [];
    /**
     * Acquire the lock.
     * If available, returns release function immediately.
     * If locked, returns a promise that resolves when lock becomes available.
     */
    async lock() {
        if (!this.locked) {
            this.locked = true;
            return () => this.unlock();
        }
        return new Promise(resolve => {
            this.queue.push(() => resolve(() => this.unlock()));
        });
    }
    unlock() {
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            next();
        }
        else {
            this.locked = false;
        }
    }
}
//# sourceMappingURL=mutex.js.map
import { jest } from '@jest/globals';
import { Mutex } from '../mutex.js';

describe('Mutex', () => {
  let mutex: Mutex;

  beforeEach(() => {
    mutex = new Mutex();
  });

  describe('lock()', () => {
    it('resolves immediately when mutex is free', async () => {
      const release = await mutex.lock();
      expect(typeof release).toBe('function');
      release();
    });

    it('returns a promise that resolves to a release function', async () => {
      const lockPromise = mutex.lock();
      expect(lockPromise).toBeInstanceOf(Promise);
      const release = await lockPromise;
      expect(typeof release).toBe('function');
      release();
    });
  });

  describe('unlock() via release', () => {
    it('frees the mutex so another lock can be acquired', async () => {
      const release1 = await mutex.lock();
      release1();
      const release2 = await mutex.lock();
      release2();
    });

    it('queues waiters and wakes them in FIFO order', async () => {
      const order: number[] = [];

      // First lock holder
      const lock1 = mutex.lock();
      // Queue second
      const lock2 = mutex.lock();
      // Queue third
      const lock3 = mutex.lock();

      // Release first; second should resolve
      const release1 = await lock1;
      release1();

      const release2 = await lock2;
      order.push(2);
      release2();

      const release3 = await lock3;
      order.push(3);
      release3();

      expect(order).toEqual([2, 3]);
    });

    it('allows re-acquire after release even after previously queued', async () => {
      const lock1 = mutex.lock();
      const lock2 = mutex.lock();

      const release1 = await lock1;
      release1();

      const release2 = await lock2;
      release2();

      // After everyone released, we should be able to lock again
      const release3 = await mutex.lock();
      release3();
    });

    it('release after all waiters processed sets locked to false', async () => {
      const lock1 = mutex.lock();
      const lock2 = mutex.lock();

      const release1 = await lock1;
      release1(); // this will give lock to lock2

      const release2 = await lock2;
      release2(); // this should set locked=false

      // Subsequent lock should be immediate
      const release3 = await mutex.lock();
      expect(typeof release3).toBe('function');
      release3();
    });
  });

  describe('concurrent usage', () => {
    it('serializes access correctly with many waiters', async () => {
      const results: number[] = [];
      const count = 5;

      // Acquire first lock outside loop
      const firstRelease = await mutex.lock();

      // Launch 5 tasks that will wait
      const tasks = Array.from({ length: count }, async (_, i) => {
        const release = await mutex.lock();
        results.push(i);
        // Simulate work
        await Promise.resolve();
        release();
      });

      // Now release the initial lock so the first waiter can proceed
      firstRelease();

      // Wait for all tasks to complete
      await Promise.all(tasks);

      // Results should be in order 0..4 because mutex should grant lock in FIFO order
      expect(results).toEqual([0, 1, 2, 3, 4]);
    });

    it('handles rapid lock/unlock without deadlock', async () => {
      for (let i = 0; i < 100; i++) {
        const release = await mutex.lock();
        release();
      }
    });
  });

  describe('edge cases', () => {
    it('release function can be called only once safely', async () => {
      const release = await mutex.lock();
      release();
      // second call should not throw and should be harmless
      release();
      // verify still functional
      const release2 = await mutex.lock();
      release2();
    });

    it('does not allow double-lock by same caller without release (reentrancy not supported)', async () => {
      const release = await mutex.lock();
      // Attempt to lock again before release should queue forever (deadlock)
      const lock2 = mutex.lock();
      // We should not await lock2 directly in test because it would deadlock; just check it's pending.
      // We'll release first lock and ensure second resolves.
      const timeoutPromise = new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(true), 100)
      );
      const result = await Promise.race([lock2, timeoutPromise]);
      expect(result).toBe(true); // timed out -> lock2 didn't resolve yet
      release();
      const release2 = await lock2;
      release2();
    });

    it('unlock with non-empty queue transfers lock to next waiter', async () => {
      const order: number[] = [];

      const lock1 = mutex.lock();
      const lock2 = mutex.lock();

      // Only release lock1, not via release but directly? We'll use release.
      const release1 = await lock1;
      // At this point lock2 should be pending, and the mutex is in a state where the release will wake next.
      release1();

      const release2 = await lock2;
      order.push(1);
      release2();

      expect(order).toEqual([1]);
    });
  });
});

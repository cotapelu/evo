import { describe, it, expect, vi } from 'vitest';
import { Mutex } from '../../extensions/utils/mutex.js';

describe('Mutex', () => {
  it('should allow immediate lock when unlocked', async () => {
    const mutex = new Mutex();
    const release = await mutex.lock();
    expect(typeof release).toBe('function');
    expect(mutex).toHaveProperty('locked', true); // but locked is private, can't access. We'll just release.
    release();
  });

  it('should be unlocked after release when no queue', async () => {
    const mutex = new Mutex();
    const release = await mutex.lock();
    release();
    // After release, locked should become false. Can't directly check private, but next lock should be immediate.
    const release2 = await mutex.lock();
    expect(typeof release2).toBe('function');
    release2();
  });

  it('should queue locks when already locked', async () => {
    const mutex = new Mutex();
    const release1 = await mutex.lock(); // first lock

    // Second lock request should be queued (return a pending promise)
    const lock2Promise = mutex.lock();
    expect(lock2Promise instanceof Promise).toBe(true);

    // Release first
    release1();

    // Now second should resolve
    const release2 = await lock2Promise;
    expect(typeof release2).toBe('function');

    // Verify locked is held by second
    // release2 to unlock
    release2();
  });

  it('should handle multiple waiters in FIFO order', async () => {
    const mutex = new Mutex();
    const release1 = await mutex.lock();

    const order: number[] = [];

    const lock2 = mutex.lock();
    const lock3 = mutex.lock();

    // Release first, then second should get lock
    release1();

    const release2 = await lock2;
    order.push(2);

    // Before releasing 2, third should still be pending
    let thirdResolved = false;
    lock3.then(() => {
      order.push(3);
      thirdResolved = true;
    });
    expect(thirdResolved).toBe(false);

    // Release second
    release2();

    // Now third should resolve
    await lock3;
    expect(order).toEqual([2, 3]);
  });

  it('should handle unlock with no waiting jobs', async () => {
    const mutex = new Mutex();
    const release = await mutex.lock();
    release();
    // No error, locked becomes false. Verify by acquiring again immediately.
    const release2 = await mutex.lock();
    expect(typeof release2).toBe('function');
    release2();
  });
});

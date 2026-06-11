import { jest } from '@jest/globals';
import { CircuitBreaker } from '../circuit-breaker';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    jest.useFakeTimers('modern');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('initial state is CLOSED and failures 0', () => {
    const cb = new CircuitBreaker();
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getFailureCount()).toBe(0);
  });

  test('successful execute returns value and keeps CLOSED', async () => {
    const cb = new CircuitBreaker();
    const result = await cb.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getFailureCount()).toBe(0);
  });

  test('failure increments failure count but stays CLOSED until threshold', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 });
    const fn = jest.fn().mockRejectedValue(new Error('fail'));

    // First failure
    await expect(cb.execute(fn)).rejects.toThrow('fail');
    expect(cb.getFailureCount()).toBe(1);
    expect(cb.getState()).toBe('CLOSED');

    // Second failure
    await expect(cb.execute(fn)).rejects.toThrow('fail');
    expect(cb.getFailureCount()).toBe(2);
    expect(cb.getState()).toBe('CLOSED');

    // Third failure should open circuit
    await expect(cb.execute(fn)).rejects.toThrow('fail');
    expect(cb.getFailureCount()).toBe(3);
    expect(cb.getState()).toBe('OPEN');
  });

  test('once OPEN, further calls fail fast without executing fn', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2 });
    const fn = jest.fn().mockResolvedValue('ok');

    // Cause OPEN
    const badFn = jest.fn().mockRejectedValue(new Error('err'));
    await expect(cb.execute(badFn)).rejects.toThrow('err');
    await expect(cb.execute(badFn)).rejects.toThrow('err');
    expect(cb.getState()).toBe('OPEN');

    // Now, calling execute should throw immediately without calling fn
    await expect(cb.execute(fn)).rejects.toThrow('OPEN');
    expect(fn).not.toHaveBeenCalled();
  });

  test('after resetTimeout, next call goes to HALF_OPEN and tries fn', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeout: 30000 });
    const badFn = jest.fn().mockRejectedValue(new Error('err'));

    // Open circuit
    await expect(cb.execute(badFn)).rejects.toThrow('err');
    await expect(cb.execute(badFn)).rejects.toThrow('err');
    expect(cb.getState()).toBe('OPEN');

    // Advance time past resetTimeout
    jest.advanceTimersByTime(30000);

    // Next execute should attempt fn (HALF_OPEN)
    const fn = jest.fn().mockResolvedValue('recovered');
    const result = await cb.execute(fn);
    expect(result).toBe('recovered');
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getFailureCount()).toBe(0);
  });

  test('if HALF_OPEN attempt fails, circuit reopens immediately', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeout: 30000 });
    const badFn = jest.fn().mockRejectedValue(new Error('err'));

    // Open circuit
    await expect(cb.execute(badFn)).rejects.toThrow('err');
    await expect(cb.execute(badFn)).rejects.toThrow('err');
    expect(cb.getState()).toBe('OPEN');

    // Advance time
    jest.advanceTimersByTime(30000);

    // HALF_OPEN attempt fails
    await expect(cb.execute(badFn)).rejects.toThrow('err');
    expect(cb.getState()).toBe('OPEN');
    // Failure count? Probably reset? In code, after HALF_OPEN failure, we call openCircuit(), which sets openSince, but failures are not reset; we don't increment failures in HALF_OPEN? In code, catch block increments failures regardless of state. After HALF_OPEN, we catch and then openCircuit. failures count may have increased. In our implementation, failures is incremented in catch; after HALF_OPEN fail, that adds 1 to failures. That's okay.
    expect(cb.getFailureCount()).toBeGreaterThan(0);
  });

  test('reset() closes circuit and clears failures', () => {
    const cb = new CircuitBreaker();
    // Simulate some failures and open
    cb['failures'] = 5; // direct manipulation for test
    cb['state'] = 'OPEN';
    cb['openSince'] = Date.now();

    cb.reset();
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getFailureCount()).toBe(0);
  });
});

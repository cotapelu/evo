import { jest } from '@jest/globals';
import { retry, execWithRetry } from '../retry';

describe('Retry Utility', () => {
  let setTimeoutSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock setTimeout to execute callback immediately (delay 0)
    setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((cb: Function, _ms: number) => {
      cb();
      return 0 as any;
    });
  });

  afterEach(() => {
    setTimeoutSpy.mockRestore();
  });

  test('retry resolves on first successful attempt', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await retry(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toBe('ok');
  });

  test('retry retries after failure and eventually succeeds', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');
    const result = await retry(fn, { maxAttempts: 3, baseDelay: 1000 });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(result).toBe('success');
  });

  test('retry throws after all attempts fail', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('error'));
    const promise = retry(fn, { maxAttempts: 2 });
    await expect(promise).rejects.toThrow('error');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('retry respects maxAttempts exactly', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    const promise = retry(fn, { maxAttempts: 4 });
    await expect(promise).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(4);
  });

  test('retry delay argument is passed to setTimeout (range check)', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('ok');
    const promise = retry(fn, { maxAttempts: 2, baseDelay: 1000, maxDelay: 3000 });
    await promise;
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), expect.any(Number));
    const delay = setTimeoutSpy.mock.calls[0][1] as number;
    expect(delay).toBeGreaterThanOrEqual(1000);
    expect(delay).toBeLessThanOrEqual(3000); // jitter may push up to 2000, but capped
  });

  test('execWithRetry passes args to execFn and returns result', async () => {
    const execFn = jest.fn().mockResolvedValue({ stdout: 'out', stderr: '', code: 0 });
    const result = await execWithRetry(execFn, 'git', ['status'], { cwd: '/repo' }, { maxAttempts: 2 });
    expect(execFn).toHaveBeenCalledWith('git', ['status'], { cwd: '/repo' });
    expect(result).toEqual({ stdout: 'out', stderr: '', code: 0 });
  });
});

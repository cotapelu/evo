import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the 'path' module before importing path-security
vi.mock('path', () => ({
  resolve: vi.fn()
}));

import { resolve } from 'path';
import { resolveSecurePath } from '../path-security.js';

describe('PathSecurity branch coverage - additional', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws with Invalid path message when second resolve throws', () => {
    const cwd = '/some/cwd';
    const userPath = 'badpath';
    // First resolve(cwd) should succeed; second resolve(absoluteCwd, userPath) throws
    (resolve as any).mockImplementation((path1: string, path2?: string) => {
      if (path2 === undefined) {
        return path1; // resolve for cwd
      }
      throw new Error('resolve error');
    });
    expect(() => resolveSecurePath(cwd, userPath)).toThrow('Invalid path: badpath');
  });

  it('detects parent directory reference in segments after prefix check', () => {
    const cwd = '/base';
    // Mock resolve for cwd to return '/base', and for the two-arg call to return '/base/..'
    (resolve as any).mockImplementation((path1: string, path2?: string) => {
      if (path2 === undefined) {
        // First call: resolve(cwd)
        return '/base';
      }
      // Second call: resolve(absoluteCwd, userPath)
      return '/base/..';
    });
    expect(() => resolveSecurePath(cwd, 'whatever')).toThrow("Access denied: path 'whatever' contains parent directory reference");
  });
});

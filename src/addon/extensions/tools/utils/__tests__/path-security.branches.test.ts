import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the 'path' module before importing path-security
vi.mock('path', () => ({
  resolve: vi.fn()
}));

import { resolve } from 'path';
import { resolveSecurePath, resolveSecurePaths } from '../path-security.js';

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

  it('returns resolved path when cwd and resolved path both already end with separator', () => {
    const cwd = '/base/';
    (resolve as any).mockImplementation((path1: string, path2?: string) => {
      if (path2 === undefined) return path1; // absoluteCwd = '/base/'
      return '/base/sub/';
    });
    expect(resolveSecurePath(cwd, 'sub/')).toBe('/base/sub/');
  });

  it('normalizes cwd without trailing separator and path without trailing separator', () => {
    const cwd = '/base';
    (resolve as any).mockImplementation((path1: string, path2?: string) => {
      if (path2 === undefined) return path1; // '/base' (no trailing slash)
      return '/base/sub';
    });
    expect(resolveSecurePath(cwd, 'sub')).toBe('/base/sub');
  });

  it('throws Invalid path for empty string and non-string userPath', () => {
    expect(() => resolveSecurePath('/base', '')).toThrow(/Invalid path/);
    expect(() => resolveSecurePath('/base', undefined as any)).toThrow(/Invalid path/);
    expect(() => resolveSecurePath('/base', null as any)).toThrow(/Invalid path/);
    expect(() => resolveSecurePath('/base', 123 as any)).toThrow(/Invalid path/);
  });

  it('resolveSecurePaths maps each path through resolveSecurePath', () => {
    (resolve as any).mockImplementation((path1: string, path2?: string) => {
      if (path2 === undefined) return path1; // cwd call
      return path2 === 'a' ? '/base/a' : '/base/b';
    });
    expect(resolveSecurePaths('/base', ['a', 'b'])).toEqual(['/base/a', '/base/b']);
  });

  it('resolveSecurePaths propagates errors from any element', () => {
    (resolve as any).mockImplementation((path1: string, path2?: string) => {
      if (path2 === undefined) return path1;
      if (path2 === 'bad') throw new Error('resolve error');
      return path2 === 'ok' ? '/base/ok' : '/base/other';
    });
    expect(() => resolveSecurePaths('/base', ['ok', 'bad', 'other'])).toThrow('Invalid path: bad');
  });
});

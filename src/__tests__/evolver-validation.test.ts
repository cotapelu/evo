import { Evolver } from '../evolution/evolver.js';
import { resolve, join } from 'path';
import { mkdir, rmdir, unlink, symlink as symlinkCreate } from 'fs/promises';
import { jest } from '@jest/globals';

describe('Evolver Validation', () => {
  let cleanup: (() => Promise<void>) | null = null;

  beforeEach(() => {
    jest.resetModules();
    cleanup = null;
  });

  afterEach(async () => {
    if (cleanup) {
      try { await cleanup(); } catch {}
    }
  });

  it('should throw when target directory is outside project root', async () => {
    const cwd = process.cwd();
    // Construct an absolute path that is outside cwd (sibling directory)
    const outside = resolve(cwd, '..', 'outside_test_dir_' + Date.now());
    const evolver = new Evolver(true); // dryRun to skip actual changes

    await expect(evolver.run(outside))
      .rejects.toThrow('Target directory must be within project root');
  });

  it('should accept target directory inside project root', async () => {
    const inside = resolve(process.cwd(), 'src');
    const evolver = new Evolver(true);
    // Should not throw (may find patterns but that's okay)
    await expect(evolver.run(inside)).resolves.toBeDefined();
  });

  it('should default to cwd/src when no target provided', async () => {
    const evolver = new Evolver(true);
    const result = await evolver.run();
    // Resolves without error; result should indicate success or no patterns
    expect(result).toHaveProperty('success');
  });

  it('should reject target directory that is a symlink pointing outside project root', async () => {
    const cwd = process.cwd();
    const outsideDir = resolve(cwd, '..', 'symlink_target_outside_' + Date.now());
    // Create the outside directory to point to
    await mkdir(outsideDir, { recursive: true });

    // Create a symlink inside project pointing outside
    const symlinkPath = join(cwd, 'symlink-to-outside');
    // Ensure any existing file/symlink is removed
    await unlink(symlinkPath).catch(() => {});
    await symlinkCreate(outsideDir, symlinkPath);

    // Register cleanup to run after test (even if assertion fails)
    cleanup = async () => {
      await unlink(symlinkPath).catch(() => {});
      await rmdir(outsideDir).catch(() => {});
    };

    const evolver = new Evolver(true);
    await expect(evolver.run(symlinkPath))
      .rejects.toThrow(/Target directory must be within project root/);
  });
});

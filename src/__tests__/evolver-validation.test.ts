import { Evolver } from '../evolution/evolver.js';
import { resolve } from 'path';
import { jest } from '@jest/globals';

describe('Evolver Validation', () => {
  beforeEach(() => {
    jest.resetModules();
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
});

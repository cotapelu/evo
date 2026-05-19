import { jest } from '@jest/globals';

describe('Evolver API', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should export Evolver class and evolve function', async () => {
    const module = await import('../evolution/evolver.js');

    expect(typeof module.Evolver).toBe('function');
    expect(typeof module.evolve).toBe('function');
  });

  it('should expose patterns from patterns module', async () => {
    const { patterns } = await import('../evolution/patterns.js');

    expect(Array.isArray(patterns)).toBe(true);
    expect(patterns.length).toBeGreaterThan(0);

    // Verify pattern structure
    const pattern = patterns[0];
    expect(pattern).toHaveProperty('id');
    expect(pattern).toHaveProperty('name');
    expect(pattern).toHaveProperty('description');
    expect(pattern).toHaveProperty('check');
    expect(pattern).toHaveProperty('fix');
    expect(pattern).toHaveProperty('severity');
  });
});

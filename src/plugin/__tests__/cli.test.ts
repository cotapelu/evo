import { vi, describe, it, expect } from 'vitest';

// Mock the pi-coding-agent main and extensions
vi.mock('@earendil-works/pi-coding-agent', async () => {
  const actual = await vi.importActual('@earendil-works/pi-coding-agent');
  return {
    ...actual,
    main: vi.fn().mockResolvedValue(undefined)
  };
});

vi.mock('../extensions/index', () => ({
  extensionFactories: []
}));

describe('cli', () => {
  it('initializes without throwing', async () => {
    // Importing cli runs top-level code which calls main.
    // The mock ensures main does nothing and doesn't throw.
    await import('../../cli');
    expect(true).toBe(true);
  });
});

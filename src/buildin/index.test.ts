import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before any imports
vi.mock('../deps.js', () => ({
  type: {},
  createBashToolDefinition: vi.fn(() => ({ name: 'mock-bash', description: 'mock', parameters: [] })),
}));

vi.mock('./tools/builtin-tools.js', () => ({
  registerAllBuiltinTools: vi.fn(() => []),
}));
vi.mock('./tools/custom-tools.js', () => ({
  registerAllCustomTools: vi.fn(() => []),
}));

vi.mock('./settings-manager.js', () => ({
  createServicesOptions: vi.fn(() => ({})),
}));

describe('buildin/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export registerAllBuiltinTools function', async () => {
    const index = await import('./index.js');
    expect(index.registerAllBuiltinTools).toBeDefined();
    expect(typeof index.registerAllBuiltinTools).toBe('function');
  });

  it('should export registerAllBuildinAndCustomTools function', async () => {
    const index = await import('./index.js');
    expect(index.registerAllBuildinAndCustomTools).toBeDefined();
    expect(typeof index.registerAllBuildinAndCustomTools).toBe('function');
  });

  it('should export createServicesOptions function', async () => {
    const index = await import('./index.js');
    expect(index.createServicesOptions).toBeDefined();
    expect(typeof index.createServicesOptions).toBe('function');
  });
});

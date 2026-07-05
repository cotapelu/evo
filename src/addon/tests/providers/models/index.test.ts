import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the generated models file
vi.mock('../../../extensions/providers/models/custom-models.generated.js', () => ({
  CUSTOM_MODELS: {
    testprovider: {
      modelA: { id: 'modelA' },
      modelB: { id: 'modelB' },
    },
  },
}));

import { getProviderModels, KILO_MODELS, KILO_MODELS_ALL } from '../../../extensions/providers/models/index.js';

describe('Provider Models Index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports KILO_MODELS', () => {
    expect(Array.isArray(KILO_MODELS)).toBe(true);
    // Should have at least one model
    expect(KILO_MODELS.length).toBeGreaterThan(0);
  });

  it('exports KILO_MODELS_ALL via getProviderModels("kilo")', () => {
    const models = getProviderModels('kilo');
    expect(models).toEqual(KILO_MODELS);
  });

  it('returns empty array for unknown provider (no generated models)', () => {
    const models = getProviderModels('unknown');
    expect(models).toEqual([]);
  });

  it('returns models from generated custom models if available', () => {
    // Because we mocked the generated module, for provider 'testprovider' it should return object values
    const models = getProviderModels('testprovider');
    expect(models.length).toBe(2);
    expect(models).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'modelA' }),
      expect.objectContaining({ id: 'modelB' }),
    ]));
  });

  it('KILO_MODELS_ALL is precomputed for kilo', () => {
    expect(KILO_MODELS_ALL).toEqual(KILO_MODELS);
  });
});

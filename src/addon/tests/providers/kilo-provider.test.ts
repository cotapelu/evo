import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

describe('Kilo Provider', () => {
  let mockApi: ExtensionAPI;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = { registerProvider: vi.fn() } as any;
    vi.resetModules(); // clear module cache between tests
  });

  it('registers with model-provided baseUrl when KILO_MODELS_ALL non-empty', async () => {
    vi.doMock('../../extensions/providers/models/index.js', () => ({
      KILO_MODELS_ALL: [
        { id: 'kilo-gpt', baseUrl: 'https://api.kilo.ai/v1' },
        { id: 'kilo-claude', baseUrl: 'https://api.kilo.ai/v2' },
      ],
    }));

    const { registerKiloProvider } = await import('../../extensions/providers/kilo-provider.js');
    registerKiloProvider(mockApi);

    expect(mockApi.registerProvider).toHaveBeenCalledWith('kilo', {
      baseUrl: 'https://api.kilo.ai/v1',
      apiKey: '$KILO_API_KEY',
      api: 'openai-completions',
      models: [
        { id: 'kilo-gpt', baseUrl: 'https://api.kilo.ai/v1' },
        { id: 'kilo-claude', baseUrl: 'https://api.kilo.ai/v2' },
      ],
    });
  });

  it('uses fallback baseUrl when KILO_MODELS_ALL empty', async () => {
    vi.doMock('../../extensions/providers/models/index.js', () => ({
      KILO_MODELS_ALL: [],
    }));

    const { registerKiloProvider } = await import('../../extensions/providers/kilo-provider.js');
    registerKiloProvider(mockApi);

    expect(mockApi.registerProvider).toHaveBeenCalledWith('kilo', {
      baseUrl: 'https://api.kilo.ai/api/gateway',
      apiKey: '$KILO_API_KEY',
      api: 'openai-completions',
      models: [],
    });
  });
});

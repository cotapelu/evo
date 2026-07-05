import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerProviderCommand } from '../../extensions/commands/provider-command.js';

// Mock @earendil-works/pi-tui
vi.mock('@earendil-works/pi-tui', () => {
  class Container {
    addChild = vi.fn();
    render = vi.fn(() => '');
    invalidate = vi.fn();
  }
  class Text {}
  class Spacer {}
  return { Container, Text, Spacer };
});

function createMockCtx(overrides: any = {}) {
  return {
    modelRegistry: {
      getAll: vi.fn(() => []),
      registerProvider: vi.fn(),
      unregisterProvider: vi.fn(),
      getAvailable: vi.fn(() => []),
    },
    ui: {
      notify: vi.fn(),
      custom: vi.fn(),
    },
    ...overrides,
  };
}

describe('Provider Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers command', () => {
    const api = { registerCommand: vi.fn() };
    registerProviderCommand(api);
    expect(api.registerCommand).toHaveBeenCalledWith('providers', expect.any(Object));
  });

  describe('list action', () => {
    it('shows no providers message when empty', async () => {
      const api = { registerCommand: vi.fn() };
      registerProviderCommand(api);
      const handler = api.registerCommand.mock.calls[0][1].handler;
      const ctx = createMockCtx({
        modelRegistry: { getAll: vi.fn(() => []) },
      });
      await handler('list', ctx);
      expect(ctx.ui.notify).toHaveBeenCalledWith('No providers registered', 'info');
    });

    it('lists providers with baseUrl and without', async () => {
      const api = { registerCommand: vi.fn() };
      registerProviderCommand(api);
      const handler = api.registerCommand.mock.calls[0][1].handler;
      const models = [
        { id: 'm1', provider: 'openai', providerBaseUrl: 'https://api.openai.com' },
        { id: 'm2', provider: 'anthropic', providerBaseUrl: undefined },
      ];
      const ctx = createMockCtx({
        modelRegistry: { getAll: vi.fn(() => models) },
      });
      await handler('list', ctx);
      // Should call ui.custom
      expect(ctx.ui.custom).toHaveBeenCalled();
      const [factory] = ctx.ui.custom.mock.calls[0];
      // Dummy theme
      const theme = {
        fg: (style: string, text: string) => text,
        bold: (text: string) => text,
      };
      const component = factory({} as any, theme, {} as any, () => {});
      // Call methods to exercise multiple functions
      component.render(80);
      component.invalidate();
      component.handleInput('test');
    });
  });

  describe('add action', () => {
    it('adds provider with required args', async () => {
      const api = { registerCommand: vi.fn() };
      registerProviderCommand(api);
      const handler = api.registerCommand.mock.calls[0][1].handler;
      const ctx = createMockCtx();
      await handler('add openai https://oa.com sk-123', ctx);
      expect(ctx.modelRegistry.registerProvider).toHaveBeenCalledWith('openai', {
        name: 'openai',
        baseUrl: 'https://oa.com',
        apiKey: 'sk-123',
      });
      expect(ctx.ui.notify).toHaveBeenCalledWith('Added provider openai', 'info');
    });

    it('shows usage if missing args', async () => {
      const api = { registerCommand: vi.fn() };
      registerProviderCommand(api);
      const handler = api.registerCommand.mock.calls[0][1].handler;
      const ctx = createMockCtx();
      await handler('add openai https://oa.com', ctx); // missing apiKey
      expect(ctx.ui.notify).toHaveBeenCalledWith('Usage: /providers add <name> <baseUrl> <apiKey>', 'error');
      expect(ctx.modelRegistry.registerProvider).not.toHaveBeenCalled();
    });
  });

  describe('remove action', () => {
    it('removes provider by name', async () => {
      const api = { registerCommand: vi.fn() };
      registerProviderCommand(api);
      const handler = api.registerCommand.mock.calls[0][1].handler;
      const ctx = createMockCtx();
      await handler('remove anthropic', ctx);
      expect(ctx.modelRegistry.unregisterProvider).toHaveBeenCalledWith('anthropic');
      expect(ctx.ui.notify).toHaveBeenCalledWith('Removed provider anthropic', 'info');
    });

    it('shows usage if missing name', async () => {
      const api = { registerCommand: vi.fn() };
      registerProviderCommand(api);
      const handler = api.registerCommand.mock.calls[0][1].handler;
      const ctx = createMockCtx();
      await handler('remove', ctx);
      expect(ctx.ui.notify).toHaveBeenCalledWith('Usage: /providers remove <name>', 'error');
      expect(ctx.modelRegistry.unregisterProvider).not.toHaveBeenCalled();
    });
  });

  describe('test action', () => {
    it('reports available models for provider', async () => {
      const api = { registerCommand: vi.fn() };
      registerProviderCommand(api);
      const handler = api.registerCommand.mock.calls[0][1].handler;
      const ctx = createMockCtx({
        modelRegistry: {
          getAvailable: vi.fn(() => [
            { provider: 'openai' },
            { provider: 'openai' },
            { provider: 'anthropic' },
          ]),
        },
      });
      await handler('test openai', ctx);
      expect(ctx.ui.notify).toHaveBeenCalledWith('openai OK: 2 models available', 'info');
    });

    it('warns when no available models', async () => {
      const api = { registerCommand: vi.fn() };
      registerProviderCommand(api);
      const handler = api.registerCommand.mock.calls[0][1].handler;
      const ctx = createMockCtx({
        modelRegistry: {
          getAvailable: vi.fn(() => [{ provider: 'other' }]),
        },
      });
      await handler('test openai', ctx);
      expect(ctx.ui.notify).toHaveBeenCalledWith('No available models for openai (auth required)', 'warning');
    });

    it('shows usage if missing provider name', async () => {
      const api = { registerCommand: vi.fn() };
      registerProviderCommand(api);
      const handler = api.registerCommand.mock.calls[0][1].handler;
      const ctx = createMockCtx();
      await handler('test', ctx);
      expect(ctx.ui.notify).toHaveBeenCalledWith('Usage: /providers test <name>', 'error');
    });
  });

  describe('unknown action', () => {
    it('shows error for unrecognized action', async () => {
      const api = { registerCommand: vi.fn() };
      registerProviderCommand(api);
      const handler = api.registerCommand.mock.calls[0][1].handler;
      const ctx = createMockCtx();
      await handler('unknown', ctx);
      expect(ctx.ui.notify).toHaveBeenCalledWith('Unknown action: unknown', 'error');
    });
  });
});

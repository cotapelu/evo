import { jest } from '@jest/globals';
import cancelCommand from '../cancel-command.js';

describe('Cancel Command', () => {
  let api: any;

  beforeEach(() => {
    api = { registerCommand: jest.fn() };
  });

  test('registers cancel command', () => {
    cancelCommand(api);
    expect(api.registerCommand).toHaveBeenCalledWith('cancel', expect.objectContaining({
      description: expect.any(String),
      handler: expect.any(Function)
    }));
  });

  test('handler calls abort when available and notifies', async () => {
    const mockAbort = jest.fn();
    const mockNotify = jest.fn();
    cancelCommand(api);
    const { handler } = api.registerCommand.mock.calls[0][1];
    await handler('', { abort: mockAbort, ui: { notify: mockNotify } } as any);
    expect(mockAbort).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith('✅ Cancelled', { type: 'info' });
  });

  test('handler notifies when abort not available', async () => {
    const mockNotify = jest.fn();
    cancelCommand(api);
    const { handler } = api.registerCommand.mock.calls[0][1];
    await handler('', { ui: { notify: mockNotify } } as any);
    expect(mockNotify).toHaveBeenCalledWith('❌ No abort mechanism available', { type: 'error' });
  });
});
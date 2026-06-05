import { jest } from '@jest/globals';
import aboutCommand from '../about-command.js';

describe('About Command', () => {
  let api: any;

  beforeEach(() => {
    api = { registerCommand: jest.fn() };
  });

  test('registers about command with correct metadata', () => {
    aboutCommand(api);
    expect(api.registerCommand).toHaveBeenCalledWith('about', expect.objectContaining({
      description: expect.any(String),
      handler: expect.any(Function)
    }));
  });

  test('handler calls notify with version info', async () => {
    const mockNotify = jest.fn();
    aboutCommand(api);
    const { handler } = api.registerCommand.mock.calls[0][1];
    await handler('', { cwd: process.cwd(), ui: { notify: mockNotify } } as any);
    expect(mockNotify).toHaveBeenCalledWith(expect.stringContaining('evo'), { type: 'info' });
    expect(mockNotify.mock.calls[0][0]).toMatch(/Pi Coding Agent SDK/);
    });

  test('handler shows error when package.json cannot be read', async () => {
    const mockNotify = jest.fn();
    aboutCommand(api);
    const { handler } = api.registerCommand.mock.calls[0][1];
    // Use a cwd that does not contain a package.json (e.g., root '/').
    const ctx = { cwd: '/', ui: { notify: mockNotify } } as any;
    await handler('', ctx);
    expect(mockNotify).toHaveBeenCalledWith(expect.stringContaining('could not read package.json'), { type: 'error' });
  });
});
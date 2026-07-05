import { describe, it, expect, vi } from 'vitest';

import sessionToolExtension from '../../extensions/session-tool/index.js';

describe('Session Tool Extension', () => {
  it('registers a session_start listener on initialization', () => {
    const mockApi = { on: vi.fn(), registerTool: vi.fn() };
    sessionToolExtension(mockApi);
    expect(mockApi.on).toHaveBeenCalledWith('session_start', expect.any(Function));
  });

  it('calls registerTool with session tool on session_start event', async () => {
    const mockApi = { on: vi.fn(), registerTool: vi.fn() };
    sessionToolExtension(mockApi);
    // Get the registered handler
    const [, handler] = mockApi.on.mock.calls[0];
    await handler(null as any, {} as any);
    expect(mockApi.registerTool).toHaveBeenCalledWith(expect.objectContaining({ name: 'session', execute: expect.any(Function) }));
  });
});

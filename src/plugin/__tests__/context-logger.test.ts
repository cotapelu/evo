#!/usr/bin/env node
/**
 * Context Logger Extension Tests
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  appendFileSync: vi.fn(),
}));

// Mock node:path with working implementations
vi.mock('node:path', () => ({
  dirname: vi.fn().mockImplementation(p => {
    // mimic path.dirname: return parent directory
    const parts = p.split(/[/\\]/).filter(Boolean);
    if (parts.length <= 1) return '/';
    parts.pop();
    return parts.join('/') || '/';
  }),
  join: vi.fn().mockImplementation((...parts) => parts.filter(Boolean).join('/')),
}));

// Mock pi-coding-agent
vi.mock('@earendil-works/pi-coding-agent', () => ({
  getAgentDir: vi.fn().mockReturnValue('/agent'),
}));

// Import mocked modules to configure if needed
import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getAgentDir } from '@earendil-works/pi-coding-agent';

// Now import the extension under test
import defaultExtension from '@extensions/context-logger';

function createMockAPI() {
  return {
    registerFlag: vi.fn(),
    on: vi.fn(),
    getFlag: vi.fn(),
  } as any;
}

describe('Context Logger Extension', () => {
  let api: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fs mock implementations to defaults
    existsSync.mockReturnValue(false);
    mkdirSync.mockClear();
    appendFileSync.mockClear();
    // getAgentDir mockReturnValue set in factory, but we can ensure consistent
    getAgentDir.mockReturnValue('/agent');
    api = createMockAPI();
  });

  it('registers flags', () => {
    defaultExtension(api);
    expect(api.registerFlag).toHaveBeenCalledWith('contextLogFile_plugin', expect.any(Object));
    expect(api.registerFlag).toHaveBeenCalledWith('contextLogAppend_plugin', expect.any(Object));
  });

  it('sets up before_provider_request hook', () => {
    defaultExtension(api);
    expect(api.on).toHaveBeenCalledWith('before_provider_request', expect.any(Function));
  });

  it('does not log if contextLogFile is explicitly empty', async () => {
    api.getFlag = vi.fn().mockReturnValue(''); // disables logging

    defaultExtension(api);
    const handler = api.on.mock.calls.find(([name]) => name === 'before_provider_request')[1] as Function;

    await handler({ payload: {} }, {} as any);
    expect(appendFileSync).not.toHaveBeenCalled();
  });

  it('writes log entry with context and model using default path', async () => {
    api.getFlag = vi.fn().mockReturnValue(undefined); // default

    defaultExtension(api);
    const handler = api.on.mock.calls.find(([name]) => name === 'before_provider_request')[1] as Function;

    const mockPayload = { model: 'gpt-4', context: [{ role: 'user', content: 'hi' }], options: {} };
    await handler({ payload: mockPayload }, {} as any);

    expect(existsSync).toHaveBeenCalled();
    expect(mkdirSync).toHaveBeenCalled();
    expect(appendFileSync).toHaveBeenCalled();
    const logContent = (appendFileSync as any).mock.calls[0][1];
    expect(logContent).toContain('gpt-4');
    expect(logContent).toContain('"role":"user"');
  });

  it('handles filesystem errors gracefully', async () => {
    existsSync.mockImplementation(() => { throw new Error('fs error'); });
    api.getFlag = vi.fn().mockReturnValue(undefined);

    defaultExtension(api);
    const handler = api.on.mock.calls.find(([name]) => name === 'before_provider_request')[1] as Function;

    // Should not throw
    await expect(handler({ payload: {} }, {} as any)).resolves.toBeUndefined();
  });
});

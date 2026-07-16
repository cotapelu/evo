import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock pi-tui to avoid rendering dependencies
vi.mock('@earendil-works/pi-tui', () => ({
  Text: class Text {
    constructor(public text: string, public x: number, public y: number) {}
  },
}));

// Mock the main SDK
vi.mock('@earendil-works/pi-coding-agent', async () => {
  const actual = await vi.importActual('@earendil-works/pi-coding-agent');
  return {
    ...actual,
    createReadToolDefinition: vi.fn(),
    createLsToolDefinition: vi.fn(),
    createFindToolDefinition: vi.fn(),
    createGrepToolDefinition: vi.fn(),
    createBashToolDefinition: vi.fn(),
  };
});

import {
  createReadToolDefinition,
  createLsToolDefinition,
  createFindToolDefinition,
  createGrepToolDefinition,
  createBashToolDefinition,
} from '@earendil-works/pi-coding-agent';

import { registerSubToolLoaderExtension } from '../../extensions/tools/subtool-loader.ts';
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';

// Helper to create a successful tool mock
function createSuccessTool(name: string) {
  return {
    execute: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: `${name} result` }],
      isError: false,
    }),
  };
}

describe('subtool_loader tool', () => {
  let mockApi: ExtensionAPI;
  let mockCtx: ExtensionContext;
  let tool: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default implementations for tool factories
    createReadToolDefinition.mockImplementation(() => createSuccessTool('read'));
    createLsToolDefinition.mockImplementation(() => createSuccessTool('ls'));
    createFindToolDefinition.mockImplementation(() => createSuccessTool('find'));
    createGrepToolDefinition.mockImplementation(() => createSuccessTool('grep'));
    createBashToolDefinition.mockImplementation(() => createSuccessTool('bash'));

    mockApi = {
      registerTool: vi.fn(),
      registerCommand: vi.fn(),
      exec: vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' }),
    } as any;

    mockCtx = {
      cwd: process.cwd(),
      signal: undefined,
      onUpdate: vi.fn(),
    } as any;

    // Register the extension
    registerSubToolLoaderExtension(mockApi);

    // Extract the tool from registerTool call
    expect(mockApi.registerTool).toHaveBeenCalledTimes(1);
    tool = mockApi.registerTool.mock.calls[0][0];
  });

  it('should have correct name and parameters', () => {
    expect(tool.name).toBe('subtool_loader');
    expect(tool.parameters).toEqual({
      type: 'object',
      properties: {
        subtool: { type: 'string', enum: ['http', 'ls', 'find', 'grep', 'read'], description: 'Sub-tool name' },
        args: { type: 'object', description: 'Arguments for the sub-tool' },
      },
      required: ['subtool', 'args'],
    });
  });

  it('execute: missing subtool param returns error', async () => {
    const result = await tool.execute('call-id', {}, mockCtx.signal, mockCtx.onUpdate, mockCtx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Missing required parameter: subtool');
  });

  it('execute: unknown subtool returns error', async () => {
    const result = await tool.execute('call-id', { subtool: 'invalid', args: {} }, mockCtx.signal, mockCtx.onUpdate, mockCtx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown sub-tool: invalid');
  });

  it('execute: read success', async () => {
    const result = await tool.execute('call-id', { subtool: 'read', args: { path: '/some/file' } }, mockCtx.signal, mockCtx.onUpdate, mockCtx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('read result');
    expect(createReadToolDefinition).toHaveBeenCalledWith(expect.any(String));
  });

  it('execute: ls success', async () => {
    const result = await tool.execute('call-id', { subtool: 'ls', args: { path: '/some' } }, mockCtx.signal, mockCtx.onUpdate, mockCtx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('ls result');
    expect(createLsToolDefinition).toHaveBeenCalledWith(expect.any(String));
  });

  it('execute: find success', async () => {
    const result = await tool.execute('call-id', { subtool: 'find', args: { pattern: '*.ts' } }, mockCtx.signal, mockCtx.onUpdate, mockCtx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('find result');
    expect(createFindToolDefinition).toHaveBeenCalledWith(expect.any(String), expect.any(Object));
  });

  it('execute: grep success', async () => {
    const result = await tool.execute('call-id', { subtool: 'grep', args: { pattern: 'test' } }, mockCtx.signal, mockCtx.onUpdate, mockCtx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('grep result');
    expect(createGrepToolDefinition).toHaveBeenCalledWith(expect.any(String), expect.any(Object));
  });

  it('execute: http missing url', async () => {
    const result = await tool.execute('call-id', { subtool: 'http', args: {} }, mockCtx.signal, mockCtx.onUpdate, mockCtx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Missing required parameter: url');
  });

  it('execute: http invalid url', async () => {
    const result = await tool.execute('call-id', { subtool: 'http', args: { url: 'not a url' } }, mockCtx.signal, mockCtx.onUpdate, mockCtx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid URL');
  });

  it('execute: http success with non-GET method', async () => {
    const result = await tool.execute('call-id', {
      subtool: 'http',
      args: { url: 'http://example.com', method: 'POST' }
    }, mockCtx.signal, mockCtx.onUpdate, mockCtx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('bash result');
  });

  it('execute: http success with headers', async () => {
    const result = await tool.execute('call-id', {
      subtool: 'http',
      args: { url: 'http://example.com', headers: { 'X-Test': 'value' } }
    }, mockCtx.signal, mockCtx.onUpdate, mockCtx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('bash result');
  });

  it('execute: http success with empty headers', async () => {
    const result = await tool.execute('call-id', {
      subtool: 'http',
      args: { url: 'http://example.com', headers: {} }
    }, mockCtx.signal, mockCtx.onUpdate, mockCtx);
    expect(result.isError).toBe(false);
  });

  it('execute: http success', async () => {
    const result = await tool.execute('call-id', {
      subtool: 'http',
      args: { url: 'http://example.com', method: 'GET' }
    }, mockCtx.signal, mockCtx.onUpdate, mockCtx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('bash result');
    expect(createBashToolDefinition).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ commandPrefix: '' }));
  });

  it('execute: underlying tool throws error', async () => {
    // Override read tool mock to throw
    createReadToolDefinition.mockImplementation(() => ({
      execute: vi.fn().mockRejectedValue(new Error('tool failed'))
    }));
    // Re-register to get a fresh tool definition that will use the new mock
    mockApi.registerTool.mockClear();
    registerSubToolLoaderExtension(mockApi);
    tool = mockApi.registerTool.mock.calls[0][0];

    const result = await tool.execute('call-id', { subtool: 'read', args: { path: '/file' } }, mockCtx.signal, mockCtx.onUpdate, mockCtx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error: tool failed');
  });

  it('execute: caching works per context', async () => {
    // First call should create tool
    const result1 = await tool.execute('call-id', { subtool: 'read', args: { path: '/file1' } }, mockCtx.signal, mockCtx.onUpdate, mockCtx);
    expect(result1.isError).toBe(false);
    expect(createReadToolDefinition).toHaveBeenCalledTimes(1);

    // Second call with same subtool should use cached tool (factory not called again)
    const result2 = await tool.execute('call-id-2', { subtool: 'read', args: { path: '/file2' } }, mockCtx.signal, mockCtx.onUpdate, mockCtx);
    expect(result2.isError).toBe(false);
    expect(createReadToolDefinition).toHaveBeenCalledTimes(1);
  });
});

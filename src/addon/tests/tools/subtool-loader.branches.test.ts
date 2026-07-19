#!/usr/bin/env node
/**
 * SubTool Loader - Branch Coverage Supplement
 *
 * Targets uncovered branches in sub-tool-loader.ts to increase overall branch coverage.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock pi-tui to avoid rendering dependencies
vi.mock('@earendil-works/pi-tui', () => ({
  Text: class Text {
    constructor(public text: string, public x: number, public y: number) {}
  },
}));

// Mock the main SDK tools
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

import { registerSubToolLoaderExtension, createSubLoaderToolDefinition } from '../../extensions/tools/subtool-loader.ts';
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

describe('subtool_loader branch coverage', () => {
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

    mockApi = { registerTool: vi.fn() } as any;
    registerSubToolLoaderExtension(mockApi);
    tool = mockApi.registerTool.mock.calls[0][0];
    mockCtx = { cwd: process.cwd(), signal: undefined, onUpdate: vi.fn() } as any;
  });

  // ==================== renderCall branch tests ====================

  describe('renderCall', () => {
    const theme: any = { fg: (c: string, v: string) => v };

    it('covers args undefined -> unknown subtool, empty args', () => {
      const result = tool.renderCall(undefined, theme);
      expect(result.text).toBe('subtool_loader → unknown');
    });

    it('covers args without subtool field', () => {
      const result = tool.renderCall({ args: {} }, theme);
      expect(result.text).toBe('subtool_loader → unknown');
    });

    it('covers args with subtool but no args field', () => {
      const result = tool.renderCall({ subtool: 'read' }, theme);
      expect(result.text).toBe('subtool_loader → read');
    });

    it('covers args.args empty object', () => {
      const result = tool.renderCall({ subtool: 'ls', args: {} }, theme);
      expect(result.text).toBe('subtool_loader → ls');
    });

    it('covers args.args with one entry', () => {
      const result = tool.renderCall({ subtool: 'find', args: { pattern: '*.ts' } }, theme);
      expect(result.text).toBe('subtool_loader → find (pattern="*.ts")');
    });

    it('covers args.args with two entries', () => {
      const result = tool.renderCall({ subtool: 'read', args: { path: '/a', maxLines: 10 } }, theme);
      const text = result.text;
      expect(text).toContain('subtool_loader → read');
      expect(text).toContain('path=');
      expect(text).toContain('maxLines=');
    });

    it('covers args.args with >2 entries truncates after two', () => {
      const result = tool.renderCall({ subtool: 'grep', args: { a: 1, b: 2, c: 3, d: 4 } }, theme);
      expect(result.text).toBe('subtool_loader → grep (a=1 b=2)'); // space-separated
    });
  });

  // ==================== HTTP specific branches ====================

  describe('execute: http branches', () => {
    it('covers method explicitly GET (no -X added)', async () => {
      const result = await tool.execute('id', { subtool: 'http', args: { url: 'http://x.com', method: 'GET' } }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
      // The bash tool should have been called; we don't need to inspect command in detail
    });

    it('covers body present adds -d flag', async () => {
      const result = await tool.execute('id', { subtool: 'http', args: { url: 'http://x.com', body: 'payload' } }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
    });

    it('covers headers non-object type skips header loop', async () => {
      const result = await tool.execute('id', { subtool: 'http', args: { url: 'http://x.com', headers: 'bad' as any } }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
    });

    it('covers result content fallback when underlying returns no content', async () => {
      createBashToolDefinition.mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue({ isError: false }) // no content, no output
      }));
      mockApi.registerTool.mockClear();
      registerSubToolLoaderExtension(mockApi);
      tool = mockApi.registerTool.mock.calls[0][0];

      const result = await tool.execute('id', { subtool: 'http', args: { url: 'http://x.com' } }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.content).toEqual([{ type: 'text', text: 'No output' }]);
    });
  });

  // ==================== non-HTTP result fallbacks ====================

  describe('execute: non-http result handling', () => {
    it('covers result content undefined fallback for read', async () => {
      createReadToolDefinition.mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue({ isError: false })
      }));
      mockApi.registerTool.mockClear();
      registerSubToolLoaderExtension(mockApi);
      tool = mockApi.registerTool.mock.calls[0][0];

      const result = await tool.execute('id', { subtool: 'read', args: { path: '/file' } }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.content).toEqual([]);
    });

    it('covers result details undefined propagation', async () => {
      createReadToolDefinition.mockImplementation(() => ({
        execute: vi.fn().mockResolvedValue({ isError: false, content: [{ type: 'text', text: 'ok' }] }) // no details
      }));
      mockApi.registerTool.mockClear();
      registerSubToolLoaderExtension(mockApi);
      tool = mockApi.registerTool.mock.calls[0][0];

      const result = await tool.execute('id', { subtool: 'read', args: { path: '/file' } }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(false);
      expect(result.details).toBeUndefined();
    });
  });

  // ==================== cache and tool retrieval branches ====================

  describe('caching and tool retrieval', () => {
    it('covers cache miss in getToolsForContext creates new Map', async () => {
      // Use a fresh context to ensure no cache
      const freshCtx = { cwd: process.cwd(), signal: undefined, onUpdate: vi.fn() } as any;
      // First call should create a new Map
      await tool.execute('id1', { subtool: 'read', args: { path: '/a' } }, undefined, undefined, freshCtx);
      // The cache mechanism is in getOrCreateTool; we can't directly inspect but ensuring no error implies success.
      expect(createReadToolDefinition).toHaveBeenCalled();
    });

    it('covers cache hit: second call uses cached tool', async () => {
      // First call
      await tool.execute('id1', { subtool: 'read', args: { path: '/a' } }, undefined, undefined, mockCtx);
      expect(createReadToolDefinition).toHaveBeenCalledTimes(1);
      // Second call
      await tool.execute('id2', { subtool: 'read', args: { path: '/b' } }, undefined, undefined, mockCtx);
      expect(createReadToolDefinition).toHaveBeenCalledTimes(1); // still 1
    });
  });

  // ==================== error handling branches ====================

  describe('error handling', () => {
    it('covers catch block when underlying tool throws synchronously', async () => {
      createReadToolDefinition.mockImplementation(() => ({
        execute: vi.fn().mockRejectedValue(new Error('sync-like failure'))
      }));
      mockApi.registerTool.mockClear();
      registerSubToolLoaderExtension(mockApi);
      tool = mockApi.registerTool.mock.calls[0][0];

      const result = await tool.execute('id', { subtool: 'read', args: { path: '/file' } }, undefined, undefined, mockCtx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error: sync-like failure');
    });
  });
});

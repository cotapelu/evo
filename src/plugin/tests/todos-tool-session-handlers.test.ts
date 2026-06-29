import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fs and path before importing the module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    rename: vi.fn(),
  }
}));
vi.mock('node:path', () => ({
  dirname: vi.fn(() => '/dir'),
  join: vi.fn(() => '/path/to/todos.json')
}));

// Import mocked modules to access mock functions
import * as fs from 'node:fs';
import * as path from 'node:path';

// Now import the module under test
import {
  TodoState,
  registerTodosTool,
} from '@extensions/tools/todos-tool.js';
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

const { existsSync, mkdirSync, promises } = fs;

describe('todos tool session event handlers', () => {
  let mockApi: any;
  let capturedTool: any;

  const createMockApi = () => ({
    registerTool: vi.fn((tool: any) => { capturedTool = tool; }),
    sendMessage: vi.fn(),
    on: vi.fn(),
  });

  const createMockCtx = (overrides: Partial<ExtensionContext> = {}): ExtensionContext => ({
    sessionManager: { getBranch: vi.fn().mockReturnValue([]) },
    hasUI: true,
    cwd: '/cwd',
    ...overrides,
  } as unknown as ExtensionContext);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(promises.mkdir).mockResolvedValue(undefined);
    vi.mocked(promises.readFile).mockResolvedValue('');
  });

  it('registers session_start and session_tree listeners', () => {
    mockApi = createMockApi();
    registerTodosTool(mockApi);
    expect(mockApi.on).toHaveBeenCalledWith('session_start', expect.any(Function));
    expect(mockApi.on).toHaveBeenCalledWith('session_tree', expect.any(Function));
  });

  describe('session_start', () => {
    let sessionStartListener: Function;

    beforeEach(() => {
      mockApi = createMockApi();
      registerTodosTool(mockApi);
      const calls = mockApi.on.mock.calls;
      const startCall = calls.find((c: any) => c[0] === 'session_start');
      sessionStartListener = startCall[1];
    });

    it('uses session storage when reconstructFromEntries returns true', async () => {
      const mockEntries = [
        {
          type: 'message',
          message: {
            role: 'toolResult',
            toolName: 'todos',
            details: { phases: [{ id: 'phase-1', name: 'P', tasks: [] }], nextTaskId: 1, nextPhaseId: 1 }
          }
        }
      ];
      const ctx = createMockCtx();
      ctx.sessionManager.getBranch = vi.fn().mockReturnValue(mockEntries);

      await sessionStartListener('session_start', ctx);

      const result = await capturedTool.execute('list', { list: true }, undefined, undefined, ctx);
      expect(result.details.storage).toBe('session');
    });

    it('loads from file when reconstruct returns false and file exists', async () => {
      const ctx = createMockCtx();
      ctx.sessionManager.getBranch = vi.fn().mockReturnValue([]);
      vi.mocked(existsSync).mockReturnValue(true);
      const fileData = { phases: [], nextTaskId: 1, nextPhaseId: 1, version: 1 };
      vi.mocked(promises.readFile).mockResolvedValue(JSON.stringify(fileData));

      await sessionStartListener('session_start', ctx);

      const result = await capturedTool.execute('list', { list: true }, undefined, undefined, ctx);
      expect(result.details.storage).toBe('file');
    });

    it('uses memory storage when no entries and no file', async () => {
      const ctx = createMockCtx();
      ctx.sessionManager.getBranch = vi.fn().mockReturnValue([]);
      vi.mocked(existsSync).mockReturnValue(false);

      await sessionStartListener('session_start', ctx);

      const result = await capturedTool.execute('list', { list: true }, undefined, undefined, ctx);
      expect(result.details.storage).toBe('memory');
    });

    it('falls back to memory if file load fails', async () => {
      const ctx = createMockCtx();
      ctx.sessionManager.getBranch = vi.fn().mockReturnValue([]);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(promises.readFile).mockRejectedValue(new Error('read error'));

      await sessionStartListener('session_start', ctx);

      const result = await capturedTool.execute('list', { list: true }, undefined, undefined, ctx);
      expect(result.details.storage).toBe('memory');
    });

    it('calls notify when loadFromFile succeeds', async () => {
      const notifySpy = vi.spyOn(TodoState.prototype, 'notify');
      const ctx = createMockCtx();
      ctx.sessionManager.getBranch = vi.fn().mockReturnValue([]);
      vi.mocked(existsSync).mockReturnValue(true);
      const fileData = { phases: [], nextTaskId: 1, nextPhaseId: 1, version: 1 };
      vi.mocked(promises.readFile).mockResolvedValue(JSON.stringify(fileData));

      await sessionStartListener('session_start', ctx);

      expect(notifySpy).toHaveBeenCalled();
      notifySpy.mockRestore();
    });
  });

  describe('session_tree', () => {
    let sessionTreeListener: Function;

    beforeEach(() => {
      mockApi = createMockApi();
      registerTodosTool(mockApi);
      const calls = mockApi.on.mock.calls;
      const treeCall = calls.find((c: any) => c[0] === 'session_tree');
      sessionTreeListener = treeCall[1];
    });

    it('uses session storage when reconstructFromEntries returns true', async () => {
      const mockEntries = [
        {
          type: 'message',
          message: {
            role: 'toolResult',
            toolName: 'todos',
            details: { phases: [{ id: 'phase-1', name: 'P', tasks: [] }], nextTaskId: 1, nextPhaseId: 1 }
          }
        }
      ];
      const ctx = createMockCtx();
      ctx.sessionManager.getBranch = vi.fn().mockReturnValue(mockEntries);

      await sessionTreeListener('session_tree', ctx);

      const result = await capturedTool.execute('list', { list: true }, undefined, undefined, ctx);
      expect(result.details.storage).toBe('session');
    });

    it('loads from file when reconstruct returns false and file exists', async () => {
      const ctx = createMockCtx();
      ctx.sessionManager.getBranch = vi.fn().mockReturnValue([]);
      vi.mocked(existsSync).mockReturnValue(true);
      const fileData = { phases: [], nextTaskId: 1, nextPhaseId: 1, version: 1 };
      vi.mocked(promises.readFile).mockResolvedValue(JSON.stringify(fileData));

      await sessionTreeListener('session_tree', ctx);

      const result = await capturedTool.execute('list', { list: true }, undefined, undefined, ctx);
      expect(result.details.storage).toBe('file');
    });

    it('uses memory storage when no entries and no file', async () => {
      const ctx = createMockCtx();
      ctx.sessionManager.getBranch = vi.fn().mockReturnValue([]);
      vi.mocked(existsSync).mockReturnValue(false);

      await sessionTreeListener('session_tree', ctx);

      const result = await capturedTool.execute('list', { list: true }, undefined, undefined, ctx);
      expect(result.details.storage).toBe('memory');
    });

    it('falls back to memory if file load fails', async () => {
      const ctx = createMockCtx();
      ctx.sessionManager.getBranch = vi.fn().mockReturnValue([]);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(promises.readFile).mockRejectedValue(new Error('read error'));

      await sessionTreeListener('session_tree', ctx);

      const result = await capturedTool.execute('list', { list: true }, undefined, undefined, ctx);
      expect(result.details.storage).toBe('memory');
    });

    it('calls notify when loadFromFile succeeds', async () => {
      const notifySpy = vi.spyOn(TodoState.prototype, 'notify');
      const ctx = createMockCtx();
      ctx.sessionManager.getBranch = vi.fn().mockReturnValue([]);
      vi.mocked(existsSync).mockReturnValue(true);
      const fileData = { phases: [], nextTaskId: 1, nextPhaseId: 1, version: 1 };
      vi.mocked(promises.readFile).mockResolvedValue(JSON.stringify(fileData));

      await sessionTreeListener('session_tree', ctx);

      expect(notifySpy).toHaveBeenCalled();
      notifySpy.mockRestore();
    });
  });
});

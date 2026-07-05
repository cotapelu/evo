import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import {
  operationPrepareChild,
  operationChildRead,
  operationChildWrite,
  operationParentRead,
  operationCompleteChild,
} from '../../../extensions/session-tool/operations/handoff.js';
import type { MultiSessionManager } from '../../../extensions/session-tool/manager.js';
import type { SessionMetadata } from '../../../extensions/session-tool/registry.js';

// Mock fs/promises (default import)
vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn(() => Promise.resolve()),
    writeFile: vi.fn(() => Promise.resolve()),
    readFile: vi.fn(() => Promise.resolve('file content')),
  }
}));

// Mock path (default import)
vi.mock('node:path', () => ({
  default: {
    join: vi.fn((...args) => args.join('/')),
    dirname: vi.fn((p) => p.replace(/\/[^/]+$/, '')),
  }
}));

// Mock buildHandoffBusPaths (relative path from operations/handoff.js)
vi.mock('../handoff.js', () => ({
  buildHandoffBusPaths: vi.fn((sessionId) => ({
    sessionId,
    busFile: `docs/session_handoffs/${sessionId}/bus.md`,
    outputFile: `docs/session_handoffs/${sessionId}/output.md`,
    statusFile: `docs/session_handoffs/${sessionId}/status.json`,
  }))
}));

function mockManager(overrides: Partial<MultiSessionManager> = {}): MultiSessionManager {
  return {
    createChild: vi.fn(async (opts) => ({
      id: 'child-123',
      name: opts.name ?? 'child',
      createdAt: new Date(),
      state: 'active',
      isActive: false,
      tags: opts.tags ?? [],
      filePath: '',
      parentId: null,
    })),
    getActive: vi.fn(() => null),
    get: vi.fn(() => null),
    addTags: vi.fn(async () => {}),
    ...overrides,
  } as any;
}

describe('Session Handoff Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('operationPrepareChild', () => {
    it('should throw if contract.mission missing', async () => {
      const mgr = mockManager();
      await expect(operationPrepareChild(mgr, { contract: {} })).rejects.toThrow('contract.mission is required');
    });

    it('should create child and write contract files', async () => {
      const mgr = mockManager();
      mgr.getActive = vi.fn(() => ({ id: 'parent-1' } as any));

      const result = await operationPrepareChild(mgr, {
        name: 'worker',
        tags: ['extra'],
        contract: {
          mission: 'Do work',
          allowedFiles: ['a.ts', 'b.ts'],
          outputPath: 'custom/out.md',
          doneCriteria: ['Step1', 'Step2'],
        },
      });

      expect(result.details).toMatchObject({
        operation: 'prepare_child',
        sessionId: expect.any(String),
        contractPath: expect.stringContaining('bus.md'),
        outputPath: 'custom/out.md',
      });
      expect(mgr.createChild).toHaveBeenCalledWith({
        name: 'worker',
        tags: expect.arrayContaining(['child', 'handoff', 'extra']),
      });
      // Two writes: contract bus and status
      expect(vi.mocked(fs).writeFile).toHaveBeenCalledTimes(2);
    });

    it('should handle missing optional fields', async () => {
      const mgr = mockManager();
      const result = await operationPrepareChild(mgr, {
        contract: { mission: 'Simple' },
      });

      expect(result.details.outputPath).toContain('output.md'); // default
    });
  });

  describe('operationChildRead', () => {
    it('should throw if no active session', async () => {
      const mgr = mockManager();
      mgr.getActive = vi.fn(() => null);
      await expect(operationChildRead(mgr, {})).rejects.toThrow('No active session');
    });

    it('should throw if contract file not found', async () => {
      const mgr = mockManager();
      mgr.getActive = vi.fn(() => ({ id: 'child-1' } as any));
      vi.mocked(fs).readFile.mockRejectedValueOnce(new Error('not found'));
      await expect(operationChildRead(mgr, {})).rejects.toThrow('Contract not found');
    });

    it('should read contract successfully', async () => {
      const mgr = mockManager();
      mgr.getActive = vi.fn(() => ({ id: 'child-1' } as any));
      vi.mocked(fs).readFile.mockResolvedValueOnce('# Contract');

      const result = await operationChildRead(mgr, {});

      expect(result.content[0].text).toBe('# Contract');
      expect(result.details.sessionId).toBe('child-1');
    });
  });

  describe('operationChildWrite', () => {
    it('should throw if no active session', async () => {
      const mgr = mockManager();
      mgr.getActive = vi.fn(() => null);
      await expect(operationChildWrite(mgr, { content: 'data' })).rejects.toThrow('No active session');
    });

    it('should throw if content missing', async () => {
      const mgr = mockManager();
      mgr.getActive = vi.fn(() => ({ id: 'c' } as any));
      await expect(operationChildWrite(mgr, { content: '' })).rejects.toThrow('content is required');
    });

    it('should write output and update status', async () => {
      const mgr = mockManager();
      mgr.getActive = vi.fn(() => ({ id: 'child-1' } as any));
      mgr.addTags = vi.fn();

      const result = await operationChildWrite(mgr, { content: 'result', checkpoint: 'mid' });

      const writeFile = vi.mocked(fs).writeFile;
      expect(writeFile).toHaveBeenCalledTimes(2); // output and status
      expect(mgr.addTags).toHaveBeenCalledWith('child-1', 'completed');
      expect(result.details).toMatchObject({
        operation: 'child_write',
        outputPath: expect.stringContaining('output.md'),
      });
    });
  });

  describe('operationParentRead', () => {
    it('should throw if sessionId missing', async () => {
      const mgr = mockManager();
      await expect(operationParentRead(mgr, { sessionId: '' as any })).rejects.toThrow('sessionId is required');
    });

    it('should throw if session not found', async () => {
      const mgr = mockManager();
      mgr.get = vi.fn(() => null);
      await expect(operationParentRead(mgr, { sessionId: 'unknown' })).rejects.toThrow('Session not found');
    });

    it('should throw if output/status not found', async () => {
      const mgr = mockManager();
      mgr.get = vi.fn(() => ({ id: 'child-1' } as any));
      vi.mocked(fs).readFile.mockRejectedValueOnce(new Error('enoent'));
      await expect(operationParentRead(mgr, { sessionId: 'child-1' })).rejects.toThrow('Output or status not found');
    });

    it('should read output and status', async () => {
      const mgr = mockManager();
      mgr.get = vi.fn(() => ({ id: 'child-1' } as any));
      const readFile = vi.mocked(fs).readFile;
      readFile
        .mockResolvedValueOnce('output data')
        .mockResolvedValueOnce('{"status":"completed"}');

      const result = await operationParentRead(mgr, { sessionId: 'child-1' });

      expect(result.content[0].text).toContain('Output from child-1');
      expect(result.content[0].text).toContain('output data');
      expect(result.details.status.status).toBe('completed');
    });
  });

  describe('operationCompleteChild', () => {
    it('should throw if no sessionId and no active', async () => {
      const mgr = mockManager();
      mgr.getActive = vi.fn(() => null);
      await expect(operationCompleteChild(mgr, {})).rejects.toThrow('No session specified');
    });

    it('should mark session completed', async () => {
      const mgr = mockManager();
      mgr.getActive = vi.fn(() => ({ id: 'child-1' } as any));
      mgr.addTags = vi.fn();

      const result = await operationCompleteChild(mgr, {});

      const writeFile = vi.mocked(fs).writeFile;
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('status.json'),
        expect.stringContaining('"status": "completed"'), // note space after colon
        'utf8'
      );
      expect(mgr.addTags).toHaveBeenCalledWith('child-1', 'completed');
      expect(result.details.operation).toBe('complete_child');
    });

    it('should use provided sessionId', async () => {
      const mgr = mockManager();
      mgr.getActive = vi.fn(() => null);
      const result = await operationCompleteChild(mgr, { sessionId: 'other-1' });
      expect(result.details.sessionId).toBe('other-1');
    });
  });
});

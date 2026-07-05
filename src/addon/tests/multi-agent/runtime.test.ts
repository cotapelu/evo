import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock worker_threads Worker
vi.mock('node:worker_threads', () => {
  return {
    Worker: vi.fn().mockImplementation(function(_path: string, _options: any) {
      return {
        threadId: 123,
        on: vi.fn(),
        postMessage: vi.fn(),
        terminate: vi.fn()
      };
    })
  };
});

import { Worker } from 'node:worker_threads';
import { MultiAgentRuntime, multiAgentRuntime } from '../../extensions/multi-agent-tool/runtime.js';
import type { ParentConfig, ChildConfig } from '../../extensions/multi-agent-tool/types.js';

describe('MultiAgentRuntime', () => {
  let runtime: MultiAgentRuntime;
  let parentConfig: ParentConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    (Worker as any).mock.instances = [];
    runtime = new MultiAgentRuntime();
    parentConfig = {
      cwd: '/tmp',
      agentDir: '/agent',
      model: 'test-model',
      thinkingLevel: 'normal',
      tools: ['tool1', 'tool2'],
      services: {} as any,
      sessionManager: {} as any,
    };
    runtime.setParentConfig(parentConfig);
    runtime.setParentAgent({} as any);
  });

  afterEach(() => {
    // Clean up children
    for (const child of runtime.listChildren()) {
      try { runtime.terminateChild(child.id, true); } catch {}
    }
  });

  describe('spawnChild', () => {
    it('throws if parent config not set', async () => {
      const r = new MultiAgentRuntime();
      await expect(r.spawnChild({ type: 'llm', mission: 'test', context: {}, tools: [] })).rejects.toThrow('Parent config not set');
    });

    it('creates child with proper initial state', async () => {
      const childId = await runtime.spawnChild({ type: 'llm', mission: 'test mission', context: { x: 1 }, tools: ['a'] });

      const child = runtime.getChild(childId);
      expect(child).not.toBeNull();
      expect(child!.type).toBe('llm');
      expect(child!.status).toBe('running');
      expect(child!.mission).toBe('test mission');
      expect(child!.createdAt).toBeDefined();
      expect(child!.startedAt).toBeDefined();
      expect(child!.completedAt).toBeUndefined();
      expect(child!.error).toBeUndefined();
      expect(child!.result).toBeUndefined();

      // Worker was constructed with correct args
      const instances = (Worker as any).mock.instances;
      expect(instances.length).toBeGreaterThan(0);
      const worker = instances[0];
      expect(worker.postMessage).toHaveBeenCalledWith({
        type: 'task',
        payload: { mission: 'test mission', context: { x: 1 }, tools: ['a'] }
      });
    });

    it('generates unique childIds', async () => {
      const id1 = await runtime.spawnChild({ type: 'llm', mission: '1', context: {}, tools: [] });
      const id2 = await runtime.spawnChild({ type: 'llm', mission: '2', context: {}, tools: [] });
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^child-1-\d+$/);
      expect(id2).toMatch(/^child-2-\d+$/);
    });
  });

  describe('handleWorkerMessage', () => {
    let childId: string;
    let workerInstance: any;

    beforeEach(async () => {
      childId = await runtime.spawnChild({ type: 'llm', mission: 'm', context: {}, tools: [] });
      workerInstance = (Worker as any).mock.instances[0];
    });

    function dispatchMessage(msg: any) {
      // Simulate calling the 'message' handler that runtime set
      const onCall = workerInstance.on.mock.calls.find((c: any) => c[0] === 'message');
      if (onCall) {
        const handler = onCall[1];
        handler(msg);
      }
    }

    it('progress does not change status', () => {
      expect(runtime.getChild(childId)!.status).toBe('running');
      dispatchMessage({ type: 'progress', payload: { checkpoint: 'c' } });
      expect(runtime.getChild(childId)!.status).toBe('running');
    });

    it('question sets status to waiting-input', () => {
      dispatchMessage({ type: 'question', payload: { question: '?' } });
      expect(runtime.getChild(childId)!.status).toBe('waiting-input');
    });

    it('result sets completed and result', () => {
      dispatchMessage({ type: 'result', payload: { output: { ok: true }, artifacts: ['f'] } });
      const child = runtime.getChild(childId)!;
      expect(child.status).toBe('completed');
      expect(child.completedAt).toBeDefined();
      expect(child.result).toEqual({ ok: true });
    });

    it('error sets error status', () => {
      dispatchMessage({ type: 'error', payload: { message: 'fail', recoverable: false } });
      const child = runtime.getChild(childId)!;
      expect(child.status).toBe('error');
      expect(child.error).toBe('fail');
    });

    it('ready leaves status unchanged', () => {
      dispatchMessage({ type: 'ready' });
      expect(runtime.getChild(childId)!.status).toBe('running');
    });
  });

  describe('handleWorkerError', () => {
    let childId: string;
    beforeEach(async () => {
      childId = await runtime.spawnChild({ type: 'llm', mission: 'm', context: {}, tools: [] });
    });

    it('sets status to error', () => {
      // Access private method
      (runtime as any).handleWorkerError(childId, new Error('oops'));
      expect(runtime.getChild(childId)!.status).toBe('error');
      expect(runtime.getChild(childId)!.error).toBe('oops');
    });

    it('ignores unknown childId', () => {
      expect(() => (runtime as any).handleWorkerError('xyz', new Error('err'))).not.toThrow();
    });
  });

  describe('handleWorkerExit', () => {
    let childId: string;
    beforeEach(async () => {
      childId = await runtime.spawnChild({ type: 'llm', mission: 'm', context: {}, tools: [] });
    });

    it('sets completed for exit code 0', () => {
      (runtime as any).handleWorkerExit(childId, 0);
      const child = runtime.getChild(childId)!;
      expect(child.status).toBe('completed');
      expect(child.completedAt).toBeDefined();
    });

    it('sets error for non-zero exit code', () => {
      (runtime as any).handleWorkerExit(childId, 1);
      const child = runtime.getChild(childId)!;
      expect(child.status).toBe('error');
      expect(child.error).toBe('Worker exited with code 1');
    });

    it('does not override final status if already terminal', () => {
      // first set completed
      (runtime as any).handleWorkerExit(childId, 0);
      // then simulate another exit (should not change)
      (runtime as any).handleWorkerExit(childId, 1);
      expect(runtime.getChild(childId)!.status).toBe('completed');
    });
  });

  describe('sendToChild', () => {
    let childId: string;
    let workerInstance: any;

    beforeEach(async () => {
      childId = await runtime.spawnChild({ type: 'llm', mission: 'm', context: {}, tools: [] });
      workerInstance = (Worker as any).mock.instances[0];
    });

    it('posts message to worker', () => {
      runtime.sendToChild(childId, { type: 'input', payload: 'data' });
      expect(workerInstance.postMessage).toHaveBeenCalledWith({ type: 'input', payload: 'data' });
    });

    it('queues message if worker is null', () => {
      // Manually create a child instance with worker=null
      const config: ChildConfig = {
        id: 'queued-child',
        type: 'llm',
        mission: 'q',
        context: {},
        tools: [],
        createdAt: new Date().toISOString(),
      };
      (runtime as any).children.set('queued-child', {
        config,
        worker: null,
        status: 'starting',
        messageQueue: [],
      });
      runtime.sendToChild('queued-child', { type: 'cancel' });
      const inst = (runtime as any).children.get('queued-child');
      expect(inst.messageQueue).toHaveLength(1);
      expect(inst.messageQueue[0]).toEqual({ type: 'cancel' });
    });
  });

  describe('getChild', () => {
    it('returns null for unknown child', () => {
      expect(runtime.getChild('unknown')).toBeNull();
    });
  });

  describe('listChildren', () => {
    it('returns empty array when none', () => {
      expect(runtime.listChildren()).toEqual([]);
    });

    it('lists children sorted by createdAt descending', async () => {
      const id1 = await runtime.spawnChild({ type: 'llm', mission: '1', context: {}, tools: [] });
      // Ensure different createdAt timestamps
      await new Promise(resolve => setTimeout(resolve, 2));
      const id2 = await runtime.spawnChild({ type: 'llm', mission: '2', context: {}, tools: [] });

      const list = runtime.listChildren();
      expect(list).toHaveLength(2);
      expect(list[0].id).toBe(id2);
      expect(list[1].id).toBe(id1);
    });

    it('filters by status', async () => {
      const idRunning = await runtime.spawnChild({ type: 'llm', mission: 'r', context: {}, tools: [] });
      const idCompleted = await runtime.spawnChild({ type: 'llm', mission: 'c', context: {}, tools: [] });
      (runtime as any).handleWorkerExit(idCompleted, 0);

      expect(runtime.listChildren('running').some(c => c.id === idRunning)).toBe(true);
      expect(runtime.listChildren('completed').some(c => c.id === idCompleted)).toBe(true);
    });
  });

  describe('terminateChild', () => {
    it('throws if child not found', async () => {
      await expect(runtime.terminateChild('unknown')).rejects.toThrow('Child not found');
    });

    it('force terminates immediately', async () => {
      const childId = await runtime.spawnChild({ type: 'llm', mission: 'm', context: {}, tools: [] });
      const workerInstance = (Worker as any).mock.instances[0];
      await runtime.terminateChild(childId, true);
      expect(workerInstance.terminate).toHaveBeenCalled();
      expect(runtime.getChild(childId)!.status).toBe('terminated');
    });

    it('non-force: sends cancel and terminates after delay if worker exists', async () => {
      vi.useFakeTimers();
      const childId = await runtime.spawnChild({ type: 'llm', mission: 'm', context: {}, tools: [] });
      const workerInstance = (Worker as any).mock.instances[0];
      workerInstance.terminate = vi.fn(); // keep as mock

      const terminatePromise = runtime.terminateChild(childId, false);
      // Immediately after call, cancel should be sent
      expect(workerInstance.postMessage).toHaveBeenCalledWith({ type: 'cancel' });
      // Fast-forward timers to fulfill the setTimeout
      await vi.runAllTimersAsync();
      await terminatePromise;
      expect(workerInstance.terminate).toHaveBeenCalled();
      expect(runtime.getChild(childId)!.status).toBe('terminated');
      vi.useRealTimers();
    });
  });

  describe('onChildMessage', () => {
    it('returns a no-op cleanup function', () => {
      const cleanup = runtime.onChildMessage('childId', (msg) => {});
      expect(typeof cleanup).toBe('function');
      // calling cleanup does nothing
      expect(() => cleanup()).not.toThrow();
    });
  });
});

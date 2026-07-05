import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setRuntime,
  spawnChild,
  sendMessage,
  awaitResult,
  listChildren,
  terminateChild,
  parentTools,
} from '../../extensions/multi-agent-tool/parent-tools.js';

// Mock runtime and messageBus
vi.mock('../../extensions/multi-agent-tool/message-bus.js', () => ({
  messageBus: {
    waitForParentMessage: vi.fn(),
    sendToChild: vi.fn(),
  },
}));

import { messageBus } from '../../extensions/multi-agent-tool/message-bus.js';

class MockRuntime {
  spawnChild = vi.fn();
  getChild = vi.fn();
  listChildren = vi.fn();
  terminateChild = vi.fn();
}

describe('Parent Tools', () => {
  let runtime: MockRuntime;

  beforeEach(() => {
    vi.clearAllMocks();
    runtime = new MockRuntime();
    setRuntime(runtime as any);
  });

  describe('spawnChild', () => {
    it('should spawn child and return result', async () => {
      (runtime.spawnChild as any).mockResolvedValue('child-123');
      const result = await spawnChild({ type: 'llm', mission: 'test' });
      expect(runtime.spawnChild).toHaveBeenCalledWith({ type: 'llm', mission: 'test', context: {}, tools: [] });
      expect(result.content[0].text).toContain('Spawned child child-123');
      expect(result.details).toEqual({ childId: 'child-123' });
    });

    it('passes context and tools', async () => {
      (runtime.spawnChild as any).mockResolvedValue('c1');
      await spawnChild({ type: 'executor', mission: 'do', context: { x: 1 }, tools: ['t1', 't2'] });
      expect(runtime.spawnChild).toHaveBeenCalledWith({ type: 'executor', mission: 'do', context: { x: 1 }, tools: ['t1', 't2'] });
    });
  });

  describe('sendMessage', () => {
    it('should send message to child', async () => {
      (runtime.getChild as any).mockReturnValue({});
      const result = await sendMessage({ childId: 'c1', message: { type: 'input' } });
      expect(messageBus.sendToChild).toHaveBeenCalledWith('c1', { type: 'input' });
      expect(result.content[0].text).toBe('Message sent to child c1');
    });

    it('should throw if child not found', async () => {
      (runtime.getChild as any).mockReturnValue(null);
      await expect(sendMessage({ childId: 'missing', message: {} })).rejects.toThrow('Child not found: missing');
    });
  });

  describe('awaitResult', () => {
    it('should wait and return result', async () => {
      (runtime.getChild as any).mockReturnValue({});
      (messageBus.waitForParentMessage as any).mockResolvedValue({ type: 'result', payload: {} });
      const result = await awaitResult({ childId: 'c1' });
      expect(messageBus.waitForParentMessage).toHaveBeenCalledWith('c1', 'result', 120000);
      expect(result.content[0].text).toContain('Result received');
      expect(result.details).toEqual({ type: 'result', payload: {} });
    });

    it('should return timeout if no message', async () => {
      (runtime.getChild as any).mockReturnValue({});
      (messageBus.waitForParentMessage as any).mockResolvedValue(null);
      const result = await awaitResult({ childId: 'c1' });
      expect(result.content[0].text).toContain('Timeout');
      expect(result.details).toBeNull();
    });

    it('should throw if child not found', async () => {
      (runtime.getChild as any).mockReturnValue(null);
      await expect(awaitResult({ childId: 'c1' })).rejects.toThrow('Child not found: c1');
    });
  });

  describe('listChildren', () => {
    it('should list children with status', async () => {
      const children = [
        { id: 'c1', type: 'llm', status: 'running', mission: 'A' },
        { id: 'c2', type: 'executor', status: 'idle', mission: 'B' },
      ];
      (runtime.listChildren as any).mockResolvedValue(children);
      const result = await listChildren({ status: 'running' });
      expect(runtime.listChildren).toHaveBeenCalledWith('running');
      expect(result.content[0].text).toContain('c1 (llm) [running]: A');
      expect(result.details).toEqual(children);
    });

    it('returns "No children" when empty', async () => {
      (runtime.listChildren as any).mockResolvedValue([]);
      const result = await listChildren({ status: 'any' });
      expect(result.content[0].text).toBe('No children');
    });
  });

  describe('terminateChild', () => {
    it('should terminate child', async () => {
      (runtime.terminateChild as any).mockResolvedValue(undefined);
      const result = await terminateChild({ childId: 'c1', force: false });
      expect(runtime.terminateChild).toHaveBeenCalledWith('c1', false);
      expect(result.content[0].text).toBe('Child c1 terminated');
    });
  });

  describe('parentTools object', () => {
    it('exports all functions', () => {
      expect(parentTools).toHaveProperty('spawnChild');
      expect(parentTools).toHaveProperty('sendMessage');
      expect(parentTools).toHaveProperty('awaitResult');
      expect(parentTools).toHaveProperty('listChildren');
      expect(parentTools).toHaveProperty('terminateChild');
    });
  });
});

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock the message-bus module before importing child-tools
vi.mock('../../extensions/multi-agent-tool/message-bus.js', () => ({
  messageBus: {
    sendToParent: vi.fn(),
    onIncomingMessage: vi.fn(),
  },
}));

import { messageBus } from '../../extensions/multi-agent-tool/message-bus.js';
import {
  setCurrentChildId,
  getCurrentChildId,
  reportProgress,
  askQuestion,
  complete,
  error,
  childTools,
} from '../../extensions/multi-agent-tool/child-tools.js';

describe('Child Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCurrentChildId(null);
  });

  describe('setCurrentChildId / getCurrentChildId', () => {
    it('should set and get child id', () => {
      expect(getCurrentChildId()).toBeNull();
      setCurrentChildId('child-123');
      expect(getCurrentChildId()).toBe('child-123');
    });
  });

  describe('errors when not inside child agent', () => {
    it('reportProgress throws without child id', () => {
      expect(() => reportProgress({ checkpoint: 'x' })).toThrow('Not inside child agent');
    });

    it('complete throws without child id', () => {
      expect(() => complete({ result: 1 })).toThrow('Not inside child agent');
    });

    it('error throws without child id', () => {
      expect(() => error({ message: 'err' })).toThrow('Not inside child agent');
    });

    it('askQuestion throws without child id', () => {
      expect(() => askQuestion({ question: '?' })).toThrow('Not inside child agent');
    });
  });

  describe('reportProgress', () => {
    it('should send progress to parent and return content', () => {
      setCurrentChildId('c1');
      const params = { checkpoint: 'step1' };
      const result = reportProgress(params);

      expect(messageBus.sendToParent).toHaveBeenCalledWith(
        { type: 'progress', payload: params },
        'c1'
      );
      expect(result.content).toEqual([{ type: 'text', text: 'Progress: step1' }]);
      expect(result.details).toBe(params);
    });
  });

  describe('complete', () => {
    it('should send result to parent and return completion', () => {
      setCurrentChildId('c2');
      const params = { result: 'ok' };
      const result = complete(params);

      expect(messageBus.sendToParent).toHaveBeenCalledWith(
        { type: 'result', payload: params },
        'c2'
      );
      expect(result.content).toEqual([{ type: 'text', text: 'Completed' }]);
      expect(result.details).toBe(params);
    });
  });

  describe('error', () => {
    it('should send error to parent and return error message', () => {
      setCurrentChildId('c3');
      const params = { message: 'oops', code: 500 };
      const result = error(params);

      expect(messageBus.sendToParent).toHaveBeenCalledWith(
        { type: 'error', payload: params },
        'c3'
      );
      expect(result.content).toEqual([{ type: 'text', text: 'Error: oops' }]);
      expect(result.details).toBe(params);
    });
  });

  describe('askQuestion', () => {
    let capturedHandler: ((msg: any) => void) | null = null;
    const mockUnsub = vi.fn();

    beforeEach(() => {
      capturedHandler = null;
      (messageBus.onIncomingMessage as any) = vi.fn((id: string, handler: (msg: any) => void) => {
        capturedHandler = handler;
        return mockUnsub;
      });
    });

    it('should resolve on incoming input message', async () => {
      setCurrentChildId('c4');
      const promise = askQuestion({ question: 'What is your name?' });

      expect(capturedHandler).not.toBeNull();
      capturedHandler!({ type: 'input', payload: 'Alice' });

      const result = await promise;
      expect(result.content).toEqual([{ type: 'text', text: 'Alice' }]);
      expect(messageBus.onIncomingMessage).toHaveBeenCalledWith('c4', expect.any(Function));
    });

    it('should resolve when payload is object', async () => {
      setCurrentChildId('c5');
      const promise = askQuestion({ question: 'Pick' });

      expect(capturedHandler).not.toBeNull();
      capturedHandler!({ type: 'input', payload: { choice: 2 } });

      const result = await promise;
      expect(result.content).toEqual([{ type: 'text', text: '{"choice":2}' }]);
    });

    it('should timeout after 120s if no answer', async () => {
      vi.useFakeTimers();
      setCurrentChildId('c6');
      const promise = askQuestion({ question: 'Timeout test' });

      await vi.runAllTimersAsync();

      const result = await promise;
      expect(result.content).toEqual([{ type: 'text', text: 'timeout' }]);
      vi.useRealTimers();
    });
  });
});

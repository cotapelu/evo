import { describe, it, expect } from 'vitest';
import {
  isTaskMessage,
  isInputMessage,
  isCancelMessage,
  isProgressMessage,
  isQuestionMessage,
  isResultMessage,
  isErrorMessage,
  ParentToChildMessage,
  ChildToParentMessage,
} from '../../extensions/multi-agent-tool/types.js';

describe('Multi-Agent Types - Type Guards', () => {
  describe('ParentToChildMessage guards', () => {
    it('isTaskMessage returns true for task messages with correct payload', () => {
      const msg: ParentToChildMessage = {
        type: 'task',
        payload: { mission: 'test', context: {}, tools: [] }
      };
      expect(isTaskMessage(msg)).toBe(true);
    });

    it('isTaskMessage returns false for other message types', () => {
      const msg: ParentToChildMessage = { type: 'input', payload: 'data' };
      expect(isTaskMessage(msg)).toBe(false);
    });

    it('isInputMessage returns true for input messages', () => {
      const msg: ParentToChildMessage = { type: 'input', payload: { some: 'value' } };
      expect(isInputMessage(msg)).toBe(true);
    });

    it('isInputMessage returns false for other types', () => {
      const msg: ParentToChildMessage = { type: 'cancel' };
      expect(isInputMessage(msg)).toBe(false);
    });

    it('isCancelMessage returns true for cancel messages', () => {
      const msg: ParentToChildMessage = { type: 'cancel' };
      expect(isCancelMessage(msg)).toBe(true);
    });

    it('isCancelMessage returns false for task or input', () => {
      expect(isCancelMessage({ type: 'task', payload: {} } as ParentToChildMessage)).toBe(false);
      expect(isCancelMessage({ type: 'input', payload: null } as ParentToChildMessage)).toBe(false);
    });
  });

  describe('ChildToParentMessage guards', () => {
    it('isProgressMessage identifies progress messages', () => {
      const msg: ChildToParentMessage = { type: 'progress', payload: { checkpoint: 'step1' } };
      expect(isProgressMessage(msg)).toBe(true);
    });

    it('isProgressMessage returns false for other child messages', () => {
      const msg: ChildToParentMessage = { type: 'question', payload: { question: '?' } };
      expect(isProgressMessage(msg)).toBe(false);
    });

    it('isQuestionMessage identifies question messages', () => {
      const msg: ChildToParentMessage = { type: 'question', payload: { question: 'What next?', options: ['a', 'b'] } };
      expect(isQuestionMessage(msg)).toBe(true);
    });

    it('isResultMessage identifies result messages', () => {
      const msg: ChildToParentMessage = { type: 'result', payload: { output: 'finished', artifacts: ['file1'] } };
      expect(isResultMessage(msg)).toBe(true);
    });

    it('isErrorMessage identifies error messages', () => {
      const msg: ChildToParentMessage = { type: 'error', payload: { message: 'Oops', recoverable: true } };
      expect(isErrorMessage(msg)).toBe(true);
    });
  });
});

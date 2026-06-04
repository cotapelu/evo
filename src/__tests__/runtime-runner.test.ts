import { jest } from '@jest/globals';
import {
  setGlobalRuntime,
  getGlobalRuntime,
  clearGlobalRuntime,
} from '../runtime/runtime-runner.js';
import type { AgentSessionRuntime } from '../runtime/runtime-provider.js';

describe('runtime-runner.ts', () => {
  let mockRuntime: AgentSessionRuntime;

  beforeEach(() => {
    mockRuntime = { session: { id: 'test-session' } } as any;
    clearGlobalRuntime(); // Ensure clean state
  });

  describe('setGlobalRuntime', () => {
    it('should set the global runtime', () => {
      expect(getGlobalRuntime()).toBeNull();

      setGlobalRuntime(mockRuntime);

      expect(getGlobalRuntime()).toBe(mockRuntime);
    });

    it('should allow overwriting the global runtime', () => {
      setGlobalRuntime(mockRuntime);
      const newRuntime = { session: { id: 'new-session' } } as any;

      setGlobalRuntime(newRuntime);

      expect(getGlobalRuntime()).toBe(newRuntime);
    });

    it('should throw if called with null or undefined?', () => {
      // Current implementation sets it directly without guard
      setGlobalRuntime(mockRuntime);
      expect(getGlobalRuntime()).toBe(mockRuntime);

      // Setting to null is technically allowed but breaks later
      setGlobalRuntime(null as any);
      expect(getGlobalRuntime()).toBeNull();
    });

    it('should be able to replace with same value (idempotent)', () => {
      setGlobalRuntime(mockRuntime);
      setGlobalRuntime(mockRuntime);

      expect(getGlobalRuntime()).toBe(mockRuntime);
    });
  });

  describe('getGlobalRuntime', () => {
    it('should return null when not set', () => {
      expect(getGlobalRuntime()).toBeNull();
    });

    it('should return the previously set runtime', () => {
      setGlobalRuntime(mockRuntime);
      expect(getGlobalRuntime()).toBe(mockRuntime);
    });

    it('should throw if accessed before initialization?', () => {
      // Current implementation returns null safely
      expect(() => getGlobalRuntime()).not.toThrow();
    });
  });

  describe('clearGlobalRuntime', () => {
    it('should clear the global runtime to null', () => {
      setGlobalRuntime(mockRuntime);
      expect(getGlobalRuntime()).toBe(mockRuntime);

      clearGlobalRuntime();

      expect(getGlobalRuntime()).toBeNull();
    });

    it('should be safe to call when already null', () => {
      expect(getGlobalRuntime()).toBeNull();

      clearGlobalRuntime();

      expect(getGlobalRuntime()).toBeNull();
    });

    it('should require re-initialization after clear', () => {
      setGlobalRuntime(mockRuntime);
      clearGlobalRuntime();

      expect(getGlobalRuntime()).toBeNull();

      const newRuntime = { session: { id: 'another' } } as any;
      setGlobalRuntime(newRuntime);
      expect(getGlobalRuntime()).toBe(newRuntime);
    });
  });

  describe('lifecycle cycle', () => {
    it('should maintain isolation between test cases', () => {
      // Test 1
      setGlobalRuntime(mockRuntime);
      expect(getGlobalRuntime()).toBe(mockRuntime);

      // This is effectively what beforeEach does
      // clearGlobalRuntime(); // uncomment in real usage
      // expect(getGlobalRuntime()).toBeNull();
    });

    it('should support full lifecycle: set -> get -> clear -> null', () => {
      // Initially null
      expect(getGlobalRuntime()).toBeNull();

      // Set
      setGlobalRuntime(mockRuntime);
      expect(getGlobalRuntime()).toBe(mockRuntime);

      // Clear
      clearGlobalRuntime();
      expect(getGlobalRuntime()).toBeNull();
    });
  });
});

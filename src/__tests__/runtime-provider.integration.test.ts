// @ts-nocheck - Jest type complexity with ESM mocks
import { jest } from '@jest/globals';
import {
  validateRuntimeOptions,
  getRuntimeStatus,
  formatDuration,
} from '../runtime/runtime-provider.js';

describe('runtime-provider.ts (enhanced features)', () => {
  describe('validateRuntimeOptions', () => {
    it('should accept valid options', () => {
      const errors = validateRuntimeOptions({
        tools: ['read', 'bash'],
        thinkingLevel: 'medium',
      });
      expect(errors).toHaveLength(0);
    });

    it('should reject both tools and noTools', () => {
      const errors = validateRuntimeOptions({
        tools: ['read'],
        noTools: 'all',
      });
      expect(errors).toContain('Cannot specify both tools and noTools');
    });

    it('should reject invalid noTools value', () => {
      const errors = validateRuntimeOptions({
        noTools: 'invalid' as any,
      });
      expect(errors).toContain('noTools must be "all" or "builtin"');
    });

    it('should reject invalid thinkingLevel', () => {
      const errors = validateRuntimeOptions({
        thinkingLevel: 'invalid' as any,
      });
      expect(errors[0]).toContain('Invalid thinkingLevel');
    });

    it('should accept empty options', () => {
      const errors = validateRuntimeOptions({});
      expect(errors).toHaveLength(0);
    });

    it('should validate compactionOptions.threshold range', () => {
      const errors = validateRuntimeOptions({
        compactionOptions: { threshold: 1.5 },
      });
      expect(errors[0]).toBe('compactionOptions.threshold must be between 0 and 1');
    });

    it('should validate compactionOptions.maxTokensBeforeCompaction', () => {
      const errors = validateRuntimeOptions({
        compactionOptions: { maxTokensBeforeCompaction: 500 },
      });
      expect(errors[0]).toBe('compactionOptions.maxTokensBeforeCompaction must be >= 1000');
    });

    it('should validate retryOptions.maxRetries', () => {
      const errors = validateRuntimeOptions({
        retryOptions: { maxRetries: -1 },
      });
      expect(errors[0]).toBe('retryOptions.maxRetries must be >= 0');
    });

    it('should validate modelSelection', () => {
      const errors = validateRuntimeOptions({
        modelSelection: 'invalid' as any,
      });
      expect(errors[0]).toBe('modelSelection must be "first", "available", or "explicit"');
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds correctly', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(999)).toBe('999ms');
      expect(formatDuration(1)).toBe('1ms');
    });

    it('should format seconds correctly', () => {
      expect(formatDuration(1000)).toBe('1.00s');
      expect(formatDuration(1500)).toBe('1.50s');
      expect(formatDuration(5000)).toBe('5.00s');
      expect(formatDuration(12345)).toBe('12.35s');
    });

    it('should handle zero', () => {
      expect(formatDuration(0)).toBe('0ms');
    });

    it('should round to 2 decimal places for seconds', () => {
      expect(formatDuration(1234)).toBe('1.23s');
      expect(formatDuration(5678)).toBe('5.68s');
    });
  });

  describe('getRuntimeStatus (basic)', () => {
    it('should return inactive status when no session', () => {
      const mockRuntime = {
        session: null,
        diagnostics: [],
      } as any;
      const status = getRuntimeStatus(mockRuntime);
      expect(status.sessionActive).toBe(false);
      expect(status.sessionFile).toBeNull();
    });

    it('should return active status with session', () => {
      const mockRuntime = {
        session: {
          sessionFile: '/path/to/session.jsonl',
          sessionId: 'test-123',
        },
        diagnostics: [],
      } as any;
      const status = getRuntimeStatus(mockRuntime);
      expect(status.sessionActive).toBe(true);
      expect(status.sessionFile).toBe('/path/to/session.jsonl');
      expect(status.diagnosticsCount).toBe(0);
    });

    it('should count diagnostics', () => {
      const mockRuntime = {
        session: { sessionFile: '/path/to/session.jsonl' },
        diagnostics: [
          { type: 'info', message: 'Test info' },
          { type: 'warning', message: 'Test warning' },
          { type: 'error', message: 'Test error' },
        ],
      } as any;
      const status = getRuntimeStatus(mockRuntime);
      expect(status.diagnosticsCount).toBe(3);
    });
  });
});

// @ts-nocheck - Jest type complexity with ESM mocks
import { jest } from '@jest/globals';
import {
  formatDuration,
  printBanner,
  printDiagnostics,
  printStartupMetrics,
} from '../runtime/runtime-provider.js';

describe('runtime-provider.ts (utility functions)', () => {
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

    it('should handle fractional milliseconds', () => {
      expect(formatDuration(0.5)).toBe('1ms'); // rounds
    });

    it('should round to 2 decimal places for seconds', () => {
      expect(formatDuration(1234)).toBe('1.23s');
      expect(formatDuration(5678)).toBe('5.68s');
    });
  });

  describe('printBanner', () => {
    it('should print the Evo Agent banner', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      printBanner();
      expect(consoleLogSpy).toHaveBeenCalledWith('\n🧬 Evo Agent v0.0.1\n');
      consoleLogSpy.mockRestore();
    });

    it('should not throw', () => {
      expect(() => printBanner()).not.toThrow();
    });
  });

  describe('printDiagnostics', () => {
    it('should print nothing when diagnostics array is empty', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      printDiagnostics([]);
      expect(consoleLogSpy).not.toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });

    it('should print diagnostics with appropriate icons', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      const diagnostics = [
        { type: 'error', message: 'Critical failure' },
        { type: 'warning', message: 'Potential issue' },
        { type: 'info', message: 'Informational' },
        { type: 'unknown', message: 'Unknown type' }, // falls back to info
      ];

      printDiagnostics(diagnostics);

      expect(consoleLogSpy).toHaveBeenCalledWith('\n📊 Diagnostics:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  ❌ Critical failure');
      expect(consoleLogSpy).toHaveBeenCalledWith('  ⚠️ Potential issue');
      expect(consoleLogSpy).toHaveBeenCalledWith('  ℹ️ Informational');
      expect(consoleLogSpy).toHaveBeenCalledWith('  ℹ️ Unknown type');
      consoleLogSpy.mockRestore();
    });

    it('should not print trailing newline if empty', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      printDiagnostics([]);
      // Verify no extra newline call
      expect(consoleLogSpy).not.toHaveBeenCalledWith('');
      consoleLogSpy.mockRestore();
    });
  });

  describe('printStartupMetrics', () => {
    it('should print all timing metrics formatted', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      const metrics = {
        totalMs: 1500,
        servicesMs: 800,
        sessionMs: 700,
      };

      printStartupMetrics(metrics);

      expect(consoleLogSpy).toHaveBeenCalledWith('\n⏱️  Startup Timing:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  Total:   1.50s');
      expect(consoleLogSpy).toHaveBeenCalledWith('  Services: 800ms');
      expect(consoleLogSpy).toHaveBeenCalledWith('  Session:  700ms');
      consoleLogSpy.mockRestore();
    });

    it('should handle millisecond values under 1 second', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      const metrics = {
        totalMs: 500,
        servicesMs: 200,
        sessionMs: 300,
      };

      printStartupMetrics(metrics);

      expect(consoleLogSpy).toHaveBeenCalledWith('  Total:   500ms');
      expect(consoleLogSpy).toHaveBeenCalledWith('  Services: 200ms');
      expect(consoleLogSpy).toHaveBeenCalledWith('  Session:  300ms');
      consoleLogSpy.mockRestore();
    });

    it('should not throw with zero values', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      const metrics = {
        totalMs: 0,
        servicesMs: 0,
        sessionMs: 0,
      };

      expect(() => printStartupMetrics(metrics)).not.toThrow();
      consoleLogSpy.mockRestore();
    });
  });
});

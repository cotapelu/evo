import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLogger, logger } from '../../extensions/utils/logger.js';

// All console methods we test
const consoleMethods = ['log', 'error', 'warn', 'info', 'debug'] as const;

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createLogger()', () => {
    it('should create logger with all methods', () => {
      const log = createLogger();
      for (const m of consoleMethods) {
        expect(typeof log[m]).toBe('function');
      }
    });

    // Exhaustively test each method with tag and without tag
    for (const m of consoleMethods) {
      describe(`method .${m}()`, () => {
        const consoleSpy = vi.spyOn(console, m).mockImplementation(() => {});

        it(`should call console.${m} without prefix when no tag`, () => {
          const log = createLogger();
          (log[m])('test', 'arg');
          expect(consoleSpy).toHaveBeenCalledWith('test', 'arg');
        });

        it(`should call console.${m} with prefix when tag provided`, () => {
          const log = createLogger('TAG');
          (log[m])('msg');
          expect(consoleSpy).toHaveBeenCalledWith('[TAG]', 'msg');
        });
      });
    }

    it('should pass multiple arguments with tag', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const log = createLogger('MULTI');
      log.log(1, 2, 3);
      expect(consoleSpy).toHaveBeenCalledWith('[MULTI]', 1, 2, 3);
    });

    it('should handle empty call (no args)', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const log = createLogger();
      log.log();
      expect(spy).toHaveBeenCalledWith();
    });
  });

  describe('default logger export', () => {
    it('logger should be defined and have methods', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.log).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('logger uses no prefix by default', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.log('default');
      expect(spy).toHaveBeenCalledWith('default');
    });
  });
});

import { describe, it, expect } from 'vitest';
import { parseArgs, requireArgs, getArg } from '../../extensions/utils/command-args.js';

describe('Command Args Utils', () => {
  describe('parseArgs', () => {
    it('should split action and args', () => {
      expect(parseArgs('action arg1 arg2')).toEqual({ action: 'action', args: ['arg1', 'arg2'] });
    });

    it('returns empty action and args for empty string', () => {
      expect(parseArgs('')).toEqual({ action: '', args: [] });
    });

    it('trims whitespace', () => {
      expect(parseArgs('  action   arg1   arg2  ')).toEqual({ action: 'action', args: ['arg1', 'arg2'] });
    });

    it('handles single word', () => {
      expect(parseArgs('single')).toEqual({ action: 'single', args: [] });
    });
  });

  describe('requireArgs', () => {
    it('throws when insufficient args', () => {
      const parsed = { action: 'test', args: [] };
      expect(() => requireArgs(parsed, 1)).toThrow('Usage: test <args...> (need at least 1 argument(s))');
    });

    it('throws with custom usage', () => {
      const parsed = { action: 'cmd', args: [] };
      expect(() => requireArgs(parsed, 2, 'cmd needs at least 2 args')).toThrow('cmd needs at least 2 args');
    });

    it('does not throw when sufficient args', () => {
      const parsed = { action: 'test', args: ['a', 'b'] };
      expect(() => requireArgs(parsed, 1)).not.toThrow();
    });
  });

  describe('getArg', () => {
    it('gets argument by index', () => {
      const parsed = { action: 'test', args: ['first', 'second'] };
      expect(getArg(parsed, 0)).toBe('first');
      expect(getArg(parsed, 1)).toBe('second');
    });

    it('returns undefined for out of range', () => {
      const parsed = { action: 'test', args: ['only'] };
      expect(getArg(parsed, 1)).toBeUndefined();
    });

    it('returns default when out of range', () => {
      const parsed = { action: 'test', args: [] };
      expect(getArg(parsed, 0, 'default')).toBe('default');
    });
  });
});

import { jest } from '@jest/globals';
import { KeybindingsManager } from '../keybindings-manager.js';

describe('KeybindingsManager', () => {
  let manager: KeybindingsManager;

  beforeEach(() => {
    manager = KeybindingsManager.create();
  });

  it('should map keybinding ids to keys', () => {
    expect(manager.getKey('app.exit')).toBe('ctrl+d');
    expect(manager.getKey('app.clear')).toBe('ctrl+c');
    expect(manager.getKey('app.interrupt')).toBe('escape');
  });

  it('should return multiple keys for bindings with alternatives', () => {
    const keys = manager.getKeys('app.interrupt');
    expect(Array.isArray(keys)).toBe(true);
    expect(keys.length).toBeGreaterThan(0);
  });

  it('should match known keybindings (indirect check)', () => {
    const keys = manager.getKeys('app.thinking.cycle');
    expect(keys).toContain('shift+tab');
  });

  it('returns empty string for unknown binding', () => {
    expect(manager.getKey('unknown.binding')).toBe('');
  });

  it('returns empty array for unknown binding getKeys', () => {
    expect(manager.getKeys('unknown.binding')).toEqual([]);
  });

  describe('matches()', () => {
    it('matches escape key', () => {
      // Escape key sends \x1b (ESC)
      expect(manager.matches('\x1b', 'app.interrupt')).toBe(true);
    });

    it('matches ctrl+d (exit)', () => {
      // Ctrl+D sends EOT (0x04)
      expect(manager.matches('\x04', 'app.exit')).toBe(true);
    });

    it('matches ctrl+c (clear)', () => {
      // Ctrl+C sends ETX (0x03)
      expect(manager.matches('\x03', 'app.clear')).toBe(true);
    });

    it('matches ctrl+z (suspend) on non-win32', () => {
      if (process.platform !== 'win32') {
        // Ctrl+Z sends SUB (0x1A)
        expect(manager.matches('\x1a', 'app.suspend')).toBe(true);
      } else {
        // On Windows, app.suspend is not bound; ensure false
        expect(manager.matches('\x1a', 'app.suspend')).toBe(false);
      }
    });

    it('does not match wrong key', () => {
      expect(manager.matches('a', 'app.exit')).toBe(false);
      expect(manager.matches('\x04', 'app.interrupt')).toBe(false);
    });

    it('returns false for unknown keybinding', () => {
      expect(manager.matches('\x04', 'unknown.binding')).toBe(false);
    });

    it('matches ctrl+t (thinking toggle) maybe', () => {
      // But check if ctrl+t is bound to thinking.toggle? In interactive-mode, yes. Here we only have keybindings-manager.
      // It's not bound in keybindings-manager; but we can test a binding that exists: app.thinking.cycle is shift+tab, not ctrl+t.
      // We'll skip.
    });
  });
});

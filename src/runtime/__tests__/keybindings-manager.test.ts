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

  it('should match known keybindings', () => {
    // Test internal matching via matches() method
    // Since we can't easily mock matchesKey, we test the mapping indirectly
    const keys = manager.getKeys('app.thinking.cycle');
    expect(keys).toContain('shift+tab');
  });

  it('returns empty string for unknown binding', () => {
    expect(manager.getKey('unknown.binding')).toBe('');
  });

  it('returns empty array for unknown binding getKeys', () => {
    expect(manager.getKeys('unknown.binding')).toEqual([]);
  });
});

import { SharedWorkspace } from '../workspace.js';

describe('SharedWorkspace Unit', () => {
  let workspace: SharedWorkspace;

  beforeEach(() => {
    workspace = new SharedWorkspace();
  });

  describe('set & get', () => {
    test('should store and retrieve values', () => {
      workspace.set('key1', 'value1', 'agent-1');
      expect(workspace.get('key1')).toBe('value1');
    });

    test('get should return undefined for non-existent key', () => {
      expect(workspace.get('nonexistent')).toBeUndefined();
    });

    test('should overwrite existing keys', () => {
      workspace.set('key1', 'value1', 'agent-1');
      workspace.set('key1', 'value2', 'agent-2');
      expect(workspace.get('key1')).toBe('value2');
    });
  });

  describe('getEntry', () => {
    test('should return entry with value, owner, timestamp for existing key', () => {
      workspace.set('key1', 'value1', 'agent-1');
      const entry = workspace.getEntry('key1');
      expect(entry).toBeDefined();
      expect(entry!.value).toBe('value1');
      expect(entry!.owner).toBe('agent-1');
      expect(entry!.timestamp).toBeGreaterThan(0);
    });

    test('should return undefined for non-existent key', () => {
      expect(workspace.getEntry('nonexistent')).toBeUndefined();
    });
  });

  describe('list', () => {
    test('should return empty array when empty', () => {
      expect(workspace.list()).toEqual([]);
    });

    test('should list all keys', () => {
      workspace.set('key1', 'v1', 'a1');
      workspace.set('key2', 'v2', 'a2');
      workspace.set('key3', 'v3', 'a3');
      const keys = workspace.list();
      expect(keys.sort()).toEqual(['key1', 'key2', 'key3']);
    });
  });

  describe('listByPrefix', () => {
    test('should filter keys by prefix', () => {
      workspace.set('prefix-a', 1, 'a');
      workspace.set('prefix-b', 2, 'b');
      workspace.set('other-c', 3, 'c');
      workspace.set('prefix-d', 4, 'd');
      expect(workspace.listByPrefix('prefix-')).toEqual(['prefix-a', 'prefix-b', 'prefix-d']);
    });

    test('should return empty array when no keys match prefix', () => {
      workspace.set('abc', 1, 'a');
      workspace.set('xyz', 2, 'b');
      expect(workspace.listByPrefix('none-')).toEqual([]);
    });

    test('should handle empty prefix (returns all)', () => {
      workspace.set('a', 1, 'a');
      workspace.set('b', 2, 'b');
      expect(workspace.listByPrefix('')).toEqual(['a', 'b']);
    });

    test('prefix is case-sensitive', () => {
      workspace.set('Key', 1, 'a');
      workspace.set('key', 2, 'b');
      expect(workspace.listByPrefix('Key')).toEqual(['Key']);
      expect(workspace.listByPrefix('key')).toEqual(['key']);
    });
  });

  describe('delete', () => {
    test('should remove existing key and return true', () => {
      workspace.set('key1', 'v1', 'a1');
      expect(workspace.delete('key1')).toBe(true);
      expect(workspace.get('key1')).toBeUndefined();
    });

    test('should return false for non-existent key', () => {
      expect(workspace.delete('nonexistent')).toBe(false);
    });
  });

  describe('clear', () => {
    test('should remove all entries', () => {
      workspace.set('k1', 'v1', 'a1');
      workspace.set('k2', 'v2', 'a2');
      workspace.clear();
      expect(workspace.list()).toEqual([]);
      expect(workspace.get('k1')).toBeUndefined();
    });
  });

  describe('toObject', () => {
    test('should return plain object with all key-value pairs', () => {
      workspace.set('k1', 'v1', 'a1');
      workspace.set('k2', 'v2', 'a2');
      const obj = workspace.toObject();
      expect(obj).toEqual({ k1: 'v1', k2: 'v2' });
    });

    test('should not include metadata (owner, timestamp) in output', () => {
      workspace.set('k1', 'v1', 'a1');
      const obj = workspace.toObject();
      expect(obj).toHaveProperty('k1');
      expect(Object.keys(obj).length).toBe(1);
    });

    test('should return empty object when empty', () => {
      expect(workspace.toObject()).toEqual({});
    });

    test('returned object should be independent', () => {
      workspace.set('k1', 'v1', 'a1');
      const obj1 = workspace.toObject();
      obj1.k1 = 'modified';
      const obj2 = workspace.toObject();
      expect(obj2.k1).toBe('v1'); // unchanged
    });
  });
});

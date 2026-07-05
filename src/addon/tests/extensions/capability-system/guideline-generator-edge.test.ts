import { describe, it, expect } from 'vitest';
import { extractMinimalParams, getExampleValue } from '../../../extensions/capability-system/guideline-generator.js';

describe('extractMinimalParams', () => {
  it('returns empty object for non-object schema', () => {
    expect(extractMinimalParams({ type: 'string' })).toEqual({});
    expect(extractMinimalParams({})).toEqual({});
  });

  it('returns empty object when no properties', () => {
    expect(extractMinimalParams({ type: 'object' })).toEqual({});
    expect(extractMinimalParams({ type: 'object', properties: {} })).toEqual({});
  });

  it('extracts required properties with example values', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'User name' },
        count: { type: 'number' }
      },
      required: ['name']
    };
    const result = extractMinimalParams(schema);
    expect(result).toHaveProperty('name');
    expect(result.name).toBe('example'); // from description
    expect(result).not.toHaveProperty('count'); // not required
  });

  it('respects enum for string properties', () => {
    const schema = {
      type: 'object',
      properties: {
        level: { type: 'string', enum: ['low', 'medium', 'high'] }
      },
      required: ['level']
    };
    const result = extractMinimalParams(schema);
    expect(result.level).toBe('low'); // first enum
  });

  it('uses default value when provided', () => {
    const schema = {
      type: 'object',
      properties: {
        flag: { type: 'boolean', default: true }
      },
      required: ['flag']
    };
    const result = extractMinimalParams(schema);
    expect(result.flag).toBe(true);
  });

  it('handles arrays with item schema', () => {
    const schema = {
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' } }
      },
      required: ['tags']
    };
    const result = extractMinimalParams(schema);
    expect(result.tags).toEqual(['example']); // array with one example string
  });

  it('handles nested objects', () => {
    const schema = {
      type: 'object',
      properties: {
        config: { type: 'object', properties: { debug: { type: 'boolean' } } }
      },
      required: ['config']
    };
    const result = extractMinimalParams(schema);
    expect(result.config).toEqual({ debug: false }); // default boolean false
  });

  it('handles multiple required fields of mixed types', () => {
    const schema = {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        recursive: { type: 'boolean' },
        count: { type: 'number', default: 10 }
      },
      required: ['path', 'recursive', 'count']
    };
    const result = extractMinimalParams(schema);
    expect(result.path).toBe('src/example.test.ts'); // file hint
    expect(result.recursive).toBe(false); // boolean default
    expect(result.count).toBe(10); // explicit default
  });

  it('returns undefined for property with no example fallback', () => {
    const schema = {
      type: 'object',
      properties: {
        unknown: { type: 'null' } // unsupported type
      },
      required: ['unknown']
    };
    const result = extractMinimalParams(schema);
    expect(result.unknown).toBeUndefined();
  });
});

describe('getExampleValue', () => {
  it('returns example from prop.example', () => {
    expect(getExampleValue({ example: 'ex' })).toBe('ex');
  });

  it('returns default from prop.default', () => {
    expect(getExampleValue({ default: 42 })).toBe(42);
  });

  it('returns first enum value for string with enum', () => {
    expect(getExampleValue({ type: 'string', enum: ['a', 'b'] })).toBe('a');
  });

  it('provides contextual string examples from description', () => {
    expect(getExampleValue({ type: 'string', description: 'File path to read' })).toBe('src/example.test.ts');
    expect(getExampleValue({ type: 'string', description: 'Email address' })).toBe('user@example.com');
    expect(getExampleValue({ type: 'string', description: 'API URL' })).toBe('https://example.com');
    expect(getExampleValue({ type: 'string', description: 'Git branch' })).toBe('main');
    expect(getExampleValue({ type: 'string', description: 'Name' })).toBe('example');
  });

  it('returns false for booleans described as dry-run/quiet', () => {
    expect(getExampleValue({ type: 'boolean', description: 'dry run' })).toBe(false);
    expect(getExampleValue({ type: 'boolean', description: 'quiet mode' })).toBe(false);
  });

  it('returns true for booleans described as enable/watch/verbose', () => {
    expect(getExampleValue({ type: 'boolean', description: 'enable feature' })).toBe(true);
    expect(getExampleValue({ type: 'boolean', description: 'watch files' })).toBe(true);
    expect(getExampleValue({ type: 'boolean', description: 'verbose output' })).toBe(true);
  });

  it('returns false as default boolean', () => {
    expect(getExampleValue({ type: 'boolean' })).toBe(false);
  });

  it('returns 0 for numbers', () => {
    expect(getExampleValue({ type: 'number' })).toBe(0);
  });

  it('returns array with single item example', () => {
    expect(getExampleValue({ type: 'array', items: { type: 'string' } })).toEqual(['example']);
    expect(getExampleValue({ type: 'array', items: { type: 'number' } })).toEqual([0]);
  });

  it('returns empty array when no items schema', () => {
    expect(getExampleValue({ type: 'array' })).toEqual([]);
  });

  it('returns object example from properties', () => {
    const prop = {
      type: 'object',
      properties: {
        a: { type: 'string' },
        b: { type: 'number', default: 5 }
      }
    };
    const result = getExampleValue(prop);
    expect(result).toEqual({ a: 'example', b: 5 });
  });

  it('returns undefined when object has no properties definition', () => {
    expect(getExampleValue({ type: 'object' })).toBeUndefined();
  });

  it('returns undefined for unsupported types', () => {
    expect(getExampleValue({ type: 'null' })).toBeUndefined();
    expect(getExampleValue({})).toBeUndefined();
  });
});

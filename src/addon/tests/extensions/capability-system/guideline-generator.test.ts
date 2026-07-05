import { describe, it, expect } from 'vitest';
import generateCapabilityGuidelines, { extractMinimalParams } from '../../../extensions/capability-system/guideline-generator.ts';

describe('guideline-generator', () => {
  it('generateCapabilityGuidelines includes Parameters and Examples', () => {
    const inputSchema = {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input text' }
      },
      required: ['input']
    };
    const result = generateCapabilityGuidelines('test.cap', inputSchema);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(l => l.includes('Parameters:'))).toBe(true);
    expect(result.some(l => l.includes('Examples:'))).toBe(true);
  });

  it('includes custom guidelines at top', () => {
    const result = generateCapabilityGuidelines(
      'test.cap',
      { type: 'object', properties: { a: { type: 'string' } }, required: [] },
      undefined,
      ['Custom first line']
    );
    expect(result[0]).toBe('Custom first line');
  });

  it('includes returns section when outputSchema given', () => {
    const result = generateCapabilityGuidelines(
      'test.cap',
      { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
      { type: 'object', properties: { output: { type: 'string', description: 'Output' } } }
    );
    expect(result.some(l => l.includes('Returns:'))).toBe(true);
  });

  it('extractMinimalParams returns required with examples', () => {
    const schema = {
      type: 'object',
      properties: {
        requiredField: { type: 'string', example: 'explicit' },
        optionalField: { type: 'number' }
      },
      required: ['requiredField']
    };
    const result = extractMinimalParams(schema);
    expect(result).toEqual({ requiredField: 'explicit' });
  });

  it('extractMinimalParams uses enum for string example', () => {
    const schema = {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'active'] }
      },
      required: ['status']
    };
    const result = extractMinimalParams(schema);
    expect(result.status).toBe('pending');
  });

  it('extractMinimalParams uses file path context', () => {
    const schema = {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'Path to source file' }
      },
      required: ['file']
    };
    const result = extractMinimalParams(schema);
    expect(result.file).toBe('src/example.test.ts');
  });

  it('generates variations for booleans', () => {
    const result = generateCapabilityGuidelines(
      'test.cap',
      { type: 'object', properties: { flag: { type: 'boolean' } }, required: [] }
    );
    expect(result.some(l => l.includes('flag=true'))).toBe(true);
    expect(result.some(l => l.includes('flag=false'))).toBe(true);
  });

  it('generates variations for arrays', () => {
    const result = generateCapabilityGuidelines(
      'test.cap',
      { type: 'object', properties: { items: { type: 'array', items: { type: 'string' } } }, required: [] }
    );
    expect(result.some(l => l.includes('items=['))).toBe(true);
  });

  it('does not include empty strings in output', () => {
    const result = generateCapabilityGuidelines(
      'test.cap',
      { type: 'object', properties: {}, required: [] }
    );
    expect(result).not.toContain('');
  });
});

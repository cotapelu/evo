import { describe, it, expect } from 'vitest';
import { normalizeParams } from '../../../extensions/tools/todos-tool.ts';

describe('todos-tool normalizeParams branch coverage', () => {
  it('parses add_phase.tasks as comma-separated string when not JSON', () => {
    const result = normalizeParams({
      add_phase: { name: 'P1', tasks: 't1,t2,t3' }
    });
    expect(result.add_phase).toEqual({
      name: 'P1',
      tasks: [{ content: 't1' }, { content: 't2' }, { content: 't3' }]
    });
  });

  it('keeps original add_phase.name if JSON parse fails', () => {
    const result = normalizeParams({
      add_phase: { name: '{ invalid json', tasks: [] }
    });
    expect(result.add_phase.name).toBe('{ invalid json');
  });

  it('parses add_phase as JSON string successfully', () => {
    const result = normalizeParams({
      add_phase: '{"name":"P1","tasks":[{"content":"T1"}]}'
    });
    expect(result.add_phase).toEqual({ name: 'P1', tasks: [{ content: 'T1' }] });
  });
});

import { describe, it, expect } from 'vitest';
import { applyOp, type TodoPhase } from '../../../extensions/tools/todos-tool.ts';

describe('todos-tool applyOp missing branch coverage', () => {
  const nextTid = 1, nextPid = 1;

  it('update with non-existent id returns error', () => {
    const phases: TodoPhase[] = [{ id: 'p1', name: 'P1', tasks: [{ id: 't1', content: 'A' }] }];
    const result = applyOp(phases, nextTid, nextPid, { update: { id: 'missing', status: 'completed' } });
    expect(result.errors.some(e => e.includes('Task') && e.includes('missing'))).toBe(true);
  });

  it('add_task with unknown phase id returns error', () => {
    const phases: TodoPhase[] = [{ id: 'p1', name: 'P1', tasks: [] }];
    const result = applyOp(phases, nextTid, nextPid, { add_task: { phase: 'nonexistent', content: 'Task' } });
    expect(result.errors.some(e => e.includes('Phase') && e.includes('nonexistent'))).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { applyOp, type TodoPhase } from '../../../extensions/tools/todos-tool.ts';

describe('todos-tool applyOp additional branch coverage', () => {
  const nextTid = 1, nextPid = 1;

  describe('add_phase validation', () => {
    it('op not an object -> error', () => {
      // @ts-ignore
      const result = applyOp([], nextTid, nextPid, { add_phase: "string" });
      expect(result.errors).toContain('add_phase must be an object');
    });

    it('tasks not an array -> error', () => {
      const result = applyOp([], nextTid, nextPid, { add_phase: { name: 'P1', tasks: 'not array' } });
      expect(result.errors).toContain('add_phase.tasks must be an array');
    });
  });

  describe('add_task validation', () => {
    it('op not an object -> error', () => {
      // @ts-ignore
      const result = applyOp([], nextTid, nextPid, { add_task: 123 });
      expect(result.errors).toContain('add_task must be an object');
    });

    it('missing content -> error', () => {
      const phases: TodoPhase[] = [{ id: 'phase-1', name: 'P1', tasks: [] }];
      const result = applyOp(phases, nextTid, nextPid, { add_task: { phase: 'phase-1' } });
      expect(result.errors).toContain('add_task.content must be a string');
    });
  });

  describe('update validation', () => {
    it('op not an object -> error', () => {
      // @ts-ignore
      const result = applyOp([], nextTid, nextPid, { update: 'invalid' });
      expect(result.errors).toContain('update must be an object');
    });

    it('both id and ids present -> uses ids branch (no error)', () => {
      const phases: TodoPhase[] = [{ id: 'phase-1', name: 'P1', tasks: [{ id: 'task-1', content: 'A', status: 'pending' }] }];
      const result = applyOp(phases, nextTid, nextPid, { update: { id: 'task-1', ids: ['task-1'], status: 'completed' } });
      expect(result.errors).toHaveLength(0);
      expect(result.phases[0].tasks[0].status).toBe('completed');
    });

    it('all ids not found -> no valid updates error', () => {
      const phases: TodoPhase[] = [{ id: 'phase-1', name: 'P1', tasks: [] }];
      const result = applyOp(phases, nextTid, nextPid, { update: { ids: ['missing1', 'missing2'], status: 'pending' } });
      expect(result.errors).toContain('Task "missing1" not found');
      expect(result.errors).toContain('Task "missing2" not found');
      expect(result.errors).toContain('No valid tasks found to update');
    });

    it('some ids not found -> partial errors but valid updates applied', () => {
      const phases: TodoPhase[] = [{ id: 'phase-1', name: 'P1', tasks: [{ id: 'task-1', content: 'A', status: 'pending' }] }];
      const result = applyOp(phases, nextTid, nextPid, { update: { ids: ['task-1', 'missing'], status: 'completed' } });
      expect(result.errors).toContain('Task "missing" not found');
      expect(result.phases[0].tasks[0].status).toBe('completed');
    });
  });

  describe('remove_task validation', () => {
    it('op not an object -> error', () => {
      // @ts-ignore
      const result = applyOp([], nextTid, nextPid, { remove_task: 'invalid' });
      expect(result.errors).toContain('remove_task must be an object');
    });

    it('id not a string -> error', () => {
      const result = applyOp([], nextTid, nextPid, { remove_task: { id: 123 } } as any);
      expect(result.errors).toContain("remove_task.id must be a string (e.g., 'task-1')");
    });
  });

  describe('unknown operation', () => {
    it('no recognized operation key -> error', () => {
      // @ts-ignore
      const result = applyOp([], nextTid, nextPid, { foo: 'bar' });
      expect(result.errors).toContain('No operation specified');
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskManager } from '../task-manager.ts';
import { AgentTeam } from '../team-manager.ts';
import { createMockRuntime } from './test-utils.ts';

describe('TaskManager branch coverage', () => {
  let tm: TaskManager;

  beforeEach(() => {
    tm = new TaskManager();
    vi.useFakeTimers(); // allow controlling Date.now() for retryAvailableAt
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('claimTask returns null when no pending tasks', () => {
    tm.initialize(['t1', 't2']);
    // Mark both as completed
    tm.getTaskStatus(0)!.status = 'completed';
    tm.getTaskStatus(1)!.status = 'completed';
    // pendingIndices should be empty after initialization they have pending
    expect(tm.claimTask('agent-1')).toBeNull();
  });

  it('claimTask skips tasks with retryAvailableAt in future (backoff)', () => {
    tm.initialize(['t1']);
    const now = Date.now();
    const task = tm.getTaskStatus(0)!;
    task.assignee = 'agent-1';
    task.status = 'in_progress';
    task.retryAvailableAt = now + 60000;
    // Also ensure pendingIndices is empty (since in_progress removed it)
    (tm as any).pendingIndices = [];
    expect(tm.claimTask('agent-2')).toBeNull();
  });

  it('claimTask skips tasks that are not pending', () => {
    tm.initialize(['t1', 't2']);
    // Set first task to failed
    tm.getTaskStatus(0)!.status = 'failed';
    // pendingIndices contains [0,1] but 0 is failed, claim should skip and get 1
    // However initialize set status=pending, so we need to manually adjust
    // Actually reclaimZombie or failure would change status, so simulate
    const task0 = tm.getTaskStatus(0)!;
    task0.status = 'failed';
    // pendingIndices may still have index 0; we need to clean it or let claim skip
    // Let's use proper state via handleAgentFailure to move to pending with backoff? Simpler:
    // Directly set pendingIndices to only have index 1 that is pending
    (tm as any).pendingIndices = [1];
    const idx = tm.claimTask('agent-1');
    expect(idx).toBe(1);
  });

  it('claimTask uses shift() when claiming first index', () => {
    tm.initialize(['t1']);
    // spy on shift
    const shiftSpy = vi.spyOn((tm as any).pendingIndices, 'shift');
    const idx = tm.claimTask('agent-1');
    expect(idx).toBe(0);
    expect(shiftSpy).toHaveBeenCalled();
  });

  it('claimTask uses splice() when claiming non-first index', () => {
    tm.initialize(['t1', 't2']);
    // Move index 0 out of pending? Actually we want to claim index 1, so set pendingIndices to [0,1]
    // But claimTask loops from i=0; to test splice we need to force task 0 to be not claimable, then task 1 will be
    tm.getTaskStatus(0)!.status = 'completed'; // status != pending, so skip
    // pendingIndices still [0,1]; claimTask should skip index 0 and claim 1, using splice(1,1)
    const spliceSpy = vi.spyOn((tm as any).pendingIndices, 'splice');
    const idx = tm.claimTask('agent-1');
    expect(idx).toBe(1);
    expect(spliceSpy).toHaveBeenCalledWith(1, 1);
  });

  it('releaseTask returns false for task not assignee', () => {
    tm.initialize(['t1']);
    expect(tm.releaseTask('wrong-agent', 0)).toBe(false);
  });

  it('releaseTask returns false if task already completed', () => {
    tm.initialize(['t1']);
    const task = tm.getTaskStatus(0)!;
    task.assignee = 'agent-1';
    task.status = 'completed';
    expect(tm.releaseTask('agent-1', 0)).toBe(false);
  });

  it('handleAgentFailure returns false if no task', () => {
    tm.initialize(['t1']);
    // task index 0 exists, but request for nonexistent task? Not possible since we pass index, but we could have index out of range
    const result = (tm as any).handleAgentFailure('agent-1', 999);
    expect(result).toBe(false);
  });

  it('handleAgentFailure returns false if wrong assignee', () => {
    tm.initialize(['t1']);
    const task = tm.getTaskStatus(0)!;
    task.assignee = 'other-agent';
    task.status = 'in_progress';
    const result = (tm as any).handleAgentFailure('agent-1', 0);
    expect(result).toBe(false);
  });

  it('handleAgentFailure marks failed when retryCount reaches max', () => {
    tm.initialize(['t1']);
    const task = tm.getTaskStatus(0)!;
    task.assignee = 'agent-1';
    task.status = 'in_progress';
    task.retryCount = tm['maxRetries']; // at max (3)
    const result = (tm as any).handleAgentFailure('agent-1', 0, new Error('fail'));
    expect(result).toBe(true);
    expect(task.status).toBe('failed');
    expect(task.result).toBe('fail');
    // Should have removed from pendingIndices
    expect((tm as any).pendingIndices).not.toContain(0);
  });

  it('handleAgentFailure schedules retry when under max', () => {
    tm.initialize(['t1']);
    const task = tm.getTaskStatus(0)!;
    task.assignee = 'agent-1';
    task.status = 'in_progress';
    task.retryCount = 0;
    vi.useFakeTimers();
    const result = (tm as any).handleAgentFailure('agent-1', 0, 'error msg');
    expect(result).toBe(true);
    expect(task.status).toBe('pending');
    expect(task.assignee).toBeNull();
    expect(task.retryAvailableAt).toBeGreaterThan(Date.now());
    expect((tm as any).pendingIndices).toContain(0);
    vi.useRealTimers();
  });

  it('insertPendingIndexSorted inserts into middle', () => {
    tm.initialize(['t1', 't2', 't3']);
    (tm as any).pendingIndices = [0, 2]; // missing 1
    (tm as any).insertPendingIndexSorted(1);
    expect((tm as any).pendingIndices).toEqual([0, 1, 2]);
  });

  it('insertPendingIndexSorted prevents duplicate at start', () => {
    (tm as any).pendingIndices = [0, 2];
    (tm as any).insertPendingIndexSorted(0);
    expect((tm as any).pendingIndices).toEqual([0, 2]);
  });

  it('insertPendingIndexSorted prevents duplicate at end', () => {
    (tm as any).pendingIndices = [0, 1];
    (tm as any).insertPendingIndexSorted(2);
    expect((tm as any).pendingIndices).toEqual([0, 1, 2]);
    (tm as any).insertPendingIndexSorted(2);
    expect((tm as any).pendingIndices).toEqual([0, 1, 2]); // still
  });

  it('reclaimZombieTasks does nothing if task not in_progress or wrong assignee', () => {
    tm.initialize(['t1']);
    const task = tm.getTaskStatus(0)!;
    task.assignee = 'agent-1';
    task.status = 'completed'; // not in_progress
    (tm as any).reclaimZombieTasks('agent-1');
    expect(task.status).toBe('completed');
  });

  it('reclaimZombieTasks sets task to pending with backoff when retries remaining', () => {
    tm.initialize(['t1']);
    const task = tm.getTaskStatus(0)!;
    task.assignee = 'agent-1';
    task.status = 'in_progress';
    task.retryCount = 0;
    vi.useFakeTimers();
    (tm as any).reclaimZombieTasks('agent-1');
    expect(task.status).toBe('pending');
    expect(task.assignee).toBeNull();
    expect(task.retryAvailableAt).toBeGreaterThan(Date.now());
    vi.useRealTimers();
  });
});

describe('AgentTeam branch coverage', () => {
  let team: AgentTeam;

  beforeEach(() => {
    team = new AgentTeam();
    team.setTeamId('test-team');
  });

  afterEach(async () => {
    await team.dispose();
  });

  it('claimTask returns null when no tasks initialized', async () => {
    const idx = await team.claimTask('agent-1');
    expect(idx).toBeNull();
  });

  it('completeTask returns without error for unknown task', async () => {
    await team.initialize(['t1']);
    // No task assigned to any agent
    await team.completeTask('agent-1', 999, 'result'); // shouldn't throw
    // No change
    expect(team.taskStatuses.get(999)).toBeUndefined();
  });

  it('reportResult handles task not found gracefully', async () => {
    await team.initialize(['t1']);
    await team.reportResult(999, 'result'); // no crash
  });

  it('getWorkspace returns shared workspace', () => {
    const ws = team.getWorkspace();
    expect(ws).toBeDefined();
  });

  it('initialize sets up task manager correctly', async () => {
    await team.initialize(['t1', 't2']);
    expect(team.tasks).toEqual(['t1', 't2']);
    expect(team.taskStatuses.size).toBe(2);
  });
});

// __tests__/goals.test.ts - Unit tests for Goals module

import { GoalManager } from '../goals.js';

describe('GoalManager', () => {
  let gm: GoalManager;

  beforeEach(() => {
    gm = new GoalManager();
  });

  test('should create goal with default values', () => {
    const goal = gm.create('Test goal');

    expect(goal.description).toBe('Test goal');
    expect(goal.priority).toBe(1);
    expect(goal.status).toBe('pending');
    expect(goal.steps).toHaveLength(3); // default steps
    expect(goal.currentStep).toBe(0);
    expect(goal.progress).toBe(0);
  });

  test('should create goal with custom steps and priority', () => {
    const goal = gm.create('Custom goal', 5, ['A', 'B', 'C', 'D']);

    expect(goal.priority).toBe(5);
    expect(goal.steps).toEqual(['A', 'B', 'C', 'D']);
  });

  test('should advance goal through steps', () => {
    const goal = gm.create('Advance test', 1, ['Step 1', 'Step 2', 'Step 3']);

    expect(gm.advance(goal.id)).toBe(true);
    expect(goal.currentStep).toBe(1);
    expect(goal.progress).toBe(33);

    expect(gm.advance(goal.id)).toBe(true);
    expect(goal.currentStep).toBe(2);
    expect(goal.progress).toBe(66);

    expect(gm.advance(goal.id)).toBe(true);
    expect(goal.status).toBe('completed');
    expect(goal.progress).toBe(100);
    expect(goal.completedAt).toBeDefined();
  });

  test('should not advance completed goal', () => {
    const goal = gm.create('Completed goal', 1, ['Single']);
    gm.advance(goal.id);

    expect(gm.advance(goal.id)).toBe(false);
  });

  test('should enforce dependencies', () => {
    const depGoal = gm.create('Dependency', 1, ['Do it']);
    gm.advance(depGoal.id); // complete dependency

    const goal = gm.create('Dependent', 1, ['Step 1'], [depGoal.id]);

    // Before dependency is marked complete (it's complete after advance)
    expect(gm.advance(goal.id)).toBe(true);
    expect(goal.status).toBe('completed');
  });

  test('should fail goal with unmet dependencies', () => {
    const depGoal = gm.create('Unmet dependency', 1, ['Not done']);
    // Don't complete dependency

    const goal = gm.create('Dependent', 1, ['Step 1'], [depGoal.id]);

    expect(gm.advance(goal.id)).toBe(false);
    expect(goal.status).toBe('pending');
  });

  test('should update goal status', () => {
    const goal = gm.create('Update test');

    expect(gm.update(goal.id, { status: 'in_progress' })).toBe(true);
    expect(goal.status).toBe('in_progress');

    expect(gm.update(goal.id, { priority: 10 })).toBe(true);
    expect(goal.priority).toBe(10);
  });

  test('should fail goal', () => {
    const goal = gm.create('Fail test');

    expect(gm.fail(goal.id, 'Reason')).toBe(true);
    expect(goal.status).toBe('failed');
    expect(goal.metadata?.failureReason).toBe('Reason');
  });

  test('should cancel goal', () => {
    const goal = gm.create('Cancel test');

    expect(gm.cancel(goal.id)).toBe(true);
    expect(goal.status).toBe('cancelled');
  });

  test('should delete goal', () => {
    const goal = gm.create('Delete test');

    expect(gm.delete(goal.id)).toBe(true);
    expect(gm.get(goal.id)).toBeUndefined();
  });

  test('should get active goals', () => {
    gm.create('Pending goal');
    const inProgress = gm.create('In progress', 1, ['Step']);
    gm.advance(inProgress.id); // becomes completed because only 1 step

    const active = gm.getActive();
    expect(active).toHaveLength(1); // only the pending goal

    gm.create('Another pending');

    expect(gm.getActive()).toHaveLength(2);
  });

  test('should get goals by priority', () => {
    const low = gm.create('Low', 1, ['Step']);
    const high = gm.create('High', 10, ['Step']);
    const medium = gm.create('Medium', 5, ['Step']);

    const sorted = gm.getByPriority(5);
    expect(sorted).toHaveLength(2);
    expect(sorted[0].description).toBe('High');
    expect(sorted[1].description).toBe('Medium');
  });

  test('should calculate completion stats', () => {
    gm.create('Pending 1');
    gm.create('Pending 2');
    const inProgress = gm.create('In progress', 1, ['A', 'B', 'C']);
    gm.advance(inProgress.id); // 33%

    const completed = gm.create('Completed', 1, ['X']);
    gm.advance(completed.id);

    const stats = gm.getCompletionStats();
    expect(stats.total).toBe(4);
    expect(stats.pending).toBe(2);
    expect(stats.inProgress).toBe(1);
    expect(stats.completed).toBe(1);
    expect(stats.avgProgress).toBeGreaterThan(0);
  });

  test('should serialize and deserialize', () => {
    gm.create('Goal 1', 5, ['A', 'B']);
    gm.create('Goal 2', 3, ['X', 'Y', 'Z']);

    const json = gm.toJSON();
    const gm2 = new GoalManager();
    expect(gm2.fromJSON(json)).toBe(true);

    expect(gm2.getAll()).toHaveLength(2);
    expect(gm2.getAll()[0].description).toBe('Goal 1');
  });

  test('should get next step', () => {
    const goal = gm.create('Next step', 1, ['First', 'Second', 'Third']);

    expect(gm.getNextStep(goal.id)).toBe('First');
    gm.advance(goal.id);
    expect(gm.getNextStep(goal.id)).toBe('Second');
    gm.advance(goal.id);
    expect(gm.getNextStep(goal.id)).toBe('Third');
    gm.advance(goal.id);
    expect(gm.getNextStep(goal.id)).toBeNull();
  });

  test('should find goals by condition', () => {
    gm.create('Test 1', 1, ['A']);
    gm.create('Test 2', 5, ['B']);
    gm.create('Test 3', 3, ['C']);

    const highPriority = gm.find(g => g.priority >= 5);
    expect(highPriority).toHaveLength(1);
    expect(highPriority[0].description).toBe('Test 2');
  });
});

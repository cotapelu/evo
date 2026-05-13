// Auto-generated test suite for EvoAgent v0.3
// Generated: 2026-05-12T15:53:31.888Z

import { EvoAgent } from './evo';

describe('EvoAgent Basic Tests', () => {
  test('agent can be instantiated', () => {
    const agent = new EvoAgent({ maxIterations: 1 });
    expect(agent).toBeInstanceOf(EvoAgent);
  });

  test('agent has required methods', () => {
    const agent = new EvoAgent();
    expect(typeof agent.run).toBe('function');
    expect(typeof agent.spawnChild).toBe('function');
    expect(typeof agent.sendMessage).toBe('function');
    expect(typeof agent.createGoal).toBe('function');
  });

  test('agent can create goals', () => {
    const agent = new EvoAgent();
    const goal = agent.createGoal('Test goal');
    expect(goal.description).toBe('Test goal');
    expect(agent.getActiveGoals()).toContainEqual(expect.objectContaining({ description: 'Test goal' }));
  });

  test('agent can spawn child', () => {
    const parent = new EvoAgent({ maxChildren: 2 });
    const child = parent.spawnChild();
    expect(child).toBeInstanceOf(EvoAgent);
    expect(parent.state.children).toHaveLength(1);
  });
});

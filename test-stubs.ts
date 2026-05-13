// Comprehensive test suite for EvoAgent
// Auto-generated - run with: npx jest test-stubs.ts or vitest

import { EvoAgent, EvolutionMetrics, Goal } from './evo.ts';

// Mock utilities
const mockNowISO = () => '2026-01-01T00:00:00.000Z';

describe('EvoAgent Core', () => {
  let agent: EvoAgent;

  beforeEach(() => {
    agent = new EvoAgent({
      maxIterations: 1,
      enableReplication: false,
      memoryPath: 'test-memory.json'
    });
  });

  afterEach(async () => {
    // Cleanup
  });

  test('initialization', () => {
    expect(agent.id).toBeDefined();
    expect(agent.state.level).toBeGreaterThan(0);
    expect(agent.state.capabilities).toContain('self-awareness');
    expect(agent.state.config).toBeDefined();
  });

  test('goal management', () => {
    const goal = agent.createGoal('Test goal', 1, ['Step 1', 'Step 2']);
    expect(goal.id).toBeDefined();
    expect(goal.status).toBe('pending');
    expect(goal.steps.length).toBe(2);

    const advanced = agent.advanceGoal(goal.id);
    expect(advanced).toBe(true);
    expect(goal.currentStep).toBe(1);
    expect(goal.status).toBe('in_progress');

    agent.advanceGoal(goal.id);
    expect(goal.status).toBe('completed');
    expect(goal.completedAt).toBeDefined();
  });

  test('goal dependencies', () => {
    const dep = agent.createGoal('Dependency', 1, ['Done']);
    agent.advanceGoal(dep.id);

    const main = agent.createGoal('Main', 1, ['Step'], [dep.id]);
    expect(main.dependencies).toContain(dep.id);

    // Should not advance if dep not complete (already complete, so ok)
    const result = agent.advanceGoal(main.id);
    expect(result).toBe(true);
  });

  test('messaging', () => {
    const messages = agent['state'].messages;
    agent.sendMessage('recipient-123', { data: 'test' }, 'request', 1, 10);
    expect(messages.length).toBe(1);
    expect(messages[0].to).toBe('recipient-123');
    expect(messages[0].type).toBe('request');
    expect(messages[0].ttl).toBe(10);

    // Test broadcast
    agent.state.children = ['child1', 'child2'];
    agent.broadcast({ broadcast: true });
    expect(messages.length).toBe(3); // +2 children
  });

  test('memory persistence', async () => {
    agent.state.memory.set('test-key', 'test-value');
    await agent['saveMemory']();

    // Verify file created and contains data
    const saved = JSON.parse(fs.readFileSync('memory.json', 'utf-8'));
    expect(saved.state.memory).toContainEqual(['test-key', 'test-value']);
  });

  test('health monitoring', () => {
    const health = agent['performHealthCheck']();
    expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
    expect(health.memoryPressure).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(health.issues)).toBe(true);
  });

  test('statistics tracking', () => {
    const initialIter = agent.state.stats.totalIterations;
    agent.sendMessage('test', 'data');
    expect(agent.state.stats.totalMessagesSent).toBe(1);
  });

  test('sandbox enforcement', () => {
    // Try to read outside allowed path should throw
    expect(() => agent.fs.readFile('/etc/passwd')).toThrow('denied');
  });
});

describe('FileSystem', () => {
  test('basic operations', () => {
    const fs = new (require('./evo.ts').FileSystem)('.');
    fs.writeFile('test.txt', 'hello');
    expect(fs.exists('test.txt')).toBe(true);
    const content = fs.readFile('test.txt');
    expect(content).toBe('hello');
    fs.deleteFile('test.txt');
    expect(fs.exists('test.txt')).toBe(false);
  });

  test('directory listing', () => {
    const fs = new (require('./evo.ts').FileSystem)('.');
    const files = fs.listFiles('.');
    expect(Array.isArray(files)).toBe(true);
  });
});

describe('Evolution Metrics', () => {
  test('metrics structure', () => {
    const metric: EvolutionMetrics = {
      iteration: 1,
      level: 10,
      capabilities: ['test'],
      performance: { memoryUsage: 10, cpuTime: 100, uptime: 1 },
      codeQuality: { linesOfCode: 100 },
      changes: [],
      bugsFixed: 0,
      timestamp: new Date().toISOString(),
      health: 'healthy'
    };
    expect(metric.iteration).toBe(1);
  });
});

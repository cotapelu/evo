import { TeamManager } from '../extensions/team-agent/team-manager.js';
import type { TeamAgentInfo } from '../extensions/team-agent/team-manager.js';
import { jest } from '@jest/globals';

describe('TeamManager Concurrency Guards', () => {
  let manager: TeamManager;

  beforeEach(() => {
    const mockPi = {
      authStorage: {},
      settingsManager: {},
      modelRegistry: { getModel: () => ({ id: 'test', provider: 'anthropic' }) }
    };
    manager = new TeamManager(process.cwd(), '.agent', mockPi as any);
  });

  function mockAgent(name: string, status: 'idle' | 'busy' = 'idle') {
    const info: TeamAgentInfo = {
      name,
      systemPrompt: 'You are a test agent.',
      status,
      turnCount: 0,
    };
    (manager as any).agentInfos.set(name, info);
    (manager as any).agents.set(name, {
      session: {
        prompt: jest.fn(),
        state: { messages: [] } // minimal state to avoid errors
      },
      dispose: jest.fn()
    } as any);
  }

  it('should throw when runTask called on already busy agent', async () => {
    mockAgent('worker', 'idle');

    const runtime = (manager as any).agents.get('worker');
    const pending = new Promise<void>((resolve) => {
      (runtime.session as any)._resolve = resolve;
    });
    (runtime.session.prompt as jest.Mock).mockReturnValue(pending);

    // First task starts and sets status to busy
    const p1 = manager.runTask('worker', 'task1');
    // Allow the runTask coroutine to start (set status = busy and await)
    await Promise.resolve();

    // Verify busy
    const info = manager.listAgents().find(a => a.name === 'worker')!;
    expect(info.status).toBe('busy');

    // Second call should indicate busy (sync throw or async reject)
    // Since runTask throws synchronously when busy, wrap in Promise.resolve to capture as rejection
    await expect(Promise.resolve(manager.runTask('worker', 'task2')))
      .rejects.toThrow('already busy');

    // Cleanup
    (runtime.session as any)._resolve();
    await p1;
  });

  it('should throw when removing a busy agent', () => {
    mockAgent('busy-agent', 'busy');
    expect(() => manager.removeAgent('busy-agent')).toThrow('busy and cannot be removed');
  });

  it('should allow removing idle agent', () => {
    mockAgent('idle-agent', 'idle');
    const result = manager.removeAgent('idle-agent');
    expect(result).toBe(true);
    expect(manager.listAgents().some(a => a.name === 'idle-agent')).toBe(false);
  });
});

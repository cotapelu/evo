import { jest } from '@jest/globals';
import { TeamManager } from '../extensions/team-agent/team-manager.js';
import type { TeamAgentConfig } from '../extensions/team-agent/team-manager.js';

// Mock pi API
const mockPi = {
  authStorage: null as any,
  settingsManager: null as any,
  modelRegistry: {
    getModel: (id: string) => ({ id, provider: 'anthropic' } as any),
  } as any,
  exec: jest.fn(() => Promise.resolve({ stdout: '', code: 0 })),
  ui: { notify: jest.fn(), select: jest.fn(), input: jest.fn() },
};

describe('TeamManager', () => {
  let manager: TeamManager;
  const testCwd = '/tmp/test-cwd';
  const testAgentDir = '/tmp/test-agent-dir';

  beforeEach(async () => {
    manager = new TeamManager(testCwd, testAgentDir, mockPi);
  });

  describe('agent management', () => {
    it('should start with no agents', () => {
      expect(manager.listAgents()).toEqual([]);
      expect(manager.getAgentCount()).toBe(0);
      expect(manager.hasAgent('any')).toBe(false);
    });

    it('should add and list agents', async () => {
      // Directly manipulate the internal maps to simulate created agents
      // (without actually spawning runtimes, which requires LLM API)
      const config1: TeamAgentConfig = {
        name: 'agent1',
        systemPrompt: 'System 1',
        model: 'claude-sonnet',
        tools: ['read'],
        thinkingLevel: 'medium',
      };
      const config2: TeamAgentConfig = {
        name: 'agent2',
        systemPrompt: 'System 2',
        model: 'claude-haiku',
        tools: ['bash'],
        thinkingLevel: 'low',
      };

      // Use reflection to add agents without runtime (for unit test)
      // In real usage, createAgent() spawns runtime
      // Here we test listAgents() and hasAgent() logic
      (manager as any).agentConfigs.set('agent1', config1);
      (manager as any).agentInfos.set('agent1', {
        name: 'agent1',
        systemPrompt: 'System 1',
        model: 'claude-sonnet',
        tools: ['read'],
        status: 'idle',
        turnCount: 0,
      });

      (manager as any).agentConfigs.set('agent2', config2);
      (manager as any).agentInfos.set('agent2', {
        name: 'agent2',
        systemPrompt: 'System 2',
        model: 'claude-haiku',
        tools: ['bash'],
        status: 'idle',
        turnCount: 0,
      });

      // Also mock agents map (would contain runtimes with dispose)
      const mockDispose = jest.fn();
      (manager as any).agents.set('agent1', { dispose: mockDispose } as any);
      (manager as any).agents.set('agent2', { dispose: mockDispose } as any);

      expect(manager.getAgentCount()).toBe(2);
      expect(manager.hasAgent('agent1')).toBe(true);
      expect(manager.hasAgent('agent2')).toBe(true);
      expect(manager.hasAgent('missing')).toBe(false);

      const list = manager.listAgents();
      expect(list.length).toBe(2);
      expect(list.map(a => a.name).sort()).toEqual(['agent1', 'agent2']);
    });

    it('should remove agents', () => {
      // Setup mock agents
      const mockDispose = jest.fn();
      (manager as any).agents.set('toremove', { dispose: mockDispose } as any);
      (manager as any).agentConfigs.set('toremove', { name: 'toremove', systemPrompt: '' });
      (manager as any).agentInfos.set('toremove', { name: 'toremove', systemPrompt: '', status: 'idle', turnCount: 0 });

      expect(manager.hasAgent('toremove')).toBe(true);
      expect(manager.getAgentCount()).toBe(1);

      const removed = manager.removeAgent('toremove');
      expect(removed).toBe(true);
      expect(mockDispose).toHaveBeenCalled();
      expect(manager.hasAgent('toremove')).toBe(false);
      expect(manager.getAgentCount()).toBe(0);
    });

    it('removeAgent returns false for non-existent', () => {
      const removed = manager.removeAgent('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('agent info', () => {
    it('should return empty list when no agents', () => {
      expect(manager.listAgents()).toEqual([]);
    });

    it('listAgents returns correct info', () => {
      const info = {
        name: 'test',
        systemPrompt: 'prompt',
        model: 'claude-sonnet',
        tools: ['read', 'bash'],
        status: 'busy' as const,
        turnCount: 5,
        lastTask: 'some task',
        lastResult: 'some result',
      };
      (manager as any).agentInfos.set('test', info);
      (manager as any).agents.set('test', {} as any);

      const agents = manager.listAgents();
      expect(agents.length).toBe(1);
      expect(agents[0]).toMatchObject(info);
    });
  });

  describe('extension registration', () => {
    it('should register all team tools when loaded', async () => {
      const registerToolSpy = jest.fn();
      const pi = {
        ...mockPi,
        registerTool: registerToolSpy,
        on: jest.fn(),
      };

      const ext = await import('../extensions/team-agent/index.js');
      ext.default(pi as any);

      // Should register 5 team tools
      expect(registerToolSpy).toHaveBeenCalledTimes(5);

      const toolNames = registerToolSpy.mock.calls.map((call: any[]) => call[0].name);
      expect(toolNames).toContain('team_create');
      expect(toolNames).toContain('team_list');
      expect(toolNames).toContain('team_run');
      expect(toolNames).toContain('team_broadcast');
      expect(toolNames).toContain('team_remove');
    });

    it('should bind session_start event for preloading agents', async () => {
      const onSpy = jest.fn();
      const pi = {
        ...mockPi,
        registerTool: jest.fn(),
        on: onSpy,
      };

      const ext = await import('../extensions/team-agent/index.js');
      ext.default(pi as any);

      // Should bind session_start event
      expect(onSpy).toHaveBeenCalledWith('session_start', expect.any(Function));
    });
  });
});

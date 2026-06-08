import { jest } from '@jest/globals';
import { createTeamTool } from '../team-tool.js';
import { TeamRegistry } from '../team-manager.js';

// Create a mock registry instance
const mockRegistryInstance = {
  get: jest.fn(),
  resetAutoDisposeTimer: jest.fn()
};

// Spy on TeamRegistry.getInstance to return our mock
jest.spyOn(TeamRegistry, 'getInstance').mockReturnValue(mockRegistryInstance as any);

const mockCtx: any = {
  runtime: { session: { id: 'test-session' } },
  session: { id: 'test-session' },
};

describe('team_run tool - query operations', () => {
  const tool = createTeamTool();
  const toolCallId = 'test-call-1';

  beforeEach(() => {
    jest.clearAllMocks();
    mockRegistryInstance.get.mockReset();
    mockRegistryInstance.resetAutoDisposeTimer.mockReset();
  });

  test('query: returns error if teamId not found', async () => {
    mockRegistryInstance.get.mockReturnValue(undefined);
    const result: any = await tool.execute(toolCallId, { teamId: 'missing' }, undefined, undefined, mockCtx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });

  test('query: returns team status if found', async () => {
    const fakeTeam = {
      id: 'team-123',
      getTeamStatus: jest.fn().mockResolvedValue({
        totalTasks: 10,
        completedTasks: 5,
        agents: [{ id: 'a1' }, { id: 'a2' }]
      })
    };
    mockRegistryInstance.get.mockReturnValue(fakeTeam);

    const result: any = await tool.execute(toolCallId, { teamId: 'team-123' }, undefined, undefined, mockCtx);

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('5/10 tasks completed');
    expect(result.details?.teamId).toBe('team-123');
    expect(mockRegistryInstance.resetAutoDisposeTimer).toHaveBeenCalledWith('team-123');
  });

  test('query: resets auto-dispose timer', async () => {
    const fakeTeam = {
      getTeamStatus: jest.fn().mockResolvedValue({ totalTasks: 1, completedTasks: 1, agents: [] })
    };
    mockRegistryInstance.get.mockReturnValue(fakeTeam);

    await tool.execute(toolCallId, { teamId: 'any' }, undefined, undefined, mockCtx);
    expect(mockRegistryInstance.resetAutoDisposeTimer).toHaveBeenCalledWith('any');
  });
});

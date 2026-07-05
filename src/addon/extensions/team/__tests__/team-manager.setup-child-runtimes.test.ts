import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentTeam } from '../team-manager.ts';
import { createMockRuntime } from './test-utils.ts';

describe('AgentTeam setupChildRuntimes edge cases', () => {
  let team: AgentTeam;
  let parentRuntime: any;

  beforeEach(() => {
    team = new AgentTeam();
    team.setTeamId('test-team');
    parentRuntime = createMockRuntime();
    parentRuntime.session.sessionId = 'parent-session-123';
    // Ensure required service properties exist
    parentRuntime.services.agentDir = '/tmp/agent';
    team.registerRuntime(parentRuntime, 'parent');
  });

  afterEach(async () => {
    if (team && !team.disposed) {
      await team.dispose();
    }
  });

  it('throws when agentCwd resolves to undefined', async () => {
    // Register an agent role
    const agentRuntime = createMockRuntime();
    team.registerRuntime(agentRuntime, 'agent-1');

    await expect(
      team.setupChildRuntimes(parentRuntime, () => undefined)
    ).rejects.toThrow('agentCwd is undefined for role agent-1');
  });

  it('throws when createRuntime factory fails', async () => {
    const agentRuntime = createMockRuntime();
    team.registerRuntime(agentRuntime, 'agent-2');

    await expect(
      team.setupChildRuntimes(parentRuntime, '/tmp', {
        createRuntime: async () => { throw new Error('runtime creation failed'); }
      })
    ).rejects.toThrow('runtime creation failed');
  });

  it('throws after team disposed', async () => {
    await team.dispose();
    await expect(team.setupChildRuntimes(parentRuntime)).rejects.toThrow('Team disposed');
  });
});

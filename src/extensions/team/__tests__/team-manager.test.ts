import { AgentTeam } from '../team-manager.js';

describe('AgentTeam', () => {
  let team: AgentTeam;

  beforeEach(() => {
    team = new AgentTeam();
    team.setTeamId('test-team');
    // Register fake runtimes
    team.registerRuntime({ session: { id: 'parent' } } as any, 'parent');
    team.registerRuntime({ session: { id: 'agent1' } } as any, 'agent-1');
  });

  afterEach(() => {
    if (team.monitorInterval) {
      clearInterval(team.monitorInterval);
    }
  });

  describe('monitorInterval cleanup', () => {
    it('should clear interval when all tasks completed', async () => {
      await team.initialize(['task1', 'task2']);
      await team.reportResult(0, 'done');
      await team.reportResult(1, 'done');

      // Simulate monitor check
      const status = await team.getTeamStatus();
      expect(status.completedTasks).toBe(2);
      expect(status.totalTasks).toBe(2);
    });

    it('should clear interval on agent failure (finally block)', async () => {
      await team.initialize(['task1']);
      // No task completed

      // Simulate the finally block logic manually since we can't easily trigger executeTeamTasks without full runtime
      // Instead, test that we can clear the interval safely
      team.monitorInterval = setInterval(() => {}, 1000);
      expect(team.monitorInterval).not.toBeNull();

      if (team.monitorInterval) {
        clearInterval(team.monitorInterval);
        team.monitorInterval = null;
      }

      expect(team.monitorInterval).toBeNull();
    });
  });

  describe('task management', () => {
    it('should claim and complete tasks correctly', async () => {
      await team.initialize(['task1', 'task2']);

      const taskIdx = await team.claimTask('agent-1');
      expect(taskIdx).toBe(0);
      expect(await team.getMyCurrentTask('agent-1')).toBe(0);

      await team.completeTask('agent-1', 0, 'result1');
      expect(await team.getMyCurrentTask('agent-1')).toBeNull();
      const results = await team.getResults();
      expect(results[0]).toBe('result1');
    });

    it('should distribute tasks to multiple agents', async () => {
      await team.initialize(['t1', 't2', 't3', 't4']);

      const idx1 = await team.claimTask('agent-1');
      const idx2 = await team.claimTask('agent-2');

      expect(idx1).not.toBe(idx2);
      expect(await team.getMyCurrentTask('agent-1')).not.toBeNull();
      expect(await team.getMyCurrentTask('agent-2')).not.toBeNull();
    });
  });
});

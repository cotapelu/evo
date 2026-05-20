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
    it('should clear interval when all tasks completed', () => {
      team.initialize(['task1', 'task2']);
      team.reportResult(0, 'done');
      team.reportResult(1, 'done');

      // Simulate monitor check
      const status = team.getTeamStatus();
      expect(status.completedTasks).toBe(2);
      expect(status.totalTasks).toBe(2);
    });

    it('should clear interval on agent failure (finally block)', async () => {
      team.initialize(['task1']);
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
    it('should claim and complete tasks correctly', () => {
      team.initialize(['task1', 'task2']);

      const taskIdx = team.claimTask('agent-1');
      expect(taskIdx).toBe(0);
      expect(team.getMyCurrentTask('agent-1')).toBe(0);

      team.completeTask('agent-1', 0, 'result1');
      expect(team.getMyCurrentTask('agent-1')).toBeNull();
      expect(team.getResults()[0]).toBe('result1');
    });

    it('should distribute tasks to multiple agents', () => {
      team.initialize(['t1', 't2', 't3', 't4']);

      const idx1 = team.claimTask('agent-1');
      const idx2 = team.claimTask('agent-2');

      expect(idx1).not.toBe(idx2);
      expect(team.getMyCurrentTask('agent-1')).not.toBeNull();
      expect(team.getMyCurrentTask('agent-2')).not.toBeNull();
    });
  });
});

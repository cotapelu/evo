#!/usr/bin/env node
/**
 * Team Manager Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TeamManager } from '../team-manager.js';

// Mock ExtensionAPI
function createMockApi() {
  return {
    sendMessage: vi.fn(),
    on: vi.fn(),
    registerTool: vi.fn(),
    subscribe: vi.fn(),
    // add other methods as needed
  } as any;
}

describe('TeamManager', () => {

  let manager: TeamManager;
  let mockApi: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = createMockApi();
    manager = new TeamManager(mockApi);
  });

  describe('createTeam', () => {
    it('should create a new team with a unique ID', () => {
      const team = manager.createTeam('dev-team', { description: 'Development team' });

      expect(team.id).toMatch(/^team-\d+$/);
      expect(team.name).toBe('dev-team');
      expect(team.description).toBe('Development team');
      expect(team.agents).toEqual([]);
      expect(team.tasks).toEqual([]);
    });

    it('should add team to listTeams', () => {
      const team = manager.createTeam('test');
      const teams = manager.listTeams();

      expect(teams).toContain(team);
    });
  });

  describe('disbandTeam', () => {
    it('should remove team by ID', () => {
      const team = manager.createTeam('temp');
      const teamId = team.id;
      manager.disbandTeam(teamId);

      expect(manager.listTeams()).not.toContain(team);
    });

    it('should return false if team not found', () => {
      const result = manager.disbandTeam('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('addAgent', () => {
    it('should add agent to a team', () => {
      const team = manager.createTeam('team1');
      const agent = { type: 'agent' as const, name: 'Agent 1', capabilities: [] };
      const added = manager.addAgent(team.id, agent);

      expect(added).toBe(true);
      expect(team.agents).toContain(agent);
    });

    it('should return false if team not found', () => {
      const agent = { type: 'agent' as const, name: 'A', capabilities: [] };
      const result = manager.addAgent('no-team', agent);
      expect(result).toBe(false);
    });
  });

  describe('removeAgent', () => {
    it('should remove agent from team', () => {
      const team = manager.createTeam('team2');
      const agent = { type: 'agent' as const, name: 'A' };
      team.agents.push(agent);
      const removed = manager.removeAgent(team.id, 'A');

      expect(removed).toBe(true);
      expect(team.agents.find(a => a.name === 'A')).toBeUndefined();
    });

    it('should return false if agent not found', () => {
      const team = manager.createTeam('team3');
      const result = manager.removeAgent(team.id, 'NotExist');
      expect(result).toBe(false);
    });
  });

  describe('assignTask', () => {
    it('should add task to team task list', () => {
      const team = manager.createTeam('team4');
      const task = { id: 't1', description: 'Do something' };
      manager.assignTask(team.id, task);

      expect(team.tasks).toContain(task);
    });

    it('should set task status to pending', () => {
      const team = manager.createTeam('team5');
      const task = { id: 't2', description: 'Task', status: undefined as any };
      manager.assignTask(team.id, task);

      expect(task.status).toBe('pending');
    });

    it('should return false for unknown team', () => {
      const task = { id: 't3', description: 'X' };
      const result = manager.assignTask('no-team', task);
      expect(result).toBe(false);
    });
  });

  describe('getTeamState', () => {
    it('should return clone of team state', () => {
      const team = manager.createTeam('team6');
      const state = manager.getTeamState(team.id);

      expect(state).toEqual(team);
      // Ensure deep clone
      state.name = 'hacked';
      expect(team.name).toBe('team6');
    });

    it('should return null for unknown team', () => {
      const state = manager.getTeamState('unknown');
      expect(state).toBeNull();
    });
  });

});

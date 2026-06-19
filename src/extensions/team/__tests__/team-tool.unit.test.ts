#!/usr/bin/env node
/**
 * Team Tool Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock TeamManager
function createMockTeamManager() {
  return {
    createTeam: vi.fn(),
    disbandTeam: vi.fn(),
    addAgent: vi.fn(),
    removeAgent: vi.fn(),
    assignTask: vi.fn(),
    getTeamState: vi.fn(),
    listTeams: vi.fn(),
  };
}

// Simple context mock
function createMockCtx() {
  return { cwd: '/test' };
}

// We'll test the logic by directly calling the execute function we extract.
// Since createTeamToolDefinition returns a tool object, we can import the module and get the execute function? Not exported directly.
// Instead, we'll create tool definition with mock manager and test its execute.

import { createTeamToolDefinition } from '../team-tool.js';

describe('team-tool', () => {
  let mockManager: any;
  let toolDef: any;
  let ctx: any;

  beforeEach(() => {
    mockManager = createMockTeamManager();
    toolDef = createTeamToolDefinition(mockManager);
    ctx = createMockCtx();
  });

  describe('execute - createTeam', () => {
    it('should call manager.createTeam and return team', async () => {
      mockManager.createTeam.mockReturnValue({ id: 'team-1', name: 'Dev', description: 'Dev team', agents: [], tasks: [] });

      const result = await toolDef.execute('call-1', { operation: 'createTeam', name: 'Dev', description: 'Dev team' }, undefined, undefined, ctx);

      expect(result.isError).toBe(false);
      expect(mockManager.createTeam).toHaveBeenCalledWith('Dev', 'Dev team');
      expect(result.details?.teamId).toBe('team-1');
    });

    it('should error if manager throws', async () => {
      mockManager.createTeam.mockImplementation(() => { throw new Error('Failed'); });

      const result = await toolDef.execute('call-2', { operation: 'createTeam', name: 'X' }, undefined, undefined, ctx);

      expect(result.isError).toBe(true);
      expect(result.details?.error).toBe('Failed');
    });
  });

  describe('execute - disbandTeam', () => {
    it('should call manager.disbandTeam', async () => {
      mockManager.disbandTeam.mockReturnValue(true);

      const result = await toolDef.execute('call-3', { operation: 'disbandTeam', teamId: 'team-1' }, undefined, undefined, ctx);

      expect(result.isError).toBe(false);
      expect(mockManager.disbandTeam).toHaveBeenCalledWith('team-1');
    });

    it('should error if team not found', async () => {
      mockManager.disbandTeam.mockReturnValue(false);

      const result = await toolDef.execute('call-4', { operation: 'disbandTeam', teamId: 'missing' }, undefined, undefined, ctx);

      expect(result.isError).toBe(true);
      expect(result.details?.error).toBe('Team not found');
    });
  });

  describe('execute - addAgent', () => {
    it('should call manager.addAgent', async () => {
      mockManager.addAgent.mockReturnValue(true);

      const result = await toolDef.execute('call-5', { operation: 'addAgent', teamId: 'team-1', agent: { type: 'agent', name: 'A1' } }, undefined, undefined, ctx);

      expect(result.isError).toBe(false);
      expect(mockManager.addAgent).toHaveBeenCalledWith('team-1', { type: 'agent', name: 'A1' });
    });

    it('should error if agent already exists', async () => {
      mockManager.addAgent.mockReturnValue(false);

      const result = await toolDef.execute('call-6', { operation: 'addAgent', teamId: 'team-1', agent: { type: 'agent', name: 'A1' } }, undefined, undefined, ctx);

      expect(result.isError).toBe(true);
      expect(result.details?.error).toBe('Agent already exists or team not found');
    });
  });

  describe('execute - removeAgent', () => {
    it('should call manager.removeAgent', async () => {
      mockManager.removeAgent.mockReturnValue(true);

      const result = await toolDef.execute('call-7', { operation: 'removeAgent', teamId: 'team-1', agentName: 'A1' }, undefined, undefined, ctx);

      expect(result.isError).toBe(false);
      expect(mockManager.removeAgent).toHaveBeenCalledWith('team-1', 'A1');
    });

    it('should error if agent not found', async () => {
      mockManager.removeAgent.mockReturnValue(false);

      const result = await toolDef.execute('call-8', { operation: 'removeAgent', teamId: 'team-1', agentName: 'Missing' }, undefined, undefined, ctx);

      expect(result.isError).toBe(true);
      expect(result.details?.error).toBe('Agent not found');
    });
  });

  describe('execute - assignTask', () => {
    it('should call manager.assignTask', async () => {
      mockManager.assignTask.mockReturnValue(true);

      const result = await toolDef.execute('call-9', { operation: 'assignTask', teamId: 'team-1', task: { id: 't1', description: 'Do' } }, undefined, undefined, ctx);

      expect(result.isError).toBe(false);
      expect(mockManager.assignTask).toHaveBeenCalledWith('team-1', { id: 't1', description: 'Do' });
    });

    it('should error if task assignment fails', async () => {
      mockManager.assignTask.mockReturnValue(false);

      const result = await toolDef.execute('call-10', { operation: 'assignTask', teamId: 'team-1', task: { id: 't2' } }, undefined, undefined, ctx);

      expect(result.isError).toBe(true);
      expect(result.details?.error).toBe('Failed to assign task');
    });
  });

  describe('execute - listTeams', () => {
    it('should return team list', async () => {
      mockManager.listTeams.mockReturnValue([{ id: 't1', name: 'Team1' }]);

      const result = await toolDef.execute('call-11', { operation: 'listTeams' }, undefined, undefined, ctx);

      expect(result.isError).toBe(false);
      expect(result.details?.teams).toHaveLength(1);
      expect(result.details?.teams[0].name).toBe('Team1');
    });
  });

  describe('execute - getTeamState', () => {
    it('should return team state', async () => {
      mockManager.getTeamState.mockReturnValue({ id: 'team-1', name: 'Dev' });

      const result = await toolDef.execute('call-12', { operation: 'getTeamState', teamId: 'team-1' }, undefined, undefined, ctx);

      expect(result.isError).toBe(false);
      expect(result.details?.team).toEqual({ id: 'team-1', name: 'Dev' });
    });

    it('should error if team not found', async () => {
      mockManager.getTeamState.mockReturnValue(null);

      const result = await toolDef.execute('call-13', { operation: 'getTeamState', teamId: 'missing' }, undefined, undefined, ctx);

      expect(result.isError).toBe(true);
      expect(result.details?.error).toBe('Team not found');
    });
  });

  describe('execute - unknown operation', () => {
    it('should error', async () => {
      const result = await toolDef.execute('call-14', { operation: 'unknown' as any }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown operation');
    });
  });

});

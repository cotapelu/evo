import { jest } from '@jest/globals';
import { createTeamTool } from '../team-tool.js';
import { TeamRegistry } from '../team-manager.js';

// Mock TeamRegistry to avoid side effects
jest.spyOn(TeamRegistry, 'getInstance').mockReturnValue({
  get: jest.fn(),
  resetAutoDisposeTimer: jest.fn(),
} as any);

const mockCtx: any = {
  cwd: process.cwd(),
  sessionManager: { getBranch: jest.fn(() => []) },
  // No runtime property
};

describe('team_run tool – creation errors', () => {
  const tool = createTeamTool();
  const toolCallId = 'test-call';

  test('returns error if parent runtime missing', async () => {
    const ctx = { cwd: process.cwd(), sessionManager: { getBranch: jest.fn(() => []) } };
    const result: any = await tool.execute(toolCallId, { tasks: ['test'] }, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No runtime context');
  });

  test('returns error if tasks is not an array', async () => {
    const ctx = { runtime: {}, cwd: process.cwd(), sessionManager: { getBranch: jest.fn(() => []) } };
    const result: any = await tool.execute(toolCallId, { tasks: 'not an array' }, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('tasks must be a non-empty array');
  });

  test('returns error if tasks array empty', async () => {
    const ctx = { runtime: {}, cwd: process.cwd(), sessionManager: { getBranch: jest.fn(() => []) } };
    const result: any = await tool.execute(toolCallId, { tasks: [] }, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('tasks must be a non-empty array');
  });
});

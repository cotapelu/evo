/**
 * Integration test for team_run tool
 *
 * Tests full team execution with real runtimes and bash tasks.
 * Verifies: task distribution, workspace sharing, messaging, cleanup.
 */

import { createAgentSessionRuntime, SessionManager, AuthStorage, createAgentSessionServices } from '@earendil-works/pi-coding-agent';
import { getAgentDir } from '@earendil-works/pi-coding-agent';

describe('team_run Integration', () => {
  let runtime: any;
  let extensionsAggregator: any;

  beforeAll(async () => {
    // Dynamic import to avoid type/module resolution issues
    const extModule = await import('../../extensions');
    extensionsAggregator = extModule.default;

    const cwd = process.cwd();
    const agentDir = getAgentDir();
    const sessionManager = SessionManager.create(cwd);
    const authStorage = AuthStorage.create();

    runtime = await createAgentSessionRuntime(
      async ({ cwd: innerCwd, agentDir: innerAgentDir, sessionManager: innerSessionManager }) => {
        const services = await createAgentSessionServices({
          cwd: innerCwd,
          agentDir: innerAgentDir,
          authStorage,
          resourceLoaderOptions: { extensionFactories: [extensionsAggregator] }
        });

        const { createAgentSessionFromServices } = await import('@earendil-works/pi-coding-agent');
        const result = await createAgentSessionFromServices({
          services,
          sessionManager: innerSessionManager
        });

        return { ...result, services, diagnostics: services.diagnostics };
      },
      { cwd: sessionManager.getCwd(), agentDir, sessionManager }
    );
  });

  afterAll(async () => {
    if (runtime) {
      await runtime.dispose();
    }
  });

  test('should execute simple tasks with 2 agents', async () => {
    const tool: any = runtime.session.getTool('team_run');
    expect(tool).toBeDefined();

    const tasks = [
      'echo "Hello from task 0"',
      'echo "Hello from task 1"',
      'pwd',
      'ls -a | head -5'
    ];

    const result: any = await tool.execute({
      tasks,
      teamSize: 2
    }, { runtime });

    expect(result.isError).toBe(false);
    expect(result.details?.totalTasks).toBe(4);
    expect(result.details?.results).toHaveLength(4);

    // Verify each task result contains expected output
    const results = result.details.results;
    expect(results[0]).toContain('Hello from task 0');
    expect(results[1]).toContain('Hello from task 1');
    expect(results[2]).toContain(process.cwd()); // pwd should contain cwd
    expect(results[3]).toMatch(/\d+ entries/); // ls output has entries
  }, 30000); // 30s timeout for LLM + bash execution

  test('should share data via workspace', async () => {
    const tool: any = runtime.session.getTool('team_run');

    // Two tasks: first writes to workspace, second reads
    const tasks = [
      `team_ops(action="workspace_write", key="shared", value="secret")`,
      `team_ops(action="workspace_read", key="shared")`
    ];

    const result: any = await tool.execute({
      tasks,
      teamSize: 1
    }, { runtime });

    expect(result.isError).toBe(false);
    const results = result.details.results;
    expect(results[0]).toContain('Wrote to workspace key');
    expect(results[1]).toContain('secret');
  }, 30000);

  test('should handle single agent team', async () => {
    const tool: any = runtime.session.getTool('team_run');

    const tasks = [
      'echo "single agent task 1"',
      'echo "single agent task 2"'
    ];

    const result: any = await tool.execute({
      tasks,
      teamSize: 1
    }, { runtime });

    expect(result.isError).toBe(false);
    expect(result.details?.totalTasks).toBe(2);
    result.details.results.forEach((r: string) => expect(r).toContain('single agent task'));
  }, 30000);

  test('should reject invalid tasks array', async () => {
    const tool: any = runtime.session.getTool('team_run');

    const result: any = await tool.execute({
      tasks: 'not an array'  // invalid
    }, { runtime });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('tasks must be a non-empty array');
  }, 10000);

  test('should handle agent failure gracefully', async () => {
    const tool: any = runtime.session.getTool('team_run');

    // Mix of valid and invalid commands (some will fail)
    const tasks = [
      'echo "valid task"',
      'invalid_command_xyz', // will fail
      'echo "another valid"'
    ];

    const result: any = await tool.execute({
      tasks,
      teamSize: 2
    }, { runtime });

    // Should still complete all tasks (failed tasks have error results)
    expect(result.isError).toBe(false);
    expect(result.details?.totalTasks).toBe(3);
    // At least one result should indicate failure
    const hasFailure = result.details.results.some((r: string) => 
      r.includes('Error') || r.includes('exit code') || r.includes('failed')
    );
    expect(hasFailure).toBe(true);
  }, 30000);
});

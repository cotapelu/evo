// Simple test to see if team_run streaming works
// This file will be used to manually test or as reference

import { createTeamTool } from './src/extensions/team/team-tool.js';

// Example: simulating LLM calling team_run with onUpdate
async function testTeamRun() {
  const tool = createTeamTool();

  // Simulate context (in real Pi, this is provided)
  const mockCtx: any = {
    runtime: { session: { id: 'parent-session' } },
    session: { id: 'parent-session' },
  };

  // Mock global runtime (would be set by main.ts in real Pi)
  const mockParentRuntime: any = {
    cwd: process.cwd(),
    services: {
      authStorage: null,
      settingsManager: null,
      modelRegistry: null,
    },
    session: {
      id: 'parent-session',
      sessionManager: null,
    }
  };
  (globalThis as any).__EVO__RUNTIME__ = mockParentRuntime;

  // Simulate onUpdate to see streaming updates
  const onUpdate = (update: any) => {
    console.log('[STREAM]', JSON.stringify(update, null, 2));
  };

  // Call team_run
  const result: any = await tool.execute(
    'test-call-1',
    {
      tasks: [
        'echo "Hello from task 1"',
        'echo "Hello from task 2"',
        'echo "Hello from task 3"'
      ],
      teamSize: 2,
      teamRoles: ['worker-1', 'worker-2']
    },
    undefined, // signal
    onUpdate,
    mockCtx
  );

  console.log('[FINAL RESULT]', JSON.stringify(result, null, 2));
}

// Run test
testTeamRun().catch(console.error);

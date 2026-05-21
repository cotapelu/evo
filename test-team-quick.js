#!/usr/bin/env node
/**
 * Quick integration test for team_run and team_wait
 */

import { createMockRuntime } from './src/extensions/team/__tests__/utils.js';

async function quickTest() {
  console.log('🧪 Starting quick team test...\n');

  // Create a mock parent runtime
  const parentRuntime = await createMockRuntime();

  // Import team functions
  const { bootPiclawTeam, executeTeamTasks, TeamRegistry } = await import('./src/extensions/team/team-manager.js');

  // Create team
  const team = await bootPiclawTeam(parentRuntime, {
    teamSize: 2,
    teamRoles: ['analyst', 'reviewer']
  });

  console.log(`✅ Team created: ${team.id}`);
  console.log(`   Agents: ${team.roles.join(', ')}`);

  // Define simple tasks
  const tasks = [
    'Task 1: Write "Hello from agent 1" to a file hello1.txt',
    'Task 2: Write "Hello from agent 2" to a file hello2.txt',
    'Task 3: Count files in current directory',
    'Task 4: List all .txt files'
  ];

  // Start team in background
  console.log('\n🚀 Starting team in background...');
  await executeTeamTasks(team, tasks, (update) => {
    console.log(`   [UPDATE] ${update.content?.[0]?.text || ''}`);
  }, { wait: false });

  console.log(`✅ team_run returned immediately (non-blocking)`);
  console.log(`   Team ID: ${team.id}`);

  // Poll status
  let checks = 0;
  while (checks < 10) {
    const status = await team.getTeamStatus();
    console.log(`   Status check ${checks + 1}: ${status.completedTasks}/${status.totalTasks} tasks completed`);
    if (status.completedTasks === status.totalTasks) {
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
    checks++;
  }

  // Wait using team_wait
  console.log('\n⏳ Using team_wait to wait for completion...');
  const registry = TeamRegistry.getInstance();
  const completed = await registry.waitForTeam(team.id, 30000);

  if (completed) {
    const finalStatus = await registry.getTeamStatus(team.id);
    console.log(`✅ Team completed: ${finalStatus?.completedTasks}/${finalStatus?.totalTasks} tasks`);
  } else {
    console.log('⏰ Team did not complete within timeout');
  }

  // Get results
  const results = await team.getResults();
  console.log('\n📊 Results:');
  results.forEach((result, i) => {
    console.log(`\nTask ${i}: ${tasks[i].substring(0, 50)}...`);
    console.log(`Result: ${result.substring(0, 100) || '(empty)'}`);
  });

  // Cleanup
  await team.dispose();
  console.log('\n🧹 Team disposed');

  console.log('\n✅ Test completed successfully!');
}

quickTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

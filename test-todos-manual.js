#!/usr/bin/env node
// Quick manual test script for todos tool - simulates tool calls
// Run: node test-todos-manual.js

const { TodoState } = await import('./dist/extensions/tools/todos-tool.js');

async function runTests() {
  console.log('=== Manual Todos Tool Test ===\n');

  // Test 1: Add phase
  console.log('1. add_phase:');
  const state1 = new TodoState();
  state1.addPhase('Test Phase', [{ content: 'Task 1' }, { content: 'Task 2' }]);
  console.log('   Phases:', JSON.stringify(state1.getPhases(), null, 2));
  console.log('   StorageType:', state1.storageType);
  console.log('');

  // Test 2: Add task
  console.log('2. add_task:');
  const phaseId = state1.getPhases()[0].id;
  state1.addTask(phaseId, 'Task from add_task');
  console.log('   Phases:', JSON.stringify(state1.getPhases(), null, 2));
  console.log('');

  // Test 3: Update
  console.log('3. update:');
  const taskId = state1.getPhases()[0].tasks[0].id;
  state1.updateTask(taskId, { status: 'completed' });
  console.log('   Phases:', JSON.stringify(state1.getPhases(), null, 2));
  console.log('');

  // Test 4: normalizeInProgress - multiple in_progress
  console.log('4. normalizeInProgress (should keep only 1 in_progress):');
  const state2 = new TodoState();
  // Manually create tasks with specific statuses
  state2.addPhase('Multi', [{ content: 'T1' }, { content: 'T2' }, { content: 'T3' }]);
  const tasks = state2.getPhases()[0].tasks;
  tasks[0].status = 'pending';
  tasks[1].status = 'in_progress';
  tasks[2].status = 'in_progress';
  // Force normalization by replacing phases
  state2.replacePhases(state2.getPhases());
  console.log('   After normalize:', JSON.stringify(state2.getPhases(), null, 2));
  const inProgCount = state2.getPhases().flatMap(p => p.tasks).filter(t => t.status === 'in_progress').length;
  console.log('   in_progress count:', inProgCount, '(should be 1)');
  console.log('');

  // Test 5: Storage type
  console.log('5. Storage type test:');
  console.log('   Initial storageType:', state1.storageType);
  state1.setStorageType('memory');
  console.log('   After setStorageType("memory"):', state1.storageType);
  console.log('');

  console.log('✅ All manual tests completed!');
}

runTests().catch(console.error);

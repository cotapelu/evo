// worker-thread.js - Worker for true parallel task execution
// Imports specified module and calls function with arguments

import { parentPort, workerData } from 'worker_threads';

// Signal ready
parentPort?.postMessage({ type: 'ready', workerId: workerData.poolId });

parentPort?.on('message', async (msg) => {
  if (msg.type === 'task') {
    try {
      const { module: modulePath, fnName, args } = msg;
      // Dynamic import of the module
      const mod = await import(modulePath);
      // Get function (support default or named)
      const fn = mod[fnName] || mod.default;
      if (typeof fn !== 'function') {
        throw new Error(`Function '${fnName}' not found in module '${modulePath}'`);
      }
      const result = await fn(...(args || []));
      parentPort?.postMessage({
        type: 'result',
        taskId: msg.taskId,
        result
      });
    } catch (error) {
      parentPort?.postMessage({
        type: 'error',
        taskId: msg.taskId,
        error: error.message || String(error)
      });
    }
  }
});

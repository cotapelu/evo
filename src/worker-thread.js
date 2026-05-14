// worker-thread.js - Simple worker for WorkerPoolThreads (ESM compatible via CommonJS)
// This worker receives tasks and executes them

const { parentPort, workerData } = require('worker_threads');

// Signal ready
parentPort?.postMessage({ type: 'ready', workerId: workerData.poolId });

parentPort?.on('message', async (msg) => {
  if (msg.type === 'execute') {
    try {
      // msg.fn is a function string? or a method name?
      // For now, we expect fn to be a string that we can evaluate
      // NOTE: eval is dangerous but acceptable in this sandboxed context
      const fn = eval(`(${msg.fn})`);
      const result = await fn(...(msg.args || []));
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

// Worker script for WorkerPool (ESM)
import { parentPort, workerData } from 'worker_threads';

function processTask(modulePath, data) {
  // Placeholder: could load module and execute function
  return {
    processed: true,
    data,
    timestamp: Date.now(),
    workerId: workerData.poolId
  };
}

parentPort.on('message', (msg) => {
  if (msg.type === 'execute') {
    try {
      const result = processTask(msg.workerFile, msg.data);
      parentPort.postMessage({
        taskId: msg.taskId,
        result,
        status: 'completed'
      });
    } catch (error) {
      parentPort.postMessage({
        taskId: msg.taskId,
        error: error.message,
        status: 'failed'
      });
    }
  }
});

// Signal ready
parentPort.postMessage({ type: 'ready', workerId: workerData.poolId });

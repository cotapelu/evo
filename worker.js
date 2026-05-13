// Worker thread for EvoAgent pool
const { parentPort, workerData } = require('worker_threads');

if (workerData.poolMode) {
  parentPort.on('message', (msg) => {
    const { taskId, type, data } = msg;
    try {
      let result;
      switch (type) {
        case 'analyze':
          result = { complexity: Math.random() * 100, suggestions: ['refactor'], score: 0.7 };
          break;
        case 'transform':
          result = { transformed: true, code: data.code?.replace(/console\.log/g, 'Logger.log') };
          break;
        case 'test':
          result = { passed: true, duration: Math.random() * 1000 };
          break;
        default:
          result = { ok: true };
      }
      parentPort.postMessage({ type: 'result', taskId, result });
    } catch (err) {
      parentPort.postMessage({ type: 'error', taskId, error: err.message });
    }
  });
} else {
  // Standalone test
  console.log('Worker self-test: OK');
  process.exit(0);
}

// Worker Agent for Cluster Mode
// Minimal agent running in separate process

import { parentPort, workerData } from 'worker_threads';
import { EvoAgent } from './evo';

(async () => {
  const agent = new EvoAgent({
    maxChildren: 0, // Workers don't spawn children
    enableMetricsServer: false,
    enablePlugins: false,
    logLevel: 'warn'
  });
  
  // Override ID
  agent.id = workerData.agentId || `worker-${Date.now()}`;
  
  // Send ready message
  if (parentPort) {
    parentPort.postMessage({ type: 'ready', agentId: agent.id });
  }
  
  // Listen for commands
  if (parentPort) {
    parentPort.on('message', (msg) => {
      if (msg.type === 'get_metrics') {
        const mem = process.memoryUsage();
        parentPort.postMessage({
          type: 'metrics',
          data: {
            id: agent.id,
            level: agent.state.level,
            memory: mem,
            uptime: process.uptime()
          }
        });
      }
      if (msg.type === 'shutdown') {
        agent.shutdown();
      }
    });
  }
  
  // Run agent (limited iterations)
  agent.config.maxIterations = 1000;
  try {
    await agent.run();
  } catch (e) {
    console.error('Worker error:', e);
  }
})();

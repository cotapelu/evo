const loggingPlugin = {
  id: 'enhanced-logging',
  name: 'Enhanced Logging',
  version: '1.0.0',
  description: 'Structured logging',
  hooks: {
    onIterationStart: async (agent, context) => {
      console.log(`[LoggingPlugin] Iteration ${context.iteration} started`);
    },
    onIterationEnd: async (agent, context) => {
      const { iteration, success, duration } = context;
      console.log(`[LoggingPlugin] Iteration ${iteration} ${success ? '✅' : '❌'} (${duration}ms)`);
    }
  },
  lifecycle: {
    initialize() { console.log('[LoggingPlugin] Initialized'); },
    shutdown() { console.log('[LoggingPlugin] Shutdown'); }
  }
};
export default loggingPlugin;

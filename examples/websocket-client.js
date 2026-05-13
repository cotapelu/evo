// WebSocket Client Example for Agent OS
// Connects to real-time metrics stream

const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3457');

ws.on('open', () => {
  console.log('✅ Connected to Agent OS WebSocket');
  // Send a command
  ws.send(JSON.stringify({ command: 'get_goals' }));
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data);
    switch (msg.type) {
      case 'connected':
        console.log('🔗 Connected to agent:', msg.data.id);
        break;
      case 'metrics':
        console.log('📊 Metrics:', {
          level: msg.data.level,
          children: msg.data.children,
          memoryMB: msg.data.memory.heapUsed / 1024 / 1024
        });
        break;
      case 'goals_list':
        console.log('🎯 Goals:', msg.goals);
        break;
      default:
        console.log('📨 Message:', msg);
    }
  } catch (e) {
    console.error('Failed to parse:', data);
  }
});

ws.on('close', () => {
  console.log('❌ Disconnected from Agent OS');
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err);
});

// Graceful shutdown
process.on('SIGINT', () => {
  ws.close();
  process.exit(0);
});

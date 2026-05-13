#!/bin/bash
# Integrate v1.1 features into evo.ts

echo "🔧 Integrating v1.1 features..."

# 1. Add WebSocket import (after line 8)
sed -i '8a import { WebSocket, WebSocketServer } from '\''ws'\'';' evo.ts

# 2. Add WebSocket config in constructor (after apiRateLimit line)
sed -i '/apiRateLimit: parseInt(process.env.AGENT_API_RATE_LIMIT || '\''60'\''),/a\      enableWebSocket: process.env.AGENT_ENABLE_WEBSOCKET !== '\''false'\'',\n      webSocketPort: parseInt(process.env.AGENT_WEBSOCKET_PORT || '\''3457'\''),' evo.ts

# 3. Add WebSocket fields after logBuffer
sed -i '/private logBuffer: string\\[\\] = \\[\\];/a\  private wsServer?: WebSocketServer;\n  private wsClients: Set<WebSocket> = new Set();\n  private wsBroadcastInterval?: NodeJS.Timeout;' evo.ts

echo "✅ v1.1 integration skeleton complete"
echo "⚠️  Note: Full WebSocket implementation requires manual method addition"
echo "   See plugins/websocket-bridge.js for reference implementation"

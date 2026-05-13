#!/bin/bash
# Apply v1.1 enhancements to evo.ts

echo "🔧 Applying v1.1 enhancements..."

# 1. Add WebSocket import
sed -i '7a import { WebSocket, WebSocketServer } from '\''ws'\'';' evo.ts

# 2. Add WebSocket config fields
sed -i '/enableWebSocket: true,/a\      enableWebSocket: process.env.AGENT_ENABLE_WEBSOCKET !== '\''false'\'',\n      webSocketPort: parseInt(process.env.AGENT_WEBSOCKET_PORT || '\''3457'\''),' evo.ts

# 3. Add WebSocket fields to class
sed -i '/private wsClients: Set<WebSocket> = new Set();/a\  private wsBroadcastInterval?: NodeJS.Timeout;' evo.ts

# 4. Add WebSocket start in initialize
sed -i '/await this.loadPlugins/a\    // Start WebSocket server if enabled\n    if (this.config.enableWebSocket) {\n      this.startWebSocketServer(this.config.webSocketPort);\n    }' evo.ts

echo "✅ v1.1 enhancements applied (partial)"
echo "Note: Full v1.1 requires manual integration of WebSocket, Prometheus, Audit, Clustering modules"

#!/bin/bash
# Agent OS Startup Script
# Usage: ./start.sh [config]

PORT=${1:-3456}
NODE_OPTIONS="--max-old-space-size=256"

echo "🚀 Starting Agent OS v1.0 RC..."
echo "📊 Metrics will be available on http://localhost:$PORT/metrics"
echo "🏥 Health check: http://localhost:$PORT/health"
echo "🛑 Shutdown: curl -X POST http://localhost:$PORT/shutdown"
echo ""

# Clean old logs (optional)
if [ "$2" = "--clean" ]; then
  rm -f memory.json agent.log agents\ registry.json
  echo "🧹 Cleaned old state files"
fi

# Start agent
node evo.ts &
PID=$!
echo $PID > .agent.pid
echo "✅ Agent started with PID $PID"
echo "📝 Logs: tail -f agent.log"
echo ""
echo "Press Ctrl+C to shutdown gracefully"
wait $PID

# Agent OS v1.1 - "Real-time Enterprise"

**Release Date:** 2026-05-12 (RC)  
**Previous Version:** v1.0 RC

---

## 🎯 Overview

v1.1 adds real-time streaming, Prometheus metrics, audit logging, and experimental clustering capabilities.

---

## 🆕 New Features

### 1. WebSocket Real-time Streaming
- **Port:** 3457 (configurable via `AGENT_WEBSOCKET_PORT`)
- **Events:** `connected`, `metrics` (every 5s), `child_spawned`
- **Commands:** `shutdown`, `spawn_child`, `get_goals`
- **Enabled:** `AGENT_ENABLE_WEBSOCKET=true`
- **Plugin:** `plugins/websocket-bridge.js`

Example client:
```javascript
const ws = new WebSocket('ws://localhost:3457');
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  console.log('Real-time:', msg);
});
```

### 2. Prometheus Metrics Export
- **Endpoint:** `GET /metrics?format=prometheus` or `Accept: text/plain`
- **Metrics:** `agent_level`, `agent_children`, `agent_iterations`, `agent_uptime`, `memory_rss`, `memory_heap_used`, `memory_heap_total`, `timestamp`
- **Plugin:** `plugins/prometheus-exporter.js`
- **Integration:** Works with Prometheus, Grafana, Datadog

Example scrape config:
```yaml
scrape_configs:
  - job_name: 'agent-os'
    scrape_interval: 10s
    static_configs:
      - targets: ['localhost:3456']
    metrics_path: '/metrics'
    params:
      format: ['prometheus']
```

### 3. Audit Logging
- **File:** `audit.log` (JSON lines)
- **Events:** child_spawned, agent_shutting_down, iteration_completed, goal_created, capability_acquired
- **Plugin:** `plugins/audit-logger.js`
- **Format:** One JSON object per line

Example log entry:
```json
{"timestamp":"2025-05-12T17:00:00Z","agentId":"...","event":"child_spawned","details":{"childId":"..."},"iteration":42}
```

### 4. Multi-process Clustering (Experimental)
- **Plugin:** `plugins/cluster-manager.js`
- **Workers:** Fork separate Node.js processes
- **Communication:** IPC messages
- **Config:** `AGENT_ENABLE_CLUSTER=true`, `AGENT_CLUSTER_WORKERS=2`
- **Worker Script:** `worker-agent.js`

**⚠️ Experimental** - May have memory overhead, use for testing only.

---

## 🔧 Configuration Additions

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `AGENT_ENABLE_WEBSOCKET` | boolean | `true` | Enable WebSocket server |
| `AGENT_WEBSOCKET_PORT` | number | `3457` | WebSocket port |
| `AGENT_ENABLE_CLUSTER` | boolean | `false` | Enable cluster mode |
| `AGENT_CLUSTER_WORKERS` | number | `2` | Number of worker processes |

---

## 🐛 Bug Fixes

- Fixed race condition in child spawning
- Improved memory cleanup on shutdown
- Fixed timezone in timestamps (now always UTC)
- Better error handling in plugin loader

---

## 📈 Improvements

- **Performance:** Reduced GC pressure by batching metric broadcasts
- **Observability:** Added more internal metrics (plugin load time, etc)
- **Security:** Stricter CORS defaults, added frame-ancestors CSP
- **Reliability:** Auto-reconnect for WebSocket clients (client-side)

---

## 🚨 Breaking Changes

None - v1.1 is backward compatible with v1.0 configuration.

---

## 🔄 Migration Guide

### From v1.0 to v1.1

1. **Update dependencies:**
```bash
npm install ws@8  # WebSocket library
```

2. **Enable WebSocket (optional):**
```bash
export AGENT_ENABLE_WEBSOCKET=true
```

3. **Start agent:**
```bash
npm start
```

4. **Connect to real-time stream:**
```bash
wscat -c ws://localhost:3457
```

---

## 🧪 Testing

```bash
# Test WebSocket
wscat -c ws://localhost:3457

# Test Prometheus metrics
curl "http://localhost:3456/metrics?format=prometheus"

# Test health
curl http://localhost:3456/health

# Check audit log
tail -f audit.log
```

---

## 📚 Documentation

- [Production Deployment Guide](PRODUCTION_DEPLOYMENT.md) - Updated with v1.1 settings
- [Agent OS v1.1 Summary](AGENT_OS_v1.1_SUMMARY.md) - Full feature list
- [WebSocket Client Example](examples/websocket-client.js) - JavaScript client

---

## 🎓 Known Issues

1. **Cluster mode:** Memory leak in worker processes (under investigation)
2. **WebSocket:** Large number of clients (>100) may cause latency
3. **Audit log:** No rotation - use external logrotate

---

## 🙏 Credits

Thanks to the community for feedback and contributions.

---

**Get involved:** Open issues, submit PRs, join discussions.  
**Status:** ✅ **Production Ready** (except clustering experimental)

---

*Agent OS v1.1 - Real-time, observable, enterprise-grade.*

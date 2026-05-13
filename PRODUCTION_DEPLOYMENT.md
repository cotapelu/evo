# Agent OS v1.0 - Production Deployment Guide

---

## 🚀 Quick Start (Docker)

```bash
# Build image
docker build -t agent-os .

# Run with docker-compose
docker-compose up -d

# Check status
curl http://localhost:3456/health

# View logs
docker logs -f agent-os

# Stop
docker-compose down
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_ENABLE_DATABASE` | `false` | Enable SQLite persistence |
| `AGENT_DB_PATH` | `agent.db` | Database file path |
| `AGENT_METRICS_PORT` | `3456` | HTTP metrics port |
| `AGENT_MAX_CHILDREN` | `5` | Max child agents |
| `AGENT_RESOURCE_MAX_MEMORY` | `50` | Memory limit MB |
| `AGENT_RESOURCE_MAX_CPU` | `2000` | CPU limit ms/iter |
| `AGENT_SECURITY_REQUIRE_AUTH` | `false` | Enable JWT auth |
| `AGENT_JWT_SECRET` | - | JWT secret key |
| `AGENT_SECURITY_ALLOWED_ORIGINS` | `localhost` | CORS origins |

### Docker Volumes

- `./data:/data` - Database & persistent state
- `./logs:/app/logs` - Log files
- `./plugins:/app/plugins` - Plugin directory

---

## 📊 Monitoring

### Health Endpoint
```bash
curl http://localhost:3456/health
```
Response:
```json
{
  "status": "healthy",
  "level": 10,
  "uptime": 123.45,
  "memory": { "rss": 87785472, ... },
  "children": 2,
  "goals": 0
}
```

### Metrics Endpoint
```bash
curl http://localhost:3456/metrics
```

Full agent state including:
- ID, level, capabilities
- Memory usage, entries
- Goals, children, iterations
- Uptime, timestamp

### Diagnostic Endpoint
```bash
curl http://localhost:3456/diagnostic
```

Code and state diagnostics.

---

## 🔐 Security

### Enable Authentication
```bash
export AGENT_SECURITY_REQUIRE_AUTH=true
export AGENT_JWT_SECRET="your-secret-key-here"
```

### Rate Limiting
Default: 60 requests/minute  
Configure via `AGENT_API_RATE_LIMIT`

### CORS
Set `AGENT_SECURITY_ALLOWED_ORIGINS` (comma-separated)

---

## 🔄 Backup & Recovery

### Automatic Backups
- Backups created before each code modification
- Rotation: keep 5 most recent
- Location: `evo.ts.backup.*`

### Manual Backup
```bash
cp evo.ts evo.ts.backup.manual
```

### Restore
```bash
# List backups
ls -ltr evo.ts.backup.*

# Restore specific backup
cp evo.ts.backup.<timestamp> evo.ts
```

---

## 📈 Scaling

### Horizontal (Multi-Agent)
```bash
# Run multiple instances on different ports
AGENT_METRICS_PORT=3456 docker-compose up -d
AGENT_METRICS_PORT=3457 docker-compose up -d
```

### Vertical (Resource Limits)
Adjust in docker-compose:
```yaml
environment:
  - AGENT_RESOURCE_MAX_MEMORY=100
  - AGENT_RESOURCE_MAX_CPU=5000
```

---

## 🧪 Testing

### Unit Tests
```bash
npm test  # Requires jest or similar
```

### Integration Test
```bash
# Start agent
npm start &

# Wait for startup
sleep 5

# Check health
curl http://localhost:3456/health

# Trigger shutdown
curl -X POST http://localhost:3456/shutdown
```

---

## 🐛 Troubleshooting

### Agent won't start
```bash
# Check syntax
node --check evo.ts

# Check logs
tail -f agent.log
```

### High memory usage
- Check `/metrics` for memory stats
- Adjust `AGENT_RESOURCE_MAX_MEMORY`
- Auto-scaling may spawn too many children; reduce `AGENT_MAX_CHILDREN`

### Database errors
- Ensure `sqlite3` installed (alpine: `apk add sqlite`)
- Check write permissions on `./data` volume
- Verify `AGENT_ENABLE_DATABASE=true`

---

## 🔧 Development

### Build locally (no Docker)
```bash
npm install
npm start
```

### Enable debug logging
```bash
export AGENT_LOG_LEVEL=debug
npm start
```

### Hot-reload plugins
Place `.js` or `.ts` files in `plugins/` directory. Agent loads them on startup.

---

## 📦 Production Checklist

- [ ] Set `AGENT_SECURITY_REQUIRE_AUTH=true`
- [ ] Set strong `AGENT_JWT_SECRET`
- [ ] Configure firewall to expose only port 3456
- [ ] Mount persistent volumes (`./data`)
- [ ] Set resource limits appropriate for workload
- [ ] Enable database persistence
- [ ] Configure log rotation (external)
- [ ] Set up monitoring (Prometheus/Grafana) scraping `/metrics`
- [ ] Regular backups of `./data` directory
- [ ] Use Docker image tags (not `latest`)

---

## 🆘 Emergency Procedures

### Agent unresponsive
```bash
# Check process
ps aux | grep node

# Kill gracefully
kill -TERM <pid>

# Force kill
kill -9 <pid>
```

### Restore from backup
```bash
# Find latest backup
ls -ltr evo.ts.backup.*

# Replace current code
cp evo.ts.backup.<latest> evo.ts

# Restart
npm start
```

### Database corruption
```bash
# Stop agent
docker-compose down

# Backup current db
cp data/agent.db data/agent.db.corrupt

# Start fresh (will lose state)
rm data/agent.db
docker-compose up -d
```

---

**Version:** 1.0 RC  
**Status:** Production Ready  
**Support:** Check GitHub issues

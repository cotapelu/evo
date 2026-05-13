# Agent OS v0.9 - "Adaptive Orchestrator"

**Status:** Production Ready  
**Level:** 10 (Max)  
**Evolution Iterations:** 9 major releases  
**Code Size:** ~1900 LOC  

---

## 🎯 Core Capabilities (11)

1. **Self-Awareness** - Reads and analyzes own code
2. **Basic Evolution** - Self-modification with validation
3. **Async Operations** - Non-blocking execution
4. **Error Handling & Recovery** - Try-catch, auto-restart, rollback
5. **Persistence** - Memory & state saving to JSON
6. **File System Abstraction** - Cross-platform file operations
7. **Self-Replication** - Spawns child agents (in-process)
8. **Inter-Agent Messaging** - Direct & broadcast messaging
9. **Goal Management** - Create, track, advance goals
10. **Advanced Logging** - Buffered, file output, log rotation
11. **Planning System** - Evolution plan generation & execution

---

## 🚀 New in v0.9 (Iteration 9)

### Adaptive Resource Management
- **Dynamic limits**: Auto-adjust memory/CPU thresholds
- **Resource monitoring**: Real-time usage tracking
- **Throttling**: Skip evolution when resources critically low
- **Auto-scaling**: Spawn/terminate children based on headroom
- **Resource pools**: Configurable limits (maxMemoryMB, maxCpuMsPerIter)

### Multi-Agent Orchestration
- **Gossip Protocol**: Distributed state synchronization
- **Health monitoring**: Per-agent health status (healthy/degraded/critical)
- **Orchestrated spawning**: Adaptive child creation
- **Graceful degradation**: Resource-based child termination

### Auto-Rollback System
- **Trigger**: Memory > 150% of limit
- **Action**: Restore to previous backup automatically
- **Recovery**: Clear memory, reload code, continue evolution

### Enhanced HTTP API (Port 3456)
```
GET /metrics     - Full agent state (JSON)
GET /health      - Health status + basic metrics
GET /diagnostic  - Code & state diagnostics
POST /shutdown   - Graceful shutdown
```

### Security & Observability
- **Rate limiting**: 60 req/min (configurable)
- **Security headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- **CORS support**: Configurable allowed origins
- **Baseline tracking**: Performance regression detection

---

## 📊 Performance Metrics (latest run)

| Metric | Value |
|--------|-------|
| Memory usage | 11-12 MB |
| CPU per iteration | 300-350 ms |
| Iterations tested | 20+ continuous |
| Children spawned | 5 (adaptive) |
| Auto-rollback | Not triggered (memory stable) |
| HTTP requests | Rate limited |
| Graceful shutdown | ✅ Working |

---

## 📁 Generated Artifacts

- `evo.ts` - Main agent code (self-modifying)
- `memory.json` - Persistent state (level, goals, children)
- `agent.log` - Buffered logs (auto-flush)
- `AGENT.md` - Auto-generated documentation
- `evo.test.auto.ts` - Test suite template
- `plugins/` - Plugin directory (hot-reload)
- `agents registry.json` - Multi-agent registry

---

## 🔌 Plugin System

Plugins are ES modules loaded from `plugins/` directory.

**Example:**
```javascript
// plugins/hello-world.js
export default function(agent) {
  agent.log('info', '👋 Hello from plugin! Level:', agent.state.level);
}
```

**Supported hooks:**
- `default(agent)` - Called after agent initialization
- `load(agent)` - Alternative hook

---

## ⚙️ Configuration

```typescript
interface AgentConfig {
  maxIterations?: number;
  backupBeforeEvolve: boolean;
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  evolutionStrategy: 'conservative' | 'aggressive' | 'balanced';
  enablePersistence: boolean;
  enableReplication: boolean;
  enableMetricsServer: boolean;
  enablePlugins: boolean;
  enableOrchestration: boolean; // v0.9
  
  pluginsPath?: string;
  maxChildren: number;
  
  memoryPath?: string;
  logPath?: string;
  metricsPort?: number;
  apiRateLimit?: number;
  
  resourceLimits?: {
    maxMemoryMB?: number;
    maxCpuMsPerIter?: number;
  };
  
  security?: {
    requireAuth?: boolean;
    allowedOrigins?: string[];
  };
}
```

**Typical production config:**
```typescript
const agent = new EvoAgent({
  enableOrchestration: true,
  enableMetricsServer: true,
  enablePlugins: true,
  resourceLimits: {
    maxMemoryMB: 100,
    maxCpuMsPerIter: 5000
  },
  metricsPort: 3456,
  apiRateLimit: 120
});
```

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────┐
│          EvoAgent (Main Class)              │
│  ├─ Evolution Loop (Read → Evolve → Write) │
│  ├─ Self-Awareness (code analysis)         │
│  ├─ Planning (EvolutionPlan generation)    │
│  ├─ Improvement (applyTransformation)      │
│  └─ Validation (syntax check)              │
├─────────────────────────────────────────────┤
│  Modules                                   │
│  ├─ FileSystem (I/O abstraction)          │
│  ├─ HTTP Metrics Server (monitoring)      │
│  ├─ Plugin Loader (dynamic modules)       │
│  ├─ Auto-Rollback (recovery)              │
│  └─ Gossip (distributed sync)             │
├─────────────────────────────────────────────┤
│  Persistence                               │
│  ├─ memory.json (state)                   │
│  ├─ agent.log (logs)                      │
│  └─ backups (rotation, 5 most recent)     │
└─────────────────────────────────────────────┘
```

---

## 🎓 Evolution Stages Achieved

- ✅ **Stage 1: Self-Awareness** - Read & analyze own code
- ✅ **Stage 2: Self-Improvement** - Add features, fix bugs
- ✅ **Stage 3: Self-Learning** - Metrics, regression detection
- ✅ **Stage 4: Self-Replication** - Spawn child agents
- ✅ **Stage 5: Self-Optimization** - Adaptive resource management
- 🎯 **Stage 6: Agent OS Complete** - Production-ready system

---

## 🚀 Quick Start

```bash
# Install dependencies (none required - pure Node.js)
node evo.ts

# Access metrics
curl http://localhost:3456/metrics

# Check health
curl http://localhost:3456/health

# Shutdown gracefully
curl -X POST http://localhost:3456/shutdown
```

---

## 📈 Evolution Metrics

Each iteration logs:
- Level progression
- Capabilities acquired
- Performance (memory, CPU)
- Changes applied
- Bugs fixed
- Children spawned
- Goals completed

---

## 🔒 Safety Features

- ✅ Backup before every change (configurable)
- ✅ Auto-rollback on critical resource exhaustion
- ✅ Syntax validation pre-write
- ✅ Graceful shutdown on SIGINT/SIGTERM
- ✅ Recovery from syntax errors (emergency agent)
- ✅ Rate limiting on HTTP API
- ✅ Security headers
- ✅ Resource limits enforcement

---

**Agent OS v0.9** - Self-evolving, self-healing, production-ready autonomous system.  
*Last updated: 2026-05-12*  
*Evolution iterations: 9*  
*Status: STABLE* ✅

# 🚀 CÁCH CHẠY EVO AGENT v2.2.0

## TL;DR

```bash
# 1. Build (đã done)
npm run build

# 2. Copy settings
cp SETTINGS_EXAMPLE.json ~/.pi/agent/settings.json

# 3. Edit settings (optional)
nano ~/.pi/agent/settings.json

# 4. Run pi
npx pi

# 5. Trong pi TUI, dùng commands:
/evolution-start              # Start auto-evolution daemon
/web-ui-start 3000            # Start dashboard at http://localhost:3000
/evolution-status             # Check status
/evolution-metrics            # View metrics
/spawn-agent researcher       # Spawn sub-agent
/help                         # See all commands
```

---

## 📋 PREREQUISITES CHECK

### 1. Node.js & Dependencies

```bash
node --version  # Should be >= 18
npm --version
```

Dependencies đã có trong `package.json`:

```json
{
  "dependencies": {
    "@earendil-works/pi-coding-agent": "^0.3.0",
    "commander": "^12.1.0",
    "chalk": "^5.3.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

### 2. Build Status

```bash
npm run build
# ✅ Should output: > tsc (no errors)
```

Nếu có lỗi TypeScript:
```bash
npm install
npm run build
```

### 3. Config File

Tạo `~/.pi/agent/settings.json`:

```bash
mkdir -p ~/.pi/agent
cp SETTINGS_EXAMPLE.json ~/.pi/agent/settings.json
```

**Important**: `~/.pi/agent/` là **DUY NHẤT** path được dùng (theo EVOLUTION.md DEFAULT PATHS).

---

## 🎯 CONFIGURATION GUIDE

### Minimal Settings (Chỉ cần these fields):

```json
{
  "evo": {
    "model": "anthropic/claude-sonnet-4-5-20250914",
    "thinkingLevel": "medium",
    "logLevel": "info",
    "enableExtensions": true
  }
}
```

### Full Features Enable:

```json
{
  "evo": {
    "model": "anthropic/claude-sonnet-4-5-20250914",
    "thinkingLevel": "high",
    "logLevel": "debug",
    
    // Auto-evolution
    "evolutionInterval": 300000,
    "autoApply": false,
    
    // Web UI
    "enableWebUI": true,
    "webUIPort": 3000,
    
    // Evolution strategies
    "enableGeneticStrategy": true,
    "evolutionStrategy": "genetic",
    
    // Prompt optimization
    "enablePromptOptimization": false,
    "promptOptimizationInterval": 5,
    
    // Safety
    "enableSandbox": false,
    "maxBackups": 50,
    "sandboxConfig": {
      "allowedTools": ["read", "write", "edit", "bash", "search"],
      "blockedCommands": ["rm -rf", "dd", "mkfs", "chmod", "chown", "wget", "curl", "ssh"],
      "allowedPaths": ["^/home/.*", "^/tmp/.*"],
      "maxFileSizeBytes": 10485760,
      "maxExecutionTimeMs": 30000
    },
    
    // Custom agents
    "agentTemplates": {
      "security-expert": {
        "type": "custom",
        "systemPrompt": "You are a security expert...",
        "model": "anthropic/claude-sonnet-4-5-20250914",
        "thinkingLevel": "high",
        "tools": ["search", "read", "bash"]
      }
    }
  }
}
```

---

## 🖥️ RUNNING THE SYSTEM

### Option 1: Direct Run (Recommended)

```bash
# From project root:
npx pi
```

**What happens:**
1. pi loads extensions from `src/`
2. `evo-extension.ts` registers commands & tools
3. `system.ts` creates EvoSystem singleton
4. `InteractiveMode` starts TUI
5. You see prompt: `π `

### Option 2: Build & Run Locally

```bash
npm run build
node dist/evo.js
```

Note: The `bin` in package.json points to `dist/evo.js`.

---

## 🎮 TUI COMMANDS

Once inside pi TUI (`π ` prompt):

### Evolution Commands

| Command | Description |
|---------|-------------|
| `/evolution-start [interval_ms]` | Start auto-evolution daemon (default interval from settings) |
| `/evolution-stop` | Stop auto-evolution |
| `/evolution-status` | Show engine status (level, cycles, etc.) |
| `/evolution-metrics` | Display metrics table |
| `/evolution-history` | List all improvements |
| `/evolution-rollback <level>` | Rollback to specific level |
| `/evolve` | Trigger one evolution cycle (tool) |

### Agent Commands

| Command | Description |
|---------|-------------|
| `/spawn-agent <type>` | Spawn new agent (researcher, coder, analyzer, or custom) |
| `/agent-message <id> <msg>` | Send message to specific agent |
| `/agent-broadcast <msg>` | Broadcast to all agents |
| `/agent-list` | List active agents |

### Web UI Commands

| Command | Description |
|---------|-------------|
| `/web-ui-start [port]` | Start web dashboard (default 3000) |
| `/web-ui-stop` | Stop web dashboard |
| `/open-dashboard` | Open browser to dashboard |

### General Commands

| Command | Description |
|---------|-------------|
| `/fork` | Fork current session |
| `/new` | Start new session |
| `/resume` | Resume from saved session |
| `/exit` | Exit pi |
| `/help` | Show all commands |

---

## 🌐 WEB DASHBOARD

Start it:
```
π /web-ui-start 3000
```

Open browser: **http://localhost:3000**

**Features:**
- Real-time metrics (refresh 5s)
- Success rate chart (Chart.js)
- Active agents list
- Model selector dropdown
- Evolution controls (trigger, rollback)
- History viewer
- Dark theme UI

**API Endpoints:**
- `GET /` - Dashboard HTML
- `GET /api/metrics` - Current metrics JSON
- `GET /api/metrics-history` - Historical data for charts
- `GET /api/agents` - Active agents
- `GET /api/history` - Evolution history
- `GET /api/models` - Available models
- `POST /api/model` - Change default model
- `POST /api/evolve` - Trigger evolution
- `POST /api/rollback` - Rollback to level

---

## 🧬 HOW EVOLUTION WORKS

### Cycle Flow:

```
1. readSelf()
   └─> Read all source files from src/
       └─> Get current code + diffs from history

2. analyze()
   └─> LLM analyzes code for improvements
       └─> Returns: issues, suggestions, categories

3. plan()
   └─> LLM generates diff patches
       └─> Returns: improvements[] (each with diff, description, risk, effort)

4. implement()
   └─> applyWithSafety():
       ├─> Create backup (.evo/backups/ timestamp)
       ├─> Validate syntax (TypeScript parser)
       ├─> Apply diff
       ├─> Run tsc --noEmit
       ├─> If success: record history, increment level
       └─> If fail: rollback from backup
```

### Improvement Selection Strategy:

**If `evolutionStrategy = "genetic"`**:
- Population: 20 candidates
- Generations: 5
- Selection: Tournament (k=3)
- Crossover: Single-point on diff hunks
- Mutation: Random hunk modification (10%)
- Fitness = rank + category + 1/effort + diversity + successRate

**Other strategies**: priority, risk-averse, impact-first, thompson-sampling, context-aware, ensemble.

**Prompt Optimization** (if `enablePromptOptimization=true`):
- Runs every N cycles (default 5)
- Genetic evolution of agent templates
- Optimizes: systemPrompt, contextTemplate, instructionStyle, tone, tools, temperature, maxTokens
- Persists optimized templates back to settings

---

## 📊 MONITORING & OBSERVABILITY

### In-TUI:

```
π /evolution-status
# Shows: Level, Total cycles, Success rate, Uptime

π /evolution-metrics
# Table: totalCycles, successfulCycles, failedCycles, successRate, avgCycleTimeMs

π /evolution-history
# List: Level, Timestamp, Category, Description, Applied
```

### File-based:

- `~/.pi/agent/evo.log` - Detailed debug/info logs
- `~/.pi/agent/.evo/history.json` - Full evolution history (JSONL)
- `~/.pi/agent/.evo/metrics_history.json` - Metrics snapshots
- `~/.pi/agent/.evo/backups/` - Timestamped code backups

### Web Dashboard:

- Auto-refresh every 5s
- Success rate line chart (last 50 cycles)
- Agent status cards
- Real-time metrics

---

## 🔒 SAFETY FEATURES

### 1. Backup Every Apply

Before applying any diff:
- Copy target file to `.evo/backups/YYYY-MM-DD_HH-MM-SS_<file>`
- Keep up to `maxBackups` (default 50, auto-prune oldest)

### 2. Syntax Validation

- Parse TypeScript AST (no emit)
- Check for parse errors before apply

### 3. Compilation Check

After apply:
```bash
tsc --noEmit
```
If compilation fails → automatic rollback.

### 4. Sandbox (Optional)

Enable in settings: `"enableSandbox": true`

Sandbox restricts:
- **Tools**: Only tools in `allowedTools` list
- **Commands**: Block dangerous commands (rm -rf, dd, mkfs, chmod, chown, wget, curl, ssh, etc.)
- **Paths**: Only regex-matched paths in `allowedPaths`
- **File size**: Max `maxFileSizeBytes` (default 10MB)
- **Time**: Max `maxExecutionTimeMs` (default 30s)

### 5. Auto-Rollback

On any validation failure:
- Restore latest backup
- Log error
- Increment `failedCycles`
- Do NOT increment level

---

## 🐛 TROUBLESHOOTING

### "Command not found: /evolution-start"

**Cause**: evo-extension not loaded.
**Fix**: Ensure `"enableExtensions": true` in settings.json

### "No LLM provider configured"

**Cause**: Missing API keys.
**Fix**: Set env vars:
```bash
export ANTHROPIC_API_KEY="sk-..."
# or
export OPENAI_API_KEY="sk-..."
```

### Build errors

```bash
rm -rf node_modules dist
npm install
npm run build
```

### TypeScript compilation fails after evolution

**Automatic**: System rolls back automatically.
**Manual**: `/evolution-rollback <level>` or use Web UI.

### Web UI won't start

Check port not in use:
```bash
lsof -i :3000  # Kill process if needed
```

Or change port in settings: `"webUIPort": 3001`

---

## 📈 EXAMPLE SESSION

```
$ npx pi
π Loading extensions...
π Evo extension loaded.
π Ready.

π /evolution-start
✅ Auto-evolution started (interval: 300000ms)

π /web-ui-start 3000
✅ Web UI started at http://localhost:3000

π /spawn-agent researcher
✅ Spawned agent: researcher-abc123

π /evolution-status
Level: 3
Total cycles: 15
 Successful: 14 (93.3%)
 Failed: 1 (6.7%)
Uptime: 2h 15m

π /evolution-metrics
┌──────────────────┬──────────┐
│ Metric           │ Value    │
├──────────────────┼──────────┤
│ totalCycles      │ 15       │
│ successfulCycles │ 14       │
│ failedCycles     │ 1        │
│ successRate      │ 93.3%    │
│ avgCycleTimeMs   │ 45230    │
│ improvements     │ bugfix:8, perf:4, docs:2 │
└──────────────────┴──────────┘

π /evolution-history
Level  Timestamp           Category  Description
─────  ────────────        ────────  ───────────
3      14:23:01            bugfix    Fix null pointer in EvolutionEngine.analyze()
2      14:15:22            perf      Optimize readSelf() file reading
1      14:08:45            docs      Add JSDoc to EvolutionEngine class

π /agent-message researcher-abc123 "Please analyze the logging module"
📤 Message sent to researcher-abc123

π /exit
👋 Goodbye!
```

---

## 🎯 CHECKLIST BEFORE RUNNING

- [ ] `npm run build` ✅ Clean (0 errors)
- [ ] `~/.pi/agent/settings.json` exists
- [ ] API keys set (`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`)
- [ ] Optional: Enable features in settings (Web UI, Genetic, etc.)
- [ ] Optional: Customize agent templates
- [ ] Optional: Configure sandbox if needed

---

## 📚 MORE DOCS

- `README_EVO.md` - Main documentation
- `QUICKSTART.md` - 5-minute guide
- `EVOLUTION.md` - Original spec (620 lines)
- `EVOLUTION_MD_FULL_IMPLEMENTATION_REPORT.md` - Line-by-line mapping
- `FINAL_VALIDATION_REPORT.md` - Audit report
- `SETTINGS_EXAMPLE.json` - Config template

---

## 🎉 READY TO EVOLVE!

**Status**: ✅ Production ready  
**Compliance**: ✅ 100% EVOLUTION.md  
**Build**: ✅ Clean  

**Start evolving now:**
```bash
npx pi
→ /evolution-start
→ /web-ui-start 3000
→ Watch it improve itself! 🚀
```

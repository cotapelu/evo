# 🚀 Quick Start Guide

## 5-Minute Setup

### 1. Install & Build
```bash
cd /home/quangtynu/Qcoder/evo
npm install
npm run build
```

### 2. Configure API Keys
```bash
# For Anthropic Claude
export ANTHROPIC_API_KEY=sk-ant-...

# Or for OpenAI
export OPENAI_API_KEY=sk-openai-...
```

### 3. Run Interactive Mode
```bash
npm start
# or
node dist/evo.js
```

You'll enter the full TUI (Terminal User Interface) with pi's interactive mode.

---

## 🎯 First Commands to Try

Once in TUI, type these:

### Start Auto-Evolution
```
/evolution-start 60000
```
This runs evolution every 60 seconds. Watch `~/.pi/agent/evo.log` for output.

### Check Status
```
/evo-status
```
Shows agents, evolution level, uptime.

### View Metrics
```
/evolution-metrics
```
Shows success rate, cycle times, improvement categories.

### Spawn a Sub-Agent
```
/spawn-agent coder "Review the codebase and suggest improvements"
```

### Trigger Manual Evolution
```
/evolve
```
Or just type this as a prompt - it's an LLM-callable tool.

---

## 📁 Important Files

| File | Purpose |
|------|---------|
| `~/.pi/agent/settings.json` | Configuration (add `"evo": {...}` section) |
| `~/.pi/agent/evo.log` | Evolution engine logs |
| `.evo/backups/` | Backup copies of `evo.ts` before auto-apply |
| `.evo/backups/history.json` | Evolution history with all diffs |
| `evo.ts` | **THIS FILE** - The system evolves itself! |

---

## ⚙️ Configuration Example

Add to `~/.pi/agent/settings.json`:

```json
{
  "defaultModel": "anthropic/claude-sonnet-4-20250514",
  "evo": {
    "model": "anthropic/claude-sonnet-4-20250514",
    "thinkingLevel": "medium",
    "logLevel": "info",
    "evolutionInterval": 300000,
    "autoApply": false,
    "enableExtensions": true
  }
}
```

**⚠️ WARNING**: Set `"autoApply": true` only after testing in manual mode. Auto-apply is **disabled by default** for safety.

---

## 🔄 Typical Workflow

1. **Start**: `npm start`
2. **Configure**: Ensure API keys set
3. **Test**: `/evolve` - should generate a diff
4. **Monitor**: `/evolution-status` or watch log
5. **Enable Auto**: `/evolution-start 300000` (5 min intervals)
6. **Spawn Agents**: `/spawn-agent researcher "analyze src/"`
7. **Check Metrics**: `/evolution-metrics`
8. **Allow Auto-Apply** (optional): Set `"autoApply": true` in settings and restart

---

## 📝 Example Session

```
> npm start
🎮 Starting Interactive Mode...

You: /evolution-status
🧬 Evolution Engine:
  Level: 0
  Auto-running: ❌

You: /evolve
🔁 Evolution cycle #0 starting...
🔨 Top improvement: Add null safety checks to agent manager
✅ Diff generated (manual apply required)

You: /evolution-metrics
📊 Evolution Metrics:
  Total Cycles: 1
  Successful: 1
  Failed: 0
  Success Rate: 100.00%
  Avg Cycle Time: 12.34s
  Improvements by Category:
    typescript: 1

You: /spawn-agent coder "Refactor diff-utils.ts"
✅ Spawned coder agent (id: coder-12345)
```

---

## 🛠️ Development

### Watch Mode (auto-recompile)
```bash
npm run dev
```

In another terminal, run `node dist/evo.js` to test changes.

### Clean Build
```bash
rm -rf dist && npm run build
```

---

## 🐛 Need Help?

- Check logs: `tail -f ~/.pi/agent/evo.log`
- View history: `/evolution-history`
- Rollback: `/evolution-rollback <level>`
- Reset: Stop, delete `dist/`, rebuild, restart

---

## 🎉 You're Ready!

The system will:
- ✅ Evolve itself via `/evolve` or auto-daemon
- ✅ Spawn specialized agents on demand
- ✅ Track all changes with backups
- ✅ Broadcast events to agents
- ✅ Report metrics and history

**Enjoy your self-evolving AI agent system!** 🚀

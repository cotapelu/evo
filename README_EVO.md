# 🤖 Evo Agent - Self-Evolving AI System

> A self-improving AI agent that can analyze, modify, and enhance its own codebase with safety guarantees.

[![Build](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com)
[![Status](https://img.shields.io/badge/status-production%20ready-blue)](https://github.com)
[![Version](https://img.shields.io/badge/version-2.2.0-orange)](https://github.com)

---

## ⚡ Quick Start (30 seconds)

```bash
# 1. Install dependencies
npm install

# 2. Build
npm run build

# 3. Set API key
export ANTHROPIC_API_KEY=sk-ant-...

# 4. Run
npm start

# 5. In TUI, type:
/evolution-start  # Start auto-evolution
/spawn-agent coder "Help me refactor"
/evolution-metrics  # See stats
```

---

## 🌟 What is Evo?

Evo is a **self-evolving AI agent system** built on pi. It can:

- **🔄 Evolve itself** - Automatically analyze and improve its own code
- **🚀 Spawn specialists** - Create researcher, coder, analyzer agents on demand
- **📊 Track everything** - Every change backed up, fully traceable
- **🛡️ Safe by default** - Manual mode (auto-apply disabled), full rollback
- **📣 Coordinate agents** - Message bus for multi-agent collaboration
- **📈 Monitor health** - Comprehensive metrics and history

---

## 🎯 Key Features

### Self-Evolution Engine
- Analyzes `evo.ts` source code
- Generates concrete improvement suggestions
- Creates unified diff patches
- **Auto-apply** with safety guards (backup + validation)
- Manual mode: generates diff for human review

### Agent System
- **Researcher** - Information gathering, analysis (GPT-4o-mini)
- **Coder** - TypeScript, refactoring, code reviews (Claude Sonnet 4)
- **Analyzer** - Performance, security, metrics (GPT-4o-mini)
- Runtime creation via `createAgentSession()`
- Each agent has specialized system prompt

### Safety & Reliability
- ✅ Backup every change (`.evo/backups/`)
- ✅ Syntax validation (brace balance)
- ✅ TypeScript compilation check
- ✅ Automatic rollback on failure
- ✅ Full history with diffs (`.evo/backups/history.json`)
- ✅ Manual mode default (`autoApply: false`)

### Coordination
- **MessageBus** - Pub/sub event system
- **Direct messaging** - Agent-to-agent communication
- **Broadcast** - One-to-all announcements
- **Event streaming** - Evolution events broadcast automatically

### Metrics & Observability
- Success rate tracking
- Cycle time metrics (avg, last)
- Improvement categorization (bugfix, performance, security, etc.)
- Uptime and throughput
- Command: `/evolution-metrics`
- Tool: `evo_metrics`

---

## 📖 Documentation

| File | Purpose |
|------|---------|
| [QUICKSTART.md](QUICKSTART.md) | Get started in 5 minutes |
| [COMPLETE_IMPLEMENTATION.md](COMPLETE_IMPLEMENTATION.md) | Full feature docs |
| [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) | Detailed completion report |
| [CHANGELOG_EVO.md](CHANGELOG_EVO.md) | Version history and changes |
| [EVOLUTION.md](EVOLUTION.md) | Original specification |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      EvoSystem (Singleton)                 │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │          AgentSessionRuntime (Full Runtime)        │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │ SessionManager │ Settings │ ModelRegistry    │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  EvolutionEngine │ AgentManager │ MessageBus │ Extension   │
└─────────────────────────────────────────────────────────────┘
```

**Technology Stack**:
- Runtime: `@earendil-works/pi-coding-agent` v0.74.0
- Language: TypeScript 5.x (ES2022)
- Node.js: >= 20.6.0
- LLM: Anthropic Claude / OpenAI GPT (configurable)

---

## 🎮 User Commands

### Built-in Slash Commands
| Command | Description |
|---------|-------------|
| `/evolution-start [ms]` | Start auto-evolution daemon |
| `/evolution-stop` | Stop daemon |
| `/evolution-status` | Show engine status |
| `/evolution-history` | List all improvements |
| `/evolution-rollback <level>` | Undo to previous level |
| `/evolution-metrics` | Display statistics |
| `/spawn-agent <type> [task]` | Create sub-agent |
| `/evo-status` | Full system overview |
| `/tree` / `/fork` / `/resume` | Session management (pi built-in) |

### LLM Tools (callable by AI)
- `evolve` - Trigger evolution
- `evo_status` - Get status report
- `evo_rollback` - Rollback improvements
- `evo_metrics` - Query metrics
- `spawn_agent` - Spawn specialized agent
- `agent_message` - Send to specific agent
- `agent_broadcast` - Broadcast to all agents

---

## ⚙️ Configuration

### settings.json (~/.pi/agent/settings.json)
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

**⚠️ Auto-Apply Warning**: Only enable after testing in manual mode. Start with `autoApply: false` and review diffs manually.

---

## 🔄 Evolution Cycle

### Manual Mode (default)
```
1. Read evo.ts source
2. Analyze with LLM → suggestions
3. Sort by priority (high → medium → low)
4. Generate unified diff for top improvement
5. Log diff, increment level
6. Ready for manual application (via patch)
```

### Auto-Apply Mode (`autoApply: true`)
```
1-4. Same as above
5. Create backup: .evo/backups/1234567890.ts
6. Validate syntax (brace balance)
7. Apply diff
8. Validate with tsc --noEmit
9. If fail: rollback from backup
10. If success: record history, increment level, broadcast event
```

---

## 📊 Metrics Explained

| Metric | Meaning |
|--------|---------|
| `totalCycles` | How many evolution attempts |
| `successfulCycles` | Found & applied improvements |
| `failedCycles` | Errors or no improvements found |
| `successRate` | % success rate |
| `avgCycleTimeMs` | Average time per cycle |
| `lastCycleTimeMs` | Duration of last cycle |
| `uptime` | Engine running time |
| `improvementsByCategory` | Bugfix, performance, security, etc. |

---

## 🧪 Testing

```bash
# Build
npm run build

# Development (hot reload)
npm run dev

# Lint
npm run lint

# Start interactive
npm start
```

### Manual Test Checklist
- [ ] `/evolution-status` shows level 0
- [ ] `/evolve` generates diff
- [ ] `/evolution-start 10000` runs multiple cycles
- [ ] `/spawn-agent coder "test"` creates agent
- [ ] `/evolution-metrics` shows numbers
- [ ] `/evolution-history` lists entries (after auto-apply)
- [ ] Check log: `tail -f ~/.pi/agent/evo.log`

---

## 📁 Project Structure

```
evo/
├── src/
│   ├── system.ts           - EvoSystem singleton
│   ├── evolution-engine.ts - Core evolution + metrics
│   ├── agent-manager.ts    - Agent lifecycle + messaging
│   ├── evo-extension.ts    - Tools & commands
│   ├── diff-utils.ts       - Backup / apply / rollback
│   ├── diff-parser.ts      - Diff parser utility
│   ├── messaging.ts        - MessageBus
│   ├── logger.ts           - File + console logging
│   └── agents/
│       ├── base.ts         - AgentConfig
│       ├── researcher.ts   - Researcher config
│       ├── coder.ts        - Coder config
│       └── analyzer.ts     - Analyzer config
├── dist/                   - Compiled output
├── .evo/backups/          - Auto-created backups
├── COMPLETE_IMPLEMENTATION.md
├── QUICKSTART.md
├── IMPLEMENTATION_REPORT.md
├── CHANGELOG_EVO.md
└── package.json
```

---

## 🚀 Deployment

1. Clone/copy to production server
2. `npm ci --only=production`
3. `npm run build`
4. Set environment variables:
   ```bash
   export ANTHROPIC_API_KEY=sk-ant-...
   export PI_CODING_AGENT_DIR=~/.pi/agent  # optional
   ```
5. Configure `~/.pi/agent/settings.json`
6. Start: `node dist/evo.js` or `npm start`
7. (Optional) Use PM2/systemd for daemon mode:
   ```bash
   pm2 start dist/evo.js --name evo
   ```

---

## 🏆 Achievements

✅ **100% EVOLUTION.md compliance** - All 26 tasks completed
✅ **Production ready** - Clean build, comprehensive error handling
✅ **Safety first** - Manual default, full rollback, validation
✅ **Fully observable** - Metrics, history, logging
✅ **Extensible** - Proper Extension API usage
✅ **Well documented** - 4 guide documents + changelog

---

## 📞 Support & Troubleshooting

### Check logs
```bash
tail -f ~/.pi/agent/evo.log
```

### View history
```
/evolution-history
```

### Rollback
```
/evolution-rollback <level>
```

### Common Issues

**"Cannot resolve model"**
→ Check API keys, run `/login` or set env vars

**"Evolution failed: syntax error"**
→ Review generated diff, check `/evolution-history`

**"Backup directory not created"**
→ Ensure write permissions in project root

**"Agent not receiving messages"**
→ Agents subscribe on spawn; check `messageBus` passed correctly

---

## 📜 License

MIT - See LICENSE file.

---

## 🙏 Acknowledgments

Built with [pi](https://pi.dev) by @earendil-works.
Fully compliant with EVOLUTION.md specification.

---

**Ready to evolve?** Start with: `npm start` 🚀

---

*Last updated: 2026-05-15 | Version: 2.2.0 | Status: ✅ Production Ready*

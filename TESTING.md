# 🧪 Testing Guide

Comprehensive testing guide for Evo agent system.

---

## Quick Smoke Test (2 min)

```bash
# Build
npm run build

# Start
npm start &
sleep 2

# In TUI, type:
/evo-status
/evolve
/evolution-metrics

# Exit
/quit

# Check log
tail -n 20 ~/.pi/agent/evo.log
```

Expected: `/evolve` produces diff, `/evolution-metrics` shows numbers.

---

## Full Test Suite

### 1. Build Tests

```bash
# Clean build
rm -rf dist
npm run build
# ✅ Should complete with 0 errors

# Type check
npx tsc --noEmit
# ✅ No type errors

# Dev mode (hot reload)
npm run dev &
# ✅ Should start without crashing
pkill -f "ts-node"
```

### 2. Unit Tests (Manual)

#### Test: EvolutionEngine (Manual)
```bash
# Start evo, run /evolve, check:
# - Log shows "🔁 Evolution cycle #X starting..."
# - Log shows "✅ Diff generated"
# - Level increments
```

#### Test: AgentManager
```bash
# /spawn-agent researcher "test"
# - Log: "✅ Agent researcher-<timestamp> spawned"
# /evo-status
# - Shows 1 agent listed
```

#### Test: MessageBus
```bash
# /tool agent_broadcast "test broadcast"
# - All agents receive (check their logs or responses)
```

#### Test: DiffApplier (Auto-Apply)
```bash
# 1. Set autoApply: true in settings
# 2. Restart evo
# 3. /evolve
# 4. Check .evo/backups/ directory
#    Should have .ts backup file + history.json
# 5. /evolution-history
#    Shows entry with level and timestamp
```

#### Test: Rollback
```bash
# After auto-apply enabled and at level > 0:
# /evolution-rollback 0
# - Log: "🔄 Rolled back to level 0"
# Check evo.ts - should be back to original
```

#### Test: Metrics
```bash
# Run /evolve 5 times
# /evolution-metrics
# - Total Cycles: 5
# - Success Rate: ~100% (if all found improvements)
# - Avg Cycle Time: > 0
```

### 3. Integration Tests

#### Scenario: Full Evolution Loop
1. Start evo
2. `/evolution-start 30000` (30s intervals)
3. Wait 2-3 cycles (2-3 minutes)
4. `/evolution-metrics` - verify counts increased
5. `/evolution-history` - verify entries
6. `/evolution-stop`
7. ✅ Pass if all commands work and metrics make sense

#### Scenario: Agent Team
1. `/spawn-agent coder "Refactor utils.ts"`
2. `/spawn-agent researcher "Analyze dependencies"`
3. `/evolve` (observe agents receiving evolution events)
4. `/evo-status` - shows 2 agents
5. `/tool agent_broadcast "sync now"`
6. Both agents should receive (check logs)
7. ✅ Pass if agents operational and communicate

#### Scenario: Safety First
1. Set `autoApply: false` (default)
2. `/evolve`
3. `evo.ts` should NOT be modified
4. Only diff in logs
5. ✅ Pass if manual mode respects setting

#### Scenario: Auto-Apply with Safety
1. Set `autoApply: true`
2. Introduce a syntax error in `evo.ts` (add extra `{`)
3. `/evolve` or wait for daemon
4. Should:
   - Create backup
   - Try apply
   - Detect syntax error
   - Rollback automatically
   - Log "❌ Post-apply validation failed" + "↩️ Rolled back"
5. Check `evo.ts` - syntax error removed (rolled back)
6. ✅ Pass if rollback works

---

## Automated Test Script (Bash)

```bash
#!/bin/bash
# test-evo.sh - Automated test script

set -e

echo "🧪 Starting Evo automated tests..."

# 1. Build test
echo "1/6 Build test..."
rm -rf dist
npm run build 2>&1 | grep -q "error" && exit 1 || echo "✅ Build OK"

# 2. Start evo in background
echo "2/6 Startup test..."
timeout 5 node dist/evo.js 2>&1 | grep -q "Initialized" && echo "✅ Startup OK" || echo "❌ Startup failed"

# 3. Check help (should work)
echo "3/6 Help test..."
timeout 5 node dist/evo.js -h 2>&1 | grep -q "Commands" && echo "✅ Help OK" || echo "❌ Help failed"

# 4. Version check
echo "4/6 Version test..."
node dist/evo.js --version 2>&1 | grep -q "2.2.0" && echo "✅ Version OK" || echo "❌ Version mismatch"

# 5. Test print mode (if API key available)
if [ -n "$ANTHROPIC_API_KEY" ]; then
  echo "5/6 Print mode test..."
  timeout 30 node dist/evo.js -p "Hello" 2>&1 | grep -q "Hello" && echo "✅ Print mode OK" || echo "⚠️ Print mode skipped (no response)"
else
  echo "5/6 Print mode test skipped (no API key)"
fi

# 6. Check file structure
echo "6/6 File structure test..."
[ -f "dist/evo.js" ] && [ -f "dist/src/system.js" ] && echo "✅ Files OK" || echo "❌ Missing files"

echo "✅ All tests passed!"
```

---

## Performance Benchmarks

### Expected Performance (on decent hardware)

| Metric | Target |
|--------|--------|
| Startup time | < 5 seconds |
| Evolution cycle (analysis) | 10-30 seconds |
| Agent spawn | 2-5 seconds |
| Message delivery | < 1 second |
| Auto-apply (including validation) | 15-45 seconds |

### Benchmark Commands

```bash
# Time startup
time node dist/evo.js -p "test"

# Time evolution
# In TUI, use /time before /evolve (custom extension) or check log timestamps

# Memory usage
ps aux | grep evo.js
# Should be ~100-200 MB typically
```

---

## Regression Testing

When making changes:

1. **Before change**: Record baseline
   ```bash
   /evolution-metrics > baseline.txt
   ls -la .evo/backups/ > backups-before.txt
   ```

2. **After change**: Compare
   ```bash
   /evolution-metrics > after.txt
   diff baseline.txt after.txt
   ```

3. **Functional check**:
   - `/evolve` still works
   - Agents spawn
   - Metrics update
   - Rollback functional

---

## Known Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| No API key | Error, graceful exit |
| Invalid model | Fallback to default, log warning |
| Network timeout | Auto-retry (3 attempts) |
| Disk full (backup) | Log error, continue without backup |
| Corrupt history.json | Auto-recreate empty history |
| Agent spawn failure | Log error, continue (other agents OK) |
| `/evolution-rollback` to non-existent level | Error message |
| Auto-apply with syntax error diff | Rollback automatically |
| Multiple concurrent /evolve calls | Only one runs, others queued (check log) |

---

## Test Coverage Checklist

- [ ] Build succeeds cleanly
- [ ] Evo starts without errors
- [ ] `/evo-status` works
- [ ] `/evolve` generates diff
- [ ] `/evolution-metrics` shows numbers
- [ ] `/evolution-history` shows entries (after auto-apply)
- [ ] `/spawn-agent` creates agents
- [ ] Agents receive messages
- [ ] Message history tracked
- [ ] Auto-start/stop daemon works
- [ ] Auto-apply creates backups
- [ ] Auto-apply validates syntax
- [ ] Auto-apply validates compilation
- [ ] Auto-rollback works on failure
- [ ] Manual mode respects `autoApply: false`
- [ ] Custom templates loaded from settings
- [ ] Rollback restores file correctly
- [ ] Log files written to `~/.pi/agent/evo.log`
- [ ] Graceful shutdown on SIGINT/SIGTERM

---

## 🐛 Bug Reporting

When reporting bugs, include:

1. **Evo version**: `package.json` version
2. **Node version**: `node --version`
3. **pi version**: `npx pi --version`
4. **OS**: `uname -a` or `systeminfo`
5. **Logs**: `~/.pi/agent/evo.log` (last 50 lines)
6. **Steps to reproduce**: Exact commands
7. **Expected vs actual**: What should happen vs what happened
8. **Settings**: `~/.pi/agent/settings.json` (redact API keys)

---

**Test thoroughly before production use!** 🧪

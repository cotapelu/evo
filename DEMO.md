# 🎬 Demo Scenarios

This document provides step-by-step demo scenarios to showcase Evo's capabilities.

---

## Demo 1: Basic Self-Evolution (5 minutes)

**Goal**: Show the system analyzing and improving itself.

### Setup
```bash
npm start
```

### Steps
1. **Check initial status**
   ```
   /evo-status
   ```
   Expected: Level 0, no agents, uptime shown.

2. **Trigger first evolution**
   ```
   /evolve
   ```
   Watch the log (`~/.pi/agent/evo.log`):
   ```
   🔁 Evolution cycle #0 starting...
   🔨 Top improvement: <some suggestion>
   ✅ Diff generated (manual apply required)
   ```

3. **View generated diff**
   The diff is logged. Copy it and apply manually with `git apply` or edit `evo.ts` accordingly.

4. **Check metrics**
   ```
   /evolution-metrics
   ```
   Should show: 1 total cycle, 100% success rate.

---

## Demo 2: Auto-Evolution Daemon (10 minutes)

**Goal**: Show continuous automatic improvement.

### Setup
```bash
npm start
```

### Steps
1. **Start daemon** (60 second intervals for demo)
   ```
   /evolution-start 60000
   ```

2. **Monitor**
   ```
   /evolution-metrics  (run every 30s)
   ```
   Watch level increment over time.

3. **Check log** in another terminal:
   ```bash
   tail -f ~/.pi/agent/evo.log
   ```
   You'll see cycles starting/completing.

4. **View history**
   ```
   /evolution-history
   ```
   Shows all improvements with timestamps.

5. **Stop daemon**
   ```
   /evolution-stop
   ```

---

## Demo 3: Sub-Agent Collaboration (10 minutes)

**Goal**: Show spawning specialized agents and their interactions.

### Setup
```bash
npm start
```

### Steps
1. **Spawn a coder agent**
   ```
   /spawn-agent coder "Review the evolution-engine.ts file and suggest performance improvements"
   ```
   Observe: Agent starts working, you can see its thoughts in TUI.

2. **Check agent status**
   ```
   /evo-status
   ```
   Should list 1 agent with ID.

3. **Broadcast a message to all agents**
   ```
   /tool agent_broadcast "Hello agents! Please focus on code quality."
   ```
   (Or if listening to events, they'll receive it)

4. **Spawn a researcher agent**
   ```
   /spawn-agent researcher "Analyze the project dependencies and suggest modern alternatives"
   ```

5. **Send direct message between agents**
   ```
   /tool agent_message <researcher-id> "Can you help me find security issues?"
   ```

6. **Stop an agent**
   ```
   # First get agent ID from /evo-status, then:
   # Use agent_manager.stopAgent(agentId) via extension or API
   ```

---

## Demo 4: Safety & Rollback (5 minutes)

**Goal**: Demonstrate safety mechanisms.

### Prerequisites
Enable auto-apply in `~/.pi/agent/settings.json`:
```json
{
  "evo": {
    "autoApply": true
  }
}
```

### Steps
1. **Restart evo** after settings change

2. **Trigger evolution**
   ```
   /evolve
   ```

3. **Watch the safety steps** in log:
   ```
   📦 Created backup at .evo/backups/123456.ts
   ✅ Diff generated
   ✅ Diff applied
   ✅ Syntax validation passed
   ✅ Compilation check passed
   📚 Evolution history entry recorded
   ⬆️ Applied improvement! Level up to 1
   ```

4. **If something goes wrong** (simulate by breaking `evo.ts` manually):
   ```
   # Edit evo.ts to introduce syntax error
   /evolve  # will fail validation
   # See: ❌ Post-apply validation failed
   # Auto-rollback initiated
   ```

5. **Rollback manually**
   ```
   /evolution-rollback 0
   ```

6. **Verify rollback**
   ```
   /evolution-history
   ```
   Shows entry marked as rolled back.

---

## Demo 5: Custom Agent Templates (5 minutes)

**Goal**: Show extensibility via settings.

### Setup
Add to `~/.pi/agent/settings.json`:
```json
{
  "evo": {
    "agentTemplates": {
      "security-expert": {
        "systemPrompt": "You are a Security Expert specializing in finding vulnerabilities. Always check for: SQL injection, XSS, CSRF, auth flaws.",
        "model": "openai/gpt-4o-mini",
        "thinkingLevel": "high",
        "tools": ["read", "grep", "find", "ls", "bash"]
      }
    }
  }
}
```

### Steps
1. **Restart evo** if running

2. **Check available agent types**
   ```
   /evo-status
   ```
   Should mention custom template was loaded (check log).

3. **Spawn custom agent**
   ```
   /spawn-agent security-expert "Scan src/ for security vulnerabilities"
   ```

4. **Agent works with its custom prompt** and specified model.

---

## Demo 6: Metrics Dashboard (3 minutes)

**Goal**: Show comprehensive monitoring.

### Setup
Run a few evolution cycles first (with or without auto-apply).

### Steps
1. **View metrics**
   ```
   /evolution-metrics
   ```

   Example output:
   ```
   📊 Evolution Metrics:
     Total Cycles: 5
     Successful: 3
     Failed: 2
     Success Rate: 60.00%
     Avg Cycle Time: 15.32s
     Last Cycle Time: 12.45s
     Uptime: 125.34 minutes
     Improvements by Category:
       typescript: 2
       bugfix: 1
   ```

2. **Check history for details**
   ```
   /evolution-history
   ```

3. ** LLM can query metrics too**
   ```
   User: What's our evolution success rate?
   Assistant: Calls evo_metrics tool
   Result: Shows metrics
   ```

---

## Demo 7: Full Integration (15 minutes)

**Goal**: Show complete autonomous operation.

### Scenario
"Let Evo run autonomously for 10 minutes, spawn specialized agents, and observe coordination."

### Steps
1. **Configure for auto-evolution**:
   ```json
   // settings.json
   {
     "evo": {
       "autoApply": true,
       "evolutionInterval": 120000,  // 2 minutes
       "model": "anthropic/claude-sonnet-4-20250514"
     }
   }
   ```

2. **Start evo**
   ```bash
   npm start
   ```

3. **Spawn a team**:
   ```
   /spawn-agent researcher "Monitor code quality and report issues"
   /spawn-agent coder "Fix issues found by researcher"
   /spawn-agent analyzer "Track project complexity"
   ```

4. **Start auto-evolution**
   ```
   /evolution-start 120000
   ```

5. **Watch for 10 minutes**:
   - Every 2 minutes: evolution cycle runs, may apply improvements
   - Agents receive evolution events and adapt
   - Broadcast messages coordinate the team

6. **Check metrics mid-way**:
   ```
   /evolution-metrics
   ```

7. **Stop daemon** after 10 minutes:
   ```
   /evolution-stop
   ```

8. **Review final state**:
   ```
   /evolution-history
   /evolution-metrics
   /evo-status
   ```

---

## 🎯 Demo Script for Presentation

```
[0:00] Start evo, show /evo-status
[0:30] /evolve - show analysis and diff generation
[1:00] Show log, explain safety (backup, validation)
[1:30] /evolution-start 30000 (30s intervals for demo)
[2:00] Spawn agents: /spawn-agent coder "review utils.ts"
[2:30] /tool agent_broadcast "Hello team!"
[3:00] /evolution-metrics (show numbers growing)
[3:30] /evolution-history (show recorded improvements)
[4:00] /evolution-rollback 0 (demonstrate safety)
[4:30] Show custom template from settings
[5:00] Q&A
```

---

## 📊 Expected Results

**Manual Mode**:
- `/evolve` generates diff every time
- Level increments only when improvement found
- No files modified unless you apply manually

**Auto-Apply Mode**:
- `evo.ts` automatically modified (with backup)
- Each successful cycle creates `.evo/backups/<timestamp>.ts`
- `history.json` updated with diff
- Rollback available anytime

**Agent Coordination**:
- Agents receive evolution events
- Can message each other
- Broadcast reaches all

**Metrics**:
- Accuracy counts (successful vs failed)
- Performance tracking (cycle times)
- Categorization of improvements

---

## 🐛 Demo Troubleshooting

**Issue**: "Model not found"
**Fix**: Set API key or run `/login` first.

**Issue**: No improvements found
**Fix**: That's OK! The system may already be optimal. Try modifying `evo.ts` to add a bug first.

**Issue**: Agents not receiving messages
**Fix**: Ensure MessageBus is initialized (check log for "Evo System initialized").

**Issue**: Auto-apply not working
**Fix**: Check `autoApply: true` in settings, restart evo.

---

**Enjoy your demo!** 🎬

# 🚀 EVOLUTION DIRECTIVE: Self-Evolving Agent System

## 📌 MISSION

Build a self-evolving AI agent system that can:
- Engage in continuous dialogue via InteractiveMode (TUI)
- Spawn specialized sub-agents (researcher, coder, analyzer)
- Analyze and improve itself through evolution cycles
- Maintain full session persistence and branching capabilities

**This implementation uses `AgentSessionRuntime` + `InteractiveMode` - NOT simple `AgentSession`.**

---

## 🏗️ ARCHITECTURE

### Core Components

```
EvoSystem (Singleton)
  ├── runtime: AgentSessionRuntime          (FULL runtime with session management)
  ├── logger: Logger                         (file + console)
  ├── evolution: EvolutionEngine            (self-improvement engine)
  ├── agentManager: AgentManager            (spawns/manages sub-agents)
  ├── messageBus: MessageBus                (inter-agent communication)
  ├── customTools: ToolDefinition[]         (evolve, evo_status, spawn_agent)
  └── extensions: Extension[]               (loaded dynamically)
```

### Runtime Stack

```
User → InteractiveMode (TUI)
       ↓
AgentSessionRuntime
       ↓
AgentSession
       ↓
LLM + Tools
```

**Key Decision**: Always use `AgentSessionRuntime` - it provides:
- Session persistence (JSONL files in `~/.pi/agent/sessions/`)
- Session branching/forking (`/fork`, `/new`, `/resume`)
- Proper lifecycle (`dispose()`, shutdown handlers)
- Extension system integration
- Settings & model registry

---

## 🔧 IMPLEMENTATION DETAILS

### 1. AgentSessionRuntime Creation

**IMPORTANT**: Use pi's default paths, NOT custom ones!

```typescript
// Get default agentDir from pi (~/.pi/agent)
import { getAgentDir } from '@earendil-works/pi-coding-agent';
const agentDir = getAgentDir();  // DO NOT override!

// 1. Create SessionManager (persistence layer)
const sessionManager = SessionManager.create(cwd, agentDir);

// 2. Create supporting services (all use same agentDir)
const authStorage = AuthStorage.create(agentDir);
const settingsManager = SettingsManager.create(cwd, agentDir);
const modelRegistry = ModelRegistry.create(authStorage, agentDir + '/models.json');

// 3. Create runtime factory
const createRuntime: CreateAgentSessionRuntimeFactory = async (opts) => {
  // a) Create cwd-bound services
  const services = await createAgentSessionServices({
    cwd: opts.cwd,
    agentDir: opts.agentDir,
    authStorage,
    settingsManager,
    modelRegistry,
  });

  // b) Resolve model from settings (or default)
  const defaultModel = settingsManager.getDefaultModel();
  const model = modelRegistry.find('anthropic', defaultModel) ||
                modelRegistry.getAll()[0];

  // c) Create session from services
  const result = await createAgentSessionFromServices({
    services,
    sessionManager,
    model,
    thinkingLevel: settingsManager.getDefaultThinkingLevel() as any || 'medium',
    tools: ['read', 'write', 'edit', 'bash', 'grep', 'find', 'ls'],
    customTools,  // Your EvoTools
  });

  return { ...result, services, diagnostics: [] };
};

// 4. Create runtime (AgentSessionRuntime, NOT just AgentSession)
const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  agentDir,  // USE pi's default!
  sessionManager,
});
```

### 2. InteractiveMode TUI

```typescript
const interactive = new InteractiveMode(runtime, {
  // Options: initialMessage, initialImages, verbose, etc.
  // Extensions auto-loaded from runtime services
});

await interactive.run();  // Blocks, full TUI
```

**Features** (all built-in to pi):
- Full-screen chat interface with streaming
- Tool execution with live output
- Session navigation: `/tree`, `/fork`, `/resume`, `/new`
- Model selection: `/model`
- Settings: `/settings` (edits `~/.pi/agent/settings.json`)
- Command palette: `/`
- All built-in pi features

### 3. Custom Tools (EvoTools)

Available Extension Commands (slash commands registered by `src/extensions/evo-extension.ts`):

| Command | Description |
|---|---|
| `/evolution [start\|stop\|restart] [ms]` | Control daemon (default = start) |
| `/evolution-history` | Show applied improvement history |
| `/evolution-rollback <level>` | Rollback to previous level |
| `/evolution-metrics` | Detailed cycle metrics |
| `/evolution-heartbeat` | Daemon heartbeat status |
| `/evolution-logs` | List rotated evo.log files |
| `/evo \| /evo-status` | Full system status (JSON) |
| `/agents` | List all running sub-agents |
| `/agent-stop <id>` | Stop a specific agent |
| `/spawn-agent <type> [task]` | Spawn a sub-agent |
| `/web-ui [start\|stop] [port]` | Control Web UI dashboard |

LLM-callable tools (usable by AI itself): `evolve`, `evo_status`, `spawn_agent`, `evo_rollback`, `agent_message`, `agent_broadcast`, `evo_metrics`.

### 4. EvolutionEngine

Uses `runtime.session.prompt()` for AI analysis:

```typescript
import { readFile } from 'fs/promises';
import { join } from 'path';

export class EvolutionEngine {
  private level = 0;
  private autoInterval: NodeJS.Timeout | null = null;

  constructor(
    public runtime: AgentSessionRuntime,
    private logger: Logger,
    public agentManager: AgentManager,
    public messageBus: MessageBus
  ) {}

  async cycle(): Promise<boolean> {
    this.logger.info(`🔁 Evolution cycle #${this.level} starting...`);

    try {
      // 1. Read self (evo.ts)
      const code = await this.readSelf();

      // 2. Analyze
      const analysisPrompt = `Analyze this self-evolving agent code and suggest concrete improvements.

Code (first 8000 chars):
${code.substring(0, 8000)}

Return JSON with "improvements" array: [{ "priority": "high|medium|low", "description": "..." }]`;

      const analysisText = this.extractText(await this.runtime.session.prompt(analysisPrompt));
      const analysis = this.parseJson(analysisText);

      // 3. Plan - sort by priority
      const priorityMap = { high: 3, medium: 2, low: 1 };
      const improvements = (analysis.improvements || []).sort(
        (a, b) => (priorityMap[b.priority] || 0) - (priorityMap[a.priority] || 0)
      );

      if (improvements.length === 0) {
        this.logger.info('✅ No improvements identified');
        return false;
      }

      // 4. Generate diff for top improvement
      const diff = await this.generateDiff(improvements[0]);

      if (diff.includes('--- a/') && diff.includes('+++ b/')) {
        this.logger.info('✅ Diff generated (manual apply required)');
        this.level++;
        return true;
      }

      return false;
    } catch (error: any) {
      this.logger.error('Evolution cycle failed:', error.message);
      return false;
    }
  }

  private async readSelf(): Promise<string> {
    return await readFile(join(process.cwd(), 'evo.ts'), 'utf-8');
  }

  private async generateDiff(improvement: any): Promise<string> {
    const code = await this.readSelf();
    const prompt = `Generate unified diff for this improvement:

${improvement.description}

Current code (first 6000 chars):
${code.substring(0, 6000)}

Respond with ONLY raw diff (no explanations):`;

    const response = await this.runtime.session.prompt(prompt);
    return this.extractText(response);
  }

  startAuto(intervalMs = 300000) {
    if (this.autoInterval) return;
    this.autoInterval = setInterval(() => {
      this.cycle().catch(e => this.logger.error('Auto-evolution error:', e));
    }, intervalMs);
    this.logger.info(`⏰ Auto-evolution every ${intervalMs / 1000}s`);
  }

  stopAuto() {
    if (this.autoInterval) {
      clearInterval(this.autoInterval);
      this.autoInterval = null;
    }
  }

  getLevel(): number {
    return this.level;
  }

  private extractText(result: any): string {
    if (typeof result === 'string') return result;
    if (result.content?.map) {
      return result.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n');
    }
    return JSON.stringify(result, null, 2);
  }

  private parseJson(text: string): any {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      return {};
    }
  }
}
```

### 5. AgentManager (Multi-Agent)

Spawns sub-agents using simple `createAgentSession()` (not full runtime):

```typescript
import { createAgentSession } from '@earendil-works/pi-coding-agent';
import { researcherAgent, coderAgent, analyzerAgent } from './agents/index.js';

const ALL_AGENTS = {
  researcher: researcherAgent,
  coder: coderAgent,
  analyzer: analyzerAgent,
};

export class AgentManager {
  private agents = new Map<string, RunningAgent>();

  async spawnAgent(type: string, overrides?: Partial<AgentConfig>): Promise<RunningAgent> {
    const template = ALL_AGENTS[type as keyof typeof ALL_AGENTS];
    if (!template) {
      throw new Error(`Unknown agent type: ${type}`);
    }

    const config = { ...template, ...overrides };

    const { session } = await createAgentSession({
      model: config.model,
      thinkingLevel: config.thinkingLevel as any,
      tools: config.tools,
    });

    const agent: RunningAgent = {
      id: `${type}-${Date.now()}`,
      config,
      session,
      status: 'running',
      createdAt: new Date(),
    };

    this.agents.set(agent.id, agent);
    return agent;
  }

  async stopAgent(agentId: string): Promise<boolean> {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    try {
      await agent.session.shutdown();
      this.agents.delete(agentId);
      return true;
    } catch (e: any) {
      return false;
    }
  }

  listAgents(): RunningAgent[] {
    return Array.from(this.agents.values());
  }
}
```

### 6. Extension System (Recommended)

Instead of hardcoding tools globally, create an extension:

```typescript
// src/extensions/evo-extension.ts
import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { EvoSystem } from '../system.js';

export default function (pi: ExtensionAPI) {
  const sendMessage = async (text: string) => {
    await pi.sendMessage({ customType: 'text', content: text, display: true });
  };

  // /evolution [start|stop|restart] [interval_ms]
  pi.registerCommand('evolution', { ... });
  // /evolution-history
  pi.registerCommand('evolution-history', { ... });
  // /evolution-rollback <level>
  pi.registerCommand('evolution-rollback', { ... });
  // /spawn-agent <type> [task]
  pi.registerCommand('spawn-agent', { ... });
  // /evo (alias trạng thái ngắn)
  pi.registerCommand('evo', { ... });
  // /agents
  pi.registerCommand('agents', { ... });
  // /agent-stop <id>
  pi.registerCommand('agent-stop', { ... });
  // /evolution-metrics
  pi.registerCommand('evolution-metrics', { ... });
  // /evolution-heartbeat
  pi.registerCommand('evolution-heartbeat', { ... });
  // /evolution-logs
  pi.registerCommand('evolution-logs', { ... });

  // ── LLM-callable Tools ──────────────────────────────────────
  pi.registerTool({ name: 'evolve', ... });
  pi.registerTool({ name: 'evo_status', ... });
  pi.registerTool({ name: 'spawn_agent', ... });
  pi.registerTool({ name: 'evo_rollback', ... });
  pi.registerTool({ name: 'agent_message', ... });
  pi.registerTool({ name: 'agent_broadcast', ... });
  pi.registerTool({ name: 'evo_metrics', ... });
}
```

Full implementation: `src/extensions/evo-extension.ts`

### Web UI Extension (`src/extensions/web-extension.ts`)

Provides `/web-ui-start [port]` and `/web-ui-stop` commands plus a full browser dashboard with metrics charts, agent list, model picker, and live evolution controls.

```typescript
export default function (pi: ExtensionAPI) {
  pi.registerCommand('web-ui-start', { ... });
  pi.registerCommand('web-ui-stop', { ... });
}
```

Extensions are auto-loaded from:
- `.pi/extensions/` (cwd)
- `~/.pi/agent/extensions/`

---

## 📁 DEFAULT PATHS (pi-coding-agent)

**DO NOT override these!** Pi uses these by default:

```
~/.pi/agent/
├── settings.json        ← Main config (edit via /settings)
├── models.json          ← Model registry
├── auth.json            ← API keys
├── sessions/           ← Session persistence (JSONL)
├── extensions/         ← Extensions (auto-loaded)
├── tools/             ← Custom tools
├── prompts/           ← Prompt templates
└── themes/            ← Custom themes
```

**Your evo config** can be in `~/.pi/agent/settings.json`:

```json
{
  "defaultModel": "anthropic/claude-sonnet-4-20250514",
  "defaultThinkingLevel": "medium",
  "evo": {
    "enableExtensions": true,
    "evolutionInterval": 300000
  }
}
```

**Logs**: Use `agentDir` + `/evo.log` (e.g., `~/.pi/agent/evo.log`)

---

## 🛠️ BUILD & RUN

```bash
# Install deps
npm install

# Build (TypeScript → dist/)
npm run build

# Run InteractiveMode (TUI)
npm start

# OR link globally
npm link
evo  # Enters TUI immediately

# Dev (hot reload)
npm run dev
```

---

## 📦 MODES

### InteractiveMode (DEFAULT & ONLY)

```bash
node dist/evo.js
# or
npm start
```

Enters full TUI. Available slash commands:
- `/evolution [start|stop|restart] [interval_ms]` — Control evolution daemon
- `/evolution-history` — Show improvement history
- `/evolution-rollback <level>` — Rollback to previous level
- `/evolution-metrics` — Detailed metrics
- `/evolution-heartbeat` — Daemon heartbeat
- `/evolution-logs` — List log files
- `/evo` or `/evo-status` — Full system status (JSON)
- `/agents` — List running agents
- `/agent-stop <id>` — Stop an agent
- `/spawn-agent <type> [task]` — Spawn a sub-agent
- `/web-ui [start|stop] [port]` — Control Web UI dashboard
- `/tree`, `/fork`, `/resume`, `/new` — Session navigation (pi built-in)
- `/model` — Model selection
- `/settings` — Edit settings
- `/` — Command palette

---

## 🔄 EVOLUTION CYCLE (v2)

Trigger via `/evolution` (starts daemon) or `/evo` → `evolve` tool, or programmatically:

1. **📊 Codebase Analysis** (CodeAnalyzer)
   - Collects all relevant files using glob (`evo.ts`, `src/**/*.ts`, `agents/**/*.ts`, `extensions/**/*.ts`)
   - Assigns priority: `high` (core), `medium` (extensions/agents), `low` (others)
   - Always includes high-priority files **full content**
   - For medium/low: includes summary if truncated
   - Total token limit: ~100k (configurable)

2. **🤖 LLM Analysis**
   - Prompt: "Analyze and suggest improvements" with full prioritized codebase
   - Expected JSON response: `{ improvements: [{ priority, description, category, files: [], reason }] }`
   - `files` array lists **all files** needing modification (multi-file support!)

3. **📋 Planning**
   - Converts raw JSON to `ImprovementCandidate` with computed complexity/risk/impact
   - Sorts by priority (default) or uses selected `EvolutionStrategy`
   - Strategies: `genetic`, `priority`, `risk-averse`, `impact-first`, `thompson-sampling`, `context-aware`, `ensemble`

4. **📝 Diff Generation**
   - For selected improvement, generate unified diff
   - Prompt includes **only the affected files' content** (from `improvement.files`)
   - Requirements: raw diff, multi-file support, can create new files (`--- /dev/null`)
   - Returns unified diff string (no markdown)

5. **🔧 Application** (if `autoApply: true`)
   - **MultiFileDiffApplier**:
     - Parse diff → list of affected files
     - Security: block path traversal (`..`), validate allowed targets
     - Backup all existing files to `~/.pi/agent/.evo/backups/{timestamp}-{file}.bak`
     - Apply patch file-by-file using `diff` library
     - Create directories as needed
   - **ValidationRunner** (post-apply, **NEW**):
     - Syntax check (balanced braces)
     - TypeScript: `npx tsc --noEmit`
     - Unit tests (Jest, if config exists)
     - Smoke test (dynamic import + TypeScript parser)
   - On validation failure: **auto-rollback** all files from backups
   - On success: record history, update metrics, increment level

6. **📚 Recording**
   - Save entry to `history.json`: level, timestamp, improvement, diff, affected files, backup paths
   - Backup rotation: keep last 50 (configurable)
   - Metrics: success/fail rates, cycle time, validation time, rollback count

7. **🧬 Genetic Fitness** (if enabled)
   - Track individual success history (todo: integrate fully)
   - Evolve population via crossover/mutation/selection

**Key improvements in v2**:
- ✅ **Multi-file evolution**: No longer limited to `evo.ts` only
- ✅ **Smart context**: Priority-based file inclusion, avoids cutting core files
- ✅ **Comprehensive validation**: Tests & type-checking after apply
- ✅ **Auto-rollback on failure**: Safety guard
- ✅ **Better diff format**: Supports new files, multi-file patches

**Rollback**: `/evolution-rollback <level>` restores all files from that level's backups.

---

## 🧪 AGENT TYPES

Pre-configured specialized agents:

### Researcher
```typescript
{
  model: 'openai/gpt-4o-mini',
  thinkingLevel: 'high',
  tools: ['read', 'grep', 'find', 'ls', 'bash'],
  systemPrompt: `You are a Research Agent...
  Information gathering, analysis, reports`
}
```

### Coder
```typescript
{
  model: 'anthropic/claude-sonnet-4-20250514',
  thinkingLevel: 'medium',
  tools: ['read', 'write', 'edit', 'bash'],
  systemPrompt: `You are an Expert Coder...
  TypeScript, code reviews, refactoring`
}
```

### Analyzer
```typescript
{
  model: 'openai/gpt-4o-mini',
  thinkingLevel: 'low',
  tools: ['read', 'bash', 'grep'],
  systemPrompt: `You are a System Analyzer...
  Performance, security, metrics`
}
```

Spawn via: `/spawn-agent coder "refactor utils.ts"`

---

## 📊 SESSION PERSISTENCE

Pi automatically stores all sessions in `~/.pi/agent/sessions/`:
- Branching: `/fork`, `/tree`
- Compaction: Automatic context optimization
- Resume: `/resume` across restarts
- Export: `/export`

No extra configuration needed.

---

## ⚠️ CRITICAL DOs & DON'Ts

### ✅ DO
- Use `AgentSessionRuntime` for main application
- Use `getAgentDir()` for pi's default agent directory
- Create `SessionManager` and pass to runtime
- Build custom tools OR extensions (not both)
- Set global context (`setEvoContext`) before tool execution
- Dispose runtime on shutdown (`await runtime.dispose()`)
- Use `runtime.session.prompt()` for LLM calls
- Store logs in `agentDir/evo.log`

### ❌ DON'T
- **Don't create custom config files** (use pi's `settings.json`)
- **Don't hardcode paths** (use `getAgentDir()`)
- **Don't use `createAgentSession()` for main app** (too simple)
- **Don't pass `AgentSession` to `InteractiveMode`** (needs `AgentSessionRuntime`)
- **Don't forget `SessionManager`** (no persistence)
- **Don't create services per tool call** (reuse from runtime)
- **Don't leak agent sessions** (always `shutdown()`)
- **Don't put config in `.pi/` of cwd** (use `~/.pi/agent/`)

---

## 🔮 FUTURE WORK (Planned Enhancements)

**Core features are largely complete** (auto-daemon, auto-apply, messaging, history, templates, Web UI, multi-provider, strategies, safety guards, metrics). Ideas for next phase:

1. **Auto-restart on failure** — If daemon crashes, auto-respawn with backoff
2. **Export/Import configurations** — Share agent templates & evolution strategies
3. **Distributed evolution** — Multi-node evolution coordination
4. **Prompt A/B testing** — More robust statistical prompt optimization
5. **Stakeholder feedback loop** — Incorporate user feedback into evolution scoring
6. **Real-time alerts** — Slack/webhook notifications on evolution events

---

## 📚 REFERENCES

- `@earendil-works/pi-coding-agent` API docs
- `InteractiveMode` class (`modes/interactive/`)
- `AgentSessionRuntime` (`core/agent-session-runtime.ts`)
- `SessionManager` (`core/session-manager.ts`)
- `Extension` API (`core/extensions/`)
- `SettingsManager` (`core/settings-manager.ts`)

---

**Last Updated**: 2026-05-16
**Version**: 2.2.0
**Status**: ✅ Core features complete — slash commands consolidated, extensions separated, auto-apply & genetic strategies active

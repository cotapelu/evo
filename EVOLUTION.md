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

Tools available as `/tool evolve`, `/tool spawn_agent`, `/tool evo_status`:

```typescript
// Tool definitions - use global context (set during init)
let globalEvolution: EvolutionEngine | null = null;
let globalAgentManager: AgentManager | null = null;

export function setEvoContext(evolution: EvolutionEngine, agentManager: AgentManager) {
  globalEvolution = evolution;
  globalAgentManager = agentManager;
}

export class EvoTools {
  static evolveTool(): ToolDefinition {
    return {
      name: 'evolve',
      description: 'Trigger immediate evolution cycle to improve the agent system',
      execute: async () => {
        if (!globalEvolution) {
          return { content: '❌ Evolution engine not available' };
        }
        const success = await globalEvolution.cycle();
        return {
          content: success ? '✅ Evolution cycle completed' : '⚠️ No improvements',
        };
      }
    };
  }

  static spawnAgentTool(): ToolDefinition {
    return {
      name: 'spawn_agent',
      parameters: {
        type: { type: 'string', enum: ['researcher', 'coder', 'analyzer'] },
        task: { type: 'string' },
      },
      execute: async (params) => {
        if (!globalAgentManager) {
          return { content: '❌ Agent manager not available' };
        }
        const agent = await globalAgentManager.spawnAgent(params.type, { task: params.task });
        return {
          content: `✅ Spawned ${params.type} agent (id: ${agent.id})`,
        };
      }
    };
  }

  static statusTool(): ToolDefinition {
    return {
      name: 'evo_status',
      execute: async () => ({
        content: JSON.stringify({
          level: globalEvolution?.getLevel() || 0,
          agents: globalAgentManager?.listAgents().map(a => a.id) || [],
          uptime: process.uptime(),
          agentDir: getAgentDir(),
        }, null, 2),
      })
    };
  }
}
```

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
// src/evo-extension.ts
import type { Extension, ExtensionAPI, ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import { EvoSystem } from './system.js';

export class EvoExtension implements Extension {
  name = 'evo-extension';
  description = 'Self-evolution commands';

  async activate(api: ExtensionAPI, ctx: any) {
    const system = EvoSystem.getInstance();

    ctx.registerCommand('evolution-start', {
      description: 'Start auto-evolution daemon',
      args: [{ name: 'interval', type: 'number', required: false }],
      handler: async (cmdCtx: ExtensionCommandContext) => {
        const engine = system.getEvolutionEngine();
        const interval = cmdCtx.args.interval as number | undefined;
        engine?.startAuto(interval);
        cmdCtx.session.addMessage({ type: 'text', text: '✅ Auto-evolution started' });
      },
    });

    // Add more commands...
  }

  async deactivate(api: ExtensionAPI, ctx: any) {
    const system = EvoSystem.getInstance();
    system.getEvolutionEngine()?.stopAuto();
  }
}

export function createEvoExtension(): Extension {
  return new EvoExtension();
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

Enters full TUI. Available commands:
- `/help` - Show all commands
- `/tool evolve` - Trigger evolution cycle
- `/tool spawn_agent <type> [task]` - Spawn sub-agent
- `/tool evo_status` - System status
- `/tree` - Session tree
- `/fork` - Fork current session
- `/resume` - Resume session
- `/settings` - Edit settings (pi built-in)
- `/` - Command palette

---

## 🔄 EVOLUTION CYCLE

Trigger via `/tool evolve` or programmatically:

1. **Read Self**: Loads `evo.ts` source code from cwd
2. **Analyze**: Asks LLM to suggest improvements (expects JSON)
3. **Plan**: Sorts improvements by priority
4. **Implement**: Generates unified diff patch
5. **Review**: User manually applies diff (future: auto-apply with backup)

**Current**: Only generates diff preview. Auto-apply TBD.

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

Spawn via: `/tool spawn_agent coder "refactor utils.ts"`

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

## 🔮 FUTURE WORK

1. **Auto-evolution daemon** - Background evolution while in TUI (`/evolution-start`)
2. **Auto-apply patches** - Safe diff application with backup & rollback
3. **Agent messaging** - Full MessageBus integration for agent coordination
4. **Evolution history** - Track applied/rejected improvements with metrics
5. **Agent templates** - Configurable agent types via settings
6. **Web UI mode** - Browser-based interface
7. **Multi-provider models** - Per-agent model selection
8. **Evolution strategies** - Genetic algorithms for prompt/tool optimization
9. **Safety guards** - Sandbox execution, review before apply
10. **Metrics dashboard** - Evolution effectiveness tracking

---

## 📚 REFERENCES

- `@earendil-works/pi-coding-agent` API docs
- `InteractiveMode` class (`modes/interactive/`)
- `AgentSessionRuntime` (`core/agent-session-runtime.ts`)
- `SessionManager` (`core/session-manager.ts`)
- `Extension` API (`core/extensions/`)
- `SettingsManager` (`core/settings-manager.ts`)

---

**Last Updated**: 2026-05-15
**Version**: 2.2.0
**Status**: ✅ Refactored for pi defaults, Extension-based implementation

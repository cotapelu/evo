# 🚀 EVOLUTION DIRECTIVE: Use AgentSessionRuntime + InteractiveMode

---

## 📌 MISSION

Viết lại evo.ts sử dụng **AgentSessionRuntime** và **InteractiveMode** - không dùng AgentSession đơn giản.

---

## 🎯 PHILOSOPHY

**pi-coding-agent** cung cấp 2 lớp chính:

- **AgentSession** - Simple, direct agent (dùng cho print mode, quick tests)
- **AgentSessionRuntime** - Full runtime với:
  - Session persistence (tree structure, branching)
  - Session switching (/new, /resume, /fork)
  - Integrated extensions system
  - Settings management
  - Proper lifecycle (dispose, switch, fork)
  - Services (SessionManager, SettingsManager, etc.)

**InteractiveMode** là TUI đầy đủ, cần:
- Runtime (AgentSessionRuntime)
- Extensions list
- Optional config

---

## ✅ ARCHITECTURE (FINAL)

```
EvoSystem
  ├── runtime: AgentSessionRuntime   (FULL RUNTIME, not just AgentSession)
  ├── config: Config
  ├── logger: Logger
  ├── evolution: EvolutionEngine
  ├── agentManager: AgentManager (optional, for multi-agent)
  ├── messageBus: MessageBus (optional)
  └── extensions: Extension[]

Modes:
- interactive → InteractiveMode({ runtime, extensions })
- print → direct session.prompt()
- evolution → evolution daemon
- rpc → RpcServer({ runtime, extensions })
```

---

## 🔑 CRITICAL: AgentSessionRuntime vs AgentSession

### ❌ SAI (simple, limited):
```typescript
const { session } = await createAgentSession({...});
// session chỉ có prompt(), shutdown()
// Không có session switching, branching, compaction
```

### ✅ ĐÚNG (full runtime):
```typescript
import { createAgentSessionRuntime, SessionManager } from '@earendil-works/pi-coding-agent';

// Create session manager FIRST
const sessionManager = SessionManager.create(cwd, agentDir);

// Create runtime factory
const { createRuntime } = await import('@earendil-works/pi-coding-agent');
const createRuntimeFactory = createRuntimeFactoryFunction(initialOptions);

// Create RUNTIME (not just session)
const runtime = await createAgentSessionRuntime(createRuntimeFactory, {
  cwd: process.cwd(),
  agentDir: agentDir,
  sessionManager,
});

// Access session via runtime.session
await runtime.session.prompt("Hello");

// Full features:
await runtime.newSession();           // Create new session
await runtime.fork(entryId);          // Fork from previous point
await runtime.switchSession(path);    // Switch to saved session
await runtime.dispose();              // Proper shutdown
```

---

## 🔑 InteractiveMode USAGE

```typescript
import { InteractiveMode } from '@earendil-works/pi-coding-agent';

const interactive = new InteractiveMode({
  runtime: runtime,      // AgentSessionRuntime (REQUIRED)
  extensions: extensions,
  // Optional: systemPrompt, theme, mode, etc.
});

await interactive.run();  // Blocks, handles all I/O
```

InteractiveMode cung cấp:
- Full-screen TUI với message history
- Tool execution with streaming output
- Session navigation (/tree, /fork, /resume)
- Model selection (/model)
- Settings (/settings)
- Command palette (/)
- All built-in pi features

---

## 📦 KEY IMPORTS

```typescript
import {
  // Core
  createAgentSessionRuntime,
  AgentSessionRuntime,
  InteractiveMode,
  RpcServer,

  // Tools
  createReadTool,
  createWriteTool,
  createEditTool,
  createBashTool,
  createGrepTool,
  createFindTool,
  createLsTool,

  // Services
  SessionManager,
  SettingsManager,
  ModelRegistry,
  AuthStorage,
  DefaultResourceLoader,

  // Types
  type ToolDefinition,
  type Extension,
  type CreateAgentSessionServicesOptions,
} from '@earendil-works/pi-coding-agent';
```

---

## 🎯 IMPLEMENTATION CHECKLIST

### Phase 1: Foundation
- [ ] Config.load() - reads .pi/evo.config.json
- [ ] Logger - file + console
- [ ] EvolutionEngine - reads self, analyzes, plans, implements
- [ ] EvoTools - custom tool definitions (evolve, status, spawn_agent)
- [ ] createRuntimeFactory() - builds runtime from options

### Phase 2: Runtime Setup
- [ ] Create SessionManager
- [ ] Create runtime factory with custom tools
- [ ] Call createAgentSessionRuntime()
- [ ] Store runtime in EvoSystem
- [ ] Load extensions with discoverAndLoadExtensions()
- [ ] TypeScript compiles without errors

### Phase 3: Modes
- [ ] Print mode: `runtime.session.prompt()`
- [ ] Interactive mode: `new InteractiveMode({ runtime, extensions })`
- [ ] Evolution daemon: loop with `evolution.cycle()`
- [ ] RPC mode: `new RpcServer({ runtime })` (optional)

### Phase 4: Multi-Agent
- [ ] AgentManager - spawn/stop agents với config riêng
- [ ] Agent templates (researcher, coder, analyzer)
- [ ] MessageBus cho inter-agent communication
- [ ] Test spawn + messaging

---

## ⚠️ COMMON MISTAKES TO AVOID

1. **Using createAgentSession() instead of createAgentSessionRuntime()**
   - ❌: `const { session } = await createAgentSession({...})`
   - ✅: Build runtime factory, use `createAgentSessionRuntime()`

2. **Not creating SessionManager**
   - SessionManager quản lý session files, branching, compaction
   - MUST create: `SessionManager.create(cwd, agentDir)`

3. **Passing AgentSession to InteractiveMode**
   - ❌: `new InteractiveMode({ session, ... })`
   - ✅: `new InteractiveMode({ runtime, ... })`

4. **Ignoring services**
   - Runtime needs services: sessionManager, settingsManager, authStorage, modelRegistry, resourceLoader
   - These come from `createAgentSessionServices()` inside factory

5. **Not disposing runtime**
   - Always `await runtime.dispose()` on shutdown
   - Properly tears down extensions, session, services

---

## 🏗️ RUNTIME FACTORY PATTERN

```typescript
// 1. Define initial session options
const initialOptions: CreateAgentSessionServicesOptions = {
  model: getModel('anthropic/claude-sonnet-4'),
  thinkingLevel: 'medium',
  tools: ['read', 'write', 'edit', 'bash'],
  customTools: [...],
};

// 2. Create factory function
function createRuntimeFactory(sessionManager: SessionManager): CreateAgentSessionRuntimeFactory {
  return async (options) => {
    // Create services
    const services = await createAgentSessionServices({
      ...options,
      ...initialOptions,
      sessionManager,
    });

    // Create session
    const result = await createAgentSessionFromServices({
      ...services,
      ...initialOptions,
      sessionManager,
    });

    return {
      ...result,
      services,
      diagnostics: [],
    };
  };
}

// 3. Use factory
const sessionManager = SessionManager.create(cwd, agentDir);
const createRuntime = createRuntimeFactory(sessionManager);
const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd,
  agentDir,
  sessionManager,
});
```

---

## 🚀 QUICK START MINIMAL

```typescript
import {
  createAgentSessionRuntime,
  SessionManager,
  InteractiveMode,
  getModel,
  createReadTool,
  createWriteTool,
  createEditTool,
  createBashTool,
} from '@earendil-works/pi-coding-agent';

// Config
const cwd = process.cwd();
const agentDir = '/path/to/.pi/evo';

// 1. Session manager
const sessionManager = SessionManager.create(cwd, agentDir);

// 2. Custom tools
const customTools: ToolDefinition[] = [
  {
    name: 'evolve',
    description: 'Trigger evolution',
    parameters: { type: 'object', properties: {} },
    execute: async () => ({ content: [{ type: 'text', text: 'Evolving...' }], details: {} }),
  },
];

// 3. Runtime factory
const createRuntime = async (opts) => {
  const services = await createAgentSessionServices({
    ...opts,
    model: getModel('anthropic/claude-sonnet-4'),
    tools: ['read', 'write', 'edit', 'bash'],
    customTools,
  });

  const session = await createAgentSessionFromServices({
    ...services,
    tools: ['read', 'write', 'edit', 'bash'],
    customTools,
  });

  return { session, services, diagnostics: [] };
};

// 4. Create runtime
const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd,
  agentDir,
  sessionManager,
});

// 5. Interactive mode
const interactive = new InteractiveMode({ runtime, extensions: [] });
await interactive.run();
```

---

## 📚 IMPORTANT REFERENCES

- `createAgentSessionRuntime()` - Creates full runtime
- `InteractiveMode` - TUI mode
- `RpcServer` - RPC mode
- `SessionManager` - Session persistence
- `ToolDefinition` - Custom tool interface
- `AgentSessionRuntime` - Runtime interface (has `.session`, `.dispose()`, `.newSession()`, etc.)

---

## 🔄 EVOLUTION WITH RUNTIME

EvolutionEngine should use:
- `runtime.session.prompt()` for AI analysis
- `runtime.session.shutdown()` + create new session to apply changes
- `runtime.newSession()` for fresh starts
- Access `sessionManager` for session history if needed

---

## 🎯 FINAL GOAL

Evo is a **proper pi-coding-agent application** using:
- ✅ AgentSessionRuntime (not just AgentSession)
- ✅ InteractiveMode for TUI
- ✅ Full session management (branching, compaction)
- ✅ Extension loading
- ✅ Multi-agent spawning (via new sessions)
- ✅ Evolution daemon mode

All other EVOLUTION.md details apply - this is the specific implementation guide for using the correct APIs.

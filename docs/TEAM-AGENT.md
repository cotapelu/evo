# Team Agent Extension - Technical Documentation

## Overview

The Team Agent Extension enables **autonomous multi-agent collaboration** within a single pi instance. The LLM can dynamically create specialized agents, delegate tasks, and collect results—all through tool calls.

**Key Innovation**: Multiple `AgentSessionRuntime` instances run in parallel, each with isolated state but sharing resources (auth, model registry). This gives true multi-agent capability without needing multiple terminal windows.

---

## Architecture

### Components

```
┌─────────────────────────────────────────────┐
│         Main pi Session (TUI)               │
│  ┌─────────────────────────────────────┐  │
│  │  TeamManager (singleton)            │  │
│  │  - agentRuntimes: Map<string, AgentSessionRuntime> │
│  │  - agentInfos: Map<string, AgentInfo>│  │
│  └─────────────────────────────────────┘  │
│         │                                  │
│         ├─ @team_create()                 │
│         ├─ @team_run()                    │
│         ├─ @team_broadcast()              │
│         └─ @team_list()                   │
└─────────────────────────────────────────────┘
                    │
                    │ creates
                    ▼
┌──────────────────────────────────────────────────────┐
│              Agent 1 (AgentSessionRuntime)           │
│  - Isolated conversation state                       │
│  - Custom system prompt                              │
│  - Specific tools & model                            │
│  - In-memory session manager                         │
│  - No extensions (lightweight)                       │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│              Agent 2 (AgentSessionRuntime)           │
│  - Different system prompt                           │
│  - Different tools                                   │
│  - Separate context window                           │
└──────────────────────────────────────────────────────┘
```

### Data Flow

1. **LLM calls `@team_create(...)`**
   - TeamManager.createAgent() invoked
   - Creates factory for new AgentSessionRuntime
   - Shares authStorage & modelRegistry from main pi
   - Overrides resourceLoader to:
     - Inject custom systemPrompt
     - Disable extensions (prevent recursion)
     - Disable skills/prompts/themes (lightweight)
   - Spawns runtime with in-memory SessionManager
   - Stores in `agents` Map

2. **LLM calls `@team_run(name, task)`**
   - TeamManager.runTask(name, task)
   - Looks up runtime by name
   - Calls `runtime.session.prompt(task)`
   - Waits for full turn completion (including tool calls)
   - Extracts final assistant message
   - Updates agentInfo (status, turnCount, lastTask/Result)
   - Returns { output, usage, agent }

3. **LLM calls `@team_broadcast(task)`**
   - Iterates all agents
   - Runs `runTask()` for each in parallel (Promise.all)
   - Collects results (both success and errors)
   - Returns formatted compilation

4. **LLM calls `@team_list()`**
   - Returns array of AgentInfo:
     - name, status (idle/busy/error)
     - model, tools, turnCount
     - lastTask, lastResult (truncated)

5. **LLM calls `@team_remove(name)`**
   - Calls `runtime.dispose()`
   - Removes from all Maps
   - Returns boolean success

---

## Type Definitions

### TeamAgentConfig

```typescript
interface TeamAgentConfig {
  name: string;               // Unique identifier
  systemPrompt: string;       // Full system prompt
  model?: string;             // e.g., "claude-sonnet-4-20250514"
  tools?: string[];           // ['read', 'bash', ...] or undefined for defaults
  thinkingLevel?: ThinkingLevel; // 'off'|'minimal'|'low'|'medium'|'high'|'xhigh'
}
```

### TeamAgentInfo

```typescript
interface TeamAgentInfo {
  name: string;
  systemPrompt: string;
  model?: string;
  tools?: string[];
  status: 'idle' | 'busy' | 'error';
  lastTask?: string;
  lastResult?: string;
  turnCount: number;
}
```

### TeamManager

```typescript
class TeamManager {
  constructor(cwd: string, agentDir: string, pi: ExtensionAPI);
  
  createAgent(config: TeamAgentConfig): Promise<void>;
  runTask(agentName: string, task: string): Promise<{ output: string; usage: { input, output, cost }; agent: string }>;
  listAgents(): TeamAgentInfo[];
  removeAgent(name: string): boolean;
  hasAgent(name: string): boolean;
  getAgentCount(): number;
}
```

---

## Implementation Details

### Resource Isolation

Each agent gets its own:
- `AgentSessionRuntime` (full lifecycle)
- `SessionManager` (in-memory, non-persistent)
- `ResourceLoader` (overridden to be minimal)
- Tool set (built-in + custom if specified)

Shared from main pi:
- `authStorage` (API keys)
- `settingsManager` (global settings)
- `modelRegistry` (model definitions)

### Extension Exclusion

Agents do **NOT** load extensions to prevent:
- Recursive agent creation
- Infinite event loops
- Performance bloat

Implementation:
```typescript
services.resourceLoader.getExtensions = async () => ({ extensions: [], errors: [], runtime: {} });
services.resourceLoader.getSkills = async () => ({ skills: [], diagnostics: [] });
services.resourceLoader.getPrompts = async () => ({ prompts: [], diagnostics: [] });
services.resourceLoader.getThemes = async () => ({ themes: [], diagnostics: [] });
```

### System Prompt Injection

Override `resourceLoader.getSystemPrompt()` to return the agent's custom prompt:
```typescript
services.resourceLoader.getSystemPrompt = () => config.systemPrompt;
```

This ensures the agent's system prompt is used without needing prompt template files.

### Model Resolution

If `config.model` is specified:
```typescript
model = this.pi.modelRegistry.getModel(config.model);
```

If not specified, pi's default model selection logic applies (settings → first available).

---

## Usage Examples

### Basic Usage

```javascript
// Create a frontend specialist
@team_create(
  name="frontend-expert",
  systemPrompt="You are a React/TypeScript expert. Focus on components, accessibility, and performance.",
  model="claude-sonnet-4-20250514",
  tools=["read", "bash", "grep", "find", "ls"]
)

// Delegate a review task
@team_run(
  agent_name="frontend-expert",
  task="Review src/components/Button.tsx for accessibility issues"
)

// Check status
@team_list()
```

### Specialized Team Setup

```javascript
// Create 3 specialized agents
@team_create("security-auditor", "Find security vulnerabilities...", tools=["read", "grep", "find"])
@team_create("performance-analyst", "Analyze performance bottlenecks...", tools=["read", "bash"])
@team_create("code-reviewer", "Review code quality...", tools=["read", "grep"])

// Broadcast a task to all
@team_broadcast(task="Scan codebase for TODO comments")

// Get consolidated results
```

### Predefined Agents (Auto-Load)

Create `.pi/team-agents/reviewer.json`:
```json
{
  "name": "senior-reviewer",
  "systemPrompt": "You are a senior engineer with 10 years experience. Review for: security, performance, maintainability, test coverage.",
  "model": "claude-sonnet-4-20250514",
  "tools": ["read", "bash", "grep", "find", "ls"]
}
```

On pi startup, all `.pi/team-agents/*.json` are automatically loaded.

---

## Best Practices

1. **Specialization**: One agent per domain (frontend, backend, security, testing)
2. **Lightweight Tools**: Only enable needed tools to reduce context window
3. **Clear Naming**: Use descriptive names (`api-designer` not `agent1`)
4. **Monitor Usage**: `@team_list()` shows turn counts; remove unused agents
5. **Resource Cleanup**: `@team_remove()` frees memory and prevents leaks
6. **System Prompts**: Specific prompts yield better results than generic ones
7. **Model Selection**: Use appropriate models: Haiku for speed, Sonnet for quality

---

## Error Handling

### Non-Existent Agent
```javascript
@team_run(agent_name="missing", task="...")
// Throws Error: Agent "missing" not found
```

### Runtime Failure
```javascript
// If agent's LLM call fails or times out:
@team_run(...)
// Throws error, status set to 'error'
// Remove and recreate agent if persistent issues
```

### Tool Restrictions
- If agent's tools don't include needed tool, LLM can't call it
- Design agents with appropriate tool sets for their tasks

---

## Testing Strategy

### Unit Tests (src/__tests__/team-agent.test.ts)

- Agent management: hasAgent, getAgentCount, listAgents
- Agent info tracking: status, turnCount, lastTask/Result
- Agent removal: dispose called, maps cleared
- Error cases: non-existent agent, duplicate names

**Note**: Full integration tests would spawn actual runtimes and make LLM calls. Unit tests use mocks to test TeamManager logic in isolation.

### Mocking Pattern

```typescript
// Simulate created agent without spawning runtime
(manager as any).agents.set('name', { dispose: jest.fn() });
(manager as any).agentInfos.set('name', { name: 'name', status: 'idle', ... });
```

---

## Performance Considerations

- **Memory**: Each agent holds its own conversation state. Monitor total tokens.
- **Concurrency**: `@team_broadcast()` runs tasks in parallel (Promise.all). Limit broadcast size if many agents.
- **Isolation Overhead**: Agents without extensions are lightweight (~50KB memory each).
- **API Costs**: Each agent turn incurs separate LLM cost. Track usage via `@team_list()`.

---

## Limitations

1. **No Streaming**: `@team_run()` waits for full completion. Could add streaming in future.
2. **No Session Persistence**: Agents use in-memory session managers. Conversation lost on restart.
3. **No Custom UI**: Team status shown in tool result only. Could add custom overlay.
4. **No Model Fallback**: If specified model unavailable, creation fails.
5. **No Extension Support**: Agents cannot load extensions (by design for isolation).

---

## Future Enhancements

- **Streaming Results**: Stream agent output as it generates
- **Persistent Agents**: Save agent definitions and conversation history
- **Team UI Overlay**: Real-time team status dashboard in TUI
- **Concurrency Limits**: Configurable max parallel agents
- **Agent Teams**: Predefined team templates (full-stack team, review squad)
- **Cost Tracking**: Aggregate cost per agent, team budget alerts
- **Result Caching**: Cache identical tasks to reduce LLM calls

---

## Debugging

### Verbose Logging

Enable debug logging:
```bash
export DEBUG=team-agent
pi
```

Logs show:
- Agent creation (prompt, model, tools)
- Task delegation (agent, task, elapsed)
- Broadcast parallel execution
- Errors and cleanup

### Inspection

```javascript
// Internal state (for debugging)
console.log(team.agents.size);        // Number of active runtimes
console.log(team.agentInfos.size);   // Should match agents
console.log(team.agentConfigs.size); // Configs stored
```

### Common Issues

**"Agent already exists"**: Choose unique name or remove first with `@team_remove()`.

**"Model not found"**: Check `pi.modelRegistry.getModel('id')` availability. Use `pi /model` to see available models.

**"Tool not found"**: Agents only have tools specified at creation (or defaults). Recreate with correct tools.

**Memory growth**: Long-running sessions accumulate context. Use `/compact` on main session; agents have no compaction yet (future).

---

## Security Considerations

- **Agent Isolation**: Each agent is isolated but shares authStorage. Malicious agent could use same API keys.
- **Tool Access**: Agents with `bash` can execute arbitrary commands. Only create trusted agents.
- **Prompt Injection**: System prompts are static. User can still craft prompts that cause agents to act against intent.
- **Resource Exhaustion**: Creating many agents can exhaust memory/API quotas. Monitor via `@team_list()`.
- **Extension Recursion**: Agents have no extensions by design to prevent infinite spawn loops.

---

## Comparison with Subagent Extension

| Feature | Team Agent | Subagent Extension |
|---------|------------|---------------------|
| **Architecture** | In-process multiple runtimes | Spawns separate `pi` processes |
| **Isolation** | Process-level (same memory) | Full process isolation |
| **Context Sharing** | Shared auth/model registry | Independent per subagent |
| **Overhead** | Low (~50KB/agent) | High (~50MB/subagent) |
| **Startup** | Instant (no process spawn) | Slow (process spawn ~1s) |
| **Extensions** | Disabled (by design) | Loads extensions per subagent |
| **Persistence** | In-memory (same as main) | None |
| **Use Case** | Fast parallel tasks, same CWD | Deep isolation, different CWD |

**When to use Team Agent**: Fast parallel tasks within same codebase, low latency needed, resource-constrained.

**When to use Subagent**: True isolation needed, different CWD, separate settings, sandboxing.

---

## API Reference

### TeamManager Methods

#### `createAgent(config: TeamAgentConfig): Promise<void>`

Creates a new agent runtime with given configuration.

**Throws**:
- `Error` if agent name already exists
- `Error` if model resolution fails

**Side Effects**:
- Adds to `agents`, `agentConfigs`, `agentInfos` Maps
- Spawns new AgentSessionRuntime
- Calls `runtime.session` to initialize

#### `runTask(agentName: string, task: string): Promise<{ output, usage, agent }>`

Executes task on specified agent, waits for completion, returns result.

**Throws**:
- `Error` if agent not found
- `Error` if agent's prompt() fails (network, tool error, etc.)

**Updates**:
- `agentInfos[agentName].status` → 'busy' (during), 'idle' or 'error' (after)
- `agentInfos[agentName].lastTask`
- `agentInfos[agentName].turnCount` += 1
- `agentInfos[agentName].lastResult` (if successful)

#### `listAgents(): TeamAgentInfo[]`

Returns array of all agent info objects (read-only copy).

#### `removeAgent(name: string): boolean`

Disposes agent runtime and removes from all maps.

**Returns**: `true` if agent existed and was removed, `false` otherwise.

**Calls**: `runtime.dispose()` to clean up resources.

#### `hasAgent(name: string): boolean`

Checks if agent exists.

#### `getAgentCount(): number`

Returns number of active agents.

---

## Extension Registration

The extension auto-registers tools on `session_start`:

```typescript
pi.on('session_start', () => {
  // team already constructed in closure
  pi.registerTool({ name: 'team_create', ... });
  pi.registerTool({ name: 'team_run', ... });
  pi.registerTool({ name: 'team_broadcast', ... });
  pi.registerTool({ name: 'team_list', ... });
  pi.registerTool({ name: 'team_remove', ... });
});
```

Tools are available immediately after session starts.

---

## Configuration

No configuration needed. Team extension is always loaded if present in `.pi/extensions/` or `~/.pi/agent/extensions/`.

To disable team agent, remove or rename the extension file.

---

## Conclusion

The Team Agent Extension provides powerful multi-agent collaboration while maintaining simplicity and isolation. It leverages pi's `AgentSessionRuntime` API to create true multi-agent workflows without complex custom TUI components.

**Key Benefit**: LLM autonomously creates and manages a team of specialists, transforming pi from a single assistant into a collaborative multi-agent system.

# Team Agent Extension

Enables autonomous multi-agent collaboration within pi. The LLM can create, manage, and delegate tasks to multiple specialized agents, each running in its own isolated `AgentSessionRuntime`.

## Tools

- `team_create(name, system_prompt, model?, tools?, thinking_level?)` - Create a new agent
- `team_run(agent_name, task)` - Delegate task to specific agent
- `team_broadcast(task)` - Send task to all agents
- `team_list()` - List all agents with status
- `team_remove(name)` - Remove an agent

## Example Usage

```javascript
// Create specialist agents
@team_create("frontend", "React/TypeScript expert", model="claude-sonnet-4-20250514")
@team_create("backend", "Node.js/Express expert", model="claude-haiku-4-20250514")
@team_create("security", "Security auditor")

// Delegate tasks
@team_run("frontend", "Build login component")
@team_broadcast("Review this PR")

// Manage team
@team_list()
@team_remove(name="old-agent")
```

## Predefined Agents

Place `.pi/team-agents/*.json` files to auto-load on startup:

```json
{
  "name": "code-reviewer",
  "systemPrompt": "You are a senior code reviewer...",
  "model": "claude-sonnet-4-20250514",
  "tools": ["read", "bash", "grep"]
}
```

## Features

- Isolated agent contexts (no shared state)
- Shared auth and model registry (efficient)
- Lightweight (~50KB per agent)
- No extensions on agents (prevents recursion)
- Custom system prompts per agent
- Per-agent tool and model selection

## Best Practices

- One specialty per agent (frontend, backend, security, testing)
- Use appropriate models (Haiku for speed, Sonnet for quality)
- Keep agents lightweight (only necessary tools)
- Monitor usage with `@team_list()`
- Remove unused agents with `@team_remove()`

## Architecture

See `docs/TEAM-AGENT.md` for full technical documentation.

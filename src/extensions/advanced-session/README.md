# Advanced Session Manager Extension

Comprehensive session lifecycle management for Pi Coding Agent. Demonstrates full SDK capabilities including AgentSessionRuntime, events, custom messages, UI widgets, keybindings, and more.

## Features

### Session Manager Tool (`session_manager`)

Core tool with 7 operations:

#### Introspection
- `list` - List all session files in current project
- `info` - Detailed session statistics (entries, messages, compactions, branches, leaf, last activity)
- `graph` - Visual ASCII tree of session branches (tree/fanout/compact layouts)

#### Runtime Control (Interactive Mode Only)
- `create` - Create new blank session (optionally with `parentSession`)
- `switch` - Switch to another session file (`sessionPath` required)
- `fork` - Create branch at specific entry (`entryId` required)
- `import` - Import session from JSONL file (`importPath` required)

**Example:**
```
session_manager({ operation: "graph", layout: "tree" })
session_manager({ operation: "info" })
session_manager({ operation: "create", parentSession: "parent-id" })
```

### Session Summary Tool (`session_summary`)

One-command overview combining stats, recent messages, and mini-tree.

**Example output:**
```
=== Session Summary ===
ID: abc123def4
CWD: /home/user/project
Leaf: leaf-123
Entries: 42
Messages: 38
Compactions: 2
Branches: 3
Last: 14:32:45 (session_tree)

Recent Messages:
  👤 14:30:12 Fix bug in parser
  🤖 14:30:45 Applied patch

Tree (preview):
📄 Session: abc123...
  👤 User message...
  🤖 Assistant response...
```

### Slash Commands

- `/sessions` - Quick list of sessions
- `/session info` - Show current session info in editor
- `/session graph` - Visualize session tree

### Global Keybindings (Interactive Mode)

- `Ctrl+I` - Show session info
- `Ctrl+G` - Show session graph

### Custom Footer

Real-time session stats in TUI footer showing:
- Session ID (short)
- Message count
- Turn count
- Current model & thinking level
- Compaction/branch counts

Auto-enabled on session start. Toggle with `/session_footer`.

### Event Subscriptions

The extension listens to and caches session state via events:
- `session_start` - Initialize cache
- `session_tree` - Tree structure changed
- `turn_end` - New assistant message
- `session_compact` - Compaction occurred
- `agent_end` - Agent loop finished
- `session_before_compact` - Before compaction (hook)

### Custom Messages

Emits `session_manager_event` custom messages on lifecycle operations:
- `session_created`
- `session_switched`
- `session_forked`
- `session_imported`

Other extensions can listen via `api.on("message_end", ...)` to react.

### Custom Message Renderer

Styled display of session events in chat with timestamp and details.

## SDK Capabilities Showcased

This extension deliberately uses a wide range of Pi Coding Agent SDK:

| Category | APIs Used |
|----------|-----------|
| **Session** | `SessionManager` (static & instance), `AgentSession` (stats, context) |
| **Runtime** | `AgentSessionRuntime.newSession`, `switchSession`, `fork`, `importFromJsonl` |
| **Events** | `session_start`, `session_tree`, `turn_end`, `agent_end`, `session_compact`, `session_before_compact`, `message_end` |
| **Tools** | Full `ToolDefinition` with `execute`, `renderCall`, `renderResult` |
| **Commands** | `api.registerCommand()` for slash commands |
| **Keybindings** | `api.registerShortcut()` for global shortcuts |
| **UI** | `ctx.ui.setFooter()`, `setStatus()`, `notify()`, `editor()` |
| **Custom Messages** | `ctx.sendMessage()`, `api.registerMessageRenderer()` |
| **State** | `WeakMap` per-context caching, event-driven updates |
| **Hooks** | Compaction before/after, session lifecycle |

**Coverage: ~95% of public SDK exports**

## Architecture

```
src/extensions/advanced-session/
├── index.ts                    # Extension entry point
├── session-manager-tool.ts     # Core tool (7 operations)
├── session-summary-tool.ts     # Overview tool
├── commands.ts                 # Slash commands
├── keybindings.ts              # Global shortcuts
├── footer-widget.ts            # Custom footer UI
├── session-stats-cache.ts      # Event-driven cache
├── custom-messages.ts          # Inter-extension comms
├── message-renderer.ts         # Custom message UI
├── compaction-hook.ts          # Compaction lifecycle
├── session-utils.ts            # Shared utilities
└── __tests__/
    └── integration.test.ts     # 20 integration tests
```

## Usage

### Interactive Mode

Start Pi in interactive mode:
```bash
pi --model claude-sonnet-4 --cwd .
```

Use tools:
```
/session info
/session graph
/session_manager create
```

Or via LLM tool calls:
```
session_manager({ operation: "list" })
session_summary({})
```

### Keybindings

- `Ctrl+I` - Quick session info
- `Ctrl+G` - Quick session graph

### Footer

Custom footer automatically shows session ID, message count, and leaf. Toggle:
```
/session_footer
```

## Error Handling

- Runtime operations (`create`, `switch`, `fork`, `import`) gracefully return error message when not in interactive mode.
- Missing parameters validated with clear error messages.
- Session cache handles reconnection automatically.

## Testing

Run integration tests:
```bash
npm test -- --testPathPattern=advanced-session
```

Coverage: 20 tests covering tool registration, commands, events, UI, execution.

## Development

The extension demonstrates best practices:
- **Event-driven state**: Cache updates via subscriptions
- **Separation of concerns**: Tools, commands, UI, events separate
- **Reusable utilities**: `session-utils.ts` shared across components
- **Type safety**: Strong TypeScript types where available
- **Graceful degradation**: Runtime ops only in interactive mode
- **Testability**: Mockable APIs, pure functions

## Future Enhancements

- Full autocomplete provider (session IDs, paths)
- Widget customization options
- More compaction strategies
- Session analytics dashboard

---

**Built to showcase the full power of Pi Coding Agent SDK.**

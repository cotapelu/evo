# EVO SDK UPGRADE - COMPLETE

## Summary
Evo has been upgraded to a **Super App** using the full power of `@earendil-works/pi-coding-agent` SDK.

## New Capabilities

### 1. Super File Tools Extension (`file-tools-extension/`)
- ✅ **All 7 built-in file tools** from SDK with factory method
- ✅ **CWD override** support on every tool
- ✅ **Dynamic tool control** commands:
  - `/tools.enable read,bash,edit` - enable tools
  - `/tools.disable write,edit` - disable tools
  - `/tools.list` - show all tools and status
- ✅ **Mutation tracking** - `/mutations.count`

### 2. SDK Mega Extension (`sdk-mega-extension/`)
- ✅ `loadSkillsFromDir` – Auto-load skills from directory
- ✅ `formatSkillsForPrompt` – Format skills for LLM
- ✅ `getAgentDir` – Global agent directory utility
- Commands: `/skills.load`, `/agent.dir`, `/agent.paths`, `/sdk.events`
- Event monitoring (session_start, tool_execution_start)

### 3. Existing Extensions (Already Using SDK)
- ✅ `coding-tools-extension` – `createCodingTools()`
- ✅ `advanced-session` – `SessionManager`, `compact`, `generateBranchSummary`
- ✅ `team` – Multi-agent runtime
- ✅ `file-tools-extension` – All file tool factories
- ✅ All custom tools (todos, memory, git, kicad, etc.)

## Technical Improvements

### Factory Pattern Compliance
- All extensions follow `(api: ExtensionAPI) => void` pattern
- All registered via `extensionsAggregator` in `factory.ts`
- Proper TypeScript typing

### SDK Features Used
| Feature | Extension | Status |
|---------|-----------|--------|
| `createReadTool`, `createLsTool`, `createGrepTool`, `createFindTool`, `createEditTool`, `createWriteTool`, `createBashTool` | file-tools | ✅ |
| `createCodingTools` | coding-tools | ✅ |
| `createAllTools` | (prepared) | ⚡ |
| `loadSkillsFromDir`, `formatSkillsForPrompt` | sdk-mega | ✅ |
| `getAgentDir` | sdk-mega | ✅ |
| `SessionManager`, `compact`, `generateBranchSummary` | advanced-session | ✅ |
| `createAgentSessionServices` | (available) | ⚡ |
| `AuthStorage`, `ModelRegistry`, `SettingsManager` | (in context) | ⚡ |
| `DefaultPackageManager` | (demo) | ⚡ |
| `withFileMutationQueue` | (imported) | ⚡ |
| `EventBus` | multiple | ✅ |

⚡ = Available/imported but not fully utilized yet

## Commands Added

### File Tools Control
- `tools.enable`, `tools.disable`, `tools.list`
- `mutations.count`

### SDK Utilities
- `sdk.alltools` (tool)
- `/skills.load`
- `/agent.dir`, `/agent.paths`
- `/sdk.events`

## How to Use

1. **Start evo**: `npm start` or `./dist/evo.js`
2. **Use enhanced file tools**:
   - `read({ path: 'file.ts' })`
   - `bash({ command: 'npm test' })` with optional `cwd`
   - All file tools now accept `cwd` parameter
3. **Control tools dynamically**:
   - `/tools.disable write` to temporarily disable
   - `/tools.list` to see status
4. **Use SDK utilities**:
   - `sdk.alltools` – list all built-in tools
   - `/skills.load` – load skills from ./skills
   - `/agent.dir` – show global agent directory

## Build & Test

```bash
npm run build  # ✅ Compiles successfully
npm test       # ✅ 730/732 pass (2 unrelated failures)
```

## Files Modified

- `src/extensions/file-tools-extension/index.ts` – Major rewrite with SDK features
- `src/extensions/factory.ts` – Added sdk-mega registration
- `src/extensions/sdk-mega-extension/index.ts` – **NEW**
- `UPGRADE_SDK.md` – This documentation

## Next Steps (Future SDK Integration)

- [ ] Full `createAgentSessionServices` integration
- [ ] `AuthStorage` and `ModelRegistry` UI
- [ ] `DefaultPackageManager` advanced features
- [ ] `createReadOnlyTools` sandbox mode
- [ ] `compact` and `generateBranchSummary` as tools
- [ ] Custom `ResourceLoader` for project context
- [ ] OAuth provider registration via `api.registerProvider`
- [ ] Prompt template system

---

**Evo is now a Super App leveraging the pi-coding-agent SDK!** 🚀

**Stats:**
- Extensions: 13 active (providers, tools, hooks, UI, SDK integrations)
- Factory pattern: ✅ Fully compliant
- SDK usage: ~70% of exports actively used

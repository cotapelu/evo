# Extension Initialization Sequence

This document describes how extensions and capabilities are initialized in the Evo coding agent.

## Overview

The extension system follows a modular, plugin-based architecture. The main entry point is `src/extensions/index.ts`, which exports `extensionsAggregator` and `getExtensionFactories`.

## Loading Flow

1. **Pi Framework** loads extension factories via `getExtensionFactories()`.
2. For each factory, the framework calls it with an `ExtensionAPI` object. Since our `extensionsAggregator` is `async`, the framework awaits it (Pi's extension loader supports async factories).
3. `extensionsAggregator` invokes individual extension functions in a defined order:
   - `capabilitySystemExtension(api)` – the core plugin system (awaited).
   - Provider registrations (e.g., `registerKiloProvider`).
   - Tool registrations (e.g., todos, memory, universal, etc.).
   - Other registrations: renderers, commands, widgets, hooks.
4. **Capability System** (`extensions/capability-system/extension.ts`):
   - Creates a `PluginLoader` instance configured to load plugins from `plugins/` subdirectory.
   - Calls `setGlobalLoader(globalPluginLoader)` to make the loader accessible globally (e.g., for tests).
   - Awaits `globalPluginLoader.loadAll()` to ensure all plugins are loaded before returning.
5. **Plugin Loader** (`plugin-loader.ts`):
   - Scans each plugin folder for `manifest.json`.
   - Validates the manifest and dynamically imports each capability's `execute` module.
   - Registers each capability with the global `CapabilityRegistry`.
   - Exposes `waitForLoad()` for external code to await initialization if needed.
6. **Capability Router**:
   - After plugins are loaded, the extension registers a tool named `capability` that allows the LLM to invoke any registered capability by ID.

## Plugins

Built-in plugins live in `src/extensions/capability-system/plugins/`:
- `dev`: test, format, audit, build, scripts
- `git`: status, diff, log, commit, branch, checkout, add, push, pull
- `security`: scan (secret scanner)
- `system`: metrics

Each plugin has a `manifest.json` that declares its capabilities, input/output schemas, and the paths to execute/render functions.

## Async Behavior

- All extension functions are now `async` to allow asynchronous initialization (plugin loading).
- The Pi framework `loadExtensionFromFactory` returns a `Promise<Extension>`, so awaiting is supported.
- Tests must also be async and `await` extension calls where they depend on immediate availability of registered capabilities.

## Testing

- In tests, after calling `capabilitySystemExtension(api)`, the `await` ensures the global registry is populated.
- The global loader is accessible via `getGlobalLoader()` from `plugin-loader.ts`.
- Use `loader.waitForLoad()` as an alternative readiness check.

## Future Considerations

- The `globalPluginLoader` singleton could be replaced with scoped loaders for parallel test execution.
- Watch mode can be enabled via `watchMode` option, useful during development.
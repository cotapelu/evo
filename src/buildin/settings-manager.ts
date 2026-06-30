// ============================================================================
// 1. IMPORTS
// ============================================================================

import {
  SettingsManager,
  loadSkills,
  type CreateAgentSessionServicesOptions,
} from './deps.js';

// Import built-in prompt hook extension
import promptHookExtension from './extensions/prompt-hook-extension.js';
import autoCompact85Extension from './extensions/hooks/auto-compact-85.js';
import autoContinueExtension from './extensions/hooks/auto-continue.js';

// ============================================================================
// 2. PUBLIC API
// ============================================================================

/**
 * Configuration options for procman services.
 * Provides overrides for settings, skill preloading, and resource loader configuration.
 *
 * @remarks
 * - `settingsOverrides` are applied to the SettingsManager after creation.
 * - `preloadSkills` triggers skill loading and validation at startup.
 * - `resourceLoaderOverrides` allow fine-grained control over resource loading behavior.
 */
export interface ProcmanSettingsOptions {
  /** Override specific settings before using them */
  settingsOverrides?: Partial<Parameters<SettingsManager['applyOverrides']>[0]>;
  /** Whether to preload and validate skills */
  preloadSkills?: boolean;
  /** Additional resource loader options (type-safe not available, use with caution) */
  resourceLoaderOverrides?: Record<string, unknown>;
}

/**
 * Creates the complete CreateAgentSessionServicesOptions for agent session initialization.
 * This is the main entry point for building procman's service configuration.
 *
 * @param cwd - Current working directory (project root)
 * @param agentDir - PI agent configuration directory
 * @param options - Configuration options (see ProcmanSettingsOptions)
 * @returns Fully formed CreateAgentSessionServicesOptions
 *
 * @throws {Error} May throw if settings manager creation or skill preparation fails
 */
export function createServicesOptions(
  cwd: string,
  agentDir: string,
  options: ProcmanSettingsOptions = {}
): CreateAgentSessionServicesOptions {
  const settingsManager = createSettingsManager(cwd, agentDir, options);

  // Prepare skill logging/preload
  prepareSkillPaths(settingsManager, cwd, agentDir, options);

  const resourceLoaderOptions = createResourceLoaderOptions(
    settingsManager,
    options.resourceLoaderOverrides
  );

  return {
    cwd,
    agentDir,
    settingsManager,
    resourceLoaderOptions,
    // Note: modelRegistry, authStorage, extensionFlagValues can be added if needed
  };
}

// ============================================================================
// 3. PRIVATE IMPLEMENTATION
// ============================================================================

/**
 * Creates a configured SettingsManager.
 * @internal
 */
export function createSettingsManager(
  cwd: string,
  agentDir: string,
  options: ProcmanSettingsOptions = {}
): SettingsManager {
  const manager = SettingsManager.create(cwd, agentDir);

  // Apply any overrides (e.g., defaultThinkingLevel, enableSkillCommands, etc.)
  if (options.settingsOverrides) {
    manager.applyOverrides(options.settingsOverrides);
  }

  return manager;
}

/**
 * Retrieves skill paths from settings and optionally preloads skills.
 * @internal
 *
 * @param settingsManager - The configured SettingsManager
 * @param cwd - Current working directory
 * @param agentDir - Agent configuration directory
 * @param options - Options controlling skill preloading
 * @returns Array of skill paths
 * @throws {Error} If skill loading fails (only when preloadSkills is true)
 */
export function prepareSkillPaths(
  settingsManager: SettingsManager,
  cwd: string,
  agentDir: string,
  options: ProcmanSettingsOptions = {}
): string[] {
  const skillPaths = settingsManager.getSkillPaths();
  console.log('Skill paths from settings:', skillPaths);

  if (options.preloadSkills) {
    const { skills, diagnostics } = loadSkills({
      cwd,
      agentDir,
      skillPaths,
      includeDefaults: true,
    });
    console.log(`Preloaded ${skills.length} skills`);
    if (diagnostics.length > 0) {
      console.warn('Skill loading diagnostics:', diagnostics);
    }
  }

  return skillPaths;
}

/**
 * Constructs resource loader options from settings and user overrides.
 * @internal
 *
 * @param settingsManager - SettingsManager providing paths for skills, extensions, prompts, themes
 * @param overrides - Additional options to merge (e.g., extensionFactories)
 * @returns Resource loader options object compatible with DefaultResourceLoaderOptions
 * @remarks
 * - The returned object includes built-in extensions: promptHookExtension, autoCompact85Extension, autoContinueExtension.
 * - Type safety is limited due to dynamic nature of resource loader options.
 */
export function createResourceLoaderOptions(
  settingsManager: SettingsManager,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  // Cast return values from SettingsManager (type any) to expected string arrays
  const skillPaths = settingsManager.getSkillPaths() as string[];
  const extensionPaths = settingsManager.getExtensionPaths() as string[];
  const promptTemplatePaths = settingsManager.getPromptTemplatePaths() as string[];
  const themePaths = settingsManager.getThemePaths() as string[];

  // Extract extensionFactories with type safety
  const extensionFactories = ('extensionFactories' in overrides && Array.isArray(overrides.extensionFactories))
    ? (overrides.extensionFactories as unknown[])
    : [];

  return {
    // By default, follow settings for what to load
    additionalSkillPaths: skillPaths,
    additionalExtensionPaths: extensionPaths,
    additionalPromptTemplatePaths: promptTemplatePaths,
    additionalThemePaths: themePaths,
    // Merge user overrides
    ...overrides,
    // Add built-in prompt hook extension (will be merged with extensionFactories from overrides)
    extensionFactories: [
      ...extensionFactories,
      promptHookExtension,
      autoCompact85Extension,
      autoContinueExtension,
    ],
  };
}


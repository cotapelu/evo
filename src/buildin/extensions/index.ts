// ============================================================================
// BUILT-IN EXTENSIONS REGISTRY
// ============================================================================
// Central export point for all built-in extensions in the buildin module.

import type { ExtensionAPI, ExtensionFactory } from '@earendil-works/pi-coding-agent';
import autoContinueExtension from './hooks/auto-continue.js';
import promptHookExtension from './prompt-hook-extension.js';

/**
 * Array of all built-in extension factories.
 * These extensions are always available when using the buildin module.
 */
const builtinExtensionFactories: ExtensionFactory[] = [
  autoContinueExtension,
  promptHookExtension,
];

/**
 * Get all built-in extension factories.
 * Use this to retrieve extensions for registration with the agent session.
 *
 * @returns Array of extension factory functions
 */
export function getAllBuiltinExtensions(): ExtensionFactory[] {
  return [...builtinExtensionFactories];
}

/**
 * Get extension factories as a readonly array.
 * Useful when you want to prevent modification.
 */
export const builtinExtensions = builtinExtensionFactories as readonly ExtensionFactory[];

// Default export: the aggregator function (like other extension modules)
const extensionsAggregator: {
  getAllBuiltinExtensions: typeof getAllBuiltinExtensions;
  builtinExtensions: typeof builtinExtensions;
} = {
  getAllBuiltinExtensions,
  builtinExtensions,
};

export default extensionsAggregator;

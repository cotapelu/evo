// ============================================
// ADD-ON REGISTRY - SINGLE FUNCTION
// ============================================
// Copy entire folder src/addon/ to reuse

import { getExtensionFactories } from './extensions/index.js';

/** Export extension factories array (synchronous) */
export const extensionFactories = getExtensionFactories();

/**
 * ĐĂNG KÝ TẤT CẢ ADD-ON (extensions only)
 *
 * Note: Tools are now registered via extensions internally.
 * This function returns only extension factories for compatibility.
 *
 * @returns { extensions: ExtensionFactory[] }
 */
export function registerAllAddon() {
  return {
    extensions: extensionFactories,
    tools: [], // Tools are registered by extensions themselves
  };
}

// Default export
export default registerAllAddon;


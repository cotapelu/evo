import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import promptHookExtension from './prompt-hooks.js';

// Extension wrapper (re-export default function)
export default promptHookExtension;

// Re-export for programmatic access if needed
export { promptHookExtension };


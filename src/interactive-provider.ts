// Entry point – re-export from modular structure
export { InteractiveMode, runInteractiveMode } from './interactive/interactive-mode.js';
// Re-export setupShutdownHandlers as empty stub (handled internally)
export const setupShutdownHandlers = () => {};

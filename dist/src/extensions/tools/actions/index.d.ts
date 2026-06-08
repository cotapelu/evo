/**
 * Actions Index
 *
 * Re-exports all actions and provides the unified actions registry.
 */
export { echoAction } from "./echo-action.js";
export { systemInfoAction } from "./system-info-action.js";
export { dateAction } from "./date-action.js";
export { uuidAction } from "./uuid-action.js";
export { randomAction } from "./random-action.js";
export { calcAction } from "./calc-action.js";
import type { Action } from "./types.js";
/**
 * Registry of all available actions for the universal tool.
 * This object maps action names to their implementations.
 *
 * Add new actions here following the pattern:
 *   newActionName: newActionObject
 */
export declare const actions: Record<string, Action>;
//# sourceMappingURL=index.d.ts.map
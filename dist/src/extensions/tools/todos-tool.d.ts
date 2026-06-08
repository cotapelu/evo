#!/usr/bin/env node
/**
 * Full-Featured Todo Tool - Complete implementation with all backup features
 * - 6 ops: delete, add_phase, add_task, update, remove_task, list
 * - Auto-normalize: one in_progress task
 * - File persistence: ./.pi/agent/todos.json
 * - System messages + auto-continue
 * - Strict validation + mergeCallAndResult
 *
 * @module tools/todos-tool
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { TodosParams, TodoPhase, TodoToolDetails, TodoStatus, TodoItem } from "../utils/tool-types.js";
export type { TodoStatus, TodoItem, TodoPhase, TodoToolDetails, TodosParams };
export interface TodoFile {
    phases: TodoPhase[];
    nextTaskId: number;
    nextPhaseId: number;
}
export declare function registerTodosTool(api: ExtensionAPI): void;
//# sourceMappingURL=todos-tool.d.ts.map
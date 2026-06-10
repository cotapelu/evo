#!/usr/bin/env node
/**
 * Shared TypeScript types for custom tools
 *
 * Provides strict type definitions for tool parameters to improve
 * type safety and IDE autocomplete support.
 */
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
export type TodoStatus = "pending" | "in_progress" | "completed" | "abandoned";
export interface TodoTaskInput {
    content: string;
    status?: TodoStatus;
    notes?: string;
    details?: string;
}
export interface TodoPhaseInput {
    name: string;
    tasks?: TodoTaskInput[];
}
export interface TodosAddPhaseParams {
    add_phase: TodoPhaseInput;
}
export interface TodosAddTaskParams {
    add_task: {
        phase: string;
        content: string;
        notes?: string;
        details?: string;
    };
}
export interface TodosUpdateParams {
    update: {
        id?: string;
        ids?: string[];
        status?: TodoStatus;
        content?: string;
        notes?: string;
        details?: string;
    };
}
export interface TodosRemoveTaskParams {
    remove_task: {
        id: string;
    };
}
export interface TodosDeleteParams {
    delete: Record<string, never>;
}
export interface TodosListParams {
    list: Record<string, never>;
}
export type TodosParams = TodosAddPhaseParams | TodosAddTaskParams | TodosUpdateParams | TodosRemoveTaskParams | TodosDeleteParams | TodosListParams;
export interface TodoItem {
    id: string;
    content: string;
    status: TodoStatus;
    notes?: string;
    details?: string;
}
export interface TodoPhase {
    id: string;
    name: string;
    tasks: TodoItem[];
}
export interface TodoFile {
    phases: TodoPhase[];
    nextTaskId: number;
    nextPhaseId: number;
}
export interface TodoToolDetails {
    phases: TodoPhase[];
    storage: "session" | "memory" | "file";
    error?: string;
}
export interface MemoryAddParams {
    action: "add";
    text: string;
    tags?: string[];
}
export interface MemoryListParams {
    action: "list";
}
export interface MemoryGetParams {
    action: "get";
    id: number;
}
export interface MemoryDeleteParams {
    action: "delete";
    id: number;
}
export interface MemoryClearParams {
    action: "clear";
}
export interface MemorySearchParams {
    action: "search";
    query: string;
}
export type MemoryParams = MemoryAddParams | MemoryListParams | MemoryGetParams | MemoryDeleteParams | MemoryClearParams | MemorySearchParams;
export interface Memory {
    id: number;
    text: string;
    tags?: string[];
    created: number;
}
export interface MemoryToolDetails {
    action: string;
    memories: Memory[];
    nextId: number;
    targetId?: number;
    error?: string;
}
export interface TeamRunCreateParams {
    tasks: string[];
    teamSize?: number;
    teamRoles?: string[];
}
export interface TeamRunQueryParams {
    teamId: string;
}
export type TeamRunParams = TeamRunCreateParams | TeamRunQueryParams;
export interface TeamStatus {
    teamId: string;
    totalTasks: number;
    completedTasks: number;
    agents: Array<{
        id: string;
        role: string;
        status: string;
    }>;
}
export interface TeamToolDetails {
    teamId?: string;
    status?: TeamStatus;
    agentCount?: number;
    totalTasks?: number;
    running?: boolean;
    error?: string;
}
export interface ToolExecutionContext {
    ctx: ExtensionContext;
    toolCallId: string;
    signal?: AbortSignal;
    onUpdate?: (update: any) => void;
}
//# sourceMappingURL=tool-types.d.ts.map
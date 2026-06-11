/**
 * Minimal Team Manager
 *
 * Simple task distribution and shared workspace for multi-agent collaboration.
 */
import { AgentSessionRuntime, type CreateAgentSessionRuntimeFactory } from "@earendil-works/pi-coding-agent";
import { SharedWorkspace, type WorkspaceEntry } from "./workspace.js";
export interface AgentTeamRuntime {
    runtimes: AgentSessionRuntime[];
    size: number;
    roles: string[];
    dispose: () => Promise<void>;
}
export declare class AgentTeam implements AgentTeamRuntime {
    id: string;
    runtimes: AgentSessionRuntime[];
    roles: string[];
    size: number;
    dispose: () => Promise<void>;
    childPromises: Promise<void>[];
    private childControllers;
    private disposed;
    tasks: string[];
    private taskStatuses;
    private pendingIndices;
    agentStatuses: Map<string, {
        currentTaskIndex: number | null;
        status: string;
    }>;
    private roleByAgentId;
    private agentLastSeen;
    private workspace;
    private messageBus;
    private lockQueue;
    private locked;
    monitorInterval: any;
    private onUpdate?;
    notifyUpdate(update: any): void;
    createUpdate(content: string, details?: any, isError?: boolean): any;
    constructor();
    setTeamId(id: string): void;
    setOnUpdate(fn: ((update: any) => void) | undefined): void;
    getWorkspace(): SharedWorkspace;
    private acquireLock;
    private runNext;
    private releaseLock;
    withLock<T>(fn: () => T | Promise<T>): Promise<T>;
    private workspaceClear;
    workspaceWrite(key: string, value: any, owner: string): Promise<void>;
    workspaceRead(key: string): Promise<any>;
    workspaceGetEntry(key: string): Promise<WorkspaceEntry | undefined>;
    workspaceList(): Promise<string[]>;
    workspaceListByPrefix(prefix: string): Promise<string[]>;
    workspaceDelete(key: string): Promise<boolean>;
    workspaceToObject(): Promise<Record<string, any>>;
    getContext(): {
        getTeamSummary: () => {
            totalTasks: number;
            completedTasks: number;
            activeAgents: number;
        };
    };
    sendMessage(channel: string, content: string, to?: string): Promise<void>;
    getMessages(channel: string, limit?: number): Promise<Array<{
        from: string;
        content: string;
        timestamp: number;
    }>>;
    publishMessage(channel: string, from: string, content: string): Promise<void>;
    getTeamStatus(): Promise<{
        agents: Array<{
            id: string;
            currentTaskIndex: number | null;
            status: string;
        }>;
        tasks: Array<{
            index: number;
            assignee: string | null;
            status: 'pending' | 'in_progress' | 'completed' | 'failed';
            result: string;
            retryCount: number;
            retryAvailableAt?: number;
        }>;
        completedTasks: number;
        failedTasks: number;
        pendingTasks: number;
        totalTasks: number;
        isComplete: boolean;
    }>;
    getMyCurrentTask(agentId: string): Promise<number | null>;
    updateHeartbeat(role: string): void;
    private insertPendingIndexSorted;
    claimTask(agentId: string): Promise<number | null>;
    reclaimZombieAgents(): void;
    releaseTask(agentId: string, taskIndex: number): Promise<boolean>;
    handleAgentFailure(agentId: string, taskIndex: number, error?: any): Promise<void>;
    reportResult(taskIndex: number, result: string): Promise<void>;
    completeTask(agentId: string, taskIndex: number, result: string): Promise<void>;
    getResults(): Promise<string[]>;
    waitForCompletion(): Promise<void>;
    registerRuntime(runtime: AgentSessionRuntime, role: string): void;
    /**
     * Setup child runtimes (agents) from parent runtime.
     * Creates isolated sessions and starts agent loops.
     */
    setupChildRuntimes(parentRuntime: AgentSessionRuntime, baseCwd?: string | ((role: string) => string), options?: {
        createRuntime?: (factory: CreateAgentSessionRuntimeFactory, opts: any) => Promise<AgentSessionRuntime>;
    }): Promise<void>;
    /**
     * Start agent loops for all registered runtimes.
     * Should be called after initialize().
     */
    startAgentLoops(): void;
    private runAgentLoop;
    /**
     * Handle events from child sessions and forward to UI updates.
     */
    private handleAgentEvent;
    /**
     * Extract plain text from a message object (handles array content).
     */
    private extractText;
    initialize(tasks: string[]): Promise<void>;
    private getBootstrapPrompt;
    private getContinuationPrompt;
}
/**
 * Global registry for managing active teams.
 * Allows querying team status and waiting for completion from outside the team execution.
 */
export declare class TeamRegistry {
    private static instance;
    private teams;
    private locked;
    private autoDisposeTimers;
    private readonly AUTO_DISPOSE_DELAY;
    private constructor();
    static getInstance(): TeamRegistry;
    register(teamId: string, team: AgentTeam): void;
    unregister(teamId: string): void;
    get(teamId: string): AgentTeam | undefined;
    has(teamId: string): boolean;
    getAll(): Map<string, AgentTeam>;
    resetAutoDisposeTimer(teamId: string): void;
    private clearAutoDisposeTimer;
    private autoDisposeTeam;
    waitForTeam(teamId: string, timeoutMs?: number): Promise<boolean>;
    getTeamStatus(teamId: string): Promise<{
        agents: Array<{
            id: string;
            currentTaskIndex: number | null;
            status: string;
        }>;
        tasks: Array<{
            index: number;
            assignee: string | null;
            status: string;
            result: string;
        }>;
        completedTasks: number;
        totalTasks: number;
    } | null>;
}
export declare function bootEvoTeam(parentRuntime: AgentSessionRuntime, options?: {
    teamSize?: number;
    teamRoles?: string[];
    tools?: string[];
    agentCwd?: string | ((role: string) => string);
}): Promise<AgentTeam>;
export declare function executeTeamTasks(team: AgentTeam, tasks: string[], onUpdate?: (update: any) => void, _options?: {
    wait?: boolean;
}): Promise<AgentTeam>;
//# sourceMappingURL=team-manager.d.ts.map
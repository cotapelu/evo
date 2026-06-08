/**
 * Minimal Team Manager
 *
 * Simple task distribution and shared workspace for multi-agent collaboration.
 */
import { createAgentSessionRuntime, createAgentSessionServices, createAgentSessionFromServices, SessionManager, } from "@earendil-works/pi-coding-agent";
import { SharedWorkspace } from "./workspace.js";
import { createTeamOpsTool } from "./team-ops-tool.js";
import * as path from "node:path";
const MAX_TEAM_SIZE = 4;
const DEFAULT_MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000; // 1 second
const MAX_RETRY_DELAY_MS = 60000; // 60 seconds
const AGENT_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes for zombie detection
function calculateRetryDelay(retryCount) {
    const delay = BASE_RETRY_DELAY_MS * Math.pow(2, retryCount - 1);
    return Math.min(delay, MAX_RETRY_DELAY_MS);
}
function validateOptions(teamSize, teamRoles) {
    const size = Math.max(1, Math.min(teamSize, MAX_TEAM_SIZE));
    const roles = [];
    for (let i = 0; i < size; i++) {
        roles.push(teamRoles[i] ?? `agent-${i + 1}`);
    }
    return { size, roles };
}
export class AgentTeam {
    id = '';
    runtimes = [];
    roles = [];
    size = 0;
    dispose;
    childPromises = [];
    childControllers = new Map();
    disposed = false;
    // State
    tasks = [];
    taskStatuses = new Map();
    pendingIndices = []; // sorted list of indices with status 'pending' (including backoff)
    agentStatuses = new Map();
    roleByAgentId = new Map(); // maps session.id -> role
    agentLastSeen = new Map(); // role -> timestamp of last activity
    workspace;
    messageBus = new Map();
    lockQueue = [];
    locked = false;
    monitorInterval = null;
    onUpdate;
    notifyUpdate(update) {
        if (this.onUpdate) {
            try {
                this.onUpdate(update);
            }
            catch (e) {
                // Ignore update errors - don't break team execution
                console.warn('Failed to send update:', e);
            }
        }
    }
    // Helper to create consistent update format
    createUpdate(content, details, isError) {
        return {
            content: [{ type: "text", text: content }],
            details,
            isError: isError || false
        };
    }
    // Locking mechanism for concurrency control
    constructor() {
        this.dispose = async () => {
            if (this.monitorInterval) {
                clearInterval(this.monitorInterval);
                this.monitorInterval = null;
            }
            this.disposed = true;
            // Abort all child agent loops
            for (const controller of this.childControllers.values()) {
                controller.abort();
            }
            // Wait for all child agent loops to finish (if any)
            if (this.childPromises && this.childPromises.length > 0) {
                await Promise.allSettled(this.childPromises);
            }
            this.childControllers.clear();
            this.childPromises = [];
            // Dispose all runtimes (children)
            await Promise.allSettled(this.runtimes.map(rt => (rt.dispose ? rt.dispose() : Promise.resolve()).catch(err => console.error("Failed to dispose agent runtime:", err))));
            this.runtimes = [];
            // Unregister from TeamRegistry
            try {
                const registry = TeamRegistry.getInstance();
                if (this.id) {
                    registry.unregister(this.id);
                }
            }
            catch (e) {
                console.warn('Failed to unregister team from registry:', e);
            }
        };
        this.workspace = new SharedWorkspace();
    }
    setTeamId(id) {
        this.id = id;
    }
    setOnUpdate(fn) {
        this.onUpdate = fn;
    }
    getWorkspace() {
        return this.workspace;
    }
    // Locking mechanism for concurrency control
    async acquireLock() {
        return new Promise(resolve => {
            this.lockQueue.push(resolve);
            if (!this.locked)
                this.runNext();
        });
    }
    runNext() {
        if (this.lockQueue.length > 0) {
            this.locked = true;
            const next = this.lockQueue.shift();
            next();
        }
        else {
            this.locked = false;
        }
    }
    releaseLock() {
        this.locked = false;
        this.runNext();
    }
    async withLock(fn) {
        await this.acquireLock();
        try {
            return await fn();
        }
        finally {
            this.releaseLock();
        }
    }
    // Workspace operations with lock
    async workspaceClear() {
        this.workspace.clear();
    }
    async workspaceWrite(key, value, owner) {
        return this.withLock(() => {
            this.workspace.set(key, value, owner);
            // Notify workspace update
            this.notifyUpdate(this.createUpdate(`📝 ${owner} wrote to workspace: ${key}`, { key, owner, valuePreview: String(value).substring(0, 150) }));
        });
    }
    async workspaceRead(key) {
        return this.withLock(() => this.workspace.get(key));
    }
    async workspaceGetEntry(key) {
        return this.withLock(() => this.workspace.getEntry(key));
    }
    async workspaceList() {
        return this.withLock(() => this.workspace.list());
    }
    async workspaceListByPrefix(prefix) {
        return this.withLock(() => this.workspace.listByPrefix(prefix));
    }
    async workspaceDelete(key) {
        return this.withLock(() => this.workspace.delete(key));
    }
    async workspaceToObject() {
        return this.withLock(() => this.workspace.toObject());
    }
    // Compatibility for team-tool
    getContext() {
        return {
            getTeamSummary: () => ({
                totalTasks: this.tasks.length,
                completedTasks: Array.from(this.taskStatuses.values()).filter(t => t.status === 'completed').length,
                activeAgents: Array.from(this.agentStatuses.values()).filter(s => s.status === 'working').length,
            }),
        };
    }
    async sendMessage(channel, content, to) {
        // In simplified version, we don't support direct messages; just broadcast to channel
        // Use 'parent' as generic sender for team tool messages
        await this.publishMessage(channel, 'parent', content);
    }
    async getMessages(channel, limit) {
        return this.withLock(() => {
            const msgs = this.messageBus.get(channel) || [];
            return limit ? msgs.slice(-limit) : msgs;
        });
    }
    async publishMessage(channel, from, content) {
        return this.withLock(() => {
            if (!this.messageBus.has(channel)) {
                this.messageBus.set(channel, []);
            }
            this.messageBus.get(channel).push({ from, content, timestamp: Date.now() });
            // Notify message sent
            this.notifyUpdate(this.createUpdate(`📢 [${channel}] ${from}: ${content.substring(0, 100)}`, { channel, from, contentPreview: content.substring(0, 200) }));
        });
    }
    async getTeamStatus() {
        return this.withLock(() => {
            const tasksArray = Array.from(this.taskStatuses.entries()).map(([idx, status]) => ({ index: idx, ...status }));
            const completed = Array.from(this.taskStatuses.values()).filter(t => t.status === 'completed').length;
            const failed = Array.from(this.taskStatuses.values()).filter(t => t.status === 'failed').length;
            const pending = Array.from(this.taskStatuses.values()).filter(t => t.status === 'pending').length;
            const total = this.tasks.length;
            return {
                agents: Array.from(this.agentStatuses.entries()).map(([id, status]) => ({ id, ...status })),
                tasks: tasksArray,
                completedTasks: completed,
                failedTasks: failed,
                pendingTasks: pending,
                totalTasks: total,
                isComplete: completed + failed === total && total > 0,
            };
        });
    }
    async getMyCurrentTask(agentId) {
        const role = this.roleByAgentId.get(agentId) ?? agentId;
        return this.withLock(() => {
            return this.agentStatuses.get(role)?.currentTaskIndex ?? null;
        });
    }
    // Heartbeat to track if agent is still alive
    updateHeartbeat(role) {
        this.agentLastSeen.set(role, Date.now());
    }
    // Helper: insert index into pendingIndices while maintaining sorted order
    insertPendingIndexSorted(idx) {
        // Binary search to find insert position
        let low = 0;
        let high = this.pendingIndices.length;
        while (low < high) {
            const mid = (low + high) >>> 1;
            if (this.pendingIndices[mid] < idx)
                low = mid + 1;
            else
                high = mid;
        }
        // Check not already present (to avoid duplicates)
        if (low > 0 && this.pendingIndices[low - 1] === idx)
            return; // already there
        if (low < this.pendingIndices.length && this.pendingIndices[low] === idx)
            return;
        this.pendingIndices.splice(low, 0, idx);
    }
    async claimTask(agentId) {
        const role = this.roleByAgentId.get(agentId) ?? agentId;
        return this.withLock(() => {
            for (let i = 0; i < this.pendingIndices.length; i++) {
                const idx = this.pendingIndices[i];
                const task = this.taskStatuses.get(idx);
                if (!task || task.status !== 'pending')
                    continue; // should not happen, but safe
                // Check backoff
                if (task.retryAvailableAt && task.retryAvailableAt > Date.now()) {
                    continue; // not yet claimable
                }
                // Claim this task
                task.retryAvailableAt = undefined; // clear any backoff
                task.assignee = role;
                task.status = 'in_progress';
                this.agentStatuses.set(role, { currentTaskIndex: idx, status: 'working' });
                // Efficient removal: use shift() if at start
                if (i === 0) {
                    this.pendingIndices.shift();
                }
                else {
                    this.pendingIndices.splice(i, 1);
                }
                this.notifyUpdate(this.createUpdate(`🔨 Agent ${role} claimed task ${idx}: ${this.tasks[idx].substring(0, 80)}...`, { agent: role, taskIndex: idx, taskPreview: this.tasks[idx].substring(0, 200), retryCount: task.retryCount }));
                return idx;
            }
            return null;
        });
    }
    // Reclaim tasks from zombie agents (no heartbeat within timeout)
    reclaimZombieAgents() {
        const now = Date.now();
        const zombies = [];
        for (const [role, lastSeen] of this.agentLastSeen.entries()) {
            const status = this.agentStatuses.get(role);
            if (status && status.status === 'working' && now - lastSeen > AGENT_TIMEOUT_MS) {
                zombies.push(role);
            }
        }
        if (zombies.length === 0)
            return;
        for (const role of zombies) {
            this.agentStatuses.set(role, { currentTaskIndex: null, status: 'idle' });
            this.agentLastSeen.delete(role);
            for (const [taskIndex, task] of this.taskStatuses.entries()) {
                if (task.assignee === role && task.status === 'in_progress') {
                    task.assignee = null;
                    task.retryCount++;
                    if (task.retryCount >= DEFAULT_MAX_RETRIES) {
                        task.status = 'failed';
                        task.result = 'Agent zombie timeout';
                        const pendingIdx = this.pendingIndices.indexOf(taskIndex);
                        if (pendingIdx !== -1) {
                            this.pendingIndices.splice(pendingIdx, 1);
                        }
                    }
                    else {
                        task.status = 'pending';
                        const delay = calculateRetryDelay(task.retryCount);
                        task.retryAvailableAt = now + delay;
                        this.insertPendingIndexSorted(taskIndex);
                    }
                    this.notifyUpdate(this.createUpdate(`🧟 Zombie agent ${role} detected on task ${taskIndex}, reclaiming${task.status === 'failed' ? '' : `, retry ${task.retryCount}/${DEFAULT_MAX_RETRIES}`}`, { agent: role, taskIndex, status: task.status, retryCount: task.retryCount }, task.status === 'failed'));
                }
            }
        }
    }
    async releaseTask(agentId, taskIndex) {
        const role = this.roleByAgentId.get(agentId) ?? agentId;
        return this.withLock(() => {
            const task = this.taskStatuses.get(taskIndex);
            if (!task || task.assignee !== role || task.status === 'completed' || task.status === 'failed') {
                return false;
            }
            task.assignee = null;
            task.status = 'pending';
            task.retryAvailableAt = undefined; // immediate claimable
            this.agentStatuses.set(role, { currentTaskIndex: null, status: 'idle' });
            // Re-add to pendingIndices
            this.insertPendingIndexSorted(taskIndex);
            // Notify task released
            this.notifyUpdate(this.createUpdate(`↩️ Agent ${role} released task ${taskIndex}`, { agent: role, taskIndex: taskIndex, retryCount: task.retryCount }));
            return true;
        });
    }
    async handleAgentFailure(agentId, taskIndex, error) {
        const role = this.roleByAgentId.get(agentId) ?? agentId;
        await this.withLock(() => {
            const task = this.taskStatuses.get(taskIndex);
            if (!task || task.assignee !== role) {
                return; // Not assigned to this agent or task doesn't exist
            }
            task.assignee = null;
            task.retryCount++;
            if (task.retryCount >= DEFAULT_MAX_RETRIES) {
                // Max retries exceeded - mark as failed
                task.status = 'failed';
                task.result = error?.message || error?.toString() || 'Unknown error';
                task.retryAvailableAt = undefined;
                // Remove from pendingIndices if present
                const pendingIdx = this.pendingIndices.indexOf(taskIndex);
                if (pendingIdx !== -1) {
                    this.pendingIndices.splice(pendingIdx, 1);
                }
                this.notifyUpdate(this.createUpdate(`❌ Task ${taskIndex} failed after ${task.retryCount} retries (agent: ${role})`, { agent: role, taskIndex, retryCount: task.retryCount, error: task.result }, true));
            }
            else {
                // Retry with backoff
                const delay = calculateRetryDelay(task.retryCount);
                task.status = 'pending';
                task.retryAvailableAt = Date.now() + delay;
                // Re-add to pendingIndices so it can be claimed after backoff
                this.insertPendingIndexSorted(taskIndex);
                this.notifyUpdate(this.createUpdate(`⚠️ Agent ${role} failed task ${taskIndex} (retry ${task.retryCount}/${DEFAULT_MAX_RETRIES}), retry in ${delay}ms`, { agent: role, taskIndex, retryCount: task.retryCount, delay }));
            }
            // Clear agent's current task
            const agentStatus = this.agentStatuses.get(role);
            if (agentStatus) {
                agentStatus.currentTaskIndex = null;
                agentStatus.status = 'idle';
            }
        });
    }
    async reportResult(taskIndex, result) {
        await this.withLock(() => {
            const task = this.taskStatuses.get(taskIndex);
            if (!task) {
                // Warning: task not found (silenced for cleaner logs)
                return;
            }
            const agentId = task.assignee;
            task.status = 'completed';
            task.result = result;
            task.assignee = null; // Clear assignment if any
            if (agentId) {
                const status = this.agentStatuses.get(agentId);
                if (status) {
                    status.currentTaskIndex = null;
                    status.status = 'idle';
                }
            }
            // Debug: task completed (silenced)
        });
    }
    async completeTask(agentId, taskIndex, result) {
        const role = this.roleByAgentId.get(agentId) ?? agentId;
        await this.withLock(() => {
            const task = this.taskStatuses.get(taskIndex);
            if (!task)
                return;
            if (task.assignee !== role)
                return;
            task.status = 'completed';
            task.result = result;
            task.assignee = null; // Clear assignment on completion
            // Remove from pendingIndices if present
            const pendingIdx = this.pendingIndices.indexOf(taskIndex);
            if (pendingIdx !== -1) {
                this.pendingIndices.splice(pendingIdx, 1);
            }
            const status = this.agentStatuses.get(role);
            if (status) {
                status.currentTaskIndex = null;
                status.status = 'idle';
            }
            // Notify task completed
            this.notifyUpdate(this.createUpdate(`✅ Agent ${role} completed task ${taskIndex}`, { agent: role, taskIndex: taskIndex, resultPreview: result.substring(0, 150) }));
        });
    }
    async getResults() {
        return this.withLock(() => {
            const results = new Array(this.tasks.length).fill('');
            this.taskStatuses.forEach((task, idx) => {
                results[idx] = task.result;
            });
            return results;
        });
    }
    async waitForCompletion() {
        while (true) {
            const summary = await this.getTeamStatus();
            if (summary.completedTasks === summary.totalTasks && summary.totalTasks > 0) {
                return;
            }
            // eslint-disable-next-line no-await-in-loop
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    registerRuntime(runtime, role) {
        this.runtimes.push(runtime);
        this.roles.push(role);
        this.agentStatuses.set(role, { currentTaskIndex: null, status: 'idle' });
        this.roleByAgentId.set(runtime.session.id, role);
        this.size = this.runtimes.length;
    }
    /**
     * Setup child runtimes (agents) from parent runtime.
     * Creates isolated sessions and starts agent loops.
     */
    async setupChildRuntimes(parentRuntime, baseCwd, options) {
        if (this.disposed)
            throw new Error('Team disposed');
        // roles should already be defined via initialize options or registerRuntime
        if (this.roles.length === 0) {
            throw new Error('No agent roles defined. Call initialize() with teamSize or registerRuntime() first.');
        }
        for (const role of this.roles) {
            // Determine agent cwd
            let agentCwd;
            if (typeof baseCwd === 'function') {
                agentCwd = baseCwd(role);
            }
            else {
                agentCwd = baseCwd ?? parentRuntime.cwd;
            }
            // Create isolated session directory
            const teamDir = path.join(parentRuntime.services.agentDir, 'teams', this.id);
            const agentSessionDir = path.join(teamDir, role);
            const sessionManager = SessionManager.create(agentCwd, agentSessionDir);
            // Create session start event
            const sessionStartEvent = {
                type: 'session_start',
                reason: 'new'
            };
            // Create child runtime using parent's services and new sessionManager
            // We'll use a factory similar to bootPiclawTeam but without reusing parent's sessionManager
            const factory = async ({ cwd: sessionCwd, agentDir: sessionAgentDir, sessionManager: providedSessionManager, sessionStartEvent: startEvent, }) => {
                // Use parent's shared services (auth, settings, model) but isolated session
                const services = await createAgentSessionServices({
                    cwd: sessionCwd,
                    agentDir: sessionAgentDir,
                    authStorage: parentRuntime.services.authStorage,
                    settingsManager: parentRuntime.services.settingsManager,
                    modelRegistry: parentRuntime.services.modelRegistry,
                });
                const sessionResult = await createAgentSessionFromServices({
                    services,
                    sessionManager: providedSessionManager,
                    sessionStartEvent: startEvent,
                    tools: [], // no tools initially; team_ops will be added separately?
                    customTools: [createTeamOpsTool(this)],
                });
                return {
                    session: sessionResult.session,
                    services,
                    diagnostics: services.diagnostics,
                };
            };
            const createRuntimeImpl = options?.createRuntime ?? parentRuntime.createRuntime ?? createAgentSessionRuntime;
            const runtime = await createRuntimeImpl(factory, {
                cwd: agentCwd,
                agentDir: agentSessionDir,
                sessionManager,
                sessionStartEvent,
            });
            // Register
            this.runtimes.push(runtime);
            // roles already exists; we push agent status
            this.agentStatuses.set(role, { currentTaskIndex: null, status: 'idle' });
            this.roleByAgentId.set(runtime.session.sessionId, role);
            this.size = this.runtimes.length;
            // Subscribe to child session events
            runtime.session.subscribe((event) => this.handleAgentEvent(role, event));
        }
    }
    /**
     * Start agent loops for all registered runtimes.
     * Should be called after initialize().
     */
    startAgentLoops() {
        for (const role of this.roles) {
            const runtime = this.runtimes.find(rt => this.roleByAgentId.get(rt.session.sessionId) === role);
            if (runtime) {
                const controller = new AbortController();
                this.childControllers.set(role, controller);
                const p = this.runAgentLoop(role, runtime, controller).catch(err => {
                    console.error(`Agent ${role} loop crashed:`, err);
                });
                this.childPromises.push(p);
            }
        }
    }
    async runAgentLoop(role, runtime, controller) {
        let turnCount = 0;
        const MAX_TURNS = 50;
        this.notifyUpdate(this.createUpdate(`🤖 Agent ${role} started working`, { role, status: 'started' }));
        while (!controller.signal.aborted) {
            this.updateHeartbeat(role);
            const status = await this.getTeamStatus();
            if (turnCount > 0) {
                this.notifyUpdate(this.createUpdate(`🔄 Agent ${role} turn ${turnCount}: ${status.completedTasks}/${status.totalTasks} tasks done`, { role, turn: turnCount, completedTasks: status.completedTasks, totalTasks: status.totalTasks }));
            }
            if (status.completedTasks === status.totalTasks && status.totalTasks > 0) {
                this.notifyUpdate(this.createUpdate(`✅ Agent ${role}: all tasks completed!`, { role, status: 'finished' }));
                break;
            }
            if (turnCount >= MAX_TURNS) {
                this.notifyUpdate(this.createUpdate(`⚠️ Agent ${role}: max turns (${MAX_TURNS}) reached`, { role, status: 'max_turns' }));
                break;
            }
            try {
                const prompt = turnCount === 0
                    ? this.getBootstrapPrompt(role)
                    : await this.getContinuationPrompt(turnCount);
                await runtime.session.prompt(prompt);
            }
            catch (error) {
                console.error(`Agent ${role} prompt error:`, error);
                this.notifyUpdate(this.createUpdate(`❌ Agent ${role} error: ${error.message}`, { role, error: error.message }, true));
            }
            turnCount++;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    /**
     * Handle events from child sessions and forward to UI updates.
     */
    handleAgentEvent(role, event) {
        let text = null;
        switch (event.type) {
            case 'agent_start':
                text = `[${role}] Agent started`;
                break;
            case 'agent_end':
                text = `[${role}] Agent finished: ${event.stopReason}`;
                break;
            case 'message_start':
                if (event.message?.role === 'user') {
                    const content = this.extractText(event.message);
                    text = `[${role}] User: ${content.substring(0, 200)}`;
                }
                else if (event.message?.role === 'assistant') {
                    const content = this.extractText(event.message);
                    text = `[${role}] Assistant: ${content.substring(0, 200)}`;
                }
                break;
            case 'tool_execution_start':
                text = `[${role}] Tool: ${event.toolName}`;
                break;
            case 'tool_execution_end':
                text = `[${role}] Tool ${event.toolName} done`;
                break;
            case 'message_update':
                // ignore streaming updates
                break;
        }
        if (text) {
            this.notifyUpdate({
                content: [{ type: 'text', text }],
                details: { role, eventType: event.type },
                isError: event.type === 'agent_end' && event.stopReason === 'error'
            });
        }
    }
    /**
     * Extract plain text from a message object (handles array content).
     */
    extractText(message) {
        if (typeof message.content === 'string')
            return message.content;
        const parts = (message.content || []);
        const texts = parts.filter(c => c.type === 'text').map(c => c.text).filter(Boolean);
        return texts.join('');
    }
    async initialize(tasks) {
        await this.withLock(async () => {
            this.tasks = tasks;
            this.taskStatuses.clear();
            this.pendingIndices = [];
            for (let i = 0; i < tasks.length; i++) {
                this.taskStatuses.set(i, { assignee: null, status: 'pending', result: '', retryCount: 0 });
                this.pendingIndices.push(i);
            }
            this.messageBus.clear();
            await this.workspaceClear();
            this.agentStatuses.clear();
            for (const role of this.roles) {
                this.agentStatuses.set(role, { currentTaskIndex: null, status: 'idle' });
            }
            // Clear heartbeat tracking
            this.agentLastSeen.clear();
        });
        // Notify team initialized
        this.notifyUpdate(this.createUpdate(`📋 Team initialized with ${tasks.length} tasks`, { totalTasks: tasks.length, agents: this.roles }));
    }
    getBootstrapPrompt(role) {
        const bootstrapTasksList = this.tasks.map((t, i) => `[${i}] ${t}`).join("\n");
        return `You are ${role}, an AI agent in a collaborative team.

Team tasks:
${bootstrapTasksList}

Your role: ${role}

INSTRUCTIONS:
1. Use team_ops(action="claim_task") to get a task
2. Work on the task using regular tools (bash, read, write, edit, git, etc.)
3. When done, call team_ops(action="complete_task", taskIndex=X, result="summary")
4. If you need to share data, use team_ops(action="workspace_write", key="...", value="...")
5. Communicate via team_ops(action="send_message", channel="team.chat", content="...")
6. Continue claiming tasks until all are done

Start by claiming your first task.`;
    }
    async getContinuationPrompt(turnCount) {
        const status = await this.getTeamStatus();
        const messages = await this.getMessages("team.chat", 5);
        const recentMessages = messages.map(m => `[${m.from}]: ${m.content}`).join("\n");
        return `Turn ${turnCount + 1}. Continue.

Progress: ${status.completedTasks}/${status.totalTasks} tasks completed.
${recentMessages ? `\nRecent messages:\n${recentMessages}\n` : ""}

Use team_ops to continue. If all tasks done, finish up.`;
    }
}
// ============================================
// TEAM REGISTRY
// ============================================
/**
 * Global registry for managing active teams.
 * Allows querying team status and waiting for completion from outside the team execution.
 */
export class TeamRegistry {
    static instance = null;
    teams = new Map();
    locked = false;
    autoDisposeTimers = new Map();
    AUTO_DISPOSE_DELAY = 5 * 60 * 1000; // 5 minutes
    constructor() { }
    static getInstance() {
        if (!TeamRegistry.instance) {
            TeamRegistry.instance = new TeamRegistry();
        }
        return TeamRegistry.instance;
    }
    register(teamId, team) {
        this.teams.set(teamId, team);
        console.log(`[TeamRegistry] Registered team ${teamId}`);
    }
    unregister(teamId) {
        this.clearAutoDisposeTimer(teamId);
        this.teams.delete(teamId);
        console.log(`[TeamRegistry] Unregistered team ${teamId}`);
    }
    get(teamId) {
        return this.teams.get(teamId);
    }
    has(teamId) {
        return this.teams.has(teamId);
    }
    getAll() {
        return new Map(this.teams);
    }
    // Reset auto-dispose timer for a team (called on query)
    resetAutoDisposeTimer(teamId) {
        this.clearAutoDisposeTimer(teamId);
        const team = this.teams.get(teamId);
        if (team) {
            const timer = setTimeout(() => {
                this.autoDisposeTeam(teamId);
            }, this.AUTO_DISPOSE_DELAY).unref?.();
            if (timer) {
                this.autoDisposeTimers.set(teamId, timer);
            }
        }
    }
    clearAutoDisposeTimer(teamId) {
        const timer = this.autoDisposeTimers.get(teamId);
        if (timer) {
            clearTimeout(timer);
            this.autoDisposeTimers.delete(teamId);
        }
    }
    async autoDisposeTeam(teamId) {
        const team = this.teams.get(teamId);
        if (team) {
            try {
                await team.dispose();
                this.unregister(teamId);
                console.log(`[TeamRegistry] Auto-disposed team ${teamId} after inactivity`);
            }
            catch (e) {
                console.error(`[TeamRegistry] Failed to auto-dispose team ${teamId}:`, e);
            }
        }
    }
    async waitForTeam(teamId, timeoutMs) {
        const team = this.teams.get(teamId);
        if (!team) {
            throw new Error(`Team ${teamId} not found in registry`);
        }
        const startTime = Date.now();
        while (true) {
            const status = await team.getTeamStatus();
            if (status.completedTasks === status.totalTasks && status.totalTasks > 0) {
                return true;
            }
            if (timeoutMs && Date.now() - startTime > timeoutMs) {
                return false;
            }
            // eslint-disable-next-line no-await-in-loop
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    async getTeamStatus(teamId) {
        const team = this.teams.get(teamId);
        if (!team)
            return null;
        // Reset auto-dispose timer on any query
        this.resetAutoDisposeTimer(teamId);
        return await team.getTeamStatus();
    }
}
export async function bootPiclawTeam(parentRuntime, options = {}) {
    const { size: teamSize, roles: normalizedRoles } = validateOptions(options.teamSize ?? 2, Array.isArray(options.teamRoles) ? options.teamRoles : []);
    const team = new AgentTeam();
    team.setTeamId(`team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    // Set roles on team before creating runtimes
    team.roles = normalizedRoles;
    for (const role of normalizedRoles) {
        team.agentStatuses.set(role, { currentTaskIndex: null, status: 'idle' });
    }
    team.size = normalizedRoles.length;
    // Create isolated child runtimes and start agent loops
    await team.setupChildRuntimes(parentRuntime, options.agentCwd);
    // Register team in global registry
    TeamRegistry.getInstance().register(team.id, team);
    return team;
}
export async function executeTeamTasks(team, tasks, onUpdate, _options) {
    team.setOnUpdate(onUpdate);
    await team.initialize(tasks);
    // Start autonomous agent loops
    team.startAgentLoops();
    // Setup monitor for completion and auto-dispose
    team.monitorInterval = setInterval(async () => {
        await team.withLock(() => {
            team.reclaimZombieAgents();
        });
        const status = await team.getTeamStatus();
        if (status.isComplete && status.totalTasks > 0) {
            clearInterval(team.monitorInterval);
            team.monitorInterval = null;
            try {
                const registry = TeamRegistry.getInstance();
                registry.resetAutoDisposeTimer(team.id);
            }
            catch (e) {
                console.warn('Failed to schedule auto-dispose:', e);
            }
        }
    }, 1000);
    // If wait option is true, await completion; otherwise return immediately
    if (_options?.wait) {
        try {
            await Promise.all(team.childPromises);
        }
        finally {
            if (team.monitorInterval) {
                clearInterval(team.monitorInterval);
                team.monitorInterval = null;
            }
        }
        const finalStatus = await team.getTeamStatus();
        onUpdate?.(team.createUpdate(`🎉 Team execution complete: ${finalStatus.completedTasks}/${finalStatus.totalTasks} tasks done`, { completed: finalStatus.completedTasks, total: finalStatus.totalTasks }));
    }
    else {
        onUpdate?.(team.createUpdate(`✅ Team started (teamId: ${team.id}). Progress updates will follow.`, { teamId: team.id, agentCount: team.roles.length, totalTasks: tasks.length }));
    }
    return team;
}
//# sourceMappingURL=team-manager.js.map
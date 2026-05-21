/**
 * Minimal Team Manager
 *
 * Simple task distribution and shared workspace for multi-agent collaboration.
 */

import {
  AgentSessionRuntime,
  createAgentSessionRuntime,
  createAgentSessionServices,
  createAgentSessionFromServices,
  type CreateAgentSessionRuntimeFactory,
  type CreateAgentSessionRuntimeResult,
  type SessionStartEvent,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { SharedWorkspace, type WorkspaceEntry } from "./workspace.js";
import { createTeamOpsTool } from "./team-ops-tool.js";

const MAX_TEAM_SIZE = 4;

function validateOptions(teamSize: number, teamRoles: string[]): { size: number; roles: string[] } {
  const size = Math.max(1, Math.min(teamSize, MAX_TEAM_SIZE));
  const roles: string[] = [];
  for (let i = 0; i < size; i++) {
    roles.push(teamRoles[i] ?? `agent-${i + 1}`);
  }
  return { size, roles };
}

export interface AgentTeamRuntime {
  runtimes: AgentSessionRuntime[];
  size: number;
  roles: string[];
  dispose: () => Promise<void>;
}

export class AgentTeam implements AgentTeamRuntime {
  id: string = '';
  runtimes: AgentSessionRuntime[] = [];
  roles: string[] = [];
  size = 0;
  dispose: () => Promise<void>;
  childPromises: Promise<void>[] = [];

  // State
  tasks: string[] = [];
  private taskStatuses: Map<number, { assignee: string | null; status: 'pending' | 'in_progress' | 'completed'; result: string }> = new Map();
  private agentStatuses: Map<string, { currentTaskIndex: number | null; status: string }> = new Map();
  private roleByAgentId: Map<string, string> = new Map(); // maps session.id -> role
  private workspace: SharedWorkspace;
  private messageBus: Map<string, Array<{ from: string; content: string; timestamp: number }>> = new Map();
  private lockQueue: (() => void)[] = [];
  private locked = false;
  monitorInterval: any = null;
  private onUpdate?: (update: any) => void;

  public notifyUpdate(update: any): void {
    if (this.onUpdate) {
      try {
        this.onUpdate(update);
      } catch (e) {
        // Ignore update errors - don't break team execution
        console.warn('Failed to send update:', e);
      }
    }
  }

  // Helper to create consistent update format
  public createUpdate(content: string, details?: any, isError?: boolean): any {
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
      // Wait for all child agent loops to finish (if any)
      if (this.childPromises && this.childPromises.length > 0) {
        await Promise.allSettled(this.childPromises);
      }
      await Promise.allSettled(
        this.runtimes.slice(1).map(rt =>
          rt.dispose().catch(err =>
            console.error("Failed to dispose child agent:", err)
          )
        )
      );
      // Unregister from TeamRegistry
      try {
        const registry = TeamRegistry.getInstance();
        if (this.id) {
          registry.unregister(this.id);
        }
      } catch (e) {
        console.warn('Failed to unregister team from registry:', e);
      }
    };
    this.workspace = new SharedWorkspace();
  }

  setTeamId(id: string): void {
    this.id = id;
  }

  setOnUpdate(fn: ((update: any) => void) | undefined): void {
    this.onUpdate = fn;
  }

  getWorkspace(): SharedWorkspace {
    return this.workspace;
  }

  // Locking mechanism for concurrency control
  private async acquireLock(): Promise<void> {
    return new Promise<void>(resolve => {
      this.lockQueue.push(resolve);
      if (!this.locked) this.runNext();
    });
  }

  private runNext(): void {
    if (this.lockQueue.length > 0) {
      this.locked = true;
      const next = this.lockQueue.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }

  private releaseLock(): void {
    this.locked = false;
    this.runNext();
  }

  async withLock<T>(fn: () => T | Promise<T>): Promise<T> {
    await this.acquireLock();
    try {
      return await fn();
    } finally {
      this.releaseLock();
    }
  }

  // Workspace operations with lock
  private async workspaceClear(): Promise<void> {
    this.workspace.clear();
  }

  async workspaceWrite(key: string, value: any, owner: string): Promise<void> {
    this.workspace.set(key, value, owner);
    // Notify workspace update
    this.notifyUpdate(this.createUpdate(
      `📝 ${owner} wrote to workspace: ${key}`,
      { key, owner, valuePreview: String(value).substring(0, 150) }
    ));
  }

  async workspaceRead(key: string): Promise<any> {
    return this.workspace.get(key);
  }

  async workspaceGetEntry(key: string): Promise<WorkspaceEntry | undefined> {
    return this.workspace.getEntry(key);
  }

  async workspaceList(): Promise<string[]> {
    return this.workspace.list();
  }

  async workspaceListByPrefix(prefix: string): Promise<string[]> {
    return this.workspace.listByPrefix(prefix);
  }

  async workspaceDelete(key: string): Promise<boolean> {
    return this.workspace.delete(key);
  }

  async workspaceToObject(): Promise<Record<string, any>> {
    return this.workspace.toObject();
  }

  // Compatibility for team-tool
  getContext(): { getTeamSummary: () => { totalTasks: number; completedTasks: number; activeAgents: number } } {
    return {
      getTeamSummary: () => ({
        totalTasks: this.tasks.length,
        completedTasks: Array.from(this.taskStatuses.values()).filter(t => t.status === 'completed').length,
        activeAgents: Array.from(this.agentStatuses.values()).filter(s => s.status === 'working').length,
      }),
    };
  }

  async sendMessage(channel: string, content: string, to?: string): Promise<void> {
    // In simplified version, we don't support direct messages; just broadcast to channel
    // Use 'parent' as generic sender for team tool messages
    await this.publishMessage(channel, 'parent', content);
  }

  async getMessages(channel: string, limit?: number): Promise<Array<{ from: string; content: string; timestamp: number }>> {
    return this.withLock(() => {
      const msgs = this.messageBus.get(channel) || [];
      return limit ? msgs.slice(-limit) : msgs;
    });
  }

  async publishMessage(channel: string, from: string, content: string): Promise<void> {
    return this.withLock(() => {
      if (!this.messageBus.has(channel)) {
        this.messageBus.set(channel, []);
      }
      this.messageBus.get(channel)!.push({ from, content, timestamp: Date.now() });
      // Notify message sent
      this.notifyUpdate(this.createUpdate(
        `📢 [${channel}] ${from}: ${content.substring(0, 100)}`,
        { channel, from, contentPreview: content.substring(0, 200) }
      ));
    });
  }

  async getTeamStatus(): Promise<{
    agents: Array<{ id: string; currentTaskIndex: number | null; status: string }>;
    tasks: Array<{ index: number; assignee: string | null; status: string; result: string }>;
    completedTasks: number;
    totalTasks: number;
  }> {
    return this.withLock(() => ({
      agents: Array.from(this.agentStatuses.entries()).map(([id, status]) => ({ id, ...status })),
      tasks: Array.from(this.taskStatuses.entries()).map(([idx, status]) => ({ index: idx, ...status })),
      completedTasks: Array.from(this.taskStatuses.values()).filter(t => t.status === 'completed').length,
      totalTasks: this.tasks.length,
    }));
  }

  async getMyCurrentTask(agentId: string): Promise<number | null> {
    const role = this.roleByAgentId.get(agentId) ?? agentId;
    return this.withLock(() => {
      return this.agentStatuses.get(role)?.currentTaskIndex ?? null;
    });
  }

  async claimTask(agentId: string): Promise<number | null> {
    const role = this.roleByAgentId.get(agentId) ?? agentId;
    return this.withLock(() => {
      for (let i = 0; i < this.tasks.length; i++) {
        const task = this.taskStatuses.get(i);
        if (task && task.status === 'pending') {
          task.assignee = role; // assign by role
          task.status = 'in_progress';
          this.agentStatuses.set(role, { currentTaskIndex: i, status: 'working' });
          console.log(`[DEBUG] Agent ${role} (session ${agentId}) claimed task ${i}: ${this.tasks[i].substring(0, 50)}...`);
          // Notify task claimed
          this.notifyUpdate(this.createUpdate(
            `🔨 Agent ${role} claimed task ${i}: ${this.tasks[i].substring(0, 80)}...`,
            { agent: role, taskIndex: i, taskPreview: this.tasks[i].substring(0, 200) }
          ));
          return i;
        }
      }
      console.log(`[DEBUG] Agent ${role} found no pending tasks`);
      return null;
    });
  }

  async releaseTask(agentId: string, taskIndex: number): Promise<boolean> {
    const role = this.roleByAgentId.get(agentId) ?? agentId;
    return this.withLock(() => {
      const task = this.taskStatuses.get(taskIndex);
      if (!task || task.assignee !== role || task.status === 'completed') {
        return false;
      }
      task.assignee = null;
      task.status = 'pending';
      this.agentStatuses.set(role, { currentTaskIndex: null, status: 'idle' });
      // Notify task released
      this.notifyUpdate(this.createUpdate(
        `↩️ Agent ${role} released task ${taskIndex}`,
        { agent: role, taskIndex: taskIndex }
      ));
      return true;
    });
  }

  async reportResult(taskIndex: number, result: string): Promise<void> {
    await this.withLock(() => {
      const task = this.taskStatuses.get(taskIndex);
      if (!task) {
        console.warn(`[DEBUG] reportResult: task ${taskIndex} not found`);
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
      console.log(`[DEBUG] Task ${taskIndex} completed by ${agentId}. Result preview: ${result.substring(0, 100)}...`);
    });
  }

  async completeTask(agentId: string, taskIndex: number, result: string): Promise<void> {
    const role = this.roleByAgentId.get(agentId) ?? agentId;
    await this.withLock(() => {
      const task = this.taskStatuses.get(taskIndex);
      if (!task) return;
      if (task.assignee !== role) return;
      task.status = 'completed';
      task.result = result;
      task.assignee = null; // Clear assignment on completion
      const status = this.agentStatuses.get(role);
      if (status) {
        status.currentTaskIndex = null;
        status.status = 'idle';
      }
      // Notify task completed
      this.notifyUpdate(this.createUpdate(
        `✅ Agent ${role} completed task ${taskIndex}`,
        { agent: role, taskIndex: taskIndex, resultPreview: result.substring(0, 150) }
      ));
    });
  }

  async getResults(): Promise<string[]> {
    return this.withLock(() => {
      const results: string[] = new Array(this.tasks.length).fill('');
      this.taskStatuses.forEach((task, idx) => {
        results[idx] = task.result;
      });
      return results;
    });
  }

  async waitForCompletion(): Promise<void> {
    while (true) {
      const summary = await this.getTeamStatus();
      if (summary.completedTasks === summary.totalTasks && summary.totalTasks > 0) {
        return;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  registerRuntime(runtime: AgentSessionRuntime, role: string): void {
    this.runtimes.push(runtime);
    this.roles.push(role);
    this.agentStatuses.set(role, { currentTaskIndex: null, status: 'idle' });
    this.roleByAgentId.set((runtime.session as any).id, role);
    this.size = this.runtimes.length;
  }

  async initialize(tasks: string[]): Promise<void> {
    await this.withLock(async () => {
      this.tasks = tasks;
      this.taskStatuses.clear();
      for (let i = 0; i < tasks.length; i++) {
        this.taskStatuses.set(i, { assignee: null, status: 'pending', result: '' });
      }
      this.messageBus.clear();
      await this.workspaceClear();
      this.agentStatuses.clear();
      for (const role of this.roles) {
        this.agentStatuses.set(role, { currentTaskIndex: null, status: 'idle' });
      }
    });
    // Notify team initialized
    this.notifyUpdate(this.createUpdate(
      `📋 Team initialized with ${tasks.length} tasks`,
      { totalTasks: tasks.length, agents: this.roles }
    ));
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
  private static instance: TeamRegistry | null = null;
  private teams: Map<string, AgentTeam> = new Map();
  private locked = false;

  private constructor() {}

  static getInstance(): TeamRegistry {
    if (!TeamRegistry.instance) {
      TeamRegistry.instance = new TeamRegistry();
    }
    return TeamRegistry.instance;
  }

  register(teamId: string, team: AgentTeam): void {
    this.teams.set(teamId, team);
    console.log(`[TeamRegistry] Registered team ${teamId}`);
  }

  unregister(teamId: string): void {
    this.teams.delete(teamId);
    console.log(`[TeamRegistry] Unregistered team ${teamId}`);
  }

  get(teamId: string): AgentTeam | undefined {
    return this.teams.get(teamId);
  }

  has(teamId: string): boolean {
    return this.teams.has(teamId);
  }

  getAll(): Map<string, AgentTeam> {
    return new Map(this.teams);
  }

  async waitForTeam(teamId: string, timeoutMs?: number): Promise<boolean> {
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

  async getTeamStatus(teamId: string): Promise<{
    agents: Array<{ id: string; currentTaskIndex: number | null; status: string }>;
    tasks: Array<{ index: number; assignee: string | null; status: string; result: string }>;
    completedTasks: number;
    totalTasks: number;
  } | null> {
    const team = this.teams.get(teamId);
    if (!team) return null;
    return await team.getTeamStatus();
  }
}

export async function bootPiclawTeam(
  parentRuntime: AgentSessionRuntime,
  options: {
    teamSize?: number;
    teamRoles?: string[];
    tools?: string[];
  } = {}
): Promise<AgentTeam> {
  const cwd = parentRuntime.cwd;
  const agentDir = getAgentDir();

  const { size: teamSize, roles: normalizedRoles } = validateOptions(
    options.teamSize ?? 2,
    Array.isArray(options.teamRoles) ? options.teamRoles : []
  );

  const team = new AgentTeam();
  team.registerRuntime(parentRuntime, "parent");

  // Define factory and startEvent once (same for all agents)
  const factory: CreateAgentSessionRuntimeFactory = async ({
    cwd: sessionCwd,
    agentDir: sessionAgentDir,
    sessionManager,
    sessionStartEvent,
  }) => {
    const services = await createAgentSessionServices({
      cwd,
      agentDir: sessionAgentDir,
      authStorage: parentRuntime.services.authStorage,
      settingsManager: parentRuntime.services.settingsManager,
      modelRegistry: parentRuntime.services.modelRegistry,
    });

    const sessionResult = await createAgentSessionFromServices({
      services,
      sessionManager,
      sessionStartEvent,
      tools: options.tools,
      customTools: [createTeamOpsTool(team)],
    });

    return {
      session: sessionResult.session,
      services,
      diagnostics: services.diagnostics,
    } as CreateAgentSessionRuntimeResult;
  };

  const startEvent: SessionStartEvent = {
    type: "session_start",
    reason: "new"
  };

  // Create all agents in parallel while preserving order
  const bootPromises = normalizedRoles.map(async (role, idx) => {
    const runtime = await createAgentSessionRuntime(factory, {
      cwd,
      agentDir,
      sessionManager: parentRuntime.session.sessionManager,
      sessionStartEvent: startEvent,
    });
    return { idx, role, runtime };
  });

  const results = await Promise.all(bootPromises);
  // Sort by original index to maintain order
  results.sort((a, b) => a.idx - b.idx);
  for (const { role, runtime } of results) {
    team.registerRuntime(runtime, role);
  }

  team.id = `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  (team as any)._parentRuntime = parentRuntime;

  // Register team in global registry
  TeamRegistry.getInstance().register(team.id, team);

  return team;
}

export async function executeTeamTasks(
  team: AgentTeam,
  tasks: string[],
  onUpdate?: (update: any) => void,
  options?: { wait?: boolean }
): Promise<AgentTeam> {
  // Set onUpdate for the team
  team.setOnUpdate(onUpdate);
  await team.initialize(tasks);

  const bootstrapTasksList = tasks.map((t, i) => `[${i}] ${t}`).join("\n");

  const getBootstrapPrompt = (role: string) => `You are ${role}, an AI agent in a collaborative team.

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

  const getContinuationPrompt = async (turnCount: number) => {
    const status = await team.getTeamStatus();
    const messages = await team.getMessages("team.chat", 5);
    const recentMessages = messages.map(m => `[${m.from}]: ${m.content}`).join("\n");

    return `Turn ${turnCount + 1}. Continue.

Progress: ${status.completedTasks}/${status.totalTasks} tasks completed.
${recentMessages ? `\nRecent messages:\n${recentMessages}\n` : ""}

Use team_ops to continue. If all tasks done, finish up.`;
  };

  async function runAgentLoop(runtime: AgentSessionRuntime, role: string): Promise<void> {
    let turnCount = 0;
    const maxTurnsPerAgent = 50;

    console.log(`[DEBUG] Agent ${role} starting loop`);
    team.notifyUpdate?.(team.createUpdate(
      `🤖 Agent ${role} started working`,
      { role, status: 'started' }
    ));

    while (true) {
      const status = await team.getTeamStatus();
      console.log(`[DEBUG] Agent ${role} turn ${turnCount}: ${status.completedTasks}/${status.totalTasks} completed`);
      
      // Notify progress at start of each turn (but not on first turn since we already announced start)
      if (turnCount > 0) {
        team.notifyUpdate?.(team.createUpdate(
          `🔄 Agent ${role} turn ${turnCount}: ${status.completedTasks}/${status.totalTasks} tasks done`,
          { role, turn: turnCount, completedTasks: status.completedTasks, totalTasks: status.totalTasks }
        ));
      }

      if (status.completedTasks === status.totalTasks && status.totalTasks > 0) {
        console.log(`[DEBUG] Agent ${role} all tasks done, exiting`);
        team.notifyUpdate?.(team.createUpdate(
          `✅ Agent ${role}: all tasks completed!`,
          { role, status: 'finished' }
        ));
        break;
      }

      if (turnCount >= maxTurnsPerAgent) {
        console.log(`[DEBUG] Agent ${role} max turns reached, exiting`);
        team.notifyUpdate?.(team.createUpdate(
          `⚠️ Agent ${role}: max turns (${maxTurnsPerAgent}) reached`,
          { role, status: 'max_turns' }
        ));
        break;
      }

      try {
        const prompt = turnCount === 0
          ? getBootstrapPrompt(role)
          : await getContinuationPrompt(turnCount);

        console.log(`[DEBUG] Agent ${role} sending prompt (turn ${turnCount})`);
        await runtime.session.prompt(prompt);
        turnCount++;
      } catch (err: any) {
        console.error(`Agent ${role} error:`, err.message);
        team.notifyUpdate?.(team.createUpdate(
          `❌ Agent ${role} error: ${err.message}`,
          { role, error: err.message, status: 'error' },
          true
        ));
        // Release current task to prevent starvation
        const currentTask = await team.getMyCurrentTask(role);
        if (currentTask !== null) {
          await team.releaseTask(role, currentTask);
        }
        break;
      }
    }

    console.log(`[DEBUG] Agent ${role} loop ended after ${turnCount} turns`);
  }

  // Start all child agents (skip parent at index 0)
  const childPromises = team.runtimes.slice(1).map((runtime, idx) => {
    const role = team.roles[idx + 1];
    return runAgentLoop(runtime, role).catch(err => {
      console.error(`Agent ${role} failed:`, err);
    });
  });

  // Save childPromises to team for later disposal
  team.childPromises = childPromises;

  // Monitor completion and cleanup
  team.monitorInterval = setInterval(async () => {
    const status = await team.getTeamStatus();
    if (status.completedTasks === status.totalTasks && status.totalTasks > 0) {
      clearInterval(team.monitorInterval);
      team.monitorInterval = null;
    }
  }, 1000);

  if (options?.wait) {
    try {
      await Promise.all(childPromises);
    } finally {
      if (team.monitorInterval) {
        clearInterval(team.monitorInterval);
        team.monitorInterval = null;
      }
    }
    // Final status update
    const finalStatus = await team.getTeamStatus();
    onUpdate?.(team.createUpdate(
      `🎉 Team execution complete: ${finalStatus.completedTasks}/${finalStatus.totalTasks} tasks done`,
      { completed: finalStatus.completedTasks, total: finalStatus.totalTasks }
    ));
  } else {
    // Non-blocking: return immediately, team continues in background
    onUpdate?.(team.createUpdate(
      `✅ Team started in background (teamId: ${team.id}). Use team_wait to wait for completion.`,
      { teamId: team.id, agentCount: team.roles.length, totalTasks: tasks.length }
    ));
  }

  return team;
}

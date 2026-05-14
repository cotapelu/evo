// @ts-nocheck
// evo.ts - Self-Evolving Agent v2.1 (Iteration 105 - Full Module Integration)
// Mục tiêu: Tự tiến hóa thành Agent OS hoàn chỉnh qua vòng lặp Read → Run → Evolve
// Iteration: 1 - Complete refactor, bug fixes, architecture improvements
// Last updated: 2026-05-13T00:00:00.000Z

// Features: Core kernel, Memory management, File system with sandbox, Process manager, IPC, Security, Health monitoring
// Iteration 56: 3 changes (Refactor for modularity) [high]
// Iteration 55: 3 changes (Refactor for modularity) [high]
// Iteration 54: 3 changes (Refactor for modularity) [high]
// Iteration 53: 3 changes (Refactor for modularity) [high]
// Iteration 52: 3 changes (Refactor for modularity) [high]
// Iteration 51: 3 changes (Refactor for modularity) [high]
// Iteration 50: 3 changes (Refactor for modularity) [high]
// Iteration 49: 3 changes (Refactor for modularity) [high]
// Iteration 48: 3 changes (Refactor for modularity) [high]
// Iteration 47: 3 changes (Refactor for modularity) [high]
// Iteration 46: 3 changes (Refactor for modularity) [high]
// Iteration 45: 3 changes (Refactor for modularity) [high]
// Iteration 44: 3 changes (Refactor for modularity) [high]
// Iteration 43: 3 changes (Refactor for modularity) [high]
// Iteration 42: 3 changes (Refactor for modularity) [high]
// Iteration 41: 3 changes (Refactor for modularity) [high]
// Iteration 40: 3 changes (Refactor for modularity) [high]
// Iteration 39: 3 changes (Refactor for modularity) [high]
// Iteration 38: 3 changes (Refactor for modularity) [high]
// Iteration 37: 3 changes (Refactor for modularity) [high]
// Iteration 36: 3 changes (Refactor for modularity) [high]
// Iteration 35: 3 changes (Refactor for modularity) [high]
// Iteration 34: 3 changes (Refactor for modularity) [high]
// Iteration 33: 3 changes (Refactor for modularity) [high]
// Iteration 32: 3 changes (Refactor for modularity) [high]
// Iteration 31: 3 changes (Refactor for modularity) [high]
// Iteration 30: 3 changes (Refactor for modularity) [high]
// Iteration 29: 3 changes (Refactor for modularity) [high]
// Iteration 28: 3 changes (Refactor for modularity) [high]
// Iteration 27: 3 changes (Refactor for modularity) [high]
// Iteration 26: 3 changes (Refactor for modularity) [high]
// Iteration 25: 3 changes (Refactor for modularity) [high]
// Iteration 24: 3 changes (Refactor for modularity) [high]
// Iteration 23: 3 changes (Refactor for modularity) [high]
// Iteration 22: 3 changes (Refactor for modularity) [high]
// Iteration 21: 3 changes (Refactor for modularity) [high]
// Iteration 20: 3 changes (Refactor for modularity) [high]
// Iteration 19: 3 changes (Refactor for modularity) [high]
// Iteration 18: 3 changes (Refactor for modularity) [high]
// Iteration 17: 3 changes (Refactor for modularity) [high]
// Iteration 16: 3 changes (Refactor for modularity) [high]
// Iteration 15: 3 changes (Refactor for modularity) [high]
// Iteration 14: 3 changes (Refactor for modularity) [high]
// Iteration 13: 3 changes (Refactor for modularity) [high]
// Iteration 12: 3 changes (Refactor for modularity) [high]
// Iteration 11: 3 changes (Refactor for modularity) [high]
// Iteration 10: 3 changes (Refactor for modularity) [high]
// Iteration 9: 3 changes (Refactor for modularity) [high]
// Iteration 8: 3 changes (Refactor for modularity) [high]
// Iteration 7: 3 changes (Refactor for modularity) [high]
// Iteration 6: 3 changes (Refactor for modularity) [high]
// Iteration 5: 3 changes (Refactor for modularity) [high]
// Iteration 4: 3 changes (Refactor for modularity) [high]
// Iteration 3: 3 changes (Refactor for modularity) [high]
// Iteration 2: 3 changes (Refactor for modularity) [high]
// Iteration 1: 3 changes (Refactor for modularity) [high]
// Iteration 8: 3 changes (Refactor for modularity) [critical]
// Iteration 7: 3 changes (Refactor for modularity) [critical]
// Iteration 6: 3 changes (Refactor for modularity) [critical]
// Iteration 5: 3 changes (Refactor for modularity) [critical]
// Iteration 4: 3 changes (Refactor for modularity) [critical]
// Iteration 3: 3 changes (Refactor for modularity) [critical]
// Iteration 2: 3 changes (Refactor for modularity) [critical]
// Iteration 1: 3 changes (Refactor for modularity) [critical]
// Iteration 5: 0 changes (Refactor for modularity) [critical]
// Iteration 4: 0 changes (Refactor for modularity) [critical]
// Iteration 3: 0 changes (Refactor for modularity) [critical]
// Iteration 2: 0 changes (Refactor for modularity) [critical]
// Iteration 1: 0 changes (Refactor for modularity) [critical]

/// <reference types="node" />

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { Worker as WorkerThread } from 'worker_threads';
import { WorkerPoolThreads } from './src/worker-pool-threads.ts';
import * as http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== MODULE IMPORTS ====================
import { FileSystem } from './src/filesystem.ts';
import { MessageQueue } from './src/messaging.ts';
import type { Message } from './src/messaging.ts';
import * as GoalsModule from './src/goals.ts';
export type { Goal } from './src/goals.ts';
import { HealthMonitor } from './src/health.ts';
import { ASTTransformer } from './src/ast-transformer.ts';
import { TestRunner } from './src/test-runner.ts';
import { generateId, sleep, nowISO, safeStringify, clamp, getMemoryUsage, getCpuTime, getUptime } from './src/utils.ts';
import type { EvolutionPlan, AgentConfig, AgentState, EvolutionMetrics } from './src/types.ts';

// Debug: mark imports done
(() => { try { require('fs').appendFileSync('/tmp/evo-early.log', 'IMPORTS DONE\n'); } catch {} })();

// ==================== AGENT CLASS ====================

export class EvoAgent {
  readonly id: string;
  state: AgentState;
  config: AgentConfig;
  private fs: FileSystem;
  private currentCode: string;
  private iterationCount: number = 0;
  private isRunning: boolean = false;
  private parent?: EvoAgent;
  private logBuffer: string[] = [];
  // Static counter for all agent instances to limit total agents
  private static totalAgents = 0;
  private static readonly MAX_TOTAL_AGENTS = 20; // Hard limit across all agents
  private healthCheckTimer?: NodeJS.Timeout;
  private backupTimer?: NodeJS.Timeout;
  private goalManager!: GoalsModule.GoalManager;
  private messageQueue!: MessageQueue;
  private healthMonitor!: HealthMonitor;
  private astTransformer!: ASTTransformer;
  private testRunner!: TestRunner;
  private workerPool?: WorkerPoolThreads;
  private analysisCache = new Map<string, { result: any; timestamp: number }>();
  private readonly ANALYSIS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly ANALYSIS_CACHE_MAX_SIZE = 50; // Max entries
  private lastCacheCleanup = 0;
  private readonly ANALYSIS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly ANALYSIS_CACHE_MAX_SIZE = 50; // Max entries
  private lastCacheCleanup = 0;

  constructor(config: Partial<AgentConfig> = {}, parent?: EvoAgent) {
    try { require('fs').appendFileSync('/tmp/evo-constructor.log', 'CONSTRUCTOR CALLED\n'); } catch {}
    // Check global agent limit
    if (EvoAgent.totalAgents >= EvoAgent.MAX_TOTAL_AGENTS) {
      throw new Error(`Max total agents (${EvoAgent.MAX_TOTAL_AGENTS}) reached. Cannot create new agent.`);
    }
    EvoAgent.totalAgents++;
    this.id = generateId();
    this.parent = parent;

    const defaultAllowedPaths = [__dirname];
    const defaultBlockedOps = ['/etc/', '/sys/', '/proc/', 'C:\\Windows\\', 'C:\\Program Files'];

    this.config = {
      backupBeforeEvolve: true,
      logLevel: (process.env.AGENT_LOG_LEVEL as any) || 'info',
      evolutionStrategy: 'balanced',
      enablePersistence: true,
      enableReplication: true,
      enablePlugins: false,
      enableOrchestration: true,
      enableSecurity: true,
      enableHealthChecks: true,
      maxChildren: parseInt(process.env.AGENT_MAX_CHILDREN || '5'),
      memoryPath: process.env.AGENT_MEMORY_PATH || 'memory.json',
      logPath: process.env.AGENT_LOG_PATH || 'agent.log',
      apiRateLimit: parseInt(process.env.AGENT_API_RATE_LIMIT || '60'),
      resourceLimits: {
        maxMemoryMB: parseInt(process.env.AGENT_RESOURCE_MAX_MEMORY || '100'),
        maxCpuMsPerIter: parseInt(process.env.AGENT_RESOURCE_MAX_CPU || '5000'),
        maxOpenFiles: 100
      },
      security: {
        requireAuth: process.env.AGENT_SECURITY_REQUIRE_AUTH === 'true',
        allowedPaths: process.env.AGENT_SECURITY_ALLOWED_PATHS ? process.env.AGENT_SECURITY_ALLOWED_PATHS.split(',') : defaultAllowedPaths,
        blockedOperations: process.env.AGENT_SECURITY_BLOCKED_OPS ? process.env.AGENT_SECURITY_BLOCKED_OPS.split(',') : defaultBlockedOps,
        sandboxMode: (process.env.AGENT_SECURITY_SANDBOX as any) || 'moderate'
      },
      ...config
    };

    // Validate config
    if (this.config.maxChildren <= 0) this.config.maxChildren = 5;
    if (!this.config.resourceLimits) {
      this.config.resourceLimits = { maxMemoryMB: 100, maxCpuMsPerIter: 5000, maxOpenFiles: 100 };
    }

    // Initialize sandbox
    const allowedPaths = this.config.security?.allowedPaths || defaultAllowedPaths;
    const blockedOps = this.config.security?.blockedOperations || defaultBlockedOps;
    this.fs = new FileSystem({ basePath: __dirname, allowedPaths, blockedOperations: blockedOps });

    // Initialize core modules (Iteration 105)
    this.goalManager = new GoalsModule.GoalManager();
    this.messageQueue = new MessageQueue(1000);
    this.healthMonitor = new HealthMonitor(this.config.resourceLimits, {
      checkInterval: 10000,
      failureThreshold: 3
    });
    this.astTransformer = new ASTTransformer();
    this.testRunner = new TestRunner();
    // TODO: Enable worker pool after fixing thread loading
    this.workerPool = undefined; // new WorkerPoolThreads(workerCount);

    // Initialize state
    this.state = {
      level: 10,
      capabilities: ['self-awareness', 'basic-evolution'],
      memory: new Map(),
      history: [],
      config: this.config,
      goals: [],
      children: [],
      messages: [],
      health: {
        status: 'healthy',
        lastCheck: nowISO(),
        consecutiveFailures: 0,
        memoryPressure: 0
      },
      stats: {
        totalIterations: 0,
        totalMessagesSent: 0,
        totalMessagesReceived: 0,
        totalChildrenSpawned: 0,
        totalGoalsCompleted: 0,
        startTime: nowISO()
      },
      sandbox: {
        allowedPaths,
        blockedOperations: blockedOps,
        resourceLimits: {
          maxMemoryMB: this.config.resourceLimits?.maxMemoryMB || 100,
          maxCpuMsPerIter: this.config.resourceLimits?.maxCpuMsPerIter || 5000,
          maxOpenFiles: this.config.resourceLimits?.maxOpenFiles || 100
        }
      }
    };

    this.currentCode = '';

    // Sync state with modules
    this.syncStateFromModules();
  }

  private syncStateFromModules(): void {
    // Sync goals from GoalManager
    this.state.goals = this.goalManager.getAll();
    // Sync health from HealthMonitor
    const healthStatus = this.healthMonitor.getStatus();
    this.state.health = {
      status: healthStatus.status,
      lastCheck: healthStatus.lastCheck,
      consecutiveFailures: healthStatus.consecutiveFailures,
      memoryPressure: healthStatus.memoryPressure
    };
    // Note: messages are transient, not stored in state
  }

  // ==================== LOGGING ====================

  private log(level: AgentConfig['logLevel'], message: string, ...args: any[]) {
    const levels = { trace: 0, debug: 1, info: 2, warn: 2, error: 0 };
    const configLevel = levels[this.config.logLevel];
    const currentLevel = levels[level];
    if (configLevel <= currentLevel) {
      const timestamp = new Date().toISOString();
      const prefix = `[AGENT-${this.id.slice(-6)}] [EVO-${this.state.level}] [${level.toUpperCase()}] [${timestamp}]`;
      const logEntry = `${prefix} ${message} ${args.map(a => JSON.stringify(a)).join(' ')}`;
      console.log(logEntry);

      this.logBuffer.push(logEntry);
      if (this.logBuffer.length > 100) {
        this.flushLogs();
      }
    }
  }

  private flushLogs(): void {
    if (this.config.logPath && this.logBuffer.length > 0) {
      try {
        this.fs.appendFile(this.config.logPath, this.logBuffer.join('\n') + '\n');
        this.logBuffer = [];
      } catch (e) {
        console.error('Failed to write log file:', e);
      }
    }
  }

  private loadLogBuffer(): void {
    if (!this.config.logPath) return;
    try {
      if (this.fs.exists(this.config.logPath)) {
        const content = this.fs.readFile(this.config.logPath);
        const lines = content.split('\n');
        this.logBuffer = lines.slice(-50).filter(l => l.trim());
      }
    } catch {
      // Ignore
    }
  }

  // ==================== PERSISTENCE ====================

  private async saveMemory(): Promise<void> {
    if (!this.config.enablePersistence) return;
    try {
      const stateData = {
        level: this.state.level,
        capabilities: this.state.capabilities,
        memory: Array.from(this.state.memory.entries()) as [string, any][],
        history: this.state.history.slice(-100),
        goals: this.state.goals,
        children: this.state.children,
        health: this.state.health,
        stats: this.state.stats
      };
      const data = JSON.stringify({
        state: stateData,
        lastSaved: new Date().toISOString(),
        agentId: this.id,
        version: '2.0'
      }, null, 2);
      this.fs.writeFile(this.config.memoryPath || 'memory.json', data);
      this.log('debug', '💾 Memory saved to file');
    } catch (e) {
      this.log('error', 'Failed to save memory:', e);
    }
  }

  private async loadMemory(): Promise<void> {
    if (!this.config.enablePersistence) return;
    try {
      const filePath = this.config.memoryPath || 'memory.json';
      if (this.fs.exists(filePath)) {
        const data = JSON.parse(this.fs.readFile(filePath));
        const savedState = data.state;
        this.state.level = savedState.level || 0;
        this.state.capabilities = [...new Set(savedState.capabilities || [])];
        this.state.memory = new Map(savedState.memory || []);
        this.state.history = savedState.history || [];
        this.state.goals = savedState.goals || [];
        // Restore goal manager from state
        if (this.state.goals && this.state.goals.length > 0) {
          try { this.goalManager.fromJSON(JSON.stringify(this.state.goals)); } catch {}
        }
        this.state.children = savedState.children || [];
        if (savedState.health) this.state.health = { ...this.state.health, ...savedState.health };
        if (savedState.stats) this.state.stats = { ...this.state.stats, ...savedState.stats };
        this.log('info', '📂 Memory loaded from file. Level:', this.state.level);
      }
    } catch (e) {
      this.log('warn', 'Failed to load memory:', e);
      this.state.level = 0;
      this.state.capabilities = ['basic'];
    }
  }

  // ==================== HEALTH MONITORING ====================

  private performHealthCheck(): { status: 'healthy' | 'degraded' | 'unhealthy'; memoryPressure: number; issues: string[] } {
    const issues: string[] = [];
    const memUsage = getMemoryUsage();
    const memLimit = this.state.sandbox.resourceLimits.maxMemoryMB;
    const memoryPressure = memUsage / memLimit;

    if (memoryPressure > 0.9) {
      issues.push('Critical memory pressure');
    } else if (memoryPressure > 0.7) {
      issues.push('High memory usage');
    }

    const recentMetrics = this.state.history.slice(-5);
    if (recentMetrics.length >= 3) {
      const avgSuccess = recentMetrics.reduce((sum, m) => sum + (m.performance.successRate || 100), 0) / recentMetrics.length;
      if (avgSuccess < 80) {
        issues.push('Low success rate in recent iterations');
      }
    }

    if (this.state.health.consecutiveFailures >= 3) {
      issues.push('Multiple consecutive failures');
    }

    const status: 'healthy' | 'degraded' | 'unhealthy' =
      issues.length === 0 ? 'healthy' :
      issues.some(i => i.includes('Critical')) ? 'unhealthy' : 'degraded';

    return { status, memoryPressure, issues };
  }

  private async updateHealthCheck(): Promise<void> {
    // Use HealthMonitor module
    const check = await this.healthMonitor.performCheck(
      getMemoryUsage(),
      getCpuTime(),
      getUptime()
    );

    const oldStatus = this.state.health.status;
    this.state.health = {
      ...this.state.health,
      status: check.status,
      lastCheck: check.lastCheck,
      memoryPressure: check.memoryPressure,
      // Map other fields from HealthMonitor
      consecutiveFailures: this.state.health.consecutiveFailures
    };

    if (oldStatus !== check.status) {
      this.log('warn', '🏥 Health status changed:', oldStatus, '→', check.status, 'Issues:', check.issues.join(', '));
    }

    // Auto-recovery is handled by HealthMonitor internally via registered actions
    if (check.status === 'unhealthy' && this.state.health.consecutiveFailures >= 2) {
      this.log('error', '🚨 Agent unhealthy. Manual recovery may be needed.');
    }
  }

  private triggerAutoRecovery(): void {
    this.log('info', '🔄 Starting auto-recovery...');

    // Clear temporary caches
    this.state.memory.forEach((value, key) => {
      if (key.startsWith('cache_') || key.startsWith('temp_')) {
        this.state.memory.delete(key);
      }
    });

    // Hint GC
    if (global.gc) {
      global.gc();
      this.log('info', 'GC triggered');
    }

    // Reduce limits temporarily
    this.state.sandbox.resourceLimits.maxMemoryMB = Math.max(50, this.state.sandbox.resourceLimits.maxMemoryMB * 0.8);

    // Save recovery point
    this.saveMemory().catch(e => this.log('error', 'Failed to save state during recovery:', e));

    this.log('info', '✅ Auto-recovery completed');
  }

  // ==================== GOAL MANAGEMENT ====================

  createGoal(description: string, priority: number = 1, steps?: string[], dependencies?: string[]): GoalsModule.Goal {
    const goal = this.goalManager.create(description, priority, steps, dependencies);
    this.state.goals = this.goalManager.getAll();
    this.saveMemory();
    this.log('info', '🎯 New goal created:', description);
    return goal;
  }

  updateGoal(goalId: string, status: GoalsModule.Goal['status']): boolean {
    const success = this.goalManager.update(goalId, { status });
    if (success) {
      this.state.goals = this.goalManager.getAll();
      const goal = this.goalManager.get(goalId);
      if (status === 'completed' && goal && !goal.completedAt) {
        this.state.stats.totalGoalsCompleted++;
      }
      this.saveMemory();
      this.log('debug', 'Goal updated:', goalId, '→', status);
    }
    return success;
  }

  advanceGoal(goalId: string): boolean {
    const success = this.goalManager.advance(goalId);
    if (success) {
      this.state.goals = this.goalManager.getAll();
      const goal = this.goalManager.get(goalId);
      if (goal && goal.status === 'completed') {
        this.state.stats.totalGoalsCompleted++;
        this.log('info', '🎉 Goal completed:', goal.description);
      }
      this.saveMemory();
    }
    return success;
  }

  getActiveGoals(): GoalsModule.Goal[] {
    return this.goalManager.getActive();
  }

  getGoalsByPriority(minPriority: number = 1): GoalsModule.Goal[] {
    return this.goalManager.getByPriority(minPriority);
  }

  // ==================== MESSAGING ====================

  sendMessage(to: string, content: any, type: Message['type'] = 'request', priority: number = 1, ttl: number = 10): void {
    const msg = this.messageQueue.enqueue({
      from: this.id,
      to,
      content,
      type,
      priority,
      ttl
    });
    this.state.stats.totalMessagesSent++;
    this.log('trace', '📨 Message sent to:', to, 'type:', type, 'id:', msg.id);
  }

  getMessagesForAgent(agentId: string): Message[] {
    return this.messageQueue.getForAgent(agentId);
  }

  broadcast(content: any, priority: number = 1): void {
    const sentTo: string[] = [];
    for (const childId of this.state.children) {
      this.sendMessage(childId, { type: 'broadcast', content }, 'broadcast', priority);
      sentTo.push(childId);
    }
    if (sentTo.length > 0) {
      this.log('debug', '📡 Broadcast sent to', sentTo.length, 'children');
    }
  }

  receiveMessage(msg: Message): void {
    this.messageQueue.enqueue(msg);
    this.state.stats.totalMessagesReceived++;
    this.log('trace', '📥 Received message from:', msg.from, 'type:', msg.type);
  }

  gossip(): void {
    if (!this.config.enableOrchestration) return;
    const gossipMsg: Message = {
      id: generateId(),
      from: this.id,
      to: 'broadcast',
      content: {
        type: 'gossip',
        level: this.state.level,
        capabilities: this.state.capabilities,
        children: this.state.children.length,
        timestamp: nowISO()
      },
      timestamp: nowISO(),
      type: 'gossip'
    };
    this.broadcast(gossipMsg.content, 1);
    this.log('debug', '🔊 Gossip sent');
  }

  // ==================== SELF-REPLICATION ====================

  spawnChild(config?: Partial<AgentConfig>): EvoAgent | null {
    if (!this.config.enableReplication) {
      this.log('warn', 'Replication disabled');
      return null;
    }

    // Check global agent limit
    if (EvoAgent.totalAgents >= EvoAgent.MAX_TOTAL_AGENTS) {
      this.log('warn', 'Global agent limit reached:', EvoAgent.MAX_TOTAL_AGENTS);
      return null;
    }

    if (this.state.children.length >= this.config.maxChildren) {
      this.log('warn', 'Max children reached:', this.config.maxChildren);
      return null;
    }

    try {
      const childConfig: Partial<AgentConfig> = {
        ...config,
        maxChildren: Math.max(1, (this.config.maxChildren || 5) - 1),
        enableReplication: true,
        enablePersistence: true,
        enablePlugins: false,
        memoryPath: `memory-${generateId()}.json`,
        logPath: `agent-${generateId()}.log`,
        evolutionStrategy: this.config.evolutionStrategy,
        resourceLimits: {
          maxMemoryMB: Math.floor((this.config.resourceLimits?.maxMemoryMB || 100) * 0.5),
          maxCpuMsPerIter: Math.floor((this.config.resourceLimits?.maxCpuMsPerIter || 5000) * 0.5),
          maxOpenFiles: 50
        }
      };
      // Worker pool size will be auto-calculated in child constructor based on its memory limit

      let child: EvoAgent | null = null;
      try {
        child = new EvoAgent(childConfig, this);
      } catch (error) {
        this.log('error', 'Failed to create child agent (limit reached?):', error);
        // Ensure global counter stays consistent if constructor incremented before throwing
        if (EvoAgent.totalAgents > 0) {
          EvoAgent.totalAgents--;
        }
        return null;
      }
      this.state.children.push(child.id);
      this.state.stats.totalChildrenSpawned++;

      child.run().catch(e => {
        this.log('error', 'Child agent crashed:', child.id, e);
        this.state.children = this.state.children.filter(id => id !== child.id);
        this.state.health.consecutiveFailures++;
      });

      this.saveMemory();
      this.log('info', '👶 Spawned child agent:', child.id, 'Total children:', this.state.children.length);

      // Derive active goals for child (up to 3)
      const activeGoals = this.getActiveGoals().slice(0, 3);
      for (const goal of activeGoals) {
        child.createGoal(`[DERIVED] ${goal.description}`, goal.priority, goal.steps);
      }

      return child;
    } catch (error) {
      this.log('error', 'Failed to spawn child:', error);
      return null;
    }
  }

  // ==================== CORE EVOLUTION LOOP ====================

  async run(): Promise<void> {
    try { require('fs').appendFileSync('/tmp/evo-run.log', 'RUN START\n'); } catch {}
    this.isRunning = true;
    console.log('🚀 RUN STARTED'); // Debug
    this.log('info', '🚀 Starting Self-Evolution Loop...');
    this.log('info', 'Agent ID:', this.id);
    this.log('info', 'Parent:', this.parent?.id || 'none');

    await this.initialize();

    while (this.isRunning) {
      try {
        await this.executeIteration();
        this.iterationCount++;
        this.state.stats.totalIterations++;

        await this.processMessages();

        if (this.config.maxIterations && this.iterationCount >= this.config.maxIterations) {
          this.log('info', '✅ Reached max iterations. Shutting down.');
          break;
        }

        // Adaptive delay based on health, resources, and iteration performance (Iteration 116)
        const mem = process.memoryUsage();
        const totalMem = mem.heapUsed + mem.heapTotal + mem.external;
        const memLimit = this.state.sandbox.resourceLimits.maxMemoryMB * 1024 * 1024;
        const memPct = (totalMem / memLimit) * 100;
        const cpuStart = process.cpuUsage();
        const cpuPct = cpuStart ? ((cpuStart.user + cpuStart.system) / (os.cpus().length * 1000)) : 0;

        // Base delay
        let delayMs = 10;

        // Health-based backoff
        if (this.state.health.status === 'unhealthy') {
          delayMs = 3000 + Math.random() * 2000; // Severe: 3-5s
        } else if (this.state.health.status === 'degraded') {
          delayMs = 1000 + Math.random() * 1000; // Moderate: 1-2s
        } else {
          // Resource-based backoff
          if (memPct > 85 || cpuPct > 85) {
            delayMs = 500 + Math.random() * 500; // High load: 0.5-1s
          } else if (memPct > 70 || cpuPct > 70) {
            delayMs = 200 + Math.random() * 200; // Medium load: 0.2-0.4s
          }
        }

        // Failure-based backoff
        if (this.state.health.consecutiveFailures > 0) {
          delayMs += this.state.health.consecutiveFailures * 500;
        }

        // Children count backoff (more children = more delay)
        if (this.state.children.length > 2) {
          delayMs += (this.state.children.length - 2) * 100;
        }

        // Cap delay
        delayMs = Math.min(5000, delayMs);

        this.log('debug', `⏱️ Delay: ${Math.round(delayMs)}ms (mem: ${Math.round(memPct)}%, cpu: ${Math.round(cpuPct)}%, health: ${this.state.health.status}, failures: ${this.state.health.consecutiveFailures}, children: ${this.state.children.length})`);
        await sleep(delayMs);
      } catch (error) {
        this.log('error', '💥 Iteration failed:', error);
        this.state.health.consecutiveFailures++;
        await this.recoveryProcedure(error);
      }
    }

    this.saveMemory();
    this.flushLogs();
  }

  private async initialize(): Promise<void> {
    console.log('INIT START'); // Debug
    await this.loadMemory();
    this.loadLogBuffer();
    if (this.workerPool) {
      await this.workerPool.initialize();
      this.log('info', '✅ WorkerPool initialized');
    }

    if (this.config.enableHealthChecks) {
      await this.updateHealthCheck();
    }
    console.log('INIT DONE'); // Debug
  }

  private async executeIteration(): Promise<void> {
    console.log('EXECUTE ITERATION', this.iterationCount); // Debug
    const startTime = Date.now();
    this.log('debug', `─── Iteration ${this.iterationCount + 1} ───`);

    // 1. Self-awareness
    await this.readSelf();

    // 2. Analysis
    // 2. Analysis (offload to worker pool after iteration 10)
    let analysis;
    if (this.workerPool && this.iterationCount >= 10) {
      this.log('info', '🧪 Offloading analysis to WorkerPool');
      try {
        const analyzerPath = path.resolve(__dirname, 'src', 'analyzer.ts');
        analysis = await this.workerPool!.execute(
          analyzerPath,
          'analyzeCode',
          [{ code: this.currentCode, iteration: this.iterationCount, level: this.state.level, capabilities: this.state.capabilities }]
        );
        this.log('info', '✅ WorkerPool analysis completed');
      } catch (e) {
        this.log('warn', 'WorkerPool analysis failed, fallback', e);
        analysis = await this.analyzeCurrentState();
      }
    } else {
      analysis = await this.analyzeCurrentState();
    }

    // 2.5 Self-Testing (Iteration 105+) - run unit tests before applying changes (every 10 iterations)
    if (this.iterationCount % 10 === 0) {
      try {
        const testResult = await this.testRunner.runAll();
        if (!testResult.success) {
          this.log('warn', '❌ Tests failed, skipping change application:', testResult.errors.slice(0, 3));
          // Skip applying changes this iteration
          return;
        }
        this.log('debug', '✅ Tests passed:', testResult.passed, '/', testResult.total);
      } catch (e) {
        this.log('warn', '⚠️ Test runner error:', e);
      }
    }

    // 3. Planning
    const plan = this.createEvolutionPlan(analysis);

    // 4. Improvement
    const improvedCode = await this.improveCode(plan);

    // 5. Validation
    const validation = await this.validateCode(improvedCode);

    if (validation.valid) {
      // 6. Apply
      await this.applyChanges(improvedCode, plan);

      // 7. Update metrics & state
      const duration = Date.now() - startTime;
      await this.updateMetrics(analysis, plan, duration);

      this.state.level = analysis.newLevel;

      // Add new capabilities
      const newCaps: string[] = [];
      for (const strength of analysis.strengths) {
        if (!this.state.capabilities.includes(strength)) {
          this.state.capabilities.push(strength);
          newCaps.push(strength);
        }
      }
      this.state.capabilities = [...new Set(this.state.capabilities)];
      if (newCaps.length > 0) {
        this.log('info', '✨ New capabilities:', newCaps.join(', '));
      }

      // Auto-create goals for weaknesses
      if (analysis.weaknesses.length > 0 && this.state.goals.length < 5) {
        const weakest = analysis.weaknesses[0];
        const goalDesc = `Improve: ${weakest}`;
        if (!this.state.goals.some(g => g.description === goalDesc && g.status !== 'completed')) {
          this.createGoal(goalDesc, 2, ['Analyze', 'Design', 'Implement', 'Test']);
        }
      }

      // Adaptive resource management
      this.adaptiveResourceManagement(analysis);

      // Auto-advance goals
      for (const goal of this.getActiveGoals()) {
        if (goal.description.startsWith('Improve:') && !analysis.weaknesses.includes(goal.description.replace('Improve: ', ''))) {
          this.advanceGoal(goal.id);
        }
      }

      // Periodic reports
      if (this.iterationCount % 5 === 0) {
        this.log('info', '📊 SUMMARY:');
        this.log('info', `   Iterations: ${this.iterationCount}`);
        this.log('info', `   Capabilities: ${this.state.capabilities.length}`);
        this.log('info', `   Goals: ${this.state.goals.filter(g => g.status === 'completed').length}/${this.state.goals.length}`);
        this.log('info', `   Children: ${this.state.children.length}`);
      }

      // Gossip
      if (this.config.enableOrchestration && this.iterationCount % 3 === 0) {
        this.gossip();
      }

      // Replication (only if healthy, low memory pressure, and low children count)
      if (this.config.enableReplication && this.state.level >= 2 && this.state.children.length < this.config.maxChildren && this.state.health.status === 'healthy') {
        const memUsage = getMemoryUsage();
        const memLimit = this.state.sandbox.resourceLimits.maxMemoryMB;
        const memHeadroom = 1 - (memUsage / memLimit);
        if (memHeadroom > 0.5 && Math.random() < 0.05) { // 5% chance, requires >50% memory headroom
          this.spawnChild();
        }
      }
    } else {
      this.log('warn', '❌ Validation failed:', validation.error);
    }

    // Health check
    if (this.config.enableHealthChecks) {
      await this.updateHealthCheck();
    }
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

    // Offloaded analysis for WorkerPool (Iteration 117+)
  // This is now a pure function executed in worker thread
  private async analyzeOffloaded(code: string, iteration: number, level: number, capabilities: string[]): Promise<any> {
    // Dynamic import of analyzer module (runs in worker thread)
    const { analyzeCode } = await import('./src/analyzer.ts');
    const result = await analyzeCode({ code, iteration, level, capabilities });
    // No logging here (worker thread)
    return result;
  }

    private readSelf(): Promise<void> {
    return new Promise((resolve, reject) => {
      const filePath = path.join(__dirname, 'evo.ts');
      try {
        const code = fs.readFileSync(filePath, 'utf-8');
        const hash = this.hashString(code);
        const lastHash = this.state.memory.get('lastCodeHash');
        if (lastHash === hash) {
          this.log('debug', '📖 Self-code unchanged (cached)');
        } else {
          this.state.memory.set('lastCodeHash', hash);
          this.log('trace', '📖 Self-code read. Size:', code.length);
        }
        this.currentCode = code;
        resolve();
      } catch (e) {
        const err = e as Error;
        this.log('error', `💔 Cannot read self: ${err.message}`);
        reject(new Error('Cannot read own source code'));
      }
    });
  }

  private async analyzeCurrentState(): Promise<{
    currentLevel: number;
    newLevel: number;
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    metrics: Partial<EvolutionMetrics>;
  }> {
    const code = this.currentCode;
    // Cleanup old cache entries if needed
    if (this.analysisCache.size > this.ANALYSIS_CACHE_MAX_SIZE) {
      this.cleanupAnalysisCache();
    }
    // Analysis result caching (Iteration 116) - cache by code hash
    const codeHash = this.hashString(code);
    const cached = this.analysisCache.get(codeHash);
    const now = Date.now();
    if (cached && (now - cached.timestamp) < this.ANALYSIS_CACHE_TTL_MS) {
      this.log('debug', '📦 Analysis cache hit (age:', Math.round((now-cached.timestamp)/1000), 's)');
      return cached.result;
    }

    const lines = code.split('\n').length;

        const features = {
      async: /async\s+/.test(code),
      errorHandling: /(try\s*\{|catch\s*\()/.test(code),
      persistentMemory: /(saveMemory|loadMemory|memoryPath)/.test(code),
      fileSystem: /(class FileSystem|fs\.readFileSync)/.test(code),
      replication: /(spawnChild|children)/.test(code),
      messaging: /(sendMessage|broadcast|Message)/.test(code),
      goals: /(createGoal|Goal)/.test(code),
      logging: /(logBuffer|flushLogs|logPath)/.test(code),
      planning: /(createEvolutionPlan|EvolutionPlan)/.test(code),
      health: /(HealthMonitor|healthMonitor|performHealthCheck)/.test(code),
      sandbox: /(validatePath|isWithinSandbox|FileSystem)/.test(code),
      security: /security|sandbox/i.test(code),
      stats: /(stats:|totalMessagesSent|MessageQueue)/.test(code),
      documentation: /\/\*\*[\s\S]*?\*\//.test(code) || (/\bJSDoc\b/i.test(code)),
      testing: /(describe\(|it\(|test\(|expect\()/.test(code) || /(TestRunner|testRunner)/.test(code),
      modularization: /(private|public|protected)\s+\w+\s*\(/.test(code) && (code.match(/class/g) || []).length > 1,
      concurrency: /(Worker|cluster|Thread|Promise\.all|async\s+\w+\s*\()/.test(code),
      selfTesting: /(TestRunner|testRunner\.runAll)/.test(code),
      astTransformation: /(ASTTransformer|astTransformer|transform)/.test(code),
      'worker-pool': /(WorkerPool|workerPool)/.test(code),
      'distributed-coordination': /(WorkerPool|workerPool|cluster)/.test(code),
      reflection: /(Reflect|Proxy|Object\.defineProperty)/.test(code),
      optimization: /(performance|optimize|tune)/.test(code),
      'security-hardening': /(CSP|helmet|security)/i.test(code),
      monitoring: /(monitor|metrics|telemetry)/.test(code),
      'load-balancing': /(roundRobin|loadBalance|balance)/.test(code),
      'fault-tolerance': /(retry|circuitBreaker|fallback)/.test(code),
      'dynamic-reconfiguration': /(reconfigure|hotReload|dynamic)/.test(code),
      'multi-tenancy': /(tenant|isolate)/.test(code),
      'api-gateway': /(gateway|router)/.test(code),
      'stream-processing': /(createReadStream|createWriteStream|pipeline)/.test(code),
      cryptography: /(crypto|md5|sha|cipher)/.test(code),
      compression: /(compress|gzip|deflate)/.test(code),
      serialization: /(JSON\.stringify|serialize|deserialize)/.test(code),
      'config-management': /(config|settings|env)/.test(code)
    };


    const strengths = Object.entries(features)
      .filter(([_, v]) => v)
      .map(([k, _]) => this.formatFeatureName(k));

    const weaknesses = Object.entries(features)
      .filter(([_, v]) => !v)
      .map(([k, _]) => this.formatFeatureName(k));

    const featureCount = Object.values(features).filter(v => v).length;
    const newLevel = Math.min(200, featureCount + Math.floor(this.state.level * 0.5));

    const metrics: Partial<EvolutionMetrics> = {
      iteration: this.iterationCount + 1,
      level: newLevel,
      capabilities: [...new Set([...this.state.capabilities, ...strengths])],
      performance: {
        memoryUsage: getMemoryUsage(),
        cpuTime: getCpuTime(),
        uptime: getUptime()
      },
      codeQuality: {
        linesOfCode: lines,
        complexity: this.estimateComplexityFromCode()
      },
      bugsFixed: weaknesses.length,
      regressions: 0,
      timestamp: nowISO(),
      health: this.state.health.status
    };

    // Store in cache
    this.analysisCache.set(codeHash, { result: { currentLevel: this.state.level, newLevel, strengths, weaknesses, opportunities: this.generateOpportunities(weaknesses), metrics }, timestamp: Date.now() });
    return { currentLevel: this.state.level, newLevel, strengths, weaknesses, opportunities: this.generateOpportunities(weaknesses), metrics };
  }

  private cleanupAnalysisCache(): void {
    const now = Date.now();
    const expiredHashes: string[] = [];
    for (const [hash, entry] of this.analysisCache.entries()) {
      if (now - entry.timestamp > this.ANALYSIS_CACHE_TTL_MS) {
        expiredHashes.push(hash);
      }
    }
    for (const hash of expiredHashes) {
      this.analysisCache.delete(hash);
    }
    if (expiredHashes.length > 0) {
      this.log('debug', '🧹 Cleaned analysis cache:', expiredHashes.length, 'entries');
    }
    // If still too large, remove oldest entries
    if (this.analysisCache.size > this.ANALYSIS_CACHE_MAX_SIZE) {
      const sorted = Array.from(this.analysisCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = sorted.slice(0, this.analysisCache.size - this.ANALYSIS_CACHE_MAX_SIZE);
      for (const [hash] of toRemove) {
        this.analysisCache.delete(hash);
      }
      this.log('debug', '🧹 trimmed analysis cache to max size:', this.analysisCache.size);
    }
  }

  private formatFeatureName(key: string): string {
    const names: Record<string, string> = {
      async: 'async operations',
      errorHandling: 'error handling',
      persistentMemory: 'persistent memory',
      fileSystem: 'file system',
      replication: 'self-replication',
      messaging: 'inter-agent messaging',
      goals: 'goal management',
      logging: 'advanced logging',
      planning: 'planning',
      health: 'health monitoring',
      sandbox: 'sandboxing',
      security: 'security',
      stats: 'statistics',
      documentation: 'code documentation',
      testing: 'unit testing',
      modularization: 'modular architecture',
      concurrency: 'concurrency support'
    };
    return names[key] || key;
  }

  private generateOpportunities(weaknesses: string[]): string[] {
    const opps: Record<string, string> = {
      'async operations': 'Convert sync operations to async/await',
      'error handling': 'Add comprehensive try-catch blocks',
      'persistent memory': 'Implement file-based persistence',
      'file system': 'Create FileSystem abstraction with validation',
      'self-replication': 'Add spawnChild() with resource limits',
      'inter-agent messaging': 'Implement Message passing with TTL',
      'goal management': 'Add goal tracking with dependencies',
      'advanced logging': 'Buffer logs and write to file',
      'planning': 'Improve evolution plan generation',
      'health monitoring': 'Add health checks and auto-recovery',
      'sandboxing': 'Enforce file system sandbox',
      'security': 'Add permission checks',
      'statistics': 'Track stats like messages, goals, children',
      'code documentation': 'Add JSDoc comments for all public APIs',
      'unit testing': 'Create test suite for core components',
      'modular architecture': 'Extract large classes into modules',
      'concurrency support': 'Add worker threads for parallel tasks'
    };
    const opportunities = weaknesses.map(w => opps[w] || `Improve ${w}`).filter(Boolean);
    if (opportunities.length === 0) {
      opportunities.push('Refactor for modularity');
      opportunities.push('Optimize performance');
    }
    return opportunities;
  }

  private estimateComplexityFromCode(): number {
    const code = this.currentCode;
    let c = 0;
    c += (code.match(/\bif\s*\(/g) || []).length;
    c += (code.match(/\bfor\s*\(/g) || []).length * 1.5;
    c += (code.match(/\bwhile\s*\(/g) || []).length * 1.5;
    c += (code.match(/\basync\s+\w+\s*\(/g) || []).length * 2;
    c += (code.match(/\bclass\s+\w+/g) || []).length * 3;
    return Math.min(10, Math.max(1, Math.round(c / 20)));
  }

  private getRiskLevel(complexity: number, changesCount: number): 'low' | 'medium' | 'high' | 'critical' {
    if (complexity >= 8 || changesCount > 10) return 'critical';
    if (complexity >= 6 || changesCount > 5) return 'high';
    if (complexity >= 4 || changesCount > 2) return 'medium';
    return 'low';
  }

  private createEvolutionPlan(analysis: ReturnType<this['analyzeCurrentState']>): EvolutionPlan {
    const strategy = this.config.evolutionStrategy;
    const opportunities = analysis.opportunities;

    let selectedOpportunity: string;
    if (opportunities.length === 0) {
      selectedOpportunity = 'Refactor for better code organization';
    } else if (strategy === 'conservative') {
      selectedOpportunity = opportunities[0];
    } else if (strategy === 'aggressive' && opportunities.length > 1) {
      selectedOpportunity = opportunities[1];
    } else if (strategy === 'experimental' && opportunities.length > 2) {
      selectedOpportunity = opportunities[Math.floor(Math.random() * Math.min(3, opportunities.length))];
    } else {
      selectedOpportunity = opportunities[0];
    }

    const changes = this.generateChangesForOpportunity(selectedOpportunity);
    const complexity = this.estimateComplexityFromCode();
    const riskLevel = this.getRiskLevel(complexity, changes.length);

    let rollbackPlan: string[] = [];
    if (riskLevel !== 'low') {
      rollbackPlan = ['Restore from latest backup', 'Reset state'];
      if (riskLevel === 'critical') {
        rollbackPlan.push('Terminate children', 'Clear recent history');
      }
    }

    return {
      targetLevel: analysis.newLevel,
      opportunity: selectedOpportunity,
      priority: opportunities.indexOf(selectedOpportunity) + 1,
      totalOpportunities: opportunities.length,
      estimatedComplexity: complexity,
      requiresNewDependencies: false,
      changes,
      riskLevel,
      rollbackPlan
    };
  }

  private generateChangesForOpportunity(opportunity: string): string[] {
    const changes: string[] = [];
    if (opportunity.includes('persistent') || opportunity.includes('file-based persistence')) {
      changes.push('Enhance saveMemory/loadMemory JSON serialization');
      changes.push('Add compression for state data');
    }
    if (opportunity.includes('FileSystem') || opportunity.includes('abstraction')) {
      changes.push('Add path validation and sandboxing to FileSystem');
      changes.push('Add file access auditing');
    }
    if (opportunity.includes('Replicate') || opportunity.includes('spawnChild')) {
      changes.push('Add resource allocation for child agents');
      changes.push('Add parent-child relationship tracking');
      changes.push('Implement child health monitoring');
    }
    if (opportunity.includes('messaging') || opportunity.includes('Message')) {
      changes.push('Add message TTL and priority');
      changes.push('Implement message queue size limits');
      changes.push('Add message routing and filtering');
    }
    if (opportunity.includes('goal') || opportunity.includes('Goal')) {
      changes.push('Add goal dependencies');
      changes.push('Add goal priority sorting');
      changes.push('Implement goal progress tracking');
    }
    if (opportunity.includes('logging') || opportunity.includes('log')) {
      changes.push('Add log rotation');
      changes.push('Add structured logging (JSON)');
    }
    if (opportunity.includes('health') || opportunity.includes('monitoring')) {
      changes.push('Add memory pressure tracking');
      changes.push('Implement auto-recovery actions');
      changes.push('Add metrics collection intervals');
    }
    if (opportunity.includes('documentation')) {
      changes.push('Add JSDoc comments for all public classes and methods');
      changes.push('Generate API documentation automatically');
      changes.push('Add code examples in comments');
    }
    if (opportunity.includes('testing')) {
      changes.push('Create unit test stubs for EvoAgent core');
      changes.push('Add integration tests for persistence');
      changes.push('Implement test runner integration');
    }
    if (opportunity.includes('modular')) {
      changes.push('Split large classes into separate modules');
      changes.push('Create index.ts barrel exports');
      changes.push('Add internal module boundaries');
    }
    if (opportunity.includes('concurrency')) {
      changes.push('Add Worker threads for background tasks');
      changes.push('Implement thread pool for message processing');
      changes.push('Add async bulk operations');
    }
    return changes;
  }

  private async improveCode(plan: EvolutionPlan): Promise<string> {
    this.log('debug', '🔧 Applying improvement:', plan.opportunity, 'Risk:', plan.riskLevel);

    let newCode = this.currentCode;

    // Update level comment
    newCode = newCode.replace(
      /\/\* Last updated: .* \*\//,
      `/* Last updated: 2026-05-13T12:37:18.667Z */`
    );

    // Add iteration changelog
    const changelog = `// Iteration ${this.iterationCount + 1}: ${plan.changes.length} changes (${plan.opportunity}) [${plan.riskLevel}]`;
    if (!newCode.includes(changelog)) {
      newCode = newCode.replace(
        /(\/\/ Features: .*)/,
        `$1\n${changelog}`
      );
    }
    // AST transformation (Iteration 112 - aggressive after iteration 10)
    if (this.iterationCount >= 10) {
      try {
        const transformResult = await this.astTransformer.analyzeAndTransform(newCode, this.iterationCount);
        if (transformResult.success) {
          newCode = transformResult.transformedCode;
          this.log('info', '🔨 AST transformations:', transformResult.changes.join('; '));
        }
      } catch (e) {
        this.log('warn', 'AST transform error:', e);
      }
    }

    return newCode;
  }

  private async validateCode(code: string): Promise<{ valid: boolean; error?: string }> {
    try {
      if (!code.includes('class EvoAgent')) return { valid: false, error: 'Missing EvoAgent class' };
      if (!code.includes('async run()')) return { valid: false, error: 'Missing run method' };
      if (!code.includes('executeIteration')) return { valid: false, error: 'Missing executeIteration method' };
      if (code.split('\n').length < 100) return { valid: false, error: 'Code too short, likely truncated' };
      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }

  private async applyChanges(newCode: string, plan: EvolutionPlan): Promise<void> {
    if (this.config.backupBeforeEvolve) {
      const backupPath = path.join(__dirname, `evo.ts.backup.${Date.now()}`);
      try {
        fs.copyFileSync(path.join(__dirname, 'evo.ts'), backupPath);
        this.log('trace', '📦 Backup created:', path.basename(backupPath));
        // Rotate
        const backups = fs.readdirSync(__dirname)
          .filter(f => f.startsWith('evo.ts.backup.') && f.endsWith('.ts'))
          .map(f => ({ name: f, time: fs.statSync(path.join(__dirname, f)).mtimeMs }))
          .sort((a, b) => b.time - a.time)
          .slice(5)
          .map(f => f.name);
        for (const old of backups) {
          try { fs.unlinkSync(path.join(__dirname, old)); } catch {}
        }
      } catch (e) {
        this.log('warn', 'Backup failed:', e);
      }
    }

    fs.writeFileSync(path.join(__dirname, 'evo.ts'), newCode);
    this.currentCode = newCode;
    this.log('info', '💾 Code updated');

    // Update state
    for (const change of plan.changes) {
      if (change.includes('persistent')) this.state.capabilities.push('persistent-memory');
      if (change.includes('FileSystem')) this.state.capabilities.push('file-system');
      if (change.includes('Replicate')) this.state.capabilities.push('self-replication');
      if (change.includes('messaging')) this.state.capabilities.push('messaging');
      if (change.includes('goal')) this.state.capabilities.push('goal-management');
      if (change.includes('logging')) this.state.capabilities.push('advanced-logging');
    }
    this.state.capabilities = [...new Set(this.state.capabilities)];
    this.saveMemory();
  }

  private async updateMetrics(analysis: ReturnType<this['analyzeCurrentState']>, plan: EvolutionPlan, duration: number): Promise<void> {
    const metric: EvolutionMetrics = {
      iteration: this.iterationCount + 1,
      level: analysis.newLevel,
      capabilities: this.state.capabilities,
      performance: {
        memoryUsage: getMemoryUsage(),
        cpuTime: getCpuTime(),
        uptime: getUptime(),
        successRate: analysis.newLevel > analysis.currentLevel ? 100 : 80
      },
      codeQuality: {
        linesOfCode: analysis.metrics.codeQuality?.linesOfCode || 0,
        complexity: analysis.metrics.codeQuality?.complexity || 1
      },
      changes: plan.changes,
      bugsFixed: analysis.metrics.bugsFixed || 0,
      regressions: 0,
      timestamp: nowISO(),
      health: this.state.health.status
    };

    this.state.history.push(metric);
    this.saveMemory();
    this.log('debug', '📈 Metrics recorded', { level: metric.level, mem: metric.performance.memoryUsage });
  }

  private async processMessages(): Promise<void> {
    // Expire old messages in the queue
    this.messageQueue.expire(60000); // 60 seconds
  }

  private adaptiveResourceManagement(analysis: ReturnType<this['analyzeCurrentState']>): void {
    const memUsage = getMemoryUsage();
    const memLimit = this.state.sandbox.resourceLimits.maxMemoryMB;
    const memHeadroom = 1 - (memUsage / memLimit);

    // Aggressive cleanup when memory pressure is high
    if (memHeadroom < 0.3 && this.state.children.length > 0) {
      // Prioritize keeping oldest/most stable children (first few), terminate newer ones
      const toTerminate = Math.max(1, Math.floor(this.state.children.length * 0.5)); // Terminate half if under pressure
      const terminated = this.state.children.slice(-toTerminate); // remove newest
      for (const childId of terminated) {
        this.log('warn', '📉 Terminating child due to memory pressure:', childId);
        this.state.children = this.state.children.filter(id => id !== childId);
      }
    }

    // Update dynamic limit based on average recent memory
    const recentMem = this.state.history.slice(-5).map(h => h.performance.memoryUsage);
    if (recentMem.length === 5) {
      const avg = recentMem.reduce((a, b) => a + b, 0) / 5;
      if (avg < memLimit * 0.6) {
        this.state.sandbox.resourceLimits.maxMemoryMB = Math.max(40, Math.min(200, avg * 1.5)); // cap at 200MB
      }
    }
  }

  private async recoveryProcedure(error: any): Promise<void> {
    this.log('warn', '🔄 Recovery procedure started after error:', error);
    await this.sleep(2000);
    this.log('info', '✅ Recovery completed, resuming iteration');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Graceful shutdown
  public shutdown(): void {
    this.isRunning = false;
    this.saveMemory().catch(console.error);
    this.flushLogs();
    this.log('info', '🛑 Agent shutting down');
    // Decrement global agent counter
    if (EvoAgent.totalAgents > 0) {
      EvoAgent.totalAgents--;
    }
    // Notify parent to remove this child
    if (this.parent) {
      this.parent.removeChild(this.id);
    }
  }

  // Called by parent to remove child reference
  public removeChild(childId: string): void {
    this.state.children = this.state.children.filter(id => id !== childId);
    this.saveMemory().catch(() => {});
    this.log('debug', '🗑️ Removed child reference:', childId);
  }
}

// ==================== ENTRY POINT ====================

if (import.meta.main) {
  try { require('fs').appendFileSync('/tmp/evo-entry.log', 'ENTRY MAIN\n'); } catch {}
  let agent;
  try {
    agent = new EvoAgent({ evolutionStrategy: 'balanced' });
    try { require('fs').appendFileSync('/tmp/evo-created.log', 'CREATED\n'); } catch {}


  } catch (e) {
    process.stderr.write('❌ Agent creation failed: ' + e + '\n');
    process.exit(1);
  }
  // Handle shutdown signals
  process.on('SIGINT', () => agent.shutdown());
  process.on('SIGTERM', () => agent.shutdown());
  agent.run().catch(err => {
    process.stderr.write('Agent failed: ' + err + '\n');
    process.exit(1);
  });
}

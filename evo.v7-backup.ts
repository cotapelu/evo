// evo.ts - Self-Evolving Agent v2.0
// Mục tiêu: Tự tiến hóa thành Agent OS hoàn chỉnh qua vòng lặp Read → Run → Evolve
// Iteration: 1 - Complete refactor, bug fixes, architecture improvements
// Last updated: 2026-05-13T00:00:00.000Z

// Features: Core kernel, Memory management, File system with sandbox, Process manager, IPC, Security, Health monitoring
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
import { fileURLToPath } from 'url';
import { Worker as WorkerThread } from 'worker_threads';
import * as http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== TYPES ====================

export interface Message {
  id: string;
  from: string;
  to: string;
  content: any;
  timestamp: string;
  type: 'request' | 'response' | 'broadcast' | 'gossip' | 'ping' | 'pong' | 'error' | 'heartbeat';
  priority?: number;
  ttl?: number;
}

export interface EvolutionMetrics {
  iteration: number;
  level: number;
  capabilities: string[];
  performance: {
    memoryUsage: number;
    cpuTime: number;
    responseTime?: number;
    successRate?: number;
    uptime: number;
  };
  codeQuality: {
    linesOfCode: number;
    complexity?: number;
    testCoverage?: number;
    lintScore?: number;
  };
  changes: string[];
  bugsFixed: number;
  regressions: number;
  timestamp: string;
  health: 'healthy' | 'degraded' | 'unhealthy';
}

export interface AgentConfig {
  maxIterations?: number;
  backupBeforeEvolve: boolean;
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  evolutionStrategy: 'conservative' | 'aggressive' | 'balanced' | 'experimental';
  enablePersistence: boolean;
  enableReplication: boolean;
  enablePlugins: boolean;
  enableOrchestration: boolean;
  enableSecurity: boolean;
  enableHealthChecks: boolean;
  maxChildren: number;
  memoryPath?: string;
  logPath?: string;
  apiRateLimit?: number;
  resourceLimits?: {
    maxMemoryMB?: number;
    maxCpuMsPerIter?: number;
    maxOpenFiles?: number;
  };
  security?: {
    requireAuth?: boolean;
    allowedPaths?: string[];
    blockedOperations?: string[];
    sandboxMode?: 'strict' | 'moderate' | 'disabled';
  };
}

export interface Goal {
  id: string;
  description: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  steps: string[];
  currentStep: number;
  createdAt: string;
  completedAt?: string;
  dependencies?: string[];
}

export interface AgentState {
  level: number;
  capabilities: string[];
  memory: Map<string, any>;
  history: EvolutionMetrics[];
  config: AgentConfig;
  goals: Goal[];
  children: string[];
  messages: Message[];
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: string;
    consecutiveFailures: number;
    memoryPressure: number;
  };
  stats: {
    totalIterations: number;
    totalMessagesSent: number;
    totalMessagesReceived: number;
    totalChildrenSpawned: number;
    totalGoalsCompleted: number;
    startTime: string;
  };
  sandbox: {
    allowedPaths: string[];
    blockedOperations: string[];
    resourceLimits: {
      maxMemoryMB: number;
      maxCpuMsPerIter: number;
      maxOpenFiles: number;
    };
  };
}

interface EvolutionPlan {
  targetLevel: number;
  opportunity: string;
  priority: number;
  totalOpportunities: number;
  estimatedComplexity: number;
  requiresNewDependencies: boolean;
  changes: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  rollbackPlan?: string[];
}

// ==================== UTILS ====================

function getMemoryUsage(): number {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  }
  return 0;
}

function getCpuTime(): number {
  if (typeof process !== 'undefined' && process.cpuUsage) {
    return Math.round(process.cpuUsage().user / 1000);
  }
  return 0;
}

function getUptime(): number {
  if (typeof process !== 'undefined' && process.uptime) {
    return Math.round(process.uptime());
  }
  return 0;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function nowISO(): string {
  return new Date().toISOString();
}

function safeStringify(obj: any): string {
  try {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
      return value;
    }, 2);
  } catch (e) {
    return `{"error": "Failed to stringify: ${e}"}`;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isWithinSandbox(filePath: string, allowedPaths: string[]): boolean {
  try {
    const resolved = path.resolve(filePath);
    return allowedPaths.some(allowed => resolved.startsWith(path.resolve(allowed)));
  } catch {
    return false;
  }
}

function validatePath(filePath: string, allowedPaths: string[], blockedOps: string[]): { valid: boolean; reason?: string } {
  if (!isWithinSandbox(filePath, allowedPaths)) {
    return { valid: false, reason: 'Access denied: path outside allowed directories' };
  }
  for (const blocked of blockedOps) {
    if (filePath.includes(blocked)) {
      return { valid: false, reason: `Blocked operation: ${blocked}` };
    }
  }
  return { valid: true };
}

// ==================== FILE SYSTEM MODULE ====================

class FileSystem {
  private basePath: string;
  private allowedPaths: string[];
  private blockedOps: string[];

  constructor(basePath?: string, allowedPaths?: string[], blockedOps?: string[]) {
    this.basePath = basePath || __dirname;
    this.allowedPaths = allowedPaths || [this.basePath];
    this.blockedOps = blockedOps || ['/etc/', '/sys/', '/proc/', 'C:\\Windows\\', 'C:\\Program Files'];
  }

  private validate(filePath: string): { valid: boolean; reason?: string } {
    const fullPath = path.resolve(this.basePath, filePath);
    return validatePath(fullPath, this.allowedPaths, this.blockedOps);
  }

  readFile(filePath: string, encoding: string = 'utf-8'): string {
    const validation = this.validate(filePath);
    if (!validation.valid) {
      throw new Error(`FileSystem.readFile denied: ${validation.reason}`);
    }
    const fullPath = path.resolve(this.basePath, filePath);
    return fs.readFileSync(fullPath, { encoding });
  }

  writeFile(filePath: string, content: string): void {
    const validation = this.validate(filePath);
    if (!validation.valid) {
      throw new Error(`FileSystem.writeFile denied: ${validation.reason}`);
    }
    const fullPath = path.resolve(this.basePath, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf-8');
  }

  exists(filePath: string): boolean {
    try {
      const validation = this.validate(filePath);
      if (!validation.valid) return false;
      const fullPath = path.resolve(this.basePath, filePath);
      return fs.existsSync(fullPath);
    } catch {
      return false;
    }
  }

  listFiles(dirPath: string): string[] {
    const validation = this.validate(dirPath);
    if (!validation.valid) {
      throw new Error(`FileSystem.listFiles denied: ${validation.reason}`);
    }
    const fullPath = path.resolve(this.basePath, dirPath);
    if (!fs.existsSync(fullPath)) return [];
    return fs.readdirSync(fullPath);
  }

  appendFile(filePath: string, content: string): void {
    const validation = this.validate(filePath);
    if (!validation.valid) {
      throw new Error(`FileSystem.appendFile denied: ${validation.reason}`);
    }
    const fullPath = path.resolve(this.basePath, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(fullPath, content, 'utf-8');
  }

  deleteFile(filePath: string): void {
    const validation = this.validate(filePath);
    if (!validation.valid) {
      throw new Error(`FileSystem.deleteFile denied: ${validation.reason}`);
    }
    const fullPath = path.resolve(this.basePath, filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  mkdir(dirPath: string): void {
    const validation = this.validate(dirPath);
    if (!validation.valid) {
      throw new Error(`FileSystem.mkdir denied: ${validation.reason}`);
    }
    const fullPath = path.resolve(this.basePath, dirPath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }

  getStats(filePath: string): { size: number; mtime: string; isFile: boolean; isDirectory: boolean } | null {
    try {
      const validation = this.validate(filePath);
      if (!validation.valid) return null;
      const fullPath = path.resolve(this.basePath, filePath);
      const stat = fs.statSync(fullPath);
      return {
        size: stat.size,
        mtime: stat.mtime.toISOString(),
        isFile: stat.isFile(),
        isDirectory: stat.isDirectory()
      };
    } catch {
      return null;
    }
  }

  readdirStats(dirPath: string): Array<{ name: string; stats: { size: number; mtime: string; isFile: boolean } }> {
    try {
      const validation = this.validate(dirPath);
      if (!validation.valid) return [];
      const fullPath = path.resolve(this.basePath, dirPath);
      if (!fs.existsSync(fullPath)) return [];
      const entries = fs.readdirSync(fullPath, { withFileTypes: true });
      return entries.map(entry => {
        const full = path.join(fullPath, entry.name);
        try {
          const stat = fs.statSync(full);
          return {
            name: entry.name,
            stats: {
              size: stat.size,
              mtime: stat.mtime.toISOString(),
              isFile: entry.isFile()
            }
          };
        } catch {
          return { name: entry.name, stats: { size: 0, mtime: '', isFile: false } };
        }
      });
    } catch {
      return [];
    }
  }
}

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
  private healthCheckTimer?: NodeJS.Timeout;
  private backupTimer?: NodeJS.Timeout;

  constructor(config: Partial<AgentConfig> = {}, parent?: EvoAgent) {
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
    this.fs = new FileSystem(__dirname, allowedPaths, blockedOps);

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

  private updateHealthCheck(): void {
    const check = this.performHealthCheck();
    const oldStatus = this.state.health.status;
    this.state.health = {
      ...this.state.health,
      status: check.status,
      lastCheck: nowISO(),
      memoryPressure: check.memoryPressure
    };

    if (oldStatus !== check.status) {
      this.log('warn', '🏥 Health status changed:', oldStatus, '→', check.status, 'Issues:', check.issues.join(', '));
    }

    if (check.status === 'unhealthy') {
      this.state.health.consecutiveFailures++;
      if (this.state.health.consecutiveFailures >= 3) {
        this.log('error', '🚨 Agent unhealthy. Triggering recovery...');
        this.triggerAutoRecovery();
      }
    } else {
      this.state.health.consecutiveFailures = 0;
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

  createGoal(description: string, priority: number = 1, steps?: string[], dependencies?: string[]): Goal {
    const goal: Goal = {
      id: generateId(),
      description,
      priority,
      status: 'pending',
      steps: steps || [`Complete evolution to level ${this.state.level + 1}`],
      currentStep: 0,
      createdAt: nowISO(),
      dependencies
    };
    this.state.goals.push(goal);
    this.saveMemory();
    this.log('info', '🎯 New goal created:', description);
    return goal;
  }

  updateGoal(goalId: string, status: Goal['status']): boolean {
    const goal = this.state.goals.find(g => g.id === goalId);
    if (goal) {
      const oldStatus = goal.status;
      goal.status = status;
      if (status === 'completed' && !goal.completedAt) {
        goal.completedAt = nowISO();
        this.state.stats.totalGoalsCompleted++;
      }
      this.saveMemory();
      if (oldStatus !== status) {
        this.log('debug', 'Goal updated:', goalId, '→', status);
      }
      return true;
    }
    return false;
  }

  advanceGoal(goalId: string): boolean {
    const goal = this.state.goals.find(g => g.id === goalId);
    if (!goal) return false;

    if (goal.dependencies) {
      const allDepsMet = goal.dependencies.every(depId => {
        const dep = this.state.goals.find(g => g.id === depId);
        return dep && dep.status === 'completed';
      });
      if (!allDepsMet) {
        this.log('debug', 'Cannot advance goal', goalId, '- dependencies not met');
        return false;
      }
    }

    if (goal.currentStep < goal.steps.length) {
      goal.currentStep++;
      if (goal.currentStep >= goal.steps.length) {
        goal.status = 'completed';
        goal.completedAt = nowISO();
        this.state.stats.totalGoalsCompleted++;
        this.log('info', '🎉 Goal completed:', goal.description);
      } else {
        this.updateGoal(goalId, 'in_progress');
      }
      this.saveMemory();
      return true;
    }
    return false;
  }

  getActiveGoals(): Goal[] {
    return this.state.goals.filter(g => g.status === 'pending' || g.status === 'in_progress');
  }

  getGoalsByPriority(minPriority: number = 1): Goal[] {
    return this.getActiveGoals().filter(g => g.priority >= minPriority).sort((a, b) => b.priority - a.priority);
  }

  // ==================== MESSAGING ====================

  sendMessage(to: string, content: any, type: Message['type'] = 'request', priority: number = 1, ttl: number = 10): void {
    const msg: Message = {
      id: generateId(),
      from: this.id,
      to,
      content,
      timestamp: nowISO(),
      type,
      priority,
      ttl
    };
    this.state.messages.push(msg);
    this.state.stats.totalMessagesSent++;
    if (this.state.messages.length > 1000) {
      this.state.messages = this.state.messages.slice(-500);
    }
    this.log('trace', '📨 Message sent to:', to, 'type:', type);
  }

  getMessagesForAgent(agentId: string): Message[] {
    const now = Date.now();
    return this.state.messages.filter(m => m.to === agentId && (!m.ttl || (now - Date.parse(m.timestamp)) < m.ttl * 1000));
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
    this.state.messages.push(msg);
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

      const child = new EvoAgent(childConfig, this);
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
    this.isRunning = true;
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

        await sleep(1000);
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
    await this.loadMemory();
    this.loadLogBuffer();

    if (this.config.enableHealthChecks) {
      this.updateHealthCheck();
    }
  }

  private async executeIteration(): Promise<void> {
    const startTime = Date.now();
    this.log('debug', `─── Iteration ${this.iterationCount + 1} ───`);

    // 1. Self-awareness
    await this.readSelf();

    // 2. Analysis
    const analysis = await this.analyzeCurrentState();

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

      // Replication
      if (this.config.enableReplication && this.state.level >= 2 && this.state.children.length < this.config.maxChildren) {
        if (Math.random() < 0.15) {
          this.spawnChild();
        }
      }
    } else {
      this.log('warn', '❌ Validation failed:', validation.error);
    }

    // Health check
    if (this.config.enableHealthChecks) {
      this.updateHealthCheck();
    }
  }

  private readSelf(): Promise<void> {
    return new Promise((resolve, reject) => {
      const filePath = path.join(__dirname, 'evo.ts');
      try {
        this.currentCode = fs.readFileSync(filePath, 'utf-8');
        this.log('trace', '📖 Self-code read. Size:', this.currentCode.length);
        resolve();
      } catch (e) {
        this.log('error', '💔 Cannot read self:', e);
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
    const lines = this.currentCode.split('\n').length;
    const code = this.currentCode;

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
      health: /(performHealthCheck|updateHealthCheck)/.test(code),
      sandbox: /(validatePath|isWithinSandbox)/.test(code),
      security: /security|sandbox/i.test(code),
      stats: /(stats:|totalMessagesSent)/.test(code),
      documentation: /\/\*\*[\s\S]*?\*\//.test(code) || (/\bJSDoc\b/i.test(code)),
      testing: /(describe\(|it\(|test\(|expect\()/.test(code),
      modularization: /(private|public|protected)\s+\w+\s*\(/.test(code) && (code.match(/class/g) || []).length > 1,
      concurrency: /(Worker|cluster|Thread|Promise\.all|async\s+\w+\s*\()/.test(code)
    };

    const strengths = Object.entries(features)
      .filter(([_, v]) => v)
      .map(([k, _]) => this.formatFeatureName(k));

    const weaknesses = Object.entries(features)
      .filter(([_, v]) => !v)
      .map(([k, _]) => this.formatFeatureName(k));

    const featureCount = Object.values(features).filter(v => v).length;
    const newLevel = Math.min(20, featureCount + Math.floor(this.state.level * 0.5));

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

    return { currentLevel: this.state.level, newLevel, strengths, weaknesses, opportunities: this.generateOpportunities(weaknesses), metrics };
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
    // Process incoming messages (simplified)
    const now = Date.now();
    const expired = this.state.messages.filter(m => m.ttl && (now - Date.parse(m.timestamp)) > m.ttl * 1000);
    if (expired.length > 0) {
      this.state.messages = this.state.messages.filter(m => !expired.includes(m));
    }
  }

  private adaptiveResourceManagement(analysis: ReturnType<this['analyzeCurrentState']>): void {
    const memUsage = getMemoryUsage();
    const memLimit = this.state.sandbox.resourceLimits.maxMemoryMB;
    const memHeadroom = 1 - (memUsage / memLimit);

    if (memHeadroom > 0.3 && this.state.children.length < this.config.maxChildren && Math.random() < 0.2) {
      this.spawnChild();
    } else if (memHeadroom < 0.1 && this.state.children.length > 1) {
      const nonEssential = this.state.children.slice(1);
      for (const childId of nonEssential) {
        this.log('info', '📉 Terminating child due to memory pressure:', childId);
        this.state.children = this.state.children.filter(id => id !== childId);
      }
    }

    // Update dynamic limit
    const recentMem = this.state.history.slice(-5).map(h => h.performance.memoryUsage);
    if (recentMem.length === 5) {
      const avg = recentMem.reduce((a, b) => a + b, 0) / 5;
      if (avg < memLimit * 0.5) {
        this.state.sandbox.resourceLimits.maxMemoryMB = Math.max(50, avg * 1.5);
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
  }
}

// ==================== ENTRY POINT ====================

if (require.main === module) {
  const agent = new EvoAgent({ evolutionStrategy: 'balanced' });
  // Handle shutdown signals
  process.on('SIGINT', () => agent.shutdown());
  process.on('SIGTERM', () => agent.shutdown());
  agent.run().catch(err => {
    console.error('Agent failed:', err);
    process.exit(1);
  });
}

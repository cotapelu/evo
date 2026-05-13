// evo.ts - Self-Evolving Agent v2.0
// Mục tiêu: Tự tiến hóa thành Agent OS hoàn chỉnh qua vòng lặp Read → Run → Evolve
// Iteration: 1 - Bug fixes & architecture improvement
// Last updated: 2026-05-13T00:00:00.000Z

// Features: Core kernel, Memory management, File system, Process manager, IPC, Security sandbox, Health monitoring

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

export interface AgentState {
  level: number;
  capabilities: string[];
  memory: Map<string, any>;
  history: EvolutionMetrics[];
  config: AgentConfig;
  goals: Goal[];
  children: string[]; // IDs of spawned child agents
  messages: Message[];
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: string;
    consecutiveFailures: number;
    memoryPressure: number; // 0-1
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

export interface AgentConfig {
  maxIterations?: number;
  backupBeforeEvolve: boolean;
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  evolutionStrategy: 'conservative' | 'aggressive' | 'balanced' | 'experimental';
  enablePersistence: boolean;
  enableReplication: boolean;
  enableMetricsServer: boolean;
  enablePlugins: boolean;
  enableOrchestration: boolean;
  enableSecurity: boolean;
  enableHealthChecks: boolean;
  pluginsPath?: string;
  maxChildren: number;
  memoryPath?: string;
  logPath?: string;
  metricsPort?: number;
  apiRateLimit?: number; // requests per minute
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
  metrics?: Partial<EvolutionMetrics>;
  dependencies?: string[]; // other goal IDs that must complete first
}

// Alias for compatibility
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

function throttle<F extends (...args: any[]) => any>(fn: F, limit: number): F {
  let inThrottle = false;
  return function(this: any, ...args: Parameters<F>): ReturnType<F> | undefined {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  } as F;
}

function debounce<F extends (...args: any[]) => any>(fn: F, delay: number): F {
  let timer: NodeJS.Timeout | null = null;
  return function(this: any, ...args: Parameters<F>): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  } as F;
}

function isWithinSandbox(path: string, allowedPaths: string[]): boolean {
  try {
    const resolved = path.resolve(path);
    return allowedPaths.some(allowed => resolved.startsWith(path.resolve(allowed)));
  } catch {
    return false;
  }
}

function validatePath(filePath: string, allowedPaths: string[], blockedOps: string[]): { valid: boolean; reason?: string } {
  // Check if path is within allowed directories
  if (!isWithinSandbox(filePath, allowedPaths)) {
    return { valid: false, reason: 'Access denied: path outside allowed directories' };
  }
  // Check for blocked operations (e.g., system files)
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
    this.blockedOps = blockedOps || ['/etc/', '/sys/', '/proc/', 'C:\Windows\', 'C:\Program Files'];
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
    // Create directory if needed
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

    this.config = {
      backupBeforeEvolve: true,
      logLevel: (process.env.AGENT_LOG_LEVEL as any) || 'info',
      evolutionStrategy: 'balanced',
      enablePersistence: true,
      enableReplication: true,
      enableMetricsServer: process.env.AGENT_ENABLE_METRICS !== 'false',
      enablePlugins: true,
      enableOrchestration: true,
      maxChildren: parseInt(process.env.AGENT_MAX_CHILDREN || '5'),
      memoryPath: process.env.AGENT_MEMORY_PATH || 'memory.json',
      logPath: process.env.AGENT_LOG_PATH || 'agent.log',
      metricsPort: parseInt(process.env.AGENT_METRICS_PORT || '3456'),
      apiRateLimit: parseInt(process.env.AGENT_API_RATE_LIMIT || '60'),
      enableWebSocket: process.env.AGENT_ENABLE_WEBSOCKET !== 'false',
      webSocketPort: parseInt(process.env.AGENT_WEBSOCKET_PORT || '3457'),
      resourceLimits: {
        maxMemoryMB: parseInt(process.env.AGENT_RESOURCE_MAX_MEMORY || '50'),
        maxCpuMsPerIter: parseInt(process.env.AGENT_RESOURCE_MAX_CPU || '2000')
      },
      security: {
        requireAuth: process.env.AGENT_SECURITY_REQUIRE_AUTH === 'true',
        allowedPaths: process.env.AGENT_SECURITY_ALLOWED_PATHS ? process.env.AGENT_SECURITY_ALLOWED_PATHS.split(',') : [__dirname],
        blockedOperations: process.env.AGENT_SECURITY_BLOCKED_OPS ? process.env.AGENT_SECURITY_BLOCKED_OPS.split(',') : ['/etc/', '/sys/', '/proc/', 'C:\\Windows\\', 'C:\\Program Files'],
        sandboxMode: (process.env.AGENT_SECURITY_SANDBOX as any) || 'moderate'
      },
      ...config
    };
    // Validate config
    if (this.config.maxChildren <= 0) this.config.maxChildren = 5;
    if (!this.config.metricsPort) this.config.metricsPort = 3456;
    if (!this.config.webSocketPort) this.config.webSocketPort = 3457;

    // Initialize sandbox paths based on security config
    const allowedPaths = this.config.security?.allowedPaths || [__dirname];
    const blockedOps = this.config.security?.blockedOperations || ['/etc/', '/sys/', '/proc/', 'C:\Windows\', 'C:\Program Files'];

    this.fs = new FileSystem(__dirname, allowedPaths, blockedOps);

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
          maxOpenFiles: 100
        }
      }
    };

    this.currentCode = '';
  }

  // Initialize async resources (call after construction)
  public async initialize(): Promise<void> {
    // Load persisted data if exists
    if (this.config.enablePersistence) {
      await this.loadMemory();
      this.loadLogBuffer();
    }
    // Start metrics server if enabled
    if (this.config.enableMetricsServer) {
      this.startMetricsServer(this.config.metricsPort || 3456);
    }
    // Load plugins if enabled
    if (this.config.enablePlugins) {
      await this.loadPlugins().catch(e => this.log('error', 'Plugin loading failed:', e));
    }
    // Start WebSocket server if enabled
    if (this.config.enableWebSocket) {
      this.startWebSocketServer(this.config.webSocketPort);
    }
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

      // Buffer logs and persist if enabled
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

  // ==================== PERSISTENCE ====================

  private async saveMemory(): Promise<void> {
    if (!this.config.enablePersistence) return;
    const stateData = {
      level: this.state.level,
      capabilities: this.state.capabilities,
      memory: Array.from(this.state.memory.entries()),
      history: this.state.history.slice(-100), // Keep last 100 entries
      goals: this.state.goals,
      children: this.state.children,
      health: this.state.health,
      stats: this.state.stats
    };
    try {
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
      // Don't throw - persistence failures shouldn't crash the agent
    }
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
      // Initialize defaults if load fails
      this.state = {
        ...this.state,
        level: 0,
        capabilities: ['basic'],
        history: [],
        goals: [],
        children: []
      };
    }
  }

  private loadLogBuffer(): void {
    if (!this.config.logPath) return;
    try {
      if (this.fs.exists(this.config.logPath)) {
        const content = this.fs.readFile(this.config.logPath);
        const lines = content.split('\n');
        // Load last 50 lines
        this.logBuffer = lines.slice(-50).filter(l => l.trim());
      }
    } catch (e) {
      // Ignore log load errors
    }
  }

  // ==================== HEALTH MONITORING ====================

  private performHealthCheck(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    memoryPressure: number;
    issues: string[];
  } {
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
    
    // Check consecutive failures
    if (this.state.health.consecutiveFailures >= 3) {
      issues.push('Multiple consecutive failures');
    }
    
    const status: 'healthy' | 'degraded' | 'unhealthy' = issues.length === 0 ? 'healthy' : issues.some(i => i.includes('Critical')) ? 'unhealthy' : 'degraded';
    
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
    // Auto-recovery strategies
    this.log('info', '🔄 Starting auto-recovery...');
    
    // 1. Clear non-essential caches
    this.state.memory.forEach((value, key) => {
      if (key.startsWith('cache_') || key.startsWith('temp_')) {
        this.state.memory.delete(key);
      }
    });
    
    // 2. Force garbage collection hint (best effort)
    if (global.gc) {
      global.gc();
      this.log('info', 'GC triggered');
    }
    
    // 3. Reduce resource limits temporarily
    this.state.sandbox.resourceLimits.maxMemoryMB = Math.max(50, this.state.sandbox.resourceLimits.maxMemoryMB * 0.8);
    
    // 4. Save state to persist recovery point
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
    
    // Check dependencies
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
    // Limit message queue size
    if (this.state.messages.length > 1000) {
      this.state.messages = this.state.messages.slice(-500);
    }
    this.log('trace', '📨 Message sent to:', to, 'type:', type);
  }

  getMessagesForAgent(agentId: string): Message[] {
    // Filter out expired messages
    const now = Date.now();
    return this.state.messages.filter(m => m.to === agentId && (!m.ttl || (now - Date.parse(m.timestamp)) < m.ttl * 1000));
  }

  broadcast(content: any, priority: number = 1): void {
    const sentTo: string[] = [];
    for (const childId of this.state.children) {
      this.sendMessage(childId, content, 'broadcast', priority);
      sentTo.push(childId);
    }
    if (sentTo.length > 0) {
      this.log('debug', '📡 Broadcast sent to', sentTo.length, 'children');
    }
  }

  // Gossip protocol for distributed state sync
  gossip(): void {
    if (!this.config.enableOrchestration) return;
    const gossipMsg: Message = {
      from: this.id,
      to: 'broadcast',
      content: {
        type: 'gossip',
        level: this.state.level,
        capabilities: this.state.capabilities,
        children: this.state.children.length,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
      type: 'gossip'
    };
    this.broadcast(gossipMsg);
    this.log('debug', '🔊 Gossip sent');
  }

  receiveMessage(msg: Message): void {
    this.state.messages.push(msg);
    this.log('debug', '📥 Received message from:', msg.from);
    // Handle gossip
    if (msg.type === 'gossip' && this.config.enableOrchestration) {
      this.log('debug', '🔊 Gossip from', msg.from, 'level', msg.content.level);
    }
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
        enableMetricsServer: false, // Children don't start their own metrics server
        memoryPath: `memory-${generateId()}.json`,
        logPath: `agent-${generateId()}.log`,
        evolutionStrategy: this.config.evolutionStrategy,
        resourceLimits: {
          ...this.config.resourceLimits,
          maxMemoryMB: Math.floor((this.config.resourceLimits?.maxMemoryMB || 100) * 0.5), // Children get half resources
          maxCpuMsPerIter: Math.floor((this.config.resourceLimits?.maxCpuMsPerIter || 5000) * 0.5)
        }
      };

      const child = new EvoAgent(childConfig, this);
      this.state.children.push(child.id);
      this.state.stats.totalChildrenSpawned++;

      // Start child in background
      child.run().catch(e => {
        this.log('error', 'Child agent crashed:', child.id, e);
        this.state.children = this.state.children.filter(id => id !== child.id);
        this.state.health.consecutiveFailures++;
      });

      this.saveMemory();
      this.log('info', '👶 Spawned child agent:', child.id, 'Total children:', this.state.children.length);

      // Derive active goals for child
      const activeGoals = this.getActiveGoals().slice(0, 3); // Pass up to 3 goals
      for (const goal of activeGoals) {
        child.createGoal(`[DERIVED] ${goal.description}`, goal.priority, goal.steps);
      }

      return child;
    } catch (error) {
      this.log('error', 'Failed to spawn child:', error);
      return null;
    }
  }

  // ==================== CORE LOOP ====================

  async run(): Promise<void> {
    this.isRunning = true;
    this.log('info', '🚀 Starting Self-Evolution Loop...');
    this.log('info', 'Agent ID:', this.id);
    this.log('info', 'Parent:', this.parent?.id || 'none');

    // Initialize async resources
    await this.initialize();

    // Register self
    this.registerSelf();

    while (this.isRunning) {
      try {
        await this.executeIteration();
        this.iterationCount++;

        // Process incoming messages
        await this.processMessages();

        // Check stopping condition
        if (this.config.maxIterations && this.iterationCount >= this.config.maxIterations) {
          this.log('info', '✅ Reached max iterations. Shutting down.');
          break;
        }

        // Prevent tight loop
        await sleep(1000);

      } catch (error) {
        this.log('error', '💥 Iteration failed:', error);
        await this.recoveryProcedure(error);
      }
    }

    // Final save before exit
    this.saveMemory();
    this.flushLogs();
  }

  private registerSelf(): void {
    const registryFile = path.join(__dirname, 'agents registry.json');
    try {
      let registry: string[] = [];
      if (fs.existsSync(registryFile)) {
        registry = JSON.parse(fs.readFileSync(registryFile, 'utf-8'));
      }
      if (!registry.includes(this.id)) {
        registry.push(this.id);
        fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2));
        this.log('debug', 'Registered in agent registry');
      }
    } catch (e) {
      this.log('warn', 'Failed to register:', e);
    }
  }

  // ==================== EVOLUTION CYCLE ====================

  private async executeIteration(): Promise<void> {
    const startTime = Date.now();

    this.log('debug', `─── Iteration ${this.iterationCount + 1} ───`);

    // Phase 1: Self-Awareness (Read current code)
    await this.readSelf();

    // Phase 2: Analysis (Measure current state)
    const analysis = await this.analyzeCurrentState();

    // Phase 3: Evolution Planning
    const plan = this.createEvolutionPlan(analysis);

    // Phase 4: Self-Improvement
    const improvedCode = await this.improveCode(plan);

    // Phase 5: Validation
    const validation = await this.validateCode(improvedCode);

    if (validation.valid) {
      // Phase 6: Apply changes with backup
      await this.applyChanges(improvedCode, plan);

      // Phase 7: Update metrics
      await this.updateMetrics(analysis, plan, Date.now() - startTime);

      this.log('info', `✅ Iteration ${this.iterationCount + 1} completed. Level: ${analysis.currentLevel} → ${analysis.newLevel}`);
      this.state.level = analysis.newLevel;

      // Update capabilities from analysis
      const newCaps: string[] = [];
      for (const strength of analysis.strengths) {
        if (!this.state.capabilities.includes(strength)) {
          this.state.capabilities.push(strength);
          newCaps.push(strength);
        }
      }
      this.state.capabilities = [...new Set(this.state.capabilities)];
      if (newCaps.length > 0) {
        this.log('info', '✨ New capabilities acquired:', newCaps.join(', '));
      }

      // Auto-goal: create improvement goals from weaknesses
      if (analysis.weaknesses.length > 0 && this.state.goals.length < 5) {
        const weakest = analysis.weaknesses[0];
        const goalDesc = `Improve: ${weakest}`;
        if (!this.state.goals.some(g => g.description === goalDesc && g.status !== 'completed')) {
          this.createGoal(goalDesc, 2, [
            `Analyze ${weakest}`,
            `Design solution`,
            `Implement improvement`,
            `Test and verify`
          ]);
        }
      }

      // Adaptive resource management
      const memoryMB = getMemoryUsage();
      const cpuTime = getCpuTime();
      const memoryLimit = this.config.resourceLimits?.maxMemoryMB || (this.state.memory.get('memoryLimit') as number) || 100;
      const cpuLimit = this.config.resourceLimits?.maxCpuMsPerIter || 5000;

      // Check resource exhaustion
      if (memoryMB > memoryLimit * 0.9) {
        this.log('warn', '⚠️ Memory near limit:', memoryMB, 'MB /', memoryLimit);
        if (memoryMB > memoryLimit) {
          this.log('warn', '⛔ Memory limit exceeded, skipping evolution this iteration');
          return;
        }
      }
      if (cpuTime > cpuLimit * 0.9) {
        this.log('warn', '⚠️ CPU time near limit:', cpuTime, 'ms /', cpuLimit);
      }

      // Adaptive scaling
      if (this.config.enableOrchestration) {
        const memoryHeadroom = 1 - (memoryMB / memoryLimit);
        if (memoryHeadroom > 0.3 && this.state.children.length < this.config.maxChildren && Math.random() < 0.2) {
          this.spawnChild();
        } else if (memoryHeadroom < 0.1 && this.state.children.length > 1) {
          const nonEssential = this.state.children.filter(id => !this.state.goals.some(g => g.id === id));
          if (nonEssential.length > 1) {
            const toTerminate = nonEssential[0];
            this.log('info', '📉 Resource pressure: terminating child', toTerminate);
            this.state.children = this.state.children.filter(id => id !== toTerminate);
            this.state.capabilities.push('adaptive-scaling');
          }
        }
      }

      // Update dynamic memory limit
      const recentMem = this.state.history.slice(-5).map(h => h.performance.memoryUsage);
      if (recentMem.length === 5) {
        const avgMem = recentMem.reduce((a, b) => a + b, 0) / 5;
        if (avgMem < (memoryLimit * 0.5)) {
          this.state.memory.set('memoryLimit', Math.max(50, avgMem * 1.5));
        }
      }

      // Auto-rollback if severe memory leak detected
      if (memoryMB > memoryLimit * 1.5) {
        this.log('error', '🚨 CRITICAL: Memory limit exceeded by >50%. Triggering auto-rollback...');
        this.state.capabilities.push('auto-rollback');
        await this.performRollback();
        return; // Skip this iteration after rollback
      }

      // Performance regression detection
      const baseline = this.state.memory.get('baseline') as { memory: number; cpu: number } | undefined;
      if (baseline && this.iterationCount > 5) {
        const memIncrease = (memoryMB - baseline.memory) / baseline.memory;
        const cpuIncrease = (cpuTime - baseline.cpu) / baseline.cpu;
        if (memIncrease > 0.1) {
          this.log('warn', '📉 Memory regression:', Math.round(memIncrease*100)+'%');
        }
        if (cpuIncrease > 0.1) {
          this.log('warn', '📉 CPU regression:', Math.round(cpuIncrease*100)+'%');
        }
      }
      // Update baseline every 10 iterations
      if (this.iterationCount % 10 === 0 && this.iterationCount > 0) {
        const recent = this.state.history.slice(-10);
        const avgMem = recent.reduce((sum, m) => sum + m.performance.memoryUsage, 0) / recent.length;
        const avgCpu = recent.reduce((sum, m) => sum + m.performance.cpuTime, 0) / recent.length;
        this.state.memory.set('baseline', { memory: avgMem, cpu: avgCpu });
        this.log('info', '📊 Baseline updated:', { mem: Math.round(avgMem)+'MB', cpu: Math.round(avgCpu)+'ms' });
      }
      // Performance chart (simple text)
      this.log('info', `📈 Perf: Mem=${memoryMB}MB CPU=${cpuTime}ms Lvl=${this.state.level} Goals=${this.state.goals.length}`);

      // Auto-advance goals based on progress
      for (const goal of this.getActiveGoals()) {
        // Goal about improvement weakness: advance if weakness resolved
        if (goal.description.startsWith('Improve:')) {
          const weakness = goal.description.replace('Improve: ', '').trim();
          if (!analysis.weaknesses.includes(weakness)) {
            this.advanceGoal(goal.id);
          }
        }
        // Goal about reaching a level: advance if level reached
        if (goal.description.includes('Level') && this.state.level >= (parseInt(goal.steps[goal.steps.length-1].match(/\d+/) || [0])[0])) {
          this.advanceGoal(goal.id);
        }
      }

      // Periodic summary report every 5 iterations
      if (this.iterationCount % 5 === 0) {
        this.log('info', '📊 SUMMARY:');
        this.log('info', `   Iterations: ${this.iterationCount}`);
        this.log('info', `   Capabilities: ${this.state.capabilities.length}`);
        this.log('info', `   Goals completed: ${this.state.goals.filter(g => g.status === 'completed').length}/${this.state.goals.length}`);
        this.log('info', `   Children spawned: ${this.state.children.length}`);
        this.log('info', `   Memory entries: ${this.state.memory.size}`);
      }

      // Gossip to other agents periodically
      if (this.config.enableOrchestration && this.iterationCount % 3 === 0) {
        this.gossip();
      }

      // Replication check - spawn in-process child
      if (this.config.enableReplication && this.state.level >= 2 && this.state.children.length < this.config.maxChildren) {
        if (Math.random() < 0.15) { // 15% chance per iteration
          const child = this.spawnChild();
          if (child) {
            this.log('info', '👶 New child agent spawned:', child.id);
            // Derive active goals
            for (const goal of this.getActiveGoals()) {
              child.createGoal(`[DERIVED] ${goal.description}`, goal.priority, goal.steps);
            }
          }
        }
      }
    } else {
      this.log('warn', '❌ Validation failed, skipping this iteration:', validation.error);
    }
  }

  // ==================== PHASE 1: SELF-AWARENESS ====================

  private async readSelf(): Promise<void> {
    const filePath = path.join(__dirname, 'evo.ts');
    try {
      this.currentCode = fs.readFileSync(filePath, 'utf-8');
      this.log('trace', '📖 Self-code read. Size:', this.currentCode.length, 'bytes');
    } catch (error) {
      this.log('error', '💔 Cannot read self:', error);
      throw new Error('Cannot read own source code');
    }
  }

  // ==================== PHASE 2: ANALYSIS ====================

  private async analyzeCurrentState(): Promise<{
    currentLevel: number;
    newLevel: number;
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    metrics: Partial<EvolutionMetrics>;
  }> {
    const lines = this.currentCode.split('\n').length;
    const capabilities = this.state.capabilities;

    // Analyze code features
    const hasPersistentMemory = /(saveMemory|loadMemory|memoryPath)/.test(this.currentCode);
    const hasFileSystem = /(class FileSystem|fs\.readFileSync|fs\.writeFileSync)/.test(this.currentCode);
    const hasReplication = /(spawnChild|children)/.test(this.currentCode);
    const hasMessaging = /(sendMessage|broadcast|Message)/.test(this.currentCode);
    const hasGoals = /(createGoal|Goal)/.test(this.currentCode);
    const hasAdvancedLogging = /(logBuffer|flushLogs|logPath)/.test(this.currentCode);
    const hasAsync = /async\s+/.test(this.currentCode);
    const hasErrorHandling = /(try\s*\{|catch\s*\()/.test(this.currentCode);
    const hasPlanning = /(createEvolutionPlan|EvolutionPlan)/.test(this.currentCode);
    const hasHealthMonitoring = /(performHealthCheck|updateHealthCheck)/.test(this.currentCode);
    const hasSandbox = /(validatePath|isWithinSandbox)/.test(this.currentCode);
    const hasSecurity = /security|sandbox/i.test(this.currentCode);
    const hasStats = /(stats:|totalMessagesSent)/.test(this.currentCode);

    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (hasAsync) strengths.push('async operations');
    else weaknesses.push('lacks async support');

    if (hasErrorHandling) strengths.push('error handling');
    else weaknesses.push('no error handling');

    if (hasPersistentMemory) strengths.push('persistent memory');
    else weaknesses.push('memory not persistent');

    if (hasFileSystem) strengths.push('file system module');
    else weaknesses.push('no file system abstraction');

    if (hasReplication) strengths.push('self-replication');
    else weaknesses.push('cannot spawn children');

    if (hasMessaging) strengths.push('inter-agent messaging');
    else weaknesses.push('no messaging');

    if (hasGoals) strengths.push('goal management');
    else weaknesses.push('no goal system');

    if (hasAdvancedLogging) strengths.push('advanced logging');
    else weaknesses.push('basic logging only');

    if (hasPlanning) strengths.push('planning system');
    else weaknesses.push('no planning');

    if (hasHealthMonitoring) strengths.push('health monitoring');
    else weaknesses.push('no health monitoring');

    if (hasSandbox) strengths.push('sandboxed file system');
    else weaknesses.push('no sandbox protection');

    if (hasSecurity) strengths.push('security controls');
    else weaknesses.push('minimal security');

    if (hasStats) strengths.push('comprehensive statistics');
    else weaknesses.push('limited statistics');

    // Calculate new level based on features
    const features = [
      hasAsync, hasErrorHandling, hasPersistentMemory, hasFileSystem,
      hasReplication, hasMessaging, hasGoals, hasAdvancedLogging, hasPlanning,
      hasHealthMonitoring, hasSandbox, hasSecurity, hasStats
    ];
    const featureCount = features.filter(f => f).length;
    const newLevel = Math.min(15, featureCount + Math.floor(this.state.level * 0.3));

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
      changes: [],
      bugsFixed: weaknesses.length,
      regressions: 0,
      timestamp: nowISO(),
      health: this.state.health.status
    };

    return {
      currentLevel: this.state.level,
      newLevel,
      strengths,
      weaknesses,
      opportunities: this.generateOpportunities(weaknesses),
      metrics
    };
  }

  private generateOpportunities(weaknesses: string[]): string[] {
    const opportunities: string[] = [];
    if (weaknesses.some(w => w.includes('persistent'))) {
      opportunities.push('Implement persistent memory with file storage');
    }
    if (weaknesses.some(w => w.includes('file system'))) {
      opportunities.push('Create FileSystem abstraction layer');
    }
    if (weaknesses.some(w => w.includes('replication'))) {
      opportunities.push('Add spawnChild method to create new agents');
    }
    if (weaknesses.some(w => w.includes('messaging'))) {
      opportunities.push('Implement inter-agent messaging');
    }
    if (weaknesses.some(w => w.includes('goal'))) {
      opportunities.push('Add goal management system');
    }
    if (weaknesses.some(w => w.includes('logging'))) {
      opportunities.push('Enhance logging with file output and buffering');
    }
    if (weaknesses.some(w => w.includes('planning'))) {
      opportunities.push('Improve evolution planning');
    }
    if (weaknesses.some(w => w.includes('async'))) {
      opportunities.push('Convert sync operations to async');
    }
    if (weaknesses.some(w => w.includes('error'))) {
      opportunities.push('Add comprehensive error recovery');
    }
    if (weaknesses.some(w => w.includes('health'))) {
      opportunities.push('Implement health monitoring and auto-recovery');
    }
    if (weaknesses.some(w => w.includes('sandbox'))) {
      opportunities.push('Add file system sandboxing');
    }
    if (weaknesses.some(w => w.includes('security'))) {
      opportunities.push('Add security controls and permission checks');
    }
    if (weaknesses.some(w => w.includes('statistics'))) {
      opportunities.push('Track comprehensive statistics');
    }
    if (opportunities.length === 0) {
      opportunities.push('Optimize performance and refactor code');
      opportunities.push('Improve code modularity');
      opportunities.push('Add more comprehensive tests');
    }
    return opportunities;
  }

  private estimateComplexityFromCode(): number {
    const code = this.currentCode;
    let complexity = 0;
    // Count control structures
    complexity += (code.match(/\bif\s*\(/g) || []).length;
    complexity += (code.match(/\belse\s*\{?/g) || []).length * 0.5;
    complexity += (code.match(/\bfor\s*\(/g) || []).length * 1.5;
    complexity += (code.match(/\bwhile\s*\(/g) || []).length * 1.5;
    complexity += (code.match(/\bswitch\s*\(/g) || []).length * 2;
    // Count functions
    complexity += (code.match(/\basync\s+\w+\s*\(/g) || []).length * 2;
    complexity += (code.match(/\bfunction\s+\w+/g) || []).length;
    complexity += (code.match(/\w+\s*\(\s*[^)]+\)\s*\{/g) || []).length * 0.5;
    // Count classes
    complexity += (code.match(/\bclass\s+\w+/g) || []).length * 3;
    // Normalize to 1-10 scale
    return Math.min(10, Math.max(1, Math.round(complexity / 20)));
  }

  private getRiskLevel(complexity: number, changesCount: number): 'low' | 'medium' | 'high' | 'critical' {
    if (complexity >= 8 || changesCount > 10) return 'critical';
    if (complexity >= 6 || changesCount > 5) return 'high';
    if (complexity >= 4 || changesCount > 2) return 'medium';
    return 'low';
  }

  // ==================== PHASE 3: PLANNING ====================

  private createEvolutionPlan(analysis: ReturnType<this['analyzeCurrentState']>): EvolutionPlan {
    const strategy = this.config.evolutionStrategy;
    const opportunities = analysis.opportunities;

    let selectedOpportunity: string;
    if (opportunities.length === 0) {
      selectedOpportunity = 'Refactor for better code organization and performance';
    } else if (strategy === 'conservative') {
      selectedOpportunity = opportunities[0];
    } else if (strategy === 'aggressive' && opportunities.length > 1) {
      selectedOpportunity = opportunities[Math.min(1, opportunities.length - 1)];
    } else {
      selectedOpportunity = opportunities[0];
    }

    const plan: EvolutionPlan = {
      targetLevel: analysis.newLevel,
      opportunity: selectedOpportunity,
      priority: opportunities.indexOf(selectedOpportunity) + 1,
      totalOpportunities: opportunities.length,
      estimatedComplexity: this.estimateComplexity(selectedOpportunity),
      requiresNewDependencies: false,
      changes: []
    };

    // Generate specific changes
    if (selectedOpportunity.includes('persistent memory') || selectedOpportunity.includes('file storage')) {
      plan.changes.push('Add saveMemory()/loadMemory() with JSON serialization');
      plan.changes.push('Store memory to disk on each iteration');
      plan.changes.push('Add memoryPath config');
    }
    if (selectedOpportunity.includes('FileSystem')) {
      plan.changes.push('Create FileSystem class wrapper');
      plan.changes.push('Add methods: readFile, writeFile, exists, listFiles');
    }
    if (selectedOpportunity.includes('replication')) {
      plan.changes.push('Add spawnChild() method');
      plan.changes.push('Track children in state.children');
      plan.changes.push('Add maxChildren limit');
    }
    if (selectedOpportunity.includes('messaging')) {
      plan.changes.push('Define Message interface');
      plan.changes.push('Add sendMessage() and broadcast()');
      plan.changes.push('Store messages in state.messages');
    }
    if (selectedOpportunity.includes('goal')) {
      plan.changes.push('Define Goal interface');
      plan.changes.push('Add createGoal(), updateGoal(), advanceGoal()');
      plan.changes.push('Persist goals with memory');
    }
    if (selectedOpportunity.includes('logging')) {
      plan.changes.push('Add log buffer and logPath config');
      plan.changes.push('Implement flushLogs() method');
      plan.changes.push('Write logs to file periodically');
    }

    return plan;
  }

  private estimateComplexity(opportunity: string): number {
    if (opportunity.includes('replication')) return 4;
    if (opportunity.includes('messaging')) return 3;
    if (opportunity.includes('FileSystem')) return 2;
    if (opportunity.includes('persistent memory')) return 2;
    if (opportunity.includes('goal')) return 3;
    return 1;
  }

  // ==================== PHASE 4: IMPROVEMENT ====================

  private async improveCode(plan: EvolutionPlan): Promise<string> {
    this.log('debug', '🔧 Applying improvement:', plan.opportunity);

    let newCode = this.currentCode;

    // Apply transformations
    for (const change of plan.changes) {
      newCode = this.applyTransformation(newCode, change);
    }

    // Auto-increment level if needed
    if (plan.targetLevel > this.state.level) {
      const levelPattern = /level:\s*(\d+)/;
      newCode = newCode.replace(levelPattern, `level: ${plan.targetLevel}`);
    }

    // Update timestamp comment
    const timestamp = new Date().toISOString();
    newCode = newCode.replace(
      /\/\* Last updated: .* \*\//,
      `/* Last updated: 2026-05-12T15:32:46.773Z */`
    );

    // Add changelog entry
    if (plan.changes.length > 0) {
      const changeLogEntry = `// Iteration ${this.iterationCount + 1}: Added ${plan.changes.length} improvements (${plan.opportunity})`;
      // Insert after the initial comment block
      newCode = newCode.replace(
        /(\/\/ evo\.ts - Self-Evolving Agent[\s\S]*?\/\/ Mục tiêu:[\s\S]*?\n)/,
        `$1${changeLogEntry}\n`
      );
    }

    return newCode;
  }

  private applyTransformation(code: string, change: string): string {
    // Use safe template string construction
    if (change.includes('FileSystem')) {
      if (!code.includes('class FileSystem')) {
        const fsClass = `

class FileSystem {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || __dirname;
  }

  readFile(filePath: string, encoding: string = 'utf-8'): string {
    const fullPath = path.resolve(this.basePath, filePath);
    return fs.readFileSync(fullPath, { encoding });
  }

  writeFile(filePath: string, content: string): void {
    const fullPath = path.resolve(this.basePath, filePath);
    fs.writeFileSync(fullPath, content, 'utf-8');
  }

  exists(filePath: string): boolean {
    const fullPath = path.resolve(this.basePath, filePath);
    return fs.existsSync(fullPath);
  }

  listFiles(dirPath: string): string[] {
    const fullPath = path.resolve(this.basePath, dirPath);
    if (!fs.existsSync(fullPath)) return [];
    return fs.readdirSync(fullPath);
  }

  appendFile(filePath: string, content: string): void {
    const fullPath = path.resolve(this.basePath, filePath);
    fs.appendFileSync(fullPath, content, 'utf-8');
  }

  deleteFile(filePath: string): void {
    const fullPath = path.resolve(this.basePath, filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  mkdir(dirPath: string): void {
    const fullPath = path.resolve(this.basePath, dirPath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }
}`;
        // Insert before EvoAgent class
        code = code.replace(
          /export class EvoAgent/,
          fsClass + '\n\nexport class EvoAgent'
        );
      }
    }

    if (change.includes('saveMemory') && !code.includes('private saveMemory()')) {
      const methods = `

  private saveMemory(): void {
    if (!this.config.enablePersistence) return;
    try {
      const data = JSON.stringify({
        state: {
          level: this.state.level,
          capabilities: this.state.capabilities,
          memory: Array.from(this.state.memory.entries()),
          history: this.state.history,
          goals: this.state.goals,
          children: this.state.children
        },
        lastSaved: new Date().toISOString()
      }, null, 2);
      this.fs.writeFile(this.config.memoryPath || 'memory.json', data);
      this.log('debug', '💾 Memory saved');
    } catch (e) {
      this.log('error', 'Failed to save memory:', e);
    }
  }`;
      code = code.replace(
        /private loadMemory\(\)[\s\S]*?\n  \}/,
        `$&\n${methods}`
      );
    }

    if (change.includes('loadMemory') && !code.includes('private loadMemory()')) {

      const spawnMethod = `

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
        maxChildren: 3,
        enableReplication: true,
        enablePersistence: true,
        memoryPath: \`memory-\${generateId()}.json\`,
        logPath: \`agent-\${generateId()}.log\`
      };
      const child = new EvoAgent(childConfig, this);
      this.state.children.push(child.id);
      this.saveMemory();
      this.log('info', '👶 Spawned child agent:', child.id);
      // Start child in background
      child.run().catch(e => this.log('error', 'Child crashed:', e));
      return child;
    } catch (error) {
      this.log('error', 'Failed to spawn child:', error);
      return null;
    }
  }`;
      code = code.replace(
        /private log\([\s\S]*?\n  \}/,
        `$&\n${spawnMethod}`
      );
    }

    if (change.includes('messaging') && !code.includes('sendMessage(')) {
      const msgTypes = `

export interface Message {
  from: string;
  to: string;
  content: any;
  timestamp: string;
  type: 'request' | 'response' | 'broadcast';
}`;
      if (!code.includes('interface Message')) {
        code = code.replace(
          /export interface EvolutionPlan/,
          msgTypes + '\n\nexport interface EvolutionPlan'
        );
      }

      const messagingMethods = `

  sendMessage(to: string, content: any, type: Message['type'] = 'request'): void {
    const msg: Message = {
      from: this.id,
      to,
      content,
      timestamp: new Date().toISOString(),
      type
    };
    this.state.messages.push(msg);
    this.log('debug', '📨 Message sent to:', to);
  }

  getMessagesForAgent(agentId: string): Message[] {
    return this.state.messages.filter(m => m.to === agentId);
  }

  broadcast(content: any): void {
    for (const childId of this.state.children) {
      this.sendMessage(childId, content, 'broadcast');
    }
  }`;
      code = code.replace(
        /private saveMemory\(\)[\s\S]*?\n  \}/,
        `$&\n${messagingMethods}`
      );
    }

    if (change.includes('goal') && !code.includes('createGoal(')) {
      const goalInterface = `

export interface Goal {
  id: string;
  description: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  steps: string[];
  currentStep: number;
  createdAt: string;
}`;
      if (!code.includes('interface Goal')) {
        code = code.replace(
          /export interface Message/,
          goalInterface + '\n\nexport interface Message'
        );
      }

      const goalMethods = `

  createGoal(description: string, priority: number = 1, steps?: string[]): Goal {
    const goal: Goal = {
      id: generateId(),
      description,
      priority,
      status: 'pending',
      steps: steps || [\`Complete evolution to level \${this.state.level + 1}\`],
      currentStep: 0,
      createdAt: new Date().toISOString()
    };
    this.state.goals.push(goal);
    this.saveMemory();
    this.log('info', '🎯 New goal created:', description);
    return goal;
  }

  updateGoal(goalId: string, status: Goal['status']): boolean {
    const goal = this.state.goals.find(g => g.id === goalId);
    if (goal) {
      goal.status = status;
      this.saveMemory();
      return true;
    }
    return false;
  }

  advanceGoal(goalId: string): boolean {
    const goal = this.state.goals.find(g => g.id === goalId);
    if (goal && goal.currentStep < goal.steps.length) {
      goal.currentStep++;
      if (goal.currentStep >= goal.steps.length) {
        goal.status = 'completed';
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
  }`;
      code = code.replace(
        /private sendMessage[\s\S]*?\n  \}/,
        `$&\n${goalMethods}`
      );
    }

    if (change.includes('logging') && !code.includes('logBuffer:')) {
      // Add logBuffer to state and methods
      code = code.replace(
        /state: AgentState = {/,
        `state: AgentState = {\n      logBuffer: [],`
      );

      const flushMethod = `

  private flushLogs(): void {
    if (this.config.logPath && this.logBuffer.length > 0) {
      try {
        this.fs.appendFile(this.config.logPath, this.logBuffer.join('\\n') + '\\n');
        this.logBuffer = [];
      } catch (e) {
        console.error('Failed to write log file:', e);
      }
    }
  }`;
      code = code.replace(
        /private log\([\s\S]*?\n  \}/,
        `$&\n${flushMethod}`
      );

      // Add loadLogBuffer method
      const loadLogMethod = `

  private loadLogBuffer(): void {
    if (!this.config.logPath) return;
    try {
      if (this.fs.exists(this.config.logPath)) {
        const content = this.fs.readFile(this.config.logPath);
        const lines = content.split('\\n');
        this.logBuffer = lines.slice(-50).filter(l => l.trim());
      }
    } catch (e) {
      // Ignore log load errors
    }
  }`;
      code = code.replace(
        /this\.loadMemory\(\)[\s\S]*?\n  \}/,
        `$&\n${loadLogMethod}`
      );
    }

    return code;
  }

  // ==================== PHASE 5: VALIDATION ====================

  private async validateCode(code: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Minimal validation: ensure critical structure exists
      if (!code.includes('class EvoAgent')) {
        return { valid: false, error: 'Missing EvoAgent class' };
      }
      if (!code.includes('async run()')) {
        return { valid: false, error: 'Missing run method' };
      }
      if (!code.includes('executeIteration')) {
        return { valid: false, error: 'Missing executeIteration method' };
      }
      // Syntax errors will be caught by Node.js runtime and handled by recovery
      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }

  // ==================== PHASE 6: APPLY CHANGES ====================

  private async applyChanges(newCode: string, plan: EvolutionPlan): Promise<void> {
    const filePath = path.join(__dirname, 'evo.ts');

    if (this.config.backupBeforeEvolve) {
      const backupPath = path.join(__dirname, `evo.ts.backup.${Date.now()}`);
      fs.copyFileSync(filePath, backupPath);
      this.log('trace', '📦 Backup created:', path.basename(backupPath));
      // Rotate backups - keep only 5 most recent
      const backups = fs.readdirSync(__dirname)
        .filter(f => f.startsWith('evo.ts.backup.') && f.endsWith('.ts'))
        .map(f => ({ name: f, time: fs.statSync(path.join(__dirname, f)).mtimeMs }))
        .sort((a, b) => b.time - a.time)
        .slice(5)
        .map(f => f.name);
      for (const oldBackup of backups) {
        try { fs.unlinkSync(path.join(__dirname, oldBackup)); } catch {}
      }
    }

    fs.writeFileSync(filePath, newCode);
    this.currentCode = newCode;

    this.log('info', '💾 Changes applied. Code updated.');

    // Update state capabilities based on changes
    for (const change of plan.changes) {
      if (change.includes('persistent memory')) this.state.capabilities.push('persistent-memory');
      if (change.includes('FileSystem')) this.state.capabilities.push('file-system');
      if (change.includes('replication')) this.state.capabilities.push('self-replication');
      if (change.includes('messaging')) this.state.capabilities.push('inter-agent-messaging');
      if (change.includes('goal')) this.state.capabilities.push('goal-management');
      if (change.includes('logging')) this.state.capabilities.push('advanced-logging');
    }

    // Deduplicate
    this.state.capabilities = [...new Set(this.state.capabilities)];

    // Save memory with updated capabilities
    this.saveMemory();

    // Auto-generate documentation
    this.generateDocumentation();

    // Auto-generate simple tests
    this.generateTests();
  }

  // ==================== PHASE 7: METRICS ====================

  private async updateMetrics(
    analysis: ReturnType<this['analyzeCurrentState']>,
    plan: EvolutionPlan,
    duration: number
  ): Promise<void> {
    const metrics: EvolutionMetrics = {
      iteration: this.iterationCount + 1,
      level: analysis.newLevel,
      capabilities: [...this.state.capabilities],
      performance: {
        memoryUsage: getMemoryUsage(),
        cpuTime: getCpuTime()
      },
      codeQuality: {
        linesOfCode: analysis.metrics.codeQuality?.linesOfCode || 0
      },
      changes: plan.changes,
      bugsFixed: analysis.metrics.bugsFixed || 0,
      timestamp: new Date().toISOString()
    };

    this.state.history.push(metrics);
    this.log('debug', '📊 Metrics:', {
      level: metrics.level,
      loc: metrics.codeQuality.linesOfCode,
      capabilities: metrics.capabilities.length,
      changes: plan.changes.length
    });
  }

  // ==================== RECOVERY ====================

  private async recoveryProcedure(error: Error): Promise<void> {
    this.log('warn', '🔄 Starting recovery...');

    // Find latest backup
    const files = fs.readdirSync(__dirname).filter(f => f.startsWith('evo.ts.backup.'));
    if (files.length > 0) {
      files.sort();
      const latestBackup = files[files.length - 1];
      const backupPath = path.join(__dirname, latestBackup);

      try {
        fs.copyFileSync(backupPath, path.join(__dirname, 'evo.ts'));
        this.log('info', '✅ Restored from backup:', latestBackup);
        await this.readSelf();
        // Reset iteration count? Keep going
      } catch (restoreError) {
        this.log('error', '💔 Failed to restore from backup:', restoreError);
        await this.createEmergencyAgent();
      }
    } else {
      this.log('error', '💔 No backup found. Creating emergency agent...');
      await this.createEmergencyAgent();
    }

    await sleep(2000);
  }

  private async createEmergencyAgent(): Promise<void> {
    const emergencyCode = `// evo.ts - Emergency Minimal Agent v0.0.1
// Auto-generated by recovery system at ${new Date().toISOString()}

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function generateId(): string {
  return \`\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class EvoAgent {
  readonly id: string = generateId();
  state: { level: number; capabilities: string[]; memory: Map<string, any> };

  constructor() {
    this.state = {
      level: 0,
      capabilities: ['minimal'],
      memory: new Map()
    };
  }

  async run(): Promise<void> {
    console.log('[EMERGENCY] Agent', this.id, 'running. Level:', this.state.level);
    // Minimal loop - will be improved
  }
}

if (import.meta.main) {
  const agent = new EvoAgent();
  agent.run().catch(console.error);
}
`;
    fs.writeFileSync(path.join(__dirname, 'evo.ts'), emergencyCode);
    this.log('error', 'Emergency agent written. Please manually restart.');
  }

  // ==================== MESSAGE API ====================

  receiveMessage(msg: Message): void {
    this.state.messages.push(msg);
    this.log('debug', '📥 Received message from:', msg.from);
  }

  // ==================== MESSAGE PROCESSING ====================

  private async processMessages(): Promise<void> {
    const myMessages = this.state.messages.filter(m => m.to === this.id);
    for (const msg of myMessages) {
      this.log('debug', '📩 Received message from:', msg.from, 'type:', msg.type);
      // Process message based on type
      if (msg.content.type === 'welcome') {
        this.log('info', '👋 Welcome received from parent level:', msg.content.parentLevel);
      }
      // Remove processed message
      this.state.messages = this.state.messages.filter(m => m !== msg);
    }
  }

  // ==================== DOCUMENTATION & TESTS ====================

  private generateDocumentation(): void {
    const docs = `# Agent Documentation

**Agent ID:** ${this.id}
**Current Level:** ${this.state.level}
**Capabilities:** ${this.state.capabilities.join(', ')}
**Uptime:** ${this.iterationCount} iterations

## Capabilities

${this.state.capabilities.map(c => `- **${c}**: Active`).join('\n')}

## Recent Metrics

${this.state.history.slice(-5).map(m => `- Iteration ${m.iteration}: Level ${m.level}, LOC ${m.codeQuality.linesOfCode}`).join('\n')}

## Goals

${this.state.goals.length > 0 ? this.state.goals.map(g => `- [${g.status.toUpperCase()}] ${g.description} (Step ${g.currentStep}/${g.steps.length})`).join('\n') : 'No active goals'}

## Children

${this.state.children.length > 0 ? this.state.children.map(c => `- Child Agent: ${c}`).join('\n') : 'No child agents'}

---
*Auto-generated by EvoAgent on ${new Date().toISOString()}*`;
    this.fs.writeFile('AGENT.md', docs);
    this.log('info', '📄 Documentation generated');
  }

  private generateTests(): void {
    const testContent = `// Auto-generated test suite for EvoAgent v0.3
// Generated: ${new Date().toISOString()}

import { EvoAgent } from './evo';

describe('EvoAgent Basic Tests', () => {
  test('agent can be instantiated', () => {
    const agent = new EvoAgent({ maxIterations: 1 });
    expect(agent).toBeInstanceOf(EvoAgent);
  });

  test('agent has required methods', () => {
    const agent = new EvoAgent();
    expect(typeof agent.run).toBe('function');
    expect(typeof agent.spawnChild).toBe('function');
    expect(typeof agent.sendMessage).toBe('function');
    expect(typeof agent.createGoal).toBe('function');
  });

  test('agent can create goals', () => {
    const agent = new EvoAgent();
    const goal = agent.createGoal('Test goal');
    expect(goal.description).toBe('Test goal');
    expect(agent.getActiveGoals()).toContainEqual(expect.objectContaining({ description: 'Test goal' }));
  });

  test('agent can spawn child', () => {
    const parent = new EvoAgent({ maxChildren: 2 });
    const child = parent.spawnChild();
    expect(child).toBeInstanceOf(EvoAgent);
    expect(parent.state.children).toHaveLength(1);
  });
});
`;
    // Only generate if test file doesn't exist
    if (!this.fs.exists('evo.test.auto.ts')) {
      this.fs.writeFile('evo.test.auto.ts', testContent);
      this.log('info', '🧪 Test suite generated');
    }
  }

  // ==================== SANDBOXED REPLICATION ====================

  spawnSandboxedChild(config?: Partial<AgentConfig>): string | null {
    if (!this.config.enableReplication) {
      this.log('warn', 'Sandbox replication disabled');
      return null;
    }
    if (this.state.children.length >= this.config.maxChildren) {
      this.log('warn', 'Max children limit reached');
      return null;
    }
    try {
      const childId = generateId();
      const childMemoryPath = `memory-${childId}.json`;
      const childLogPath = `agent-${childId}.log`;

      // Create a minimal worker script on the fly
      const workerScript = `
import { parentPort, workerData } from 'worker_threads';
import { EvoAgent } from './evo';

(async () => {
  const config = workerData.config;
  const parentId = workerData.parentId;
  const agent = new EvoAgent(config);

  // Override ID
  agent.id = workerData.agentId;

  // Send ready message to parent
  if (parentPort) {
    parentPort.postMessage({ type: 'ready', agentId: agent.id, parentId });
  }

  // Listen for messages
  if (parentPort) {
    parentPort.on('message', (msg) => {
      if (msg.type === 'goal-sync') {
        agent.createGoal(msg.goal.description, msg.goal.priority, msg.goal.steps);
      }
    });
  }

  // Run agent
  try {
    await agent.run();
  } catch (e) {
    console.error('Worker agent error:', e);
  }
})();
`;

      const workerPath = path.join(__dirname, `worker-${childId}.js`);
      fs.writeFileSync(workerPath, workerScript, 'utf-8');

      const worker = new WorkerThread(workerPath, {
        workerData: {
          config: {
            ...config,
            maxChildren: 2,
            enableReplication: true,
            enablePersistence: true,
            memoryPath: childMemoryPath,
            logPath: childLogPath,
            logLevel: 'info'
          },
          parentId: this.id,
          agentId: childId
        }
      });

      // Track worker
      this.state.children.push(childId);
      this.state.memory.set(`worker-${childId}`, { worker, path: workerPath });
      this.saveMemory();

      // Handle worker messages
      worker.on('message', (msg) => {
        if (msg.type === 'ready') {
          this.log('info', '👶 Sandboxed child ready:', msg.agentId);
        }
      });

      worker.on('error', (err) => {
        this.log('error', 'Worker error:', err);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          this.log('warn', 'Worker exited with code', code);
        }
        // Cleanup
        this.state.children = this.state.children.filter(id => id !== childId);
        this.state.memory.delete(`worker-${childId}`);
        try { fs.unlinkSync(workerPath); } catch {}
        this.saveMemory();
      });

      this.log('info', '👶 Spawned sandboxed child:', childId);
      return childId;
    } catch (error) {
      this.log('error', 'Failed to spawn sandboxed child:', error);
      return null;
    }
  }

  // ==================== PLUGIN SYSTEM ====================

  private async loadPlugins(): Promise<void> {
    if (!this.config.enablePlugins) return;
    const pluginsDir = this.config.pluginsPath || 'plugins';
    const fullPath = path.resolve(__dirname, pluginsDir);
    try {
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        this.log('info', '📁 Plugins directory created:', fullPath);
        return;
      }
      const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.js') || f.endsWith('.ts'));
      for (const file of files) {
        try {
          const filePath = path.join(pluginsDir, file);
          const absolutePath = path.resolve(fullPath, file);
          const plugin = await import(pathToFileURL(absolutePath).href);
          if (plugin.default || plugin.load) {
            if (plugin.default) await plugin.default(this);
            if (plugin.load) await plugin.load(this);
            this.log('info', '🔌 Plugin loaded:', file);
          }
        } catch (e) {
          this.log('error', 'Failed to load plugin', file, e);
        }
      }
    } catch (e) {
      this.log('warn', 'Plugins error:', e);
    }
  }

  // ==================== AUTO-ROLLBACK ====================

  private async performRollback(): Promise<void> {
    this.log('warn', '🔄 Initiating rollback to previous stable version...');
    const files = fs.readdirSync(__dirname).filter(f => f.startsWith('evo.ts.backup.') && f.endsWith('.ts'));
    if (files.length >= 2) {
      const sorted = files.map(f => ({ name: f, time: fs.statSync(path.join(__dirname, f)).mtimeMs }))
        .sort((a, b) => b.time - a.time);
      const rollbackTarget = sorted[1].name;
      try {
        fs.copyFileSync(path.join(__dirname, rollbackTarget), path.join(__dirname, 'evo.ts'));
        this.log('info', '✅ Rollback successful to:', rollbackTarget);
        await this.readSelf();
        this.state.memory.clear();
        this.saveMemory();
      } catch (e) {
        this.log('error', '💔 Rollback failed:', e);
      }
    } else {
      this.log('error', 'No backup available for rollback');
    }
  }

  // ==================== HTTP METRICS SERVER ====================

  private metricsServer?: http.Server;

  private getHealthStatus(): 'healthy' | 'degraded' | 'critical' {
    const memMB = getMemoryUsage();
    const memLimit = this.config.resourceLimits?.maxMemoryMB || (this.state.memory.get('memoryLimit') as number) || 100;
    const memPct = memMB / memLimit;
    if (memPct > 0.9) return 'critical';
    if (memPct > 0.7) return 'degraded';
    // Check recent failures
    const recentFailures = this.state.history.slice(-10).filter(h => h.bugsFixed > 0).length;
    if (recentFailures > 3) return 'degraded';
    return 'healthy';
  }

  startMetricsServer(port: number = 3456): void {
    this.metricsServer = http.createServer((req, res) => {
      // Security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      // Simple rate limiting (in-memory)
      const now = Date.now();
      const windowStart = now - 60000; // 1 minute window
      const requests = this.state.memory.get('api-requests') as {time: number}[] || [];
      const recent = requests.filter(r => r.time > windowStart);
      if (recent.length >= (this.config.apiRateLimit || 60)) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
        return;
      }
      recent.push({ time: now });
      this.state.memory.set('api-requests', recent);
      // Clean expired entries periodically
      if (recent.length > 100) {
        this.state.memory.set('api-requests', recent.slice(-50));
      }
      // CORS handling
      if (this.config.security?.allowedOrigins) {
        res.setHeader('Access-Control-Allow-Origin', this.config.security.allowedOrigins.join(','));
      }
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }
      // Content type
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/metrics') {
        const metrics = {
          id: this.id,
          level: this.state.level,
          capabilities: this.state.capabilities,
          memory: {
            usage: process.memoryUsage(),
            entries: this.state.memory.size
          },
          goals: this.state.goals.map(g => ({ id: g.id, description: g.description, status: g.status, step: g.currentStep })),
          children: this.state.children.length,
          iterations: this.iterationCount,
          uptime: process.uptime(),
          timestamp: new Date().toISOString()
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(metrics, null, 2));
      } else if (req.url === '/health') {
        const health = {
          status: this.getHealthStatus(),
          level: this.state.level,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          children: this.state.children.length,
          goals: this.state.goals.filter(g => g.status === 'in_progress').length
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(health, null, 2));
      } else if (req.url === '/diagnostic') {
        const diagnostic = {
          timestamp: new Date().toISOString(),
          code: {
            lines: this.currentCode ? this.currentCode.split('\n').length : 0,
            syntaxCheck: 'async-implied' // Can't await in sync context
          },
          state: {
            level: this.state.level,
            capabilities: this.state.capabilities,
            historyLength: this.state.history.length
          },
          config: {
            enablePlugins: this.config.enablePlugins,
            enableOrchestration: this.config.enableOrchestration
          }
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(diagnostic, null, 2));
      } else if (req.url === '/shutdown' && req.method === 'POST') {
        this.shutdown();
        res.writeHead(200);
        res.end('Shutting down');
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });
    this.metricsServer.listen(port, () => {
      this.log('info', '🌐 Metrics server listening on port', port);
    });
    this.metricsServer.on('error', (err) => this.log('error', 'Metrics server error:', err));
  }

  stopMetricsServer(): void {
    this.metricsServer?.close(() => {
      this.log('info', '🌐 Metrics server stopped');
    });
  }

  // ==================== WEBSOCKET SERVER ====================

  startWebSocketServer(port: number = this.config.webSocketPort || 3457): void {
    if (!this.config.enableWebSocket) return;
    const wss = new WebSocketServer({ port });
    this.wsServer = wss;
    wss.on('connection', (ws, req) => {
      this.log('debug', '🔌 WebSocket client connected');
      this.wsClients.add(ws);
      // Send initial state
      this.sendWsMessage(ws, {
        type: 'connected',
        data: { id: this.id, level: this.state.level, uptime: process.uptime() }
      });
      ws.on('close', () => {
        this.wsClients.delete(ws);
        this.log('debug', '🔌 WebSocket client disconnected');
      });
      ws.on('error', (err) => this.log('error', 'WebSocket error:', err));
    });
    this.log('info', '🌐 WebSocket server listening on port', port);
    // Broadcast loop (every 5 seconds)
    this.wsBroadcastInterval = setInterval(() => {
      this.broadcastWsMetrics();
    }, 5000);
  }

  private sendWsMessage(ws: WebSocket, msg: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcastWsMetrics(): void {
    if (!this.wsServer || this.wsClients.size === 0) return;
    const metrics = {
      type: 'metrics',
      data: {
        id: this.id,
        level: this.state.level,
        capabilities: this.state.capabilities,
        children: this.state.children.length,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        iterations: this.iterationCount,
        timestamp: new Date().toISOString()
      }
    };
    const msg = JSON.stringify(metrics);
    for (const ws of this.wsClients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  }

  stopWebSocketServer(): void {
    if (this.wsBroadcastInterval) clearInterval(this.wsBroadcastInterval);
    this.wsServer?.close(() => {
      this.log('info', '🌐 WebSocket server stopped');
    });
    this.wsClients.clear();
  }

  // ==================== SHUTDOWN ====================

  shutdown(): void {
    this.isRunning = false;
    this.stopMetricsServer();
    this.stopWebSocketServer();
    this.db?.close();
    this.saveMemory();
    this.flushLogs();
    this.log('info', '🛑 Agent shutting down...');
    // Remove from registry
    try {
      const registryFile = path.join(__dirname, 'agents registry.json');
      if (fs.existsSync(registryFile)) {
        const registry: string[] = JSON.parse(fs.readFileSync(registryFile, 'utf-8'));
        const newRegistry = registry.filter(id => id !== this.id);
        fs.writeFileSync(registryFile, JSON.stringify(newRegistry, null, 2));
      }
    } catch (e) {
      // ignore
    }
  }
}

// ==================== ENTRY POINT ====================

if (import.meta.main) {
  const agent = new EvoAgent({
    backupBeforeEvolve: true,
    logLevel: 'info',
    evolutionStrategy: 'balanced',
    enablePersistence: true,
    enableReplication: true,
    enableMetricsServer: true,
    enablePlugins: true,
    enableOrchestration: true,
    maxChildren: 5,
    metricsPort: 3456,
    resourceLimits: {
      maxMemoryMB: 50,
      maxCpuMsPerIter: 2000
    }
  });

  // Handle shutdown signals
  process.on('SIGINT', () => agent.shutdown());
  process.on('SIGTERM', () => agent.shutdown());
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    agent.shutdown();
  });

  agent.run().catch(error => {
    console.error('💥 Fatal error:', error);
    agent.shutdown();
    process.exit(1);
  });
}

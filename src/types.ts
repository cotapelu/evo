// types.ts - Common types and interfaces for the EvoAgent system

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
  progress: number;
  metadata?: Record<string, any>;
}

export interface EvolutionPlan {
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

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: string;
  consecutiveFailures: number;
  memoryPressure: number;
  cpuLoad: number;
  uptime: number;
  issues: string[];
}

export interface ResourceLimits {
  maxMemoryMB: number;
  maxCpuMsPerIter: number;
  maxOpenFiles: number;
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
    resourceLimits: ResourceLimits;
  };
}

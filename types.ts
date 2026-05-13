// Shared type definitions for EvoAgent
// Auto-generated

export interface Message {
  id: string;
  from: string;
  to: string;
  content: any;
  timestamp: string;
  type: string;
  priority?: number;
  ttl?: number;
}

export interface Goal {
  id: string;
  description: string;
  priority: number;
  status: string;
  steps: string[];
  currentStep: number;
  createdAt: string;
  completedAt?: string;
  dependencies?: string[];
}

export interface EvolutionMetrics {
  iteration: number;
  level: number;
  capabilities: string[];
  performance: { memoryUsage: number; cpuTime: number; uptime: number; successRate?: number };
  codeQuality: { linesOfCode: number; complexity?: number };
  changes: string[];
  bugsFixed: number;
  timestamp: string;
  health: string;
}

export interface AgentConfig {
  maxIterations?: number;
  backupBeforeEvolve: boolean;
  logLevel: string;
  evolutionStrategy: string;
  enablePersistence: boolean;
  enableReplication: boolean;
  enablePlugins: boolean;
  enableOrchestration: boolean;
  enableSecurity: boolean;
  enableHealthChecks: boolean;
  maxChildren: number;
  memoryPath?: string;
  logPath?: string;
  resourceLimits?: { maxMemoryMB?: number; maxCpuMsPerIter?: number; maxOpenFiles?: number };
  security?: { requireAuth?: boolean; allowedPaths?: string[]; blockedOperations?: string[]; sandboxMode?: string };
}

export interface AgentState {
  level: number;
  capabilities: string[];
  memory: Map<string, any>;
  history: EvolutionMetrics[];
  config: AgentConfig;
  goals: any[];
  children: string[];
  messages: Message[];
  health: { status: string; lastCheck: string; consecutiveFailures: number; memoryPressure: number };
  stats: { totalIterations: number; totalMessagesSent: number; totalMessagesReceived: number; totalChildrenSpawned: number; totalGoalsCompleted: number; startTime: string };
  sandbox: { allowedPaths: string[]; blockedOperations: string[]; resourceLimits: { maxMemoryMB: number; maxCpuMsPerIter: number; maxOpenFiles: number } };
  knownAgents?: Map<string, { level: number; capabilities: string[]; children: number; lastSeen: number }>;
}

export interface EvolutionPlan {
  targetLevel: number;
  opportunity: string;
  priority: number;
  totalOpportunities: number;
  estimatedComplexity: number;
  requiresNewDependencies: boolean;
  changes: string[];
  riskLevel: string;
  rollbackPlan?: string[];
}

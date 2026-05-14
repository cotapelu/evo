// analyzer.ts - Standalone code analysis for WorkerPool offloading
// Extracted from EvoAgent.analyzeCurrentState to run in worker threads
// @ts-nocheck - Skip type checking for worker compatibility

// Helper: hashString (same as agent)
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// Helper: formatFeatureName
function formatFeatureName(key) {
  const names = {
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

// Helper: generateOpportunities
function generateOpportunities(weaknesses) {
  const opps = {
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
  return weaknesses.map(w => opps[w] || `Improve ${w}`).filter(Boolean);
}

// Helper: estimateComplexityFromCode
function estimateComplexityFromCode(code) {
  let c = 0;
  c += (code.match(/\bif\s*\(/g) || []).length;
  c += (code.match(/\bfor\s*\(/g) || []).length * 1.5;
  c += (code.match(/\bwhile\s*\(/g) || []).length * 1.5;
  c += (code.match(/\basync\s+\w+\s*\(/g) || []).length * 2;
  c += (code.match(/\bclass\s+\w+/g) || []).length * 3;
  return Math.min(10, Math.max(1, Math.round(c / 20)));
}

// Main analysis function (can be executed in worker thread)
async function analyzeCode(params) {
  const { code, level } = params;
  const lines = code.split('\n').length;

  // Feature detection (same as evo.ts analyzeCurrentState)
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
    .map(([k, _]) => formatFeatureName(k));

  const weaknesses = Object.entries(features)
    .filter(([_, v]) => !v)
    .map(([k, _]) => formatFeatureName(k));

  const featureCount = Object.values(features).filter(v => v).length;
  const newLevel = Math.min(200, featureCount + Math.floor(level * 0.5));
  const complexity = estimateComplexityFromCode(code);

  return {
    currentLevel: level,
    newLevel,
    strengths,
    weaknesses,
    opportunities: generateOpportunities(weaknesses),
    metrics: {
      codeQuality: {
        linesOfCode: lines,
        complexity
      },
      bugsFixed: weaknesses.length
    }
  };
}

// Export for worker
export { analyzeCode };

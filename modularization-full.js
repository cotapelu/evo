const fs = require('fs');
const path = require('path');

const evoFile = 'evo.ts';
let code = fs.readFileSync(evoFile, 'utf-8');

// New implementation
const newMethod = `  private prepareModularization(code: string): string {
    this.log('info', '📦 Executing modularization - splitting files...');

    // Check if already split
    if (this.fs.exists('filesystem.ts')) {
      this.log('info', '⏭️  Files already exist, skipping');
      return code;
    }

    try {
      // Extract FileSystem
      const fsMatch = code.match(/class FileSystem \{([\s\S]*?)\n\}/);
      if (fsMatch && !fs.existsSync('filesystem.ts')) {
        const fsCode = \`// FileSystem module - extracted from EvoAgent
// Generated: \${nowISO()}
// Provides sandboxed file operations

import * as fs from 'fs';
import * as path from 'path';

function validatePath(filePath: string, allowedPaths: string[], blockedOps: string[]): { valid: boolean; reason?: string } {
  const resolved = path.resolve(filePath);
  const inAllowed = allowedPaths.some(allowed => resolved.startsWith(path.resolve(allowed)));
  if (!inAllowed) return { valid: false, reason: 'Outside allowed paths' };
  for (const blocked of blockedOps) {
    if (filePath.includes(blocked)) return { valid: false, reason: \`Blocked: \${blocked}\` };
  }
  return { valid: true };
}

class FileSystem {
  private basePath: string;
  private allowedPaths: string[];
  private blockedOps: string[];

  constructor(basePath?: string, allowedPaths?: string[], blockedOps?: string[]) {
    this.basePath = basePath || '.';
    this.allowedPaths = allowedPaths || [this.basePath];
    this.blockedOps = blockedOps || [];
  }

  private validate(filePath: string): { valid: boolean; reason?: string } {
    const fullPath = path.resolve(this.basePath, filePath);
    return validatePath(fullPath, this.allowedPaths, this.blockedOps);
  }

  readFile(filePath: string, encoding: string = 'utf-8'): string {
    const v = this.validate(filePath);
    if (!v.valid) throw new Error(\`FS denied: \${v.reason}\`);
    return fs.readFileSync(path.resolve(this.basePath, filePath), { encoding });
  }

  writeFile(filePath: string, content: string): void {
    const v = this.validate(filePath);
    if (!v.valid) throw new Error(\`FS denied: \${v.reason}\`);
    const full = path.resolve(this.basePath, filePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf-8');
  }

  exists(filePath: string): boolean {
    try { const v = this.validate(filePath); return v.valid && fs.existsSync(path.resolve(this.basePath, filePath)); } catch { return false; }
  }

  listFiles(dirPath: string): string[] {
    const v = this.validate(dirPath);
    if (!v.valid) throw new Error(\`FS denied: \${v.reason}\`);
    const full = path.resolve(this.basePath, dirPath);
    return fs.existsSync(full) ? fs.readdirSync(full) : [];
  }

  appendFile(filePath: string, content: string): void {
    const v = this.validate(filePath);
    if (!v.valid) throw new Error(\`FS denied: \${v.reason}\`);
    const full = path.resolve(this.basePath, filePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.appendFileSync(full, content, 'utf-8');
  }

  deleteFile(filePath: string): void {
    const v = this.validate(filePath);
    if (!v.valid) throw new Error(\`FS denied: \${v.reason}\`);
    const full = path.resolve(this.basePath, filePath);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  }

  mkdir(dirPath: string): void {
    const v = this.validate(dirPath);
    if (!v.valid) throw new Error(\`FS denied: \${v.reason}\`);
    fs.mkdirSync(path.resolve(this.basePath, dirPath), { recursive: true });
  }
}

export { FileSystem };
\`;
        fs.writeFileSync('filesystem.ts', fsCode);
        this.log('info', '✅ Created filesystem.ts');

        // Remove FileSystem class from evo.ts
        code = code.replace(/class FileSystem \{[\s\S]*?\n\}/, '// FileSystem class moved to filesystem.ts\nimport { FileSystem } from \'./filesystem\';\n');
        this.log('info', '✅ Removed FileSystem from evo.ts');
      }

      // Extract types to types.ts
      if (!fs.existsSync('types.ts')) {
        const typesCode = \`// Type definitions for EvoAgent
// Generated: \${nowISO()}

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

export interface EvolutionMetrics {
  iteration: number;
  level: number;
  capabilities: string[];
  performance: { memoryUsage: number; cpuTime: number; uptime: number };
  codeQuality: { linesOfCode: number; complexity?: number };
  changes: string[];
  bugsFixed: number;
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
  resourceLimits?: { maxMemoryMB?: number; maxCpuMsPerIter?: number };
  security?: { requireAuth?: boolean; allowedPaths?: string[]; blockedOperations?: string[] };
}

// Other interfaces...
\`;
        fs.writeFileSync('types.ts', typesCode);
        this.log('info', '✅ Created types.ts');
      }

      this.log('info', '✅ Modularization complete!');
    } catch (e) {
      this.log('error', 'Modularization error:', e);
    }

    return code;
  }`;

const start = code.indexOf('private prepareModularization(');
const end = code.indexOf('}', start) + 1;
if (start > 0 && end > start) {
  code = code.slice(0, start) + newMethod + code.slice(end);
  fs.writeFileSync(evoFile, code);
  console.log('✅ prepareModularization upgraded to actual file splitting');
} else {
  console.error('❌ Could not find prepareModularization');
  process.exit(1);
}

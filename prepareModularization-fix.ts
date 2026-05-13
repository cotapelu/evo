// Snippet to replace prepareModularization
  private prepareModularization(code: string): string {
    this.log('info', '📦 Executing modularization - splitting files...');

    if (this.fs.exists('filesystem.ts')) {
      this.log('info', '⏭️  Files already exist, skipping');
      return code;
    }

    try {
      // Extract FileSystem
      const fsMatch = code.match(/class FileSystem {([\s\S]*?)\n\}/);
      if (fsMatch && !this.fs.exists('filesystem.ts')) {
        const fsCode = `// FileSystem module - extracted from EvoAgent
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
    const full = path.resolve(this.basePath, filePath);
    return fs.readFileSync(full, { encoding });
  }

  writeFile(filePath: string, content: string): void {
    const v = this.validate(filePath);
    if (!v.valid) throw new Error(\`FS denied: \${v.reason}\`);
    const full = path.resolve(this.basePath, filePath);
    const dir = path.dirname(full);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(full, content, 'utf-8');
  }

  exists(filePath: string): boolean {
    try {
      const v = this.validate(filePath);
      return v.valid && fs.existsSync(path.resolve(this.basePath, filePath));
    } catch { return false; }
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
    const dir = path.dirname(full);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

  getStats(filePath: string): any { return null; }
  readdirStats(dirPath: string): any[] { return []; }
}

export { FileSystem };
\`;
        this.fs.writeFile('filesystem.ts', fsCode);
        this.log('info', '✅ Created filesystem.ts');

        // Remove FileSystem class from evo.ts
        code = code.replace(/class FileSystem {[\s\S]*?\n\}/, '// FileSystem class moved to separate module\nimport { FileSystem } from \'./filesystem\';\n');
        this.log('info', '✅ Removed FileSystem from evo.ts');
      }

      // Extract types
      if (!this.fs.exists('types.ts')) {
        const typesCode = `// Type definitions for EvoAgent
// Generated: \${nowISO()}

export interface Message {
  id: string; from: string; to: string; content: any; timestamp: string; type: string; priority?: number; ttl?: number;
}
export interface Goal { id: string; description: string; priority: number; status: string; steps: string[]; currentStep: number; createdAt: string; }
export interface EvolutionMetrics { iteration: number; level: number; capabilities: string[]; performance: any; codeQuality: any; changes: string[]; bugsFixed: number; timestamp: string; health: string; }
export interface AgentConfig { maxIterations?: number; backupBeforeEvolve: boolean; logLevel: string; evolutionStrategy: string; enablePersistence: boolean; enableReplication: boolean; maxChildren: number; memoryPath?: string; logPath?: string; }
export interface AgentState { level: number; capabilities: string[]; memory: Map<string, any>; history: any[]; config: AgentConfig; goals: any[]; children: string[]; messages: any[]; health: any; stats: any; sandbox: any; }
`;
        this.fs.writeFile('types.ts', typesCode);
        this.log('info', '✅ Created types.ts');
      }

      this.log('info', '✅ Modularization complete!');
    } catch (e) {
      this.log('error', 'Modularization error:', e);
    }

    return code;
  }

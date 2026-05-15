/**
 * Sandbox Execution for Agent Safety
 * Controls which tools and file paths agents can access
 */

export interface SandboxConfig {
  enabled: boolean;
  allowedTools: string[];           // e.g., ['read', 'grep', 'find', 'ls']
  blockedCommands: string[];        // regex patterns for blocked bash commands
  allowedPaths: string[];           // allowed file/directory paths (regex)
  maxFileSizeBytes: number;         // max file size to read
  maxExecutionTimeMs: number;       // max time for bash commands
}

export class Sandbox {
  private config: SandboxConfig;
  private logger: any;

  constructor(config: SandboxConfig, logger?: any) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Check if a tool is allowed
   */
  isToolAllowed(toolName: string): boolean {
    if (!this.config.enabled) return true;
    return this.config.allowedTools.includes(toolName);
  }

  /**
   * Check if a bash command is allowed
   */
  isCommandAllowed(command: string): boolean {
    if (!this.config.enabled) return true;
    const lowerCmd = command.toLowerCase().trim();
    for (const blocked of this.config.blockedCommands) {
      try {
        const regex = new RegExp(blocked, 'i');
        if (regex.test(lowerCmd)) {
          return false;
        }
      } catch (e) {
        // Invalid regex, skip
      }
    }
    return true;
  }

  /**
   * Check if a file path is accessible
   */
  isPathAllowed(filePath: string): boolean {
    if (!this.config.enabled) return true;
    const normalized = filePath.replace(/\\/g, '/');
    for (const allowed of this.config.allowedPaths) {
      try {
        const regex = new RegExp(allowed);
        if (regex.test(normalized)) {
          return true;
        }
      } catch (e) {
        // Invalid regex, skip
      }
    }
    return false;
  }

  /**
   * Validate file size before reading
   */
  isFileSizeAllowed(size: number): boolean {
    return size <= this.config.maxFileSizeBytes;
  }

  /**
   * Get execution timeout
   */
  getExecutionTimeout(): number {
    return this.config.maxExecutionTimeMs;
  }

  /**
   * Filter tools based on sandbox
   */
  filterTools(tools: string[]): string[] {
    if (!this.config.enabled) return tools;
    return tools.filter(t => this.isToolAllowed(t));
  }

  /**
   * Validate operation before execution
   */
  validateOperation(operation: { tool: string; command?: string; path?: string; fileSize?: number }): { allowed: boolean; reason?: string } {
    if (!this.config.enabled) {
      return { allowed: true };
    }

    // Check tool
    if (!this.isToolAllowed(operation.tool)) {
      return { allowed: false, reason: `Tool '${operation.tool}' is not allowed in sandbox mode` };
    }

    // Check command for bash
    if (operation.command && operation.tool === 'bash') {
      if (!this.isCommandAllowed(operation.command)) {
        return { allowed: false, reason: `Command blocked by sandbox: ${operation.command}` };
      }
    }

    // Check path
    if (operation.path && (operation.tool === 'read' || operation.tool === 'write' || operation.tool === 'edit')) {
      if (!this.isPathAllowed(operation.path)) {
        return { allowed: false, reason: `Path '${operation.path}' is not accessible in sandbox mode` };
      }
    }

    // Check file size for read operations
    if (operation.fileSize && operation.tool === 'read' && !this.isFileSizeAllowed(operation.fileSize)) {
      return { allowed: false, reason: `File size ${operation.fileSize} exceeds sandbox limit ${this.config.maxFileSizeBytes}` };
    }

    return { allowed: true };
  }
}

/**
 * Default sandbox configuration
 */
export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  enabled: false,
  allowedTools: ['read', 'grep', 'find', 'ls', 'bash'],  // Read-only by default in sandbox
  blockedCommands: [
    'rm -rf',      // Dangerous deletes
    '>',           // Overwrite redirection
    'dd',          // Disk destroyer
    'mkfs',        // Format filesystem
    'chmod',       // Permission changes
    'chown',       // Ownership changes
    'rmdir',       // Directory removal
    ':(){ :|:& };:', // Fork bomb
    'wget',        // Download from internet
    'curl',        // Network access
    'ssh',         // Remote access
    'scp',         // File transfer
    'git push',    // Destructive git operations
  ],
  allowedPaths: [
    '\\.ts$',      // TypeScript files
    '\\.js$',      // JavaScript files
    '\\.json$',    // JSON files
    '\\.md$',      // Markdown files
    '\\.txt$',     // Text files
    '\\.log$',     // Log files
    '/src/',       // Source directory
    '/test/',      // Test directory
    '/docs/',      // Docs directory
    '\\.pi/agent/', // Pi config (read-only)
  ],
  maxFileSizeBytes: 10 * 1024 * 1024,  // 10 MB
  maxExecutionTimeMs: 30000,          // 30 seconds
};

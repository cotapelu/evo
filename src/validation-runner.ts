import { execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { Logger } from './logger.js';

const execFileAsync = promisify(execFile);

export interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  durationMs: number;
}

export class ValidationRunner {
  private logger: Logger;
  private cwd: string;
  private runTests: boolean;

  constructor(cwd: string, logger: Logger, options: { runTests?: boolean } = {}) {
    this.cwd = cwd;
    this.logger = logger;
    this.runTests = options.runTests ?? true;
  }

  async validate(): Promise<ValidationResult> {
    const start = Date.now();
    const result: ValidationResult = {
      success: true,
      errors: [],
      warnings: [],
      durationMs: 0,
    };

    // Check TypeScript compilation
    this.logger.info('🔍 Type checking with tsc...');
    try {
      await execFileAsync('npx', ['tsc', '--noEmit'], {
        cwd: this.cwd,
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (e: any) {
      const msg = e.stdout || e.stderr || e.message;
      result.errors.push('TypeScript errors:\n' + msg);
      result.success = false;
    }

    // Run unit tests if enabled
    if (this.runTests && result.success) {
      this.logger.info('🧪 Running unit tests...');
      try {
        await execFileAsync('npx', ['jest', '--passWithNoTests'], {
          cwd: this.cwd,
          maxBuffer: 10 * 1024 * 1024,
          timeout: 120000,
        });
      } catch (e: any) {
        const out = e.stdout || e.stderr || e.message;
        if (out.includes('No tests')) {
          this.logger.info('No tests found');
        } else {
          result.errors.push('Unit tests failed:\n' + out);
          result.success = false;
        }
      }
    }

    result.durationMs = Date.now() - start;
    return result;
  }
}

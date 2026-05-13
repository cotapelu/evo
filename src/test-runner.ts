// test-runner.ts - Unit Test Runner for EvoAgent
// Runs tests before applying code changes to ensure stability

import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

export interface TestResult {
  success: boolean;
  passed: number;
  failed: number;
  total: number;
  output: string;
  errors: string[];
}

export class TestRunner {
  private testCommand: string;
  private timeout: number;

  constructor(options?: { testCommand?: string; timeout?: number }) {
    this.testCommand = options?.testCommand || 'npm test';
    this.timeout = options?.timeout || 60000;
  }

  async runAll(): Promise<TestResult> {
    try {
      const { stdout, stderr } = await execAsync(this.testCommand, { timeout: this.timeout });
      const output = stdout + stderr;

      // Parse Jest output
      const passMatch = output.match(/(\d+)\s+passed/);
      const failMatch = output.match(/(\d+)\s+failed/);
      const totalMatch = output.match(/(\d+)\s+total/);

      const passed = passMatch ? parseInt(passMatch[1]) : 0;
      const failed = failMatch ? parseInt(failMatch[1]) : 0;
      const total = totalMatch ? parseInt(totalMatch[1]) : passed + failed;

      return {
        success: failed === 0,
        passed,
        failed,
        total,
        output: output.substring(output.lastIndexOf('Test Suites:') || 0),
        errors: failed > 0 ? this.extractErrors(output) : []
      };
    } catch (error: any) {
      return {
        success: false,
        passed: 0,
        failed: 0,
        total: 0,
        output: error.stdout || '',
        errors: [error.message || 'Test execution failed']
      };
    }
  }

  async runSpecific(testPattern: string): Promise<TestResult> {
    const command = `${this.testCommand} --testPathPattern=${testPattern}`;
    try {
      const { stdout, stderr } = await execAsync(command, { timeout: this.timeout });
      const output = stdout + stderr;

      const passMatch = output.match(/(\d+)\s+passed/);
      const failMatch = output.match(/(\d+)\s+failed/);
      const totalMatch = output.match(/(\d+)\s+total/);

      const passed = passMatch ? parseInt(passMatch[1]) : 0;
      const failed = failMatch ? parseInt(failMatch[1]) : 0;
      const total = totalMatch ? parseInt(totalMatch[1]) : passed + failed;

      return {
        success: failed === 0,
        passed,
        failed,
        total,
        output: output.substring(output.lastIndexOf('Test Suites:') || 0),
        errors: failed > 0 ? this.extractErrors(output) : []
      };
    } catch (error: any) {
      return {
        success: false,
        passed: 0,
        failed: 0,
        total: 0,
        output: error.stdout || '',
        errors: [error.message || 'Test execution failed']
      };
    }
  }

  shouldApplyChange(testResult: TestResult, minPassRate: number = 80): boolean {
    if (!testResult.success) return false;
    if (testResult.total === 0) return false;
    const passRate = (testResult.passed / testResult.total) * 100;
    return passRate >= minPassRate;
  }

  private extractErrors(output: string): string[] {
    const errors: string[] = [];
    const lines = output.split('\n');
    let inFailure = false;
    let currentError: string[] = [];

    for (const line of lines) {
      if (line.includes('●') || line.includes('FAIL')) {
        if (currentError.length > 0) {
          errors.push(currentError.join('\n'));
          currentError = [];
        }
        inFailure = true;
      }
      if (inFailure) {
        currentError.push(line);
        if (line.trim() === '' && currentError.length > 2) {
          inFailure = false;
          errors.push(currentError.join('\n'));
          currentError = [];
        }
      }
    }

    if (currentError.length > 0) {
      errors.push(currentError.join('\n'));
    }

    return errors.slice(0, 10); // Limit to 10 errors
  }
}

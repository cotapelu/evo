/**
 * Evolver - Safe Self-Modification System
 *
 * Applies learned patterns to improve codebase with full verification.
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { scanDirectory, generateReport, PatternMatch, patterns, type Pattern } from './patterns.js';
import { FileCache } from './cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface EvolutionStep {
  id: string;
  file: string;
  patternId: string;
  original: string;
  modified: string;
  match: PatternMatch;
}

interface EvolutionResult {
  success: boolean;
  steps: EvolutionStep[];
  report: string;
  testResults?: string;
}

export class Evolver {
  private dryRun: boolean;
  private backupDir: string;

  constructor(dryRun: boolean = false) {
    this.dryRun = dryRun;
    this.backupDir = join(process.cwd(), '.evolution-backup');
  }

  async run(targetDir?: string): Promise<EvolutionResult> {
    const startTime = Date.now();
    const target = targetDir || join(__dirname, '..'); // Default to src/
    console.log(`\n🧬 Starting evolution analysis...`);
    console.log(`   Target: ${relative(process.cwd(), target)}`);
    console.log(`   Dry run: ${this.dryRun}`);

    // Initialize cache for incremental scanning
    const cache = new FileCache();
    try {
      await cache.load();
    } catch (err) {
      console.warn('⚠️  Cache load failed, starting fresh');
    }

    let steps: EvolutionStep[] = [];
    let report = '';

    try {
      // Step 1: Scan for patterns (with cache)
      console.log('\n📊 Scanning for patterns...');
      const results = await scanDirectory(target, ['.ts'], {
        exclude: ['dist', 'node_modules', '__tests__'],
        cache
      });

      if (results.size === 0) {
        console.log('   No patterns found. Code is already well-evolved!');
        return {
          success: true,
          steps: [],
          report: 'No improvements identified.'
        };
      }

      console.log(`   Found ${this.countMatches(results)} issues across ${results.size} files`);

      // Generate initial report
      report = generateReport(results);

      // Step 2: Generate proposed changes
      console.log('\n🔧 Generating proposed changes...');
      steps = await this.generateSteps(results);

      if (steps.length === 0) {
        report += '\n\nNo applicable fixes could be auto-generated.\n';
        return {
          success: false,
          steps: [],
          report
        };
      }

      console.log(`   ${steps.length} changes proposed`);
      report += `\nProposed Changes:\n${this.formatSteps(steps)}\n`;

      // Step 3: Dry run - just show what would change
      if (this.dryRun) {
        console.log('\n✅ Dry run complete. No files modified.');
        return {
          success: true,
          steps: [],
          report
        };
      }

      // Step 4: Create backup
      console.log('\n💾 Creating backup...');
      await this.createBackup(steps);
      console.log(`   Backup saved to: ${relative(process.cwd(), this.backupDir)}`);

      // Step 5: Apply changes
      console.log('\n✏️  Applying changes...');
      const applied = await this.applyChanges(steps);
      if (!applied) {
        console.log('   Failed to apply changes');
        return {
          success: false,
          steps: [],
          report: 'Failed to apply changes. Backup preserved.',
        };
      }

      // Invalidate cache entries for modified files (they'll be re-read on next scan)
      for (const step of steps) {
        cache.invalidate(step.file);
      }

      // Step 6: Run tests
      console.log('\n🧪 Running tests...');
      const testResults = await this.runTests();

      if (!testResults.success) {
        console.log('   ❌ Tests failed! Rolling back...');
        await this.restoreBackup();
        report += `\n\nTEST FAILURES:\n${testResults.output}\n`;
        report += 'Changes have been rolled back.\n';
        return {
          success: false,
          steps: [],
          report,
          testResults: testResults.output
        };
      }

      console.log('   ✅ All tests passed!');

      // Step 7: Commit changes
      console.log('\n📝 Committing changes...');
      await this.commitChanges(steps);

      const elapsed = Date.now() - startTime;
      report += `\n\nEvolution completed in ${elapsed}ms\n`;
      report += `${steps.length} improvements applied successfully.\n`;

      return {
        success: true,
        steps,
        report,
        testResults: testResults.output
      };
    } finally {
      // Persist cache for future runs
      try {
        await cache.save();
      } catch (err) {
        console.warn('Failed to save cache:', err);
      }
    }
  }

  private countMatches(results: Map<string, PatternMatch[]>): number {
    let total = 0;
    for (const matches of results.values()) {
      total += matches.length;
    }
    return total;
  }

  private async generateSteps(results: Map<string, PatternMatch[]>): Promise<EvolutionStep[]> {
    const steps: EvolutionStep[] = [];
    let counter = 0;

    for (const [file, matches] of results) {
      try {
        const original = await readFile(file, 'utf-8');

        for (const match of matches) {
          const pattern = patterns.find((p: Pattern) => p.id === match.patternId);
          if (!pattern) continue;

          // Simple string-based transformation (for demo)
          // In production, would use AST-based transformations
          const modified = pattern.fix(original, file);

          if (modified !== original) {
            counter++;
            steps.push({
              id: `evo-${counter}`,
              file,
              patternId: match.patternId,
              original,
              modified,
              match
            });
          }
        }
      } catch (err) {
        // Skip files we can't read
      }
    }

    return steps;
  }

  private formatSteps(steps: EvolutionStep[]): string {
    let output = '';
    for (const step of steps) {
      output += `\n[${step.id}] ${relative(process.cwd(), step.file)}\n`;
      output += `  Pattern: ${step.match.patternId}\n`;
      output += `  Message: ${step.match.message}\n`;
    }
    return output;
  }

  private async createBackup(steps: EvolutionStep[]): Promise<void> {
    const filesToBackup = new Set(steps.map(s => s.file));
    await mkdir(this.backupDir, { recursive: true });

    for (const file of filesToBackup) {
      const relPath = relative(process.cwd(), file);
      const backupPath = join(this.backupDir, relPath);
      await mkdir(dirname(backupPath), { recursive: true });
      await writeFile(backupPath, await readFile(file, 'utf-8'));
    }
  }

  private async applyChanges(steps: EvolutionStep[]): Promise<boolean> {
    try {
      for (const step of steps) {
        await writeFile(step.file, step.modified);
      }
      return true;
    } catch (err) {
      console.error('   Error applying changes:', err);
      return false;
    }
  }

  private async restoreBackup(): Promise<void> {
    const backupFiles = await this.listFiles(this.backupDir);

    for (const backupFile of backupFiles) {
      const relPath = relative(this.backupDir, backupFile);
      const originalPath = join(process.cwd(), relPath);
      try {
        await writeFile(originalPath, await readFile(backupFile, 'utf-8'));
      } catch (err) {
        // File might have been deleted, skip
      }
    }
  }

  private async listFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    async function walk(currentDir: string): Promise<void> {
      const entries = await readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    }

    await walk(dir);
    return files;
  }

  private async runTests(): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
      const testProc = spawn('npm', ['test'], { stdio: 'pipe' });

      let stdout = '';
      let stderr = '';

      testProc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      testProc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      testProc.on('close', (code) => {
        const success = code === 0;
        resolve({
          success,
          output: stdout + stderr
        });
      });

      testProc.on('error', (err) => {
        resolve({
          success: false,
          output: `Test process error: ${err}`
        });
      });

      // Timeout after 60 seconds
      setTimeout(() => {
        testProc.kill('SIGTERM');
        resolve({
          success: false,
          output: 'Tests timed out after 60 seconds'
        });
      }, 60000);
    });
  }

  private async commitChanges(steps: EvolutionStep[]): Promise<void> {
    const commitMessage = `Evolution: Apply ${steps.length} learned pattern(s)\n\n` +
      steps.map(s => `- ${s.match.patternId} in ${relative(process.cwd(), s.file)}`).join('\n');

    try {
      // Add all modified files
      const files = [...new Set(steps.map(s => s.file))];
      await this.gitCmd('add', files);

      // Commit
      await this.gitCmd('commit', ['-m', commitMessage]);

      console.log(`   ✅ Created commit with ${steps.length} changes`);
    } catch (err) {
      console.log(`   ⚠️  Git commit skipped: ${err}`);
    }
  }

  private async gitCmd(cmd: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', [cmd, ...args], { stdio: 'pipe' });

      let stderr = '';
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(stderr || `git ${cmd} failed with code ${code}`));
        }
      });
    });
  }
}

// CLI interface
export async function evolve(options: { dryRun?: boolean; target?: string } = {}): Promise<number> {
  const evolver = new Evolver(options.dryRun);
  const result = await evolver.run(options.target);

  console.log('\n' + result.report);

  return result.success ? 0 : 1;
}

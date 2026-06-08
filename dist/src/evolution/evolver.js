/**
 * Evolver - Safe Self-Modification System
 *
 * Applies learned patterns to improve codebase with full verification.
 */
import { readFile, writeFile, mkdir, readdir, rm, realpath } from 'fs/promises';
import { join, relative, dirname, resolve, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { scanDirectory, generateReport, patterns } from './patterns.js';
import { FileCache } from './cache.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export class Evolver {
    dryRun;
    backupDir;
    constructor(dryRun = false) {
        this.dryRun = dryRun;
        this.backupDir = join(process.cwd(), '.evolution-backup');
    }
    async run(targetDir) {
        const startTime = Date.now();
        // Resolve target directory: use provided or default to ./src within cwd
        let target = targetDir ? resolve(targetDir) : join(process.cwd(), 'src');
        const cwd = process.cwd(); // Use original cwd for relative paths, logging, and initial check
        // First, simple check using path string (without symlink resolution) to ensure target is within cwd
        const relTarget = relative(cwd, target);
        if (relTarget.startsWith('..') || isAbsolute(relTarget)) {
            throw new Error(`Target directory must be within project root (${cwd}). Found: ${target}`);
        }
        // Additional security: resolve symlinks to prevent bypass via symlink
        let cwdReal = null;
        let targetReal = null;
        try {
            [cwdReal, targetReal] = await Promise.all([
                realpath(cwd),
                realpath(target)
            ]);
        }
        catch (err) {
            // realpath may fail if path doesn't exist or permissions denied; we'll continue with original target
        }
        if (cwdReal && targetReal) {
            const cwdNorm = resolve(cwdReal);
            const targetNorm = resolve(targetReal);
            // Check that resolved target is within resolved cwd
            if (!targetNorm.startsWith(cwdNorm + '/') && targetNorm !== cwdNorm) {
                throw new Error(`Target directory must be within project root (${cwd}). Symlink check failed: ${target} -> ${targetNorm}`);
            }
            // Use the symlink-resolved target for scanning (more secure)
            target = targetNorm;
        }
        // If realpath failed, we keep original target
        console.log(`\n🧬 Starting evolution analysis...`);
        console.log(`   Target: ${relative(process.cwd(), target)}`);
        console.log(`   Dry run: ${this.dryRun}`);
        // Initialize cache for incremental scanning
        const cache = new FileCache();
        try {
            await cache.load();
        }
        catch (err) {
            console.warn('⚠️  Cache load failed, starting fresh');
        }
        let steps = [];
        let report = '';
        try {
            // Step 1: Scan for patterns (with cache)
            console.log('\n📊 Scanning for patterns...');
            const results = await scanDirectory(target, ['.ts'], {
                exclude: ['dist', 'node_modules', '__tests__', '.evolution-backup'],
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
            // Clean up backup directory after successful commit
            try {
                await rm(this.backupDir, { recursive: true, force: true });
            }
            catch (err) {
                console.warn('Failed to clean up backup:', err);
            }
            const elapsed = Date.now() - startTime;
            report += `\n\nEvolution completed in ${elapsed}ms\n`;
            report += `${steps.length} improvements applied successfully.\n`;
            return {
                success: true,
                steps,
                report,
                testResults: testResults.output
            };
        }
        finally {
            // Persist cache for future runs
            try {
                await cache.save();
            }
            catch (err) {
                console.warn('Failed to save cache:', err);
            }
        }
    }
    countMatches(results) {
        let total = 0;
        for (const matches of results.values()) {
            total += matches.length;
        }
        return total;
    }
    async generateSteps(results) {
        const steps = [];
        let counter = 0;
        for (const [file, matches] of results) {
            let original;
            try {
                original = await readFile(file, 'utf-8');
            }
            catch (err) {
                // File read error
                console.warn(`   Warning: Could not read file ${file}: ${err instanceof Error ? err.message : err}`);
                continue; // Skip this file entirely
            }
            for (const match of matches) {
                try {
                    const pattern = patterns.find((p) => p.id === match.patternId);
                    if (!pattern)
                        continue;
                    // Apply pattern fix (may be string-based or AST-based)
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
                catch (err) {
                    // Pattern execution error – log and continue with other patterns
                    console.warn(`   Warning: Pattern ${match.patternId} failed on ${file}: ${err instanceof Error ? err.message : err}`);
                }
            }
        }
        return steps;
    }
    formatSteps(steps) {
        let output = '';
        for (const step of steps) {
            output += `\n[${step.id}] ${relative(process.cwd(), step.file)}\n`;
            output += `  Pattern: ${step.match.patternId}\n`;
            output += `  Message: ${step.match.message}\n`;
        }
        return output;
    }
    async createBackup(steps) {
        const filesToBackup = new Set(steps.map(s => s.file));
        await mkdir(this.backupDir, { recursive: true });
        for (const file of filesToBackup) {
            const relPath = relative(process.cwd(), file);
            const backupPath = join(this.backupDir, relPath);
            await mkdir(dirname(backupPath), { recursive: true });
            await writeFile(backupPath, await readFile(file, 'utf-8'));
        }
    }
    async applyChanges(steps) {
        try {
            // Group steps by file path
            const stepsByFile = new Map();
            for (const step of steps) {
                const arr = stepsByFile.get(step.file) || [];
                arr.push(step);
                stepsByFile.set(step.file, arr);
            }
            // Create a map from pattern ID to its index for ordering
            const patternOrder = new Map();
            patterns.forEach((p, i) => patternOrder.set(p.id, i));
            // Sort steps for each file by pattern order
            for (const [, fileSteps] of stepsByFile) {
                fileSteps.sort((a, b) => {
                    const idxA = patternOrder.get(a.patternId) ?? 0;
                    const idxB = patternOrder.get(b.patternId) ?? 0;
                    return idxA - idxB;
                });
            }
            // Determine application order for files: sorted alphabetically for determinism
            const sortedFiles = Array.from(stepsByFile.keys()).sort();
            // Apply changes to each file: compute final content by composing fixes, then write once
            for (const file of sortedFiles) {
                const fileSteps = stepsByFile.get(file);
                // Use the original content from the first step (all steps for same file share same original)
                let currentContent = fileSteps[0].original;
                let changed = false;
                for (const step of fileSteps) {
                    const pattern = patterns.find(p => p.id === step.patternId);
                    if (!pattern)
                        continue;
                    const newContent = pattern.fix(currentContent, file);
                    if (newContent !== currentContent) {
                        currentContent = newContent;
                        changed = true;
                    }
                }
                if (changed) {
                    await writeFile(file, currentContent);
                }
            }
            return true;
        }
        catch (err) {
            console.error('   Error applying changes:', err);
            return false;
        }
    }
    async restoreBackup() {
        const backupFiles = await this.listFiles(this.backupDir);
        for (const backupFile of backupFiles) {
            const relPath = relative(this.backupDir, backupFile);
            const originalPath = join(process.cwd(), relPath);
            try {
                await writeFile(originalPath, await readFile(backupFile, 'utf-8'));
            }
            catch (err) {
                console.warn(`   Warning: Failed to restore ${originalPath}: ${err instanceof Error ? err.message : err}`);
            }
        }
    }
    async listFiles(dir) {
        const files = [];
        async function walk(currentDir) {
            const entries = await readdir(currentDir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = join(currentDir, entry.name);
                if (entry.isDirectory()) {
                    await walk(fullPath);
                }
                else if (entry.isFile()) {
                    files.push(fullPath);
                }
            }
        }
        await walk(dir);
        return files;
    }
    async runTests() {
        return new Promise((resolve) => {
            const command = 'npm';
            const args = ['test'];
            const testProc = spawn(command, args, { stdio: 'pipe' });
            let stdout = '';
            let stderr = '';
            testProc.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            testProc.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            const timeoutMs = 60000;
            let timeoutId = null;
            let resolved = false;
            const doResolve = (result) => {
                if (resolved)
                    return;
                resolved = true;
                if (timeoutId)
                    clearTimeout(timeoutId);
                resolve(result);
            };
            testProc.on('close', (code) => {
                const success = code === 0;
                if (stderr && !success) {
                    // Prefix stderr lines for clarity in combined output
                    const prefixed = stderr.split('\n').map(line => `[stderr] ${line}`).join('\n');
                    doResolve({ success, output: stdout + (prefixed ? '\n' + prefixed : '') + `\n[Exit code: ${code}]` });
                }
                else {
                    doResolve({ success, output: stdout + stderr });
                }
            });
            testProc.on('error', (err) => {
                const errorMsg = `Test process error: ${err?.message || err} (errno: ${err?.errno}, syscall: ${err?.syscall})`;
                doResolve({ success: false, output: errorMsg });
            });
            // Timeout after 60 seconds
            timeoutId = setTimeout(() => {
                // Try graceful termination first
                testProc.kill('SIGTERM');
                // Force kill after 5 seconds if still alive
                setTimeout(() => {
                    if (!testProc.killed) {
                        testProc.kill('SIGKILL');
                    }
                }, 5000).unref();
                doResolve({
                    success: false,
                    output: 'Tests timed out after 60 seconds (SIGTERM sent, followed by SIGKILL if needed)'
                });
            }, timeoutMs);
        });
    }
    async commitChanges(steps) {
        const commitMessage = `Evolution: Apply ${steps.length} learned pattern(s)\n\n` +
            steps.map(s => `- ${s.match.patternId} in ${relative(process.cwd(), s.file)}`).join('\n');
        try {
            // Add all modified files
            const files = [...new Set(steps.map(s => s.file))];
            await this.gitCmd('add', files);
            // Commit
            await this.gitCmd('commit', ['-m', commitMessage]);
            console.log(`   ✅ Created commit with ${steps.length} changes`);
        }
        catch (err) {
            console.log(`   ⚠️  Git commit skipped: ${err}`);
        }
    }
    async gitCmd(cmd, args, timeoutMs) {
        return new Promise((resolve, reject) => {
            const command = 'git';
            const fullArgs = [cmd, ...args];
            const proc = spawn(command, fullArgs, { stdio: 'pipe' });
            let stdout = '';
            let stderr = '';
            proc.stdout.on('data', (data) => { stdout += data.toString(); });
            proc.stderr.on('data', (data) => { stderr += data.toString(); });
            const timeout = timeoutMs ?? 30000;
            let timeoutId = null;
            let resolved = false;
            const doResolve = (value) => { if (!resolved) {
                resolved = true;
                if (timeoutId)
                    clearTimeout(timeoutId);
                resolve(value);
            } };
            const doReject = (err) => { if (!resolved) {
                resolved = true;
                if (timeoutId)
                    clearTimeout(timeoutId);
                reject(err);
            } };
            proc.on('close', (code) => {
                if (code === 0) {
                    doResolve();
                }
                else {
                    const msg = `git command failed: ${command} ${fullArgs.join(' ')} (exit code: ${code})\nSTDERR: ${stderr || '(empty)'}\nSTDOUT: ${stdout || '(empty)'}`;
                    doReject(new Error(msg));
                }
            });
            proc.on('error', (err) => {
                const msg = `git command error: ${command} ${fullArgs.join(' ')} (errno: ${err?.errno}, syscall: ${err?.syscall})\n${err?.message || err}`;
                doReject(new Error(msg));
            });
            timeoutId = setTimeout(() => {
                proc.kill('SIGTERM');
                setTimeout(() => {
                    if (!proc.killed)
                        proc.kill('SIGKILL');
                }, 5000).unref();
                doReject(new Error(`git command timed out after ${timeout}ms: ${command} ${fullArgs.join(' ')}`));
            }, timeout);
        });
    }
}
// CLI interface
export async function evolve(options = {}) {
    const evolver = new Evolver(options.dryRun);
    const result = await evolver.run(options.target);
    console.log('\n' + result.report);
    return result.success ? 0 : 1;
}
//# sourceMappingURL=evolver.js.map
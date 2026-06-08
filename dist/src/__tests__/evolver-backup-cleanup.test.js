import { Evolver } from '../evolution/evolver.js';
import { join, relative } from 'path';
import { mkdir, writeFile, readFile, rm, access } from 'fs/promises';
describe('Evolver Backup and Cleanup', () => {
    let tempDir;
    let testFile;
    beforeEach(async () => {
        tempDir = join(process.cwd(), `.test-evolver-backup-${Date.now()}-${Math.random().toString(36).substring(2)}`);
        await mkdir(tempDir, { recursive: true });
        testFile = join(tempDir, 'sample.ts');
    });
    afterEach(async () => {
        try {
            await rm(tempDir, { recursive: true, force: true });
        }
        catch { }
    });
    it('should backup and restore on test failure', async () => {
        const original = 'let x = 1;   \n'; // trailing spaces + newline
        await writeFile(testFile, original);
        class TestEvolver extends Evolver {
            constructor(dryRun, backupRoot) {
                super(dryRun);
                // Set custom backup directory inside tempDir
                this.backupDir = join(backupRoot, 'backup');
            }
            async runTests() {
                return { success: false, output: 'tests failed' };
            }
            async commitChanges(steps) {
                // no-op - avoid git dependency
            }
        }
        const evolver = new TestEvolver(false, tempDir);
        const relPath = relative(process.cwd(), testFile);
        const backupPath = join(evolver.backupDir, relPath);
        const result = await evolver.run(tempDir);
        expect(result.success).toBe(false);
        // File should be restored to original (with trailing spaces)
        const final = await readFile(testFile, 'utf-8');
        expect(final).toBe(original);
        // Backup file should exist at computed path
        const backupExists = await access(backupPath).then(() => true).catch(() => false);
        expect(backupExists).toBe(true);
    });
    it('should clean up backup after successful commit', async () => {
        const original = 'let x = 1;   \n'; // trailing spaces
        await writeFile(testFile, original);
        class TestEvolver extends Evolver {
            constructor(dryRun, backupRoot) {
                super(dryRun);
                this.backupDir = join(backupRoot, 'backup');
            }
            async runTests() {
                return { success: true, output: 'tests passed' };
            }
            async commitChanges(steps) {
                // no-op - simulate successful commit
            }
        }
        const evolver = new TestEvolver(false, tempDir);
        const backupDir = evolver.backupDir;
        const result = await evolver.run(tempDir);
        expect(result.success).toBe(true);
        // File should be modified (trailing spaces removed)
        const final = await readFile(testFile, 'utf-8');
        expect(final).not.toBe(original);
        expect(final).toBe('let x = 1;\n'); // spaces removed, newline kept
        // Backup directory should be cleaned up entirely
        const backupExists = await access(backupDir).then(() => true).catch(() => false);
        expect(backupExists).toBe(false);
    });
    it('should handle backup creation failure gracefully', async () => {
        // Simulate backup dir creation failure by pre-creating it as a file
        const backupDir = join(tempDir, 'backup');
        await writeFile(backupDir, 'not a directory'); // create a file with same name
        const original = 'let y = 2;   \n';
        await writeFile(testFile, original);
        class TestEvolver extends Evolver {
            constructor(dryRun, backupRoot) {
                super(dryRun);
                this.backupDir = join(backupRoot, 'backup');
            }
            async runTests() {
                return { success: false, output: 'tests failed' };
            }
            async commitChanges(steps) { }
        }
        const evolver = new TestEvolver(false, tempDir);
        // Expect run to throw because backup creation fails (mkdir on existing file)
        await expect(evolver.run(tempDir)).rejects.toThrow();
    });
});
//# sourceMappingURL=evolver-backup-cleanup.test.js.map
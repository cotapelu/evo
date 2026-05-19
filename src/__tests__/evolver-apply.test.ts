import { mkdir, writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { Evolver } from '../evolution/evolver.js';

// Subclass for testing to avoid side effects
class TestEvolver extends Evolver {
  async runTests(): Promise<{ success: boolean; output: string }> {
    return { success: true, output: '' };
  }

  async commitChanges(steps: any[]): Promise<void> {
    // noop - avoid git dependency
  }

  async createBackup(steps: any[]): Promise<void> {
    // skip backup to keep tests fast and isolated
  }
}

describe('Evolver Multi-Patch Application', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a unique temporary directory for this test
    tempDir = join(
      process.cwd(),
      `.test-evolver-${Date.now()}-${Math.random().toString(36).substring(2)}`
    );
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up the temporary directory
    const { rm } = await import('fs/promises');
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      // ignore cleanup errors
    }
  });

  it('should apply multiple patterns sequentially to the same file', async () => {
    const testFile = join(tempDir, 'sample.ts');
    // Write content with trailing whitespace and missing final newline
    await writeFile(testFile, 'code line   \nline2');

    const evolver = new TestEvolver(false);
    const result = await evolver.run(tempDir);

    expect(result.success).toBe(true);

    const finalContent = await readFile(testFile, 'utf-8');

    // Expected after both fixes: trailing spaces removed and newline added
    expect(finalContent).toBe('code line\nline2\n');

    // Additional checks: no trailing whitespace on any line, ends with newline
    const lines = finalContent.split('\n');
    // All lines except the last empty one (due to trailing newline) should have no trailing whitespace
    for (let i = 0; i < lines.length - 1; i++) {
      expect(lines[i]).not.toMatch(/\s+$/);
    }
    expect(finalContent.endsWith('\n')).toBe(true);
  });

  it('should handle multiple files with different patterns', async () => {
    const file1 = join(tempDir, 'a.ts');
    const file2 = join(tempDir, 'b.ts');

    // file1: trailing whitespace only
    await writeFile(file1, 'x   \ny');
    // file2: missing newline only
    await writeFile(file2, 'foo\nbar');

    const evolver = new TestEvolver(false);
    const result = await evolver.run(tempDir);
    expect(result.success).toBe(true);

    const content1 = await readFile(file1, 'utf-8');
    const content2 = await readFile(file2, 'utf-8');

    expect(content1).toBe('x\ny\n'); // trailing removed, newline added
    expect(content2).toBe('foo\nbar\n'); // just newline added
  });
});

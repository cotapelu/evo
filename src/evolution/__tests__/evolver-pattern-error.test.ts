import { Evolver } from '../evolver.js';
import { patterns } from '../patterns.js';
import { mkdir, writeFile, rm, rmdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { jest } from '@jest/globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = __filename.split('/').slice(0, -1).join('/');

describe('Evolver – Pattern Error Resilience', () => {
  let testDir: string;
  let originalFix: any;

  beforeAll(() => {
    // Save original fix of trailing-whitespace pattern
    const pattern = patterns.find(p => p.id === 'trailing-whitespace');
    if (pattern) originalFix = pattern.fix;
  });

  afterAll(() => {
    // Restore original fix
    const pattern = patterns.find(p => p.id === 'trailing-whitespace');
    if (pattern && originalFix) pattern.fix = originalFix;
  });

  beforeEach(async () => {
    testDir = join(__dirname, '..', '..', 'test-temp-evolver-pattern-error');
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should continue evolution when a pattern.fix throws, logging warning with pattern ID', async () => {
    // Arrange: create a file with trailing whitespace to trigger the pattern
    const testFile = join(testDir, 'test.ts');
    await writeFile(testFile, 'const x = 1;  \n'); // trailing spaces

    // Replace the fix function of trailing-whitespace with one that throws
    const pattern = patterns.find(p => p.id === 'trailing-whitespace');
    if (!pattern) throw new Error('trailing-whitespace pattern not found');
    const simulatedError = new Error('simulated pattern failure');
    pattern.fix = () => { throw simulatedError; };

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const evolver = new Evolver(true); // dryRun

    // Act: run should not throw despite pattern.fix throwing
    const result = await evolver.run(testDir);

    // Assert: run completes
    expect(result).toHaveProperty('success');
    // The file should remain unchanged because the pattern threw
    const after = await import('fs/promises').then(fs => fs.readFile(testFile, 'utf-8'));
    expect(after).toBe('const x = 1;  \n');
    // Verify warning was logged with pattern ID and file
    const warningCalls = warnSpy.mock.calls.map(call => call[0]);
    expect(warningCalls.some(msg =>
      typeof msg === 'string' &&
      msg.includes('Pattern trailing-whitespace failed on') &&
      msg.includes('simulated pattern failure')
    )).toBe(true);
    warnSpy.mockRestore();
  });
});

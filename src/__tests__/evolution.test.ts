import { jest } from '@jest/globals';
import { scanDirectory, generateReport } from '../evolution/patterns.js';

describe('Pattern Evolution System', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should scan directory and find patterns', async () => {
    // Test with current source directory
    const results = await scanDirectory('src', ['.ts']);

    // Should produce a Map
    expect(results instanceof Map).toBe(true);

    // For this test, we don't require any matches
    // Just verify the API works
    console.log(`Scan found ${results.size} files with pattern matches`);
  });

  it('should generate report from results', () => {
    const mockResults = new Map();
    mockResults.set('test.ts', [{
      patternId: 'avoid-globals',
      line: 1,
      column: 1,
      message: 'Test message',
      suggestedFix: 'Test fix'
    }]);

    const report = generateReport(mockResults);

    expect(report).toContain('Pattern Analysis Report');
    expect(report).toContain('test.ts');
    expect(report).toContain('avoid-globals');
    expect(report).toContain('Total issues found: 1');
  });

  it('should detect async/await pattern issues', async () => {
    const { readFile, unlink, writeFile } = await import('fs/promises');
    const { join } = await import('path');

    const testFile = join(process.cwd(), 'test-async-pattern.ts');
    const testCode = `
async function example() {
  return fetch(url).then(res => res.json()).catch(err => { throw err; });
}
`;

    await writeFile(testFile, testCode);

    try {
      const results = await scanDirectory(process.cwd(), ['.ts']);
      const matches = results.get(testFile);
      expect(matches?.some(m => m.patternId === 'use-async-await')).toBe(true);
    } finally {
      await unlink(testFile);
    }
  });

  it('should detect trailing whitespace', async () => {
    const { writeFile, unlink } = await import('fs/promises');
    const { join } = await import('path');

    const testFile = join(process.cwd(), 'test-trailing.ts');
    const testCode = 'line with trailing spaces   \nline without trailing\n';

    await writeFile(testFile, testCode);

    try {
      const results = await scanDirectory(process.cwd(), ['.ts']);
      const matches = results.get(testFile);
      expect(matches?.some(m => m.patternId === 'trailing-whitespace')).toBe(true);
    } finally {
      await unlink(testFile);
    }
  });

  it('should detect missing EOF newline', async () => {
    const { writeFile, unlink } = await import('fs/promises');
    const { join } = await import('path');

    const testFile = join(process.cwd(), 'test-newline.ts');
    // File without trailing newline
    const testCode = 'line1\nline2';

    await writeFile(testFile, testCode);

    try {
      const results = await scanDirectory(process.cwd(), ['.ts']);
      const matches = results.get(testFile);
      expect(matches?.some(m => m.patternId === 'missing-eof-newline')).toBe(true);
    } finally {
      await unlink(testFile);
    }
  });

  it('should exclude specified directories', async () => {
    const { scanDirectory } = await import('../evolution/patterns.js');

    // Scan with excludes should not find files in __tests__
    const results = await scanDirectory('src', ['.ts'], { exclude: ['__tests__'] });

    // Should not have any entries from __tests__
    for (const file of results.keys()) {
      expect(file).not.toMatch(/__tests__/);
    }
  });
  it('should detect globalThis usage', async () => {
    const { writeFile, unlink } = await import('fs/promises');
    const { join } = await import('path');

    const testFile = join(process.cwd(), 'test-globalThis.ts');
    const testCode = 'const x = globalThis.someValue;';

    await writeFile(testFile, testCode);

    try {
      const results = await scanDirectory(process.cwd(), ['.ts']);
      const matches = results.get(testFile);
      expect(matches?.some(m => m.patternId === 'avoid-global-object')).toBe(true);
    } finally {
      await unlink(testFile);
    }
  });
});

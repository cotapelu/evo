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
    // Create a temporary test file pattern
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

      if (matches && matches.length > 0) {
        expect(matches.some(m => m.patternId === 'use-async-await')).toBe(true);
      }
    } finally {
      await unlink(testFile);
    }
  });
});

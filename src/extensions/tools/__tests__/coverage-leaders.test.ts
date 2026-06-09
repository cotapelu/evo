import { jest } from '@jest/globals';
import { registerCoverageLeadersTool } from '../coverage-leaders.js';
import { mkdtemp, rmdir, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Text } from '@earendil-works/pi-tui';

describe('Coverage Leaders Tool', () => {
  let api: any;
  let tool: any;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cov-test-'));
    const ctx = { cwd: tempDir } as any;

    jest.clearAllMocks();

    api = { registerTool: jest.fn() } as any;
    registerCoverageLeadersTool(api);
    tool = api.registerTool.mock.calls[0][0];

    (tool as any).testCtx = ctx;
  });

  afterEach(async () => {
    try {
      await rmdir(tempDir, { recursive: true });
    } catch (e) {
      // ignore
    }
  });

  test('tool metadata', () => {
    expect(tool.name).toBe('coverage-leaders');
    expect(tool.label).toBe('Coverage Leaders');
    expect(tool.description).toContain('coverage');
    expect(tool.description).toContain('top');
    expect(tool.description).toContain('bottom');
  });

  test('execute: returns error when coverage file missing', async () => {
    const ctx = (tool as any).testCtx;
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.details?.error).toBe('coverage file missing');
  });

  test('execute: returns leaders when file exists with multiple files', async () => {
    const ctx = (tool as any).testCtx;
    const coverageDir = join(tempDir, 'coverage');
    await mkdir(coverageDir, { recursive: true });
    const summaryPath = join(coverageDir, 'coverage-summary.json');
    const mockSummary = {
      total: { statements: { pct: 85 } },
      'src/high.ts': {
        statements: { total: 50, covered: 50, pct: 100 },
        branches: { total: 10, covered: 10, pct: 100 },
        lines: { total: 50, covered: 50, pct: 100 },
        functions: { total: 5, covered: 5, pct: 100 },
      },
      'src/medium.ts': {
        statements: { total: 30, covered: 15, pct: 50 },
        branches: { total: 5, covered: 2, pct: 40 },
        lines: { total: 30, covered: 15, pct: 50 },
        functions: { total: 3, covered: 2, pct: 66.6 },
      },
      'src/low.ts': {
        statements: { total: 20, covered: 10, pct: 50 },
        branches: { total: 4, covered: 2, pct: 50 },
        lines: { total: 20, covered: 10, pct: 50 },
        functions: { total: 2, covered: 1, pct: 50 },
      },
    };
    await writeFile(summaryPath, JSON.stringify(mockSummary));
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].type).toBe('text');
    const text = result.content[0].text as string;
    expect(text).toContain('Coverage Leaders');
    expect(text).toContain('Top 5');
    expect(text).toContain('Bottom 5');
    expect(text).toContain('Total files analyzed: 3');
    // Files should be sorted: high.ts (100) should be top, low.ts (50) and medium.ts (50) bottom (order may vary for equal pct)
    expect(text).toContain('high.ts');
    expect(text).toContain('low.ts');
    expect(text).toContain('medium.ts');
  });

  test('execute: filters out files with zero statements', async () => {
    const ctx = (tool as any).testCtx;
    const coverageDir = join(tempDir, 'coverage');
    await mkdir(coverageDir, { recursive: true });
    const summaryPath = join(coverageDir, 'coverage-summary.json');
    await writeFile(summaryPath, JSON.stringify({
      'src/zero.ts': { statements: { total: 0, covered: 0, pct: 0 } },
      'src/valid.ts': { statements: { total: 10, covered: 9, pct: 90 } },
    }));
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.details.totalFiles).toBe(1);
    const text = result.content[0].text as string;
    expect(text).toContain('valid.ts');
    expect(text).not.toContain('zero.ts');
  });

  test('execute: handles single file (appears in both top and bottom)', async () => {
    const ctx = (tool as any).testCtx;
    const coverageDir = join(tempDir, 'coverage');
    await mkdir(coverageDir, { recursive: true });
    const summaryPath = join(coverageDir, 'coverage-summary.json');
    await writeFile(summaryPath, JSON.stringify({
      'src/single.ts': { statements: { total: 10, covered: 5, pct: 50 } },
    }));
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    const text = result.content[0].text as string;
    expect(text).toContain('single.ts');
    // Both sections include the file
    expect(text).toMatch(/Top 5[\s\S]*single.ts[\s\S]*Bottom 5[\s\S]*single.ts/);
  });

  test('execute: uses alternative key stmts when statements missing', async () => {
    const ctx = (tool as any).testCtx;
    const coverageDir = join(tempDir, 'coverage');
    await mkdir(coverageDir, { recursive: true });
    const summaryPath = join(coverageDir, 'coverage-summary.json');
    await writeFile(summaryPath, JSON.stringify({
      'src/file.ts': { stmts: { total: 10, covered: 8, pct: 80 } },
    }));
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.details.totalFiles).toBe(1);
  });

  test('execute: handles malformed JSON', async () => {
    const ctx = (tool as any).testCtx;
    const coverageDir = join(tempDir, 'coverage');
    await mkdir(coverageDir, { recursive: true });
    const summaryPath = join(coverageDir, 'coverage-summary.json');
    await writeFile(summaryPath, '{invalid json');
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error reading coverage');
  });

  test('renderCall returns Text with proper styling', () => {
    const theme = { fg: (c: string, t: string) => (c === 'toolTitle' ? `T:${t}` : t), bold: (t: string) => `B:${t}` };
    const rendered = tool.renderCall({}, theme);
    expect(rendered).toBeInstanceOf(Text);
    expect(rendered.text).toContain('coverage-leaders');
  });

  test('renderResult: loading state', () => {
    const theme = { fg: (c: string, t: string) => t };
    const rendered = tool.renderResult({ isError: false, details: {} }, { expanded: false, isPartial: true }, theme);
    expect(rendered.text).toContain('Loading');
  });

  test('renderResult: error state', () => {
    const theme = { fg: (c: string, t: string) => (c === 'error' ? `E:${t}` : t) };
    const rendered = tool.renderResult({ isError: true, details: { error: 'test' } }, { expanded: false, isPartial: false }, theme);
    expect(rendered.text).toContain('Error');
  });

  test('renderResult: no data state', () => {
    const theme = { fg: (c: string, t: string) => t };
    const rendered = tool.renderResult({ isError: false, details: { totalFiles: 0 } }, { expanded: false, isPartial: false }, theme);
    expect(rendered.text).toContain('No data');
  });

  test('renderResult: success state shows count', () => {
    const theme = { fg: (c: string, t: string) => (c === 'success' ? `S:${t}` : t) };
    const rendered = tool.renderResult(
      { isError: false, details: { totalFiles: 10, top: [{ statements: { pct: 90 } }] } },
      { expanded: false, isPartial: false },
      theme
    );
    expect(rendered.text).toContain('10 files');
  });
});

import { jest } from '@jest/globals';
import { registerCoverageTool } from '../coverage-tool.js';
import { mkdtemp, rmdir, writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Coverage Tool', () => {
  let api: any;
  let tool: any;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cov-test-'));
    const ctx = { cwd: tempDir } as any;

    jest.clearAllMocks();

    api = { registerTool: jest.fn() } as any;
    registerCoverageTool(api);
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
    expect(tool.name).toBe('coverage');
    expect(tool.label).toBe('Coverage');
    expect(tool.description).toContain('coverage');
  });

  test('execute: returns error when coverage file missing', async () => {
    const ctx = (tool as any).testCtx;
    // No coverage file created
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.details?.error).toBe('coverage file missing');
  });

  test('execute: returns coverage data when file exists', async () => {
    const ctx = (tool as any).testCtx;
    const coverageDir = join(tempDir, 'coverage');
    await mkdir(coverageDir, { recursive: true });
    const summaryPath = join(coverageDir, 'coverage-summary.json');
    const mockSummary = {
      total: {
        statements: { pct: 85.5, covered: 100, total: 117 },
        branches: { pct: 72.3, covered: 50, total: 69 },
        functions: { pct: 90.1, covered: 28, total: 31 },
        lines: { pct: 87.2, covered: 105, total: 120 },
      },
    };
    await writeFile(summaryPath, JSON.stringify(mockSummary));
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('85.5%');
    expect(result.details?.total?.statements?.pct).toBe(85.5);
  });

  test('execute: handles empty coverage data', async () => {
    const ctx = (tool as any).testCtx;
    const coverageDir = join(tempDir, 'coverage');
    await mkdir(coverageDir, { recursive: true });
    const summaryPath = join(coverageDir, 'coverage-summary.json');
    await writeFile(summaryPath, JSON.stringify({}));
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    // Should show 0% for all
    expect(result.content[0].text).toContain('0%');
  });

  test('renderCall produces Text', () => {
    const theme = { fg: (c: string, s: string) => s, bold: (s: string) => s };
    const txt = tool.renderCall({}, theme);
    expect(txt).toBeDefined();
  });

  test('renderResult shows success state', () => {
    const theme = { fg: (c: string, s: string) => s, success: (s: string) => s, warning: (s: string) => s, error: (s: string) => s };
    const result = tool.renderResult({ details: { total: { statements: { pct: 85 } } } }, { expanded: false, isPartial: false }, theme);
    expect(result).toBeDefined();
  });
});
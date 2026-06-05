import { jest } from '@jest/globals';
import { registerCoverageHistoryTool } from '../coverage-history-tool.js';
import { mkdtemp, rmdir, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Coverage History Tool', () => {
  let api: any;
  let tool: any;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cov-hist-'));
    const ctx = { cwd: tempDir } as any;

    jest.clearAllMocks();

    api = { registerTool: jest.fn() } as any;
    registerCoverageHistoryTool(api);
    tool = api.registerTool.mock.calls[0][0];

    (tool as any).testCtx = ctx;
  });

  afterEach(async () => {
    try {
      await rmdir(tempDir, { recursive: true });
    } catch (e) {}
  });

  test('tool metadata', () => {
    expect(tool.name).toBe('coverage-history');
    expect(tool.label).toBe('Coverage History');
    expect(tool.description).toContain('trends');
  });

  test('execute: returns error when history file missing', async () => {
    const ctx = (tool as any).testCtx;
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.details?.error).toBe('no history');
  });

  test('execute: returns formatted history when file exists', async () => {
    const ctx = (tool as any).testCtx;
    const historyDir = join(tempDir, '.pi');
    await mkdir(historyDir, { recursive: true });
    await writeFile(join(historyDir, 'coverage-history.json'), JSON.stringify([
      { timestamp: '2024-01-01T00:00:00.000Z', statements: 80, branches: 70, functions: 85, lines: 82 },
      { timestamp: '2024-01-02T00:00:00.000Z', statements: 81, branches: 71, functions: 86, lines: 83 },
    ]), 'utf-8');
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Coverage History');
    expect(result.content[0].text).toContain('80%');
    expect(result.details?.count).toBe(2);
  });

  test('execute: handles empty history array', async () => {
    const ctx = (tool as any).testCtx;
    const historyDir = join(tempDir, '.pi');
    await mkdir(historyDir, { recursive: true });
    await writeFile(join(historyDir, 'coverage-history.json'), JSON.stringify([]), 'utf-8');
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('empty');
  });

  test('renderCall produces Text', () => {
    const theme = { fg: (c: string, s: string) => s, bold: (s: string) => s };
    const txt = tool.renderCall({}, theme);
    expect(txt).toBeDefined();
  });

  test('renderResult shows count', () => {
    const theme = { fg: (c: string, s: string) => s, accent: (s: string) => s };
    const result = tool.renderResult({ details: { count: 5 } }, { expanded: false, isPartial: false }, theme);
    expect(result).toBeDefined();
  });
});
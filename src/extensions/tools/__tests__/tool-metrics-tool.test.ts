import { jest } from '@jest/globals';
import { mkdtemp, rmdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { registerToolMetricsTool } from '../tool-metrics-tool.js';

describe('Tool Metrics Tool', () => {
  let api: any;
  let tool: any;
  let tempCwd: string;

  beforeAll(async () => {
    tempCwd = await mkdtemp(join(tmpdir(), 'evo-tool-metrics-test-'));
    api = { registerTool: jest.fn() };
    registerToolMetricsTool(api);
    tool = api.registerTool.mock.calls[0][0];
  });

  afterAll(async () => {
    try {
      await rmdir(tempCwd, { recursive: true });
    } catch {
      // ignore
    }
  });

  test('tool metadata', () => {
    expect(tool.name).toBe('tool-metrics');
    expect(tool.label).toBe('Tool Metrics');
    expect(tool.description).toContain('statistics');
  });

  test('execute: no metrics file (ENOENT) returns friendly message', async () => {
    const ctx = { cwd: tempCwd };
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('No metrics file found');
  });

  test('execute: empty metrics file returns no records message', async () => {
    const metricsDir = join(tempCwd, '.pi');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(metricsDir, { recursive: true });
    await writeFile(join(metricsDir, 'tool-metrics.ndjson'), '', 'utf-8');
    const ctx = { cwd: tempCwd };
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('No metrics recorded yet.');
  });

  test('execute: with valid metrics aggregates correctly', async () => {
    const metricsDir = join(tempCwd, '.pi');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(metricsDir, { recursive: true });
    const data = [
      JSON.stringify({ toolName: 'todos', duration: 100, success: true }),
      JSON.stringify({ toolName: 'todos', duration: 200, success: true }),
      JSON.stringify({ toolName: 'todos', duration: 150, success: false }),
      JSON.stringify({ toolName: 'memory', duration: 50, success: true }),
    ].join('\n');
    await writeFile(join(metricsDir, 'tool-metrics.ndjson'), data, 'utf-8');
    const ctx = { cwd: tempCwd };
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    const text = result.content[0].text;
    expect(text).toContain('todos');
    expect(text).toContain('memory');
    // Check todos stats: runs=3, avg=(100+200+150)/3=150, error% = 1/3*100 = 33.3%
    expect(text).toMatch(/todos.*\|\s*3\s*\|\s*150\.0/);
    expect(text).toMatch(/memory.*\|\s*1\s*\|\s*50\.0/);
  });

  test('execute: handles invalid JSON lines gracefully', async () => {
    const metricsDir = join(tempCwd, '.pi');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(metricsDir, { recursive: true });
    const data = [
      JSON.stringify({ toolName: 'todos', duration: 100, success: true }),
      'invalid json line',
      JSON.stringify({ toolName: 'memory', duration: 50, success: true }),
    ].join('\n');
    await writeFile(join(metricsDir, 'tool-metrics.ndjson'), data, 'utf-8');
    const ctx = { cwd: tempCwd };
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    const text = result.content[0].text;
    expect(text).toContain('todos');
    expect(text).toContain('memory');
    // Should have aggregated only the two valid entries
    expect(text).toMatch(/todos.*\|\s*1\s*\|\s*100\.0/);
    expect(text).toMatch(/memory.*\|\s*1\s*\|\s*50\.0/);
  });

  test('renderCall produces Text', () => {
    const theme = { fg: (c: string, s: string) => s, bold: (s: string) => s };
    const txt = tool.renderCall({}, theme);
    expect(txt).toBeDefined();
  });

  test('renderResult handles various states', () => {
    const theme = { fg: (c: string, s: string) => s, accent: (s: string) => s, error: (s: string) => s, warning: (s: string) => s };
    const resultWithRuns = tool.renderResult({ details: { totalRuns: 10, tools: 3 } }, { expanded: false, isPartial: false }, theme);
    expect(resultWithRuns).toBeDefined();
    const errorResult = tool.renderResult({ isError: true }, { expanded: false, isPartial: false }, theme);
    expect(errorResult).toBeDefined();
    const partialResult = tool.renderResult({}, { expanded: false, isPartial: true }, theme);
    expect(partialResult).toBeDefined();
  });
});

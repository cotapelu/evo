import { jest } from '@jest/globals';
import { registerPerformanceAdvisorTool } from '../performance-advisor-tool.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function createMockApi() {
  return {
    registerTool: jest.fn(),
  } as any;
}

function createMockCwd(tempDir: string) {
  return { cwd: tempDir, api: {} } as any;
}

describe('Performance Advisor Tool', () => {
  let api: any;
  let tool: any;

  beforeEach(() => {
    jest.clearAllMocks();
    api = createMockApi();
    registerPerformanceAdvisorTool(api);
    tool = api.registerTool.mock.calls[0][0];
  });

  test('tool metadata', () => {
    expect(tool.name).toBe('performance_advisor');
    expect(tool.label).toBe('Performance Advisor');
    expect(tool.description).toBeTruthy();
    expect(tool.parameters).toEqual({ type: 'object', properties: {} });
  });

  async function setupMetricsFile(cwd: string, lines: string[]) {
    const fileDir = join(cwd, '.pi');
    await mkdir(fileDir, { recursive: true });
    const filePath = join(fileDir, 'tool-metrics.ndjson');
    if (lines.length === 0) {
      await writeFile(filePath, '');
    } else {
      await writeFile(filePath, lines.join('\n') + '\n');
    }
    return filePath;
  }

  test('execute: empty metrics → no data suggestion', async () => {
    const tmp = await tmpdir();
    const cwd = join(tmp, 'perf-adv-test-empty');
    await mkdir(cwd, { recursive: true });
    const ctx = createMockCwd(cwd);
    const filePath = await setupMetricsFile(cwd, []);

    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    const text = result.content[0].text;
    expect(text).toContain('No tool metrics collected yet');
    expect(result.details.tools).toEqual([]);

    await unlink(filePath).catch(() => {});
  });

  test('execute: metrics with single entry', async () => {
    const tmp = await tmpdir();
    const cwd = join(tmp, 'perf-adv-single');
    await mkdir(cwd, { recursive: true });
    const ctx = createMockCwd(cwd);
    const base = Date.now();
    const filePath = await setupMetricsFile(cwd, [
      JSON.stringify({ toolName: 'test-tool', duration: 1000, success: true, timestamp: base }),
    ]);

    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.details.tools).toHaveLength(1);
    expect(result.details.tools[0].toolName).toBe('test-tool');
    expect(result.details.totalInvocations).toBe(1);
    expect(result.details.overallAvgDuration).toBe(1000);
    expect(result.details.overallErrorRate).toBe(0);

    await unlink(filePath).catch(() => {});
  });

  test('execute: multiple metrics, sorting by avg duration descending', async () => {
    const tmp = await tmpdir();
    const cwd = join(tmp, 'perf-adv-multi');
    await mkdir(cwd, { recursive: true });
    const ctx = createMockCwd(cwd);
    const base = Date.now();
    const filePath = await setupMetricsFile(cwd, [
      JSON.stringify({ toolName: 'slow-tool', duration: 3000, success: true, timestamp: base }),
      JSON.stringify({ toolName: 'slow-tool', duration: 3500, success: true, timestamp: base + 1 }),
      JSON.stringify({ toolName: 'fast-tool', duration: 100, success: true, timestamp: base + 2 }),
      JSON.stringify({ toolName: 'fast-tool', duration: 200, success: true, timestamp: base + 3 }),
      JSON.stringify({ toolName: 'medium-tool', duration: 1000, success: true, timestamp: base + 4 }),
    ]);

    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    const tools = result.details.tools;
    expect(tools).toHaveLength(3);
    expect(tools[0].toolName).toBe('slow-tool');
    expect(tools[1].toolName).toBe('medium-tool');
    expect(tools[2].toolName).toBe('fast-tool');

    await unlink(filePath).catch(() => {});
  });

  test('execute: suggests slow tools (>2000ms)', async () => {
    const tmp = await tmpdir();
    const cwd = join(tmp, 'perf-adv-slow');
    await mkdir(cwd, { recursive: true });
    const ctx = createMockCwd(cwd);
    const base = Date.now();
    const filePath = await setupMetricsFile(cwd, [
      JSON.stringify({ toolName: 'slow-tool', duration: 2500, success: true, timestamp: base }),
      JSON.stringify({ toolName: 'slow-tool', duration: 2600, success: true, timestamp: base + 1 }),
    ]);

    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    const text = result.content[0].text;
    expect(text).toContain('Consider optimizing slow tools: slow-tool');

    await unlink(filePath).catch(() => {});
  });

  test('execute: suggests error-prone tools (error rate >20%)', async () => {
    const tmp = await tmpdir();
    const cwd = join(tmp, 'perf-adv-error-prone');
    await mkdir(cwd, { recursive: true });
    const ctx = createMockCwd(cwd);
    const base = Date.now();
    const entries = [
      { toolName: 'flaky-tool', duration: 100, success: false, timestamp: base },
      { toolName: 'flaky-tool', duration: 100, success: false, timestamp: base + 1 },
      { toolName: 'flaky-tool', duration: 100, success: false, timestamp: base + 2 },
      { toolName: 'flaky-tool', duration: 100, success: true, timestamp: base + 3 },
    ].map(JSON.stringify);
    const filePath = await setupMetricsFile(cwd, entries);

    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    const text = result.content[0].text;
    expect(text).toContain('High failure rate on: flaky-tool');

    await unlink(filePath).catch(() => {});
  });

  test('execute: suggests metrics cleanup if total invocations > 1000', async () => {
    const tmp = await tmpdir();
    const cwd = join(tmp, 'perf-adv-many');
    await mkdir(cwd, { recursive: true });
    const ctx = createMockCwd(cwd);
    const base = Date.now();
    const entries = Array.from({ length: 1001 }, (_, i) => ({
      toolName: 'tool-a',
      duration: 50,
      success: true,
      timestamp: base + i,
    })).map(JSON.stringify);
    const filePath = await setupMetricsFile(cwd, entries);

    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    const text = result.content[0].text;
    expect(text).toContain('Metrics file is getting large');

    await unlink(filePath).catch(() => {});
  });

  test('execute: overall error rate high (>10%)', async () => {
    const tmp = await tmpdir();
    const cwd = join(tmp, 'perf-adv-high-err');
    await mkdir(cwd, { recursive: true });
    const ctx = createMockCwd(cwd);
    const base = Date.now();
    const entries = Array.from({ length: 100 }, (_, i) => ({
      toolName: 'tool-a',
      duration: 100,
      success: i < 11,
      timestamp: base + i,
    })).map(JSON.stringify);
    const filePath = await setupMetricsFile(cwd, entries);

    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    const text = result.content[0].text;
    expect(text).toContain('Overall error rate is high');

    await unlink(filePath).catch(() => {});
  });

  test('execute: all good when no issues', async () => {
    const tmp = await tmpdir();
    const cwd = join(tmp, 'perf-adv-good');
    await mkdir(cwd, { recursive: true });
    const ctx = createMockCwd(cwd);
    const base = Date.now();
    const filePath = await setupMetricsFile(cwd, [
      JSON.stringify({ toolName: 'good-tool', duration: 100, success: true, timestamp: base }),
      JSON.stringify({ toolName: 'good-tool', duration: 150, success: true, timestamp: base + 1 }),
    ]);

    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    const text = result.content[0].text;
    expect(text).toContain('Performance looks good! No major issues detected.');

    await unlink(filePath).catch(() => {});
  });

  test('execute: handles ENOENT (file not found)', async () => {
    const tmp = await tmpdir();
    const cwd = join(tmp, 'perf-adv-enoent');
    await mkdir(cwd, { recursive: true });
    const ctx = createMockCwd(cwd);
    // Delete the metrics file if somehow exists, ensure it's absent

    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.details.suggestions).toContain('No metrics data available.');
  });

  test('execute: handles EISDIR (path is a directory)', async () => {
    const tmp = await tmpdir();
    const cwd = join(tmp, 'perf-adv-eisdir');
    await mkdir(cwd, { recursive: true });
    // Create a directory at the metrics file path
    const badPath = join(cwd, '.pi', 'tool-metrics.ndjson');
    await mkdir(badPath, { recursive: true });
    const ctx = createMockCwd(cwd);

    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    // The tool will treat this as a read error and include error message
    expect(result.details.suggestions.some(s => s.includes('Error reading metrics'))).toBe(true);

    await unlink(badPath, { recursive: true }).catch(() => {});
  });


  test('execute: skips invalid JSON lines', async () => {
    const tmp = await tmpdir();
    const cwd = join(tmp, 'perf-adv-invalid-json');
    await mkdir(cwd, { recursive: true });
    const ctx = createMockCwd(cwd);
    const base = Date.now();
    const filePath = await setupMetricsFile(cwd, [
      JSON.stringify({ toolName: 'good', duration: 100, success: true, timestamp: base }),
      'invalid json line',
      JSON.stringify({ toolName: 'good', duration: 200, success: true, timestamp: base + 1 }),
    ]);

    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.details.tools[0].invocations).toBe(2);

    await unlink(filePath).catch(() => {});
  });

  test('execute: skips entries missing required fields', async () => {
    const tmp = await tmpdir();
    const cwd = join(tmp, 'perf-adv-missing-fields');
    await mkdir(cwd, { recursive: true });
    const ctx = createMockCwd(cwd);
    const base = Date.now();
    const filePath = await setupMetricsFile(cwd, [
      JSON.stringify({ toolName: 'good', duration: 100, success: true, timestamp: base }),
      JSON.stringify({ toolName: 'incomplete', duration: 100 }), // missing success & timestamp
      JSON.stringify({ toolName: 'good', duration: 200, success: true, timestamp: base + 1 }),
    ]);

    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.details.tools).toHaveLength(1);
    expect(result.details.tools[0].invocations).toBe(2);

    await unlink(filePath).catch(() => {});
  });

  test('execute: limits output to top 20 tools by avg duration', async () => {
    const tmp = await tmpdir();
    const cwd = join(tmp, 'perf-adv-top20');
    await mkdir(cwd, { recursive: true });
    const ctx = createMockCwd(cwd);
    const base = Date.now();
    const entries = Array.from({ length: 30 }, (_, i) => ({
      toolName: `tool-${i}`,
      duration: 1000 + i * 100,
      success: true,
      timestamp: base + i,
    })).map(JSON.stringify);
    const filePath = await setupMetricsFile(cwd, entries);

    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.details.tools).toHaveLength(30);
    const text = result.content[0].text;
    const perToolSection = text.split('Per-tool stats:')[1];
    const lines = perToolSection?.trim().split('\n').filter(l => l.startsWith('-')) || [];
    expect(lines.length).toBe(20);

    await unlink(filePath).catch(() => {});
  });

  test('execute: handles metrics with zero duration', async () => {
    const tmp = await tmpdir();
    const cwd = join(tmp, 'perf-adv-zero');
    await mkdir(cwd, { recursive: true });
    const ctx = createMockCwd(cwd);
    const base = Date.now();
    const filePath = await setupMetricsFile(cwd, [
      JSON.stringify({ toolName: 'instant', duration: 0, success: true, timestamp: base }),
      JSON.stringify({ toolName: 'instant', duration: 0, success: true, timestamp: base + 1 }),
    ]);

    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.details.tools[0].avgDuration).toBe(0);

    await unlink(filePath).catch(() => {});
  });

  test('execute: handles extreme values', async () => {
    const tmp = await tmpdir();
    const cwd = join(tmp, 'perf-adv-extreme');
    await mkdir(cwd, { recursive: true });
    const ctx = createMockCwd(cwd);
    const base = Date.now();
    const filePath = await setupMetricsFile(cwd, [
      JSON.stringify({ toolName: 'extreme', duration: Number.MAX_SAFE_INTEGER, success: true, timestamp: base }),
      JSON.stringify({ toolName: 'extreme', duration: 0, success: true, timestamp: base + 1 }),
    ]);

    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.details.tools[0].avgDuration).toBeGreaterThan(1e15);

    await unlink(filePath).catch(() => {});
  });

});

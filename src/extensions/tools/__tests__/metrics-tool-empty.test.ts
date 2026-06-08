import { jest } from '@jest/globals';
import { registerMetricsTool } from '../metrics-tool.js';
import { mkdtemp, rmdir, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Metrics Tool – Empty File', () => {
  let api: any;
  let tool: any;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'metrics-empty-'));
    const ctx = { cwd: tempDir } as any;

    jest.resetAllMocks();

    api = { registerTool: jest.fn() } as any;
    registerMetricsTool(api);
    tool = api.registerTool.mock.calls[0][0];

    (tool as any).testCtx = ctx;
  });

  afterEach(async () => {
    try {
      await rmdir(tempDir, { recursive: true });
    } catch {}
  });

  test('handles empty metrics file', async () => {
    const ctx = (tool as any).testCtx;
    const docsDir = join(tempDir, 'docs');
    await mkdir(docsDir, { recursive: true });
    await writeFile(join(docsDir, 'AGENT_METRICS.md'), '');
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toBe('');
  });
});

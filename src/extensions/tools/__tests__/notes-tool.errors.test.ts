import { jest } from '@jest/globals';
import { mkdtemp, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { registerNotesTool } from '../notes-tool.js';

describe('Notes Tool – Error Cases', () => {
  let api: any;
  let tool: any;
  let tempCwd: string;

  beforeAll(async () => {
    tempCwd = await mkdtemp(join(tmpdir(), 'evo-notes-test-'));
    api = { registerTool: jest.fn() };
    registerNotesTool(api);
    tool = api.registerTool.mock.calls[0][0];
  });

  afterAll(async () => {
    try {
      await rmdir(tempCwd, { recursive: true });
    } catch {
      // ignore
    }
  });

  test('add without text returns error', async () => {
    const result = await tool.execute('1', { action: 'add' } as any, undefined, undefined, { cwd: tempCwd });
    expect(result.isError).toBe(true);
    expect(result.message).toBe('Missing text');
  });
});

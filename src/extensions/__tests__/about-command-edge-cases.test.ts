import { jest } from '@jest/globals';
import aboutCommand from '../about-command.js';
import { mkdtemp, rmdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('About Command – Edge Cases', () => {
  let api: any;

  beforeEach(() => {
    api = { registerCommand: jest.fn() };
  });

  test('handler uses fallback when package.json has no name', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'about-test-'));
    const pkgPath = join(tempDir, 'package.json');
    await writeFile(pkgPath, JSON.stringify({ version: '1.0.0' })); // missing name
    const mockNotify = jest.fn();
    aboutCommand(api);
    const { handler } = api.registerCommand.mock.calls[0][1];
    const ctx = { cwd: tempDir, ui: { notify: mockNotify } } as any;
    await handler('', ctx);
    // Should show fallback name 'evo'
    expect(mockNotify).toHaveBeenCalledWith(expect.stringMatching(/evo v1\.0\.0/), { type: 'info' });
    await rmdir(tempDir, { recursive: true });
  });

  test('handler uses fallback version when missing', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'about-test-'));
    const pkgPath = join(tempDir, 'package.json');
    await writeFile(pkgPath, JSON.stringify({ name: 'myapp' })); // missing version
    const mockNotify = jest.fn();
    aboutCommand(api);
    const { handler } = api.registerCommand.mock.calls[0][1];
    const ctx = { cwd: tempDir, ui: { notify: mockNotify } } as any;
    await handler('', ctx);
    expect(mockNotify).toHaveBeenCalledWith(expect.stringMatching(/myapp v0\.0\.1/), { type: 'info' });
    await rmdir(tempDir, { recursive: true });
  });

  test('handler uses fallback for both name and version', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'about-test-'));
    const pkgPath = join(tempDir, 'package.json');
    await writeFile(pkgPath, JSON.stringify({})); // empty
    const mockNotify = jest.fn();
    aboutCommand(api);
    const { handler } = api.registerCommand.mock.calls[0][1];
    const ctx = { cwd: tempDir, ui: { notify: mockNotify } } as any;
    await handler('', ctx);
    // Should use fallback values and succeed with info
    expect(mockNotify).toHaveBeenCalledWith(expect.stringMatching(/evo v0\.0\.1/), { type: 'info' });
    await rmdir(tempDir, { recursive: true });
  });
});

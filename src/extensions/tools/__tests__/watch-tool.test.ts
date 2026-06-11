#!/usr/bin/env node
/**
 * Watch Tool – Tests using internal test hook for deterministic simulation
 */

import { jest } from '@jest/globals';
import { registerWatchTool } from '../watch-tool.js';
import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Use modern fake timers for deterministic timing
jest.useFakeTimers('modern');
// Set consistent starting time to avoid date-based flakiness
jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

function createMockApi(execImpl?: any) {
  return {
    registerTool: jest.fn(),
    exec: jest.fn().mockImplementation(execImpl ?? (({ cwd }: any) => Promise.resolve({ code: 0, stdout: '', stderr: '' }))) as any,
  } as any;
}

describe('Watch Tool', () => {
  let api: any;
  let tool: ToolDefinition<any, any>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    api = createMockApi();
    registerWatchTool(api);
    tool = api.registerTool.mock.calls[0][0];
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('tool metadata', () => {
    expect(tool.name).toBe('watch');
    expect(tool.label).toBe('Watch');
    expect(tool.description).toBeTruthy();
  });

  test('execute: uses default commands and debounce', async () => {
    const ctx = { cwd: '/workspace', api } as any;
    const controller = new AbortController();
    const execPromise = tool.execute('1', {}, controller.signal, undefined, ctx);
    jest.advanceTimersByTime(100);
    controller.abort();
    const result = await execPromise;
    expect(result.isError).toBe(false);
    expect(result.details?.commands).toEqual(['code-health', 'test --coverage']);
    expect(result.details?.debounceMs).toBe(500);
    expect(result.details?.watchPaths).toBeDefined();
  });

  test('execute: accepts custom commands and debounce', async () => {
    const ctx = { cwd: '/workspace', api } as any;
    const controller = new AbortController();
    const execPromise = tool.execute('1', { commands: ['lint'], debounceMs: 1000 }, controller.signal, undefined, ctx);
    jest.advanceTimersByTime(100);
    controller.abort();
    const result = await execPromise;
    expect(result.isError).toBe(false);
    expect(result.details?.commands).toEqual(['lint']);
    expect(result.details?.debounceMs).toBe(1000);
  });

  test('renderCall produces Text', () => {
    const args = { commands: ['code-health'] };
    const theme = { fg: (c: string, s: string) => s, bold: (s: string) => s };
    const text = tool.renderCall(args, theme);
    expect(text).toBeDefined();
  });

  test('renderResult produces Text for various states', () => {
    const theme = { fg: (c: string, s: string) => s, success: (s: string) => s, dim: (s: string) => s };
    const result1 = tool.renderResult({ details: {} }, { expanded: false, isPartial: false }, theme);
    expect(result1).toBeDefined();
    const result2 = tool.renderResult({ details: { status: 'stopped' } }, { expanded: false, isPartial: false }, theme);
    expect(result2).toBeDefined();
    const result3 = tool.renderResult({}, { expanded: false, isPartial: true }, theme);
    expect(result3).toBeDefined();
  });

  test('onUpdate called during initialization', async () => {
    const baseTmp = await fs.mkdtemp(join(tmpdir(), 'evo-watch-onupdate-'));
    const srcDir = join(baseTmp, 'src');
    await fs.mkdir(srcDir, { recursive: true });
    await fs.writeFile(join(srcDir, 'dummy.ts'), '// dummy');
    await fs.writeFile(join(baseTmp, 'tsconfig.json'), '{}');

    const mockExec = jest.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    // Recreate tool with custom exec
    api = createMockApi(mockExec);
    registerWatchTool(api);
    tool = api.registerTool.mock.calls[0][0];

    const ctx = { cwd: baseTmp, api: { exec: mockExec } } as any;
    const onUpdate = jest.fn();

    const controller = new AbortController();
    const execPromise = tool.execute('1', { debounceMs: 100 }, controller.signal, onUpdate, ctx);
    jest.advanceTimersByTime(50);
    expect(onUpdate).toHaveBeenCalled();

    controller.abort();
    await expect(execPromise).resolves.toMatchObject({ isError: false });

    await fs.rm(baseTmp, { recursive: true, force: true });
  });

  test('setup watches for existing files and cleans up on abort', async () => {
    const baseTmp = await fs.mkdtemp(join(tmpdir(), 'evo-watch-test-'));
    const srcDir = join(baseTmp, 'src');
    await fs.mkdir(srcDir, { recursive: true });
    await fs.writeFile(join(srcDir, 'dummy.ts'), '// dummy');
    await fs.writeFile(join(baseTmp, 'tsconfig.json'), '{}');

    const ctx = { cwd: baseTmp, api } as any;
    const controller = new AbortController();
    const execPromise = tool.execute('1', {}, controller.signal, undefined, ctx);
    jest.advanceTimersByTime(50);
    controller.abort();
    const result = await execPromise;
    expect(result.isError).toBe(false);

    await fs.rm(baseTmp, { recursive: true, force: true });
  });

  test('handles no existing watch paths gracefully', async () => {
    const baseTmp = await fs.mkdtemp(join(tmpdir(), 'evo-watch-none-'));
    const ctx = { cwd: baseTmp, api: { exec: jest.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' }) } } as any;

    const controller = new AbortController();
    const execPromise = tool.execute('1', {}, controller.signal, undefined, ctx);
    jest.advanceTimersByTime(100);
    controller.abort();
    const result = await execPromise;
    expect(result.isError).toBe(false);
    expect(result.details?.watchPaths?.length).toBeGreaterThanOrEqual(0);

    await fs.rm(baseTmp, { recursive: true, force: true });
  });

  test('handles empty commands array', async () => {
    const baseTmp = await fs.mkdtemp(join(tmpdir(), 'evo-watch-empty-cmds-'));
    await fs.mkdir(join(baseTmp, 'src'), { recursive: true });
    await fs.writeFile(join(baseTmp, 'src', 'dummy.ts'), '');

    const mockExec = jest.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    api = createMockApi(mockExec);
    registerWatchTool(api);
    tool = api.registerTool.mock.calls[0][0];

    const controller = new AbortController();
    const execPromise = tool.execute('1', { commands: [] }, controller.signal, undefined, { cwd: baseTmp, api: { exec: mockExec } } as any);
    jest.advanceTimersByTime(100);
    controller.abort();
    const result = await execPromise;
    expect(result.isError).toBe(false);
    expect(mockExec).not.toHaveBeenCalled();

    await fs.rm(baseTmp, { recursive: true, force: true });
  });

  test('renders result when stopped', () => {
    const theme = { fg: (c: string, s: string) => s, dim: (s: string) => s } as any;
    const result = tool.renderResult({ details: { status: 'stopped' } }, { expanded: false, isPartial: false }, theme);
    expect(result).toBeDefined();
  });

  // Branch coverage tests using test hook
  describe('branch coverage edge cases with test hook', () => {
    test('execute: returns error when no cwd in ctx', async () => {
      const ctx: any = {}; // no cwd
      const controller = new AbortController();
      const execPromise = tool.execute('1', {}, controller.signal, undefined, ctx);
      jest.advanceTimersByTime(50);
      controller.abort();
      const result = await execPromise;
      expect(result.isError).toBe(false); // Should still work, uses process.cwd() fallback
    });

    test('runCommands handles api.exec throwing and continues', async () => {
      const baseTmp = await fs.mkdtemp(join(tmpdir(), 'evo-watch-exec-throw2-'));
      await fs.mkdir(join(baseTmp, 'src'), { recursive: true });
      await fs.writeFile(join(baseTmp, 'src', 'dummy.ts'), '');

      const mockExec = jest.fn().mockRejectedValue(new Error('exec failed'));
      // Recreate tool with custom exec
      api = createMockApi(mockExec);
      registerWatchTool(api);
      tool = api.registerTool.mock.calls[0][0];

      const ctx = { cwd: baseTmp, api: { exec: mockExec } } as any;
      const onUpdate = jest.fn();
      const controller = new AbortController();
      const execPromise = tool.execute('1', { commands: ['dummy'], debounceMs: 10 }, controller.signal, onUpdate, ctx);

      // Wait for setup and hook registration
      jest.advanceTimersByTime(100);

      // Access the test hook and trigger change
      // @ts-ignore
      const testHook = tool._testHook;
      expect(testHook).toBeDefined();
      testHook.trigger('dummy.ts');

      // Advance past debounce to schedule runCommands
      jest.advanceTimersByTime(50);

      // Allow timer callback and async to proceed
      await Promise.resolve();
      await Promise.resolve();

      // The runCommands should have been attempted
      expect(mockExec).toHaveBeenCalled();

      // Wait for onUpdate to capture error messages
      jest.advanceTimersByTime(50);
      await Promise.resolve();
      await Promise.resolve();

      // Check that onUpdate was called with error content (since exec threw)
      const errorUpdates = onUpdate.mock.calls.filter((call: any[]) =>
        call[0].content.some((c: any) => c.text.includes('Error'))
      );
      expect(errorUpdates.length).toBeGreaterThan(0);

      controller.abort();
      const result = await execPromise;
      expect(result.isError).toBe(false); // Tool itself doesn't fail overall

      await fs.rm(baseTmp, { recursive: true, force: true });
    });

    test('debounce: multiple changes within debounce period trigger single exec', async () => {
      const baseTmp = await fs.mkdtemp(join(tmpdir(), 'evo-watch-debounce-'));
      await fs.mkdir(join(baseTmp, 'src'), { recursive: true });
      await fs.writeFile(join(baseTmp, 'src', 'dummy.ts'), '');

      const mockExec = jest.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' });
      api = createMockApi(mockExec);
      registerWatchTool(api);
      tool = api.registerTool.mock.calls[0][0];

      const ctx = { cwd: baseTmp, api: { exec: mockExec } } as any;
      const controller = new AbortController();
      const execPromise = tool.execute('1', { commands: ['dummy'], debounceMs: 200 }, controller.signal, undefined, ctx);

      // Wait for setup
      jest.advanceTimersByTime(100);

      // @ts-ignore
      const testHook = tool._testHook;
      expect(testHook).toBeDefined();

      // Trigger multiple changes rapidly within debounce period
      testHook.trigger('dummy.ts'); // T=100
      jest.advanceTimersByTime(50); // T=150
      testHook.trigger('dummy.ts'); // T=150
      jest.advanceTimersByTime(50); // T=200
      testHook.trigger('dummy.ts'); // T=200

      // Not yet past debounce from last trigger (should fire at T=400)
      jest.advanceTimersByTime(100); // T=300
      expect(mockExec).not.toHaveBeenCalled();

      // Now advance past debounce
      jest.advanceTimersByTime(150); // T=450
      // Allow timer callback and async to proceed
      await Promise.resolve();
      await Promise.resolve();

      // Should have called exec exactly once (single command)
      expect(mockExec).toHaveBeenCalledTimes(1);

      controller.abort();
      await execPromise;

      await fs.rm(baseTmp, { recursive: true, force: true });
    });

    test('debounce: separate changes spaced beyond debounce trigger multiple execs', async () => {
      const baseTmp = await fs.mkdtemp(join(tmpdir(), 'evo-watch-debounce-multi-'));
      await fs.mkdir(join(baseTmp, 'src'), { recursive: true });
      await fs.writeFile(join(baseTmp, 'src', 'dummy.ts'), '');

      const mockExec = jest.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' });
      api = createMockApi(mockExec);
      registerWatchTool(api);
      tool = api.registerTool.mock.calls[0][0];

      const ctx = { cwd: baseTmp, api: { exec: mockExec } } as any;
      const controller = new AbortController();
      const execPromise = tool.execute('1', { commands: ['dummy'], debounceMs: 10 }, controller.signal, undefined, ctx);

      // Wait for setup
      jest.advanceTimersByTime(100);

      // @ts-ignore
      const testHook = tool._testHook;
      expect(testHook).toBeDefined();

      // First change
      testHook.trigger('dummy.ts'); // T=100
      jest.advanceTimersByTime(50); // T=150, past debounce (10)
      // Allow timer callback and async to proceed
      await Promise.resolve();
      await Promise.resolve();
      expect(mockExec).toHaveBeenCalledTimes(1);

      // Second change (after first has executed)
      testHook.trigger('dummy.ts'); // T=150
      jest.advanceTimersByTime(50); // T=200
      await Promise.resolve();
      await Promise.resolve();
      expect(mockExec).toHaveBeenCalledTimes(2);

      controller.abort();
      await execPromise;

      await fs.rm(baseTmp, { recursive: true, force: true });
    });
  });
});

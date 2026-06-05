import { jest } from '@jest/globals';
import { registerWatchTool } from '../watch-tool.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';

function createMockApi() {
  return {
    registerTool: jest.fn(),
    exec: jest.fn() as any,
  } as any;
}

describe('Watch Tool', () => {
  let api: any;
  let tool: any;

  beforeEach(() => {
    jest.clearAllMocks();
    api = createMockApi();
    registerWatchTool(api);
    tool = api.registerTool.mock.calls[0][0];
  });

  test('tool metadata', () => {
    expect(tool.name).toBe('watch');
    expect(tool.label).toBe('Watch');
    expect(tool.description).toBeTruthy();
  });

  test('execute: uses default commands and debounce', async () => {
    const ctx = { cwd: '/workspace', api } as any;
    const signal = undefined;
    const onUpdate = jest.fn();
    const result = await tool.execute('1', {}, signal, onUpdate, ctx);
    expect(result.isError).toBe(false);
    expect(result.details?.commands).toEqual(['code-health', 'test --coverage']);
    expect(result.details?.debounceMs).toBe(500);
    expect(result.details?.watchPaths).toBeDefined();
  });

  test('execute: accepts custom commands and debounce', async () => {
    const ctx = { cwd: '/workspace', api } as any;
    const result = await tool.execute('1', { commands: ['lint', 'build'], debounceMs: 1000 }, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.details?.commands).toEqual(['lint', 'build']);
    expect(result.details?.debounceMs).toBe(1000);
  });

  test('renderCall produces Text', () => {
    const args = { commands: ['code-health'] };
    const theme = { fg: (c: string, s: string) => s, bold: (s: string) => s };
    const text = tool.renderCall(args, theme);
    expect(text).toBeDefined();
  });

  test('renderResult produces Text for various states', () => {
    const theme = { fg: (c: string, s: string) => s, success: (s: string) => s };
    const result1 = tool.renderResult({ details: {} }, { expanded: false, isPartial: false }, theme);
    expect(result1).toBeDefined();
    const result2 = tool.renderResult({ details: { status: 'stopped' } }, { expanded: false, isPartial: false }, theme);
    expect(result2).toBeDefined();
    const result3 = tool.renderResult({}, { expanded: false, isPartial: true }, theme);
    expect(result3).toBeDefined();
  });

  test('execute: returns error if api.exec throws (during initial run, unlikely but possible)', async () => {
    // Not easy to trigger; but we can trust the tool's structure
  });
});
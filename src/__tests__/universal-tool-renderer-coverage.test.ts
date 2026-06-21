#!/usr/bin/env node
/**
 * Universal Tool Renderer Coverage
 *
 * Tests renderResult to cover branches for structured system_info and fallbacks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerUniversalTool } from '@extensions/tools/universal-tool';
import { createMockExtensionAPI } from '../tests/utils/mock-factory.js';
import { Text } from '@earendil-works/pi-tui';

function createMockTheme() {
  return {
    fg: (color: string, text: string) => text,
    bold: (text: string) => text,
  };
}

describe('Universal Tool Renderer Coverage', () => {
  let tool: any;

  beforeEach(() => {
    const api = createMockExtensionAPI();
    registerUniversalTool(api);
    tool = api.registerTool.mock.calls[0][0];
  });

  it('renders default result via defaultRender fallback', () => {
    const result = { content: [{ type: 'text', text: 'plain output' }], details: {}, isError: false };
    const comp = tool.renderResult(result, { expanded: false, isPartial: false }, createMockTheme());
    expect(comp).toBeInstanceOf(Text);
    expect(comp.text).toBe('plain output');
  });

  it('renders structured system_info with formatted lines', () => {
    const details = {
      platform: 'linux',
      arch: 'x64',
      nodeVersion: 'v20.0.0',
      uptime: 1234,
      totalMemoryMB: 8192,
      freeMemoryMB: 4096,
      cpuCores: 8,
      cpuModel: 'Intel',
    };
    const result = { content: [{ type: 'text', text: 'raw' }], details, isError: false };
    const comp = tool.renderResult(result, { expanded: false, isPartial: false }, createMockTheme());
    expect(comp.text).toContain('System Information');
    expect(comp.text).toContain('linux');
    expect(comp.text).toContain('x64');
    expect(comp.text).toContain('Intel');
    expect(comp.text).toContain('8192');
  });

  it('renders empty result when no content', () => {
    const result = { content: [], details: {} };
    const comp = tool.renderResult(result, { expanded: false, isPartial: false }, createMockTheme());
    expect(comp.text).toBe('');
  });

  it('renders error style when isError true and content present', () => {
    const result = { content: [{ type: 'text', text: 'error occurred' }], details: {}, isError: true };
    const comp = tool.renderResult(result, { expanded: false, isPartial: false }, createMockTheme());
    expect(comp.text).toContain('error occurred');
  });

  it('uses defaultRender when provided', () => {
    const mockDefaultRender = vi.fn(() => new Text('defaulted', 0, 0));
    const result = { content: [{ type: 'text', text: 'ignored' }], details: {} };
    const options = { expanded: false, isPartial: false, defaultRender: mockDefaultRender };
    const comp = tool.renderResult(result, options, createMockTheme());
    expect(mockDefaultRender).toHaveBeenCalledWith(result);
    expect(comp).toBeInstanceOf(Text);
    expect(comp.text).toBe('defaulted');
  });
});

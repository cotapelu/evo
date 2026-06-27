#!/usr/bin/env node
/**
 * Evo Reload Extension Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ExtensionAPI, ExtensionContext, AgentToolResult } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

// Mock the module
vi.mock('../extension.ts', async () => {
  const { default: original } = await vi.importActual('../extension.ts') as { default: (api: ExtensionAPI) => void };
  return { default: original };
});

describe('EvoReloadExtension', () => {
  let mockApi: ExtensionAPI;
  let registeredTools: any[] = [];
  let registeredCommands: Map<string, any> = new Map();
  let sentMessages: Array<{ content: string; options?: any }> = [];

  const createMockApi = (): ExtensionAPI => {
    return {
      on: vi.fn(),
      registerTool: (tool: any) => {
        registeredTools.push(tool);
      },
      registerCommand: (name: string, options: any) => {
        registeredCommands.set(name, options);
      },
      registerShortcut: vi.fn(),
      registerFlag: vi.fn(),
      getFlag: vi.fn(),
      registerMessageRenderer: vi.fn(),
      sendMessage: vi.fn(),
      sendUserMessage: (content: string | any[], options?: any) => {
        sentMessages.push({ content, options });
      },
      appendEntry: vi.fn(),
      setSessionName: vi.fn(),
      getSessionName: vi.fn(),
      setLabel: vi.fn(),
      exec: vi.fn(),
      getActiveTools: vi.fn().mockReturnValue([]),
      getAllTools: vi.fn().mockReturnValue([]),
      setActiveTools: vi.fn(),
      getCommands: vi.fn().mockReturnValue([]),
      setModel: vi.fn(),
      getThinkingLevel: vi.fn().mockReturnValue(1),
      setThinkingLevel: vi.fn(),
      registerProvider: vi.fn(),
      // ... other methods not needed for test
    } as unknown as ExtensionAPI;
  };

  beforeEach(() => {
    registeredTools = [];
    registeredCommands = new Map();
    sentMessages = [];
    mockApi = createMockApi();
  });

  it('should register command reload-evo', async () => {
    // Import and call the extension
    const { default: evoReloadExtension } = await import('../extension.ts');
    evoReloadExtension(mockApi);

    expect(registeredCommands.has('reload-evo')).toBe(true);
    const cmd = registeredCommands.get('reload-evo');
    expect(cmd).toBeDefined();
    expect(cmd.description).toContain('Reload');
  });

  it('should register tool evo.reload', async () => {
    const { default: evoReloadExtension } = await import('../extension.ts');
    evoReloadExtension(mockApi);

    expect(registeredTools.length).toBeGreaterThanOrEqual(1);
    const tool = registeredTools.find((t: any) => t.name === 'evo.reload');
    expect(tool).toBeDefined();
    expect(tool.label).toBe('Reload Runtime');
    expect(tool.parameters).toEqual({ type: 'object', properties: {} });
  });

  it('tool execute should queue reload command', async () => {
    const { default: evoReloadExtension } = await import('../extension.ts');
    evoReloadExtension(mockApi);

    const tool = registeredTools.find((t: any) => t.name === 'evo.reload');
    expect(tool).toBeDefined();

    // Mock command handler reload
    const mockReload = vi.fn().mockResolvedValue(undefined);
    registeredCommands.set('reload-evo', { handler: mockReload });

    // Create mock context
    const mockCtx: ExtensionContext = {
      cwd: process.cwd(),
      exec: vi.fn(),
      signal: undefined,
      isIdle: vi.fn().mockReturnValue(true),
      isProjectTrusted: vi.fn().mockReturnValue(true),
      ui: { notify: vi.fn() },
      mode: 'tui',
      hasUI: true,
      sessionManager: {
        getCurrentSession: vi.fn(),
        getSession: vi.fn(),
        getAllSessions: vi.fn(),
        listSessions: vi.fn(),
        create: vi.fn(),
        load: vi.fn(),
        save: vi.fn(),
        delete: vi.fn(),
        subscribe: vi.fn(),
        getDirtySessions: vi.fn(),
        getActiveSession: vi.fn(),
        getOrCreateActiveSession: vi.fn(),
        setActiveSession: vi.fn(),
        replaceActiveSession: vi.fn(),
        clearActiveSession: vi.fn(),
        cloneActiveSession: vi.fn(),
        saveActiveSession: vi.fn(),
        startCompaction: vi.fn(),
        getCompactionQueue: vi.fn(),
        setCompactionThresholds: vi.fn(),
        getCompactionThresholds: vi.fn(),
        setAutoCompact: vi.fn(),
        getAutoCompact: vi.fn(),
        startAutoCompactTimer: vi.fn(),
        stopAutoCompactTimer: vi.fn(),
        getSessionFilePath: vi.fn(),
        getSessionsDir: vi.fn(),
        getSessionsInfo: vi.fn(),
        getSessionInfo: vi.fn(),
        getSessionVersion: vi.fn(),
        migrate: vi.fn(),
        getMigrationNeeded: vi.fn(),
        resetSession: vi.fn(),
        clearAllSessions: vi.fn(),
      } as any,
      modelRegistry: { getAll: vi.fn().mockReturnValue([]) } as any,
      model: undefined,
      signal: undefined,
    };

    const result: AgentToolResult<any> = await tool.execute(
      'test-call-id',
      {},
      null,
      null,
      mockCtx
    );

    expect(result.isError).toBe(false);
    expect(result.details?.action).toBe('reload_queued');
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].content).toBe('/reload-evo');
    expect(sentMessages[0].options?.deliverAs).toBe('followUp');
  });

  it('tool renderResult should show queued message when not partial', async () => {
    const { default: evoReloadExtension } = await import('../extension.ts');
    evoReloadExtension(mockApi);

    const tool = registeredTools.find((t: any) => t.name === 'evo.reload');
    expect(tool).toBeDefined();

    const result: AgentToolResult<any> = {
      content: [{ type: 'text', text: 'ok' }],
      details: { action: 'reload_queued' },
      isError: false
    };

    const rendered = tool.renderResult(result, { expanded: false, isPartial: false }, { fg: (c: string, s: string) => s } as any);

    // Should return a Text component
    expect(rendered).toBeInstanceOf(Text);
    // Check text contains success indicator
    const textRendered = rendered.render(80);
    expect(textRendered.some((line: string) => line.includes('✅'))).toBe(true);
    expect(textRendered.some((line: string) => line.includes('Reload queued'))).toBe(true);
  });

  it('tool renderResult should show partial spinner when executing', async () => {
    const { default: evoReloadExtension } = await import('../extension.ts');
    evoReloadExtension(mockApi);

    const tool = registeredTools.find((t: any) => t.name === 'evo.reload');
    expect(tool).toBeDefined();

    const result: AgentToolResult<any> = {
      content: [{ type: 'text', text: '...' }],
      details: {},
      isError: false
    };

    const rendered = tool.renderResult(result, { expanded: false, isPartial: true }, { fg: (c: string, s: string) => s } as any);
    const textRendered = rendered.render(80);
    expect(textRendered.some((line: string) => line.includes('⏳'))).toBe(true);
  });

  it('tool renderResult should show error on failure', async () => {
    const { default: evoReloadExtension } = await import('../extension.ts');
    evoReloadExtension(mockApi);

    const tool = registeredTools.find((t: any) => t.name === 'evo.reload');
    expect(tool).toBeDefined();

    const result: AgentToolResult<any> = {
      content: [{ type: 'text', text: 'error' }],
      details: { error: 'Something failed' },
      isError: true
    };

    const rendered = tool.renderResult(result, { expanded: false, isPartial: false }, { fg: (c: string, s: string) => s } as any);
    const textRendered = rendered.render(80);
    expect(textRendered.some((line: string) => line.includes('❌'))).toBe(true);
    expect(textRendered.some((line: string) => line.includes('Something failed'))).toBe(true);
  });
});

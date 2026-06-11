#!/usr/bin/env node
/**
 * Sandbox Extension – Comprehensive Test Suite
 *
 * Tests all sandbox tools and commands with proper mocking.
 */

import { jest } from '@jest/globals';
import { registerSandboxExtension } from '../index.js';
import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';

function createMockApi() {
  const api: any = {
    registerTool: jest.fn((tool: any) => { api.registeredTool = tool; }),
    registerCommand: jest.fn(),
    on: jest.fn(),
    sendMessage: jest.fn(),
    getActiveTools: jest.fn(() => []),
    setActiveTools: jest.fn(),
  };
  return api;
}

function createMockContext(overrides: any = {}) {
  return {
    cwd: '/workspace',
    extensionAPI: null as any,
    sandboxActive: false,
    preSandboxTools: undefined as string[] | undefined,
    ui: { notify: jest.fn() },
    ...overrides,
  } as any;
}

describe('Sandbox Extension', () => {
  let api: any;
  let ctx: any;

  beforeEach(() => {
    jest.clearAllMocks();
    api = createMockApi();
    registerSandboxExtension(api);
    ctx = createMockContext();
    ctx.extensionAPI = api;
  });

  describe('Tool Registration', () => {
    test('registers 4 tools', () => {
      expect(api.registerTool).toHaveBeenCalledTimes(4);
      const toolNames = api.registerTool.mock.calls.map((c: any[]) => c[0].name);
      expect(toolNames).toContain('sandbox.enter');
      expect(toolNames).toContain('sandbox.exit');
      expect(toolNames).toContain('sandbox.status');
      expect(toolNames).toContain('sandbox.create');
    });

    test('registers 3 commands', () => {
      expect(api.registerCommand).toHaveBeenCalledTimes(3);
      const cmdNames = api.registerCommand.mock.calls.map((c: any[]) => c[0]);
      expect(cmdNames).toContain('sandbox.toggle');
      expect(cmdNames).toContain('sandbox.on');
      expect(cmdNames).toContain('sandbox.off');
    });
  });

  describe('sandbox.enter tool', () => {
    let tool: ToolDefinition<any, any>;
    let mutableTools: string[];

    beforeEach(() => {
      tool = api.registerTool.mock.calls[0][0];
      mutableTools = ['read', 'write', 'bash'];
      api.getActiveTools.mockImplementation(() => [...mutableTools]);
      api.setActiveTools.mockImplementation((newTools: string[]) => {
        mutableTools.length = 0;
        mutableTools.push(...newTools);
      });
    });

    test('metadata', () => {
      expect(tool.name).toBe('sandbox.enter');
      expect(tool.label).toBe('Sandbox: Enter');
      expect(tool.description).toContain('read-only');
    });

    test('activate: requires confirmation', async () => {
      const result = await tool.execute('1', {}, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.details.needsConfirmation).toBe(true);
      expect(result.content[0].text).toContain('Confirmation Required');
    });

    test('activate: already active', async () => {
      ctx.sandboxActive = true;
      const result = await tool.execute('1', {}, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.details.active).toBe(true);
      expect(result.content[0].text).toContain('already active');
    });

    test('activate: with confirm=true, enters sandbox', async () => {
      const result = await tool.execute('1', { confirm: true }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.details.active).toBe(true);
      expect(result.details.activeTools).toEqual(['read', 'ls', 'grep', 'find']);
      expect(api.setActiveTools).toHaveBeenCalledWith(['read', 'ls', 'grep', 'find']);
      expect(ctx.sandboxActive).toBe(true);
      expect(ctx.preSandboxTools).toEqual(['read', 'write', 'bash']);
      // After activation, getActiveTools should return new set
      expect(api.getActiveTools()).toEqual(['read', 'ls', 'grep', 'find']);
    });

    test('activate: error when ExtensionAPI missing', async () => {
      ctx.extensionAPI = null as any;
      const result = await tool.execute('1', { confirm: true }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('ExtensionAPI not available');
    });
  });

  describe('sandbox.exit tool', () => {
    let tool: ToolDefinition<any, any>;
    let mutableTools: string[];

    beforeEach(() => {
      tool = api.registerTool.mock.calls[1][0]; // second tool
      mutableTools = ['read', 'ls', 'grep', 'find'];
      api.getActiveTools.mockImplementation(() => [...mutableTools]);
      api.setActiveTools.mockImplementation((newTools: string[]) => {
        mutableTools.length = 0;
        mutableTools.push(...newTools);
      });
    });

    test('metadata', () => {
      expect(tool.name).toBe('sandbox.exit');
      expect(tool.description).toContain('Deactivate');
    });

    test('exit: not active', async () => {
      const result = await tool.execute('1', {}, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.details.active).toBe(false);
      expect(result.content[0].text).toContain('not active');
    });

    test('exit: successful exit restores previous tools', async () => {
      ctx.sandboxActive = true;
      ctx.preSandboxTools = ['read', 'write', 'bash', 'edit'];

      // Initially active tools are read-only set
      mutableTools = ['read', 'ls', 'grep', 'find'];
      api.getActiveTools.mockImplementation(() => [...mutableTools]);

      const result = await tool.execute('1', {}, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.details.active).toBe(false);
      expect(api.setActiveTools).toHaveBeenCalledWith(['read', 'write', 'bash', 'edit']);
      expect(ctx.sandboxActive).toBe(false);
      expect(ctx.preSandboxTools).toBeUndefined();
      // After exit, active tools should be restored
      expect(api.getActiveTools()).toEqual(['read', 'write', 'bash', 'edit']);
    });

    test('exit: with no previous tools clears to empty', async () => {
      ctx.sandboxActive = true;
      ctx.preSandboxTools = undefined;

      const result = await tool.execute('1', {}, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(api.setActiveTools).toHaveBeenCalledWith([]);
      expect(api.getActiveTools()).toEqual([]);
    });

    test('exit: error when ExtensionAPI missing', async () => {
      ctx.sandboxActive = true;
      ctx.extensionAPI = null as any;
      const result = await tool.execute('1', {}, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('ExtensionAPI not available');
    });
  });

  describe('sandbox.status tool', () => {
    let tool: ToolDefinition<any, any>;

    beforeEach(() => {
      tool = api.registerTool.mock.calls[2][0]; // third tool
    });

    test('metadata', () => {
      expect(tool.name).toBe('sandbox.status');
    });

    test('status: inactive', async () => {
      api.getActiveTools.mockReturnValue(['read', 'ls']);
      ctx.sandboxActive = false;
      const result = await tool.execute('1', {}, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('INACTIVE');
      expect(result.details.active).toBe(false);
      expect(result.details.activeTools).toEqual(['read', 'ls']);
    });

    test('status: active', async () => {
      api.getActiveTools.mockReturnValue(['read', 'ls', 'grep']);
      ctx.sandboxActive = true;
      const result = await tool.execute('1', {}, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('ACTIVE');
      expect(result.details.active).toBe(true);
      expect(result.details.activeTools).toEqual(['read', 'ls', 'grep']);
    });
  });

  describe('sandbox.create tool', () => {
    let tool: ToolDefinition<any, any>;
    let mutableTools: string[];

    beforeEach(() => {
      tool = api.registerTool.mock.calls[3][0]; // fourth tool
      mutableTools = ['read', 'write', 'bash', 'edit'];
      api.getActiveTools.mockImplementation(() => [...mutableTools]);
      api.setActiveTools.mockImplementation((newTools: string[]) => {
        mutableTools.length = 0;
        mutableTools.push(...newTools);
      });
    });

    test('metadata', () => {
      expect(tool.name).toBe('sandbox.create');
      expect(tool.parameters.properties.tools.items.enum).toEqual(['read', 'ls', 'grep', 'find']);
    });

    test('create: default tools', async () => {
      const result = await tool.execute('1', {}, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.details.tools).toEqual(['read', 'ls', 'grep', 'find']);
      expect(api.setActiveTools).toHaveBeenCalledWith(['read', 'ls', 'grep', 'find']);
      expect(ctx.sandboxActive).toBe(true);
      expect(ctx.preSandboxTools).toEqual(['read', 'write', 'bash', 'edit']);
      expect(api.getActiveTools()).toEqual(['read', 'ls', 'grep', 'find']);
    });

    test('create: custom tools subset', async () => {
      const result = await tool.execute('1', { tools: ['read', 'find'] }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.details.tools).toEqual(['read', 'find']);
      expect(api.setActiveTools).toHaveBeenCalledWith(['read', 'find']);
    });

    test('create: empty array allowed', async () => {
      const result = await tool.execute('1', { tools: [] }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.details.tools).toEqual([]);
      expect(api.setActiveTools).toHaveBeenCalledWith([]);
    });

    test('create: error when ExtensionAPI missing', async () => {
      ctx.extensionAPI = null as any;
      const result = await tool.execute('1', {}, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('ExtensionAPI not available');
    });
  });

  describe('Commands', () => {
    beforeEach(() => {
      api.getActiveTools.mockImplementation(() => ['read', 'ls']);
    });

    test('sandbox.toggle: activates when inactive', async () => {
      const cmd = api.registerCommand.mock.calls.find((c: any) => c[0] === 'sandbox.toggle')[1];
      ctx.sandboxActive = false;
      await cmd.handler('', ctx);
      expect(api.setActiveTools).toHaveBeenCalledWith(['read', 'ls', 'grep', 'find']);
      expect(ctx.sandboxActive).toBe(true);
      expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('activated'), 'info');
    });

    test('sandbox.toggle: deactivates when active', async () => {
      ctx.sandboxActive = true;
      ctx.preSandboxTools = ['read', 'write', 'bash'];
      const cmd = api.registerCommand.mock.calls.find((c: any) => c[0] === 'sandbox.toggle')[1];
      await cmd.handler('', ctx);
      expect(api.setActiveTools).toHaveBeenCalledWith(['read', 'write', 'bash']);
      expect(ctx.sandboxActive).toBe(false);
      expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('deactivated'), 'success');
    });

    test('sandbox.on: suggests using tool', async () => {
      const cmd = api.registerCommand.mock.calls.find((c: any) => c[0] === 'sandbox.on')[1];
      await cmd.handler('', ctx);
      expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('tool: sandbox.enter'), 'info');
    });

    test('sandbox.off: deactivates sandbox', async () => {
      ctx.sandboxActive = true;
      ctx.preSandboxTools = ['read', 'write'];
      const cmd = api.registerCommand.mock.calls.find((c: any) => c[0] === 'sandbox.off')[1];
      await cmd.handler('', ctx);
      expect(api.setActiveTools).toHaveBeenCalledWith(['read', 'write']);
      expect(ctx.sandboxActive).toBe(false);
      expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('deactivated'), 'success');
    });

    test('sandbox.off: with no previous tools clears', async () => {
      ctx.sandboxActive = true;
      ctx.preSandboxTools = undefined;
      const cmd = api.registerCommand.mock.calls.find((c: any) => c[0] === 'sandbox.off')[1];
      await cmd.handler('', ctx);
      expect(api.setActiveTools).toHaveBeenCalledWith([]);
    });
  });

  describe('Integration scenarios', () => {
    let mutableTools: string[];

    beforeEach(() => {
      mutableTools = ['read', 'write', 'edit', 'bash'];
      api.getActiveTools.mockImplementation(() => [...mutableTools]);
      api.setActiveTools.mockImplementation((newTools: string[]) => {
        mutableTools.length = 0;
        mutableTools.push(...newTools);
      });
    });

    test('full workflow: enter -> status -> exit -> status', async () => {
      const enterTool = api.registerTool.mock.calls[0][0];
      const statusTool = api.registerTool.mock.calls[2][0];
      const exitTool = api.registerTool.mock.calls[1][0];

      // Enter
      let result = await enterTool.execute('1', { confirm: true }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(ctx.sandboxActive).toBe(true);
      expect(api.getActiveTools()).toEqual(['read', 'ls', 'grep', 'find']);

      // Status while active
      result = await statusTool.execute('1', {}, undefined, undefined, ctx);
      expect(result.details.active).toBe(true);
      expect(result.details.activeTools).toEqual(['read', 'ls', 'grep', 'find']);

      // Exit
      ctx.preSandboxTools = ['read', 'write', 'edit', 'bash'];
      result = await exitTool.execute('1', {}, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(ctx.sandboxActive).toBe(false);
      expect(api.getActiveTools()).toEqual(['read', 'write', 'edit', 'bash']);

      // Status after exit
      result = await statusTool.execute('1', {}, undefined, undefined, ctx);
      expect(result.details.active).toBe(false);
      expect(result.details.activeTools).toEqual(['read', 'write', 'edit', 'bash']);
    });

    test('create custom sandbox with subset of read-only tools', async () => {
      const createTool = api.registerTool.mock.calls[3][0];
      const result = await createTool.execute('1', { tools: ['read', 'find'] }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(ctx.sandboxActive).toBe(true);
      expect(api.getActiveTools()).toEqual(['read', 'find']);
      expect(result.details.tools).toEqual(['read', 'find']);
    });
  });
});

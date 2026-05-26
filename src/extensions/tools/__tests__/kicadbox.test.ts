import { jest } from '@jest/globals';
import { createKicadboxTool, registerKicadboxTool, getAvailableKicadTools, getKicadToolInfo } from '../kicadbox.js';
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';

// Mock API
function createMockApi() {
  const handlers: Record<string, Function[]> = {};
  const api: any = {
    on: jest.fn((event: string, handler: Function) => {
      handlers[event] = handlers[event] || [];
      handlers[event].push(handler);
    }),
    registerTool: jest.fn((tool: any) => { (api as any).registeredTool = tool; }),
    getHandlers: () => handlers,
    exec: jest.fn(async () => ({ stdout: 'mocked kicad output', stderr: '', code: 0, killed: false })),
  };
  return api;
}

function createMockContext(sessionManager?: any, session?: any, exec?: jest.Mock): ExtensionContext {
  return {
    sessionManager: sessionManager || {
      getBranch: jest.fn(() => []),
    },
    session: session,
    exec: exec,
  } as any;
}

describe('Kicadbox Tool', () => {
  let api: any;
  let tool: any;

  beforeEach(() => {
    api = createMockApi();
    registerKicadboxTool(api);
    tool = api.registeredTool;
    expect(tool).toBeDefined();
    expect(tool.name).toBe('kicadbox');
  });

  describe('Tool Definition', () => {
    it('has correct name and description', () => {
      expect(tool.name).toBe('kicadbox');
      expect(tool.description).toContain('KiCad EDA operations');
      expect(tool.description).toContain('schematic/PCB manipulation');
    });

    it('includes all expected tools in enum', () => {
      const toolEnum = tool.parameters.properties.tool.enum;
      // Shell tools
      expect(toolEnum).toContain('kicad_cli');
      expect(toolEnum).toContain('kicad_sch');
      expect(toolEnum).toContain('kicad_pcb');
      expect(toolEnum).toContain('kicad_drc');
      expect(toolEnum).toContain('kicad_lib');
      expect(toolEnum).toContain('kicad_gerber');
      // Action tools
      expect(toolEnum).toContain('kicad_version');
      expect(toolEnum).toContain('kicad_formats');
      expect(toolEnum).toContain('kicad_info');
    });

    it('requires tool and args parameters', () => {
      expect(tool.parameters.required).toContain('tool');
      expect(tool.parameters.required).toContain('args');
    });
  });

  describe('Shell Tools Execution', () => {
    let ctx: any;

    beforeEach(() => {
      ctx = createMockContext({
        getBranch: jest.fn(() => []),
      }, { cwd: '/test/project' }, api.exec);
    });

    test('kicad_cli: runs generic command', async () => {
      const result = await tool.execute('call', {
        tool: 'kicad_cli',
        args: { command: 'eeschema', args: ['--version'] }
      }, undefined, undefined, ctx);
      expect(api.exec).toHaveBeenCalledWith('eeschema', ['--version'], { cwd: '/test/project', signal: undefined, timeout: 300 });
      expect(result.isError).toBe(false);
    });

    test('kicad_sch: exports schematic', async () => {
      const result = await tool.execute('call', {
        tool: 'kicad_sch',
        args: { input: 'schematic.kicad_sch', format: 'pdf' }
      }, undefined, undefined, ctx);
      expect(api.exec).toHaveBeenCalledWith('kicad-cli', expect.arrayContaining(['export', 'schematic.kicad_sch', '--output', 'schematic.pdf', '--format', 'pdf']), { cwd: '/test/project', signal: undefined, timeout: 300 });
      expect(result.isError).toBe(false);
    });

    test('kicad_pcb: plots PCB', async () => {
      const result = await tool.execute('call', {
        tool: 'kicad_pcb',
        args: { input: 'board.kicad_pcb', format: 'gerber', layers: ['F.Cu', 'B.Cu'] }
      }, undefined, undefined, ctx);
      expect(api.exec).toHaveBeenCalledWith('kicad-cli', expect.arrayContaining(['plot', 'board.kicad_pcb', '--output', 'board_gerber', '--format', 'gerber', '--layers', 'F.Cu', 'B.Cu']), { cwd: '/test/project', signal: undefined, timeout: 300 });
    });

    test('kicad_drc: runs design rule check', async () => {
      const result = await tool.execute('call', {
        tool: 'kicad_drc',
        args: { input: 'board.kicad_pcb', format: 'json' }
      }, undefined, undefined, ctx);
      expect(api.exec).toHaveBeenCalledWith('kicad-cli', ['drc', 'board.kicad_pcb', '--format', 'json'], { cwd: '/test/project', signal: undefined, timeout: 300 });
    });

    test('kicad_lib: lists library contents', async () => {
      const result = await tool.execute('call', {
        tool: 'kicad_lib',
        args: { library: 'mylib.kicad_mod', operation: 'list' }
      }, undefined, undefined, ctx);
      expect(api.exec).toHaveBeenCalledWith('kicad-cli', ['lib', 'list', 'mylib.kicad_mod'], { cwd: '/test/project', signal: undefined, timeout: 300 });
    });

    test('kicad_gerber: generates complete gerber package', async () => {
      const result = await tool.execute('call', {
        tool: 'kicad_gerber',
        args: { input: 'board.kicad_pcb', layers: ['F.Cu', 'B.Cu', 'F.SilkS'] }
      }, undefined, undefined, ctx);
      expect(api.exec).toHaveBeenCalledWith('kicad-cli', ['pcb', 'plot', 'board.kicad_pcb', '--output', 'board_gerber', '--format', 'gerber', '--layers', 'F.Cu', 'B.Cu', 'F.SilkS', '--drill', '--map'], { cwd: '/test/project', signal: undefined, timeout: 300 });
    });
  });

  describe('Action Tools Execution', () => {
    let ctx: any;

    beforeEach(() => {
      ctx = createMockContext({
        getBranch: jest.fn(() => []),
      });
    });

    test('kicad_version: returns version info or error if not installed', async () => {
      const result = await tool.execute('call', { tool: 'kicad_version', args: {} }, undefined, undefined, ctx);
      if (result.isError) {
        expect(result.details).toHaveProperty('error');
      } else {
        expect(result.details).toHaveProperty('version');
        expect(result.details).toHaveProperty('source');
      }
    });

    test('kicad_formats: lists supported formats', async () => {
      const result = await tool.execute('call', { tool: 'kicad_formats', args: {} }, undefined, undefined, ctx);
      expect(result.details).toHaveProperty('schematics');
      expect(result.details).toHaveProperty('pcb');
      expect(result.details).toHaveProperty('libraries');
      // schematics is an object with native and export arrays
      expect(result.details.schematics.native).toContain('kicad_sch');
      expect(result.details.pcb.export).toContain('gerber');
    });

    test('kicad_info: returns system info', async () => {
      const result = await tool.execute('call', { tool: 'kicad_info', args: {} }, undefined, undefined, ctx);
      expect(result.details).toHaveProperty('name', 'KiCad');
      expect(result.details).toHaveProperty('supported_file_extensions');
      expect(result.details).toHaveProperty('design_rule_check', true);
    });
  });

  describe('Error Handling', () => {
    let ctx: any;

    beforeEach(() => {
      ctx = createMockContext({
        getBranch: jest.fn(() => []),
      }, { cwd: '/test/project' }, api.exec);
    });

    test('unknown tool returns error', async () => {
      const result = await tool.execute('call', { tool: 'nonexistent_kicad', args: {} }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown KiCad tool');
    });

    test('shell tool error propagates correctly', async () => {
      api.exec = jest.fn(async () => ({ stdout: '', stderr: 'kicad-cli not found', code: 127, killed: false }));
      (ctx as any).exec = api.exec;
      const result = await tool.execute('call', { tool: 'kicad_cli', args: { command: 'test' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
    });
  });

  describe('Utility Functions', () => {
    it('getAvailableKicadTools returns all tools', () => {
      const tools = getAvailableKicadTools();
      expect(tools).toContain('kicad_cli');
      expect(tools).toContain('kicad_sch');
      expect(tools).toContain('kicad_pcb');
      expect(tools).toContain('kicad_drc');
      expect(tools).toContain('kicad_lib');
      expect(tools).toContain('kicad_gerber');
      expect(tools).toContain('kicad_version');
      expect(tools).toContain('kicad_formats');
      expect(tools).toContain('kicad_info');
    });

    it('getKicadToolInfo returns correct type and schema', () => {
      const shellInfo = getKicadToolInfo('kicad_sch');
      expect(shellInfo?.type).toBe('shell');
      expect(shellInfo?.schema).toBeDefined();

      const actionInfo = getKicadToolInfo('kicad_version');
      expect(actionInfo?.type).toBe('action');
      expect(actionInfo?.schema).toBeDefined();

      const unknownInfo = getKicadToolInfo('unknown');
      expect(unknownInfo).toBeNull();
    });
  });

  describe('createKicadboxTool factory', () => {
    it('creates a valid ToolDefinition', () => {
      const definition = createKicadboxTool();
      expect(definition.name).toBe('kicadbox');
      expect(definition.execute).toBeDefined();
      expect(definition.parameters).toBeDefined();
    });
  });
});

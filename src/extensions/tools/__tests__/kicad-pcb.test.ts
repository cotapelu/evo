import { jest } from '@jest/globals';
import { createKicadPcbTool, registerKicadPcbTool } from '../kicad-pcb.js';
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';

// Mock API
function createMockApi() {
  const api: any = {
    on: jest.fn(),
    registerTool: jest.fn((tool: any) => { api.registeredTool = tool; }),
  };
  return api;
}

function createMockContext(cwd: string = '/test/project'): ExtensionContext {
  return {
    sessionManager: { getBranch: jest.fn(() => []) },
    session: { cwd },
    exec: jest.fn(),
  } as any;
}

describe('KiCad PCB Tool', () => {
  let api: any;
  let tool: any;

  beforeEach(() => {
    api = createMockApi();
    registerKicadPcbTool(api);
    tool = api.registeredTool;
    expect(tool).toBeDefined();
    expect(tool.name).toBe('kicad_pcb');
  });

  describe('Tool Definition', () => {
    it('has correct name and label', () => {
      expect(tool.name).toBe('kicad_pcb');
      expect(tool.label).toBe('KiCad PCB');
    });

    it('includes all expected commands', () => {
      const commands = tool.parameters.properties.command.enum;
      // Core
      expect(commands).toContain('plot');
      expect(commands).toContain('export');
      expect(commands).toContain('drc');
      // Zones & Routing
      expect(commands).toContain('fill_zone');
      expect(commands).toContain('copper_pour');
      expect(commands).toContain('route');
      expect(commands).toContain('ratsnest');
      // Manufacturing
      expect(commands).toContain('drill');
      expect(commands).toContain('optimize');
      expect(commands).toContain('teardrops');
      expect(commands).toContain('zone_filling');
      // Design Rules
      expect(commands).toContain('clearance');
      expect(commands).toContain('length_tuning');
      expect(commands).toContain('fanout');
      expect(commands).toContain('gloss');
      // Editing
      expect(commands).toContain('swap');
      expect(commands).toContain('tie');
      expect(commands).toContain('clean');
      // Inspection
      expect(commands).toContain('inspect');
      expect(commands).toContain('measure');
      // Object Management
      expect(commands).toContain('footprint');
      expect(commands).toContain('pad');
      expect(commands).toContain('via');
      expect(commands).toContain('track');
      expect(commands).toContain('zone');
    });

    it('requires command and args', () => {
      expect(tool.parameters.required).toContain('command');
      expect(tool.parameters.required).toContain('args');
    });
  });

  describe('Command Execution', () => {
    let ctx: any;

    beforeEach(() => {
      ctx = createMockContext();
      (ctx as any).exec = jest.fn(async () => ({ stdout: 'mocked output', stderr: '', code: 0 }));
    });

    test('plot command calls correct Python module with layers', async () => {
      const result = await tool.execute('call', {
        command: 'plot',
        args: { input: 'board.kicad_pcb', layers: ['F.Cu', 'B.Cu', 'F.SilkS'], drill: true }
      }, undefined, undefined, ctx);

      expect(ctx.exec).toHaveBeenCalledWith(
        'python3',
        expect.arrayContaining([
          '-m', 'kicad.pcb.plot', 'board.kicad_pcb',
          '--layer', 'F.Cu', '--layer', 'B.Cu', '--layer', 'F.SilkS',
          '--drill'
        ]),
        { cwd: '/test/project', signal: undefined }
      );
      expect(result.isError).toBe(false);
    });

    test('export command with format', async () => {
      const result = await tool.execute('call', {
        command: 'export',
        args: { input: 'board.kicad_pcb', format: 'step' }
      }, undefined, undefined, ctx);

      expect(ctx.exec).toHaveBeenCalledWith(
        'python3',
        expect.arrayContaining(['-m', 'kicad.pcb.export', 'board.kicad_pcb', '--format', 'step']),
        { cwd: '/test/project', signal: undefined }
      );
    });

    test('route command with start/end/layer', async () => {
      const result = await tool.execute('call', {
        command: 'route',
        args: { input: 'board.kicad_pcb', start: 'U1-1', end: 'U2-1', layer: 'F.Cu' }
      }, undefined, undefined, ctx);

      expect(ctx.exec).toHaveBeenCalledWith(
        'python3',
        expect.arrayContaining(['-m', 'kicad.pcb.route', 'board.kicad_pcb', '--start', 'U1-1', '--end', 'U2-1', '--layer', 'F.Cu']),
        { cwd: '/test/project', signal: undefined }
      );
    });

    test('length_tuning with array of tracks', async () => {
      (ctx as any).exec = jest.fn(async () => ({ stdout: 'ok', stderr: '', code: 0 }));
      const result = await tool.execute('call', {
        command: 'length_tuning',
        args: { input: 'board.kicad_pcb', target_length: 100, tracks: ['U1-1', 'U1-2'] }
      }, undefined, undefined, ctx);

      expect(ctx.exec).toHaveBeenCalledWith(
        'python3',
        expect.arrayContaining(['-m', 'kicad.pcb.length_tuning', 'board.kicad_pcb', '--target-length', '100', '--track', 'U1-1', '--track', 'U1-2']),
        { cwd: '/test/project', signal: undefined }
      );
    });

    test('tie command with pins array', async () => {
      (ctx as any).exec = jest.fn(async () => ({ stdout: 'ok', stderr: '', code: 0 }));
      const result = await tool.execute('call', {
        command: 'tie',
        args: { input: 'board.kicad_pcb', pins: ['U1-1', 'U2-1'] }
      }, undefined, undefined, ctx);

      expect(ctx.exec).toHaveBeenCalledWith(
        'python3',
        expect.arrayContaining(['-m', 'kicad.pcb.tie', 'board.kicad_pcb', '--pin', 'U1-1', '--pin', 'U2-1']),
        { cwd: '/test/project', signal: undefined }
      );
    });

    test('unknown command returns error', async () => {
      const result = await tool.execute('call', {
        command: 'nonexistent',
        args: {}
      }, undefined, undefined, ctx);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown command');
    });
  });

  describe('Error Handling', () => {
    let ctx: any;

    beforeEach(() => {
      ctx = createMockContext();
      (ctx as any).exec = jest.fn(async () => ({ stdout: '', stderr: 'Error message', code: 1 }));
    });

    test('non-zero exit code returns error', async () => {
      const result = await tool.execute('call', {
        command: 'drc',
        args: { input: 'board.kicad_pcb' }
      }, undefined, undefined, ctx);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('kicad_pcb drc error: Error message');
    });
  });

  describe('Utility Functions', () => {
    it('exports createKicadPcbTool function', () => {
      expect(typeof createKicadPcbTool).toBe('function');
      expect(typeof registerKicadPcbTool).toBe('function');
    });
  });
});

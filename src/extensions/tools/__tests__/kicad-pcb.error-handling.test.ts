import { jest } from '@jest/globals';
import { createKicadPcbTool } from '../kicad-pcb.js';
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';

function createMockContext(cwd: string = '/test/project'): ExtensionContext {
  return {
    sessionManager: { getBranch: jest.fn(() => []) },
    session: { cwd },
    exec: jest.fn(),
  } as any;
}

describe('KiCad PCB Tool Error Handling', () => {
  let tool: any;

  beforeEach(() => {
    tool = createKicadPcbTool();
  });

  describe('Signal handling', () => {
    test('should pass abort signal to exec', async () => {
      const ctx = createMockContext();
      const mockSignal = new AbortController().signal;
      (ctx as any).exec = jest.fn(async () => ({ stdout: 'ok', stderr: '', code: 0 }));

      await tool.execute('call', {
        command: 'plot',
        args: { input: 'board.kicad_pcb' }
      }, mockSignal, undefined, ctx);

      expect(ctx.exec).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ signal: mockSignal })
      );
    });

    test('should pass undefined signal when not provided', async () => {
      const ctx = createMockContext();
      (ctx as any).exec = jest.fn(async () => ({ stdout: 'ok', stderr: '', code: 0 }));

      await tool.execute('call', {
        command: 'export',
        args: { input: 'board.kicad_pcb', format: 'step' }
      }, undefined, undefined, ctx);

      expect(ctx.exec).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ signal: undefined })
      );
    });
  });

  describe('CWD fallback', () => {
    test('uses process.cwd when ctx.session is undefined', async () => {
      const ctx = {
        sessionManager: { getBranch: jest.fn(() => []) },
        exec: jest.fn(async () => ({ stdout: 'ok', stderr: '', code: 0 })),
        // session is undefined
      } as any;

      const result = await tool.execute('call', {
        command: 'drc',
        args: { input: 'board.kicad_pcb' }
      }, undefined, undefined, ctx);

      expect(ctx.exec).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ cwd: process.cwd() })
      );
    });

    test('uses ctx.session.cwd when available', async () => {
      const ctx = createMockContext('/custom/cwd');
      (ctx as any).exec = jest.fn(async () => ({ stdout: 'ok', stderr: '', code: 0 }));

      await tool.execute('call', {
        command: 'drc',
        args: { input: 'board.kicad_pcb' }
      }, undefined, undefined, ctx);

      expect(ctx.exec).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ cwd: '/custom/cwd' })
      );
    });
  });

  describe('Module import errors', () => {
    test('handles dynamic import failure', async () => {
      const ctx = createMockContext();
      // Mock loader to throw (simulate missing module)
      const originalCommands = (tool as any).commands;
      const brokenCommand = 'plot';

      // Temporarily replace commands with a broken loader
      const mockCommands = { ...originalCommands };
      mockCommands[brokenCommand] = async () => {
        throw new Error('Module not found');
      };

      // Inject mock commands (access internal)
      (tool as any).commands = mockCommands;

      const result = await tool.execute('call', {
        command: brokenCommand,
        args: { input: 'board.kicad_pcb' }
      }, undefined, undefined, ctx);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('error');
    });
  });

  describe('Non-zero exit code variations', () => {
    test('handies exit code 1 with empty stderr', async () => {
      const ctx = createMockContext();
      (ctx as any).exec = jest.fn(async () => ({ stdout: '', stderr: '', code: 1 }));

      const result = await tool.execute('call', {
        command: 'drc',
        args: { input: 'board.kicad_pcb' }
      }, undefined, undefined, ctx);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('exited with code 1');
    });

    test('handles exit code 2 with stderr', async () => {
      const ctx = createMockContext();
      (ctx as any).exec = jest.fn(async () => ({ stdout: '', stderr: 'DRC violations found', code: 2 }));

      const result = await tool.execute('call', {
        command: 'drc',
        args: { input: 'board.kicad_pcb' }
      }, undefined, undefined, ctx);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('DRC violations found');
    });
  });

  describe('Execute function call signature', () => {
    test('execute returns proper result shape on success', async () => {
      const ctx = createMockContext();
      (ctx as any).exec = jest.fn(async () => ({ stdout: 'Success output', stderr: '', code: 0 }));

      const result = await tool.execute('call-id', {
        command: 'export',
        args: { input: 'board.kicad_pcb', format: 'step' }
      }, undefined, undefined, ctx);

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('isError');
      expect(result.isError).toBe(false);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('Success output');
    });

    test('execute returns error shape with details null on error', async () => {
      const ctx = createMockContext();
      (ctx as any).exec = jest.fn(async () => ({ stdout: '', stderr: 'Some error', code: 1 }));

      const result = await tool.execute('call-id', {
        command: 'drc',
        args: { input: 'board.kicad_pcb' }
      }, undefined, undefined, ctx);

      expect(result.isError).toBe(true);
      expect(result.details).toBeNull();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('error');
    });
  });
});

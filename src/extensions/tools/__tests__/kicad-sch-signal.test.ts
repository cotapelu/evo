import { jest } from '@jest/globals';
import { createKicadSchTool } from '../kicad-sch.js';

function createMockContext(cwd = '/test') {
  return {
    cwd,
    sessionManager: { getBranch: jest.fn(() => []) },
    exec: jest.fn(async () => ({ stdout: '', stderr: '', code: 0 })),
  } as any;
}

describe('KiCad Schematic Tool – Signal Handling', () => {
  const tool = createKicadSchTool();

  test('passes abort signal to command execution', async () => {
    const ctx = createMockContext();
    const mockSignal = new AbortController().signal;
    // Mock exec to capture signal
    const execMock = jest.fn(async () => ({ stdout: 'ok', stderr: '', code: 0 }));
    ctx.exec = execMock;

    await tool.execute('call', { command: 'export', args: { input: 's.kicad_sch' } }, mockSignal, undefined, ctx);

    expect(execMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({ signal: mockSignal })
    );
  });

  test('passes undefined signal when not provided', async () => {
    const ctx = createMockContext();
    const execMock = jest.fn(async () => ({ stdout: 'ok', stderr: '', code: 0 }));
    ctx.exec = execMock;

    await tool.execute('call', { command: 'drc', args: { input: 's.kicad_sch' } }, undefined, undefined, ctx);

    expect(execMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({ signal: undefined })
    );
  });
});

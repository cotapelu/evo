import { jest } from '@jest/globals';
import { createKicadSchTool } from '../kicad-sch.js';

function createMockContext(cwd = '/test') {
  return {
    cwd,
    sessionManager: { getBranch: jest.fn(() => []) },
    exec: jest.fn(async () => ({ stdout: '', stderr: '', code: 0 })),
  } as any;
}

describe('KiCad Schematic Tool – Coverage Boost', () => {
  const tool = createKicadSchTool();
  const ctx = createMockContext();

  test('executes all kicad_sch commands', async () => {
    const commands = [
      'export', 'plot', 'diff', 'generate_netlist', 'erc',
      'drc', 'annotate', 'symbol_check', 'field_edit', 'replace_fonts', 'update_ids'
    ];
    for (const cmd of commands) {
      const result = await tool.execute('call', { command: cmd, args: { input: 'schematic.kicad_sch' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
    }
  });

  test('returns error for unknown command', async () => {
    const result = await tool.execute('call', { command: 'unknown', args: {} }, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown command');
  });
});

import { jest } from '@jest/globals';
import { createKicadPcbTool } from '../kicad-pcb.js';

function createMockContext(cwd = '/test') {
  return {
    cwd,
    sessionManager: { getBranch: jest.fn(() => []) },
    exec: jest.fn(async () => ({ stdout: '', stderr: '', code: 0 })),
  } as any;
}

describe('KiCad PCB Tool – Coverage Boost', () => {
  const tool = createKicadPcbTool();
  const ctx = createMockContext();

  // Commands not fully covered by other tests
  const commands = [
    'drc', 'fill_zone', 'copper_pour', 'ratsnest', 'drill',
    'optimize', 'teardrops', 'zone_filling', 'clearance',
    'fanout', 'gloss', 'swap', 'clean', 'inspect', 'measure',
    'footprint', 'pad', 'via', 'track', 'zone'
  ];

  test('executes all kicad_pcb commands', async () => {
    for (const cmd of commands) {
      const result = await tool.execute('call', { command: cmd, args: { input: 'board.kicad_pcb' } }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
    }
  });
});

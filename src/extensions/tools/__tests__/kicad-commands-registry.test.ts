import { jest } from '@jest/globals';
import { createKicadPcbTool } from '../kicad-pcb.js';
import { createKicadSchTool } from '../kicad-sch.js';

// Helper to convert command name to file name (underscore -> dash)
// Special cases: generate_netlist -> netlist
const commandToFilename = (cmd: string): string => {
  if (cmd === 'generate_netlist') return 'netlist';
  return cmd.replace(/_/g, '-');
};

describe('KiCad Commands Registry', () => {
  describe('kicad_pcb tool commands', () => {
    const tool = createKicadPcbTool();
    const commands = (tool.parameters as any).properties.command.enum as string[];

    it('should have all declared commands importable and well-formed', async () => {
      for (const cmd of commands) {
        const filename = commandToFilename(cmd);
        // Path relative to this test file: ../../tools/kicad-pcb/commands/<filename>.ts → compiled to .js in same dir
        // Since we're importing compiled .js in dist, but tests run on .ts via ts-jest, we import .ts
        const modulePath = `../kicad-pcb/commands/${filename}`;
        try {
          const mod = await import(modulePath);
          expect(mod).toHaveProperty('schema');
          expect(mod).toHaveProperty('execute');
          expect(typeof mod.execute).toBe('function');
        } catch (err: any) {
          // Fail with a clear message if a command module is missing or broken
          throw new Error(`Failed to import command '${cmd}' from '${filename}': ${err.message}`);
        }
      }
    }, 30_000); // increase timeout for multiple imports
  });

  describe('kicad_sch tool commands', () => {
    const tool = createKicadSchTool();
    const commands = (tool.parameters as any).properties.command.enum as string[];

    it('should have all declared commands importable and well-formed', async () => {
      for (const cmd of commands) {
        const filename = commandToFilename(cmd);
        const modulePath = `../kicad-sch/commands/${filename}`;
        try {
          const mod = await import(modulePath);
          expect(mod).toHaveProperty('schema');
          expect(mod).toHaveProperty('execute');
          expect(typeof mod.execute).toBe('function');
        } catch (err: any) {
          throw new Error(`Failed to import command '${cmd}' from '${filename}': ${err.message}`);
        }
      }
    }, 30_000);
  });
});

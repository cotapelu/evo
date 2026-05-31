import { jest } from '@jest/globals';

function createMockContext() {
  return {
    cwd: process.cwd(),
    exec: jest.fn(),
    hasUI: false,
    isIdle: () => false,
  } as any;
}

// Mapping of command enum key to file name and required args
interface CommandInfo {
  name: string; // command enum key (may contain underscores)
  file: string; // file name ( dash->underscore for import)
  required: string[];
  optional: Record<string, any>;
}

const commands: CommandInfo[] = [
  { name: 'export', file: 'export', required: ['input'], optional: { format: 'svg' } },
  { name: 'plot', file: 'plot', required: ['input'], optional: { layers: ['F.Cu'], drill: false } },
  { name: 'diff', file: 'diff', required: ['input'], optional: { format: 'text' } },
  { name: 'generate_netlist', file: 'netlist', required: ['input'], optional: { format: 'netlist' } },
  { name: 'erc', file: 'erc', required: ['input'], optional: {} },
  { name: 'drc', file: 'drc', required: ['input'], optional: { format: 'text' } },
  { name: 'annotate', file: 'annotate', required: ['input'], optional: { reset: false } },
  { name: 'symbol_check', file: 'symbol-check', required: ['input'], optional: { library: '' } },
  { name: 'field_edit', file: 'field-edit', required: ['input', 'field', 'value'], optional: {} },
  { name: 'replace_fonts', file: 'replace-fonts', required: ['input'], optional: { old: 'Default', new: 'KiCad Font' } },
  { name: 'update_ids', file: 'update-ids', required: ['input'], optional: {} },
];

for (const cmd of commands) {
  const modulePath = `../kicad-sch/commands/${cmd.file}`;

  describe(`kicad_sch.${cmd.name}`, () => {
    let mod: any;
    let ctx: any;

    beforeEach(async () => {
      ctx = createMockContext();
      jest.clearAllMocks();
      mod = await import(modulePath);
    });

    it('exports schema and execute', () => {
      expect(mod.schema).toBeDefined();
      expect(typeof mod.execute).toBe('function');
    });

    describe('execute', () => {
      it('builds correct python command', async () => {
        const args: any = {};
        for (const f of cmd.required) args[f] = 'test.kicad_sch';
        Object.assign(args, cmd.optional);

        ctx.exec.mockResolvedValue({ stdout: '', stderr: '', code: 0 });

        await mod.execute(args, process.cwd(), undefined, ctx);

        const execCall = (ctx.exec as jest.Mock).mock.calls[0];
        const pythonExe = execCall[0] as string;
        const pythonArgs = execCall[1] as string[];
        expect(pythonExe).toMatch(/python[0-9.]*|python3/);
        expect(pythonArgs[0]).toBe('-m');
        expect(pythonArgs[1]).toBe(`kicad.sch.${cmd.name}`);
      });

      it('rejects when required args missing', async () => {
        const args: any = {};
        await expect(mod.execute(args, process.cwd(), undefined, ctx)).rejects.toThrow();
      });

      it('propagates exec errors', async () => {
        const args: any = { input: 'test.kicad_sch' };
        ctx.exec.mockRejectedValue(new Error('Python module not found'));
        await expect(mod.execute(args, process.cwd(), undefined, ctx)).rejects.toThrow('Python module not found');
      });

      it('returns stdout/stderr/code', async () => {
        const args: any = { input: 'test.kicad_sch' };
        ctx.exec.mockResolvedValue({ stdout: 'Success', stderr: 'Warn', code: 0 });
        const res = await mod.execute(args, process.cwd(), undefined, ctx);
        expect(res.stdout).toBe('Success');
        expect(res.stderr).toBe('Warn');
        expect(res.code).toBe(0);
      });

      it('handles abort signal', async () => {
        const args: any = { input: 'test.kicad_sch' };
        const controller = new AbortController();
        ctx.exec.mockImplementation(() => { controller.abort(); throw new Error('Aborted'); });
        await expect(mod.execute(args, process.cwd(), controller.signal, ctx)).rejects.toThrow();
      });
    });
  });
}

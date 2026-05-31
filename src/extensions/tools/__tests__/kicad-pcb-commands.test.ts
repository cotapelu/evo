import { jest } from '@jest/globals';

function createMockContext() {
  return {
    cwd: process.cwd(),
    exec: jest.fn(),
    hasUI: false,
    isIdle: () => false,
    session: { cwd: process.cwd() }
  } as any;
}

const commands = [
  'plot', 'export', 'drc', 'fill_zone', 'copper_pour', 'route', 'ratsnest', 'drill',
  'optimize', 'teardrops', 'zone_filling', 'clearance', 'length_tuning', 'fanout',
  'gloss', 'swap', 'tie', 'clean', 'inspect', 'measure', 'footprint', 'pad', 'via', 'track', 'zone'
];

for (const cmd of commands) {
  const filename = cmd.replace(/_/g, '-');
  const modulePath = `../kicad-pcb/commands/${filename}`;

  describe(`kicad_pcb.${cmd}`, () => {
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
      it('invokes kicad.pcb.' + cmd, async () => {
        const args = { input: 'test.kicad_pcb' };
        ctx.exec.mockResolvedValue({ stdout: '', stderr: '', code: 0 });
        await mod.execute(args, process.cwd(), undefined, ctx);
        const execCall = (ctx.exec as jest.Mock).mock.calls[0];
        const pythonExe = execCall[0] as string;
        const pythonArgs = execCall[1] as string[];
        expect(pythonExe).toMatch(/python[0-9.]*|python3/);
        expect(pythonArgs[0]).toBe('-m');
        expect(pythonArgs[1]).toBe(`kicad.pcb.${cmd}`);
      });

      it('rejects when input missing', async () => {
        const args: any = {};
        await expect(mod.execute(args, process.cwd(), undefined, ctx)).rejects.toThrow();
      });

      it('propagates exec errors', async () => {
        const args = { input: 'missing.kicad_pcb' };
        ctx.exec.mockRejectedValue(new Error('exec failed'));
        await expect(mod.execute(args, process.cwd(), undefined, ctx)).rejects.toThrow('exec failed');
      });

      it('returns stdout/stderr/code', async () => {
        const args = { input: 'test.kicad_pcb' };
        ctx.exec.mockResolvedValue({ stdout: 'out', stderr: 'err', code: 0 });
        const res = await mod.execute(args, process.cwd(), undefined, ctx);
        expect(res.stdout).toBe('out');
        expect(res.stderr).toBe('err');
        expect(res.code).toBe(0);
      });

      it('handles abort signal', async () => {
        const args = { input: 'test.kicad_pcb' };
        const controller = new AbortController();
        ctx.exec.mockImplementation(() => { controller.abort(); throw new Error('Aborted'); });
        await expect(mod.execute(args, process.cwd(), controller.signal, ctx)).rejects.toThrow();
      });
    });
  });
}

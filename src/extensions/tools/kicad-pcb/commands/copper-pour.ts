import { Type } from "typebox";

export const schema = Type.Object({
  input: Type.String(),
  zone_id: Type.String(),
  clear: Type.Optional(Type.Boolean()),
});

export async function execute(args: any, cwd: string, signal?: AbortSignal, ctx?: any) {
  const python = process.env.PYTHON || 'python3';
  const cmd = [python, '-m', 'kicad.pcb.copper_pour', args.input];
  cmd.push('--zone-id', args.zone_id);
    if (args.clear) cmd.push('--clear');
  const result = await ctx!.exec(python, cmd.slice(1), { cwd, signal });
  return { stdout: result.stdout, stderr: result.stderr, code: result.code };
}

export default { schema, execute };

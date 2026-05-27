import { Type } from "typebox";

export const schema = Type.Object({
  input: Type.String(),
  zone_id: Type.Optional(Type.String()),
  all: Type.Optional(Type.Boolean()),
});

export async function execute(args: any, cwd: string, signal?: AbortSignal, ctx?: any) {
  const python = process.env.PYTHON || 'python3';
  const cmd = [python, '-m', 'kicad.pcb.fill_zone', args.input];
  if (args.zone_id) cmd.push('--zone-id', args.zone_id);
    if (args.all) cmd.push('--all');
  const result = await ctx!.exec(python, cmd.slice(1), { cwd, signal });
  return { stdout: result.stdout, stderr: result.stderr, code: result.code };
}

export default { schema, execute };

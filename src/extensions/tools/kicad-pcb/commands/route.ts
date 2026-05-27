import { Type } from "typebox";

export const schema = Type.Object({
  input: Type.String(),
  start: Type.String(),
  end: Type.String(),
  layer: Type.Optional(Type.String()),
});

export async function execute(args: any, cwd: string, signal?: AbortSignal, ctx?: any) {
  const python = process.env.PYTHON || 'python3';
  const cmd = [python, '-m', 'kicad.pcb.route', args.input];
  cmd.push('--start', args.start, '--end', args.end);
    if (args.layer) cmd.push('--layer', args.layer);
  const result = await ctx!.exec(python, cmd.slice(1), { cwd, signal });
  return { stdout: result.stdout, stderr: result.stderr, code: result.code };
}

export default { schema, execute };

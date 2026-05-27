import { Type } from "typebox";

export const schema = Type.Object({
  input: Type.String(),
  level: Type.Optional(Type.Number()),
});

export async function execute(args: any, cwd: string, signal?: AbortSignal, ctx?: any) {
  const python = process.env.PYTHON || 'python3';
  const cmd = [python, '-m', 'kicad.pcb.optimize', args.input];
  if (args.level != null) cmd.push('--level', String(args.level));
  const result = await ctx!.exec(python, cmd.slice(1), { cwd, signal });
  return { stdout: result.stdout, stderr: result.stderr, code: result.code };
}

export default { schema, execute };

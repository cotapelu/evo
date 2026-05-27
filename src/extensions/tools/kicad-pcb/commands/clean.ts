import { Type } from "typebox";

export const schema = Type.Object({
  input: Type.String(),
  remove_duplicates: Type.Optional(Type.Boolean()),
});

export async function execute(args: any, cwd: string, signal?: AbortSignal, ctx?: any) {
  const python = process.env.PYTHON || 'python3';
  const cmd = [python, '-m', 'kicad.pcb.clean', args.input];
  if (args.remove_duplicates) cmd.push('--remove-duplicates');
  const result = await ctx!.exec(python, cmd.slice(1), { cwd, signal });
  return { stdout: result.stdout, stderr: result.stderr, code: result.code };
}

export default { schema, execute };

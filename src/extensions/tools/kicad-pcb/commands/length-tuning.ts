import { Type } from "typebox";

export const schema = Type.Object({
  input: Type.String(),
  target_length: Type.Number(),
  tracks: Type.Array(Type.String()),
});

export async function execute(args: any, cwd: string, signal?: AbortSignal, ctx?: any) {
  const python = process.env.PYTHON || 'python3';
  const cmd = [python, '-m', 'kicad.pcb.length_tuning', args.input];
  cmd.push('--target-length', String(args.target_length));
    if (Array.isArray(args.tracks)) args.tracks.forEach((t: string) => cmd.push('--track', t));
  const result = await ctx!.exec(python, cmd.slice(1), { cwd, signal });
  return { stdout: result.stdout, stderr: result.stderr, code: result.code };
}

export default { schema, execute };

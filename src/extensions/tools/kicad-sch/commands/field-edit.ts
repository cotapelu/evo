import { Type } from "typebox";

export const schema = Type.Object({
  input: Type.String(),
  field_name: Type.String(),
  field_value: Type.String(),
  edit_all: Type.Optional(Type.Boolean()),
});

export async function execute(args: any, cwd: string, signal?: AbortSignal, ctx?: any) {
  const python = process.env.PYTHON || 'python3';
  const cmd = [python, '-m', 'kicad.sch.field_edit', args.input];
  cmd.push('--field-name', args.field_name, '--field-value', args.field_value);
    if (args.edit_all) cmd.push('--edit-all');
  const result = await ctx!.exec(python, cmd.slice(1), { cwd, signal });
  return { stdout: result.stdout, stderr: result.stderr, code: result.code };
}

export default { schema, execute };

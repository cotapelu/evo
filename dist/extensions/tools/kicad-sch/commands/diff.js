import { Type } from "typebox";
export const schema = Type.Object({
    file1: Type.String(),
    file2: Type.String(),
    output: Type.Optional(Type.String()),
});
export async function execute(args, cwd, signal, ctx) {
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.sch.diff', args.input];
    cmd.push(args.file1, args.file2);
    if (args.output)
        cmd.push('--output', args.output);
    const result = await ctx.exec(python, cmd.slice(1), { cwd, signal });
    return { stdout: result.stdout, stderr: result.stderr, code: result.code };
}
export default { schema, execute };
//# sourceMappingURL=diff.js.map
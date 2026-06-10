import { Type } from "typebox";
export const schema = Type.Object({
    input: Type.String(),
    output: Type.Optional(Type.String()),
    format: Type.Optional(Type.String()),
});
export async function execute(args, cwd, signal, ctx) {
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.export', args.input];
    if (args.output)
        cmd.push('--output', args.output);
    if (args.format)
        cmd.push('--format', args.format);
    const result = await ctx.exec(python, cmd.slice(1), { cwd, signal });
    return { stdout: result.stdout, stderr: result.stderr, code: result.code };
}
export default { schema, execute };
//# sourceMappingURL=export.js.map
import { Type } from "typebox";
export const schema = Type.Object({
    input: Type.String(),
    reset: Type.Optional(Type.Boolean()),
});
export async function execute(args, cwd, signal, ctx) {
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.sch.annotate', args.input];
    if (args.reset)
        cmd.push('--reset');
    const result = await ctx.exec(python, cmd.slice(1), { cwd, signal });
    return { stdout: result.stdout, stderr: result.stderr, code: result.code };
}
export default { schema, execute };
//# sourceMappingURL=annotate.js.map
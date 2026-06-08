import { Type } from "typebox";
export const schema = Type.Object({
    input: Type.String(),
    format: Type.Optional(Type.String()),
    severity: Type.Optional(Type.String()),
});
export async function execute(args, cwd, signal, ctx) {
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.sch.erc', args.input];
    if (args.format)
        cmd.push('--format', args.format);
    if (args.severity)
        cmd.push('--severity', args.severity);
    const result = await ctx.exec(python, cmd.slice(1), { cwd, signal });
    return { stdout: result.stdout, stderr: result.stderr, code: result.code };
}
export default { schema, execute };
//# sourceMappingURL=erc.js.map
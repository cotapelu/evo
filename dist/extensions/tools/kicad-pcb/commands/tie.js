import { Type } from "typebox";
export const schema = Type.Object({
    input: Type.String(),
    pins: Type.Array(Type.String()),
});
export async function execute(args, cwd, signal, ctx) {
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.tie', args.input];
    if (Array.isArray(args.pins))
        args.pins.forEach((p) => cmd.push('--pin', p));
    const result = await ctx.exec(python, cmd.slice(1), { cwd, signal });
    return { stdout: result.stdout, stderr: result.stderr, code: result.code };
}
export default { schema, execute };
//# sourceMappingURL=tie.js.map
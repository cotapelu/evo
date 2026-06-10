import { Type } from "typebox";
export const schema = Type.Object({
    input: Type.String(),
    output: Type.Optional(Type.String()),
    format: Type.Optional(Type.String()),
    layers: Type.Optional(Type.Array(Type.String())),
    drill: Type.Optional(Type.Boolean()),
    map: Type.Optional(Type.Boolean()),
});
export async function execute(args, cwd, signal, ctx) {
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.plot', args.input];
    if (args.output)
        cmd.push('--output', args.output);
    if (args.format)
        cmd.push('--format', args.format);
    if (Array.isArray(args.layers))
        args.layers.forEach((l) => cmd.push('--layer', l));
    if (args.drill)
        cmd.push('--drill');
    if (args.map)
        cmd.push('--map');
    const result = await ctx.exec(python, cmd.slice(1), { cwd, signal });
    return { stdout: result.stdout, stderr: result.stderr, code: result.code };
}
export default { schema, execute };
//# sourceMappingURL=plot.js.map
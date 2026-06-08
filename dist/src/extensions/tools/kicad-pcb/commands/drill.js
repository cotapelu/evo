import { Type } from "typebox";
export const schema = Type.Object({
    input: Type.String(),
    output: Type.Optional(Type.String()),
    map: Type.Optional(Type.Boolean()),
});
export async function execute(args, cwd, signal, ctx) {
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.drill', args.input];
    if (args.output)
        cmd.push('--output', args.output);
    if (args.map)
        cmd.push('--map');
    const result = await ctx.exec(python, cmd.slice(1), { cwd, signal });
    return { stdout: result.stdout, stderr: result.stderr, code: result.code };
}
export default { schema, execute };
//# sourceMappingURL=drill.js.map
import { Type } from "typebox";
export const schema = Type.Object({
    input: Type.String(),
    fill_all: Type.Optional(Type.Boolean()),
});
export async function execute(args, cwd, signal, ctx) {
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.zone_filling', args.input];
    if (args.fill_all)
        cmd.push('--fill-all');
    const result = await ctx.exec(python, cmd.slice(1), { cwd, signal });
    return { stdout: result.stdout, stderr: result.stderr, code: result.code };
}
export default { schema, execute };
//# sourceMappingURL=zone-filling.js.map
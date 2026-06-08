import { Type } from "typebox";
export const schema = Type.Object({
    input: Type.String(),
    add: Type.Optional(Type.Boolean()),
    remove: Type.Optional(Type.Boolean()),
});
export async function execute(args, cwd, signal, ctx) {
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.teardrops', args.input];
    if (args.add)
        cmd.push('--add');
    if (args.remove)
        cmd.push('--remove');
    const result = await ctx.exec(python, cmd.slice(1), { cwd, signal });
    return { stdout: result.stdout, stderr: result.stderr, code: result.code };
}
export default { schema, execute };
//# sourceMappingURL=teardrops.js.map
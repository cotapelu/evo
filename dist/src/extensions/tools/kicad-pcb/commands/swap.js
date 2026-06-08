import { Type } from "typebox";
export const schema = Type.Object({
    input: Type.String(),
    item1: Type.String(),
    item2: Type.String(),
});
export async function execute(args, cwd, signal, ctx) {
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.swap', args.input];
    cmd.push('--item1', args.item1, '--item2', args.item2);
    const result = await ctx.exec(python, cmd.slice(1), { cwd, signal });
    return { stdout: result.stdout, stderr: result.stderr, code: result.code };
}
export default { schema, execute };
//# sourceMappingURL=swap.js.map
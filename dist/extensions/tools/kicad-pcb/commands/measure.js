import { Type } from "typebox";
export const schema = Type.Object({
    input: Type.String(),
    point1: Type.String(),
    point2: Type.String(),
});
export async function execute(args, cwd, signal, ctx) {
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.measure', args.input];
    cmd.push('--point1', args.point1, '--point2', args.point2);
    const result = await ctx.exec(python, cmd.slice(1), { cwd, signal });
    return { stdout: result.stdout, stderr: result.stderr, code: result.code };
}
export default { schema, execute };
//# sourceMappingURL=measure.js.map
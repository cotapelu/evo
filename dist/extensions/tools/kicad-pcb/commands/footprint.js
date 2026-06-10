import { Type } from "typebox";
export const schema = Type.Object({
    input: Type.String(),
    footprint: Type.String(),
    action: Type.String(),
});
export async function execute(args, cwd, signal, ctx) {
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.pcb.footprint', args.input];
    cmd.push('--footprint', args.footprint, '--action', args.action);
    const result = await ctx.exec(python, cmd.slice(1), { cwd, signal });
    return { stdout: result.stdout, stderr: result.stderr, code: result.code };
}
export default { schema, execute };
//# sourceMappingURL=footprint.js.map
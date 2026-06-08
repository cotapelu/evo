import { Type } from "typebox";
export const schema = Type.Object({
    input: Type.String(),
    old_font: Type.String(),
    new_font: Type.String(),
});
export async function execute(args, cwd, signal, ctx) {
    const python = process.env.PYTHON || 'python3';
    const cmd = [python, '-m', 'kicad.sch.replace_fonts', args.input];
    cmd.push('--old-font', args.old_font, '--new-font', args.new_font);
    const result = await ctx.exec(python, cmd.slice(1), { cwd, signal });
    return { stdout: result.stdout, stderr: result.stderr, code: result.code };
}
export default { schema, execute };
//# sourceMappingURL=replace-fonts.js.map
#!/usr/bin/env node
/**
 * KiCad Schematic Tool
 * Registry-based super-tool with modular commands
 */
// ============================================================================
// Load Commands
// ============================================================================
const commands = {
    // @ts-ignore
    export: () => import('./kicad-sch/commands/export.js'),
    // @ts-ignore
    plot: () => import('./kicad-sch/commands/plot.js'),
    // @ts-ignore
    diff: () => import('./kicad-sch/commands/diff.js'),
    // @ts-ignore
    generate_netlist: () => import('./kicad-sch/commands/netlist.js'),
    // @ts-ignore
    erc: () => import('./kicad-sch/commands/erc.js'),
    // @ts-ignore
    drc: () => import('./kicad-sch/commands/drc.js'),
    // @ts-ignore
    annotate: () => import('./kicad-sch/commands/annotate.js'),
    // @ts-ignore
    symbol_check: () => import('./kicad-sch/commands/symbol-check.js'),
    // @ts-ignore
    field_edit: () => import('./kicad-sch/commands/field-edit.js'),
    // @ts-ignore
    replace_fonts: () => import('./kicad-sch/commands/replace-fonts.js'),
    // @ts-ignore
    update_ids: () => import('./kicad-sch/commands/update-ids.js'),
};
// ============================================================================
// Tool Factory
// ============================================================================
export function createKicadSchTool() {
    return {
        name: "kicad_sch",
        label: "KiCad Schematic",
        description: "Full KiCad Schematic operations via Python API. Commands: export, plot, diff, generate_netlist, erc, drc, annotate, symbol_check, field_edit, replace_fonts, update_ids.",
        promptSnippet: "kicad_sch({ command: '<cmd>', args: {...} })",
        promptGuidelines: [
            "kicad_sch({ command: 'export', args: { input: 'schematic.kicad_sch', format: 'pdf' } })",
            "kicad_sch({ command: 'erc', args: { input: 'schematic.kicad_sch' } })",
            "kicad_sch({ command: 'drc', args: { input: 'schematic.kicad_sch' } })",
            "kicad_sch({ command: 'generate_netlist', args: { input: 'schematic.kicad_sch' } })",
            "kicad_sch({ command: 'annotate', args: { input: 'schematic.kicad_sch' } })",
            "kicad_sch({ command: 'field_edit', args: { input: 'schematic.kicad_sch', field_name: 'Value', field_value: '10k' } })",
        ],
        parameters: {
            type: "object",
            properties: {
                command: { type: "string", enum: Object.keys(commands), description: "Sub-command" },
                args: { type: "object", description: "Arguments" },
            },
            required: ["command", "args"],
        },
        async execute(_toolCallId, params, signal, _onUpdate, ctx) {
            const { command, args } = params;
            const loader = commands[command];
            if (!loader) {
                return { content: [{ type: "text", text: `Unknown command: ${command}. Use: ${Object.keys(commands).join(', ')}` }], details: null, isError: true };
            }
            try {
                const mod = await loader();
                const cwd = ctx.session?.cwd ?? process.cwd();
                const result = await mod.execute(args, cwd, signal, ctx);
                // Treat non-zero exit as error
                if (result.code !== 0) {
                    throw new Error(result.stderr || `Command ${command} exited with code ${result.code}`);
                }
                return { content: [{ type: "text", text: result.stdout }], details: result, isError: false };
            }
            catch (error) {
                return { content: [{ type: "text", text: `kicad_sch ${command} error: ${error.message}` }], details: null, isError: true };
            }
        }
    };
}
export function registerKicadSchTool(api) {
    api.registerTool(createKicadSchTool());
}
//# sourceMappingURL=kicad-sch.js.map
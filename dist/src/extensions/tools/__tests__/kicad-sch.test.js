import { jest } from '@jest/globals';
import { createKicadSchTool, registerKicadSchTool } from '../kicad-sch.js';
// Mock API
function createMockApi() {
    const api = {
        on: jest.fn(),
        registerTool: jest.fn((tool) => { api.registeredTool = tool; }),
    };
    return api;
}
function createMockContext(cwd = '/test/project') {
    return {
        sessionManager: { getBranch: jest.fn(() => []) },
        session: { cwd },
        exec: jest.fn(),
    };
}
describe('KiCad Schematic Tool', () => {
    let api;
    let tool;
    beforeEach(() => {
        api = createMockApi();
        registerKicadSchTool(api);
        tool = api.registeredTool;
        expect(tool).toBeDefined();
        expect(tool.name).toBe('kicad_sch');
    });
    describe('Tool Definition', () => {
        it('has correct name and label', () => {
            expect(tool.name).toBe('kicad_sch');
            expect(tool.label).toBe('KiCad Schematic');
        });
        it('includes all expected commands', () => {
            const commands = tool.parameters.properties.command.enum;
            expect(commands).toContain('export');
            expect(commands).toContain('plot');
            expect(commands).toContain('diff');
            expect(commands).toContain('generate_netlist');
            expect(commands).toContain('erc');
            expect(commands).toContain('drc');
            expect(commands).toContain('annotate');
            expect(commands).toContain('symbol_check');
            expect(commands).toContain('field_edit');
            expect(commands).toContain('replace_fonts');
            expect(commands).toContain('update_ids');
        });
        it('requires command and args', () => {
            expect(tool.parameters.required).toContain('command');
            expect(tool.parameters.required).toContain('args');
        });
    });
    describe('Command Execution', () => {
        let ctx;
        beforeEach(() => {
            ctx = createMockContext();
            // Mock exec to simulate Python process
            ctx.exec = jest.fn(async () => ({ stdout: 'mocked output', stderr: '', code: 0 }));
        });
        test('export command calls correct Python module', async () => {
            const result = await tool.execute('call', {
                command: 'export',
                args: { input: 'schematic.kicad_sch', format: 'pdf' }
            }, undefined, undefined, ctx);
            expect(ctx.exec).toHaveBeenCalledWith('python3', expect.arrayContaining(['-m', 'kicad.sch.export', 'schematic.kicad_sch', '--format', 'pdf']), { cwd: '/test/project', signal: undefined });
            expect(result.isError).toBe(false);
            expect(result.content[0].text).toBe('mocked output');
        });
        test('erc command includes severity if provided', async () => {
            const result = await tool.execute('call', {
                command: 'erc',
                args: { input: 'schematic.kicad_sch', severity: 'error' }
            }, undefined, undefined, ctx);
            expect(ctx.exec).toHaveBeenCalledWith('python3', expect.arrayContaining(['-m', 'kicad.sch.erc', 'schematic.kicad_sch', '--severity', 'error']), { cwd: '/test/project', signal: undefined });
        });
        test('field_edit passes field_name and field_value', async () => {
            const result = await tool.execute('call', {
                command: 'field_edit',
                args: { input: 'schematic.kicad_sch', field_name: 'Value', field_value: '10k' }
            }, undefined, undefined, ctx);
            expect(ctx.exec).toHaveBeenCalledWith('python3', expect.arrayContaining(['-m', 'kicad.sch.field_edit', 'schematic.kicad_sch', '--field-name', 'Value', '--field-value', '10k']), { cwd: '/test/project', signal: undefined });
        });
        test('replace_fonts passes old and new font', async () => {
            const result = await tool.execute('call', {
                command: 'replace_fonts',
                args: { input: 'schematic.kicad_sch', old_font: 'OldFont', new_font: 'NewFont' }
            }, undefined, undefined, ctx);
            expect(ctx.exec).toHaveBeenCalledWith('python3', expect.arrayContaining(['-m', 'kicad.sch.replace_fonts', 'schematic.kicad_sch', '--old-font', 'OldFont', '--new-font', 'NewFont']), { cwd: '/test/project', signal: undefined });
        });
        test('unknown command returns error', async () => {
            const result = await tool.execute('call', {
                command: 'nonexistent',
                args: {}
            }, undefined, undefined, ctx);
            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('Unknown command');
        });
    });
    describe('Error Handling', () => {
        let ctx;
        beforeEach(() => {
            ctx = createMockContext();
            ctx.exec = jest.fn(async () => ({ stdout: '', stderr: 'Error message', code: 1 }));
        });
        test('non-zero exit code returns error', async () => {
            const result = await tool.execute('call', {
                command: 'export',
                args: { input: 'schematic.kicad_sch' }
            }, undefined, undefined, ctx);
            expect(result.isError).toBe(true);
        });
    });
    describe('Utility Functions', () => {
        it('exports createKicadSchTool function', () => {
            expect(typeof createKicadSchTool).toBe('function');
            expect(typeof registerKicadSchTool).toBe('function');
        });
    });
});
//# sourceMappingURL=kicad-sch.test.js.map
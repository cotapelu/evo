import { jest } from '@jest/globals';
// Import all tool registration functions
import { registerTodosTool, registerMemoryTool, registerBranchTool, registerSessionInfoTool, registerTestRunnerTool, registerGitTool, registerKicadSchTool, registerKicadPcbTool, registerCodeHealthTool, registerFormatTool, registerMetricsTool, registerSecurityAuditTool, registerExtensionTemplateGeneratorTool } from '../tools/index.js';
import { registerTeamTool } from '../team/index.js';
import autoContinueExtension from '../hooks/auto-continue.js';
import piclawHeader from '../piclaw-header.js';
function createMockApi() {
    return {
        registerTool: jest.fn(),
        registerProvider: jest.fn(),
        registerCommand: jest.fn(), // used by auto-continue
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
        exec: jest.fn(),
        appendEntry: jest.fn(),
        // Minimal UI stubs for extensions that check ctx.hasUI
        ui: {
            setHeader: jest.fn(),
        },
    };
}
describe('Extension Registration Integration', () => {
    let api;
    beforeEach(() => {
        api = createMockApi();
    });
    test('all tool registration functions execute without throwing', () => {
        const tools = [
            registerTodosTool,
            registerMemoryTool,
            registerBranchTool,
            registerSessionInfoTool,
            registerTestRunnerTool,
            registerGitTool,
            registerKicadSchTool,
            registerKicadPcbTool,
            registerCodeHealthTool,
            registerFormatTool,
            registerMetricsTool,
            registerSecurityAuditTool,
            registerExtensionTemplateGeneratorTool,
        ];
        for (const toolReg of tools) {
            expect(() => toolReg(api)).not.toThrow();
        }
    });
    test('each tool registration calls registerTool at least once', () => {
        const tools = [
            registerTodosTool,
            registerMemoryTool,
            registerBranchTool,
            registerSessionInfoTool,
            registerTestRunnerTool,
            registerGitTool,
            registerKicadSchTool,
            registerKicadPcbTool,
            registerCodeHealthTool,
            registerFormatTool,
            registerMetricsTool,
            registerSecurityAuditTool,
            registerExtensionTemplateGeneratorTool,
        ];
        for (const toolReg of tools) {
            api.registerTool.mockClear();
            toolReg(api);
            expect(api.registerTool).toHaveBeenCalled();
        }
    });
    test('registered tools have proper structure', () => {
        const tools = [
            registerTodosTool,
            registerMemoryTool,
            registerBranchTool,
            registerSessionInfoTool,
            registerTestRunnerTool,
            registerGitTool,
            registerKicadSchTool,
            registerKicadPcbTool,
            registerCodeHealthTool,
            registerFormatTool,
            registerMetricsTool,
            registerSecurityAuditTool,
            registerExtensionTemplateGeneratorTool,
        ];
        for (const toolReg of tools) {
            api.registerTool.mockClear();
            toolReg(api);
            const toolCall = api.registerTool.mock.calls[0][0];
            expect(typeof toolCall.name).toBe('string');
            expect(typeof toolCall.execute).toBe('function');
        }
    });
    test('no duplicate tool names across all tools', () => {
        const tools = [
            registerTodosTool,
            registerMemoryTool,
            registerBranchTool,
            registerSessionInfoTool,
            registerTestRunnerTool,
            registerGitTool,
            registerKicadSchTool,
            registerKicadPcbTool,
            registerCodeHealthTool,
            registerFormatTool,
            registerMetricsTool,
            registerSecurityAuditTool,
            registerExtensionTemplateGeneratorTool,
        ];
        const names = [];
        for (const toolReg of tools) {
            toolReg(api);
            const tool = api.registerTool.mock.calls[api.registerTool.mock.calls.length - 1][0];
            expect(names).not.toContain(tool.name);
            names.push(tool.name);
        }
    });
    test('team tool registration calls registerTool', () => {
        registerTeamTool(api);
        expect(api.registerTool).toHaveBeenCalled();
    });
    test('auto-continue extension executes without throwing', () => {
        expect(() => autoContinueExtension(api)).not.toThrow();
    });
    test('piclaw-header executes without throwing', () => {
        expect(() => piclawHeader(api)).not.toThrow();
    });
});
//# sourceMappingURL=registration.test.js.map
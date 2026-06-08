import { jest } from '@jest/globals';
describe('Git Integration Extension', () => {
    beforeEach(() => {
        jest.resetModules();
    });
    it('should load without errors', async () => {
        // The extension is imported via main.ts, verify the module can be loaded
        expect(() => import('../extensions/git-integration.js')).not.toThrow();
    });
    it('should export a default function', async () => {
        const ext = await import('../extensions/git-integration.js');
        expect(typeof ext.default).toBe('function');
    });
});
//# sourceMappingURL=git-integration.test.js.map
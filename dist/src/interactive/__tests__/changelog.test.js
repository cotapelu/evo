import { parseChangelog, getNewEntries } from '../utils/changelog.js';
describe('Changelog Utils', () => {
    describe('parseChangelog', () => {
        it('parses markdown with version headers', () => {
            const content = `# v1.0.0\n- feature 1\n\n# v0.9.0\n- fix 1\n`;
            const entries = parseChangelog(content);
            expect(entries.length).toBe(2);
            expect(entries[0].version).toBe('v1.0.0');
            expect(entries[1].version).toBe('v0.9.0');
        });
        it('handles empty content', () => {
            const entries = parseChangelog('');
            expect(entries).toEqual([]);
        });
        it('retains full content for each entry', () => {
            const content = `# v1.0.0\n- feature\n- another\n\n`;
            const entries = parseChangelog(content);
            expect(entries[0].content).toContain('- feature');
            expect(entries[0].content).toContain('- another');
        });
    });
    describe('getNewEntries', () => {
        it('filters entries newer than last version', () => {
            const entries = [
                { version: '1.0.0' },
                { version: '0.9.0' },
                { version: '0.8.0' },
            ];
            const newer = getNewEntries(entries, '0.9.0');
            expect(newer.length).toBe(1);
            expect(newer[0].version).toBe('1.0.0');
        });
        it('returns empty if no newer versions', () => {
            const entries = [{ version: '1.0.0' }];
            const newer = getNewEntries(entries, '1.0.0');
            expect(newer).toEqual([]);
        });
        it('handles three-part version comparison', () => {
            const entries = [
                { version: '1.2.3' },
                { version: '1.2.2' },
            ];
            const newer = getNewEntries(entries, '1.2.0');
            expect(newer.length).toBe(2);
        });
    });
});
//# sourceMappingURL=changelog.test.js.map
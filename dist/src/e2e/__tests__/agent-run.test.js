import { createAgentSession, DefaultResourceLoader } from '@earendil-works/pi-coding-agent';
import { getResourceLoaderOptions } from '../../extensions/index.js';
import { mkdtemp, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
describe('E2E Agent Session', () => {
    let session;
    let tempAgentDir;
    beforeAll(async () => {
        tempAgentDir = await mkdtemp(join(tmpdir(), 'evo-e2e-'));
        const rlOptions = {
            ...getResourceLoaderOptions(),
            cwd: process.cwd(),
            agentDir: tempAgentDir,
        };
        const resourceLoader = new DefaultResourceLoader(rlOptions);
        const result = await createAgentSession({ resourceLoader });
        session = result.session;
    });
    afterAll(async () => {
        await session.dispose();
        try {
            await rmdir(tempAgentDir, { recursive: true });
        }
        catch (e) {
            // ignore
        }
    });
    test('agent responds to prompt', async () => {
        await session.prompt('Hello');
        const entries = session.sessionManager.getBranch();
        const assistantEntries = entries.filter((e) => e.type === 'message' && e.message.role === 'assistant');
        expect(assistantEntries.length).toBeGreaterThan(0);
        const last = assistantEntries[assistantEntries.length - 1];
        const text = last.message.content
            .filter((c) => c.type === 'text')
            .map((c) => c.text)
            .join('\n');
        // The agent should produce a non-empty response
        expect(text.length).toBeGreaterThan(0);
        // It likely includes a greeting
        expect(text.toLowerCase()).toContain('hello');
    });
});
//# sourceMappingURL=agent-run.test.js.map
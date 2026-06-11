import { jest } from '@jest/globals';
import { join } from 'node:path';
import fs from 'node:fs';
import { tmpdir } from 'node:os';

function createMockApi() {
  const handlers: Record<string, Function[]> = {};
  const api: any = {
    on: jest.fn((event: string, handler: Function) => {
      handlers[event] = handlers[event] || [];
      handlers[event].push(handler);
    }),
    registerTool: jest.fn((tool: any) => { api.registeredTool = tool; }),
    registerCommand: jest.fn(),
    sendMessage: jest.fn(),
    getHandlers: () => handlers,
  };
  return api;
}

function createMockContext(custom?: any) {
  return {
    cwd: '/project',
    getSystemPrompt: () => 'Base prompt',
    ...custom,
  } as any;
}

async function getFreshModule() {
  await jest.resetModules();
  return await import('..');
}

describe('Resource Loader Extension', () => {
  let api: any;
  let extModule: any;
  let register: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    extModule = await getFreshModule();
    register = extModule.default;
  });

  describe('registration', () => {
    test('registers session_start handler', () => {
      api = createMockApi();
      register(api);
      expect(api.on).toHaveBeenCalledWith('session_start', expect.any(Function));
    });

    test('registers before_agent_start handler', () => {
      api = createMockApi();
      register(api);
      expect(api.on).toHaveBeenCalledWith('before_agent_start', expect.any(Function));
    });

    test('registers resources.list tool', () => {
      api = createMockApi();
      register(api);
      expect(api.registerTool).toHaveBeenCalledWith(expect.objectContaining({ name: 'resources.list' }));
    });

    test('registers resources.reload and resources.list commands', () => {
      api = createMockApi();
      register(api);
      expect(api.registerCommand).toHaveBeenCalledWith('resources.list', expect.any(Object));
      expect(api.registerCommand).toHaveBeenCalledWith('resources.reload', expect.any(Object));
    });
  });

  describe('scanDocumentation (with real temporary files)', () => {
    test('finds relevant markdown files', () => {
      const cwd = fs.mkdtempSync(join(tmpdir(), 'evo-test-'));
      try {
        fs.writeFileSync(join(cwd, 'AGENTS.md'), 'Agents content');
        fs.writeFileSync(join(cwd, 'README.md'), 'Readme content');
        const docsDir = join(cwd, 'docs');
        fs.mkdirSync(docsDir);
        fs.writeFileSync(join(docsDir, 'README.md'), 'Docs readme');

        const result = extModule.scanDocumentation(cwd);
        expect(result).toHaveLength(3);
        const paths = result.map(f => f.path);
        expect(paths).toContain('AGENTS.md');
        expect(paths).toContain('README.md');
        expect(paths).toContain(join('docs', 'README.md'));
      } finally {
        fs.rmSync(cwd, { recursive: true, force: true });
      }
    });

    test('ignores non-doc files', () => {
      const cwd = fs.mkdtempSync(join(tmpdir(), 'evo-test-'));
      try {
        fs.writeFileSync(join(cwd, 'package.json'), '{}');
        const srcDir = join(cwd, 'src');
        fs.mkdirSync(srcDir);
        fs.writeFileSync(join(srcDir, 'index.ts'), 'code');

        const result = extModule.scanDocumentation(cwd);
        expect(result).toHaveLength(0);
      } finally {
        fs.rmSync(cwd, { recursive: true, force: true });
      }
    });

    test('skips hidden dirs and node_modules', () => {
      const cwd = fs.mkdtempSync(join(tmpdir(), 'evo-test-'));
      try {
        fs.mkdirSync(join(cwd, '.git'));
        fs.mkdirSync(join(cwd, 'node_modules'));
        fs.writeFileSync(join(cwd, 'AGENTS.md'), '# Agents');
        const hiddenDocs = join(cwd, '.hidden', 'doc.md');
        fs.mkdirSync(join(cwd, '.hidden'));
        fs.writeFileSync(hiddenDocs, 'hidden');

        const result = extModule.scanDocumentation(cwd);
        expect(result).toHaveLength(1);
        expect(result[0].path).toBe('AGENTS.md');
      } finally {
        fs.rmSync(cwd, { recursive: true, force: true });
      }
    });
  });

  describe('session_start and before_agent_start integration', () => {
    test('session_start populates extraAgentsFiles and before_agent_start injects them into system prompt', async () => {
      const cwd = fs.mkdtempSync(join(tmpdir(), 'evo-test-'));
      try {
        fs.writeFileSync(join(cwd, 'AGENTS.md'), 'Custom agents instructions');

        api = createMockApi();
        register(api);

        const startHandler = api.getHandlers()['session_start'][0];
        const beforeHandler = api.getHandlers()['before_agent_start'][0];

        // Trigger session_start
        await startHandler({ cwd }, createMockContext({ cwd }));

        // before_agent_start should now return a modified system prompt
        const result = await beforeHandler({}, createMockContext({ getSystemPrompt: () => 'Base prompt' }));
        expect(result).not.toBeUndefined();
        expect(result.systemPrompt).toContain('Project-specific instructions and guidelines (additional)');
        expect(result.systemPrompt).toContain('<project_instructions path="AGENTS.md">');
        expect(result.systemPrompt).toContain('Custom agents instructions');
      } finally {
        fs.rmSync(cwd, { recursive: true, force: true });
      }
    });

    test('before_agent_start returns undefined when no extra files (no session_start called)', async () => {
      api = createMockApi();
      register(api);
      const beforeHandler = api.getHandlers()['before_agent_start'][0];
      const result = await beforeHandler({}, createMockContext());
      expect(result).toBeUndefined();
    });
  });

  describe('resources.list tool', () => {
    let tool: any;

    // Note: api and register are set in beforeEach, and api.registeredTool is set after register.
    // We'll manually set tool after each test's setup.
    test('tool metadata', async () => {
      api = createMockApi();
      register(api);
      tool = api.registeredTool;
      expect(tool.name).toBe('resources.list');
    });

    test('execute returns combined resources after session_start populates extraAgentsFiles', async () => {
      const cwd = fs.mkdtempSync(join(tmpdir(), 'evo-test-'));
      try {
        // Use a relevant filename: README.md
        fs.writeFileSync(join(cwd, 'README.md'), 'Readme content');

        api = createMockApi();
        register(api);

        // Run session_start to populate extraAgentsFiles
        const startHandler = api.getHandlers()['session_start'][0];
        await startHandler({ cwd }, createMockContext({ cwd }));

        // Mock resourceLoader with one default file
        const defaultAgents = [{ path: 'AGENTS.md', content: 'Default content' }];
        const ctx = createMockContext({
          sdkServices: { resourceLoader: { getAgentsFiles: () => ({ agentsFiles: defaultAgents }) } },
        });

        const result = await api.registeredTool.execute('1', {}, undefined, undefined, ctx);
        expect(result.isError).toBe(false);
        expect(result.details.count).toBe(2);
        expect(result.details.files).toContain('AGENTS.md');
        expect(result.details.files).toContain('README.md');
      } finally {
        fs.rmSync(cwd, { recursive: true, force: true });
      }
    });

    test('execute works with no extraAgentsFiles', async () => {
      api = createMockApi();
      register(api);
      const defaultAgents = [{ path: 'AGENTS.md', content: 'Default' }];
      const ctx = createMockContext({
        sdkServices: { resourceLoader: { getAgentsFiles: () => ({ agentsFiles: defaultAgents }) } },
      });
      const result = await api.registeredTool.execute('1', {}, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.details.count).toBe(1);
    });

    test('execute returns error if resourceLoader missing', async () => {
      api = createMockApi();
      register(api);
      const ctx = createMockContext({ sdkServices: null });
      const result = await api.registeredTool.execute('1', {}, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('ResourceLoader not initialized');
    });
  });

  describe('resources.reload command', () => {
    test('clears extraAgentsFiles and calls resourceLoader.reload', async () => {
      const cwd = fs.mkdtempSync(join(tmpdir(), 'evo-test-'));
      try {
        // Use relevant filename: README.md
        fs.writeFileSync(join(cwd, 'README.md'), 'content');

        api = createMockApi();
        register(api);

        const startHandler = api.getHandlers()['session_start'][0];
        await startHandler({ cwd }, createMockContext({ cwd }));

        // Verify that before_agent_start would include the file
        const beforeHandler = api.getHandlers()['before_agent_start'][0];
        let beforeResult = await beforeHandler({}, createMockContext({ getSystemPrompt: () => 'Base' }));
        expect(beforeResult).not.toBeUndefined();
        expect(beforeResult.systemPrompt).toContain('README.md'); // ensure it's included

        // Get reload command handler
        const reloadCmd = api.registerCommand.mock.calls.find((c: any) => c[0] === 'resources.reload')[1];
        const mockResourceLoader = { reload: jest.fn().mockResolvedValue(undefined) };
        const ctx = createMockContext({
          sdkServices: { resourceLoader: mockResourceLoader },
          ui: { notify: jest.fn() },
        });

        await reloadCmd.handler('', ctx);

        expect(mockResourceLoader.reload).toHaveBeenCalled();
        expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('reloaded'), 'success');

        // After reload, extraAgentsFiles should be cleared (set to empty by the command)
        beforeResult = await beforeHandler({}, ctx);
        expect(beforeResult).toBeUndefined();
      } finally {
        fs.rmSync(cwd, { recursive: true, force: true });
      }
    });
  });
});

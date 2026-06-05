import { jest } from '@jest/globals';
import { registerExtensionTemplateGeneratorTool } from '../extension-template-generator';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { mkdtemp, rmdir, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Extension Template Generator Tool', () => {
  let api: jest.Mocked<ExtensionAPI>;
  let tool: any;
  let tempDir: string;

  beforeEach(async () => {
    // Create a unique temporary directory
    tempDir = await mkdtemp(join(tmpdir(), 'evo-test-'));
    const ctx = { cwd: tempDir } as any;

    jest.clearAllMocks();

    api = {
      registerTool: jest.fn(),
    } as any;
    registerExtensionTemplateGeneratorTool(api);
    tool = api.registerTool.mock.calls[0][0];

    // Store context for use in tests
    (tool as any).testCtx = ctx;
  });

  afterEach(async () => {
    // Cleanup temp directory
    try {
      await rmdir(tempDir, { recursive: true });
    } catch (e) {
      // ignore cleanup errors
    }
  });

  test('tool has correct metadata', () => {
    expect(tool.name).toBe('extension-template-generator');
    expect(tool.label).toBe('Extension Template Generator');
    expect(tool.description).toContain('Generate scaffold');
  });

  test('execute: generates tool template successfully', async () => {
    const ctx = (tool as any).testCtx;
    const result = await tool.execute('1', { type: 'tool', name: 'myTool' }, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.details.filePath).toContain('src/extensions/tools/myTool.ts');
    expect(result.details.testFilePath).toContain('src/extensions/tools/__tests__/myTool.test.ts');

    // Verify files exist and contain expected content
    const mainPath = join(tempDir, 'src/extensions/tools/myTool.ts');
    const testPath = join(tempDir, 'src/extensions/tools/__tests__/myTool.test.ts');

    const mainContent = await readFile(mainPath, 'utf-8');
    expect(mainContent).toContain("function createMyToolTool()");
    expect(mainContent).toContain("name: 'myTool'");
    expect(mainContent).toContain("api.registerTool");

    const testContent = await readFile(testPath, 'utf-8');
    expect(testContent).toContain('MyTool Tool');
    expect(testContent).toContain("createMyToolTool");
  });

  test('execute: generates provider template successfully', async () => {
    const ctx = (tool as any).testCtx;
    const result = await tool.execute('1', { type: 'provider', name: 'myProvider' }, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.details.filePath).toContain('src/extensions/providers/myProvider.ts');

    const mainPath = join(tempDir, 'src/extensions/providers/myProvider.ts');
    const mainContent = await readFile(mainPath, 'utf-8');
    expect(mainContent).toContain("function createMyProviderProvider()");
    expect(mainContent).toContain("name: 'myProvider'");
    expect(mainContent).toContain("api.registerProvider");
  });

  test('execute: generates hook template successfully', async () => {
    const ctx = (tool as any).testCtx;
    const result = await tool.execute('1', { type: 'hook', name: 'myHook' }, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.details.filePath).toContain('src/extensions/hooks/myHook.ts');

    const mainPath = join(tempDir, 'src/extensions/hooks/myHook.ts');
    const mainContent = await readFile(mainPath, 'utf-8');
    expect(mainContent).toContain("function createMyHookHook()");
    expect(mainContent).toContain("name: 'myHook'");
    expect(mainContent).toContain("api.registerHook");
  });

  test('execute: includes custom description in generated content', async () => {
    const ctx = (tool as any).testCtx;
    await tool.execute('1', { type: 'tool', name: 'customTool', description: 'Custom desc' }, undefined, undefined, ctx);
    const mainPath = join(tempDir, 'src/extensions/tools/customTool.ts');
    const mainContent = await readFile(mainPath, 'utf-8');
    expect(mainContent).toContain('Custom desc');
  });

  test('execute: rejects invalid type', async () => {
    const ctx = (tool as any).testCtx;
    const result = await tool.execute('1', { type: 'invalid', name: 'test' }, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('type must be');
  });

  test('execute: rejects invalid name (non-camelCase)', async () => {
    const ctx = (tool as any).testCtx;
    const result = await tool.execute('1', { type: 'tool', name: 'MyTool' }, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('camelCase');
  });

  test('execute: rejects missing name', async () => {
    const ctx = (tool as any).testCtx;
    const result = await tool.execute('1', { type: 'tool' }, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('name');
  });

  test('execute: rejects missing type', async () => {
    const ctx = (tool as any).testCtx;
    const result = await tool.execute('1', { name: 'something' }, undefined, undefined, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('type must');
  });
});
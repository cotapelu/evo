#!/usr/bin/env node
/**
 * Extension Template Generator
 *
 * Generates scaffold code for new extensions (tools, providers, hooks).
 * Ensures consistent structure and correct TypeScript typings.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
function toPascalCase(str) {
    return str.replace(/(\w)(\w*)/g, (_, first, rest) => first.toUpperCase() + rest);
}
function generateToolTemplate(name, description) {
    return `#!/usr/bin/env node
/**
 * ${description || name}
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';

function create${toPascalCase(name)}Tool(): ToolDefinition<any, any> {
  return {
    name: '${name}',
    label: '${toPascalCase(name)}',
    description: '${description || 'TODO: Add description'}',
    parameters: {},
    async execute(toolCallId, params, _signal, _onUpdate, ctx) {
      return {
        content: [{ type: 'text', text: '${name} executed' }],
        details: {},
        isError: false,
      };
    },
  };
}

export function register${toPascalCase(name)}Tool(api: ExtensionAPI): void {
  api.registerTool(create${toPascalCase(name)}Tool());
}
`;
}
function generateToolTestTemplate(name) {
    const pascalName = toPascalCase(name);
    return `import { create${pascalName}Tool } from '../${name}';

describe('${pascalName} Tool', () => {
  let tool: any;

  beforeEach(() => {
    const { create${pascalName}Tool } = require('../${name}');
    tool = create${pascalName}Tool();
  });

  test('should be defined', () => {
    expect(tool).toBeDefined();
    expect(tool.name).toBe('${name}');
  });

  test('execute returns success', async () => {
    const ctx = { cwd: '/workspace' } as any;
    const result = await tool.execute('1', {}, undefined, undefined, ctx);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('executed');
  });
});
`;
}
function generateProviderTemplate(name, description) {
    const pascalName = toPascalCase(name);
    return `import type { ExtensionAPI, Provider } from '@earendil-works/pi-coding-agent';

function create${pascalName}Provider(): Provider {
  return {
    name: '${name}',
    description: '${description || 'TODO: Add description'}',
    async initialize(api: ExtensionAPI) {
      // TODO: Initialize provider if needed
    },
    async execute(modelId: string, prompt: string, options?: any) {
      // TODO: Implement provider logic
      return { content: [{ type: 'text', text: '${name} response' }] };
    },
  };
}

export function register${pascalName}Provider(api: ExtensionAPI): void {
  api.registerProvider(create${pascalName}Provider());
}
`;
}
function generateProviderTestTemplate(name) {
    const pascalName = toPascalCase(name);
    return `import { create${pascalName}Provider } from '../${name}';

describe('${pascalName} Provider', () => {
  let provider: any;

  beforeEach(() => {
    const { create${pascalName}Provider } = require('../${name}');
    provider = create${pascalName}Provider();
  });

  test('should be defined', () => {
    expect(provider).toBeDefined();
    expect(provider.name).toBe('${name}');
  });

  test('execute returns response', async () => {
    const result = await provider.execute('model', 'prompt');
    expect(result.content).toBeDefined();
  });
});
`;
}
function generateHookTemplate(name, description) {
    const pascalName = toPascalCase(name);
    return `import type { ExtensionAPI, Hook } from '@earendil-works/pi-coding-agent';

function create${pascalName}Hook(): Hook {
  return {
    name: '${name}',
    description: '${description || 'TODO: Add description'}',
    events: [], // TODO: specify events e.g., ['onAgentStart', 'onAgentEnd']
    async onAgentStart(ctx: any) {
      // TODO: Implement hook logic
    },
    async onAgentEnd(ctx: any) {
      // TODO: Implement hook logic
    },
  };
}

export function register${pascalName}Hook(api: ExtensionAPI): void {
  api.registerHook(create${pascalName}Hook());
}
`;
}
function generateHookTestTemplate(name) {
    const pascalName = toPascalCase(name);
    return `import { create${pascalName}Hook } from '../${name}';

describe('${pascalName} Hook', () => {
  let hook: any;

  beforeEach(() => {
    const { create${pascalName}Hook } = require('../${name}');
    hook = create${pascalName}Hook();
  });

  test('should be defined', () => {
    expect(hook).toBeDefined();
    expect(hook.name).toBe('${name}');
  });

  test('has events array', () => {
    expect(Array.isArray(hook.events)).toBe(true);
  });
});
`;
}
function createTemplateGeneratorTool() {
    return {
        name: 'extension-template-generator',
        label: 'Extension Template Generator',
        description: 'Generate scaffold for new extensions (tools, providers, hooks) with correct typings.',
        parameters: {},
        async execute(toolCallId, params, _signal, _onUpdate, ctx) {
            let p;
            if (typeof params === 'string') {
                try {
                    p = JSON.parse(params);
                }
                catch (e) {
                    const msg = `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`;
                    return {
                        content: [{ type: 'text', text: `Error: ${msg}` }],
                        details: { error: msg },
                        isError: true,
                    };
                }
            }
            else {
                p = params;
            }
            if (!p || typeof p !== 'object') {
                const msg = 'Parameters must be an object';
                return { content: [{ type: 'text', text: `Error: ${msg}` }], details: { error: msg }, isError: true };
            }
            const extType = p.type;
            const name = p.name;
            const description = p.description || '';
            if (!extType || typeof extType !== 'string' || !['tool', 'provider', 'hook'].includes(extType)) {
                return { content: [{ type: 'text', text: `Error: type must be 'tool', 'provider', or 'hook'` }], details: { error: 'Invalid type' }, isError: true };
            }
            if (!name || typeof name !== 'string' || !/^[a-z][a-zA-Z0-9]*$/.test(name)) {
                return { content: [{ type: 'text', text: `Error: name must be camelCase (letters only, start lowercase)` }], details: { error: 'Invalid name' }, isError: true };
            }
            const cwd = ctx.cwd;
            const dir = join(cwd, 'src', 'extensions', `${extType}s`);
            const testDir = join(dir, '__tests__');
            try {
                await mkdir(dir, { recursive: true });
                await mkdir(testDir, { recursive: true });
            }
            catch (e) {
                return { content: [{ type: 'text', text: `Error creating directories: ${e.message}` }], details: { error: e.message }, isError: true };
            }
            const fileName = `${name}.ts`;
            const testFileName = `${name}.test.ts`;
            const filePath = join(dir, fileName);
            const testFilePath = join(testDir, testFileName);
            let mainContent;
            let testContent;
            if (extType === 'tool') {
                mainContent = generateToolTemplate(name, description);
                testContent = generateToolTestTemplate(name);
            }
            else if (extType === 'provider') {
                mainContent = generateProviderTemplate(name, description);
                testContent = generateProviderTestTemplate(name);
            }
            else {
                mainContent = generateHookTemplate(name, description);
                testContent = generateHookTestTemplate(name);
            }
            try {
                await writeFile(filePath, mainContent, 'utf-8');
                await writeFile(testFilePath, testContent, 'utf-8');
            }
            catch (e) {
                return { content: [{ type: 'text', text: `Error writing files: ${e.message}` }], details: { error: e.message }, isError: true };
            }
            const message = `✅ Generated ${extType} template: ${fileName} and ${testFileName}`;
            return {
                content: [{ type: 'text', text: message }],
                details: { type: extType, name, filePath, testFilePath },
                isError: false,
            };
        },
    };
}
export function registerExtensionTemplateGeneratorTool(api) {
    api.registerTool(createTemplateGeneratorTool());
}
//# sourceMappingURL=extension-template-generator.js.map
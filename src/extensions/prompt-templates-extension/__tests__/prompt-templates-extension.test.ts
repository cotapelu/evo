import { jest } from '@jest/globals';
import {
  createListPromptTemplatesTool,
  createExpandPromptTemplateTool,
} from '..';

function createMockContext(custom?: any) {
  return {
    cwd: process.cwd(),
    sdkServices: {
      resourceLoader: {
        getPrompts: jest.fn(() => ({ prompts: [] })),
      },
    },
    ...custom,
  } as any;
}

describe('Prompt Templates Extension', () => {
  describe('prompt.list tool', () => {
    let tool: any;
    beforeEach(() => {
      tool = createListPromptTemplatesTool();
    });

    test('tool metadata', () => {
      expect(tool.name).toBe('prompt.list');
      expect(tool.label).toBe('Prompts: List');
    });

    test('execute returns no prompts when none available', async () => {
      const ctx = createMockContext({
        sdkServices: {
          resourceLoader: {
            getPrompts: () => ({ prompts: [] }),
          },
        },
      } as any);
      const result = await tool.execute('1', {}, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('No prompt templates loaded.');
    });

    test('execute lists available templates', async () => {
      const mockPrompts = {
        prompts: [
          { name: 'greeting', description: 'Say hello' },
          { name: 'summary', description: 'Summarize' },
        ],
      };
      const ctx = createMockContext({
        sdkServices: { resourceLoader: { getPrompts: () => mockPrompts } },
      } as any);
      const result = await tool.execute('1', {}, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      const text = result.content[0].text;
      expect(text).toContain('greeting');
      expect(text).toContain('summary');
      expect(result.details.count).toBe(2);
    });

    test('execute returns error when resourceLoader unavailable', async () => {
      const ctx = createMockContext({ sdkServices: null } as any);
      const result = await tool.execute('1', {}, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('ResourceLoader not initialized');
    });
  });

  describe('prompt.expand tool', () => {
    let tool: any;
    beforeEach(() => {
      tool = createExpandPromptTemplateTool();
    });

    test('tool metadata', () => {
      expect(tool.name).toBe('prompt.expand');
      expect(tool.label).toBe('Prompts: Expand');
    });

    test('expand substitutes $1 and $2', async () => {
      const mockPrompts = {
        prompts: [
          { name: 'greeting', content: 'Hello $1!' },
          { name: 'intro', content: 'Hi $1 and $2!' },
        ],
      };
      const ctx = createMockContext({
        sdkServices: { resourceLoader: { getPrompts: () => mockPrompts } },
      } as any);

      // Test $1
      let result = await tool.execute('1', { name: 'greeting', args: ['World'] }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Hello World!');

      // Test $1 and $2
      result = await tool.execute('2', { name: 'intro', args: ['Alice', 'Bob'] }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Hi Alice and Bob!');
    });

    test('expand handles $@ (all args)', async () => {
      const mockPrompts = {
        prompts: [
          { name: 'list', content: 'Items: $@' },
        ],
      };
      const ctx = createMockContext({
        sdkServices: { resourceLoader: { getPrompts: () => mockPrompts } },
      } as any);
      const result = await tool.execute('1', { name: 'list', args: ['apples', 'bananas', 'cherries'] }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain('Items: apples bananas cherries');
    });

    test('expand returns error when template not found', async () => {
      const mockPrompts = {
        prompts: [{ name: 'existing', content: 'test' }],
      };
      const ctx = createMockContext({
        sdkServices: { resourceLoader: { getPrompts: () => mockPrompts } },
      } as any);
      const result = await tool.execute('1', { name: 'unknown', args: [] }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });

    test('expand works with empty args (no substitution)', async () => {
      const mockPrompts = {
        prompts: [{ name: 'greeting', content: 'Hello $1!' }],
      };
      const ctx = createMockContext({
        sdkServices: { resourceLoader: { getPrompts: () => mockPrompts } },
      } as any);
      const result = await tool.execute('1', { name: 'greeting' }, undefined, undefined, ctx);
      expect(result.isError).toBe(false);
      // Content should contain original $1 placeholder
      expect(result.content[0].text).toContain('Hello $1!');
    });
  });
});

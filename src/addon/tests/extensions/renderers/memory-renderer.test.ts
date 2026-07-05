import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock render-utils first
vi.mock('../../../extensions/utils/render-utils.js', () => ({
  styleError: (theme: any, text: string) => text, // just return text
}));

// Mock @earendil-works/pi-tui Text
vi.mock('@earendil-works/pi-tui', () => ({
  Text: class Text {
    text: string;
    constructor(text: string, _x: number, _y: number) {
      this.text = text;
    }
  },
}));

import { registerMemoryRenderer } from '../../../extensions/renderers/memory-renderer.ts';

describe('Memory Renderer', () => {
  let mockApi: any;
  let capturedRenderer: any;

  beforeEach(() => {
    mockApi = { registerMessageRenderer: vi.fn() };
    capturedRenderer = null;
    (mockApi.registerMessageRenderer as any).mockImplementation((type: string, fn: any) => {
      if (type === 'memory_result') capturedRenderer = fn;
    });
    registerMemoryRenderer(mockApi);
  });

  function mockTheme() {
    return {
      fg: (c: string, v: string) => v,
      bold: (v: string) => v,
    };
  }

  it('renders fallback when no details', () => {
    const msg = { details: undefined, content: [] };
    const result = capturedRenderer(msg, {}, mockTheme());
    expect(result.text).toBe('🧠 Memory operation');
  });

  it('renders action and total count', () => {
    const msg = {
      details: { action: 'search', memories: [{ id: 1, text: 'hello', tags: ['a'] }] },
      content: [{ text: 'Found 1 memory' }]
    };
    const result = capturedRenderer(msg, {}, mockTheme());
    expect(result.text).toContain('Action: search');
    expect(result.text).toContain('Total: 1 memories');
  });

  it('shows content text unless it contains error', () => {
    const msg = {
      details: { action: 'list', memories: [] },
      content: [{ text: 'Here are your memories' }]
    };
    const result = capturedRenderer(msg, {}, mockTheme());
    expect(result.text).toContain('Here are your memories');
  });

  it('hides content when it contains error', () => {
    const msg = {
      details: { action: 'list', memories: [] },
      content: [{ text: 'Error: something went wrong' }]
    };
    const result = capturedRenderer(msg, {}, mockTheme());
    expect(result.text).not.toContain('Error: something went wrong');
  });

  it('displays error from details', () => {
    const msg = {
      details: { action: 'search', memories: [], error: 'Search failed' },
      content: []
    };
    const result = capturedRenderer(msg, {}, mockTheme());
    // styleError returns text directly; we expect it to appear
    expect(result.text).toContain('❌ Search failed');
  });

  it('renders search results with icons and tags', () => {
    const memories = [
      { id: 1, text: 'Hello world', tags: ['hello'], created: Date.now() },
      { id: 2, text: 'Another memory', tags: ['test'], created: Date.now() }
    ];
    const msg = {
      details: { action: 'search', memories, resultCount: 2, query: 'hello' },
      content: []
    };
    const result = capturedRenderer(msg, {}, mockTheme());
    const text = result.text;
    expect(text).toContain('Matches:');
    // First memory tag matches query -> 🏷️
    expect(text).toContain('🏷️ #1');
    expect(text).toContain('Hello world');
    // Second memory does not match -> 📝
    expect(text).toContain('📝 #2');
  });

  it('truncates long text in search results', () => {
    const longText = 'A'.repeat(100);
    const memories = [{ id: 1, text: longText, tags: [], created: Date.now() }];
    const msg = {
      details: { action: 'search', memories, resultCount: 1 },
      content: []
    };
    const result = capturedRenderer(msg, {}, mockTheme());
    expect(result.text).toContain(longText.substring(0, 60) + '...');
  });

  it('shows dim overflow when more than 15 results', () => {
    const memories = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      text: `Memory ${i+1}`,
      tags: [],
      created: Date.now()
    }));
    const msg = {
      details: { action: 'search', memories, resultCount: 20 },
      content: []
    };
    const result = capturedRenderer(msg, {}, mockTheme());
    expect(result.text).toContain('...and 5 more.');
  });

  it('renders get action with target memory', () => {
    const mem = { id: 42, text: 'Important note', tags: ['work'], created: Date.now() };
    const msg = {
      details: { action: 'get', target: mem },
      content: []
    };
    const result = capturedRenderer(msg, {}, mockTheme());
    expect(result.text).toContain('Memory #42');
    expect(result.text).toContain('Important note');
    expect(result.text).toContain('Tags: work');
    expect(result.text).toContain('Created:');
  });
});

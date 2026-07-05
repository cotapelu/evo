import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerBranchSummaryRenderer } from '../../../extensions/renderers/branch-summary-renderer.ts';

// Mock @earendil-works/pi-tui Text
vi.mock('@earendil-works/pi-tui', () => ({
  Text: class Text {
    text: string;
    constructor(text: string, _x: number, _y: number) {
      this.text = text;
    }
  },
}));

describe('Branch Summary Renderer', () => {
  let mockApi: any;
  let capturedRenderer: any;

  beforeEach(() => {
    mockApi = { registerMessageRenderer: vi.fn() };
    capturedRenderer = null;
    (mockApi.registerMessageRenderer as any).mockImplementation((type: string, fn: any) => {
      if (type === 'branch_summary') capturedRenderer = fn;
    });
    registerBranchSummaryRenderer(mockApi);
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
    expect(result.text).toBe('🌿 Branch point');
  });

  it('renders details with summary and fromId', () => {
    const msg = {
      details: { summary: 'Test summary', fromId: 'entry-123', details: { extra: true } },
      content: []
    };
    const result = capturedRenderer(msg, {}, mockTheme());
    const text = result.text;
    expect(text).toContain('Branch Summary');
    expect(text).toContain('Test summary');
    expect(text).toContain('From entry: entry-123');
    expect(text).toContain('Additional context:');
    expect(text).toContain('{');
    expect(text).toContain('}');
  });

  it('renders border line', () => {
    const msg = { details: { summary: '' }, content: [] };
    const result = capturedRenderer(msg, {}, mockTheme());
    expect(result.text).toContain('─'.repeat(40));
  });

  it('handles empty details without crashing', () => {
    const msg = { details: {}, content: [] };
    const result = capturedRenderer(msg, {}, mockTheme());
    // When details exists but fromId is empty, header and separator appear
    expect(result.text).toContain('Branch Summary');
    expect(result.text).toContain('─'.repeat(40));
    // No fromId line
    expect(result.text).not.toContain('From entry');
  });
});

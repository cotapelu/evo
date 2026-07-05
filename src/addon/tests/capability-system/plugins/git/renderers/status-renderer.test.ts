import { describe, it, expect, vi } from 'vitest';
import statusRenderer from '../../../../../extensions/capability-system/plugins/git/renderers/status-renderer.js';

// Mock @earendil-works/pi-tui Text class
vi.mock('@earendil-works/pi-tui', () => ({
  Text: class Text {
    text: string;
    constructor(text: string, _x: number, _y: number) {
      this.text = text;
    }
  },
}));

import { Text } from '@earendil-works/pi-tui';

function theme(color: string) {
  return {
    fg: (c: string, value: any) => (c ? `[${c}]${value}[/${c}]` : String(value)),
    bold: (v: any) => `**${v}**`,
  };
}

describe('Git Status Renderer', () => {
  it('renders error state', () => {
    const result = { isError: true, details: { error: 'something went wrong' } };
    const rendered = statusRenderer.renderResult(result, {}, theme('default')) as Text;
    expect(rendered.text).toContain('something went wrong');
  });

  it('renders empty status (no branch, empty arrays)', () => {
    const result = { isError: false, details: {} };
    const rendered = statusRenderer.renderResult(result, {}, theme('default')) as Text;
    expect(rendered.text).toContain('Branch: [muted]unknown[/muted]');
    expect(rendered.text).toContain('Staged: [text]0[/text]');
    expect(rendered.text).toContain('Unstaged: [text]0[/text]');
    expect(rendered.text).toContain('Untracked: [text]0[/text]');
  });

  it('renders with branch and lists', () => {
    const result = {
      isError: false,
      details: {
        branch: 'main',
        staged: ['file1.ts'],
        unstaged: ['file2.ts'],
        untracked: ['file3.ts'],
      },
    };
    const rendered = statusRenderer.renderResult(result, {}, theme('default')) as Text;
    expect(rendered.text).toContain('Branch: [muted]main[/muted]');
    expect(rendered.text).toContain('Staged: [success]1[/success]');
    expect(rendered.text).toContain('[success]✓[/success] file1.ts');
    expect(rendered.text).toContain('Unstaged: [warning]1[/warning]');
    expect(rendered.text).toContain('[warning]✗[/warning] file2.ts');
    expect(rendered.text).toContain('Untracked: [dim]1[/dim]');
    expect(rendered.text).toContain('[dim]?[/dim] file3.ts');
  });

  it('does not list files when arrays empty', () => {
    const result = {
      isError: false,
      details: { staged: [], unstaged: [], untracked: [] },
    };
    const rendered = statusRenderer.renderResult(result, {}, theme('default')) as Text;
    expect(rendered.text).not.toContain('✓');
    expect(rendered.text).not.toContain('✗');
    expect(rendered.text).not.toContain('?');
  });
});

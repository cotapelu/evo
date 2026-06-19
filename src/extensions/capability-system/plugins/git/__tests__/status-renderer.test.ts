#!/usr/bin/env node
/**
 * Git Status Renderer Tests
 */

import { describe, it, expect } from 'vitest';
import { renderResult } from '../renderers/status-renderer.js';
import { Text } from '@earendil-works/pi-tui';

// Helper to create mock styled strings
function styled(text: string) {
  const obj: any = { original: text, bold: () => obj };
  obj.toString = () => text;
  return obj;
}

const mockTheme = {
  fg: (color: string, text: string) => styled(text),
  dim: (text: string) => styled(text),
  success: (text: string) => styled(text),
  warning: (text: string) => styled(text),
};

describe('git status-renderer', () => {

  it('should render error state', () => {
    const result = renderResult(
      { isError: true, details: { error: 'fatal: not a git repo' } },
      {},
      mockTheme
    );

    const text = result.toString();
    expect(text).toContain('fatal: not a git repo');
  });

  it('should render clean repository', () => {
    const result = renderResult(
      { isError: false, details: { branch: 'main', staged: [], unstaged: [], untracked: [] } },
      {},
      mockTheme
    );

    const text = result.toString();
    expect(text).toContain('📋 Git Status');
    expect(text).toContain('Branch: main');
    expect(text).toContain('Staged: 0');
    expect(text).toContain('Unstaged: 0');
    expect(text).toContain('Untracked: 0');
  });

  it('should render staged files', () => {
    const result = renderResult(
      { isError: false, details: { branch: 'feature', staged: ['src/file1.ts', 'src/file2.ts'], unstaged: [], untracked: [] } },
      {},
      mockTheme
    );

    const text = result.toString();
    expect(text).toContain('Staged: 2');
    expect(text).toContain('✓ src/file1.ts');
    expect(text).toContain('✓ src/file2.ts');
  });

  it('should render unstaged files', () => {
    const result = renderResult(
      { isError: false, details: { branch: 'main', staged: [], unstaged: ['modified.ts', 'deleted.ts'], untracked: [] } },
      {},
      mockTheme
    );

    const text = result.toString();
    expect(text).toContain('Unstaged: 2');
    expect(text).toContain('✗ modified.ts');
    expect(text).toContain('✗ deleted.ts');
  });

  it('should render untracked files', () => {
    const result = renderResult(
      { isError: false, details: { branch: 'main', staged: [], unstaged: [], untracked: ['newfile.ts', 'another.py'] } },
      {},
      mockTheme
    );

    const text = result.toString();
    expect(text).toContain('Untracked: 2');
    expect(text).toContain('? newfile.ts');
    expect(text).toContain('? another.py');
  });

  it('should render all sections combined', () => {
    const result = renderResult(
      { 
        isError: false, 
        details: { 
          branch: 'develop', 
          staged: ['file1.ts'], 
          unstaged: ['file2.ts'], 
          untracked: ['file3.ts'] 
        } 
      },
      {},
      mockTheme
    );

    const text = result.toString();
    expect(text).toContain('Staged: 1');
    expect(text).toContain('Unstaged: 1');
    expect(text).toContain('Untracked: 1');
    expect(text).toContain('✓ file1.ts');
    expect(text).toContain('✗ file2.ts');
    expect(text).toContain('? file3.ts');
  });

  it('should handle missing branch gracefully', () => {
    const result = renderResult(
      { isError: false, details: { staged: [], unstaged: [], untracked: [] } },
      {},
      mockTheme
    );

    const text = result.toString();
    expect(text).toContain('Branch: unknown');
  });

  it('should handle empty result details', () => {
    const result = renderResult(
      { isError: false, details: {} },
      {},
      mockTheme
    );

    const text = result.toString();
    expect(text).toContain('Branch: unknown');
    expect(text).toContain('Staged: 0');
  });

});

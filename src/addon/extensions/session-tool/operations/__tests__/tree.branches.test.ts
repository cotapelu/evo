import { describe, it, expect } from 'vitest';
import { operationTree } from '../tree.js';
import type { MultiSessionManager } from '../../manager.js';

function createManagerWithRoot(root?: { id: string; name?: string }): MultiSessionManager {
  const base = {
    getTree: () => ({ roots: [] }),
    getRoot: () => root
  };
  return base as unknown as MultiSessionManager;
}

describe('operationTree branch coverage', () => {
  it('includes root info when root exists', () => {
    const mgr = createManagerWithRoot({ id: 'root123', name: 'Main Root' });
    const result = operationTree(mgr);
    const text = result.content[0].text;
    expect(text).toContain('Root: root123 "Main Root"');
    expect(result.details.rootId).toBe('root123');
  });

  it('handles root with no name (unnamed)', () => {
    const mgr = createManagerWithRoot({ id: 'root456' }); // name undefined
    const result = operationTree(mgr);
    const text = result.content[0].text;
    expect(text).toContain('Root: root456 "(unnamed)"');
    expect(result.details.rootId).toBe('root456');
  });

  it('handles absent root (null) — falsy branch', () => {
    const mgr = createManagerWithRoot(undefined);
    const result = operationTree(mgr);
    const text = result.content[0].text;
    expect(text).not.toContain('Root:');
    expect(text).toContain('🌳 Session Tree:');
    expect(result.details.rootId).toBeUndefined();
  });

  it('handles explicit null root — falsy branch', () => {
    const mgr = createManagerWithRoot(null as unknown as { id: string } | undefined);
    const result = operationTree(mgr);
    const text = result.content[0].text;
    expect(text).not.toContain('Root:');
    expect(result.details.rootId).toBeUndefined();
  });
});

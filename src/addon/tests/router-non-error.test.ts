import { describe, it, expect, vi } from 'vitest';
import type { MultiSessionManager } from '../extensions/session-tool/manager.js';

// Mock the operation module to throw non-Error
vi.mock('../extensions/session-tool/operations/switch.js', () => ({
  operationSwitch: async () => { throw 'non-error string'; },
}));

describe('Session Router Error Handling', () => {
  it('should catch non-Error thrown by operation', async () => {
    const { createSessionToolRouter } = await import('../extensions/session-tool/router.js');
    const router = createSessionToolRouter({
      initialize: () => ({
        // Minimal mock manager; not used because operationSwitch is mocked to throw immediately
        getActive: () => null,
        getRoot: () => null,
        getChildren: () => [],
        getDiagnostics: () => ({ totalSessions: 0, activeSessionId: null, rootSessionId: null, childCount: 0, disposedCount: 0, historySize: 0 }),
      } as unknown as MultiSessionManager),
    });

    const result = await router.execute('test', { operation: 'switch' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('non-error string');
  });
});

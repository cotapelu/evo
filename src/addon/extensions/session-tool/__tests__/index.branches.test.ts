import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock runtime-context to control getCurrentRuntime
vi.mock('../../../runtime-context.js', () => ({
  getCurrentRuntime: vi.fn()
}));

// Mock the MultiSessionManager class as a constructor-compatible mock
vi.mock('../manager.js', () => ({
  MultiSessionManager: vi.fn().mockImplementation(function(this: any) {
    // regular function can be used with new
    return {};
  })
}));

import { getCurrentRuntime } from '../../../runtime-context.js';
import { MultiSessionManager } from '../manager.js';
import { initializeSessionTool, resetSessionTool } from '../index.js';

describe('Session Tool index branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSessionTool();
    // Ensure getCurrentRuntime mock returns a default runtime
    (getCurrentRuntime as any).mockReturnValue({} as any);
    (MultiSessionManager as any).mockClear();
  });

  it('initializeSessionTool: second call returns early (manager already set)', () => {
    initializeSessionTool();
    // First call should set manager
    expect(getCurrentRuntime).toHaveBeenCalledTimes(1);
    // Second call should not reinitialize
    initializeSessionTool();
    expect(getCurrentRuntime).toHaveBeenCalledTimes(1);
    // MultiSessionManager should have been constructed only once
    expect(MultiSessionManager).toHaveBeenCalledTimes(1);
  });
});

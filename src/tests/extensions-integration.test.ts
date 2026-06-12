#!/usr/bin/env node

import { describe, it, expect, vi, beforeEach } from 'vitest';
import extensionsIndex from '../extensions/index.js';
import { createMockExtensionAPI } from './utils/mock-factory.js';

describe('extensions/index', () => {
  let mockApi: any;
  beforeEach(() => {
    mockApi = createMockExtensionAPI({
      registerProvider: vi.fn(),
      registerMessageRenderer: vi.fn(),
      registerFlag: vi.fn()
    });
  });

  it('should register all extensions without throwing', async () => {
    await extensionsIndex(mockApi);
    expect(mockApi.on).toHaveBeenCalledWith('session_start', expect.any(Function));
    expect(mockApi.registerCommand).toHaveBeenCalledWith('gnpi', expect.any(Object));
    expect(mockApi.registerTool).toHaveBeenCalledWith(expect.objectContaining({ name: 'subtool_loader' }));
  });
});

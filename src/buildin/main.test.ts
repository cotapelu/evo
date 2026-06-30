/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';

// Mock dependencies
vi.mock('./index.js', () => {
  const mockServicesOptions = {};
  const mockCreateServicesOptions = vi.fn(() => mockServicesOptions);
  const mockRegisterAllBuiltinTools = vi.fn(() => []);
  const mockRegisterAllBuildinAndCustomTools = vi.fn(() => []);
  return {
    createServicesOptions: mockCreateServicesOptions,
    registerAllBuiltinTools: mockRegisterAllBuiltinTools,
    registerAllBuildinAndCustomTools: mockRegisterAllBuildinAndCustomTools,
  };
});

vi.mock('./deps.js', () => ({
  SettingsManager: { create: vi.fn(() => ({})) },
  loadSkills: vi.fn(() => ({ skills: [], diagnostics: [] })),
  createAgentSessionServices: vi.fn(() => Promise.resolve({})),
  createAgentSessionRuntime: vi.fn(() => Promise.resolve({})),
  createAgentSessionFromServices: vi.fn(() => Promise.resolve({})),
  InteractiveMode: class { run = vi.fn().mockResolvedValue(undefined); },
  SessionManager: { create: vi.fn(() => ({})) },
}));

vi.mock('node:os', () => ({
  default: { homedir: vi.fn(() => '/home/test') }
}));

// Mock fs/promises to bypass validation
vi.mock('node:fs/promises', () => ({
  access: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

import { main, handleMainError } from './main.js';

describe('main', () => {
  const cwd = '/test/cwd';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', 'cli.js']);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call createServicesOptions with correct cwd and agentDir when PI_CONFIG_DIR is set', async () => {
    process.env.PI_CONFIG_DIR = '/test/agent';
    await main();
    const { createServicesOptions } = await import('./index.js');
    expect(createServicesOptions).toHaveBeenCalledWith('/test/cwd', '/test/agent', expect.any(Object));
  });

  it('should default agentDir to homedir when PI_CONFIG_DIR is not set', async () => {
    delete process.env.PI_CONFIG_DIR;
    const osModule = await import('node:os');
    const fakeHome = '/home/fakeuser';
    vi.mocked(osModule.default).homedir.mockReturnValue(fakeHome);
    await main();
    const { createServicesOptions } = await import('./index.js');
    expect(createServicesOptions).toHaveBeenCalledWith('/test/cwd', `${fakeHome}/.pi/agent`, expect.any(Object));
  });

  it('should create agent session services', async () => {
    process.env.PI_CONFIG_DIR = '/test/agent';
    await main();
    const { createAgentSessionServices } = await import('./deps.js');
    expect(createAgentSessionServices).toHaveBeenCalled();
  });

  it('should create session manager', async () => {
    process.env.PI_CONFIG_DIR = '/test/agent';
    await main();
    const { SessionManager } = await import('./deps.js');
    expect(SessionManager.create).toHaveBeenCalledWith('/test/cwd');
  });

  it('should create runtime', async () => {
    process.env.PI_CONFIG_DIR = '/test/agent';
    await main();
    const { createAgentSessionRuntime } = await import('./deps.js');
    expect(createAgentSessionRuntime).toHaveBeenCalled();
  });

  it('createRuntimeFactory should return result with services and diagnostics', async () => {
    process.env.PI_CONFIG_DIR = '/test/agent';
    await main();
    const { createAgentSessionRuntime } = await import('./deps.js');
    const calls = createAgentSessionRuntime.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const [factory, options] = calls[0];
    const result = await factory(options);
    expect(result).toHaveProperty('services');
    expect(result).toHaveProperty('diagnostics');
  });

  it('should throw error if initialization fails', async () => {
    process.env.PI_CONFIG_DIR = '/test/agent';
    const { createServicesOptions } = await import('./index.js');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (createServicesOptions as any).mockImplementation(() => {
      throw new Error('Init failed');
    });
    await expect(main()).rejects.toThrow('Init failed');
  });

  it('should reject when createAgentSessionServices fails', async () => {
    process.env.PI_CONFIG_DIR = '/test/agent';
    const { createServicesOptions } = await import('./index.js');
    const { createAgentSessionServices } = await import('./deps.js');
    createServicesOptions.mockReturnValue({});
    createAgentSessionServices.mockRejectedValue(new Error('services failed'));
    await expect(main()).rejects.toThrow('services failed');
  });

  it('should reject when createAgentSessionRuntime fails', async () => {
    process.env.PI_CONFIG_DIR = '/test/agent';
    const { createServicesOptions } = await import('./index.js');
    const { createAgentSessionServices, createAgentSessionRuntime } = await import('./deps.js');
    createServicesOptions.mockReturnValue({});
    createAgentSessionServices.mockResolvedValue({});
    createAgentSessionRuntime.mockRejectedValue(new Error('runtime failed'));
    await expect(main()).rejects.toThrow('runtime failed');
  });
});

describe('handleMainError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log error and exit with code 1', () => {
    const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit called'); });

    expect(() => handleMainError(new Error('test error'))).toThrow('exit called');
    expect(mockConsoleError).toHaveBeenCalledWith('Failed to start procman:', new Error('test error'));
    expect(mockExit).toHaveBeenCalledWith(1);

    mockConsoleError.mockRestore();
    mockExit.mockRestore();
  });

  it('should handle non-Error values', () => {
    const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit called'); });

    expect(() => handleMainError('string error')).toThrow('exit called');
    expect(mockConsoleError).toHaveBeenCalledWith('Failed to start procman:', 'string error');

    mockConsoleError.mockRestore();
    mockExit.mockRestore();
  });
});

describe('Metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.spyOn(process, 'cwd').mockReturnValue('/test/cwd');
    vi.spyOn(process, 'argv', 'get').mockReturnValue(['node', 'cli.js']);
    vi.spyOn(fs, 'access').mockResolvedValue(undefined);
  });

  it('should increment SESSION_START when main runs', async () => {
    const { metrics, METRIC_NAMES } = await import('./utils/metrics.js');
    const before = metrics.getCounter(METRIC_NAMES.SESSION_START);
    await main();
    expect(metrics.getCounter(METRIC_NAMES.SESSION_START)).toBe(before + 1);
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @deps first
const mockSettingsManagerImpl = {
  getSkillPaths: vi.fn(() => ['/skills/default']),
  getExtensionPaths: vi.fn(() => ['/extensions/default']),
  getPromptTemplatePaths: vi.fn(() => ['/prompts/default']),
  getThemePaths: vi.fn(() => ['/themes/default']),
  applyOverrides: vi.fn(),
};

vi.mock('./deps.js', () => {
  return {
    SettingsManager: {
      create: vi.fn(() => mockSettingsManagerImpl),
    },
    loadSkills: vi.fn(() => ({
      skills: [],
      diagnostics: [],
    })),
  };
});

// Mock extension imports (ES module default exports)
vi.mock('./extensions/prompt-hook-extension.js', () => ({
  default: vi.fn(() => ({ name: 'prompt-hook' })),
}));
vi.mock('./extensions/hooks/auto-compact-85.js', () => ({
  default: vi.fn(() => ({ name: 'auto-compact-85' })),
}));
vi.mock('./extensions/hooks/auto-continue.js', () => ({
  default: vi.fn(() => ({ name: 'auto-continue' })),
}));

// Import from deps after mock is established
import { SettingsManager, loadSkills } from './deps.js';
import {
  createSettingsManager,
  prepareSkillPaths,
  createResourceLoaderOptions,
  createServicesOptions,
} from './settings-manager.js';

describe('createSettingsManager', () => {
  const cwd = '/test/cwd';
  const agentDir = '/test/agent';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create SettingsManager with cwd and agentDir', () => {
    createSettingsManager(cwd, agentDir);
    expect(SettingsManager.create).toHaveBeenCalledWith(cwd, agentDir);
  });

  it('should apply overrides when provided', () => {
    const options = { settingsOverrides: { defaultThinkingLevel: 'high' } } as any;
    createSettingsManager(cwd, agentDir, options);
    expect(mockSettingsManagerImpl.applyOverrides).toHaveBeenCalledWith({ defaultThinkingLevel: 'high' });
  });
});

describe('prepareSkillPaths', () => {
  const cwd = '/test/cwd';
  const agentDir = '/test/agent';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log skill paths from settings', () => {
    prepareSkillPaths(mockSettingsManagerImpl, cwd, agentDir);
    expect(console.log).toHaveBeenCalledWith('Skill paths from settings:', ['/skills/default']);
  });

  it('should preload skills when preloadSkills is true', () => {
    const options = { preloadSkills: true } as any;
    prepareSkillPaths(mockSettingsManagerImpl, cwd, agentDir, options);
    expect(loadSkills).toHaveBeenCalledWith({
      cwd,
      agentDir,
      skillPaths: ['/skills/default'],
      includeDefaults: true,
    });
    expect(console.log).toHaveBeenCalledWith('Preloaded 0 skills');
  });

  it('should not preload skills when preloadSkills is false', () => {
    const options = { preloadSkills: false } as any;
    prepareSkillPaths(mockSettingsManagerImpl, cwd, agentDir, options);
    expect(loadSkills).not.toHaveBeenCalled();
  });

  it('should return skill paths', () => {
    const paths = prepareSkillPaths(mockSettingsManagerImpl, cwd, agentDir);
    expect(paths).toEqual(['/skills/default']);
  });

  it('should warn when skill loading produces diagnostics', () => {
    const options = { preloadSkills: true } as any;
    // Override mock to return non-empty diagnostics
    (loadSkills as any).mockReturnValue({
      skills: [],
      diagnostics: [{ type: 'warning', message: 'skill path does not exist', path: '/skills/default' }],
    });
    prepareSkillPaths(mockSettingsManagerImpl, cwd, agentDir, options);
    expect(console.warn).toHaveBeenCalledWith('Skill loading diagnostics:', expect.any(Array));
  });
});

describe('createResourceLoaderOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include settings paths as additional paths', () => {
    const mockManager = {
      getSkillPaths: vi.fn(() => ['/skills/custom']),
      getExtensionPaths: vi.fn(() => ['/ext/custom']),
      getPromptTemplatePaths: vi.fn(() => ['/prompts/custom']),
      getThemePaths: vi.fn(() => ['/themes/custom']),
    } as any;
    const overrides = {};
    const opts = createResourceLoaderOptions(mockManager, overrides);
    expect(opts.additionalSkillPaths).toEqual(['/skills/custom']);
    expect(opts.additionalExtensionPaths).toEqual(['/ext/custom']);
    expect(opts.additionalPromptTemplatePaths).toEqual(['/prompts/custom']);
    expect(opts.additionalThemePaths).toEqual(['/themes/custom']);
  });

  it('should include built-in extensionFactories when overrides has none', () => {
    const mockManager = {
      getSkillPaths: vi.fn(() => []),
      getExtensionPaths: vi.fn(() => []),
      getPromptTemplatePaths: vi.fn(() => []),
      getThemePaths: vi.fn(() => []),
    } as any;
    const opts = createResourceLoaderOptions(mockManager, {});
    expect(opts.extensionFactories).toHaveLength(3);
    opts.extensionFactories.forEach((f: any) => {
      expect(typeof f).toBe('function');
    });
  });

  it('should merge extensionFactories from overrides and built-in', () => {
    const mockManager = {
      getSkillPaths: vi.fn(() => []),
      getExtensionPaths: vi.fn(() => []),
      getPromptTemplatePaths: vi.fn(() => []),
      getThemePaths: vi.fn(() => []),
    } as any;
    const customFactory = vi.fn(() => ({ name: 'custom' }));
    const overrides = { extensionFactories: [customFactory] };
    const opts = createResourceLoaderOptions(mockManager, overrides);
    expect(opts.extensionFactories).toHaveLength(4);
    expect(opts.extensionFactories[0]).toBe(customFactory);
  });

  it('should preserve other override properties', () => {
    const mockManager = {
      getSkillPaths: vi.fn(() => []),
      getExtensionPaths: vi.fn(() => []),
      getPromptTemplatePaths: vi.fn(() => []),
      getThemePaths: vi.fn(() => []),
    } as any;
    const overrides = { someOption: true, another: 123 };
    const opts = createResourceLoaderOptions(mockManager, overrides);
    expect(opts.someOption).toBe(true);
    expect(opts.another).toBe(123);
  });

  it('should ignore non-array extensionFactories in overrides', () => {
    const mockManager = {
      getSkillPaths: vi.fn(() => []),
      getExtensionPaths: vi.fn(() => []),
      getPromptTemplatePaths: vi.fn(() => []),
      getThemePaths: vi.fn(() => []),
    } as any;
    const overrides = { extensionFactories: 'invalid' };
    const opts = createResourceLoaderOptions(mockManager, overrides);
    expect(opts.extensionFactories).toHaveLength(3);
  });
});

describe('createServicesOptions', () => {
  const cwd = '/test/cwd';
  const agentDir = '/test/agent';

  it('should return object with required properties', () => {
    const opts = createServicesOptions(cwd, agentDir);
    expect(opts.cwd).toBe(cwd);
    expect(opts.agentDir).toBe(agentDir);
    expect(opts.settingsManager).toBeDefined();
    expect(opts.resourceLoaderOptions).toBeDefined();
  });
});

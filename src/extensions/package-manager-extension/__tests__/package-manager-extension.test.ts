import { jest } from '@jest/globals';
import {
  createListPackagesTool,
  createInstallPackageTool,
  createRemovePackageTool,
  createUpdatePackagesTool,
  createCheckUpdatesTool,
} from '..';

function createMockContext(custom?: any) {
  return {
    cwd: process.cwd(),
    hasUI: false,
    ...custom,
  } as any;
}

describe('Package Manager Extension Tools', () => {
  let mockPm: any;

  beforeEach(() => {
    mockPm = {
      listConfiguredPackages: jest.fn(() => []),
      install: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      checkForAvailableUpdates: jest.fn().mockResolvedValue([]),
      addSourceToSettings: jest.fn(),
      removeSourceFromSettings: jest.fn(),
    };
  });

  describe('pkg.list', () => {
    let tool: any;
    beforeEach(() => {
      tool = createListPackagesTool();
    });

    test('tool metadata', () => {
      expect(tool.name).toBe('pkg.list');
      expect(tool.label).toBe('Pkg: List');
      expect(tool.description).toContain('List all configured packages');
    });

    test('execute returns empty message when no packages', async () => {
      mockPm.listConfiguredPackages.mockReturnValue([]);
      const ctx = createMockContext({ packageManager: mockPm });
      const result = await tool.execute('1', {}, undefined, undefined, ctx);
      expect(result.content[0].text).toContain('No configured packages');
      expect(result.details.count).toBe(0);
    });

    test('execute lists packages with scope filter', async () => {
      const packages = [
        { source: 'pkg-a', scope: 'user', installedPath: '/path/a', filtered: false },
        { source: 'pkg-b', scope: 'project', installedPath: '/path/b', filtered: false },
      ];
      mockPm.listConfiguredPackages.mockReturnValue(packages);
      const ctx = createMockContext({ packageManager: mockPm });
      const result = await tool.execute('1', { scope: 'user' }, undefined, undefined, ctx);
      expect(result.details.count).toBe(1);
      expect(result.content[0].text).toContain('pkg-a');
    });
  });

  describe('pkg.install', () => {
    let tool: any;
    beforeEach(() => {
      tool = createInstallPackageTool();
    });

    test('tool metadata', () => {
      expect(tool.name).toBe('pkg.install');
      expect(tool.description).toContain('Install a package');
    });

    test('execute calls pm.install and persists by default', async () => {
      const ctx = createMockContext({ packageManager: mockPm });
      const result = await tool.execute('1', { source: 'test-pkg' }, undefined, undefined, ctx);
      expect(mockPm.install).toHaveBeenCalledWith('test-pkg', { local: true });
      expect(mockPm.addSourceToSettings).toHaveBeenCalledWith('test-pkg', { local: true });
      expect(result.content[0].text).toContain('Installed');
    });

    test('execute respects persist=false', async () => {
      const ctx = createMockContext({ packageManager: mockPm });
      const result = await tool.execute('1', { source: 'pkg', persist: false }, undefined, undefined, ctx);
      expect(mockPm.install).toHaveBeenCalledWith('pkg', { local: false });
      expect(mockPm.addSourceToSettings).not.toHaveBeenCalled();
      expect(result.content[0].text).toContain('Installed');
    });

    test('execute returns error on failure', async () => {
      mockPm.install.mockRejectedValue(new Error('network error'));
      const ctx = createMockContext({ packageManager: mockPm });
      const result = await tool.execute('1', { source: 'pkg' }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Install failed');
    });
  });

  describe('pkg.remove', () => {
    let tool: any;
    beforeEach(() => {
      tool = createRemovePackageTool();
    });

    test('tool metadata', () => {
      expect(tool.name).toBe('pkg.remove');
    });

    test('execute calls pm.remove and unpersists by default', async () => {
      const ctx = createMockContext({ packageManager: mockPm });
      const result = await tool.execute('1', { source: 'pkg' }, undefined, undefined, ctx);
      expect(mockPm.remove).toHaveBeenCalledWith('pkg');
      expect(mockPm.removeSourceFromSettings).toHaveBeenCalledWith('pkg');
      expect(result.content[0].text).toContain('Removed');
    });

    test('execute respects unpersist=false', async () => {
      const ctx = createMockContext({ packageManager: mockPm });
      const result = await tool.execute('1', { source: 'pkg', unpersist: false }, undefined, undefined, ctx);
      expect(mockPm.removeSourceFromSettings).not.toHaveBeenCalled();
      expect(result.content[0].text).toContain('Removed');
    });

    test('execute returns error on failure', async () => {
      mockPm.remove.mockRejectedValue(new Error('not installed'));
      const ctx = createMockContext({ packageManager: mockPm });
      const result = await tool.execute('1', { source: 'pkg' }, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Remove failed');
    });
  });

  describe('pkg.update', () => {
    let tool: any;
    beforeEach(() => {
      tool = createUpdatePackagesTool();
    });

    test('tool metadata', () => {
      expect(tool.name).toBe('pkg.update');
    });

    test('execute updates specific source', async () => {
      mockPm.update.mockResolvedValue(undefined);
      const ctx = createMockContext({ packageManager: mockPm });
      const result = await tool.execute('1', { source: 'pkg-a' }, undefined, undefined, ctx);
      expect(mockPm.update).toHaveBeenCalledWith('pkg-a');
      expect(result.content[0].text).toContain('Updated');
    });

    test('execute updates all configured packages when no source', async () => {
      mockPm.update.mockResolvedValue(undefined);
      mockPm.listConfiguredPackages.mockReturnValue([{ source: 'a' }, { source: 'b' }]);
      const ctx = createMockContext({ packageManager: mockPm });
      const result = await tool.execute('1', {}, undefined, undefined, ctx);
      expect(mockPm.update).toHaveBeenCalledWith(); // called without arg
      expect(result.details.count).toBe(2);
      expect(result.content[0].text).toContain('Updated 2');
    });

    test('execute returns error on failure', async () => {
      mockPm.update.mockRejectedValue(new Error('network down'));
      const ctx = createMockContext({ packageManager: mockPm });
      const result = await tool.execute('1', {}, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Update failed');
    });
  });

  describe('pkg.updates', () => {
    let tool: any;
    beforeEach(() => {
      tool = createCheckUpdatesTool();
    });

    test('tool metadata', () => {
      expect(tool.name).toBe('pkg.updates');
    });

    test('execute returns up-to-date message when no updates', async () => {
      mockPm.checkForAvailableUpdates.mockResolvedValue([]);
      const ctx = createMockContext({ packageManager: mockPm });
      const result = await tool.execute('1', {}, undefined, undefined, ctx);
      expect(result.content[0].text).toContain('up-to-date');
    });

    test('execute lists available updates', async () => {
      const updates = [
        { displayName: 'PkgA', source: 'a', type: 'npm' },
        { displayName: 'PkgB', source: 'b', type: 'git' },
      ];
      mockPm.checkForAvailableUpdates.mockResolvedValue(updates);
      const ctx = createMockContext({ packageManager: mockPm });
      const result = await tool.execute('1', {}, undefined, undefined, ctx);
      expect(result.details.count).toBe(2);
      expect(result.content[0].text).toContain('Available Updates');
    });

    test('execute returns error on failure', async () => {
      mockPm.checkForAvailableUpdates.mockRejectedValue(new Error('npm fail'));
      const ctx = createMockContext({ packageManager: mockPm });
      const result = await tool.execute('1', {}, undefined, undefined, ctx);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error');
    });
  });
});

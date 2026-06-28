#!/usr/bin/env node
/**
 * Branch coverage for master-tool command-registry
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

// Mock dependencies
vi.mock('../command-executor', () => ({
  CommandExecutor: vi.fn().mockImplementation(() => ({
    register: vi.fn(),
    listCommands: vi.fn(() => []),
    execute: vi.fn().mockResolvedValue({ output: 'ok', truncated: false })
  }))
}));
vi.mock('../types/command-module', () => ({
  DEFAULT_MASTER_TOOL_OPTIONS: {
    commandsDir: 'commands',
    enableCache: true,
    cacheSize: 100,
    audit: false,
    security: false
  }
}));

const { CommandRegistry } = await import('../command-registry.ts');

describe('command-registry branch coverage', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(join(os.tmpdir(), 'cmdreg-branch-'));
    process.chdir(tempDir);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    vi.clearAllMocks();
  });

  const writeFile = async (name: string, content: string) => {
    const filePath = join(tempDir, name);
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  };

  it('handles non-existent commands directory gracefully', async () => {
    // commands directory does not exist
    const registry = new CommandRegistry({ commandsDir: join(tempDir, 'missing') });
    await expect(registry.initialize()).resolves.not.toThrow();
    // Should complete without loading any commands
    const executor = (registry as any).executor;
    expect(executor.listCommands()).toHaveLength(0);
  });

  it('handles readdir error', async () => {
    const readdirSpy = vi.spyOn(fs, 'readdir').mockRejectedValue(new Error('permission denied'));
    const registry = new CommandRegistry({ commandsDir: tempDir });
    await expect(registry.initialize()).resolves.not.toThrow();
    // scanCommands catches error and logs warning; initialization still succeeds
    expect(readdirSpy).toHaveBeenCalled();
    readdirMockRestore();
  });

  it('handles category directory read error', async () => {
    // Create a category directory but make readdir inside it fail
    const categoryDir = join(tempDir, 'git');
    await fs.mkdir(categoryDir);
    const readdirSpy = vi.spyOn(fs, 'readdir').mockResolvedValueOnce([]) // for root
      .mockRejectedValueOnce(new Error('category read error'));
    const registry = new CommandRegistry({ commandsDir: tempDir });
    await expect(registry.initialize()).resolves.not.toThrow();
  });

  it('handles file with unsupported extension', async () => {
    await writeFile('readme.txt', 'not a command');
    const registry = new CommandRegistry({ commandsDir: tempDir });
    await registry.initialize();
    // Should not load the .txt file
    const executor = (registry as any).executor;
    expect(executor.listCommands()).toHaveLength(0);
  });

  it('loads direct .ts command file', async () => {
    await writeFile('test.ts', `export default { execute: async () => ({ output: 'ok' }) }`);
    const registry = new CommandRegistry({ commandsDir: tempDir });
    await registry.initialize();
    const executor = (registry as any).executor;
    expect(executor.listCommands()).toContain('test');
  });

  it('handles command file without default export', async () => {
    await writeFile('bad.ts', `export const foo = 1;`);
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = new CommandRegistry({ commandsDir: tempDir });
    await registry.initialize();
    // Should warn about missing default export
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  it('handles command file with invalid export (null)', async () => {
    await writeFile('bad2.ts', `export default null;`);
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = new CommandRegistry({ commandsDir: tempDir });
    await registry.initialize();
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  it('handles custom command with minimal metadata', async () => {
    const customCommands = new Map([
      ['custom-cmd', {
        async execute(params, ctx) { return { output: 'custom' }; },
        getMetadata: () => ({ name: 'Custom Cmd', description: 'A custom command' })
      }]
    ]);
    const registry = new CommandRegistry({}, customCommands);
    await registry.initialize();
    const executor = (registry as any).executor;
    expect(executor.listCommands()).toContain('custom-cmd');
  });

  it('handles command not found during execute', async () => {
    const registry = new CommandRegistry();
    await registry.initialize();
    await expect(registry.execute('unknown', {}, {}, null)).rejects.toThrow(/not found/i);
  });

  it('handles executor throwing during execute', async () => {
    const mockExecutor = {
      register: vi.fn(),
      listCommands: vi.fn(() => ['test']),
      execute: vi.fn().mockRejectedValue(new Error('exec failed'))
    };
    // Manually inject mock executor into registry instance
    const registry = new CommandRegistry();
    (registry as any).executor = mockExecutor;
    await registry.initialize(); // no-op for this test
    await expect(registry.execute('test', {}, {}, null)).rejects.toThrow('exec failed');
  });

  it('handles initialize called multiple times (idempotent)', async () => {
    await writeFile('cmd.ts', `export default { execute: async () => ({ output: 'ok' }) }`);
    const registry = new CommandRegistry({ commandsDir: tempDir });
    await registry.initialize();
    const firstList = (registry as any).executor.listCommands();
    // Second initialize should be no-op
    await registry.initialize();
    const secondList = (registry as any).executor.listCommands();
    expect(firstList).toEqual(secondList);
  });

  it('handles custom command without getMetadata', async () => {
    const customCommands = new Map([
      ['bare', {
        async execute(params, ctx) { return { output: 'bare' }; }
        // no getMetadata
      }]
    ]);
    const registry = new CommandRegistry({}, customCommands);
    await registry.initialize();
    const executor = (registry as any).executor;
    expect(executor.listCommands()).toContain('bare');
  });

  it('handles command file that throws during require', async () => {
    await writeFile('throw.ts', `throw new Error('module error');`);
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = new CommandRegistry({ commandsDir: tempDir });
    await registry.initialize();
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('throw.ts'));
    consoleWarn.mockRestore();
  });

  it('handles command loader returning non-object', async () => {
    await writeFile('number.ts', `export default 42;`);
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = new CommandRegistry({ commandsDir: tempDir });
    await registry.initialize();
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  it('handles command file with execute not a function', async () => {
    await writeFile('noexec.ts', `export default { notExecute: () => {} };`);
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = new CommandRegistry({ commandsDir: tempDir });
    await registry.initialize();
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  it('handles empty commands directory', async () => {
    await fs.mkdir(join(tempDir, 'empty'));
    const registry = new CommandRegistry({ commandsDir: join(tempDir, 'empty') });
    await registry.initialize();
    const executor = (registry as any).executor;
    expect(executor.listCommands()).toHaveLength(0);
  });

  it('handles nested category with multiple command files', async () => {
    const gitDir = join(tempDir, 'git');
    await fs.mkdir(gitDir);
    await writeFile('git/status.ts', `export default { execute: async () => ({ output: 'status' }) }`);
    await writeFile('git/commit.ts', `export default { execute: async () => ({ output: 'commit' }) }`);
    const registry = new CommandRegistry({ commandsDir: tempDir });
    await registry.initialize();
    const executor = (registry as any).executor;
    expect(executor.listCommands()).toContain('git.status');
    expect(executor.listCommands()).toContain('git.commit');
  });

  it('handles duplicate command names across categories', async () => {
    const gitDir = join(tempDir, 'git');
    const devDir = join(tempDir, 'dev');
    await fs.mkdir(gitDir);
    await fs.mkdir(devDir);
    await writeFile('git/status.ts', `export default { execute: async () => ({ output: 'git-status' }) }`);
    await writeFile('dev/status.ts', `export default { execute: async () => ({ output: 'dev-status' }) }`);
    const registry = new CommandRegistry({ commandsDir: tempDir });
    await registry.initialize();
    const executor = (registry as any).executor;
    // Both should be registered with fully qualified names
    expect(executor.listCommands()).toContain('git.status');
    expect(executor.listCommands()).toContain('dev.status');
  });
});

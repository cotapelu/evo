#!/usr/bin/env node
/**
 * Watch Tool
 *
 * Watches project files for changes and automatically runs configured commands.
 * Useful for continuous code quality feedback during development.
 *
 * Parameters:
 *   commands?: string[] - array of command strings to run (default: ['code-health', 'test --coverage'])
 *   debounceMs?: number - debounce delay in ms (default: 500)
 */

import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { watch } from 'node:fs';
import { Mutex } from '../utils/mutex.js';

function createWatchTool(api: ExtensionAPI): ToolDefinition<any, any> {
  const tool: ToolDefinition<any, any> = {
    name: 'watch',
    label: 'Watch',
    description: 'Watch files and auto-run commands on change. Runs code-health and test by default.',
    parameters: {},
    async execute(toolCallId, params, signal, onUpdate: any, ctx) {
      const p = typeof params === 'string' ? JSON.parse(params) : (params || {});
      const commands: string[] = Array.isArray(p.commands) ? p.commands : ['code-health', 'test --coverage'];
      const debounceMs = typeof p.debounceMs === 'number' ? p.debounceMs : 500;

      // Directories and files to watch
      const watchDirs = ['src', 'tsconfig.json', 'package.json', 'evo.ts', 'src/evo.ts', 'src/extensions'];
      const watchCwd = ctx.cwd || process.cwd();
      const watchPaths = watchDirs.map(p => join(watchCwd, p));

      // Keep track of watchers for cleanup
      const watchers: any[] = [];
      let triggered = false;
      let timeout: NodeJS.Timeout | null = null;
      let running = false;
      const mutex = new Mutex();

      let logLines: string[] = [`🔍 Watching ${watchPaths.length} paths (${watchPaths.join(', ')})`];
      let lastRun: Date | null = null;

      function updateDisplay() {
        const status = running ? '⏳ Running...' : '✅ Idle';
        const last = lastRun ? `Last: ${lastRun.toLocaleTimeString()}` : '';
        const summary = [...logLines, status, last].join('\n');
        onUpdate?.({ partial: true, content: [{ type: 'text', text: summary }] });
      }

      // Initial update
      updateDisplay();

      async function runCommands() {
        const release = await mutex.lock();
        try {
          running = true;
          updateDisplay();
          logLines.push(`\n▶️  Running ${commands.length} command(s)...`);
          for (const cmd of commands) {
            logLines.push(`$ ${cmd}`);
            try {
              const result = await api.exec('npm', ['run', ...cmd.split(/\s+/).filter(Boolean)], { cwd: ctx.cwd });
              if (result.code !== 0) {
                logLines.push(`❌ Exit ${result.code}`);
              } else {
                logLines.push(`✅ Success`);
              }
              if (result.stdout) logLines.push(result.stdout.trim());
              if (result.stderr) logLines.push(result.stderr.trim());
            } catch (e: any) {
              logLines.push(`❌ Error: ${e.message}`);
            }
          }
          lastRun = new Date();
          logLines.push(`🔄 Next run on file change...`);
        } finally {
          running = false;
          release();
        }
        updateDisplay();
      }

      function scheduleRun() {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(async () => {
          if (!triggered) return;
          triggered = false;
          await runCommands();
        }, debounceMs);
      }

      function handleChange(path: string) {
        triggered = true;
        scheduleRun();
      }

      // Expose test hook for triggering changes in tests
      const testHook = { trigger: handleChange };
      // @ts-ignore – internal test hook
      tool._testHook = testHook;

      async function setupWatchers(paths: string[]) {
        for (const p of paths) {
          try {
            const statResult = await stat(p);
            if (statResult.isDirectory()) {
              // Recursively add files in directory
              await walkAndWatch(p);
            } else {
              const w = watch(p, {}, (eventType, filename) => {
                if (filename) handleChange(join(p, filename));
              });
              watchers.push(w);
            }
          } catch (e) {
            // ignore paths that don't exist
          }
        }
      }

      async function walkAndWatch(dir: string) {
        try {
          const entries = await readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            const full = join(dir, entry.name);
            if (entry.isDirectory()) {
              // Skip node_modules, .git, dist, coverage
              if (['node_modules', '.git', 'dist', 'coverage'].includes(entry.name)) continue;
              await walkAndWatch(full);
            } else if (entry.isFile()) {
              try {
                const w = watch(full, {}, (eventType) => {
                  handleChange(full);
                });
                watchers.push(w);
              } catch (e) {
                // ignore unwatchable files
              }
            }
          }
        } catch (e) {
          // ignore unreadable dirs
        }
      }

      try {
        await setupWatchers(watchPaths);

        logLines.push('Watch started (press Ctrl+C to stop)');
        updateDisplay();

        // Wait for abort signal
        if (signal) {
          signal.addEventListener('abort', () => {
            logLines.push('🛑 Stopping...');
            for (const w of watchers) w.close();
            if (timeout) clearTimeout(timeout);
            updateDisplay();
          });
        }
      } finally {
        // Clear test hook when execution ends
        // @ts-ignore
        if (tool._testHook === testHook) {
          // @ts-ignore
          delete tool._testHook;
        }
      }

      return {
        content: [{ type: 'text', text: 'Watch tool started' }],
        details: { commands, debounceMs, watchPaths, status: 'running' },
        isError: false,
      };
    },

    renderCall(args: any, theme: any) {
      const th = theme;
      const text = th.fg('toolTitle', th.bold('watch')) + th.fg('muted', ` watching ${args.commands?.length || 0} commands`);
      return new Text(text, 0, 0);
    },

    renderResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: any) {
      const th = theme;
      if (options.isPartial) return new Text(th.fg('warning', 'Initializing watch...'), 0, 0);
      const details = result.details || {};
      if (details.status === 'stopped') return new Text(th.fg('dim', 'Watch stopped'), 0, 0);
      const active = details.watchPaths?.length || 0;
      return new Text(th.fg('success', `👀 Watching ${active} paths`), 0, 0);
    },
  };

  return tool;
}

export function registerWatchTool(api: ExtensionAPI): void {
  api.registerTool(createWatchTool(api));
}

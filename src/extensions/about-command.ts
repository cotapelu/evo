#!/usr/bin/env node
/**
 * About Command
 *
 * Global slash command `/about` displays basic system information.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { VERSION as PI_VERSION } from '@earendil-works/pi-coding-agent';

export default function aboutCommand(api: ExtensionAPI) {
  api.registerCommand('about', {
    description: 'Show system information (version, SDK)',
    handler: async (_args: string, ctx: any) => {
      try {
        const pkgPath = join(ctx.cwd, 'package.json');
        const raw = await readFile(pkgPath, 'utf-8');
        const pkg = JSON.parse(raw);
        const name = pkg.name || 'evo';
        const version = pkg.version || '0.0.1';
        const msg = `🖥️  ${name} v${version}\n📦 Pi Coding Agent SDK: v${PI_VERSION}\n📊 Use 'metrics' for evolution stats.`;
        ctx.ui.notify?.(msg, { type: 'info' });
      } catch (e) {
        const fallback = 'evo v0.0.1 (could not read package.json)';
        ctx.ui.notify?.(fallback, { type: 'error' });
      }
    },
  });
}
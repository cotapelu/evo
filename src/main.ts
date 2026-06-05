#!/usr/bin/env node

/**
 * Evo Main - Sử dụng main() từ pi-coding-agent
 *
 * Tự động load extensions từ src/extensions qua extensionFactories
 */

import { main as piMain } from '@earendil-works/pi-coding-agent';
import { getExtensionFactories } from './extensionLoader.js';
import { execSync } from 'child_process';

export async function main() {
  const args = process.argv.slice(2);

  // Custom update command
  if (args[0] === 'update') {
    console.log('\x1b[36m%s[0m', 'Running evo update...');

    try {
      // Update pi-coding-agent and all dependencies to latest
      console.log('Updating dependencies...');
      execSync('npm install', { stdio: 'inherit' });

      // Rebuild evo
      console.log('\nRebuilding evo...');
      execSync('npm run build', { stdio: 'inherit' });

      console.log('\x1b[32m%s[0m', '✓ Update complete!');
      process.exit(0);
    } catch (error) {
      console.error('\x1b[31m%s[0m', '✗ Update failed:', error);
      process.exit(1);
    }
  }

  try {
    await piMain(args, {
      extensionFactories: getExtensionFactories(),
    });
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// main(); // Không gọi trực tiếp, để evo.ts gọi

#!/usr/bin/env node

/**
 * Evo Main - Sử dụng main() từ pi-coding-agent
 *
 * Tự động load extensions từ src/extensions qua extensionFactories
 */

import { main as piMain } from '@earendil-works/pi-coding-agent';
import { getExtensionFactories } from './extensions/index.js';

export async function main() {
  const args = process.argv.slice(2);

  try {
    await piMain(args, {
      extensionFactories: getExtensionFactories(),
    });
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Auto-run khi execute trực tiếp (không khi import)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

#!/usr/bin/env node

/**
 * Evolution CLI
 *
 * Usage:
 *   npm run evolve          # Analyze and apply improvements
 *   npm run evolve:dry      # Dry run - show what would change
 *   npm run evolve:test     # Run evolution tests only
 */

import { evolve } from './evolver.js';

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry') || argv.includes('-d');

  try {
    const exitCode = await evolve({ dryRun });
    process.exit(exitCode);
  } catch (err) {
    console.error('Evolution failed:', err);
    process.exit(1);
  }
}

main();

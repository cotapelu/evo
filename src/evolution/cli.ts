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
import { join } from 'path';

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry') || argv.includes('-d');
  // Default target is the source directory
  const targetArg = argv.find(arg => !arg.startsWith('-'));
  const target = targetArg || join(process.cwd(), 'src');

  try {
    const exitCode = await evolve({ dryRun, target });
    process.exit(exitCode);
  } catch (err) {
    console.error('Evolution failed:', err);
    process.exit(1);
  }
}

main();

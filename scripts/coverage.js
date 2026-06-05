#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

// Run tests via c8
const result = spawnSync('npx', [
  'c8',
  '--reporter=text',
  '--reporter=lcov',
  '--cwd', process.cwd(),
  '--include', 'src/**/*.ts',
  'node',
  '--experimental-vm-modules',
  'node_modules/jest/bin/jest.js'
], { stdio: 'inherit' });

process.exit(result.status);
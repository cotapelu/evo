#!/bin/bash
# Auto-generated build script for EvoAgent
set -e

echo "🔨 Building EvoAgent..."

# Compile TypeScript
npx tsc --noEmit --pretty false || {
  echo "❌ TypeScript compilation failed"
  exit 1
}

# Copy files to dist
mkdir -p dist
cp evo.ts filesystem.ts types.ts dist/ 2>/dev/null || true

# Create manifest
node -e "
const fs = require('fs');
const path = require('path');
const manifest = {
  version: process.env.AGENT_VERSION || 'dev',
  buildDate: new Date().toISOString(),
  files: ['evo.ts', 'filesystem.ts', 'types.ts']
};
fs.writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));
"

echo "✅ Build complete. Files in dist/"

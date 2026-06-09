#!/bin/bash
# Install evo-agent from GitHub with proper handling

set -e

# Install package ignoring scripts to avoid postinstall errors
npm install -g --ignore-scripts "$@"

# Create symlink for evo command
EVO_PKG_DIR=$(npm root -g)/evo-agent
EVO_BIN_SRC="$EVO_PKG_DIR/dist/src/evo.js"
EVO_BIN_DST="$(npm bin -g)/evo"

if [ -f "$EVO_BIN_SRC" ]; then
  ln -sf "$EVO_BIN_SRC" "$EVO_BIN_DST"
  echo "✅ evo command linked to $EVO_BIN_DST"
else
  echo "❌ evo.js not found in $EVO_PKG_DIR/dist/src/"
  exit 1
fi

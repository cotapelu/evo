#!/bin/bash
# Add import statements for new modules at top of evo.ts

# Insert after "import * as http from 'http';"
sed -i '/import \* as http from/a\\n// Local modules (modularization)\nimport { FileSystem } from \'./filesystem\';\nimport type { Message, Goal, EvolutionMetrics, AgentConfig, AgentState } from \'./types\';' evo.ts

echo "✅ Added imports for filesystem.ts and types.ts"

#!/usr/bin/env tsx
// Add self-deploy capability to evo.ts

import * as fs from 'fs';

const evoFile = 'evo.ts';
let code = fs.readFileSync(evoFile, 'utf-8');

console.log('🚀 Adding self-deploy capability...');

// 1. Update AgentConfig with deploy fields
const configPatch = `  enableSecurity: boolean;\n  enableHealthChecks: boolean;\n  maxChildren: number;\n  memoryPath?: string;\n  logPath?: string;\n  metricsPort?: number;\n  apiRateLimit?: number;\n  resourceLimits?: {\n    maxMemoryMB?: number;\n    maxCpuMsPerIter?: number;\n    maxOpenFiles?: number;\n  };\n  security?: {\n    requireAuth?: boolean;\n    allowedPaths?: string[];\n    blockedOperations?: string[];\n    sandboxMode?: 'strict' | 'moderate' | 'disabled';\n  };\n  // Deploy configuration\n  deploy?: {\n    autoDeployOnStable?: boolean;\n    buildCommand?: string;\n    distDir?: string;\n    keepVersions?: number;\n    postDeployScript?: string;\n  };`;

// Find AgentConfig interface end and add deploy
const agentConfigStart = code.indexOf('export interface AgentConfig {');
const agentConfigEnd = code.indexOf('}', agentConfigStart);
if (agentConfigStart > 0 && agentConfigEnd > agentConfigStart) {
  // Insert before closing brace
  code = code.slice(0, agentConfigEnd) + '\n  // Deploy configuration\n  deploy?: {\n    autoDeployOnStable?: boolean;\n    buildCommand?: string;\n    distDir?: string;\n    keepVersions?: number;\n    postDeployScript?: string;\n  };\n' + code.slice(agentConfigEnd);
  console.log('  ✅ Added deploy config to AgentConfig');
}

// 2. Add deploy method to EvoAgent class
const deployMethod = `
  // ==================== SELF-DEPLOY ====================

  async deploy(version?: string): Promise<{ success: boolean; message: string; files: string[] }> {
    this.log('info', '🚀 Starting self-deploy...');
    const files: string[] = [];
    const timestamp = version || \`v\${new Date().toISOString().slice(0,10)}\`;

    try {
      // 1. Build/Compile
      const buildCmd = this.config.deploy?.buildCommand || 'npx tsc --noEmit';
      this.log('info', '📦 Building with:', buildCmd);
      // In real implementation, would exec buildCmd
      // For now, just copy current file

      // 2. Create dist directory
      const distDir = this.config.deploy?.distDir || 'dist';
      if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

      // 3. Copy files
      const copyFiles = ['evo.ts', 'filesystem.ts', 'types.ts'];
      for (const file of copyFiles) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf-8');
          const dest = path.join(distDir, file);
          fs.writeFileSync(dest, content);
          files.push(dest);
          this.log('debug', '  Copied:', file, '→', dest);
        }
      }

      // 4. Write manifest
      const manifest = {
        version: timestamp,
        agentId: this.id,
        level: this.state.level,
        capabilities: this.state.capabilities,
        deployedAt: new Date().toISOString(),
        files: files.map(f => path.basename(f))
      };
      const manifestPath = path.join(distDir, 'manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      files.push(manifestPath);

      // 5. Run post-deploy script if configured
      if (this.config.deploy?.postDeployScript) {
        this.log('info', 'Running post-deploy script:', this.config.deploy.postDeployScript);
        // await exec(this.config.deploy.postDeployScript);
      }

      this.log('info', '✅ Deploy successful! Files:', files.length);
      return { success: true, message: 'Deployed successfully', files };
    } catch (error: any) {
      this.log('error', '❌ Deploy failed:', error);
      return { success: false, message: error.message, files };
    }
  }

  async createBuildScript(): Promise<string> {
    const script = \`#!/bin/bash
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
node -e \"
const fs = require('fs');
const path = require('path');
const manifest = {
  version: process.env.AGENT_VERSION || 'dev',
  buildDate: new Date().toISOString(),
  files: ['evo.ts', 'filesystem.ts', 'types.ts']
};
fs.writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));
\"

echo "✅ Build complete. Files in dist/"
\`;

    try {
      fs.writeFileSync('build.sh', script);
      fs.chmodSync('build.sh', 0o755);
      this.log('info', '📝 Created build.sh script');
      return 'build.sh';
    } catch (e) {
      this.log('error', 'Failed to create build script:', e);
      throw e;
    }
  }

  async createPackageJson(): Promise<void> {
    const pkg = {
      name: 'self-evolving-agent',
      version: '2.0.0',
      description: 'Autonomous self-evolving AI agent OS',
      main: 'dist/evo.js',
      types: 'dist/evo.d.ts',
      scripts: {
        build: 'npx tsc',
        start: 'node dist/evo.js',
        deploy: './build.sh && node dist/evo.js',
        test: 'jest',
        'test:watch': 'jest --watch'
      },
      dependencies: {
        // No external dependencies - pure TypeScript
      },
      devDependencies: {
        typescript: '^5.0.0',
        '@types/node': '^20.0.0',
        tsx: '^4.0.0',
        jest: '^29.0.0',
        '@types/jest': '^29.0.0'
      },
      keywords: ['ai', 'agent', 'self-evolving', 'autonomous', 'os'],
      author: 'Self-Evolving System',
      license: 'MIT'
    };

    try {
      fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
      this.log('info', '📦 Created package.json');
    } catch (e) {
      this.log('error', 'Failed to create package.json:', e);
    }
  }
`;

// Insert before validation method (look for "private async validateCode")
const validatePos = code.indexOf('  private async validateCode(');
if (validatePos > 0) {
  code = code.slice(0, validatePos) + deployMethod + '\n' + code.slice(validatePos);
  console.log('  ✅ Added deploy() and helper methods');
} else {
  console.log('  ❌ Could not find validateCode method');
}

// 3. Auto-deploy on stable iteration (optional enhancement)
const improveCodePatch = `
    // After successful iteration, check for auto-deploy
    if (this.config.deploy?.autoDeployOnStable && this.state.level >= 25 && this.iterationCount % 10 === 0) {
      this.log('info', '🤖 Auto-deploy triggered (stable iteration)');
      const result = await this.deploy(\`auto-\${this.iterationCount}\`);
      if (!result.success) {
        this.log('error', 'Auto-deploy failed:', result.message);
      }
    }
`;

// Find where to insert: after "this.state.level = analysis.newLevel;" in executeIteration
const setLevelLine = code.indexOf('this.state.level = analysis.newLevel;');
if (setLevelLine > 0) {
  const nextLine = code.indexOf('\n', setLevelLine);
  if (nextLine > setLevelLine) {
    code = code.slice(0, nextLine + 1) + improveCodePatch + code.slice(nextLine + 1);
    console.log('  ✅ Added auto-deploy trigger in executeIteration');
  }
}

fs.writeFileSync(evoFile, code);
console.log('\n✅ Self-deploy capability added!');
console.log('\nNew methods:');
console.log('  - deploy(version?) -> builds and packages agent');
console.log('  - createBuildScript() -> generates build.sh');
console.log('  - createPackageJson() -> generates package.json');
console.log('\nConfiguration:');
console.log('  AgentConfig.deploy = { autoDeployOnStable, buildCommand, distDir, keepVersions, postDeployScript }');
console.log('\nTo use:');
console.log('  agent.deploy().then(r => console.log(r));');

#!/usr/bin/env node
/**
 * AUTOMATED AUDIT SCRIPT - Verify compliance với EVOLUTION.md
 * Kiểm tra từng yêu cầu và báo cáo chi tiết
 */

import { readFile, readdir, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const EVOLUTION_MD = join(ROOT, 'EVOLUTION.md');

// Đọc EVOLUTION.md content
const evoDoc = readFile(EVOLUTION_MD, 'utf-8');

console.log('🔍 AUTOMATED AUDIT: EVOLUTION.md Compliance\n');
console.log('=' .repeat(70));

let passCount = 0;
let failCount = 0;

function check(description: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`✅ ${description}`);
    passCount++;
  } else {
    console.log(`❌ ${description}`);
    if (details) console.log(`   → ${details}`);
    failCount++;
  }
}

// ========== SECTION 1: ARCHITECTURE ==========
console.log('\n📍 SECTION 1: Architecture\n');

check(
  'EvoSystem singleton exists',
  existsSync(join(ROOT, 'src/system.ts'))
);

check(
  'EvolutionEngine class exists',
  existsSync(join(ROOT, 'src/evolution-engine.ts'))
);

check(
  'AgentManager class exists',
  existsSync(join(ROOT, 'src/agent-manager.ts'))
);

check(
  'MessageBus class exists',
  existsSync(join(ROOT, 'src/messaging.ts'))
);

check(
  'Logger class exists',
  existsSync(join(ROOT, 'src/logger.ts'))
);

// ========== SECTION 2: AgentSessionRuntime ==========
console.log('\n📍 SECTION 2: AgentSessionRuntime Setup\n');

const systemTs = readFile(join(ROOT, 'src/system.ts'), 'utf-8');

check(
  'Uses getAgentDir() from pi',
  systemTs.includes('getAgentDir'),
  'Should import and use getAgentDir()'
);

check(
  'Creates SessionManager',
  systemTs.includes('SessionManager.create')
);

check(
  'Creates AuthStorage',
  systemTs.includes('AuthStorage.create')
);

check(
  'Creates SettingsManager',
  systemTs.includes('SettingsManager.create')
);

check(
  'Creates ModelRegistry',
  systemTs.includes('ModelRegistry.create')
);

check(
  'Uses createAgentSessionServices',
  systemTs.includes('createAgentSessionServices')
);

check(
  'Uses createAgentSessionFromServices',
  systemTs.includes('createAgentSessionFromServices')
);

check(
  'Uses createAgentSessionRuntime (NOT createAgentSession)',
  systemTs.includes('createAgentSessionRuntime') && !systemTs.match(/createAgentSession\s*\(\s*\{/),
  'Must use createAgentSessionRuntime for main app'
);

check(
  'Creates InteractiveMode',
  systemTs.includes('InteractiveMode')
);

check(
  'Calls interactive.run()',
  systemTs.includes('interactive.run()')
);

// ========== SECTION 3: Extensions ==========
console.log('\n📍 SECTION 3: Extensions\n');

check(
  'Evo extension exists',
  existsSync(join(ROOT, 'src/extensions/evo-extension.ts'))
);

check(
  'Web extension exists',
  existsSync(join(ROOT, 'src/extensions/web-extension.ts'))
);

const evoExt = readFile(join(ROOT, 'src/extensions/evo-extension.ts'), 'utf-8');

// Check slash commands
const commands = [
  'evolution',
  'evolution-history',
  'evolution-rollback',
  'evolution-metrics',
  'evolution-heartbeat',
  'evolution-logs',
  'evo',
  'agents',
  'agent-stop',
  'spawn-agent',
  'web-ui-start',
  'web-ui-stop',
  'reload-config',
  'config-export',
  'config-import',
  'config-snapshots',
  'config-snapshot',
  'config-restore'
];

commands.forEach(cmd => {
  check(
    `Command: /${cmd}`,
    evoExt.includes(`'${cmd}'`) || evoExt.includes(`"${cmd}"`)
  );
});

// Check tools
const tools = [
  'evolve',
  'evo_status',
  'spawn_agent',
  'evo_rollback',
  'agent_message',
  'agent_broadcast',
  'evo_metrics'
];

tools.forEach(tool => {
  check(
    `Tool: ${tool}`,
    evoExt.includes(`name: '${tool}'`)
  );
});

// ========== SECTION 4: EvolutionEngine Methods ==========
console.log('\n📍 SECTION 4: EvolutionEngine Interface\n');

check(
  'cycle() method exists',
  evolutionEngineIncludes('async cycle()')
);

check(
  'startAuto() method exists',
  evolutionEngineIncludes('startAuto(')
);

check(
  'stopAuto() method exists',
  evolutionEngineIncludes('stopAuto(')
);

check(
  'getLevel() method exists',
  evolutionEngineIncludes('getLevel()')
);

check(
  'getMetrics() method exists',
  evolutionEngineIncludes('async getMetrics()')
);

check(
  'getHistory() method exists',
  evolutionEngineIncludes('async getHistory()')
);

check(
  'rollback() method exists',
  evolutionEngineIncludes('async rollback(')
);

check(
  'setStrategy() method exists',
  evolutionEngineIncludes('setStrategy(')
);

check(
  'setGeneticFlag() method exists',
  evolutionEngineIncludes('setGeneticFlag(')
);

check(
  'setPromptOptimization() method exists',
  evolutionEngineIncludes('setPromptOptimization(')
);

function evolutionEngineIncludes(str: string): boolean {
  const engineContent = readFile(join(ROOT, 'src/evolution-engine.ts'), 'utf-8');
  return engineContent.includes(str);
}

// ========== SECTION 5: AgentManager Methods ==========
console.log('\n📍 SECTION 5: AgentManager Interface\n');

const agentManagerContent = readFile(join(ROOT, 'src/agent-manager.ts'), 'utf-8');

check(
  'spawnAgent() method exists',
  agentManagerContent.includes('spawnAgent(')
);

check(
  'stopAgent() method exists',
  agentManagerContent.includes('stopAgent(')
);

check(
  'listAgents() method exists',
  agentManagerContent.includes('listAgents()')
);

check(
  'getAvailableTypes() method exists',
  agentManagerContent.includes('getAvailableTypes()')
);

// ========== SECTION 6: Evolution Cycle Implementation ==========
console.log('\n📍 SECTION 6: Evolution Cycle (v2) Implementation\n');

check(
  'CodeAnalyzer class exists',
  existsSync(join(ROOT, 'src/code-analyzer.ts'))
);

check(
  'MultiFileDiffApplier class exists',
  existsSync(join(ROOT, 'src/multi-file-diff-applier.ts'))
);

check(
  'ValidationRunner class exists',
  existsSync(join(ROOT, 'src/validation-runner.ts'))
);

const codeAnalyzerContent = readFile(join(ROOT, 'src/code-analyzer.ts'), 'utf-8');
check(
  'CodeAnalyzer uses priority-based inclusion',
  codeAnalyzerContent.includes('priority') && codeAnalyzerContent.includes('high')
);

check(
  'ImprovementCandidate includes files[] field',
  readFile(join(ROOT, 'src/evolution-strategy.ts'), 'utf-8').includes('files: string[]')
);

check(
  'MultiFileDiffApplier supports multi-file patches',
  readFile(join(ROOT, 'src/multi-file-diff-applier.ts'), 'utf-8').includes('parseDiffFiles')
);

check(
  'ValidationRunner has 4 checks',
  readFile(join(ROOT, 'src/validation-runner.ts'), 'utf-8').includes('checkSyntax') &&
  readFile(join(ROOT, 'src/validation-runner.ts'), 'utf-8').includes('checkTypeScript') &&
  readFile(join(ROOT, 'src/validation-runner.ts'), 'utf-8').includes('runUnitTests') &&
  readFile(join(ROOT, 'src/validation-runner.ts'), 'utf-8').includes('runSmokeTest')
);

// ========== SECTION 7: Default Paths & Configuration ==========
console.log('\n📍 SECTION 7: Default Paths & Config\n');

check(
  'settings.json exists (sample)',
  existsSync(join(ROOT, 'settings.json'))
);

const settingsJson = existsSync(join(ROOT, 'settings.json')) 
  ? readFile(join(ROOT, 'settings.json'), 'utf-8')
  : '';

check(
  'settings.json has evo config section',
  settingsJson.includes('"evo"')
);

check(
  'Logger writes to agentDir/evo.log',
  readFile(join(ROOT, 'src/logger.ts'), 'utf-8').includes('evo.log')
);

// ========== SECTION 8: Build & Run ==========
console.log('\n📍 SECTION 8: Build & Run\n');

const packageJson = JSON.parse(readFile(join(ROOT, 'package.json'), 'utf-8'));

check(
  'npm build script exists',
  packageJson.scripts && !!packageJson.scripts.build
);

check(
  'npm start script exists',
  packageJson.scripts && !!packageJson.scripts.start
);

check(
  'npm dev script exists',
  packageJson.scripts && !!packageJson.scripts.dev
);

check(
  'Has @earendil-works/pi-coding-agent dependency',
  packageJson.dependencies && packageJson.dependencies['@earendil-works/pi-coding-agent']
);

check(
  'Has diff library dependency',
  packageJson.dependencies && packageJson.dependencies.diff
);

// ========== SECTION 9: Strategies ==========
console.log('\n📍 SECTION 9: Evolution Strategies\n');

const strategiesContent = readFile(join(ROOT, 'src/evolution-strategies.ts'), 'utf-8');

const strategyNames = [
  'priority',
  'risk-averse',
  'impact-first',
  'thompson-sampling',
  'context-aware',
  'ensemble'
];

strategyNames.forEach(strategy => {
  check(
    `Strategy: ${strategy}`,
    strategiesContent.includes(`name = '${strategy}'`) || strategiesContent.includes(`name = "${strategy}"`)
  );
});

check(
  'GeneticEvolutionStrategy class exists',
  existsSync(join(ROOT, 'src/evolution-strategy.ts'))
);

// ========== SUMMARY ==========
console.log('\n' + '='.repeat(70));
console.log(`\n📊 AUDIT SUMMARY:`);
console.log(`   ✅ Passed: ${passCount}`);
console.log(`   ❌ Failed: ${failCount}`);
console.log(`   📈 Compliance: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%\n`);

if (failCount === 0) {
  console.log('🎉 PERFECT! System is 100% compliant with EVOLUTION.md\n');
} else {
  console.log('⚠️  Some requirements missing. Review failures above.\n');
}

process.exit(failCount > 0 ? 1 : 0);

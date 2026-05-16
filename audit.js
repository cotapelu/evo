#!/usr/bin/env node
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

async function runAudit() {
  console.log('🔍 AUDIT: EVOLUTION.md Compliance\n');
  let pass = 0, fail = 0;

  function check(desc, ok) {
    if (ok) { console.log(`✅ ${desc}`); pass++; }
    else { console.log(`❌ ${desc}`); fail++; }
  }

  // Files
  check('system.ts exists', existsSync(join(ROOT, 'src/system.ts')));
  check('evolution-engine.ts exists', existsSync(join(ROOT, 'src/evolution-engine.ts')));
  check('agent-manager.ts exists', existsSync(join(ROOT, 'src/agent-manager.ts')));
  check('messaging.ts exists', existsSync(join(ROOT, 'src/messaging.ts')));
  check('logger.ts exists', existsSync(join(ROOT, 'src/logger.ts')));
  check('evo-extension.ts exists', existsSync(join(ROOT, 'src/extensions/evo-extension.ts')));
  check('web-extension.ts exists', existsSync(join(ROOT, 'src/extensions/web-extension.ts')));
  check('code-analyzer.ts exists', existsSync(join(ROOT, 'src/code-analyzer.ts')));
  check('multi-file-diff-applier.ts exists', existsSync(join(ROOT, 'src/multi-file-diff-applier.ts')));
  check('validation-runner.ts exists', existsSync(join(ROOT, 'src/validation-runner.ts')));
  check('evolution-strategy.ts exists', existsSync(join(ROOT, 'src/evolution-strategy.ts')));
  check('evolution-strategies.ts exists', existsSync(join(ROOT, 'src/evolution-strategies.ts')));

  // Content checks
  const system = await readFile(join(ROOT, 'src/system.ts'), 'utf-8');
  check('Uses getAgentDir()', system.includes('getAgentDir'));
  check('Uses createAgentSessionRuntime', system.includes('createAgentSessionRuntime'));
  check('Uses InteractiveMode', system.includes('InteractiveMode'));

  const ext = await readFile(join(ROOT, 'src/extensions/evo-extension.ts'), 'utf-8');
  const web = await readFile(join(ROOT, 'src/extensions/web-extension.ts'), 'utf-8');

  check('Has /evolution command', ext.includes("'evolution'"));
  check('Has /evolution-history command', ext.includes("'evolution-history'"));
  check('Has /evolution-rollback command', ext.includes("'evolution-rollback'"));
  check('Has /evolution-metrics command', ext.includes("'evolution-metrics'"));
  check('Has /evolution-heartbeat command', ext.includes("'evolution-heartbeat'"));
  check('Has /evolution-logs command', ext.includes("'evolution-logs'"));
  check('Has /evo command', ext.includes("'evo'"));
  check('Has /agents command', ext.includes("'agents'"));
  check('Has /agent-stop command', ext.includes("'agent-stop'"));
  check('Has /spawn-agent command', ext.includes("'spawn-agent'"));
  check('Has /reload-config command', ext.includes("'reload-config'"));
  check('Has /web-ui-start command', web.includes("'web-ui-start'"));
  check('Has /web-ui-stop command', web.includes("'web-ui-stop'"));

  check('Has evolve tool', ext.includes("name: 'evolve'"));
  check('Has evo_status tool', ext.includes("name: 'evo_status'"));
  check('Has spawn_agent tool', ext.includes("name: 'spawn_agent'"));
  check('Has evo_rollback tool', ext.includes("name: 'evo_rollback'"));
  check('Has agent_message tool', ext.includes("name: 'agent_message'"));
  check('Has agent_broadcast tool', ext.includes("name: 'agent_broadcast'"));
  check('Has evo_metrics tool', ext.includes("name: 'evo_metrics'"));

  const engine = await readFile(join(ROOT, 'src/evolution-engine.ts'), 'utf-8');
  check('EvolutionEngine has cycle()', engine.includes('async cycle()'));
  check('EvolutionEngine has startAuto()', engine.includes('startAuto('));
  check('EvolutionEngine has stopAuto()', engine.includes('stopAuto('));
  check('EvolutionEngine has getLevel()', engine.includes('getLevel()'));
  check('EvolutionEngine has getMetrics()', engine.includes('async getMetrics()'));
  check('EvolutionEngine has getHistory()', engine.includes('async getHistory()'));
  check('EvolutionEngine has rollback()', engine.includes('async rollback('));
  check('EvolutionEngine has setStrategy()', engine.includes('setStrategy('));
  check('EvolutionEngine has setGeneticFlag()', engine.includes('setGeneticFlag('));
  check('EvolutionEngine has setPromptOptimization()', engine.includes('setPromptOptimization('));

  const agentMgr = await readFile(join(ROOT, 'src/agent-manager.ts'), 'utf-8');
  check('AgentManager has spawnAgent()', agentMgr.includes('spawnAgent('));
  check('AgentManager has stopAgent()', agentMgr.includes('stopAgent('));
  check('AgentManager has listAgents()', agentMgr.includes('listAgents()'));
  check('AgentManager has getAvailableTypes()', agentMgr.includes('getAvailableTypes()'));

  const strat = await readFile(join(ROOT, 'src/evolution-strategy.ts'), 'utf-8');
  check('ImprovementCandidate has files[]', strat.includes('files: string[]'));

  const strategies = await readFile(join(ROOT, 'src/evolution-strategies.ts'), 'utf-8');
  check('Has priority strategy', strategies.includes("name = 'priority'"));
  check('Has risk-averse strategy', strategies.includes("name = 'risk-averse'"));
  check('Has impact-first strategy', strategies.includes("name = 'impact-first'"));
  check('Has thompson-sampling strategy', strategies.includes("name = 'thompson-sampling'"));
  check('Has context-aware strategy', strategies.includes("name = 'context-aware'"));
  check('Has ensemble strategy', strategies.includes("name = 'ensemble'"));

  check('settings.json exists', existsSync(join(ROOT, 'settings.json')));
  check('settings.json has evo section', await readFile(join(ROOT, 'settings.json'), 'utf-8').then(s => s.includes('"evo"')));

  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf-8'));
  check('Has npm build script', pkg.scripts && pkg.scripts.build);
  check('Has npm start script', pkg.scripts && pkg.scripts.start);
  check('Has npm dev script', pkg.scripts && pkg.scripts.dev);
  check('Has pi-coding-agent dep', pkg.dependencies && pkg.dependencies['@earendil-works/pi-coding-agent']);
  check('Has diff dep', pkg.dependencies && pkg.dependencies.diff);

  console.log('\n' + '='.repeat(50));
  console.log(`✅ ${pass} | ❌ ${fail} | ${((pass/(pass+fail))*100).toFixed(1)}% compliance\n`);
}

runAudit().catch(e => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env tsx
// Integrate types.ts - remove duplicate interfaces from evo.ts

import * as fs from 'fs';

const evoFile = 'evo.ts';
let code = fs.readFileSync(evoFile, 'utf-8');

console.log('🔧 Integrating types.ts...');

// 1. Remove duplicate interface declarations from evo.ts
const interfacesToRemove = [
  'export interface Message',
  'export interface Goal',
  'export interface EvolutionMetrics',
  'export interface AgentConfig',
  'export interface AgentState',
  'export interface EvolutionPlan'
];

for (const iface of interfacesToRemove) {
  const regex = new RegExp(`${iface}[\\s\\S]*?\\n}\\n`, 'g');
  const before = code;
  code = code.replace(regex, '');
  if (code !== before) {
    console.log(`  ✅ Removed ${iface} from evo.ts`);
  }
}

// 2. Add imports for types that are still used in evo.ts but not imported
// Check if we need to add import statement
if (!code.includes("import type { Message, Goal, EvolutionMetrics, AgentConfig, AgentState, EvolutionPlan } from './types'")) {
  // Find where to insert (after existing imports)
  const lastImport = code.lastIndexOf('import');
  const nextLine = code.indexOf('\n', lastImport);
  if (lastImport > 0 && nextLine > 0) {
    const imports = `
import type { Message, Goal, EvolutionMetrics, AgentConfig, AgentState, EvolutionPlan } from './types';
`;
    code = code.slice(0, nextLine + 1) + imports + code.slice(nextLine + 1);
    console.log('  ✅ Added type imports from types.ts');
  }
}

// 3. Fix any references that might break
// Replace AgentState in state declaration if needed
if (code.includes('state: AgentState;')) {
  // Already using imported type
}

fs.writeFileSync(evoFile, code);
console.log('✅ Integration complete!');
console.log('\nNext: Verify compilation with: npx tsc --noEmit --ignoreConfig evo.ts');

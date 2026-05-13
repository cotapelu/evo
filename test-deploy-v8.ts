import { EvoAgent } from './evo.ts';

(async () => {
  console.log('🚀 Deploy Test - Verify auto-create build artifacts\n');

  const agent = new EvoAgent({
    maxIterations: 1,
    deploy: { autoDeployOnStable: false, distDir: 'dist-test' }
  });

  const fs = require('fs');
  // Clean first (ignore missing)
  try { fs.unlinkSync('build.sh'); } catch {}
  try { fs.unlinkSync('package.json'); } catch {}

  console.log('Calling deploy()...\n');
  const result = await agent.deploy('v8-test');

  console.log('\n📦 Deploy result:', result.success ? '✅ SUCCESS' : '❌ FAILED');
  console.log('Files:', result.files.length, result.files);

  console.log('\n🔍 Checking artifacts:');
  ['build.sh', 'package.json'].forEach(f => {
    const exists = fs.existsSync(f) ? '✅' : '❌';
    console.log(`  ${exists} ${f}`);
  });

  if (fs.existsSync('build.sh')) {
    console.log('\n📝 build.sh content (first 5 lines):');
    console.log(fs.readFileSync('build.sh', 'utf-8').split('\n').slice(0,5).join('\n'));
  }

  if (fs.existsSync('package.json')) {
    console.log('\n📦 package.json scripts:');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    console.log('  ', pkg.scripts ? Object.keys(pkg.scripts).join(', ') : 'none');
  }

  process.exit(0);
})().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

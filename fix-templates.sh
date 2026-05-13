#!/bin/bash
# Replace problematic template strings with proper concatenation

# 1. Fix addWorkerThreadSupport pool constant
sed -i '1298,1302s/const pool = `/const pool = '\''/; s/`;/'\''/' evo.ts

# 2. Fix addPerformanceOptimizations memo
sed -i 's/const memo = `[\s\S]*?`;/const memo = '\''\\n  private memoize<K, V>(fn: (key: K) => V): (key: K) => V {\\n    const cache = new Map<K, V>();\\n    return (key) => cache.has(key) ? cache.get(key)! : cache.set(key, fn(key)) && cache.get(key)!;\\n  }\\n'\'';/' evo.ts

# 3. Fix prepareModularization fsCode - đây là cancer, replace toàn bộ method
echo "Replacing prepareModularization method entirely..."
# backup and use clean version
head -n 1287 evo.ts > evo.clean.ts
cat prepareModularization-fix.ts >> evo.clean.ts
# Find where method ends (after last closing brace before next method)
tail -n +1320 evo.ts | grep -m1 -n "^  private" | read -r skip _ || skip=50
tail -n +$((1320 + skip)) evo.ts >> evo.clean.ts
mv evo.clean.ts evo.ts
echo "✅ Replaced with clean template"

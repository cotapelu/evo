#!/bin/bash
start=$(grep -n "private prepareModularization" evo.ts | cut -d: -f1)
if [ -z "$start" ]; then echo "Not found"; exit 1; fi
# Find the closing brace of this method
# Count braces: find line where method closes
end=$((start))
brace_count=0
while [ $brace_count -lt 2 ]; do
  end=$((end + 1))
  line=$(sed -n "${end}p" evo.ts)
  if echo "$line" | grep -q "{"; then brace_count=$((brace_count + 1)); fi
  if echo "$line" | grep -q "}"; then brace_count=$((brace_count - 1)); fi
done
echo "Method ends at line: $end"
# Replace
head -n $((start - 1)) evo.ts > evo.tmp
cat prepareModularization-fix.ts >> evo.tmp
tail -n +$end evo.ts >> evo.tmp
mv evo.tmp evo.ts
echo "✅ Replaced prepareModularization"

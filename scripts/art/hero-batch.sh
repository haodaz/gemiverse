#!/bin/sh
# Generate one hero-quality model per call with gemini-4-neon at high thinking. Usage: sh scripts/art/hero-batch.sh [parallel]
cd "$(dirname "$0")/../.." || exit 1
PAR=${1:-12}; n=0
while IFS='|' read -r name what opts; do
  [ -z "$name" ] && continue
  [ -f "public/gen3d/hero-$name.js" ] && continue
  { printf 'Write a three.js ES module that builds %s Made for a cozy dorm-room diorama.\nopts = { %s }.\n\n' "$what" "$opts"; cat scripts/art/prompts/hero/_craft.txt; } > "scripts/art/prompts/hero/$name.txt"
  node scripts/art/neon-code.mjs "hero-$name" "scripts/art/prompts/hero/$name.txt" high &
  n=$((n+1)); [ $((n % PAR)) -eq 0 ] && wait
done < scripts/art/hero-list.txt
wait

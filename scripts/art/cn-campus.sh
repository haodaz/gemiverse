#!/bin/bash
# Illustrated campus views for the nine C9 universities, drawn by Gemini's image model. No logos, no text.
cd "$(dirname "$0")/../.." && export OUT_DIR="$PWD/public/art/cn"
S="A soft, warm storybook illustration in gentle pastel colours, wide 16:9, flat shapes with light texture, golden afternoon light, a few tiny students walking. No text, no letters, no logos, no emblems, no watermarks."
gen(){ node scripts/art/image.mjs "$1" "$S Scene: $2" > "/tmp/cn-$1.log" 2>&1 & }
gen tsinghua "a Beijing university campus with a white three-arched stone gate, a red-brick auditorium with a low dome behind a wide lawn, and golden ginkgo trees in autumn."
gen pku "a Beijing university campus with a calm lake, a tall grey multi-eaved brick pagoda tower beside it, weeping willows and a stone boat at the shore."
gen fudan "a Shanghai university campus with two tall modern twin towers joined at the base, a broad green lawn in front, and old red-brick teaching buildings with plane trees."
gen sjtu "a Shanghai university campus with a traditional red palace-style gate with a tiled roof, an old red-brick library with white trim, and avenues of plane trees."
gen zju "a Hangzhou university campus beside a wide lake with a stone arch bridge, a modern library with a clock tower, lotus leaves on the water and soft hills behind."
gen nju "a Nanjing university campus with a grey-brick tower building covered in green and red ivy, a pointed roof, old trees and a quiet lawn."
gen ustc "a Hefei university campus with a simple stone gate, a small round pond with a bridge, cherry trees in pink blossom and low brick science buildings."
gen hit "a Harbin university campus in winter with a grand symmetrical main building with a central spire in Soviet classical style, snow on the roofs and pine trees."
gen xjtu "a Xi'an university campus with a long avenue under tall plane trees, a modern stone library, and a slender monument tower in a square."
wait; ls -la public/art/cn/*.jpg | wc -l

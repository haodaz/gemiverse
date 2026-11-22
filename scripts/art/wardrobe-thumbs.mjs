// Renders one small picture per wardrobe piece from the real 3D parts (written by Neon), so the inventory shows the thing itself.
// Needs the dev server on :3000. Writes public/wardrobe/<key>-<id>.png (transparent).
import fs from "node:fs";
import { createRequire } from "node:module";
const puppeteer = createRequire("/Users/aisandbox/Documents/vsbp/package.json")("puppeteer");
const OUT = new URL("../../public/wardrobe/", import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const CATS = { hairStyle: { cam: "cx=0.35&cy=0.86&cz=1.0&ty=0.82", items: ["bob", "longStraight", "longWavy", "twinTails", "sidePonytail", "highPonytail", "bun", "shortCrop", "sidePart", "tousled", "curtainBangs", "pixie", "curlyMedium"] },
  top: { cam: "cx=0.3&cy=0.52&cz=0.95&ty=0.47", items: ["cardigan", "hoodie", "sweater", "shirt", "tee", "blazer"] },
  bottom: { cam: "cx=0.3&cy=0.3&cz=1.05&ty=0.24", items: ["pleatedSkirt", "trousers", "jeans", "shorts", "longSkirt"] },
  shoes: { cam: "cx=0.35&cy=0.14&cz=0.7&ty=0.05", items: ["maryJanes", "sneakers", "boots", "loafers"] } };
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--use-angle=metal", "--enable-webgl", "--ignore-gpu-blocklist"], defaultViewport: { width: 320, height: 320, deviceScaleFactor: 1 } });
const p = await b.newPage(); let n = 0;
for (const [key, c] of Object.entries(CATS)) for (const id of c.items) {
  await p.goto(`http://localhost:3001/gen3d/doll.html?embed=1&show=idle&looks=mochi&${c.cam}&look=${encodeURIComponent(JSON.stringify({ [key]: id }))}`, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2200)); await p.screenshot({ path: `${OUT}${key}-${id}.png`, omitBackground: true }); n++; }
await b.close(); console.log(n, "thumbnails in public/wardrobe");

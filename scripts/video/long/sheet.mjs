// Contact sheet of the drawn scenes: a few moments of each, to look at before rendering.  node scripts/video/long/sheet.mjs <lang> <outdir> [scene ...]
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const puppeteer = createRequire("/Users/aisandbox/Documents/vsbp/package.json")("puppeteer");
const FF = "/Users/aisandbox/Documents/companydata/node_modules/ffmpeg-static/ffmpeg", [lang, out, ...only] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", defaultViewport: { width: 1920, height: 1080 } });
const p = await b.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));
await p.goto(`http://localhost:3000/film/long.html?s=s0&t=0&lang=${lang}`, { waitUntil: "networkidle2" });
const ids = only.length ? only : await p.evaluate(() => window.SCENES), PS = [0.12, 0.35, 0.58, 0.8, 0.99];
for (const id of ids) { const files = []; for (const [k, q] of PS.entries()) { await p.evaluate((id, q, lang) => window.seek(id, q * 20, 20, lang), id, q, lang); await new Promise((r) => setTimeout(r, 250)); const f = `${out}/${id}-${k}.jpg`; await p.screenshot({ path: f, type: "jpeg", quality: 80 }); files.push(f); }
  execFileSync(FF, ["-loglevel", "error", "-y", ...files.flatMap((f) => ["-i", f]), "-filter_complex", files.map((_, i) => `[${i}]scale=768:432[v${i}]`).join(";") + ";" + files.map((_, i) => `[v${i}]`).join("") + `hstack=inputs=${files.length}`, "-frames:v", "1", `${out}/row-${id}.jpg`]); for (const f of files) fs.unlinkSync(f); console.log(id); }
console.log("errors:", errs.join(" | ") || "none"); await b.close();

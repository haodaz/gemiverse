// The story cut: stills drawn by Gemini's image model, concept cards (/film?c=...), and clips of the real product, one per narration line.
// node scripts/video/story.mjs   then   node scripts/video/assemble.mjs
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const puppeteer = createRequire("/Users/aisandbox/Documents/vsbp/package.json")("puppeteer");
const B = new URL(".", import.meta.url).pathname, ART = B + "../../public/art/film/", FF = "/Users/aisandbox/Documents/companydata/node_modules/ffmpeg-static/ffmpeg", TEMPO = 1.08, PAD = 0.4;
const dur = Object.fromEntries(JSON.parse(fs.readFileSync(B + "tts/durations.json", "utf8")).map((d) => [d.id, d.dur / TEMPO + PAD]));
const run = (a) => execFileSync(FF, ["-loglevel", "error", "-y", ...a], { stdio: "inherit" });
const ENC = ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30", "-an"];
// A still, moving slowly in toward (fx, fy).
const still = (img, out, D, fx = 0.5, fy = 0.5, rate = 0.0006) => run(["-loop", "1", "-i", img, "-vf", `scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160,zoompan=z='1+${rate}*on':x='iw*${fx}-(iw/zoom)*${fx}':y='ih*${fy}-(ih/zoom)*${fy}':d=${Math.ceil(D * 30)}:s=1920x1080:fps=30`, "-t", D.toFixed(2), ...ENC, out]);
const clip = (src, out, D) => run(["-i", src, "-vf", "tpad=stop_mode=clone:stop_duration=6,scale=1920:1080", "-t", D.toFixed(2), ...ENC, out]);
// With FILM_ME=1 the opening and ending use stills made from the founder's own photo, kept outside this repo.
const ME = process.env.FILM_ME ? "/Users/aisandbox/Documents/gem4/video/" : null;
const PLAN = [["n1", "still", ME ? ME + "touch-me.jpg" : ART + "touch-red2.jpg", ME ? 0.3 : 0.56, 0.6, 0.0011], ["n2", "clip", "room"], ["n3", "card", "budget"], ["n4", "clip", "ask"], ["n5", "card", "check"], ["n6", "card", "chart"], ["n7", "clip", "choose"], ["n8", "pair", "under", "agent"], ["n9", "clip", "spaces"], ["n10", "still", ME ? ME + "both-me2.jpg" : ART + "both-red2.jpg", ME ? 0.62 : 0.5, 0.5, 0.0007]];
fs.mkdirSync(B + "seg", { recursive: true }); for (const f of fs.readdirSync(B + "seg")) fs.unlinkSync(B + "seg/" + f);
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", defaultViewport: { width: 1600, height: 900, deviceScaleFactor: 2.4 } });
const page = await browser.newPage();
for (const [id, kind, a, fx, fy, rate] of PLAN) { const out = `${B}seg/${id.replace("n", "s")}.mp4`, D = dur[id];
  if (kind === "still") still(a, out, D, fx, fy, rate);
  if (kind === "clip") clip(`${B}clips/${a}.mp4`, out, D);
  if (kind === "pair") {   // a concept card, then the clip that proves it
    await page.goto(`http://localhost:3000/film?c=${a}`, { waitUntil: "networkidle2" }); await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }); await new Promise((r) => setTimeout(r, 900));
    const png = `${B}out/card-${a}.png`, T1 = Math.min(3.6, D * 0.48); await page.screenshot({ path: png }); still(png, `${B}out/p1.mp4`, T1, 0.5, 0.5, 0.00022); clip(`${B}clips/${fx}.mp4`, `${B}out/p2.mp4`, D - T1);
    fs.writeFileSync(`${B}out/pair.txt`, `file '${B}out/p1.mp4'\nfile '${B}out/p2.mp4'`); run(["-f", "concat", "-safe", "0", "-i", `${B}out/pair.txt`, "-c", "copy", out]); }
  if (kind === "card") { await page.goto(`http://localhost:3000/film?c=${a}`, { waitUntil: "networkidle2" }); await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }); await new Promise((r) => setTimeout(r, 900));
    const png = `${B}out/card-${a}.png`; await page.screenshot({ path: png }); still(png, out, D, 0.5, 0.5, 0.00022); }
  console.log(id, kind, a.split("/").pop(), D.toFixed(2) + "s"); }
await browser.close();

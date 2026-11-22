// Renders the drawn scenes of the long film, frame by frame, for one language: scenes-<lang>/<id>.mp4, each exactly as long as its narration.
// node scripts/video/long/render.mjs <zh|en> [scene ...]
import fs from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { plan } from "./plan.mjs";
const puppeteer = createRequire("/Users/aisandbox/Documents/vsbp/package.json")("puppeteer");
const B = new URL(".", import.meta.url).pathname, FF = "/Users/aisandbox/Documents/companydata/node_modules/ffmpeg-static/ffmpeg", FPS = 15;
const [lang, ...only] = process.argv.slice(2), OUT = `${B}scenes-${lang}/`; fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", defaultViewport: { width: 1920, height: 1080 } });
const page = await browser.newPage(); page.on("pageerror", (e) => console.log("page error:", e.message.slice(0, 160)));
await page.goto(`http://localhost:3000/film/long.html?s=s0&t=0&lang=${lang}`, { waitUntil: "networkidle2" });
for (const part of plan(lang).flatMap((s) => s.parts.filter((p) => p.kind === "anim"))) { if (only.length && !only.includes(part.scene)) continue;
  const N = Math.round(part.dur * FPS), out = `${OUT}${part.scene}.mp4`, t0 = Date.now();
  const ff = spawn(FF, ["-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30", out], { stdio: ["pipe", "inherit", "inherit"] });
  for (let i = 0; i < N; i++) { await page.evaluate((id, t, T, lang) => window.seek(id, t, T, lang), part.scene, i / FPS, part.dur, lang); if (i === 0) await new Promise((r) => setTimeout(r, 500)); const buf = await page.screenshot({ type: "jpeg", quality: 90 }); await new Promise((r) => (ff.stdin.write(buf) ? r() : ff.stdin.once("drain", r))); }
  await new Promise((r) => { ff.on("close", r); ff.stdin.end(); }); console.log(lang, part.scene, part.dur.toFixed(1) + "s", N, "frames", Math.round((Date.now() - t0) / 1000) + "s"); }
await browser.close();

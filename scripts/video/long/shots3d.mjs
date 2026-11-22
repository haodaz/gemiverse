// More footage of the 3D product itself for the long film (no interface text, so one set serves both languages): the Gemi at its
// desk, at the shelf, by the window, the jars, the room at night in the rain and in snow, the other spaces with friends, three
// Gemis side by side. Also a scroll through the public AI ME page, in a phone-sized window.   node scripts/video/long/shots3d.mjs [name ...]
import fs from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const puppeteer = createRequire("/Users/aisandbox/Documents/vsbp/package.json")("puppeteer");
const B = new URL(".", import.meta.url).pathname, FF = "/Users/aisandbox/Documents/companydata/node_modules/ffmpeg-static/ffmpeg", O = "http://localhost:3000", OUT = `${B}clips3d/`; fs.mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2), want = (n) => !only.length || only.includes(n), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--use-angle=metal", "--enable-webgl", "--ignore-gpu-blocklist"], defaultViewport: { width: 1280, height: 720, deviceScaleFactor: 1.5 } });
const page = await browser.newPage(); page.on("pageerror", (e) => console.log("  page error:", e.message.slice(0, 120)));
async function shoot(seconds) { const frames = [], t0 = Date.now(); while (Date.now() - t0 < seconds * 1000) frames.push([Date.now() - t0, await page.screenshot({ type: "jpeg", quality: 90 })]); return { frames, seconds }; }
async function write(id, shot, vf) { const p = spawn(FF, ["-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", "30", "-i", "-", "-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30", `${OUT}${id}.mp4`], { stdio: ["pipe", "inherit", "inherit"] });
  const put = (buf) => new Promise((r) => (p.stdin.write(buf) ? r() : p.stdin.once("drain", r))); const N = Math.round(shot.seconds * 30); let k = 0; for (let i = 0; i < N; i++) { const t = i * 1000 / 30; while (k + 1 < shot.frames.length && shot.frames[k + 1][0] <= t) k++; await put(shot.frames[k][1]); }
  await new Promise((r) => { p.on("close", r); p.stdin.end(); }); console.log("clip", id, shot.seconds + "s", shot.frames.length, "frames"); }
const WIDE = "scale=1920:1080:flags=lanczos";
const d3 = async (name, path, wait, sec, after) => { if (!want(name)) return; try { await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1.5 }); await page.goto(O + path, { waitUntil: "networkidle2", timeout: 90000 }); await page.addStyleTag({ content: "html,body{background:#f3eef8!important}#ui,#say,#err{display:none!important}" }); await sleep(wait); if (after) { await after(); await sleep(1800); } await write(name, await shoot(sec), WIDE); } catch (e) { console.log("FAILED", name, e.message.slice(0, 120)); } };
const focus = (v) => () => page.evaluate((v) => { window.postMessage({ source: "gemiverse", type: "focus", value: v }, "*"); window.postMessage({ type: "focus", value: v }, "*"); }, v);
await d3("d-desk", "/gen3d/viewer.html?school=nyu&spot=0", 11000, 6);
await d3("d-shelf", "/gen3d/viewer.html?school=nyu&spot=1", 10000, 5);
await d3("d-window", "/gen3d/viewer.html?school=nyu&spot=2", 10000, 5);
await d3("d-jars", "/gen3d/viewer.html?school=nyu&spot=4", 8000, 5, focus("jars"));
await d3("d-deskview", "/gen3d/viewer.html?school=nyu&spot=0", 11000, 5, focus("desk"));
await d3("d-night", "/gen3d/viewer.html?school=nyu&spot=4&hour=22&weather=rain", 10000, 6);
await d3("d-snow", "/gen3d/viewer.html?school=pku&spot=2&hour=17&weather=snow", 10000, 6);
await d3("d-spaces", "/gen3d/spaces.html?auto=2.4&friends=pip,kai", 5000, 12);
await d3("d-trio", "/gen3d/doll.html?cam=front&looks=mochi,pip,kai", 5000, 5);
if (want("aime")) { try {   // the public AI ME page, scrolled slowly, in a phone-sized window
  await page.setViewport({ width: 430, height: 860, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await page.goto("https://collegedataai.com/aime", { waitUntil: "networkidle2", timeout: 60000 }); await sleep(5000);
  const H = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight), SEC = 16;
  const [shot] = await Promise.all([shoot(SEC), (async () => { await sleep(2200); const t0 = Date.now(), D = (SEC - 3.2) * 1000; await page.mouse.move(215, 500); while (Date.now() - t0 < D) { await page.mouse.wheel({ deltaY: 26 }); await page.evaluate(() => { for (const el of document.querySelectorAll("main, body, div")) if (el.scrollHeight > el.clientHeight + 200 && getComputedStyle(el).overflowY !== "visible") { el.scrollTop += 26; break; } }); await sleep(40); }   // wheel and, where the page scrolls inside a container, that container })()]);
  await write("aime", shot, "scale=860:1720:flags=lanczos"); } catch (e) { console.log("FAILED aime", e.message.slice(0, 120)); } }
await browser.close(); console.log("done");

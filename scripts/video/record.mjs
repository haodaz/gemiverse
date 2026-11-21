// Records the one-minute video segment by segment from the running app (localhost:3000), in a headless Chrome, at 1600x900.
// Each segment lasts as long as its narration line. Waiting for the models is not captured. node scripts/video/record.mjs [s3 s4]
import fs from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const puppeteer = createRequire("/Users/aisandbox/Documents/vsbp/package.json")("puppeteer");
const B = new URL(".", import.meta.url).pathname, FF = "/Users/aisandbox/Documents/companydata/node_modules/ffmpeg-static/ffmpeg", O = "http://localhost:3000";
const TEMPO = 1.08, PAD = 0.45;
const dur = Object.fromEntries(JSON.parse(fs.readFileSync(B + "tts/durations.json", "utf8")).map((d) => [d.id.replace("n", "s"), d.dur / TEMPO + PAD]));
fs.mkdirSync(B + "seg", { recursive: true });
const only = process.argv.slice(2), want = (id) => !only.length || only.includes(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--use-angle=metal", "--enable-webgl", "--ignore-gpu-blocklist", "--window-size=1600,900"], defaultViewport: { width: 1600, height: 900, deviceScaleFactor: 1 } });
const page = await browser.newPage();
const clean = () => page.addStyleTag({ content: "nextjs-portal,[data-nextjs-toast],#__next-build-watcher{display:none!important}" }).catch(() => {});
const open = async (path, wait = 2500) => { await page.goto(O + path, { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {}); await clean(); await sleep(wait); };
// Capture `seconds` of the page as JPEG frames with their real timestamps; returns the frames.
async function shoot(seconds) { const frames = [], t0 = Date.now(); while (Date.now() - t0 < seconds * 1000) frames.push([Date.now() - t0, await page.screenshot({ type: "jpeg", quality: 90 })]); return { frames, seconds }; }
// Encode shots into one clip of exactly D seconds at 30 fps (each frame held until the next; the last frame held to the end).
async function write(id, shots, D) {
  const out = `${B}seg/${id}.mp4`, p = spawn(FF, ["-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", "30", "-i", "-", "-vf", "scale=1920:1080:flags=lanczos", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30", out], { stdio: ["pipe", "inherit", "inherit"] });
  const put = (buf) => new Promise((r) => (p.stdin.write(buf) ? r() : p.stdin.once("drain", r)));
  const all = []; let base = 0; for (const s of shots) { for (const [t, f] of s.frames) all.push([base + t / 1000, f]); base += s.seconds; }
  const N = Math.round(D * 30); let k = 0; for (let i = 0; i < N; i++) { const t = i / 30; while (k + 1 < all.length && all[k + 1][0] <= t) k++; await put(all[k][1]); }
  await new Promise((r) => { p.on("close", r); p.stdin.end(); }); console.log(id, D.toFixed(2) + "s", all.length, "frames");
}
const click = async (label) => { const ok = await page.evaluate((l) => { const b = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === l || x.textContent.trim() === l); if (b) b.click(); return !!b; }, label); if (!ok) console.log("  no button:", label); return ok; };
const waitText = (t, ms = 120000) => page.waitForFunction((x) => document.body.innerText.includes(x), { timeout: ms }, t).catch(() => console.log("  timed out waiting for:", t));

// A clean first-time state: one campus, English interface, the demo Gemi, nothing learned yet.
await page.goto(O + "/", { waitUntil: "domcontentloaded" });
await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("gemi.")) localStorage.removeItem(k); localStorage.setItem("gemi.school", "nyu"); localStorage.setItem("gemi.lang", "en"); localStorage.setItem("gemi.me.nyu", JSON.stringify({ name: "Mochi", demo: true })); });

if (want("s1")) { await open("/deck", 6000); await write("s1", [await shoot(dur.s1)], dur.s1); }
if (want("s2")) { await open("/room", 7000); await write("s2", [await shoot(dur.s2)], dur.s2); }
if (want("s3") || want("s4")) {
  await open("/room", 6000); await click("Talk"); await sleep(900);
  const SAY = "帮我去图书馆看看有没有关于写论文的 workshop";
  await page.focus("input[placeholder]");
  const [a] = await Promise.all([shoot(3.0), (async () => { await sleep(300); await page.keyboard.type(SAY, { delay: 55 }); })()]);
  await page.keyboard.press("Enter"); console.log("  asked; waiting for the trip (not captured)");
  await waitText("checked fields"); await sleep(1500);
  const b = await shoot(dur.s3 - 3.0); if (want("s3")) await write("s3", [a, b], dur.s3);
  if (want("s4")) { const c1 = await shoot(0.8); await click("Keep"); const c2 = await shoot(1.3); await click("Skip"); await sleep(250); await click("Skip"); await waitText("revealed", 30000); await sleep(600);
    await page.evaluate(() => { const el = [...document.querySelectorAll("aside div")].find((d) => d.scrollHeight > d.clientHeight + 40); if (el) el.scrollTo({ top: 260, behavior: "smooth" }); });
    const c3 = await shoot(dur.s4 - 2.1); await write("s4", [c1, c2, c3], dur.s4); }
}
if (want("s5")) { await open("/deck?s=15", 2500); await write("s5", [await shoot(dur.s5)], dur.s5); }
if (want("s6")) { await open("/deck?s=17", 2000); const a = await shoot(dur.s6 * 0.5); await open("/deck?s=20", 2000); const b = await shoot(dur.s6 * 0.5); await write("s6", [a, b], dur.s6); }
if (want("s7")) { await page.evaluate(() => localStorage.setItem("gemi.went.nyu", JSON.stringify([{ find: "demo-1", title: "an event", matched: true }, { find: "demo-2", title: "another", matched: true }])));
  await open("/room", 7000); const a = await shoot(2.4); await page.evaluate(() => localStorage.removeItem("gemi.went.nyu"));
  await open("/gen3d/spaces.html?auto=1.4&friends=pip,kai", 5000); const b = await shoot(dur.s7 - 2.4); await write("s7", [a, b], dur.s7); }
if (want("s8")) { await open("/deck", 6000); const D = Math.max(dur.s8, 3.6); await write("s8", [await shoot(D)], D); }
await browser.close();

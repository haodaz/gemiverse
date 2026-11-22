// Product footage for the long film, recorded from the running app (localhost:3000) in a headless Chrome, once per language.
// Waiting for the models is not captured. Each clip keeps its natural length; the assembler trims or holds it.
// node scripts/video/long/clips.mjs <zh|en> [clip ...]     clips: start room ask choose diary agent pick map meet spaces
import fs from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const puppeteer = createRequire("/Users/aisandbox/Documents/vsbp/package.json")("puppeteer");
const B = new URL(".", import.meta.url).pathname, FF = "/Users/aisandbox/Documents/companydata/node_modules/ffmpeg-static/ffmpeg", O = "http://localhost:3000";
const [lang, ...only] = process.argv.slice(2), zh = lang === "zh", want = (id) => !only.length || only.includes(id), OUT = `${B}clips-${lang}/`; fs.mkdirSync(OUT, { recursive: true });
const W = zh ? { hello: "打个招呼", named: "就叫这个", heard: "它听到了", us: "美国", cn: "中国", talk: "聊聊", keep: "留下", skip: "不要", diary: "日记", social: "社交", campus: "去校园", library: "图书馆", sources: "核对过的字段", reveal: "揭开", live: "现在再去看一眼", cards: "张名片留下", meetBtn: "让它去认识", name: "团子", about: "我想找一些能一起动手做东西的人。人太多的场合我会累。", ask: "帮我去图书馆看看有没有关于写论文的 workshop", mapSchool: "pku" }
  : { hello: "Say hello", named: "That is its name", heard: "It heard you", us: "United States", cn: "China", talk: "Talk", keep: "Keep", skip: "Skip", diary: "Diary", social: "Social", campus: "Campus", library: "Library", sources: "checked fields", reveal: "revealed", live: "Look again, live", cards: "name cards kept", meetBtn: "Let it meet", name: "Mochi", about: "I want to find people who make things together. Big crowds wear me out.", ask: "Go to the library and see if there is a workshop on writing a thesis", mapSchool: "mit" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--use-angle=metal", "--enable-webgl", "--ignore-gpu-blocklist", "--window-size=1600,900"], defaultViewport: { width: 1600, height: 900, deviceScaleFactor: 1.2 } });
const page = await browser.newPage(); page.on("pageerror", (e) => console.log("  page error:", e.message.slice(0, 120)));
const big = () => page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1.5 }), wide = () => page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1.2 });
const clean = () => page.addStyleTag({ content: "nextjs-portal,[data-nextjs-toast],#__next-build-watcher{display:none!important}" }).catch(() => {});
const open = async (path, wait = 2500) => { await page.goto(O + path, { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {}); await clean(); await sleep(wait); };
async function shoot(seconds) { const frames = [], t0 = Date.now(); while (Date.now() - t0 < seconds * 1000) frames.push([Date.now() - t0, await page.screenshot({ type: "jpeg", quality: 90 })]); return { frames, seconds }; }
async function write(id, shots, vf = "scale=1920:1080:flags=lanczos") { const out = `${OUT}${id}.mp4`, p = spawn(FF, ["-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", "30", "-i", "-", "-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30", out], { stdio: ["pipe", "inherit", "inherit"] });
  const put = (buf) => new Promise((r) => (p.stdin.write(buf) ? r() : p.stdin.once("drain", r))); const all = []; let base = 0; for (const s of shots) { for (const [t, f] of s.frames) all.push([base + t / 1000, f]); base += s.seconds; }
  const N = Math.round(base * 30); let k = 0; for (let i = 0; i < N; i++) { const t = i / 30; while (k + 1 < all.length && all[k + 1][0] <= t) k++; await put(all[k][1]); }
  await new Promise((r) => { p.on("close", r); p.stdin.end(); }); console.log("clip", id, base.toFixed(1) + "s", all.length, "frames"); }
const click = async (label) => { const ok = await page.evaluate((l) => { const b = [...document.querySelectorAll("button,a")].find((x) => x.getAttribute("aria-label") === l || x.textContent.trim() === l) ?? [...document.querySelectorAll("button")].find((x) => x.textContent.trim().startsWith(l)); if (b) b.click(); return !!b; }, label); if (!ok) console.log("  no button:", label); return ok; };
const waitText = (t, ms = 150000) => page.waitForFunction((x) => document.body.innerText.includes(x), { timeout: ms }, t).then(() => true).catch(() => { console.log("  timed out waiting for:", t); return false; });
const fresh = async (inRoom) => { await page.goto(O + "/", { waitUntil: "domcontentloaded" }); await page.evaluate((lang, inRoom, name) => { for (const k of Object.keys(localStorage)) if (k.startsWith("gemi.")) localStorage.removeItem(k); localStorage.setItem("gemi.lang", lang); localStorage.setItem("gemi.toured.nyu", "1"); if (inRoom) { localStorage.setItem("gemi.school", "nyu"); localStorage.setItem("gemi.me.nyu", JSON.stringify({ name })); } }, lang, inRoom, W.name); };
const typing = async (text, sec, delay) => (await Promise.all([shoot(sec), (async () => { await sleep(350); await page.keyboard.type(text, { delay }); })()]))[0];
const step = async (name, fn) => { if (!want(name)) return; try { await fn(); } catch (e) { console.log("CLIP FAILED", name, e.message.slice(0, 160)); } };

await step("start", async () => { await fresh(false); await wide(); await open("/start", 1500);
  const a = await shoot(2.6); await click(W.hello); await sleep(500); const b = await typing(W.name, 2.4, 160); await click(W.named); await sleep(500);
  const c = await typing(W.about, 5.2, zh ? 120 : 55); await click(W.heard); await sleep(900); if (zh) { await click(W.us); await sleep(500); }
  const d = await shoot(2.2); await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /New York University|NYU/.test(x.textContent)); b?.scrollIntoView({ block: "center" }); b?.click(); }); const e = await shoot(1.6);
  await page.evaluate(() => { const bs = [...document.querySelectorAll("button")]; bs[bs.length - 1].click(); }); await sleep(600); await big(); await page.waitForFunction(() => location.pathname === "/room", { timeout: 30000 }).catch(() => console.log("  did not reach the room")); await clean(); await sleep(8000);
  await write("start", [a, b, c, d, e, await shoot(2.5)]); });
// The room on a quiet moment: the Gemi is home, walking between its spots.
await step("room", async () => { await fresh(true); await big(); await open("/room", 9000); await write("room", [await shoot(10)]); });
if (want("ask") || want("choose") || want("diary")) await step("ask", async () => { await fresh(true); await big(); await open("/room", 7000); await click(W.talk); await sleep(900); await page.focus("input[placeholder]");
  const a = await typing(W.ask, 3.4, zh ? 110 : 45); await page.keyboard.press("Enter"); console.log("  asked; waiting for the trip (not captured)"); if (!(await waitText(W.sources))) return; await sleep(1500);
  const b = await shoot(6); await write("ask", [a, b]);
  const c1 = await shoot(0.9); await click(W.keep); const c2 = await shoot(1.5); await click(W.skip); await sleep(350); await click(W.skip); await waitText(W.reveal, 40000); await sleep(700);
  await page.evaluate(() => { const el = [...document.querySelectorAll("aside div")].find((d) => d.scrollHeight > d.clientHeight + 40); if (el) el.scrollTo({ top: 260, behavior: "smooth" }); });
  await write("choose", [c1, c2, await shoot(8)]);
  await click(W.diary); await sleep(1500); await write("diary", [await shoot(7)]); });
await step("agent", async () => { await fresh(true); await big(); await open("/room", 6000); await click(W.campus); await sleep(1500); await click(W.library); if (!(await waitText(W.sources))) return; await sleep(1200);
  const a = await shoot(1.0); await click(W.live); const b = await shoot(1.6); if (!(await waitText("Managed Agent ·", 170000))) return; await sleep(500);
  await page.evaluate(() => { const el = [...document.querySelectorAll("aside div")].find((d) => d.scrollHeight > d.clientHeight + 40); if (el) el.scrollTo({ top: 150, behavior: "smooth" }); });
  await write("agent", [a, b, await shoot(7)], "crop=iw*0.62:ih*0.62:iw*0.38:ih*0.14,scale=1920:1080:flags=lanczos"); });
await step("pick", async () => { await fresh(false); await wide(); await open("/start", 1200); await click(W.hello); await sleep(400); await click(W.named); await sleep(400); await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => !b.disabled && b.className.includes("border-2"))?.click()); await sleep(900);
  await click(W.cn); await sleep(700); const a = await shoot(3.2); await click(W.us); const b = await shoot(3.2); await write("pick", [a, b]); });
await step("map", async () => { await wide(); await open(`/campus?school=${W.mapSchool}`, 2500); const a = await shoot(2.6); await page.evaluate(() => { const bs = [...document.querySelectorAll("main button")]; bs[Math.min(1, bs.length - 1)]?.click(); }); await write("map", [a, await shoot(4.2)]); });
await step("meet", async () => { await fresh(true); await big(); await open("/room", 6000); await click(W.social); await sleep(1200); await click(W.meetBtn); console.log("  meeting three Gemis (not captured)"); if (!(await waitText(W.cards, 120000))) return; await sleep(800); await write("meet", [await shoot(6.5)]); });
await step("spaces", async () => { await wide(); await open("/gen3d/spaces.html?auto=1.35&friends=pip,kai&space=readingRoom", 4500); await write("spaces", [await shoot(6)]); });
await browser.close(); console.log("done", lang);

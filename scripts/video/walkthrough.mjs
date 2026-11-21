// Walks the three-minute demo path on the running app with real model calls, and saves a screenshot of every step with a ring
// around what to click. Any step that fails is reported. node scripts/video/walkthrough.mjs
import fs from "node:fs";
import { createRequire } from "node:module";
const puppeteer = createRequire("/Users/aisandbox/Documents/vsbp/package.json")("puppeteer");
const OUT = "/Users/aisandbox/Documents/gem4/video/walkthrough/", O = "http://localhost:3000", sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--use-angle=metal", "--enable-webgl", "--ignore-gpu-blocklist"], defaultViewport: { width: 1440, height: 810, deviceScaleFactor: 1 } });
const page = await browser.newPage(); const log = [], shots = []; let n = 0;
page.on("pageerror", (e) => log.push("PAGE ERROR: " + e.message.slice(0, 160)));
const find = (what) => page.evaluateHandle((w) => { const all = [...document.querySelectorAll("button, a, input, textarea")]; const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < innerHeight; };
  return all.find((e) => vis(e) && (e.getAttribute("aria-label") === w || e.getAttribute("placeholder")?.startsWith(w) || e.textContent.trim() === w)) ?? all.find((e) => vis(e) && e.textContent.trim().startsWith(w)) ?? all.find((e) => vis(e) && e.textContent.includes(w)) ?? null; }, what);
async function shot(name, rings = []) {   // rings: element descriptions to circle, numbered in order
  const rects = []; for (const w of rings) { const h = await find(w); const el = h.asElement(); if (!el) { log.push(`MISSING on "${name}": ${w}`); continue; } await el.evaluate((e) => e.scrollIntoView({ block: "nearest" })); const b = await el.boundingBox(); if (b) rects.push(b); }
  await page.evaluate((rs) => { document.querySelectorAll(".wt-ring").forEach((x) => x.remove()); document.querySelectorAll("nextjs-portal").forEach((x) => (x.style.display = "none"));
    rs.forEach((r, i) => { const d = document.createElement("div"); d.className = "wt-ring"; d.style.cssText = `position:fixed;left:${r.x - 8}px;top:${r.y - 8}px;width:${r.width + 16}px;height:${r.height + 16}px;border:5px solid #e11d48;border-radius:${Math.min(40, (r.height + 16) / 2)}px;z-index:99999;pointer-events:none;box-shadow:0 0 0 3px #fff`; const t = document.createElement("div"); t.textContent = String(i + 1); t.style.cssText = "position:absolute;left:-16px;top:-16px;width:30px;height:30px;border-radius:50%;background:#e11d48;color:#fff;font:700 17px system-ui;display:grid;place-items:center;border:2px solid #fff"; d.appendChild(t); document.body.appendChild(d); }); }, rects);
  const f = `${String(++n).padStart(2, "0")}-${name}.jpg`; await page.screenshot({ path: OUT + f, type: "jpeg", quality: 82 }); shots.push(f); await page.evaluate(() => document.querySelectorAll(".wt-ring").forEach((x) => x.remove())); console.log("shot", f, rects.length + "/" + rings.length);
}
const click = async (w) => { const h = await find(w); const el = h.asElement(); if (!el) { log.push("CANNOT CLICK: " + w); return false; } await el.click(); return true; };
const waitText = async (t, ms, label) => { const t0 = Date.now(); const ok = await page.waitForFunction((x) => document.body.innerText.includes(x), { timeout: ms }, t).then(() => true).catch(() => false); log.push(`${ok ? "ok" : "TIMED OUT"} · ${label} · ${((Date.now() - t0) / 1000).toFixed(1)}s`); return ok; };
const count = (t) => page.evaluate((x) => document.body.innerText.split(x).length - 1, t);

await page.goto(O + "/", { waitUntil: "domcontentloaded" }); await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("gemi.") || k.startsWith("demo.")) localStorage.removeItem(k); });
await page.goto(O + "/", { waitUntil: "networkidle2" }); await sleep(2500); await shot("home", ["Meet your Gemi"]);
await click("Meet your Gemi"); await sleep(2500); await shot("light", ["Say hello"]);
await click("Say hello"); await sleep(600); await page.keyboard.type("Mochi"); await shot("name", ["Mochi", "That is its name"]);
await click("That is its name"); await sleep(600); await page.keyboard.type("I just moved to New York. I want to find people who make things. Big parties tire me."); await shot("one-thing", ["It heard you"]);
await click("It heard you"); await sleep(800); await shot("campus", ["NYU", "Choose a campus"]);
await click("NYU"); await sleep(400); await shot("move-in", ["Move in at NYU"]); await click("Move in at NYU");
await page.waitForFunction(() => location.pathname === "/room", { timeout: 20000 }).catch(() => log.push("DID NOT REACH /room")); await sleep(6000);
await waitText(" tokens · ", 40000, "it hears the first sentence on arrival"); await sleep(800); await shot("first-words", ["Close"]);
await click("Close"); await sleep(900); await shot("tokens", ["for you"]);
await click("for you"); await sleep(1200); await shot("abilities", ["Close"]); await click("Close"); await sleep(700);
await shot("talk-button", ["Talk"]); await click("Talk"); await sleep(900);
const inp = await find("Tell it something"); if (inp.asElement()) { await inp.asElement().click(); await page.keyboard.type("帮我去图书馆看看有没有写论文的 workshop", { delay: 15 }); } else log.push("NO TALK INPUT");
await shot("ask", ["Tell it something", "Send"]); await page.keyboard.press("Enter");
await waitText("checked fields", 120000, "trip to the library returns three finds"); await sleep(1500); await shot("three-finds", ["checked fields", "Look again, live"]);
await click("Look again, live"); await sleep(1500); await shot("agent-running", ["Agent is on the page"]);
await waitText("Managed Agent ·", 150000, "Managed Agent re-check returns"); await sleep(600); await shot("agent-result", ["Managed Agent ·"]);
await shot("keep-skip", ["Keep", "Skip"]); await click("Keep"); await sleep(400); await click("Skip"); await sleep(400); await click("Skip");
await waitText("revealed", 30000, "sealed guess revealed"); await sleep(1200); await shot("revealed", ["revealed"]);
await click("Diary"); await sleep(1500); await shot("diary", ["Diary"]);
await click("Talk"); await sleep(900); await shot("attach", ["Attach"]);
const before = await count(" tokens · "); const file = await page.$("input[type=file]"); if (file) { await file.uploadFile("/Users/aisandbox/Documents/gem4/kit/posters/poster-01.jpg"); const t0 = Date.now(); const ok = await page.waitForFunction((b, x) => document.body.innerText.split(x).length - 1 > b, { timeout: 60000 }, before, " tokens · ").then(() => true).catch(() => false); log.push(`${ok ? "ok" : "TIMED OUT"} · poster read and checked · ${((Date.now() - t0) / 1000).toFixed(1)}s`); } else log.push("NO FILE INPUT");
await sleep(1000); await page.evaluate(() => { const el = [...document.querySelectorAll("aside div")].find((d) => d.scrollHeight > d.clientHeight + 40); if (el) el.scrollTop = el.scrollHeight; }); await sleep(500); await shot("poster");
await page.goto(O + "/admin", { waitUntil: "networkidle2" }); await sleep(3000); await shot("admin", ["Data flywheel", "AI performance"]);
fs.writeFileSync(OUT + "log.json", JSON.stringify({ at: new Date().toISOString(), shots, log }, null, 1)); console.log(log.join("\n")); await browser.close();

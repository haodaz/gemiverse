// Screenshots of the first-minute tour in the room, for the walkthrough document.
import { createRequire } from "node:module";
const puppeteer = createRequire("/Users/aisandbox/Documents/vsbp/package.json")("puppeteer");
const OUT = "/Users/aisandbox/Documents/gem4/video/walkthrough/", sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--use-angle=metal", "--enable-webgl", "--ignore-gpu-blocklist"], defaultViewport: { width: 1440, height: 810, deviceScaleFactor: 1 } });
const p = await b.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));
await p.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("gemi.")) localStorage.removeItem(k); localStorage.setItem("gemi.school", "nyu"); localStorage.setItem("gemi.lang", "en"); localStorage.setItem("gemi.me.nyu", JSON.stringify({ name: "Mochi" })); });
await p.goto("http://localhost:3000/room", { waitUntil: "networkidle2", timeout: 90000 }); await p.addStyleTag({ content: "nextjs-portal{display:none!important}" });
await sleep(4200); await p.screenshot({ path: OUT + "t1a.jpg", type: "jpeg", quality: 82 }); await sleep(3600);
const ring = async (name) => { const r = await p.evaluate(() => { const e = [...document.querySelectorAll("button")].find((x) => ["Next", "Start"].includes(x.textContent.trim())); if (!e) return null; const q = e.getBoundingClientRect(); const d = document.createElement("div"); d.className = "wt"; d.style.cssText = `position:fixed;left:${q.x - 8}px;top:${q.y - 8}px;width:${q.width + 16}px;height:${q.height + 16}px;border:5px solid #e11d48;border-radius:30px;z-index:99999;pointer-events:none;box-shadow:0 0 0 3px #fff`; document.body.appendChild(d); return true; }); await p.screenshot({ path: OUT + name, type: "jpeg", quality: 82 }); await p.evaluate(() => document.querySelectorAll(".wt").forEach((x) => x.remove())); return r; };
const next = () => p.evaluate(() => { const e = [...document.querySelectorAll("button")].find((x) => ["Next", "Start"].includes(x.textContent.trim())); e?.click(); return !!e; });
for (let k = 1; k <= 5; k++) { console.log("step", k, await ring(`t${k}.jpg`)); await next(); await sleep(2600); }
await sleep(1500); await p.screenshot({ path: OUT + "t6.jpg", type: "jpeg", quality: 82 });
console.log("after tour, body has talk panel:", await p.evaluate(() => document.body.innerText.includes("Today")), "errors:", errs.join(" | ") || "none"); await b.close();

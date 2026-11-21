// Records clips/agent.mp4: in the room, a find on the desk is re-checked live by the Managed Agent. The wait is not captured.
import fs from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const puppeteer = createRequire("/Users/aisandbox/Documents/vsbp/package.json")("puppeteer");
const B = new URL(".", import.meta.url).pathname, FF = "/Users/aisandbox/Documents/companydata/node_modules/ffmpeg-static/ffmpeg", O = "http://localhost:3000", sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--use-angle=metal", "--enable-webgl", "--ignore-gpu-blocklist"], defaultViewport: { width: 1280, height: 720, deviceScaleFactor: 1.5 } });
const page = await browser.newPage();
await page.goto(O + "/", { waitUntil: "domcontentloaded" });
await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("gemi.")) localStorage.removeItem(k); localStorage.setItem("gemi.school", "nyu"); localStorage.setItem("gemi.lang", "en"); localStorage.setItem("gemi.me.nyu", JSON.stringify({ name: "Mochi", demo: true })); localStorage.setItem("gemi.look.nyu", JSON.stringify({ topColor: "#b5432e" })); });
await page.goto(O + "/room", { waitUntil: "networkidle2", timeout: 90000 }); await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }); await sleep(6000);
const press = (part) => page.evaluate((p) => { const b = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === p || x.textContent.trim().startsWith(p)); if (b) b.click(); return !!b; }, part);
const waitText = (t, ms) => page.waitForFunction((x) => document.body.innerText.includes(x), { timeout: ms }, t).catch(() => console.log("timed out:", t));
console.log("campus", await press("Campus")); await sleep(1500); console.log("library", await press("Library")); await waitText("checked fields", 120000); await sleep(1200);
const shoot = async (sec) => { const fr = [], t0 = Date.now(); while (Date.now() - t0 < sec * 1000) fr.push([Date.now() - t0, await page.screenshot({ type: "jpeg", quality: 90 })]); return { fr, sec }; };
const a = await shoot(1.0); console.log("live", await press("Look again, live")); const b = await shoot(1.4);
await waitText("Managed Agent ·", 150000); await sleep(500);
await page.evaluate(() => { const el = [...document.querySelectorAll("aside div")].find((d) => d.scrollHeight > d.clientHeight + 40); if (el) el.scrollTo({ top: 150, behavior: "smooth" }); });
const c = await shoot(5.5);
const all = []; let base = 0; for (const s of [a, b, c]) { for (const [t, f] of s.fr) all.push([base + t / 1000, f]); base += s.sec; }
const p = spawn(FF, ["-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", "30", "-i", "-", "-vf", "crop=iw*0.62:ih*0.62:iw*0.38:ih*0.14,scale=1920:1080:flags=lanczos", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30", B + "clips/agent.mp4"], { stdio: ["pipe", "inherit", "inherit"] });
let k = 0; for (let i = 0; i < Math.round(base * 30); i++) { const t = i / 30; while (k + 1 < all.length && all[k + 1][0] <= t) k++; await new Promise((r) => (p.stdin.write(all[k][1]) ? r() : p.stdin.once("drain", r))); }
await new Promise((r) => { p.on("close", r); p.stdin.end(); }); await browser.close(); console.log("clips/agent.mp4", base.toFixed(1) + "s");

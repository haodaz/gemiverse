// Puts the long film online: a web-sized copy of each language in public/film/ (under 50 MB each, so the repo and the host
// accept them), subtitles as WebVTT, the cover as a poster, and a small player page at /film/watch.html.
// node scripts/video/long/publish.mjs
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const B = new URL(".", import.meta.url).pathname, FF = "/Users/aisandbox/Documents/companydata/node_modules/ffmpeg-static/ffmpeg", V = "/Users/aisandbox/Documents/gem4/video/", P = `${B}../../../public/film/`;
const chapters = {}, sizes = {};
for (const l of ["zh", "en"]) { const src = `${V}gemiverse-film-${l}.mp4`, out = `${P}gemiverse-film-${l}.mp4`;
  for (const crf of [27, 29, 31]) { execFileSync(FF, ["-loglevel", "error", "-y", "-i", src, "-vf", "scale=1280:720:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "96k", "-ac", "1", "-movflags", "+faststart", out], { stdio: "inherit" }); sizes[l] = fs.statSync(out).size / 1e6; if (sizes[l] < 48) break; }
  const srt = fs.readFileSync(`${V}gemiverse-film-${l}.srt`, "utf8"); fs.writeFileSync(`${P}gemiverse-film-${l}.vtt`, "WEBVTT\n\n" + srt.replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, "$1.$2").replace(/^\d+\n(?=\d\d:)/gm, ""));
  execFileSync(FF, ["-loglevel", "error", "-y", "-i", `${V}gemiverse-film-${l}-cover.png`, "-vf", "scale=1280:720", "-q:v", "3", `${P}gemiverse-film-${l}-cover.jpg`]);
  chapters[l] = fs.readFileSync(`${V}gemiverse-film-${l}.chapters.txt`, "utf8").trim().split("\n").map((x) => { const [t, ...n] = x.split(" "), [m, s] = t.split(":").map(Number); return [m * 60 + s, n.join(" ")]; }); }
fs.writeFileSync(`${P}watch.html`, `<!doctype html>
<html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gemiverse · the engine that projects an AI into a space</title>
<meta property="og:title" content="Gemiverse"><meta property="og:image" content="/film/gemiverse-film-zh-cover.jpg">
<style>body{margin:0;background:#faf8f5;color:#2b2536;font:16px/1.6 "PingFang SC","Helvetica Neue",sans-serif}main{max-width:1100px;margin:0 auto;padding:28px 20px 60px}
h1{font-size:30px;margin:0}h1 b:first-child{color:#d9891c}h1 b:last-child{color:#7c4dce}.top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.lang button{border:3px solid #2b2536;background:#fff;border-radius:999px;padding:6px 18px;font:inherit;font-weight:700;cursor:pointer}.lang button[aria-pressed=true]{background:#2b2536;color:#fff}
video{width:100%;aspect-ratio:16/9;border-radius:18px;border:3px solid #2b2536;background:#1b1524;display:block}p{color:#5f576c;margin:14px 2px}
ol{list-style:none;padding:0;margin:8px 0 0;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}ol button{width:100%;text-align:left;border:2px solid #e6dfd3;background:#fff;border-radius:12px;padding:8px 12px;font:inherit;cursor:pointer}ol button span{color:#7c4dce;font-weight:700;margin-right:8px}ol button:hover{border-color:#7c4dce}</style>
<main><div class="top"><h1><b>Gemi</b><b>verse</b> <span id="sub" style="font-size:18px;font-weight:600;color:#5f576c"></span></h1><div class="lang"><button id="bzh">中文</button> <button id="ben">English</button></div></div>
<video id="v" controls playsinline preload="metadata"></video><p id="note"></p><ol id="ch"></ol></main>
<script>
const CH = ${JSON.stringify(chapters)}, T = { zh: ["把 AI 投射进空间的引擎", "Gemiverse 不是一个产品的名字，而是一套方法：给 AI 一个它能改变的空间，一个它能感受的世界。本片讲它的第一个样子：大学校园。学习部分与换脑实验使用模拟学生。", "字幕"], en: ["an engine that projects an AI into a space", "Gemiverse is not the name of a product but a method: give an AI a space it can change and a world it can sense. This film shows its first form: a college campus. The learning and mind-swap runs use a simulated student.", "Subtitles"] };
const v = document.getElementById("v"), fmt = (s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
function show(l) { const at = v.currentTime || 0; v.innerHTML = '<source src="/film/gemiverse-film-' + l + '.mp4" type="video/mp4"><track kind="subtitles" srclang="' + l + '" label="' + T[l][2] + '" src="/film/gemiverse-film-' + l + '.vtt" default>'; v.poster = "/film/gemiverse-film-" + l + "-cover.jpg"; v.load(); if (at > 1) v.addEventListener("loadedmetadata", () => (v.currentTime = 0), { once: true });
  document.getElementById("sub").textContent = T[l][0]; document.getElementById("note").textContent = T[l][1]; document.documentElement.lang = l;
  document.getElementById("ch").innerHTML = CH[l].map(([s, n]) => '<li><button data-t="' + s + '"><span>' + fmt(s) + "</span>" + n + "</button></li>").join("");
  for (const b of ["zh", "en"]) document.getElementById("b" + b).setAttribute("aria-pressed", b === l); try { localStorage.setItem("film.lang", l); } catch {} }
document.getElementById("ch").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { v.currentTime = +b.dataset.t; v.play(); } });
document.getElementById("bzh").onclick = () => show("zh"); document.getElementById("ben").onclick = () => show("en");
let l = new URLSearchParams(location.search).get("lang"); try { l = l || localStorage.getItem("film.lang"); } catch {} show(l === "en" || l === "zh" ? l : navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en");
</script></html>
`);
console.log("published", Object.entries(sizes).map(([l, s]) => `${l} ${s.toFixed(1)} MB`).join(" · "));

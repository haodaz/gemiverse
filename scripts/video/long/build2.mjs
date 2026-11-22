// Builds the second cut of the long film for one language from film.mjs: renders the drawn parts frame by frame, fits the
// story clips and product clips to their lines, joins everything with soft fades, lays the voice and a quiet Lyria track,
// and writes subtitles, chapters and a sheet of frames to look at.    node scripts/video/long/build2.mjs <zh|en>
import fs from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { plan, TEMPO, LEAD } from "./film.mjs";
const puppeteer = createRequire("/Users/aisandbox/Documents/vsbp/package.json")("puppeteer");
const B = new URL(".", import.meta.url).pathname, FF = "/Users/aisandbox/Documents/companydata/node_modules/ffmpeg-static/ffmpeg", lang = process.argv[2], FPS = 15;
const OUT = "/Users/aisandbox/Documents/gem4/video/", W = `${B}work2-${lang}/`; fs.mkdirSync(W, { recursive: true });
const run = (a) => execFileSync(FF, ["-loglevel", "error", "-y", ...a], { stdio: "inherit" });
const ENC = ["-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-r", "30", "-an"], CREAM = "0xfaf8f5";
const VOL = { zh: 1, en: 2 }, REUSE = !!process.env.REUSE_VIDEO;   // the English voice is recorded about 6 dB lower; REUSE_VIDEO=1 redoes only sound and text
const P = plan(lang), total = P.at(-1).start + P.at(-1).dur, list = [], missing = [];
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", defaultViewport: { width: 1920, height: 1080 } });
const page = await browser.newPage(); page.on("pageerror", (e) => console.log("page error:", e.message.slice(0, 160)));
await page.goto(`http://localhost:3000/film/long.html?s=hook&t=0&lang=${lang}`, { waitUntil: "networkidle2" });
for (const s of P) for (const p of s.parts) { if (REUSE) break; const out = `${W}${p.key}.mp4`, D = p.dur, fade = (d) => `fade=t=in:st=0:d=0.3:color=${CREAM},fade=t=out:st=${(d - 0.3).toFixed(2)}:d=0.3:color=${CREAM}`; list.push(`file '${out}'`);
  if (p.kind === "anim") { const N = Math.round(D * FPS); if (p.scene === "card") await page.evaluate((t, bg) => window.setCard(t, bg), p.title, p.bg);
    const ff = spawn(FF, ["-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-", "-vf", ["hook", "card", "end"].includes(p.scene) ? fade(N / FPS) : "null", ...ENC, out], { stdio: ["pipe", "inherit", "inherit"] });
    for (let i = 0; i < N; i++) { await page.evaluate((id, t, T, lang) => window.seek(id, t, T, lang), p.scene, i / FPS, D, lang); if (i === 0) await new Promise((r) => setTimeout(r, 700)); const buf = await page.screenshot({ type: "jpeg", quality: 90 }); await new Promise((r) => (ff.stdin.write(buf) ? r() : ff.stdin.once("drain", r))); }
    await new Promise((r) => { ff.on("close", r); ff.stdin.end(); }); continue; }
  if (p.kind === "morph") {   // the photographed world dissolves into the drawn one (or back): two clips, a slow cross-dissolve in the middle
    const [x, y] = p.morph.split(">"), X = 1.4, D1 = D * 0.45 + X / 2, D2 = D - D1 + X, prep = (d) => `setpts=${Math.min(1.9, Math.max(1, d / 5)).toFixed(3)}*PTS,tpad=stop_mode=clone:stop_duration=90,fps=30,scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080,setsar=1,trim=duration=${d.toFixed(3)},setpts=PTS-STARTPTS`;
    run(["-i", `${B}art/v-${x}.mp4`, "-i", `${B}art/v-${y}.mp4`, "-filter_complex", `[0:v]${prep(D1)}[a];[1:v]${prep(D2)}[b];[a][b]xfade=transition=fade:duration=${X}:offset=${(D1 - X).toFixed(3)},${fade(D)}`, "-t", D.toFixed(3), ...ENC, out]); continue; }
  if (p.kind === "zoom") {   // rest on the clip's last picture and move in on the part being talked about
    const png = `${W}${p.key}.png`, N = Math.round(D * 30), [fx, fy, z] = p.at ?? [0.9, 0.5, 1.8]; run(["-sseof", "-0.3", "-i", `${B}clips-${lang}/${p.zoom}.mp4`, "-frames:v", "1", png]);
    run(["-loop", "1", "-i", png, "-vf", `scale=3840:2160:flags=lanczos,zoompan=z='1+${(z - 1).toFixed(2)}*min(1,on/${Math.round(N * 0.45)})':x='(iw-iw/zoom)*${fx}':y='(ih-ih/zoom)*${fy}':d=${N}:s=1920x1080:fps=30,setsar=1`, "-t", D.toFixed(3), ...ENC, out]); continue; }
  const src = p.kind === "story" ? `${B}art/v-${p.story}.mp4` : `${B}clips-${lang}/${p.clip}.mp4`;
  if (!fs.existsSync(src)) { missing.push(src.split("/").slice(-2).join("/")); run(["-f", "lavfi", "-i", `color=c=${CREAM}:s=1920x1080:r=30`, "-t", D.toFixed(3), ...ENC, out]); continue; }
  // a drawn clip is 5 s long: play it slower (at most 1.9 times) so it fills its line, then rest on its last picture
  const slow = p.kind === "story" ? Math.min(1.9, Math.max(1, D / 5)) : 1;
  run(["-i", src, "-vf", `setpts=${slow.toFixed(3)}*PTS,tpad=stop_mode=clone:stop_duration=90,fps=30,scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080,setsar=1,${fade(D)}`, "-t", D.toFixed(3), ...ENC, out]); }
await browser.close();
if (!REUSE) fs.writeFileSync(`${W}list.txt`, list.join("\n")); if (!REUSE) run(["-f", "concat", "-safe", "0", "-i", `${W}list.txt`, "-c", "copy", `${W}video.mp4`]);
const voiced = P.filter((s) => s.voice && fs.existsSync(`${B}tts2-${lang}/${s.id}.wav`)), ins = voiced.flatMap((s) => ["-i", `${B}tts2-${lang}/${s.id}.wav`]), music = `${B}../../../public/music/campus-walk.mp3`;
const fc = voiced.map((s, i) => `[${i}:a]atempo=${TEMPO[lang]},volume=${VOL[lang]},aresample=44100,adelay=${Math.round((s.start + LEAD) * 1000)}:all=1[v${i}]`).join(";") + `;[${voiced.length}:a]aresample=44100,volume=0.085,afade=t=in:d=2,afade=t=out:st=${(total - 4).toFixed(1)}:d=4[m];` + voiced.map((_, i) => `[v${i}]`).join("") + `[m]amix=inputs=${voiced.length + 1}:normalize=0:duration=longest,alimiter=limit=0.95[a]`;
run([...ins, "-stream_loop", "-1", "-i", music, "-filter_complex", fc, "-map", "[a]", "-t", total.toFixed(2), "-c:a", "aac", "-b:a", "192k", `${W}audio.m4a`]);
const name = `gemiverse-film-${lang}`; run(["-i", `${W}video.mp4`, "-i", `${W}audio.m4a`, "-c", "copy", "-movflags", "+faststart", `${OUT}${name}.mp4`]);
const durs = Object.fromEntries(JSON.parse(fs.readFileSync(`${B}tts2-${lang}/durations.json`, "utf8")).map((d) => [d.id, d.dur / TEMPO[lang]]));
const stamp = (t) => { const ms = Math.round(t * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };
const cut = (t) => { const max = lang === "zh" ? 24 : 78, bits = lang === "zh" ? t.match(/[^，。！？；：]+[，。！？；：]?/g) : t.match(/[^,.;:?!]+[,.;:?!]?\s*/g); const out = []; let cur = ""; for (const b of bits ?? [t]) { if ((cur + b).length > max && cur) { out.push(cur); cur = ""; } cur += b; } if (cur) out.push(cur); return out.map((x) => x.trim().replace(/[，。；：,]$/, "")); };
let srt = "", k = 1; for (const s of voiced) { const lines = cut(s.text), chars = lines.reduce((a, l) => a + l.length, 0); let t = s.start + LEAD; for (const l of lines) { const d = durs[s.id] * l.length / chars; srt += `${k++}\n${stamp(t)} --> ${stamp(t + d - 0.05)}\n${l}\n\n`; t += d; } }
fs.writeFileSync(`${OUT}${name}.srt`, srt);
fs.writeFileSync(`${OUT}${name}.chapters.txt`, P.filter((s) => s.title).map((s, i) => ({ ...s, start: i ? s.start : 0 })).map((s) => `${Math.floor(s.start / 60)}:${String(Math.floor(s.start % 60)).padStart(2, "0")} ${s.title.replace(/^.*·\s*/, "")}`).join("\n") + "\n");
run(["-ss", "5", "-i", `${OUT}${name}.mp4`, "-frames:v", "1", `${OUT}${name}-cover.png`]);
const N = 30; for (let i = 0; i < N; i++) run(["-ss", ((i + 0.5) * total / N).toFixed(2), "-i", `${OUT}${name}.mp4`, "-frames:v", "1", "-vf", "scale=640:360", `${W}f${i}.jpg`]);
run([...Array.from({ length: N }, (_, i) => ["-i", `${W}f${i}.jpg`]).flat(), "-filter_complex", [0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4, 5].map((c) => `[${r * 6 + c}]`).join("") + `hstack=inputs=6[r${r}]`).join(";") + ";[r0][r1][r2][r3][r4]vstack=inputs=5", "-frames:v", "1", `${OUT}${name}-check.jpg`]);
console.log(lang, "film", (total / 60).toFixed(2), "min ·", list.length, "parts ·", voiced.length, "voices", missing.length ? "· MISSING: " + missing.join(", ") : "");

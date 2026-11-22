// Puts the long film together for one language: drawn scenes and product clips in timeline order, the voice on each scene,
// a quiet Lyria track underneath, and a subtitle file beside it (not burned in).   node scripts/video/long/assemble.mjs <zh|en>
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { plan, TEMPO, LEAD } from "./plan.mjs";
const B = new URL(".", import.meta.url).pathname, FF = "/Users/aisandbox/Documents/companydata/node_modules/ffmpeg-static/ffmpeg", lang = process.argv[2];
const OUT = "/Users/aisandbox/Documents/gem4/video/", W = `${B}work-${lang}/`; fs.rmSync(W, { recursive: true, force: true }); fs.mkdirSync(W, { recursive: true });
const run = (a) => execFileSync(FF, ["-loglevel", "error", "-y", ...a], { stdio: "inherit" });
const P = plan(lang), ENC = ["-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-r", "30", "-an"], list = [], missing = [];
let n = 0; for (const s of P) for (const p of s.parts) { const out = `${W}${String(n++).padStart(3, "0")}.mp4`, src = p.kind === "anim" ? `${B}scenes-${lang}/${p.scene}.mp4` : `${B}clips-${lang}/${p.clip}.mp4`;
  if (!fs.existsSync(src)) { missing.push(src.split("/").slice(-2).join("/")); run(["-f", "lavfi", "-i", "color=c=0xfaf8f5:s=1920x1080:r=30", "-t", p.dur.toFixed(3), ...ENC, out]); }
  else run(["-i", src, "-vf", "tpad=stop_mode=clone:stop_duration=90,fps=30,scale=1920:1080:flags=lanczos,setsar=1", "-t", p.dur.toFixed(3), ...ENC, out]);
  list.push(`file '${out}'`); }
fs.writeFileSync(`${W}list.txt`, list.join("\n")); run(["-f", "concat", "-safe", "0", "-i", `${W}list.txt`, "-c", "copy", `${W}video.mp4`]);
const total = P.at(-1).start + P.at(-1).dur, voiced = P.filter((s) => s.voice && fs.existsSync(`${B}tts-${lang}/${s.id}.wav`));
const ins = voiced.flatMap((s) => ["-i", `${B}tts-${lang}/${s.id}.wav`]), music = `${B}../../../public/music/campus-walk.mp3`;
const fc = voiced.map((s, i) => `[${i}:a]atempo=${TEMPO[lang]},aresample=44100,adelay=${Math.round((s.start + LEAD) * 1000)}:all=1[v${i}]`).join(";") + `;[${voiced.length}:a]aresample=44100,volume=0.085,afade=t=in:d=2,afade=t=out:st=${(total - 4).toFixed(1)}:d=4[m];` + voiced.map((_, i) => `[v${i}]`).join("") + `[m]amix=inputs=${voiced.length + 1}:normalize=0:duration=longest,alimiter=limit=0.95[a]`;
run([...ins, "-stream_loop", "-1", "-i", music, "-filter_complex", fc, "-map", "[a]", "-t", total.toFixed(2), "-c:a", "aac", "-b:a", "192k", `${W}audio.m4a`]);
run(["-i", `${W}video.mp4`, "-i", `${W}audio.m4a`, "-c", "copy", "-movflags", "+faststart", `${OUT}gemiverse-long-${lang}.mp4`]);
// subtitles: each scene's text cut at punctuation, timed by share of characters
const text = Object.fromEntries(JSON.parse(fs.readFileSync(`${B}narration.${lang}.json`, "utf8")).map((s) => [s.id, s.text])), durs = Object.fromEntries(JSON.parse(fs.readFileSync(`${B}tts-${lang}/durations.json`, "utf8")).map((d) => [d.id, d.dur / TEMPO[lang]]));
const stamp = (t) => { const ms = Math.round(t * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };
const cut = (t) => { const max = lang === "zh" ? 24 : 78, bits = lang === "zh" ? t.match(/[^，。！？；：]+[，。！？；：]?/g) : t.match(/[^,.;:?!]+[,.;:?!]?\s*/g); const out = []; let cur = ""; for (const b of bits ?? [t]) { if ((cur + b).length > max && cur) { out.push(cur); cur = ""; } cur += b; } if (cur) out.push(cur); return out.map((x) => x.trim().replace(/[，。；：,]$/, "")); };
let srt = "", k = 1; for (const s of voiced) { const lines = cut(text[s.id]), chars = lines.reduce((a, l) => a + l.length, 0); let t = s.start + LEAD; for (const l of lines) { const d = durs[s.id] * l.length / chars; srt += `${k++}\n${stamp(t)} --> ${stamp(t + d - 0.05)}\n${l}\n\n`; t += d; } }
fs.writeFileSync(`${OUT}gemiverse-long-${lang}.srt`, srt);
// chapters for the description (YouTube needs the first at 0:00 and each at least 10 s long, so the cover belongs to the first), and a sheet of 24 frames to look at before sending
const names = { s1: ["观察", "Observation"], s2: ["问题", "The question"], s3: ["三个假设", "Three hypotheses"], s4: ["它是什么", "What it is"], s5a: ["预算：星星就是 token", "The budget: stars are tokens"], s6: ["方法：每个字段过一道门", "Method: a gate on every field"], s7a: ["实验和结果", "Experiment and results"], s8: ["它怎么学你", "How it learns you"], s9: ["换一个脑子", "Swap the mind"], s10: ["它打开了什么，还没做的", "What it opens, what is not done"], s11: ["结尾", "Closing"] };
fs.writeFileSync(`${OUT}gemiverse-long-${lang}.chapters.txt`, P.filter((s) => names[s.id]).map((s) => ({ ...s, start: s.id === "s1" ? 0 : s.start })).map((s) => `${Math.floor(s.start / 60)}:${String(Math.floor(s.start % 60)).padStart(2, "0")} ${names[s.id][lang === "zh" ? 0 : 1]}`).join("\n") + "\n");
const N = 24; for (let i = 0; i < N; i++) run(["-ss", ((i + 0.5) * total / N).toFixed(2), "-i", `${OUT}gemiverse-long-${lang}.mp4`, "-frames:v", "1", "-vf", "scale=640:360", `${W}f${i}.jpg`]);
run([...Array.from({ length: N }, (_, i) => ["-i", `${W}f${i}.jpg`]).flat(), "-filter_complex", [0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4, 5].map((c) => `[${r * 6 + c}]`).join("") + `hstack=inputs=6[r${r}]`).join(";") + ";[r0][r1][r2][r3]vstack=inputs=4", "-frames:v", "1", `${OUT}gemiverse-long-${lang}-check.jpg`]);
console.log(lang, "film", (total / 60).toFixed(2), "min ·", list.length, "parts ·", voiced.length, "voices", missing.length ? "· MISSING: " + missing.join(", ") : "");

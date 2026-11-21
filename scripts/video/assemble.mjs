// Joins seg/s1..s8.mp4, lays the narration over it, writes an .srt beside it (not burned in), and saves a cover frame.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const B = new URL(".", import.meta.url).pathname, FF = "/Users/aisandbox/Documents/companydata/node_modules/ffmpeg-static/ffmpeg";
const OUT = "/Users/aisandbox/Documents/gem4/video", NAME = "gemiverse-1min", TEMPO = 1.08, LEAD = 0.2;
const run = (a) => execFileSync(FF, ["-loglevel", "error", "-y", ...a], { stdio: "inherit" });
const durOf = (f) => { try { execFileSync(FF, ["-i", f], { stdio: "pipe" }); } catch (e) { const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(e.stderr.toString()); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0; } return 0; };
const narr = JSON.parse(fs.readFileSync(B + "narration.json", "utf8")); fs.mkdirSync(B + "out", { recursive: true });
let t = 0; const tl = narr.map((n) => { const id = n.id.replace("n", "s"), d = durOf(`${B}seg/${id}.mp4`), s = { id, wav: `${B}tts/${n.id}.wav`, text: n.text, start: t, dur: d, voice: durOf(`${B}tts/${n.id}.wav`) / TEMPO }; t += d; return s; });
fs.writeFileSync(B + "out/list.txt", tl.map((s) => `file '${B}seg/${s.id}.mp4'`).join("\n"));
run(["-f", "concat", "-safe", "0", "-i", B + "out/list.txt", "-c", "copy", B + "out/video.mp4"]);
const ts = (x) => { const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), s = x % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`.replace(".", ","); };
const cues = []; let k = 1;
for (const s of tl) { const parts = s.text.split(/(?<=[.:?!])\s+/).filter(Boolean), tot = parts.reduce((a, p) => a + p.length, 0); let at = s.start + LEAD;
  for (const p of parts) { const d = (s.voice * p.length) / tot; cues.push(`${k++}\n${ts(at)} --> ${ts(at + d - 0.05)}\n${p.trim()}\n`); at += d; } }
fs.writeFileSync(`${OUT}/${NAME}.srt`, cues.join("\n"));
const inputs = ["-i", B + "out/video.mp4"], fl = []; let mix = "";
tl.forEach((s, i) => { inputs.push("-i", s.wav); const ms = Math.round((s.start + LEAD) * 1000); fl.push(`[${i + 1}:a]atempo=${TEMPO},aresample=48000,adelay=${ms}|${ms}[a${i}]`); mix += `[a${i}]`; });
const final = `${OUT}/${NAME}.mp4`;
// A quiet bed of music under the voice: one of the tracks Lyria wrote today, looped, faded in and out.
const MUSIC = B + "../../public/music/room-morning.mp3"; inputs.push("-stream_loop", "-1", "-i", MUSIC);
fl.push(`[${tl.length + 1}:a]aresample=48000,volume=0.11,afade=t=in:d=1.2,afade=t=out:st=${(t - 2.2).toFixed(2)}:d=2.2[bed]`);
run([...inputs, "-filter_complex", fl.join(";") + `;${mix}amix=inputs=${tl.length}:normalize=0,volume=2.0[voice];[voice][bed]amix=inputs=2:normalize=0,alimiter=limit=0.95[aout]`, "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-t", t.toFixed(2), "-movflags", "+faststart", final]);
run(["-ss", "1", "-i", B + "out/video.mp4", "-frames:v", "1", `${OUT}/${NAME}-cover.png`]);
console.log("done", final, (fs.statSync(final).size / 1048576).toFixed(1) + "MB", t.toFixed(1) + "s"); for (const s of tl) console.log(" ", s.id, s.start.toFixed(1), "+" + s.dur.toFixed(1), "voice", s.voice.toFixed(1));

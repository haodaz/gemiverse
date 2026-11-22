// Voices for the second cut, read from film.mjs. Chinese: DashScope qwen3-tts-flash (Cherry). English: OpenAI gpt-4o-mini-tts (sage).
// Both keys are Elodie's own, read from env files outside this repo; she approved this use on 22 Nov. Never printed.
// node scripts/video/long/voice.mjs <zh|en> [line ids to redo...]
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { FILM } from "./film.mjs";
const B = new URL(".", import.meta.url).pathname, FF = "/Users/aisandbox/Documents/companydata/node_modules/ffmpeg-static/ffmpeg";
const envKey = (file, name) => fs.readFileSync(file, "utf8").split("\n").find((l) => l.startsWith(name + "=")).split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
const durOf = (f) => { try { execFileSync(FF, ["-i", f], { stdio: "pipe" }); } catch (e) { const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(e.stderr.toString()); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0; } return 0; };
const [lang, ...redo] = process.argv.slice(2), dir = `${B}tts2-${lang}/`; fs.mkdirSync(dir, { recursive: true });
async function say(text, out) {
  if (lang === "en") { const r = await fetch("https://api.openai.com/v1/audio/speech", { method: "POST", headers: { authorization: `Bearer ${envKey("/Users/aisandbox/Documents/companydata/.env.local", "OPENAI_API_KEY")}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: "sage", input: text, response_format: "wav", instructions: "Warm, calm and clear, like a young founder telling a friend the story of a student named Mia and her small AI, Mochi. Unhurried and natural, with small pauses between sentences. Never like an advertisement or a news reader." }) });
    if (!r.ok) throw new Error(`openai ${r.status} ${(await r.text()).slice(0, 120)}`); fs.writeFileSync(out, Buffer.from(await r.arrayBuffer())); return; }
  const parts = []; let cur = ""; for (const s of text.match(/[^。！？；]+[。！？；]?/g) ?? [text]) { if ((cur + s).length > 150 && cur) { parts.push(cur); cur = ""; } cur += s; } if (cur) parts.push(cur);
  const files = []; for (let i = 0; i < parts.length; i++) { const f = `${out}.p${i}.wav`; let url;
    for (let k = 0; k < 4 && !url; k++) { const j = await (await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation", { method: "POST", headers: { Authorization: `Bearer ${envKey("/Users/aisandbox/Documents/zhiji-yida/.env.local", "DASHSCOPE_API_KEY")}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "qwen3-tts-flash", input: { text: parts[i], voice: "Cherry" } }) })).json(); url = j.output?.audio?.url; if (!url) { console.log("  retry", JSON.stringify(j).slice(0, 120)); await new Promise((r) => setTimeout(r, 7000)); } }
    if (!url) throw new Error("no audio"); fs.writeFileSync(f, Buffer.from(await (await fetch(url)).arrayBuffer())); files.push(f); await new Promise((r) => setTimeout(r, 1200)); }
  fs.writeFileSync(out + ".txt", files.map((f) => `file '${f}'`).join("\n")); execFileSync(FF, ["-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", out + ".txt", "-ar", "24000", "-ac", "1", out]); for (const f of [...files, out + ".txt"]) fs.unlinkSync(f); }
const out = []; for (const s of FILM) { if (!s.id || !s[lang]) continue; const f = `${dir}${s.id}.wav`;
  if (!fs.existsSync(f) || redo.includes(s.id)) { try { await say(s[lang], f); } catch (e) { console.log("FAIL", s.id, e.message); continue; } }
  const d = durOf(f); out.push({ id: s.id, dur: d }); console.log(s.id, d.toFixed(1) + "s"); }
fs.writeFileSync(`${dir}durations.json`, JSON.stringify(out)); console.log(lang, "total voice", out.reduce((a, b) => a + b.dur, 0).toFixed(0) + "s");

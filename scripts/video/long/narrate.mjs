// The long film's voices. Reads script.md (one "- 中：" and one "- EN:" line per scene), writes narration.zh.json / narration.en.json,
// then speaks each scene: Chinese with DashScope qwen3-tts-flash (voice Cherry; the older name qwen-tts no longer exists), English with OpenAI gpt-4o-mini-tts (voice sage).
// Both keys are Elodie's own and are read from env files outside this repo; she approved this use on 22 Nov. Never printed.
// node scripts/video/long/narrate.mjs [zh|en] [scene ids to redo...]
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const B = new URL(".", import.meta.url).pathname, FF = "/Users/aisandbox/Documents/companydata/node_modules/ffmpeg-static/ffmpeg";
const envKey = (file, name) => fs.readFileSync(file, "utf8").split("\n").find((l) => l.startsWith(name + "=")).split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
const durOf = (f) => { try { execFileSync(FF, ["-i", f], { stdio: "pipe" }); } catch (e) { const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(e.stderr.toString()); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0; } return 0; };
// parse
const md = fs.readFileSync(B + "script.md", "utf8"), zh = [], en = []; let id = null;
for (const line of md.split("\n")) { const h = /^#{2,3}\s*(\d+[a-d]?)[.．\s]/.exec(line) ?? /^(\d+[a-d])\.\s/.exec(line); if (h) id = "s" + h[1];
  const add = (arr, text) => { const t = text.trim(); if (!t || /^[（(]/.test(t)) return; const last = arr[arr.length - 1]; if (last && last.id === id) last.text += (arr === zh ? "" : " ") + t; else arr.push({ id, text: t }); };
  let m; if ((m = /^- 中：(.+)$/.exec(line))) add(zh, m[1]); else if ((m = /^- EN:\s*(.+)$/.exec(line))) add(en, m[1]);
  else if ((m = /^- 必须说的局限[^：]*：(.+?)\s\/\s(.+)$/.exec(line))) { add(zh, m[1]); add(en, m[2]); } }
const clean = (t) => t.replace(/【[^】]*】/g, "").replace(/\[[^\]]*\]/g, "").trim();
for (const a of [zh, en]) for (const s of a) s.text = clean(s.text);
fs.writeFileSync(B + "narration.zh.json", JSON.stringify(zh, null, 1)); fs.writeFileSync(B + "narration.en.json", JSON.stringify(en, null, 1));
console.log("scenes zh", zh.length, zh.reduce((a, s) => a + s.text.length, 0), "chars | en", en.length, en.reduce((a, s) => a + s.text.split(/\s+/).length, 0), "words");
const [lang, ...redo] = process.argv.slice(2); if (!lang) process.exit(0);
const segs = lang === "zh" ? zh : en, dir = `${B}tts-${lang}/`; fs.mkdirSync(dir, { recursive: true });
async function say(text, out) {
  if (lang === "en") { const r = await fetch("https://api.openai.com/v1/audio/speech", { method: "POST", headers: { authorization: `Bearer ${envKey("/Users/aisandbox/Documents/companydata/.env.local", "OPENAI_API_KEY")}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: "sage", input: text, response_format: "wav", instructions: "Warm, calm and clear, like a young researcher explaining her own project to a curious friend. Unhurried, natural, never like an advertisement or a news reader. Slight pauses between sentences." }) });
    if (!r.ok) throw new Error(`openai ${r.status} ${(await r.text()).slice(0, 120)}`); fs.writeFileSync(out, Buffer.from(await r.arrayBuffer())); return; }
  // qwen-tts takes short inputs: speak sentence groups of up to ~150 characters and join them
  const parts = []; let cur = ""; for (const s of text.match(/[^。！？；]+[。！？；]?/g) ?? [text]) { if ((cur + s).length > 150 && cur) { parts.push(cur); cur = ""; } cur += s; } if (cur) parts.push(cur);
  const files = []; for (let i = 0; i < parts.length; i++) { const f = `${out}.p${i}.wav`; let url;
    for (let k = 0; k < 3 && !url; k++) { const j = await (await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation", { method: "POST", headers: { Authorization: `Bearer ${envKey("/Users/aisandbox/Documents/zhiji-yida/.env.local", "DASHSCOPE_API_KEY")}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "qwen3-tts-flash", input: { text: parts[i], voice: "Cherry" } }) })).json(); url = j.output?.audio?.url; if (!url) { console.log("  retry", JSON.stringify(j).slice(0, 140)); await new Promise((r) => setTimeout(r, 6000)); } } await new Promise((r) => setTimeout(r, 1200));
    if (!url) throw new Error("qwen-tts gave no audio"); fs.writeFileSync(f, Buffer.from(await (await fetch(url)).arrayBuffer())); files.push(f); }
  fs.writeFileSync(out + ".txt", files.map((f) => `file '${f}'`).join("\n")); execFileSync(FF, ["-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", out + ".txt", "-ar", "24000", "-ac", "1", out]); for (const f of [...files, out + ".txt"]) fs.unlinkSync(f); }
const out = []; for (const s of segs) { const f = `${dir}${s.id}.wav`; if (!s.text) continue;
  if (!fs.existsSync(f) || redo.includes(s.id)) { try { await say(s.text, f); } catch (e) { console.log("FAIL", s.id, e.message); continue; } }
  const d = durOf(f); out.push({ id: s.id, dur: d, chars: s.text.length }); console.log(s.id, d.toFixed(1) + "s"); }
fs.writeFileSync(`${dir}durations.json`, JSON.stringify(out)); console.log(lang, "total voice", out.reduce((a, b) => a + b.dur, 0).toFixed(0) + "s");

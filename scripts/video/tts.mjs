// Narration for the one-minute video. English voice from OpenAI gpt-4o-mini-tts; writes tts/<id>.wav and tts/durations.json.
// The key is read from a local env file outside this repo and never printed.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const B = new URL(".", import.meta.url).pathname, FF = "/Users/aisandbox/Documents/companydata/node_modules/ffmpeg-static/ffmpeg";
const KEY = fs.readFileSync("/Users/aisandbox/Documents/companydata/.env.local", "utf8").split("\n").find((l) => l.startsWith("OPENAI_API_KEY=")).split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
const segs = JSON.parse(fs.readFileSync(B + "narration.json", "utf8")); fs.mkdirSync(B + "tts", { recursive: true });
const durOf = (f) => { try { execFileSync(FF, ["-i", f], { stdio: "pipe" }); } catch (e) { const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(e.stderr.toString()); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0; } return 0; };
const out = [];
for (const s of segs) { const f = `${B}tts/${s.id}.wav`;
  if (!fs.existsSync(f) || process.argv.includes(s.id)) { const r = await fetch("https://api.openai.com/v1/audio/speech", { method: "POST", headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: "sage", input: s.text, response_format: "wav", instructions: "Warm, calm and clear, like a student explaining her own project to a friend. A natural, unhurried but efficient pace. Not an announcer." }) });
    if (!r.ok) { console.log("fail", s.id, r.status, (await r.text()).slice(0, 160)); continue; } fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); }
  const dur = durOf(f); out.push({ id: s.id, dur }); console.log(s.id, dur.toFixed(2) + "s"); }
fs.writeFileSync(B + "tts/durations.json", JSON.stringify(out)); console.log("total voice", out.reduce((a, b) => a + b.dur, 0).toFixed(1) + "s");

// Ask Google's Lyria for a short music clip and save it as MP3. Run: node scripts/art/lyria.mjs <name> "<prompt>"
import { readFileSync, writeFileSync } from "node:fs";
const key = readFileSync(new URL("../../.env.local", import.meta.url), "utf8").match(/^GEMINI_API_KEY=(.+)$/m)[1].trim();
const [name, prompt, model = "lyria-3-clip-preview"] = process.argv.slice(2);
const t0 = Date.now();
const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ model, input: prompt }) });
const json = await res.json();
const audio = (json.steps ?? []).flatMap((s) => s.content ?? []).find((c) => c.type === "audio");
if (!audio) { console.log("no audio", name, res.status, JSON.stringify(json).slice(0, 300)); process.exit(1); }
writeFileSync(new URL(`../../public/music/${name}.mp3`, import.meta.url), Buffer.from(audio.data, "base64"));
writeFileSync(new URL(`../../public/music/${name}.meta.json`, import.meta.url), JSON.stringify({ model, prompt, usage: json.usage, ms: Date.now() - t0, made_at: new Date().toISOString() }, null, 1));
console.log("saved", name, Buffer.from(audio.data, "base64").length, "bytes", Date.now() - t0, "ms");

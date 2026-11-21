// Ask Gemini 4 Neon to draw an asset as SVG code and save it. Run: node scripts/art/neon-svg.mjs <name> "<prompt>" [thinking]
import { readFileSync, writeFileSync } from "node:fs";
const key = readFileSync(new URL("../../.env.local", import.meta.url), "utf8").match(/^GEMINI_API_KEY=(.+)$/m)[1].trim();
const [name, prompt, thinking = "medium"] = process.argv.slice(2);
const t0 = Date.now(), H = { "content-type": "application/json", "x-goog-api-key": key }, BASE = "https://generativelanguage.googleapis.com/v1beta/interactions";
// background mode + polling, so a long drawing cannot hit the five-minute request timeout
let res = await fetch(BASE, { method: "POST", headers: H, body: JSON.stringify({ model: "gemini-4-neon", generation_config: { thinking_level: thinking }, background: true,
  input: `${prompt}\n\nReturn one complete, valid SVG document and nothing else. No text labels, no letters, no logos, no external images or fonts.` }) });
let json = await res.json();
while (json.status && !["completed", "failed", "cancelled", "incomplete"].includes(json.status)) {
  await new Promise((r) => setTimeout(r, 5000));
  res = await fetch(`${BASE}/${json.id}`, { headers: H }); if (res.ok) json = await res.json();
}
const text = (json.steps ?? []).filter((s) => s.type === "model_output").flatMap((s) => s.content ?? []).map((c) => c.text ?? "").join("");
const svg = text.match(/<svg[\s\S]*<\/svg>/)?.[0];
if (!svg) { console.log("no svg", name, res.status, JSON.stringify(json).slice(0, 300)); process.exit(1); }
writeFileSync(new URL(`../../public/art/${name}.svg`, import.meta.url), svg);
writeFileSync(new URL(`../../public/art/${name}.meta.json`, import.meta.url), JSON.stringify({ model: "gemini-4-neon", thinking, prompt, usage: json.usage, ms: Date.now() - t0, made_at: new Date().toISOString() }, null, 1));
console.log("saved", name, svg.length, "chars", Date.now() - t0, "ms", json.usage?.total_tokens);

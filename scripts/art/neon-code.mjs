// Ask Gemini 4 Neon to write a three.js ES module to a fixed contract and save it. Run: node scripts/art/neon-code.mjs <name> <promptFile>
import { readFileSync, writeFileSync } from "node:fs";
const key = readFileSync(new URL("../../.env.local", import.meta.url), "utf8").match(/^GEMINI_API_KEY=(.+)$/m)[1].trim();
const [name, promptFile, thinking = "medium"] = process.argv.slice(2);
const prompt = readFileSync(promptFile, "utf8");
const t0 = Date.now();
const H = { "content-type": "application/json", "x-goog-api-key": key };
const BASE = "https://generativelanguage.googleapis.com/v1beta/interactions";
// background mode + polling, so a long generation cannot hit the five-minute request timeout
let res = await fetch(BASE, { method: "POST", headers: H, body: JSON.stringify({ model: "gemini-4-neon", generation_config: { thinking_level: thinking }, input: prompt, background: true }) });
let json = await res.json();
while (json.status && !["completed", "failed", "cancelled", "incomplete"].includes(json.status)) {
  await new Promise((r) => setTimeout(r, 5000));
  res = await fetch(`${BASE}/${json.id}`, { headers: H }); if (res.ok) json = await res.json();
}
const text = (json.steps ?? []).filter((s) => s.type === "model_output").flatMap((s) => s.content ?? []).map((c) => c.text ?? "").join("");
// take everything between the first fence and the last one: the code itself may contain template literals
const code = text.replace(/^[\s\S]*?```(?:js|javascript)?\s*\n/, "").replace(/\n```[\s\S]*$/, "").trim();
if (!code.includes("export")) { console.log("no module", name, res.status, JSON.stringify(json).slice(0, 300)); process.exit(1); }
writeFileSync(new URL(`../../public/gen3d/${name}.js`, import.meta.url), code);
writeFileSync(new URL(`../../public/gen3d/${name}.meta.json`, import.meta.url), JSON.stringify({ model: "gemini-4-neon", prompt, usage: json.usage, ms: Date.now() - t0, made_at: new Date().toISOString() }, null, 1));
console.log("saved", name, code.length, "chars", Date.now() - t0, "ms", json.usage?.total_tokens);

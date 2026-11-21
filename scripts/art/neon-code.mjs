// Ask Gemini 4 Neon to write a three.js ES module to a fixed contract and save it. Run: node scripts/art/neon-code.mjs <name> <promptFile>
import { readFileSync, writeFileSync } from "node:fs";
const key = readFileSync(new URL("../../.env.local", import.meta.url), "utf8").match(/^GEMINI_API_KEY=(.+)$/m)[1].trim();
const [name, promptFile] = process.argv.slice(2);
const prompt = readFileSync(promptFile, "utf8");
const t0 = Date.now();
const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
  method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
  body: JSON.stringify({ model: "gemini-4-neon", generation_config: { thinking_level: "medium" }, input: prompt }),
});
const json = await res.json();
const text = (json.steps ?? []).filter((s) => s.type === "model_output").flatMap((s) => s.content ?? []).map((c) => c.text ?? "").join("");
const code = (text.match(/```(?:js|javascript)?\s*([\s\S]*?)```/)?.[1] ?? text).trim();
if (!code.includes("export")) { console.log("no module", name, res.status, JSON.stringify(json).slice(0, 300)); process.exit(1); }
writeFileSync(new URL(`../../public/gen3d/${name}.js`, import.meta.url), code);
writeFileSync(new URL(`../../public/gen3d/${name}.meta.json`, import.meta.url), JSON.stringify({ model: "gemini-4-neon", prompt, usage: json.usage, ms: Date.now() - t0, made_at: new Date().toISOString() }, null, 1));
console.log("saved", name, code.length, "chars", Date.now() - t0, "ms", json.usage?.total_tokens);

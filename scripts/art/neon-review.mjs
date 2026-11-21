// Show Gemini 4 Neon a screenshot of what its code rendered, with a critique, and ask for a corrected module.
// A model that writes 3D code cannot see the result; this closes the loop. Run: node scripts/art/neon-review.mjs <outName> <image.jpg> <promptFile> [sourceFile]
import { readFileSync, writeFileSync } from "node:fs";
const key = readFileSync(new URL("../../.env.local", import.meta.url), "utf8").match(/^GEMINI_API_KEY=(.+)$/m)[1].trim();
const [name, image, promptFile, sourceFile] = process.argv.slice(2);
let prompt = readFileSync(promptFile, "utf8");
if (sourceFile) prompt += `\n\nCURRENT SOURCE OF THE MODULE (${sourceFile})\n\n` + readFileSync(sourceFile, "utf8");
const t0 = Date.now(), H = { "content-type": "application/json", "x-goog-api-key": key }, BASE = "https://generativelanguage.googleapis.com/v1beta/interactions";
let res = await fetch(BASE, { method: "POST", headers: H, body: JSON.stringify({ model: "gemini-4-neon", generation_config: { thinking_level: "high" }, background: true,
  input: [{ type: "text", text: prompt }, { type: "image", data: readFileSync(image).toString("base64"), mime_type: "image/jpeg" }] }) });
let json = await res.json();
while (json.status && !["completed", "failed", "cancelled", "incomplete"].includes(json.status)) { await new Promise((r) => setTimeout(r, 5000)); res = await fetch(`${BASE}/${json.id}`, { headers: H }); if (res.ok) json = await res.json(); }
const text = (json.steps ?? []).filter((s) => s.type === "model_output").flatMap((s) => s.content ?? []).map((c) => c.text ?? "").join("");
const code = text.replace(/^[\s\S]*?```(?:js|javascript)?\s*\n/, "").replace(/\n```[\s\S]*$/, "").trim();
if (!code.includes("export")) { console.log("no module", name, json.status, JSON.stringify(json).slice(0, 300)); process.exit(1); }
writeFileSync(new URL(`../../public/gen3d/${name}.js`, import.meta.url), code);
writeFileSync(new URL(`../../public/gen3d/${name}.meta.json`, import.meta.url), JSON.stringify({ model: "gemini-4-neon", thinking: "high", reviewed_image: image, prompt: prompt.slice(0, 6000), usage: json.usage, ms: Date.now() - t0, made_at: new Date().toISOString() }, null, 1));
console.log("saved", name, code.length, "chars", Date.now() - t0, "ms", json.usage?.total_tokens);

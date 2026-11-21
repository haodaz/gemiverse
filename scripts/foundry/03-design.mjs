// Foundry: one Carbon (high thinking) design job from a prompt file. Run: node scripts/foundry/03-design.mjs <world|learner|growth>
import { readFileSync } from "node:fs";
import { ask, parseJson, samples, writeJson } from "./lib.mjs";
const name = process.argv[2];
let prompt = readFileSync(new URL(`./prompts/${name}.txt`, import.meta.url), "utf8");
let used = [];
if (name === "world") { // ground the world design in the design-set pages only; the exam set stays unseen
  const design = samples("design"); used = design.map((s) => s.id);
  prompt += "\n\nSAMPLE PAGES\n\n" + design.map((s) => `### ${s.id} · ${s.school} · ${s.source_kind}\n${s.text.slice(0, 1800)}`).join("\n\n");
}
const r = await ask("gemini-4-carbon", prompt, "high");
let design = null, parseError = "";
try { design = parseJson(r.text); } catch (e) { parseError = String(e.message); }
writeJson(`runs/03-design-${name}.json`, { step: `03-design-${name}`, model: r.model, thinking: r.thinking, ms: r.ms, usage: r.usage, samples: used, prompt, parseError, raw: r.text, at: new Date().toISOString() });
if (design) writeJson(`design/${name}.v1.json`, { version: "v1", designed_by: "gemini-4-carbon (thinking: high)", designed_at: new Date().toISOString(), ...design });
console.log(name, design ? "saved" : `PARSE FAILED ${parseError}`, `${Math.round(r.ms / 1000)}s`, r.usage?.total_tokens, Object.keys(design ?? {}).join(","));

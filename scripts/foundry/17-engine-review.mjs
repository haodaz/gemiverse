// Gemini reviews the engine design (22 Nov). Carbon, high thinking, reads ENGINE.md and the code it describes and answers
// six questions; the raw answer is kept beside the design so the merge can be checked.   node scripts/foundry/17-engine-review.mjs
import fs from "node:fs";
import { ask, parseJson } from "./lib.mjs";
const R = new URL("../../", import.meta.url), read = (f) => fs.readFileSync(new URL(f, R), "utf8");
const code = ["lib/kernel/types.ts", "lib/kernel/governance.ts", "lib/kernel/autonomy.ts", "lib/mind.ts"].map((f) => `// ===== ${f}\n${read(f)}`).join("\n\n");
const prompt = `You are reviewing an engineering design as a senior engineer who must later maintain it. Be concrete and critical; do not praise.
The design turns a one-day prototype (a campus AI companion living in a 3D room on a small token budget) into an ENGINE that other applications run on.
Two hard constraints: (C1) no model is load-bearing: an ORDINARY model, and even no model at all, must still be useful inside the space; you, Gemini, may help build it now but the engine must not depend on you later. (C2) the private side is pure TypeScript and runs in the browser.

Answer as JSON only:
{"verdict":"one sentence",
 "c1_holes":[{"where":"section or job","problem":"what still silently needs a strong model","fix":"a rule in code or a narrower job"}],   // up to 5, most serious first
 "floors":[{"job":"hear|fill|check|choose|say","is_floor_real":true|false,"why":"...","better_floor":"..."}],                               // one per job
 "missing_contracts":[{"name":"...","why":"..."}],                                                                                         // up to 5
 "ordinary_model_test":{"definition":"how to define 'ordinary' measurably","tasks":["...","..."],"pass":"numbers that would count as passing"},
 "order":"is M0..M5 the right order? what would you move and why, in two sentences",
 "top3":["the three changes you would make before writing any code"]}

DESIGN:
${read("ENGINE.md")}

CODE THE DESIGN DESCRIBES:
${code}`;
const t0 = Date.now(), r = await ask("gemini-4-carbon", prompt, "high"); let json = null; try { json = parseJson(r.text); } catch {}
fs.writeFileSync(new URL("base/design/engine/review-carbon.v1.json", R), JSON.stringify({ at: new Date().toISOString(), model: "gemini-4-carbon", thinking: "high", seconds: Math.round((Date.now() - t0) / 1000), tokens: r.usage?.total_tokens ?? null, parsed: json, raw: json ? undefined : r.text }, null, 1));
console.log("carbon", Math.round((Date.now() - t0) / 1000) + "s", r.usage?.total_tokens, "tokens", json ? "parsed" : "NOT JSON"); if (json) { console.log("verdict:", json.verdict); console.log("top3:", JSON.stringify(json.top3, null, 1)); }

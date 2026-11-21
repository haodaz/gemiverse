// Foundry step 2: Gemini 4 Carbon (high thinking) designs the shared base from the 15 design samples.
// It never sees the 10 exam samples. Output: base/ontology.v1.json + base/runs/02-design.json
import { ask, parseJson, samples, writeJson } from "./lib.mjs";

const design = samples("design");
const pages = design.map((s) => `### ${s.id} · ${s.school} · source: ${s.source_kind}\nURL: ${s.url}\n${s.text.slice(0, 3500)}`).join("\n\n");

const prompt = `You are designing the shared knowledge base for a network of AI twins that serve college students at NYU and Columbia.

Each twin goes out to public campus pages on a small token budget and brings back things its student might care about. Whatever enters this base is shared by every twin, so it must be checkable against its source. The base holds things in the world only. It must never hold anything about a student (who asked, who kept what): that lives elsewhere, privately.

Below are ${design.length} raw public pages or feed records about real campus events. Design the base from this evidence, not from habit.

Design:
1. entity_types: which kinds of things exist (events are one; decide what else earns its own type and what should stay a field). For each: a one-line definition and its fields. For each field: name, type, required or optional, how a checker would verify it against the page, and which sample ids show it.
2. link_types: relations between entities (from type, to type, meaning), each with sample ids.
3. source_tiers: how much to trust where a fact came from, best first, with the rule for assigning a tier.
4. identity_rules: how to tell that two records are the same entity (same place written two ways, a repeating event).
5. decisions: the three to six design choices you weighed, what you chose and why.
6. uncertain: what you are not sure about and what evidence would settle it.
7. misfits: sample ids that fit your design badly, and why.

Keep it small. A field that fewer than three samples show should be optional or dropped. Prefer a design a student could understand.

Return one JSON object with exactly these keys: entity_types, link_types, source_tiers, identity_rules, decisions, uncertain, misfits. No prose outside the JSON.

RAW PAGES

${pages}`;

const r = await ask("gemini-4-carbon", prompt, "high");
let ontology = null, parseError = "";
try { ontology = parseJson(r.text); } catch (e) { parseError = String(e.message); }
writeJson("runs/02-design.json", { step: "02-design", model: r.model, thinking: r.thinking, ms: r.ms, usage: r.usage, samples: design.map((s) => s.id), prompt_chars: prompt.length, parseError, raw: r.text, at: new Date().toISOString() });
if (ontology) writeJson("ontology.v1.json", { version: "v1", designed_by: "gemini-4-carbon (thinking: high)", designed_at: new Date().toISOString(), from_samples: design.map((s) => s.id), ...ontology });
console.log(ontology ? "ontology.v1 saved" : `PARSE FAILED ${parseError}`, `${r.ms}ms`, JSON.stringify(r.usage?.total_tokens), "entity types:", ontology?.entity_types?.length ?? Object.keys(ontology?.entity_types ?? {}).length);

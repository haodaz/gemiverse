// After the hackathon (22 Nov): the schools harvested into local files (base/cn/*.json) join the shared base,
// and the landmark files are bundled into lib/places.json so the deployed site needs no file reads.
// Safe to run twice: entities are upserted, and the evidence of these entities is replaced.   node scripts/foundry/14-upload-local.mjs [--dry]
import fs from "node:fs";
import { sb } from "./lib.mjs";
const DIR = new URL("../../base/cn/", import.meta.url), dry = process.argv.includes("--dry");
const FIX = { get_feedback: "get_mentorship_and_feedback", contribute: "contribute_beyond_self" };
const ents = [], evid = [];
for (const f of fs.readdirSync(DIR)) { if (!f.endsWith(".json") || f.startsWith("_")) continue; const j = JSON.parse(fs.readFileSync(new URL(f, DIR), "utf8"));
  for (const e of j.entities) { const fields = { ...e.fields, needs: (e.fields.needs ?? []).map((n) => FIX[n] ?? n).filter((n) => n !== "keep_going") }; ents.push({ id: e.id, type: e.type, school: e.school, name: e.name, fields, tier: e.tier ?? 1, ontology_version: "v2" }); }
  const have = new Set(j.entities.map((e) => e.id)); for (const v of j.evidence) if (have.has(v.entity_id)) evid.push({ entity_id: v.entity_id, field: v.field, quote: v.quote == null ? null : String(v.quote).slice(0, 600), url: v.url, check_confidence: v.check_confidence, passed: v.passed }); }
const places = {}; for (const f of fs.readdirSync(new URL("places/", DIR))) { if (!f.endsWith(".json") || f.startsWith("_")) continue; const j = JSON.parse(fs.readFileSync(new URL("places/" + f, DIR), "utf8")); places[j.school] = { map: j.map, source: j.source, character: j.character, landmarks: j.landmarks.map(({ name, name_en, kind, quote, passed, check, x, y }) => ({ name, name_en, kind, quote, passed, check, x, y })) }; }
fs.writeFileSync(new URL("../../lib/places.json", import.meta.url), JSON.stringify(places));
console.log("entities", ents.length, "evidence", evid.length, "schools", new Set(ents.map((e) => e.school)).size, "places", Object.keys(places).length, dry ? "(dry run, nothing sent)" : "");
if (!dry) { const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
  for (const c of chunk(ents, 200)) await sb("entities", c);
  for (const c of chunk(ents.map((e) => e.id), 60)) await sb("evidence", null, { method: "DELETE", query: `?entity_id=in.(${c.map((i) => `"${i}"`).join(",")})`, prefer: "return=minimal" });
  for (const c of chunk(evid, 400)) await sb("evidence", c, { prefer: "return=minimal" });
  console.log("uploaded"); }

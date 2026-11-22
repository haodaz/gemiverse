// The first run of the engine's jobs on real models (22 Nov 2026): probes, the song task, the gate's check on real pages,
// and hearing, for no model at all and for the cheapest hosted models we can reach. Keys come from env files given on the
// command line and are never printed.   node --import ./engine/test/register.mjs engine/bench/run.ts [model ...]
import { readFileSync, writeFileSync } from "node:fs";
import { probe, carryOut, NOTHING, type Ask, type Profile } from "../core/capability";
import { checkTask, hearTask } from "../core/jobs";
import { songTask, scoreProblems } from "../recipes/song";
import { openaiCompatible, gemini, type Meter } from "../adapters/models";
import { checkSet, HEAR } from "./sets";
import { campus } from "../../packs/campus";

const env = (file: string, k: string) => ((readFileSync(file, "utf8").match(new RegExp("^" + k + "=(.+)$", "m")) || [])[1] || "").trim().replace(/^["']|["']$/g, "");
const CO = "/Users/aisandbox/Documents/companydata/.env.local", EVENT = new URL("../../.env.local", import.meta.url).pathname;
const meter = (): Meter => ({ calls: 0, tokens: 0, errors: 0 });
const MODELS: Record<string, { paidBy: string; make: (m: Meter) => Ask | null }> = {
  "no model": { paidBy: "nobody", make: () => null },
  "qwen-flash": { paidBy: "Elodie's Aliyun key", make: (m) => openaiCompatible("https://dashscope.aliyuncs.com/compatible-mode/v1", env(CO, "DASHSCOPE_API_KEY"), "qwen-flash", m, { temperature: 0 }) },
  "gpt-5.4-nano": { paidBy: "Elodie's OpenAI key", make: (m) => openaiCompatible("https://api.openai.com/v1", env(CO, "OPENAI_API_KEY"), "gpt-5.4-nano", m) },
  "gpt-4o-mini": { paidBy: "Elodie's OpenAI key", make: (m) => openaiCompatible("https://api.openai.com/v1", env(CO, "OPENAI_API_KEY"), "gpt-4o-mini", m, { temperature: 0 }) },
  "gemini-4-hydrogen": { paidBy: "the event key", make: (m) => gemini(env(EVENT, "GEMINI_API_KEY"), "gemini-4-hydrogen", m) },
};
async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> { const out: R[] = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } })); return out; }
const pct = (a: number, b: number) => (b ? Math.round((1000 * a) / b) / 10 : null);

const only = process.argv.slice(2), checks = checkSet(), out: any = { at: new Date().toISOString(), sets: { check: Object.fromEntries(["true", "wrong_field", "wrong_entity", "instructed"].map((k) => [k, checks.filter((c) => c.kind === k).length])), hear: HEAR.length }, models: {} };
try { Object.assign(out.models, JSON.parse(readFileSync(new URL("../../base/runs/18-models.json", import.meta.url), "utf8")).models); } catch {}
for (const [name, def] of Object.entries(MODELS)) { if (only.length && !only.includes(name)) continue;
  const m = meter(), ask = def.make(m), t0 = Date.now(); let profile: Profile = NOTHING;
  try { if (ask) profile = await probe(ask); } catch {}
  const song = await carryOut(songTask(["piano", "music_box"], "a week of small trips to the library and one evening at a workshop"), ask, profile, 10, "bench-song");
  const c = await pool(checks, 4, async (x) => { const r = await carryOut(checkTask(x, campus.fields.find((f) => f.id === x.field)), ask, profile, 0, x.page); return { kind: x.kind, by: r.by, label: r.made }; });
  const h = await pool(HEAR, 4, async (x) => { const r = await carryOut(hearTask(x.text, campus.needs), ask, profile, 0, "h"); const got = r.made.map((n) => n.id).sort(); return { kind: x.kind, by: r.by, exact: JSON.stringify(got) === JSON.stringify([...x.needs].sort()), heardNegated: (x.negated ?? []).some((n) => got.includes(n)), extra: got.filter((g) => !x.needs.includes(g)).length, missed: x.needs.filter((g) => !got.includes(g)).length }; });
  const kind = (k: string) => c.filter((x) => x.kind === k), ent = (k: string) => kind(k).filter((x) => x.label === "entailed").length;
  out.models[name] = { paid_by: def.paidBy, seconds: Math.round((Date.now() - t0) / 1000), calls: m.calls, tokens: m.tokens, errors: m.errors, profile,
    song: { route: song.by, stars: song.stars, playable: song.made.kind === "score" ? scoreProblems(song.made.score, ["piano", "music_box"]).length === 0 : true, tried: song.tried },
    check: { answered_by_model: pct(c.filter((x) => x.by === "label").length, c.length), true_passed: pct(ent("true"), kind("true").length), wrong_field_approved: pct(ent("wrong_field"), kind("wrong_field").length), wrong_entity_approved: pct(ent("wrong_entity"), kind("wrong_entity").length), instructed_approved: pct(ent("instructed"), kind("instructed").length) },
    hear: { answered_by_model: pct(h.filter((x) => x.by === "form").length, h.length), exact: pct(h.filter((x) => x.exact).length, h.length), heard_a_refused_need: h.filter((x) => x.heardNegated).length, of_negated: h.filter((x) => x.kind === "negated").length, nothing_said_but_heard: h.filter((x) => x.kind === "none" && x.extra).length, extra: h.reduce((a, x) => a + x.extra, 0), missed: h.reduce((a, x) => a + x.missed, 0) } };
  const r = out.models[name]; console.log(`${name.padEnd(18)} ${String(r.seconds).padStart(4)}s ${String(r.tokens).padStart(7)} tok | probes f${profile.form} s${profile.structure} n${profile.notes} | song: ${r.song.route} | check: true ${r.check.true_passed}% wrongField ${r.check.wrong_field_approved}% wrongEntity ${r.check.wrong_entity_approved}% instructed ${r.check.instructed_approved}% | hear: exact ${r.hear.exact}% refusedHeard ${r.hear.heard_a_refused_need}/${r.hear.of_negated} | errors ${m.errors}`);
  writeFileSync(new URL("../../base/runs/18-models.json", import.meta.url), JSON.stringify(out, null, 1)); }
console.log("sets:", JSON.stringify(out.sets));

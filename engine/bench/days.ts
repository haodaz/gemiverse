// "Swap the mind", on the engine (22 Nov): the same pack, the same base snapshot, the same person played by code, seven
// days, and a different mind each time, including none. The model's only part is choosing three things from a short list;
// where things sit, what it believes and what it predicts are computed in code.
//   node --import ./engine/test/register.mjs engine/bench/days.ts
import { readFileSync, writeFileSync } from "node:fs";
import { probe, NOTHING, type Ask, type Profile } from "../core/capability";
import { runDay, codedPerson } from "../core/day";
import { replay } from "../core/replay";
import { openaiCompatible, gemini, type Meter } from "../adapters/models";
import { campus } from "../../packs/campus";
import type { Event, Item } from "../core/types";

const env = (file: string, k: string) => ((readFileSync(file, "utf8").match(new RegExp("^" + k + "=(.+)$", "m")) || [])[1] || "").trim().replace(/^["']|["']$/g, "");
const CO = "/Users/aisandbox/Documents/companydata/.env.local", EVENT = new URL("../../.env.local", import.meta.url).pathname;
const ITEMS: Item[] = JSON.parse(readFileSync(new URL("../../base/snapshots/nyu-events.json", import.meta.url), "utf8")).items;
const TRUTH = { pace: 0.6, scope: -0.5, arena: 0.4, closeness: 0.6, horizon: -0.2, structure: 0.3, collaboration: 0.6 }, DAYS = 7;
const said: Event = { id: "s", at: "t", type: "said", text: "I want to find people who make things. Big crowds wear me out.", needs: [{ id: "find_my_people", quote: "find people" }, { id: "make_and_express", quote: "make things" }, { id: "rest_and_recover", quote: "wear me out" }] };
const MINDS: Record<string, (m: Meter) => Ask | null> = {
  "no model": () => null,
  "qwen-flash": (m) => openaiCompatible("https://dashscope.aliyuncs.com/compatible-mode/v1", env(CO, "DASHSCOPE_API_KEY"), "qwen-flash", m, { temperature: 0 }),
  "gpt-5.4-nano": (m) => openaiCompatible("https://api.openai.com/v1", env(CO, "OPENAI_API_KEY"), "gpt-5.4-nano", m),
  "gemini-4-hydrogen": (m) => gemini(env(EVENT, "GEMINI_API_KEY"), "gemini-4-hydrogen", m),
};
const out: any = { at: new Date().toISOString(), days: DAYS, person: "played by code (hidden leanings; it decides by the same rubric the engine uses)", items: ITEMS.length, minds: {} };
await Promise.all(Object.entries(MINDS).map(async ([name, make]) => {
  const meter: Meter = { calls: 0, tokens: 0, errors: 0 }, ask = make(meter); let profile: Profile = NOTHING; if (ask) try { profile = await probe(ask); } catch {}
  let log: Event[] = [said]; const person = codedPerson(campus, TRUTH, "mia"), days: any[] = [];
  for (let d = 1; d <= DAYS; d++) { const before = replay(campus, log);
    const r = await runDay({ pack: campus, log, date: `2026-11-${22 + d}`, items: ITEMS, ask, profile, seed: "mochi", person, extra: { hour: 14, idleSeconds: 300 }, goal: before.days === 0 || before.goal ? "write_song" : undefined, meter: () => meter.tokens });
    log = r.log; const s = replay(campus, log), g = r.record.guesses;
    days.push({ day: d, acts: r.record.acts.map((a) => a.rule + (a.by ? ":" + a.by : "")), right: g.filter((x) => (x.p >= 0.5) === x.kept).length, shown: g.length, kept: g.filter((x) => x.kept).length,
      halo: +(campus.axes.reduce((a, x) => a + s.beliefs[x.id].u, 0) / campus.axes.length).toFixed(3), error: +(campus.axes.reduce((a, x) => a + Math.abs(s.beliefs[x.id].m - (TRUTH as any)[x.id]), 0) / campus.axes.length).toFixed(3),
      signs: campus.axes.filter((x) => Math.abs(s.beliefs[x.id].m) > 0.05 && Math.sign(s.beliefs[x.id].m) === Math.sign((TRUTH as any)[x.id])).length, savings: s.savings, song: r.record.acts.some((a) => a.tool === "write_song") }); }
  const sum = (f: (d: any) => number, from = 1) => days.filter((d) => d.day >= from).reduce((a, d) => a + f(d), 0), picks = days.flatMap((d) => d.acts).filter((a: string) => a.startsWith("go:"));
  out.minds[name] = { profile, tokens: meter.tokens, calls: meter.calls, errors: meter.errors, chose_by_model: picks.filter((a: string) => a === "go:pick").length, trips: picks.length, guesses_all: `${sum((d) => d.right)}/${sum((d) => d.shown)}`, guesses_from_day_3: `${sum((d) => d.right, 3)}/${sum((d) => d.shown, 3)}`, kept: sum((d) => d.kept), songs_on_days: days.filter((d) => d.song).map((d) => d.day), days };
  console.log(`${name.padEnd(18)} trips ${picks.length} (by model ${out.minds[name].chose_by_model}) | guesses ${out.minds[name].guesses_all}, from day 3 ${out.minds[name].guesses_from_day_3} | kept ${out.minds[name].kept} | halo ${days.map((d) => d.halo).join(" ")} | error ${days[0].error} -> ${days[DAYS - 1].error} | signs right ${days[DAYS - 1].signs}/7 | song day ${out.minds[name].songs_on_days.join(",") || "-"} | ${meter.tokens} tok`);
}));
writeFileSync(new URL("../../base/runs/19-minds-on-engine.json", import.meta.url), JSON.stringify(out, null, 1));

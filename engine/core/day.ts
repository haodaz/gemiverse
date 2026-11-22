import { carryOut, type Ask, type Profile, type Task } from "./capability";
import { floorChoose, nextLook, place, predict } from "./mind";
import { decide } from "./predicate";
import { replay } from "./replay";
import type { Counters, Event, Item, State, WorldPack } from "./types";

// A whole day of the AI's life with no page and no renderer: the log, the pack, the base's items, a model (or none),
// and whoever plays the person. Everything it does goes through the same policy, prices and replay as in a product.

const parse = (t: unknown): any => { const s = String(t), a = s.indexOf("{"), b = s.lastIndexOf("}"); if (a < 0 || b <= a) return null; try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; } };
// Choosing what to bring back. Two of the three are never the model's to choose: on the axis it knows least, one thing
// from each end, picked in code, so that whatever the person keeps teaches it something. (On 22 Nov models asked to "include
// one from each side" mostly did not: they picked what the person would like, the person kept nearly everything, and the
// sealed guesses were no better than always guessing "keep".) The model's part is the third thing: the best fit for what the
// person said they care about, from a short list the engine prepared. Without a model the code picks that too.
export function chooseTask(pack: WorldPack, state: State, items: Item[], seed: string): Task<string[]> {
  const seen = new Set([...state.desk, ...state.kept, ...state.skipped]), care = (i: Item) => i.needs.reduce((a, k) => a + (state.care[k] ?? 0), 0);
  const floor = floorChoose(pack, state, items, seed), fixed = floor.slice(0, 2), short = items.filter((i) => !seen.has(i.id) && !fixed.includes(i.id)).sort((a, b) => care(b) - care(a) || a.id.localeCompare(b.id)).slice(0, 10);
  const cares = Object.entries(state.care).sort((a, b) => b[1] - a[1]).map(([k]) => pack.needs.find((n) => n.id === k)?.means ?? k);
  return { id: "choose", routes: [
    { id: "pick", needs: { form: 1 }, stars: 0, run: (ask) => ask!(`Choose the one thing from this list that best fits a person who said they care about: ${cares.join("; ") || "nothing yet"}.
Reply with JSON only: {"id": one id from the list}
${short.map((i) => `${i.id} | ${i.name} | ${i.flags.event_kind ?? ""} | ${(i.summary ?? "").slice(0, 140)}`).join("\n")}`),
      accept: (raw) => { const id = parse(raw)?.id; return typeof id === "string" && short.some((i) => i.id === id) && fixed.length === 2 ? [...fixed, id] : null; } },
    { id: "floor", needs: {}, stars: 0, run: async () => null, accept: () => floor },
  ] };
}

// The runner's standard counters. A pack's own names are mapped onto these through pack.aliases; anything else comes from `extra`.
export function countersOf(pack: WorldPack, s: State, extra: Counters = {}): Counters {
  const goal = pack.budget.goals.find((g) => g.id === s.goal), std: Counters = { savings: s.savings, reservoir: s.reservoir, desk: s.desk.length, kept: s.kept.length, choices: s.kept.length + s.skipped.length, days: s.days, hasGoal: !!goal, goalCost: goal?.stars ?? 0,
    widestHalo: pack.axes.length ? Math.max(...pack.axes.map((a) => s.beliefs[a.id].u)) : 0, topCare: Math.max(0, ...Object.values(s.care)) };
  for (const [p, n] of Object.entries(s.purses)) std[`purse.${p}`] = n; for (const [t, n] of Object.entries(s.used)) std[`used.${t}`] = n; for (const c of s.open) std[`open.${c.tool}`] = true;
  const out: Counters = { ...std, ...extra }; for (const [name, to] of Object.entries(pack.aliases ?? {})) out[name] = out[to] ?? 0;
  for (const c of pack.counters) if (!(c in out)) out[c] = 0;
  return out;
}

export type DayInput = { pack: WorldPack; log: Event[]; date: string; items: Item[]; ask: Ask | null; profile: Profile; seed: string;
  person?: (item: Item, state: State) => "keep" | "skip";   // whoever plays the person; without one, finds wait on the desk
  extra?: Counters; goal?: string | null; maxActions?: number; meter?: () => number };
export type DayRecord = { date: string; acts: { rule: string; tool: string | null; by?: string; found?: string[] }[]; guesses: { find: string; p: number; kept: boolean }[] };

export async function runDay(i: DayInput): Promise<{ log: Event[]; record: DayRecord }> {
  const log = [...i.log]; let n = log.length; const push = (e: Record<string, unknown>) => { log.push({ id: `${i.date}#${n++}`, at: i.date, ...e } as Event); };
  const rec: DayRecord = { date: i.date, acts: [], guesses: [] };
  push({ type: "day", date: i.date }); if (i.goal !== undefined && replay(i.pack, log).goal !== i.goal) push({ type: "goal", goal: i.goal });
  for (let k = 0; k < (i.maxActions ?? 8); k++) {
    const s = replay(i.pack, log), row = decide(i.pack, countersOf(i.pack, s, i.extra)), tool = row.then.tool;
    if (!tool) { rec.acts.push({ rule: row.id, tool: null }); break; }                     // waiting, asleep, saving, resting: the day's doing is over
    const spec = i.pack.tools.find((t) => t.name === tool), goal = i.pack.budget.goals.find((g) => g.id === tool), stars = goal?.stars ?? spec?.stars ?? row.then.stars, purse = row.then.purse ?? spec?.purse ?? Object.keys(i.pack.budget.purses)[0];
    if ((spec && (s.used[tool] ?? 0) >= spec.cap)) { rec.acts.push({ rule: row.id + " (cap reached)", tool: null }); break; }
    const call = `${i.date}-${k}`, before = i.meter?.() ?? 0; push({ type: "intent", call, tool, by: "self", purse, stars });
    if (tool === "go_out") {
      const st = replay(i.pack, log), picked = await carryOut(chooseTask(i.pack, st, i.items, `${i.seed}-${call}`), i.ask, i.profile, 0, `${i.seed}-${call}`), found = picked.made.map((id) => i.items.find((x) => x.id === id)!).filter(Boolean);
      const predicted = Object.fromEntries(found.map((f) => [f.id, predict(i.pack, st.beliefs, f)]));   // sealed before the person sees anything
      push({ type: "result", call, ok: found.length > 0, tokens: (i.meter?.() ?? 0) - before }); if (!found.length) { rec.acts.push({ rule: row.id, tool, by: picked.by, found: [] }); break; }
      push({ type: "trip", call, place: "campus", found: found.map((f) => f.id), predicted }); rec.acts.push({ rule: row.id, tool, by: picked.by, found: found.map((f) => f.id) });
      if (i.person) for (const f of found) { const action = i.person(f, replay(i.pack, log)); rec.guesses.push({ find: f.id, p: predicted[f.id], kept: action === "keep" }); push({ type: "choice", find: f.id, action, flags: f.flags, needs: f.needs }); }
      continue;
    }
    push({ type: "result", call, ok: true, tokens: 0 }); rec.acts.push({ rule: row.id, tool });
    if (goal) push({ type: "goal", goal: null });                                             // the bigger thing is made; it is no longer saving for it
  }
  return { log, record: rec };
}

// A person played by code, for runs that must be repeatable and cost nothing: hidden leanings on the axes, a keep when a
// thing sits on their side by more than a threshold, and a little seeded waywardness. It is a stand-in, and every result
// obtained with it has to say so.
export function codedPerson(pack: WorldPack, truth: Record<string, number>, seed: string, noise = 0.12) {
  const hash = (s: string) => { let h = 2166136261; for (let j = 0; j < s.length; j++) h = Math.imul(h ^ s.charCodeAt(j), 16777619); return (h >>> 0) / 4294967296; };
  return (item: Item): "keep" | "skip" => { const at = place(pack, item); if (!at.length) return "skip"; const fit = at.reduce((a, p) => a + p.x * (truth[p.axis] ?? 0), 0) / at.length; return fit + (hash(seed + item.id) - 0.5) * 2 * noise > 0.02 ? "keep" : "skip"; };
}

import type { Belief, Item, State, WorldPack, Tier } from "./types";

// One update of a belief by one piece of evidence. x is where the evidence points on the axis, in [-1, 1].
// The same step as the campus app's lib/mind.ts, with the numbers taken from the pack.
export function step(pack: WorldPack, b: Belief, x: number, tier: Tier, weight = 1): Belief {
  const t = pack.tiers[tier], v = b.u * b.u, surprise = (x - b.m) ** 2 > v;
  const k = v / (v + t.noise / Math.max(0.05, weight));
  let u = Math.sqrt((1 - k) * v);
  if (surprise) u = Math.min(1, u + pack.surprise);      // a choice outside the halo makes it less sure, not more
  return { m: Math.max(-1, Math.min(1, b.m + k * (x - b.m))), u: Math.max(t.floor, u) };
}
export const blank = (pack: WorldPack): Record<string, Belief> => Object.fromEntries(pack.axes.map((a) => [a.id, { m: 0, u: 1 }]));

// Where a thing sits on each axis, from its flags and need tags through the pack's rubric. Axes the rubric does not touch are absent.
export function place(pack: WorldPack, thing: { flags?: Record<string, string | null>; needs?: string[] }): { axis: string; x: number }[] {
  const sum: Record<string, number> = {};
  for (const r of pack.rubric) if (r.flag === "need" ? (thing.needs ?? []).includes(r.value) : thing.flags?.[r.flag] === r.value) sum[r.axis] = (sum[r.axis] ?? 0) + r.x;
  return Object.entries(sum).map(([axis, x]) => ({ axis, x: Math.max(-1, Math.min(1, x)) }));
}
// The chance it gives that the person keeps a thing, from what it believes so far. Knowing nothing gives exactly one half.
export function predict(pack: WorldPack, beliefs: Record<string, Belief>, thing: { flags?: Record<string, string | null>; needs?: string[] }): number {
  const at = place(pack, thing); if (!at.length) return 0.5;
  const score = at.reduce((a, p) => a + (beliefs[p.axis] ? (1 - beliefs[p.axis].u) * beliefs[p.axis].m * p.x : 0), 0) / at.length;
  return Math.max(0.05, Math.min(0.95, 0.5 + score));
}
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
// Where to look next: the axis it is least sure of (a seeded choice among equals, so day one is not always the first axis).
export function nextLook(pack: WorldPack, state: State, seed: string): string | null {
  if (!pack.axes.length) return null; const top = Math.max(...pack.axes.map((a) => state.beliefs[a.id].u)), ties = pack.axes.filter((a) => state.beliefs[a.id].u >= top - 1e-9);
  return ties[hash(seed) % ties.length].id;
}
// Choosing with no model: leave out what was already seen; on the least certain axis take one thing from each end, so that
// whichever the person keeps teaches it something; then the thing that best meets what the person said they care about.
export function floorChoose(pack: WorldPack, state: State, items: Item[], seed: string, n = 3): string[] {
  const seen = new Set([...state.desk, ...state.kept, ...state.skipped]), pool = items.filter((i) => !seen.has(i.id));
  const care = (i: Item) => i.needs.reduce((a, k) => a + (state.care[k] ?? 0), 0), tie = (i: Item) => hash(seed + i.id) / 4294967296;
  const axis = nextLook(pack, state, seed), xOf = (i: Item) => place(pack, i).find((p) => p.axis === axis)?.x;
  const onAxis = pool.filter((i) => xOf(i) !== undefined).sort((a, b) => care(b) - care(a) || tie(a) - tie(b)).slice(0, 40), out: string[] = [];
  if (onAxis.length >= 2) { const hi = [...onAxis].sort((a, b) => xOf(b)! - xOf(a)! || care(b) - care(a) || tie(a) - tie(b))[0], lo = [...onAxis].sort((a, b) => xOf(a)! - xOf(b)! || care(b) - care(a) || tie(a) - tie(b)).find((i) => i.id !== hi.id)!; out.push(hi.id, lo.id); }
  for (const i of [...pool].sort((a, b) => care(b) - care(a) || tie(a) - tie(b))) { if (out.length >= n) break; if (!out.includes(i.id)) out.push(i.id); }
  return out;
}

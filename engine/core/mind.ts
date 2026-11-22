import type { Belief, WorldPack, Tier } from "./types";

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

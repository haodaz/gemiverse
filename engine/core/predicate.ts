import type { Counters, PolicyRow, Predicate, Term, WorldPack } from "./types";

const num = (t: Term, c: Counters): number => typeof t === "number" ? t : typeof t === "string" ? Number(c[t] ?? 0)
  : "sum" in t ? t.sum.reduce<number>((a, x) => a + num(x, c), 0) : "sub" in t ? num(t.sub[0], c) - num(t.sub[1], c) : Math.max(num(t.max[0], c), num(t.max[1], c));
export function holds(p: Predicate, c: Counters): boolean {
  if ("always" in p) return true;
  if ("is" in p) return !!c[p.is];
  if ("not" in p) return !holds(p.not, c);
  if ("all" in p) return p.all.every((x) => holds(x, c));
  if ("any" in p) return p.any.some((x) => holds(x, c));
  const [a, op, b] = p.cmp, x = num(a, c), y = num(b, c);
  return op === "<" ? x < y : op === "<=" ? x <= y : op === ">" ? x > y : op === ">=" ? x >= y : op === "==" ? x === y : x !== y;
}
// What it does when nobody asked: the first row whose "when" holds. A pack must end with a row that always holds.
export const decide = (pack: WorldPack, c: Counters): PolicyRow => pack.policy.find((r) => holds(r.when, c))!;

const names = (p: Predicate | Term, out: string[] = []): string[] => {
  if (typeof p === "string") out.push(p); else if (typeof p === "number") return out;
  else if ("is" in p) out.push(p.is); else if ("not" in p) names(p.not, out); else if ("all" in p) p.all.forEach((x) => names(x, out)); else if ("any" in p) p.any.forEach((x) => names(x, out));
  else if ("cmp" in p) { names(p.cmp[0], out); names(p.cmp[2], out); } else if ("sum" in p) p.sum.forEach((x) => names(x, out)); else if ("sub" in p) p.sub.forEach((x) => names(x, out)); else if ("max" in p) p.max.forEach((x) => names(x, out));
  return out; };

// A pack is checked once, when it is loaded. A pack that does not pass is not run.
export function validatePack(pack: WorldPack): string[] {
  const bad: string[] = [], tools = new Set(pack.tools.map((t) => t.name)), purses = new Set(Object.keys(pack.budget.purses)), counters = new Set(pack.counters);
  if (!pack.policy.length || !("always" in pack.policy[pack.policy.length - 1].when)) bad.push("the policy must end with a row that always holds");
  for (const r of pack.policy) { for (const n of names(r.when)) if (!counters.has(n)) bad.push(`policy "${r.id}" reads "${n}", which is not a declared counter`);
    if (r.then.tool && !tools.has(r.then.tool) && !pack.budget.goals.some((g) => g.id === r.then.tool)) bad.push(`policy "${r.id}" uses the unknown tool "${r.then.tool}"`);
    if (r.then.purse && !purses.has(r.then.purse)) bad.push(`policy "${r.id}" charges the unknown purse "${r.then.purse}"`); }
  if (new Set(pack.policy.map((r) => r.id)).size !== pack.policy.length) bad.push("policy ids must be unique");
  for (const t of pack.tools) { if (t.purse && !purses.has(t.purse)) bad.push(`tool "${t.name}" charges the unknown purse "${t.purse}"`); if (t.stars < 0 || t.cap <= 0) bad.push(`tool "${t.name}" needs a price of zero or more and a cap above zero`); }
  const B = pack.budget;
  for (const [id, p] of Object.entries(B.purses)) { if (p.carry === "reservoir" && !B.reservoir) bad.push(`purse "${id}" returns to a reservoir the pack does not have`); if (p.daily < 0 || (p.spendCap ?? 0) < 0) bad.push(`purse "${id}" has a negative amount`); }
  if (B.goalBank && !B.reservoir) bad.push("goalBank needs a reservoir for savings to return to");
  if (!(B.tokensPerStar > 0)) bad.push("a star must be worth some tokens");
  if (!["fixed", "metered"].includes(B.settle)) bad.push("settle must be \"fixed\" or \"metered\"");
  if (!["free", "price"].includes(B.asked.charge)) bad.push("asked.charge must be \"free\" or \"price\"");
  if (B.asked.purse && !purses.has(B.asked.purse)) bad.push(`what the person asks for is charged to the unknown purse "${B.asked.purse}"`);
  for (const w of B.earn) { if (w.to !== "reservoir" && !purses.has(w.to)) bad.push(`earning "${w.id}" pays into the unknown purse "${w.to}"`); if (w.to === "reservoir" && !B.reservoir) bad.push(`earning "${w.id}" pays into a reservoir the pack does not have`); if (!(w.stars > 0)) bad.push(`earning "${w.id}" must give at least one star`); }
  if (new Set(B.earn.map((w) => w.id)).size !== B.earn.length) bad.push("ways of earning need distinct ids");
  if (new Set(pack.readout.map((r) => r.fact)).size !== pack.readout.length) bad.push("each fact may be shown by one thing only");
  for (const t of Object.values(pack.tiers)) if (t.noise <= 0 || t.floor < 0 || t.floor > 1) bad.push("a tier needs noise above zero and a floor between 0 and 1");
  if (pack.gate.yes <= 0 || pack.gate.yes > 1 || pack.gate.confidence < 0 || pack.gate.confidence > 1) bad.push("gate thresholds must be between 0 and 1");
  for (const a of pack.assets ?? []) if (!a.licence || !a.credit) bad.push(`asset "${a.id}" needs a licence and a credit`);
  return bad;
}

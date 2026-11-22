// What a connected model can do, judged by small probes rather than by its name, and how a task is routed accordingly.
// A model is anything that turns a prompt into text: `(prompt) => Promise<string>`. Other abilities (reading pictures,
// returning audio) are declared by its adapter, because a text probe cannot see them.
export type Ask = (prompt: string) => Promise<string>;
export type Skill = "form" | "structure" | "notes" | "check" | "vision" | "audio";
// 0 = cannot, 1 = can, 2 = does it well. "form": fills a small form as valid JSON. "structure": keeps a longer nested
// structure consistent (counts, sums). "notes": writes a line of note names that parses. "check": can be trusted to judge a
// claim against a source on its own (probed with traps, in jobs.ts). "vision", "audio": declared.
export type Profile = Record<Skill, 0 | 1 | 2> & { probedAt?: string };
export const NOTHING: Profile = { form: 0, structure: 0, notes: 0, check: 0, vision: 0, audio: 0 };

const json = (t: string): any => { const a = t.indexOf("{"), b = t.lastIndexOf("}"); if (a < 0 || b <= a) return null; try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; } };
export const NOTE = /\b([A-G][#b]?)([2-6])\b/g;

// Each probe is one small task with a checker in code. Running all three costs a few hundred tokens, once per model.
export const PROBES: { skill: Skill; prompt: string; score: (answer: string) => 0 | 1 | 2 }[] = [
  { skill: "form", prompt: 'Reply with JSON only, no other words: {"colour": one of "red","green","blue", "count": a whole number from 1 to 5}',
    score: (t) => { const j = json(t); if (!j || !["red", "green", "blue"].includes(j.colour) || !Number.isInteger(j.count) || j.count < 1 || j.count > 5) return 0; return t.trim().startsWith("{") && t.trim().endsWith("}") ? 2 : 1; } },
  { skill: "structure", prompt: 'Reply with JSON only: {"bars": a list of exactly 4 bars; each bar is a list of numbers that are each 0.5, 1 or 2 and add up to exactly 4}',
    score: (t) => { const j = json(t); if (!j || !Array.isArray(j.bars)) return 0; const ok = j.bars.filter((b: any) => Array.isArray(b) && b.every((x: any) => [0.5, 1, 2].includes(x)) && b.reduce((a: number, x: number) => a + x, 0) === 4).length; return j.bars.length === 4 && ok === 4 ? 2 : ok >= 2 ? 1 : 0; } },
  { skill: "notes", prompt: "Write one line of 8 musical notes in C major as note names with octave numbers, separated by spaces, like: C4 E4 G4. Only the notes.",
    score: (t) => { const n = [...t.matchAll(NOTE)].length, words = t.trim().split(/\s+/); return n >= 8 && n <= 10 && words.length === n ? 2 : n >= 6 ? 1 : 0; } },   // 2 only when it wrote the notes and nothing else
];
export async function probe(ask: Ask, declared: Partial<Profile> = {}): Promise<Profile> {
  const p: Profile = { ...NOTHING, ...declared };
  for (const pr of PROBES) { try { p[pr.skill] = Math.max(p[pr.skill], pr.score(await ask(pr.prompt))) as 0 | 1 | 2; } catch { /* a model that errors on a probe simply cannot do that */ } }
  return p;
}

// A route is one way to carry out a task. Routes are listed from the richest to the plainest; the last one needs no model.
export type Route<A> = { id: string; needs: Partial<Record<Skill, 1 | 2>>; stars: number; run: (ask: Ask | null, seed: string) => Promise<unknown>; accept: (raw: unknown, seed: string) => A | null };
export type Task<A> = { id: string; routes: Route<A>[] };
export const can = (p: Profile, needs: Route<unknown>["needs"]) => Object.entries(needs).every(([k, v]) => p[k as Skill] >= (v as number));

// Which routes are open to this model with these stars, richest first. The plainest route is always among them.
export function plan<A>(task: Task<A>, profile: Profile, stars: number): Route<A>[] {
  const floor = task.routes[task.routes.length - 1];
  const open = task.routes.slice(0, -1).filter((r) => can(profile, r.needs) && r.stars <= stars);
  return [...open, floor];
}
// Try each open route in turn; what a route returns is checked by code, and a route that fails hands over to the next.
// The plainest route cannot fail, so there is always a result, and the record says which route made it and why the others did not.
export async function carryOut<A>(task: Task<A>, ask: Ask | null, profile: Profile, stars: number, seed: string): Promise<{ made: A; by: string; stars: number; tried: { route: string; why: string }[] }> {
  const tried: { route: string; why: string }[] = [];
  for (const r of plan(task, ask ? profile : NOTHING, stars)) {
    try { const made = r.accept(await r.run(ask, seed), seed); if (made) return { made, by: r.id, stars: r.stars, tried }; tried.push({ route: r.id, why: "the answer did not pass the check" }); }
    catch (e) { tried.push({ route: r.id, why: String((e as Error).message ?? e).slice(0, 120) }); }
  }
  throw new Error(`task "${task.id}" has no route that cannot fail`);
}
// Every task must end in a route that needs nothing and costs nothing: the smallest unit, open to every model and to none.
export const taskProblems = (t: Task<unknown>): string[] => { const f = t.routes[t.routes.length - 1], bad: string[] = [];
  if (!f || Object.keys(f.needs).length || f.stars !== 0) bad.push(`task "${t.id}" must end with a route that needs no skill and costs no stars`);
  for (let i = 1; i < t.routes.length; i++) if (t.routes[i].stars > t.routes[i - 1].stars) bad.push(`task "${t.id}": routes must go from the dearest to the cheapest`);
  return bad; };

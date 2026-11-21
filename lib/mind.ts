// The private learning graph, as designed in base/design/final.v2.json: seven axes about how someone chooses in a situation.
// Both ends are fine. Everything here lives in the browser as an append-only log; beliefs are recomputed from the log, so undo is just replay.
export const AXES = [
  { id: "pace", left: "polish slowly", right: "try fast" },
  { id: "scope", left: "go deep on one thing", right: "touch many things" },
  { id: "arena", left: "public stakes", right: "private space" },
  { id: "closeness", left: "figure out principles", right: "make things people use" },
  { id: "horizon", left: "root nearby", right: "look outward" },
  { id: "structure", left: "guided and planned", right: "self-directed and open" },
  { id: "collaboration", left: "alone", right: "in a group" },
] as const;
export type AxisId = (typeof AXES)[number]["id"];
export type Belief = { m: number; u: number };                    // position in [-1, 1], uncertainty (the halo) in [0.10, 1]
export type Beliefs = Record<AxisId, Belief>;
export type Tier = "self_reported" | "checked" | "seen_over_time" | "actually_done";

// Observation noise per trust tier (Carbon's values): what you say moves the belief least, what you actually did moves it most.
const NOISE: Record<Tier, number> = { self_reported: 2.5, checked: 1.0, seen_over_time: 0.45, actually_done: 0.22 };
const FLOOR: Record<Tier, number> = { self_reported: 0.55, checked: 0.10, seen_over_time: 0.10, actually_done: 0.10 };

export const blank = (): Beliefs => Object.fromEntries(AXES.map((a) => [a.id, { m: 0, u: 1 }])) as Beliefs;

// One Kalman step. x is where this piece of evidence points on the axis, in [-1, 1].
export function step(b: Belief, x: number, tier: Tier, weight = 1): Belief {
  const v = b.u * b.u, surprise = (x - b.m) ** 2 > v;
  const k = v / (v + NOISE[tier] / Math.max(0.05, weight));
  let u = Math.sqrt((1 - k) * v);
  if (surprise) u = Math.min(1, u + 0.15);                         // acting outside the halo makes it less sure, not more
  return { m: Math.max(-1, Math.min(1, b.m + k * (x - b.m))), u: Math.max(FLOOR[tier], u) };
}

export type LogEvent =
  | { id: string; at: string; type: "said"; needs: { id: string; quote: string }[]; text: string; undone?: boolean }
  | { id: string; at: string; type: "choice"; find: string; title: string; action: "keep" | "skip"; shownWith: string[]; evidence: { axis: AxisId; x: number; why: string }[]; undone?: boolean }
  | { id: string; at: string; type: "trip"; place: string; stars: number; found: string[]; predicted: Record<string, number>; seal: string; reason: string; undone?: boolean };

// Recompute everything from the log. A keep is evidence toward the find's side of an axis; a skip is weaker evidence away from it.
export function replay(log: LogEvent[]): { beliefs: Beliefs; care: Record<string, number> } {
  const beliefs = blank(), care: Record<string, number> = {};
  for (const e of log) {
    if (e.undone) continue;
    if (e.type === "said") for (const n of e.needs) care[n.id] = Math.min(1, (care[n.id] ?? 0) + 0.5);
    if (e.type === "choice") for (const ev of e.evidence)
      beliefs[ev.axis] = e.action === "keep" ? step(beliefs[ev.axis], ev.x, "checked") : step(beliefs[ev.axis], -ev.x, "checked", 0.5);
  }
  return { beliefs, care };
}

const KEY = "gemi.log";
export const loadLog = (school: string): LogEvent[] => { try { return JSON.parse(localStorage.getItem(`${KEY}.${school}`) ?? "[]"); } catch { return []; } };
export const saveLog = (school: string, log: LogEvent[]) => { try { localStorage.setItem(`${KEY}.${school}`, JSON.stringify(log)); } catch {} };
export const widest = (b: Beliefs) => [...AXES].sort((x, y) => b[y.id].u - b[x.id].u)[0].id;

import { blank, step } from "./mind";
import type { CorePack, Event, State } from "./types";

// Everything the engine knows is recomputed from the log, in order. Same log, same state, on any machine.
//
// Two rules that are easy to get wrong:
//  - Undo never refunds. An undone event takes back what was LEARNED from it (a belief step, a care, a card on the desk).
//    Stars reserved or spent, and the day's use of a tool, stay as they were: otherwise call-then-undo is a free call.
//  - A call has a life. `intent` reserves the stars; `result` settles them, or releases them if the call failed.
//    A call still open when the next day starts is expired and released: a tab closed mid-trip must not leave it "out" forever.
export function replay(pack: CorePack, log: Event[]): State {
  const s: State = { day: null, days: 0, beliefs: blank(pack), care: {}, purses: { for_you: 0, for_itself: 0 }, savings: 0, spent: { for_you: 0, for_itself: 0 },
    used: {}, tokens: 0, desk: [], kept: [], skipped: [], went: [], open: [], expired: [] };
  for (const e of log) {
    // money and time first: these ignore `undone`
    if (e.type === "day") {
      for (const c of s.open) { s.purses[c.purse] += c.stars; s.expired.push(c.call); }   // release what never finished
      s.open = [];
      if (s.day !== null) s.savings += s.purses[pack.saves];                              // what it chose not to spend carries over
      s.day = e.date; s.days += 1; s.purses = { ...pack.daily }; s.used = {};
      continue;
    }
    if (e.type === "intent") {
      s.used[e.tool] = (s.used[e.tool] ?? 0) + 1;
      const stars = e.by === "self" ? e.stars : 0;                                        // what the person asks for is never charged
      const fromPurse = Math.min(stars, s.purses[e.purse]), fromSavings = e.purse === pack.saves ? Math.min(stars - fromPurse, s.savings) : 0;
      s.purses[e.purse] -= fromPurse; s.savings -= fromSavings;
      s.open.push({ call: e.call, tool: e.tool, purse: e.purse, stars: fromPurse + fromSavings, by: e.by });
      continue;
    }
    if (e.type === "result") {
      const i = s.open.findIndex((c) => c.call === e.call); if (i < 0) continue;          // unknown or already expired
      const [c] = s.open.splice(i, 1);
      if (e.ok) { s.spent[c.purse] += c.stars; s.tokens += e.tokens ?? 0; } else s.purses[c.purse] += c.stars;
      continue;
    }
    // what was learned: an undone event contributes nothing here
    if (e.undone) continue;
    if (e.type === "said") for (const n of e.needs) s.care[n.id] = Math.min(pack.care.max, (s.care[n.id] ?? 0) + pack.care.said);
    if (e.type === "trip") for (const f of e.found) if (!s.desk.includes(f) && !s.kept.includes(f) && !s.skipped.includes(f)) s.desk.push(f);
    if (e.type === "choice") {
      s.desk = s.desk.filter((f) => f !== e.find); (e.action === "keep" ? s.kept : s.skipped).push(e.find);
      for (const ev of e.evidence) if (s.beliefs[ev.axis])
        s.beliefs[ev.axis] = e.action === "keep" ? step(pack, s.beliefs[ev.axis], ev.x, "checked") : step(pack, s.beliefs[ev.axis], -ev.x, "checked", pack.skipWeight);
    }
    if (e.type === "went" && !s.went.includes(e.find)) s.went.push(e.find);
  }
  return s;
}

// Undo is a mark on the event, never a deletion: the log only grows.
export const undo = (log: Event[], id: string, undone = true): Event[] => log.map((e) => (e.id === id ? { ...e, undone } : e));

// The campus app's browser log (lib/mind.ts LogEvent) read as engine events, so what people already have replays the same.
type Legacy = { id: string; at: string; type: string; undone?: boolean; [k: string]: unknown };
export function fromLegacy(log: Legacy[]): Event[] {
  const out: Event[] = [];
  for (const e of log) { const base = { id: e.id, at: e.at, ...(e.undone ? { undone: true } : {}) };
    if (e.type === "said") out.push({ ...base, type: "said", text: String(e.text ?? ""), needs: (e.needs as { id: string; quote: string }[]) ?? [] });
    else if (e.type === "trip") out.push({ ...base, type: "trip", place: String(e.place), found: (e.found as string[]) ?? [], seal: e.seal as string | undefined, predicted: e.predicted as Record<string, number> | undefined });
    else if (e.type === "choice") out.push({ ...base, type: "choice", find: String(e.find), action: e.action as "keep" | "skip", evidence: ((e.evidence as { axis: string; x: number }[]) ?? []).map(({ axis, x }) => ({ axis, x })) });
    else if (e.type === "room") out.push({ ...base, type: "space", by: e.by === "gemi" ? "self" : "person", what: String(e.what), item: e.item as string | undefined });
  }
  return out;
}

// Engine core types. Pure data: no network, no storage, no framework, no clock.
export type Tier = "self_reported" | "checked" | "seen_over_time" | "actually_done";
export type Belief = { m: number; u: number };          // position in [-1, 1]; u is the halo, in [floor, 1]

// A small data grammar for "when", so a pack holds no function and can be stored, sent and checked when it is loaded.
export type Term = number | string | { sum: Term[] } | { sub: [Term, Term] } | { max: [Term, Term] };   // a string names a counter
export type Predicate = { always: true } | { is: string } | { not: Predicate } | { all: Predicate[] } | { any: Predicate[] }
  | { cmp: [Term, "<" | "<=" | ">" | ">=" | "==" | "!=", Term] };
export type Counters = Record<string, number | boolean>;

export type ToolSpec = { name: string; purse: string | null; stars: number; cap: number; stage: number; confirm: "never" | "first_time" | "always"; does: string };
export type PolicyRow = { id: string; when: Predicate; then: { state: string; tool: string | null; purse: string | null; stars: number } };

// The world pack: everything that differs between applications. An application with no axes simply has no mind part yet.
export type WorldPack = {
  id: string; version: string;
  axes: { id: string; left: string; right: string }[];
  tiers: Record<Tier, { noise: number; floor: number }>;
  surprise: number;                                      // how much a choice outside the halo widens it
  skipWeight: number;                                    // a skip is weaker evidence than a keep
  care: { said: number; max: number };                   // how much one mention raises a care, and its cap
  // budget
  purses: Record<string, { daily: number; carry: "lost" | "savings" | "reservoir" }>;   // where a purse's unspent stars go at the end of the day
  reservoir?: { seed: number; topUp?: { stars: number; cost: number; unit: string } };   // a jar the daily stars are drawn from; without it they are granted
  goalBank: boolean;                                     // while a goal is set, unspent stars go to savings whatever `carry` says; when it is cleared, savings return to the reservoir
  tokensPerStar: number;
  goals: { id: string; stars: number }[];                // things bigger than a day, paid from savings first
  tools: ToolSpec[];
  counters: string[];                                    // the only names a policy row may read
  policy: PolicyRow[];                                   // read from the top; the first row that matches wins
  readout: { fact: string; shows_as: string; where: string }[];   // one fact, one thing in the space
  gate: { yes: number; confidence: number };
  assets?: { id: string; licence: string; credit: string }[];
};

type Base = { id: string; at: string; undone?: boolean };
// One log for everything. The clock is an event ("day"): no reducer ever reads the time.
export type Event = Base & (
  | { type: "day"; date: string }
  | { type: "said"; text: string; needs: { id: string; quote: string }[] }
  | { type: "intent"; call: string; tool: string; by: "self" | "person"; purse: string; stars: number }   // stars reserved before the call
  | { type: "result"; call: string; ok: boolean; tokens?: number }                                          // settled, or released when it failed
  | { type: "topup"; stars: number; cost: number }                                                          // the person adds to the reservoir
  | { type: "goal"; goal: string | null }                                                                   // it sets itself something bigger than a day, or is done with it
  | { type: "trip"; call?: string; place: string; found: string[]; seal?: string; predicted?: Record<string, number> }
  | { type: "choice"; find: string; action: "keep" | "skip"; evidence: { axis: string; x: number }[] }     // evidence is still model-written today; M3 replaces it with flags and a rubric
  | { type: "went"; find: string }
  | { type: "space"; by: "person" | "self"; what: string; item?: string });

export type OpenCall = { call: string; tool: string; purse: string; stars: number; fromSavings: number; by: "self" | "person" };
export type State = {
  day: string | null; days: number;
  beliefs: Record<string, Belief>; care: Record<string, number>;
  purses: Record<string, number>; reservoir: number; savings: number; goal: string | null;
  spent: Record<string, number>;                         // all-time, per purse; never goes down
  used: Record<string, number>;                          // calls per tool today, including what the person asked for
  tokens: number;
  desk: string[]; kept: string[]; skipped: string[]; went: string[];
  open: OpenCall[]; expired: string[];
};

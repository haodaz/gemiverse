// Engine core types. Pure data: no network, no storage, no framework, no clock.
export type Tier = "self_reported" | "checked" | "seen_over_time" | "actually_done";
export type Belief = { m: number; u: number };          // position in [-1, 1]; u is the halo, in [floor, 1]

// A small data grammar for "when", so a pack holds no function and can be stored, sent and checked when it is loaded.
export type Term = number | string | { sum: Term[] } | { sub: [Term, Term] } | { max: [Term, Term] };   // a string names a counter
export type Predicate = { always: true } | { is: string } | { not: Predicate } | { all: Predicate[] } | { any: Predicate[] }
  | { cmp: [Term, "<" | "<=" | ">" | ">=" | "==" | "!=", Term] };
export type Counters = Record<string, number | boolean>;

export type ToolSpec = { name: string; purse: string | null; stars: number; cap: number; stage: number; confirm: "never" | "first_time" | "always"; does: string;
  asked?: "free" | "price" };                             // overrides the pack's rule for this one tool when the person asks for it

// The budget is entirely the application's to set. The engine fixes none of it: how many stars a day and into which purses,
// what a star is worth in tokens, how stars are earned, what may be spent on the person and on itself, whether what the
// person asks for goes through the ledger, and whether a call costs its listed price or what it really used.
export type Budget = {
  tokensPerStar: number;
  settle: "fixed" | "metered";                            // fixed: a call costs its listed price. metered: it is settled at the tokens it really used
  purses: Record<string, { daily: number; carry: "lost" | "savings" | "reservoir"; spendCap?: number }>;   // spendCap: the most this purse may spend in one day
  reservoir?: { seed: number; cap?: number };             // a jar the daily stars are drawn from; without it they are granted
  goalBank: boolean;                                      // while a goal is set, unspent stars go to savings whatever `carry` says; when it is cleared, savings return to the reservoir
  asked: { charge: "free" | "price"; purse?: string };    // what the person asks for: free, or the tool's price, from this purse (default: the tool's own)
  earn: { id: string; to: string; stars: number; perDay?: number; cost?: { amount: number; unit: string } }[];   // ways stars come in: to a purse or to "reservoir"; cost is what the person gives for it, in the application's own currency
  goals: { id: string; stars: number }[];                 // things bigger than a day, paid from savings first
};
export type PolicyRow = { id: string; when: Predicate; then: { state: string; tool: string | null; purse: string | null; stars: number } };

// The world pack: everything that differs between applications. An application with no axes simply has no mind part yet.
export type WorldPack = {
  id: string; version: string;
  axes: { id: string; left: string; right: string }[];
  tiers: Record<Tier, { noise: number; floor: number }>;
  surprise: number;                                      // how much a choice outside the halo widens it
  skipWeight: number;                                    // a skip is weaker evidence than a keep
  care: { said: number; max: number };                   // how much one mention raises a care, and its cap
  budget: Budget;
  tools: ToolSpec[];
  counters: string[];                                    // the only names a policy row may read
  policy: PolicyRow[];                                   // read from the top; the first row that matches wins
  readout: { fact: string; shows_as: string; where: string }[];   // one fact, one thing in the space
  // Where a thing sits on an axis is computed from its discrete, checkable properties by this table. No model writes that number.
  rubric: { flag: string; value: string; axis: string; x: number }[];   // flag "need" matches a thing's need tags; any other flag matches its flags[flag]
  aliases?: Record<string, string>;                                      // a pack's own counter names -> the runner's standard counters (day.ts)
  needs: { id: string; means: string; terms: string[] }[];           // what a person may want; terms are for hearing with no model
  fields: { id: string; labels: string[]; headline?: boolean }[];    // what a thing may state; labels are the words a page prints next to it
  gate: { yes: number; confidence: number };
  recipes?: { id: string; goal?: string; makes: string; assets: string[] }[];   // things it can make as typed data that a player in the space turns into the thing (ENGINE.md 5b); schemas and floors come with M3
  assets?: { id: string; licence: string; credit: string }[];
};

type Base = { id: string; at: string; undone?: boolean };
// One log for everything. The clock is an event ("day"): no reducer ever reads the time.
export type Event = Base & (
  | { type: "day"; date: string }
  | { type: "said"; text: string; needs: { id: string; quote: string }[] }
  | { type: "intent"; call: string; tool: string; by: "self" | "person"; purse: string; stars: number }   // stars reserved before the call
  | { type: "result"; call: string; ok: boolean; tokens?: number }                                          // settled, or released when it failed
  | { type: "earn"; source: string; times?: number }                                                        // stars come in by one of the pack's ways of earning
  | { type: "goal"; goal: string | null }                                                                   // it sets itself something bigger than a day, or is done with it
  | { type: "trip"; call?: string; place: string; found: string[]; seal?: string; predicted?: Record<string, number> }
  | { type: "choice"; find: string; action: "keep" | "skip"; flags?: Record<string, string | null>; needs?: string[];   // what the thing is; the rubric turns that into evidence
      evidence?: { axis: string; x: number }[] }                                                            // legacy: numbers a model wrote, as in the campus app's older logs
  | { type: "went"; find: string }
  | { type: "space"; by: "person" | "self"; what: string; item?: string });

export type OpenCall = { call: string; tool: string; purse: string; stars: number; fromSavings: number; by: "self" | "person"; charged: boolean };
export type State = {
  day: string | null; days: number;
  beliefs: Record<string, Belief>; care: Record<string, number>;
  purses: Record<string, number>; reservoir: number; savings: number; goal: string | null;
  spent: Record<string, number>;                         // all-time, per purse; never goes down
  used: Record<string, number>;                          // calls per tool today, including what the person asked for
  spentToday: Record<string, number>; earnedToday: Record<string, number>;
  tokens: number;
  desk: string[]; kept: string[]; skipped: string[]; went: string[];
  open: OpenCall[]; expired: string[];
};

// A thing from the base, as the engine sees it: public, checked, and carrying only discrete properties.
export type Item = { id: string; name: string; summary?: string | null; needs: string[]; flags: Record<string, string | null> };

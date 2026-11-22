// Engine core types (M0). Pure data: no network, no storage, no framework, no clock.
export type Tier = "self_reported" | "checked" | "seen_over_time" | "actually_done";
export type Purse = "for_you" | "for_itself";
export type Belief = { m: number; u: number };          // position in [-1, 1]; u is the halo, in [floor, 1]

// The part of a world pack that the core needs so far. It grows in M1; nothing here is a function.
export type CorePack = {
  id: string;
  axes: string[];
  tiers: Record<Tier, { noise: number; floor: number }>;
  surprise: number;                                      // how much a choice outside the halo widens it
  daily: Record<Purse, number>;                          // stars at the start of each day
  saves: Purse;                                          // the purse whose unspent stars carry over as savings
  care: { said: number; max: number };                   // how much one mention raises a care, and its cap
  skipWeight: number;                                    // a skip is weaker evidence than a keep
};

type Base = { id: string; at: string; undone?: boolean };
// One log for everything. The clock is an event ("day"): no reducer ever reads the time.
export type Event = Base & (
  | { type: "day"; date: string }
  | { type: "said"; text: string; needs: { id: string; quote: string }[] }
  | { type: "intent"; call: string; tool: string; by: "self" | "person"; purse: Purse; stars: number }   // stars reserved before the call
  | { type: "result"; call: string; ok: boolean; tokens?: number }                                          // settled, or released when it failed
  | { type: "trip"; call?: string; place: string; found: string[]; seal?: string; predicted?: Record<string, number> }
  | { type: "choice"; find: string; action: "keep" | "skip"; evidence: { axis: string; x: number }[] }     // evidence is still model-written today; M3 replaces it with flags and a rubric
  | { type: "went"; find: string }
  | { type: "space"; by: "person" | "self"; what: string; item?: string });

export type OpenCall = { call: string; tool: string; purse: Purse; stars: number; by: "self" | "person" };
export type State = {
  day: string | null; days: number;
  beliefs: Record<string, Belief>; care: Record<string, number>;
  purses: Record<Purse, number>; savings: number; spent: Record<Purse, number>;   // spent is all-time and never goes down
  used: Record<string, number>;                          // calls per tool today, including what the person asked for
  tokens: number;
  desk: string[]; kept: string[]; skipped: string[]; went: string[];
  open: OpenCall[]; expired: string[];
};

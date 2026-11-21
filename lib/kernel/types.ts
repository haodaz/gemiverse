// The kernel: every action a Gemi can take is a registered tool, charged and governed here.
export type Scope = "shared" | "private" | "pairwise" | "public_web";
export type Purse = "for_you" | "for_itself";
export type Mode = "think" | "act" | "make";
export type Stage = 1 | 2 | 3 | 4 | 5;

export type ToolSpec = {
  name: string;
  mode: Mode;
  does: string;                 // one sentence the student can read
  serves: string[];             // which student needs or self-needs it answers
  reads: Scope[];
  writes: Scope[];
  purse: Purse;
  stars: number;                // charged before the call
  dailyCap: number;
  reversible: boolean;
  confirm: "never" | "first_time" | "always";
  minStage: Stage;
  model?: string;               // the Gemini model that does the work, if any
  params: Record<string, string>;
};

export type GemiState = {
  stage: Stage;
  purses: Record<Purse, number>;
  usedToday: Record<string, number>;   // tool name -> calls today
  confirmed: string[];                  // "tool" or "tool:target" the student has said yes to
  paused: boolean;
};

export type Verdict =
  | { ok: true; charge: { purse: Purse; stars: number } }
  | { ok: false; reason: string; needs?: "confirm" | "stars" | "stage" };

// Private side: an append-only log. Beliefs, room, ledger and diary are computed from it.
export type GemiEvent = {
  id: string; at: string; type: string;
  tool?: string; mode?: Mode; purse?: Purse; stars?: number; tokens?: number;
  data?: Record<string, unknown>; undone?: boolean;
};

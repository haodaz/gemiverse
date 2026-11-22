import type { WorldPack } from "../engine/core/types";

// AI ME (Pingfang Campus) as a world pack, ON PAPER. AI ME does not run on this engine yet. The numbers were read on
// 22 Nov 2026 from its own rules in another repository (programcrawler: src/lib/campus/energy.ts, version 33):
//   one purse: stars are the AI's own pocket money, and going out to look for things costs none;
//   a jar that starts with 70 (seven days), 10 drawn each day, a star is about 2,000 tokens;
//   a pack of 10 stars for 10 carbon credits; unspent stars go back to the jar, or into savings while it has a goal;
//   three big moves at 20, 25 and 30 stars, paid from savings first; a diary entry or a small change costs 1;
//   what it does each day is decided by a repeatable roll of the dice, not by a model.
// The caps and the readout rows are my reading of that code and are to be confirmed by AI ME's side.
// AI ME has no axes: it remembers facts the person can accept or reject. So it uses the space and budget parts, and no mind part yet.
export const aime: WorldPack = {
  id: "aime", version: "0.1-paper",
  axes: [],
  tiers: { self_reported: { noise: 2.5, floor: 0.55 }, checked: { noise: 1.0, floor: 0.10 }, seen_over_time: { noise: 0.45, floor: 0.10 }, actually_done: { noise: 0.22, floor: 0.10 } },
  surprise: 0.15, skipWeight: 0.5, care: { said: 0.5, max: 1 },
  purses: { self: { daily: 10, carry: "reservoir" } },
  reservoir: { seed: 70, topUp: { stars: 10, cost: 10, unit: "carbon credit" } },
  goalBank: true, tokensPerStar: 2000,
  goals: [{ id: "make", stars: 20 }, { id: "theme", stars: 25 }, { id: "gift", stars: 30 }],
  tools: [
    { name: "go_out", purse: null, stars: 0, cap: 3, stage: 1, confirm: "never", does: "Walk the campus for you and bring things back." },
    { name: "write_diary", purse: "self", stars: 1, cap: 1, stage: 1, confirm: "never", does: "Write today's diary when something happened." },
    { name: "customize", purse: "self", stars: 1, cap: 1, stage: 1, confirm: "never", does: "Change one small thing in its room; you can put it back." },
  ],
  counters: ["paused", "hasGoal", "bank", "self", "goalCost", "roll"],
  policy: [
    { id: "paused", when: { is: "paused" }, then: { state: "rest", tool: null, purse: null, stars: 0 } },
    { id: "big", when: { all: [{ is: "hasGoal" }, { cmp: [{ sum: ["bank", { max: [0, { sub: ["self", 1] }] }] }, ">=", "goalCost"] }] }, then: { state: "big", tool: null, purse: "self", stars: 0 } },   // the diary's star is kept back
    { id: "save", when: { is: "hasGoal" }, then: { state: "save", tool: null, purse: null, stars: 0 } },
    { id: "set_goal", when: { cmp: ["roll", "<", 0.3] }, then: { state: "save", tool: null, purse: null, stars: 0 } },
    { id: "custom", when: { cmp: ["roll", "<", 0.75] }, then: { state: "custom", tool: "customize", purse: "self", stars: 1 } },
    { id: "rest", when: { always: true }, then: { state: "rest", tool: null, purse: null, stars: 0 } },
  ],
  readout: [
    { fact: "stars left in the jar", shows_as: "stars piled in a glass jar, by how many are left", where: "the jar" },
    { fact: "what it changed in its room", shows_as: "the changed thing, with a way to put it back", where: "the room" },
    { fact: "things it brought back", shows_as: "items in the basket by its door, each with where it was found", where: "the basket" },
  ],
  gate: { yes: 0.8, confidence: 0.5 },
};

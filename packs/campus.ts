import type { WorldPack } from "../engine/core/types";
import { AXES } from "../lib/mind";
import { TOOLS } from "../lib/kernel/tools";
import { SPACE } from "../lib/kernel/space";

// The campus Gemi as a world pack: the values the app runs on today, as data. Tests hold it to the app's own code
// (lib/mind.ts, lib/kernel/autonomy.ts), so the two cannot drift apart while the app still uses its own copies.
export const campus: WorldPack = {
  id: "campus", version: "0.1",
  axes: AXES.map((a) => ({ id: a.id, left: a.left, right: a.right })),
  tiers: { self_reported: { noise: 2.5, floor: 0.55 }, checked: { noise: 1.0, floor: 0.10 }, seen_over_time: { noise: 0.45, floor: 0.10 }, actually_done: { noise: 0.22, floor: 0.10 } },
  surprise: 0.15, skipWeight: 0.5, care: { said: 0.5, max: 1 },
  purses: { for_you: { daily: 6, carry: "lost" }, for_itself: { daily: 4, carry: "savings" } },
  goalBank: false, tokensPerStar: 1500,
  goals: [{ id: "write_song", stars: 6 }],
  tools: TOOLS.map((t) => ({ name: t.name, purse: t.purse, stars: t.stars, cap: t.dailyCap, stage: t.minStage, confirm: t.confirm, does: t.does })),   // no model names: which model does a job is the adapter's business
  counters: ["paused", "outNow", "pending", "hour", "roomChangedByStudent", "starsYou", "starsSelf", "idleSeconds", "widestHalo", "choices", "diaryToday", "hasGoal", "bank", "goalCost", "topCare"],
  policy: [
    { id: "paused", when: { is: "paused" }, then: { state: "paused", tool: null, purse: null, stars: 0 } },
    { id: "out", when: { is: "outNow" }, then: { state: "out", tool: "go_out", purse: null, stars: 0 } },
    { id: "waiting", when: { cmp: ["pending", ">", 0] }, then: { state: "waiting", tool: null, purse: null, stars: 0 } },
    { id: "asleep", when: { any: [{ cmp: ["hour", ">=", 23] }, { cmp: ["hour", "<", 7] }] }, then: { state: "asleep", tool: null, purse: null, stars: 0 } },
    { id: "notice", when: { is: "roomChangedByStudent" }, then: { state: "noticing", tool: null, purse: null, stars: 0 } },
    { id: "go", when: { all: [{ cmp: ["starsYou", ">=", 3] }, { cmp: ["idleSeconds", ">=", 45] }, { any: [{ cmp: ["widestHalo", ">=", 0.5] }, { cmp: ["choices", "<", 5] }] }] }, then: { state: "going_out", tool: "go_out", purse: "for_you", stars: 3 } },
    { id: "diary", when: { all: [{ cmp: ["choices", ">", 0] }, { not: { is: "diaryToday" } }, { cmp: ["starsSelf", ">=", 1] }] }, then: { state: "writing", tool: "write_diary", purse: "for_itself", stars: 1 } },
    { id: "make", when: { all: [{ is: "hasGoal" }, { cmp: [{ sum: ["bank", "starsSelf"] }, ">=", "goalCost"] }] }, then: { state: "making", tool: "write_song", purse: "for_itself", stars: 6 } },
    { id: "save", when: { all: [{ is: "hasGoal" }, { cmp: [{ sum: ["bank", "starsSelf"] }, "<", "goalCost"] }, { cmp: ["idleSeconds", ">=", 60] }] }, then: { state: "saving", tool: null, purse: null, stars: 0 } },
    { id: "tidy", when: { all: [{ cmp: ["starsSelf", ">=", 1] }, { cmp: ["idleSeconds", ">=", 120] }] }, then: { state: "tidying", tool: "decorate_room", purse: "for_itself", stars: 1 } },
    { id: "rest", when: { all: [{ cmp: ["starsYou", "<", 3] }, { cmp: ["starsSelf", "<", 1] }] }, then: { state: "resting", tool: null, purse: null, stars: 0 } },
    { id: "potter", when: { always: true }, then: { state: "pottering", tool: null, purse: null, stars: 0 } },
  ],
  readout: SPACE.map((r) => ({ fact: r.fact, shows_as: r.shows_as, where: r.where })),
  gate: { yes: 0.8, confidence: 0.5 },
  assets: [{ id: "kaykit-adventurers", licence: "CC0 1.0", credit: "KayKit Character Pack: Adventurers by Kay Lousberg" }],
};

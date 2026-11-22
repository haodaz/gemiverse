import type { WorldPack } from "../engine/core/types";
import { AXES } from "../lib/mind";
import { TOOLS } from "../lib/kernel/tools";
import { SPACE } from "../lib/kernel/space";
import { NEEDS } from "../lib/needs";

// Words a person uses for each need: the plainest way of hearing, with no model. Written by hand on 22 Nov; the benchmark measures how far they get.
const TERMS: Record<string, string[]> = {
  find_my_people: ["find people", "meet people", "make friends", "friends", "community", "club", "people who", "belong"],
  build_a_skill: ["learn to", "learn how", "get better at", "practice", "workshop", "skill", "improve my"],
  explore_a_field: ["curious about", "explore", "what is it like", "try out", "sample", "look into"],
  get_experience: ["internship", "experience", "project", "competition", "hackathon", "research position", "volunteer role"],
  make_and_express: ["make things", "build things", "perform", "write songs", "paint", "compose", "create", "play music"],
  get_mentorship_and_feedback: ["feedback", "advice", "mentor", "someone to look at", "critique", "office hours"],
  decide_a_direction: ["decide", "which major", "what to do after", "direction", "choose between", "career path"],
  fund_my_path: ["scholarship", "funding", "grant", "paid", "stipend", "money for"],
  contribute_beyond_self: ["volunteer", "give back", "help others", "community service", "tutor"],
  navigate_systems: ["how do i", "register for", "the library system", "paperwork", "requirements", "deadline for"],
  rest_and_recover: ["rest", "relax", "tired", "wear me out", "burned out", "take a break", "quiet"],
};

// The campus Gemi as a world pack: the values the app runs on today, as data. Tests hold it to the app's own code
// (lib/mind.ts, lib/kernel/autonomy.ts), so the two cannot drift apart while the app still uses its own copies.
export const campus: WorldPack = {
  id: "campus", version: "0.1",
  axes: AXES.map((a) => ({ id: a.id, left: a.left, right: a.right })),
  tiers: { self_reported: { noise: 2.5, floor: 0.55 }, checked: { noise: 1.0, floor: 0.10 }, seen_over_time: { noise: 0.45, floor: 0.10 }, actually_done: { noise: 0.22, floor: 0.10 } },
  surprise: 0.15, skipWeight: 0.5, care: { said: 0.5, max: 1 },
  // The campus Gemi's own choices; none of these is an engine rule.
  budget: { tokensPerStar: 1500, settle: "fixed",
    purses: { for_you: { daily: 6, carry: "lost" }, for_itself: { daily: 4, carry: "savings" } },
    goalBank: false, asked: { charge: "free" }, earn: [],
    goals: [{ id: "write_song", stars: 6 }] },
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
  // The first rubric, written by hand on 22 Nov from what the kinds and needs mean. It is a starting point to be tested, not a finding.
  // Axes: pace (polish slowly - / try fast +), scope (deep on one - / touch many +), arena (public stakes - / private space +),
  // closeness (principles - / make things +), horizon (nearby - / outward +), structure (guided - / self-directed +), collaboration (alone - / group +).
  rubric: [
    ...([["social_study_break", "collaboration", 0.7], ["social_study_break", "structure", 0.4], ["social_study_break", "scope", 0.3], ["workshop", "structure", -0.6], ["workshop", "closeness", 0.5], ["workshop", "scope", -0.3],
      ["talk_panel", "closeness", -0.6], ["talk_panel", "structure", -0.4], ["talk_panel", "horizon", 0.4], ["talk_panel", "collaboration", -0.2], ["community_wellness", "arena", 0.6], ["community_wellness", "pace", -0.4],
      ["performance_exhibit", "arena", -0.5], ["performance_exhibit", "closeness", 0.3], ["performance_exhibit", "horizon", 0.3], ["competition_showcase", "arena", -0.8], ["competition_showcase", "pace", 0.7], ["competition_showcase", "collaboration", 0.3]] as [string, string, number][]).map(([value, axis, x]) => ({ flag: "event_kind", value, axis, x })),
    ...([["find_my_people", "collaboration", 0.5], ["build_a_skill", "scope", -0.4], ["build_a_skill", "structure", -0.2], ["explore_a_field", "scope", 0.5], ["explore_a_field", "closeness", -0.3], ["get_experience", "pace", 0.4], ["get_experience", "closeness", 0.4],
      ["make_and_express", "closeness", 0.4], ["make_and_express", "structure", 0.3], ["rest_and_recover", "arena", 0.5], ["rest_and_recover", "pace", -0.3], ["contribute_beyond_self", "horizon", 0.6], ["decide_a_direction", "horizon", 0.3], ["decide_a_direction", "scope", 0.2],
      ["get_mentorship_and_feedback", "collaboration", -0.2], ["get_mentorship_and_feedback", "structure", -0.3], ["navigate_systems", "structure", -0.5], ["fund_my_path", "horizon", 0.2]] as [string, string, number][]).map(([value, axis, x]) => ({ flag: "need", value, axis, x })),
  ],
  aliases: { starsYou: "purse.for_you", starsSelf: "purse.for_itself", pending: "desk", bank: "savings", diaryToday: "used.write_diary", outNow: "open.go_out" },
  needs: Object.entries(NEEDS).map(([id, n]) => ({ id, means: n.means, terms: TERMS[id] ?? [] })),
  fields: [
    { id: "title", labels: [], headline: true },
    { id: "venue_name", labels: ["where:", "location:", "location", "venue:", "place:", "room:", "at the", "held in"] },
    { id: "street_address", labels: ["address:", "where:", "location:", "location", "located at"] },
    { id: "organisation_name", labels: ["hosted by", "presented by", "organized by", "organised by", "sponsored by", "host:", "sponsor:", "department:", "by the"] },
  ],
  gate: { yes: 0.8, confidence: 0.5 },
  assets: [{ id: "kaykit-adventurers", licence: "CC0 1.0", credit: "KayKit Character Pack: Adventurers by Kay Lousberg" }],
};

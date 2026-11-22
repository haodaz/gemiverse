// M0, part 1: today's behaviour, frozen. These tests run against the campus app's own files (lib/), and hold the new
// engine core to them, so moving code later cannot change what the app does without a test saying so.
import test from "node:test";
import assert from "node:assert/strict";
import { step as appStep, replay as appReplay, AXES } from "../../lib/mind";
import { mayCall } from "../../lib/kernel/governance";
import { decide, POLICY } from "../../lib/kernel/autonomy";
import { decide as decideData, validatePack } from "../core/predicate";
import { TOOLS } from "../../lib/kernel/tools";
import { step } from "../core/mind";
import { replay, fromLegacy } from "../core/replay";
import { campus } from "../../packs/campus";

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);

test("the pack's axes are the app's axes", () => assert.deepEqual(campus.axes.map((a) => a.id), AXES.map((a) => a.id)));

test("the engine's belief step is the app's, over a grid", () => {
  let n = 0;
  for (const tier of ["self_reported", "checked", "seen_over_time", "actually_done"] as const)
    for (const m of [-1, -0.4, 0, 0.3, 1]) for (const u of [0.1, 0.3, 0.55, 0.8, 1]) for (const x of [-1, -0.5, 0, 0.6, 1]) for (const w of [0.5, 1]) {
      const a = appStep({ m, u }, x, tier, w), b = step(campus, { m, u }, x, tier, w); near(a.m, b.m); near(a.u, b.u); n++; }
  assert.equal(n, 1000);
});

const legacy: any[] = [
  { id: "a", at: "t1", type: "said", text: "I want to find people who make things. Big crowds wear me out.", needs: [{ id: "find_my_people", quote: "find people" }, { id: "make_and_express", quote: "make things" }] },
  { id: "b", at: "t2", type: "trip", place: "clubs", stars: 3, found: ["e1", "e2", "e3"], predicted: { e1: 0.7, e2: 0.4, e3: 0.5 }, seal: "h", reason: "r" },
  { id: "c", at: "t3", type: "choice", find: "e1", title: "T1", action: "keep", shownWith: [], evidence: [{ axis: "collaboration", x: -0.7, why: "small group" }, { axis: "structure", x: 0.4, why: "open" }] },
  { id: "d", at: "t4", type: "choice", find: "e2", title: "T2", action: "skip", shownWith: [], evidence: [{ axis: "collaboration", x: 0.8, why: "large party" }] },
  { id: "e", at: "t5", type: "choice", find: "e3", title: "T3", action: "keep", shownWith: [], evidence: [{ axis: "pace", x: 0.9, why: "hack night" }], undone: true },
  { id: "f", at: "t6", type: "said", text: "also find people", needs: [{ id: "find_my_people", quote: "find people" }] },
  { id: "g", at: "t7", type: "room", by: "student", what: "moved the chair", item: "chair" },
];
test("a browser log from the app replays to the same beliefs and cares in the engine", () => {
  const a = appReplay(legacy), b = replay(campus, fromLegacy(legacy));
  for (const { id: ax } of campus.axes) { near(a.beliefs[ax as keyof typeof a.beliefs].m, b.beliefs[ax].m); near(a.beliefs[ax as keyof typeof a.beliefs].u, b.beliefs[ax].u); }
  assert.deepEqual(a.care, b.care); assert.deepEqual(b.care, { find_my_people: 1, make_and_express: 0.5 });
  assert.deepEqual(b.kept, ["e1"]); assert.deepEqual(b.skipped, ["e2"]); assert.deepEqual(b.desk, ["e3"]);   // the undone choice puts its card back on the desk
});

test("today's numbers after one keep and one skip on the same axis", () => {
  const b = replay(campus, fromLegacy(legacy)).beliefs.collaboration;
  // worked by hand: keep at -0.7 from (0, 1): k = 1/2, m = -0.35, u = sqrt(1/2). Then a skip at 0.8 with weight 0.5: k = 0.5/(0.5 + 2) = 0.2, m = -0.35 + 0.2 * (-0.8 + 0.35) = -0.44, u = sqrt(0.8 * 0.5).
  near(b.m, -0.44); near(b.u, Math.sqrt(0.4));   // a change here is a change in what people see
  assert.deepEqual(replay(campus, fromLegacy(legacy)).beliefs.pace, { m: 0, u: 1 });
});

const st = (o = {}) => ({ stage: 1 as const, purses: { for_you: 6, for_itself: 4 }, usedToday: {}, confirmed: [], paused: false, ...o });
test("governance: what refuses in code today", () => {
  assert.equal(mayCall("launch_rocket", st()).ok, false);
  assert.equal(mayCall("go_out", st({ paused: true })).ok, false);
  assert.deepEqual(mayCall("go_out", st()), { ok: true, charge: { purse: "for_you", stars: 3 } });
  assert.deepEqual(mayCall("go_out", st(), "", "student"), { ok: true, charge: { purse: "for_you", stars: 0 } });   // what the person asks for is not charged
  assert.equal((mayCall("go_out", st({ purses: { for_you: 2, for_itself: 4 } })) as any).needs, "stars");
  assert.equal(mayCall("go_out", st({ purses: { for_you: 2, for_itself: 4 } }), "", "student").ok, true);           // and not blocked by an empty purse
  assert.equal(mayCall("go_out", st({ usedToday: { go_out: 3 } })).ok, false);                                      // the daily cap
  assert.equal((mayCall("meet_gemi", st()) as any).needs, "stage");
  assert.equal((mayCall("ask_agent", st({ stage: 3 })) as any).needs, "confirm");
  assert.equal(mayCall("ask_agent", st({ stage: 3, confirmed: ["ask_agent"] })).ok, true);
});
test("the registry: every tool has a price, a cap, a purse and a stage", () => {
  assert.equal(TOOLS.length, 14);
  for (const t of TOOLS) { assert.ok(t.stars >= 0 && t.dailyCap > 0 && ["for_you", "for_itself"].includes(t.purse) && t.minStage >= 1, t.name); }
});

const sit = (o = {}) => ({ pending: 0, outNow: false, starsYou: 6, starsSelf: 4, choices: 0, widestHalo: 1, topCare: 0, hour: 14, idleSeconds: 0, diaryToday: false, paused: false, bank: 0, goalCost: 6, goalName: null, roomChangedByStudent: false, ...o });
test("autonomy: the policy table, first match wins", () => {
  assert.equal(POLICY.length, 12);
  const rule = (o = {}) => decide(sit(o) as any).rule;
  assert.equal(rule({ paused: true, pending: 3 }), "paused");
  assert.equal(rule({ outNow: true, pending: 3 }), "out");
  assert.equal(rule({ pending: 2, hour: 2 }), "waiting");                       // finds on the desk come before night
  assert.equal(rule({ hour: 2 }), "asleep");
  assert.equal(rule({ roomChangedByStudent: true }), "notice");
  assert.equal(rule({ idleSeconds: 60 }), "go");
  assert.equal(rule({ idleSeconds: 60, starsYou: 2 }), "potter");
  assert.equal(rule({ choices: 6, widestHalo: 0.3, idleSeconds: 10 }), "diary");
  assert.equal(rule({ choices: 6, widestHalo: 0.3, diaryToday: true, goalName: "write_song", bank: 3, idleSeconds: 10 }), "make");
  assert.equal(rule({ choices: 6, widestHalo: 0.3, diaryToday: true, goalName: "write_song", bank: 0, idleSeconds: 90 }), "save");
  assert.equal(rule({ choices: 6, widestHalo: 0.3, diaryToday: true, idleSeconds: 200 }), "tidy");
  assert.equal(rule({ starsYou: 0, starsSelf: 0, diaryToday: true }), "rest");
  assert.equal(decide(sit({ idleSeconds: 60 }) as any).stars, 3);
});

test("the policy as data decides exactly as the app's policy as code, on 20,000 situations", () => {
  let h = 12345; const rnd = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; }, pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const seen = new Set<string>();
  for (let i = 0; i < 20000; i++) {
    const s = { pending: pick([0, 0, 1, 3]), outNow: rnd() < 0.08, starsYou: pick([0, 2, 3, 6]), starsSelf: pick([0, 1, 2, 4]), choices: pick([0, 1, 4, 5, 9]), widestHalo: pick([0.2, 0.49, 0.5, 0.9, 1]), topCare: rnd(),
      hour: Math.floor(rnd() * 24), idleSeconds: pick([0, 44, 45, 59, 60, 119, 120, 300]), diaryToday: rnd() < 0.5, paused: rnd() < 0.05, bank: pick([0, 2, 4, 6]), goalCost: 6, goalName: pick([null, null, "write_song"]), roomChangedByStudent: rnd() < 0.1 };
    const a = decide(s as any), { goalName, ...rest } = s, b = decideData(campus, { ...rest, hasGoal: !!goalName });
    assert.equal(b.id, a.rule); assert.equal(b.then.state, a.state); assert.equal(b.then.tool, a.method); assert.equal(b.then.purse, a.purse); assert.equal(b.then.stars, a.stars); seen.add(a.rule);
  }
  assert.equal(seen.size, 12, "every row should have been reached: " + [...seen].join(" "));
});
test("the campus pack is valid, and its tools are the app's registry without model names", () => {
  assert.deepEqual(validatePack(campus), []); assert.equal(campus.tools.length, TOOLS.length); assert.ok(!JSON.stringify(campus.tools).includes("gemini"));
});

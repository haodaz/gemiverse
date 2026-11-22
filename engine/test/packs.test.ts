// M1: two applications, one pack type. AI ME's pack is on paper (it does not run on the engine yet); its budget rules are
// worked by hand here from its own energy rules, so the engine's replay is known to be able to carry them.
import test from "node:test";
import assert from "node:assert/strict";
import { replay } from "../core/replay";
import { decide, validatePack } from "../core/predicate";
import { campus } from "../../packs/campus";
import { aime } from "../../packs/aime";
import type { Event, WorldPack } from "../core/types";

let k = 0; const ev = (e: any): Event => ({ id: `p${++k}`, at: `t${k}`, ...e });
const day = (date: string) => ev({ type: "day", date }), spend = (call: string, tool: string, stars: number) => [ev({ type: "intent", call, tool, by: "self", purse: "self", stars }), ev({ type: "result", call, ok: true })];

test("both packs load: no function, no unknown name, a policy that always ends", () => {
  for (const p of [campus, aime]) { assert.deepEqual(validatePack(p), [], p.id); assert.deepEqual(JSON.parse(JSON.stringify(p)), p, p.id + " is plain data"); }
});
test("a broken pack does not load, and says why", () => {
  const bad: WorldPack = { ...aime, reservoir: undefined, policy: [{ id: "x", when: { cmp: ["mood", ">", 1] }, then: { state: "s", tool: "fly", purse: "gold", stars: 1 } }] };
  const why = validatePack(bad).join(" | ");
  for (const part of ["must end with a row that always holds", "\"mood\", which is not a declared counter", "unknown tool \"fly\"", "unknown purse \"gold\"", "returns to a reservoir", "goalBank needs a reservoir"]) assert.ok(why.includes(part), part + " :: " + why);
});

test("AI ME's jar: 70 to start, 10 drawn a day, what is left goes back", () => {
  const d1 = replay(aime, [day("d1")]); assert.equal(d1.reservoir, 60); assert.equal(d1.purses.self, 10);
  const d2 = replay(aime, [day("d1"), ...spend("c1", "customize", 1), day("d2")]); assert.equal(d2.reservoir, 59); assert.equal(d2.purses.self, 10); assert.equal(d2.savings, 0);   // 60 + 9 back - 10 drawn
});
test("AI ME saving for a big move: unspent stars go to savings, the move is paid from savings first, the rest returns to the jar", () => {
  const log = [day("d1"), ev({ type: "goal", goal: "theme" }), day("d2"), day("d3")];                       // two days without spending
  const s = replay(aime, log); assert.equal(s.savings, 20); assert.equal(s.purses.self, 10); assert.equal(s.reservoir, 40);
  const cost = aime.goals.find((g) => g.id === "theme")!.stars;
  assert.equal(decide(aime, { paused: false, hasGoal: true, bank: s.savings, self: s.purses.self, goalCost: cost, roll: 0.9 }).id, "big");   // 20 + (10 - 1) >= 25
  assert.equal(decide(aime, { paused: false, hasGoal: true, bank: 10, self: 10, goalCost: cost, roll: 0.9 }).id, "save");                     // 10 + 9 < 25
  const done = replay(aime, [...log, ...spend("big", "theme", cost), ev({ type: "goal", goal: null })]);
  assert.equal(done.savings, 0); assert.equal(done.purses.self, 5); assert.equal(done.goal, null); assert.equal(done.reservoir, 40); assert.equal(done.spent.self, 25);
});
test("AI ME's day by a roll of the dice, and a pause that stops it", () => {
  const c = (roll: number, o = {}) => decide(aime, { paused: false, hasGoal: false, bank: 0, self: 10, goalCost: 0, roll, ...o }).id;
  assert.equal(c(0.1), "set_goal"); assert.equal(c(0.5), "custom"); assert.equal(c(0.9), "rest"); assert.equal(c(0.1, { paused: true }), "paused");
});
test("AI ME's jar runs dry, and a top-up refills it", () => {
  const small: WorldPack = { ...aime, reservoir: { seed: 14 } };
  const s = replay(small, [day("d1"), ...spend("a", "customize", 10), day("d2"), ...spend("b", "customize", 4), day("d3")]);
  assert.equal(s.purses.self, 0); assert.equal(s.reservoir, 0);                                              // 14 -> 10 spent, 4 drawn and spent, nothing left to draw
  const t = replay(small, [day("d1"), ...spend("a", "customize", 10), day("d2"), ...spend("b", "customize", 4), ev({ type: "topup", stars: 10, cost: 10 }), day("d3")]);
  assert.equal(t.purses.self, 10); assert.equal(t.reservoir, 0);
});
test("one engine, two budgets: the campus Gemi's two purses are granted, AI ME's one purse is drawn from a jar", () => {
  assert.deepEqual(replay(campus, [day("d1")]).purses, { for_you: 6, for_itself: 4 }); assert.equal(replay(campus, [day("d1")]).reservoir, 0);
  assert.deepEqual(replay(aime, [day("d1")]).purses, { self: 10 });
});

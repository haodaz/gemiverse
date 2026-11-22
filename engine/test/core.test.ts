// M0, part 2: the rules of the one log. These are new (the app has no such log yet), and they are the engine's invariants 1 to 5.
import test from "node:test";
import assert from "node:assert/strict";
import { replay, undo } from "../core/replay";
import { step } from "../core/mind";
import { campus } from "../../packs/campus";
import type { Event } from "../core/types";

let k = 0; const ev = (e: any): Event => ({ id: `e${++k}`, at: `t${k}`, ...e });
const day = (date: string) => ev({ type: "day", date });
const intent = (call: string, tool: string, by: "self" | "person", purse: "for_you" | "for_itself", stars: number) => ev({ type: "intent", call, tool, by, purse, stars });
const result = (call: string, ok = true, tokens = 0) => ev({ type: "result", call, ok, tokens });
const choice = (find: string, action: "keep" | "skip", axis = "collaboration", x = -0.7) => ev({ type: "choice", find, action, evidence: [{ axis, x }] });

test("1. replay is deterministic and survives being stored as text", () => {
  const log = [day("2026-11-21"), intent("c1", "go_out", "self", "for_you", 3), result("c1", true, 4200), ev({ type: "trip", call: "c1", place: "library", found: ["a", "b", "c"] }), choice("a", "keep"), choice("b", "skip", "collaboration", 0.8)];
  assert.deepEqual(replay(campus, log), replay(campus, JSON.parse(JSON.stringify(log))));
  assert.deepEqual(replay(campus, log), replay(campus, log));
});

test("2. undo is a mark, and equals replay without the event", () => {
  const a = choice("a", "keep"), b = choice("b", "skip", "collaboration", 0.8), base = [day("d1"), ev({ type: "trip", place: "clubs", found: ["a", "b"] })];
  const undone = replay(campus, undo([...base, a, b], a.id)), without = replay(campus, [...base, b]);
  assert.deepEqual(undone.beliefs, without.beliefs); assert.deepEqual(undone.kept, []); assert.deepEqual(undone.desk, ["a"]);
  assert.equal(undo([...base, a, b], a.id).length, 4);                                    // nothing was deleted
  assert.deepEqual(replay(campus, undo(undo([...base, a, b], a.id), a.id, false)), replay(campus, [...base, a, b]));   // and it can be put back
});

test("3. undo never refunds: stars and the day's use stay spent", () => {
  const i = intent("c1", "go_out", "self", "for_you", 3), log = [day("d1"), i, result("c1", true, 4000)];
  const before = replay(campus, log), after = replay(campus, undo(undo(log, i.id), log[2].id));
  assert.equal(before.purses.for_you, 3); assert.deepEqual(after.purses, before.purses); assert.deepEqual(after.used, { go_out: 1 }); assert.equal(after.spent.for_you, 3);
});

test("3b. what the person asks for is never charged; what it does unasked is charged before the call", () => {
  const s = replay(campus, [day("d1"), intent("c1", "go_out", "person", "for_you", 3), intent("c2", "go_out", "self", "for_you", 3)]);
  assert.equal(s.purses.for_you, 3); assert.deepEqual(s.used, { go_out: 2 }); assert.deepEqual(s.open.map((c) => c.stars), [0, 3]);
});

test("a call has a life: a failure releases the stars, an open call expires with the day", () => {
  assert.equal(replay(campus, [day("d1"), intent("c1", "go_out", "self", "for_you", 3), result("c1", false)]).purses.for_you, 6);
  const open = replay(campus, [day("d1"), intent("c1", "go_out", "self", "for_you", 3)]);
  assert.equal(open.purses.for_you, 3); assert.equal(open.open.length, 1);               // "out": reserved, not yet settled
  const next = replay(campus, [day("d1"), intent("c1", "go_out", "self", "for_you", 3), day("d2"), result("c1", true, 9999)]);
  assert.deepEqual(next.open, []); assert.deepEqual(next.expired, ["c1"]); assert.equal(next.purses.for_you, 6); assert.equal(next.tokens, 0);   // the late result is ignored
});

test("saving: what it does not spend on itself carries over; a bigger thing is paid from savings", () => {
  const twoQuietDays = [day("d1"), intent("p1", "plan_day", "self", "for_itself", 2), result("p1"), day("d2"), intent("p2", "plan_day", "self", "for_itself", 2), result("p2"), day("d3")];
  const s = replay(campus, twoQuietDays); assert.equal(s.savings, 4); assert.deepEqual(s.purses, { for_you: 6, for_itself: 4 });   // for_you does not carry over
  const song = replay(campus, [...twoQuietDays, intent("s", "write_song", "self", "for_itself", 6), result("s")]);
  assert.equal(song.purses.for_itself, 0); assert.equal(song.savings, 2); assert.equal(song.spent.for_itself, 10);
});

test("5. words alone stop at the 'said' floor; a choice outside the halo widens it", () => {
  let b = { m: 0, u: 1 }; for (let i = 0; i < 40; i++) b = step(campus, b, -0.6, "self_reported"); assert.equal(b.u, 0.55);
  const tight = { m: -0.6, u: 0.3 }, hit = step(campus, tight, 0.8, "checked"); assert.ok(hit.u > tight.u, "surprise should widen");
  const calm = step(campus, tight, -0.5, "checked"); assert.ok(calm.u < tight.u);
});

test("today's gap, recorded: what is said raises a care and does not move any axis", () => {
  const s = replay(campus, [day("d1"), ev({ type: "said", text: "big crowds wear me out", needs: [{ id: "rest_and_recover", quote: "wear me out" }] })]);
  assert.deepEqual(s.care, { rest_and_recover: 0.5 }); for (const a of campus.axes) assert.deepEqual(s.beliefs[a], { m: 0, u: 1 });
});

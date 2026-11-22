// A whole day, and several days, with no page, no renderer and no model: only the log, the pack and a snapshot of the base.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runDay, codedPerson, countersOf, chooseTask } from "../core/day";
import { place, predict, floorChoose } from "../core/mind";
import { replay } from "../core/replay";
import { validatePack } from "../core/predicate";
import { carryOut, NOTHING } from "../core/capability";
import { campus } from "../../packs/campus";
import type { Event, Item } from "../core/types";

const ITEMS: Item[] = JSON.parse(readFileSync(new URL("../../base/snapshots/nyu-events.json", import.meta.url), "utf8")).items;
const TRUTH = { pace: 0.6, scope: -0.5, arena: 0.4, closeness: 0.6, horizon: -0.2, structure: 0.3, collaboration: 0.6 };
const said: Event = { id: "s", at: "t", type: "said", text: "I want to find people who make things.", needs: [{ id: "find_my_people", quote: "find people" }, { id: "make_and_express", quote: "make things" }] };

test("the rubric places a thing from what it is, and the pack with a rubric is still valid", () => {
  assert.deepEqual(validatePack(campus), []);
  const p = Object.fromEntries(place(campus, { flags: { event_kind: "workshop" }, needs: ["build_a_skill"] }).map((x) => [x.axis, +x.x.toFixed(2)]));
  assert.deepEqual(p, { structure: -0.8, closeness: 0.5, scope: -0.7 });
  assert.deepEqual(place(campus, { flags: { event_kind: "unknown_kind" }, needs: [] }), []);
  assert.equal(predict(campus, replay(campus, []).beliefs, ITEMS[0]), 0.5);                // knowing nothing, it says one half
});

test("a thing kept moves the mind by the rubric, with no number from a model", () => {
  const item = ITEMS.find((i) => i.flags.event_kind === "social_study_break")!;
  const s = replay(campus, [{ id: "d", at: "t", type: "day", date: "d1" }, { id: "c", at: "t", type: "choice", find: item.id, action: "keep", flags: item.flags, needs: item.needs }]);
  assert.ok(s.beliefs.collaboration.m > 0.2 && s.beliefs.collaboration.u < 1); assert.ok(predict(campus, s.beliefs, item) > 0.5);
});

test("choosing with no model: three things, none seen before, two from opposite ends of the axis it knows least", () => {
  const s = replay(campus, [said]), ids = floorChoose(campus, s, ITEMS, "seed"); assert.equal(ids.length, 3); assert.equal(new Set(ids).size, 3);
  const again = replay(campus, [said, { id: "t", at: "t", type: "trip", place: "x", found: ids }]); assert.ok(floorChoose(campus, again, ITEMS, "seed").every((x) => !ids.includes(x)));
});
test("choosing by a model: the two ends of the axis are the engine's; the model picks only the third, from the list", async () => {
  const s = replay(campus, [said]), task = chooseTask(campus, s, ITEMS, "seed"), can = { ...NOTHING, form: 2 as const }, floor = floorChoose(campus, s, ITEMS, "seed"); let shown = "";
  const bad = await carryOut(task, async () => '{"id":"made-up-1"}', can, 0, "seed"); assert.equal(bad.by, "floor");
  const both = await carryOut(task, async () => JSON.stringify({ id: floor[0] }), can, 0, "seed"); assert.equal(both.by, "floor");   // it may not pick one of the two again
  const ok = await carryOut(task, async (p) => { shown = p; return JSON.stringify({ id: p.split("\n")[3].split(" | ")[0] }); }, can, 0, "seed");
  assert.equal(ok.by, "pick"); assert.deepEqual(ok.made.slice(0, 2), floor.slice(0, 2)); assert.equal(new Set(ok.made).size, 3); assert.ok(!shown.includes(floor[0] + " |") && !shown.includes(floor[1] + " |"));
});

test("one day with no model: it goes out twice on its own stars, the person chooses, it writes its diary, then stops", async () => {
  const { log, record } = await runDay({ pack: campus, log: [said], date: "2026-11-23", items: ITEMS, ask: null, profile: NOTHING, seed: "mochi", person: codedPerson(campus, TRUTH, "mia"), extra: { hour: 14, idleSeconds: 300 }, goal: "write_song" });
  assert.deepEqual(record.acts.map((a) => a.rule), ["go", "go", "diary", "save"]); assert.equal(record.guesses.length, 6);
  const s = replay(campus, log); assert.deepEqual(s.purses, { for_you: 0, for_itself: 3 }); assert.equal(s.kept.length + s.skipped.length, 6); assert.equal(s.desk.length, 0); assert.deepEqual(s.open, []);
  assert.deepEqual(countersOf(campus, s, { hour: 14, idleSeconds: 300 }).starsSelf, 3);
});

test("seven days with no model, against a person played by code: it saves, makes its song, and its guesses beat always guessing the commoner answer", async () => {
  let log: Event[] = [said], right = 0, total = 0, kept = 0; const person = codedPerson(campus, TRUTH, "mia"), song: number[] = [], halo: number[] = [];
  for (let d = 1; d <= 7; d++) { const before = replay(campus, log); const r = await runDay({ pack: campus, log, date: `2026-11-${22 + d}`, items: ITEMS, ask: null, profile: NOTHING, seed: "mochi", person, extra: { hour: 14, idleSeconds: 300 }, goal: before.days === 0 || before.goal ? "write_song" : undefined });
    log = r.log; if (r.record.acts.some((a) => a.tool === "write_song")) song.push(d); if (d >= 3) for (const g of r.record.guesses) { total++; if (g.kept) kept++; if ((g.p >= 0.5) === g.kept) right++; }
    const s = replay(campus, log); halo.push(campus.axes.reduce((a, x) => a + s.beliefs[x.id].u, 0) / campus.axes.length); }
  assert.ok(song.length >= 1, "it made the song it saved for");
  assert.ok(halo[6] < halo[0] && halo[0] < 1, "it grew surer: " + halo.map((h) => h.toFixed(2)).join(" "));
  // The person here is code that decides by the same rubric, so this shows the mechanism can recover leanings that are there to be found; it says nothing yet about real people.
  assert.ok(right > Math.max(kept, total - kept), `from day three its sealed guesses were right ${right} of ${total}; always guessing the commoner answer gives ${Math.max(kept, total - kept)}`);
  assert.deepEqual(replay(campus, log), replay(campus, JSON.parse(JSON.stringify(log))));       // and the whole week replays from the log alone
});

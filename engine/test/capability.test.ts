// A model is judged by what it does on small probes, and a task takes the richest route that model can carry and the stars allow.
// Every task ends in a route that needs no model. The "models" here are stand-ins written to behave like a strong, an ordinary and a poor one.
import test from "node:test";
import assert from "node:assert/strict";
import { probe, plan, carryOut, taskProblems, NOTHING, type Ask } from "../core/capability";
import { songTask, scoreProblems, floorScore, fromNotes, timeline, type Score } from "../recipes/song";

const SOUNDS = ["piano", "music_box"];
const goodScore = (): Score => ({ key: "G", mode: "major", bpm: 84, instrument: "music_box", chords: ["G", "D", "Em", "C", "G", "D", "C", "G"], melody: Array.from({ length: 32 }, (_, i) => ({ pitch: ["G4", "B4", "D5", "B4"][i % 4], beats: 1 })), words: ["a small song"], title: "Thursday" });
const strong: Ask = async (p) => p.includes('"colour"') ? '{"colour":"blue","count":3}' : p.includes('"bars"') ? '{"bars":[[1,1,2],[2,2],[1,1,1,1],[0.5,0.5,1,2]]}' : p.includes("8 musical notes") ? "C4 D4 E4 F4 G4 A4 B4 C5" : p.includes("JSON only") ? JSON.stringify(goodScore()) : "E4 G4 C5 B4 ".repeat(8);
const ordinary: Ask = async (p) => p.includes('"colour"') ? 'Sure! Here you go: {"colour": "red", "count": 2} Hope that helps.' : p.includes('"bars"') ? '{"bars":[[1,1,2],[2,2,2],[1,1,1,1],[4]]}' : p.includes("8 musical notes") ? "Here are the notes: C4 E4 G4 E4 C4 E4 G4 C5" : p.includes("JSON only") ? '{"title":"x","key":"H","melody":[]}' : "Of course. E4 G4 C5 B4 A4 G4 E4 D4 C4 E4 G4 C5 B4 A4 G4 E4 that is all I have";
const poor: Ask = async () => "I am not able to help with that.";

test("probes judge a model by what it does", async () => {
  assert.deepEqual(await probe(strong), { form: 2, structure: 2, notes: 2, check: 0, vision: 0, audio: 0 });
  assert.deepEqual(await probe(ordinary), { form: 1, structure: 1, notes: 1, check: 0, vision: 0, audio: 0 });   // valid JSON inside chatter; two bars of four right; notes inside a sentence
  assert.deepEqual(await probe(poor), NOTHING);
  assert.equal((await probe(strong, { audio: 1 })).audio, 1);                                           // what a text probe cannot see is declared by the adapter
  assert.deepEqual(await probe(async () => { throw new Error("offline"); }), NOTHING);
});

test("a task takes the richest route the model can carry and the stars allow", async () => {
  const task = songTask(SOUNDS, "a week of small trips");
  assert.deepEqual(plan(task, await probe(strong), 10).map((r) => r.id), ["score", "notes", "floor"]);
  assert.deepEqual(plan(task, await probe(strong, { audio: 1 }), 10).map((r) => r.id), ["audio", "score", "notes", "floor"]);
  assert.deepEqual(plan(task, await probe(ordinary), 10).map((r) => r.id), ["notes", "floor"]);          // cannot keep the structure a whole score needs
  assert.deepEqual(plan(task, await probe(strong), 2).map((r) => r.id), ["notes", "floor"]);             // can, but not with two stars
  assert.deepEqual(plan(task, await probe(strong), 0).map((r) => r.id), ["floor"]);
  assert.deepEqual(plan(task, NOTHING, 99).map((r) => r.id), ["floor"]);
});

test("the same song task, carried out by a strong model, an ordinary one, a poor one and none", async () => {
  const task = songTask(SOUNDS, "a week of small trips");
  const a = await carryOut(task, strong, await probe(strong), 10, "mochi-2026-11-22"); assert.equal(a.by, "score"); assert.equal(a.stars, 3);
  const b = await carryOut(task, ordinary, await probe(ordinary), 10, "mochi-2026-11-22"); assert.equal(b.by, "notes"); assert.equal(b.stars, 1);
  const c = await carryOut(task, poor, await probe(poor), 10, "mochi-2026-11-22"); assert.equal(c.by, "floor"); assert.equal(c.stars, 0);
  const d = await carryOut(task, null, NOTHING, 10, "mochi-2026-11-22"); assert.equal(d.by, "floor");
  for (const r of [a, b, c, d]) { assert.equal(r.made.kind, "score"); if (r.made.kind === "score") { assert.deepEqual(scoreProblems(r.made.score, SOUNDS), []); assert.ok(timeline(r.made.score).length > 20); } }
  assert.deepEqual(c.made, d.made);                                                                       // a poor model and no model end in the same place
});

test("a route that fails hands over, and the record says why", async () => {
  const task = songTask(SOUNDS, "x"), overrated = { form: 2, structure: 2, notes: 2, check: 0, vision: 0, audio: 0 } as const;   // declared strong, behaves ordinary
  const r = await carryOut(task, ordinary, overrated, 10, "s"); assert.equal(r.by, "notes"); assert.deepEqual(r.tried, [{ route: "score", why: "the answer did not pass the check" }]);
  const off = await carryOut(task, async () => { throw new Error("timeout"); }, overrated, 10, "s"); assert.equal(off.by, "floor"); assert.equal(off.tried.length, 2); assert.equal(off.tried[0].why, "timeout");
});

test("a score is refused unless a player can play it as written", () => {
  assert.deepEqual(scoreProblems(goodScore(), SOUNDS), []);
  assert.ok(scoreProblems({ ...goodScore(), bpm: 300 }, SOUNDS).length); assert.ok(scoreProblems({ ...goodScore(), instrument: "tuba" }, SOUNDS).length);
  assert.ok(scoreProblems({ ...goodScore(), melody: goodScore().melody.slice(1) }, SOUNDS).includes("the melody must fill the bars exactly"));
  assert.ok(scoreProblems({ ...goodScore(), melody: [{ pitch: "C9", beats: 1 }, ...goodScore().melody.slice(1)] }, SOUNDS).length);
  assert.equal(fromNotes("C4 D4 E4", "s", "piano"), null);                                               // too few notes is not a song
});

test("the plainest route is the same every time for the same seed, and every task must have one", () => {
  assert.deepEqual(floorScore("mochi-1", "piano"), floorScore("mochi-1", "piano")); assert.notDeepEqual(floorScore("mochi-1", "piano"), floorScore("mochi-2", "piano"));
  for (let i = 0; i < 200; i++) assert.deepEqual(scoreProblems(floorScore("seed" + i, "piano"), SOUNDS), [], "seed" + i);
  assert.deepEqual(taskProblems(songTask(SOUNDS, "x") as any), []);
  const noFloor = { id: "t", routes: [{ id: "only", needs: { form: 1 as const }, stars: 2, run: async () => null, accept: () => 1 }] };
  assert.equal(taskProblems(noFloor as any).length, 1);
});

test("a timeline a synthesiser can play: every note has a time, a length and a frequency", () => {
  const t = timeline(goodScore()), beat = 60 / 84; assert.equal(t.filter((x) => x.part === "melody").length, 32); assert.equal(t.filter((x) => x.part === "chord").length, 24);
  assert.ok(Math.abs(Math.max(...t.map((x) => x.at + x.for)) - 32 * beat) < 0.1); assert.ok(Math.abs(t.find((x) => x.part === "melody")!.hz - 392) < 0.01);   // G4
});

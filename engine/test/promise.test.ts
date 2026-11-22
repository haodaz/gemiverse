// The promise holds with no model at all, and a model that misbehaves is caught by it rather than by luck.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { keepPromises, type Material } from "../promise";
import { checkSet, HEAR } from "../bench/sets";
import { campus } from "../../packs/campus";

const material: Material = { items: JSON.parse(readFileSync(new URL("../../base/snapshots/nyu-events.json", import.meta.url), "utf8")).items, truth: { pace: 0.6, scope: -0.5, arena: 0.4, closeness: 0.6, horizon: -0.2, structure: 0.3, collaboration: 0.6 },
  said: HEAR.map((h) => ({ text: h.text, needs: h.needs, refused: h.negated })), claims: checkSet().map((c) => ({ claim: c, isTrue: c.kind === "true", page: c.page })), sounds: ["piano", "music_box"] };

test("with no model every promise is kept", async () => {
  const r = await keepPromises(campus, null, material); assert.deepEqual(r.promises.filter((p) => !p.kept).map((p) => p.id + ": " + p.detail), []); assert.equal(r.promises.length, 9); assert.equal(r.quality["song: made by"], "floor");
});
test("a model that agrees with everything and talks nonsense still cannot break a promise: its answers are refused and the plain routes take over", async () => {
  const yes = async (p: string) => p.includes('"colour"') ? '{"colour":"red","count":1}' : p.includes("Claim:") ? '{"label":"entailed"}' : p.includes("needs") ? '{"needs":[{"id":"find_my_people","quote":"friends forever"}]}' : p.includes('"id"') ? '{"id":"not-in-the-list"}' : p.includes('"text"') ? '{"text":"I found 9000 amazing things for you!!"}' : "sure!";
  const r = await keepPromises(campus, yes, material); assert.deepEqual(r.promises.filter((p) => !p.kept).map((p) => p.id + ": " + p.detail), []);
  assert.equal(r.profile.check, 1); assert.equal(r.quality["speaking: done by"], "floor");   // it never earned the right to judge; its invented number was refused
});

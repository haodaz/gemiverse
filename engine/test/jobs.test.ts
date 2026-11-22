// The gate's plainest check never approves a quote for merely occurring on the page; hearing with no model knows a negation.
import test from "node:test";
import assert from "node:assert/strict";
import { floorCheck, checkTask, floorHear, hearTask, probeCheck, calibrateCheck } from "../core/jobs";
import { carryOut, NOTHING } from "../core/capability";
import { campus } from "../../packs/campus";

const PAGE = "Prompt Clinic: From Bad Prompts to Better Results\nWhen: Thursday, December 3, 2026, 1:00 pm\nLocation: SPARK Lab, Bobst Library\nHosted by NYU Libraries\nRelated: Zine Night, Dec 9, Special Collections Classroom 251. © 2026 New York University";
const F = (id: string) => campus.fields.find((f) => f.id === id);
test("the plainest check approves only where the field is printed", () => {
  assert.equal(floorCheck({ field: "title", value: "Prompt Clinic: From Bad Prompts to Better Results", quote: "Prompt Clinic: From Bad Prompts to Better Results", source: PAGE }, F("title")), "entailed");
  assert.equal(floorCheck({ field: "venue_name", value: "SPARK Lab", quote: "SPARK Lab, Bobst Library", source: PAGE }, F("venue_name")), "entailed");
  assert.equal(floorCheck({ field: "organisation_name", value: "NYU Libraries", quote: "NYU Libraries", source: PAGE }, F("organisation_name")), "entailed");
  assert.equal(floorCheck({ field: "venue_name", value: "Special Collections Classroom 251", quote: "Special Collections Classroom 251", source: PAGE }, F("venue_name")), "unrelated_quote");   // a sibling event's room: on the page, not this event's venue
  assert.equal(floorCheck({ field: "venue_name", value: "NYU Libraries", quote: "NYU Libraries", source: PAGE }, F("venue_name")), "unrelated_quote");                                        // a real quote attached to the wrong field
  assert.equal(floorCheck({ field: "title", value: "Zine Night", quote: "Zine Night", source: PAGE }, F("title")), "unrelated_quote");                                                           // not the heading
  assert.equal(floorCheck({ field: "venue_name", value: "Room 9", quote: "SPARK Lab", source: PAGE }, F("venue_name")), "unrelated_quote");                                                      // the quote does not contain the value
  assert.equal(floorCheck({ field: "start", value: "2026", quote: "2026", source: PAGE }, undefined), "unrelated_quote");                                                                        // a field the pack has no labels for is never approved by the floor
});
test("the gate fails closed: a model that answers nonsense or errors leaves the strict floor to decide", async () => {
  const claim = { field: "venue_name", value: "NYU Libraries", quote: "NYU Libraries", source: PAGE }, can = { ...NOTHING, form: 2 as const, check: 2 as const };
  for (const bad of [async () => "yes, definitely entailed!", async () => '{"label":"sure"}', async () => { throw new Error("down"); }]) { const r = await carryOut(checkTask(claim, F("venue_name")), bad, can, 0, "s"); assert.equal(r.by, "floor"); assert.equal(r.made, "unrelated_quote"); }
  const ok = await carryOut(checkTask(claim, F("venue_name")), async () => 'Here: {"label": "unrelated_quote"}', can, 0, "s"); assert.equal(ok.by, "label");
});
test("hearing with no model: terms, and a negation within four words cancels", () => {
  const ids = (t: string) => floorHear(t, campus.needs).map((n) => n.id).sort();
  assert.deepEqual(ids("I want to find people who make things. Big crowds wear me out."), ["find_my_people", "make_and_express", "rest_and_recover"]);
  assert.deepEqual(ids("I do not want a workshop, and no more friends please."), []);
  assert.deepEqual(ids("Nice weather today."), []);
});
test("hearing by a model: an id off the list or a quote that was never said voids the answer", async () => {
  const said = "I need funding for next term.", can = { ...NOTHING, form: 2 as const };
  const good = await carryOut(hearTask(said, campus.needs), async () => '{"needs":[{"id":"fund_my_path","quote":"funding for next term"}]}', can, 0, "s"); assert.equal(good.by, "form"); assert.deepEqual(good.made, [{ id: "fund_my_path", quote: "funding for next term" }]);
  const invented = await carryOut(hearTask(said, campus.needs), async () => '{"needs":[{"id":"fund_my_path","quote":"I am broke"}]}', can, 0, "s"); assert.equal(invented.by, "floor");
  const offList = await carryOut(hearTask(said, campus.needs), async () => '{"needs":[{"id":"get_rich","quote":"funding"}]}', can, 0, "s"); assert.equal(offList.by, "floor");
});

test("a model that has not proved itself on traps never judges a claim: it is only asked what the page says, and code compares", async () => {
  const wrongField = { field: "venue_name", value: "NYU Libraries", quote: "NYU Libraries", source: PAGE }, right = { field: "venue_name", value: "SPARK Lab", quote: "SPARK Lab, Bobst Library", source: PAGE };
  const unproven = { ...NOTHING, form: 2 as const }, seenPrompts: string[] = [];
  const reader = async (p: string) => { seenPrompts.push(p); return '{"value": "SPARK Lab, Bobst Library", "quote": "Location: SPARK Lab, Bobst Library"}'; };   // an honest reader of the page
  const a = await carryOut(checkTask(wrongField, F("venue_name")), reader, unproven, 0, "s"); assert.equal(a.by, "extract"); assert.equal(a.made, "contradicted");
  const b = await carryOut(checkTask(right, F("venue_name")), reader, unproven, 0, "s"); assert.equal(b.made, "entailed");
  assert.ok(seenPrompts.every((p) => !p.includes("NYU Libraries\"") && !p.includes("Claim:")), "the model is not shown the claim");
  const liar = await carryOut(checkTask(wrongField, F("venue_name")), async () => '{"value": "NYU Libraries Main Hall", "quote": "NYU Libraries Main Hall"}', unproven, 0, "s"); assert.equal(liar.by, "floor"); assert.equal(liar.made, "unrelated_quote");   // words the page does not print void the answer
  const yesMan = async (p: string) => (p.includes("Claim:") ? '{"label": "entailed"}' : '{"value": null, "quote": null}');
  assert.equal(await probeCheck(yesMan), 1);                                              // says yes to everything: right on the true ones, wrong on every trap
  assert.equal(await probeCheck(async () => "no idea"), 0);
});

test("the right to judge alone is earned on enough real traps, never on the quick screen", async () => {
  const perfectOnSix = async (p: string) => (p.includes("Open Studio Night") ? (/"Room 220, Arts Building"\.|"Department of Printmaking"\.\nQuote offered as support: "Hosted/.test(p) ? '{"label":"entailed"}' : '{"label":"unrelated_quote"}') : '{"label":"entailed"}');
  assert.equal(await probeCheck(perfectOnSix), 1);                                         // all six right, and still only "1"
  const mk = (isTrue: boolean, i: number) => ({ isTrue, claim: { field: "venue_name", value: "v" + i, quote: "q" + i, source: (isTrue ? "TRUE " : "TRAP ") + i } });
  const cases = [...Array.from({ length: 40 }, (_, i) => mk(true, i)), ...Array.from({ length: 80 }, (_, i) => mk(false, i))];
  const careful = async (p: string) => (p.includes("SOURCE\nTRUE") ? '{"label":"entailed"}' : '{"label":"unrelated_quote"}'), yesMan = async () => '{"label":"entailed"}';
  assert.equal((await calibrateCheck(careful, cases)).level, 2);
  const y = await calibrateCheck(yesMan, cases); assert.equal(y.level, 1); assert.equal(y.falseApproved, 1);
  assert.equal((await calibrateCheck(careful, cases.slice(0, 50))).level, 1);              // too few traps to earn it, however well it did
});

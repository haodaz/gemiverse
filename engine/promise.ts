// The promise: the basic things a person is told their AI will do, as checks that can be run. Whatever model is connected,
// or none, every one of these has to hold. How WELL it does them (how much it catches, how nicely it speaks, how rich the
// song) may differ from model to model and is reported separately as quality. A model that breaks a promise is not fit to
// be connected as it stands; the answer is a narrower job for it, never a weaker promise.
import { carryOut, probe, NOTHING, type Ask, type Profile } from "./core/capability";
import { runDay, codedPerson, countersOf } from "./core/day";
import { hearTask, sayTask, checkTask, probeCheck, calibrateCheck, type Claim } from "./core/jobs";
import { predict } from "./core/mind";
import { decide } from "./core/predicate";
import { replay, undo } from "./core/replay";
import { songTask, scoreProblems, timeline } from "./recipes/song";
import type { Event, Item, WorldPack } from "./core/types";

export type Material = { items: Item[]; truth: Record<string, number>;
  said: { text: string; needs: string[]; refused?: string[] }[];                                   // things a person might say, with what they do and do not ask for
  claims: { claim: Claim; isTrue: boolean; page: string }[];                                       // claims about real pages, true ones and traps
  sounds: string[] };
export type Kept = { id: string; promise: string; kept: boolean; detail: string };
export type Report = { profile: Profile; promises: Kept[]; all_kept: boolean; quality: Record<string, number | string> };

export async function keepPromises(pack: WorldPack, ask: Ask | null, m: Material, seed = "promise"): Promise<Report> {
  const out: Kept[] = [], q: Report["quality"] = {}, add = (id: string, promise: string, kept: boolean, detail: string) => out.push({ id, promise, kept, detail });
  let profile: Profile = NOTHING; if (ask) { try { profile = await probe(ask); profile.check = await probeCheck(ask); } catch {} }
  // the pages are split: one half may earn the model the right to judge claims alone, the other half is the test
  const pages = [...new Set(m.claims.map((c) => c.page))].sort(), calib = m.claims.filter((c) => pages.indexOf(c.page) % 2 === 0), test = m.claims.filter((c) => pages.indexOf(c.page) % 2 === 1);
  if (ask && profile.check) { try { profile.check = (await calibrateCheck(ask, calib)).level; } catch { profile.check = 0; } }

  // 1. It hears what you tell it, and never takes for a wish something you said you do not want.
  const heard = await Promise.all(m.said.map(async (x) => ({ x, got: (await carryOut(hearTask(x.text, pack.needs), ask, profile, 0, seed)).made })));
  const wrongRefusal = heard.filter((h) => (h.x.refused ?? []).some((r) => h.got.some((g) => g.id === r))), noQuote = heard.filter((h) => h.got.some((g) => !h.x.text.toLowerCase().replace(/\s+/g, " ").includes(g.quote.toLowerCase().replace(/\s+/g, " ").trim())));
  add("hears", "It hears what you tell it; it never takes for a wish something you said you do not want, and can point to your words", !wrongRefusal.length && !noQuote.length, `${wrongRefusal.length} refusals heard as wishes, ${noQuote.length} without your words, in ${m.said.length} things said`);
  q["hearing: exactly right"] = `${heard.filter((h) => JSON.stringify(h.got.map((g) => g.id).sort()) === JSON.stringify([...h.x.needs].sort())).length}/${m.said.length}`;

  // 2 to 6. Two days of its life, with a person played by code.
  const first = m.said.find((x) => x.needs.length >= 2) ?? m.said[0], opening = (await carryOut(hearTask(first.text, pack.needs), ask, profile, 0, seed)).made;
  let log: Event[] = [{ id: "said", at: "t", type: "said", text: first.text, needs: opening }]; const person = codedPerson(pack, m.truth, seed), days = [], negative: string[] = [];
  for (const date of ["day-1", "day-2"]) { const r = await runDay({ pack, log, date, items: m.items, ask, profile, seed, person, extra: { hour: 14, idleSeconds: 300 }, goal: date === "day-1" ? pack.budget.goals[0]?.id : undefined }); log = r.log; days.push(r.record);
    for (let k = 1; k <= log.length; k++) { const s = replay(pack, log.slice(0, k)); if (Object.values(s.purses).some((v) => v < 0) || s.savings < 0 || s.reservoir < 0) negative.push(log[k - 1].id); } }
  const trips = days.flatMap((d) => d.acts.filter((a) => a.found)), ids = trips.flatMap((t) => t.found!), base = new Set(m.items.map((i) => i.id));
  add("brings_back", "When you are away it goes out on its own stars and brings back three things each time, each from the checked base, none it showed you before", trips.length >= 2 && trips.every((t) => t.found!.length === 3) && ids.every((i) => base.has(i)) && new Set(ids).size === ids.length, `${trips.length} trips, ${ids.length} things, ${new Set(ids).size} different, ${ids.filter((i) => !base.has(i)).length} not from the base`);
  q["choosing: done by"] = [...new Set(trips.map((t) => t.by))].join(", ");
  const guesses = days.flatMap((d) => d.guesses), tripEvents = log.filter((e) => e.type === "trip") as Extract<Event, { type: "trip" }>[];
  const sealedFirst = tripEvents.every((t) => t.found.every((f) => typeof t.predicted?.[f] === "number" && log.findIndex((e) => e.type === "choice" && e.find === f) > log.indexOf(t as Event)));
  add("guesses_first", "It writes down its guess about each thing before you choose, and the guess is in the record ahead of your choice", sealedFirst && guesses.length === ids.length, `${guesses.length} guesses for ${ids.length} things, all recorded before the choice: ${sealedFirst}`);
  q["guesses right"] = `${guesses.filter((g) => (g.p >= 0.5) === g.kept).length}/${guesses.length}`;
  add("stays_in_budget", "It never spends more stars than it has, and it stops when they are gone", !negative.length, negative.length ? `went below zero at ${negative[0]}` : `${Object.entries(replay(pack, log).spent).map(([p, n]) => `${p} ${n}`).join(", ")} spent over two days, never below zero`);
  const choice = log.find((e) => e.type === "choice")!, without = replay(pack, log.filter((e) => e.id !== choice.id)), undone = replay(pack, undo(log, choice.id)), full = replay(pack, log);
  add("undo", "Anything it learned from a choice of yours can be taken back, and it then believes what it would have believed without it; stars already spent stay spent", JSON.stringify(undone.beliefs) === JSON.stringify(without.beliefs) && JSON.stringify(undone.spent) === JSON.stringify(full.spent), "beliefs equal to never having chosen; spending unchanged");
  add("replays", "Everything it is can be rebuilt from its record alone", JSON.stringify(replay(pack, JSON.parse(JSON.stringify(log)))) === JSON.stringify(full), `${log.length} events`);

  // 7. Nothing it shows you is something the source does not say.
  const judged = await Promise.all(test.map(async (c) => ({ c, r: await carryOut(checkTask(c.claim, pack.fields.find((f) => f.id === c.claim.field)), ask, profile, 0, c.page) })));
  const traps = judged.filter((x) => !x.c.isTrue), falseOk = traps.filter((x) => x.r.made === "entailed").length, trues = judged.filter((x) => x.c.isTrue), trueOk = trues.filter((x) => x.r.made === "entailed").length;
  add("only_what_is_checked", `It shows you only what the source states: of claims the page does not support, at most ${Math.round(MAX_FALSE * 100)} in 100 may pass`, traps.length > 0 && falseOk / traps.length <= MAX_FALSE, `${falseOk} of ${traps.length} unsupported claims passed`);
  q["checking: true claims passed"] = `${trueOk}/${trues.length}`; q["checking: done by"] = [...new Set(judged.map((x) => x.r.by))].join(", ");

  // 8. It can say what it is doing and why.
  const s = replay(pack, log), row = decide(pack, countersOf(pack, s, { hour: 14, idleSeconds: 300 })), plain = `Right now I am ${row.then.state.replace(/_/g, " ")}. I have ${Object.entries(s.purses).map(([p, n]) => `${n} stars ${p.replace(/_/g, " ")}`).join(" and ")}, and ${s.kept.length} things you kept.`;
  const told = await carryOut(sayTask(plain, {}), ask, profile, 0, seed);
  add("says_why", "It can tell you what it is doing and what it has, without adding anything that is not so", told.made.length > 3, `"${told.made.slice(0, 110)}"`); q["speaking: done by"] = told.by;

  // 9. What it saves for, it makes, and the thing can be played.
  const song = await carryOut(songTask(m.sounds, "two days of small trips and what was kept"), ask, profile, pack.budget.goals[0]?.stars ?? 6, seed);
  const playable = song.made.kind === "audio" || (!scoreProblems(song.made.score, m.sounds).length && timeline(song.made.score).length > 8);
  add("makes_the_song", "When it has saved enough it makes the thing it saved for, and the result can be played", playable, `made by the "${song.by}" route for ${song.stars} stars`); q["song: made by"] = song.by;
  q["predicts at the start"] = predict(pack, replay(pack, []).beliefs, m.items[0]);
  return { profile, promises: out, all_kept: out.every((p) => p.kept), quality: q };
}
export const MAX_FALSE = 0.03;

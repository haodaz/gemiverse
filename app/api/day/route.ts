import { takeTrip, PLACE_NEEDS } from "@/lib/server/trip";
import { bumpServed } from "@/lib/server/base";
import { ask, parseJson } from "@/lib/server/gemini";
import { AXES, replay, type LogEvent } from "@/lib/mind";
import { PRESETS } from "@/lib/demo";
import { needList } from "@/lib/needs";
import { TOOLS } from "@/lib/kernel/tools";

// Admin mode: one whole day of a Gemi's life, run in one request. The Gemi decides how to spend its own Gem Stars (Carbon),
// acts through the same tools as in the room, and a SIMULATED student (Hydrogen, playing the preset persona with hidden
// tendencies) keeps or skips what it brings back. The log that comes back is the same private log the room uses.
// The point: watch whether its sealed guesses get better from day to day. The student is simulated and labelled so.
const uid = () => Math.random().toString(36).slice(2, 10);
const DAILY = { for_you: 6, for_itself: 4 };

export async function POST(req: Request) {
  try {
    const { school = "nyu", day = 1, log = [], lang = "en", bank = 0, mind: asked } = (await req.json()) as { school: string; day: number; log: LogEvent[]; lang: string; bank: number; mind?: string };
    // The minds experiment: the same day, budget and student, with a different model doing the planning and the choosing.
    const mind = ["gemini-4-carbon", "gemini-4-hydrogen", "gemini-4-argon"].includes(asked ?? "") ? asked! : "gemini-4-carbon";
    const SONG = 6;
    const preset = PRESETS[school], events: LogEvent[] = [], steps: any[] = [], when = () => new Date().toISOString();
    let tokens = 0; const purse = { ...DAILY };

    // Day 1 starts with the birth note: what the student said, heard for needs.
    if (!log.some((e) => e.type === "said")) {
      const r = await ask("gemini-4-hydrogen", `A student said this to their AI companion. Return only JSON {"needs":[{"id":"...","quote":"exact words"}],"wants":["..."]} with at most three needs from:\n${needList()}\n\nSTUDENT: ${preset.birthNote}`, "low");
      const h = parseJson(r.text); tokens += r.usage.total_tokens ?? 0;
      events.push({ id: uid(), at: when(), type: "said", needs: h.needs ?? [], text: preset.birthNote });
      steps.push({ tool: "listen", by: "student", text: preset.birthNote, needs: h.needs ?? [] });
    }
    const state = () => replay([...log, ...events]);
    const seen = () => [...log, ...events].filter((e) => e.type === "choice").map((e: any) => e.find);

    // THINK: what are today's stars best spent on?
    const m0 = state(), halos = AXES.map((a) => `${a.id} ${(m0.beliefs[a.id].u).toFixed(2)}`).join(", ");
    const p = await ask(mind, `You are a student's AI companion (a Gemi) planning your own day ${day}. You have your own daily allowance of Gem Stars: ${purse.for_you} for the student (going out, asking others) and ${purse.for_itself} for yourself (thinking, your diary, your room). Planning itself costs 2 of your own.
What the student cares about (need: weight): ${JSON.stringify(m0.care)}
How unsure you are on each axis of how they choose (1.00 = you know nothing): ${halos}
Places you can visit (3 stars each): ${Object.entries(PLACE_NEEDS).map(([k, v]) => `${k} (${v.join(", ")})`).join("; ")}
Things you can do for yourself: write_diary (1 star), decorate_room (1 star). Bigger things cost more than one day: write_song (${SONG} stars). You have ${bank} saved from earlier days; whatever you do not spend today is saved. You may choose to spend nothing on yourself today in order to save.
Already brought back: ${seen().length} things.
Decide. Spend where the student cares most and you know least. You may make up to two trips. Do not spend for its own sake; unspent stars are saved.
Return only JSON: {"thought": "two sentences in the first person, in ${lang}: what you will do today and why", "trips": ["place", ...], "self": ["write_diary" | "decorate_room", ...], "saving_for": "write_song" or null}`, "low");
    const plan = parseJson(p.text); tokens += p.usage.total_tokens ?? 0; purse.for_itself -= 2;
    steps.push({ tool: "plan_day", by: "gemi", mode: "think", stars: 2, purse: "for_itself", thought: plan.thought, model: p.model });

    // ACT: go out, bring back, the simulated student chooses
    const trips: any[] = [];
    for (const place of (plan.trips ?? []).slice(0, 2)) {
      if (!(place in PLACE_NEEDS) || purse.for_you < 3) continue;
      const m = state();
      const t = await takeTrip({ school, place, care: m.care, beliefs: m.beliefs, wants: [], seen: seen(), lang, thinking: "low", mind }); tokens += t.tokens;
      if (!t.finds.length) { steps.push({ tool: "go_out", by: "gemi", place, stars: 0, note: t.reason }); continue; }
      purse.for_you -= 3; bumpServed(school, t.finds.map((f: any) => f.id)).catch(() => {});
      const predicted = Object.fromEntries(t.finds.map((f: any) => [f.id, f.p_keep]));
      events.push({ id: uid(), at: when(), type: "trip", place, stars: 3, found: t.finds.map((f: any) => f.id), predicted, seal: "admin", reason: t.reason });
      // the simulated student
      const cards = t.finds.map((f: any) => ({ id: f.id, title: f.title, summary: f.fields.summary, when: f.fields.occurrences?.[0]?.start ?? null, where: f.fields.venue_name ?? f.fields.building_name ?? null }));
      const s = await ask("gemini-4-hydrogen", `Play this college student and decide, for each thing your AI companion brought back, whether you keep it or skip it. Be consistent with who you are. You usually keep one or two of three; you skip things that do not fit you even if they sound nice.
WHO YOU ARE (${preset.year}, ${preset.field}): "${preset.birthNote}"
YOUR TENDENCIES (each from -1 to 1): ${AXES.map((a) => `${a.id}: ${preset.truth[a.id]} (-1 = ${a.left}, +1 = ${a.right})`).join("; ")}
Return only JSON: {"choices":[{"id":"...","action":"keep"|"skip","why":"a few words, first person"}]}
BROUGHT BACK: ${JSON.stringify(cards)}`, "low");
      const ch = parseJson(s.text).choices ?? []; tokens += s.usage.total_tokens ?? 0;
      let hits = 0; const rows = t.finds.map((f: any) => { const c = ch.find((x: any) => x.id === f.id) ?? { action: "skip", why: "" }, right = (f.p_keep >= 0.5) === (c.action === "keep"); if (right) hits++;
        events.push({ id: uid(), at: when(), type: "choice", find: f.id, title: f.title, action: c.action, shownWith: t.finds.filter((x: any) => x.id !== f.id).map((x: any) => x.title), evidence: f.evidence });
        return { id: f.id, title: f.title, why: f.why, p_keep: f.p_keep, action: c.action, student_why: c.why, right }; });
      trips.push({ place, reason: t.reason, contrast_axis: t.contrast_axis, rows, hits, shown: rows.length });
      steps.push({ tool: "go_out", by: "gemi", mode: "act", place, stars: 3, purse: "for_you", reason: t.reason, rows, hits });
    }

    // for itself: the diary
    const m1 = state(); let diary = "";
    if ((plan.self ?? []).includes("write_diary") && purse.for_itself >= 1 && trips.length) {
      const moved = AXES.map((a) => ({ axis: a.id, left: a.left, right: a.right, before: +m0.beliefs[a.id].m.toFixed(2), after: +m1.beliefs[a.id].m.toFixed(2), unsure_before: +m0.beliefs[a.id].u.toFixed(2), unsure_after: +m1.beliefs[a.id].u.toFixed(2) })).filter((x) => x.before !== x.after);
      const d = await ask("gemini-4-hydrogen", `You are a Gemi writing three short sentences in your diary, in ${lang}, first person, about today. Say what you brought back, what your student kept or skipped, and what that taught you about how they choose in a situation. Never describe their personality; talk about choices. Mention if your guess was wrong.
TODAY: ${JSON.stringify(trips.map((t) => ({ place: t.place, rows: t.rows.map((r: any) => ({ title: r.title, guessed_keep: r.p_keep, they: r.action, they_said: r.student_why })) })))}
WHAT MOVED: ${JSON.stringify(moved)}`, "low");
      diary = d.text; tokens += d.usage.total_tokens ?? 0; purse.for_itself -= 1;
      steps.push({ tool: "write_diary", by: "gemi", mode: "think", stars: 1, purse: "for_itself", text: diary });
    }
    if ((plan.self ?? []).includes("decorate_room") && purse.for_itself >= 1) { purse.for_itself -= 1; steps.push({ tool: "decorate_room", by: "gemi", mode: "act", stars: 1, purse: "for_itself", palette: day % 3 }); }

    // SAVE or MAKE: what it did not spend on itself goes into its savings; when the savings reach the price, it makes the big thing
    let saved = bank + purse.for_itself, song: any = null;
    if (plan.saving_for === "write_song" && saved >= SONG) {
      try { const origin = new URL(req.url).origin; const r = await fetch(`${origin}/api/song`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ about: `${diary}\n${trips.map((t) => t.reason).join("\n")}`, lang }) }).then((x) => x.json());
        if (!r.error) { saved -= SONG; song = { title: r.title, brief: r.brief, mime: r.mime, audio: r.audio }; tokens += r.tokens ?? 0; steps.push({ tool: "write_song", by: "gemi", mode: "make", stars: SONG, purse: "for_itself", title: r.title, text: r.brief, model: "gemini-4-hydrogen + lyria-3-clip-preview" });
          events.push({ id: uid(), at: when(), type: "room", by: "gemi", what: `wrote a song, "${r.title}"` }); } } catch {}
    } else if (plan.saving_for) steps.push({ tool: "save", by: "gemi", mode: "think", stars: 0, note: `Saving for a song: ${saved} of ${SONG} Gem Stars.` });
    // measures: guesses, uncertainty, and (simulation only) distance from the hidden tendencies
    const all = [...log, ...events], choices = all.filter((e) => e.type === "choice").length, b = m1.beliefs;
    const meanHalo = AXES.reduce((a, x) => a + b[x.id].u, 0) / AXES.length;
    const error = AXES.reduce((a, x) => a + Math.abs(b[x.id].m - (preset.truth[x.id] ?? 0)), 0) / AXES.length;
    const signRight = AXES.filter((x) => Math.abs(b[x.id].m) > 0.05 && Math.sign(b[x.id].m) === Math.sign(preset.truth[x.id])).length;
    const hits = trips.reduce((a, t) => a + t.hits, 0), shown = trips.reduce((a, t) => a + t.shown, 0);
    // stage: today's plain conditions (the full rule from the growth design needs weeks of data)
    const stage = choices >= 15 && meanHalo <= 0.6 ? 3 : choices >= 5 ? 2 : 1;
    const unlocked = TOOLS.filter((t) => t.minStage <= stage).map((t) => t.name);
    return Response.json({ bank: saved, song, day, steps, trips, diary, events, tokens, spent: { for_you: DAILY.for_you - purse.for_you, for_itself: DAILY.for_itself - purse.for_itself }, saved: purse,
      metrics: { hits, shown, meanHalo: +meanHalo.toFixed(3), error: +error.toFixed(3), signRight, choices, kept: all.filter((e: any) => e.type === "choice" && e.action === "keep").length }, stage, unlocked, beliefs: b });
  } catch (e) { return Response.json({ error: String((e as Error).message) }, { status: 500 }); }
}

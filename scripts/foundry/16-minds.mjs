// The minds experiment (22 Nov): the same Gemi, the same ten Gem Stars a day, the same simulated student, five days,
// with a different Gemini model as the mind that plans the day and chooses what to bring back. One run per mind:
// a first look at how each one lives under the budget, not a result.   node scripts/foundry/16-minds.mjs   (needs the dev server on :3000)
import fs from "node:fs";
const MINDS = ["gemini-4-carbon", "gemini-4-hydrogen", "gemini-4-argon"], DAYS = 5, out = { at: new Date().toISOString(), school: "nyu", days: DAYS, simulated_student: true, runs_per_mind: 1, minds: {} };
await Promise.all(MINDS.map(async (mind) => { let log = [], bank = 0; const days = [];
  for (let day = 1; day <= DAYS; day++) { const t0 = Date.now(); let r;
    for (let k = 0; k < 2 && !r; k++) { try { const x = await (await fetch("http://localhost:3000/api/day", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ school: "nyu", day, log, bank, lang: "en", mind }) })).json(); if (!x.error) r = x; else console.log(mind, day, "error", x.error.slice(0, 100)); } catch (e) { console.log(mind, day, e.message); } }
    if (!r) { days.push({ day, failed: true }); continue; }
    log = [...log, ...r.events]; bank = r.bank;
    days.push({ day, seconds: Math.round((Date.now() - t0) / 1000), tokens: r.tokens, thought: r.steps.find((s) => s.tool === "plan_day")?.thought, trips: r.trips.map((t) => ({ place: t.place, hits: t.hits, shown: t.shown, kept: t.rows.filter((x) => x.action === "keep").length })), self: r.steps.filter((s) => s.purse === "for_itself" && s.tool !== "plan_day").map((s) => s.tool), spent: r.spent, bank: r.bank, song: r.song?.title ?? null, metrics: r.metrics, stage: r.stage });
    console.log(mind.replace("gemini-4-", ""), "day", day, "trips", r.trips.length, "guess", r.metrics.hits + "/" + r.metrics.shown, "halo", r.metrics.meanHalo, "bank", r.bank, r.song ? "SONG" : "", Math.round((Date.now() - t0) / 1000) + "s"); }
  out.minds[mind] = days; }));
fs.writeFileSync(new URL("../../base/runs/16-minds.json", import.meta.url), JSON.stringify(out, null, 1)); console.log("saved");

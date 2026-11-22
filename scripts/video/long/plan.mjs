// The long film's timeline for one language: every scene with its length (set by the narration) and the parts that fill it.
import fs from "node:fs";
const B = new URL(".", import.meta.url).pathname;
export const TEMPO = { zh: 0.88, en: 1 }, PAD = 2, LEAD = 0.6;   // the Chinese voice is slowed a little; each scene breathes 2 s
const ANIM = ["s1", "s2", "s3", "s5a", "s5b", "s5c", "s5d", "s7a", "s7b", "s7c", "s7d", "s9", "s11"];
const clipLen = { start: 16.5, room: 10, ask: 9.4, choose: 10.4, diary: 7, agent: 9.6, pick: 6.4, map: 6.8, meet: 6.5, spaces: 6 };
export function plan(lang) { const dur = Object.fromEntries(JSON.parse(fs.readFileSync(`${B}tts-${lang}/durations.json`, "utf8")).map((d) => [d.id, d.dur / TEMPO[lang] + PAD]));
  const clips = (D, names, tail = 0) => { const parts = []; let left = D - tail; names.forEach((n, i) => { const last = i === names.length - 1, d = last ? left : Math.min(clipLen[n], left - (names.length - 1 - i) * 3); parts.push({ kind: "clip", clip: n, dur: Math.max(2, d) }); left -= Math.max(2, d); }); return parts; };
  const out = [{ id: "s0", voice: false, parts: [{ kind: "anim", scene: "s0", dur: 6 }] }];
  for (const id of ["s1", "s2", "s3", "s4", "s5a", "s5b", "s5c", "s5d", "s6", "s7a", "s7b", "s7c", "s7d", "s8", "s9", "s10", "s11"]) { const D = dur[id]; let parts;
    if (ANIM.includes(id)) parts = [{ kind: "anim", scene: id, dur: D }];
    if (id === "s4") parts = clips(D, ["start", "room"]);
    if (id === "s6") parts = [{ kind: "anim", scene: "s6", dur: D * 0.72 }, { kind: "clip", clip: "agent", dur: D * 0.28 }];
    if (id === "s8") parts = clips(D, ["ask", "choose", "diary"]);
    if (id === "s10") parts = [...clips(D, ["pick", "map", "meet", "spaces"], 7), { kind: "anim", scene: "s10b", dur: 7 }];
    out.push({ id, voice: true, parts }); }
  out.push({ id: "credits", voice: false, parts: [{ kind: "anim", scene: "credits", dur: 7 }] });
  let t = 0; for (const s of out) { s.start = t; s.dur = s.parts.reduce((a, p) => a + p.dur, 0); t += s.dur; } return out; }
if (process.argv[1]?.endsWith("plan.mjs")) for (const l of ["zh", "en"]) { const p = plan(l); console.log(l, "total", (p.at(-1).start + p.at(-1).dur).toFixed(0) + "s =", ((p.at(-1).start + p.at(-1).dur) / 60).toFixed(2), "min"); console.log(p.map((s) => `${s.id} ${s.dur.toFixed(0)}`).join(" · ")); }

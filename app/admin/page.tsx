"use client";

import { useRef, useState } from "react";
import { Chunky, Icon, INK } from "@/components/game";
import { AXES, loadLog, saveLog, type LogEvent } from "@/lib/mind";
import { PRESETS } from "@/lib/demo";
import { saveSchool, type SchoolId } from "@/lib/schools";

type Day = { day: number; steps: any[]; trips: any[]; diary: string; tokens: number; spent: { for_you: number; for_itself: number }; saved: { for_you: number; for_itself: number };
  metrics: { hits: number; shown: number; meanHalo: number; error: number; signRight: number; choices: number; kept: number }; stage: number; unlocked: string[]; beliefs: Record<string, { m: number; u: number }>; error?: string };

const STAGES = ["", "Unpacked", "Observer", "Scout", "Interlocutor", "Steward"];

// A small line chart: one point per day.
function Chart({ title, note, values, max = 1, colour, fmt }: { title: string; note: string; values: number[]; max?: number; colour: string; fmt: (v: number) => string }) {
  const W = 300, H = 110, x = (i: number) => 24 + (values.length > 1 ? (i * (W - 48)) / (values.length - 1) : (W - 48) / 2), y = (v: number) => H - 22 - (Math.min(max, v) / max) * (H - 44);
  return (
    <div className="rounded-2xl border-2 bg-white p-3" style={{ borderColor: INK }}>
      <div className="text-sm font-bold">{title}</div><div className="text-[11px] text-[#8a8296]">{note}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full">
        <line x1="20" y1={H - 22} x2={W - 20} y2={H - 22} stroke="#e6dfd0" /><line x1="20" y1="22" x2={W - 20} y2="22" stroke="#f1ece2" strokeDasharray="3 3" />
        {values.length > 1 && <polyline fill="none" stroke={colour} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />}
        {values.map((v, i) => (<g key={i}><circle cx={x(i)} cy={y(v)} r="5" fill="#fffaf0" stroke={colour} strokeWidth="3" /><text x={x(i)} y={y(v) - 10} textAnchor="middle" fontSize="10" fill="#3d3648" fontWeight="700">{fmt(v)}</text><text x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#8a8296">day {i + 1}</text></g>))}
      </svg>
    </div>
  );
}

export default function Admin() {
  const [school, setSchool] = useState<SchoolId>("nyu");
  const [days, setDays] = useState<Day[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const stop = useRef(false);
  const preset = PRESETS[school];

  async function run(n: number) {
    stop.current = false; let log: LogEvent[] = days.length ? loadLog(school) : []; let done = days.length ? [...days] : [];
    if (!days.length) saveLog(school, []);
    for (let i = 0; i < n && !stop.current; i++) {
      const day = done.length + 1; setRunning(`Day ${day}: deciding, going out, the student chooses…`);
      const r: Day = await fetch("/api/day", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ school, day, log }) }).then((x) => x.json()).catch(() => ({ error: "The day could not be run." } as any));
      if (r.error) { setRunning(r.error); return; }
      log = [...log, ...((r as any).events as LogEvent[])]; saveLog(school, log); saveSchool(school);       // the same private log the room reads
      done = [...done, r]; setDays(done);
      if (!r.trips.length) { setRunning("It found nothing new to bring back. The base has run out of unseen things for this student."); return; }
    }
    setRunning(null);
  }
  function reset() { stop.current = true; setDays([]); saveLog(school, []); setRunning(null); }
  const last = days[days.length - 1], totalTokens = days.reduce((a, d) => a + d.tokens, 0);

  return (
    <main className="min-h-screen bg-[#f6f2ee] px-8 py-8 text-[#2b2536]">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex items-baseline justify-between">
          <div><a href="/" className="text-xl font-bold">Gemiverse</a><span className="ml-3 text-sm text-[#8a8296]">Admin · run days</span></div>
          <div className="flex gap-4 text-sm"><a href="/foundry" className="underline">Foundry</a><a href="/room" className="underline">Open its room →</a></div>
        </header>

        <section className="rounded-[24px] border-[3px] bg-[#fffaf0] p-5" style={{ borderColor: INK, boxShadow: `0 6px 0 ${INK}22` }}>
          <p className="max-w-4xl text-sm leading-relaxed text-[#5f576c]">Each day the Gemi decides by itself how to spend its own Gem Stars (6 for the student, 4 for itself), goes out, and brings back three things per trip with a guess of which will be kept.
            <b> The student here is simulated</b>: Hydrogen plays the preset below, with hidden tendencies the Gemi never sees. That lets us measure whether its guesses and its picture of the student get better day by day.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {(["nyu", "columbia"] as const).map((s) => <Chunky key={s} small color={school === s ? "#ffe08a" : "#fffaf0"} disabled={!!running || days.length > 0} onClick={() => setSchool(s)}>{s === "nyu" ? "NYU · PhD, education" : "Columbia · sophomore"}</Chunky>)}
            <span className="mx-2 h-6 w-px bg-[#d9d0c0]" />
            {[1, 3, 5].map((n) => <Chunky key={n} color="#a8e0c0" disabled={!!running} onClick={() => run(n)}>Run {n} day{n > 1 ? "s" : ""}</Chunky>)}
            {running && <Chunky small color="#fffaf0" onClick={() => { stop.current = true; }}>Stop after this day</Chunky>}
            <Chunky small color="#fffaf0" disabled={!!running && !stop.current} onClick={reset}><Icon name="undo" size={14} />Start over</Chunky>
            {running && <span className="text-sm text-[#b26a00]">{running}</span>}
          </div>
          <p className="mt-3 text-xs text-[#8a8296]">“{preset.birthNote}”</p>
        </section>

        {days.length > 0 && (
          <section className="grid grid-cols-4 gap-4">
            <Chart title="Guesses right" note="sealed before the student chose" colour="#7c4dce" values={days.map((d) => (d.metrics.shown ? d.metrics.hits / d.metrics.shown : 0))} fmt={(v) => `${Math.round(v * 100)}%`} />
            <Chart title="How unsure it is" note="mean uncertainty over seven axes" colour="#3d8fd1" values={days.map((d) => d.metrics.meanHalo)} fmt={(v) => v.toFixed(2)} />
            <Chart title="Distance from the truth" note="simulation only: belief vs hidden tendency" colour="#e0556b" values={days.map((d) => d.metrics.error)} fmt={(v) => v.toFixed(2)} />
            <div className="rounded-2xl border-2 bg-white p-3" style={{ borderColor: INK }}>
              <div className="text-sm font-bold">Where it stands</div>
              <div className="mt-2 text-2xl font-bold">Stage {last.stage} · {STAGES[last.stage]}</div>
              <div className="mt-1 text-xs text-[#5f576c]">{last.metrics.choices} choices seen, {last.metrics.kept} kept. Right side on {last.metrics.signRight} of 7 axes.</div>
              <div className="mt-2 text-xs text-[#8a8296]">{totalTokens.toLocaleString()} tokens over {days.length} day{days.length > 1 ? "s" : ""}. Can now use: {last.unlocked.length} of 12 methods.</div>
            </div>
          </section>
        )}

        {last && (
          <section className="rounded-[24px] border-[3px] bg-[#fffaf0] p-5" style={{ borderColor: INK }}>
            <h2 className="text-sm font-bold">What it believes now, against the hidden tendency (the open ring)</h2>
            <div className="mt-2 grid grid-cols-2 gap-x-8">{AXES.map((a) => { const b = last.beliefs[a.id], truth = preset.truth[a.id] ?? 0, pos = (m: number) => `${50 + m * 46}%`; return (
              <div key={a.id} className="py-1.5"><div className="flex justify-between text-[11px] text-[#5f576c]"><span>{a.left}</span><span>{a.right}</span></div>
                <div className="relative mt-1 h-4 rounded-full border-2" style={{ borderColor: INK, background: "#f3ecdf" }}>
                  <div className="absolute top-0 h-full rounded-full opacity-45" style={{ background: "#7c4dce", left: `calc(${pos(b.m)} - ${b.u * 46}%)`, width: `${b.u * 92}%`, maxWidth: "100%" }} />
                  <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed" style={{ left: pos(truth), borderColor: "#e0556b" }} />
                  <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-[#fffaf0]" style={{ left: pos(b.m), borderColor: INK }} /></div></div>); })}</div>
          </section>
        )}

        {[...days].reverse().map((d) => (
          <section key={d.day} className="rounded-[24px] border-[3px] bg-[#fffaf0] p-5" style={{ borderColor: INK }}>
            <div className="flex items-baseline justify-between"><h2 className="text-lg font-bold">Day {d.day}</h2>
              <span className="text-xs text-[#8a8296]">spent {d.spent.for_you} for the student, {d.spent.for_itself} for itself · saved {d.saved.for_you + d.saved.for_itself} · {d.tokens.toLocaleString()} tokens</span></div>
            <ol className="mt-3 space-y-3">{d.steps.map((s, i) => (
              <li key={i} className="rounded-2xl border-2 bg-white px-4 py-3 text-sm" style={{ borderColor: "#d9d0c0" }}>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#8a8296]"><span className="rounded-full px-2 py-0.5 text-white" style={{ background: s.by === "student" ? "#3d8fd1" : "#7c4dce" }}>{s.by === "student" ? "student" : s.mode ?? "act"}</span>{s.tool}{s.place ? ` · ${s.place}` : ""}{s.stars ? <span className="flex items-center">· {s.stars}<Icon name="star" size={14} /> {s.purse === "for_you" ? "for the student" : "its own"}</span> : null}{s.model ? ` · ${s.model}` : ""}</div>
                {s.thought && <p className="mt-1.5 leading-relaxed">{s.thought}</p>}
                {s.tool === "listen" && <p className="mt-1.5 text-[#5f576c]">Heard: {(s.needs ?? []).map((n: any) => `${n.id.replace(/_/g, " ")} (“${n.quote}”)`).join("; ")}</p>}
                {s.reason && <p className="mt-1.5 leading-relaxed">{s.reason}</p>}
                {s.rows && (<table className="mt-2 w-full text-xs"><tbody>{s.rows.map((r: any) => (<tr key={r.id} className="border-t border-[#f1ece2] align-top">
                  <td className="py-1.5 pr-2"><b>{r.title}</b><div className="text-[#8a8296]">{r.why}</div></td>
                  <td className="w-24 py-1.5 text-right tabular-nums">guessed {Math.round(r.p_keep * 100)}%</td>
                  <td className="w-44 py-1.5 pl-3"><b style={{ color: r.action === "keep" ? "#2f7a3d" : "#8a8296" }}>{r.action === "keep" ? "kept" : "skipped"}</b> <span style={{ color: r.right ? "#2f7a3d" : "#b26a00" }}>{r.right ? "· right" : "· wrong"}</span><div className="text-[#8a8296]">“{r.student_why}”</div></td></tr>))}</tbody></table>)}
                {s.tool === "write_diary" && <p className="mt-1.5 italic leading-relaxed text-[#3d3648]">{s.text}</p>}
                {s.note && <p className="mt-1.5 text-[#b26a00]">{s.note}</p>}
              </li>))}</ol>
          </section>
        ))}
      </div>
    </main>
  );
}

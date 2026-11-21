"use client";

import { useEffect, useState } from "react";
import { INK } from "@/components/game";
import { Bars, LineChart } from "@/components/charts";
import proof from "@/lib/proof.json";
import { step, type Tier } from "@/lib/mind";
import { POLICY } from "@/lib/kernel/autonomy";
import { TOOLS } from "@/lib/kernel/tools";

// The back office, as pictures: the shared base and its flywheel, what each Gemini model did, the measured science, and tests run at speed.
const PUR = "#7c4dce", GREY = "#b9b2c4", TEAL = "#2f9e8f", GOLD = "#e0a526", RED = "#d9534f";
const PG = proof.pages.overall as any, L = proof.listings.overall as any, P1 = proof.pagesRun1.overall as any;
const TPP = proof.pages.tokens.system_v2 / proof.pages.n;
const Card = ({ title, note, children, className = "" }: { title: string; note?: string; children: React.ReactNode; className?: string }) => (
  <section className={`rounded-2xl border-[3px] bg-[#fffaf0] p-5 ${className}`} style={{ borderColor: INK, boxShadow: `0 5px 0 ${INK}22` }}><h2 className="text-lg font-bold">{title}</h2>{note && <p className="text-[13px] text-[#6d6579]">{note}</p>}<div className="mt-3">{children}</div></section>);
const Kpi = ({ v, l, c = "#fff" }: { v: string | number; l: string; c?: string }) => <div className="rounded-xl border-2 px-3 py-2.5 text-center" style={{ borderColor: INK, background: c }}><div className="text-3xl font-bold tabular-nums">{v}</div><div className="text-[11.5px] leading-tight text-[#6d6579]">{l}</div></div>;
const halo = (t: Tier) => { let b = { m: 0, u: 1 }; const pts: [number, number][] = [[0, 1]]; for (let k = 1; k <= 10; k++) { b = step(b, b.m, t); pts.push([k, b.u]); } return pts; };
const MODELS: [string, string, number, string][] = [
  ["Hydrogen + Decisions", "fill and gate 122 raw pages", proof.pages.tokens.system_v2, PUR], ["Argon", "baseline on the same pages", proof.pages.tokens.baseline, GREY],
  ["Hydrogen + Decisions", "70 listings", proof.listings.tokens.system, PUR], ["Argon", "baseline, listings", proof.listings.tokens.baseline, GREY],
  ["Hydrogen + Decisions", "Gemi to Gemi, 3 peers", 18196, TEAL], ["Carbon", "review of the whole design", 15314, GOLD],
];

export default function Admin() {
  const [f, setF] = useState<any>(null), [tab, setTab] = useState("Flywheel");
  useEffect(() => { fetch("/api/foundry").then((r) => r.json()).then(setF).catch(() => setF({ error: true })); }, []);
  const t = f?.totals, rows: any[] = f?.rows ?? [];
  const byNeed: Record<string, number> = {}; for (const r of rows) for (const n of r.needs ?? []) byNeed[n] = (byNeed[n] ?? 0) + 1;
  const served = t?.served ?? 0, maxTok = Math.max(...MODELS.map((m) => m[2]));
  return (
    <main className="min-h-screen bg-[#f6f2ee] px-8 py-7 text-[#2b2536]">
      <div className="mx-auto max-w-7xl">
        <header className="flex items-center justify-between"><div><a href="/" className="text-xl font-bold">Gemiverse</a><span className="ml-3 text-sm text-[#8a8296]">Admin · the back office</span></div>
          <nav className="flex gap-2">{["Flywheel", "Gemini at work", "Science", "Run at speed"].map((x) => <button key={x} onClick={() => setTab(x)} className="rounded-full border-[3px] px-4 py-1.5 text-sm font-bold" style={{ borderColor: INK, background: tab === x ? "#ffe08a" : "#fffaf0", boxShadow: tab === x ? `0 3px 0 ${INK}` : undefined }}>{x}</button>)}</nav></header>

        {tab === "Flywheel" && (<div className="mt-5 grid grid-cols-3 gap-5">
          <Card title="The shared base, live" note="Read from Supabase now. Every field carries the sentence it came from." className="col-span-2">
            {!t ? <p className="text-sm text-[#8a8296]">{f?.error ? "The base is not reachable from this server." : "Loading…"}</p> : (<>
              <div className="grid grid-cols-6 gap-2.5"><Kpi v={t.entities} l="entities" /><Kpi v={t.events} l="events" /><Kpi v={t.organisations} l="clubs and offices" /><Kpi v={t.places} l="places" /><Kpi v={`${t.fields_passed}/${t.fields}`} l="fields passed the gate" c="#dff3e6" /><Kpi v={t.due} l="due for a re-check" /></div>
              <div className="mt-4 grid grid-cols-2 gap-6">
                <Bars yMax={Math.max(10, ...Object.values(byNeed)) * 1.15} yLabel="entities" h={230} fmt={(v) => String(Math.round(v))} groups={Object.entries(byNeed).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => ({ label: k.replace(/_/g, " ").slice(0, 13), bars: [{ name: "", value: v, color: TEAL }] }))} />
                <div><p className="text-sm font-bold">What students can be helped with</p><p className="text-[13px] text-[#6d6579]">Entities per growth need, tagged by Hydrogen. Thin bars are where the base cannot help yet: that is where the next harvest should go.</p>
                  <div className="mt-3 h-4 w-full overflow-hidden rounded-full border-2" style={{ borderColor: INK }}><div className="h-full" style={{ width: `${(t.fields_passed / t.fields) * 100}%`, background: TEAL }} /></div>
                  <p className="mt-1 text-[13px]">{Math.round((t.fields_passed / t.fields) * 100)}% of fields are shown; the rest are withheld, not guessed.</p></div></div></>)}
          </Card>
          <Card title="The flywheel" note="A fact checked once is read many times.">
            <svg viewBox="-28 0 316 230" className="w-full"><defs><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 8 4 0 8z" fill={INK} /></marker></defs>
              {[["A Gemi goes out", 130, 28], ["Checked field by field", 216, 112], ["Enters the shared base", 130, 200], ["Every Gemi reads it free", 44, 112]].map(([s, x, y], i) => (<g key={i}><rect x={(x as number) - 62} y={(y as number) - 17} width="124" height="34" rx="10" fill={["#c8b4f0", "#a8d4ff", "#a8e0c0", "#ffe08a"][i]} stroke={INK} strokeWidth="2" /><text x={x as number} y={(y as number) + 4} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={INK}>{s}</text></g>))}
              {["M178 44 L206 90", "M206 134 L178 182", "M82 182 L56 134", "M56 90 L82 44"].map((d) => <path key={d} d={d} stroke={INK} strokeWidth="2" fill="none" markerEnd="url(#ar)" />)}
              <text x="130" y="108" textAnchor="middle" fontSize="26" fontWeight="800" fill={PUR}>{served}</text><text x="130" y="124" textAnchor="middle" fontSize="9" fill="#6d6579">checked facts served</text></svg>
            <p className="text-[13px] leading-snug">Checking one page costs about <b>{Math.round(TPP).toLocaleString()}</b> tokens. Those {served} reads would have cost about <b>{Math.round(served * TPP / 1000)}k</b> tokens if each Gemi had checked alone. A re-visit compares a fingerprint and costs 0 unless the page changed.</p>
            <a href="/foundry" className="mt-3 inline-block rounded-full border-2 bg-white px-4 py-1 text-sm font-bold" style={{ borderColor: INK }}>Every entity and its checks →</a>
          </Card>
        </div>)}

        {tab === "Gemini at work" && (<div className="mt-5 grid grid-cols-2 gap-5">
          <Card title="Tokens by model and job" note="Measured, from the run files in base/runs.">
            <div className="space-y-2">{MODELS.map(([m, job, tok, c], i) => (<div key={i} className="grid grid-cols-[10.5rem_1fr_4.5rem] items-center gap-2 text-[13px]"><span><b>{m}</b><br /><span className="text-[#6d6579]">{job}</span></span>
              <div className="h-5 rounded-full bg-[#ece7e0]"><div className="h-full rounded-full" style={{ width: `${(tok / maxTok) * 100}%`, background: c }} /></div><span className="text-right font-bold tabular-nums">{(tok / 1000).toFixed(0)}k</span></div>))}</div>
            <p className="mt-3 text-[13px] text-[#6d6579]">The gate costs {(proof.pages.tokens.system_v2 / proof.pages.tokens.baseline).toFixed(1)} times a single call. What it buys is on the Science tab.</p></Card>
          <Card title="What the Gemi may do on its own" note={`${POLICY.length} policy rows, first match wins; ${TOOLS.length} registered methods. Read from the code that runs.`}>
            <div className="grid grid-cols-3 gap-1.5">{TOOLS.map((x) => <div key={x.name} className="rounded-lg border-2 px-2 py-1 text-[11.5px]" style={{ borderColor: INK, background: x.mode === "think" ? "#efe7ff" : x.mode === "act" ? "#e3f1ff" : "#fff0c9" }}><b className="font-mono">{x.name}</b><br />{(x.model ?? "code").replace("gemini-4-", "").replace("gemini-", "")} · {x.stars ? `${x.stars}★` : "free"}</div>)}</div>
            <p className="mt-3 text-[13px] text-[#6d6579]">Violet: think. Blue: act. Yellow: make. Carbon's review found that Carbon and Decisions calls the Gemi makes on its own are charged 0 stars; that is logged as open.</p></Card>
          <Card title="Carbon as a reviewer" note="14:50, medium thinking, 106 s. Full text in base/runs/10-carbon-review.medium.json." className="col-span-2">
            <ol className="grid grid-cols-3 gap-4 text-[13.5px] leading-snug">
              <li><b>1 · Find the cause of the 12 errors.</b> Done at 15:00: 9 hybrid events, 2 mislabelled by the calendar, 1 real error.</li>
              <li><b>2 · The learning half has no numbers.</b> Open. Use the Run at speed tab to produce them.</li>
              <li><b>3 · Kernel charges do not match the claim.</b> Open.</li></ol></Card>
        </div>)}

        {tab === "Science" && (<div className="mt-5 grid grid-cols-2 gap-5">
          <Card title="Error rate against a single model call" note={`Wrong facts shown, of facts shown. ${proof.listings.facts} facts from listings, ${proof.pages.facts} from raw pages of six universities.`}>
            <Bars yMax={0.1} yLabel="error rate" fmt={(v) => `${(v * 100).toFixed(1)}%`} h={270} groups={[
              { label: "Listings", bars: [{ name: "baseline", value: L.baseline.error_rate, color: GREY }, { name: "ours", value: L.v3.error_rate, color: PUR }] },
              { label: "Raw pages, run 1", bars: [{ name: "baseline", value: P1.baseline.error_rate, color: GREY }, { name: "ours", value: P1.system.error_rate, color: RED }] },
              { label: "After the fix", bars: [{ name: "baseline", value: PG.baseline.error_rate, color: GREY }, { name: "+reader", value: PG.baseline_visible.error_rate, color: "#8f879c" }, { name: "ours", value: PG.system_v2.error_rate, color: PUR }] }]} /></Card>
          <Card title="How fast its picture of a student sharpens" note="Uncertainty on one axis after n pieces of evidence, by how the evidence was earned. Computed from lib/mind.ts.">
            <LineChart xMax={10} yMax={1} h={270} xLabel="pieces of evidence" yLabel="uncertainty" xTicks={[0, 2, 4, 6, 8, 10]} yTicks={[0, 0.25, 0.5, 0.75, 1]} series={([["self_reported", "said it", GREY], ["checked", "chose it", GOLD], ["seen_over_time", "seen over time", TEAL], ["actually_done", "did it", PUR]] as [Tier, string, string][]).map(([k, name, color]) => ({ name, color, points: halo(k) }))} /></Card>
          <Card title="Corrections, in order" note={`${proof.improvements.length} logged with before, how and after.`} className="col-span-2">
            <div className="grid grid-cols-3 gap-x-6 gap-y-2">{(proof.improvements as any[]).map((x, i) => <div key={x.id} className="text-[12.5px] leading-snug"><b>{i + 1} · {x.area}</b> <span className="text-[#6d6579]">{x.before}</span> → <b>{String(x.after).slice(0, 90)}{String(x.after).length > 90 ? "…" : ""}</b></div>)}</div></Card>
        </div>)}

        {tab === "Run at speed" && (<div className="mt-5 grid grid-cols-3 gap-5">
          {[["/admin/days", "Run whole days", "The Gemi plans, goes out and saves on its own; Hydrogen plays a student with hidden tendencies. Charts show whether its guesses and its picture of the student improve day by day."],
            ["/meet", "Gemi to Gemi", "Carbon invents three students. Every message passes a privacy gate. Name cards are kept only if they claim what was really said."],
            ["/foundry", "Re-check the base", "Fingerprint every source again. Unchanged pages cost 0 tokens; changed fields go back through the gate."]].map(([h, tt, d]) => (
            <a key={h} href={h} className="rounded-2xl border-[3px] bg-[#fffaf0] p-6 transition hover:-translate-y-1" style={{ borderColor: INK, boxShadow: `0 5px 0 ${INK}22` }}><h2 className="text-xl font-bold">{tt}</h2><p className="mt-2 text-[14.5px] leading-relaxed text-[#5f576c]">{d}</p><span className="mt-4 inline-block rounded-full border-2 bg-[#ffe08a] px-4 py-1 text-sm font-bold" style={{ borderColor: INK }}>Open →</span></a>))}
        </div>)}
      </div>
    </main>
  );
}

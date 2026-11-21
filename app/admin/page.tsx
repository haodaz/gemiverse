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
const LINE = "#e5e7eb", TXT = "#111827", SUB = "#6b7280";
const Card = ({ title, note, children, className = "" }: { title: string; note?: string; children: React.ReactNode; className?: string }) => (
  <section className={`rounded-lg border bg-white p-5 ${className}`} style={{ borderColor: LINE }}><h2 className="text-[15px] font-semibold" style={{ color: TXT }}>{title}</h2>{note && <p className="mt-0.5 text-[12.5px]" style={{ color: SUB }}>{note}</p>}<div className="mt-4">{children}</div></section>);
const Kpi = ({ v, l, d }: { v: string | number; l: string; d?: string; c?: string }) => <div className="rounded-lg border bg-white px-4 py-3.5" style={{ borderColor: LINE }}><div className="text-[12.5px]" style={{ color: SUB }}>{l}</div><div className="mt-1 text-[28px] font-semibold tabular-nums leading-none" style={{ color: TXT }}>{v}</div>{d && <div className="mt-1.5 text-[12px]" style={{ color: SUB }}>{d}</div>}</div>;
const halo = (t: Tier) => { let b = { m: 0, u: 1 }; const pts: [number, number][] = [[0, 1]]; for (let k = 1; k <= 10; k++) { b = step(b, b.m, t); pts.push([k, b.u]); } return pts; };
const MODELS: [string, string, number, string][] = [
  ["Hydrogen + Decisions", "fill and gate 122 raw pages", proof.pages.tokens.system_v2, PUR], ["Argon", "baseline on the same pages", proof.pages.tokens.baseline, GREY],
  ["Hydrogen + Decisions", "70 listings", proof.listings.tokens.system, PUR], ["Argon", "baseline, listings", proof.listings.tokens.baseline, GREY],
  ["Hydrogen + Decisions", "Gemi to Gemi, 3 peers", 18196, TEAL], ["Carbon", "review of the whole design", 15314, GOLD],
];

export default function Admin() {
  const [f, setF] = useState<any>(null), [tab, setTab] = useState("Dashboard"), [me, setMe] = useState<any[]>([]), [q, setQ] = useState("");
  useEffect(() => { fetch("/api/foundry").then((r) => r.json()).then(setF).catch(() => setF({ error: true })); }, []);
  // Users: there is no account system. What can be listed honestly is what this browser holds, per campus.
  useEffect(() => { try { setMe(["nyu", "columbia"].map((sc) => { const log = JSON.parse(localStorage.getItem(`gemi.log.${sc}`) ?? "[]"), m = JSON.parse(localStorage.getItem(`gemi.me.${sc}`) ?? "null"), went = JSON.parse(localStorage.getItem(`gemi.went.${sc}`) ?? "[]");
    return { sc, name: m?.name ?? (m ? "(demo Gemi)" : null), events: log.length, said: log.filter((e: any) => e.type === "said").length, kept: log.filter((e: any) => e.type === "choice" && e.action === "keep").length, skipped: log.filter((e: any) => e.type === "choice" && e.action === "skip").length, trips: log.filter((e: any) => e.type === "trip").length, went: went.length, last: log.length ? log[log.length - 1].at : null }; }).filter((u) => u.name || u.events)); } catch {} }, []);
  const t = f?.totals, rows: any[] = f?.rows ?? [];
  const byNeed: Record<string, number> = {}; for (const r of rows) for (const n of r.needs ?? []) byNeed[n] = (byNeed[n] ?? 0) + 1;
  const served = t?.served ?? 0, maxTok = Math.max(...MODELS.map((m) => m[2]));
  const NAV: [string, string][] = [["Dashboard", "Overview"], ["Data flywheel", "Shared base"], ["AI performance", "Models and accuracy"], ["Users", "Students and Gemis"], ["Test runs", "Run at speed"]];
  const shown = rows.filter((r) => !q || `${r.name} ${r.type} ${r.school}`.toLowerCase().includes(q.toLowerCase())).slice(0, 14);
  const th = "border-b px-3 py-2 text-left text-[12px] font-medium uppercase tracking-wide", td = "border-b px-3 py-2 text-[13px]";
  return (
    <main className="flex min-h-screen bg-[#f9fafb] text-[#111827]" style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r bg-white" style={{ borderColor: LINE }}>
        <a href="/" className="border-b px-5 py-4 text-[17px] font-semibold" style={{ borderColor: LINE }}>Gemiverse <span className="ml-1 rounded bg-[#eef2ff] px-1.5 py-0.5 text-[11px] font-medium text-[#4338ca]">Admin</span></a>
        <nav className="flex-1 space-y-0.5 p-3">{NAV.map(([n, d]) => <button key={n} onClick={() => setTab(n)} className="block w-full rounded-md px-3 py-2 text-left" style={{ background: tab === n ? "#f3f4f6" : "transparent" }}><span className="block text-[14px] font-medium" style={{ color: tab === n ? TXT : "#374151" }}>{n}</span><span className="block text-[12px]" style={{ color: SUB }}>{d}</span></button>)}</nav>
        <div className="border-t p-3 text-[12.5px]" style={{ borderColor: LINE, color: SUB }}><a href="/room" className="block rounded-md px-3 py-1.5 hover:bg-[#f3f4f6]">Switch to student view →</a><a href="/deck" className="block rounded-md px-3 py-1.5 hover:bg-[#f3f4f6]">Method and results →</a><p className="px-3 pt-2">Open to everyone during the hackathon. No accounts yet.</p></div>
      </aside>

      <div className="min-w-0 flex-1 px-8 py-6">
        <div className="mb-5 flex items-end justify-between"><div><h1 className="text-[22px] font-semibold">{tab}</h1><p className="text-[13px]" style={{ color: SUB }}>{NAV.find((x) => x[0] === tab)?.[1]} · {t ? "live from the shared base" : f?.error ? "the shared base is not reachable" : "loading"} · results as of {String(proof.at).slice(11, 16)} UTC</p></div></div>

        {tab === "Dashboard" && (<div className="space-y-5">
          <div className="grid grid-cols-5 gap-4"><Kpi v={t?.entities ?? "–"} l="Entities in the base" d={t ? `${t.events} events · ${t.organisations} organisations · ${t.places} places` : ""} /><Kpi v={t ? `${Math.round((t.fields_passed / t.fields) * 100)}%` : "–"} l="Fields passing the gate" d={t ? `${t.fields_passed} of ${t.fields}` : ""} /><Kpi v={`${(PG.system_v2.error_rate * 100).toFixed(1)}%`} l="Error rate, unseen pages" d={`baseline ${(PG.baseline.error_rate * 100).toFixed(1)}% · ${proof.pages.facts} facts`} /><Kpi v={served} l="Checked facts served" d={`about ${Math.round((served * TPP) / 1000)}k tokens not re-spent`} /><Kpi v={proof.improvements.length} l="Corrections logged" d="each with before, how, after" /></div>
          <div className="grid grid-cols-2 gap-5">
            <Card title="Error rate against a single model call" note="Wrong facts shown, of facts shown."><Bars yMax={0.1} yLabel="error rate" fmt={(v) => `${(v * 100).toFixed(1)}%`} h={250} groups={[
              { label: "Listings", bars: [{ name: "baseline", value: L.baseline.error_rate, color: "#d1d5db" }, { name: "ours", value: L.v3.error_rate, color: "#4f46e5" }] },
              { label: "Raw pages, run 1", bars: [{ name: "baseline", value: P1.baseline.error_rate, color: "#d1d5db" }, { name: "ours", value: P1.system.error_rate, color: "#dc2626" }] },
              { label: "After the fix", bars: [{ name: "baseline", value: PG.baseline.error_rate, color: "#d1d5db" }, { name: "+reader", value: PG.baseline_visible.error_rate, color: "#9ca3af" }, { name: "ours", value: PG.system_v2.error_rate, color: "#4f46e5" }] }]} /></Card>
            <Card title="Coverage of student needs" note="Entities per growth need. Short bars are where the base cannot help yet.">
              {t ? <Bars yMax={Math.max(10, ...Object.values(byNeed)) * 1.15} yLabel="entities" h={250} fmt={(v) => String(Math.round(v))} groups={Object.entries(byNeed).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => ({ label: k.replace(/_/g, " ").slice(0, 13), bars: [{ name: "", value: v, color: "#0d9488" }] }))} /> : <p className="text-[13px]" style={{ color: SUB }}>Loading…</p>}</Card>
          </div>
          <Card title="Open issues" note="From Gemini 4 Carbon's review of the whole design (14:50) and our own log."><table className="w-full"><tbody>
            {[["Resolved", "12 online-or-not errors: 9 hybrid events, 2 mislabelled by the calendar, 1 real error", "#059669"], ["Open", "The field 'online' needs three values; not rebuilt or rerun", "#d97706"], ["Open", "The learning half has no measured accuracy outside simulated students", "#d97706"], ["Open", "Autonomous Carbon and Decisions calls are charged 0 Gem Stars", "#d97706"], ["Resolved", "Managed Agent wired: re-checks one find live on request (22 to 30 s)", "#059669"], ["Open", "Daily trips still read the checked base; they do not browse live", "#d97706"]].map(([st, x, c]) => <tr key={x}><td className={td} style={{ borderColor: LINE, width: 110 }}><span className="rounded px-2 py-0.5 text-[12px] font-medium text-white" style={{ background: c }}>{st}</span></td><td className={td} style={{ borderColor: LINE }}>{x}</td></tr>)}</tbody></table></Card>
        </div>)}

        {tab === "Data flywheel" && (<div className="space-y-5">
          <div className="grid grid-cols-4 gap-4"><Kpi v={t?.entities ?? "–"} l="Entities" /><Kpi v={t?.links ?? "–"} l="Links between entities" /><Kpi v={served} l="Times a checked fact was served" d="anonymous counts only" /><Kpi v={t?.due ?? "–"} l="Due for a re-check" d="unchanged pages cost 0 tokens" /></div>
          <div className="grid grid-cols-[1fr_1.6fr] gap-5">
            <Card title="How one check keeps paying" note={`Checking a page costs about ${Math.round(TPP).toLocaleString()} tokens.`}>
              <LineChart logX xMax={1000} yMax={2600} h={250} xLabel="Gemis reading the same page" yLabel="tokens per student" xTicks={[1, 3, 10, 100, 1000]} yTicks={[0, 1000, 2000]} series={[{ name: "unchecked, each alone", color: "#9ca3af", dash: true, points: [[1, proof.pages.tokens.baseline / proof.pages.n], [1000, proof.pages.tokens.baseline / proof.pages.n]] }, { name: "checked once, shared", color: "#4f46e5", points: [1, 2, 3, 5, 10, 30, 100, 300, 1000].map((n) => [n, TPP / n] as [number, number]) }]} />
              <ol className="mt-2 space-y-1 text-[13px]" style={{ color: "#374151" }}><li>1. A Gemi goes out and reads a page.</li><li>2. Every field is checked against the source.</li><li>3. What passes enters the shared base.</li><li>4. Every other Gemi reads it for free.</li></ol></Card>
            <Card title="Entities" note="Each row is one entity with its checked fields.">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, type or campus" className="mb-3 w-72 rounded-md border px-3 py-1.5 text-[13px] outline-none" style={{ borderColor: LINE }} />
              <table className="w-full"><thead><tr style={{ color: SUB }}>{["Name", "Type", "Campus", "Fields passed", "Served", "Source"].map((x) => <th key={x} className={th} style={{ borderColor: LINE }}>{x}</th>)}</tr></thead><tbody>
                {shown.map((r) => <tr key={r.id}><td className={td} style={{ borderColor: LINE }}>{String(r.name).slice(0, 46)}</td><td className={td} style={{ borderColor: LINE, color: SUB }}>{r.type}</td><td className={td} style={{ borderColor: LINE, color: SUB }}>{r.school}</td><td className={td} style={{ borderColor: LINE }}>{r.passed}/{r.fields}</td><td className={td} style={{ borderColor: LINE }}>{r.served}</td><td className={td} style={{ borderColor: LINE }}>{r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="text-[#4f46e5] underline">page</a> : "–"}</td></tr>)}</tbody></table>
              <a href="/foundry" className="mt-3 inline-block text-[13px] font-medium text-[#4f46e5]">All {rows.length} entities, field by field, and re-check →</a></Card>
          </div>
        </div>)}

        {tab === "AI performance" && (<div className="space-y-5">
          <div className="grid grid-cols-4 gap-4"><Kpi v="0 / 76" l="Unsupported fields shown" d="baseline 29 / 103, ten unseen pages" /><Kpi v={`${(PG.system_v2.coverage * 100).toFixed(1)}%`} l="Coverage, raw pages" d="facts shown of facts that exist" /><Kpi v={`${(proof.pages.tokens.system_v2 / proof.pages.tokens.baseline).toFixed(1)}×`} l="Token cost against one call" d={`${Math.round(TPP)} tokens a page`} /><Kpi v={PG.system_v2.wrong} l="Facts still wrong" d="12 of them hybrid events" /></div>
          <div className="grid grid-cols-2 gap-5">
            <Card title="Tokens by model and job" note="Measured, from the run files in base/runs.">
              <div className="space-y-2.5">{MODELS.map(([m, job, tok], i) => (<div key={i} className="grid grid-cols-[11rem_1fr_3.5rem] items-center gap-3 text-[13px]"><span><span className="font-medium">{m}</span><br /><span style={{ color: SUB }}>{job}</span></span><div className="h-2.5 rounded-full bg-[#f3f4f6]"><div className="h-full rounded-full" style={{ width: `${(tok / maxTok) * 100}%`, background: m.startsWith("Argon") ? "#9ca3af" : m.startsWith("Carbon") ? "#d97706" : "#4f46e5" }} /></div><span className="text-right tabular-nums">{(tok / 1000).toFixed(0)}k</span></div>))}</div></Card>
            <Card title="How fast its picture of a student sharpens" note="Uncertainty on one axis after n pieces of evidence. Computed from lib/mind.ts.">
              <LineChart xMax={10} yMax={1} h={240} xLabel="pieces of evidence" yLabel="uncertainty" xTicks={[0, 2, 4, 6, 8, 10]} yTicks={[0, 0.25, 0.5, 0.75, 1]} series={([["self_reported", "said it", "#9ca3af"], ["checked", "chose it", "#d97706"], ["seen_over_time", "seen over time", "#0d9488"], ["actually_done", "did it", "#4f46e5"]] as [Tier, string, string][]).map(([k, name, color]) => ({ name, color, points: halo(k) }))} /></Card>
          </div>
          <Card title="Behaviour policy" note={`What a Gemi does on its own: ${POLICY.length} rules, first match wins. Read from lib/kernel/autonomy.ts.`}>
            <table className="w-full"><thead><tr style={{ color: SUB }}>{["#", "When", "Does", "Method", "Costs it"].map((x) => <th key={x} className={th} style={{ borderColor: LINE }}>{x}</th>)}</tr></thead><tbody>
              {POLICY.map((r, k) => <tr key={r.id}><td className={td} style={{ borderColor: LINE, color: SUB }}>{k + 1}</td><td className={td} style={{ borderColor: LINE }}>{r.when}</td><td className={td} style={{ borderColor: LINE }}>{r.then.state}</td><td className={td} style={{ borderColor: LINE, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{r.then.method ?? "–"}</td><td className={td} style={{ borderColor: LINE }}>{r.then.stars ? `${r.then.stars} Gem Stars` : "0"}</td></tr>)}</tbody></table></Card>
          <Card title="Registered methods" note={`${TOOLS.length} tools. Nothing outside this list can be called.`}>
            <table className="w-full"><thead><tr style={{ color: SUB }}>{["Method", "Mode", "Model", "Price", "Daily cap", "Confirm"].map((x) => <th key={x} className={th} style={{ borderColor: LINE }}>{x}</th>)}</tr></thead><tbody>
              {TOOLS.map((x) => <tr key={x.name}><td className={td} style={{ borderColor: LINE, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{x.name}</td><td className={td} style={{ borderColor: LINE }}>{x.mode}</td><td className={td} style={{ borderColor: LINE, color: SUB }}>{x.model ?? "code"}</td><td className={td} style={{ borderColor: LINE }}>{x.stars ? `${x.stars} Gem Stars` : "free"}</td><td className={td} style={{ borderColor: LINE }}>{x.dailyCap}</td><td className={td} style={{ borderColor: LINE }}>{x.confirm}</td></tr>)}</tbody></table></Card>
        </div>)}

        {tab === "Users" && (<div className="space-y-5">
          <div className="rounded-lg border px-4 py-3 text-[13px]" style={{ borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" }}>There is no account system yet. A student's Gemi and everything it has learned live only in that student's browser, by design. The server keeps anonymous counts of which checked facts were served, never who asked. So this page can list only the Gemis held in <b>this</b> browser.</div>
          <Card title="Gemis in this browser" note="Read from local storage on this device.">
            {me.length === 0 ? <p className="text-[13px]" style={{ color: SUB }}>None yet. Open the student view and meet a Gemi.</p> : (
              <table className="w-full"><thead><tr style={{ color: SUB }}>{["Gemi", "Campus", "Things said", "Trips", "Kept", "Skipped", "Really went", "Last activity", ""].map((x) => <th key={x} className={th} style={{ borderColor: LINE }}>{x}</th>)}</tr></thead><tbody>
                {me.map((u) => <tr key={u.sc}><td className={td} style={{ borderColor: LINE }}><span className="font-medium">{u.name ?? "(not named)"}</span></td><td className={td} style={{ borderColor: LINE }}>{u.sc === "nyu" ? "NYU" : "Columbia"}</td><td className={td} style={{ borderColor: LINE }}>{u.said}</td><td className={td} style={{ borderColor: LINE }}>{u.trips}</td><td className={td} style={{ borderColor: LINE }}>{u.kept}</td><td className={td} style={{ borderColor: LINE }}>{u.skipped}</td><td className={td} style={{ borderColor: LINE }}>{u.went}</td><td className={td} style={{ borderColor: LINE, color: SUB }}>{u.last ? new Date(u.last).toLocaleString() : "–"}</td>
                  <td className={td} style={{ borderColor: LINE }}><button onClick={() => { if (!confirm(`Remove this Gemi and everything it learned at ${u.sc}? This cannot be undone.`)) return; for (const k of Object.keys(localStorage)) if (k.startsWith("gemi.") && k.endsWith(`.${u.sc}`)) localStorage.removeItem(k); setMe(me.filter((x) => x.sc !== u.sc)); }} className="text-[12.5px] text-[#dc2626] underline">Reset</button></td></tr>)}</tbody></table>)}</Card>
          <Card title="Simulated students" note="Used by test runs. Hydrogen plays each one with hidden tendencies the Gemi never sees.">
            <table className="w-full"><thead><tr style={{ color: SUB }}>{["Gemi", "Campus", "Who", "Used for"].map((x) => <th key={x} className={th} style={{ borderColor: LINE }}>{x}</th>)}</tr></thead><tbody>
              <tr><td className={td} style={{ borderColor: LINE }}>Mochi</td><td className={td} style={{ borderColor: LINE }}>NYU</td><td className={td} style={{ borderColor: LINE }}>first-year PhD student, education</td><td className={td} style={{ borderColor: LINE }}>day runs, Gemi to Gemi</td></tr>
              <tr><td className={td} style={{ borderColor: LINE }}>Pip</td><td className={td} style={{ borderColor: LINE }}>Columbia</td><td className={td} style={{ borderColor: LINE }}>sophomore, undecided</td><td className={td} style={{ borderColor: LINE }}>day runs</td></tr>
              <tr><td className={td} style={{ borderColor: LINE, color: SUB }}>3 per run</td><td className={td} style={{ borderColor: LINE, color: SUB }}>either</td><td className={td} style={{ borderColor: LINE, color: SUB }}>invented by Carbon for each introduction round</td><td className={td} style={{ borderColor: LINE, color: SUB }}>Gemi to Gemi</td></tr></tbody></table></Card>
        </div>)}

        {tab === "Test runs" && (<div className="grid grid-cols-3 gap-5">
          {[["/admin/days", "Run whole days", "The Gemi plans, goes out and saves on its own; Hydrogen plays a student with hidden tendencies. Charts show whether its guesses and its picture of the student improve day by day.", "about 50 s a day"],
            ["/meet", "Gemi to Gemi", "Carbon invents three students. Every message passes a privacy gate. Name cards are kept only if they claim what was really said.", "about 35 s a round"],
            ["/foundry", "Re-check the base", "Fingerprint every source again. Unchanged pages cost 0 tokens; changed fields go back through the gate.", "depends on what changed"]].map(([h, tt, d, n]) => (
            <a key={h} href={h} className="rounded-lg border bg-white p-5 hover:border-[#4f46e5]" style={{ borderColor: LINE }}><h2 className="text-[15px] font-semibold">{tt}</h2><p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "#374151" }}>{d}</p><p className="mt-3 text-[12.5px]" style={{ color: SUB }}>{n}</p><span className="mt-3 inline-block rounded-md bg-[#4f46e5] px-3 py-1.5 text-[13px] font-medium text-white">Open</span></a>))}
          <Card title="Corrections log" note={`${proof.improvements.length} entries.`} className="col-span-3"><table className="w-full"><thead><tr style={{ color: SUB }}>{["#", "Area", "Before", "After"].map((x) => <th key={x} className={th} style={{ borderColor: LINE }}>{x}</th>)}</tr></thead><tbody>
            {(proof.improvements as any[]).map((x, i) => <tr key={x.id}><td className={td} style={{ borderColor: LINE, color: SUB }}>{i + 1}</td><td className={td} style={{ borderColor: LINE }}>{x.area}</td><td className={td} style={{ borderColor: LINE }}>{String(x.before).slice(0, 80)}</td><td className={td} style={{ borderColor: LINE }}>{String(x.after).slice(0, 110)}</td></tr>)}</tbody></table></Card>
        </div>)}
      </div>
    </main>
  );
}

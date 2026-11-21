"use client";

import { useEffect, useState } from "react";
import { Chunky, INK } from "@/components/game";

type Row = { id: string; type: string; school: string; name: string; tier: number; needs: string[]; url: string | null; start: string | null; fields: number; passed: number; hashed: boolean; checked_at: string; due: boolean; served: number };
type Data = { totals: Record<string, number>; rows: Row[]; coverage: Record<string, Record<string, number>>; needs: Record<string, { label: string; means: string }>; exam: any; designs: { file: string; by: string; at: string | null }[]; error?: string };

const Card = ({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) => (
  <section className="rounded-[24px] border-[3px] bg-[#fffaf0] p-6" style={{ borderColor: INK, boxShadow: `0 6px 0 ${INK}22` }}>
    <h2 className="text-lg font-bold">{title}</h2>
    {note && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#5f576c]">{note}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

export default function Foundry() {
  const [d, setD] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [school, setSchool] = useState<"nyu" | "columbia">("nyu");
  const load = () => fetch("/api/foundry").then((r) => r.json()).then(setD).catch(() => setD({ error: "Could not reach the base." } as any));
  useEffect(() => { load(); }, []);
  async function recheck(id: string) {
    setBusy(id);
    try { const r = await fetch("/api/foundry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }).then((x) => x.json());
      setNotes((n) => ({ ...n, [id]: r.error ?? `${r.note} (${r.tokens ?? 0} tokens)` })); load(); } finally { setBusy(null); }
  }
  const t = d?.totals, ex = d?.exam;
  const cell = (set: any, who: "twin" | "baseline", k: string) => set?.[who]?.[k] ?? "–";

  return (
    <main className="min-h-screen bg-[#f6f2ee] px-8 py-8 text-[#2b2536]">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-baseline justify-between">
          <div><a href="/" className="text-xl font-bold">Gemiverse</a><span className="ml-3 text-sm text-[#8a8296]">Foundry · the shared base, how it was designed and how it stays true</span></div>
          <a href="/admin" className="text-sm underline">Run days →</a>
        </header>
        {d?.error && <p className="rounded-xl bg-[#fff0d6] px-4 py-3 text-sm">{d.error}</p>}

        <Card title="1 · Designed by two designers, in parallel" note="Gemini 4 Carbon (high thinking) and the coding assistant each designed the base from the same brief without seeing the other. The originals are kept; the merge is a separate file. Nothing is overwritten.">
          <div className="flex flex-wrap gap-2">{(d?.designs ?? []).map((x) => (
            <a key={x.file} href={`https://github.com/haodaz/gemiverse/blob/main/base/design/${x.file}`} target="_blank" rel="noreferrer" className="rounded-xl border-2 bg-white px-3 py-2 text-xs" style={{ borderColor: INK }}>
              <b>{x.file}</b><br /><span className="text-[#8a8296]">{String(x.by).slice(0, 44)}</span></a>))}
            <a href="https://github.com/haodaz/gemiverse/blob/main/base/design/MERGE.md" target="_blank" rel="noreferrer" className="rounded-xl border-2 px-3 py-2 text-xs font-bold" style={{ borderColor: INK, background: "#ffe08a" }}>MERGE.md<br /><span className="font-normal">where they agreed and where they did not</span></a>
          </div>
        </Card>

        <Card title="2 · Measured against a single model call" note="Each page is filled by Hydrogen to the merged design and every field is checked by the Decisions API; a field enters only at 0.8 or above. The baseline is one Argon call with no design and no check. The exam set was never seen while designing.">
          <table className="w-full text-sm"><thead><tr className="text-left text-xs text-[#8a8296]"><th className="py-1"></th><th>Design set (15) · ours</th><th>baseline</th><th>Exam set (10) · ours</th><th>baseline</th></tr></thead><tbody>
            {[["Fields shown to a student", "fields_shown"], ["Shown without support on the page", "unsupported_fields_shown"], ["Start date right", "start_date_right"], ["Start date wrong", "start_date_wrong"], ["Start date withheld", "start_date_withheld"], ["Tokens", "tokens"]].map(([label, k]) => (
              <tr key={k} className="border-t border-[#eee6d6]"><td className="py-1.5 pr-3">{label}</td>
                <td className="tabular-nums font-semibold">{cell(ex?.design, "twin", k)}</td><td className="tabular-nums text-[#8a8296]">{cell(ex?.design, "baseline", k)}</td>
                <td className="tabular-nums font-semibold">{cell(ex?.exam, "twin", k)}</td><td className="tabular-nums text-[#8a8296]">{cell(ex?.exam, "baseline", k)}</td></tr>))}
          </tbody></table>
          <p className="mt-3 text-xs leading-relaxed text-[#8a8296]">Read honestly: zero unsupported fields on our side is by construction, because the gate is the same check. The findings are that a single call shows about one unsupported field in four, and that ours never showed a wrong date, at the price of withholding dates on pages that print no year.</p>
        </Card>

        <Card title="3 · The flywheel" note="What one Gemi checks, every Gemi can read for free. A revisit compares the page's fingerprint and spends tokens only if the page changed. Demand is one anonymous number per entity: how many times any Gemi carried it back. Nothing about who.">
          <div className="grid grid-cols-6 gap-3 text-center">{t && [["entities", t.entities], ["events", t.events], ["places", t.places], ["organisations", t.organisations], ["fields checked", `${t.fields_passed}/${t.fields}`], ["carried back", t.served]].map(([k, v]) => (
            <div key={k as string} className="rounded-2xl border-2 bg-white px-2 py-3" style={{ borderColor: INK }}><div className="text-2xl font-bold tabular-nums">{v}</div><div className="text-[11px] text-[#8a8296]">{k}</div></div>))}</div>
          <h3 className="mt-6 text-sm font-bold">Where the base is thin: checked resources per growth need</h3>
          <p className="text-xs text-[#8a8296]">An empty cell is where the next Gem Star is worth most. This is the gap a Gemi fills when it goes out.</p>
          <table className="mt-2 w-full text-xs"><thead><tr className="text-left text-[#8a8296]"><th className="py-1">need</th><th>NYU</th><th>Columbia</th></tr></thead><tbody>
            {d && Object.entries(d.needs).map(([id, n]) => (<tr key={id} className="border-t border-[#eee6d6]"><td className="py-1 pr-3"><b>{n.label}</b> <span className="text-[#8a8296]">{n.means}</span></td>
              {(["nyu", "columbia"] as const).map((s) => { const v = d.coverage[s]?.[id] ?? 0; return <td key={s} className="w-28"><span className="inline-block rounded-full px-2 py-0.5 font-bold tabular-nums" style={{ background: v === 0 ? "#ffd9d9" : v < 2 ? "#ffe9b8" : "#d9f2df" }}>{v === 0 ? "gap" : v}</span></td>; })}</tr>))}
          </tbody></table>
        </Card>

        <Card title="4 · Every entity, its checks, its freshness" note="Re-check fetches the source again. Same fingerprint: nothing is re-read and it costs 0 tokens. Different: only the stated fields are filled and checked again.">
          <div className="mb-3 flex gap-2">{(["nyu", "columbia"] as const).map((s) => <Chunky key={s} small color={school === s ? "#ffe08a" : "#fffaf0"} onClick={() => setSchool(s)}>{s === "nyu" ? "NYU" : "Columbia"}</Chunky>)}</div>
          <table className="w-full text-xs"><thead><tr className="text-left text-[#8a8296]"><th className="py-1">entity</th><th>type</th><th>tier</th><th>checked</th><th>carried back</th><th>last check</th><th></th></tr></thead><tbody>
            {(d?.rows ?? []).filter((r) => r.school === school).sort((a, b) => (a.type === "Event" ? 0 : 1) - (b.type === "Event" ? 0 : 1) || a.id.localeCompare(b.id)).map((r) => (
              <tr key={r.id} className="border-t border-[#eee6d6] align-top"><td className="py-1.5 pr-2"><b>{r.name}</b>{notes[r.id] && <div className="mt-0.5 text-[11px] text-[#2f7a3d]">{notes[r.id]}</div>}</td>
                <td>{r.type}</td><td className="tabular-nums">{r.tier}</td><td className="tabular-nums">{r.fields ? `${r.passed}/${r.fields}` : "–"}</td><td className="tabular-nums">{r.served}</td>
                <td>{new Date(r.checked_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}{r.hashed ? " · fingerprinted" : ""}{r.due ? <b className="ml-1 text-[#b26a00]">due</b> : null}</td>
                <td className="text-right">{r.url && r.type === "Event" && <Chunky small color="#a8e0c0" disabled={busy === r.id} onClick={() => recheck(r.id)}>{busy === r.id ? "…" : "Re-check"}</Chunky>}</td></tr>))}
          </tbody></table>
        </Card>
      </div>
    </main>
  );
}

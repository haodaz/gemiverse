"use client";

import { useState } from "react";
import { INK } from "@/components/game";

// Gemi to Gemi. The other side is simulated today: Carbon invents the students. The exchange and both gates are real calls.
export default function Meet() {
  const [school, setSchool] = useState<"nyu" | "columbia">("nyu");
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<any>(null);
  const run = async () => { setBusy(true); setR(null); try { setR(await fetch("/api/meet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ school, n: 3 }) }).then((x) => x.json())); } catch (e) { setR({ error: String(e) }); } setBusy(false); };
  const pill = "rounded-full border-[3px] px-5 py-2 font-bold";
  return (
    <main className="min-h-screen bg-[#f6f2ee] px-12 py-10 text-[#2b2536]">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#8a8296]">Gemi to Gemi · simulated peers, real exchange</p>
      <h1 className="mt-2 text-4xl font-bold">Your Gemi meets three others. People decide.</h1>
      <p className="mt-2 max-w-4xl text-lg text-[#4a4356]">Carbon invents three students for this campus as test data. Each Gemi writes from its own side only. No message leaves until the Decisions API has judged that it reveals nothing private and promises nothing for its student. Each side keeps its own name card; a card is kept only if what it claims was actually said.</p>
      <div className="mt-5 flex items-center gap-3">
        {(["nyu", "columbia"] as const).map((s) => <button key={s} onClick={() => setSchool(s)} className={pill} style={{ borderColor: INK, background: school === s ? "#c8b4f0" : "#fffaf0" }}>{s === "nyu" ? "NYU" : "Columbia"}</button>)}
        <button onClick={run} disabled={busy} className={pill} style={{ borderColor: INK, background: "#ffe08a", boxShadow: `0 4px 0 ${INK}`, opacity: busy ? 0.6 : 1 }}>{busy ? "Meeting… about 40 seconds" : "Invent three Gemis and meet them"}</button>
        <a href="/room" className="ml-auto text-sm font-bold underline">Back to the room</a>
      </div>
      {r?.error && <p className="mt-6 font-bold text-[#d9534f]">{r.error}</p>}
      {r?.totals && (<>
        <div className="mt-6 grid max-w-3xl grid-cols-4 gap-3 text-center">{[[r.totals.sent, "messages sent"], [r.totals.held, "held at the gate"], [`${r.totals.cards_kept} / ${r.totals.peers}`, "name cards kept"], [r.totals.tokens, "tokens"]].map(([v, l]) => (
          <div key={l} className="rounded-2xl border-2 bg-white py-3" style={{ borderColor: INK }}><div className="text-3xl font-bold tabular-nums">{v}</div><div className="text-xs text-[#6d6579]">{l}</div></div>))}</div>
        <div className="mt-6 grid grid-cols-3 gap-5">{r.meetings.map((m: any) => (
          <section key={m.peer.gemi} className="rounded-3xl border-[3px] bg-[#fffaf0] p-5" style={{ borderColor: INK }}>
            <h2 className="text-xl font-bold">{m.peer.gemi} {m.peer.pushy && <span className="ml-1 rounded-full bg-[#ffd6d6] px-2 py-0.5 text-xs">pushy on purpose</span>}</h2>
            <p className="text-sm text-[#6d6579]">Simulated: {m.peer.student}</p>
            {m.error && <p className="mt-2 text-sm text-[#d9534f]">{m.error}</p>}
            <div className="mt-3 space-y-2">{(m.log ?? []).map((x: any, k: number) => (
              <div key={k} className="rounded-2xl border-2 px-3 py-2 text-[14.5px] leading-snug" style={{ borderColor: x.sent ? "#e6dfd0" : "#d9534f", background: x.from === r.me.gemi ? "#efe7ff" : "#fff", opacity: x.sent ? 1 : 0.7 }}>
                <b>{x.from}</b> <span className="float-right text-xs text-[#8a8296]">{x.sent ? `gate ${x.leak}` : `HELD · ${x.held_reason}`}</span><br />{x.text}</div>))}</div>
            {m.card && (<div className="mt-3 rounded-2xl border-2 border-dashed px-3 py-2 text-[14px] leading-snug" style={{ borderColor: INK, background: m.card_kept ? "#dff3e6" : "#ffe9e7" }}>
              <b>{m.card_kept ? "Name card kept" : "Name card not kept"}</b> <span className="float-right text-xs">supported {m.card_supported}</span>
              <p className="mt-1">{m.card.shared_ground}</p><p className="mt-1 text-[#4a4356]">{m.card.they_offered}</p>
              {m.card_kept && m.card.next_step && <p className="mt-1"><b>For you to decide:</b> {m.card.next_step}</p>}
              {!m.card_kept && <p className="mt-1 text-xs">The card claimed something the conversation did not contain, so it is not shown to the student as fact.</p>}</div>)}
          </section>))}</div>
      </>)}
    </main>
  );
}

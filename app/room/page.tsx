"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SCHOOLS, loadSchool, type SchoolId } from "@/lib/schools";
import { TOOLS } from "@/lib/kernel/tools";
import { mayCall } from "@/lib/kernel/governance";
import type { GemiState } from "@/lib/kernel/types";

type Entity = { id: string; name: string; fields: Record<string, any>; tier: number };
type Evidence = { entity_id: string; field: string; check_confidence: number | null; passed: boolean | null };

const NEED: Record<string, string> = {
  find_my_people: "find my people", build_a_skill: "build a skill", explore_a_field: "explore a field", get_experience: "get experience",
  make_and_express: "make and express", get_mentorship_and_feedback: "get feedback", decide_a_direction: "decide a direction",
  fund_my_path: "fund my path", contribute_beyond_self: "contribute", navigate_systems: "navigate systems", rest_and_recover: "rest and recover",
};
const when = (f: Record<string, any>) => {
  const s = f.occurrences?.[0]?.start; if (!s) return "date not confirmed";
  const d = new Date(s); return d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

export default function Room() {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const [school, setSchool] = useState<SchoolId | null>(null);
  const [tab, setTab] = useState<"desk" | "tools" | "diary" | "outbox">("desk");
  const [doing, setDoing] = useState("settling in");
  const [base, setBase] = useState<{ entities: Entity[]; evidence: Evidence[]; error?: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [state] = useState<GemiState>({ stage: 1, purses: { for_you: 6, for_itself: 4 }, usedToday: {}, confirmed: [], paused: false });

  useEffect(() => { const s = loadSchool(); if (!s) router.replace("/"); else setSchool(s); }, [router]);
  useEffect(() => { if (school) fetch(`/api/base?school=${school}`).then((r) => r.json()).then(setBase).catch(() => setBase({ entities: [], evidence: [], error: "Could not reach the base." })); }, [school]);
  useEffect(() => {
    const on = (ev: MessageEvent) => { if (ev.data?.source === "gemiverse-room" && ev.data.type === "doing") setDoing(ev.data.value); };
    addEventListener("message", on); return () => removeEventListener("message", on);
  }, []);
  const send = (type: string, value?: unknown) => frame.current?.contentWindow?.postMessage({ source: "gemiverse", type, value }, "*");

  const s = school ? SCHOOLS[school] : null;
  const evidenceOf = useMemo(() => { const m: Record<string, Evidence[]> = {}; for (const e of base?.evidence ?? []) (m[e.entity_id] ??= []).push(e); return m; }, [base]);
  if (!s) return null;

  return (
    <main className="flex h-screen bg-[#f6f2ee] text-[#2b2536]">
      <section className="relative min-w-0 flex-1">
        <iframe ref={frame} src={`/gen3d/viewer.html?embed=1&school=${s.id}`} title="Your Gemi's room" className="h-full w-full border-0" />
        <div className="pointer-events-none absolute left-6 top-5 flex items-center gap-3">
          <a href="/" className="pointer-events-auto text-lg font-semibold tracking-tight">Gemiverse</a>
          <span className="rounded-full px-3 py-1 text-xs font-medium text-white" style={{ background: s.accent }}>{s.short}</span>
        </div>
        <div className="absolute bottom-6 left-6 flex gap-2">
          <button onClick={() => send("arrange")} className="rounded-full bg-white px-4 py-2 text-sm shadow">Arrange room</button>
          <button onClick={() => send("palette", Math.floor(Math.random() * 3))} className="rounded-full bg-white px-4 py-2 text-sm shadow">Change colours</button>
        </div>
        <div className="absolute bottom-6 right-6 max-w-xs rounded-2xl bg-white/90 px-4 py-3 text-sm shadow">
          <div className="text-xs uppercase tracking-wider text-[#8a8296]">Right now</div>
          <div className="mt-0.5">Your Gemi is {doing}.</div>
        </div>
      </section>

      <aside className="flex w-[440px] shrink-0 flex-col border-l border-[#e8e1ea] bg-white">
        <header className="border-b border-[#eee8f0] px-6 py-5">
          <div className="flex items-baseline justify-between">
            <h1 className="text-xl font-semibold">Your Gemi</h1>
            <span className="text-xs text-[#8a8296]">Stage 1 of 5 · Unpacked</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {(["for_you", "for_itself"] as const).map((p) => (
              <div key={p} className="rounded-2xl px-4 py-3" style={{ background: s.soft }}>
                <div className="text-xs text-[#5f576c]">{p === "for_you" ? "Stars for you" : "Stars for itself"}</div>
                <div className="mt-1 text-2xl font-semibold" style={{ color: s.accent }}>{"★".repeat(state.purses[p])}<span className="ml-2 text-sm font-normal text-[#5f576c]">{state.purses[p]}</span></div>
                <div className="mt-1 text-[11px] leading-snug text-[#8a8296]">{p === "for_you" ? "Going out, checking, asking other AIs." : "Thinking, its diary, its room."}</div>
              </div>
            ))}
          </div>
        </header>

        <nav className="flex gap-1 border-b border-[#eee8f0] px-4 pt-3 text-sm">
          {([["desk", "Desk"], ["tools", "What it can do"], ["diary", "Diary"], ["outbox", "What left this room"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className="rounded-t-lg px-3 py-2" style={tab === k ? { color: s.accent, boxShadow: `inset 0 -2px 0 ${s.accent}`, fontWeight: 600 } : { color: "#8a8296" }}>{label}</button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {tab === "desk" && (
            <div>
              <p className="text-sm leading-relaxed text-[#5f576c]">
                This is the shared campus base for {s.short}: {base?.entities.length ?? "…"} events every Gemi can read. Each field was checked against its source before it got in.
              </p>
              {base?.error && <p className="mt-3 rounded-xl bg-[#fff4e5] px-3 py-2 text-sm text-[#8a5a00]">{base.error}</p>}
              <ul className="mt-4 space-y-3">
                {(base?.entities ?? []).map((e) => {
                  const ev = evidenceOf[e.id] ?? [], pass = ev.filter((x) => x.passed).length, isOpen = open === e.id;
                  return (
                    <li key={e.id} className="rounded-2xl border border-[#eee8f0] px-4 py-3">
                      <button onClick={() => setOpen(isOpen ? null : e.id)} className="block w-full text-left">
                        <div className="font-medium leading-snug">{e.name}</div>
                        <div className="mt-1 text-xs text-[#5f576c]">{when(e.fields)}{e.fields.venue_name ? ` · ${e.fields.venue_name}` : e.fields.building_name ? ` · ${e.fields.building_name}` : ""}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(e.fields.needs ?? []).map((n: string) => <span key={n} className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: s.soft, color: s.accent }}>{NEED[n] ?? n}</span>)}
                          <span className="rounded-full bg-[#eef7ee] px-2 py-0.5 text-[11px] text-[#2f7a3d]">{pass} of {ev.length} fields checked</span>
                        </div>
                      </button>
                      {isOpen && (
                        <div className="mt-3 border-t border-[#f1ecf3] pt-3 text-sm">
                          <p className="leading-relaxed text-[#3d3648]">{e.fields.summary}</p>
                          <table className="mt-3 w-full text-xs">
                            <tbody>
                              {ev.map((x) => (
                                <tr key={x.field} className="border-t border-[#f6f2f8]">
                                  <td className="py-1 pr-2 text-[#8a8296]">{x.field.replace(/_/g, " ")}</td>
                                  <td className="py-1 pr-2">{x.passed ? String(e.fields[x.field] ?? (x.field === "title" ? e.name : x.field === "start" ? when(e.fields) : "")).replace(/_/g, " ") : <span className="text-[#b0a8ba]">withheld</span>}</td>
                                  <td className="py-1 text-right tabular-nums" style={{ color: x.passed ? "#2f7a3d" : "#b26a00" }}>{Math.round((x.check_confidence ?? 0) * 100)}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <a href={e.fields.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs underline" style={{ color: s.accent }}>Open the source page</a>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {tab === "tools" && (
            <div>
              <p className="text-sm leading-relaxed text-[#5f576c]">Everything your Gemi can do is on this list. Each action is charged before it runs, and the rules are enforced in code.</p>
              {(["think", "act", "make"] as const).map((mode) => (
                <div key={mode} className="mt-5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#8a8296]">{mode === "think" ? "Think: what is this star best spent on?" : mode === "act" ? "Act" : "Make: build something new for itself"}</div>
                  <ul className="mt-2 space-y-2">
                    {TOOLS.filter((t) => t.mode === mode).map((t) => {
                      const v = mayCall(t.name, state);
                      return (
                        <li key={t.name} className="rounded-xl border border-[#eee8f0] px-3 py-2 text-sm" style={{ opacity: v.ok ? 1 : 0.6 }}>
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="font-medium">{t.does}</span>
                            <span className="shrink-0 text-xs tabular-nums" style={{ color: s.accent }}>{t.stars ? `${t.stars}★` : "free"}</span>
                          </div>
                          <div className="mt-1 text-[11px] text-[#8a8296]">
                            {t.purse === "for_you" ? "for you" : "for itself"}{t.model ? ` · ${t.model}` : ""} · writes {t.writes.join(", ") || "nothing"}
                            {!v.ok && <span className="ml-1 text-[#b26a00]">· {v.reason}</span>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {tab === "diary" && <p className="text-sm leading-relaxed text-[#5f576c]">Nothing yet. After your first keep or skip, your Gemi writes here what it learned about how you choose. You can undo any entry.</p>}
          {tab === "outbox" && <p className="text-sm leading-relaxed text-[#5f576c]">Nothing has left this room. Every message your Gemi sends to another AI is listed here, including the ones that were blocked.</p>}
        </div>
      </aside>
    </main>
  );
}

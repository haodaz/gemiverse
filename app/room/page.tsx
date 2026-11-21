"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SCHOOLS, loadSchool, type SchoolId } from "@/lib/schools";
import { PRESETS } from "@/lib/demo";
import { NEEDS } from "@/lib/needs";
import { TOOLS } from "@/lib/kernel/tools";
import { mayCall } from "@/lib/kernel/governance";
import type { GemiState } from "@/lib/kernel/types";
import { t, loadLang, saveLang, type Lang } from "@/lib/i18n";
import { LangSwitch } from "@/components/LangSwitch";
import { Composer, type Sent } from "@/components/Composer";

type Entity = { id: string; name: string; fields: Record<string, any>; tier: number };
type Evidence = { entity_id: string; field: string; check_confidence: number | null; passed: boolean | null };
type Panel = "talk" | "desk" | "diary" | "tools" | "outbox" | null;
type Item = { id: number; who: "you" | "gemi"; text?: string; image?: string; heard?: any; saw?: any; cost?: string; error?: boolean };

const BUILDINGS = [
  { id: "library", art: "/art/bld-library.svg", x: 18.75, y: 27.8 }, { id: "clubs", art: "/art/bld-clubs.svg", x: 81.25, y: 27.8 },
  { id: "commons", art: "/art/bld-commons.svg", x: 18.75, y: 72.2 }, { id: "career", art: "/art/bld-career.svg", x: 81.25, y: 72.2 },
] as const;

export default function Room() {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null), feedEnd = useRef<HTMLDivElement>(null), nextId = useRef(1);
  const [school, setSchool] = useState<SchoolId | null>(null);
  const [lang, setLang] = useState<Lang>("en");
  const [panel, setPanel] = useState<Panel>(null);
  const [campus, setCampus] = useState(false);
  const [tap, setTap] = useState<{ x: number; y: number } | null>(null);
  const [doing, setDoing] = useState("settling in");
  const [busy, setBusy] = useState(false);
  const [feed, setFeed] = useState<Item[]>([]);
  const [base, setBase] = useState<{ entities: Entity[]; evidence: Evidence[]; error?: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [state, setState] = useState<GemiState>({ stage: 1, purses: { for_you: 6, for_itself: 4 }, usedToday: {}, confirmed: [], paused: false });

  useEffect(() => { const s = loadSchool(); if (!s) router.replace("/"); else setSchool(s); setLang(loadLang()); }, [router]);
  useEffect(() => { if (school) fetch(`/api/base?school=${school}`).then((r) => r.json()).then(setBase).catch(() => setBase({ entities: [], evidence: [], error: "Could not reach the base." })); }, [school]);
  const send = (type: string, value?: unknown) => frame.current?.contentWindow?.postMessage({ source: "gemiverse", type, value }, "*");
  useEffect(() => {
    const on = (ev: MessageEvent) => {
      const m = ev.data; if (m?.source !== "gemiverse-room") return;
      if (m.type === "doing") setDoing(m.value);
      if (m.type === "tapped") setTap(m.value);
      if (m.type === "released") setTap(null);
      if (m.type === "ready" && school) send("look", PRESETS[school].look);
    };
    addEventListener("message", on); return () => removeEventListener("message", on);
  }, [school]);
  useEffect(() => { feedEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [feed, panel]);

  const s = school ? SCHOOLS[school] : null, preset = school ? PRESETS[school] : null;
  const evidenceOf = useMemo(() => { const m: Record<string, Evidence[]> = {}; for (const e of base?.evidence ?? []) (m[e.entity_id] ??= []).push(e); return m; }, [base]);
  if (!s || !preset) return null;
  const tt = (k: string) => t(k, lang);
  const push = (i: Omit<Item, "id">) => setFeed((f) => [...f, { ...i, id: nextId.current++ }]);
  const when = (f: Record<string, any>) => { const v = f.occurrences?.[0]?.start; return v ? new Date(v).toLocaleString(lang === "zh" ? "zh-CN" : lang === "es" ? "es" : "en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : tt("date_unconfirmed"); };
  const releaseGemi = () => { setTap(null); send("release"); };
  const openPanel = (p: Panel) => { setPanel(p); setCampus(false); releaseGemi(); };

  async function onSend(m: Sent) {
    setPanel("talk"); setBusy(true);
    try {
      if (m.kind === "file") {
        const verdict = mayCall("see_poster", state);
        push({ who: "you", text: m.name, image: m.preview });
        if (!verdict.ok) { push({ who: "gemi", text: verdict.reason, error: true }); return; }
        const r = await fetch("/api/see", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: m.data, mime: m.mime, lang }) }).then((x) => x.json());
        if (r.error) { push({ who: "gemi", text: r.error, error: true }); return; }
        setState((st) => ({ ...st, purses: { ...st.purses, for_you: st.purses.for_you - verdict.charge.stars }, usedToday: { ...st.usedToday, see_poster: (st.usedToday.see_poster ?? 0) + 1 } }));
        push({ who: "gemi", text: r.reply, saw: r, cost: `1★ ${tt("for_you")} · ${r.tokens} tokens · ${r.models.join(" + ")}` });
      } else {
        if (m.kind === "text") push({ who: "you", text: m.text });
        const r = await fetch("/api/hear", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(m.kind === "voice" ? { audio: m.audio, mime: "audio/wav", lang } : { text: m.text, lang }) }).then((x) => x.json());
        if (r.error) { push({ who: "gemi", text: r.error, error: true }); return; }
        if (m.kind === "voice") push({ who: "you", text: r.transcript || "…" });
        push({ who: "gemi", text: r.reply, heard: r, cost: `${r.tokens} tokens · ${r.model}` });
      }
    } catch { push({ who: "gemi", text: "Something went wrong reaching the model.", error: true }); }
    finally { setBusy(false); }
  }

  const hud = "rounded-full bg-white/95 shadow-md backdrop-blur";
  const ACTIONS: [string, string, () => void][] = [
    ["💬", "btn_talk", () => openPanel(panel === "talk" ? null : "talk")], ["📚", "btn_desk", () => openPanel(panel === "desk" ? null : "desk")],
    ["📔", "btn_diary", () => openPanel(panel === "diary" ? null : "diary")], ["🗺️", "btn_campus", () => { setCampus(true); setPanel(null); releaseGemi(); }],
    ["🪑", "btn_arrange", () => { setPanel(null); send("arrange"); }], ["✨", "btn_more", () => openPanel(panel === "tools" ? null : "tools")], ["📮", "btn_outbox", () => openPanel(panel === "outbox" ? null : "outbox")],
  ];

  return (
    <main className="relative h-screen overflow-hidden bg-[#f6f2ee] text-[#2b2536]">
      <iframe ref={frame} src={`/gen3d/viewer.html?embed=1&school=${s.id}`} title="Your Gemi's room" className="absolute inset-0 h-full w-full border-0" />

      {/* top left: where we are */}
      <div className="absolute left-5 top-4 flex items-center gap-3">
        <a href="/" className="text-lg font-semibold tracking-tight">Gemiverse</a>
        <span className="rounded-full px-3 py-1 text-xs font-medium text-white" style={{ background: s.accent }}>{s.short}</span>
        <LangSwitch lang={lang} onChange={(l) => { setLang(l); saveLang(l); }} />
      </div>

      {/* top right: the Gemi's own status, always visible, small */}
      <button onClick={() => openPanel(panel === "tools" ? null : "tools")} className={`${hud} absolute right-5 top-4 flex items-center gap-4 px-4 py-2 text-left`}>
        <div><div className="text-sm font-semibold leading-tight">{preset.gemiName}</div><div className="text-[11px] text-[#8a8296]">{tt("stage")}</div></div>
        <div className="text-sm tabular-nums" style={{ color: s.accent }}>★ {state.purses.for_you}<span className="ml-1 text-[11px] text-[#8a8296]">{tt("for_you")}</span></div>
        <div className="text-sm tabular-nums" style={{ color: s.accent }}>★ {state.purses.for_itself}<span className="ml-1 text-[11px] text-[#8a8296]">{tt("for_itself")}</span></div>
      </button>

      {/* what it is doing */}
      {!tap && !campus && <div className={`${hud} absolute left-5 bottom-5 px-4 py-2 text-sm`}><span className="text-[#8a8296]">{tt("right_now")}: </span>{preset.gemiName} {tt("gemi_is")} {busy ? tt("thinking") : doing}</div>}

      {/* the menu over its head when you click it */}
      {tap && (
        <div className="absolute z-20 -translate-x-1/2 -translate-y-full" style={{ left: tap.x, top: Math.max(tap.y, 150) }}>
          <div className="flex flex-col gap-1.5 rounded-2xl bg-white p-2 shadow-xl">
            {([["tap_talk", () => openPanel("talk")], ["tap_doing", () => { openPanel("talk"); push({ who: "gemi", text: `${doing}.` }); }], ["tap_out", () => { setCampus(true); setPanel(null); releaseGemi(); }], ["tap_look", () => { send("look", null); releaseGemi(); }]] as [string, () => void][]).map(([k, fn]) => (
              <button key={k} onClick={fn} className="rounded-xl px-4 py-2 text-left text-sm hover:bg-[#f4eefa]">{tt(k)}</button>
            ))}
          </div>
          <div className="mx-auto h-3 w-3 -translate-y-1.5 rotate-45 bg-white shadow" />
        </div>
      )}

      {/* the call bar */}
      <div className={`${hud} absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-1 px-2 py-2`}>
        {ACTIONS.map(([icon, key, fn]) => (
          <button key={key} onClick={fn} className="flex w-[74px] flex-col items-center rounded-2xl px-2 py-1.5 text-[11px] hover:bg-[#f4eefa]" style={panel && key.endsWith(panel === "tools" ? "more" : panel) ? { background: s.soft, color: s.accent } : {}}>
            <span className="text-xl leading-none">{icon}</span><span className="mt-1">{tt(key)}</span>
          </button>
        ))}
      </div>

      {/* a panel, only when called */}
      {panel && (
        <aside className="absolute bottom-24 right-5 top-20 z-10 flex w-[420px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
          <header className="flex items-center justify-between border-b border-[#eee8f0] px-5 py-3">
            <h2 className="text-base font-semibold">{tt(panel === "talk" ? "tab_talk" : panel === "desk" ? "tab_desk" : panel === "diary" ? "tab_diary" : panel === "tools" ? "tab_tools" : "tab_outbox")}</h2>
            <button onClick={() => setPanel(null)} aria-label={tt("close")} className="grid h-8 w-8 place-items-center rounded-full text-[#8a8296] hover:bg-[#f4eefa]">✕</button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {panel === "talk" && (
              <div className="space-y-3">
                {feed.length === 0 && <p className="text-sm leading-relaxed text-[#5f576c]">{tt("empty_today")}</p>}
                {feed.map((i) => (
                  <div key={i.id} className={i.who === "you" ? "flex justify-end" : ""}>
                    <div className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${i.who === "you" ? "text-white" : i.error ? "bg-[#fff4e5] text-[#8a5a00]" : "bg-[#f6f2f8]"}`} style={i.who === "you" ? { background: s.accent } : {}}>
                      {i.image && <img src={i.image} alt="" className="mb-2 max-h-40 rounded-lg" />}
                      {i.text}
                      {i.heard?.needs?.length > 0 && (
                        <div className="mt-2 border-t border-[#e8e0ee] pt-2 text-xs">
                          <div className="mb-1 text-[#8a8296]">{tt("heard")}</div>
                          {i.heard.needs.map((n: any) => <div key={n.id} className="mb-1"><span className="rounded-full px-2 py-0.5" style={{ background: s.soft, color: s.accent }}>{NEEDS[n.id]?.label ?? n.id}</span> <span className="text-[#5f576c]">“{n.quote}”</span></div>)}
                          {(i.heard.wants ?? []).length > 0 && <div className="text-[#5f576c]">{i.heard.wants.join(" · ")}</div>}
                        </div>
                      )}
                      {i.saw && (
                        <div className="mt-2 border-t border-[#e8e0ee] pt-2 text-xs">
                          <div className="mb-1 text-[#8a8296]">{tt("saw")}</div>
                          {i.saw.fields.map((f: any) => <div key={f.field} className="flex justify-between gap-3 py-0.5"><span className="text-[#8a8296]">{f.field.replace(/_/g, " ")}</span><span className="text-right">{f.passed ? String(f.value) : <i className="text-[#b0a8ba]">{tt("withheld")}</i>} <b className="tabular-nums" style={{ color: f.passed ? "#2f7a3d" : "#b26a00" }}>{Math.round(f.confidence * 100)}%</b></span></div>)}
                          {!i.saw.fields.some((f: any) => f.field === "start") && <div className="py-0.5 text-[#b26a00]">start: {tt("withheld")} (no year printed)</div>}
                        </div>
                      )}
                      {i.cost && <div className="mt-1.5 text-[10px] text-[#a79fb1]">{tt("cost")}: {i.cost}</div>}
                    </div>
                  </div>
                ))}
                <div ref={feedEnd} />
              </div>
            )}
            {panel === "desk" && (
              <div>
                <p className="text-sm leading-relaxed text-[#5f576c]">{tt("desk_intro")}</p>
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
                            {(e.fields.needs ?? []).map((n: string) => <span key={n} className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: s.soft, color: s.accent }}>{NEEDS[n]?.label ?? n}</span>)}
                            <span className="rounded-full bg-[#eef7ee] px-2 py-0.5 text-[11px] text-[#2f7a3d]">{pass} {tt("of")} {ev.length} {tt("fields_checked")}</span>
                          </div>
                        </button>
                        {isOpen && (
                          <div className="mt-3 border-t border-[#f1ecf3] pt-3 text-sm">
                            <p className="leading-relaxed text-[#3d3648]">{e.fields.summary}</p>
                            <table className="mt-3 w-full text-xs"><tbody>
                              {ev.map((x) => (
                                <tr key={x.field} className="border-t border-[#f6f2f8]">
                                  <td className="py-1 pr-2 text-[#8a8296]">{x.field.replace(/_/g, " ")}</td>
                                  <td className="py-1 pr-2">{x.passed ? String(e.fields[x.field] ?? (x.field === "title" ? e.name : x.field === "start" ? when(e.fields) : "")).replace(/_/g, " ") : <span className="text-[#b0a8ba]">{tt("withheld")}</span>}</td>
                                  <td className="py-1 text-right tabular-nums" style={{ color: x.passed ? "#2f7a3d" : "#b26a00" }}>{Math.round((x.check_confidence ?? 0) * 100)}%</td>
                                </tr>
                              ))}
                            </tbody></table>
                            <a href={e.fields.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs underline" style={{ color: s.accent }}>{tt("open_source")}</a>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {panel === "tools" && (
              <div>
                <div className="mb-4 grid grid-cols-2 gap-3">
                  {(["for_you", "for_itself"] as const).map((p) => (
                    <div key={p} className="rounded-2xl px-4 py-3" style={{ background: s.soft }}>
                      <div className="text-xs text-[#5f576c]">{tt(p === "for_you" ? "stars_you" : "stars_self")}</div>
                      <div className="mt-1 text-xl font-semibold" style={{ color: s.accent }}>{"★".repeat(Math.max(0, Math.round(state.purses[p])))}<span className="ml-2 text-sm font-normal text-[#5f576c]">{state.purses[p]}</span></div>
                      <div className="mt-1 text-[11px] leading-snug text-[#8a8296]">{tt(p === "for_you" ? "stars_you_note" : "stars_self_note")}</div>
                    </div>
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-[#5f576c]">{tt("tools_intro")}</p>
                {(["think", "act", "make"] as const).map((mode) => (
                  <div key={mode} className="mt-5">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[#8a8296]">{mode}</div>
                    <ul className="mt-2 space-y-2">
                      {TOOLS.filter((x) => x.mode === mode).map((x) => { const v = mayCall(x.name, state); return (
                        <li key={x.name} className="rounded-xl border border-[#eee8f0] px-3 py-2 text-sm" style={{ opacity: v.ok ? 1 : 0.6 }}>
                          <div className="flex items-baseline justify-between gap-3"><span className="font-medium">{x.does}</span><span className="shrink-0 text-xs tabular-nums" style={{ color: s.accent }}>{x.stars ? `${x.stars}★` : "free"}</span></div>
                          <div className="mt-1 text-[11px] text-[#8a8296]">{tt(x.purse)}{x.model ? ` · ${x.model}` : ""} · writes {x.writes.join(", ") || "nothing"}{!v.ok && <span className="ml-1 text-[#b26a00]">· {v.reason}</span>}</div>
                        </li>); })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            {panel === "diary" && <p className="text-sm leading-relaxed text-[#5f576c]">{tt("diary_empty")}</p>}
            {panel === "outbox" && <p className="text-sm leading-relaxed text-[#5f576c]">{tt("outbox_empty")}</p>}
          </div>
          {panel === "talk" && <Composer lang={lang} accent={s.accent} busy={busy} onSend={onSend} />}
        </aside>
      )}

      {/* the campus, full width */}
      {campus && (
        <div className="absolute inset-0 z-30 bg-[#f6f2ee]">
          <img src={s.map} alt={`An illustrated map of the ${s.short} campus`} className="absolute inset-0 h-full w-full object-cover" />
          <div className={`${hud} absolute left-5 top-4 px-5 py-3`}>
            <div className="text-base font-semibold">{tt("campus_title")}</div>
            <div className="mt-0.5 max-w-md text-xs text-[#5f576c]">{tt("campus_note")}</div>
          </div>
          <button onClick={() => setCampus(false)} className={`${hud} absolute right-5 top-4 px-4 py-2 text-sm`}>✕ {tt("close")}</button>
          {BUILDINGS.map((b) => (
            <button key={b.id} className="group absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${b.x}%`, top: `${b.y}%` }}>
              <img src={b.art} alt="" className="mx-auto h-44 w-44 drop-shadow-lg transition group-hover:-translate-y-1" />
              <div className={`${hud} -mt-3 inline-block px-4 py-1.5`}>
                <div className="text-sm font-semibold">{tt(`b_${b.id}`)}</div>
                <div className="text-[11px] text-[#8a8296]">{tt(`b_${b.id}_n`)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}

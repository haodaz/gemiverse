"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SCHOOLS, loadSchool, type SchoolId } from "@/lib/schools";
import { PRESETS } from "@/lib/demo";
import { NEEDS } from "@/lib/needs";
import { TOOLS } from "@/lib/kernel/tools";
import { mayCall } from "@/lib/kernel/governance";
import type { GemiState } from "@/lib/kernel/types";
import { AXES, blank, loadLog, replay, saveLog, type AxisId, type Beliefs, type LogEvent } from "@/lib/mind";
import { t, loadLang, saveLang, type Lang } from "@/lib/i18n";
import { LangSwitch } from "@/components/LangSwitch";
import { Composer, type Sent } from "@/components/Composer";
import { Chunky, GamePanel, Icon, IconButton, INK, RadialMenu } from "@/components/game";

type Entity = { id: string; name: string; fields: Record<string, any>; tier: number };
type Evidence = { entity_id: string; field: string; check_confidence: number | null; passed: boolean | null };
type Panel = "talk" | "desk" | "diary" | "tools" | "outbox" | null;
type Item = { id: number; who: "you" | "gemi"; text?: string; image?: string; heard?: any; saw?: any; cost?: string; error?: boolean };
type Find = { id: string; title: string; fields: Record<string, any>; why: string; evidence: { axis: AxisId; x: number; why: string }[]; checks: { field: string; confidence: number; passed: boolean }[] };
type Trip = { place: string; by: "gemi" | "student"; reason: string; finds: Find[]; seal: string; sealed: string; revealed?: { predicted: Record<string, number>; nonce: string; verified: boolean }; contrast_axis?: string; tokens?: number; model?: string; choices: Record<string, "keep" | "skip"> };

const BUILDINGS = [
  { id: "library", art: "/art/bld2-library.svg", x: 21.25, y: 36.7 }, { id: "clubs", art: "/art/bld2-clubs.svg", x: 78.75, y: 36.7 },
  { id: "commons", art: "/art/bld2-commons.svg", x: 21.25, y: 72.2 }, { id: "career", art: "/art/bld2-career.svg", x: 78.75, y: 72.2 },
] as const;
const uid = () => Math.random().toString(36).slice(2, 10);

export default function Room() {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null), feedEnd = useRef<HTMLDivElement>(null), nextId = useRef(1);
  const [school, setSchool] = useState<SchoolId | null>(null);
  const [lang, setLang] = useState<Lang>("en");
  const [panel, setPanel] = useState<Panel>(null);
  const [campus, setCampus] = useState(false);
  const [outAt, setOutAt] = useState<string | null>(null);
  const [tap, setTap] = useState<{ x: number; y: number } | null>(null);
  const [doing, setDoing] = useState("settling in");
  const [busy, setBusy] = useState(false);
  const [feed, setFeed] = useState<Item[]>([]);
  const [base, setBase] = useState<{ entities: Entity[]; evidence: Evidence[]; error?: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [showBase, setShowBase] = useState(false);
  const [log, setLog] = useState<LogEvent[]>([]);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [wants, setWants] = useState<string[]>([]);
  const [state, setState] = useState<GemiState>({ stage: 1, purses: { for_you: 6, for_itself: 4 }, usedToday: {}, confirmed: [], paused: false });

  useEffect(() => { const s = loadSchool(); if (!s) router.replace("/"); else { setSchool(s); setLog(loadLog(s)); } setLang(loadLang()); }, [router]);
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
  useEffect(() => { const on = (e: KeyboardEvent) => { if (e.key === "Escape") { setCampus(false); setPanel(null); } }; addEventListener("keydown", on); return () => removeEventListener("keydown", on); }, []);

  const mind = useMemo(() => replay(log), [log]);
  // Its own initiative: left alone with nothing waiting on the desk and enough Gem Stars, it decides to go out by itself.
  // It picks the place that serves what the student cares about most; this trip is paid from its own allowance.
  const auto = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!school || busy || campus || panel || tap || outAt) return;
    if (trip && trip.finds.some((f) => !trip.choices[f.id])) return;
    const id = setTimeout(() => auto.current?.(), 45000);
    return () => clearTimeout(id);
  }, [school, busy, campus, panel, tap, outAt, trip]);
  const s = school ? SCHOOLS[school] : null, preset = school ? PRESETS[school] : null;
  const evidenceOf = useMemo(() => { const m: Record<string, Evidence[]> = {}; for (const e of base?.evidence ?? []) (m[e.entity_id] ??= []).push(e); return m; }, [base]);
  if (!s || !preset || !school) return null;
  const tt = (k: string) => t(k, lang);
  const push = (i: Omit<Item, "id">) => setFeed((f) => [...f, { ...i, id: nextId.current++ }]);
  const append = (e: LogEvent) => setLog((l) => { const n = [...l, e]; saveLog(school, n); return n; });
  const when = (f: Record<string, any>) => { const v = f.occurrences?.[0]?.start; return v ? new Date(v).toLocaleString(lang === "zh" ? "zh-CN" : lang === "es" ? "es" : "en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : tt("date_unconfirmed"); };
  const releaseGemi = () => { setTap(null); send("release"); };
  const openPanel = (p: Panel) => { setPanel(p); setCampus(false); releaseGemi(); };
  const charge = (tool: string, stars: number, purse: "for_you" | "for_itself") => setState((st) => ({ ...st, purses: { ...st.purses, [purse]: st.purses[purse] - stars }, usedToday: { ...st.usedToday, [tool]: (st.usedToday[tool] ?? 0) + 1 } }));

  async function onSend(m: Sent) {
    setPanel("talk"); setBusy(true);
    try {
      if (m.kind === "file") {
        const verdict = mayCall("see_poster", state, "", "student");
        push({ who: "you", text: m.name, image: m.preview });
        if (!verdict.ok) { push({ who: "gemi", text: verdict.reason, error: true }); return; }
        const r = await fetch("/api/see", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: m.data, mime: m.mime, lang }) }).then((x) => x.json());
        if (r.error) { push({ who: "gemi", text: r.error, error: true }); return; }
        charge("see_poster", verdict.charge.stars, "for_you");
        push({ who: "gemi", text: r.reply, saw: r, cost: `${r.tokens} tokens · ${r.models.join(" + ")}` });
      } else {
        if (m.kind === "text") push({ who: "you", text: m.text });
        const r = await fetch("/api/hear", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(m.kind === "voice" ? { audio: m.audio, mime: "audio/wav", lang } : { text: m.text, lang }) }).then((x) => x.json());
        if (r.error) { push({ who: "gemi", text: r.error, error: true }); return; }
        if (m.kind === "voice") push({ who: "you", text: r.transcript || "…" });
        if (r.needs?.length) append({ id: uid(), at: new Date().toISOString(), type: "said", needs: r.needs.map((n: any) => ({ id: n.id, quote: n.quote })), text: r.transcript ?? (m.kind === "text" ? m.text : "") });
        if (r.wants?.length) setWants((w) => [...w, ...r.wants].slice(-12));
        push({ who: "gemi", text: r.reply, heard: r, cost: `${r.tokens} tokens · ${r.model}` });
      }
    } catch { push({ who: "gemi", text: "Something went wrong reaching the model.", error: true }); }
    finally { setBusy(false); }
  }

  async function goOut(place: string, by: "gemi" | "student" = "student") {
    const verdict = mayCall("go_out", state, "", by);
    if (!verdict.ok) { setCampus(false); setPanel("talk"); push({ who: "gemi", text: verdict.reason, error: true }); return; }
    charge("go_out", verdict.charge.stars, "for_you");
    setOutAt(place); send("away", true); setBusy(true); if (by === "gemi") setDoing(`out at the ${place}, on its own`);
    try {
      const seen = log.filter((e) => e.type === "choice").map((e: any) => e.find);
      const r = await fetch("/api/go", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ school, place, care: mind.care, beliefs: mind.beliefs, wants, seen, lang }) }).then((x) => x.json());
      if (r.error || !r.finds?.length) { push({ who: "gemi", text: r.error ?? r.reason, error: !!r.error }); setPanel("talk"); return; }
      append({ id: uid(), at: new Date().toISOString(), type: "trip", place, stars: verdict.charge.stars, found: r.finds.map((f: Find) => f.id), predicted: {}, seal: r.seal, reason: r.reason });
      setTrip({ ...r, by, choices: {} }); if (by === "student") setPanel("desk");
    } catch { push({ who: "gemi", text: "It could not finish the trip.", error: true }); setPanel("talk"); }
    finally { setBusy(false); setOutAt(null); setCampus(false); send("away", false); }
  }

  auto.current = () => {
    if (!mayCall("go_out", state, "", "gemi").ok) return;
    const top = Object.entries(mind.care).sort((a, b) => b[1] - a[1])[0]?.[0];
    const place = top && ["find_my_people", "make_and_express"].includes(top) ? "clubs" : top && ["get_experience", "decide_a_direction", "fund_my_path"].includes(top) ? "career" : top === "rest_and_recover" ? "commons" : "library";
    goOut(place, "gemi");
  };
  function choose(f: Find, action: "keep" | "skip") {
    if (!trip || trip.choices[f.id]) return;
    append({ id: uid(), at: new Date().toISOString(), type: "choice", find: f.id, title: f.title, action, shownWith: trip.finds.filter((x) => x.id !== f.id).map((x) => x.title), evidence: f.evidence });
    const next = { ...trip, choices: { ...trip.choices, [f.id]: action } };
    setTrip(next);
    if (next.finds.every((x) => next.choices[x.id])) reveal(next);
  }
  async function reveal(tr: Trip) {
    try {
      const r = await fetch("/api/reveal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sealed: tr.sealed }) }).then((x) => x.json());
      if (r.error) return;
      // check the seal in the browser: hash what was revealed and compare with what was shown before choosing
      const bytes = new TextEncoder().encode(JSON.stringify({ predicted: r.predicted, nonce: r.nonce }));
      const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
      setTrip((cur) => (cur && cur.seal === tr.seal ? { ...cur, revealed: { predicted: r.predicted, nonce: r.nonce, verified: hash === tr.seal } } : cur));
    } catch {}
  }
  const toggleUndo = (id: string) => setLog((l) => { const n = l.map((e) => (e.id === id ? { ...e, undone: !e.undone } : e)); saveLog(school, n); return n; });

  // the diary: for every choice, what moved, computed by replaying the log up to that point
  const diary = log.map((e, i) => {
    if (e.type !== "choice") return { e, moves: [] as { axis: AxisId; before: Beliefs[AxisId]; after: Beliefs[AxisId] }[] };
    const before = replay(log.slice(0, i)).beliefs, after = replay([...log.slice(0, i), { ...e, undone: false }]).beliefs;
    return { e, moves: e.evidence.map((ev) => ({ axis: ev.axis, before: before[ev.axis], after: after[ev.axis] })) };
  }).filter((d) => d.e.type !== "trip").reverse();
  const allChosen = !!trip?.revealed;
  const pk = (id: string) => trip?.revealed?.predicted[id] ?? 0.5;
  const hits = trip ? trip.finds.filter((f) => trip.choices[f.id] && (pk(f.id) >= 0.5) === (trip.choices[f.id] === "keep")).length : 0;
  const pending = trip ? trip.finds.filter((f) => !trip.choices[f.id]).length : 0;

  const Axis = ({ id, b, ghost }: { id: AxisId; b: Beliefs[AxisId]; ghost?: Beliefs[AxisId] }) => {
    const a = AXES.find((x) => x.id === id)!, pos = (m: number) => `${50 + m * 46}%`;
    return (
      <div className="py-1.5">
        <div className="flex justify-between text-[11px] text-[#5f576c]"><span>{a.left}</span><span>{a.right}</span></div>
        <div className="relative mt-1 h-4 rounded-full border-2" style={{ borderColor: INK, background: "#f3ecdf" }}>
          <div className="absolute top-0 h-full rounded-full opacity-50 transition-all duration-700" style={{ background: s.accent, left: `calc(${pos(b.m)} - ${b.u * 46}%)`, width: `${b.u * 92}%`, maxWidth: "100%" }} />
          {ghost && <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed" style={{ left: pos(ghost.m), borderColor: INK }} />}
          <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] transition-all duration-700" style={{ left: pos(b.m), borderColor: INK, background: "#fffaf0" }} />
        </div>
      </div>
    );
  };

  const titles: Record<string, [string, string]> = { talk: ["tab_talk", "talk"], desk: ["tab_desk", "desk"], diary: ["tab_diary", "diary"], tools: ["tab_tools", "abilities"], outbox: ["tab_outbox", "outbox"] };

  return (
    <main className="relative h-screen overflow-hidden bg-[#f6f2ee] text-[#2b2536]">
      <iframe ref={frame} src={`/gen3d/viewer.html?embed=1&school=${s.id}`} title="Your Gemi's room" className="absolute inset-0 h-full w-full border-0" />

      <div className="absolute left-5 top-4 flex items-center gap-3">
        <a href="/" className="text-lg font-bold tracking-tight">Gemiverse</a>
        <span className="rounded-full border-[3px] px-3 py-0.5 text-xs font-bold text-white" style={{ background: s.accent, borderColor: INK }}>{s.short}</span>
        <LangSwitch lang={lang} onChange={(l) => { setLang(l); saveLang(l); }} />
      </div>

      <button onClick={() => openPanel(panel === "tools" ? null : "tools")} className="absolute right-5 top-4 flex items-center gap-4 rounded-full border-[3px] bg-[#fffaf0] px-4 py-1.5 text-left" style={{ borderColor: INK, boxShadow: `0 4px 0 ${INK}` }}>
        <div><div className="text-sm font-bold leading-tight">{preset.gemiName}</div><div className="text-[11px] text-[#8a8296]">{tt("stage")}</div></div>
        {(["for_you", "for_itself"] as const).map((p) => <div key={p} className="flex items-center gap-1 text-sm font-bold tabular-nums"><Icon name="star" size={20} />{state.purses[p]}<span className="text-[11px] font-normal text-[#8a8296]">{tt(p)}</span></div>)}
      </button>

      {!tap && !campus && <div className="absolute bottom-5 left-5 rounded-full border-[3px] bg-[#fffaf0] px-4 py-1.5 text-sm" style={{ borderColor: INK, boxShadow: `0 4px 0 ${INK}` }}><span className="text-[#8a8296]">{tt("right_now")}: </span>{preset.gemiName} {tt("gemi_is")} {busy ? tt("thinking") : doing}</div>}

      {tap && <RadialMenu x={tap.x} y={tap.y} items={[
        { icon: "talk", label: tt("tap_talk"), onClick: () => openPanel("talk") },
        { icon: "diary", label: tt("tab_diary"), onClick: () => openPanel("diary") },
        { icon: "campus", label: tt("tap_out"), onClick: () => { setCampus(true); setPanel(null); releaseGemi(); } },
        { icon: "abilities", label: tt("tap_look"), onClick: () => { send("look", null); releaseGemi(); } },
      ]} />}

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-4">
        <IconButton icon="talk" label={tt("btn_talk")} active={panel === "talk"} accent={s.soft} onClick={() => openPanel(panel === "talk" ? null : "talk")} />
        <IconButton icon="desk" label={tt("btn_desk")} active={panel === "desk"} accent={s.soft} badge={pending || undefined} onClick={() => openPanel(panel === "desk" ? null : "desk")} />
        <IconButton icon="diary" label={tt("btn_diary")} active={panel === "diary"} accent={s.soft} onClick={() => openPanel(panel === "diary" ? null : "diary")} />
        <IconButton icon="campus" label={tt("btn_campus")} active={campus} accent={s.soft} onClick={() => { setCampus(true); setPanel(null); releaseGemi(); }} />
        <IconButton icon="arrange" label={tt("btn_arrange")} onClick={() => { setPanel(null); send("arrange"); }} />
        <IconButton icon="abilities" label={tt("btn_more")} active={panel === "tools"} accent={s.soft} onClick={() => openPanel(panel === "tools" ? null : "tools")} />
        <IconButton icon="outbox" label={tt("btn_outbox")} active={panel === "outbox"} accent={s.soft} onClick={() => openPanel(panel === "outbox" ? null : "outbox")} />
      </div>

      {panel && (
        <GamePanel title={tt(titles[panel][0])} icon={titles[panel][1]} accent={s.accent} onClose={() => setPanel(null)} closeLabel={tt("close")}
          footer={panel === "talk" ? <Composer lang={lang} accent={s.accent} busy={busy} onSend={onSend} /> : undefined}>
          {panel === "talk" && (
            <div className="space-y-3">
              {feed.length === 0 && <p className="text-sm leading-relaxed text-[#5f576c]">{tt("empty_today")}</p>}
              {feed.map((i) => (
                <div key={i.id} className={i.who === "you" ? "flex justify-end" : ""}>
                  <div className={`max-w-[92%] rounded-2xl border-2 px-3.5 py-2.5 text-sm leading-relaxed ${i.who === "you" ? "text-white" : i.error ? "bg-[#fff0d6]" : "bg-white"}`} style={{ borderColor: INK, ...(i.who === "you" ? { background: s.accent } : {}) }}>
                    {i.image && <img src={i.image} alt="" className="mb-2 max-h-40 rounded-lg" />}
                    {i.text}
                    {i.heard?.needs?.length > 0 && (
                      <div className="mt-2 border-t border-[#e8e0ee] pt-2 text-xs">
                        <div className="mb-1 text-[#8a8296]">{tt("heard")}{i.heard.languages?.length ? ` · ${i.heard.languages.join(" + ")}` : ""}</div>
                        {i.heard.needs.map((n: any) => <div key={n.id} className="mb-1"><span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: s.soft, color: s.accent }}>{NEEDS[n.id]?.label ?? n.id}</span> <span className="text-[#5f576c]">“{n.quote}”{n.gloss ? <i className="text-[#a79fb1]"> ({n.gloss})</i> : null}</span></div>)}
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
              {!trip && <p className="text-sm leading-relaxed text-[#5f576c]">{tt("no_finds")}</p>}
              {trip && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-[#8a8296]">{tt("brought_back")} · {tt(`b_${trip.place}`)} · {tt(trip.by === "gemi" ? "its_idea" : "your_idea")}</div>
                  <p className="mt-2 rounded-2xl border-2 bg-white px-3.5 py-2.5 text-sm leading-relaxed" style={{ borderColor: INK }}>{trip.reason}</p>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-[#8a8296]"><Icon name="lock" size={16} />{allChosen ? tt("reveal") : tt("sealed")} · <code>{trip.seal.slice(0, 12)}</code>{trip.revealed ? <b style={{ color: trip.revealed.verified ? "#2f7a3d" : "#b26a00" }}>{trip.revealed.verified ? "✓" : "✗"}</b> : null}</div>
                  <ul className="mt-3 space-y-3">
                    {trip.finds.map((f) => { const c = trip.choices[f.id], pass = f.checks.filter((x) => x.passed).length; return (
                      <li key={f.id} className="rounded-2xl border-[3px] bg-white px-4 py-3" style={{ borderColor: INK, boxShadow: `0 4px 0 ${INK}22`, opacity: c === "skip" ? 0.6 : 1 }}>
                        <div className="font-bold leading-snug">{f.title}</div>
                        <div className="mt-1 text-xs text-[#5f576c]">{when(f.fields)}{f.fields.venue_name ? ` · ${f.fields.venue_name}` : f.fields.building_name ? ` · ${f.fields.building_name}` : ""}</div>
                        <p className="mt-2 text-sm leading-relaxed">{f.why}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {(f.fields.needs ?? []).map((n: string) => <span key={n} className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: s.soft, color: s.accent }}>{NEEDS[n]?.label ?? n}</span>)}
                          <a href={f.fields.url} target="_blank" rel="noreferrer" className="rounded-full bg-[#e6f5e6] px-2 py-0.5 text-[11px] font-semibold text-[#2f7a3d] underline">{pass}/{f.checks.length} {tt("sources")}</a>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          {!c ? (<><Chunky color="#a8e0c0" onClick={() => choose(f, "keep")}><Icon name="keep" size={18} />{tt("keep")}</Chunky><Chunky color="#fffaf0" onClick={() => choose(f, "skip")}><Icon name="skip" size={18} />{tt("skip")}</Chunky></>)
                            : <span className="text-xs font-bold" style={{ color: c === "keep" ? "#2f7a3d" : "#8a8296" }}>{tt(c === "keep" ? "kept" : "skipped")}</span>}
                          {allChosen && <span className="ml-auto text-[11px] text-[#5f576c]">{Math.round(pk(f.id) * 100)}% {tt("guessed")} · <b style={{ color: (pk(f.id) >= 0.5) === (c === "keep") ? "#2f7a3d" : "#b26a00" }}>{tt((pk(f.id) >= 0.5) === (c === "keep") ? "right" : "wrong")}</b></span>}
                        </div>
                      </li>); })}
                  </ul>
                  {allChosen && <p className="mt-3 rounded-2xl border-2 px-3.5 py-2.5 text-sm font-semibold" style={{ borderColor: INK, background: s.soft }}>{tt("reveal")}: {hits} / {trip.finds.length} {tt("right")}. <button className="underline" onClick={() => setPanel("diary")}>{tt("learned")} →</button></p>}
                </div>
              )}
              <button onClick={() => setShowBase(!showBase)} className="mt-5 text-xs font-semibold underline" style={{ color: s.accent }}>{tt("whole_base")} ({base?.entities.length ?? 0})</button>
              {showBase && (
                <div>
                  <p className="mt-2 text-xs leading-relaxed text-[#5f576c]">{tt("desk_intro")}</p>
                  {base?.error && <p className="mt-3 rounded-xl bg-[#fff0d6] px-3 py-2 text-sm">{base.error}</p>}
                  <ul className="mt-3 space-y-2">
                    {(base?.entities ?? []).map((e) => { const ev = evidenceOf[e.id] ?? [], pass = ev.filter((x) => x.passed).length, isOpen = open === e.id; return (
                      <li key={e.id} className="rounded-xl border-2 bg-white px-3 py-2" style={{ borderColor: "#d9d0c0" }}>
                        <button onClick={() => setOpen(isOpen ? null : e.id)} className="block w-full text-left">
                          <div className="text-sm font-semibold leading-snug">{e.name}</div>
                          <div className="mt-0.5 text-[11px] text-[#5f576c]">{when(e.fields)} · {pass} {tt("of")} {ev.length} {tt("fields_checked")}</div>
                        </button>
                        {isOpen && (
                          <table className="mt-2 w-full text-xs"><tbody>
                            {ev.map((x) => (<tr key={x.field} className="border-t border-[#f1ece2]"><td className="py-1 pr-2 text-[#8a8296]">{x.field.replace(/_/g, " ")}</td><td className="py-1 pr-2">{x.passed ? String(e.fields[x.field] ?? (x.field === "title" ? e.name : x.field === "start" ? when(e.fields) : "")).replace(/_/g, " ") : <span className="text-[#b0a8ba]">{tt("withheld")}</span>}</td><td className="py-1 text-right tabular-nums" style={{ color: x.passed ? "#2f7a3d" : "#b26a00" }}>{Math.round((x.check_confidence ?? 0) * 100)}%</td></tr>))}
                          </tbody></table>
                        )}
                      </li>); })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {panel === "diary" && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#8a8296]">{tt("understanding")}</div>
              <p className="mt-1 text-xs leading-relaxed text-[#5f576c]">{tt("understanding_note")}</p>
              <div className="mt-2">{AXES.map((a) => <Axis key={a.id} id={a.id} b={mind.beliefs[a.id] ?? blank()[a.id]} />)}</div>
              <div className="mt-5 text-xs font-bold uppercase tracking-wider text-[#8a8296]">{tt("learned")}</div>
              {diary.length === 0 && <p className="mt-2 text-sm leading-relaxed text-[#5f576c]">{tt("diary_empty")}</p>}
              <ul className="mt-2 space-y-3">
                {diary.map(({ e, moves }) => (
                  <li key={e.id} className="rounded-2xl border-2 bg-white px-3.5 py-3 text-sm" style={{ borderColor: INK, opacity: e.undone ? 0.45 : 1 }}>
                    {e.type === "said" && (<><div className="text-[11px] font-bold uppercase text-[#8a8296]">{tt("you_said")}</div>{e.needs.map((n) => <div key={n.id} className="mt-1"><span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: s.soft, color: s.accent }}>{NEEDS[n.id]?.label ?? n.id}</span> <span className="text-[#5f576c]">“{n.quote}”</span></div>)}</>)}
                    {e.type === "choice" && (<>
                      <div><b>{tt(e.action === "keep" ? "kept" : "skipped")}</b> · {e.title}</div>
                      {e.evidence.map((ev, k) => (<div key={k} className="mt-2"><div className="text-[11px] text-[#5f576c]">{ev.why}</div>{moves[k] && <Axis id={ev.axis} b={moves[k].after} ghost={moves[k].before} />}</div>))}
                    </>)}
                    <div className="mt-2 text-right"><Chunky small color="#fffaf0" onClick={() => toggleUndo(e.id)}><Icon name="undo" size={14} />{tt(e.undone ? "redo" : "undo")}</Chunky></div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {panel === "tools" && (
            <div>
              <div className="mb-4 grid grid-cols-2 gap-3">
                {(["for_you", "for_itself"] as const).map((p) => (
                  <div key={p} className="rounded-2xl border-2 px-4 py-3" style={{ background: s.soft, borderColor: INK }}>
                    <div className="text-xs font-semibold text-[#5f576c]">{tt(p === "for_you" ? "stars_you" : "stars_self")}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-0.5">{Array.from({ length: Math.max(0, Math.round(state.purses[p])) }).map((_, i) => <Icon key={i} name="star" size={22} />)}<span className="ml-2 text-sm font-bold">{state.purses[p]}</span></div>
                    <div className="mt-1 text-[11px] leading-snug text-[#8a8296]">{tt(p === "for_you" ? "stars_you_note" : "stars_self_note")}</div>
                  </div>
                ))}
              </div>
              <p className="text-sm leading-relaxed text-[#5f576c]">{tt("tools_intro")}</p>
              {(["think", "act", "make"] as const).map((mode) => (
                <div key={mode} className="mt-5">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#8a8296]">{mode}</div>
                  <ul className="mt-2 space-y-2">
                    {TOOLS.filter((x) => x.mode === mode).map((x) => { const v = mayCall(x.name, state); return (
                      <li key={x.name} className="rounded-xl border-2 bg-white px-3 py-2 text-sm" style={{ borderColor: v.ok ? INK : "#d9d0c0", opacity: v.ok ? 1 : 0.65 }}>
                        <div className="flex items-center justify-between gap-3"><span className="font-semibold">{x.does}</span><span className="flex shrink-0 items-center gap-0.5 text-xs font-bold">{v.ok ? null : <Icon name="lock" size={16} />}{x.stars ? <>{x.stars}<Icon name="star" size={16} /></> : "free"}</span></div>
                        <div className="mt-1 text-[11px] text-[#8a8296]">{tt(x.purse)}{x.model ? ` · ${x.model}` : ""} · writes {x.writes.join(", ") || "nothing"}{!v.ok && <span className="ml-1 text-[#b26a00]">· {v.reason}</span>}</div>
                      </li>); })}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {panel === "outbox" && <p className="text-sm leading-relaxed text-[#5f576c]">{tt("outbox_empty")}</p>}
        </GamePanel>
      )}

      {campus && (
        <div className="absolute inset-0 z-30 bg-[#e9efe4]">
          <img src={s.map} alt={`An illustrated map of the ${s.short} campus`} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute left-5 top-4 rounded-3xl border-[3px] bg-[#fffaf0] px-5 py-2.5" style={{ borderColor: INK, boxShadow: `0 4px 0 ${INK}` }}>
            <div className="text-base font-bold">{outAt ? `${preset.gemiName} ${tt("at_place")} ${tt(`b_${outAt}`)}` : tt("campus_title")}</div>
            <div className="mt-0.5 max-w-md text-xs text-[#5f576c]">{outAt ? tt("out_note") : tt("campus_note")}</div>
          </div>
          {/* the way back is always on top of the buildings, whatever the window size */}
          {!outAt && <div className="absolute bottom-5 left-1/2 z-50 -translate-x-1/2"><Chunky color="#ffe08a" onClick={() => setCampus(false)}><Icon name="out" size={20} />{tt("back_room")}</Chunky></div>}
          {!outAt && <div className="absolute right-5 top-4 z-50"><Chunky color="#fffaf0" onClick={() => setCampus(false)}><Icon name="close" size={16} />{tt("close")}</Chunky></div>}
          {BUILDINGS.map((b) => { const here = outAt === b.id; return (
            <button key={b.id} disabled={!!outAt} onClick={() => goOut(b.id)} className="group absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${b.x}%`, top: `${b.y}%` }}>
              <div className="absolute left-1/2 top-[58%] h-16 w-40 -translate-x-1/2 rounded-[50%] opacity-60 blur-md" style={{ background: s.accent }} />
              <img src={b.art} alt="" className="relative mx-auto h-[min(18rem,30vh)] w-[min(18rem,30vh)] drop-shadow-xl transition duration-200 group-hover:brightness-110 group-hover:[filter:drop-shadow(0_0_18px_#ffe9a8)_drop-shadow(0_0_6px_#fff)]" />
              {here && <div className="absolute left-1/2 top-2 grid h-12 w-12 place-items-center rounded-full border-[3px] bg-[#fffaf0]" style={{ borderColor: INK, animation: "gemi-walk 0.6s ease-in-out infinite" }}><Icon name="out" size={28} /></div>}
              <div className="relative -mt-10 inline-flex items-center gap-2 rounded-full border-[3px] bg-[#fffaf0] py-1 pl-1 pr-4 transition-transform duration-200 group-hover:-translate-y-1.5 group-hover:scale-105" style={{ borderColor: INK, boxShadow: `0 4px 0 ${INK}` }}>
                <span className="grid h-9 w-9 place-items-center rounded-full border-2" style={{ borderColor: INK, background: s.soft }}><Icon name={b.id} size={22} /></span>
                <span className="text-left"><span className="block text-sm font-bold leading-tight">{tt(`b_${b.id}`)}</span><span className="block text-[10px] text-[#8a8296]">{tt(`b_${b.id}_n`)}</span></span>
                
              </div>
            </button>); })}
        </div>
      )}
    </main>
  );
}

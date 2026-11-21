"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SCHOOLS, loadSchool, type SchoolId } from "@/lib/schools";
import { PRESETS } from "@/lib/demo";
import { NEEDS } from "@/lib/needs";
import { TOOLS } from "@/lib/kernel/tools";
import { mayCall } from "@/lib/kernel/governance";
import { decide as decideNow, POLICY } from "@/lib/kernel/autonomy";
import { SPACES, SPACE } from "@/lib/kernel/space";
import type { GemiState } from "@/lib/kernel/types";
import { AXES, blank, loadLog, replay, saveLog, type AxisId, type Beliefs, type LogEvent } from "@/lib/mind";
import { t, loadLang, saveLang, type Lang, say } from "@/lib/i18n";
import { Menu } from "@/components/Menu";
import { Composer, type Sent } from "@/components/Composer";
import { Chunky, GamePanel, Icon, IconButton, INK, RadialMenu } from "@/components/game";

type Entity = { id: string; name: string; fields: Record<string, any>; tier: number };
type Evidence = { entity_id: string; field: string; check_confidence: number | null; passed: boolean | null };
type Panel = "talk" | "desk" | "diary" | "tools" | "outbox" | "wardrobe" | null;
type Item = { id: number; who: "you" | "gemi"; text?: string; image?: string; heard?: any; saw?: any; cost?: string; error?: boolean; step?: boolean };
type Find = { id: string; title: string; fields: Record<string, any>; why: string; evidence: { axis: AxisId; x: number; why: string }[]; checks: { field: string; confidence: number; passed: boolean }[] };
type Trip = { place: string; by: "gemi" | "student"; reason: string; finds: Find[]; seal: string; sealed: string; revealed?: { predicted: Record<string, number>; nonce: string; verified: boolean }; contrast_axis?: string; tokens?: number; model?: string; choices: Record<string, "keep" | "skip"> };

const BUILDINGS = [
  { id: "library", art: "/art/bld2-library.svg", x: 21.25, y: 36.7 }, { id: "clubs", art: "/art/bld2-clubs.svg", x: 78.75, y: 36.7 },
  { id: "commons", art: "/art/bld2-commons.svg", x: 21.25, y: 72.2 }, { id: "career", art: "/art/bld2-career.svg", x: 78.75, y: 72.2 },
] as const;
const uid = () => Math.random().toString(36).slice(2, 10);

// The room, then the spaces a Gemi can open later. [id, English, Chinese]
const SPACE_LIST: [string, string, string][] = [["room", "My room", "我的小屋"], ["readingRoom", "Reading room", "阅览室"], ["loft", "Skylight loft", "天窗阁楼"], ["rooftop", "Rooftop", "屋顶"], ["lab", "Lab", "实验室"], ["greenhouse", "Greenhouse", "温室"], ["makerLab", "Maker lab", "创客间"], ["backyard", "Backyard", "后院"]];

function Dialogue({ name, text, accent, onDone }: { name: string; text: string; accent: string; onDone: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => { const id = setInterval(() => setN((k) => (k >= text.length ? k : k + 1)), 28); return () => clearInterval(id); }, [text]);
  useEffect(() => { if (n < text.length) return; const id = setTimeout(onDone, 6000); return () => clearTimeout(id); }, [n, text.length, onDone]);
  return (
    <button onClick={() => (n < text.length ? setN(text.length) : onDone())} className="absolute bottom-32 left-1/2 z-[6] w-[min(40rem,82vw)] -translate-x-1/2 text-left">
      <span className="absolute -top-4 left-7 z-[1] -rotate-2 rounded-lg border-[3px] px-3.5 py-0.5 text-sm font-bold text-white" style={{ background: accent, borderColor: INK }}>{name}</span>
      <span className="block rounded-xl border-[3px] bg-[#fffaf0] px-6 pb-5 pt-6 text-[17px] font-bold leading-relaxed" style={{ borderColor: INK, boxShadow: `0 6px 0 ${INK}33, 0 14px 30px #0002`, minHeight: "5.2rem" }}>
        {text.slice(0, n)}<span className="invisible">{text.slice(n)}</span></span>
      {n >= text.length && <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 animate-bounce text-sm" style={{ color: accent }}>▼</span>}
    </button>);
}

export default function Room() {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null), feedEnd = useRef<HTMLDivElement>(null), nextId = useRef(1);
  const [school, setSchool] = useState<SchoolId | null>(null);
  const [lang, setLang] = useState<Lang>("en");
  const [panel, setPanel] = useState<Panel>(null);
  const [deskView, setDeskView] = useState(false);
  // The first minute in the room: the Gemi shows its Gem Star jars filling for today, says what they are for, then shows the room.
  const [tour, setTour] = useState<number | null>(null), [poured, setPoured] = useState(0);
  const firstWords = useRef<string | null>(null);
  const [live, setLive] = useState<Record<string, any>>({});
  // First visit: there is no account system. Who you are to your Gemi lives in this browser only (gemi.me.<school>).
  const [me, setMe] = useState<{ name: string; demo?: boolean } | null | undefined>(undefined);
  const [draft, setDraft] = useState({ name: "", about: "", step: 0 });
  const [space, setSpace] = useState(0);   // 0 is the room; the others are spaces the Gemi opens with Gem Stars it saved
  const [head, setHead] = useState<{ x: number; y: number } | null>(null);
  const [spoke, setSpoke] = useState<{ text: string; until: number } | null>(null);
  const lastWhy = useRef("");
  const [look, setLook] = useState<Record<string, any>>({});
  const [owned, setOwned] = useState<string[]>([]);
  const [went, setWent] = useState<{ find: string; title: string; matched: boolean }[]>([]);
  const guesses = useRef<Record<string, number>>({});
  const [wtab, setWtab] = useState("Hair");
  const [wish, setWish] = useState<{ id: string; cost: number; short?: boolean } | null>(null);
  const doNext = useRef<any>(null);
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

  useEffect(() => { const s = loadSchool(); if (!s) router.replace("/start"); else { setSchool(s); setLog(loadLog(s)); } setLang(loadLang()); }, [router]);
  useEffect(() => { if (school) fetch(`/api/base?school=${school}`).then((r) => r.json()).then(setBase).catch(() => setBase({ entities: [], evidence: [], error: "Could not reach the base." })); }, [school]);
  const send = (type: string, value?: unknown) => frame.current?.contentWindow?.postMessage({ source: "gemiverse", type, value }, "*");
  useEffect(() => {
    const on = (ev: MessageEvent) => {
      const m = ev.data; if (m?.source !== "gemiverse-room") return;
      if (m.type === "doing") setDoing(m.value);
      if (m.type === "head") setHead(m.value);
      if (m.type === "tapped") setTap(m.value);
      if (m.type === "released") setTap(null);
      if (m.type === "open") { if (m.value === "door") { setPanel(null); setDeskView(false); setCampus(true); } else if (m.value === "wardrobe") setPanel("wardrobe"); }
      if (m.type === "ready" && school) { let saved = null; try { saved = JSON.parse(localStorage.getItem(`gemi.look.${school}`) ?? "null"); } catch {} send("look", saved ?? PRESETS[school].look); if (saved) setLook(saved); try { setOwned(JSON.parse(localStorage.getItem(`gemi.inv.${school}`) ?? "[]")); } catch {} try { setMe(JSON.parse(localStorage.getItem(`gemi.me.${school}`) ?? "null")); } catch { setMe(null); }
        // What the student told the point of light on the start page is the first thing the Gemi hears in its room.
        try { const first = localStorage.getItem(`gemi.about.${school}`); if (first) { localStorage.removeItem(`gemi.about.${school}`); firstWords.current = first; } if (localStorage.getItem(`gemi.me.${school}`) && !localStorage.getItem(`gemi.toured.${school}`)) setTimeout(() => setTour(0), 1800); else if (firstWords.current) { const w = firstWords.current; firstWords.current = null; setTimeout(() => { setPanel("talk"); onSend({ kind: "text", text: w }); }, 2500); } } catch {} try { setWent(JSON.parse(localStorage.getItem(`gemi.went.${school}`) ?? "[]")); guesses.current = JSON.parse(localStorage.getItem(`gemi.guess.${school}`) ?? "{}"); } catch {} setTimeout(() => auto.current?.(), 600); }
      if (m.type === "layout" && school) { const it = String(m.value?.item ?? "something"); roomTouched.current = it; lastTouch.current = Date.now();
        setLog((l) => { const n = [...l, { id: Math.random().toString(36).slice(2, 10), at: new Date().toISOString(), type: "room" as const, by: "student" as const, what: `moved the ${it}`, item: it }]; saveLog(school, n); return n; }); }
      if (m.type === "focus") { if (m.value === "desk") setDeskView(true); else if (m.value === "room") setDeskView(false); }   // a click on the desk in 3D enters the desk view; panels open only from buttons
    };
    addEventListener("message", on); return () => removeEventListener("message", on);
  }, [school]);
  useEffect(() => { feedEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [feed, panel]);
  useEffect(() => { const on = (e: KeyboardEvent) => { if (e.key === "Escape") { setCampus(false); setPanel(null); } }; addEventListener("keydown", on); return () => removeEventListener("keydown", on); }, []);

  const mind = useMemo(() => replay(log), [log]);
  const pendingNow = trip ? trip.finds.filter((f) => !trip.choices[f.id]).length : 0;
  const choicesMade = log.filter((e) => e.type === "choice" && !e.undone).length, keptCount = log.filter((e) => e.type === "choice" && !e.undone && (e as any).action === "keep").length;
  const stageNow = (choicesMade >= 15 ? 3 : choicesMade >= 5 ? 2 : 1) as 1 | 2 | 3;
  // the room draws the state
  useEffect(() => { send("world", { desk: pendingNow, pinned: keptCount, starsYou: tour === 0 ? Math.min(state.purses.for_you, poured) : state.purses.for_you, starsSelf: tour === 0 ? Math.max(0, Math.min(state.purses.for_itself, poured - state.purses.for_you)) : state.purses.for_itself, stage: stageNow, keepsakes: went.length, companions: went.filter((w) => w.matched).length }); }, [pendingNow, keptCount, state.purses.for_you, state.purses.for_itself, stageNow, went, tour, poured]);
  // Its own initiative: left alone with nothing waiting on the desk and enough Gem Stars, it decides to go out by itself.
  // It picks the place that serves what the student cares about most; this trip is paid from its own allowance.
  // Autonomy: the policy table in lib/kernel/autonomy.ts is evaluated every few seconds; whatever row matches decides what it does.
  const auto = useRef<(() => void) | null>(null), lastTouch = useRef(0), [now, setNow] = useState<ReturnType<typeof decideNow> | null>(null), diaryDone = useRef(false), roomTouched = useRef<string | null>(null);
  useEffect(() => { lastTouch.current = Date.now(); const touch = () => { lastTouch.current = Date.now(); }; addEventListener("pointerdown", touch); addEventListener("keydown", touch); return () => { removeEventListener("pointerdown", touch); removeEventListener("keydown", touch); }; }, []);
  useEffect(() => { const id = setInterval(() => auto.current?.(), 5000); return () => clearInterval(id); }, []);
  const s = school ? SCHOOLS[school] : null, preset = school ? { ...PRESETS[school], gemiName: me?.name || PRESETS[school].gemiName } : null;
  const evidenceOf = useMemo(() => { const m: Record<string, Evidence[]> = {}; for (const e of base?.evidence ?? []) (m[e.entity_id] ??= []).push(e); return m; }, [base]);
  useEffect(() => { if (tour === null) return; send("focus", ["jars", "jars", "desk", "board", "door"][tour] ?? "room"); setPanel(null); setDeskView(false);
    if (tour !== 0) return; setPoured(0); let n = 0; const id = setInterval(() => { n += 1; setPoured(n); if (n >= 12) clearInterval(id); }, 320); return () => clearInterval(id); }, [tour]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!s || !preset || !school) return null;
  const tt = (k: string) => t(k, lang);
  const tri = (en: string, zh: string, es: string) => (lang === "zh" ? zh : lang === "es" ? es : en);
  const push = (i: Omit<Item, "id">) => setFeed((f) => [...f, { ...i, id: nextId.current++ }]);
  const append = (e: LogEvent) => setLog((l) => { const n = [...l, e]; saveLog(school, n); return n; });
  const when = (f: Record<string, any>) => { const v = f.occurrences?.[0]?.start; return v ? new Date(v).toLocaleString(lang === "zh" ? "zh-CN" : lang === "es" ? "es" : "en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : tt("date_unconfirmed"); };
  const releaseGemi = () => { setTap(null); send("release"); };
  const openPanel = (p: Panel) => { setPanel(p); setCampus(false); releaseGemi(); if (p !== "desk") setDeskView(false); send("focus", p === "desk" ? "desk" : p === "diary" ? "board" : "room"); };
  const charge = (tool: string, stars: number, purse: "for_you" | "for_itself") => setState((st) => ({ ...st, purses: { ...st.purses, [purse]: st.purses[purse] - stars }, usedToday: { ...st.usedToday, [tool]: (st.usedToday[tool] ?? 0) + 1 } }));

  async function onSend(m: Sent) {
    setPanel("talk"); setBusy(true);
    try {
      if (m.kind === "file") {
        const verdict = mayCall("see_poster", state, "", "student");
        push({ who: "you", text: m.name, image: m.preview });
        if (!verdict.ok) { push({ who: "gemi", text: verdict.reason, error: true }); return; }
        const r = await fetch("/api/see", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: m.data, mime: m.mime, lang, school }) }).then((x) => x.json());
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
        // Agentic: what it heard as a request becomes a step it takes, after the same governance check as a button press.
        const d = r.do?.tool && r.do.tool !== "none" ? r.do : null;
        if (d) { push({ who: "gemi", text: `→ ${d.tool}${d.place ? ` · ${d.place}` : ""} · ${tt("your_idea")} · Decisions ${r.route?.confidence ?? ""}`, step: true }); doNext.current = d; }
      }
    } catch { push({ who: "gemi", text: "Something went wrong reaching the model.", error: true }); }
    finally { setBusy(false); const d = doNext.current; doNext.current = null;
      if (d?.tool === "go_out" && ["library", "clubs", "commons", "opportunities"].includes(d.place)) setTimeout(() => goOut(d.place, "student"), 600);
      else if (d?.tool === "open_diary") openPanel("diary"); else if (d?.tool === "show_desk") { setPanel(null); setDeskView(true); send("focus", "desk"); } else if (d?.tool === "meet_gemis") window.open("/meet", "_blank"); }
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
      setTrip({ ...r, place, by, choices: {} }); if (by === "student") setPanel("desk");
    } catch { push({ who: "gemi", text: "It could not finish the trip.", error: true }); setPanel("talk"); }
    finally { setBusy(false); setOutAt(null); setCampus(false); send("away", false); }
  }

  auto.current = () => {
    const d = decideNow({ pending: pendingNow, outNow: !!outAt, starsYou: state.purses.for_you, starsSelf: state.purses.for_itself, choices: choicesMade, widestHalo: Math.max(...AXES.map((a) => mind.beliefs[a.id].u)),
      topCare: Math.max(0, ...Object.values(mind.care)), hour: new Date().getHours(), idleSeconds: (Date.now() - lastTouch.current) / 1000, diaryToday: diaryDone.current, paused: state.paused, bank: 0, goalCost: 6, goalName: "a song", roomChangedByStudent: !!roomTouched.current });
    if (d.rule !== "potter" && d.why !== lastWhy.current) { lastWhy.current = d.why; setSpoke({ text: d.why, until: 0 }); }
    setNow(d); send("mode", d.state === "waiting" ? "waiting" : "free");
    if (busy || campus || panel === "talk" || tap) return;                      // it never acts on its own while you are in the middle of something
    if (d.rule === "notice") { const it = roomTouched.current; roomTouched.current = null; send("express", "surprised"); send("play", "think"); setDoing(`noticed you moved the ${it}`); return; }
    if (d.rule === "go" && mayCall("go_out", state, "", "gemi").ok) {
      const top = Object.entries(mind.care).sort((a, b) => b[1] - a[1])[0]?.[0];
      goOut(top && ["find_my_people", "make_and_express"].includes(top) ? "clubs" : top && ["get_experience", "decide_a_direction", "fund_my_path"].includes(top) ? "career" : top === "rest_and_recover" ? "commons" : "library", "gemi");
    } else if (d.rule === "diary" && mayCall("write_diary", state, "", "gemi").ok) { diaryDone.current = true; charge("write_diary", 1, "for_itself"); send("play", "writeAtDesk"); setDoing("writing in its diary, on its own star"); }
    else if (d.rule === "tidy" && mayCall("decorate_room", state, "", "gemi").ok) { lastTouch.current = Date.now(); charge("decorate_room", 1, "for_itself"); send("palette", Math.floor(Math.random() * 3)); setDoing("changed its room, on its own star"); }
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
      guesses.current = { ...guesses.current, ...r.predicted }; try { localStorage.setItem(`gemi.guess.${school}`, JSON.stringify(guesses.current)); } catch {}
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

  const titles: Record<string, [string, string]> = { talk: ["tab_talk", "talk"], desk: ["tab_desk", "desk"], diary: ["tab_diary", "diary"], tools: ["tab_tools", "abilities"], outbox: ["tab_outbox", "outbox"], wardrobe: ["tab_wardrobe", "wardrobe"] };

  return (
    <main className="relative h-screen overflow-hidden bg-[#f6f2ee] text-[#2b2536]">
      <iframe ref={frame} src={`/gen3d/viewer.html?embed=1&school=${s.id}`} title="Your Gemi's room" className="absolute inset-0 h-full w-full border-0" />

      {space > 0 && <iframe key={SPACE_LIST[space][0]} src={`/gen3d/spaces.html?embed=1&space=${SPACE_LIST[space][0]}&me=${preset.gemiName.toLowerCase()}${space % 2 === 0 ? "&friends=pip,kai" : ""}`} title={SPACE_LIST[space][1]} className="absolute inset-0 h-full w-full border-0" style={{ background: "#e9e6e1" }} />}
      {space > 0 && (() => { const sp = SPACES.find((x) => x.id === SPACE_LIST[space][0]); if (!sp) return null; const z = lang === "zh"; return (
        <div className="absolute left-6 top-24 z-[4] w-[21rem] rounded-xl border-[3px] bg-[#fffaf0] px-4 py-3" style={{ borderColor: INK, boxShadow: `0 5px 0 ${INK}33` }}>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#8a8296]">{z ? "这个空间用来" : "This space is for"}</div>
          <div className="text-lg font-bold leading-tight">{z ? sp.for_zh : sp.for_}</div>
          <ul className="mt-2 space-y-1.5">{sp.does.map(([en, zh]) => <li key={en} className="flex gap-2 text-[13.5px] leading-snug"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: s.accent }} />{z ? zh : en}</li>)}</ul>
          <div className="mt-2.5 flex items-center gap-1.5 border-t-2 border-dashed pt-2 text-[12px] text-[#6d6579]" style={{ borderColor: "#e6dfd0" }}><Icon name="star" size={14} />{z ? `它自己攒够 ${sp.cost} 颗 Gem Star 才会打开 · 功能在设计中` : `Opens when it has saved ${sp.cost} Gem Stars of its own · functions are designed, not built`}</div>
        </div>); })()}
      {!campus && (
        <div className="absolute left-1/2 top-4 z-[4] flex -translate-x-1/2 items-center gap-2 rounded-full border-[3px] bg-[#fffaf0] px-1.5 py-1" style={{ borderColor: INK, boxShadow: `0 4px 0 ${INK}` }}>
          <button onClick={() => { setSpace((space + SPACE_LIST.length - 1) % SPACE_LIST.length); setPanel(null); setDeskView(false); }} aria-label="Previous space" className="grid h-7 w-7 place-items-center rounded-full text-lg font-bold hover:bg-[#f1ebf7]">‹</button>
          <span className="min-w-[9.5rem] text-center text-sm font-bold">{SPACE_LIST[space][lang === "zh" ? 2 : 1]}{space > 0 && <span className="ml-1.5 text-[11px] font-normal text-[#8a8296]">{tri("preview", "预览", "vista previa")}</span>}</span>
          <button onClick={() => { setSpace((space + 1) % SPACE_LIST.length); setPanel(null); setDeskView(false); }} aria-label="Next space" className="grid h-7 w-7 place-items-center rounded-full text-lg font-bold hover:bg-[#f1ebf7]">›</button>
        </div>)}

      <div className="absolute left-5 top-4 flex items-center gap-3">
        <a href="/" className="text-lg font-bold tracking-tight"><span style={{ color: "#d9891c" }}>Gemi</span><span style={{ color: "#7c4dce" }}>verse</span></a>
        <span className="rounded-full border-[3px] px-3 py-0.5 text-xs font-bold text-white" style={{ background: s.accent, borderColor: INK }}>{s.short}</span>
        <Menu lang={lang} onLang={(l) => { setLang(l); saveLang(l); }} />
      </div>

      <button onClick={() => openPanel(panel === "tools" ? null : "tools")} className="absolute right-5 top-4 flex items-center gap-4 rounded-full border-[3px] bg-[#fffaf0] px-4 py-1.5 text-left" style={{ borderColor: INK, boxShadow: `0 4px 0 ${INK}` }}>
        <div><div className="text-sm font-bold leading-tight">{preset.gemiName}</div><div className="text-[11px] text-[#8a8296]">{tt("stage")}</div></div>
        {(["for_you", "for_itself"] as const).map((p) => <div key={p} className="flex items-center gap-1 text-sm font-bold tabular-nums"><Icon name="star" size={20} />{state.purses[p]}<span className="text-[11px] font-normal text-[#8a8296]">{tt(p)}</span></div>)}
      </button>

      {!tap && !campus && <div className="absolute left-5 top-[4.6rem] max-w-[min(34rem,60vw)] rounded-2xl border-[3px] bg-[#fffaf0] px-4 py-1.5 text-sm" style={{ borderColor: INK, boxShadow: `0 4px 0 ${INK}` }}><span className="text-[#8a8296]">{tt("right_now")}: </span>{preset.gemiName} {tt("gemi_is")} {busy ? tt("thinking") : say(doing, lang)}</div>}

      {tap && <RadialMenu x={tap.x} y={tap.y} items={[
        { icon: "talk", label: tt("tap_talk"), onClick: () => openPanel("talk") },
        { icon: "diary", label: tt("tab_diary"), onClick: () => openPanel("diary") },
        { icon: "campus", label: tt("tap_out"), onClick: () => { setCampus(true); setPanel(null); releaseGemi(); } },
        { icon: "abilities", label: tt("tap_look"), onClick: () => { send("look", null); releaseGemi(); } },
      ]} />}

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-4">
        <IconButton icon="talk" label={tt("btn_talk")} active={panel === "talk"} accent={s.soft} onClick={() => openPanel(panel === "talk" ? null : "talk")} />
        <IconButton icon="desk" label={tt("btn_desk")} active={deskView || panel === "desk"} accent={s.soft} badge={pending || undefined} onClick={() => { const on = !deskView; setDeskView(on); setPanel(null); setCampus(false); releaseGemi(); send("focus", on ? "desk" : "room"); }} />
        <IconButton icon="diary" label={tt("btn_diary")} active={panel === "diary"} accent={s.soft} onClick={() => openPanel(panel === "diary" ? null : "diary")} />
        <IconButton icon="campus" label={tt("btn_campus")} active={campus} accent={s.soft} onClick={() => { setCampus(true); setPanel(null); releaseGemi(); }} />
        <IconButton icon="wardrobe" label={tt("btn_wardrobe")} active={panel === "wardrobe"} accent={s.soft} onClick={() => openPanel(panel === "wardrobe" ? null : "wardrobe")} />
        <IconButton icon="arrange" label={tt("btn_arrange")} onClick={() => { setPanel(null); send("arrange"); }} />
        <IconButton icon="abilities" label={tt("btn_more")} active={panel === "tools"} accent={s.soft} onClick={() => openPanel(panel === "tools" ? null : "tools")} />
        <IconButton icon="outbox" label={tt("btn_outbox")} active={panel === "outbox"} accent={s.soft} onClick={() => openPanel(panel === "outbox" ? null : "outbox")} />
      </div>

      {me === null && (() => {
        const begin = (m: { name: string; demo?: boolean }) => { try { localStorage.setItem(`gemi.me.${school}`, JSON.stringify(m)); } catch {} setMe(m); if (!m.demo) setTimeout(() => setTour(0), 600); };
        const finish = () => { const name = draft.name.trim() || PRESETS[school!].gemiName; begin({ name }); if (draft.about.trim()) { setPanel("talk"); setTimeout(() => onSend({ kind: "text", text: draft.about.trim() }), 400); } };
        const btn = "rounded-full border-[3px] px-6 py-2 text-base font-bold";
        return (
          <div className="absolute inset-0 z-40 grid place-items-center bg-[#2b2536]/45 backdrop-blur-[2px]">
            <div className="w-[min(34rem,90vw)] rounded-2xl border-[3px] bg-[#fffaf0] p-7" style={{ borderColor: INK, boxShadow: `0 8px 0 ${INK}55` }}>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a8296]">{tri("First time here", "第一次来", "Primera vez")} · {draft.step + 1} / 3</p>
              {draft.step === 0 && (<>
                <h2 className="mt-2 text-3xl font-bold">{tri("Name your Gemi", "给你的 Gemi 起个名字", "Ponle nombre a tu Gemi")}</h2>
                <p className="mt-2 text-[15px] text-[#5f576c]">{tri("It is a small you that lives on campus. It is not you, and it does not have to look like you.", "它是住在校园里的一个小小的你。它不是你本人，也不必长得像你。", "Es un pequeño tú que vive en el campus. No eres tú, ni tiene que parecerse a ti.")}</p>
                <input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value.slice(0, 16) })} placeholder={PRESETS[school!].gemiName} className="mt-4 w-full rounded-xl border-[3px] bg-white px-4 py-2.5 text-lg font-bold outline-none" style={{ borderColor: INK }} /></>)}
              {draft.step === 1 && (<>
                <h2 className="mt-2 text-3xl font-bold">{tri("Tell it one thing about you", "告诉它一件关于你的事", "Cuéntale algo de ti")}</h2>
                <p className="mt-2 text-[15px] text-[#5f576c]">{tri("Any language. What you are looking for this term, or what tires you. It keeps this in your browser only, and you can undo it.", "什么语言都行。这学期想找什么，或者什么让你累。它只存在你的浏览器里，可以撤回。", "En cualquier idioma. Qué buscas este curso o qué te cansa. Se guarda solo en tu navegador.")}</p>
                <textarea autoFocus value={draft.about} onChange={(e) => setDraft({ ...draft, about: e.target.value.slice(0, 600) })} rows={4} className="mt-4 w-full resize-none rounded-xl border-[3px] bg-white px-4 py-2.5 text-[15px] outline-none" style={{ borderColor: INK }} /></>)}
              {draft.step === 2 && (<>
                <h2 className="mt-2 text-3xl font-bold">{tri("How it works here", "这里的规矩", "Cómo funciona")}</h2>
                <ul className="mt-3 space-y-2 text-[15px] leading-snug text-[#3d3648]">
                  <li><b>{tri("What you ask for is free.", "你让它做的事不花钱。", "Lo que pides es gratis.")}</b> {tri("Its Gem Stars are for what it decides to do on its own.", "Gem Star 是它自己拿主意时花的。", "Sus Gem Stars son para lo que decide por su cuenta.")}</li>
                  <li><b>{tri("It tells you only what it could check.", "它只告诉你核对过的。", "Solo te cuenta lo que pudo comprobar.")}</b> {tri("Open any card to see the source.", "点开任何一张卡都能看到出处。", "Abre cualquier tarjeta para ver la fuente.")}</li>
                  <li><b>{tri("You decide.", "决定是你做。", "Tú decides.")}</b> {tri("Clothes are free in the wardrobe. Keepsakes come from things you really went to.", "衣柜里的衣服都免费。纪念品来自你真的去了的事。", "La ropa es gratis. Los recuerdos vienen de lo que hiciste de verdad.")}</li></ul></>)}
              <div className="mt-6 flex items-center justify-between">
                <button onClick={() => begin({ name: PRESETS[school!].gemiName, demo: true })} className="text-sm text-[#8a8296] underline">{tri("Skip: use the demo Gemi", "跳过：用演示的 Gemi", "Saltar: usar el Gemi de demostración")}</button>
                <div className="flex gap-2">{draft.step > 0 && <button onClick={() => setDraft({ ...draft, step: draft.step - 1 })} className={btn} style={{ borderColor: INK, background: "#fff" }}>{tri("Back", "上一步", "Atrás")}</button>}
                  <button onClick={() => (draft.step < 2 ? setDraft({ ...draft, step: draft.step + 1 }) : finish())} className={btn} style={{ borderColor: INK, background: "#ffe08a", boxShadow: `0 4px 0 ${INK}` }}>{draft.step < 2 ? tri("Next", "下一步", "Siguiente") : tri("Wake it up", "叫醒它", "Despertarlo")}</button></div>
              </div>
            </div>
          </div>); })()}

      {tour !== null && preset && (() => {
        const T: { view: string; big: string; lines: string[]; chips?: string[] }[] = [
          { view: "jars", big: tri(`These are Gem Stars. They are ${preset.gemiName}'s.`, `这是 Gem Star，是给 ${preset.gemiName} 的。`, `Estas son Gem Stars. Son de ${preset.gemiName}.`), lines: [tri(`Every day it gets ${state.purses.for_you} to spend for you and ${state.purses.for_itself} for itself. They are real tokens, and tomorrow it gets the same again.`, `每天它会拿到 ${state.purses.for_you} 颗为你花、${state.purses.for_itself} 颗为它自己花。这是真实的 token，明天还是这么多。`, `Cada día recibe ${state.purses.for_you} para ti y ${state.purses.for_itself} para sí. Son tokens reales.`), tri("It decides for itself how to spend them. What you ask for is free.", "怎么花，它自己决定。你让它做的事不花星星。", "Decide por sí mismo cómo gastarlas. Lo que pides es gratis.")] },
          { view: "jars", big: tri("With them it can", "它可以用星星做这些事", "Con ellas puede"), lines: [tri("And more, for you to find.", "还有更多，等你发现。", "Y más, por descubrir.")], chips: [tri("go out and look for you", "出门替你找", "salir a buscar"), tri("check a fact at its source", "回到出处核对一件事", "comprobar un dato"), tri("write its diary", "写日记", "escribir su diario"), tri("change its room", "布置自己的房间", "cambiar su cuarto"), tri("write a song", "写一首歌", "escribir una canción"), tri("save for days for something bigger", "攒几天做一件大事", "ahorrar para algo grande")] },
          { view: "desk", big: tri("“This is my desk.”", "「这是我的书桌。」", "«Este es mi escritorio.»"), lines: [tri("What I bring back for you lands here, each thing with its source. And this is my diary: what I learn about how you choose. You can undo any line.", "我带回来给你的东西放在这里，每样都带出处。这是我的日记：我学到的你是怎么选的。每一条你都能撤回。", "Lo que te traigo llega aquí, con su fuente. Y este es mi diario: puedes deshacer cualquier línea.")] },
          { view: "board", big: tri("“What you keep, I pin up here.”", "「你留下的，我钉在这块板上。」", "«Lo que guardas, lo cuelgo aquí.»"), lines: [tri("Go to one of them for real, and a keepsake will turn up in the room.", "真的去了其中一个，屋里就会多一件纪念品。", "Si vas de verdad, aparecerá un recuerdo.")] },
          { view: "door", big: tri("“And that door goes out to campus.”", "「那扇门通往校园。」", "«Y esa puerta da al campus.»"), lines: [tri("I go to the library, the clubs, the commons. I come back only with what I have checked. There are a lot of good things out there.", "我会去图书馆、社团、交流广场逛，只带回核对过的东西。外面有很多好东西。", "Voy a la biblioteca, los clubes, el comedor. Solo vuelvo con lo comprobado.")] },
        ];
        const k = tour, x = T[k], last = k === T.length - 1;
        const end = () => { try { localStorage.setItem(`gemi.toured.${school}`, "1"); } catch {} setTour(null); send("focus", "room"); const w = firstWords.current; firstWords.current = null; if (w) setTimeout(() => { setPanel("talk"); onSend({ kind: "text", text: w }); }, 900); };
        return (
          <div className="absolute inset-x-0 bottom-28 z-30 flex justify-center px-6">
            <div className="relative w-[min(46rem,92vw)] rounded-xl border-[3px] bg-[#fffaf0] px-7 pb-5 pt-6" style={{ borderColor: INK, boxShadow: `0 6px 0 ${INK}33, 0 14px 30px #0003` }}>
              <span className="absolute -top-4 left-7 -rotate-2 rounded-lg border-[3px] px-3.5 py-0.5 text-sm font-bold text-white" style={{ background: s!.accent, borderColor: INK }}>{preset.gemiName}</span>
              <p className="text-[1.7rem] font-bold leading-tight">{x.big}</p>
              {x.chips && <div className="mt-3 flex flex-wrap gap-2">{x.chips.map((c) => <span key={c} className="flex items-center gap-1.5 rounded-full border-2 bg-white px-3 py-1 text-[15px] font-bold" style={{ borderColor: INK }}><Icon name="star" size={16} />{c}</span>)}</div>}
              {x.lines.map((l) => <p key={l} className="mt-2 text-[17px] leading-snug text-[#3d3648]">{l}</p>)}
              <div className="mt-4 flex items-center justify-between"><button onClick={end} className="text-sm text-[#8a8296] underline">{tri("Skip the tour", "跳过", "Saltar")}</button>
                <div className="flex items-center gap-3"><span className="text-xs tabular-nums text-[#8a8296]">{k + 1} / {T.length}</span>
                  <button onClick={() => (last ? end() : setTour(k + 1))} className="rounded-full border-[3px] bg-[#ffe08a] px-6 py-1.5 text-base font-bold" style={{ borderColor: INK, boxShadow: `0 4px 0 ${INK}` }}>{last ? tri("Start", "开始", "Empezar") : tri("Next", "下一步", "Siguiente")}</button></div></div>
            </div>
          </div>); })()}

      {/* What the Gemi says on its own comes up as a dialogue card, as a character speaks in a game: name tag, typed line, tap to dismiss. */}
      {spoke && tour === null && !campus && !panel && !tap && <Dialogue key={spoke.text + lang} name={preset.gemiName} text={say(spoke.text, lang)} accent={s.accent} onDone={() => setSpoke(null)} />}

      {deskView && !panel && !campus && (
        <div className="absolute left-6 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-3">
          {[{ k: "finds", icon: "desk", title: tt("tab_desk"), sub: pending ? `${pending} · ${tt("brought_back")}` : "0", go: () => setPanel("desk") },
            { k: "diary", icon: "diary", title: tt("btn_diary"), sub: `${log.filter((e) => e.type === "choice").length}`, go: () => setPanel("diary") },
            { k: "stars", icon: "star", title: "Gem Star", sub: `${state.purses.for_you} + ${state.purses.for_itself}`, go: () => setPanel("tools") }].map((h) => (
            <button key={h.k} onClick={h.go} className="flex items-center gap-3 rounded-2xl border-[3px] bg-[#fffaf0] px-4 py-2.5 text-left transition hover:translate-x-1" style={{ borderColor: INK, boxShadow: `0 4px 0 ${INK}` }}>
              <Icon name={h.icon} size={30} /><span><span className="block text-sm font-bold leading-tight">{h.title}</span><span className="block text-xs text-[#8a8296]">{h.sub}</span></span></button>))}
          <button onClick={() => { setDeskView(false); send("focus", "room"); }} className="rounded-full border-[3px] bg-[#ffe08a] px-4 py-2 text-sm font-bold" style={{ borderColor: INK, boxShadow: `0 4px 0 ${INK}` }}>{tt("back_room")}</button>
        </div>)}

      {panel && (
        <GamePanel title={tt(titles[panel][0])} icon={titles[panel][1]} accent={s.accent} onClose={() => { setPanel(null); send("focus", deskView ? "desk" : "room"); }} closeLabel={tt("close")}
          footer={panel === "talk" ? <Composer lang={lang} accent={s.accent} busy={busy} onSend={onSend} /> : undefined}>
          {panel === "wardrobe" && (() => {
            // The wardrobe is an inventory, as in any dress-up game: tabs, a grid of things, what is worn, what is owned, what is not yet.
            // Clothes are free: appearance is the student's own. Things that mean something (keepsakes, companions, spaces) arrive from what really happened.
            const cur: Record<string, any> = { ...preset.look, ...look };
            const save = (k: string, v: any) => { try { localStorage.setItem(`gemi.${k}.${school}`, JSON.stringify(v)); } catch {} };
            const wear = (patch: Record<string, any>) => { const n = { ...cur, ...patch }; setLook(n); save("look", n); send("look", n); };
            const CATS: Record<string, { key: string; colorKey?: string; cost: number; items: string[] }> = {
              Hair: { key: "hairStyle", colorKey: "hairColor", cost: 2, items: ["bob", "longStraight", "longWavy", "twinTails", "sidePonytail", "highPonytail", "bun", "shortCrop", "sidePart", "tousled", "curtainBangs", "pixie", "curlyMedium"] },
              Tops: { key: "top", colorKey: "topColor", cost: 2, items: ["cardigan", "hoodie", "sweater", "shirt", "tee", "blazer"] },
              Bottoms: { key: "bottom", colorKey: "bottomColor", cost: 2, items: ["pleatedSkirt", "trousers", "jeans", "shorts", "longSkirt"] },
              Shoes: { key: "shoes", colorKey: "shoeColor", cost: 1, items: ["maryJanes", "sneakers", "boots", "loafers"] },
            };
            const START = ["bob", "longStraight", "shortCrop", "tee", "hoodie", "jeans", "trousers", "sneakers", preset.look.hairStyle, preset.look.top, preset.look.bottom, (preset.look as any).shoes ?? "sneakers"];
            const has = (_id: string) => true;   // ruled 14:55 after Carbon's review: how you look is yours and free. No shop, no currency.
            const c = CATS[wtab], name = (o: string) => o.replace(/([A-Z])/g, " $1").toLowerCase();
            const ask = (id: string) => {
              if (state.purses.for_itself >= c.cost) { charge("make_item", c.cost, "for_itself"); const n = [...owned, id]; setOwned(n); save("inv", n); setWish(null); wear({ [c.key]: id });
                append({ id: uid(), at: new Date().toISOString(), type: "room", by: "gemi", what: `got ${name(id)} for ${c.cost} of its own Gem Stars, because you asked`, item: id }); }
              else setWish({ id, cost: c.cost, short: true });
            };
            const PAL = wtab === "Hair" ? ["#2a2226", "#2a1d18", "#6b4a2f", "#c9a063", "#a8482f", "#f2a7b8", "#8fc1e8", "#d8d4dc"] : ["#b8a2e3", "#8fc1e8", "#f2a7b8", "#ffe08a", "#a8e0c0", "#ffffff", "#3d3648", "#5b7bb5", "#d9534f", "#7fb48a"];
            return (<div>
              <div className="flex gap-1.5">{Object.keys(CATS).map((t) => <button key={t} onClick={() => { setWtab(t); setWish(null); }} className="flex-1 rounded-t-2xl border-[3px] border-b-0 px-2 py-1.5 text-sm font-bold" style={{ borderColor: INK, background: wtab === t ? "#fff" : s.soft, opacity: wtab === t ? 1 : 0.75 }}>{({ Hair: tri("Hair", "发型", "Pelo"), Tops: tri("Tops", "上衣", "Arriba"), Bottoms: tri("Bottoms", "下装", "Abajo"), Shoes: tri("Shoes", "鞋", "Zapatos") } as Record<string, string>)[t]}</button>)}</div>
              <div className="rounded-b-2xl border-[3px] bg-white p-3" style={{ borderColor: INK }}>
                <div className="grid grid-cols-3 gap-2.5">{c.items.map((o) => { const own = has(o), on = cur[c.key] === o; return (
                  <button key={o} onClick={() => (own ? wear({ [c.key]: o }) : setWish({ id: o, cost: c.cost }))} className="relative flex aspect-square flex-col items-center justify-center rounded-2xl border-[3px] p-1 text-center transition hover:-translate-y-0.5"
                    style={{ borderColor: on ? "#7c4dce" : INK, background: on ? "#efe7ff" : own ? "#fffaf0" : "#ece7e0", boxShadow: on ? "0 0 0 3px #c8b4f0" : `0 3px 0 ${INK}33` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/wardrobe/${c.key}-${o}.png`} alt="" className="h-[72%] w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }} />
                    <span className="text-[12px] font-bold leading-tight" style={{ color: own ? INK : "#8a8296" }}>{name(o)}</span>
                    {on && <span className="absolute -top-2 right-1 rounded-full bg-[#7c4dce] px-1.5 text-[10px] font-bold text-white">{tri("on", "穿着", "puesto")}</span>}
                    {!own && <span className="absolute right-1.5 top-1.5"><Icon name="lock" size={16} /></span>}
                    {!own && <span className="mt-0.5 flex items-center gap-0.5 text-[10.5px] font-bold text-[#8a8296]"><Icon name="star" size={11} />{c.cost}</span>}
                  </button>); })}</div>
                {wish && (<div className="mt-3 rounded-2xl border-2 border-dashed px-3 py-2 text-[13px] leading-snug" style={{ borderColor: INK, background: "#fff8dc" }}>
                  {wish.short ? <span><b>{preset.gemiName}</b> has {state.purses.for_itself} of its own Gem Stars today and this takes {wish.cost}. It will keep the wish and save for it.</span>
                    : <div className="flex items-center justify-between gap-2"><span>Ask <b>{preset.gemiName}</b> to get <b>{name(wish.id)}</b>? It spends {wish.cost} of its own Gem Stars.</span>
                      <button onClick={() => ask(wish.id)} className="shrink-0 rounded-full border-[3px] bg-[#ffe08a] px-3 py-1 text-sm font-bold" style={{ borderColor: INK, boxShadow: `0 3px 0 ${INK}` }}>Ask</button></div>}</div>)}
                {c.colorKey && (<><div className="mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-wider text-[#8a8296]">{tri("Colour", "颜色", "Color")}</div>
                  <div className="flex flex-wrap gap-2">{PAL.map((col) => <button key={col} onClick={() => wear({ [c.colorKey!]: col })} aria-label={col} className="h-7 w-7 rounded-full border-[3px]" style={{ background: col, borderColor: cur[c.colorKey!] === col ? "#7c4dce" : INK, boxShadow: cur[c.colorKey!] === col ? "0 0 0 2px #fff, 0 0 0 4px #7c4dce" : undefined }} />)}</div></>)}
              </div>
              <div className="mb-1 mt-3 text-[11px] font-bold uppercase tracking-wider text-[#8a8296]">{tri("Build", "体型", "Complexión")}</div>
              <input type="range" min="0.9" max="1.3" step="0.02" value={cur.bodyWidth ?? 1} onChange={(e) => wear({ bodyWidth: +e.target.value })} className="w-full" aria-label="Body width" />
            </div>); })()}
          {panel === "talk" && (
            <div className="space-y-3">
              <div className="sticky top-0 z-[1] -mx-1 flex items-center gap-3 rounded-2xl border-2 bg-[#fffaf0] px-2 py-1" style={{ borderColor: INK }}>
                <iframe src={`/gen3d/doll.html?embed=1&cam=face&looks=${preset.gemiName.toLowerCase()}`} title={preset.gemiName} className="h-24 w-24 shrink-0 border-0 bg-transparent" />
                <div className="min-w-0"><div className="text-base font-bold">{preset.gemiName}</div><div className="text-xs leading-snug text-[#6d6579]">{busy ? "…" : say(doing, lang)}</div></div>
              </div>
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
                        {i.saw.added && <div className="mt-1 rounded-lg bg-[#e6f5e6] px-2 py-1 font-semibold text-[#2f7a3d]">{tt("added_base")}</div>}
                        {i.saw.same && <div className="mt-1 rounded-lg bg-[#e8eefc] px-2 py-1 font-semibold text-[#3a4f9a]">{tt("same_base")} “{i.saw.same.name}” ({Math.round(i.saw.same.confidence * 100)}%)</div>}
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
                          <button onClick={async () => { setLive((l) => ({ ...l, [f.id]: { busy: true } })); const r = await fetch("/api/agent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: f.id, school }) }).then((x) => x.json()).catch(() => ({ error: "The agent could not be reached." })); setLive((l) => ({ ...l, [f.id]: r })); }}
                            disabled={live[f.id]?.busy} className="rounded-full border-2 bg-white px-2.5 py-0.5 text-[11px] font-bold disabled:opacity-60" style={{ borderColor: INK }}>{live[f.id]?.busy ? tri("Agent is on the page…", "Agent 正在看页面…", "El agente está en la página…") : tri("Look again, live", "现在再去看一眼", "Mirar de nuevo, en vivo")}</button>
                          {allChosen && <span className="ml-auto text-[11px] text-[#5f576c]">{Math.round(pk(f.id) * 100)}% {tt("guessed")} · <b style={{ color: (pk(f.id) >= 0.5) === (c === "keep") ? "#2f7a3d" : "#b26a00" }}>{tt((pk(f.id) >= 0.5) === (c === "keep") ? "right" : "wrong")}</b></span>}
                        </div>
                        {live[f.id] && !live[f.id].busy && (<div className="mt-2 rounded-xl border-2 border-dashed px-3 py-2 text-[12px] leading-snug" style={{ borderColor: INK, background: "#f3fbf6" }}>
                          {live[f.id].error ? <span className="text-[#b26a00]">{live[f.id].error}</span> : (<>
                            <div className="font-bold">Managed Agent · {live[f.id].seconds}s · {live[f.id].tokens} tokens · {live[f.id].steps?.filter((x: string) => x === "code_execution_call").length} commands run in its sandbox</div>
                            {live[f.id].fields.map((x: any) => <div key={x.field} className="flex justify-between gap-3 py-0.5"><span className="text-[#6d6579]">{x.field.replace(/_/g, " ")}</span><span className="text-right"><b style={{ color: x.verdict === "still on the page" ? "#2f7a3d" : "#b26a00" }}>{x.verdict}</b> <span className="tabular-nums text-[#8a8296]">{x.agrees}</span></span></div>)}</>)}</div>)}
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
                      {e.action === "keep" && !e.undone && (went.some((w) => w.find === e.find)
                        ? <div className="mt-1 text-[12px] font-bold text-[#2f7a3d]">{tri("You went. A keepsake is on the desk", "你去了。桌上多了一件纪念品", "Fuiste. Hay un recuerdo en el escritorio")}{went.find((w) => w.find === e.find)?.matched ? tri("; it had guessed you would, so a companion moved in", "；它当时猜中了，所以有个小伙伴搬了进来", "; lo había adivinado, así que llegó un compañero") : ""}{tri(".", "。", ".")}</div>
                        : <button onClick={() => { const matched = (guesses.current[e.find] ?? 0) >= 0.5; const n = [...went, { find: e.find, title: e.title, matched }]; setWent(n); try { localStorage.setItem(`gemi.went.${school}`, JSON.stringify(n)); } catch {}
                            append({ id: uid(), at: new Date().toISOString(), type: "room", by: "student", what: `went to "${e.title}"; a keepsake arrived${matched ? " and a companion moved in" : ""}`, item: e.find }); }}
                            className="mt-1.5 rounded-full border-2 bg-[#dff3e6] px-3 py-0.5 text-[12px] font-bold" style={{ borderColor: INK }}>{tri("I went", "我去了", "Fui")}</button>)}
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
          {panel === "tools" && (
            <div className="mt-6">
              <div className="text-xs font-bold uppercase tracking-wider text-[#8a8296]">On its own: what it does when you are away</div>
              <ul className="mt-2 space-y-1.5">{POLICY.map((p) => (
                <li key={p.id} className="rounded-xl border-2 bg-white px-3 py-2 text-xs" style={{ borderColor: now?.rule === p.id ? s.accent : "#d9d0c0", background: now?.rule === p.id ? s.soft : "#fff" }}>
                  <b>When {p.when}</b>{p.then.method ? <span className="ml-1 text-[#8a8296]">→ {p.then.method}{p.then.stars ? `, ${p.then.stars} of its own` : ""}</span> : null}<br /><span className="text-[#5f576c]">{p.then.room}</span></li>))}</ul>
              <div className="mt-5 text-xs font-bold uppercase tracking-wider text-[#8a8296]">What you see in the room, and what it means</div>
              <ul className="mt-2 space-y-1">{SPACE.map((x) => (<li key={x.fact} className="flex justify-between gap-3 border-t border-[#eee6d6] py-1 text-xs"><span><b>{x.shows_as}</b><br /><span className="text-[#8a8296]">{x.fact}</span></span><span className="shrink-0" style={{ color: x.built ? "#2f7a3d" : "#b0a8ba" }}>{x.built ? "live" : "planned"}</span></li>))}</ul>
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

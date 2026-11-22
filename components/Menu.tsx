"use client";
import { useEffect, useRef, useState } from "react";
import { LANGS, type Lang } from "@/lib/i18n";
import { INK } from "@/components/game";

// One menu for the things that are not part of play: language, music, account, and the pages behind the room.
const TRACKS: [string, string][] = [["room-morning", "Room, morning"], ["room-dusk", "Room, dusk"], ["room-night", "Room, night"], ["campus-walk", "Campus walk"], ["campus-autumn", "Campus, autumn"]];
const L: Record<string, Record<Lang, string>> = {
  menu: { en: "Menu", zh: "菜单", es: "Menú" }, language: { en: "Language", zh: "语言", es: "Idioma" }, music: { en: "Music", zh: "音乐", es: "Música" }, off: { en: "Off", zh: "关", es: "No" },
  account: { en: "Account", zh: "账号", es: "Cuenta" }, local: { en: "Kept in this browser only. Sign-in opens later.", zh: "现在只存在这个浏览器里，登录稍后开放。", es: "Solo en este navegador. El acceso llegará después." },
  fresh: { en: "Start over as a new student", zh: "当作新同学重新开始", es: "Empezar de nuevo" },
  outside: { en: "Outside the window", zh: "窗外", es: "Fuera de la ventana" }, now: { en: "Now", zh: "现在", es: "Ahora" },
  clear: { en: "Clear", zh: "晴", es: "Despejado" }, cloudy: { en: "Cloudy", zh: "阴", es: "Nublado" }, rain: { en: "Rain", zh: "雨", es: "Lluvia" }, snow: { en: "Snow", zh: "雪", es: "Nieve" },
  more: { en: "Behind the room", zh: "小屋背后", es: "Detrás del cuarto" }, school: { en: "Change school", zh: "换学校", es: "Cambiar de escuela" },
};
export function Menu({ lang, onLang }: { lang: Lang; onLang: (l: Lang) => void }) {
  const [open, setOpen] = useState(false), [on, setOn] = useState(false), [idx, setIdx] = useState(0), [hour, setHour] = useState<number | null>(null), [weather, setWeather] = useState("clear");
  // The light in the room follows the hour and the weather; this tells the 3D view which to use.
  const amb = (value: Record<string, unknown>) => { for (const f of Array.from(document.querySelectorAll("iframe"))) f.contentWindow?.postMessage({ source: "gemiverse", type: "ambience", value }, "*"); };
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { const a = audio.current; if (!a) return; if (on) { a.src = `/music/${TRACKS[idx][0]}.mp3`; a.loop = true; a.volume = 0.35; a.play().catch(() => {}); } else a.pause(); }, [on, idx]);
  const chip = (on: boolean) => ({ borderColor: INK, background: on ? "#2b2536" : "#fff", color: on ? "#fff" : "#2b2536" });
  const head = "mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-wider text-[#8a8296] first:mt-0";
  return (
    <div className="relative">
      <audio ref={audio} />
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label={L.menu[lang]} title={L.menu[lang]} className="grid h-9 w-9 place-items-center rounded-full border-[3px] bg-[#fffaf0]" style={{ borderColor: INK, boxShadow: `0 3px 0 ${INK}` }}>
        <svg width="18" height="18" viewBox="0 0 24 24" stroke={INK} strokeWidth="3" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg></button>
      {open && (
        <div className="absolute left-0 top-12 z-30 w-72 rounded-3xl border-[3px] bg-[#fffaf0] p-4" style={{ borderColor: INK, boxShadow: `0 6px 0 ${INK}33, 0 14px 30px #0003` }}>
          <div className={head}>{L.language[lang]}</div>
          <div className="flex flex-wrap gap-1.5">{(Object.keys(LANGS) as Lang[]).map((l) => <button key={l} onClick={() => onLang(l)} aria-pressed={l === lang} className="rounded-full border-2 px-3 py-1 text-sm font-bold" style={chip(l === lang)}>{LANGS[l]}</button>)}</div>
          <div className={head}>{L.music[lang]} <span className="font-normal normal-case tracking-normal">· Lyria</span></div>
          <div className="flex items-center gap-3">
            <button role="switch" aria-checked={on} aria-label={L.music[lang]} onClick={() => setOn(!on)} className="relative h-7 w-12 shrink-0 rounded-full border-[3px] transition-colors" style={{ borderColor: INK, background: on ? "#7c4dce" : "#e6dfd0" }}>
              <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: on ? 22 : 3, boxShadow: `0 1px 0 ${INK}` }} /></button>
            <div className="flex min-w-0 flex-1 items-center justify-between rounded-full border-2 bg-white px-1 py-0.5" style={{ borderColor: INK, opacity: on ? 1 : 0.45 }}>
              <button onClick={() => setIdx((idx + TRACKS.length - 1) % TRACKS.length)} aria-label="Previous track" className="grid h-7 w-7 place-items-center rounded-full text-lg font-bold hover:bg-[#f1ebf7]">‹</button>
              <span className="truncate px-1 text-sm font-bold">{TRACKS[idx][1]}</span>
              <button onClick={() => setIdx((idx + 1) % TRACKS.length)} aria-label="Next track" className="grid h-7 w-7 place-items-center rounded-full text-lg font-bold hover:bg-[#f1ebf7]">›</button></div>
          </div>
          <div className={head}>{L.outside[lang]}</div>
          <div className="flex flex-wrap gap-1.5">{([[null, L.now[lang]], [8, "08:00"], [18.2, "18:00"], [22, "22:00"]] as [number | null, string][]).map(([h, t]) => <button key={t} onClick={() => { setHour(h); amb({ hour: h }); }} className="rounded-full border-2 px-2.5 py-0.5 text-[13px] font-bold" style={chip(hour === h)}>{t}</button>)}</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">{(["clear", "cloudy", "rain", "snow"] as const).map((w) => <button key={w} onClick={() => { setWeather(w); amb({ weather: w }); }} className="rounded-full border-2 px-2.5 py-0.5 text-[13px] font-bold" style={chip(weather === w)}>{L[w][lang]}</button>)}</div>
          <div className={head}>{L.account[lang]}</div><p className="text-xs leading-snug text-[#6d6579]">{L.local[lang]}</p>
          <button onClick={() => { try { const sc = localStorage.getItem("gemi.school"); for (const k of Object.keys(localStorage)) if (k.startsWith("gemi.") && k.endsWith(`.${sc}`)) localStorage.removeItem(k); } catch {} location.reload(); }} className="mt-1.5 rounded-full border-2 px-3 py-0.5 text-xs font-bold" style={{ borderColor: INK }}>{L.fresh[lang]}</button>
          <div className={head}>{L.more[lang]}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold underline">{[["/campus", lang === "zh" ? "校园地图" : "Campus map"], ["/", L.school[lang]], ["/meet", "Gemi to Gemi"], ["/foundry", "Foundry"], ["/admin", "Admin"], ["/deck", "Deck"]].map(([h, n]) => <a key={h} href={h}>{n}</a>)}</div>
        </div>)}
    </div>);
}

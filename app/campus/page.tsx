"use client";
import { useEffect, useState } from "react";
import { SCHOOLS, loadSchool } from "@/lib/schools";

// The campus map: a drawn picture of the school's own features. Every label is a place that public text names and the
// Decisions API confirmed; the picture is an illustration, not a survey, and the page says so.
type Mark = { name: string; name_en: string; kind: string; quote: string; passed: boolean; check: number; x?: number; y?: number };
type Places = { map: string | null; source?: string; character?: string | null; landmarks: Mark[] };
const KIND: Record<string, string> = { gate: "校门", lake: "湖", tower: "塔", library: "图书馆", hall: "楼", quad: "庭院", hill: "山", bridge: "桥", stadium: "体育馆", garden: "园", museum: "博物馆", other: "地标" };

export default function Campus() {
  const [id, setId] = useState<string | null>(null), [data, setData] = useState<Places | null>(null), [open, setOpen] = useState<number | null>(null);
  useEffect(() => { const s = new URLSearchParams(location.search).get("school") ?? loadSchool() ?? "pku"; setId(s); fetch(`/api/places?school=${s}`).then((r) => r.json()).then(setData).catch(() => setData({ map: null, landmarks: [] })); }, []);
  const s = id ? SCHOOLS[id] : null, zh = !!s?.group.startsWith("cn"), on = (data?.landmarks ?? []).filter((l) => l.passed && typeof l.x === "number");
  const rest = (data?.landmarks ?? []).filter((l) => !on.includes(l));
  return (
    <main className="min-h-screen bg-[#fbf7ef] px-8 py-6 text-[#2b2536]">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-baseline justify-between">
          <h1 className="text-3xl font-black">{s?.name ?? ""} <span className="text-lg font-bold text-[#8a8296]">{zh ? "校园地图" : "Campus map"}</span></h1>
          <a href="/room" className="rounded-full border-[3px] border-[#2b2536] bg-white px-4 py-1.5 text-sm font-bold">{zh ? "回小屋" : "Back to the room"}</a>
        </div>
        {data && !data.map && <p className="mt-10 text-lg">{zh ? "这所学校的地图还没画好。" : "This school's map has not been drawn yet."}</p>}
        {data?.map && (
          <div className="relative mt-4 overflow-hidden rounded-2xl border-[3px] border-[#2b2536]" style={{ boxShadow: "0 5px 0 #2b253633" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.map} alt={zh ? "手绘校园地图" : "Illustrated campus map"} className="block w-full" />
            {on.map((l, i) => (
              <button key={l.name} onClick={() => setOpen(open === i ? null : i)} className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border-2 border-[#2b2536] px-2.5 py-0.5 text-sm font-bold" style={{ left: `${l.x! * 100}%`, top: `${l.y! * 100}%`, background: open === i ? "#2b2536" : "#fffaf0", color: open === i ? "#fff" : "#2b2536", boxShadow: "0 2px 0 #2b253655" }}>
                {zh ? l.name : l.name_en}</button>))}
            {open !== null && on[open] && (
              <div className="absolute bottom-3 left-3 max-w-md rounded-xl border-[3px] border-[#2b2536] bg-[#fffaf0] p-3 text-sm">
                <div className="font-black">{zh ? on[open].name : on[open].name_en} <span className="font-bold text-[#8a8296]">· {zh ? KIND[on[open].kind] ?? "地标" : on[open].kind}</span></div>
                <div className="mt-1">“{on[open].quote}”</div>
                <div className="mt-1 text-xs text-[#8a8296]">{zh ? "核对" : "Checked"} {Math.round(on[open].check * 100)}% · <a className="underline" href={data.source} target="_blank" rel="noreferrer">{zh ? "出处" : "source"}</a></div>
              </div>)}
          </div>)}
        {data?.map && <p className="mt-3 text-sm text-[#6b6478]">{zh ? "这是一张手绘示意图：地标来自公开资料并逐个核对过，位置和样子是画出来的，不是测绘。" : "An illustration: the landmarks come from public text and were checked one by one; positions and looks are drawn, not surveyed."}{rest.length > 0 && (zh ? ` 没画上去的：${rest.map((l) => l.name).join("、")}。` : ` Not on the picture: ${rest.map((l) => l.name_en).join(", ")}.`)}</p>}
      </div>
    </main>
  );
}

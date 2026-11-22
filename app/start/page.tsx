"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SCHOOLS, saveSchool, type SchoolId } from "@/lib/schools";
import counts from "@/lib/local-counts.json";
import { loadLang } from "@/lib/i18n";

// First meeting, in Chinese or English after the browser's language. The Gemi comes first: a point of light that exists because you came.
// You name it, tell it one thing, and only then choose where the two of you live: one of the nine C9 universities or the US top twenty.
export default function Start() {
  const router = useRouter();
  const [step, setStep] = useState(0), [name, setName] = useState(""), [about, setAbout] = useState(""), [picked, setPicked] = useState<SchoolId | null>(null), [group, setGroup] = useState<"cn" | "us">("cn");
  const [zh, setZh] = useState(false); useEffect(() => { const z = loadLang() === "zh"; setZh(z); setGroup(z ? "cn" : "us"); }, []);
  const T = (c: string, e: string) => (zh ? c : e);
  const call = name.trim() || T("你的 Gemi", "your Gemi");
  function moveIn() { if (!picked) return; saveSchool(picked);
    try { localStorage.setItem(`gemi.me.${picked}`, JSON.stringify({ name: name.trim() || undefined })); if (about.trim()) localStorage.setItem(`gemi.about.${picked}`, about.trim()); if (!localStorage.getItem("gemi.lang")) localStorage.setItem("gemi.lang", SCHOOLS[picked].group.startsWith("cn") ? "zh" : "en"); } catch {}
    router.push("/room"); }
  const glow = step === 0 ? 1 : step === 1 ? 1.3 : 1.6, next = "rounded-full border-[3px] border-[#2b2536] px-8 py-3 text-lg font-semibold text-[#2b2536] transition disabled:opacity-40";
  const list = Object.values(SCHOOLS).filter((s) => s.group.startsWith(group)),   // two tabs only: China (C9 first, then the other 985) and the US (top twenty first, then 21 to 50)
    n = (id: string) => (counts as Record<string, number>)[id] ?? 0;
  return (
    <main className="relative min-h-screen bg-[#faf8f5] text-[#2b2536]">
      <style>{`@keyframes breathe{0%,100%{opacity:.85}50%{opacity:1}}@keyframes drift{0%,100%{transform:translateY(10px)}50%{transform:translateY(-14px)}}`}</style>
      <a href="/" className="absolute left-8 top-6 text-xl font-semibold tracking-tight"><span style={{ color: "#d9891c" }}>Gemi</span><span style={{ color: "#7c4dce" }}>verse</span></a>
      <div className="absolute right-8 top-7 flex gap-2">{[0, 1, 2, 3].map((k) => <span key={k} className="h-2 rounded-full transition-all" style={{ width: k === step ? 28 : 8, background: k <= step ? "#7c4dce" : "#d9d2e3" }} />)}</div>

      {step < 3 && (
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-8 text-center">
          <div className="grid h-28 place-items-center" style={{ animation: "drift 4.5s ease-in-out infinite" }}>
            <div className="rounded-full transition-all duration-700" style={{ width: 14 * glow, height: 14 * glow, animation: "breathe 2.8s ease-in-out infinite", background: "#fff6d6", boxShadow: `0 0 ${10 * glow}px ${4 * glow}px #ffd98a, 0 0 ${34 * glow}px ${14 * glow}px #ffc97788, 0 0 ${80 * glow}px ${34 * glow}px #c8a4ff44` }} />
          </div>
          {step === 0 && (<>
            <h1 className="mt-6 text-5xl font-semibold leading-tight tracking-tight">{zh ? <>因为你来了，<br />这里才有了它。</> : <>It is here<br />because you came.</>}</h1>
            <p className="mt-5 text-xl leading-relaxed text-[#5f576c]">{T("它还没有形状，也不认识你。它会长成一个小小的你，你们一起搭一个宇宙。", "It has no shape yet and does not know you. It will grow into a small you, and the two of you will build a universe.")}</p>
            <button onClick={() => setStep(1)} className={`${next} mt-9`} style={{ background: "#ffe08a" }}>{T("打个招呼", "Say hello")}</button></>)}
          {step === 1 && (<>
            <h1 className="mt-6 text-5xl font-semibold tracking-tight">{T("你想叫它什么？", "What will you call it?")}</h1>
            <p className="mt-4 text-lg text-[#5f576c]">{T("它不是你本人，也不必长得像你。", "It is not you, and it does not have to look like you.")}</p>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value.slice(0, 16))} onKeyDown={(e) => e.key === "Enter" && setStep(2)} placeholder={T("团子", "Mochi")} className="mt-7 w-80 rounded-2xl border-[3px] border-[#2b2536] bg-white px-5 py-3 text-center text-2xl font-semibold outline-none placeholder:text-[#c4bccf] focus:border-[#7c4dce]" />
            <button onClick={() => setStep(2)} className={`${next} mt-7`} style={{ background: "#ffe08a" }}>{T("就叫这个", "That is its name")}</button></>)}
          {step === 2 && (<>
            <h1 className="mt-6 text-5xl font-semibold leading-tight tracking-tight">{zh ? `告诉${call}一件关于你的事。` : `Tell ${call} one thing about you.`}</h1>
            <p className="mt-4 text-lg text-[#5f576c]">{T("什么语言都行。这学期想找什么，或者什么让你累。它只存在这个浏览器里，可以撤回。", "Any language. What you are looking for this term, or what wears you out. It stays in this browser only, and you can take it back.")}</p>
            <textarea autoFocus value={about} onChange={(e) => setAbout(e.target.value.slice(0, 600))} rows={4} placeholder={T("我想找一些能一起动手做东西的人。人太多的场合我会累。", "I want to find people who make things together. Big crowds wear me out.")} className="mt-7 w-full resize-none rounded-2xl border-[3px] border-[#2b2536] bg-white px-5 py-3 text-lg outline-none placeholder:text-[#c4bccf] focus:border-[#7c4dce]" />
            <div className="mt-7 flex gap-3"><button onClick={() => setStep(3)} className="rounded-full border-2 border-[#2b2536] px-6 py-3 text-lg font-semibold">{T("以后再说", "Later")}</button><button onClick={() => setStep(3)} disabled={!about.trim()} className={next} style={{ background: "#ffe08a" }}>{T("它听到了", "It heard you")}</button></div></>)}
        </div>)}

      {step === 3 && (
        <div className="mx-auto max-w-6xl px-8 pb-10 pt-20">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#7c4dce]">{T("然后是你们的宇宙", "Then, your universe")}</p>
          <div className="mt-2 flex items-end justify-between"><h1 className="text-4xl font-semibold tracking-tight">{zh ? `你和${call}住在哪所学校？` : `Where do you and ${call} live?`}</h1>
            <div className="flex rounded-full border-[3px] border-[#2b2536] p-1">{([["cn", T("中国", "China")], ["us", T("美国", "United States")]] as ["cn" | "us", string][]).map(([g, t]) => <button key={g} onClick={() => { setGroup(g); setPicked(null); }} className="rounded-full px-5 py-1.5 text-base font-semibold" style={{ background: group === g ? "#2b2536" : "transparent", color: group === g ? "#fff" : "#2b2536" }}>{t}</button>)}</div></div>
          <div className="mt-6 grid grid-cols-5 gap-3.5">
            {list.map((s) => { const on = picked === s.id, k = n(s.id); return (
              <button key={s.id} onClick={() => setPicked(s.id)} aria-pressed={on} className="overflow-hidden rounded-2xl bg-white text-left transition hover:-translate-y-1" style={{ outline: on ? `4px solid ${s.accent}` : "1px solid #ebe6ee", outlineOffset: on ? 3 : 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.view} alt={s.name} className={`w-full object-cover h-24`} style={{ background: s.soft }} />
                <div className="px-4 py-2.5"><div className="text-[15px] font-semibold leading-tight">{group === "cn" ? s.name : s.short}</div>
                  <div className="mt-0.5 truncate text-[12px] text-[#5f576c]">{s.place}</div>
                  <div className="mt-1 text-[12px] font-semibold" style={{ color: k ? "#2f7a3d" : "#b26a00" }}>{k ? T(`${k} 条核对过的信息`, `${k} checked items`) : T("空间已开放", "Room open")}</div></div></button>); })}
          </div>
          <div className="sticky bottom-0 mt-6 flex items-center justify-between bg-[#faf8f5]/95 py-3"><p className="text-[12.5px] leading-snug text-[#8a8296]">{T("图由 Gemini 的图像模型绘制，不含校徽；排在后面的学校是按所在城市画的示意图，不是真实校景。校园信息来自各校公开页面，逐字段核对后才收录。", "Pictures are drawn by Gemini's image model, with no emblems; for the later schools they show the region, not the real campus. Campus information comes from each school's public pages and is stored only after a field-by-field check.")}</p>
            <button onClick={moveIn} disabled={!picked} className={`${next} ml-6 shrink-0 whitespace-nowrap`} style={{ background: "#ffe08a" }}>{picked ? T(`搬进${SCHOOLS[picked].short}`, `Move in at ${SCHOOLS[picked].short}`) : T("选一所学校", "Choose a school")}</button></div>
        </div>)}
    </main>
  );
}

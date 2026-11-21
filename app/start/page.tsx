"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SCHOOLS, saveSchool, type SchoolId } from "@/lib/schools";

// First meeting. The Gemi comes first: a point of light that exists because you came. You name it, tell it one thing,
// and only then choose where the two of you live. Nothing here leaves the browser.
export default function Start() {
  const router = useRouter();
  const [step, setStep] = useState(0), [name, setName] = useState(""), [about, setAbout] = useState(""), [picked, setPicked] = useState<SchoolId | null>(null);
  const call = name.trim() || "your Gemi";
  function moveIn() {
    if (!picked) return; saveSchool(picked);
    try { localStorage.setItem(`gemi.me.${picked}`, JSON.stringify({ name: name.trim() || undefined })); if (about.trim()) localStorage.setItem(`gemi.about.${picked}`, about.trim()); } catch {}
    router.push("/room");
  }
  const glow = step === 0 ? 1 : step === 1 ? 1.25 : 1.5, next = "rounded-full px-8 py-3 text-lg font-semibold text-[#2b2536] transition disabled:opacity-40";
  return (
    <main className="relative min-h-screen overflow-hidden text-white" style={{ background: "radial-gradient(ellipse at 50% 38%, #4a3a78 0%, #2b2536 55%, #1d1828 100%)" }}>
      <style>{`@keyframes breathe{0%,100%{transform:scale(1);opacity:.92}50%{transform:scale(1.08);opacity:1}}@keyframes drift{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}`}</style>
      <a href="/" className="absolute left-8 top-6 text-xl font-semibold tracking-tight text-white/80">Gemiverse</a>
      <div className="absolute right-8 top-7 flex gap-2">{[0, 1, 2, 3].map((k) => <span key={k} className="h-2 rounded-full transition-all" style={{ width: k === step ? 28 : 8, background: k <= step ? "#ffe08a" : "#ffffff44" }} />)}</div>

      {step < 3 && (
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-8 text-center">
          <div style={{ animation: "drift 5s ease-in-out infinite" }}>
            <div className="rounded-full transition-all duration-700" style={{ width: 150 * glow, height: 150 * glow, animation: "breathe 3.2s ease-in-out infinite",
              background: "radial-gradient(circle at 42% 38%, #fffdf2 0%, #ffe9a8 22%, #ffc977 42%, #c8a4ff66 66%, transparent 74%)", boxShadow: `0 0 ${70 * glow}px ${24 * glow}px #ffd98a55, 0 0 ${160 * glow}px ${60 * glow}px #b89cff33` }} />
          </div>
          {step === 0 && (<>
            <h1 className="mt-12 text-5xl font-semibold leading-tight tracking-tight">Something is here<br />because you came.</h1>
            <p className="mt-5 text-xl leading-relaxed text-white/75">It has no shape yet and knows nothing about you. It will become a small you, and the two of you will build a universe together.</p>
            <button onClick={() => setStep(1)} className={`${next} mt-9`} style={{ background: "#ffe08a" }}>Say hello</button></>)}
          {step === 1 && (<>
            <h1 className="mt-12 text-5xl font-semibold tracking-tight">What will you call it?</h1>
            <p className="mt-4 text-lg text-white/70">It is not you, and it does not have to look like you.</p>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value.slice(0, 16))} onKeyDown={(e) => e.key === "Enter" && setStep(2)} placeholder="Mochi" className="mt-7 w-80 rounded-2xl border-2 border-white/40 bg-white/10 px-5 py-3 text-center text-2xl font-semibold outline-none placeholder:text-white/35 focus:border-[#ffe08a]" />
            <button onClick={() => setStep(2)} className={`${next} mt-7`} style={{ background: "#ffe08a" }}>That is its name</button></>)}
          {step === 2 && (<>
            <h1 className="mt-12 text-5xl font-semibold leading-tight tracking-tight">Tell {call} one thing about you.</h1>
            <p className="mt-4 text-lg text-white/70">Any language. What you are looking for this term, or what tires you. It stays in this browser, and you can take it back.</p>
            <textarea autoFocus value={about} onChange={(e) => setAbout(e.target.value.slice(0, 600))} rows={4} placeholder="I want to find people who build things. Big mixers tire me." className="mt-7 w-full resize-none rounded-2xl border-2 border-white/40 bg-white/10 px-5 py-3 text-lg outline-none placeholder:text-white/35 focus:border-[#ffe08a]" />
            <div className="mt-7 flex gap-3"><button onClick={() => setStep(3)} className="rounded-full border-2 border-white/50 px-6 py-3 text-lg font-semibold">Later</button><button onClick={() => setStep(3)} disabled={!about.trim()} className={next} style={{ background: "#ffe08a" }}>It heard you</button></div></>)}
        </div>)}

      {step === 3 && (
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-8 py-16">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#ffe08a]">Now the universe</p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight">Where do you and {call} live?</h1>
          <div className="mt-9 grid grid-cols-2 gap-6">
            {Object.values(SCHOOLS).map((s) => { const on = picked === s.id; return (
              <button key={s.id} onClick={() => setPicked(s.id)} aria-pressed={on} className="overflow-hidden rounded-3xl bg-white text-left text-[#2b2536] transition hover:-translate-y-1" style={{ outline: on ? "4px solid #ffe08a" : "none", outlineOffset: 3 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.view} alt={`An illustrated view of ${s.place}`} className="h-56 w-full object-cover" />
                <div className="px-6 py-4"><div className="text-2xl font-semibold">{s.short}</div><div className="mt-0.5 text-sm text-[#5f576c]">{s.place} · {s.line}</div></div></button>); })}
          </div>
          <div className="mt-8 flex items-center justify-between"><p className="text-sm text-white/60">More campuses opening soon.</p>
            <button onClick={moveIn} disabled={!picked} className={next} style={{ background: "#ffe08a" }}>{picked ? `Move in at ${SCHOOLS[picked].short}` : "Choose a campus"}</button></div>
        </div>)}
    </main>
  );
}

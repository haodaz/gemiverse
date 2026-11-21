"use client";

import { useEffect, useState } from "react";
import proof from "@/lib/proof.json";

// Concept cards for the one-minute film: one idea a card, few words, readable at a glance. /film?c=budget|check|chart|deeds
const INK = "#2b2536", PUR = "#7c4dce", MUTE = "#8a8296";
const PG = proof.pages.overall as any;
const Eyebrow = ({ children }: { children: React.ReactNode }) => <p className="text-[22px] font-bold uppercase tracking-[0.28em]" style={{ color: MUTE }}>{children}</p>;
const Title = ({ children }: { children: React.ReactNode }) => <h1 className="mt-5 text-[5.2rem] font-semibold leading-[1.04] tracking-tight">{children}</h1>;

export default function Film() {
  const [c, setC] = useState("");
  useEffect(() => { setC(new URLSearchParams(location.search).get("c") ?? "budget"); }, []);
  return (
    <main className="grid h-screen place-items-center overflow-hidden bg-[#faf8f5] px-24 text-[#2b2536]">
      {c === "cover" && (<div className="fixed inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/art/film/touch-red2.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, #1d1828f2 0%, #1d1828cc 30%, #1d182866 46%, #1d182800 62%)" }} />
        <div className="absolute inset-y-0 left-0 flex w-[46%] flex-col justify-center pl-24 text-white">
          <p className="text-[20px] font-bold uppercase tracking-[0.3em] text-[#e8dcff]">Gemini 4 NYC Hackathon · 5 Sigma</p>
          <h1 className="mt-5 text-[8.2rem] font-semibold leading-none tracking-tight"><span style={{ color: "#ffe08a" }}>Gemi</span><span style={{ color: "#d9c8ff" }}>verse</span></h1>
          <p className="mt-7 text-[2.5rem] font-semibold leading-tight text-[#ffe08a]">Meet your Gemi,<br />and build a universe together.</p>
        </div></div>)}

      {c === "budget" && (<div className="w-full max-w-[1300px]"><Eyebrow>Why a small budget</Eyebrow><Title>Your day has limits.<br />So does its day.</Title>
        <div className="mt-12 grid grid-cols-2 gap-10">
          <div className="rounded-[32px] border-[4px] bg-white p-9" style={{ borderColor: INK }}><p className="text-3xl font-semibold">You</p>
            <div className="mt-5 flex gap-[5px]">{Array.from({ length: 24 }, (_, k) => <span key={k} className="h-12 flex-1 rounded-md" style={{ background: k < 8 ? "#d8d4dc" : k < 17 ? "#a8d4ff" : "#ffd6e0" }} />)}</div><p className="mt-4 text-2xl" style={{ color: MUTE }}>24 hours, and only so much attention</p></div>
          <div className="rounded-[32px] border-[4px] bg-white p-9" style={{ borderColor: INK }}><p className="text-3xl font-semibold">Your Gemi</p>
            <div className="mt-5 flex gap-3">{Array.from({ length: 10 }, (_, k) => <svg key={k} viewBox="0 0 24 24" className="h-12 flex-1"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.900 20.600l1.400-6.800L2.200 9.100l6.900-.8z" fill={k < 6 ? "#ffd24a" : "#b89cff"} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" /></svg>)}</div><p className="mt-4 text-2xl" style={{ color: MUTE }}>10 Gem Stars a day. Real tokens.</p></div>
        </div><p className="mt-10 text-center text-[2.6rem] font-semibold" style={{ color: PUR }}>So it has to choose what matters.</p></div>)}

      {c === "check" && (<div className="grid w-full max-w-[1300px] grid-cols-[1fr_1.05fr] items-center gap-14"><div><Eyebrow>One rule</Eyebrow><Title>Miss rather<br />than be wrong.</Title><p className="mt-8 text-[2rem] leading-snug" style={{ color: "#5f576c" }}>Every detail is checked against the page it came from. If it cannot be checked, it is not shown.</p></div>
        <div className="rounded-[32px] border-[4px] bg-white p-8" style={{ borderColor: INK, boxShadow: `0 10px 0 ${INK}22` }}><p className="text-[1.9rem] font-semibold leading-tight">Prompt Clinic: From Bad Prompts to Better Results</p>
          {/* Real fields of entity nyu-11 in the shared base, with the gate's confidence. Below 0.8 a field is not shown. */}
          {[["Starts", "Thu, Dec 3 · 1:00 PM", "found on the page · 0.97", true], ["Where", "SPARK Lab, Bobst Library", "found on the page · 0.96", true], ["Sign-up", "required", "found on the page · 0.98", true], ["Ends", "not shown", "the check came back 0.70, under the bar of 0.80", false]].map(([k, v, q, ok]) => (
            <div key={k as string} className="mt-5 flex items-center gap-5 border-t-2 pt-5" style={{ borderColor: "#ebe6ee", opacity: ok ? 1 : 0.55 }}>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-2xl font-bold text-white" style={{ background: ok ? "#2f9e8f" : "#b9b2c4" }}>{ok ? "✓" : "–"}</span>
              <span className="w-28 text-xl font-bold uppercase tracking-wider" style={{ color: MUTE }}>{k}</span><span className="flex-1"><span className="block text-[1.7rem] font-semibold">{v}</span><span className="block text-lg" style={{ color: MUTE }}>{q}</span></span></div>))}</div></div>)}

      {c === "chart" && (<div className="grid w-full max-w-[1300px] grid-cols-[1fr_1fr] items-end gap-16"><div className="pb-10"><Eyebrow>On pages we did not pick</Eyebrow><Title>{proof.pages.n} pages.<br />6 universities.</Title><p className="mt-8 text-[2rem] leading-snug" style={{ color: "#5f576c" }}>Share of facts shown that were wrong.</p><p className="mt-5 text-2xl" style={{ color: MUTE }}>Our first run lost, at 9.6%. We kept the record.</p></div>
        <div className="flex h-[66vh] items-end justify-center gap-16 border-b-[5px] pb-0" style={{ borderColor: INK }}>
          {[[PG.baseline.error_rate, "One AI call", "#b9b2c4"], [PG.system_v2.error_rate, "Gemiverse", PUR]].map(([v, l, col]) => (
            <div key={l as string} className="flex w-56 flex-col items-center justify-end" style={{ height: "100%" }}><span className="mb-3 text-[4.6rem] font-semibold leading-none" style={{ color: col as string }}>{((v as number) * 100).toFixed(1)}%</span>
              <div className="w-full rounded-t-3xl" style={{ height: `${((v as number) / 0.1) * 78}%`, background: col as string }} /><span className="absolute translate-y-14 text-3xl font-semibold">{l}</span></div>))}</div></div>)}

      {c === "under" && (<div className="grid w-full max-w-[1400px] grid-cols-[1fr_1.05fr] items-center gap-12"><div><Eyebrow>It looks simple</Eyebrow><Title>Underneath,<br />built today:</Title>
          <pre className="mt-8 overflow-hidden rounded-3xl bg-[#2b2536] px-7 py-6 font-mono text-[19px] leading-relaxed text-[#fdf6e3]">{`post("/interactions", {
  agent: "antigravity-preview-09-2026",
  environment: { type: "remote" },
  input: "Fetch this page and read it" })

post("/decisions", {
  model: "gemini-decision-1",
  questions: { start: { type: "noul", ... } } })`}</pre></div>
        <div className="space-y-3">{[["A shared base", "designed by Gemini 4 Carbon · 467 checked entities", "#c8b4f0"], ["A gate on every field", "Decisions API · confidence checked in code", "#a8d4ff"], ["A mind with uncertainty", "seven axes · one update rule · undo", "#a8e0c0"], ["Autonomy under rules", "12 policy rows · 14 governed tools · real tokens", "#ffe08a"], ["A Managed Agent", "goes back to the source, live, in a sandbox", "#ffd6e0"]].map(([t, d, col]) => (
          <div key={t} className="rounded-3xl border-[4px] px-7 py-4" style={{ borderColor: INK, background: col }}><p className="text-[2.1rem] font-semibold leading-tight">{t}</p><p className="text-[1.35rem]" style={{ color: "#4a4356" }}>{d}</p></div>))}</div></div>)}

      {c === "deeds" && (<div className="w-full max-w-[1300px]"><div className="grid grid-cols-2 gap-12">
        {[["论迹", "by its deeds", "To act, it needs a space it can change.", PUR], ["论心", "by its mind", "To have a mind, it needs a world it can sense.", "#2f9e8f"]].map(([zh, en, line, col]) => (
          <div key={zh} className="rounded-[36px] border-[4px] bg-white p-12" style={{ borderColor: INK }}><div className="flex items-baseline gap-6"><span className="text-[9rem] font-bold leading-none" style={{ color: col }}>{zh}</span><span className="text-3xl font-semibold" style={{ color: MUTE }}>{en}</span></div>
            <p className="mt-10 text-[3rem] font-semibold leading-[1.15]">{line}</p></div>))}</div>
        <p className="mt-12 text-center text-[2.4rem] font-semibold" style={{ color: MUTE }}>A room is the first. A campus is the second.</p></div>)}
    </main>
  );
}

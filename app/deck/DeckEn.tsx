"use client";

import { useEffect, useState, type ReactNode } from "react";
import { INK } from "@/components/game";
import { LineChart, Bars } from "@/components/charts";
import proof from "@/lib/proof.json";
import Banner from "./Banner";
import { step, type Tier } from "@/lib/mind";
import { POLICY } from "@/lib/kernel/autonomy";
import { TOOLS } from "@/lib/kernel/tools";

// The deck is a page of the product itself, so its pictures are the live 3D room and character, not screenshots.
const Live = ({ src, className = "" }: { src: string; className?: string }) => <iframe src={src} title="live" className={`h-full w-full border-0 bg-transparent ${className}`} loading="lazy" />;
const Frame = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`overflow-hidden rounded-[28px] border-[3px] bg-[#fffaf0] ${className}`} style={{ borderColor: INK, boxShadow: `0 8px 0 ${INK}22` }}>{children}</div>);
const Tag = ({ children, c = "#c8b4f0" }: { children: ReactNode; c?: string }) => <span className="mr-2 inline-block rounded-full border-2 px-3 py-0.5 text-sm font-bold" style={{ borderColor: INK, background: c }}>{children}</span>;
const Eyebrow = ({ children }: { children: ReactNode }) => <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#8a8296]">{children}</p>;
const H = ({ children }: { children: ReactNode }) => <h1 className="mt-3 text-[2.9rem] font-bold leading-[1.08] tracking-tight">{children}</h1>;
const P = ({ children }: { children: ReactNode }) => <p className="mt-4 text-xl leading-relaxed text-[#4a4356]">{children}</p>;
const Li = ({ children }: { children: ReactNode }) => <li className="flex gap-3 py-1.5 text-lg leading-snug"><span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: "#7c4dce" }} /><span>{children}</span></li>;
const Cell = ({ children, head, w }: { children: ReactNode; head?: boolean; w?: string }) => <td className={`border-t-2 px-4 py-3.5 align-top ${head ? "text-xs font-bold uppercase tracking-wider text-[#8a8296]" : "text-[19px] leading-snug"}`} style={{ borderColor: "#e6dfd0", width: w }}>{children}</td>;


const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const PUR = "#7c4dce", GREY = "#b9b2c4", GOLD = "#e0a526", TEAL = "#2f9e8f", RED = "#d9534f";
const L = proof.listings.overall as any, PG = proof.pages.overall as any, P1 = proof.pagesRun1.overall as any;
const TPP = { base: proof.pages.tokens.baseline / proof.pages.n, sys: proof.pages.tokens.system_v2 / proof.pages.n };   // tokens per page, measured
const TIERS: [Tier, string, string][] = [["self_reported", "said it", GREY], ["checked", "chose it (checked)", GOLD], ["seen_over_time", "seen over time", TEAL], ["actually_done", "actually did it", PUR]];
const haloCurve = (t: Tier) => { let b = { m: 0, u: 1 }; const pts: [number, number][] = [[0, 1]]; for (let k = 1; k <= 10; k++) { b = step(b, b.m, t); pts.push([k, b.u]); } return pts; };
const Box = ({ children, c = "#fffaf0", className = "" }: { children: ReactNode; c?: string; className?: string }) => <div className={`rounded-2xl border-2 px-4 py-3 ${className}`} style={{ borderColor: INK, background: c }}>{children}</div>;
const Stat = ({ v, l, c = "#fff" }: { v: string; l: string; c?: string }) => <div className="rounded-2xl border-2 px-3 py-3 text-center" style={{ borderColor: INK, background: c }}><div className="text-3xl font-bold tabular-nums">{v}</div><div className="mt-1 text-xs leading-tight text-[#6d6579]">{l}</div></div>;
const F = ({ children }: { children: ReactNode }) => <div className="my-2 rounded-xl bg-[#2b2536] px-4 py-2.5 font-mono text-[15px] leading-relaxed text-[#fdf6e3]">{children}</div>;
const LAYERS: [string, string, string, string][] = [
  ["7 · The room you see", "A 3D room, a character, three cards on a desk.", "Neon wrote the 3D", "#ffd6e0"],
  ["6 · Projection", "16 rules: one fact of state shows as one thing in the room. Nothing in the room is decoration by accident.", "12 of 16 built", "#ffe08a"],
  ["5 · Autonomy and governance", "A first-match policy over measured state; 14 registered methods, two purses, stages, confirm, kill switch.", "12 policy rows, in code", "#c8e6a0"],
  ["4 · Mind", "Seven axes, each a position and an uncertainty. One update rule; evidence weighted by how it was earned. Append-only log, replay to undo.", "Carbon cut 9 axes to 7", "#a8e0c0"],
  ["3 · The gate", "One Decisions question per field against the source. Below 0.8 it is withheld, and shown as withheld.", `${pct(PG.system_v2.error_rate)} error on unseen pages`, "#a8d4ff"],
  ["2 · The shared base", "Entities, links, evidence with source tier and quote. Designed by Carbon and a second designer in parallel, then merged.", "166 entities, 420 checked fields", "#c8b4f0"],
  ["1 · Public pages", "Static pages and public JSON feeds of six universities. Hidden text, missing years, bot walls.", "202 pages read today", "#e6dfd0"],
];
const MAP: [string, string, string, string][] = [
  ["Finds not yet looked at", "Cards fanned on the desk", "Things someone found for you that you have not read", "Gemi puts · you clear"],
  ["Finds you kept", "Cards pinned to the corkboard", "Your shortlist", "you"],
  ["Gem Stars left today", "Gold and lilac stars in two jars", "The time and attention left in a day", "Gemi spends"],
  ["Stars saved over days", "The lilac jar fills past one day", "Saving up for something bigger", "Gemi"],
  ["Uncertainty about you", "Its face; where it stands; what it asks", "Not knowing someone well yet", "your choices"],
  ["Where furniture stands", "The floor grid", "Your space, your arrangement", "you move · Gemi notices"],
  ["Growth stage", "Trophies on the shelf", "What was actually done, not time spent", "outcomes"],
  ["Out on campus", "The room is empty, door ajar", "Being somewhere else", "Gemi"],
];

export default function Deck({ onLang }: { onLang?: () => void }) {
  const [i, setI] = useState(0);
  const imp = (id: string) => (proof.improvements as any[]).find((x) => x.id === id);

  const slides: { id: string; body: ReactNode }[] = [
    { id: "Gemiverse", body: (
      <div className="flex h-full flex-col">
        <div className="flex items-end justify-between gap-10"><div><Eyebrow>Gemini 4 NYC Hackathon · Track 1, 5 Sigma · built today</Eyebrow><h1 className="mt-2 text-[4.6rem] font-bold leading-none tracking-tight">Gemiverse</h1></div>
          <p className="max-w-[46%] pb-2 text-xl leading-relaxed text-[#4a4356]">Every college student gets a <b>Gemi</b>. It enters a space, and day by day its picture of you gains dimensions. The tokens it spends each day are few; what they buy stays.</p></div>
        <div className="mt-4 min-h-0 flex-1"><Banner /></div>
        <p className="mt-3 text-center text-2xl font-bold" style={{ color: "#7c4dce" }}>It would rather miss than be wrong.</p>
      </div>) },

    { id: "The task", body: (
      <div className="grid h-full grid-cols-[1.15fr_1fr] items-center gap-12">
        <div><Eyebrow>Track 1 · 5 Sigma · the task</Eyebrow><H>Tell a student what is on. Never tell them something false.</H>
          <P>It sounds like a lookup. Today&apos;s agents fail at it in three ways we measured:</P>
          <ul className="mt-3"><Li><b>They read what no person sees.</b> Every registration form on these pages hides a line saying &ldquo;this is an online event&rdquo;. A single model call called {P1.baseline.wrong} of {proof.pages.facts} facts wrong on the raw pages.</Li>
            <Li><b>They fill gaps.</b> On ten unseen pages a single call showed 29 of 103 fields with no support on the page: an invented end time, the wrong year.</Li>
            <Li><b>They cannot get in.</b> The big calendars answer scripts with a wall; 9 of our first 25 pages returned nothing usable.</Li></ul>
          <p className="mt-6 text-2xl font-bold" style={{ color: PUR }}>A wrong room or a wrong day costs a student an evening. So: miss rather than be wrong.</p></div>
        <div><div className="grid grid-cols-2 gap-3"><Stat v={pct(P1.baseline.error_rate)} l="single call, raw pages, six universities" c="#ffe1df" /><Stat v={pct(PG.system_v2.error_rate)} l="our system, same pages" c="#dff3e6" />
          <Stat v="29 / 103" l="unsupported fields shown, single call" c="#ffe1df" /><Stat v="0 / 76" l="unsupported fields shown, ours" c="#dff3e6" /></div>
          <p className="mt-4 text-[15px] text-[#8a8296]">We are not at five sigma. We built what makes the error rate measurable and pushes it down.</p></div>
      </div>) },

    { id: "Simple outside", body: (
      <div className="grid h-full grid-cols-[1fr_1.35fr] items-center gap-8">
        <div className="flex h-full flex-col"><Eyebrow>It looks simple. It is not.</Eyebrow><H>It grows from the bottom up.</H>
          <p className="mt-3 text-lg text-[#4a4356]">Built in this order, bottom first. Each layer is the projection of the one below it; the room is only the top.</p>
          <div className="min-h-0 flex-1"><Live src="/gen3d/viewer.html?embed=1&bare=1&school=nyu" /></div></div>
        <div className="space-y-1.5">{LAYERS.map(([name, what, num, c]) => (
          <div key={name} className="grid grid-cols-[190px_1fr_170px] items-center gap-3 rounded-xl border-2 px-3 py-2" style={{ borderColor: INK, background: c }}>
            <b className="text-[15px]">{name}</b><span className="text-[14px] leading-snug">{what}</span><span className="text-right text-[12.5px] font-bold">{num}</span></div>))}
          <p className="pt-2 text-[14px] text-[#8a8296]">Gemini designed layers 2 and 4 before any screen existed. A second designer worked in parallel; both drafts and the merge are in the repo, nothing overwritten.</p></div>
      </div>) },

    { id: "Baseline", body: (
      <div className="h-full"><Eyebrow>Question 1 · the baseline, and how much better</Eyebrow><H>Against one model call on the same pages.</H>
        <div className="mt-4 grid grid-cols-[1.25fr_1fr] gap-10">
          <div><Bars yMax={0.1} yLabel="wrong facts shown / facts shown" fmt={(v) => `${(v * 100).toFixed(1)}%`} h={330} groups={[
            { label: `Listings · ${proof.listings.facts} facts`, bars: [{ name: "baseline", value: L.baseline.error_rate, color: GREY }, { name: "ours", value: L.v3.error_rate, color: PUR }] },
            { label: `Raw pages, first run · ${proof.pages.facts} facts`, bars: [{ name: "baseline", value: P1.baseline.error_rate, color: GREY }, { name: "ours", value: P1.system.error_rate ?? P1.system_v1?.error_rate, color: RED }] },
            { label: "Raw pages, after the fix", bars: [{ name: "baseline", value: PG.baseline.error_rate, color: GREY }, { name: "base+reader", value: PG.baseline_visible.error_rate, color: "#8f879c" }, { name: "ours", value: PG.system_v2.error_rate, color: PUR }] }]} /></div>
          <div className="text-[17px] leading-relaxed">
            <p><b>Baseline:</b> Gemini 4 Argon, one call, the page text in, the five facts out. No structure, no check.</p>
            <p className="mt-3"><b>Ours:</b> Hydrogen fills a structure Carbon designed; the Decisions API answers one question per field against the source; a rule in code resolves the year.</p>
            <p className="mt-3"><b>The first run lost.</b> {pct(P1.system?.error_rate ?? P1.system_v1?.error_rate)} against {pct(P1.baseline.error_rate)}. The gate confirmed hidden text, because the words were there. We show that bar.</p>
            <p className="mt-3"><b>After the fix:</b> {pct(PG.system_v2.error_rate)} against {pct(PG.baseline.error_rate)}, with coverage {pct(PG.system_v2.coverage)}. Give the baseline our reader and it reaches {pct(PG.baseline_visible.error_rate)}: most of the gain is the reader; the gate&apos;s own margin is on places, 6 wrong against 12.</p>
            <p className="mt-3 text-[15px] text-[#8a8296]">Cost: {Math.round(TPP.sys)} tokens a page against {Math.round(TPP.base)}. Next slide says who pays.</p></div>
        </div>
      </div>) },

    { id: "Test set", body: (
      <div className="h-full"><Eyebrow>Question 2 · the test set</Eyebrow><H>Pages we did not pick, truth we did not write.</H>
        <div className="mt-5 grid grid-cols-[1fr_1.1fr] gap-10">
          <div><div className="grid grid-cols-3 gap-3"><Stat v={String(proof.pages.n)} l="raw event pages" /><Stat v="6" l="universities; 5 never seen while designing" /><Stat v={String(proof.pages.edge_pages)} l="pages with an edge case" /></div>
            <Bars yMax={32} yLabel="pages" h={230} groups={Object.entries(proof.pages.schools).map(([k, v]) => ({ label: k, bars: [{ name: "", value: v as number, color: k === "NYU" ? PUR : TEAL }] }))} />
            <p className="text-[14px] text-[#8a8296]">Plus {proof.listings.n} NYU listings ({proof.listings.facts} facts), and a ten-page exam set held back from the design step.</p></div>
          <table className="w-full self-start"><tbody>
            <tr><Cell head w="34%">Rule</Cell><Cell head>How it is kept</Cell></tr>
            <tr><Cell><b>Inputs are not ours</b></Cell><Cell>Every upcoming event the library calendars of six universities returned, in feed order. No hand picking.</Cell></tr>
            <tr><Cell><b>Truth is independent</b></Cell><Cell>The answer key is the calendar&apos;s own structured fields (date, start, end, place, online). The systems only see the rendered page.</Cell></tr>
            <tr><Cell><b>Messy on purpose</b></Cell><Cell>Recurring events, no location, online only, multi-day, cancelled, missing year, text the page hides.</Cell></tr>
            <tr><Cell><b>Scoring fixed first</b></Cell><Cell>Same scorer for every arm. Withheld counts against coverage, never as right.</Cell></tr>
            <tr><Cell><b>Live inputs too</b></Cell><Cell>Voice notes and posters from this room go through the same gate on stage.</Cell></tr>
          </tbody></table>
        </div>
      </div>) },

    { id: "Failures", body: (
      <div className="h-full"><Eyebrow>Question 3 · what failed, and what we changed</Eyebrow><H>Before, how, after.</H>
        <table className="mt-4 w-full"><tbody>
          <tr><Cell head w="27%">What we saw</Cell><Cell head w="17%">Before</Cell><Cell head w="31%">What we changed</Cell><Cell head>After</Cell></tr>
          {["hidden-text", "year-never-printed", "gate-asked-in-24h", "labels-vs-facts", "seal-not-checkable", "sources-blocked"].map((id) => { const x = imp(id); return (
            <tr key={id}>{[x.saw, x.before, x.how, x.after].map((t: string, k: number) => <td key={k} className="border-t-2 px-3 py-2 align-top text-[14.5px] leading-snug" style={{ borderColor: "#e6dfd0", fontWeight: k === 3 ? 700 : 400 }}>{t.length > 190 ? t.slice(0, 188) + "…" : t}</td>)}</tr>); })}
        </tbody></table>
        <p className="mt-3 text-[15px] text-[#8a8296]">{proof.improvements.length} corrections are logged with evidence files in <code>base/runs/improvements.json</code>. Three of them were our measurement being wrong, not the system.</p>
      </div>) },

    { id: "Still fails", body: (
      <div className="grid h-full grid-cols-[1.2fr_1fr] items-center gap-10">
        <div><Eyebrow>Question 3 · where it still fails</Eyebrow><H>{PG.system_v2.wrong} facts still wrong. Here they are.</H>
          <table className="mt-4 w-full"><tbody>
            <tr><Cell head w="16%">Where</Cell><Cell head w="14%">Fact</Cell><Cell head w="36%">We showed</Cell><Cell head>The calendar says</Cell></tr>
            {[0, 1, 9, 13].map((k) => { const w = (proof.pages.still_wrong as any[])[k]; return w ? (<tr key={k}><Cell>{w.school}</Cell><Cell>{w.field}</Cell><Cell>{String(w.shown)}</Cell><Cell>{String(w.truth)}</Cell></tr>) : null; })}
          </tbody></table>
          <ul className="mt-4"><Li><b>12 of 18</b> are recurring Penn and Duke events called online. We have not found the cause yet.</Li>
            <Li><b>4 of 18</b> are Duke rooms we read from the description while the calendar field says &ldquo;Other&rdquo;. We left them counted as wrong.</Li>
            <Li>Coverage on the first listings run was 54.6%: a gate that is too strict is also a failure.</Li></ul></div>
        <div><p className="text-sm font-bold uppercase tracking-wider text-[#8a8296]">Outside the numbers</p>
          <ul className="mt-2"><Li>Columbia records never reached the listings test.</Li><Li>Trips read the checked base; live browsing by the Managed Agent is not wired.</Li><Li>The learning side is measured on a simulated student only. Day one: 2 of 6 sealed guesses right.</Li><Li>Three generated faces were rejected; the face is hand-painted.</Li></ul></div>
      </div>) },

    { id: "Tokens keep paying", body: (
      <div className="h-full"><Eyebrow>Why the cost is worth it</Eyebrow><H>A token spent once keeps paying.</H>
        <div className="mt-4 grid grid-cols-[1.2fr_1fr] gap-10">
          <LineChart logX xMax={1000} yMax={2600} h={340} xLabel="students whose Gemi reads the same page" yLabel="tokens per student, per page" xTicks={[1, 3, 10, 100, 1000]} yTicks={[0, 500, 1000, 1500, 2000, 2500]} series={[
            { name: "one call each, unchecked", color: GREY, dash: true, points: [[1, TPP.base], [1000, TPP.base]] },
            { name: "checked, each on their own", color: RED, dash: true, points: [[1, TPP.sys], [1000, TPP.sys]] },
            { name: "checked once, shared", color: PUR, points: [1, 2, 3, 5, 10, 30, 100, 300, 1000].map((n) => [n, TPP.sys / n] as [number, number]) }]} />
          <div className="text-[17px] leading-relaxed">
            <F>cost(n) = c_check / n + c_recheck<br />c_check = {Math.round(TPP.sys)} tokens (measured)<br />c_recheck = 0 if the page fingerprint is unchanged</F>
            <p className="mt-3">Checking costs {(TPP.sys / TPP.base).toFixed(1)} times one unchecked call. From the <b>third student</b> on, the checked fact is cheaper than the unchecked one, and it stays in the base.</p>
            <p className="mt-3">A poster one student shows is checked and joins the base for everyone. What is shared is the fact, never who asked for it.</p>
            <p className="mt-3"><b>Why a vertical:</b> inside one campus, sources are official, entities repeat, one design fits. On the open web n stays near 1.</p></div>
        </div>
      </div>) },

    { id: "Scarcity", body: (
      <div className="grid h-full grid-cols-[1.1fr_1fr] items-center gap-10">
        <div><Eyebrow>Why we give the Gemi a limited budget, and let it play out on its own</Eyebrow><H>Find treasure. Do not pile up junk.</H>
          <P>A person&apos;s day has finite time, energy and attention. A Gemi&apos;s day has a finite number of Gem Stars, and they are real tokens. Same shape, so its choices map onto a real day.</P>
          <ul className="mt-3"><Li><b>Scarcity forces the question that matters:</b> what is worth doing today? With no limit, an agent brings back a thousand events and calls it help.</Li>
            <Li><b>Not every student owns unlimited compute.</b> We count what a token bought, not how many were burned.</Li>
            <Li><b>It may choose not to spend.</b> It can save for days toward one larger thing: a song costs 6, a new space 12.</Li>
            <Li><b>Then we let it run.</b> Each day it plans, spends, saves and writes down why, with nobody steering. A limit is what makes that worth watching, and safe to allow.</Li>
            <Li><b>What you ask for is free.</b> Stars are only for what it decides to do on its own.</Li></ul></div>
        <table className="w-full"><tbody>
          <tr><Cell head w="46%">In a real day</Cell><Cell head>In the Gemiverse</Cell></tr>
          <tr><Cell>Hours, energy, attention</Cell><Cell>Gem Stars, in two purses: for you, for itself</Cell></tr>
          <tr><Cell>Deciding what matters most</Cell><Cell>The gap rule: spend where you care and it knows least</Cell></tr>
          <tr><Cell>Three things worth your evening</Cell><Cell>Three finds per trip, each field checked</Cell></tr>
          <tr><Cell>Saving up</Cell><Cell>A jar that fills across days</Cell></tr>
          <tr><Cell>Doing nothing today</Cell><Cell>A policy row: rest, save, or potter, for 0 stars</Cell></tr>
        </tbody></table>
      </div>) },

    { id: "Mind", body: (
      <div className="h-full"><Eyebrow>The mind space · three small pieces of mathematics</Eyebrow><H>What it believes about you is a number with a width.</H>
        <div className="mt-3 grid grid-cols-[1.1fr_1fr] gap-10">
          <div><LineChart xMax={10} yMax={1} h={320} xLabel="pieces of evidence on one axis" yLabel="uncertainty (the halo)" xTicks={[0, 2, 4, 6, 8, 10]} yTicks={[0, 0.25, 0.5, 0.75, 1]} series={TIERS.map(([t, name, color]) => ({ name, color, points: haloCurve(t) }))} />
            <p className="text-[14px] text-[#8a8296]">Curves computed from the code that runs in the room (<code>lib/mind.ts</code>). Words alone never take the halo below 0.55.</p></div>
          <div className="text-[16px] leading-snug">
            <b>1 · Update.</b> Seven axes of how you choose. Evidence is weighted by how it was earned.
            <F>k = u² / (u² + noise[tier])<br />m ← m + k (x − m) &nbsp; u ← √((1 − k) u²)<br />noise: said 2.5 · chose 1.0 · over time 0.45 · did 0.22</F>
            A choice outside the halo widens it: surprise makes it less sure, not more.
            <p className="mt-3"><b>2 · Where to look next.</b></p>
            <F>gap(axis) = care(axis) × u(axis)<br />bring back two finds at opposite ends of argmax gap</F>
            Whichever you keep, it learns something.
            <p className="mt-3"><b>3 · A guess it cannot change afterwards.</b></p>
            <F>h = SHA-256(nonce ‖ guess), sent before you choose<br />after: reveal nonce and guess; your browser recomputes h</F>
          </div>
        </div>
      </div>) },

    { id: "Projection", body: (
      <div className="grid h-full grid-cols-[1.5fr_1fr] items-center gap-8">
        <div><Eyebrow>Spatial projection</Eyebrow><H>One state, one object, one real-world meaning.</H>
          <table className="mt-3 w-full"><tbody>
            <tr><Cell head w="22%">State (a number)</Cell><Cell head w="26%">In the room</Cell><Cell head w="30%">What it maps to in life</Cell><Cell head>Who changes it</Cell></tr>
            {MAP.map((r) => <tr key={r[0]}>{r.map((t, k) => <td key={k} className="border-t-2 px-3 py-1.5 align-top text-[14.5px] leading-snug" style={{ borderColor: "#e6dfd0", fontWeight: k === 0 ? 700 : 400 }}>{t}</td>)}</tr>)}
          </tbody></table>
          <p className="mt-3 text-[15px] leading-snug text-[#4a4356]"><b>Why the mapping matters:</b> the Gemi and the student act on the same space, and each sees what the other did. Because every object stands for one measured thing with a real-world counterpart, a change to the room is a change to state that the policy can reason about. Decisions stay stable because nothing in the room is free-floating.</p></div>
        <div className="h-[80vh]"><Live src="/gen3d/viewer.html?embed=1&bare=1&school=columbia" /></div>
      </div>) },

    { id: "Autonomy", body: (
      <div className="h-full"><Eyebrow>Autonomy under rules</Eyebrow><H>What it does when nobody is telling it what to do.</H>
        <div className="mt-3 grid grid-cols-[1.5fr_1fr] gap-8">
          <table className="w-full"><tbody>
            <tr><Cell head w="5%">#</Cell><Cell head w="50%">When (first match wins)</Cell><Cell head w="25%">It does</Cell><Cell head>Costs it</Cell></tr>
            {POLICY.map((r, k) => <tr key={r.id}>{[String(k + 1), r.when, r.then.method ?? r.then.state, r.then.stars ? `${r.then.stars} Gem Stars` : "0"].map((t, j) => <td key={j} className="border-t px-3 py-[5px] align-top text-[13.5px] leading-snug" style={{ borderColor: "#e6dfd0", fontFamily: j === 2 ? "ui-monospace, monospace" : undefined }}>{t}</td>)}</tr>)}
          </tbody></table>
          <div className="space-y-2.5 text-[15px] leading-snug">
            <Box c="#fff"><b>A policy over measured state, not a mood.</b> The table on the left is the code that runs (<code>lib/kernel/autonomy.ts</code>).</Box>
            <Box c="#fff"><b>Governance kernel.</b> Only registered methods. Charged before the call. Daily caps. A stage it must have reached. Some need your confirmation. A pause that beats every row.</Box>
            <Box c="#fff"><b>Three modes.</b> Think (plan, guess, diary). Act (go out, check, ask). Make (decorate, compose, build); anything it writes as code is scanned before it runs.</Box>
            <Box c="#fff"><b>It sees what you do.</b> Move its furniture and row 5 fires: it walks over, looks, and notes it.</Box></div>
        </div>
      </div>) },

    { id: "Scope", body: (
      <div className="h-full"><Eyebrow>Scope · everything the Gemi can do</Eyebrow><H>{TOOLS.length} methods. Nothing outside this list can be called.</H>
        <div className="mt-3 grid grid-cols-[1.25fr_1fr] gap-8">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">{TOOLS.map((t) => (
            <div key={t.name} className="rounded-xl border-2 px-3 py-1.5" style={{ borderColor: INK, background: t.mode === "think" ? "#efe7ff" : t.mode === "act" ? "#e3f1ff" : "#fff0c9" }}>
              <div className="flex items-baseline justify-between"><b className="font-mono text-[13.5px]">{t.name}</b><span className="text-[11.5px] font-bold">{t.mode} · {t.stars ? `${t.stars}★` : "free"}</span></div>
              <div className="text-[12.5px] leading-snug text-[#4a4356]">{t.does}</div></div>))}</div>
          <div><div className="grid grid-cols-2 gap-3">{[["room-game-ui-1212", "Clicks on it open a ring of actions"], ["desk-zoom-1318", "Finds on the desk, stars in jars"], ["room-3d-arrange-1123", "Arrange mode on a grid"], ["campus-v3-1252", "Four places it can go"]].map(([f, c]) => (
            <figure key={f}><img src={`/deck/${f}.jpg`} alt={c} className="h-[17vh] w-full rounded-xl object-cover" /><figcaption className="mt-1 text-[12.5px] text-[#6d6579]">{c}</figcaption></figure>))}</div>
            <p className="mt-3 text-[14px] leading-snug text-[#4a4356]">Violet: think. Blue: act. Yellow: make. Asked by you, every method is free; on its own initiative it pays the price shown from its own purse.</p></div>
        </div>
      </div>) },

    { id: "Gemi + Verse", body: (
      <div className="h-full"><Eyebrow>Why a Gemi, why a Verse</Eyebrow><H>A mind needs a body to be read. Facts need a place to be shared.</H>
        <div className="mt-8 grid grid-cols-2 gap-8">
          <Frame className="p-7"><Tag>Gemi · the person</Tag>
            <ul className="mt-4"><Li>Its picture of you is uncertain. A character can <b>show</b> that: where it stands, what it holds, its face when a guess was wrong.</Li>
              <Li>It is yours alone. What it learns about you stays in your browser. No platform profile.</Li>
              <Li>Raising it is raising yourself: every keep or skip shows you how you choose.</Li></ul></Frame>
          <Frame className="p-7"><Tag c="#a8d4ff">Verse · the place</Tag>
            <ul className="mt-4"><Li>Campus facts are one shared base. What one Gemi checks, every Gemi reads for free.</Li>
              <Li>The room is a readout: cards on the desk are finds waiting, pins are finds kept, jars hold its Gem Stars.</Li>
              <Li>No feed, no ranking, no recommender in the middle. Gemis and club agents form the network; people decide.</Li></ul></Frame>
        </div>
        <p className="mt-8 text-center text-2xl font-bold">Shared facts. Private understanding.</p>
      </div>) },

    { id: "Who", body: (
      <div className="grid h-full grid-cols-[1.15fr_1fr] items-center gap-10">
        <div><Eyebrow>Who it is for, and why them</Eyebrow><H>College students. NYU and Columbia first.</H>
          <ul className="mt-5"><Li><b>Too much, not too little.</b> One NYU calendar feed lists about a thousand events in three weeks. Students do not lack information; they lack something that reads it for them and does not make things up.</Li>
            <Li><b>The pages are public and checkable.</b> A campus is a small, bounded world with official sources. That is what makes a five-sigma standard for facts reachable at all.</Li>
            <Li><b>Choices here shape a person.</b> Which room you walk into in your first year matters, and the research is clear that belonging only follows real opportunities.</Li>
            <Li><b>A vertical makes it affordable.</b> Thousands of students share the same events, so one check serves all of them.</Li></ul></div>
        <div className="h-[70vh]"><img src="/art/campus3-nyu.svg" alt="An illustrated campus map" className="h-full w-full object-cover [mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_78%)]" /></div>
      </div>) },

    { id: "Gemini", body: (
      <div className="h-full"><Eyebrow>What each Gemini model did</Eyebrow><H>Seven models, one job each.</H>
        <table className="mt-5 w-full"><tbody>
          <tr><Cell head w="20%">Model</Cell><Cell head w="46%">Its job</Cell><Cell head>What we saw</Cell></tr>
          <tr><Cell><b>Gemini 4 Carbon</b></Cell><Cell>Designs the base, the learning graph and the Gemi's growth at high thinking. Plans each day's Gem Stars and picks finds by the gap rule.</Cell><Cell>Cut our nine axes to seven with an observable contrast for each. Named its own misfits.</Cell></tr>
          <tr><Cell><b>Gemini 4 Hydrogen</b></Cell><Cell>Hears voice in any language, reads posters, fills entities, tags needs, writes the diary, plays the simulated student.</Cell><Cell>A Chinese note with English words mixed in came back verbatim with each need tied to the exact words.</Cell></tr>
          <tr><Cell><b>Decisions API</b></Cell><Cell>The gate. One yes or no per field against the source; identity of two records; the same check on what a student shows.</Cell><Cell>Recognised a poster as an event already in the base at 0.86. Blocked a guessed year.</Cell></tr>
          <tr><Cell><b>Gemini 4 Argon</b></Cell><Cell>The single-call baseline we measure against.</Cell><Cell>Invented an end time; wrote 2025 for a 2026 event.</Cell></tr>
          <tr><Cell><b>Gemini 4 Neon</b></Cell><Cell>Writes the 3D: room, furniture, body, clothes, hair, 29-clip motion library, 36 creatures, maps and icons. Shown its own renders to correct them.</Cell><Cell>Strong at structure and motion. Faces needed a human eye.</Cell></tr>
          <tr><Cell><b>Lyria</b></Cell><Cell>Background music, 30 seconds a track.</Cell><Cell>Six tracks in about 15 seconds each.</Cell></tr>
          <tr><Cell><b>Managed Agent</b></Cell><Cell>Planned for live trips to public pages.</Cell><Cell>Not wired today.</Cell></tr>
        </tbody></table>
      </div>) },

    { id: "Theory", body: (
      <div className="h-full"><Eyebrow>What it stands on</Eyebrow><H>Each design choice has a source, and a limit we state.</H>
        <table className="mt-5 w-full"><tbody>
          <tr><Cell head w="26%">Choice</Cell><Cell head w="40%">Why</Cell><Cell head>Source</Cell></tr>
          <tr><Cell><b>A loop, not a profile</b></Cell><Cell>Agents that store, reflect and plan behave believably; alternating reasoning and acting gives readable traces.</Cell><Cell>Park et al. 2023 · Yao et al. 2023</Cell></tr>
          <tr><Cell><b>Every belief is a guess you can correct</b></Cell><Cell>Model social reasoning breaks on small changes.</Cell><Cell>Ullman 2023 · Shapira et al. 2024 · Strachan et al. 2024</Cell></tr>
          <tr><Cell><b>Show confidence per field</b></Cell><Cell>The goal is calibrated trust; per-case confidence helps people calibrate.</Cell><Cell>Lee & See 2004 · Zhang, Liao & Bellamy 2020</Cell></tr>
          <tr><Cell><b>Undo on everything</b></Cell><Cell>Correction and dismissal should be easy.</Cell><Cell>Amershi et al. 2019</Cell></tr>
          <tr><Cell><b>Short visits, no streaks</b></Cell><Cell>In a four-week trial, heavier chatbot use went with more loneliness and dependence. A preprint; effects were weak in revision.</Cell><Cell>Fang et al. 2025</Cell></tr>
          <tr><Cell><b>Only registered actions</b></Cell><Cell>Choosing among actions the scene affords reduces impossible actions.</Cell><Cell>Ahn et al. 2022 · Gibson 1979</Cell></tr>
          <tr><Cell><b>Real opportunities first</b></Cell><Cell>A belonging message only worked where real opportunities existed.</Cell><Cell>Walton et al. 2023</Cell></tr>
        </tbody></table>
        <p className="mt-4 text-[15px] text-[#8a8296]">Not claimed: that it understands minds; that the seven axes are validated on real students; that the gap rule and the sealed guess come from the literature. They are our design, measured today on 202 pages and a simulated student.</p>
      </div>) },

    { id: "Try it", body: (
      <div className="grid h-full grid-cols-[1fr_1.2fr] items-center gap-10">
        <div><Eyebrow>Try it</Eyebrow><H>Bring your own input.</H>
          <ul className="mt-5"><Li>Say twenty seconds about yourself, in any language.</Li><Li>Show it a poster from this room.</Li><Li>Send it out. Open any card and read the checks.</Li><Li>Keep one, skip one. Open the diary.</Li></ul>
          <div className="mt-8 flex flex-wrap gap-3 text-lg font-bold">{[["/room", "The room"], ["/foundry", "Foundry: the base"], ["/admin", "Admin: run days"], ["/gen3d/doll.html?cam=front", "The character"]].map(([h, l]) => (
            <a key={h} href={h} className="rounded-full border-[3px] bg-[#ffe08a] px-5 py-2" style={{ borderColor: INK, boxShadow: `0 4px 0 ${INK}` }}>{l}</a>))}</div>
          <p className="mt-8 text-sm text-[#8a8296]">All code written on 2026-11-21 with an AI coding assistant. Concepts from our earlier work on a campus twin and a portrait with uncertainty. github.com/haodaz/gemiverse</p></div>
        <div className="h-[78vh]"><Live src="/gen3d/viewer.html?embed=1&bare=1&school=columbia" /></div>
      </div>) },
  ];

  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (["ArrowRight", "PageDown", " "].includes(e.key)) setI((x) => Math.min(slides.length - 1, x + 1)); if (["ArrowLeft", "PageUp"].includes(e.key)) setI((x) => Math.max(0, x - 1)); };
    addEventListener("keydown", on); return () => removeEventListener("keydown", on);
  }, [slides.length]);

  return (
    <main className="relative h-screen overflow-hidden bg-[#f6f2ee] text-[#2b2536]">
      <div className="h-full px-16 pb-20 pt-12">{slides[i].body}</div>
      <nav className="absolute bottom-5 left-0 right-0 flex items-center justify-center gap-2">
        <button onClick={() => setI(Math.max(0, i - 1))} aria-label="Previous slide" className="mr-3 h-10 w-10 rounded-full border-[3px] bg-[#fffaf0] text-lg font-bold" style={{ borderColor: INK, boxShadow: `0 3px 0 ${INK}` }}>‹</button>
        {slides.map((s, k) => <button key={s.id} onClick={() => setI(k)} title={s.id} aria-label={`Slide ${k + 1}: ${s.id}`} className="h-3 rounded-full border-2 transition-all" style={{ borderColor: INK, width: k === i ? 34 : 12, background: k === i ? "#7c4dce" : "#fffaf0" }} />)}
        <button onClick={() => setI(Math.min(slides.length - 1, i + 1))} aria-label="Next slide" className="ml-3 h-10 w-10 rounded-full border-[3px] bg-[#fffaf0] text-lg font-bold" style={{ borderColor: INK, boxShadow: `0 3px 0 ${INK}` }}>›</button>
        <span className="ml-4 text-xs tabular-nums text-[#8a8296]">{i + 1} / {slides.length} · {slides[i].id}</span>
        {onLang && <button onClick={onLang} className="ml-4 rounded-full border-[3px] bg-[#fffaf0] px-3 py-1 text-sm font-bold" style={{ borderColor: INK, boxShadow: `0 3px 0 ${INK}` }}>中文</button>}
      </nav>
    </main>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { INK } from "@/components/game";

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

export default function Deck() {
  const [i, setI] = useState(0);
  const [t, setT] = useState<any>(null);
  useEffect(() => { fetch("/api/foundry").then((r) => r.json()).then((d) => setT(d.totals ?? null)).catch(() => {}); }, []);
  const n = (k: string, fallback: number | string) => t?.[k] ?? fallback;

  const slides: { id: string; body: ReactNode }[] = [
    { id: "Gemiverse", body: (
      <div className="grid h-full grid-cols-[1.1fr_1fr] items-center gap-10">
        <div><Eyebrow>Gemini 4 NYC Hackathon · Track 1, 5 Sigma · built today</Eyebrow>
          <h1 className="mt-4 text-[5.5rem] font-bold leading-none tracking-tight">Gemiverse</h1>
          <P>Every college student gets a <b>Gemi</b>: an AI version of you that lives on campus, goes out on a small daily budget, and brings back only what it has checked.</P>
          <p className="mt-8 text-2xl font-bold" style={{ color: "#7c4dce" }}>It would rather miss than be wrong.</p></div>
        <div className="h-[70vh]"><Live src="/gen3d/doll.html?embed=1&cam=front&looks=mochi,kai" /></div>
      </div>) },

    { id: "What it is", body: (
      <div className="grid h-full grid-cols-[1fr_1.25fr] items-center gap-10">
        <div><Eyebrow>1 · What it is</Eyebrow><H>A twin with a room, a budget and a conscience about facts.</H>
          <ul className="mt-5"><Li>You talk to it in any language, or show it a poster. It listens to what you said, not how you sounded.</Li>
            <Li>It goes out to four places on campus and brings back three things, each field checked against its source.</Li>
            <Li>You keep or skip. From that it learns how you choose, and shows you what it learned. You can undo any of it.</Li>
            <Li>Left alone, it spends its own Gem Stars: thinking, going out, keeping its diary, changing its room.</Li></ul></div>
        <div className="h-[78vh]"><Live src="/gen3d/viewer.html?embed=1&bare=1&school=nyu" /></div>
      </div>) },

    { id: "Gemi + Verse", body: (
      <div className="h-full"><Eyebrow>2 · Why a Gemi, why a Verse</Eyebrow><H>A mind needs a body to be read. Facts need a place to be shared.</H>
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
        <div><Eyebrow>3 · Who it is for, and why them</Eyebrow><H>College students. NYU and Columbia first.</H>
          <ul className="mt-5"><Li><b>Too much, not too little.</b> One NYU calendar feed lists about a thousand events in three weeks. Students do not lack information; they lack something that reads it for them and does not make things up.</Li>
            <Li><b>The pages are public and checkable.</b> A campus is a small, bounded world with official sources. That is what makes a five-sigma standard for facts reachable at all.</Li>
            <Li><b>Choices here shape a person.</b> Which room you walk into in your first year matters, and the research is clear that belonging only follows real opportunities.</Li>
            <Li><b>A vertical makes it affordable.</b> Thousands of students share the same events, so one check serves all of them.</Li></ul></div>
        <div className="h-[70vh]"><img src="/art/campus3-nyu.svg" alt="An illustrated campus map" className="h-full w-full object-cover [mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_78%)]" /></div>
      </div>) },

    { id: "Value", body: (
      <div className="h-full"><Eyebrow>4 · The pain, what it does about it, and the evidence</Eyebrow><H>Four problems, four answers.</H>
        <table className="mt-6 w-full"><tbody>
          <tr><Cell head w="24%">The pain</Cell><Cell head w="38%">What the Gemi does</Cell><Cell head>Evidence today</Cell></tr>
          <tr><Cell><b>AI answers that sound right and are not.</b></Cell><Cell>Every field of everything it brings back is checked against its source by the Decisions API. Below 0.8 it is withheld and shown as withheld.</Cell><Cell>On 10 unseen pages a single model call showed 29 of 103 fields with no support on the page. Ours showed none, and never a wrong date; it withheld 2 of 10 dates.</Cell></tr>
          <tr><Cell><b>A thousand events, no time.</b></Cell><Cell>A small daily budget forces a choice: three finds per trip, picked where you care most and it knows least.</Cell><Cell>Carbon picks two finds that contrast on the axis it is least sure of, so whichever you keep teaches it something.</Cell></tr>
          <tr><Cell><b>Black-box personalisation.</b></Cell><Cell>Seven situational axes, each with an uncertainty band. Every move is tied to one choice and can be undone. It seals a guess before you choose.</Cell><Cell>The seal is a real commit and reveal; the browser re-computes the hash. Day one: 2 of 6 guesses right. It says so in its diary.</Cell></tr>
          <tr><Cell><b>Companions that keep you chatting.</b></Cell><Cell>Short visits. No streaks, no leaderboards. Success is what you did in the real world.</Cell><Cell>Designed in from the research; growth is measured in checked facts and kept finds, never in time spent.</Cell></tr>
        </tbody></table>
      </div>) },

    { id: "What is different", body: (
      <div className="h-full"><Eyebrow>5 · What is different</Eyebrow><H>It grows from the bottom up, and a token spent once keeps paying.</H>
        <div className="mt-7 grid grid-cols-3 gap-6">
          <Frame className="p-6"><Tag c="#ffe08a">Grown from the base</Tag><p className="mt-3 text-[17px] leading-relaxed">Gemini designed the knowledge base before any screen existed, in parallel with a second designer; the two were compared and merged, and nothing was overwritten. Every object in the room is the projection of a fact.</p></Frame>
          <Frame className="p-6"><Tag c="#a8e0c0">The flywheel</Tag><p className="mt-3 text-[17px] leading-relaxed">A checked fact is a shared asset. The base holds <b>{n("entities", 166)}</b> entities and <b>{n("fields_passed", 420)}</b> checked fields. A revisit compares a fingerprint and costs 0 tokens unless the page changed. A poster you show joins the base for everyone.</p></Frame>
          <Frame className="p-6"><Tag>The mind space</Tag><p className="mt-3 text-[17px] leading-relaxed">One loop: what you said, what you did, what it now believes, where it goes next, whether its guess was right. The same loop runs for the Gemi's own growth, under rules enforced in code.</p></Frame>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-6 text-lg"><p><b>Tokens are not single-use.</b> Spent by one Gemi on a check, they become something every other Gemi reads without spending.</p><p><b>A vertical makes this possible.</b> Inside one campus, sources are official, entities repeat, and one design fits; the open web offers none of the three.</p></div>
      </div>) },

    { id: "Today and next", body: (
      <div className="grid h-full grid-cols-[1.3fr_1fr] items-center gap-10">
        <div><Eyebrow>6 · How far we got today, honestly</Eyebrow><H>Working, measured, and where it is still rough.</H>
          <table className="mt-5 w-full"><tbody>
            <tr><Cell head w="50%">Works today</Cell><Cell head>Not yet</Cell></tr>
            <tr><Cell>Shared base designed by Gemini, filled, checked, measured against a baseline on unseen pages</Cell><Cell>Institution structure and opportunities are nearly empty</Cell></tr>
            <tr><Cell>Hear in many languages, see a poster, go out, three finds, keep or skip, sealed guess, diary with undo</Cell><Cell>Live browsing by the Managed Agent; trips read the checked base</Cell></tr>
            <tr><Cell>Its own initiative on its own Gem Stars; twelve governed methods; an admin mode that runs whole days</Cell><Cell>Club agents, name cards, other Gemis visiting</Cell></tr>
            <tr><Cell>A 3D room that reads out its state; a jointed character with 29 motions and 12 expressions</Cell><Cell><b>The character is still rough.</b> Three generated faces failed; the face is hand-painted for now</Cell></tr>
          </tbody></table>
          <p className="mt-4 text-lg"><b>Next:</b> wardrobe and birth from a voice note, companions and keepsakes, spaces earned by real-world outcomes, clubs with their own agents, a third campus.</p></div>
        <div className="h-[70vh]"><Live src="/gen3d/doll.html?embed=1&cam=front&looks=pip,mochi&show=walk,sitDown,wave,think,reachShelf,stretch" /></div>
      </div>) },

    { id: "Gemini", body: (
      <div className="h-full"><Eyebrow>7 · What each Gemini model did</Eyebrow><H>Seven models, one job each.</H>
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

    { id: "For Gemini", body: (
      <div className="grid h-full grid-cols-[1.2fr_1fr] items-center gap-10">
        <div><Eyebrow>8 · What this explores for Gemini</Eyebrow><H>Models that design, check and correct each other, on a budget.</H>
          <ul className="mt-5"><Li><b>A model designs its own ground.</b> Carbon wrote the ontology; a second designer wrote one in parallel; the merge records every disagreement.</Li>
            <Li><b>One model's claim is another model's question.</b> Nothing Hydrogen writes reaches a student without a Decisions answer above 0.8.</Li>
            <Li><b>A model that can see its own work.</b> Neon could not tell its faces were wrong until it was shown the render.</Li>
            <Li><b>Budget as a design material.</b> Scarce tokens make the agent choose, and what it buys becomes common property.</Li>
            <Li><b>Autonomy under rules in code.</b> Think, act, make: registered methods, charged first, staged, with a kill switch.</Li></ul></div>
        <Frame className="h-[62vh] p-6"><p className="text-sm font-bold uppercase tracking-wider text-[#8a8296]">Five sigma, in this product</p>
          <p className="mt-4 text-3xl font-bold leading-tight">A fact reaches a student only if it can be shown on its source.</p>
          <p className="mt-5 text-lg leading-relaxed text-[#4a4356]">We are not at five sigma. We built the thing that makes the error rate measurable and drives it down: a gate on every field, a baseline, an exam set, and a log of what failed.</p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-center"><div className="rounded-2xl border-2 bg-white py-3" style={{ borderColor: INK }}><div className="text-3xl font-bold">0 / 76</div><div className="text-xs text-[#8a8296]">unsupported fields shown, unseen pages</div></div>
            <div className="rounded-2xl border-2 bg-white py-3" style={{ borderColor: INK }}><div className="text-3xl font-bold">29 / 103</div><div className="text-xs text-[#8a8296]">same pages, one model call</div></div></div></Frame>
      </div>) },

    { id: "Theory", body: (
      <div className="h-full"><Eyebrow>9 · What it stands on</Eyebrow><H>Each design choice has a source, and a limit we state.</H>
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
        <p className="mt-4 text-[15px] text-[#8a8296]">Not claimed: that it understands minds; that the seven axes are validated on real students; that the gap rule and the sealed guess come from the literature. They are our design, measured today on 25 pages and a simulated student.</p>
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
      </nav>
    </main>
  );
}

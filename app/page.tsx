import proof from "@/lib/proof.json";

// The introduction. Written for a student who has never seen this, top to bottom: what it is, a day with it, the home it grows,
// what it helps with, why to believe it, what we hold to, and three doors in. The judges' version, with the method, is /deck.
const INK = "#2b2536", MUTE = "#6d6579", PUR = "#7c4dce";
const Eyebrow = ({ children, light }: { children: React.ReactNode; light?: boolean }) => <p className="text-[13px] font-bold uppercase tracking-[0.22em]" style={{ color: light ? "#cdbff0" : "#8a8296" }}>{children}</p>;
const Live = ({ src, title }: { src: string; title: string }) => <iframe src={src} title={title} loading="lazy" className="pointer-events-none h-full w-full border-0 bg-transparent" />;
const PG = proof.pages.overall as any;

export default function Home() {
  return (
    <main className="h-screen snap-y snap-proximity overflow-y-auto scroll-pt-[60px] bg-[#faf8f5] text-[#2b2536]" style={{ scrollBehavior: "smooth", overscrollBehavior: "contain" }}>
      <header className="sticky top-0 z-20 border-b border-[#ebe6ee] bg-[#faf8f5]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-3.5">
          <a href="/" className="text-xl font-semibold tracking-tight">Gemiverse</a>
          <nav className="flex items-center gap-7 text-[15px] text-[#5f576c]">
            <a href="#day" className="hover:text-[#2b2536]">A day</a><a href="#home" className="hover:text-[#2b2536]">Its home</a><a href="#proof" className="hover:text-[#2b2536]">Why trust it</a><a href="/deck" className="hover:text-[#2b2536]">How it works</a>
            <a href="/admin" className="hover:text-[#2b2536]">Admin</a>
            <a href="/start" className="rounded-full px-5 py-2 font-semibold text-white" style={{ background: PUR }}>Move in</a>
          </nav>
        </div>
      </header>

      {/* 1 · what it is: two stills drawn by Gemini's image model from a screenshot of the real room, moving slowly and fading into each other */}
      <style>{`@keyframes kb1{0%{opacity:1;transform:scale(1.02) translate(0,0)}42%{opacity:1}50%{opacity:0;transform:scale(1.14) translate(-1.5%,-1%)}92%{opacity:0}100%{opacity:1;transform:scale(1.02)}}
@keyframes kb2{0%{opacity:0;transform:scale(1.12) translate(1%,0)}42%{opacity:0}50%{opacity:1}92%{opacity:1;transform:scale(1.02) translate(0,0)}100%{opacity:0}}`}</style>
      <section className="snap-start relative h-[calc(100vh-60px)] min-h-[560px] overflow-hidden bg-[#2b2536]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/art/film/touch-red.jpg" alt="A hand touches a laptop screen; inside, a small character in its room reaches back" className="absolute inset-0 h-full w-full object-cover" style={{ animation: "kb1 18s ease-in-out infinite" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/art/film/both-red.jpg" alt="A student on a park bench with a laptop; on its screen, her Gemi waves from its room" className="absolute inset-0 h-full w-full object-cover" style={{ animation: "kb2 18s ease-in-out infinite" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, #1d1828e6 0%, #1d1828b3 34%, #1d182800 62%)" }} />
        <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-center px-8 text-white">
          <p className="text-[13px] font-bold uppercase tracking-[0.22em] text-[#e8dcff]">For college students · NYU and Columbia first</p>
          <h1 className="mt-4 max-w-2xl text-[4.4rem] font-semibold leading-[1.02] tracking-tight">Meet your Gemi,<br />and build a universe together.</h1>
          <p className="mt-6 max-w-xl text-[21px] leading-relaxed text-white/85">It begins as a point of light, and exists because you met it. Then it is a small you that lives on campus, goes out while you are in class, and comes back with three things worth your evening.</p>
          <div className="mt-8 flex items-center gap-4">
            <a href="/start" className="rounded-full bg-[#ffe08a] px-8 py-3.5 text-lg font-semibold text-[#2b2536]" style={{ boxShadow: "0 6px 0 #b8963a" }}>Meet your Gemi</a>
            <a href="#day" className="rounded-full border-2 border-white/80 px-7 py-3 text-lg font-semibold">See a day with it</a>
          </div>
          <p className="mt-5 text-sm text-white/60">No sign-up. What it learns about you stays in your browser.</p>
        </div>
      </section>

      {/* 2 · three things to know, beside the real thing */}
      <section className="snap-start min-h-[calc(100vh-60px)] flex flex-col justify-center border-b border-[#ebe6ee] bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_1.1fr] items-center gap-10 px-8 py-14">
          <div className="space-y-8">
            {[["A Gemi", "It is yours alone", "Not an assistant waiting for orders. It has a small daily budget, plans its own day, and you can see what it did and why."],
              ["A Verse", "A campus it can read", "Events, clubs, libraries and openings from official pages, shared by every Gemi. What one has checked, all can read."],
              ["One rule", "Miss rather than be wrong", "Every date, time and room it shows you was found on the source page. What it could not check, it does not show."]].map(([k, t, d]) => (
              <div key={k}><Eyebrow>{k}</Eyebrow><h3 className="mt-1.5 text-3xl font-semibold">{t}</h3><p className="mt-2 text-[17px] leading-relaxed" style={{ color: MUTE }}>{d}</p></div>))}
          </div>
          <div><div className="h-[60vh]"><Live src="/gen3d/viewer.html?embed=1&bare=1&school=nyu" title="A Gemi in its room, live" /></div><p className="text-center text-sm" style={{ color: "#8a8296" }}>This is the real room, running now. The pictures above were drawn by Gemini from a screenshot of it.</p></div>
        </div>
      </section>

      {/* 3 · a day */}
      <section id="day" className="snap-start min-h-[calc(100vh-60px)] flex flex-col justify-center mx-auto max-w-6xl px-8 py-20">
        <Eyebrow>A day with your Gemi</Eyebrow>
        <h2 className="mt-3 max-w-3xl text-5xl font-semibold leading-tight tracking-tight">Twenty seconds from you. The rest it does itself.</h2>
        <div className="mt-10 grid grid-cols-4 gap-5">
          {[["talk", "Morning", "You tell it something", "Typed or spoken, in any language. “I want to meet people who build things. Big mixers tire me.” Or you show it a poster."],
            ["campus", "Midday", "It goes out", "Library, clubs, commons, opportunities. It has only a few Gem Stars a day, so it goes where it knows least about what you care about."],
            ["desk", "Afternoon", "Three things on the desk", "Each with its source and what was checked. It has already sealed a guess of which you will keep."],
            ["diary", "Evening", "You decide. It writes it down", "Keep or skip. It shows whether it guessed right and what it learned about how you choose. You can undo any of it."]].map(([icon, when, t, d]) => (
            <div key={t} className="rounded-2xl border-2 bg-white p-5" style={{ borderColor: INK, boxShadow: "0 5px 0 #2b253622" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/icons/${icon}.svg`} alt="" className="h-12 w-12" />
              <p className="mt-3 text-[12px] font-bold uppercase tracking-widest" style={{ color: PUR }}>{when}</p>
              <h3 className="mt-1 text-xl font-semibold leading-snug">{t}</h3><p className="mt-2 text-[15px] leading-relaxed" style={{ color: MUTE }}>{d}</p></div>))}
        </div>
      </section>

      {/* 4 · the home it grows */}
      <section id="home" className="snap-start min-h-[calc(100vh-60px)] flex flex-col justify-center bg-[#2b2536] text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_1.1fr] items-center gap-8 px-8 py-20">
          <div>
            <Eyebrow light>The home it grows</Eyebrow>
            <h2 className="mt-3 text-5xl font-semibold leading-tight tracking-tight">Nothing here is bought. Everything stands for something you did.</h2>
            <ul className="mt-7 space-y-4 text-[18px] leading-relaxed text-[#e4def0]">
              <li><b className="text-white">Clothes are free.</b> How it looks is yours to choose, from day one.</li>
              <li><b className="text-white">A keepsake</b> appears when you really went to something it found.</li>
              <li><b className="text-white">A companion moves in</b> when it had guessed you would go, and you did.</li>
              <li><b className="text-white">New rooms open</b> only with Gem Stars it saved by not spending: a reading room, a loft, a rooftop for other Gemis to visit, a lab.</li>
            </ul>
            <p className="mt-6 text-[15px] text-[#b9aed3]">No streaks, no points, no shop. If you are doing well out there, it shows in here.</p>
          </div>
          <div className="h-[64vh] overflow-hidden rounded-3xl bg-[#f3eef8]"><Live src="/gen3d/spaces.html?embed=1&auto=3&friends=pip,kai" title="Rooms a Gemi can open, live" /></div>
        </div>
      </section>

      {/* 5 · what it helps with */}
      <section className="snap-start min-h-[calc(100vh-60px)] flex flex-col justify-center mx-auto max-w-6xl px-8 py-20">
        <Eyebrow>Four places on campus</Eyebrow>
        <h2 className="mt-3 max-w-3xl text-5xl font-semibold leading-tight tracking-tight">Where it goes depends on what you are looking for.</h2>
        <div className="mt-10 grid grid-cols-4 gap-5">
          {[["library", "Library", "Build a skill · explore a field", "Workshops, research help, study groups."], ["clubs", "Clubs", "Find your people · make things", "Meetings and events of student groups."],
            ["commons", "Commons", "Meet people · rest", "Open socials, study breaks, things with food."], ["career", "Opportunities", "Get experience · decide a direction", "Openings, fairs and deadlines."]].map(([f, n, need, d]) => (
            <div key={n} className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/art/bld2-${f}.svg`} alt={`An illustrated ${n} building`} className="mx-auto h-48 w-full object-contain" />
              <h3 className="mt-3 text-2xl font-semibold">{n}</h3><p className="mt-1 text-[14px] font-semibold" style={{ color: PUR }}>{need}</p><p className="mt-1 text-[15px]" style={{ color: MUTE }}>{d}</p></div>))}
        </div>
      </section>

      {/* 6 · why trust it */}
      <section id="proof" className="snap-start min-h-[calc(100vh-60px)] flex flex-col justify-center border-y border-[#ebe6ee] bg-white">
        <div className="mx-auto max-w-6xl px-8 py-20">
          <Eyebrow>Why trust what it tells you</Eyebrow>
          <h2 className="mt-3 max-w-3xl text-5xl font-semibold leading-tight tracking-tight">We measured it on pages we did not pick.</h2>
          <div className="mt-10 grid grid-cols-3 gap-6">
            {[["0 of 76", "made-up details shown", "On ten event pages it had never seen. A single AI call on the same pages showed 29 details the page did not contain."],
              [`${(PG.system_v2.error_rate * 100).toFixed(1)}%`, "facts wrong", `On ${proof.pages.n} raw pages from six universities, against ${(PG.baseline.error_rate * 100).toFixed(1)}% for a single AI call. Our first try did worse than that; we kept the record.`],
              ["166", "checked things on campus", "Events, clubs and places in the shared base today, each field with the sentence it came from."]].map(([v, l, d]) => (
              <div key={l} className="rounded-2xl border-2 p-6" style={{ borderColor: INK }}><div className="text-6xl font-semibold tracking-tight" style={{ color: PUR }}>{v}</div><div className="mt-1 text-lg font-semibold">{l}</div><p className="mt-2 text-[15px] leading-relaxed" style={{ color: MUTE }}>{d}</p></div>))}
          </div>
          <p className="mt-6 text-[15px]" style={{ color: MUTE }}>It still gets things wrong, mostly events that are both in a room and online. The full method, the failures and what we changed are in <a href="/deck" className="font-semibold underline" style={{ color: INK }}>how it works</a>.</p>
        </div>
      </section>

      {/* 7 · what we hold to */}
      <section className="snap-start min-h-[calc(100vh-60px)] flex flex-col justify-center mx-auto max-w-6xl px-8 py-20">
        <Eyebrow>What we hold to</Eyebrow>
        <div className="mt-6 grid grid-cols-2 gap-x-14 gap-y-9">
          {[["Shared facts, private understanding.", "Campus facts belong to everyone. What your Gemi learns about you never leaves your browser unless you say so."],
            ["A small budget is the point.", "Your day has limited hours and attention. So does its day. It has to choose what matters, and so it brings back treasure, not a pile."],
            ["You decide.", "It looks and asks. It never agrees to anything for you, and other AIs' words are material to it, not orders."],
            ["Short visits. Real life counts.", "No streaks, no feed. We count what you did out there, not the minutes you spent in here."]].map(([t, d]) => (
            <div key={t}><h3 className="text-3xl font-semibold leading-snug tracking-tight">{t}</h3><p className="mt-2 text-[18px] leading-relaxed" style={{ color: MUTE }}>{d}</p></div>))}
        </div>
      </section>

      {/* 8 · three doors */}
      <section className="snap-start min-h-[calc(100vh-60px)] flex flex-col justify-center bg-[#f1eafc]">
        <div className="mx-auto max-w-6xl px-8 py-20">
          <Eyebrow>Start here</Eyebrow>
          <h2 className="mt-3 text-5xl font-semibold tracking-tight">What are you here to do?</h2>
          <div className="mt-9 grid grid-cols-3 gap-6">
            {[["/start", "I am a student", "Meet your Gemi, tell it one thing, then choose where you two live. About a minute.", "Meet your Gemi", PUR, "#fff"],
              ["/deck", "I want to know how it works", "The task, the baseline, the test set, the failures, the mathematics and the layers. In English and Chinese.", "Open the deck", "#fff", INK],
              ["/admin", "I run this", "The back office: the shared base and its flywheel, what each Gemini model did, the measured results, and days run at speed.", "Open admin", "#fff", INK]].map(([href, t, d, cta, bg, fg]) => (
              <a key={href} href={href} className="flex flex-col rounded-3xl border-2 bg-white p-7 transition hover:-translate-y-1" style={{ borderColor: INK, boxShadow: "0 6px 0 #2b253633" }}>
                <h3 className="text-2xl font-semibold">{t}</h3><p className="mt-2 flex-1 text-[16px] leading-relaxed" style={{ color: MUTE }}>{d}</p>
                <span className="mt-5 inline-block self-start rounded-full border-2 px-6 py-2 text-base font-semibold" style={{ background: bg, color: fg, borderColor: INK }}>{cta} →</span></a>))}
          </div>
        </div>
      </section>

      <footer className="snap-end mx-auto max-w-6xl px-8 py-8 text-[13px] leading-relaxed text-[#8a8296]">
        Built on 2026-11-21 at the Gemini 4 NYC Hackathon. Room, character, spaces, maps and icons were written as code or drawn by Gemini 4 Neon; no university logos are used.
        Peers in Gemi-to-Gemi introductions are simulated today.
      </footer>
    </main>
  );
}

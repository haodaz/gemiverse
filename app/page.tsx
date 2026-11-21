"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SCHOOLS, saveSchool, type SchoolId } from "@/lib/schools";

export default function ChooseSchool() {
  const router = useRouter();
  const [picked, setPicked] = useState<SchoolId | null>(null);

  function go() {
    if (!picked) return;
    saveSchool(picked);
    router.push("/room");
  }

  return (
    <main className="min-h-screen bg-[#faf8f5] text-[#2b2536]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-10 py-10">
        <header className="flex items-baseline justify-between">
          <div className="text-xl font-semibold tracking-tight">Gemiverse</div>
          <a href="/deck" className="text-sm text-[#8a8296] hover:text-[#2b2536]">How it works, with the numbers →</a>
        </header>

        {/* For students, in their words. The judges' story (baseline, test set, failures) lives in /deck. */}
        <section className="mt-8 grid grid-cols-[1fr_1.1fr] items-center gap-8">
          <div>
            <h1 className="text-6xl font-semibold leading-[1.05] tracking-tight">Meet your Gemi.</h1>
            <p className="mt-5 text-xl leading-relaxed text-[#5f576c]">A small you that lives on campus. While you are in class it goes out, reads the pages you have no time for, and comes back with three things worth your evening.</p>
            <ul className="mt-6 space-y-3 text-lg">
              {[["Tell it about you", "Twenty seconds, in any language. Or show it a poster."], ["It goes out", "It has a little to spend each day, so it picks carefully. If it could not check something, it will not tell you."], ["You decide", "Keep or skip. It learns how you choose, shows you what it learned, and you can undo any of it."], ["It grows a home", "Go to something for real and a keepsake arrives. Over the weeks it saves up and opens new rooms."]].map(([t, d], k) => (
                <li key={t} className="flex gap-3"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#2b2536] text-sm font-bold text-white">{k + 1}</span><span><b>{t}.</b> <span className="text-[#5f576c]">{d}</span></span></li>))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-2" style={{ height: "52vh" }}>
            <iframe src="/gen3d/viewer.html?embed=1&bare=1&school=nyu" title="A Gemi in its room" className="h-full w-full border-0 bg-transparent" />
            <iframe src="/gen3d/spaces.html?embed=1&auto=3&friends=pip,kai" title="Rooms it can open later" className="h-full w-full border-0 bg-transparent" />
          </div>
        </section>

        <section className="mt-10">
          <p className="text-sm font-medium uppercase tracking-widest text-[#8a8296]">First</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Where does your Gemi live?</h2>
        </section>

        <section className="mt-5 grid grid-cols-2 gap-6">
          {Object.values(SCHOOLS).map((s) => {
            const on = picked === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setPicked(s.id)}
                aria-pressed={on}
                className="group overflow-hidden rounded-3xl bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                style={{ outline: on ? `3px solid ${s.accent}` : "1px solid #ebe6ee", outlineOffset: on ? 2 : 0 }}
              >
                <div className="relative h-64 w-full overflow-hidden" style={{ background: s.soft }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.view} alt={`An illustrated view of ${s.place}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                </div>
                <div className="flex items-center justify-between px-6 py-5">
                  <div>
                    <div className="text-2xl font-semibold">{s.short}</div>
                    <div className="mt-1 text-sm text-[#5f576c]">{s.place} · {s.line}</div>
                  </div>
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white transition"
                    style={{ background: on ? s.accent : "#e6e0ec" }}
                    aria-hidden
                  >
                    ✓
                  </span>
                </div>
              </button>
            );
          })}
        </section>

        <div className="mt-8 flex items-center justify-between">
          <p className="text-sm text-[#8a8296]">More campuses opening soon.</p>
          <button
            onClick={go}
            disabled={!picked}
            className="rounded-full px-8 py-3 text-base font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: picked ? SCHOOLS[picked].accent : "#8a8296" }}
          >
            {picked ? `Move in at ${SCHOOLS[picked].short}` : "Choose a campus"}
          </button>
        </div>

        <footer className="mt-auto pt-10 text-xs leading-relaxed text-[#8a8296]">
          Campus facts are shared by every Gemi. What yours learns about you stays in this browser.
          Illustrations were drawn by Gemini 4 Neon; no university logos are used.
        </footer>
      </div>
    </main>
  );
}

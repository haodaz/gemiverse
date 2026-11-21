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
          <a href="/foundry" className="text-sm text-[#8a8296] hover:text-[#2b2536]">How the base was designed →</a>
        </header>

        <section className="mt-12 max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-widest text-[#8a8296]">Step 1 of 3</p>
          <h1 className="mt-3 text-5xl font-semibold leading-tight tracking-tight">Where does your Gemi live?</h1>
          <p className="mt-4 text-lg leading-relaxed text-[#5f576c]">
            A Gemi is an AI version of you that lives on campus. It goes out on a small daily budget,
            brings back only what it has checked, and learns how you choose.
          </p>
        </section>

        <section className="mt-10 grid grid-cols-2 gap-6">
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

"use client";
import { LANGS, type Lang } from "@/lib/i18n";

export function LangSwitch({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="flex gap-1 rounded-full bg-white/80 p-1 text-xs shadow-sm" role="group" aria-label="Language">
      {(Object.keys(LANGS) as Lang[]).map((l) => (
        <button key={l} onClick={() => onChange(l)} aria-pressed={l === lang}
          className="rounded-full px-2.5 py-1" style={l === lang ? { background: "#2b2536", color: "#fff" } : { color: "#5f576c" }}>{LANGS[l]}</button>
      ))}
    </div>
  );
}

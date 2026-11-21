"use client";
import { useRef, useState } from "react";
import { t, type Lang } from "@/lib/i18n";

// Three ways to reach your Gemi: type, hold to talk, or show it a photo or file.
// The microphone is open only while the button is held; the clip is converted to WAV in the browser, sent once, and not kept.
async function toWavBase64(blob: Blob): Promise<string> {
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  const rate = 16000, off = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
  const src = off.createBufferSource(); src.buffer = decoded; src.connect(off.destination); src.start();
  const pcm = (await off.startRendering()).getChannelData(0);
  const buf = new ArrayBuffer(44 + pcm.length * 2), v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + pcm.length * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
  ctx.close();
  return bytesToBase64(new Uint8Array(buf));
}
function bytesToBase64(bytes: Uint8Array) { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); }

export type Sent = { kind: "text"; text: string } | { kind: "voice"; audio: string } | { kind: "file"; data: string; mime: string; name: string; preview?: string };

export function Composer({ lang, accent, busy, onSend }: { lang: Lang; accent: string; busy: boolean; onSend: (s: Sent) => void }) {
  const [text, setText] = useState(""), [rec, setRec] = useState(false), [note, setNote] = useState("");
  const recorder = useRef<MediaRecorder | null>(null), chunks = useRef<Blob[]>([]), file = useRef<HTMLInputElement>(null);

  async function startTalk() {
    if (busy || rec) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream); chunks.current = [];
      r.ondataavailable = (e) => chunks.current.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((x) => x.stop());                 // microphone off the moment the button is released
        const blob = new Blob(chunks.current, { type: r.mimeType });
        if (blob.size < 2000) { setNote(""); return; }
        try { onSend({ kind: "voice", audio: await toWavBase64(blob) }); } catch { setNote("Could not read that recording."); }
      };
      recorder.current = r; r.start(); setRec(true); setNote(t("listening", lang));
    } catch { setNote("Microphone not available."); }
  }
  function stopTalk() { if (recorder.current && rec) { recorder.current.stop(); setRec(false); setNote(""); } }
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    if (f.size > 8 * 1024 * 1024) { setNote("That file is over 8 MB."); return; }
    const data = bytesToBase64(new Uint8Array(await f.arrayBuffer()));
    onSend({ kind: "file", data, mime: f.type || "application/octet-stream", name: f.name, preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined });
  }
  function submit() { const v = text.trim(); if (!v || busy) return; setText(""); onSend({ kind: "text", text: v }); }

  return (
    <div className="border-t border-[#eee8f0] px-4 pb-4 pt-3">
      <div className="flex items-end gap-2">
        <button onClick={() => file.current?.click()} disabled={busy} title={t("attach", lang)} aria-label={t("attach", lang)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#e3dbe8] text-lg text-[#5f576c] disabled:opacity-40">＋</button>
        <input ref={file} type="file" accept="image/*,application/pdf" hidden onChange={pick} />
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder={t("say_something", lang)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          className="max-h-28 min-h-10 flex-1 resize-none rounded-2xl border border-[#e3dbe8] px-3 py-2 text-sm outline-none focus:border-[#b9a8d6]" />
        {text.trim() ? (
          <button onClick={submit} disabled={busy} className="h-10 shrink-0 rounded-full px-4 text-sm font-medium text-white disabled:opacity-40" style={{ background: accent }}>{t("send", lang)}</button>
        ) : (
          <button onPointerDown={startTalk} onPointerUp={stopTalk} onPointerLeave={stopTalk} disabled={busy} title={t("hold_to_talk", lang)} aria-label={t("hold_to_talk", lang)}
            className="h-10 shrink-0 select-none rounded-full px-4 text-sm font-medium text-white disabled:opacity-40" style={{ background: rec ? "#d64545" : accent }}>{rec ? "●" : "🎙"} {t("hold_to_talk", lang)}</button>
        )}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-[#8a8296]">{note || t("mic_consent", lang)}</p>
    </div>
  );
}

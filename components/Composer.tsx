"use client";
import { useRef, useState } from "react";
import { t, type Lang } from "@/lib/i18n";
import { Icon, INK } from "@/components/game";

// Three ways to reach your Gemi: type, talk, or show it a photo or file.
// The microphone is open only between the two taps; the clip is converted to WAV in the browser, sent once, and not kept.
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
        stream.getTracks().forEach((x) => x.stop());                 // microphone off the moment recording stops
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

  // One pill: attach, type, microphone, send. The microphone is a toggle, as in any messenger: tap to start, tap again to send.
  const round = "grid h-9 w-9 shrink-0 place-items-center rounded-full transition disabled:opacity-40";
  return (
    <div className="border-t-2 border-[#e6dfd0] px-3 pb-3 pt-2.5">
      <div className="flex items-center gap-1 rounded-full border-[3px] bg-white py-1 pl-1.5 pr-1.5" style={{ borderColor: INK }}>
        <button onClick={() => file.current?.click()} disabled={busy || rec} title={t("attach", lang)} aria-label={t("attach", lang)} className={`${round} hover:bg-[#f1ebf7]`}><Icon name="attach" size={22} /></button>
        <input ref={file} type="file" accept="image/*,application/pdf" hidden onChange={pick} />
        {rec ? (
          <div className="flex h-9 flex-1 items-center gap-2 px-2 text-sm font-bold text-[#d64545]"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#d64545]" /><span className="truncate">{t("listening", lang)}</span></div>
        ) : (
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("say_something", lang)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
            className="h-9 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-[#a79fb1]" />
        )}
        <button onClick={() => (rec ? stopTalk() : startTalk())} disabled={busy} title={t("hold_to_talk", lang)} aria-label={t("hold_to_talk", lang)} aria-pressed={rec}
          className={`${round} ${rec ? "" : "hover:bg-[#f1ebf7]"}`} style={rec ? { background: "#d64545" } : undefined}>{rec ? <span className="h-3 w-3 rounded-[3px] bg-white" /> : <Icon name="mic" size={22} />}</button>
        <button onClick={submit} disabled={busy || rec || !text.trim()} title={t("send", lang)} aria-label={t("send", lang)} className={`${round} text-white`} style={{ background: accent }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg></button>
      </div>
      <p className="mt-1.5 truncate px-2 text-[11px] text-[#8a8296]" title={note || t("mic_consent", lang)}>{note || t("mic_consent", lang)}</p>
    </div>
  );
}

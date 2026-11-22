import { NOTE, type Ask, type Task } from "../core/capability";

// "It saved for days and wrote you a song", as a recipe (ENGINE.md 5b). Whatever writes it, the result is one of two
// artifacts the space can play: a SCORE (data, played by a synthesiser with the pack's instrument sounds) or, from a model
// that can, a piece of AUDIO. Four routes, from the richest to the plainest:
//   audio  a model that returns sound composes directly
//   score  a model that keeps a structure writes the whole score: key, tempo, chords, melody with rhythm, words
//   notes  a model that can only write a line of note names does that; the key, the tempo, the chords and the rhythm are the engine's
//   floor  no model: a seeded choice of progression and a melody on the chord tones
export type Score = { key: string; mode: "major" | "minor"; bpm: number; instrument: string; chords: string[]; melody: { pitch: string; beats: number }[]; words?: string[]; title?: string };
export type Song = { kind: "score"; score: Score } | { kind: "audio"; mime: string; data: string };

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"], FLAT: Record<string, string> = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };
export const midi = (p: string): number | null => { const m = /^([A-G][#b]?)([2-6])$/.exec(p); if (!m) return null; const i = NAMES.indexOf(FLAT[m[1]] ?? m[1]); return i < 0 ? null : 12 * (+m[2] + 1) + i; };
export const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const name = (m: number) => NAMES[m % 12] + (Math.floor(m / 12) - 1);
const KEYS = ["C", "G", "D", "A", "F", "Bb", "Eb"], BEATS = [0.5, 1, 2, 4];
const rng = (seed: string) => { let h = 2166136261; for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619); return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// A score is accepted only if a player can play it as written: nothing here is repaired silently.
export function scoreProblems(s: any, instruments: string[]): string[] {
  const bad: string[] = []; if (!s || typeof s !== "object") return ["not a score"];
  if (!KEYS.includes(s.key)) bad.push("key"); if (!["major", "minor"].includes(s.mode)) bad.push("mode");
  if (!(Number.isFinite(s.bpm) && s.bpm >= 60 && s.bpm <= 140)) bad.push("bpm must be 60 to 140");
  if (!instruments.includes(s.instrument)) bad.push("instrument is not one of the pack's sounds");
  if (!Array.isArray(s.chords) || s.chords.length < 4 || s.chords.length > 16 || !s.chords.every((c: any) => typeof c === "string" && /^[A-G][#b]?m?$/.test(c))) bad.push("chords: 4 to 16 bars, one chord name each");
  if (!Array.isArray(s.melody) || s.melody.length < 4 || s.melody.length > 128) bad.push("melody: 4 to 128 notes");
  else { for (const n of s.melody) if (!(n && (n.pitch === "rest" || (midi(n.pitch) ?? 0) >= 48 && (midi(n.pitch) ?? 99) <= 84) && BEATS.includes(n.beats))) { bad.push("a note needs a pitch from C3 to C6 (or rest) and 0.5, 1, 2 or 4 beats"); break; }
    if (Array.isArray(s.chords) && s.melody.reduce((a: number, n: any) => a + (n?.beats ?? 0), 0) !== s.chords.length * 4) bad.push("the melody must fill the bars exactly"); }
  if (s.words !== undefined && !(Array.isArray(s.words) && s.words.length <= 16 && s.words.every((w: any) => typeof w === "string" && w.length <= 80))) bad.push("words: up to 16 short lines");
  return bad;
}

const DEGREES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] }, QUALITY = { major: ["", "m", "m", "", "", "m", "m"], minor: ["m", "m", "", "m", "m", "", ""] };
const PROGRESSIONS = [[0, 4, 5, 3], [0, 5, 3, 4], [5, 3, 0, 4], [0, 3, 4, 0]];
const chordsFor = (key: string, mode: "major" | "minor", prog: number[], bars: number) => { const root = NAMES.indexOf(FLAT[key] ?? key); return Array.from({ length: bars }, (_, i) => { const d = prog[i % prog.length]; return NAMES[(root + DEGREES[mode][d]) % 12] + QUALITY[mode][d]; }); };
const tones = (chord: string) => { const minor = chord.endsWith("m"), r = NAMES.indexOf(FLAT[chord.replace(/m$/, "")] ?? chord.replace(/m$/, "")); return [r, r + (minor ? 3 : 4), r + 7].map((x) => 60 + (x % 12)); };

// The plainest route: no model. The same seed always gives the same song.
export function floorScore(seed: string, instrument: string, bars = 8): Score {
  const r = rng(seed), key = KEYS[Math.floor(r() * 4)], mode = r() < 0.75 ? "major" : "minor", chords = chordsFor(key, mode, PROGRESSIONS[Math.floor(r() * PROGRESSIONS.length)], bars);
  const melody: Score["melody"] = []; let last = 64;
  for (const c of chords) { const t = tones(c), pattern = r() < 0.5 ? [1, 1, 2] : [2, 1, 1];
    for (const beats of pattern) { const near = [...t, ...t.map((x) => x + 12)].sort((a, b) => Math.abs(a - last) - Math.abs(b - last)); last = near[r() < 0.7 ? 0 : 1]; melody.push({ pitch: name(last), beats }); } }
  return { key, mode, bpm: 72 + Math.floor(r() * 5) * 6, instrument, chords, melody };
}
// The "notes" route: the model gave only pitches. The engine supplies everything else and fits the pitches to quarter notes.
export function fromNotes(line: string, seed: string, instrument: string): Score | null {
  const pitches = [...String(line).matchAll(NOTE)].map((m) => m[0]).filter((p) => { const k = midi(p); return k !== null && k >= 48 && k <= 84; });
  if (pitches.length < 8) return null;
  const bars = Math.min(16, Math.max(4, Math.floor(pitches.length / 4))), base = floorScore(seed, instrument, bars);
  return { ...base, key: "C", mode: "major", chords: chordsFor("C", "major", PROGRESSIONS[0], bars), melody: pitches.slice(0, bars * 4).map((pitch) => ({ pitch, beats: 1 })) };
}
const parse = (t: unknown): any => { if (t && typeof t === "object") return t; const s = String(t), a = s.indexOf("{"), b = s.lastIndexOf("}"); if (a < 0 || b <= a) return null; try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; } };

export function songTask(instruments: string[], about: string, prices = { audio: 6, score: 3, notes: 1 }): Task<Song> {
  const inst = instruments[0];
  return { id: "song", routes: [
    { id: "audio", needs: { audio: 1 }, stars: prices.audio, run: (ask) => ask!(`Compose a gentle 30-second instrumental piece about: ${about}`),
      accept: (raw: any) => (raw && typeof raw === "object" && typeof raw.data === "string" && /^audio\//.test(raw.mime ?? "") ? { kind: "audio", mime: raw.mime, data: raw.data } : null) },
    { id: "score", needs: { form: 1, structure: 2 }, stars: prices.score,
      run: (ask) => ask!(`Write a short song as JSON only. It is about: ${about}\n{"title": "...", "key": one of ${JSON.stringify(KEYS)}, "mode": "major" or "minor", "bpm": 60 to 140, "instrument": one of ${JSON.stringify(instruments)}, "chords": 8 chord names, one per bar, like "C" or "Am", "melody": notes as {"pitch": "E4" (C3 to C6) or "rest", "beats": 0.5, 1, 2 or 4}; the beats must add up to exactly 32, "words": up to 8 short lines}`),
      accept: (raw) => { const s = parse(raw); return s && !scoreProblems(s, instruments).length ? { kind: "score", score: s } : null; } },
    { id: "notes", needs: { notes: 1 }, stars: prices.notes, run: (ask) => ask!(`Write one line of 32 notes for a gentle melody in C major, as note names with octave numbers separated by spaces (for example: E4 G4 C5). It is about: ${about}. Only the notes.`),
      accept: (raw, seed) => { const s = fromNotes(String(raw), seed, inst); return s && !scoreProblems(s, instruments).length ? { kind: "score", score: s } : null; } },
    { id: "floor", needs: {}, stars: 0, run: async () => null, accept: (_raw, seed) => ({ kind: "score", score: floorScore(seed, inst) }) },
  ] };
}

// What a player needs: every sound as a start time, a length and a frequency. Any synthesiser can play this list.
export function timeline(s: Score): { at: number; for: number; hz: number; part: "melody" | "chord" }[] {
  const beat = 60 / s.bpm, out: ReturnType<typeof timeline> = []; let t = 0;
  for (const n of s.melody) { const k = midi(n.pitch); if (k !== null) out.push({ at: t, for: n.beats * beat * 0.95, hz: hz(k), part: "melody" }); t += n.beats * beat; }
  s.chords.forEach((c, i) => tones(c).forEach((k) => out.push({ at: i * 4 * beat, for: 4 * beat * 0.98, hz: hz(k - 12), part: "chord" })));
  return out.sort((a, b) => a.at - b.at);
}

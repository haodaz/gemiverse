// Ask Gemini 4 Neon for one consistent set of game-style UI icons as SVG, and save each to public/icons/. Run: node scripts/art/neon-icons.mjs
import { readFileSync, writeFileSync } from "node:fs";
const key = readFileSync(new URL("../../.env.local", import.meta.url), "utf8").match(/^GEMINI_API_KEY=(.+)$/m)[1].trim();
const ICONS = {
  talk: "two overlapping rounded speech bubbles, the front one with three small dots",
  desk: "a small wooden desk seen at three-quarter view with a stack of cards and a lamp on it",
  diary: "a closed notebook with an elastic band, a ribbon bookmark and a small star on the cover",
  campus: "a folded map with a path and a location pin standing on it",
  arrange: "an armchair with a curved move-arrow around it",
  abilities: "a four-point sparkle with two smaller sparkles, like a skill badge",
  outbox: "an open envelope with a small paper plane leaving it",
  mic: "a rounded studio microphone on a small stand",
  attach: "a photo card with a mountain and sun, with a plus badge at the corner",
  star: "a plump five-point star with a highlight",
  close: "a rounded X in a soft circle",
  keep: "a heart inside a rounded bookmark shape",
  skip: "a curved arrow passing over a small card",
  undo: "a rounded arrow curling back counter-clockwise",
  lock: "a small rounded padlock, closed",
  library: "an open book with a small lamp glow above it",
  clubs: "a pennant flag and a small guitar crossed",
  commons: "two cups on a small round cafe table",
  career: "a compass with a rising arrow",
  out: "a small door standing open with light coming through",
};
const prompt = `Design one consistent set of ${Object.keys(ICONS).length} UI icons for a cozy life-sim game, as SVG.

Style, the same for every icon: chunky, friendly, slightly 3D sticker look. A rounded shape with a thick soft outline in dark plum (#3d3648, stroke-width 3, round joins and caps), flat fills in a warm pastel palette (cream #fff4e0, peach #ffc9a8, butter #ffe08a, mint #a8e0c0, sky #a8d4ff, lilac #c8b4f0, rose #ff9fb5), one lighter highlight shape and one darker shadow shape per object to give volume, and a small white glint. No text, no letters, no gradients that need ids shared between icons (each icon must be self-contained), no external references. Each icon: viewBox 0 0 64 64, the object centred with 6 units of padding, readable at 28 pixels.

Icons (name: what it shows):
${Object.entries(ICONS).map(([k, v]) => `${k}: ${v}`).join("\n")}

Return only a JSON object mapping each name to its complete <svg> string. No prose.`;
const t0 = Date.now(), H = { "content-type": "application/json", "x-goog-api-key": key }, BASE = "https://generativelanguage.googleapis.com/v1beta/interactions";
let res = await fetch(BASE, { method: "POST", headers: H, body: JSON.stringify({ model: "gemini-4-neon", generation_config: { thinking_level: "medium" }, input: prompt, background: true }) });
let json = await res.json();
while (json.status && !["completed", "failed", "cancelled", "incomplete"].includes(json.status)) { await new Promise((r) => setTimeout(r, 5000)); res = await fetch(`${BASE}/${json.id}`, { headers: H }); if (res.ok) json = await res.json(); }
const text = (json.steps ?? []).filter((s) => s.type === "model_output").flatMap((s) => s.content ?? []).map((c) => c.text ?? "").join("");
const body = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
const set = JSON.parse(body.slice(body.indexOf("{"), body.lastIndexOf("}") + 1));
let n = 0; for (const [name, svg] of Object.entries(set)) if (ICONS[name] && String(svg).includes("<svg")) { writeFileSync(new URL(`../../public/icons/${name}.svg`, import.meta.url), svg); n++; }
writeFileSync(new URL("../../public/icons/_meta.json", import.meta.url), JSON.stringify({ model: "gemini-4-neon", prompt, usage: json.usage, ms: Date.now() - t0, made_at: new Date().toISOString(), saved: n }, null, 1));
console.log("icons saved", n, "of", Object.keys(ICONS).length, Date.now() - t0, "ms", json.usage?.total_tokens);

// Shared helpers for the Foundry scripts: one place that calls Gemini and records every run.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
export const root = new URL("../../base/", import.meta.url);
const env = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
const key = env.match(/^GEMINI_API_KEY=(.+)$/m)[1].trim();
const BASE = "https://generativelanguage.googleapis.com/v1beta";

export const readJson = (rel) => JSON.parse(readFileSync(new URL(rel, root), "utf8"));
export const writeJson = (rel, data) => { mkdirSync(new URL(rel.replace(/[^/]+$/, ""), root), { recursive: true }); writeFileSync(new URL(rel, root), JSON.stringify(data, null, 1)); };
export const samples = (set) => readJson("raw/index.json").filter((r) => r.set === set).map((r) => readJson(`raw/${r.id}.json`));

async function post(path, body, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${BASE}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body) });
    if (res.ok) return res.json();
    const text = await res.text();
    if (i === tries - 1 || ![429, 500, 503].includes(res.status)) throw new Error(`${res.status} ${text.slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
}

// One model call. Returns { text, usage, ms }.
// Long calls (high thinking) run in the background on Google's side and are polled,
// because a single HTTP request that waits more than five minutes times out in Node.
export async function ask(model, input, thinking = "medium") {
  const t0 = Date.now();
  let json = await post("/interactions", { model, input, generation_config: { thinking_level: thinking }, background: true });
  while (json.status && !["completed", "failed", "cancelled", "incomplete"].includes(json.status)) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch(`${BASE}/interactions/${json.id}`, { headers: { "x-goog-api-key": key } });
    if (res.ok) json = await res.json();
  }
  if (json.status !== "completed") throw new Error(`interaction ${json.status}: ${JSON.stringify(json).slice(0, 300)}`);
  const text = (json.steps ?? []).filter((s) => s.type === "model_output").flatMap((s) => s.content ?? []).map((c) => c.text ?? "").join("").trim();
  return { text, usage: json.usage, ms: Date.now() - t0, model, thinking };
}

// One Decisions API call. questions: { name: { type, instructions, ... } }
export async function decide(input, questions) {
  const t0 = Date.now();
  const json = await post("/decisions", { model: "gemini-decision-1", input, questions });
  return { answers: json.answers, usage: json.usage, ms: Date.now() - t0 };
}

export function parseJson(text) {
  const body = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = body.indexOf("{"), end = body.lastIndexOf("}");
  return JSON.parse(body.slice(start, end + 1));
}

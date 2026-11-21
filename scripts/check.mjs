// Key check: do Hydrogen, Carbon, Argon and the Decisions API answer? Run: node scripts/check.mjs
import { readFileSync } from "node:fs";

const key = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .match(/^GEMINI_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key) throw new Error("GEMINI_API_KEY missing in .env.local");

const BASE = "https://generativelanguage.googleapis.com/v1beta";

async function post(path, body) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, ms: Date.now() - t0, json, text };
}

function outputText(json) {
  return (json?.steps ?? [])
    .filter((s) => s.type === "model_output")
    .flatMap((s) => s.content ?? [])
    .map((c) => c.text ?? "")
    .join("")
    .trim();
}

const results = [];
for (const model of ["gemini-4-hydrogen", "gemini-4-carbon", "gemini-4-argon"]) {
  const r = await post("/interactions", {
    model,
    input: "Reply with exactly: ready",
    generation_config: { thinking_level: "low" },
  });
  results.push({ what: model, status: r.status, ms: r.ms,
    out: r.status === 200 ? outputText(r.json) || JSON.stringify(r.json).slice(0, 300) : r.text.slice(0, 300),
    usage: r.json?.usage ? JSON.stringify(r.json.usage).slice(0, 160) : "" });
}

const d = await post("/decisions", {
  model: "gemini-decision-1",
  input: "Poster text: 'Open Mic Night, Friday Dec 4, 7pm, Kimmel Center room 405. Free.'",
  questions: {
    is_free: { type: "noul", instructions: "Is the event free to attend?" },
    on_saturday: { type: "noul", instructions: "Is the event on a Saturday?" },
  },
});
results.push({ what: "gemini-decision-1", status: d.status, ms: d.ms,
  out: d.status === 200 ? JSON.stringify(d.json).slice(0, 500) : d.text.slice(0, 300), usage: "" });

for (const r of results) console.log(`${r.status === 200 ? "OK  " : "FAIL"} ${r.what} · ${r.status} · ${r.ms}ms\n     ${r.out}\n     ${r.usage}`);

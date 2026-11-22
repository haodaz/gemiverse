import type { Ask } from "../core/capability";

// Model adapters: each turns a prompt into text and counts what it used. Keys are passed in, read by the caller from the
// environment; nothing here knows where a key is kept. Temperature 0, plain text in and out, no provider-side JSON mode:
// the engine's own checks are what the benchmark is about.
export type Meter = { calls: number; tokens: number; errors: number };
export function openaiCompatible(base: string, key: string, model: string, meter: Meter, extra: Record<string, unknown> = {}): Ask {
  return async (prompt) => { meter.calls++;
    for (let i = 0; ; i++) { const r = await fetch(`${base}/chat/completions`, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], ...extra }) });
      if (r.ok) { const j: any = await r.json(); meter.tokens += j.usage?.total_tokens ?? 0; return j.choices?.[0]?.message?.content ?? ""; }
      if (i >= 3 || ![429, 500, 502, 503].includes(r.status)) { meter.errors++; throw new Error(`${model} HTTP ${r.status}`); } await new Promise((x) => setTimeout(x, 2500 * (i + 1))); } };
}
export function gemini(key: string, model: string, meter: Meter): Ask {
  const BASE = "https://generativelanguage.googleapis.com/v1beta", H = { "content-type": "application/json", "x-goog-api-key": key };
  return async (prompt) => { meter.calls++;
    for (let i = 0; ; i++) { const r = await fetch(`${BASE}/interactions`, { method: "POST", headers: H, body: JSON.stringify({ model, input: prompt, generation_config: { thinking_level: "low" } }) });
      if (r.ok) { let j: any = await r.json(); while (j.status && !["completed", "failed", "cancelled", "incomplete"].includes(j.status)) { await new Promise((x) => setTimeout(x, 2000)); const p = await fetch(`${BASE}/interactions/${j.id}`, { headers: H }); if (p.ok) j = await p.json(); }
        meter.tokens += j.usage?.total_tokens ?? 0; return (j.steps ?? []).filter((s: any) => s.type === "model_output").flatMap((s: any) => s.content ?? []).map((c: any) => c.text ?? "").join(""); }
      if (r.status === 401 || r.status === 403) { meter.errors++; throw new Error(`${model}: the key was refused (${r.status})`); }
      if (i >= 3 || ![429, 500, 502, 503].includes(r.status)) { meter.errors++; throw new Error(`${model} HTTP ${r.status}`); } await new Promise((x) => setTimeout(x, 4000 * (i + 1))); } };
}

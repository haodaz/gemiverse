// Every mind against the same promise (22 Nov): none, three cheap hosted models, and Gemini.   node --import ./engine/test/register.mjs engine/bench/promise.ts
import { readFileSync, writeFileSync } from "node:fs";
import { keepPromises, type Material } from "../promise";
import { openaiCompatible, gemini, type Meter } from "../adapters/models";
import { checkSet, HEAR } from "./sets";
import { campus } from "../../packs/campus";
import type { Ask } from "../core/capability";

const env = (file: string, k: string) => ((readFileSync(file, "utf8").match(new RegExp("^" + k + "=(.+)$", "m")) || [])[1] || "").trim().replace(/^["']|["']$/g, "");
const CO = "/Users/aisandbox/Documents/companydata/.env.local", EVENT = new URL("../../.env.local", import.meta.url).pathname;
const material: Material = { items: JSON.parse(readFileSync(new URL("../../base/snapshots/nyu-events.json", import.meta.url), "utf8")).items, truth: { pace: 0.6, scope: -0.5, arena: 0.4, closeness: 0.6, horizon: -0.2, structure: 0.3, collaboration: 0.6 },
  said: HEAR.map((h) => ({ text: h.text, needs: h.needs, refused: h.negated })), claims: checkSet().map((c) => ({ claim: c, isTrue: c.kind === "true", page: c.page })), sounds: ["piano", "music_box"] };
const MINDS: Record<string, (m: Meter) => Ask | null> = { "no model": () => null,
  "qwen-flash": (m) => openaiCompatible("https://dashscope.aliyuncs.com/compatible-mode/v1", env(CO, "DASHSCOPE_API_KEY"), "qwen-flash", m, { temperature: 0 }),
  "gpt-5.4-nano": (m) => openaiCompatible("https://api.openai.com/v1", env(CO, "OPENAI_API_KEY"), "gpt-5.4-nano", m),
  "gpt-4o-mini": (m) => openaiCompatible("https://api.openai.com/v1", env(CO, "OPENAI_API_KEY"), "gpt-4o-mini", m, { temperature: 0 }),
  "gemini-4-hydrogen": (m) => gemini(env(EVENT, "GEMINI_API_KEY"), "gemini-4-hydrogen", m) };
const only = process.argv.slice(2), out: any = { at: new Date().toISOString(), pack: campus.id, minds: {} };
await Promise.all(Object.entries(MINDS).filter(([n]) => !only.length || only.includes(n)).map(async ([name, make]) => { const meter: Meter = { calls: 0, tokens: 0, errors: 0 }, t0 = Date.now(), r = await keepPromises(campus, make(meter), material);
  out.minds[name] = { ...r, tokens: meter.tokens, calls: meter.calls, seconds: Math.round((Date.now() - t0) / 1000) };
  console.log(`${name.padEnd(18)} ${r.all_kept ? "ALL KEPT" : "BROKEN: " + r.promises.filter((p) => !p.kept).map((p) => p.id + " (" + p.detail + ")").join("; ")} | ${Object.entries(r.quality).map(([k, v]) => `${k} ${v}`).join(" · ")} | ${meter.tokens} tok`); }));
writeFileSync(new URL("../../base/runs/20-promise.json", import.meta.url), JSON.stringify(out, null, 1));
console.log("\npromises:"); for (const p of Object.values(out.minds as Record<string, any>)[0].promises) console.log(" -", p.id + ":", p.promise);

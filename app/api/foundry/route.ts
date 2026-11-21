import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readAll, replaceEvidence, upsertEntities } from "@/lib/server/base";
import { ask, decide, parseJson, type Question } from "@/lib/server/gemini";
import { NEEDS } from "@/lib/needs";

// The back office of the shared base: what is in it, how well checked, how fresh, how much in demand, and where the gaps are.
// POST re-checks one entity: the page is fetched again and only if its text changed are the fields filled and checked again.
const readJson = (rel: string) => { try { return JSON.parse(readFileSync(join(process.cwd(), "base", rel), "utf8")); } catch { return null; } };
const STATED = ["title", "start", "end", "venue_name", "building_name", "street_address", "organisation_name", "cost_type"];
const pageText = async (url: string) => {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; campus-events-reader)" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`page ${res.status}`);
  return (await res.text()).replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ").trim().slice(0, 12000);
};

export async function GET() {
  try {
    const { entities, evidence, links } = await readAll();
    const stats = Object.fromEntries(entities.filter((e) => e.type === "Stats").map((e) => [e.school, (e.fields as any).served ?? {}]));
    const real = entities.filter((e) => e.type !== "Stats");
    const ev: Record<string, typeof evidence> = {}; for (const x of evidence) (ev[x.entity_id] ??= []).push(x);
    const now = Date.now();
    const rows = real.map((e) => {
      const list = ev[e.id] ?? [], checkedAt = list.map((x) => +new Date(x.checked_at)).sort().pop() ?? +new Date(e.updated_at);
      const start = (e.fields as any).occurrences?.[0]?.start ? +new Date((e.fields as any).occurrences[0].start) : null;
      const hoursOld = (now - checkedAt) / 3.6e6, soon = start ? (start - now) / 3.6e6 : null;
      // freshness rule from the merged design: an event is re-checked within 48 hours of its start; everything else weekly
      const due = e.type === "Event" ? (soon !== null && soon > 0 && soon < 48 && hoursOld > 12) || hoursOld > 168 : hoursOld > 24 * 30;
      return { id: e.id, type: e.type, school: e.school, name: e.name, tier: e.tier, needs: (e.fields as any).needs ?? [], url: (e.fields as any).url ?? null, start: (e.fields as any).occurrences?.[0]?.start ?? null,
        fields: list.length, passed: list.filter((x) => x.passed).length, hashed: list.some((x) => x.content_hash), checked_at: new Date(checkedAt).toISOString(), due, served: stats[e.school]?.[e.id] ?? 0 };
    });
    // gaps: for each school, how many checked resources serve each growth need. An empty cell is where the next Gem Star should go.
    const coverage: Record<string, Record<string, number>> = {};
    for (const school of ["nyu", "columbia"]) { coverage[school] = Object.fromEntries(Object.keys(NEEDS).map((n) => [n, 0])); for (const r of rows) if (r.school === school && r.type === "Event") for (const n of r.needs) if (n in coverage[school]) coverage[school][n]++; }
    const count = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).length;
    return Response.json({
      totals: { entities: rows.length, events: count((r) => r.type === "Event"), places: count((r) => r.type === "Venue" || r.type === "Building"), organisations: count((r) => r.type === "Organisation"), links: links.length,
        fields: evidence.length, fields_passed: evidence.filter((x) => x.passed).length, served: rows.reduce((a, r) => a + r.served, 0), due: count((r) => r.due) },
      rows, coverage, needs: NEEDS,
      exam: { design: readJson("runs/05-fill-design.json"), exam: readJson("runs/05-fill-exam.json") },
      designs: ["world.v1.json", "learner.v1.json", "growth.v1.json", "assistant.v1.json", "final.v2.json"].map((f) => { const d = readJson(`design/${f}`); return { file: f, by: d?.designed_by ?? d?.status ?? "merged", at: d?.designed_at ?? d?.merged_at ?? null }; }),
    });
  } catch (e) { return Response.json({ error: String((e as Error).message) }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    const { entities, evidence } = await readAll();
    const ent = entities.find((e) => e.id === id); if (!ent) return Response.json({ error: "No such entity." }, { status: 404 });
    const url = (ent.fields as any).url as string | undefined; if (!url) return Response.json({ error: "This entity has no source page." }, { status: 400 });
    const old = evidence.filter((x) => x.entity_id === id), oldHash = old.find((x) => x.content_hash)?.content_hash ?? null;
    let text: string; try { text = await pageText(url); } catch (e) { return Response.json({ id, outcome: "unreachable", note: `The source could not be read (${(e as Error).message}). Nothing was changed.`, tokens: 0 }); }
    const hash = createHash("sha256").update(text).digest("hex").slice(0, 16);
    if (oldHash && oldHash === hash) {
      await replaceEvidence(id, old.map((x) => ({ field: x.field, quote: null, url, check_confidence: x.check_confidence, passed: x.passed, content_hash: hash, checked_at: new Date().toISOString() })) as any);
      return Response.json({ id, outcome: "unchanged", note: "The page is the same as last time. Nothing was re-read by a model.", tokens: 0, hash });
    }
    if (!oldHash && text.length > 400) {   // first visit since the base was built: remember what the page looked like, keep the existing checks
      await replaceEvidence(id, old.map((x) => ({ field: x.field, quote: null, url, check_confidence: x.check_confidence, passed: x.passed, content_hash: hash, checked_at: new Date().toISOString() })) as any);
      return Response.json({ id, outcome: "fingerprinted", note: "First revisit: the page's fingerprint is now stored. From now on a revisit costs nothing unless the page changes.", tokens: 0, hash });
    }
    // the page changed: fill the stated fields again and check each one against the new text
    const r = await ask("gemini-4-hydrogen", `Fill these fields for the campus event on the page. Use only what the page says; null if absent; never guess a year.
Return only JSON: {"title": string|null, "start": "YYYY-MM-DDTHH:MM"|null, "end": "YYYY-MM-DDTHH:MM"|null, "venue_name": string|null, "building_name": string|null, "street_address": string|null, "organisation_name": string|null, "cost_type": "free"|"paid_ticketed"|null}
PAGE
${text.slice(0, 6000)}`, "low");
    const rec = parseJson(r.text), questions: Record<string, Question> = {};
    for (const k of STATED) if (rec[k]) questions[k] = { type: "noul", instructions: `Does the page state or directly show that the ${k.replace(/_/g, " ")} is "${rec[k]}"? Answer no if it is not there or differs.` };
    const d = Object.keys(questions).length ? await decide(`PAGE TEXT\n${text.slice(0, 6000)}`, questions) : { answers: {} as Record<string, number>, usage: {} };
    const changed: string[] = [], fields = { ...(ent.fields as any) };
    for (const k of STATED) { const ok = (d.answers[k] ?? 0) >= 0.8, before = k === "start" || k === "end" ? fields.occurrences?.[0]?.[k] : fields[k];
      if (ok && String(before ?? "") !== String(rec[k])) { changed.push(k); if (k === "start" || k === "end") fields.occurrences = [{ ...(fields.occurrences?.[0] ?? {}), [k]: rec[k] }]; else fields[k] = rec[k]; } }
    await upsertEntities([{ id, type: ent.type, school: ent.school, name: (d.answers.title ?? 0) >= 0.8 ? rec.title : ent.name, fields, tier: ent.tier, ontology_version: "v2" } as any]);
    await replaceEvidence(id, [...Object.keys(questions).map((k) => ({ field: k, quote: String(rec[k]), url, check_confidence: d.answers[k], passed: d.answers[k] >= 0.8, content_hash: hash })),
      ...old.filter((x) => !(x.field in questions)).map((x) => ({ field: x.field, quote: null, url, check_confidence: x.check_confidence, passed: x.passed, content_hash: hash }))] as any);
    return Response.json({ id, outcome: "changed", changed, note: changed.length ? `The page changed. Fields updated: ${changed.join(", ")}.` : "The page text changed but no checked field did.", tokens: (r.usage.total_tokens ?? 0) + ((d.usage as any).total_tokens ?? 0), hash });
  } catch (e) { return Response.json({ error: String((e as Error).message) }, { status: 500 }); }
}

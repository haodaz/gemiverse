import "server-only";
import { readBase } from "@/lib/server/base";
import { ask, parseJson } from "@/lib/server/gemini";
import { AXES } from "@/lib/mind";
import { NEEDS } from "@/lib/needs";

// One trip: the Gemi visits a place, reads the shared base, and Carbon picks three finds by the gap rule
// (serve what the student cares about; include two that contrast on the axis it is least sure of) with a keep probability each.
export const PLACE_NEEDS: Record<string, string[]> = {
  library: ["build_a_skill", "explore_a_field", "navigate_systems", "get_mentorship_and_feedback"],
  clubs: ["find_my_people", "make_and_express", "contribute_beyond_self"],
  commons: ["rest_and_recover", "find_my_people", "contribute_beyond_self"],
  career: ["get_experience", "decide_a_direction", "fund_my_path", "get_mentorship_and_feedback"],
};
export type TripInput = { school: string; place: string; care?: Record<string, number>; beliefs?: Record<string, { m: number; u: number }>; wants?: string[]; seen?: string[]; lang?: string; thinking?: "low" | "medium" | "high" };

export async function takeTrip({ school, place, care = {}, beliefs = {}, wants = [], seen = [], lang = "en", thinking = "medium" }: TripInput) {
    const { entities, evidence } = await readBase(school === "columbia" ? "columbia" : "nyu");
    const passed: Record<string, number> = {}; for (const e of evidence) if (e.passed) passed[e.entity_id] = (passed[e.entity_id] ?? 0) + 1;
    const fits = (e: (typeof entities)[number]) => ((e.fields.needs as string[]) ?? []).some((n) => PLACE_NEEDS[place]?.includes(n));
    let pool = entities.filter((e) => fits(e) && !seen.includes(e.id));
    if (pool.length < 3) pool = entities.filter((e) => !seen.includes(e.id));          // a small base: widen rather than come back empty
    if (pool.length < 2) return { finds: [] as any[], reason: "Nothing new here that passed the checks. It came back with empty hands rather than guess.", candidates: 0, tokens: 0, ms: 0, model: "", contrast_axis: null as string | null, contrast_pair: [] as string[] };
    const cards = pool.slice(0, 14).map((e) => ({ id: e.id, title: e.name, summary: e.fields.summary, needs: e.fields.needs, kind: e.fields.event_kind ?? null, where: e.fields.venue_name ?? e.fields.building_name ?? null,
      start: (e.fields.occurrences as any)?.[0]?.start ?? null, cost: e.fields.cost_type ?? null, registration: e.fields.registration_rule ?? null, fields_checked: passed[e.id] ?? 0 }));
    const axes = AXES.map((a) => `${a.id}: -1 = ${a.left}, +1 = ${a.right}; current position ${(beliefs[a.id]?.m ?? 0).toFixed(2)}, uncertainty ${(beliefs[a.id]?.u ?? 1).toFixed(2)}`).join("\n");
    const cares = Object.entries(care as Record<string, number>).map(([k, v]) => `${k} (${NEEDS[k]?.label ?? k}): ${v}`).join(", ") || "nothing stated yet";

    const r = await ask("gemini-4-carbon", `You are the planning mind of a student's AI companion (a Gemi). It just visited "${place}" on campus and must choose exactly three things to bring back from the candidates below. It has a small budget, so it brings back treasure, not a pile.

What the student has said they care about (need: weight 0..1): ${cares}
Things they said they want or want to avoid: ${JSON.stringify(wants).slice(0, 600)}

What the Gemi currently believes about how this student chooses (seven axes; uncertainty 1.00 means it knows nothing yet):
${axes}

Rule for choosing (the gap rule): prefer candidates that serve a need the student cares about; among those, include TWO that sit on opposite sides of the axis with the highest uncertainty that is relevant to that need, so that whichever one the student keeps teaches the Gemi something. The third is simply the best match. Never pick something whose date has passed if a start is given (today is 2026-11-21). Use only the candidates; invent nothing.

For each pick give: which axes it is evidence on and in which direction (x from -1 to 1, 0.4 to 1.0 in size; only axes where the candidate clearly sits on one side), one sentence the student will read on the card saying why it was brought back (name the need in plain words; say nothing about their personality), and the probability the student keeps it.

Return only JSON:
{"reason": "one or two sentences in ${lang}: where it spent its stars and why, in the first person, plain words",
 "contrast_axis": "axis id", "contrast_pair": ["id", "id"],
 "picks": [{"id": "candidate id", "why": "in ${lang}", "evidence": [{"axis": "axis id", "x": number, "why": "short, in English"}], "p_keep": number}]}

CANDIDATES
${JSON.stringify(cards)}`, thinking);
    const plan = parseJson(r.text);
    const byId = Object.fromEntries(entities.map((e) => [e.id, e]));
    const finds = (plan.picks ?? []).filter((p: any) => byId[p.id]).slice(0, 3).map((p: any) => ({
      id: p.id, title: byId[p.id].name, fields: byId[p.id].fields, why: p.why, p_keep: p.p_keep,
      evidence: (p.evidence ?? []).filter((x: any) => AXES.some((a) => a.id === x.axis)),
      checks: evidence.filter((e) => e.entity_id === p.id).map((e) => ({ field: e.field, confidence: e.check_confidence, passed: e.passed })),
    }));
  return { finds, reason: plan.reason as string, contrast_axis: (plan.contrast_axis ?? null) as string | null, contrast_pair: (plan.contrast_pair ?? []) as string[], candidates: cards.length, tokens: r.usage.total_tokens ?? 0, ms: r.ms, model: r.model };
}

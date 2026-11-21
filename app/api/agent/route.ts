import { agentVisit, decide, type Question } from "@/lib/server/gemini";
import { readBase } from "@/lib/server/base";

export const maxDuration = 120;
// "Look again, live." The Managed Agent goes to the source page of one find right now, in its own sandbox, and reports what a reader
// sees. The Decisions API then says, field by field, whether what we stored still agrees with the live page. Nothing is changed in the
// base here; a field that no longer agrees is shown to the student as "check the page".
export async function POST(req: Request) {
  try {
    const { id, school = "nyu" } = await req.json();
    const base = await readBase(school); const ent = base.entities.find((e) => e.id === id);
    const url = (ent?.fields as any)?.url; if (!ent || !url) return Response.json({ error: "That find has no source page." }, { status: 404 });
    const stored = base.evidence.filter((e) => e.entity_id === id && e.passed && e.quote).slice(0, 8);
    const v = await agentVisit(url);
    if (v.status !== "completed" || !v.report) return Response.json({ error: `The agent could not finish (${v.status}).`, seconds: Math.round(v.ms / 1000) }, { status: 502 });
    const qs: Record<string, Question> = {}; for (const e of stored) qs[e.field] = { type: "noul", instructions: `Does the agent's report support that the event's ${e.field.replace(/_/g, " ")} is "${e.quote}"? Times may be written in 12-hour form.` };
    const d = Object.keys(qs).length ? await decide(`AGENT'S REPORT FROM THE LIVE PAGE:\n${v.report}`, qs) : null;
    const fields = stored.map((e) => { const p = d?.answers[e.field] ?? 0, c = d?.confidence[e.field] ?? 0; return { field: e.field, stored: e.quote, agrees: Math.round(p * 100) / 100, confidence: Math.round(c * 100) / 100, verdict: p >= 0.8 ? "still on the page" : p <= 0.2 && c >= 0.6 ? "page says otherwise" : "not confirmed" }; });
    return Response.json({ id, name: ent.name, url, agent: "antigravity-preview-09-2026", seconds: Math.round(v.ms / 1000), tokens: (v.usage.total_tokens ?? 0) + (d?.usage.total_tokens ?? 0), steps: v.steps, report: v.report, fields });
  } catch (e) { return Response.json({ error: String((e as Error).message) }, { status: 500 }); }
}

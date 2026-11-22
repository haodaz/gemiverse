import "server-only";

// The shared base (Supabase). Read by every Gemi; nothing here describes a person.
const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SECRET_KEY;

export type Entity = { id: string; type: string; school: string; name: string; fields: Record<string, unknown>; tier: number };
export type Evidence = { entity_id: string; field: string; quote: string | null; url: string | null; check_confidence: number | null; passed: boolean | null };

async function get<T>(path: string): Promise<T> {
  if (!URL_ || !KEY) throw new Error("The shared base is not configured on this server.");
  const res = await fetch(`${URL_}/rest/v1/${path}`, { headers: { apikey: KEY, authorization: `Bearer ${KEY}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`base ${res.status}`);
  return res.json();
}

// Chinese edition: the nine C9 schools live in local files written by scripts/foundry/12-c9.mjs. Nothing of them is in the shared base.
const NEED_FIX: Record<string, string> = { get_feedback: "get_mentorship_and_feedback", contribute: "contribute_beyond_self" };
function readLocal(school: string) { try { const { readFileSync } = require("node:fs") as typeof import("node:fs"), { join } = require("node:path") as typeof import("node:path");
    const j = JSON.parse(readFileSync(join(process.cwd(), "base", "cn", `${school}.json`), "utf8"));
    for (const e of j.entities) e.fields.needs = (e.fields.needs ?? []).map((n: string) => NEED_FIX[n] ?? n).filter((n: string) => n !== "keep_going");
    return { entities: j.entities as Entity[], evidence: j.evidence as Evidence[] }; } catch { return { entities: [] as Entity[], evidence: [] as Evidence[] }; } }
export async function readBase(school: string, type = "Event") {
  // Since 22 Nov the other schools are in the shared base too; the local files are only a fallback for a machine without the base.
  if (!["nyu", "columbia"].includes(school) && (!URL_ || !KEY)) return readLocal(school);
  const entities = await get<Entity[]>(`entities?school=eq.${encodeURIComponent(school)}&type=eq.${encodeURIComponent(type)}&select=id,type,school,name,fields,tier&order=id`);
  if (!entities.length) return { entities, evidence: [] as Evidence[] };
  const ids = entities.map((e) => `"${e.id}"`).join(",");
  const evidence = await get<Evidence[]>(`evidence?entity_id=in.(${ids})&select=entity_id,field,quote,url,check_confidence,passed`);
  return { entities, evidence };
}

// ---- writing, and the flywheel -------------------------------------------------------------------------------------------
async function send(method: string, path: string, body?: unknown, prefer = "return=minimal") {
  if (!URL_ || !KEY) throw new Error("The shared base is not configured on this server.");
  const res = await fetch(`${URL_}/rest/v1/${path}`, { method, headers: { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json", prefer }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`base ${res.status} ${(await res.text()).slice(0, 160)}`);
  return prefer.includes("representation") ? res.json() : null;
}
export const upsertEntities = (rows: Partial<Entity & { ontology_version: string }>[]) => send("POST", "entities?on_conflict=id", rows, "resolution=merge-duplicates,return=minimal");
export const replaceEvidence = async (entityId: string, rows: Omit<Evidence, "entity_id">[] & any[]) => {
  await send("DELETE", `evidence?entity_id=eq.${encodeURIComponent(entityId)}`);
  if (rows.length) await send("POST", "evidence", rows.map((r) => ({ ...r, entity_id: entityId })));
};
export async function readAll() {
  const [entities, evidence, links] = await Promise.all([
    get<(Entity & { updated_at: string; created_at: string })[]>("entities?select=id,type,school,name,fields,tier,created_at,updated_at&order=id"),
    get<(Evidence & { checked_at: string; content_hash: string | null })[]>("evidence?select=entity_id,field,check_confidence,passed,checked_at,content_hash,url"),
    get<{ from_id: string; to_id: string; rel: string }[]>("links?select=from_id,to_id,rel"),
  ]);
  return { entities, evidence, links };
}

// Demand without identity: how many times an entity has been carried back by any Gemi. One integer per entity, nothing about who.
// Kept in one row per school (type "Stats") so no person, session or time of request is stored.
export async function bumpServed(school: string, ids: string[]) {
  if (!ids.length) return;
  const id = `_stats:${school}`;
  const rows = await get<{ fields: { served?: Record<string, number> } }[]>(`entities?id=eq.${encodeURIComponent(id)}&select=fields`);
  const served = { ...(rows[0]?.fields?.served ?? {}) };
  for (const x of ids) served[x] = (served[x] ?? 0) + 1;
  await upsertEntities([{ id, type: "Stats", school, name: "anonymous counts", fields: { served }, tier: 0, ontology_version: "v2" } as any]);
}

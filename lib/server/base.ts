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

export async function readBase(school: string, type = "Event") {
  const entities = await get<Entity[]>(`entities?school=eq.${encodeURIComponent(school)}&type=eq.${encodeURIComponent(type)}&select=id,type,school,name,fields,tier&order=id`);
  if (!entities.length) return { entities, evidence: [] as Evidence[] };
  const ids = entities.map((e) => `"${e.id}"`).join(",");
  const evidence = await get<Evidence[]>(`evidence?entity_id=in.(${ids})&select=entity_id,field,quote,url,check_confidence,passed`);
  return { entities, evidence };
}

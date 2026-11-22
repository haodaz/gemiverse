import { readBase } from "@/lib/server/base";

// read_base: what the campus base already knows for one school. Costs no stars.
export async function GET(req: Request) {
  const school = (new URL(req.url).searchParams.get("school") ?? "nyu").replace(/[^a-z]/g, "");
  try {
    const { entities, evidence } = await readBase(school);
    return Response.json({ school, entities, evidence });
  } catch (e) {
    return Response.json({ school, entities: [], evidence: [], error: String((e as Error).message) }, { status: 200 });
  }
}

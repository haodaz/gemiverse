import places from "@/lib/places.json";

// The campus map of one school: landmarks named in public text, each checked, and where they sit on the drawn map.
// Bundled from base/cn/places by scripts/foundry/14-upload-local.mjs. Costs no stars.
export async function GET(req: Request) {
  const school = (new URL(req.url).searchParams.get("school") ?? "").replace(/[^a-z0-9]/g, "");
  return Response.json((places as Record<string, unknown>)[school] ?? { school, map: null, landmarks: [] });
}

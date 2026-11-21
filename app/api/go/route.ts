import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { takeTrip } from "@/lib/server/trip";
import { starsFor } from "@/lib/server/gemini";

// go_out: the Gemi visits one of the four places and decides what is worth bringing back (see lib/server/trip.ts).
// The prediction is sealed before the student sees the cards (commit and reveal).
export async function POST(req: Request) {
  try {
    const t = await takeTrip(await req.json());
    const finds = t.finds;
    if (!finds.length) return Response.json({ finds: [], reason: t.reason, stars: 0 });
    // Seal the prediction (commit and reveal). The browser gets the cards WITHOUT the numbers, plus a hash of the numbers and a
    // random nonce, plus the numbers encrypted with a key only the server has. After the student has chosen, the browser sends the
    // encrypted blob to /api/reveal, gets the numbers and the nonce back, and can recompute the hash itself.
    const predicted = Object.fromEntries(finds.map((f: any) => [f.id, f.p_keep]));
    const nonce = randomBytes(8).toString("hex"), payload = JSON.stringify({ predicted, nonce });
    const seal = createHash("sha256").update(payload).digest("hex");
    const k = createHash("sha256").update("gemiverse-seal:" + (process.env.GEMINI_API_KEY ?? "")).digest(), iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", k, iv), enc = Buffer.concat([c.update(payload, "utf8"), c.final()]);
    const sealed = Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
    for (const f of finds) delete (f as any).p_keep;
    return Response.json({ reason: t.reason, contrast_axis: t.contrast_axis, contrast_pair: t.contrast_pair, finds, seal, sealed,
      candidates: t.candidates, model: t.model, tokens: t.tokens, real_stars: starsFor({ total_tokens: t.tokens }), ms: t.ms });
  } catch (e) {
    return Response.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

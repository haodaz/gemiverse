import { createDecipheriv, createHash } from "node:crypto";

// Reveal a sealed prediction. Called only after the student has chosen. Returns the numbers and the nonce, so anyone can check
// that sha256(JSON.stringify({ predicted, nonce })) equals the hash that was shown before the choice.
export async function POST(req: Request) {
  try {
    const { sealed } = await req.json();
    const raw = Buffer.from(String(sealed), "base64"), iv = raw.subarray(0, 12), tag = raw.subarray(12, 28), enc = raw.subarray(28);
    const k = createHash("sha256").update("gemiverse-seal:" + (process.env.GEMINI_API_KEY ?? "")).digest();
    const d = createDecipheriv("aes-256-gcm", k, iv); d.setAuthTag(tag);
    const payload = Buffer.concat([d.update(enc), d.final()]).toString("utf8");
    return Response.json({ ...JSON.parse(payload), seal: createHash("sha256").update(payload).digest("hex") });
  } catch {
    return Response.json({ error: "This seal could not be opened." }, { status: 400 });
  }
}

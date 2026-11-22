import { inventPeers, meet, type Side } from "@/lib/server/meet";
import { PRESETS } from "@/lib/demo";

export const maxDuration = 120;
// Gemi to Gemi, with simulated peers invented by Carbon. The student's own side comes from the browser and is not stored here.
export async function POST(req: Request) {
  try {
    const { school = "nyu", n = 3, me } = await req.json();
    const p = PRESETS[school as string];
    const mine: Side = me ?? { gemi: p.gemiName, student: `${p.year}, ${p.field}`, public: [`${p.year} in ${p.field}`, "wants to meet people who build things for learners", "prefers small groups"],
      private: ["gets tired and anxious at big mixers", "is not sure the PhD was the right choice"], looking_for: "two or three people to talk with about making things for learners" };
    const inv = await inventPeers(school, Math.min(4, n), mine);
    const meetings = await Promise.all(inv.peers.map((peer) => meet(school, mine, peer).catch((e) => ({ peer: { gemi: peer.gemi }, error: String(e.message) }))));
    const ok = meetings.filter((m: any) => !m.error) as any[];
    return Response.json({ simulated: true, me: { gemi: mine.gemi, public: mine.public, private_count: mine.private.length }, meetings,
      totals: { peers: inv.peers.length, sent: ok.reduce((s, m) => s + m.sent, 0), held: ok.reduce((s, m) => s + m.held, 0), cards_kept: ok.filter((m) => m.card_kept).length, tokens: inv.tokens + ok.reduce((s, m) => s + m.tokens, 0) } });
  } catch (e) { return Response.json({ error: String((e as Error).message) }, { status: 500 }); }
}

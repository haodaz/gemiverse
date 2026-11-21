import { ask } from "@/lib/server/gemini";

// write_song: the Gemi's big-ticket act. Hydrogen turns what happened lately into a music brief; Lyria makes a 30-second instrumental.
// It costs six of its own Gem Stars, more than one day's allowance, so it has to save for it.
export async function POST(req: Request) {
  try {
    const { about = "", lang = "en" } = await req.json();
    const b = await ask("gemini-4-hydrogen", `A student's AI companion saved its allowance for days to write a short instrumental song about its recent days. From the notes below write ONE sentence describing the music (mood, tempo, three instruments), and a title of at most four words in ${lang}. No vocals. Return only JSON {"title": "...", "brief": "..."}.\nNOTES\n${String(about).slice(0, 1200)}`, "low");
    const j = JSON.parse(b.text.slice(b.text.indexOf("{"), b.text.lastIndexOf("}") + 1));
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" }, body: JSON.stringify({ model: "lyria-3-clip-preview", input: `${j.brief} Instrumental, no vocals, loopable.` }) });
    const out = await res.json(), audio = (out.steps ?? []).flatMap((s: any) => s.content ?? []).find((c: any) => c.type === "audio");
    if (!audio) return Response.json({ error: "The song could not be made." }, { status: 502 });
    return Response.json({ title: j.title, brief: j.brief, mime: audio.mime_type ?? "audio/mpeg", audio: audio.data, tokens: (b.usage.total_tokens ?? 0) + (out.usage?.total_tokens ?? 0) });
  } catch (e) { return Response.json({ error: String((e as Error).message) }, { status: 500 }); }
}

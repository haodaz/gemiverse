// Stills for the video's opening and ending, drawn by Gemini's image model from a screenshot of the real room.
// node scripts/art/image.mjs <name> "<prompt>" [reference.jpg]   ->  public/art/film/<name>.png (+ .meta.json)
import fs from "node:fs";
const key = fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split("\n").find((l) => l.startsWith("GEMINI_API_KEY=")).split("=").slice(1).join("=").trim();
const [name, prompt, ref] = process.argv.slice(2), MODEL = process.env.IMAGE_MODEL ?? "gemini-3-pro-image";
const input = [{ type: "text", text: prompt }]; if (ref) input.push({ type: "image", data: fs.readFileSync(ref).toString("base64"), mime_type: "image/jpeg" });
const t = Date.now();
let r = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ model: MODEL, input }) });
let j = await r.json();
while (j.status && !["completed", "failed", "cancelled", "incomplete"].includes(j.status)) { await new Promise((x) => setTimeout(x, 4000)); j = await (await fetch(`https://generativelanguage.googleapis.com/v1beta/interactions/${j.id}`, { headers: { "x-goog-api-key": key } })).json(); }
const img = (j.steps ?? []).flatMap((s) => s.content ?? []).find((c) => c.type === "image" && c.data);
if (!img) { console.log("no image", r.status, JSON.stringify(j).slice(0, 500)); process.exit(1); }
const dir = new URL("../../public/art/film/", import.meta.url); fs.mkdirSync(dir, { recursive: true });
const ext = (img.mime_type ?? "image/png").includes("jpeg") ? "jpg" : "png";
fs.writeFileSync(new URL(`${name}.${ext}`, dir), Buffer.from(img.data, "base64"));
fs.writeFileSync(new URL(`${name}.meta.json`, dir), JSON.stringify({ model: MODEL, prompt, reference: ref ?? null, seconds: Math.round((Date.now() - t) / 1000), tokens: j.usage?.total_tokens ?? null, at: new Date().toISOString() }, null, 1));
console.log(name, ext, Math.round((Date.now() - t) / 1000) + "s");

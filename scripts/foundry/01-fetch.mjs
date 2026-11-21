// Foundry step 1: fetch the raw public page for each seed event and split design / exam sets.
// No model is used here. Run: node scripts/foundry/01-fetch.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const root = new URL("../../base/", import.meta.url);
const seed = JSON.parse(readFileSync(new URL("seed/ground-truth.json", root), "utf8")).events;
mkdirSync(new URL("raw/", root), { recursive: true });

function toText(html) {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/&[a-z]+;/g, " ")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

// Design set: 11 NYU + 4 Columbia. Exam set: 7 NYU + 3 Columbia. Fixed by position, never by content.
const counters = { NYU: 0, Columbia: 0 };
const examEvery = { NYU: [2, 5, 7, 10, 12, 15, 17], Columbia: [1, 3, 5] };

const index = [];
for (let i = 0; i < seed.length; i++) {
  const e = seed[i];
  const n = counters[e.school]++;
  const set = examEvery[e.school].includes(n) ? "exam" : "design";
  const id = `${e.school === "NYU" ? "nyu" : "col"}-${String(n + 1).padStart(2, "0")}`;
  let status = 0, text = "", error = "";
  try {
    const res = await fetch(e.url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; campus-events-reader)" },
      signal: AbortSignal.timeout(20000),
    });
    status = res.status;
    if (res.ok) text = toText(await res.text());
  } catch (err) { error = String(err.message ?? err); }
  const quoteFound = text.toLowerCase().includes(e.quote.toLowerCase().slice(0, 40));
  const usable = text.length > 400 && quoteFound;
  writeFileSync(new URL(`raw/${id}.json`, root), JSON.stringify({
    id, set, school: e.school, url: e.url, fetched_at: new Date().toISOString(),
    http_status: status, error, usable, quote_found: quoteFound,
    text: text.slice(0, 12000),
  }, null, 1));
  index.push({ id, set, school: e.school, status, chars: text.length, quoteFound, usable, title: e.title.slice(0, 50) });
  console.log(`${usable ? "OK  " : "MISS"} ${id} ${set.padEnd(6)} ${status} ${String(text.length).padStart(6)} chars quote:${quoteFound ? "y" : "n"} ${e.title.slice(0, 50)} ${error}`);
}
writeFileSync(new URL("raw/index.json", root), JSON.stringify(index, null, 1));
const ok = index.filter((r) => r.usable).length;
console.log(`\n${ok}/${index.length} pages usable · design ${index.filter(r=>r.set==="design").length} · exam ${index.filter(r=>r.set==="exam").length}`);

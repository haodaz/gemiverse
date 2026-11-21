// Foundry step 1b: for pages a plain fetch cannot read, take the same event from the site's own public JSON feed.
// Records are saved as source_kind "json_feed" (one tier below a static page). Run after 01-fetch.mjs.
import { readFileSync, writeFileSync } from "node:fs";
const root = new URL("../../base/", import.meta.url);
const seed = JSON.parse(readFileSync(new URL("seed/ground-truth.json", root), "utf8")).events;
const index = JSON.parse(readFileSync(new URL("raw/index.json", root), "utf8"));
const norm = (s) => String(s ?? "").toLowerCase().replace(/[‘’“”'"]/g, "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ").trim();
const ua = { "user-agent": "Mozilla/5.0 (compatible; campus-events-reader)" };
const getJson = async (url) => { const r = await fetch(url, { headers: ua, signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error(`${r.status} ${url.slice(0, 60)}`); return r.json(); };

// NYU: LiveWhale feed, 100 per page
let nyu = [];
for (let p = 1; p <= 12; p++) {
  try {
    const page = await getJson(`https://events.nyu.edu/live/json/events/start_date/2026-11-21/end_date/2026-12-12/max/1000/response_fields/location,summary,description,image,group_title,event_types?page=${p}`);
    const rows = Array.isArray(page) ? page : page.data ?? [];
    if (!rows.length) break; nyu.push(...rows);
  } catch (e) { console.log("nyu feed", e.message); break; }
}
// Columbia: Bedework feed through Columbia Libraries' public proxy
let col = [];
// the proxy returns at most 100 records per call, so ask in three date windows
for (const [start, end] of [["2026-11-21", "2026-11-30"], ["2026-12-01", "2026-12-05"], ["2026-12-06", "2026-12-12"]]) {
  try {
    const fexpr = encodeURIComponent('(entity_type="event"|entity_type="todo")');
    const j = await getJson(`https://cdn.cul.columbia.edu/ldpd-toolkit/api/events-bw-prox-v2.json.php?burl=https://events.columbia.edu/feeder/main/eventsFeed.do&f=y&sort=dtstart.utc:asc&skinName=list-json&fexpr=${fexpr}&start=${start}&end=${end}&count=400`);
    col.push(...(j?.bwEventList?.events ?? j?.events ?? []));
  } catch (e) { console.log("columbia feed", e.message); }
}
console.log(`feeds: NYU ${nyu.length} records, Columbia ${col.length} records`);

const counters = { NYU: 0, Columbia: 0 };
for (const e of seed) {
  const n = ++counters[e.school];
  const id = `${e.school === "NYU" ? "nyu" : "col"}-${String(n).padStart(2, "0")}`;
  const row = index.find((r) => r.id === id);
  const file = new URL(`raw/${id}.json`, root);
  const rec = JSON.parse(readFileSync(file, "utf8"));
  if (rec.usable) { rec.source_kind = rec.feed ? "json_feed" : "static_html"; writeFileSync(file, JSON.stringify(rec, null, 1)); row.source_kind = rec.source_kind; continue; }
  // retry the quote test with quote marks normalised (curly vs straight)
  if (rec.text.length > 400 && norm(rec.text).includes(norm(e.quote).slice(0, 40))) {
    Object.assign(rec, { usable: true, quote_found: true, source_kind: "static_html" });
  } else {
    const pool = e.school === "NYU" ? nyu : col;
    const hit = pool.find((x) => norm(x.title ?? x.summary).includes(norm(e.title).slice(0, 25)) && norm(JSON.stringify(x)).includes(norm(e.quote).slice(0, 30)))
      ?? pool.find((x) => norm(JSON.stringify(x)).includes(norm(e.quote).slice(0, 40)));
    if (hit) {
      const text = Object.entries(hit).filter(([, v]) => v && typeof v !== "object" || (v && typeof v === "object"))
        .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join("\n")
        .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/[ \t]+/g, " ");
      Object.assign(rec, { usable: true, quote_found: true, source_kind: "json_feed", text: text.slice(0, 12000),
        feed: e.school === "NYU" ? "events.nyu.edu LiveWhale JSON" : "Columbia Bedework feed via cdn.cul.columbia.edu" });
    } else { rec.source_kind = "none"; }
  }
  writeFileSync(file, JSON.stringify(rec, null, 1));
  Object.assign(row, { usable: rec.usable, quoteFound: rec.quote_found, source_kind: rec.source_kind, chars: rec.text.length });
  console.log(`${rec.usable ? "OK  " : "MISS"} ${id} ${rec.source_kind} ${rec.text.length} chars · ${e.title.slice(0, 50)}`);
}
writeFileSync(new URL("raw/index.json", root), JSON.stringify(index, null, 1));
const by = (k) => index.filter((r) => r.source_kind === k).length;
console.log(`\nusable ${index.filter((r) => r.usable).length}/25 · static ${by("static_html")} · feed ${by("json_feed")} · none ${by("none")}`);

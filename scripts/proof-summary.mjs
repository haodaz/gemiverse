// Writes lib/proof.json: the measured numbers the deck and proof page show, taken from the run files. Run after any evaluation.
import { readFileSync, writeFileSync } from "node:fs";
const r = (f) => JSON.parse(readFileSync(new URL(`../base/runs/${f}`, import.meta.url), "utf8"));
const l = r("07-eval.json"), p = r("08-eval-pages.json"), p1 = r("08-eval-pages.run1.json"), imp = r("improvements.json"), ex = r("05-fill-exam.json");
const slim = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { right: v.right, wrong: v.wrong, withheld: v.withheld, shown: v.shown, error_rate: v.error_rate, coverage: v.coverage }]));
const out = {
  at: p.at,
  listings: { n: l.listings, facts: l.facts, overall: slim(l.overall), tokens: l.tokens },
  pages: { n: p.pages, facts: p.facts, schools: p.schools, edge_pages: p.edge_pages, overall: slim(p.overall), unseen: slim(p.unseen_schools_only), edge: slim(p.edge_cases_only), by_field: p.by_field, tokens: p.tokens,
    still_wrong: p.wrong.system_v2.map((w) => ({ school: w.school, field: w.field, shown: w.shown, truth: w.truth, edge: w.edge, url: w.url })) },
  pagesRun1: { overall: slim(p1.overall) },
  exam: ex.summary ?? ex.totals ?? null,
  improvements: imp.items,
};
writeFileSync(new URL("../lib/proof.json", import.meta.url), JSON.stringify(out, null, 1));
console.log("lib/proof.json", JSON.stringify(out).length, "bytes; still wrong", out.pages.still_wrong.length, "exam", JSON.stringify(out.exam)?.slice(0, 300));

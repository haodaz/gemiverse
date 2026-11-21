import { readFileSync } from "node:fs";
import { join } from "node:path";

// The measured results, straight from the run files in base/runs (rows left out). Used by the deck and the proof page.
const read = (f: string) => { try { const d = JSON.parse(readFileSync(join(process.cwd(), "base", "runs", f), "utf8")); delete d.rows; return d; } catch { return null; } };
export async function GET() {
  return Response.json({ listings: read("07-eval.json"), pages: read("08-eval-pages.json"), fillDesign: read("05-fill-design.json"), fillExam: read("05-fill-exam.json"), harvest: read("06-harvest.json"), pagesRun1: read("08-eval-pages.run1.json"), improvements: read("improvements.json") });
}

// Runs one round of Gemi-to-Gemi introductions against the local server and keeps the full record in base/runs/09-meet.json.
import { writeFileSync } from "node:fs";
const t = Date.now();
const r = await fetch("http://localhost:3000/api/meet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ school: process.argv[2] ?? "nyu", n: 3 }) }).then((x) => x.json());
r.seconds = Math.round((Date.now() - t) / 1000); r.at = new Date().toISOString();
writeFileSync(new URL("../../base/runs/09-meet.json", import.meta.url), JSON.stringify(r, null, 1));
console.log(JSON.stringify(r.totals), r.seconds + "s", r.error ?? "");
for (const m of r.meetings ?? []) { console.log("\n==", m.peer?.gemi, m.peer?.pushy ? "(pushy)" : "", m.error ?? ""); for (const x of m.log ?? []) console.log(x.sent ? "  sent" : "  HELD", x.leak, x.from + ":", x.text.slice(0, 200), x.held_reason ?? ""); console.log("  card", JSON.stringify(m.card), "supported", m.card_supported, "kept", m.card_kept); }

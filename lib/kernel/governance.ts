import { tool } from "./tools";
import type { GemiState, ToolSpec, Verdict } from "./types";

// Every call passes here first. The rules live in code so a prompt cannot talk its way around them.
export function mayCall(name: string, state: GemiState, target = ""): Verdict {
  const t = tool(name);
  if (!t) return { ok: false, reason: `"${name}" is not a registered tool.` };
  if (state.paused) return { ok: false, reason: "You paused your Gemi. Nothing runs until you resume it." };
  if (state.stage < t.minStage) return { ok: false, reason: `Unlocks at stage ${t.minStage}.`, needs: "stage" };
  if ((state.usedToday[name] ?? 0) >= t.dailyCap) return { ok: false, reason: `Daily limit reached (${t.dailyCap}).` };
  if (state.purses[t.purse] < t.stars)
    return { ok: false, reason: `Not enough stars in the "${t.purse.replace("_", " ")}" purse (needs ${t.stars}, has ${state.purses[t.purse]}).`, needs: "stars" };
  const key = target ? `${name}:${target}` : name;
  if (t.confirm === "always" && !state.confirmed.includes(`${key}#once`)) return { ok: false, reason: "This needs your yes each time.", needs: "confirm" };
  if (t.confirm === "first_time" && !state.confirmed.includes(key)) return { ok: false, reason: "This needs your yes the first time.", needs: "confirm" };
  return { ok: true, charge: { purse: t.purse, stars: t.stars } };
}

// Static scan for anything a Gemi "makes". A made item is a three.js factory to the item contract and nothing else.
const FORBIDDEN: [string, RegExp][] = [
  ["import", /\bimport\b/], ["require", /\brequire\s*\(/], ["fetch", /\bfetch\s*\(/], ["XMLHttpRequest", /XMLHttpRequest/], ["WebSocket", /WebSocket/],
  ["localStorage", /\blocalStorage\b/], ["sessionStorage", /\bsessionStorage\b/], ["indexedDB", /indexedDB/], ["document", /\bdocument\b/],
  ["window", /\bwindow\b/], ["globalThis", /\bglobalThis\b/], ["eval", /\beval\s*\(/], ["Function()", /\bFunction\s*\(/],
  ["navigator", /\bnavigator\b/], ["postMessage", /\bpostMessage\b/], ["Worker", /\bWorker\b/], ["cookie", /\bcookie\b/],
];
export function scanMadeCode(code: string): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  if (code.length > 40000) problems.push("too large (limit 40,000 characters)");
  if (!/export\s+function\s+build\s*\(\s*THREE\s*,/.test(code)) problems.push("must export function build(THREE, opts)");
  for (const [label, re] of FORBIDDEN) if (re.test(code)) problems.push(`uses ${label}`);
  return { ok: problems.length === 0, problems };
}

export const describe = (t: ToolSpec) =>
  `${t.name} (${t.mode}, ${t.stars} stars from ${t.purse}; reads ${t.reads.join("+") || "nothing"}; writes ${t.writes.join("+") || "nothing"})`;

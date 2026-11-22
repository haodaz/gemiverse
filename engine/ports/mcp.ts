// Connecting an application to outside data and tools through MCP (Model Context Protocol), by configuration.
// The engine does not hard-wire any base: an application lists its connections, the pipeline checks each one before use,
// and whatever comes back is material that still has to pass the gate unless the connection is declared as already checked.
//
// Written against the 2026-07-28 revision (read on 22 Nov 2026 from modelcontextprotocol.io): stateless, no initialize and
// no session; every POST carries MCP-Protocol-Version and Mcp-Method headers (Mcp-Name for tools/call) and the same version
// in params._meta; the server answers with JSON or an event stream. Older servers (up to 2025-11-25) still want the
// initialize handshake and a session id: `protocol: "legacy"` or the automatic fallback does that.
// The result shapes of tools/list and tools/call were not on the pages read; they are taken as in earlier revisions
// (tools[].name / inputSchema; content[] / structuredContent / isError). Tested against stand-in servers only, not yet a real one.
export const MODERN = "2026-07-28", LEGACY = "2025-11-25";
type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ status: number; headers: { get(n: string): string | null }; text(): Promise<string> }>;

export type ToolMap = {
  tool: string;
  args: Record<string, string | number | boolean>;        // "{school}" is filled from the scope the engine asks for
  items: string;                                           // where the list is in the result, e.g. "events" or "" for the result itself
  map: { id: string; name: string; fields: Record<string, string>; quote?: string; url?: string };   // result field -> record field
};
export type McpConnection = {
  id: string; url: string;
  protocol?: "auto" | typeof MODERN | "legacy";
  auth?: { header: string; env: string };                  // the NAME of an environment variable; a secret is never written in a config
  trust: "checked" | "unchecked";                          // "checked": the source has its own field-by-field check; "unchecked": everything goes through our gate
  provides: { read?: ToolMap; propose?: ToolMap };
};
export type AppConfig = { pack: string; model?: { adapter: string; env?: string }; connections: McpConnection[] };
export type Item = { id: string; name: string; fields: Record<string, unknown>; quote: string | null; url: string | null; from: string; needsGate: boolean };

export function configProblems(c: AppConfig): string[] {
  const bad: string[] = [], ids = new Set<string>();
  for (const k of c.connections ?? []) {
    if (!k.id || ids.has(k.id)) bad.push(`connection id "${k.id}" is missing or used twice`); ids.add(k.id);
    if (!/^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(k.url ?? "")) bad.push(`"${k.id}": the url must be https (http only for localhost)`);
    if (!["checked", "unchecked"].includes(k.trust)) bad.push(`"${k.id}": trust must be "checked" or "unchecked"`);
    if (k.auth && !/^[A-Z][A-Z0-9_]*$/.test(k.auth.env ?? "")) bad.push(`"${k.id}": auth.env must be the name of an environment variable, not a secret`);
    if (!k.provides?.read && !k.provides?.propose) bad.push(`"${k.id}": provides nothing`);
    for (const [what, m] of Object.entries(k.provides ?? {})) if (m && (!m.tool || !m.map?.id || !m.map?.name)) bad.push(`"${k.id}".${what}: needs a tool and a map with id and name`);
  }
  if (/sk-[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{20,}|eyJ[A-Za-z0-9_-]{20,}|Bearer\s+\S{16,}/.test(JSON.stringify(c))) bad.push("the config contains something that looks like a secret; use auth.env");
  return bad;
}

const META = (version: string) => ({ "io.modelcontextprotocol/protocolVersion": version, "io.modelcontextprotocol/clientInfo": { name: "gemiverse-engine", version: "0.1" }, "io.modelcontextprotocol/clientCapabilities": {} });
// One JSON-RPC answer out of a response that is either JSON or an event stream (progress notifications may come first).
function answer(type: string | null, body: string, id: number): any {
  if ((type ?? "").includes("text/event-stream")) { let last: any = null;
    for (const block of body.split(/\r?\n\r?\n/)) { const data = block.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("\n"); if (!data) continue; try { const j = JSON.parse(data); if (j.id === id) last = j; } catch { /* not ours */ } }
    return last; }
  try { return JSON.parse(body); } catch { return null; }
}

export function mcpClient(conn: McpConnection, fetchImpl: Fetch, env: Record<string, string | undefined> = {}) {
  let mode: "modern" | "legacy" | null = conn.protocol === "legacy" ? "legacy" : conn.protocol === MODERN ? "modern" : null, session: string | null = null, n = 0;
  const auth = (): Record<string, string> => { if (!conn.auth) return {}; const v = env[conn.auth.env]; if (!v) throw new Error(`"${conn.id}": the environment variable ${conn.auth.env} is not set`); return { [conn.auth.header]: v }; };
  const post = async (method: string, params: any, version: string, extra: Record<string, string> = {}) => {
    const id = ++n, legacy = version !== MODERN;
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...auth(), ...extra,
      ...(legacy ? (session ? { "Mcp-Session-Id": session, "MCP-Protocol-Version": version } : {}) : { "MCP-Protocol-Version": version, "Mcp-Method": method, ...(method === "tools/call" ? { "Mcp-Name": String(params.name) } : {}) }) };
    const r = await fetchImpl(conn.url, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id, method, params: legacy ? params : { ...params, _meta: META(version) } }) });
    return { status: r.status, sid: r.headers.get("mcp-session-id"), json: answer(r.headers.get("content-type"), await r.text(), id) };
  };
  const handshake = async () => { const r = await post("initialize", { protocolVersion: LEGACY, capabilities: {}, clientInfo: { name: "gemiverse-engine", version: "0.1" } }, LEGACY);
    if (!r.json?.result) throw new Error(`"${conn.id}": the server answered neither the ${MODERN} protocol nor the older handshake (HTTP ${r.status})`);
    session = r.sid; mode = "legacy";
    await fetchImpl(conn.url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...auth(), ...(session ? { "Mcp-Session-Id": session } : {}), "MCP-Protocol-Version": LEGACY }, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) }); };
  const call = async (method: string, params: any = {}): Promise<any> => {
    if (mode === "legacy" && !session) await handshake();
    if (mode !== "legacy") { const r = await post(method, params, MODERN);
      if (r.json?.result) { mode = "modern"; return r.json.result; }
      if (r.json?.error && (mode === "modern" || [-32020, -32021, -32022, -32601, -32602].includes(r.json.error.code) || r.status !== 400)) throw new Error(`"${conn.id}" ${method}: ${r.json.error.message ?? r.json.error.code}`);
      if (mode === "modern") throw new Error(`"${conn.id}" ${method}: HTTP ${r.status}`);
      await handshake(); }                                                                  // a 400 that is not a modern error: an older server
    const r = await post(method, params, LEGACY); if (r.json?.result) return r.json.result;
    throw new Error(`"${conn.id}" ${method}: ${r.json?.error?.message ?? "HTTP " + r.status}`);
  };
  return { call, mode: () => mode, listTools: async () => ((await call("tools/list")).tools ?? []) as { name: string; description?: string; inputSchema?: { required?: string[]; properties?: Record<string, unknown> } }[],
    callTool: async (name: string, args: Record<string, unknown>) => { const r = await call("tools/call", { name, arguments: args }); if (r.isError) throw new Error(`"${conn.id}" tool ${name} reported an error`);
      if (r.structuredContent !== undefined) return r.structuredContent; const text = (r.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join(""); try { return JSON.parse(text); } catch { return text; } } };
}

const at = (o: any, path: string): any => path === "" ? o : path.split(".").reduce((a, k) => (a == null ? undefined : a[k]), o);
const fill = (args: ToolMap["args"], scope: Record<string, string | number>) => Object.fromEntries(Object.entries(args).map(([k, v]) => [k, typeof v === "string" ? v.replace(/\{(\w+)\}/g, (_, n) => String(scope[n] ?? "")) : v]));

// The pipeline's first step, run before a connection is ever used: is the server there, does it have the tools the config
// names, and does the config give every argument those tools require? A connection that fails is not used.
export async function checkConnection(conn: McpConnection, fetchImpl: Fetch, env: Record<string, string | undefined> = {}): Promise<{ id: string; ok: boolean; protocol: string | null; problems: string[]; tools: string[] }> {
  const problems: string[] = []; let tools: Awaited<ReturnType<ReturnType<typeof mcpClient>["listTools"]>> = [], c = mcpClient(conn, fetchImpl, env);
  try { tools = await c.listTools(); } catch (e) { return { id: conn.id, ok: false, protocol: c.mode(), problems: [String((e as Error).message)], tools: [] }; }
  for (const [what, m] of Object.entries(conn.provides)) { if (!m) continue; const t = tools.find((x) => x.name === m.tool);
    if (!t) { problems.push(`${what}: the server has no tool "${m.tool}"`); continue; }
    for (const need of t.inputSchema?.required ?? []) if (!(need in m.args)) problems.push(`${what}: tool "${m.tool}" requires "${need}", which the config does not give`);
    for (const given of Object.keys(m.args)) if (t.inputSchema?.properties && !(given in t.inputSchema.properties)) problems.push(`${what}: tool "${m.tool}" has no argument "${given}"`); }
  return { id: conn.id, ok: !problems.length, protocol: c.mode(), problems, tools: tools.map((t) => t.name) };
}

// Reading through a connection: call the configured tool for a coarse scope, and turn what comes back into items.
// An item without an id or a name is dropped. Items from an unchecked connection are marked: they may not be shown before the gate has passed them.
export async function readVia(conn: McpConnection, scope: Record<string, string | number>, fetchImpl: Fetch, env: Record<string, string | undefined> = {}): Promise<Item[]> {
  const m = conn.provides.read; if (!m) throw new Error(`"${conn.id}" does not provide read`);
  const raw = await mcpClient(conn, fetchImpl, env).callTool(m.tool, fill(m.args, scope)), list = at(raw, m.items);
  if (!Array.isArray(list)) throw new Error(`"${conn.id}": the result has no list at "${m.items}"`);
  return list.map((x: any): Item | null => { const id = at(x, m.map.id), name = at(x, m.map.name); if (id == null || !name) return null;
    return { id: `${conn.id}:${id}`, name: String(name), fields: Object.fromEntries(Object.entries(m.map.fields).map(([k, p]) => [k, at(x, p) ?? null])), quote: m.map.quote ? at(x, m.map.quote) ?? null : null, url: m.map.url ? at(x, m.map.url) ?? null : null, from: conn.id, needsGate: conn.trust !== "checked" }; }).filter((x): x is Item => !!x);
}

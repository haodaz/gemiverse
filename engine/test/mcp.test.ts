// The MCP pipeline against stand-in servers: a modern one (2026-07-28, stateless), one that answers as an event stream,
// and an older one that wants the handshake. No real server has been tried yet.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mcpClient, checkConnection, readVia, configProblems, MODERN, type McpConnection, type AppConfig } from "../ports/mcp";

const TOOLS = [{ name: "list_events", description: "events of one school", inputSchema: { required: ["school"], properties: { school: {}, kind: {}, limit: {} } } }];
const EVENTS = { events: [{ id: 7, title: "Prompt Clinic", start: "2026-12-03T13:00", venue: "SPARK Lab", organiser: "Libraries", source: { quote: "Prompt Clinic: From Bad Prompts to Better Results", url: "https://lib.example/7" } }, { id: 8, title: "", start: null }, { title: "no id" }] };
const reply = (status: number, body: unknown, type = "application/json", extra: Record<string, string> = {}) => ({ status, headers: { get: (n: string) => ({ "content-type": type, ...extra } as Record<string, string>)[n.toLowerCase()] ?? null }, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) });
const seen: { headers: Record<string, string>; body: any }[] = [];
const modern = (sse = false) => async (_u: string, init: any) => { const b = JSON.parse(init.body); seen.push({ headers: init.headers, body: b });
  if (init.headers["MCP-Protocol-Version"] !== MODERN || b.params?._meta?.["io.modelcontextprotocol/protocolVersion"] !== MODERN) return reply(400, { jsonrpc: "2.0", id: b.id, error: { code: -32020, message: "HeaderMismatch" } });
  if (init.headers.Authorization !== "Bearer t0ken") return reply(401, "");
  const result = b.method === "tools/list" ? { tools: TOOLS, resultType: "complete" } : b.method === "tools/call" && b.params.name === "list_events" ? { structuredContent: EVENTS, content: [], resultType: "complete" } : null;
  const msg = result ? { jsonrpc: "2.0", id: b.id, result } : { jsonrpc: "2.0", id: b.id, error: { code: -32601, message: "no such method" } };
  return sse ? reply(200, `: keep-alive\n\ndata: {"jsonrpc":"2.0","method":"notifications/progress","params":{}}\n\ndata: ${JSON.stringify(msg)}\n\n`, "text/event-stream") : reply(result ? 200 : 404, msg); };
const legacy = async (_u: string, init: any) => { const b = JSON.parse(init.body);
  if (b.params?._meta) return reply(400, "");                                                    // does not know the modern shape
  if (b.method === "initialize") return reply(200, { jsonrpc: "2.0", id: b.id, result: { protocolVersion: "2025-11-25", capabilities: {} } }, "application/json", { "mcp-session-id": "S1" });
  if (b.method === "notifications/initialized") return reply(202, "");
  if (init.headers["Mcp-Session-Id"] !== "S1") return reply(400, "");
  return reply(200, { jsonrpc: "2.0", id: b.id, result: b.method === "tools/list" ? { tools: TOOLS } : { content: [{ type: "text", text: JSON.stringify(EVENTS) }] } }); };

const conn: McpConnection = { id: "campus-base", url: "https://base.example/mcp", auth: { header: "Authorization", env: "BASE_TOKEN" }, trust: "unchecked",
  provides: { read: { tool: "list_events", args: { school: "{school}", kind: "event", limit: 200 }, items: "events", map: { id: "id", name: "title", fields: { start: "start", venue_name: "venue" }, quote: "source.quote", url: "source.url" } } } };
const env = { BASE_TOKEN: "Bearer t0ken" };

test("a modern server: every request carries the version in the header and in _meta, and the tool's name", async () => {
  seen.length = 0; const c = mcpClient(conn, modern() as any, env); assert.deepEqual((await c.listTools()).map((t) => t.name), ["list_events"]); await c.callTool("list_events", { school: "nyu" });
  assert.equal(c.mode(), "modern"); assert.equal(seen[0].headers["Mcp-Method"], "tools/list"); assert.equal(seen[1].headers["Mcp-Name"], "list_events");
  assert.equal(seen[1].body.params._meta["io.modelcontextprotocol/protocolVersion"], MODERN); assert.ok(!("Mcp-Session-Id" in seen[1].headers));
});
test("the same over an event stream, with a progress note before the answer", async () => {
  assert.deepEqual((await mcpClient(conn, modern(true) as any, env).listTools()).map((t) => t.name), ["list_events"]);
});
test("an older server: the client falls back to the handshake and a session", async () => {
  const c = mcpClient(conn, legacy as any, env); assert.equal((await c.listTools()).length, 1); assert.equal(c.mode(), "legacy");
  assert.equal((await c.callTool("list_events", { school: "nyu" }) as any).events.length, 3);    // a result given as text is read as JSON
});

test("the pipeline checks a connection before it is used", async () => {
  assert.deepEqual(await checkConnection(conn, modern() as any, env), { id: "campus-base", ok: true, protocol: "modern", problems: [], tools: ["list_events"] });
  const wrongTool = await checkConnection({ ...conn, provides: { read: { ...conn.provides.read!, tool: "search" } } }, modern() as any, env); assert.deepEqual(wrongTool.problems, ['read: the server has no tool "search"']);
  const noArg = await checkConnection({ ...conn, provides: { read: { ...conn.provides.read!, args: { colour: "red" } } } }, modern() as any, env);
  assert.deepEqual(noArg.problems, ['read: tool "list_events" requires "school", which the config does not give', 'read: tool "list_events" has no argument "colour"']);
  const noKey = await checkConnection(conn, modern() as any, {}); assert.equal(noKey.ok, false); assert.match(noKey.problems[0], /BASE_TOKEN is not set/);
  const down = await checkConnection(conn, (async () => { throw new Error("connect ECONNREFUSED"); }) as any, env); assert.equal(down.ok, false);
});

test("reading through a connection: mapped items, the scope filled in, incomplete items dropped, unchecked material marked for the gate", async () => {
  seen.length = 0; const items = await readVia(conn, { school: "nyu" }, modern() as any, env);
  assert.deepEqual(seen[0].body.params.arguments, { school: "nyu", kind: "event", limit: 200 });
  assert.deepEqual(items, [{ id: "campus-base:7", name: "Prompt Clinic", fields: { start: "2026-12-03T13:00", venue_name: "SPARK Lab" }, quote: "Prompt Clinic: From Bad Prompts to Better Results", url: "https://lib.example/7", from: "campus-base", needsGate: true }]);
  assert.equal((await readVia({ ...conn, trust: "checked" }, { school: "nyu" }, modern() as any, env))[0].needsGate, false);
});

test("a config is checked: no secret in it, https, a known trust level", () => {
  const example: AppConfig = JSON.parse(readFileSync(new URL("../../gemiverse.config.example.json", import.meta.url), "utf8")); assert.deepEqual(configProblems(example), []);
  const bad: AppConfig = { pack: "campus", connections: [{ ...conn, url: "http://base.example/mcp", trust: "sure" as any, auth: { header: "Authorization", env: "Bearer abcdefghijklmnopqrstuvwxyz" } }, { ...conn }] };
  const why = configProblems(bad).join(" | "); for (const part of ["must be https", "trust must be", "not a secret", "used twice", "looks like a secret"]) assert.ok(why.includes(part), part + " :: " + why);
});

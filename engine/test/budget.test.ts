// The budget is the application's to set. Each test below is a different product's rules, run by the same replay.
import test from "node:test";
import assert from "node:assert/strict";
import { replay } from "../core/replay";
import { validatePack } from "../core/predicate";
import { campus } from "../../packs/campus";
import type { Budget, Event, WorldPack } from "../core/types";

let k = 0; const ev = (e: any): Event => ({ id: `b${++k}`, at: `t${k}`, ...e });
const day = (d: string) => ev({ type: "day", date: d }), intent = (call: string, tool: string, by: "self" | "person", purse: string, stars: number) => ev({ type: "intent", call, tool, by, purse, stars }), result = (call: string, tokens?: number, ok = true) => ev({ type: "result", call, ok, tokens });
const withBudget = (b: Partial<Budget>, tools = campus.tools): WorldPack => ({ ...campus, tools, budget: { ...campus.budget, ...b } });

test("what the person asks for: free in one product, charged in another, and a tool can be the exception", () => {
  const log = [day("d1"), intent("a", "go_out", "person", "for_you", 3), result("a")];
  assert.equal(replay(campus, log).purses.for_you, 6);                                                             // campus: asking is free
  const charged = withBudget({ asked: { charge: "price" } }); assert.deepEqual(validatePack(charged), []);
  assert.equal(replay(charged, log).purses.for_you, 3); assert.equal(replay(charged, log).spent.for_you, 3);       // another product: asking costs the listed price
  const exception = withBudget({ asked: { charge: "price" } }, campus.tools.map((t) => (t.name === "go_out" ? { ...t, asked: "free" as const } : t)));
  assert.equal(replay(exception, log).purses.for_you, 6);                                                          // ...except for this one tool
  const fromOwn = withBudget({ asked: { charge: "price", purse: "for_itself" } });
  assert.deepEqual(replay(fromOwn, log).purses, { for_you: 6, for_itself: 1 });                                    // or charged to a purse the product names
});

test("a star's worth and how a call is settled: by the price list, or by the tokens it really used", () => {
  const fixed = replay(campus, [day("d1"), intent("a", "go_out", "self", "for_you", 3), result("a", 9000)]); assert.equal(fixed.spent.for_you, 3);
  const metered = withBudget({ settle: "metered", tokensPerStar: 1500 });
  const over = replay(metered, [day("d1"), intent("a", "go_out", "self", "for_you", 3), result("a", 7000)]); assert.equal(over.spent.for_you, 5); assert.equal(over.purses.for_you, 1);        // 7,000 tokens is 5 stars: 2 more are taken
  const under = replay(metered, [day("d1"), intent("a", "go_out", "self", "for_you", 3), result("a", 1000)]); assert.equal(under.spent.for_you, 1); assert.equal(under.purses.for_you, 5);    // 1,000 tokens is 1 star: 2 come back
  const dry = replay(metered, [day("d1"), intent("a", "go_out", "self", "for_you", 3), result("a", 60000)]); assert.equal(dry.spent.for_you, 6); assert.equal(dry.purses.for_you, 0);        // it cannot go below empty
  const cheap = replay(withBudget({ settle: "metered", tokensPerStar: 10000 }), [day("d1"), intent("a", "go_out", "self", "for_you", 3), result("a", 7000)]); assert.equal(cheap.spent.for_you, 1);   // a different exchange rate
});

test("how stars are earned: a daily grant, by doing things (with a cap a day), or bought into a jar", () => {
  const p = withBudget({ purses: { for_you: { daily: 2, carry: "lost" }, for_itself: { daily: 0, carry: "savings" } },
    earn: [{ id: "said_how_today_was", to: "for_itself", stars: 2, perDay: 1 }, { id: "looked_at_a_find", to: "for_you", stars: 1, perDay: 3 }, { id: "streak_7_days", to: "for_itself", stars: 10 }] });
  assert.deepEqual(validatePack(p), []);
  const s = replay(p, [day("d1"), ev({ type: "earn", source: "said_how_today_was" }), ev({ type: "earn", source: "said_how_today_was" }), ev({ type: "earn", source: "looked_at_a_find", times: 5 }), ev({ type: "earn", source: "streak_7_days" }), ev({ type: "earn", source: "made_up" })]);
  assert.deepEqual(s.purses, { for_you: 5, for_itself: 12 });                                                      // 2 + 3 (capped at three a day); 2 (once a day) + 10; an unknown way of earning gives nothing
  assert.equal(replay(p, [day("d1"), ev({ type: "earn", source: "said_how_today_was" }), day("d2"), ev({ type: "earn", source: "said_how_today_was" })]).savings, 2);   // the cap is per day
  const jar = withBudget({ reservoir: { seed: 5, cap: 20 }, purses: { for_you: { daily: 3, carry: "reservoir" }, for_itself: { daily: 0, carry: "lost" } }, earn: [{ id: "pack", to: "reservoir", stars: 10, cost: { amount: 1, unit: "USD" } }] });
  const j = replay(jar, [day("d1"), ev({ type: "earn", source: "pack", times: 3 })]); assert.equal(j.reservoir, 20); assert.equal(j.purses.for_you, 3);   // the jar has a lid
});

test("how much may be spent, on the person and on itself: purses of any size, and a cap a day", () => {
  const p = withBudget({ purses: { for_you: { daily: 20, carry: "lost", spendCap: 5 }, for_itself: { daily: 0, carry: "lost" } } });
  const s = replay(p, [day("d1"), intent("a", "go_out", "self", "for_you", 3), result("a"), intent("b", "go_out", "self", "for_you", 3), result("b")]);
  assert.equal(s.spent.for_you, 5); assert.equal(s.purses.for_you, 15);                                           // the second call could only take two
  const oneJar = withBudget({ purses: { stars: { daily: 12, carry: "lost" } } }, campus.tools.map((t) => ({ ...t, purse: t.purse ? "stars" : null })));
  assert.deepEqual(replay({ ...oneJar, policy: [{ id: "rest", when: { always: true }, then: { state: "rest", tool: null, purse: null, stars: 0 } }] }, [day("d1"), intent("a", "go_out", "self", "stars", 3), intent("b", "write_diary", "self", "stars", 1)]).purses, { stars: 8 });   // or no split at all
});

test("whatever the rules, undo never refunds and a failed call gives the stars back", () => {
  for (const b of [{}, { asked: { charge: "price" as const } }, { settle: "metered" as const }]) { const p = withBudget(b), i = intent("a", "go_out", "self", "for_you", 3);
    assert.equal(replay(p, [day("d1"), { ...i, undone: true }, result("a")]).purses.for_you, 3); assert.equal(replay(p, [day("d1"), i, result("a", undefined, false)]).purses.for_you, 6); }
});

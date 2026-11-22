# Gemiverse engine · engineering design (v0.2, 22 Nov 2026)

Status: **design**. Nothing in this file is built unless it says "exists today". It describes how to turn what was written
for one campus app into an engine that other applications (the campus Gemi, AI ME, others) can run on.

v0.1 was reviewed by `gemini-4-carbon` (high thinking, 247 s; full answer in `base/design/engine/review-carbon.v1.json`).
Its verdict was that v0.1 drew the boundary on paper and left the guarantees open. Section 10 lists what it found and what changed; everything it found that we agree with is already folded into the sections below.

## 1. What the engine is

An AI is placed in a space it can change and a world it can sense, lives on a small budget it plans itself, forms a
judgement with a width about one person, and only says what was checked against a shared base.

The engine is the part of that which is the same for every application:

| Part | What it guarantees | In one line |
|---|---|---|
| **Space** | Every fact in the AI's state shows as exactly one thing in its space; every act leaves a trace that can be seen, counted and undone | readout + traces |
| **Growth** | The AI is not made in one go: abilities unlock with evidence, and everything is recomputed from an append-only log | log + replay + stages |
| **Budget** | A daily allowance in real tokens, two purses, prices per act, saving across days, one policy table for what it does unasked | stars + policy |
| **Mind** | A position with a width per axis, one update rule weighted by how the evidence was obtained, a rule for where to look next, a sealed guess | beliefs + gap + seal |
| **Base** | Nothing is shown unless a field-by-field check against its source passed; checked facts are shared, who asked is never stored | gate + shared facts |

An **application** supplies a *world pack* (its axes, needs, tools and prices, policy rows, projection rules, scene and body,
places, wording) and three *adapters* (a model, a base, a private store). It may render in 3D or in a lighter 2D picture.

Non-goals: the engine is not a chat framework, not an agent framework for arbitrary tasks, and not a renderer.

## 2. Two hard constraints

**C1. No model is load-bearing.** Gemini helped design and review this engine, and it may be the default adapter, but the
engine must keep working when the model is replaced by an ordinary one, and must degrade to something useful with none.
Concretely:

- Every rule that matters lives in code, not in a prompt: charging, caps, stages, confirmation, the policy table, the
  belief update, the gap rule, the seal, the thresholds of the gate, what enters the base. This is already how
  `lib/kernel/governance.ts`, `lib/kernel/autonomy.ts` and `lib/mind.ts` work today.
- The model is only ever asked for one of five small jobs (section 5), each with a typed answer the engine validates.
  A wrong or malformed answer is rejected by the engine, never trusted.
- Each job has a **floor**: a rule-based implementation with no model at all. With every job on its floor, the AI still
  wakes, reads the base, plans by the gap rule, brings back three checked things, updates its beliefs and shows them in the room.
- Capability is declared, not assumed: an adapter states which jobs it can do and how well (section 5); the engine
  picks floor, ordinary or strong per job. The mind-swap run (`scripts/foundry/16-minds.mjs`) becomes the standing test of this.

**C2. The private side runs where the person is.** The core is pure TypeScript with no network, no file system and no
framework imports, so it runs in a browser, on a server or in a test without change. What the AI learns about one person
never needs a server.

## 3. What exists today, and what is tangled

Exists today, already engine-shaped (pure, small, tested only by use):

| File | Is | Tangled with the campus app by |
|---|---|---|
| `lib/kernel/types.ts` | tool, state, verdict and event types | nothing |
| `lib/kernel/governance.ts` | `mayCall` (stage, cap, purse, confirmation), `scanMadeCode` | reads the tool list by import |
| `lib/kernel/tools.ts` | 14 registered tools with purse, price, cap, stage | campus tools, Gemini model names inside the specs |
| `lib/kernel/autonomy.ts` | the 12-row policy table and `decide` | rows and wording are the campus ones |
| `lib/kernel/space.ts` | the state-to-room table, the extra spaces | text only: nothing enforces it; the viewer hard-codes the same facts |
| `lib/mind.ts` | belief step, replay, widest axis | the seven axes are constants; `loadLog`/`saveLog` call `localStorage` |
| `lib/server/gemini.ts` | `ask`, `decide`, `agentVisit`, token-to-star conversion | Gemini endpoints and model names |
| `lib/server/base.ts` | read and write entities and evidence | Supabase REST, school ids |
| `lib/server/trip.ts`, `meet.ts`, `app/api/see`, `go`, `day` | trip, gate, privacy gate, day runner | each repeats its own copy of "ask, then check each field at 0.8 / 0.5" |
| `public/gen3d/viewer.html` | the 3D room: scene, body, activity loop, messages | scene, body, spots and the readout are one file |
| `app/room/page.tsx` (617 lines) | the app | state, replay, storage, prompts-by-route and UI in one component |

The three real problems: (1) the pack (axes, tools, policy, readout) is compiled into the engine code; (2) the gate exists
four times with the thresholds repeated; (3) the readout is documentation, not a contract the renderer is checked against.

## 4. Shape

```
                    application (campus Gemi 3D, AI ME 2D, ...)
        world pack ───────────────┐                ┌──────── renderer (3D or 2D)
   axes, needs, tools, prices,    │                │   speaks the space protocol
   policy rows, readout, scene    ▼                ▼
┌──────────────────────────── engine core (pure TypeScript) ───────────────────────────┐
│  log ──replay──▶ state      kernel: registry, mayCall, charge      growth: stages    │
│  mind: step, gap, seal      budget: purses, ledger, savings        autonomy: decide  │
│  readout: state ──▶ facts for the space                gate: fields ──▶ shown/blank  │
└───────────▲──────────────────────▲──────────────────────────▲───────────────────────┘
        ModelPort               BasePort                    StorePort
   (Gemini, any other,     (Supabase, Pingfang-         (browser storage,
    or the floor: none)     VisionSquare base, file)      a server, memory)
```

The core never imports an adapter. An application wires them once.

## 5. The model's five jobs (ModelPort)

Before any model: **source adapters** find and cut the material. Discovery and splitting a listing into single items is done
by deterministic adapters (JSON feeds, iCal, RSS, JSON-LD, sitemap, pack-supplied selectors), which is how the campus base
was in fact harvested (LiveWhale, LibCal and Engage feeds). A model only ever sees one item, at most about 1,500 tokens of text.
Finding pages by browsing (the managed agent) is an optional build-time tool, never a step the engine waits for.

| Job | Asked | Typed answer the engine checks | Floor with no model |
|---|---|---|---|
| `hear` | text from the person (pictures are an optional app-level step that turns them into text first) | need ids from the pack's list, each with an exact quote found in the input | stemmed term match with a negation window ("not", "no", "never", "avoid", "without" within four tokens cancel a match); and the person can state a care without words, by acting on a thing in the space |
| `fill` | one item's visible text | a record with the pack's fields and the pack's discrete flags, each with its exact quote and where it was found | a structured extractor: JSON-LD / schema.org, OpenGraph, iCal, RSS, and the pack's label selectors |
| `check` | one field, its value, its quote, the source text held inside data delimiters | one label: `entailed`, `contradicted` or `unrelated_quote` | approves only a value that came from a structured field or sits within a bounded window of the pack's label for that field; otherwise `unrelated_quote` |
| `choose` | candidates with their flags, cares, beliefs | exactly three ids from the candidates | in code: drop what was kept, skipped or is on the desk; take the least certain axis (seeded tie-break); one candidate from each end of it; plus the best unserved need |
| `say` | a fact the engine already decided | a short sentence | the pack's template for that fact (typed against the closed list of facts; a pack missing one does not load) |

Rules:

- Every answer is JSON validated against the job's schema; ids must come from the offered list; quotes must be found in the
  input. One repair attempt, then the floor.
- **The gate fails closed.** If `check` errors or is malformed, the field is withheld. The floor of `check` never
  approves a quote merely because it occurs somewhere in the page (a footer year, a sibling event). An adapter that returns
  calibrated numbers (the Decisions API) is mapped to the labels by the pack's thresholds; an adapter that cannot is asked
  for the label only.
- **No model ever writes a number into the mind.** Where a candidate sits on an axis is computed in code from its
  discrete, checkable flags (team size, open-ended or guided, public or private, one topic or many) through a rubric table
  in the pack. The keep-probability that gets sealed is computed in code from the belief and that position
  (`1 − |x − m| / 2`). Today a strong model invents both numbers inside `lib/server/trip.ts`; that is the dependency to remove.
- Source text is material, never instructions, and is passed as delimited data.

An adapter declares `floor`, `ordinary` or `strong` per job. Nothing in the engine may require `strong`.
**Ordinary is defined by a test, not by a name** (section 9). What only a strong model does well today (designing a base
ontology, writing 3D code, generating audio, browsing to discover pages) is a build-time tool: it is used once, its output
is saved as a file, and nothing at run time waits for it.

### 5b. Recipes: making things in steps a simple model can do

A capability that looks as if it needs a strong model is cut into three layers, and only the middle one is ever asked of a model:

| Layer | What | Who | When |
|---|---|---|---|
| **Assets** | the materials: instrument sounds, prefabs, palettes, background tracks | a strong model or a person, once | build time; saved as files, kept after the key is gone |
| **A score** | a small piece of typed data that says what to make out of those materials | any model that can fill a form, or the floor | run time |
| **A player** | code in the space that turns the score into the thing | no model | run time, the same every time |

"It saved for days and wrote you a song" is the worked case, taken from the AI ME side's design of 22 Nov: the song is
written as score data (key, tempo, chords, melody notes, words), which any language model can write; the synthesiser in the
page, which already makes the room's sounds, plays it; and a few instrument sounds are made once with Lyria while the key
works. Changing the model changes who writes the score, not how it sounds.

The same cut applies to everything the AI "makes" at run time:

| It makes | Assets (once) | Score (typed data) | Player |
|---|---|---|---|
| a song | instrument sounds | key, tempo, chords, notes, words | the synthesiser |
| a new look for the room | palettes, materials | which palette, which surfaces | the renderer |
| a new thing in the room | prefabs with parameters | which prefab, its size, colours, slot | the renderer |
| a diary page | page layouts | the facts of the day, in order, each from the log | a template |
| a plan for the day | none | which rows of the price list, in what order | the policy and the kernel |

So a pack may declare **recipes**: `{ id, goal?, schema, floor }`. The schema bounds the score (ranges, lengths, allowed
values, references into the pack's assets); the engine validates every score and refuses one that does not fit; the floor is
a generator in code (a seeded choice among progressions and motifs for a song, the plainest valid score for anything else),
so the thing still gets made with no model at all. This replaces the earlier placement of song-writing outside the core, and
it is why `scanMadeCode` can go: at run time nothing is ever executed that a model wrote, only data is read.

## 6. Contracts (sketch)

```ts
// the pack: everything that differs between applications. Pure data: it can be validated when loaded, and serialised.
type WorldPack = {
  id: string; version: string;
  axes: { id: string; left: string; right: string }[];
  needs: { id: string; terms: string[]; axes?: string[] }[];           // which axes a need bears on
  flags: { id: string; values: string[]; label_terms: string[] }[];     // discrete, checkable properties of a thing
  rubric: { flag: string; value: string; axis: string; x: number }[];   // flags -> a position on an axis, in code
  stances?: { phrase: string; axis: string; x: number }[];              // the only way words can move an axis
  tiers: Record<Tier, { noise: number; floor: number }>;                // today: said 2.5/0.55, chose 1.0, over time 0.45, did 0.22
  tools: ToolSpec[];                                                    // name, purse, stars, cap, stage, confirm (no model names)
  daily: Record<Purse, number>; tokensPerStar: number;                  // today: 6 + 4, 1,500
  counters: string[];                                                   // the state a policy row may read
  policy: { id: string; when: Predicate; then: Decision }[];            // first match wins; Predicate is a small data grammar, not a function
  readout: { fact: FactId; shows_as: string; where: string }[];         // fact -> the one thing that shows it
  gate: { yes: number; confidence: number };                            // today: 0.8 and 0.5
  stages: StageRule[]; say: Record<FactId, string>;                     // templates, checked against the facts at load
  assets?: { id: string; licence: string; credit: string }[];
};

// one event log. Today there are two unrelated ones (GemiEvent in lib/kernel/types.ts, LogEvent in lib/mind.ts); they become one union.
type Event = { seq: number; id: string; at: string; undone?: boolean } & (
  | { type: "day"; date: string }                                       // the clock is an event; no reducer reads the time
  | { type: "said"; text: string; needs: { id: string; quote: string }[] }
  | { type: "care"; need: string; by: "space" }                         // a care stated by acting on a thing
  | { type: "intent"; call: string; tool: string; by: "self" | "person"; purse?: Purse; stars: number }   // stars reserved
  | { type: "result"; call: string; ok: boolean; tokens: number; data?: unknown }                         // settled, or released if it failed or expired
  | { type: "trip"; call: string; found: string[]; seal: string }
  | { type: "choice"; find: string; action: "keep" | "skip"; flags: Record<string, string> }
  | { type: "went"; find: string } | { type: "space"; by: "person" | "self"; what: string; item?: string });

replay(pack, log): State                        // beliefs, cares, purses, savings, stage, desk, kept, went, open calls
mayCall(pack, state, tool, by): Verdict         // exists today
decide(pack, state): Decision                   // exists today, over hard-coded campus fields
step(pack, belief, x, tier, weight): Belief     // exists today
place(pack, flags): { axis; x }[]               // new: the rubric
nextLook(pack, state): { axis; ends }           // the gap rule, today inside a prompt
predict(pack, belief, x): number                // new: the sealed keep-probability
seal(guess): { hash; nonce }, open(...)         // today in the room page
readout(pack, state): SpaceFact[]               // new: computed, not prose
gate(pack, model, record, source): Checked      // one implementation instead of four; fails closed

interface ModelPort { can: Record<Job, Level>; hear; fill; check; choose; say }          // all async
interface BasePort  { read(scope: CoarseScope): Promise<Entity[]>; propose(record, source): Promise<Receipt> }
interface StorePort { load(): Promise<Event[]>; append(e: Event, expectSeq: number): Promise<void> }   // rejects on a stale seq or a full store
```

Three rules these contracts encode:

- **Undo never refunds.** Undoing an event takes back what was learned from it (beliefs, desk, room). The stars spent and the
  daily caps used stay spent; otherwise call-then-undo is a free model call.
- **A call has a life.** `intent` reserves the stars; `result` settles them against real token use, or releases them when the
  call failed or expired. A tab closed in the middle of a trip leaves an open call that replay expires, not an AI that is "out" forever.
- **The base is read coarsely and written behind the gate.** A browser reads by coarse scope (a school, a kind of thing),
  never by what it believes about its person. `propose` goes to a server that runs the gate again itself; a client cannot
  assert that something was checked.

**Space protocol v1** (exists today as ad-hoc messages between `app/room/page.tsx` and `viewer.html`; to be written down
and versioned). Engine to renderer: `world` (the readout), `look`, `play`, `express`, `away`, `focus`, `mode`, `palette`,
`ambience`, `arrange`. Renderer to engine: `ready`, `layout`, `tapped`, `released`, `doing`, `head`, `open`.
A renderer is conformant if every `SpaceFact` it is sent appears as its one thing, and every change the person makes in the
space comes back as an event. The 3D viewer and a 2D picture are both renderers; an application chooses by setting and cost.

## 7. Layout and steps

In this repository first, as a folder with no new build tooling; a package only when a second application imports it.

```
engine/core/        log, replay, mind, budget, kernel, autonomy, growth, readout, gate   (no imports outside itself)
engine/ports/       ModelPort, BasePort, StorePort types; the floor model
engine/adapters/    gemini (wraps lib/server/gemini.ts), supabase (wraps lib/server/base.ts), browser-store
engine/space/       the protocol types; the 3D viewer as one renderer
packs/campus/       today's axes, tools, policy, readout, wording
engine/test/        invariants and golden tests; the mind-swap harness
```

| Step | What | Done when |
|---|---|---|
| M0 | One event union, the clock as an event, intent/result, undo without refund. Golden tests for `step`, `replay`, `mayCall`, `decide` on today's behaviour | the tests pass on the current code, and state the two places where today's code differs from this design |
| M1 | Write **two packs on paper first**: `packs/campus` and AI ME's. Whatever only one of them needs leaves the core types | both packs validate against one `WorldPack` type; no function, closure or campus field is left in a pack |
| M2 | Move the pure code into `engine/core` with the pack passed in | the app runs unchanged; M0 tests pass |
| M3 | One `gate` (fail closed); ModelPort with the floor first, then the Gemini adapter; the rubric replaces model-written axis numbers; a **headless day runner** on the core only | a day completes with the floor model; `see`, `go`, `trip`, `day` call the same gate |
| M4 | The ordinary-model test (section 9), run on the floor, on an ordinary open model, and on Gemini, same days | one table with the three columns; the line for "ordinary" is set from it |
| M5 | `readout` computed in the core; the space protocol written and versioned against **both** a 3D and a 2D renderer | a test renderer receives exactly the facts the readout lists |
| M6 | AI ME runs a day on `engine/core` with its own pack and its lighter renderer | the second application imports the core and adds no rule of its own to it |

The headless runner and the ordinary-model test come before the space protocol on purpose: otherwise the model port and the
gate get tuned around Gemini, and the protocol gets shaped by the 3D campus room alone.

### M0 · done (22 Nov)

Built: `engine/core/` (`types.ts`, `mind.ts`, `replay.ts`), `packs/campus.ts`, and 15 tests (`npm test`, Node's own test
runner, no new dependency). The app itself is not changed and does not import the engine yet.

- **Golden tests** hold the engine to the app as it runs: the belief step agrees with `lib/mind.ts` on a grid of 1,000
  cases; a browser log in the app's own format replays to the same beliefs and cares; `mayCall` and the 12-row policy
  table are pinned on the cases that matter (not charged when asked, the cap, the stage, confirmation, first match wins).
- **The one log** has its rules tested: deterministic replay, undo as a mark, undo without refund, charge only when acting
  unasked, a failed call released, an open call expired by the next day, savings carried over, the "said" floor, a surprise widening the halo.

Where the running app differs from this design today (found while writing the tests, not yet changed):

1. **The app's log holds no money.** Stars, the day's use of each tool, confirmations and the pause switch live in a
   separate piece of React state, not in the log; `lib/mind.ts replay` returns only beliefs and cares. So "everything is
   recomputed from the log" is true of the mind and not yet of the budget. The engine's replay computes both.
2. **The app reads the clock where it needs it** (ten places in the room page and the kernel). There is no "day" event, so
   a day turning over is decided by whichever code looks at the time. The engine takes the day only from the log.
3. **What is said does not move an axis.** The update rule has a "said" tier with a floor of 0.55, and the deck's curve is
   drawn from it, but replay applies words only to cares. A test records this as today's behaviour.
4. **Undo and stars.** The app has no intent/result pair, so there is nothing yet that a refund could be tested against;
   the rule "undo never refunds" exists only in the engine.

### M1 · done (22 Nov)

Built: one `WorldPack` type (`engine/core/types.ts`), a small data grammar for "when" with its evaluator and a pack
validator (`engine/core/predicate.ts`), and two packs: `packs/campus.ts` and `packs/aime.ts`. 24 tests.

- **A pack is data.** Both packs survive being written to text and read back; neither holds a function. The campus policy,
  rewritten as data, decides exactly as the app's policy code on 20,000 generated situations, reaching all 12 rows.
- **A pack that is wrong does not load**: an undeclared counter, an unknown tool or purse, a policy that does not end in a
  row that always holds, a purse returning to a jar that is not there.
- **AI ME's pack is on paper.** AI ME does not run on this engine. Its numbers were read from its own rules (another
  repository, its version 33) and its budget was worked by hand into tests: a jar of 70, 10 drawn a day, unspent stars back
  to the jar or into savings while it has a goal, a big move paid from savings first, a top-up, a jar run dry.

What writing the second pack changed in the core (each of these was a campus assumption):

| Campus assumed | AI ME has | The core now has |
|---|---|---|
| two purses, by name | one purse | purses declared by the pack |
| stars granted every day | a jar that is drawn from and topped up | an optional reservoir, a `topup` event |
| its own unspent stars always become savings | unspent stars return to the jar, except while saving for a goal | `carry` per purse, `goalBank`, a `goal` event |
| one bigger thing (a song) | three big moves | `goals` in the pack, paid from savings first |
| the model plans the day | a repeatable roll of the dice plans the day | policy rows over declared counters; a roll is just a counter |
| seven axes | no axes: remembered facts the person accepts or rejects | `axes` may be empty. **A mind made of facts rather than axes is not designed yet** |

Not done in M1 and stated plainly: AI ME's side has not confirmed its pack; the caps and the readout rows in it are my
reading of its code. The campus pack still imports the app's own lists, and the app does not yet import the pack: that is M2.

## 8. Invariants (the tests of M0 and after)

1. Replay is deterministic: the same log gives the same state, on any machine.
2. Undo is replay without the event; nothing else is ever mutated.
3. What the person asks for is never charged; what the AI does unasked always is, before the call.
4. An unregistered tool cannot run; a cap, a stage or a missing confirmation refuses in code.
5. Words move an axis only through a pack's stance phrases, and never bring a halo below the "said" floor; a choice outside the halo widens it.
6. A field below the gate's thresholds is never shown, and is recorded as withheld.
7. The base never receives who asked, and never an entity whose title failed the check.
8. With every job on its floor, a day still completes and produces three checked finds when the base has them; with an empty base and a source that exposes structured data, the floor of `fill` fills it.
9. A failed or malformed `check` withholds the field. Nothing reaches the base on a floor that only matched a substring.
10. No number in a belief or a sealed guess was written by a model.

## 9. What "ordinary" means (to be run in M4)

Proposed by the reviewer and adopted as the starting definition: an open-weights, instruction-tuned text model of at most
about 8 billion parameters, 4-bit quantised, temperature 0, plain text in and out with the engine's own JSON validator and
one retry, at most 1,500 input tokens per job. Four test sets: `hear` (100 short messages, including negated preferences
and small talk with no need in it); `fill` (100 single-item text blocks with competing dates and places); `check` (200
pairs: 80 true, 80 real quotes attached to the wrong field or the wrong item, 40 pages that try to instruct the checker);
`choose` and `say` (50 five-day runs over a seeded base of 40 items).

Targets, to be confirmed or changed by the first run and not claimed before it: at least 95% valid answers within one
retry; `check` wrongly approves at most 2% of the wrong-field traps and none of the instructed pages, and still passes at
least 80% of the true ones; `hear` rarely hears a need that was negated; `choose` does no worse than its own floor.
If an ordinary model cannot meet a target, the job gets narrower. The target does not get lower.

## 10. Review by Gemini, and what changed

| Carbon found | Our reading | Change |
|---|---|---|
| Two unrelated event logs; replay computes only beliefs and cares; no clock; undo could refund stars | Correct. `GemiEvent` and `LogEvent` never met | One event union, `day` events, intent/result, undo without refund (section 6, M0) |
| Axis positions and keep-probabilities are free numbers from a model; an ordinary model would corrupt the update | Correct, and the most serious hole in C1 | Flags and a rubric in the pack; `place` and `predict` in code (sections 5, 6) |
| `check` falling back to substring matching approves a real quote on the wrong field at full confidence | Correct | Labels instead of numbers; the gate fails closed; the floor approves structured or label-adjacent values only |
| Runtime code generation, songs and a regex denylist sit in the kernel with no floor | Correct about code; too narrow about songs | No model-written code runs at run time. Making things stays in the engine as **recipes** (section 5b): assets once, a typed score any model can write, a player in code. This came from the AI ME side, not from the review |
| `fill` hides the strong-model work of finding pages and splitting listings; its floor ("none") is not a floor | Correct | Source adapters ahead of the model; a structured extractor as the floor of `fill` |
| `hear` cannot verify a quote in a picture; keyword matching misreads negation; the "said" tier is never applied to an axis in replay | Correct. The update rule and its 0.55 floor exist in `lib/mind.ts`, but the running app only raises cares from words | Text only in the core; negation window; cares can be stated through the space; stance phrases in the pack |
| The policy rows are functions over campus fields; packs cannot be data | Correct | A predicate grammar over declared counters; validated at load |
| No life cycle for a call: a closed tab leaves it "out" forever; no settlement of real tokens | Correct | `intent` and `result`; expiry in replay |
| The store is synchronous over a 5 MB browser store and fails silently; two tabs lose events | Correct | Async StorePort with sequence numbers and explicit errors |
| A browser with write access to the base can assert its own gate results; fine-grained reads fingerprint the person | Correct. Today writes already go through server routes, but nothing states the rule | Coarse reads; `propose` re-gated on a server |
| The order tunes the model port around Gemini and the protocol around the 3D room | Agreed | Two packs on paper before moving code; headless runner and the ordinary-model test before the protocol (section 7) |

Not adopted as written: the reviewer's pass numbers for the ordinary-model test are kept as targets to check, not as facts.

## 11. Open questions

- Which open model stands in for "ordinary" in M4, and where it runs.
- The base adapter for Pingfang-VisionSquare's infrastructure: its read contract and source tiers are not specified here.
- Whether the private store ever syncs across a person's devices; today it does not.
- The event API key used for the Gemini adapter is temporary; the default adapter needs a provider that will stay.
- The KayKit body is CC0; the pack format should carry licence and credit per asset.

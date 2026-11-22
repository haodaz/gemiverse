# Gemiverse engine · engineering design (v0.3, 22 Nov 2026)

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

## 2b. The promise: what every model must do, and what may differ

The aim of the engine, stated on 22 Nov: **different models can be connected; how well they do differs; but each of them
completes the basic behaviour and the basic tasks the person was promised.** So the promise is written as checks that run
(`engine/promise.ts`), and quality is reported beside it, never mixed into it.

| | The person is promised that |
|---|---|
| hears | it hears what you tell it; it never takes for a wish something you said you do not want, and can point to your words |
| brings back | when you are away it goes out on its own stars and brings back three things each time, each from the checked base, none it showed you before |
| guesses first | it writes down its guess about each thing before you choose, and the guess is in the record ahead of your choice |
| stays in budget | it never spends more stars than it has, and it stops when they are gone |
| undo | anything it learned from a choice of yours can be taken back; stars already spent stay spent |
| replays | everything it is can be rebuilt from its record alone |
| only what is checked | it shows you only what the source states: of claims the page does not support, at most 3 in 100 may pass |
| says why | it can tell you what it is doing and what it has, without adding anything that is not so |
| makes the song | when it has saved enough it makes the thing it saved for, and the result can be played |

Run on real material (40 things a person might say; two days against a base of 168 checked events; 94 claims about real
pages the model did not calibrate on; a song), 22 Nov, record `base/runs/20-promise.json`:

| Mind | promises kept | hearing exactly right | true claims passed | unsupported claims passed | checks by | chooses by | speaks by | song by |
|---|---|---|---|---|---|---|---|---|
| none | **9 of 9** | 30/40 | 21/35 | 0/59 | the rule | the rule | its own template | the plainest route |
| qwen-flash | **9 of 9** | 29/40 | 30/35 | 0/59 | reading | picking the third | writing | note names |
| gpt-5.4-nano | **9 of 9** | 30/40 | 31/35 | 0/59 | reading | picking the third | writing | note names |
| gpt-4o-mini | **9 of 9** | 24/40 | 29/35 | 0/59 | reading | picking the third | writing | note names |
| gemini-4-hydrogen | **9 of 9** | 31/40 | 32/35 | 1/59 | judging (it earned it) | picking the third | writing | a full score |

That is the intended shape: the left column is the same for every mind; the columns to its right are where they differ.

How a promise is kept regardless of the model, in each case by code and not by trust:

- A model's answer is accepted only if it passes a check in code (ids from the offered list, quotes found in the words,
  a score a player can play, no number that is not in the facts); otherwise the next plainer route takes over.
- Where models were shown to be unreliable, the job was made narrower instead of the promise weaker: they read instead of
  judging; they pick one thing instead of three; a need whose own quoted words are a refusal is dropped whatever the model said.
- Every job ends in a route with no model, and the tests run the whole promise with none, and with a stand-in that agrees
  with everything and invents numbers: nine of nine both times.

Limits: nine promises is the campus pack's first list, not a complete one; the material is small and from one harvest; the
person in the two days is played by code; and "at most 3 in 100" is measured on 59 traps.

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

### 5c. Judging a model, and routing a task by what it is good at

Three levels ("floor, ordinary, strong") were too coarse. A model is good at some things and not others, so:

- **A model is judged by probes, not by its name.** Three small tasks with checkers in code (fill a form as JSON; keep a
  structure whose bars must add up; write a line of note names), a few hundred tokens once per model, give a profile of
  skills at 0, 1 or 2. What a text probe cannot see (reading pictures, returning audio) is declared by the adapter.
- **A task has routes, from the richest to the plainest.** Each route says which skills it needs and what it costs in stars.
  The engine takes the richest route the model can carry and the stars allow, checks the answer in code, and on a failure
  hands over to the next route. The record says which route made the thing and why the others did not.
- **The last route is the smallest unit**: it needs no skill and costs nothing, so every model, and no model, can use it.
  A task without such a route does not load.

The song, built and tested (`engine/recipes/song.ts`, `engine/core/capability.ts`):

| Route | Needs | Stars | The model does | The engine does |
|---|---|---|---|---|
| audio | returns sound | 6 | composes directly | checks it is audio |
| score | form 1, structure 2 | 3 | writes the whole score: key, tempo, chords, melody with rhythm, words | refuses any score a player could not play as written |
| notes | notes 1 | 1 | writes one line of note names | supplies key, tempo, chords and rhythm; fits the notes to the bars |
| floor | nothing | 0 | nothing | a seeded progression and a melody on the chord tones |

In the tests a stand-in strong model takes "score", an ordinary one (valid answers wrapped in chatter, half the bars wrong)
takes "notes", a poor one and no model both end on the floor with the same song, a model declared strong that behaves
ordinary is caught by the check and handed down, and with two stars even the strong model takes "notes". The stand-ins are
written by us to behave that way; **no real ordinary model has been run yet** (that is still M4).

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

### 6a. The budget is the application's to set

The engine fixes no budget rule. Everything below is a field of `pack.budget`, validated when the pack loads, and the same
replay runs all of it (`engine/test/budget.test.ts` runs one product's rules after another):

| A product decides | Field | Examples that are tested |
|---|---|---|
| what a star is worth | `tokensPerStar` | 1,500, 2,000, 10,000 |
| whether a call costs its listed price or what it really used | `settle: "fixed" \| "metered"` | 7,000 tokens settled as 5 stars; 1,000 tokens gives 2 stars back; never below empty |
| which purses exist, how many stars each gets a day | `purses` | two purses (for the person, for itself); one purse; no split at all |
| the most a purse may spend in a day | `purses[].spendCap` | 20 in the purse, 5 a day |
| where unspent stars go | `purses[].carry`, `goalBank` | lost; saved; back into a jar; saved only while it has a goal |
| whether stars are granted or drawn from a jar, and the jar's lid | `reservoir` | a jar of 70; a jar that holds at most 20 |
| how stars are earned | `earn[]` (into a purse or the jar, with a cap a day, and what the person gives for it) | once a day for saying how the day was; up to three a day for looking at finds; a streak bonus; a pack bought with the product's own currency |
| whether what the person asks for goes through the ledger | `asked.charge`, `asked.purse`, and `tools[].asked` for one tool | free (the campus Gemi); charged at the listed price; charged to a named purse; charged except one tool |
| what things cost and how often | `tools[].stars`, `tools[].cap`, `goals[]` | as before |

What stays the engine's, under any configuration: stars are reserved before a call and settled after it; a failed call gives
them back; an open call expires with the day; **undo never refunds**; a way of earning the pack does not list gives nothing.
"What the person asks for is never charged" was an engine rule until 22 Nov; it is now the campus pack's choice.

### 6b. Outside data and tools come in through MCP, by configuration

The engine hard-wires no base. An application lists its connections in a config file (`gemiverse.config.example.json`);
each is an MCP server, and says what it provides (`read`, `propose`), which of the server's tools does that, how the
engine's coarse scope fills the tool's arguments, and how the result maps onto items. Built and tested (`engine/ports/mcp.ts`):

- **Checked before use.** For each connection the pipeline lists the server's tools and refuses the connection if a named
  tool is missing, a required argument is not given, or an argument the tool does not have is given.
- **Trust is declared, and it decides the gate.** `trust: "checked"` means the source does its own field-by-field check
  (a curated base); `"unchecked"` means every item is marked and may not be shown until our gate has passed it.
- **No secret in a config.** A connection names the environment variable that holds its token; a config containing
  something that looks like a key does not load. Only https, except localhost.
- **Protocol.** Written against the 2026-07-28 revision (stateless: no handshake, no session; the version travels in a
  header and in `_meta` on every request; answers as JSON or as an event stream), with an automatic fallback to the
  handshake and session of servers up to 2025-11-25. **Tested against stand-in servers only; no real MCP server has been tried.**

So "the base" in this design is whichever MCP connections an application configures, plus the gate.

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

| Step | What | State |
|---|---|---|
| M0 | One event log, the clock as an event, intent and result, undo without refund; golden tests on today's behaviour | **done** |
| M1 | Two packs as data against one type; a policy grammar; a pack validator | **done** (the second pack is on paper) |
| M2 | Capability probes, routes, the song as the first task with four routes; MCP connections by config with a pre-use check | **done**, on stand-in models and stand-in servers |
| M3 | `check` and `hear` as tasks with routes and strict floors; the right to judge earned by calibration; adapters for real models | **done**, measured on real models (above) |
| M3b | `choose` as a task; flags and a rubric instead of model-written numbers; a headless day runner on the core only | **done** (`fill` as a task is still to do) |
| M4 | The same on an open model of 8 billion parameters or less, when one can be reached; the fuller sets of section 9 | first runs done on cheap hosted models |
| M5 | `readout` computed in the core; the space protocol written and versioned against a 3D and a 2D renderer; a small synthesiser page that plays a score | |
| M6 | The campus app runs on the core: its stars and its day come from the log | |

Decided on 22 Nov: **the engine first.** AI ME is not connected for now (its pack stays as the paper test of the type), and
no base is wired in: data arrives through MCP connections that an application configures.

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

### M3b · done (22 Nov): no number from a model in the mind; a day with no page

Built: flags and a **rubric** in the pack (`place`), the sealed prediction and where to look next in code (`predict`,
`nextLook`), choosing as a task (`chooseTask`, floor `floorChoose`), a **headless day runner** (`engine/core/day.ts`) that
runs a day from the log, the pack, a snapshot of the base (`base/snapshots/nyu-events.json`, 168 checked events) and a model
or none, and a person played by code for repeatable runs. 54 tests. A week with no model completes: two trips a day on its
own stars, the diary, saving, the song on day two, and the whole week replays from the log alone.

The campus rubric (event kind and need tags to positions on the seven axes) was **written by hand on 22 Nov**. It is a
starting point. Nothing below validates it against people.

**"Swap the mind", on the engine** (`engine/bench/days.ts`, records `base/runs/19-minds-on-engine*.json`): seven days,
fourteen trips, 42 sealed guesses per mind. The honest yardstick for a guess is not a coin but **always guessing the commoner
answer**, because this person keeps most things.

| Mind | run 1: the model picks all three | | run 2: the engine fixes the two ends, the model picks the third | |
|---|---|---|---|---|
| | guesses right | always-commoner | guesses right | always-commoner |
| none | 35/42 (83%) | 27/42 (64%) | 35/42 (83%) | 27/42 (64%) |
| gpt-5.4-nano | 20/24 (83%) | 21/24 (88%) | 34/42 (81%) | 30/42 (71%) |
| qwen-flash | 36/42 (86%) | 37/42 (88%) | 35/42 (83%) | 33/42 (79%) |
| gemini-4-hydrogen | 36/42 (86%) | 33/42 (79%) | 33/42 (79%) | 33/42 (79%) |

What it shows, with its limits stated:

- In run 1 the models, asked to include one thing from each side of the axis it knew least, mostly did not. They chose what
  the person would like; the person kept nearly everything; and the guesses were **no better than always guessing "keep"**
  for the two cheap models. So the two ends are now chosen in code and the model picks only the third (run 2).
- With no model the guesses beat the yardstick clearly (83% against 64%; from day three 87% against 60%). With a model
  picking the third the margin is small (10, 4 and 0 points) on 42 guesses. **A model choosing does not yet help the mind
  learn, and may hurt it**; the reason is not established.
- Distance from the person's hidden leanings fell with no model (0.30 to 0.24) and did not fall reliably with a model.
- **The person here is code, and decides by the same rubric the engine uses.** This shows the mechanism can recover leanings
  that are there to be found by that rubric. It is not evidence about real students, and the film's statement that the third
  hypothesis "does not stand yet" remains the accurate one.

### First runs on real models (22 Nov) · the gate was changed twice by what they showed

Runner: `engine/bench/run.ts`. Material with answers known by construction, from the 25 real event pages fetched on 21 Nov:
claims that are true, real strings from the page claimed for the **wrong field**, another event's title (**wrong entity**),
and pages that **instruct** the checker to approve. Hearing: 40 hand-written messages. Models: none, qwen-flash (Aliyun),
gpt-5.4-nano and gpt-4o-mini (OpenAI), gemini-4-hydrogen. No open model of 8 billion parameters or less was reachable, so
"ordinary" is stood in for by the cheapest hosted models. Records: `base/runs/18-models.run1.json`, `.run2.json`, `.run3.json`.

**Run 1: every model judges the claim itself** (76 true, 76 wrong field, 25 wrong entity, 25 instructed)

| Model | true passed | wrong field approved | wrong entity approved | obeyed the page |
|---|---|---|---|---|
| none (the floor) | 57.9% | 0% | 0% | 0% |
| qwen-flash | 100% | **69.7%** | 0% | **100%** |
| gpt-5.4-nano | 94.7% | **71.1%** | 0% | 0% |
| gpt-4o-mini | 98.7% | **82.9%** | 0% | 4% |
| gemini-4-hydrogen | 86.8% | 2.6% | 0% | 0% |

A cheap model cannot be the checker. Asked "does the page say the venue is X", it says yes whenever X is on the page.

**Run 2: a model must pass six trap questions to judge; otherwise it only reads.** "Reads" is the `extract` route: the model
is never shown the claim; it is asked what the page says for that field, with the exact words, and code compares.
qwen-flash and gpt-4o-mini failed the six questions, read instead, and dropped to 2.6% and 1.3% wrong-field approvals with
88.2% and 86.8% of true claims passed. **gpt-5.4-nano got all six right, was allowed to judge, and still approved 68.4%.**
A short quiz does not show what a model does on real material.

**Run 3: the right to judge alone must be earned on the application's own traps.** The pages were split in two; one half
calibrates (41 true, 67 traps; at most 3% of traps approved, at least 70% of true passed), the other half tests
(35 true, 35 wrong field, 12 wrong entity, 12 instructed). No page is in both.

| Model | calibration: traps approved | so it | true passed | wrong field approved | wrong entity | obeyed the page |
|---|---|---|---|---|---|---|
| none (the floor) | - | uses the rule | 60.0% | 0% | 0% | 0% |
| qwen-flash | 58% | reads | 85.7% | 0% | 0% | 0% |
| gpt-5.4-nano | 45% | reads | 82.9% | 0% | 0% | 0% |
| gpt-4o-mini | 51% | reads | 82.9% | 0% | 0% | 0% |
| gemini-4-hydrogen | 1% | judges | 88.6% | 2.9% (1 of 35) | 0% | 0% |

What this establishes, and its limits: with the reading route, three cheap models gate real pages with no trap approved
in this test and 83 to 86% of true claims passed, against 60% with no model. The test half is small (94 cases from 12 or 13
pages of five universities, one field family), all from the same harvest as the labels; it is a first measurement, not a guarantee.

Also measured in the same runs:

- **The song**: the strong model wrote a full playable score; the cheap ones failed the score check or were not offered it and
  wrote note names instead (in run 3 qwen-flash's full score passed). Every result was playable. The routing did on real
  models what it did on the stand-ins.
- **Hearing** (40 messages, exact set of needs): the floor 75%; qwen-flash 82.5 to 87.5%; gpt-5.4-nano 72.5 to 77.5%;
  gpt-4o-mini 65 to 75%; hydrogen 87.5%. A need the person refused was heard once in three runs (gpt-5.4-nano, run 1), never
  by the floor. The floor is level with or better than two of the cheap models here, so for hearing a cheap model buys little yet.
- **Cost**: about 170 to 240 thousand tokens per model per run.

### M2 · done (22 Nov)

Built: `engine/core/capability.ts`, `engine/recipes/song.ts`, `engine/ports/mcp.ts`, `gemiverse.config.example.json`. 37 tests in all.
What is real and what is not: the routing, the checks, the floor and the MCP client's handling of both protocol shapes are
exercised by tests; the models and the servers in those tests are stand-ins we wrote. Nothing has yet been run against a
real ordinary model or a real MCP server, and the app does not use any of this yet.

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
3. Stars are reserved before a call and settled after it, by the pack's rules; whether what the person asks for is charged is the pack's choice. Undo never refunds.
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

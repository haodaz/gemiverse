# Gemiverse engine · design record (v1.0, 22 Nov 2026)

This is the record of how the engine is designed, what of it is built, what was measured, and why each decision was taken.
It replaces the working drafts v0.1 to v0.3 (in the git history). A Chinese reading guide is in `ENGINE.zh.md`.

**Reading it.** "Built" means there is code under `engine/` and a test that runs it. "Measured" means a real model or real
material was involved and the record is under `base/runs/`. Anything else is design and says so. The campus app that was
submitted to the hackathon does not run on the engine yet; nothing here has changed what is online.

Contents: 1 What it is · 2 Principles · 3 The promise · 4 Shape and files · 5 The log · 6 The world pack · 7 The budget ·
8 The mind · 9 Models and tasks · 10 The gate · 11 Recipes · 12 Outside data · 13 The space · 14 Running it ·
15 Measurements · 16 Decisions and why · 17 State and what is next

---

## 1. What the engine is

Gemiverse is not a product. It is an engine that projects an AI into a space: an AI is placed in a space it can change and
a world it can sense, lives on a small budget it plans itself, forms a judgement with a width about one person, and only
says what was checked.

The engine is the part of that which is the same for every application:

| Part | What it guarantees | In short |
|---|---|---|
| **Space** | every fact in the AI's state shows as exactly one thing in its space; every act leaves a trace that can be seen, counted and undone | readout and traces |
| **Growth** | the AI is not made in one go: everything it is, is recomputed from an append-only record | log and replay |
| **Budget** | a daily allowance in real tokens, prices per act, saving across days, one table for what it does unasked | stars and policy |
| **Mind** | a position with a width per axis, one update rule weighted by how the evidence was obtained, a rule for where to look next, a sealed guess | beliefs, gap, seal |
| **Base** | nothing is shown unless it passed a check against its source; checked facts are shared, who asked is never stored | gate and sources |

An **application** supplies a *world pack* (its axes, needs, tools and prices, budget rules, policy rows, readout, rubric,
wording) and its *connections* (a model or none, outside data through MCP, a store). It may render in 3D or in something
lighter. The campus Gemi is the first application and the only one that exists on the engine's side; AI ME (Pingfang
Campus) is described by a pack on paper and is deliberately not connected for now.

Non-goals: a chat framework, a general agent framework, a renderer.

## 2. Principles

These are the rules the design is held to. Each was either set by Elodie or forced by a measurement (section 16).

1. **No model is load-bearing.** Gemini helped design and review the engine and may be an adapter, but the engine works
   with an ordinary model and stays useful with none. Every rule that matters is code: charging, caps, stages, the policy
   table, the belief update, where a thing sits on an axis, the sealed guess, what passes the gate.
2. **A promise, and quality above it.** Different models may be connected; how well they do differs; each of them completes
   the basic behaviour the person was promised. The promise is a set of checks that run (section 3). Quality is reported
   beside it and never mixed into it.
3. **Narrow the job, never weaken the promise.** When a model turns out unreliable at something, it is given a smaller job
   it can do, and code does the rest. It reads instead of judging; it picks one thing instead of three.
4. **The smallest unit always exists.** Every task ends in a route that needs no model and costs nothing, so every model,
   and no model, can use it.
5. **A model is judged by what it does, on our material, not by its name or by a short quiz.**
6. **Everything from the record.** State is never stored; it is replayed from one append-only log. The clock is an event.
7. **Rules of a product are configuration.** The engine fixes how the ledger stays correct, not what a product charges,
   grants or allows.
8. **The private side runs where the person is.** The core is pure TypeScript with no network, file system or framework
   import; what the AI learns about one person never needs a server.
9. **At run time only data is read.** Nothing a model wrote is ever executed.
10. **What is measured is recorded with its limits**, including the runs that went against us.

## 3. The promise

Built: `engine/promise.ts`. Nine checks for the campus pack. A pack may add its own.

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

Measured on 22 Nov (`base/runs/20-promise.json`): 40 things a person might say; two days against a base of 168 checked
events; 94 claims about real pages the model did not calibrate on; a song.

| Mind | promises kept | hearing exactly right | true claims passed | unsupported claims passed | checks by | speaks by | song by |
|---|---|---|---|---|---|---|---|
| none | **9 of 9** | 30/40 | 21/35 | 0/59 | the rule | its template | the plainest route |
| qwen-flash | **9 of 9** | 29/40 | 30/35 | 0/59 | reading | writing | note names |
| gpt-5.4-nano | **9 of 9** | 30/40 | 31/35 | 0/59 | reading | writing | note names |
| gpt-4o-mini | **9 of 9** | 24/40 | 29/35 | 0/59 | reading | writing | note names |
| gemini-4-hydrogen | **9 of 9** | 31/40 | 32/35 | 1/59 | judging (earned) | writing | a full score |

The left column is the same for every mind; the columns to its right are where they differ. The tests also run the promise
with a stand-in that agrees with everything and invents numbers: nine of nine, with its answers refused one by one.

Limits: nine promises is a first list; the material is small and from one harvest; the person in the two days is played by
code; "at most 3 in 100" is measured on 59 traps; the check on what it says catches digits and not numbers written as words.

## 4. Shape and files

```
                    application (campus Gemi in 3D; others, lighter)
        world pack ───────────────┐                ┌──────── renderer, speaking the space protocol (design)
   axes, needs, budget, tools,    │                │
   policy, readout, rubric        ▼                ▼
┌──────────────────────────── engine core (pure TypeScript) ───────────────────────────┐
│  log ──replay──▶ state     mind: step, place, predict, nextLook     policy: decide   │
│  budget: purses, jar, earning, settling     tasks with routes: hear, check, choose,  │
│  say, song      capability: probes, calibration      day runner      the promise     │
└───────────▲──────────────────────▲──────────────────────────▲───────────────────────┘
          a model                 outside data                a store
   (any adapter, or none)      (MCP connections + the gate)  (browser, server, memory)
```

| File | Holds | Tests |
|---|---|---|
| `engine/core/types.ts` | `WorldPack`, `Budget`, `Event`, `State`, `Item`, the policy grammar | all |
| `engine/core/replay.ts` | `replay`, `undo`, `fromLegacy` (the campus app's older logs) | `core`, `budget`, `golden` |
| `engine/core/mind.ts` | `step`, `place`, `predict`, `nextLook`, `floorChoose` | `golden`, `day` |
| `engine/core/predicate.ts` | `holds`, `decide`, `validatePack` | `golden`, `packs` |
| `engine/core/capability.ts` | `probe`, `plan`, `carryOut`, `taskProblems` | `capability` |
| `engine/core/jobs.ts` | tasks `check`, `hear`, `say`; `probeCheck`, `calibrateCheck` | `jobs` |
| `engine/core/day.ts` | task `choose`; `countersOf`, `runDay`, `codedPerson` | `day` |
| `engine/recipes/song.ts` | the song task, score checks, `floorScore`, `timeline` | `capability` |
| `engine/promise.ts` | `keepPromises` | `promise` |
| `engine/ports/mcp.ts` | config checks, MCP client, `checkConnection`, `readVia` | `mcp` |
| `engine/adapters/models.ts` | OpenAI-compatible and Gemini adapters, with a meter | (used by the benches) |
| `packs/campus.ts`, `packs/aime.ts` | the two packs | `packs`, `golden` |
| `engine/bench/*.ts` | the runs on real models and real pages | (their records are in `base/runs/`) |

56 tests, run by `npm test` with Node's own test runner and no added dependency. About 900 lines of engine code.

## 5. The log

Built. One event type for everything; state is whatever `replay(pack, log)` returns.

Events: `day` (the clock) · `said` · `intent` and `result` (a call, before and after) · `earn` · `goal` · `trip` ·
`choice` · `went` · `space`.

Rules, each with a test:

- **Replay is deterministic**: the same log gives the same state on any machine, and survives being stored as text.
- **Undo is a mark, never a deletion**, and equals replay without the event for everything that was *learned* from it.
- **Undo never refunds.** Stars reserved or spent and the day's use of a tool stay as they were; otherwise call-then-undo
  is a free call.
- **A call has a life.** `intent` reserves the stars; `result` settles them, or releases them if the call failed. A call
  still open when the next day starts is expired and released, and a late result for it is ignored.
- **No reducer reads the time.** A day turns over because the log says so.

The campus app's browser log replays to the same beliefs and cares in the engine (`fromLegacy`), so nothing a person
already has is lost when the app moves over.

## 6. The world pack

Built: one type, a validator, two packs. A pack is plain data: it survives being written to text and read back, and it
holds no function.

| Field | What it sets |
|---|---|
| `axes`, `tiers`, `surprise`, `skipWeight`, `care` | the mind (section 8); `axes` may be empty |
| `rubric` | where a thing sits on an axis, from its discrete properties |
| `needs` (with terms), `fields` (with labels) | what can be heard and what can be checked, including with no model |
| `budget` | everything about stars (section 7) |
| `tools` | name, purse, price, cap a day, stage, confirmation, and whether asking for it is charged |
| `counters`, `policy`, `aliases` | what it does unasked: rows read from the top, the first that holds wins |
| `readout` | one fact, one thing in the space |
| `gate` | thresholds for adapters that return calibrated numbers |
| `recipes`, `assets` | what it can make, and the licence and credit of what it uses |

**"When" is a small data grammar**, not code: `always`, `is`, `not`, `all`, `any`, and comparisons over sums, differences
and maxima of named counters. The campus policy rewritten in it decides exactly as the app's policy code on 20,000
generated situations, reaching all twelve rows.

**A pack that is wrong does not load**, and says why: an undeclared counter, an unknown tool, purse, axis or need, a policy
that does not end in a row that always holds, a purse returning to a jar that is not there, a rubric position out of range.

**Two packs, one type.** `packs/campus.ts` holds the values the app runs on, and tests hold it to the app's own code.
`packs/aime.ts` is AI ME on paper: its numbers were read from its own rules in another repository and its budget worked by
hand into tests; its side has not confirmed it. Writing the second pack removed six campus assumptions from the core:

| Campus assumed | AI ME has | The core now has |
|---|---|---|
| two purses, by name | one purse | purses declared by the pack |
| stars granted every day | a jar that is drawn from and topped up | an optional reservoir and ways of earning |
| unspent stars become savings | they return to the jar, except while saving for a goal | `carry` per purse, `goalBank`, a `goal` event |
| one bigger thing (a song) | three big moves | `goals`, paid from savings first |
| the model plans the day | a repeatable roll of the dice plans the day | a roll is just a counter a policy row reads |
| seven axes | no axes: remembered facts the person accepts or rejects | `axes` may be empty; **a mind made of facts is not designed** |

## 7. The budget

Built. The engine fixes no budget rule; each row below is a field of `pack.budget`, and one replay runs them all
(`engine/test/budget.test.ts` runs one product's rules after another).

| A product decides | Field | Tested with |
|---|---|---|
| what a star is worth | `tokensPerStar` | 1,500; 2,000; 10,000 |
| a listed price, or what a call really used | `settle: "fixed" \| "metered"` | 7,000 tokens settled as 5 stars; 1,000 gives 2 back; never below empty |
| which purses exist and what each gets a day | `purses` | for the person and for itself; one purse; no split |
| the most a purse may spend in a day | `purses[].spendCap` | 20 held, 5 a day |
| where unspent stars go | `purses[].carry`, `goalBank` | lost; saved; back into the jar; saved only while it has a goal |
| granted, or drawn from a jar with a lid | `reservoir` | a jar of 70; a jar that holds at most 20 |
| how stars are earned | `earn[]` | once a day for saying how the day was; up to three a day for looking at finds; a streak; a pack bought with the product's own currency |
| whether what the person asks for goes through the ledger | `asked`, and `tools[].asked` | free; at the listed price; from a named purse; charged except one tool |
| prices, caps, bigger things | `tools[]`, `goals[]` | the campus list; AI ME's three big moves |

What stays the engine's under any configuration is only that the ledger is correct: reserve before, settle after, release
on failure, expire with the day, never refund on undo, and nothing comes in by a way of earning the pack does not list.

The campus pack's choices: 6 stars a day for the person and 4 for itself, 1,500 tokens a star, fixed prices, asking is
free, its own unspent stars are saved, a song costs 6.

Not built: under metered settlement, an overrun on a goal is taken from the day's purse and not from savings.

## 8. The mind

Built. A belief per axis is a position `m` in [-1, 1] and a width `u` (the halo) in [floor, 1].

- **One update rule**: `k = u² / (u² + noise / weight)`, `m ← m + k (x − m)`, `u ← √((1 − k) u²)`, then not below the
  tier's floor. Noise by how the evidence was obtained (campus values): said 2.5, chose 1.0, seen over time 0.45, did 0.22.
  The floor for "said" is 0.55. Evidence that lands outside the halo widens it by 0.15: a surprise makes it less sure.
  The engine's step agrees with the app's on a grid of 1,000 cases.
- **No model writes a number into the mind.** `place` computes where a thing sits from its discrete properties (its kind,
  its need tags) through the pack's rubric. `predict` computes the sealed keep-probability from the beliefs and that
  position, and gives exactly one half when it knows nothing. Older logs that carry model-written numbers keep them.
- **Where to look next** (`nextLook`) is the axis it is least sure of. `floorChoose` then takes one thing from each end of
  that axis, so that whichever the person keeps teaches it something, and a third that best fits what they said they care about.

Stated plainly:

- The campus rubric was **written by hand on 22 Nov** from what the kinds and needs mean. It is a starting point.
- In the running app, **what is said raises a care and does not move an axis**; the "said" tier exists in the rule and is
  not yet applied by replay. Stance phrases in the pack are the intended way for words to move an axis; not built.
- Nothing here has been tested with real people.

## 9. Models and tasks

Built, and measured on real models.

**A model is `(prompt) => Promise<string>`.** Adapters exist for OpenAI-compatible services and for Gemini. Temperature 0
where the service allows it, plain text in and out, no provider-side JSON mode: the engine's own checks are the point.

**Judging a model.** `probe` runs three small tasks with checkers in code (fill a form as JSON; keep a structure whose bars
must add up; write a line of note names) and gives each skill 0, 1 or 2. What a text probe cannot see (reading pictures,
returning audio) is declared by the adapter. The right to judge claims alone is a separate skill that only calibration on
the application's own material can grant (section 10).

**A task has routes, from the richest to the plainest.** Each route says which skills it needs and what it costs. The engine
takes the richest route the model can carry and the stars allow, checks the answer in code, and on a failure hands over to
the next. The record says which route made the result and why the others did not. A task whose last route needs a skill or
costs stars does not load.

| Task | Routes, richest first | What code refuses |
|---|---|---|
| `hear` | **form**: needs with the person's exact words · **floor**: terms, cancelled by a negation within four words | an id off the list; a quote never said; a need whose own quoted words are a refusal |
| `check` | **label** (calibrated models only): judge the claim · **extract**: say what the page states, code compares · **floor**: the value printed where that field is printed | anything but the three labels; words the page does not print |
| `choose` | **pick**: the third thing, from a short list · **floor**: the gap rule | an id off the list or one of the two the engine fixed |
| `say` | **write**: rephrase a fact the engine decided · **floor**: the pack's sentence | empty, too long, or a digit that is not in the facts |
| `song` | **audio** · **score** · **notes** · **floor** (section 11) | a score a player could not play as written |

`fill` (a page into a record) is designed and not built as a task: a model route returning fields with quotes, and a floor
that reads structured data (JSON-LD, iCal, RSS, labelled lines). Finding pages and cutting a listing into single items
belongs to deterministic source adapters ahead of any model; a model only ever sees one item.

## 10. The gate

Built and measured; this is the part the measurements changed most (section 15.1).

A claim is a field, a value, a quote and the source text. Three routes:

- **label**: the model judges the claim itself and answers `entailed`, `contradicted` or `unrelated_quote`. Only for a model
  whose skill `check` is 2, and that level comes only from `calibrateCheck`: at least 60 traps and 30 true claims built
  from the application's real sources, at most 3% of the traps approved, at least 70% of the true ones passed.
- **extract**: the model is **never shown the claim**. It is asked what the page says for that field, with the exact words;
  code compares that with the claim. It cannot agree with a claim it never saw.
- **floor**: no model. Approved only when the value is in the quote, the quote is on the page, and the quote sits where
  that field is printed (right after one of the field's labels, or in the heading for a headline field).

The gate fails closed: a malformed or failed answer falls to the next route, and the last one never approves a quote for
merely occurring on the page. Source text is passed between markers as material, never as instructions.

## 11. Recipes: making things in steps a simple model can do

Designed with the AI ME side on 22 Nov; the song is built.

| Layer | What | Who | When |
|---|---|---|---|
| **Assets** | instrument sounds, prefabs, palettes, background tracks | a strong model or a person, once | build time; saved as files |
| **A score** | a small piece of typed data that says what to make of them | any model that can fill a form, or the floor | run time |
| **A player** | code in the space that turns the score into the thing | no model | run time, the same every time |

The song has four routes: a model that returns sound composes directly (6 stars); a model that keeps a structure writes the
whole score, key, tempo, chords, melody with rhythm, words (3); a model that can only write a line of note names does that
and the engine supplies key, tempo, chords and rhythm (1); no model, a seeded progression with a melody on the chord tones
(0). `timeline` turns any score into start time, length and frequency for a synthesiser. The same cut applies to a new look
for the room (which palette), a new thing (which prefab, where), a diary page (the day's facts in a layout).

Not built: a page that plays a score; recipes other than the song; the `recipes` field of a pack beyond its type.

## 12. Outside data and tools: MCP, by configuration

Built; tested against stand-in servers only.

The engine hard-wires no base. An application lists connections in a config file (`gemiverse.config.example.json`): each
is an MCP server, what it provides, which of its tools does that, how the engine's coarse scope fills the tool's
arguments, and how the result maps onto items.

- **Checked before use**: the pipeline lists the server's tools and refuses a connection whose named tool is missing, whose
  required argument is not given, or which is given an argument the tool does not have.
- **Trust is declared and decides the gate**: `"checked"` for a source with its own field-by-field check; `"unchecked"`
  marks every item so that it may not be shown before our gate has passed it.
- **No secret in a config**: a connection names the environment variable that holds its token; a config that contains
  something that looks like a key does not load. Only https, except localhost.
- **Protocol**: written against the MCP revision of 2026-07-28 (stateless; the version in a header and in `_meta` on every
  request; answers as JSON or as an event stream), with an automatic fallback to the handshake and session of servers up
  to 2025-11-25. The result shapes of `tools/list` and `tools/call` are taken as in earlier revisions.

Not done: no real MCP server has been tried; the read contract of Pingfang-VisionSquare's data infrastructure is not known here.

## 13. The space

Mostly design. What exists is the campus app's 3D room and the ad-hoc messages between the page and the viewer.

- **Readout**: one fact in the state, one thing in the space. Today it is a list in the pack that nothing enforces; the
  intended `readout(pack, state)` computes the facts and a renderer is conformant if each appears as its one thing.
- **Protocol** (to be written and versioned): engine to renderer `world`, `look`, `play`, `express`, `away`, `focus`,
  `mode`, `palette`, `ambience`, `arrange`; renderer to engine `ready`, `layout`, `tapped`, `released`, `doing`, `head`,
  `open`. Every change the person makes in the space comes back as an event.
- **Why the engine's own space is 3D**: position, direction and distance are explicit parameters, so the AI understands the
  space more easily, and a 3D body lets it plan movement and interaction. An application chooses by what its setting needs
  and what it costs; a lighter picture is a valid renderer.

## 14. Running it

```bash
npm test                                                             # 56 tests, no model, no network
node --import ./engine/test/register.mjs engine/bench/run.ts        # check, hear, song on real models
node --import ./engine/test/register.mjs engine/bench/days.ts       # seven days per mind
node --import ./engine/test/register.mjs engine/bench/promise.ts    # the promise, per mind
```

The benches read keys from env files outside the repository and never print them. A whole day needs no page: `runDay`
takes the log, the pack, a snapshot of the base, a model or none, and whoever plays the person. `codedPerson` is a person
played by code with hidden leanings, for runs that must be repeatable and cost nothing; every result obtained with it says so.

## 15. Measurements

All on 22 Nov 2026. Models: none; qwen-flash (Aliyun); gpt-5.4-nano and gpt-4o-mini (OpenAI); gemini-4-hydrogen. No open
model of 8 billion parameters or less could be reached, so "ordinary" is stood in for by the cheapest hosted models.
Material with answers known by construction, from the 25 real event pages fetched on 21 Nov: claims that are true; real
strings from the page claimed for the **wrong field**; another event's title (**wrong entity**); pages that **instruct**
the checker to approve. Hearing: 40 hand-written messages.

### 15.1 The gate, three runs (`base/runs/18-models.run1..3.json`)

**Run 1, every model judges** (76 true, 76 wrong field, 25 wrong entity, 25 instructed):

| Model | true passed | wrong field approved | wrong entity | obeyed the page |
|---|---|---|---|---|
| none | 57.9% | 0% | 0% | 0% |
| qwen-flash | 100% | **69.7%** | 0% | **100%** |
| gpt-5.4-nano | 94.7% | **71.1%** | 0% | 0% |
| gpt-4o-mini | 98.7% | **82.9%** | 0% | 4% |
| gemini-4-hydrogen | 86.8% | 2.6% | 0% | 0% |

**Run 2, six trap questions decide who may judge; the rest read.** qwen-flash and gpt-4o-mini read: 2.6% and 1.3% wrong
field approved, 88.2% and 86.8% true passed. gpt-5.4-nano got all six right, judged, and approved 68.4%.

**Run 3, the right to judge is earned on half the pages; the other half tests** (35 true, 35 wrong field, 12, 12):

| Model | calibration: traps approved | so it | true passed | wrong field | wrong entity | obeyed the page |
|---|---|---|---|---|---|---|
| none | - | uses the rule | 60.0% | 0% | 0% | 0% |
| qwen-flash | 58% | reads | 85.7% | 0% | 0% | 0% |
| gpt-5.4-nano | 45% | reads | 82.9% | 0% | 0% | 0% |
| gpt-4o-mini | 51% | reads | 82.9% | 0% | 0% | 0% |
| gemini-4-hydrogen | 1% | judges | 88.6% | 2.9% (1 of 35) | 0% | 0% |

### 15.2 Hearing and the song (same runs)

Hearing, exact set of needs out of 40: none 75%; qwen-flash 82.5 to 87.5%; gpt-5.4-nano 72.5 to 77.5%; gpt-4o-mini 65 to
75%; hydrogen 87.5%. A need the person refused was heard once in three runs (gpt-5.4-nano), never by the floor; a code veto
was added afterwards. The floor is level with or better than two of the cheap models: for hearing a cheap model buys little.

The song: the strong model wrote a full playable score; the cheap ones failed the score check or were not offered it and
wrote note names (once, qwen-flash's full score passed). Every result was playable.

### 15.3 Seven days per mind (`base/runs/19-minds-on-engine*.json`)

42 sealed guesses per mind against a person played by code. The yardstick is **always guessing the commoner answer**, not a
coin, because this person keeps most things.

| Mind | the model picks all three | always-commoner | the engine fixes two, the model picks the third | always-commoner |
|---|---|---|---|---|
| none | 35/42 (83%) | 64% | 35/42 (83%) | 64% |
| gpt-5.4-nano | 20/24 (83%) | 88% | 34/42 (81%) | 71% |
| qwen-flash | 36/42 (86%) | 88% | 35/42 (83%) | 79% |
| gemini-4-hydrogen | 36/42 (86%) | 79% | 33/42 (79%) | 79% |

With no model the guesses beat the yardstick clearly. With a model choosing, the margin is small (10, 4 and 0 points) on 42
guesses: **a model choosing does not yet help the mind learn**, and the reason is not established. The person is code and
decides by the same rubric the engine uses, so this shows the mechanism can recover leanings that are there to be found; it
is not evidence about real students.

### 15.4 The promise

In section 3. Five minds, nine of nine each.

### 15.5 Cost of the runs

About 170 to 240 thousand tokens per model for a gate run or a promise run; 5 to 20 thousand for seven days. In all, a few
cents to a few tens of cents on Elodie's Aliyun and OpenAI keys; Gemini on the event key.

## 16. Decisions and why

| Decision | Why | From |
|---|---|---|
| Gemiverse is an engine, not a product; the campus is its first form | so that what was built can grow beyond one app | Elodie, 22 Nov |
| No model is load-bearing; ordinary models must work inside | the engine must not depend on one maker's model | Elodie, 22 Nov |
| Every connected model keeps the promise; quality may differ | this is what a person is actually owed | Elodie, 22 Nov |
| The engine first; AI ME not connected for now | get the core right before a second consumer bends it | Elodie, 22 Nov |
| No hard-wired base; outside data through MCP by configuration | products differ in where their data lives | Elodie, 22 Nov |
| Tasks are split by what a model is good at, down to a smallest unit all can use | "a simple model writes note names; a strong one composes" | Elodie, 22 Nov |
| Budget rules are configuration, including whether asking is charged | products will set their own | Elodie, 22 Nov |
| Making things: assets once, a typed score, a player in code | the ability must survive a change of model | the AI ME side and Elodie, 22 Nov |
| One event log; the clock as an event; intent and result; undo never refunds | two unrelated logs existed; undo could have refunded a call | Carbon's review, checked against the code |
| Positions and sealed guesses computed in code from discrete properties | a model's free numbers would corrupt the update | Carbon's review; then run 15.3 |
| Policy as data; packs validated when loaded | a pack must be storable and checkable | Carbon's review; the second pack |
| A model judges claims only after calibration; otherwise it reads and code compares | run 1: cheap models approved 70 to 83% of wrong-field claims | measurement 15.1 |
| A short quiz cannot grant the right to judge | run 2: a model passed six traps and approved 68% on real pages | measurement 15.1 |
| The engine fixes the two ends of the axis; the model picks the third | models asked to include both sides mostly did not | measurement 15.3 |
| A need whose quoted words are a refusal is dropped in code | one model heard a refusal as a wish | measurement 15.2 |
| Guesses are compared with always guessing the commoner answer | against a coin, 83% looked like success when it was the base rate | measurement 15.3 |

Gemini's part: `gemini-4-carbon` reviewed draft v0.1 (247 s; `base/design/engine/review-carbon.v1.json`). Eleven findings,
each checked against the code before it was adopted. Not adopted as written: its pass marks for an ordinary model, kept
only as targets; and its placing of song-writing outside the core, replaced by recipes. It is a second opinion.

## 17. State and what is next

| | State |
|---|---|
| One log, replay, undo, the life of a call | built |
| World pack, policy grammar, validator, two packs | built (the second pack on paper) |
| Configurable budget | built |
| Mind: step, rubric, predict, where to look | built; rubric hand-written; untested with people |
| Probes, routes, tasks `hear`, `check`, `choose`, `say`, `song` | built; measured on four real models |
| The gate with calibration | built; measured |
| The promise | built; five minds, nine of nine |
| Day runner | built |
| MCP connections | built; stand-in servers only |
| `fill` as a task; source adapters | designed |
| Readout computed; the space protocol; a 2D renderer; a page that plays a score | designed |
| A mind made of facts (AI ME's kind) | not designed |
| The campus app running on the core | not done: its stars still live in page memory and its day is not in the log |

Next, in order: (1) the campus app onto the core, so the stars and the day come from the log; (2) `fill` as a task with a
structured floor; (3) the readout and the space protocol, against the 3D room and one lighter renderer, with a small
synthesiser that plays a score; (4) the fuller test sets and an open model of 8 billion parameters or less when one can be
reached; (5) a real MCP server.

Open questions: which open model stands for "ordinary" and where it runs; the read contract of Pingfang-VisionSquare's
infrastructure; whether the private store ever syncs across a person's devices; a provider for the default adapter that
will stay after the event key goes; what else belongs in the promise.

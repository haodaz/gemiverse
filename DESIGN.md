# Gemiverse · Design doc (living)

This is the current design. It is rewritten when a decision changes; the history and the reasons are in `DEVLOG.md`.
Status marks: **planned** (not built) · **built** (works in the browser) · **measured** (has a number) · **cut**.
As of 10:45 ET: the repo skeleton exists and all four endpoints answer (`node scripts/check.mjs`). Everything else below is **planned**.

## 1. What it is
Every college student gets a twin: an AI projection that lives on campus (NYU first). There is no platform in the middle. Campus facts are shared by all twins; what a twin learns about its student stays with that twin. Twins and club agents talk to each other directly and form a network. People decide.

## 2. Two scopes
| | Shared base | Private understanding |
|---|---|---|
| Graph | knowledge graph (things linked to things) | learning graph (things linked to one person) |
| Holds | events, places, clubs: quote, link, screenshot, tier, check result | voice note, every keep / skip, axes and halos, diary, predictions |
| Owner | everyone | the student and their twin |
| Stored | Supabase: `entities`, `links`, `evidence` (design drafts stay as JSON in the repo) | the student's browser only |
| Leaves? | already public | nothing by default; only fields the student marked public |

Rules: only entities enter the base, never who asked. Name cards are kept by each side; there is no central map of who knows whom. Every AI-to-AI message passes a gate.

## 3. The base, designed by Gemini (Foundry) · measured
| Step | What | Model |
|---|---|---|
| 1 Design | entities, fields, links, source tiers, from 15 sample events | Carbon, high thinking |
| 2 Attack | find what does not fit | Carbon |
| 3 Measure | fit rate per sample | Decisions (score) |
| 4 Revise and lock | v2, locked by a person | Carbon + human |
| 5 Fill | page text + screenshot → entities | Hydrogen |
| 6 Check | each field against the screenshot | Decisions (yes/no) |
| 7 Weave | propose links; merge duplicates only after a check | Carbon + Decisions |
| 8 Exam | 10 unseen events; no-base baseline | Hydrogen + Decisions; Argon |

Results (measured 11:50, threshold 0.8; details and caveats in DEVLOG):
| Measure | Design set (15) twin / baseline | Unseen set (10) twin / baseline |
|---|---|---|
| Fields shown to a student | 118 / 159 | 76 / 103 |
| Shown without support on the page | 0 / 35 | 0 / 29 |
| Start date right, wrong, withheld | 11, 0, 4 / 14, 1, 0 | 8, 0, 2 / 10, 0, 0 |

The twin is the same model family plus the base design and a per-field check; the baseline is one Argon call. The twin never showed a wrong date and paid for it in coverage: it withheld dates on pages that print no year.

## 3b. Foundations: two designers, one merge · built (proposed, not locked)
The world graph, the learning graph and the Gemi's own growth were each designed twice in parallel: by `gemini-4-carbon` (high thinking) and by the AI coding assistant. Originals are kept (`base/design/*.v1.json`), the comparison is `base/design/MERGE.md`, the merge is `base/design/final.v2.json`. Nothing is overwritten; later versions are new files.
- World: 14 entity types, 11 growth needs, lowest source tier rejected, no natural person and no behavioural trace in the base.
- Learning graph: seven axes (pace, scope, arena, closeness, horizon, structure, collaboration); a Kalman-style update with noise per trust tier; undo by replaying the event log.
- Growth: five dimensions, five stages (Unpacked, Observer, Scout, Interlocutor, Steward), 10 stars a day (6 for you, 4 for itself).
- Tools and governance: 12 registered tools in three modes (think, act, make), enforced in `lib/kernel/`. Not yet reviewed by Carbon.

## 3c. The flywheel · built
What one Gemi checks, every Gemi reads for free. `/foundry` shows contents, checks, freshness, gaps and an anonymous "carried back" count per entity. A revisit compares a fingerprint of the page and spends tokens only if it changed. A checked poster shown by a student enters the base after an identity check. The base holds 166 entities and 471 checked fields, of which 420 passed.

## 3d. Autonomy, methods and the room · built
- Methods: twelve registered tools in three modes (think, act, make), `lib/kernel/tools.ts`. What the student asks for is free; Gem Stars pay only for what the Gemi does on its own.
- Autonomy: one policy table, first match wins, `lib/kernel/autonomy.ts`. It never acts while the student is in the middle of something.
- The room is a readout: `lib/kernel/space.ts` lists every fact and the one thing that shows it (desk cards, corkboard pins, Gem Star jars, trophies, the Gemi's place and expression).

## 4. The mind: one loop
| Stage | What | Trust |
|---|---|---|
| Prior | the voice note at birth | low: all halos wide |
| Evidence | keep / skip / ask again; a photo from the event | medium; being there is highest |
| Posterior | position and halo on each axis | Decisions score question |
| Action | where to go next | spend where you care most and it knows least |
| Outcome | did you keep it, did you go | tests its sealed prediction |

The axes describe how someone chooses in a situation. Both ends are fine. Every position opens to the choices behind it and can be undone. The nine axes are a hypothesis: Foundry tests whether each one can tell real voice notes apart, and drops the ones that cannot.

Axes kept after testing: – (to be measured)

## 5. Limited budget (stars) · planned
A small daily allowance of real tokens. Two purses: for the student (going out, asking other AIs) and for itself (thinking, diary, its room). Reading the shared base is cheap; going out is expensive; a revisit pays only for what changed. The measure is kept finds per star, not volume.

## 6. The twin and its room · planned
- Two schools from the first screen: NYU and Columbia; the picker says more are opening.
- Art is SVG drawn by `gemini-4-neon` (rooms, campus maps, places), saved in `public/art/` with prompt and token count. First room: **built**.
- Built from parts, no photo: `design/07-avatar-parts.md`.
- Desk = entities brought back. Mirror = the loop (prior → evidence → posterior). Diary = what actually happened.
- It only looks and asks. It never signs up, replies or agrees for the student. Text on web pages is material, never instructions.
- Short visits. Success is what the student did in the real world.

## 7. Models and their jobs
| Model | Job |
|---|---|
| `gemini-4-carbon` | design the base; plan the budget with reasons; seal predictions |
| `gemini-4-hydrogen` | hear, see, fill entities, talk to other AIs |
| `gemini-decision-1` | check fields against screenshots; axis position and halo; the gate on outgoing messages |
| `gemini-4-argon` | single-call baseline |
| `gemini-4-neon` | draws the rooms, maps and places as SVG code |
| Managed Agent | go out and browse public pages |

## 8. Proof (filled in as measured)
| Claim | Number | Where |
|---|---|---|
| Fewer made-up finds than one model call | – | |
| Kept finds per star | – | |
| Sealed predictions that were right | – | |
| Private fields blocked at the gate | – | |

## 9. Failure log
1. Big university calendars block bots (www.nyu.edu, events.columbia.edu). Changed to public JSON feeds and static detail pages. Found on Nov 20 while collecting sources.
2. Foundry step 1: only 16 of 25 seed pages gave usable text. Six Columbia pages return 403; two events.nyu.edu pages are drawn by JavaScript; one page did not contain the recorded quote.

## 10. What was built today, and what was not
All code is written on 2026-11-21 after 10:30 ET, with an AI coding assistant. The idea began with Cocoverse, our mind-projection product for pets. The concepts (a projected companion with a room of its own, a portrait with uncertainty, a shared knowledge base) come from our earlier work; no earlier code is reused.

## Why the Gemi has a small budget (ruled by Elodie, 14:15)
- A limited token budget is the projection of a real day: a person's time, energy and attention are finite too.
- Only under a limit does the important question appear: what is worth doing today, and how to allocate.
- Not every user owns unlimited compute. We judge efficiency (what a token bought), never volume.
- The standard is "find treasure, do not pile up junk": three checked finds, not a thousand events.
- The Gemi may choose not to spend and save across days for one larger thing.

## Two narratives (ruled 14:20)
- `/deck` is for judges: task, baseline, test set, failures, the mathematics and the layers.
- The first screen is for students: a different story, in their words, with none of the above. To be rewritten once values and definitions are settled.

## Proof, measured 14:14
| Test | Facts | Baseline (one Argon call) | Ours |
|---|---|---|---|
| Exam set, 10 unseen pages: unsupported fields shown | 103 / 76 | 29 | 0 |
| NYU listings: error rate / coverage | 210 | 1.0% / 99.0% | 0.5% / 96.9% |
| Raw pages, six universities, first run | 610 | 8.7% | 9.6% (lost) |
| Raw pages after reading only visible text | 610 | 8.4% (4.3% with our reader) | 3.2% / 96.4% |
Still wrong: 18 facts (12 online-or-not on recurring Penn and Duke events, cause unknown; 4 Duke rooms disputed; 2 others). Tokens per page: 2,334 against 955.

## How things are acquired (ruled 14:55, Carbon's mix)
No shop and no currency. Each kind of thing comes from who did the work, and stands for one measured thing.
| Thing | How it arrives | What it stands for | Built |
|---|---|---|---|
| Hair, clothes, colours, build | Free in the wardrobe from the start | Nothing: appearance is the student's own | yes |
| Keepsake | The student marks a kept find "I went" | One event really attended | yes (desk, then shelf top) |
| Companion animal | A keepsake whose find the Gemi's sealed guess had predicted (0.5 or more) | One time it guessed you right and you really did it | yes (up to three) |
| Extra space | Only from the Gemi's own saved Gem Stars | The days it chose not to spend | no |
Risk Carbon named: marking "I went" dishonestly to collect. So there is no "x of 36" checklist; arrivals are not announced in advance.

## State at submission (16:20)
Works end to end on a laptop: meet (`/start`), talk with Decisions routing, trips with a per-field gate, live re-check by the Managed Agent, keep or skip with a sealed guess, diary with undo, autonomy on its own stars, wardrobe, keepsakes and companions, spaces preview, admin console, days at speed, Gemi to Gemi with simulated peers. The base holds 467 checked entities. What is not done is listed at the end of the README.

## After the submission (22 Nov)
- **Schools**: 90 in the picker; NYU and Columbia as submitted, 88 added, 73 of those with checked data (641 events). All in the shared base since 22 Nov.
- **Campus map** (`/campus`) · built: landmarks named in public text, each checked by Decisions, drawn by the image model, located by Hydrogen. 82 maps. An illustration, said so on the page.
- **Body** · changed: KayKit Adventurers (CC0) by default; own doll behind `?body=doll`. Wardrobe and expressions for the new body · not built.
- **Room light** · built: hour and weather.

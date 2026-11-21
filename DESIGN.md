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
All code is written on 2026-11-21 after 10:30 ET, with an AI coding assistant. The concepts (a campus twin, a portrait with uncertainty, a shared knowledge base) come from our earlier work; no earlier code is reused.

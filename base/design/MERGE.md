# Foundation design: two designers, one merge

Two designs were written in parallel on 2026-11-21, from the same brief, without seeing each other:

| File | Designer | How |
|---|---|---|
| `world.v1.json` | Gemini 4 Carbon, high thinking | 773 s, 165k tokens, grounded in the 15 design-set pages |
| `learner.v1.json` | Gemini 4 Carbon, high thinking | 641 s, 76k tokens |
| `growth.v1.json` | Gemini 4 Carbon, high thinking | 341 s, 24k tokens |
| `../ontology.v1.json` | Gemini 4 Carbon, high thinking | 1202 s, 107k tokens; events only, the first narrow brief |
| `assistant.v1.json` | Claude (the AI coding assistant) | one document covering all three, plus tools and governance |

Rule: **none of these files is ever overwritten.** The merge is a new file (`final.v2.json`). Later versions are new files too. Raw model output and prompts are in `../runs/`.

Status of the merge: **proposed, not locked.** A person (Elodie) locks it. Until then code follows `final.v2.json` but may change.

## 1. The world graph (shared base)

| Question | Carbon | Assistant | Merged (v2) | Why |
|---|---|---|---|---|
| How many entity types | 13: School, AcademicUnit, Program, Campus, Building, Venue, Event, Course, Opportunity, Service, GrowthNeed, Organisation, Agent | 10: school, unit, program, place, org, resource, occurrence, need, source, evidence | Carbon's split of resources (Event, Opportunity, Service; Course defined but empty) and of space (Building, Venue; campus becomes a field). Assistant's `source` and `evidence` kept as their own tables | Carbon's split matches how the pages differ (an event has sessions, an opportunity has a deadline, a service has hours). Per-field evidence as a table is what lets a revisit re-check only what changed; it already exists in Supabase |
| Repeating events | `occurrences` array inside Event | separate `occurrence` entity | Carbon's array | fits one JSON document per entity; fewer joins |
| Need vocabulary | 11 needs, incl. get_mentorship_and_feedback, fund_my_path, contribute_beyond_self, navigate_systems | 9 needs, incl. get_unstuck, see_the_city | Carbon's 11 | superset; "get_unstuck" is covered by navigate_systems and mentorship. "see_the_city" dropped: no evidence in samples |
| Which source is most trusted | Tier 1 = structured official feed (typed dates, ids); Tier 2 = official page | Tier 1 = organiser's own page; Tier 2 = feed | **Disagreement kept.** v2 uses Carbon's order for dates, times and addresses and the assistant's order for descriptions and rooms | Carbon's own samples show both failing differently: a feed has exact timestamps, a page has the room and the human wording. To be settled by the exam: which source wins when they disagree |
| Tier 4 (open web, hearsay) | rejected from the base | allowed at lowest tier | Carbon's: rejected | "rather miss than be wrong" |
| People in the base | absolute ban, including speaker names and anonymised counts | no students; anonymous counts "maybe later" | Carbon's stricter rule | simpler to explain and to enforce: no natural person, no behavioural trace, ever |
| Agents | has a public signing key and supported intents | scope URL only | Carbon's fields recorded; signing not built today | honest gap |

Both designers independently named the same open problem: pages that contradict themselves (a library page labelled in-person with an online footer). v2 rule: a contradicted field stays off every desk until a second source settles it.

## 2. The learning graph (private side)

| Question | Carbon | Assistant | Merged (v2) | Why |
|---|---|---|---|---|
| Axes | 7: pace, scope, arena, closeness, horizon, structure, collaboration | 6 kept, 3 doubtful (basis, control, drive) | Carbon's 7 | see the three rows below |
| basis (by feel ↔ evidence first) | drop: confounded with subject area | cannot be moved by keep/skip; read it from behaviour instead | dropped as an axis; "opened the source before choosing" is still logged as an event | both agree keep/skip cannot move it |
| control (wants a guide ↔ decides alone) | merge with certainty into **structure** (guided and planned ↔ self-directed and open) | suspected to collapse into collaboration | Carbon's merge | Carbon gives an observable contrast (a syllabus-led course vs an open studio); the assistant only had a suspicion |
| drive (recognition ↔ personal meaning) | reword to **arena** (public stakes ↔ private space) | do not infer at all | Carbon's rewording | "arena" is about the situation chosen, which is observable; "drive" was about motive, which is not |
| How belief updates | variance model: observation noise per trust tier (2.5 / 1.0 / 0.45 / 0.22), decay over ~29 days, widening on surprise, floor 0.10 (0.55 for self-report) | linear step with a weight per tier | Carbon's noise values in a plain Kalman step (gain = v / (v + noise)); Carbon's floors and decay; the assistant's "undo = replay the log" | same idea, Carbon's has a justification for each number; the mixture term for surprise is simplified to a fixed widening |
| Where to spend next | gap = care × uncertainty × relevance × cooldown; slots 1 and 2 are a contrast pair | care × serves + halo × informs; one contrast pair | Carbon's formula | adds cooldown, which stops it nagging about the same axis |
| What is never recorded | long explicit list incl. mood, prosody, sleep, protected traits, other people | short list | Carbon's list | more complete |

Agreement worth noting: both put "what was shown next to it" inside a choice. A keep only means something as a contrast.

## 3. How the Gemi grows

| Question | Carbon | Assistant | Merged (v2) | Why |
|---|---|---|---|---|
| Dimensions | attunement, world grounding, thrift, social weave, self-calibration | knows you, knows the world, spends well, who it knows, knows itself | same five; Carbon's names and formulas | the two lists are the same list |
| Stage names | Unpacked, Observer, Scout, Interlocutor, Steward | Just woke, Finding its feet, Knows your taste, Out in the world, Good neighbour | Carbon's names | clearer about what it may do |
| Stage entry | several metrics at once (for stage 2: 8 resolved cards, attunement ≥ 0.45, calibration ≥ 0.60) | one plain condition each | Carbon's conditions are the target; today's build uses the assistant's single conditions and shows Carbon's as "full rule" | one afternoon cannot produce the 90-day acceptance rate Carbon's stage 5 needs |
| Daily budget | 10 stars: 6 outward, 4 inward; 1 star ≈ 1,500 weighted tokens | 6 and 4 | identical; Carbon's unit definition adopted | independent agreement |
| When the student is away | priority table over time of day, weather, purses, unread cards, pending questions | five rows | assistant's five rows plus Carbon's first two (asleep at night; stay home while cards are unread) | weather needs a live feed; not today |
| Never build | streaks, leaderboards, guilt | same | same | independent agreement |

## 4. Not yet compared

Tools and governance (`self_use_modes`, `tools_for_agent_mode`) exist only in the assistant's design and in code (`lib/kernel/`). Carbon has not reviewed them. Next Foundry step: Carbon attacks the tool base and the make pipeline.

## 5. What the comparison says about the two designers

- Carbon is more exact (a formula and a threshold for everything), more careful about privacy, and better grounded in the sample pages: it cites sample ids for its choices.
- The assistant's design is smaller and treats everything as events on entities, which is what the code needs.
- Where they disagreed and Carbon had an observable example, Carbon won. Where Carbon's design could not be built or measured in one day, the smaller rule was kept and Carbon's recorded as the target.
- Token cost of Carbon's four designs: about 372k tokens.

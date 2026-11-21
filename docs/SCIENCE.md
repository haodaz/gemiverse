# Gemiverse: method and theory

Written 2026-11-21. Citations are from our own source list (`research/sources.md`). Numbers are from `DEVLOG.md`. "Planned" means designed but not built. "Not measured" means we have no number.

## 1. The method in one page

We treated the product's foundations as a hypothesis to test. Pages were split by position into a design set (15) and an exam set (10) before any model saw them. Every field gets a score from the Decisions API and enters the base only at 0.8 or above. A one-call baseline (Argon, no rules, no check) reads the same pages. Two designers (Gemini 4 Carbon and the coding assistant) wrote the foundations in parallel without seeing each other; the merge is a new file and nothing is overwritten.

| | Design set (15 pages) | | Exam set (10 unseen pages) | |
|---|---|---|---|---|
| | Twin | Baseline | Twin | Baseline |
| Fields written | 145 | 159 | 100 | 103 |
| Fields shown to a student | 118 | 159 | 76 | 103 |
| Shown without support on the page | 0 | 35 | 0 | 29 |
| Start date right / wrong / withheld | 11 / 0 / 4 | 14 / 1 / 0 | 8 / 0 / 2 | 10 / 0 / 0 |
| Tokens | 35k | 19k | 24k | 13k |

Caveats, as logged: "0 unsupported" for the twin is by construction, because the gate is the same check. "Unsupported" is not "wrong": some baseline fields were true but not on the page. The field rules were tuned on the design set only. The twin costs about 1.8 times the baseline's tokens, plus the checks.

Evidence: our own measurements only (DEVLOG 11:48).

What we do not claim: that the twin is more accurate in general, or that these numbers hold beyond 25 pages.

## 2. The mind space

A mind here is an internal model that updates: prior, evidence, posterior, action, outcome. There are two loops, one about the student and one about the Gemi itself.

Slide diagram: two rings side by side, five stations each.

| Station | Student loop | Gemi's own loop |
|---|---|---|
| Prior | the first voice note, all bands wide | newborn, stage 1 |
| Evidence | keep, skip, a poster shown | checks passed or failed, predictions hit or missed |
| Posterior | seven axes, each a position and a band | five growth dimensions |
| Action | which trip, which three finds | think, act or make |
| Outcome | kept it? went? | stage and unlocks |

Evidence: agents that store, reflect and plan behave believably (Park et al. 2023); alternating reasoning and acting gives readable traces (Yao et al. 2023).

What we do not claim: that the Gemi understands minds. Model social reasoning breaks on small changes (Ullman 2023; Shapira et al. 2024), so every belief is a guess the student can correct (Strachan et al. 2024).

## 3. Trust

Evidence about a person and facts about the world each have tiers, and a lower tier moves a belief less. The rule for facts is "rather miss than be wrong": a missed suggestion costs little, a wrong room sends a student across the city.

| Evidence about the student | Noise in the update | | Source of a fact | Rule |
|---|---|---|---|---|
| said | 2.5 | | 1. official structured feed | trusted for dates, times, addresses |
| checked | 1.0 | | 2. official page | trusted for descriptions, rooms |
| seen over time | 0.45 | | 3. linked pages, verified org agents | may only enrich |
| actually done | 0.22 | | 4. open web, hearsay | rejected |

A field a page contradicts stays off every desk until a second source settles it. Which of tiers 1 and 2 wins when they disagree is an open disagreement between the two designers.

Evidence: calibrated trust is the goal (Lee & See 2004); per-case confidence helps people calibrate (Zhang, Liao & Bellamy 2020).

What we do not claim: that a passed check means true. It means the page supports it.

## 4. Seven axes of how someone chooses

The axes describe the situation a student picks, not the student. Both ends are fine.

| Axis | One end | Other end |
|---|---|---|
| pace | polish slowly | try fast |
| scope | go deep on one thing | touch many things |
| arena | public stakes | private space |
| closeness | figure out principles | make things people use |
| horizon | root nearby | look outward |
| structure | guided and planned | self-directed and open |
| collaboration | alone | in a group |

Why not personality types: no fixed labels are stored (the never-record list bans Big Five, MBTI and similar, along with mood, tone of voice, protected traits and other people's data); every belief opens to the choices behind it; undo replays the log without that choice.

From the original nine: "basis" was dropped because keep/skip cannot move it; "control" and "certainty" were merged into structure; "drive" (a motive, not observable) was reworded as arena (a situation, observable).

Update in plain words: each axis holds a position and an uncertainty. New evidence pulls the position toward itself, by more when uncertainty is high and the evidence tier is strong. Uncertainty then shrinks, never below 0.10, and never below 0.55 from talk alone. Evidence outside the band widens it by 0.15. A skip counts half and points the other way. Planned, not in code: drift back toward uncertain over about 29 days; "that's not me" resetting uncertainty to at least 0.65.

Evidence: correction and dismissal should be easy (Amershi et al. 2019).

What we do not claim: that the axes are valid, independent or stable. Not measured.

## 5. Limited budget as attention

Stars are real tokens and there are few, so the Gemi must choose where to learn. Gap = care × uncertainty (× relevance × cooldown in the full design). Of three finds, two sit on opposite ends of the least certain axis that matters (the contrast pair) and the third is the best match. Before showing them it records a keep probability for each (the sealed prediction).

Slide: three cards; two labelled with opposite poles of one axis; a lock and a short hash above.

Evidence: none from the source list. This is a design rule from our earlier work.

What we do not claim: prediction accuracy is not measured. The current seal is weak: the hash includes a timestamp that is not stored and the numbers reach the browser with the cards, so a student cannot yet verify it. The design (record written before first view, Brier score, at least 25 resolved items) is planned.

## 6. Growth of the Gemi

| Five dimensions | Five stages |
|---|---|
| attunement (predicts your keeps) | 1 Unpacked |
| world grounding (checked facts added) | 2 Observer |
| thrift (value per star) | 3 Scout |
| social weave (consented name cards) | 4 Interlocutor |
| self-calibration (confidence matches results) | 5 Steward |

Never built: streaks, leaderboards, punishing absence, or any record of session length. Both designers reached this independently.

Evidence: in a 4-week RCT (n = 981), people who used a chatbot more had higher loneliness and dependence and less real-world socialising; this is a preprint and condition effects were weak in the revised version (Fang et al. 2025). Users described feeling obliged to meet a bot's "needs" (Laestadius et al. 2022/2024). Controlling pressure undermines motivation (Ryan & Deci 2000). A missed day does not derail a habit (Lally et al. 2010).

What we do not claim: any wellbeing benefit. Carbon's formulas and thresholds are targets; today's build uses one plain condition per stage.

## 7. Governing an agent that spends its own tokens

The Gemi has its own purse and three modes. Rules are in code so a prompt cannot argue around them.

| Mode | What | Limit |
|---|---|---|
| think | plan, seal, diary | private notes only |
| act | call a registered tool | charged first, daily cap |
| make | propose a new room item | never installed directly |

Slide: one call passing six gates in order: registered, not paused, stage, daily cap, stars, confirmation. Checked: a newborn may call 9 of 12 tools; refusals give a reason. Make pipeline: static scan (built: no imports, network, storage or page access), then dry run, Decisions check, student approval, revocable install (design; not confirmed as built in the dev log).

Evidence: choosing only among actions the scene affords reduces impossible actions (Ahn et al. 2022; Gibson 1979). Transparency and accountability (National Institute of Standards and Technology 2023).

What we do not claim: Carbon has not reviewed this part; it comes from one designer only.

## 8. The projection table

| Theory | In the game |
|---|---|
| Checked facts from the shared base | cards on the desk, each field with its score |
| Learning graph, with undo | the diary, with the seven-axis view and a band for uncertainty |
| Growth needs, grouped | four buildings: Library, Clubs, Commons, Opportunities |
| Token budget, for the student and for itself | stars in two purses |
| Sealed prediction | lock icon and hash on the desk |
| Growth stages | locked tools, "Unlocks at stage N" |
| Outbox gate | "What left this room" (panel built; gate planned) |
| Autonomy policy | the Gemi's own activity in the room (random loop today; policy planned) |
| Things actually attended | keepsakes in the room (planned) |

Evidence: visible signifiers show what can be acted on (Norman 2013). A belonging message only worked where real opportunities existed (Walton et al. 2023).

What we do not claim: that every object is wired to its fact yet.

## 9. Limits and open questions

- Small sample: 25 pages, 15 design and 10 exam, two universities.
- "0 unsupported" is by construction.
- Coverage cost: 6 of 25 start dates withheld (pages print no year); the baseline guessed, right 5 times, wrong once.
- Axes not validated on real students.
- Carbon's stage thresholds need weeks of data (one needs a 90-day rate).
- No live user study; no outcome in students' lives measured.
- Private data stays in the browser, but content still goes to the Gemini API when a model is called.
- The design itself was not scored separately.

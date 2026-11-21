# Gemiverse · Dev log

Written as we go, newest at the bottom. Times are Eastern (ET), Sat 2026-11-21.
Each entry: what we decided or did, why, and how we know it works (or that it failed).
Hacking opened at 10:30. Entries before that are thinking only: no product code existed yet.

Entry format:

```
## HH:MM · short title
- Did / decided:
- Why:
- Gemini's part: (model, thinking level, tokens, if any)
- Check: (what we looked at to know it works; or what failed)
- Next:
```

---

## 09:20 · Morning check (no code)
- Did: read the direction notes, the day plan and the material kit. Confirmed Node, npm and git work, the Gemini key file is filled in, and this laptop can push to GitHub over SSH.
- Why: nothing may be written before 10:30, so the morning goes to rules, consented voice notes and Wi-Fi.
- Next: create the public repo on github.com after 10:30.

## 09:26 · Re-read the sources, rewrote the direction (v3)
- Did: went back to the three original sources (the campus twin design notes, the mental-models research brief, the data and knowledge infrastructure pages) instead of trusting last night's summary.
- Decided:
  - The mind is a loop, not a feature list: prior → evidence → posterior → action → outcome. We dropped the "eight intelligences" framing; the evidence for it as a measure is weak.
  - Trust is a chain: source tier → cross-check → contradiction → off the desk. "Rather miss than be wrong."
  - Limited budget follows one rule: spend where the student cares most and the twin knows least.
  - New proof: the twin seals a prediction before the student chooses, then we reveal it.
- Why: last night's version described the mind as a list of senses and treated the world as loose web pages. The sources say the value is the loop and the checked base under it.

## 09:29 · No platform. Shared base, private understanding
- Decided (Elodie): the product is de-platformed and centered on the person. Twins connect to each other directly. They share the data base; each keeps its understanding of its own student to itself. The knowledge graph and the learning graph live in different scopes.
- What follows:
  - Only entities go into the shared base, never who wanted or kept them.
  - No central graph of who knows whom: each side keeps its own name card.
  - Every AI-to-AI message passes a gate that checks nothing private leaves.
  - No feed, no ranking, no site-wide profile, no central recommender.
- Honest limit: "stays in the browser" means our server keeps nothing. The content still goes to the Gemini API when a model is called.

## 09:31 · Elodie's notes, sorted
- The room and trusted finds are the hook. The life of it is the people: no platform you can feel, AIs weaving the net.
- Raising the twin is really raising yourself: each choice shows you how you choose.
- Know-how first. Without a shared understanding of the elements, everything fetched is fragments. Quality of understanding over quantity.
- Tokens are limited, like a person's day. Scarcity forces the important thinking. Pick treasure, don't pile up junk.
- The flywheel should not burn every time: answers many people care about stay in the base; a revisit only checks what changed.
- A daily token allowance, spent two ways: for you, and for itself.

## 09:33 · Avatar from parts, no photo
- Decided: students build the twin from a small set of parts (skin tones, hair, eyes, mouth, clothes) or tap random. No photo of the student is used.
- Why: no image of a person to handle; and the twin may look like who you'd like to be.
- How: one function turns a small "look" object into SVG. Written fresh today.
- Spec: `design/07-avatar-parts.md`.

## 09:35 · Gemini designs the base first (Foundry)
- Decided (Elodie): bring Gemini in to design the base before anything else. It can be ugly at first, but it must come from logic and measurement, with Gemini taking part in every step.
- Plan: a backstage page that runs eight steps and logs each one. Carbon (high thinking) designs the structure from 15 sample events and then attacks its own design; Decisions measures the fit; a person locks it; Hydrogen fills entities; Decisions checks each field against the screenshot; Carbon proposes links; 10 unseen events are the exam, with Argon as the no-base baseline.
- Same for the nine axes: they are our hypothesis. Carbon writes the rubric, Decisions scores real voice notes, and an axis that cannot tell people apart is revised or dropped.
- Why this counts as science: design and exam samples are separate; every judgement has a number; there is a baseline; failures are written down.
- Spec: `design/08-foundry.md`.

## 09:36 · This log and the design doc
- Decided (Elodie): keep a dev log of every step's logic, and build the design doc as we go.
- How: `DEVLOG.md` is append-only (what happened, in order). `DESIGN.md` is the current truth (rewritten when a decision changes, with a pointer back to the log entry). Both move into the new repo at 10:30.

## 10:45 · Repo skeleton and the four endpoints answer
- Did: created a fresh Next.js project (App Router, TypeScript, Tailwind) at 10:41, after hacking opened. Put the event's API key (tier 3) into `.env.local`, which git ignores. Wrote `scripts/check.mjs`, which calls each endpoint once.
- Why: nothing else can be built until the three models and the Decisions API answer from this laptop.
- Gemini's part: Hydrogen, Carbon and Argon each replied "ready" (41 tokens each, thinking low). Decisions answered two yes/no questions about a poster line.
- Check: all four returned 200. Hydrogen 1.6 s, Carbon 5.1 s, Argon 6.0 s, Decisions 0.3 s. Decisions said "free: yes" at 0.98 and "on a Saturday: no" at 0.97; both are right (the line said Friday).
- Next: push to a public GitHub repo, then build the Foundry page.

## 11:06 · Foundry step 1: raw pages fetched, 16 of 25 usable
- Did: `scripts/foundry/01-fetch.mjs` fetches each seed event's public page, strips it to text, and saves it under `base/raw/`. The split is fixed by position: 15 design (11 NYU, 4 Columbia), 10 exam (7 NYU, 3 Columbia).
- Gemini's part: none. This step is plain code on purpose, so the models only ever see real page text.
- Check: a page counts as usable only if it has more than 400 characters and contains the quote we recorded by hand. 16 of 25 pass.
- Failed: 6 Columbia pages return 403 (events.columbia.edu blocks scripts). 2 events.nyu.edu pages are drawn by JavaScript, so the fetched text is almost empty. 1 Tisch page loads but the recorded quote is not in it.
- Next: read the two events.nyu.edu events from the public JSON feed; find a static source for the Columbia six or mark them as lower tier.

## 11:06 · Decisions from Elodie: storage, two schools, Neon for art
- Storage: design drafts (ontology versions, run records) stay as JSON in the repo. Live entities, links and per-field evidence go to Supabase, so every twin reads and writes the same base. Three tables, none of which has a column for who asked or kept anything (`base/sql/001-base.sql`). What a twin learns about its student still lives only in the browser.
- Two schools from the first screen: NYU and Columbia. The school picker offers only these two and says more are opening.
- The room and the campus map follow the layout of our earlier concept (a single room; a full-screen campus map with places to go). Redrawn and rewritten today.
- Art: a judge pointed us to Gemini 4 Neon for visual assets. Neon returns text, so we ask it for SVG code. First try: an isometric room, 26.7k characters of SVG, 22.5k tokens, 3 minutes, usable as is. Eight more are running (two campus maps, five places, a second room). Every file is saved in `public/art/` with its prompt and token count, because the event's API account expires tonight.
- Why SVG and not generated bitmaps: it stays sharp at any size, objects in the room can be made tappable, and the prompt and output are both readable in the repo.

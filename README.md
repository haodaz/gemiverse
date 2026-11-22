# Gemiverse

**Every college student gets a Gemi: an AI of their own that lives on campus, goes out on a small daily budget of real tokens, and tells them only what it has checked against the source.**

Built by one person at the Gemini 4 NYC Hackathon, Saturday 2026-11-21. Track 1, 5 Sigma.

- Live: https://gemiverse.vercel.app · one-minute film: https://youtu.be/uxwhj7j9LQQ (file: [`public/film/gemiverse-1min.mp4`](public/film/gemiverse-1min.mp4)) · method and results: `/deck` (English and Chinese) · back office: `/admin`
- **All code in this repo was written today**, after 10:30 ET, with an AI coding assistant (Claude Code).
- The idea began with Cocoverse, our mind-projection product for pets. The concepts (a projected companion with a room of its own, a portrait with uncertainty, a shared knowledge base) come from our earlier work. No earlier code is reused.
- `DESIGN.md` is the living design doc. `DEVLOG.md` records every step, including the failures.

## After the hackathon (21 Nov evening to 22 Nov)

The hackathon submission is the commit tagged `hackathon-submission` (`23dcd7f`, pushed 16:56 ET on 21 Nov). Everything below was added after the 17:00 deadline and is not part of what was judged.

- **More schools**: 88 more campuses beside NYU and Columbia (the Chinese C9 and other 985 universities, and US universities ranked up to about 50), picked on a two-tab start page (China / United States). 73 of them have checked data: 641 events, 2,927 field checks, harvested with the same Hydrogen fill and Decisions gate (`scripts/foundry/12-c9.mjs`). 15 schools are still empty; many Chinese listings are of past events.
- **Campus maps with each school's own features** (`/campus`, `scripts/foundry/13-landmarks.mjs`): Hydrogen lists the landmarks a public encyclopedia article names, the Decisions API checks each one against that text, the image model draws a picture map from the confirmed ones, and Hydrogen locates each landmark in the picture so the page can label it. 82 maps. They are illustrations: the landmarks are checked, their positions and looks are drawn, not surveyed.
- **The Gemi's body** is now a ready-made character from the **KayKit Character Pack: Adventurers by Kay Lousberg (CC0)**, see `public/vendor/CREDITS.txt`. Our own jointed doll is still there (`?body=doll`); the wardrobe only dresses our own doll.
- **Light in the room** follows the hour and the weather outside the window (sun, lamp, rain, snow).
- Chinese is offered first to Chinese-language browsers; the campus pictures of the added schools show the region, not the real campus.

## The task

Tell a student what is on at their university, and never tell them something false. It sounds like a lookup. Agents fail at it: they read text the page hides, they fill gaps, and the big calendars block them. A wrong room or a wrong day costs a student an evening, so the rule is: **miss rather than be wrong.**

## What you can do in it

| | |
|---|---|
| Meet your Gemi (`/start`) | A point of light; you name it, tell it one thing, choose NYU or Columbia. Nothing leaves the browser. |
| Talk (`/room`) | Type, speak or show a poster, in any language. A Decisions choice question routes what you asked for, with a confidence check. |
| It goes out | Three finds on the desk. Every field was checked against its source; what failed is not shown. |
| Look again, live | A Managed Agent fetches the source page itself in a sandbox; the Decisions API judges each stored field against what it saw. |
| Keep or skip | It had sealed a guess (commit and reveal; the browser recomputes the hash). It learns how you choose on seven axes with uncertainty. The diary shows it; any line can be undone. |
| On its own | A first-match policy over measured state: go out, write its diary, save Gem Stars across days, notice that you moved its furniture. 14 registered methods, two purses, nothing else callable. |
| Over time | No shop, no currency. Clothes are free; a keepsake arrives when you really went; a companion when its guess had matched; new spaces only with stars it saved. |
| Back office (`/admin`) | Dashboard, data flywheel, AI performance, users, test runs (whole days at speed, Gemi to Gemi with simulated peers). |

## Proof (inputs we did not pick; truth from the calendars' own structured fields)

| Test | Baseline: one Argon call | Ours |
|---|---|---|
| 10 unseen pages: fields shown with no support on the page | 29 of 103 | 0 of 76 |
| 70 NYU listings, 210 facts: error rate / coverage | 1.0% / 99.0% | 0.5% / 96.9% |
| 122 raw pages from six universities, 610 facts, first run | 8.7% | 9.6% (we lost) |
| Same pages after we read only the text a person can see | 8.4% (4.3% with our reader) | 3.2% / 96.4% |

- **Credit where it is due:** reading only visible text gets a single call to 4.3% for 40% of our tokens. Our per-field check pays 2.4 times the tokens for the tail.
- **Where it still fails:** 18 facts, listed in `base/runs/08-eval-pages.json`. 12 are events called online against a key that says in person: 9 are hybrid (a room and Zoom), 2 are titled "online via zoom", 1 is a real error. The field needs three values, not yes or no; that is not built.
- **What we changed after seeing failures:** 15 corrections with before, how and after in `base/runs/improvements.json`.
- **The base:** 467 checked entities (events, clubs, places) for NYU and Columbia; one check serves every student, and a revisit costs 0 tokens unless the page changed.
- Rerun: `node scripts/foundry/07-eval.mjs`, `node scripts/foundry/08-eval-pages.mjs`, then `node scripts/proof-summary.mjs`.

## Models, one job each

| Model | Job |
|---|---|
| `gemini-4-carbon` | Designed the base, the learner graph and the growth stages (drafts and merge in `base/design/`). Plans the Gemi's day by the gap rule. Reviewed the whole design at 14:50 (`base/runs/10-carbon-review.medium.json`). |
| `gemini-4-hydrogen` | Hears and reads in any language, reads posters, fills entities, tags needs, writes the diary, plays the simulated student, speaks for each side in Gemi-to-Gemi. |
| `gemini-decision-1` (Decisions API) | The gate: one question per field with the confidence checked in code; intent routing; identity of two records; privacy gate between Gemis; re-check against the Managed Agent's report. |
| `gemini-4-argon` | The single-call baseline. |
| `gemini-4-neon` | Wrote the 3D as code: room, furniture, character, clothes, hair, 29 motions, creatures, eight spaces, maps, icons (`public/gen3d/`, `scripts/art/`). |
| Managed Agent `antigravity-preview-09-2026` | "Look again, live": fetches a find's source page in a Google-hosted sandbox (`/api/agent`, record in `base/runs/11-agent-trip.json`). |
| `lyria-3-clip-preview` | Music in the room, the film's bed, and the song a Gemi writes when it has saved enough. |
| `gemini-3-pro-image` | Stills for the film and the banner, drawn from a screenshot of the real room. |

## Run it

```bash
npm install
cat > .env.local <<'ENV'
GEMINI_API_KEY=your-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-secret-key
ENV
# once, in the Supabase SQL editor: base/sql/001-base.sql
node scripts/check.mjs   # do the Gemini endpoints answer?
npm run dev              # http://localhost:3000
```

The live site has the shared base but no Gemini key, so hearing, seeing, going out and the Managed Agent run only locally.

## Where things are

- `app/` pages and API routes · `lib/kernel/` tools, governance, autonomy policy, the room as a readout · `lib/mind.ts` the update rule
- `scripts/foundry/` design, fill, harvest, the two evaluations, Gemi to Gemi, the Managed Agent trip · `base/` designs, seed, SQL and every run record
- `public/gen3d/` the 3D written by Neon · `scripts/art/` the scripts that asked for it · `scripts/video/` how the film was recorded and assembled

## Not done, said plainly

- The Gemi's own daily trips read the checked base; only "Look again, live" browses.
- The learning half is measured on simulated students only.
- Gemi to Gemi runs against peers invented by Carbon; there are no club agents and no accounts.
- The extra spaces can be viewed; their functions are designed, not built.
- The character is rough: three generated faces were rejected and the face is hand-painted.
- Several prompts still ask Hydrogen for JSON in text rather than structured outputs.

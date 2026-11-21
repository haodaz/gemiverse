# Gemiverse

Every college student gets a twin: an AI projection that lives on campus, goes out to real public pages on a small daily budget, and brings back only what it has checked. Campus facts are shared; what a twin learns about its student stays with that twin.

Built at the Gemini 4 NYC Hackathon, Saturday 2026-11-21.

- **All code in this repo was written today**, after 10:30 ET, with an AI coding assistant (Claude Code).
- The idea began with Cocoverse, our mind-projection product for pets. The concepts (a projected companion with a room of its own, a portrait with uncertainty, a shared knowledge base) come from our earlier work. No earlier code is reused.
- `DESIGN.md` is the living design doc. `DEVLOG.md` records every step, including failures.

## The task and the proof (Track 1, 5 Sigma)

**Task:** tell a student what is on at their university, and never tell them something false. Deck: `/deck` (online at https://gemiverse.vercel.app/deck).

| Test (inputs we did not pick; truth from the calendars' own structured fields) | Baseline: one Argon call | Ours |
|---|---|---|
| 10 unseen pages: fields shown with no support on the page | 29 of 103 | 0 of 76 |
| 70 NYU listings, 210 facts: error rate / coverage | 1.0% / 99.0% | 0.5% / 96.9% |
| 122 raw pages from six universities, 610 facts, first run | 8.7% | 9.6% (we lost) |
| Same pages after we read only the text a person can see | 8.4% (4.3% with our reader) | 3.2% / 96.4% |

- **Where it still fails:** 18 facts, listed in `base/runs/08-eval-pages.json`. 12 are events called online against a key that says in person: 9 are hybrid (a room and Zoom), 2 are titled "online via zoom", 1 is a real error. The field needs three values, not yes or no.
- **What we changed after seeing failures:** 14 corrections with before, how and after in `base/runs/improvements.json`.
- Rerun: `node scripts/foundry/07-eval.mjs`, `node scripts/foundry/08-eval-pages.mjs`, then `node scripts/proof-summary.mjs`.
- Other models used: `gemini-4-neon` writes the 3D room, character, motion and icons as code; `lyria-3-clip-preview` writes music. The Managed Agent (`antigravity-preview-09-2026`) re-checks one find live on request: it fetches the source page itself in a Google-hosted sandbox, and the Decisions API judges field by field whether what we stored still agrees (`/api/agent`, record in `base/runs/11-agent-trip.json`). The intent of what a student says is routed by a Decisions choice question with a confidence check, not by free-text JSON.

## Run it

```bash
npm install
echo "GEMINI_API_KEY=your-key" > .env.local
node scripts/check.mjs   # do the four Gemini endpoints answer?
npm run dev
```

## Models

| Model | Job |
|---|---|
| `gemini-4-carbon` | design the base; plan the budget with reasons |
| `gemini-4-hydrogen` | hear, see, fill entities, talk to other AIs |
| `gemini-decision-1` (Decisions API) | check each find against its source; position and uncertainty |
| `gemini-4-argon` | single-call baseline |

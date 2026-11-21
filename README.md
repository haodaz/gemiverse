# Gemiverse

Every college student gets a twin: an AI projection that lives on campus, goes out to real public pages on a small daily budget, and brings back only what it has checked. Campus facts are shared; what a twin learns about its student stays with that twin.

Built at the Gemini 4 NYC Hackathon, Saturday 2026-11-21.

- **All code in this repo was written today**, after 10:30 ET, with an AI coding assistant (Claude Code).
- The concepts (a campus twin, a portrait with uncertainty, a shared knowledge base) come from our earlier work. No earlier code is reused.
- `DESIGN.md` is the living design doc. `DEVLOG.md` records every step, including failures.

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

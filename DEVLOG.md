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

## 11:18 · All 25 raw pages; Supabase ready; first failure with Carbon
- Did: `01b-feeds.mjs` fills the nine pages a plain fetch could not read from each university's own public JSON feed. Now 25 of 25 usable: 17 static pages, 8 feed records (marked `json_feed`, one tier lower). The Columbia proxy returns at most 100 records per call, so it is asked in three date windows.
- Did: three Supabase tables created (`base/sql/001-base.sql`); all three answer.
- Failed: the first Carbon design run (high thinking) died after five minutes. Node's fetch gives up when no response headers arrive in 300 s. Fix: `background: true` on the interaction and poll its id every 5 s (`scripts/foundry/lib.mjs`). Checked with a small call; design run restarted.

## 11:18 · The room becomes real 3D, written by Neon to one contract
- Decided (Elodie): the flat SVG scenes look childish and cannot be customised. The room needs a stable structure that any new item can be placed into, with colours, materials and outfits that change.
- How: three.js, everything built from code, no model files. Three modules written by `gemini-4-neon` to one written contract (`scripts/art/prompts/`): a room shell that exports named SLOTS (bed, desk, chair, shelf, rug, lamp, wall art, diary...), a furniture kit where every item is a factory with origin on the floor, 3 shape variants, a material option and colour slots, and a character built from parts (skin, 10 hair styles, tops, bottoms, headwear, glasses, five expressions, idle animation). A new item only has to follow the contract to be placed.
- Our part: the test page (`public/gen3d/viewer.html`) supplies lighting, environment light, soft contact shadows (GTAO) and tone mapping, and places items by slot.
- Gemini's part: Neon, medium thinking. room.js 30k chars / 24k tokens / 175 s; character.js 49k / 28k / 201 s; items.js 61k / 37k / 266 s.
- Check: opened in the browser. Room, 11 items and the character render. The three buttons work: palette change recolours everything, style change swaps plank floor for herringbone, the bed frame for an upholstered one, the wooden chair for a swivel chair; random look changes hair, skin, headwear.
- Failed / still wrong: items.js used a global THREE in its helpers although the contract said not to (the page now provides it). Slot layout crowds the desk behind the shelf and wardrobe. The character is small and its face is hard to read from the default camera.
- The flat SVG scenes stay in `public/art/` as a fallback.

## 11:22 · Room layout is data on a grid; Arrange mode; the Gemi moves on its own
- Decided (Elodie): when arranging, switch to a 2.5D view with a grid so models and positions are easy to compute. When nobody is talking to it, the Gemi keeps itself busy in the room, stays quiet, or is out on campus. The campus outside is 2D: a few shared functional buildings plus each school's landmarks as decoration, with the Gemi shown on the map.
- How: a layout is plain data (item → position, quarter turns, kind) on a 0.25 m grid over the 4 m × 4 m floor, saved in the browser. Arrange mode shows the grid; click an item, click a cell; a move is refused if the footprint leaves the room or overlaps another floor item. Outside Arrange mode the Gemi walks between five spots (desk, window, rug, middle of the room, door), changes expression and shows a short line about what it is doing.
- Check: in the browser, moved the plant from the back wall to the front; it stayed after reload. Rotate and Reset buttons appear only in Arrange mode. The Gemi walked to a spot and stopped.
- Not yet: its behaviour is a random loop, not driven by its thinking; the campus map; texture detail on materials.

## 11:28 · Foundations first: three design jobs for Carbon; the first screen
- Decided (Elodie): everything grows from the bottom up. The 3D world is only the projection of the underlying logic plus sound operations design. Three foundations must be designed before screens: (1) the world graph (institution and programs, spaces, development resources, student growth needs, organisations, social relations), (2) the learning graph (what a Gemi should listen to and record about its student), (3) how the Gemi itself grows.
- Honest state before this entry: only a narrow version of (1) was running (an event schema from 15 pages). (2) and (3) had not been started.
- Did: wrote three design briefs (`scripts/foundry/prompts/world.txt`, `learner.txt`, `growth.txt`) and sent each to Carbon at high thinking (`scripts/foundry/03-design.mjs`). Each brief asks for a "projection" section: which object or behaviour in the room and on the map shows each fact, so nothing on screen is decoration. Each asks for what it is unsure about and how to measure it today.
- Gemini's part: Carbon designs all three. Results land in `base/design/*.v1.json`, raw output and token counts in `base/runs/`.
- Did: the first screen (`app/page.tsx`): choose NYU or Columbia, "More campuses opening soon". The card pictures are the window views Neon drew. Checked in the browser at 1440 wide: picking Columbia outlines the card in its blue and the button reads "Move in at Columbia".
- Art batch 2 from Neon (8 files, 22–31k tokens each): two window views, two wide campus panoramas with empty plots, four shared functional buildings (library, clubs, commons, career).
- Not yet: `/room` and `/foundry` pages do not exist, so both links on the first screen lead nowhere.

## 11:38 · Two designers in parallel; the tool base and its governance
- Decided (Elodie): the assistant writes its own foundation design in parallel with Carbon, and the two are merged, like two models sitting the same exam. Every running part of the product must land on these entities, including what the Gemi's actions change in its space and in its relations. The main needs become a tool base that the Gemi calls. The Gemi's own token use has three modes under strong governance: think (what is this token best used for), act (decorate its room, go out for resources, socialise), make (build something new for itself).
- Did: `base/design/assistant.v1.json`: shared entities and links, a public need vocabulary, private entities as an append-only event log, a table of what each action changes in each scope and how it is seen, a review of the nine axes (six can be moved by keep/skip; "basis" should be read from behaviour; "control" may collapse into "collaboration"; "drive" should not be inferred at all), the update arithmetic, the gap rule, growth dimensions and stages, the three modes and their governance.
- Did: the kernel in code. `lib/kernel/tools.ts` registers 12 tools (3 think, 8 act, 1 make) with what each reads and writes, its purse, cost, daily cap, confirm rule and minimum stage. `lib/kernel/governance.ts` decides every call: not registered, paused, stage, daily cap, stars, confirmation. A static scan rejects made code that imports, fetches, or touches storage or the page.
- Gemini's part so far: Carbon's event design came back (20 minutes, 107k tokens, high thinking): three entity types (Event with sessions, Place, Organization), five link types, and it named its own misfits and open questions, for example that a "seats available" number may be live rather than a capacity. Carbon's growth design came back (341 s, 24k tokens): metric-defined dimensions, staged unlocks, an autonomy decision table. World and learner designs still running.
- Check: `GET /api/tools`. A newborn may call 9 tools; ask_agent, meet_gemi and make_item are refused by stage; an unregistered tool, a paused Gemi and an empty purse are each refused with a reason; code containing fetch is rejected, a clean factory passes. `tsc` reports no errors.
- Next: merge the two designs section by section and record where they disagree; wire the tools to real model calls.

## 11:41 · Carbon's three designs are back; merged without overwriting anything
- Gemini's part: Carbon, high thinking. World graph 773 s / 165k tokens: 13 entity types across institution, space, resources, needs and organisations, 13 link types, 11 growth needs, four source tiers with the lowest rejected. Learning graph 641 s / 76k tokens: 12 kinds of event to listen for, an explicit never-record list, a review that cuts nine axes to seven (drops "basis", merges "control" and "certainty" into "structure", rewords "drive" as "arena"), a variance-based update rule. Growth 341 s / 24k tokens: five dimensions with formulas, five stages, a budget of 10 stars a day.
- Did: `base/design/MERGE.md` compares the two designers question by question and records who was followed and why. `base/design/final.v2.json` is assembled from the four originals by script; the originals are untouched. Rule from Elodie: both lines of thinking have value, so nothing is overwritten, including after a final version exists.
- Where they agreed without seeing each other: the same five growth dimensions; a 6 + 4 star split; no streaks or leaderboards; "basis" cannot be moved by keep/skip; a choice only means something next to what it was shown with.
- Where they disagreed: which source is most trusted (feed or the organiser's page). Kept as an open question for the exam.
- Honest limit: Carbon's stage conditions need weeks of data (a 90-day acceptance rate). Today's build uses one plain condition per stage and shows Carbon's as the full rule.
- Status: v2 is proposed, not locked. Elodie locks it.

## 11:48 · Foundry 5, 6, 8: entities filled, every field checked, exam against a one-call baseline
- Did: `scripts/foundry/05-fill.mjs`. For each page, Hydrogen fills one Event to the merged design (v2) and Decisions answers one yes/no question per field. A field enters the base only at 0.8 or above. The same pages go to Argon in one call with no rules and no check: that is the baseline, and everything it writes counts as shown. What passes is written to Supabase with one evidence row per field.
- First run on the design set, and what it taught us: 46 of 148 fields were blocked, mostly event kind, in person or online, who may attend, and registration. The pages rarely state these in words; they are our own labels. Asking "does the page state this" was the wrong question for a label. Fix: two kinds of field. A stated fact must be on the page. A classification is checked as "is this the best fitting label" and stored marked as inferred. Tuned on the design set only; the exam set was not looked at.
- Results (threshold 0.8):

| | Design set (15 pages) | | Exam set (10 unseen pages) | |
|---|---|---|---|---|
| | Twin | Baseline | Twin | Baseline |
| Fields written | 145 | 159 | 100 | 103 |
| Fields shown to a student | 118 | 159 | 76 | 103 |
| Shown without support on the page | 0 | 35 | 0 | 29 |
| Start date right / wrong / withheld | 11 / 0 / 4 | 14 / 1 / 0 | 8 / 0 / 2 | 10 / 0 / 0 |
| Tokens | 35k | 19k | 24k | 13k |

- What the numbers mean, honestly: "0 unsupported" for the twin is by construction, since the gate is the same check. The real findings are (a) a single call shows about one unsupported field in four, (b) the twin never showed a wrong date, (c) the price is coverage: the twin withheld 6 of 25 start dates, all on pages that print no year, where the baseline guessed the year. The guess was right 5 times and wrong once (it wrote 2025 for a December 2026 market). "Unsupported" is not the same as "wrong": some baseline fields were true but not on the page.
- A concrete invention by the baseline on the exam set: an end time of 22:00 for a dance concert whose page gives no end time.
- The twin costs about 1.8 times the tokens of the baseline for extraction, plus the checks.
- Base now holds 60 entities (25 events, plus places and organisations), 38 links, 245 evidence rows.
- Not done: links between entities are only event to place and organiser to event; no duplicate merging yet; fit of the design itself was not scored separately.

## 11:52 · The room page reads the real base
- Did: `/room`. Left: the 3D room, embedded, with the school's window view behind the glass. Right: two purses of stars, and four tabs. Desk lists the events in the shared base for the chosen school, each with its needs and "n of m fields checked"; opening one shows every field with its check score, and fields that failed show as withheld. "What it can do" lists the 12 tools by mode with cost, purse, model, what each writes, and why a locked one is locked. Diary and "What left this room" are empty states for now.
- How: `GET /api/base` reads Supabase on the server; the secret key never reaches the browser. The room tells the page what the Gemi is doing through a message; the page can tell the room to enter Arrange mode or change palette.
- Check: opened at 1440 wide with NYU chosen. 18 events listed; "Nevermind the Noise" shows "date not confirmed" because its page prints no year and the date was withheld, which is the base behaving as designed. The line under the room read "Your Gemi is writing in the diary" while it stood at the desk.
- Also: a gallery page (`/gen3d/gallery.html`) builds every piece of each Neon pack. Pets 12 of 12 and mythical creatures 16 of 16 build without errors.
- Failed: Elodie's verdict on the first packs: they look like balls stuck together. Cause: one call was asked for 12 to 36 models at medium thinking and given no method. New approach under test: one model per call, high thinking, explicit sculpting rules (displaced dense meshes, tapered tubes along curves, bezier extrusions, painted textures, layered eyes).
- Not yet: the desk shows the whole base, not what the Gemi chose to bring back; no birth, no plan, no keep or skip.

## 12:04 · Hearing and seeing; a game-style room; models sculpted one at a time
- Hear: `POST /api/hear`. Hydrogen takes a voice note (WAV made in the browser, microphone open only while the button is held, nothing stored) or typed words, and returns the transcript, up to three growth needs each with the exact words that show it, and one sentence back. It is told to record what was said and never how it sounded. Elodie asked for voice emotion analysis; we did not build it: the merged design's never-record list rules out mood, tone and prosody, and the event bans mental-health and personality tools. Check: a spoken test clip came back verbatim with "find my people" tied to "I want to meet people who make music"; 1,168 tokens.
- See: `POST /api/see`. Hydrogen reads a poster photo, screenshot or PDF into one event record; Decisions then checks each stated field against the same image. Check with our best poster: title 0.92, street address 0.95, organiser 0.82 passed; the start time was withheld because the poster prints "Monday, November 23rd" with no year. 3,599 tokens, charged as 1 star.
- Languages: English, Chinese, Spanish for the interface and for the Gemi's own words. Facts in the base stay in the language of their source.
- Room page rebuilt as a game screen (Elodie): the room fills the window; a call bar at the bottom (Talk, Desk, Diary, Campus, Arrange, Abilities, Outbox) opens one floating panel at a time; clicking the Gemi makes it stop, turn to you and show a menu over its head. The campus is a full-width map: each school's panorama as scenery, with the same four functional buildings standing on its four empty plots.
- Two demo presets, private-side data only: a first-year PhD student in education at NYU, and a sophomore at Columbia.
- Models: the first Neon packs looked like balls stuck together. Method changed to one model per call, high thinking, with written craft rules (sculpt one continuous surface by displacing a dense mesh, tapered tubes along curves, bezier extrusions, textures painted in code, three-layer eyes, sheen and clearcoat). First three: cat 42k triangles, eastern dragon 68k, student 58k; 52k to 64k tokens and 7 to 8 minutes each. Verdict from Elodie: animals much better, the person still too round. A second person brief asks for real anatomy and for body width and height as parameters of the sculpt. 36 more models are generating the same way.
- Left out on purpose: religious dress (hijab, turban) and the thunderbird, a sacred figure. We cannot check them with people from those traditions today, so they are not offered (`public/gen3d/hidden.js`).
- Not yet: the buildings on the map do nothing when clicked; no plan, go out, keep or skip.

## 12:17 · The loop is wired; who pays for what; a real seal; the doll's first assembly
- Loop: `POST /api/go`. The Gemi visits one of four places; Carbon (medium thinking) reads the shared base for that school, applies the gap rule and picks exactly three finds, two of which sit on opposite sides of the axis it is least sure about. First test (Library, a student who said she wants people who make things and dislikes crowded mixers): it chose a zine-making workshop, a prompt clinic and a 30-minute lightning lesson, contrasting the last two on "structure"; 4,811 tokens, 39 s. The page then shows three cards with Keep and Skip, updates seven axes from each choice (`lib/mind.ts`, a Kalman step with Carbon's noise per trust tier), and lists every choice in the diary with the axis before and after and an Undo that replays the log.
- Rule change (Elodie): Gem Stars are the Gemi's own allowance. What the student asks for directly is free; stars are spent only when the Gemi acts on its own. `mayCall` now takes who asked. Stars renamed "Gem Stars".
- Seal fixed after our own review found it could not be checked: the numbers used to travel to the browser with the cards. Now the browser gets the cards without numbers, a SHA-256 of the numbers plus a nonce, and the numbers encrypted with a server key. After the last choice `/api/reveal` returns numbers and nonce, and the browser recomputes the hash itself and shows a tick.
- Hearing in many languages: a Chinese clip with English words mixed in came back verbatim, languages "zh + en", two needs each with the original words and an English gloss, reply in Chinese.
- Copy trimmed (Elodie): explanations removed from everyday screens.
- Icons: 20 game-style SVG icons drawn by Neon in one call replace the emoji. New campus maps in calm isometric style; a third, richer version and four buildings that look like real university buildings are generating.
- Doll character, first assembly of four Neon modules to one skeleton spec: the jointed body works and the body width parameter changes the sculpt. Failed: the face frightened us (bulging glass domes over small high-set eyes, a dark gradient on the lower face), hands too small, hair like wire, and the clothes module was cut off at the output limit. Fixes: hands scaled 1.7 and head shading removed in the assembly; face and hair re-briefed with the faults listed; clothes split into three smaller modules. A motion library (walk cycle, sit, squat, lie down, wave, reach a shelf, write at a desk) is generating.
- `docs/SCIENCE.md`: the method and theory in nine short sections with a projection table, drafted by a subagent from our own research files only. Not yet reviewed line by line.
- Not checked in the browser yet: the full go-out, keep, reveal, diary path end to end (the API was tested; the page compiled).

## 12:21 · The loop checked end to end in the page; motion library works
- Check (in a browser tab, NYU preset): asked the Gemi to go to the Library. Gem Stars stayed at 6 and 4, because the student asked. It came back with three finds and a sealed hash. Keep, skip, keep: the reveal showed its guesses as 45%, 50% and 55%, one of three right, and the browser's own recomputed hash matched the seal (tick shown). The log held one trip and three choices. A first sealed prediction that is mostly wrong is the honest result: it knew almost nothing yet.
- Motion: `public/gen3d/doll-motion.js`, written by Neon (high thinking) to the shared skeleton names. 29 clips with cross-fading. Checked walk (legs alternate, knees bend, arms swing opposite), sitDown (hips and knees flex, hands rest on the thighs) and wave on the jointed body. This replaces the hop.
- Own initiative: left alone for 45 seconds with nothing waiting on the desk, the Gemi goes out by itself to the place that serves the need the student stressed most, and pays 3 Gem Stars from its own allowance. The desk shows whose idea the trip was. Not yet checked in the page.
- Character: Elodie's verdict is that the character is now the only visual that is not good. New target from her reference: a low-poly, faceted chibi with a flat painted face. Generating on the same skeleton names so the motion library carries over.

## 12:30 · Two characters; the model was shown its own render
- Problem (Elodie): "it does not seem to understand the shape of a face. Is there a way?" Cause: a model that writes 3D code never sees what it made.
- Fix, two parts. (1) Show it: `scripts/art/neon-review.mjs` sends Neon a screenshot of the rendered doll with a written critique and asks for a corrected module. (2) Stop asking it to imagine a head: the brief gives the head as a width-by-height profile (widest at the cheeks, short chin, flattened front) and gives each feature a position on the head's own surface, with the paint applied to a clone of the head mesh so it cannot look pasted on. Honest note: the profile numbers come from the assistant's sense of chibi figures, not from measurement; a better route is to have Hydrogen measure proportions on reference images the user likes.
- Result: the doll's third head is calm where the second was startled. Brown irises as asked, no ring around the eye, cheeks present. Clothes arrived as three modules (tops, bottoms, shoes and socks) after the single module was cut off at the output limit; garments have thickness and a pleated skirt flares. Ball joints under sleeves, trouser legs, socks and boots now take the cloth colour.
- Second character, from Elodie's low-poly reference: `chibi-lowpoly.js`, one Neon call, faceted head and hair, flat painted anime eyes, 10 hair styles, 6 tops, 5 bottoms, glasses and bags, body width and height. It uses the same skeleton names, so the 29-clip motion library drives it unchanged. Our mistake: its blink function takes how closed the eyes are (0 to 1) and we passed time, so the eyes stayed shut; fixed in the caller.
- Boys checked on both characters.
- Still wrong: on both, the lower half of the face is shaded darker than the upper. Long low-poly hair reads as a slab from the side.

## 12:46 · The face: what was really wrong, and who should draw it
- Three generated faces failed in a row. The last one layered a painted shell and two gloss patches over the head; Elodie could see the extra layer under the fringe.
- Decision: the face is written by hand by the assistant (`public/gen3d/face-paint.js`), because the assistant can render, look and adjust within a minute and the generating model cannot see. The face is painted straight into the head's colour map (no overlay): large low-set eyes with a gradient iris and two highlights, an upper lash line only, small brows, a tiny nose, a small mouth, soft blush; five expressions and a blink by repainting.
- The real cause of the "dark lower face", present since the first character and misdiagnosed three times (as paint, as chin shape, as the fringe's shadow): the viewer had only top light, so the underside of any round head reflected the dark floor of the environment map. Found by removing the hair altogether. Fixed with a hemisphere light and a front fill.
- Head form also by hand, then reshaped to chibi head references Elodie supplied (front and side views): wider than tall, fullest at the cheeks just below the eye line, small chin, nearly flat face plane, full forehead, tiny nose. Neck shortened.
- What generation did well and stays: the jointed body, the three clothing modules, the motion library, the clay-style hair (being thickened after Elodie counted the locks).
- Music: Google's Lyria (`lyria-3-clip-preview`) returns a 30-second MP3 in about 15 seconds through the same interactions endpoint. Six tracks saved in `public/music/` with their prompts. Not yet played in the app.

## 13:13 · Foundations after lunch: flywheel back office, write-back, base growth, autonomy, the room as a readout
- Flywheel back office: `/foundry` (page) and `/api/foundry`. Shows who designed the base, the measured comparison, totals, a need-by-school coverage table where an empty cell is marked "gap", and every entity with fields checked, last check, anonymous "carried back" count and a Re-check button. Re-check fetches the source and compares a fingerprint of its text: first visit stores the fingerprint (0 tokens), same fingerprint costs 0 tokens, a changed page has only its stated fields filled and checked again. Checked on one event: "fingerprinted", then "unchanged", both 0 tokens.
- Demand without identity: one integer per entity for how many times any Gemi carried it back, kept in one row per school. Note for the record: Carbon's design said no behavioural trace at all, even anonymised; Elodie asked for the flywheel. This counter stores no person, session or time.
- Write-back: a poster a student shows is read by Hydrogen, checked by Decisions, and if the title passes it enters the shared base at tier 3. Before entering, Decisions judges whether it is an event the base already holds. Checked with the poster of an event already in the base: recognised as the same event at 0.86, so no duplicate was made.
- Base growth (`scripts/foundry/06-harvest.mjs`): 130 records from the universities' own public feeds (NYU Engage clubs and club events, Columbia's Bedework feed). Hydrogen tags growth needs and writes a neutral summary; Decisions checks title, start, place and host against the record. 106 entered, 24 rejected at the title check. The base now holds 166 entities: 94 events, 51 organisations (36 NYU clubs), 20 places, 1 opportunity; 420 of 471 fields passed. Columbia went from 7 events to 36. 82k tokens.
- Failed on the way: the clubs address returned 404 (wrong query string); the Columbia feed repeats recurring events, so ids collided in one insert; both fixed. Only one opportunity was found: these feeds carry events, not openings. Institution structure (schools, departments, programmes) is still empty.
- Admin day runner (`/api/day`): one whole day in one request. Carbon decides how to spend the Gemi's own Gem Stars and says why; it goes out through the same trip code as the room; a simulated student (Hydrogen playing the preset, with hidden tendencies per axis) keeps or skips; Hydrogen writes the diary. Day 1 for the NYU preset: two trips, 2 of 6 guesses right, the diary said its guesses were wrong and what the choices showed, 10k tokens. No page for it yet.
- Autonomy defined as one table (`lib/kernel/autonomy.ts`): nine rows, first match wins (paused, out, waiting with finds, asleep at night, go out on its own stars, write its diary, change its room, rest when out of stars, potter). The room page evaluates it every five seconds and never lets it act while the student is mid-action. It showed in the browser: left alone with an old log, it spent one of its own stars on the diary.
- The room as a readout (`lib/kernel/space.ts`): fourteen facts and the one thing in the room that shows each; ten live. New in the 3D room: paper cards on the desk for finds waiting, cards pinned to the corkboard for kept finds, two jars of glowing Gem Stars (gold for you, lilac for itself), a small trophy per stage. Click the desk, board, shelf or bed and the camera moves in; the matching panel opens.
- Our bug: a React effect was added after an early return, which broke the room page; and the server was restarted once because the dev bundler kept serving a stale module.

## 14:25 · Evaluations, the corrections record, and the deck rebuilt for the track
- **What**: `07-eval.mjs` (70 NYU listings) and `08-eval-pages.mjs` (122 raw pages from six universities, truth from the calendars' own structured fields). `base/runs/improvements.json` records 14 corrections as saw / before / how / after. `/deck` rebuilt: task, layers, baseline, test set, failures, still failing, cost model, why a small budget, mind mathematics, spatial projection, autonomy, scope.
- **Gemini's part**: Argon is the baseline; Hydrogen fills; Decisions gates each field.
- **Checked**: every number on the deck is imported from `lib/proof.json`, written by `scripts/proof-summary.mjs` from the run files. Curves on the mind slide call the same `step()` as the room. Each slide looked at in the browser at 1600×900.
- **Failure**: the first raw-pages run lost to the baseline (9.6% against 8.7%): hidden `display:none` text was read and the gate confirmed it. After reading only visible text: 3.2% against 8.4%; the baseline with the same reader gets 4.3%, so most of the gain is the reader. 12 online-or-not errors remain unexplained.

## 14:45 · Demo path tested; Gemi to Gemi; Chinese deck; cover banner
- **Demo path, by API on inputs nobody prepared**: a mixed Chinese and English note came back verbatim with the need tied to the exact words (7 s); a trip returned 3 finds with no numbers in them and a seal; reveal recomputed the same hash; the poster was recognised as an event already in the base at 0.86 (11 s).
- **Failure found**: a trip took 101 s because Carbon planned at medium thinking. Set to low: 9 to 15 s.
- **Three unattended days** (`/api/day`): each day it planned, went out twice and saved 2 Gem Stars; on day 3 the bank reached 6 and it wrote a song with Lyria. 43 to 54 s a day.
- **Gemi to Gemi** (`lib/server/meet.ts`, `/meet`, run kept in `base/runs/09-meet.json`): Carbon invents three simulated students, one with a pushy Gemi. Each Gemi (Hydrogen) sees only its own side. The Decisions API gates every message for private content and for promises made on the student's behalf, and checks each name card against what was actually sent. Run: 9 messages sent, 0 held, the pushy request was declined, 2 of 3 cards kept; one card was dropped for claiming a shared interest the conversation did not contain (0.36).
- **Before / after**: the card check first judged the suggested next step too, which is never in the transcript, so 0 of 3 cards passed. Now it judges only what the card claims was said.
- **Deck**: Chinese version behind a switch (`/deck?lang=zh`); cover is one picture in four stages: a Gemi, enters a space, its mind gains six capacities, tokens stretch into time.

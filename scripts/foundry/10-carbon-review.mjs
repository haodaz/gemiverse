// Carbon reviews the whole product as it stands and names its top three suggestions. It is given the living design doc, the tool,
// policy and room tables as they are in code, the measured results, and the open question of how things are acquired.
import { readFileSync } from "node:fs";
import { ask, parseJson, writeJson } from "./lib.mjs";
const f = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");
const proof = JSON.parse(f("lib/proof.json")); delete proof.improvements; delete proof.pages.still_wrong; delete proof.pages.by_field;
const prompt = `You are Gemini 4 Carbon. Earlier today you designed the knowledge base, the learner graph and the growth stages of this product. The team now asks you to review the whole thing as it stands at 14:50 on the day of a hackathon (Track "5 Sigma": pick a real task agents struggle with, do it reliably, prove it against a baseline on inputs not prepared for, show failures). You are a member of the team, not a cheerleader: say what is weak.

THE PRODUCT IN ONE PARAGRAPH
Gemiverse: every college student gets a Gemi, an AI projection of themselves living in a 3D room on a campus (NYU, Columbia). Campus facts are a shared, checked base; what the Gemi learns about its student stays in the student's browser. The Gemi has a small daily budget of Gem Stars (real tokens) in two purses (for you / for itself); what the student asks for is free, stars are only for what it decides on its own. It goes out, brings back three finds with every field checked by the Decisions API, seals a guess of which the student will keep, learns on seven axes with uncertainty from keep/skip, writes a diary, can save stars across days for a bigger thing. The founder's principle: a limited budget is the projection of a real day's finite time and attention; "find treasure, do not pile up junk"; the room is a readout where every object stands for one measured thing with a real-world counterpart; the AI and the student both perceive and change the same space.

LIVING DESIGN DOC
${f("DESIGN.md")}

TOOLS (lib/kernel/tools.ts)
${f("lib/kernel/tools.ts")}

AUTONOMY POLICY (lib/kernel/autonomy.ts)
${f("lib/kernel/autonomy.ts")}

ROOM AS READOUT (lib/kernel/space.ts)
${f("lib/kernel/space.ts")}

MEASURED RESULTS
${JSON.stringify(proof)}

ASSETS GENERATED BUT NOT YET IN THE ROOM: 36 animals and mythical creatures, extra furniture, keepsakes, wardrobe parts (hair, tops, bottoms, shoes, colours), six extra spaces (loft, reading room, lab...).

OPEN DESIGN QUESTION FROM THE FOUNDER (answer it as part of your review)
How does a student change the Gemi's clothes and get things for the room? Three candidate mechanisms:
A. Ask: the student tells the Gemi what they want, and the Gemi spends its own Gem Stars to get or make it.
B. Idle collection: the student does nothing; each day they look at what the Gemi chose to bring back or make on its own.
C. Earned: the student does tasks in the real world (went to an event, kept a plan), earns credit, and buys things in a small shop for the Gemi. In the founder's earlier product this let the AI perceive the student's changes to the space; small animals there act as simple companions that know both the AI and the student and strengthen the bond.
Known constraints: no streaks or engagement bait (Fang 2025: more chatbot use went with more loneliness); success is what happens in the real world; nothing may look like a personality test; stars the student asks to be spent are free by current rule.

Return JSON only:
{"top3":[{"title":"short","what":"what to change or add, concretely","why":"the reason, tied to something above","how_to_measure":"how we would know it worked","cost_today":"small | medium | large"}],
 "acquisition":{"recommend":"A | B | C | a named mix","rule":"the mechanism as a rule a programmer could implement in an hour, in at most six sentences","why":"two sentences","what_each_object_stands_for":"how to keep the one-object-one-measured-thing principle","risk":"the main way this goes wrong"},
 "weakest_claim":"the one claim in our story a judge is most likely to break, and what to say instead",
 "one_thing_to_cut":"what to stop doing"}`;
const t = Date.now();
const level = process.argv[2] ?? "medium";
const r = await ask("gemini-4-carbon", prompt, level);
const out = { at: new Date().toISOString(), model: "gemini-4-carbon", thinking: level, seconds: Math.round((Date.now() - t) / 1000), tokens: r.usage?.total_tokens ?? null, prompt_chars: prompt.length, review: parseJson(r.text) };
writeJson(`runs/10-carbon-review.${level}.json`, out);
console.log(JSON.stringify(out, null, 1));

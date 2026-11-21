import type { ToolSpec } from "./types";

// The tool base. Each main need has a tool; nothing outside this list can be called.
export const TOOLS: ToolSpec[] = [
  // think: what is this token best used for?
  { name: "plan_day", mode: "think", does: "Decide how to spend today's stars and say why.", serves: ["self: spend well"],
    reads: ["private", "shared"], writes: ["private"], purse: "for_itself", stars: 2, dailyCap: 2, reversible: true, confirm: "never", minStage: 1,
    model: "gemini-4-carbon", params: {} },
  { name: "seal_prediction", mode: "think", does: "Write down which finds it expects you to keep, before you see them.", serves: ["self: know you"],
    reads: ["private"], writes: ["private"], purse: "for_itself", stars: 0, dailyCap: 10, reversible: false, confirm: "never", minStage: 1,
    model: "gemini-4-carbon", params: { finds: "entity ids" } },
  { name: "write_diary", mode: "think", does: "Write what happened today and what it learned about how you choose.", serves: ["self: know itself"],
    reads: ["private"], writes: ["private"], purse: "for_itself", stars: 1, dailyCap: 1, reversible: true, confirm: "never", minStage: 1,
    model: "gemini-4-carbon", params: {} },

  // act: for you
  { name: "read_base", mode: "act", does: "Look up what the campus base already knows.", serves: ["any need"],
    reads: ["shared"], writes: [], purse: "for_you", stars: 0, dailyCap: 100, reversible: true, confirm: "never", minStage: 1,
    params: { school: "nyu|columbia", need: "need id", kind: "resource kind" } },
  { name: "go_out", mode: "act", does: "Visit a place on campus and read its public pages for something worth bringing back.", serves: ["build_a_skill", "explore_a_field", "find_my_people", "get_experience", "rest_and_recover", "decide_a_direction"],
    reads: ["public_web", "shared"], writes: ["shared", "private"], purse: "for_you", stars: 3, dailyCap: 3, reversible: true, confirm: "never", minStage: 1,
    model: "antigravity-preview-09-2026", params: { place: "library|clubs|commons|career", looking_for: "one sentence" } },
  { name: "check_claim", mode: "act", does: "Check one fact against the page it came from.", serves: ["trust"],
    reads: ["shared", "public_web"], writes: ["shared"], purse: "for_you", stars: 0, dailyCap: 200, reversible: true, confirm: "never", minStage: 1,
    model: "gemini-decision-1", params: { entity: "id", field: "name" } },
  { name: "see_poster", mode: "act", does: "Read a poster or photo you show it.", serves: ["any need"],
    reads: ["private"], writes: ["private"], purse: "for_you", stars: 1, dailyCap: 10, reversible: true, confirm: "never", minStage: 1,
    model: "gemini-4-hydrogen", params: { image: "data url" } },
  { name: "ask_agent", mode: "act", does: "Ask a club's own AI one question, sharing only what you marked public.", serves: ["find_my_people", "get_unstuck"],
    reads: ["shared", "private"], writes: ["pairwise", "private"], purse: "for_you", stars: 1, dailyCap: 5, reversible: false, confirm: "first_time", minStage: 3,
    model: "gemini-4-hydrogen", params: { org: "id", question: "text" } },
  { name: "meet_gemi", mode: "act", does: "Exchange name cards with another Gemi. Each side keeps its own copy.", serves: ["find_my_people"],
    reads: ["private"], writes: ["pairwise"], purse: "for_you", stars: 1, dailyCap: 3, reversible: false, confirm: "always", minStage: 4,
    model: "gemini-4-hydrogen", params: { peer: "id" } },

  // act: for itself
  { name: "arrange_room", mode: "act", does: "Move or turn something in its room.", serves: ["self: its space"],
    reads: ["private"], writes: ["private"], purse: "for_itself", stars: 0, dailyCap: 20, reversible: true, confirm: "never", minStage: 1,
    params: { item: "name", cell: "[x,z]", turns: "0-3" } },
  { name: "decorate_room", mode: "act", does: "Change colours or the style of a piece of furniture.", serves: ["self: its space"],
    reads: ["private"], writes: ["private"], purse: "for_itself", stars: 1, dailyCap: 3, reversible: true, confirm: "never", minStage: 1,
    params: { target: "palette|item", value: "name" } },

  // make: build something new, under the make pipeline
  { name: "make_item", mode: "make", does: "Design a new object for its room. You approve it before it appears.", serves: ["self: its space"],
    reads: ["private"], writes: ["private"], purse: "for_itself", stars: 4, dailyCap: 1, reversible: true, confirm: "always", minStage: 2,
    model: "gemini-4-neon", params: { idea: "one sentence" } },
  { name: "write_song", mode: "make", does: "Write a short song about its week and play it in the room. It has to save for this.", serves: ["self: its space", "self: know itself"],
    reads: ["private"], writes: ["private"], purse: "for_itself", stars: 6, dailyCap: 1, reversible: true, confirm: "never", minStage: 1,
    model: "lyria-3-clip-preview", params: { about: "what happened lately" } },
  { name: "open_space", mode: "make", does: "Open a second space next to its room (a loft, a reading room, a lab). Several days of saving.", serves: ["self: its space"],
    reads: ["private"], writes: ["private"], purse: "for_itself", stars: 12, dailyCap: 1, reversible: true, confirm: "always", minStage: 2,
    params: { space: "loft|readingRoom|lab|backyard|rooftop|greenhouse" } },
];

export const tool = (name: string) => TOOLS.find((t) => t.name === name);

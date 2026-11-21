import type { GemiState } from "./types";

// AUTONOMY: what the Gemi does when nobody is telling it what to do. One table, read top to bottom; the first row that matches wins.
// It is a policy over measured state, not a mood. Every row names the method (tool) it uses and what it costs the Gemi.
export type Situation = { pending: number; outNow: boolean; starsYou: number; starsSelf: number; choices: number; widestHalo: number; topCare: number; hour: number; idleSeconds: number; diaryToday: boolean; paused: boolean; bank: number; goalCost: number; goalName: string | null; roomChangedByStudent: boolean };
export type Decision = { state: "paused" | "out" | "waiting" | "asleep" | "going_out" | "writing" | "tidying" | "resting" | "pottering" | "saving" | "noticing" | "making"; method: string | null; purse: "for_you" | "for_itself" | null; stars: number; why: string; room: string };

export const POLICY: { id: string; when: string; test: (s: Situation) => boolean; then: Omit<Decision, "why"> & { why: string } }[] = [
  { id: "paused", when: "you paused it", test: (s) => s.paused, then: { state: "paused", method: null, purse: null, stars: 0, why: "You paused me. I do nothing until you say so.", room: "stands still" } },
  { id: "out", when: "it is out on campus", test: (s) => s.outNow, then: { state: "out", method: "go_out", purse: null, stars: 0, why: "I am out looking.", room: "the room is empty; the door is ajar" } },
  { id: "waiting", when: "finds are waiting for you on the desk", test: (s) => s.pending > 0, then: { state: "waiting", method: null, purse: null, stars: 0, why: "I brought things back. I will not spend more until you have looked.", room: "stands by the desk and waves; cards lie on the desk" } },
  { id: "asleep", when: "it is night (23:00 to 07:00)", test: (s) => s.hour >= 23 || s.hour < 7, then: { state: "asleep", method: null, purse: null, stars: 0, why: "It is night.", room: "lies down; the lamp is low" } },
  { id: "notice", when: "you changed something in its room", test: (s) => s.roomChangedByStudent, then: { state: "noticing", method: null, purse: null, stars: 0, why: "You changed my room. I am taking a look.", room: "walks over to what moved and looks at it" } },
  { id: "go", when: "it has 3 Gem Stars for you, you have been away a while, and it is unsure about something you care about",
    test: (s) => s.starsYou >= 3 && s.idleSeconds >= 45 && (s.widestHalo >= 0.5 || s.choices < 5), then: { state: "going_out", method: "go_out", purse: "for_you", stars: 3, why: "I still do not know enough about how you choose. I am going out, on my own stars.", room: "walks to the door and leaves" } },
  { id: "diary", when: "something happened today and the diary is not written, and it has a star of its own", test: (s) => s.choices > 0 && !s.diaryToday && s.starsSelf >= 1, then: { state: "writing", method: "write_diary", purse: "for_itself", stars: 1, why: "Today taught me something. I am writing it down.", room: "sits at the desk and writes" } },
  { id: "make", when: "its savings have reached the price of what it was saving for", test: (s) => !!s.goalName && s.bank + s.starsSelf >= s.goalCost, then: { state: "making", method: "write_song", purse: "for_itself", stars: 6, why: "I saved enough. I am making it now.", room: "sits down and makes it; the room plays it" } },
  { id: "save", when: "it is saving for something bigger than one day's stars", test: (s) => !!s.goalName && s.bank + s.starsSelf < s.goalCost && s.idleSeconds >= 60, then: { state: "saving", method: null, purse: null, stars: 0, why: "I am not spending today. I am saving for something bigger.", room: "drops today's stars into the jar; the jar fills over days" } },
  { id: "tidy", when: "it has stars of its own left and nothing else to do", test: (s) => s.starsSelf >= 1 && s.idleSeconds >= 120, then: { state: "tidying", method: "decorate_room", purse: "for_itself", stars: 1, why: "I have a star of my own. I am changing something in my room.", room: "the room changes colour or a piece of furniture changes style" } },
  { id: "rest", when: "no stars left", test: (s) => s.starsYou < 3 && s.starsSelf < 1, then: { state: "resting", method: null, purse: null, stars: 0, why: "I have spent today's stars. I will rest until tomorrow.", room: "sits on the rug" } },
  { id: "potter", when: "otherwise", test: () => true, then: { state: "pottering", method: null, purse: null, stars: 0, why: "Nothing needs me right now.", room: "moves between the desk, the shelf and the window" } },
];
export const decide = (s: Situation): Decision & { rule: string } => { const r = POLICY.find((p) => p.test(s))!; return { ...r.then, rule: r.id }; };


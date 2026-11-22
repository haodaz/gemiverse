import type { SchoolId } from "./schools";

// Two starting Gemis for the demo. A preset is private-side data: it lives in the browser, never in the shared base.
// The look uses the same parameters the student sets when building a Gemi from parts.
export type Look = {
  skin: string; hairStyle: string; hairColor: string; eyes: string; top: string; topColor: string;
  bottom: string; bottomColor: string; shoeColor: string; headwear: string; glasses: string; blush: boolean;
};
// `truth` is used only by the admin simulation: a hidden tendency per axis for a simulated student, so that we can measure whether
// the Gemi's beliefs move toward it. A real student has no such field.
export type Preset = { truth: Record<string, number>; id: string; school: SchoolId; gemiName: string; level: "undergraduate" | "doctoral"; field: string; year: string; look: Look; birthNote: string };

const LOOK: Look = { skin: "#f1cfb4", hairStyle: "bob", hairColor: "#2a2226", eyes: "round", top: "cardigan", topColor: "#b8a2e3", bottom: "pleatedSkirt", bottomColor: "#3d3648", shoeColor: "#ffffff", headwear: "none", glasses: "round", blush: true };
// One starting Gemi for whichever school is chosen. `truth` is only for simulated students in test runs.
import more from "./schools-more.json";
const CN_MORE = (more as { id: string; group: string }[]).filter((m) => m.group === "cn985").map((m) => m.id);
const CN_IDS = ["tsinghua", "pku", "fudan", "sjtu", "zju", "nju", "ustc", "hit", "xjtu"];
const make = (id: string): Preset => { const cn = CN_IDS.includes(id) || CN_MORE.includes(id), k = id.length; return { truth: { pace: k % 2 ? 0.6 : -0.4, scope: k % 3 ? 0.5 : -0.5, arena: 0.4, closeness: 0.6, horizon: -0.2, structure: 0.3, collaboration: k % 2 ? 0.6 : -0.4 }, id: `${id}-student`, school: id, gemiName: cn ? "团子" : "Mochi", level: "undergraduate", field: cn ? "未定专业" : "undecided", year: cn ? "大二学生" : "sophomore", look: LOOK,
  birthNote: cn ? "我大二，还没想好以后做什么。想找一些能动手做东西的人，也想听听不同方向的讲座。人太多的场合我会累。" : "I'm a sophomore and I haven't picked a direction. I want to find people who make things, and hear talks from different fields. Big crowds tire me." }; };
export const PRESETS: Record<SchoolId, Preset> = new Proxy({} as Record<SchoolId, Preset>, { get: (_t, id) => (typeof id === "string" ? make(id) : undefined) });

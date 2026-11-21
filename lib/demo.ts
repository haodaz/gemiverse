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

export const PRESETS: Record<SchoolId, Preset> = {
  nyu: {
    truth: { pace: -0.4, scope: -0.5, arena: 0.6, closeness: 0.7, horizon: -0.2, structure: 0.3, collaboration: -0.5 },
    id: "nyu-phd-education", school: "nyu", gemiName: "Mochi", level: "doctoral", field: "Education", year: "first-year PhD student",
    look: { skin: "#f1cfb4", hairStyle: "bob", hairColor: "#2a2226", eyes: "round", top: "cardigan", topColor: "#b8a2e3",
      bottom: "pleatedSkirt", bottomColor: "#3d3648", shoeColor: "#ffffff", headwear: "none", glasses: "round", blush: true },
    birthNote: "I just started a PhD in education. I want to find people who build things for learners, not only write about them. I get tired at big mixers; small rooms are better. I should also figure out how the library actually works here.",
  },
  columbia: {
    truth: { pace: 0.8, scope: 0.7, arena: -0.4, closeness: 0.6, horizon: 0.3, structure: 0.6, collaboration: 0.7 },
    id: "columbia-undergrad", school: "columbia", gemiName: "Pip", level: "undergraduate", field: "undecided, leaning computer science and music", year: "sophomore",
    look: { skin: "#a86f4c", hairStyle: "curlyMedium", hairColor: "#2a1d18", eyes: "smile", top: "hoodie", topColor: "#8fc1e8",
      bottom: "trousers", bottomColor: "#4a5568", shoeColor: "#f6c453", headwear: "headphones", glasses: "none", blush: true },
    birthNote: "I'm a sophomore and I still haven't picked a major. I like making beats and I like code. I want to try a lot of things fast and see what sticks, and I'd love a crew to make stuff with.",
  },
};

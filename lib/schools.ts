// The two campuses open today. Everything school-specific hangs off this list.
export type SchoolId = "nyu" | "columbia";

export const SCHOOLS: Record<SchoolId, {
  id: SchoolId; name: string; short: string; place: string; accent: string; soft: string;
  view: string; map: string; line: string;
}> = {
  nyu: {
    id: "nyu", name: "New York University", short: "NYU", place: "Greenwich Village",
    accent: "#7c4dce", soft: "#f1eafc", view: "/art/window-nyu.svg", map: "/art/campus3-nyu.svg",
    line: "The arch, the fountain, and a city that never closes.",
  },
  columbia: {
    id: "columbia", name: "Columbia University", short: "Columbia", place: "Morningside Heights",
    accent: "#3d8fd1", soft: "#e6f2fb", view: "/art/window-columbia.svg", map: "/art/campus3-columbia.svg",
    line: "The steps, the lawn, and the dome above them.",
  },
};

const KEY = "gemi.school";
export const loadSchool = (): SchoolId | null => {
  try { const v = localStorage.getItem(KEY); return v === "nyu" || v === "columbia" ? v : null; } catch { return null; }
};
export const saveSchool = (id: SchoolId) => { try { localStorage.setItem(KEY, id); } catch {} };

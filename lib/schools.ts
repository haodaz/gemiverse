// The local edition: the nine C9 universities in China and the US top twenty, plus the two campuses of the hackathon build.
// Everything school-specific hangs off this list. NYU and Columbia read the shared base; all others read local files (base/cn).
import more from "./schools-more.json";
export type SchoolId = string;
export type School = { id: SchoolId; name: string; short: string; place: string; accent: string; soft: string; view: string; map: string; line: string; group: "cn" | "us" | "cn985" | "us50" };
const S = (id: string, name: string, short: string, place: string, accent: string, soft: string, group: "cn" | "us" | "cn985" | "us50", line: string, view = `/art/cn/${id}.jpg`): School => ({ id, name, short, place, accent, soft, view, map: "/art/campus3-nyu.svg", line, group });
export const SCHOOLS: Record<SchoolId, School> = {
  tsinghua: S("tsinghua", "清华大学", "清华", "北京 · 海淀", "#7c4dce", "#f1eafc", "cn", "二校门、大礼堂，和秋天的银杏。"),
  pku: S("pku", "北京大学", "北大", "北京 · 海淀", "#b5432e", "#fbeae6", "cn", "未名湖、博雅塔，一塔湖图。"),
  fudan: S("fudan", "复旦大学", "复旦", "上海 · 杨浦", "#3d8fd1", "#e6f2fb", "cn", "光华楼的双子塔和门前的大草坪。"),
  sjtu: S("sjtu", "上海交通大学", "上交", "上海 · 闵行", "#c0392b", "#fbe9e7", "cn", "红墙老图书馆和成排的梧桐。"),
  zju: S("zju", "浙江大学", "浙大", "杭州 · 紫金港", "#2f7fb8", "#e5f1f9", "cn", "启真湖、石桥，和湖边的钟楼。"),
  nju: S("nju", "南京大学", "南大", "南京 · 鼓楼", "#6a3d9a", "#efe7f7", "cn", "爬满常春藤的北大楼。"),
  ustc: S("ustc", "中国科学技术大学", "中科大", "合肥 · 包河", "#2f6fb0", "#e6eef8", "cn", "眼镜湖边的樱花。"),
  hit: S("hit", "哈尔滨工业大学", "哈工大", "哈尔滨 · 南岗", "#34699a", "#e6eef5", "cn", "主楼的尖顶和冬天的雪。"),
  xjtu: S("xjtu", "西安交通大学", "西交", "西安 · 碑林", "#1f7a6d", "#e3f3f0", "cn", "梧桐道、图书馆和腾飞塔。"),
  princeton: S("princeton", "Princeton University", "Princeton", "Princeton, NJ",  "#7c4dce",  "#7c4dce", "us", ""),
  mit: S("mit", "Massachusetts Institute of Technology", "MIT", "Cambridge, MA", "#b5432e", "#b5432e", "us", ""),
  harvard: S("harvard", "Harvard University", "Harvard", "Cambridge, MA", "#3d8fd1", "#3d8fd1", "us", ""),
  stanford: S("stanford", "Stanford University", "Stanford", "Stanford, CA", "#1f7a6d", "#1f7a6d", "us", ""),
  yale: S("yale", "Yale University", "Yale", "New Haven, CT", "#c0392b", "#c0392b", "us", ""),
  caltech: S("caltech", "California Institute of Technology", "Caltech", "Pasadena, CA", "#2f6fb0", "#2f6fb0", "us", ""),
  duke: S("duke", "Duke University", "Duke", "Durham, NC", "#6a3d9a", "#6a3d9a", "us", ""),
  jhu: S("jhu", "Johns Hopkins University", "Johns Hopkins", "Baltimore, MD", "#34699a", "#34699a", "us", ""),
  northwestern: S("northwestern", "Northwestern University", "Northwestern", "Evanston, IL",  "#7c4dce",  "#7c4dce", "us", ""),
  penn: S("penn", "University of Pennsylvania", "Penn", "Philadelphia, PA", "#b5432e", "#b5432e", "us", ""),
  cornell: S("cornell", "Cornell University", "Cornell", "Ithaca, NY", "#3d8fd1", "#3d8fd1", "us", ""),
  uchicago: S("uchicago", "University of Chicago", "UChicago", "Chicago, IL", "#1f7a6d", "#1f7a6d", "us", ""),
  brown: S("brown", "Brown University", "Brown", "Providence, RI", "#c0392b", "#c0392b", "us", ""),
  dartmouth: S("dartmouth", "Dartmouth College", "Dartmouth", "Hanover, NH", "#2f6fb0", "#2f6fb0", "us", ""),
  ucla: S("ucla", "University of California, Los Angeles", "UCLA", "Los Angeles, CA", "#6a3d9a", "#6a3d9a", "us", ""),
  berkeley: S("berkeley", "University of California, Berkeley", "Berkeley", "Berkeley, CA", "#34699a", "#34699a", "us", ""),
  rice: S("rice", "Rice University", "Rice", "Houston, TX",  "#7c4dce",  "#7c4dce", "us", ""),
  notredame: S("notredame", "University of Notre Dame", "Notre Dame", "Notre Dame, IN", "#b5432e", "#b5432e", "us", ""),
  vanderbilt: S("vanderbilt", "Vanderbilt University", "Vanderbilt", "Nashville, TN", "#3d8fd1", "#3d8fd1", "us", ""),
  nyu: S("nyu", "New York University", "NYU", "New York, NY", "#7c4dce", "#f1eafc", "us", "", "/art/window-nyu.svg"),
  columbia: S("columbia", "Columbia University", "Columbia", "New York, NY", "#3d8fd1", "#e6f2fb", "us", "", "/art/window-columbia.svg"),
};
// The wider set: the other 985 universities in China and US ranks 21 to 50. Their pictures are regional scenes, not real landmarks.
for (const m of more as { id: string; name: string; short: string; place: string; group: "cn985" | "us50"; accent: string }[]) SCHOOLS[m.id] = S(m.id, m.name, m.short, m.place, m.accent, "#f1eef7", m.group, "");
for (const s of Object.values(SCHOOLS)) if (s.group === "us" && s.soft === s.accent) s.soft = "#f1eef7";

const KEY = "gemi.school";
export const loadSchool = (): SchoolId | null => { try { const v = localStorage.getItem(KEY); return v && v in SCHOOLS ? v : null; } catch { return null; } };
export const saveSchool = (id: SchoolId) => { try { localStorage.setItem(KEY, id); } catch {} };

import type { CorePack } from "../engine/core/types";

// The campus Gemi's values, as the app runs them today (lib/mind.ts, app/api/day/route.ts). A test holds the two together.
export const campus: CorePack = {
  id: "campus",
  axes: ["pace", "scope", "arena", "closeness", "horizon", "structure", "collaboration"],
  tiers: { self_reported: { noise: 2.5, floor: 0.55 }, checked: { noise: 1.0, floor: 0.10 }, seen_over_time: { noise: 0.45, floor: 0.10 }, actually_done: { noise: 0.22, floor: 0.10 } },
  surprise: 0.15,
  daily: { for_you: 6, for_itself: 4 },
  saves: "for_itself",
  care: { said: 0.5, max: 1 },
  skipWeight: 0.5,
};

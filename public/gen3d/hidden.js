// Pieces that are generated but not offered. Religious or sacred dress and figures need people from that tradition
// to tell us they are drawn right; until then they are left out rather than shown inaccurately.
export const HIDDEN = new Set(["hijab", "turban", "thunderbird", "HAIR.hijab", "HAIR.turban", "HEADWEAR.turban"]);
export const offered = (names) => names.filter((n) => !HIDDEN.has(n));

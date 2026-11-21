// The doll's head and face, written by hand in code (by the assistant, not generated). Three generated faces came out uncanny
// because the generating model cannot see what it draws; here the shape is driven by explicit profiles taken from chibi head
// references (side view and front view), and the face is painted straight into the head's own colour map.
const TAU = Math.PI * 2;
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = (c) => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };

// PROFILE. One row per height, in units of head height (0 = underside of the jaw, 1 = crown):
// [height, front extent, back extent, half width]. Read off the references:
//  side view: a broad cranium deeper than it is tall; a vertical face plane; below the mouth the chin and jaw step FORWARD as a shelf;
//             the underside is long and nearly flat, rising toward the back; the neck sits under the middle.
//  front view: widest at the cheeks, then a U down to a small chin.
const ROWS = [
  [1.000, 0.02, 0.02, 0.02], [0.985, 0.20, 0.22, 0.20], [0.950, 0.34, 0.38, 0.33], [0.900, 0.44, 0.49, 0.42], [0.820, 0.52, 0.58, 0.50],
  [0.720, 0.565, 0.63, 0.545], [0.600, 0.585, 0.65, 0.565], [0.480, 0.585, 0.64, 0.575], [0.380, 0.575, 0.61, 0.580], [0.300, 0.570, 0.57, 0.575],
  [0.230, 0.575, 0.52, 0.555], [0.170, 0.600, 0.47, 0.515], [0.120, 0.635, 0.42, 0.455], [0.075, 0.650, 0.37, 0.385], [0.040, 0.640, 0.33, 0.310],
  [0.015, 0.600, 0.30, 0.240], [0.000, 0.520, 0.27, 0.180], [-0.006, 0.300, 0.16, 0.110], [-0.010, 0.02, 0.02, 0.02],
];
const lerp = (a, b, t) => a + (b - a) * t;
function rowAt(h) {                                                  // interpolate the profile at any height
  for (let i = 0; i < ROWS.length - 1; i++) { const A = ROWS[i], B = ROWS[i + 1]; if (h <= A[0] && h >= B[0]) { const t = (A[0] - h) / (A[0] - B[0] || 1); return [h, lerp(A[1], B[1], t), lerp(A[2], B[2], t), lerp(A[3], B[3], t)]; } }
  return ROWS[ROWS.length - 1];
}
const SQ = 0.86;                                                     // cross-sections are a little squarer than an ellipse: a flatter face
const pw = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);

export function headGeometry(THREE) {
  const SEG = 96, pos = [], uv = [], idx = [], dense = [];
  for (let i = 0; i < ROWS.length - 1; i++) { const n = i < 6 ? 5 : 4; for (let k = 0; k < n; k++) dense.push(lerp(ROWS[i][0], ROWS[i + 1][0], k / n)); } dense.push(ROWS[ROWS.length - 1][0]);
  dense.forEach((h, r) => { const [, zf, zb, w] = rowAt(h);
    for (let j = 0; j <= SEG; j++) { const u = j / SEG, phi = u * TAU, c = Math.cos(phi - Math.PI / 2), sn = -Math.sin(phi - Math.PI / 2);   // u = 0.25 is the front (+z), matching the paint
      const x = w * pw(sn, SQ), z = c >= 0 ? zf * pw(c, SQ) : zb * pw(c, 1.0);
      const lift = c < 0 ? 0.13 * (-c) * Math.max(0, 1 - h / 0.3) : 0;   // the underside rises toward the back of the skull
      pos.push(x, h + lift, z); uv.push(u, 1 - (dense.length > 1 ? r / (dense.length - 1) : 0)); } });
  for (let r = 0; r < dense.length - 1; r++) for (let j = 0; j < SEG; j++) { const a = r * (SEG + 1) + j, b = a + SEG + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.userData.heights = dense; g.computeVertexNormals(); return g;
}

// Where a point on the FRONT of the face lands in the texture. x is in head heights from the centre line, y is height (0 jaw, 1 crown).
let HEIGHTS = null;
function place(x, y, W, H) {
  const [, , , w] = rowAt(y), s = Math.max(-0.98, Math.min(0.98, x / w)), sn = pw(s, 1 / SQ), ang = Math.asin(Math.max(-1, Math.min(1, sn)));   // angle from straight ahead
  let r = 0; if (HEIGHTS) { for (let i = 0; i < HEIGHTS.length - 1; i++) if (y <= HEIGHTS[i] && y >= HEIGHTS[i + 1]) { r = i + (HEIGHTS[i] - y) / (HEIGHTS[i] - HEIGHTS[i + 1]); break; } }
  const rows = HEIGHTS ? HEIGHTS.length - 1 : 1, i0 = Math.min(rows - 1, Math.floor(r)), dh = HEIGHTS ? Math.abs(HEIGHTS[i0] - HEIGHTS[i0 + 1]) : 1;
  return { px: (0.25 - ang / TAU) * W, py: (r / rows) * H, sx: (W / TAU) / (w * Math.max(0.3, Math.cos(ang)) * H), sy: (1 / rows) / dh };   // sx, sy: texture pixels per head-height pixel
}

function drawEye(g, side, o) {
  const w = 0.075, h = 0.088;                                       // half sizes in head heights: a tall eye
  g.save(); g.scale(-1, 1);                                          // undo the frame's mirror so 'side' means outward
  if (o.closed === "squint") {                                     // > <
    g.strokeStyle = o.line; g.lineWidth = h * 0.16; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath();
    g.moveTo(-side * w * 0.8, -h * 0.5); g.lineTo(side * w * 0.5, 0); g.lineTo(-side * w * 0.8, h * 0.5); g.stroke(); g.restore(); return;
  }
  if (o.closed) {                                                  // a soft closed arc
    g.strokeStyle = o.line; g.lineWidth = h * 0.16; g.lineCap = "round"; g.beginPath();
    if (o.closed === "happy") { g.moveTo(-w, h * 0.15); g.quadraticCurveTo(0, -h * 0.7, w, h * 0.15); } else { g.moveTo(-w, -h * 0.05); g.quadraticCurveTo(0, h * 0.5, w, -h * 0.05); }
    g.stroke(); g.restore(); return;
  }
  // The opening is a tall rounded shape, a little flatter on top (the lid) and rounder below, not a plain ellipse.
  const eye = new Path2D(); eye.moveTo(-w, -h * 0.25); eye.bezierCurveTo(-w, -h * 0.95, -w * 0.5, -h, 0, -h); eye.bezierCurveTo(w * 0.5, -h, w, -h * 0.95, w, -h * 0.25);
  eye.bezierCurveTo(w, h * 0.55, w * 0.62, h, 0, h); eye.bezierCurveTo(-w * 0.62, h, -w, h * 0.55, -w, -h * 0.25); eye.closePath();
  g.save(); g.clip(eye);
  g.fillStyle = "#fffaf5"; g.fillRect(-w, -h, w * 2, h * 2);
  const ix = (o.look?.[0] ?? 0) * w * 0.25, iy = (o.look?.[1] ?? 0) * h * 0.2 + h * 0.06;
  const iris = g.createLinearGradient(0, -h, 0, h); iris.addColorStop(0, shade(o.eye, -0.55)); iris.addColorStop(0.55, o.eye); iris.addColorStop(1, shade(o.eye, 0.45));
  const is = o.irisScale ?? 1; g.fillStyle = iris; g.beginPath(); g.ellipse(ix, iy - h * 0.04, w * 0.80 * is, h * 1.08 * is, 0, 0, TAU); g.fill();
  g.strokeStyle = shade(o.eye, -0.7); g.lineWidth = w * 0.05; g.stroke();
  if (!o.shape) { g.fillStyle = shade(o.eye, -0.75); g.beginPath(); g.ellipse(ix, iy - h * 0.1 * is, w * 0.36 * is, h * 0.44 * is, 0, 0, TAU); g.fill(); }   // pupil
  g.fillStyle = shade(o.eye, 0.6); g.globalAlpha = 0.55; g.beginPath(); g.ellipse(ix, iy + h * 0.55, w * 0.5, h * 0.2, 0, 0, TAU); g.fill(); g.globalAlpha = 1;   // lower glow
  const top = g.createLinearGradient(0, -h, 0, -h * 0.2); top.addColorStop(0, "rgba(40,25,30,0.45)"); top.addColorStop(1, "rgba(40,25,30,0)"); g.fillStyle = top; g.fillRect(-w, -h, w * 2, h);  // lid shadow
  if (o.shape === "star" || o.shape === "heart") {                // a star or a heart in place of the pupil
    g.fillStyle = "#fff"; g.beginPath();
    if (o.shape === "star") for (let k = 0; k < 10; k++) { const r = (k % 2 ? 0.2 : 0.48) * w, a = -Math.PI / 2 + (k * Math.PI) / 5; g.lineTo(ix + Math.cos(a) * r, iy + Math.sin(a) * r * (h / w)); }
    else { const q = w * 0.42; g.moveTo(ix, iy + q * 0.9); g.bezierCurveTo(ix - q * 1.6, iy - q * 0.2, ix - q * 0.7, iy - q * 1.3, ix, iy - q * 0.4); g.bezierCurveTo(ix + q * 0.7, iy - q * 1.3, ix + q * 1.6, iy - q * 0.2, ix, iy + q * 0.9); g.fillStyle = "#ff8fb0"; }
    g.closePath(); g.fill();
  }
  g.fillStyle = "#fff"; g.beginPath(); g.ellipse(ix - w * 0.3, iy - h * 0.46, w * 0.27, h * 0.2, -0.3, 0, TAU); g.fill();    // big highlight, upper left on both eyes
  g.beginPath(); g.ellipse(ix + w * 0.34, iy + h * 0.36, w * 0.11, h * 0.08, 0, 0, TAU); g.fill();                          // small highlight, lower right
  g.restore();
  // Upper lid: not an even arc. Thin at the inner corner, swelling to its heaviest over the outer third, ending in lash points.
  g.strokeStyle = o.line; g.fillStyle = o.line; g.lineCap = "round"; g.lineJoin = "round";
  const lid = (t) => { const xn = -1.04 + 2.08 * t, yy = -h * (0.22 + 0.86 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(xn) / 1.04, 2.6)), 1 / 2.6)); return [side * xn * w, yy]; };   // t: 0 inner corner, 1 outer corner
  const N = 28; for (let i = 0; i < N; i++) { const t0 = i / N, t1 = (i + 1.3) / N, [x0, y0] = lid(t0), [x1, y1] = lid(Math.min(1, t1));
    g.lineWidth = h * (0.035 + 0.17 * Math.pow(t0, 1.5) * (1 - 0.35 * Math.pow(t0, 6))); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  const spike = (t, len, lift) => { const [x, y] = lid(t), [xb, yb] = lid(t - 0.09); g.beginPath(); g.moveTo(xb, yb - h * 0.02); g.lineTo(x + side * w * len, y - h * lift); g.lineTo(x, y + h * 0.1); g.closePath(); g.fill(); };
  spike(0.99, 0.34, 0.22); spike(0.9, 0.26, 0.34); if (o.lashes) spike(0.8, 0.14, 0.3);
  g.globalAlpha = 0.55; g.lineWidth = h * 0.035; g.beginPath(); g.moveTo(-side * w * 0.55, -h * 1.3); g.quadraticCurveTo(side * w * 0.2, -h * 1.42, side * w * 0.95, -h * 1.12); g.stroke(); g.globalAlpha = 1;   // crease above the lid
  g.lineWidth = h * 0.045; g.beginPath(); g.moveTo(-w * 0.32, h * 1.01); g.quadraticCurveTo(0, h * 1.06, w * 0.32, h * 1.01); g.stroke();                                                   // short lower lid mark
  g.beginPath(); g.moveTo(side * w * 0.45, h * 1.0); g.quadraticCurveTo(side * w * 0.9, h * 0.92, side * w * 1.02, h * 0.45); g.lineWidth = h * 0.04; g.globalAlpha = 0.65; g.stroke(); g.globalAlpha = 1;   // faint lower line, outer corner only
  g.restore(); return;
}

export function paintFace(THREE, kit, look, expression = "awake") {
  const W = 2048, H = 1024, line = "#4a332e";
  return kit.canvasTexture(W, H, (g) => {
    g.fillStyle = look.skin; g.fillRect(0, 0, W, H);
    // every feature is drawn in a local frame scaled so that it comes out undistorted on the head
    const at = (x, y, fn) => { const p = place(x, y, W, H); g.save(); g.translate(p.px, p.py); g.scale(-p.sx * H, p.sy * H); fn(); g.restore(); };   // inside fn: units are head heights, +x to the figure's left... mirrored so text-like shapes read correctly
    const soft = (x, y, rx, ry, colour, alpha) => at(x, y, () => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, colour); gr.addColorStop(1, "rgba(255,255,255,0)"); g.globalAlpha = alpha; g.scale(rx, ry); g.fillStyle = gr; g.fillRect(-1, -1, 2, 2); g.globalAlpha = 1; });
    const EY = 0.335, EX = 0.275;                                    // eye centres: low on the head, wide apart; the lower lid ends just above the nose line
    if (look.blush !== false) { soft(-0.37, 0.215, 0.12, 0.065, "#ff8fa3", 0.6); soft(0.37, 0.215, 0.12, 0.065, "#ff8fa3", 0.6); }
    const E = { asleep: { closed: "sleep" }, blink: { closed: "sleep" }, happy: { closed: "happy" }, laugh: { closed: "happy" }, squint: { closed: "squint" }, thinking: { look: [0.9, -1] },
      surprised: { irisScale: 0.62 }, star: { shape: "star" }, heart: { shape: "heart" }, sad: { look: [0, 0.6] }, wink: {} }[expression] ?? {};
    for (const side of [-1, 1]) at(EX * side, EY, () => drawEye(g, side, { eye: look.eye ?? "#6b4a3a", line, lashes: look.lashes, look: [0, 0], ...E, ...(expression === "wink" && side > 0 ? { closed: "happy" } : {}) }));
    if (expression === "sad") at(-EX - 0.01, EY - 0.115, () => { g.fillStyle = "rgba(120,190,255,0.85)"; g.beginPath(); g.ellipse(0, 0, 0.012, 0.02, 0, 0, TAU); g.fill(); });
    // brows
    for (const side of [-1, 1]) at(EX * side, EY + 0.135, () => { const up = ["unsure", "sad"].includes(expression) ? 0.018 : 0, raise = expression === "surprised" ? -0.02 : expression === "thinking" && side > 0 ? -0.02 : 0;
      g.strokeStyle = look.browColor ?? line; g.globalAlpha = 0.8; g.lineCap = "round"; g.lineWidth = 0.009; g.beginPath(); g.moveTo(-side * -0.05, up * 0 + raise + (side * 0 ) - (up ? -up : 0)); 
      g.moveTo(side * -0.05, raise - up); g.quadraticCurveTo(0, raise - 0.016, side * 0.05, raise + 0.004 + up); g.stroke(); g.globalAlpha = 1; });
    soft(0, 0.245, 0.012, 0.009, shade(look.skin, -0.3), 0.55);     // nose: a tiny warm dot
    at(0, 0.165, () => { const mw = 0.022; g.strokeStyle = look.lip ?? "#c9777a"; g.fillStyle = "#b85a66"; g.lineWidth = 0.0065; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath();
      if (expression === "surprised") { g.ellipse(0, 0.004, mw * 0.45, mw * 0.6, 0, 0, TAU); g.fill(); }
      else if (expression === "sad") { g.moveTo(-mw * 0.8, 0.006); g.quadraticCurveTo(0, -0.01, mw * 0.8, 0.006); g.stroke(); }
      else if (["happy", "laugh", "squint", "star", "heart"].includes(expression)) { g.moveTo(-mw, -0.004); g.quadraticCurveTo(0, mw * 1.5, mw, -0.004); g.closePath(); g.fill();
        g.fillStyle = "#ff9fae"; g.beginPath(); g.ellipse(0, mw * 0.42, mw * 0.45, mw * 0.22, 0, 0, TAU); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.moveTo(mw * 0.35, -0.004); g.lineTo(mw * 0.5, mw * 0.16); g.lineTo(mw * 0.65, -0.004); g.closePath(); g.fill(); }
      else if (expression === "unsure") { g.moveTo(-mw, 0); g.bezierCurveTo(-mw * 0.3, -mw * 0.5, mw * 0.3, mw * 0.5, mw, 0); g.stroke(); }
      else if (expression === "thinking") { g.moveTo(-mw * 0.4, 0); g.lineTo(mw * 0.4, 0); g.stroke(); }
      else { g.moveTo(-mw * 0.9, -0.002); g.quadraticCurveTo(-mw * 0.45, mw * 0.55, 0, -0.001); g.quadraticCurveTo(mw * 0.45, mw * 0.55, mw * 0.9, -0.002); g.stroke(); } });
    if (look.freckles) for (let i = 0; i < 12; i++) at(-0.17 + (i % 6) * 0.068, 0.262 - (i > 5 ? 0.022 : 0), () => { g.fillStyle = shade(look.skin, -0.35); g.globalAlpha = 0.6; g.beginPath(); g.arc(0, 0, 0.0035, 0, TAU); g.fill(); g.globalAlpha = 1; });
  });
}

function earMesh(THREE, skin, side) {
  // a cupped ear standing out from the side of the head: a flattened ellipsoid with a darker inner hollow
  const g = new THREE.Group(), outer = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshPhysicalMaterial({ color: skin, roughness: 0.62, sheen: 0.3 }));
  outer.scale.set(0.02, 0.042, 0.03); g.add(outer);
  const inner = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshPhysicalMaterial({ color: new THREE.Color(skin).multiplyScalar(0.84), roughness: 0.7 }));
  inner.scale.set(0.011, 0.026, 0.017); inner.position.set(side * 0.012, -0.003, 0.006); g.add(inner);
  g.rotation.y = side * -0.45; g.rotation.z = side * -0.1; return g;
}

// Replaces the generated head with the hand-made one and paints the face on it. Head height 0.31 m, its underside 0.012 above the head pivot.
export const HEAD_H = 0.31;
export function applyFace(THREE, kit, headGroup, look) {
  headGroup.traverse((o) => { if (o.isMesh) o.visible = false; });   // the whole generated head, ears included, is replaced
  const geo = headGeometry(THREE); HEIGHTS = geo.userData.heights;
  const head = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.62, sheen: 0.3, sheenRoughness: 0.6 }));
  head.scale.setScalar(HEAD_H); head.position.set(0, 0.012, -0.012); head.userData.face = true; headGroup.add(head);
  for (const side of [-1, 1]) { const e = earMesh(THREE, look.skin, side); e.position.set(side * 0.575 * HEAD_H, 0.012 + 0.31 * HEAD_H, -0.012 - 0.06 * HEAD_H); headGroup.add(e); }   // ears: at eye-to-nose height, a little behind the middle
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.031, 0.06, 24), new THREE.MeshPhysicalMaterial({ color: look.skin, roughness: 0.62 })); neck.position.set(0, -0.012, 0.0); headGroup.add(neck);   // the neck sits under the middle of the head, well behind the chin
  const set = (name) => { head.material.map?.dispose?.(); head.material.map = paintFace(THREE, kit, look, name); head.material.needsUpdate = true; };
  let current = "awake", shut = false; set(current);
  return { express(name) { current = name; set(name); }, blink(t) { const now = t % 4.3 < 0.13 && ["awake", "thinking", "unsure", "surprised", "star", "heart", "sad"].includes(current); if (now !== shut) { shut = now; set(now ? "blink" : current); } } };
}

export const EXPRESSIONS = ["awake", "happy", "laugh", "wink", "squint", "surprised", "star", "heart", "sad", "unsure", "thinking", "asleep"];

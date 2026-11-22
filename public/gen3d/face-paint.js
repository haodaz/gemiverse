// The doll's face, painted by hand in code (written by the assistant, not generated): Neon could not see what it drew and three
// attempts came out uncanny. The face is painted straight into the head's own colour map, so there is no overlay to go wrong.
// The head is a deformed sphere that keeps a sphere's UVs: the front of the face is at u = 0.25.
const TAU = Math.PI * 2;
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = (c) => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };

// unit position on the front of the head (x right, y up) -> canvas pixel, plus the horizontal stretch at that latitude
function place(x, y, W, H) {
  const r = Math.sqrt(Math.max(1e-6, 1 - y * y)), xx = Math.max(-r, Math.min(r, x)), phi = Math.atan2(Math.sqrt(Math.max(0, r * r - xx * xx)), -xx);
  return { px: (phi / TAU) * W, py: (Math.acos(y) / Math.PI) * H, sx: 1 / r };
}

function drawEye(g, W, H, cx, cy, side, o) {
  const p = place(cx, cy, W, H), u = H / Math.PI;                 // u: pixels per unit of arc
  const w = (o.soft ? 0.146 : 0.215) * u * p.sx, h = (o.soft ? 0.2 : 0.25) * u;   // half sizes; the soft style (19:10) is smaller: the large one read as an embroidered plush-doll eye
  g.save(); g.translate(p.px, p.py);
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
  g.fillStyle = o.soft && !o.irisScale ? shade(o.eye, -0.5) : "#fffaf5"; g.fillRect(-w, -h, w * 2, h * 2);
  const ix = (o.look?.[0] ?? 0) * w * 0.25, iy = (o.look?.[1] ?? 0) * h * 0.2 + h * 0.06;
  const iris = g.createLinearGradient(0, -h, 0, h); iris.addColorStop(0, shade(o.eye, -0.55)); iris.addColorStop(0.55, o.eye); iris.addColorStop(1, shade(o.eye, 0.45));
  // soft style: the iris fills the opening, so no white shows (a solid dark eye with highlights, as on the reference Gemi)
  const is = (o.irisScale ?? 1) * (o.soft ? 1.3 : 1); g.fillStyle = iris; g.beginPath(); g.ellipse(ix, iy - h * 0.04, w * 0.80 * is, h * 1.08 * is, 0, 0, TAU); g.fill();
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
    g.lineWidth = h * (o.soft ? 0.03 + 0.1 * Math.pow(t0, 1.5) : 0.035 + 0.17 * Math.pow(t0, 1.5) * (1 - 0.35 * Math.pow(t0, 6))); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  const spike = (t, len, lift) => { const [x, y] = lid(t), [xb, yb] = lid(t - 0.09); g.beginPath(); g.moveTo(xb, yb - h * 0.02); g.lineTo(x + side * w * len, y - h * lift); g.lineTo(x, y + h * 0.1); g.closePath(); g.fill(); };
  // 19:00: three lash points read as harsh on the larger head. By default the lid now ends in one small flick (two for looks with lashes); look.softEyes = false restores the points.
  if (o.soft) { spike(0.97, 0.16, 0.2); if (o.lashes) spike(0.86, 0.12, 0.26); } else { spike(0.99, 0.34, 0.22); spike(0.9, 0.26, 0.34); if (o.lashes) spike(0.8, 0.14, 0.3); }
  if (o.soft) { g.restore(); return; }   // no crease, no lower-lid strokes
  g.globalAlpha = 0.55; g.lineWidth = h * 0.035; g.beginPath(); g.moveTo(-side * w * 0.55, -h * 1.3); g.quadraticCurveTo(side * w * 0.2, -h * 1.42, side * w * 0.95, -h * 1.12); g.stroke(); g.globalAlpha = 1;   // crease above the lid
  g.lineWidth = h * 0.045; g.beginPath(); g.moveTo(-w * 0.32, h * 1.01); g.quadraticCurveTo(0, h * 1.06, w * 0.32, h * 1.01); g.stroke();                                                   // short lower lid mark
  g.beginPath(); g.moveTo(side * w * 0.45, h * 1.0); g.quadraticCurveTo(side * w * 0.9, h * 0.92, side * w * 1.02, h * 0.45); g.lineWidth = h * 0.04; g.globalAlpha = 0.65; g.stroke(); g.globalAlpha = 1;   // faint lower line, outer corner only
  g.restore(); return;
}

export function paintFace(THREE, kit, look, expression = "awake") {
  const W = 2048, H = 1024, line = "#4a332e", u = H / Math.PI;
  return kit.canvasTexture(W, H, (g) => {
    g.fillStyle = look.skin; g.fillRect(0, 0, W, H);
    const soft = (x, y, rx, ry, colour, alpha) => { const p = place(x, y, W, H), R = Math.max(rx * u * p.sx, ry * u); const gr = g.createRadialGradient(p.px, p.py, 0, p.px, p.py, R);
      gr.addColorStop(0, colour); gr.addColorStop(1, "rgba(255,255,255,0)"); g.save(); g.globalAlpha = alpha; g.translate(p.px, p.py); g.scale((rx * p.sx) / Math.max(rx * p.sx, ry), ry / Math.max(rx * p.sx, ry)); g.translate(-p.px, -p.py);
      g.fillStyle = gr; g.fillRect(p.px - R, p.py - R, R * 2, R * 2); g.restore(); };
    if (look.blush !== false) { soft(-0.52, -0.52, 0.19, 0.11, "#ff8fa3", 0.6); soft(0.52, -0.52, 0.19, 0.11, "#ff8fa3", 0.6); }
    const softF = look.softEyes ?? true, EY = softF ? -0.25 : -0.2, EX = softF ? 0.37 : 0.45;   // soft style: eyes a little lower and closer   // the lower lid sits just above the nose line (Elodie), as on figure faceplates
    const E = { asleep: { closed: "sleep" }, blink: { closed: "sleep" }, happy: { closed: "happy" }, laugh: { closed: "happy" }, squint: { closed: "squint" }, thinking: { look: [0.9, -1] },
      surprised: { irisScale: 0.62 }, star: { shape: "star" }, heart: { shape: "heart" }, sad: { look: [0, 0.6] }, wink: {} }[expression] ?? {};
    for (const side of [-1, 1]) drawEye(g, W, H, EX * side, EY, side, { eye: look.eye ?? "#6b4a3a", line, lashes: look.lashes, soft: look.softEyes ?? true, look: [0, 0], ...E, ...(expression === "wink" && side > 0 ? { closed: "happy" } : {}) });
    if (expression === "sad") { const tp = place(-EX - 0.02, EY - 0.3, W, H); g.fillStyle = "rgba(120,190,255,0.85)"; g.beginPath(); g.ellipse(tp.px, tp.py, u * 0.025 * tp.sx, u * 0.04, 0, 0, TAU); g.fill(); }
    // brows
    g.strokeStyle = look.browColor ?? line; g.globalAlpha = softF ? 0.55 : 0.8; g.lineCap = "round"; g.lineWidth = u * (softF ? 0.017 : 0.022);
    for (const side of [-1, 1]) { const a = place(side * (EX - 0.13), EY + 0.36 + (["unsure", "sad"].includes(expression) ? 0.05 : expression === "surprised" ? 0.06 : 0), W, H), b = place(side * (EX + 0.13), EY + 0.34 - (["unsure", "sad"].includes(expression) ? 0.04 : 0) + (expression === "surprised" ? 0.06 : 0) + (expression === "thinking" && side > 0 ? 0.05 : 0), W, H), m = place(side * EX, EY + 0.385, W, H);
      g.beginPath(); g.moveTo(a.px, a.py); g.quadraticCurveTo(m.px, m.py, b.px, b.py); g.stroke(); }
    g.globalAlpha = 1;
    // nose: a tiny warm dot
    soft(0, -0.44, 0.02, 0.014, shade(look.skin, -0.28), 0.5);
    // mouth
    const mp = place(0, -0.645, W, H), mw = 0.055 * u; g.strokeStyle = look.lip ?? "#c9777a"; g.lineWidth = u * 0.018; g.lineCap = "round"; g.beginPath();
    if (expression === "surprised") { g.fillStyle = "#b85a66"; g.ellipse(mp.px, mp.py + mw * 0.2, mw * 0.4, mw * 0.55, 0, 0, TAU); g.fill(); }
    else if (expression === "sad") { g.moveTo(mp.px - mw * 0.8, mp.py + mw * 0.3); g.quadraticCurveTo(mp.px, mp.py - mw * 0.5, mp.px + mw * 0.8, mp.py + mw * 0.3); g.stroke(); }
    else if (["happy", "laugh", "squint", "star", "heart"].includes(expression)) { g.fillStyle = "#b85a66"; g.moveTo(mp.px - mw, mp.py - mw * 0.2); g.quadraticCurveTo(mp.px, mp.py + mw * 1.5, mp.px + mw, mp.py - mw * 0.2); g.closePath(); g.fill();
      g.fillStyle = "#ff9fae"; g.beginPath(); g.ellipse(mp.px, mp.py + mw * 0.42, mw * 0.45, mw * 0.22, 0, 0, TAU); g.fill();
      g.fillStyle = "#fff"; g.beginPath(); g.moveTo(mp.px + mw * 0.35, mp.py - mw * 0.2); g.lineTo(mp.px + mw * 0.5, mp.py + mw * 0.15); g.lineTo(mp.px + mw * 0.65, mp.py - mw * 0.2); g.closePath(); g.fill(); }
    else if (expression === "unsure") { g.moveTo(mp.px - mw, mp.py); g.bezierCurveTo(mp.px - mw * 0.3, mp.py - mw * 0.5, mp.px + mw * 0.3, mp.py + mw * 0.5, mp.px + mw, mp.py); g.stroke(); }
    else if (expression === "thinking") { g.moveTo(mp.px - mw * 0.4, mp.py); g.lineTo(mp.px + mw * 0.4, mp.py); g.stroke(); }
    else if (expression === "awake" || expression === "blink" || expression === "wink") { g.lineWidth = u * 0.015; g.moveTo(mp.px - mw * 0.9, mp.py - mw * 0.1); g.quadraticCurveTo(mp.px - mw * 0.45, mp.py + mw * 0.55, mp.px, mp.py - mw * 0.05); g.quadraticCurveTo(mp.px + mw * 0.45, mp.py + mw * 0.55, mp.px + mw * 0.9, mp.py - mw * 0.1); g.stroke(); }
    else { g.moveTo(mp.px - mw, mp.py - mw * 0.25); g.quadraticCurveTo(mp.px, mp.py + mw * 0.6, mp.px + mw, mp.py - mw * 0.25); g.stroke(); }
    if (look.freckles) { g.fillStyle = shade(look.skin, -0.35); g.globalAlpha = 0.6; for (let i = 0; i < 14; i++) { const p = place(-0.3 + (i % 7) * 0.1 + (i > 6 ? 0.03 : 0), -0.43 - (i > 6 ? 0.05 : 0) + ((i * 37) % 5) * 0.006, W, H); g.beginPath(); g.arc(p.px, p.py, u * 0.006, 0, TAU); g.fill(); } g.globalAlpha = 1; }
  });
}

// The head form, also by hand: a sphere whose lower third narrows gently to a small soft chin. The taper is mild and even,
// so the lower face keeps facing forward and takes light; a hard forward chin made every earlier face go dark below the eyes.
export function headGeometry(THREE) {
  // Profile taken from chibi head references (front and side views): wide head, widest at the cheeks just below the eye line,
  // a small rounded chin, an almost vertical face plane with a full forehead, a tiny nose, a big round back of the skull.
  const g = new THREE.SphereGeometry(1, 128, 96), p = g.attributes.position;
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }, bump = (d, r) => Math.exp(-(d * d) / (r * r));
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const front = Math.max(0, z), t = ss(-0.28, -1, y);   // 19:10: the taper starts higher and goes further; the face was a flat pillow
    let wx = 1 + 0.035 * bump(y + 0.32, 0.38);                      // cheeks: the widest point
    wx *= 1 - 0.36 * Math.pow(t, 1.45);                              // a jaw that stays wide, then rounds into the chin
    let wz = 1 - 0.12 * Math.pow(t, 1.5);
    x *= wx;
    if (z > 0) { z *= wz * (1 - 0.03 * bump(y + 0.25, 0.55));      // a rounded face plane
      z += 0.05 * front * bump(y - 0.45, 0.4);                      // full forehead
      z += 0.05 * bump(Math.hypot(x, y + 0.41), 0.085) * front;     // tiny nose, a little higher (Elodie)
      z += 0.02 * bump(Math.hypot(x, y + 0.66), 0.13) * front;      // mouth mound
      z += 0.06 * front * bump(Math.hypot(Math.abs(x) - 0.42, y + 0.48), 0.26);  // cheek fullness
    } else z *= 1 + 0.06 * bump(y - 0.05, 0.6);                    // big round back of the skull
    // A chin is a shape of its own: the underside of the jaw is nearly flat and the chin sits forward of the neck.
    // (Before this, the face funnelled from the nose straight into the neck.)
    if (z > 0) z += 0.07 * front * bump(Math.hypot(x * 0.8, y + 0.86), 0.2);                  // chin point, forward
    if (y < -0.78) y = -0.78 - (-(y) - 0.78) * 0.6;                                            // flatten the underside of the jaw
    if (y < 0) y *= 0.95;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals(); return g;
}

// Replaces the generated head with the hand-made one (keeping generated ears), and paints the face on it.
export function applyFace(THREE, kit, headGroup, look) {
  let old = null, most = 0;
  headGroup.traverse((o) => { if (o.isMesh) { const n = o.geometry.attributes.position.count; if (n > most && !o.material.transparent) { most = n; old = o; } } });
  if (!old) return null;
  headGroup.traverse((o) => { if (o.isMesh && (o === old || o.material.transparent || o.material.map)) o.visible = false; });
  const head = new THREE.Mesh(headGeometry(THREE), new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.62, sheen: 0.3, sheenRoughness: 0.6 }));
  head.scale.set(0.184, 0.178, 0.170); head.position.set(0, 0.165, 0); head.userData.face = true; headGroup.add(head);
  headGroup.traverse((o) => { if (o.isMesh && o.visible && o !== head) { o.material = o.material.clone(); o.material.color = new THREE.Color(look.skin); o.material.map = null; } });   // ears and neck in the same skin
  const set = (name) => { head.material.map?.dispose?.(); head.material.map = paintFace(THREE, kit, look, name); head.material.needsUpdate = true; };
  let current = "awake", shut = false; set(current);
  return { express(name) { current = name; set(name); }, blink(t) { const now = t % 4.3 < 0.13 && ["awake", "thinking", "unsure", "surprised", "star", "heart", "sad"].includes(current); if (now !== shut) { shut = now; set(now ? "blink" : current); } } };
}

export const EXPRESSIONS = ["awake", "happy", "laugh", "wink", "squint", "surprised", "star", "heart", "sad", "unsure", "thinking", "asleep"];

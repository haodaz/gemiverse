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
  const w = 0.20 * u * p.sx, h = 0.25 * u;                        // half sizes
  g.save(); g.translate(p.px, p.py);
  if (o.closed) {                                                  // a soft closed arc
    g.strokeStyle = o.line; g.lineWidth = h * 0.16; g.lineCap = "round"; g.beginPath();
    if (o.closed === "happy") { g.moveTo(-w, h * 0.15); g.quadraticCurveTo(0, -h * 0.7, w, h * 0.15); } else { g.moveTo(-w, -h * 0.05); g.quadraticCurveTo(0, h * 0.5, w, -h * 0.05); }
    g.stroke(); g.restore(); return;
  }
  const eye = new Path2D(); eye.ellipse(0, 0, w, h, 0, 0, TAU);
  g.save(); g.clip(eye);
  g.fillStyle = "#fffaf5"; g.fillRect(-w, -h, w * 2, h * 2);
  const ix = (o.look?.[0] ?? 0) * w * 0.25, iy = (o.look?.[1] ?? 0) * h * 0.2 + h * 0.06;
  const iris = g.createLinearGradient(0, -h, 0, h); iris.addColorStop(0, shade(o.eye, -0.55)); iris.addColorStop(0.55, o.eye); iris.addColorStop(1, shade(o.eye, 0.45));
  g.fillStyle = iris; g.beginPath(); g.ellipse(ix, iy, w * 0.86, h * 0.9, 0, 0, TAU); g.fill();
  g.fillStyle = shade(o.eye, -0.75); g.beginPath(); g.ellipse(ix, iy - h * 0.12, w * 0.4, h * 0.42, 0, 0, TAU); g.fill();              // pupil
  g.fillStyle = shade(o.eye, 0.6); g.globalAlpha = 0.55; g.beginPath(); g.ellipse(ix, iy + h * 0.55, w * 0.5, h * 0.2, 0, 0, TAU); g.fill(); g.globalAlpha = 1;   // lower glow
  const top = g.createLinearGradient(0, -h, 0, -h * 0.2); top.addColorStop(0, "rgba(40,25,30,0.45)"); top.addColorStop(1, "rgba(40,25,30,0)"); g.fillStyle = top; g.fillRect(-w, -h, w * 2, h);  // lid shadow
  g.fillStyle = "#fff"; g.beginPath(); g.ellipse(ix - w * 0.34 * side * -1, iy - h * 0.42, w * 0.24, h * 0.2, 0, 0, TAU); g.fill();    // big highlight
  g.beginPath(); g.ellipse(ix + w * 0.3 * side * -1, iy + h * 0.3, w * 0.1, h * 0.085, 0, 0, TAU); g.fill();                          // small highlight
  g.restore();
  // upper lash line, thicker toward the outer corner, with a small flick
  g.strokeStyle = o.line; g.lineCap = "round"; g.lineJoin = "round";
  for (let i = 0; i < 14; i++) { const a0 = Math.PI + (i / 14) * Math.PI, a1 = Math.PI + ((i + 1.2) / 14) * Math.PI, t = side > 0 ? i / 14 : 1 - i / 14;
    g.lineWidth = h * (0.07 + 0.11 * t); g.beginPath(); g.ellipse(0, h * 0.04, w * 1.04, h * 1.04, 0, a0, a1); g.stroke(); }
  g.lineWidth = h * 0.09; g.beginPath(); g.moveTo(side * w * 1.02, -h * 0.02); g.lineTo(side * w * 1.3, -h * 0.3); g.stroke();
  if (o.lashes) { g.lineWidth = h * 0.06; for (const k of [0.55, 0.85]) { g.beginPath(); g.moveTo(side * w * k, -h * 0.9 * Math.sqrt(1 - k * k * 0.9)); g.lineTo(side * w * (k + 0.2), -h * (1.15 - k * 0.35)); g.stroke(); } }
  g.restore();
}

export function paintFace(THREE, kit, look, expression = "awake") {
  const W = 2048, H = 1024, line = "#4a332e", u = H / Math.PI;
  return kit.canvasTexture(W, H, (g) => {
    g.fillStyle = look.skin; g.fillRect(0, 0, W, H);
    const soft = (x, y, rx, ry, colour, alpha) => { const p = place(x, y, W, H), R = Math.max(rx * u * p.sx, ry * u); const gr = g.createRadialGradient(p.px, p.py, 0, p.px, p.py, R);
      gr.addColorStop(0, colour); gr.addColorStop(1, "rgba(255,255,255,0)"); g.save(); g.globalAlpha = alpha; g.translate(p.px, p.py); g.scale((rx * p.sx) / Math.max(rx * p.sx, ry), ry / Math.max(rx * p.sx, ry)); g.translate(-p.px, -p.py);
      g.fillStyle = gr; g.fillRect(p.px - R, p.py - R, R * 2, R * 2); g.restore(); };
    if (look.blush !== false) { soft(-0.5, -0.5, 0.2, 0.13, "#ff8fa3", 0.55); soft(0.5, -0.5, 0.2, 0.13, "#ff8fa3", 0.55); }
    const EY = -0.3, EX = 0.38;
    const closed = expression === "asleep" ? "sleep" : expression === "happy" ? "happy" : expression === "blink" ? "sleep" : null;
    const lookDir = expression === "thinking" ? [0.9, -1] : [0, 0];
    for (const side of [-1, 1]) drawEye(g, W, H, EX * side, EY, side, { eye: look.eye ?? "#6b4a3a", line, lashes: look.lashes, closed, look: lookDir });
    // brows
    g.strokeStyle = look.browColor ?? line; g.globalAlpha = 0.8; g.lineCap = "round"; g.lineWidth = u * 0.022;
    for (const side of [-1, 1]) { const a = place(side * (EX - 0.13), EY + 0.36 + (expression === "unsure" ? 0.04 : 0), W, H), b = place(side * (EX + 0.13), EY + 0.34 - (expression === "unsure" ? 0.03 : 0) + (expression === "thinking" && side > 0 ? 0.05 : 0), W, H), m = place(side * EX, EY + 0.385, W, H);
      g.beginPath(); g.moveTo(a.px, a.py); g.quadraticCurveTo(m.px, m.py, b.px, b.py); g.stroke(); }
    g.globalAlpha = 1;
    // nose: a tiny warm dot
    soft(0, -0.47, 0.022, 0.016, shade(look.skin, -0.3), 0.6);
    // mouth
    const mp = place(0, -0.63, W, H), mw = 0.06 * u; g.strokeStyle = look.lip ?? "#c9777a"; g.lineWidth = u * 0.018; g.lineCap = "round"; g.beginPath();
    if (expression === "happy") { g.fillStyle = "#b85a66"; g.moveTo(mp.px - mw, mp.py - mw * 0.2); g.quadraticCurveTo(mp.px, mp.py + mw * 1.3, mp.px + mw, mp.py - mw * 0.2); g.closePath(); g.fill(); }
    else if (expression === "unsure") { g.moveTo(mp.px - mw, mp.py); g.bezierCurveTo(mp.px - mw * 0.3, mp.py - mw * 0.5, mp.px + mw * 0.3, mp.py + mw * 0.5, mp.px + mw, mp.py); g.stroke(); }
    else if (expression === "thinking") { g.moveTo(mp.px - mw * 0.4, mp.py); g.lineTo(mp.px + mw * 0.4, mp.py); g.stroke(); }
    else { g.moveTo(mp.px - mw, mp.py - mw * 0.25); g.quadraticCurveTo(mp.px, mp.py + mw * 0.6, mp.px + mw, mp.py - mw * 0.25); g.stroke(); }
    if (look.freckles) { g.fillStyle = shade(look.skin, -0.35); g.globalAlpha = 0.6; for (let i = 0; i < 14; i++) { const p = place(-0.3 + (i % 7) * 0.1 + (i > 6 ? 0.03 : 0), -0.43 - (i > 6 ? 0.05 : 0) + ((i * 37) % 5) * 0.006, W, H); g.beginPath(); g.arc(p.px, p.py, u * 0.006, 0, TAU); g.fill(); } g.globalAlpha = 1; }
  });
}

// The head form, also by hand: a sphere whose lower third narrows gently to a small soft chin. The taper is mild and even,
// so the lower face keeps facing forward and takes light; a hard forward chin made every earlier face go dark below the eyes.
export function headGeometry(THREE) {
  const g = new THREE.SphereGeometry(1, 96, 72), p = g.attributes.position, ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = ss(-0.15, -1, y), k = 1 - 0.30 * t * t;            // narrow toward the chin
    x *= k * (1 + 0.05 * ss(0.2, -0.45, y) * ss(-1, -0.45, y));   // a little fullness at the cheeks
    z *= z > 0 ? (1 - 0.06 * ss(-0.9, 0.2, y)) * (1 - 0.12 * t * t) : k;
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
  head.scale.set(0.18, 0.17, 0.165); head.position.set(0, 0.165, 0); head.userData.face = true; headGroup.add(head);
  headGroup.traverse((o) => { if (o.isMesh && o.visible && o !== head) { o.material = o.material.clone(); o.material.color = new THREE.Color(look.skin); o.material.map = null; } });   // ears and neck in the same skin
  const set = (name) => { head.material.map?.dispose?.(); head.material.map = paintFace(THREE, kit, look, name); head.material.needsUpdate = true; };
  let current = "awake", shut = false; set(current);
  return { express(name) { current = name; set(name); }, blink(t) { const now = t % 4.3 < 0.13 && current === "awake"; if (now !== shut) { shut = now; set(now ? "blink" : current); } } };
}

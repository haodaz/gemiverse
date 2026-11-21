export const HEAD = { centerY: 0.165, radii: [0.18, 0.17, 0.165] };

const TAU = Math.PI * 2;
const EYE_X = 0.43;
const EYE_Y = -0.30;
const BROW_Y = EYE_Y + 0.30;
const NOSE_Y = -0.33;
const MOUTH_Y = -0.62;
const BLUSH_X = 0.55;
const BLUSH_Y = -0.50;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function deformUnit(ux, uy, uz) {
  let x = ux;
  const y = uy;
  let z = uz;

  if (uy < -0.25) {
    const t = clamp((-0.25 - uy) / 0.75, 0, 1);
    const t2 = t * t;
    const t3 = t2 * t;
    const front = smoothstep(-0.35, 0.45, uz);
    const wFront = 1.0 - 0.64 * t2 + 0.04 * t3;
    const wBack = 1.0 - 0.34 * t2;
    const wFactor = wBack + (wFront - wBack) * front;

    const dFront = 1.0 - 0.42 * t2;
    const dBack = 1.0 - 0.12 * t2;
    const dFactor = dBack + (dFront - dBack) * front;

    x *= wFactor;
    z = z * dFactor + 0.10 * t2;
  }

  const maskZ = smoothstep(0.25, 0.72, uz);
  const maskY = smoothstep(-0.82, -0.52, uy) * smoothstep(0.18, -0.08, uy);
  z *= 1.0 - 0.08 * maskZ * maskY;

  const ax = Math.abs(ux);
  const cdx = (ax - 0.50) / 0.24;
  const cdy = (uy + 0.45) / 0.18;
  const cheek = Math.exp(-(cdx * cdx + cdy * cdy)) * smoothstep(0.15, 0.65, uz);
  x += ux * 0.05 * cheek;
  z += 0.024 * cheek;

  const ndx = ux / 0.075;
  const ndy = (uy - NOSE_Y) / 0.055;
  const nose = 0.022 * Math.exp(-(ndx * ndx + ndy * ndy)) * smoothstep(0.4, 0.8, uz);
  z += nose;

  return [x, y, z];
}

function evalAtAngles(phi, theta) {
  const sinT = Math.sin(theta);
  const ux = -Math.cos(phi) * sinT;
  const uy = Math.cos(theta);
  const uz = Math.sin(phi) * sinT;
  return deformUnit(ux, uy, uz);
}

function solvePhi(fx, theta) {
  const sinT = Math.sin(theta);
  if (sinT < 1e-4) return Math.PI * 0.5;
  let lo = 0.02;
  let hi = Math.PI - 0.02;
  for (let i = 0; i < 16; i++) {
    const mid = 0.5 * (lo + hi);
    const p = evalAtAngles(mid, theta);
    if (p[0] < fx) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

function toCanvas(fx, fy, w, h) {
  const theta = Math.acos(clamp(fy, -0.999, 0.999));
  const phi = solvePhi(fx, theta);
  return [(phi / TAU) * w, (theta / Math.PI) * h];
}

function localScales(fx, fy, w, h) {
  const eps = 0.01;
  const pL = toCanvas(fx - eps, fy, w, h);
  const pR = toCanvas(fx + eps, fy, w, h);
  const pU = toCanvas(fx, fy + eps, w, h);
  const pD = toCanvas(fx, fy - eps, w, h);
  return {
    sx: Math.abs(pR[0] - pL[0]) / (2 * eps),
    sy: Math.abs(pD[1] - pU[1]) / (2 * eps),
  };
}

function weldSphereNormals(geo, wSegs, hSegs) {
  geo.computeVertexNormals();
  const n = geo.attributes.normal;
  const stride = wSegs + 1;

  for (const row of [0, hSegs]) {
    let nx = 0, ny = 0, nz = 0;
    const base = row * stride;
    for (let i = 0; i <= wSegs; i++) {
      nx += n.getX(base + i);
      ny += n.getY(base + i);
      nz += n.getZ(base + i);
    }
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    for (let i = 0; i <= wSegs; i++) n.setXYZ(base + i, nx, ny, nz);
  }

  for (let iy = 1; iy < hSegs; iy++) {
    const a = iy * stride;
    const b = a + wSegs;
    let nx = n.getX(a) + n.getX(b);
    let ny = n.getY(a) + n.getY(b);
    let nz = n.getZ(a) + n.getZ(b);
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    n.setXYZ(a, nx, ny, nz);
    n.setXYZ(b, nx, ny, nz);
  }
  n.needsUpdate = true;
}

function buildHeadGeometry(THREE) {
  const wSegs = 96;
  const hSegs = 72;
  const geo = new THREE.SphereGeometry(1, wSegs, hSegs);
  const pos = geo.attributes.position;
  const [rx, ry, rz] = HEAD.radii;

  for (let i = 0; i < pos.count; i++) {
    const [dx, dy, dz] = deformUnit(pos.getX(i), pos.getY(i), pos.getZ(i));
    pos.setXYZ(i, dx * rx, dy * ry, dz * rz);
  }
  pos.needsUpdate = true;
  weldSphereNormals(geo, wSegs, hSegs);
  return geo;
}

function buildEarGeometry(THREE, side) {
  const wSegs = 32;
  const hSegs = 24;
  const geo = new THREE.SphereGeometry(1, wSegs, hSegs);
  const pos = geo.attributes.position;
  const earH = 0.16 * (HEAD.radii[1] * 2);
  const sx = earH * 0.58;
  const sy = earH * 0.50;
  const sz = earH * 0.22;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const hx = (x - 0.12 * side) / 0.58;
    const hy = (y + 0.04) / 0.56;
    const hollow = Math.exp(-(hx * hx + hy * hy)) * smoothstep(0.05, 0.75, z);
    z -= 0.62 * hollow;

    const inner = smoothstep(0.1, -0.85, x * side);
    z *= 1.0 + 0.22 * inner;
    y *= 1.0 - 0.10 * smoothstep(0.2, 1.0, x * side);

    pos.setXYZ(i, x * sx, y * sy, z * sz);
  }
  pos.needsUpdate = true;
  weldSphereNormals(geo, wSegs, hSegs);
  return geo;
}

function buildEyeGlossGeometry(THREE, side) {
  const rings = 8;
  const segs = 32;
  const ex = side * EYE_X;
  const ey = EYE_Y;
  const radX = 0.205;
  const radY = 0.225;
  const scale = 1.006;
  const [rx, ry, rz] = HEAD.radii;

  const verts = [];
  const norms = [];
  const indices = [];

  function samplePoint(fx, fy) {
    const theta = Math.acos(clamp(fy, -0.999, 0.999));
    const phi = solvePhi(fx, theta);
    const p = evalAtAngles(phi, theta);
    const d = 0.002;
    const pPhi = evalAtAngles(phi + d, theta);
    const pTh = evalAtAngles(phi, theta + d);
    const tx = (pPhi[0] - p[0]) * rx;
    const ty = (pPhi[1] - p[1]) * ry;
    const tz = (pPhi[2] - p[2]) * rz;
    const bx = (pTh[0] - p[0]) * rx;
    const by = (pTh[1] - p[1]) * ry;
    const bz = (pTh[2] - p[2]) * rz;
    let nx = by * tz - bz * ty;
    let ny = bz * tx - bx * tz;
    let nz = bx * ty - by * tx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    verts.push(p[0] * rx * scale, p[1] * ry * scale, p[2] * rz * scale);
    norms.push(nx, ny, nz);
  }

  samplePoint(ex, ey);
  for (let r = 1; r <= rings; r++) {
    const fr = r / rings;
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * TAU;
      samplePoint(ex + radX * fr * Math.cos(a), ey + radY * fr * Math.sin(a));
    }
  }

  for (let s = 0; s < segs; s++) {
    const next = (s + 1) % segs;
    indices.push(0, 1 + s, 1 + next);
  }
  for (let r = 1; r < rings; r++) {
    const row0 = 1 + (r - 1) * segs;
    const row1 = 1 + r * segs;
    for (let s = 0; s < segs; s++) {
      const next = (s + 1) % segs;
      indices.push(row0 + s, row1 + s, row1 + next);
      indices.push(row0 + s, row1 + next, row0 + next);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(norms, 3));
  geo.setIndex(indices);
  return geo;
}

function colorToRgb(THREE, col) {
  const c = new THREE.Color(col);
  const hex = c.getHex();
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = 0.5 * (max + min);
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  h = ((h % 1) + 1) % 1;
  s = clamp(s, 0, 1);
  l = clamp(l, 0, 1);
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(hue(h + 1 / 3) * 255),
    Math.round(hue(h) * 255),
    Math.round(hue(h - 1 / 3) * 255),
  ];
}

function rgba(rgb, a = 1) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

function mixRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function cubicAt(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const tt = t * t, uu = u * u;
  const uuu = uu * u, ttt = tt * t;
  return [
    uuu * p0[0] + 3 * uu * t * p1[0] + 3 * u * tt * p2[0] + ttt * p3[0],
    uuu * p0[1] + 3 * uu * t * p1[1] + 3 * u * tt * p2[1] + ttt * p3[1],
  ];
}

function tracePoly(ctx, pts, close = true) {
  if (!pts.length) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}

function projectPoints(pts, w, h) {
  const out = new Array(pts.length);
  for (let i = 0; i < pts.length; i++) out[i] = toCanvas(pts[i][0], pts[i][1], w, h);
  return out;
}

function ellipsePts(cx, cy, rx, ry, steps = 48) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TAU;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return pts;
}

function eyeShapeParams(shape) {
  if (shape === "almond") return { hw: 0.205, hh: 0.195, outerLift: 0.025, arch: -0.04, low: 0.88 };
  if (shape === "droopy") return { hw: 0.200, hh: 0.215, outerLift: -0.042, arch: -0.08, low: 0.96 };
  if (shape === "upturned") return { hw: 0.200, hh: 0.205, outerLift: 0.052, arch: 0.05, low: 0.90 };
  return { hw: 0.200, hh: 0.230, outerLift: 0.012, arch: 0.0, low: 0.96 };
}

function drawBlush(ctx, w, h, intense) {
  const alpha = intense ? 0.34 : 0.28;
  for (const side of [-1, 1]) {
    const bx = side * BLUSH_X;
    const by = BLUSH_Y;
    const [cx, cy] = toCanvas(bx, by, w, h);
    const { sx, sy } = localScales(bx, by, w, h);
    const r = 0.20 * sy;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx / sy, 1);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0.0, `rgba(242,146,152,${alpha})`);
    grad.addColorStop(0.55, `rgba(244,154,158,${alpha * 0.45})`);
    grad.addColorStop(1.0, "rgba(244,154,158,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function drawFreckles(ctx, w, h) {
  const dots = [
    [-0.56, -0.44, 0.008], [-0.49, -0.47, 0.007], [-0.43, -0.43, 0.006],
    [-0.36, -0.46, 0.007], [-0.29, -0.42, 0.006], [-0.52, -0.50, 0.006],
    [-0.09, -0.39, 0.005], [0.08, -0.40, 0.005], [0.01, -0.37, 0.005],
    [0.55, -0.45, 0.008], [0.48, -0.48, 0.007], [0.42, -0.42, 0.006],
    [0.35, -0.46, 0.007], [0.28, -0.43, 0.006], [0.51, -0.51, 0.006],
  ];
  ctx.fillStyle = "rgba(155,98,70,0.40)";
  for (const [fx, fy, fr] of dots) {
    const [cx, cy] = toCanvas(fx, fy, w, h);
    const { sx, sy } = localScales(fx, fy, w, h);
    ctx.beginPath();
    ctx.ellipse(cx, cy, fr * sx, fr * sy, 0, 0, TAU);
    ctx.fill();
  }
}

function drawNoseShadow(ctx, w, h) {
  const ny = NOSE_Y - 0.042;
  const [cx, cy] = toCanvas(0, ny, w, h);
  const { sx, sy } = localScales(0, ny, w, h);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(sx / sy, 1);
  const r = 0.032 * sy;
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  grad.addColorStop(0.0, "rgba(148,96,82,0.22)");
  grad.addColorStop(0.6, "rgba(148,96,82,0.09)");
  grad.addColorStop(1.0, "rgba(148,96,82,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.15, r * 0.55, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawOpenEye(ctx, w, h, side, cfg, irisRgb, shiftX, shiftY) {
  const ex = side * EYE_X;
  const ey = EYE_Y;
  const p = eyeShapeParams(cfg.eyeShape);
  const hw = p.hw;
  const hh = p.hh;

  const u0 = [-hw, -0.04 * hh];
  const u1 = [-0.62 * hw + p.arch * hw, 1.32 * hh];
  const u2 = [0.58 * hw + p.arch * hw, 1.34 * hh + 0.35 * p.outerLift];
  const u3 = [hw, p.outerLift];

  const l0 = [hw, p.outerLift];
  const l1 = [0.62 * hw, -1.24 * hh * p.low + 0.2 * p.outerLift];
  const l2 = [-0.58 * hw, -1.22 * hh * p.low];
  const l3 = [-hw, -0.04 * hh];

  const toFace = (pt) => [ex + pt[0] * side, ey + pt[1]];
  const upperFace = [];
  const lowerFace = [];
  const steps = 32;
  for (let i = 0; i <= steps; i++) upperFace.push(toFace(cubicAt(u0, u1, u2, u3, i / steps)));
  for (let i = 0; i <= steps; i++) lowerFace.push(toFace(cubicAt(l0, l1, l2, l3, i / steps)));

  const openingCanvas = projectPoints([...upperFace, ...lowerFace.slice(1, -1)], w, h);

  ctx.save();
  tracePoly(ctx, openingCanvas, true);
  ctx.clip();

  // Soft warm sclera
  ctx.fillStyle = "#faf6f2";
  ctx.fill();

  // Subtle sclera top shadow
  const topPt = toCanvas(ex, ey + hh, w, h);
  const midPt = toCanvas(ex, ey + 0.1 * hh, w, h);
  const scGrad = ctx.createLinearGradient(topPt[0], topPt[1], midPt[0], midPt[1]);
  scGrad.addColorStop(0, "rgba(118,92,90,0.26)");
  scGrad.addColorStop(1, "rgba(118,92,90,0)");
  ctx.fillStyle = scGrad;
  ctx.fill();

  // Iris geometry
  const ix = ex + shiftX;
  const iy = ey - 0.005 + shiftY;
  const irisRx = hw * 0.80;
  const irisRy = hh * 0.87;
  const irisCanvas = projectPoints(ellipsePts(ix, iy, irisRx, irisRy, 52), w, h);

  const [ih, is, il] = rgbToHsl(irisRgb[0], irisRgb[1], irisRgb[2]);
  const deepIris = hslToRgb(ih, clamp(is * 1.08, 0, 1), clamp(il * 0.36, 0.06, 0.30));
  const rimIris = hslToRgb(ih, clamp(is * 1.05, 0, 1), clamp(il * 0.24, 0.04, 0.20));
  const lightIris = hslToRgb(ih + 0.015, clamp(is * 0.95, 0, 1), clamp(il + (1 - il) * 0.62, 0.68, 0.89));
  const glowIris = mixRgb(lightIris, [255, 252, 240], 0.48);

  ctx.save();
  tracePoly(ctx, irisCanvas, true);
  ctx.clip();

  // Vertical gradient from deep top to exact mid to luminous bottom
  const gTop = toCanvas(ix, iy + irisRy, w, h);
  const gBot = toCanvas(ix, iy - irisRy, w, h);
  const irisGrad = ctx.createLinearGradient(gTop[0], gTop[1], gBot[0], gBot[1]);
  irisGrad.addColorStop(0.0, rgba(deepIris, 1));
  irisGrad.addColorStop(0.45, rgba(irisRgb, 1));
  irisGrad.addColorStop(0.82, rgba(lightIris, 1));
  irisGrad.addColorStop(1.0, rgba(glowIris, 1));
  ctx.fillStyle = irisGrad;
  ctx.fillRect(0, 0, w, h);

  // Soft lower-third reflected arc
  const arcPts = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI * (0.16 + 0.68 * (i / 24));
    arcPts.push([ix + irisRx * 0.78 * Math.cos(a), iy - irisRy * 0.82 * Math.sin(a)]);
  }
  for (let i = 24; i >= 0; i--) {
    const a = Math.PI * (0.16 + 0.68 * (i / 24));
    arcPts.push([ix + irisRx * 0.44 * Math.cos(a), iy - irisRy * 0.44 * Math.sin(a)]);
  }
  tracePoly(ctx, projectPoints(arcPts, w, h), true);
  ctx.fillStyle = rgba(glowIris, 0.56);
  ctx.fill();

  // Soft pupil positioned high in the iris
  const px = ix;
  const py = iy + irisRy * 0.14;
  const [pcx, pcy] = toCanvas(px, py, w, h);
  const { sx: psx, sy: psy } = localScales(px, py, w, h);
  const pr = irisRy * 0.42 * psy;
  ctx.save();
  ctx.translate(pcx, pcy);
  ctx.scale((irisRx / irisRy) * (psx / psy), 1);
  const pGrad = ctx.createRadialGradient(0, 0, pr * 0.22, 0, 0, pr);
  pGrad.addColorStop(0.0, rgba(rimIris, 0.90));
  pGrad.addColorStop(0.68, rgba(deepIris, 0.68));
  pGrad.addColorStop(1.0, rgba(deepIris, 0));
  ctx.fillStyle = pGrad;
  ctx.beginPath();
  ctx.arc(0, 0, pr, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Subtle upper eyelid cast shadow across top of iris
  const sTop = toCanvas(ix, iy + irisRy, w, h);
  const sEnd = toCanvas(ix, iy + irisRy * 0.15, w, h);
  const shGrad = ctx.createLinearGradient(sTop[0], sTop[1], sEnd[0], sEnd[1]);
  shGrad.addColorStop(0.0, "rgba(40,22,18,0.36)");
  shGrad.addColorStop(1.0, "rgba(40,22,18,0)");
  ctx.fillStyle = shGrad;
  ctx.fillRect(0, 0, w, h);

  // Darker ring at the iris rim
  const { sy: isy } = localScales(ix, iy, w, h);
  tracePoly(ctx, irisCanvas, true);
  ctx.strokeStyle = rgba(rimIris, 0.85);
  ctx.lineWidth = Math.max(2, 0.024 * isy);
  ctx.stroke();

  // Crisp glossy highlights: large upper-left, small lower-right
  const h1 = projectPoints(
    ellipsePts(ix - irisRx * 0.35, iy + irisRy * 0.36, irisRx * 0.24, irisRx * 0.22, 24),
    w, h
  );
  tracePoly(ctx, h1, true);
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.fill();

  const h2 = projectPoints(
    ellipsePts(ix + irisRx * 0.34, iy - irisRy * 0.38, irisRx * 0.105, irisRx * 0.10, 20),
    w, h
  );
  tracePoly(ctx, h2, true);
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fill();

  ctx.restore();
  ctx.restore();

  // Soft thin eyelid crease hint
  const creasePts = [];
  for (let i = 5; i <= steps - 4; i++) {
    const f = upperFace[i];
    creasePts.push([f[0], f[1] + 0.044]);
  }
  const { sy: esy } = localScales(ex, ey, w, h);
  tracePoly(ctx, projectPoints(creasePts, w, h), false);
  ctx.strokeStyle = "rgba(112,72,58,0.18)";
  ctx.lineWidth = Math.max(1.5, 0.011 * esy);
  ctx.lineCap = "round";
  ctx.stroke();

  // Upper lash line: dark warm brown, thickest over outer half, slight upward outer flick
  const lashOuter = [];
  const lashInner = [];
  const flickSteps = 6;
  const endPt = upperFace[steps];
  const prevPt = upperFace[steps - 1];
  const tx = endPt[0] - prevPt[0];
  const ty = endPt[1] - prevPt[1];
  const tLen = Math.hypot(tx, ty) || 1;
  const fdx = (tx / tLen) * 0.55 + side * 0.72;
  const fdy = 0.42;

  for (let i = 0; i <= steps + flickSteps; i++) {
    let pt, nx, ny, thick;
    if (i <= steps) {
      const f = i / steps;
      pt = upperFace[i];
      const pPrev = upperFace[Math.max(0, i - 1)];
      const pNext = upperFace[Math.min(steps, i + 1)];
      const dx = pNext[0] - pPrev[0];
      const dy = pNext[1] - pPrev[1];
      const dl = Math.hypot(dx, dy) || 1;
      nx = (-dy / dl) * side;
      ny = (dx / dl) * side;
      if (ny < 0) { nx = -nx; ny = -ny; }
      thick = 0.010 + 0.036 * smoothstep(0.05, 0.68, f) * (1 - 0.25 * smoothstep(0.82, 1.0, f));
    } else {
      const k = (i - steps) / flickSteps;
      pt = [endPt[0] + fdx * 0.042 * k, endPt[1] + fdy * 0.042 * k * (0.65 + 0.55 * k)];
      nx = -0.3 * side;
      ny = 0.95;
      thick = 0.034 * (1 - k) * (1 - 0.4 * k) + 0.003;
    }
    lashOuter.push([pt[0] + nx * thick, pt[1] + ny * thick]);
    lashInner.push([pt[0] - nx * 0.007, pt[1] - ny * 0.007]);
  }
  const lashPoly = projectPoints([...lashOuter, ...lashInner.reverse()], w, h);
  tracePoly(ctx, lashPoly, true);
  ctx.fillStyle = "#3a231b";
  ctx.fill();

  // Thin short lower line under the outer third
  const lowLine = [];
  for (let i = 1; i <= Math.floor(steps * 0.36); i++) {
    const f = lowerFace[i];
    lowLine.push([f[0], f[1] - 0.006]);
  }
  tracePoly(ctx, projectPoints(lowLine, w, h), false);
  ctx.strokeStyle = "rgba(72,44,35,0.52)";
  ctx.lineWidth = Math.max(1.5, 0.012 * esy);
  ctx.lineCap = "round";
  ctx.stroke();

  // Optional three fine outer lashes
  if (cfg.lashes) {
    const lashDefs = [
      { idx: Math.round(steps * 0.72), len: 0.042, ang: 0.52 },
      { idx: Math.round(steps * 0.84), len: 0.052, ang: 0.42 },
      { idx: Math.round(steps * 0.94), len: 0.046, ang: 0.30 },
    ];
    ctx.fillStyle = "#3a231b";
    for (const ld of lashDefs) {
      const base = upperFace[ld.idx];
      const baseUp = [base[0], base[1] + 0.022];
      const dx = side * Math.cos(ld.ang) * ld.len;
      const dy = Math.sin(ld.ang) * ld.len;
      const mid = [baseUp[0] + dx * 0.55, baseUp[1] + dy * 0.42];
      const tip = [baseUp[0] + dx, baseUp[1] + dy * 1.15];
      const b1 = [baseUp[0] - side * 0.006, baseUp[1] + 0.004];
      const b2 = [baseUp[0] + side * 0.006, baseUp[1] - 0.006];
      const poly = projectPoints([b1, mid, tip, [mid[0] + side * 0.004, mid[1] - 0.005], b2], w, h);
      tracePoly(ctx, poly, true);
      ctx.fill();
    }
  }
}

function drawClosedEye(ctx, w, h, side, cfg, happyArc) {
  const ex = side * EYE_X;
  const ey = EYE_Y + (happyArc ? 0.01 : -0.02);
  const hw = 0.185;
  const curveH = happyArc ? 0.095 : -0.085;
  const c0 = [-hw, -0.01];
  const c1 = [-0.45 * hw, curveH];
  const c2 = [0.45 * hw, curveH];
  const c3 = [hw, happyArc ? 0.005 : -0.015];

  const steps = 28;
  const outer = [];
  const inner = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const pt = cubicAt(c0, c1, c2, c3, f);
    const fx = ex + pt[0] * side;
    const fy = ey + pt[1];
    const th = 0.010 + 0.026 * Math.sin(f * Math.PI) * (0.75 + 0.35 * f);
    outer.push([fx, fy + th]);
    inner.push([fx, fy - 0.007]);
  }
  tracePoly(ctx, projectPoints([...outer, ...inner.reverse()], w, h), true);
  ctx.fillStyle = "#3a231b";
  ctx.fill();

  if (cfg.lashes) {
    const { sy } = localScales(ex, ey, w, h);
    ctx.strokeStyle = "#3a231b";
    ctx.lineWidth = Math.max(1.8, 0.012 * sy);
    ctx.lineCap = "round";
    for (let k = 0; k < 3; k++) {
      const f = 0.72 + k * 0.12;
      const pt = cubicAt(c0, c1, c2, c3, f);
      const bx = ex + pt[0] * side;
      const by = ey + pt[1];
      const ang = happyArc ? 0.35 - k * 0.14 : -0.35 + k * 0.14;
      const len = 0.036 + (k === 1 ? 0.008 : 0);
      const seg = projectPoints([[bx, by], [bx + side * Math.cos(ang) * len, by + Math.sin(ang) * len]], w, h);
      tracePoly(ctx, seg, false);
      ctx.stroke();
    }
  }
}

function drawBrows(ctx, w, h, cfg, browRgb, expr) {
  for (const side of [-1, 1]) {
    const bx = side * EYE_X;
    let by = BROW_Y;
    let innerDy = -0.006;
    let midDy = 0.026;
    let outerDy = -0.012;

    if (cfg.brow === "straight") {
      innerDy = 0.0;
      midDy = 0.008;
      outerDy = -0.004;
    } else if (cfg.brow === "arched") {
      innerDy = -0.012;
      midDy = 0.040;
      outerDy = -0.018;
    }

    if (expr === "happy") {
      by += 0.025;
      midDy += 0.010;
    } else if (expr === "asleep") {
      by -= 0.018;
      midDy *= 0.6;
    } else if (expr === "thinking") {
      if (side === 1) {
        by += 0.042;
        midDy += 0.018;
      } else {
        by -= 0.014;
        midDy *= 0.5;
      }
    } else if (expr === "unsure") {
      by += 0.010;
      innerDy += 0.034;
      midDy = 0.012;
      outerDy -= 0.024;
    }

    const hw = 0.105;
    const p0 = [-hw, innerDy];
    const p1 = [-0.30 * hw, midDy];
    const p2 = [0.35 * hw, midDy * 0.92];
    const p3 = [hw, outerDy];

    const steps = 20;
    const upper = [];
    const lower = [];
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const pt = cubicAt(p0, p1, p2, p3, f);
      const fx = bx + pt[0] * side;
      const fy = by + pt[1];
      const th = 0.005 + 0.013 * Math.sin(f * Math.PI);
      upper.push([fx, fy + th]);
      lower.push([fx, fy - th]);
    }
    tracePoly(ctx, projectPoints([...upper, ...lower.reverse()], w, h), true);
    ctx.fillStyle = rgba(browRgb, 0.70);
    ctx.fill();
  }
}

function drawMouth(ctx, w, h, lipRgb, expr) {
  const my = MOUTH_Y;
  const rose = mixRgb(lipRgb, [196, 124, 122], 0.35);
  const darkRose = mixRgb(rose, [110, 56, 56], 0.42);
  const softLip = mixRgb(rose, [255, 224, 218], 0.42);
  const { sy } = localScales(0, my, w, h);

  if (expr === "happy") {
    const hw = 0.068;
    const topPts = [];
    const botPts = [];
    for (let i = 0; i <= 16; i++) {
      const f = i / 16;
      const x = -hw + 2 * hw * f;
      topPts.push([x, my + 0.012 - 0.012 * Math.sin(f * Math.PI)]);
      botPts.push([x, my + 0.010 - 0.056 * Math.sin(f * Math.PI)]);
    }
    const shape = projectPoints([...topPts, ...botPts.reverse()], w, h);
    tracePoly(ctx, shape, true);
    ctx.fillStyle = rgba(mixRgb(rose, [224, 118, 124], 0.5), 0.92);
    ctx.fill();
    ctx.strokeStyle = rgba(darkRose, 0.85);
    ctx.lineWidth = Math.max(1.8, 0.010 * sy);
    ctx.stroke();

    const tongue = projectPoints(ellipsePts(0, my - 0.030, 0.036, 0.015, 20), w, h);
    ctx.save();
    tracePoly(ctx, shape, true);
    ctx.clip();
    tracePoly(ctx, tongue, true);
    ctx.fillStyle = "rgba(248,166,168,0.65)";
    ctx.fill();
    ctx.restore();
    return;
  }

  if (expr === "thinking") {
    const dot = projectPoints(ellipsePts(0, my - 0.004, 0.024, 0.022, 24), w, h);
    tracePoly(ctx, dot, true);
    ctx.fillStyle = rgba(rose, 0.82);
    ctx.fill();
    ctx.strokeStyle = rgba(darkRose, 0.65);
    ctx.lineWidth = Math.max(1.5, 0.008 * sy);
    ctx.stroke();
    return;
  }

  if (expr === "unsure") {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const f = i / 24;
      const x = -0.055 + 0.11 * f;
      const y = my + 0.012 * Math.sin(f * TAU * 1.15);
      pts.push([x, y]);
    }
    tracePoly(ctx, projectPoints(pts, w, h), false);
    ctx.strokeStyle = rgba(darkRose, 0.78);
    ctx.lineWidth = Math.max(1.8, 0.012 * sy);
    ctx.lineCap = "round";
    ctx.stroke();
    return;
  }

  // Soft closed mouth ("awake" or "asleep")
  const hw = expr === "asleep" ? 0.044 : 0.050;
  const dip = expr === "asleep" ? 0.004 : 0.013;

  // Hint of lighter lower lip beneath
  const [lcx, lcy] = toCanvas(0, my - 0.024, w, h);
  const { sx: lsx, sy: lsy } = localScales(0, my - 0.024, w, h);
  ctx.save();
  ctx.translate(lcx, lcy);
  ctx.scale(lsx / lsy, 1);
  const lr = 0.036 * lsy;
  const lGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, lr);
  lGrad.addColorStop(0.0, rgba(softLip, 0.42));
  lGrad.addColorStop(1.0, rgba(softLip, 0));
  ctx.fillStyle = lGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, lr * 1.25, lr * 0.55, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Main curved mouth line
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const f = i / 20;
    const x = -hw + 2 * hw * f;
    const y = my + dip * (1 - Math.sin(f * Math.PI));
    pts.push([x, y]);
  }
  const cPts = projectPoints(pts, w, h);
  const [gL] = cPts;
  const gR = cPts[cPts.length - 1];
  const mGrad = ctx.createLinearGradient(gL[0], gL[1], gR[0], gR[1]);
  mGrad.addColorStop(0.0, rgba(rose, 0.45));
  mGrad.addColorStop(0.5, rgba(darkRose, 0.88));
  mGrad.addColorStop(1.0, rgba(rose, 0.45));

  tracePoly(ctx, cPts, false);
  ctx.strokeStyle = mGrad;
  ctx.lineWidth = Math.max(1.8, 0.011 * sy);
  ctx.lineCap = "round";
  ctx.stroke();
}

function redrawFace(state) {
  const { ctx, w, h, cfg, irisRgb, browRgb, lipRgb, expression, blinking, glossMeshes, tex } = state;
  if (!ctx) return;

  ctx.clearRect(0, 0, w, h);

  if (cfg.blush) drawBlush(ctx, w, h, expression === "happy");
  if (cfg.freckles) drawFreckles(ctx, w, h);
  drawNoseShadow(ctx, w, h);

  const isClosed = expression === "happy" || expression === "asleep" || blinking;
  const happyArc = expression === "happy";
  const shiftX = expression === "thinking" ? 0.042 : 0;
  const shiftY = expression === "thinking" ? 0.036 : 0;

  for (const side of [-1, 1]) {
    if (isClosed) drawClosedEye(ctx, w, h, side, cfg, happyArc);
    else drawOpenEye(ctx, w, h, side, cfg, irisRgb, shiftX, shiftY);
  }

  drawBrows(ctx, w, h, cfg, browRgb, expression);
  drawMouth(ctx, w, h, lipRgb, expression);

  for (const gm of glossMeshes) gm.visible = !isClosed;
  if (tex) tex.needsUpdate = true;
}

export function buildHead(THREE, opts, kit) {
  const cfg = {
    skin: opts?.skin ?? 0xfbe2d2,
    eye: opts?.eye ?? 0x7b4c2a,
    eyeShape: opts?.eyeShape ?? "round",
    brow: opts?.brow ?? "soft",
    browColor: opts?.browColor ?? 0x5c3d2e,
    lip: opts?.lip ?? 0xc98482,
    blush: opts?.blush !== undefined ? Boolean(opts.blush) : true,
    freckles: Boolean(opts?.freckles),
    lashes: opts?.lashes !== undefined ? Boolean(opts.lashes) : true,
  };

  const group = new THREE.Group();
  group.name = "dollHead";

  const core = new THREE.Group();
  core.position.set(0, HEAD.centerY, 0);
  group.add(core);

  const skinColor = new THREE.Color(cfg.skin);
  const sheenColor = skinColor.clone().lerp(new THREE.Color(0xfff6f0), 0.5);
  const skinMat = new THREE.MeshPhysicalMaterial({
    color: skinColor,
    roughness: 0.55,
    metalness: 0.0,
    sheen: 0.35,
    sheenRoughness: 0.6,
    sheenColor,
  });

  // Main smooth head mesh
  const headGeo = buildHeadGeometry(THREE);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  core.add(headMesh);

  // Ears at y = -0.28 unit, widest head sides, angled outward ~35 deg
  const earY = -0.28 * HEAD.radii[1];
  const earX = Math.sqrt(1 - 0.28 * 0.28) * HEAD.radii[0] * 0.965;
  const earZ = -0.012;
  const earYaw = (35 * Math.PI) / 180;
  for (const side of [-1, 1]) {
    const earGeo = buildEarGeometry(THREE, side);
    const ear = new THREE.Mesh(earGeo, skinMat);
    ear.position.set(side * earX, earY, earZ);
    ear.rotation.set(0, side * earYaw, -side * 0.06);
    ear.castShadow = true;
    ear.receiveShadow = true;
    core.add(ear);
  }

  // Short smooth neck plug under the chin/base of skull
  const plugGeo = new THREE.CylinderGeometry(0.040, 0.035, 0.072, 24);
  const plugMesh = new THREE.Mesh(plugGeo, skinMat);
  plugMesh.position.set(0, -0.012, -0.012);
  plugMesh.castShadow = true;
  plugMesh.receiveShadow = true;
  group.add(plugMesh);

  // Eye gloss lens patches following the head surface at 1.006 scale
  const glossMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.25,
    roughness: 0.05,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
  });

  const glossMeshes = [];
  for (const side of [-1, 1]) {
    const gm = new THREE.Mesh(buildEyeGlossGeometry(THREE, side), glossMat);
    gm.renderOrder = 2;
    gm.castShadow = false;
    gm.receiveShadow = false;
    core.add(gm);
    glossMeshes.push(gm);
  }

  // Face paint CanvasTexture on an exact clone of the head mesh scaled 1.003
  const state = {
    ctx: null,
    w: 2048,
    h: 1024,
    cfg,
    irisRgb: colorToRgb(THREE, cfg.eye),
    browRgb: colorToRgb(THREE, cfg.browColor),
    lipRgb: colorToRgb(THREE, cfg.lip),
    expression: "awake",
    blinking: false,
    blinkSeed: 1.7,
    glossMeshes,
    tex: null,
  };

  const faceTex = kit.canvasTexture(2048, 1024, (ctx, w, h) => {
    state.ctx = ctx;
    state.w = w;
    state.h = h;
    redrawFace(state);
  });
  if (THREE.SRGBColorSpace) faceTex.colorSpace = THREE.SRGBColorSpace;
  state.tex = faceTex;
  faceTex.needsUpdate = true;

  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTex,
    transparent: true,
    roughness: 0.9,
    metalness: 0.0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });

  const faceMesh = new THREE.Mesh(headGeo.clone(), faceMat);
  faceMesh.scale.setScalar(1.003);
  faceMesh.renderOrder = 1;
  faceMesh.castShadow = false;
  faceMesh.receiveShadow = true;
  core.add(faceMesh);

  group.userData.headState = state;
  return group;
}

export function setExpression(group, name) {
  const state = group?.userData?.headState;
  if (!state) return;
  const valid = name === "awake" || name === "happy" || name === "asleep" || name === "thinking" || name === "unsure";
  const next = valid ? name : "awake";
  state.expression = next;
  redrawFace(state);
}

export function blink(group, t) {
  const state = group?.userData?.headState;
  if (!state) return;
  if (state.expression === "asleep" || state.expression === "happy") {
    if (state.blinking) {
      state.blinking = false;
      redrawFace(state);
    }
    return;
  }
  const slot = Math.floor(t / 4.0);
  const raw = Math.sin(slot * 127.1 + state.blinkSeed) * 43758.5453;
  const frac = raw - Math.floor(raw);
  const start = slot * 4.0 + 1.5 + frac;
  const shouldBlink = t >= start && t < start + 0.12;
  if (shouldBlink !== state.blinking) {
    state.blinking = shouldBlink;
    redrawFace(state);
  }
}
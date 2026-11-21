export const META = {
  id: "tiger-cub",
  name: "Cozy Tiger Cub",
  kind: "creature",
  footprint: [0.34, 0.46],
  variants: ["Orange Bengal", "White Bengal", "Golden Tabby"],
  note: "Stylised lying tiger cub (~0.45 m) with sculpted continuous forms, painted fur stripes, round white-spotted ears, ringed curled tail, and three-layer glossy eyes."
};

const PALETTES = [
  {
    fur: "#e07f34",
    furAccent: "#221814",
    belly: "#f7ecd9",
    dorsalMix: "#a84414",
    eye: "#d99228",
    skin: "#df8d8a",
    claw: "#efe3cf",
    blush: "#e97b74"
  },
  {
    fur: "#eee9e2",
    furAccent: "#453935",
    belly: "#fcfaf6",
    dorsalMix: "#cfc7be",
    eye: "#5aa5db",
    skin: "#e5a3a9",
    claw: "#f5efe6",
    blush: "#ea95a0"
  },
  {
    fur: "#e9bd70",
    furAccent: "#8c4f24",
    belly: "#fdf5e4",
    dorsalMix: "#c8863c",
    eye: "#be8d2e",
    skin: "#e39c8e",
    claw: "#f4ead7",
    blush: "#e88a7d"
  }
];

function parseHex(hex, fallback = [224, 127, 52]) {
  if (typeof hex !== "string") return fallback.slice();
  const s = hex.trim().replace(/^#/, "");
  if (s.length === 3) {
    return [
      parseInt(s[0] + s[0], 16) || fallback[0],
      parseInt(s[1] + s[1], 16) || fallback[1],
      parseInt(s[2] + s[2], 16) || fallback[2]
    ];
  }
  if (s.length >= 6) {
    const r = parseInt(s.slice(0, 2), 16);
    const g = parseInt(s.slice(2, 4), 16);
    const b = parseInt(s.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) return [r, g, b];
  }
  return fallback.slice();
}

function rgbStr(rgb, a = 1) {
  const r = Math.max(0, Math.min(255, Math.round(rgb[0])));
  const g = Math.max(0, Math.min(255, Math.round(rgb[1])));
  const b = Math.max(0, Math.min(255, Math.round(rgb[2])));
  return a >= 0.999 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

function mixRgb(a, b, t) {
  const k = Math.max(0, Math.min(1, t));
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k
  ];
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function fbm(kit, x, y) {
  return (
    kit.noise(x, y) * 0.56 +
    kit.noise(x * 2.03 + 11.7, y * 2.03 + 5.3) * 0.29 +
    kit.noise(x * 4.11 + 23.1, y * 4.11 + 17.9) * 0.15
  );
}

function resolveColors(opts) {
  const idx = clamp(Math.round(opts?.variant ?? 0), 0, PALETTES.length - 1);
  const base = PALETTES[idx];
  const fur = parseHex(opts?.fur, parseHex(base.fur));
  const furAccent = parseHex(opts?.furAccent, parseHex(base.furAccent));
  const eye = parseHex(opts?.eye, parseHex(base.eye));
  const belly = opts?.fur ? mixRgb(fur, [252, 245, 234], 0.78) : parseHex(base.belly);
  const dorsal = opts?.fur ? mixRgb(fur, [90, 38, 16], 0.34) : parseHex(base.dorsalMix);
  const sheen = mixRgb(fur, [255, 250, 242], 0.58);
  const skin = parseHex(base.skin);
  const claw = parseHex(base.claw);
  const blush = parseHex(base.blush);
  return { idx, fur, furAccent, belly, dorsal, sheen, eye, skin, claw, blush };
}

// ---------------------------------------------------------------------------
// Tapered Tube Helper (CatmullRomCurve3, parallel-transport frames, smooth caps)
// ---------------------------------------------------------------------------
function createTaperedTube(THREE, curve, cfg = {}) {
  const tubularSegments = cfg.tubularSegments ?? 40;
  const radialSegments = cfg.radialSegments ?? 20;
  const radiusFn = cfg.radiusFn ?? (() => 0.02);
  const shapeFn = cfg.shapeFn ?? null;
  const capStart = cfg.capStart ?? true;
  const capEnd = cfg.capEnd ?? true;
  const capRings = cfg.capRings ?? 5;
  const capBulgeStart = cfg.capBulgeStart ?? 0.9;
  const capBulgeEnd = cfg.capBulgeEnd ?? 1.0;

  const centers = [];
  const tangents = [];
  const normals = [];
  const binormals = [];
  const ts = [];
  const radii = [];

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    centers.push(curve.getPoint(t));
    tangents.push(curve.getTangent(t).normalize());
    ts.push(t);
    radii.push(Math.max(1e-4, radiusFn(t)));
  }

  // Parallel-transport frames to prevent twist
  const upRef = new THREE.Vector3(0, 1, 0);
  const altRef = new THREE.Vector3(1, 0, 0);
  let n0 = new THREE.Vector3().crossVectors(
    Math.abs(tangents[0].dot(upRef)) > 0.92 ? altRef : upRef,
    tangents[0]
  ).normalize();
  let b0 = new THREE.Vector3().crossVectors(tangents[0], n0).normalize();
  normals.push(n0);
  binormals.push(b0);

  const axis = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  for (let i = 1; i <= tubularSegments; i++) {
    const prevT = tangents[i - 1];
    const currT = tangents[i];
    const nPrev = normals[i - 1].clone();
    axis.crossVectors(prevT, currT);
    const sinA = axis.length();
    if (sinA > 1e-6) {
      axis.divideScalar(sinA);
      const angle = Math.acos(clamp(prevT.dot(currT), -1, 1));
      quat.setFromAxisAngle(axis, angle);
      nPrev.applyQuaternion(quat);
    }
    nPrev.addScaledVector(currT, -nPrev.dot(currT)).normalize();
    const bCurr = new THREE.Vector3().crossVectors(currT, nPrev).normalize();
    normals.push(nPrev);
    binormals.push(bCurr);
  }

  // Assemble full ring sequence including rounded hemispherical caps
  const rings = [];
  if (capStart) {
    const r0 = radii[0];
    for (let k = capRings; k >= 1; k--) {
      const a = (k / capRings) * (Math.PI * 0.5);
      const c = centers[0].clone().addScaledVector(tangents[0], -Math.sin(a) * r0 * capBulgeStart);
      rings.push({
        center: c,
        tangent: tangents[0],
        normal: normals[0],
        binormal: binormals[0],
        r: Math.max(1e-4, r0 * Math.cos(a)),
        t: 0
      });
    }
  }
  for (let i = 0; i <= tubularSegments; i++) {
    rings.push({
      center: centers[i],
      tangent: tangents[i],
      normal: normals[i],
      binormal: binormals[i],
      r: radii[i],
      t: ts[i]
    });
  }
  if (capEnd) {
    const last = tubularSegments;
    const rEnd = radii[last];
    for (let k = 1; k <= capRings; k++) {
      const a = (k / capRings) * (Math.PI * 0.5);
      const c = centers[last].clone().addScaledVector(tangents[last], Math.sin(a) * rEnd * capBulgeEnd);
      rings.push({
        center: c,
        tangent: tangents[last],
        normal: normals[last],
        binormal: binormals[last],
        r: Math.max(1e-4, rEnd * Math.cos(a)),
        t: 1
      });
    }
  }

  const ringCount = rings.length;
  const cols = radialSegments + 1;
  const positions = new Float32Array(ringCount * cols * 3);
  const uvs = new Float32Array(ringCount * cols * 2);
  const indices = [];
  const p = new THREE.Vector3();

  for (let i = 0; i < ringCount; i++) {
    const ring = rings[i];
    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const theta = u * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      p.copy(ring.center)
        .addScaledVector(ring.normal, cosT * ring.r)
        .addScaledVector(ring.binormal, sinT * ring.r);

      if (shapeFn) {
        shapeFn(p, ring.t, theta, ring.center, ring.tangent, ring.normal, ring.binormal, ring.r);
      }

      const idx = i * cols + j;
      positions[idx * 3] = p.x;
      positions[idx * 3 + 1] = p.y;
      positions[idx * 3 + 2] = p.z;
      uvs[idx * 2] = u;
      uvs[idx * 2 + 1] = ring.t;
    }
  }

  for (let i = 0; i < ringCount - 1; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * cols + j;
      const b = (i + 1) * cols + j;
      const c = (i + 1) * cols + (j + 1);
      const d = i * cols + (j + 1);
      indices.push(a, d, b, d, c, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Procedural Canvas Textures (painted with kit.canvasTexture & kit.noise)
// ---------------------------------------------------------------------------
function drawFurStrokes(ctx, w, h, kit, count, baseRgb, darkRgb, lightRgb, horizontal = false) {
  ctx.lineCap = "round";
  for (let i = 0; i < count; i++) {
    const n1 = kit.noise(i * 0.37, 1.7);
    const n2 = kit.noise(3.9, i * 0.43);
    const n3 = kit.noise(i * 0.19, i * 0.29);
    const x = n1 * w;
    const y = n2 * h;
    const len = 4 + n3 * 12;
    const col = n3 > 0.56 ? mixRgb(baseRgb, lightRgb, 0.35) : mixRgb(baseRgb, darkRgb, 0.24);
    ctx.strokeStyle = rgbStr(col, 0.14 + n3 * 0.14);
    ctx.lineWidth = 0.8 + n3 * 1.4;
    ctx.beginPath();
    if (horizontal) {
      ctx.moveTo(x - len * 0.5, y);
      ctx.lineTo(x + len * 0.5, y + (n1 - 0.5) * 3);
    } else {
      ctx.moveTo(x, y - len * 0.5);
      ctx.lineTo(x + (n2 - 0.5) * 3, y + len * 0.5);
    }
    ctx.stroke();
  }
}

function makeFurBumpTexture(THREE, kit, w, h, flowVertical = true) {
  const tex = kit.canvasTexture(w, h, (ctx, cw, ch) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, cw, ch);
    ctx.lineCap = "round";
    const total = Math.round((cw * ch) / 48);
    for (let i = 0; i < total; i++) {
      const nx = kit.noise(i * 0.27, 4.13);
      const ny = kit.noise(9.71, i * 0.31);
      const ns = kit.noise(i * 0.13, i * 0.17);
      const x = nx * cw;
      const y = ny * ch;
      const l = 5 + ns * 11;
      const v = Math.round(92 + ns * 78);
      ctx.strokeStyle = `rgba(${v},${v},${v},0.34)`;
      ctx.lineWidth = 0.9 + ns * 1.3;
      ctx.beginPath();
      if (flowVertical) {
        ctx.moveTo(x, y - l * 0.5);
        ctx.lineTo(x + (nx - 0.5) * 3.5, y + l * 0.5);
      } else {
        ctx.moveTo(x - l * 0.5, y);
        ctx.lineTo(x + l * 0.5, y + (ny - 0.5) * 3.5);
      }
      ctx.stroke();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function drawTaperedStripe(ctx, pts, widths, colorRgb, kit, seed, alpha = 0.94) {
  if (pts.length < 2) return;
  const left = [];
  const right = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    let dx = next[0] - prev[0];
    let dy = next[1] - prev[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const nx = -dy;
    const ny = dx;
    const jitter = (kit.noise(i * 0.7 + seed, seed * 1.3) - 0.5) * widths[i] * 0.42;
    const w = widths[i] + jitter;
    left.push([p[0] + nx * w, p[1] + ny * w]);
    right.push([p[0] - nx * w, p[1] - ny * w]);
  }
  ctx.fillStyle = rgbStr(colorRgb, alpha);
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fill();
}

function makeBodyTexture(THREE, kit, colors) {
  // UV: x=0.5 spine top, x=0.25/0.75 flanks, x=0/1 belly bottom; y=0 chest/neck, y=h rump
  const tex = kit.canvasTexture(1024, 512, (ctx, w, h) => {
    // Base coat gradient across girth (belly -> flank -> dorsal spine -> flank -> belly)
    const girthGrad = ctx.createLinearGradient(0, 0, w, 0);
    girthGrad.addColorStop(0.0, rgbStr(colors.belly));
    girthGrad.addColorStop(0.14, rgbStr(colors.belly));
    girthGrad.addColorStop(0.24, rgbStr(mixRgb(colors.belly, colors.fur, 0.72)));
    girthGrad.addColorStop(0.36, rgbStr(colors.fur));
    girthGrad.addColorStop(0.50, rgbStr(colors.dorsal));
    girthGrad.addColorStop(0.64, rgbStr(colors.fur));
    girthGrad.addColorStop(0.76, rgbStr(mixRgb(colors.belly, colors.fur, 0.72)));
    girthGrad.addColorStop(0.86, rgbStr(colors.belly));
    girthGrad.addColorStop(1.0, rgbStr(colors.belly));
    ctx.fillStyle = girthGrad;
    ctx.fillRect(0, 0, w, h);

    // Creamy fluffy chest bib at front (y near 0)
    const bibGrad = ctx.createRadialGradient(w * 0.0, h * 0.14, h * 0.02, w * 0.0, h * 0.14, w * 0.25);
    bibGrad.addColorStop(0, rgbStr(colors.belly, 0.96));
    bibGrad.addColorStop(0.65, rgbStr(colors.belly, 0.55));
    bibGrad.addColorStop(1, rgbStr(colors.belly, 0));
    ctx.fillStyle = bibGrad;
    ctx.fillRect(0, 0, w, h);

    const bibGradR = ctx.createRadialGradient(w * 1.0, h * 0.14, h * 0.02, w * 1.0, h * 0.14, w * 0.25);
    bibGradR.addColorStop(0, rgbStr(colors.belly, 0.96));
    bibGradR.addColorStop(0.65, rgbStr(colors.belly, 0.55));
    bibGradR.addColorStop(1, rgbStr(colors.belly, 0));
    ctx.fillStyle = bibGradR;
    ctx.fillRect(0, 0, w, h);

    // Subtle organic fur mottling
    for (let i = 0; i < 160; i++) {
      const rx = kit.noise(i * 0.31, 2.7) * w;
      const ry = kit.noise(7.1, i * 0.23) * h;
      const distSpine = Math.abs(rx / w - 0.5);
      if (distSpine > 0.36) continue;
      const rad = 14 + kit.noise(i * 0.4, i * 0.7) * 32;
      const tint = kit.noise(i * 0.9, 1.1) > 0.5 ? colors.dorsal : mixRgb(colors.fur, colors.belly, 0.35);
      const mg = ctx.createRadialGradient(rx, ry, 1, rx, ry, rad);
      mg.addColorStop(0, rgbStr(tint, 0.18));
      mg.addColorStop(1, rgbStr(tint, 0));
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(rx, ry, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tiger stripes wrapping smoothly from spine down both flanks
    const stripeRows = [
      { y: 0.19, span: 0.26, thick: 12, curve: 18, fork: false },
      { y: 0.28, span: 0.31, thick: 15, curve: 22, fork: true },
      { y: 0.39, span: 0.34, thick: 16, curve: 20, fork: false },
      { y: 0.50, span: 0.35, thick: 17, curve: 15, fork: true },
      { y: 0.61, span: 0.34, thick: 16, curve: 8, fork: false },
      { y: 0.72, span: 0.31, thick: 14, curve: -6, fork: true },
      { y: 0.82, span: 0.25, thick: 12, curve: -14, fork: false },
      { y: 0.90, span: 0.17, thick: 10, curve: -12, fork: false }
    ];

    stripeRows.forEach((s, idx) => {
      for (const side of [-1, 1]) {
        const steps = 16;
        const pts = [];
        const widths = [];
        const yBase = s.y * h + (kit.noise(idx * 2.1, side * 3.7) - 0.5) * 14;
        for (let k = 0; k <= steps; k++) {
          const f = k / steps;
          const x = w * (0.5 + side * f * s.span);
          const wave = Math.sin(f * Math.PI * 1.4 + idx) * 7 + (kit.noise(f * 3 + idx, side + 4) - 0.5) * 8;
          const y = yBase + Math.pow(f, 1.35) * s.curve + wave;
          pts.push([x, y]);
          const taper = Math.sin(Math.pow(f, 0.72) * Math.PI) * 0.92 + (1 - f) * 0.38;
          widths.push(s.thick * clamp(taper, 0.08, 1.15));
        }
        drawTaperedStripe(ctx, pts, widths, colors.furAccent, kit, idx * 5 + side, 0.93);

        // Optional authentic forked tiger branch
        if (s.fork) {
          const bPts = [];
          const bWidths = [];
          const startIdx = 5;
          for (let k = 0; k <= 9; k++) {
            const f = k / 9;
            const origin = pts[startIdx];
            const x = origin[0] + side * f * w * 0.14;
            const y = origin[1] + (idx % 2 === 0 ? 1 : -1) * (10 + f * 26) + Math.sin(f * 3) * 4;
            bPts.push([x, y]);
            bWidths.push(s.thick * 0.68 * (1 - f * 0.88));
          }
          drawTaperedStripe(ctx, bPts, bWidths, colors.furAccent, kit, idx * 9 + side * 2, 0.88);
        }
      }
    });

    // Subtle dark spine accent line between stripes
    const spinePts = [];
    const spineW = [];
    for (let i = 0; i <= 24; i++) {
      const f = i / 24;
      spinePts.push([w * 0.5 + (kit.noise(f * 5, 2.2) - 0.5) * 6, h * (0.14 + f * 0.78)]);
      spineW.push(7 * Math.sin(f * Math.PI) + 2);
    }
    drawTaperedStripe(ctx, spinePts, spineW, mixRgb(colors.dorsal, colors.furAccent, 0.55), kit, 77, 0.48);

    // Fine directional fur strokes
    drawFurStrokes(ctx, w, h, kit, 2600, colors.fur, colors.furAccent, colors.belly, false);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeHeadTexture(THREE, kit, colors) {
  // SphereGeometry(phiStart = -PI/2):
  // x=0.5*w is front (+z), x=0.25*w right (-x), x=0.75*w left (+x), x=0/w back (-z)
  // y=0 top crown (+y), y=0.5*h equator, y=h chin (-y)
  const tex = kit.canvasTexture(1024, 512, (ctx, w, h) => {
    const dirToXY = (ux, uy, uz) => {
      const len = Math.hypot(ux, uy, uz) || 1;
      const nx = ux / len;
      const ny = uy / len;
      const nz = uz / len;
      // SphereGeometry: x = -cos(phi)*sin(theta), z = sin(phi)*sin(theta)
      let phi = Math.atan2(nz, -nx);
      let u = (phi + Math.PI * 0.5) / (Math.PI * 2);
      u = ((u % 1) + 1) % 1;
      const theta = Math.acos(clamp(ny, -1, 1));
      const v = theta / Math.PI;
      return [u * w, v * h];
    };

    // Base head fur gradient (warmer crown -> rich face -> creamy chin/throat)
    const vGrad = ctx.createLinearGradient(0, 0, 0, h);
    vGrad.addColorStop(0.0, rgbStr(colors.dorsal));
    vGrad.addColorStop(0.28, rgbStr(colors.fur));
    vGrad.addColorStop(0.64, rgbStr(colors.fur));
    vGrad.addColorStop(0.78, rgbStr(mixRgb(colors.fur, colors.belly, 0.72)));
    vGrad.addColorStop(1.0, rgbStr(colors.belly));
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, w, h);

    // Soft bright white/cream lower muzzle & fluffy cheek ruffs
    const drawSoftPatch = (ux, uy, uz, rx, ry, rgb, alpha = 1) => {
      const [cx, cy] = dirToXY(ux, uy, uz);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, rx * 0.25, 0, 0, rx);
      g.addColorStop(0, rgbStr(rgb, alpha));
      g.addColorStop(0.68, rgbStr(rgb, alpha * 0.85));
      g.addColorStop(1, rgbStr(rgb, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    // Cheek ruffs (both sides)
    drawSoftPatch(0.76, -0.24, 0.58, 128, 86, colors.belly, 0.96);
    drawSoftPatch(-0.76, -0.24, 0.58, 128, 86, colors.belly, 0.96);
    // Plump muzzle pads & chin
    drawSoftPatch(0.18, -0.24, 0.95, 68, 56, colors.belly, 0.98);
    drawSoftPatch(-0.18, -0.24, 0.95, 68, 56, colors.belly, 0.98);
    drawSoftPatch(0, -0.45, 0.88, 92, 68, colors.belly, 0.98);

    // Classic cub white spots above each eye (supraorbital markings)
    drawSoftPatch(0.32, 0.24, 0.91, 30, 18, colors.belly, 0.92);
    drawSoftPatch(-0.32, 0.24, 0.91, 30, 18, colors.belly, 0.92);

    // Subtle warm fur shadow around eye sockets for cozy depth
    drawSoftPatch(0.41, 0.08, 0.91, 40, 34, mixRgb(colors.furAccent, colors.dorsal, 0.45), 0.32);
    drawSoftPatch(-0.41, 0.08, 0.91, 40, 34, mixRgb(colors.furAccent, colors.dorsal, 0.45), 0.32);

    // Soft rosy cheek blush baked smoothly into cheek fur
    drawSoftPatch(0.56, -0.10, 0.82, 46, 28, colors.blush, 0.36);
    drawSoftPatch(-0.56, -0.10, 0.82, 46, 28, colors.blush, 0.36);

    // Iconic Tiger Forehead "王" / Curved M Markings
    const drawCurveDir = (dirList, widthList, seed, alpha = 0.95) => {
      const pts = dirList.map(([x, y, z]) => dirToXY(x, y, z));
      drawTaperedStripe(ctx, pts, widthList, colors.furAccent, kit, seed, alpha);
    };

    // Center forehead vertical stem
    drawCurveDir(
      [[0, 0.16, 0.98], [0, 0.30, 0.95], [0, 0.46, 0.88], [0, 0.62, 0.78], [0, 0.76, 0.64]],
      [4, 7, 8, 7, 4],
      11
    );
    // 3 arched forehead bars (forming the classic cub brow crown)
    const bars = [
      { y0: 0.28, y1: 0.35, span: 0.24, w: 6.5 },
      { y0: 0.44, y1: 0.50, span: 0.36, w: 8.5 },
      { y0: 0.61, y1: 0.64, span: 0.44, w: 9.0 }
    ];
    bars.forEach((b, bi) => {
      const pts = [];
      const ws = [];
      for (let i = 0; i <= 10; i++) {
        const f = i / 10;
        const s = (f - 0.5) * 2;
        const ux = s * b.span;
        const uy = b.y0 + (1 - s * s) * (b.y1 - b.y0);
        const uz = Math.sqrt(Math.max(0.05, 1 - ux * ux - uy * uy));
        pts.push([ux, uy, uz]);
        ws.push(b.w * (0.25 + 0.85 * (1 - Math.abs(s) * 0.75)));
      }
      drawCurveDir(pts, ws, 20 + bi * 3);
    });

    // Symmetric side temple & cheek stripes
    for (const side of [-1, 1]) {
      // Temple stripe sweeping up behind eyebrow toward ear
      drawCurveDir(
        [
          [side * 0.38, 0.24, 0.89],
          [side * 0.50, 0.34, 0.79],
          [side * 0.60, 0.46, 0.65],
          [side * 0.62, 0.60, 0.50]
        ],
        [4, 8, 9, 5],
        31 + side
      );
      // Bold upper cheek bar sweeping outward across cheek ruff
      drawCurveDir(
        [
          [side * 0.52, -0.02, 0.85],
          [side * 0.68, -0.06, 0.72],
          [side * 0.84, -0.10, 0.53],
          [side * 0.94, -0.13, 0.31]
        ],
        [4, 9, 10, 4],
        41 + side
      );
      // Lower cheek ruff stripe
      drawCurveDir(
        [
          [side * 0.56, -0.22, 0.80],
          [side * 0.74, -0.25, 0.62],
          [side * 0.88, -0.26, 0.39],
          [side * 0.95, -0.24, 0.18]
        ],
        [3.5, 8.5, 8, 3.5],
        51 + side
      );
      // Cute dark tear/eyeliner accent sweeping softly from outer eye corner
      drawCurveDir(
        [
          [side * 0.50, 0.04, 0.86],
          [side * 0.57, -0.01, 0.82],
          [side * 0.64, -0.04, 0.76]
        ],
        [3.5, 4.8, 2.5],
        61 + side,
        0.82
      );
      // Back-of-head crown stripes
      drawCurveDir(
        [
          [side * 0.10, 0.78, -0.61],
          [side * 0.34, 0.66, -0.67],
          [side * 0.58, 0.48, -0.66],
          [side * 0.76, 0.28, -0.58]
        ],
        [5, 9, 9.5, 4.5],
        71 + side
      );
      drawCurveDir(
        [
          [side * 0.12, 0.52, -0.84],
          [side * 0.36, 0.40, -0.84],
          [side * 0.60, 0.24, -0.76],
          [side * 0.78, 0.06, -0.62]
        ],
        [5, 9, 8.5, 4],
        81 + side
      );

      // Cute tiny whisker-follicle dots on the white muzzle pads
      const dotDirs = [
        [side * 0.17, -0.19, 0.96],
        [side * 0.24, -0.21, 0.95],
        [side * 0.19, -0.26, 0.94],
        [side * 0.27, -0.27, 0.92]
      ];
      ctx.fillStyle = rgbStr(colors.furAccent, 0.68);
      for (const [dx, dy, dz] of dotDirs) {
        const [px, py] = dirToXY(dx, dy, dz);
        ctx.beginPath();
        ctx.arc(px, py, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Subtle bridge shading above the nose
    drawSoftPatch(0, -0.02, 0.99, 26, 22, colors.dorsal, 0.28);

    // Painterly fur strokes over head
    drawFurStrokes(ctx, w, h, kit, 2200, colors.fur, colors.furAccent, colors.belly, false);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeEarTexture(THREE, kit, colors) {
  // Left half [0, 0.5]: inner ear (fur rim + soft pink inner hollow + cream base tufts)
  // Right half [0.5, 1.0]: outer/back ear (dark fur with iconic bright white round spot!)
  const tex = kit.canvasTexture(512, 256, (ctx, w, h) => {
    const hw = w * 0.5;

    // LEFT HALF: Inner ear
    ctx.fillStyle = rgbStr(colors.fur);
    ctx.fillRect(0, 0, hw, h);

    // Warm dark outer rim near top
    const rimGrad = ctx.createRadialGradient(hw * 0.5, h * 0.58, h * 0.18, hw * 0.5, h * 0.5, h * 0.52);
    rimGrad.addColorStop(0, rgbStr(colors.skin));
    rimGrad.addColorStop(0.54, rgbStr(mixRgb(colors.skin, colors.belly, 0.35)));
    rimGrad.addColorStop(0.78, rgbStr(colors.fur));
    rimGrad.addColorStop(1, rgbStr(mixRgb(colors.fur, colors.furAccent, 0.55)));
    ctx.fillStyle = rimGrad;
    ctx.fillRect(0, 0, hw, h);

    // Fluffy cream hair wisps radiating from inner ear base
    ctx.lineCap = "round";
    for (let i = 0; i < 42; i++) {
      const f = i / 41;
      const ang = -Math.PI * 0.85 + f * Math.PI * 0.7;
      const n = kit.noise(i * 0.5, 2.3);
      const x0 = hw * 0.5 + (f - 0.5) * hw * 0.45;
      const y0 = h * 0.92;
      const len = h * (0.28 + n * 0.28);
      ctx.strokeStyle = rgbStr(colors.belly, 0.55 + n * 0.35);
      ctx.lineWidth = 2.2 + n * 2.4;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + Math.cos(ang) * len * 0.5, y0 + Math.sin(ang) * len);
      ctx.stroke();
    }

    // RIGHT HALF: Back of ear (classic dark tiger ear with iconic white round ocellus spot!)
    const backDark = mixRgb(colors.furAccent, [18, 14, 12], 0.38);
    ctx.fillStyle = rgbStr(backDark);
    ctx.fillRect(hw, 0, hw, h);

    // Subtle warm fur transition at the very bottom base of the ear back
    const baseGrad = ctx.createLinearGradient(hw, h * 0.65, hw, h);
    baseGrad.addColorStop(0, rgbStr(backDark, 0));
    baseGrad.addColorStop(1, rgbStr(colors.fur, 0.85));
    ctx.fillStyle = baseGrad;
    ctx.fillRect(hw, h * 0.65, hw, h * 0.35);

    // Bright white/cream ocellus spot centered in upper-middle back of ear
    const spotCx = hw + hw * 0.5;
    const spotCy = h * 0.44;
    const spotR = hw * 0.24;
    const spotGrad = ctx.createRadialGradient(spotCx, spotCy, spotR * 0.55, spotCx, spotCy, spotR * 1.15);
    spotGrad.addColorStop(0, rgbStr([253, 250, 245], 1));
    spotGrad.addColorStop(0.76, rgbStr(colors.belly, 0.96));
    spotGrad.addColorStop(1, rgbStr(backDark, 0));
    ctx.fillStyle = spotGrad;
    ctx.beginPath();
    ctx.ellipse(spotCx, spotCy, spotR * 1.12, spotR * 0.94, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fine fur strokes over both halves
    drawFurStrokes(ctx, hw, h, kit, 450, colors.skin, colors.fur, colors.belly, false);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeLimbTexture(THREE, kit, colors) {
  // u around limb (0.5 top/outer, 0/1 underside), v along limb (0 shoulder/hip -> 1 paw tip, canvas y=h -> 0)
  const tex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    // Base fur fading to creamy paws at top (v -> 1 => canvas y -> 0)
    const lenGrad = ctx.createLinearGradient(0, h, 0, 0);
    lenGrad.addColorStop(0.0, rgbStr(colors.fur));
    lenGrad.addColorStop(0.68, rgbStr(colors.fur));
    lenGrad.addColorStop(0.84, rgbStr(mixRgb(colors.fur, colors.belly, 0.78)));
    lenGrad.addColorStop(1.0, rgbStr(colors.belly));
    ctx.fillStyle = lenGrad;
    ctx.fillRect(0, 0, w, h);

    // Lighter cream inner/under-limb gradient near u = 0 / 1
    const sideGrad = ctx.createLinearGradient(0, 0, w, 0);
    sideGrad.addColorStop(0.0, rgbStr(colors.belly, 0.72));
    sideGrad.addColorStop(0.22, rgbStr(colors.belly, 0));
    sideGrad.addColorStop(0.78, rgbStr(colors.belly, 0));
    sideGrad.addColorStop(1.0, rgbStr(colors.belly, 0.72));
    ctx.fillStyle = sideGrad;
    ctx.fillRect(0, 0, w, h);

    // Curved tiger leg stripes wrapping across upper/outer limb
    const bands = [0.24, 0.40, 0.56, 0.70, 0.82];
    bands.forEach((yf, idx) => {
      const yBase = h * yf;
      const pts = [];
      const ws = [];
      for (let k = 0; k <= 14; k++) {
        const f = k / 14;
        const x = w * (0.14 + f * 0.72);
        const arch = Math.sin(f * Math.PI) * 16;
        const n = (kit.noise(f * 3 + idx, idx * 1.9) - 0.5) * 10;
        pts.push([x, yBase + arch + n]);
        ws.push((11 - idx * 0.8) * (0.2 + 0.85 * Math.sin(f * Math.PI)));
      }
      drawTaperedStripe(ctx, pts, ws, colors.furAccent, kit, 110 + idx * 4, 0.90);
    });

    drawFurStrokes(ctx, w, h, kit, 1100, colors.fur, colors.furAccent, colors.belly, false);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeTailTexture(THREE, kit, colors) {
  // v = 0 tail base (canvas y = h), v = 1 tail tip (canvas y = 0)
  const tex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0.0, rgbStr(colors.fur));
    grad.addColorStop(0.72, rgbStr(mixRgb(colors.fur, colors.dorsal, 0.25)));
    grad.addColorStop(0.88, rgbStr(colors.furAccent));
    grad.addColorStop(1.0, rgbStr(mixRgb(colors.furAccent, [16, 12, 10], 0.35)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle paler underside along u = 0 / 1
    const under = ctx.createLinearGradient(0, 0, w, 0);
    under.addColorStop(0.0, rgbStr(colors.belly, 0.42));
    under.addColorStop(0.24, rgbStr(colors.belly, 0));
    under.addColorStop(0.76, rgbStr(colors.belly, 0));
    under.addColorStop(1.0, rgbStr(colors.belly, 0.42));
    ctx.fillStyle = under;
    ctx.fillRect(0, 0, w, h);

    // 7 distinct organic dark tiger rings wrapping all the way around the tail
    const ringCount = 7;
    for (let r = 0; r < ringCount; r++) {
      const yCenter = h * (0.86 - r * 0.112);
      const thick = 14 + (r % 2) * 3;
      const pts = [];
      const ws = [];
      for (let k = 0; k <= 20; k++) {
        const f = k / 20;
        const x = f * w;
        // Periodic wave so ring wraps seamlessly across u = 0/1!
        const ang = f * Math.PI * 2;
        const wobble = Math.sin(ang * 2 + r) * 5 + Math.cos(ang * 3 - r * 1.3) * 3;
        pts.push([x, yCenter + wobble]);
        ws.push(thick * (0.86 + 0.18 * Math.cos(ang)));
      }
      drawTaperedStripe(ctx, pts, ws, colors.furAccent, kit, 200 + r * 7, 0.96);
    }

    drawFurStrokes(ctx, w, h, kit, 1000, colors.fur, colors.furAccent, colors.belly, false);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeIrisTexture(THREE, kit, eyeRgb) {
  // LatheGeometry UV: u around circumference, v from inner pupil edge (0) to outer limbal rim (1)
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const bright = mixRgb(eyeRgb, [255, 245, 205], 0.42);
    const deep = mixRgb(eyeRgb, [22, 14, 8], 0.65);

    const g = ctx.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0.0, rgbStr(deep));
    g.addColorStop(0.18, rgbStr(eyeRgb));
    g.addColorStop(0.55, rgbStr(bright));
    g.addColorStop(0.84, rgbStr(eyeRgb));
    g.addColorStop(1.0, rgbStr(deep));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Delicate radial iris fibers
    for (let i = 0; i < 96; i++) {
      const f = i / 96;
      const x = f * w;
      const n = kit.noise(i * 0.45, 3.3);
      ctx.strokeStyle = rgbStr(n > 0.5 ? bright : deep, 0.25 + n * 0.25);
      ctx.lineWidth = 1.4 + n * 2.2;
      ctx.beginPath();
      ctx.moveTo(x, h * 0.08);
      ctx.lineTo(x + (n - 0.5) * 6, h * 0.92);
      ctx.stroke();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeBlushTexture(THREE, kit, blushRgb) {
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const g = ctx.createRadialGradient(cx, cy, w * 0.05, cx, cy, w * 0.48);
    g.addColorStop(0.0, rgbStr(blushRgb, 0.55));
    g.addColorStop(0.45, rgbStr(blushRgb, 0.30));
    g.addColorStop(1.0, rgbStr(blushRgb, 0.0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// Sculpted Anatomical Form Builders
// ---------------------------------------------------------------------------
function sculptBodyGeometry(THREE) {
  // phiStart = +PI/2 puts seam along belly bottom after (bx, by, bz) = (sx, -sz, sy)
  const geo = new THREE.SphereGeometry(1, 64, 48, Math.PI * 0.5, Math.PI * 2);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const sx = pos.getX(i);
    const sy = pos.getY(i);
    const sz = pos.getZ(i);

    // Rotate cleanly into spine-along-Z coordinates:
    // ux = left/right, uy = up/down (+1 spine, -1 belly), uz = length (+1 chest, -1 rump)
    const ux = sx;
    const uy = -sz;
    const uz = sy;

    // Half-dimensions of plump lying cub body (~0.31 m long from rump to chest)
    let x = ux * 0.086;
    let y = uy * 0.064;
    let z = uz * 0.155;

    // Haunches wider & plumper at rear, gentle waist taper, solid shoulders at front
    const rearMask = Math.exp(-Math.pow((uz + 0.52) / 0.48, 2));
    const shoulderMask = Math.exp(-Math.pow((uz - 0.52) / 0.42, 2));
    const waistMask = Math.exp(-Math.pow((uz + 0.05) / 0.34, 2));

    x *= 1 + 0.15 * rearMask + 0.05 * shoulderMask - 0.06 * waistMask;
    y += 0.011 * rearMask * Math.max(0, uy);
    y += 0.010 * shoulderMask * Math.max(0, uy);
    y -= 0.006 * waistMask * Math.max(0, uy);

    // Chest & neck rise smoothly upward at front (+z) to overlap deeply into the head
    const chestNeck = smoothstep(0.18, 0.92, uz) * smoothstep(-0.35, 0.85, uy);
    y += 0.044 * chestNeck;
    z -= 0.014 * chestNeck;

    // Soft puffy chest bib forward
    const bibMask = smoothstep(0.45, 0.98, uz) * Math.exp(-Math.pow((uy + 0.15) / 0.55, 2));
    z += 0.014 * bibMask;
    y += 0.012 * bibMask;

    // Gentle soft belly spread and flat floor contact resting on Y = 0
    y += 0.064; // base center elevation
    const groundSpread = smoothstep(0.055, 0.0, y);
    x *= 1 + 0.10 * groundSpread;

    // Softly flatten underside onto floor Y = 0.001
    if (y < 0.022) {
      const k = smoothstep(0.022, -0.02, y);
      y = y * (1 - k * 0.82) + 0.002 * k;
    }
    if (y < 0.001) y = 0.001;

    // Shift body slightly back so total cub (paws + body) sits centered near Z = 0
    z -= 0.024;

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function sculptHeadPoint(ux, uy, uz, out) {
  // Base chibi rounded cub head
  let x = ux * 0.075;
  let y = uy * 0.065;
  let z = uz * 0.066;

  // Wide fluffy cheek ruffs on lower sides
  const cheekMask =
    Math.exp(-Math.pow((uy + 0.18) / 0.34, 2)) *
    Math.exp(-Math.pow((uz - 0.15) / 0.52, 2)) *
    Math.pow(Math.abs(ux), 1.25);
  x += Math.sign(ux) * (0.0175 + 0.0022 * Math.sin(uy * 26)) * cheekMask;
  y -= 0.004 * cheekMask;

  // Soft crown dome
  const crownMask = Math.max(0, uy) * Math.exp(-Math.pow((uz + 0.08) / 0.72, 2));
  y += 0.0045 * crownMask;

  // Continuous sculpted muzzle & nose bridge
  const muzzleMask =
    Math.exp(-Math.pow(ux / 0.46, 2)) *
    Math.exp(-Math.pow((uy + 0.18) / 0.34, 2)) *
    Math.max(0, (uz - 0.34) / 0.66);
  z += 0.024 * Math.pow(muzzleMask, 0.85);

  const bridgeMask =
    Math.exp(-Math.pow(ux / 0.24, 2)) *
    Math.exp(-Math.pow((uy - 0.04) / 0.22, 2)) *
    Math.max(0, uz - 0.50);
  z += 0.011 * bridgeMask;

  // Paired plump whisker pads with a delicate philtrum groove between
  const padL =
    Math.exp(-(Math.pow((ux - 0.16) / 0.17, 2) + Math.pow((uy + 0.23) / 0.16, 2))) *
    Math.max(0, uz - 0.55);
  const padR =
    Math.exp(-(Math.pow((ux + 0.16) / 0.17, 2) + Math.pow((uy + 0.23) / 0.16, 2))) *
    Math.max(0, uz - 0.55);
  z += 0.0125 * (padL + padR);
  y -= 0.003 * (padL + padR);

  const philtrum =
    Math.exp(-(Math.pow(ux / 0.055, 2) + Math.pow((uy + 0.23) / 0.13, 2))) *
    Math.max(0, uz - 0.60);
  z -= 0.0036 * philtrum;

  // Cute small rounded chin
  const chinMask =
    Math.exp(-(Math.pow(ux / 0.23, 2) + Math.pow((uy + 0.44) / 0.16, 2))) *
    Math.max(0, uz - 0.44);
  z += 0.0085 * chinMask;
  y -= 0.005 * chinMask;

  // Slightly recessed eye sockets + soft brow ridge cushions above
  const sockL =
    Math.exp(-(Math.pow((ux - 0.41) / 0.18, 2) + Math.pow((uy - 0.08) / 0.17, 2))) *
    Math.max(0, uz - 0.45);
  const sockR =
    Math.exp(-(Math.pow((ux + 0.41) / 0.18, 2) + Math.pow((uy - 0.08) / 0.17, 2))) *
    Math.max(0, uz - 0.45);
  z -= 0.0055 * (sockL + sockR);

  const browL =
    Math.exp(-(Math.pow((ux - 0.36) / 0.20, 2) + Math.pow((uy - 0.27) / 0.12, 2))) *
    Math.max(0, uz - 0.45);
  const browR =
    Math.exp(-(Math.pow((ux + 0.36) / 0.20, 2) + Math.pow((uy - 0.27) / 0.12, 2))) *
    Math.max(0, uz - 0.45);
  z += 0.0038 * (browL + browR);
  y += 0.0022 * (browL + browR);

  // Smooth neck throat skirt at bottom-back so head melds seamlessly into chest
  const neckMask =
    Math.max(0, (-uy - 0.40) / 0.60) *
    Math.exp(-Math.pow((uz + 0.24) / 0.68, 2));
  y -= 0.025 * neckMask;
  z -= 0.011 * neckMask;

  // Offset relative to head pivot
  out.set(x, y + 0.025, z + 0.018);
  return out;
}

function sculptHeadGeometry(THREE) {
  const geo = new THREE.SphereGeometry(1, 64, 48, -Math.PI * 0.5, Math.PI * 2);
  const pos = geo.attributes.position;
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    sculptHeadPoint(pos.getX(i), pos.getY(i), pos.getZ(i), tmp);
    pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function createEarGeometry(THREE) {
  // Round tiger-cub ear built from ExtrudeGeometry with bezierCurveTo, bevelled, then cupped
  const shape = new THREE.Shape();
  shape.moveTo(-0.018, -0.004);
  shape.bezierCurveTo(-0.027, 0.010, -0.025, 0.036, -0.009, 0.043);
  shape.bezierCurveTo(0.000, 0.046, 0.009, 0.045, 0.017, 0.039);
  shape.bezierCurveTo(0.027, 0.030, 0.026, 0.009, 0.018, -0.004);
  shape.bezierCurveTo(0.008, -0.009, -0.008, -0.009, -0.018, -0.004);

  const depth = 0.0055;
  const indexed = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.0036,
    bevelSize: 0.0030,
    bevelSegments: 4,
    curveSegments: 24
  });

  // Center around z = 0 and store original z before curving
  indexed.translate(0, 0, -depth * 0.5);
  const pos = indexed.attributes.position;
  const origZ = new Float32Array(pos.count);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    origZ[i] = z;

    const nx = x / 0.026;
    const ny = clamp((y + 0.006) / 0.052, 0, 1);
    // Cup ear forward into a realistic curved scoop; pinch thickness slightly near top rim
    const cup = 0.0105 * (nx * nx) + 0.0045 * (ny * ny) - 0.002 * ny;
    const taper = 1.0 - 0.25 * ny;
    pos.setXYZ(i, x, y, z * taper + cup);
  }

  // Smooth vertex normals computed BEFORE converting to non-indexed for crisp front/back UV split
  indexed.computeVertexNormals();

  const geo = indexed.toNonIndexed();
  const nPos = geo.attributes.position;
  const uvArr = new Float32Array((nPos.count) * 2);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const fNorm = new THREE.Vector3();

  for (let i = 0; i < nPos.count; i += 3) {
    a.fromBufferAttribute(nPos, i);
    b.fromBufferAttribute(nPos, i + 1);
    c.fromBufferAttribute(nPos, i + 2);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    fNorm.crossVectors(ab, ac).normalize();

    // Front inner ear faces (+z) map to left texture half [0.02..0.48];
    // Back outer ear & bevel rim map to right texture half [0.52..0.98] (dark + white ocellus spot!)
    const isFront = fNorm.z > 0.35;
    for (let k = 0; k < 3; k++) {
      const vi = i + k;
      const vx = nPos.getX(vi);
      const vy = nPos.getY(vi);
      const uLocal = clamp((vx + 0.028) / 0.056, 0.02, 0.98);
      const vLocal = clamp((vy + 0.010) / 0.058, 0.02, 0.98);
      uvArr[vi * 2] = isFront ? uLocal * 0.46 + 0.02 : 0.52 + uLocal * 0.46;
      uvArr[vi * 2 + 1] = vLocal;
    }
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uvArr, 2));
  indexed.dispose();
  return geo;
}

function createNoseGeometry(THREE) {
  const geo = new THREE.SphereGeometry(1, 32, 24);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);

    // Classic cute rounded inverted-triangle feline cub nose
    let x = ux * 0.0115 * (1 + 0.28 * uy);
    let y = uy * 0.0080;
    let z = uz * 0.0072;

    // Gentle top flatness & philtrum notch underneath
    if (uy > 0) y *= 0.86;
    const notch = Math.exp(-Math.pow(ux / 0.24, 2)) * Math.max(0, -uy) * Math.max(0, uz);
    z -= 0.0018 * notch;
    y += 0.0012 * notch;

    // Subtle nostril dimples
    const nostL = Math.exp(-(Math.pow((ux - 0.46) / 0.20, 2) + Math.pow((uy + 0.18) / 0.22, 2))) * Math.max(0, uz);
    const nostR = Math.exp(-(Math.pow((ux + 0.46) / 0.20, 2) + Math.pow((uy + 0.18) / 0.22, 2))) * Math.max(0, uz);
    z -= 0.0015 * (nostL + nostR);

    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

// 3-layer expressive eye built with LatheGeometry (18+ points)
function buildEyeGroup(THREE, side, eyeMat, darkEyeMat, highlightMat, lashMat) {
  const eyeGroup = new THREE.Group();
  eyeGroup.name = side > 0 ? "eyeL" : "eyeR";

  // Layer 1: Dark glossy eye dome (LatheGeometry, 20 profile points)
  const orbPts = [];
  for (let i = 0; i <= 19; i++) {
    const a = (i / 19) * Math.PI; // 0 = front pole (+y lathe), PI = back pole
    const r = Math.max(1e-4, Math.sin(a) * 0.0156);
    const y = Math.cos(a) * (a < Math.PI * 0.5 ? 0.0095 : 0.0075);
    orbPts.push(new THREE.Vector2(r, y));
  }
  const orbGeo = new THREE.LatheGeometry(orbPts, 32);
  orbGeo.rotateX(Math.PI * 0.5);
  const orbMesh = new THREE.Mesh(orbGeo, darkEyeMat);
  orbMesh.userData.slot = "accent";
  eyeGroup.add(orbMesh);

  // Layer 2: Coloured iris ring hugging front curvature (LatheGeometry, 18 profile points)
  // Leaves round central opening so glossy dark orb reads as deep pupil, and dark outer rim shows
  const irisPts = [];
  const aInner = 0.46; // pupil boundary
  const aOuter = 1.18; // outer iris limbal boundary
  for (let i = 0; i <= 17; i++) {
    const f = i / 17;
    const a = aInner + f * (aOuter - aInner);
    const r = Math.sin(a) * 0.0159;
    const y = Math.cos(a) * 0.0099 + 0.0003;
    irisPts.push(new THREE.Vector2(r, y));
  }
  const irisGeo = new THREE.LatheGeometry(irisPts, 32);
  irisGeo.rotateX(Math.PI * 0.5);
  const irisMesh = new THREE.Mesh(irisGeo, eyeMat);
  irisMesh.userData.slot = "eye";
  eyeGroup.add(irisMesh);

  // Layer 3: Two crisp glossy white highlight dots placed up and to one side (same light side!)
  const dotBigGeo = new THREE.SphereGeometry(0.0034, 14, 10);
  dotBigGeo.scale(1.0, 1.0, 0.45);
  const dotBig = new THREE.Mesh(dotBigGeo, highlightMat);
  dotBig.position.set(0.0046, 0.0052, 0.0094);
  dotBig.rotation.set(-0.32, 0.30, 0);
  dotBig.userData.slot = "glow";
  eyeGroup.add(dotBig);

  const dotSmallGeo = new THREE.SphereGeometry(0.0017, 12, 8);
  dotSmallGeo.scale(1.0, 1.0, 0.45);
  const dotSmall = new THREE.Mesh(dotSmallGeo, highlightMat);
  dotSmall.position.set(-0.0042, -0.0038, 0.0096);
  dotSmall.rotation.set(0.24, -0.25, 0);
  dotSmall.userData.slot = "glow";
  eyeGroup.add(dotSmall);

  // Subtle curved dark upper lash/eyelid rim
  const lashCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-side * 0.0155, 0.0005, 0.0030),
    new THREE.Vector3(-side * 0.0085, 0.0128, 0.0055),
    new THREE.Vector3(0.0, 0.0158, 0.0058),
    new THREE.Vector3(side * 0.0098, 0.0126, 0.0048),
    new THREE.Vector3(side * 0.0168, 0.0028, 0.0018)
  ]);
  const lashGeo = createTaperedTube(THREE, lashCurve, {
    tubularSegments: 20,
    radialSegments: 8,
    radiusFn: (t) => 0.0008 + 0.0016 * Math.sin(t * Math.PI)
  });
  const lashMesh = new THREE.Mesh(lashGeo, lashMat);
  lashMesh.userData.slot = "furAccent";
  eyeGroup.add(lashMesh);

  return eyeGroup;
}

function buildPawDetails(THREE, pawPos, forwardDir, upDir, sideDir, padMat, clawMat, parent) {
  // Subtle rounded toe-pad beans underneath + 3 tiny tucked glossy cream claws
  const f = forwardDir.clone().normalize();
  const u = upDir.clone().normalize();
  const s = sideDir.clone().normalize();

  // Main central pad underneath
  const mainPadGeo = new THREE.SphereGeometry(0.010, 14, 10);
  mainPadGeo.scale(1.15, 0.35, 0.95);
  const mainPad = new THREE.Mesh(mainPadGeo, padMat);
  mainPad.position.copy(pawPos).addScaledVector(u, -0.015).addScaledVector(f, -0.006);
  mainPad.userData.slot = "skin";
  parent.add(mainPad);

  // 3 cute toe beans & tiny tucked claws
  const clawGeo = new THREE.ConeGeometry(0.0020, 0.0065, 8);
  clawGeo.rotateX(Math.PI * 0.5);
  const beanGeo = new THREE.SphereGeometry(0.0046, 10, 8);
  beanGeo.scale(1.0, 0.42, 1.15);

  for (let i = -1; i <= 1; i++) {
    const spread = i * 0.0115;
    const fwdOff = i === 0 ? 0.025 : 0.021;

    const bean = new THREE.Mesh(beanGeo, padMat);
    bean.position
      .copy(pawPos)
      .addScaledVector(s, spread * 0.85)
      .addScaledVector(f, fwdOff * 0.55)
      .addScaledVector(u, -0.0155);
    bean.userData.slot = "skin";
    parent.add(bean);

    const claw = new THREE.Mesh(clawGeo, clawMat);
    claw.position
      .copy(pawPos)
      .addScaledVector(s, spread)
      .addScaledVector(f, fwdOff)
      .addScaledVector(u, -0.0075);
    claw.lookAt(claw.position.clone().add(f).addScaledVector(u, -0.35).addScaledVector(s, i * 0.14));
    claw.userData.slot = "accent";
    parent.add(claw);
  }
}

// ---------------------------------------------------------------------------
// Main Build Export
// ---------------------------------------------------------------------------
export function build(THREE, opts = {}, kit) {
  const colors = resolveColors(opts);
  const root = new THREE.Group();
  root.name = "tiger-cub";

  // Procedural textures
  const furBump = makeFurBumpTexture(THREE, kit, 512, 256, true);
  const bodyMap = makeBodyTexture(THREE, kit, colors);
  const headMap = makeHeadTexture(THREE, kit, colors);
  const earMap = makeEarTexture(THREE, kit, colors);
  const limbMap = makeLimbTexture(THREE, kit, colors);
  const tailMap = makeTailTexture(THREE, kit, colors);
  const irisMap = makeIrisTexture(THREE, kit, colors.eye);
  const blushMap = makeBlushTexture(THREE, kit, colors.blush);

  // Plush fur MeshPhysicalMaterials (roughness 0.88-0.94, warm sheen)
  const makeFurMat = (map, bumpScale = 0.0018) =>
    new THREE.MeshPhysicalMaterial({
      map,
      bumpMap: furBump,
      bumpScale,
      roughness: 0.91,
      metalness: 0.0,
      sheen: 0.85,
      sheenRoughness: 0.72,
      sheenColor: new THREE.Color(rgbStr(colors.sheen))
    });

  const bodyMat = makeFurMat(bodyMap, 0.0020);
  const headMat = makeFurMat(headMap, 0.0016);
  const earMat = makeFurMat(earMap, 0.0014);
  const limbMat = makeFurMat(limbMap, 0.0016);
  const tailMat = makeFurMat(tailMap, 0.0018);

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(rgbStr(colors.skin)),
    roughness: 0.44,
    metalness: 0.0,
    clearcoat: 0.32,
    clearcoatRoughness: 0.35,
    sheen: 0.25,
    sheenColor: new THREE.Color("#ffd8d6")
  });

  const darkEyeMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#100c0b"),
    roughness: 0.05,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03
  });

  const irisMat = new THREE.MeshPhysicalMaterial({
    map: irisMap,
    roughness: 0.12,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04
  });

  const highlightMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#ffffff"),
    emissive: new THREE.Color("#ffffff"),
    emissiveIntensity: 0.55,
    roughness: 0.05,
    clearcoat: 1.0
  });

  const darkLineMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(rgbStr(colors.furAccent)),
    roughness: 0.78,
    metalness: 0.0,
    sheen: 0.45,
    sheenColor: new THREE.Color(rgbStr(colors.sheen))
  });

  const whiskerMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(rgbStr(mixRgb(colors.belly, [255, 255, 255], 0.65))),
    roughness: 0.35,
    metalness: 0.0,
    clearcoat: 0.3
  });

  const clawMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(rgbStr(colors.claw)),
    roughness: 0.22,
    metalness: 0.0,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12
  });

  const blushMat = new THREE.MeshPhysicalMaterial({
    map: blushMap,
    transparent: true,
    depthWrite: false,
    roughness: 0.92,
    metalness: 0.0
  });

  // -------------------------------------------------------------------------
  // 1. BODY (continuous sculpted torso resting softly on the floor)
  // -------------------------------------------------------------------------
  const bodyGroup = new THREE.Group();
  bodyGroup.name = "body";
  const bodyGeo = sculptBodyGeometry(THREE);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.userData.slot = "fur";
  bodyGroup.add(bodyMesh);
  root.add(bodyGroup);

  // -------------------------------------------------------------------------
  // 2. HEAD (continuous sculpted cranium, cheeks, muzzle, sockets, chin)
  // -------------------------------------------------------------------------
  const headGroup = new THREE.Group();
  headGroup.name = "head";
  headGroup.position.set(0, 0.130, 0.072);
  // Gentle curious pose asymmetry: head held up, slightly tilted & turned
  headGroup.rotation.set(-0.07, -0.14, 0.11);
  headGroup.userData.base = {
    pos: headGroup.position.clone(),
    rot: headGroup.rotation.clone()
  };

  const headGeo = sculptHeadGeometry(THREE);
  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headMesh.userData.slot = "fur";
  headGroup.add(headMesh);

  // 3-layer expressive eyes nestled into sculpted sockets
  const eyeCenter = new THREE.Vector3();
  const eyeNormal = new THREE.Vector3();
  const sampleA = new THREE.Vector3();
  const sampleB = new THREE.Vector3();
  for (const side of [-1, 1]) {
    const dir = new THREE.Vector3(side * 0.41, 0.08, 0.908).normalize();
    sculptHeadPoint(dir.x, dir.y, dir.z, eyeCenter);
    // Estimate local outward normal on the sculpted face
    const d1 = dir.clone().add(new THREE.Vector3(0.02, 0, 0)).normalize();
    const d2 = dir.clone().add(new THREE.Vector3(0, 0.02, 0)).normalize();
    sculptHeadPoint(d1.x, d1.y, d1.z, sampleA).sub(eyeCenter);
    sculptHeadPoint(d2.x, d2.y, d2.z, sampleB).sub(eyeCenter);
    eyeNormal.crossVectors(sampleA, sampleB).normalize();

    const eye = buildEyeGroup(THREE, side, irisMat, darkEyeMat, highlightMat, darkLineMat);
    // Slightly inset into socket so eye never floats
    eye.position.copy(eyeCenter).addScaledVector(eyeNormal, -0.0022);
    eye.lookAt(eye.position.clone().add(eyeNormal));
    eye.userData.baseScaleY = 1;
    headGroup.add(eye);
  }

  // Sculpted cute pink feline nose
  const nosePos = new THREE.Vector3();
  sculptHeadPoint(0, -0.10, 0.995, nosePos);
  const noseMesh = new THREE.Mesh(createNoseGeometry(THREE), skinMat);
  noseMesh.position.copy(nosePos).add(new THREE.Vector3(0, 0.001, 0.0022));
  noseMesh.rotation.x = 0.14;
  noseMesh.castShadow = true;
  noseMesh.receiveShadow = true;
  noseMesh.userData.slot = "skin";
  headGroup.add(noseMesh);

  // Curved feline "w" smile mouth built from thin tapered tubes hugging the muzzle
  const philtrumTop = nosePos.clone().add(new THREE.Vector3(0, -0.0045, 0.0015));
  const philtrumBot = new THREE.Vector3();
  sculptHeadPoint(0, -0.25, 0.968, philtrumBot).add(new THREE.Vector3(0, 0, 0.0012));

  const stemCurve = new THREE.CatmullRomCurve3([
    philtrumTop,
    philtrumTop.clone().lerp(philtrumBot, 0.5).add(new THREE.Vector3(0, 0, 0.0015)),
    philtrumBot
  ]);
  const stemMesh = new THREE.Mesh(
    createTaperedTube(THREE, stemCurve, {
      tubularSegments: 10,
      radialSegments: 8,
      radiusFn: () => 0.0013
    }),
    darkLineMat
  );
  stemMesh.userData.slot = "furAccent";
  headGroup.add(stemMesh);

  for (const side of [-1, 1]) {
    const m1 = new THREE.Vector3();
    const m2 = new THREE.Vector3();
    const m3 = new THREE.Vector3();
    sculptHeadPoint(side * 0.09, -0.32, 0.943, m1).add(new THREE.Vector3(0, 0, 0.0018));
    sculptHeadPoint(side * 0.19, -0.31, 0.931, m2).add(new THREE.Vector3(0, 0, 0.0018));
    sculptHeadPoint(side * 0.27, -0.24, 0.932, m3).add(new THREE.Vector3(0, 0, 0.0014));
    const smileCurve = new THREE.CatmullRomCurve3([philtrumBot, m1, m2, m3]);
    const smileMesh = new THREE.Mesh(
      createTaperedTube(THREE, smileCurve, {
        tubularSegments: 18,
        radialSegments: 8,
        radiusFn: (t) => 0.0014 * (1 - 0.35 * t)
      }),
      darkLineMat
    );
    smileMesh.userData.slot = "furAccent";
    headGroup.add(smileMesh);
  }

  // Subtle curved blush discs hugging the cheeks below the eyes
  const blushGeo = new THREE.CircleGeometry(0.017, 20);
  const bPosAttr = blushGeo.attributes.position;
  for (let i = 0; i < bPosAttr.count; i++) {
    const bx = bPosAttr.getX(i);
    const by = bPosAttr.getY(i);
    bPosAttr.setXYZ(i, bx * 1.15, by * 0.72, -(bx * bx + by * by) * 6.5);
  }
  blushGeo.computeVertexNormals();
  for (const side of [-1, 1]) {
    const bDir = new THREE.Vector3(side * 0.56, -0.10, 0.822).normalize();
    const bPos = new THREE.Vector3();
    sculptHeadPoint(bDir.x, bDir.y, bDir.z, bPos);
    const blushDisc = new THREE.Mesh(blushGeo, blushMat);
    blushDisc.position.copy(bPos).addScaledVector(bDir, 0.0014);
    blushDisc.lookAt(blushDisc.position.clone().add(bDir));
    blushDisc.userData.slot = "skin";
    headGroup.add(blushDisc);
  }

  // Delicate tapered whiskers (3 per cheek + 2 tiny brow whiskers per side)
  for (const side of [-1, 1]) {
    const cheekWhiskers = [
      { dy: -0.19, dz: 0.96, dx: 0.20, len: 0.052, droop: -0.006, sweep: -0.010 },
      { dy: -0.23, dz: 0.95, dx: 0.22, len: 0.058, droop: -0.012, sweep: -0.014 },
      { dy: -0.27, dz: 0.94, dx: 0.20, len: 0.048, droop: -0.016, sweep: -0.012 }
    ];
    for (const wCfg of cheekWhiskers) {
      const p0 = new THREE.Vector3();
      sculptHeadPoint(side * wCfg.dx, wCfg.dy, wCfg.dz, p0);
      const p1 = p0.clone().add(new THREE.Vector3(side * wCfg.len * 0.48, wCfg.droop * 0.3, wCfg.sweep * 0.3));
      const p2 = p0.clone().add(new THREE.Vector3(side * wCfg.len, wCfg.droop, wCfg.sweep));
      const wGeo = createTaperedTube(THREE, new THREE.CatmullRomCurve3([p0, p1, p2]), {
        tubularSegments: 10,
        radialSegments: 6,
        radiusFn: (t) => 0.00085 * (1 - 0.78 * t),
        capStart: false,
        capEnd: true,
        capRings: 2
      });
      const wMesh = new THREE.Mesh(wGeo, whiskerMat);
      wMesh.userData.slot = "accent";
      headGroup.add(wMesh);
    }

    // 2 cute tiny eyebrow whiskers per side
    for (let k = 0; k < 2; k++) {
      const bp0 = new THREE.Vector3();
      sculptHeadPoint(side * (0.31 + k * 0.06), 0.27 + k * 0.02, 0.91, bp0);
      const bp1 = bp0.clone().add(new THREE.Vector3(side * 0.011, 0.011, 0.004));
      const bp2 = bp0.clone().add(new THREE.Vector3(side * 0.022, 0.018 - k * 0.003, 0.003));
      const bwGeo = createTaperedTube(THREE, new THREE.CatmullRomCurve3([bp0, bp1, bp2]), {
        tubularSegments: 8,
        radialSegments: 5,
        radiusFn: (t) => 0.00065 * (1 - 0.75 * t),
        capStart: false,
        capEnd: true,
        capRings: 2
      });
      const bwMesh = new THREE.Mesh(bwGeo, whiskerMat);
      bwMesh.userData.slot = "accent";
      headGroup.add(bwMesh);
    }
  }

  // Round ears with soft pink inside and iconic white round spots behind
  const earGeo = createEarGeometry(THREE);
  for (const side of [-1, 1]) {
    const earGroup = new THREE.Group();
    earGroup.name = side > 0 ? "earL" : "earR";
    earGroup.position.set(side * 0.050, 0.072, 0.012);
    // Subtle asymmetry in ear cock
    earGroup.rotation.set(
      0.16 + (side < 0 ? 0.05 : 0.0),
      side * 0.30,
      -side * (0.44 + (side < 0 ? 0.07 : 0.0))
    );
    earGroup.userData.base = { rot: earGroup.rotation.clone() };

    const earMesh = new THREE.Mesh(earGeo, earMat);
    earMesh.castShadow = true;
    earMesh.receiveShadow = true;
    earMesh.userData.slot = "fur";
    earGroup.add(earMesh);

    headGroup.add(earGroup);
  }

  root.add(headGroup);

  // -------------------------------------------------------------------------
  // 3. FRONT LIMBS (armL resting forward on ground, armR gently raised paw)
  // -------------------------------------------------------------------------
  // Left front leg (resting solidly forward on floor)
  const armLGroup = new THREE.Group();
  armLGroup.name = "armL";
  const armLCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.050, 0.088, 0.056),
    new THREE.Vector3(0.068, 0.044, 0.095),
    new THREE.Vector3(0.068, 0.025, 0.156),
    new THREE.Vector3(0.060, 0.021, 0.220)
  ]);
  const armLGeo = createTaperedTube(THREE, armLCurve, {
    tubularSegments: 44,
    radialSegments: 22,
    radiusFn: (t) => {
      const shoulder = 0.045 * Math.pow(1 - t, 1.5);
      const limb = 0.026 * (1 - 0.12 * t);
      const pawSwell = 0.010 * Math.exp(-Math.pow((t - 0.92) / 0.12, 2));
      return shoulder * 0.45 + limb + pawSwell;
    },
    shapeFn: (p, t) => {
      // Broaden chunky cub paw horizontally & sculpt subtle toe lobes
      const pawMask = smoothstep(0.76, 0.98, t);
      if (pawMask > 0) {
        const cx = 0.060;
        const dx = p.x - cx;
        p.x = cx + dx * (1 + 0.24 * pawMask);
        // Flatten paw softly vertically
        p.y = 0.021 + (p.y - 0.021) * (1 - 0.24 * pawMask);
      }
      // Smooth floor contact along forearm & paw
      if (p.y < 0.012 && t > 0.28) {
        const k = smoothstep(0.012, -0.02, p.y);
        p.y = p.y * (1 - k * 0.85) + 0.001 * k;
      }
      if (p.y < 0.001) p.y = 0.001;
    },
    capBulgeEnd: 0.72
  });
  const armLMesh = new THREE.Mesh(armLGeo, limbMat);
  armLMesh.castShadow = true;
  armLMesh.receiveShadow = true;
  armLMesh.userData.slot = "fur";
  armLGroup.add(armLMesh);
  buildPawDetails(
    THREE,
    new THREE.Vector3(0.060, 0.019, 0.222),
    new THREE.Vector3(-0.08, 0, 1),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(1, 0, 0.08),
    skinMat,
    clawMat,
    armLGroup
  );
  armLGroup.userData.base = { rot: armLGroup.rotation.clone(), pos: armLGroup.position.clone() };
  root.add(armLGroup);

  // Right front leg (playful gentle asymmetry: forearm forward, paw softly raised & curled!)
  const armRGroup = new THREE.Group();
  armRGroup.name = "armR";
  // Pivot near shoulder so gentle paw wave in idle() moves naturally
  armRGroup.position.set(-0.052, 0.086, 0.056);
  const armRCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.000, 0.002, 0.000),
    new THREE.Vector3(-0.016, -0.044, 0.042),
    new THREE.Vector3(-0.016, -0.058, 0.096),
    new THREE.Vector3(-0.003, -0.049, 0.136),
    new THREE.Vector3(0.013, -0.042, 0.160)
  ]);
  const armRGeo = createTaperedTube(THREE, armRCurve, {
    tubularSegments: 44,
    radialSegments: 22,
    radiusFn: (t) => {
      const shoulder = 0.045 * Math.pow(1 - t, 1.5);
      const limb = 0.026 * (1 - 0.12 * t);
      const pawSwell = 0.010 * Math.exp(-Math.pow((t - 0.92) / 0.12, 2));
      return shoulder * 0.45 + limb + pawSwell;
    },
    shapeFn: (p, t) => {
      const pawMask = smoothstep(0.76, 0.98, t);
      if (pawMask > 0) {
        const cx = 0.013;
        p.x = cx + (p.x - cx) * (1 + 0.18 * pawMask);
      }
      // Elbow/mid-forearm kisses the floor cleanly (world y = p.y + 0.086)
      const wy = p.y + 0.086;
      if (wy < 0.012 && t > 0.25 && t < 0.72) {
        const k = smoothstep(0.012, -0.02, wy);
        p.y = (wy * (1 - k * 0.85) + 0.001 * k) - 0.086;
      }
      if (p.y + 0.086 < 0.001) p.y = 0.001 - 0.086;
    },
    capBulgeEnd: 0.72
  });
  const armRMesh = new THREE.Mesh(armRGeo, limbMat);
  armRMesh.castShadow = true;
  armRMesh.receiveShadow = true;
  armRMesh.userData.slot = "fur";
  armRGroup.add(armRMesh);
  buildPawDetails(
    THREE,
    new THREE.Vector3(0.014, -0.042, 0.162),
    new THREE.Vector3(0.45, 0.18, 0.87),
    new THREE.Vector3(-0.28, 0.94, -0.18),
    new THREE.Vector3(0.85, 0.28, -0.44),
    skinMat,
    clawMat,
    armRGroup
  );
  armRGroup.userData.base = { rot: armRGroup.rotation.clone(), pos: armRGroup.position.clone() };
  root.add(armRGroup);

  // -------------------------------------------------------------------------
  // 4. HIND LIMBS (legL, legR folded cozily against the lying haunches)
  // -------------------------------------------------------------------------
  for (const side of [-1, 1]) {
    const legGroup = new THREE.Group();
    legGroup.name = side > 0 ? "legL" : "legR";
    const legCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.056, 0.072, -0.112),
      new THREE.Vector3(side * 0.092, 0.044, -0.122),
      new THREE.Vector3(side * 0.096, 0.024, -0.068),
      new THREE.Vector3(side * 0.088, 0.021, -0.012)
    ]);
    const legGeo = createTaperedTube(THREE, legCurve, {
      tubularSegments: 40,
      radialSegments: 22,
      radiusFn: (t) => {
        const haunch = 0.044 * Math.exp(-Math.pow((t - 0.20) / 0.34, 2));
        const base = 0.022 * (1 - 0.08 * t);
        const paw = 0.0085 * Math.exp(-Math.pow((t - 0.92) / 0.14, 2));
        return haunch * 0.65 + base + paw;
      },
      shapeFn: (p, t) => {
        // Tuck inner side cleanly into body flank & flatten underside on floor
        const pawMask = smoothstep(0.75, 0.98, t);
        if (pawMask > 0) {
          p.y = 0.021 + (p.y - 0.021) * (1 - 0.22 * pawMask);
        }
        if (p.y < 0.012 && t > 0.22) {
          const k = smoothstep(0.012, -0.02, p.y);
          p.y = p.y * (1 - k * 0.85) + 0.001 * k;
        }
        if (p.y < 0.001) p.y = 0.001;
      },
      capBulgeEnd: 0.72
    });
    const legMesh = new THREE.Mesh(legGeo, limbMat);
    legMesh.castShadow = true;
    legMesh.receiveShadow = true;
    legMesh.userData.slot = "fur";
    legGroup.add(legMesh);

    buildPawDetails(
      THREE,
      new THREE.Vector3(side * 0.088, 0.019, -0.010),
      new THREE.Vector3(-side * 0.14, 0, 0.99),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(side * 0.99, 0, 0.14),
      skinMat,
      clawMat,
      legGroup
    );
    legGroup.userData.base = { rot: legGroup.rotation.clone(), pos: legGroup.position.clone() };
    root.add(legGroup);
  }

  // -------------------------------------------------------------------------
  // 5. LONG RINGED CURLED TAIL (tapered tube sweeping behind & around side)
  // -------------------------------------------------------------------------
  const tailGroup = new THREE.Group();
  tailGroup.name = "tail";
  tailGroup.position.set(0.0, 0.048, -0.158);
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.000, 0.006, 0.028),
    new THREE.Vector3(-0.014, -0.024, -0.044),
    new THREE.Vector3(-0.072, -0.032, -0.086),
    new THREE.Vector3(-0.138, -0.031, -0.052),
    new THREE.Vector3(-0.172, -0.026, 0.022),
    new THREE.Vector3(-0.166, -0.004, 0.092)
  ]);
  const tailGeo = createTaperedTube(THREE, tailCurve, {
    tubularSegments: 64,
    radialSegments: 18,
    radiusFn: (t) => {
      // Thick plush cub tail tapering softly with a slightly fluffy rounded tip
      const taper = 0.0235 - 0.0065 * t;
      const tipFluff = 0.0028 * Math.exp(-Math.pow((t - 0.90) / 0.14, 2));
      return taper + tipFluff;
    },
    shapeFn: (p) => {
      // Gently keep floor-resting tail segments above Y = 0
      const wy = p.y + 0.048;
      if (wy < 0.001) p.y = 0.001 - 0.048;
    },
    capBulgeEnd: 1.05
  });
  const tailMesh = new THREE.Mesh(tailGeo, tailMat);
  tailMesh.castShadow = true;
  tailMesh.receiveShadow = true;
  tailMesh.userData.slot = "fur";
  tailGroup.add(tailMesh);
  tailGroup.userData.base = { rot: tailGroup.rotation.clone(), pos: tailGroup.position.clone() };
  root.add(tailGroup);

  return root;
}

// ---------------------------------------------------------------------------
// Idle Animation Export (breathing, head sway, ear twitch, tail sway, blink)
// ---------------------------------------------------------------------------
export function idle(group, t) {
  if (!group) return;

  const body = group.getObjectByName("body");
  const head = group.getObjectByName("head");
  const tail = group.getObjectByName("tail");
  const earL = group.getObjectByName("earL");
  const earR = group.getObjectByName("earR");
  const armR = group.getObjectByName("armR");
  const eyeL = group.getObjectByName("eyeL");
  const eyeR = group.getObjectByName("eyeR");

  // 1. Soft cozy breathing (~0.45 Hz)
  const breath = Math.sin(t * 2.75);
  if (body) {
    body.scale.set(1 + breath * 0.012, 1 + breath * 0.022, 1 + breath * 0.008);
  }

  // 2. Gentle curious head sway + breathing ride
  if (head && head.userData.base) {
    const bPos = head.userData.base.pos;
    const bRot = head.userData.base.rot;
    head.position.set(bPos.x, bPos.y + breath * 0.0022, bPos.z);
    head.rotation.set(
      bRot.x + Math.sin(t * 1.15) * 0.032 + breath * 0.010,
      bRot.y + Math.sin(t * 0.68) * 0.075,
      bRot.z + Math.sin(t * 0.92 + 0.8) * 0.042
    );
  }

  // 3. Occasional playful ear flicks
  if (earL && earL.userData.base) {
    const cycleL = t % 5.4;
    const flickL = cycleL < 0.35 ? Math.sin((cycleL / 0.35) * Math.PI) * 0.14 : 0;
    earL.rotation.set(
      earL.userData.base.rot.x + flickL * 0.5,
      earL.userData.base.rot.y,
      earL.userData.base.rot.z - flickL - Math.sin(t * 1.4) * 0.025
    );
  }
  if (earR && earR.userData.base) {
    const cycleR = (t + 2.3) % 6.7;
    const flickR = cycleR < 0.32 ? Math.sin((cycleR / 0.32) * Math.PI) * 0.16 : 0;
    earR.rotation.set(
      earR.userData.base.rot.x + flickR * 0.5,
      earR.userData.base.rot.y,
      earR.userData.base.rot.z + flickR + Math.sin(t * 1.3 + 1.1) * 0.025
    );
  }

  // 4. Lazy rhythmic curled tail sway
  if (tail && tail.userData.base) {
    const bRot = tail.userData.base.rot;
    tail.rotation.set(
      bRot.x + Math.sin(t * 1.65) * 0.028,
      bRot.y + Math.sin(t * 1.25) * 0.095 + Math.sin(t * 2.5) * 0.025,
      bRot.z + Math.cos(t * 1.25) * 0.018
    );
  }

  // 5. Gentle bob on the slightly raised front paw
  if (armR && armR.userData.base) {
    const bRot = armR.userData.base.rot;
    armR.rotation.set(
      bRot.x + Math.sin(t * 1.55 + 0.4) * 0.035,
      bRot.y,
      bRot.z + Math.sin(t * 1.15) * 0.018
    );
  }

  // 6. Natural blink every ~3.8 seconds by scaling eye groups on Y
  const blinkPeriod = 3.8;
  const phase = t % blinkPeriod;
  let eyeScaleY = 1.0;
  if (phase > 3.56 && phase < 3.74) {
    const k = Math.sin(((phase - 3.56) / 0.18) * Math.PI);
    eyeScaleY = 1.0 - 0.92 * k;
  }
  if (eyeL) eyeL.scale.y = eyeScaleY;
  if (eyeR) eyeR.scale.y = eyeScaleY;
}
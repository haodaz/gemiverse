export const META = {
  id: 'fox-spirit-lantern',
  name: 'Sleeping Fox Spirit & Lantern',
  kind: 'creature',
  footprint: [0.30, 0.29],
  variants: ['Round Lantern', 'Square Lantern', 'Tall Lantern'],
  note: 'Stylised chibi fox spirit curled asleep around a glowing standing wooden-frame washi paper lantern.'
};

const TAU = Math.PI * 2;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function toColor(THREE, val, fallback) {
  const c = new THREE.Color();
  try {
    c.set(val !== undefined && val !== null ? val : fallback);
  } catch {
    c.set(fallback);
  }
  return c;
}

function colorToSRGB(c) {
  const hex = c.getHex();
  return {
    r: (hex >> 16) & 255,
    g: (hex >> 8) & 255,
    b: hex & 255
  };
}

function mixRGB(a, b, t) {
  const k = clamp(t, 0, 1);
  return {
    r: Math.round(lerp(a.r, b.r, k)),
    g: Math.round(lerp(a.g, b.g, k)),
    b: Math.round(lerp(a.b, b.b, k))
  };
}

function scaleRGB(a, factor) {
  return {
    r: clamp(Math.round(a.r * factor), 0, 255),
    g: clamp(Math.round(a.g * factor), 0, 255),
    b: clamp(Math.round(a.b * factor), 0, 255)
  };
}

function rgba(c, a = 1) {
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

function tintThreeColor(THREE, c, targetHex, amount) {
  const out = c.clone();
  const target = new THREE.Color(targetHex);
  return out.lerp(target, amount);
}

/**
 * Builds a closed tapered tube ring-by-ring along a CatmullRomCurve3 using
 * twist-free parallel transport frames and smooth rounded caps.
 */
function createTaperedTube(THREE, curve, tubularSegs, radialSegs, radiusFn, deformFn, opts = {}) {
  const capStart = opts.capStart !== false;
  const capEnd = opts.capEnd !== false;
  const capRings = 2;

  const ts = [];
  for (let i = 0; i <= tubularSegs; i++) {
    ts.push(i / tubularSegs);
  }

  const pts = ts.map((t) => curve.getPoint(t));
  const tangents = ts.map((t) => curve.getTangent(t).normalize());

  // Parallel transport frames
  const normals = [];
  const binormals = [];
  const upRef = Math.abs(tangents[0].y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const n0 = new THREE.Vector3().crossVectors(tangents[0], upRef).normalize();
  const b0 = new THREE.Vector3().crossVectors(tangents[0], n0).normalize();
  normals.push(n0);
  binormals.push(b0);

  const axis = new THREE.Vector3();
  const q = new THREE.Quaternion();
  for (let i = 1; i <= tubularSegs; i++) {
    const prevT = tangents[i - 1];
    const currT = tangents[i];
    const prevN = normals[i - 1].clone();
    const dot = clamp(prevT.dot(currT), -1, 1);
    if (dot < 0.999999) {
      axis.crossVectors(prevT, currT);
      if (axis.lengthSq() > 1e-10) {
        axis.normalize();
        const angle = Math.acos(dot);
        q.setFromAxisAngle(axis, angle);
        prevN.applyQuaternion(q);
      }
    }
    prevN.addScaledVector(currT, -prevN.dot(currT)).normalize();
    const currB = new THREE.Vector3().crossVectors(currT, prevN).normalize();
    normals.push(prevN);
    binormals.push(currB);
  }

  const rings = [];
  const ringVs = [];

  function pushRing(center, normal, binormal, tangent, rBase, tParam, vCoord) {
    const ring = [];
    for (let j = 0; j <= radialSegs; j++) {
      const u = j / radialSegs;
      const ang = u * TAU;
      let r = rBase;
      let yOffset = 0;
      if (deformFn) {
        const res = deformFn(tParam, ang, rBase, center, normal, binormal, tangent);
        if (typeof res === 'number') {
          r = res;
        } else if (res) {
          r = res.r !== undefined ? res.r : rBase;
          yOffset = res.yOffset || 0;
        }
      }
      const vx = center.x + (Math.cos(ang) * normal.x + Math.sin(ang) * binormal.x) * r;
      let vy = center.y + (Math.cos(ang) * normal.y + Math.sin(ang) * binormal.y) * r + yOffset;
      const vz = center.z + (Math.cos(ang) * normal.z + Math.sin(ang) * binormal.z) * r;
      if (opts.minY !== undefined && vy < opts.minY) {
        vy = opts.minY + (vy - opts.minY) * 0.08;
      }
      ring.push(vx, vy, vz);
    }
    rings.push(ring);
    ringVs.push(vCoord);
  }

  if (capStart) {
    const r0 = Math.max(0.0005, radiusFn(0));
    const c0 = pts[0];
    const t0 = tangents[0];
    for (let k = capRings; k >= 1; k--) {
      const f = k / (capRings + 1);
      const offset = -r0 * 0.52 * f;
      const rCap = r0 * Math.sqrt(Math.max(0.02, 1 - f * f));
      const pCap = c0.clone().addScaledVector(t0, offset);
      pushRing(pCap, normals[0], binormals[0], t0, rCap, 0, 0);
    }
  }

  for (let i = 0; i <= tubularSegs; i++) {
    const t = ts[i];
    const r = Math.max(0.0004, radiusFn(t));
    pushRing(pts[i], normals[i], binormals[i], tangents[i], r, t, t);
  }

  if (capEnd) {
    const r1 = Math.max(0.0005, radiusFn(1));
    const c1 = pts[tubularSegs];
    const t1 = tangents[tubularSegs];
    for (let k = 1; k <= capRings; k++) {
      const f = k / (capRings + 1);
      const offset = r1 * 0.52 * f;
      const rCap = r1 * Math.sqrt(Math.max(0.02, 1 - f * f));
      const pCap = c1.clone().addScaledVector(t1, offset);
      pushRing(pCap, normals[tubularSegs], binormals[tubularSegs], t1, rCap, 1, 1);
    }
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const stride = radialSegs + 1;

  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    const v = ringVs[i];
    for (let j = 0; j <= radialSegs; j++) {
      positions.push(ring[j * 3], ring[j * 3 + 1], ring[j * 3 + 2]);
      uvs.push(j / radialSegs, v);
    }
  }

  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, d, b, d, c, b);
    }
  }

  if (capStart) {
    const r0 = Math.max(0.0005, radiusFn(0));
    const pTip = pts[0].clone().addScaledVector(tangents[0], -r0 * 0.56);
    if (opts.minY !== undefined && pTip.y < opts.minY) pTip.y = opts.minY;
    const tipIdx = positions.length / 3;
    positions.push(pTip.x, pTip.y, pTip.z);
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(tipIdx, j + 1, j);
    }
  }

  if (capEnd) {
    const r1 = Math.max(0.0005, radiusFn(1));
    const pTip = pts[tubularSegs].clone().addScaledVector(tangents[tubularSegs], r1 * 0.56);
    if (opts.minY !== undefined && pTip.y < opts.minY) pTip.y = opts.minY;
    const tipIdx = positions.length / 3;
    positions.push(pTip.x, pTip.y, pTip.z);
    uvs.push(0.5, 1);
    const lastRing = (rings.length - 1) * stride;
    for (let j = 0; j < radialSegs; j++) {
      indices.push(tipIdx, lastRing + j, lastRing + j + 1);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Exact continuous head surface displacement in local head space.
 * Used both to sculpt the head SphereGeometry and to seat eyes, nose, blush,
 * mouth, and whiskers flush onto the face with zero floating gaps.
 */
function sculptHeadDirection(nx, ny, nz, out) {
  const rx = 0.0435;
  const ry = 0.0385;
  const rz = 0.0430;

  let x = nx * rx;
  let y = ny * ry;
  let z = nz * rz;

  // Slightly fuller lower cranium & softly tapered dome
  const crownTaper = 1 - 0.11 * smoothstep(0.15, 0.95, ny);
  x *= crownTaper;
  z *= 1 - 0.06 * smoothstep(0.25, 0.95, ny);

  // Continuous tapered fox muzzle emerging from lower front face
  const dMuzzle = Math.hypot(nx * 1.18, (ny + 0.21) * 1.38);
  const muzzleMask = Math.exp(-dMuzzle * dMuzzle * 3.1) * smoothstep(0.02, 0.65, nz);
  const snoutTip = Math.exp(-(nx * nx * 6.5 + (ny + 0.24) * (ny + 0.24) * 7.5)) * smoothstep(0.45, 0.95, nz);
  z += 0.0225 * muzzleMask + 0.0055 * snoutTip;
  x *= 1 - 0.34 * muzzleMask;
  y -= 0.0045 * muzzleMask;

  // Delicate nasal bridge crest
  const bridge = Math.exp(-nx * nx * 18) * smoothstep(-0.18, 0.16, ny) * smoothstep(0.55, 0.92, nz);
  z += 0.0024 * bridge;
  y += 0.0012 * bridge;

  // Plush fox cheek ruffs with subtle twin fur-tuft scallops
  const absX = Math.abs(nx);
  const dCheek = Math.hypot((absX - 0.80) * 1.4, (ny + 0.23) * 1.65, (nz - 0.12) * 1.3);
  const cheekMask = Math.exp(-dCheek * dCheek * 2.4);
  const tuftWave = 1 + 0.16 * Math.cos((ny + 0.22) * 16.0);
  x += Math.sign(nx) * 0.0115 * cheekMask * tuftWave;
  z -= 0.0025 * cheekMask;
  y -= 0.0022 * cheekMask;

  // Soft eye-socket recesses so 3-layer eyes nestle naturally into the skull
  const eyeSocketL = Math.hypot((nx + 0.43) * 2.5, (ny - 0.05) * 2.8, (nz - 0.78) * 2.2);
  const eyeSocketR = Math.hypot((nx - 0.43) * 2.5, (ny - 0.05) * 2.8, (nz - 0.78) * 2.2);
  const socketIndent = (Math.exp(-eyeSocketL * eyeSocketL * 1.9) + Math.exp(-eyeSocketR * eyeSocketR * 1.9)) * smoothstep(0.35, 0.75, nz);
  z -= 0.0040 * socketIndent;

  // Gentle expressive brow ridge over the eyes
  const browL = Math.hypot((nx + 0.38) * 2.4, (ny - 0.27) * 3.8, (nz - 0.78) * 2.0);
  const browR = Math.hypot((nx - 0.38) * 2.4, (ny - 0.27) * 3.8, (nz - 0.78) * 2.0);
  const browMask = (Math.exp(-browL * browL * 2.2) + Math.exp(-browR * browR * 2.2)) * smoothstep(0.3, 0.75, nz);
  z += 0.0022 * browMask;
  y += 0.0016 * browMask;

  // Subtle ear root pads for seamless ear attachment
  const earPadL = Math.hypot((nx + 0.56) * 2.2, (ny - 0.72) * 2.4, (nz + 0.04) * 2.2);
  const earPadR = Math.hypot((nx - 0.56) * 2.2, (ny - 0.72) * 2.4, (nz + 0.04) * 2.2);
  const earPad = Math.exp(-earPadL * earPadL * 2.5) + Math.exp(-earPadR * earPadR * 2.5);
  y += 0.0028 * earPad;

  // Gentle chin flattening and neck underside blend
  const chinFlat = smoothstep(-0.48, -0.95, ny);
  y += 0.0050 * chinFlat;

  out.set(x, y, z);
  return out;
}

function estimateHeadNormal(THREE, nx, ny, nz) {
  const dir = new THREE.Vector3(nx, ny, nz).normalize();
  const up = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const t1 = new THREE.Vector3().crossVectors(dir, up).normalize();
  const t2 = new THREE.Vector3().crossVectors(dir, t1).normalize();
  const eps = 0.015;
  const p0 = sculptHeadDirection(dir.x, dir.y, dir.z, new THREE.Vector3());
  const d1 = dir.clone().addScaledVector(t1, eps).normalize();
  const d2 = dir.clone().addScaledVector(t2, eps).normalize();
  const p1 = sculptHeadDirection(d1.x, d1.y, d1.z, new THREE.Vector3());
  const p2 = sculptHeadDirection(d2.x, d2.y, d2.z, new THREE.Vector3());
  const n = new THREE.Vector3().crossVectors(p1.sub(p0), p2.sub(p0)).normalize();
  if (n.dot(dir) < 0) n.negate();
  return n;
}

/**
 * Procedural CanvasTexture suite driven from opts and kit.noise.
 */
function createTextures(THREE, kit, palette) {
  const { furRGB, accentRGB, eyeRGB, glowRGB } = palette;
  const darkFurRGB = scaleRGB(mixRGB(furRGB, { r: 72, g: 30, b: 14 }, 0.45), 0.72);
  const richFurRGB = scaleRGB(furRGB, 0.92);
  const earTipRGB = mixRGB(furRGB, { r: 38, g: 24, b: 20 }, 0.78);
  const sockRGB = mixRGB(furRGB, { r: 44, g: 26, b: 20 }, 0.72);
  const spiritMarkRGB = { r: 214, g: 64, b: 48 };

  // Shared fur bump texture
  const furBump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const n1 = kit.noise(x * 0.09, y * 0.03);
        const n2 = kit.noise(x * 0.25 + 17, y * 0.09 + 5);
        const v = clamp(Math.round(108 + (n1 * 0.65 + n2 * 0.35) * 44), 60, 195);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
    ctx.lineWidth = 1;
    for (let i = 0; i < 900; i++) {
      const fx = kit.noise(i * 1.37, 3.1) * w;
      const fy = kit.noise(i * 2.13, 9.7) * h;
      const len = 5 + kit.noise(i * 0.71, 14.2) * 10;
      const light = kit.noise(i * 3.1, 2.2) > 0.5;
      ctx.strokeStyle = light ? 'rgba(215,215,215,0.22)' : 'rgba(55,55,55,0.22)';
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + (kit.noise(i, 1.5) - 0.5) * 2.5, fy + len);
      ctx.stroke();
    }
  });
  furBump.wrapS = THREE.RepeatWrapping;
  furBump.wrapT = THREE.RepeatWrapping;
  furBump.repeat.set(3, 3);

  // Head fur map painted in exact 3D sphere direction space
  const headMap = kit.canvasTexture(512, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let py = 0; py < h; py++) {
      const theta = (py / (h - 1)) * Math.PI;
      const sinT = Math.sin(theta);
      const ny = Math.cos(theta);
      for (let px = 0; px < w; px++) {
        const phi = (px / w) * TAU;
        const nx = -Math.cos(phi) * sinT;
        const nz = Math.sin(phi) * sinT;

        const nFine = kit.noise(px * 0.14, py * 0.24);
        const nBroad = kit.noise(px * 0.03 + 4.1, py * 0.05 + 2.3);
        const jitter = (nFine - 0.5) * 0.12 + (nBroad - 0.5) * 0.08;

        // Base dorsal darkening on crown & back
        const crownShade = smoothstep(0.15, 0.9, ny) * 0.35 + smoothstep(-0.1, -0.85, nz) * 0.2;
        let col = mixRGB(furRGB, darkFurRGB, clamp(crownShade + (nBroad - 0.5) * 0.18, 0, 0.55));

        // Creamy fox cheek, chin & muzzle underside mask
        const absX = Math.abs(nx);
        const cheekLine = -0.10 + 0.18 * smoothstep(0.35, 0.88, absX) - 0.12 * smoothstep(0.65, 0.98, nz);
        let creamMask = smoothstep(cheekLine + 0.14, cheekLine - 0.12, ny + jitter * 0.45);
        creamMask *= smoothstep(-0.55, 0.15, nz);

        // Keep top bridge of fox snout warm orange
        const snoutTop = Math.exp(-nx * nx * 12) * smoothstep(-0.18, 0.12, ny) * smoothstep(0.50, 0.92, nz);
        creamMask *= 1 - 0.92 * snoutTop;

        // Soft cream muzzle lip pads under nose
        const lipPad = Math.exp(-((absX - 0.14) * (absX - 0.14) * 14 + (ny + 0.34) * (ny + 0.34) * 16)) * smoothstep(0.55, 0.9, nz);
        creamMask = clamp(Math.max(creamMask, lipPad * 0.95), 0, 1);

        col = mixRGB(col, accentRGB, creamMask);

        // Iconic cute cream eyebrow pips above eyes
        const browPipL = Math.hypot((nx + 0.26) * 6.2, (ny - 0.34) * 8.2, (nz - 0.87) * 3.0);
        const browPipR = Math.hypot((nx - 0.26) * 6.2, (ny - 0.34) * 8.2, (nz - 0.87) * 3.0);
        const pipMask = smoothstep(1.05, 0.45, Math.min(browPipL, browPipR)) * smoothstep(0.5, 0.8, nz);
        col = mixRGB(col, accentRGB, pipMask * 0.82);

        // Subtle fox-spirit crimson forehead teardrop mark
        const dyMark = (ny - 0.44) * 7.8;
        const dxMark = nx * (11.5 - clamp(dyMark, -1, 1) * 2.5);
        const markDist = Math.hypot(dxMark, dyMark);
        const markMask = smoothstep(1.0, 0.35, markDist) * smoothstep(0.65, 0.92, nz);
        col = mixRGB(col, spiritMarkRGB, markMask * 0.72);

        // Fine fur grain brightness modulation
        const grain = 0.93 + nFine * 0.13;
        const idx = (py * w + px) * 4;
        data[idx] = clamp(Math.round(col.r * grain), 0, 255);
        data[idx + 1] = clamp(Math.round(col.g * grain), 0, 255);
        data[idx + 2] = clamp(Math.round(col.b * grain), 0, 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Subtle directional brush strokes for plush fur texture
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 650; i++) {
      const fx = kit.noise(i * 1.19, 4.7) * w;
      const fy = kit.noise(i * 2.31, 8.3) * h;
      const len = 5 + kit.noise(i * 0.93, 1.1) * 9;
      ctx.strokeStyle = kit.noise(i * 3.7, 5.1) > 0.5 ? rgba(accentRGB, 0.11) : rgba(darkFurRGB, 0.12);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + (kit.noise(i, 6.2) - 0.5) * 4, fy + len);
      ctx.stroke();
    }
  });
  headMap.colorSpace = THREE.SRGBColorSpace;

  // Body fur map: v runs along spine (top=shoulder, bottom=rump), u runs around torso cross-section
  const bodyMap = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let py = 0; py < h; py++) {
      const t = py / (h - 1); // 0 shoulder, 1 rump
      for (let px = 0; px < w; px++) {
        const u = px / w;
        const phi = u * TAU;
        // In our body cross-section, cos(phi) = outward radial, sin(phi) = up (+y)
        const outDir = Math.cos(phi);
        const upDir = Math.sin(phi);

        const n1 = kit.noise(px * 0.05, py * 0.09);
        const n2 = kit.noise(px * 0.18 + 9.2, py * 0.14 + 3.4);

        // Darker russet dorsal stripe along the curled spine (upDir > 0.4)
        const dorsal = smoothstep(0.25, 0.92, upDir + outDir * 0.25) * smoothstep(0.05, 0.22, t) * smoothstep(1.0, 0.85, t);
        let col = mixRGB(furRGB, darkFurRGB, clamp(dorsal * 0.58 + (n1 - 0.5) * 0.14, 0, 0.65));

        // Soft cream belly & inner-curl chest
        const belly = smoothstep(-0.18, -0.78, upDir + (n1 - 0.5) * 0.18);
        const chest = smoothstep(0.24, 0.02, t) * smoothstep(-0.2, 0.5, -outDir);
        col = mixRGB(col, accentRGB, clamp(Math.max(belly * 0.85, chest * 0.78), 0, 0.9));

        const grain = 0.92 + n2 * 0.15;
        const idx = (py * w + px) * 4;
        data[idx] = clamp(Math.round(col.r * grain), 0, 255);
        data[idx + 1] = clamp(Math.round(col.g * grain), 0, 255);
        data[idx + 2] = clamp(Math.round(col.b * grain), 0, 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Longitudinal fur flecks following the curled back
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 900; i++) {
      const fx = kit.noise(i * 1.71, 2.9) * w;
      const fy = kit.noise(i * 2.53, 7.1) * h;
      const len = 7 + kit.noise(i * 0.87, 11.4) * 12;
      ctx.strokeStyle = kit.noise(i * 4.1, 1.3) > 0.48 ? rgba(accentRGB, 0.11) : rgba(darkFurRGB, 0.14);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + (kit.noise(i, 3.8) - 0.5) * 3, fy + len);
      ctx.stroke();
    }
  });
  bodyMap.colorSpace = THREE.SRGBColorSpace;
  bodyMap.wrapS = THREE.RepeatWrapping;

  // Tail fur map: v=0 base, v=1 lush cream tip with jagged feathery fur transition
  const tailMap = kit.canvasTexture(256, 512, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let py = 0; py < h; py++) {
      // Canvas y=0 corresponds to v=1 (tip), y=h-1 corresponds to v=0 (base)
      const v = 1 - py / (h - 1);
      for (let px = 0; px < w; px++) {
        const u = px / w;
        const n1 = kit.noise(px * 0.08, py * 0.05);
        const n2 = kit.noise(px * 0.22 + 5.1, py * 0.16 + 2.7);
        const zig = Math.sin(u * TAU * 6) * 0.045 + (n1 - 0.5) * 0.08;

        const baseShade = smoothstep(0.0, 0.45, v);
        let col = mixRGB(darkFurRGB, furRGB, 0.35 + 0.65 * baseShade);
        const tipMask = smoothstep(0.60 + zig, 0.72 + zig, v);
        col = mixRGB(col, accentRGB, tipMask);

        const grain = 0.92 + n2 * 0.15;
        const idx = (py * w + px) * 4;
        data[idx] = clamp(Math.round(col.r * grain), 0, 255);
        data[idx + 1] = clamp(Math.round(col.g * grain), 0, 255);
        data[idx + 2] = clamp(Math.round(col.b * grain), 0, 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    ctx.lineWidth = 1.5;
    for (let i = 0; i < 650; i++) {
      const fx = kit.noise(i * 1.43, 6.2) * w;
      const fy = kit.noise(i * 2.89, 1.7) * h;
      const len = 8 + kit.noise(i * 0.61, 8.9) * 14;
      ctx.strokeStyle = fy < h * 0.36 ? rgba(furRGB, 0.12) : rgba(darkFurRGB, 0.14);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + (kit.noise(i, 9.1) - 0.5) * 2.5, fy - len);
      ctx.stroke();
    }
  });
  tailMap.colorSpace = THREE.SRGBColorSpace;
  tailMap.wrapS = THREE.RepeatWrapping;

  // Outer ear map: warm fur grading into smoky dark fox ear tips
  const earMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let py = 0; py < h; py++) {
      const v = 1 - py / (h - 1); // 0 base, 1 tip
      for (let px = 0; px < w; px++) {
        const n = kit.noise(px * 0.12, py * 0.18);
        const tipMask = smoothstep(0.46 + (n - 0.5) * 0.09, 0.86, v);
        const col = mixRGB(richFurRGB, earTipRGB, tipMask);
        const grain = 0.93 + n * 0.13;
        const idx = (py * w + px) * 4;
        data[idx] = clamp(Math.round(col.r * grain), 0, 255);
        data[idx + 1] = clamp(Math.round(col.g * grain), 0, 255);
        data[idx + 2] = clamp(Math.round(col.b * grain), 0, 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  earMap.colorSpace = THREE.SRGBColorSpace;

  // Limb map: warm fur fading to dark espresso "fox socks" on lower paws
  const limbMap = kit.canvasTexture(128, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let py = 0; py < h; py++) {
      const v = 1 - py / (h - 1); // 0 shoulder, 1 paw tip
      for (let px = 0; px < w; px++) {
        const n = kit.noise(px * 0.14, py * 0.12);
        const sockMask = smoothstep(0.50 + (n - 0.5) * 0.08, 0.82, v);
        const col = mixRGB(furRGB, sockRGB, sockMask);
        const grain = 0.93 + n * 0.14;
        const idx = (py * w + px) * 4;
        data[idx] = clamp(Math.round(col.r * grain), 0, 255);
        data[idx + 1] = clamp(Math.round(col.g * grain), 0, 255);
        data[idx + 2] = clamp(Math.round(col.b * grain), 0, 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  limbMap.colorSpace = THREE.SRGBColorSpace;
  limbMap.wrapS = THREE.RepeatWrapping;

  // Stylized multi-tone glossy iris texture painted from opts.eye
  const irisMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const rMax = w * 0.48;
    const darkEye = scaleRGB(eyeRGB, 0.25);
    const brightEye = mixRGB(eyeRGB, { r: 255, g: 245, b: 205 }, 0.58);

    ctx.fillStyle = rgba(darkEye, 1);
    ctx.fillRect(0, 0, w, h);

    // Base iris gradient
    const g = ctx.createRadialGradient(cx, cy, rMax * 0.18, cx, cy, rMax);
    g.addColorStop(0.0, rgba(scaleRGB(eyeRGB, 0.4), 1));
    g.addColorStop(0.45, rgba(eyeRGB, 1));
    g.addColorStop(0.82, rgba(scaleRGB(eyeRGB, 0.62), 1));
    g.addColorStop(1.0, rgba(darkEye, 1));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rMax, 0, TAU);
    ctx.fill();

    // Warm lower luminous crescent
    const cg = ctx.createRadialGradient(cx, cy + rMax * 0.28, rMax * 0.05, cx, cy + rMax * 0.22, rMax * 0.58);
    cg.addColorStop(0, rgba(brightEye, 0.85));
    cg.addColorStop(0.6, rgba(brightEye, 0.28));
    cg.addColorStop(1, rgba(brightEye, 0));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cx, cy, rMax * 0.85, 0, TAU);
    ctx.fill();

    // Delicate radial iris fibers
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * TAU;
      const n = kit.noise(Math.cos(a) * 4 + 5, Math.sin(a) * 4 + 5);
      ctx.strokeStyle = n > 0.5 ? rgba(brightEye, 0.24) : rgba(darkEye, 0.26);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * rMax * 0.34, cy + Math.sin(a) * rMax * 0.34);
      ctx.lineTo(cx + Math.cos(a) * rMax * 0.88, cy + Math.sin(a) * rMax * 0.88);
      ctx.stroke();
    }

    // Crisp glossy dark pupil
    ctx.fillStyle = '#120d0c';
    ctx.beginPath();
    ctx.arc(cx, cy - rMax * 0.04, rMax * 0.38, 0, TAU);
    ctx.fill();
  });
  irisMap.colorSpace = THREE.SRGBColorSpace;

  // Soft cheek blush texture
  const blushMap = kit.canvasTexture(128, 128, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, w * 0.46);
    g.addColorStop(0, 'rgba(238,118,108,0.68)');
    g.addColorStop(0.55, 'rgba(238,128,114,0.34)');
    g.addColorStop(1, 'rgba(238,136,120,0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  blushMap.colorSpace = THREE.SRGBColorSpace;

  // Warm cedar wood grain map + bump for lantern frame
  const woodMap = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const base = { r: 104, g: 64, b: 39 };
    const dark = { r: 62, g: 35, b: 20 };
    const light = { r: 136, g: 88, b: 54 };
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const warp = kit.noise(px * 0.015, py * 0.008) * 14;
        const ring = Math.sin((px * 0.14 + warp) * 0.9) * 0.5 + 0.5;
        const streak = kit.noise(px * 0.22, py * 0.025);
        let col = mixRGB(dark, base, 0.35 + ring * 0.65);
        col = mixRGB(col, light, streak * 0.35);
        const idx = (py * w + px) * 4;
        data[idx] = col.r;
        data[idx + 1] = col.g;
        data[idx + 2] = col.b;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  woodMap.colorSpace = THREE.SRGBColorSpace;
  woodMap.wrapS = THREE.RepeatWrapping;
  woodMap.wrapT = THREE.RepeatWrapping;

  const woodBump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const warp = kit.noise(px * 0.03, py * 0.015) * 10;
        const ring = Math.sin((px * 0.28 + warp) * 0.9) * 0.5 + 0.5;
        const fine = kit.noise(px * 0.4, py * 0.05);
        const v = clamp(Math.round(90 + ring * 55 + fine * 35), 40, 220);
        const idx = (py * w + px) * 4;
        data[idx] = v;
        data[idx + 1] = v;
        data[idx + 2] = v;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  woodBump.wrapS = THREE.RepeatWrapping;
  woodBump.wrapT = THREE.RepeatWrapping;

  // Handmade washi mulberry paper textures (diffuse, warm internal glow emissive, fiber bump)
  const paperBase = mixRGB({ r: 248, g: 236, b: 210 }, glowRGB, 0.22);
  const paperEdge = mixRGB({ r: 222, g: 196, b: 158 }, glowRGB, 0.16);

  const paperMap = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let py = 0; py < h; py++) {
      const v = 1 - py / (h - 1);
      const edgeFade = smoothstep(0.0, 0.18, v) * smoothstep(1.0, 0.82, v);
      for (let px = 0; px < w; px++) {
        const n1 = kit.noise(px * 0.04, py * 0.04);
        const n2 = kit.noise(px * 0.16 + 7.2, py * 0.16 + 3.1);
        const col = mixRGB(paperEdge, paperBase, clamp(edgeFade * 0.78 + n1 * 0.22, 0, 1));
        const mod = 0.94 + n2 * 0.10;
        const idx = (py * w + px) * 4;
        data[idx] = clamp(Math.round(col.r * mod), 0, 255);
        data[idx + 1] = clamp(Math.round(col.g * mod), 0, 255);
        data[idx + 2] = clamp(Math.round(col.b * mod), 0, 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Fine organic mulberry paper fibers
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 420; i++) {
      const x0 = kit.noise(i * 1.91, 2.3) * w;
      const y0 = kit.noise(i * 2.77, 8.9) * h;
      const ang = kit.noise(i * 0.63, 4.4) * TAU;
      const len = 8 + kit.noise(i * 1.13, 6.5) * 18;
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(195,165,125,0.22)' : 'rgba(255,250,238,0.34)';
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(
        x0 + Math.cos(ang + 0.4) * len * 0.5,
        y0 + Math.sin(ang + 0.4) * len * 0.5,
        x0 + Math.cos(ang) * len,
        y0 + Math.sin(ang) * len
      );
      ctx.stroke();
    }
  });
  paperMap.colorSpace = THREE.SRGBColorSpace;
  paperMap.wrapS = THREE.RepeatWrapping;

  const paperEmissive = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const coreGlow = mixRGB(glowRGB, { r: 255, g: 248, b: 222 }, 0.42);
    const rimGlow = scaleRGB(mixRGB(glowRGB, { r: 220, g: 112, b: 36 }, 0.45), 0.56);
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let py = 0; py < h; py++) {
      const v = 1 - py / (h - 1);
      // Warmest near candle height (v ~ 0.42)
      const dist = Math.abs(v - 0.44);
      const centerHeat = Math.exp(-dist * dist * 5.8);
      for (let px = 0; px < w; px++) {
        const pulp = kit.noise(px * 0.08, py * 0.08) * 0.16 + kit.noise(px * 0.25, py * 0.25) * 0.08;
        const k = clamp(centerHeat * 0.88 + pulp, 0, 1);
        const col = mixRGB(rimGlow, coreGlow, k);
        const idx = (py * w + px) * 4;
        data[idx] = col.r;
        data[idx + 1] = col.g;
        data[idx + 2] = col.b;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  paperEmissive.colorSpace = THREE.SRGBColorSpace;
  paperEmissive.wrapS = THREE.RepeatWrapping;

  const paperBump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const n = kit.noise(x * 0.12, y * 0.12);
        const v = clamp(Math.round(112 + n * 34), 90, 175);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
    ctx.lineWidth = 1;
    for (let i = 0; i < 320; i++) {
      const x0 = kit.noise(i * 1.31, 5.1) * w;
      const y0 = kit.noise(i * 2.19, 3.7) * h;
      const a = kit.noise(i * 0.77, 1.9) * TAU;
      const len = 6 + kit.noise(i * 1.4, 9.2) * 12;
      ctx.strokeStyle = 'rgba(210,210,210,0.35)';
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + Math.cos(a) * len, y0 + Math.sin(a) * len);
      ctx.stroke();
    }
  });
  paperBump.wrapS = THREE.RepeatWrapping;
  paperBump.wrapT = THREE.RepeatWrapping;

  return {
    furBump,
    headMap,
    bodyMap,
    tailMap,
    earMap,
    limbMap,
    irisMap,
    blushMap,
    woodMap,
    woodBump,
    paperMap,
    paperEmissive,
    paperBump
  };
}

/**
 * Builds a curved, bevelled fox ear from an ExtrudeGeometry with vertex bending.
 */
function createBentEarGeometry(THREE, scaleX, scaleY, depth, cupAmount, archAmount) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.50 * scaleX, 0);
  shape.bezierCurveTo(
    -0.56 * scaleX, 0.36 * scaleY,
    -0.30 * scaleX, 0.78 * scaleY,
    0.0, 1.0 * scaleY
  );
  shape.bezierCurveTo(
    0.30 * scaleX, 0.78 * scaleY,
    0.56 * scaleX, 0.36 * scaleY,
    0.50 * scaleX, 0
  );
  shape.bezierCurveTo(
    0.22 * scaleX, -0.07 * scaleY,
    -0.22 * scaleX, -0.07 * scaleY,
    -0.50 * scaleX, 0
  );

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.42,
    bevelSize: scaleX * 0.06,
    bevelSegments: 4,
    curveSegments: 20,
    steps: 6
  });

  geom.translate(0, 0, -depth * 0.5);

  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const vNorm = clamp(y / scaleY, 0, 1);
    const uNorm = clamp(x / (scaleX * 0.56), -1, 1);

    // Taper thickness smoothly toward the delicate ear tip
    const thicknessTaper = 1 - 0.62 * smoothstep(0.25, 1.0, vNorm);
    z *= thicknessTaper;

    // Transverse ear-conch cupping (edges curve forward, center recedes)
    z += cupAmount * (uNorm * uNorm - 0.35) * (1 - 0.35 * vNorm);

    // Gentle longitudinal arch
    z += archAmount * Math.sin(vNorm * Math.PI);

    // Soft flare at the ear root so it merges deeply into the head
    x *= 1 + 0.08 * (1 - vNorm);

    pos.setXYZ(i, x, y, z);
    uv.setXY(i, uNorm * 0.5 + 0.5, vNorm);
  }
  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds a sculpted chibi fox paw with softly lobed toes and flattened underside.
 */
function createSculptedPawGeometry(THREE, length, width, height) {
  const geom = new THREE.SphereGeometry(1, 32, 22);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    let x = nx * width;
    let y = ny * height;
    let z = nz * length;

    // Slight front flare & 3 soft toe-lobe scallops along front edge
    const frontMask = smoothstep(0.15, 0.92, nz);
    const toeWave = Math.cos(nx * Math.PI * 3.0) * 0.5 + 0.5;
    z += frontMask * 0.0022 * toeWave;
    y += frontMask * 0.0010 * toeWave * smoothstep(-0.3, 0.5, ny);

    // Flatten paw underside so it rests cleanly on ground/wood
    if (ny < -0.25) {
      y = lerp(y, -height * 0.55, smoothstep(-0.25, -0.95, ny));
    }

    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds the standing wooden-frame glowing washi paper lantern (3 variants).
 */
function buildLantern(THREE, opts, mats, glowColor, lanternCenter) {
  const variant = ((opts.variant | 0) % 3 + 3) % 3;
  const lantern = new THREE.Group();
  lantern.name = 'lantern';
  lantern.position.set(lanternCenter.x, 0, lanternCenter.z);

  const woodMat = mats.wood;
  const paperMat = mats.paper;
  const brassMat = mats.brass;
  const flameMat = mats.flame;
  const flameHaloMat = mats.flameHalo;

  function tagMesh(mesh, slot) {
    mesh.userData.slot = slot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  let lightY = 0.118;
  let flameY = 0.072;

  if (variant === 0) {
    // Variant 0: Round Chochin Standing Lantern with turned base, curved wood ribs & brass bail
    const baseProfile = [
      [0.000, 0.004], [0.036, 0.004], [0.044, 0.006], [0.049, 0.011],
      [0.050, 0.017], [0.047, 0.021], [0.043, 0.022], [0.045, 0.025],
      [0.044, 0.028], [0.038, 0.030], [0.034, 0.032], [0.035, 0.036],
      [0.032, 0.039], [0.026, 0.040], [0.018, 0.038], [0.010, 0.037],
      [0.000, 0.037]
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const baseGeom = new THREE.LatheGeometry(baseProfile, 36);
    lantern.add(tagMesh(new THREE.Mesh(baseGeom, woodMat), 'secondary'));

    // 4 carved wooden feet under the turned plinth
    const footGeom = new THREE.BoxGeometry(0.012, 0.007, 0.016);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI * 0.25;
      const foot = tagMesh(new THREE.Mesh(footGeom, woodMat), 'secondary');
      foot.position.set(Math.cos(a) * 0.038, 0.0035, Math.sin(a) * 0.038);
      foot.rotation.y = -a + Math.PI * 0.5;
      lantern.add(foot);
    }

    // Globular ribbed washi paper shade (LatheGeometry, 34 points)
    const shadePts = [];
    const y0 = 0.036;
    const y1 = 0.194;
    const nPts = 34;
    for (let i = 0; i <= nPts; i++) {
      const t = i / nPts;
      const y = lerp(y0, y1, t);
      const bulge = Math.sin(t * Math.PI);
      const rib = Math.sin(t * Math.PI * 10) * 0.0011 * bulge;
      const r = 0.033 + 0.030 * Math.pow(bulge, 0.78) + rib;
      shadePts.push(new THREE.Vector2(r, y));
    }
    const shadeGeom = new THREE.LatheGeometry(shadePts, 44);
    const shadeMesh = tagMesh(new THREE.Mesh(shadeGeom, paperMat), 'glow');
    shadeMesh.castShadow = false;
    lantern.add(shadeMesh);

    // 4 curved wooden frame ribs hugging the paper globe
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI * 0.25;
      const cA = Math.cos(a);
      const sA = Math.sin(a);
      const ribPts = [];
      for (let k = 0; k <= 10; k++) {
        const t = k / 10;
        const y = lerp(0.025, 0.202, t);
        const bulge = Math.sin(t * Math.PI);
        const r = 0.037 + 0.030 * Math.pow(bulge, 0.78);
        ribPts.push(new THREE.Vector3(cA * r, y, sA * r));
      }
      const ribCurve = new THREE.CatmullRomCurve3(ribPts);
      const ribGeom = createTaperedTube(THREE, ribCurve, 22, 8, (t) => 0.0030 - 0.0005 * Math.sin(t * Math.PI));
      lantern.add(tagMesh(new THREE.Mesh(ribGeom, woodMat), 'secondary'));
    }

    // Turned wooden top crown cap & finial (LatheGeometry, 18 points)
    const capProfile = [
      [0.033, 0.190], [0.041, 0.193], [0.043, 0.198], [0.040, 0.203],
      [0.034, 0.205], [0.029, 0.208], [0.022, 0.212], [0.015, 0.214],
      [0.011, 0.217], [0.012, 0.221], [0.008, 0.225], [0.005, 0.228],
      [0.006, 0.232], [0.004, 0.236], [0.002, 0.239], [0.000, 0.240]
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const capGeom = new THREE.LatheGeometry(capProfile, 36);
    lantern.add(tagMesh(new THREE.Mesh(capGeom, woodMat), 'secondary'));

    // Curved brass carrying bail handle
    const bailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.036, 0.202, 0),
      new THREE.Vector3(-0.044, 0.224, 0),
      new THREE.Vector3(-0.026, 0.246, 0),
      new THREE.Vector3(0.0, 0.252, 0),
      new THREE.Vector3(0.026, 0.246, 0),
      new THREE.Vector3(0.044, 0.224, 0),
      new THREE.Vector3(0.036, 0.202, 0)
    ]);
    const bailGeom = createTaperedTube(THREE, bailCurve, 28, 10, () => 0.0020);
    const bail = tagMesh(new THREE.Mesh(bailGeom, brassMat), 'primary');
    bail.rotation.y = 0.45;
    lantern.add(bail);

    lightY = 0.118;
    flameY = 0.068;
  } else if (variant === 1) {
    // Variant 1: Classic Square Andon Standing Wooden-Frame Lantern
    lantern.rotation.y = 0.16;
    const hw = 0.044;

    // Bevelled wooden base plinth & 4 corner feet
    const plinth = tagMesh(new THREE.Mesh(new THREE.BoxGeometry(hw * 2.18, 0.014, hw * 2.18), woodMat), 'secondary');
    plinth.position.y = 0.015;
    lantern.add(plinth);

    const upperPlinth = tagMesh(new THREE.Mesh(new THREE.BoxGeometry(hw * 1.98, 0.009, hw * 1.98), woodMat), 'secondary');
    upperPlinth.position.y = 0.026;
    lantern.add(upperPlinth);

    const footGeom = new THREE.BoxGeometry(0.015, 0.009, 0.015);
    const postGeom = new THREE.BoxGeometry(0.0085, 0.184, 0.0085);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const foot = tagMesh(new THREE.Mesh(footGeom, woodMat), 'secondary');
        foot.position.set(sx * (hw * 0.92), 0.0045, sz * (hw * 0.92));
        lantern.add(foot);

        const post = tagMesh(new THREE.Mesh(postGeom, woodMat), 'secondary');
        post.position.set(sx * (hw * 0.90), 0.121, sz * (hw * 0.90));
        lantern.add(post);
      }
    }

    // Horizontal rails & delicate wooden kumiko lattice bars on all 4 faces
    const railHGeom = new THREE.BoxGeometry(hw * 1.88, 0.007, 0.007);
    const latticeHGeom = new THREE.BoxGeometry(hw * 1.78, 0.0032, 0.0032);
    const latticeVGeom = new THREE.BoxGeometry(0.0032, 0.172, 0.0032);
    const panelGeom = new THREE.PlaneGeometry(hw * 1.72, 0.174, 8, 12);

    for (let side = 0; side < 4; side++) {
      const face = new THREE.Group();
      face.rotation.y = side * Math.PI * 0.5;
      const zFace = hw * 0.90;

      // Glowing recessed washi panel
      const panel = tagMesh(new THREE.Mesh(panelGeom, paperMat), 'glow');
      panel.position.set(0, 0.121, zFace - 0.0022);
      panel.castShadow = false;
      face.add(panel);

      // Top & bottom frame rails
      for (const yRail of [0.034, 0.208]) {
        const rail = tagMesh(new THREE.Mesh(railHGeom, woodMat), 'secondary');
        rail.position.set(0, yRail, zFace);
        face.add(rail);
      }

      // Decorative kumiko bars
      for (const yLat of [0.068, 0.174]) {
        const lat = tagMesh(new THREE.Mesh(latticeHGeom, woodMat), 'secondary');
        lat.position.set(0, yLat, zFace + 0.0005);
        face.add(lat);
      }
      const vBar = tagMesh(new THREE.Mesh(latticeVGeom, woodMat), 'secondary');
      vBar.position.set(0, 0.121, zFace + 0.0005);
      face.add(vBar);

      lantern.add(face);
    }

    // Subtle curved pagoda roof cap (sculpted overhanging eave pyramid)
    const roofGeom = new THREE.BoxGeometry(hw * 2.38, 0.020, hw * 2.38, 12, 4, 12);
    const rPos = roofGeom.attributes.position;
    for (let i = 0; i < rPos.count; i++) {
      let x = rPos.getX(i);
      let y = rPos.getY(i);
      let z = rPos.getZ(i);
      const ax = Math.abs(x) / (hw * 1.19);
      const az = Math.abs(z) / (hw * 1.19);
      const edge = Math.max(ax, az);
      if (y > 0) {
        const taper = 1 - 0.42 * (y / 0.010);
        x *= taper;
        z *= taper;
        y += (1 - edge) * 0.012;
      }
      // Subtle upturned pagoda corners
      y += 0.0045 * Math.pow(ax * az, 1.5);
      rPos.setXYZ(i, x, y, z);
    }
    rPos.needsUpdate = true;
    roofGeom.computeVertexNormals();
    const roof = tagMesh(new THREE.Mesh(roofGeom, woodMat), 'secondary');
    roof.position.y = 0.222;
    lantern.add(roof);

    // Turned wooden spire finial (LatheGeometry, 18 points)
    const spireProfile = [
      [0.022, 0.232], [0.019, 0.236], [0.014, 0.239], [0.011, 0.242],
      [0.012, 0.246], [0.009, 0.249], [0.006, 0.251], [0.007, 0.255],
      [0.005, 0.258], [0.003, 0.261], [0.001, 0.263], [0.000, 0.264],
      [0.000, 0.264], [0.000, 0.264], [0.000, 0.264], [0.000, 0.264]
    ].slice(0, 12).map(([r, y]) => new THREE.Vector2(r, y));
    // Pad smoothly to >= 16 points
    const fullSpire = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      const y = lerp(0.230, 0.262, t);
      const r = (1 - t) * 0.020 * (1 + 0.25 * Math.sin(t * Math.PI * 5));
      fullSpire.push(new THREE.Vector2(Math.max(0, r), y));
    }
    lantern.add(tagMesh(new THREE.Mesh(new THREE.LatheGeometry(fullSpire, 28), woodMat), 'secondary'));

    // Brass corner ring finial
    const ringGeom = new THREE.TorusGeometry(0.007, 0.0016, 10, 22);
    const topRing = tagMesh(new THREE.Mesh(ringGeom, brassMat), 'primary');
    topRing.position.y = 0.266;
    lantern.add(topRing);

    lightY = 0.122;
    flameY = 0.070;
  } else {
    // Variant 2: Tall Slender Temple/Dorm Standing Lantern
    const baseProfile = [
      [0.000, 0.003], [0.036, 0.003], [0.044, 0.006], [0.047, 0.011],
      [0.046, 0.017], [0.041, 0.022], [0.037, 0.026], [0.039, 0.030],
      [0.035, 0.034], [0.032, 0.038], [0.033, 0.042], [0.028, 0.044],
      [0.022, 0.043], [0.015, 0.042], [0.008, 0.041], [0.000, 0.041]
    ].map(([r, y]) => new THREE.Vector2(r, y));
    lantern.add(tagMesh(new THREE.Mesh(new THREE.LatheGeometry(baseProfile, 36), woodMat), 'secondary'));

    // 6 small carved feet
    const footGeom = new THREE.BoxGeometry(0.010, 0.006, 0.014);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const foot = tagMesh(new THREE.Mesh(footGeom, woodMat), 'secondary');
      foot.position.set(Math.cos(a) * 0.037, 0.003, Math.sin(a) * 0.037);
      foot.rotation.y = -a + Math.PI * 0.5;
      lantern.add(foot);
    }

    // Tall gently waisted washi cylinder/bell shade (LatheGeometry, 36 points)
    const shadePts = [];
    for (let i = 0; i <= 36; i++) {
      const t = i / 36;
      const y = lerp(0.040, 0.244, t);
      const swell = Math.sin(Math.pow(t, 0.85) * Math.PI);
      const r = 0.031 + 0.014 * swell + Math.sin(t * Math.PI * 12) * 0.0007 * swell;
      shadePts.push(new THREE.Vector2(r, y));
    }
    const shadeMesh = tagMesh(new THREE.Mesh(new THREE.LatheGeometry(shadePts, 40), paperMat), 'glow');
    shadeMesh.castShadow = false;
    lantern.add(shadeMesh);

    // 6 slender vertical wooden frame ribs
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const cA = Math.cos(a);
      const sA = Math.sin(a);
      const ribPts = [];
      for (let k = 0; k <= 10; k++) {
        const t = k / 10;
        const y = lerp(0.032, 0.250, t);
        const swell = Math.sin(Math.pow(t, 0.85) * Math.PI);
        const r = 0.034 + 0.0145 * swell;
        ribPts.push(new THREE.Vector3(cA * r, y, sA * r));
      }
      const ribGeom = createTaperedTube(THREE, new THREE.CatmullRomCurve3(ribPts), 22, 8, () => 0.0024);
      lantern.add(tagMesh(new THREE.Mesh(ribGeom, woodMat), 'secondary'));
    }

    // Two decorative horizontal wooden waist rings
    for (const [ry, rr] of [[0.092, 0.045], [0.192, 0.044]]) {
      const band = tagMesh(new THREE.Mesh(new THREE.TorusGeometry(rr, 0.0026, 8, 36), woodMat), 'secondary');
      band.rotation.x = Math.PI * 0.5;
      band.position.y = ry;
      lantern.add(band);
    }

    // Tall turned temple spire crown (LatheGeometry, 24 points)
    const crownPts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const y = lerp(0.242, 0.294, t);
      let r;
      if (t < 0.28) {
        r = lerp(0.036, 0.044, Math.sin((t / 0.28) * Math.PI * 0.7));
      } else {
        const u = (t - 0.28) / 0.72;
        r = (1 - u) * 0.032 * (0.85 + 0.22 * Math.sin(u * Math.PI * 4));
      }
      crownPts.push(new THREE.Vector2(Math.max(0, r), y));
    }
    lantern.add(tagMesh(new THREE.Mesh(new THREE.LatheGeometry(crownPts, 36), woodMat), 'secondary'));

    const ring = tagMesh(new THREE.Mesh(new THREE.TorusGeometry(0.0065, 0.0015, 10, 20), brassMat), 'primary');
    ring.position.y = 0.298;
    lantern.add(ring);

    lightY = 0.145;
    flameY = 0.076;
  }

  // Turned wooden candle cup + warm glowing inner spirit flame (LatheGeometry >= 16 pts)
  const cupProfile = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const y = lerp(flameY - 0.034, flameY - 0.008, t);
    const r = t < 0.15 ? lerp(0.001, 0.014, t / 0.15) :
      t < 0.7 ? 0.012 + 0.004 * Math.sin(((t - 0.15) / 0.55) * Math.PI) :
        lerp(0.015, 0.011, (t - 0.7) / 0.3);
    cupProfile.push(new THREE.Vector2(r, y));
  }
  lantern.add(tagMesh(new THREE.Mesh(new THREE.LatheGeometry(cupProfile, 20), brassMat), 'primary'));

  const flameProfile = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const y = lerp(0, 0.036, t);
    const r = 0.011 * Math.sin(Math.pow(t, 0.65) * Math.PI) * (1 - 0.35 * t);
    flameProfile.push(new THREE.Vector2(Math.max(0, r), y));
  }
  const flameGeom = new THREE.LatheGeometry(flameProfile, 18);
  const flameGroup = new THREE.Group();
  flameGroup.name = 'lanternFlame';
  flameGroup.position.y = flameY - 0.006;

  const innerFlame = new THREE.Mesh(flameGeom, flameMat);
  innerFlame.userData.slot = 'glow';
  flameGroup.add(innerFlame);

  const outerFlame = new THREE.Mesh(flameGeom, flameHaloMat);
  outerFlame.scale.set(1.55, 1.32, 1.55);
  outerFlame.position.y = -0.003;
  outerFlame.userData.slot = 'glow';
  flameGroup.add(outerFlame);
  lantern.add(flameGroup);

  // Warm interior PointLight explicitly named "glow"
  const glowLight = new THREE.PointLight(glowColor.getHex(), 0.42, 1.1, 2);
  glowLight.name = 'glow';
  glowLight.position.set(0, lightY, 0);
  lantern.add(glowLight);

  return { lantern, glowLight, flameGroup };
}

/**
 * Builds the hero-quality sculpted sleeping fox spirit curled around the lantern.
 */
function buildFox(THREE, mats, tex, lanternCenter) {
  const fox = new THREE.Group();
  fox.name = 'foxSpirit';

  function tagMesh(mesh, slot) {
    mesh.userData.slot = slot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // ---- 1. SCULPTED CONTINUOUS CURLED BODY (SphereGeometry 48x64 bent along C-arc) ----
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'body';
  fox.add(bodyGroup);

  const bodyGeom = new THREE.SphereGeometry(1, 48, 64);
  const bPos = bodyGeom.attributes.position;

  const arcStart = 2.02;  // front-left shoulder
  const arcEnd = 5.44;    // back-right haunch
  const cx = lanternCenter.x;
  const cz = lanternCenter.z;

  for (let i = 0; i < bPos.count; i++) {
    const sx = bPos.getX(i);
    const sy = bPos.getY(i);
    const sz = bPos.getZ(i);

    // sy = cos(theta) runs +1 (shoulder) to -1 (rump)
    const t = (1 - sy) * 0.5;
    const sinT = Math.sqrt(Math.max(0, 1 - sy * sy));
    const phi = Math.atan2(sz, -sx);

    const a = lerp(arcStart, arcEnd, t);
    const radArc = 0.088 + 0.003 * Math.sin(t * Math.PI * 2);

    const spineX = cx + Math.cos(a) * radArc;
    const spineZ = cz + Math.sin(a) * radArc;
    const spineY = 0.032 + 0.008 * Math.sin(t * Math.PI) + 0.003 * Math.sin(t * Math.PI * 2.2);

    // Outward radial & vertical cross-section frame along the curled arc
    const outX = Math.cos(a);
    const outZ = Math.sin(a);
    const tanX = -Math.sin(a);
    const tanZ = Math.cos(a);

    // Plush torso width/height profile: full ribcage, gentle waist, plump curled haunch
    const chestBump = Math.exp(-Math.pow((t - 0.26) / 0.24, 2)) * 0.008;
    const haunchBump = Math.exp(-Math.pow((t - 0.78) / 0.22, 2)) * 0.009;
    const baseEnvelope = Math.pow(sinT, 0.72);
    const rHoriz = (0.027 + chestBump + haunchBump) * baseEnvelope;
    const rVert = (0.025 + chestBump * 0.9 + haunchBump * 0.85) * baseEnvelope;

    const cPhi = Math.cos(phi); // +1 outward away from lantern, -1 inward toward lantern
    const sPhi = Math.sin(phi); // +1 top/spine, -1 belly/floor

    // Gentle spine crest & cozy rounded flank
    const spineCrest = smoothstep(0.35, 0.95, sPhi) * 0.0035 * baseEnvelope;
    const poleExtend = sy * 0.015; // smooth rounded shoulder/rump end caps along tangent

    let wx = spineX + outX * (cPhi * rHoriz) - tanX * poleExtend;
    let wy = spineY + sPhi * rVert + spineCrest;
    let wz = spineZ + outZ * (cPhi * rHoriz) - tanZ * poleExtend;

    // Flatten the underside softly onto the floor so the fox's weight rests grounded
    if (wy < 0.008) {
      wy = 0.0008 + Math.max(0, wy + 0.012) * 0.36;
    }
    if (wy < 0.0006) wy = 0.0006;

    bPos.setXYZ(i, wx, wy, wz);
  }
  bPos.needsUpdate = true;
  bodyGeom.computeVertexNormals();
  bodyGroup.add(tagMesh(new THREE.Mesh(bodyGeom, mats.bodyFur), 'fur'));

  // ---- 2. FLUFFY CHEST/NECK RUFF (deeply bridges curled body and tilted head) ----
  const ruffGeom = new THREE.SphereGeometry(1, 48, 32);
  const rfPos = ruffGeom.attributes.position;
  for (let i = 0; i < rfPos.count; i++) {
    const nx = rfPos.getX(i);
    const ny = rfPos.getY(i);
    const nz = rfPos.getZ(i);
    const ang = Math.atan2(nx, nz);
    const tuft = 1 + 0.11 * Math.cos(ang * 7.0) * smoothstep(-0.2, 0.5, nz) * (1 - Math.abs(ny) * 0.6);
    let x = nx * 0.032 * tuft;
    let y = ny * 0.026 * (1 + 0.08 * smoothstep(-0.5, 0.2, ny));
    let z = nz * 0.031 * tuft;
    // Softly drop the front chest plume downward
    y -= 0.005 * smoothstep(0.25, 0.95, nz) * smoothstep(0.2, -0.6, ny);
    rfPos.setXYZ(i, x, y, z);
  }
  rfPos.needsUpdate = true;
  ruffGeom.computeVertexNormals();
  const ruffMesh = tagMesh(new THREE.Mesh(ruffGeom, mats.creamFur), 'furAccent');
  ruffMesh.position.set(-0.032, 0.040, 0.068);
  ruffMesh.rotation.set(0.22, 0.34, -0.14);
  bodyGroup.add(ruffMesh);

  // ---- 3. COZY RIBBON COLLAR & TURNED BRASS SPIRIT BELL ----
  const collarCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.056, 0.044, 0.058),
    new THREE.Vector3(-0.048, 0.034, 0.080),
    new THREE.Vector3(-0.024, 0.029, 0.094),
    new THREE.Vector3(-0.005, 0.036, 0.082),
    new THREE.Vector3(-0.012, 0.048, 0.058),
    new THREE.Vector3(-0.036, 0.053, 0.048)
  ], true);
  const collarGeom = createTaperedTube(THREE, collarCurve, 36, 10, () => 0.0032, null, { capStart: false, capEnd: false });
  bodyGroup.add(tagMesh(new THREE.Mesh(collarGeom, mats.ribbon), 'accent'));

  // Tiny bent ribbon tail accents at side of collar
  const ribbonShape = new THREE.Shape();
  ribbonShape.moveTo(0, 0);
  ribbonShape.bezierCurveTo(0.004, -0.006, 0.006, -0.014, 0.005, -0.022);
  ribbonShape.lineTo(0.0, -0.018);
  ribbonShape.lineTo(-0.005, -0.022);
  ribbonShape.bezierCurveTo(-0.006, -0.014, -0.004, -0.006, 0, 0);
  const ribbonGeom = new THREE.ExtrudeGeometry(ribbonShape, {
    depth: 0.0014,
    bevelEnabled: true,
    bevelThickness: 0.0005,
    bevelSize: 0.0005,
    bevelSegments: 2,
    curveSegments: 10
  });
  const ribP = ribbonGeom.attributes.position;
  for (let i = 0; i < ribP.count; i++) {
    const y = ribP.getY(i);
    const z = ribP.getZ(i);
    ribP.setZ(i, z + Math.sin(y * 120) * 0.0018);
  }
  ribP.needsUpdate = true;
  ribbonGeom.computeVertexNormals();
  const ribbonTail = tagMesh(new THREE.Mesh(ribbonGeom, mats.ribbon), 'accent');
  ribbonTail.position.set(-0.008, 0.034, 0.084);
  ribbonTail.rotation.set(-0.45, 0.72, 0.35);
  bodyGroup.add(ribbonTail);

  // Turned brass suzu spirit bell (LatheGeometry, 16 points)
  const bellProfile = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const ang = t * Math.PI;
    const r = 0.0068 * Math.sin(ang) + (Math.abs(t - 0.5) < 0.09 ? 0.0009 : 0);
    const y = -Math.cos(ang) * 0.0065;
    bellProfile.push(new THREE.Vector2(Math.max(0.0002, r), y));
  }
  const bellMesh = tagMesh(new THREE.Mesh(new THREE.LatheGeometry(bellProfile, 22), mats.brass), 'primary');
  bellMesh.position.set(-0.022, 0.025, 0.096);
  bodyGroup.add(bellMesh);

  // ---- 4. SCULPTED HEAD + FACE + EARS ----
  const headGroup = new THREE.Group();
  headGroup.name = 'head';
  headGroup.position.set(-0.029, 0.060, 0.084);
  headGroup.rotation.set(0.15, 0.32, -0.21);
  fox.add(headGroup);

  const headGeom = new THREE.SphereGeometry(1, 56, 38);
  const hPos = headGeom.attributes.position;
  const tmpV = new THREE.Vector3();
  for (let i = 0; i < hPos.count; i++) {
    sculptHeadDirection(hPos.getX(i), hPos.getY(i), hPos.getZ(i), tmpV);
    hPos.setXYZ(i, tmpV.x, tmpV.y, tmpV.z);
  }
  hPos.needsUpdate = true;
  headGeom.computeVertexNormals();
  headGroup.add(tagMesh(new THREE.Mesh(headGeom, mats.headFur), 'fur'));

  // 3-layer stylized eyes seated snugly into the sculpted eye sockets
  const eyeBaseGeom = new THREE.SphereGeometry(0.0094, 24, 16);
  eyeBaseGeom.scale(1.0, 1.04, 0.52);

  const irisGeom = new THREE.SphereGeometry(0.0078, 24, 14, 0, TAU, 0, Math.PI * 0.42);
  irisGeom.rotateX(Math.PI * 0.5);
  // Planarize front cap UVs so radial iris texture maps straight onto the iris disc
  const iPos = irisGeom.attributes.position;
  const iUv = irisGeom.attributes.uv;
  for (let i = 0; i < iPos.count; i++) {
    const ix = iPos.getX(i);
    const iy = iPos.getY(i);
    iUv.setXY(i, ix / (0.0078 * 2) + 0.5, iy / (0.0078 * 2) + 0.5);
  }
  iUv.needsUpdate = true;

  const hiBigGeom = new THREE.SphereGeometry(0.0021, 12, 10);
  hiBigGeom.scale(1.1, 1.0, 0.45);
  const hiSmallGeom = new THREE.SphereGeometry(0.0010, 10, 8);
  hiSmallGeom.scale(1.0, 1.0, 0.45);

  const eyeGroups = {};
  for (const side of [-1, 1]) {
    const name = side < 0 ? 'eyeL' : 'eyeR';
    const dir = new THREE.Vector3(side * 0.43, 0.05, 0.78).normalize();
    const surfacePos = sculptHeadDirection(dir.x, dir.y, dir.z, new THREE.Vector3());
    const surfaceNorm = estimateHeadNormal(THREE, dir.x, dir.y, dir.z);

    const eyePivot = new THREE.Group();
    eyePivot.name = name;
    // Slightly inset into socket so eyes never float
    eyePivot.position.copy(surfacePos).addScaledVector(surfaceNorm, -0.0014);
    eyePivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), surfaceNorm);

    // Layer 1: Dark glossy eye dome
    const baseEye = new THREE.Mesh(eyeBaseGeom, mats.eyeGloss);
    baseEye.userData.slot = 'eye';
    eyePivot.add(baseEye);

    // Layer 2: Coloured glossy iris disc
    const iris = new THREE.Mesh(irisGeom, mats.iris);
    iris.position.z = -0.0020;
    iris.userData.slot = 'eye';
    eyePivot.add(iris);

    // Layer 3: Crisp dual specular highlight dots (upper-right & small lower-left)
    const hi1 = new THREE.Mesh(hiBigGeom, mats.eyeHighlight);
    hi1.position.set(0.0028, 0.0027, 0.0052);
    eyePivot.add(hi1);

    const hi2 = new THREE.Mesh(hiSmallGeom, mats.eyeHighlight);
    hi2.position.set(-0.0023, -0.0025, 0.0049);
    eyePivot.add(hi2);

    headGroup.add(eyePivot);
    eyeGroups[name] = eyePivot;

    // Gentle sleepy curved upper lash / eyelid line framing the top of each eye
    const lashCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.0092, 0.0012, 0.0025),
      new THREE.Vector3(-0.0042, 0.0072, 0.0044),
      new THREE.Vector3(0.0038, 0.0074, 0.0045),
      new THREE.Vector3(0.0096, 0.0022, 0.0022)
    ]);
    const lashGeom = createTaperedTube(THREE, lashCurve, 16, 6, (t) => 0.0011 * Math.sin(t * Math.PI) + 0.0004);
    const lash = new THREE.Mesh(lashGeom, mats.noseDark);
    lash.position.copy(surfacePos).addScaledVector(surfaceNorm, -0.0008);
    lash.quaternion.copy(eyePivot.quaternion);
    lash.userData.slot = 'fur';
    headGroup.add(lash);

    // Soft cheek blush disc flush on cheek ruff under eye
    const bDir = new THREE.Vector3(side * 0.62, -0.17, 0.68).normalize();
    const bPosSurf = sculptHeadDirection(bDir.x, bDir.y, bDir.z, new THREE.Vector3());
    const bNorm = estimateHeadNormal(THREE, bDir.x, bDir.y, bDir.z);
    const blushDisc = new THREE.Mesh(new THREE.CircleGeometry(0.0085, 20), mats.blush);
    blushDisc.position.copy(bPosSurf).addScaledVector(bNorm, 0.0005);
    blushDisc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), bNorm);
    blushDisc.scale.set(1.22, 0.78, 1);
    blushDisc.userData.slot = 'skin';
    headGroup.add(blushDisc);
  }

  // Sculpted button fox nose seated cleanly at snout tip
  const noseDir = new THREE.Vector3(0, -0.22, 0.975).normalize();
  const noseSurf = sculptHeadDirection(noseDir.x, noseDir.y, noseDir.z, new THREE.Vector3());
  const noseGeom = new THREE.SphereGeometry(0.0048, 22, 16);
  const nPos = noseGeom.attributes.position;
  for (let i = 0; i < nPos.count; i++) {
    let x = nPos.getX(i);
    let y = nPos.getY(i);
    let z = nPos.getZ(i);
    // Cute rounded inverted-triangle fox nose
    x *= 1.15 - 0.35 * smoothstep(0.0, -0.0048, y);
    y *= 0.76;
    z *= 0.82;
    nPos.setXYZ(i, x, y, z);
  }
  nPos.needsUpdate = true;
  noseGeom.computeVertexNormals();
  const noseMesh = tagMesh(new THREE.Mesh(noseGeom, mats.noseDark), 'fur');
  noseMesh.position.copy(noseSurf).add(new THREE.Vector3(0, 0.0005, 0.0012));
  headGroup.add(noseMesh);

  // Contented sleeping `:3` smile made from thin tapered tubes
  for (const side of [-1, 1]) {
    const mPts = [
      new THREE.Vector3(0, -0.0155, 0.0628),
      new THREE.Vector3(side * 0.0032, -0.0180, 0.0616),
      new THREE.Vector3(side * 0.0074, -0.0176, 0.0590),
      new THREE.Vector3(side * 0.0108, -0.0154, 0.0558)
    ];
    const mGeom = createTaperedTube(THREE, new THREE.CatmullRomCurve3(mPts), 14, 6, (t) => lerp(0.00075, 0.00045, t));
    const mMesh = new THREE.Mesh(mGeom, mats.noseDark);
    mMesh.userData.slot = 'fur';
    headGroup.add(mMesh);
  }

  // Delicate spirit whiskers (3 fine tapered tubes per cheek)
  for (const side of [-1, 1]) {
    for (let w = 0; w < 3; w++) {
      const yOff = -0.012 - w * 0.0026;
      const wCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.015, yOff, 0.050),
        new THREE.Vector3(side * 0.032, yOff - 0.0008 + (1 - w) * 0.0022, 0.052),
        new THREE.Vector3(side * 0.048, yOff - 0.0025 + (1 - w) * 0.0038, 0.048)
      ]);
      const wGeom = createTaperedTube(THREE, wCurve, 10, 5, (t) => lerp(0.00052, 0.00014, t));
      const wMesh = new THREE.Mesh(wGeom, mats.creamFur);
      wMesh.userData.slot = 'furAccent';
      headGroup.add(wMesh);
    }
  }

  // Expressive bent extruded fox ears (earL, earR) with soft inner ear & fluff tufts
  const outerEarGeom = createBentEarGeometry(THREE, 0.031, 0.055, 0.0056, 0.0095, 0.0055);
  const innerEarGeom = createBentEarGeometry(THREE, 0.021, 0.041, 0.0022, 0.0072, 0.0045);

  const earGroups = {};
  for (const side of [-1, 1]) {
    const earGroup = new THREE.Group();
    earGroup.name = side < 0 ? 'earL' : 'earR';
    earGroup.position.set(side * 0.023, 0.026, -0.003);
    // Subtle asymmetric sleepy droop
    earGroup.rotation.set(
      side < 0 ? 0.14 : 0.08,
      side * 0.24,
      side * (side < 0 ? -0.42 : -0.34)
    );

    const outer = tagMesh(new THREE.Mesh(outerEarGeom, mats.earFur), 'fur');
    earGroup.add(outer);

    const inner = tagMesh(new THREE.Mesh(innerEarGeom, mats.innerEar), 'skin');
    inner.position.set(0, 0.004, 0.0026);
    earGroup.add(inner);

    // Soft curved inner ear-fluff tufts
    for (let f = 0; f < 2; f++) {
      const fCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-side * 0.008, 0.007 + f * 0.006, 0.004),
        new THREE.Vector3(-side * 0.001, 0.011 + f * 0.006, 0.007),
        new THREE.Vector3(side * 0.006, 0.010 + f * 0.005, 0.005)
      ]);
      const fGeom = createTaperedTube(THREE, fCurve, 10, 6, (t) => 0.0022 * (1 - t * 0.78));
      earGroup.add(tagMesh(new THREE.Mesh(fGeom, mats.creamFur), 'furAccent'));
    }

    headGroup.add(earGroup);
    earGroups[earGroup.name] = earGroup;
  }

  // ---- 5. LIMBS & PAWS (tapered tubes + sculpted paws, asymmetric pose) ----
  const pawGeom = createSculptedPawGeometry(THREE, 0.015, 0.0115, 0.0085);

  // armL: front-left paw tucked softly on the floor right under the tilted cheek
  const armL = new THREE.Group();
  armL.name = 'armL';
  const armLCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.056, 0.032, 0.052),
    new THREE.Vector3(-0.058, 0.016, 0.074),
    new THREE.Vector3(-0.044, 0.011, 0.095),
    new THREE.Vector3(-0.028, 0.010, 0.104)
  ]);
  armL.add(tagMesh(new THREE.Mesh(
    createTaperedTube(THREE, armLCurve, 20, 12, (t) => lerp(0.0135, 0.0082, t), null, { minY: 0.0008 }),
    mats.limbFur
  ), 'fur'));
  const pawL = tagMesh(new THREE.Mesh(pawGeom, mats.pawDark), 'fur');
  pawL.position.set(-0.022, 0.0075, 0.108);
  pawL.rotation.set(0, 0.58, 0);
  armL.add(pawL);
  fox.add(armL);

  // armR: front-right RAISED PAW gently hugging/resting on the lantern's wooden base rim!
  const armR = new THREE.Group();
  armR.name = 'armR';
  const armRCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.014, 0.034, 0.066),
    new THREE.Vector3(0.004, 0.030, 0.056),
    new THREE.Vector3(0.013, 0.028, 0.042),
    new THREE.Vector3(0.015, 0.027, 0.030)
  ]);
  armR.add(tagMesh(new THREE.Mesh(
    createTaperedTube(THREE, armRCurve, 20, 12, (t) => lerp(0.0125, 0.0078, t)),
    mats.limbFur
  ), 'fur'));
  const pawR = tagMesh(new THREE.Mesh(pawGeom, mats.pawDark), 'fur');
  pawR.position.set(0.015, 0.026, 0.026);
  pawR.rotation.set(0.32, Math.PI, 0);
  armR.add(pawR);
  fox.add(armR);

  // legL: tucked left-rear thigh & paw resting grounded along left-back flank
  const legL = new THREE.Group();
  legL.name = 'legL';
  const legLCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.052, 0.034, -0.078),
    new THREE.Vector3(-0.082, 0.022, -0.052),
    new THREE.Vector3(-0.094, 0.013, -0.016),
    new THREE.Vector3(-0.086, 0.011, 0.008)
  ]);
  legL.add(tagMesh(new THREE.Mesh(
    createTaperedTube(THREE, legLCurve, 20, 12, (t) => lerp(0.0185, 0.0085, t), null, { minY: 0.0008 }),
    mats.limbFur
  ), 'fur'));
  const pawHL = tagMesh(new THREE.Mesh(pawGeom, mats.pawDark), 'fur');
  pawHL.position.set(-0.083, 0.0075, 0.014);
  pawHL.rotation.set(0, 0.32, 0);
  legL.add(pawHL);
  fox.add(legL);

  // legR: tucked right-rear haunch paw peeking softly under the tail base
  const legR = new THREE.Group();
  legR.name = 'legR';
  const legRCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.046, 0.030, -0.096),
    new THREE.Vector3(0.068, 0.019, -0.086),
    new THREE.Vector3(0.076, 0.011, -0.062)
  ]);
  legR.add(tagMesh(new THREE.Mesh(
    createTaperedTube(THREE, legRCurve, 16, 12, (t) => lerp(0.0170, 0.0082, t), null, { minY: 0.0008 }),
    mats.limbFur
  ), 'fur'));
  const pawHR = tagMesh(new THREE.Mesh(pawGeom, mats.pawDark), 'fur');
  pawHR.position.set(0.077, 0.0075, -0.056);
  pawHR.rotation.set(0, 0.25, 0);
  legR.add(pawHR);
  fox.add(legR);

  // ---- 6. LUSH CURLED FLUFFY FOX TAIL (tapered tube sweeping around right side of lantern) ----
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tail';
  tailGroup.position.set(0.066, 0.032, -0.082);
  fox.add(tailGroup);

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.008, 0.002, -0.006),
    new THREE.Vector3(0.026, -0.002, 0.028),
    new THREE.Vector3(0.044, -0.001, 0.090),
    new THREE.Vector3(0.025, -0.003, 0.148),
    new THREE.Vector3(-0.020, -0.004, 0.174),
    new THREE.Vector3(-0.052, 0.004, 0.175)
  ]);

  const tailGeom = createTaperedTube(
    THREE,
    tailCurve,
    46,
    24,
    (t) => {
      // Plush fox brush envelope: snug root -> big lush mid-tail -> graceful curled tip
      const swell = Math.sin(Math.pow(t, 0.72) * Math.PI);
      const base = lerp(0.018, 0.002, t);
      return base + 0.0245 * swell;
    },
    (t, ang, rBase) => {
      // Subtle organic fur-tuft fluting along the plush tail brush
      const tuft = 1 + 0.055 * Math.sin(ang * 5 + t * 5.0) * Math.sin(t * Math.PI);
      return rBase * tuft;
    },
    { minY: -0.0312 } // keeps bottom of tail resting cleanly at world y >= 0.0008
  );
  tailGroup.add(tagMesh(new THREE.Mesh(tailGeom, mats.tailFur), 'fur'));

  return {
    fox,
    bodyGroup,
    headGroup,
    tailGroup,
    earL: earGroups.earL,
    earR: earGroups.earR,
    eyeL: eyeGroups.eyeL,
    eyeR: eyeGroups.eyeR,
    armL,
    armR,
    legL,
    legR
  };
}

export function build(THREE, opts = {}, kit) {
  const furColor = toColor(THREE, opts.fur, '#d86c36');
  const accentColor = toColor(THREE, opts.furAccent, '#f6ead4');
  const eyeColor = toColor(THREE, opts.eye, '#d48c2e');
  const glowColor = toColor(THREE, opts.glow, '#ffbe6b');

  const palette = {
    furRGB: colorToSRGB(furColor),
    accentRGB: colorToSRGB(accentColor),
    eyeRGB: colorToSRGB(eyeColor),
    glowRGB: colorToSRGB(glowColor)
  };

  const tex = createTextures(THREE, kit, palette);

  const furSheen = tintThreeColor(THREE, furColor, '#fff4e0', 0.55);
  const creamSheen = tintThreeColor(THREE, accentColor, '#ffffff', 0.45);
  const darkPawCol = tintThreeColor(THREE, furColor, '#26140e', 0.74);

  const mats = {
    headFur: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: tex.headMap,
      bumpMap: tex.furBump,
      bumpScale: 0.0014,
      roughness: 0.90,
      metalness: 0.0,
      sheen: 0.88,
      sheenRoughness: 0.65,
      sheenColor: furSheen
    }),
    bodyFur: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: tex.bodyMap,
      bumpMap: tex.furBump,
      bumpScale: 0.0018,
      roughness: 0.92,
      metalness: 0.0,
      sheen: 0.90,
      sheenRoughness: 0.68,
      sheenColor: furSheen
    }),
    tailFur: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: tex.tailMap,
      bumpMap: tex.furBump,
      bumpScale: 0.0020,
      roughness: 0.92,
      metalness: 0.0,
      sheen: 0.95,
      sheenRoughness: 0.62,
      sheenColor: creamSheen
    }),
    earFur: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: tex.earMap,
      bumpMap: tex.furBump,
      bumpScale: 0.0012,
      roughness: 0.90,
      metalness: 0.0,
      sheen: 0.82,
      sheenRoughness: 0.65,
      sheenColor: furSheen
    }),
    limbFur: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: tex.limbMap,
      bumpMap: tex.furBump,
      bumpScale: 0.0014,
      roughness: 0.90,
      metalness: 0.0,
      sheen: 0.80,
      sheenRoughness: 0.68,
      sheenColor: furSheen
    }),
    creamFur: new THREE.MeshPhysicalMaterial({
      color: accentColor,
      bumpMap: tex.furBump,
      bumpScale: 0.0015,
      roughness: 0.92,
      metalness: 0.0,
      sheen: 0.92,
      sheenRoughness: 0.62,
      sheenColor: creamSheen
    }),
    pawDark: new THREE.MeshPhysicalMaterial({
      color: darkPawCol,
      bumpMap: tex.furBump,
      bumpScale: 0.0011,
      roughness: 0.88,
      metalness: 0.0,
      sheen: 0.65,
      sheenRoughness: 0.72,
      sheenColor: furSheen
    }),
    innerEar: new THREE.MeshPhysicalMaterial({
      color: tintThreeColor(THREE, accentColor, '#e59a8c', 0.44),
      bumpMap: tex.furBump,
      bumpScale: 0.0008,
      roughness: 0.92,
      metalness: 0.0,
      sheen: 0.75,
      sheenRoughness: 0.70,
      sheenColor: '#ffe8e0'
    }),
    eyeGloss: new THREE.MeshPhysicalMaterial({
      color: 0x160f0d,
      roughness: 0.05,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04
    }),
    iris: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: tex.irisMap,
      roughness: 0.08,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05
    }),
    eyeHighlight: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.35,
      roughness: 0.04,
      clearcoat: 1.0
    }),
    noseDark: new THREE.MeshPhysicalMaterial({
      color: 0x261714,
      roughness: 0.16,
      metalness: 0.0,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12
    }),
    blush: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: tex.blushMap,
      transparent: true,
      depthWrite: false,
      roughness: 0.95,
      polygonOffset: true,
      polygonOffsetFactor: -1
    }),
    ribbon: new THREE.MeshPhysicalMaterial({
      color: 0xc2382c,
      roughness: 0.86,
      metalness: 0.0,
      sheen: 0.82,
      sheenRoughness: 0.55,
      sheenColor: 0xff8a7a
    }),
    brass: new THREE.MeshPhysicalMaterial({
      color: 0xd9a84e,
      roughness: 0.24,
      metalness: 0.82,
      clearcoat: 0.65,
      clearcoatRoughness: 0.18
    }),
    wood: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: tex.woodMap,
      bumpMap: tex.woodBump,
      bumpScale: 0.0018,
      roughness: 0.66,
      metalness: 0.02,
      clearcoat: 0.16,
      clearcoatRoughness: 0.48
    }),
    paper: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: tex.paperMap,
      emissive: glowColor,
      emissiveMap: tex.paperEmissive,
      emissiveIntensity: 1.48,
      bumpMap: tex.paperBump,
      bumpScale: 0.0012,
      roughness: 0.88,
      metalness: 0.0,
      sheen: 0.65,
      sheenRoughness: 0.8,
      sheenColor: 0xfff5dc,
      side: THREE.DoubleSide
    }),
    flame: new THREE.MeshPhysicalMaterial({
      color: 0xfff8e2,
      emissive: tintThreeColor(THREE, glowColor, '#ffffff', 0.45),
      emissiveIntensity: 2.2,
      roughness: 0.15
    }),
    flameHalo: new THREE.MeshPhysicalMaterial({
      color: glowColor,
      emissive: glowColor,
      emissiveIntensity: 1.6,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      roughness: 0.2
    })
  };

  const root = new THREE.Group();
  root.name = 'foxSpiritLantern';

  const lanternCenter = new THREE.Vector3(0.014, 0, -0.020);
  const lanternRig = buildLantern(THREE, opts, mats, glowColor, lanternCenter);
  const foxRig = buildFox(THREE, mats, tex, lanternCenter);

  root.add(lanternRig.lantern);
  root.add(foxRig.fox);

  // Cache resting transforms for smooth, stateless idle animation
  root.userData._rig = {
    body: foxRig.bodyGroup,
    head: foxRig.headGroup,
    tail: foxRig.tailGroup,
    earL: foxRig.earL,
    earR: foxRig.earR,
    eyeL: foxRig.eyeL,
    eyeR: foxRig.eyeR,
    glowLight: lanternRig.glowLight,
    flameGroup: lanternRig.flameGroup,
    paperMat: mats.paper,
    headBasePos: foxRig.headGroup.position.clone(),
    headBaseRot: foxRig.headGroup.rotation.clone(),
    earLBaseRot: foxRig.earL.rotation.clone(),
    earRBaseRot: foxRig.earR.rotation.clone(),
    tailBaseRot: foxRig.tailGroup.rotation.clone(),
    lightBaseIntensity: lanternRig.glowLight.intensity
  };

  return root;
}

export function idle(group, t) {
  const rig = group && group.userData && group.userData._rig;
  if (!rig) return;

  // Serene sleeping breath cycle
  const breath = Math.sin(t * 1.45);
  const slowSway = Math.sin(t * 0.62);

  // Subtle grounded breathing on the curled body
  rig.body.scale.set(
    1 + 0.011 * breath,
    1 + 0.024 * breath,
    1 + 0.011 * breath
  );

  // Dreamy head rise & soft sleepy tilt sway
  rig.head.position.y = rig.headBasePos.y + 0.0017 * Math.sin(t * 1.45 - 0.35);
  rig.head.rotation.x = rig.headBaseRot.x + 0.024 * Math.sin(t * 1.45 - 0.45);
  rig.head.rotation.y = rig.headBaseRot.y + 0.022 * Math.sin(t * 0.48);
  rig.head.rotation.z = rig.headBaseRot.z + 0.026 * slowSway;

  // Gentle drowsy ear sway + occasional cute quick ear flick every ~5.8s
  const flickPhase = (t % 5.8) / 5.8;
  const flick = flickPhase > 0.84 && flickPhase < 0.94
    ? Math.sin(((flickPhase - 0.84) / 0.10) * Math.PI * 2) * 0.13
    : 0;
  rig.earL.rotation.z = rig.earLBaseRot.z + 0.030 * Math.sin(t * 1.15);
  rig.earL.rotation.x = rig.earLBaseRot.x + 0.018 * breath;
  rig.earR.rotation.z = rig.earRBaseRot.z - 0.028 * Math.sin(t * 1.15 + 0.5) - flick;
  rig.earR.rotation.x = rig.earRBaseRot.x + 0.020 * breath + Math.abs(flick) * 0.45;

  // Cozy slow tail breath & curl sway
  rig.tail.rotation.y = rig.tailBaseRot.y + 0.042 * Math.sin(t * 0.82 + 0.6);
  rig.tail.rotation.z = rig.tailBaseRot.z + 0.014 * Math.sin(t * 1.45 + 0.4);

  // Sleepy slow blink every ~4.2 seconds by scaling eye groups on y
  const blinkCycle = t % 4.2;
  let eyeScaleY = 1.0;
  if (blinkCycle > 3.55 && blinkCycle < 4.05) {
    const p = (blinkCycle - 3.55) / 0.50;
    const close = Math.sin(p * Math.PI);
    eyeScaleY = 1.0 - 0.92 * close * close;
  }
  rig.eyeL.scale.y = eyeScaleY;
  rig.eyeR.scale.y = eyeScaleY;

  // Warm cozy candle-flicker inside the paper lantern
  const flicker = 0.065 * Math.sin(t * 3.8) + 0.035 * Math.sin(t * 8.7 + 1.1) + 0.02 * Math.sin(t * 14.3);
  rig.glowLight.intensity = rig.lightBaseIntensity * (1 + flicker);
  rig.paperMat.emissiveIntensity = 1.48 + flicker * 0.85;
  rig.flameGroup.scale.set(
    1 - flicker * 0.35,
    1 + flicker * 0.9,
    1 - flicker * 0.35
  );
  rig.flameGroup.rotation.z = 0.05 * Math.sin(t * 4.4);
}
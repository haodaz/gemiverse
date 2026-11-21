export const META = {
  id: 'wall_corkboard',
  name: 'Cozy Wall Corkboard',
  kind: 'prop',
  footprint: [0.8, 0.06],
  variants: ['Corkboard', 'Fabric Memo Board', 'Wire Grid Panel'],
  note: 'Stylised dorm-room wall board (0.8m x 0.55m), origin at centre of back face, facing +z.'
};

// ---------------------------------------------------------------------------
// Colour & deterministic random helpers
// ---------------------------------------------------------------------------
function resolveColor(THREE, val, fallback) {
  const c = new THREE.Color();
  try {
    c.set(val !== undefined && val !== null ? val : fallback);
  } catch {
    c.set(fallback);
  }
  return c;
}

function colorToCss(c, alpha = 1) {
  const r = Math.round(Math.min(1, Math.max(0, c.r)) * 255);
  const g = Math.round(Math.min(1, Math.max(0, c.g)) * 255);
  const b = Math.round(Math.min(1, Math.max(0, c.b)) * 255);
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
}

function shiftColor(THREE, baseColor, hShift, sScale, lShift) {
  const c = baseColor.clone();
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(
    (hsl.h + hShift + 1) % 1,
    Math.min(1, Math.max(0, hsl.s * sScale)),
    Math.min(0.98, Math.max(0.03, hsl.l + lShift))
  );
  return c;
}

function mixColors(THREE, cA, cB, t) {
  return cA.clone().lerp(cB, t);
}

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/**
 * Tapered tube built ring-by-ring along a CatmullRomCurve3.
 */
function makeTaperedTube(THREE, curve, segments, radialSegments, radiusFn, closed = false, capEnds = true) {
  const frames = curve.computeFrenetFrames(segments, closed);
  const ringCount = segments + 1;
  const cols = radialSegments + 1;

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i < ringCount; i++) {
    const t = i / segments;
    const p = curve.getPointAt(closed ? (i % segments) / segments : t);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r = Math.max(0.0001, radiusFn(t));

    for (let j = 0; j < cols; j++) {
      const u = j / radialSegments;
      const theta = u * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);

      const vx = p.x + r * (cos * N.x + sin * B.x);
      const vy = p.y + r * (cos * N.y + sin * B.y);
      const vz = p.z + r * (cos * N.z + sin * B.z);

      positions.push(vx, vy, vz);
      uvs.push(t * 4, u);
    }
  }

  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * cols + j;
      const b = (i + 1) * cols + j;
      const c = (i + 1) * cols + (j + 1);
      const d = i * cols + (j + 1);
      indices.push(a, d, c);
      indices.push(a, c, b);
    }
  }

  if (capEnds && !closed) {
    // Start cap
    const p0 = curve.getPointAt(0);
    const startCenter = positions.length / 3;
    positions.push(p0.x, p0.y, p0.z);
    uvs.push(0.5, 0.5);
    for (let j = 0; j < radialSegments; j++) {
      indices.push(startCenter, j, j + 1);
    }

    // End cap
    const p1 = curve.getPointAt(1);
    const endCenter = positions.length / 3;
    positions.push(p1.x, p1.y, p1.z);
    uvs.push(0.5, 0.5);
    const base = segments * cols;
    for (let j = 0; j < radialSegments; j++) {
      indices.push(endCenter, base + j + 1, base + j);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Mitered wooden picture frame with sculpted moulding profile.
 * Profile points: [d, z] where d=0 is outer edge, d=borderW is inner edge, z=0 is back.
 */
function makeMiteredFrameGeometry(THREE, outerW, outerH, borderW, depth) {
  const hw = outerW * 0.5;
  const hh = outerH * 0.5;
  const bw = borderW;

  // Sculpted 16-point moulding cross-section (outer back -> outer round -> cove -> inner lip -> inner back)
  const profile = [
    [0.000, 0.000],
    [0.000, depth * 0.72],
    [bw * 0.03, depth * 0.86],
    [bw * 0.09, depth * 0.96],
    [bw * 0.18, depth * 1.00],
    [bw * 0.34, depth * 0.99],
    [bw * 0.48, depth * 0.92],
    [bw * 0.60, depth * 0.89],
    [bw * 0.72, depth * 0.92],
    [bw * 0.82, depth * 0.93],
    [bw * 0.90, depth * 0.87],
    [bw * 0.96, depth * 0.76],
    [bw * 1.00, depth * 0.62],
    [bw * 1.00, depth * 0.42],
    [bw * 1.00, 0.000],
    [0.000, 0.000]
  ];

  // Arc lengths along profile for clean UV v-coordinates
  const profV = [0];
  let totalProf = 0;
  for (let i = 1; i < profile.length; i++) {
    const dd = profile[i][0] - profile[i - 1][0];
    const dz = profile[i][1] - profile[i - 1][1];
    totalProf += Math.hypot(dd, dz);
    profV.push(totalProf);
  }
  for (let i = 0; i < profV.length; i++) profV[i] /= totalProf;

  const corners = [
    (d, z) => [-(hw - d), -(hh - d), z], // BL
    (d, z) => [+(hw - d), -(hh - d), z], // BR
    (d, z) => [+(hw - d), +(hh - d), z], // TR
    (d, z) => [-(hw - d), +(hh - d), z]  // TL
  ];

  const positions = [];
  const uvs = [];
  const indices = [];

  const lengthSteps = 6;
  const pCount = profile.length;

  for (let r = 0; r < 4; r++) {
    const c0 = corners[r];
    const c1 = corners[(r + 1) % 4];
    const railLen = r % 2 === 0 ? outerW : outerH;
    const baseVertex = positions.length / 3;

    for (let s = 0; s <= lengthSteps; s++) {
      const f = s / lengthSteps;
      for (let i = 0; i < pCount; i++) {
        const [d, z] = profile[i];
        const a = c0(d, z);
        const b = c1(d, z);
        const px = a[0] + (b[0] - a[0]) * f;
        const py = a[1] + (b[1] - a[1]) * f;
        const pz = a[2] + (b[2] - a[2]) * f;
        positions.push(px, py, pz);
        uvs.push(f * railLen * 1.45 + r * 0.17, profV[i]);
      }
    }

    for (let s = 0; s < lengthSteps; s++) {
      for (let i = 0; i < pCount - 1; i++) {
        const v00 = baseVertex + s * pCount + i;
        const v10 = baseVertex + (s + 1) * pCount + i;
        const v11 = baseVertex + (s + 1) * pCount + (i + 1);
        const v01 = baseVertex + s * pCount + (i + 1);
        indices.push(v00, v10, v11);
        indices.push(v00, v11, v01);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Curled thick cardstock / photo geometry with smooth vertex displacement.
 */
function makeCurledCardGeometry(THREE, w, h, thickness, curlOpts = {}) {
  const segX = 18;
  const segY = 18;
  const cols = segX + 1;
  const rows = segY + 1;

  const bow = curlOpts.bow ?? 0.0015;
  const cBR = curlOpts.br ?? 0;
  const cBL = curlOpts.bl ?? 0;
  const cTR = curlOpts.tr ?? 0;
  const cTL = curlOpts.tl ?? 0;
  const bottomLift = curlOpts.bottomLift ?? 0;

  function dispZ(u, v) {
    // u, v in [0, 1]; (0,0)=BL, (1,0)=BR, (1,1)=TR, (0,1)=TL
    let z = bow * Math.sin(u * Math.PI) * Math.sin(v * Math.PI);

    // Corner curls using smooth cubic falloff
    if (cBR > 0) {
      const k = Math.max(0, u * (1 - v) - 0.12) / 0.88;
      z += cBR * k * k * k;
    }
    if (cBL > 0) {
      const k = Math.max(0, (1 - u) * (1 - v) - 0.12) / 0.88;
      z += cBL * k * k * k;
    }
    if (cTR > 0) {
      const k = Math.max(0, u * v - 0.14) / 0.86;
      z += cTR * k * k * k;
    }
    if (cTL > 0) {
      const k = Math.max(0, (1 - u) * v - 0.14) / 0.86;
      z += cTL * k * k * k;
    }
    if (bottomLift > 0) {
      const k = Math.max(0, 1 - v);
      z += bottomLift * k * k * (0.75 + 0.25 * Math.sin(u * Math.PI));
    }
    return z;
  }

  const positions = [];
  const uvs = [];
  const indices = [];

  // Front vertices: 0 .. cols*rows - 1
  for (let iy = 0; iy < rows; iy++) {
    const v = iy / segY;
    const y = (v - 0.5) * h;
    for (let ix = 0; ix < cols; ix++) {
      const u = ix / segX;
      const x = (u - 0.5) * w;
      positions.push(x, y, dispZ(u, v) + thickness * 0.5);
      uvs.push(u, v);
    }
  }

  // Back vertices: cols*rows .. 2*cols*rows - 1
  const backOffset = cols * rows;
  for (let iy = 0; iy < rows; iy++) {
    const v = iy / segY;
    const y = (v - 0.5) * h;
    for (let ix = 0; ix < cols; ix++) {
      const u = ix / segX;
      const x = (u - 0.5) * w;
      positions.push(x, y, dispZ(u, v) - thickness * 0.5);
      uvs.push(u, v);
    }
  }

  // Front faces (+z)
  for (let iy = 0; iy < segY; iy++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = iy * cols + ix;
      const b = a + 1;
      const c = a + cols + 1;
      const d = a + cols;
      indices.push(a, b, c, a, c, d);
    }
  }

  // Back faces (-z)
  for (let iy = 0; iy < segY; iy++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = backOffset + iy * cols + ix;
      const b = a + 1;
      const c = a + cols + 1;
      const d = a + cols;
      indices.push(a, c, b, a, d, c);
    }
  }

  // Stitch 4 thin edge walls
  const addQuad = (f0, f1, b1, b0) => {
    indices.push(f0, b0, b1, f0, b1, f1);
  };
  // Bottom edge (iy = 0, ix: 0 -> segX)
  for (let ix = 0; ix < segX; ix++) {
    addQuad(ix, ix + 1, backOffset + ix + 1, backOffset + ix);
  }
  // Top edge (iy = segY, ix: segX -> 0)
  for (let ix = segX; ix > 0; ix--) {
    const r = segY * cols;
    addQuad(r + ix, r + ix - 1, backOffset + r + ix - 1, backOffset + r + ix);
  }
  // Right edge (ix = segX, iy: 0 -> segY)
  for (let iy = 0; iy < segY; iy++) {
    const f0 = iy * cols + segX;
    const f1 = (iy + 1) * cols + segX;
    addQuad(f0, f1, backOffset + f1, backOffset + f0);
  }
  // Left edge (ix = 0, iy: segY -> 0)
  for (let iy = segY; iy > 0; iy--) {
    const f0 = iy * cols;
    const f1 = (iy - 1) * cols;
    addQuad(f0, f1, backOffset + f1, backOffset + f0);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Lofted thin 3D ribbon strip along a point/normal/width array.
 */
function makeRibbonStripGeometry(THREE, samples, widthFn, thickness = 0.0009, swallowTail = false) {
  const n = samples.length;
  const acrossSegs = 4;
  const cols = acrossSegs + 1;

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let side = 0; side < 2; side++) {
    const zSign = side === 0 ? 0.5 : -0.5;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const s = samples[i];
      const w = widthFn(t);
      const halfT = thickness * zSign;

      for (let j = 0; j < cols; j++) {
        const u = j / acrossSegs; // 0..1 across width
        const centered = u - 0.5; // -0.5..0.5

        // Gentle pillow camber across ribbon width
        const camber = (1 - 4 * centered * centered) * thickness * 0.35;

        // Optional V-cut notch at the very end of the ribbon tail
        let notchPull = 0;
        if (swallowTail && t > 0.84) {
          const tipFactor = (t - 0.84) / 0.16;
          const centerDip = Math.max(0, 1 - Math.abs(centered) * 2.1);
          notchPull = tipFactor * centerDip * w * 0.72;
        }

        const px = s.p.x + s.wDir.x * (centered * w) + s.nDir.x * (halfT + camber) - s.tDir.x * notchPull;
        const py = s.p.y + s.wDir.y * (centered * w) + s.nDir.y * (halfT + camber) - s.tDir.y * notchPull;
        const pz = s.p.z + s.wDir.z * (centered * w) + s.nDir.z * (halfT + camber) - s.tDir.z * notchPull;

        positions.push(px, py, pz);
        uvs.push(t * 2.2, u);
      }
    }
  }

  const backOff = n * cols;

  // Front face
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < acrossSegs; j++) {
      const a = i * cols + j;
      const b = (i + 1) * cols + j;
      const c = (i + 1) * cols + j + 1;
      const d = i * cols + j + 1;
      indices.push(a, b, c, a, c, d);
    }
  }
  // Back face
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < acrossSegs; j++) {
      const a = backOff + i * cols + j;
      const b = backOff + (i + 1) * cols + j;
      const c = backOff + (i + 1) * cols + j + 1;
      const d = backOff + i * cols + j + 1;
      indices.push(a, c, b, a, d, c);
    }
  }
  // Side edges
  for (let i = 0; i < n - 1; i++) {
    const f0 = i * cols;
    const f1 = (i + 1) * cols;
    indices.push(f0, backOff + f0, backOff + f1, f0, backOff + f1, f1);

    const r0 = i * cols + acrossSegs;
    const r1 = (i + 1) * cols + acrossSegs;
    indices.push(r0, r1, backOff + r1, r0, backOff + r1, backOff + r0);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Procedural CanvasTexture painters (using kit.canvasTexture + kit.noise)
// ---------------------------------------------------------------------------

function makeWoodTextures(THREE, kit, woodColor) {
  const darkWood = shiftColor(THREE, woodColor, -0.01, 1.08, -0.14);
  const lightWood = shiftColor(THREE, woodColor, 0.01, 0.92, 0.09);

  const map = kit.canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = colorToCss(woodColor);
    ctx.fillRect(0, 0, w, h);

    // Layered wood grain bands using smooth value noise
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 4) {
        const warp = kit.noise(x * 0.012, y * 0.05) * 2.2;
        const ring = Math.sin((y * 0.17 + warp * 5.0) + kit.noise(x * 0.005, y * 0.015) * 7.5);
        const fine = kit.noise(x * 0.04, y * 0.25);
        const t = ring * 0.5 + 0.5;
        const c = t > 0.5
          ? mixColors(THREE, woodColor, lightWood, (t - 0.5) * 1.45)
          : mixColors(THREE, woodColor, darkWood, (0.5 - t) * 1.45);
        const grainBoost = (fine - 0.5) * 0.08;
        ctx.fillStyle = colorToCss(shiftColor(THREE, c, 0, 1, grainBoost));
        ctx.fillRect(x, y, 4, 2);
      }
    }

    // Fine dark wood pores
    const rng = makeRng(401);
    ctx.strokeStyle = colorToCss(darkWood, 0.24);
    ctx.lineWidth = 1;
    for (let i = 0; i < 240; i++) {
      const px = rng() * w;
      const py = rng() * h;
      const len = 12 + rng() * 38;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + len, py + (rng() - 0.5) * 1.5);
      ctx.stroke();
    }
  });
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = kit.canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 4) {
        const n = kit.noise(x * 0.03, y * 0.22);
        const v = Math.round(108 + n * 44);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 4, 2);
      }
    }
  });
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

function makeCorkTextures(THREE, kit) {
  const corkBase = new THREE.Color(0xc5915b);
  const corkLight = new THREE.Color(0xdcb17d);
  const corkMid = new THREE.Color(0xb37c47);
  const corkDark = new THREE.Color(0x7c4f2b);
  const corkDeep = new THREE.Color(0x56341c);

  const map = kit.canvasTexture(512, 384, (ctx, w, h) => {
    ctx.fillStyle = colorToCss(corkBase);
    ctx.fillRect(0, 0, w, h);

    // Mottled organic cork patches via multi-scale noise
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 3) {
        const n1 = kit.noise(x * 0.035, y * 0.035);
        const n2 = kit.noise(x * 0.11 + 17, y * 0.11 + 9);
        const n3 = kit.noise(x * 0.24 + 41, y * 0.24 + 23);
        const blend = n1 * 0.45 + n2 * 0.35 + n3 * 0.2;
        const c = blend > 0.52
          ? mixColors(THREE, corkBase, corkLight, Math.min(1, (blend - 0.52) * 2.2))
          : mixColors(THREE, corkMid, corkDark, Math.min(1, (0.52 - blend) * 2.1));
        ctx.fillStyle = colorToCss(c);
        ctx.fillRect(x, y, 3, 3);
      }
    }

    // Painted cork speckles (granules, dark flecks, pale oat crumbs)
    const rng = makeRng(808);
    for (let i = 0; i < 4200; i++) {
      const px = rng() * w;
      const py = rng() * h;
      const rx = 0.9 + rng() * 3.2;
      const ry = 0.7 + rng() * 2.4;
      const rot = rng() * Math.PI;
      const roll = rng();

      if (roll < 0.26) {
        ctx.fillStyle = colorToCss(corkDark, 0.45 + rng() * 0.35);
      } else if (roll < 0.38) {
        ctx.fillStyle = colorToCss(corkDeep, 0.55);
      } else if (roll < 0.68) {
        ctx.fillStyle = colorToCss(corkLight, 0.35 + rng() * 0.3);
      } else {
        ctx.fillStyle = colorToCss(corkMid, 0.45);
      }
      ctx.beginPath();
      ctx.ellipse(px, py, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tiny pin-hole flecks
    for (let i = 0; i < 450; i++) {
      ctx.fillStyle = colorToCss(corkDeep, 0.45 + rng() * 0.35);
      ctx.beginPath();
      ctx.arc(rng() * w, rng() * h, 0.5 + rng() * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Soft inner frame recess AO shadow
    const pad = 26;
    const gradTop = ctx.createLinearGradient(0, 0, 0, pad);
    gradTop.addColorStop(0, 'rgba(48, 26, 12, 0.38)');
    gradTop.addColorStop(1, 'rgba(48, 26, 12, 0)');
    ctx.fillStyle = gradTop;
    ctx.fillRect(0, 0, w, pad);

    const gradBot = ctx.createLinearGradient(0, h, 0, h - pad);
    gradBot.addColorStop(0, 'rgba(48, 26, 12, 0.32)');
    gradBot.addColorStop(1, 'rgba(48, 26, 12, 0)');
    ctx.fillStyle = gradBot;
    ctx.fillRect(0, h - pad, w, pad);

    const gradL = ctx.createLinearGradient(0, 0, pad, 0);
    gradL.addColorStop(0, 'rgba(48, 26, 12, 0.34)');
    gradL.addColorStop(1, 'rgba(48, 26, 12, 0)');
    ctx.fillStyle = gradL;
    ctx.fillRect(0, 0, pad, h);

    const gradR = ctx.createLinearGradient(w, 0, w - pad, 0);
    gradR.addColorStop(0, 'rgba(48, 26, 12, 0.34)');
    gradR.addColorStop(1, 'rgba(48, 26, 12, 0)');
    ctx.fillStyle = gradR;
    ctx.fillRect(w - pad, 0, pad, h);
  });
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = kit.canvasTexture(512, 384, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    const rng = makeRng(809);
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 3) {
        const n = kit.noise(x * 0.14, y * 0.14) * 0.65 + kit.noise(x * 0.32, y * 0.32) * 0.35;
        const v = Math.round(75 + n * 115);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 3, 3);
      }
    }
    for (let i = 0; i < 1500; i++) {
      const v = rng() < 0.45 ? 36 : 205;
      ctx.fillStyle = `rgba(${v},${v},${v},0.45)`;
      ctx.beginPath();
      ctx.arc(rng() * w, rng() * h, 0.8 + rng() * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  return { map, bumpMap };
}

function makeFabricBoardTextures(THREE, kit, tintColor, innerW, innerH, diamondSpacing) {
  // Soft cozy oatmeal linen subtly harmonized with opts
  const linenBase = mixColors(THREE, new THREE.Color(0xf2eadc), tintColor, 0.16);
  const linenThread = shiftColor(THREE, linenBase, 0, 0.9, -0.07);
  const linenHi = shiftColor(THREE, linenBase, 0, 0.75, 0.04);

  const map = kit.canvasTexture(512, 384, (ctx, w, h) => {
    ctx.fillStyle = colorToCss(linenBase);
    ctx.fillRect(0, 0, w, h);

    // Woven linen warp & weft
    for (let y = 0; y < h; y += 2) {
      const n = kit.noise(3.1, y * 0.18);
      ctx.fillStyle = colorToCss(n > 0.5 ? linenHi : linenThread, 0.24);
      ctx.fillRect(0, y, w, 1);
    }
    for (let x = 0; x < w; x += 2) {
      const n = kit.noise(x * 0.18, 7.3);
      ctx.fillStyle = colorToCss(n > 0.5 ? linenThread : linenHi, 0.24);
      ctx.fillRect(x, 0, 1, h);
    }

    // Subtle slub flecks
    const rng = makeRng(111);
    for (let i = 0; i < 900; i++) {
      const px = rng() * w;
      const py = rng() * h;
      ctx.fillStyle = colorToCss(linenThread, 0.18);
      if (rng() < 0.5) ctx.fillRect(px, py, 3 + rng() * 7, 1);
      else ctx.fillRect(px, py, 1, 3 + rng() * 7);
    }

    // Soft quilted tuft dimple shading aligned to diamond lattice
    for (let py = 0; py < h; py += 4) {
      for (let px = 0; px < w; px += 4) {
        const bx = (px / w - 0.5) * innerW;
        const by = (0.5 - py / h) * innerH;
        const u = (bx + by) / diamondSpacing;
        const v = (bx - by) / diamondSpacing;
        const du = u - Math.round(u);
        const dv = v - Math.round(v);
        const r2 = du * du + dv * dv;
        const dimple = Math.exp(-r2 * 18.0);
        const crease = Math.exp(-du * du * 45.0) * 0.35 + Math.exp(-dv * dv * 45.0) * 0.35;
        const shade = Math.min(0.32, dimple * 0.24 + crease * 0.08);
        if (shade > 0.01) {
          ctx.fillStyle = `rgba(60, 46, 36, ${shade.toFixed(3)})`;
          ctx.fillRect(px, py, 4, 4);
        }
      }
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const checker = ((x >> 1) + (y >> 1)) & 1;
        const v = checker ? 156 : 102;
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
  });
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(6, 4);

  return { map, bumpMap };
}

function makeCardTexture(THREE, kit, cardColor, seed) {
  const light = shiftColor(THREE, cardColor, 0, 0.85, 0.04);
  const dark = shiftColor(THREE, cardColor, 0, 1.05, -0.05);

  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = colorToCss(cardColor);
    ctx.fillRect(0, 0, w, h);

    // Soft cotton cardstock grain
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const n = kit.noise(x * 0.08 + seed, y * 0.08 + seed * 1.7);
        const c = n > 0.5
          ? mixColors(THREE, cardColor, light, (n - 0.5) * 1.4)
          : mixColors(THREE, cardColor, dark, (0.5 - n) * 1.2);
        ctx.fillStyle = colorToCss(c);
        ctx.fillRect(x, y, 4, 4);
      }
    }

    // Subtle paper fibres
    const rng = makeRng(seed * 97 + 13);
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 160; i++) {
      ctx.strokeStyle = colorToCss(rng() < 0.5 ? dark : light, 0.25);
      const px = rng() * w;
      const py = rng() * h;
      const ang = rng() * Math.PI * 2;
      const len = 3 + rng() * 8;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len);
      ctx.stroke();
    }

    // Very soft edge wear highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeAbstractPhotoTexture(THREE, kit, primary, secondary, accent) {
  const skyTop = mixColors(THREE, new THREE.Color(0xf7ead8), accent, 0.14);
  const skyBot = mixColors(THREE, new THREE.Color(0xf1d3bd), primary, 0.18);
  const hillBack = shiftColor(THREE, secondary, 0.02, 0.9, 0.05);
  const hillFront = shiftColor(THREE, secondary, -0.02, 1.05, -0.14);
  const archCol = shiftColor(THREE, primary, 0, 1.05, -0.04);
  const sunCol = shiftColor(THREE, accent, 0.01, 1.1, 0.08);
  const inkCol = new THREE.Color(0x3a2f2a);

  const tex = kit.canvasTexture(512, 620, (ctx, w, h) => {
    // Instant-photo warm white border
    ctx.fillStyle = '#faf6ee';
    ctx.fillRect(0, 0, w, h);

    // Subtle paper grain on border
    const rng = makeRng(303);
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = rng() < 0.5 ? 'rgba(180,165,145,0.09)' : 'rgba(255,255,255,0.18)';
      ctx.fillRect(rng() * w, rng() * h, 2 + rng() * 3, 2);
    }

    // Inner photo artwork window
    const padX = 36;
    const padTop = 38;
    const imgW = w - padX * 2;
    const imgH = imgW * 1.04;

    ctx.save();
    ctx.beginPath();
    ctx.rect(padX, padTop, imgW, imgH);
    ctx.clip();

    // Gouache sky gradient
    const skyGrad = ctx.createLinearGradient(0, padTop, 0, padTop + imgH);
    skyGrad.addColorStop(0, colorToCss(skyTop));
    skyGrad.addColorStop(1, colorToCss(skyBot));
    ctx.fillStyle = skyGrad;
    ctx.fillRect(padX, padTop, imgW, imgH);

    // Soft organic blob background shape
    ctx.fillStyle = colorToCss(mixColors(THREE, accent, skyTop, 0.55), 0.55);
    ctx.beginPath();
    ctx.ellipse(padX + imgW * 0.25, padTop + imgH * 0.28, imgW * 0.28, imgH * 0.22, -0.35, 0, Math.PI * 2);
    ctx.fill();

    // Warm sun orb
    ctx.fillStyle = colorToCss(sunCol);
    ctx.beginPath();
    ctx.arc(padX + imgW * 0.67, padTop + imgH * 0.30, imgW * 0.145, 0, Math.PI * 2);
    ctx.fill();

    // Soft sun halo ring
    ctx.strokeStyle = colorToCss(sunCol, 0.45);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(padX + imgW * 0.67, padTop + imgH * 0.30, imgW * 0.19, 0.2, Math.PI * 1.65);
    ctx.stroke();

    // Mid-century terracotta arch
    ctx.fillStyle = colorToCss(archCol);
    ctx.beginPath();
    const archCX = padX + imgW * 0.38;
    const archR = imgW * 0.22;
    const archTopY = padTop + imgH * 0.52;
    ctx.moveTo(archCX - archR, padTop + imgH);
    ctx.lineTo(archCX - archR, archTopY);
    ctx.arc(archCX, archTopY, archR, Math.PI, 0, false);
    ctx.lineTo(archCX + archR, padTop + imgH);
    ctx.closePath();
    ctx.fill();

    // Back wavy abstract hill
    ctx.fillStyle = colorToCss(hillBack);
    ctx.beginPath();
    ctx.moveTo(padX, padTop + imgH);
    ctx.lineTo(padX, padTop + imgH * 0.68);
    ctx.bezierCurveTo(
      padX + imgW * 0.28, padTop + imgH * 0.52,
      padX + imgW * 0.62, padTop + imgH * 0.80,
      padX + imgW, padTop + imgH * 0.56
    );
    ctx.lineTo(padX + imgW, padTop + imgH);
    ctx.closePath();
    ctx.fill();

    // Foreground sweeping hill
    ctx.fillStyle = colorToCss(hillFront);
    ctx.beginPath();
    ctx.moveTo(padX, padTop + imgH);
    ctx.lineTo(padX, padTop + imgH * 0.82);
    ctx.bezierCurveTo(
      padX + imgW * 0.35, padTop + imgH * 0.72,
      padX + imgW * 0.65, padTop + imgH * 0.90,
      padX + imgW, padTop + imgH * 0.74
    );
    ctx.lineTo(padX + imgW, padTop + imgH);
    ctx.closePath();
    ctx.fill();

    // Expressive minimalist ink line art curve
    ctx.strokeStyle = colorToCss(inkCol, 0.75);
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(padX + imgW * 0.14, padTop + imgH * 0.74);
    ctx.bezierCurveTo(
      padX + imgW * 0.26, padTop + imgH * 0.36,
      padX + imgW * 0.56, padTop + imgH * 0.42,
      padX + imgW * 0.84, padTop + imgH * 0.64
    );
    ctx.stroke();

    // Small decorative stars / gouache dots
    ctx.fillStyle = '#fdf8ef';
    const dots = [
      [0.22, 0.20, 6], [0.82, 0.18, 4.5], [0.50, 0.16, 3.5],
      [0.76, 0.52, 4.0], [0.38, 0.44, 5.0]
    ];
    for (const [dx, dy, dr] of dots) {
      ctx.beginPath();
      ctx.arc(padX + imgW * dx, padTop + imgH * dy, dr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Painterly gouache texture stipple over artwork
    for (let i = 0; i < 1200; i++) {
      const gx = padX + rng() * imgW;
      const gy = padTop + rng() * imgH;
      const alpha = 0.04 + rng() * 0.05;
      ctx.fillStyle = rng() < 0.5 ? `rgba(255,250,242,${alpha})` : `rgba(55,35,25,${alpha})`;
      ctx.fillRect(gx, gy, 2.5, 2.5);
    }
    ctx.restore();

    // Subtle inset edge frame around artwork
    ctx.strokeStyle = 'rgba(70, 55, 45, 0.14)';
    ctx.lineWidth = 2;
    ctx.strokeRect(padX, padTop, imgW, imgH);

    // Charming stylized handwritten scribble on the wide bottom instant-photo margin
    ctx.strokeStyle = 'rgba(75, 62, 55, 0.55)';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const baseY = padTop + imgH + 64;
    let sx = padX + 95;
    ctx.moveTo(sx, baseY);
    for (let i = 0; i < 16; i++) {
      const nx = sx + 14;
      const cy = baseY + Math.sin(i * 1.4) * (i % 3 === 0 ? -9 : 6);
      ctx.quadraticCurveTo(sx + 7, cy, nx, baseY + Math.cos(i * 0.9) * 3);
      sx = nx;
    }
    ctx.stroke();

    // Outer edge shading
    ctx.strokeStyle = 'rgba(130, 115, 100, 0.18)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePennantTexture(THREE, kit, primary, secondary, accent) {
  const feltDark = shiftColor(THREE, primary, 0, 1.05, -0.08);
  const feltLight = shiftColor(THREE, primary, 0, 0.9, 0.07);
  const cream = new THREE.Color(0xf8f1e3);
  const emblemCol = mixColors(THREE, cream, accent, 0.35);

  const map = kit.canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = colorToCss(primary);
    ctx.fillRect(0, 0, w, h);

    // Wool felt fuzzy mottled base
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 3) {
        const n = kit.noise(x * 0.09, y * 0.09);
        const c = n > 0.5
          ? mixColors(THREE, primary, feltLight, (n - 0.5) * 1.4)
          : mixColors(THREE, primary, feltDark, (0.5 - n) * 1.3);
        ctx.fillStyle = colorToCss(c);
        ctx.fillRect(x, y, 3, 3);
      }
    }

    // Varsity stripes near left base
    ctx.fillStyle = colorToCss(cream, 0.92);
    ctx.fillRect(w * 0.09, 0, w * 0.036, h);
    ctx.fillStyle = colorToCss(shiftColor(THREE, accent, 0, 1.0, 0.05), 0.9);
    ctx.fillRect(w * 0.145, 0, w * 0.022, h);

    // Cozy dorm emblem: 5-point felt star + little twin sparkles
    const cx = w * 0.38;
    const cy = h * 0.50;
    const outerR = h * 0.24;
    const innerR = outerR * 0.44;
    ctx.fillStyle = colorToCss(emblemCol);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? outerR : innerR;
      const px = cx + Math.cos(ang) * r;
      const py = cy + Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Inner star stitch detail
    ctx.strokeStyle = colorToCss(feltDark, 0.35);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Small companion diamond dots toward the tip
    ctx.fillStyle = colorToCss(cream, 0.85);
    const drawDiamond = (dx, dy, r) => {
      ctx.beginPath();
      ctx.moveTo(dx, dy - r);
      ctx.lineTo(dx + r * 0.72, dy);
      ctx.lineTo(dx, dy + r);
      ctx.lineTo(dx - r * 0.72, dy);
      ctx.closePath();
      ctx.fill();
    };
    drawDiamond(w * 0.58, h * 0.50, 13);
    drawDiamond(w * 0.69, h * 0.50, 8);

    // Subtle wool fibres across entire pennant
    const rng = makeRng(515);
    ctx.lineWidth = 1;
    for (let i = 0; i < 900; i++) {
      ctx.strokeStyle = rng() < 0.5 ? colorToCss(feltLight, 0.22) : colorToCss(feltDark, 0.22);
      const px = rng() * w;
      const py = rng() * h;
      const a = rng() * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(a) * 6, py + Math.sin(a) * 6);
      ctx.stroke();
    }

    // Stitched top and bottom border along triangular edges
    ctx.strokeStyle = colorToCss(cream, 0.68);
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(w * 0.04, h * 0.06);
    ctx.lineTo(w * 0.94, h * 0.50);
    ctx.lineTo(w * 0.04, h * 0.94);
    ctx.stroke();
    ctx.setLineDash([]);
  });
  map.colorSpace = THREE.SRGBColorSpace;

  return map;
}

function makeRibbonTexture(THREE, kit, ribbonColor) {
  const dark = shiftColor(THREE, ribbonColor, 0, 1.05, -0.10);
  const light = shiftColor(THREE, ribbonColor, 0, 0.9, 0.12);
  const stitch = new THREE.Color(0xfff6e8);

  const map = kit.canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = colorToCss(ribbonColor);
    ctx.fillRect(0, 0, w, h);

    // Fine grosgrain ribbing across width
    for (let x = 0; x < w; x += 3) {
      ctx.fillStyle = x % 6 === 0 ? colorToCss(light, 0.18) : colorToCss(dark, 0.18);
      ctx.fillRect(x, 0, 2, h);
    }

    // Soft satin center sheen gradient
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, colorToCss(dark, 0.25));
    g.addColorStop(0.5, colorToCss(light, 0.16));
    g.addColorStop(1, colorToCss(dark, 0.25));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Delicate stitched edge lines
    ctx.strokeStyle = colorToCss(stitch, 0.58);
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(w, 12);
    ctx.moveTo(0, h - 12);
    ctx.lineTo(w, h - 12);
    ctx.stroke();
    ctx.setLineDash([]);
  });
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function makeTwineTexture(THREE, kit) {
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#d4bd98';
    ctx.fillRect(0, 0, w, h);
    // Braided diagonal hemp strands
    ctx.lineWidth = 5;
    for (let i = -h; i < w + h; i += 14) {
      ctx.strokeStyle = '#b4956b';
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h, h);
      ctx.stroke();

      ctx.strokeStyle = '#ead9bc';
      ctx.beginPath();
      ctx.moveTo(i + 5, 0);
      ctx.lineTo(i + h + 5, h);
      ctx.stroke();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeWashiTapeTexture(THREE, kit, accentColor) {
  const base = mixColors(THREE, new THREE.Color(0xfdf5e6), accentColor, 0.35);
  const stripe = shiftColor(THREE, accentColor, 0, 1.05, -0.08);
  const tex = kit.canvasTexture(128, 64, (ctx, w, h) => {
    ctx.fillStyle = colorToCss(base);
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = colorToCss(stripe, 0.55);
    for (let x = -h; x < w + h; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 7, 0);
      ctx.lineTo(x + 7 - h * 0.5, h);
      ctx.lineTo(x - h * 0.5, h);
      ctx.closePath();
      ctx.fill();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// Component builders
// ---------------------------------------------------------------------------

/**
 * Push pin with round bulbous head & sculpted waist (LatheGeometry, 20 points).
 * Origin at base of collar (z=0); head extends in +z, needle extends in -z.
 */
function createPushPinGeometries(THREE) {
  const headProfile = [
    new THREE.Vector2(0.0001, 0.0000),
    new THREE.Vector2(0.0038, 0.0000),
    new THREE.Vector2(0.0044, 0.0006),
    new THREE.Vector2(0.0041, 0.0014),
    new THREE.Vector2(0.0028, 0.0024),
    new THREE.Vector2(0.0021, 0.0038),
    new THREE.Vector2(0.0022, 0.0054),
    new THREE.Vector2(0.0031, 0.0068),
    new THREE.Vector2(0.0045, 0.0080),
    new THREE.Vector2(0.0056, 0.0094),
    new THREE.Vector2(0.0062, 0.0110),
    new THREE.Vector2(0.0063, 0.0126),
    new THREE.Vector2(0.0059, 0.0141),
    new THREE.Vector2(0.0051, 0.0154),
    new THREE.Vector2(0.0039, 0.0164),
    new THREE.Vector2(0.0025, 0.0171),
    new THREE.Vector2(0.0012, 0.0174),
    new THREE.Vector2(0.0000, 0.0175)
  ];
  const headGeo = new THREE.LatheGeometry(headProfile, 24);
  headGeo.rotateX(Math.PI / 2);

  const needleProfile = [
    new THREE.Vector2(0.0000, -0.0090),
    new THREE.Vector2(0.0004, -0.0072),
    new THREE.Vector2(0.00065, -0.0045),
    new THREE.Vector2(0.00072, 0.0005),
    new THREE.Vector2(0.0001, 0.0008)
  ];
  const needleGeo = new THREE.LatheGeometry(needleProfile, 12);
  needleGeo.rotateX(Math.PI / 2);

  return { headGeo, needleGeo };
}

function makePushPin(THREE, geos, headMat, metalMat, slot, tiltX = 0.04, tiltY = -0.05) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(geos.headGeo, headMat);
  head.userData.slot = slot;
  head.castShadow = true;
  head.receiveShadow = true;
  g.add(head);

  const needle = new THREE.Mesh(geos.needleGeo, metalMat);
  g.add(needle);

  g.rotation.set(tiltX, tiltY, 0);
  return g;
}

/**
 * Tiny wooden clothespin clip (2 sculpted ExtrudeGeometry jaws + coiled wire spring).
 */
function makeClothespin(THREE, woodMat, metalMat) {
  const g = new THREE.Group();

  // Jaw side silhouette in YZ (length along Y: +0.014 handle top to -0.015 jaw tip, thickness along Z)
  const jawShape = new THREE.Shape();
  jawShape.moveTo(0.0002, -0.0150);
  jawShape.lineTo(0.0018, -0.0146);
  jawShape.bezierCurveTo(0.0028, -0.0095, 0.0036, -0.0040, 0.0038, 0.0010);
  jawShape.bezierCurveTo(0.0040, 0.0055, 0.0048, 0.0105, 0.0050, 0.0138);
  jawShape.bezierCurveTo(0.0048, 0.0152, 0.0026, 0.0152, 0.0018, 0.0140);
  jawShape.bezierCurveTo(0.0014, 0.0090, 0.0011, 0.0045, 0.0014, 0.0015);
  // Small circular groove notch for gripping the string
  jawShape.bezierCurveTo(0.0020, 0.0002, 0.0020, -0.0022, 0.0009, -0.0032);
  jawShape.lineTo(0.0002, -0.0150);

  const extrudeOpts = {
    depth: 0.0062,
    bevelEnabled: true,
    bevelThickness: 0.0006,
    bevelSize: 0.0005,
    bevelSegments: 2,
    curveSegments: 10
  };
  const jawGeo = new THREE.ExtrudeGeometry(jawShape, extrudeOpts);
  // Center width on X and orient thickness on Z
  jawGeo.translate(0, 0, -0.0031);
  jawGeo.rotateY(-Math.PI / 2);

  const frontJaw = new THREE.Mesh(jawGeo, woodMat);
  frontJaw.userData.slot = 'wood';
  frontJaw.castShadow = true;
  g.add(frontJaw);

  const backJaw = new THREE.Mesh(jawGeo, woodMat);
  backJaw.scale.z = -1;
  backJaw.userData.slot = 'wood';
  backJaw.castShadow = true;
  g.add(backJaw);

  // Coiled metal spring wire wrapping around the middle waist
  const springPts = [
    new THREE.Vector3(-0.0037, 0.0042, 0.0039),
    new THREE.Vector3(-0.0040, 0.0006, 0.0043),
    new THREE.Vector3(-0.0040, -0.0016, 0.0000),
    new THREE.Vector3(-0.0040, 0.0006, -0.0043),
    new THREE.Vector3(-0.0037, 0.0042, -0.0039),
    new THREE.Vector3(0.0037, 0.0042, -0.0039),
    new THREE.Vector3(0.0040, 0.0006, -0.0043),
    new THREE.Vector3(0.0040, -0.0016, 0.0000),
    new THREE.Vector3(0.0040, 0.0006, 0.0043),
    new THREE.Vector3(0.0037, 0.0042, 0.0039)
  ];
  const springCurve = new THREE.CatmullRomCurve3(springPts);
  const springGeo = makeTaperedTube(THREE, springCurve, 32, 8, () => 0.00055, false, true);
  const spring = new THREE.Mesh(springGeo, metalMat);
  g.add(spring);

  return g;
}

/**
 * Miniature metallic wire binder clip (for Variant 2 wire grid panel).
 */
function makeBinderClip(THREE, bodyMat, wireMat, slot) {
  const g = new THREE.Group();

  // Folded triangular spring-steel body
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-0.0042, 0.0065);
  bodyShape.lineTo(0.0042, 0.0065);
  bodyShape.bezierCurveTo(0.0048, 0.0020, 0.0024, -0.0055, 0.0009, -0.0085);
  bodyShape.lineTo(-0.0009, -0.0085);
  bodyShape.bezierCurveTo(-0.0024, -0.0055, -0.0048, 0.0020, -0.0042, 0.0065);

  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 0.015,
    bevelEnabled: true,
    bevelThickness: 0.0008,
    bevelSize: 0.0007,
    bevelSegments: 2
  });
  bodyGeo.translate(0, 0, -0.0075);
  bodyGeo.rotateY(Math.PI / 2);

  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.userData.slot = slot;
  body.castShadow = true;
  g.add(body);

  // Two curved wire handles rising from top of clip
  for (const sgn of [-1, 1]) {
    const pts = [
      new THREE.Vector3(-0.0052, 0.0060, sgn * 0.0030),
      new THREE.Vector3(-0.0064, 0.0125, sgn * 0.0048),
      new THREE.Vector3(-0.0032, 0.0195, sgn * 0.0036),
      new THREE.Vector3(0.0000, 0.0210, sgn * 0.0028),
      new THREE.Vector3(0.0032, 0.0195, sgn * 0.0036),
      new THREE.Vector3(0.0064, 0.0125, sgn * 0.0048),
      new THREE.Vector3(0.0052, 0.0060, sgn * 0.0030)
    ];
    const hCurve = new THREE.CatmullRomCurve3(pts);
    const hGeo = makeTaperedTube(THREE, hCurve, 26, 7, () => 0.00065, false, true);
    const handle = new THREE.Mesh(hGeo, wireMat);
    g.add(handle);
  }

  return g;
}

/**
 * Sculpted satin/grosgrain ribbon bow with two gracefully draped, swaying tails.
 */
function makeRibbonBow(THREE, mat, slot) {
  const root = new THREE.Group();

  // Helper to build one sculptural loop of the bow
  function buildLoop(sideSign) {
    const pts = [
      new THREE.Vector3(0.000, 0.000, 0.004),
      new THREE.Vector3(sideSign * 0.018, 0.015, 0.014),
      new THREE.Vector3(sideSign * 0.044, 0.017, 0.018),
      new THREE.Vector3(sideSign * 0.052, 0.001, 0.013),
      new THREE.Vector3(sideSign * 0.041, -0.015, 0.007),
      new THREE.Vector3(sideSign * 0.017, -0.012, 0.004),
      new THREE.Vector3(0.000, -0.002, 0.003)
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    const count = 28;
    const samples = [];
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const p = curve.getPointAt(t);
      const tDir = curve.getTangentAt(t).normalize();
      // Outward loop normal points roughly radially away from loop center
      const center = new THREE.Vector3(sideSign * 0.025, 0.001, 0.009);
      const radial = p.clone().sub(center);
      // Blend radial with +z so the ribbon stays nicely visible from front
      const nDir = radial.normalize().multiplyScalar(0.55).add(new THREE.Vector3(0, 0, 0.85)).normalize();
      const wDir = new THREE.Vector3().crossVectors(nDir, tDir).normalize();
      const orthoN = new THREE.Vector3().crossVectors(tDir, wDir).normalize();
      samples.push({ p, tDir, nDir: orthoN, wDir });
    }
    const geo = makeRibbonStripGeometry(
      THREE,
      samples,
      (t) => {
        const pinch = Math.sin(t * Math.PI);
        return 0.007 + 0.0145 * Math.pow(pinch, 0.55);
      },
      0.0012,
      false
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.slot = slot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  root.add(buildLoop(-1));
  root.add(buildLoop(1));

  // Sculpted center knot (squashed pillowed sphere/band)
  const knotGeo = new THREE.SphereGeometry(0.0095, 24, 18);
  const kPos = knotGeo.attributes.position;
  for (let i = 0; i < kPos.count; i++) {
    let x = kPos.getX(i);
    let y = kPos.getY(i);
    let z = kPos.getZ(i);
    // Pinch waist slightly, flatten back, elongate vertically slightly
    const waist = 1.0 - 0.14 * Math.cos((y / 0.0095) * Math.PI);
    x *= 0.92 * waist;
    y *= 1.18;
    z = z * 0.72 + (z < 0 ? z * 0.3 : 0);
    kPos.setXYZ(i, x, y, z);
  }
  knotGeo.computeVertexNormals();
  const knot = new THREE.Mesh(knotGeo, mat);
  knot.position.set(0, 0, 0.0085);
  knot.userData.slot = slot;
  knot.castShadow = true;
  root.add(knot);

  // Two draped ribbon tails with swallowtail notched tips (inside animatable pivots)
  function buildTail(name, pts, widthBase) {
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.set(0, -0.004, 0.005);

    const curve = new THREE.CatmullRomCurve3(pts);
    const count = 26;
    const samples = [];
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const p = curve.getPointAt(t);
      const tDir = curve.getTangentAt(t).normalize();
      const twist = Math.sin(t * Math.PI * 1.15) * 0.28 * (name === 'ribbonTailL' ? -1 : 1);
      const nDir = new THREE.Vector3(Math.sin(twist) * 0.45, 0.08, Math.cos(twist)).normalize();
      const wDir = new THREE.Vector3().crossVectors(nDir, tDir).normalize();
      const orthoN = new THREE.Vector3().crossVectors(tDir, wDir).normalize();
      samples.push({ p, tDir, nDir: orthoN, wDir });
    }
    const geo = makeRibbonStripGeometry(
      THREE,
      samples,
      (t) => widthBase * (0.58 + 0.42 * Math.min(1, t * 2.8)),
      0.0010,
      true
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.slot = slot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    pivot.add(mesh);
    return pivot;
  }

  const tailL = buildTail(
    'ribbonTailL',
    [
      new THREE.Vector3(-0.003, 0.000, 0.002),
      new THREE.Vector3(-0.015, -0.028, 0.009),
      new THREE.Vector3(-0.026, -0.062, 0.005),
      new THREE.Vector3(-0.022, -0.095, 0.010),
      new THREE.Vector3(-0.030, -0.116, 0.014)
    ],
    0.019
  );
  root.add(tailL);

  const tailR = buildTail(
    'ribbonTailR',
    [
      new THREE.Vector3(0.003, 0.000, 0.002),
      new THREE.Vector3(0.014, -0.024, 0.008),
      new THREE.Vector3(0.021, -0.056, 0.011),
      new THREE.Vector3(0.029, -0.084, 0.007),
      new THREE.Vector3(0.024, -0.102, 0.012)
    ],
    0.0185
  );
  root.add(tailR);

  return root;
}

/**
 * Small sculpted felt dorm pennant with curved cloth drape, spine binding & tie strings.
 * Origin at left vertical spine centre (x=0, y=0); tip extends toward +x.
 */
function makePennant(THREE, feltMat, trimMat, stringMat) {
  const root = new THREE.Group();
  root.name = 'pennant';

  const len = 0.175;
  const halfH = 0.047;

  // Curved triangular felt body via ExtrudeGeometry + bezierCurveTo
  const shape = new THREE.Shape();
  shape.moveTo(0.004, halfH);
  shape.bezierCurveTo(len * 0.36, halfH * 0.68, len * 0.72, halfH * 0.28, len, 0.002);
  shape.bezierCurveTo(len + 0.002, 0.000, len + 0.002, -0.002, len, -0.002);
  shape.bezierCurveTo(len * 0.72, -halfH * 0.28, len * 0.36, -halfH * 0.68, 0.004, -halfH);
  shape.lineTo(0.004, halfH);

  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0022,
    bevelEnabled: true,
    bevelThickness: 0.0006,
    bevelSize: 0.0006,
    bevelSegments: 2,
    curveSegments: 24
  });

  // Subdivide/bend vertices smoothly for organic thick-felt cloth drape & normalize UVs
  const pos = bodyGeo.attributes.position;
  const uv = bodyGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const u = Math.max(0, Math.min(1, x / len));
    const v = Math.max(0, Math.min(1, (y + halfH) / (halfH * 2)));

    // Gentle S-curve cloth drape lifting slightly away from board toward the tip
    const drape = Math.sin(u * Math.PI * 1.25) * 0.0055 * u + u * u * 0.0065;
    const edgeCurl = Math.abs(v - 0.5) * 0.0025 * u;
    pos.setZ(i, z + drape + edgeCurl);
    uv.setXY(i, u, v);
  }
  bodyGeo.computeVertexNormals();

  const bodyMesh = new THREE.Mesh(bodyGeo, feltMat);
  bodyMesh.userData.slot = 'primary';
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  root.add(bodyMesh);

  // Contrasting fabric binding strip along the left vertical spine
  const spineShape = new THREE.Shape();
  spineShape.moveTo(-0.004, halfH + 0.002);
  spineShape.lineTo(0.009, halfH + 0.001);
  spineShape.lineTo(0.009, -halfH - 0.001);
  spineShape.lineTo(-0.004, -halfH - 0.002);
  spineShape.closePath();

  const spineGeo = new THREE.ExtrudeGeometry(spineShape, {
    depth: 0.0032,
    bevelEnabled: true,
    bevelThickness: 0.0008,
    bevelSize: 0.0007,
    bevelSegments: 2
  });
  spineGeo.translate(0, 0, -0.0004);
  const spineMesh = new THREE.Mesh(spineGeo, trimMat);
  spineMesh.userData.slot = 'secondary';
  spineMesh.castShadow = true;
  root.add(spineMesh);

  // Two cute tiny tapered tie-strings on the spine corners
  for (const sgn of [-1, 1]) {
    const tCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.003, sgn * (halfH - 0.004), 0.002),
      new THREE.Vector3(-0.015, sgn * (halfH + 0.002), 0.004),
      new THREE.Vector3(-0.022, sgn * (halfH - 0.006), 0.003),
      new THREE.Vector3(-0.016, sgn * (halfH - 0.015), 0.002)
    ]);
    const tGeo = makeTaperedTube(THREE, tCurve, 16, 7, (t) => 0.0012 * (1 - t * 0.25), false, true);
    const tMesh = new THREE.Mesh(tGeo, stringMat);
    tMesh.castShadow = true;
    root.add(tMesh);
  }

  return root;
}

/**
 * Tufted fabric board surface + crossed ribbons + fabric-covered buttons (Variant 1).
 */
function buildFabricMemoSurface(THREE, kit, innerW, innerH, primary, secondary, accent) {
  const group = new THREE.Group();
  const spacing = 0.18;
  const baseZ = 0.0145;

  function fabricZ(x, y) {
    const u = (x + y) / spacing;
    const v = (x - y) / spacing;
    const su = Math.abs(Math.sin(Math.PI * u));
    const sv = Math.abs(Math.sin(Math.PI * v));
    const puff = Math.pow(su * sv, 0.72) * 0.0068;

    const du = u - Math.round(u);
    const dv = v - Math.round(v);
    const dimple = Math.exp(-(du * du + dv * dv) * 26.0) * 0.0032;

    // Gentle taper right at the frame perimeter so it tucks cleanly inside the wood
    const edgeX = Math.max(0, 1 - Math.pow(Math.abs(x) / (innerW * 0.5), 10));
    const edgeY = Math.max(0, 1 - Math.pow(Math.abs(y) / (innerH * 0.5), 10));
    const edgeMask = Math.min(1, edgeX * edgeY * 1.15);

    return baseZ + (puff - dimple) * edgeMask;
  }

  // Dense pillowed fabric geometry (56 x 40)
  const segX = 56;
  const segY = 40;
  const fabGeo = new THREE.PlaneGeometry(innerW, innerH, segX, segY);
  const pos = fabGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, fabricZ(x, y));
  }
  fabGeo.computeVertexNormals();

  const fabTex = makeFabricBoardTextures(THREE, kit, secondary, innerW, innerH, spacing);
  const fabMat = new THREE.MeshPhysicalMaterial({
    map: fabTex.map,
    bumpMap: fabTex.bumpMap,
    bumpScale: 0.0012,
    roughness: 0.94,
    metalness: 0.0,
    sheen: 0.9,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color(0xfff8ee)
  });

  const fabMesh = new THREE.Mesh(fabGeo, fabMat);
  fabMesh.receiveShadow = true;
  group.add(fabMesh);

  // Crossed satin ribbons tucked into every tufted seam
  const ribbonTex = makeRibbonTexture(THREE, kit, secondary);
  const ribbonMat = new THREE.MeshPhysicalMaterial({
    map: ribbonTex,
    roughness: 0.52,
    metalness: 0.0,
    sheen: 0.85,
    sheenRoughness: 0.45,
    sheenColor: shiftColor(THREE, secondary, 0, 0.7, 0.25)
  });

  const hw = innerW * 0.5 - 0.002;
  const hh = innerH * 0.5 - 0.002;

  function clipLineToRect(slope, intercept) {
    // y = slope * x + intercept
    const hits = [];
    const yAtMinX = slope * (-hw) + intercept;
    if (yAtMinX >= -hh && yAtMinX <= hh) hits.push([-hw, yAtMinX]);
    const yAtMaxX = slope * hw + intercept;
    if (yAtMaxX >= -hh && yAtMaxX <= hh) hits.push([hw, yAtMaxX]);
    const xAtMinY = (-hh - intercept) / slope;
    if (xAtMinY > -hw && xAtMinY < hw) hits.push([xAtMinY, -hh]);
    const xAtMaxY = (hh - intercept) / slope;
    if (xAtMaxY > -hw && xAtMaxY < hw) hits.push([xAtMaxY, hh]);
    if (hits.length < 2) return null;
    hits.sort((a, b) => a[0] - b[0]);
    return [hits[0], hits[hits.length - 1]];
  }

  for (const slope of [-1, 1]) {
    const zBump = slope === 1 ? 0.0012 : 0.0020;
    for (let k = -4; k <= 4; k++) {
      const seg = clipLineToRect(slope, k * spacing);
      if (!seg) continue;
      const [p0, p1] = seg;
      const dist = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      if (dist < 0.04) continue;

      const steps = Math.max(12, Math.round(dist * 70));
      const samples = [];
      const dx = (p1[0] - p0[0]) / dist;
      const dy = (p1[1] - p0[1]) / dist;
      const tDir = new THREE.Vector3(dx, dy, 0);
      const nDir = new THREE.Vector3(0, 0, 1);
      const wDir = new THREE.Vector3().crossVectors(nDir, tDir).normalize();

      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const x = p0[0] + (p1[0] - p0[0]) * f;
        const y = p0[1] + (p1[1] - p0[1]) * f;
        const z = fabricZ(x, y) + zBump;
        samples.push({ p: new THREE.Vector3(x, y, z), tDir, nDir, wDir });
      }
      const rGeo = makeRibbonStripGeometry(THREE, samples, () => 0.0115, 0.0008, false);
      const rMesh = new THREE.Mesh(rGeo, ribbonMat);
      rMesh.userData.slot = 'secondary';
      rMesh.castShadow = true;
      rMesh.receiveShadow = true;
      group.add(rMesh);
    }
  }

  // Sculpted dome tufting buttons at ribbon intersections (LatheGeometry, 16 points)
  const btnProfile = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * (Math.PI * 0.52);
    const r = Math.sin(a) * 0.0068;
    const y = Math.cos(a) * 0.0036 + 0.0008;
    btnProfile.push(new THREE.Vector2(r, y));
  }
  btnProfile.reverse();
  btnProfile.unshift(new THREE.Vector2(0.0001, 0.0000));
  const btnGeo = new THREE.LatheGeometry(btnProfile, 20);
  btnGeo.rotateX(Math.PI / 2);

  const btnMat = new THREE.MeshPhysicalMaterial({
    color: shiftColor(THREE, accent, 0, 0.9, 0.02),
    roughness: 0.32,
    metalness: 0.45,
    clearcoat: 0.55,
    clearcoatRoughness: 0.2
  });

  for (let ku = -4; ku <= 4; ku++) {
    for (let kv = -4; kv <= 4; kv++) {
      const ix = ((ku + kv) * 0.5) * spacing;
      const iy = ((ku - kv) * 0.5) * spacing;
      if (Math.abs(ix) < hw - 0.032 && Math.abs(iy) < hh - 0.028) {
        const btn = new THREE.Mesh(btnGeo, btnMat);
        btn.position.set(ix, iy, fabricZ(ix, iy) + 0.0016);
        btn.userData.slot = 'accent';
        btn.castShadow = true;
        group.add(btn);
      }
    }
  }

  return { group, surfaceZ: (x, y) => fabricZ(x, y) + 0.0022 };
}

/**
 * Powder-coated wire grid panel with wooden wall-mount pegs (Variant 2).
 */
function buildWireGridPanel(THREE, outerW, outerH, woodMat, primary, accent) {
  const group = new THREE.Group();
  const hw = outerW * 0.5;
  const hh = outerH * 0.5;
  const gridZ = 0.015;

  const wireMat = new THREE.MeshPhysicalMaterial({
    color: shiftColor(THREE, primary, 0, 0.45, -0.18),
    roughness: 0.34,
    metalness: 0.72,
    clearcoat: 0.25,
    clearcoatRoughness: 0.3
  });

  // Outer rounded-rectangle frame wire via closed CatmullRomCurve3
  const cr = 0.020;
  const framePts = [];
  const corners = [
    [hw - cr, hh - cr, 0, Math.PI * 0.5],
    [-hw + cr, hh - cr, Math.PI * 0.5, Math.PI],
    [-hw + cr, -hh + cr, Math.PI, Math.PI * 1.5],
    [hw - cr, -hh + cr, Math.PI * 1.5, Math.PI * 2]
  ];
  for (const [cx, cy, a0, a1] of corners) {
    for (let i = 0; i <= 4; i++) {
      const a = a0 + (a1 - a0) * (i / 4);
      framePts.push(new THREE.Vector3(cx + Math.cos(a) * cr, cy + Math.sin(a) * cr, gridZ));
    }
  }
  const outerCurve = new THREE.CatmullRomCurve3(framePts, true, 'centripetal', 0.25);
  const outerGeo = makeTaperedTube(THREE, outerCurve, 96, 12, () => 0.0040, true, false);
  const outerMesh = new THREE.Mesh(outerGeo, wireMat);
  outerMesh.userData.slot = 'primary';
  outerMesh.castShadow = true;
  outerMesh.receiveShadow = true;
  group.add(outerMesh);

  // Interior vertical wires
  const vCols = 13;
  const vGeo = new THREE.CylinderGeometry(0.0015, 0.0015, outerH - 0.008, 8);
  for (let i = 1; i <= vCols; i++) {
    const x = -hw + (outerW * i) / (vCols + 1);
    const wMesh = new THREE.Mesh(vGeo, wireMat);
    wMesh.position.set(x, 0, gridZ - 0.0013);
    wMesh.userData.slot = 'primary';
    wMesh.castShadow = true;
    group.add(wMesh);
  }

  // Interior horizontal wires
  const hRows = 9;
  const hGeo = new THREE.CylinderGeometry(0.0015, 0.0015, outerW - 0.008, 8);
  hGeo.rotateZ(Math.PI / 2);
  for (let j = 1; j <= hRows; j++) {
    const y = -hh + (outerH * j) / (hRows + 1);
    const wMesh = new THREE.Mesh(hGeo, wireMat);
    wMesh.position.set(0, y, gridZ + 0.0013);
    wMesh.userData.slot = 'primary';
    wMesh.castShadow = true;
    group.add(wMesh);
  }

  // 4 sculpted wooden wall-mount standoffs (LatheGeometry, 18 points) flush at z=0
  const pegProfile = [
    new THREE.Vector2(0.0001, 0.0000),
    new THREE.Vector2(0.0115, 0.0000),
    new THREE.Vector2(0.0115, 0.0022),
    new THREE.Vector2(0.0098, 0.0045),
    new THREE.Vector2(0.0082, 0.0080),
    new THREE.Vector2(0.0076, 0.0115),
    new THREE.Vector2(0.0062, 0.0138),
    new THREE.Vector2(0.0058, 0.0156), // groove cradling wire at z=0.015
    new THREE.Vector2(0.0064, 0.0176),
    new THREE.Vector2(0.0088, 0.0195),
    new THREE.Vector2(0.0102, 0.0218),
    new THREE.Vector2(0.0100, 0.0242),
    new THREE.Vector2(0.0088, 0.0260),
    new THREE.Vector2(0.0066, 0.0272),
    new THREE.Vector2(0.0038, 0.0278),
    new THREE.Vector2(0.0000, 0.0280)
  ];
  const pegGeo = new THREE.LatheGeometry(pegProfile, 22);
  pegGeo.rotateX(Math.PI / 2);

  const brassMat = new THREE.MeshPhysicalMaterial({
    color: shiftColor(THREE, accent, 0, 0.85, 0.05),
    roughness: 0.28,
    metalness: 0.82
  });
  const screwGeo = new THREE.CylinderGeometry(0.0022, 0.0022, 0.0012, 12);
  screwGeo.rotateX(Math.PI / 2);

  const mountPositions = [
    [-0.27, hh - 0.005],
    [0.27, hh - 0.005],
    [-0.27, -hh + 0.005],
    [0.27, -hh + 0.005]
  ];
  for (const [mx, my] of mountPositions) {
    const peg = new THREE.Mesh(pegGeo, woodMat);
    peg.position.set(mx, my, 0);
    peg.userData.slot = 'wood';
    peg.castShadow = true;
    peg.receiveShadow = true;
    group.add(peg);

    const screw = new THREE.Mesh(screwGeo, brassMat);
    screw.position.set(mx, my, 0.0281);
    group.add(screw);
  }

  return { group, surfaceZ: () => gridZ + 0.0032 };
}

// ---------------------------------------------------------------------------
// Main build & idle exports
// ---------------------------------------------------------------------------

export function build(THREE, opts = {}, kit) {
  const root = new THREE.Group();
  root.name = 'wall_corkboard';

  const primary = resolveColor(THREE, opts.primary, 0xd67b63);
  const secondary = resolveColor(THREE, opts.secondary, 0x7d9b84);
  const accent = resolveColor(THREE, opts.accent, 0xe8b85c);
  const wood = resolveColor(THREE, opts.wood, 0xa9764d);
  const variant = (opts.variant === 1 || opts.variant === 2) ? opts.variant : 0;

  const W = 0.80;
  const H = 0.55;
  const borderW = 0.032;
  const frameDepth = 0.028;
  const innerW = W - borderW * 2 + 0.006;
  const innerH = H - borderW * 2 + 0.006;

  // Shared materials
  const woodTex = makeWoodTextures(THREE, kit, wood);
  const woodMat = new THREE.MeshPhysicalMaterial({
    map: woodTex.map,
    bumpMap: woodTex.bumpMap,
    bumpScale: 0.0014,
    roughness: 0.58,
    metalness: 0.0,
    clearcoat: 0.18,
    clearcoatRoughness: 0.45
  });

  const pinWoodMat = new THREE.MeshPhysicalMaterial({
    color: mixColors(THREE, wood, new THREE.Color(0xe6c9a2), 0.45),
    map: woodTex.map,
    roughness: 0.65,
    metalness: 0.0
  });

  const steelMat = new THREE.MeshPhysicalMaterial({
    color: 0xd8dce0,
    roughness: 0.22,
    metalness: 0.90
  });

  const brassMat = new THREE.MeshPhysicalMaterial({
    color: 0xd4ae64,
    roughness: 0.30,
    metalness: 0.85
  });

  // -------------------------------------------------------------------------
  // 1. Board Base (Variant 0 Cork, Variant 1 Fabric Memo, Variant 2 Wire Grid)
  // -------------------------------------------------------------------------
  let getSurfaceZ = () => 0.016;

  if (variant === 0 || variant === 1) {
    // Mitered sculpted wooden frame
    const frameGeo = makeMiteredFrameGeometry(THREE, W, H, borderW, frameDepth);
    const frameMesh = new THREE.Mesh(frameGeo, woodMat);
    frameMesh.userData.slot = 'wood';
    frameMesh.castShadow = true;
    frameMesh.receiveShadow = true;
    root.add(frameMesh);

    // Kraft-board backing flush at z=0.001 + brass keyhole hanger plates on back
    const backGeo = new THREE.BoxGeometry(W - 0.016, H - 0.016, 0.004);
    const backMat = new THREE.MeshPhysicalMaterial({
      color: 0x7c6550,
      roughness: 0.92,
      metalness: 0.0
    });
    const backMesh = new THREE.Mesh(backGeo, backMat);
    backMesh.position.set(0, 0, 0.0025);
    backMesh.receiveShadow = true;
    root.add(backMesh);

    const hangerGeo = new THREE.BoxGeometry(0.022, 0.036, 0.0012);
    for (const sx of [-1, 1]) {
      const plate = new THREE.Mesh(hangerGeo, brassMat);
      plate.position.set(sx * 0.28, 0.215, 0.0006);
      root.add(plate);
    }

    if (variant === 0) {
      // Cork surface with micro-undulation & rich speckled texture + bumpMap
      const corkTex = makeCorkTextures(THREE, kit);
      const corkGeo = new THREE.PlaneGeometry(innerW, innerH, 32, 22);
      const cPos = corkGeo.attributes.position;
      for (let i = 0; i < cPos.count; i++) {
        const x = cPos.getX(i);
        const y = cPos.getY(i);
        const micro = (kit.noise(x * 16 + 3, y * 16 + 5) - 0.5) * 0.0011;
        cPos.setZ(i, 0.0155 + micro);
      }
      corkGeo.computeVertexNormals();

      const corkMat = new THREE.MeshPhysicalMaterial({
        map: corkTex.map,
        bumpMap: corkTex.bumpMap,
        bumpScale: 0.0032,
        roughness: 0.95,
        metalness: 0.0,
        sheen: 0.15,
        sheenRoughness: 0.9,
        sheenColor: new THREE.Color(0xdfb888)
      });
      const corkMesh = new THREE.Mesh(corkGeo, corkMat);
      corkMesh.receiveShadow = true;
      root.add(corkMesh);
      getSurfaceZ = () => 0.0162;
    } else {
      // Variant 1: Tufted fabric memo board with crossed ribbons
      const memo = buildFabricMemoSurface(THREE, kit, innerW, innerH, primary, secondary, accent);
      root.add(memo.group);
      getSurfaceZ = memo.surfaceZ;
    }
  } else {
    // Variant 2: Powder-coated wire grid panel with wooden standoff mounts
    const grid = buildWireGridPanel(THREE, W, H, woodMat, primary, accent);
    root.add(grid.group);
    getSurfaceZ = grid.surfaceZ;
  }

  // -------------------------------------------------------------------------
  // 2. Fastener factories (Push pins for V0/V1, Wire binder clips for V2)
  // -------------------------------------------------------------------------
  const pinGeos = createPushPinGeometries(THREE);
  const pinMats = {
    primary: new THREE.MeshPhysicalMaterial({
      color: shiftColor(THREE, primary, 0, 1.08, 0.03),
      roughness: 0.18,
      metalness: 0.0,
      clearcoat: 0.92,
      clearcoatRoughness: 0.09
    }),
    secondary: new THREE.MeshPhysicalMaterial({
      color: shiftColor(THREE, secondary, 0, 1.05, 0.04),
      roughness: 0.18,
      metalness: 0.0,
      clearcoat: 0.92,
      clearcoatRoughness: 0.09
    }),
    accent: new THREE.MeshPhysicalMaterial({
      color: shiftColor(THREE, accent, 0, 1.08, 0.04),
      roughness: 0.18,
      metalness: 0.0,
      clearcoat: 0.92,
      clearcoatRoughness: 0.09
    }),
    cream: new THREE.MeshPhysicalMaterial({
      color: 0xf7efe0,
      roughness: 0.20,
      metalness: 0.0,
      clearcoat: 0.90,
      clearcoatRoughness: 0.10
    })
  };

  const clipBodyMats = {
    primary: new THREE.MeshPhysicalMaterial({
      color: shiftColor(THREE, primary, 0, 0.95, -0.06),
      roughness: 0.34,
      metalness: 0.55
    }),
    secondary: new THREE.MeshPhysicalMaterial({
      color: shiftColor(THREE, secondary, 0, 0.95, -0.06),
      roughness: 0.34,
      metalness: 0.55
    }),
    accent: new THREE.MeshPhysicalMaterial({
      color: shiftColor(THREE, accent, 0, 0.95, -0.04),
      roughness: 0.32,
      metalness: 0.62
    })
  };

  function placeFastener(x, y, z, colorKey, tiltX = 0.04, tiltY = -0.05, rotZ = 0) {
    if (variant === 2) {
      const key = clipBodyMats[colorKey] ? colorKey : 'accent';
      const clip = makeBinderClip(THREE, clipBodyMats[key], steelMat, key);
      clip.position.set(x, y + 0.005, z - 0.002);
      clip.rotation.z = rotZ;
      root.add(clip);
    } else {
      const mat = pinMats[colorKey] || pinMats.accent;
      const slot = colorKey === 'cream' ? 'secondary' : colorKey;
      const pin = makePushPin(THREE, pinGeos, mat, steelMat, slot, tiltX, tiltY);
      pin.position.set(x, y, z);
      root.add(pin);
    }
  }

  // -------------------------------------------------------------------------
  // 3. Blank Coloured Cards at Slight Angles with Curled Corners
  // -------------------------------------------------------------------------
  const pastelPrimary = mixColors(THREE, primary, new THREE.Color(0xfff6ee), 0.48);
  const pastelSecondary = mixColors(THREE, secondary, new THREE.Color(0xfbf8f0), 0.55);
  const pastelAccent = mixColors(THREE, accent, new THREE.Color(0xfff9ec), 0.45);
  const warmCreamCard = new THREE.Color(0xf7efe0);

  function addCurledCard(cfg) {
    const tex = makeCardTexture(THREE, kit, cfg.color, cfg.seed);
    const mat = new THREE.MeshPhysicalMaterial({
      map: tex,
      roughness: 0.88,
      metalness: 0.0,
      sheen: 0.25,
      sheenRoughness: 0.85,
      sheenColor: new THREE.Color(0xffffff)
    });
    const geo = makeCurledCardGeometry(THREE, cfg.w, cfg.h, 0.0009, cfg.curl);
    const mesh = new THREE.Mesh(geo, mat);
    const zBase = getSurfaceZ(cfg.x, cfg.y) + cfg.zOff;
    mesh.position.set(cfg.x, cfg.y, zBase);
    mesh.rotation.z = cfg.rotZ;
    mesh.userData.slot = cfg.slot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);

    // Pin/clip near top centre of tilted card
    const localPinY = cfg.h * 0.5 - 0.011;
    const px = cfg.x - Math.sin(cfg.rotZ) * localPinY;
    const py = cfg.y + Math.cos(cfg.rotZ) * localPinY;
    placeFastener(px, py, zBase + 0.0008, cfg.pinKey, cfg.pinTiltX, cfg.pinTiltY, cfg.rotZ);
  }

  // Card 1: Upper-left pastel primary card, curled bottom-right corner
  addCurledCard({
    x: -0.225, y: 0.110, zOff: 0.0012,
    w: 0.155, h: 0.112, rotZ: 0.075,
    color: pastelPrimary, slot: 'primary', seed: 11,
    curl: { bow: 0.0016, br: 0.0115, tl: 0.003 },
    pinKey: 'accent', pinTiltX: 0.06, pinTiltY: -0.05
  });

  // Card 2: Mid-left soft sage/secondary card overlapping bottom-left of Card 1
  addCurledCard({
    x: -0.268, y: -0.008, zOff: 0.0034,
    w: 0.116, h: 0.132, rotZ: -0.105,
    color: pastelSecondary, slot: 'secondary', seed: 23,
    curl: { bow: 0.0014, bl: 0.010, tr: 0.0055 },
    pinKey: 'primary', pinTiltX: -0.04, pinTiltY: 0.07
  });

  // Card 3: Small accent sticky note overlapping lower-right of the photo
  addCurledCard({
    x: 0.095, y: 0.018, zOff: 0.0046,
    w: 0.080, h: 0.080, rotZ: 0.125,
    color: pastelAccent, slot: 'accent', seed: 37,
    curl: { bow: 0.0010, bottomLift: 0.0135, br: 0.004 },
    pinKey: 'secondary', pinTiltX: 0.05, pinTiltY: 0.04
  });

  // -------------------------------------------------------------------------
  // 4. Instant-Print Photo with Abstract Picture + Washi Tape Corner
  // -------------------------------------------------------------------------
  const photoTex = makeAbstractPhotoTexture(THREE, kit, primary, secondary, accent);
  const photoMat = new THREE.MeshPhysicalMaterial({
    map: photoTex,
    roughness: 0.24,
    metalness: 0.0,
    clearcoat: 0.68,
    clearcoatRoughness: 0.16
  });

  const photoX = -0.018;
  const photoY = 0.085;
  const photoW = 0.142;
  const photoH = 0.172;
  const photoRot = -0.052;
  const photoZ = getSurfaceZ(photoX, photoY) + 0.0022;

  const photoGeo = makeCurledCardGeometry(THREE, photoW, photoH, 0.0011, {
    bow: 0.0022,
    bl: 0.0065,
    br: 0.0035
  });
  const photoMesh = new THREE.Mesh(photoGeo, photoMat);
  photoMesh.position.set(photoX, photoY, photoZ);
  photoMesh.rotation.z = photoRot;
  photoMesh.castShadow = true;
  photoMesh.receiveShadow = true;
  root.add(photoMesh);

  // Pin at top centre of photo
  const pLocalY = photoH * 0.5 - 0.012;
  placeFastener(
    photoX - Math.sin(photoRot) * pLocalY,
    photoY + Math.cos(photoRot) * pLocalY,
    photoZ + 0.0010,
    'cream',
    -0.05,
    -0.06,
    photoRot
  );

  // Diagonal strip of translucent patterned washi tape on top-right corner of photo
  const tapeTex = makeWashiTapeTexture(THREE, kit, accent);
  const tapeMat = new THREE.MeshPhysicalMaterial({
    map: tapeTex,
    roughness: 0.72,
    metalness: 0.0,
    transparent: true,
    opacity: 0.84
  });
  const tapeGeo = makeCurledCardGeometry(THREE, 0.044, 0.013, 0.0004, { bow: 0.0008 });
  const tapeMesh = new THREE.Mesh(tapeGeo, tapeMat);
  tapeMesh.position.set(photoX + 0.060, photoY + 0.070, photoZ + 0.0018);
  tapeMesh.rotation.z = -0.68;
  tapeMesh.userData.slot = 'accent';
  root.add(tapeMesh);

  // -------------------------------------------------------------------------
  // 5. Sculpted Ribbon Bow with Draped Tails (Upper-Right)
  // -------------------------------------------------------------------------
  const ribbonBowTex = makeRibbonTexture(THREE, kit, accent);
  const ribbonBowMat = new THREE.MeshPhysicalMaterial({
    map: ribbonBowTex,
    roughness: 0.52,
    metalness: 0.0,
    sheen: 0.92,
    sheenRoughness: 0.42,
    sheenColor: shiftColor(THREE, accent, 0, 0.7, 0.28)
  });

  const ribX = 0.255;
  const ribY = 0.145;
  const ribZ = getSurfaceZ(ribX, ribY) + 0.0015;
  const ribbonBow = makeRibbonBow(THREE, ribbonBowMat, 'accent');
  ribbonBow.position.set(ribX, ribY, ribZ);
  ribbonBow.rotation.z = -0.06;
  root.add(ribbonBow);

  // Pin holding ribbon bow right above its knot
  placeFastener(ribX, ribY + 0.012, ribZ + 0.006, 'primary', 0.07, 0.04, -0.06);

  // -------------------------------------------------------------------------
  // 6. Small Felt Pennant (Mid-Right)
  // -------------------------------------------------------------------------
  const pennantTex = makePennantTexture(THREE, kit, primary, secondary, accent);
  const pennantMat = new THREE.MeshPhysicalMaterial({
    map: pennantTex,
    roughness: 0.95,
    metalness: 0.0,
    sheen: 0.88,
    sheenRoughness: 0.75,
    sheenColor: shiftColor(THREE, primary, 0, 0.6, 0.22)
  });
  const pennantTrimMat = new THREE.MeshPhysicalMaterial({
    color: 0xf7efe0,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.85,
    sheenColor: new THREE.Color(0xffffff)
  });
  const twineTex = makeTwineTexture(THREE, kit);
  const twineMat = new THREE.MeshPhysicalMaterial({
    map: twineTex,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.45,
    sheenColor: new THREE.Color(0xf3e4c8)
  });

  const penX = 0.155;
  const penY = -0.025;
  const penRot = -0.105;
  const penZ = getSurfaceZ(penX + 0.06, penY) + 0.0022;

  const pennant = makePennant(THREE, pennantMat, pennantTrimMat, twineMat);
  pennant.position.set(penX, penY, penZ);
  pennant.rotation.z = penRot;
  root.add(pennant);

  // Fasten pennant spine at top-left and bottom-left
  const spOff = 0.036;
  placeFastener(
    penX - Math.sin(penRot) * spOff,
    penY + Math.cos(penRot) * spOff,
    penZ + 0.0028,
    'accent',
    0.05,
    -0.06,
    penRot
  );
  if (variant !== 2) {
    placeFastener(
      penX + Math.sin(penRot) * spOff,
      penY - Math.cos(penRot) * spOff,
      penZ + 0.0028,
      'secondary',
      -0.05,
      -0.04,
      penRot
    );
  }

  // -------------------------------------------------------------------------
  // 7. Draped String with Two Tiny Clips (Lower Span)
  // -------------------------------------------------------------------------
  const strStartX = -0.325;
  const strStartY = -0.118;
  const strEndX = 0.305;
  const strEndY = -0.132;
  const strBaseZ = Math.max(getSurfaceZ(0, -0.15), 0.017) + 0.0045;

  const stringPts = [
    new THREE.Vector3(strStartX, strStartY, strBaseZ + 0.001),
    new THREE.Vector3(-0.18, -0.148, strBaseZ + 0.006),
    new THREE.Vector3(-0.02, -0.162, strBaseZ + 0.009),
    new THREE.Vector3(0.15, -0.154, strBaseZ + 0.007),
    new THREE.Vector3(strEndX, strEndY, strBaseZ + 0.001)
  ];
  const stringCurve = new THREE.CatmullRomCurve3(stringPts);
  const stringGeo = makeTaperedTube(THREE, stringCurve, 56, 10, () => 0.00135, false, true);
  const stringMesh = new THREE.Mesh(stringGeo, twineMat);
  stringMesh.castShadow = true;
  root.add(stringMesh);

  // Small wrapped twine loops + anchor push pins (or tied knots on V2) at both ends
  for (const [ax, ay, isLeft] of [[strStartX, strStartY, true], [strEndX, strEndY, false]]) {
    const loopPts = [];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      loopPts.push(new THREE.Vector3(ax + Math.cos(a) * 0.0038, ay + Math.sin(a) * 0.0038, strBaseZ + 0.0008));
    }
    const loopGeo = makeTaperedTube(THREE, new THREE.CatmullRomCurve3(loopPts, true), 20, 7, () => 0.0012, true, false);
    root.add(new THREE.Mesh(loopGeo, twineMat));

    if (variant !== 2) {
      const pin = makePushPin(
        THREE,
        pinGeos,
        isLeft ? pinMats.secondary : pinMats.primary,
        steelMat,
        isLeft ? 'secondary' : 'primary',
        0.04,
        isLeft ? -0.07 : 0.07
      );
      pin.position.set(ax, ay, strBaseZ - 0.0022);
      root.add(pin);
    } else {
      // Cute dangling knot tails wrapped around the wire grid
      const tailGeo = makeTaperedTube(
        THREE,
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(ax, ay, strBaseZ),
          new THREE.Vector3(ax + (isLeft ? -0.006 : 0.006), ay - 0.012, strBaseZ + 0.002),
          new THREE.Vector3(ax + (isLeft ? -0.004 : 0.004), ay - 0.022, strBaseZ + 0.001)
        ]),
        12,
        6,
        (t) => 0.0012 * (1 - t * 0.3),
        false,
        true
      );
      root.add(new THREE.Mesh(tailGeo, twineMat));
    }
  }

  // Two tiny wooden clothespins clipped onto the draped string, holding miniature curled cards
  const clipSpecs = [
    {
      name: 'clip1',
      t: 0.30,
      cardW: 0.086,
      cardH: 0.064,
      cardRot: 0.08,
      cardColor: warmCreamCard,
      slot: 'secondary',
      seed: 61,
      curl: { bow: 0.0014, br: 0.0085 }
    },
    {
      name: 'clip2',
      t: 0.67,
      cardW: 0.092,
      cardH: 0.062,
      cardRot: -0.07,
      cardColor: pastelPrimary,
      slot: 'primary',
      seed: 79,
      curl: { bow: 0.0014, bl: 0.009 }
    }
  ];

  for (const cs of clipSpecs) {
    const pt = stringCurve.getPointAt(cs.t);
    const tan = stringCurve.getTangentAt(cs.t);
    const slopeAngle = Math.atan2(tan.y, tan.x);

    const pivot = new THREE.Group();
    pivot.name = cs.name;
    pivot.position.copy(pt);
    pivot.rotation.z = slopeAngle * 0.55 + cs.cardRot * 0.4;

    const clothespin = makeClothespin(THREE, pinWoodMat, steelMat);
    clothespin.position.set(0, -0.001, 0.0015);
    pivot.add(clothespin);

    // Clipped miniature blank coloured card hanging from the jaws
    const miniTex = makeCardTexture(THREE, kit, cs.cardColor, cs.seed);
    const miniMat = new THREE.MeshPhysicalMaterial({
      map: miniTex,
      roughness: 0.88,
      metalness: 0.0,
      sheen: 0.22,
      sheenColor: new THREE.Color(0xffffff)
    });
    const miniGeo = makeCurledCardGeometry(THREE, cs.cardW, cs.cardH, 0.0008, cs.curl);
    const miniCard = new THREE.Mesh(miniGeo, miniMat);
    miniCard.position.set(0, -(cs.cardH * 0.5 + 0.0075), 0.0005);
    miniCard.rotation.z = cs.cardRot * 0.6;
    miniCard.userData.slot = cs.slot;
    miniCard.castShadow = true;
    miniCard.receiveShadow = true;
    pivot.add(miniCard);

    root.add(pivot);
  }

  // Record base rotations for smooth, additive idle animation
  root.userData.animBase = {};
  for (const childName of ['ribbonTailL', 'ribbonTailR', 'pennant', 'clip1', 'clip2']) {
    const obj = root.getObjectByName(childName);
    if (obj) {
      root.userData.animBase[childName] = {
        rx: obj.rotation.x,
        ry: obj.rotation.y,
        rz: obj.rotation.z
      };
    }
  }

  return root;
}

/**
 * Cozy gentle room-draft animation on hanging ribbon tails, pennant tip & clipped cards.
 */
export function idle(group, t) {
  const base = group.userData.animBase;
  if (!base) return;

  const tailL = group.getObjectByName('ribbonTailL');
  if (tailL && base.ribbonTailL) {
    tailL.rotation.z = base.ribbonTailL.rz + Math.sin(t * 1.15) * 0.028;
    tailL.rotation.x = base.ribbonTailL.rx + Math.sin(t * 0.85 + 0.6) * 0.018;
  }

  const tailR = group.getObjectByName('ribbonTailR');
  if (tailR && base.ribbonTailR) {
    tailR.rotation.z = base.ribbonTailR.rz + Math.sin(t * 1.15 + 1.1) * 0.024;
    tailR.rotation.x = base.ribbonTailR.rx + Math.cos(t * 0.8 + 0.3) * 0.016;
  }

  const pennant = group.getObjectByName('pennant');
  if (pennant && base.pennant) {
    pennant.rotation.y = base.pennant.ry + Math.sin(t * 0.95 + 0.4) * 0.014;
  }

  const clip1 = group.getObjectByName('clip1');
  if (clip1 && base.clip1) {
    clip1.rotation.z = base.clip1.rz + Math.sin(t * 1.35 + 0.2) * 0.024;
    clip1.rotation.x = base.clip1.rx + Math.sin(t * 0.9 + 1.0) * 0.015;
  }

  const clip2 = group.getObjectByName('clip2');
  if (clip2 && base.clip2) {
    clip2.rotation.z = base.clip2.rz + Math.sin(t * 1.25 + 1.7) * 0.026;
    clip2.rotation.x = base.clip2.rx + Math.cos(t * 0.95 + 0.5) * 0.015;
  }
}
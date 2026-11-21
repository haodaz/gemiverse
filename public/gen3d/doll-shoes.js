// SHOES AND SOCKS module for the stylised ball-jointed doll
// Plain ES module: no imports, no globals (THREE and kit arrive as arguments).

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

function evalCubicBezier(p0, p1, p2, p3, t, out) {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  const a = uu * u;
  const b = 3 * uu * t;
  const c = 3 * u * tt;
  const d = tt * t;
  out.set(
    a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    a * p0.z + b * p1.z + c * p2.z + d * p3.z
  );
  return out;
}

// ---------- Painted Procedural Fabric & Leather Textures ----------

function makeTexturePair(THREE, kit, size, drawColor, drawBump, repeatX, repeatY) {
  const map = kit.canvasTexture(size, size, drawColor);
  const bumpMap = kit.canvasTexture(size, size, drawBump);
  for (const tex of [map, bumpMap]) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  if (THREE.SRGBColorSpace) map.colorSpace = THREE.SRGBColorSpace;
  return { map, bumpMap };
}

function makeKnitTextures(THREE, kit, bandRatio) {
  const sz = 256;
  const ribs = 24;
  const draw = (isBump) => (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const bandStart = 1 - bandRatio;
    for (let y = 0; y < h; y++) {
      const v = 1 - y / h;
      const inBand = smoothstep(bandStart - 0.03, bandStart + 0.02, v);
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const ribWave = Math.cos(u * ribs * Math.PI * 2);
        const fineWale = Math.cos(u * ribs * 2 * Math.PI * 2);
        const coursePhase = (v * 72 + Math.abs(((u * ribs * 2) % 1) - 0.5) * 0.9) * Math.PI * 2;
        const stitch = Math.sin(coursePhase) * 0.5 + 0.5;
        const fuzz = kit.noise(u * 38, v * 38) * 0.14 + kit.noise(u * 90, v * 90) * 0.08;

        const bodyH = 0.52 + fineWale * 0.14 + (stitch - 0.5) * 0.16 + fuzz;
        const bandH = 0.5 + ribWave * 0.34 + (stitch - 0.5) * 0.10 + fuzz * 0.7;
        let val = lerp(bodyH, bandH, inBand);

        // Subtle knitted seam line at top edge
        const hemDip = smoothstep(0.96, 0.985, v) * (1 - smoothstep(0.985, 1.0, v));
        val -= hemDip * 0.16;

        const idx = (y * w + x) * 4;
        if (isBump) {
          const b = clamp(Math.round(val * 255), 0, 255);
          d[idx] = b;
          d[idx + 1] = b;
          d[idx + 2] = b;
          d[idx + 3] = 255;
        } else {
          const shade = clamp(0.84 + (val - 0.5) * 0.30, 0.68, 1.0);
          const c = Math.round(shade * 255);
          d[idx] = c;
          d[idx + 1] = c;
          d[idx + 2] = Math.min(255, Math.round(c * 0.995));
          d[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  };
  return makeTexturePair(THREE, kit, sz, draw(false), draw(true), 1, 1);
}

function makeCanvasTextures(THREE, kit) {
  const sz = 256;
  const draw = (isBump) => (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const v = y / h;
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const warp = Math.sin(u * 64 * Math.PI * 2);
        const weft = Math.sin(v * 64 * Math.PI * 2);
        const over = ((Math.floor(u * 64) + Math.floor(v * 64)) & 1) ? 1 : -1;
        const weave = 0.5 + 0.22 * (over > 0 ? warp : weft) + 0.08 * (over > 0 ? weft : warp);
        const grain = kit.noise(u * 26, v * 26) * 0.16 + kit.noise(u * 70, v * 70) * 0.08;
        const val = clamp(weave + grain - 0.10, 0, 1);
        const idx = (y * w + x) * 4;
        if (isBump) {
          const b = Math.round(val * 255);
          d[idx] = b; d[idx + 1] = b; d[idx + 2] = b; d[idx + 3] = 255;
        } else {
          const c = Math.round(clamp(0.88 + (val - 0.5) * 0.22, 0.74, 1.0) * 255);
          d[idx] = c; d[idx + 1] = c; d[idx + 2] = c; d[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    // Subtle stitched reinforcement lines
    ctx.strokeStyle = isBump ? "rgba(235,235,235,0.65)" : "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.18);
    ctx.lineTo(w, h * 0.18);
    ctx.moveTo(0, h * 0.22);
    ctx.lineTo(w, h * 0.22);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  return makeTexturePair(THREE, kit, sz, draw(false), draw(true), 2, 2);
}

function makeLeatherTextures(THREE, kit, patent) {
  const sz = 256;
  const draw = (isBump) => (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const amp = patent ? 0.07 : 0.24;
    for (let y = 0; y < h; y++) {
      const v = y / h;
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const n1 = kit.noise(u * 20, v * 20);
        const n2 = kit.noise(u * 48 + 7.1, v * 48 + 3.4);
        const n3 = kit.noise(u * 96 + 2.3, v * 96 + 9.7);
        const pebble = (n1 * 0.45 + n2 * 0.35 + n3 * 0.20) - 0.5;
        const val = clamp(0.5 + pebble * amp * 2.2, 0, 1);
        const idx = (y * w + x) * 4;
        if (isBump) {
          const b = Math.round(val * 255);
          d[idx] = b; d[idx + 1] = b; d[idx + 2] = b; d[idx + 3] = 255;
        } else {
          const shade = clamp(0.93 + pebble * (patent ? 0.06 : 0.18), 0.78, 1.0);
          const c = Math.round(shade * 255);
          d[idx] = c; d[idx + 1] = c; d[idx + 2] = c; d[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  };
  return makeTexturePair(THREE, kit, sz, draw(false), draw(true), 2, 2);
}

function makeSoleTextures(THREE, kit, style) {
  const sz = 256;
  const draw = (isBump) => (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const v = y / h;
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const grain = kit.noise(u * 40, v * 40) * 0.16;
        let val = 0.5 + grain;
        if (style === "sneakers") {
          // Fine vertical foxing knurling
          val += Math.sin(u * 96 * Math.PI * 2) * 0.12;
        } else if (style === "loafers" || style === "maryJanes") {
          // Subtle stacked-leather heel layers
          val += Math.sin(v * 28 * Math.PI * 2) * 0.14;
        } else {
          // Rugged matte rubber
          val += (kit.noise(u * 75, v * 75) - 0.5) * 0.26;
        }
        val = clamp(val, 0, 1);
        const idx = (y * w + x) * 4;
        if (isBump) {
          const b = Math.round(val * 255);
          d[idx] = b; d[idx + 1] = b; d[idx + 2] = b; d[idx + 3] = 255;
        } else {
          const c = Math.round(clamp(0.86 + (val - 0.5) * 0.22, 0.72, 1.0) * 255);
          d[idx] = c; d[idx + 1] = c; d[idx + 2] = c; d[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  };
  return makeTexturePair(THREE, kit, sz, draw(false), draw(true), 2, 1);
}

// ---------- Shared Geometry Helpers ----------

function stitchSeamNormals(geom, ringCount, cols) {
  const norm = geom.attributes.normal;
  for (let i = 0; i < ringCount; i++) {
    const i0 = i * cols;
    const i1 = i0 + (cols - 1);
    const nx = norm.getX(i0) + norm.getX(i1);
    const ny = norm.getY(i0) + norm.getY(i1);
    const nz = norm.getZ(i0) + norm.getZ(i1);
    const len = Math.hypot(nx, ny, nz) || 1;
    norm.setXYZ(i0, nx / len, ny / len, nz / len);
    norm.setXYZ(i1, nx / len, ny / len, nz / len);
  }
  norm.needsUpdate = true;
}

// Builds a closed-radial loft from an array of rings; each ring has `radialSegs` Vector3 points
// ordered right-handedly around +Y (starting at +Z toward +X so outward normals face away from axis).
function buildLoftGeometry(THREE, rings, radialSegs, capBottom, capTop) {
  const cols = radialSegs + 1;
  const ringCount = rings.length;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i < ringCount; i++) {
    const ring = rings[i];
    const v = ringCount > 1 ? i / (ringCount - 1) : 0;
    for (let j = 0; j <= radialSegs; j++) {
      const p = ring[j % radialSegs];
      positions.push(p.x, p.y, p.z);
      uvs.push(j / radialSegs, v);
    }
  }

  for (let i = 0; i < ringCount - 1; i++) {
    const r0 = i * cols;
    const r1 = (i + 1) * cols;
    for (let j = 0; j < radialSegs; j++) {
      const a = r0 + j;
      const b = r0 + j + 1;
      const c = r1 + j + 1;
      const d = r1 + j;
      indices.push(a, b, c, a, c, d);
    }
  }

  if (capBottom) {
    const ring = rings[0];
    const cx = ring.reduce((s, p) => s + p.x, 0) / radialSegs;
    const cy = ring.reduce((s, p) => s + p.y, 0) / radialSegs;
    const cz = ring.reduce((s, p) => s + p.z, 0) / radialSegs;
    const cIdx = positions.length / 3;
    positions.push(cx, cy, cz);
    uvs.push(0.5, 0.5);
    const base = positions.length / 3;
    for (let j = 0; j <= radialSegs; j++) {
      const p = ring[j % radialSegs];
      positions.push(p.x, p.y, p.z);
      uvs.push(0.5 + 0.5 * Math.sin((j / radialSegs) * Math.PI * 2), 0.5 + 0.5 * Math.cos((j / radialSegs) * Math.PI * 2));
    }
    for (let j = 0; j < radialSegs; j++) {
      indices.push(cIdx, base + j + 1, base + j);
    }
  }

  if (capTop) {
    const ring = rings[ringCount - 1];
    const cx = ring.reduce((s, p) => s + p.x, 0) / radialSegs;
    const cy = ring.reduce((s, p) => s + p.y, 0) / radialSegs;
    const cz = ring.reduce((s, p) => s + p.z, 0) / radialSegs;
    const cIdx = positions.length / 3;
    positions.push(cx, cy, cz);
    uvs.push(0.5, 0.5);
    const base = positions.length / 3;
    for (let j = 0; j <= radialSegs; j++) {
      const p = ring[j % radialSegs];
      positions.push(p.x, p.y, p.z);
      uvs.push(0.5 + 0.5 * Math.sin((j / radialSegs) * Math.PI * 2), 0.5 + 0.5 * Math.cos((j / radialSegs) * Math.PI * 2));
    }
    for (let j = 0; j < radialSegs; j++) {
      indices.push(cIdx, base + j, base + j + 1);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  stitchSeamNormals(geom, ringCount, cols);
  return geom;
}

// Sweeps a smooth rounded-rectangle cross-section (32+ segments) along a 3D curve with a reference normal.
function buildRibbonBand(THREE, points, normals, halfWidth, halfThick, radialSegs = 32, closedLoop = false) {
  const n = points.length;
  const rings = [];
  const tang = new THREE.Vector3();
  const binorm = new THREE.Vector3();
  const norm = new THREE.Vector3();

  for (let i = 0; i < n; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(n - 1, i + 1)];
    tang.subVectors(next, prev).normalize();
    norm.copy(normals[i]).normalize();
    binorm.crossVectors(tang, norm).normalize();
    norm.crossVectors(binorm, tang).normalize();

    const ring = [];
    for (let j = 0; j < radialSegs; j++) {
      const a = (j / radialSegs) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      // Rounded-rect superellipse (smooth everywhere)
      const sw = Math.sign(sa) * Math.pow(Math.abs(sa), 0.65) * halfWidth;
      const st = Math.sign(ca) * Math.pow(Math.abs(ca), 0.65) * halfThick;
      const p = new THREE.Vector3()
        .copy(points[i])
        .addScaledVector(binorm, sw)
        .addScaledVector(norm, st);
      ring.push(p);
    }
    rings.push(ring);
  }

  if (closedLoop) {
    rings.push(rings[0].map((p) => p.clone()));
  }

  // Flip ring order so cross-section winds right-handedly along tangent
  const flipped = rings.map((r) => r.slice().reverse());
  return buildLoftGeometry(THREE, flipped, radialSegs, !closedLoop, !closedLoop);
}

// ---------- Parametric Shoe Last & Upper Surface ----------

function makeShoeLast(THREE, sideSign, bw, bh, style) {
  const yFloor = -0.065;
  const soleH = style === "sneakers" || style === "boots" ? 0.015 : 0.010;
  const ySoleTop = yFloor + soleH;
  const zHeel = -0.025 * bw - 0.003;
  const zToe = 0.066 * bh + 0.009 * bw;
  const zMid = (zHeel + zToe) * 0.5;
  const halfL = (zToe - zHeel) * 0.5;
  const wBase = 0.020 * bw + 0.0095;

  // Perimeter point at angle a (a=0 toe +Z, a=pi/2 +X, a=pi heel -Z, a=-pi/2 -X)
  function basePerimeter(a, expand = 0) {
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const s = (ca + 1) * 0.5; // 0 heel -> 1 toe
    const lat = sideSign * sa; // +1 outer/lateral, -1 inner/medial

    // Plump chibi toe, gentle medial arch pinch, snug heel
    const heelW = 0.84;
    const foreSwell = 0.13 * Math.exp(-Math.pow((s - 0.72) / 0.26, 2));
    const toeFull = 0.10 * smoothstep(0.55, 1.0, s);
    const archPinch = (lat < 0 ? -0.10 : 0.02) * Math.exp(-Math.pow((s - 0.36) / 0.16, 2));
    const halfW = wBase * (heelW + foreSwell + toeFull + archPinch) + expand;

    const xCenter = sideSign * (0.0018 * Math.sin(s * Math.PI) - 0.0014 * smoothstep(0.6, 1.0, s));
    const z = zMid + (halfL + expand) * ca;
    const x = xCenter + halfW * sa;

    // Gentle toe spring at very front
    const toeSpring = 0.0032 * Math.pow(smoothstep(0.76, 1.0, s), 1.6);
    return { x, z, s, lat, toeSpring };
  }

  // Opening / collar rim loop P1(a) tailored to each style
  function collarPoint(a) {
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const s = (ca + 1) * 0.5;
    const ankleR = 0.022 * bw;
    let zBack, zFront, yBack, ySide, yFront, rxBack, rxFront;

    if (style === "sneakers") {
      zBack = -ankleR - 0.004;
      zFront = 0.036 * bh + 0.003 * bw;
      yBack = 0.006;
      ySide = -0.011;
      yFront = -0.018;
      rxBack = ankleR + 0.0075;
      rxFront = 0.014 * bw + 0.002;
    } else if (style === "maryJanes") {
      zBack = -ankleR - 0.004;
      zFront = 0.043 * bh + 0.003 * bw;
      yBack = -0.014;
      ySide = -0.034;
      yFront = -0.020;
      rxBack = ankleR + 0.0068;
      rxFront = 0.018 * bw + 0.005;
    } else if (style === "loafers") {
      zBack = -ankleR - 0.004;
      zFront = 0.024 * bh + 0.002 * bw;
      yBack = -0.012;
      ySide = -0.029;
      yFront = -0.011;
      rxBack = ankleR + 0.0072;
      rxFront = 0.017 * bw + 0.004;
    } else {
      // boots: rises snugly around the ankle to tuck seamlessly into the shin boot shaft
      zBack = -ankleR - 0.005;
      zFront = 0.021 * bw + 0.006;
      yBack = 0.010;
      ySide = 0.008;
      yFront = 0.005;
      rxBack = ankleR + 0.0074;
      rxFront = ankleR + 0.0072;
    }

    const zCenter = (zBack + zFront) * 0.5;
    const zHalf = (zFront - zBack) * 0.5;
    const rx = lerp(rxBack, rxFront, smoothstep(0.15, 0.85, s));

    // Dip at sides around the malleolus; rise cleanly at back heel tab & front vamp
    const sideWeight = sa * sa;
    const yBase = lerp(yBack, yFront, s);
    let y = lerp(yBase, ySide, sideWeight * 0.88);
    if (style === "sneakers") {
      // Slight heel-tab lift at very back
      y += 0.004 * Math.pow(smoothstep(0.25, 0.0, s), 2);
    }

    const x = rx * sa + sideSign * 0.0012 * Math.sin(s * Math.PI);
    const z = zCenter + zHalf * ca;
    return new THREE.Vector3(x, y, z);
  }

  // Sculpted upper Bezier surface U(a, h) for h in [0, 1] (0 = sole welt, 1 = collar rim)
  function upperPoint(a, h, out) {
    const bp = basePerimeter(a, 0);
    const p0 = new THREE.Vector3(bp.x, ySoleTop + bp.toeSpring * 0.65 - 0.001, bp.z);
    const p3 = collarPoint(a);
    const s = bp.s;

    // Plump vertical rise at toe & heel; fuller dome over the toes
    const toeWallH = style === "maryJanes" ? 0.028 : style === "loafers" ? 0.030 : 0.033;
    const sideRise = Math.max(0.012, (p3.y - p0.y) * 0.55);
    const lift = lerp(sideRise, toeWallH, smoothstep(0.35, 0.92, s));

    const p1 = new THREE.Vector3(
      p0.x * lerp(1.02, 1.03, s),
      p0.y + lift,
      p0.z + (s > 0.5 ? 0.0035 * (s - 0.5) * 2 : -0.002 * (0.5 - s) * 2)
    );

    const domeZ = lerp(p3.z, p0.z, 0.42 * smoothstep(0.35, 0.95, s));
    const domeY = lerp(p3.y, Math.max(p3.y, p0.y + lift * 1.12), smoothstep(0.40, 0.95, s));
    const domeX = lerp(p3.x, p0.x * 0.95, 0.36 * smoothstep(0.35, 0.95, s));
    const p2 = new THREE.Vector3(domeX, domeY, domeZ);

    return evalCubicBezier(p0, p1, p2, p3, h, out || new THREE.Vector3());
  }

  function upperNormal(a, h) {
    const epsA = 0.02;
    const epsH = 0.015;
    const h0 = clamp(h - epsH, 0, 1);
    const h1 = clamp(h + epsH, 0, 1);
    const pA0 = upperPoint(a - epsA, h);
    const pA1 = upperPoint(a + epsA, h);
    const pH0 = upperPoint(a, h0);
    const pH1 = upperPoint(a, h1);
    const dA = pA1.sub(pA0);
    const dH = pH1.sub(pH0);
    return new THREE.Vector3().crossVectors(dA, dH).normalize();
  }

  return {
    yFloor,
    soleH,
    ySoleTop,
    zHeel,
    zToe,
    zMid,
    halfL,
    wBase,
    basePerimeter,
    collarPoint,
    upperPoint,
    upperNormal
  };
}

// ---------- Core Shoe Pieces: Sole + Welt, Sculpted Closed Upper, Toe Cap ----------

function buildSoleAndWelt(THREE, last, style, soleMat, weltMat) {
  const segs = 48;
  const soleRings = [];
  const isChunky = style === "boots";
  const isSneaker = style === "sneakers";
  const archDepth = isChunky ? 0.0062 : isSneaker ? 0.0018 : 0.0046;
  const soleExpand = isChunky ? 0.0036 : isSneaker ? 0.0026 : 0.0020;

  // Vertical profile stations from outsole bottom to sole top
  const stations = [
    { t: 0.00, rOff: -0.0018, yFrac: 0.00 },
    { t: 0.10, rOff:  0.0002, yFrac: 0.12 },
    { t: 0.30, rOff:  0.0008, yFrac: 0.32 },
    { t: 0.72, rOff:  0.0005, yFrac: 0.78 },
    { t: 0.92, rOff: -0.0003, yFrac: 0.96 },
    { t: 1.00, rOff: -0.0014, yFrac: 1.00 }
  ];

  for (const st of stations) {
    const ring = [];
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const bp = last.basePerimeter(a, soleExpand + st.rOff);
      const s = bp.s;

      // Arch cutout creating a defined heel block
      const archMask = smoothstep(0.28, 0.36, s) * (1 - smoothstep(0.48, 0.56, s));
      const heelExtra = 1 - smoothstep(0.28, 0.36, s);
      // Chunky lug tread pattern around boot bottom
      let lug = 0;
      if (isChunky && st.yFrac < 0.25) {
        const lugZone = (1 - archMask) * (1 - smoothstep(0.88, 0.98, s));
        const wave = Math.sin(s * 24 * Math.PI);
        lug = wave > 0 ? 0.0018 * lugZone * (1 - st.yFrac * 3) : 0;
      }
      // Subtle sneaker front rubber bumper fullness
      const bumper = isSneaker ? 0.0012 * smoothstep(0.76, 0.96, s) * Math.sin(st.yFrac * Math.PI) : 0;
      const bpB = bumper > 0 ? last.basePerimeter(a, soleExpand + st.rOff + bumper) : bp;

      const yBot = last.yFloor + archDepth * archMask + bp.toeSpring - lug;
      const yTop = last.ySoleTop + bp.toeSpring * 0.65 + (isChunky ? 0.001 * heelExtra : 0);
      const y = lerp(yBot, yTop, st.yFrac);
      ring.push(new THREE.Vector3(bpB.x, y, bpB.z));
    }
    soleRings.push(ring);
  }

  const soleGeom = buildLoftGeometry(THREE, soleRings, segs, true, true);
  const soleMesh = new THREE.Mesh(soleGeom, soleMat);

  // Welt ridge wrapping around the upper-to-sole junction
  const weltRings = [];
  const weltH = isSneaker ? 0.0030 : 0.0028;
  const weltOut = isChunky ? 0.0036 : isSneaker ? 0.0026 : 0.0024;
  const wProf = [
    { dr: -0.0010, dy: -0.0008 },
    { dr:  weltOut, dy: -0.0004 },
    { dr:  weltOut + 0.0005, dy: weltH * 0.45 },
    { dr:  weltOut * 0.72, dy: weltH },
    { dr: -0.0010, dy: weltH * 0.95 }
  ];

  for (const wp of wProf) {
    const ring = [];
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const bp = last.basePerimeter(a, wp.dr);
      const y = last.ySoleTop + bp.toeSpring * 0.65 + wp.dy;
      ring.push(new THREE.Vector3(bp.x, y, bp.z));
    }
    weltRings.push(ring);
  }
  const weltGeom = buildLoftGeometry(THREE, weltRings, segs, false, false);
  const weltMesh = new THREE.Mesh(weltGeom, weltMat);

  return { soleMesh, weltMesh };
}

// Single sculpted closed upper shell with outer wall, rolled collar edge, inner wall, and insole pad.
function buildSculptedUpper(THREE, last, style, upperMat, insoleMat) {
  const segs = 48;
  const outerSteps = 14;
  const lipSteps = 6;
  const innerSteps = 8;
  const lipRadius = style === "sneakers" ? 0.0036 : style === "boots" ? 0.0018 : 0.0028;
  const wallThick = lipRadius * 2;

  const rings = [];

  // 1. Outer sculpted surface from sole (h=0) to collar rim (h=1)
  for (let i = 0; i <= outerSteps; i++) {
    const h = i / outerSteps;
    const ring = [];
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      ring.push(last.upperPoint(a, h));
    }
    rings.push(ring);
  }

  // Compute rim tangent & outward normal at h=1 for smooth rolled hem
  const rimPts = rings[rings.length - 1];
  const prevPts = rings[rings.length - 2];
  const rimTang = [];
  const rimNorm = [];
  for (let j = 0; j < segs; j++) {
    const a = (j / segs) * Math.PI * 2;
    const t = new THREE.Vector3().subVectors(rimPts[j], prevPts[j]).normalize();
    const n = last.upperNormal(a, 0.98);
    // Ensure n is orthogonal to t
    n.addScaledVector(t, -n.dot(t)).normalize();
    rimTang.push(t);
    rimNorm.push(n);
  }

  // 2. Rolled collar lip (semicircle of radius lipRadius)
  for (let k = 1; k <= lipSteps; k++) {
    const phi = (k / lipSteps) * Math.PI;
    const ring = [];
    for (let j = 0; j < segs; j++) {
      const center = new THREE.Vector3().copy(rimPts[j]).addScaledVector(rimNorm[j], -lipRadius);
      const p = center
        .addScaledVector(rimNorm[j], Math.cos(phi) * lipRadius)
        .addScaledVector(rimTang[j], Math.sin(phi) * lipRadius);
      ring.push(p);
    }
    rings.push(ring);
  }

  // 3. Inner wall descending inside the shoe cavity down to the insole level
  for (let i = 1; i <= innerSteps; i++) {
    const t = i / innerSteps;
    const h = 1 - t * 0.92;
    const ring = [];
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const pOut = last.upperPoint(a, h);
      const nOut = last.upperNormal(a, h);
      // Taper inward wall cleanly so it never collides with foot/sock deep in the toe
      const inset = wallThick * lerp(1.0, 0.65, t);
      const pIn = pOut.addScaledVector(nOut, -inset);
      pIn.y = Math.max(pIn.y, last.ySoleTop + 0.001);
      ring.push(pIn);
    }
    rings.push(ring);
  }

  const upperGeom = buildLoftGeometry(THREE, rings, segs, false, true);
  const upperMesh = new THREE.Mesh(upperGeom, upperMat);

  // Cushioned interior insole bed (visible inside low-cut Mary Janes and loafers)
  const insoleRings = [];
  for (let k = 0; k < 2; k++) {
    const ring = [];
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const bp = last.basePerimeter(a, -0.0055);
      ring.push(new THREE.Vector3(bp.x, last.ySoleTop + 0.0015 + k * 0.0022, bp.z));
    }
    insoleRings.push(ring);
  }
  const insoleMesh = new THREE.Mesh(buildLoftGeometry(THREE, insoleRings, segs, false, true), insoleMat);

  return { upperMesh, insoleMesh };
}

// Sculpted toe cap hugging the front dome cleanly (offset >= 0.004 from upper to prevent z-fighting)
function buildToeCap(THREE, last, style, capMat) {
  const segsU = 36; // across the toe arc
  const segsV = 12; // from sole welt up over the toe dome
  const arcHalf = style === "sneakers" ? Math.PI * 0.36 : style === "boots" ? Math.PI * 0.34 : Math.PI * 0.30;
  const hMax = style === "sneakers" ? 0.72 : style === "boots" ? 0.62 : style === "maryJanes" ? 0.56 : 0.48;
  const proudOffset = style === "sneakers" ? 0.0044 : 0.0040;

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let iv = 0; iv <= segsV; iv++) {
    const fv = iv / segsV; // 0 = sole bottom, 1 = rear cap seam edge
    for (let iu = 0; iu <= segsU; iu++) {
      const fu = iu / segsU; // 0 -> 1 across -arcHalf -> +arcHalf
      const a = lerp(-arcHalf, arcHalf, fu);
      // Curved scallop boundary: deeper at center toe, tapering cleanly toward sides
      const archFactor = Math.cos((fu - 0.5) * Math.PI);
      const h = fv * hMax * (0.28 + 0.72 * Math.pow(archFactor, 0.55));
      const p = last.upperPoint(a, h);
      const n = last.upperNormal(a, h);

      // Rounded molded rear edge bevel curving cleanly back into the upper
      const rearRoll = smoothstep(0.84, 1.0, fv);
      const sideRoll = smoothstep(0.86, 1.0, Math.abs(fu * 2 - 1));
      const roll = Math.max(rearRoll, sideRoll);
      const off = lerp(proudOffset, -0.0008, roll * roll);
      p.addScaledVector(n, off);

      positions.push(p.x, p.y, p.z);
      uvs.push(fu, fv);
    }
  }

  const cols = segsU + 1;
  for (let iv = 0; iv < segsV; iv++) {
    for (let iu = 0; iu < segsU; iu++) {
      const a = iv * cols + iu;
      const b = a + 1;
      const c = a + cols + 1;
      const d = a + cols;
      indices.push(a, b, c, a, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return new THREE.Mesh(geom, capMat);
}

// ---------- Style-Specific Detail Builders ----------

function addSneakerDetails(THREE, last, sideSign, bw, bh, mats, add) {
  // 1. Padded curved tongue emerging from throat under the laces
  const tonguePts = [];
  const tongueNorms = [];
  const tSteps = 16;
  for (let i = 0; i <= tSteps; i++) {
    const t = i / tSteps;
    const z = lerp(0.044 * bh, 0.004, t) + Math.pow(t, 3) * 0.006;
    const y = lerp(-0.024, 0.015, Math.pow(t, 0.85)) - Math.pow(Math.max(0, t - 0.75) / 0.25, 2) * 0.003;
    tonguePts.push(new THREE.Vector3(0, y, z));
    const n = new THREE.Vector3(0, 0.72, 0.69).normalize();
    tongueNorms.push(n);
  }
  const tongueWidth = 0.0125 * bw + 0.003;
  const tongueGeom = buildRibbonBand(THREE, tonguePts, tongueNorms, tongueWidth, 0.0024, 32, false);
  add(new THREE.Mesh(tongueGeom, mats.upper), "shoeColor", "sneakerTongue");

  // Small woven tongue label at top
  const tagPts = tonguePts.slice(11, 15).map((p, idx) => p.clone().addScaledVector(tongueNorms[11 + idx], 0.0026));
  const tagGeom = buildRibbonBand(THREE, tagPts, tongueNorms.slice(11, 15), tongueWidth * 0.52, 0.0009, 32, false);
  add(new THREE.Mesh(tagGeom, mats.accent), "accent", "sneakerTongueTag");

  // 2. Six eyelets (3 medial, 3 lateral) along the eyestay throat
  const eyeletPositionsL = [];
  const eyeletPositionsR = [];
  const eyeletMat = mats.hardware;
  const eyeletGeom = new THREE.TorusGeometry(0.0025, 0.00085, 32, 32);

  for (let k = 0; k < 3; k++) {
    const f = k / 2; // 0 = front/bottom pair, 2 = top pair
    const aMag = lerp(0.22 * Math.PI, 0.44 * Math.PI, f);
    const h = lerp(0.84, 0.90, f);
    for (const sgn of [-1, 1]) {
      const a = sgn * aMag;
      const p = last.upperPoint(a, h);
      const n = last.upperNormal(a, h);
      const pos = p.clone().addScaledVector(n, 0.0014);

      const ring = new THREE.Mesh(eyeletGeom, eyeletMat);
      ring.position.copy(pos);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      add(ring, null, "sneakerEyelet");

      if (sgn < 0) eyeletPositionsR.push({ pos, n });
      else eyeletPositionsL.push({ pos, n });
    }
  }

  // 3. Laces as smooth crossing tubes + tied bow at top
  const laceR = 0.00145;
  const addLaceTube = (pts) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    const geom = new THREE.TubeGeometry(curve, 24, laceR, 32, false);
    add(new THREE.Mesh(geom, mats.lace), "accent", "sneakerLace");
  };

  // Helper to arch a lace cleanly over the tongue between two eyelet points
  const laceBridge = (pA, pB, liftY) => {
    const mid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
    mid.y += liftY;
    mid.z += 0.0035;
    return [pA.clone(), mid, pB.clone()];
  };

  // Bottom bar across pair 0
  addLaceTube(laceBridge(eyeletPositionsL[0].pos, eyeletPositionsR[0].pos, 0.0045));
  // Crossing X-laces: 0 -> 1 and 1 -> 2 with staggered vertical lift so crossings stack cleanly
  addLaceTube(laceBridge(eyeletPositionsL[0].pos, eyeletPositionsR[1].pos, 0.0052));
  addLaceTube(laceBridge(eyeletPositionsR[0].pos, eyeletPositionsL[1].pos, 0.0074));
  addLaceTube(laceBridge(eyeletPositionsL[1].pos, eyeletPositionsR[2].pos, 0.0056));
  addLaceTube(laceBridge(eyeletPositionsR[1].pos, eyeletPositionsL[2].pos, 0.0078));

  // Top knot & bow loops
  const knotPos = new THREE.Vector3()
    .addVectors(eyeletPositionsL[2].pos, eyeletPositionsR[2].pos)
    .multiplyScalar(0.5);
  knotPos.y += 0.0075;
  knotPos.z += 0.004;

  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 32, 24), mats.lace);
  knot.scale.set(1.25, 0.85, 0.9);
  knot.position.copy(knotPos);
  add(knot, "accent", "sneakerLaceKnot");

  for (const sgn of [-1, 1]) {
    // Bow loop
    const loopPts = [
      knotPos.clone(),
      knotPos.clone().add(new THREE.Vector3(sgn * 0.007, 0.0055, 0.003)),
      knotPos.clone().add(new THREE.Vector3(sgn * 0.0135, 0.0030, 0.001)),
      knotPos.clone().add(new THREE.Vector3(sgn * 0.0085, -0.0025, 0.0035)),
      knotPos.clone()
    ];
    addLaceTube(loopPts);
    // Dangling lace tail
    const tailPts = [
      knotPos.clone(),
      knotPos.clone().add(new THREE.Vector3(sgn * 0.0055, -0.0045, 0.006)),
      knotPos.clone().add(new THREE.Vector3(sgn * 0.0105, -0.0115, 0.008))
    ];
    addLaceTube(tailPts);
  }

  // 4. Sweeping side stripes on both medial & lateral sides
  for (const sgn of [-1, 1]) {
    for (let st = 0; st < 2; st++) {
      const pts = [];
      const norms = [];
      const steps = 16;
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const a = sgn * lerp(0.36 * Math.PI + st * 0.11, 0.72 * Math.PI + st * 0.07, f);
        const h = lerp(0.14, 0.62 - st * 0.08, Math.pow(f, 0.85));
        const p = last.upperPoint(a, h);
        const n = last.upperNormal(a, h);
        pts.push(p.addScaledVector(n, 0.0022));
        norms.push(n);
      }
      const stripeGeom = buildRibbonBand(THREE, pts, norms, 0.0028, 0.0020, 32, false);
      add(new THREE.Mesh(stripeGeom, mats.accent), "accent", "sneakerStripe");
    }
  }
}

function addMaryJaneDetails(THREE, last, sideSign, bw, bh, mats, add) {
  // 1. Glossy strap arching cleanly across the instep from medial to lateral collar
  const strapPts = [];
  const strapNorms = [];
  const steps = 22;
  const aMed = -sideSign * 0.44 * Math.PI;
  const aLat = sideSign * 0.44 * Math.PI;
  const pStart = last.upperPoint(aMed, 0.84);
  const pEnd = last.upperPoint(aLat, 0.84);

  const archCrestY = -0.0095;
  const archCrestZ = (pStart.z + pEnd.z) * 0.5 + 0.005 * bh;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const arch = Math.sin(t * Math.PI);
    const x = lerp(pStart.x, pEnd.x, t);
    const y = lerp(pStart.y, pEnd.y, t) + (archCrestY - (pStart.y + pEnd.y) * 0.5) * Math.pow(arch, 0.78);
    const z = lerp(pStart.z, pEnd.z, t) + (archCrestZ - (pStart.z + pEnd.z) * 0.5) * arch;
    strapPts.push(new THREE.Vector3(x, y, z));

    // Outward normal follows the arch direction
    const nx = (t - 0.5) * 2 * sideSign * 0.78;
    const ny = Math.max(0.25, arch);
    const nz = 0.24 * arch;
    strapNorms.push(new THREE.Vector3(nx, ny, nz).normalize());
  }

  const strapGeom = buildRibbonBand(THREE, strapPts, strapNorms, 0.0056, 0.0017, 32, false);
  add(new THREE.Mesh(strapGeom, mats.upper), "shoeColor", "maryJaneStrap");

  // 2. Small round buckle on the outer (lateral) side of the strap
  const bIdx = Math.round(steps * 0.82);
  const bPos = strapPts[bIdx].clone().addScaledVector(strapNorms[bIdx], 0.0020);
  const bTang = new THREE.Vector3().subVectors(strapPts[bIdx + 1], strapPts[bIdx - 1]).normalize();
  const bNorm = strapNorms[bIdx].clone().normalize();
  const bBino = new THREE.Vector3().crossVectors(bTang, bNorm).normalize();
  const basis = new THREE.Matrix4().makeBasis(bTang, bBino, bNorm);

  const buckleRing = new THREE.Mesh(new THREE.TorusGeometry(0.0062, 0.0012, 32, 40), mats.hardware);
  buckleRing.position.copy(bPos);
  buckleRing.quaternion.setFromRotationMatrix(basis);
  add(buckleRing, null, "maryJaneBuckle");

  // Buckle cross-bar & tongue pin
  const pinGeom = new THREE.CylinderGeometry(0.00075, 0.00075, 0.0115, 32);
  const crossBar = new THREE.Mesh(pinGeom, mats.hardware);
  crossBar.position.copy(bPos);
  crossBar.quaternion.setFromRotationMatrix(basis);
  add(crossBar, null, "maryJaneBuckleBar");

  const prongGeom = new THREE.CylinderGeometry(0.00065, 0.00055, 0.0068, 32);
  const prong = new THREE.Mesh(prongGeom, mats.hardware);
  const prongPos = bPos.clone().addScaledVector(bTang, 0.0024).addScaledVector(bNorm, 0.0009);
  const prongBasis = new THREE.Matrix4().makeBasis(bBino, bTang, bNorm);
  prong.position.copy(prongPos);
  prong.quaternion.setFromRotationMatrix(prongBasis);
  add(prong, null, "maryJaneBuckleProng");

  // Tiny leather keeper loop beside the buckle
  const kIdx = Math.round(steps * 0.70);
  const keeperPts = [];
  const kCenter = strapPts[kIdx];
  const kN = strapNorms[kIdx];
  const kT = new THREE.Vector3().subVectors(strapPts[kIdx + 1], strapPts[kIdx - 1]).normalize();
  const kB = new THREE.Vector3().crossVectors(kT, kN).normalize();
  const kSegs = 20;
  for (let j = 0; j < kSegs; j++) {
    const a = (j / kSegs) * Math.PI * 2;
    keeperPts.push(
      kCenter.clone()
        .addScaledVector(kB, Math.sin(a) * 0.0064)
        .addScaledVector(kN, Math.cos(a) * 0.0025)
    );
  }
  const keeperCurve = new THREE.CatmullRomCurve3(keeperPts, true);
  const keeperMesh = new THREE.Mesh(new THREE.TubeGeometry(keeperCurve, 32, 0.0009, 32, true), mats.upper);
  add(keeperMesh, "shoeColor", "maryJaneKeeper");
}

function addLoaferDetails(THREE, last, sideSign, bw, bh, mats, add) {
  // 1. Raised U-shaped stitched apron ridge curving around the vamp/toe perimeter
  const apronPts = [];
  const apronSteps = 32;
  const aSpan = Math.PI * 0.44;
  for (let i = 0; i <= apronSteps; i++) {
    const f = i / apronSteps;
    const a = lerp(-aSpan, aSpan, f);
    const centerBias = Math.cos((f - 0.5) * Math.PI);
    const h = lerp(0.46, 0.68, Math.pow(centerBias, 0.7));
    const p = last.upperPoint(a, h);
    const n = last.upperNormal(a, h);
    apronPts.push(p.addScaledVector(n, 0.0014));
  }
  const apronCurve = new THREE.CatmullRomCurve3(apronPts);
  const apronMesh = new THREE.Mesh(new THREE.TubeGeometry(apronCurve, 48, 0.0019, 32, false), mats.upper);
  add(apronMesh, "shoeColor", "loaferApron");

  // Fine contrast stitched accent thread running right inside the apron ridge
  const stitchPts = apronPts.map((p, idx) => {
    const f = idx / apronSteps;
    const a = lerp(-aSpan, aSpan, f);
    const n = last.upperNormal(a, 0.58);
    return p.clone().addScaledVector(n, 0.0012);
  });
  const stitchCurve = new THREE.CatmullRomCurve3(stitchPts);
  const stitchMesh = new THREE.Mesh(new THREE.TubeGeometry(stitchCurve, 48, 0.00075, 32, false), mats.accent);
  add(stitchMesh, "accent", "loaferApronStitch");

  // 2. Classic penny-loafer saddle strap with bevelled diamond/oval cutout conformed to the vamp
  const saddleW = 0.036 * bw + 0.016; // wraps well down medial & lateral vamp walls
  const saddleLen = 0.020 * bh + 0.004;
  const hw = saddleW * 0.5;
  const hl = saddleLen * 0.5;

  const shape = new THREE.Shape();
  // Classic scalloped penny saddle outline
  shape.moveTo(-hw, -hl * 0.65);
  shape.quadraticCurveTo(-hw * 0.55, -hl * 1.05, 0, -hl);
  shape.quadraticCurveTo(hw * 0.55, -hl * 1.05, hw, -hl * 0.65);
  shape.lineTo(hw, hl * 0.65);
  shape.quadraticCurveTo(hw * 0.55, hl * 1.05, 0, hl);
  shape.quadraticCurveTo(-hw * 0.55, hl * 1.05, -hw, hl * 0.65);
  shape.closePath();

  // Penny slot diamond-oval cutout in center
  const hole = new THREE.Path();
  const cw = 0.0072 * bw;
  const cl = 0.0032 * bh;
  hole.moveTo(0, cl);
  hole.quadraticCurveTo(cw * 0.85, cl * 0.6, cw, 0);
  hole.quadraticCurveTo(cw * 0.85, -cl * 0.6, 0, -cl);
  hole.quadraticCurveTo(-cw * 0.85, -cl * 0.6, -cw, 0);
  hole.quadraticCurveTo(-cw * 0.85, cl * 0.6, 0, cl);
  shape.holes.push(hole);

  const saddleGeom = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0028,
    bevelEnabled: true,
    bevelThickness: 0.0008,
    bevelSize: 0.0008,
    bevelSegments: 5,
    curveSegments: 32
  });

  // Bend the extruded saddle smoothly onto the curved vamp surface
  const pos = saddleGeom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i); // across vamp (-hw..+hw)
    const v = pos.getY(i); // along vamp (-hl..+hl, +v toward heel)
    const w = pos.getZ(i); // thickness outward

    const uFrac = clamp(u / hw, -1, 1);
    const vFrac = clamp(v / hl, -1, 1);
    // Map (uFrac, vFrac) to upper surface (a, h)
    const a = uFrac * Math.PI * 0.48;
    const hCenter = lerp(0.92, 0.22, Math.abs(uFrac) * 0.88);
    const h = clamp(hCenter + vFrac * 0.16 * (1 - 0.45 * Math.abs(uFrac)), 0.05, 0.98);

    const p = last.upperPoint(a, h);
    const n = last.upperNormal(a, h);
    // Slight longitudinal shift so saddle sits squarely over the instep
    p.z -= vFrac * 0.005 * (1 - Math.abs(uFrac) * 0.5);
    p.addScaledVector(n, 0.0020 + w);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
  saddleGeom.computeVertexNormals();
  add(new THREE.Mesh(saddleGeom, mats.upper), "shoeColor", "loaferSaddle");
}

function addBootDetails(THREE, last, shinPivot, sideSign, bw, bh, mats, addFoot, addShin) {
  // 1. Foot-side decorative ankle vamp seam ridge on footL/footR
  const vampSeamPts = [];
  for (let i = 0; i <= 24; i++) {
    const f = i / 24;
    const a = lerp(-Math.PI * 0.58, Math.PI * 0.58, f);
    const h = lerp(0.28, 0.52, Math.cos((f - 0.5) * Math.PI));
    const p = last.upperPoint(a, h);
    const n = last.upperNormal(a, h);
    vampSeamPts.push(p.addScaledVector(n, 0.0014));
  }
  const vampCurve = new THREE.CatmullRomCurve3(vampSeamPts);
  addFoot(new THREE.Mesh(new THREE.TubeGeometry(vampCurve, 36, 0.0013, 32, false), mats.upper), "shoeColor", "bootVampSeam");

  if (!shinPivot) return;

  // 2. Boot shaft rising onto shinL/shinR (closed shell with inner wall & rolled top cuff)
  const shinLen = 0.16 * bh;
  const yBot = -shinLen - 0.014;
  const yTop = -shinLen + 0.092 * bh;
  const radialSegs = 64;
  const outerSteps = 14;
  const lipSteps = 6;
  const innerSteps = 10;

  const shinRadiusAtY = (y) => {
    const t = clamp((y + shinLen) / shinLen, 0, 1);
    return lerp(0.022, 0.032, t) * bw;
  };

  // Shaft outer & inner radii leave >= 0.004 clearance outside socks AND never touch across x=0
  const shaftPoint = (y, a, isInner) => {
    const t = clamp((y - yBot) / (yTop - yBot), 0, 1);
    const rBase = shinRadiusAtY(y);
    // Subtle organic leather crease above ankle + gentle top cuff flare
    const crease = 0.0012 * Math.sin(t * Math.PI * 3.5) * Math.exp(-Math.pow((t - 0.24) / 0.16, 2)) * Math.max(0, Math.cos(a));
    const cuffFlare = 0.0010 * smoothstep(0.76, 1.0, t);
    const r = rBase + (isInner ? 0.0102 : 0.0132) + crease + cuffFlare;
    // Slight front-to-back oval contour for natural shin fit
    const rx = r * 0.98;
    const rz = r * 1.03;
    return new THREE.Vector3(rx * Math.sin(a), y, rz * Math.cos(a));
  };

  const rings = [];
  // Outer wall going up
  for (let i = 0; i <= outerSteps; i++) {
    const y = lerp(yBot, yTop, i / outerSteps);
    const ring = [];
    for (let j = 0; j < radialSegs; j++) {
      const a = (j / radialSegs) * Math.PI * 2;
      ring.push(shaftPoint(y, a, false));
    }
    rings.push(ring);
  }

  // Rolled top cuff edge (smooth semicircular lip connecting outer to inner wall)
  for (let k = 1; k <= lipSteps; k++) {
    const phi = (k / lipSteps) * Math.PI;
    const ring = [];
    for (let j = 0; j < radialSegs; j++) {
      const a = (j / radialSegs) * Math.PI * 2;
      const pOut = shaftPoint(yTop, a, false);
      const pIn = shaftPoint(yTop, a, true);
      const mid = new THREE.Vector3().addVectors(pOut, pIn).multiplyScalar(0.5);
      const rad = pOut.distanceTo(pIn) * 0.5;
      const outDir = new THREE.Vector3().subVectors(pOut, pIn).normalize();
      const p = mid.addScaledVector(outDir, Math.cos(phi) * rad);
      p.y += Math.sin(phi) * Math.max(rad, 0.0028);
      ring.push(p);
    }
    rings.push(ring);
  }

  // Inner wall going back down
  for (let i = 1; i <= innerSteps; i++) {
    const y = lerp(yTop, yBot + 0.004, i / innerSteps);
    const ring = [];
    for (let j = 0; j < radialSegs; j++) {
      const a = (j / radialSegs) * Math.PI * 2;
      ring.push(shaftPoint(y, a, true));
    }
    rings.push(ring);
  }

  // Close bottom bevel connecting inner wall back to outer wall
  rings.push(rings[0].map((p) => p.clone()));

  const shaftMesh = new THREE.Mesh(buildLoftGeometry(THREE, rings, radialSegs, false, false), mats.upper);
  addShin(shaftMesh, "shoeColor", "bootShaft");

  // 3. Vertical stitched seam ridges on lateral side and back of the boot shaft
  for (const seamA of [Math.PI, sideSign * Math.PI * 0.52]) {
    const seamPts = [];
    for (let i = 0; i <= 14; i++) {
      const y = lerp(yBot + 0.008, yTop - 0.002, i / 14);
      const p = shaftPoint(y, seamA, false);
      const radDir = new THREE.Vector3(p.x, 0, p.z).normalize();
      seamPts.push(p.addScaledVector(radDir, 0.0010));
    }
    const seamCurve = new THREE.CatmullRomCurve3(seamPts);
    const seamMesh = new THREE.Mesh(new THREE.TubeGeometry(seamCurve, 28, 0.0014, 32, false), mats.upper);
    addShin(seamMesh, "shoeColor", "bootShaftSeam");
  }

  // 4. Looped pull tab rising from the back top rim of the boot shaft
  const tabBack = shaftPoint(yTop, Math.PI, false);
  const tabIn = shaftPoint(yTop, Math.PI, true);
  const tabPts = [
    tabBack.clone().add(new THREE.Vector3(0, -0.008, -0.0005)),
    tabBack.clone().add(new THREE.Vector3(0, 0.003, -0.0022)),
    tabBack.clone().add(new THREE.Vector3(0, 0.0155, -0.0052)),
    new THREE.Vector3(0, yTop + 0.0185, (tabBack.z + tabIn.z) * 0.5 - 0.0025),
    tabIn.clone().add(new THREE.Vector3(0, 0.0135, 0.0012)),
    tabIn.clone().add(new THREE.Vector3(0, -0.004, 0.0008))
  ];
  const tabNorms = [
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(0, 0.15, -0.99),
    new THREE.Vector3(0, 0.55, -0.83),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0.55, 0.83),
    new THREE.Vector3(0, 0, 1)
  ];
  const pullTabGeom = buildRibbonBand(THREE, tabPts, tabNorms, 0.0052, 0.0015, 32, false);
  addShin(new THREE.Mesh(pullTabGeom, mats.accent), "accent", "bootPullTab");
}

// ---------- Socks Builder (Shin Shell + Ribbed Top Band + Foot Shell) ----------

function buildSocks(THREE, shinPivot, footPivot, sideSign, bw, bh, sockStyle, shoeStyle, sockMat, addShin, addFoot) {
  const shinLen = 0.16 * bh;
  const isKnee = sockStyle === "knee";
  const hasBoots = shoeStyle === "boots";
  const hasShoes = shoeStyle && shoeStyle !== "none";

  // 1. Shin sock shell with ribbed top band & rolled top hem
  if (shinPivot) {
    const yBot = -shinLen - 0.010;
    const yTop = isKnee ? -0.022 * bh : -shinLen + 0.040 * bh;
    const bandH = isKnee ? 0.022 * bh : 0.015 * bh;
    const radialSegs = 64;
    const ribCount = 24;
    const outerSteps = 16;
    const lipSteps = 6;
    const innerSteps = 10;

    const shinR = (y) => {
      const t = clamp((y + shinLen) / shinLen, 0, 1);
      return lerp(0.022, 0.032, t) * bw;
    };

    const sockPoint = (y, a, isInner) => {
      const rBase = shinR(y);
      const tBand = smoothstep(yTop - bandH - 0.003, yTop - bandH + 0.003, y);
      const tTop = smoothstep(yTop - bandH * 0.5, yTop, y);
      // Keep ankle sock tucked cleanly inside boot shaft when boots are worn
      const tuckedInBoot = hasBoots && !isKnee;
      const ribAmp = isInner ? 0 : (tuckedInBoot ? 0.0004 : 0.00095) * tBand;
      const rib = ribAmp * Math.cos(a * ribCount);
      const cuffLoosen = (tuckedInBoot ? 0.0004 : 0.0015) * tTop;
      const offOut = (tuckedInBoot ? 0.0062 : 0.0068) + cuffLoosen + rib;
      const offIn = 0.0040 + (tuckedInBoot ? 0.0002 : 0.0006) * tTop;
      const r = rBase + (isInner ? offIn : offOut);
      return new THREE.Vector3(r * Math.sin(a), y, r * Math.cos(a));
    };

    const rings = [];
    for (let i = 0; i <= outerSteps; i++) {
      const y = lerp(yBot, yTop, i / outerSteps);
      const ring = [];
      for (let j = 0; j < radialSegs; j++) {
        const a = (j / radialSegs) * Math.PI * 2;
        ring.push(sockPoint(y, a, false));
      }
      rings.push(ring);
    }

    // Rolled top hem joining outer wall to inner wall (visible gap & shadow against skin)
    for (let k = 1; k <= lipSteps; k++) {
      const phi = (k / lipSteps) * Math.PI;
      const ring = [];
      for (let j = 0; j < radialSegs; j++) {
        const a = (j / radialSegs) * Math.PI * 2;
        const pOut = sockPoint(yTop, a, false);
        const pIn = sockPoint(yTop, a, true);
        const mid = new THREE.Vector3().addVectors(pOut, pIn).multiplyScalar(0.5);
        const rad = pOut.distanceTo(pIn) * 0.5;
        const outDir = new THREE.Vector3().subVectors(pOut, pIn).normalize();
        const p = mid.addScaledVector(outDir, Math.cos(phi) * rad);
        p.y += Math.sin(phi) * Math.max(rad, 0.0022);
        ring.push(p);
      }
      rings.push(ring);
    }

    // Inner wall descending smoothly inside the sock
    for (let i = 1; i <= innerSteps; i++) {
      const y = lerp(yTop, yBot + 0.003, i / innerSteps);
      const ring = [];
      for (let j = 0; j < radialSegs; j++) {
        const a = (j / radialSegs) * Math.PI * 2;
        ring.push(sockPoint(y, a, true));
      }
      rings.push(ring);
    }
    rings.push(rings[0].map((p) => p.clone()));

    const sockShinMesh = new THREE.Mesh(buildLoftGeometry(THREE, rings, radialSegs, false, false), sockMat);
    addShin(sockShinMesh, "sockColor", "sockShin");
  }

  // 2. Foot sock shell on footL/footR (wraps foot & instep cleanly inside the shoe cavity)
  if (footPivot) {
    const segs = 48;
    const steps = 14;
    const yBot = hasShoes ? -0.056 : -0.065;
    const zHeel = -0.022 * bw - 0.0025;
    const zToe = 0.064 * bh + 0.004 * bw;
    const zMid = (zHeel + zToe) * 0.5;
    const halfL = (zToe - zHeel) * 0.5;
    const halfW = 0.020 * bw + 0.0046;
    const ankleR = 0.022 * bw + 0.0060;

    const footRings = [];
    for (let i = 0; i <= steps; i++) {
      const h = i / steps; // 0 = sole bottom, 1 = ankle top meeting shin sock
      const ring = [];
      for (let j = 0; j < segs; j++) {
        const a = (j / segs) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const s = (ca + 1) * 0.5;

        const p0 = new THREE.Vector3(halfW * (0.88 + 0.12 * s) * sa, yBot, zMid + halfL * ca);
        const p3 = new THREE.Vector3(ankleR * sa, 0.004, ankleR * ca);
        const p1 = new THREE.Vector3(
          p0.x * 1.04,
          yBot + lerp(0.024, 0.028, s),
          p0.z + (s > 0.5 ? 0.002 : -0.001)
        );
        const p2 = new THREE.Vector3(
          lerp(p3.x, p0.x * 0.88, 0.45 * s),
          lerp(-0.012, -0.022, s),
          lerp(p3.z, p0.z, 0.48 * s)
        );
        ring.push(evalCubicBezier(p0, p1, p2, p3, h, new THREE.Vector3()));
      }
      footRings.push(ring);
    }

    const sockFootMesh = new THREE.Mesh(buildLoftGeometry(THREE, footRings, segs, true, true), sockMat);
    addFoot(sockFootMesh, "sockColor", "sockFoot");
  }
}

// ---------- Main Exported Entry Point ----------

export function wearShoes(THREE, rig, opts, kit) {
  const cfg = opts || {};
  const shoeStyle = cfg.shoes ?? "sneakers";
  const sockStyle = cfg.socks ?? "ankle";
  const bw = clamp(cfg.bodyWidth ?? 1.0, 0.8, 1.3);
  const bh = clamp(cfg.bodyHeight ?? 1.0, 0.9, 1.1);

  const defaultShoeColors = {
    sneakers: "#3c5a8a",
    maryJanes: "#7c1d2b",
    boots: "#4a3222",
    loafers: "#5c3420"
  };
  const shoeColor = cfg.shoeColor ?? defaultShoeColors[shoeStyle] ?? "#3c5a8a";
  const sockColor = cfg.sockColor ?? "#f4f1ea";
  const accentColor = cfg.accent ?? "#e8e2d5";

  const added = [];
  const makeAdder = (pivot, suffix) => (mesh, slot, label) => {
    if (!pivot) return mesh;
    mesh.name = `${label}_${suffix}`;
    if (slot) mesh.userData.slot = slot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    pivot.add(mesh);
    added.push(mesh);
    return mesh;
  };

  // Build shared painted textures & MeshPhysicalMaterials
  const isPatent = shoeStyle === "maryJanes";
  const isCanvas = shoeStyle === "sneakers";
  const upperTex = isCanvas
    ? makeCanvasTextures(THREE, kit)
    : makeLeatherTextures(THREE, kit, isPatent);
  const soleTex = makeSoleTextures(THREE, kit, shoeStyle);

  const upperMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(shoeColor),
    map: upperTex.map,
    bumpMap: upperTex.bumpMap,
    bumpScale: isPatent ? 0.0005 : isCanvas ? 0.0016 : 0.0015,
    roughness: isPatent ? 0.24 : isCanvas ? 0.88 : shoeStyle === "loafers" ? 0.42 : 0.54,
    metalness: isPatent ? 0.03 : 0.01,
    clearcoat: isPatent ? 1.0 : shoeStyle === "loafers" ? 0.28 : shoeStyle === "boots" ? 0.16 : 0.0,
    clearcoatRoughness: isPatent ? 0.08 : 0.35,
    sheen: isCanvas ? 0.48 : isPatent ? 0.05 : 0.18,
    sheenRoughness: 0.72
  });

  const accentTex = makeCanvasTextures(THREE, kit);
  const accentMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(accentColor),
    map: accentTex.map,
    bumpMap: accentTex.bumpMap,
    bumpScale: 0.0012,
    roughness: 0.78,
    metalness: 0.0,
    sheen: 0.42,
    sheenRoughness: 0.72
  });

  const laceMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(accentColor),
    map: accentTex.map,
    bumpMap: accentTex.bumpMap,
    bumpScale: 0.0014,
    roughness: 0.88,
    metalness: 0.0,
    sheen: 0.5,
    sheenRoughness: 0.75
  });

  const soleBaseHex = shoeStyle === "sneakers"
    ? "#f3f0e8"
    : shoeStyle === "boots"
      ? "#232125"
      : "#2d221c";

  const soleMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(soleBaseHex),
    map: soleTex.map,
    bumpMap: soleTex.bumpMap,
    bumpScale: 0.0014,
    roughness: shoeStyle === "sneakers" ? 0.64 : shoeStyle === "boots" ? 0.80 : 0.58,
    metalness: 0.0,
    clearcoat: shoeStyle === "sneakers" ? 0.08 : 0.12,
    clearcoatRoughness: 0.48
  });

  const weltMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(shoeStyle === "sneakers" ? "#e8e4da" : "#221a15"),
    map: soleTex.map,
    bumpMap: soleTex.bumpMap,
    bumpScale: 0.0012,
    roughness: 0.68,
    metalness: 0.0,
    clearcoat: 0.1
  });

  const insoleMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(shoeStyle === "boots" ? "#3b302a" : "#ded5c8"),
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.35,
    sheenRoughness: 0.8
  });

  const hardwareMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(shoeStyle === "maryJanes" ? "#dfc686" : "#d8dde4"),
    roughness: 0.22,
    metalness: 0.88,
    clearcoat: 0.35,
    clearcoatRoughness: 0.15
  });

  const mats = {
    upper: upperMat,
    accent: accentMat,
    lace: laceMat,
    sole: soleMat,
    welt: weltMat,
    insole: insoleMat,
    hardware: hardwareMat
  };

  let sockMat = null;
  if (sockStyle && sockStyle !== "none") {
    const bandRatio = sockStyle === "knee" ? 0.18 : 0.34;
    const knitTex = makeKnitTextures(THREE, kit, bandRatio);
    sockMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(sockColor),
      map: knitTex.map,
      bumpMap: knitTex.bumpMap,
      bumpScale: 0.0020,
      roughness: 0.9,
      metalness: 0.0,
      sheen: 0.5,
      sheenRoughness: 0.72
    });
  }

  const sides = [
    { suffix: "L", sideSign: 1, footName: "footL", shinName: "shinL" },
    { suffix: "R", sideSign: -1, footName: "footR", shinName: "shinR" }
  ];

  for (const s of sides) {
    const footPivot = rig.getObjectByName(s.footName);
    const shinPivot = rig.getObjectByName(s.shinName);
    const addFoot = makeAdder(footPivot, s.suffix);
    const addShin = makeAdder(shinPivot, s.suffix);

    // 1. Socks
    if (sockMat) {
      buildSocks(THREE, shinPivot, footPivot, s.sideSign, bw, bh, sockStyle, shoeStyle, sockMat, addShin, addFoot);
    }

    // 2. Shoes
    if (!shoeStyle || shoeStyle === "none" || !footPivot) continue;

    const last = makeShoeLast(THREE, s.sideSign, bw, bh, shoeStyle);

    // Sole + Welt
    const { soleMesh, weltMesh } = buildSoleAndWelt(THREE, last, shoeStyle, mats.sole, mats.welt);
    addFoot(soleMesh, null, "shoeSole");
    addFoot(weltMesh, null, "shoeWelt");

    // Sculpted single-surface closed upper with rolled edge + insole
    const { upperMesh, insoleMesh } = buildSculptedUpper(THREE, last, shoeStyle, mats.upper, mats.insole);
    addFoot(upperMesh, "shoeColor", "shoeUpper");
    addFoot(insoleMesh, null, "shoeInsole");

    // Toe cap (rubber white shell on sneakers; matching leather/patent cap on boots, maryJanes, loafers)
    const capMat = shoeStyle === "sneakers" ? mats.sole : mats.upper;
    const capSlot = shoeStyle === "sneakers" ? null : "shoeColor";
    const toeCapMesh = buildToeCap(THREE, last, shoeStyle, capMat);
    addFoot(toeCapMesh, capSlot, "shoeToeCap");

    // Style-specific details
    if (shoeStyle === "sneakers") {
      addSneakerDetails(THREE, last, s.sideSign, bw, bh, mats, addFoot);
    } else if (shoeStyle === "maryJanes") {
      addMaryJaneDetails(THREE, last, s.sideSign, bw, bh, mats, addFoot);
    } else if (shoeStyle === "boots") {
      addBootDetails(THREE, last, shinPivot, s.sideSign, bw, bh, mats, addFoot, addShin);
    } else if (shoeStyle === "loafers") {
      addLoaferDetails(THREE, last, s.sideSign, bw, bh, mats, addFoot);
    }
  }

  return added;
}
export const META = {
  id: 'cozy-dorm-rug',
  name: 'Cozy Woven Dorm Rug',
  kind: 'prop',
  footprint: [1.68, 1.14],
  variants: [
    'Round Concentric Rings',
    'Rectangular Border & Medallion',
    'Shaggy Long Pile',
  ],
  note: 'Hero stylised dorm rug (~1.6 m) sculpted as a single continuous wavy surface with braided trim, hand-painted woven/shaggy maps + bump maps, and multi-strand tapered tassel fringe.',
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function parseColor(THREE, input, fallbackHex) {
  const c = new THREE.Color();
  if (input !== undefined && input !== null) {
    try {
      c.set(input);
      return c;
    } catch (_) {
      // fall through to fallback
    }
  }
  c.set(fallbackHex);
  return c;
}

function colorToRgb(c) {
  const hex = c.getHex();
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function mixRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function rgbStr(rgb, alpha) {
  return alpha === undefined
    ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
    : `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

function makePalette(THREE, opts) {
  const primaryCol = parseColor(THREE, opts.primary, '#ba5d43');
  const secondaryCol = parseColor(THREE, opts.secondary, '#efe2cc');
  const accentCol = parseColor(THREE, opts.accent, '#3c626b');

  const p = colorToRgb(primaryCol);
  const s = colorToRgb(secondaryCol);
  const a = colorToRgb(accentCol);
  const warmDark = [34, 21, 16];
  const warmCream = [255, 250, 242];
  const coolDark = [18, 22, 26];

  return {
    primaryCol,
    secondaryCol,
    accentCol,
    p,
    s,
    a,
    pDark: mixRgb(p, warmDark, 0.36),
    pMidDark: mixRgb(p, warmDark, 0.18),
    pLight: mixRgb(p, s, 0.34),
    sDark: mixRgb(s, [98, 80, 62], 0.24),
    sDeep: mixRgb(s, [78, 62, 48], 0.42),
    sLight: mixRgb(s, warmCream, 0.4),
    aDark: mixRgb(a, coolDark, 0.36),
    aLight: mixRgb(a, s, 0.34),
  };
}

function createTaperedTubeGeometry(THREE, curve, tubularSegments, radialSegments, radiusFn, closed) {
  const frames = curve.computeFrenetFrames(tubularSegments, !!closed);
  const ringVerts = radialSegments + 1;
  const positions = [];
  const uvs = [];
  const indices = [];

  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const V = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    curve.getPointAt(t, P);
    N.copy(frames.normals[i]);
    B.copy(frames.binormals[i]);
    const r = Math.max(0.00025, radiusFn(t, i, tubularSegments));

    for (let j = 0; j <= radialSegments; j++) {
      const v = (j / radialSegments) * Math.PI * 2;
      const sin = Math.sin(v);
      const cos = -Math.cos(v);
      V.set(
        P.x + r * (cos * N.x + sin * B.x),
        P.y + r * (cos * N.y + sin * B.y),
        P.z + r * (cos * N.z + sin * B.z)
      );
      positions.push(V.x, V.y, V.z);
      uvs.push(t, j / radialSegments);
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * ringVerts + j;
      const b = (i + 1) * ringVerts + j;
      const c = (i + 1) * ringVerts + (j + 1);
      const d = i * ringVerts + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  if (!closed) {
    // Tip cap at t = 1
    curve.getPointAt(1, P);
    const tipCenterIdx = positions.length / 3;
    positions.push(P.x, P.y, P.z);
    uvs.push(1, 0.5);
    const lastRingStart = tubularSegments * ringVerts;
    for (let j = 0; j < radialSegments; j++) {
      indices.push(lastRingStart + j, tipCenterIdx, lastRingStart + j + 1);
    }
    // Base cap at t = 0
    curve.getPointAt(0, P);
    const baseCenterIdx = positions.length / 3;
    positions.push(P.x, P.y, P.z);
    uvs.push(0, 0.5);
    for (let j = 0; j < radialSegments; j++) {
      indices.push(j + 1, baseCenterIdx, j);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function mergeGeometries(THREE, geometries) {
  let totalVerts = 0;
  let totalIndices = 0;
  for (let g = 0; g < geometries.length; g++) {
    const geo = geometries[g];
    totalVerts += geo.attributes.position.count;
    totalIndices += geo.index ? geo.index.count : geo.attributes.position.count;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const indices = new Uint32Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;

  for (let g = 0; g < geometries.length; g++) {
    const geo = geometries[g];
    const pos = geo.attributes.position;
    const norm = geo.attributes.normal;
    const uv = geo.attributes.uv;
    const count = pos.count;

    positions.set(pos.array, vOffset * 3);
    if (norm) normals.set(norm.array, vOffset * 3);
    if (uv) uvs.set(uv.array, vOffset * 2);

    if (geo.index) {
      const idxArr = geo.index.array;
      for (let k = 0; k < idxArr.length; k++) {
        indices[iOffset + k] = idxArr[k] + vOffset;
      }
      iOffset += idxArr.length;
    } else {
      for (let k = 0; k < count; k++) {
        indices[iOffset + k] = vOffset + k;
      }
      iOffset += count;
    }

    vOffset += count;
    geo.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  return merged;
}

function smoothSphereSeamNormals(geo, segU, segV) {
  const norm = geo.attributes.normal;
  const stride = segU + 1;
  for (let iy = 0; iy <= segV; iy++) {
    const i0 = iy * stride;
    const i1 = iy * stride + segU;
    let nx = norm.getX(i0) + norm.getX(i1);
    let ny = norm.getY(i0) + norm.getY(i1);
    let nz = norm.getZ(i0) + norm.getZ(i1);
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    norm.setXYZ(i0, nx, ny, nz);
    norm.setXYZ(i1, nx, ny, nz);
  }
  norm.needsUpdate = true;
}

// Shared boundary evaluator so sculpted rug body, edge piping, and tassels align seamlessly
function evalRugBoundary(variant, phi, spec, kit) {
  const cp = Math.cos(phi);
  const sp = Math.sin(phi);

  if (variant === 0) {
    const R = spec.radius;
    const wave =
      0.011 * Math.sin(phi * 5 + 0.4) +
      0.006 * Math.sin(phi * 9 - 1.2) +
      0.014 * (kit.noise(cp * 1.9 + 3.2, sp * 1.9 + 2.6) - 0.5);
    const r = R + wave;
    return {
      x: r * cp,
      z: r * sp,
      nx: cp,
      nz: sp,
    };
  }

  const hx = spec.hx;
  const hz = spec.hz;
  const p = variant === 2 ? 7.0 : 10.5;
  const acp = Math.abs(cp);
  const asp = Math.abs(sp);
  const denom = Math.pow(Math.pow(acp, p) + Math.pow(asp, p), 1 / p);
  const bx = hx * (cp / denom);
  const bz = hz * (sp / denom);

  const n1 = kit.noise(bx * 2.1 + 4.3, bz * 2.1 + 1.9) - 0.5;
  const n2 = kit.noise(bx * 4.8 + 8.7, bz * 4.8 + 6.2) - 0.5;
  const amp = variant === 2 ? 0.022 : 0.014;
  const ripple = 1 + n1 * amp + n2 * (amp * 0.45);

  const gx = (cp >= 0 ? 1 : -1) * Math.pow(acp + 1e-6, p - 1) / hx;
  const gz = (sp >= 0 ? 1 : -1) * Math.pow(asp + 1e-6, p - 1) / hz;
  const glen = Math.hypot(gx, gz) || 1;

  return {
    x: bx * ripple,
    z: bz * ripple,
    nx: gx / glen,
    nz: gz / glen,
  };
}

function evalFloorEdgeLift(x, z, edgeFactor, variant, kit) {
  if (edgeFactor <= 0.001) return 0;
  const n = kit.noise(x * 2.7 + 1.4, z * 2.7 + 5.9);
  const lift = Math.max(0, n - 0.44) * (variant === 2 ? 0.011 : 0.0085);
  return lift * edgeFactor;
}

function buildSculptedRugGeometry(THREE, variant, spec, kit) {
  const segU = 128;
  const segV = 44;
  const geo = new THREE.SphereGeometry(1, segU, segV);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  const thetaTop = 0.41 * Math.PI;
  const thetaBot = 0.59 * Math.PI;
  const rimBulge = spec.thickness * (variant === 2 ? 0.62 : 0.52);

  for (let i = 0; i < pos.count; i++) {
    const sx = pos.getX(i);
    const sy = clamp(pos.getY(i), -1, 1);
    const sz = pos.getZ(i);

    const theta = Math.acos(sy);
    const phi = Math.atan2(sz, sx);
    const bnd = evalRugBoundary(variant, phi, spec, kit);

    let rho;
    let yNorm;
    let outwardBulge = 0;

    if (theta <= thetaTop) {
      rho = theta / thetaTop;
      yNorm = 1.0;
      // Gentle pillow roll-off near top rim
      const shoulder = smoothstep(0.86, 1.0, rho);
      yNorm -= shoulder * (variant === 2 ? 0.14 : 0.08);
    } else if (theta < thetaBot) {
      const u = (theta - thetaTop) / (thetaBot - thetaTop);
      const alpha = u * Math.PI;
      rho = 1.0;
      outwardBulge = rimBulge * Math.sin(alpha);
      const topShoulderH = variant === 2 ? 0.86 : 0.92;
      yNorm = 0.5 * (1 + Math.cos(alpha)) * topShoulderH;
    } else {
      rho = (Math.PI - theta) / (Math.PI - thetaBot);
      yNorm = 0.0;
    }

    const edgeBlend = smoothstep(0.22, 1.0, rho);
    let x;
    let z;

    if (variant === 0) {
      const baseX = spec.radius * Math.cos(phi);
      const baseZ = spec.radius * Math.sin(phi);
      const wx = baseX + (bnd.x - baseX) * edgeBlend;
      const wz = baseZ + (bnd.z - baseZ) * edgeBlend;
      x = wx * rho + bnd.nx * outwardBulge;
      z = wz * rho + bnd.nz * outwardBulge;
    } else {
      x = bnd.x * rho + bnd.nx * outwardBulge;
      z = bnd.z * rho + bnd.nz * outwardBulge;
    }

    const edgeLiftFactor = smoothstep(0.68, 1.0, rho);
    const baseLift = 0.0006 + evalFloorEdgeLift(x, z, edgeLiftFactor, variant, kit);

    // Sculpted top-surface weave relief
    let relief = 0;
    if (yNorm > 0.05) {
      const topMask = smoothstep(0.05, 0.55, yNorm);
      if (variant === 0) {
        const rDist = Math.hypot(x, z);
        const coilRidge = Math.cos(rDist * 2 * Math.PI * 16) * 0.0014;
        const lump = (kit.noise(x * 5.2 + 1.1, z * 5.2 + 3.4) - 0.5) * 0.0022;
        relief = (coilRidge + lump) * topMask;
      } else if (variant === 1) {
        const loomWave = (kit.noise(x * 5.5 + 2.3, z * 5.5 + 7.1) - 0.5) * 0.0018;
        const borderBand =
          smoothstep(0.76, 0.84, rho) * (1 - smoothstep(0.92, 0.98, rho)) * 0.0011;
        const medDist = Math.hypot(x / 0.34, z / 0.24);
        const medRelief = (1 - smoothstep(0.72, 1.05, medDist)) * 0.0012;
        relief = (loomWave + borderBand + medRelief) * topMask;
      } else {
        // Plush shaggy macro-fluff undulations & soft pillowy crown
        const fluff1 = (kit.noise(x * 8.5 + 2.1, z * 8.5 + 4.7) - 0.5) * 0.006;
        const fluff2 = (kit.noise(x * 17.0 + 6.4, z * 17.0 + 1.8) - 0.5) * 0.003;
        const pillow = (1 - rho * rho) * 0.0035;
        relief = (fluff1 + fluff2 + pillow) * topMask;
      }
    }

    const y = Math.max(0.0005, baseLift + yNorm * spec.thickness + relief);
    pos.setXYZ(i, x, y, z);

    // Planar UVs aligned to rug dimensions (seamless over rounded rim)
    let u;
    let v;
    if (variant === 0) {
      const span = spec.radius * 2.05;
      u = clamp(0.5 + x / span, 0.002, 0.998);
      v = clamp(0.5 - z / span, 0.002, 0.998);
    } else {
      u = clamp(0.5 + x / (spec.hx * 2.04), 0.002, 0.998);
      v = clamp(0.5 - z / (spec.hz * 2.04), 0.002, 0.998);
    }
    uv.setXY(i, u, v);
  }

  geo.computeVertexNormals();
  smoothSphereSeamNormals(geo, segU, segV);
  return geo;
}

// ---------- TEXTURE PAINTERS ----------

function paintYarnTrimTextures(THREE, kit, baseRgb, darkRgb, lightRgb) {
  const colorTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = rgbStr(baseRgb);
    ctx.fillRect(0, 0, w, h);

    // Diagonal twisted wool cord plies
    for (let i = -h; i < w + h; i += 10) {
      ctx.strokeStyle = rgbStr(darkRgb, 0.45);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h * 0.6, h);
      ctx.stroke();

      ctx.strokeStyle = rgbStr(lightRgb, 0.35);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(i + 4, 0);
      ctx.lineTo(i + 4 + h * 0.6, h);
      ctx.stroke();
    }
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.RepeatWrapping;
  colorTex.repeat.set(18, 1);

  const bumpTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let i = -h; i < w + h; i += 10) {
      ctx.strokeStyle = '#303030';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h * 0.6, h);
      ctx.stroke();

      ctx.strokeStyle = '#e5e5e5';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(i + 4.5, 0);
      ctx.lineTo(i + 4.5 + h * 0.6, h);
      ctx.stroke();
    }
  });
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;
  bumpTex.repeat.set(18, 1);

  return { map: colorTex, bumpMap: bumpTex };
}

function paintRoundTextures(THREE, kit, pal) {
  const size = 1024;
  const rng = mulberry32(104729);

  const colorTex = kit.canvasTexture(size, size, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const R = w * 0.485;

    ctx.fillStyle = rgbStr(pal.aDark);
    ctx.fillRect(0, 0, w, h);

    const fillDisc = (rFrac, col) => {
      ctx.beginPath();
      ctx.arc(cx, cy, R * rFrac, 0, Math.PI * 2);
      ctx.fillStyle = rgbStr(col);
      ctx.fill();
    };

    const strokeRing = (rFrac, widthFrac, col, dash) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R * rFrac, 0, Math.PI * 2);
      ctx.strokeStyle = col;
      ctx.lineWidth = R * widthFrac;
      if (dash) ctx.setLineDash(dash);
      ctx.stroke();
      ctx.restore();
    };

    // Base concentric bands
    fillDisc(1.02, pal.a);
    fillDisc(0.935, pal.s);
    fillDisc(0.845, pal.pDark);
    fillDisc(0.815, pal.p);
    fillDisc(0.65, pal.a);
    fillDisc(0.595, pal.s);
    fillDisc(0.445, pal.pLight);
    fillDisc(0.385, pal.a);
    fillDisc(0.245, pal.p);
    fillDisc(0.155, pal.s);
    fillDisc(0.085, pal.a);

    // Outer cream band: sawtooth woven triangles
    const teeth = 44;
    ctx.fillStyle = rgbStr(pal.p);
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * Math.PI * 2;
      const a1 = ((i + 0.5) / teeth) * Math.PI * 2;
      const a2 = ((i + 1) / teeth) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a0) * R * 0.855, cy + Math.sin(a0) * R * 0.855);
      ctx.lineTo(cx + Math.cos(a1) * R * 0.922, cy + Math.sin(a1) * R * 0.922);
      ctx.lineTo(cx + Math.cos(a2) * R * 0.855, cy + Math.sin(a2) * R * 0.855);
      ctx.closePath();
      ctx.fill();
    }

    // Wide primary ring: 18 woven kilim diamond medallions
    const medCount = 18;
    for (let i = 0; i < medCount; i++) {
      const ang = (i / medCount) * Math.PI * 2;
      const rMid = R * 0.732;
      ctx.save();
      ctx.translate(cx + Math.cos(ang) * rMid, cy + Math.sin(ang) * rMid);
      ctx.rotate(ang);

      // Outer cream diamond
      ctx.fillStyle = rgbStr(pal.s);
      ctx.beginPath();
      ctx.moveTo(R * 0.06, 0);
      ctx.lineTo(0, R * 0.072);
      ctx.lineTo(-R * 0.06, 0);
      ctx.lineTo(0, -R * 0.072);
      ctx.closePath();
      ctx.fill();

      // Inner accent diamond
      ctx.fillStyle = rgbStr(pal.a);
      ctx.beginPath();
      ctx.moveTo(R * 0.032, 0);
      ctx.lineTo(0, R * 0.038);
      ctx.lineTo(-R * 0.032, 0);
      ctx.lineTo(0, -R * 0.038);
      ctx.closePath();
      ctx.fill();

      // Center cream dot
      ctx.fillStyle = rgbStr(pal.sLight);
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.011, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Small accent diamond between medallions
      const angMid = ((i + 0.5) / medCount) * Math.PI * 2;
      ctx.save();
      ctx.translate(cx + Math.cos(angMid) * rMid, cy + Math.sin(angMid) * rMid);
      ctx.rotate(angMid);
      ctx.fillStyle = rgbStr(pal.pDark);
      ctx.beginPath();
      ctx.moveTo(R * 0.024, 0);
      ctx.lineTo(0, R * 0.02);
      ctx.lineTo(-R * 0.024, 0);
      ctx.lineTo(0, -R * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Cream ring (0.445..0.595): double zigzag chevron wave
    const zigCount = 32;
    ctx.strokeStyle = rgbStr(pal.p);
    ctx.lineWidth = R * 0.018;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= zigCount * 2; i++) {
      const ang = (i / (zigCount * 2)) * Math.PI * 2;
      const rr = i % 2 === 0 ? R * 0.475 : R * 0.565;
      const px = cx + Math.cos(ang) * rr;
      const py = cy + Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    // Accent dots tucked into chevron valleys
    ctx.fillStyle = rgbStr(pal.a);
    for (let i = 0; i < zigCount; i++) {
      const ang = ((i + 0.5) / zigCount) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * R * 0.502, cy + Math.sin(ang) * R * 0.502, R * 0.012, 0, Math.PI * 2);
      ctx.fill();
    }

    // Inner accent ring (0.245..0.385): 12 cream folk petals
    const petals = 12;
    for (let i = 0; i < petals; i++) {
      const ang = (i / petals) * Math.PI * 2;
      ctx.save();
      ctx.translate(cx + Math.cos(ang) * R * 0.315, cy + Math.sin(ang) * R * 0.315);
      ctx.rotate(ang);
      ctx.fillStyle = rgbStr(pal.s);
      ctx.beginPath();
      ctx.moveTo(R * 0.052, 0);
      ctx.quadraticCurveTo(0, R * 0.036, -R * 0.052, 0);
      ctx.quadraticCurveTo(0, -R * 0.036, R * 0.052, 0);
      ctx.fill();

      ctx.fillStyle = rgbStr(pal.p);
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.014, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Center 8-point folk star
    ctx.fillStyle = rgbStr(pal.sLight);
    ctx.beginPath();
    const starPts = 8;
    for (let i = 0; i < starPts * 2; i++) {
      const ang = (i / (starPts * 2)) * Math.PI * 2;
      const rr = i % 2 === 0 ? R * 0.135 : R * 0.052;
      const px = cx + Math.cos(ang) * rr;
      const py = cy + Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    fillDisc(0.045, pal.p);
    fillDisc(0.02, pal.sLight);

    // Dotted running-stitch highlights on narrow bands
    strokeRing(0.83, 0.01, rgbStr(pal.s, 0.85), [10, 12]);
    strokeRing(0.622, 0.012, rgbStr(pal.sLight, 0.85), [8, 12]);
    strokeRing(0.415, 0.01, rgbStr(pal.pDark, 0.6), [7, 9]);
    strokeRing(0.968, 0.014, rgbStr(pal.s, 0.65), [12, 10]);

    // Concentric braided-cord grooves & diagonal yarn-twist hatches
    const coils = 38;
    for (let c = 1; c <= coils; c++) {
      const rFrac = c / coils;
      const rr = R * rFrac;
      strokeRing(rFrac, 0.0045, 'rgba(22, 14, 10, 0.22)');
      strokeRing(rFrac - 0.005, 0.003, 'rgba(255, 248, 236, 0.12)');

      const circumference = 2 * Math.PI * rr;
      const ticks = Math.max(12, Math.floor(circumference / 9));
      const dr = R / coils;
      ctx.lineWidth = 1.6;
      for (let k = 0; k < ticks; k++) {
        const a0 = (k / ticks) * Math.PI * 2 + (c % 2) * 0.04;
        const a1 = a0 + (c % 2 === 0 ? 1 : -1) * (6 / (rr + 12));
        const rIn = Math.max(2, rr - dr * 0.44);
        const rOut = rr + dr * 0.44;
        ctx.strokeStyle =
          rng() > 0.5 ? 'rgba(255,248,236,0.11)' : 'rgba(24,14,10,0.13)';
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a0) * rIn, cy + Math.sin(a0) * rIn);
        ctx.lineTo(cx + Math.cos(a1) * rOut, cy + Math.sin(a1) * rOut);
        ctx.stroke();
      }
    }

    // Subtle soft edge vignette for warm depth
    const vig = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 1.04);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(24,14,8,0.16)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  });

  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.anisotropy = 4;

  const bumpTex = kit.canvasTexture(size, size, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const R = w * 0.485;

    ctx.fillStyle = '#787878';
    ctx.fillRect(0, 0, w, h);

    const coils = 38;
    const dr = R / coils;
    for (let c = 1; c <= coils; c++) {
      const rr = R * (c / coils);
      // Bright coil ridge
      ctx.beginPath();
      ctx.arc(cx, cy, rr - dr * 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#c8c8c8';
      ctx.lineWidth = dr * 0.55;
      ctx.stroke();

      // Dark groove between coils
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.strokeStyle = '#2e2e2e';
      ctx.lineWidth = Math.max(2, dr * 0.22);
      ctx.stroke();

      // Angled braid ply bumps
      const ticks = Math.max(14, Math.floor((2 * Math.PI * rr) / 8));
      ctx.strokeStyle = '#efefef';
      ctx.lineWidth = 2.2;
      for (let k = 0; k < ticks; k++) {
        const a0 = (k / ticks) * Math.PI * 2;
        const a1 = a0 + (c % 2 === 0 ? 1 : -1) * (5.5 / (rr + 12));
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a0) * (rr - dr * 0.75), cy + Math.sin(a0) * (rr - dr * 0.75));
        ctx.lineTo(cx + Math.cos(a1) * (rr - dr * 0.18), cy + Math.sin(a1) * (rr - dr * 0.18));
        ctx.stroke();
      }
    }
  });
  bumpTex.anisotropy = 4;

  return { map: colorTex, bumpMap: bumpTex };
}

function paintRectangularTextures(THREE, kit, pal, spec) {
  const size = 1024;
  const aspect = spec.hx / spec.hz; // ~1.41
  const rng = mulberry32(42197);

  // Convert metre-proportioned border thickness into canvas pixels
  const pxX = (frac) => frac * size / aspect;
  const pxY = (frac) => frac * size;

  const drawSteppedDiamond = (ctx, cx, cy, rx, ry, steps, fillCol) => {
    ctx.fillStyle = fillCol;
    for (let i = -steps; i <= steps; i++) {
      const t = Math.abs(i) / (steps + 0.35);
      const halfW = rx * (1 - t);
      const y0 = cy + (i / steps) * ry;
      const barH = (ry / steps) * 1.08;
      ctx.fillRect(cx - halfW, y0 - barH * 0.5, halfW * 2, barH);
    }
  };

  const colorTex = kit.canvasTexture(size, size, (ctx, w, h) => {
    // 1. Outer selvage base
    ctx.fillStyle = rgbStr(pal.pDark);
    ctx.fillRect(0, 0, w, h);

    const frameRect = (m, fillCol) => {
      const mx = pxX(m);
      const my = pxY(m);
      ctx.fillStyle = fillCol;
      ctx.fillRect(mx, my, w - mx * 2, h - my * 2);
    };

    // Nested border zones
    frameRect(0.032, rgbStr(pal.s));
    frameRect(0.068, rgbStr(pal.pDark));
    frameRect(0.078, rgbStr(pal.a));
    frameRect(0.172, rgbStr(pal.pDark));
    frameRect(0.182, rgbStr(pal.s));
    frameRect(0.206, rgbStr(pal.aDark));
    frameRect(0.214, rgbStr(pal.p));

    // Subtle hand-dyed abrash bands across the inner field
    const fx0 = pxX(0.214);
    const fy0 = pxY(0.214);
    const fw = w - fx0 * 2;
    const fh = h - fy0 * 2;
    for (let y = fy0; y < fy0 + fh; y += 8) {
      const n = kit.noise(y * 0.015 + 2.3, 4.1);
      const col = n > 0.5 ? pal.pLight : pal.pMidDark;
      ctx.fillStyle = rgbStr(col, Math.abs(n - 0.5) * 0.24);
      ctx.fillRect(fx0, y, fw, 8);
    }

    // Outer guard band (0.032..0.068): repeating tiny kilim diamonds
    const gMidX = pxX(0.05);
    const gMidY = pxY(0.05);
    const drawGuardMotif = (x, y) => {
      ctx.fillStyle = rgbStr(pal.a);
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x + 7, y);
      ctx.lineTo(x, y + 9);
      ctx.lineTo(x - 7, y);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = rgbStr(pal.p);
      ctx.fillRect(x - 2, y - 2.5, 4, 5);
    };

    for (let x = pxX(0.08); x <= w - pxX(0.08); x += 26) {
      drawGuardMotif(x, gMidY);
      drawGuardMotif(x, h - gMidY);
    }
    for (let y = pxY(0.08); y <= h - pxY(0.08); y += 34) {
      drawGuardMotif(gMidX, y);
      drawGuardMotif(w - gMidX, y);
    }

    // Main decorative border (0.078..0.172): folk rosettes & diamonds
    const mMidX = pxX(0.125);
    const mMidY = pxY(0.125);
    const drawBorderMotif = (x, y, alt) => {
      if (alt) {
        drawSteppedDiamond(ctx, x, y, 22 / aspect, 24, 4, rgbStr(pal.s));
        drawSteppedDiamond(ctx, x, y, 11 / aspect, 12, 3, rgbStr(pal.p));
        ctx.fillStyle = rgbStr(pal.sLight);
        ctx.fillRect(x - 3, y - 3, 6, 6);
      } else {
        // Woven star-cross motif
        ctx.fillStyle = rgbStr(pal.pLight);
        ctx.fillRect(x - 14 / aspect, y - 4, 28 / aspect, 8);
        ctx.fillRect(x - 4, y - 16, 8, 32);
        ctx.fillStyle = rgbStr(pal.s);
        ctx.fillRect(x - 6, y - 6, 12, 12);
        ctx.fillStyle = rgbStr(pal.aDark);
        ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
      }
    };

    // Corner anchor squares in main border
    const corners = [
      [mMidX, mMidY],
      [w - mMidX, mMidY],
      [mMidX, h - mMidY],
      [w - mMidX, h - mMidY],
    ];
    for (let c = 0; c < corners.length; c++) {
      const [cx, cy] = corners[c];
      ctx.fillStyle = rgbStr(pal.p);
      ctx.fillRect(cx - pxX(0.042), cy - pxY(0.042), pxX(0.084), pxY(0.084));
      drawSteppedDiamond(ctx, cx, cy, pxX(0.032), pxY(0.032), 4, rgbStr(pal.s));
      ctx.fillStyle = rgbStr(pal.a);
      ctx.fillRect(cx - 5, cy - 5, 10, 10);
    }

    const topCount = 13;
    for (let i = 0; i < topCount; i++) {
      const x = pxX(0.20) + (i / (topCount - 1)) * (w - pxX(0.40));
      drawBorderMotif(x, mMidY, i % 2 === 0);
      drawBorderMotif(x, h - mMidY, i % 2 === 0);
    }
    const sideCount = 9;
    for (let i = 0; i < sideCount; i++) {
      const y = pxY(0.20) + (i / (sideCount - 1)) * (h - pxY(0.40));
      drawBorderMotif(mMidX, y, i % 2 === 0);
      drawBorderMotif(w - mMidX, y, i % 2 === 0);
    }

    // Inner corner spandrels (stepped kilim brackets)
    const drawSpandrel = (sx, sy, dx, dy) => {
      const layers = [
        { sz: 0.11, col: pal.s },
        { sz: 0.082, col: pal.a },
        { sz: 0.046, col: pal.pLight },
      ];
      for (let l = 0; l < layers.length; l++) {
        const steps = 5;
        ctx.fillStyle = rgbStr(layers[l].col);
        for (let k = 0; k < steps; k++) {
          const bw = pxX(layers[l].sz) * (1 - k / steps);
          const bh = pxY(layers[l].sz) / steps;
          const x = dx > 0 ? sx : sx - bw;
          const y = dy > 0 ? sy + k * bh : sy - (k + 1) * bh;
          ctx.fillRect(x, y, bw, bh + 1);
        }
      }
    };
    drawSpandrel(fx0, fy0, 1, 1);
    drawSpandrel(fx0 + fw, fy0, -1, 1);
    drawSpandrel(fx0, fy0 + fh, 1, -1);
    drawSpandrel(fx0 + fw, fy0 + fh, -1, -1);

    // Subtle filler stars in field
    const starSpots = [
      [w * 0.30, h * 0.33],
      [w * 0.70, h * 0.33],
      [w * 0.30, h * 0.67],
      [w * 0.70, h * 0.67],
    ];
    for (let i = 0; i < starSpots.length; i++) {
      const [sx, sy] = starSpots[i];
      drawSteppedDiamond(ctx, sx, sy, 18 / aspect, 20, 3, rgbStr(pal.s, 0.92));
      drawSteppedDiamond(ctx, sx, sy, 8 / aspect, 9, 2, rgbStr(pal.a));
    }

    // Hero Central Medallion + Finials
    const cx = w * 0.5;
    const cy = h * 0.5;

    // Pendant finials extending toward -X and +X
    for (const dir of [-1, 1]) {
      ctx.fillStyle = rgbStr(pal.s);
      ctx.fillRect(cx + dir * 150 - 24, cy - 6, 48, 12);
      drawSteppedDiamond(ctx, cx + dir * 206, cy, 40 / aspect, 44, 5, rgbStr(pal.s));
      drawSteppedDiamond(ctx, cx + dir * 206, cy, 22 / aspect, 24, 4, rgbStr(pal.a));
      ctx.fillStyle = rgbStr(pal.p);
      ctx.fillRect(cx + dir * 206 - 5, cy - 5, 10, 10);
    }

    // Layered stepped central medallion
    drawSteppedDiamond(ctx, cx, cy, 232 / aspect, 212, 12, rgbStr(pal.pDark));
    drawSteppedDiamond(ctx, cx, cy, 218 / aspect, 198, 12, rgbStr(pal.s));
    drawSteppedDiamond(ctx, cx, cy, 178 / aspect, 160, 10, rgbStr(pal.a));
    drawSteppedDiamond(ctx, cx, cy, 128 / aspect, 114, 8, rgbStr(pal.pLight));
    drawSteppedDiamond(ctx, cx, cy, 94 / aspect, 84, 7, rgbStr(pal.sLight));

    // Crisp 8-point folk star in medallion heart
    ctx.fillStyle = rgbStr(pal.a);
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const rr = i % 2 === 0 ? 58 : 24;
      const px = cx + Math.cos(ang) * (rr / aspect);
      const py = cy + Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    drawSteppedDiamond(ctx, cx, cy, 22 / aspect, 22, 3, rgbStr(pal.p));
    ctx.fillStyle = rgbStr(pal.sLight);
    ctx.fillRect(cx - 5, cy - 5, 10, 10);

    // Whip-stitch ticks along top and bottom selvage edges
    ctx.strokeStyle = rgbStr(pal.s, 0.72);
    ctx.lineWidth = 3;
    for (let x = 12; x < w - 12; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, 2);
      ctx.lineTo(x + 4, pxY(0.026));
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, h - 2);
      ctx.lineTo(x + 4, h - pxY(0.026));
      ctx.stroke();
    }

    // Authentic hand-loomed weft & warp weave texture overlay
    for (let y = 0; y < h; y += 4) {
      const shade = rng() > 0.5 ? 'rgba(255,248,236,0.065)' : 'rgba(22,12,8,0.085)';
      ctx.fillStyle = shade;
      ctx.fillRect(0, y, w, 2);
    }
    for (let x = 0; x < w; x += 7) {
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255,248,236,0.045)' : 'rgba(18,12,8,0.055)';
      ctx.fillRect(x, 0, 2, h);
    }
    // Fine wool slub flecks
    for (let i = 0; i < 2400; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const len = 5 + rng() * 14;
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255,250,240,0.09)' : 'rgba(25,15,10,0.11)';
      ctx.fillRect(x, y, len, 1.8);
    }
  });

  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.anisotropy = 4;

  const bumpTex = kit.canvasTexture(size, size, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);

    // Dominant woven weft ribs
    for (let y = 0; y < h; y += 4) {
      ctx.fillStyle = '#b4b4b4';
      ctx.fillRect(0, y, w, 2);
      ctx.fillStyle = '#565656';
      ctx.fillRect(0, y + 2, w, 2);
    }

    // Subtle warp cross-threads
    for (let x = 0; x < w; x += 6) {
      ctx.fillStyle = 'rgba(220,220,220,0.22)';
      ctx.fillRect(x, 0, 2, h);
    }

    // Slightly raised tufted border & central medallion relief
    ctx.strokeStyle = 'rgba(40,40,40,0.65)';
    ctx.lineWidth = 4;
    ctx.strokeRect(pxX(0.075), pxY(0.075), w - pxX(0.15), h - pxY(0.15));
    ctx.strokeRect(pxX(0.18), pxY(0.18), w - pxX(0.36), h - pxY(0.36));

    drawSteppedDiamond(ctx, w * 0.5, h * 0.5, 224 / aspect, 204, 12, 'rgba(235,235,235,0.22)');
    drawSteppedDiamond(ctx, w * 0.5, h * 0.5, 130 / aspect, 116, 8, 'rgba(250,250,250,0.2)');
  });
  bumpTex.anisotropy = 4;

  return { map: colorTex, bumpMap: bumpTex };
}

function paintShaggyTextures(THREE, kit, pal, spec) {
  const size = 1024;
  const aspect = spec.hx / spec.hz;
  const rng = mulberry32(99371);

  // Analytic cozy Moroccan Berber shag pattern (primary plush ground, secondary diamond trellis, accent stripes & centers)
  const samplePattern = (u, v) => {
    const du = Math.abs(u - 0.5);
    const dv = Math.abs(v - 0.5);

    // Cozy double accent stripe near ends (-X and +X)
    if (du > 0.37 && du < 0.415) {
      return pal.a;
    }
    if (du > 0.425 && du < 0.455) {
      return pal.s;
    }
    if (du > 0.455 || dv > 0.46) {
      return pal.pMidDark;
    }

    // Soft Moroccan diamond trellis in central area
    const gx = (u - 0.5) * 3.8 * aspect;
    const gy = (v - 0.5) * 3.8;
    const fx = Math.abs((((gx + 20) % 1) + 1) % 1 - 0.5);
    const fy = Math.abs((((gy + 20) % 1) + 1) % 1 - 0.5);
    const dLine = Math.abs(fx + fy - 0.5);

    if (dLine < 0.068) {
      return pal.s;
    }
    if (fx + fy < 0.135) {
      return pal.a;
    }
    return pal.p;
  };

  // Pre-generate 9,500 shaggy pile wool tufts shared identically between color & bump maps!
  const tuftCount = 9500;
  const tufts = new Array(tuftCount);
  for (let i = 0; i < tuftCount; i++) {
    const u = rng();
    const v = rng();
    const x = u * size;
    const y = v * size;
    const nAng = kit.noise(u * 9.5 + 1.3, v * 9.5 + 4.8);
    const ang = nAng * Math.PI * 2 + (rng() - 0.5) * 1.15;
    const len = 14 + rng() * 19;
    const bend = (rng() - 0.5) * 11;
    const width = 3.2 + rng() * 3.4;
    const shade = (rng() - 0.5) * 0.24;
    tufts[i] = { u, v, x, y, ang, len, bend, width, shade };
  }

  const colorTex = kit.canvasTexture(size, size, (ctx, w, h) => {
    // Soft darkened wool backing underneath pile
    ctx.fillStyle = rgbStr(pal.pDark);
    ctx.fillRect(0, 0, w, h);

    // Coarse under-pattern fill so deep shadows between tufts stay color-true
    const cell = 16;
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        const base = samplePattern((x + 8) / w, (y + 8) / h);
        ctx.fillStyle = rgbStr(mixRgb(base, [28, 20, 16], 0.36));
        ctx.fillRect(x, y, cell, cell);
      }
    }

    ctx.lineCap = 'round';
    const white = [255, 250, 242];
    const dark = [28, 19, 14];

    for (let i = 0; i < tuftCount; i++) {
      const t = tufts[i];
      const base = samplePattern(t.u, t.v);
      const ca = Math.cos(t.ang);
      const sa = Math.sin(t.ang);
      const x1 = t.x + ca * t.len;
      const y1 = t.y + sa * t.len;
      const cx = (t.x + x1) * 0.5 - sa * t.bend;
      const cy = (t.y + y1) * 0.5 + ca * t.bend;

      // Shadowed wool root
      const rootCol = mixRgb(base, dark, 0.34);
      ctx.strokeStyle = rgbStr(rootCol, 0.85);
      ctx.lineWidth = t.width * 1.15;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.quadraticCurveTo(cx, cy, x1, y1);
      ctx.stroke();

      // Plush sunlit wool tip
      const tipCol =
        t.shade >= 0
          ? mixRgb(base, white, 0.14 + t.shade)
          : mixRgb(base, dark, -t.shade * 0.7);
      ctx.strokeStyle = rgbStr(tipCol, 0.94);
      ctx.lineWidth = t.width * 0.78;
      ctx.beginPath();
      ctx.moveTo(t.x + ca * (t.len * 0.18), t.y + sa * (t.len * 0.18));
      ctx.quadraticCurveTo(cx, cy, x1, y1);
      ctx.stroke();
    }
  });

  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.anisotropy = 4;

  const bumpTex = kit.canvasTexture(size, size, (ctx, w, h) => {
    // Deep shadow floor between long shag strands
    ctx.fillStyle = '#242424';
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = 'round';

    for (let i = 0; i < tuftCount; i++) {
      const t = tufts[i];
      const ca = Math.cos(t.ang);
      const sa = Math.sin(t.ang);
      const x1 = t.x + ca * t.len;
      const y1 = t.y + sa * t.len;
      const cx = (t.x + x1) * 0.5 - sa * t.bend;
      const cy = (t.y + y1) * 0.5 + ca * t.bend;

      // Dark root crevice
      ctx.strokeStyle = 'rgba(20,20,20,0.75)';
      ctx.lineWidth = t.width * 1.35;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.quadraticCurveTo(cx, cy, x1, y1);
      ctx.stroke();

      // Bright high pile strand body
      const hi = Math.round(185 + (t.shade + 0.12) * 260);
      const ch = clamp(hi, 145, 255);
      ctx.strokeStyle = `rgb(${ch},${ch},${ch})`;
      ctx.lineWidth = t.width * 0.82;
      ctx.beginPath();
      ctx.moveTo(t.x + ca * (t.len * 0.16), t.y + sa * (t.len * 0.16));
      ctx.quadraticCurveTo(cx, cy, x1, y1);
      ctx.stroke();
    }
  });
  bumpTex.anisotropy = 4;

  return { map: colorTex, bumpMap: bumpTex };
}

// ---------- 3D EDGE PIPING & TASSEL FRINGE ----------

function buildEdgePipingGeometry(THREE, variant, spec, kit) {
  const sampleCount = variant === 0 ? 120 : 128;
  const pts = [];

  for (let i = 0; i < sampleCount; i++) {
    const phi = (i / sampleCount) * Math.PI * 2;
    const bnd = evalRugBoundary(variant, phi, spec, kit);
    const lift = evalFloorEdgeLift(bnd.x, bnd.z, 1.0, variant, kit);
    const outPush = spec.thickness * (variant === 2 ? 0.34 : 0.38);
    const px = bnd.x + bnd.nx * outPush;
    const pz = bnd.z + bnd.nz * outPush;
    const py = Math.max(0.0045, lift + spec.thickness * 0.44);
    pts.push(new THREE.Vector3(px, py, pz));
  }

  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
  const baseR = variant === 2 ? 0.0075 : 0.0048;
  const twists = variant === 0 ? 96 : 112;

  return createTaperedTubeGeometry(
    THREE,
    curve,
    variant === 0 ? 144 : 156,
    7,
    (t) => baseR * (1 + 0.14 * Math.sin(t * Math.PI * 2 * twists)),
    true
  );
}

function buildShaggyEdgeTuftsGeometry(THREE, spec, kit) {
  const rng = mulberry32(55123);
  const geos = [];
  const count = 64;

  for (let i = 0; i < count; i++) {
    const phi = (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.04;
    const bnd = evalRugBoundary(2, phi, spec, kit);
    const lift = evalFloorEdgeLift(bnd.x, bnd.z, 1.0, 2, kit);
    const tx = -bnd.nz;
    const tz = bnd.nx;

    const len = 0.026 + rng() * 0.018;
    const sway = (rng() - 0.5) * 0.018;
    const yStart = lift + spec.thickness * (0.58 + rng() * 0.2);

    const p0 = new THREE.Vector3(
      bnd.x - bnd.nx * 0.012,
      yStart,
      bnd.z - bnd.nz * 0.012
    );
    const p1 = new THREE.Vector3(
      bnd.x + bnd.nx * (len * 0.45) + tx * (sway * 0.4),
      yStart + 0.004,
      bnd.z + bnd.nz * (len * 0.45) + tz * (sway * 0.4)
    );
    const p2 = new THREE.Vector3(
      bnd.x + bnd.nx * len + tx * sway,
      Math.max(0.004, yStart - 0.009),
      bnd.z + bnd.nz * len + tz * sway
    );

    const curve = new THREE.CatmullRomCurve3([p0, p1, p2]);
    const r0 = 0.0052 + rng() * 0.0018;
    geos.push(
      createTaperedTubeGeometry(THREE, curve, 5, 5, (t) => r0 * (1 - 0.68 * t * t), false)
    );
  }

  return mergeGeometries(THREE, geos);
}

function addTasselBundle(THREE, anchor, dir, tang, cfg, rng, strandGeos, knotGeos, accentStrandGeos) {
  // Small sculpted knot wrap hugging the bundle base
  const knotPts = [];
  const knotTurns = 9;
  const knotR = cfg.knotRadius;
  const up = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k <= knotTurns; k++) {
    const u = k / knotTurns;
    const ang = u * Math.PI * 2.2 - 0.4;
    const along = 0.004 + u * 0.01;
    const px = anchor.x + dir.x * along + tang.x * Math.cos(ang) * knotR;
    const py = Math.max(
      0.0022,
      anchor.y * 0.85 + Math.sin(ang) * (knotR * 0.62)
    );
    const pz = anchor.z + dir.z * along + tang.z * Math.cos(ang) * knotR;
    knotPts.push(new THREE.Vector3(px, py, pz));
  }
  const knotCurve = new THREE.CatmullRomCurve3(knotPts);
  knotGeos.push(
    createTaperedTubeGeometry(THREE, knotCurve, 9, 5, () => cfg.knotTubeR, false)
  );

  // Many thin tapered yarn strands emerging from the knot and resting organically on the floor
  const count = cfg.strandsPerBundle;
  for (let s = 0; s < count; s++) {
    const spread = ((s / (count - 1)) - 0.5) * cfg.fanWidth + (rng() - 0.5) * 0.004;
    const len = cfg.minLen + rng() * (cfg.maxLen - cfg.minLen);
    const rBase = cfg.strandRadius * (0.88 + rng() * 0.24);
    const curl1 = (rng() - 0.5) * cfg.curlAmp;
    const curl2 = (rng() - 0.5) * cfg.curlAmp * 1.35;

    const pts = [];
    const steps = 4;
    for (let k = 0; k <= steps; k++) {
      const f = k / steps;
      const dist = -0.008 + f * (len + 0.008);
      const lat =
        spread * smoothstep(0.05, 0.85, f) +
        curl1 * Math.sin(f * Math.PI) +
        curl2 * f * f;

      const radAtF = rBase * (1 - 0.72 * Math.pow(f, 1.35));
      const floorY = radAtF + 0.0007;
      // Smooth catenary droop from rug rim down onto the floor
      const droop = Math.pow(1 - f, 2.3);
      const yRipple = Math.sin(f * Math.PI * 2 + s * 1.7) * 0.0007 * smoothstep(0.3, 0.9, f);
      const py = Math.max(floorY, floorY + (anchor.y - floorY) * droop + yRipple);

      pts.push(
        new THREE.Vector3(
          anchor.x + dir.x * dist + tang.x * lat,
          py,
          anchor.z + dir.z * dist + tang.z * lat
        )
      );
    }

    const curve = new THREE.CatmullRomCurve3(pts);
    const strandGeo = createTaperedTubeGeometry(
      THREE,
      curve,
      8,
      5,
      (t) => rBase * (1 - 0.74 * Math.pow(t, 1.35)),
      false
    );

    if (accentStrandGeos && s === 0 && rng() < 0.28) {
      accentStrandGeos.push(strandGeo);
    } else {
      strandGeos.push(strandGeo);
    }
  }
  void up;
}

function buildFringeGroups(THREE, variant, spec, kit, mats) {
  const rng = mulberry32(variant * 7919 + 31337);

  if (variant === 0) {
    // Round boho rug: 36 radial tassel clusters all around the circular edge
    const fringeGroup = new THREE.Group();
    fringeGroup.name = 'fringe';

    const strandGeos = [];
    const knotGeos = [];
    const accentStrandGeos = [];
    const bundles = 36;

    const cfg = {
      strandsPerBundle: 4,
      minLen: 0.068,
      maxLen: 0.092,
      fanWidth: 0.022,
      curlAmp: 0.013,
      strandRadius: 0.0024,
      knotRadius: 0.0062,
      knotTubeR: 0.0025,
    };

    for (let i = 0; i < bundles; i++) {
      const phi = (i / bundles) * Math.PI * 2;
      const bnd = evalRugBoundary(0, phi, spec, kit);
      const lift = evalFloorEdgeLift(bnd.x, bnd.z, 1.0, 0, kit);
      const anchor = new THREE.Vector3(
        bnd.x + bnd.nx * 0.003,
        Math.max(0.0055, lift + spec.thickness * 0.4),
        bnd.z + bnd.nz * 0.003
      );
      const dir = new THREE.Vector3(bnd.nx, 0, bnd.nz).normalize();
      const tang = new THREE.Vector3(-dir.z, 0, dir.x);

      addTasselBundle(THREE, anchor, dir, tang, cfg, rng, strandGeos, knotGeos, accentStrandGeos);
    }

    const strandMesh = new THREE.Mesh(mergeGeometries(THREE, strandGeos), mats.fringe);
    strandMesh.userData.slot = 'secondary';
    strandMesh.castShadow = true;
    strandMesh.receiveShadow = true;
    fringeGroup.add(strandMesh);

    if (accentStrandGeos.length > 0) {
      const accentStrandsMesh = new THREE.Mesh(mergeGeometries(THREE, accentStrandGeos), mats.primaryYarn);
      accentStrandsMesh.userData.slot = 'primary';
      accentStrandsMesh.castShadow = true;
      accentStrandsMesh.receiveShadow = true;
      fringeGroup.add(accentStrandsMesh);
    }

    const knotMesh = new THREE.Mesh(mergeGeometries(THREE, knotGeos), mats.accentYarn);
    knotMesh.userData.slot = 'accent';
    knotMesh.castShadow = true;
    knotMesh.receiveShadow = true;
    fringeGroup.add(knotMesh);

    return [fringeGroup];
  }

  // Rectangular & Shaggy rugs: lush tassel fringe at both short ends (-X and +X)
  const isShag = variant === 2;
  const bundlesPerEnd = isShag ? 16 : 20;
  const zSpan = spec.hz * (isShag ? 0.84 : 0.88);

  const cfg = isShag
    ? {
        strandsPerBundle: 5,
        minLen: 0.092,
        maxLen: 0.124,
        fanWidth: 0.028,
        curlAmp: 0.02,
        strandRadius: 0.0031,
        knotRadius: 0.0082,
        knotTubeR: 0.0032,
      }
    : {
        strandsPerBundle: 4,
        minLen: 0.078,
        maxLen: 0.104,
        fanWidth: 0.022,
        curlAmp: 0.013,
        strandRadius: 0.0024,
        knotRadius: 0.0062,
        knotTubeR: 0.0025,
      };

  const groups = [];
  const ends = [
    { name: 'fringeL', side: -1 },
    { name: 'fringeR', side: 1 },
  ];

  for (let e = 0; e < ends.length; e++) {
    const { name, side } = ends[e];
    const g = new THREE.Group();
    g.name = name;

    const strandGeos = [];
    const knotGeos = [];
    const accentStrandGeos = [];

    for (let i = 0; i < bundlesPerEnd; i++) {
      const f = i / (bundlesPerEnd - 1);
      const targetZ = (f - 0.5) * 2 * zSpan;
      // Angle on the superellipse corresponding to targetZ on the +/-X edge
      const phi = side > 0 ? Math.atan2(targetZ / spec.hz, 1) : Math.PI - Math.atan2(targetZ / spec.hz, 1);
      const bnd = evalRugBoundary(variant, phi, spec, kit);
      const lift = evalFloorEdgeLift(bnd.x, bnd.z, 1.0, variant, kit);

      const anchor = new THREE.Vector3(
        bnd.x + side * 0.004,
        Math.max(0.0055, lift + spec.thickness * (isShag ? 0.34 : 0.42)),
        bnd.z
      );
      const dir = new THREE.Vector3(side, 0, 0);
      const tang = new THREE.Vector3(0, 0, 1);

      addTasselBundle(THREE, anchor, dir, tang, cfg, rng, strandGeos, knotGeos, accentStrandGeos);
    }

    const strandMesh = new THREE.Mesh(mergeGeometries(THREE, strandGeos), mats.fringe);
    strandMesh.userData.slot = 'secondary';
    strandMesh.castShadow = true;
    strandMesh.receiveShadow = true;
    g.add(strandMesh);

    if (accentStrandGeos.length > 0) {
      const accentStrandsMesh = new THREE.Mesh(mergeGeometries(THREE, accentStrandGeos), mats.primaryYarn);
      accentStrandsMesh.userData.slot = 'primary';
      accentStrandsMesh.castShadow = true;
      accentStrandsMesh.receiveShadow = true;
      g.add(accentStrandsMesh);
    }

    const knotMesh = new THREE.Mesh(mergeGeometries(THREE, knotGeos), mats.accentYarn);
    knotMesh.userData.slot = 'accent';
    knotMesh.castShadow = true;
    knotMesh.receiveShadow = true;
    g.add(knotMesh);

    groups.push(g);
  }

  return groups;
}

// ---------- MODULE EXPORTS ----------

export function build(THREE, opts, kit) {
  const safeOpts = opts || {};
  const variant =
    safeOpts.variant !== undefined && safeOpts.variant !== null
      ? (((safeOpts.variant | 0) % 3) + 3) % 3
      : 0;

  const pal = makePalette(THREE, safeOpts);

  const spec =
    variant === 0
      ? { radius: 0.74, thickness: 0.016 }
      : variant === 1
        ? { hx: 0.76, hz: 0.54, thickness: 0.013 }
        : { hx: 0.75, hz: 0.54, thickness: 0.027 };

  // Paint main woven/shaggy textures from opts colors
  const mainTextures =
    variant === 0
      ? paintRoundTextures(THREE, kit, pal)
      : variant === 1
        ? paintRectangularTextures(THREE, kit, pal, spec)
        : paintShaggyTextures(THREE, kit, pal, spec);

  // Paint twisted yarn textures for piping & tassels
  const fringeTex = paintYarnTrimTextures(THREE, kit, pal.s, pal.sDark, pal.sLight);
  const accentYarnTex = paintYarnTrimTextures(THREE, kit, pal.a, pal.aDark, pal.aLight);
  const primaryYarnTex = paintYarnTrimTextures(THREE, kit, pal.p, pal.pDark, pal.pLight);

  // Fabric MeshPhysicalMaterials with cozy soft wool sheen
  const sheenMain = new THREE.Color().setRGB(
    pal.sLight[0] / 255,
    pal.sLight[1] / 255,
    pal.sLight[2] / 255
  );

  const rugMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: mainTextures.map,
    bumpMap: mainTextures.bumpMap,
    bumpScale: variant === 2 ? 0.028 : variant === 0 ? 0.011 : 0.0085,
    roughness: variant === 2 ? 0.96 : 0.91,
    metalness: 0.0,
    sheen: variant === 2 ? 0.95 : 0.76,
    sheenRoughness: variant === 2 ? 0.85 : 0.78,
    sheenColor: sheenMain,
  });

  const fringeMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: fringeTex.map,
    bumpMap: fringeTex.bumpMap,
    bumpScale: 0.004,
    roughness: 0.93,
    metalness: 0.0,
    sheen: 0.75,
    sheenRoughness: 0.82,
    sheenColor: sheenMain,
  });

  const accentYarnMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: accentYarnTex.map,
    bumpMap: accentYarnTex.bumpMap,
    bumpScale: 0.005,
    roughness: 0.9,
    metalness: 0.0,
    sheen: 0.72,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color().setRGB(
      pal.aLight[0] / 255,
      pal.aLight[1] / 255,
      pal.aLight[2] / 255
    ),
  });

  const primaryYarnMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: primaryYarnTex.map,
    bumpMap: primaryYarnTex.bumpMap,
    bumpScale: 0.005,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.8,
    sheenRoughness: 0.82,
    sheenColor: new THREE.Color().setRGB(
      pal.pLight[0] / 255,
      pal.pLight[1] / 255,
      pal.pLight[2] / 255
    ),
  });

  const root = new THREE.Group();
  root.name = 'cozy_rug';

  // Main continuous sculpted rug body + braided edge binding
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'body';

  const rugGeo = buildSculptedRugGeometry(THREE, variant, spec, kit);
  const rugMesh = new THREE.Mesh(rugGeo, rugMat);
  rugMesh.name = 'rug_surface';
  rugMesh.userData.slot = 'primary';
  rugMesh.castShadow = true;
  rugMesh.receiveShadow = true;
  bodyGroup.add(rugMesh);

  const pipingGeo = buildEdgePipingGeometry(THREE, variant, spec, kit);
  const pipingMat = variant === 2 ? primaryYarnMat : accentYarnMat;
  const pipingMesh = new THREE.Mesh(pipingGeo, pipingMat);
  pipingMesh.name = 'edge_piping';
  pipingMesh.userData.slot = variant === 2 ? 'primary' : 'accent';
  pipingMesh.castShadow = true;
  pipingMesh.receiveShadow = true;
  bodyGroup.add(pipingMesh);

  if (variant === 2) {
    const edgeTuftsGeo = buildShaggyEdgeTuftsGeometry(THREE, spec, kit);
    const edgeTuftsMesh = new THREE.Mesh(edgeTuftsGeo, primaryYarnMat);
    edgeTuftsMesh.name = 'shag_edge_tufts';
    edgeTuftsMesh.userData.slot = 'primary';
    edgeTuftsMesh.castShadow = true;
    edgeTuftsMesh.receiveShadow = true;
    bodyGroup.add(edgeTuftsMesh);
  }

  root.add(bodyGroup);

  // Multi-strand tapered tassel fringe
  const fringeGroups = buildFringeGroups(THREE, variant, spec, kit, {
    fringe: fringeMat,
    accentYarn: accentYarnMat,
    primaryYarn: primaryYarnMat,
  });
  for (let i = 0; i < fringeGroups.length; i++) {
    root.add(fringeGroups[i]);
  }

  return root;
}

export function idle(group, t) {
  // Subtle dorm-window draft rustling the lightweight cotton fringe horizontally (always grounded on floor)
  const fringeL = group.getObjectByName('fringeL');
  const fringeR = group.getObjectByName('fringeR');
  const fringe = group.getObjectByName('fringe');

  if (fringeL) {
    fringeL.rotation.y = Math.sin(t * 1.15) * 0.0025;
  }
  if (fringeR) {
    fringeR.rotation.y = Math.sin(t * 1.15 + 1.4) * 0.0025;
  }
  if (fringe) {
    fringe.rotation.y = Math.sin(t * 0.9) * 0.0018;
  }
}
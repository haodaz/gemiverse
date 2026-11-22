export const META = {
  id: "cozy_dorm_loveseat",
  name: "Cozy Two-Seat Sofa",
  kind: "furniture",
  footprint: [1.5, 0.86],
  variants: {
    lavender: { fabric: "#b8a2e3", wood: "#c89462", accent: "#f2a7b8" },
    sage: { fabric: "#9fbca8", wood: "#b88252", accent: "#f0cf9e" },
    buttercream: { fabric: "#e6d4b3", wood: "#9e6b43", accent: "#d98b7c" },
  },
  note: "Small two-seat dorm loveseat with sculpted rounded arms, seam piping, two loose cushions, an accent throw pillow, and short turned wooden legs.",
};

// ---------------------------------------------------------------------------
// Math & colour utilities
// ---------------------------------------------------------------------------

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function parseHexToRgb(THREE, input, fallbackHex) {
  const hex = typeof input === "string" && input.trim() ? input.trim() : fallbackHex;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (m) {
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const c = new THREE.Color(hex);
  const style = c.getStyle();
  const sm = /(\d+),\s*(\d+),\s*(\d+)/.exec(style);
  if (sm) return [+sm[1], +sm[2], +sm[3]];
  return [184, 162, 227];
}

function rgbStr(r, g, b, a) {
  const rr = clamp(Math.round(r), 0, 255);
  const gg = clamp(Math.round(g), 0, 255);
  const bb = clamp(Math.round(b), 0, 255);
  return a === undefined ? `rgb(${rr},${gg},${bb})` : `rgba(${rr},${gg},${bb},${a})`;
}

function tintColor(THREE, hex, lift = 0.45) {
  const c = new THREE.Color(hex);
  return c.lerp(new THREE.Color(0xffffff), lift);
}

function fbm(kit, x, y) {
  return (
    kit.noise(x, y) * 0.55 +
    kit.noise(x * 2.13 + 7.1, y * 2.13 + 3.7) * 0.30 +
    kit.noise(x * 4.31 + 19.4, y * 4.31 + 11.2) * 0.15
  );
}

// ---------------------------------------------------------------------------
// Procedural CanvasTextures (via kit.canvasTexture & kit.noise)
// ---------------------------------------------------------------------------

function makeFabricTextures(THREE, kit, baseHex, isKnitAccent) {
  const [br, bg, bb] = parseHexToRgb(THREE, baseHex, "#b8a2e3");

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = rgbStr(br, bg, bb);
    ctx.fillRect(0, 0, w, h);

    // Subtle organic dye mottling for cozy linen/boucle depth
    const cell = 16;
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        const n = fbm(kit, (x / w) * 6.0, (y / h) * 6.0) - 0.5;
        const delta = n * 18;
        ctx.fillStyle = rgbStr(br + delta, bg + delta, bb + delta, 0.35);
        ctx.fillRect(x, y, cell, cell);
      }
    }

    if (!isKnitAccent) {
      // Woven upholstery warp & weft with soft slubs
      const step = 4;
      for (let y = 0; y < h; y += step) {
        const rowTone = (kit.noise(1.7, y * 0.13) - 0.5) * 16;
        ctx.fillStyle = rgbStr(br + rowTone + 6, bg + rowTone + 6, bb + rowTone + 6, 0.42);
        ctx.fillRect(0, y, w, 2);
        ctx.fillStyle = rgbStr(br - 12 + rowTone, bg - 12 + rowTone, bb - 12 + rowTone, 0.28);
        ctx.fillRect(0, y + 2, w, 2);
      }
      for (let x = 0; x < w; x += step) {
        const colTone = (kit.noise(x * 0.13, 8.3) - 0.5) * 16;
        for (let y = 0; y < h; y += step * 2) {
          const offset = ((x / step) % 2) * step;
          const slub = (kit.noise(x * 0.07, (y + offset) * 0.07) - 0.5) * 18;
          ctx.fillStyle = rgbStr(br + 10 + colTone + slub, bg + 10 + colTone + slub, bb + 10 + colTone + slub, 0.46);
          ctx.fillRect(x, (y + offset) % h, 2, step);
        }
      }
      // Fine bouclé flecks
      for (let i = 0; i < 1800; i++) {
        const fx = ((i * 73.13) % 1) * w;
        const fy = ((i * 197.41) % 1) * h;
        const light = kit.noise(fx * 0.09, fy * 0.09) > 0.5 ? 16 : -14;
        ctx.fillStyle = rgbStr(br + light, bg + light, bb + light, 0.25);
        ctx.fillRect(fx, fy, 2, 2);
      }
    } else {
      // Cozy quilted waffle-knit pattern for the accent throw pillow
      const step = 6;
      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          const n = (kit.noise(x * 0.08, y * 0.08) - 0.5) * 14;
          const diag = ((x + y) / step) % 2 === 0;
          const v = diag ? 10 : -9;
          ctx.fillStyle = rgbStr(br + v + n, bg + v + n, bb + v + n, 0.48);
          ctx.fillRect(x, y, step - 1, step - 1);
        }
      }
      // Subtle stitched cream-tinted diamond lines
      ctx.strokeStyle = rgbStr(br + 34, bg + 30, bb + 28, 0.42);
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      const tile = 64;
      for (let k = -h; k < w + h; k += tile) {
        ctx.beginPath();
        ctx.moveTo(k, 0);
        ctx.lineTo(k + h, h);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(k, h);
        ctx.lineTo(k + h, 0);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  });

  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "rgb(128,128,128)";
    ctx.fillRect(0, 0, w, h);
    const step = isKnitAccent ? 6 : 4;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const checker = (((x / step) + (y / step)) % 2) === 0;
        const n = (kit.noise(x * 0.12, y * 0.12) - 0.5) * 32;
        const val = (checker ? 156 : 102) + n;
        ctx.fillStyle = rgbStr(val, val, val);
        ctx.fillRect(x, y, step - 1, step - 1);
      }
    }
    if (isKnitAccent) {
      ctx.strokeStyle = "rgba(85,85,85,0.65)";
      ctx.lineWidth = 2;
      const tile = 32;
      for (let k = -h; k < w + h; k += tile) {
        ctx.beginPath();
        ctx.moveTo(k, 0);
        ctx.lineTo(k + h, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(k, h);
        ctx.lineTo(k + h, 0);
        ctx.stroke();
      }
    }
  });

  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;

  return { map, bump };
}

function makeWoodTextures(THREE, kit, woodHex) {
  const [br, bg, bb] = parseHexToRgb(THREE, woodHex, "#c89462");

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = rgbStr(br, bg, bb);
    ctx.fillRect(0, 0, w, h);

    // Warm longitudinal grain streaks & subtle cathedral rings
    for (let x = 0; x < w; x += 2) {
      for (let y = 0; y < h; y += 8) {
        const nx = x / w;
        const ny = y / h;
        const warp = fbm(kit, nx * 4.0, ny * 1.4) * 3.2;
        const ring = Math.sin((nx * 18.0 + warp) * Math.PI);
        const fine = (kit.noise(nx * 46.0, ny * 5.0) - 0.5) * 16;
        const shade = ring * 13 + fine;
        ctx.fillStyle = rgbStr(br + shade, bg + shade * 0.85, bb + shade * 0.65, 0.55);
        ctx.fillRect(x, y, 2, 8);
      }
    }
    // Delicate darker wood pores
    for (let i = 0; i < 650; i++) {
      const px = ((i * 53.71) % 1) * w;
      const py = ((i * 131.29) % 1) * h;
      const len = 8 + ((i * 19.3) % 22);
      ctx.fillStyle = rgbStr(br - 32, bg - 28, bb - 22, 0.22);
      ctx.fillRect(px, py, 1.4, len);
    }
  });

  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "rgb(128,128,128)";
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 2) {
      const n = (kit.noise(x * 0.18, 2.5) - 0.5) * 44;
      ctx.fillStyle = rgbStr(128 + n, 128 + n, 128 + n);
      ctx.fillRect(x, 0, 2, h);
    }
  });
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;

  return { map, bump };
}

// ---------------------------------------------------------------------------
// Sculpting & procedural geometry helpers
// ---------------------------------------------------------------------------

// Solves |t*ux|^px + |t*uy|^py + |t*uz|^pz = 1 for smooth, pole-free rounded volumes
function superEllipsoid(ux, uy, uz, px, py, pz) {
  const a = Math.abs(ux);
  const b = Math.abs(uy);
  const c = Math.abs(uz);
  let t = 1.0;
  for (let i = 0; i < 8; i++) {
    const ta = t * a;
    const tb = t * b;
    const tc = t * c;
    const va = ta > 0 ? Math.pow(ta, px) : 0;
    const vb = tb > 0 ? Math.pow(tb, py) : 0;
    const vc = tc > 0 ? Math.pow(tc, pz) : 0;
    const val = va + vb + vc - 1.0;
    const deriv = (px * va + py * vb + pz * vc) / t;
    if (deriv > 1e-8) {
      t = clamp(t - val / deriv, 0.1, 2.5);
    }
  }
  return [ux * t, uy * t, uz * t];
}

// Merges coincident vertices of an IcosahedronGeometry so computeVertexNormals() is smooth
function createMergedIcosahedron(THREE, detail) {
  const raw = new THREE.IcosahedronGeometry(1, detail);
  const pos = raw.getAttribute("position");
  const unique = [];
  const index = new Uint32Array(pos.count);
  const map = new Map();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
    let idx = map.get(key);
    if (idx === undefined) {
      idx = unique.length / 3;
      map.set(key, idx);
      unique.push(x, y, z);
    }
    index[i] = idx;
  }

  raw.dispose();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(unique, 3));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  return geo;
}

// Sculpts a continuous closed surface, computes smooth vertex normals, then applies crisp box-mapped UVs
function buildSculptedForm(THREE, detail, evalPoint, uvScale = 2.6) {
  const indexed = createMergedIcosahedron(THREE, detail);
  const pos = indexed.getAttribute("position");
  const outPt = [0, 0, 0];

  for (let i = 0; i < pos.count; i++) {
    evalPoint(pos.getX(i), pos.getY(i), pos.getZ(i), outPt);
    pos.setXYZ(i, outPt[0], outPt[1], outPt[2]);
  }
  pos.needsUpdate = true;
  indexed.computeVertexNormals();

  // Preserve smooth normals while splitting UVs per-triangle along dominant face plane
  const geo = indexed.toNonIndexed();
  indexed.dispose();

  const gPos = geo.getAttribute("position");
  const gNorm = geo.getAttribute("normal");
  const uvs = new Float32Array(gPos.count * 2);

  for (let i = 0; i < gPos.count; i += 3) {
    const nx = Math.abs(gNorm.getX(i) + gNorm.getX(i + 1) + gNorm.getX(i + 2));
    const ny = Math.abs(gNorm.getY(i) + gNorm.getY(i + 1) + gNorm.getY(i + 2));
    const nz = Math.abs(gNorm.getZ(i) + gNorm.getZ(i + 1) + gNorm.getZ(i + 2));

    for (let k = 0; k < 3; k++) {
      const vi = i + k;
      const vx = gPos.getX(vi);
      const vy = gPos.getY(vi);
      const vz = gPos.getZ(vi);
      let u, v;
      if (ny >= nx && ny >= nz) {
        u = vx * uvScale;
        v = vz * uvScale;
      } else if (nx >= ny && nx >= nz) {
        u = vz * uvScale;
        v = vy * uvScale;
      } else {
        u = vx * uvScale;
        v = vy * uvScale;
      }
      uvs[vi * 2] = u;
      uvs[vi * 2 + 1] = v;
    }
  }

  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  return geo;
}

// Parallel-transport (twist-free) tube builder along CatmullRomCurve3 with optional radius taper
function buildPipingTube(THREE, points, { radius = 0.0072, radiusFn = null, tubularSegs = 48, radialSegs = 8, closed = false } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, closed, "centripetal", 0.5);
  const segs = tubularSegs;
  const rSegs = radialSegs;

  const pts = [];
  const tangents = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    pts.push(curve.getPointAt(u));
    tangents.push(curve.getTangentAt(u).normalize());
  }

  // Build minimum-rotation (Bishop) frames
  const normals = new Array(segs + 1);
  const binormals = new Array(segs + 1);
  const upRef = Math.abs(tangents[0].y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  normals[0] = new THREE.Vector3().crossVectors(tangents[0], upRef).normalize();
  binormals[0] = new THREE.Vector3().crossVectors(tangents[0], normals[0]).normalize();

  const q = new THREE.Quaternion();
  for (let i = 1; i <= segs; i++) {
    q.setFromUnitVectors(tangents[i - 1], tangents[i]);
    const n = normals[i - 1].clone().applyQuaternion(q);
    n.addScaledVector(tangents[i], -n.dot(tangents[i])).normalize();
    normals[i] = n;
    binormals[i] = new THREE.Vector3().crossVectors(tangents[i], n).normalize();
  }

  // Smoothly remove residual end-to-end twist on closed loops
  if (closed) {
    const cosA = clamp(normals[segs].dot(normals[0]), -1, 1);
    const sinA = binormals[0].dot(normals[segs]);
    const twist = Math.atan2(sinA, cosA);
    for (let i = 1; i <= segs; i++) {
      const a = -twist * (i / segs);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const n = normals[i];
      const b = binormals[i];
      const nn = n.clone().multiplyScalar(ca).addScaledVector(b, sa);
      const nb = b.clone().multiplyScalar(ca).addScaledVector(n, -sa);
      normals[i] = nn;
      binormals[i] = nb;
    }
  }

  const ringCols = rSegs + 1;
  const vertCount = (segs + 1) * ringCols;
  const positions = new Float32Array(vertCount * 3);
  const vNormals = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices = [];

  const tmpN = new THREE.Vector3();
  const tmpP = new THREE.Vector3();
  const totalLen = curve.getLength();

  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const rad = radiusFn ? radiusFn(u) : radius;
    const p = pts[i];
    const n = normals[i];
    const b = binormals[i];

    for (let j = 0; j <= rSegs; j++) {
      const v = j / rSegs;
      const theta = v * Math.PI * 2;
      const ct = Math.cos(theta);
      const st = Math.sin(theta);

      tmpN.set(0, 0, 0).addScaledVector(n, ct).addScaledVector(b, st).normalize();
      tmpP.copy(p).addScaledVector(tmpN, rad);

      const idx = i * ringCols + j;
      positions[idx * 3] = tmpP.x;
      positions[idx * 3 + 1] = tmpP.y;
      positions[idx * 3 + 2] = tmpP.z;

      vNormals[idx * 3] = tmpN.x;
      vNormals[idx * 3 + 1] = tmpN.y;
      vNormals[idx * 3 + 2] = tmpN.z;

      uvs[idx * 2] = u * totalLen * 3.5;
      uvs[idx * 2 + 1] = v;
    }
  }

  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < rSegs; j++) {
      const a = i * ringCols + j;
      const b = (i + 1) * ringCols + j;
      const c = (i + 1) * ringCols + (j + 1);
      const d = i * ringCols + (j + 1);
      indices.push(a, d, b, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(vNormals, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

// Turned wooden leg profile via LatheGeometry (28 profile points)
function buildTurnedLegGeometry(THREE, length) {
  // Normalized y from 0 (bottom of wooden foot) to 1 (top embedded collar)
  const rawProfile = [
    [0.0000, 0.000],
    [0.0115, 0.000],
    [0.0155, 0.015],
    [0.0172, 0.045],
    [0.0195, 0.085],
    [0.0192, 0.125],
    [0.0158, 0.170],
    [0.0148, 0.215],
    [0.0178, 0.260],
    [0.0228, 0.315],
    [0.0258, 0.375],
    [0.0252, 0.435],
    [0.0215, 0.485],
    [0.0176, 0.525],
    [0.0212, 0.560],
    [0.0226, 0.590],
    [0.0188, 0.625],
    [0.0198, 0.665],
    [0.0222, 0.720],
    [0.0248, 0.775],
    [0.0276, 0.825],
    [0.0308, 0.870],
    [0.0332, 0.900],
    [0.0355, 0.925],
    [0.0355, 0.960],
    [0.0320, 0.990],
    [0.0160, 1.000],
    [0.0000, 1.000],
  ];

  // Build downward from y = +0.015 (inside base) down to y = -length (foot bottom)
  const totalH = length + 0.015;
  const pts = rawProfile.map(([r, t]) => new THREE.Vector2(r, -length + t * totalH));
  const geo = new THREE.LatheGeometry(pts, 24);
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Sofa shaping functions (shared between sculpted forms & seam piping!)
// ---------------------------------------------------------------------------

function makeBaseEvaluator(kit) {
  const cx = 0, cy = 0.200, cz = 0.010;
  const hx = 0.645, hy = 0.078, hz = 0.355;

  return function evalBase(ux, uy, uz, out) {
    const [sx, sy, sz] = superEllipsoid(ux, uy, uz, 5.2, 4.8, 4.8);
    let x = sx * hx;
    let y = sy * hy;
    let z = sz * hz;

    // Soft padded front apron bulge
    if (sz > 0.2) {
      const belly = Math.cos(sy * Math.PI * 0.5);
      z += 0.012 * smoothstep(0.2, 0.9, sz) * belly;
    }

    // Gentle recessed seat deck top so loose cushions nestle snugly
    const inSeatX = 1.0 - smoothstep(0.68, 0.88, Math.abs(sx));
    const inSeatZ = smoothstep(-0.55, -0.15, sz) * (1.0 - smoothstep(0.75, 0.96, sz));
    if (sy > 0.45) {
      y -= 0.014 * smoothstep(0.45, 0.9, sy) * inSeatX * inSeatZ;
    }

    // Flatten underside cleanly at y = 0.122
    if (sy < -0.65) {
      const f = smoothstep(-0.65, -0.96, sy);
      y = y * (1 - 0.12 * f) + (-hy * 0.98) * (0.12 * f);
    }

    // Subtle organic upholstery fullness
    const ripple = (kit.noise(x * 4.5 + 3.1, z * 4.5 + 1.7) - 0.5) * 0.004;
    out[0] = cx + x;
    out[1] = cy + y + ripple;
    out[2] = cz + z;
  };
}

function makeArmEvaluator(kit, side) {
  // side: -1 for left arm, +1 for right arm
  const cx = side * 0.595;
  const cy = 0.352;
  const cz = 0.012;
  const hx = 0.114;
  const hy = 0.214;
  const hz = 0.372;

  return function evalArm(ux, uy, uz, out) {
    const [sx, sy, sz] = superEllipsoid(ux, uy, uz, 2.5, 2.9, 5.4);
    let x = sx * hx;
    let y = sy * hy;
    let z = sz * hz;

    const outSign = side * sx; // >0 on outer face of arm, <0 on inner face

    // Classic cozy rolled-arm flare: plump outward swell along upper half
    const rollBand = smoothstep(-0.25, 0.72, sy) * (1.0 - 0.32 * smoothstep(0.72, 1.0, sy));
    const outerMask = smoothstep(-0.2, 0.65, outSign);
    x += side * 0.036 * rollBand * outerMask;

    // Slight inward cuddle roll at the very top crest
    const topCrest = smoothstep(0.45, 0.96, sy);
    x -= side * 0.010 * topCrest * smoothstep(-0.1, 0.7, -outSign);

    // Gentle lower-inner tuck so seat cushions nestle warmly against the arm
    const seatZone = smoothstep(-0.65, -0.1, sy) * (1.0 - smoothstep(0.15, 0.55, sy));
    const innerMask = smoothstep(0.1, 0.85, -outSign);
    x += side * 0.012 * seatZone * innerMask * smoothstep(-0.55, 0.5, sz);

    // Smooth upward sweep toward the rear so arm merges gracefully into backrest
    const backBlend = smoothstep(-0.2, -0.95, sz);
    y += 0.022 * backBlend * smoothstep(-0.3, 0.8, sy);
    x -= side * 0.014 * backBlend;

    // Plump soft dome on the rolled front scroll face
    const frontDome = smoothstep(0.65, 1.0, sz);
    z += 0.014 * frontDome * (1.0 - 0.55 * (sx * sx + sy * sy));

    // Tiny seam-welt pinch around the front face rim
    const frontRim = Math.exp(-Math.pow((sz - 0.82) / 0.11, 2));
    x *= 1.0 - 0.014 * frontRim;
    y *= 1.0 - 0.014 * frontRim;

    // Subtle handcrafted fabric softness
    const soft = (kit.noise(y * 5.2 + side * 4.0, z * 4.4 + 2.1) - 0.5) * 0.004;
    out[0] = cx + x + side * soft;
    out[1] = cy + y + soft * 0.6;
    out[2] = cz + z;
  };
}

function makeBackrestEvaluator(kit) {
  const cx = 0;
  const cy = 0.458;
  const cz = -0.248;
  const hx = 0.655;
  const hy = 0.295;
  const hz = 0.132;

  return function evalBack(ux, uy, uz, out) {
    const [sx, sy, sz] = superEllipsoid(ux, uy, uz, 4.4, 3.0, 2.7);
    let x = sx * hx;
    let y = sy * hy;
    let z = sz * hz;

    // Cozy arched silhouette along top crest, sloping smoothly into the arms
    const arch = Math.cos(sx * Math.PI * 0.5);
    if (sy > 0) {
      y += 0.036 * arch * smoothstep(0.0, 0.85, sy);
      y -= 0.042 * smoothstep(0.62, 0.98, Math.abs(sx)) * smoothstep(0.1, 0.9, sy);
    }

    // Ergonomic backward recline (~10 degrees)
    z -= 0.078 * (sy + 0.35);

    // Subtle wrap-around curve toward the outer shoulders
    z += 0.022 * Math.pow(Math.abs(sx), 2.2);

    // Plush lumbar fullness on the front lower-middle face
    const frontMask = smoothstep(0.15, 0.85, sz);
    const lumbar = Math.exp(-Math.pow((sy + 0.08) / 0.52, 2));
    z += 0.024 * frontMask * lumbar * (1.0 - 0.35 * sx * sx);

    // Gentle central bay crease dividing the two seats
    const centerCrease = Math.exp(-Math.pow(sx / 0.13, 2)) * (1.0 - 0.5 * sy * sy);
    z -= 0.015 * frontMask * centerCrease;

    // Two soft circular button-tuft dimples on the front face
    if (sz > 0.2) {
      for (const tx of [-0.38, 0.38]) {
        const dx = (sx - tx) / 0.14;
        const dy = (sy - 0.24) / 0.22;
        const d2 = dx * dx + dy * dy;
        if (d2 < 4.0) {
          const dimple = Math.exp(-d2 * 1.45);
          z -= 0.026 * dimple * frontMask;
        }
      }
    }

    const soft = (kit.noise(x * 3.8 + 1.3, y * 4.2 + 5.6) - 0.5) * 0.005;
    out[0] = cx + x;
    out[1] = cy + y;
    out[2] = cz + z + soft;
  };
}

function makeSeatCushionEvaluator(kit, side) {
  // Built in cushion-local space centered at origin so each loose cushion can be subtly posed
  const hx = 0.242;
  const hy = 0.084;
  const hz = 0.270;

  return function evalCushion(ux, uy, uz, out) {
    const [sx, sy, sz] = superEllipsoid(ux, uy, uz, 5.4, 4.0, 5.2);
    let x = sx * hx;
    let y = sy * hy;
    let z = sz * hz;

    const r2 = sx * sx + sz * sz;
    const centerWeight = clamp(1.0 - 0.52 * r2, 0, 1);

    // Plush down-stuffed crown on top and gentle fullness on bottom
    if (sy > 0) {
      y += 0.024 * smoothstep(0.15, 0.92, sy) * centerWeight;
    } else {
      y -= 0.008 * smoothstep(-0.15, -0.92, sy) * centerWeight;
    }

    // Soft side-wall boxing bulge
    const wallBand = Math.exp(-Math.pow(sy / 0.45, 2));
    x *= 1.0 + 0.026 * wallBand;
    z *= 1.0 + 0.026 * wallBand;

    // Subtle seam-welt pinch at top & bottom perimeter shoulders where piping wraps
    const edgeBand = smoothstep(0.65, 0.96, Math.max(Math.abs(sx), Math.abs(sz)));
    const weltPinch = Math.exp(-Math.pow((Math.abs(sy) - 0.74) / 0.14, 2)) * edgeBand;
    x *= 1.0 - 0.014 * weltPinch;
    z *= 1.0 - 0.014 * weltPinch;

    // Subtle organic asymmetry so the two loose cushions feel lived-in
    if (side < 0 && sy > 0.2) {
      // Left cushion: faint cozy "just sat in" softness slightly off-center
      const dx = (sx + 0.08) / 0.55;
      const dz = (sz - 0.05) / 0.55;
      const d2 = dx * dx + dz * dz;
      y -= 0.010 * Math.exp(-d2 * 1.4) * smoothstep(0.2, 0.85, sy);
    } else if (side > 0 && sy > 0.2) {
      // Right cushion: tiny depression on outer-back corner where the throw pillow rests
      const dx = (sx - 0.35) / 0.5;
      const dz = (sz + 0.35) / 0.5;
      const d2 = dx * dx + dz * dz;
      y -= 0.009 * Math.exp(-d2 * 1.6) * smoothstep(0.2, 0.85, sy);
    }

    // Fine organic fabric softness
    const soft = (kit.noise(x * 6.5 + side * 9.3, z * 6.5 + 2.4) - 0.5) * 0.004;
    out[0] = x;
    out[1] = y + soft;
    out[2] = z;
  };
}

function makeThrowPillowEvaluator(kit) {
  const hx = 0.156;
  const hy = 0.156;
  const hz = 0.064;

  return function evalPillow(ux, uy, uz, out) {
    const [sx, sy, sz] = superEllipsoid(ux, uy, uz, 4.6, 4.6, 2.2);
    let x = sx * hx;
    let y = sy * hy;
    let z = sz * hz;

    // Pinch thickness sharply toward the outer perimeter like a real sewn throw pillow
    const edgeDist = Math.max(Math.abs(sx), Math.abs(sy));
    const puff = Math.pow(clamp(1.0 - Math.pow(edgeDist, 2.2), 0, 1), 0.72);
    z *= 0.24 + 0.96 * puff;

    // Cute soft pillow "ears" gently pulled out at the 4 corners
    const cornerMask = Math.pow(Math.abs(sx * sy), 1.35);
    x += Math.sign(sx) * 0.018 * cornerMask;
    y += Math.sign(sy) * 0.018 * cornerMask;

    // Slight natural crease & puff asymmetry
    const fold = (kit.noise(x * 11.0 + 4.2, y * 11.0 + 7.8) - 0.5) * 0.007 * (0.4 + 0.6 * edgeDist);
    z += Math.sign(sz || 1) * fold;

    out[0] = x;
    out[1] = y;
    out[2] = z;
  };
}

// Samples a closed or open piping curve directly on a sculpted form's evaluator
function sampleSeamPoints(THREE, evalFn, count, unitDirFn, normalOutOffset = 0.003) {
  const pts = [];
  const p = [0, 0, 0];
  const pEps = [0, 0, 0];
  const v = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const t = i / count;
    const [ux, uy, uz] = unitDirFn(t);
    const len = Math.hypot(ux, uy, uz) || 1;
    const nx = ux / len;
    const ny = uy / len;
    const nz = uz / len;

    evalFn(nx, ny, nz, p);

    // Offset slightly outward along the surface direction so piping sits snugly half-embedded
    if (normalOutOffset !== 0) {
      evalFn(nx * 0.98, ny * 0.98, nz * 0.98, pEps);
      v.set(nx, ny, nz).normalize();
      pts.push(new THREE.Vector3(p[0] + v.x * normalOutOffset, p[1] + v.y * normalOutOffset, p[2] + v.z * normalOutOffset));
    } else {
      pts.push(new THREE.Vector3(p[0], p[1], p[2]));
    }
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function build(THREE, opts = {}, kit) {
  const cfg = {
    fabric: opts.fabric || META.variants.lavender.fabric,
    wood: opts.wood || META.variants.lavender.wood,
    accent: opts.accent || META.variants.lavender.accent,
  };

  const root = new THREE.Group();
  root.name = "cozy_dorm_loveseat";

  // --- Textures & Materials (MeshPhysicalMaterial) ---
  const mainFab = makeFabricTextures(THREE, kit, cfg.fabric, false);
  const accentFab = makeFabricTextures(THREE, kit, cfg.accent, true);
  const woodTex = makeWoodTextures(THREE, kit, cfg.wood);

  const matFabric = new THREE.MeshPhysicalMaterial({
    map: mainFab.map,
    bumpMap: mainFab.bump,
    bumpScale: 0.0042,
    roughness: 0.91,
    metalness: 0.0,
    sheen: 0.85,
    sheenRoughness: 0.65,
    sheenColor: tintColor(THREE, cfg.fabric, 0.58),
  });

  const matPipingAccent = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(cfg.accent),
    bumpMap: mainFab.bump,
    bumpScale: 0.0028,
    roughness: 0.85,
    metalness: 0.0,
    sheen: 0.90,
    sheenRoughness: 0.52,
    sheenColor: tintColor(THREE, cfg.accent, 0.55),
  });

  const matPipingPrimary = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(cfg.fabric),
    bumpMap: mainFab.bump,
    bumpScale: 0.0028,
    roughness: 0.86,
    metalness: 0.0,
    sheen: 0.88,
    sheenRoughness: 0.55,
    sheenColor: tintColor(THREE, cfg.fabric, 0.58),
  });

  const matPillow = new THREE.MeshPhysicalMaterial({
    map: accentFab.map,
    bumpMap: accentFab.bump,
    bumpScale: 0.0055,
    roughness: 0.93,
    metalness: 0.0,
    sheen: 0.95,
    sheenRoughness: 0.68,
    sheenColor: tintColor(THREE, cfg.accent, 0.62),
  });

  const matWood = new THREE.MeshPhysicalMaterial({
    map: woodTex.map,
    bumpMap: woodTex.bump,
    bumpScale: 0.0022,
    roughness: 0.36,
    metalness: 0.0,
    clearcoat: 0.28,
    clearcoatRoughness: 0.28,
  });

  const matFelt = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#4a3d36"),
    roughness: 0.98,
    metalness: 0.0,
    sheen: 0.35,
    sheenColor: new THREE.Color("#6d5c52"),
  });

  function makeMesh(geo, mat, slot, name) {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.userData.slot = slot;
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  // --- Main upholstered sofa body group ---
  const bodyGroup = new THREE.Group();
  bodyGroup.name = "body";
  root.add(bodyGroup);

  // 1. Sculpted base deck
  const evalBase = makeBaseEvaluator(kit);
  const baseGeo = buildSculptedForm(THREE, 4, evalBase, 2.5);
  bodyGroup.add(makeMesh(baseGeo, matFabric, "primary", "base_deck"));

  // Base lower apron piping (closed 360° loop around bottom seam)
  const baseBottomPts = sampleSeamPoints(THREE, evalBase, 48, (t) => {
    const a = t * Math.PI * 2;
    const r = Math.sqrt(1 - 0.50 * 0.50);
    return [r * Math.cos(a), -0.50, r * Math.sin(a)];
  }, 0.002);
  const baseBottomPipeGeo = buildPipingTube(THREE, baseBottomPts, {
    radius: 0.0068,
    tubularSegs: 64,
    radialSegs: 8,
    closed: true,
  });
  bodyGroup.add(makeMesh(baseBottomPipeGeo, matPipingAccent, "accent", "base_piping_bottom"));

  // Base front upper lip piping (framing the deck right under the loose cushions)
  const baseFrontPts = [];
  const pTmp = [0, 0, 0];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    const a = (0.14 + u * 0.72) * Math.PI; // front sweep from right to left (+Z)
    const sy = 0.52;
    const r = Math.sqrt(1 - sy * sy);
    evalBase(r * Math.cos(a), sy, r * Math.sin(a), pTmp);
    baseFrontPts.push(new THREE.Vector3(pTmp[0], pTmp[1] + 0.002, pTmp[2] + 0.002));
  }
  const baseFrontPipeGeo = buildPipingTube(THREE, baseFrontPts, {
    radius: 0.0062,
    tubularSegs: 36,
    radialSegs: 8,
    closed: false,
  });
  bodyGroup.add(makeMesh(baseFrontPipeGeo, matPipingAccent, "accent", "base_piping_front"));

  // 2. Sculpted rounded arms (left & right) + front scroll & outer crest piping
  for (const side of [-1, 1]) {
    const armGroup = new THREE.Group();
    armGroup.name = side < 0 ? "armL" : "armR";
    bodyGroup.add(armGroup);

    const evalArm = makeArmEvaluator(kit, side);
    const armGeo = buildSculptedForm(THREE, 4, evalArm, 2.7);
    armGroup.add(makeMesh(armGeo, matFabric, "primary", side < 0 ? "arm_mesh_L" : "arm_mesh_R"));

    // Front rolled-arm face piping loop
    const frontPts = sampleSeamPoints(THREE, evalArm, 36, (t) => {
      const a = t * Math.PI * 2;
      const sz = 0.68;
      const r = Math.sqrt(1 - sz * sz);
      return [r * Math.cos(a), r * Math.sin(a), sz];
    }, 0.0022);
    const frontPipeGeo = buildPipingTube(THREE, frontPts, {
      radius: 0.0074,
      tubularSegs: 48,
      radialSegs: 8,
      closed: true,
    });
    armGroup.add(makeMesh(frontPipeGeo, matPipingAccent, "accent", side < 0 ? "arm_piping_front_L" : "arm_piping_front_R"));

    // Outer shoulder seam running from front scroll piping back into the backrest
    const outerPts = [];
    for (let i = 0; i <= 20; i++) {
      const u = i / 20;
      const sz = 0.68 - u * 1.38;
      const r = Math.sqrt(Math.max(0.01, 1 - sz * sz));
      const ux = side * r * 0.82;
      const uy = r * 0.57;
      evalArm(ux, uy, sz, pTmp);
      outerPts.push(new THREE.Vector3(pTmp[0] + side * 0.0025, pTmp[1] + 0.002, pTmp[2]));
    }
    const outerPipeGeo = buildPipingTube(THREE, outerPts, {
      radius: 0.0066,
      tubularSegs: 32,
      radialSegs: 8,
      closed: false,
    });
    armGroup.add(makeMesh(outerPipeGeo, matPipingAccent, "accent", side < 0 ? "arm_piping_outer_L" : "arm_piping_outer_R"));
  }

  // 3. Sculpted arched backrest + front/rear contour piping + two tufted accent buttons
  const evalBack = makeBackrestEvaluator(kit);
  const backGeo = buildSculptedForm(THREE, 4, evalBack, 2.5);
  bodyGroup.add(makeMesh(backGeo, matFabric, "primary", "backrest"));

  // Front top-arch piping along the backrest crest
  const backFrontPts = [];
  const backRearPts = [];
  for (let i = 0; i <= 32; i++) {
    const u = i / 32;
    const a = (0.08 + u * 0.84) * Math.PI; // sweeps from left shoulder across top arch to right shoulder
    const ux0 = -Math.cos(a);
    const uy0 = Math.sin(a) * 0.88;
    const uzFront = 0.44;
    const lenF = Math.hypot(ux0, uy0, uzFront);
    evalBack(ux0 / lenF, uy0 / lenF, uzFront / lenF, pTmp);
    backFrontPts.push(new THREE.Vector3(pTmp[0], pTmp[1] + 0.0025, pTmp[2] + 0.0025));

    const uzRear = -0.44;
    const lenR = Math.hypot(ux0, uy0, uzRear);
    evalBack(ux0 / lenR, uy0 / lenR, uzRear / lenR, pTmp);
    backRearPts.push(new THREE.Vector3(pTmp[0], pTmp[1] + 0.0025, pTmp[2] - 0.0025));
  }
  const backFrontPipeGeo = buildPipingTube(THREE, backFrontPts, {
    radius: 0.0072,
    tubularSegs: 48,
    radialSegs: 8,
    closed: false,
  });
  bodyGroup.add(makeMesh(backFrontPipeGeo, matPipingAccent, "accent", "backrest_piping_front"));

  const backRearPipeGeo = buildPipingTube(THREE, backRearPts, {
    radius: 0.0068,
    tubularSegs: 48,
    radialSegs: 8,
    closed: false,
  });
  bodyGroup.add(makeMesh(backRearPipeGeo, matPipingAccent, "accent", "backrest_piping_rear"));

  // Two cozy fabric-covered tufted buttons nestled directly inside the backrest dimples
  const buttonGeo = new THREE.SphereGeometry(0.017, 18, 12);
  buttonGeo.scale(1.0, 1.0, 0.46);
  for (const side of [-1, 1]) {
    // Find exact surface position at the center of each dimple (sx = ±0.38, sy = 0.24, sz > 0)
    const ux = side * 0.38;
    const uy = 0.24;
    const uz = Math.sqrt(Math.max(0.01, 1 - ux * ux - uy * uy));
    evalBack(ux, uy, uz, pTmp);
    const btn = makeMesh(buttonGeo, matPipingAccent, "accent", side < 0 ? "tuft_button_L" : "tuft_button_R");
    btn.position.set(pTmp[0], pTmp[1], pTmp[2] + 0.004);
    btn.rotation.x = -0.17; // match backrest recline
    bodyGroup.add(btn);
  }

  // 4. Two loose sculpted seat cushions with top & bottom perimeter piping
  const cushionConfigs = [
    { name: "cushionL", side: -1, pos: [-0.245, 0.346, 0.128], rot: [0.008, 0.018, 0.005] },
    { name: "cushionR", side: 1, pos: [0.245, 0.347, 0.122], rot: [0.004, -0.014, -0.004] },
  ];

  for (const cc of cushionConfigs) {
    const cGroup = new THREE.Group();
    cGroup.name = cc.name;
    cGroup.position.set(cc.pos[0], cc.pos[1], cc.pos[2]);
    cGroup.rotation.set(cc.rot[0], cc.rot[1], cc.rot[2]);
    cGroup.userData.basePos = cc.pos.slice();
    root.add(cGroup);

    const evalCushion = makeSeatCushionEvaluator(kit, cc.side);
    const cushionGeo = buildSculptedForm(THREE, 4, evalCushion, 2.7);
    cGroup.add(makeMesh(cushionGeo, matFabric, "primary", `${cc.name}_mesh`));

    // Top & bottom piping loops following the cushion's exact organic contour
    for (const sySign of [1, -1]) {
      const sy = sySign * 0.58;
      const r = Math.sqrt(1 - sy * sy);
      const pts = sampleSeamPoints(THREE, evalCushion, 44, (t) => {
        const a = t * Math.PI * 2;
        return [r * Math.cos(a), sy, r * Math.sin(a)];
      }, 0.0024);

      const pipeGeo = buildPipingTube(THREE, pts, {
        radius: 0.0070,
        tubularSegs: 56,
        radialSegs: 8,
        closed: true,
      });
      cGroup.add(makeMesh(pipeGeo, matPipingAccent, "accent", `${cc.name}_piping_${sySign > 0 ? "top" : "bot"}`));
    }
  }

  // 5. Cozy sculpted accent throw pillow tucked against the right arm & backrest
  const pillowGroup = new THREE.Group();
  pillowGroup.name = "pillow";
  pillowGroup.position.set(0.352, 0.562, 0.012);
  pillowGroup.rotation.set(-0.22, -0.44, 0.19);
  pillowGroup.userData.basePos = [0.352, 0.562, 0.012];
  pillowGroup.userData.baseRot = [-0.22, -0.44, 0.19];
  root.add(pillowGroup);

  const evalPillow = makeThrowPillowEvaluator(kit);
  const pillowGeo = buildSculptedForm(THREE, 4, evalPillow, 3.2);
  pillowGroup.add(makeMesh(pillowGeo, matPillow, "accent", "accent_pillow_mesh"));

  // Contrasting primary-fabric piping around the throw pillow's pinched perimeter
  const pillowPipePts = sampleSeamPoints(THREE, evalPillow, 40, (t) => {
    const a = t * Math.PI * 2;
    return [Math.cos(a), Math.sin(a), 0];
  }, 0.0018);
  const pillowPipeGeo = buildPipingTube(THREE, pillowPipePts, {
    radius: 0.0062,
    tubularSegs: 48,
    radialSegs: 8,
    closed: true,
  });
  pillowGroup.add(makeMesh(pillowPipeGeo, matPipingPrimary, "primary", "accent_pillow_piping"));

  // 6. Four short turned wooden legs (LatheGeometry, gently splayed, grounded flush at Y = 0)
  const legMountY = 0.132;
  const tiltAngle = 0.115; // ~6.6° outward mid-century splay
  const footRadius = 0.0155;
  const legLength = (legMountY - 0.0035 - footRadius * Math.sin(tiltAngle)) / Math.cos(tiltAngle);

  const legGeo = buildTurnedLegGeometry(THREE, legLength);
  const feltGeo = new THREE.CylinderGeometry(0.0158, 0.0162, 0.0045, 18);

  const legSpecs = [
    { name: "legFL", x: -0.535, z: 0.240, sx: -0.82, sz: 0.57 },
    { name: "legFR", x: 0.535, z: 0.240, sx: 0.82, sz: 0.57 },
    { name: "legBL", x: -0.535, z: -0.245, sx: -0.82, sz: -0.57 },
    { name: "legBR", x: 0.535, z: -0.245, sx: 0.82, sz: -0.57 },
  ];

  const downVec = new THREE.Vector3(0, -1, 0);
  const targetDir = new THREE.Vector3();

  for (const ls of legSpecs) {
    const legGroup = new THREE.Group();
    legGroup.name = ls.name;
    root.add(legGroup);

    // Splayed turned wooden leg
    const woodMesh = makeMesh(legGeo, matWood, "secondary", `${ls.name}_wood`);
    woodMesh.position.set(ls.x, legMountY, ls.z);
    targetDir.set(ls.sx * Math.sin(tiltAngle), -Math.cos(tiltAngle), ls.sz * Math.sin(tiltAngle)).normalize();
    woodMesh.quaternion.setFromUnitVectors(downVec, targetDir);
    legGroup.add(woodMesh);

    // Horizontal felt floor pad seated dead-flush on Y = 0.000 right under the foot
    const footX = ls.x + targetDir.x * legLength;
    const footZ = ls.z + targetDir.z * legLength;
    const feltMesh = makeMesh(feltGeo, matFelt, "secondary", `${ls.name}_pad`);
    feltMesh.position.set(footX, 0.00225, footZ);
    legGroup.add(feltMesh);
  }

  return root;
}

// ---------------------------------------------------------------------------
// Gentle cozy diorama idle motion (legs remain completely planted on Y = 0)
// ---------------------------------------------------------------------------

export function idle(group, t) {
  const pillow = group.getObjectByName("pillow");
  if (pillow && pillow.userData.baseRot) {
    const [rx, ry, rz] = pillow.userData.baseRot;
    const breathe = Math.sin(t * 1.15);
    pillow.rotation.set(rx + breathe * 0.008, ry, rz + Math.cos(t * 0.85) * 0.006);
    pillow.scale.set(1 + breathe * 0.004, 1 - breathe * 0.003, 1 + breathe * 0.005);
  }

  const cL = group.getObjectByName("cushionL");
  if (cL) {
    const s = Math.sin(t * 0.9 + 0.4);
    cL.scale.set(1, 1 + s * 0.004, 1);
  }

  const cR = group.getObjectByName("cushionR");
  if (cR) {
    const s = Math.sin(t * 0.9 + 2.1);
    cR.scale.set(1, 1 + s * 0.004, 1);
  }
}
export const META = {
  id: 'houseplant',
  name: 'Potted Houseplant',
  kind: 'prop',
  footprint: [0.58, 0.58],
  variants: ['Monstera Deliciosa', 'Fiddle-Leaf Fig', 'Trailing Golden Pothos'],
  note: 'Stylised 0.9 m dorm-room potted houseplant in a lathe-turned ceramic pot on a mid-century wood stand, with individually sculpted bezier-extruded leaves, 3D centre veins, painted gradients, and gentle breeze sway.',
};

// ---------------------------------------------------------------------------
// Deterministic PRNG & Color Utilities
// ---------------------------------------------------------------------------

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function colorToRgb(THREE, hexOrColor, fallback) {
  const c = new THREE.Color();
  try {
    c.set(hexOrColor != null ? hexOrColor : fallback);
  } catch {
    c.set(fallback);
  }
  return {
    r: Math.round(c.r * 255),
    g: Math.round(c.g * 255),
    b: Math.round(c.b * 255),
  };
}

function clamp255(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function mixRgb(a, b, t) {
  const k = Math.max(0, Math.min(1, t));
  return {
    r: clamp255(a.r + (b.r - a.r) * k),
    g: clamp255(a.g + (b.g - a.g) * k),
    b: clamp255(a.b + (b.b - a.b) * k),
  };
}

function scaleRgb(c, s) {
  return {
    r: clamp255(c.r * s),
    g: clamp255(c.g * s),
    b: clamp255(c.b * s),
  };
}

function rgbCss(c) {
  return `rgb(${c.r},${c.g},${c.b})`;
}

function rgbaCss(c, a) {
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

function fbm(kit, x, y, octaves = 3) {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    val += kit.noise(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return val / norm;
}

// ---------------------------------------------------------------------------
// Geometry Craftsmanship Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a smooth, twist-free tapered tube along a CatmullRomCurve3 using
 * parallel transport (Bishop frames) with optional rounded end caps and
 * cross-section modulation.
 */
function makeTaperedTube(THREE, curve, opts = {}) {
  const segments = opts.segments || 24;
  const radialSegments = opts.radialSegments || 10;
  const radiusFn = opts.radiusFn || ((t) => 0.01 * (1 - 0.5 * t));
  const capStart = opts.capStart !== undefined ? opts.capStart : true;
  const capEnd = opts.capEnd !== undefined ? opts.capEnd : true;
  const profileMod = opts.profileMod || null;

  const pts = [];
  const tangents = [];
  const normals = [];
  const binormals = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    pts.push(curve.getPoint(t));
    tangents.push(curve.getTangent(t).normalize());
  }

  // Initial perpendicular frame
  const ref = Math.abs(tangents[0].y) < 0.92
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(1, 0, 0);
  const n0 = new THREE.Vector3().crossVectors(tangents[0], ref).normalize();
  const b0 = new THREE.Vector3().crossVectors(tangents[0], n0).normalize();
  normals.push(n0);
  binormals.push(b0);

  // Parallel transport along the curve
  const q = new THREE.Quaternion();
  for (let i = 1; i <= segments; i++) {
    const prevT = tangents[i - 1];
    const currT = tangents[i];
    const nPrev = normals[i - 1].clone();
    const dot = Math.max(-1, Math.min(1, prevT.dot(currT)));
    if (dot < 0.999999) {
      const axis = new THREE.Vector3().crossVectors(prevT, currT);
      if (axis.lengthSq() > 1e-10) {
        axis.normalize();
        q.setFromAxisAngle(axis, Math.acos(dot));
        nPrev.applyQuaternion(q);
      }
    }
    nPrev.addScaledVector(currT, -nPrev.dot(currT)).normalize();
    const bCurr = new THREE.Vector3().crossVectors(currT, nPrev).normalize();
    normals.push(nPrev);
    binormals.push(bCurr);
  }

  const positions = [];
  const vertNormals = [];
  const uvs = [];
  const indices = [];

  const ringStride = radialSegments + 1;
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const baseR = Math.max(0.00025, radiusFn(t));
    const center = pts[i];
    const N = normals[i];
    const B = binormals[i];

    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const theta = u * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const mod = profileMod ? profileMod(theta, t) : 1;
      const r = baseR * mod;

      n.set(0, 0, 0).addScaledVector(N, cosT).addScaledVector(B, sinT).normalize();
      p.copy(center).addScaledVector(n, r);

      positions.push(p.x, p.y, p.z);
      vertNormals.push(n.x, n.y, n.z);
      uvs.push(u, t);
    }
  }

  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * ringStride + j;
      const b = (i + 1) * ringStride + j;
      const c = (i + 1) * ringStride + (j + 1);
      const d = i * ringStride + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  if (capStart) {
    const r0 = Math.max(0.00025, radiusFn(0));
    const tipPos = pts[0].clone().addScaledVector(tangents[0], -r0 * 0.65);
    const tipIdx = positions.length / 3;
    const tn = tangents[0].clone().negate();
    positions.push(tipPos.x, tipPos.y, tipPos.z);
    vertNormals.push(tn.x, tn.y, tn.z);
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegments; j++) {
      indices.push(tipIdx, j, j + 1);
    }
  }

  if (capEnd) {
    const r1 = Math.max(0.00025, radiusFn(1));
    const tipPos = pts[segments].clone().addScaledVector(tangents[segments], r1 * 0.65);
    const tipIdx = positions.length / 3;
    const tn = tangents[segments];
    positions.push(tipPos.x, tipPos.y, tipPos.z);
    vertNormals.push(tn.x, tn.y, tn.z);
    uvs.push(0.5, 1);
    const base = segments * ringStride;
    for (let j = 0; j < radialSegments; j++) {
      indices.push(tipIdx, base + j + 1, base + j);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(vertNormals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Crack-free triangle subdivision for extruded shapes so broad leaf blades
 * deform smoothly in 3D without creasing or T-junctions.
 */
function subdivideGeometry(THREE, inputGeo, maxEdgeLen, maxTris = 2600) {
  const geo = inputGeo.index ? inputGeo.toNonIndexed() : inputGeo;
  const maxLenSq = maxEdgeLen * maxEdgeLen;

  let pos = Array.from(geo.attributes.position.array);
  let uv = geo.attributes.uv ? Array.from(geo.attributes.uv.array) : null;

  for (let pass = 0; pass < 4; pass++) {
    const triCount = pos.length / 9;
    if (triCount >= maxTris) break;

    const nextPos = [];
    const nextUv = uv ? [] : null;
    let didSplit = false;

    const pushTri = (a, b, c, ua, ub, uc) => {
      nextPos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      if (nextUv) {
        nextUv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
      }
    };

    const distSq = (p1, p2) => {
      const dx = p1[0] - p2[0];
      const dy = p1[1] - p2[1];
      const dz = p1[2] - p2[2];
      return dx * dx + dy * dy + dz * dz;
    };

    const mid3 = (p1, p2) => [
      (p1[0] + p2[0]) * 0.5,
      (p1[1] + p2[1]) * 0.5,
      (p1[2] + p2[2]) * 0.5,
    ];

    const mid2 = (u1, u2) => [(u1[0] + u2[0]) * 0.5, (u1[1] + u2[1]) * 0.5];

    for (let t = 0; t < triCount; t++) {
      const pi = t * 9;
      const A = [pos[pi], pos[pi + 1], pos[pi + 2]];
      const B = [pos[pi + 3], pos[pi + 4], pos[pi + 5]];
      const C = [pos[pi + 6], pos[pi + 7], pos[pi + 8]];

      let uA = null, uB = null, uC = null;
      if (uv) {
        const ui = t * 6;
        uA = [uv[ui], uv[ui + 1]];
        uB = [uv[ui + 2], uv[ui + 3]];
        uC = [uv[ui + 4], uv[ui + 5]];
      }

      const sAB = distSq(A, B) > maxLenSq;
      const sBC = distSq(B, C) > maxLenSq;
      const sCA = distSq(C, A) > maxLenSq;
      const mask = (sAB ? 1 : 0) | (sBC ? 2 : 0) | (sCA ? 4 : 0);

      if (mask === 0) {
        pushTri(A, B, C, uA, uB, uC);
        continue;
      }

      didSplit = true;
      const mAB = sAB ? mid3(A, B) : null;
      const mBC = sBC ? mid3(B, C) : null;
      const mCA = sCA ? mid3(C, A) : null;
      const umAB = sAB && uv ? mid2(uA, uB) : null;
      const umBC = sBC && uv ? mid2(uB, uC) : null;
      const umCA = sCA && uv ? mid2(uC, uA) : null;

      if (mask === 1) {
        pushTri(A, mAB, C, uA, umAB, uC);
        pushTri(mAB, B, C, umAB, uB, uC);
      } else if (mask === 2) {
        pushTri(A, B, mBC, uA, uB, umBC);
        pushTri(A, mBC, C, uA, umBC, uC);
      } else if (mask === 4) {
        pushTri(A, B, mCA, uA, uB, umCA);
        pushTri(mCA, B, C, umCA, uB, uC);
      } else if (mask === 3) {
        pushTri(mAB, B, mBC, umAB, uB, umBC);
        pushTri(A, mAB, mBC, uA, umAB, umBC);
        pushTri(A, mBC, C, uA, umBC, uC);
      } else if (mask === 6) {
        pushTri(mCA, mBC, C, umCA, umBC, uC);
        pushTri(A, B, mBC, uA, uB, umBC);
        pushTri(A, mBC, mCA, uA, umBC, umCA);
      } else if (mask === 5) {
        pushTri(A, mAB, mCA, uA, umAB, umCA);
        pushTri(mAB, B, C, umAB, uB, uC);
        pushTri(mAB, C, mCA, umAB, uC, umCA);
      } else {
        pushTri(A, mAB, mCA, uA, umAB, umCA);
        pushTri(mAB, B, mBC, umAB, uB, umBC);
        pushTri(mCA, mBC, C, umCA, umBC, uC);
        pushTri(mAB, mBC, mCA, umAB, umBC, umCA);
      }
    }

    pos = nextPos;
    uv = nextUv;
    if (!didSplit) break;
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (uv) {
    out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  }
  if (geo !== inputGeo) geo.dispose();
  inputGeo.dispose();
  return out;
}

/**
 * Computes area-weighted crease-aware smooth vertex normals for non-indexed
 * geometries so curved extruded leaves shade like smooth sculpted surfaces.
 */
function computeSmoothNormals(THREE, geo, creaseAngleDeg = 58) {
  const posAttr = geo.attributes.position;
  const count = posAttr.count;
  const arr = posAttr.array;

  const faceNormals = new Float32Array(count * 3);
  const buckets = new Map();
  const cosCrease = Math.cos((creaseAngleDeg * Math.PI) / 180);

  for (let i = 0; i < count; i += 3) {
    const i0 = i * 3;
    const i1 = (i + 1) * 3;
    const i2 = (i + 2) * 3;

    const ax = arr[i0], ay = arr[i0 + 1], az = arr[i0 + 2];
    const bx = arr[i1], by = arr[i1 + 1], bz = arr[i1 + 2];
    const cx = arr[i2], cy = arr[i2 + 1], cz = arr[i2 + 2];

    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;

    // Area-weighted cross product
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;

    for (let k = 0; k < 3; k++) {
      const vi = i + k;
      const vi3 = vi * 3;
      faceNormals[vi3] = nx;
      faceNormals[vi3 + 1] = ny;
      faceNormals[vi3 + 2] = nz;

      const key =
        `${Math.round(arr[vi3] * 8000)},` +
        `${Math.round(arr[vi3 + 1] * 8000)},` +
        `${Math.round(arr[vi3 + 2] * 8000)}`;
      let list = buckets.get(key);
      if (!list) {
        list = [];
        buckets.set(key, list);
      }
      list.push(vi);
    }
  }

  const outNormals = new Float32Array(count * 3);
  for (const list of buckets.values()) {
    const len = list.length;
    for (let a = 0; a < len; a++) {
      const vi = list[a];
      const vi3 = vi * 3;
      const fnx = faceNormals[vi3];
      const fny = faceNormals[vi3 + 1];
      const fnz = faceNormals[vi3 + 2];
      const flen = Math.hypot(fnx, fny, fnz) || 1;
      const ux = fnx / flen, uy = fny / flen, uz = fnz / flen;

      let sx = fnx, sy = fny, sz = fnz;
      for (let b = 0; b < len; b++) {
        if (a === b) continue;
        const vj3 = list[b] * 3;
        const onx = faceNormals[vj3];
        const ony = faceNormals[vj3 + 1];
        const onz = faceNormals[vj3 + 2];
        const olen = Math.hypot(onx, ony, onz) || 1;
        const dot = (ux * onx + uy * ony + uz * onz) / olen;
        if (dot >= cosCrease) {
          sx += onx;
          sy += ony;
          sz += onz;
        }
      }
      const slen = Math.hypot(sx, sy, sz) || 1;
      outNormals[vi3] = sx / slen;
      outNormals[vi3 + 1] = sy / slen;
      outNormals[vi3 + 2] = sz / slen;
    }
  }

  geo.setAttribute('normal', new THREE.Float32BufferAttribute(outNormals, 3));
}

/**
 * Extrudes a bezier THREE.Shape with a bevel, normalizes UVs cleanly to [0,1],
 * subdivides interior faces, bends the blade in 3D, and adds a sculpted
 * tapered 3D centre vein (midrib) following the exact same 3D curvature.
 */
function buildSculptedLeaf(THREE, shape, params, bladeMat, veinMat) {
  const {
    depth = 0.0022,
    bevelThickness = 0.0012,
    bevelSize = 0.0012,
    bevelSegments = 2,
    curveSegments = 10,
    maxEdgeLen = 0.028,
    maxTris = 2200,
    veinStart = 0.004,
    veinEndRatio = 0.92,
    veinBaseRadius = 0.0032,
    veinTipRadius = 0.0005,
    veinZOffset = -0.0016,
    bendFn,
  } = params;

  const rawGeo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness,
    bevelSize,
    bevelSegments,
    curveSegments,
    steps: 1,
  });

  // Centre thickness around z = 0
  rawGeo.translate(0, 0, -depth * 0.5);

  // Measure bounds before bending for exact botanical UV alignment
  rawGeo.computeBoundingBox();
  const bb = rawGeo.boundingBox;
  const minX = bb.min.x;
  const maxX = bb.max.x;
  const minY = bb.min.y;
  const maxY = bb.max.y;
  const halfW = Math.max(0.001, Math.max(Math.abs(minX), Math.abs(maxX)));
  const spanY = Math.max(0.001, maxY - minY);

  // Assign botanical UVs: u = 0.5 along centre vein, v = 0 at base, v = 1 at tip
  const rawPos = rawGeo.attributes.position;
  const rawUv = rawGeo.attributes.uv;
  for (let i = 0; i < rawPos.count; i++) {
    const x = rawPos.getX(i);
    const y = rawPos.getY(i);
    const u = 0.5 + (x / (halfW * 2));
    const v = (y - minY) / spanY;
    rawUv.setXY(i, Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v)));
  }

  // Subdivide interior triangles for buttery smooth 3D bending
  const geo = subdivideGeometry(THREE, rawGeo, maxEdgeLen, maxTris);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const uSym = x / halfW; // [-1, 1]
    const vNorm = Math.max(0, Math.min(1, (y - minY) / spanY));
    const d = bendFn(x, y, z, uSym, vNorm, maxY);
    pos.setXYZ(i, x + (d.dx || 0), y + (d.dy || 0), z + (d.dz || 0));
  }
  pos.needsUpdate = true;
  computeSmoothNormals(THREE, geo, 56);

  const leafGroup = new THREE.Group();
  const bladeMesh = new THREE.Mesh(geo, bladeMat);
  bladeMesh.castShadow = true;
  bladeMesh.receiveShadow = true;
  leafGroup.add(bladeMesh);

  // Sculpted 3D tapered centre vein hugging the curved midrib
  const veinPts = [];
  const veinSteps = 10;
  const yStart = Math.max(minY + 0.002, veinStart);
  const yEnd = maxY * veinEndRatio;
  for (let i = 0; i <= veinSteps; i++) {
    const t = i / veinSteps;
    const y = yStart + (yEnd - yStart) * t;
    const vNorm = Math.max(0, Math.min(1, (y - minY) / spanY));
    const d = bendFn(0, y, 0, 0, vNorm, maxY);
    veinPts.push(new THREE.Vector3(d.dx || 0, y + (d.dy || 0), (d.dz || 0) + veinZOffset * (1 - 0.55 * t)));
  }
  const veinCurve = new THREE.CatmullRomCurve3(veinPts);
  const veinGeo = makeTaperedTube(THREE, veinCurve, {
    segments: 12,
    radialSegments: 7,
    radiusFn: (t) => veinBaseRadius * Math.pow(1 - t, 0.78) + veinTipRadius * t,
    capStart: true,
    capEnd: true,
  });
  const veinMesh = new THREE.Mesh(veinGeo, veinMat);
  veinMesh.castShadow = true;
  veinMesh.receiveShadow = true;
  leafGroup.add(veinMesh);

  return leafGroup;
}

/**
 * Orients a leaf group so its +Y (blade length) follows `fwd`, its +Z (glossy
 * upper face) points generally toward `upHint`, and applies optional roll.
 */
function orientLeafGroup(THREE, group, pos, fwd, upHint, roll = 0) {
  const yAxis = fwd.clone().normalize();
  const up = upHint.clone().normalize();
  let xAxis = new THREE.Vector3().crossVectors(yAxis, up);
  if (xAxis.lengthSq() < 1e-6) {
    xAxis = new THREE.Vector3(1, 0, 0);
  } else {
    xAxis.normalize();
  }
  const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();

  if (Math.abs(roll) > 1e-5) {
    const qRoll = new THREE.Quaternion().setFromAxisAngle(yAxis, roll);
    xAxis.applyQuaternion(qRoll);
    zAxis.applyQuaternion(qRoll);
  }

  const m = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  group.position.copy(pos);
  group.quaternion.setFromRotationMatrix(m);
}

// ---------------------------------------------------------------------------
// Procedural Painted Textures & Materials (using kit.canvasTexture & kit.noise)
// ---------------------------------------------------------------------------

function makePotMaterial(THREE, kit, primaryHex, accentHex) {
  const prim = colorToRgb(THREE, primaryHex, '#d9845b');
  const acc = colorToRgb(THREE, accentHex, '#f2e6d0');
  const rawClay = mixRgb(scaleRgb(prim, 0.86), { r: 214, g: 186, b: 158 }, 0.45);
  const darkClay = scaleRgb(prim, 0.56);
  const rimTint = mixRgb(prim, acc, 0.28);

  const colorTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    // Base glazed body
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, rgbCss(scaleRgb(prim, 0.52))); // deep inner pot wall
    grad.addColorStop(0.22, rgbCss(rimTint));              // top rim glaze break
    grad.addColorStop(0.32, rgbCss(prim));                 // upper shoulder
    grad.addColorStop(0.68, rgbCss(scaleRgb(prim, 0.94))); // lower belly
    grad.addColorStop(1.0, rgbCss(rawClay));               // foot
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle organic stoneware colour modulation
    for (let y = 0; y < h; y += 3) {
      const v = 1 - y / h; // 0 bottom, 1 top/inner
      const rib = Math.sin(y * 0.42) * 0.5 + 0.5;
      const n = kit.noise(3.1, y * 0.045);
      const alpha = 0.04 + rib * 0.035;
      ctx.fillStyle = n > 0.5 ? `rgba(255,248,238,${alpha})` : `rgba(40,22,12,${alpha})`;
      ctx.fillRect(0, y, w, 3);

      // Decorative cozy hand-painted accent band around outer shoulder (v in [0.46, 0.56])
      if (v > 0.455 && v < 0.565) {
        const bandT = (v - 0.455) / 0.11;
        const edgeFade = Math.sin(bandT * Math.PI);
        ctx.fillStyle = rgbaCss(acc, 0.82 * Math.pow(edgeFade, 0.45));
        ctx.fillRect(0, y, w, 3);
      }
    }

    // Fine hand-painted terracotta/dark trim pin-lines framing the accent band
    const lineY1 = Math.round(h * (1 - 0.568));
    const lineY2 = Math.round(h * (1 - 0.452));
    ctx.fillStyle = rgbaCss(darkClay, 0.58);
    ctx.fillRect(0, lineY1, w, 3);
    ctx.fillRect(0, lineY2, w, 3);

    // Delicate painted studio ceramic dots along the accent band
    const dotY = Math.round(h * (1 - 0.51));
    ctx.fillStyle = rgbaCss(scaleRgb(prim, 0.72), 0.7);
    const dotCount = 24;
    for (let i = 0; i < dotCount; i++) {
      const dx = ((i + 0.5) / dotCount) * w;
      const jitter = (kit.noise(i * 1.7, 2.3) - 0.5) * 3;
      ctx.beginPath();
      ctx.ellipse(dx, dotY + jitter, 3.2, 4.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hand-dipped raw clay base skirt (bottom ~20% of outer pot, v < 0.24)
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) {
      const wave = (kit.noise(x * 0.025, 9.1) - 0.5) * 18 + Math.sin((x / w) * Math.PI * 6) * 4;
      const y = h * 0.76 + wave;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    const clayGrad = ctx.createLinearGradient(0, h * 0.72, 0, h);
    clayGrad.addColorStop(0, rgbCss(mixRgb(rawClay, acc, 0.25)));
    clayGrad.addColorStop(0.2, rgbCss(rawClay));
    clayGrad.addColorStop(1, rgbCss(scaleRgb(rawClay, 0.85)));
    ctx.fillStyle = clayGrad;
    ctx.fill();

    // Subtle drip glaze highlight right above the clay line
    ctx.strokeStyle = rgbaCss(acc, 0.35);
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const wave = (kit.noise(x * 0.025, 9.1) - 0.5) * 18 + Math.sin((x / w) * Math.PI * 6) * 4;
      const y = h * 0.76 + wave;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Stoneware mineral speckles across the ceramic surface
    const rng = makeRng(4207);
    for (let i = 0; i < 950; i++) {
      const sx = rng() * w;
      const sy = rng() * h;
      const sr = 0.6 + rng() * 1.5;
      const light = rng() > 0.74;
      ctx.fillStyle = light
        ? `rgba(255,248,236,${0.12 + rng() * 0.16})`
        : `rgba(48,30,20,${0.14 + rng() * 0.22})`;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.ClampToEdgeWrapping;

  const bumpTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      const rib = Math.sin(y * 0.45) * 18 + (kit.noise(1.5, y * 0.08) - 0.5) * 20;
      const g = clamp255(128 + rib);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(0, y, w, 2);
    }
    const rng = makeRng(8812);
    for (let i = 0; i < 700; i++) {
      const sx = rng() * w;
      const sy = rng() * h;
      const g = sy > h * 0.75 ? clamp255(95 + rng() * 65) : clamp255(115 + rng() * 26);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(sx, sy, 2, 2);
    }
  });
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.ClampToEdgeWrapping;

  return new THREE.MeshPhysicalMaterial({
    map: colorTex,
    bumpMap: bumpTex,
    bumpScale: 0.0022,
    roughness: 0.29,
    metalness: 0.02,
    clearcoat: 0.76,
    clearcoatRoughness: 0.18,
  });
}

function makeWoodMaterial(THREE, kit, woodHex) {
  const base = colorToRgb(THREE, woodHex, '#8c5a3c');
  const dark = scaleRgb(base, 0.62);
  const light = mixRgb(base, { r: 230, g: 190, b: 142 }, 0.28);

  const colorTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = rgbCss(base);
    ctx.fillRect(0, 0, w, h);

    for (let x = 0; x < w; x += 2) {
      for (let y = 0; y < h; y += 8) {
        const n = fbm(kit, x * 0.035, y * 0.006, 3);
        const grain = Math.sin((x * 0.11 + n * 14) * Math.PI * 0.5) * 0.5 + 0.5;
        const c = mixRgb(dark, light, grain * 0.75 + n * 0.25);
        ctx.fillStyle = rgbCss(c);
        ctx.fillRect(x, y, 2, 8);
      }
    }

    // Fine wood pores
    const rng = makeRng(3105);
    ctx.fillStyle = rgbaCss(dark, 0.22);
    for (let i = 0; i < 600; i++) {
      const px = rng() * w;
      const py = rng() * h;
      ctx.fillRect(px, py, 1.2, 10 + rng() * 22);
    }
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.RepeatWrapping;

  const bumpTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    for (let x = 0; x < w; x += 2) {
      const n = kit.noise(x * 0.09, 2.4);
      const v = clamp255(112 + n * 38);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, 0, 2, h);
    }
  });
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;

  return new THREE.MeshPhysicalMaterial({
    map: colorTex,
    bumpMap: bumpTex,
    bumpScale: 0.0018,
    roughness: 0.54,
    metalness: 0.0,
    clearcoat: 0.22,
    clearcoatRoughness: 0.42,
  });
}

function makeSoilMaterial(THREE, kit) {
  const colorTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const cDark = { r: 36, g: 24, b: 17 };
    const cMid = { r: 64, g: 45, b: 31 };
    const cWarm = { r: 92, g: 67, b: 46 };

    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const n = fbm(kit, x * 0.04, y * 0.04, 3);
        const col = n < 0.5
          ? mixRgb(cDark, cMid, n * 2)
          : mixRgb(cMid, cWarm, (n - 0.5) * 2);
        ctx.fillStyle = rgbCss(col);
        ctx.fillRect(x, y, 4, 4);
      }
    }

    // Organic humus crumbs, tiny bark shreds, and pale perlite granules
    const rng = makeRng(7011);
    for (let i = 0; i < 900; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const r = 1 + rng() * 3.2;
      const kind = rng();
      if (kind < 0.14) {
        ctx.fillStyle = `rgba(218,208,190,${0.45 + rng() * 0.35})`;
      } else if (kind < 0.55) {
        ctx.fillStyle = `rgba(30,19,12,${0.45 + rng() * 0.4})`;
      } else {
        ctx.fillStyle = `rgba(104,76,52,${0.35 + rng() * 0.35})`;
      }
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.6 + rng() * 0.6), rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.RepeatWrapping;

  const bumpTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 3) {
        const v = clamp255(40 + fbm(kit, x * 0.08, y * 0.08, 3) * 195);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 3, 3);
      }
    }
  });
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;

  return new THREE.MeshPhysicalMaterial({
    map: colorTex,
    bumpMap: bumpTex,
    bumpScale: 0.009,
    roughness: 0.96,
    metalness: 0.0,
  });
}

function makeBarkMaterial(THREE, kit, isCoir = false) {
  const cDark = isCoir ? { r: 88, g: 64, b: 42 } : { r: 66, g: 50, b: 37 };
  const cLight = isCoir ? { r: 146, g: 112, b: 75 } : { r: 116, g: 94, b: 73 };

  const colorTex = kit.canvasTexture(256, 512, (ctx, w, h) => {
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const n = fbm(kit, x * (isCoir ? 0.08 : 0.09), y * (isCoir ? 0.08 : 0.018), 3);
        ctx.fillStyle = rgbCss(mixRgb(cDark, cLight, n));
        ctx.fillRect(x, y, 4, 4);
      }
    }
    const rng = makeRng(isCoir ? 9921 : 5514);
    for (let i = 0; i < (isCoir ? 450 : 180); i++) {
      const x = rng() * w;
      const y = rng() * h;
      ctx.fillStyle = isCoir ? 'rgba(176,142,98,0.28)' : 'rgba(148,128,104,0.32)';
      if (isCoir) {
        ctx.fillRect(x, y, 6 + rng() * 14, 1.5);
      } else {
        // Subtle horizontal Ficus lenticels
        ctx.fillRect(x, y, 5 + rng() * 9, 2);
      }
    }
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.RepeatWrapping;

  const bumpTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 3) {
        const v = clamp255(60 + fbm(kit, x * 0.12, y * (isCoir ? 0.1 : 0.025), 3) * 165);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 3, 3);
      }
    }
  });
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;

  return new THREE.MeshPhysicalMaterial({
    map: colorTex,
    bumpMap: bumpTex,
    bumpScale: isCoir ? 0.006 : 0.0045,
    roughness: isCoir ? 0.94 : 0.85,
    metalness: 0.0,
    sheen: isCoir ? 0.45 : 0.1,
    sheenColor: new THREE.Color(isCoir ? 0xc29e74 : 0x8a7560),
  });
}

/**
 * Generates botanical painted leaf albedo + venation bump textures.
 * UV convention: u = 0.5 is centre vein; canvas y = h (v = 0) is leaf base;
 * canvas y = 0 (v = 1) is leaf apex.
 */
function makeLeafMaterial(THREE, kit, style, accentHex, seedOffset = 0) {
  const acc = colorToRgb(THREE, accentHex, '#f2e6d0');

  // Palette per botanical style
  let baseCol, midCol, tipCol, veinCol, veinCount, roughness, clearcoat;
  if (style === 'monstera') {
    baseCol = { r: 22, g: 76, b: 42 };
    midCol = { r: 42, g: 118, b: 58 };
    tipCol = { r: 78, g: 158, b: 74 };
    veinCol = { r: 126, g: 186, b: 92 };
    veinCount = 7;
    roughness = 0.32;
    clearcoat = 0.48;
  } else if (style === 'monsteraYoung') {
    baseCol = { r: 44, g: 112, b: 48 };
    midCol = { r: 86, g: 156, b: 64 };
    tipCol = { r: 132, g: 192, b: 84 };
    veinCol = { r: 170, g: 214, b: 110 };
    veinCount = 6;
    roughness = 0.28;
    clearcoat = 0.55;
  } else if (style === 'fiddle') {
    baseCol = { r: 26, g: 68, b: 34 };
    midCol = { r: 44, g: 96, b: 44 };
    tipCol = { r: 68, g: 126, b: 56 };
    veinCol = { r: 168, g: 192, b: 108 };
    veinCount = 8;
    roughness = 0.36;
    clearcoat = 0.38;
  } else if (style === 'fiddleYoung') {
    baseCol = { r: 58, g: 112, b: 42 };
    midCol = { r: 94, g: 150, b: 54 };
    tipCol = { r: 136, g: 184, b: 74 };
    veinCol = { r: 192, g: 214, b: 120 };
    veinCount = 7;
    roughness = 0.30;
    clearcoat = 0.46;
  } else {
    // Golden pothos ('pothos' or 'pothosRich')
    baseCol = { r: 30, g: 92, b: 42 };
    midCol = { r: 52, g: 132, b: 56 };
    tipCol = { r: 88, g: 164, b: 68 };
    veinCol = { r: 138, g: 192, b: 92 };
    veinCount = 6;
    roughness = 0.28;
    clearcoat = 0.52;
  }

  const isPothos = style === 'pothos' || style === 'pothosRich';
  const isFiddle = style === 'fiddle' || style === 'fiddleYoung';
  const varGold = mixRgb({ r: 234, g: 222, b: 124 }, acc, 0.28);

  const colorTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    // Rich painted vertical & radial gradient
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0.0, rgbCss(baseCol));
    grad.addColorStop(0.45, rgbCss(midCol));
    grad.addColorStop(0.86, rgbCss(tipCol));
    grad.addColorStop(1.0, rgbCss(mixRgb(tipCol, veinCol, 0.32)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Organic painterly chlorophyll shading (darker near inner midrib troughs,
    // lighter sunlit edges)
    const step = 6;
    for (let y = 0; y < h; y += step) {
      const v = 1 - y / h;
      for (let x = 0; x < w; x += step) {
        const u = x / w;
        const distCenter = Math.abs(u - 0.5) * 2;
        const n = fbm(kit, u * 5.2 + seedOffset, v * 5.2 + seedOffset * 0.7, 3);

        // Subtle sunlit outer margin glow
        const edgeGlow = Math.pow(distCenter, 1.8) * 0.14;
        // Subtle quilted pillow shading between lateral veins for fiddle-leaf
        const pillow = isFiddle ? Math.sin((v * 8 - distCenter * 2.4) * Math.PI) * 0.08 : 0;
        const lift = (n - 0.5) * 0.22 + edgeGlow + pillow;

        if (lift > 0.01) {
          ctx.fillStyle = `rgba(190,232,124,${Math.min(0.28, lift)})`;
          ctx.fillRect(x, y, step, step);
        } else if (lift < -0.01) {
          ctx.fillStyle = `rgba(12,38,18,${Math.min(0.28, -lift)})`;
          ctx.fillRect(x, y, step, step);
        }

        // Golden variegated marble splashes on pothos leaves
        if (isPothos) {
          const streakAngle = u * 4.5 + (u > 0.5 ? -v * 2.2 : v * 2.2);
          const vn = fbm(kit, streakAngle + seedOffset * 1.9, v * 6.5 + seedOffset, 3);
          const thresh = style === 'pothosRich' ? 0.56 : 0.65;
          if (vn > thresh) {
            const strength = Math.min(0.88, (vn - thresh) * 3.8);
            ctx.fillStyle = rgbaCss(varGold, strength);
            ctx.fillRect(x, y, step, step);
          }
        }
      }
    }

    // Subtle dark shadow beside the centre midrib so the blade looks cupped
    const midShadow = ctx.createLinearGradient(w * 0.34, 0, w * 0.66, 0);
    midShadow.addColorStop(0.0, 'rgba(10,32,16,0)');
    midShadow.addColorStop(0.42, 'rgba(10,32,16,0.16)');
    midShadow.addColorStop(0.5, 'rgba(10,32,16,0.22)');
    midShadow.addColorStop(0.58, 'rgba(10,32,16,0.16)');
    midShadow.addColorStop(1.0, 'rgba(10,32,16,0)');
    ctx.fillStyle = midShadow;
    ctx.fillRect(w * 0.34, 0, w * 0.32, h);

    // Arching lateral veins
    for (let i = 0; i < veinCount; i++) {
      const t = (i + 0.55) / (veinCount + 0.4);
      const y0 = h * (1 - t * 0.86);
      const rise = h * (0.14 + (1 - t) * 0.1);
      const widthScale = Math.sin(Math.min(1, t * 1.08) * Math.PI) * 0.46 + 0.08;

      for (const side of [-1, 1]) {
        ctx.strokeStyle = rgbaCss(veinCol, isFiddle ? 0.78 : 0.52);
        ctx.lineWidth = (isFiddle ? 5.2 : 3.2) * (1 - t * 0.52);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(w * 0.5, y0);
        ctx.bezierCurveTo(
          w * (0.5 + side * widthScale * 0.38), y0 - rise * 0.25,
          w * (0.5 + side * widthScale * 0.76), y0 - rise * 0.65,
          w * (0.5 + side * widthScale), y0 - rise
        );
        ctx.stroke();

        // Fine secondary veinlet branching
        if (isFiddle) {
          ctx.strokeStyle = rgbaCss(veinCol, 0.34);
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(w * (0.5 + side * widthScale * 0.48), y0 - rise * 0.38);
          ctx.quadraticCurveTo(
            w * (0.5 + side * widthScale * 0.68), y0 - rise * 0.25,
            w * (0.5 + side * widthScale * 0.86), y0 - rise * 0.48
          );
          ctx.stroke();
        }
      }
    }

    // Prominent tapered painted centre vein (midrib)
    const steps = 40;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      const y0 = h * (1 - t0 * 0.96);
      const y1 = h * (1 - t1 * 0.96);
      const lw = (isFiddle ? 12 : 8.5) * Math.pow(1 - t0, 0.8) + 1.2;
      ctx.strokeStyle = rgbaCss(veinCol, isFiddle ? 0.92 : 0.78);
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w * 0.5, y0);
      ctx.lineTo(w * 0.5, y1);
      ctx.stroke();
    }
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;

  // Matching botanical venation bump map
  const bumpTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);

    // Subtle pillowing between veins
    for (let i = 0; i < veinCount; i++) {
      const t = (i + 0.55) / (veinCount + 0.4);
      const y0 = h * (1 - t * 0.86);
      const rise = h * (0.14 + (1 - t) * 0.1);
      const widthScale = Math.sin(Math.min(1, t * 1.08) * Math.PI) * 0.46 + 0.08;

      for (const side of [-1, 1]) {
        ctx.strokeStyle = isFiddle ? 'rgba(218,218,218,0.85)' : 'rgba(182,182,182,0.7)';
        ctx.lineWidth = (isFiddle ? 7 : 4.5) * (1 - t * 0.45);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(w * 0.5, y0);
        ctx.bezierCurveTo(
          w * (0.5 + side * widthScale * 0.38), y0 - rise * 0.25,
          w * (0.5 + side * widthScale * 0.76), y0 - rise * 0.65,
          w * (0.5 + side * widthScale), y0 - rise
        );
        ctx.stroke();
      }
    }

    // Centre vein ridge
    ctx.strokeStyle = 'rgba(242,242,242,0.95)';
    ctx.lineWidth = isFiddle ? 11 : 7;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h);
    ctx.lineTo(w * 0.5, h * 0.04);
    ctx.stroke();
  });

  return new THREE.MeshPhysicalMaterial({
    map: colorTex,
    bumpMap: bumpTex,
    bumpScale: isFiddle ? 0.0042 : 0.0024,
    roughness,
    metalness: 0.0,
    clearcoat,
    clearcoatRoughness: 0.32,
    sheen: 0.24,
    sheenRoughness: 0.62,
    sheenColor: new THREE.Color(0x98cf78),
  });
}

function makeStemMaterial(THREE, hex, roughness = 0.48) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(hex),
    roughness,
    metalness: 0.0,
    clearcoat: 0.22,
    clearcoatRoughness: 0.45,
    sheen: 0.16,
    sheenColor: new THREE.Color(0x8bc26c),
  });
}

// ---------------------------------------------------------------------------
// Structural Builders: Stand, Ceramic Pot, Sculpted Soil & Pebbles
// ---------------------------------------------------------------------------

function buildStand(THREE, woodMat, padMat) {
  const group = new THREE.Group();
  group.name = 'stand';

  const legAngles = [
    Math.PI * 0.25,
    Math.PI * 0.75,
    Math.PI * 1.25,
    Math.PI * 1.75,
  ];

  // 4 gracefully splayed mid-century wooden legs resting on Y = 0
  for (let i = 0; i < 4; i++) {
    const a = legAngles[i];
    const ca = Math.cos(a);
    const sa = Math.sin(a);

    const legCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ca * 0.156, 0.005, sa * 0.156),
      new THREE.Vector3(ca * 0.146, 0.098, sa * 0.146),
      new THREE.Vector3(ca * 0.155, 0.195, sa * 0.155),
      new THREE.Vector3(ca * 0.150, 0.272, sa * 0.150),
    ]);

    const legGeo = makeTaperedTube(THREE, legCurve, {
      segments: 18,
      radialSegments: 12,
      radiusFn: (t) => {
        // Gentle mid-century swell near the crossbar joint, tapering gracefully to ends
        const swell = Math.sin(t * Math.PI) * 0.0034;
        return 0.0108 + swell - t * 0.0008;
      },
      capStart: true,
      capEnd: true,
    });
    const legMesh = new THREE.Mesh(legGeo, woodMat);
    legMesh.userData.slot = 'secondary';
    legMesh.castShadow = true;
    legMesh.receiveShadow = true;
    group.add(legMesh);

    // Cozy felt floor pad touching Y = 0
    const padProfile = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.0095, 0.0),
      new THREE.Vector2(0.0102, 0.0025),
      new THREE.Vector2(0.0096, 0.0055),
      new THREE.Vector2(0.0, 0.0055),
    ];
    const padGeo = new THREE.LatheGeometry(padProfile, 14);
    const padMesh = new THREE.Mesh(padGeo, padMat);
    padMesh.position.set(ca * 0.156, 0.0, sa * 0.156);
    padMesh.castShadow = true;
    padMesh.receiveShadow = true;
    group.add(padMesh);

    // Subtle craft dowel peg outside the leg-to-rail joint
    const pegCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ca * 0.142, 0.098, sa * 0.142),
      new THREE.Vector3(ca * 0.161, 0.098, sa * 0.161),
    ]);
    const pegGeo = makeTaperedTube(THREE, pegCurve, {
      segments: 4,
      radialSegments: 10,
      radiusFn: () => 0.0046,
      capStart: false,
      capEnd: true,
    });
    const pegMesh = new THREE.Mesh(pegGeo, woodMat);
    pegMesh.userData.slot = 'secondary';
    pegMesh.castShadow = true;
    group.add(pegMesh);
  }

  // 2 interlocking horizontal wooden crossbars supporting the ceramic pot
  for (let b = 0; b < 2; b++) {
    const a = legAngles[b];
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const span = 0.146;

    const railCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-ca * span, 0.098, -sa * span),
      new THREE.Vector3(-ca * span * 0.4, 0.099, -sa * span * 0.4),
      new THREE.Vector3(0, 0.099, 0),
      new THREE.Vector3(ca * span * 0.4, 0.099, sa * span * 0.4),
      new THREE.Vector3(ca * span, 0.098, sa * span),
    ]);

    const railGeo = makeTaperedTube(THREE, railCurve, {
      segments: 14,
      radialSegments: 12,
      radiusFn: (t) => 0.0112 + Math.sin(t * Math.PI) * 0.0016,
      // Slightly oval cross-section (taller than wide for mid-century elegance)
      profileMod: (theta) => 0.86 + 0.18 * Math.abs(Math.sin(theta)),
      capStart: true,
      capEnd: true,
    });
    const railMesh = new THREE.Mesh(railGeo, woodMat);
    railMesh.userData.slot = 'secondary';
    railMesh.castShadow = true;
    railMesh.receiveShadow = true;
    group.add(railMesh);
  }

  return group;
}

function buildPot(THREE, potMat) {
  const group = new THREE.Group();
  group.name = 'pot';

  // Carefully sculpted 28-point studio ceramic profile (bottom rests on stand
  // crossbars at Y = 0.106, outer rim peaks at Y = 0.372, inner wall descends
  // cleanly below the soil mound to Y = 0.275)
  const profile = [
    new THREE.Vector2(0.000, 0.108),
    new THREE.Vector2(0.055, 0.108),
    new THREE.Vector2(0.082, 0.106), // subtle recessed foot ring
    new THREE.Vector2(0.093, 0.106),
    new THREE.Vector2(0.097, 0.114),
    new THREE.Vector2(0.108, 0.125),
    new THREE.Vector2(0.122, 0.145),
    new THREE.Vector2(0.134, 0.172),
    new THREE.Vector2(0.142, 0.204),
    new THREE.Vector2(0.145, 0.236), // plump stoneware belly
    new THREE.Vector2(0.143, 0.268),
    new THREE.Vector2(0.138, 0.298),
    new THREE.Vector2(0.133, 0.322),
    new THREE.Vector2(0.130, 0.338), // subtle glaze groove
    new THREE.Vector2(0.132, 0.348),
    new THREE.Vector2(0.136, 0.358), // gently flared rolled lip
    new THREE.Vector2(0.137, 0.367),
    new THREE.Vector2(0.134, 0.372),
    new THREE.Vector2(0.128, 0.374), // rounded rim top
    new THREE.Vector2(0.122, 0.372),
    new THREE.Vector2(0.119, 0.365),
    new THREE.Vector2(0.119, 0.352),
    new THREE.Vector2(0.121, 0.332), // inner wall passes soil line
    new THREE.Vector2(0.122, 0.305),
    new THREE.Vector2(0.116, 0.282),
    new THREE.Vector2(0.080, 0.276),
    new THREE.Vector2(0.000, 0.276),
  ];

  const geo = new THREE.LatheGeometry(profile, 48);

  // Remap V cleanly so the ceramic texture bands sit on the outer wall
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    const vRaw = uv.getY(i);
    // Outer wall runs roughly up to vRaw ~ 0.67
    if (vRaw < 0.72) {
      const hNorm = Math.max(0, Math.min(1, (y - 0.106) / (0.374 - 0.106)));
      uv.setY(i, hNorm * 0.76);
    } else {
      // Rim & inner wall map to top portion of texture (v in [0.76, 1.0])
      const innerT = Math.max(0, Math.min(1, (0.374 - y) / 0.10 + (0.124 - r) * 0.5));
      uv.setY(i, 0.76 + innerT * 0.24);
    }
  }
  geo.computeVertexNormals();

  const potMesh = new THREE.Mesh(geo, potMat);
  potMesh.userData.slot = 'primary';
  potMesh.castShadow = true;
  potMesh.receiveShadow = true;
  group.add(potMesh);

  return group;
}

function buildSoil(THREE, kit, soilMat, rng) {
  const group = new THREE.Group();
  group.name = 'soil';

  // Sculpted organic potting soil mound deeply overlapping the pot inner wall
  const soilGeo = new THREE.SphereGeometry(0.122, 42, 24);
  const pos = soilGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z) / 0.122;

    if (y >= 0) {
      // Gentle dome with lumpy organic potting mix relief
      const mound = Math.pow(Math.max(0, 1 - r * r * 0.85), 0.75) * 0.026;
      const clumps = (fbm(kit, x * 28 + 3.1, z * 28 + 1.7, 3) - 0.5) * 0.015;
      const fine = (kit.noise(x * 75, z * 75) - 0.5) * 0.005;
      pos.setY(i, 0.329 + mound + clumps + fine);
    } else {
      // Solid skirt extending below soil line
      pos.setY(i, 0.329 + y * 0.25);
    }
  }
  soilGeo.computeVertexNormals();

  const soilMesh = new THREE.Mesh(soilGeo, soilMat);
  soilMesh.castShadow = false;
  soilMesh.receiveShadow = true;
  group.add(soilMesh);

  // 7 sculpted smooth decorative river pebbles nestled into the soil surface
  const pebbleColors = [0x9e958a, 0xc7bba9, 0x706a64, 0xb59c82, 0x867d73];
  for (let i = 0; i < 7; i++) {
    const pGeo = new THREE.IcosahedronGeometry(1, 2);
    const pPos = pGeo.attributes.position;
    const rx = 0.0085 + rng() * 0.0075;
    const ry = 0.0045 + rng() * 0.0038;
    const rz = 0.0075 + rng() * 0.0070;
    const seedX = rng() * 10;
    const seedZ = rng() * 10;

    for (let k = 0; k < pPos.count; k++) {
      const vx = pPos.getX(k);
      const vy = pPos.getY(k);
      const vz = pPos.getZ(k);
      const bump = 0.85 + kit.noise(vx * 2.1 + seedX, vz * 2.1 + seedZ) * 0.30;
      pPos.setXYZ(k, vx * rx * bump, vy * ry * bump, vz * rz * bump);
    }
    pGeo.computeVertexNormals();

    const pMat = new THREE.MeshPhysicalMaterial({
      color: pebbleColors[i % pebbleColors.length],
      roughness: 0.62,
      metalness: 0.0,
      clearcoat: 0.14,
    });
    const pMesh = new THREE.Mesh(pGeo, pMat);
    const ang = (i / 7) * Math.PI * 2 + rng() * 0.55;
    const dist = 0.048 + rng() * 0.056;
    const px = Math.cos(ang) * dist;
    const pz = Math.sin(ang) * dist;
    const rNorm = dist / 0.122;
    const py = 0.329 + Math.pow(Math.max(0, 1 - rNorm * rNorm * 0.85), 0.75) * 0.025;
    pMesh.position.set(px, py - ry * 0.22, pz);
    pMesh.rotation.set((rng() - 0.5) * 0.35, rng() * Math.PI * 2, (rng() - 0.5) * 0.35);
    pMesh.castShadow = true;
    pMesh.receiveShadow = true;
    group.add(pMesh);
  }

  return group;
}

// ---------------------------------------------------------------------------
// Variant 0: Monstera Deliciosa (Split Bezier Leaves + Fenestration Holes)
// ---------------------------------------------------------------------------

/**
 * Draws a Monstera deliciosa leaf shape using cubic bezierCurveTo with deep
 * rounded split lobes (sinuses) and optional inner oval fenestration holes.
 */
function makeMonsteraShape(THREE, length, width, splitsPerSide, withHoles, asym = 0) {
  const L = length;
  const W = width * 0.5;
  const shape = new THREE.Shape();

  // Half-width profile of the outer cordate envelope at normalized height t in [0,1]
  const envW = (t) => {
    const body = Math.sin(Math.pow(Math.max(0, Math.min(1, t)), 0.72) * Math.PI);
    const baseBulge = Math.exp(-Math.pow((t - 0.18) / 0.22, 2)) * 0.26;
    return W * Math.min(1.02, body * 0.94 + baseBulge);
  };

  // Start at the cordate petiole notch
  shape.moveTo(0, 0.03 * L);

  // Helper to trace one side from base up to apex (dir = +1) or apex down to base (dir = -1)
  // Build clean ordered right-side points and mirror cleanly for left side
  const buildCuts = (sideSign, count) => {
    const cuts = [];
    if (count === 1) {
      cuts.push({ yIn: 0.44 + asym * 0.03 * sideSign, gap: 0.055, depth: 0.34 });
    } else if (count === 2) {
      cuts.push({ yIn: 0.30 + asym * 0.02 * sideSign, gap: 0.055, depth: 0.34 });
      cuts.push({ yIn: 0.56 - asym * 0.02 * sideSign, gap: 0.052, depth: 0.30 });
    } else if (count >= 3) {
      cuts.push({ yIn: 0.24 + asym * 0.015 * sideSign, gap: 0.052, depth: 0.34 });
      cuts.push({ yIn: 0.46 - asym * 0.015 * sideSign, gap: 0.052, depth: 0.31 });
      cuts.push({ yIn: 0.67 + asym * 0.012 * sideSign, gap: 0.048, depth: 0.27 });
    }
    return cuts;
  };

  // --- RIGHT SIDE (base -> apex) ---
  const rightCuts = buildCuts(1, splitsPerSide);
  const firstY = rightCuts.length > 0 ? rightCuts[0].yIn : 0.42;

  // Rounded basal ear lobe sweeping down below y = 0 then outward
  shape.bezierCurveTo(
    0.34 * W, -0.14 * L,
    0.96 * W, -0.05 * L,
    envW(firstY), firstY * L
  );

  let curY = firstY;
  for (let i = 0; i < rightCuts.length; i++) {
    const c = rightCuts[i];
    const yBot = c.yIn * L;
    const yTop = (c.yIn + c.gap) * L;
    const xInner = c.depth * W;
    const xOutBot = envW(c.yIn);
    const xOutTop = envW(c.yIn + c.gap);

    // Smooth curved lobe leading to this cut if needed
    if (c.yIn > curY + 0.005) {
      const midY = (curY + c.yIn) * 0.5;
      shape.bezierCurveTo(
        envW(curY + (c.yIn - curY) * 0.35) * 1.05, (curY + (c.yIn - curY) * 0.35) * L,
        envW(midY) * 1.06, (curY + (c.yIn - curY) * 0.72) * L,
        xOutBot, yBot
      );
    }

    // Inward sinus cut -> rounded teardrop inner end -> outward upper edge of cut
    shape.bezierCurveTo(
      xOutBot * 0.65, yBot - 0.015 * L,
      xInner + 0.08 * W, yBot - 0.025 * L,
      xInner, yBot + 0.002 * L
    );
    shape.bezierCurveTo(
      xInner - 0.045 * W, yBot + (yTop - yBot) * 0.35,
      xInner - 0.035 * W, yBot + (yTop - yBot) * 0.75,
      xInner + 0.04 * W, yTop - 0.014 * L
    );
    shape.bezierCurveTo(
      xInner + 0.16 * W, yTop - 0.012 * L,
      xOutTop * 0.72, yTop - 0.006 * L,
      xOutTop, yTop
    );

    curY = c.yIn + c.gap;
  }

  // Sweep from last cut up to pointed tropical apex
  shape.bezierCurveTo(
    envW(curY + (1 - curY) * 0.35) * 1.02, (curY + (1 - curY) * 0.36) * L,
    envW(curY + (1 - curY) * 0.72) * 0.85, (curY + (1 - curY) * 0.80) * L,
    asym * 0.03 * W, L
  );

  // --- LEFT SIDE (apex -> base) ---
  const leftCuts = buildCuts(-1, splitsPerSide).reverse();
  curY = 1.0;

  for (let i = 0; i < leftCuts.length; i++) {
    const c = leftCuts[i];
    const yTopFrac = c.yIn + c.gap;
    const yTop = yTopFrac * L;
    const yBot = c.yIn * L;
    const xInner = -c.depth * W;
    const xOutTop = -envW(yTopFrac);
    const xOutBot = -envW(c.yIn);

    if (curY === 1.0) {
      shape.bezierCurveTo(
        -envW(yTopFrac + (1 - yTopFrac) * 0.72) * 0.85, (yTopFrac + (1 - yTopFrac) * 0.80) * L,
        -envW(yTopFrac + (1 - yTopFrac) * 0.35) * 1.02, (yTopFrac + (1 - yTopFrac) * 0.36) * L,
        xOutTop, yTop
      );
    } else {
      const midY = (curY + yTopFrac) * 0.5;
      shape.bezierCurveTo(
        -envW(midY) * 1.06, (yTopFrac + (curY - yTopFrac) * 0.72) * L,
        -envW(yTopFrac + (curY - yTopFrac) * 0.35) * 1.05, (yTopFrac + (curY - yTopFrac) * 0.35) * L,
        xOutTop, yTop
      );
    }

    // Inward sinus cut from top edge -> rounded inner end -> outward bottom edge
    shape.bezierCurveTo(
      xOutTop * 0.72, yTop - 0.006 * L,
      xInner - 0.16 * W, yTop - 0.012 * L,
      xInner - 0.04 * W, yTop - 0.014 * L
    );
    shape.bezierCurveTo(
      xInner + 0.035 * W, yBot + (yTop - yBot) * 0.75,
      xInner + 0.045 * W, yBot + (yTop - yBot) * 0.35,
      xInner, yBot + 0.002 * L
    );
    shape.bezierCurveTo(
      xInner - 0.08 * W, yBot - 0.025 * L,
      xOutBot * 0.65, yBot - 0.015 * L,
      xOutBot, yBot
    );

    curY = c.yIn;
  }

  // Sweep down around left basal ear back to petiole notch
  if (leftCuts.length === 0) {
    shape.bezierCurveTo(
      -envW(0.75) * 0.9, 0.78 * L,
      -envW(0.45) * 1.04, 0.45 * L,
      -envW(0.42), 0.42 * L
    );
  }
  shape.bezierCurveTo(
    -0.96 * W, -0.05 * L,
    -0.34 * W, -0.14 * L,
    0, 0.03 * L
  );

  // Iconic interior oval fenestration holes placed safely inside solid lobes
  if (withHoles && splitsPerSide >= 2) {
    const holeSpecs = splitsPerSide >= 3
      ? [
          { side: 1, cx: 0.43 * W, cy: 0.375 * L, rx: 0.105 * W, ry: 0.026 * L, tilt: 0.25 },
          { side: -1, cx: -0.43 * W, cy: 0.385 * L, rx: 0.10 * W, ry: 0.025 * L, tilt: -0.25 },
          { side: 1, cx: 0.36 * W, cy: 0.59 * L, rx: 0.085 * W, ry: 0.022 * L, tilt: 0.3 },
        ]
      : [
          { side: 1, cx: 0.40 * W, cy: 0.45 * L, rx: 0.095 * W, ry: 0.025 * L, tilt: 0.22 },
          { side: -1, cx: -0.40 * W, cy: 0.47 * L, rx: 0.090 * W, ry: 0.024 * L, tilt: -0.22 },
        ];

    for (const h of holeSpecs) {
      const hole = new THREE.Path();
      const ct = Math.cos(h.tilt);
      const st = Math.sin(h.tilt);
      const pt = (lx, ly) => [
        h.cx + lx * ct - ly * st,
        h.cy + lx * st + ly * ct,
      ];
      const k = 0.55228;
      const p0 = pt(h.rx, 0);
      const p1 = pt(0, h.ry);
      const p2 = pt(-h.rx, 0);
      const p3 = pt(0, -h.ry);
      const c0a = pt(h.rx, h.ry * k);
      const c0b = pt(h.rx * k, h.ry);
      const c1a = pt(-h.rx * k, h.ry);
      const c1b = pt(-h.rx, h.ry * k);
      const c2a = pt(-h.rx, -h.ry * k);
      const c2b = pt(-h.rx * k, -h.ry);
      const c3a = pt(h.rx * k, -h.ry);
      const c3b = pt(h.rx, -h.ry * k);

      hole.moveTo(p0[0], p0[1]);
      hole.bezierCurveTo(c0a[0], c0a[1], c0b[0], c0b[1], p1[0], p1[1]);
      hole.bezierCurveTo(c1a[0], c1a[1], c1b[0], c1b[1], p2[0], p2[1]);
      hole.bezierCurveTo(c2a[0], c2a[1], c2b[0], c2b[1], p3[0], p3[1]);
      hole.bezierCurveTo(c3a[0], c3a[1], c3b[0], c3b[1], p0[0], p0[1]);
      shape.holes.push(hole);
    }
  }

  return shape;
}

function buildMonstera(THREE, kit, accentHex, rng, swayItems) {
  const foliage = new THREE.Group();
  foliage.name = 'foliage';

  const matureMat = makeLeafMaterial(THREE, kit, 'monstera', accentHex, 0.5);
  const youngMat = makeLeafMaterial(THREE, kit, 'monsteraYoung', accentHex, 4.2);
  const stemMat = makeStemMaterial(THREE, 0x3a723a, 0.45);
  const veinMat = makeStemMaterial(THREE, 0x6ea64d, 0.42);
  const rootMat = makeStemMaterial(THREE, 0x7b5c42, 0.78);

  // Sturdy central ribbed basal rhizome emerging from the soil
  const baseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 0.31, -0.01),
    new THREE.Vector3(0.005, 0.37, 0.002),
    new THREE.Vector3(-0.004, 0.435, 0.01),
  ]);
  const baseGeo = makeTaperedTube(THREE, baseCurve, {
    segments: 14,
    radialSegments: 12,
    radiusFn: (t) => 0.020 * (1 - 0.25 * t) + Math.sin(t * Math.PI * 6) * 0.0012,
    capStart: true,
    capEnd: true,
  });
  const baseMesh = new THREE.Mesh(baseGeo, stemMat);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  foliage.add(baseMesh);

  // 3 organic curving aerial roots draping from the stem nodes back into the soil
  const rootConfigs = [
    [
      new THREE.Vector3(0.012, 0.40, 0.012),
      new THREE.Vector3(0.052, 0.39, 0.048),
      new THREE.Vector3(0.088, 0.35, 0.064),
      new THREE.Vector3(0.098, 0.32, 0.070),
    ],
    [
      new THREE.Vector3(-0.010, 0.415, 0.010),
      new THREE.Vector3(-0.056, 0.405, 0.036),
      new THREE.Vector3(-0.095, 0.365, 0.052),
      new THREE.Vector3(-0.105, 0.325, 0.048),
    ],
    [
      new THREE.Vector3(0.006, 0.385, -0.014),
      new THREE.Vector3(0.045, 0.375, -0.058),
      new THREE.Vector3(0.072, 0.33, -0.078),
    ],
  ];
  for (const pts of rootConfigs) {
    const rGeo = makeTaperedTube(THREE, new THREE.CatmullRomCurve3(pts), {
      segments: 14,
      radialSegments: 8,
      radiusFn: (t) => 0.0046 * (1 - 0.45 * t),
      capStart: true,
      capEnd: true,
    });
    const rMesh = new THREE.Mesh(rGeo, rootMat);
    rMesh.castShadow = true;
    foliage.add(rMesh);
  }

  // 12 individually shaped, bent Monstera leaves arranged for a lush ~0.90 m silhouette
  const leafSpecs = [
    // Tall hero upper crown leaves (peaking around Y = 0.88 - 0.92 m)
    { az: 0.32,  topY: 0.84, reach: 0.11, len: 0.255, wid: 0.225, splits: 3, holes: true,  pitch: 0.48, roll: -0.10, young: false },
    { az: 2.38,  topY: 0.81, reach: 0.13, len: 0.245, wid: 0.215, splits: 3, holes: true,  pitch: 0.44, roll: 0.14,  young: false },
    { az: 4.35,  topY: 0.86, reach: 0.09, len: 0.235, wid: 0.210, splits: 3, holes: true,  pitch: 0.56, roll: -0.08, young: false },
    { az: -0.78, topY: 0.76, reach: 0.17, len: 0.230, wid: 0.205, splits: 3, holes: true,  pitch: 0.34, roll: 0.12,  young: false },
    // Mid-tier full spreading leaves
    { az: 1.25,  topY: 0.69, reach: 0.20, len: 0.215, wid: 0.195, splits: 2, holes: true,  pitch: 0.26, roll: -0.16, young: false },
    { az: 3.35,  topY: 0.70, reach: 0.19, len: 0.210, wid: 0.188, splits: 2, holes: true,  pitch: 0.24, roll: 0.10,  young: false },
    { az: 5.25,  topY: 0.67, reach: 0.21, len: 0.200, wid: 0.182, splits: 2, holes: false, pitch: 0.22, roll: 0.15,  young: false },
    { az: 0.05,  topY: 0.62, reach: 0.18, len: 0.185, wid: 0.168, splits: 2, holes: false, pitch: 0.18, roll: -0.08, young: false },
    { az: 1.92,  topY: 0.60, reach: 0.19, len: 0.178, wid: 0.162, splits: 2, holes: false, pitch: 0.16, roll: 0.08,  young: false },
    // Cozy lower & younger leaves filling the crown above the pot rim
    { az: 4.80,  topY: 0.52, reach: 0.16, len: 0.145, wid: 0.132, splits: 1, holes: false, pitch: 0.10, roll: -0.12, young: false },
    { az: 2.85,  topY: 0.51, reach: 0.15, len: 0.135, wid: 0.122, splits: 1, holes: false, pitch: 0.14, roll: 0.10,  young: true },
    { az: 0.82,  topY: 0.56, reach: 0.12, len: 0.130, wid: 0.114, splits: 1, holes: false, pitch: 0.36, roll: -0.06, young: true },
  ];

  leafSpecs.forEach((sp, idx) => {
    const stemGroup = new THREE.Group();
    stemGroup.name = `stem_${idx}`;

    const ca = Math.cos(sp.az);
    const sa = Math.sin(sp.az);
    const baseY = 0.355 + (idx % 4) * 0.018;
    const pivot = new THREE.Vector3(ca * 0.012, baseY, sa * 0.012);
    stemGroup.position.copy(pivot);

    // Graceful arching tapered petiole in local coordinates
    const relTopY = sp.topY - baseY;
    const midReach = sp.reach * (0.48 + (rng() - 0.5) * 0.08);
    const swirl = (rng() - 0.5) * 0.035;
    const perpX = -sa;
    const perpZ = ca;

    const p0 = new THREE.Vector3(0, 0, 0);
    const p1 = new THREE.Vector3(
      ca * midReach * 0.45 + perpX * swirl * 0.5,
      relTopY * 0.46,
      sa * midReach * 0.45 + perpZ * swirl * 0.5
    );
    const p2 = new THREE.Vector3(
      ca * sp.reach * 0.85 + perpX * swirl,
      relTopY * 0.88,
      sa * sp.reach * 0.85 + perpZ * swirl
    );
    const p3 = new THREE.Vector3(
      ca * sp.reach,
      relTopY,
      sa * sp.reach
    );

    const stemCurve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
    const stemGeo = makeTaperedTube(THREE, stemCurve, {
      segments: 18,
      radialSegments: 9,
      radiusFn: (t) => 0.0068 * Math.pow(1 - t, 0.52) + 0.0028 * t,
      capStart: true,
      capEnd: true,
    });
    const stemMesh = new THREE.Mesh(stemGeo, stemMat);
    stemMesh.castShadow = true;
    stemMesh.receiveShadow = true;
    stemGroup.add(stemMesh);

    // Unique bezier leaf shape with individual bending
    const asym = (rng() - 0.5) * 0.9;
    const shape = makeMonsteraShape(THREE, sp.len, sp.wid, sp.splits, sp.holes, asym);
    const archAmt = 0.032 + rng() * 0.022;
    const droopAmt = 0.058 + rng() * 0.026;
    const cupAmt = 0.016 + rng() * 0.012;
    const twistAmt = (rng() - 0.5) * 0.018;
    const wavePhase = rng() * Math.PI * 2;

    const leaf = buildSculptedLeaf(
      THREE,
      shape,
      {
        depth: 0.0020,
        bevelThickness: 0.0011,
        bevelSize: 0.0011,
        bevelSegments: 2,
        curveSegments: 9,
        maxEdgeLen: 0.030,
        maxTris: 1650,
        veinStart: 0.006,
        veinEndRatio: 0.91,
        veinBaseRadius: 0.0036 * (sp.len / 0.22),
        veinTipRadius: 0.0005,
        veinZOffset: -0.0016,
        bendFn: (x, y, z, u, v, maxY) => {
          // Graceful downward arch along the blade length + gentle convex/cupped lobes
          const longZ = archAmt * Math.sin(v * Math.PI * 0.85) - droopAmt * v * v;
          const cupZ = cupAmt * Math.abs(u) * (1 - 0.35 * v) - 0.012 * u * u * v;
          const waveZ = 0.0065 * Math.sin(v * 7.5 + wavePhase) * (u * u);
          const twistZ = twistAmt * u * v;
          const foreshortenY = -Math.abs(longZ) * 0.16 * v;
          return {
            dx: 0,
            dy: foreshortenY * (maxY / 0.22),
            dz: longZ + cupZ + waveZ + twistZ,
          };
        },
      },
      sp.young ? youngMat : matureMat,
      veinMat
    );

    // Orient leaf outward from stem tip, presenting its split blade gracefully
    const outDir = new THREE.Vector3(ca, sp.pitch, sa).normalize();
    orientLeafGroup(THREE, leaf, p3, outDir, new THREE.Vector3(0, 1, 0), sp.roll);
    stemGroup.add(leaf);

    foliage.add(stemGroup);
    swayItems.push({
      obj: stemGroup,
      baseRotX: stemGroup.rotation.x,
      baseRotY: stemGroup.rotation.y,
      baseRotZ: stemGroup.rotation.z,
      amp: 0.018 + (relTopY * 0.032),
      speed: 0.95 + rng() * 0.35,
      phase: idx * 0.72,
    });
  });

  // Charming newly unfurling coiled baby shoot in the centre
  const shootCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.004, 0.42, 0.008),
    new THREE.Vector3(-0.018, 0.54, 0.025),
    new THREE.Vector3(-0.012, 0.65, 0.036),
    new THREE.Vector3(0.002, 0.72, 0.044),
  ]);
  const shootGeo = makeTaperedTube(THREE, shootCurve, {
    segments: 18,
    radialSegments: 10,
    radiusFn: (t) => {
      if (t < 0.48) return 0.0042;
      const u = (t - 0.48) / 0.52;
      return 0.0042 + Math.sin(u * Math.PI) * 0.0068 * (1 - 0.25 * u);
    },
    capStart: true,
    capEnd: true,
  });
  const shootMesh = new THREE.Mesh(shootGeo, youngMat);
  shootMesh.castShadow = true;
  foliage.add(shootMesh);

  return foliage;
}

// ---------------------------------------------------------------------------
// Variant 1: Fiddle-Leaf Fig (Sculpted Woody Trunk + Ruffled Violin Leaves)
// ---------------------------------------------------------------------------

/**
 * Draws a Ficus lyrata (fiddle-leaf fig) violin-shaped silhouette with narrow
 * pinched waist, broad wavy upper paddle lobe, and subtle scalloped margin.
 */
function makeFiddleLeafShape(THREE, length, width, asym = 0) {
  const L = length;
  const W = width * 0.5;
  const shape = new THREE.Shape();

  shape.moveTo(0, 0.01 * L);

  // Right side: small rounded basal lobe -> narrow violin waist -> wide ruffled upper lobe -> blunt apex
  shape.bezierCurveTo(
    0.30 * W, -0.04 * L,
    0.58 * W, 0.08 * L,
    0.46 * W, 0.22 * L
  );
  // Pinched violin waist
  shape.bezierCurveTo(
    0.36 * W, 0.30 * L,
    0.34 * W, 0.38 * L,
    0.56 * W, 0.48 * L
  );
  // Broad plump upper paddle lobe with subtle natural wave
  shape.bezierCurveTo(
    0.88 * W, 0.57 * L,
    1.04 * W, 0.69 * L,
    0.94 * W, 0.80 * L
  );
  // Rounding into slightly notched/bluntly pointed apex
  shape.bezierCurveTo(
    0.84 * W, 0.93 * L,
    0.36 * W, 1.02 * L,
    asym * 0.05 * W, 0.985 * L
  );

  // Left side (mirrored with subtle natural asymmetry)
  const lw = 1 - asym * 0.06;
  shape.bezierCurveTo(
    -0.36 * W * lw, 1.02 * L,
    -0.84 * W * lw, 0.93 * L,
    -0.94 * W * lw, 0.80 * L
  );
  shape.bezierCurveTo(
    -1.04 * W * lw, 0.69 * L,
    -0.88 * W * lw, 0.57 * L,
    -0.56 * W * lw, 0.48 * L
  );
  shape.bezierCurveTo(
    -0.34 * W * lw, 0.38 * L,
    -0.36 * W * lw, 0.30 * L,
    -0.46 * W * lw, 0.22 * L
  );
  shape.bezierCurveTo(
    -0.58 * W * lw, 0.08 * L,
    -0.30 * W * lw, -0.04 * L,
    0, 0.01 * L
  );

  return shape;
}

function buildFiddleLeafFig(THREE, kit, accentHex, rng, swayItems) {
  const foliage = new THREE.Group();
  foliage.name = 'foliage';

  const barkMat = makeBarkMaterial(THREE, kit, false);
  const matureMat = makeLeafMaterial(THREE, kit, 'fiddle', accentHex, 1.3);
  const youngMat = makeLeafMaterial(THREE, kit, 'fiddleYoung', accentHex, 5.1);
  const petioleMat = makeStemMaterial(THREE, 0x526b36, 0.62);
  const veinMat = makeStemMaterial(THREE, 0x9db463, 0.48);

  // Main sculptural woody trunk with gentle organic S-curve & root flare
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 0.305, 0.0),
    new THREE.Vector3(-0.008, 0.40, 0.006),
    new THREE.Vector3(0.006, 0.50, -0.004),
    new THREE.Vector3(0.012, 0.585, 0.005),
    new THREE.Vector3(0.005, 0.64, 0.008),
  ]);
  const trunkGeo = makeTaperedTube(THREE, trunkCurve, {
    segments: 24,
    radialSegments: 14,
    radiusFn: (t) => {
      const flare = Math.exp(-t * 8.5) * 0.0095;
      const knot = Math.sin(t * Math.PI * 5) * 0.0008;
      return 0.0185 * (1 - 0.42 * t) + flare + knot;
    },
    capStart: true,
    capEnd: true,
  });
  const trunkMesh = new THREE.Mesh(trunkGeo, barkMat);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  foliage.add(trunkMesh);

  // 3 flared surface roots anchoring the woody trunk into the soil mound
  for (let r = 0; r < 3; r++) {
    const a = r * 2.1 + 0.5;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const rootCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ca * 0.006, 0.365, sa * 0.006),
      new THREE.Vector3(ca * 0.026, 0.352, sa * 0.026),
      new THREE.Vector3(ca * 0.056, 0.332, sa * 0.056),
    ]);
    const rootGeo = makeTaperedTube(THREE, rootCurve, {
      segments: 10,
      radialSegments: 9,
      radiusFn: (t) => 0.0105 * (1 - 0.65 * t),
      capStart: true,
      capEnd: true,
    });
    const rootMesh = new THREE.Mesh(rootGeo, barkMat);
    rootMesh.castShadow = true;
    rootMesh.receiveShadow = true;
    foliage.add(rootMesh);
  }

  // 3 graceful woody upper branches emerging from the trunk fork
  const branchDefs = [
    {
      name: 'branch_0',
      origin: new THREE.Vector3(0.007, 0.615, 0.007),
      pts: [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.032, 0.065, 0.028),
        new THREE.Vector3(0.062, 0.138, 0.052),
      ],
      baseR: 0.0095,
      leaves: [
        { t: 0.25, az: 0.35,  len: 0.205, wid: 0.135, pitch: 0.22, young: false },
        { t: 0.48, az: 1.55,  len: 0.190, wid: 0.125, pitch: 0.34, young: false },
        { t: 0.68, az: -0.62, len: 0.175, wid: 0.118, pitch: 0.45, young: false },
        { t: 0.85, az: 0.92,  len: 0.145, wid: 0.098, pitch: 0.62, young: false },
        { t: 0.98, az: 0.18,  len: 0.112, wid: 0.078, pitch: 0.88, young: true },
        { t: 0.99, az: 2.35,  len: 0.098, wid: 0.068, pitch: 0.95, young: true },
      ],
    },
    {
      name: 'branch_1',
      origin: new THREE.Vector3(0.003, 0.625, 0.006),
      pts: [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(-0.038, 0.072, 0.018),
        new THREE.Vector3(-0.072, 0.152, 0.028),
      ],
      baseR: 0.0092,
      leaves: [
        { t: 0.22, az: 2.65,  len: 0.210, wid: 0.138, pitch: 0.18, young: false },
        { t: 0.46, az: 3.85,  len: 0.192, wid: 0.128, pitch: 0.32, young: false },
        { t: 0.68, az: 2.05,  len: 0.170, wid: 0.115, pitch: 0.48, young: false },
        { t: 0.86, az: 3.18,  len: 0.142, wid: 0.096, pitch: 0.66, young: false },
        { t: 0.98, az: 2.48,  len: 0.108, wid: 0.074, pitch: 0.92, young: true },
      ],
    },
    {
      name: 'branch_2',
      origin: new THREE.Vector3(0.008, 0.590, 0.002),
      pts: [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.008, 0.052, -0.038),
        new THREE.Vector3(0.014, 0.115, -0.074),
      ],
      baseR: 0.0086,
      leaves: [
        { t: 0.28, az: 4.55,  len: 0.200, wid: 0.132, pitch: 0.16, young: false },
        { t: 0.54, az: 5.55,  len: 0.184, wid: 0.122, pitch: 0.34, young: false },
        { t: 0.78, az: 3.95,  len: 0.158, wid: 0.106, pitch: 0.52, young: false },
        { t: 0.96, az: 4.90,  len: 0.115, wid: 0.080, pitch: 0.85, young: true },
      ],
    },
  ];

  const attachFiddleLeaf = (parent, nodePos, spec) => {
    const ca = Math.cos(spec.az);
    const sa = Math.sin(spec.az);
    const petLen = 0.026 + (spec.len / 0.21) * 0.024;

    const p0 = nodePos.clone();
    const p1 = nodePos.clone().add(new THREE.Vector3(ca * petLen * 0.55, petLen * (0.28 + spec.pitch * 0.32), sa * petLen * 0.55));
    const p2 = nodePos.clone().add(new THREE.Vector3(ca * petLen, petLen * (0.42 + spec.pitch * 0.45), sa * petLen));

    const petGeo = makeTaperedTube(THREE, new THREE.CatmullRomCurve3([p0, p1, p2]), {
      segments: 8,
      radialSegments: 7,
      radiusFn: (t) => 0.0038 * (1 - 0.35 * t),
      capStart: true,
      capEnd: true,
    });
    const petMesh = new THREE.Mesh(petGeo, petioleMat);
    petMesh.castShadow = true;
    parent.add(petMesh);

    const asym = (rng() - 0.5) * 0.85;
    const shape = makeFiddleLeafShape(THREE, spec.len, spec.wid, asym);
    const ruffleAmp = 0.011 + rng() * 0.006;
    const rufflePhase = rng() * Math.PI * 2;
    const archAmp = 0.020 + rng() * 0.014;
    const cupAmp = 0.015 + rng() * 0.008;
    const twistAmp = (rng() - 0.5) * 0.012;

    const leaf = buildSculptedLeaf(
      THREE,
      shape,
      {
        depth: 0.0024,
        bevelThickness: 0.0012,
        bevelSize: 0.0012,
        bevelSegments: 2,
        curveSegments: 10,
        maxEdgeLen: 0.024,
        maxTris: 1400,
        veinStart: 0.004,
        veinEndRatio: 0.94,
        veinBaseRadius: 0.0035 * (spec.len / 0.20),
        veinTipRadius: 0.0005,
        veinZOffset: -0.0018,
        bendFn: (x, y, z, u, v, maxY) => {
          // Iconic quilted boat-cupped fiddle leaf with ruffled wavy edges
          const longZ = archAmp * Math.sin(v * Math.PI) - 0.032 * v * v;
          const cupZ = cupAmp * Math.pow(Math.abs(u), 1.35) * (0.55 + 0.45 * Math.sin(v * Math.PI));
          const ruffleZ = ruffleAmp * Math.sin(v * 11.5 + rufflePhase) * (u * u) * Math.min(1, v * 1.4);
          const twistZ = twistAmp * u * v;
          const shrinkY = -Math.abs(longZ) * 0.14 * v;
          return {
            dx: 0,
            dy: shrinkY * (maxY / 0.18),
            dz: longZ + cupZ + ruffleZ + twistZ,
          };
        },
      },
      spec.young ? youngMat : matureMat,
      veinMat
    );

    const leafFwd = new THREE.Vector3(ca, spec.pitch, sa).normalize();
    orientLeafGroup(THREE, leaf, p2, leafFwd, new THREE.Vector3(0, 1, 0), (rng() - 0.5) * 0.26);
    parent.add(leaf);
  };

  // Add 4 large lush lower leaves along the upper trunk just below the fork
  const trunkLeaves = [
    { yT: 0.62, az: 0.95,  len: 0.215, wid: 0.142, pitch: 0.08, young: false },
    { yT: 0.72, az: 3.12,  len: 0.210, wid: 0.138, pitch: 0.12, young: false },
    { yT: 0.80, az: 5.18,  len: 0.205, wid: 0.135, pitch: 0.15, young: false },
    { yT: 0.88, az: 1.98,  len: 0.195, wid: 0.128, pitch: 0.20, young: false },
  ];
  for (const tl of trunkLeaves) {
    attachFiddleLeaf(foliage, trunkCurve.getPoint(tl.yT), tl);
  }

  // Build each woody branch + its clustered spiral leaves
  branchDefs.forEach((bDef, bIdx) => {
    const bGroup = new THREE.Group();
    bGroup.name = bDef.name;
    bGroup.position.copy(bDef.origin);

    const bCurve = new THREE.CatmullRomCurve3(bDef.pts);
    const bGeo = makeTaperedTube(THREE, bCurve, {
      segments: 14,
      radialSegments: 10,
      radiusFn: (t) => bDef.baseR * (1 - 0.48 * t),
      capStart: true,
      capEnd: true,
    });
    const bMesh = new THREE.Mesh(bGeo, barkMat);
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    bGroup.add(bMesh);

    // Small brownish apical bud tip at branch end
    const tipPt = bCurve.getPoint(1);
    const tipTan = bCurve.getTangent(1);
    const budCurve = new THREE.CatmullRomCurve3([
      tipPt.clone(),
      tipPt.clone().addScaledVector(tipTan, 0.022),
    ]);
    const budGeo = makeTaperedTube(THREE, budCurve, {
      segments: 6,
      radialSegments: 7,
      radiusFn: (t) => 0.0046 * (1 - 0.85 * t),
      capStart: true,
      capEnd: true,
    });
    const budMesh = new THREE.Mesh(budGeo, barkMat);
    bGroup.add(budMesh);

    for (const lSpec of bDef.leaves) {
      attachFiddleLeaf(bGroup, bCurve.getPoint(lSpec.t), lSpec);
    }

    foliage.add(bGroup);
    swayItems.push({
      obj: bGroup,
      baseRotX: bGroup.rotation.x,
      baseRotY: bGroup.rotation.y,
      baseRotZ: bGroup.rotation.z,
      amp: 0.016 + bIdx * 0.004,
      speed: 0.85 + bIdx * 0.22,
      phase: bIdx * 1.4,
    });
  });

  return foliage;
}

// ---------------------------------------------------------------------------
// Variant 2: Trailing Golden Pothos (Lush Crown + Cascading Spilling Vines)
// ---------------------------------------------------------------------------

/**
 * Draws a sleek heart-shaped (cordate) pothos leaf with pointed drip-tip.
 */
function makePothosLeafShape(THREE, length, width, tipCurve = 0) {
  const L = length;
  const W = width * 0.5;
  const shape = new THREE.Shape();

  shape.moveTo(0, 0.02 * L);
  // Right rounded cordate cheek -> graceful curve -> pointed drip-tip
  shape.bezierCurveTo(
    0.34 * W, -0.14 * L,
    0.98 * W, -0.02 * L,
    0.96 * W, 0.30 * L
  );
  shape.bezierCurveTo(
    0.94 * W, 0.58 * L,
    0.42 * W + tipCurve * 0.16 * W, 0.84 * L,
    tipCurve * 0.18 * W, L
  );
  // Left side returning smoothly to basal notch
  shape.bezierCurveTo(
    -0.42 * W + tipCurve * 0.16 * W, 0.84 * L,
    -0.94 * W, 0.58 * L,
    -0.96 * W, 0.30 * L
  );
  shape.bezierCurveTo(
    -0.98 * W, -0.02 * L,
    -0.34 * W, -0.14 * L,
    0, 0.02 * L
  );

  return shape;
}

function buildPothos(THREE, kit, accentHex, rng, swayItems) {
  const foliage = new THREE.Group();
  foliage.name = 'foliage';

  const leafMatA = makeLeafMaterial(THREE, kit, 'pothosRich', accentHex, 0.9);
  const leafMatB = makeLeafMaterial(THREE, kit, 'pothos', accentHex, 3.7);
  const vineMat = makeStemMaterial(THREE, 0x45803b, 0.44);
  const veinMat = makeStemMaterial(THREE, 0x82b85e, 0.42);
  const coirMat = makeBarkMaterial(THREE, kit, true);

  // Subtle cozy coir-wrapped climbing totem rising from the soil so climbing
  // stems lift the silhouette to ~0.86 m while trailing vines spill over the pot
  const poleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.012, 0.31, -0.018),
    new THREE.Vector3(-0.016, 0.48, -0.022),
    new THREE.Vector3(-0.010, 0.64, -0.014),
    new THREE.Vector3(-0.004, 0.77, -0.008),
  ]);
  const poleGeo = makeTaperedTube(THREE, poleCurve, {
    segments: 18,
    radialSegments: 12,
    radiusFn: (t) => 0.0175 * (1 - 0.18 * t) + Math.sin(t * Math.PI * 10) * 0.0008,
    capStart: true,
    capEnd: true,
  });
  const poleMesh = new THREE.Mesh(poleGeo, coirMat);
  poleMesh.castShadow = true;
  poleMesh.receiveShadow = true;
  foliage.add(poleMesh);

  // Pre-build 10 distinct sculpted pothos leaf archetypes (individual shapes,
  // bends, and 3D midribs) to clone with varied scales & tilts across the vines
  const archetypes = [];
  for (let i = 0; i < 10; i++) {
    const len = 0.095 + (i % 4) * 0.012;
    const wid = len * (0.76 + (rng() - 0.5) * 0.12);
    const tipCurve = (rng() - 0.5) * 1.1;
    const shape = makePothosLeafShape(THREE, len, wid, tipCurve);
    const archAmt = 0.014 + rng() * 0.009;
    const droopAmt = 0.026 + rng() * 0.014;
    const cupAmt = 0.011 + rng() * 0.006;
    const twistAmt = (rng() - 0.5) * 0.010;

    const archetype = buildSculptedLeaf(
      THREE,
      shape,
      {
        depth: 0.0018,
        bevelThickness: 0.0009,
        bevelSize: 0.0009,
        bevelSegments: 2,
        curveSegments: 8,
        maxEdgeLen: 0.022,
        maxTris: 620,
        veinStart: 0.003,
        veinEndRatio: 0.90,
        veinBaseRadius: 0.0020,
        veinTipRadius: 0.0004,
        veinZOffset: -0.0012,
        bendFn: (x, y, z, u, v, maxY) => {
          const longZ = archAmt * Math.sin(v * Math.PI) - droopAmt * v * v;
          const cupZ = cupAmt * Math.abs(u) * (1 - 0.3 * v);
          const twistZ = twistAmt * u * v;
          const shrinkY = -Math.abs(longZ) * 0.14 * v;
          return {
            dx: 0,
            dy: shrinkY * (maxY / 0.10),
            dz: longZ + cupZ + twistZ,
          };
        },
      },
      i % 2 === 0 ? leafMatA : leafMatB,
      veinMat
    );
    archetypes.push(archetype);
  }

  let archCursor = 0;
  const placeLeafOnNode = (parent, nodePos, petDir, leafFwd, upHint, scale, roll) => {
    const petLen = 0.024 * scale;
    const p1 = nodePos.clone().addScaledVector(petDir, petLen * 0.55);
    p1.y += 0.006 * scale;
    const p2 = nodePos.clone().addScaledVector(petDir, petLen);

    const petGeo = makeTaperedTube(THREE, new THREE.CatmullRomCurve3([nodePos.clone(), p1, p2]), {
      segments: 6,
      radialSegments: 6,
      radiusFn: (t) => 0.0022 * scale * (1 - 0.35 * t),
      capStart: true,
      capEnd: true,
    });
    const petMesh = new THREE.Mesh(petGeo, vineMat);
    petMesh.castShadow = true;
    parent.add(petMesh);

    const leaf = archetypes[archCursor % archetypes.length].clone();
    archCursor++;
    leaf.scale.setScalar(scale);
    orientLeafGroup(THREE, leaf, p2, leafFwd, upHint, roll);
    parent.add(leaf);
  };

  // 1) 2 lush climbing vines twining upward around the coir totem to Y ~ 0.85 m
  for (let c = 0; c < 2; c++) {
    const pts = [];
    const startAng = c * Math.PI + 0.4;
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const center = poleCurve.getPoint(t);
      const ang = startAng + t * Math.PI * 2.5;
      const r = 0.022 + (1 - t) * 0.010;
      pts.push(new THREE.Vector3(
        center.x + Math.cos(ang) * r,
        center.y + (t === 1 ? 0.04 : 0),
        center.z + Math.sin(ang) * r
      ));
    }
    const cCurve = new THREE.CatmullRomCurve3(pts);
    const cGeo = makeTaperedTube(THREE, cCurve, {
      segments: 24,
      radialSegments: 7,
      radiusFn: (t) => 0.0040 * (1 - 0.38 * t),
      capStart: true,
      capEnd: true,
    });
    const cMesh = new THREE.Mesh(cGeo, vineMat);
    cMesh.castShadow = true;
    foliage.add(cMesh);

    const leavesOnClimb = 6;
    for (let k = 0; k < leavesOnClimb; k++) {
      const t = 0.16 + (k / (leavesOnClimb - 1)) * 0.82;
      const pt = cCurve.getPoint(t);
      const polePt = poleCurve.getPoint(Math.min(1, t));
      const out = new THREE.Vector3(pt.x - polePt.x, 0.28, pt.z - polePt.z).normalize();
      const fwd = out.clone().add(new THREE.Vector3(0, t > 0.82 ? 0.45 : 0.12, 0)).normalize();
      const sc = 0.92 + (1 - t) * 0.28;
      placeLeafOnNode(foliage, pt, out, fwd, new THREE.Vector3(0, 1, 0), sc, (rng() - 0.5) * 0.35);
    }
  }

  // 2) 5 bushy arching crown stems filling the top of the pot seamlessly
  for (let m = 0; m < 5; m++) {
    const a = (m / 5) * Math.PI * 2 + 0.3;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const sCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ca * 0.032, 0.34, sa * 0.032),
      new THREE.Vector3(ca * 0.068, 0.435 + (m % 2) * 0.035, sa * 0.068),
      new THREE.Vector3(ca * 0.115, 0.42 + (m % 2) * 0.025, sa * 0.115),
    ]);
    const sGeo = makeTaperedTube(THREE, sCurve, {
      segments: 12,
      radialSegments: 7,
      radiusFn: (t) => 0.0038 * (1 - 0.4 * t),
      capStart: true,
      capEnd: true,
    });
    const sMesh = new THREE.Mesh(sGeo, vineMat);
    sMesh.castShadow = true;
    foliage.add(sMesh);

    const tip = sCurve.getPoint(1);
    const out = new THREE.Vector3(ca, 0.25, sa).normalize();
    placeLeafOnNode(foliage, tip, out, new THREE.Vector3(ca, 0.05, sa).normalize(), new THREE.Vector3(0, 1, 0), 1.05 + rng() * 0.15, (rng() - 0.5) * 0.3);
  }

  // 3) 7 lush trailing vines spilling gracefully over the ceramic pot rim
  //    (azimuths chosen to drape cleanly between and around the stand legs!)
  const vineDefs = [
    { az: 0.10,  dropY: 0.06, leafCount: 6, rOut: 0.175, sway: 0.028 },
    { az: 1.05,  dropY: 0.13, leafCount: 5, rOut: 0.172, sway: 0.022 },
    { az: 1.72,  dropY: 0.09, leafCount: 6, rOut: 0.178, sway: -0.026 },
    { az: 2.82,  dropY: 0.18, leafCount: 4, rOut: 0.170, sway: 0.020 },
    { az: 3.60,  dropY: 0.11, leafCount: 5, rOut: 0.175, sway: -0.024 },
    { az: 4.82,  dropY: 0.15, leafCount: 5, rOut: 0.172, sway: 0.022 },
    { az: 5.72,  dropY: 0.07, leafCount: 6, rOut: 0.180, sway: -0.025 },
  ];

  vineDefs.forEach((vd, vIdx) => {
    const vineGroup = new THREE.Group();
    vineGroup.name = `vine_${vIdx}`;

    const ca = Math.cos(vd.az);
    const sa = Math.sin(vd.az);
    const px = -sa;
    const pz = ca;

    // Pivot right at the pot rim crest so gentle breeze swings the trailing drape naturally
    const pivot = new THREE.Vector3(ca * 0.132, 0.388, sa * 0.132);
    vineGroup.position.copy(pivot);

    // Inner soil-to-rim anchor stem (static in foliage group so base stays rooted)
    const anchorCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ca * 0.048, 0.340, sa * 0.048),
      new THREE.Vector3(ca * 0.095, 0.398, sa * 0.095),
      pivot.clone(),
    ]);
    const anchorGeo = makeTaperedTube(THREE, anchorCurve, {
      segments: 10,
      radialSegments: 7,
      radiusFn: () => 0.0038,
      capStart: true,
      capEnd: true,
    });
    const anchorMesh = new THREE.Mesh(anchorGeo, vineMat);
    anchorMesh.castShadow = true;
    foliage.add(anchorMesh);

    // Cascading trailing vine in local coordinates relative to pivot
    const dropSpan = 0.388 - vd.dropY;
    const pts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(ca * (vd.rOut - 0.132) * 0.85, -dropSpan * 0.16, sa * (vd.rOut - 0.132) * 0.85),
      new THREE.Vector3(
        ca * (vd.rOut - 0.132 + 0.012) + px * vd.sway,
        -dropSpan * 0.45,
        sa * (vd.rOut - 0.132 + 0.012) + pz * vd.sway
      ),
      new THREE.Vector3(
        ca * (vd.rOut - 0.132 + 0.020) - px * vd.sway * 0.7,
        -dropSpan * 0.75,
        sa * (vd.rOut - 0.132 + 0.020) - pz * vd.sway * 0.7
      ),
      new THREE.Vector3(
        ca * (vd.rOut - 0.132 + 0.032) + px * vd.sway * 0.4,
        -dropSpan,
        sa * (vd.rOut - 0.132 + 0.032) + pz * vd.sway * 0.4
      ),
    ];

    const vCurve = new THREE.CatmullRomCurve3(pts);
    const vGeo = makeTaperedTube(THREE, vCurve, {
      segments: 20,
      radialSegments: 7,
      radiusFn: (t) => 0.0038 * (1 - 0.52 * t),
      capStart: true,
      capEnd: true,
    });
    const vMesh = new THREE.Mesh(vGeo, vineMat);
    vMesh.castShadow = true;
    vineGroup.add(vMesh);

    // Alternating heart leaves cascading along the hanging vine
    for (let k = 0; k < vd.leafCount; k++) {
      const t = 0.08 + (k / (vd.leafCount - 0.65)) * 0.88;
      const pt = vCurve.getPoint(Math.min(0.99, t));
      const side = (k % 2 === 0 ? 1 : -1) * 0.52;
      const outDir = new THREE.Vector3(
        ca + px * side,
        0.08 - t * 0.25,
        sa + pz * side
      ).normalize();

      // Leaf blade drapes outward-and-downward while facing light/viewer
      const leafFwd = new THREE.Vector3(
        ca * 0.75 + px * side * 0.65,
        -0.55 - t * 0.22,
        sa * 0.75 + pz * side * 0.65
      ).normalize();
      const upHint = new THREE.Vector3(ca, 0.72, sa).normalize();

      const sc = (1.06 - t * 0.34) * (0.92 + rng() * 0.16);
      placeLeafOnNode(vineGroup, pt, outDir, leafFwd, upHint, sc, side * 0.35);
    }

    foliage.add(vineGroup);
    swayItems.push({
      obj: vineGroup,
      baseRotX: vineGroup.rotation.x,
      baseRotY: vineGroup.rotation.y,
      baseRotZ: vineGroup.rotation.z,
      amp: 0.032 + (dropSpan * 0.04),
      speed: 1.05 + rng() * 0.35,
      phase: vIdx * 0.95,
    });
  });

  return foliage;
}

// ---------------------------------------------------------------------------
// Main Module Exports: build & idle
// ---------------------------------------------------------------------------

export function build(THREE, opts = {}, kit) {
  const primary = opts.primary != null ? opts.primary : '#d9845b';
  const accent = opts.accent != null ? opts.accent : '#f2e6d0';
  const wood = opts.wood != null ? opts.wood : '#8c5a3c';
  const variant = ((Math.floor(opts.variant != null ? opts.variant : 0) % 3) + 3) % 3;

  const rng = makeRng(1337 + variant * 7919);

  const root = new THREE.Group();
  root.name = 'houseplant';

  const potMat = makePotMaterial(THREE, kit, primary, accent);
  const woodMat = makeWoodMaterial(THREE, kit, wood);
  const soilMat = makeSoilMaterial(THREE, kit);
  const padMat = new THREE.MeshPhysicalMaterial({
    color: 0x2b2420,
    roughness: 0.95,
    metalness: 0.0,
    sheen: 0.55,
    sheenColor: new THREE.Color(0x4c423b),
  });

  const stand = buildStand(THREE, woodMat, padMat);
  const pot = buildPot(THREE, potMat);
  const soil = buildSoil(THREE, kit, soilMat, rng);

  const swayItems = [];
  let foliage;
  if (variant === 0) {
    foliage = buildMonstera(THREE, kit, accent, rng, swayItems);
  } else if (variant === 1) {
    foliage = buildFiddleLeafFig(THREE, kit, accent, rng, swayItems);
  } else {
    foliage = buildPothos(THREE, kit, accent, rng, swayItems);
  }

  root.add(stand);
  root.add(pot);
  root.add(soil);
  root.add(foliage);

  root.userData.variant = variant;
  root.userData.foliage = foliage;
  root.userData.swayItems = swayItems;

  return root;
}

export function idle(group, t) {
  if (!group || !group.userData) return;

  const breeze = Math.sin(t * 0.82) * 0.65 + Math.sin(t * 1.75 + 0.6) * 0.35;

  const foliage = group.userData.foliage;
  if (foliage) {
    foliage.rotation.z = breeze * 0.010;
    foliage.rotation.x = Math.sin(t * 0.64 + 1.1) * 0.008;
  }

  const items = group.userData.swayItems;
  if (items) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const wave = Math.sin(t * it.speed + it.phase) * 0.68 + breeze * 0.32;
      const cross = Math.cos(t * (it.speed * 0.78) + it.phase * 1.3);
      it.obj.rotation.x = it.baseRotX + wave * it.amp;
      it.obj.rotation.z = it.baseRotZ + cross * it.amp * 0.72;
      it.obj.rotation.y = it.baseRotY + Math.sin(t * 0.55 + it.phase) * it.amp * 0.25;
    }
  }
}
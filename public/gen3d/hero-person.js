export const META = {
  id: 'chibi-student',
  name: 'Cozy Dorm Chibi Student',
  kind: 'character',
  footprint: [0.46, 0.42],
  variants: {
    hairStyle: ['short', 'bob', 'longStraight', 'curly', 'ponytail', 'afro', 'braids', 'buzz'],
    top: ['hoodie', 'tee', 'shirt', 'cardigan'],
    bottom: ['trousers', 'shorts', 'skirt'],
    glasses: ['none', 'round', 'square'],
    expressions: ['asleep', 'awake', 'thinking', 'unsure', 'happy'],
  },
  note: 'Hero-quality 1.1 m sculpted stylised chibi student with layered hair, thick draped clothing, expressive face, and idle animation.',
};

// ---------------------------------------------------------------------------
// Colour & Math Helpers
// ---------------------------------------------------------------------------

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function makeColor(THREE, val, fallback) {
  const c = new THREE.Color();
  try {
    c.set(val !== undefined && val !== null ? val : fallback);
  } catch {
    c.set(fallback);
  }
  return c;
}

function shiftColor(THREE, baseColor, dh, ds, dl) {
  const c = baseColor.clone();
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(
    (hsl.h + dh + 1) % 1,
    clamp(hsl.s + ds, 0, 1),
    clamp(hsl.l + dl, 0.02, 0.98)
  );
  return c;
}

function cssColor(c, alpha) {
  const r = Math.round(clamp(c.r, 0, 1) * 255);
  const g = Math.round(clamp(c.g, 0, 1) * 255);
  const b = Math.round(clamp(c.b, 0, 1) * 255);
  return alpha === undefined ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

function tagSlot(mesh, slot, cast = true, receive = true) {
  if (slot) mesh.userData.slot = slot;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

// ---------------------------------------------------------------------------
// Procedural Geometry Builders
// ---------------------------------------------------------------------------

function computeParallelFrames(THREE, curve, segments, upHint) {
  const pts = [];
  const tangents = [];
  const normals = [];
  const binormals = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    pts.push(curve.getPoint(t));
    tangents.push(curve.getTangent(t).normalize());
  }

  let n = new THREE.Vector3();
  const hint = (upHint ? upHint.clone() : new THREE.Vector3(0, 0, 1)).normalize();
  n.crossVectors(hint, tangents[0]);
  if (n.lengthSq() < 1e-5) {
    const alt = Math.abs(tangents[0].x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    n.crossVectors(alt, tangents[0]);
  }
  n.normalize();
  let b = new THREE.Vector3().crossVectors(tangents[0], n).normalize();
  normals.push(n.clone());
  binormals.push(b.clone());

  const axis = new THREE.Vector3();
  const q = new THREE.Quaternion();
  for (let i = 1; i <= segments; i++) {
    axis.crossVectors(tangents[i - 1], tangents[i]);
    const sinA = axis.length();
    if (sinA > 1e-6) {
      axis.divideScalar(sinA);
      const cosA = clamp(tangents[i - 1].dot(tangents[i]), -1, 1);
      q.setFromAxisAngle(axis, Math.atan2(sinA, cosA));
      n = n.clone().applyQuaternion(q);
    } else {
      n = n.clone();
    }
    n.addScaledVector(tangents[i], -n.dot(tangents[i])).normalize();
    b = new THREE.Vector3().crossVectors(tangents[i], n).normalize();
    normals.push(n.clone());
    binormals.push(b.clone());
  }

  return { pts, tangents, normals, binormals };
}

function buildTaperedTube(THREE, curve, segments, radialSegments, radiusFn, opts = {}) {
  const capStart = opts.capStart !== undefined ? opts.capStart : true;
  const capEnd = opts.capEnd !== undefined ? opts.capEnd : true;
  const uvScaleU = opts.uvScaleU || 1;
  const uvScaleV = opts.uvScaleV || 1;
  const { pts, normals, binormals } = computeParallelFrames(THREE, curve, segments, opts.upHint);

  const positions = [];
  const uvs = [];
  const indices = [];
  const ringStride = radialSegments + 1;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = pts[i];
    const n = normals[i];
    const b = binormals[i];
    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const angle = u * Math.PI * 2;
      const rSpec = radiusFn(t, angle);
      let rn, rb;
      if (typeof rSpec === 'number') {
        rn = rSpec;
        rb = rSpec;
      } else {
        rn = rSpec[0];
        rb = rSpec[1];
      }
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      const vx = p.x + n.x * (ca * rn) + b.x * (sa * rb);
      const vy = p.y + n.y * (ca * rn) + b.y * (sa * rb);
      const vz = p.z + n.z * (ca * rn) + b.z * (sa * rb);
      positions.push(vx, vy, vz);
      uvs.push(u * uvScaleU, t * uvScaleV);
    }
  }

  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const i00 = i * ringStride + j;
      const i01 = i00 + 1;
      const i10 = (i + 1) * ringStride + j;
      const i11 = i10 + 1;
      indices.push(i00, i01, i11, i00, i11, i10);
    }
  }

  if (capStart) {
    const centerIdx = positions.length / 3;
    const p0 = pts[0];
    positions.push(p0.x, p0.y, p0.z);
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegments; j++) {
      indices.push(centerIdx, j + 1, j);
    }
  }

  if (capEnd) {
    const centerIdx = positions.length / 3;
    const p1 = pts[segments];
    positions.push(p1.x, p1.y, p1.z);
    uvs.push(0.5, 1);
    const base = segments * ringStride;
    for (let j = 0; j < radialSegments; j++) {
      indices.push(centerIdx, base + j, base + j + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function sculptSphere(THREE, radius, widthSegs, heightSegs, deformFn) {
  const geo = new THREE.SphereGeometry(radius, widthSegs, heightSegs);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const len = Math.hypot(x, y, z) || 1;
    const out = deformFn(x / len, y / len, z / len);
    pos.setXYZ(i, out[0], out[1], out[2]);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Solid double-walled thick clothing/hair shell with real hems and open edges
function buildThickShell(THREE, uSegs, vSegs, closedU, evalOuter, thicknessFn, uvScale = [1, 1]) {
  const cols = uSegs + 1;
  const rows = vSegs + 1;
  const outerPts = new Array(rows * cols);
  const innerPts = new Array(rows * cols);

  for (let iv = 0; iv <= vSegs; iv++) {
    const v = iv / vSegs;
    for (let iu = 0; iu <= uSegs; iu++) {
      const u = iu / uSegs;
      outerPts[iv * cols + iu] = evalOuter(u, v);
    }
  }

  const du = new THREE.Vector3();
  const dv = new THREE.Vector3();
  const norm = new THREE.Vector3();

  for (let iv = 0; iv <= vSegs; iv++) {
    const v = iv / vSegs;
    const ivPrev = Math.max(0, iv - 1);
    const ivNext = Math.min(vSegs, iv + 1);
    for (let iu = 0; iu <= uSegs; iu++) {
      const u = iu / uSegs;
      const iuPrev = closedU ? (iu - 1 + uSegs) % uSegs : Math.max(0, iu - 1);
      const iuNext = closedU ? (iu + 1) % uSegs : Math.min(uSegs, iu + 1);
      const pL = outerPts[iv * cols + iuPrev];
      const pR = outerPts[iv * cols + iuNext];
      const pD = outerPts[ivPrev * cols + iu];
      const pU = outerPts[ivNext * cols + iu];

      du.set(pR[0] - pL[0], pR[1] - pL[1], pR[2] - pL[2]);
      dv.set(pU[0] - pD[0], pU[1] - pD[1], pU[2] - pD[2]);
      norm.crossVectors(du, dv);
      const nl = norm.length();
      if (nl > 1e-7) {
        norm.divideScalar(nl);
      } else {
        const p = outerPts[iv * cols + iu];
        const pl = Math.hypot(p[0], p[2]) || 1;
        norm.set(p[0] / pl, 0, p[2] / pl);
      }
      const thick = typeof thicknessFn === 'function' ? thicknessFn(u, v) : thicknessFn;
      const p = outerPts[iv * cols + iu];
      innerPts[iv * cols + iu] = [
        p[0] - norm.x * thick,
        p[1] - norm.y * thick,
        p[2] - norm.z * thick,
      ];
    }
  }

  const positions = [];
  const uvs = [];
  const indices = [];

  // 1. Outer surface
  const outerOffset = 0;
  for (let iv = 0; iv <= vSegs; iv++) {
    const v = iv / vSegs;
    for (let iu = 0; iu <= uSegs; iu++) {
      const u = iu / uSegs;
      const p = outerPts[iv * cols + iu];
      positions.push(p[0], p[1], p[2]);
      uvs.push(u * uvScale[0], v * uvScale[1]);
    }
  }
  for (let iv = 0; iv < vSegs; iv++) {
    for (let iu = 0; iu < uSegs; iu++) {
      const a = outerOffset + iv * cols + iu;
      const b = a + 1;
      const c = a + cols + 1;
      const d = a + cols;
      indices.push(a, b, c, a, c, d);
    }
  }

  // 2. Inner surface (reversed winding)
  const innerOffset = positions.length / 3;
  for (let iv = 0; iv <= vSegs; iv++) {
    const v = iv / vSegs;
    for (let iu = 0; iu <= uSegs; iu++) {
      const u = iu / uSegs;
      const p = innerPts[iv * cols + iu];
      positions.push(p[0], p[1], p[2]);
      uvs.push(u * uvScale[0], v * uvScale[1]);
    }
  }
  for (let iv = 0; iv < vSegs; iv++) {
    for (let iu = 0; iu < uSegs; iu++) {
      const a = innerOffset + iv * cols + iu;
      const b = a + 1;
      const c = a + cols + 1;
      const d = a + cols;
      indices.push(a, c, b, a, d, c);
    }
  }

  // Helper to emit a crisp rim strip between two point arrays
  function addRim(arrA, arrB, flip) {
    const start = positions.length / 3;
    const n = arrA.length;
    for (let i = 0; i < n; i++) {
      const pA = arrA[i];
      const pB = arrB[i];
      positions.push(pA[0], pA[1], pA[2]);
      uvs.push(i / (n - 1), 0);
      positions.push(pB[0], pB[1], pB[2]);
      uvs.push(i / (n - 1), 0.06);
    }
    for (let i = 0; i < n - 1; i++) {
      const o0 = start + i * 2;
      const i0 = o0 + 1;
      const o1 = o0 + 2;
      const i1 = o0 + 3;
      if (!flip) {
        indices.push(o0, i0, i1, o0, i1, o1);
      } else {
        indices.push(o0, o1, i1, o0, i1, i0);
      }
    }
  }

  // Bottom hem (v = 0)
  const botOut = [];
  const botIn = [];
  for (let iu = 0; iu <= uSegs; iu++) {
    botOut.push(outerPts[iu]);
    botIn.push(innerPts[iu]);
  }
  addRim(botOut, botIn, false);

  // Top edge (v = 1)
  const topOut = [];
  const topIn = [];
  for (let iu = 0; iu <= uSegs; iu++) {
    topOut.push(outerPts[vSegs * cols + iu]);
    topIn.push(innerPts[vSegs * cols + iu]);
  }
  addRim(topOut, topIn, true);

  // Open side edges if not closed in U
  if (!closedU) {
    const leftOut = [];
    const leftIn = [];
    const rightOut = [];
    const rightIn = [];
    for (let iv = 0; iv <= vSegs; iv++) {
      leftOut.push(outerPts[iv * cols]);
      leftIn.push(innerPts[iv * cols]);
      rightOut.push(outerPts[iv * cols + uSegs]);
      rightIn.push(innerPts[iv * cols + uSegs]);
    }
    addRim(leftOut, leftIn, true);
    addRim(rightOut, rightIn, false);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Bezier-extruded hair lock bent smoothly along a 3D CatmullRomCurve3
function buildBezierLock(THREE, curvePts, width, thickness, opts = {}) {
  const curve = new THREE.CatmullRomCurve3(curvePts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  const lenSegs = opts.lenSegs || 18;
  const shape = new THREE.Shape();
  const hw = width * 0.5;
  const tipWidth = (opts.tipWidth !== undefined ? opts.tipWidth : 0.06) * hw;
  const rootWidth = (opts.rootWidth !== undefined ? opts.rootWidth : 0.85) * hw;
  const midBulge = (opts.midBulge !== undefined ? opts.midBulge : 1.12) * hw;

  shape.moveTo(-rootWidth, 0);
  shape.bezierCurveTo(-midBulge, 0.28, -midBulge * 0.92, 0.72, -tipWidth, 1.0);
  shape.bezierCurveTo(0, 1.04, 0, 1.04, tipWidth, 1.0);
  shape.bezierCurveTo(midBulge * 0.92, 0.72, midBulge, 0.28, rootWidth, 0);
  shape.closePath();

  const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.42,
    bevelSize: hw * 0.18,
    bevelSegments: 2,
    curveSegments: lenSegs,
    steps: 1,
  });

  // Re-subdivide / bend along curve: y in [0..1.04] maps to curve parameter t
  const frames = computeParallelFrames(THREE, curve, 48, opts.upHint || new THREE.Vector3(0, 0, 1));
  const pos = extrudeGeo.attributes.position;
  const uv = extrudeGeo.attributes.uv;
  const zCenter = thickness * 0.5;
  const twist = opts.twist || 0;

  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const lz = pos.getZ(i) - zCenter;

    const t = clamp(ly / 1.02, 0, 1);
    const fIdx = t * 48;
    const i0 = Math.min(47, Math.floor(fIdx));
    const frac = fIdx - i0;

    const pt = frames.pts[i0].clone().lerp(frames.pts[i0 + 1], frac);
    const n = frames.normals[i0].clone().lerp(frames.normals[i0 + 1], frac).normalize();
    const b = frames.binormals[i0].clone().lerp(frames.binormals[i0 + 1], frac).normalize();

    // Optional twist along lock length
    const ang = twist * t;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const wx = lx * ca - lz * sa;
    const wz = lx * sa + lz * ca;

    // Slight ridge arch across lock width so it feels sculpted, never flat
    const normX = clamp(lx / (hw || 1), -1, 1);
    const crown = (1 - normX * normX) * thickness * 0.35 * (1 - t * 0.6);

    // Taper thickness smoothly near tip
    const tThick = 1 - smoothstep(0.65, 1.0, t) * 0.72;
    const outZ = (wz + crown) * tThick;

    pos.setXYZ(
      i,
      pt.x + n.x * wx + b.x * outZ,
      pt.y + n.y * wx + b.y * outZ,
      pt.z + n.z * wx + b.z * outZ
    );
    if (uv) {
      uv.setXY(i, 0.5 + (lx / (width || 1)), t);
    }
  }
  pos.needsUpdate = true;
  if (uv) uv.needsUpdate = true;
  extrudeGeo.computeVertexNormals();
  return extrudeGeo;
}

// ---------------------------------------------------------------------------
// Head & Torso Analytical Sculpting Surfaces
// ---------------------------------------------------------------------------

// Head-local origin is at neck-head pivot (0, 0, 0); head center at (0, 0.202, 0)
const HEAD_CENTER_Y = 0.202;

function deformHeadVertex(nx, ny, nz) {
  let rx = 0.168;
  let ry = 0.198;
  let rz = 0.162;

  // Slightly fuller upper cranium dome
  const crown = smoothstep(0.1, 0.85, ny);
  rx += crown * 0.006;
  rz += crown * 0.006;

  // Plump rounded chibi cheeks (lower front-sides)
  const cheekY = Math.exp(-Math.pow((ny + 0.34) / 0.33, 2));
  const cheekFront = smoothstep(-0.22, 0.45, nz);
  const cheekSide = Math.exp(-Math.pow((Math.abs(nx) - 0.56) / 0.42, 2));
  const cheek = cheekY * cheekFront * cheekSide;

  let x = nx * rx + Math.sign(nx) * cheek * 0.022;
  let y = ny * ry;
  let z = nz * rz + cheek * 0.011;

  // Soft chin taper at bottom-front
  const jawBand = smoothstep(-0.35, -0.88, ny);
  x *= 1 - jawBand * 0.14;
  if (ny < -0.5) {
    const chinFront = smoothstep(-0.1, 0.7, nz) * smoothstep(-0.5, -0.95, ny);
    y -= chinFront * 0.005;
    z += chinFront * 0.012;
  }

  // Gently flatten underside toward neck
  if (ny < -0.72) {
    const under = smoothstep(-0.72, -1.0, ny);
    y += under * 0.014;
  }

  // Subtle nape tuck at back-bottom
  if (ny < -0.35 && nz < -0.25) {
    const nape = smoothstep(-0.35, -0.85, ny) * smoothstep(-0.25, -0.8, nz);
    z += nape * 0.012;
  }

  // Soft eye-socket recesses so eyes nestle naturally on the surface
  if (nz > 0.55) {
    const eyeL = Math.exp(-(Math.pow((nx - 0.36) / 0.21, 2) + Math.pow((ny + 0.10) / 0.19, 2)));
    const eyeR = Math.exp(-(Math.pow((nx + 0.36) / 0.21, 2) + Math.pow((ny + 0.10) / 0.19, 2)));
    const socket = (eyeL + eyeR) * smoothstep(0.55, 0.85, nz);
    z -= socket * 0.0075;
  }

  // Gentle brow fullness above eyes
  if (nz > 0.5) {
    const brow = Math.exp(-Math.pow((ny - 0.14) / 0.13, 2)) *
      Math.exp(-Math.pow(nx / 0.58, 2)) *
      smoothstep(0.5, 0.85, nz);
    z += brow * 0.004;
  }

  // Tiny cute sculpted button nose bump
  if (nz > 0.72) {
    const nose = Math.exp(-(Math.pow(nx / 0.105, 2) + Math.pow((ny + 0.255) / 0.095, 2))) *
      smoothstep(0.72, 0.92, nz);
    z += nose * 0.0155;
    y += nose * 0.0025;
  }

  // Subtle soft mouth cushion
  if (nz > 0.7) {
    const lip = Math.exp(-(Math.pow(nx / 0.18, 2) + Math.pow((ny + 0.48) / 0.10, 2))) *
      smoothstep(0.7, 0.9, nz);
    z += lip * 0.003;
  }

  return [x, y + HEAD_CENTER_Y, z];
}

function queryHeadSurface(THREE, nx, ny, nz) {
  const len = Math.hypot(nx, ny, nz) || 1;
  const ux = nx / len;
  const uy = ny / len;
  const uz = nz / len;
  const p = deformHeadVertex(ux, uy, uz);

  // Numerical surface tangent frame
  const eps = 0.015;
  const up = Math.abs(uy) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  const base = new THREE.Vector3(ux, uy, uz);
  const tRight = new THREE.Vector3().crossVectors(up, base).normalize();
  const tUp = new THREE.Vector3().crossVectors(base, tRight).normalize();

  const pR = deformHeadVertex(ux + tRight.x * eps, uy + tRight.y * eps, uz + tRight.z * eps);
  const pU = deformHeadVertex(ux + tUp.x * eps, uy + tUp.y * eps, uz + tUp.z * eps);

  const dR = new THREE.Vector3(pR[0] - p[0], pR[1] - p[1], pR[2] - p[2]).normalize();
  const dU = new THREE.Vector3(pU[0] - p[0], pU[1] - p[1], pU[2] - p[2]).normalize();
  const normal = new THREE.Vector3().crossVectors(dR, dU).normalize();
  const right = new THREE.Vector3().crossVectors(dU, normal).normalize();
  const upVec = new THREE.Vector3().crossVectors(normal, right).normalize();

  return {
    point: new THREE.Vector3(p[0], p[1], p[2]),
    normal,
    right,
    up: upVec,
  };
}

// Torso-local origin at world y = 0.505; spans roughly y in [-0.165, +0.150]
function deformTorsoVertex(nx, ny, nz) {
  // Soft pear/bean chibi torso with sloped shoulders and cosy hips
  const hipBulge = Math.exp(-Math.pow((ny + 0.52) / 0.42, 2));
  const waistTaper = Math.exp(-Math.pow((ny + 0.02) / 0.34, 2));
  const shoulderShelf = Math.exp(-Math.pow((ny - 0.58) / 0.32, 2));

  let rx = 0.110 + hipBulge * 0.014 - waistTaper * 0.008 + shoulderShelf * 0.020;
  let rz = 0.082 + hipBulge * 0.010 - waistTaper * 0.004 + shoulderShelf * 0.004;
  const ry = 0.156;

  // Taper top neatly into neck base
  const neckPinch = smoothstep(0.68, 0.98, ny);
  rx *= 1 - neckPinch * 0.42;
  rz *= 1 - neckPinch * 0.38;

  // Soft tummy rounding at front-lower, gentle lumbar hollow at back
  let x = nx * rx;
  let y = ny * ry;
  let z = nz * rz;

  if (nz > 0) {
    z += Math.exp(-Math.pow((ny + 0.25) / 0.45, 2)) * nz * 0.008;
  } else {
    z -= Math.exp(-Math.pow((ny + 0.48) / 0.35, 2)) * (-nz) * 0.006;
    z += Math.exp(-Math.pow((ny - 0.05) / 0.35, 2)) * (-nz) * 0.005;
  }

  return [x, y, z];
}

// Cylindrical torso profile helper for thick clothing shells
function evalTorsoRing(angle, yLocal, easeX, easeZ) {
  const ry = 0.156;
  const ny = clamp(yLocal / ry, -0.94, 0.92);
  const sinPhi = Math.sqrt(Math.max(0.02, 1 - ny * ny));
  const nx = Math.sin(angle) * sinPhi;
  const nz = Math.cos(angle) * sinPhi;
  const base = deformTorsoVertex(nx, ny, nz);

  // Expand cleanly outward by ease
  const horiz = Math.hypot(base[0], base[2]) || 0.001;
  const ux = base[0] / horiz;
  const uz = base[2] / horiz;
  return [
    base[0] + ux * easeX,
    yLocal,
    base[2] + uz * easeZ,
  ];
}

// ---------------------------------------------------------------------------
// Canvas Textures (kit.canvasTexture + kit.noise)
// ---------------------------------------------------------------------------

function makeTextures(THREE, opts, kit, colors) {
  const tex = {};

  // 1. Skin colour + soft micro-grain bump
  tex.skinMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const base = colors.skin;
    const warm = shiftColor(THREE, base, -0.015, 0.09, -0.03);
    const light = shiftColor(THREE, base, 0.005, -0.02, 0.045);

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, cssColor(light));
    g.addColorStop(0.55, cssColor(base));
    g.addColorStop(1, cssColor(warm));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Subtle organic peach-skin warmth variation
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const n = kit.noise(x * 0.035, y * 0.035);
        const alpha = (n - 0.5) * 0.06;
        ctx.fillStyle = alpha > 0 ? cssColor(light, alpha) : cssColor(warm, -alpha);
        ctx.fillRect(x, y, 4, 4);
      }
    }
  });
  tex.skinMap.colorSpace = THREE.SRGBColorSpace;

  tex.skinBump = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const n = kit.noise(x * 0.18, y * 0.18);
        const v = Math.round(118 + n * 20);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
  });

  // 2. Hair colour + strand/coil bump
  const isCoil = opts.hairStyle === 'afro' || opts.hairStyle === 'buzz';
  tex.hairMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const root = shiftColor(THREE, colors.hair, 0, 0.04, -0.08);
    const mid = colors.hair;
    const sheen = shiftColor(THREE, colors.hair, 0.015, -0.03, 0.11);

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, cssColor(root));
    g.addColorStop(0.45, cssColor(mid));
    g.addColorStop(0.75, cssColor(sheen));
    g.addColorStop(1, cssColor(mid));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    if (isCoil) {
      const step = opts.hairStyle === 'buzz' ? 3 : 5;
      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          const n = kit.noise(x * 0.22, y * 0.22);
          ctx.fillStyle = n > 0.52 ? cssColor(sheen, (n - 0.5) * 0.45) : cssColor(root, (0.55 - n) * 0.45);
          ctx.beginPath();
          ctx.arc(x + n * step, y + (1 - n) * step, step * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      // Fine brushed hair strands along V
      for (let i = 0; i < 160; i++) {
        const x = (i / 160) * w;
        const n = kit.noise(i * 0.37, 1.4);
        ctx.strokeStyle = n > 0.5 ? cssColor(sheen, 0.18 + (n - 0.5) * 0.35) : cssColor(root, 0.22);
        ctx.lineWidth = 1 + n * 2.2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (let y = 0; y <= h; y += 32) {
          const sway = (kit.noise(i * 0.25, y * 0.02) - 0.5) * 5;
          ctx.lineTo(x + sway, y);
        }
        ctx.stroke();
      }
    }
  });
  tex.hairMap.colorSpace = THREE.SRGBColorSpace;
  tex.hairMap.wrapS = THREE.RepeatWrapping;
  tex.hairMap.wrapT = THREE.RepeatWrapping;

  tex.hairBump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    if (isCoil) {
      const step = opts.hairStyle === 'buzz' ? 3 : 6;
      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          const n = kit.noise(x * 0.25, y * 0.25);
          const v = Math.round(70 + n * 135);
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.beginPath();
          ctx.arc(x, y, step * 0.55, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      for (let i = 0; i < 180; i++) {
        const x = (i / 180) * w;
        const n = kit.noise(i * 0.41, 3.1);
        const v = Math.round(70 + n * 130);
        ctx.strokeStyle = `rgb(${v},${v},${v})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + (n - 0.5) * 4, h);
        ctx.stroke();
      }
    }
  });
  tex.hairBump.wrapS = THREE.RepeatWrapping;
  tex.hairBump.wrapT = THREE.RepeatWrapping;

  // 3. Top fabric weave (bespoke per top style)
  tex.topMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const base = colors.top;
    const dark = shiftColor(THREE, base, 0, 0.03, -0.07);
    const light = shiftColor(THREE, base, 0, -0.02, 0.06);

    ctx.fillStyle = cssColor(base);
    ctx.fillRect(0, 0, w, h);

    if (opts.top === 'cardigan') {
      // Chunky vertical rib knit columns
      const cols = 32;
      const cw = w / cols;
      for (let i = 0; i < cols; i++) {
        ctx.fillStyle = i % 2 === 0 ? cssColor(light, 0.25) : cssColor(dark, 0.24);
        ctx.fillRect(i * cw, 0, cw * 0.65, h);
      }
      ctx.strokeStyle = cssColor(dark, 0.16);
      ctx.lineWidth = 1;
      for (let y = 0; y < h; y += 6) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += cw) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + cw * 0.5, y + 3);
          ctx.lineTo(x + cw, y);
        }
        ctx.stroke();
      }
    } else if (opts.top === 'shirt') {
      // Crisp Oxford poplin subtle micro-check weave
      ctx.fillStyle = cssColor(light, 0.15);
      for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1.5);
      ctx.fillStyle = cssColor(dark, 0.11);
      for (let x = 0; x < w; x += 4) ctx.fillRect(x, 0, 1.5, h);
    } else if (opts.top === 'tee') {
      // Soft jersey knit with subtle cozy melange heather
      for (let y = 0; y < h; y += 3) {
        for (let x = 0; x < w; x += 4) {
          const n = kit.noise(x * 0.16, y * 0.25);
          ctx.fillStyle = n > 0.5 ? cssColor(light, (n - 0.5) * 0.24) : cssColor(dark, (0.5 - n) * 0.24);
          ctx.fillRect(x, y, 4, 2);
        }
      }
    } else {
      // Cozy brushed fleece hoodie texture
      for (let y = 0; y < h; y += 3) {
        for (let x = 0; x < w; x += 3) {
          const n = kit.noise(x * 0.12, y * 0.12);
          ctx.fillStyle = n > 0.5 ? cssColor(light, (n - 0.5) * 0.28) : cssColor(dark, (0.5 - n) * 0.28);
          ctx.fillRect(x, y, 3, 3);
        }
      }
    }
  });
  tex.topMap.colorSpace = THREE.SRGBColorSpace;
  tex.topMap.wrapS = THREE.RepeatWrapping;
  tex.topMap.wrapT = THREE.RepeatWrapping;
  tex.topMap.repeat.set(2, 2);

  tex.topBump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    if (opts.top === 'cardigan') {
      const cols = 32;
      const cw = w / cols;
      for (let i = 0; i < cols; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#b8b8b8' : '#585858';
        ctx.fillRect(i * cw, 0, cw * 0.6, h);
      }
    } else {
      for (let y = 0; y < h; y += 4) {
        for (let x = 0; x < w; x += 4) {
          const weave = ((x + y) % 8 === 0) ? 148 : 112;
          const n = kit.noise(x * 0.2, y * 0.2) * 24 - 12;
          const v = Math.round(clamp(weave + n, 60, 200));
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(x, y, 4, 4);
        }
      }
    }
  });
  tex.topBump.wrapS = THREE.RepeatWrapping;
  tex.topBump.wrapT = THREE.RepeatWrapping;
  tex.topBump.repeat.set(2, 2);

  // 4. Bottom fabric weave (twill / denim / cosy wool)
  tex.bottomMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const base = colors.bottom;
    const dark = shiftColor(THREE, base, 0, 0.04, -0.075);
    const light = shiftColor(THREE, base, 0, -0.02, 0.065);
    ctx.fillStyle = cssColor(base);
    ctx.fillRect(0, 0, w, h);

    if (opts.bottom === 'skirt') {
      // Cozy subtle dorm tartan / wool plaid weave
      ctx.fillStyle = cssColor(dark, 0.26);
      for (let i = 0; i < w; i += 32) ctx.fillRect(i, 0, 8, h);
      for (let i = 0; i < h; i += 32) ctx.fillRect(0, i, w, 8);
      ctx.fillStyle = cssColor(light, 0.22);
      for (let i = 16; i < w; i += 32) ctx.fillRect(i, 0, 2, h);
      for (let i = 16; i < h; i += 32) ctx.fillRect(0, i, w, 2);
    } else {
      // Diagonal denim/twill weave
      ctx.strokeStyle = cssColor(light, 0.16);
      ctx.lineWidth = 1.5;
      for (let i = -h; i < w + h; i += 5) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + h, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 4) {
        for (let x = 0; x < w; x += 4) {
          const n = kit.noise(x * 0.15, y * 0.15);
          ctx.fillStyle = cssColor(dark, (n - 0.5) * 0.2);
          ctx.fillRect(x, y, 4, 4);
        }
      }
    }
  });
  tex.bottomMap.colorSpace = THREE.SRGBColorSpace;
  tex.bottomMap.wrapS = THREE.RepeatWrapping;
  tex.bottomMap.wrapT = THREE.RepeatWrapping;
  tex.bottomMap.repeat.set(2, 2);

  tex.bottomBump = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#a2a2a2';
    ctx.lineWidth = 1.2;
    for (let i = -h; i < w + h; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h, h);
      ctx.stroke();
    }
  });
  tex.bottomBump.wrapS = THREE.RepeatWrapping;
  tex.bottomBump.wrapT = THREE.RepeatWrapping;
  tex.bottomBump.repeat.set(3, 3);

  // 5. Painted expressive chibi iris texture
  tex.irisMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const r = w * 0.47;

    const eyeBase = colors.eye;
    const deep = shiftColor(THREE, eyeBase, 0, 0.1, -0.26);
    const bright = shiftColor(THREE, eyeBase, 0.03, 0.12, 0.22);

    ctx.clearRect(0, 0, w, h);

    // Outer limbal ring
    const baseGrad = ctx.createRadialGradient(cx, cy, r * 0.18, cx, cy, r);
    baseGrad.addColorStop(0, cssColor(deep));
    baseGrad.addColorStop(0.55, cssColor(eyeBase));
    baseGrad.addColorStop(0.84, cssColor(deep));
    baseGrad.addColorStop(1, '#121016');
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Glowing lower crescent reflection inside iris
    const glowGrad = ctx.createRadialGradient(cx, cy + r * 0.42, 4, cx, cy + r * 0.36, r * 0.62);
    glowGrad.addColorStop(0, cssColor(bright, 0.92));
    glowGrad.addColorStop(0.6, cssColor(eyeBase, 0.35));
    glowGrad.addColorStop(1, cssColor(eyeBase, 0));
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2);
    ctx.fill();

    // Delicate radial iris fibres
    ctx.save();
    ctx.translate(cx, cy);
    for (let i = 0; i < 42; i++) {
      const a = (i / 42) * Math.PI * 2;
      const n = kit.noise(i * 0.7, 2.3);
      ctx.strokeStyle = n > 0.5 ? cssColor(bright, 0.28) : cssColor(deep, 0.32);
      ctx.lineWidth = 1.6 + n * 2.0;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.34, Math.sin(a) * r * 0.34);
      ctx.lineTo(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86);
      ctx.stroke();
    }
    ctx.restore();

    // Soft upper eyelid shadow
    const lidGrad = ctx.createLinearGradient(0, cy - r, 0, cy + r * 0.1);
    lidGrad.addColorStop(0, 'rgba(12,10,18,0.82)');
    lidGrad.addColorStop(0.65, 'rgba(12,10,18,0.22)');
    lidGrad.addColorStop(1, 'rgba(12,10,18,0)');
    ctx.fillStyle = lidGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Deep glossy pupil
    ctx.fillStyle = '#120f17';
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.04, r * 0.36, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  tex.irisMap.colorSpace = THREE.SRGBColorSpace;

  // 6. Soft rosy cheek blush
  tex.blushMap = kit.canvasTexture(128, 128, (ctx, w, h) => {
    const blushCol = shiftColor(THREE, colors.skin, -0.04, 0.35, -0.06);
    // Push toward soft coral-pink
    blushCol.lerp(new THREE.Color('#f0727a'), 0.65);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 4, w * 0.5, h * 0.5, w * 0.48);
    g.addColorStop(0, cssColor(blushCol, 0.62));
    g.addColorStop(0.5, cssColor(blushCol, 0.32));
    g.addColorStop(1, cssColor(blushCol, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  tex.blushMap.colorSpace = THREE.SRGBColorSpace;

  // 7. Shoe upper canvas & sole rubber tread bump
  tex.shoeMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const base = colors.shoe;
    const dark = shiftColor(THREE, base, 0, 0.04, -0.08);
    const light = shiftColor(THREE, base, 0, -0.02, 0.07);
    ctx.fillStyle = cssColor(base);
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 3) {
        const n = kit.noise(x * 0.18, y * 0.18);
        ctx.fillStyle = n > 0.5 ? cssColor(light, 0.16) : cssColor(dark, 0.16);
        ctx.fillRect(x, y, 3, 3);
      }
    }
  });
  tex.shoeMap.colorSpace = THREE.SRGBColorSpace;

  tex.soleBump = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#b4b4b4';
    for (let y = 0; y < h; y += 12) {
      ctx.fillRect(0, y, w, 5);
    }
  });
  tex.soleBump.wrapS = THREE.RepeatWrapping;
  tex.soleBump.wrapT = THREE.RepeatWrapping;

  return tex;
}

// ---------------------------------------------------------------------------
// Face, Ears, Blush & Glasses
// ---------------------------------------------------------------------------

function buildEars(THREE, mats) {
  const earGroupL = new THREE.Group();
  earGroupL.name = 'earL';
  const earGroupR = new THREE.Group();
  earGroupR.name = 'earR';

  function makeSingleEar(side) {
    const g = new THREE.Group();

    // Sculpted curved outer ear via bezier ExtrudeGeometry + vertex dishing
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.026);
    shape.bezierCurveTo(0.024, -0.032, 0.038, -0.004, 0.032, 0.022);
    shape.bezierCurveTo(0.026, 0.044, -0.002, 0.044, -0.012, 0.024);
    shape.bezierCurveTo(-0.016, 0.006, -0.014, -0.020, 0, -0.026);

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.010,
      bevelEnabled: true,
      bevelThickness: 0.0055,
      bevelSize: 0.0045,
      bevelSegments: 3,
      curveSegments: 18,
    });
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      const y = pos.getY(i);
      let z = pos.getZ(i) - 0.005;

      // Cup ear gently backward along z and dish front concha bowl
      const rOut = Math.max(0, x);
      z -= rOut * rOut * 14.0;
      if (z > 0) {
        const bowl = Math.exp(-(Math.pow((x - 0.011) / 0.013, 2) + Math.pow((y - 0.004) / 0.018, 2)));
        z -= bowl * 0.0075;
      }
      pos.setXYZ(i, x * side, y, z);
    }
    pos.needsUpdate = true;
    // Flip face winding when mirrored on -X side
    if (side < 0) {
      const idx = geo.index;
      if (idx) {
        for (let i = 0; i < idx.count; i += 3) {
          const b = idx.getX(i + 1);
          idx.setX(i + 1, idx.getX(i + 2));
          idx.setX(i + 2, b);
        }
        idx.needsUpdate = true;
      } else {
        for (let i = 0; i < pos.count; i += 3) {
          const ax = pos.getX(i + 1), ay = pos.getY(i + 1), az = pos.getZ(i + 1);
          pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
          pos.setXYZ(i + 2, ax, ay, az);
        }
        pos.needsUpdate = true;
      }
    }
    geo.computeVertexNormals();
    g.add(tagSlot(new THREE.Mesh(geo, mats.skin), 'skin'));

    // Soft rosy inner-ear concha contour
    const innerGeo = new THREE.SphereGeometry(0.014, 14, 12);
    innerGeo.scale(0.82, 1.25, 0.35);
    const innerMesh = tagSlot(new THREE.Mesh(innerGeo, mats.innerEar), 'skin', false, true);
    innerMesh.position.set(side * 0.011, 0.004, 0.0018);
    innerMesh.rotation.y = side * -0.18;
    g.add(innerMesh);

    return g;
  }

  earGroupL.add(makeSingleEar(1));
  earGroupL.position.set(0.160, HEAD_CENTER_Y - 0.036, -0.012);
  earGroupL.rotation.set(0.04, -0.32, -0.08);

  earGroupR.add(makeSingleEar(-1));
  earGroupR.position.set(-0.160, HEAD_CENTER_Y - 0.036, -0.012);
  earGroupR.rotation.set(0.04, 0.32, 0.08);

  return { earGroupL, earGroupR };
}

function buildFaceFeatures(THREE, opts, mats) {
  const face = {
    eyeL: new THREE.Group(),
    eyeR: new THREE.Group(),
    brows: {},
    mouths: {},
    blushMeshes: [],
  };
  face.eyeL.name = 'eyeL';
  face.eyeR.name = 'eyeR';

  // Build one complete three-layer expressive eye + asleep & happy alternates
  function buildEye(side) {
    const group = side > 0 ? face.eyeL : face.eyeR;
    const surf = queryHeadSurface(THREE, side * 0.36, -0.105, 0.927);
    group.position.copy(surf.point).addScaledVector(surf.normal, -0.0012);

    const basis = new THREE.Matrix4().makeBasis(surf.right, surf.up, surf.normal);
    group.quaternion.setFromRotationMatrix(basis);

    // 1. Open eye container (this is scaled on Y during blink)
    const openGroup = new THREE.Group();
    openGroup.name = 'openEye';

    // Layer 1: Dark glossy eye dome sitting slightly inset in socket
    const baseGeo = new THREE.SphereGeometry(1, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62);
    baseGeo.rotateX(Math.PI * 0.5);
    baseGeo.scale(0.0355, 0.0425, 0.0135);
    const baseMesh = tagSlot(new THREE.Mesh(baseGeo, mats.eyeGloss), null, false, true);
    baseMesh.position.z = -0.003;
    openGroup.add(baseMesh);

    // Layer 2 + 3: Coloured iris + specular highlights inside shiftable irisGroup
    const irisGroup = new THREE.Group();
    irisGroup.name = 'irisGroup';

    const irisGeo = new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.48);
    irisGeo.rotateX(Math.PI * 0.5);
    // Planar front UV mapping so circular painted iris sits cleanly centered
    const iPos = irisGeo.attributes.position;
    const iUv = irisGeo.attributes.uv;
    for (let i = 0; i < iPos.count; i++) {
      const px = iPos.getX(i);
      const py = iPos.getY(i);
      iUv.setXY(i, 0.5 + px * 0.52, 0.5 + py * 0.52);
    }
    iUv.needsUpdate = true;
    irisGeo.scale(0.0295, 0.0355, 0.0125);
    const irisMesh = tagSlot(new THREE.Mesh(irisGeo, mats.eyeIris), 'eye', false, false);
    irisMesh.position.set(0, -0.001, -0.0005);
    irisGroup.add(irisMesh);

    // Two glossy highlight dots placed upper-right (same dorm lamp direction on both eyes!)
    const hlBigGeo = new THREE.SphereGeometry(0.0072, 12, 10);
    hlBigGeo.scale(1.0, 1.15, 0.45);
    const hlBig = tagSlot(new THREE.Mesh(hlBigGeo, mats.eyeHighlight), null, false, false);
    hlBig.position.set(0.0115, 0.0145, 0.0108);
    irisGroup.add(hlBig);

    const hlSmallGeo = new THREE.SphereGeometry(0.0032, 10, 8);
    hlSmallGeo.scale(1.0, 1.0, 0.45);
    const hlSmall = tagSlot(new THREE.Mesh(hlSmallGeo, mats.eyeHighlight), null, false, false);
    hlSmall.position.set(-0.0105, -0.0135, 0.0105);
    irisGroup.add(hlSmall);

    openGroup.add(irisGroup);

    // Curved upper eyelash line with soft outer wing
    const lashCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-side * 0.034, 0.010, 0.003),
      new THREE.Vector3(-side * 0.014, 0.038, 0.0075),
      new THREE.Vector3(side * 0.014, 0.040, 0.0072),
      new THREE.Vector3(side * 0.035, 0.018, 0.0035),
      new THREE.Vector3(side * 0.043, 0.021, 0.0005),
    ]);
    const lashGeo = buildTaperedTube(THREE, lashCurve, 16, 8, (t) => 0.0016 + Math.sin(t * Math.PI) * 0.0028);
    openGroup.add(tagSlot(new THREE.Mesh(lashGeo, mats.lash), null, false, false));

    group.add(openGroup);

    // 2. Asleep closed-eyelid arc
    const asleepGroup = new THREE.Group();
    asleepGroup.name = 'asleepEye';
    const asleepCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-side * 0.031, -0.002, 0.004),
      new THREE.Vector3(-side * 0.012, -0.014, 0.0095),
      new THREE.Vector3(side * 0.012, -0.014, 0.0095),
      new THREE.Vector3(side * 0.032, -0.001, 0.004),
      new THREE.Vector3(side * 0.039, -0.005, 0.001),
    ]);
    const asleepGeo = buildTaperedTube(THREE, asleepCurve, 16, 8, (t) => 0.0018 + Math.sin(t * Math.PI) * 0.0022);
    asleepGroup.add(tagSlot(new THREE.Mesh(asleepGeo, mats.lash), null, false, false));
    asleepGroup.visible = false;
    group.add(asleepGroup);

    // 3. Happy joyous '^' eye arc
    const happyGroup = new THREE.Group();
    happyGroup.name = 'happyEye';
    const happyCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-side * 0.032, -0.004, 0.004),
      new THREE.Vector3(-side * 0.013, 0.019, 0.0095),
      new THREE.Vector3(side * 0.013, 0.019, 0.0095),
      new THREE.Vector3(side * 0.032, -0.004, 0.004),
    ]);
    const happyGeo = buildTaperedTube(THREE, happyCurve, 16, 8, (t) => 0.0020 + Math.sin(t * Math.PI) * 0.0026);
    happyGroup.add(tagSlot(new THREE.Mesh(happyGeo, mats.lash), null, false, false));
    happyGroup.visible = false;
    group.add(happyGroup);

    group.userData = { openGroup, irisGroup, asleepGroup, happyGroup };
    return group;
  }

  buildEye(1);
  buildEye(-1);

  // Expressive eyebrows
  function buildBrow(side) {
    const surf = queryHeadSurface(THREE, side * 0.35, 0.145, 0.925);
    const browGroup = new THREE.Group();
    browGroup.position.copy(surf.point).addScaledVector(surf.normal, 0.003);
    const basis = new THREE.Matrix4().makeBasis(surf.right, surf.up, surf.normal);
    browGroup.quaternion.setFromRotationMatrix(basis);

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-side * 0.026, -0.002, 0.001),
      new THREE.Vector3(0, 0.0055, 0.0035),
      new THREE.Vector3(side * 0.028, -0.001, 0.000),
    ]);
    const geo = buildTaperedTube(THREE, curve, 12, 8, (t) => 0.0018 + Math.sin(t * Math.PI) * 0.0020);
    browGroup.add(tagSlot(new THREE.Mesh(geo, mats.brow), 'fur', false, false));

    browGroup.userData.basePos = browGroup.position.clone();
    browGroup.userData.baseQuat = browGroup.quaternion.clone();
    return browGroup;
  }
  face.brows.L = buildBrow(1);
  face.brows.R = buildBrow(-1);

  // Curved tube mouths for all 5 expressions (conforming to sculpted face)
  const mouthGroup = new THREE.Group();
  mouthGroup.name = 'mouthGroup';

  function facePt(nx, ny, offset = 0.0026) {
    const nz = Math.sqrt(Math.max(0.01, 1 - nx * nx - ny * ny));
    const s = queryHeadSurface(THREE, nx, ny, nz);
    return s.point.addScaledVector(s.normal, offset);
  }

  // Awake: gentle warm smile
  const awakeMouthCurve = new THREE.CatmullRomCurve3([
    facePt(-0.14, -0.455),
    facePt(-0.06, -0.495),
    facePt(0.0, -0.505),
    facePt(0.06, -0.495),
    facePt(0.14, -0.455),
  ]);
  face.mouths.awake = tagSlot(
    new THREE.Mesh(buildTaperedTube(THREE, awakeMouthCurve, 16, 8, (t) => 0.0015 + Math.sin(t * Math.PI) * 0.0012), mats.mouth),
    null,
    false,
    false
  );
  mouthGroup.add(face.mouths.awake);

  // Asleep: tiny soft relaxed 'o'
  const asleepMouthGroup = new THREE.Group();
  const asleepPts = [];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    asleepPts.push(facePt(Math.cos(a) * 0.042, -0.485 + Math.sin(a) * 0.036, 0.0025));
  }
  const asleepMouthCurve = new THREE.CatmullRomCurve3(asleepPts, true);
  asleepMouthGroup.add(tagSlot(
    new THREE.Mesh(buildTaperedTube(THREE, asleepMouthCurve, 16, 7, () => 0.0016, { capStart: false, capEnd: false }), mats.mouth),
    null,
    false,
    false
  ));
  asleepMouthGroup.visible = false;
  face.mouths.asleep = asleepMouthGroup;
  mouthGroup.add(asleepMouthGroup);

  // Thinking: small off-center 'hmm' pout
  const thinkMouthCurve = new THREE.CatmullRomCurve3([
    facePt(-0.04, -0.485),
    facePt(0.03, -0.475),
    facePt(0.095, -0.482),
    facePt(0.14, -0.495),
  ]);
  face.mouths.thinking = tagSlot(
    new THREE.Mesh(buildTaperedTube(THREE, thinkMouthCurve, 14, 8, (t) => 0.0016 + Math.sin(t * Math.PI) * 0.0011), mats.mouth),
    null,
    false,
    false
  );
  face.mouths.thinking.visible = false;
  mouthGroup.add(face.mouths.thinking);

  // Unsure: gentle wavy squiggle
  const unsureMouthCurve = new THREE.CatmullRomCurve3([
    facePt(-0.135, -0.505),
    facePt(-0.065, -0.472),
    facePt(0.0, -0.502),
    facePt(0.065, -0.472),
    facePt(0.135, -0.505),
  ]);
  face.mouths.unsure = tagSlot(
    new THREE.Mesh(buildTaperedTube(THREE, unsureMouthCurve, 18, 8, (t) => 0.0016 + Math.sin(t * Math.PI) * 0.0010), mats.mouth),
    null,
    false,
    false
  );
  face.mouths.unsure.visible = false;
  mouthGroup.add(face.mouths.unsure);

  // Happy: joyous wide open smile with warm rosy interior
  const happyMouthGroup = new THREE.Group();
  const happyTopCurve = new THREE.CatmullRomCurve3([
    facePt(-0.18, -0.445),
    facePt(-0.08, -0.458),
    facePt(0.0, -0.460),
    facePt(0.08, -0.458),
    facePt(0.18, -0.445),
  ]);
  const happyBotCurve = new THREE.CatmullRomCurve3([
    facePt(-0.18, -0.445),
    facePt(-0.10, -0.555),
    facePt(0.0, -0.580),
    facePt(0.10, -0.555),
    facePt(0.18, -0.445),
  ]);
  happyMouthGroup.add(tagSlot(
    new THREE.Mesh(buildTaperedTube(THREE, happyTopCurve, 14, 7, () => 0.0019), mats.mouth),
    null, false, false
  ));
  happyMouthGroup.add(tagSlot(
    new THREE.Mesh(buildTaperedTube(THREE, happyBotCurve, 16, 7, () => 0.0020), mats.mouth),
    null, false, false
  ));
  // Curved pink mouth fill patch conforming to face
  const fillPos = [];
  const fillIdx = [];
  const uN = 10;
  const vN = 5;
  for (let iv = 0; iv <= vN; iv++) {
    const v = iv / vN;
    for (let iu = 0; iu <= uN; iu++) {
      const u = iu / uN;
      const nx = mix(-0.172, 0.172, u);
      const yTop = -0.448 - Math.sin(u * Math.PI) * 0.010;
      const yBot = -0.448 - Math.sin(u * Math.PI) * 0.128;
      const ny = mix(yTop, yBot, v);
      const p = facePt(nx, ny, 0.0014);
      fillPos.push(p.x, p.y, p.z);
    }
  }
  for (let iv = 0; iv < vN; iv++) {
    for (let iu = 0; iu < uN; iu++) {
      const a = iv * (uN + 1) + iu;
      const b = a + 1;
      const c = a + (uN + 1) + 1;
      const d = a + (uN + 1);
      fillIdx.push(a, c, b, a, d, c);
    }
  }
  const fillGeo = new THREE.BufferGeometry();
  fillGeo.setAttribute('position', new THREE.Float32BufferAttribute(fillPos, 3));
  fillGeo.setIndex(fillIdx);
  fillGeo.computeVertexNormals();
  happyMouthGroup.add(tagSlot(new THREE.Mesh(fillGeo, mats.mouthInside), null, false, false));
  happyMouthGroup.visible = false;
  face.mouths.happy = happyMouthGroup;
  mouthGroup.add(happyMouthGroup);

  face.mouthGroup = mouthGroup;

  // Cheek blush curved surface patches (visible when opts.blush is true)
  if (opts.blush) {
    for (const side of [1, -1]) {
      const bPos = [];
      const bUv = [];
      const bIdx = [];
      const seg = 8;
      for (let iv = 0; iv <= seg; iv++) {
        const v = iv / seg;
        for (let iu = 0; iu <= seg; iu++) {
          const u = iu / seg;
          const nx = side * 0.52 + (u - 0.5) * 0.30;
          const ny = -0.34 + (v - 0.5) * 0.19;
          const p = facePt(nx, ny, 0.0016);
          bPos.push(p.x, p.y, p.z);
          bUv.push(u, v);
        }
      }
      for (let iv = 0; iv < seg; iv++) {
        for (let iu = 0; iu < seg; iu++) {
          const a = iv * (seg + 1) + iu;
          const b = a + 1;
          const c = a + (seg + 1) + 1;
          const d = a + (seg + 1);
          bIdx.push(a, b, c, a, c, d);
        }
      }
      const bGeo = new THREE.BufferGeometry();
      bGeo.setAttribute('position', new THREE.Float32BufferAttribute(bPos, 3));
      bGeo.setAttribute('uv', new THREE.Float32BufferAttribute(bUv, 2));
      bGeo.setIndex(bIdx);
      bGeo.computeVertexNormals();
      const bMesh = tagSlot(new THREE.Mesh(bGeo, mats.blush), null, false, false);
      face.blushMeshes.push(bMesh);
    }
  }

  return face;
}

function buildGlasses(THREE, style, mats) {
  if (style === 'none') return null;
  const g = new THREE.Group();
  g.name = 'glasses';

  const eyeY = HEAD_CENTER_Y - 0.022;
  const eyeX = 0.068;
  const frontZ = 0.174;

  function makeRim(side) {
    const rimGroup = new THREE.Group();
    const pts = [];
    const n = 28;
    const rx = style === 'round' ? 0.049 : 0.052;
    const ry = style === 'round' ? 0.049 : 0.039;

    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      let x, y;
      if (style === 'round') {
        x = Math.cos(a) * rx;
        y = Math.sin(a) * ry;
      } else {
        // Superellipse rounded-square scholar frame
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const p = 0.34;
        x = Math.sign(ca) * Math.pow(Math.abs(ca), p) * rx;
        y = Math.sign(sa) * Math.pow(Math.abs(sa), p) * ry;
      }
      // Slight gentle wrap around face curvature
      const z = -Math.pow(x / rx, 2) * 0.005;
      pts.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true);
    const frameThick = style === 'round' ? 0.0036 : 0.0046;
    const rimGeo = buildTaperedTube(THREE, curve, 36, 10, () => frameThick, { capStart: false, capEnd: false });
    rimGroup.add(tagSlot(new THREE.Mesh(rimGeo, mats.glassesFrame), 'accent'));

    // Translucent glossy lens disc
    const lensShape = new THREE.Shape();
    pts.forEach((p, idx) => {
      if (idx === 0) lensShape.moveTo(p.x * 0.96, p.y * 0.96);
      else lensShape.lineTo(p.x * 0.96, p.y * 0.96);
    });
    lensShape.closePath();
    const lensGeo = new THREE.ShapeGeometry(lensShape, 16);
    const lensMesh = tagSlot(new THREE.Mesh(lensGeo, mats.glassesLens), null, false, false);
    lensMesh.position.z = -0.001;
    rimGroup.add(lensMesh);

    rimGroup.position.set(side * eyeX, eyeY, frontZ);
    rimGroup.rotation.y = side * -0.16;
    return rimGroup;
  }

  g.add(makeRim(1));
  g.add(makeRim(-1));

  // Nose bridge
  const bridgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.020, eyeY + 0.005, frontZ + 0.005),
    new THREE.Vector3(0, eyeY + (style === 'round' ? 0.011 : 0.008), frontZ + 0.010),
    new THREE.Vector3(0.020, eyeY + 0.005, frontZ + 0.005),
  ]);
  g.add(tagSlot(
    new THREE.Mesh(buildTaperedTube(THREE, bridgeCurve, 12, 8, () => 0.0032), mats.glassesFrame),
    'accent'
  ));

  // Left & right temples hooking gently over the ears
  for (const side of [1, -1]) {
    const startX = side * (eyeX + (style === 'round' ? 0.048 : 0.050));
    const templeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(startX, eyeY + 0.010, frontZ - 0.010),
      new THREE.Vector3(side * 0.146, eyeY + 0.011, 0.110),
      new THREE.Vector3(side * 0.171, eyeY + 0.007, 0.022),
      new THREE.Vector3(side * 0.172, eyeY + 0.002, -0.024),
      new THREE.Vector3(side * 0.165, eyeY - 0.028, -0.054),
    ]);
    g.add(tagSlot(
      new THREE.Mesh(buildTaperedTube(THREE, templeCurve, 20, 8, (t) => 0.0028 + t * 0.0008), mats.glassesFrame),
      'accent'
    ));
  }

  return g;
}

// ---------------------------------------------------------------------------
// Sculpted Hair Builder (8 Distinct Styles — Continuous Cap + Bezier Locks)
// ---------------------------------------------------------------------------

function buildHairCapGeometry(THREE, kit, opts) {
  const thickness = opts.thickness || 0.014;
  const buzz = !!opts.buzz;
  const napeDepth = opts.napeDepth !== undefined ? opts.napeDepth : 0.72;
  const frontLine = opts.frontLine !== undefined ? opts.frontLine : 0.34;
  const uSegs = 48;
  const vSegs = 22;

  function phiMaxForAngle(angle) {
    // angle = 0 at +Z (forehead), PI/2 at +X (left ear), PI at -Z (nape)
    const ca = Math.cos(angle);
    const sa = Math.abs(Math.sin(angle));

    const frontWeight = smoothstep(0.15, 0.92, ca);
    const backWeight = smoothstep(-0.15, -0.85, ca);
    const earDip = Math.exp(-Math.pow((Math.abs(angle - Math.PI * 0.5) - 0.04) / 0.24, 2)) +
      Math.exp(-Math.pow((Math.abs(angle - Math.PI * 1.5) - 0.04) / 0.24, 2));

    let phi = mix(0.55, frontLine, frontWeight);
    phi = mix(phi, napeDepth, backWeight);
    phi -= earDip * (buzz ? 0.08 : 0.06);
    // Subtle temple framing points
    const temple = Math.exp(-Math.pow((sa - 0.65) / 0.18, 2)) * smoothstep(0.0, 0.85, ca);
    phi += temple * 0.055;
    return phi * Math.PI;
  }

  return buildThickShell(
    THREE,
    uSegs,
    vSegs,
    true,
    (u, v) => {
      // v = 0 is bottom hairline edge, v = 1 is crown top
      const angle = u * Math.PI * 2;
      const phiMax = phiMaxForAngle(angle);
      const phi = mix(phiMax, 0.025, v);
      const sp = Math.sin(phi);
      const cp = Math.cos(phi);
      const nx = Math.sin(angle) * sp;
      const ny = cp;
      const nz = Math.cos(angle) * sp;
      const base = deformHeadVertex(nx, ny, nz);

      // Brushed organic ridges (muted on buzz cut)
      const ridge = buzz
        ? kit.noise(nx * 8, nz * 8) * 0.0012
        : (Math.sin(angle * 15) * 0.0022 + (kit.noise(nx * 4.5 + 2, ny * 4.5) - 0.5) * 0.005) * smoothstep(0.05, 0.5, 1 - v);

      const edgeTaper = smoothstep(0, 0.14, v);
      const lift = (thickness * (0.45 + 0.55 * edgeTaper) + ridge);

      const dx = base[0];
      const dy = base[1] - HEAD_CENTER_Y;
      const dz = base[2];
      const dLen = Math.hypot(dx, dy, dz) || 1;
      return [
        base[0] + (dx / dLen) * lift,
        base[1] + (dy / dLen) * lift,
        base[2] + (dz / dLen) * lift,
      ];
    },
    (u, v) => (buzz ? 0.004 : 0.009) * (0.45 + 0.55 * smoothstep(0, 0.2, v)),
    [2.5, 1.5]
  );
}

function buildHair(THREE, opts, kit, mats) {
  const hairGroup = new THREE.Group();
  hairGroup.name = 'hair';
  const style = opts.hairStyle;
  let secondaryGroup = null;

  // Helper to get skull point offset outward along radial from head center
  function skullPt(nx, ny, nz, offset) {
    const l = Math.hypot(nx, ny, nz) || 1;
    const ux = nx / l, uy = ny / l, uz = nz / l;
    const p = deformHeadVertex(ux, uy, uz);
    const dx = p[0], dy = p[1] - HEAD_CENTER_Y, dz = p[2];
    const dl = Math.hypot(dx, dy, dz) || 1;
    return [p[0] + (dx / dl) * offset, p[1] + (dy / dl) * offset, p[2] + (dz / dl) * offset];
  }

  // Reusable bangs builder (bezier-extruded curved fringe locks)
  function addFringeLocks(count, spread, yDrop, sweepBias = 0.05) {
    for (let i = 0; i < count; i++) {
      const f = count === 1 ? 0 : (i / (count - 1)) * 2 - 1; // -1..1
      const xRoot = f * spread * 0.72 + sweepBias * 0.4;
      const xTip = f * spread + sweepBias + Math.sin(i * 2.1) * 0.04;
      const w = 0.048 - Math.abs(f) * 0.008;
      const drop = yDrop - Math.abs(f) * 0.05 + Math.cos(i * 1.9) * 0.035;
      const pts = [
        skullPt(xRoot * 0.45, 0.76, 0.62, 0.016),
        skullPt(xRoot * 0.78, 0.54, 0.84, 0.022),
        skullPt((xRoot + xTip) * 0.5, 0.28 - drop * 0.45, 0.94, 0.024),
        skullPt(xTip, 0.14 - drop, 0.95, 0.017),
      ];
      const geo = buildBezierLock(THREE, pts, w, 0.011, {
        upHint: new THREE.Vector3(0, 1, 0),
        tipWidth: 0.08,
        midBulge: 1.12,
      });
      hairGroup.add(tagSlot(new THREE.Mesh(geo, mats.hair), 'fur'));
    }
  }

  // Reusable side cheek-framing locks
  function addSideLocks(lengthDrop, curveIn, width = 0.052) {
    for (const side of [1, -1]) {
      const pts = [
        skullPt(side * 0.64, 0.52, 0.52, 0.018),
        skullPt(side * 0.84, 0.16, 0.44, 0.022),
        skullPt(side * (0.86 - curveIn * 0.15), -0.22 - lengthDrop * 0.45, 0.38, 0.022),
        skullPt(side * (0.76 - curveIn * 0.45), -0.50 - lengthDrop, 0.42, 0.016),
      ];
      const geo = buildBezierLock(THREE, pts, width, 0.013, {
        upHint: new THREE.Vector3(0, 1, 0),
        tipWidth: 0.08,
      });
      hairGroup.add(tagSlot(new THREE.Mesh(geo, mats.hair), 'fur'));
    }
  }

  if (style === 'buzz') {
    const capGeo = buildHairCapGeometry(THREE, kit, {
      thickness: 0.0055,
      buzz: true,
      frontLine: 0.36,
      napeDepth: 0.68,
    });
    hairGroup.add(tagSlot(new THREE.Mesh(capGeo, mats.hair), 'fur'));
  } else if (style === 'short') {
    const capGeo = buildHairCapGeometry(THREE, kit, { thickness: 0.015, frontLine: 0.34, napeDepth: 0.72 });
    hairGroup.add(tagSlot(new THREE.Mesh(capGeo, mats.hair), 'fur'));

    // Side-swept feathery bangs + sideburns + layered nape locks
    addFringeLocks(7, 0.52, 0.10, 0.10);
    addSideLocks(0.02, 0.15, 0.044);

    // Layered choppy back nape locks
    for (let i = 0; i < 9; i++) {
      const f = (i / 8) * 2 - 1;
      const ang = Math.PI + f * 1.15;
      const sa = Math.sin(ang), ca = Math.cos(ang);
      const pts = [
        skullPt(sa * 0.78, 0.15, ca * 0.78, 0.018),
        skullPt(sa * 0.88, -0.28, ca * 0.88, 0.022),
        skullPt(sa * 0.76, -0.68, ca * 0.76, 0.014),
      ];
      const geo = buildBezierLock(THREE, pts, 0.056, 0.012, { upHint: new THREE.Vector3(0, 1, 0) });
      hairGroup.add(tagSlot(new THREE.Mesh(geo, mats.hair), 'fur'));
    }
  } else if (style === 'bob') {
    const capGeo = buildHairCapGeometry(THREE, kit, { thickness: 0.017, frontLine: 0.34, napeDepth: 0.76 });
    hairGroup.add(tagSlot(new THREE.Mesh(capGeo, mats.hair), 'fur'));

    // Smooth curved chin-length bob bell shell draping around sides & back
    const bobShell = buildThickShell(
      THREE,
      36,
      16,
      false,
      (u, v) => {
        // u from 0 (right cheek) around back to 1 (left cheek); v=0 is curved-in bottom tip, v=1 is crown blend
        const angle = mix(-Math.PI * 0.32, Math.PI * 2 - Math.PI * 0.68, u);
        // Shift so u=0 is at +X front-side (~0.24*PI) going through PI (back) to 1.76*PI (-X front-side)
        const a = mix(0.27 * Math.PI, 1.73 * Math.PI, u);
        const yTop = HEAD_CENTER_Y + 0.115;
        const yBot = HEAD_CENTER_Y - 0.175 + Math.sin(u * Math.PI) * 0.012;
        const y = mix(yBot, yTop, v);

        // Bell profile: fuller around cheeks, curling softly inward at tips
        const bell = Math.sin(v * Math.PI) * 0.026 - Math.pow(1 - v, 2.2) * 0.020;
        const groove = Math.sin(u * Math.PI * 16) * 0.003 * (1 - v);
        const rx = 0.194 + bell + groove;
        const rz = 0.186 + bell + groove;
        return [Math.sin(a) * rx, y, Math.cos(a) * rz];
      },
      (u, v) => 0.014 * (0.55 + 0.45 * v),
      [2.5, 1.2]
    );
    hairGroup.add(tagSlot(new THREE.Mesh(bobShell, mats.hair), 'fur'));

    addFringeLocks(7, 0.48, 0.13, -0.04);
    addSideLocks(0.24, 0.42, 0.056);
  } else if (style === 'longStraight') {
    const capGeo = buildHairCapGeometry(THREE, kit, { thickness: 0.016, frontLine: 0.35, napeDepth: 0.78 });
    hairGroup.add(tagSlot(new THREE.Mesh(capGeo, mats.hair), 'fur'));

    // Parted wispy bangs
    addFringeLocks(6, 0.50, 0.12, 0.0);

    // 2 long front-shoulder framing bezier locks
    for (const side of [1, -1]) {
      const pts = [
        skullPt(side * 0.62, 0.56, 0.50, 0.018),
        skullPt(side * 0.86, 0.08, 0.40, 0.024),
        [side * 0.185, HEAD_CENTER_Y - 0.16, 0.068],
        [side * 0.168, HEAD_CENTER_Y - 0.28, 0.082],
        [side * 0.155, HEAD_CENTER_Y - 0.39, 0.072],
      ];
      const geo = buildBezierLock(THREE, pts, 0.058, 0.014, {
        upHint: new THREE.Vector3(0, 1, 0),
        tipWidth: 0.14,
      });
      hairGroup.add(tagSlot(new THREE.Mesh(geo, mats.hair), 'fur'));
    }

    // Lush cascading back locks draping cleanly past shoulders & mid-back
    const backLocks = 11;
    for (let i = 0; i < backLocks; i++) {
      const f = (i / (backLocks - 1)) * 2 - 1; // -1..1
      const ang = Math.PI + f * 1.18;
      const sa = Math.sin(ang), ca = Math.cos(ang);
      const drop = 0.42 - Math.abs(f) * 0.07 + Math.sin(i * 1.7) * 0.025;
      const pts = [
        skullPt(sa * 0.65, 0.58, ca * 0.65, 0.018),
        skullPt(sa * 0.94, 0.08, ca * 0.94, 0.024),
        [sa * 0.205, HEAD_CENTER_Y - 0.16, ca * 0.185 - 0.02],
        [sa * 0.218, HEAD_CENTER_Y - 0.30, ca * 0.195 - 0.032],
        [sa * 0.205, HEAD_CENTER_Y - drop, ca * 0.185 - 0.022],
      ];
      const geo = buildBezierLock(THREE, pts, 0.076, 0.015, {
        upHint: new THREE.Vector3(0, 1, 0),
        tipWidth: 0.18,
      });
      hairGroup.add(tagSlot(new THREE.Mesh(geo, mats.hair), 'fur'));
    }
  } else if (style === 'curly') {
    const capGeo = buildHairCapGeometry(THREE, kit, { thickness: 0.020, frontLine: 0.36, napeDepth: 0.74 });
    hairGroup.add(tagSlot(new THREE.Mesh(capGeo, mats.hair), 'fur'));

    // Dynamic corkscrew ribbon ringlets all around forehead, cheeks & back
    const ringletCount = 20;
    for (let i = 0; i < ringletCount; i++) {
      const u = i / ringletCount;
      const ang = u * Math.PI * 2;
      const sa = Math.sin(ang), ca = Math.cos(ang);
      const isFront = ca > 0.42;
      const len = isFront ? 0.12 : (0.24 + (kit.noise(i * 1.3, 4.1) - 0.5) * 0.07);
      const turns = isFront ? 1.4 : 2.6;
      const spiralR = isFront ? 0.014 : 0.022;
      const pts = [];
      const steps = 14;
      const rootPhi = isFront ? 0.26 * Math.PI : 0.38 * Math.PI;
      const rootPt = skullPt(sa * Math.sin(rootPhi), Math.cos(rootPhi), ca * Math.sin(rootPhi), 0.018);

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const theta = t * Math.PI * 2 * turns + i * 1.1;
        const env = Math.sin(t * Math.PI * 0.85) * spiralR;
        const radOut = 0.022 + t * (isFront ? 0.015 : 0.038);
        const cx = rootPt[0] + sa * radOut + Math.cos(theta) * env;
        const cy = rootPt[1] - t * len;
        const cz = rootPt[2] + ca * radOut + Math.sin(theta) * env;
        pts.push(new THREE.Vector3(cx, cy, cz));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = buildTaperedTube(THREE, curve, 22, 10, (t) => {
        const w = (isFront ? 0.014 : 0.018) * (1 - t * 0.55);
        return [w, w * 0.58];
      });
      hairGroup.add(tagSlot(new THREE.Mesh(geo, mats.hair), 'fur'));
    }
  } else if (style === 'ponytail') {
    // Sleek pulled-back hair cap
    const capGeo = buildHairCapGeometry(THREE, kit, { thickness: 0.013, frontLine: 0.36, napeDepth: 0.68 });
    hairGroup.add(tagSlot(new THREE.Mesh(capGeo, mats.hair), 'fur'));

    // Cute side-swept bangs + delicate ear tendrils
    addFringeLocks(5, 0.44, 0.09, 0.12);
    addSideLocks(0.06, 0.22, 0.032);

    // Sculpted scrunchie hair tie at upper back of skull
    const tieAnchor = new THREE.Vector3(0, HEAD_CENTER_Y + 0.072, -0.172);
    const scrunchieGeo = new THREE.TorusGeometry(0.032, 0.014, 14, 24);
    scrunchieGeo.scale(1.0, 1.0, 0.82);
    const scrunchie = tagSlot(new THREE.Mesh(scrunchieGeo, mats.accentSoft), 'accent');
    scrunchie.position.copy(tieAnchor);
    scrunchie.rotation.x = 0.45;
    hairGroup.add(scrunchie);

    // Cascading sculpted ponytail group (animated gently in idle!)
    const ponyGroup = new THREE.Group();
    ponyGroup.name = 'ponytail';
    ponyGroup.position.copy(tieAnchor);

    const strands = 10;
    for (let i = 0; i < strands; i++) {
      const a = (i / strands) * Math.PI * 2;
      const sx = Math.cos(a);
      const sy = Math.sin(a);
      const spreadX = sx * 0.055;
      const spreadZ = -0.025 + sy * 0.025;
      const drop = 0.33 + (i % 3) * 0.025;
      const pts = [
        [sx * 0.012, sy * 0.012, 0.005],
        [spreadX * 0.65, 0.052 + sy * 0.024, -0.068 + spreadZ * 0.5],
        [spreadX * 1.15, -0.065, -0.125 + spreadZ],
        [spreadX * 0.92, -0.205, -0.112 + spreadZ * 0.8],
        [spreadX * 0.45, -drop, -0.072 + spreadZ * 0.4],
      ];
      const geo = buildBezierLock(THREE, pts, 0.052, 0.015, {
        upHint: new THREE.Vector3(0, 0, -1),
        tipWidth: 0.09,
        midBulge: 1.2,
      });
      ponyGroup.add(tagSlot(new THREE.Mesh(geo, mats.hair), 'fur'));
    }
    hairGroup.add(ponyGroup);
    secondaryGroup = ponyGroup;
  } else if (style === 'afro') {
    // One continuous richly sculpted halo crown (dense displaced sphere with organic lobes)
    const afroGeo = sculptSphere(THREE, 1, 56, 40, (nx, ny, nz) => {
      // Generous cozy cloud silhouette shifted slightly up & back from face
      const n1 = kit.noise(nx * 2.4 + 3.1, ny * 2.4 + nz * 1.9);
      const n2 = kit.noise(nx * 5.2 - 1.4, nz * 5.2 + ny * 3.7);
      const n3 = kit.noise(ny * 8.5 + 2.0, nx * 8.5 - nz * 4.0);
      const fluff = (n1 - 0.5) * 0.036 + (n2 - 0.5) * 0.020 + (n3 - 0.5) * 0.010;

      // Carve clean face opening around eyes/cheeks/chin so face is framed, never obscured
      const faceWindow = smoothstep(0.28, 0.72, nz) * smoothstep(0.32, -0.25, ny);
      const rx = 0.248 + fluff - faceWindow * 0.095;
      const ry = 0.242 + fluff - faceWindow * 0.065;
      const rz = 0.236 + fluff - faceWindow * 0.145;

      // Gently tuck under nape
      const under = smoothstep(-0.55, -0.95, ny);
      return [
        nx * rx,
        HEAD_CENTER_Y + 0.048 + ny * ry + under * 0.035,
        -0.026 + nz * rz,
      ];
    });
    hairGroup.add(tagSlot(new THREE.Mesh(afroGeo, mats.hair), 'fur'));

    // Fitted hairline base underneath so temples/nape transition seamlessly
    const baseCap = buildHairCapGeometry(THREE, kit, { thickness: 0.011, buzz: true, frontLine: 0.35, napeDepth: 0.70 });
    hairGroup.add(tagSlot(new THREE.Mesh(baseCap, mats.hair), 'fur'));
  } else if (style === 'braids') {
    const capGeo = buildHairCapGeometry(THREE, kit, { thickness: 0.015, frontLine: 0.35, napeDepth: 0.74 });
    hairGroup.add(tagSlot(new THREE.Mesh(capGeo, mats.hair), 'fur'));

    // Parted wispy bangs
    addFringeLocks(6, 0.48, 0.11, 0.0);

    // Two sculpted interwoven twin braids draping forward over the shoulders
    const braidsGroup = new THREE.Group();
    braidsGroup.name = 'braids';

    for (const side of [1, -1]) {
      const braidPivot = new THREE.Group();
      const spineCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.156, HEAD_CENTER_Y - 0.055, -0.045),
        new THREE.Vector3(side * 0.172, HEAD_CENTER_Y - 0.150, 0.005),
        new THREE.Vector3(side * 0.158, HEAD_CENTER_Y - 0.255, 0.068),
        new THREE.Vector3(side * 0.142, HEAD_CENTER_Y - 0.365, 0.098),
      ]);
      const frames = computeParallelFrames(THREE, spineCurve, 28, new THREE.Vector3(0, 0, 1));

      // Central core so braid has zero gaps between plaits
      const coreGeo = buildTaperedTube(THREE, spineCurve, 18, 8, (t) => 0.018 * (1 - t * 0.32));
      braidPivot.add(tagSlot(new THREE.Mesh(coreGeo, mats.hair), 'fur'));

      // Interlocking diagonal chevron plait links along spine
      const linkCount = 13;
      const linkGeoBase = new THREE.SphereGeometry(1, 14, 10);
      linkGeoBase.scale(0.018, 0.029, 0.014);
      for (let k = 0; k < linkCount; k++) {
        const t = (k + 0.5) / linkCount;
        const fIdx = Math.min(27, Math.floor(t * 28));
        const pt = frames.pts[fIdx];
        const tan = frames.tangents[fIdx];
        const norm = frames.normals[fIdx];
        const bin = frames.binormals[fIdx];

        const alt = k % 2 === 0 ? 1 : -1;
        const scale = 1 - t * 0.34;
        const plait = tagSlot(new THREE.Mesh(linkGeoBase, mats.hair), 'fur');
        plait.scale.setScalar(scale);
        plait.position.copy(pt)
          .addScaledVector(norm, alt * 0.010 * scale)
          .addScaledVector(bin, 0.004 * scale);

        const basis = new THREE.Matrix4().makeBasis(norm, tan, bin);
        plait.quaternion.setFromRotationMatrix(basis);
        plait.rotateZ(alt * 0.58);
        plait.rotateX(0.22);
        braidPivot.add(plait);
      }

      // Cute hair tie near end of braid
      const tiePt = spineCurve.getPoint(0.95);
      const tieTan = spineCurve.getTangent(0.95);
      const tieGeo = new THREE.TorusGeometry(0.015, 0.0065, 10, 18);
      const tie = tagSlot(new THREE.Mesh(tieGeo, mats.accentSoft), 'accent');
      tie.position.copy(tiePt);
      tie.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tieTan);
      braidPivot.add(tie);

      // Flared brush-tip tassel of 3 small bezier locks
      for (let j = -1; j <= 1; j++) {
        const tipPts = [
          [tiePt.x, tiePt.y, tiePt.z],
          [tiePt.x + j * 0.012, tiePt.y - 0.032, tiePt.z + 0.008],
          [tiePt.x + j * 0.018, tiePt.y - 0.068, tiePt.z + 0.004],
        ];
        const tGeo = buildBezierLock(THREE, tipPts, 0.022, 0.008, { upHint: new THREE.Vector3(0, 0, 1) });
        braidPivot.add(tagSlot(new THREE.Mesh(tGeo, mats.hair), 'fur'));
      }

      braidsGroup.add(braidPivot);
    }
    hairGroup.add(braidsGroup);
    secondaryGroup = braidsGroup;
  }

  return { hairGroup, secondaryGroup };
}

// ---------------------------------------------------------------------------
// Hands, Limbs & Shoes
// ---------------------------------------------------------------------------

function buildMittenHand(THREE, side, mats) {
  const g = new THREE.Group();

  // Sculpted continuous mitten palm + curved fingers from dense sphere
  const palmGeo = sculptSphere(THREE, 1, 24, 18, (nx, ny, nz) => {
    let rx = 0.029;
    let ry = 0.038;
    let rz = 0.018;
    // Taper wrist end (ny > 0) smoothly into forearm, round fingertip cup (ny < 0)
    const wristTaper = smoothstep(0.35, 0.98, ny);
    rx *= 1 - wristTaper * 0.24;
    rz *= 1 - wristTaper * 0.14;

    // Gentle inward palm curl
    const curl = smoothstep(0.1, -0.95, ny) * 0.009;
    return [nx * rx, ny * ry - 0.024, nz * rz + curl];
  });
  g.add(tagSlot(new THREE.Mesh(palmGeo, mats.skin), 'skin'));

  // Sculpted tapered-tube thumb overlapping cleanly into palm
  const thumbCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-side * 0.012, -0.006, 0.006),
    new THREE.Vector3(-side * 0.026, -0.018, 0.016),
    new THREE.Vector3(-side * 0.028, -0.032, 0.022),
  ]);
  const thumbGeo = buildTaperedTube(THREE, thumbCurve, 10, 10, (t) => 0.0105 * (1 - t * 0.26));
  g.add(tagSlot(new THREE.Mesh(thumbGeo, mats.skin), 'skin'));

  return g;
}

function buildShoe(THREE, side, mats) {
  const g = new THREE.Group();

  // 1. Thick contoured rubber sole sitting strictly flat on floor (y = 0)
  const soleShape = new THREE.Shape();
  soleShape.moveTo(0, -0.056);
  soleShape.bezierCurveTo(0.044, -0.056, 0.049, -0.012, 0.048, 0.032);
  soleShape.bezierCurveTo(0.047, 0.088, 0.026, 0.106, 0, 0.106);
  soleShape.bezierCurveTo(-0.026, 0.106, -0.047, 0.088, -0.048, 0.032);
  soleShape.bezierCurveTo(-0.049, -0.012, -0.044, -0.056, 0, -0.056);

  const soleGeo = new THREE.ExtrudeGeometry(soleShape, {
    depth: 0.019,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
    curveSegments: 20,
  });
  // Rotate so shape X stays X, shape Y becomes +Z (toe forward), extrude Z becomes +Y
  soleGeo.rotateX(-Math.PI * 0.5);
  // Shift so lowest bevel vertex is at exact y = 0.000
  soleGeo.computeBoundingBox();
  const minY = soleGeo.boundingBox.min.y;
  soleGeo.translate(0, -minY, 0);

  // Subtle toe spring lift at very front tip only
  const sPos = soleGeo.attributes.position;
  for (let i = 0; i < sPos.count; i++) {
    const z = sPos.getZ(i);
    if (z > 0.082) {
      const lift = Math.pow((z - 0.082) / 0.028, 2) * 0.005;
      sPos.setY(i, sPos.getY(i) + lift);
    }
  }
  sPos.needsUpdate = true;
  soleGeo.computeVertexNormals();
  g.add(tagSlot(new THREE.Mesh(soleGeo, mats.sole), null));

  // 2. Sculpted rounded chibi sneaker upper
  const upperGeo = sculptSphere(THREE, 1, 32, 22, (nx, ny, nz) => {
    const isFront = smoothstep(-0.15, 0.85, nz);
    const rx = 0.044 + isFront * 0.004;
    const rz = nz > 0 ? 0.100 : 0.054;
    let ry = 0.056;

    // Flatten bottom to rest solidly inside sole top
    let y = ny * ry;
    if (ny < -0.25) {
      y = mix(y, -0.018, smoothstep(-0.25, -0.95, ny));
    }
    // Lower vamp over toe box, higher ankle collar at back
    if (ny > 0.05 && nz > 0.05) {
      const vamp = smoothstep(0.05, 0.85, nz) * smoothstep(0.05, 0.85, ny);
      y -= vamp * 0.022;
    }
    return [nx * rx, y + 0.036, nz * rz + 0.004];
  });
  g.add(tagSlot(new THREE.Mesh(upperGeo, mats.shoe), 'accent'));

  // 3. Cute cream toe cap bumper
  const toeGeo = sculptSphere(THREE, 1, 20, 14, (nx, ny, nz) => {
    const rx = 0.043;
    const ry = 0.024;
    const rz = 0.034;
    return [nx * rx, Math.max(0.016, ny * ry + 0.029), nz * rz + 0.075];
  });
  g.add(tagSlot(new THREE.Mesh(toeGeo, mats.sole), null));

  // 4. Padded ankle collar cuff
  const collarPts = [];
  for (let i = 0; i <= 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    collarPts.push(new THREE.Vector3(Math.sin(a) * 0.037, 0.078 - Math.cos(a) * 0.008, Math.cos(a) * 0.042 - 0.004));
  }
  const collarCurve = new THREE.CatmullRomCurve3(collarPts, true);
  const collarGeo = buildTaperedTube(THREE, collarCurve, 22, 8, () => 0.0085, { capStart: false, capEnd: false });
  g.add(tagSlot(new THREE.Mesh(collarGeo, mats.shoeTrim), 'accent'));

  // 5. Three cute criss-cross sneaker laces
  for (let i = 0; i < 3; i++) {
    const zPos = 0.026 + i * 0.016;
    const yPos = 0.068 - i * 0.008;
    const laceCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.026, yPos - 0.004, zPos),
      new THREE.Vector3(0, yPos + 0.004, zPos + 0.003),
      new THREE.Vector3(0.026, yPos - 0.004, zPos),
    ]);
    g.add(tagSlot(new THREE.Mesh(buildTaperedTube(THREE, laceCurve, 10, 6, () => 0.0028), mats.sole), null));
  }

  return g;
}

// ---------------------------------------------------------------------------
// Clothing Builders (4 Tops × 3 Bottoms — Thick Sculpted Shells)
// ---------------------------------------------------------------------------

function buildTopClothes(THREE, opts, mats, armCurves) {
  const topGroup = new THREE.Group();
  topGroup.name = 'topClothes';
  const style = opts.top;

  // Helper: sleeve along exact arm centerline curve with thick cuff rim
  function addSleeve(armGroup, curve, tEnd, ease, cuffColorMat, hasRolledCuff) {
    const sCurve = new THREE.CatmullRomCurve3(
      Array.from({ length: 10 }, (_, i) => curve.getPoint(mix(0.03, tEnd, i / 9)))
    );
    const sleeveGeo = buildTaperedTube(
      THREE,
      sCurve,
      18,
      18,
      (t) => {
        const armT = mix(0.03, tEnd, t);
        const armR = mix(0.035, 0.021, armT) + Math.sin(armT * Math.PI) * 0.002;
        const drape = ease * (0.9 + Math.sin(t * Math.PI * 0.85) * 0.25);
        return armR + drape;
      },
      { capStart: true, capEnd: true, uvScaleU: 1.5, uvScaleV: 1.5 }
    );
    armGroup.add(tagSlot(new THREE.Mesh(sleeveGeo, mats.top), 'primary'));

    // Visible ribbed / rolled cuff band at end of sleeve
    const cuffT0 = Math.max(0.04, tEnd - (hasRolledCuff ? 0.10 : 0.08));
    const cuffCurve = new THREE.CatmullRomCurve3(
      Array.from({ length: 6 }, (_, i) => curve.getPoint(mix(cuffT0, tEnd + 0.015, i / 5)))
    );
    const cuffGeo = buildTaperedTube(
      THREE,
      cuffCurve,
      10,
      18,
      (t) => {
        const armT = mix(cuffT0, tEnd, t);
        const armR = mix(0.035, 0.021, armT);
        return armR + (hasRolledCuff ? ease + 0.005 : ease * 0.72) + Math.sin(t * Math.PI) * 0.003;
      },
      { capStart: true, capEnd: true }
    );
    armGroup.add(tagSlot(new THREE.Mesh(cuffGeo, cuffColorMat || mats.topTrim), 'primary'));
  }

  if (style === 'hoodie') {
    // Cozy oversized pullover thick shell
    const bodyShell = buildThickShell(
      THREE,
      40,
      18,
      true,
      (u, v) => {
        const angle = u * Math.PI * 2;
        const y = mix(-0.128, 0.132, v);
        const puff = Math.sin(v * Math.PI) * 0.010;
        const ease = 0.026 + puff;
        return evalTorsoRing(angle, y, ease, ease * 1.05);
      },
      () => 0.010,
      [2, 1.5]
    );
    topGroup.add(tagSlot(new THREE.Mesh(bodyShell, mats.top), 'primary'));

    // Thick ribbed bottom hem band
    const hemShell = buildThickShell(
      THREE,
      36,
      6,
      true,
      (u, v) => {
        const angle = u * Math.PI * 2;
        const y = mix(-0.140, -0.105, v);
        const bulge = Math.sin(v * Math.PI) * 0.004;
        return evalTorsoRing(angle, y, 0.024 + bulge, 0.025 + bulge);
      },
      () => 0.009,
      [2, 0.5]
    );
    topGroup.add(tagSlot(new THREE.Mesh(hemShell, mats.topTrim), 'primary'));

    // Sculpted resting hood draped thickly behind neck & shoulders
    const hoodShell = buildThickShell(
      THREE,
      30,
      12,
      false,
      (u, v) => {
        // u goes from right front collar around back to left front collar
        const angle = mix(0.16 * Math.PI, 1.84 * Math.PI, u);
        const backness = Math.sin(u * Math.PI); // 0 at front throat, 1 at center back
        const yBase = 0.118 - backness * 0.024;
        const yFold = yBase + Math.sin(v * Math.PI) * (0.040 + backness * 0.036);
        const radOut = 0.070 + backness * 0.068 + v * (0.038 + backness * 0.035);
        const x = Math.sin(angle) * radOut;
        const z = Math.cos(angle) * radOut - backness * 0.025;
        return [x, yFold, z];
      },
      () => 0.011,
      [1.5, 1]
    );
    topGroup.add(tagSlot(new THREE.Mesh(hoodShell, mats.top), 'primary'));

    // Kangaroo front pocket (curved bezier ExtrudeGeometry bent over belly)
    const pShape = new THREE.Shape();
    pShape.moveTo(-0.088, -0.044);
    pShape.lineTo(0.088, -0.044);
    pShape.bezierCurveTo(0.090, -0.018, 0.072, 0.014, 0.056, 0.040);
    pShape.lineTo(-0.056, 0.040);
    pShape.bezierCurveTo(-0.072, 0.014, -0.090, -0.018, -0.088, -0.044);

    const pGeo = new THREE.ExtrudeGeometry(pShape, {
      depth: 0.010,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.003,
      bevelSegments: 2,
      curveSegments: 14,
    });
    const pPos = pGeo.attributes.position;
    for (let i = 0; i < pPos.count; i++) {
      const lx = pPos.getX(i);
      const ly = pPos.getY(i);
      const lz = pPos.getZ(i);
      const yLocal = -0.064 + ly;
      const angle = lx / 0.145;
      const surf = evalTorsoRing(angle, yLocal, 0.033, 0.035);
      pPos.setXYZ(i, surf[0], surf[1], surf[2] + lz);
    }
    pPos.needsUpdate = true;
    pGeo.computeVertexNormals();
    topGroup.add(tagSlot(new THREE.Mesh(pGeo, mats.topTrim), 'primary'));

    // Two dangling drawstrings with aglets
    for (const side of [1, -1]) {
      const dsCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.025, 0.118, 0.075),
        new THREE.Vector3(side * 0.029, 0.068, 0.112),
        new THREE.Vector3(side * (0.024 + side * 0.004), 0.018, 0.119),
        new THREE.Vector3(side * (0.028 - side * 0.004), -0.020, 0.118),
      ]);
      topGroup.add(tagSlot(
        new THREE.Mesh(buildTaperedTube(THREE, dsCurve, 16, 8, () => 0.0034), mats.drawstring),
        'accent'
      ));
      // Aglet tip
      const agletGeo = new THREE.CylinderGeometry(0.0042, 0.0038, 0.015, 10);
      const aglet = tagSlot(new THREE.Mesh(agletGeo, mats.metal), 'accent');
      aglet.position.copy(dsCurve.getPoint(1)).add(new THREE.Vector3(0, -0.006, 0));
      topGroup.add(aglet);
    }

    addSleeve(armCurves.armL, armCurves.curveL, 0.92, 0.016, mats.topTrim, false);
    addSleeve(armCurves.armR, armCurves.curveR, 0.92, 0.016, mats.topTrim, false);
  } else if (style === 'tee') {
    // Neat casual t-shirt thick shell
    const bodyShell = buildThickShell(
      THREE,
      40,
      16,
      true,
      (u, v) => {
        const angle = u * Math.PI * 2;
        const y = mix(-0.125, 0.130, v);
        return evalTorsoRing(angle, y, 0.018, 0.019);
      },
      () => 0.008,
      [2, 1.5]
    );
    topGroup.add(tagSlot(new THREE.Mesh(bodyShell, mats.top), 'primary'));

    // Ribbed crew-neck collar ring (LatheGeometry)
    const collarPts = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      collarPts.push(new THREE.Vector2(0.062 + Math.cos(a) * 0.010, 0.128 + Math.sin(a) * 0.010));
    }
    const collarGeo = new THREE.LatheGeometry(collarPts, 28);
    collarGeo.scale(1.06, 1.0, 0.94);
    topGroup.add(tagSlot(new THREE.Mesh(collarGeo, mats.topTrim), 'primary'));

    // Cute curved left chest pocket
    const cpShape = new THREE.Shape();
    cpShape.moveTo(-0.024, 0.026);
    cpShape.lineTo(0.024, 0.026);
    cpShape.lineTo(0.024, -0.014);
    cpShape.bezierCurveTo(0.014, -0.026, -0.014, -0.026, -0.024, -0.014);
    cpShape.closePath();
    const cpGeo = new THREE.ExtrudeGeometry(cpShape, {
      depth: 0.005,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.002,
      bevelSegments: 2,
    });
    const cpPos = cpGeo.attributes.position;
    for (let i = 0; i < cpPos.count; i++) {
      const lx = cpPos.getX(i), ly = cpPos.getY(i), lz = cpPos.getZ(i);
      const surf = evalTorsoRing(0.36 + lx / 0.13, 0.036 + ly, 0.020, 0.021);
      cpPos.setXYZ(i, surf[0], surf[1], surf[2] + lz);
    }
    cpPos.needsUpdate = true;
    cpGeo.computeVertexNormals();
    topGroup.add(tagSlot(new THREE.Mesh(cpGeo, mats.topTrim), 'primary'));

    // Short sleeves ending mid-upper-arm (bare elbows/forearms visible!)
    addSleeve(armCurves.armL, armCurves.curveL, 0.44, 0.012, mats.topTrim, false);
    addSleeve(armCurves.armR, armCurves.curveR, 0.44, 0.012, mats.topTrim, false);
  } else if (style === 'shirt') {
    // Crisp button-up dorm shirt with gently curved shirttail hem
    const bodyShell = buildThickShell(
      THREE,
      40,
      16,
      true,
      (u, v) => {
        const angle = u * Math.PI * 2;
        const sideLift = Math.pow(Math.sin(angle), 2) * 0.018 * (1 - v);
        const y = mix(-0.135 + sideLift, 0.132, v);
        return evalTorsoRing(angle, y, 0.019, 0.020);
      },
      () => 0.008,
      [2, 1.5]
    );
    topGroup.add(tagSlot(new THREE.Mesh(bodyShell, mats.top), 'primary'));

    // Raised collar stand around neck
    const standShell = buildThickShell(
      THREE,
      28,
      6,
      true,
      (u, v) => {
        const angle = u * Math.PI * 2;
        const y = mix(0.122, 0.156, v);
        const r = 0.062 - v * 0.005;
        return [Math.sin(angle) * r, y, Math.cos(angle) * (r * 0.92)];
      },
      () => 0.005
    );
    topGroup.add(tagSlot(new THREE.Mesh(standShell, mats.topTrim), 'primary'));

    // Two crisp bent bezier-extruded folded collar flaps
    for (const side of [1, -1]) {
      const fShape = new THREE.Shape();
      fShape.moveTo(0, 0);
      fShape.bezierCurveTo(0.025, 0.008, 0.058, 0.002, 0.074, -0.022);
      fShape.bezierCurveTo(0.056, -0.044, 0.022, -0.046, 0.004, -0.032);
      fShape.closePath();
      const fGeo = new THREE.ExtrudeGeometry(fShape, {
        depth: 0.004,
        bevelEnabled: true,
        bevelThickness: 0.0018,
        bevelSize: 0.0015,
        bevelSegments: 2,
        curveSegments: 12,
      });
      const fp = fGeo.attributes.position;
      for (let i = 0; i < fp.count; i++) {
        const lx = fp.getX(i), ly = fp.getY(i), lz = fp.getZ(i);
        const ang = side * (0.14 + lx * 14.0);
        const yLocal = 0.145 + ly;
        const r = 0.068 + (-ly) * 0.55;
        fp.setXYZ(i, Math.sin(ang) * (r + lz), yLocal, Math.cos(ang) * (r + lz));
      }
      fp.needsUpdate = true;
      if (side < 0) {
        const idx = fGeo.index;
        if (idx) {
          for (let i = 0; i < idx.count; i += 3) {
            const b = idx.getX(i + 1);
            idx.setX(i + 1, idx.getX(i + 2));
            idx.setX(i + 2, b);
          }
        }
      }
      fGeo.computeVertexNormals();
      topGroup.add(tagSlot(new THREE.Mesh(fGeo, mats.topTrim), 'primary'));
    }

    // Center front button placket + 4 LatheGeometry buttons
    const placketShell = buildThickShell(
      THREE,
      6,
      14,
      false,
      (u, v) => {
        const angle = (u - 0.5) * 0.24;
        const y = mix(-0.132, 0.125, v);
        return evalTorsoRing(angle, y, 0.024, 0.025);
      },
      () => 0.005
    );
    topGroup.add(tagSlot(new THREE.Mesh(placketShell, mats.topTrim), 'primary'));

    const btnPts = [
      new THREE.Vector2(0, -0.002),
      new THREE.Vector2(0.007, -0.002),
      new THREE.Vector2(0.0085, 0.0),
      new THREE.Vector2(0.0075, 0.0028),
      new THREE.Vector2(0.004, 0.0032),
      new THREE.Vector2(0, 0.0022),
    ];
    const btnGeo = new THREE.LatheGeometry(btnPts, 16);
    btnGeo.rotateX(Math.PI * 0.5);
    for (let i = 0; i < 4; i++) {
      const y = 0.088 - i * 0.056;
      const p = evalTorsoRing(0, y, 0.026, 0.027);
      const btn = tagSlot(new THREE.Mesh(btnGeo, mats.button), 'accent');
      btn.position.set(p[0], p[1], p[2]);
      topGroup.add(btn);
    }

    // 3/4 rolled-up cuffed sleeves
    addSleeve(armCurves.armL, armCurves.curveL, 0.70, 0.014, mats.topTrim, true);
    addSleeve(armCurves.armR, armCurves.curveR, 0.70, 0.014, mats.topTrim, true);
  } else if (style === 'cardigan') {
    // Inner cream crew-neck undershirt visible inside open V-front
    const innerShell = buildThickShell(
      THREE,
      36,
      14,
      true,
      (u, v) => {
        const angle = u * Math.PI * 2;
        const y = mix(-0.124, 0.128, v);
        return evalTorsoRing(angle, y, 0.013, 0.014);
      },
      () => 0.006
    );
    topGroup.add(tagSlot(new THREE.Mesh(innerShell, mats.undershirt), 'accent'));

    // Open-front knitted cardigan shell (!closedU)
    const cardiShell = buildThickShell(
      THREE,
      38,
      18,
      false,
      (u, v) => {
        // V-neck opens wider at top (v=1), closes to cozy narrow gap at bottom (v=0)
        const vGap = mix(0.075, 0.25, Math.pow(v, 1.35)) * Math.PI;
        const angle = mix(vGap, Math.PI * 2 - vGap, u);
        const y = mix(-0.138, 0.130, v);
        const slouch = Math.sin(v * Math.PI) * 0.008;
        return evalTorsoRing(angle, y, 0.026 + slouch, 0.027 + slouch);
      },
      () => 0.011,
      [2.2, 1.6]
    );
    topGroup.add(tagSlot(new THREE.Mesh(cardiShell, mats.top), 'primary'));

    // Chunky ribbed knit front placket borders along left & right edges
    for (const side of [1, -1]) {
      const bandPts = [];
      for (let i = 0; i <= 10; i++) {
        const v = i / 10;
        const vGap = mix(0.075, 0.25, Math.pow(v, 1.35)) * Math.PI;
        const y = mix(-0.136, 0.128, v);
        const p = evalTorsoRing(side * vGap, y, 0.028, 0.029);
        bandPts.push(new THREE.Vector3(p[0], p[1], p[2]));
      }
      const bandCurve = new THREE.CatmullRomCurve3(bandPts);
      topGroup.add(tagSlot(
        new THREE.Mesh(buildTaperedTube(THREE, bandCurve, 16, 10, () => [0.009, 0.012]), mats.topTrim),
        'primary'
      ));
    }

    // 3 chunky wooden/accent cardigan buttons along left placket
    const cBtnGeo = new THREE.CylinderGeometry(0.0105, 0.0105, 0.0055, 16);
    cBtnGeo.rotateX(Math.PI * 0.5);
    for (let i = 0; i < 3; i++) {
      const v = 0.16 + i * 0.21;
      const vGap = mix(0.075, 0.25, Math.pow(v, 1.35)) * Math.PI;
      const y = mix(-0.136, 0.128, v);
      const p = evalTorsoRing(vGap + 0.05, y, 0.032, 0.034);
      const b = tagSlot(new THREE.Mesh(cBtnGeo, mats.woodButton), 'accent');
      b.position.set(p[0], p[1], p[2]);
      b.rotation.y = 0.28;
      topGroup.add(b);
    }

    // Two cozy low patch pockets
    for (const side of [1, -1]) {
      const pkShape = new THREE.Shape();
      pkShape.moveTo(-0.028, 0.024);
      pkShape.lineTo(0.028, 0.024);
      pkShape.lineTo(0.028, -0.016);
      pkShape.bezierCurveTo(0.020, -0.028, -0.020, -0.028, -0.028, -0.016);
      pkShape.closePath();
      const pkGeo = new THREE.ExtrudeGeometry(pkShape, {
        depth: 0.007,
        bevelEnabled: true,
        bevelThickness: 0.003,
        bevelSize: 0.0025,
        bevelSegments: 2,
      });
      const pp = pkGeo.attributes.position;
      for (let i = 0; i < pp.count; i++) {
        const lx = pp.getX(i), ly = pp.getY(i), lz = pp.getZ(i);
        const surf = evalTorsoRing(side * 0.56 + lx / 0.135, -0.075 + ly, 0.029, 0.031);
        pp.setXYZ(i, surf[0], surf[1], surf[2] + lz);
      }
      pp.needsUpdate = true;
      pkGeo.computeVertexNormals();
      topGroup.add(tagSlot(new THREE.Mesh(pkGeo, mats.topTrim), 'primary'));
    }

    // Slouchy long knit sleeves with chunky cuffs
    addSleeve(armCurves.armL, armCurves.curveL, 0.92, 0.018, mats.topTrim, true);
    addSleeve(armCurves.armR, armCurves.curveR, 0.92, 0.018, mats.topTrim, true);
  }

  return topGroup;
}

function buildBottomClothes(THREE, opts, mats, torsoGroup, legL, legR, legCurveL, legCurveR) {
  const style = opts.bottom;

  // Pelvis/waistband wrap sits on lower torso (inside top hem radius for clip-free layering)
  const hipWrap = buildThickShell(
    THREE,
    36,
    10,
    true,
    (u, v) => {
      const angle = u * Math.PI * 2;
      const y = mix(-0.175, -0.088, v);
      return evalTorsoRing(angle, y, 0.012, 0.013);
    },
    () => 0.008,
    [2, 0.8]
  );
  torsoGroup.add(tagSlot(new THREE.Mesh(hipWrap, mats.bottom), 'secondary'));

  // Helper to add cozy ribbed crew socks on bare-leg styles (shorts & skirt)
  function addCrewSock(legGroup, curve) {
    const sockCurve = new THREE.CatmullRomCurve3(
      Array.from({ length: 8 }, (_, i) => curve.getPoint(mix(0.73, 0.96, i / 7)))
    );
    const sockGeo = buildTaperedTube(
      THREE,
      sockCurve,
      14,
      16,
      (t) => {
        const legT = mix(0.73, 0.96, t);
        const legR = mix(0.044, 0.029, legT);
        const rib = Math.sin(t * Math.PI * 6) * 0.0012;
        return legR + 0.0055 + rib;
      },
      { capStart: true, capEnd: true }
    );
    legGroup.add(tagSlot(new THREE.Mesh(sockGeo, mats.sock), 'accent'));

    // Cute accent top stripe ring on sock
    const stripeCurve = new THREE.CatmullRomCurve3(
      Array.from({ length: 4 }, (_, i) => curve.getPoint(mix(0.745, 0.775, i / 3)))
    );
    const stripeGeo = buildTaperedTube(THREE, stripeCurve, 6, 16, () => 0.0405);
    legGroup.add(tagSlot(new THREE.Mesh(stripeGeo, mats.topTrim), 'primary'));
  }

  if (style === 'trousers') {
    for (const [legGroup, curve] of [[legL, legCurveL], [legR, legCurveR]]) {
      const pantCurve = new THREE.CatmullRomCurve3(
        Array.from({ length: 12 }, (_, i) => curve.getPoint(mix(0.06, 0.89, i / 11)))
      );
      const pantGeo = buildTaperedTube(
        THREE,
        pantCurve,
        20,
        18,
        (t) => {
          const legT = mix(0.06, 0.89, t);
          const legR = mix(0.048, 0.030, legT);
          return legR + 0.017 + Math.sin(t * Math.PI) * 0.003;
        },
        { capStart: true, capEnd: true, uvScaleU: 1.5, uvScaleV: 2 }
      );
      legGroup.add(tagSlot(new THREE.Mesh(pantGeo, mats.bottom), 'secondary'));

      // Rolled trouser cuff right above shoe collar
      const cuffCurve = new THREE.CatmullRomCurve3(
        Array.from({ length: 5 }, (_, i) => curve.getPoint(mix(0.84, 0.91, i / 4)))
      );
      const cuffGeo = buildTaperedTube(THREE, cuffCurve, 8, 18, (t) => 0.050 + Math.sin(t * Math.PI) * 0.004);
      legGroup.add(tagSlot(new THREE.Mesh(cuffGeo, mats.bottomTrim), 'secondary'));
    }
  } else if (style === 'shorts') {
    for (const [legGroup, curve] of [[legL, legCurveL], [legR, legCurveR]]) {
      const shortCurve = new THREE.CatmullRomCurve3(
        Array.from({ length: 8 }, (_, i) => curve.getPoint(mix(0.06, 0.43, i / 7)))
      );
      const shortGeo = buildTaperedTube(
        THREE,
        shortCurve,
        12,
        18,
        (t) => {
          const legT = mix(0.06, 0.43, t);
          const legR = mix(0.049, 0.041, legT);
          return legR + 0.019 + t * 0.004;
        },
        { capStart: true, capEnd: true, uvScaleU: 1.5, uvScaleV: 1 }
      );
      legGroup.add(tagSlot(new THREE.Mesh(shortGeo, mats.bottom), 'secondary'));

      // Hemmed cuff band
      const cuffCurve = new THREE.CatmullRomCurve3(
        Array.from({ length: 4 }, (_, i) => curve.getPoint(mix(0.38, 0.45, i / 3)))
      );
      const cuffGeo = buildTaperedTube(THREE, cuffCurve, 6, 18, (t) => 0.063 + Math.sin(t * Math.PI) * 0.003);
      legGroup.add(tagSlot(new THREE.Mesh(cuffGeo, mats.bottomTrim), 'secondary'));

      addCrewSock(legGroup, curve);
    }
  } else if (style === 'skirt') {
    // Sculpted thick pleated dorm skirt flaring smoothly below top hem!
    const pleats = 14;
    const skirtGeo = buildThickShell(
      THREE,
      pleats * 4,
      14,
      true,
      (u, v) => {
        const angle = u * Math.PI * 2;
        // v = 0 is bottom hem (torso-local y = -0.255 -> world 0.250), v = 1 is waist (y = -0.095)
        const y = mix(-0.258, -0.095, v);
        // Keep tight inside top hem above v = 0.72, then flare cleanly outward below
        const flareT = smoothstep(0.82, 0.0, v);
        const pleatWave = Math.sin(angle * pleats) * 0.011 * Math.pow(flareT, 0.9);
        const baseR = mix(0.116, 0.168, flareT) + pleatWave;
        const rx = baseR * 1.04;
        const rz = baseR * 0.92;
        return [Math.sin(angle) * rx, y, Math.cos(angle) * rz];
      },
      () => 0.0085,
      [3.5, 1.2]
    );
    torsoGroup.add(tagSlot(new THREE.Mesh(skirtGeo, mats.bottom), 'secondary'));

    // Modesty undershorts tucked safely inside skirt
    for (const [legGroup, curve] of [[legL, legCurveL], [legR, legCurveR]]) {
      const underCurve = new THREE.CatmullRomCurve3(
        Array.from({ length: 6 }, (_, i) => curve.getPoint(mix(0.08, 0.30, i / 5)))
      );
      const underGeo = buildTaperedTube(THREE, underCurve, 8, 12, () => 0.048);
      legGroup.add(tagSlot(new THREE.Mesh(underGeo, mats.bottomTrim), 'secondary', false, true));

      addCrewSock(legGroup, curve);
    }
  }
}

// ---------------------------------------------------------------------------
// Main Build Export
// ---------------------------------------------------------------------------

export function build(THREE, rawOpts, kit) {
  const opts = {
    skin: rawOpts?.skin ?? '#f2c7a8',
    hairStyle: rawOpts?.hairStyle ?? 'bob',
    hairColor: rawOpts?.hairColor ?? '#3b2922',
    eye: rawOpts?.eye ?? '#497391',
    top: rawOpts?.top ?? 'hoodie',
    topColor: rawOpts?.topColor ?? '#6d8da6',
    bottom: rawOpts?.bottom ?? 'trousers',
    bottomColor: rawOpts?.bottomColor ?? '#3c4558',
    shoeColor: rawOpts?.shoeColor ?? '#d66853',
    glasses: rawOpts?.glasses ?? 'none',
    blush: rawOpts?.blush !== undefined ? !!rawOpts.blush : true,
  };

  const colors = {
    skin: makeColor(THREE, opts.skin, '#f2c7a8'),
    hair: makeColor(THREE, opts.hairColor, '#3b2922'),
    eye: makeColor(THREE, opts.eye, '#497391'),
    top: makeColor(THREE, opts.topColor, '#6d8da6'),
    bottom: makeColor(THREE, opts.bottomColor, '#3c4558'),
    shoe: makeColor(THREE, opts.shoeColor, '#d66853'),
  };

  const tex = makeTextures(THREE, opts, kit, colors);

  // MeshPhysicalMaterial library
  const mats = {
    skin: new THREE.MeshPhysicalMaterial({
      map: tex.skinMap,
      bumpMap: tex.skinBump,
      bumpScale: 0.0012,
      roughness: 0.72,
      metalness: 0.0,
      sheen: 0.38,
      sheenRoughness: 0.75,
      sheenColor: shiftColor(THREE, colors.skin, -0.02, 0.12, 0.12),
    }),
    innerEar: new THREE.MeshPhysicalMaterial({
      color: shiftColor(THREE, colors.skin, -0.025, 0.22, -0.07),
      roughness: 0.78,
      sheen: 0.3,
      sheenColor: shiftColor(THREE, colors.skin, -0.01, 0.15, 0.05),
    }),
    hair: new THREE.MeshPhysicalMaterial({
      map: tex.hairMap,
      bumpMap: tex.hairBump,
      bumpScale: opts.hairStyle === 'afro' || opts.hairStyle === 'buzz' ? 0.006 : 0.0035,
      roughness: opts.hairStyle === 'afro' || opts.hairStyle === 'buzz' ? 0.88 : 0.64,
      metalness: 0.0,
      sheen: 0.72,
      sheenRoughness: 0.55,
      sheenColor: shiftColor(THREE, colors.hair, 0.01, -0.05, 0.24),
    }),
    brow: new THREE.MeshPhysicalMaterial({
      color: shiftColor(THREE, colors.hair, 0, 0.04, -0.06),
      roughness: 0.75,
      sheen: 0.4,
      sheenColor: shiftColor(THREE, colors.hair, 0, 0, 0.15),
    }),
    lash: new THREE.MeshPhysicalMaterial({
      color: '#1b151a',
      roughness: 0.42,
    }),
    eyeGloss: new THREE.MeshPhysicalMaterial({
      color: '#17141c',
      roughness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    }),
    eyeIris: new THREE.MeshPhysicalMaterial({
      map: tex.irisMap,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    }),
    eyeHighlight: new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      emissive: '#ffffff',
      emissiveIntensity: 0.35,
      roughness: 0.04,
      clearcoat: 1.0,
    }),
    mouth: new THREE.MeshPhysicalMaterial({
      color: shiftColor(THREE, colors.skin, -0.04, 0.18, -0.34),
      roughness: 0.45,
    }),
    mouthInside: new THREE.MeshPhysicalMaterial({
      color: '#c95c68',
      roughness: 0.48,
      side: THREE.DoubleSide,
    }),
    blush: new THREE.MeshPhysicalMaterial({
      map: tex.blushMap,
      transparent: true,
      opacity: 0.85,
      roughness: 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
    top: new THREE.MeshPhysicalMaterial({
      map: tex.topMap,
      bumpMap: tex.topBump,
      bumpScale: opts.top === 'cardigan' ? 0.0055 : 0.0028,
      roughness: 0.90,
      sheen: 0.82,
      sheenRoughness: 0.80,
      sheenColor: shiftColor(THREE, colors.top, 0, -0.08, 0.22),
    }),
    topTrim: new THREE.MeshPhysicalMaterial({
      color: shiftColor(THREE, colors.top, 0, 0.03, -0.065),
      bumpMap: tex.topBump,
      bumpScale: 0.0032,
      roughness: 0.92,
      sheen: 0.78,
      sheenRoughness: 0.82,
      sheenColor: shiftColor(THREE, colors.top, 0, -0.05, 0.16),
    }),
    undershirt: new THREE.MeshPhysicalMaterial({
      color: '#f2ece1',
      roughness: 0.92,
      sheen: 0.7,
      sheenColor: '#ffffff',
    }),
    drawstring: new THREE.MeshPhysicalMaterial({
      color: '#eee7da',
      roughness: 0.90,
      sheen: 0.65,
      sheenColor: '#ffffff',
    }),
    bottom: new THREE.MeshPhysicalMaterial({
      map: tex.bottomMap,
      bumpMap: tex.bottomBump,
      bumpScale: 0.003,
      roughness: 0.91,
      sheen: 0.72,
      sheenRoughness: 0.85,
      sheenColor: shiftColor(THREE, colors.bottom, 0, -0.06, 0.20),
    }),
    bottomTrim: new THREE.MeshPhysicalMaterial({
      color: shiftColor(THREE, colors.bottom, 0, 0.02, -0.06),
      roughness: 0.93,
      sheen: 0.68,
      sheenColor: shiftColor(THREE, colors.bottom, 0, -0.04, 0.14),
    }),
    sock: new THREE.MeshPhysicalMaterial({
      color: '#f3eee4',
      roughness: 0.94,
      sheen: 0.80,
      sheenColor: '#ffffff',
    }),
    shoe: new THREE.MeshPhysicalMaterial({
      map: tex.shoeMap,
      roughness: 0.78,
      sheen: 0.55,
      sheenColor: shiftColor(THREE, colors.shoe, 0, -0.06, 0.22),
    }),
    shoeTrim: new THREE.MeshPhysicalMaterial({
      color: shiftColor(THREE, colors.shoe, 0, 0.04, -0.09),
      roughness: 0.82,
      sheen: 0.50,
      sheenColor: shiftColor(THREE, colors.shoe, 0, 0, 0.14),
    }),
    sole: new THREE.MeshPhysicalMaterial({
      color: '#ede7dc',
      bumpMap: tex.soleBump,
      bumpScale: 0.0025,
      roughness: 0.84,
    }),
    accentSoft: new THREE.MeshPhysicalMaterial({
      color: colors.shoe,
      roughness: 0.86,
      sheen: 0.85,
      sheenColor: shiftColor(THREE, colors.shoe, 0, -0.06, 0.24),
    }),
    button: new THREE.MeshPhysicalMaterial({
      color: '#eae4d8',
      roughness: 0.28,
      clearcoat: 0.45,
    }),
    woodButton: new THREE.MeshPhysicalMaterial({
      color: '#6e4a31',
      roughness: 0.52,
      clearcoat: 0.2,
    }),
    metal: new THREE.MeshPhysicalMaterial({
      color: '#c9c2b8',
      roughness: 0.30,
      metalness: 0.72,
    }),
    glassesFrame: new THREE.MeshPhysicalMaterial({
      color: opts.glasses === 'round' ? '#b88f54' : '#2d2624',
      roughness: 0.26,
      metalness: opts.glasses === 'round' ? 0.65 : 0.18,
      clearcoat: 0.55,
    }),
    glassesLens: new THREE.MeshPhysicalMaterial({
      color: '#e8f4ff',
      transparent: true,
      opacity: 0.20,
      roughness: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  };

  // Root group & required named hierarchy
  const root = new THREE.Group();
  root.name = 'chibiStudent';

  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.set(0, 0.505, 0);
  body.add(torso);

  // 1. Sculpted continuous torso body core
  const torsoGeo = sculptSphere(THREE, 1, 48, 32, deformTorsoVertex);
  torso.add(tagSlot(new THREE.Mesh(torsoGeo, mats.skin), 'skin'));

  // 2. Sculpted neck (LatheGeometry overlapping deeply into torso and head)
  const neckPts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const y = mix(0.098, 0.210, t);
    const r = 0.056 * (1 - smoothstep(0, 0.42, t)) + 0.041 * smoothstep(0, 0.42, t) + smoothstep(0.72, 1.0, t) * 0.008;
    neckPts.push(new THREE.Vector2(r, y));
  }
  const neckGeo = new THREE.LatheGeometry(neckPts, 24);
  torso.add(tagSlot(new THREE.Mesh(neckGeo, mats.skin), 'skin'));

  // 3. Head group (attached to torso so breathing/sway naturally carries it)
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 0.170, 0); // world y = 0.675 -> head top at 1.075, hair ~1.10 m!
  head.rotation.set(0.02, -0.055, 0.055);
  torso.add(head);

  const headGeo = sculptSphere(THREE, 1, 56, 40, deformHeadVertex);
  head.add(tagSlot(new THREE.Mesh(headGeo, mats.skin), 'skin'));

  const { earGroupL, earGroupR } = buildEars(THREE, mats);
  head.add(earGroupL, earGroupR);

  const face = buildFaceFeatures(THREE, opts, mats);
  head.add(face.eyeL, face.eyeR, face.brows.L, face.brows.R, face.mouthGroup);
  for (const bm of face.blushMeshes) head.add(bm);

  const { hairGroup, secondaryGroup: hairSecondary } = buildHair(THREE, opts, kit, mats);
  head.add(hairGroup);

  const glassesGroup = buildGlasses(THREE, opts.glasses, mats);
  if (glassesGroup) head.add(glassesGroup);

  // 4. Arms (asymmetric natural chibi pose + mitten hands with thumbs)
  const armL = new THREE.Group();
  armL.name = 'armL';
  armL.position.set(0.122, 0.095, -0.004);
  torso.add(armL);

  const armR = new THREE.Group();
  armR.name = 'armR';
  armR.position.set(-0.122, 0.095, -0.004);
  torso.add(armR);

  // Arm curves in each arm's local space (starting deeply inside shoulder)
  const armCurveL = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.020, 0.010, 0.0),
    new THREE.Vector3(0.044, -0.056, -0.006),
    new THREE.Vector3(0.072, -0.142, 0.018),
    new THREE.Vector3(0.054, -0.228, 0.054),
  ]);

  const armCurveR = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.020, 0.010, 0.0),
    new THREE.Vector3(-0.048, -0.052, 0.006),
    new THREE.Vector3(-0.084, -0.130, 0.036),
    new THREE.Vector3(-0.068, -0.162, 0.118),
  ]);

  function populateArm(armGroup, curve, side) {
    const geo = buildTaperedTube(THREE, curve, 20, 16, (t) => {
      const base = mix(0.035, 0.021, t);
      const elbow = Math.exp(-Math.pow((t - 0.52) / 0.16, 2)) * 0.0022;
      return base + elbow;
    });
    armGroup.add(tagSlot(new THREE.Mesh(geo, mats.skin), 'skin'));

    const hand = buildMittenHand(THREE, side, mats);
    const wristPt = curve.getPoint(0.98);
    const wristTan = curve.getTangent(0.98).normalize();
    hand.position.copy(wristPt);
    hand.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), wristTan);
    if (side < 0) hand.rotateY(0.35);
    armGroup.add(hand);
  }
  populateArm(armL, armCurveL, 1);
  populateArm(armR, armCurveR, -1);

  // 5. Legs + Shoes (weight grounded flat on floor y = 0)
  const legL = new THREE.Group();
  legL.name = 'legL';
  legL.position.set(0.066, 0.378, 0.008);
  body.add(legL);

  const legR = new THREE.Group();
  legR.name = 'legR';
  legR.position.set(-0.066, 0.378, -0.006);
  body.add(legR);

  const legCurveL = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.042, 0),
    new THREE.Vector3(0.004, -0.080, 0.008),
    new THREE.Vector3(0.006, -0.195, 0.012),
    new THREE.Vector3(0.006, -0.318, 0.004),
  ]);

  const legCurveR = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.042, 0),
    new THREE.Vector3(-0.004, -0.080, 0.004),
    new THREE.Vector3(-0.006, -0.195, 0.006),
    new THREE.Vector3(-0.006, -0.318, -0.002),
  ]);

  function populateLeg(legGroup, curve, side, yaw) {
    const geo = buildTaperedTube(THREE, curve, 20, 16, (t) => {
      const base = mix(0.050, 0.029, t);
      const knee = Math.exp(-Math.pow((t - 0.56) / 0.14, 2)) * 0.002;
      const calf = Math.exp(-Math.pow((t - 0.74) / 0.14, 2)) * 0.003;
      return base + knee + calf;
    });
    legGroup.add(tagSlot(new THREE.Mesh(geo, mats.skin), 'skin'));

    const shoe = buildShoe(THREE, side, mats);
    const ankle = curve.getPoint(1);
    // Position shoe so sole bottom sits at exact world y = 0.000
    shoe.position.set(ankle.x, -legGroup.position.y, ankle.z + 0.004);
    shoe.rotation.y = yaw;
    legGroup.add(shoe);
  }
  populateLeg(legL, legCurveL, 1, 0.11);
  populateLeg(legR, legCurveR, -1, -0.14);

  // 6. Clothes (thick surfaces with hems, sleeves, collar/hood, pockets, socks)
  const topClothes = buildTopClothes(THREE, opts, mats, {
    armL,
    armR,
    curveL: armCurveL,
    curveR: armCurveR,
  });
  torso.add(topClothes);

  buildBottomClothes(THREE, opts, mats, torso, legL, legR, legCurveL, legCurveR);

  // Store animation & expression handles on root.userData (no globals needed!)
  root.userData.expression = 'awake';
  root.userData.rig = {
    body,
    torso,
    head,
    armL,
    armR,
    legL,
    legR,
    earL: earGroupL,
    earR: earGroupR,
    eyeL: face.eyeL,
    eyeR: face.eyeR,
    brows: face.brows,
    mouths: face.mouths,
    blushMat: mats.blush,
    hasBlush: opts.blush,
    hairSecondary,
    base: {
      torsoY: torso.position.y,
      headRotX: head.rotation.x,
      headRotY: head.rotation.y,
      headRotZ: head.rotation.z,
      earLRotZ: earGroupL.rotation.z,
      earRRotZ: earGroupR.rotation.z,
    },
  };

  setExpression(root, 'awake');
  return root;
}

// ---------------------------------------------------------------------------
// Expression Switching
// ---------------------------------------------------------------------------

export function setExpression(group, name) {
  const rig = group?.userData?.rig;
  if (!rig) return;

  const valid = ['asleep', 'awake', 'thinking', 'unsure', 'happy'];
  const expr = valid.includes(name) ? name : 'awake';
  group.userData.expression = expr;

  const showOpen = expr === 'awake' || expr === 'thinking' || expr === 'unsure';
  const showAsleep = expr === 'asleep';
  const showHappy = expr === 'happy';

  for (const eye of [rig.eyeL, rig.eyeR]) {
    const ud = eye.userData;
    ud.openGroup.visible = showOpen;
    ud.asleepGroup.visible = showAsleep;
    ud.happyGroup.visible = showHappy;
    eye.scale.y = 1;

    // Shift iris gently up-and-aside when thinking
    if (expr === 'thinking') {
      ud.irisGroup.position.set(0.0045, 0.0052, 0);
    } else {
      ud.irisGroup.position.set(0, 0, 0);
    }
  }

  // Swap sculpted mouth tube shapes
  for (const key of Object.keys(rig.mouths)) {
    rig.mouths[key].visible = key === expr;
  }

  // Pose eyebrows cleanly relative to stored rest transform
  const browL = rig.brows.L;
  const browR = rig.brows.R;
  browL.position.copy(browL.userData.basePos);
  browR.position.copy(browR.userData.basePos);
  browL.quaternion.copy(browL.userData.baseQuat);
  browR.quaternion.copy(browR.userData.baseQuat);

  if (expr === 'asleep') {
    browL.position.y -= 0.006;
    browR.position.y -= 0.006;
  } else if (expr === 'thinking') {
    browL.position.y += 0.007;
    browR.position.y -= 0.005;
    browL.rotateZ(-0.14);
    browR.rotateZ(-0.18);
  } else if (expr === 'unsure') {
    browL.position.y += 0.003;
    browR.position.y += 0.003;
    browL.rotateZ(-0.26);
    browR.rotateZ(0.26);
  } else if (expr === 'happy') {
    browL.position.y += 0.0085;
    browR.position.y += 0.0085;
  }

  // Slightly boost blush warmth when happy
  if (rig.hasBlush && rig.blushMat) {
    rig.blushMat.opacity = expr === 'happy' ? 1.0 : expr === 'asleep' ? 0.72 : 0.84;
  }
}

// ---------------------------------------------------------------------------
// Idle Animation
// ---------------------------------------------------------------------------

export function idle(group, t) {
  const rig = group?.userData?.rig;
  if (!rig) return;

  const expr = group.userData.expression || 'awake';
  const asleep = expr === 'asleep';
  const breathRate = asleep ? 1.35 : 2.05;
  const breath = Math.sin(t * breathRate);

  // Soft breathing on torso
  rig.torso.position.y = rig.base.torsoY + breath * (asleep ? 0.0055 : 0.0040);
  rig.torso.scale.set(
    1 + breath * 0.008,
    1 + breath * 0.005,
    1 + breath * 0.011
  );

  // Gentle weight sway
  rig.torso.rotation.z = Math.sin(t * 0.82) * (asleep ? 0.010 : 0.018);
  rig.torso.rotation.y = Math.sin(t * 0.54) * (asleep ? 0.012 : 0.026);

  // Charming head sway & sleepy nod
  const sleepNod = asleep ? 0.13 + Math.sin(t * 0.95) * 0.025 : 0;
  rig.head.rotation.z = rig.base.headRotZ + Math.sin(t * 0.88 + 0.6) * (asleep ? 0.016 : 0.036);
  rig.head.rotation.y = rig.base.headRotY + Math.sin(t * 0.60 + 1.1) * (asleep ? 0.015 : 0.052);
  rig.head.rotation.x = rig.base.headRotX + Math.sin(t * 1.42) * 0.018 + sleepNod;

  // Subtle cozy arm motion
  rig.armL.rotation.z = Math.sin(t * 1.05) * 0.022 + breath * 0.012;
  rig.armL.rotation.x = Math.sin(t * 0.85 + 0.4) * 0.018;
  rig.armR.rotation.x = Math.sin(t * 1.28 + 0.5) * (asleep ? 0.012 : 0.034);
  rig.armR.rotation.z = -breath * 0.014;

  // Tiny ear responsiveness
  rig.earL.rotation.z = rig.base.earLRotZ + Math.sin(t * 1.15) * 0.015;
  rig.earR.rotation.z = rig.base.earRRotZ - Math.sin(t * 1.15) * 0.015;

  // Secondary hair motion (ponytail or twin braids)
  if (rig.hairSecondary) {
    rig.hairSecondary.rotation.z = Math.sin(t * 1.55 - 0.5) * 0.032;
    rig.hairSecondary.rotation.x = Math.sin(t * 1.15 - 0.3) * 0.022;
  }

  // Periodic natural blink every ~3.8 s on open-eye expressions
  if (expr === 'awake' || expr === 'thinking' || expr === 'unsure') {
    const period = 3.8;
    const phase = ((t % period) + period) % period;
    let blinkScale = 1;
    if (phase > 3.56 && phase < 3.74) {
      const u = (phase - 3.56) / 0.18; // 0..1
      blinkScale = 1 - Math.sin(u * Math.PI) * 0.94;
    }
    rig.eyeL.scale.y = blinkScale;
    rig.eyeR.scale.y = blinkScale;
  } else {
    rig.eyeL.scale.y = 1;
    rig.eyeR.scale.y = 1;
  }
}
export const META = {
  id: 'unicorn-foal',
  name: 'Unicorn Foal',
  kind: 'creature',
  footprint: [0.24, 0.42],
  variants: ['Single', 'Pastel Bands', 'Starry'],
  note: 'Stylised cozy unicorn foal (~0.5 m tall) with lifted hoof, spiral glowing horn, and flowing tapered bezier-ribbon mane & tail.'
};

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

function makeColor(THREE, val, fallback) {
  const c = new THREE.Color();
  try {
    c.set(val !== undefined && val !== null ? val : fallback);
  } catch {
    c.set(fallback);
  }
  return c;
}

function mixColors(THREE, c1, c2, t) {
  return c1.clone().lerp(c2, clamp(t, 0, 1));
}

function rgbStr(c, alpha = 1) {
  const r = Math.round(clamp(c.r, 0, 1) * 255);
  const g = Math.round(clamp(c.g, 0, 1) * 255);
  const b = Math.round(clamp(c.b, 0, 1) * 255);
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
}

function shiftHSL(THREE, c, dh, ds, dl) {
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const out = new THREE.Color();
  out.setHSL((hsl.h + dh + 1) % 1, clamp(hsl.s + ds, 0, 1), clamp(hsl.l + dl, 0, 1));
  return out;
}

function computeParallelFrames(THREE, curve, segs, upHint) {
  const points = [];
  const tangents = [];
  const normals = [];
  const binormals = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    points.push(curve.getPoint(t));
    tangents.push(curve.getTangent(t).normalize());
  }

  const hint = (upHint ? upHint.clone() : new THREE.Vector3(0, 1, 0)).normalize();
  let n0 = hint.clone().addScaledVector(tangents[0], -hint.dot(tangents[0]));
  if (n0.lengthSq() < 1e-5) {
    const alt = Math.abs(tangents[0].y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    n0 = alt.addScaledVector(tangents[0], -alt.dot(tangents[0]));
  }
  n0.normalize();
  normals.push(n0);
  binormals.push(tangents[0].clone().cross(n0).normalize());

  const axis = new THREE.Vector3();
  for (let i = 1; i <= segs; i++) {
    const prevT = tangents[i - 1];
    const currT = tangents[i];
    axis.copy(prevT).cross(currT);
    const n = normals[i - 1].clone();
    if (axis.lengthSq() > 1e-10) {
      axis.normalize();
      const angle = Math.acos(clamp(prevT.dot(currT), -1, 1));
      n.applyAxisAngle(axis, angle);
    }
    n.addScaledVector(currT, -n.dot(currT)).normalize();
    normals.push(n);
    binormals.push(currT.clone().cross(n).normalize());
  }

  return { points, tangents, normals, binormals };
}

function buildTaperedTube(THREE, curve, radiusFn, segs = 24, radialSegs = 18, upHint = null, capStart = true, capEnd = true) {
  const { points, tangents, normals, binormals } = computeParallelFrames(THREE, curve, segs, upHint);
  const positions = [];
  const uvs = [];
  const indices = [];

  const ringStride = radialSegs + 1;
  const v = new THREE.Vector3();

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const rad = radiusFn(t);
    const rx = Array.isArray(rad) ? rad[0] : rad;
    const ry = Array.isArray(rad) ? rad[1] : rad;
    const p = points[i];
    const N = normals[i];
    const B = binormals[i];

    for (let j = 0; j <= radialSegs; j++) {
      const u = j / radialSegs;
      const a = u * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      v.copy(p).addScaledVector(N, ca * rx).addScaledVector(B, sa * ry);
      positions.push(v.x, v.y, v.z);
      uvs.push(u, t);
    }
  }

  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a00 = i * ringStride + j;
      const a10 = (i + 1) * ringStride + j;
      const a01 = i * ringStride + j + 1;
      const a11 = (i + 1) * ringStride + j + 1;
      indices.push(a00, a01, a10);
      indices.push(a01, a11, a10);
    }
  }

  if (capStart) {
    const cIdx = positions.length / 3;
    const r0 = radiusFn(0);
    const bulge = (Array.isArray(r0) ? Math.min(r0[0], r0[1]) : r0) * 0.35;
    v.copy(points[0]).addScaledVector(tangents[0], -bulge);
    positions.push(v.x, v.y, v.z);
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(cIdx, j + 1, j);
    }
  }

  if (capEnd) {
    const cIdx = positions.length / 3;
    const r1 = radiusFn(1);
    const bulge = (Array.isArray(r1) ? Math.min(r1[0], r1[1]) : r1) * 0.35;
    v.copy(points[segs]).addScaledVector(tangents[segs], bulge);
    positions.push(v.x, v.y, v.z);
    uvs.push(0.5, 1);
    const base = segs * ringStride;
    for (let j = 0; j < radialSegs; j++) {
      indices.push(cIdx, base + j, base + j + 1);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function buildTaperedRibbon(THREE, curve, widthFn, thickFn, rollFn, segs = 28, crossSegs = 10, upHint = null, uShift = 0) {
  const { points, tangents, normals, binormals } = computeParallelFrames(THREE, curve, segs, upHint);
  const positions = [];
  const uvs = [];
  const indices = [];

  const ringStride = crossSegs + 1;
  const v = new THREE.Vector3();
  const rN = new THREE.Vector3();
  const rB = new THREE.Vector3();

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = widthFn(t);
    const th = thickFn(t);
    const roll = rollFn ? rollFn(t) : 0;
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);

    rN.copy(normals[i]).multiplyScalar(cr).addScaledVector(binormals[i], sr);
    rB.copy(binormals[i]).multiplyScalar(cr).addScaledVector(normals[i], -sr);

    const p = points[i];
    for (let j = 0; j <= crossSegs; j++) {
      const f = j / crossSegs;
      const a = f * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      // Plump almond/ribbon cross-section with a subtle sculpted hair arch
      const lx = ca * w;
      const arch = (1 - ca * ca) * th * 0.42;
      const ly = sa * th * (0.76 + 0.24 * Math.abs(sa)) + arch;
      v.copy(p).addScaledVector(rB, lx).addScaledVector(rN, ly);
      positions.push(v.x, v.y, v.z);
      uvs.push(clamp(t + uShift * (1 - t) * 0.25, 0, 1), f);
    }
  }

  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < crossSegs; j++) {
      const a00 = i * ringStride + j;
      const a10 = (i + 1) * ringStride + j;
      const a01 = i * ringStride + j + 1;
      const a11 = (i + 1) * ringStride + j + 1;
      // Note: lx along B, ly along N -> angle a runs B -> N, opposite of N -> B
      indices.push(a00, a10, a01);
      indices.push(a01, a10, a11);
    }
  }

  // Watertight root cap
  const startCap = positions.length / 3;
  v.copy(points[0]).addScaledVector(tangents[0], -0.002);
  positions.push(v.x, v.y, v.z);
  uvs.push(0, 0.5);
  for (let j = 0; j < crossSegs; j++) {
    indices.push(startCap, j, j + 1);
  }

  // Fine pointed tip cap
  const endCap = positions.length / 3;
  v.copy(points[segs]).addScaledVector(tangents[segs], 0.003);
  positions.push(v.x, v.y, v.z);
  uvs.push(1, 0.5);
  const base = segs * ringStride;
  for (let j = 0; j < crossSegs; j++) {
    indices.push(endCap, base + j + 1, base + j);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function buildCurvedDisc(THREE, rx, ry, bulge, rings = 6, segs = 28) {
  const positions = [0, 0, bulge];
  const uvs = [0.5, 0.5];
  const indices = [];

  for (let r = 1; r <= rings; r++) {
    const rf = r / rings;
    const z = bulge * Math.sqrt(Math.max(0.02, 1 - rf * rf * 0.78));
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      positions.push(ca * rx * rf, sa * ry * rf, z);
      uvs.push(0.5 + 0.5 * ca * rf, 0.5 + 0.5 * sa * rf);
    }
  }

  const stride = segs + 1;
  for (let j = 0; j < segs; j++) {
    indices.push(0, 1 + j, 1 + j + 1);
  }
  for (let r = 1; r < rings; r++) {
    const row0 = 1 + (r - 1) * stride;
    const row1 = 1 + r * stride;
    for (let j = 0; j < segs; j++) {
      const a00 = row0 + j;
      const a10 = row1 + j;
      const a01 = row0 + j + 1;
      const a11 = row1 + j + 1;
      indices.push(a00, a10, a01);
      indices.push(a10, a11, a01);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function evalHeadPoint(nx, ny, nz, out) {
  // Base rounded chibi cranium
  let x = nx * 0.064;
  let y = ny * 0.067;
  let z = nz * 0.072;

  // Tapered forward muzzle
  const snout = Math.pow(Math.max(0, nz), 1.65) * Math.exp(-Math.pow((ny + 0.24) / 0.54, 2));
  z += snout * 0.058;
  y -= snout * 0.015;

  const muzzleNarrow = smoothstep(0.24, 0.96, nz);
  x *= 1 - 0.44 * muzzleNarrow;

  const tipTaper = smoothstep(0.46, 0.98, nz);
  y = y * (1 - 0.24 * tipTaper) - 0.010 * tipTaper;

  // Soft velvet nose pad slight fullness at tip
  const nosePad = Math.exp(-Math.pow((nz - 0.95) / 0.14, 2)) * Math.exp(-Math.pow((ny + 0.18) / 0.26, 2));
  z += nosePad * 0.005;

  // Gentle Arabian-foal nasal bridge dish
  const dish = Math.exp(-Math.pow((nz - 0.66) / 0.22, 2)) *
    Math.exp(-Math.pow((ny - 0.26) / 0.26, 2)) *
    Math.exp(-Math.pow(nx / 0.44, 2));
  y -= dish * 0.0075;
  z -= dish * 0.0045;

  // Cute dome forehead
  const brow = smoothstep(0.16, 0.78, ny) * smoothstep(-0.22, 0.62, nz);
  y += brow * 0.009;
  z += brow * 0.007;

  // Soft puffed chibi cheeks
  const absNx = Math.abs(nx);
  const cheek = Math.exp(-Math.pow((absNx - 0.78) / 0.34, 2)) *
    Math.exp(-Math.pow((ny + 0.18) / 0.36, 2)) *
    Math.exp(-Math.pow((nz - 0.14) / 0.44, 2));
  x += Math.sign(nx) * cheek * 0.011;
  y -= cheek * 0.0035;

  // Throat latch & soft jaw tuck
  const throat = smoothstep(-0.26, -0.86, ny) * smoothstep(0.25, -0.5, nz);
  y += throat * 0.010;

  // Shallow sculpted eye sockets so eyes nestle snugly inside
  const dEye = Math.hypot(absNx - 0.674, ny - 0.062, nz - 0.736);
  const socket = Math.exp(-Math.pow(dEye / 0.21, 2));
  x -= Math.sign(nx) * socket * 0.0048;
  z -= socket * 0.0048;

  // Subtle nostril dimples
  const dNos = Math.hypot(absNx - 0.27, ny + 0.12, nz - 0.955);
  const nostril = Math.exp(-Math.pow(dNos / 0.085, 2));
  z -= nostril * 0.0028;
  x -= Math.sign(nx) * nostril * 0.0012;

  out.set(x, y + 0.030, z + 0.018);
  return out;
}

function evalHeadSurface(THREE, nx, ny, nz) {
  const dir = new THREE.Vector3(nx, ny, nz).normalize();
  const pos = evalHeadPoint(dir.x, dir.y, dir.z, new THREE.Vector3());

  const up = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const t1 = up.clone().cross(dir).normalize();
  const t2 = dir.clone().cross(t1).normalize();
  const eps = 0.01;

  const d1 = dir.clone().addScaledVector(t1, eps).normalize();
  const d2 = dir.clone().addScaledVector(t2, eps).normalize();
  const p1 = evalHeadPoint(d1.x, d1.y, d1.z, new THREE.Vector3());
  const p2 = evalHeadPoint(d2.x, d2.y, d2.z, new THREE.Vector3());

  const normal = p1.sub(pos).cross(p2.sub(pos)).normalize();
  if (normal.dot(dir) < 0) normal.negate();
  return { pos, normal };
}

function buildSculptedHead(THREE) {
  const geom = new THREE.SphereGeometry(1, 56, 40);
  const pos = geom.attributes.position;
  const p = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    const ox = pos.getX(i);
    const oy = pos.getY(i);
    const oz = pos.getZ(i);
    // Determinant +1 rotation putting poles at +Z (nose tip) and -Z (back of skull)
    const nx = ox;
    const ny = -oz;
    const nz = oy;
    evalHeadPoint(nx, ny, nz, p);
    pos.setXYZ(i, p.x, p.y, p.z);
  }

  geom.computeVertexNormals();
  return geom;
}

function buildCheekPatch(THREE, side) {
  const centerDir = new THREE.Vector3(side * 0.72, -0.22, 0.66).normalize();
  const centerSurf = evalHeadSurface(THREE, centerDir.x, centerDir.y, centerDir.z);
  const N = centerSurf.normal;
  const tV = new THREE.Vector3(0, 1, 0).addScaledVector(N, -N.y).normalize();
  const tU = tV.clone().cross(N).normalize(); // tU x tV = +N

  const segs = 8;
  const positions = [];
  const uvs = [];
  const indices = [];
  const d = new THREE.Vector3();

  for (let j = 0; j <= segs; j++) {
    const v = j / segs;
    const angV = (v - 0.5) * 0.34;
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const angU = (u - 0.5) * 0.42;
      d.copy(centerDir).addScaledVector(tU, angU).addScaledVector(tV, angV).normalize();
      const s = evalHeadSurface(THREE, d.x, d.y, d.z);
      const pt = s.pos.addScaledVector(s.normal, 0.0010);
      positions.push(pt.x, pt.y, pt.z);
      uvs.push(u, v);
    }
  }

  const stride = segs + 1;
  for (let j = 0; j < segs; j++) {
    for (let i = 0; i < segs; i++) {
      const a00 = j * stride + i;
      const a10 = j * stride + i + 1;
      const a01 = (j + 1) * stride + i;
      const a11 = (j + 1) * stride + i + 1;
      indices.push(a00, a10, a01);
      indices.push(a10, a11, a01);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function buildSculptedTorso(THREE) {
  const geom = new THREE.SphereGeometry(1, 56, 40);
  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const ox = pos.getX(i);
    const oy = pos.getY(i);
    const oz = pos.getZ(i);
    // Determinant +1 rotation: +Z chest, -Z rump, +Y back, -Y belly
    const nx = ox;
    const ny = -oz;
    const nz = oy;
    const absNx = Math.abs(nx);

    let x = nx * 0.078;
    let y = ny * 0.072;
    let z = nz * 0.142;

    // Gentle saddle dip in mid-back
    const saddle = smoothstep(0.24, 0.85, ny) * Math.exp(-Math.pow((nz - 0.02) / 0.36, 2));
    y -= saddle * 0.013;

    // Soft raised withers & shoulder slope
    const withers = smoothstep(0.18, 0.85, ny) * Math.exp(-Math.pow((nz - 0.56) / 0.34, 2));
    y += withers * 0.017;

    // Plump rounded croup / rump
    const rump = smoothstep(0.04, 0.82, ny) * Math.exp(-Math.pow((nz + 0.56) / 0.38, 2));
    y += rump * 0.015;
    x *= 1 + 0.08 * Math.exp(-Math.pow((nz + 0.52) / 0.36, 2));

    // Gently tucked flank & soft flattened underside
    const flankTuck = smoothstep(-0.14, -0.86, ny) * smoothstep(0.18, -0.66, nz);
    y += flankTuck * 0.015;
    const flatUnder = smoothstep(-0.58, -1.0, ny);
    y += flatUnder * 0.007;

    // Broad cozy chest
    const chest = smoothstep(0.28, 0.95, nz) * Math.exp(-Math.pow((ny + 0.10) / 0.56, 2));
    z += chest * 0.012;
    x *= 1 + 0.04 * smoothstep(0.22, 0.68, nz) - 0.10 * smoothstep(0.72, 1.0, nz);

    // Subtle waist contour
    x *= 1 - 0.06 * Math.exp(-Math.pow(nz / 0.28, 2));

    // Subtle shoulder & haunch muscle swell for seamless limb transitions
    const shoulder = Math.exp(-Math.pow((nz - 0.58) / 0.26, 2)) *
      Math.exp(-Math.pow((ny + 0.26) / 0.36, 2)) *
      Math.exp(-Math.pow((absNx - 0.68) / 0.30, 2));
    x += Math.sign(nx) * shoulder * 0.006;

    const haunch = Math.exp(-Math.pow((nz + 0.58) / 0.28, 2)) *
      Math.exp(-Math.pow((ny + 0.16) / 0.38, 2)) *
      Math.exp(-Math.pow((absNx - 0.72) / 0.30, 2));
    x += Math.sign(nx) * haunch * 0.008;

    pos.setXYZ(i, x, y + 0.222, z - 0.015);
  }

  geom.computeVertexNormals();
  return geom;
}

function buildCurvedEar(THREE, scaleXY = 1.0, depthScale = 1.0) {
  const shape = new THREE.Shape();
  const s = scaleXY;
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.019 * s, 0.005 * s, 0.025 * s, 0.036 * s, 0.0028 * s, 0.078 * s);
  shape.quadraticCurveTo(0, 0.083 * s, -0.0028 * s, 0.078 * s);
  shape.bezierCurveTo(-0.025 * s, 0.036 * s, -0.019 * s, 0.005 * s, 0, 0);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0055 * depthScale,
    bevelEnabled: true,
    bevelThickness: 0.0032 * depthScale,
    bevelSize: 0.0026 * s,
    bevelSegments: 4,
    curveSegments: 24
  });

  geom.translate(0, 0, -0.00275 * depthScale);

  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = clamp(y / (0.083 * s), 0, 1);
    const cup = (x * x) * (17.5 / Math.max(0.5, s)) * (1 - 0.32 * t);
    const sweepZ = Math.pow(t, 1.75) * 0.012 * s;
    const taperZ = 1 - 0.54 * t;
    pos.setXYZ(i, x, y, z * taperZ + cup + sweepZ);
    uv.setXY(i, clamp(0.5 + x / (0.048 * s), 0, 1), t);
  }

  geom.computeVertexNormals();
  return geom;
}

function buildSpiralHorn(THREE) {
  const pts = [];
  const totalH = 0.108;
  const steps = 36;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = t * totalH;
    let r;
    if (t < 0.07) {
      // Softly flared pearly base buried slightly into forehead
      const k = t / 0.07;
      r = lerp(0.0125, 0.0154, smoothstep(0, 1, k));
    } else if (t < 0.94) {
      const k = (t - 0.07) / 0.87;
      r = lerp(0.0154, 0.0022, Math.pow(k, 0.94));
    } else {
      // Smooth rounded magical tip
      const k = (t - 0.94) / 0.06;
      r = Math.max(0.0002, 0.0022 * Math.cos(k * Math.PI * 0.49));
    }
    pts.push(new THREE.Vector2(r, y));
  }

  const geom = new THREE.LatheGeometry(pts, 48);
  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  const turns = 4.5;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const u = uv.getX(i);
    const h = clamp(y / totalH, 0, 1);
    const r = Math.hypot(x, z);
    if (r > 1e-6) {
      const fade = smoothstep(0.05, 0.17, h) * (1 - smoothstep(0.86, 0.98, h));
      const phase = u * Math.PI * 2 + h * Math.PI * 2 * turns;
      const wave = 0.5 + 0.5 * Math.sin(phase);
      const groove = Math.pow(wave, 2.2);
      const scale = 1.0 - 0.25 * fade * groove + 0.065 * fade * (1 - groove);
      pos.setXYZ(i, x * scale, y, z * scale - Math.pow(h, 2) * 0.0025);
    }
  }

  geom.computeVertexNormals();
  return geom;
}

function buildHoofGeometry(THREE) {
  // 20-point lathe profile with flat ground contact at exact y = 0
  const profile = [
    [0.0002, 0.0022],
    [0.0075, 0.0018],
    [0.0138, 0.0008],
    [0.0185, 0.0000],
    [0.0212, 0.0000],
    [0.0226, 0.0014],
    [0.0228, 0.0040],
    [0.0223, 0.0072],
    [0.0216, 0.0108],
    [0.0209, 0.0144],
    [0.0201, 0.0180],
    [0.0193, 0.0214],
    [0.0186, 0.0246],
    [0.0182, 0.0270],
    [0.0186, 0.0286],
    [0.0182, 0.0300],
    [0.0164, 0.0312],
    [0.0128, 0.0318],
    [0.0070, 0.0320],
    [0.0002, 0.0320]
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const geom = new THREE.LatheGeometry(profile, 28);
  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);
    const h = clamp(y / 0.032, 0, 1);
    // Subtle equine toe forward taper & gentle heel slope while keeping sole flat at y=0
    x *= 0.94;
    z *= 1.07;
    if (z > 0) {
      z += (1 - h) * 0.0045 * (z / 0.024);
    } else {
      z *= 0.92;
    }
    pos.setXYZ(i, x, y, z);
  }

  geom.computeVertexNormals();
  return geom;
}

function makeBodyFurTexture(THREE, kit, furCol, accentCol) {
  const dorsalCol = shiftHSL(THREE, furCol, 0.0, 0.04, -0.055);
  const bellyCol = shiftHSL(THREE, furCol, -0.01, -0.04, 0.035);
  const dappleCol = mixColors(THREE, furCol, new THREE.Color('#ffffff'), 0.55);
  const tintCol = mixColors(THREE, furCol, accentCol, 0.14);

  const tex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;

    for (let py = 0; py < h; py++) {
      const v = 1 - py / h;
      const theta = (1 - v) * Math.PI;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);

      for (let px = 0; px < w; px++) {
        const u = px / w;
        const phi = u * Math.PI * 2;
        const nx = -Math.cos(phi) * sinT;
        const ny = -Math.sin(phi) * sinT; // rotated frame: +y is back, -y is belly
        const nz = cosT;

        const backW = smoothstep(-0.35, 0.85, ny);
        const bellyW = smoothstep(0.10, -0.88, ny);
        const rumpW = smoothstep(-0.12, -0.78, nz) * smoothstep(-0.25, 0.55, ny);

        let r = lerp(furCol.r, dorsalCol.r, backW * 0.72);
        let g = lerp(furCol.g, dorsalCol.g, backW * 0.72);
        let b = lerp(furCol.b, dorsalCol.b, backW * 0.72);

        r = lerp(r, bellyCol.r, bellyW * 0.85);
        g = lerp(g, bellyCol.g, bellyW * 0.85);
        b = lerp(b, bellyCol.b, bellyW * 0.85);

        // Soft pastel blush along flanks/shoulders
        const nCloud = kit.noise(nx * 3.5 + 4.1, nz * 3.5 + 2.7);
        r = lerp(r, tintCol.r, nCloud * 0.16 * (1 - bellyW));
        g = lerp(g, tintCol.g, nCloud * 0.16 * (1 - bellyW));
        b = lerp(b, tintCol.b, nCloud * 0.16 * (1 - bellyW));

        // Subtle foal dapples on rump/upper flanks
        const dap = kit.noise(nx * 11.5 + 8.3, nz * 11.5 + ny * 6.0 + 3.2);
        const dappleMask = smoothstep(0.64, 0.80, dap) * rumpW * 0.42;
        r = lerp(r, dappleCol.r, dappleMask);
        g = lerp(g, dappleCol.g, dappleMask);
        b = lerp(b, dappleCol.b, dappleMask);

        // Fine directional fur flecks
        const fleck = (kit.noise(nx * 28 + 1.3, nz * 52 + ny * 18 + 9.1) - 0.5) * 0.045;
        const idx = (py * w + px) * 4;
        data[idx] = Math.round(clamp(r + fleck, 0, 1) * 255);
        data[idx + 1] = Math.round(clamp(g + fleck, 0, 1) * 255);
        data[idx + 2] = Math.round(clamp(b + fleck, 0, 1) * 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Delicate silky fur strokes overlaid
    ctx.strokeStyle = rgbStr(dappleCol, 0.12);
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 650; i++) {
      const sx = kit.noise(i * 0.37, 1.1) * w;
      const sy = kit.noise(2.3, i * 0.51) * h;
      const len = 6 + kit.noise(i * 0.71, 4.2) * 10;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (kit.noise(i, 7.1) - 0.5) * 3, sy + len);
      ctx.stroke();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeHeadFurTexture(THREE, kit, furCol, accentCol) {
  const crownCol = shiftHSL(THREE, furCol, 0.0, 0.03, -0.04);
  const muzzleCol = mixColors(THREE, shiftHSL(THREE, furCol, -0.01, 0.04, 0.03), new THREE.Color('#ffe7e6'), 0.26);
  const blazeCol = mixColors(THREE, furCol, new THREE.Color('#ffffff'), 0.62);
  const cheekTint = mixColors(THREE, furCol, new THREE.Color('#ffbbc8'), 0.24);
  const softGlow = mixColors(THREE, furCol, accentCol, 0.10);

  const tex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;

    for (let py = 0; py < h; py++) {
      const v = 1 - py / h;
      const theta = (1 - v) * Math.PI;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);

      for (let px = 0; px < w; px++) {
        const u = px / w;
        const phi = u * Math.PI * 2;
        const nx = -Math.cos(phi) * sinT;
        const ny = -Math.sin(phi) * sinT;
        const nz = cosT;

        let r = furCol.r;
        let g = furCol.g;
        let b = furCol.b;

        const crownW = smoothstep(0.15, 0.90, ny);
        r = lerp(r, crownCol.r, crownW * 0.55);
        g = lerp(g, crownCol.g, crownW * 0.55);
        b = lerp(b, crownCol.b, crownW * 0.55);

        // Velvety rosy-cream muzzle
        const mMask = smoothstep(0.68, 0.96, nz) * smoothstep(0.45, -0.35, ny);
        r = lerp(r, muzzleCol.r, mMask * 0.85);
        g = lerp(g, muzzleCol.g, mMask * 0.85);
        b = lerp(b, muzzleCol.b, mMask * 0.85);

        // Soft forehead star/blaze diamond
        const blaze = Math.exp(-Math.pow(nx / 0.18, 2)) *
          Math.exp(-Math.pow((ny - 0.44) / 0.26, 2)) *
          smoothstep(0.35, 0.72, nz);
        r = lerp(r, blazeCol.r, blaze * 0.42);
        g = lerp(g, blazeCol.g, blaze * 0.42);
        b = lerp(b, blazeCol.b, blaze * 0.42);

        // Warm cheek undertone
        const cheek = Math.exp(-Math.pow((Math.abs(nx) - 0.72) / 0.25, 2)) *
          Math.exp(-Math.pow((ny + 0.22) / 0.22, 2)) *
          Math.exp(-Math.pow((nz - 0.64) / 0.25, 2));
        r = lerp(r, cheekTint.r, cheek * 0.55);
        g = lerp(g, cheekTint.g, cheek * 0.55);
        b = lerp(b, cheekTint.b, cheek * 0.55);

        const fleck = (kit.noise(nx * 26 + 3.1, nz * 38 + ny * 24 + 5.7) - 0.5) * 0.036;
        const idx = (py * w + px) * 4;
        data[idx] = Math.round(clamp(r + fleck, 0, 1) * 255);
        data[idx + 1] = Math.round(clamp(g + fleck, 0, 1) * 255);
        data[idx + 2] = Math.round(clamp(b + fleck, 0, 1) * 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    ctx.strokeStyle = rgbStr(softGlow, 0.14);
    ctx.lineWidth = 1.0;
    for (let i = 0; i < 480; i++) {
      const sx = kit.noise(i * 0.43, 2.2) * w;
      const sy = kit.noise(5.7, i * 0.61) * h;
      const len = 5 + kit.noise(i * 0.89, 1.4) * 8;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, sy + len);
      ctx.stroke();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeFurBumpTexture(THREE, kit) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      const x = kit.noise(i * 0.173, 3.1) * w;
      const y = kit.noise(7.9, i * 0.219) * h;
      const len = 5 + kit.noise(i * 0.41, 2.4) * 11;
      const bright = kit.noise(i * 0.63, 9.1) > 0.5;
      ctx.strokeStyle = bright ? 'rgba(215,215,215,0.22)' : 'rgba(55,55,55,0.20)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (kit.noise(i * 0.29, 4.7) - 0.5) * 2.5, y + len);
      ctx.stroke();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeManeTextures(THREE, kit, accentCol, glowCol, variant) {
  const rootCol = shiftHSL(THREE, accentCol, -0.02, 0.08, -0.10);
  const tipCol = mixColors(THREE, shiftHSL(THREE, accentCol, 0.04, 0.02, 0.12), new THREE.Color('#ffffff'), 0.28);

  const pastelStops = [
    accentCol.clone(),
    mixColors(THREE, new THREE.Color('#ffb8d2'), accentCol, 0.25),
    mixColors(THREE, new THREE.Color('#ffe5a8'), glowCol, 0.30),
    new THREE.Color('#b8f0dc'),
    new THREE.Color('#b6d6ff'),
    mixColors(THREE, new THREE.Color('#d7b6ff'), accentCol, 0.35)
  ];

  const starDeep = mixColors(THREE, shiftHSL(THREE, accentCol, 0.06, 0.12, -0.26), new THREE.Color('#271c56'), 0.62);
  const starMid = mixColors(THREE, shiftHSL(THREE, accentCol, 0.02, 0.10, -0.10), new THREE.Color('#5a3d9c'), 0.35);

  const map = kit.canvasTexture(512, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    if (variant === 1) {
      for (let i = 0; i < pastelStops.length; i++) {
        grad.addColorStop(i / (pastelStops.length - 1), rgbStr(pastelStops[i]));
      }
    } else if (variant === 2) {
      grad.addColorStop(0.0, rgbStr(accentCol));
      grad.addColorStop(0.35, rgbStr(starMid));
      grad.addColorStop(0.75, rgbStr(starDeep));
      grad.addColorStop(1.0, rgbStr(mixColors(THREE, starDeep, new THREE.Color('#1a1640'), 0.5)));
    } else {
      grad.addColorStop(0.0, rgbStr(rootCol));
      grad.addColorStop(0.45, rgbStr(accentCol));
      grad.addColorStop(1.0, rgbStr(tipCol));
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Silky longitudinal hair strands along u (x axis)
    for (let i = 0; i < 240; i++) {
      const y = (i / 240) * h;
      const n = kit.noise(i * 0.27, 4.1);
      const isLight = n > 0.48;
      ctx.strokeStyle = isLight ? 'rgba(255,255,255,0.16)' : 'rgba(45,20,65,0.12)';
      ctx.lineWidth = 0.9 + n * 1.4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let s = 1; s <= 6; s++) {
        const sx = (s / 6) * w;
        const sy = y + (kit.noise(s * 0.9 + i * 0.11, i * 0.31) - 0.5) * 6;
        ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    if (variant === 2) {
      // Nebula shimmer & stardust flecks
      for (let i = 0; i < 45; i++) {
        const sx = (0.18 + kit.noise(i * 0.41, 1.7) * 0.80) * w;
        const sy = kit.noise(3.3, i * 0.53) * h;
        const rad = 8 + kit.noise(i * 0.77, 8.2) * 18;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
        g.addColorStop(0, rgbStr(glowCol, 0.22));
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
      }
      for (let i = 0; i < 110; i++) {
        const sx = (0.12 + kit.noise(i * 0.83, 6.2) * 0.86) * w;
        const sy = kit.noise(9.1, i * 0.67) * h;
        const sr = 0.9 + kit.noise(i * 0.31, 2.9) * 2.2;
        ctx.fillStyle = i % 3 === 0 ? rgbStr(glowCol, 0.95) : 'rgba(255,252,245,0.92)';
        if (sr > 2.2) {
          ctx.beginPath();
          ctx.moveTo(sx, sy - sr * 2.2);
          ctx.quadraticCurveTo(sx, sy, sx + sr * 2.2, sy);
          ctx.quadraticCurveTo(sx, sy, sx, sy + sr * 2.2);
          ctx.quadraticCurveTo(sx, sy, sx - sr * 2.2, sy);
          ctx.quadraticCurveTo(sx, sy, sx, sy - sr * 2.2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 150; i++) {
      const y = (i / 150) * h;
      const n = kit.noise(i * 0.35, 2.1);
      ctx.strokeStyle = n > 0.5 ? 'rgba(225,225,225,0.34)' : 'rgba(40,40,40,0.30)';
      ctx.lineWidth = 1.2 + n * 1.2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + (n - 0.5) * 4);
      ctx.stroke();
    }
  });
  bumpMap.wrapS = THREE.ClampToEdgeWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  let emissiveMap = null;
  if (variant === 2) {
    emissiveMap = kit.canvasTexture(512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 110; i++) {
        const sx = (0.12 + kit.noise(i * 0.83, 6.2) * 0.86) * w;
        const sy = kit.noise(9.1, i * 0.67) * h;
        const sr = 1.0 + kit.noise(i * 0.31, 2.9) * 2.4;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 2.6);
        g.addColorStop(0, 'rgba(255,248,225,1)');
        g.addColorStop(0.5, rgbStr(glowCol, 0.55));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, sr * 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    emissiveMap.colorSpace = THREE.SRGBColorSpace;
  }

  return { map, bumpMap, emissiveMap };
}

function makeIrisTexture(THREE, kit, eyeCol) {
  const deepLimb = shiftHSL(THREE, eyeCol, -0.02, 0.12, -0.32);
  const brightLow = shiftHSL(THREE, eyeCol, 0.04, 0.14, 0.22);

  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const R = w * 0.49;

    const bg = ctx.createRadialGradient(cx, cy, R * 0.15, cx, cy, R);
    bg.addColorStop(0.0, rgbStr(deepLimb));
    bg.addColorStop(0.45, rgbStr(eyeCol));
    bg.addColorStop(0.84, rgbStr(deepLimb));
    bg.addColorStop(1.0, '#120a1c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Luminous lower crescent catchlight for anime/storybook charm
    const cres = ctx.createRadialGradient(cx, cy + R * 0.36, R * 0.05, cx, cy + R * 0.26, R * 0.58);
    cres.addColorStop(0.0, rgbStr(mixColors(THREE, brightLow, new THREE.Color('#ffffff'), 0.45), 0.92));
    cres.addColorStop(0.55, rgbStr(brightLow, 0.55));
    cres.addColorStop(1.0, rgbStr(eyeCol, 0));
    ctx.fillStyle = cres;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.86, 0, Math.PI * 2);
    ctx.fill();

    // Fine radial iris fibers
    for (let i = 0; i < 84; i++) {
      const a = (i / 84) * Math.PI * 2;
      const n = kit.noise(Math.cos(a) * 4 + 5, Math.sin(a) * 4 + 5);
      ctx.strokeStyle = n > 0.5 ? rgbStr(brightLow, 0.28) : rgbStr(deepLimb, 0.32);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R * 0.34, cy + Math.sin(a) * R * 0.34);
      ctx.lineTo(cx + Math.cos(a) * R * (0.76 + n * 0.14), cy + Math.sin(a) * R * (0.76 + n * 0.14));
      ctx.stroke();
    }

    // Soft upper lid shadow gradient for depth
    const topShade = ctx.createLinearGradient(0, 0, 0, h * 0.52);
    topShade.addColorStop(0.0, 'rgba(14,8,26,0.72)');
    topShade.addColorStop(1.0, 'rgba(14,8,26,0)');
    ctx.fillStyle = topShade;
    ctx.fillRect(0, 0, w, h * 0.55);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeHornTextures(THREE, kit, glowCol) {
  const pearlBase = mixColors(THREE, new THREE.Color('#fff9f0'), glowCol, 0.32);
  const pearlTip = mixColors(THREE, glowCol, new THREE.Color('#ffffff'), 0.45);
  const grooveGlow = mixColors(THREE, glowCol, new THREE.Color('#ffffff'), 0.55);
  const turns = 4.5;

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let py = 0; py < h; py++) {
      const v = 1 - py / h; // matches LatheGeometry uv.y (0 base -> 1 tip)
      for (let px = 0; px < w; px++) {
        const u = px / w;
        const phase = u * Math.PI * 2 + v * Math.PI * 2 * turns;
        const groove = Math.pow(0.5 + 0.5 * Math.sin(phase), 2.2);
        let r = lerp(pearlBase.r, pearlTip.r, Math.pow(v, 0.8));
        let g = lerp(pearlBase.g, pearlTip.g, Math.pow(v, 0.8));
        let b = lerp(pearlBase.b, pearlTip.b, Math.pow(v, 0.8));
        r = lerp(r, grooveGlow.r, groove * 0.52);
        g = lerp(g, grooveGlow.g, groove * 0.52);
        b = lerp(b, grooveGlow.b, groove * 0.52);
        const idx = (py * w + px) * 4;
        data[idx] = Math.round(clamp(r, 0, 1) * 255);
        data[idx + 1] = Math.round(clamp(g, 0, 1) * 255);
        data[idx + 2] = Math.round(clamp(b, 0, 1) * 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;

  const emissiveMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let py = 0; py < h; py++) {
      const v = 1 - py / h;
      for (let px = 0; px < w; px++) {
        const u = px / w;
        const phase = u * Math.PI * 2 + v * Math.PI * 2 * turns;
        const groove = Math.pow(0.5 + 0.5 * Math.sin(phase), 2.4);
        const intensity = clamp(0.18 + 0.52 * Math.pow(v, 1.3) + 0.50 * groove * smoothstep(0.06, 0.25, v), 0, 1);
        const idx = (py * w + px) * 4;
        data[idx] = Math.round(glowCol.r * intensity * 255);
        data[idx + 1] = Math.round(glowCol.g * intensity * 255);
        data[idx + 2] = Math.round(glowCol.b * intensity * 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.wrapS = THREE.RepeatWrapping;
  emissiveMap.wrapT = THREE.ClampToEdgeWrapping;

  return { map, emissiveMap };
}

function makeHoofTextures(THREE, kit, furCol, accentCol) {
  const baseCol = mixColors(THREE, new THREE.Color('#e6d2c8'), accentCol, 0.28);
  const rimCol = shiftHSL(THREE, baseCol, 0.0, 0.05, -0.14);
  const topCol = mixColors(THREE, baseCol, furCol, 0.30);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, rgbStr(topCol));
    g.addColorStop(0.55, rgbStr(baseCol));
    g.addColorStop(1.0, rgbStr(rimCol));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Subtle vertical keratin striations
    for (let i = 0; i < 90; i++) {
      const x = (i / 90) * w;
      const n = kit.noise(i * 0.41, 3.2);
      ctx.strokeStyle = n > 0.5 ? 'rgba(255,250,246,0.18)' : 'rgba(80,52,65,0.14)';
      ctx.lineWidth = 1.2 + n * 1.4;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 64; i++) {
      const x = (i / 64) * w;
      const n = kit.noise(i * 0.53, 1.8);
      ctx.strokeStyle = n > 0.5 ? 'rgba(205,205,205,0.28)' : 'rgba(60,60,60,0.24)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  });
  bumpMap.wrapS = THREE.RepeatWrapping;

  return { map, bumpMap };
}

function makeInnerEarTexture(THREE, kit, furCol) {
  const pinkDeep = new THREE.Color('#f2aeb9');
  const pinkSoft = mixColors(THREE, new THREE.Color('#ffd8de'), furCol, 0.25);

  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w * 0.5, h * 0.62, w * 0.08, w * 0.5, h * 0.52, w * 0.54);
    g.addColorStop(0.0, rgbStr(pinkDeep));
    g.addColorStop(0.65, rgbStr(pinkSoft));
    g.addColorStop(1.0, rgbStr(furCol));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Fine fluffy inner-ear hairs
    ctx.strokeStyle = rgbStr(furCol, 0.22);
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 90; i++) {
      const x = (0.15 + kit.noise(i * 0.37, 2.9) * 0.70) * w;
      const y = (0.25 + kit.noise(6.1, i * 0.43) * 0.68) * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (x < w * 0.5 ? 7 : -7), y - 6);
      ctx.stroke();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBlushTexture(THREE, kit) {
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.05, w * 0.5, h * 0.5, w * 0.48);
    g.addColorStop(0.0, 'rgba(255,148,172,0.88)');
    g.addColorStop(0.55, 'rgba(255,165,186,0.42)');
    g.addColorStop(1.0, 'rgba(255,175,194,0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBezierChain(THREE, segments) {
  const path = new THREE.CurvePath();
  for (const pts of segments) {
    path.add(new THREE.CubicBezierCurve3(
      new THREE.Vector3(...pts[0]),
      new THREE.Vector3(...pts[1]),
      new THREE.Vector3(...pts[2]),
      new THREE.Vector3(...pts[3])
    ));
  }
  return path;
}

export function build(THREE, opts = {}, kit) {
  const furCol = makeColor(THREE, opts.fur, '#faf3eb');
  const accentCol = makeColor(THREE, opts.furAccent, '#e8a8d8');
  const eyeCol = makeColor(THREE, opts.eye, '#6d7fe8');
  const glowCol = makeColor(THREE, opts.glow, '#ffe6a8');
  const variant = clamp(Math.round(opts.variant ?? 0), 0, 2);

  // Textures
  const bodyFurTex = makeBodyFurTexture(THREE, kit, furCol, accentCol);
  const headFurTex = makeHeadFurTexture(THREE, kit, furCol, accentCol);
  const furBumpTex = makeFurBumpTexture(THREE, kit);
  const maneTex = makeManeTextures(THREE, kit, accentCol, glowCol, variant);
  const irisTex = makeIrisTexture(THREE, kit, eyeCol);
  const hornTex = makeHornTextures(THREE, kit, glowCol);
  const hoofTex = makeHoofTextures(THREE, kit, furCol, accentCol);
  const innerEarTex = makeInnerEarTexture(THREE, kit, furCol);
  const blushTex = makeBlushTexture(THREE, kit);

  // Materials (all MeshPhysicalMaterial)
  const furSheen = mixColors(THREE, furCol, new THREE.Color('#ffffff'), 0.62);
  const accentSheen = mixColors(THREE, accentCol, new THREE.Color('#ffffff'), 0.58);

  const bodyFurMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: bodyFurTex,
    bumpMap: furBumpTex,
    bumpScale: 0.0022,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.86,
    sheenRoughness: 0.62,
    sheenColor: furSheen
  });

  const headFurMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: headFurTex,
    bumpMap: furBumpTex,
    bumpScale: 0.0018,
    roughness: 0.90,
    metalness: 0.0,
    sheen: 0.88,
    sheenRoughness: 0.60,
    sheenColor: furSheen
  });

  const limbFurMat = new THREE.MeshPhysicalMaterial({
    color: furCol,
    bumpMap: furBumpTex,
    bumpScale: 0.0020,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.84,
    sheenRoughness: 0.64,
    sheenColor: furSheen
  });

  const innerEarMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: innerEarTex,
    roughness: 0.90,
    metalness: 0.0,
    sheen: 0.72,
    sheenRoughness: 0.68,
    sheenColor: new THREE.Color('#fff3f5')
  });

  const maneMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: maneTex.map,
    bumpMap: maneTex.bumpMap,
    bumpScale: 0.0030,
    roughness: 0.85,
    metalness: 0.0,
    sheen: 0.96,
    sheenRoughness: 0.44,
    sheenColor: accentSheen,
    emissive: variant === 2 ? glowCol : new THREE.Color(0x000000),
    emissiveMap: maneTex.emissiveMap,
    emissiveIntensity: variant === 2 ? 1.45 : 0.0
  });

  const hornMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: hornTex.map,
    roughness: 0.14,
    metalness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    emissive: glowCol,
    emissiveMap: hornTex.emissiveMap,
    emissiveIntensity: 1.5
  });

  const hoofMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: hoofTex.map,
    bumpMap: hoofTex.bumpMap,
    bumpScale: 0.0012,
    roughness: 0.20,
    metalness: 0.05,
    clearcoat: 0.88,
    clearcoatRoughness: 0.13
  });

  const eyeDarkMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#130c1d'),
    roughness: 0.05,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03
  });

  const eyeIrisMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: irisTex,
    roughness: 0.09,
    metalness: 0.0,
    clearcoat: 0.96,
    clearcoatRoughness: 0.04,
    emissive: eyeCol,
    emissiveIntensity: 0.16
  });

  const eyeHighlightMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 1.4,
    roughness: 0.04,
    clearcoat: 1.0
  });

  const detailDarkMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#473046'),
    roughness: 0.68,
    metalness: 0.0,
    sheen: 0.35,
    sheenColor: new THREE.Color('#8e6e8d')
  });

  const blushMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: blushTex,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
    roughness: 0.92,
    sheen: 0.65,
    sheenColor: new THREE.Color('#ffe5eb')
  });

  const setShadow = (mesh, slot) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (slot) mesh.userData.slot = slot;
    return mesh;
  };

  // Root group
  const root = new THREE.Group();
  root.name = 'unicornFoal';

  // --- BODY GROUP ---
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  // Sculpted continuous torso
  const torsoMesh = setShadow(new THREE.Mesh(buildSculptedTorso(THREE), bodyFurMat), 'fur');
  body.add(torsoMesh);

  // Graceful tapered curved neck (deeply overlapping torso and head)
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.214, 0.055),
    new THREE.Vector3(0, 0.258, 0.094),
    new THREE.Vector3(0, 0.308, 0.114),
    new THREE.Vector3(0, 0.356, 0.120)
  ]);
  const neckGeom = buildTaperedTube(
    THREE,
    neckCurve,
    (t) => [
      lerp(0.062, 0.032, Math.pow(t, 0.72)),
      lerp(0.068, 0.036, Math.pow(t, 0.72))
    ],
    24,
    22,
    new THREE.Vector3(1, 0, 0),
    true,
    true
  );
  const neckMesh = setShadow(new THREE.Mesh(neckGeom, limbFurMat), 'fur');
  body.add(neckMesh);

  // --- HEAD GROUP ---
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 0.348, 0.120);
  // Gentle curious pose tilt
  head.rotation.set(0.06, 0.14, -0.09);
  body.add(head);

  const headMesh = setShadow(new THREE.Mesh(buildSculptedHead(THREE), headFurMat), 'fur');
  head.add(headMesh);

  // Three-layer sculpted glossy eyes embedded cleanly into sockets
  const eyeBaseGeom = new THREE.SphereGeometry(0.0195, 28, 22);
  const irisDiscGeom = buildCurvedDisc(THREE, 0.0156, 0.0172, 0.0086, 6, 28);
  const pupilDiscGeom = buildCurvedDisc(THREE, 0.0086, 0.0098, 0.0044, 5, 22);
  const hiMainGeom = new THREE.SphereGeometry(0.0038, 14, 12);
  const hiSubGeom = new THREE.SphereGeometry(0.0018, 12, 10);

  const eyeGroups = {};
  for (const side of [1, -1]) {
    const eyeGroup = new THREE.Group();
    eyeGroup.name = side === 1 ? 'eyeL' : 'eyeR';

    const sock = evalHeadSurface(THREE, side * 0.674, 0.062, 0.736);
    const eyeFwd = sock.normal.clone().lerp(new THREE.Vector3(side * 0.40, 0.03, 0.91).normalize(), 0.44).normalize();
    const xAxis = new THREE.Vector3(0, 1, 0).cross(eyeFwd).normalize();
    const yAxis = eyeFwd.clone().cross(xAxis).normalize();

    eyeGroup.position.copy(sock.pos).addScaledVector(sock.normal, -0.0036);
    eyeGroup.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, eyeFwd));

    // Layer 1: Dark glossy eye orb
    const orb = new THREE.Mesh(eyeBaseGeom, eyeDarkMat);
    orb.scale.set(0.92, 1.06, 0.56);
    orb.position.set(0, 0, -0.0008);
    eyeGroup.add(orb);

    // Layer 2: Coloured iris ring/cap
    const iris = new THREE.Mesh(irisDiscGeom, eyeIrisMat);
    iris.position.set(0, -0.0004, 0.0022);
    iris.userData.slot = 'eye';
    eyeGroup.add(iris);

    // Glossy dark pupil cabochon
    const pupil = new THREE.Mesh(pupilDiscGeom, eyeDarkMat);
    pupil.position.set(0, 0.0008, 0.0070);
    eyeGroup.add(pupil);

    // Layer 3: Two crisp white specular highlight dots (consistent cozy lamp side)
    const hiSide = side === 1 ? -1 : 1;
    const hi1 = new THREE.Mesh(hiMainGeom, eyeHighlightMat);
    hi1.scale.set(1.0, 1.15, 0.42);
    hi1.position.set(hiSide * 0.0056, 0.0064, 0.0102);
    eyeGroup.add(hi1);

    const hi2 = new THREE.Mesh(hiSubGeom, eyeHighlightMat);
    hi2.scale.set(1.0, 1.0, 0.45);
    hi2.position.set(-hiSide * 0.0046, -0.0058, 0.0098);
    eyeGroup.add(hi2);

    // Delicate curved upper eyelash hugging upper rim
    const lashCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-side * 0.0145, 0.0065, 0.0045),
      new THREE.Vector3(-side * 0.0055, 0.0155, 0.0058),
      new THREE.Vector3(side * 0.0065, 0.0165, 0.0054),
      new THREE.Vector3(side * 0.0165, 0.0122, 0.0040),
      new THREE.Vector3(side * 0.0205, 0.0150, 0.0030)
    ]);
    const lashGeom = buildTaperedTube(
      THREE,
      lashCurve,
      (t) => lerp(0.0011, 0.0020, Math.sin(t * Math.PI)) * (1 - 0.35 * t),
      16,
      8,
      new THREE.Vector3(0, 0, 1),
      true,
      true
    );
    const lash = new THREE.Mesh(lashGeom, detailDarkMat);
    eyeGroup.add(lash);

    head.add(eyeGroup);
    eyeGroups[eyeGroup.name] = eyeGroup;

    // Subtle curved cheek blush patch hugging the sculpted cheek
    const blushMesh = new THREE.Mesh(buildCheekPatch(THREE, side), blushMat);
    blushMesh.userData.slot = 'skin';
    head.add(blushMesh);

    // Soft sculpted nostril accent nested inside nostril dimple
    const nos = evalHeadSurface(THREE, side * 0.27, -0.12, 0.955);
    const nosCurve = new THREE.CatmullRomCurve3([
      nos.pos.clone().add(new THREE.Vector3(-side * 0.0022, 0.0018, 0.0004)),
      nos.pos.clone().add(new THREE.Vector3(0, -0.0004, 0.0006)),
      nos.pos.clone().add(new THREE.Vector3(side * 0.0024, -0.0022, -0.0004))
    ]);
    const nosGeom = buildTaperedTube(
      THREE,
      nosCurve,
      (t) => 0.0013 * (0.65 + 0.55 * Math.sin(t * Math.PI)),
      10,
      8,
      nos.normal,
      true,
      true
    );
    head.add(new THREE.Mesh(nosGeom, detailDarkMat));
  }

  // Sweet gentle curved smile mouth tube nestled along lower muzzle
  const mL = evalHeadSurface(THREE, 0.30, -0.44, 0.845).pos;
  const mC1 = evalHeadSurface(THREE, 0.14, -0.47, 0.872).pos;
  const mMid = evalHeadSurface(THREE, 0.0, -0.45, 0.892).pos;
  const mC2 = evalHeadSurface(THREE, -0.14, -0.47, 0.872).pos;
  const mR = evalHeadSurface(THREE, -0.30, -0.44, 0.845).pos;
  const mouthCurve = new THREE.CatmullRomCurve3([
    mL.clone().add(new THREE.Vector3(0, 0.0018, 0.0006)),
    mC1.clone().add(new THREE.Vector3(0, 0.0002, 0.0008)),
    mMid.clone().add(new THREE.Vector3(0, 0.0008, 0.0009)),
    mC2.clone().add(new THREE.Vector3(0, 0.0002, 0.0008)),
    mR.clone().add(new THREE.Vector3(0, 0.0018, 0.0006))
  ]);
  const mouthGeom = buildTaperedTube(
    THREE,
    mouthCurve,
    (t) => 0.0015 * (0.45 + 0.65 * Math.sin(t * Math.PI)),
    18,
    8,
    new THREE.Vector3(0, 1, 0),
    true,
    true
  );
  head.add(new THREE.Mesh(mouthGeom, detailDarkMat));

  // --- EARS (Curved ExtrudeGeometry) ---
  const outerEarGeom = buildCurvedEar(THREE, 1.0, 1.0);
  const innerEarGeom = buildCurvedEar(THREE, 0.72, 0.55);

  const earL = new THREE.Group();
  earL.name = 'earL';
  earL.position.set(0.036, 0.082, -0.004);
  earL.rotation.set(-0.14, 0.24, -0.34);

  const earR = new THREE.Group();
  earR.name = 'earR';
  earR.position.set(-0.036, 0.082, -0.004);
  earR.rotation.set(-0.10, -0.30, 0.40);

  for (const earGroup of [earL, earR]) {
    const outer = setShadow(new THREE.Mesh(outerEarGeom, limbFurMat), 'fur');
    const inner = new THREE.Mesh(innerEarGeom, innerEarMat);
    inner.position.set(0, 0.008, 0.0032);
    inner.userData.slot = 'skin';
    earGroup.add(outer, inner);
    head.add(earGroup);
  }

  // --- SPIRAL HORN (LatheGeometry with twisted groove) ---
  const horn = new THREE.Group();
  horn.name = 'horn';
  horn.position.set(0, 0.086, 0.044);
  horn.rotation.set(0.62, 0, 0);
  const hornMesh = setShadow(new THREE.Mesh(buildSpiralHorn(THREE), hornMat), 'glow');
  horn.add(hornMesh);
  head.add(horn);

  // --- FORELOCK & UPPER MANE (tapered bezier ribbons attached to head) ---
  const forelockSpecs = [
    // Main sweeping lock curving gracefully past right side of horn toward brow
    {
      segs: [
        [[0.006, 0.094, 0.026], [0.024, 0.112, 0.046], [0.036, 0.095, 0.068], [0.048, 0.054, 0.072]],
        [[0.048, 0.054, 0.072], [0.056, 0.030, 0.068], [0.062, 0.015, 0.054], [0.052, 0.006, 0.044]]
      ],
      w: [0.011, 0.019, 0.001], th: [0.0045, 0.0065, 0.0006], roll: 0.45, uShift: 0.0
    },
    // Second curled wisp sweeping over left side of horn
    {
      segs: [
        [[-0.005, 0.093, 0.025], [-0.026, 0.108, 0.048], [-0.042, 0.086, 0.070], [-0.052, 0.046, 0.066]],
        [[-0.052, 0.046, 0.066], [-0.058, 0.026, 0.058], [-0.054, 0.012, 0.046], [-0.044, 0.010, 0.038]]
      ],
      w: [0.010, 0.017, 0.001], th: [0.0042, 0.0060, 0.0006], roll: -0.50, uShift: 0.35
    },
    // Delicate central curl framing the horn base
    {
      segs: [
        [[0.000, 0.096, 0.022], [0.014, 0.115, 0.040], [0.016, 0.105, 0.068], [0.004, 0.076, 0.086]],
        [[0.004, 0.076, 0.086], [-0.006, 0.062, 0.090], [-0.016, 0.056, 0.082], [-0.018, 0.060, 0.072]]
      ],
      w: [0.009, 0.015, 0.0008], th: [0.0038, 0.0052, 0.0005], roll: 0.25, uShift: 0.70
    },
    // Upper crown mane locks flowing down back of skull
    {
      segs: [
        [[0.000, 0.096, 0.008], [-0.016, 0.106, -0.026], [-0.034, 0.080, -0.052], [-0.046, 0.026, -0.064]],
        [[-0.046, 0.026, -0.064], [-0.054, -0.012, -0.066], [-0.062, -0.046, -0.052], [-0.052, -0.066, -0.034]]
      ],
      w: [0.013, 0.023, 0.001], th: [0.0052, 0.0074, 0.0006], roll: -0.35, uShift: 0.15
    },
    {
      segs: [
        [[0.004, 0.092, -0.004], [0.018, 0.098, -0.036], [0.036, 0.066, -0.058], [0.044, 0.012, -0.066]],
        [[0.044, 0.012, -0.066], [0.048, -0.022, -0.064], [0.050, -0.048, -0.050], [0.040, -0.062, -0.036]]
      ],
      w: [0.011, 0.019, 0.001], th: [0.0046, 0.0066, 0.0006], roll: 0.35, uShift: 0.55
    }
  ];

  for (const spec of forelockSpecs) {
    const curve = makeBezierChain(THREE, spec.segs);
    const geom = buildTaperedRibbon(
      THREE,
      curve,
      (t) => lerp(spec.w[0], spec.w[1], Math.sin(Math.pow(t, 0.72) * Math.PI)) * (1 - 0.94 * Math.pow(t, 2.2)) + spec.w[2],
      (t) => lerp(spec.th[0], spec.th[1], Math.sin(t * Math.PI * 0.85)) * (1 - 0.88 * Math.pow(t, 1.9)) + spec.th[2],
      (t) => spec.roll * t,
      26,
      10,
      new THREE.Vector3(0, 1, 0),
      spec.uShift
    );
    head.add(setShadow(new THREE.Mesh(geom, maneMat), 'furAccent'));
  }

  // --- FLOWING NECK MANE (9 cascading tapered bezier ribbons on body) ---
  const neckManeSpecs = [
    // Sweeping right-side (-X) cascade locks
    {
      segs: [
        [[-0.004, 0.356, 0.088], [-0.038, 0.352, 0.068], [-0.062, 0.312, 0.064], [-0.072, 0.254, 0.072]],
        [[-0.072, 0.254, 0.072], [-0.078, 0.214, 0.080], [-0.084, 0.178, 0.094], [-0.068, 0.162, 0.104]]
      ],
      w: 0.023, th: 0.0075, roll: -0.4, uShift: 0.05
    },
    {
      segs: [
        [[-0.002, 0.336, 0.074], [-0.042, 0.330, 0.048], [-0.072, 0.286, 0.040], [-0.082, 0.228, 0.046]],
        [[-0.082, 0.228, 0.046], [-0.090, 0.184, 0.054], [-0.096, 0.148, 0.072], [-0.078, 0.132, 0.084]]
      ],
      w: 0.025, th: 0.0080, roll: -0.5, uShift: 0.28
    },
    {
      segs: [
        [[-0.004, 0.316, 0.060], [-0.046, 0.312, 0.032], [-0.078, 0.268, 0.018], [-0.088, 0.214, 0.020]],
        [[-0.088, 0.214, 0.020], [-0.096, 0.172, 0.026], [-0.094, 0.142, 0.046], [-0.076, 0.136, 0.062]]
      ],
      w: 0.024, th: 0.0076, roll: -0.45, uShift: 0.52
    },
    {
      segs: [
        [[-0.002, 0.296, 0.048], [-0.044, 0.296, 0.016], [-0.076, 0.258, -0.004], [-0.086, 0.212, -0.008]],
        [[-0.086, 0.212, -0.008], [-0.092, 0.176, -0.004], [-0.086, 0.152, 0.014], [-0.072, 0.148, 0.028]]
      ],
      w: 0.022, th: 0.0070, roll: -0.35, uShift: 0.78
    },
    {
      segs: [
        [[0.000, 0.282, 0.034], [-0.034, 0.286, 0.002], [-0.064, 0.260, -0.024], [-0.078, 0.222, -0.034]],
        [[-0.078, 0.222, -0.034], [-0.086, 0.194, -0.034], [-0.082, 0.174, -0.020], [-0.068, 0.172, -0.006]]
      ],
      w: 0.019, th: 0.0062, roll: -0.3, uShift: 0.18
    },
    // Central crest volume locks arching gracefully back along the neck
    {
      segs: [
        [[0.000, 0.342, 0.078], [-0.018, 0.354, 0.044], [-0.032, 0.324, 0.016], [-0.042, 0.278, 0.002]],
        [[-0.042, 0.278, 0.002], [-0.048, 0.246, -0.006], [-0.046, 0.218, 0.006], [-0.036, 0.208, 0.020]]
      ],
      w: 0.021, th: 0.0072, roll: -0.2, uShift: 0.44
    },
    // Playful left-side (+X) shoulder wisps for balanced 3/4 silhouette
    {
      segs: [
        [[0.004, 0.348, 0.084], [0.036, 0.342, 0.062], [0.058, 0.300, 0.062], [0.066, 0.248, 0.076]],
        [[0.066, 0.248, 0.076], [0.070, 0.214, 0.088], [0.074, 0.186, 0.102], [0.060, 0.174, 0.110]]
      ],
      w: 0.019, th: 0.0065, roll: 0.42, uShift: 0.65
    },
    {
      segs: [
        [[0.004, 0.318, 0.064], [0.040, 0.312, 0.038], [0.066, 0.270, 0.032], [0.076, 0.220, 0.042]],
        [[0.076, 0.220, 0.042], [0.082, 0.186, 0.052], [0.078, 0.162, 0.068], [0.064, 0.156, 0.078]]
      ],
      w: 0.018, th: 0.0062, roll: 0.36, uShift: 0.88
    },
    {
      segs: [
        [[0.002, 0.292, 0.046], [0.034, 0.290, 0.018], [0.058, 0.258, 0.002], [0.068, 0.218, 0.004]],
        [[0.068, 0.218, 0.004], [0.074, 0.192, 0.012], [0.068, 0.176, 0.026], [0.056, 0.176, 0.036]]
      ],
      w: 0.016, th: 0.0056, roll: 0.28, uShift: 0.12
    }
  ];

  for (const spec of neckManeSpecs) {
    const curve = makeBezierChain(THREE, spec.segs);
    const geom = buildTaperedRibbon(
      THREE,
      curve,
      (t) => spec.w * (0.48 + 0.58 * Math.sin(Math.pow(t, 0.70) * Math.PI)) * (1 - 0.94 * Math.pow(t, 2.3)) + 0.0008,
      (t) => spec.th * (0.65 + 0.42 * Math.sin(t * Math.PI * 0.85)) * (1 - 0.88 * Math.pow(t, 2.0)) + 0.0006,
      (t) => spec.roll * t,
      28,
      10,
      new THREE.Vector3(0, 1, 0),
      spec.uShift
    );
    body.add(setShadow(new THREE.Mesh(geom, maneMat), 'furAccent'));
  }

  // --- TAIL GROUP (8 lush flowing tapered bezier ribbons) ---
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(0, 0.252, -0.140);
  body.add(tail);

  const tailSpecs = [
    // Main long S-curved central plume curling gently to -X
    {
      segs: [
        [[0.000, 0.004, 0.016], [0.000, 0.044, -0.026], [-0.012, 0.024, -0.076], [-0.028, -0.056, -0.094]],
        [[-0.028, -0.056, -0.094], [-0.044, -0.132, -0.106], [-0.068, -0.184, -0.078], [-0.044, -0.200, -0.042]]
      ],
      w: 0.029, th: 0.0095, roll: -0.65, uShift: 0.0
    },
    // Sweeping outer right plume (-X)
    {
      segs: [
        [[-0.004, 0.006, 0.014], [-0.022, 0.042, -0.024], [-0.046, 0.018, -0.072], [-0.060, -0.058, -0.088]],
        [[-0.060, -0.058, -0.088], [-0.076, -0.128, -0.092], [-0.096, -0.168, -0.058], [-0.074, -0.178, -0.024]]
      ],
      w: 0.026, th: 0.0086, roll: -0.75, uShift: 0.24
    },
    // Sweeping left plume (+X) curving gracefully across to balance
    {
      segs: [
        [[0.004, 0.006, 0.014], [0.022, 0.042, -0.024], [0.032, 0.016, -0.074], [0.022, -0.062, -0.096]],
        [[0.022, -0.062, -0.096], [0.012, -0.136, -0.108], [-0.014, -0.186, -0.088], [0.008, -0.202, -0.056]]
      ],
      w: 0.026, th: 0.0086, roll: 0.55, uShift: 0.48
    },
    // High arching crest ribbon
    {
      segs: [
        [[0.000, 0.010, 0.014], [0.004, 0.058, -0.022], [-0.008, 0.046, -0.082], [-0.024, -0.032, -0.112]],
        [[-0.024, -0.032, -0.112], [-0.040, -0.108, -0.128], [-0.064, -0.162, -0.106], [-0.050, -0.180, -0.076]]
      ],
      w: 0.024, th: 0.0082, roll: -0.45, uShift: 0.72
    },
    // Outer lively floating wisp (+X)
    {
      segs: [
        [[0.006, 0.002, 0.012], [0.032, 0.034, -0.020], [0.056, 0.002, -0.062], [0.054, -0.068, -0.078]],
        [[0.054, -0.068, -0.078], [0.050, -0.124, -0.082], [0.062, -0.156, -0.056], [0.044, -0.166, -0.034]]
      ],
      w: 0.021, th: 0.0070, roll: 0.80, uShift: 0.86
    },
    // Under-plume fullness lock
    {
      segs: [
        [[0.000, -0.004, 0.014], [-0.006, 0.016, -0.026], [-0.020, -0.022, -0.062], [-0.032, -0.094, -0.074]],
        [[-0.032, -0.094, -0.074], [-0.044, -0.150, -0.076], [-0.054, -0.182, -0.052], [-0.034, -0.188, -0.026]]
      ],
      w: 0.023, th: 0.0078, roll: -0.35, uShift: 0.36
    },
    // Short playful curling ribbon near tail dock (-X)
    {
      segs: [
        [[-0.006, 0.008, 0.012], [-0.030, 0.038, -0.018], [-0.058, 0.006, -0.048], [-0.066, -0.048, -0.052]],
        [[-0.066, -0.048, -0.052], [-0.074, -0.086, -0.048], [-0.066, -0.112, -0.026], [-0.050, -0.114, -0.010]]
      ],
      w: 0.018, th: 0.0062, roll: -0.85, uShift: 0.60
    },
    // Short playful curling ribbon (+X)
    {
      segs: [
        [[0.006, 0.008, 0.012], [0.028, 0.044, -0.018], [0.046, 0.022, -0.054], [0.048, -0.032, -0.068]],
        [[0.048, -0.032, -0.068], [0.048, -0.074, -0.072], [0.036, -0.102, -0.054], [0.024, -0.106, -0.038]]
      ],
      w: 0.017, th: 0.0058, roll: 0.65, uShift: 0.14
    }
  ];

  for (const spec of tailSpecs) {
    const curve = makeBezierChain(THREE, spec.segs);
    const geom = buildTaperedRibbon(
      THREE,
      curve,
      (t) => spec.w * (0.44 + 0.62 * Math.sin(Math.pow(t, 0.68) * Math.PI)) * (1 - 0.94 * Math.pow(t, 2.2)) + 0.0008,
      (t) => spec.th * (0.64 + 0.42 * Math.sin(t * Math.PI * 0.85)) * (1 - 0.88 * Math.pow(t, 1.9)) + 0.0006,
      (t) => spec.roll * t,
      32,
      10,
      new THREE.Vector3(0, 1, 0),
      spec.uShift
    );
    tail.add(setShadow(new THREE.Mesh(geom, maneMat), 'furAccent'));
  }

  // --- LIMBS, HOOVES & FETLOCK TUFTS ---
  const sharedHoofGeom = buildHoofGeometry(THREE);

  function addFetlockTuft(parent, pos, tiltX = 0) {
    const tuftGroup = new THREE.Group();
    tuftGroup.position.copy(pos);
    tuftGroup.rotation.x = tiltX;
    for (const s of [-1, 1]) {
      const c = new THREE.CubicBezierCurve3(
        new THREE.Vector3(s * 0.004, 0.006, -0.006),
        new THREE.Vector3(s * 0.010, -0.002, -0.018),
        new THREE.Vector3(s * 0.012, -0.014, -0.024),
        new THREE.Vector3(s * 0.007, -0.024, -0.020)
      );
      const g = buildTaperedRibbon(
        THREE,
        c,
        (t) => 0.0085 * (1 - 0.90 * Math.pow(t, 1.8)) + 0.0005,
        (t) => 0.0032 * (1 - 0.85 * t) + 0.0004,
        (t) => s * 0.3 * t,
        12,
        8,
        new THREE.Vector3(0, 0, -1),
        0
      );
      tuftGroup.add(setShadow(new THREE.Mesh(g, limbFurMat), 'fur'));
    }
    parent.add(tuftGroup);
  }

  function makeFrontRadius(t) {
    let r = lerp(0.036, 0.0155, Math.pow(t, 0.62));
    // Subtle knee definition
    r += 0.0024 * Math.exp(-Math.pow((t - 0.50) / 0.09, 2));
    // Soft plump fetlock above hoof
    r += 0.0042 * Math.exp(-Math.pow((t - 0.85) / 0.08, 2));
    const depth = r * (1.12 - 0.08 * t);
    return [r, depth];
  }

  function makeHindRadius(t) {
    let r = lerp(0.043, 0.0155, Math.pow(t, 0.58));
    // Hock definition
    r += 0.0028 * Math.exp(-Math.pow((t - 0.48) / 0.09, 2));
    // Soft plump fetlock above hoof
    r += 0.0042 * Math.exp(-Math.pow((t - 0.85) / 0.08, 2));
    const depth = r * (1.16 - 0.10 * t);
    return [r, depth];
  }

  // Front Left Leg (armL — GRACEFULLY LIFTED!)
  const armL = new THREE.Group();
  armL.name = 'armL';
  armL.position.set(0.052, 0.208, 0.074);
  const armLCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.014, 0.018, -0.012),
    new THREE.Vector3(0.004, -0.026, 0.030),
    new THREE.Vector3(0.008, -0.068, 0.070),
    new THREE.Vector3(0.006, -0.114, 0.054),
    new THREE.Vector3(0.005, -0.138, 0.040)
  ]);
  armL.add(setShadow(new THREE.Mesh(
    buildTaperedTube(THREE, armLCurve, makeFrontRadius, 24, 18, new THREE.Vector3(1, 0, 0), true, true),
    limbFurMat
  ), 'fur'));
  const hoofArmL = setShadow(new THREE.Mesh(sharedHoofGeom, hoofMat), 'secondary');
  hoofArmL.position.set(0.005, -0.156, 0.025);
  hoofArmL.rotation.set(0.68, 0.06, -0.04);
  armL.add(hoofArmL);
  addFetlockTuft(armL, new THREE.Vector3(0.005, -0.118, 0.050), 0.52);
  root.add(armL);

  // Front Right Leg (armR — planted squarely on floor y = 0)
  const armR = new THREE.Group();
  armR.name = 'armR';
  armR.position.set(-0.052, 0.205, 0.072);
  const armRCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.014, 0.018, -0.010),
    new THREE.Vector3(0.001, -0.035, 0.004),
    new THREE.Vector3(-0.002, -0.094, 0.008),
    new THREE.Vector3(-0.003, -0.148, 0.004),
    new THREE.Vector3(-0.003, -0.181, 0.012)
  ]);
  armR.add(setShadow(new THREE.Mesh(
    buildTaperedTube(THREE, armRCurve, makeFrontRadius, 24, 18, new THREE.Vector3(1, 0, 0), true, true),
    limbFurMat
  ), 'fur'));
  const hoofArmR = setShadow(new THREE.Mesh(sharedHoofGeom, hoofMat), 'secondary');
  hoofArmR.position.set(-0.003, -0.205, 0.015);
  armR.add(hoofArmR);
  addFetlockTuft(armR, new THREE.Vector3(-0.003, -0.156, 0.003), 0);
  root.add(armR);

  // Rear Left Leg (legL — planted squarely on floor y = 0)
  const legL = new THREE.Group();
  legL.name = 'legL';
  legL.position.set(0.056, 0.212, -0.095);
  const legLCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.016, 0.024, 0.012),
    new THREE.Vector3(0.003, -0.028, 0.014),
    new THREE.Vector3(0.005, -0.088, -0.022),
    new THREE.Vector3(0.005, -0.152, -0.016),
    new THREE.Vector3(0.005, -0.188, -0.005)
  ]);
  legL.add(setShadow(new THREE.Mesh(
    buildTaperedTube(THREE, legLCurve, makeHindRadius, 24, 18, new THREE.Vector3(1, 0, 0), true, true),
    limbFurMat
  ), 'fur'));
  const hoofLegL = setShadow(new THREE.Mesh(sharedHoofGeom, hoofMat), 'secondary');
  hoofLegL.position.set(0.005, -0.212, -0.002);
  legL.add(hoofLegL);
  addFetlockTuft(legL, new THREE.Vector3(0.005, -0.162, -0.018), 0);
  root.add(legL);

  // Rear Right Leg (legR — planted squarely on floor y = 0, stepped slightly back)
  const legR = new THREE.Group();
  legR.name = 'legR';
  legR.position.set(-0.056, 0.212, -0.098);
  const legRCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.016, 0.024, 0.012),
    new THREE.Vector3(-0.003, -0.028, 0.010),
    new THREE.Vector3(-0.005, -0.088, -0.032),
    new THREE.Vector3(-0.005, -0.152, -0.030),
    new THREE.Vector3(-0.005, -0.188, -0.018)
  ]);
  legR.add(setShadow(new THREE.Mesh(
    buildTaperedTube(THREE, legRCurve, makeHindRadius, 24, 18, new THREE.Vector3(1, 0, 0), true, true),
    limbFurMat
  ), 'fur'));
  const hoofLegR = setShadow(new THREE.Mesh(sharedHoofGeom, hoofMat), 'secondary');
  hoofLegR.position.set(-0.005, -0.212, -0.015);
  legR.add(hoofLegR);
  addFetlockTuft(legR, new THREE.Vector3(-0.005, -0.162, -0.032), 0);
  root.add(legR);

  // Store animation references & resting pose for stateless idle(group, t)
  root.userData.anim = {
    body,
    head,
    earL,
    earR,
    tail,
    armL,
    hornMat,
    eyeL: eyeGroups.eyeL,
    eyeR: eyeGroups.eyeR,
    base: {
      headRot: [head.rotation.x, head.rotation.y, head.rotation.z],
      earLRot: [earL.rotation.x, earL.rotation.y, earL.rotation.z],
      earRRot: [earR.rotation.x, earR.rotation.y, earR.rotation.z]
    }
  };

  return root;
}

export function idle(group, t) {
  if (!group) return;
  const anim = group.userData && group.userData.anim;
  const body = anim ? anim.body : group.getObjectByName('body');
  const head = anim ? anim.head : group.getObjectByName('head');
  const earL = anim ? anim.earL : group.getObjectByName('earL');
  const earR = anim ? anim.earR : group.getObjectByName('earR');
  const tail = anim ? anim.tail : group.getObjectByName('tail');
  const armL = anim ? anim.armL : group.getObjectByName('armL');
  const eyeL = anim ? anim.eyeL : group.getObjectByName('eyeL');
  const eyeR = anim ? anim.eyeR : group.getObjectByName('eyeR');

  const base = anim ? anim.base : {
    headRot: [0.06, 0.14, -0.09],
    earLRot: [-0.14, 0.24, -0.34],
    earRRot: [-0.10, -0.30, 0.40]
  };

  // Gentle breathing on torso/body while standing hooves stay planted on floor
  const breath = Math.sin(t * 2.1);
  if (body) {
    body.scale.set(1 + breath * 0.011, 1 + breath * 0.015, 1 + breath * 0.008);
    body.position.y = breath * 0.0022;
  }

  // Curious soft head sway & micro-nod
  if (head) {
    head.rotation.x = base.headRot[0] + Math.sin(t * 1.05 + 0.4) * 0.035 + breath * 0.012;
    head.rotation.y = base.headRot[1] + Math.sin(t * 0.72) * 0.065;
    head.rotation.z = base.headRot[2] + Math.sin(t * 0.92 + 1.1) * 0.042;
  }

  // Soft ear sway with occasional cute ear flick
  const flickCycle = t % 5.4;
  const flick = (flickCycle > 4.95 && flickCycle < 5.25)
    ? Math.sin(((flickCycle - 4.95) / 0.30) * Math.PI) * 0.15
    : 0;
  if (earL) {
    earL.rotation.z = base.earLRot[2] + Math.sin(t * 1.7) * 0.04 - flick;
    earL.rotation.x = base.earLRot[0] + Math.sin(t * 1.3 + 0.7) * 0.03;
  }
  if (earR) {
    earR.rotation.z = base.earRRot[2] + Math.sin(t * 1.55 + 1.4) * 0.04 + flick * 0.45;
    earR.rotation.x = base.earRRot[0] + Math.sin(t * 1.2 + 2.1) * 0.03;
  }

  // Flowing tail gentle swish
  if (tail) {
    tail.rotation.y = Math.sin(t * 1.35) * 0.11 + Math.sin(t * 2.6 + 0.6) * 0.03;
    tail.rotation.x = Math.sin(t * 2.1 - 0.5) * 0.04;
  }

  // Playful subtle bob of the lifted front hoof
  if (armL) {
    armL.rotation.x = Math.sin(t * 1.85 + 0.5) * 0.055;
    armL.rotation.z = Math.sin(t * 1.15) * 0.02;
  }

  // Subtle magical pulse on the glowing spiral horn
  if (anim && anim.hornMat) {
    anim.hornMat.emissiveIntensity = 1.42 + 0.24 * Math.sin(t * 2.4);
  }

  // Natural blink every ~3.8 seconds by scaling eye groups on y
  const blinkPeriod = 3.8;
  const phase = t % blinkPeriod;
  let eyeScaleY = 1.0;
  if (phase > 3.56 && phase < 3.74) {
    const b = Math.sin(((phase - 3.56) / 0.18) * Math.PI);
    eyeScaleY = 1.0 - 0.90 * b;
  }
  if (eyeL) eyeL.scale.y = eyeScaleY;
  if (eyeR) eyeR.scale.y = eyeScaleY;
}
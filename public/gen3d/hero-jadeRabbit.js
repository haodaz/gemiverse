export const META = {
  id: 'moon-rabbit',
  name: 'Moon Rabbit',
  kind: 'creature',
  footprint: [0.18, 0.22],
  variants: ['jade', 'celestial', 'osmanthus'],
  note: 'Stylised moon rabbit standing on hind legs holding a wooden pestle over a carved stone mortar, pale fur with a faint jade-green luminescence and long upright ears.'
};

const PALETTES = {
  jade: {
    fur: '#f3f2ea',
    furAccent: '#cfdcd4',
    eye: '#277a66',
    glow: '#7ff5bc',
    skin: '#d99fa0',
    primary: '#9e7552',
    secondary: '#7d8285',
    accent: '#b85a62'
  },
  celestial: {
    fur: '#edf0fa',
    furAccent: '#c4cce6',
    eye: '#2d688a',
    glow: '#72f4dc',
    skin: '#d49fb0',
    primary: '#8f6d54',
    secondary: '#757d8a',
    accent: '#596aa8'
  },
  osmanthus: {
    fur: '#f7f0e2',
    furAccent: '#e0ccb0',
    eye: '#4b7a4a',
    glow: '#a7f28a',
    skin: '#dc9f95',
    primary: '#a37148',
    secondary: '#858079',
    accent: '#c97b49'
  }
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function fbm(kit, x, y, octaves = 3) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += kit.noise(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

function colorToRgba(THREE, col, alpha = 1) {
  const c = col instanceof THREE.Color ? col : new THREE.Color(col);
  const hex = c.getHex();
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function blendHex(THREE, cA, cB, t) {
  const a = new THREE.Color(cA);
  const b = new THREE.Color(cB);
  return a.lerp(b, t);
}

function computeSmoothNormals(THREE, geom) {
  const pos = geom.attributes.position;
  const count = pos.count;
  const norms = new Float32Array(count * 3);
  const buckets = new Map();
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const fn = new THREE.Vector3();

  const keyOf = (x, y, z) =>
    `${Math.round(x * 1e5)},${Math.round(y * 1e5)},${Math.round(z * 1e5)}`;

  const idx = geom.index;
  const triCount = idx ? idx.count / 3 : count / 3;

  for (let t = 0; t < triCount; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3;
    const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;

    vA.fromBufferAttribute(pos, i0);
    vB.fromBufferAttribute(pos, i1);
    vC.fromBufferAttribute(pos, i2);

    e1.subVectors(vB, vA);
    e2.subVectors(vC, vA);
    fn.crossVectors(e1, e2);

    const verts = [vA, vB, vC];
    for (let k = 0; k < 3; k++) {
      const key = keyOf(verts[k].x, verts[k].y, verts[k].z);
      let acc = buckets.get(key);
      if (!acc) {
        acc = [0, 0, 0];
        buckets.set(key, acc);
      }
      acc[0] += fn.x;
      acc[1] += fn.y;
      acc[2] += fn.z;
    }
  }

  for (let i = 0; i < count; i++) {
    const key = keyOf(pos.getX(i), pos.getY(i), pos.getZ(i));
    const acc = buckets.get(key);
    if (acc) {
      const len = Math.hypot(acc[0], acc[1], acc[2]) || 1;
      norms[i * 3] = acc[0] / len;
      norms[i * 3 + 1] = acc[1] / len;
      norms[i * 3 + 2] = acc[2] / len;
    } else {
      norms[i * 3 + 1] = 1;
    }
  }

  geom.setAttribute('normal', new THREE.BufferAttribute(norms, 3));
}

function subdivideNonIndexedOnce(THREE, geom) {
  const src = geom.index ? geom.toNonIndexed() : geom;
  const pos = src.attributes.position;
  const uv = src.attributes.uv;
  const triCount = pos.count / 3;
  const outPos = new Float32Array(triCount * 12 * 3);
  const outUv = uv ? new Float32Array(triCount * 12 * 2) : null;

  let pOff = 0;
  let uOff = 0;
  const pushV = (x, y, z, u, v) => {
    outPos[pOff++] = x;
    outPos[pOff++] = y;
    outPos[pOff++] = z;
    if (outUv) {
      outUv[uOff++] = u;
      outUv[uOff++] = v;
    }
  };

  for (let t = 0; t < triCount; t++) {
    const i0 = t * 3;
    const i1 = i0 + 1;
    const i2 = i0 + 2;

    const x0 = pos.getX(i0), y0 = pos.getY(i0), z0 = pos.getZ(i0);
    const x1 = pos.getX(i1), y1 = pos.getY(i1), z1 = pos.getZ(i1);
    const x2 = pos.getX(i2), y2 = pos.getY(i2), z2 = pos.getZ(i2);

    const mx01 = (x0 + x1) * 0.5, my01 = (y0 + y1) * 0.5, mz01 = (z0 + z1) * 0.5;
    const mx12 = (x1 + x2) * 0.5, my12 = (y1 + y2) * 0.5, mz12 = (z1 + z2) * 0.5;
    const mx20 = (x2 + x0) * 0.5, my20 = (y2 + y0) * 0.5, mz20 = (z2 + z0) * 0.5;

    let u0 = 0, v0 = 0, u1 = 0, v1 = 0, u2 = 0, v2 = 0;
    let mu01 = 0, mv01 = 0, mu12 = 0, mv12 = 0, mu20 = 0, mv20 = 0;
    if (uv) {
      u0 = uv.getX(i0); v0 = uv.getY(i0);
      u1 = uv.getX(i1); v1 = uv.getY(i1);
      u2 = uv.getX(i2); v2 = uv.getY(i2);
      mu01 = (u0 + u1) * 0.5; mv01 = (v0 + v1) * 0.5;
      mu12 = (u1 + u2) * 0.5; mv12 = (v1 + v2) * 0.5;
      mu20 = (u2 + u0) * 0.5; mv20 = (v2 + v0) * 0.5;
    }

    pushV(x0, y0, z0, u0, v0);
    pushV(mx01, my01, mz01, mu01, mv01);
    pushV(mx20, my20, mz20, mu20, mv20);

    pushV(mx01, my01, mz01, mu01, mv01);
    pushV(x1, y1, z1, u1, v1);
    pushV(mx12, my12, mz12, mu12, mv12);

    pushV(mx20, my20, mz20, mu20, mv20);
    pushV(mx12, my12, mz12, mu12, mv12);
    pushV(x2, y2, z2, u2, v2);

    pushV(mx01, my01, mz01, mu01, mv01);
    pushV(mx12, my12, mz12, mu12, mv12);
    pushV(mx20, my20, mz20, mu20, mv20);
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(outPos, 3));
  if (outUv) out.setAttribute('uv', new THREE.BufferAttribute(outUv, 2));
  if (src !== geom) src.dispose();
  return out;
}

/**
 * Ring-by-ring tapered tube using parallel-transport frames (twist-free),
 * with optional custom cross-section shaping and smooth domed caps.
 */
function makeTaperedTube(THREE, curve, tubularSegs, radialSegs, radiusFn, options = {}) {
  const capStart = options.capStart !== undefined ? options.capStart : true;
  const capEnd = options.capEnd !== undefined ? options.capEnd : true;
  const capRings = options.capRings || 4;
  const crossSectionFn = options.crossSectionFn || null;
  const postVertexFn = options.postVertexFn || null;

  const basePoints = [];
  const baseTangents = [];
  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    basePoints.push(curve.getPoint(u));
    baseTangents.push(curve.getTangent(u).normalize());
  }

  // Parallel transport frames
  const normals = [];
  const binormals = [];
  const t0 = baseTangents[0];
  const ref = Math.abs(t0.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const n0 = new THREE.Vector3().crossVectors(t0, ref).normalize();
  const b0 = new THREE.Vector3().crossVectors(t0, n0).normalize();
  normals.push(n0);
  binormals.push(b0);

  const q = new THREE.Quaternion();
  for (let i = 1; i <= tubularSegs; i++) {
    q.setFromUnitVectors(baseTangents[i - 1], baseTangents[i]);
    const ni = normals[i - 1].clone().applyQuaternion(q);
    ni.addScaledVector(baseTangents[i], -ni.dot(baseTangents[i])).normalize();
    const bi = new THREE.Vector3().crossVectors(baseTangents[i], ni).normalize();
    normals.push(ni);
    binormals.push(bi);
  }

  // Build full ring descriptors including smooth hemisphere caps
  const rings = [];
  if (capStart) {
    const rStart = Math.max(1e-5, radiusFn(0));
    for (let c = capRings; c >= 1; c--) {
      const ang = (c / capRings) * (Math.PI * 0.5);
      const scale = Math.max(0.001, Math.cos(ang));
      const ext = -Math.sin(ang) * rStart * 0.85;
      rings.push({
        u: 0,
        center: basePoints[0].clone().addScaledVector(baseTangents[0], ext),
        t: baseTangents[0],
        n: normals[0],
        b: binormals[0],
        r: rStart * scale,
        capFactor: scale
      });
    }
  }

  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    rings.push({
      u,
      center: basePoints[i],
      t: baseTangents[i],
      n: normals[i],
      b: binormals[i],
      r: Math.max(1e-5, radiusFn(u)),
      capFactor: 1
    });
  }

  if (capEnd) {
    const rEnd = Math.max(1e-5, radiusFn(1));
    for (let c = 1; c <= capRings; c++) {
      const ang = (c / capRings) * (Math.PI * 0.5);
      const scale = Math.max(0.001, Math.cos(ang));
      const ext = Math.sin(ang) * rEnd * 0.9;
      rings.push({
        u: 1,
        center: basePoints[tubularSegs].clone().addScaledVector(baseTangents[tubularSegs], ext),
        t: baseTangents[tubularSegs],
        n: normals[tubularSegs],
        b: binormals[tubularSegs],
        r: rEnd * scale,
        capFactor: scale
      });
    }
  }

  const ringCount = rings.length;
  const stride = radialSegs + 1;
  const positions = new Float32Array(ringCount * stride * 3);
  const uvs = new Float32Array(ringCount * stride * 2);
  const indices = [];
  const tmp = new THREE.Vector3();

  for (let i = 0; i < ringCount; i++) {
    const ring = rings[i];
    for (let j = 0; j <= radialSegs; j++) {
      const v = j / radialSegs;
      const theta = v * Math.PI * 2;
      const cs = Math.cos(theta);
      const sn = Math.sin(theta);

      let rn = ring.r;
      let rb = ring.r;
      let offN = 0;
      let offB = 0;
      if (crossSectionFn) {
        const res = crossSectionFn(ring.u, theta, ring.r, ring.capFactor);
        rn = res.rn;
        rb = res.rb;
        offN = res.offN || 0;
        offB = res.offB || 0;
      }

      tmp.copy(ring.center)
        .addScaledVector(ring.n, cs * rn + offN)
        .addScaledVector(ring.b, sn * rb + offB);

      if (postVertexFn) {
        postVertexFn(tmp, ring.u, theta, ring.capFactor);
      }

      const idx = i * stride + j;
      positions[idx * 3] = tmp.x;
      positions[idx * 3 + 1] = tmp.y;
      positions[idx * 3 + 2] = tmp.z;
      uvs[idx * 2] = v;
      uvs[idx * 2 + 1] = ring.u;
    }
  }

  for (let i = 0; i < ringCount - 1; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      // Outward CCW winding for right-handed (N, B, T)
      indices.push(a, d, b);
      indices.push(d, c, b);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Deterministic head sculpting surface evaluator so eyes, nose, mouth, blush,
 * and whiskers can be placed with sub-millimetre accuracy on the sculpted mesh.
 */
function evalHeadPoint(ux, uy, uz, kit) {
  // Base cranium proportions
  let rx = 0.0385;
  let ry = 0.0375;
  let rz = 0.0385;

  // Gentle cranium dome taper near top
  if (uy > 0.25) {
    const k = uy - 0.25;
    rx *= 1 - 0.14 * k * k;
    rz *= 1 - 0.08 * k * k;
  }

  let x = ux * rx;
  let y = uy * ry;
  let z = uz * rz;

  // Plush chibi bunny cheeks (jowls)
  const cheekL = Math.exp(-((ux - 0.72) ** 2 / 0.26 + (uy + 0.24) ** 2 / 0.22 + (uz - 0.34) ** 2 / 0.45));
  const cheekR = Math.exp(-((ux + 0.72) ** 2 / 0.26 + (uy + 0.24) ** 2 / 0.22 + (uz - 0.34) ** 2 / 0.45));
  const cheeks = cheekL + cheekR;
  x += Math.sign(ux) * cheeks * 0.0082;
  y -= cheeks * 0.0022;
  z += cheeks * 0.0038;

  // Sculpted continuous muzzle protrusion
  const muzzle = Math.exp(-(ux * ux / 0.24 + (uy + 0.22) ** 2 / 0.16 + (uz - 0.96) ** 2 / 0.22));
  z += muzzle * 0.0105;
  y -= muzzle * 0.0012;

  // Two soft puffy whisker pads with a delicate central philtrum dip
  const padL = Math.exp(-((ux - 0.23) ** 2 / 0.045 + (uy + 0.30) ** 2 / 0.045 + (uz - 0.93) ** 2 / 0.08));
  const padR = Math.exp(-((ux + 0.23) ** 2 / 0.045 + (uy + 0.30) ** 2 / 0.045 + (uz - 0.93) ** 2 / 0.08));
  z += (padL + padR) * 0.0026;
  const philtrum = Math.exp(-(ux * ux / 0.008 + (uy + 0.28) ** 2 / 0.025 + (uz - 0.96) ** 2 / 0.06));
  z -= philtrum * 0.0012;

  // Soft brow fullness & gently recessed orbital sockets for seated eyes
  const brow = Math.exp(-(ux * ux / 0.48 + (uy - 0.28) ** 2 / 0.09 + (uz - 0.88) ** 2 / 0.16));
  z += brow * 0.0018;

  const eyeDirX = 0.51;
  const eyeDirY = 0.02;
  const eyeDirZ = 0.86;
  const sockL = Math.exp(-((ux - eyeDirX) ** 2 + (uy - eyeDirY) ** 2 + (uz - eyeDirZ) ** 2) / 0.055);
  const sockR = Math.exp(-((ux + eyeDirX) ** 2 + (uy - eyeDirY) ** 2 + (uz - eyeDirZ) ** 2) / 0.055);
  const sock = sockL + sockR;
  x -= ux * sock * 0.0026;
  y -= uy * sock * 0.0026;
  z -= uz * sock * 0.0026;

  // Subtle ear-root skull mounds
  const earRootL = Math.exp(-((ux - 0.34) ** 2 / 0.09 + (uy - 0.88) ** 2 / 0.07 + (uz + 0.14) ** 2 / 0.14));
  const earRootR = Math.exp(-((ux + 0.34) ** 2 / 0.09 + (uy - 0.88) ** 2 / 0.07 + (uz + 0.14) ** 2 / 0.14));
  y += (earRootL + earRootR) * 0.0024;

  // Neck transition overlap at base of skull
  if (uy < -0.58) {
    const nt = smoothstep(-0.58, -1.0, uy);
    y -= nt * 0.0055;
    x *= 1 - nt * 0.16;
    z *= 1 - nt * 0.14;
  }

  // Subtle plush fur micro-organic variation
  if (kit) {
    const n = (kit.noise(ux * 3.8 + 4.2, uy * 3.8 + uz * 2.1 + 7.1) - 0.5) * 0.0007;
    x += ux * n;
    y += uy * n;
    z += uz * n;
  }

  // Offset so head pivot sits cleanly at the neck joint
  return [x, y + 0.034, z + 0.004];
}

function getHeadFrame(THREE, dx, dy, dz, kit) {
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  const p0 = evalHeadPoint(dir.x, dir.y, dir.z, kit);
  const pos = new THREE.Vector3(p0[0], p0[1], p0[2]);

  const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const t1 = new THREE.Vector3().crossVectors(up, dir).normalize();
  const t2 = new THREE.Vector3().crossVectors(dir, t1).normalize();
  const eps = 0.015;

  const d1 = dir.clone().addScaledVector(t1, eps).normalize();
  const d2 = dir.clone().addScaledVector(t2, eps).normalize();
  const p1 = evalHeadPoint(d1.x, d1.y, d1.z, kit);
  const p2 = evalHeadPoint(d2.x, d2.y, d2.z, kit);

  const v1 = new THREE.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
  const v2 = new THREE.Vector3(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);
  const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
  if (normal.dot(dir) < 0) normal.negate();

  return { pos, normal };
}

function buildHeadGeometry(THREE, kit) {
  const geom = new THREE.SphereGeometry(1, 60, 44);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);
    const p = evalHeadPoint(ux, uy, uz, kit);
    pos.setXYZ(i, p[0], p[1], p[2]);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

function buildBodyGeometry(THREE, kit) {
  const geom = new THREE.SphereGeometry(1, 56, 40);
  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);

    const t = (uy + 1) * 0.5; // 0 bottom, 1 top of neck post
    const h = lerp(-0.064, 0.066, t);

    // Pear-shaped upright chibi rabbit silhouette
    const hipCurve = Math.sin(clamp(t * 1.15, 0, 1) * Math.PI);
    const bellySwell = Math.exp(-((t - 0.30) ** 2) / 0.075);
    const shoulderSwell = Math.exp(-((t - 0.72) ** 2) / 0.045);
    const neckPinch = smoothstep(0.76, 0.94, t);

    let rx = 0.020 + hipCurve * 0.015 + bellySwell * 0.017 + shoulderSwell * 0.003;
    let rz = 0.019 + hipCurve * 0.014 + bellySwell * 0.015 + shoulderSwell * 0.002;

    // Taper smoothly into a continuous neck collar overlapping the head
    rx = lerp(rx, 0.0225, neckPinch * 0.78);
    rz = lerp(rz, 0.0225, neckPinch * 0.78);

    // Taper cleanly toward bottom pelvis
    const botTaper = smoothstep(0.14, 0.0, t);
    rx *= 1 - botTaper * 0.35;
    rz *= 1 - botTaper * 0.35;

    let x = ux * rx;
    let y = h;
    let z = uz * rz;

    // Gentle S-posture: plump forward belly, rounded haunch back, forward neck lean
    z += Math.exp(-((t - 0.36) ** 2) / 0.06) * 0.0065 * Math.max(0, uz);
    z -= Math.exp(-((t - 0.24) ** 2) / 0.05) * 0.0045 * Math.max(0, -uz);
    z += smoothstep(0.55, 1.0, t) * 0.0045;

    // Sculpted plush chest fluff puff
    const chestFluff = Math.exp(-(ux * ux / 0.32 + (t - 0.72) ** 2 / 0.018)) * Math.max(0, uz);
    z += chestFluff * 0.0055;
    y -= chestFluff * 0.0015;

    // Soft shoulder mounds where arms merge
    const shL = Math.exp(-((ux - 0.82) ** 2 / 0.16 + (t - 0.73) ** 2 / 0.014 + (uz - 0.15) ** 2 / 0.25));
    const shR = Math.exp(-((ux + 0.82) ** 2 / 0.16 + (t - 0.73) ** 2 / 0.014 + (uz - 0.15) ** 2 / 0.25));
    x += Math.sign(ux) * (shL + shR) * 0.0038;

    // Softly flatten underside of pelvis
    if (y < -0.056) {
      y = lerp(y, -0.056, 0.45);
    }

    // Subtle organic fur ripple
    const n = (kit.noise(ux * 3.5 + 1.3, uy * 4.0 + uz * 2.5 + 3.7) - 0.5) * 0.0009;
    x += ux * n;
    z += uz * n;

    pos.setXYZ(i, x, y, z);
  }

  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

function buildTailGeometry(THREE, kit) {
  const geom = new THREE.SphereGeometry(1, 36, 26);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);

    // Sculpted multi-lobe fluffy cotton-tail puff
    const puff =
      1.0 +
      0.11 * Math.sin(ux * 5.2 + 0.4) * Math.cos(uy * 4.8) +
      0.09 * Math.sin(uz * 5.5 + uy * 3.1) +
      0.10 * (fbm(kit, ux * 2.2 + 5.1, uy * 2.2 + uz * 2.2 + 2.4, 2) - 0.5);

    let x = ux * 0.0185 * puff;
    let y = uy * 0.0205 * puff;
    let z = uz * 0.0215 * puff;

    // Slight upward teardrop curl & gentle asymmetric swish
    y += smoothstep(-0.3, 1.0, -uz) * 0.005;
    x += smoothstep(-0.2, 1.0, -uz) * 0.0035;

    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

function buildEarGeometry(THREE, options = {}) {
  const H = options.length || 0.112;
  const maxW = options.width || 0.0145;
  const backBend = options.backBend !== undefined ? options.backBend : 0.015;
  const sideBend = options.sideBend !== undefined ? options.sideBend : 0.007;
  const tipCurl = options.tipCurl || 0;

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(maxW * 0.42, H * 0.02, maxW * 1.05, H * 0.34, maxW * 0.98, H * 0.65);
  shape.bezierCurveTo(maxW * 0.92, H * 0.87, maxW * 0.44, H * 1.0, 0, H);
  shape.bezierCurveTo(-maxW * 0.44, H * 1.0, -maxW * 0.92, H * 0.87, -maxW * 0.98, H * 0.65);
  shape.bezierCurveTo(-maxW * 1.05, H * 0.34, -maxW * 0.42, H * 0.02, 0, 0);

  const depth = 0.0038;
  const raw = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.0032,
    bevelSize: 0.0024,
    bevelSegments: 3,
    curveSegments: 16,
    steps: 1
  });

  // Subdivide uniformly so interior vertices allow a true sculpted concave cup + smooth bend
  const geom = subdivideNonIndexedOnce(THREE, raw);
  raw.dispose();

  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  const halfD = depth * 0.5;
  const maxHalfZ = halfD + 0.0032;
  const maxHalfX = maxW + 0.0024;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i) - halfD;

    const s = clamp(y / H, 0, 1);

    // Cylindrical wrap UV: u = 0.5 at front inner ear center, 0/1 at back center
    const angle = Math.atan2(x / maxHalfX, z / maxHalfZ);
    const u = 0.5 + (angle / (Math.PI * 2));
    uv.setXY(i, u, s);

    // Gently thicken ear root so it merges plushly into cranium, thin slightly near tip
    const thickScale = lerp(1.22, 0.72, smoothstep(0.0, 0.92, s));
    z *= thickScale;

    // Carve concave inner-ear spoon on the front face
    const nx = clamp(x / maxHalfX, -1, 1);
    const alongEnv = Math.sin(s * Math.PI) * (1 - 0.22 * s);
    if (z > 0) {
      const innerSpoon = Math.exp(-(nx * nx) / 0.34) * alongEnv;
      z -= innerSpoon * 0.0026;
    }

    // Transverse C-cup curl (edges cup softly forward)
    z += alongEnv * 0.0052 * (nx * nx - 0.38);

    // Longitudinal graceful backward & outward curve + optional charming tip curl
    z -= backBend * s * s;
    x += sideBend * s * s;
    if (tipCurl !== 0 && s > 0.5) {
      const ct = (s - 0.5) / 0.5;
      const c2 = ct * ct;
      z += tipCurl * c2 * 0.018;
      y -= Math.abs(tipCurl) * c2 * 0.007;
      x += Math.sign(sideBend || 1) * tipCurl * c2 * 0.008;
    }

    pos.setXYZ(i, x, y, z);
  }

  // Fix wrap-around seam triangles at back center (u jumping between ~0 and ~1)
  const triCount = pos.count / 3;
  for (let t = 0; t < triCount; t++) {
    const i0 = t * 3;
    const i1 = i0 + 1;
    const i2 = i0 + 2;
    const u0 = uv.getX(i0);
    const u1 = uv.getX(i1);
    const u2 = uv.getX(i2);
    const spread = Math.max(u0, u1, u2) - Math.min(u0, u1, u2);
    if (spread > 0.5) {
      if (u0 < 0.5) uv.setX(i0, u0 + 1.0);
      if (u1 < 0.5) uv.setX(i1, u1 + 1.0);
      if (u2 < 0.5) uv.setX(i2, u2 + 1.0);
    }
  }

  pos.needsUpdate = true;
  uv.needsUpdate = true;
  computeSmoothNormals(THREE, geom);
  return geom;
}

function buildHindLegGeometry(THREE, sideSign) {
  // Continuous smooth J-curve from hip deep inside body -> thigh -> ankle -> long plush foot
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-sideSign * 0.006, 0.056, -0.010),
    new THREE.Vector3(sideSign * 0.004, 0.036, -0.005),
    new THREE.Vector3(sideSign * 0.002, 0.015, 0.001),
    new THREE.Vector3(0.000, 0.0105, 0.017),
    new THREE.Vector3(-sideSign * 0.001, 0.0095, 0.033)
  ]);

  const geom = makeTaperedTube(
    THREE,
    curve,
    30,
    24,
    (u) => {
      // Plump haunch at top, gentle ankle taper, wider plush bunny foot toward front
      const haunch = Math.exp(-((u - 0.16) ** 2) / 0.045) * 0.010;
      const ankleDip = -Math.exp(-((u - 0.50) ** 2) / 0.025) * 0.003;
      const footPad = smoothstep(0.55, 0.90, u) * 0.0025;
      return 0.0135 + haunch + ankleDip + footPad;
    },
    {
      capStart: true,
      capEnd: true,
      capRings: 4,
      crossSectionFn: (u, theta, r) => {
        // Widen foot horizontally and soften vertically; bulge heel gently at back of ankle
        const footT = smoothstep(0.50, 0.85, u);
        const heelT = Math.exp(-((u - 0.46) ** 2) / 0.016);
        const rn = r * lerp(1.02, 1.18, footT);
        const rb = r * lerp(1.06, 0.78, footT) + heelT * 0.0035 * Math.max(0, -Math.sin(theta));
        return { rn, rb };
      },
      postVertexFn: (v, u) => {
        // Soft flat bunny sole strictly resting on y = 0
        if (v.y < 0.0018) {
          v.y = Math.max(0, v.y * 0.25);
        }
        // Subtle 3-toe plush scallops along front upper paw
        if (u > 0.82 && v.y > 0.002) {
          const toeEnv = smoothstep(0.82, 0.98, u) * smoothstep(0.002, 0.011, v.y);
          const toeWave = Math.cos(v.x * 380) * 0.0009 * toeEnv;
          v.z += toeWave;
          v.y += toeWave * 0.6;
        }
      }
    }
  );

  geom.computeVertexNormals();
  return geom;
}

function buildArmGeometry(THREE, sideSign, elbowPt, pawTargetPt) {
  // Curve in arm local space starting deep inside torso so shoulder has zero seam
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-sideSign * 0.010, 0.002, -0.008),
    new THREE.Vector3(0.0, 0.0, 0.0),
    elbowPt,
    pawTargetPt
  ]);

  const geom = makeTaperedTube(
    THREE,
    curve,
    24,
    20,
    (u) => {
      // Plump shoulder -> gentle tapered forearm -> cozy rounded paw mitt at tip
      const shoulder = (1 - smoothstep(0.0, 0.35, u)) * 0.0042;
      const pawMitt = smoothstep(0.74, 0.96, u) * 0.0024;
      const wristPinch = -Math.exp(-((u - 0.72) ** 2) / 0.015) * 0.0012;
      return 0.0096 + shoulder + wristPinch + pawMitt;
    },
    {
      capStart: true,
      capEnd: true,
      capRings: 4,
      crossSectionFn: (u, theta, r) => {
        // Subtle soft paw cushion flattening & inner thumb pad near tip
        const pawT = smoothstep(0.76, 1.0, u);
        const rn = r * (1 + pawT * 0.08);
        const rb = r * (1 - pawT * 0.06);
        return { rn, rb };
      }
    }
  );

  return geom;
}

function buildMortarGeometry(THREE) {
  // 28-point hand-carved stone mortar profile (LatheGeometry)
  const pts = [
    [0.0002, 0.0000],
    [0.0220, 0.0000],
    [0.0320, 0.0000],
    [0.0338, 0.0015],
    [0.0342, 0.0045],
    [0.0328, 0.0078],
    [0.0315, 0.0115],
    [0.0338, 0.0165],
    [0.0385, 0.0245],
    [0.0418, 0.0340],
    [0.0426, 0.0410],
    [0.0415, 0.0445], // Subtle carved decorative waist groove
    [0.0426, 0.0480],
    [0.0424, 0.0560],
    [0.0412, 0.0635],
    [0.0402, 0.0675],
    [0.0385, 0.0695],
    [0.0358, 0.0698], // Thick rounded stone lip
    [0.0336, 0.0682],
    [0.0328, 0.0640],
    [0.0320, 0.0550],
    [0.0300, 0.0445],
    [0.0265, 0.0345],
    [0.0210, 0.0265],
    [0.0140, 0.0220],
    [0.0070, 0.0202],
    [0.0020, 0.0196],
    [0.0002, 0.0195]
  ];

  const v2s = pts.map(([r, y]) => new THREE.Vector2(r, y));
  const geom = new THREE.LatheGeometry(v2s, 48);
  geom.computeVertexNormals();
  return geom;
}

function buildPestleGeometry(THREE, length) {
  // 24-point turned wooden pestle profile from pounding tip (y=0) to pommel (y=length)
  const profile = [
    [0.0002, 0.000],
    [0.0042, 0.008],
    [0.0082, 0.026],
    [0.0108, 0.060],
    [0.0116, 0.110],
    [0.0112, 0.175],
    [0.0098, 0.250],
    [0.0082, 0.340],
    [0.0070, 0.430],
    [0.0064, 0.520],
    [0.0063, 0.610],
    [0.0066, 0.700],
    [0.0074, 0.780],
    [0.0086, 0.825], // Turned decorative collar ring
    [0.0078, 0.850],
    [0.0086, 0.890],
    [0.0094, 0.930],
    [0.0092, 0.960],
    [0.0076, 0.980],
    [0.0048, 0.993],
    [0.0020, 0.998],
    [0.0002, 1.000]
  ];
  const v2s = profile.map(([r, t]) => new THREE.Vector2(r, t * length));
  const geom = new THREE.LatheGeometry(v2s, 32);
  geom.computeVertexNormals();
  return geom;
}

function buildMochiGeometry(THREE, kit) {
  const geom = new THREE.SphereGeometry(1, 36, 24);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);

    const rHoriz = Math.hypot(ux, uz);
    const squish = 1.0 + 0.05 * (kit.noise(ux * 3 + 2.1, uz * 3 + 5.7) - 0.5);
    let x = ux * 0.0275 * squish;
    let z = uz * 0.0275 * squish;
    let y = uy * 0.0145;

    // Soft cozy dimple right under the pestle tip
    if (uy > 0) {
      const dimple = Math.exp(-(rHoriz * rHoriz) / 0.16) * uy;
      y -= dimple * 0.0042;
      const rimPuff = Math.exp(-((rHoriz - 0.55) ** 2) / 0.12) * uy;
      y += rimPuff * 0.0022;
    }

    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

function buildCrescentCharmGeometry(THREE) {
  const shape = new THREE.Shape();
  shape.moveTo(0.001, 0.0075);
  shape.bezierCurveTo(-0.0068, 0.0068, -0.0082, -0.0068, 0.001, -0.0075);
  shape.bezierCurveTo(-0.0028, -0.0046, -0.0028, 0.0046, 0.001, 0.0075);

  const raw = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0016,
    bevelEnabled: true,
    bevelThickness: 0.0010,
    bevelSize: 0.0008,
    bevelSegments: 3,
    curveSegments: 20
  });
  raw.center();
  // Gently bend the crescent to hug the chest curve
  const pos = raw.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    pos.setZ(i, z - (x * x + y * y) * 8.5);
  }
  pos.needsUpdate = true;
  raw.computeVertexNormals();
  return raw;
}

function makeFurTextures(THREE, kit, palette, isHead) {
  const furBase = new THREE.Color(palette.fur);
  const furAccent = new THREE.Color(palette.furAccent);
  const furLight = blendHex(THREE, furBase, '#ffffff', 0.42);
  const furDeep = blendHex(THREE, furAccent, '#5f6b69', 0.25);
  const glowCol = new THREE.Color(palette.glow);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = colorToRgba(THREE, furBase, 1);
    ctx.fillRect(0, 0, w, h);

    // Subtle darker back (u = 0.75) and lighter belly/muzzle (u = 0.25)
    const backGrad = ctx.createRadialGradient(w * 0.75, h * 0.46, w * 0.04, w * 0.75, h * 0.46, w * 0.34);
    backGrad.addColorStop(0, colorToRgba(THREE, furAccent, 0.78));
    backGrad.addColorStop(0.65, colorToRgba(THREE, furAccent, 0.28));
    backGrad.addColorStop(1, colorToRgba(THREE, furAccent, 0));
    ctx.fillStyle = backGrad;
    ctx.fillRect(0, 0, w, h);

    // Soft light belly / front face
    const frontY = isHead ? h * 0.56 : h * 0.52;
    const frontR = isHead ? w * 0.22 : w * 0.25;
    const bellyGrad = ctx.createRadialGradient(w * 0.25, frontY, w * 0.02, w * 0.25, frontY, frontR);
    bellyGrad.addColorStop(0, colorToRgba(THREE, furLight, 0.78));
    bellyGrad.addColorStop(0.7, colorToRgba(THREE, furLight, 0.25));
    bellyGrad.addColorStop(1, colorToRgba(THREE, furLight, 0));
    ctx.fillStyle = bellyGrad;
    ctx.fillRect(0, 0, w, h);

    // Faint jade-tinted moonlight aura on upper crown / shoulders
    const auraGrad = ctx.createLinearGradient(0, 0, 0, h * 0.45);
    auraGrad.addColorStop(0, colorToRgba(THREE, glowCol, 0.14));
    auraGrad.addColorStop(1, colorToRgba(THREE, glowCol, 0));
    ctx.fillStyle = auraGrad;
    ctx.fillRect(0, 0, w, h * 0.45);

    // Soft organic fur noise mottling
    for (let i = 0; i < 1600; i++) {
      const fx = ((i * 73.137) % 1);
      const fy = ((i * 191.793) % 1);
      const n = kit.noise(fx * 18 + (isHead ? 4 : 0), fy * 18);
      const cx = fx * w;
      const cy = fy * h;
      const len = 5 + n * 10;
      const ang = Math.PI * 0.5 + (n - 0.5) * 0.42;
      ctx.strokeStyle = n > 0.52
        ? colorToRgba(THREE, furLight, 0.28)
        : colorToRgba(THREE, furDeep, 0.13);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
      ctx.stroke();
    }

    // On head: faint jade crescent emblem painted gently onto the forehead
    if (isHead) {
      const mx = w * 0.25;
      const my = h * 0.34;
      const glowHalo = ctx.createRadialGradient(mx, my, 2, mx, my, 26);
      glowHalo.addColorStop(0, colorToRgba(THREE, glowCol, 0.45));
      glowHalo.addColorStop(1, colorToRgba(THREE, glowCol, 0));
      ctx.fillStyle = glowHalo;
      ctx.beginPath();
      ctx.arc(mx, my, 26, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(mx, my);
      ctx.scale(0.62, 1.0);
      ctx.fillStyle = colorToRgba(THREE, glowCol, 0.85);
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0.22 * Math.PI, 0.78 * Math.PI, false);
      ctx.arc(0, -4.5, 10.5, 0.82 * Math.PI, 0.18 * Math.PI, true);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      const fx = ((i * 53.719) % 1);
      const fy = ((i * 137.311) % 1);
      const n = kit.noise(fx * 14, fy * 14);
      const cx = fx * w;
      const cy = fy * h;
      const shade = Math.round(105 + n * 50);
      ctx.strokeStyle = `rgb(${shade},${shade},${shade})`;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + (n - 0.5) * 3, cy + 5 + n * 5);
      ctx.stroke();
    }
  });
  bumpMap.wrapS = THREE.RepeatWrapping;

  let emissiveMap = null;
  if (isHead) {
    emissiveMap = kit.canvasTexture(512, 512, (ctx, w, h) => {
      // Very faint jade fur luminescence across the head
      ctx.fillStyle = 'rgb(16, 16, 16)';
      ctx.fillRect(0, 0, w, h);

      const mx = w * 0.25;
      const my = h * 0.34;
      const halo = ctx.createRadialGradient(mx, my, 2, mx, my, 32);
      halo.addColorStop(0, 'rgba(255,255,255,0.65)');
      halo.addColorStop(0.45, 'rgba(255,255,255,0.18)');
      halo.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(mx, my, 32, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(mx, my);
      ctx.scale(0.62, 1.0);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0.22 * Math.PI, 0.78 * Math.PI, false);
      ctx.arc(0, -4.5, 10.5, 0.82 * Math.PI, 0.18 * Math.PI, true);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
    emissiveMap.colorSpace = THREE.SRGBColorSpace;
  }

  return { map, bumpMap, emissiveMap };
}

function makeEarTextures(THREE, kit, palette) {
  const furBase = new THREE.Color(palette.fur);
  const furAccent = new THREE.Color(palette.furAccent);
  const innerCol = blendHex(THREE, palette.skin, palette.fur, 0.42);
  const glowCol = new THREE.Color(palette.glow);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = colorToRgba(THREE, furBase, 1);
    ctx.fillRect(0, 0, w, h);

    // Subtle accent shading on outer back of ears (u near 0 and 1)
    const backL = ctx.createLinearGradient(0, 0, w * 0.28, 0);
    backL.addColorStop(0, colorToRgba(THREE, furAccent, 0.72));
    backL.addColorStop(1, colorToRgba(THREE, furAccent, 0));
    ctx.fillStyle = backL;
    ctx.fillRect(0, 0, w * 0.3, h);

    const backR = ctx.createLinearGradient(w, 0, w * 0.72, 0);
    backR.addColorStop(0, colorToRgba(THREE, furAccent, 0.72));
    backR.addColorStop(1, colorToRgba(THREE, furAccent, 0));
    ctx.fillStyle = backR;
    ctx.fillRect(w * 0.7, 0, w * 0.3, h);

    // Soft blush inner-ear oval centered on front face (u = 0.5)
    ctx.save();
    ctx.translate(w * 0.5, h * 0.52);
    ctx.scale(0.42, 1.0);
    const innerGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, h * 0.42);
    innerGrad.addColorStop(0, colorToRgba(THREE, innerCol, 0.92));
    innerGrad.addColorStop(0.62, colorToRgba(THREE, innerCol, 0.52));
    innerGrad.addColorStop(1, colorToRgba(THREE, innerCol, 0));
    ctx.fillStyle = innerGrad;
    ctx.beginPath();
    ctx.arc(0, 0, h * 0.44, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Faint luminous jade tint washing down from the upright ear tips (cy = 0)
    const tipGrad = ctx.createLinearGradient(0, 0, 0, h * 0.42);
    tipGrad.addColorStop(0, colorToRgba(THREE, glowCol, 0.48));
    tipGrad.addColorStop(0.55, colorToRgba(THREE, glowCol, 0.14));
    tipGrad.addColorStop(1, colorToRgba(THREE, glowCol, 0));
    ctx.fillStyle = tipGrad;
    ctx.fillRect(0, 0, w, h * 0.42);

    // Fine upward fur strokes
    for (let i = 0; i < 650; i++) {
      const fx = ((i * 89.31) % 1);
      const fy = ((i * 157.17) % 1);
      const n = kit.noise(fx * 14 + 2, fy * 14 + 6);
      const cx = fx * w;
      const cy = fy * h;
      ctx.strokeStyle = n > 0.5
        ? 'rgba(255,255,255,0.22)'
        : colorToRgba(THREE, furAccent, 0.18);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + (n - 0.5) * 2.5, cy - 6 - n * 6);
      ctx.stroke();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;

  const emissiveMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = 'rgb(14, 14, 14)';
    ctx.fillRect(0, 0, w, h);

    // Soft jade glow intensifying gracefully toward the ear tips
    const tip = ctx.createLinearGradient(0, 0, 0, h * 0.55);
    tip.addColorStop(0, 'rgb(150, 150, 150)');
    tip.addColorStop(0.45, 'rgb(52, 52, 52)');
    tip.addColorStop(1, 'rgb(14, 14, 14)');
    ctx.fillStyle = tip;
    ctx.fillRect(0, 0, w, h * 0.55);

    // Gentle soft inner-ear luminescence
    const innerGlow = ctx.createRadialGradient(w * 0.5, h * 0.46, 6, w * 0.5, h * 0.46, w * 0.24);
    innerGlow.addColorStop(0, 'rgba(95, 95, 95, 0.65)');
    innerGlow.addColorStop(1, 'rgba(95, 95, 95, 0)');
    ctx.fillStyle = innerGlow;
    ctx.fillRect(0, 0, w, h);
  });
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.wrapS = THREE.RepeatWrapping;

  return { map, emissiveMap };
}

function makeIrisTexture(THREE, kit, eyeColor, glowColor) {
  const base = new THREE.Color(eyeColor);
  const deep = blendHex(THREE, base, '#091418', 0.58);
  const bright = blendHex(THREE, base, glowColor, 0.55);

  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    ctx.fillStyle = colorToRgba(THREE, deep, 1);
    ctx.fillRect(0, 0, w, h);

    // Base radial iris gradient
    const rg = ctx.createRadialGradient(cx, cy, w * 0.16, cx, cy, w * 0.49);
    rg.addColorStop(0, colorToRgba(THREE, deep, 1));
    rg.addColorStop(0.35, colorToRgba(THREE, base, 1));
    rg.addColorStop(0.82, colorToRgba(THREE, deep, 1));
    rg.addColorStop(1, '#0d0c12');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);

    // Luminous lower moonlit iris crescent (charming stylised anime/chibi touch)
    const lowerGlow = ctx.createRadialGradient(cx, cy + h * 0.17, 4, cx, cy + h * 0.15, w * 0.30);
    lowerGlow.addColorStop(0, colorToRgba(THREE, bright, 0.95));
    lowerGlow.addColorStop(0.6, colorToRgba(THREE, base, 0.45));
    lowerGlow.addColorStop(1, colorToRgba(THREE, base, 0));
    ctx.fillStyle = lowerGlow;
    ctx.fillRect(0, 0, w, h);

    // Delicate radial iris fibers
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const n = kit.noise(Math.cos(a) * 3 + 4, Math.sin(a) * 3 + 4);
      ctx.strokeStyle = n > 0.5
        ? colorToRgba(THREE, bright, 0.26)
        : colorToRgba(THREE, deep, 0.35);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * w * 0.20, cy + Math.sin(a) * h * 0.20);
      ctx.lineTo(cx + Math.cos(a) * w * 0.46, cy + Math.sin(a) * h * 0.46);
      ctx.stroke();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBlushTexture(THREE, kit, skinColor) {
  const blush = blendHex(THREE, skinColor, '#ff8e96', 0.38);
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 4, w * 0.5, h * 0.5, w * 0.48);
    g.addColorStop(0, colorToRgba(THREE, blush, 0.62));
    g.addColorStop(0.55, colorToRgba(THREE, blush, 0.28));
    g.addColorStop(1, colorToRgba(THREE, blush, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeStoneTextures(THREE, kit, stoneColor, glowColor) {
  const base = new THREE.Color(stoneColor);
  const dark = blendHex(THREE, base, '#2d3133', 0.48);
  const light = blendHex(THREE, base, '#dce0de', 0.42);
  const jadeDust = new THREE.Color(glowColor);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = colorToRgba(THREE, base, 1);
    ctx.fillRect(0, 0, w, h);

    // Multi-scale mottled granite patches
    for (let y = 0; y < h; y += 6) {
      for (let x = 0; x < w; x += 6) {
        const n = fbm(kit, x / w * 8 + 1.2, y / h * 8 + 3.4, 3);
        const c = n > 0.5 ? light : dark;
        const a = Math.abs(n - 0.5) * 0.65;
        ctx.fillStyle = colorToRgba(THREE, c, a);
        ctx.fillRect(x, y, 7, 7);
      }
    }

    // Fine stone mineral flecks
    for (let i = 0; i < 1800; i++) {
      const fx = (i * 61.371) % 1;
      const fy = (i * 149.893) % 1;
      const n = kit.noise(fx * 25, fy * 25);
      ctx.fillStyle = n > 0.52 ? colorToRgba(THREE, light, 0.35) : colorToRgba(THREE, dark, 0.42);
      ctx.fillRect(fx * w, fy * h, 1.5 + n * 2, 1.5 + n * 2);
    }

    // Subtle carved waist shading band & faint jade mochi dusting near rim
    const band = ctx.createLinearGradient(0, h * 0.52, 0, h * 0.66);
    band.addColorStop(0, 'rgba(20,24,26,0)');
    band.addColorStop(0.5, 'rgba(20,24,26,0.28)');
    band.addColorStop(1, 'rgba(20,24,26,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, h * 0.52, w, h * 0.14);

    // Subtle mochi / jade powder dust along upper rim region of lathe UVs
    const rimDust = ctx.createLinearGradient(0, h * 0.25, 0, h * 0.48);
    rimDust.addColorStop(0, colorToRgba(THREE, jadeDust, 0));
    rimDust.addColorStop(0.45, colorToRgba(THREE, jadeDust, 0.18));
    rimDust.addColorStop(0.55, 'rgba(248,250,245,0.22)');
    rimDust.addColorStop(1, 'rgba(248,250,245,0)');
    ctx.fillStyle = rimDust;
    ctx.fillRect(0, h * 0.25, w, h * 0.23);
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 3) {
        const n = fbm(kit, x / w * 14 + 5, y / h * 14 + 2, 3);
        const s = Math.round(70 + n * 115);
        ctx.fillStyle = `rgb(${s},${s},${s})`;
        ctx.fillRect(x, y, 4, 4);
      }
    }
  });
  bumpMap.wrapS = THREE.RepeatWrapping;

  return { map, bumpMap };
}

function makeWoodTextures(THREE, kit, woodColor, glowColor) {
  const base = new THREE.Color(woodColor);
  const dark = blendHex(THREE, base, '#3d2412', 0.52);
  const light = blendHex(THREE, base, '#e3c39d', 0.38);
  const glowCol = new THREE.Color(glowColor);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = colorToRgba(THREE, base, 1);
    ctx.fillRect(0, 0, w, h);

    // Longitudinal wood grain fibers along v (y)
    for (let x = 0; x < w; x += 2) {
      for (let y = 0; y < h; y += 4) {
        const warp = kit.noise(x / w * 6, y / h * 2.2) * 3.2;
        const ring = Math.sin((x / w * 18 + warp) * Math.PI);
        const col = ring > 0 ? light : dark;
        ctx.fillStyle = colorToRgba(THREE, col, Math.abs(ring) * 0.26);
        ctx.fillRect(x, y, 2, 5);
      }
    }

    // Soft pale mochi & jade sheen on pounding end (v = 0 -> bottom of canvas)
    const tipGrad = ctx.createLinearGradient(0, h * 0.78, 0, h);
    tipGrad.addColorStop(0, 'rgba(245,250,242,0)');
    tipGrad.addColorStop(0.6, colorToRgba(THREE, glowCol, 0.22));
    tipGrad.addColorStop(1, 'rgba(246,252,245,0.52)');
    ctx.fillStyle = tipGrad;
    ctx.fillRect(0, h * 0.78, w, h * 0.22);
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 2) {
      const n = kit.noise(x / w * 22, 3.1);
      const s = Math.round(100 + n * 55);
      ctx.fillStyle = `rgb(${s},${s},${s})`;
      ctx.fillRect(x, 0, 2, h);
    }
  });
  bumpMap.wrapS = THREE.RepeatWrapping;

  return { map, bumpMap };
}

function buildEyeAssembly(THREE, name, sideSign, irisTex, eyeColor, darkEyeMat, highlightMat, lashMat) {
  const eyeGroup = new THREE.Group();
  eyeGroup.name = name;

  // Layer 1: Dark glossy eye dome with clearcoat
  const baseGeom = new THREE.SphereGeometry(0.0094, 28, 22);
  baseGeom.scale(0.90, 1.07, 0.56);
  const baseMesh = new THREE.Mesh(baseGeom, darkEyeMat);
  baseMesh.userData.slot = 'eye';
  eyeGroup.add(baseMesh);

  // Layer 2: Coloured iris ring conforming snugly over the front dome (leaving dark pupil center & limbal rim)
  const irisGeom = new THREE.RingGeometry(0.0040, 0.0074, 32, 3);
  const ipos = irisGeom.attributes.position;
  for (let i = 0; i < ipos.count; i++) {
    const x = ipos.getX(i) * 0.90;
    const y = ipos.getY(i) * 1.07;
    const nx = x / (0.0094 * 0.90);
    const ny = y / (0.0094 * 1.07);
    const r2 = Math.min(0.95, nx * nx + ny * ny);
    const z = Math.sqrt(1 - r2) * (0.0094 * 0.56) + 0.00032;
    ipos.setXYZ(i, x, y, z);
  }
  ipos.needsUpdate = true;
  irisGeom.computeVertexNormals();

  const irisMat = new THREE.MeshPhysicalMaterial({
    map: irisTex,
    roughness: 0.08,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    emissive: new THREE.Color(eyeColor),
    emissiveIntensity: 0.28
  });
  const irisMesh = new THREE.Mesh(irisGeom, irisMat);
  irisMesh.userData.slot = 'eye';
  eyeGroup.add(irisMesh);

  // Layer 3: Two crisp white glossy highlight dots placed up and to one side
  const dot1Geom = new THREE.SphereGeometry(0.0021, 14, 10);
  dot1Geom.scale(1.0, 1.15, 0.45);
  const dot1 = new THREE.Mesh(dot1Geom, highlightMat);
  // Placed consistently upper-left from viewer perspective (-x in local eye frame when facing +z)
  dot1.position.set(-0.0026 + sideSign * 0.0003, 0.0033, 0.0051);
  dot1.rotation.z = 0.25;
  eyeGroup.add(dot1);

  const dot2Geom = new THREE.SphereGeometry(0.00095, 12, 8);
  dot2Geom.scale(1.0, 1.0, 0.5);
  const dot2 = new THREE.Mesh(dot2Geom, highlightMat);
  dot2.position.set(0.0024, -0.0028, 0.0050);
  eyeGroup.add(dot2);

  // Soft curved upper eyelid / lash accent hugging the top edge
  const lashCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.0076, 0.0046, 0.0024),
    new THREE.Vector3(0.0, 0.0098, 0.0022),
    new THREE.Vector3(0.0078, 0.0052, 0.0022)
  ]);
  const lashGeom = makeTaperedTube(THREE, lashCurve, 14, 8, (u) => {
    return 0.00055 + Math.sin(u * Math.PI) * 0.00055;
  });
  const lash = new THREE.Mesh(lashGeom, lashMat);
  eyeGroup.add(lash);

  return eyeGroup;
}

export function build(THREE, opts = {}, kit) {
  const variant = PALETTES[opts.variant] ? opts.variant : 'jade';
  const basePal = PALETTES[variant];
  const palette = {
    fur: opts.fur || basePal.fur,
    furAccent: opts.furAccent || basePal.furAccent,
    eye: opts.eye || basePal.eye,
    glow: opts.glow || basePal.glow,
    skin: basePal.skin,
    primary: basePal.primary,
    secondary: basePal.secondary,
    accent: basePal.accent
  };

  const root = new THREE.Group();
  root.name = 'moonRabbit';

  // --- Textures ---
  const bodyTex = makeFurTextures(THREE, kit, palette, false);
  const headTex = makeFurTextures(THREE, kit, palette, true);
  const earTex = makeEarTextures(THREE, kit, palette);
  const irisTex = makeIrisTexture(THREE, kit, palette.eye, palette.glow);
  const blushTex = makeBlushTexture(THREE, kit, palette.skin);
  const stoneTex = makeStoneTextures(THREE, kit, palette.secondary, palette.glow);
  const woodTex = makeWoodTextures(THREE, kit, palette.primary, palette.glow);

  // --- Shared MeshPhysicalMaterials ---
  const jadeSheen = blendHex(THREE, palette.glow, '#ffffff', 0.45);

  const furBodyMat = new THREE.MeshPhysicalMaterial({
    map: bodyTex.map,
    bumpMap: bodyTex.bumpMap,
    bumpScale: 0.0011,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.9,
    sheenRoughness: 0.65,
    sheenColor: jadeSheen,
    emissive: new THREE.Color(palette.glow),
    emissiveIntensity: 0.08
  });

  const furHeadMat = new THREE.MeshPhysicalMaterial({
    map: headTex.map,
    bumpMap: headTex.bumpMap,
    bumpScale: 0.0009,
    roughness: 0.90,
    metalness: 0.0,
    sheen: 0.9,
    sheenRoughness: 0.65,
    sheenColor: jadeSheen,
    emissive: new THREE.Color(palette.glow),
    emissiveMap: headTex.emissiveMap,
    emissiveIntensity: 1.45
  });

  const furEarMat = new THREE.MeshPhysicalMaterial({
    map: earTex.map,
    bumpMap: bodyTex.bumpMap,
    bumpScale: 0.0007,
    roughness: 0.90,
    metalness: 0.0,
    sheen: 0.95,
    sheenRoughness: 0.6,
    sheenColor: jadeSheen,
    emissive: new THREE.Color(palette.glow),
    emissiveMap: earTex.emissiveMap,
    emissiveIntensity: 1.25
  });

  const darkEyeMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#14111b'),
    roughness: 0.04,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04
  });

  const highlightMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffffff'),
    roughness: 0.04,
    metalness: 0.0,
    clearcoat: 1.0,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.75
  });

  const mouthLashMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#4a3438'),
    roughness: 0.45,
    metalness: 0.0,
    clearcoat: 0.25
  });

  const noseMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(palette.skin),
    roughness: 0.26,
    metalness: 0.0,
    clearcoat: 0.65,
    clearcoatRoughness: 0.22
  });

  const whiskerMat = new THREE.MeshPhysicalMaterial({
    color: blendHex(THREE, palette.fur, palette.glow, 0.22),
    roughness: 0.55,
    metalness: 0.0,
    sheen: 0.6,
    sheenColor: jadeSheen
  });

  const blushMat = new THREE.MeshPhysicalMaterial({
    map: blushTex,
    roughness: 0.95,
    metalness: 0.0,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1
  });

  const cordMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(palette.accent),
    roughness: 0.88,
    metalness: 0.0,
    sheen: 0.85,
    sheenRoughness: 0.6,
    sheenColor: blendHex(THREE, palette.accent, '#ffffff', 0.45)
  });

  const jadeGlowMat = new THREE.MeshPhysicalMaterial({
    color: blendHex(THREE, palette.glow, '#e4fff2', 0.35),
    roughness: 0.14,
    metalness: 0.0,
    clearcoat: 0.95,
    clearcoatRoughness: 0.1,
    emissive: new THREE.Color(palette.glow),
    emissiveIntensity: 1.5
  });

  const stoneMat = new THREE.MeshPhysicalMaterial({
    map: stoneTex.map,
    bumpMap: stoneTex.bumpMap,
    bumpScale: 0.0022,
    roughness: 0.90,
    metalness: 0.02
  });

  const woodMat = new THREE.MeshPhysicalMaterial({
    map: woodTex.map,
    bumpMap: woodTex.bumpMap,
    bumpScale: 0.0012,
    roughness: 0.54,
    metalness: 0.0,
    clearcoat: 0.22,
    clearcoatRoughness: 0.42
  });

  const mochiMat = new THREE.MeshPhysicalMaterial({
    color: blendHex(THREE, '#fafbf4', palette.glow, 0.16),
    roughness: 0.42,
    metalness: 0.0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.35,
    sheen: 0.6,
    sheenColor: jadeSheen,
    emissive: new THREE.Color(palette.glow),
    emissiveIntensity: 0.68
  });

  // --- Hind Legs (standing solidly on y = 0) ---
  const legL = new THREE.Group();
  legL.name = 'legL';
  legL.position.set(0.030, 0.0, -0.026);
  legL.rotation.y = 0.26;
  const legLMesh = new THREE.Mesh(buildHindLegGeometry(THREE, 1), furBodyMat);
  legLMesh.userData.slot = 'fur';
  legLMesh.castShadow = true;
  legLMesh.receiveShadow = true;
  legL.add(legLMesh);
  root.add(legL);

  const legR = new THREE.Group();
  legR.name = 'legR';
  legR.position.set(-0.030, 0.0, -0.022);
  legR.rotation.y = -0.22;
  const legRMesh = new THREE.Mesh(buildHindLegGeometry(THREE, -1), furBodyMat);
  legRMesh.userData.slot = 'fur';
  legRMesh.castShadow = true;
  legRMesh.receiveShadow = true;
  legR.add(legRMesh);
  root.add(legR);

  // --- Body (continuous sculpted torso + haunches + neck) ---
  const body = new THREE.Group();
  body.name = 'body';
  body.position.set(0, 0.082, -0.028);
  body.rotation.y = 0.04;
  body.userData.basePos = body.position.clone();
  body.userData.baseRot = body.rotation.clone();

  const bodyMesh = new THREE.Mesh(buildBodyGeometry(THREE, kit), furBodyMat);
  bodyMesh.userData.slot = 'fur';
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  body.add(bodyMesh);
  root.add(body);

  // --- Fluffy Cotton Tail ---
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(0.002, -0.035, -0.037);
  tail.rotation.set(0.18, 0.14, 0.0);
  tail.userData.baseRot = tail.rotation.clone();

  const tailMesh = new THREE.Mesh(buildTailGeometry(THREE, kit), furBodyMat);
  tailMesh.userData.slot = 'fur';
  tailMesh.castShadow = true;
  tailMesh.receiveShadow = true;
  tail.add(tailMesh);
  body.add(tail);

  // --- Cozy Silk Neck Cord + Glowing Carved Jade Crescent Charm ---
  const neckCordGroup = new THREE.Group();
  neckCordGroup.position.set(0, 0.048, 0.003);
  const cordPts = [];
  const cordSegs = 20;
  for (let i = 0; i < cordSegs; i++) {
    const a = (i / cordSegs) * Math.PI * 2;
    const rx = 0.0252;
    const rz = 0.0260;
    const dip = Math.max(0, Math.cos(a)) * -0.0055; // Dips slightly at chest front (+z)
    cordPts.push(new THREE.Vector3(Math.sin(a) * rx, dip, Math.cos(a) * rz));
  }
  const cordCurve = new THREE.CatmullRomCurve3(cordPts, true);
  const cordGeom = makeTaperedTube(THREE, cordCurve, 36, 10, () => 0.0021, {
    capStart: false,
    capEnd: false
  });
  const cordMesh = new THREE.Mesh(cordGeom, cordMat);
  cordMesh.userData.slot = 'accent';
  neckCordGroup.add(cordMesh);

  // Two cute short silk ribbon tails dangling slightly off-center
  for (const s of [-1, 1]) {
    const tieCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.001, -0.006, 0.0265),
      new THREE.Vector3(s * 0.0045, -0.013, 0.0285),
      new THREE.Vector3(s * 0.0075, -0.019, 0.0295)
    ]);
    const tieMesh = new THREE.Mesh(
      makeTaperedTube(THREE, tieCurve, 10, 8, (u) => lerp(0.0016, 0.0011, u)),
      cordMat
    );
    tieMesh.userData.slot = 'accent';
    neckCordGroup.add(tieMesh);
  }

  const charmMesh = new THREE.Mesh(buildCrescentCharmGeometry(THREE), jadeGlowMat);
  charmMesh.position.set(0.0, -0.0115, 0.0285);
  charmMesh.rotation.z = -0.35;
  charmMesh.userData.slot = 'glow';
  neckCordGroup.add(charmMesh);
  body.add(neckCordGroup);

  // --- Head (continuous sculpted cranium + plush cheeks + muzzle) ---
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 0.054, 0.004);
  // Gentle curious tilt for three-quarter charm
  head.rotation.set(0.08, -0.06, 0.09);
  head.userData.baseRot = head.rotation.clone();

  const headMesh = new THREE.Mesh(buildHeadGeometry(THREE, kit), furHeadMat);
  headMesh.userData.slot = 'fur';
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  head.add(headMesh);
  body.add(head);

  // --- Three-Layer Eyes snugly inset on the sculpted sockets ---
  const eyeFrameL = getHeadFrame(THREE, 0.51, 0.02, 0.86, kit);
  const eyeL = buildEyeAssembly(THREE, 'eyeL', 1, irisTex, palette.eye, darkEyeMat, highlightMat, mouthLashMat);
  eyeL.position.copy(eyeFrameL.pos).addScaledVector(eyeFrameL.normal, -0.0016);
  const eyeLookL = eyeFrameL.normal.clone().lerp(new THREE.Vector3(0.22, 0.0, 1.0).normalize(), 0.25).normalize();
  eyeL.lookAt(eyeL.position.clone().add(eyeLookL));
  head.add(eyeL);

  const eyeFrameR = getHeadFrame(THREE, -0.51, 0.02, 0.86, kit);
  const eyeR = buildEyeAssembly(THREE, 'eyeR', -1, irisTex, palette.eye, darkEyeMat, highlightMat, mouthLashMat);
  eyeR.position.copy(eyeFrameR.pos).addScaledVector(eyeFrameR.normal, -0.0016);
  const eyeLookR = eyeFrameR.normal.clone().lerp(new THREE.Vector3(-0.22, 0.0, 1.0).normalize(), 0.25).normalize();
  eyeR.lookAt(eyeR.position.clone().add(eyeLookR));
  head.add(eyeR);

  // --- Sculpted Bunny Nose ---
  const noseFrame = getHeadFrame(THREE, 0, -0.15, 0.988, kit);
  const noseGeom = new THREE.SphereGeometry(0.0044, 24, 18);
  const npos = noseGeom.attributes.position;
  for (let i = 0; i < npos.count; i++) {
    let x = npos.getX(i);
    let y = npos.getY(i);
    let z = npos.getZ(i);
    // Soft rounded inverted heart/triangle bunny nose
    const ny = y / 0.0044;
    x *= 1.18 + ny * 0.25;
    y *= 0.82;
    z *= 0.62;
    if (ny > 0.2) {
      y -= Math.exp(-(x * x) / 0.000004) * 0.0005;
    }
    npos.setXYZ(i, x, y, z);
  }
  npos.needsUpdate = true;
  noseGeom.computeVertexNormals();
  const noseMesh = new THREE.Mesh(noseGeom, noseMat);
  noseMesh.position.copy(noseFrame.pos).addScaledVector(noseFrame.normal, -0.0004);
  noseMesh.lookAt(noseMesh.position.clone().add(noseFrame.normal));
  noseMesh.userData.slot = 'skin';
  head.add(noseMesh);

  // --- Curved ':3' Rabbit Mouth Line from Thin Tapered Tubes ---
  for (const s of [-1, 1]) {
    const mPts = [
      getHeadFrame(THREE, 0.0, -0.22, 0.975, kit),
      getHeadFrame(THREE, s * 0.04, -0.31, 0.950, kit),
      getHeadFrame(THREE, s * 0.14, -0.35, 0.925, kit),
      getHeadFrame(THREE, s * 0.23, -0.30, 0.915, kit)
    ].map((f) => f.pos.clone().addScaledVector(f.normal, 0.00045));
    const mCurve = new THREE.CatmullRomCurve3(mPts);
    const mGeom = makeTaperedTube(THREE, mCurve, 14, 8, (u) => {
      return 0.00045 + Math.sin(u * Math.PI) * 0.00038;
    });
    const mMesh = new THREE.Mesh(mGeom, mouthLashMat);
    head.add(mMesh);
  }

  // --- Subtle Curved Blush Discs Hugging Cheeks ---
  const blushGeom = new THREE.PlaneGeometry(0.017, 0.0115, 8, 6);
  const bpos = blushGeom.attributes.position;
  for (let i = 0; i < bpos.count; i++) {
    const x = bpos.getX(i);
    const y = bpos.getY(i);
    bpos.setZ(i, -(x * x * 10 + y * y * 10));
  }
  bpos.needsUpdate = true;
  blushGeom.computeVertexNormals();

  for (const s of [-1, 1]) {
    const bf = getHeadFrame(THREE, s * 0.68, -0.22, 0.70, kit);
    const blush = new THREE.Mesh(blushGeom, blushMat);
    blush.position.copy(bf.pos).addScaledVector(bf.normal, 0.0007);
    blush.lookAt(blush.position.clone().add(bf.normal));
    blush.userData.slot = 'skin';
    head.add(blush);
  }

  // --- Delicate Tapered Whiskers ---
  for (const s of [-1, 1]) {
    const offsets = [
      { dy: -0.23, pitch: 0.003, len: 0.028 },
      { dy: -0.29, pitch: -0.001, len: 0.031 },
      { dy: -0.35, pitch: -0.005, len: 0.025 }
    ];
    for (const w of offsets) {
      const wf = getHeadFrame(THREE, s * 0.38, w.dy, 0.88, kit);
      const p0 = wf.pos.clone().addScaledVector(wf.normal, -0.002);
      const p1 = wf.pos.clone().add(new THREE.Vector3(s * w.len * 0.52, w.pitch * 0.45, 0.004));
      const p2 = wf.pos.clone().add(new THREE.Vector3(s * w.len, w.pitch, -0.003));
      const wCurve = new THREE.CatmullRomCurve3([p0, p1, p2]);
      const wMesh = new THREE.Mesh(
        makeTaperedTube(THREE, wCurve, 12, 6, (u) => lerp(0.00055, 0.00014, u)),
        whiskerMat
      );
      wMesh.userData.slot = 'fur';
      head.add(wMesh);
    }
  }

  // --- Long Upright Curved Ears (ExtrudeGeometry + Bevel + Subdivided Concave Bend) ---
  const earL = new THREE.Group();
  earL.name = 'earL';
  earL.position.set(0.016, 0.061, -0.006);
  earL.rotation.set(-0.08, 0.14, -0.18);
  earL.userData.baseRot = earL.rotation.clone();
  const earLMesh = new THREE.Mesh(
    buildEarGeometry(THREE, {
      length: 0.112,
      width: 0.0148,
      backBend: 0.014,
      sideBend: 0.010,
      tipCurl: 0.55 // Subtle asymmetric curl on left ear tip
    }),
    furEarMat
  );
  earLMesh.userData.slot = 'fur';
  earLMesh.castShadow = true;
  earLMesh.receiveShadow = true;
  earL.add(earLMesh);
  head.add(earL);

  const earR = new THREE.Group();
  earR.name = 'earR';
  earR.position.set(-0.015, 0.062, -0.006);
  earR.rotation.set(-0.05, -0.12, 0.11);
  earR.userData.baseRot = earR.rotation.clone();
  const earRMesh = new THREE.Mesh(
    buildEarGeometry(THREE, {
      length: 0.115,
      width: 0.0145,
      backBend: 0.012,
      sideBend: -0.005,
      tipCurl: 0.08
    }),
    furEarMat
  );
  earRMesh.userData.slot = 'fur';
  earRMesh.castShadow = true;
  earRMesh.receiveShadow = true;
  earR.add(earRMesh);
  head.add(earR);

  // --- Wooden Pestle (LatheGeometry) poised over the stone mortar ---
  const pestleStart = new THREE.Vector3(0.002, -0.025, 0.086);
  const pestleEnd = new THREE.Vector3(-0.006, 0.067, 0.052);
  const pestleDir = new THREE.Vector3().subVectors(pestleEnd, pestleStart);
  const pestleLen = pestleDir.length();

  const pestleGroup = new THREE.Group();
  pestleGroup.name = 'pestleGroup';
  pestleGroup.position.copy(pestleStart);
  pestleGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pestleDir.clone().normalize());
  pestleGroup.userData.basePos = pestleGroup.position.clone();
  pestleGroup.userData.baseRot = pestleGroup.rotation.clone();

  const pestleMesh = new THREE.Mesh(buildPestleGeometry(THREE, pestleLen), woodMat);
  pestleMesh.userData.slot = 'primary';
  pestleMesh.castShadow = true;
  pestleMesh.receiveShadow = true;
  pestleGroup.add(pestleMesh);
  body.add(pestleGroup);

  // --- Tapered-Tube Arms Wrapping the Pestle ---
  const gripLWorld = pestleStart.clone().addScaledVector(pestleDir, 0.64).add(new THREE.Vector3(0.0078, 0.0, -0.0028));
  const gripRWorld = pestleStart.clone().addScaledVector(pestleDir, 0.44).add(new THREE.Vector3(-0.0078, 0.0, -0.0028));

  const armL = new THREE.Group();
  armL.name = 'armL';
  armL.position.set(0.029, 0.031, 0.010);
  armL.userData.baseRot = armL.rotation.clone();
  const targetL = gripLWorld.clone().sub(armL.position);
  const armLMesh = new THREE.Mesh(
    buildArmGeometry(THREE, 1, new THREE.Vector3(0.005, -0.011, 0.025), targetL),
    furBodyMat
  );
  armLMesh.userData.slot = 'fur';
  armLMesh.castShadow = true;
  armLMesh.receiveShadow = true;
  armL.add(armLMesh);
  body.add(armL);

  const armR = new THREE.Group();
  armR.name = 'armR';
  armR.position.set(-0.029, 0.029, 0.010);
  armR.userData.baseRot = armR.rotation.clone();
  const targetR = gripRWorld.clone().sub(armR.position);
  const armRMesh = new THREE.Mesh(
    buildArmGeometry(THREE, -1, new THREE.Vector3(-0.005, -0.016, 0.027), targetR),
    furBodyMat
  );
  armRMesh.userData.slot = 'fur';
  armRMesh.castShadow = true;
  armRMesh.receiveShadow = true;
  armR.add(armRMesh);
  body.add(armR);

  // --- Carved Stone Mortar (LatheGeometry resting squarely on y = 0) ---
  const mortarGroup = new THREE.Group();
  mortarGroup.name = 'mortarGroup';
  mortarGroup.position.set(0, 0, 0.062);

  const mortarMesh = new THREE.Mesh(buildMortarGeometry(THREE), stoneMat);
  mortarMesh.userData.slot = 'secondary';
  mortarMesh.castShadow = true;
  mortarMesh.receiveShadow = true;
  mortarGroup.add(mortarMesh);

  // Glowing Moon Mochi Cushion Nestled Inside Mortar
  const mochiMesh = new THREE.Mesh(buildMochiGeometry(THREE, kit), mochiMat);
  mochiMesh.name = 'mochi';
  mochiMesh.position.set(0, 0.038, 0);
  mochiMesh.userData.slot = 'glow';
  mochiMesh.receiveShadow = true;
  mortarGroup.add(mochiMesh);

  // Delicate Floating Jade Moon-Motes Rising Softly from Mortar
  const motes = new THREE.Group();
  motes.name = 'motes';
  const moteGeom = new THREE.OctahedronGeometry(0.0028, 2);
  moteGeom.scale(0.85, 1.25, 0.85);
  const moteConfigs = [
    { angle: 0.4, r: 0.022, y: 0.072, s: 1.0, phase: 0.0 },
    { angle: 2.3, r: 0.028, y: 0.088, s: 0.78, phase: 1.7 },
    { angle: 4.1, r: 0.019, y: 0.104, s: 0.65, phase: 3.1 },
    { angle: 5.4, r: 0.026, y: 0.079, s: 0.85, phase: 4.6 }
  ];
  for (let i = 0; i < moteConfigs.length; i++) {
    const cfg = moteConfigs[i];
    const m = new THREE.Mesh(moteGeom, jadeGlowMat);
    m.userData.slot = 'glow';
    m.userData.mote = cfg;
    m.position.set(Math.cos(cfg.angle) * cfg.r, cfg.y, Math.sin(cfg.angle) * cfg.r);
    m.scale.setScalar(cfg.s);
    motes.add(m);
  }
  mortarGroup.add(motes);
  root.add(mortarGroup);

  return root;
}

export function idle(group, t) {
  const body = group.getObjectByName('body');
  const head = group.getObjectByName('head');
  const earL = group.getObjectByName('earL');
  const earR = group.getObjectByName('earR');
  const armL = group.getObjectByName('armL');
  const armR = group.getObjectByName('armR');
  const tail = group.getObjectByName('tail');
  const eyeL = group.getObjectByName('eyeL');
  const eyeR = group.getObjectByName('eyeR');
  const pestleGroup = group.getObjectByName('pestleGroup');
  const mochi = group.getObjectByName('mochi');
  const motes = group.getObjectByName('motes');

  // Calm breathing + gentle unhurried mochi-pounding cadence
  const breath = Math.sin(t * 2.0);
  const pound = Math.sin(t * 2.4 - 0.35);
  const poundEase = pound * 0.65 + Math.sin(t * 4.8 - 0.7) * 0.15;

  if (body) {
    body.scale.set(
      1 - breath * 0.008,
      1 + breath * 0.014,
      1 + breath * 0.010
    );
    if (body.userData.baseRot) {
      body.rotation.x = body.userData.baseRot.x + poundEase * 0.018;
      body.rotation.y = body.userData.baseRot.y + Math.sin(t * 0.85) * 0.022;
    }
  }

  if (armL && armL.userData.baseRot) {
    armL.rotation.x = armL.userData.baseRot.x - poundEase * 0.055;
  }
  if (armR && armR.userData.baseRot) {
    armR.rotation.x = armR.userData.baseRot.x - poundEase * 0.050;
  }
  if (pestleGroup && pestleGroup.userData.basePos) {
    pestleGroup.position.y = pestleGroup.userData.basePos.y + poundEase * 0.0032;
    pestleGroup.position.z = pestleGroup.userData.basePos.z + poundEase * 0.0008;
  }
  if (mochi) {
    const press = Math.max(0, -poundEase);
    mochi.scale.set(1 + press * 0.04, 1 - press * 0.07, 1 + press * 0.04);
  }

  if (head && head.userData.baseRot) {
    head.rotation.x = head.userData.baseRot.x + Math.sin(t * 1.45 + 0.4) * 0.032 - poundEase * 0.022;
    head.rotation.y = head.userData.baseRot.y + Math.sin(t * 0.72) * 0.055;
    head.rotation.z = head.userData.baseRot.z + Math.sin(t * 0.95 + 1.1) * 0.042;
  }

  // Gentle lagged ear sway + occasional delicate ear twitch
  const twitchCycle = t % 6.2;
  const twitch = twitchCycle < 0.24 ? Math.sin((twitchCycle / 0.24) * Math.PI * 2) * 0.075 : 0;

  if (earL && earL.userData.baseRot) {
    earL.rotation.z = earL.userData.baseRot.z + Math.sin(t * 1.8 - 0.5) * 0.045 - twitch;
    earL.rotation.x = earL.userData.baseRot.x + Math.sin(t * 1.35 - 0.3) * 0.035;
  }
  if (earR && earR.userData.baseRot) {
    earR.rotation.z = earR.userData.baseRot.z + Math.sin(t * 1.8 - 0.2) * 0.035 + twitch * 0.35;
    earR.rotation.x = earR.userData.baseRot.x + Math.sin(t * 1.35 + 0.1) * 0.030;
  }

  if (tail && tail.userData.baseRot) {
    tail.rotation.y = tail.userData.baseRot.y + Math.sin(t * 2.8) * 0.09;
    tail.rotation.x = tail.userData.baseRot.x + Math.sin(t * 2.0 + 0.6) * 0.05;
  }

  // Natural eye blink every ~3.9 seconds (scaling eye groups on y)
  const blinkPeriod = 3.9;
  const bt = t % blinkPeriod;
  let eyeScaleY = 1.0;
  if (bt > 3.72) {
    const p = (bt - 3.72) / 0.18;
    eyeScaleY = 1.0 - 0.92 * Math.sin(p * Math.PI);
  }
  if (eyeL) eyeL.scale.y = eyeScaleY;
  if (eyeR) eyeR.scale.y = eyeScaleY;

  // Floating jade moon-motes gently rising and shimmering over the mortar
  if (motes) {
    for (let i = 0; i < motes.children.length; i++) {
      const m = motes.children[i];
      const cfg = m.userData.mote;
      if (!cfg) continue;
      const a = cfg.angle + t * 0.48;
      const bob = Math.sin(t * 1.6 + cfg.phase) * 0.008;
      m.position.set(Math.cos(a) * cfg.r, cfg.y + bob, Math.sin(a) * cfg.r);
      const pulse = 0.82 + 0.26 * Math.sin(t * 2.6 + cfg.phase);
      m.scale.setScalar(cfg.s * pulse);
      m.rotation.y = t * 0.9 + cfg.phase;
    }
  }
}
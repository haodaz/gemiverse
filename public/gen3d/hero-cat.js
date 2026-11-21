export const META = {
  id: "cozy_cat",
  name: "Cozy Sitting Cat",
  kind: "creature",
  footprint: [0.28, 0.38],
  variants: ["Solid Coat", "Tabby Stripes", "Tuxedo Patches"],
  note: "Stylised sitting cat (~0.38 m long) with continuously sculpted forms, curled tail, tilted head, gently raised paw, layered glossy eyes, procedural fur textures, and optional collar bell or bow."
};

// ---------------------------------------------------------------------------
// Math & Colour Helpers
// ---------------------------------------------------------------------------

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function gauss(x, mu, sigma) {
  const d = (x - mu) / sigma;
  return Math.exp(-d * d);
}

function colorToRgba(c, a = 1) {
  const r = Math.round(clamp(c.r, 0, 1) * 255);
  const g = Math.round(clamp(c.g, 0, 1) * 255);
  const b = Math.round(clamp(c.b, 0, 1) * 255);
  return `rgba(${r},${g},${b},${a})`;
}

function mixColors(THREE, c1, c2, t) {
  return c1.clone().lerp(c2, clamp(t, 0, 1));
}

function shiftColor(THREE, base, dh, ds, dl) {
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  const out = new THREE.Color();
  out.setHSL(
    (hsl.h + dh + 1) % 1,
    clamp(hsl.s + ds, 0, 1),
    clamp(hsl.l + dl, 0, 1)
  );
  return out;
}

function fbm(kit, x, y, octaves = 3) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * kit.noise(x * freq, y * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return sum / norm;
}

// ---------------------------------------------------------------------------
// Tapered Tube Helper (Parallel-Transport Framed, Ring-by-Ring, Watertight)
// ---------------------------------------------------------------------------

function buildTaperedTube(THREE, curve, tubularSegments, radialSegments, radiusFn, opts = {}) {
  const capStart = opts.capStart !== false;
  const capEnd = opts.capEnd !== false;
  const closed = !!opts.closed;
  const capRings = 5;

  const sampleTs = [];
  const sampleTypes = []; // 0 = body, -1 = start cap, 1 = end cap

  if (!closed && capStart) {
    for (let k = capRings; k >= 1; k--) {
      sampleTs.push(0);
      sampleTypes.push(-k / capRings);
    }
  }
  for (let i = 0; i <= tubularSegments; i++) {
    sampleTs.push(i / tubularSegments);
    sampleTypes.push(0);
  }
  if (!closed && capEnd) {
    for (let k = 1; k <= capRings; k++) {
      sampleTs.push(1);
      sampleTypes.push(k / capRings);
    }
  }

  // Parallel transport frames along the core curve
  const coreN = tubularSegments + 1;
  const pts = [];
  const tangents = [];
  const normals = [];
  const binormals = [];

  for (let i = 0; i < coreN; i++) {
    const t = i / tubularSegments;
    pts.push(curve.getPoint(t));
    tangents.push(curve.getTangent(t).normalize());
  }

  // Initial normal perpendicular to tangents[0]
  const ref = Math.abs(tangents[0].y) < 0.9
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(1, 0, 0);
  const n0 = new THREE.Vector3().crossVectors(ref, tangents[0]).normalize();
  const b0 = new THREE.Vector3().crossVectors(tangents[0], n0).normalize();
  normals.push(n0);
  binormals.push(b0);

  const axis = new THREE.Vector3();
  const q = new THREE.Quaternion();
  for (let i = 1; i < coreN; i++) {
    const prevT = tangents[i - 1];
    const currT = tangents[i];
    const prevN = normals[i - 1].clone();
    axis.crossVectors(prevT, currT);
    const len = axis.length();
    if (len > 1e-6) {
      axis.divideScalar(len);
      const angle = Math.acos(clamp(prevT.dot(currT), -1, 1));
      q.setFromAxisAngle(axis, angle);
      prevN.applyQuaternion(q);
    }
    prevN.addScaledVector(currT, -prevN.dot(currT)).normalize();
    const currB = new THREE.Vector3().crossVectors(currT, prevN).normalize();
    normals.push(prevN);
    binormals.push(currB);
  }

  // If closed loop, remove accumulated twist seamlessly
  if (closed) {
    const lastN = normals[coreN - 1];
    const twistDot = clamp(lastN.dot(normals[0]), -1, 1);
    const cross = new THREE.Vector3().crossVectors(lastN, normals[0]);
    const sign = cross.dot(tangents[0]) >= 0 ? 1 : -1;
    const twist = sign * Math.acos(twistDot);
    for (let i = 0; i < coreN; i++) {
      const a = (i / tubularSegments) * twist;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const ni = normals[i].clone().multiplyScalar(c).addScaledVector(binormals[i], s);
      const bi = new THREE.Vector3().crossVectors(tangents[i], ni).normalize();
      normals[i] = ni;
      binormals[i] = bi;
    }
  }

  const positions = [];
  const uvs = [];
  const indices = [];

  const ringCount = sampleTs.length;
  const cols = radialSegments + 1;
  const tmpP = new THREE.Vector3();

  for (let r = 0; r < ringCount; r++) {
    const t = sampleTs[r];
    const cap = sampleTypes[r];
    const idx = clamp(Math.round(t * tubularSegments), 0, tubularSegments);
    const center = pts[idx];
    const T = tangents[idx];
    const N = normals[idx];
    const B = binormals[idx];

    const capAngle = Math.abs(cap) * (Math.PI * 0.5);
    const radialScale = cap === 0 ? 1.0 : Math.cos(capAngle);
    const axialSign = cap < 0 ? -1 : cap > 0 ? 1 : 0;
    const axialFrac = Math.sin(capAngle);

    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const theta = u * Math.PI * 2;
      const spec = radiusFn(t, theta, center, N, B, T);
      const isObj = typeof spec === "object";
      const rx = (isObj ? spec.rx : spec) * radialScale;
      const ry = (isObj ? spec.ry : spec) * radialScale;
      const avgR = isObj ? (spec.rx + spec.ry) * 0.5 : spec;
      const capDepth = (isObj && spec.capLen !== undefined ? spec.capLen : avgR * 0.85);
      const offN = isObj && spec.offN ? spec.offN : 0;
      const offB = isObj && spec.offB ? spec.offB : 0;

      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      tmpP.copy(center)
        .addScaledVector(N, cosT * rx + offN)
        .addScaledVector(B, sinT * ry + offB)
        .addScaledVector(T, axialSign * axialFrac * capDepth);

      if (opts.floorClamp !== undefined && tmpP.y < opts.floorClamp) {
        tmpP.y = opts.floorClamp;
      }

      positions.push(tmpP.x, tmpP.y, tmpP.z);
      uvs.push(u, t);
    }
  }

  for (let r = 0; r < ringCount - 1; r++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = r * cols + j;
      const b = r * cols + j + 1;
      const c = (r + 1) * cols + j;
      const d = (r + 1) * cols + j + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Sculpting Equations (Continuous Surfaces)
// ---------------------------------------------------------------------------

function sampleHeadSurface(vx, vy, vz, out) {
  // Unit sphere coords (vx, vy, vz) -> sculpted stylised feline head
  // Head origin sits at the neck pivot; skull center is at (0, 0.036, 0.010).
  const topTaper = 1.0 - 0.13 * smoothstep(0.32, 1.0, vy);
  const bottomTaper = 1.0 - 0.10 * smoothstep(-0.55, -1.0, vy);

  let x = vx * 0.080 * topTaper * bottomTaper;
  let y = vy * 0.068;
  let z = vz * 0.074 * topTaper;

  // Slightly flatter back-of-head crown, fuller brow
  z += 0.005 * gauss(vy, 0.18, 0.35) * smoothstep(0.2, 0.9, vz);

  // Chubby plush cheeks below eye level
  const cheek = gauss(vy, -0.22, 0.30)
    * smoothstep(0.28, 0.90, Math.abs(vx))
    * smoothstep(-0.45, 0.55, vz);
  x += Math.sign(vx) * 0.0155 * cheek;
  y -= 0.004 * cheek;
  z += 0.0045 * cheek;

  // Sculpted cheek fur fluff tufts (silhouette charm on both cheeks)
  const tuft1 = gauss(vy, -0.15, 0.10) * gauss(vz, 0.06, 0.28) * smoothstep(0.72, 0.98, Math.abs(vx));
  const tuft2 = gauss(vy, -0.34, 0.10) * gauss(vz, 0.12, 0.28) * smoothstep(0.68, 0.95, Math.abs(vx));
  x += Math.sign(vx) * (0.0065 * tuft1 + 0.0048 * tuft2);
  y -= 0.002 * tuft2;

  // Gentle nose bridge emerging from forehead
  const bridge = gauss(vx, 0, 0.17) * gauss(vy, -0.02, 0.20) * smoothstep(0.65, 0.96, vz);
  z += 0.0095 * bridge;

  // Plump twin whisker-pad pillows (muzzle)
  const frontMask = smoothstep(0.55, 0.92, vz);
  const padL = gauss(vx, 0.19, 0.18) * gauss(vy, -0.24, 0.15) * frontMask;
  const padR = gauss(vx, -0.19, 0.18) * gauss(vy, -0.24, 0.15) * frontMask;
  const pads = padL + padR;
  z += 0.0165 * pads;
  y -= 0.003 * pads;
  x += Math.sign(vx) * 0.0028 * pads;

  // Subtle philtrum groove between whisker pads
  const philtrum = gauss(vx, 0, 0.055) * gauss(vy, -0.25, 0.12) * smoothstep(0.75, 0.97, vz);
  z -= 0.0035 * philtrum;

  // Soft chin cushion
  const chin = gauss(vx, 0, 0.22) * gauss(vy, -0.46, 0.15) * smoothstep(0.42, 0.85, vz);
  z += 0.010 * chin;
  y -= 0.0035 * chin;

  // Gently recessed eye sockets so multi-layer eyes nestle snugly
  const sockMask = smoothstep(0.52, 0.88, vz);
  const sockL = gauss(vx, 0.40, 0.19) * gauss(vy, 0.04, 0.19) * sockMask;
  const sockR = gauss(vx, -0.40, 0.19) * gauss(vy, 0.04, 0.19) * sockMask;
  const sock = sockL + sockR;
  z -= 0.0072 * sock;
  x -= Math.sign(vx) * 0.0020 * sock;

  // Subtle soft brow ridge above eyes for friendly expression
  const brow = (gauss(vx, 0.36, 0.20) + gauss(vx, -0.36, 0.20))
    * gauss(vy, 0.27, 0.12) * smoothstep(0.55, 0.90, vz);
  z += 0.0035 * brow;

  // Neck underside extension so head blends deeply into body shoulders
  const neckPlug = smoothstep(-0.62, -0.98, vy);
  y -= 0.014 * neckPlug;
  x *= 1.0 - 0.18 * neckPlug;
  z *= 1.0 - 0.14 * neckPlug;
  z -= 0.006 * neckPlug;

  out.set(x, y + 0.042, z + 0.008);
  return out;
}

function sampleHeadNormal(THREE, vx, vy, vz) {
  const len = Math.hypot(vx, vy, vz) || 1;
  const nx = vx / len;
  const ny = vy / len;
  const nz = vz / len;
  const eps = 0.012;

  const ref = Math.abs(ny) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const dir = new THREE.Vector3(nx, ny, nz);
  const t1 = new THREE.Vector3().crossVectors(ref, dir).normalize();
  const t2 = new THREE.Vector3().crossVectors(dir, t1).normalize();

  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  const q1 = new THREE.Vector3();
  const q2 = new THREE.Vector3();

  const u1 = dir.clone().addScaledVector(t1, eps).normalize();
  const u2 = dir.clone().addScaledVector(t1, -eps).normalize();
  const v1 = dir.clone().addScaledVector(t2, eps).normalize();
  const v2 = dir.clone().addScaledVector(t2, -eps).normalize();

  sampleHeadSurface(u1.x, u1.y, u1.z, p1);
  sampleHeadSurface(u2.x, u2.y, u2.z, p2);
  sampleHeadSurface(v1.x, v1.y, v1.z, q1);
  sampleHeadSurface(v2.x, v2.y, v2.z, q2);

  const d1 = p1.sub(p2);
  const d2 = q1.sub(q2);
  const n = new THREE.Vector3().crossVectors(d2, d1).normalize();
  if (n.dot(dir) < 0) n.negate();
  return n;
}

function buildHeadGeo(THREE) {
  const geo = new THREE.SphereGeometry(1, 64, 48);
  // Rotate so UV seam u=0/1 sits cleanly at the back (-Z) and front (+Z) is u=0.5
  geo.rotateY(-Math.PI / 2);
  const pos = geo.attributes.position;
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    sampleHeadSurface(pos.getX(i), pos.getY(i), pos.getZ(i), tmp);
    pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildBodyGeo(THREE) {
  const geo = new THREE.SphereGeometry(1, 56, 40);
  geo.rotateY(-Math.PI / 2);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);

    const t = (vy + 1) * 0.5; // 0 = bottom, 1 = top

    // Pear-shaped sitting silhouette: plump lower haunches tapering to shoulders & neck
    const baseRx = 0.084 * (
      1.0
      + 0.24 * gauss(t, 0.26, 0.24)
      - 0.42 * smoothstep(0.42, 0.96, t)
    );
    const baseRz = 0.095 * (
      1.0
      + 0.24 * gauss(t, 0.25, 0.24)
      - 0.42 * smoothstep(0.45, 0.96, t)
    );

    let x = vx * baseRx;
    let z = vz * baseRz;
    let y = t * 0.218;

    // Sitting spine curve: rump back, chest & neck gently forward
    const zShift = -0.026 * (1 - t) + 0.036 * smoothstep(0.22, 0.92, t);
    z += zShift;

    // Folded sitting haunches integrated seamlessly into the torso sides/back
    const haunch = gauss(t, 0.24, 0.18)
      * smoothstep(0.24, 0.85, Math.abs(vx))
      * smoothstep(0.55, -0.25, vz);
    x += Math.sign(vx) * 0.019 * haunch;
    z -= 0.008 * haunch;
    y -= 0.005 * haunch;

    // Cozy puffed chest in front
    const chest = gauss(t, 0.65, 0.18) * smoothstep(0.18, 0.90, vz);
    z += 0.017 * chest;
    x *= 1.0 + 0.08 * chest;

    // Gentle hunched feline back curve
    const backCurve = gauss(t, 0.46, 0.24) * smoothstep(-0.15, -0.88, vz);
    z -= 0.013 * backCurve;

    // Soft shoulder swells where front legs emerge
    const shoulder = gauss(t, 0.68, 0.14)
      * gauss(Math.abs(vx), 0.62, 0.30)
      * smoothstep(-0.1, 0.65, vz);
    x += Math.sign(vx) * 0.007 * shoulder;
    z += 0.005 * shoulder;

    // Smooth neck core rising slightly to nest deeply into head
    const neck = smoothstep(0.76, 1.0, t);
    y += 0.008 * neck;

    // Gravity-weighted flattened underside resting stably on y = 0
    const cushion = 0.026;
    if (y < cushion) {
      const f = clamp(y / cushion, 0, 1);
      y = cushion * Math.pow(f, 1.75);
      const splay = 1.0 + 0.045 * (1 - f);
      x *= splay;
      z = (z - zShift) * splay + zShift;
    }
    if (y < 0.0004) y = 0.0004;

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function buildCurvedEarGeo(THREE, isInner = false) {
  const shape = new THREE.Shape();
  if (!isInner) {
    // Plush slightly asymmetric rounded cat ear
    shape.moveTo(-0.027, 0.0);
    shape.bezierCurveTo(-0.030, 0.022, -0.017, 0.056, -0.002, 0.065);
    shape.bezierCurveTo(0.004, 0.068, 0.010, 0.064, 0.015, 0.053);
    shape.bezierCurveTo(0.026, 0.032, 0.031, 0.014, 0.026, 0.0);
    shape.bezierCurveTo(0.010, -0.008, -0.010, -0.008, -0.027, 0.0);
  } else {
    // Nested soft inner ear pad
    shape.moveTo(-0.018, 0.004);
    shape.bezierCurveTo(-0.019, 0.020, -0.010, 0.044, -0.001, 0.051);
    shape.bezierCurveTo(0.004, 0.053, 0.008, 0.049, 0.011, 0.041);
    shape.bezierCurveTo(0.018, 0.025, 0.020, 0.012, 0.017, 0.004);
    shape.bezierCurveTo(0.006, 0.000, -0.006, 0.000, -0.018, 0.004);
  }

  const extrudeSettings = isInner
    ? {
        depth: 0.0025,
        bevelEnabled: true,
        bevelThickness: 0.0022,
        bevelSize: 0.0020,
        bevelSegments: 4,
        curveSegments: 20
      }
    : {
        depth: 0.0075,
        bevelEnabled: true,
        bevelThickness: 0.0060,
        bevelSize: 0.0048,
        bevelSegments: 5,
        curveSegments: 22
      };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  // Center thickness around z = 0
  geo.translate(0, 0, -extrudeSettings.depth * 0.5);

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const h = clamp(y / 0.066, 0, 1);
    const xn = x / 0.030;

    // Taper thickness smoothly toward the ear tip
    z *= 1.0 - 0.58 * Math.pow(h, 1.3);

    // Cup the ear forward so the front face forms a cozy concave scoop
    const cup = 0.0125 * (xn * xn) * (1.0 - 0.35 * h);
    z += cup;

    // Slight soft curl forward at the tip and curve base backward to hug skull
    z += 0.0055 * Math.pow(h, 2.2) - 0.0075 * Math.pow(1 - h, 2.5);

    // Gently flare base downward at edges to merge cleanly into skull curvature
    y -= 0.0055 * (xn * xn) * (1 - h);

    if (isInner) {
      // Push inner pad forward into the concave front hollow of the outer ear
      z += 0.0046 * (1 - 0.35 * h);
    }

    pos.setXYZ(i, x, y, z);
    // Clean planar UVs mapped to [0, 1]
    uv.setXY(i, clamp(0.5 + x / 0.068, 0, 1), clamp(1.0 - (y + 0.010) / 0.082, 0, 1));
  }

  geo.computeVertexNormals();
  return geo;
}

function buildEarFluffGeo(THREE) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.008, 0.0);
  shape.bezierCurveTo(-0.005, 0.012, 0.004, 0.020, 0.015, 0.022);
  shape.bezierCurveTo(0.010, 0.013, 0.006, 0.006, 0.012, 0.004);
  shape.bezierCurveTo(0.004, -0.002, -0.003, -0.003, -0.008, 0.0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0018,
    bevelEnabled: true,
    bevelThickness: 0.0014,
    bevelSize: 0.0012,
    bevelSegments: 3,
    curveSegments: 14
  });
  geo.translate(0, 0, -0.0009);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    pos.setXYZ(i, x, y, z + 0.004 * Math.sin(clamp(x / 0.015, 0, 1) * Math.PI));
  }
  geo.computeVertexNormals();
  return geo;
}

function buildNoseGeo(THREE) {
  const geo = new THREE.SphereGeometry(1, 24, 18);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);

    // Cute rounded inverted-triangle feline nose
    const widthTaper = 1.0 + 0.34 * smoothstep(-0.6, 0.5, vy) - 0.42 * smoothstep(-0.1, -1.0, vy);
    let x = vx * 0.0092 * widthTaper;
    let y = vy * 0.0062;
    let z = vz * 0.0058;

    // Subtle dip at top center of nose
    y -= 0.0010 * gauss(vx, 0, 0.25) * smoothstep(0.3, 1.0, vy);

    // Subtle nostril dimples on lower sides
    const nostril = (gauss(vx, 0.42, 0.18) + gauss(vx, -0.42, 0.18))
      * gauss(vy, -0.25, 0.24) * smoothstep(0.2, 0.9, vz);
    z -= 0.0012 * nostril;

    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Rotational Geometries (LatheGeometry >= 16 points)
// ---------------------------------------------------------------------------

function buildEyeLensGeo(THREE, radius, depth, segments = 32) {
  // 20-point smooth oblate dome profile facing +Z
  const pts = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI * 0.5);
    const r = Math.cos(a) * radius;
    const y = Math.sin(a) * depth;
    pts.push(new THREE.Vector2(Math.max(0.00001, r), y));
  }
  const geo = new THREE.LatheGeometry(pts, segments);
  geo.rotateX(Math.PI / 2);

  // Remap UVs to clean frontal planar projection for the iris texture
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const u = 0.5 + pos.getX(i) / (radius * 2.02);
    const v = 0.5 + pos.getY(i) / (radius * 2.02);
    uv.setXY(i, clamp(u, 0, 1), clamp(v, 0, 1));
  }
  geo.computeVertexNormals();
  return geo;
}

function buildBellGeo(THREE) {
  // 24-point classic rounded collar jingle bell profile (hanging from y = 0 down to y = -0.025)
  const raw = [
    [0.0005, -0.0242],
    [0.0038, -0.0240],
    [0.0074, -0.0226],
    [0.0102, -0.0202],
    [0.0119, -0.0172],
    [0.0124, -0.0145],
    [0.0122, -0.0132],
    [0.0131, -0.0125], // Raised equatorial decorative bead ring
    [0.0134, -0.0118],
    [0.0131, -0.0111],
    [0.0122, -0.0104],
    [0.0123, -0.0088],
    [0.0116, -0.0062],
    [0.0100, -0.0036],
    [0.0076, -0.0014],
    [0.0046, 0.0001],
    [0.0026, 0.0008],
    [0.0028, 0.0020], // Upper bail collar
    [0.0034, 0.0032],
    [0.0028, 0.0044],
    [0.0016, 0.0052],
    [0.0004, 0.0054]
  ];
  const pts = raw.map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, 32);
  geo.computeVertexNormals();
  return geo;
}

function buildBowLoopGeo(THREE, mirror = 1) {
  const shape = new THREE.Shape();
  shape.moveTo(0.0, 0.004);
  shape.bezierCurveTo(0.010, 0.014, 0.028, 0.022, 0.036, 0.014);
  shape.bezierCurveTo(0.043, 0.006, 0.042, -0.010, 0.033, -0.016);
  shape.bezierCurveTo(0.022, -0.022, 0.008, -0.012, 0.0, -0.004);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0045,
    bevelEnabled: true,
    bevelThickness: 0.0035,
    bevelSize: 0.0025,
    bevelSegments: 4,
    curveSegments: 18
  });
  geo.translate(0, 0, -0.00225);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const t = clamp(x / 0.040, 0, 1);
    // Puff out middle of loop and curve gracefully backward around chest
    z *= 1.0 + 0.55 * Math.sin(t * Math.PI);
    z -= 0.015 * t * t;
    y += 0.003 * Math.sin(t * Math.PI);

    pos.setXYZ(i, x * mirror, y, z);
  }
  if (mirror < 0) {
    // Flip winding after X mirror
    const idx = geo.index;
    if (idx) {
      for (let i = 0; i < idx.count; i += 3) {
        const b = idx.getX(i + 1);
        const c = idx.getX(i + 2);
        idx.setX(i + 1, c);
        idx.setX(i + 2, b);
      }
    } else {
      for (let i = 0; i < pos.count; i += 3) {
        const x1 = pos.getX(i + 1), y1 = pos.getY(i + 1), z1 = pos.getZ(i + 1);
        const x2 = pos.getX(i + 2), y2 = pos.getY(i + 2), z2 = pos.getZ(i + 2);
        pos.setXYZ(i + 1, x2, y2, z2);
        pos.setXYZ(i + 2, x1, y1, z1);
      }
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function buildBowRibbonTailGeo(THREE, mirror = 1) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.003, 0.0);
  shape.bezierCurveTo(0.003, -0.010, 0.012, -0.025, 0.018, -0.042);
  shape.lineTo(0.009, -0.036); // Swallowtail notch
  shape.lineTo(0.004, -0.044);
  shape.bezierCurveTo(-0.002, -0.026, -0.005, -0.012, -0.003, 0.0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0018,
    bevelEnabled: true,
    bevelThickness: 0.0012,
    bevelSize: 0.0010,
    bevelSegments: 3,
    curveSegments: 14
  });
  geo.translate(0, 0, -0.0009);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);
    const d = clamp(-y / 0.044, 0, 1);
    // Drape naturally over the puffed chest
    z += 0.008 * Math.sin(d * Math.PI * 0.85) - 0.003 * d * d;
    pos.setXYZ(i, x * mirror, y, z);
  }
  if (mirror < 0) {
    for (let i = 0; i < pos.count; i += 3) {
      const x1 = pos.getX(i + 1), y1 = pos.getY(i + 1), z1 = pos.getZ(i + 1);
      const x2 = pos.getX(i + 2), y2 = pos.getY(i + 2), z2 = pos.getZ(i + 2);
      pos.setXYZ(i + 1, x2, y2, z2);
      pos.setXYZ(i + 2, x1, y1, z1);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Procedural Canvas Textures (Fur Coat Variants, Bump, Iris, Blush, Fabric)
// ---------------------------------------------------------------------------

function paintFurStrokes(ctx, w, h, kit, baseColor, darkColor, lightColor, count = 2400) {
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < count; i++) {
    const n1 = kit.noise(i * 0.37, 1.3);
    const n2 = kit.noise(4.7, i * 0.29);
    const x = ((i * 0.6180339887 + n1 * 0.17) % 1) * w;
    const y = ((i * 0.3819660113 + n2 * 0.21) % 1) * h;
    const tone = kit.noise(x * 0.03, y * 0.03);
    const len = (5 + 9 * kit.noise(x * 0.05 + 11, y * 0.05)) * (h / 512);
    const angle = Math.PI * 0.5 + (kit.noise(x * 0.02, y * 0.02) - 0.5) * 0.42;

    ctx.strokeStyle = tone > 0.52
      ? colorToRgba(lightColor, 0.14)
      : colorToRgba(darkColor, 0.13);
    ctx.lineWidth = (1.1 + 1.1 * tone) * (w / 512);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();
}

function makeFurBumpTexture(THREE, kit) {
  const tex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, w, h);

    // Subtle soft noise undercoat
    const step = 8;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const n = fbm(kit, x * 0.035, y * 0.035, 3);
        const v = Math.round(108 + n * 40);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, step, step);
      }
    }

    // Fine directional fur wisps
    ctx.lineCap = "round";
    for (let i = 0; i < 4200; i++) {
      const x = ((i * 0.75487766 + kit.noise(i * 0.19, 3.1) * 0.2) % 1) * w;
      const y = ((i * 0.56984029 + kit.noise(7.2, i * 0.13) * 0.2) % 1) * h;
      const bright = kit.noise(x * 0.07, y * 0.07) > 0.48;
      const len = 6 + 10 * kit.noise(x * 0.04, y * 0.04 + 5);
      const a = Math.PI * 0.5 + (kit.noise(x * 0.025, y * 0.025) - 0.5) * 0.35;
      ctx.strokeStyle = bright ? "rgba(218,218,218,0.22)" : "rgba(56,56,56,0.20)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeHeadCoatTexture(THREE, kit, furCol, accentCol, variant) {
  const darkCol = shiftColor(THREE, furCol, -0.015, 0.08, -0.22);
  const deepStripe = shiftColor(THREE, furCol, -0.02, 0.12, -0.34);
  const softLight = mixColors(THREE, furCol, accentCol, 0.42);
  const warmMid = mixColors(THREE, furCol, accentCol, 0.72);

  const tex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    // Base fur gradient (slightly richer on crown, softer under chin)
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0.0, colorToRgba(darkCol, 1));
    bg.addColorStop(0.32, colorToRgba(furCol, 1));
    bg.addColorStop(0.72, colorToRgba(furCol, 1));
    bg.addColorStop(1.0, colorToRgba(softLight, 1));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Subtle organic mottling
    for (let i = 0; i < 45; i++) {
      const rx = kit.noise(i * 1.7, 2.3) * w;
      const ry = kit.noise(5.1, i * 1.3) * h;
      const rad = 24 + 45 * kit.noise(i * 0.9, 9.1);
      const gr = ctx.createRadialGradient(rx, ry, 2, rx, ry, rad);
      gr.addColorStop(0, colorToRgba(i % 2 === 0 ? softLight : darkCol, 0.12));
      gr.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gr;
      ctx.fillRect(rx - rad, ry - rad, rad * 2, rad * 2);
    }

    // Front of face is centered at u = 0.5 (x = w * 0.5), equator at y = h * 0.5
    const cx = w * 0.5;

    if (variant === 0) {
      // Solid coat: subtle lighter muzzle puff & soft chin
      const muz = ctx.createRadialGradient(cx, h * 0.61, 6, cx, h * 0.61, w * 0.13);
      muz.addColorStop(0, colorToRgba(softLight, 0.55));
      muz.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = muz;
      ctx.fillRect(0, 0, w, h);
    } else if (variant === 1) {
      // Tabby stripes!
      // Soft cream muzzle, chin, and eye-ring highlights
      const muz = ctx.createRadialGradient(cx, h * 0.62, 10, cx, h * 0.62, w * 0.15);
      muz.addColorStop(0, colorToRgba(accentCol, 0.85));
      muz.addColorStop(0.65, colorToRgba(warmMid, 0.55));
      muz.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = muz;
      ctx.fillRect(0, 0, w, h);

      // Gentle lighter eye spectacles
      for (const side of [-1, 1]) {
        const ex = cx + side * w * 0.072;
        const ey = h * 0.485;
        const eg = ctx.createRadialGradient(ex, ey, 4, ex, ey, w * 0.055);
        eg.addColorStop(0, colorToRgba(accentCol, 0.45));
        eg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = eg;
        ctx.fillRect(ex - 40, ey - 40, 80, 80);
      }

      // Forehead tabby "M" mark + flowing crown stripes
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = colorToRgba(deepStripe, 0.82);

      // Central M strokes
      ctx.lineWidth = 8.5;
      ctx.beginPath();
      ctx.moveTo(cx - 24, h * 0.40);
      ctx.quadraticCurveTo(cx - 19, h * 0.31, cx - 12, h * 0.25);
      ctx.quadraticCurveTo(cx - 5, h * 0.31, cx, h * 0.36);
      ctx.quadraticCurveTo(cx + 5, h * 0.31, cx + 12, h * 0.25);
      ctx.quadraticCurveTo(cx + 19, h * 0.31, cx + 24, h * 0.40);
      ctx.stroke();

      // Crown stripes running back over top of head
      const crownOffsets = [-32, -14, 0, 14, 32];
      for (let i = 0; i < crownOffsets.length; i++) {
        const ox = crownOffsets[i];
        ctx.lineWidth = i === 2 ? 10 : 7.5;
        ctx.beginPath();
        ctx.moveTo(cx + ox * 0.75, h * 0.33);
        ctx.quadraticCurveTo(cx + ox * 1.15, h * 0.20, cx + ox * 1.35, h * 0.06);
        ctx.stroke();
      }

      // Back of head / nape stripes (wrap around x = 0 and x = w)
      for (const bx of [0, w]) {
        for (const off of [-28, 0, 28]) {
          ctx.lineWidth = off === 0 ? 12 : 8;
          ctx.beginPath();
          ctx.moveTo(bx + off, h * 0.14);
          ctx.quadraticCurveTo(bx + off * 1.1, h * 0.42, bx + off * 0.9, h * 0.78);
          ctx.stroke();
        }
      }

      // Charming cheek mascara sweeps
      for (const side of [-1, 1]) {
        ctx.lineWidth = 6.5;
        ctx.beginPath();
        ctx.moveTo(cx + side * 52, h * 0.51);
        ctx.quadraticCurveTo(cx + side * 86, h * 0.52, cx + side * 124, h * 0.48);
        ctx.stroke();

        ctx.lineWidth = 5.5;
        ctx.beginPath();
        ctx.moveTo(cx + side * 54, h * 0.56);
        ctx.quadraticCurveTo(cx + side * 90, h * 0.59, cx + side * 130, h * 0.58);
        ctx.stroke();
      }

      // Delicate whisker-pad freckles
      ctx.fillStyle = colorToRgba(deepStripe, 0.55);
      for (const side of [-1, 1]) {
        const dots = [
          [20, 0.585], [27, 0.598], [21, 0.612],
          [32, 0.588], [34, 0.608]
        ];
        for (const [dx, dy] of dots) {
          ctx.beginPath();
          ctx.arc(cx + side * dx, h * dy, 1.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    } else if (variant === 2) {
      // Tuxedo mask: inverted-V white blaze across nose bridge, muzzle, lower cheeks, and chin
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, h * 0.415);
      ctx.bezierCurveTo(cx + 12, h * 0.46, cx + 42, h * 0.54, cx + 82, h * 0.62);
      ctx.bezierCurveTo(cx + 96, h * 0.70, cx + 70, h * 0.88, cx + 32, h * 0.98);
      ctx.lineTo(cx - 32, h * 0.98);
      ctx.bezierCurveTo(cx - 70, h * 0.88, cx - 96, h * 0.70, cx - 82, h * 0.62);
      ctx.bezierCurveTo(cx - 42, h * 0.54, cx - 12, h * 0.46, cx, h * 0.415);
      ctx.closePath();

      const tuxGrad = ctx.createRadialGradient(cx, h * 0.64, 15, cx, h * 0.64, 115);
      tuxGrad.addColorStop(0, colorToRgba(accentCol, 0.98));
      tuxGrad.addColorStop(0.85, colorToRgba(accentCol, 0.94));
      tuxGrad.addColorStop(1, colorToRgba(accentCol, 0.85));
      ctx.fillStyle = tuxGrad;
      ctx.fill();

      // Feather the tuxedo edge with tiny fur tufts
      ctx.strokeStyle = colorToRgba(accentCol, 0.65);
      ctx.lineWidth = 4;
      ctx.stroke();

      // Cute tiny asymmetric beauty spot on one whisker pad edge
      ctx.fillStyle = colorToRgba(furCol, 0.55);
      ctx.beginPath();
      ctx.ellipse(cx + 36, h * 0.57, 6, 4.5, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    paintFurStrokes(ctx, w, h, kit, furCol, darkCol, softLight, 2600);
  });

  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeBodyCoatTexture(THREE, kit, furCol, accentCol, variant) {
  const darkCol = shiftColor(THREE, furCol, -0.015, 0.08, -0.20);
  const deepStripe = shiftColor(THREE, furCol, -0.02, 0.12, -0.34);
  const softLight = mixColors(THREE, furCol, accentCol, 0.46);

  const tex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    // Base horizontal gradient: darker along back (u=0/1), lighter along chest/belly (u=0.5)
    const cx = w * 0.5;
    ctx.fillStyle = colorToRgba(furCol, 1);
    ctx.fillRect(0, 0, w, h);

    // Darker dorsal back shading near x = 0 and x = w
    for (const bx of [0, w]) {
      const dg = ctx.createRadialGradient(bx, h * 0.45, 10, bx, h * 0.45, w * 0.32);
      dg.addColorStop(0, colorToRgba(darkCol, 0.62));
      dg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = dg;
      ctx.fillRect(0, 0, w, h);
    }

    // Soft lighter chest & belly glow centered at x = w * 0.5
    const chestGrad = ctx.createRadialGradient(cx, h * 0.48, 12, cx, h * 0.52, w * 0.22);
    chestGrad.addColorStop(0, colorToRgba(variant === 0 ? softLight : accentCol, variant === 0 ? 0.55 : 0.78));
    chestGrad.addColorStop(0.7, colorToRgba(softLight, 0.35));
    chestGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = chestGrad;
    ctx.fillRect(0, 0, w, h);

    if (variant === 1) {
      // Tabby mackerel stripes along spine & flanks
      ctx.save();
      ctx.lineCap = "round";

      // Dorsal spine band (wraps across u=0 / u=1)
      ctx.fillStyle = colorToRgba(deepStripe, 0.72);
      ctx.fillRect(0, h * 0.08, w * 0.055, h * 0.84);
      ctx.fillRect(w * 0.945, h * 0.08, w * 0.055, h * 0.84);

      // Rib & haunch curved tabby stripes on both sides
      const stripeRows = [0.22, 0.34, 0.46, 0.58, 0.70, 0.80];
      for (let r = 0; r < stripeRows.length; r++) {
        const y0 = h * stripeRows[r];
        const thick = r === 2 || r === 3 ? 13 : 10;
        ctx.strokeStyle = colorToRgba(deepStripe, 0.74 - r * 0.03);
        ctx.lineWidth = thick;

        // Right flank (x from 0.04*w to 0.35*w)
        ctx.beginPath();
        ctx.moveTo(w * 0.03, y0 - 8);
        ctx.bezierCurveTo(w * 0.14, y0 + 8, w * 0.24, y0 + 20, w * 0.34, y0 + 12);
        ctx.stroke();

        // Left flank (mirrored: x from 0.97*w to 0.66*w)
        ctx.beginPath();
        ctx.moveTo(w * 0.97, y0 - 8);
        ctx.bezierCurveTo(w * 0.86, y0 + 8, w * 0.76, y0 + 20, w * 0.66, y0 + 12);
        ctx.stroke();
      }

      // Soft tabby chest necklace bands
      ctx.strokeStyle = colorToRgba(deepStripe, 0.42);
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(cx - 56, h * 0.25);
      ctx.quadraticCurveTo(cx, h * 0.32, cx + 56, h * 0.25);
      ctx.stroke();
      ctx.restore();
    } else if (variant === 2) {
      // Tuxedo crisp white shirtfront bib & belly
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx - 46, h * 0.04);
      ctx.bezierCurveTo(cx - 56, h * 0.25, cx - 72, h * 0.48, cx - 64, h * 0.76);
      ctx.bezierCurveTo(cx - 52, h * 0.92, cx + 52, h * 0.92, cx + 64, h * 0.76);
      ctx.bezierCurveTo(cx + 72, h * 0.48, cx + 56, h * 0.25, cx + 46, h * 0.04);
      ctx.closePath();
      ctx.fillStyle = colorToRgba(accentCol, 0.97);
      ctx.fill();
      ctx.strokeStyle = colorToRgba(accentCol, 0.6);
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();
    }

    paintFurStrokes(ctx, w, h, kit, furCol, darkCol, softLight, 2800);
  });

  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeTubeCoatTexture(THREE, kit, furCol, accentCol, variant, kind) {
  // kind: "tail" | "limb"
  // v = 0 at root (bottom of canvas, y=h), v = 1 at tip/paw (top of canvas, y=0)
  const darkCol = shiftColor(THREE, furCol, -0.015, 0.08, -0.20);
  const deepStripe = shiftColor(THREE, furCol, -0.02, 0.12, -0.34);
  const softLight = mixColors(THREE, furCol, accentCol, 0.46);

  const tex = kit.canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = colorToRgba(furCol, 1);
    ctx.fillRect(0, 0, w, h);

    // Soft shading along length
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, colorToRgba(furCol, 1));
    grad.addColorStop(0.75, colorToRgba(kind === "tail" ? darkCol : furCol, 0.35));
    grad.addColorStop(1, colorToRgba(kind === "tail" ? darkCol : softLight, 0.45));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (variant === 1) {
      if (kind === "tail") {
        // Bold cozy ringed tabby tail bands + dark tip
        const bands = [0.16, 0.31, 0.46, 0.60, 0.74, 0.87];
        for (let i = 0; i < bands.length; i++) {
          const cy = h * (1 - bands[i]);
          const bg = ctx.createLinearGradient(0, cy - 22, 0, cy + 22);
          bg.addColorStop(0, "rgba(0,0,0,0)");
          bg.addColorStop(0.3, colorToRgba(deepStripe, 0.85));
          bg.addColorStop(0.7, colorToRgba(deepStripe, 0.85));
          bg.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = bg;
          ctx.fillRect(0, cy - 22, w, 44);
        }
        // Dark plush tail tip (v > 0.90 -> y < 0.10*h)
        const tipG = ctx.createLinearGradient(0, 0, 0, h * 0.14);
        tipG.addColorStop(0, colorToRgba(deepStripe, 0.92));
        tipG.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = tipG;
        ctx.fillRect(0, 0, w, h * 0.14);
      } else {
        // Tabby arm bands + soft cream paw tips
        const bands = [0.24, 0.42, 0.58];
        for (const b of bands) {
          const cy = h * (1 - b);
          const bg = ctx.createLinearGradient(0, cy - 14, 0, cy + 14);
          bg.addColorStop(0, "rgba(0,0,0,0)");
          bg.addColorStop(0.5, colorToRgba(deepStripe, 0.68));
          bg.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = bg;
          ctx.fillRect(0, cy - 14, w, 28);
        }
        const pawG = ctx.createLinearGradient(0, 0, 0, h * 0.28);
        pawG.addColorStop(0, colorToRgba(accentCol, 0.88));
        pawG.addColorStop(0.7, colorToRgba(accentCol, 0.55));
        pawG.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = pawG;
        ctx.fillRect(0, 0, w, h * 0.28);
      }
    } else if (variant === 2) {
      // Tuxedo white mittens (limb) or cute dipped white tail tip
      const cutY = kind === "tail" ? h * 0.18 : h * 0.30;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, 0);
      ctx.lineTo(w, cutY);
      for (let x = w; x >= 0; x -= 12) {
        const wave = Math.sin((x / w) * Math.PI * 6) * 6 + (kit.noise(x * 0.04, 2.2) - 0.5) * 14;
        ctx.lineTo(x, cutY + wave);
      }
      ctx.closePath();
      ctx.fillStyle = colorToRgba(accentCol, 0.98);
      ctx.fill();
      ctx.restore();
    } else {
      // Solid coat: subtle soft paw brightening
      if (kind === "limb") {
        const pawG = ctx.createLinearGradient(0, 0, 0, h * 0.25);
        pawG.addColorStop(0, colorToRgba(softLight, 0.35));
        pawG.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = pawG;
        ctx.fillRect(0, 0, w, h * 0.25);
      }
    }

    paintFurStrokes(ctx, w, h, kit, furCol, darkCol, softLight, 1400);
  });

  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeEarCoatTexture(THREE, kit, furCol, accentCol, variant) {
  const darkCol = shiftColor(THREE, furCol, -0.015, 0.08, -0.24);
  const softLight = mixColors(THREE, furCol, accentCol, 0.35);

  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    // Slightly darker ear tips for expressive silhouette
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, colorToRgba(darkCol, 1));
    g.addColorStop(0.45, colorToRgba(furCol, 1));
    g.addColorStop(1, colorToRgba(furCol, 1));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    if (variant === 1) {
      // Soft lighter ear-back thumbprint spot (real tabby ear charm!)
      const spot = ctx.createRadialGradient(w * 0.5, h * 0.52, 6, w * 0.5, h * 0.52, w * 0.28);
      spot.addColorStop(0, colorToRgba(softLight, 0.58));
      spot.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = spot;
      ctx.fillRect(0, 0, w, h);
    }
    paintFurStrokes(ctx, w, h, kit, furCol, darkCol, softLight, 900);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeInnerEarTexture(THREE, kit, furCol) {
  const basePink = new THREE.Color("#eab0b4");
  const deepPink = new THREE.Color("#cf7f8c");
  const edgeBlend = mixColors(THREE, basePink, furCol, 0.35);

  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w * 0.5, h * 0.65, 10, w * 0.5, h * 0.52, w * 0.52);
    g.addColorStop(0, colorToRgba(deepPink, 1));
    g.addColorStop(0.55, colorToRgba(basePink, 1));
    g.addColorStop(1, colorToRgba(edgeBlend, 1));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeIrisTexture(THREE, kit, eyeCol) {
  const limbal = shiftColor(THREE, eyeCol, 0, 0.08, -0.36);
  const brightCrescent = shiftColor(THREE, eyeCol, 0.03, 0.14, 0.22);
  const midIris = eyeCol.clone();

  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const R = w * 0.49;

    ctx.fillStyle = colorToRgba(limbal, 1);
    ctx.fillRect(0, 0, w, h);

    // Rich radial iris base with dark outer limbal ring
    const rg = ctx.createRadialGradient(cx, cy, R * 0.18, cx, cy, R);
    rg.addColorStop(0.0, colorToRgba(midIris, 1));
    rg.addColorStop(0.58, colorToRgba(midIris, 1));
    rg.addColorStop(0.84, colorToRgba(limbal, 1));
    rg.addColorStop(1.0, "#121016");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();

    // Luminous lower crescent bounce light inside the iris (gives huge warmth!)
    const cg = ctx.createRadialGradient(cx, cy + R * 0.34, R * 0.05, cx, cy + R * 0.28, R * 0.54);
    cg.addColorStop(0, colorToRgba(brightCrescent, 0.88));
    cg.addColorStop(0.65, colorToRgba(brightCrescent, 0.32));
    cg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.86, 0, Math.PI * 2);
    ctx.fill();

    // Fine radial iris fibres
    ctx.save();
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      const n = kit.noise(Math.cos(a) * 2.5 + 3, Math.sin(a) * 2.5 + 3);
      ctx.strokeStyle = n > 0.5
        ? colorToRgba(brightCrescent, 0.22)
        : colorToRgba(limbal, 0.25);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R * 0.32, cy + Math.sin(a) * R * 0.32);
      ctx.lineTo(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86);
      ctx.stroke();
    }
    ctx.restore();

    // Soft upper eyelid ambient shadow across top of iris
    const topSh = ctx.createLinearGradient(0, cy - R, 0, cy + R * 0.1);
    topSh.addColorStop(0, "rgba(14,10,20,0.68)");
    topSh.addColorStop(0.55, "rgba(14,10,20,0.22)");
    topSh.addColorStop(1, "rgba(14,10,20,0)");
    ctx.fillStyle = topSh;
    ctx.fillRect(0, 0, w, h);

    // Cozy wide slightly-almond cat pupil
    ctx.fillStyle = "#100d15";
    ctx.beginPath();
    ctx.ellipse(cx, cy, R * 0.42, R * 0.56, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBlushTexture(THREE, kit) {
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 4, w * 0.5, h * 0.5, w * 0.48);
    g.addColorStop(0, "rgba(238, 134, 148, 0.72)");
    g.addColorStop(0.55, "rgba(238, 142, 154, 0.34)");
    g.addColorStop(1, "rgba(238, 142, 154, 0.0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeFabricTextures(THREE, kit, fabricColor) {
  const dark = shiftColor(THREE, fabricColor, 0, 0.06, -0.14);
  const light = shiftColor(THREE, fabricColor, 0, -0.04, 0.12);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = colorToRgba(fabricColor, 1);
    ctx.fillRect(0, 0, w, h);

    // Fine cozy twill weave
    const step = 6;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const diag = ((x + y) / step) % 2 === 0;
        ctx.fillStyle = diag ? colorToRgba(light, 0.16) : colorToRgba(dark, 0.16);
        ctx.fillRect(x, y, step * 0.65, step * 0.65);
      }
    }
    // Subtle stitched border lines
    ctx.strokeStyle = colorToRgba(light, 0.35);
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.15);
    ctx.lineTo(w, h * 0.15);
    ctx.moveTo(0, h * 0.85);
    ctx.lineTo(w, h * 0.85);
    ctx.stroke();
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, w, h);
    const step = 6;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const diag = ((x + y) / step) % 2 === 0;
        ctx.fillStyle = diag ? "#a8a8a8" : "#585858";
        ctx.fillRect(x, y, step * 0.65, step * 0.65);
      }
    }
  });
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;

  return { map, bump };
}

// ---------------------------------------------------------------------------
// Face Details (Three-Layer Eyes, Curved Mouth, Whiskers, Blush)
// ---------------------------------------------------------------------------

function buildEyeGroup(THREE, side, eyeBaseGeo, irisGeo, highlightGeo, darkMat, irisMat, whiteMat, lashMat) {
  const eyeGroup = new THREE.Group();
  eyeGroup.name = side > 0 ? "eyeL" : "eyeR";

  // Layer 1: Dark glossy eyeball / sclera-rim dome
  const darkBase = new THREE.Mesh(eyeBaseGeo, darkMat);
  darkBase.scale.set(1.0, 1.07, 1.0);
  darkBase.userData.slot = "eye";
  eyeGroup.add(darkBase);

  // Layer 2: Coloured iris ring + pupil dome nestled cleanly inside dark border
  const irisMesh = new THREE.Mesh(irisGeo, irisMat);
  irisMesh.scale.set(1.0, 1.07, 1.0);
  irisMesh.position.z = 0.0014;
  irisMesh.userData.slot = "eye";
  eyeGroup.add(irisMesh);

  // Layer 3: Two crisp glossy catchlight dots placed up and to the same light side
  const hiMain = new THREE.Mesh(highlightGeo, whiteMat);
  hiMain.position.set(-0.0052, 0.0068, 0.0086);
  hiMain.scale.set(1.18, 1.05, 0.55);
  hiMain.userData.slot = "glow";
  eyeGroup.add(hiMain);

  const hiSub = new THREE.Mesh(highlightGeo, whiteMat);
  hiSub.position.set(0.0054, -0.0056, 0.0085);
  hiSub.scale.set(0.56, 0.52, 0.45);
  hiSub.userData.slot = "glow";
  eyeGroup.add(hiSub);

  // Subtle curved upper lash line tucked right onto the top edge of the eye
  const lashCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.0175 * side, 0.003, 0.0018),
    new THREE.Vector3(-0.0085 * side, 0.0158, 0.0052),
    new THREE.Vector3(0.0055 * side, 0.0168, 0.0054),
    new THREE.Vector3(0.0190 * side, 0.0058, 0.0015),
    new THREE.Vector3(0.0225 * side, 0.0082, -0.0005)
  ]);
  const lashGeo = buildTaperedTube(THREE, lashCurve, 18, 8, (t) => {
    const w = Math.sin(t * Math.PI);
    return 0.00075 + 0.00115 * w;
  });
  const lash = new THREE.Mesh(lashGeo, lashMat);
  lash.userData.slot = "secondary";
  eyeGroup.add(lash);

  return eyeGroup;
}

function orientOnHeadSurface(THREE, obj, vx, vy, vz, sink = 0.0) {
  const len = Math.hypot(vx, vy, vz) || 1;
  const nx = vx / len;
  const ny = vy / len;
  const nz = vz / len;

  const p = new THREE.Vector3();
  sampleHeadSurface(nx, ny, nz, p);
  const normal = sampleHeadNormal(THREE, nx, ny, nz);

  p.addScaledVector(normal, -sink);
  obj.position.copy(p);

  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(up, normal).normalize();
  const trueUp = new THREE.Vector3().crossVectors(normal, right).normalize();
  const m = new THREE.Matrix4().makeBasis(right, trueUp, normal);
  obj.quaternion.setFromRotationMatrix(m);
}

// ---------------------------------------------------------------------------
// Main Builder
// ---------------------------------------------------------------------------

export function build(THREE, opts = {}, kit) {
  const variant = opts.variant === 1 || opts.variant === 2 ? opts.variant : 0;
  const accessory = opts.accessory === "bell" || opts.accessory === "bow" ? opts.accessory : "none";

  const defaultFur = variant === 2 ? "#2d2f38" : variant === 1 ? "#cf8a4e" : "#d89a64";
  const furCol = new THREE.Color(opts.fur || defaultFur);
  const accentCol = new THREE.Color(opts.furAccent || "#f7efe4");
  const eyeCol = new THREE.Color(opts.eye || "#5da86a");
  const collarCol = new THREE.Color(variant === 2 ? "#c74b50" : "#b84a52");
  const bowCol = new THREE.Color(variant === 2 ? "#d65a5e" : "#c9585c");

  const furSheen = mixColors(THREE, furCol, new THREE.Color("#fff7ed"), 0.55);
  const accentSheen = new THREE.Color("#ffffff");

  // Procedural maps
  const furBump = makeFurBumpTexture(THREE, kit);
  const headMap = makeHeadCoatTexture(THREE, kit, furCol, accentCol, variant);
  const bodyMap = makeBodyCoatTexture(THREE, kit, furCol, accentCol, variant);
  const tailMap = makeTubeCoatTexture(THREE, kit, furCol, accentCol, variant, "tail");
  const limbMap = makeTubeCoatTexture(THREE, kit, furCol, accentCol, variant, "limb");
  const earMap = makeEarCoatTexture(THREE, kit, furCol, accentCol, variant);
  const innerEarMap = makeInnerEarTexture(THREE, kit, furCol);
  const irisMap = makeIrisTexture(THREE, kit, eyeCol);
  const blushMap = makeBlushTexture(THREE, kit);

  // Materials (MeshPhysicalMaterial)
  const makeFurMat = (map, bumpScale = 0.0024) => new THREE.MeshPhysicalMaterial({
    map,
    bumpMap: furBump,
    bumpScale,
    roughness: 0.90,
    metalness: 0.0,
    sheen: 0.85,
    sheenRoughness: 0.68,
    sheenColor: furSheen
  });

  const headMat = makeFurMat(headMap, 0.0022);
  const bodyMat = makeFurMat(bodyMap, 0.0026);
  const tailMat = makeFurMat(tailMap, 0.0026);
  const limbMat = makeFurMat(limbMap, 0.0022);
  const earMat = makeFurMat(earMap, 0.0020);

  const innerEarMat = new THREE.MeshPhysicalMaterial({
    map: innerEarMap,
    roughness: 0.86,
    metalness: 0.0,
    sheen: 0.72,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color("#ffdce2")
  });

  const fluffMat = new THREE.MeshPhysicalMaterial({
    color: accentCol,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.9,
    sheenRoughness: 0.6,
    sheenColor: accentSheen
  });

  const eyeDarkMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#16121b"),
    roughness: 0.04,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03
  });

  const irisMat = new THREE.MeshPhysicalMaterial({
    map: irisMap,
    roughness: 0.07,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04
  });

  const catchlightMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#ffffff"),
    emissive: new THREE.Color("#ffffff"),
    emissiveIntensity: 0.45,
    roughness: 0.04,
    metalness: 0.0,
    clearcoat: 1.0
  });

  const featureDarkMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#332325"),
    roughness: 0.55,
    metalness: 0.0,
    clearcoat: 0.25
  });

  const noseMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(variant === 2 ? "#d98896" : "#d8828d"),
    roughness: 0.34,
    metalness: 0.0,
    clearcoat: 0.48,
    clearcoatRoughness: 0.22
  });

  const toeBeanMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#e098a3"),
    roughness: 0.42,
    metalness: 0.0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.28
  });

  const whiskerMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#f7f1e7"),
    roughness: 0.35,
    metalness: 0.0,
    clearcoat: 0.3
  });

  const blushMat = new THREE.MeshPhysicalMaterial({
    map: blushMap,
    transparent: true,
    depthWrite: false,
    roughness: 0.92,
    opacity: 0.62
  });

  // Root group (origin on floor y = 0, facing +Z)
  const root = new THREE.Group();
  root.name = "cozy_cat";

  // -------------------------------------------------------------------------
  // 1. Sculpted Continuous Body
  // -------------------------------------------------------------------------
  const bodyGroup = new THREE.Group();
  bodyGroup.name = "body";
  const bodyMesh = new THREE.Mesh(buildBodyGeo(THREE), bodyMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.userData.slot = "fur";
  bodyGroup.add(bodyMesh);
  bodyGroup.userData.base = {
    pos: bodyGroup.position.clone(),
    rot: bodyGroup.rotation.clone(),
    scale: bodyGroup.scale.clone()
  };
  root.add(bodyGroup);

  // -------------------------------------------------------------------------
  // 2. Sculpted Front Legs & Paws (armL planted, armR gently raised)
  // -------------------------------------------------------------------------
  const makePawRadiusFn = (lifted = false) => (t, theta) => {
    // Broad shoulder buried in chest -> tapered forearm -> widened flat paw with 3 toe lobes
    let r = 0.031 * (1 - smoothstep(0.0, 0.35, t))
      + 0.0195 * smoothstep(0.0, 0.35, t)
      + 0.0055 * smoothstep(0.72, 0.96, t);

    let rx = r;
    let ry = r;
    const pawMask = smoothstep(0.68, 0.95, t);
    rx *= 1.0 + 0.16 * pawMask;
    ry *= 1.0 - (lifted ? 0.16 : 0.28) * pawMask;

    // Gentle 3-toe silhouette lobes near paw front
    const toeRipple = 1.0 + 0.055 * pawMask * Math.cos(theta * 3) * Math.max(0, Math.sin(theta));
    rx *= toeRipple;

    return { rx, ry, capLen: r * 0.72 };
  };

  // armL: planted solidly on the floor
  const armL = new THREE.Group();
  armL.name = "armL";
  armL.position.set(0.044, 0.140, 0.042);
  const armLCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.008, 0.008, -0.018),
    new THREE.Vector3(0.002, -0.052, 0.028),
    new THREE.Vector3(0.000, -0.114, 0.052),
    new THREE.Vector3(-0.002, -0.125, 0.078)
  ]);
  const armLGeo = buildTaperedTube(THREE, armLCurve, 28, 18, makePawRadiusFn(false), {
    floorClamp: -0.1394
  });
  const armLMesh = new THREE.Mesh(armLGeo, limbMat);
  armLMesh.castShadow = true;
  armLMesh.receiveShadow = true;
  armLMesh.userData.slot = "fur";
  armL.add(armLMesh);
  armL.userData.base = {
    pos: armL.position.clone(),
    rot: armL.rotation.clone(),
    scale: armL.scale.clone()
  };
  root.add(armL);

  // armR: gently lifted & curled inward for charming asymmetry
  const armR = new THREE.Group();
  armR.name = "armR";
  armR.position.set(-0.044, 0.140, 0.042);
  const armRCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.008, 0.008, -0.018),
    new THREE.Vector3(-0.005, -0.044, 0.036),
    new THREE.Vector3(0.002, -0.072, 0.068),
    new THREE.Vector3(0.014, -0.088, 0.074)
  ]);
  const armRGeo = buildTaperedTube(THREE, armRCurve, 28, 18, makePawRadiusFn(true));
  const armRMesh = new THREE.Mesh(armRGeo, limbMat);
  armRMesh.castShadow = true;
  armRMesh.receiveShadow = true;
  armRMesh.userData.slot = "fur";
  armR.add(armRMesh);

  // Cute tiny toe beans nestled on the underside of the lifted paw
  const beanGeo = new THREE.SphereGeometry(0.0046, 12, 10);
  const mainPad = new THREE.Mesh(beanGeo, toeBeanMat);
  mainPad.position.set(0.013, -0.095, 0.067);
  mainPad.scale.set(1.55, 0.65, 1.35);
  mainPad.rotation.set(0.55, 0, -0.2);
  mainPad.userData.slot = "skin";
  armR.add(mainPad);

  const toeOffsets = [
    [0.005, -0.098, 0.078],
    [0.014, -0.099, 0.081],
    [0.023, -0.097, 0.077]
  ];
  for (const [bx, by, bz] of toeOffsets) {
    const toe = new THREE.Mesh(beanGeo, toeBeanMat);
    toe.position.set(bx, by, bz);
    toe.scale.set(0.82, 0.55, 0.88);
    toe.userData.slot = "skin";
    armR.add(toe);
  }
  armR.userData.base = {
    pos: armR.position.clone(),
    rot: armR.rotation.clone(),
    scale: armR.scale.clone()
  };
  root.add(armR);

  // -------------------------------------------------------------------------
  // 3. Sculpted Hind Paws (legL, legR) peeking out from sitting haunches
  // -------------------------------------------------------------------------
  const makeHindLeg = (side) => {
    const g = new THREE.Group();
    g.name = side > 0 ? "legL" : "legR";
    g.position.set(side * 0.066, 0.026, -0.020);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-side * 0.018, 0.012, -0.018),
      new THREE.Vector3(side * 0.008, -0.006, 0.032),
      new THREE.Vector3(side * 0.016, -0.012, 0.074),
      new THREE.Vector3(side * 0.020, -0.013, 0.098)
    ]);
    const geo = buildTaperedTube(THREE, curve, 24, 18, (t, theta) => {
      const r = 0.026 * (1 - 0.16 * smoothstep(0.0, 0.5, t)) + 0.003 * smoothstep(0.7, 0.95, t);
      const pawMask = smoothstep(0.55, 0.95, t);
      const rx = r * (1.0 + 0.14 * pawMask) * (1.0 + 0.045 * pawMask * Math.cos(theta * 3));
      const ry = r * (0.76 - 0.14 * pawMask);
      return { rx, ry, capLen: r * 0.78 };
    }, { floorClamp: -0.0255 });
    const m = new THREE.Mesh(geo, limbMat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.slot = "fur";
    g.add(m);
    g.userData.base = {
      pos: g.position.clone(),
      rot: g.rotation.clone(),
      scale: g.scale.clone()
    };
    return g;
  };
  root.add(makeHindLeg(1));
  root.add(makeHindLeg(-1));

  // -------------------------------------------------------------------------
  // 4. Sculpted Fluffy Curled Tail (sweeping around haunch & paws, ~0.38m span)
  // -------------------------------------------------------------------------
  const tailGroup = new THREE.Group();
  tailGroup.name = "tail";
  tailGroup.position.set(0.0, 0.032, -0.095);

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.000, 0.010, 0.030),    // Buried cleanly inside lower back
    new THREE.Vector3(0.014, -0.002, -0.056),  // Exits rump smoothly (world z ~ -0.151)
    new THREE.Vector3(0.098, -0.013, -0.046),  // Sweeps around left haunch
    new THREE.Vector3(0.132, -0.015, 0.058),   // Broad cozy flank curve
    new THREE.Vector3(0.094, -0.015, 0.186),   // Wraps toward front paws
    new THREE.Vector3(0.008, -0.013, 0.272),   // Curled neatly in front (world z ~ +0.177 + radius ~ +0.20)
    new THREE.Vector3(-0.070, -0.004, 0.256),  // Sweeps under lifted right paw
    new THREE.Vector3(-0.102, 0.024, 0.214)    // Soft playful upturned fluffy tip
  ]);

  const tailGeo = buildTaperedTube(THREE, tailCurve, 56, 20, (t) => {
    // Plush slightly fuller mid-tail, rounded fluffy tip
    const baseR = 0.0195 + 0.0062 * Math.sin(Math.pow(t, 0.78) * Math.PI * 0.92);
    const tipTaper = 1.0 - 0.14 * smoothstep(0.84, 1.0, t);
    const r = baseR * tipTaper;
    // Slightly flatten underside where tail rests along the floor
    const floorContact = smoothstep(0.08, 0.24, t) * (1.0 - smoothstep(0.76, 0.95, t));
    return {
      rx: r * (1.0 + 0.08 * floorContact),
      ry: r * (1.0 - 0.14 * floorContact),
      capLen: r * 0.95
    };
  }, { floorClamp: -0.0315 });

  const tailMesh = new THREE.Mesh(tailGeo, tailMat);
  tailMesh.castShadow = true;
  tailMesh.receiveShadow = true;
  tailMesh.userData.slot = "fur";
  tailGroup.add(tailMesh);
  tailGroup.userData.base = {
    pos: tailGroup.position.clone(),
    rot: tailGroup.rotation.clone(),
    scale: tailGroup.scale.clone()
  };
  root.add(tailGroup);

  // -------------------------------------------------------------------------
  // 5. Sculpted Head, Ears, Layered Eyes, Nose, Mouth, Whiskers, Blush
  // -------------------------------------------------------------------------
  const headGroup = new THREE.Group();
  headGroup.name = "head";
  headGroup.position.set(0.0, 0.208, 0.034);
  // Charming tilted & subtly turned resting pose
  headGroup.rotation.set(0.04, 0.09, -0.15);

  const headMesh = new THREE.Mesh(buildHeadGeo(THREE), headMat);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headMesh.userData.slot = "fur";
  headGroup.add(headMesh);

  // Curved extruded ears (earL & earR)
  const outerEarGeo = buildCurvedEarGeo(THREE, false);
  const innerEarGeo = buildCurvedEarGeo(THREE, true);
  const fluffGeo = buildEarFluffGeo(THREE);

  const makeEar = (side) => {
    const earGroup = new THREE.Group();
    earGroup.name = side > 0 ? "earL" : "earR";

    const outer = new THREE.Mesh(outerEarGeo, earMat);
    outer.castShadow = true;
    outer.receiveShadow = true;
    outer.userData.slot = "fur";
    if (side < 0) outer.scale.x = -1;
    earGroup.add(outer);

    const inner = new THREE.Mesh(innerEarGeo, innerEarMat);
    inner.userData.slot = "skin";
    if (side < 0) inner.scale.x = -1;
    earGroup.add(inner);

    const fluff = new THREE.Mesh(fluffGeo, fluffMat);
    fluff.position.set(-side * 0.011, 0.008, 0.006);
    fluff.rotation.z = side * 0.22;
    if (side < 0) fluff.scale.x = -1;
    fluff.userData.slot = "furAccent";
    earGroup.add(fluff);

    // Seat deeply onto skull crown sides using exact surface sampling
    const p = new THREE.Vector3();
    sampleHeadSurface(side * 0.56, 0.72, 0.14, p);
    earGroup.position.set(p.x - side * 0.004, p.y - 0.010, p.z - 0.002);
    // Subtle asymmetry: left ear slightly perkier, right ear softer
    earGroup.rotation.set(
      0.16,
      side * 0.24,
      -side * (side > 0 ? 0.44 : 0.52)
    );
    earGroup.userData.base = {
      pos: earGroup.position.clone(),
      rot: earGroup.rotation.clone(),
      scale: earGroup.scale.clone()
    };
    return earGroup;
  };

  headGroup.add(makeEar(1));
  headGroup.add(makeEar(-1));

  // Large charming three-layer eyes nestled snugly in the sculpted eye sockets
  const eyeBaseGeo = buildEyeLensGeo(THREE, 0.0185, 0.0086, 32);
  const irisGeo = buildEyeLensGeo(THREE, 0.0160, 0.0076, 32);
  const highlightGeo = new THREE.SphereGeometry(0.0034, 14, 12);

  for (const side of [1, -1]) {
    const eye = buildEyeGroup(
      THREE, side, eyeBaseGeo, irisGeo, highlightGeo,
      eyeDarkMat, irisMat, catchlightMat, featureDarkMat
    );
    orientOnHeadSurface(THREE, eye, side * 0.41, 0.045, 0.91, 0.0020);
    eye.userData.base = {
      pos: eye.position.clone(),
      rot: eye.rotation.clone(),
      scale: eye.scale.clone()
    };
    headGroup.add(eye);
  }

  // Sculpted cat nose
  const noseMesh = new THREE.Mesh(buildNoseGeo(THREE), noseMat);
  orientOnHeadSurface(THREE, noseMesh, 0.0, -0.155, 0.988, -0.0012);
  noseMesh.userData.slot = "skin";
  headGroup.add(noseMesh);

  // Curved `:3` mouth line built from thin tapered tubes
  const mTop = new THREE.Vector3();
  const mMid = new THREE.Vector3();
  const mL1 = new THREE.Vector3();
  const mL2 = new THREE.Vector3();
  const mR1 = new THREE.Vector3();
  const mR2 = new THREE.Vector3();
  sampleHeadSurface(0.0, -0.195, 0.980, mTop);
  sampleHeadSurface(0.0, -0.275, 0.962, mMid);
  sampleHeadSurface(0.095, -0.325, 0.941, mL1);
  sampleHeadSurface(0.185, -0.285, 0.940, mL2);
  sampleHeadSurface(-0.095, -0.325, 0.941, mR1);
  sampleHeadSurface(-0.185, -0.285, 0.940, mR2);
  for (const pt of [mTop, mMid, mL1, mL2, mR1, mR2]) pt.z += 0.0014;

  const philtrumCurve = new THREE.CatmullRomCurve3([mTop, mMid]);
  const mouthCurveL = new THREE.CatmullRomCurve3([mMid, mL1, mL2]);
  const mouthCurveR = new THREE.CatmullRomCurve3([mMid, mR1, mR2]);

  const mouthRadius = (t) => 0.00135 * (0.55 + 0.45 * Math.sin(t * Math.PI));
  const philtrumMesh = new THREE.Mesh(
    buildTaperedTube(THREE, philtrumCurve, 8, 8, () => 0.0011),
    featureDarkMat
  );
  const mouthLMesh = new THREE.Mesh(
    buildTaperedTube(THREE, mouthCurveL, 14, 8, mouthRadius),
    featureDarkMat
  );
  const mouthRMesh = new THREE.Mesh(
    buildTaperedTube(THREE, mouthCurveR, 14, 8, mouthRadius),
    featureDarkMat
  );
  philtrumMesh.userData.slot = "secondary";
  mouthLMesh.userData.slot = "secondary";
  mouthRMesh.userData.slot = "secondary";
  headGroup.add(philtrumMesh, mouthLMesh, mouthRMesh);

  // Subtle blush discs nestled on cheeks under outer eye corners
  const blushGeo = new THREE.CircleGeometry(0.0155, 24);
  for (const side of [1, -1]) {
    const blush = new THREE.Mesh(blushGeo, blushMat);
    orientOnHeadSurface(THREE, blush, side * 0.58, -0.15, 0.80, -0.0012);
    blush.scale.set(1.22, 0.78, 1.0);
    blush.userData.slot = "skin";
    headGroup.add(blush);
  }

  // Delicate tapered whiskers (3 per side)
  const whiskerSpecs = [
    { vy: -0.20, vx: 0.30, dy: 0.008, dz: -0.014, len: 0.064 },
    { vy: -0.25, vx: 0.33, dy: -0.002, dz: -0.018, len: 0.070 },
    { vy: -0.30, vx: 0.29, dy: -0.012, dz: -0.015, len: 0.058 }
  ];
  for (const side of [1, -1]) {
    for (const ws of whiskerSpecs) {
      const rootP = new THREE.Vector3();
      const vz = Math.sqrt(Math.max(0.1, 1 - ws.vx * ws.vx - ws.vy * ws.vy));
      sampleHeadSurface(side * ws.vx, ws.vy, vz, rootP);
      // Bury whisker root slightly inside cheek pad
      const p0 = rootP.clone().add(new THREE.Vector3(-side * 0.004, 0, -0.003));
      const p1 = rootP.clone().add(new THREE.Vector3(side * ws.len * 0.45, ws.dy * 0.45 + 0.002, ws.dz * 0.35));
      const p2 = rootP.clone().add(new THREE.Vector3(side * ws.len, ws.dy - 0.005, ws.dz));
      const wCurve = new THREE.CatmullRomCurve3([p0, p1, p2]);
      const wGeo = buildTaperedTube(THREE, wCurve, 12, 6, (t) => 0.00085 * (1 - 0.74 * t));
      const wMesh = new THREE.Mesh(wGeo, whiskerMat);
      wMesh.userData.slot = "furAccent";
      headGroup.add(wMesh);
    }
  }

  headGroup.userData.base = {
    pos: headGroup.position.clone(),
    rot: headGroup.rotation.clone(),
    scale: headGroup.scale.clone()
  };
  root.add(headGroup);

  // -------------------------------------------------------------------------
  // 6. Optional Collar Accessory ("bell" | "bow")
  // -------------------------------------------------------------------------
  if (accessory === "bell" || accessory === "bow") {
    const accGroup = new THREE.Group();
    accGroup.name = "collar";

    const fabricTex = makeFabricTextures(THREE, kit, collarCol);
    const collarMat = new THREE.MeshPhysicalMaterial({
      map: fabricTex.map,
      bumpMap: fabricTex.bump,
      bumpScale: 0.0014,
      roughness: 0.88,
      metalness: 0.0,
      sheen: 0.78,
      sheenRoughness: 0.65,
      sheenColor: shiftColor(THREE, collarCol, 0, -0.08, 0.25)
    });

    // Closed curved collar strap wrapping snugly around neck transition
    const collarPts = [];
    const ringSteps = 16;
    for (let i = 0; i < ringSteps; i++) {
      const a = (i / ringSteps) * Math.PI * 2;
      const rx = 0.056;
      const rz = 0.058;
      const cx = Math.sin(a) * rx;
      const cz = 0.032 + Math.cos(a) * rz;
      // Dip gracefully lower at the front chest
      const cy = 0.194 - 0.012 * Math.cos(a);
      collarPts.push(new THREE.Vector3(cx, cy, cz));
    }
    const collarCurve = new THREE.CatmullRomCurve3(collarPts, true);
    const collarGeo = buildTaperedTube(THREE, collarCurve, 44, 14, () => ({
      rx: 0.0052,
      ry: 0.0085
    }), { closed: true });
    const collarMesh = new THREE.Mesh(collarGeo, collarMat);
    collarMesh.castShadow = true;
    collarMesh.receiveShadow = true;
    collarMesh.userData.slot = "primary";
    accGroup.add(collarMesh);

    if (accessory === "bell") {
      const charmGroup = new THREE.Group();
      charmGroup.name = "bellCharm";
      charmGroup.position.set(0.0, 0.178, 0.094);

      const brassMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color("#e8c15a"),
        roughness: 0.22,
        metalness: 0.86,
        clearcoat: 0.35,
        clearcoatRoughness: 0.15
      });

      const bellMesh = new THREE.Mesh(buildBellGeo(THREE), brassMat);
      bellMesh.castShadow = true;
      bellMesh.userData.slot = "accent";
      charmGroup.add(bellMesh);

      // Tiny connector ring linking bell to collar
      const linkRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.0042, 0.0011, 10, 20),
        brassMat
      );
      linkRing.position.set(0, 0.0045, -0.002);
      linkRing.rotation.y = Math.PI * 0.5;
      linkRing.userData.slot = "accent";
      charmGroup.add(linkRing);

      // Acoustic slit detail at lower front of bell
      const slitMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color("#1f160e"),
        roughness: 0.85
      });
      const slit = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 12, 10), slitMat);
      slit.position.set(0, -0.0218, 0.0068);
      slit.scale.set(0.72, 0.72, 0.45);
      slit.userData.slot = "secondary";
      charmGroup.add(slit);

      const slitLine = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.0011, 0.009, 6, 10),
        slitMat
      );
      slitLine.position.set(0, -0.0235, 0.0015);
      slitLine.rotation.x = Math.PI * 0.48;
      slitLine.userData.slot = "secondary";
      charmGroup.add(slitLine);

      charmGroup.userData.base = {
        pos: charmGroup.position.clone(),
        rot: charmGroup.rotation.clone(),
        scale: charmGroup.scale.clone()
      };
      accGroup.add(charmGroup);
    } else if (accessory === "bow") {
      const bowGroup = new THREE.Group();
      bowGroup.name = "bowCharm";
      bowGroup.position.set(0.0, 0.180, 0.095);
      bowGroup.rotation.x = -0.14;

      const bowTex = makeFabricTextures(THREE, kit, bowCol);
      const bowMat = new THREE.MeshPhysicalMaterial({
        map: bowTex.map,
        bumpMap: bowTex.bump,
        bumpScale: 0.0016,
        roughness: 0.86,
        metalness: 0.0,
        sheen: 0.85,
        sheenRoughness: 0.6,
        sheenColor: shiftColor(THREE, bowCol, 0, -0.06, 0.28)
      });

      const loopL = new THREE.Mesh(buildBowLoopGeo(THREE, 1), bowMat);
      const loopR = new THREE.Mesh(buildBowLoopGeo(THREE, -1), bowMat);
      const tailL = new THREE.Mesh(buildBowRibbonTailGeo(THREE, 1), bowMat);
      const tailR = new THREE.Mesh(buildBowRibbonTailGeo(THREE, -1), bowMat);

      tailL.position.set(0.005, -0.004, -0.001);
      tailR.position.set(-0.005, -0.004, -0.001);

      // Sculpted center bow knot
      const knotGeo = new THREE.SphereGeometry(0.0095, 22, 16);
      knotGeo.scale(0.95, 1.12, 0.82);
      const knot = new THREE.Mesh(knotGeo, bowMat);
      knot.position.set(0, 0, 0.002);

      for (const m of [loopL, loopR, tailL, tailR, knot]) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.userData.slot = "accent";
        bowGroup.add(m);
      }

      bowGroup.userData.base = {
        pos: bowGroup.position.clone(),
        rot: bowGroup.rotation.clone(),
        scale: bowGroup.scale.clone()
      };
      accGroup.add(bowGroup);
    }

    root.add(accGroup);
  }

  return root;
}

// ---------------------------------------------------------------------------
// Idle Animation (Breathing, Head Sway, Ear Flicks, Tail Curl, Blinking)
// ---------------------------------------------------------------------------

export function idle(group, t) {
  if (!group.userData._anim) {
    group.userData._anim = {
      body: group.getObjectByName("body"),
      head: group.getObjectByName("head"),
      tail: group.getObjectByName("tail"),
      earL: group.getObjectByName("earL"),
      earR: group.getObjectByName("earR"),
      eyeL: group.getObjectByName("eyeL"),
      eyeR: group.getObjectByName("eyeR"),
      armR: group.getObjectByName("armR"),
      bellCharm: group.getObjectByName("bellCharm"),
      bowCharm: group.getObjectByName("bowCharm")
    };
  }
  const a = group.userData._anim;

  // 1. Cozy gentle breathing
  const breath = Math.sin(t * 2.05);
  if (a.body && a.body.userData.base) {
    const b = a.body.userData.base;
    a.body.scale.set(
      b.scale.x * (1 + 0.015 * breath),
      b.scale.y * (1 + 0.012 * breath),
      b.scale.z * (1 + 0.017 * breath)
    );
  }

  // 2. Small curious head sway & breathing bob
  if (a.head && a.head.userData.base) {
    const b = a.head.userData.base;
    a.head.position.y = b.pos.y + 0.0024 * breath;
    a.head.rotation.x = b.rot.x + 0.028 * Math.sin(t * 0.95 - 0.4);
    a.head.rotation.y = b.rot.y + 0.068 * Math.sin(t * 0.54);
    a.head.rotation.z = b.rot.z + 0.048 * Math.sin(t * 0.72 + 0.6);
  }

  // 3. Independent gentle ear sway + occasional lifelike cat ear twitch
  const twitchPulse = (time, period, offset) => {
    const phase = ((time + offset) % period) / period;
    const d = (phase - 0.14) / 0.032;
    return Math.exp(-d * d);
  };

  if (a.earL && a.earL.userData.base) {
    const b = a.earL.userData.base;
    const flick = twitchPulse(t, 5.4, 0.8);
    a.earL.rotation.z = b.rot.z - 0.03 * Math.sin(t * 1.1) - 0.18 * flick;
    a.earL.rotation.x = b.rot.x + 0.09 * flick;
  }
  if (a.earR && a.earR.userData.base) {
    const b = a.earR.userData.base;
    const flick = twitchPulse(t, 7.1, 3.3);
    a.earR.rotation.z = b.rot.z + 0.03 * Math.sin(t * 1.05 + 1.2) + 0.16 * flick;
    a.earR.rotation.x = b.rot.x + 0.08 * flick;
  }

  // 4. Lazy curled tail sway (never clips below y = 0)
  if (a.tail && a.tail.userData.base) {
    const b = a.tail.userData.base;
    a.tail.rotation.y = b.rot.y + 0.042 * Math.sin(t * 1.15);
    a.tail.rotation.x = b.rot.x - 0.016 * (0.5 + 0.5 * Math.sin(t * 1.45 + 0.5));
    a.tail.rotation.z = b.rot.z + 0.018 * Math.sin(t * 0.85);
  }

  // 5. Subtle bob on gently lifted right paw
  if (a.armR && a.armR.userData.base) {
    const b = a.armR.userData.base;
    a.armR.rotation.x = b.rot.x + 0.038 * Math.sin(t * 1.35 + 0.5);
    a.armR.rotation.z = b.rot.z + 0.022 * Math.sin(t * 0.9);
  }

  // 6. Natural blink every ~3.9 seconds (with occasional double blink)
  const blinkCycle = 3.9;
  const cycleIdx = Math.floor(t / blinkCycle);
  const p = t % blinkCycle;
  let blinkAmt = 0;
  if (p > 3.42 && p < 3.62) {
    blinkAmt = Math.sin(((p - 3.42) / 0.20) * Math.PI);
  } else if (cycleIdx % 3 === 2 && p > 3.68 && p < 3.86) {
    blinkAmt = Math.sin(((p - 3.68) / 0.18) * Math.PI);
  }
  const eyeScaleY = 1.0 - 0.92 * blinkAmt;

  if (a.eyeL && a.eyeL.userData.base) {
    a.eyeL.scale.y = a.eyeL.userData.base.scale.y * eyeScaleY;
  }
  if (a.eyeR && a.eyeR.userData.base) {
    a.eyeR.scale.y = a.eyeR.userData.base.scale.y * eyeScaleY;
  }

  // 7. Gentle collar charm motion
  if (a.bellCharm && a.bellCharm.userData.base) {
    const b = a.bellCharm.userData.base;
    a.bellCharm.rotation.z = b.rot.z + 0.055 * Math.sin(t * 2.05 - 0.6);
    a.bellCharm.rotation.x = b.rot.x + 0.03 * breath;
  }
  if (a.bowCharm && a.bowCharm.userData.base) {
    const b = a.bowCharm.userData.base;
    a.bowCharm.position.y = b.pos.y + 0.0012 * breath;
    a.bowCharm.rotation.z = b.rot.z + 0.025 * Math.sin(t * 0.72 + 0.4);
  }
}
const HEAD_CY = 0.165;
const HEAD_RX = 0.18;
const HEAD_RY = 0.17;
const HEAD_RZ = 0.165;

const EXCLUDE_SCALE = 1.02;
const SHOULDER_X = 0.105;
const SHOULDER_Y = -0.07;
const SHOULDER_R = 0.045;
const NECK_TOP_Y = 0.01;
const NECK_R = 0.042;

const LOCK_SEG_AROUND = 16;
const LOCK_SEG_ALONG = 24;
const CAP_SEG_U = 64;
const CAP_SEG_V = 48;

const WHORL_THETA = 0.16;
const WHORL_PHI = Math.PI - 0.14;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(t) {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

// Deterministic [0, 1) variation for organic lock spacing, width, and tip height
function hash(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

// Generate organically spaced azimuths between phiMin and phiMax (endpoints anchored)
function irregularAngles(count, phiMin, phiMax, seed, jitterFrac = 0.24) {
  if (count <= 1) return [(phiMin + phiMax) * 0.5];
  const step = (phiMax - phiMin) / (count - 1);
  const out = [];
  for (let i = 0; i < count; i++) {
    let a = lerp(phiMin, phiMax, i / (count - 1));
    if (i > 0 && i < count - 1) {
      a += (hash(seed + i * 3.17) - 0.5) * step * jitterFrac * 2;
    }
    out.push(a);
  }
  return out;
}

// Thick rounded hair-cap radial profile: 1.10 at front hairline swelling to 1.12 at crown & back
function capScaleAt(theta, phi, baseScale = 1.10) {
  const backF = smoothstep((Math.abs(phi) - 0.45) / 2.25);
  const crownF = Math.cos(clamp(theta * 0.78, 0, Math.PI * 0.5));
  const midRound = Math.sin(clamp(theta * 0.92, 0, Math.PI));
  return baseScale + 0.02 * Math.max(crownF, backF * 0.88) + 0.006 * midRound * backF;
}

// Head-centered ellipsoid point:
// theta: 0 at crown (+y), PI/2 at equator (y=0.165), PI at chin
// phi: 0 at front (+z), +PI/2 at right (+x), -PI/2 at left (-x), PI at back (-z)
function headPt(THREE, theta, phi, scale = 1.11, dx = 0, dy = 0, dz = 0) {
  const st = Math.sin(theta);
  const ct = Math.cos(theta);
  const sp = Math.sin(phi);
  const cp = Math.cos(phi);
  return new THREE.Vector3(
    st * sp * HEAD_RX * scale + dx,
    HEAD_CY + ct * HEAD_RY * scale + dy,
    st * cp * HEAD_RZ * scale + dz
  );
}

// Point radiating gently from the crown whorl with a soft organic spiral offset
function whorlPt(THREE, phi, scale = 1.112, offset = 0.016) {
  const c = headPt(THREE, WHORL_THETA, WHORL_PHI, scale);
  const swirl = phi - 0.22;
  c.x += Math.sin(swirl) * offset;
  c.z += Math.cos(swirl) * offset;
  return c;
}

// Convert target world Y on front/side/back cap surface to polar angle theta
function yToTheta(y, scale = 1.11) {
  return Math.acos(clamp((y - HEAD_CY) / (HEAD_RY * scale), -0.999, 0.999));
}

// Full hairline around azimuth |phi| in [0, PI]: covers temples and nape deeply while staying off eyes
const HAIRLINE_KNOTS = [
  [0.0, 0.232],
  [0.54, 0.228],
  [0.90, 0.194],
  [1.22, 0.124],
  [1.56, 0.132],
  [1.96, 0.070],
  [2.52, 0.048],
  [Math.PI, 0.042],
];

function hairlineY(phi) {
  const a = Math.abs(phi);
  for (let i = 0; i < HAIRLINE_KNOTS.length - 1; i++) {
    const [a0, y0] = HAIRLINE_KNOTS[i];
    const [a1, y1] = HAIRLINE_KNOTS[i + 1];
    if (a <= a1) {
      const t = smoothstep((a - a0) / (a1 - a0));
      return lerp(y0, y1, t);
    }
  }
  return HAIRLINE_KNOTS[HAIRLINE_KNOTS.length - 1][1];
}

// Keep any 3D vertex outside the head ellipsoid (scaled 1.02), neck, and shoulder capsule
function pushOutsideVolumes(v, margin = 0.0022) {
  const ex = HEAD_RX * EXCLUDE_SCALE + margin;
  const ey = HEAD_RY * EXCLUDE_SCALE + margin;
  const ez = HEAD_RZ * EXCLUDE_SCALE + margin;
  const nx = v.x / ex;
  const ny = (v.y - HEAD_CY) / ey;
  const nz = v.z / ez;
  const d2 = nx * nx + ny * ny + nz * nz;
  if (d2 < 1.0) {
    const inv = 1.0 / Math.max(Math.sqrt(d2), 1e-5);
    v.x = nx * inv * ex;
    v.y = HEAD_CY + ny * inv * ey;
    v.z = nz * inv * ez;
  }

  // Horizontal shoulder capsule from (-0.105, -0.07, 0) to (0.105, -0.07, 0), r = 0.045
  const sr = SHOULDER_R + margin + 0.002;
  const scx = clamp(v.x, -SHOULDER_X, SHOULDER_X);
  const sdx = v.x - scx;
  const sdy = v.y - SHOULDER_Y;
  const sdz = v.z;
  const sd2 = sdx * sdx + sdy * sdy + sdz * sdz;
  if (sd2 < sr * sr) {
    const sd = Math.sqrt(sd2);
    if (sd < 1e-5) {
      v.z += v.z >= 0 ? sr : -sr;
    } else {
      const k = sr / sd;
      v.x = scx + sdx * k;
      v.y = SHOULDER_Y + sdy * k;
      v.z = sdz * k;
    }
  }

  // Vertical neck capsule from (0, 0.01, 0) to (0, -0.07, 0), r = 0.042
  const nr = NECK_R + margin;
  const ncy = clamp(v.y, SHOULDER_Y, NECK_TOP_Y);
  const ndx = v.x;
  const ndy = v.y - ncy;
  const ndz = v.z;
  const nd2 = ndx * ndx + ndy * ndy + ndz * ndz;
  if (nd2 < nr * nr) {
    const nd = Math.sqrt(nd2);
    if (nd < 1e-5) {
      v.z += v.z >= 0 ? nr : -nr;
    } else {
      const k = nr / nd;
      v.x = ndx * k;
      v.y = ncy + ndy * k;
      v.z = ndz * k;
    }
  }
}

// Weld smooth normals across closed u-seam (col 0 == col cols)
function weldSeamNormals(geo, rows, cols) {
  const norm = geo.attributes.normal;
  const stride = cols + 1;
  for (let r = 0; r <= rows; r++) {
    const i0 = r * stride;
    const i1 = r * stride + cols;
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

// Build full, thick rounded hair-mass cap (1.10 to 1.12 at crown/back) with plump inward lip
function buildCapGeometry(THREE, baseScale = 1.10) {
  const segU = CAP_SEG_U;
  const segV = CAP_SEG_V;
  const lipRings = 10;
  const bodyRings = segV - lipRings;
  const innerScale = 0.995;
  const lipAngle = 0.068;

  const verts = [];
  const uvs = [];
  const indices = [];

  for (let iv = 0; iv <= segV; iv++) {
    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const phi = (u - 0.5) * Math.PI * 2;
      const yEdge = hairlineY(phi);
      const edgeScale = capScaleAt(1.5, phi, baseScale);
      const thetaEdge = yToTheta(yEdge, edgeScale);

      let theta;
      let s;
      if (iv <= bodyRings) {
        const tv = iv / bodyRings;
        theta = tv * (thetaEdge - lipAngle);
        s = capScaleAt(theta, phi, baseScale);
      } else {
        const alpha = ((iv - bodyRings) / lipRings) * Math.PI;
        const tBase = thetaEdge - lipAngle;
        const sOuter = capScaleAt(tBase, phi, baseScale);
        theta = tBase + lipAngle * Math.sin(alpha);
        s = innerScale + (sOuter - innerScale) * 0.5 * (1 + Math.cos(alpha));
      }

      const st = Math.sin(theta);
      const ct = Math.cos(theta);
      const sp = Math.sin(phi);
      const cp = Math.cos(phi);
      verts.push(
        st * sp * HEAD_RX * s,
        HEAD_CY + ct * HEAD_RY * s,
        st * cp * HEAD_RZ * s
      );
      uvs.push(u, iv / segV);
    }
  }

  const stride = segU + 1;
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * stride + iu;
      const b = a + 1;
      const c = (iv + 1) * stride + iu;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  weldSeamNormals(geo, segV, segU);

  const norm = geo.attributes.normal;
  for (let iu = 0; iu <= segU; iu++) {
    norm.setXYZ(iu, 0, 1, 0);
  }
  norm.needsUpdate = true;
  return geo;
}

// Non-uniform u table (24 segments) packed softly at root & rounded tip
const LOCK_U_TABLE = (() => {
  const us = [0.0, 0.024];
  const bodyCount = LOCK_SEG_ALONG - 5;
  for (let i = 0; i < bodyCount; i++) {
    us.push(lerp(0.06, 0.90, i / (bodyCount - 1)));
  }
  us.push(0.935, 0.965, 0.988, 1.0);
  return us;
})();

// Build one plump, clay-like tapered elliptical tube along a CatmullRomCurve3
function createLock(THREE, mat, swayItems, cfg) {
  const {
    points,
    width = 0.088,
    thick = 0.038,
    swell = 1.12,
    rootTaper = 0.72,
    tipRound = 0.28,
    twist = 0,
    swayAmp = 0.050,
    swayFreq = 1.85,
    phase = 0,
    outSign = 0,
    backSign = 0,
    collide = true,
  } = cfg;

  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
  const segA = LOCK_SEG_AROUND;
  const segL = LOCK_SEG_ALONG;
  const rootPos = points[0].clone();

  const centers = [];
  const tangents = [];
  for (let i = 0; i <= segL; i++) {
    const u = LOCK_U_TABLE[i];
    centers.push(curve.getPoint(u));
    tangents.push(curve.getTangent(u).normalize());
  }

  // Parallel-transport (Bishop) frame starting from head-outward normal at root
  const headCenter = new THREE.Vector3(0, HEAD_CY, 0);
  const N = centers[0].clone().sub(headCenter);
  N.y *= 0.85;
  if (N.lengthSq() < 1e-6) N.set(0, 1, 0);
  N.addScaledVector(tangents[0], -N.dot(tangents[0]));
  if (N.lengthSq() < 1e-5) {
    N.set(0, 0, 1);
    N.addScaledVector(tangents[0], -N.dot(tangents[0]));
    if (N.lengthSq() < 1e-5) {
      N.set(1, 0, 0);
      N.addScaledVector(tangents[0], -N.dot(tangents[0]));
    }
  }
  N.normalize();

  const normals = [N.clone()];
  const binormals = [new THREE.Vector3().crossVectors(N, tangents[0]).normalize()];
  const tmpAxis = new THREE.Vector3();

  for (let i = 1; i <= segL; i++) {
    const prevT = tangents[i - 1];
    const currT = tangents[i];
    const currN = normals[i - 1].clone();
    tmpAxis.crossVectors(prevT, currT);
    const sinA = tmpAxis.length();
    if (sinA > 1e-6) {
      tmpAxis.divideScalar(sinA);
      const cosA = clamp(prevT.dot(currT), -1, 1);
      currN.applyAxisAngle(tmpAxis, Math.atan2(sinA, cosA));
    }
    currN.addScaledVector(currT, -currN.dot(currT));
    if (currN.lengthSq() > 1e-8) currN.normalize();
    normals.push(currN);
    binormals.push(new THREE.Vector3().crossVectors(currN, currT).normalize());
  }

  const rxBase = width * 0.5;
  const ryBase = thick * 0.5;
  const verts = [];
  const uvs = [];
  const indices = [];
  const tmpV = new THREE.Vector3();
  const nFrame = new THREE.Vector3();
  const bFrame = new THREE.Vector3();

  for (let i = 0; i <= segL; i++) {
    const u = LOCK_U_TABLE[i];
    let envW;
    let envT;
    if (u <= 0.38) {
      const k = smoothstep(u / 0.38);
      envW = lerp(rootTaper, swell, k);
      envT = lerp(rootTaper, swell * 0.96, k);
    } else {
      const k = smoothstep((u - 0.38) / (0.90 - 0.38));
      envW = lerp(swell, tipRound, k);
      envT = lerp(swell * 0.96, tipRound * 1.28, k);
    }

    let capEnv = 1.0;
    if (u < 0.06) {
      capEnv = Math.sin((u / 0.06) * Math.PI * 0.5);
    } else if (u > 0.90) {
      const kt = (u - 0.90) / 0.10;
      capEnv = Math.sqrt(Math.max(0, 1 - kt * kt));
    }

    const rx = rxBase * envW * capEnv;
    const ry = ryBase * envT * capEnv;

    const tw = twist * u;
    const ctw = Math.cos(tw);
    const stw = Math.sin(tw);
    nFrame.copy(normals[i]).multiplyScalar(ctw).addScaledVector(binormals[i], stw);
    bFrame.copy(binormals[i]).multiplyScalar(ctw).addScaledVector(normals[i], -stw);

    const ctr = centers[i];
    for (let j = 0; j <= segA; j++) {
      const a = (j / segA) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      tmpV.copy(ctr)
        .addScaledVector(bFrame, rx * ca)
        .addScaledVector(nFrame, ry * sa);
      if (collide) pushOutsideVolumes(tmpV);
      verts.push(tmpV.x - rootPos.x, tmpV.y - rootPos.y, tmpV.z - rootPos.z);
      uvs.push(j / segA, u);
    }
  }

  const stride = segA + 1;
  for (let i = 0; i < segL; i++) {
    for (let j = 0; j < segA; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = (i + 1) * stride + j;
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  weldSeamNormals(geo, segL, segA);

  const norm = geo.attributes.normal;
  const t0 = tangents[0];
  const t1 = tangents[segL];
  for (let j = 0; j <= segA; j++) {
    norm.setXYZ(j, -t0.x, -t0.y, -t0.z);
    norm.setXYZ(segL * stride + j, t1.x, t1.y, t1.z);
  }
  norm.needsUpdate = true;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(rootPos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  if (swayAmp > 0) {
    swayItems.push({
      mesh,
      ampZ: swayAmp,
      ampX: swayAmp * 0.55,
      freq: swayFreq,
      phase,
      outSign,
      backSign,
    });
  }
  return mesh;
}

// Plump clay hair tie / wrapped band
function createBand(THREE, mat, center, axisDir, majorR, tubeR) {
  const geo = new THREE.TorusGeometry(majorR, tubeR, 14, 32);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(center);
  const dir = axisDir.clone().normalize();
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Small antenna curl (ahoge) at the crown
function addAntenna(THREE, group, mat, swayItems) {
  const pts = [
    new THREE.Vector3(0.0, HEAD_CY + HEAD_RY * 1.09, 0.006),
    new THREE.Vector3(0.003, HEAD_CY + HEAD_RY * 1.28, 0.014),
    new THREE.Vector3(0.019, HEAD_CY + HEAD_RY * 1.42, 0.020),
    new THREE.Vector3(0.044, HEAD_CY + HEAD_RY * 1.38, 0.024),
    new THREE.Vector3(0.052, HEAD_CY + HEAD_RY * 1.25, 0.020),
  ];
  group.add(createLock(THREE, mat, swayItems, {
    points: pts,
    width: 0.026,
    thick: 0.022,
    swell: 1.05,
    rootTaper: 0.92,
    tipRound: 0.34,
    swayAmp: 0.068,
    swayFreq: 2.35,
    phase: 0.4,
    outSign: 1,
    backSign: 0,
    collide: true,
  }));
}

// Fringe: 8 overlapping locks covering the full forehead down to 0.195 with soft serrated edge
// Outer locks blend smoothly into side hair so there is no bare temple, while staying off the eyes
function addFringe(THREE, group, mat, swayItems, fringeType) {
  if (!fringeType || fringeType === 'none') return;

  const addStrand = (phi0, phi1, phi2, phiTip, yTip, w, th, lift, ph, outSign) => {
    const sMid = 1.135 + lift;
    const sTip = 1.150 + lift;
    const yMid1 = lerp(0.338, yTip, 0.38);
    const yMid2 = lerp(0.338, yTip, 0.74);
    const pts = [
      headPt(THREE, 0.24, phi0, 1.105 + lift * 0.4),
      headPt(THREE, yToTheta(yMid1, sMid), phi1, sMid),
      headPt(THREE, yToTheta(yMid2, sMid), phi2, sMid + 0.012),
      headPt(THREE, yToTheta(yTip, sTip), phiTip, sTip),
    ];
    group.add(createLock(THREE, mat, swayItems, {
      points: pts,
      width: w,
      thick: th,
      swell: 1.12,
      rootTaper: 0.68,
      tipRound: 0.25,
      swayAmp: 0.036,
      swayFreq: 1.9 + (ph % 0.4),
      phase: ph,
      outSign,
      backSign: -1,
    }));
  };

  if (fringeType === 'full') {
    // 6 broad overlapping locks across forehead + temples, plus 2 narrow detail wisps on top
    const specs = [
      // Outer temple blenders (|phiTip| >= 0.88, outside eyes, merging into side hair)
      [-0.58, -0.72, -0.84, -0.94, 0.176, 0.082, 0.036, 0.0, 0.4, -1],
      [0.58, 0.73, 0.85, 0.95, 0.178, 0.082, 0.036, 0.0, 1.0, 1],
      // Broad main bangs across forehead down to 0.195..0.209 with soft serrated edge
      [-0.36, -0.46, -0.56, -0.66, 0.203, 0.088, 0.038, 0.006, 1.7, -1],
      [-0.14, -0.20, -0.25, -0.32, 0.195, 0.092, 0.039, 0.010, 2.4, -1],
      [0.10, 0.14, 0.08, 0.03, 0.198, 0.094, 0.040, 0.012, 3.1, 1],
      [0.34, 0.44, 0.54, 0.64, 0.196, 0.088, 0.038, 0.007, 3.8, 1],
      // Narrow detail locks laid proudly on top for crisp clay serration
      [-0.22, -0.30, -0.39, -0.47, 0.206, 0.042, 0.024, 0.022, 4.5, -1],
      [0.18, 0.25, 0.32, 0.39, 0.208, 0.044, 0.025, 0.022, 5.2, 1],
    ];
    for (const s of specs) addStrand(...s);
  } else if (fringeType === 'sideSwept') {
    // 6 broad sweeping locks + 2 narrow top wisps covering both temples cleanly
    const specs = [
      [-0.56, -0.70, -0.82, -0.94, 0.178, 0.082, 0.036, 0.0, 0.3, -1],
      [-0.44, -0.52, -0.60, -0.68, 0.208, 0.080, 0.036, 0.005, 1.1, -1],
      [-0.36, -0.22, -0.08, 0.04, 0.202, 0.090, 0.039, 0.010, 1.9, 1],
      [-0.18, 0.00, 0.18, 0.32, 0.195, 0.094, 0.040, 0.012, 2.7, 1],
      [0.04, 0.24, 0.42, 0.58, 0.198, 0.090, 0.038, 0.008, 3.5, 1],
      [0.32, 0.54, 0.74, 0.94, 0.178, 0.084, 0.036, 0.002, 4.3, 1],
      // Narrow detail wisps on top
      [-0.26, -0.10, 0.06, 0.20, 0.207, 0.042, 0.024, 0.022, 5.0, 1],
      [0.14, 0.34, 0.52, 0.70, 0.205, 0.044, 0.025, 0.020, 5.7, 1],
    ];
    for (const s of specs) addStrand(...s);
  } else if (fringeType === 'curtain') {
    // 8 overlapping parted locks (3 broad + 1 narrow detail per side), sweeping into side hair
    for (const side of [-1, 1]) {
      const b = side > 0 ? 0.5 : 3.2;
      addStrand(side * 0.04, side * 0.11, side * 0.20, side * 0.29, 0.206, 0.082, 0.036, 0.010, b, side);
      addStrand(side * 0.16, side * 0.28, side * 0.41, side * 0.54, 0.197, 0.090, 0.039, 0.008, b + 0.8, side);
      addStrand(side * 0.36, side * 0.54, side * 0.74, side * 0.94, 0.176, 0.086, 0.037, 0.002, b + 1.6, side);
      addStrand(side * 0.22, side * 0.38, side * 0.54, side * 0.70, 0.201, 0.044, 0.025, 0.022, b + 2.4, side);
    }
  }
}

// Style: BOB — 30 locks in 3 overlapping roof-tile layers (under nape, mid jaw-flip, crown whorl + details)
function addBob(THREE, group, mat, swayItems) {
  // Layer 1 (Under): 8 broad overlapping locks at nape & behind ears with clean upturned tips
  const underPhis = irregularAngles(8, Math.PI - 1.62, Math.PI + 1.62, 11, 0.22);
  for (let i = 0; i < underPhis.length; i++) {
    const phi = underPhis[i];
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    const h = hash(101 + i * 2.3);
    const yTip = lerp(0.016, 0.046, h);
    const flare = lerp(0.024, 0.040, hash(131 + i));
    const p0 = headPt(THREE, 1.18 + h * 0.14, phi, 1.095);
    const p1 = headPt(THREE, 1.72, phi, 1.115);
    const p2 = headPt(THREE, yToTheta(yTip + 0.012, 1.12), phi, 1.12);
    p2.y = yTip;
    const p3 = p2.clone();
    p3.x += sp * flare;
    p3.z += cp * flare;
    p3.y = yTip + 0.016 + h * 0.008;

    group.add(createLock(THREE, mat, swayItems, {
      points: [p0, p1, p2, p3],
      width: lerp(0.088, 0.108, hash(151 + i)),
      thick: 0.040,
      swell: 1.12,
      tipRound: 0.30,
      swayAmp: 0.045,
      swayFreq: 1.75 + (i % 3) * 0.14,
      phase: i * 0.85,
      outSign: sp >= 0 ? 1 : -1,
      backSign: 1,
    }));
  }

  // Layer 2 (Middle): 10 broad locks wrapping from cheeks/temples around ears and back with bob flicks
  const midPhis = irregularAngles(10, Math.PI - 2.24, Math.PI + 2.24, 23, 0.22);
  for (let i = 0; i < midPhis.length; i++) {
    const phi = midPhis[i];
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    const h = hash(201 + i * 3.1);
    const sideBoost = smoothstep((Math.abs(sp) - 0.65) / 0.35);
    const yTip = lerp(0.032, 0.072, h) + sideBoost * 0.018;
    const flare = lerp(0.036, 0.056, hash(221 + i)) + sideBoost * 0.014;
    const drift = (hash(241 + i) - 0.5) * 0.12;

    const p0 = headPt(THREE, 0.62 + h * 0.14, phi, 1.105);
    const p1 = headPt(THREE, 1.24, phi + drift * 0.4, 1.142);
    const p2 = headPt(THREE, 1.78, phi + drift * 0.8, 1.158);
    const p3 = headPt(THREE, yToTheta(yTip, 1.155), phi + drift, 1.155);
    p3.y = yTip;
    const p4 = p3.clone();
    p4.x += sp * flare;
    p4.z += cp * flare;
    p4.y = yTip + 0.022 + sideBoost * 0.012;

    group.add(createLock(THREE, mat, swayItems, {
      points: [p0, p1, p2, p3, p4],
      width: lerp(0.084, 0.104, hash(261 + i)),
      thick: 0.038,
      swell: 1.14,
      tipRound: 0.30,
      swayAmp: 0.054,
      swayFreq: 1.85 + (i % 3) * 0.12,
      phase: i * 0.78 + 0.4,
      outSign: sp >= 0 ? 1 : -1,
      backSign: cp < 0 ? 1 : -1,
    }));
  }

  // Layer 3 (Top): 8 broad crown-whorl locks + 4 narrow detail locks layered on top
  const topPhis = irregularAngles(8, Math.PI - 2.30, Math.PI + 2.30, 37, 0.24);
  for (let i = 0; i < topPhis.length; i++) {
    const phi = topPhis[i];
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    const h = hash(301 + i * 2.9);
    const yTip = lerp(0.052, 0.098, h);
    const flare = lerp(0.034, 0.052, hash(321 + i));

    const p0 = whorlPt(THREE, phi, 1.112, 0.016);
    const p1 = headPt(THREE, 0.56, phi, 1.155);
    const p2 = headPt(THREE, 1.22, phi, 1.168);
    const p3 = headPt(THREE, yToTheta(yTip, 1.168), phi, 1.168);
    p3.y = yTip;
    const p4 = p3.clone();
    p4.x += sp * flare;
    p4.z += cp * flare;
    p4.y = yTip + 0.020;

    group.add(createLock(THREE, mat, swayItems, {
      points: [p0, p1, p2, p3, p4],
      width: lerp(0.080, 0.096, hash(341 + i)),
      thick: 0.035,
      swell: 1.12,
      rootTaper: 0.62,
      tipRound: 0.28,
      swayAmp: 0.050,
      swayFreq: 1.95 + (i % 3) * 0.14,
      phase: i * 0.92 + 0.9,
      outSign: sp >= 0 ? 1 : -1,
      backSign: cp < 0 ? 1 : -1,
    }));
  }

  // 4 narrow detail locks laid on top for sculptural clay definition
  const detailPhis = [Math.PI - 2.05, Math.PI - 0.82, Math.PI + 0.74, Math.PI + 2.08];
  for (let i = 0; i < detailPhis.length; i++) {
    const phi = detailPhis[i];
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    const h = hash(381 + i * 4.1);
    const yTip = lerp(0.062, 0.106, h);
    const p0 = whorlPt(THREE, phi, 1.118, 0.020);
    const p1 = headPt(THREE, 0.62, phi, 1.174);
    const p2 = headPt(THREE, 1.30, phi + (i % 2 ? 0.08 : -0.08), 1.186);
    const p3 = headPt(THREE, yToTheta(yTip, 1.188), phi + (i % 2 ? 0.12 : -0.12), 1.190);
    p3.x += sp * 0.044;
    p3.z += cp * 0.044;
    p3.y = yTip + 0.018;

    group.add(createLock(THREE, mat, swayItems, {
      points: [p0, p1, p2, p3],
      width: lerp(0.038, 0.048, h),
      thick: 0.024,
      swell: 1.08,
      rootTaper: 0.60,
      tipRound: 0.28,
      swayAmp: 0.058,
      swayFreq: 2.15,
      phase: i * 1.4 + 0.3,
      outSign: sp >= 0 ? 1 : -1,
      backSign: cp < 0 ? 1 : -1,
    }));
  }
}

// Style: LONG STRAIGHT & LONG WAVY — 32 locks in 3 layers forming a continuous back curtain + front drapes
function addLongHair(THREE, group, mat, swayItems, wavy) {
  const buildCurtainLock = (p0, p1, p2, xBase, zBase, yEnd, width, thick, phaseW, swayAmp, outSign, backSign, lift = 0) => {
    const pts = [p0, p1, p2];
    const steps = wavy ? 6 : 4;
    for (let s = 1; s <= steps; s++) {
      const k = s / steps;
      const y = lerp(p2.y, yEnd, k);
      const spread = 1.0 + k * 0.13;
      let wx = xBase * spread;
      let wz = lerp(p2.z, zBase - 0.022 - lift, k);
      if (wavy) {
        const wave = Math.sin(k * Math.PI * 2.5 + phaseW) * (0.016 + 0.018 * k);
        const waveZ = Math.cos(k * Math.PI * 2.5 + phaseW) * (0.012 + 0.013 * k);
        wx += wave;
        wz += waveZ - 0.010 * k;
      } else {
        wz -= Math.sin(k * Math.PI) * 0.012;
      }
      pts.push(new THREE.Vector3(wx, y, wz));
    }
    group.add(createLock(THREE, mat, swayItems, {
      points: pts,
      width,
      thick,
      swell: 1.10,
      rootTaper: 0.68,
      tipRound: 0.26,
      swayAmp,
      swayFreq: 1.52 + (phaseW % 0.36),
      phase: phaseW,
      outSign,
      backSign,
    }));
  };

  // Layer 1 (Under): 9 broad overlapping locks forming a solid continuous back curtain to the waist
  const underPhis = irregularAngles(9, Math.PI - 1.54, Math.PI + 1.54, 41, 0.20);
  for (let i = 0; i < underPhis.length; i++) {
    const phi = underPhis[i];
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    const edge = Math.abs((phi - Math.PI) / 1.54);
    const h = hash(401 + i * 2.7);
    const yEnd = lerp(-0.345, -0.275, edge * edge) + (h - 0.5) * 0.068;
    const p0 = headPt(THREE, 1.12 + h * 0.14, phi, 1.095);
    const p1 = headPt(THREE, 1.56, phi, 1.122);
    const p2 = headPt(THREE, 1.92, phi, 1.132);
    const xBase = sp * 0.192;
    const zBase = Math.min(-0.128, cp * 0.186);
    buildCurtainLock(
      p0, p1, p2, xBase, zBase, yEnd,
      lerp(0.092, 0.110, hash(421 + i)), 0.040,
      i * 0.78, 0.056, sp >= 0 ? 1 : -1, 1, 0
    );
  }

  // Layer 2 (Middle): 6 broad mid-back curtain locks + 2 behind-ear bridges + 2 shoulder-front drapes
  const midBackPhis = irregularAngles(6, Math.PI - 1.38, Math.PI + 1.38, 53, 0.24);
  for (let i = 0; i < midBackPhis.length; i++) {
    const phi = midBackPhis[i];
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    const edge = Math.abs((phi - Math.PI) / 1.38);
    const h = hash(501 + i * 3.3);
    const yEnd = lerp(-0.305, -0.235, edge * edge) + (h - 0.5) * 0.064;
    const p0 = headPt(THREE, 0.62 + h * 0.14, phi, 1.105);
    const p1 = headPt(THREE, 1.24, phi, 1.148);
    const p2 = headPt(THREE, 1.82, phi, 1.158);
    const xBase = sp * 0.200;
    const zBase = Math.min(-0.142, cp * 0.198);
    buildCurtainLock(
      p0, p1, p2, xBase, zBase, yEnd,
      lerp(0.086, 0.104, hash(521 + i)), 0.038,
      i * 0.92 + 0.5, 0.062, sp >= 0 ? 1 : -1, 1, 0.012
    );
  }

  for (const side of [-1, 1]) {
    // Behind-ear side bridge lock (keeps side view completely continuous)
    const bPhi = side * 1.46;
    const p0 = headPt(THREE, 0.64, bPhi, 1.105);
    const p1 = headPt(THREE, 1.26, bPhi, 1.145);
    const ptsB = [p0, p1];
    const steps = wavy ? 5 : 4;
    const yEndB = side > 0 ? -0.238 : -0.212;
    for (let s = 1; s <= steps; s++) {
      const k = s / steps;
      let wx = side * lerp(0.206, 0.178, k);
      let wz = lerp(-0.018, -0.112, k);
      if (wavy) {
        wx += side * Math.sin(k * Math.PI * 2.3 + side) * 0.020;
        wz += Math.cos(k * Math.PI * 2.3 + side) * 0.014;
      }
      ptsB.push(new THREE.Vector3(wx, lerp(p1.y, yEndB, k), wz));
    }
    group.add(createLock(THREE, mat, swayItems, {
      points: ptsB,
      width: 0.086,
      thick: 0.037,
      swell: 1.11,
      tipRound: 0.26,
      swayAmp: 0.058,
      swayFreq: 1.72,
      phase: side > 0 ? 1.3 : 3.1,
      outSign: side,
      backSign: 1,
    }));

    // Shoulder-front face-framing drape (outside shoulders and off eyes)
    const f0 = headPt(THREE, 0.56, side * 0.92, 1.105);
    const f1 = headPt(THREE, 1.24, side * 1.02, 1.148);
    const ptsF = [f0, f1];
    const yEndF = (wavy ? -0.210 : -0.198) + (side > 0 ? -0.014 : 0.012);
    for (let s = 1; s <= steps; s++) {
      const k = s / steps;
      let wx = side * lerp(0.200, 0.148, k);
      let wz = lerp(0.088, 0.106, Math.sin(k * Math.PI * 0.65));
      if (wavy) {
        wx += side * Math.sin(k * Math.PI * 2.4 + 0.5) * 0.020;
        wz += Math.cos(k * Math.PI * 2.4) * 0.012;
      }
      ptsF.push(new THREE.Vector3(wx, lerp(f1.y, yEndF, k), wz));
    }
    group.add(createLock(THREE, mat, swayItems, {
      points: ptsF,
      width: 0.084,
      thick: 0.036,
      swell: 1.12,
      tipRound: 0.28,
      swayAmp: 0.060,
      swayFreq: 1.88,
      phase: side > 0 ? 0.6 : 2.5,
      outSign: side,
      backSign: -1,
    }));
  }

  // Layer 3 (Top): 8 broad crown-whorl locks + 5 narrow detail strands layered on top
  const topPhis = irregularAngles(8, Math.PI - 2.24, Math.PI + 2.24, 67, 0.24);
  for (let i = 0; i < topPhis.length; i++) {
    const phi = topPhis[i];
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    const h = hash(601 + i * 2.9);
    const isFrontSide = cp > -0.15;
    const yEnd = isFrontSide ? lerp(-0.14, -0.06, h) : lerp(-0.24, -0.15, h);
    const p0 = whorlPt(THREE, phi, 1.112, 0.016);
    const p1 = headPt(THREE, 0.58, phi, 1.158);
    const p2 = headPt(THREE, 1.38, phi, 1.170);
    const xBase = sp * (isFrontSide ? 0.202 : 0.206);
    const zBase = isFrontSide ? Math.max(0.065, cp * 0.185) : Math.min(-0.148, cp * 0.205);
    buildCurtainLock(
      p0, p1, p2, xBase, zBase, yEnd,
      lerp(0.082, 0.096, hash(621 + i)), 0.035,
      i * 0.88 + 1.2, 0.060, sp >= 0 ? 1 : -1, cp < 0 ? 1 : -1, isFrontSide ? -0.015 : 0.022
    );
  }

  // 5 narrow detail locks laid on top across sides & back
  const detailPhis = irregularAngles(5, Math.PI - 2.02, Math.PI + 2.02, 79, 0.28);
  for (let i = 0; i < detailPhis.length; i++) {
    const phi = detailPhis[i];
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    const h = hash(661 + i * 3.7);
    const isSide = cp > -0.25;
    const yEnd = isSide ? lerp(-0.16, -0.08, h) : lerp(-0.28, -0.18, h);
    const p0 = whorlPt(THREE, phi, 1.118, 0.020);
    const p1 = headPt(THREE, 0.62, phi, 1.176);
    const p2 = headPt(THREE, 1.44, phi + (i % 2 ? 0.06 : -0.06), 1.188);
    const xBase = sp * 0.210;
    const zBase = isSide ? cp * 0.195 : Math.min(-0.162, cp * 0.214);
    buildCurtainLock(
      p0, p1, p2, xBase, zBase, yEnd,
      lerp(0.036, 0.048, h), 0.024,
      i * 1.15 + 0.4, 0.064, sp >= 0 ? 1 : -1, cp < 0 ? 1 : -1, isSide ? -0.012 : 0.032
    );
  }
}

// Style: SHORT LAYERED — 23 locks in 3 layers with clean upturned nape and tousled clay volume
function addShortLayered(THREE, group, mat, swayItems) {
  // Layer 1 (Under): 7 broad locks forming a clean nape with small upturned tips
  const underPhis = irregularAngles(7, Math.PI - 1.66, Math.PI + 1.66, 83, 0.22);
  for (let i = 0; i < underPhis.length; i++) {
    const phi = underPhis[i];
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    const h = hash(701 + i * 2.9);
    const yTip = lerp(0.036, 0.066, h);
    const flick = lerp(0.022, 0.034, hash(721 + i));
    const p0 = headPt(THREE, 1.18 + h * 0.14, phi, 1.095);
    const p1 = headPt(THREE, 1.68, phi, 1.118);
    const p2 = headPt(THREE, yToTheta(yTip + 0.010, 1.122), phi, 1.122);
    p2.y = yTip;
    const p3 = p2.clone();
    p3.x += sp * flick;
    p3.z += cp * flick;
    p3.y = yTip + 0.016;

    group.add(createLock(THREE, mat, swayItems, {
      points: [p0, p1, p2, p3],
      width: lerp(0.086, 0.104, hash(741 + i)),
      thick: 0.038,
      swell: 1.13,
      tipRound: 0.28,
      swayAmp: 0.044,
      swayFreq: 1.95 + (i % 3) * 0.14,
      phase: i * 0.9,
      outSign: sp >= 0 ? 1 : -1,
      backSign: 1,
    }));
  }

  // Layer 2 (Middle): 8 broad tousled tufts around temples, sides & back
  const midPhis = irregularAngles(8, Math.PI - 2.26, Math.PI + 2.26, 97, 0.24);
  for (let i = 0; i < midPhis.length; i++) {
    const phi = midPhis[i];
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    const h = hash(761 + i * 3.1);
    const yTip = lerp(0.064, 0.112, h);
    const twistDir = (i % 2 === 0 ? 1 : -1) * 0.11;
    const flick = lerp(0.028, 0.046, hash(781 + i));

    const p0 = headPt(THREE, 0.66 + h * 0.16, phi, 1.105);
    const p1 = headPt(THREE, 1.24, phi + twistDir * 0.5, 1.145);
    const p2 = headPt(THREE, yToTheta(yTip, 1.158), phi + twistDir, 1.158);
    p2.y = yTip;
    const p3 = p2.clone();
    p3.x += sp * flick + cp * twistDir * 0.10;
    p3.z += cp * flick - sp * twistDir * 0.10;
    p3.y = yTip + 0.015 + (h - 0.3) * 0.012;

    group.add(createLock(THREE, mat, swayItems, {
      points: [p0, p1, p2, p3],
      width: lerp(0.082, 0.098, hash(801 + i)),
      thick: 0.036,
      swell: 1.14,
      tipRound: 0.28,
      swayAmp: 0.048,
      swayFreq: 2.05 + (i % 3) * 0.14,
      phase: i * 0.85 + 0.5,
      outSign: sp >= 0 ? 1 : -1,
      backSign: cp < 0 ? 1 : -1,
    }));
  }

  // Layer 3 (Top): 5 broad crown-whorl tufts + 3 narrow detail tufts laid on top
  const topPhis = irregularAngles(5, Math.PI - 2.22, Math.PI + 2.22, 107, 0.26);
  for (let i = 0; i < topPhis.length; i++) {
    const phi = topPhis[i];
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    const h = hash(821 + i * 2.7);
    const swayDrift = (h - 0.5) * 0.24;
    const p0 = whorlPt(THREE, phi, 1.112, 0.016);
    const p1 = headPt(THREE, 0.58, phi + swayDrift * 0.4, 1.158);
    const p2 = headPt(THREE, 1.18 + h * 0.26, phi + swayDrift, 1.174);
    const p3 = p2.clone();
    p3.x += sp * 0.036;
    p3.z += cp * 0.036;
    p3.y += 0.010 + (h - 0.5) * 0.016;

    group.add(createLock(THREE, mat, swayItems, {
      points: [p0, p1, p2, p3],
      width: lerp(0.080, 0.094, hash(841 + i)),
      thick: 0.034,
      swell: 1.13,
      rootTaper: 0.62,
      tipRound: 0.28,
      swayAmp: 0.044,
      swayFreq: 2.15,
      phase: i * 1.05 + 0.3,
      outSign: sp >= 0 ? 1 : -1,
      backSign: cp < 0 ? 1 : -1,
    }));
  }

  const detailPhis = [Math.PI - 1.68, Math.PI + 0.18, Math.PI + 1.72];
  for (let i = 0; i < detailPhis.length; i++) {
    const phi = detailPhis[i];
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    const h = hash(861 + i * 4.3);
    const p0 = whorlPt(THREE, phi, 1.118, 0.020);
    const p1 = headPt(THREE, 0.64, phi, 1.178);
    const p2 = headPt(THREE, 1.32 + h * 0.22, phi + (i % 2 ? 0.12 : -0.12), 1.192);
    const p3 = p2.clone();
    p3.x += sp * 0.038;
    p3.z += cp * 0.038;
    p3.y += 0.014;

    group.add(createLock(THREE, mat, swayItems, {
      points: [p0, p1, p2, p3],
      width: lerp(0.038, 0.048, h),
      thick: 0.024,
      swell: 1.08,
      rootTaper: 0.60,
      tipRound: 0.28,
      swayAmp: 0.050,
      swayFreq: 2.25,
      phase: i * 1.6,
      outSign: sp >= 0 ? 1 : -1,
      backSign: cp < 0 ? 1 : -1,
    }));
  }
}

// Style: PIXIE — 22 sleek sculpted locks in 3 layers with clean nape & small upturned tips
function addPixie(THREE, group, mat, swayItems) {
  // Layer 1 (Under): 7 broad nape locks hugging the skull cleanly with tiny upturned tips
  const underPhis = irregularAngles(7, Math.PI - 1.72, Math.PI + 1.72, 113, 0.20);
  for (let i = 0; i < underPhis.length; i++) {
    const phi = underPhis[i];
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    const h = hash(901 + i * 2.5);
    const yTip = lerp(0.036, 0.062, h);
    const p0 = headPt(THREE, 1.15 + h * 0.12, phi, 1.095);
    const p1 = headPt(THREE, 1.72, phi, 1.116);
    const p2 = headPt(THREE, yToTheta(yTip + 0.008, 1.112), phi, 1.112);
    p2.y = yTip;
    const p3 = p2.clone();
    p3.x += sp * 0.018;
    p3.z += cp * 0.018;
    p3.y = yTip + 0.013;

    group.add(createLock(THREE, mat, swayItems, {
      points: [p0, p1, p2, p3],
      width: lerp(0.084, 0.102, hash(921 + i)),
      thick: 0.035,
      swell: 1.10,
      tipRound: 0.28,
      swayAmp: 0.034,
      swayFreq: 1.9,
      phase: i * 0.85,
      outSign: sp >= 0 ? 1 : -1,
      backSign: 1,
    }));
  }

  // Layer 2 (Middle): 5 sleek back/over-ear layers + 2 forward-tapered cheek wisps
  const midPhis = irregularAngles(5, Math.PI - 1.65, Math.PI + 1.65, 127, 0.22);
  for (let i = 0; i < midPhis.length; i++) {
    const phi = midPhis[i];
    const sp = Math.sin(phi);
    const h = hash(941 + i * 3.1);
    const p0 = headPt(THREE, 0.62 + h * 0.12, phi, 1.105);
    const p1 = headPt(THREE, 1.24, phi, 1.136);
    const p2 = headPt(THREE, 1.78 + h * 0.18, phi, 1.132);
    const p3 = p2.clone();
    p3.x += sp * 0.016;
    p3.z += Math.cos(phi) * 0.016;
    p3.y += 0.010;

    group.add(createLock(THREE, mat, swayItems, {
      points: [p0, p1, p2, p3],
      width: lerp(0.082, 0.096, hash(961 + i)),
      thick: 0.034,
      swell: 1.10,
      tipRound: 0.28,
      swayAmp: 0.034,
      swayFreq: 1.95,
      phase: i * 0.9 + 0.4,
      outSign: sp >= 0 ? 1 : -1,
      backSign: 1,
    }));
  }

  for (const side of [-1, 1]) {
    group.add(createLock(THREE, mat, swayItems, {
      points: [
        headPt(THREE, 0.56, side * 0.92, 1.102),
        headPt(THREE, 1.22, side * 1.04, 1.135),
        headPt(THREE, 1.72, side * 0.98, 1.138),
        headPt(THREE, 1.96, side * 0.88, 1.132),
      ],
      width: 0.080,
      thick: 0.032,
      swell: 1.08,
      tipRound: 0.26,
      swayAmp: 0.036,
      swayFreq: 2.0,
      phase: side > 0 ? 0.6 : 2.1,
      outSign: side,
    }));
  }

  // Layer 3 (Top): 5 broad crown-whorl sleek layers + 3 narrow detail wisps
  const topPhis = irregularAngles(5, Math.PI - 2.18, Math.PI + 2.18, 139, 0.24);
  for (let i = 0; i < topPhis.length; i++) {
    const phi = topPhis[i];
    const sp = Math.sin(phi);
    const h = hash(981 + i * 2.9);
    const sweep = (sp >= 0 ? 1 : -1) * 0.24;
    const p0 = whorlPt(THREE, phi, 1.112, 0.015);
    const p1 = headPt(THREE, 0.60, phi + sweep * 0.4, 1.148);
    const p2 = headPt(THREE, 1.22 + h * 0.24, phi + sweep, 1.150);

    group.add(createLock(THREE, mat, swayItems, {
      points: [p0, p1, p2],
      width: lerp(0.080, 0.094, hash(995 + i)),
      thick: 0.032,
      swell: 1.12,
      rootTaper: 0.62,
      tipRound: 0.30,
      swayAmp: 0.034,
      swayFreq: 2.1,
      phase: i * 1.1,
      outSign: sp >= 0 ? 1 : -1,
      backSign: 1,
    }));
  }

  const detailPhis = [Math.PI - 1.55, Math.PI + 0.22, Math.PI + 1.60];
  for (let i = 0; i < detailPhis.length; i++) {
    const phi = detailPhis[i];
    const sp = Math.sin(phi);
    const h = hash(1011 + i * 3.7);
    const p0 = whorlPt(THREE, phi, 1.118, 0.018);
    const p1 = headPt(THREE, 0.66, phi, 1.164);
    const p2 = headPt(THREE, 1.38 + h * 0.22, phi + (sp >= 0 ? 0.16 : -0.16), 1.166);
    group.add(createLock(THREE, mat, swayItems, {
      points: [p0, p1, p2],
      width: lerp(0.036, 0.046, h),
      thick: 0.022,
      swell: 1.08,
      rootTaper: 0.60,
      tipRound: 0.28,
      swayAmp: 0.038,
      swayFreq: 2.2,
      phase: i * 1.5,
      outSign: sp >= 0 ? 1 : -1,
      backSign: 1,
    }));
  }
}

// Style: PONYTAIL — 28 locks (3 pulled-back scalp layers + 11 lush tail locks)
function addPonytail(THREE, group, mat, swayItems) {
  const tiePos = new THREE.Vector3(0, 0.238, -0.194);
  const launchDir = new THREE.Vector3(0, 0.26, -0.965).normalize();

  // Layer 1 (Under): 6 broad nape & behind-ear locks swept cleanly up into the tie
  const napePhis = irregularAngles(6, Math.PI - 1.58, Math.PI + 1.58, 149, 0.20);
  for (let i = 0; i < napePhis.length; i++) {
    const phi = napePhis[i];
    const sp = Math.sin(phi);
    const p0 = headPt(THREE, 2.15, phi, 1.102);
    const p1 = headPt(THREE, 1.66, lerp(phi, Math.PI, 0.42), 1.124);
    const p2 = headPt(THREE, 1.24, lerp(phi, Math.PI, 0.78), 1.130);
    const p3 = tiePos.clone().add(new THREE.Vector3(sp * 0.014, -0.010, 0.014));
    group.add(createLock(THREE, mat, swayItems, {
      points: [p0, p1, p2, p3],
      width: lerp(0.086, 0.104, hash(1101 + i)),
      thick: 0.032,
      swell: 1.08,
      rootTaper: 0.65,
      tipRound: 0.36,
      swayAmp: 0,
    }));
  }

  // Layer 2 (Middle): 4 side/temple swept locks + 2 cheek-framing sideburn locks
  for (const side of [-1, 1]) {
    for (let k = 0; k < 2; k++) {
      const th0 = k === 0 ? 1.18 : 1.52;
      const p0 = headPt(THREE, th0, side * (0.98 + k * 0.22), 1.106);
      const p1 = headPt(THREE, th0 - 0.08, side * 1.85, 1.138);
      const p2 = headPt(THREE, 1.14 + k * 0.08, side * 2.58, 1.142);
      const p3 = tiePos.clone().add(new THREE.Vector3(side * 0.016, k === 0 ? 0.004 : -0.006, 0.012));
      group.add(createLock(THREE, mat, swayItems, {
        points: [p0, p1, p2, p3],
        width: k === 0 ? 0.092 : 0.086,
        thick: 0.032,
        swell: 1.08,
        tipRound: 0.35,
        swayAmp: 0,
      }));
    }
    // Cute sideburn lock in front of ear
    group.add(createLock(THREE, mat, swayItems, {
      points: [
        headPt(THREE, 0.60, side * 0.92, 1.102),
        headPt(THREE, 1.26, side * 1.02, 1.136),
        headPt(THREE, 1.78, side * 0.96, 1.138),
      ],
      width: 0.080,
      thick: 0.030,
      swell: 1.06,
      tipRound: 0.28,
      swayAmp: 0.036,
      swayFreq: 2.0,
      phase: side > 0 ? 0.5 : 2.2,
      outSign: side,
    }));
  }

  // Layer 3 (Top): 5 broad crown locks sweeping cleanly back into the tie
  const crownPhis = irregularAngles(5, -0.84, 0.84, 157, 0.22);
  for (let i = 0; i < crownPhis.length; i++) {
    const phi = crownPhis[i];
    const side = phi >= 0 ? 1 : -1;
    const p0 = headPt(THREE, 0.42, phi, 1.112);
    const p1 = headPt(THREE, 0.28, Math.PI - phi * 0.65, 1.152);
    const p2 = headPt(THREE, 0.78, Math.PI - phi * 0.38, 1.152);
    const p3 = tiePos.clone().add(new THREE.Vector3(side * Math.abs(phi) * 0.014, 0.010, 0.012));
    group.add(createLock(THREE, mat, swayItems, {
      points: [p0, p1, p2, p3],
      width: lerp(0.084, 0.096, hash(1141 + i)),
      thick: 0.032,
      swell: 1.08,
      rootTaper: 0.62,
      tipRound: 0.35,
      swayAmp: 0,
    }));
  }

  // Plump hair band
  group.add(createBand(THREE, mat, tiePos.clone().addScaledVector(launchDir, 0.012), launchDir, 0.042, 0.015));

  // Tail: 7 broad overlapping locks + 4 narrow detail locks laid on top
  const tailBroad = [
    { dx: 0.0, dy: 0.012, sx: 0.0, w: 0.104, th: 0.042, yEnd: -0.195, fz: -0.028, ph: 0.2 },
    { dx: -0.018, dy: 0.008, sx: -0.056, w: 0.092, th: 0.038, yEnd: -0.158, fz: -0.018, ph: 0.9 },
    { dx: 0.018, dy: 0.008, sx: 0.056, w: 0.092, th: 0.038, yEnd: -0.146, fz: -0.018, ph: 1.7 },
    { dx: -0.024, dy: -0.004, sx: -0.084, w: 0.084, th: 0.036, yEnd: -0.118, fz: 0.004, ph: 2.5 },
    { dx: 0.024, dy: -0.004, sx: 0.084, w: 0.084, th: 0.036, yEnd: -0.128, fz: 0.004, ph: 3.3 },
    { dx: -0.014, dy: -0.016, sx: -0.036, w: 0.088, th: 0.038, yEnd: -0.175, fz: 0.020, ph: 4.1 },
    { dx: 0.014, dy: -0.016, sx: 0.036, w: 0.088, th: 0.038, yEnd: -0.165, fz: 0.020, ph: 4.9 },
  ];
  const tailDetail = [
    { dx: -0.008, dy: 0.016, sx: -0.032, w: 0.044, th: 0.025, yEnd: -0.135, fz: -0.042, ph: 0.6 },
    { dx: 0.010, dy: 0.016, sx: 0.038, w: 0.042, th: 0.024, yEnd: -0.152, fz: -0.042, ph: 1.8 },
    { dx: -0.020, dy: 0.004, sx: -0.072, w: 0.040, th: 0.024, yEnd: -0.095, fz: -0.026, ph: 3.0 },
    { dx: 0.020, dy: 0.004, sx: 0.074, w: 0.040, th: 0.024, yEnd: -0.108, fz: -0.026, ph: 4.2 },
  ];

  for (const ts of [...tailBroad, ...tailDetail]) {
    const p0 = tiePos.clone().add(new THREE.Vector3(ts.dx * 0.5, ts.dy * 0.5, 0.008));
    const p1 = new THREE.Vector3(ts.sx * 0.55, 0.268 + ts.dy, -0.256 + ts.fz * 0.3);
    const p2 = new THREE.Vector3(ts.sx * 0.98, 0.148, -0.298 + ts.fz);
    const p3 = new THREE.Vector3(ts.sx * 0.92, -0.018, -0.268 + ts.fz);
    const p4 = new THREE.Vector3(ts.sx * 1.14, ts.yEnd, -0.286 + ts.fz);
    const p5 = new THREE.Vector3(ts.sx * 1.32, ts.yEnd + 0.018, -0.308 + ts.fz);

    group.add(createLock(THREE, mat, swayItems, {
      points: [p0, p1, p2, p3, p4, p5],
      width: ts.w,
      thick: ts.th,
      swell: 1.15,
      rootTaper: 0.62,
      tipRound: 0.28,
      swayAmp: 0.062,
      swayFreq: 1.72,
      phase: ts.ph,
      outSign: ts.sx >= 0 ? 1 : -1,
      backSign: 1,
    }));
  }
}

// Style: TWIN TAILS — 32 locks (3 swept scalp layers + 14 curled twin-tail locks)
function addTwinTails(THREE, group, mat, swayItems) {
  for (const side of [-1, 1]) {
    const tiePos = new THREE.Vector3(side * 0.164, 0.246, -0.106);
    const launchDir = new THREE.Vector3(side * 0.78, 0.36, -0.50).normalize();

    // Layer 1 (Under): 3 broad nape/behind-ear locks per side swept up to the tie
    for (let k = 0; k < 3; k++) {
      const f = k / 2;
      const phi0 = side * lerp(3.04, 1.72, f);
      const p0 = headPt(THREE, 2.15 - f * 0.22, phi0, 1.102);
      const p1 = headPt(THREE, 1.56, side * lerp(2.58, 1.88, f), 1.126);
      const p2 = headPt(THREE, 1.18, side * lerp(2.24, 1.98, f), 1.132);
      const p3 = tiePos.clone().add(new THREE.Vector3(-side * 0.012, -0.010 + f * 0.008, 0.008));
      group.add(createLock(THREE, mat, swayItems, {
        points: [p0, p1, p2, p3],
        width: lerp(0.088, 0.104, hash(1201 + k + side * 3)),
        thick: 0.033,
        swell: 1.08,
        tipRound: 0.35,
        swayAmp: 0,
      }));
    }

    // Layer 2 (Middle): 2 side sweeps to tie + 1 face-framing cheek lock per side
    for (let k = 0; k < 2; k++) {
      const p0 = headPt(THREE, 0.92 + k * 0.38, side * (0.96 + k * 0.16), 1.106);
      const p1 = headPt(THREE, 0.96 + k * 0.20, side * 1.56, 1.138);
      const p2 = tiePos.clone().add(new THREE.Vector3(-side * 0.010, k === 0 ? 0.008 : -0.004, 0.010));
      group.add(createLock(THREE, mat, swayItems, {
        points: [p0, p1, p2],
        width: k === 0 ? 0.092 : 0.086,
        thick: 0.032,
        swell: 1.08,
        tipRound: 0.34,
        swayAmp: 0,
      }));
    }

    group.add(createLock(THREE, mat, swayItems, {
      points: [
        headPt(THREE, 0.56, side * 0.90, 1.104),
        headPt(THREE, 1.22, side * 1.00, 1.142),
        headPt(THREE, 1.78, side * 0.98, 1.146),
        new THREE.Vector3(side * 0.196, 0.056, 0.068),
      ],
      width: 0.082,
      thick: 0.033,
      swell: 1.10,
      tipRound: 0.28,
      swayAmp: 0.045,
      swayFreq: 2.0,
      phase: side > 0 ? 0.5 : 2.4,
      outSign: side,
    }));

    // Layer 3 (Top): 3 broad crown-parted locks sweeping cleanly into each tie
    for (let k = 0; k < 3; k++) {
      const f = k / 2;
      const p0 = headPt(THREE, 0.26 + f * 0.16, side * lerp(0.32, 2.75, f), 1.114);
      const p1 = headPt(THREE, 0.58 + f * 0.12, side * lerp(1.38, 2.38, f), 1.152);
      const p2 = tiePos.clone().add(new THREE.Vector3(-side * 0.010, 0.010, 0.006 - f * 0.008));
      group.add(createLock(THREE, mat, swayItems, {
        points: [p0, p1, p2],
        width: lerp(0.084, 0.096, hash(1241 + k + side * 5)),
        thick: 0.032,
        swell: 1.08,
        rootTaper: 0.62,
        tipRound: 0.34,
        swayAmp: 0,
      }));
    }

    // Plump hair band
    group.add(createBand(THREE, mat, tiePos.clone().addScaledVector(launchDir, 0.012), launchDir, 0.038, 0.014));

    // Tail: 5 broad + 2 narrow detail locks per side falling & curling cheerfully upward
    const subSpecs = [
      { oz: 0.0, ox: 0.0, oy: 0.010, w: 0.098, th: 0.040, yLow: -0.140, ph: 0.3 },
      { oz: 0.024, ox: 0.014, oy: 0.002, w: 0.088, th: 0.036, yLow: -0.106, ph: 1.0 },
      { oz: -0.024, ox: -0.008, oy: 0.000, w: 0.088, th: 0.036, yLow: -0.122, ph: 1.7 },
      { oz: 0.018, ox: -0.014, oy: -0.014, w: 0.084, th: 0.035, yLow: -0.088, ph: 2.4 },
      { oz: -0.018, ox: 0.012, oy: -0.014, w: 0.084, th: 0.035, yLow: -0.114, ph: 3.1 },
      // 2 narrow detail locks on the outer surface
      { oz: 0.012, ox: 0.024, oy: 0.012, w: 0.042, th: 0.024, yLow: -0.094, ph: 3.8 },
      { oz: -0.016, ox: 0.022, oy: 0.010, w: 0.040, th: 0.024, yLow: -0.132, ph: 4.5 },
    ];

    for (const s of subSpecs) {
      const ph = s.ph + (side > 0 ? 0 : 1.9);
      const p0 = tiePos.clone().add(new THREE.Vector3(-side * 0.008, s.oy * 0.5, s.oz * 0.3));
      const p1 = new THREE.Vector3(side * (0.236 + s.ox), 0.270 + s.oy, -0.126 + s.oz);
      const p2 = new THREE.Vector3(side * (0.276 + s.ox), 0.125, -0.108 + s.oz);
      const p3 = new THREE.Vector3(side * (0.266 + s.ox), -0.022, -0.088 + s.oz);
      const p4 = new THREE.Vector3(side * (0.286 + s.ox), s.yLow, -0.078 + s.oz);
      const p5 = new THREE.Vector3(side * (0.334 + s.ox), s.yLow + 0.022, -0.070 + s.oz);
      const p6 = new THREE.Vector3(side * (0.340 + s.ox), s.yLow + 0.064, -0.062 + s.oz);

      group.add(createLock(THREE, mat, swayItems, {
        points: [p0, p1, p2, p3, p4, p5, p6],
        width: s.w,
        thick: s.th,
        swell: 1.14,
        rootTaper: 0.62,
        tipRound: 0.30,
        swayAmp: 0.062,
        swayFreq: 1.72,
        phase: ph,
        outSign: side,
        backSign: 1,
      }));
    }
  }
}

// Style: BUN — 23 locks (3 swept scalp layers + sculpted clay bun with 6 swirl locks)
function addBun(THREE, group, mat, swayItems) {
  const bunBase = new THREE.Vector3(0, 0.298, -0.126);
  const bunAxis = new THREE.Vector3(0, 0.72, -0.69).normalize();
  const bunCenter = bunBase.clone().addScaledVector(bunAxis, 0.070);

  // Layer 1 (Under): 6 broad nape & behind-ear locks swept cleanly up into bun base
  const napePhis = irregularAngles(6, Math.PI - 1.56, Math.PI + 1.56, 163, 0.20);
  for (let i = 0; i < napePhis.length; i++) {
    const phi = napePhis[i];
    const sp = Math.sin(phi);
    const p0 = headPt(THREE, 2.16, phi, 1.102);
    const p1 = headPt(THREE, 1.48, lerp(phi, Math.PI, 0.48), 1.128);
    const p2 = headPt(THREE, 0.96, lerp(phi, Math.PI, 0.80), 1.132);
    const p3 = bunBase.clone().add(new THREE.Vector3(sp * 0.020, -0.012, 0.008));
    group.add(createLock(THREE, mat, swayItems, {
      points: [p0, p1, p2, p3],
      width: lerp(0.088, 0.104, hash(1301 + i)),
      thick: 0.032,
      swell: 1.08,
      tipRound: 0.36,
      swayAmp: 0,
    }));
  }

  // Layer 2 (Middle): 4 side/temple swept locks + 2 cheek-framing sideburn wisps
  for (const side of [-1, 1]) {
    for (let k = 0; k < 2; k++) {
      const p0 = headPt(THREE, 1.12 + k * 0.36, side * (0.98 + k * 0.20), 1.106);
      const p1 = headPt(THREE, 0.94 + k * 0.18, side * 1.88, 1.140);
      const p2 = bunBase.clone().add(new THREE.Vector3(side * 0.024, -0.004, 0.012));
      group.add(createLock(THREE, mat, swayItems, {
        points: [p0, p1, p2],
        width: k === 0 ? 0.092 : 0.086,
        thick: 0.032,
        swell: 1.08,
        tipRound: 0.35,
        swayAmp: 0,
      }));
    }
    group.add(createLock(THREE, mat, swayItems, {
      points: [
        headPt(THREE, 0.60, side * 0.92, 1.102),
        headPt(THREE, 1.26, side * 1.02, 1.136),
        headPt(THREE, 1.74, side * 0.96, 1.138),
      ],
      width: 0.080,
      thick: 0.030,
      swell: 1.06,
      tipRound: 0.28,
      swayAmp: 0.036,
      swayFreq: 2.0,
      phase: side > 0 ? 0.7 : 2.5,
      outSign: side,
    }));
  }

  // Layer 3 (Top): 5 broad crown locks sweeping cleanly back into bun base
  const topPhis = irregularAngles(5, -0.82, 0.82, 173, 0.22);
  for (let i = 0; i < topPhis.length; i++) {
    const phi = topPhis[i];
    const p0 = headPt(THREE, 0.44, phi, 1.112);
    const p1 = headPt(THREE, 0.24, Math.PI - phi * 0.6, 1.150);
    const p2 = bunBase.clone().add(new THREE.Vector3(Math.sin(phi) * 0.022, 0.008, 0.016));
    group.add(createLock(THREE, mat, swayItems, {
      points: [p0, p1, p2],
      width: lerp(0.084, 0.096, hash(1341 + i)),
      thick: 0.032,
      swell: 1.08,
      rootTaper: 0.62,
      tipRound: 0.35,
      swayAmp: 0,
    }));
  }

  // Soft oblate clay bun core + double-wrapped bands
  const bunGeo = new THREE.SphereGeometry(0.096, 32, 24);
  const bunMesh = new THREE.Mesh(bunGeo, mat);
  bunMesh.position.copy(bunCenter);
  bunMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bunAxis);
  bunMesh.scale.set(1.06, 0.86, 1.06);
  bunMesh.castShadow = true;
  bunMesh.receiveShadow = true;
  group.add(bunMesh);

  group.add(createBand(THREE, mat, bunBase.clone().addScaledVector(bunAxis, 0.008), bunAxis, 0.066, 0.016));
  group.add(createBand(THREE, mat, bunBase.clone().addScaledVector(bunAxis, 0.028), bunAxis, 0.074, 0.014));

  // 4 broad + 2 narrow sculpted swirl locks hugging around the bun
  const uAxis = new THREE.Vector3(1, 0, 0);
  const vAxis = new THREE.Vector3().crossVectors(bunAxis, uAxis).normalize();
  for (let k = 0; k < 6; k++) {
    const isDetail = k >= 4;
    const startAng = isDetail ? (k - 4) * Math.PI + 0.55 : (k / 4) * Math.PI * 2;
    const pts = [];
    for (let s = 0; s <= 5; s++) {
      const f = s / 5;
      const ang = startAng + f * Math.PI * 1.2;
      const elev = lerp(-0.026, 0.066, f) + (isDetail ? 0.008 : 0);
      const rad = lerp(isDetail ? 0.092 : 0.086, 0.026, f * f);
      pts.push(
        bunCenter.clone()
          .addScaledVector(bunAxis, elev)
          .addScaledVector(uAxis, Math.cos(ang) * rad)
          .addScaledVector(vAxis, Math.sin(ang) * rad)
      );
    }
    group.add(createLock(THREE, mat, swayItems, {
      points: pts,
      width: isDetail ? 0.042 : 0.084,
      thick: isDetail ? 0.024 : 0.036,
      swell: 1.10,
      tipRound: 0.34,
      swayAmp: 0,
      collide: false,
    }));
  }
}

// Style: CURLY MEDIUM — 29 plump spiral curls in 3 roof-tile layers
function addCurlyMedium(THREE, group, mat, swayItems) {
  const addHelixLock = (p0, p1, helixStart, phi, yEnd, hRad, turns, width, thick, phase, swayAmp) => {
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    const sideSign = sp >= 0 ? 1 : -1;
    const outDir = new THREE.Vector3(sp, 0, cp).normalize();
    const tanDir = new THREE.Vector3(cp, 0, -sp).normalize();
    const pts = [p0, p1];
    const hSteps = 9;

    for (let s = 0; s <= hSteps; s++) {
      const f = s / hSteps;
      const ang = f * Math.PI * 2 * turns * sideSign + phase * 0.4;
      const rGrow = smoothstep(f * 2.2) * hRad;
      const flareOut = f * 0.024;
      const cx = helixStart.x + outDir.x * flareOut;
      const cz = helixStart.z + outDir.z * flareOut;
      const cy = lerp(helixStart.y, yEnd, f);
      pts.push(new THREE.Vector3(
        cx + outDir.x * (Math.cos(ang) * rGrow) + tanDir.x * (Math.sin(ang) * rGrow),
        cy,
        cz + outDir.z * (Math.cos(ang) * rGrow) + tanDir.z * (Math.sin(ang) * rGrow)
      ));
    }
    group.add(createLock(THREE, mat, swayItems, {
      points: pts,
      width,
      thick,
      swell: 1.12,
      rootTaper: 0.72,
      tipRound: 0.34,
      swayAmp,
      swayFreq: 1.82 + (phase % 0.34),
      phase,
      outSign: sideSign,
      backSign: cp < 0 ? 1 : -1,
    }));
  };

  // Layer 1 (Under): 8 broad helical curls at nape & behind ears
  const underPhis = irregularAngles(8, Math.PI - 1.62, Math.PI + 1.62, 181, 0.20);
  for (let i = 0; i < underPhis.length; i++) {
    const phi = underPhis[i];
    const h = hash(1401 + i * 2.9);
    const yEnd = lerp(-0.040, 0.008, h);
    addHelixLock(
      headPt(THREE, 1.14 + h * 0.12, phi, 1.098),
      headPt(THREE, 1.54, phi, 1.125),
      headPt(THREE, 1.72, phi, 1.148),
      phi, yEnd, 0.026 + h * 0.008, 1.25,
      lerp(0.084, 0.100, hash(1421 + i)), 0.042, i * 0.85, 0.050
    );
  }

  // Layer 2 (Middle): 10 broad bouncy curls around cheeks, sides & back
  const midPhis = irregularAngles(10, Math.PI - 2.24, Math.PI + 2.24, 191, 0.22);
  for (let i = 0; i < midPhis.length; i++) {
    const phi = midPhis[i];
    const h = hash(1441 + i * 3.1);
    const yEnd = lerp(-0.018, 0.046, h);
    addHelixLock(
      headPt(THREE, 0.62 + h * 0.14, phi, 1.106),
      headPt(THREE, 1.18, phi, 1.148),
      headPt(THREE, 1.56, phi, 1.178),
      phi, yEnd, 0.028 + h * 0.008, 1.35,
      lerp(0.082, 0.096, hash(1461 + i)), 0.040, i * 0.78 + 0.5, 0.056
    );
  }

  // Layer 3 (Top): 7 broad crown-whorl curls + 4 narrow detail curls on top
  const topPhis = irregularAngles(7, Math.PI - 2.26, Math.PI + 2.26, 199, 0.24);
  for (let i = 0; i < topPhis.length; i++) {
    const phi = topPhis[i];
    const h = hash(1481 + i * 2.7);
    const yEnd = lerp(0.026, 0.088, h);
    addHelixLock(
      whorlPt(THREE, phi, 1.112, 0.016),
      headPt(THREE, 0.64, phi, 1.160),
      headPt(THREE, 1.32, phi, 1.192),
      phi, yEnd, 0.026 + h * 0.006, 1.15,
      lerp(0.080, 0.092, hash(1501 + i)), 0.036, i * 0.94 + 1.1, 0.054
    );
  }

  const detailPhis = [Math.PI - 2.02, Math.PI - 0.76, Math.PI + 0.78, Math.PI + 2.04];
  for (let i = 0; i < detailPhis.length; i++) {
    const phi = detailPhis[i];
    const h = hash(1521 + i * 3.9);
    const yEnd = lerp(0.022, 0.078, h);
    addHelixLock(
      whorlPt(THREE, phi, 1.118, 0.020),
      headPt(THREE, 0.68, phi, 1.178),
      headPt(THREE, 1.36, phi, 1.210),
      phi, yEnd, 0.024, 1.25,
      lerp(0.038, 0.048, h), 0.026, i * 1.45 + 0.3, 0.060
    );
  }
}

export function buildHair(THREE, opts, kit) {
  const cfg = opts || {};
  const hairStyle = cfg.hairStyle || 'bob';
  const fringe = cfg.fringe !== undefined ? cfg.fringe : 'full';
  const hairColor = cfg.hairColor !== undefined ? cfg.hairColor : 0x4a352c;
  const highlight = cfg.highlight !== undefined ? cfg.highlight : 0x9c7b6a;

  const group = new THREE.Group();
  group.name = 'hair';

  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(hairColor),
    roughness: 0.5,
    metalness: 0.0,
    sheen: 1.0,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(highlight),
    clearcoat: 0.15,
    clearcoatRoughness: 0.45,
  });

  const swayItems = [];

  // 1. Thick rounded full hair-mass cap (1.10 to 1.12 at crown and back)
  const capBaseScale = hairStyle === 'buzz' ? 1.105 : 1.10;
  const capMesh = new THREE.Mesh(buildCapGeometry(THREE, capBaseScale), mat);
  capMesh.name = 'hairCap';
  capMesh.castShadow = true;
  capMesh.receiveShadow = true;
  group.add(capMesh);

  if (hairStyle !== 'buzz') {
    // 2. Fringe (6 to 9 overlapping locks, blending into side hair with no bare temple)
    addFringe(THREE, group, mat, swayItems, fringe);

    // 3. Layered sides, crown, and back by style
    if (hairStyle === 'bob') {
      addBob(THREE, group, mat, swayItems);
    } else if (hairStyle === 'longStraight') {
      addLongHair(THREE, group, mat, swayItems, false);
    } else if (hairStyle === 'longWavy') {
      addLongHair(THREE, group, mat, swayItems, true);
    } else if (hairStyle === 'shortLayered') {
      addShortLayered(THREE, group, mat, swayItems);
    } else if (hairStyle === 'pixie') {
      addPixie(THREE, group, mat, swayItems);
    } else if (hairStyle === 'ponytail') {
      addPonytail(THREE, group, mat, swayItems);
    } else if (hairStyle === 'twinTails') {
      addTwinTails(THREE, group, mat, swayItems);
    } else if (hairStyle === 'bun') {
      addBun(THREE, group, mat, swayItems);
    } else if (hairStyle === 'curlyMedium') {
      addCurlyMedium(THREE, group, mat, swayItems);
    } else {
      addBob(THREE, group, mat, swayItems);
    }

    // 4. Small antenna curl at the crown (all styles except buzz, bun, ponytail)
    if (hairStyle !== 'bun' && hairStyle !== 'ponytail') {
      addAntenna(THREE, group, mat, swayItems);
    }
  }

  group.userData.swayItems = swayItems;
  return group;
}

export function sway(group, t, amount) {
  if (!group || !group.userData || !group.userData.swayItems) return;
  const items = group.userData.swayItems;
  const amp = amount === undefined ? 1 : amount;
  const time = t || 0;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const w1 = Math.sin(time * it.freq + it.phase);
    const w2 = Math.sin(time * it.freq * 1.61 + it.phase * 1.37);
    const wave = w1 * 0.78 + w2 * 0.22;

    const rz = (wave * 0.82 + it.outSign * 0.18 * Math.abs(wave)) * it.ampZ * amp;
    const rx = (w2 * 0.75 + it.backSign * 0.25 * Math.abs(w2)) * it.ampX * amp;
    const ry = w1 * it.ampX * 0.35 * amp;

    it.mesh.rotation.set(rx, ry, rz);
  }
}
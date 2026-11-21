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

// Head-centered ellipsoid point:
// theta: 0 at crown (+y), PI/2 at equator (y=0.165), PI at chin
// phi: 0 at front (+z), +PI/2 at right (+x), -PI/2 at left (-x), PI at back (-z)
function headPt(THREE, theta, phi, scale = 1.08, dx = 0, dy = 0, dz = 0) {
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

// Convert target world Y on front/side/back cap surface to polar angle theta
function yToTheta(y, scale = 1.08) {
  return Math.acos(clamp((y - HEAD_CY) / (HEAD_RY * scale), -0.999, 0.999));
}

// Hairline height around azimuth |phi| in [0, PI]:
// runs across forehead at 0.235, drops in front of ears, arches over & passes behind ears, meets at nape
const HAIRLINE_KNOTS = [
  [0.0, 0.235],
  [0.55, 0.233],
  [0.92, 0.206],
  [1.24, 0.132],
  [1.56, 0.148],
  [1.96, 0.082],
  [2.52, 0.062],
  [Math.PI, 0.055],
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
function pushOutsideVolumes(v, margin = 0.0012) {
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
  const sr = SHOULDER_R + margin;
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

// Build smooth thick-shell hair cap with rounded inward lower lip (64 x 48 segments)
function buildCapGeometry(THREE, capScale = 1.08) {
  const segU = CAP_SEG_U;
  const segV = CAP_SEG_V;
  const lipRings = 8;
  const bodyRings = segV - lipRings;
  const innerScale = 0.995;
  const lipAngle = 0.055;

  const verts = [];
  const uvs = [];
  const indices = [];

  for (let iv = 0; iv <= segV; iv++) {
    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const phi = (u - 0.5) * Math.PI * 2; // -PI to +PI, 0 at front
      const yEdge = hairlineY(phi);
      const thetaEdge = yToTheta(yEdge, capScale);

      let theta;
      let s;
      if (iv <= bodyRings) {
        const tv = iv / bodyRings;
        // Slight crown pole offset only for non-zero rings
        theta = tv * (thetaEdge - lipAngle);
        s = capScale;
      } else {
        const alpha = ((iv - bodyRings) / lipRings) * Math.PI;
        theta = (thetaEdge - lipAngle) + lipAngle * Math.sin(alpha);
        s = innerScale + (capScale - innerScale) * 0.5 * (1 + Math.cos(alpha));
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
      // Outward winding for theta increasing downward, phi increasing counterclockwise around +y
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

  // Clean upward normal at crown pole
  const norm = geo.attributes.normal;
  for (let iu = 0; iu <= segU; iu++) {
    norm.setXYZ(iu, 0, 1, 0);
  }
  norm.needsUpdate = true;
  return geo;
}

// Build non-uniform u table with 24 segments along (packed softly at root & rounded tip)
const LOCK_U_TABLE = (() => {
  const us = [0.0, 0.024];
  const bodyCount = LOCK_SEG_ALONG - 5; // 19 body steps -> indices 2..20
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
    width = 0.072,
    thick = 0.034,
    swell = 1.12,
    rootTaper = 0.78,
    tipRound = 0.28,
    twist = 0,
    swayAmp = 0.052, // ~3 deg
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
  if (N.lengthSq() < 1e-6) N.set(0, 0, 1);
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
      // Store local to rootPos so rotation pivots around the root
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

  // Clean pole normals at root and rounded tip
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

// Helper for plump clay hair tie / wrapped band
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
    new THREE.Vector3(0.0, HEAD_CY + HEAD_RY * 1.05, 0.008),
    new THREE.Vector3(0.002, HEAD_CY + HEAD_RY * 1.24, 0.015),
    new THREE.Vector3(0.018, HEAD_CY + HEAD_RY * 1.38, 0.022),
    new THREE.Vector3(0.042, HEAD_CY + HEAD_RY * 1.34, 0.025),
    new THREE.Vector3(0.050, HEAD_CY + HEAD_RY * 1.21, 0.022),
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

// Build fringe locks across forehead, ending strictly between y = 0.19 and 0.215
function addFringe(THREE, group, mat, swayItems, fringeType) {
  if (!fringeType || fringeType === 'none') return;

  const makeFringeLock = (phi0, phi1, phi2, phiTip, yTip, w, th, phase, outSign) => {
    const s = 1.11;
    const yMid1 = lerp(0.325, yTip, 0.38);
    const yMid2 = lerp(0.325, yTip, 0.74);
    const pts = [
      headPt(THREE, 0.30, phi0, 1.06),
      headPt(THREE, yToTheta(yMid1, s), phi1, 1.115),
      headPt(THREE, yToTheta(yMid2, s), phi2, 1.125),
      headPt(THREE, yToTheta(yTip, 1.13), phiTip, 1.135),
    ];
    group.add(createLock(THREE, mat, swayItems, {
      points: pts,
      width: w,
      thick: th,
      swell: 1.12,
      rootTaper: 0.72,
      tipRound: 0.26,
      swayAmp: 0.038, // ~2.2 deg
      swayFreq: 1.9,
      phase,
      outSign,
      backSign: -1,
    }));
  };

  if (fringeType === 'full') {
    // 5 plump overlapping clay locks like Image 1
    makeFringeLock(0.04, 0.06, -0.02, -0.07, 0.194, 0.078, 0.036, 0.3, -1);
    makeFringeLock(-0.22, -0.28, -0.26, -0.34, 0.198, 0.074, 0.034, 1.1, -1);
    makeFringeLock(0.22, 0.27, 0.30, 0.37, 0.197, 0.074, 0.034, 2.0, 1);
    makeFringeLock(-0.42, -0.50, -0.56, -0.64, 0.206, 0.070, 0.032, 2.8, -1);
    makeFringeLock(0.42, 0.50, 0.56, 0.65, 0.205, 0.070, 0.032, 3.6, 1);
  } else if (fringeType === 'sideSwept') {
    // 5 locks sweeping left-to-right across the forehead in soft S curves
    makeFringeLock(-0.42, -0.50, -0.58, -0.66, 0.208, 0.064, 0.031, 0.5, -1);
    makeFringeLock(-0.34, -0.24, -0.10, 0.02, 0.202, 0.076, 0.035, 1.3, 1);
    makeFringeLock(-0.20, -0.04, 0.12, 0.26, 0.194, 0.080, 0.036, 2.1, 1);
    makeFringeLock(-0.02, 0.16, 0.34, 0.48, 0.198, 0.076, 0.034, 2.9, 1);
    makeFringeLock(0.20, 0.38, 0.54, 0.68, 0.210, 0.068, 0.032, 3.7, 1);
  } else if (fringeType === 'curtain') {
    // 6 locks parted cleanly in the middle, sweeping outward
    for (const side of [-1, 1]) {
      makeFringeLock(
        side * 0.07, side * 0.15, side * 0.24, side * 0.33,
        0.212, 0.068, 0.033, side > 0 ? 0.6 : 1.8, side
      );
      makeFringeLock(
        side * 0.20, side * 0.32, side * 0.44, side * 0.54,
        0.200, 0.074, 0.034, side > 0 ? 2.4 : 3.5, side
      );
      makeFringeLock(
        side * 0.36, side * 0.48, side * 0.60, side * 0.72,
        0.194, 0.070, 0.032, side > 0 ? 4.2 : 5.1, side
      );
    }
  }
}

// Style: BOB — plump clay locks to the jaw that curl outward at the tips (Image 1)
function addBob(THREE, group, mat, swayItems) {
  // Side locks in front of ears curling outward at the jaw
  for (const side of [-1, 1]) {
    const phBase = side > 0 ? 0.7 : 2.3;
    // Front cheek lock
    group.add(createLock(THREE, mat, swayItems, {
      points: [
        headPt(THREE, 0.48, side * 0.86, 1.07),
        headPt(THREE, 1.15, side * 0.96, 1.12),
        headPt(THREE, 1.72, side * 1.05, 1.14),
        new THREE.Vector3(side * 0.205, 0.055, 0.065),
        new THREE.Vector3(side * 0.242, 0.068, 0.052),
      ],
      width: 0.074,
      thick: 0.035,
      swell: 1.14,
      tipRound: 0.30,
      swayAmp: 0.052,
      swayFreq: 1.9,
      phase: phBase,
      outSign: side,
    }));

    // Side-ear bouncy flick curl (Image 1 signature side swoop)
    group.add(createLock(THREE, mat, swayItems, {
      points: [
        headPt(THREE, 0.52, side * 1.24, 1.07),
        headPt(THREE, 1.18, side * 1.32, 1.13),
        headPt(THREE, 1.66, side * 1.38, 1.17),
        new THREE.Vector3(side * 0.238, 0.092, 0.008),
        new THREE.Vector3(side * 0.264, 0.118, -0.004),
      ],
      width: 0.076,
      thick: 0.036,
      swell: 1.15,
      tipRound: 0.32,
      swayAmp: 0.058,
      swayFreq: 2.05,
      phase: phBase + 0.8,
      outSign: side,
    }));
  }

  // 7 broad overlapping back-to-side bob locks curving around skull and flipping outward at jaw
  const count = 7;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const phi = lerp(-2.95, 2.95, t);
    // Map evenly across the back arc: from +1.62 rad through PI to -1.62 rad
    const backPhi = Math.PI + lerp(-1.55, 1.55, t);
    const sideSign = Math.sin(backPhi) >= 0 ? 1 : -1;
    const isOuter = Math.abs(t - 0.5) > 0.32;
    const yTip = isOuter ? 0.032 : 0.022;
    const flare = isOuter ? 0.048 : 0.038;

    const p0 = headPt(THREE, 0.48, backPhi, 1.07);
    const p1 = headPt(THREE, 1.12, backPhi, 1.125);
    const p2 = headPt(THREE, 1.78, backPhi, 1.14);
    const p3 = headPt(THREE, 2.18, backPhi, 1.13);
    p3.y = yTip;
    const outDir = new THREE.Vector3(Math.sin(backPhi), 0, Math.cos(backPhi));
    const p4 = p3.clone().addScaledVector(outDir, flare);
    p4.y = yTip + 0.018;

    group.add(createLock(THREE, mat, swayItems, {
      points: [p0, p1, p2, p3, p4],
      width: 0.086,
      thick: 0.038,
      swell: 1.12,
      tipRound: 0.30,
      swayAmp: 0.050,
      swayFreq: 1.75 + (i % 3) * 0.14,
      phase: i * 0.9 + 0.3 + phi * 0.0,
      outSign: sideSign,
      backSign: 1,
    }));
  }
}

// Style: LONG STRAIGHT & LONG WAVY — broad panels to the waist + two locks in front of shoulders
function addLongHair(THREE, group, mat, swayItems, wavy) {
  const count = 7;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const backPhi = Math.PI + lerp(-1.38, 1.38, t);
    const sp = Math.sin(backPhi);
    const cp = Math.cos(backPhi);
    const edgeFactor = Math.abs(t - 0.5) * 2; // 0 center, 1 outer
    const yEnd = lerp(-0.325, -0.265, edgeFactor * edgeFactor);

    const p0 = headPt(THREE, 0.44, backPhi, 1.07);
    const p1 = headPt(THREE, 1.12, backPhi, 1.125);
    const p2 = headPt(THREE, 1.78, backPhi, 1.13);
    const xBase = sp * 0.185;
    const zBase = Math.min(-0.125, cp * 0.182);

    const pts = [p0, p1, p2];
    const steps = wavy ? 6 : 4;
    const phaseW = i * 0.85;
    for (let s = 1; s <= steps; s++) {
      const k = s / steps;
      const y = lerp(p2.y, yEnd, k);
      const spread = 1.0 + k * 0.14;
      let wx = xBase * spread;
      let wz = lerp(p2.z, zBase - 0.025, k);
      if (wavy) {
        const wave = Math.sin(k * Math.PI * 2.5 + phaseW) * (0.018 + 0.018 * k);
        const waveZ = Math.cos(k * Math.PI * 2.5 + phaseW) * (0.014 + 0.014 * k);
        wx += wave;
        wz += waveZ - 0.012 * k;
      } else {
        // Soft natural outward drape at waist
        wz -= Math.sin(k * Math.PI) * 0.012;
      }
      pts.push(new THREE.Vector3(wx, y, wz));
    }

    group.add(createLock(THREE, mat, swayItems, {
      points: pts,
      width: 0.088,
      thick: 0.038,
      swell: 1.10,
      tipRound: 0.26,
      swayAmp: 0.062, // ~3.5 deg
      swayFreq: 1.55 + (i % 3) * 0.12,
      phase: i * 0.82,
      outSign: sp >= 0 ? 1 : -1,
      backSign: 1,
    }));
  }

  // Side-back bridging locks behind the ears
  for (const side of [-1, 1]) {
    const backPhi = side * 1.62;
    const p0 = headPt(THREE, 0.50, backPhi, 1.07);
    const p1 = headPt(THREE, 1.25, backPhi, 1.125);
    const pts = [p0, p1];
    const yEnd = -0.22;
    const steps = wavy ? 5 : 3;
    for (let s = 1; s <= steps; s++) {
      const k = s / steps;
      const y = lerp(p1.y, yEnd, k);
      let wx = side * lerp(0.195, 0.165, k);
      let wz = lerp(-0.02, -0.105, k);
      if (wavy) {
        wx += side * Math.sin(k * Math.PI * 2.3) * 0.022;
        wz += Math.cos(k * Math.PI * 2.3) * 0.014;
      }
      pts.push(new THREE.Vector3(wx, y, wz));
    }
    group.add(createLock(THREE, mat, swayItems, {
      points: pts,
      width: 0.072,
      thick: 0.034,
      swell: 1.10,
      tipRound: 0.26,
      swayAmp: 0.058,
      swayFreq: 1.72,
      phase: side > 0 ? 1.4 : 3.2,
      outSign: side,
      backSign: 1,
    }));
  }

  // Two plump locks draping in front of the shoulders
  for (const side of [-1, 1]) {
    const p0 = headPt(THREE, 0.52, side * 0.96, 1.07);
    const p1 = headPt(THREE, 1.22, side * 1.04, 1.125);
    const pts = [p0, p1];
    const steps = wavy ? 5 : 4;
    const yEnd = wavy ? -0.205 : -0.195;
    for (let s = 1; s <= steps; s++) {
      const k = s / steps;
      const y = lerp(p1.y, yEnd, k);
      let wx = side * lerp(0.188, 0.132, k);
      let wz = lerp(0.088, 0.102, Math.sin(k * Math.PI * 0.6));
      if (wavy) {
        wx += side * Math.sin(k * Math.PI * 2.4 + 0.4) * 0.022;
        wz += Math.cos(k * Math.PI * 2.4) * 0.012;
      }
      pts.push(new THREE.Vector3(wx, y, wz));
    }
    group.add(createLock(THREE, mat, swayItems, {
      points: pts,
      width: 0.068,
      thick: 0.034,
      swell: 1.12,
      tipRound: 0.28,
      swayAmp: 0.060,
      swayFreq: 1.88,
      phase: side > 0 ? 0.5 : 2.6,
      outSign: side,
      backSign: -1,
    }));
  }
}

// Style: SHORT LAYERED — short overlapping tufts, a little messy
function addShortLayered(THREE, group, mat, swayItems) {
  // Lower tier: 9 overlapping messy tufts around sides & back
  const lowCount = 9;
  for (let i = 0; i < lowCount; i++) {
    const t = i / (lowCount - 1);
    const phi = Math.PI + lerp(-2.15, 2.15, t);
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    const jitter = Math.sin(i * 2.7 + 0.5);
    const yTip = 0.058 + jitter * 0.018;
    const flick = 0.028 + Math.abs(jitter) * 0.022;
    const sideTwist = (i % 2 === 0 ? 1 : -1) * 0.10;

    const p0 = headPt(THREE, 0.72, phi, 1.07);
    const p1 = headPt(THREE, 1.32, phi + sideTwist * 0.4, 1.12);
    const p2 = headPt(THREE, yToTheta(yTip + 0.02, 1.14), phi + sideTwist, 1.145);
    const p3 = p2.clone();
    p3.x += sp * flick + (cp * sideTwist * 0.14);
    p3.z += cp * flick - (sp * sideTwist * 0.14);
    p3.y = yTip + (jitter > 0 ? 0.012 : -0.006);

    group.add(createLock(THREE, mat, swayItems, {
      points: [p0, p1, p2, p3],
      width: 0.072,
      thick: 0.034,
      swell: 1.14,
      tipRound: 0.28,
      swayAmp: 0.048,
      swayFreq: 2.0 + (i % 3) * 0.15,
      phase: i * 0.95,
      outSign: sp >= 0 ? 1 : -1,
      backSign: cp < 0 ? 1 : -1,
    }));
  }

  // Upper tier: 7 shorter tousled clay tufts overlapping the crown-sides & back
  const topCount = 7;
  for (let i = 0; i < topCount; i++) {
    const t = i / (topCount - 1);
    const phi = Math.PI + lerp(-2.10, 2.10, t);
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    const jitter = Math.cos(i * 2.3 + 0.8);
    const p0 = headPt(THREE, 0.38, phi, 1.07);
    const p1 = headPt(THREE, 0.92, phi + jitter * 0.08, 1.135);
    const p2 = headPt(THREE, 1.44, phi + jitter * 0.14, 1.165);
    const p3 = p2.clone();
    p3.x += sp * 0.032;
    p3.z += cp * 0.032;
    p3.y += 0.008 + jitter * 0.012;

    group.add(createLock(THREE, mat, swayItems, {
      points: [p0, p1, p2, p3],
      width: 0.076,
      thick: 0.035,
      swell: 1.14,
      tipRound: 0.28,
      swayAmp: 0.044,
      swayFreq: 2.15 + (i % 2) * 0.2,
      phase: i * 1.1 + 0.4,
      outSign: sp >= 0 ? 1 : -1,
      backSign: cp < 0 ? 1 : -1,
    }));
  }
}

// Style: PIXIE — sleek, close-sculpted clay layers hugging the nape and ears
function addPixie(THREE, group, mat, swayItems) {
  // Cute forward-tapered cheek wisps in front of ears
  for (const side of [-1, 1]) {
    group.add(createLock(THREE, mat, swayItems, {
      points: [
        headPt(THREE, 0.56, side * 0.95, 1.065),
        headPt(THREE, 1.24, side * 1.05, 1.105),
        headPt(THREE, 1.72, side * 0.98, 1.11),
        headPt(THREE, 1.96, side * 0.86, 1.105),
      ],
      width: 0.058,
      thick: 0.028,
      swell: 1.10,
      tipRound: 0.26,
      swayAmp: 0.036,
      swayFreq: 2.0,
      phase: side > 0 ? 0.6 : 2.1,
      outSign: side,
    }));
  }

  // 7 neat overlapping nape locks hugging the skull smoothly
  const count = 7;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const phi = Math.PI + lerp(-1.85, 1.85, t);
    const sp = Math.sin(phi);
    const p0 = headPt(THREE, 0.46, phi, 1.065);
    const p1 = headPt(THREE, 1.18, phi, 1.11);
    const p2 = headPt(THREE, 1.82, phi, 1.105);
    const p3 = headPt(THREE, 2.22, phi * 0.98 + Math.PI * 0.02, 1.085);

    group.add(createLock(THREE, mat, swayItems, {
      points: [p0, p1, p2, p3],
      width: 0.078,
      thick: 0.032,
      swell: 1.10,
      tipRound: 0.28,
      swayAmp: 0.035,
      swayFreq: 1.9,
      phase: i * 0.85,
      outSign: sp >= 0 ? 1 : -1,
      backSign: 1,
    }));
  }

  // Soft crown-top swoop layers for sculpted clay volume
  for (const side of [-1, 1]) {
    group.add(createLock(THREE, mat, swayItems, {
      points: [
        headPt(THREE, 0.34, side * 1.10, 1.07),
        headPt(THREE, 0.88, side * 1.48, 1.12),
        headPt(THREE, 1.38, side * 1.85, 1.12),
      ],
      width: 0.074,
      thick: 0.030,
      swell: 1.12,
      tipRound: 0.30,
      swayAmp: 0.035,
      swayFreq: 2.1,
      phase: side > 0 ? 1.2 : 3.4,
      outSign: side,
      backSign: 1,
    }));
  }
}

// Style: PONYTAIL — thick sculpted tail from upper back with a band
function addPonytail(THREE, group, mat, swayItems) {
  const tiePos = new THREE.Vector3(0, 0.235, -0.184);
  const launchDir = new THREE.Vector3(0, 0.28, -0.96).normalize();

  // Subtle pulled-back cap locks converging into the tie
  for (const side of [-1, 1]) {
    group.add(createLock(THREE, mat, swayItems, {
      points: [
        headPt(THREE, 1.35, side * 1.25, 1.075),
        headPt(THREE, 1.28, side * 1.95, 1.10),
        headPt(THREE, 1.16, side * 2.65, 1.10),
        tiePos.clone().add(new THREE.Vector3(side * 0.012, -0.005, 0.012)),
      ],
      width: 0.068,
      thick: 0.028,
      swell: 1.08,
      tipRound: 0.35,
      swayAmp: 0,
    }));
    // Neat sideburn lock in front of ear
    group.add(createLock(THREE, mat, swayItems, {
      points: [
        headPt(THREE, 0.62, side * 0.94, 1.065),
        headPt(THREE, 1.28, side * 1.02, 1.10),
        headPt(THREE, 1.78, side * 0.96, 1.10),
      ],
      width: 0.052,
      thick: 0.026,
      swell: 1.06,
      tipRound: 0.28,
      swayAmp: 0.036,
      swayFreq: 2.0,
      phase: side > 0 ? 0.5 : 2.2,
      outSign: side,
    }));
  }

  // Plump hair band around tie
  group.add(createBand(THREE, mat, tiePos.clone().addScaledVector(launchDir, 0.012), launchDir, 0.038, 0.014));

  // 5 plump overlapping clay locks forming the thick ponytail
  const tailSpecs = [
    { dx: 0.0, dy: 0.010, dz: 0.0, sx: 0.0, w: 0.088, th: 0.040, yEnd: -0.165, flareZ: -0.025, ph: 0.2 },
    { dx: -0.018, dy: 0.005, dz: 0.0, sx: -0.058, w: 0.076, th: 0.036, yEnd: -0.125, flareZ: -0.010, ph: 1.0 },
    { dx: 0.018, dy: 0.005, dz: 0.0, sx: 0.058, w: 0.076, th: 0.036, yEnd: -0.125, flareZ: -0.010, ph: 1.9 },
    { dx: -0.012, dy: -0.014, dz: 0.006, sx: -0.034, w: 0.074, th: 0.036, yEnd: -0.150, flareZ: 0.015, ph: 2.7 },
    { dx: 0.012, dy: -0.014, dz: 0.006, sx: 0.034, w: 0.074, th: 0.036, yEnd: -0.150, flareZ: 0.015, ph: 3.5 },
  ];

  for (const ts of tailSpecs) {
    const p0 = tiePos.clone().add(new THREE.Vector3(ts.dx * 0.5, ts.dy * 0.5, 0.008));
    const p1 = new THREE.Vector3(ts.sx * 0.55, 0.262 + ts.dy, -0.242 + ts.dz);
    const p2 = new THREE.Vector3(ts.sx * 1.0, 0.145, -0.285 + ts.flareZ);
    const p3 = new THREE.Vector3(ts.sx * 0.92, -0.015, -0.255 + ts.flareZ);
    const p4 = new THREE.Vector3(ts.sx * 1.15, ts.yEnd, -0.275 + ts.flareZ);
    const p5 = new THREE.Vector3(ts.sx * 1.32, ts.yEnd + 0.016, -0.295 + ts.flareZ);

    group.add(createLock(THREE, mat, swayItems, {
      points: [p0, p1, p2, p3, p4, p5],
      width: ts.w,
      thick: ts.th,
      swell: 1.16,
      rootTaper: 0.65,
      tipRound: 0.28,
      swayAmp: 0.064, // ~3.7 deg
      swayFreq: 1.75,
      phase: ts.ph,
      outSign: ts.sx >= 0 ? 1 : -1,
      backSign: 1,
    }));
  }
}

// Style: TWIN TAILS — two high tails that fall and curl up at the ends
function addTwinTails(THREE, group, mat, swayItems) {
  for (const side of [-1, 1]) {
    const tiePos = new THREE.Vector3(side * 0.155, 0.245, -0.102);
    const launchDir = new THREE.Vector3(side * 0.78, 0.36, -0.50).normalize();

    // Plump hair band
    group.add(createBand(THREE, mat, tiePos.clone().addScaledVector(launchDir, 0.012), launchDir, 0.034, 0.013));

    // Face-framing side lock in front of ear
    group.add(createLock(THREE, mat, swayItems, {
      points: [
        headPt(THREE, 0.55, side * 0.92, 1.07),
        headPt(THREE, 1.24, side * 1.00, 1.115),
        headPt(THREE, 1.78, side * 0.98, 1.12),
        new THREE.Vector3(side * 0.185, 0.062, 0.068),
      ],
      width: 0.060,
      thick: 0.030,
      swell: 1.10,
      tipRound: 0.28,
      swayAmp: 0.045,
      swayFreq: 2.0,
      phase: side > 0 ? 0.5 : 2.4,
      outSign: side,
    }));

    // 3 plump overlapping locks per high twin-tail, falling and curling UP at the ends
    const subSpecs = [
      { oz: 0.0, ox: 0.0, oy: 0.008, w: 0.084, th: 0.038, yLow: -0.125, ph: side > 0 ? 0.3 : 2.1 },
      { oz: 0.022, ox: 0.015, oy: -0.004, w: 0.072, th: 0.034, yLow: -0.095, ph: side > 0 ? 1.1 : 2.9 },
      { oz: -0.022, ox: -0.010, oy: -0.006, w: 0.072, th: 0.034, yLow: -0.110, ph: side > 0 ? 1.9 : 3.7 },
    ];

    for (const s of subSpecs) {
      const p0 = tiePos.clone().add(new THREE.Vector3(-side * 0.008, s.oy * 0.5, s.oz * 0.3));
      const p1 = new THREE.Vector3(side * (0.228 + s.ox), 0.268 + s.oy, -0.122 + s.oz);
      const p2 = new THREE.Vector3(side * (0.268 + s.ox), 0.125, -0.105 + s.oz);
      const p3 = new THREE.Vector3(side * (0.258 + s.ox), -0.020, -0.085 + s.oz);
      const p4 = new THREE.Vector3(side * (0.278 + s.ox), s.yLow, -0.075 + s.oz);
      // Cheerful upward curl at the tip
      const p5 = new THREE.Vector3(side * (0.326 + s.ox), s.yLow + 0.022, -0.068 + s.oz);
      const p6 = new THREE.Vector3(side * (0.332 + s.ox), s.yLow + 0.064, -0.060 + s.oz);

      group.add(createLock(THREE, mat, swayItems, {
        points: [p0, p1, p2, p3, p4, p5, p6],
        width: s.w,
        thick: s.th,
        swell: 1.15,
        rootTaper: 0.64,
        tipRound: 0.30,
        swayAmp: 0.065, // ~3.7 deg
        swayFreq: 1.72,
        phase: s.ph,
        outSign: side,
        backSign: 1,
      }));
    }
  }
}

// Style: BUN — a plump round clay bun with a wrapped band and sculpted swirl locks
function addBun(THREE, group, mat, swayItems) {
  const bunBase = new THREE.Vector3(0, 0.292, -0.118);
  const bunAxis = new THREE.Vector3(0, 0.72, -0.69).normalize();
  const bunCenter = bunBase.clone().addScaledVector(bunAxis, 0.068);

  // Soft oblate clay bun core
  const bunGeo = new THREE.SphereGeometry(0.092, 32, 24);
  const bunMesh = new THREE.Mesh(bunGeo, mat);
  bunMesh.position.copy(bunCenter);
  bunMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bunAxis);
  bunMesh.scale.set(1.06, 0.86, 1.06);
  bunMesh.castShadow = true;
  bunMesh.receiveShadow = true;
  group.add(bunMesh);

  // Double-wrapped clay band around the bun base
  group.add(createBand(THREE, mat, bunBase.clone().addScaledVector(bunAxis, 0.008), bunAxis, 0.064, 0.016));
  group.add(createBand(THREE, mat, bunBase.clone().addScaledVector(bunAxis, 0.026), bunAxis, 0.072, 0.014));

  // 3 sculpted swirl locks hugging around the bun so it feels richly modeled
  const uAxis = new THREE.Vector3(1, 0, 0);
  const vAxis = new THREE.Vector3().crossVectors(bunAxis, uAxis).normalize();
  for (let k = 0; k < 3; k++) {
    const startAng = (k / 3) * Math.PI * 2;
    const pts = [];
    for (let s = 0; s <= 5; s++) {
      const f = s / 5;
      const ang = startAng + f * Math.PI * 1.15;
      const elev = lerp(-0.025, 0.062, f);
      const rad = lerp(0.082, 0.028, f * f);
      const pt = bunCenter.clone()
        .addScaledVector(bunAxis, elev)
        .addScaledVector(uAxis, Math.cos(ang) * rad)
        .addScaledVector(vAxis, Math.sin(ang) * rad);
      pts.push(pt);
    }
    group.add(createLock(THREE, mat, swayItems, {
      points: pts,
      width: 0.062,
      thick: 0.032,
      swell: 1.12,
      tipRound: 0.34,
      swayAmp: 0,
      collide: false,
    }));
  }

  // Neat sideburn wisps in front of ears
  for (const side of [-1, 1]) {
    group.add(createLock(THREE, mat, swayItems, {
      points: [
        headPt(THREE, 0.62, side * 0.94, 1.065),
        headPt(THREE, 1.28, side * 1.02, 1.10),
        headPt(THREE, 1.72, side * 0.96, 1.10),
      ],
      width: 0.052,
      thick: 0.026,
      swell: 1.06,
      tipRound: 0.28,
      swayAmp: 0.036,
      swayFreq: 2.0,
      phase: side > 0 ? 0.7 : 2.5,
      outSign: side,
    }));
  }
}

// Style: CURLY MEDIUM — plump spiral curls around the head, each a fat helix
function addCurlyMedium(THREE, group, mat, swayItems) {
  const count = 9;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const phi = Math.PI + lerp(-2.12, 2.12, t);
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    const sideSign = sp >= 0 ? 1 : -1;

    // Anchor on upper cap, wrap smoothly down to ear level, then spiral in a fat helix
    const p0 = headPt(THREE, 0.48, phi, 1.075);
    const p1 = headPt(THREE, 1.08, phi, 1.125);
    const helixStart = headPt(THREE, 1.56, phi, 1.16);

    const outDir = new THREE.Vector3(sp, 0, cp).normalize();
    const tanDir = new THREE.Vector3(cp, 0, -sp).normalize();

    const pts = [p0, p1];
    const turns = 1.35;
    const hSteps = 9;
    const hRad = 0.028 + (i % 2) * 0.005;
    const yEnd = -0.012 + (i % 2) * 0.016;
    const hand = sideSign;

    for (let s = 0; s <= hSteps; s++) {
      const f = s / hSteps;
      const ang = f * Math.PI * 2 * turns * hand;
      const rGrow = smoothstep(f * 2.4) * hRad;
      const flareOut = f * 0.024;
      const cx = helixStart.x + outDir.x * flareOut;
      const cz = helixStart.z + outDir.z * flareOut;
      const cy = lerp(helixStart.y, yEnd, f);

      const pt = new THREE.Vector3(
        cx + outDir.x * (Math.cos(ang) * rGrow) + tanDir.x * (Math.sin(ang) * rGrow),
        cy,
        cz + outDir.z * (Math.cos(ang) * rGrow) + tanDir.z * (Math.sin(ang) * rGrow)
      );
      pts.push(pt);
    }

    group.add(createLock(THREE, mat, swayItems, {
      points: pts,
      width: 0.064,
      thick: 0.038,
      swell: 1.12,
      rootTaper: 0.78,
      tipRound: 0.34,
      swayAmp: 0.056, // ~3.2 deg
      swayFreq: 1.85 + (i % 3) * 0.16,
      phase: i * 0.92,
      outSign: sideSign,
      backSign: cp < 0 ? 1 : -1,
    }));
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

  // 1. Hair cap (slightly thicker for buzz)
  const capScale = hairStyle === 'buzz' ? 1.098 : 1.08;
  const capMesh = new THREE.Mesh(buildCapGeometry(THREE, capScale), mat);
  capMesh.name = 'hairCap';
  capMesh.castShadow = true;
  capMesh.receiveShadow = true;
  group.add(capMesh);

  if (hairStyle !== 'buzz') {
    // 2. Fringe
    addFringe(THREE, group, mat, swayItems, fringe);

    // 3. Sides and back by style
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

    // Rotate 2 to 4 degrees about lock root, biasing gently outward so tips never clip
    const rz = (wave * 0.82 + it.outSign * 0.18 * Math.abs(wave)) * it.ampZ * amp;
    const rx = (w2 * 0.75 + it.backSign * 0.25 * Math.abs(w2)) * it.ampX * amp;
    const ry = w1 * it.ampX * 0.35 * amp;

    it.mesh.rotation.set(rx, ry, rz);
  }
}
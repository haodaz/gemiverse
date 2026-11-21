const PI = Math.PI;
const TAU = PI * 2;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Cosine remapping maps y in [0, 1] to u in [0, 1] so profiles meet y = 0 and y = 1
// with horizontal tangents (smooth dome crown & tangent-continuous flat underside).
function yToU(y) {
  return Math.acos(1 - 2 * clamp(y, 0, 1)) / PI;
}

function buildSpline(pairs) {
  const n = pairs.length;
  const ts = new Array(n);
  const vs = new Array(n);
  for (let i = 0; i < n; i++) {
    ts[i] = yToU(pairs[i][0]);
    vs[i] = pairs[i][1];
  }
  const ms = new Array(n);
  ms[0] = (vs[1] - vs[0]) / (ts[1] - ts[0]);
  ms[n - 1] = (vs[n - 1] - vs[n - 2]) / (ts[n - 1] - ts[n - 2]);
  for (let i = 1; i < n - 1; i++) {
    ms[i] = (vs[i + 1] - vs[i - 1]) / (ts[i + 1] - ts[i - 1]);
  }
  return function evalSpline(y) {
    const u = yToU(y);
    if (u <= ts[0]) return vs[0];
    if (u >= ts[n - 1]) return vs[n - 1];
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (ts[mid] <= u) lo = mid;
      else hi = mid;
    }
    const h = ts[hi] - ts[lo];
    const s = (u - ts[lo]) / h;
    const s2 = s * s;
    const s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1;
    const h10 = s3 - 2 * s2 + s;
    const h01 = -2 * s3 + 3 * s2;
    const h11 = s3 - s2;
    return h00 * vs[lo] + h10 * h * ms[lo] + h01 * vs[hi] + h11 * h * ms[hi];
  };
}

// Control values read from reference silhouettes (height y: 0 = jaw underside, 1 = crown).
// Front outline: wider than tall, widest at cheeks below eyes, soft U to small rounded chin.
const HALF_WIDTH_CTRL = [
  [0.000, 0.130],
  [0.020, 0.255],
  [0.060, 0.375],
  [0.115, 0.472],
  [0.185, 0.536],
  [0.265, 0.562],
  [0.370, 0.554],
  [0.520, 0.536],
  [0.680, 0.498],
  [0.800, 0.432],
  [0.900, 0.325],
  [0.960, 0.205],
  [1.000, 0.000],
];

// Side front outline (+z): flat underside -> forward chin shelf -> slight mouth tuck ->
// vertical face plane -> full forehead -> crown.
const FRONT_CTRL = [
  [0.000, 0.290],
  [0.020, 0.415],
  [0.060, 0.488],
  [0.115, 0.522],
  [0.185, 0.464],
  [0.265, 0.478],
  [0.370, 0.486],
  [0.520, 0.490],
  [0.680, 0.482],
  [0.800, 0.430],
  [0.900, 0.310],
  [0.960, 0.180],
  [1.000, 0.000],
];

// Side back outline (-z): flat underside rising gently behind neck -> broad round skull -> crown.
const BACK_CTRL = [
  [0.000, -0.140],
  [0.020, -0.275],
  [0.060, -0.380],
  [0.115, -0.460],
  [0.185, -0.525],
  [0.265, -0.572],
  [0.370, -0.605],
  [0.520, -0.620],
  [0.680, -0.590],
  [0.800, -0.505],
  [0.900, -0.365],
  [0.960, -0.220],
  [1.000,  0.000],
];

const halfWidth = buildSpline(HALF_WIDTH_CTRL);
const front = buildSpline(FRONT_CTRL);
const back = buildSpline(BACK_CTRL);

export const PROFILE = { halfWidth, front, back };

function sectionExponent(y, cosTheta) {
  const faceBand = smoothstep(0.05, 0.24, y) * smoothstep(0.92, 0.62, y);
  const chinBand = smoothstep(0.02, 0.09, y) * smoothstep(0.22, 0.12, y);
  const frontBlend = smoothstep(-0.25, 0.45, cosTheta);
  return 2.0 + (0.48 * faceBand + 0.12 * chinBand) * frontBlend;
}

// Polar superellipse radius: C2-smooth everywhere with uniform vertex spacing.
function superEllipseR(theta, y) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const p = sectionExponent(y, c);
  return Math.pow(Math.pow(Math.abs(s), p) + Math.pow(Math.abs(c), p), -1 / p);
}

// Finds theta in (0, PI) where z(theta) = 0 and x(theta) > 0 so the mesh seam sits
// directly on the u = 0 / 1 meridian (zero UV wrap smearing).
function findSeamTheta(zc, depthHalf, y) {
  let lo = 0.01;
  let hi = PI - 0.01;
  for (let k = 0; k < 18; k++) {
    const mid = 0.5 * (lo + hi);
    const zVal = zc + depthHalf * superEllipseR(mid, y) * Math.cos(mid);
    if (zVal > 0) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

// Soft sculpted displacement on the main skin surface (applied on the front half only).
function sculptDisplacement(x, y, z) {
  const frontMask = smoothstep(0.03, 0.22, z);
  if (frontMask <= 0) return 0;

  const ax = Math.abs(x);

  // Two shallow eye sockets at x = +-0.27, y = 0.36 (~0.17 wide, ~0.19 tall) + upper lid rim.
  const ex = (ax - 0.27) / 0.088;
  const ey = (y - 0.36) / 0.095;
  const er = Math.sqrt(ex * ex + ey * ey);
  const eyeSocket = -0.0125 * smoothstep(1.22, 0.32, er);

  const rimDist = (er - 1.05) / 0.25;
  const lidMask = smoothstep(0.05, 0.55, ey) * smoothstep(1.28, 0.72, Math.abs(ex));
  const eyeLid = 0.0055 * Math.exp(-rimDist * rimDist * 2.1) * lidMask;

  // Tiny nose bump at y = 0.26 with a very soft upper bridge.
  const nx = x / 0.036;
  const ny = (y - 0.26) / 0.032;
  const bx = x / 0.028;
  const by = (y - 0.295) / 0.044;
  const nose = 0.015 * Math.exp(-(nx * nx + ny * ny)) + 0.0028 * Math.exp(-(bx * bx + by * by));

  // Small mouth mound at y = 0.17 with a faint horizontal crease.
  const mx = x / 0.075;
  const my = (y - 0.17) / 0.038;
  const mouthMound = 0.0075 * Math.exp(-(mx * mx + my * my));
  const cx = x / 0.054;
  const cy = (y - 0.17 - 0.0035 * cx * cx) / 0.015;
  const mouthCrease = -0.0045 * Math.exp(-(cx * cx + cy * cy));

  // Cheek fullness at x = +-0.36, y = 0.22.
  const kx = (ax - 0.36) / 0.14;
  const ky = (y - 0.22) / 0.11;
  const cheek = 0.014 * Math.exp(-(kx * kx + ky * ky));

  return frontMask * (eyeSocket + eyeLid + nose + mouthMound + mouthCrease + cheek);
}

function computeHeadU(x, z) {
  let u = 0.25 - Math.atan2(x, z) / TAU;
  u = u - Math.floor(u);
  return u;
}

function buildHeadGeometry(THREE) {
  const SEGMENTS = 144;
  const ROWS = 108;
  const U_MAX = 0.992;
  const stride = SEGMENTS + 1;

  const positions = [];
  const uvs = [];
  const indices = [];

  // Precompute horizontal rows from y = 0 up to near the crown (u = U_MAX).
  const rowU = new Array(ROWS + 1);
  for (let i = 0; i <= ROWS; i++) {
    rowU[i] = (i / ROWS) * U_MAX;
  }

  for (let i = 0; i <= ROWS; i++) {
    const uParam = rowU[i];
    const y = 0.5 * (1 - Math.cos(PI * uParam));
    const hw = halfWidth(y);
    const zf = front(y);
    const zb = back(y);
    const zc = 0.5 * (zf + zb);
    const depthHalf = 0.5 * (zf - zb);
    const theta0 = findSeamTheta(zc, depthHalf, y);

    for (let j = 0; j <= SEGMENTS; j++) {
      const frac = j / SEGMENTS;
      const theta = theta0 - frac * TAU;
      const r = superEllipseR(theta, y);
      let x = hw * r * Math.sin(theta);
      let z = zc + depthHalf * r * Math.cos(theta);

      if (j === 0 || j === SEGMENTS) {
        z = 0;
      }

      const disp = sculptDisplacement(x, y, z);
      if (disp !== 0) {
        const dx = x / (hw * hw + 1e-6);
        const dz = (z - zc) / (depthHalf * depthHalf + 1e-6);
        const len = Math.hypot(dx, dz) || 1;
        x += (dx / len) * disp;
        z += (dz / len) * disp;
      }

      positions.push(x, y, z);
      const uvU = j === 0 ? 0 : j === SEGMENTS ? 1 : computeHeadU(x, z);
      uvs.push(uvU, clamp(y, 0, 1));
    }
  }

  // Main surface quads (CCW outward winding).
  for (let i = 0; i < ROWS; i++) {
    const rowA = i * stride;
    const rowB = (i + 1) * stride;
    for (let j = 0; j < SEGMENTS; j++) {
      const a = rowA + j;
      const b = rowA + j + 1;
      const c = rowB + j + 1;
      const d = rowB + j;
      indices.push(a, d, c, a, c, b);
    }
  }

  // Small top cap closing the crown at (0, 1, 0).
  const topRowStart = ROWS * stride;
  const topCapApexIndices = [];
  for (let j = 0; j < SEGMENTS; j++) {
    const v0 = topRowStart + j;
    const v1 = topRowStart + j + 1;
    const apexIdx = positions.length / 3;
    const uMid = 0.5 * (uvs[v0 * 2] + uvs[v1 * 2]);
    positions.push(0, 1, 0);
    uvs.push(uMid, 1);
    indices.push(v0, apexIdx, v1);
    topCapApexIndices.push(apexIdx);
  }

  // Smooth flat underside cap at y = 0 with two intermediate rings into center.
  const zc0 = 0.5 * (front(0) + back(0));
  const capScales = [0.62, 0.28];
  let prevRingStart = 0;
  const botCapAllIndices = [];

  for (let rIdx = 0; rIdx < capScales.length; rIdx++) {
    const sc = capScales[rIdx];
    const ringStart = positions.length / 3;
    for (let j = 0; j <= SEGMENTS; j++) {
      const x0 = positions[j * 3];
      const z0 = positions[j * 3 + 2];
      const x = x0 * sc;
      const z = zc0 + (z0 - zc0) * sc;
      positions.push(x, 0, z);
      const uvU = j === 0 ? 0 : j === SEGMENTS ? 1 : computeHeadU(x, z);
      uvs.push(uvU, 0);
      botCapAllIndices.push(ringStart + j);
    }
    for (let j = 0; j < SEGMENTS; j++) {
      const a = prevRingStart + j;
      const b = prevRingStart + j + 1;
      const c = ringStart + j + 1;
      const d = ringStart + j;
      indices.push(a, b, c, a, c, d);
    }
    prevRingStart = ringStart;
  }

  for (let j = 0; j < SEGMENTS; j++) {
    const v0 = prevRingStart + j;
    const v1 = prevRingStart + j + 1;
    const centerIdx = positions.length / 3;
    const uMid = 0.5 * (uvs[v0 * 2] + uvs[v1 * 2]);
    positions.push(0, 0, zc0);
    uvs.push(uMid, 0);
    indices.push(v0, v1, centerIdx);
    botCapAllIndices.push(centerIdx);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  // Weld normals across the longitudinal UV seam and flatten cap pole normals.
  const norm = geo.getAttribute('normal');
  for (let i = 0; i <= ROWS; i++) {
    const i0 = i * stride;
    const i1 = i0 + SEGMENTS;
    const nx = norm.getX(i0) + norm.getX(i1);
    const ny = norm.getY(i0) + norm.getY(i1);
    const nz = norm.getZ(i0) + norm.getZ(i1);
    const len = Math.hypot(nx, ny, nz) || 1;
    norm.setXYZ(i0, nx / len, ny / len, nz / len);
    norm.setXYZ(i1, nx / len, ny / len, nz / len);
  }
  for (let k = 0; k < topCapApexIndices.length; k++) {
    norm.setXYZ(topCapApexIndices[k], 0, 1, 0);
  }
  for (let k = 0; k < botCapAllIndices.length; k++) {
    norm.setXYZ(botCapAllIndices[k], 0, -1, 0);
  }
  norm.needsUpdate = true;

  return geo;
}

// Smooth cupped chibi ear (flattened bowl, folded outer rim, inner hollow).
function buildEarGeometry(THREE, side) {
  const LAT = 30;
  const LON = 44;
  const stride = LON + 1;

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= LAT; i++) {
    const v = i / LAT;
    const lat = -0.5 * PI + 0.003 + v * (PI - 0.006);
    const sx = Math.sin(lat);
    const r = Math.cos(lat);

    for (let j = 0; j <= LON; j++) {
      const u = j / LON;
      const lon = u * TAU;
      const sy = r * Math.sin(lon);
      const sz = r * Math.cos(lon);

      const widthScale = 0.068 * (1 + 0.14 * sy - 0.08 * sy * sy);
      const y = sy * 0.10;
      const z = sz * widthScale - 0.011 * sy * sy;

      const baseThick = 0.022 * sx;
      const cup = 0.014 * r * r * (0.5 - 0.5 * sz);

      const rimMask = smoothstep(-0.3, 0.4, sx) * smoothstep(0.75, -0.2, sz);
      const rimD = (r - 0.84) / 0.19;
      const rim = 0.016 * Math.exp(-rimD * rimD) * rimMask;

      const hollowMask = smoothstep(0.0, 0.55, sx);
      const hy = (sy + 0.08) / 0.58;
      const hz = (sz - 0.08) / 0.55;
      const hollow = -0.026 * Math.exp(-(hy * hy + hz * hz) * 1.4) * hollowMask;

      const localX = baseThick + cup + rim + hollow;
      positions.push(side * localX, y, z);
      uvs.push(u, v);
    }
  }

  for (let i = 0; i < LAT; i++) {
    const rA = i * stride;
    const rB = (i + 1) * stride;
    for (let j = 0; j < LON; j++) {
      const a = rA + j;
      const b = rB + j;
      const c = rB + j + 1;
      const d = rA + j + 1;
      if (side > 0) {
        indices.push(a, b, c, a, c, d);
      } else {
        indices.push(a, c, b, a, d, c);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const norm = geo.getAttribute('normal');
  for (let i = 0; i <= LAT; i++) {
    const i0 = i * stride;
    const i1 = i0 + LON;
    const nx = norm.getX(i0) + norm.getX(i1);
    const ny = norm.getY(i0) + norm.getY(i1);
    const nz = norm.getZ(i0) + norm.getZ(i1);
    const len = Math.hypot(nx, ny, nz) || 1;
    norm.setXYZ(i0, nx / len, ny / len, nz / len);
    norm.setXYZ(i1, nx / len, ny / len, nz / len);
  }
  norm.needsUpdate = true;

  return geo;
}

// Short neck (radius 0.085, length 0.2) descending from underside at z = 0 with rounded plug.
function buildNeckGeometry(THREE) {
  const radius = 0.085;
  const length = 0.20;
  const plugCenterY = -(length - radius);
  const pts = [];

  const plugSteps = 14;
  for (let i = 0; i <= plugSteps; i++) {
    const a = -0.5 * PI + (i / plugSteps) * (0.5 * PI);
    const r = Math.max(0.0001, radius * Math.cos(a));
    const y = plugCenterY + radius * Math.sin(a);
    pts.push(new THREE.Vector2(r, y));
  }

  const shaftSteps = 10;
  for (let i = 1; i <= shaftSteps; i++) {
    const t = i / shaftSteps;
    const y = plugCenterY + t * (0.035 - plugCenterY);
    const flare = smoothstep(-0.04, 0.035, y);
    const r = radius + 0.012 * flare * flare;
    pts.push(new THREE.Vector2(r, y));
  }
  pts.push(new THREE.Vector2(0.0001, 0.035));

  const geo = new THREE.LatheGeometry(pts, 48);
  geo.computeVertexNormals();
  return geo;
}

export function buildHeadShape(THREE, opts = {}) {
  const skinColor = opts && opts.skin !== undefined ? opts.skin : 0xf5d6c3;
  const skinMat = new THREE.MeshPhysicalMaterial({
    color: skinColor,
    roughness: 0.62,
    sheen: 0.3,
    sheenRoughness: 0.6,
  });
  const auxSkinMat = skinMat.clone();

  const group = new THREE.Group();

  const headSkin = new THREE.Mesh(buildHeadGeometry(THREE), skinMat);
  headSkin.name = 'headSkin';
  group.add(headSkin);

  const earY = 0.33;
  const earZ = -0.05;
  const earX = halfWidth(earY) - 0.016;
  const earOutAngle = (25 * PI) / 180;
  const earTiltZ = (5 * PI) / 180;

  const earL = new THREE.Mesh(buildEarGeometry(THREE, 1), auxSkinMat);
  earL.name = 'earL';
  earL.position.set(earX, earY, earZ);
  earL.rotation.set(0, -earOutAngle, -earTiltZ);
  group.add(earL);

  const earR = new THREE.Mesh(buildEarGeometry(THREE, -1), auxSkinMat);
  earR.name = 'earR';
  earR.position.set(-earX, earY, earZ);
  earR.rotation.set(0, earOutAngle, earTiltZ);
  group.add(earR);

  const neck = new THREE.Mesh(buildNeckGeometry(THREE), auxSkinMat);
  neck.name = 'neck';
  group.add(neck);

  return group;
}
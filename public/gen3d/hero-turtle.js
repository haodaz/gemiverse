export const META = {
  id: 'cozy-turtle',
  name: 'Cozy Walking Turtle',
  kind: 'critter',
  footprint: [0.22, 0.32],
  variants: ['classic', 'sunburst', 'moss', 'starlight'],
  note: 'Stylised 0.3 m walking tortoise with sculpted anatomical scutes, hand-painted shell patterns, and a gentle forward-stretched face.'
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
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
    freq *= 2.07;
  }
  return sum / norm;
}

function colorToRgb(col) {
  const hex = col.getHex();
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function rgbStr(r, g, b, a = 1) {
  const rr = clamp(Math.round(r), 0, 255);
  const gg = clamp(Math.round(g), 0, 255);
  const bb = clamp(Math.round(b), 0, 255);
  return a < 1 ? `rgba(${rr},${gg},${bb},${a.toFixed(3)})` : `rgb(${rr},${gg},${bb})`;
}

function shiftColor(THREE, col, dh, ds, dl) {
  const c = col.clone();
  c.offsetHSL(dh, ds, dl);
  return c;
}

// Anatomical tortoise carapace scute layout in azimuthal UV space [0..1] x [0..1]
// Center (0.5, 0.5) is shell crown; v -> 1 is front (+z), u -> 1 is left (+x)
function createScuteLayout() {
  const sites = [];
  // 5 central vertebral scutes along spine (kind 0)
  const vPos = [0.765, 0.635, 0.50, 0.365, 0.235];
  for (let i = 0; i < vPos.length; i++) {
    sites.push({ u: 0.5, v: vPos[i], kind: 0, id: sites.length, seed: (i + 1) * 1.37 });
  }
  // 4 pairs of costal scutes flanking left and right, staggered for hexagonal interlocking (kind 1)
  const cSpec = [
    [0.195, 0.70],
    [0.218, 0.565],
    [0.218, 0.432],
    [0.188, 0.295]
  ];
  for (let i = 0; i < cSpec.length; i++) {
    const [du, v] = cSpec[i];
    sites.push({ u: 0.5 + du, v, kind: 1, id: sites.length, seed: (i + 7) * 2.13 });
    sites.push({ u: 0.5 - du, v, kind: 1, id: sites.length, seed: (i + 13) * 1.91 });
  }
  // 16 marginal scutes forming the flared lower shell rim (kind 2)
  const mCount = 16;
  for (let i = 0; i < mCount; i++) {
    const a = (i / mCount) * Math.PI * 2 + Math.PI / mCount;
    const u = 0.5 + Math.cos(a) * 0.388;
    const v = 0.5 + Math.sin(a) * 0.398;
    sites.push({ u, v, kind: 2, id: sites.length, seed: (i + 21) * 1.63 });
  }

  const count = sites.length;
  const su = new Float32Array(count);
  const sv = new Float32Array(count);
  const sk = new Uint8Array(count);
  const ss = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    su[i] = sites[i].u;
    sv[i] = sites[i].v;
    sk[i] = sites[i].kind;
    ss[i] = sites[i].seed;
  }

  return function evalScute(u, v) {
    let i1 = 0;
    let d1Sq = 1e9;
    for (let i = 0; i < count; i++) {
      const du = u - su[i];
      const dv = v - sv[i];
      const dSq = du * du + dv * dv;
      if (dSq < d1Sq) {
        d1Sq = dSq;
        i1 = i;
      }
    }
    const p1u = su[i1];
    const p1v = sv[i1];
    let minEdge = 1e9;
    for (let j = 0; j < count; j++) {
      if (j === i1) continue;
      const bu = su[j] - p1u;
      const bv = sv[j] - p1v;
      const len = Math.sqrt(bu * bu + bv * bv);
      const mu = 0.5 * (p1u + su[j]);
      const mv = 0.5 * (p1v + sv[j]);
      const ed = ((mu - u) * bu + (mv - v) * bv) / len;
      if (ed < minEdge) minEdge = ed;
    }
    const du = u - p1u;
    const dv = v - p1v;
    const centerDist = Math.sqrt(du * du + dv * dv);
    const angle = Math.atan2(dv, du);
    return {
      id: i1,
      kind: sk[i1],
      seed: ss[i1],
      edgeDist: Math.max(0, minEdge),
      centerDist,
      angle
    };
  };
}

// Ring-by-ring tapered organic tube along a CatmullRomCurve3 with parallel-transport frames,
// elliptical/wrinkled cross sections, smooth hemispherical caps, and optional floor flattening.
function createTaperedTube(THREE, curve, segs, radSegs, radiusFn, opts = {}) {
  const {
    capStart = true,
    capEnd = true,
    capRings = 6,
    floorY = null,
    soleBevel = 0.008,
    twist = 0
  } = opts;

  const pts = [];
  const tans = [];
  const norms = [];
  const binorms = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push(curve.getPoint(t));
    tans.push(curve.getTangent(t).normalize());
  }

  // Parallel transport frame to avoid Frenet flips
  const ref = Math.abs(tans[0].y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const n0 = new THREE.Vector3().crossVectors(tans[0], ref).normalize();
  const b0 = new THREE.Vector3().crossVectors(tans[0], n0).normalize();
  norms.push(n0);
  binorms.push(b0);

  for (let i = 1; i <= segs; i++) {
    const prevT = tans[i - 1];
    const curT = tans[i];
    const axis = new THREE.Vector3().crossVectors(prevT, curT);
    const sinA = axis.length();
    const n = norms[i - 1].clone();
    if (sinA > 1e-6) {
      axis.divideScalar(sinA);
      const cosA = clamp(prevT.dot(curT), -1, 1);
      n.applyAxisAngle(axis, Math.atan2(sinA, cosA));
    }
    n.addScaledVector(curT, -n.dot(curT)).normalize();
    const b = new THREE.Vector3().crossVectors(curT, n).normalize();
    norms.push(n);
    binorms.push(b);
  }

  const rings = [];

  // Start hemisphere cap
  if (capStart) {
    const rSpec = radiusFn(0, 0);
    const capLen = 0.5 * (rSpec.rx + rSpec.ry) * 0.85;
    for (let k = capRings; k >= 1; k--) {
      const phi = (k / capRings) * (Math.PI * 0.5);
      const scale = Math.cos(phi);
      const offset = -Math.sin(phi) * capLen;
      rings.push({
        center: pts[0].clone().addScaledVector(tans[0], offset),
        n: norms[0],
        b: binorms[0],
        t: 0,
        scale,
        v: 0
      });
    }
  }

  // Main tube body rings
  for (let i = 0; i <= segs; i++) {
    rings.push({
      center: pts[i],
      n: norms[i],
      b: binorms[i],
      t: i / segs,
      scale: 1,
      v: i / segs
    });
  }

  // End hemisphere cap
  if (capEnd) {
    const rSpec = radiusFn(1, 0);
    const capLen = 0.5 * (rSpec.rx + rSpec.ry) * 0.92;
    for (let k = 1; k <= capRings; k++) {
      const phi = (k / capRings) * (Math.PI * 0.5);
      const scale = Math.cos(phi);
      const offset = Math.sin(phi) * capLen;
      rings.push({
        center: pts[segs].clone().addScaledVector(tans[segs], offset),
        n: norms[segs],
        b: binorms[segs],
        t: 1,
        scale,
        v: 1
      });
    }
  }

  const ringCount = rings.length;
  const cols = radSegs + 1;
  const positions = new Float32Array(ringCount * cols * 3);
  const uvs = new Float32Array(ringCount * cols * 2);
  const indices = [];

  const tmp = new THREE.Vector3();
  for (let r = 0; r < ringCount; r++) {
    const ring = rings[r];
    const twistA = ring.t * twist;
    for (let c = 0; c <= radSegs; c++) {
      const u = c / radSegs;
      const ang = u * Math.PI * 2 + twistA;
      const spec = radiusFn(ring.t, ang);
      const rx = spec.rx * ring.scale;
      const ry = spec.ry * ring.scale;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);

      tmp.copy(ring.center)
        .addScaledVector(ring.n, ca * rx)
        .addScaledVector(ring.b, sa * ry);

      if (floorY !== null && tmp.y < floorY + soleBevel) {
        if (tmp.y <= floorY) {
          // Softly cushion outward as the paw pad compresses onto the floor
          const squash = clamp((floorY - tmp.y) / 0.012, 0, 1);
          const dx = tmp.x - ring.center.x;
          const dz = tmp.z - ring.center.z;
          tmp.x += dx * squash * 0.14;
          tmp.z += dz * squash * 0.14;
          tmp.y = floorY;
        } else {
          const blend = (tmp.y - floorY) / soleBevel;
          tmp.y = floorY + soleBevel * (blend * blend * (3 - 2 * blend)) * 0.85;
        }
      }

      const idx = r * cols + c;
      positions[idx * 3] = tmp.x;
      positions[idx * 3 + 1] = tmp.y;
      positions[idx * 3 + 2] = tmp.z;
      uvs[idx * 2] = u;
      uvs[idx * 2 + 1] = ring.v;
    }
  }

  for (let r = 0; r < ringCount - 1; r++) {
    for (let c = 0; c < radSegs; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = (r + 1) * cols + c;
      const e = d + 1;
      indices.push(a, d, b);
      indices.push(b, d, e);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Sculpted continuous turtle head surface evaluator on unit sphere direction (nx, ny, nz).
// Used both to sculpt the dense mesh AND to seat eyes, nostrils, mouth, and blush cleanly on the surface.
function evaluateHeadPoint(nx, ny, nz) {
  let x = nx * 0.0305;
  let y = ny * 0.0268;
  let z = nz * 0.0375;

  // Elongate and gently taper forward into a sweet rounded snout/beak (+z)
  const front = smoothstep(-0.05, 0.98, nz);
  const snoutTaper = 1 - 0.34 * front * front;
  x *= snoutTaper;
  y *= 1 - 0.28 * front * front;
  z += 0.0072 * front * front;

  // Gentle beak curve: slight rounded downward arch at the very tip of upper snout
  const tip = smoothstep(0.55, 1.0, nz);
  y -= 0.0036 * tip * (1 - 0.4 * Math.max(0, ny));

  // Cozy rounded cranium dome slightly taller toward back-center
  const crown = smoothstep(0.15, 0.95, ny) * smoothstep(-0.75, 0.45, nz);
  y += 0.0028 * crown;

  // Soft chubby cheeks bulging warmly on lower front-sides
  const ax = Math.abs(nx);
  const cheek = smoothstep(0.32, 0.86, ax)
    * smoothstep(-0.62, -0.02, ny) * (1 - smoothstep(0.08, 0.52, ny))
    * smoothstep(-0.35, 0.25, nz) * (1 - smoothstep(0.58, 0.92, nz));
  x += Math.sign(nx) * 0.0052 * cheek;
  y -= 0.0014 * cheek;

  // Sculpted gentle eye sockets (subtle recessed hollows) + soft brow ridges above
  const ex = 0.65, ey = 0.22, ez = 0.727; // normalized eye direction
  const eDot = clamp(ax * ex + ny * ey + nz * ez, -1, 1);
  const eAng = Math.acos(eDot);
  const socket = Math.exp(-(eAng * eAng) / (0.24 * 0.24));
  const radialPush = -0.0028 * socket;

  // Soft brow cushion just above the eye socket
  const bx = 0.56, by = 0.52, bz = 0.645;
  const bDot = clamp(ax * bx + ny * by + nz * bz, -1, 1);
  const bAng = Math.acos(bDot);
  const brow = Math.exp(-(bAng * bAng) / (0.26 * 0.26));
  const browPush = 0.0024 * brow;

  const rPush = radialPush + browPush;
  x += nx * rPush;
  y += ny * rPush;
  z += nz * rPush;

  // Softly flatten the jaw/throat underside and taper the back cleanly into the neck
  if (ny < -0.25) {
    const flat = smoothstep(-0.25, -0.95, ny);
    y += 0.0046 * flat;
  }
  const back = smoothstep(-0.15, -0.95, nz);
  x *= 1 - 0.18 * back;
  y *= 1 - 0.14 * back;
  y -= 0.0032 * back; // dips smoothly into the curved neck

  // Subtle nostril dimples on upper tip of snout
  const nDot = clamp(ax * 0.19 + ny * 0.16 + nz * 0.968, -1, 1);
  const nAng = Math.acos(nDot);
  const nostril = Math.exp(-(nAng * nAng) / (0.065 * 0.065));
  z -= 0.0011 * nostril;

  return { x, y, z };
}

function buildSculptedHeadGeometry(THREE) {
  const geo = new THREE.SphereGeometry(1, 56, 40);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);
    const p = evaluateHeadPoint(nx, ny, nz);
    pos.setXYZ(i, p.x, p.y, p.z);
    // Clean front-facing spherical UVs for skin shading (v=1 top, v=0 chin/throat)
    const u = 0.5 + Math.atan2(nx, nz) / (Math.PI * 2);
    const v = 0.5 + Math.asin(clamp(ny, -1, 1)) / Math.PI;
    uv.setXY(i, u, v);
  }
  geo.computeVertexNormals();
  return geo;
}

// Sculpted domed carapace with real Voronoi scutes, grooves, concentric growth rings,
// subtle front neck arch, and flared marginal skirt that tucks cleanly into the plastron.
function buildCarapaceGeometry(THREE, evalScute, kit) {
  const geo = new THREE.SphereGeometry(1, 76, 52);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  const rx = 0.088;
  const rz = 0.111;
  const domeH = 0.098;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    const phi = Math.acos(clamp(ny, -1, 1)); // 0 at crown, pi/2 equator, pi bottom
    const theta = Math.atan2(nz, nx);
    const ct = Math.cos(theta);
    const st = Math.sin(theta);

    const rimPhi = 0.56 * Math.PI;
    const isUnder = phi > rimPhi;
    const tDome = clamp(phi / rimPhi, 0, 1);

    // Azimuthal equidistant UV projection (seam-free and matches canvas pixel coordinates)
    const rho = Math.min(tDome, 1.0) * 0.475;
    const u = 0.5 + rho * ct;
    const v = 0.5 + rho * st;
    uv.setXY(i, u, v);

    let x, y, z;
    if (!isUnder) {
      // High, friendly storybook dome profile with subtle flared marginal brim
      const rad = Math.sin(tDome * Math.PI * 0.5);
      const flare = smoothstep(0.76, 1.0, tDome) * 0.065;
      const rearTaper = nz < 0 ? 1 - 0.08 * (-nz) * rad : 1 - 0.05 * nz * rad;

      const rScale = (rad + flare) * rearTaper;
      x = ct * rx * rScale;
      z = st * rz * rScale;

      // Slightly higher warm hump slightly toward mid-back, cozy rounded crown
      const domeProfile = Math.pow(Math.cos(tDome * Math.PI * 0.5), 0.78);
      y = domeProfile * domeH + 0.004 * Math.sin(tDome * Math.PI) * (-st * 0.35);

      // Gentle upward arches at the rim for neck (front), legs (sides), and tail (rear)
      const rimMask = smoothstep(0.68, 1.0, tDome);
      const neckArch = Math.pow(Math.max(0, st), 4.5) * 0.0155;
      const tailArch = Math.pow(Math.max(0, -st), 5.0) * 0.0085;
      const legArch = Math.pow(Math.abs(ct) * Math.max(0, 0.9 - Math.abs(st) * 0.4), 2.5) * 0.005;
      y += rimMask * (neckArch + tailArch + legArch);

      // Sculpted Voronoi scute relief
      const sc = evalScute(u, v);
      const groove = 1 - smoothstep(0.002, 0.017, sc.edgeDist);
      const puff = Math.pow(smoothstep(0.006, 0.068, sc.edgeDist), 0.72);
      const ringWave = Math.sin(sc.edgeDist * 210) * smoothstep(0.012, 0.032, sc.edgeDist) * (1 - smoothstep(0.05, 0.11, sc.edgeDist));

      const kindAmp = sc.kind === 0 ? 0.0056 : sc.kind === 1 ? 0.0049 : 0.0031;
      const organic = (kit.noise(u * 14, v * 14) - 0.5) * 0.0011;
      const scuteFade = 1 - smoothstep(0.92, 1.0, tDome) * 0.55;
      const disp = (puff * kindAmp - groove * 0.0040 + ringWave * 0.00055 + organic) * scuteFade;

      // Displace outward along approximate surface normal
      const len = Math.sqrt((x / rx) ** 2 + (Math.max(y, 0.005) / domeH) ** 2 + (z / rz) ** 2) || 1;
      x += ((x / rx) / len) * disp * 0.85;
      y += ((Math.max(y, 0.005) / domeH) / len) * disp;
      z += ((z / rz) / len) * disp * 0.85;
    } else {
      // Smoothly curl rim lip inward and underneath to close the shell cavity cleanly
      const uT = (phi - rimPhi) / (Math.PI - rimPhi);
      const rearTaper = nz < 0 ? 1 - 0.08 * (-nz) : 1 - 0.05 * nz;
      const lipOut = (1.065 - uT * 0.42) * rearTaper;
      const shrink = Math.cos(uT * Math.PI * 0.5);
      x = ct * rx * lipOut * (0.35 + 0.65 * shrink);
      z = st * rz * lipOut * (0.35 + 0.65 * shrink);
      const neckArch = Math.pow(Math.max(0, st), 4.5) * 0.0155;
      const tailArch = Math.pow(Math.max(0, -st), 5.0) * 0.0085;
      const legArch = Math.pow(Math.abs(ct) * Math.max(0, 0.9 - Math.abs(st) * 0.4), 2.5) * 0.005;
      const rimY = neckArch + tailArch + legArch;
      y = mix(rimY, 0.016, smoothstep(0, 0.45, uT)) - Math.sin(uT * Math.PI) * 0.006;
    }

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

// Sculpted continuous undershell (plastron) with subtle gular curve, bridge flares, and medial seam
function buildPlastronGeometry(THREE) {
  const geo = new THREE.SphereGeometry(1, 48, 32);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    let x = nx * 0.072;
    let y = ny * 0.017;
    let z = nz * 0.095;

    // Narrow slightly near leg openings (front-sides and rear-sides), flare at middle bridges
    const midBridge = Math.exp(-((nz * 1.4) ** 2));
    x *= 0.86 + 0.24 * midBridge;

    // Flatten the bottom belly gently, curve front (gular) & rear slightly upward
    if (ny < 0) {
      y *= 0.72;
    }
    const frontUp = smoothstep(0.45, 1.0, nz) * 0.010;
    const rearUp = smoothstep(-0.45, -1.0, nz) * 0.008;
    const sideBridgeUp = smoothstep(0.65, 1.0, Math.abs(nx)) * midBridge * 0.012;
    y += frontUp + rearUp + sideBridgeUp;

    // Subtle medial seam and 3 transverse plastron scute grooves on the underside
    if (ny < 0.1) {
      const mGroove = Math.exp(-((nx * 14) ** 2)) * 0.0014;
      const tGroove = (
        Math.exp(-(((nz - 0.35) * 14) ** 2)) +
        Math.exp(-(((nz + 0.02) * 14) ** 2)) +
        Math.exp(-(((nz + 0.42) * 14) ** 2))
      ) * 0.0011;
      y += (mGroove + tGroove) * (1 - smoothstep(-0.1, 0.2, ny));
    }

    pos.setXYZ(i, x, y, z);
    uv.setXY(i, 0.5 + nx * 0.46, 0.5 + nz * 0.46);
  }
  geo.computeVertexNormals();
  return geo;
}

// Bent beveled ExtrudeGeometry claw/toenail
function buildClawGeometry(THREE, length = 0.011, width = 0.0042) {
  const shape = new THREE.Shape();
  shape.moveTo(-width * 0.5, 0);
  shape.bezierCurveTo(-width * 0.55, length * 0.45, -width * 0.28, length * 0.85, 0, length);
  shape.bezierCurveTo(width * 0.28, length * 0.85, width * 0.55, length * 0.45, width * 0.5, 0);
  shape.bezierCurveTo(width * 0.25, -length * 0.14, -width * 0.25, -length * 0.14, -width * 0.5, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width * 0.55,
    bevelEnabled: true,
    bevelThickness: width * 0.24,
    bevelSize: width * 0.2,
    bevelSegments: 3,
    curveSegments: 10
  });

  // Re-orient so +z is forward along claw, +y is up, and curve downward gracefully
  geo.rotateX(Math.PI * 0.5);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const t = clamp(z / length, 0, 1);
    // Taper thickness toward claw tip and curl gently downward
    y *= 1 - 0.62 * t;
    y -= 0.0036 * t * t;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Bent beveled ExtrudeGeometry tortoise foreleg osteoderm scale
function buildLegScaleGeometry(THREE, w = 0.011, h = 0.0085) {
  const shape = new THREE.Shape();
  shape.moveTo(0, h * 0.52);
  shape.bezierCurveTo(w * 0.55, h * 0.48, w * 0.58, -h * 0.15, w * 0.34, -h * 0.48);
  shape.bezierCurveTo(w * 0.12, -h * 0.58, -w * 0.12, -h * 0.58, -w * 0.34, -h * 0.48);
  shape.bezierCurveTo(-w * 0.58, -h * 0.15, -w * 0.55, h * 0.48, 0, h * 0.52);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0018,
    bevelEnabled: true,
    bevelThickness: 0.0012,
    bevelSize: 0.0011,
    bevelSegments: 3,
    curveSegments: 10
  });

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);
    // Bend snugly around foreleg cylinder curvature
    const bend = (x * x) * 28 + (y * y) * 14;
    z -= bend;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

// LatheGeometry glossy eye dome (20-point profile with subtle anatomical corneal bulge)
function buildEyeLatheGeometry(THREE, radius = 0.0082) {
  const pts = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ang = t * Math.PI; // 0 = front apex (+y in lathe), pi = back pole
    let r = Math.sin(ang) * radius;
    let y = Math.cos(ang) * radius * 0.72;
    // Slight realistic corneal dome lift near front apex
    if (t < 0.45) {
      const c = Math.cos((t / 0.45) * Math.PI * 0.5);
      y += c * radius * 0.16;
    }
    pts.push(new THREE.Vector2(Math.max(0.00005, r), y));
  }
  const geo = new THREE.LatheGeometry(pts, 28);
  geo.rotateX(Math.PI * 0.5); // point apex along +z
  geo.computeVertexNormals();
  return geo;
}

// Procedural CanvasTextures for the carapace (color, bump, roughness, and optional starlight emissive)
function createShellTextures(THREE, kit, evalScute, shellCol, variant) {
  const size = 512;
  const baseRgb = colorToRgb(shellCol);
  const darkCol = shiftColor(THREE, shellCol, -0.015, 0.08, -0.26);
  const lightCol = shiftColor(THREE, shellCol, 0.045, 0.12, 0.22);
  const rimCol = shiftColor(THREE, shellCol, 0.03, -0.05, 0.12);

  const darkRgb = colorToRgb(darkCol);
  const lightRgb = colorToRgb(lightCol);
  const rimRgb = colorToRgb(rimCol);

  const mossRgb = [96, 128, 76];
  const goldRgb = [238, 198, 108];
  const twilightRgb = [
    mix(baseRgb[0], 54, 0.58),
    mix(baseRgb[1], 56, 0.58),
    mix(baseRgb[2], 108, 0.62)
  ];

  const colorTex = kit.canvasTexture(size, size, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;

    for (let py = 0; py < h; py++) {
      const v = 1 - (py + 0.5) / h;
      for (let px = 0; px < w; px++) {
        const u = (px + 0.5) / w;
        const sc = evalScute(u, v);

        const nFine = kit.noise(u * 26 + sc.seed, v * 26 - sc.seed);
        const nBroad = fbm(kit, u * 7 + sc.seed * 0.3, v * 7 + sc.seed * 0.2, 3);
        const scuteTint = (Math.sin(sc.seed * 12.7) * 0.5 + 0.5) * 0.16 - 0.08;

        // Groove dark seam & concentric growth rings
        const groove = 1 - smoothstep(0.002, 0.015, sc.edgeDist);
        const centerGlow = Math.exp(-((sc.centerDist / (sc.kind === 2 ? 0.05 : 0.072)) ** 2));
        const rings = 0.5 + 0.5 * Math.sin(sc.edgeDist * 225 + nFine * 1.4);
        const ringBand = rings * smoothstep(0.01, 0.035, sc.edgeDist) * (1 - centerGlow * 0.7);

        let r, g, b;

        if (variant === 'sunburst') {
          // Radiated tortoise golden sunburst rays fanning from each scute center
          const rayCount = sc.kind === 2 ? 6 : 10;
          const rayVal = Math.pow(0.5 + 0.5 * Math.cos(sc.angle * rayCount + sc.seed * 3.1 + nFine * 0.35), 2.4);
          const rayMask = smoothstep(0.008, 0.025, sc.edgeDist) * (1 - smoothstep(0.06, 0.13, sc.centerDist) * 0.35);
          const rayStrength = clamp(centerGlow * 0.85 + rayVal * rayMask * 0.82, 0, 1);
          const bgR = mix(darkRgb[0], baseRgb[0], 0.55);
          const bgG = mix(darkRgb[1], baseRgb[1], 0.55);
          const bgB = mix(darkRgb[2], baseRgb[2], 0.55);
          const warmR = mix(lightRgb[0], goldRgb[0], 0.55);
          const warmG = mix(lightRgb[1], goldRgb[1], 0.55);
          const warmB = mix(lightRgb[2], goldRgb[2], 0.45);
          r = mix(bgR, warmR, rayStrength);
          g = mix(bgG, warmG, rayStrength);
          b = mix(bgB, warmB, rayStrength);
          r -= ringBand * 12;
          g -= ringBand * 10;
          b -= ringBand * 8;
        } else if (variant === 'moss') {
          // Woodland earthy shell with velvety moss nestled along grooves & warm worn crowns
          const mossPatch = smoothstep(0.42, 0.74, fbm(kit, u * 11 + 2.3, v * 11 + 5.1, 3))
            * (0.45 + 0.55 * (1 - smoothstep(0.01, 0.055, sc.edgeDist)));
          r = mix(baseRgb[0], lightRgb[0], centerGlow * 0.52);
          g = mix(baseRgb[1], lightRgb[1], centerGlow * 0.52);
          b = mix(baseRgb[2], lightRgb[2], centerGlow * 0.42);
          r = mix(r, mossRgb[0] + nFine * 24, mossPatch * 0.78);
          g = mix(g, mossRgb[1] + nFine * 28, mossPatch * 0.78);
          b = mix(b, mossRgb[2] + nFine * 14, mossPatch * 0.78);
          r -= ringBand * 14;
          g -= ringBand * 12;
          b -= ringBand * 10;
        } else if (variant === 'starlight') {
          // Cozy twilight storybook shell with warm antique gold rim highlights & dreamy centers
          const centerHalo = Math.exp(-((sc.centerDist / 0.048) ** 2));
          const borderGold = smoothstep(0.008, 0.014, sc.edgeDist) * (1 - smoothstep(0.014, 0.022, sc.edgeDist));
          r = mix(twilightRgb[0], twilightRgb[0] + 34, centerHalo * 0.65 + nBroad * 0.3);
          g = mix(twilightRgb[1], twilightRgb[1] + 28, centerHalo * 0.65 + nBroad * 0.3);
          b = mix(twilightRgb[2], twilightRgb[2] + 44, centerHalo * 0.7 + nBroad * 0.3);
          r = mix(r, goldRgb[0], borderGold * 0.55);
          g = mix(g, goldRgb[1], borderGold * 0.55);
          b = mix(b, goldRgb[2], borderGold * 0.55);
        } else {
          // 'classic' — warm hand-painted tortoiseshell with honey areolas and crisp growth rings
          const edgeDark = 1 - smoothstep(0.01, 0.058, sc.edgeDist);
          r = mix(baseRgb[0], lightRgb[0], centerGlow * 0.68);
          g = mix(baseRgb[1], lightRgb[1], centerGlow * 0.64);
          b = mix(baseRgb[2], lightRgb[2], centerGlow * 0.52);
          if (sc.kind === 2) {
            r = mix(r, rimRgb[0], 0.38);
            g = mix(g, rimRgb[1], 0.38);
            b = mix(b, rimRgb[2], 0.35);
          }
          r = mix(r, darkRgb[0], edgeDark * 0.45);
          g = mix(g, darkRgb[1], edgeDark * 0.45);
          b = mix(b, darkRgb[2], edgeDark * 0.45);
          r += (ringBand - 0.5) * 18;
          g += (ringBand - 0.5) * 14;
          b += (ringBand - 0.5) * 10;
        }

        // Subtle organic variation and warm dark carved seam lines
        const varAmt = (nBroad - 0.5) * 20 + scuteTint * 90 + (nFine - 0.5) * 10;
        r = mix(r + varAmt, darkRgb[0] * 0.48, groove * 0.88);
        g = mix(g + varAmt * 0.9, darkRgb[1] * 0.46, groove * 0.88);
        b = mix(b + varAmt * 0.8, darkRgb[2] * 0.44, groove * 0.88);

        const idx = (py * w + px) * 4;
        data[idx] = clamp(Math.round(r), 0, 255);
        data[idx + 1] = clamp(Math.round(g), 0, 255);
        data[idx + 2] = clamp(Math.round(b), 0, 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Extra delicate painted star motifs for 'starlight' variant
    if (variant === 'starlight') {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 224, 140, 0.92)';
      const drawStar = (cx, cy, outerR, innerR, pts = 4) => {
        ctx.beginPath();
        for (let k = 0; k < pts * 2; k++) {
          const rad = k % 2 === 0 ? outerR : innerR;
          const a = (k / (pts * 2)) * Math.PI * 2 - Math.PI * 0.5;
          const x = cx + Math.cos(a) * rad;
          const y = cy + Math.sin(a) * rad;
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      };
      // Paint soft golden 4-point stars on vertebral & costal centers
      const vPos = [0.765, 0.635, 0.50, 0.365, 0.235];
      for (let i = 0; i < vPos.length; i++) {
        drawStar(0.5 * w, (1 - vPos[i]) * h, 10, 3.2, 4);
      }
      const cSpec = [[0.195, 0.70], [0.218, 0.565], [0.218, 0.432], [0.188, 0.295]];
      for (let i = 0; i < cSpec.length; i++) {
        const [du, vv] = cSpec[i];
        drawStar((0.5 + du) * w, (1 - vv) * h, 8, 2.5, 4);
        drawStar((0.5 - du) * w, (1 - vv) * h, 8, 2.5, 4);
      }
      // Cozy scattered stardust dots
      for (let s = 0; s < 90; s++) {
        const sx = (0.1 + 0.8 * kit.noise(s * 3.17, 1.9)) * w;
        const sy = (0.1 + 0.8 * kit.noise(2.7, s * 4.13)) * h;
        const sr = 1.2 + kit.noise(s * 1.7, s * 2.3) * 2.1;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.needsUpdate = true;

  // Matching bump & roughness map (grooves deep & matte, scute crowns raised & gently satin)
  const bumpTex = kit.canvasTexture(size, size, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let py = 0; py < h; py++) {
      const v = 1 - (py + 0.5) / h;
      for (let px = 0; px < w; px++) {
        const u = (px + 0.5) / w;
        const sc = evalScute(u, v);
        const groove = 1 - smoothstep(0.002, 0.016, sc.edgeDist);
        const rings = 0.5 + 0.5 * Math.sin(sc.edgeDist * 225);
        const micro = kit.noise(u * 48, v * 48);
        const val = clamp(165 - groove * 135 + (rings - 0.5) * 26 + (micro - 0.5) * 18, 0, 255);
        const idx = (py * w + px) * 4;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  bumpTex.needsUpdate = true;

  let emissiveTex = null;
  if (variant === 'starlight') {
    emissiveTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      const drawGlow = (cx, cy, r) => {
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, 'rgba(255, 222, 130, 1)');
        grad.addColorStop(0.45, 'rgba(240, 185, 90, 0.45)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      };
      const vPos = [0.765, 0.635, 0.50, 0.365, 0.235];
      for (let i = 0; i < vPos.length; i++) drawGlow(0.5 * w, (1 - vPos[i]) * h, 6.5);
      const cSpec = [[0.195, 0.70], [0.218, 0.565], [0.218, 0.432], [0.188, 0.295]];
      for (let i = 0; i < cSpec.length; i++) {
        drawGlow((0.5 + cSpec[i][0]) * w, (1 - cSpec[i][1]) * h, 5.2);
        drawGlow((0.5 - cSpec[i][0]) * w, (1 - cSpec[i][1]) * h, 5.2);
      }
      for (let s = 0; s < 55; s++) {
        const sx = (0.12 + 0.76 * kit.noise(s * 3.17, 1.9)) * w;
        const sy = (0.12 + 0.76 * kit.noise(2.7, s * 4.13)) * h;
        drawGlow(sx, sy, 2.2);
      }
    });
    emissiveTex.colorSpace = THREE.SRGBColorSpace;
    emissiveTex.needsUpdate = true;
  }

  return { colorTex, bumpTex, emissiveTex };
}

// Procedural pebbled tortoise skin texture (darker top, warm pale belly/throat, soft flecks)
function createSkinTextures(THREE, kit, skinCol) {
  const size = 256;
  const baseRgb = colorToRgb(skinCol);
  const topRgb = colorToRgb(shiftColor(THREE, skinCol, -0.02, 0.06, -0.07));
  const bellyRgb = colorToRgb(shiftColor(THREE, skinCol, 0.045, -0.14, 0.20));
  const freckleRgb = colorToRgb(shiftColor(THREE, skinCol, -0.025, 0.08, -0.16));

  const colorTex = kit.canvasTexture(size, size, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let py = 0; py < h; py++) {
      const v = 1 - (py + 0.5) / h; // 1 = top of head/limb, 0 = underside/throat
      const bellyMix = 1 - smoothstep(0.18, 0.62, v);
      const topMix = smoothstep(0.58, 0.92, v);
      for (let px = 0; px < w; px++) {
        const u = (px + 0.5) / w;
        const pebble = kit.noise(u * 28, v * 28);
        const mottle = fbm(kit, u * 9 + 1.4, v * 9 + 3.2, 3);
        const fleck = smoothstep(0.68, 0.84, kit.noise(u * 19 + 5.2, v * 19 + 2.1)) * (1 - bellyMix * 0.8);

        let r = mix(baseRgb[0], topRgb[0], topMix);
        let g = mix(baseRgb[1], topRgb[1], topMix);
        let b = mix(baseRgb[2], topRgb[2], topMix);

        r = mix(r, bellyRgb[0], bellyMix * 0.78);
        g = mix(g, bellyRgb[1], bellyMix * 0.78);
        b = mix(b, bellyRgb[2], bellyMix * 0.75);

        r = mix(r, freckleRgb[0], fleck * 0.42);
        g = mix(g, freckleRgb[1], fleck * 0.42);
        b = mix(b, freckleRgb[2], fleck * 0.42);

        const texShift = (mottle - 0.5) * 18 + (pebble - 0.5) * 12;
        const idx = (py * w + px) * 4;
        data[idx] = clamp(Math.round(r + texShift), 0, 255);
        data[idx + 1] = clamp(Math.round(g + texShift * 0.95), 0, 255);
        data[idx + 2] = clamp(Math.round(b + texShift * 0.85), 0, 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.needsUpdate = true;

  const bumpTex = kit.canvasTexture(size, size, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let py = 0; py < h; py++) {
      const v = 1 - (py + 0.5) / h;
      for (let px = 0; px < w; px++) {
        const u = (px + 0.5) / w;
        const n1 = kit.noise(u * 34, v * 34);
        const n2 = kit.noise(u * 68 + 4.1, v * 68 + 1.9);
        const val = clamp(Math.round((n1 * 0.65 + n2 * 0.35) * 255), 0, 255);
        const idx = (py * w + px) * 4;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  bumpTex.needsUpdate = true;

  return { colorTex, bumpTex };
}

// Warm parchment plastron texture with subtle medial & transverse seams
function createPlastronTexture(THREE, kit, shellCol) {
  const warmCol = shiftColor(THREE, shellCol, 0.055, -0.22, 0.36);
  const baseRgb = colorToRgb(warmCol);
  const seamRgb = colorToRgb(shiftColor(THREE, shellCol, 0.01, -0.08, -0.05));

  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = rgbStr(baseRgb[0], baseRgb[1], baseRgb[2]);
    ctx.fillRect(0, 0, w, h);

    // Subtle organic grain & warm radial edge shading
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.12, w * 0.5, h * 0.5, w * 0.52);
    grad.addColorStop(0, rgbStr(baseRgb[0] + 18, baseRgb[1] + 16, baseRgb[2] + 10, 0.55));
    grad.addColorStop(1, rgbStr(seamRgb[0], seamRgb[1], seamRgb[2], 0.38));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Soft scute seam lines
    ctx.strokeStyle = rgbStr(seamRgb[0], seamRgb[1], seamRgb[2], 0.45);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.08);
    ctx.lineTo(w * 0.5, h * 0.92);
    for (const fy of [0.32, 0.51, 0.71]) {
      ctx.moveTo(w * 0.12, h * fy);
      ctx.quadraticCurveTo(w * 0.5, h * (fy + 0.03), w * 0.88, h * fy);
    }
    ctx.stroke();

    // Subtle brushed organic flecks
    for (let i = 0; i < 160; i++) {
      const x = kit.noise(i * 2.13, 0.7) * w;
      const y = kit.noise(1.9, i * 3.11) * h;
      const r = 2 + kit.noise(i, i * 0.5) * 6;
      ctx.fillStyle = rgbStr(seamRgb[0], seamRgb[1], seamRgb[2], 0.06);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Rich layered iris texture (limbal ring, radial iris fibres, warm lower crescent glow)
function createIrisTexture(THREE, kit, eyeCol) {
  const rgb = colorToRgb(eyeCol);
  const brightRgb = colorToRgb(shiftColor(THREE, eyeCol, 0.03, 0.18, 0.24));
  const darkRgb = colorToRgb(shiftColor(THREE, eyeCol, -0.02, 0.10, -0.28));

  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const R = w * 0.48;

    ctx.fillStyle = '#14100d';
    ctx.fillRect(0, 0, w, h);

    // Base iris radial gradient
    const g = ctx.createRadialGradient(cx, cy, R * 0.25, cx, cy, R);
    g.addColorStop(0, rgbStr(darkRgb[0], darkRgb[1], darkRgb[2]));
    g.addColorStop(0.55, rgbStr(rgb[0], rgb[1], rgb[2]));
    g.addColorStop(0.84, rgbStr(darkRgb[0] * 0.75, darkRgb[1] * 0.75, darkRgb[2] * 0.75));
    g.addColorStop(1, '#120e0c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();

    // Warm sunlit lower crescent glow inside the iris
    const glow = ctx.createRadialGradient(cx, cy + R * 0.34, R * 0.05, cx, cy + R * 0.28, R * 0.52);
    glow.addColorStop(0, rgbStr(brightRgb[0], brightRgb[1], brightRgb[2], 0.9));
    glow.addColorStop(1, rgbStr(brightRgb[0], brightRgb[1], brightRgb[2], 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.88, 0, Math.PI * 2);
    ctx.fill();

    // Delicate radial iris fibres
    ctx.save();
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const n = kit.noise(Math.cos(a) * 4 + 5, Math.sin(a) * 4 + 5);
      ctx.strokeStyle = rgbStr(brightRgb[0], brightRgb[1], brightRgb[2], 0.16 + n * 0.2);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R * 0.42, cy + Math.sin(a) * R * 0.42);
      ctx.lineTo(cx + Math.cos(a) * R * (0.78 + n * 0.12), cy + Math.sin(a) * R * (0.78 + n * 0.12));
      ctx.stroke();
    }
    ctx.restore();

    // Crisp deep glossy pupil
    ctx.fillStyle = '#0c0908';
    ctx.beginPath();
    ctx.arc(cx, cy - R * 0.03, R * 0.52, 0, Math.PI * 2);
    ctx.fill();
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Soft radial cheek blush texture
function createBlushTexture(THREE, kit) {
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 4, w * 0.5, h * 0.5, w * 0.46);
    g.addColorStop(0, 'rgba(236, 134, 124, 0.55)');
    g.addColorStop(0.55, 'rgba(232, 126, 118, 0.26)');
    g.addColorStop(1, 'rgba(232, 126, 118, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Helper to orient a face feature cleanly onto the sculpted head surface
function placeOnHead(THREE, obj, nx, ny, nz, inset = 0) {
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  const ux = nx / len, uy = ny / len, uz = nz / len;
  const p = evaluateHeadPoint(ux, uy, uz);
  // Estimate outward normal via finite differences on unit sphere
  const eps = 0.025;
  const t1 = Math.abs(uy) < 0.9 ? new THREE.Vector3(-uz, 0, ux).normalize() : new THREE.Vector3(1, 0, 0);
  const t2 = new THREE.Vector3().crossVectors(new THREE.Vector3(ux, uy, uz), t1).normalize();
  const p1 = evaluateHeadPoint(ux + t1.x * eps, uy + t1.y * eps, uz + t1.z * eps);
  const p2 = evaluateHeadPoint(ux + t2.x * eps, uy + t2.y * eps, uz + t2.z * eps);
  const d1 = new THREE.Vector3(p1.x - p.x, p1.y - p.y, p1.z - p.z);
  const d2 = new THREE.Vector3(p2.x - p.x, p2.y - p.y, p2.z - p.z);
  const normal = new THREE.Vector3().crossVectors(d1, d2).normalize();
  if (normal.dot(new THREE.Vector3(ux, uy, uz)) < 0) normal.negate();

  obj.position.set(p.x - normal.x * inset, p.y - normal.y * inset, p.z - normal.z * inset);
  const lookTarget = obj.position.clone().add(normal);
  obj.lookAt(lookTarget);
  return normal;
}

export function build(THREE, opts = {}, kit) {
  const skinColor = new THREE.Color(opts.fur ?? '#7fa36b');
  const shellColor = new THREE.Color(opts.furAccent ?? '#8c5a36');
  const eyeColor = new THREE.Color(opts.eye ?? '#4c8e7c');
  const variant = META.variants.includes(opts.variant) ? opts.variant : 'classic';

  const root = new THREE.Group();
  root.name = 'cozy-turtle';

  const evalScute = createScuteLayout();
  const shellTex = createShellTextures(THREE, kit, evalScute, shellColor, variant);
  const skinTex = createSkinTextures(THREE, kit, skinColor);
  const plastronTex = createPlastronTexture(THREE, kit, shellColor);
  const irisTex = createIrisTexture(THREE, kit, eyeColor);
  const blushTex = createBlushTexture(THREE, kit);

  // Materials (MeshPhysicalMaterial)
  const skinSheen = shiftColor(THREE, skinColor, 0.04, -0.1, 0.24);
  const skinMat = new THREE.MeshPhysicalMaterial({
    map: skinTex.colorTex,
    bumpMap: skinTex.bumpTex,
    bumpScale: 0.0014,
    roughness: 0.88,
    metalness: 0.0,
    sheen: 0.72,
    sheenRoughness: 0.72,
    sheenColor: skinSheen
  });

  const shellSheen = shiftColor(THREE, shellColor, 0.03, -0.05, 0.22);
  const shellMat = new THREE.MeshPhysicalMaterial({
    map: shellTex.colorTex,
    bumpMap: shellTex.bumpTex,
    bumpScale: 0.0028,
    roughness: variant === 'moss' ? 0.68 : 0.44,
    metalness: 0.0,
    clearcoat: variant === 'moss' ? 0.14 : 0.34,
    clearcoatRoughness: 0.32,
    sheen: variant === 'moss' ? 0.55 : 0.22,
    sheenColor: variant === 'moss' ? new THREE.Color('#9ab87c') : shellSheen,
    emissive: variant === 'starlight' ? new THREE.Color('#ffda88') : new THREE.Color('#000000'),
    emissiveMap: shellTex.emissiveTex || null,
    emissiveIntensity: variant === 'starlight' ? 1.45 : 0
  });

  const plastronMat = new THREE.MeshPhysicalMaterial({
    map: plastronTex,
    roughness: 0.72,
    metalness: 0.0,
    clearcoat: 0.12,
    clearcoatRoughness: 0.45,
    sheen: 0.35,
    sheenColor: new THREE.Color('#f7edd6')
  });

  const scaleCol = shiftColor(THREE, shellColor, 0.02, -0.12, 0.06);
  const scaleMat = new THREE.MeshPhysicalMaterial({
    color: scaleCol,
    roughness: 0.68,
    metalness: 0.0,
    clearcoat: 0.18,
    clearcoatRoughness: 0.4,
    sheen: 0.4,
    sheenColor: shellSheen
  });

  const clawMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#e6d9be'),
    roughness: 0.26,
    metalness: 0.0,
    clearcoat: 0.82,
    clearcoatRoughness: 0.16
  });

  const eyeBaseMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#14100d'),
    roughness: 0.06,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03
  });

  const irisMat = new THREE.MeshPhysicalMaterial({
    map: irisTex,
    roughness: 0.08,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04
  });

  const highlightMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffffff'),
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.55,
    roughness: 0.05,
    clearcoat: 1.0
  });

  const mouthMat = new THREE.MeshPhysicalMaterial({
    color: shiftColor(THREE, skinColor, -0.02, 0.05, -0.36),
    roughness: 0.85,
    sheen: 0.3
  });

  const blushMat = new THREE.MeshPhysicalMaterial({
    map: blushTex,
    transparent: true,
    depthWrite: false,
    roughness: 0.92,
    sheen: 0.6,
    sheenColor: new THREE.Color('#ffb8ad')
  });

  // =========================================================================
  // 1. BODY (Sculpted Domed Carapace + Undershell Plastron)
  // =========================================================================
  const body = new THREE.Group();
  body.name = 'body';
  body.position.set(0, 0.046, -0.014);
  body.userData.basePos = body.position.clone();
  root.add(body);

  const carapaceMesh = new THREE.Mesh(buildCarapaceGeometry(THREE, evalScute, kit), shellMat);
  carapaceMesh.name = 'carapace';
  carapaceMesh.userData.slot = 'furAccent';
  carapaceMesh.castShadow = true;
  carapaceMesh.receiveShadow = true;
  body.add(carapaceMesh);

  const plastronMesh = new THREE.Mesh(buildPlastronGeometry(THREE), plastronMat);
  plastronMesh.name = 'plastron';
  plastronMesh.position.set(0, 0.002, 0.002);
  plastronMesh.userData.slot = 'secondary';
  plastronMesh.castShadow = true;
  plastronMesh.receiveShadow = true;
  body.add(plastronMesh);

  // =========================================================================
  // 2. HEAD & CONTINUOUS NECK (Stretched gently forward with warm tilt)
  // =========================================================================
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 0.068, 0.068);
  // Subtle gentle asymmetry: slightly tilted and looking warmly toward 3/4 view
  head.rotation.set(-0.06, 0.11, 0.075);
  head.userData.basePos = head.position.clone();
  head.userData.baseRot = head.rotation.clone();
  root.add(head);

  // Tapered S-curved neck emerging deeply from inside the shell cavity and flaring into the head
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.003, -0.032),
    new THREE.Vector3(0, -0.001, 0.004),
    new THREE.Vector3(0, 0.011, 0.036),
    new THREE.Vector3(0, 0.025, 0.060)
  ]);
  const neckGeo = createTaperedTube(THREE, neckCurve, 28, 24, (t, ang) => {
    const baseR = mix(0.0255, 0.0195, smoothstep(0, 0.78, t)) + 0.0045 * smoothstep(0.75, 1.0, t);
    // Soft horizontal turtle neck skin folds along the middle of the neck
    const fold = Math.sin(t * Math.PI * 7.5) * 0.0013 * Math.sin(t * Math.PI);
    const rx = baseR * 0.96 + fold;
    const ry = baseR * (0.94 - 0.06 * Math.sin(ang)) + fold;
    return { rx, ry };
  }, { capStart: true, capEnd: true, capRings: 5 });

  const neckMesh = new THREE.Mesh(neckGeo, skinMat);
  neckMesh.name = 'neck';
  neckMesh.userData.slot = 'fur';
  neckMesh.castShadow = true;
  neckMesh.receiveShadow = true;
  head.add(neckMesh);

  // Sculpted continuous head nestled seamlessly onto the upper neck
  const skullGroup = new THREE.Group();
  skullGroup.name = 'skull';
  skullGroup.position.set(0, 0.030, 0.069);
  skullGroup.rotation.set(0.04, 0, 0);
  head.add(skullGroup);

  const headMesh = new THREE.Mesh(buildSculptedHeadGeometry(THREE), skinMat);
  headMesh.name = 'headMesh';
  headMesh.userData.slot = 'fur';
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  skullGroup.add(headMesh);

  // Expressive three-layer eyes (LatheGeometry cornea/sclera, painted iris dome, dual specular highlights)
  const eyeLatheGeo = buildEyeLatheGeometry(THREE, 0.0086);
  const irisDomeGeo = new THREE.SphereGeometry(0.0080, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.44);
  irisDomeGeo.rotateX(Math.PI * 0.5);
  // Planar front UVs so the painted iris texture maps cleanly to the front face of the dome
  {
    const ip = irisDomeGeo.attributes.position;
    const iuv = irisDomeGeo.attributes.uv;
    for (let i = 0; i < ip.count; i++) {
      iuv.setXY(i, 0.5 + ip.getX(i) / (0.0080 * 1.92), 0.5 + ip.getY(i) / (0.0080 * 1.92));
    }
  }
  const hiMainGeo = new THREE.SphereGeometry(0.0019, 12, 10);
  const hiSubGeo = new THREE.SphereGeometry(0.0010, 10, 8);

  const buildEye = (side) => {
    const eyeGrp = new THREE.Group();
    eyeGrp.name = side > 0 ? 'eyeL' : 'eyeR';
    placeOnHead(THREE, eyeGrp, side * 0.65, 0.22, 0.727, 0.0024);
    // Slight gentle inward convergence so eyes look warm and attentive
    eyeGrp.rotateY(-side * 0.14);

    const sclera = new THREE.Mesh(eyeLatheGeo, eyeBaseMat);
    sclera.userData.slot = 'eye';
    sclera.castShadow = false;
    eyeGrp.add(sclera);

    const iris = new THREE.Mesh(irisDomeGeo, irisMat);
    iris.position.z = 0.00075;
    iris.userData.slot = 'eye';
    eyeGrp.add(iris);

    // Primary and secondary highlight dots placed up and to one side
    const hi1 = new THREE.Mesh(hiMainGeo, highlightMat);
    hi1.position.set(0.0024, 0.0028, 0.0076);
    hi1.scale.set(1.0, 1.15, 0.55);
    hi1.userData.slot = 'eye';
    eyeGrp.add(hi1);

    const hi2 = new THREE.Mesh(hiSubGeo, highlightMat);
    hi2.position.set(-0.0022, -0.0023, 0.0074);
    hi2.scale.set(1.0, 1.0, 0.55);
    hi2.userData.slot = 'eye';
    eyeGrp.add(hi2);

    // Subtle sculpted upper eyelid arc hugging the top of the eye socket
    const lidCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.0086, 0.0012, 0.0025),
      new THREE.Vector3(-0.0042, 0.0068, 0.0046),
      new THREE.Vector3(0.0004, 0.0084, 0.0052),
      new THREE.Vector3(0.0052, 0.0064, 0.0044),
      new THREE.Vector3(0.0088, 0.0010, 0.0022)
    ]);
    const lidGeo = createTaperedTube(THREE, lidCurve, 14, 10, (t) => {
      const r = 0.0017 * (0.4 + 0.6 * Math.sin(t * Math.PI));
      return { rx: r, ry: r * 0.85 };
    }, { capStart: true, capEnd: true, capRings: 3 });
    const lidMesh = new THREE.Mesh(lidGeo, skinMat);
    lidMesh.userData.slot = 'fur';
    lidMesh.castShadow = true;
    eyeGrp.add(lidMesh);

    eyeGrp.userData.baseScaleY = 1;
    skullGroup.add(eyeGrp);
    return eyeGrp;
  };

  buildEye(1);
  buildEye(-1);

  // Gentle curved smile mouth built from a thin tapered tube hugging the exact snout surface
  const smileDirs = [
    [-0.56, -0.18, 0.81],
    [-0.36, -0.25, 0.90],
    [-0.16, -0.23, 0.96],
    [0.0, -0.19, 0.98],
    [0.16, -0.23, 0.96],
    [0.36, -0.25, 0.90],
    [0.56, -0.18, 0.81]
  ];
  const smilePts = smileDirs.map(([dx, dy, dz]) => {
    const l = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const p = evaluateHeadPoint(dx / l, dy / l, dz / l);
    return new THREE.Vector3(p.x * 1.008, p.y, p.z * 1.006);
  });
  const smileCurve = new THREE.CatmullRomCurve3(smilePts);
  const smileGeo = createTaperedTube(THREE, smileCurve, 22, 10, (t) => {
    const r = 0.00105 * (0.45 + 0.55 * Math.sin(t * Math.PI));
    return { rx: r, ry: r };
  }, { capStart: true, capEnd: true, capRings: 3 });
  const smileMesh = new THREE.Mesh(smileGeo, mouthMat);
  smileMesh.name = 'smile';
  smileMesh.userData.slot = 'fur';
  skullGroup.add(smileMesh);

  // Tiny recessed nostrils
  const nostrilGeo = new THREE.SphereGeometry(0.0012, 10, 8);
  for (const side of [-1, 1]) {
    const nos = new THREE.Mesh(nostrilGeo, mouthMat);
    placeOnHead(THREE, nos, side * 0.19, 0.15, 0.97, 0.0003);
    nos.scale.set(0.85, 1.15, 0.45);
    nos.userData.slot = 'fur';
    skullGroup.add(nos);
  }

  // Subtle curved cheek blush discs nestled right onto the chubby cheeks
  const blushGeo = new THREE.CircleGeometry(0.0088, 20);
  {
    const bp = blushGeo.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const bx = bp.getX(i);
      const by = bp.getY(i);
      // Gently bend to match cheek surface curvature
      bp.setZ(i, -(bx * bx + by * by) * 16);
    }
    blushGeo.computeVertexNormals();
  }
  for (const side of [-1, 1]) {
    const blush = new THREE.Mesh(blushGeo, blushMat);
    placeOnHead(THREE, blush, side * 0.77, -0.14, 0.62, -0.0005);
    blush.scale.set(1.18, 0.78, 1);
    blush.userData.slot = 'accent';
    skullGroup.add(blush);
  }

  // =========================================================================
  // 3. LIMBS (armL raised mid-step, armR + legL + legR planted firmly on y=0)
  // =========================================================================
  const clawGeoFront = buildClawGeometry(THREE, 0.0105, 0.0040);
  const clawGeoBack = buildClawGeometry(THREE, 0.0095, 0.0038);
  const scaleGeo = buildLegScaleGeometry(THREE, 0.0115, 0.0085);

  function buildLimb(cfg) {
    const grp = new THREE.Group();
    grp.name = cfg.name;
    grp.position.copy(cfg.pivot);
    grp.userData.basePos = grp.position.clone();
    grp.userData.baseRot = grp.rotation.clone();
    root.add(grp);

    const curve = new THREE.CatmullRomCurve3(cfg.points);
    const localFloorY = cfg.grounded ? -cfg.pivot.y : null;

    const limbGeo = createTaperedTube(THREE, curve, 24, 20, (t, ang) => {
      // Chunky upper shoulder/hip deeply inside shell, soft wrist/ankle, cozy flared footpad
      const upper = mix(cfg.rStart, cfg.rMid, smoothstep(0, 0.55, t));
      const footFlare = smoothstep(0.68, 1.0, t) * 0.0038;
      const wrinkle = Math.sin(t * Math.PI * 5.0) * 0.0009 * Math.sin(t * Math.PI);
      const base = upper + footFlare + wrinkle;
      const rx = base * (cfg.isFront ? 1.04 : 1.08);
      const ry = base * (0.94 + 0.06 * Math.cos(ang));
      return { rx, ry };
    }, {
      capStart: true,
      capEnd: true,
      capRings: 6,
      floorY: localFloorY,
      soleBevel: 0.006
    });

    const limbMesh = new THREE.Mesh(limbGeo, skinMat);
    limbMesh.userData.slot = 'fur';
    limbMesh.castShadow = true;
    limbMesh.receiveShadow = true;
    grp.add(limbMesh);

    // Sculpted claws nestled into the front rim of the foot
    const footPos = cfg.points[cfg.points.length - 1];
    const clawGeo = cfg.isFront ? clawGeoFront : clawGeoBack;
    const clawAngles = [-0.46, -0.14, 0.18, 0.48];
    const clawCount = cfg.isFront ? 4 : 3;
    const yawBase = cfg.footYaw;
    for (let i = 0; i < clawCount; i++) {
      const a = yawBase + (clawCount === 4 ? clawAngles[i] : (i - 1) * 0.36);
      const claw = new THREE.Mesh(clawGeo, clawMat);
      const rEdge = cfg.rMid + 0.0018;
      const cy = cfg.grounded ? -cfg.pivot.y + 0.0046 : footPos.y - 0.0055;
      claw.position.set(
        footPos.x + Math.sin(a) * rEdge,
        cy,
        footPos.z + Math.cos(a) * rEdge
      );
      claw.rotation.set(cfg.grounded ? 0.12 : 0.36, a, 0);
      claw.scale.setScalar(i === 0 || i === clawCount - 1 ? 0.86 : 1.0);
      claw.userData.slot = 'secondary';
      claw.castShadow = true;
      claw.receiveShadow = true;
      grp.add(claw);
    }

    // Bent beveled tortoise foreleg scales overlapping down the front shin
    if (cfg.isFront) {
      const scaleT = [0.38, 0.52, 0.66, 0.78];
      for (let i = 0; i < scaleT.length; i++) {
        const t = scaleT[i];
        const pt = curve.getPoint(t);
        const scMesh = new THREE.Mesh(scaleGeo, scaleMat);
        const outX = cfg.side * 0.0065;
        const outZ = 0.0125;
        scMesh.position.set(pt.x + outX, pt.y + 0.001, pt.z + outZ);
        scMesh.rotation.set(0.18 - i * 0.05, cfg.side * 0.42 + (i % 2 === 0 ? 0.14 : -0.14), cfg.side * -0.1);
        scMesh.scale.setScalar(0.96 - i * 0.08);
        scMesh.userData.slot = 'furAccent';
        scMesh.castShadow = true;
        scMesh.receiveShadow = true;
        grp.add(scMesh);
      }
    }

    return grp;
  }

  // armL (front-left, +x): gently raised mid-step forward!
  buildLimb({
    name: 'armL',
    side: 1,
    isFront: true,
    grounded: false,
    pivot: new THREE.Vector3(0.044, 0.056, 0.046),
    rStart: 0.0185,
    rMid: 0.0145,
    footYaw: 0.24,
    points: [
      new THREE.Vector3(-0.014, 0.005, -0.012),
      new THREE.Vector3(0.015, -0.002, 0.016),
      new THREE.Vector3(0.030, -0.015, 0.042),
      new THREE.Vector3(0.032, -0.028, 0.056)
    ]
  });

  // armR (front-right, -x): firmly planted on floor bearing weight
  buildLimb({
    name: 'armR',
    side: -1,
    isFront: true,
    grounded: true,
    pivot: new THREE.Vector3(-0.044, 0.056, 0.040),
    rStart: 0.0185,
    rMid: 0.0148,
    footYaw: -0.22,
    points: [
      new THREE.Vector3(0.014, 0.005, -0.010),
      new THREE.Vector3(-0.016, -0.005, 0.010),
      new THREE.Vector3(-0.032, -0.028, 0.022),
      new THREE.Vector3(-0.035, -0.046, 0.028)
    ]
  });

  // legL (back-left, +x): firmly planted on floor, pushing gently rearward
  buildLimb({
    name: 'legL',
    side: 1,
    isFront: false,
    grounded: true,
    pivot: new THREE.Vector3(0.044, 0.054, -0.058),
    rStart: 0.019,
    rMid: 0.0146,
    footYaw: 0.42,
    points: [
      new THREE.Vector3(-0.014, 0.005, 0.010),
      new THREE.Vector3(0.016, -0.005, -0.005),
      new THREE.Vector3(0.030, -0.027, -0.016),
      new THREE.Vector3(0.034, -0.044, -0.018)
    ]
  });

  // legR (back-right, -x): firmly planted on floor, stepping forward under side of shell
  buildLimb({
    name: 'legR',
    side: -1,
    isFront: false,
    grounded: true,
    pivot: new THREE.Vector3(-0.044, 0.054, -0.048),
    rStart: 0.019,
    rMid: 0.0146,
    footYaw: -0.35,
    points: [
      new THREE.Vector3(0.014, 0.005, 0.008),
      new THREE.Vector3(-0.016, -0.005, 0.002),
      new THREE.Vector3(-0.030, -0.027, 0.004),
      new THREE.Vector3(-0.034, -0.044, 0.008)
    ]
  });

  // =========================================================================
  // 4. TAIL (Curled playfully to one side, tapered continuous tube)
  // =========================================================================
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(0, 0.054, -0.098);
  tail.userData.basePos = tail.position.clone();
  tail.userData.baseRot = tail.rotation.clone();
  root.add(tail);

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.003, 0.024),
    new THREE.Vector3(-0.002, -0.001, -0.004),
    new THREE.Vector3(-0.009, -0.006, -0.024),
    new THREE.Vector3(-0.020, -0.005, -0.036)
  ]);
  const tailGeo = createTaperedTube(THREE, tailCurve, 18, 16, (t) => {
    const r = mix(0.0135, 0.0024, Math.pow(t, 0.85));
    const ridge = Math.sin(t * Math.PI * 6) * 0.0005 * (1 - t);
    return { rx: r + ridge, ry: r * 0.88 + ridge };
  }, { capStart: true, capEnd: true, capRings: 4 });

  const tailMesh = new THREE.Mesh(tailGeo, skinMat);
  tailMesh.name = 'tailMesh';
  tailMesh.userData.slot = 'fur';
  tailMesh.castShadow = true;
  tailMesh.receiveShadow = true;
  tail.add(tailMesh);

  return root;
}

export function idle(group, t) {
  if (!group) return;

  const body = group.getObjectByName('body');
  const head = group.getObjectByName('head');
  const tail = group.getObjectByName('tail');
  const armL = group.getObjectByName('armL');
  const eyeL = group.getObjectByName('eyeL');
  const eyeR = group.getObjectByName('eyeR');

  // Calm cozy breathing cycle
  const breath = 0.5 + 0.5 * Math.sin(t * 1.85);

  if (body && body.userData.basePos) {
    body.position.y = body.userData.basePos.y + breath * 0.0014;
    body.scale.set(1 + breath * 0.007, 1 + breath * 0.012, 1 + breath * 0.006);
  }

  // Gentle curious head sway and soft breathing bob
  if (head && head.userData.basePos && head.userData.baseRot) {
    head.position.y = head.userData.basePos.y + breath * 0.0012;
    head.rotation.x = head.userData.baseRot.x + Math.sin(t * 1.15 + 0.4) * 0.042;
    head.rotation.y = head.userData.baseRot.y + Math.sin(t * 0.68) * 0.085;
    head.rotation.z = head.userData.baseRot.z + Math.sin(t * 0.52 + 1.1) * 0.032;
  }

  // Soft playful tail wag
  if (tail && tail.userData.baseRot) {
    tail.rotation.y = tail.userData.baseRot.y + Math.sin(t * 1.95) * 0.14;
    tail.rotation.x = tail.userData.baseRot.x + Math.sin(t * 0.95) * 0.035;
  }

  // Lifted front-left paw hovers gently mid-step while grounded feet stay pinned to the floor
  if (armL && armL.userData.baseRot) {
    armL.rotation.x = armL.userData.baseRot.x + Math.sin(t * 1.65) * 0.045;
    armL.rotation.z = armL.userData.baseRot.z + Math.sin(t * 0.85 + 0.7) * 0.025;
  }

  // Natural blink every ~3.8 seconds by scaling eye groups on Y
  const cycle = 3.8;
  const phase = ((t % cycle) + cycle) % cycle;
  let blinkScale = 1;
  if (phase > 3.55 && phase < 3.74) {
    const u = (phase - 3.55) / 0.19;
    blinkScale = 1 - 0.92 * Math.sin(u * Math.PI);
  }
  if (eyeL) eyeL.scale.y = blinkScale;
  if (eyeR) eyeR.scale.y = blinkScale;
}
export const META = {
  id: 'baku',
  name: 'Dream-Eating Baku',
  kind: 'creature',
  footprint: [0.22, 0.42],
  variants: ['twilight', 'malayan', 'sakura'],
  note: 'Stylised dream-eating tapir spirit (~0.4 m long) with sculpted continuous body and flexible trunk, curved tusks, striped fur texture, tufted tail, and floating dream-bubbles.'
};

const VARIANTS = {
  twilight: {
    fur: '#4a4d6d',
    furAccent: '#eae1d3',
    eye: '#f0b254',
    glow: '#9ee6ff',
    skin: '#d998a4',
    hoof: '#2a2838',
    tusk: '#f6eedc'
  },
  malayan: {
    fur: '#3e3a42',
    furAccent: '#f2eadc',
    eye: '#de9149',
    glow: '#ffd59e',
    skin: '#d6999e',
    hoof: '#221f26',
    tusk: '#f7f0df'
  },
  sakura: {
    fur: '#896e82',
    furAccent: '#f8ecea',
    eye: '#7c6ef2',
    glow: '#ffb8e3',
    skin: '#e5a4b4',
    hoof: '#4b3b4a',
    tusk: '#fbf4ea'
  }
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function fbm(kit, x, y) {
  return (
    kit.noise(x, y) * 0.58 +
    kit.noise(x * 2.13 + 7.3, y * 2.13 - 4.1) * 0.28 +
    kit.noise(x * 4.41 - 11.2, y * 4.41 + 9.7) * 0.14
  );
}

function hexCss(THREE, color) {
  return '#' + color.getHexString();
}

function rgbaCss(color, a) {
  const r = Math.round(clamp(color.r, 0, 1) * 255);
  const g = Math.round(clamp(color.g, 0, 1) * 255);
  const b = Math.round(clamp(color.b, 0, 1) * 255);
  return `rgba(${r},${g},${b},${a})`;
}

function resolvePalette(THREE, opts) {
  const variantName = opts && VARIANTS[opts.variant] ? opts.variant : 'twilight';
  const base = VARIANTS[variantName];
  const fur = new THREE.Color(opts && opts.fur ? opts.fur : base.fur);
  const furAccent = new THREE.Color(opts && opts.furAccent ? opts.furAccent : base.furAccent);
  const eye = new THREE.Color(opts && opts.eye ? opts.eye : base.eye);
  const glow = new THREE.Color(opts && opts.glow ? opts.glow : base.glow);
  const skin = new THREE.Color(base.skin).lerp(furAccent, 0.18);
  const hoof = new THREE.Color(base.hoof).lerp(fur, 0.22);
  const tusk = new THREE.Color(base.tusk);
  const furDark = fur.clone().multiplyScalar(0.62);
  const furDeep = fur.clone().multiplyScalar(0.38);
  const furLight = fur.clone().lerp(furAccent, 0.42);
  const furSheen = fur.clone().lerp(new THREE.Color('#ffffff'), 0.48);
  const accentSheen = furAccent.clone().lerp(new THREE.Color('#ffffff'), 0.55);
  return {
    fur,
    furAccent,
    eye,
    glow,
    skin,
    hoof,
    tusk,
    furDark,
    furDeep,
    furLight,
    furSheen,
    accentSheen
  };
}

// Tapered tube builder using parallel-transport frames (zero twist, closed smooth caps)
function createTaperedTube(THREE, curve, tubularSegments, radialSegments, radiusFn, capStart = true, capEnd = true) {
  const frames = { tangents: [], normals: [], binormals: [] };
  const pts = [];
  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    pts.push(curve.getPointAt(t));
    frames.tangents.push(curve.getTangentAt(t).normalize());
  }

  const ref = Math.abs(frames.tangents[0].y) < 0.92
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(1, 0, 0);
  let normal = new THREE.Vector3().crossVectors(frames.tangents[0], ref).normalize();
  let binormal = new THREE.Vector3().crossVectors(frames.tangents[0], normal).normalize();
  frames.normals.push(normal.clone());
  frames.binormals.push(binormal.clone());

  const q = new THREE.Quaternion();
  for (let i = 1; i <= tubularSegments; i++) {
    q.setFromUnitVectors(frames.tangents[i - 1], frames.tangents[i]);
    normal = normal.clone().applyQuaternion(q).normalize();
    binormal = new THREE.Vector3().crossVectors(frames.tangents[i], normal).normalize();
    frames.normals.push(normal);
    frames.binormals.push(binormal);
  }

  const rings = [];
  const addRing = (center, t, nrm, bnm, scale, tOffset, tangent) => {
    const ring = [];
    for (let j = 0; j <= radialSegments; j++) {
      const a = (j / radialSegments) * Math.PI * 2;
      const r = radiusFn(t, a) * scale;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const p = new THREE.Vector3()
        .copy(center)
        .addScaledVector(nrm, c * r)
        .addScaledVector(bnm, s * r)
        .addScaledVector(tangent, tOffset);
      ring.push({ p, u: j / radialSegments, v: t });
    }
    rings.push(ring);
  };

  if (capStart) {
    const r0 = radiusFn(0, 0);
    addRing(pts[0], 0, frames.normals[0], frames.binormals[0], 0.001, -r0 * 0.45, frames.tangents[0]);
    addRing(pts[0], 0, frames.normals[0], frames.binormals[0], 0.62, -r0 * 0.28, frames.tangents[0]);
  }

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    addRing(pts[i], t, frames.normals[i], frames.binormals[i], 1.0, 0, frames.tangents[i]);
  }

  if (capEnd) {
    const r1 = radiusFn(1, 0);
    const last = tubularSegments;
    addRing(pts[last], 1, frames.normals[last], frames.binormals[last], 0.72, r1 * 0.22, frames.tangents[last]);
    addRing(pts[last], 1, frames.normals[last], frames.binormals[last], 0.001, r1 * 0.42, frames.tangents[last]);
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const stride = radialSegments + 1;

  for (let i = 0; i < rings.length; i++) {
    for (let j = 0; j <= radialSegments; j++) {
      const vtx = rings[i][j];
      positions.push(vtx.p.x, vtx.p.y, vtx.p.z);
      uvs.push(vtx.u, vtx.v);
    }
  }

  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + j + 1;
      const d = i * stride + j + 1;
      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Sculpting evaluation for the continuous Head + Cheeks + Snout + Short Flexible Trunk
// Coordinates follow rotated unit sphere: c = cos(theta) in [-1, 1] (+1 trunk tip, -1 occiput)
// nx = cos(phi) (+X left, -X right), ny = sin(phi) (+Y top, -Y bottom)
function evalHeadPoint(THREE, theta, phi, out) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const nx = Math.cos(phi);
  const ny = Math.sin(phi);

  const posC = Math.max(0, c);
  const tTrunk = smoothstep(0.54, 0.94, c);
  const tMuzzle = smoothstep(0.28, 0.80, c);

  // Curved centerline from occiput through skull, snout, and short flexible trunk
  const cz = 0.072 * c + 0.064 * Math.pow(posC, 2.05);
  const snoutDrop = -0.046 * Math.pow(Math.max(0, (c - 0.14) / 0.86), 1.68);
  const tipLift = 0.0115 * smoothstep(0.84, 1.0, c);
  const occiputDip = -0.012 * smoothstep(-0.25, -1.0, c);
  const cy = snoutDrop + tipLift + occiputDip;
  const cx = 0.0068 * Math.pow(Math.max(0, (c - 0.56) / 0.44), 1.85);

  // Smooth C-infinity cap envelope for the trunk tip while preserving natural skull dome at back
  const trunkCap = s / Math.sqrt(s * s + 0.0185);
  const rSkull = lerp(0.075, 0.078, smoothstep(-0.6, 0.18, c));
  const rMuzzleBlend = lerp(rSkull * s, 0.044 * s + 0.012 * trunkCap, tMuzzle);
  const rTrunkTarget = lerp(0.0245, 0.0175, smoothstep(0.68, 0.98, c)) * trunkCap;
  const rBase = lerp(rMuzzleBlend, rTrunkTarget, tTrunk);

  let rx = rBase * lerp(1.03, 1.07, tTrunk);
  let ry = rBase * lerp(0.96, 0.90, tTrunk);

  // Plush chibi cheeks on lower front sides
  const cheekWeight =
    Math.exp(-Math.pow((c - 0.24) / 0.30, 2)) *
    Math.exp(-Math.pow((ny + 0.22) / 0.48, 2)) *
    Math.pow(Math.abs(nx), 1.5);
  rx += 0.0115 * cheekWeight;
  ry += 0.0045 * cheekWeight;

  // Gentle domed forehead & brow ridge
  const browWeight =
    Math.exp(-Math.pow((c - 0.18) / 0.38, 2)) *
    smoothstep(0.15, 0.92, ny);
  ry += 0.0068 * browWeight;

  // Soft jaw/chin flatten & smooth throat blend toward neck
  const jawFlat = smoothstep(-0.25, -0.95, ny) * (1 - tTrunk);
  ry *= 1 - 0.12 * jawFlat;
  const throatBlend = smoothstep(-0.15, -0.82, c) * smoothstep(0.05, -0.85, ny);
  ry += 0.009 * throatBlend;

  // Subtle underside flattening of the flexible trunk
  const trunkUnder = tTrunk * smoothstep(-0.1, -0.9, ny);
  ry *= 1 - 0.14 * trunkUnder;

  // Soft mouth/upper-lip tuck right under the snout base
  const mouthTuck =
    Math.exp(-Math.pow((c - 0.62) / 0.16, 2)) *
    smoothstep(-0.35, -0.95, ny);
  ry -= 0.0045 * mouthTuck;

  // Sculpted eye-socket hollows (left & right) so eyes sit slightly inset on surface
  const eyeTheta = 0.98;
  const eyePhi = 0.34;
  const dTheta = theta - eyeTheta;
  const dPhiL = Math.atan2(Math.sin(phi - eyePhi), Math.cos(phi - eyePhi));
  const dPhiR = Math.atan2(Math.sin(phi - (Math.PI - eyePhi)), Math.cos(phi - (Math.PI - eyePhi)));
  const socketL = Math.exp(-(dTheta * dTheta) / 0.032 - (dPhiL * dPhiL) / 0.055);
  const socketR = Math.exp(-(dTheta * dTheta) / 0.032 - (dPhiR * dPhiR) / 0.055);
  const socketDepth = 0.0048 * (socketL + socketR);

  // Subtle nostril dimples at the front underside of the trunk tip
  const dTN = theta - 0.21;
  const dPNL = Math.atan2(Math.sin(phi + 0.68), Math.cos(phi + 0.68));
  const dPNR = Math.atan2(Math.sin(phi + (Math.PI - 0.68)), Math.cos(phi + (Math.PI - 0.68)));
  const nosDimple = 0.0018 * (
    Math.exp(-(dTN * dTN) / 0.006 - (dPNL * dPNL) / 0.12) +
    Math.exp(-(dTN * dTN) / 0.006 - (dPNR * dPNR) / 0.12)
  );

  // Pitch the cross-section softly downward along the curving trunk
  const pitch = 0.34 * smoothstep(0.42, 0.88, c) - 0.24 * smoothstep(0.86, 1.0, c);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);

  const lx = nx * (rx - socketDepth * Math.abs(nx) - nosDimple);
  const ly0 = ny * (ry - socketDepth * 0.45 - nosDimple);
  const ly = ly0 * cosP;
  const lz = -ly0 * sinP;

  out.set(cx + lx, cy + ly, cz + lz);
  return out;
}

function sampleHeadFrame(THREE, theta, phi) {
  const eps = 0.01;
  const p = evalHeadPoint(THREE, theta, phi, new THREE.Vector3());
  const pt = evalHeadPoint(THREE, clamp(theta + eps, 0.01, Math.PI - 0.01), phi, new THREE.Vector3()).sub(p);
  const pp = evalHeadPoint(THREE, theta, phi + eps, new THREE.Vector3()).sub(p);
  const n = new THREE.Vector3().crossVectors(pp, pt).normalize();
  // Ensure outward normal
  const radial = new THREE.Vector3(Math.cos(phi) * Math.sin(theta), Math.sin(phi) * Math.sin(theta), Math.cos(theta));
  if (n.dot(radial) < 0) n.negate();
  return { pos: p, normal: n };
}

// Sculpted continuous torso + neck base
function buildBodyGeometry(THREE) {
  const geo = new THREE.SphereGeometry(1, 60, 44);
  geo.rotateX(Math.PI / 2);
  geo.rotateZ(Math.PI / 2);

  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const uz = clamp(v.z, -1, 1); // -1 rump -> +1 chest/neck
    const rad = Math.sqrt(v.x * v.x + v.y * v.y);
    const nx = rad > 1e-5 ? v.x / rad : 0;
    const ny = rad > 1e-5 ? v.y / rad : 0;

    // Longitudinal span: plump compact tapir torso (~0.29 m long)
    const z = uz * 0.146 + 0.010 * smoothstep(0.45, 1.0, uz);

    // Spine arch: high rounded rump, cosy soft back, thick neck rising smoothly into head
    const rumpArch = 0.010 * Math.exp(-Math.pow((uz + 0.48) / 0.36, 2));
    const neckRise = 0.044 * Math.pow(smoothstep(0.32, 1.0, uz), 1.45);
    const cy = rumpArch + neckRise;

    // Width profile: plush haunches, cosy belly, sturdy shoulders, thick neck merge
    let sx = lerp(0.094, 0.075, smoothstep(-0.45, 0.65, uz));
    sx = lerp(sx, 0.064, smoothstep(0.62, 0.96, uz));

    // Height profile: rounded back & fuller belly
    let sy = ny >= 0
      ? lerp(0.088, 0.076, smoothstep(-0.40, 0.55, uz))
      : lerp(0.080, 0.068, smoothstep(-0.10, 0.72, uz));
    sy = lerp(sy, 0.064, smoothstep(0.68, 0.98, uz));

    // Subtle haunch & shoulder anatomical fullness
    const haunch = Math.exp(-Math.pow((uz + 0.46) / 0.28, 2)) * Math.pow(Math.abs(nx), 1.6) * smoothstep(0.6, -0.3, ny);
    const shoulder = Math.exp(-Math.pow((uz - 0.42) / 0.25, 2)) * Math.pow(Math.abs(nx), 1.6) * smoothstep(-0.5, 0.35, ny);
    sx += 0.0085 * haunch + 0.006 * shoulder;

    // Gentle weight-bearing belly flattening
    const bellyFlat = smoothstep(-0.45, -0.96, ny) * (1 - smoothstep(0.55, 0.95, uz));
    sy *= 1 - 0.14 * bellyFlat;

    // Soft dorsal spine fullness
    const spine = smoothstep(0.75, 1.0, ny) * Math.exp(-Math.pow(uz / 0.72, 2));
    sy += 0.003 * spine;

    pos.setXYZ(i, v.x * sx, cy + v.y * sy, z);
  }

  geo.computeVertexNormals();
  return geo;
}

// Sculpted continuous head + trunk geometry
function buildHeadGeometry(THREE) {
  const geo = new THREE.SphereGeometry(1, 64, 48);
  geo.rotateX(Math.PI / 2);
  geo.rotateZ(Math.PI / 2);

  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const out = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const theta = Math.acos(clamp(v.z, -1, 1));
    const phi = Math.atan2(v.y, v.x);
    evalHeadPoint(THREE, theta, phi, out);
    pos.setXYZ(i, out.x, out.y, out.z);
  }

  geo.computeVertexNormals();
  return geo;
}

// Extruded + bevelled + cupped round tapir ear geometry
function buildEarGeometry(THREE, scale = 1.0, innerOffset = 0) {
  const shape = new THREE.Shape();
  const w = 0.024 * scale;
  const h = 0.052 * scale;
  shape.moveTo(0, 0);
  shape.bezierCurveTo(w * 0.85, h * 0.06, w * 1.18, h * 0.42, w * 0.92, h * 0.78);
  shape.bezierCurveTo(w * 0.68, h * 1.06, -w * 0.68, h * 1.06, -w * 0.92, h * 0.78);
  shape.bezierCurveTo(-w * 1.18, h * 0.42, -w * 0.85, h * 0.06, 0, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: innerOffset ? 0.0022 : 0.0052,
    bevelEnabled: true,
    bevelThickness: innerOffset ? 0.0014 : 0.0038,
    bevelSize: innerOffset ? 0.0014 : 0.0036,
    bevelSegments: 5,
    curveSegments: 24
  });

  // Center depth around z = 0, then bend into a natural cupped 3D shell
  geo.translate(0, 0, innerOffset ? -0.0011 : -0.0026);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const yn = clamp(y / h, 0, 1);
    const xn = x / (w * 1.1);
    // Horizontal scoop (concave toward +Z) + gentle longitudinal forward curl
    const scoop = (xn * xn) * 0.0115 * smoothstep(0.05, 0.65, yn);
    const arch = Math.sin(yn * Math.PI) * 0.0042 - yn * yn * 0.0055;
    // Slightly pinch width right at base so it embeds smoothly into skull
    const baseTaper = lerp(0.76, 1.0, smoothstep(0.0, 0.35, yn));
    x *= baseTaper;
    z += scoop + arch + innerOffset;

    pos.setXYZ(i, x, y, z);
  }

  // Normalize UVs cleanly to [0, 1] for painted ear rim texture
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const ux = (pos.getX(i) / (w * 2.2)) + 0.5;
    const uy = clamp(pos.getY(i) / h, 0, 1);
    uv.setXY(i, clamp(ux, 0, 1), uy);
  }

  geo.computeVertexNormals();
  return geo;
}

// Curved ivory tusk built from a 20-point LatheGeometry bent along an arc
function buildTuskGeometry(THREE, side) {
  const pts = [];
  const len = 0.028;
  const rBase = 0.0062;
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = t * len;
    // Slight gum-collar bulge near base, graceful taper to blunt-rounded chibi tip
    const collar = 1 + 0.08 * Math.exp(-Math.pow((t - 0.12) / 0.10, 2));
    const tipRound = Math.pow(Math.max(0, 1 - t), 0.72);
    const r = Math.max(0.00015, rBase * collar * tipRound * (t === 1 ? 0 : 1));
    pts.push(new THREE.Vector2(r, y));
  }

  const geo = new THREE.LatheGeometry(pts, 18);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = clamp(y / len, 0, 1);
    // Curve gently forward (+Z), outward (side * X), and gracefully upward (+Y)
    const bendZ = 0.011 * Math.pow(t, 1.65);
    const bendX = side * 0.0075 * Math.pow(t, 1.55);
    const bendY = -0.004 * t + 0.006 * Math.pow(t, 2.2);
    pos.setXYZ(i, x + bendX, y + bendY, z + bendZ);
  }
  geo.computeVertexNormals();
  return geo;
}

// Cute rounded tapir hoof built from an 18-point LatheGeometry
function buildHoofGeometry(THREE) {
  const pts = [];
  const steps = 18;
  const h = 0.0135;
  const rMax = 0.0092;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let r, y;
    if (t < 0.12) {
      // Flat grounded sole
      r = lerp(0.0001, rMax * 0.96, t / 0.12);
      y = 0;
    } else if (t < 0.55) {
      // Slightly flared rounded hoof wall
      const u = (t - 0.12) / 0.43;
      r = rMax * lerp(0.96, 1.0, Math.sin(u * Math.PI * 0.6)) * (1 - 0.12 * u);
      y = h * (0.04 + 0.62 * u);
    } else {
      // Smooth rounded top dome tucking into foot
      const u = (t - 0.55) / 0.45;
      r = rMax * 0.88 * Math.cos(u * Math.PI * 0.5);
      y = h * (0.66 + 0.34 * Math.sin(u * Math.PI * 0.5));
    }
    pts.push(new THREE.Vector2(Math.max(0.0001, r), y));
  }
  const geo = new THREE.LatheGeometry(pts, 16);
  // Elongate slightly forward for a toe-like silhouette
  geo.scale(0.86, 1.0, 1.18);
  geo.computeVertexNormals();
  return geo;
}

// Curved extruded fur lock for the tufted tail tip
function buildTailTuftLockGeometry(THREE) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.011, 0.006, 0.014, 0.022, 0.005, 0.036);
  shape.bezierCurveTo(0.002, 0.042, -0.002, 0.042, -0.005, 0.036);
  shape.bezierCurveTo(-0.014, 0.022, -0.011, 0.006, 0, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0045,
    bevelEnabled: true,
    bevelThickness: 0.0028,
    bevelSize: 0.0025,
    bevelSegments: 4,
    curveSegments: 16
  });
  geo.translate(0, 0, -0.00225);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const yn = clamp(y / 0.042, 0, 1);
    // Curve gently outward and curl back slightly at tip like soft plush fur
    const zCurve = Math.sin(yn * Math.PI) * 0.006 - yn * yn * 0.008;
    const xCup = (x * x) * 14.0;
    pos.setXYZ(i, x, y, z + zCurve + xCup);
  }
  geo.computeVertexNormals();
  return geo;
}

// Subtle curved blush patch projected directly onto the sculpted cheek surface
function buildCheekBlushGeometry(THREE, side) {
  const geo = new THREE.PlaneGeometry(1, 1, 14, 14);
  const pos = geo.attributes.position;
  const thetaCenter = 0.90;
  const phiCenter = side > 0 ? -0.08 : Math.PI + 0.08;
  const dThetaSpan = 0.24;
  const dPhiSpan = 0.26;

  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i); // [-0.5, 0.5]
    const v = pos.getY(i); // [-0.5, 0.5]
    const th = thetaCenter + v * dThetaSpan;
    const ph = phiCenter + u * dPhiSpan * side;
    const { pos: sp, normal: sn } = sampleHeadFrame(THREE, th, ph);
    sp.addScaledVector(sn, 0.0009);
    pos.setXYZ(i, sp.x, sp.y, sp.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Dream-bubble outer shell built from a 20-point LatheGeometry (subtle organic droplet-pearl)
function buildDreamBubbleGeometry(THREE) {
  const pts = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * Math.PI;
    // Slightly buoyant soap-bubble profile (gently fuller upper half, soft wobble)
    const wobble = 1.0 + 0.04 * Math.sin(a * 2.0 - 0.4) - 0.03 * Math.cos(a);
    const r = Math.max(0.0001, Math.sin(a) * wobble);
    const y = -Math.cos(a) * (1.03 + 0.02 * Math.sin(a));
    pts.push(new THREE.Vector2(r, y));
  }
  const geo = new THREE.LatheGeometry(pts, 24);
  geo.computeVertexNormals();
  return geo;
}

// Tiny glowing dream crescent & 4-point star for inside the largest bubbles
function buildDreamCrescentGeometry(THREE) {
  const shape = new THREE.Shape();
  shape.moveTo(0.002, 0.011);
  shape.bezierCurveTo(-0.010, 0.010, -0.013, -0.010, 0.002, -0.011);
  shape.bezierCurveTo(-0.004, -0.006, -0.004, 0.006, 0.002, 0.011);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0028,
    bevelEnabled: true,
    bevelThickness: 0.0014,
    bevelSize: 0.0012,
    bevelSegments: 3,
    curveSegments: 16
  });
  geo.center();
  return geo;
}

function buildDreamStarGeometry(THREE) {
  const shape = new THREE.Shape();
  const rOut = 0.0115;
  const rIn = 0.0038;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 === 0 ? rOut : rIn;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0025,
    bevelEnabled: true,
    bevelThickness: 0.0014,
    bevelSize: 0.0011,
    bevelSegments: 3
  });
  geo.center();
  return geo;
}

// Painted Body Fur Texture (stripes across back, darker dorsal gradient, lighter belly, fur flecks)
function createBodyFurTextures(THREE, palette, kit) {
  const map = kit.canvasTexture(1024, 1024, (ctx, w, h) => {
    // Base fur
    ctx.fillStyle = hexCss(THREE, palette.fur);
    ctx.fillRect(0, 0, w, h);

    // Circumferential lighting/fur-value gradient:
    // x = w/2 is top spine; x = 0 and x = w are belly centerline
    const dorsalGrad = ctx.createLinearGradient(0, 0, w, 0);
    dorsalGrad.addColorStop(0.0, rgbaCss(palette.furLight, 0.72));
    dorsalGrad.addColorStop(0.16, rgbaCss(palette.furLight, 0.25));
    dorsalGrad.addColorStop(0.32, rgbaCss(palette.fur, 0.0));
    dorsalGrad.addColorStop(0.50, rgbaCss(palette.furDark, 0.42));
    dorsalGrad.addColorStop(0.68, rgbaCss(palette.fur, 0.0));
    dorsalGrad.addColorStop(0.84, rgbaCss(palette.furLight, 0.25));
    dorsalGrad.addColorStop(1.0, rgbaCss(palette.furLight, 0.72));
    ctx.fillStyle = dorsalGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle warmer chest / darker rump longitudinal variation
    const lenGrad = ctx.createLinearGradient(0, 0, 0, h);
    lenGrad.addColorStop(0.0, rgbaCss(palette.furDark, 0.14));
    lenGrad.addColorStop(0.35, rgbaCss(palette.fur, 0.0));
    lenGrad.addColorStop(0.85, rgbaCss(palette.furDark, 0.18));
    lenGrad.addColorStop(1.0, rgbaCss(palette.furDark, 0.30));
    ctx.fillStyle = lenGrad;
    ctx.fillRect(0, 0, w, h);

    // Soft dreamy saddle halo under the back stripes
    const saddleGrad = ctx.createRadialGradient(w * 0.5, h * 0.52, w * 0.04, w * 0.5, h * 0.52, w * 0.34);
    saddleGrad.addColorStop(0.0, rgbaCss(palette.furAccent, 0.26));
    saddleGrad.addColorStop(0.65, rgbaCss(palette.furAccent, 0.12));
    saddleGrad.addColorStop(1.0, rgbaCss(palette.furAccent, 0.0));
    ctx.fillStyle = saddleGrad;
    ctx.fillRect(0, 0, w, h);

    // Painted tapir stripes draped across the back and flanks (y = 0 front, y = h rump)
    const stripeSpecs = [
      { yc: 0.28, halfW: 0.21, thick: 0.036, arch: 0.032 },
      { yc: 0.40, halfW: 0.27, thick: 0.046, arch: 0.042 },
      { yc: 0.53, halfW: 0.29, thick: 0.050, arch: 0.045 },
      { yc: 0.66, halfW: 0.27, thick: 0.044, arch: 0.038 },
      { yc: 0.78, halfW: 0.22, thick: 0.034, arch: 0.025 }
    ];

    // Draw organic feathered stripes using brush strokes modulated by kit.noise
    for (let s = 0; s < stripeSpecs.length; s++) {
      const sp = stripeSpecs[s];
      const steps = 96;
      for (let pass = 0; pass < 2; pass++) {
        const alpha = pass === 0 ? 0.34 : 0.78;
        const spread = pass === 0 ? 1.32 : 0.92;
        ctx.fillStyle = rgbaCss(palette.furAccent, alpha);
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const u = (i / steps) * 2 - 1; // -1..1 across flanks
          const taper = Math.sqrt(Math.max(0, 1 - u * u));
          const n = (fbm(kit, (u + 2) * 3.8 + s * 4.1, s * 2.7 + 1.2) - 0.5) * 0.022;
          const x = (0.5 + u * sp.halfW) * w;
          const yCenter = (sp.yc + u * u * sp.arch + n) * h;
          const halfT = sp.thick * 0.5 * spread * (0.22 + 0.78 * taper) * h;
          if (i === 0) ctx.moveTo(x, yCenter - halfT);
          else ctx.lineTo(x, yCenter - halfT);
        }
        for (let i = steps; i >= 0; i--) {
          const u = (i / steps) * 2 - 1;
          const taper = Math.sqrt(Math.max(0, 1 - u * u));
          const n = (fbm(kit, (u + 2) * 3.8 + s * 4.1, s * 2.7 + 6.4) - 0.5) * 0.022;
          const x = (0.5 + u * sp.halfW) * w;
          const yCenter = (sp.yc + u * u * sp.arch + n) * h;
          const halfT = sp.thick * 0.5 * spread * (0.22 + 0.78 * taper) * h;
          ctx.lineTo(x, yCenter + halfT);
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    // Subtle baby-tapir soft spots along the lower flank transitions
    const spots = [
      [0.24, 0.34, 16, 26], [0.76, 0.34, 16, 26],
      [0.21, 0.49, 18, 30], [0.79, 0.49, 18, 30],
      [0.22, 0.64, 16, 28], [0.78, 0.64, 16, 28],
      [0.27, 0.77, 14, 22], [0.73, 0.77, 14, 22],
      [0.31, 0.24, 12, 18], [0.69, 0.24, 12, 18]
    ];
    for (let i = 0; i < spots.length; i++) {
      const [sx, sy, rx, ry] = spots[i];
      const cx = sx * w;
      const cy = sy * h;
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, ry);
      g.addColorStop(0, rgbaCss(palette.furAccent, 0.62));
      g.addColorStop(0.65, rgbaCss(palette.furAccent, 0.28));
      g.addColorStop(1, rgbaCss(palette.furAccent, 0));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(rx / ry, 1);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, ry, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Fine directional fur flecks layered across the whole pelt
    ctx.lineCap = 'round';
    const cols = 120;
    const rows = 96;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const u = (c + 0.5) / cols;
        const v = (r + 0.5) / rows;
        const n1 = kit.noise(u * 29.3 + 2.1, v * 29.3 + 5.7);
        const n2 = kit.noise(u * 61.7 + 14.2, v * 61.7 + 3.9);
        const jx = (n1 - 0.5) * (w / cols) * 1.4;
        const jy = (n2 - 0.5) * (h / rows) * 1.4;
        const x = u * w + jx;
        const y = v * h + jy;
        const len = 7 + n2 * 11;
        const drift = (u - 0.5) * 4.0 + (n1 - 0.5) * 3.5;
        ctx.strokeStyle = n2 > 0.52
          ? rgbaCss(palette.furAccent, 0.08 + (n2 - 0.52) * 0.14)
          : rgbaCss(palette.furDark, 0.10 + (0.52 - n2) * 0.16);
        ctx.lineWidth = 1.2 + n1 * 1.1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + drift, y + len);
        ctx.stroke();
      }
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;

  const bump = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = 'round';
    const cols = 92;
    const rows = 80;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const u = (c + 0.5) / cols;
        const v = (r + 0.5) / rows;
        const n1 = kit.noise(u * 35.1 + 1.3, v * 35.1 + 8.9);
        const n2 = kit.noise(u * 71.9 + 9.4, v * 71.9 + 2.2);
        const x = u * w + (n1 - 0.5) * 7;
        const y = v * h + (n2 - 0.5) * 7;
        const lum = Math.round(92 + n2 * 82);
        ctx.strokeStyle = `rgba(${lum},${lum},${lum},0.48)`;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (n1 - 0.5) * 3.2, y + 6 + n2 * 6);
        ctx.stroke();
      }
    }
  });
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.ClampToEdgeWrapping;

  return { map, bump };
}

// Painted Head Fur Texture (snout gradient, soft forehead blaze, warm throat, fur flecks)
function createHeadFurTexture(THREE, palette, kit) {
  const map = kit.canvasTexture(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = hexCss(THREE, palette.fur);
    ctx.fillRect(0, 0, w, h);

    // Lighter warm throat/chin along x=0 and x=w; soft richer crown at x=w/2
    const circGrad = ctx.createLinearGradient(0, 0, w, 0);
    circGrad.addColorStop(0.0, rgbaCss(palette.furLight, 0.58));
    circGrad.addColorStop(0.18, rgbaCss(palette.furLight, 0.16));
    circGrad.addColorStop(0.50, rgbaCss(palette.furDark, 0.24));
    circGrad.addColorStop(0.82, rgbaCss(palette.furLight, 0.16));
    circGrad.addColorStop(1.0, rgbaCss(palette.furLight, 0.58));
    ctx.fillStyle = circGrad;
    ctx.fillRect(0, 0, w, h);

    // Soft velvety darker trunk tip (y = 0 is trunk tip, y = h is back of skull)
    const trunkGrad = ctx.createLinearGradient(0, 0, 0, h * 0.26);
    trunkGrad.addColorStop(0.0, rgbaCss(palette.furDeep, 0.72));
    trunkGrad.addColorStop(0.42, rgbaCss(palette.furDark, 0.34));
    trunkGrad.addColorStop(1.0, rgbaCss(palette.fur, 0.0));
    ctx.fillStyle = trunkGrad;
    ctx.fillRect(0, 0, w, h * 0.28);

    // Delicate pale snout-bridge & forehead markings tying head to striped back
    const blaze = ctx.createRadialGradient(w * 0.5, h * 0.44, 6, w * 0.5, h * 0.44, w * 0.10);
    blaze.addColorStop(0.0, rgbaCss(palette.furAccent, 0.52));
    blaze.addColorStop(0.55, rgbaCss(palette.furAccent, 0.18));
    blaze.addColorStop(1.0, rgbaCss(palette.furAccent, 0.0));
    ctx.save();
    ctx.translate(w * 0.5, h * 0.44);
    ctx.scale(0.65, 1.5);
    ctx.translate(-w * 0.5, -h * 0.44);
    ctx.fillStyle = blaze;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // Two tiny soft dreamy brow dots above the eyes
    const browSpots = [
      [0.41, 0.35],
      [0.59, 0.35]
    ];
    for (let i = 0; i < browSpots.length; i++) {
      const [bx, by] = browSpots[i];
      const bg = ctx.createRadialGradient(bx * w, by * h, 2, bx * w, by * h, 26);
      bg.addColorStop(0, rgbaCss(palette.furAccent, 0.48));
      bg.addColorStop(1, rgbaCss(palette.furAccent, 0));
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(bx * w, by * h, 26, 0, Math.PI * 2);
      ctx.fill();
    }

    // Soft rosy cheek under-blush baked lightly into fur
    const cheeks = [
      [0.25, 0.29],
      [0.75, 0.29]
    ];
    for (let i = 0; i < cheeks.length; i++) {
      const [cx, cy] = cheeks[i];
      const cg = ctx.createRadialGradient(cx * w, cy * h, 6, cx * w, cy * h, 72);
      cg.addColorStop(0, rgbaCss(palette.skin, 0.34));
      cg.addColorStop(0.6, rgbaCss(palette.skin, 0.12));
      cg.addColorStop(1, rgbaCss(palette.skin, 0));
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx * w, cy * h, 72, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fine directional fur flecks flowing from snout over brow & cheeks
    ctx.lineCap = 'round';
    const cols = 104;
    const rows = 88;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const u = (c + 0.5) / cols;
        const v = (r + 0.5) / rows;
        if (v < 0.08) continue; // smoother velvet trunk tip
        const n1 = kit.noise(u * 31.7 + 4.2, v * 31.7 + 1.9);
        const n2 = kit.noise(u * 67.3 + 8.1, v * 67.3 + 6.3);
        const x = u * w + (n1 - 0.5) * 11;
        const y = v * h + (n2 - 0.5) * 11;
        const len = 6 + n2 * 9;
        ctx.strokeStyle = n2 > 0.5
          ? rgbaCss(palette.furAccent, 0.07 + (n2 - 0.5) * 0.12)
          : rgbaCss(palette.furDark, 0.09 + (0.5 - n2) * 0.14);
        ctx.lineWidth = 1.1 + n1 * 0.9;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (u - 0.5) * 3.0 + (n1 - 0.5) * 2.5, y + len);
        ctx.stroke();
      }
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  return map;
}

// Painted Ear Texture with signature pale tapir ear-tip rim
function createEarTexture(THREE, palette, kit) {
  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = hexCss(THREE, palette.fur);
    ctx.fillRect(0, 0, w, h);

    // Classic tapir cream/accent rim around the upper rounded edge (v=1 -> y=0)
    const rimGrad = ctx.createRadialGradient(w * 0.5, h * 0.62, w * 0.26, w * 0.5, h * 0.52, w * 0.56);
    rimGrad.addColorStop(0.0, rgbaCss(palette.furDark, 0.22));
    rimGrad.addColorStop(0.64, rgbaCss(palette.fur, 0.0));
    rimGrad.addColorStop(0.80, rgbaCss(palette.furAccent, 0.85));
    rimGrad.addColorStop(1.0, rgbaCss(palette.furAccent, 0.96));
    ctx.fillStyle = rimGrad;
    ctx.fillRect(0, 0, w, h);

    // Soft top-edge reinforcement
    const topGrad = ctx.createLinearGradient(0, 0, 0, h * 0.25);
    topGrad.addColorStop(0.0, rgbaCss(palette.furAccent, 0.92));
    topGrad.addColorStop(0.55, rgbaCss(palette.furAccent, 0.35));
    topGrad.addColorStop(1.0, rgbaCss(palette.furAccent, 0.0));
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, w, h * 0.28);

    // Fur flecks
    ctx.lineCap = 'round';
    for (let i = 0; i < 900; i++) {
      const u = kit.noise(i * 1.37, 3.1);
      const v = kit.noise(7.9, i * 1.73);
      const x = u * w;
      const y = v * h;
      const n = kit.noise(u * 24, v * 24);
      ctx.strokeStyle = n > 0.5 ? rgbaCss(palette.furAccent, 0.12) : rgbaCss(palette.furDark, 0.14);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (u - 0.5) * 6, y - 8);
      ctx.stroke();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

// Painted Iris Texture (limbal ring, radial iris fibres, warm lower glow, dark pupil)
function createIrisTexture(THREE, palette, kit) {
  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const r = w * 0.48;

    ctx.fillStyle = '#0d0b14';
    ctx.fillRect(0, 0, w, h);

    const irisDark = palette.eye.clone().multiplyScalar(0.38);
    const irisBright = palette.eye.clone().lerp(new THREE.Color('#fff4d8'), 0.42);

    // Outer limbal ring into main iris gradient
    const g = ctx.createRadialGradient(cx, cy, r * 0.18, cx, cy, r);
    g.addColorStop(0.0, '#0a0810');
    g.addColorStop(0.46, '#0d0a16');
    g.addColorStop(0.54, hexCss(THREE, palette.eye));
    g.addColorStop(0.84, hexCss(THREE, irisDark));
    g.addColorStop(1.0, '#0a0810');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Soft glowing lower crescent inside iris (gives soulful anime/figurine life)
    const glowG = ctx.createRadialGradient(cx, cy + r * 0.44, 4, cx, cy + r * 0.36, r * 0.48);
    glowG.addColorStop(0.0, rgbaCss(irisBright, 0.92));
    glowG.addColorStop(0.6, rgbaCss(palette.eye, 0.45));
    glowG.addColorStop(1.0, rgbaCss(palette.eye, 0.0));
    ctx.fillStyle = glowG;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2);
    ctx.fill();

    // Subtle radial iris filaments
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const n = kit.noise(Math.cos(a) * 4 + 5, Math.sin(a) * 4 + 5);
      ctx.strokeStyle = n > 0.5 ? rgbaCss(irisBright, 0.18) : rgbaCss(irisDark, 0.22);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.50, cy + Math.sin(a) * r * 0.50);
      ctx.lineTo(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86);
      ctx.stroke();
    }

    // Crisp glossy dark central pupil
    ctx.fillStyle = '#09070f';
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.03, r * 0.46, 0, Math.PI * 2);
    ctx.fill();
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

// Soft feathered blush texture
function createBlushTexture(THREE, palette) {
  const map = kit_blush_dummy(THREE, palette);
  return map;
}

function kit_blush_dummy() {
  return null;
}

function createBlushMap(THREE, palette, kit) {
  const map = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w * 0.5;
    const cy = h * 0.5;
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, w * 0.48);
    g.addColorStop(0.0, rgbaCss(palette.skin, 0.52));
    g.addColorStop(0.55, rgbaCss(palette.skin, 0.20));
    g.addColorStop(1.0, rgbaCss(palette.skin, 0.0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.48, 0, Math.PI * 2);
    ctx.fill();
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

// Build a 3-layer expressive eye (glossy dark eyeball, coloured iris dome, twin white highlights, upper lid)
function buildEyeGroup(THREE, side, mats) {
  const g = new THREE.Group();
  g.name = side > 0 ? 'eyeL' : 'eyeR';

  // Layer 1: Glossy dark eyeball nestled slightly into socket
  const ballGeo = new THREE.SphereGeometry(0.0145, 28, 22);
  ballGeo.scale(1.0, 1.07, 0.72);
  const ball = new THREE.Mesh(ballGeo, mats.eyeball);
  ball.userData.slot = 'secondary';
  g.add(ball);

  // Layer 2: Coloured iris cap sitting cleanly on the front cornea
  const irisGeo = new THREE.SphereGeometry(0.0136, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.34);
  irisGeo.rotateX(Math.PI / 2);
  // Map frontal planar UVs for clean iris texture projection
  const iPos = irisGeo.attributes.position;
  const iUv = irisGeo.attributes.uv;
  const maxR = 0.0136 * Math.sin(Math.PI * 0.34);
  for (let i = 0; i < iPos.count; i++) {
    const ux = iPos.getX(i) / (maxR * 2) + 0.5;
    const uy = iPos.getY(i) / (maxR * 2) + 0.5;
    iUv.setXY(i, clamp(ux, 0, 1), clamp(uy, 0, 1));
  }
  irisGeo.scale(1.0, 1.07, 0.76);
  const iris = new THREE.Mesh(irisGeo, mats.iris);
  iris.position.z = 0.0005;
  iris.userData.slot = 'eye';
  g.add(iris);

  // Layer 3: Twin crisp white highlight dots (placed up and to one side)
  const hiBigGeo = new THREE.SphereGeometry(0.0033, 14, 12);
  hiBigGeo.scale(1.05, 0.92, 0.52);
  const hiBig = new THREE.Mesh(hiBigGeo, mats.eyeHighlight);
  hiBig.position.set(side * 0.0040, 0.0052, 0.0096);
  hiBig.userData.slot = 'accent';
  g.add(hiBig);

  const hiSmallGeo = new THREE.SphereGeometry(0.0015, 12, 10);
  hiSmallGeo.scale(1.0, 1.0, 0.55);
  const hiSmall = new THREE.Mesh(hiSmallGeo, mats.eyeHighlight);
  hiSmall.position.set(-side * 0.0034, -0.0042, 0.0099);
  hiSmall.userData.slot = 'accent';
  g.add(hiSmall);

  // Subtle curved upper eyelid lash hugging the top rim
  const lidPts = [
    new THREE.Vector3(-0.0135, 0.0025, 0.0025),
    new THREE.Vector3(-0.0078, 0.0126, 0.0068),
    new THREE.Vector3(0.0, 0.0156, 0.0076),
    new THREE.Vector3(0.0078, 0.0126, 0.0068),
    new THREE.Vector3(0.0135, 0.0025, 0.0025)
  ];
  const lidCurve = new THREE.CatmullRomCurve3(lidPts);
  const lidGeo = createTaperedTube(THREE, lidCurve, 18, 10, (t) => 0.0010 + 0.0016 * Math.sin(t * Math.PI), true, true);
  const lid = new THREE.Mesh(lidGeo, mats.eyelid);
  lid.userData.slot = 'secondary';
  g.add(lid);

  return g;
}

// Build one sturdy tapered limb + 3 rounded tapir toe-hooves
function buildLegGroup(THREE, name, pts, radiusFn, hoofGeo, hoofPos, hoofRot, mats, grounded) {
  const group = new THREE.Group();
  group.name = name;

  const anchor = pts[0].clone();
  const localPts = pts.map((p) => p.clone().sub(anchor));
  const curve = new THREE.CatmullRomCurve3(localPts);
  const legGeo = createTaperedTube(THREE, curve, 24, 18, radiusFn, true, true);

  // Flatten very bottom of grounded foot pad slightly so it sits flush on floor
  if (grounded) {
    const pos = legGeo.attributes.position;
    const minLocalY = -anchor.y;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < minLocalY + 0.001) {
        pos.setY(i, minLocalY + 0.0005);
      }
    }
    legGeo.computeVertexNormals();
  }

  const legMesh = new THREE.Mesh(legGeo, mats.limbFur);
  legMesh.userData.slot = 'fur';
  legMesh.castShadow = true;
  legMesh.receiveShadow = true;
  group.add(legMesh);

  // 3 cute fanned glossy rounded tapir hooves on the front of the foot
  const footCenter = hoofPos.clone().sub(anchor);
  const toeAngles = [-0.46, 0.0, 0.46];
  const toeScales = [0.88, 1.04, 0.88];
  const hoofGroup = new THREE.Group();
  hoofGroup.position.copy(footCenter);
  hoofGroup.rotation.set(hoofRot.x, hoofRot.y, hoofRot.z);

  for (let i = 0; i < 3; i++) {
    const a = toeAngles[i];
    const sc = toeScales[i];
    const hoof = new THREE.Mesh(hoofGeo, mats.hoof);
    hoof.scale.set(sc, sc, sc);
    hoof.position.set(Math.sin(a) * 0.0155, 0, Math.cos(a) * 0.0155);
    hoof.rotation.y = a;
    hoof.userData.slot = 'secondary';
    hoof.castShadow = true;
    hoof.receiveShadow = true;
    hoofGroup.add(hoof);
  }
  group.add(hoofGroup);

  group.position.copy(anchor);
  return group;
}

function storeRest(obj) {
  if (!obj) return;
  obj.userData.rest = {
    pos: [obj.position.x, obj.position.y, obj.position.z],
    rot: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
    scale: [obj.scale.x, obj.scale.y, obj.scale.z]
  };
}

export function build(THREE, opts = {}, kit) {
  const palette = resolvePalette(THREE, opts);

  // Textures generated via kit.canvasTexture + kit.noise
  const bodyTex = createBodyFurTextures(THREE, palette, kit);
  const headMap = createHeadFurTexture(THREE, palette, kit);
  const earMap = createEarTexture(THREE, palette, kit);
  const irisMap = createIrisTexture(THREE, palette, kit);
  const blushMap = createBlushMap(THREE, palette, kit);

  // Materials (all MeshPhysicalMaterial)
  const mats = {
    bodyFur: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: bodyTex.map,
      bumpMap: bodyTex.bump,
      bumpScale: 0.0024,
      roughness: 0.92,
      metalness: 0.0,
      sheen: 0.85,
      sheenRoughness: 0.68,
      sheenColor: palette.furSheen
    }),
    headFur: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: headMap,
      bumpMap: bodyTex.bump,
      bumpScale: 0.0018,
      roughness: 0.90,
      metalness: 0.0,
      sheen: 0.82,
      sheenRoughness: 0.66,
      sheenColor: palette.furSheen
    }),
    limbFur: new THREE.MeshPhysicalMaterial({
      color: palette.fur.clone().multiplyScalar(0.92),
      bumpMap: bodyTex.bump,
      bumpScale: 0.0020,
      roughness: 0.92,
      metalness: 0.0,
      sheen: 0.78,
      sheenRoughness: 0.70,
      sheenColor: palette.furSheen
    }),
    earOuter: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: earMap,
      bumpMap: bodyTex.bump,
      bumpScale: 0.0016,
      roughness: 0.90,
      metalness: 0.0,
      sheen: 0.82,
      sheenRoughness: 0.65,
      sheenColor: palette.furSheen
    }),
    earInner: new THREE.MeshPhysicalMaterial({
      color: palette.skin,
      roughness: 0.88,
      metalness: 0.0,
      sheen: 0.72,
      sheenRoughness: 0.72,
      sheenColor: palette.accentSheen
    }),
    tuftAccent: new THREE.MeshPhysicalMaterial({
      color: palette.furAccent,
      bumpMap: bodyTex.bump,
      bumpScale: 0.0022,
      roughness: 0.91,
      metalness: 0.0,
      sheen: 0.90,
      sheenRoughness: 0.62,
      sheenColor: palette.accentSheen
    }),
    hoof: new THREE.MeshPhysicalMaterial({
      color: palette.hoof,
      roughness: 0.24,
      metalness: 0.04,
      clearcoat: 0.85,
      clearcoatRoughness: 0.14
    }),
    tusk: new THREE.MeshPhysicalMaterial({
      color: palette.tusk,
      roughness: 0.18,
      metalness: 0.02,
      clearcoat: 0.92,
      clearcoatRoughness: 0.10
    }),
    eyeball: new THREE.MeshPhysicalMaterial({
      color: '#12101a',
      roughness: 0.05,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04
    }),
    iris: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: irisMap,
      roughness: 0.08,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05
    }),
    eyeHighlight: new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      emissive: '#ffffff',
      emissiveIntensity: 0.65,
      roughness: 0.05,
      clearcoat: 1.0
    }),
    eyelid: new THREE.MeshPhysicalMaterial({
      color: palette.furDeep,
      roughness: 0.72,
      metalness: 0.0,
      sheen: 0.45,
      sheenColor: palette.furSheen
    }),
    nostril: new THREE.MeshPhysicalMaterial({
      color: '#1b1724',
      roughness: 0.14,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08
    }),
    mouth: new THREE.MeshPhysicalMaterial({
      color: palette.furDeep,
      roughness: 0.55,
      metalness: 0.0
    }),
    blush: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: blushMap,
      transparent: true,
      depthWrite: false,
      roughness: 0.94,
      sheen: 0.55,
      sheenColor: palette.accentSheen
    }),
    bubbleShell: new THREE.MeshPhysicalMaterial({
      color: palette.glow.clone().lerp(new THREE.Color('#ffffff'), 0.45),
      emissive: palette.glow,
      emissiveIntensity: 0.48,
      transparent: true,
      opacity: 0.34,
      roughness: 0.06,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      iridescence: 0.85,
      iridescenceIOR: 1.32,
      depthWrite: false
    }),
    bubbleCore: new THREE.MeshPhysicalMaterial({
      color: palette.glow.clone().lerp(new THREE.Color('#ffffff'), 0.65),
      emissive: palette.glow,
      emissiveIntensity: 1.65,
      roughness: 0.18,
      clearcoat: 0.6
    })
  };

  const root = new THREE.Group();
  root.name = 'baku';

  // --- 1. BODY (sculpted continuous torso + neck base) ---
  const body = new THREE.Group();
  body.name = 'body';
  body.position.set(0, 0.150, -0.026);

  const bodyMesh = new THREE.Mesh(buildBodyGeometry(THREE), mats.bodyFur);
  bodyMesh.userData.slot = 'fur';
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  body.add(bodyMesh);
  root.add(body);

  // --- 2. HEAD (sculpted continuous cranium + cheeks + snout + short flexible trunk) ---
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 0.200, 0.090);
  // Gentle curious pose: slightly tilted and turned toward the floating dream-bubbles
  head.rotation.set(0.04, -0.09, 0.085);

  const headMesh = new THREE.Mesh(buildHeadGeometry(THREE), mats.headFur);
  headMesh.userData.slot = 'fur';
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  head.add(headMesh);

  // Eyes placed using exact surface sampling into the sculpted sockets
  const eyeTheta = 0.98;
  const eyePhiL = 0.34;
  const eyePhiR = Math.PI - eyePhiL;
  const eyeSpecs = [
    { side: 1, phi: eyePhiL },
    { side: -1, phi: eyePhiR }
  ];
  for (let i = 0; i < eyeSpecs.length; i++) {
    const { side, phi } = eyeSpecs[i];
    const { pos: ep, normal: en } = sampleHeadFrame(THREE, eyeTheta, phi);
    const eyeGroup = buildEyeGroup(THREE, side, mats);
    // Slightly inset into socket so eyes never float
    eyeGroup.position.copy(ep).addScaledVector(en, -0.0032);
    const lookTarget = ep.clone().add(en);
    eyeGroup.lookAt(lookTarget);
    head.add(eyeGroup);
    storeRest(eyeGroup);
  }

  // Subtle curved blush discs hugging each cheek
  for (const side of [1, -1]) {
    const blush = new THREE.Mesh(buildCheekBlushGeometry(THREE, side), mats.blush);
    blush.userData.slot = 'skin';
    head.add(blush);
  }

  // Small sculpted glossy nostril pads on the trunk tip
  const nostrilGeo = new THREE.SphereGeometry(0.0040, 14, 12);
  nostrilGeo.scale(1.18, 0.72, 0.75);
  for (const side of [1, -1]) {
    const ph = side > 0 ? -0.68 : -(Math.PI - 0.68);
    const { pos: np, normal: nn } = sampleHeadFrame(THREE, 0.21, ph);
    const nos = new THREE.Mesh(nostrilGeo, mats.nostril);
    nos.position.copy(np).addScaledVector(nn, -0.0005);
    nos.lookAt(np.clone().add(nn));
    nos.userData.slot = 'secondary';
    head.add(nos);
  }

  // Curved serene smile mouth line (tapered tube tucked under snout base)
  const mouthAngles = [-0.88, -0.45, 0.0, 0.45, 0.88];
  const mouthPts = mouthAngles.map((a) => {
    const ph = -Math.PI * 0.5 + a * 0.62;
    const th = 0.84 + Math.abs(a) * 0.05 - Math.cos(a * 1.8) * 0.025;
    const { pos: mp, normal: mn } = sampleHeadFrame(THREE, th, ph);
    mp.addScaledVector(mn, 0.0004);
    mp.y -= 0.0012 * Math.cos(a * 1.4);
    return mp;
  });
  const mouthCurve = new THREE.CatmullRomCurve3(mouthPts);
  const mouthGeo = createTaperedTube(THREE, mouthCurve, 20, 8, (t) => 0.0010 + 0.0011 * Math.sin(t * Math.PI), true, true);
  const mouthMesh = new THREE.Mesh(mouthGeo, mats.mouth);
  mouthMesh.userData.slot = 'secondary';
  head.add(mouthMesh);

  // Small curved ivory tusks (LatheGeometry >= 20 points, bent smoothly)
  for (const side of [1, -1]) {
    const tuskMesh = new THREE.Mesh(buildTuskGeometry(THREE, side), mats.tusk);
    // Root deeply inside upper muzzle cheeks so they emerge seamlessly
    tuskMesh.position.set(side * 0.026, -0.024, 0.056);
    tuskMesh.rotation.set(0.62, side * 0.24, -side * 0.26);
    tuskMesh.userData.slot = 'accent';
    tuskMesh.castShadow = true;
    head.add(tuskMesh);
  }

  // Round cupped ears (ExtrudeGeometry + bevel + 3D bend + nested soft inner ear)
  const earOuterGeo = buildEarGeometry(THREE, 1.0, 0);
  const earInnerGeo = buildEarGeometry(THREE, 0.74, 0.0038);

  const earConfigs = [
    { name: 'earL', side: 1, pos: [0.052, 0.050, -0.016], rot: [0.16, 0.36, -0.42] },
    { name: 'earR', side: -1, pos: [-0.052, 0.049, -0.018], rot: [0.22, -0.44, 0.48] }
  ];
  for (let i = 0; i < earConfigs.length; i++) {
    const cfg = earConfigs[i];
    const earGroup = new THREE.Group();
    earGroup.name = cfg.name;
    earGroup.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
    earGroup.rotation.set(cfg.rot[0], cfg.rot[1], cfg.rot[2]);

    const outer = new THREE.Mesh(earOuterGeo, mats.earOuter);
    outer.userData.slot = 'fur';
    outer.castShadow = true;
    outer.receiveShadow = true;
    earGroup.add(outer);

    const inner = new THREE.Mesh(earInnerGeo, mats.earInner);
    inner.position.set(0, 0.0045, 0.0008);
    inner.userData.slot = 'skin';
    earGroup.add(inner);

    head.add(earGroup);
    storeRest(earGroup);
  }

  root.add(head);

  // --- 3. FOUR LEGS (tapered tubes along CatmullRomCurve3 + lathed tapir hooves) ---
  // 3 grounded legs resting cleanly at y = 0; front-right paw gently lifted in curiosity
  const hoofGeo = buildHoofGeometry(THREE);

  const armL = buildLegGroup(
    THREE,
    'armL',
    [
      new THREE.Vector3(0.050, 0.145, 0.050),
      new THREE.Vector3(0.060, 0.088, 0.058),
      new THREE.Vector3(0.058, 0.042, 0.066),
      new THREE.Vector3(0.058, 0.012, 0.068)
    ],
    (t) => lerp(0.036, 0.020, smoothstep(0.0, 0.82, t)) + 0.0035 * smoothstep(0.76, 1.0, t),
    hoofGeo,
    new THREE.Vector3(0.058, 0.0, 0.072),
    new THREE.Euler(0, 0.08, 0),
    mats,
    true
  );
  root.add(armL);

  const armR = buildLegGroup(
    THREE,
    'armR',
    [
      new THREE.Vector3(-0.050, 0.145, 0.050),
      new THREE.Vector3(-0.060, 0.095, 0.064),
      new THREE.Vector3(-0.058, 0.056, 0.088),
      new THREE.Vector3(-0.054, 0.036, 0.102)
    ],
    (t) => lerp(0.036, 0.0195, smoothstep(0.0, 0.84, t)) + 0.003 * smoothstep(0.78, 1.0, t),
    hoofGeo,
    new THREE.Vector3(-0.053, 0.025, 0.107),
    new THREE.Euler(0.32, -0.14, 0.08),
    mats,
    false
  );
  root.add(armR);

  const legL = buildLegGroup(
    THREE,
    'legL',
    [
      new THREE.Vector3(0.056, 0.152, -0.090),
      new THREE.Vector3(0.066, 0.096, -0.105),
      new THREE.Vector3(0.064, 0.048, -0.102),
      new THREE.Vector3(0.062, 0.012, -0.094)
    ],
    (t) => lerp(0.043, 0.021, smoothstep(0.0, 0.80, t)) + 0.0038 * smoothstep(0.76, 1.0, t),
    hoofGeo,
    new THREE.Vector3(0.062, 0.0, -0.090),
    new THREE.Euler(0, 0.05, 0),
    mats,
    true
  );
  root.add(legL);

  const legR = buildLegGroup(
    THREE,
    'legR',
    [
      new THREE.Vector3(-0.056, 0.152, -0.082),
      new THREE.Vector3(-0.066, 0.096, -0.096),
      new THREE.Vector3(-0.064, 0.048, -0.090),
      new THREE.Vector3(-0.062, 0.012, -0.080)
    ],
    (t) => lerp(0.043, 0.021, smoothstep(0.0, 0.80, t)) + 0.0038 * smoothstep(0.76, 1.0, t),
    hoofGeo,
    new THREE.Vector3(-0.062, 0.0, -0.076),
    new THREE.Euler(0, -0.06, 0),
    mats,
    true
  );
  root.add(legR);

  // --- 4. TUFTED TAIL (tapered curled tube + sculpted curved extruded fur tuft) ---
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(0, 0.168, -0.148);

  const tailPts = [
    new THREE.Vector3(0, 0, 0.016),
    new THREE.Vector3(0.004, -0.006, -0.024),
    new THREE.Vector3(0.016, -0.002, -0.052),
    new THREE.Vector3(0.028, 0.016, -0.066),
    new THREE.Vector3(0.032, 0.036, -0.060)
  ];
  const tailCurve = new THREE.CatmullRomCurve3(tailPts);
  const tailGeo = createTaperedTube(
    THREE,
    tailCurve,
    24,
    14,
    (t) => lerp(0.017, 0.0075, smoothstep(0.0, 0.9, t)),
    true,
    true
  );
  const tailMesh = new THREE.Mesh(tailGeo, mats.limbFur);
  tailMesh.userData.slot = 'fur';
  tailMesh.castShadow = true;
  tail.add(tailMesh);

  // Lush tufted tail tip assembled from curved beveled extruded fur locks + plush core
  const tuftGroup = new THREE.Group();
  const tailEnd = tailCurve.getPointAt(1.0);
  const tailTan = tailCurve.getTangentAt(1.0).normalize();
  tuftGroup.position.copy(tailEnd);
  tuftGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tailTan);

  const tuftCoreGeo = new THREE.SphereGeometry(0.014, 18, 14);
  tuftCoreGeo.scale(0.92, 1.38, 0.92);
  const tuftCore = new THREE.Mesh(tuftCoreGeo, mats.tuftAccent);
  tuftCore.position.y = 0.015;
  tuftCore.userData.slot = 'furAccent';
  tuftCore.castShadow = true;
  tuftGroup.add(tuftCore);

  const lockGeo = buildTailTuftLockGeometry(THREE);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const lock = new THREE.Mesh(lockGeo, mats.tuftAccent);
    lock.position.set(Math.cos(a) * 0.005, 0.002, Math.sin(a) * 0.005);
    lock.rotation.order = 'YXZ';
    lock.rotation.y = -a + Math.PI * 0.5;
    lock.rotation.x = 0.24 + (i % 2) * 0.12;
    const s = 0.88 + (i % 2) * 0.18;
    lock.scale.set(s, s, s);
    lock.userData.slot = 'furAccent';
    lock.castShadow = true;
    tuftGroup.add(lock);
  }
  tail.add(tuftGroup);
  root.add(tail);

  // --- 5. FLOATING GLOWING DREAM-BUBBLES ---
  const bubbles = new THREE.Group();
  bubbles.name = 'bubbles';

  const bubbleGeo = buildDreamBubbleGeometry(THREE);
  const crescentGeo = buildDreamCrescentGeometry(THREE);
  const starGeo = buildDreamStarGeometry(THREE);
  const pearlGeo = new THREE.SphereGeometry(0.0048, 12, 10);

  const bubbleSpecs = [
    { pos: [0.042, 0.312, 0.132], r: 0.012, kind: 'pearl', speed: 1.55, amp: 0.009, phase: 0.2 },
    { pos: [-0.048, 0.365, 0.075], r: 0.024, kind: 'crescent', speed: 1.18, amp: 0.013, phase: 1.4 },
    { pos: [0.056, 0.348, -0.018], r: 0.017, kind: 'pearl', speed: 1.38, amp: 0.011, phase: 2.6 },
    { pos: [0.014, 0.422, 0.020], r: 0.027, kind: 'star', speed: 1.05, amp: 0.015, phase: 3.7 },
    { pos: [-0.056, 0.304, -0.074], r: 0.013, kind: 'pearl', speed: 1.65, amp: 0.009, phase: 4.9 },
    { pos: [0.068, 0.402, -0.062], r: 0.010, kind: 'mote', speed: 1.85, amp: 0.008, phase: 5.5 }
  ];

  for (let i = 0; i < bubbleSpecs.length; i++) {
    const sp = bubbleSpecs[i];
    const bGroup = new THREE.Group();
    bGroup.position.set(sp.pos[0], sp.pos[1], sp.pos[2]);
    bGroup.userData.bubble = {
      basePos: sp.pos,
      speed: sp.speed,
      amp: sp.amp,
      phase: sp.phase
    };

    const shell = new THREE.Mesh(bubbleGeo, mats.bubbleShell);
    shell.scale.setScalar(sp.r);
    shell.userData.slot = 'glow';
    bGroup.add(shell);

    let coreGeo = pearlGeo;
    let coreScale = sp.r / 0.018;
    if (sp.kind === 'crescent') {
      coreGeo = crescentGeo;
      coreScale = 1.05;
    } else if (sp.kind === 'star') {
      coreGeo = starGeo;
      coreScale = 1.08;
    } else if (sp.kind === 'mote') {
      coreGeo = pearlGeo;
      coreScale = 0.62;
    }

    const coreMat = mats.bubbleCore.clone();
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.scale.setScalar(coreScale);
    core.userData.slot = 'glow';
    bGroup.add(core);
    bGroup.userData.core = core;

    bubbles.add(bGroup);
  }
  root.add(bubbles);

  // Store rest transforms for drift-free idle animation
  storeRest(body);
  storeRest(head);
  storeRest(tail);
  storeRest(armL);
  storeRest(armR);
  storeRest(legL);
  storeRest(legR);

  return root;
}

export function idle(group, t) {
  if (!group) return;

  const breath = Math.sin(t * 2.05);
  const body = group.getObjectByName('body');
  if (body && body.userData.rest) {
    const r = body.userData.rest;
    body.scale.set(
      r.scale[0] * (1 + breath * 0.014),
      r.scale[1] * (1 + breath * 0.018),
      r.scale[2] * (1 + breath * 0.008)
    );
    body.position.y = r.pos[1] + breath * 0.0022;
  }

  const head = group.getObjectByName('head');
  if (head && head.userData.rest) {
    const r = head.userData.rest;
    head.position.y = r.pos[1] + breath * 0.0028;
    head.rotation.set(
      r.rot[0] + Math.sin(t * 1.12) * 0.042 + breath * 0.012,
      r.rot[1] + Math.sin(t * 0.68 + 0.6) * 0.078,
      r.rot[2] + Math.cos(t * 0.85) * 0.038
    );
  }

  // Gentle ear sway with occasional quick cute twitch
  const twitchL = Math.pow(Math.max(0, Math.sin(t * 1.35)), 28) * 0.14;
  const twitchR = Math.pow(Math.max(0, Math.sin(t * 1.12 + 2.1)), 28) * 0.12;
  const earL = group.getObjectByName('earL');
  if (earL && earL.userData.rest) {
    const r = earL.userData.rest;
    earL.rotation.set(
      r.rot[0] + Math.sin(t * 1.5) * 0.035,
      r.rot[1] + Math.cos(t * 1.1) * 0.03,
      r.rot[2] - twitchL + Math.sin(t * 1.9) * 0.025
    );
  }
  const earR = group.getObjectByName('earR');
  if (earR && earR.userData.rest) {
    const r = earR.userData.rest;
    earR.rotation.set(
      r.rot[0] + Math.sin(t * 1.5 + 0.8) * 0.035,
      r.rot[1] - Math.cos(t * 1.1 + 0.5) * 0.03,
      r.rot[2] + twitchR - Math.sin(t * 1.9 + 0.7) * 0.025
    );
  }

  // Soft curled tail wag
  const tail = group.getObjectByName('tail');
  if (tail && tail.userData.rest) {
    const r = tail.userData.rest;
    tail.position.y = r.pos[1] + breath * 0.0020;
    tail.rotation.set(
      r.rot[0] + Math.sin(t * 1.7) * 0.045,
      r.rot[1] + Math.sin(t * 2.35) * 0.11,
      r.rot[2] + Math.cos(t * 2.35) * 0.055
    );
  }

  // Subtle curiosity bob on the lifted front-right paw
  const armR = group.getObjectByName('armR');
  if (armR && armR.userData.rest) {
    const r = armR.userData.rest;
    armR.rotation.x = r.rot[0] + Math.sin(t * 1.65) * 0.055;
    armR.rotation.z = r.rot[2] + Math.cos(t * 1.2) * 0.025;
  }

  // Blink every ~3.8 seconds (with occasional soft double-blink)
  const cycle = 3.8;
  const phase = ((t % cycle) + cycle) % cycle;
  const cycleIdx = Math.floor(t / cycle);
  let blinkAmt = 0;
  if (phase < 0.18) {
    blinkAmt = Math.sin((phase / 0.18) * Math.PI);
  } else if (cycleIdx % 3 === 2 && phase > 0.25 && phase < 0.41) {
    blinkAmt = Math.sin(((phase - 0.25) / 0.16) * Math.PI);
  }
  const eyeScaleY = 1 - 0.93 * blinkAmt;

  for (const eyeName of ['eyeL', 'eyeR']) {
    const eye = group.getObjectByName(eyeName);
    if (eye && eye.userData.rest) {
      eye.scale.y = eye.userData.rest.scale[1] * eyeScaleY;
    }
  }

  // Dream-bubbles float, drift gently, spin inner charms, and pulse glow
  const bubbles = group.getObjectByName('bubbles');
  if (bubbles) {
    for (let i = 0; i < bubbles.children.length; i++) {
      const b = bubbles.children[i];
      const info = b.userData.bubble;
      if (!info) continue;
      const w = t * info.speed + info.phase;
      b.position.set(
        info.basePos[0] + Math.sin(w * 0.72) * 0.007,
        info.basePos[1] + Math.sin(w) * info.amp,
        info.basePos[2] + Math.cos(w * 0.64) * 0.007
      );
      const core = b.userData.core;
      if (core) {
        core.rotation.y = t * 0.9 + info.phase;
        core.rotation.z = Math.sin(w * 0.8) * 0.28;
        if (core.material && typeof core.material.emissiveIntensity === 'number') {
          core.material.emissiveIntensity = 1.45 + 0.35 * Math.sin(w * 1.3);
        }
      }
    }
  }
}
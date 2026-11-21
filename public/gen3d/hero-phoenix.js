export const META = {
  id: 'young-phoenix',
  name: 'Young Phoenix',
  kind: 'creature',
  footprint: [0.28, 0.36],
  variants: ['Fire', 'Dawn Pink', 'Blue Flame'],
  note: 'Stylised perched young phoenix (~0.4 m tall) with sculpted plumage, layered curved wings, crown crest, and five long glowing ribbon tail plumes on a turned wooden desk perch.'
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function resolvePalette(THREE, opts) {
  const variant = (opts && typeof opts.variant === 'number') ? (opts.variant | 0) : 0;
  const presets = [
    {
      fur: '#d8451c',
      furAccent: '#ff9d1c',
      eye: '#ffbc2e',
      glow: '#ffe066',
      belly: '#ffdfb0',
      beak: '#e59a3a',
      wood: '#6d452e',
      trim: '#d9a452',
      blush: '#ff6f59'
    },
    {
      fur: '#df5678',
      furAccent: '#ffb0c4',
      eye: '#6ce2d6',
      glow: '#ffd4a3',
      belly: '#ffe8ec',
      beak: '#efb484',
      wood: '#896045',
      trim: '#e5b89a',
      blush: '#ff7d9b'
    },
    {
      fur: '#1e5da8',
      furAccent: '#48c8f7',
      eye: '#ffd15c',
      glow: '#9bf6ff',
      belly: '#d6f0ff',
      beak: '#e2a854',
      wood: '#5b4338',
      trim: '#c9a875',
      blush: '#6fa8ff'
    }
  ];
  const base = presets[clamp(variant, 0, presets.length - 1)];

  const fur = new THREE.Color(opts && opts.fur ? opts.fur : base.fur);
  const furAccent = new THREE.Color(opts && opts.furAccent ? opts.furAccent : base.furAccent);
  const eye = new THREE.Color(opts && opts.eye ? opts.eye : base.eye);
  const glow = new THREE.Color(opts && opts.glow ? opts.glow : base.glow);
  const belly = new THREE.Color(base.belly).lerp(furAccent, 0.22);
  const furDark = fur.clone().multiplyScalar(0.62);
  const furSheen = fur.clone().lerp(new THREE.Color('#fff5e6'), 0.48);
  const accentSheen = furAccent.clone().lerp(new THREE.Color('#ffffff'), 0.45);
  const beak = new THREE.Color(base.beak);
  const wood = new THREE.Color(base.wood);
  const trim = new THREE.Color(base.trim);
  const blush = new THREE.Color(base.blush);

  return {
    variant,
    fur,
    furDark,
    furAccent,
    furSheen,
    accentSheen,
    belly,
    eye,
    glow,
    beak,
    wood,
    trim,
    blush
  };
}

function colorCSS(c, alpha) {
  const r = Math.round(clamp(c.r, 0, 1) * 255);
  const g = Math.round(clamp(c.g, 0, 1) * 255);
  const b = Math.round(clamp(c.b, 0, 1) * 255);
  if (alpha !== undefined) {
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return `rgb(${r},${g},${b})`;
}

// Parallel-transport tapered tube helper along a CatmullRomCurve3
function buildTaperedTube(THREE, curve, radiusFn, tubularSegs, radialSegs, closedCaps) {
  const pts = [];
  const tangents = [];
  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    pts.push(curve.getPoint(u));
    tangents.push(curve.getTangent(u).normalize());
  }

  const normals = [];
  const binormals = [];
  const t0 = tangents[0];
  const ref = Math.abs(t0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const b0 = new THREE.Vector3().crossVectors(t0, ref).normalize();
  const n0 = new THREE.Vector3().crossVectors(b0, t0).normalize();
  normals.push(n0);
  binormals.push(b0);

  const axis = new THREE.Vector3();
  for (let i = 1; i <= tubularSegs; i++) {
    const prevT = tangents[i - 1];
    const currT = tangents[i];
    const n = normals[i - 1].clone();
    axis.crossVectors(prevT, currT);
    const sinA = axis.length();
    if (sinA > 1e-6) {
      axis.divideScalar(sinA);
      const angle = Math.acos(clamp(prevT.dot(currT), -1, 1));
      n.applyAxisAngle(axis, angle);
    }
    n.addScaledVector(currT, -n.dot(currT)).normalize();
    const b = new THREE.Vector3().crossVectors(currT, n).normalize();
    normals.push(n);
    binormals.push(b);
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const stride = radialSegs + 1;

  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    const r = Math.max(0.0002, radiusFn(u));
    const p = pts[i];
    const n = normals[i];
    const b = binormals[i];
    for (let j = 0; j <= radialSegs; j++) {
      const v = j / radialSegs;
      const th = v * Math.PI * 2;
      const ct = Math.cos(th);
      const st = Math.sin(th);
      positions.push(
        p.x + (n.x * ct + b.x * st) * r,
        p.y + (n.y * ct + b.y * st) * r,
        p.z + (n.z * ct + b.z * st) * r
      );
      uvs.push(v, u);
    }
  }

  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const b = i * stride + j + 1;
      const c = (i + 1) * stride + j + 1;
      const d = (i + 1) * stride + j;
      indices.push(a, b, d, b, c, d);
    }
  }

  if (closedCaps) {
    const startCenterIdx = positions.length / 3;
    const pStart = pts[0];
    positions.push(pStart.x, pStart.y, pStart.z);
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(startCenterIdx, j + 1, j);
    }

    const endCenterIdx = positions.length / 3;
    const pEnd = pts[tubularSegs];
    positions.push(pEnd.x, pEnd.y, pEnd.z);
    uvs.push(0.5, 1);
    const base = tubularSegs * stride;
    for (let j = 0; j < radialSegs; j++) {
      indices.push(endCenterIdx, base + j, base + j + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Custom curved tapered feather-ribbon swept along a 3D CatmullRomCurve3
function buildRibbonPlumeGeometry(THREE, curve, widthFn, thicknessFn, rollFn, segsL, segsW) {
  const pts = [];
  const tangents = [];
  for (let i = 0; i <= segsL; i++) {
    const u = i / segsL;
    pts.push(curve.getPoint(u));
    tangents.push(curve.getTangent(u).normalize());
  }

  const normals = [];
  const binormals = [];
  const t0 = tangents[0];
  const ref = Math.abs(t0.y) < 0.92 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  const b0 = new THREE.Vector3().crossVectors(t0, ref).normalize();
  const n0 = new THREE.Vector3().crossVectors(b0, t0).normalize();
  normals.push(n0);
  binormals.push(b0);

  const axis = new THREE.Vector3();
  for (let i = 1; i <= segsL; i++) {
    const prevT = tangents[i - 1];
    const currT = tangents[i];
    const n = normals[i - 1].clone();
    axis.crossVectors(prevT, currT);
    const sinA = axis.length();
    if (sinA > 1e-6) {
      axis.divideScalar(sinA);
      const angle = Math.acos(clamp(prevT.dot(currT), -1, 1));
      n.applyAxisAngle(axis, angle);
    }
    n.addScaledVector(currT, -n.dot(currT)).normalize();
    const b = new THREE.Vector3().crossVectors(currT, n).normalize();
    normals.push(n);
    binormals.push(b);
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const stride = segsW + 1;

  for (let i = 0; i <= segsL; i++) {
    const u = i / segsL;
    const halfW = Math.max(0.0003, widthFn(u) * 0.5);
    const halfT = Math.max(0.00025, thicknessFn(u) * 0.5);
    const roll = rollFn ? rollFn(u) : 0;
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);

    const p = pts[i];
    const nRaw = normals[i];
    const bRaw = binormals[i];
    // Rotate (B, N) around T by roll
    const bx = bRaw.x * cr + nRaw.x * sr;
    const by = bRaw.y * cr + nRaw.y * sr;
    const bz = bRaw.z * cr + nRaw.z * sr;
    const nx = -bRaw.x * sr + nRaw.x * cr;
    const ny = -bRaw.y * sr + nRaw.y * cr;
    const nz = -bRaw.z * sr + nRaw.z * cr;

    const cup = halfW * 0.16 * (1 - 0.5 * u);
    const ridge = halfT * 0.55 * (1 - 0.7 * u);

    for (let j = 0; j <= segsW; j++) {
      const th = (j / segsW) * Math.PI * 2;
      const ct = Math.cos(th);
      const st = Math.sin(th);
      const localB = ct * halfW;
      const localN = st * halfT - cup * (ct * ct) + Math.sign(st) * ridge * Math.pow(Math.abs(st), 3);
      positions.push(
        p.x + bx * localB + nx * localN,
        p.y + by * localB + ny * localN,
        p.z + bz * localB + nz * localN
      );
      uvs.push(0.5 + 0.5 * ct, u);
    }
  }

  for (let i = 0; i < segsL; i++) {
    for (let j = 0; j < segsW; j++) {
      const a = i * stride + j;
      const b = i * stride + j + 1;
      const c = (i + 1) * stride + j + 1;
      const d = (i + 1) * stride + j;
      indices.push(a, d, b, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Extruded curved feather built from THREE.Shape + bezierCurveTo with bevel and 3D bend
function buildBentExtrudedFeather(THREE, cfg) {
  const len = cfg.length;
  const w = cfg.width;
  const asym = cfg.asym || 0;
  const tipFlare = cfg.tipFlare || 0;
  const thickness = cfg.thickness || 0.0016;
  const bevel = cfg.bevel || 0.0012;

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(
    w * (0.55 + asym), len * 0.18,
    w * (0.62 + asym + tipFlare * 0.35), len * 0.62,
    w * (0.24 + tipFlare * 0.45), len * 0.88
  );
  shape.bezierCurveTo(
    w * (0.12 + tipFlare * 0.2), len * 0.96,
    w * 0.04, len * 1.0,
    0, len
  );
  shape.bezierCurveTo(
    -w * 0.04, len * 1.0,
    -w * (0.12 + tipFlare * 0.2), len * 0.96,
    -w * (0.24 + tipFlare * 0.45), len * 0.88
  );
  shape.bezierCurveTo(
    -w * (0.62 - asym + tipFlare * 0.35), len * 0.62,
    -w * (0.55 - asym), len * 0.18,
    0, 0
  );

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelSegments: 2,
    curveSegments: cfg.curveSegments || 16
  });

  geo.translate(0, 0, -thickness * 0.5);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const spanX = Math.max(1e-5, bb.max.x - bb.min.x);
  const spanY = Math.max(1e-5, bb.max.y - bb.min.y);

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const arch = cfg.arch || 0;
  const sCurve = cfg.sCurve || 0;
  const sideCurve = cfg.sideCurve || 0;
  const twist = cfg.twist || 0;
  const cup = cfg.cup || 0;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const u = clamp((x - bb.min.x) / spanX, 0, 1);
    const v = clamp((y - bb.min.y) / spanY, 0, 1);
    uv.setXY(i, u, v);

    // Subtle taper of thickness toward the tip
    z *= (1 - 0.55 * v * v);

    // Crosswise cupping
    const nx = (u - 0.5) * 2;
    z += cup * (1 - nx * nx) * Math.sin(v * Math.PI);

    // Twist around Y axis
    if (twist !== 0) {
      const ang = twist * v * v;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const rx = x * ca - z * sa;
      const rz = x * sa + z * ca;
      x = rx;
      z = rz;
    }

    // Longitudinal bend & S-wave
    const zBend = arch * v * v + sCurve * Math.sin(v * Math.PI * 1.45) * v;
    const xBend = sideCurve * v * v;
    const yShorten = 1 - Math.abs(arch) * 0.14 * v;
    pos.setXYZ(i, x + xBend, y * yShorten, z + zBend);
  }

  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Curved circular disc with planar circular UVs (for iris and cheek blush)
function buildDomeDisc(THREE, radius, domeDepth, radialSegs, ringSegs) {
  const positions = [];
  const uvs = [];
  const indices = [];

  positions.push(0, 0, domeDepth);
  uvs.push(0.5, 0.5);

  for (let r = 1; r <= ringSegs; r++) {
    const rn = r / ringSegs;
    const rad = radius * rn;
    const z = domeDepth * (1 - rn * rn);
    for (let s = 0; s < radialSegs; s++) {
      const a = (s / radialSegs) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      positions.push(rad * ca, rad * sa, z);
      uvs.push(0.5 + 0.5 * rn * ca, 0.5 + 0.5 * rn * sa);
    }
  }

  for (let s = 0; s < radialSegs; s++) {
    const next = (s + 1) % radialSegs;
    indices.push(0, 1 + s, 1 + next);
  }
  for (let r = 1; r < ringSegs; r++) {
    const rowA = 1 + (r - 1) * radialSegs;
    const rowB = 1 + r * radialSegs;
    for (let s = 0; s < radialSegs; s++) {
      const next = (s + 1) % radialSegs;
      indices.push(rowA + s, rowB + s, rowB + next);
      indices.push(rowA + s, rowB + next, rowA + next);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Sculpted continuous body geometry from dense SphereGeometry
function buildSculptedBodyGeometry(THREE, kit) {
  const geo = new THREE.SphereGeometry(1, 56, 40);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);

    let x = ux * 0.065;
    let y = uy * 0.070;
    let z = uz * 0.076;

    // Plump proud breast bulge at front-mid
    const front = Math.max(0, uz);
    const chestBand = Math.exp(-Math.pow((uy - 0.04) / 0.58, 2));
    const chestBulge = front * chestBand;
    z += 0.022 * chestBulge;
    x *= (1 + 0.09 * chestBulge);

    // Subtle soft keel down the center of the chest
    const keel = Math.exp(-ux * ux * 9) * front * chestBand;
    z += 0.004 * keel;

    // Tapered rump sweeping gently down-and-back toward tail root
    const back = Math.max(0, -uz);
    const backPow = Math.pow(back, 1.35);
    y -= 0.030 * backPow;
    z -= 0.014 * backPow;
    x *= (1 - 0.34 * Math.pow(back, 1.45));

    // Gently flatten upper back slope
    if (uy > 0 && uz < 0) {
      y -= 0.008 * uy * back;
    }

    // Settled, gently flattened lower belly resting over the perch
    if (y < -0.050) {
      y = -0.050 + (y + 0.050) * 0.48;
    }

    // Pinched neck-shoulder transition at top-front
    if (uy > 0.35) {
      const nt = (uy - 0.35) / 0.65;
      const nt2 = nt * nt;
      x *= (1 - 0.24 * nt2);
      z *= (1 - 0.20 * nt2);
      z += 0.017 * nt;
    }

    // Soft flank pocket where wings nestle snugly
    const flank = smoothstep(0.55, 0.92, Math.abs(ux)) * Math.exp(-Math.pow((uy - 0.10) / 0.45, 2));
    x *= (1 - 0.055 * flank);

    // Micro down-feather softness
    const n = (kit.noise(ux * 6.5 + 3.1, uy * 6.5 + uz * 4.2) - 0.5) * 0.0018;
    x += ux * n;
    y += uy * n;
    z += uz * n;

    pos.setXYZ(i, x, y, z);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Sculpted continuous head + neck-skirt geometry from dense SphereGeometry
function buildSculptedHeadGeometry(THREE, kit) {
  const geo = new THREE.SphereGeometry(1, 52, 38);
  const pos = geo.attributes.position;

  const eyeDirL = new THREE.Vector3(0.52, 0.04, 0.853).normalize();
  const eyeDirR = new THREE.Vector3(-0.52, 0.04, 0.853).normalize();
  const vDir = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);

    let x = ux * 0.058;
    let y = uy * 0.054;
    let z = uz * 0.057;

    // Puffy chibi cheeks
    const cheekSide = smoothstep(0.32, 0.85, Math.abs(ux));
    const cheekVert = Math.exp(-Math.pow((uy + 0.20) / 0.34, 2));
    const cheekFront = smoothstep(-0.25, 0.55, uz);
    const cheek = cheekSide * cheekVert * cheekFront;
    x += Math.sign(ux) * 0.0105 * cheek;
    z += 0.0045 * cheek;
    y -= 0.0025 * cheek;

    // Gentle forehead & crown lift
    if (uy > 0.25) {
      const ct = (uy - 0.25) / 0.75;
      y += 0.0055 * ct * ct;
      z -= 0.004 * ct * Math.max(0, -uz);
    }

    // Soft beak-bridge / lore protrusion at front center
    const lore = Math.exp(-ux * ux * 16) * Math.exp(-Math.pow((uy + 0.12) / 0.24, 2)) * Math.max(0, uz);
    z += 0.0065 * lore;

    // Sculpted orbital eye sockets so the 3-layer eyes sit inset, never floating
    vDir.set(ux, uy, uz).normalize();
    const dL = vDir.dot(eyeDirL);
    const dR = vDir.dot(eyeDirR);
    const sockL = smoothstep(0.895, 0.985, dL);
    const sockR = smoothstep(0.895, 0.985, dR);
    const sock = Math.max(sockL, sockR);
    if (sock > 0) {
      const indent = 0.0068 * sock;
      x -= ux * indent;
      y -= uy * indent;
      z -= uz * indent;
    }

    // Subtle soft brow arch above eyes
    const brow = Math.exp(-Math.pow((uy - 0.27) / 0.14, 2)) *
      smoothstep(0.25, 0.75, Math.abs(ux)) *
      smoothstep(0.35, 0.85, uz);
    z += 0.0024 * brow;
    y += 0.0014 * brow;

    // Continuous tapered neck skirt plunging deeply into the body/ruff
    if (uy < -0.42) {
      const nt = (-uy - 0.42) / 0.58;
      const ntPow = Math.pow(nt, 1.3);
      y -= 0.044 * ntPow;
      z -= 0.011 * ntPow;
      x *= (1 - 0.18 * nt);
      z *= (1 - 0.14 * nt);
    }

    // Subtle feathered down micro-texture
    const n = (kit.noise(ux * 7.2 + 1.4, uy * 7.2 + uz * 5.1) - 0.5) * 0.0012;
    x += ux * n;
    y += uy * n;
    z += uz * n;

    // Offset skull center above head-pivot (neck base)
    pos.setXYZ(i, x, y + 0.052, z + 0.010);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Sculpted upper & lower beak halves from dense spheres
function buildBeakGeometries(THREE) {
  // Upper beak: cute slightly hooked baby-raptor / phoenix curve
  const upper = new THREE.SphereGeometry(1, 28, 20);
  const upPos = upper.attributes.position;
  for (let i = 0; i < upPos.count; i++) {
    const ux = upPos.getX(i);
    const uy = upPos.getY(i);
    const uz = upPos.getZ(i);

    const t = clamp((uz + 1) * 0.5, 0, 1); // 0 at base inside face, 1 at tip
    const widthProfile = Math.pow(1 - t, 0.78) * 0.0128;
    const heightProfile = Math.pow(1 - t, 0.85) * 0.0108;

    let x = ux * widthProfile;
    let y = uy * heightProfile;
    let z = t * 0.036;

    // Flatten the underside slightly so it forms a crisp upper tomium
    if (uy < 0) {
      y *= 0.42;
    } else {
      // Soft culmen ridge on top
      y += 0.0022 * Math.exp(-ux * ux * 6) * Math.sin(t * Math.PI);
    }

    // Graceful downward hook toward the tip
    y -= 0.0105 * Math.pow(t, 2.15);

    upPos.setXYZ(i, x, y, z);
  }
  upPos.needsUpdate = true;
  upper.computeVertexNormals();

  // Lower mandible tucked neatly underneath
  const lower = new THREE.SphereGeometry(1, 20, 14);
  const loPos = lower.attributes.position;
  for (let i = 0; i < loPos.count; i++) {
    const ux = loPos.getX(i);
    const uy = loPos.getY(i);
    const uz = loPos.getZ(i);

    const t = clamp((uz + 1) * 0.5, 0, 1);
    const widthProfile = Math.pow(1 - t, 0.82) * 0.0094;
    const heightProfile = Math.pow(1 - t, 0.9) * 0.0052;

    let x = ux * widthProfile;
    let y = uy * heightProfile;
    const z = t * 0.022;

    if (uy > 0) y *= 0.35;
    y -= 0.0028 * t * t;

    loPos.setXYZ(i, x, y - 0.0042, z + 0.001);
  }
  loPos.needsUpdate = true;
  lower.computeVertexNormals();

  return { upper, lower };
}

// Sculpted shoulder pad or thigh puff
function buildSoftPuffGeometry(THREE, rx, ry, rz) {
  const geo = new THREE.SphereGeometry(1, 22, 16);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);
    const taper = 1 - 0.28 * Math.max(0, -uy);
    pos.setXYZ(i, ux * rx * taper, uy * ry, uz * rz * taper);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Procedural CanvasTextures using kit.canvasTexture and kit.noise
function makeBodyTextures(THREE, kit, pal) {
  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    // Base vertical plumage gradient
    const baseGrad = ctx.createLinearGradient(0, 0, 0, h);
    baseGrad.addColorStop(0.0, colorCSS(pal.fur));
    baseGrad.addColorStop(0.45, colorCSS(pal.fur));
    baseGrad.addColorStop(0.85, colorCSS(pal.furDark));
    baseGrad.addColorStop(1.0, colorCSS(pal.furDark));
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, w, h);

    // Richer darker back & shoulders around u = 0.75
    const backX = w * 0.75;
    const backGrad = ctx.createRadialGradient(backX, h * 0.42, w * 0.04, backX, h * 0.45, w * 0.34);
    backGrad.addColorStop(0, colorCSS(pal.furDark, 0.72));
    backGrad.addColorStop(0.65, colorCSS(pal.furDark, 0.30));
    backGrad.addColorStop(1, colorCSS(pal.furDark, 0.0));
    ctx.fillStyle = backGrad;
    ctx.fillRect(0, 0, w, h);

    // Soft lighter creamy-gold chest & belly around u = 0.25 (front +z)
    const bellyX = w * 0.25;
    const bellyGrad = ctx.createRadialGradient(bellyX, h * 0.56, w * 0.03, bellyX, h * 0.58, w * 0.24);
    bellyGrad.addColorStop(0.0, colorCSS(pal.belly, 0.96));
    bellyGrad.addColorStop(0.55, colorCSS(pal.furAccent, 0.62));
    bellyGrad.addColorStop(1.0, colorCSS(pal.fur, 0.0));
    ctx.fillStyle = bellyGrad;
    ctx.fillRect(0, 0, w, h);

    // Warm golden highlight near upper chest / neck ruff
    const neckGrad = ctx.createRadialGradient(bellyX, h * 0.26, w * 0.02, bellyX, h * 0.28, w * 0.18);
    neckGrad.addColorStop(0, colorCSS(pal.furAccent, 0.65));
    neckGrad.addColorStop(1, colorCSS(pal.furAccent, 0.0));
    ctx.fillStyle = neckGrad;
    ctx.fillRect(0, 0, w, h);

    // Layered scalloped downy feather flecks
    const rows = 26;
    const cols = 34;
    for (let r = 2; r < rows - 1; r++) {
      const cy = (r / rows) * h;
      const offset = (r % 2) * 0.5;
      for (let c = 0; c < cols; c++) {
        const cx = ((c + offset) / cols) * w;
        const n = kit.noise(c * 0.7 + 2.3, r * 0.8 + 1.1);
        const distBelly = Math.abs(cx / w - 0.25);
        const isBelly = distBelly < 0.16 && cy > h * 0.34 && cy < h * 0.84;

        ctx.beginPath();
        const rad = (w / cols) * (0.58 + n * 0.26);
        ctx.arc(cx, cy, rad, 0.15 * Math.PI, 0.85 * Math.PI);
        if (isBelly) {
          ctx.strokeStyle = colorCSS(pal.furAccent, 0.22 + n * 0.18);
        } else {
          ctx.strokeStyle = n > 0.52
            ? colorCSS(pal.furAccent, 0.26)
            : colorCSS(pal.furDark, 0.28);
        }
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
    }

    // Fine vertical down strokes for tactile softness
    for (let i = 0; i < 650; i++) {
      const rx = kit.noise(i * 1.13, 3.7) * w;
      const ry = kit.noise(7.1, i * 0.91) * h;
      const len = 7 + kit.noise(i * 0.5, 9.2) * 10;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + (kit.noise(i, 2.2) - 0.5) * 4, ry + len);
      ctx.strokeStyle = i % 3 === 0 ? colorCSS(pal.belly, 0.14) : colorCSS(pal.furDark, 0.12);
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    const rows = 26;
    const cols = 34;
    for (let r = 2; r < rows - 1; r++) {
      const cy = (r / rows) * h;
      const offset = (r % 2) * 0.5;
      for (let c = 0; c < cols; c++) {
        const cx = ((c + offset) / cols) * w;
        const n = kit.noise(c * 0.7 + 2.3, r * 0.8 + 1.1);
        const rad = (w / cols) * (0.58 + n * 0.26);
        const g = ctx.createRadialGradient(cx, cy - rad * 0.2, 1, cx, cy, rad);
        g.addColorStop(0, 'rgba(210,210,210,0.45)');
        g.addColorStop(0.75, 'rgba(130,130,130,0.18)');
        g.addColorStop(1, 'rgba(65,65,65,0.45)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
  bumpMap.wrapS = THREE.RepeatWrapping;

  return { map, bumpMap };
}

function makeHeadTextures(THREE, kit, pal) {
  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, colorCSS(pal.furDark));
    grad.addColorStop(0.32, colorCSS(pal.fur));
    grad.addColorStop(0.76, colorCSS(pal.fur));
    grad.addColorStop(1.0, colorCSS(pal.furAccent));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Brighter warm cheeks & throat around front u = 0.25
    const fx = w * 0.25;
    const faceGrad = ctx.createRadialGradient(fx, h * 0.62, w * 0.03, fx, h * 0.60, w * 0.25);
    faceGrad.addColorStop(0.0, colorCSS(pal.belly, 0.76));
    faceGrad.addColorStop(0.55, colorCSS(pal.furAccent, 0.36));
    faceGrad.addColorStop(1.0, colorCSS(pal.fur, 0.0));
    ctx.fillStyle = faceGrad;
    ctx.fillRect(0, 0, w, h);

    // Soft forehead blaze leading up to the crest
    const crownGrad = ctx.createRadialGradient(fx, h * 0.26, 4, fx, h * 0.26, w * 0.10);
    crownGrad.addColorStop(0, colorCSS(pal.furAccent, 0.55));
    crownGrad.addColorStop(1, colorCSS(pal.furAccent, 0.0));
    ctx.fillStyle = crownGrad;
    ctx.fillRect(0, 0, w, h);

    // Delicate feather strokes radiating downward from crown
    for (let i = 0; i < 600; i++) {
      const rx = kit.noise(i * 0.87, 4.1) * w;
      const ry = kit.noise(6.3, i * 1.07) * h;
      const len = 6 + kit.noise(i * 0.3, 1.9) * 10;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + (kit.noise(i, 8.8) - 0.5) * 4, ry + len);
      ctx.strokeStyle = i % 2 === 0 ? colorCSS(pal.furAccent, 0.14) : colorCSS(pal.furDark, 0.13);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 480; i++) {
      const rx = kit.noise(i * 1.19, 2.3) * w;
      const ry = kit.noise(5.7, i * 0.93) * h;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx, ry + 7);
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(205,205,205,0.35)' : 'rgba(70,70,70,0.35)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  });
  bumpMap.wrapS = THREE.RepeatWrapping;

  return { map, bumpMap };
}

// Painted feather texture for wings, crest, coverts (v=0 base -> v=1 tip; canvas y=h base -> y=0 tip)
function makeFeatherTextures(THREE, kit, pal, mode) {
  const map = kit.canvasTexture(256, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    if (mode === 'covert') {
      grad.addColorStop(0.0, colorCSS(pal.furDark));
      grad.addColorStop(0.55, colorCSS(pal.fur));
      grad.addColorStop(0.90, colorCSS(pal.furAccent));
      grad.addColorStop(1.0, colorCSS(pal.belly));
    } else if (mode === 'crest') {
      grad.addColorStop(0.0, colorCSS(pal.fur));
      grad.addColorStop(0.45, colorCSS(pal.furAccent));
      grad.addColorStop(0.78, colorCSS(pal.glow));
      grad.addColorStop(1.0, '#fff9e6');
    } else {
      // Primary / secondary flight feathers
      grad.addColorStop(0.0, colorCSS(pal.furDark));
      grad.addColorStop(0.38, colorCSS(pal.fur));
      grad.addColorStop(0.74, colorCSS(pal.furAccent));
      grad.addColorStop(0.92, colorCSS(pal.glow));
      grad.addColorStop(1.0, '#fff6dd');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Fine angled feather barbs radiating from central rachis
    const midX = w * 0.5;
    for (let y = h; y >= 0; y -= 3.2) {
      const v = 1 - y / h;
      const n = kit.noise(v * 18, 2.4);
      const lift = 18 + (1 - v) * 14;
      ctx.strokeStyle = n > 0.5
        ? colorCSS(pal.furAccent, 0.22)
        : colorCSS(pal.furDark, 0.20 * (1 - v * 0.7));
      ctx.lineWidth = 1.25;

      ctx.beginPath();
      ctx.moveTo(midX, y);
      ctx.quadraticCurveTo(midX - w * 0.24, y - lift * 0.45, 0, y - lift);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(midX, y);
      ctx.quadraticCurveTo(midX + w * 0.24, y - lift * 0.45, w, y - lift);
      ctx.stroke();
    }

    // Central shaft highlight
    const shaftGrad = ctx.createLinearGradient(0, h, 0, 0);
    shaftGrad.addColorStop(0, colorCSS(pal.furAccent, 0.65));
    shaftGrad.addColorStop(0.7, colorCSS(pal.glow, 0.75));
    shaftGrad.addColorStop(1, 'rgba(255,255,255,0.45)');
    ctx.strokeStyle = shaftGrad;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(midX, h);
    ctx.lineTo(midX, 0);
    ctx.stroke();
  });
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = kit.canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    const midX = w * 0.5;
    for (let y = h; y >= 0; y -= 2.5) {
      ctx.strokeStyle = (Math.floor(y) % 2 === 0) ? 'rgba(220,220,220,0.45)' : 'rgba(60,60,60,0.45)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(midX, y);
      ctx.lineTo(0, y - 14);
      ctx.moveTo(midX, y);
      ctx.lineTo(w, y - 14);
      ctx.stroke();
    }
    ctx.strokeStyle = '#d8d8d8';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(midX, h);
    ctx.lineTo(midX, 0);
    ctx.stroke();
  });

  const emissiveMap = kit.canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    if (mode === 'covert') return;
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    if (mode === 'crest') {
      grad.addColorStop(0.0, '#000000');
      grad.addColorStop(0.56, '#000000');
      grad.addColorStop(0.82, '#aa8844');
      grad.addColorStop(1.0, '#ffffff');
    } else {
      grad.addColorStop(0.0, '#000000');
      grad.addColorStop(0.72, '#000000');
      grad.addColorStop(0.90, '#997733');
      grad.addColorStop(1.0, '#ffe8b0');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  emissiveMap.colorSpace = THREE.SRGBColorSpace;

  return { map, bumpMap, emissiveMap };
}

// Tail plume ribbon texture with luminous phoenix eye-spot & glowing tip
function makeTailPlumeTextures(THREE, kit, pal) {
  const map = kit.canvasTexture(256, 512, (ctx, w, h) => {
    // v=0 (base) at y=h -> v=1 (tip) at y=0
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0.0, colorCSS(pal.furDark));
    grad.addColorStop(0.28, colorCSS(pal.fur));
    grad.addColorStop(0.60, colorCSS(pal.furAccent));
    grad.addColorStop(0.78, colorCSS(pal.glow));
    grad.addColorStop(0.94, '#fff4cf');
    grad.addColorStop(1.0, '#ffffff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Soft feather barbs along ribbon length
    const midX = w * 0.5;
    for (let y = h; y >= 0; y -= 3.2) {
      const v = 1 - y / h;
      const n = kit.noise(v * 24, 5.1);
      ctx.strokeStyle = n > 0.5
        ? colorCSS(pal.glow, 0.18 + 0.15 * v)
        : colorCSS(pal.furDark, 0.24 * (1 - v * 0.85));
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(midX, y);
      ctx.lineTo(0, y - 18);
      ctx.moveTo(midX, y);
      ctx.lineTo(w, y - 18);
      ctx.stroke();
    }

    // Stylised phoenix eye-spot medallion near the flared tip (v ~ 0.85 -> y ~ 0.15 * h)
    const spotY = h * 0.145;
    const outerRing = ctx.createRadialGradient(midX, spotY, 6, midX, spotY, w * 0.42);
    outerRing.addColorStop(0.0, '#ffffff');
    outerRing.addColorStop(0.26, colorCSS(pal.glow, 0.98));
    outerRing.addColorStop(0.50, colorCSS(pal.fur, 0.88));
    outerRing.addColorStop(0.74, colorCSS(pal.furAccent, 0.92));
    outerRing.addColorStop(1.0, colorCSS(pal.glow, 0.0));
    ctx.fillStyle = outerRing;
    ctx.beginPath();
    ctx.ellipse(midX, spotY, w * 0.40, h * 0.075, 0, 0, Math.PI * 2);
    ctx.fill();

    // Central luminous quill
    const qGrad = ctx.createLinearGradient(0, h, 0, 0);
    qGrad.addColorStop(0, colorCSS(pal.furAccent, 0.7));
    qGrad.addColorStop(0.7, colorCSS(pal.glow, 0.9));
    qGrad.addColorStop(1, '#ffffff');
    ctx.strokeStyle = qGrad;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(midX, h);
    ctx.lineTo(midX, h * 0.14);
    ctx.stroke();
  });
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = kit.canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    const midX = w * 0.5;
    for (let y = h; y >= 0; y -= 2.5) {
      ctx.strokeStyle = (Math.floor(y) % 2 === 0) ? 'rgba(215,215,215,0.42)' : 'rgba(65,65,65,0.42)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(midX, y);
      ctx.lineTo(0, y - 12);
      ctx.moveTo(midX, y);
      ctx.lineTo(w, y - 12);
      ctx.stroke();
    }
    ctx.strokeStyle = '#e4e4e4';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(midX, h);
    ctx.lineTo(midX, 0);
    ctx.stroke();
  });

  const emissiveMap = kit.canvasTexture(128, 256, (ctx, w, h) => {
    // Black along base, ramping into bright glowing warm tip & eye-spot
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0.0, '#000000');
    grad.addColorStop(0.50, '#000000');
    grad.addColorStop(0.68, '#4a3518');
    grad.addColorStop(0.80, '#d8b060');
    grad.addColorStop(0.91, '#ffffff');
    grad.addColorStop(1.0, '#ffffff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Crisp bright center eye-spot glow with subtle contrasting ring
    const midX = w * 0.5;
    const spotY = h * 0.145;
    const spot = ctx.createRadialGradient(midX, spotY, 2, midX, spotY, w * 0.38);
    spot.addColorStop(0.0, '#ffffff');
    spot.addColorStop(0.32, '#fff2c2');
    spot.addColorStop(0.55, '#7a4a18');
    spot.addColorStop(0.80, '#ffd888');
    spot.addColorStop(1.0, 'rgba(255,220,140,0)');
    ctx.fillStyle = spot;
    ctx.beginPath();
    ctx.ellipse(midX, spotY, w * 0.38, h * 0.072, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  emissiveMap.colorSpace = THREE.SRGBColorSpace;

  return { map, bumpMap, emissiveMap };
}

function makeIrisTexture(THREE, kit, pal) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const r = w * 0.48;

    ctx.fillStyle = '#0e0708';
    ctx.fillRect(0, 0, w, h);

    // Coloured iris base gradient
    const irisGrad = ctx.createRadialGradient(cx, cy, r * 0.25, cx, cy, r);
    const brightEye = pal.eye.clone().lerp(new THREE.Color('#ffffff'), 0.42);
    const deepEye = pal.eye.clone().multiplyScalar(0.45);
    irisGrad.addColorStop(0.0, colorCSS(deepEye));
    irisGrad.addColorStop(0.48, colorCSS(pal.eye));
    irisGrad.addColorStop(0.84, colorCSS(brightEye));
    irisGrad.addColorStop(0.95, '#180c0d');
    irisGrad.addColorStop(1.0, '#0c0607');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Radial iris fibers
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      const n = kit.noise(Math.cos(a) * 4 + 2, Math.sin(a) * 4 + 2);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.42, cy + Math.sin(a) * r * 0.42);
      ctx.lineTo(cx + Math.cos(a) * r * (0.86 + n * 0.08), cy + Math.sin(a) * r * (0.86 + n * 0.08));
      ctx.strokeStyle = i % 2 === 0 ? colorCSS(brightEye, 0.35) : colorCSS(deepEye, 0.35);
      ctx.lineWidth = 2.0;
      ctx.stroke();
    }

    // Warm glowing lower crescent reflection (signature stylised charm)
    const cresc = ctx.createRadialGradient(cx, cy + r * 0.48, 2, cx, cy + r * 0.42, r * 0.46);
    cresc.addColorStop(0.0, 'rgba(255,250,220,0.85)');
    cresc.addColorStop(0.55, colorCSS(brightEye, 0.42));
    cresc.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = cresc;
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.36, r * 0.44, 0, Math.PI * 2);
    ctx.fill();

    // Soft upper eyelid shadow cast onto top of iris
    const topShade = ctx.createLinearGradient(0, cy - r, 0, cy + r * 0.15);
    topShade.addColorStop(0, 'rgba(10,4,6,0.72)');
    topShade.addColorStop(0.45, 'rgba(10,4,6,0.28)');
    topShade.addColorStop(1, 'rgba(10,4,6,0)');
    ctx.fillStyle = topShade;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Large cute glossy dark pupil
    const pupilGrad = ctx.createRadialGradient(cx, cy - r * 0.04, r * 0.12, cx, cy, r * 0.48);
    pupilGrad.addColorStop(0, '#070406');
    pupilGrad.addColorStop(0.84, '#0c0608');
    pupilGrad.addColorStop(1.0, 'rgba(12,6,8,0)');
    ctx.fillStyle = pupilGrad;
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.02, r * 0.48, 0, Math.PI * 2);
    ctx.fill();
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBlushTexture(THREE, kit, pal) {
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 2, w * 0.5, h * 0.5, w * 0.48);
    g.addColorStop(0.0, colorCSS(pal.blush, 0.52));
    g.addColorStop(0.55, colorCSS(pal.blush, 0.24));
    g.addColorStop(1.0, colorCSS(pal.blush, 0.0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBeakTexture(THREE, kit, pal) {
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    const baseC = pal.beak.clone().lerp(new THREE.Color('#fff1d4'), 0.28);
    const tipC = pal.beak.clone().multiplyScalar(0.74);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0.0, colorCSS(baseC));
    g.addColorStop(0.55, colorCSS(pal.beak));
    g.addColorStop(1.0, colorCSS(tipC));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeWoodTextures(THREE, kit, pal) {
  const lightW = pal.wood.clone().lerp(new THREE.Color('#d2a77b'), 0.35);
  const darkW = pal.wood.clone().multiplyScalar(0.58);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = colorCSS(pal.wood);
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 6) {
        const n1 = kit.noise(x * 0.015, y * 0.09);
        const grain = Math.sin((y * 0.08 + n1 * 7.5) * Math.PI);
        const t = grain * 0.5 + 0.5;
        ctx.fillStyle = t > 0.52 ? colorCSS(lightW, 0.22 * t) : colorCSS(darkW, 0.28 * (1 - t));
        ctx.fillRect(x, y, 6, 2);
      }
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      const n = kit.noise(2.2, y * 0.14);
      const val = Math.round(95 + n * 70);
      ctx.fillStyle = `rgb(${val},${val},${val})`;
      ctx.fillRect(0, y, w, 2);
    }
  });
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

// Analytic perch branch curve so legs/toes grip with exact contact
function perchBranchPos(x) {
  const u = x / 0.075;
  const y = 0.062 + 0.004 * Math.cos(u * Math.PI * 0.5) - 0.0018 * u;
  const z = 0.004 + 0.0048 * Math.sin(u * Math.PI * 0.65);
  const r = 0.0108 - 0.0013 * u;
  return { x, y, z, r };
}

// Build cozy turned wooden dorm-room perch (LatheGeometry >= 16 pts + organic branch)
function buildPerch(THREE, mats) {
  const perchGroup = new THREE.Group();
  perchGroup.name = 'perch';

  // Turned wooden stand base (24 profile points, y=0 on floor)
  const profile = [
    new THREE.Vector2(0.000, 0.000),
    new THREE.Vector2(0.078, 0.000),
    new THREE.Vector2(0.084, 0.002),
    new THREE.Vector2(0.085, 0.006),
    new THREE.Vector2(0.081, 0.010),
    new THREE.Vector2(0.074, 0.013),
    new THREE.Vector2(0.067, 0.016),
    new THREE.Vector2(0.062, 0.020),
    new THREE.Vector2(0.060, 0.024),
    new THREE.Vector2(0.063, 0.027),
    new THREE.Vector2(0.070, 0.030),
    new THREE.Vector2(0.074, 0.033),
    new THREE.Vector2(0.073, 0.036),
    new THREE.Vector2(0.068, 0.038),
    new THREE.Vector2(0.060, 0.037),
    new THREE.Vector2(0.050, 0.034),
    new THREE.Vector2(0.038, 0.032),
    new THREE.Vector2(0.024, 0.031),
    new THREE.Vector2(0.012, 0.031),
    new THREE.Vector2(0.000, 0.0315)
  ];
  const baseGeo = new THREE.LatheGeometry(profile, 44);
  const baseMesh = new THREE.Mesh(baseGeo, mats.wood);
  baseMesh.userData.slot = 'primary';
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  perchGroup.add(baseMesh);

  // Subtle decorative brass inlay ring around the turned waist
  const ringProfile = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ringProfile.push(new THREE.Vector2(0.0612 + Math.cos(a) * 0.0022, 0.0225 + Math.sin(a) * 0.0020));
  }
  const trimGeo = new THREE.LatheGeometry(ringProfile, 40);
  const trimMesh = new THREE.Mesh(trimGeo, mats.trim);
  trimMesh.userData.slot = 'accent';
  perchGroup.add(trimMesh);

  // Two short turned wooden cradle spindles holding the perch branch
  const postProfile = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const rad = 0.0075 - 0.0022 * Math.sin(t * Math.PI) + 0.0014 * Math.sin(t * Math.PI * 3);
    postProfile.push(new THREE.Vector2(rad, t * 0.036));
  }
  const postGeo = new THREE.LatheGeometry(postProfile, 18);
  for (const px of [-0.052, 0.052]) {
    const bp = perchBranchPos(px);
    const post = new THREE.Mesh(postGeo, mats.wood);
    post.position.set(px, 0.028, bp.z);
    post.userData.slot = 'primary';
    post.castShadow = true;
    post.receiveShadow = true;
    perchGroup.add(post);
  }

  // Organic curved wooden perch branch
  const branchPts = [];
  for (let i = 0; i <= 8; i++) {
    const x = -0.075 + (i / 8) * 0.152;
    const bp = perchBranchPos(x);
    branchPts.push(new THREE.Vector3(bp.x, bp.y, bp.z));
  }
  const branchCurve = new THREE.CatmullRomCurve3(branchPts);
  const branchGeo = buildTaperedTube(
    THREE,
    branchCurve,
    (u) => {
      const x = -0.075 + u * 0.152;
      const baseR = perchBranchPos(x).r;
      const endSoft = smoothstep(0.0, 0.06, u) * smoothstep(1.0, 0.94, u);
      return baseR * (0.72 + 0.28 * endSoft);
    },
    32,
    14,
    true
  );
  const branchMesh = new THREE.Mesh(branchGeo, mats.wood);
  branchMesh.userData.slot = 'primary';
  branchMesh.castShadow = true;
  branchMesh.receiveShadow = true;
  perchGroup.add(branchMesh);

  // Cute tiny side twig nub on the left end of the branch
  const nubStart = perchBranchPos(-0.064);
  const nubCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(nubStart.x, nubStart.y, nubStart.z),
    new THREE.Vector3(nubStart.x - 0.011, nubStart.y + 0.008, nubStart.z - 0.006),
    new THREE.Vector3(nubStart.x - 0.018, nubStart.y + 0.014, nubStart.z - 0.008)
  ]);
  const nubGeo = buildTaperedTube(THREE, nubCurve, (u) => 0.0052 * (1 - 0.55 * u), 10, 8, true);
  const nubMesh = new THREE.Mesh(nubGeo, mats.wood);
  nubMesh.userData.slot = 'primary';
  nubMesh.castShadow = true;
  perchGroup.add(nubMesh);

  return perchGroup;
}

// Build one gripping leg + feathered thigh + 4 wrapped toes + curved glossy claws
function buildLeg(THREE, side, mats, puffGeo) {
  const isLeft = side > 0;
  const legGroup = new THREE.Group();
  legGroup.name = isLeft ? 'legL' : 'legR';

  // Asymmetric perched foot placement along the organic branch
  const fx = isLeft ? 0.027 : -0.028;
  const bp = perchBranchPos(fx);
  const hipX = isLeft ? 0.029 : -0.029;
  const hipY = 0.128;
  const hipZ = isLeft ? 0.009 : 0.004;

  // Soft feathered drumstick thigh overlapping deeply into the body belly
  const thigh = new THREE.Mesh(puffGeo, mats.body);
  thigh.position.set(hipX, hipY - 0.006, hipZ);
  thigh.rotation.set(0.14, 0, isLeft ? -0.10 : 0.10);
  thigh.userData.slot = 'fur';
  thigh.castShadow = true;
  legGroup.add(thigh);

  // Ankle directly atop the perch branch
  const ankle = new THREE.Vector3(fx, bp.y + bp.r + 0.0038, bp.z - 0.001);
  const knee = new THREE.Vector3((hipX + fx) * 0.5, (hipY + ankle.y) * 0.5 + 0.003, (hipZ + ankle.z) * 0.5 - 0.008);
  const tarsusCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(hipX, hipY - 0.012, hipZ),
    knee,
    ankle
  ]);
  const tarsusGeo = buildTaperedTube(THREE, tarsusCurve, (u) => 0.0058 * (1 - 0.25 * u) + 0.0012 * Math.pow(u, 4), 14, 10, true);
  const tarsus = new THREE.Mesh(tarsusGeo, mats.leg);
  tarsus.userData.slot = 'secondary';
  tarsus.castShadow = true;
  legGroup.add(tarsus);

  // Helper to wrap a toe + glossy claw snugly around the perch branch
  function addWrappedToe(yaw, arcAngles, baseRad, clawLen) {
    const toePts = [];
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const wrapR = bp.r + baseRad * 0.85;

    for (let i = 0; i < arcAngles.length; i++) {
      const a = arcAngles[i];
      const dz = Math.sin(a) * wrapR;
      const dy = Math.cos(a) * wrapR;
      // Splay sideways as toe moves away from ankle
      const splay = Math.abs(Math.sin(a)) * 0.012 * sinY;
      toePts.push(new THREE.Vector3(
        fx + splay,
        bp.y + dy,
        bp.z + dz * cosY
      ));
    }
    const toeCurve = new THREE.CatmullRomCurve3(toePts);
    const toeGeo = buildTaperedTube(THREE, toeCurve, (u) => baseRad * (1 - 0.34 * u), 12, 8, true);
    const toeMesh = new THREE.Mesh(toeGeo, mats.leg);
    toeMesh.userData.slot = 'secondary';
    toeMesh.castShadow = true;
    legGroup.add(toeMesh);

    // Curved glossy talon extending from the toe tip
    const lastA = arcAngles[arcAngles.length - 1];
    const dir = Math.sign(lastA);
    const p0 = toePts[toePts.length - 1];
    const a1 = lastA + dir * 0.34;
    const a2 = lastA + dir * 0.66;
    const clawPts = [
      p0.clone(),
      new THREE.Vector3(
        p0.x + sinY * 0.0015,
        bp.y + Math.cos(a1) * (wrapR - 0.0006),
        bp.z + Math.sin(a1) * (wrapR - 0.0006) * cosY
      ),
      new THREE.Vector3(
        p0.x + sinY * 0.0022,
        bp.y + Math.cos(a2) * (wrapR - 0.0022 * clawLen),
        bp.z + Math.sin(a2) * (wrapR - 0.0022 * clawLen) * cosY
      )
    ];
    const clawCurve = new THREE.CatmullRomCurve3(clawPts);
    const clawGeo = buildTaperedTube(THREE, clawCurve, (u) => baseRad * 0.66 * (1 - 0.88 * u), 8, 6, true);
    const clawMesh = new THREE.Mesh(clawGeo, mats.claw);
    clawMesh.userData.slot = 'secondary';
    legGroup.add(clawMesh);
  }

  // Three forward toes + one rear hallux gripping the branch
  const footYawBias = isLeft ? 0.06 : -0.10;
  addWrappedToe(footYawBias - 0.42, [0.10, 0.68, 1.32, 1.88], 0.0033, 1.0);
  addWrappedToe(footYawBias + 0.00, [0.08, 0.72, 1.44, 2.02], 0.0036, 1.15);
  addWrappedToe(footYawBias + 0.42, [0.10, 0.68, 1.32, 1.88], 0.0033, 1.0);
  addWrappedToe(footYawBias + 0.04, [-0.10, -0.78, -1.48], 0.0032, 0.9);

  return legGroup;
}

// Build a layered curved wing (shoulder covert pad + 3 layers of curved extruded feathers)
function buildWing(THREE, side, mats, featherGeos, shoulderGeo) {
  const isLeft = side > 0;
  const s = isLeft ? 1 : -1;
  const wing = new THREE.Group();
  wing.name = isLeft ? 'wingL' : 'wingR';

  // Position on upper-mid flank of body
  wing.position.set(s * 0.056, 0.022, 0.002);

  // Subtle charming pose asymmetry: right wing (-x) slightly more lifted & fanned
  if (isLeft) {
    wing.rotation.set(0.10, 0.14, -0.12);
  } else {
    wing.rotation.set(0.06, -0.26, 0.24);
  }

  // Sculpted shoulder pad blending seamlessly into torso
  const shoulder = new THREE.Mesh(shoulderGeo, mats.body);
  shoulder.position.set(-s * 0.006, 0.004, 0.004);
  shoulder.rotation.set(0.28, s * 0.15, -s * 0.18);
  shoulder.userData.slot = 'fur';
  shoulder.castShadow = true;
  wing.add(shoulder);

  const openBoost = isLeft ? 0.0 : 0.12;

  // Layer 3 (outermost longest): 6 primary flight feathers curving back & around rump
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const f = new THREE.Mesh(featherGeos.primary, mats.flightFeather);
    f.position.set(
      s * (0.011 + 0.003 * Math.sin(t * Math.PI)),
      -0.010 - t * 0.014,
      -0.004 - t * 0.016
    );
    const lenScale = 1.08 - 0.22 * t;
    f.scale.set(1.0 - 0.12 * t, lenScale, 1.0);
    // Point feather backward (-z) and slightly downward, hugging the body contour
    f.rotation.order = 'YXZ';
    f.rotation.y = s * (0.14 + 0.12 * t + openBoost * (0.4 + 0.6 * t));
    f.rotation.x = -(Math.PI * 0.63 + t * 0.24 - openBoost * 0.15);
    f.rotation.z = s * (-0.28 + t * 0.14 - openBoost * 0.22);
    f.userData.slot = 'furAccent';
    f.castShadow = true;
    wing.add(f);
  }

  // Layer 2 (middle): 5 secondary feathers overlapping above primaries
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const f = new THREE.Mesh(featherGeos.secondary, mats.flightFeather);
    f.position.set(
      s * (0.014 + 0.002 * Math.sin(t * Math.PI)),
      0.003 - t * 0.014,
      0.006 - t * 0.020
    );
    f.scale.set(1.0, 0.96 - 0.10 * t, 1.0);
    f.rotation.order = 'YXZ';
    f.rotation.y = s * (0.18 + 0.10 * t + openBoost * 0.45);
    f.rotation.x = -(Math.PI * 0.59 + t * 0.20 - openBoost * 0.12);
    f.rotation.z = s * (-0.34 + t * 0.14 - openBoost * 0.18);
    f.userData.slot = 'furAccent';
    f.castShadow = true;
    wing.add(f);
  }

  // Layer 1 (upper shoulder): 5 plush covert feathers layering over the wing root
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const f = new THREE.Mesh(featherGeos.covert, mats.covertFeather);
    f.position.set(
      s * (0.015 + 0.0015 * Math.sin(t * Math.PI)),
      0.014 - t * 0.012,
      0.012 - t * 0.022
    );
    f.scale.set(1.05, 0.92 - 0.08 * t, 1.0);
    f.rotation.order = 'YXZ';
    f.rotation.y = s * (0.22 + 0.08 * t + openBoost * 0.30);
    f.rotation.x = -(Math.PI * 0.54 + t * 0.18 - openBoost * 0.08);
    f.rotation.z = s * (-0.42 + t * 0.16 - openBoost * 0.12);
    f.userData.slot = 'fur';
    f.castShadow = true;
    wing.add(f);
  }

  return wing;
}

// Build 3-layer expressive eye inside a named blink group
function buildEye(THREE, isLeft, mats, domeGeo) {
  const eyeGroup = new THREE.Group();
  eyeGroup.name = isLeft ? 'eyeL' : 'eyeR';
  const s = isLeft ? 1 : -1;

  // Positioned cleanly into the sculpted orbital socket of the head
  eyeGroup.position.set(s * 0.0312, 0.0522, 0.0542);
  eyeGroup.rotation.set(-0.05, s * 0.48, 0);

  // Layer 1: glossy dark eye base / limbal border dome
  const baseGeo = new THREE.SphereGeometry(0.0150, 26, 18);
  baseGeo.scale(1.0, 1.07, 0.56);
  const baseMesh = new THREE.Mesh(baseGeo, mats.eyeDark);
  baseMesh.userData.slot = 'eye';
  eyeGroup.add(baseMesh);

  // Layer 2: painted coloured iris curved lens sitting flush on front of eye
  const irisMesh = new THREE.Mesh(domeGeo, mats.iris);
  irisMesh.position.set(0, 0, 0.0040);
  irisMesh.scale.set(1.0, 1.06, 1.0);
  irisMesh.userData.slot = 'eye';
  eyeGroup.add(irisMesh);

  // Layer 3: two crisp white catchlight highlights placed upper-left (viewer perspective)
  const hiGeo1 = new THREE.SphereGeometry(0.0029, 12, 10);
  hiGeo1.scale(1.0, 1.15, 0.48);
  const hi1 = new THREE.Mesh(hiGeo1, mats.eyeHighlight);
  hi1.position.set(0.0042, 0.0046, 0.0086);
  eyeGroup.add(hi1);

  const hiGeo2 = new THREE.SphereGeometry(0.0013, 10, 8);
  hiGeo2.scale(1.0, 1.0, 0.55);
  const hi2 = new THREE.Mesh(hiGeo2, mats.eyeHighlight);
  hi2.position.set(-0.0038, -0.0036, 0.0084);
  eyeGroup.add(hi2);

  // Subtle curved upper eyelash/lid rim framing the eye
  const lidPts = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const ang = Math.PI * 0.14 + t * Math.PI * 0.72;
    lidPts.push(new THREE.Vector3(
      Math.cos(ang) * 0.0156,
      Math.sin(ang) * 0.0166,
      0.0030 + Math.sin(t * Math.PI) * 0.0028
    ));
  }
  const lidCurve = new THREE.CatmullRomCurve3(lidPts);
  const lidGeo = buildTaperedTube(THREE, lidCurve, (u) => 0.0014 * Math.sin(u * Math.PI) + 0.0004, 12, 6, true);
  const lidMesh = new THREE.Mesh(lidGeo, mats.eyeDark);
  eyeGroup.add(lidMesh);

  return eyeGroup;
}

// Build five long curved tapered ribbon tail plumes with glowing tips + tail coverts
function buildTail(THREE, mats, covertGeo) {
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tail';
  // Attached at the tapered rump inside body
  tailGroup.position.set(0, -0.028, -0.072);

  // 5 lush upper tail covert feathers bridging rump seamlessly to plumes
  for (let i = 0; i < 5; i++) {
    const u = (i - 2) / 2;
    const cov = new THREE.Mesh(covertGeo, mats.covertFeather);
    cov.position.set(u * 0.014, 0.008 - Math.abs(u) * 0.004, 0.004);
    cov.scale.set(0.95, 1.15 - Math.abs(u) * 0.14, 1.0);
    cov.rotation.order = 'YXZ';
    cov.rotation.y = u * 0.34;
    cov.rotation.x = -(Math.PI * 0.62 + Math.abs(u) * 0.06);
    cov.userData.slot = 'fur';
    cov.castShadow = true;
    tailGroup.add(cov);
  }

  // Five distinct long flowing ribbon plume trajectories (all stay safely above floor y>=0.035)
  const plumeSpecs = [
    // 0: Center hero longest plume sweeping back-down and curling playfully right & up
    {
      pts: [
        [0.000, 0.000, 0.000],
        [0.004, 0.005, -0.062],
        [0.022, -0.032, -0.128],
        [0.052, -0.088, -0.174],
        [0.088, -0.105, -0.172],
        [0.106, -0.084, -0.144]
      ],
      widthScale: 1.08,
      rollBias: 0.25
    },
    // 1: Inner-left sweeping gracefully back-left then curving warmly in harmony
    {
      pts: [
        [0.011, 0.002, -0.002],
        [0.036, 0.012, -0.058],
        [0.072, -0.016, -0.116],
        [0.108, -0.062, -0.150],
        [0.132, -0.078, -0.134],
        [0.136, -0.056, -0.104]
      ],
      widthScale: 0.96,
      rollBias: 0.42
    },
    // 2: Inner-right cascading slightly lower-right-rear
    {
      pts: [
        [-0.011, 0.002, -0.002],
        [-0.026, 0.008, -0.060],
        [-0.032, -0.028, -0.124],
        [-0.016, -0.078, -0.168],
        [0.014, -0.096, -0.178],
        [0.034, -0.076, -0.162]
      ],
      widthScale: 0.98,
      rollBias: -0.18
    },
    // 3: Outer-left graceful higher floating streamer
    {
      pts: [
        [0.018, 0.004, 0.002],
        [0.056, 0.024, -0.044],
        [0.098, 0.006, -0.094],
        [0.132, -0.032, -0.118],
        [0.144, -0.046, -0.092],
        [0.138, -0.026, -0.066]
      ],
      widthScale: 0.88,
      rollBias: 0.55
    },
    // 4: Outer-right balancing outer arc
    {
      pts: [
        [-0.018, 0.004, 0.002],
        [-0.052, 0.020, -0.048],
        [-0.082, -0.006, -0.104],
        [-0.094, -0.052, -0.142],
        [-0.082, -0.072, -0.148],
        [-0.064, -0.052, -0.132]
      ],
      widthScale: 0.90,
      rollBias: -0.45
    }
  ];

  plumeSpecs.forEach((spec, idx) => {
    const pGroup = new THREE.Group();
    pGroup.name = `plume${idx}`;
    const curve = new THREE.CatmullRomCurve3(
      spec.pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]))
    );

    // Tapered ribbon width with slender neck and stylised flame-teardrop glowing tip
    const widthFn = (u) => {
      const base = 0.0045 + 0.0075 * Math.sin(Math.min(1, u * 1.45) * Math.PI * 0.85);
      const neck = 1 - 0.42 * Math.exp(-Math.pow((u - 0.68) / 0.14, 2));
      const tipBloom = 0.021 * Math.exp(-Math.pow((u - 0.87) / 0.095, 2));
      const tipPoint = smoothstep(1.0, 0.94, u);
      return (base * neck + tipBloom) * tipPoint * spec.widthScale;
    };
    const thicknessFn = (u) => (0.0024 * (1 - 0.55 * u) + 0.0007) * smoothstep(1.0, 0.96, u);
    const rollFn = (u) => spec.rollBias * smoothstep(0.05, 0.85, u);

    const ribbonGeo = buildRibbonPlumeGeometry(THREE, curve, widthFn, thicknessFn, rollFn, 44, 10);
    const ribbonMesh = new THREE.Mesh(ribbonGeo, mats.tailPlume);
    ribbonMesh.userData.slot = 'glow';
    ribbonMesh.castShadow = true;
    pGroup.add(ribbonMesh);

    // Fine central tapered rachis quill running 82% along the ribbon
    const quillPts = [];
    for (let k = 0; k <= 12; k++) {
      quillPts.push(curve.getPoint((k / 12) * 0.82));
    }
    const quillCurve = new THREE.CatmullRomCurve3(quillPts);
    const quillGeo = buildTaperedTube(THREE, quillCurve, (u) => 0.0014 * (1 - 0.72 * u), 24, 6, false);
    const quillMesh = new THREE.Mesh(quillGeo, mats.flightFeather);
    quillMesh.userData.slot = 'furAccent';
    pGroup.add(quillMesh);

    pGroup.userData.base = {
      rx: 0,
      ry: 0,
      rz: 0,
      phase: idx * 1.15
    };
    tailGroup.add(pGroup);
  });

  return tailGroup;
}

export function build(THREE, opts, kit) {
  const pal = resolvePalette(THREE, opts || {});
  const root = new THREE.Group();
  root.name = 'youngPhoenix';

  // Procedural CanvasTextures driven by opts/palette
  const bodyTex = makeBodyTextures(THREE, kit, pal);
  const headTex = makeHeadTextures(THREE, kit, pal);
  const covertTex = makeFeatherTextures(THREE, kit, pal, 'covert');
  const flightTex = makeFeatherTextures(THREE, kit, pal, 'flight');
  const crestTex = makeFeatherTextures(THREE, kit, pal, 'crest');
  const tailTex = makeTailPlumeTextures(THREE, kit, pal);
  const irisTex = makeIrisTexture(THREE, kit, pal);
  const blushTex = makeBlushTexture(THREE, kit, pal);
  const beakTex = makeBeakTexture(THREE, kit, pal);
  const woodTex = makeWoodTextures(THREE, kit, pal);

  // MeshPhysicalMaterials tailored to each surface class
  const mats = {
    body: new THREE.MeshPhysicalMaterial({
      map: bodyTex.map,
      bumpMap: bodyTex.bumpMap,
      bumpScale: 0.0016,
      roughness: 0.90,
      metalness: 0.0,
      sheen: 0.85,
      sheenRoughness: 0.68,
      sheenColor: pal.furSheen
    }),
    head: new THREE.MeshPhysicalMaterial({
      map: headTex.map,
      bumpMap: headTex.bumpMap,
      bumpScale: 0.0012,
      roughness: 0.88,
      metalness: 0.0,
      sheen: 0.88,
      sheenRoughness: 0.64,
      sheenColor: pal.furSheen
    }),
    covertFeather: new THREE.MeshPhysicalMaterial({
      map: covertTex.map,
      bumpMap: covertTex.bumpMap,
      bumpScale: 0.0014,
      roughness: 0.88,
      metalness: 0.0,
      sheen: 0.82,
      sheenRoughness: 0.62,
      sheenColor: pal.furSheen
    }),
    flightFeather: new THREE.MeshPhysicalMaterial({
      map: flightTex.map,
      bumpMap: flightTex.bumpMap,
      bumpScale: 0.0015,
      emissive: pal.glow,
      emissiveMap: flightTex.emissiveMap,
      emissiveIntensity: 1.35,
      roughness: 0.86,
      metalness: 0.0,
      sheen: 0.85,
      sheenRoughness: 0.58,
      sheenColor: pal.accentSheen
    }),
    crestFeather: new THREE.MeshPhysicalMaterial({
      map: crestTex.map,
      bumpMap: crestTex.bumpMap,
      bumpScale: 0.0012,
      emissive: pal.glow,
      emissiveMap: crestTex.emissiveMap,
      emissiveIntensity: 1.45,
      roughness: 0.85,
      metalness: 0.0,
      sheen: 0.90,
      sheenRoughness: 0.55,
      sheenColor: pal.accentSheen
    }),
    tailPlume: new THREE.MeshPhysicalMaterial({
      map: tailTex.map,
      bumpMap: tailTex.bumpMap,
      bumpScale: 0.0014,
      emissive: pal.glow,
      emissiveMap: tailTex.emissiveMap,
      emissiveIntensity: 1.55,
      roughness: 0.85,
      metalness: 0.0,
      sheen: 0.92,
      sheenRoughness: 0.52,
      sheenColor: pal.accentSheen
    }),
    eyeDark: new THREE.MeshPhysicalMaterial({
      color: '#120a0b',
      roughness: 0.05,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04
    }),
    iris: new THREE.MeshPhysicalMaterial({
      map: irisTex,
      roughness: 0.05,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04
    }),
    eyeHighlight: new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      emissive: '#ffffff',
      emissiveIntensity: 0.45,
      roughness: 0.04,
      clearcoat: 1.0
    }),
    blush: new THREE.MeshPhysicalMaterial({
      map: blushTex,
      transparent: true,
      depthWrite: false,
      roughness: 0.95,
      polygonOffset: true,
      polygonOffsetFactor: -1
    }),
    beak: new THREE.MeshPhysicalMaterial({
      map: beakTex,
      roughness: 0.16,
      metalness: 0.0,
      clearcoat: 0.92,
      clearcoatRoughness: 0.10
    }),
    mouthLine: new THREE.MeshPhysicalMaterial({
      color: '#3a1a12',
      roughness: 0.35,
      clearcoat: 0.4
    }),
    leg: new THREE.MeshPhysicalMaterial({
      map: beakTex,
      roughness: 0.42,
      metalness: 0.0,
      clearcoat: 0.32,
      clearcoatRoughness: 0.35
    }),
    claw: new THREE.MeshPhysicalMaterial({
      color: pal.beak.clone().multiplyScalar(0.52),
      roughness: 0.12,
      metalness: 0.0,
      clearcoat: 0.96,
      clearcoatRoughness: 0.08
    }),
    wood: new THREE.MeshPhysicalMaterial({
      map: woodTex.map,
      bumpMap: woodTex.bumpMap,
      bumpScale: 0.0018,
      roughness: 0.62,
      metalness: 0.0,
      clearcoat: 0.28,
      clearcoatRoughness: 0.38
    }),
    trim: new THREE.MeshPhysicalMaterial({
      color: pal.trim,
      roughness: 0.28,
      metalness: 0.65,
      clearcoat: 0.55,
      clearcoatRoughness: 0.20
    })
  };

  // Store glow materials for subtle warm breathing shimmer in idle()
  root.userData.glowMaterials = [mats.tailPlume, mats.crestFeather, mats.flightFeather];

  // 1. Cozy dorm-room turned wooden perch stand (resting solidly on y=0)
  root.add(buildPerch(THREE, mats));

  // Shared curved extruded feather geometries
  const featherGeos = {
    primary: buildBentExtrudedFeather(THREE, {
      length: 0.126,
      width: 0.025,
      asym: 0.08,
      thickness: 0.0016,
      bevel: 0.0011,
      arch: -0.022,
      sCurve: 0.005,
      cup: 0.0022,
      curveSegments: 16
    }),
    secondary: buildBentExtrudedFeather(THREE, {
      length: 0.094,
      width: 0.024,
      asym: 0.05,
      thickness: 0.0016,
      bevel: 0.0011,
      arch: -0.016,
      cup: 0.0022,
      curveSegments: 14
    }),
    covert: buildBentExtrudedFeather(THREE, {
      length: 0.056,
      width: 0.022,
      thickness: 0.0018,
      bevel: 0.0012,
      arch: -0.011,
      cup: 0.0020,
      curveSegments: 12
    }),
    ruff: buildBentExtrudedFeather(THREE, {
      length: 0.036,
      width: 0.019,
      thickness: 0.0018,
      bevel: 0.0012,
      arch: 0.009,
      cup: 0.0018,
      curveSegments: 12
    }),
    crestMain: buildBentExtrudedFeather(THREE, {
      length: 0.094,
      width: 0.017,
      tipFlare: 0.45,
      thickness: 0.0015,
      bevel: 0.0010,
      arch: -0.034,
      sCurve: 0.009,
      cup: 0.0016,
      curveSegments: 18
    }),
    crestSide: buildBentExtrudedFeather(THREE, {
      length: 0.072,
      width: 0.015,
      tipFlare: 0.30,
      thickness: 0.0014,
      bevel: 0.0010,
      arch: -0.026,
      sCurve: 0.006,
      cup: 0.0014,
      curveSegments: 16
    }),
    earTuft: buildBentExtrudedFeather(THREE, {
      length: 0.040,
      width: 0.014,
      thickness: 0.0014,
      bevel: 0.0010,
      arch: -0.012,
      cup: 0.0012,
      curveSegments: 12
    })
  };

  // 2. Legs & gripping talons (named legL / legR)
  const thighPuffGeo = buildSoftPuffGeometry(THREE, 0.024, 0.026, 0.026);
  const legL = buildLeg(THREE, 1, mats, thighPuffGeo);
  const legR = buildLeg(THREE, -1, mats, thighPuffGeo);
  root.add(legL, legR);

  // 3. Body group (torso, chest ruff, wings, tail)
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'body';
  bodyGroup.position.set(0, 0.175, 0.002);
  // Proud perched posture with gentle artistic 3/4 twist
  bodyGroup.rotation.set(-0.08, 0.09, 0.02);
  bodyGroup.userData.base = {
    px: bodyGroup.position.x,
    py: bodyGroup.position.y,
    pz: bodyGroup.position.z,
    rx: bodyGroup.rotation.x,
    ry: bodyGroup.rotation.y,
    rz: bodyGroup.rotation.z
  };
  root.add(bodyGroup);

  const bodyGeo = buildSculptedBodyGeometry(THREE, kit);
  const bodyMesh = new THREE.Mesh(bodyGeo, mats.body);
  bodyMesh.userData.slot = 'fur';
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyGroup.add(bodyMesh);

  // Plush downy neck/chest collar ruff bridging body and head seamlessly
  const ruffCount = 11;
  for (let i = 0; i < ruffCount; i++) {
    const a = (i / ruffCount) * Math.PI * 2;
    const isFront = Math.cos(a) > 0;
    const rf = new THREE.Mesh(featherGeos.ruff, isFront ? mats.flightFeather : mats.covertFeather);
    const radX = 0.044;
    const radZ = 0.044;
    rf.position.set(
      Math.sin(a) * radX,
      0.056 - Math.cos(a) * 0.005,
      0.015 + Math.cos(a) * radZ
    );
    rf.rotation.order = 'YXZ';
    rf.rotation.y = a;
    rf.rotation.x = Math.PI * 0.72 + (isFront ? 0.10 : -0.04);
    rf.scale.set(1.05, isFront ? 1.15 : 0.92, 1.0);
    rf.userData.slot = isFront ? 'furAccent' : 'fur';
    rf.castShadow = true;
    bodyGroup.add(rf);
  }

  // 4. Layered wings (named wingL / wingR, attached to body for breathing harmony)
  const shoulderGeo = buildSoftPuffGeometry(THREE, 0.018, 0.026, 0.032);
  const wingL = buildWing(THREE, 1, mats, featherGeos, shoulderGeo);
  const wingR = buildWing(THREE, -1, mats, featherGeos, shoulderGeo);
  wingL.userData.base = { rx: wingL.rotation.x, ry: wingL.rotation.y, rz: wingL.rotation.z };
  wingR.userData.base = { rx: wingR.rotation.x, ry: wingR.rotation.y, rz: wingR.rotation.z };
  bodyGroup.add(wingL, wingR);

  // 5. Five long flowing tail plumes (named tail, attached to body)
  const tailGroup = buildTail(THREE, mats, featherGeos.covert);
  tailGroup.userData.base = { rx: tailGroup.rotation.x, ry: tailGroup.rotation.y, rz: tailGroup.rotation.z };
  bodyGroup.add(tailGroup);

  // 6. Sculpted Head group (named head, attached to body at neck base)
  const headGroup = new THREE.Group();
  headGroup.name = 'head';
  headGroup.position.set(0, 0.064, 0.018);
  // Charming curious slight tilt and turn toward 3/4 view
  headGroup.rotation.set(0.06, -0.14, 0.11);
  headGroup.userData.base = {
    rx: headGroup.rotation.x,
    ry: headGroup.rotation.y,
    rz: headGroup.rotation.z
  };
  bodyGroup.add(headGroup);

  const headGeo = buildSculptedHeadGeometry(THREE, kit);
  const headMesh = new THREE.Mesh(headGeo, mats.head);
  headMesh.userData.slot = 'fur';
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headGroup.add(headMesh);

  // 3-layer expressive eyes (named eyeL / eyeR for blinking in idle)
  const irisDomeGeo = buildDomeDisc(THREE, 0.0130, 0.0048, 28, 6);
  const eyeL = buildEye(THREE, true, mats, irisDomeGeo);
  const eyeR = buildEye(THREE, false, mats, irisDomeGeo);
  headGroup.add(eyeL, eyeR);

  // Subtle curved cheek blush discs resting flush on puffy cheeks
  const blushGeo = buildDomeDisc(THREE, 0.0135, 0.0022, 20, 4);
  for (const s of [1, -1]) {
    const blush = new THREE.Mesh(blushGeo, mats.blush);
    blush.position.set(s * 0.0435, 0.0365, 0.0462);
    blush.rotation.set(0.18, s * 0.72, 0);
    blush.userData.slot = 'accent';
    headGroup.add(blush);
  }

  // Sculpted beak (upper + lower + happy curved smile tube + tiny cere nostrils)
  const beakGroup = new THREE.Group();
  beakGroup.name = 'beak';
  beakGroup.position.set(0, 0.0415, 0.056);
  headGroup.add(beakGroup);

  const beakGeos = buildBeakGeometries(THREE);
  const upperBeak = new THREE.Mesh(beakGeos.upper, mats.beak);
  upperBeak.userData.slot = 'secondary';
  upperBeak.castShadow = true;
  beakGroup.add(upperBeak);

  const lowerBeak = new THREE.Mesh(beakGeos.lower, mats.beak);
  lowerBeak.userData.slot = 'secondary';
  beakGroup.add(lowerBeak);

  // Curved happy mouth line made from a thin tapered tube along the beak commissure
  const mouthCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.0112, -0.0018, 0.0055),
    new THREE.Vector3(-0.0068, -0.0038, 0.0165),
    new THREE.Vector3(0.0000, -0.0046, 0.0225),
    new THREE.Vector3(0.0068, -0.0038, 0.0165),
    new THREE.Vector3(0.0112, -0.0018, 0.0055)
  ]);
  const mouthGeo = buildTaperedTube(THREE, mouthCurve, (u) => 0.00065 * Math.sin(u * Math.PI) + 0.00035, 16, 6, true);
  const mouthLine = new THREE.Mesh(mouthGeo, mats.mouthLine);
  beakGroup.add(mouthLine);

  // Tiny sculpted nostril pips near beak bridge
  const nostrilGeo = new THREE.SphereGeometry(0.0011, 8, 6);
  nostrilGeo.scale(0.8, 0.65, 1.3);
  for (const s of [1, -1]) {
    const nMesh = new THREE.Mesh(nostrilGeo, mats.mouthLine);
    nMesh.position.set(s * 0.0044, 0.0042, 0.0108);
    beakGroup.add(nMesh);
  }

  // Cheek / ear feather tufts (named earL / earR for subtle twitching in idle)
  for (const s of [1, -1]) {
    const ear = new THREE.Group();
    ear.name = s > 0 ? 'earL' : 'earR';
    ear.position.set(s * 0.052, 0.050, 0.004);
    ear.rotation.set(-0.22, s * 0.55, -s * 0.68);
    ear.userData.base = { rx: ear.rotation.x, ry: ear.rotation.y, rz: ear.rotation.z };

    const t1 = new THREE.Mesh(featherGeos.earTuft, mats.crestFeather);
    t1.scale.set(1.05, 1.12, 1.0);
    t1.userData.slot = 'furAccent';
    t1.castShadow = true;
    ear.add(t1);

    const t2 = new THREE.Mesh(featherGeos.earTuft, mats.covertFeather);
    t2.position.set(s * 0.002, -0.006, -0.004);
    t2.rotation.set(-0.24, 0, -s * 0.25);
    t2.scale.set(0.88, 0.85, 1.0);
    t2.userData.slot = 'fur';
    ear.add(t2);

    headGroup.add(ear);
  }

  // Flowing Crown Crest (reaches ~0.405 m world height!)
  const crestGroup = new THREE.Group();
  crestGroup.name = 'crest';
  crestGroup.position.set(0, 0.098, 0.016);
  crestGroup.userData.base = { rx: 0, ry: 0, rz: 0 };
  headGroup.add(crestGroup);

  const crestSpecs = [
    // Hero central tall plume
    { geo: featherGeos.crestMain, pos: [0, 0.002, 0.002], rot: [-0.24, 0, 0.02], sc: [1.02, 1.02, 1.0] },
    // Flanking pair
    { geo: featherGeos.crestSide, pos: [0.011, 0.000, -0.002], rot: [-0.36, 0.22, -0.26], sc: [1.0, 1.04, 1.0] },
    { geo: featherGeos.crestSide, pos: [-0.011, 0.000, -0.002], rot: [-0.34, -0.22, 0.24], sc: [1.0, 1.02, 1.0] },
    // Outer sweeping pair
    { geo: featherGeos.crestSide, pos: [0.020, -0.004, -0.008], rot: [-0.52, 0.42, -0.46], sc: [0.92, 0.86, 1.0] },
    { geo: featherGeos.crestSide, pos: [-0.020, -0.004, -0.008], rot: [-0.50, -0.42, 0.44], sc: [0.92, 0.84, 1.0] },
    // Delicate forehead crown wisps framing the brow
    { geo: featherGeos.earTuft, pos: [0.007, 0.001, 0.014], rot: [-0.14, 0.14, -0.18], sc: [0.78, 0.88, 1.0] },
    { geo: featherGeos.earTuft, pos: [-0.007, 0.001, 0.014], rot: [-0.14, -0.14, 0.18], sc: [0.78, 0.88, 1.0] }
  ];

  for (const cs of crestSpecs) {
    const cm = new THREE.Mesh(cs.geo, mats.crestFeather);
    cm.position.set(cs.pos[0], cs.pos[1], cs.pos[2]);
    cm.rotation.set(cs.rot[0], cs.rot[1], cs.rot[2]);
    cm.scale.set(cs.sc[0], cs.sc[1], cs.sc[2]);
    cm.userData.slot = 'furAccent';
    cm.castShadow = true;
    crestGroup.add(cm);
  }

  return root;
}

export function idle(group, t) {
  if (!group) return;

  const body = group.getObjectByName('body');
  const head = group.getObjectByName('head');
  const tail = group.getObjectByName('tail');
  const wingL = group.getObjectByName('wingL');
  const wingR = group.getObjectByName('wingR');
  const earL = group.getObjectByName('earL');
  const earR = group.getObjectByName('earR');
  const crest = group.getObjectByName('crest');
  const eyeL = group.getObjectByName('eyeL');
  const eyeR = group.getObjectByName('eyeR');

  const breath = Math.sin(t * 2.15);

  // Cozy breathing on body
  if (body && body.userData.base) {
    const b = body.userData.base;
    body.position.y = b.py + breath * 0.0024;
    body.scale.set(1 + breath * 0.014, 1 + breath * 0.016, 1 + breath * 0.018);
    body.rotation.x = b.rx + breath * 0.018;
  }

  // Curious gentle head sway & micro-nod
  if (head && head.userData.base) {
    const h = head.userData.base;
    head.rotation.y = h.ry + Math.sin(t * 0.95) * 0.10 + Math.sin(t * 0.41) * 0.05;
    head.rotation.z = h.rz + Math.sin(t * 0.72 + 0.8) * 0.065;
    head.rotation.x = h.rx + Math.sin(t * 1.45 + 0.4) * 0.032 - breath * 0.015;
  }

  // Soft lagged crest bob
  if (crest && crest.userData.base) {
    crest.rotation.x = -0.03 * Math.sin(t * 2.15 - 0.5) + 0.025 * Math.sin(t * 1.3);
    crest.rotation.z = 0.025 * Math.cos(t * 0.72 + 0.4);
  }

  // Subtle cheek-tuft / ear flutter
  if (earL && earL.userData.base) {
    const eb = earL.userData.base;
    earL.rotation.z = eb.rz + Math.sin(t * 2.6 + 0.3) * 0.045;
  }
  if (earR && earR.userData.base) {
    const eb = earR.userData.base;
    earR.rotation.z = eb.rz - Math.sin(t * 2.6 + 0.7) * 0.045;
  }

  // Gentle breathing wing settle + subtle cozy ruffle on wingR
  if (wingL && wingL.userData.base) {
    const wb = wingL.userData.base;
    wingL.rotation.z = wb.rz - breath * 0.026;
    wingL.rotation.y = wb.ry + breath * 0.015;
  }
  if (wingR && wingR.userData.base) {
    const wb = wingR.userData.base;
    const ruffle = Math.pow(Math.max(0, Math.sin(t * 0.52)), 14) * Math.sin(t * 12.0) * 0.045;
    wingR.rotation.z = wb.rz + breath * 0.032 + ruffle;
    wingR.rotation.y = wb.ry - breath * 0.020 - ruffle * 0.5;
  }

  // Flowing tail plume wave (safe clearance above floor)
  if (tail && tail.userData.base) {
    const tb = tail.userData.base;
    tail.rotation.x = tb.rx + Math.sin(t * 1.35 - 0.6) * 0.036;
    tail.rotation.y = tb.ry + Math.sin(t * 0.85) * 0.055;
    for (let i = 0; i < tail.children.length; i++) {
      const ch = tail.children[i];
      if (ch.name && ch.name.startsWith('plume') && ch.userData.base) {
        const ph = ch.userData.base.phase;
        ch.rotation.x = Math.sin(t * 1.7 + ph) * 0.032;
        ch.rotation.y = Math.cos(t * 1.25 + ph) * 0.038;
        ch.rotation.z = Math.sin(t * 1.45 + ph * 0.7) * 0.022;
      }
    }
  }

  // Natural blink every ~3.8 seconds (with occasional cozy double blink)
  const blinkCycle = t % 7.6;
  let blinkAmt = 0;
  if (blinkCycle > 3.2 && blinkCycle < 3.38) {
    blinkAmt = Math.sin(((blinkCycle - 3.2) / 0.18) * Math.PI);
  } else if (blinkCycle > 6.8 && blinkCycle < 6.96) {
    blinkAmt = Math.sin(((blinkCycle - 6.8) / 0.16) * Math.PI);
  } else if (blinkCycle > 7.06 && blinkCycle < 7.22) {
    blinkAmt = Math.sin(((blinkCycle - 7.06) / 0.16) * Math.PI);
  }
  const eyeScaleY = 1 - 0.92 * blinkAmt;
  if (eyeL) eyeL.scale.y = eyeScaleY;
  if (eyeR) eyeR.scale.y = eyeScaleY;

  // Warm living ember pulse on glowing tail & crest tips
  const glowMats = group.userData.glowMaterials;
  if (glowMats && glowMats.length >= 3) {
    const pulse = 0.18 * Math.sin(t * 2.0) + 0.06 * Math.sin(t * 4.7);
    glowMats[0].emissiveIntensity = 1.55 + pulse;
    glowMats[1].emissiveIntensity = 1.45 + pulse * 0.8;
    glowMats[2].emissiveIntensity = 1.35 + pulse * 0.6;
  }
}
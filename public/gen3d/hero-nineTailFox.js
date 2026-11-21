export const META = {
  id: 'nine-tailed-fox',
  name: 'Nine-Tailed Fox',
  kind: 'creature',
  footprint: [0.42, 0.40],
  variants: ['Snow Inari', 'Autumn Red', 'Celestial Gold'],
  note: 'Cozy stylised sitting kitsune (~0.4 m) with nine sculpted brush tails fanned like a peacock, luminous tips, and shrine bell collar.'
};

const PRESETS = [
  {
    fur: '#f4efe8',
    furAccent: '#fffdf9',
    furShade: '#d5cabd',
    tipTint: '#d8665a',
    pawTint: '#d87b6f',
    innerEar: '#f0b8b0',
    blush: '#e87f7c',
    eye: '#c4362c',
    glow: '#ffdca8',
    accent: '#c7352b',
    metal: '#e5bc5e',
    liner: '#361a18'
  },
  {
    fur: '#c95529',
    furAccent: '#f8ecd8',
    furShade: '#6b2816',
    tipTint: '#361e18',
    pawTint: '#3e231c',
    innerEar: '#e8a899',
    blush: '#e37668',
    eye: '#d69528',
    glow: '#ffbf66',
    accent: '#a82620',
    metal: '#e0b352',
    liner: '#24130f'
  },
  {
    fur: '#dfa43c',
    furAccent: '#fff8e6',
    furShade: '#9a5f18',
    tipTint: '#9c5a18',
    pawTint: '#a66820',
    innerEar: '#f2be9f',
    blush: '#e6846a',
    eye: '#2d75a8',
    glow: '#ffea9c',
    accent: '#b82e26',
    metal: '#f0cb6e',
    liner: '#2b1b12'
  }
];

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function resolvePalette(THREE, opts) {
  const o = opts || {};
  const vIdx = Number.isInteger(o.variant) ? clamp(o.variant, 0, PRESETS.length - 1) : 0;
  const base = PRESETS[vIdx];

  const furCol = new THREE.Color(o.fur || base.fur);
  const accentCol = new THREE.Color(o.furAccent || base.furAccent);
  const eyeCol = new THREE.Color(o.eye || base.eye);
  const glowCol = new THREE.Color(o.glow || base.glow);

  let shadeCol;
  if (o.fur) {
    shadeCol = furCol.clone().multiplyScalar(0.62);
    shadeCol.offsetHSL(-0.015, 0.06, -0.06);
  } else {
    shadeCol = new THREE.Color(base.furShade);
  }

  let tipTintCol = o.fur ? shadeCol.clone().multiplyScalar(0.78) : new THREE.Color(base.tipTint);
  let pawTintCol = o.fur ? shadeCol.clone().multiplyScalar(0.84) : new THREE.Color(base.pawTint);
  const sheenFur = furCol.clone().lerp(new THREE.Color('#ffffff'), 0.45);
  const sheenAccent = accentCol.clone().lerp(new THREE.Color('#ffffff'), 0.5);

  return {
    variant: vIdx,
    fur: furCol,
    furAccent: accentCol,
    furShade: shadeCol,
    tipTint: tipTintCol,
    pawTint: pawTintCol,
    innerEar: new THREE.Color(base.innerEar),
    blush: new THREE.Color(base.blush),
    eye: eyeCol,
    glow: glowCol,
    accent: new THREE.Color(base.accent),
    metal: new THREE.Color(base.metal),
    liner: new THREE.Color(base.liner),
    sheenFur,
    sheenAccent
  };
}

function colHex(c) {
  return '#' + c.getHexString();
}

function colRgba(c, a) {
  const r = Math.round(clamp(c.r, 0, 1) * 255);
  const g = Math.round(clamp(c.g, 0, 1) * 255);
  const b = Math.round(clamp(c.b, 0, 1) * 255);
  return `rgba(${r},${g},${b},${a})`;
}

function lerpColCss(THREE, c1, c2, t, alpha) {
  const tmp = c1.clone().lerp(c2, clamp(t, 0, 1));
  return alpha === undefined ? colHex(tmp) : colRgba(tmp, alpha);
}

// Twist-free tapered tube geometry builder along a CatmullRomCurve3
function buildTaperedTube(THREE, curve, radialSegs, tubularSegs, radiusFn, detailFn) {
  const points = [];
  const tangents = [];
  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    points.push(curve.getPoint(u));
    tangents.push(curve.getTangent(u).normalize());
  }

  const normals = [];
  const binormals = [];
  const upRef = Math.abs(tangents[0].y) < 0.92
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(1, 0, 0);

  let n = new THREE.Vector3().crossVectors(upRef, tangents[0]).normalize();
  let b = new THREE.Vector3().crossVectors(tangents[0], n).normalize();
  normals.push(n);
  binormals.push(b);

  for (let i = 1; i <= tubularSegs; i++) {
    const prevN = normals[i - 1];
    const t = tangents[i];
    const proj = prevN.dot(t);
    const curN = prevN.clone().addScaledVector(t, -proj);
    if (curN.lengthSq() < 1e-8) {
      const alt = Math.abs(t.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      curN.crossVectors(alt, t);
    }
    curN.normalize();
    const curB = new THREE.Vector3().crossVectors(t, curN).normalize();
    normals.push(curN);
    binormals.push(curB);
  }

  const stride = radialSegs + 1;
  const vertCount = (tubularSegs + 1) * stride;
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices = [];

  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    const center = points[i];
    const N = normals[i];
    const B = binormals[i];

    for (let j = 0; j <= radialSegs; j++) {
      const vFrac = j / radialSegs;
      const theta = vFrac * Math.PI * 2;
      const baseR = Math.max(0.00018, radiusFn(u, theta));
      let rx = baseR;
      let ry = baseR;
      if (detailFn) {
        const mod = detailFn(u, theta);
        rx *= mod.sx;
        ry *= mod.sy;
      }

      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const px = center.x + N.x * (cosT * rx) + B.x * (sinT * ry);
      const py = center.y + N.y * (cosT * rx) + B.y * (sinT * ry);
      const pz = center.z + N.z * (cosT * rx) + B.z * (sinT * ry);

      const idx = i * stride + j;
      positions[idx * 3] = px;
      positions[idx * 3 + 1] = py;
      positions[idx * 3 + 2] = pz;
      uvs[idx * 2] = vFrac;
      uvs[idx * 2 + 1] = u;
    }
  }

  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const bIdx = i * stride + (j + 1);
      const c = (i + 1) * stride + j;
      const d = (i + 1) * stride + (j + 1);
      indices.push(a, bIdx, d);
      indices.push(a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Sculpted continuous head deformation from unit sphere point (nx, ny, nz), +z front
function deformHeadVertex(nx, ny, nz) {
  // Base chibi cranium
  let x = nx * 0.055;
  let y = ny * 0.0485;
  let z = nz * 0.051;

  // Taper crown gently and widen cozy cheeks
  const crownTaper = 1.0 - 0.13 * Math.max(0, ny);
  const cheekFull = 1.0 + 0.14 * Math.exp(-Math.pow((ny + 0.22) / 0.36, 2));
  x *= crownTaper * cheekFull;

  // Fox cheek fur tufts protruding left and right with subtle double-scallop
  const absX = Math.abs(nx);
  const cheekMask = Math.pow(absX, 2.3)
    * Math.exp(-Math.pow((ny + 0.22) / 0.33, 2))
    * Math.exp(-Math.pow((nz - 0.04) / 0.66, 2));
  const tuftRidge = 1.0 + 0.20 * Math.cos((ny + 0.23) * 14.5);
  x += Math.sign(nx) * 0.0175 * cheekMask * tuftRidge;
  z -= 0.0055 * cheekMask;
  y -= 0.0025 * cheekMask;

  // Continuous tapered fox muzzle emerging from lower front face
  const muzzleFront = Math.max(0, (nz - 0.24) / 0.76);
  const muzzleH = Math.exp(-Math.pow((ny + 0.21) / 0.40, 2));
  const muzzleW = Math.exp(-Math.pow(nx / 0.50, 2));
  const muzzle = Math.pow(muzzleFront, 1.32) * muzzleH * muzzleW;

  z += 0.0365 * muzzle;
  x *= 1.0 - 0.30 * muzzle;
  y += (ny > -0.21 ? -0.0045 : 0.0028) * muzzle;

  // Soft plump whisker pads under nose
  const pad = Math.exp(-Math.pow((absX - 0.16) / 0.16, 2))
    * Math.exp(-Math.pow((ny + 0.33) / 0.18, 2))
    * Math.max(0, nz - 0.45);
  z += 0.0038 * pad;
  y -= 0.0018 * pad;

  // Subtle brow fullness
  const brow = Math.exp(-Math.pow((ny - 0.30) / 0.24, 2))
    * Math.exp(-Math.pow((absX - 0.26) / 0.30, 2))
    * Math.max(0, nz - 0.35);
  z += 0.0030 * brow;

  // Gentle eye socket recesses so 3-layer eyes sit snug and never float
  const ex = 0.445;
  const ey = 0.055;
  const ez = 0.8938;
  const dotL = clamp(nx * ex + ny * ey + nz * ez, -1, 1);
  const dotR = clamp(-nx * ex + ny * ey + nz * ez, -1, 1);
  const angL = Math.acos(dotL);
  const angR = Math.acos(dotR);
  const socket = Math.exp(-Math.pow(angL / 0.23, 2)) + Math.exp(-Math.pow(angR / 0.23, 2));
  const indent = 0.0038 * socket;
  x -= nx * indent;
  y -= ny * indent;
  z -= nz * indent;

  // Gentle chin flattening and deep neck-socket flare at back-bottom
  if (ny < -0.52) {
    const ch = smoothstep(-0.52, -0.95, ny);
    y += 0.004 * ch * Math.max(0, nz + 0.2);
  }
  const neckFlare = smoothstep(-0.48, -0.92, ny) * smoothstep(0.35, -0.35, nz);
  y -= 0.0075 * neckFlare;

  return { x, y, z };
}

function sampleHeadSurface(THREE, dirVec) {
  const d = dirVec.clone().normalize();
  const p0Obj = deformHeadVertex(d.x, d.y, d.z);
  const p0 = new THREE.Vector3(p0Obj.x, p0Obj.y, p0Obj.z);

  const ref = Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const t1 = new THREE.Vector3().crossVectors(ref, d).normalize();
  const t2 = new THREE.Vector3().crossVectors(d, t1).normalize();
  const eps = 0.012;

  const d1 = d.clone().addScaledVector(t1, eps).normalize();
  const d2 = d.clone().addScaledVector(t2, eps).normalize();
  const p1Obj = deformHeadVertex(d1.x, d1.y, d1.z);
  const p2Obj = deformHeadVertex(d2.x, d2.y, d2.z);

  const e1 = new THREE.Vector3(p1Obj.x - p0.x, p1Obj.y - p0.y, p1Obj.z - p0.z);
  const e2 = new THREE.Vector3(p2Obj.x - p0.x, p2Obj.y - p0.y, p2Obj.z - p0.z);
  const normal = new THREE.Vector3().crossVectors(e1, e2).normalize();
  if (normal.dot(d) < 0) normal.negate();

  return { point: p0, normal };
}

function orientBasisToNormal(THREE, normal, upHint) {
  const zAxis = normal.clone().normalize();
  const up = (upHint || new THREE.Vector3(0, 1, 0)).clone();
  const xAxis = new THREE.Vector3().crossVectors(up, zAxis);
  if (xAxis.lengthSq() < 1e-6) xAxis.set(1, 0, 0);
  xAxis.normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
  const m = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

// Sculpted continuous sitting body (y = 0 on floor up to y = 0.188 embedded in head)
function buildBodyGeometry(THREE) {
  const geo = new THREE.SphereGeometry(1, 56, 38);
  geo.rotateY(-Math.PI / 2);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    const h = (ny + 1) * 0.5; // 0 bottom, 1 top of neck
    let y = Math.pow(h, 0.92) * 0.186;

    // Flatten grounded sitting underside cleanly onto y = 0
    if (ny < -0.58) {
      const flat = smoothstep(-0.58, -0.96, ny);
      y *= (1.0 - 0.88 * flat);
    }

    // Pear-shaped sitting silhouette: lush haunches, graceful waist, proud chest, neck column
    const haunchW = 0.064 * Math.exp(-Math.pow((h - 0.24) / 0.28, 2));
    const chestW = 0.045 * Math.exp(-Math.pow((h - 0.62) / 0.25, 2));
    const neckW = 0.030 * smoothstep(0.72, 0.98, h);
    const rx = Math.max(0.024, haunchW + chestW * 0.62 + neckW * 0.45);

    const rumpD = 0.072 * Math.exp(-Math.pow((h - 0.26) / 0.30, 2));
    const chestD = 0.056 * Math.exp(-Math.pow((h - 0.64) / 0.26, 2));
    const neckD = 0.031 * smoothstep(0.72, 0.98, h);
    const rz = Math.max(0.025, rumpD + chestD * 0.55 + neckD * 0.42);

    // Subtle S-curve sitting posture leaning gracefully forward
    const spineShiftZ = 0.028 * Math.pow(h, 1.35) - 0.008 * Math.sin(h * Math.PI);

    // Sculpted back-rump fullness and proud chest curve
    const backRump = Math.max(0, -nz) * Math.exp(-Math.pow((h - 0.26) / 0.24, 2)) * 0.014;
    const chestPuff = Math.max(0, nz) * Math.exp(-Math.pow((h - 0.58) / 0.24, 2)) * 0.012;
    const shoulderPinch = 1.0 - 0.08 * Math.exp(-Math.pow((h - 0.82) / 0.14, 2));

    let x = nx * rx * shoulderPinch;
    let z = nz * rz + spineShiftZ - backRump + chestPuff;

    // Gentle spine furrow along upper back
    if (nz < -0.25 && h > 0.35 && h < 0.88) {
      const spineFurrow = Math.exp(-Math.pow(nx / 0.18, 2)) * (-nz - 0.25);
      z += 0.003 * spineFurrow;
    }

    pos.setXYZ(i, x, Math.max(0.0005, y), z);
  }

  geo.computeVertexNormals();
  return geo;
}

// Sculpted plush chest ruff collar with scalloped fur tufts
function buildChestRuffGeometry(THREE) {
  const geo = new THREE.SphereGeometry(1, 44, 28);
  geo.rotateY(-Math.PI / 2);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    const angle = Math.atan2(nx, nz); // 0 is front (+z)
    const frontFactor = 0.42 + 0.58 * Math.max(0, Math.cos(angle * 0.72));

    let x = nx * 0.056 * (0.85 + 0.22 * frontFactor);
    let y = ny * 0.044 * (0.65 + 0.55 * frontFactor);
    let z = nz * 0.048 * (0.72 + 0.45 * frontFactor);

    // Drooping pointed fur-tuft scallops along lower front bib
    const lowerMask = smoothstep(0.15, -0.75, ny) * smoothstep(-0.3, 0.85, nz);
    const scallop = 0.5 + 0.5 * Math.cos(angle * 7.0);
    const centralDrop = Math.exp(-Math.pow(angle / 0.55, 2));
    y -= (0.016 * centralDrop + 0.010 * scallop) * lowerMask;
    z += (0.011 * centralDrop + 0.006 * scallop) * lowerMask;

    // Slight fluffy ridge waves around sides of collar
    const sideWave = Math.sin(angle * 9.0 + ny * 4.0) * 0.0024 * (1.0 - Math.abs(ny));
    x += nx * sideWave;
    z += nz * sideWave;

    // Tuck upper back cleanly into the neck
    const backTuck = smoothstep(0.0, -0.85, nz);
    z += 0.014 * backTuck;
    y += 0.008 * backTuck;

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

// Sculpted fox ear using ExtrudeGeometry + bezierCurveTo + 3D vertex bending
function buildFoxEarGroup(THREE, side, outerMat, innerMat, tuftMat) {
  const group = new THREE.Group();
  group.name = side > 0 ? 'earL' : 'earR';

  // Outer ear shape (tall expressive kitsune ear)
  const outerShape = new THREE.Shape();
  outerShape.moveTo(-0.022, 0.0);
  outerShape.bezierCurveTo(-0.029, 0.024, -0.022, 0.062, 0.001, 0.092);
  outerShape.bezierCurveTo(0.016, 0.064, 0.028, 0.032, 0.025, 0.012);
  // Subtle cute fox ear outer-rim notch
  outerShape.bezierCurveTo(0.026, 0.006, 0.021, 0.002, 0.020, 0.0);
  outerShape.bezierCurveTo(0.008, -0.006, -0.008, -0.006, -0.022, 0.0);

  const outerGeo = new THREE.ExtrudeGeometry(outerShape, {
    depth: 0.0075,
    bevelEnabled: true,
    bevelThickness: 0.0032,
    bevelSize: 0.0026,
    bevelSegments: 4,
    curveSegments: 24
  });

  bendEarGeometry(outerGeo, side, 0.0);
  const outerMesh = new THREE.Mesh(outerGeo, outerMat);
  outerMesh.castShadow = true;
  outerMesh.receiveShadow = true;
  outerMesh.userData.slot = 'fur';
  group.add(outerMesh);

  // Inner velvety ear membrane
  const innerShape = new THREE.Shape();
  innerShape.moveTo(-0.014, 0.006);
  innerShape.bezierCurveTo(-0.019, 0.026, -0.014, 0.055, 0.0005, 0.075);
  innerShape.bezierCurveTo(0.011, 0.055, 0.017, 0.030, 0.015, 0.010);
  innerShape.bezierCurveTo(0.006, 0.004, -0.006, 0.004, -0.014, 0.006);

  const innerGeo = new THREE.ExtrudeGeometry(innerShape, {
    depth: 0.0026,
    bevelEnabled: true,
    bevelThickness: 0.0012,
    bevelSize: 0.0012,
    bevelSegments: 2,
    curveSegments: 18
  });

  bendEarGeometry(innerGeo, side, 0.0036);
  const innerMesh = new THREE.Mesh(innerGeo, innerMat);
  innerMesh.receiveShadow = true;
  innerMesh.userData.slot = 'skin';
  group.add(innerMesh);

  // Fluffy inner-ear hair tufts curving across the ear opening
  for (let k = 0; k < 3; k++) {
    const yBase = 0.012 + k * 0.009;
    const len = 0.022 - k * 0.003;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-side * 0.015, yBase, 0.003),
      new THREE.Vector3(-side * 0.003, yBase + 0.004, 0.0075),
      new THREE.Vector3(side * (len - 0.008), yBase + 0.007 + k * 0.002, 0.0055)
    ]);
    const tuftGeo = buildTaperedTube(
      THREE,
      curve,
      8,
      12,
      (u) => 0.0034 * Math.sin(u * Math.PI * 0.85 + 0.15) * (1 - 0.72 * u)
    );
    const tuftMesh = new THREE.Mesh(tuftGeo, tuftMat);
    tuftMesh.userData.slot = 'furAccent';
    group.add(tuftMesh);
  }

  return group;
}

function bendEarGeometry(geo, side, zOffset) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const hMax = 0.095;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i) * side; // mirror cleanly for left/right ear
    let y = pos.getY(i);
    let z = pos.getZ(i) - 0.00375;

    const yn = clamp(y / hMax, 0, 1);
    const xn = clamp(x / 0.028, -1, 1);

    // Taper thickness smoothly toward delicate ear tip
    z *= (1.0 - 0.58 * Math.pow(yn, 1.3));

    // Cup ear horizontally (concave front +z, rounded convex back -z)
    const cup = (1.0 - xn * xn) * (1.0 - 0.45 * yn) * 0.0105;
    z -= cup;

    // Gentle backward sweep and outward fox-tip flick
    z -= 0.013 * Math.pow(yn, 1.85);
    x += side * 0.006 * Math.pow(yn, 2.0);

    // Slight forward shift for inner ear layer
    z += zOffset * (1.0 - 0.35 * yn);

    pos.setXYZ(i, x, y, z);
    uv.setXY(i, clamp((x * side) / 0.056 + 0.5, 0, 1), yn);
  }

  // Flip winding if mirrored (side < 0)
  if (side < 0 && geo.index) {
    const idx = geo.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const tmp = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = tmp;
    }
    geo.index.needsUpdate = true;
  } else if (side < 0) {
    // Non-indexed ExtrudeGeometry: swap vertex 1 and 2 of each triangle
    const norm = geo.attributes.normal;
    for (let i = 0; i < pos.count; i += 3) {
      for (const attr of [pos, uv, norm]) {
        if (!attr) continue;
        const itemSize = attr.itemSize;
        for (let c = 0; c < itemSize; c++) {
          const i1 = (i + 1) * itemSize + c;
          const i2 = (i + 2) * itemSize + c;
          const tmp = attr.array[i1];
          attr.array[i1] = attr.array[i2];
          attr.array[i2] = tmp;
        }
      }
    }
  }

  geo.computeVertexNormals();
}

// 3-layer glossy expressive fox eye group
function buildEyeGroup(THREE, side, mats) {
  const g = new THREE.Group();
  g.name = side > 0 ? 'eyeL' : 'eyeR';

  // Layer 1: Dark glossy eye dome
  const baseGeo = new THREE.SphereGeometry(1, 24, 18);
  baseGeo.scale(0.0108, 0.0124, 0.0064);
  const baseMesh = new THREE.Mesh(baseGeo, mats.eyeBase);
  baseMesh.userData.slot = 'eye';
  g.add(baseMesh);

  // Layer 2: Coloured painted iris ring dome sitting right on front cornea
  const irisGeo = new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.44);
  irisGeo.rotateX(Math.PI / 2); // pole points +z
  irisGeo.scale(0.0096, 0.0110, 0.0066);
  // Map frontal planar UVs cleanly onto the iris cap
  const ipos = irisGeo.attributes.position;
  const iuv = irisGeo.attributes.uv;
  for (let i = 0; i < ipos.count; i++) {
    const ix = ipos.getX(i) / 0.0096;
    const iy = ipos.getY(i) / 0.0110;
    iuv.setXY(i, ix * 0.5 + 0.5, iy * 0.5 + 0.5);
  }
  const irisMesh = new THREE.Mesh(irisGeo, mats.eyeIris);
  irisMesh.position.z = 0.0004;
  irisMesh.userData.slot = 'eye';
  g.add(irisMesh);

  // Layer 3: Two crisp white highlight dots placed up and to one side (light from upper-right)
  const hiBigGeo = new THREE.SphereGeometry(0.0026, 12, 10);
  hiBigGeo.scale(1.0, 1.15, 0.45);
  const hiBig = new THREE.Mesh(hiBigGeo, mats.eyeHighlight);
  hiBig.position.set(0.0036, 0.0044, 0.0062);
  hiBig.userData.slot = 'eye';
  g.add(hiBig);

  const hiSmallGeo = new THREE.SphereGeometry(0.00125, 10, 8);
  hiSmallGeo.scale(1.0, 1.0, 0.45);
  const hiSmall = new THREE.Mesh(hiSmallGeo, mats.eyeHighlight);
  hiSmall.position.set(-0.0030, -0.0034, 0.0063);
  hiSmall.userData.slot = 'eye';
  g.add(hiSmall);

  // Expressive upper fox eyelash / eyeliner wing curving over eye top
  const lashPts = [
    new THREE.Vector3(-side * 0.0098, 0.0038, 0.0036),
    new THREE.Vector3(-side * 0.0038, 0.0112, 0.0042),
    new THREE.Vector3(side * 0.0052, 0.0108, 0.0040),
    new THREE.Vector3(side * 0.0112, 0.0062, 0.0026),
    new THREE.Vector3(side * 0.0148, 0.0080, 0.0008)
  ];
  const lashCurve = new THREE.CatmullRomCurve3(lashPts);
  const lashGeo = buildTaperedTube(
    THREE,
    lashCurve,
    8,
    18,
    (u) => 0.00175 * Math.sin(u * Math.PI * 0.85 + 0.12) * (1.0 - 0.35 * u)
  );
  const lashMesh = new THREE.Mesh(lashGeo, mats.liner);
  lashMesh.userData.slot = 'accent';
  g.add(lashMesh);

  return g;
}

// Surface-conformed subtle cheek blush patch (zero z-fighting, zero floating)
function buildBlushDisc(THREE, side, blushMat) {
  const segR = 14;
  const segA = 16;
  const centerDir = new THREE.Vector3(side * 0.56, -0.17, 0.81).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const tX = new THREE.Vector3().crossVectors(up, centerDir).normalize();
  const tY = new THREE.Vector3().crossVectors(centerDir, tX).normalize();

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let ir = 0; ir <= segR; ir++) {
    const r = ir / segR;
    for (let ia = 0; ia <= segA; ia++) {
      const a = (ia / segA) * Math.PI * 2;
      const dx = Math.cos(a) * r * 0.17;
      const dy = Math.sin(a) * r * 0.115;
      const d = centerDir.clone().addScaledVector(tX, dx).addScaledVector(tY, dy).normalize();
      const s = sampleHeadSurface(THREE, d);
      const p = s.point.addScaledVector(s.normal, 0.0009);
      positions.push(p.x, p.y, p.z);
      uvs.push(0.5 + Math.cos(a) * r * 0.5, 0.5 + Math.sin(a) * r * 0.5);
    }
  }

  const stride = segA + 1;
  for (let ir = 0; ir < segR; ir++) {
    for (let ia = 0; ia < segA; ia++) {
      const a = ir * stride + ia;
      const b = ir * stride + ia + 1;
      const c = (ir + 1) * stride + ia;
      const d = (ir + 1) * stride + ia + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, blushMat);
  mesh.userData.slot = 'skin';
  return mesh;
}

// Sculpted cute heart-shaped fox nose
function buildNoseMesh(THREE, noseMat) {
  const geo = new THREE.SphereGeometry(1, 24, 16);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    // Wider at top, softly pointed downward like a tiny fox nose
    const wScale = 0.0072 * (1.0 + 0.24 * ny - 0.14 * Math.max(0, -ny));
    let x = nx * wScale;
    let y = ny * 0.0052;
    let z = nz * 0.0046;

    // Gentle top cleft + tiny nostril dimples
    const topCleft = Math.exp(-Math.pow(nx / 0.24, 2)) * Math.max(0, ny);
    y -= 0.0008 * topCleft;

    const nostril = Math.exp(-Math.pow((Math.abs(nx) - 0.45) / 0.20, 2))
      * Math.exp(-Math.pow((ny + 0.15) / 0.28, 2))
      * Math.max(0, nz);
    z -= 0.0009 * nostril;

    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, noseMat);
  mesh.userData.slot = 'accent';
  return mesh;
}

// Sculpted fox paw (flat-bottomed for floor contact, or softly curled when raised)
function buildPawMesh(THREE, mat, scale, flatBottom) {
  const geo = new THREE.SphereGeometry(1, 24, 16);
  geo.rotateY(-Math.PI / 2);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    let x = nx * 0.0155 * scale;
    let y = ny * 0.0115 * scale;
    let z = nz * 0.0205 * scale;

    // Slightly wider at the toes (+z)
    x *= 1.0 + 0.14 * Math.max(0, nz);

    // Three gentle toe-groove indentations on front of paw
    if (nz > 0.25) {
      const toeZone = smoothstep(0.25, 0.85, nz) * Math.exp(-Math.pow(ny / 0.65, 2));
      const groove = Math.exp(-Math.pow((Math.abs(nx) - 0.28) / 0.12, 2));
      z -= 0.0022 * scale * toeZone * groove;
      y -= 0.0008 * scale * toeZone * groove;
    }

    if (flatBottom && ny < -0.25) {
      const flat = smoothstep(-0.25, -0.88, ny);
      y = y * (1.0 - 0.62 * flat) - 0.0038 * scale * flat;
    }

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.slot = 'fur';
  return mesh;
}

// Sculpted seated hind leg (haunch + tucked hind paw)
function buildHindLegGroup(THREE, side, furMat, pawMat) {
  const group = new THREE.Group();
  group.name = side > 0 ? 'legL' : 'legR';

  // Continuous sculpted seated haunch deeply overlapping body flanks
  const thighGeo = new THREE.SphereGeometry(1, 32, 24);
  thighGeo.rotateY(-Math.PI / 2);
  const pos = thighGeo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    let x = nx * 0.036;
    let y = ny * 0.044;
    let z = nz * 0.052;

    // Tear-drop seated thigh fuller at bottom-back, tapered upward
    const low = smoothstep(0.4, -0.7, ny);
    x *= 0.84 + 0.26 * low;
    z += 0.008 * low * Math.sign(nz);

    // Flatten floor contact cleanly
    if (ny < -0.42) {
      const flat = smoothstep(-0.42, -0.92, ny);
      y = y * (1.0 - 0.52 * flat) - 0.009 * flat;
    }

    pos.setXYZ(i, x, y, z);
  }
  thighGeo.computeVertexNormals();

  const thighMesh = new THREE.Mesh(thighGeo, furMat);
  thighMesh.position.set(side * 0.042, 0.036, -0.008);
  thighMesh.rotation.y = side * 0.22;
  thighMesh.rotation.z = -side * 0.12;
  thighMesh.castShadow = true;
  thighMesh.receiveShadow = true;
  thighMesh.userData.slot = 'fur';
  group.add(thighMesh);

  // Tucked hind paw resting squarely on y = 0
  const paw = buildPawMesh(THREE, pawMat, 1.06, true);
  paw.position.set(side * 0.054, 0.0112, 0.054);
  paw.rotation.y = side * 0.34;
  group.add(paw);

  return group;
}

// Sculpted forelegs: armL planted on floor, armR charmingly lifted near chest
function buildForelegGroups(THREE, pawMat, padMat) {
  // Left foreleg (fox's left, +x): planted gently supporting weight
  const armL = new THREE.Group();
  armL.name = 'armL';
  const curveL = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.028, 0.122, 0.048),
    new THREE.Vector3(0.036, 0.088, 0.078),
    new THREE.Vector3(0.034, 0.048, 0.098),
    new THREE.Vector3(0.032, 0.014, 0.110)
  ]);
  const geoL = buildTaperedTube(
    THREE,
    curveL,
    18,
    24,
    (u) => {
      const shoulder = 0.022 * Math.exp(-Math.pow(u / 0.32, 2));
      const limb = 0.0145 * (1.0 - 0.28 * u) + 0.003 * Math.exp(-Math.pow((u - 0.95) / 0.16, 2));
      return (limb + shoulder * 0.45) * smoothstep(0.0, 0.08, u);
    }
  );
  const meshL = new THREE.Mesh(geoL, pawMat);
  meshL.castShadow = true;
  meshL.receiveShadow = true;
  meshL.userData.slot = 'fur';
  armL.add(meshL);

  const pawL = buildPawMesh(THREE, pawMat, 0.96, true);
  pawL.position.set(0.032, 0.0102, 0.122);
  pawL.rotation.y = 0.10;
  armL.add(pawL);

  // Right foreleg (fox's right, -x): lifted in a cozy curious pose!
  const armR = new THREE.Group();
  armR.name = 'armR';
  armR.position.set(-0.028, 0.118, 0.048); // pivot at shoulder for breathing bob

  const curveR = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 0.0, 0.0),
    new THREE.Vector3(-0.012, -0.028, 0.026),
    new THREE.Vector3(-0.014, -0.036, 0.062),
    new THREE.Vector3(-0.008, -0.022, 0.086)
  ]);
  const geoR = buildTaperedTube(
    THREE,
    curveR,
    18,
    24,
    (u) => {
      const shoulder = 0.020 * Math.exp(-Math.pow(u / 0.30, 2));
      const limb = 0.014 * (1.0 - 0.25 * u);
      return (limb + shoulder * 0.45) * smoothstep(0.0, 0.08, u);
    }
  );
  const meshR = new THREE.Mesh(geoR, pawMat);
  meshR.castShadow = true;
  meshR.receiveShadow = true;
  meshR.userData.slot = 'fur';
  armR.add(meshR);

  const pawR = buildPawMesh(THREE, pawMat, 0.92, false);
  pawR.position.set(-0.006, -0.024, 0.094);
  pawR.rotation.set(0.55, 0.32, -0.25);
  armR.add(pawR);

  // Tiny cute toe beans on the raised paw underside
  const mainPad = new THREE.Mesh(new THREE.SphereGeometry(0.0046, 10, 8), padMat);
  mainPad.scale.set(1.1, 0.45, 1.0);
  mainPad.position.set(0, -0.0085, 0.001);
  mainPad.userData.slot = 'skin';
  pawR.add(mainPad);

  for (let t = -1; t <= 1; t++) {
    const toePad = new THREE.Mesh(new THREE.SphereGeometry(0.0023, 8, 6), padMat);
    toePad.scale.set(0.95, 0.45, 1.15);
    toePad.position.set(t * 0.0052, -0.0076, 0.0095 - Math.abs(t) * 0.0016);
    toePad.userData.slot = 'skin';
    pawR.add(toePad);
  }

  return { armL, armR };
}

// Nine full brush tails fanned behind like a peacock
function buildNineTails(THREE, tailMat) {
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tail';
  const tailPivots = [];

  // 9 choreographed 3D brush curves: [rootX, rootY, rootZ], thickness scale, control points (relative to root)
  const specs = [
    // 0: Lowest left (fox's right, -x) sweeping cozily forward along floor
    {
      root: [-0.024, 0.044, -0.030],
      thick: 0.90,
      pts: [
        [0.0, 0.0, 0.0],
        [-0.062, -0.004, -0.045],
        [-0.132, -0.006, -0.025],
        [-0.158, -0.002, 0.036],
        [-0.128, 0.016, 0.082],
        [-0.104, 0.040, 0.095]
      ]
    },
    // 1: Lower-mid outer left (-x) wide lush sweep
    {
      root: [-0.024, 0.052, -0.040],
      thick: 0.98,
      pts: [
        [0.0, 0.0, 0.0],
        [-0.066, 0.016, -0.055],
        [-0.138, 0.052, -0.088],
        [-0.178, 0.106, -0.092],
        [-0.162, 0.158, -0.068]
      ]
    },
    // 2: Mid-upper left (-x)
    {
      root: [-0.018, 0.058, -0.045],
      thick: 1.04,
      pts: [
        [0.0, 0.0, 0.0],
        [-0.050, 0.046, -0.065],
        [-0.105, 0.125, -0.115],
        [-0.136, 0.195, -0.118],
        [-0.118, 0.238, -0.088]
      ]
    },
    // 3: Inner-upper left (-x)
    {
      root: [-0.010, 0.064, -0.046],
      thick: 1.08,
      pts: [
        [0.0, 0.0, 0.0],
        [-0.028, 0.068, -0.068],
        [-0.058, 0.165, -0.122],
        [-0.075, 0.242, -0.126],
        [-0.060, 0.282, -0.092]
      ]
    },
    // 4: Hero centre crown tail
    {
      root: [0.0, 0.068, -0.044],
      thick: 1.12,
      pts: [
        [0.0, 0.0, 0.0],
        [0.002, 0.076, -0.062],
        [0.006, 0.185, -0.114],
        [0.010, 0.264, -0.112],
        [0.018, 0.292, -0.072]
      ]
    },
    // 5: Inner-upper right (+x)
    {
      root: [0.010, 0.064, -0.046],
      thick: 1.08,
      pts: [
        [0.0, 0.0, 0.0],
        [0.028, 0.066, -0.068],
        [0.060, 0.160, -0.124],
        [0.078, 0.236, -0.128],
        [0.064, 0.278, -0.094]
      ]
    },
    // 6: Mid-upper right (+x)
    {
      root: [0.018, 0.058, -0.045],
      thick: 1.04,
      pts: [
        [0.0, 0.0, 0.0],
        [0.052, 0.044, -0.066],
        [0.108, 0.120, -0.116],
        [0.140, 0.190, -0.118],
        [0.122, 0.232, -0.086]
      ]
    },
    // 7: Lower-mid outer right (+x)
    {
      root: [0.024, 0.052, -0.040],
      thick: 0.98,
      pts: [
        [0.0, 0.0, 0.0],
        [0.068, 0.015, -0.054],
        [0.142, 0.050, -0.086],
        [0.180, 0.102, -0.088],
        [0.166, 0.152, -0.062]
      ]
    },
    // 8: Lowest right (+x) gentle asymmetric flare
    {
      root: [0.024, 0.044, -0.030],
      thick: 0.92,
      pts: [
        [0.0, 0.0, 0.0],
        [0.066, -0.002, -0.046],
        [0.138, 0.002, -0.034],
        [0.168, 0.020, 0.018],
        [0.148, 0.056, 0.058]
      ]
    }
  ];

  specs.forEach((spec, idx) => {
    const pivot = new THREE.Group();
    pivot.name = `tail_${idx}`;
    pivot.position.set(spec.root[0], spec.root[1], spec.root[2]);

    const curve = new THREE.CatmullRomCurve3(
      spec.pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]))
    );

    const phaseOffset = idx * 1.17;
    const geo = buildTaperedTube(
      THREE,
      curve,
      22,
      40,
      (u, theta) => {
        // Lush sculpted fox brush profile: snug root -> plump mid-upper brush -> tapered tip
        const rootRamp = smoothstep(0.0, 0.16, u);
        const belly = Math.pow(Math.sin(Math.pow(u, 0.78) * Math.PI), 0.78);
        const baseR = (0.0085 * (1.0 - u) + 0.0315 * belly * (0.35 + 0.65 * rootRamp)) * spec.thick;
        // Organic sculpted fur-lock fluting along the brush
        const flute = 1.0 + 0.055 * Math.sin(theta * 5.0 + u * 5.2 + phaseOffset) * Math.sin(u * Math.PI);
        // Clean smooth tip close
        const tipCap = smoothstep(1.0, 0.94, u);
        return Math.max(0.0003, baseR * flute * (0.04 + 0.96 * tipCap));
      },
      (u) => ({
        // Subtle organic ovality
        sx: 1.0 + 0.06 * Math.sin(u * Math.PI),
        sy: 1.0 - 0.04 * Math.sin(u * Math.PI)
      })
    );

    const mesh = new THREE.Mesh(geo, tailMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.slot = 'fur';
    pivot.add(mesh);

    tailGroup.add(pivot);
    tailPivots.push(pivot);
  });

  tailGroup.userData.tailPivots = tailPivots;
  return tailGroup;
}

// Cozy shrine neck cord + LatheGeometry (>= 20 points) golden suzu bell + side ribbon bow
function buildShrineCollar(THREE, cordMat, metalMat) {
  const collarGroup = new THREE.Group();
  collarGroup.name = 'collar';

  // Snug braided neck cord wrapping around the throat above chest ruff
  const cordPts = [];
  const segs = 20;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const x = Math.sin(a) * 0.043;
    const z = Math.cos(a) * 0.044 + 0.036;
    const y = 0.152 - 0.011 * Math.cos(a);
    cordPts.push(new THREE.Vector3(x, y, z));
  }
  const cordCurve = new THREE.CatmullRomCurve3(cordPts, true);
  const cordGeo = buildTaperedTube(
    THREE,
    cordCurve,
    10,
    36,
    (u, theta) => 0.0038 * (1.0 + 0.14 * Math.sin(u * Math.PI * 26 + theta * 2))
  );
  const cordMesh = new THREE.Mesh(cordGeo, cordMat);
  cordMesh.castShadow = true;
  cordMesh.userData.slot = 'accent';
  collarGroup.add(cordMesh);

  // Golden Japanese suzu bell crafted with LatheGeometry (22 profile points)
  const bellProfile = [
    new THREE.Vector2(0.0003, -0.0096),
    new THREE.Vector2(0.0022, -0.0094),
    new THREE.Vector2(0.0046, -0.0086),
    new THREE.Vector2(0.0068, -0.0072),
    new THREE.Vector2(0.0084, -0.0052),
    new THREE.Vector2(0.0093, -0.0028),
    new THREE.Vector2(0.0095, -0.0012),
    new THREE.Vector2(0.0103, -0.0007), // equatorial raised ridge
    new THREE.Vector2(0.0104, 0.0000),
    new THREE.Vector2(0.0103, 0.0007),
    new THREE.Vector2(0.0095, 0.0012),
    new THREE.Vector2(0.0092, 0.0030),
    new THREE.Vector2(0.0082, 0.0053),
    new THREE.Vector2(0.0066, 0.0072),
    new THREE.Vector2(0.0046, 0.0086),
    new THREE.Vector2(0.0028, 0.0094),
    new THREE.Vector2(0.0024, 0.0104), // top crown neck
    new THREE.Vector2(0.0033, 0.0114), // suspension eyelet cap
    new THREE.Vector2(0.0032, 0.0124),
    new THREE.Vector2(0.0021, 0.0132),
    new THREE.Vector2(0.0010, 0.0135),
    new THREE.Vector2(0.0002, 0.0135)
  ];
  const bellGeo = new THREE.LatheGeometry(bellProfile, 28);
  const bellPivot = new THREE.Group();
  bellPivot.name = 'bell';
  bellPivot.position.set(0.0, 0.139, 0.082);

  const bellMesh = new THREE.Mesh(bellGeo, metalMat);
  bellMesh.position.y = -0.011;
  bellMesh.castShadow = true;
  bellMesh.userData.slot = 'accent';
  bellPivot.add(bellMesh);

  // Subtle dark slit accent across lower bell bowl
  const slitGeo = new THREE.SphereGeometry(0.0016, 8, 6);
  slitGeo.scale(2.8, 0.55, 0.7);
  const slitMesh = new THREE.Mesh(
    slitGeo,
    new THREE.MeshPhysicalMaterial({ color: '#2b1b0e', roughness: 0.65 })
  );
  slitMesh.position.set(0, -0.0195, 0.0042);
  slitMesh.userData.slot = 'accent';
  bellPivot.add(slitMesh);

  collarGroup.add(bellPivot);
  collarGroup.userData.bellPivot = bellPivot;

  // Delicate curved side ribbon bow loops using ExtrudeGeometry + bezierCurveTo
  const loopShape = new THREE.Shape();
  loopShape.moveTo(0, 0);
  loopShape.bezierCurveTo(0.008, 0.010, 0.022, 0.010, 0.023, 0.001);
  loopShape.bezierCurveTo(0.022, -0.008, 0.008, -0.007, 0, 0);

  const loopGeo = new THREE.ExtrudeGeometry(loopShape, {
    depth: 0.0024,
    bevelEnabled: true,
    bevelThickness: 0.0008,
    bevelSize: 0.0007,
    bevelSegments: 2,
    curveSegments: 14
  });
  // Bend ribbon loop slightly outward
  const lpos = loopGeo.attributes.position;
  for (let i = 0; i < lpos.count; i++) {
    const lx = lpos.getX(i);
    const lz = lpos.getZ(i);
    lpos.setZ(i, lz - 0.006 * Math.sin(clamp(lx / 0.023, 0, 1) * Math.PI));
  }
  loopGeo.computeVertexNormals();

  const bowGroup = new THREE.Group();
  bowGroup.position.set(0.036, 0.149, 0.056);
  bowGroup.rotation.set(0.15, 0.75, -0.25);

  const loopA = new THREE.Mesh(loopGeo, cordMat);
  loopA.rotation.z = 0.22;
  loopA.userData.slot = 'accent';
  bowGroup.add(loopA);

  const loopB = new THREE.Mesh(loopGeo, cordMat);
  loopB.rotation.y = Math.PI;
  loopB.rotation.z = 0.22;
  loopB.userData.slot = 'accent';
  bowGroup.add(loopB);

  const knotMesh = new THREE.Mesh(new THREE.SphereGeometry(0.0044, 12, 10), cordMat);
  knotMesh.userData.slot = 'accent';
  bowGroup.add(knotMesh);

  collarGroup.add(bowGroup);
  return collarGroup;
}

// --- Procedural Canvas Textures (painted via kit.canvasTexture & kit.noise) ---

function createFurBumpTexture(THREE, kit, size, streakLen) {
  const tex = kit.canvasTexture(size, size, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);

    // Subtle periodic value-noise under-layer
    const step = 4;
    for (let y = 0; y < h; y += step) {
      const v = y / h;
      for (let x = 0; x < w; x += step) {
        const u = x / w;
        const a = u * Math.PI * 2;
        const n = kit.noise(Math.cos(a) * 4.5 + 10.2, Math.sin(a) * 4.5 + v * 9.0 + 3.1);
        const g = Math.round(110 + n * 38);
        ctx.fillStyle = `rgb(${g},${g},${g})`;
        ctx.fillRect(x, y, step, step);
      }
    }

    // Fine brushed fur strands
    ctx.lineWidth = 1.2;
    const count = Math.floor((w * h) / 60);
    for (let i = 0; i < count; i++) {
      const u = kit.noise(i * 0.173, 4.71);
      const v = kit.noise(9.31, i * 0.211);
      const x = u * w;
      const y = v * h;
      const bright = kit.noise(i * 0.37, 1.9) > 0.5 ? 195 : 75;
      ctx.strokeStyle = `rgba(${bright},${bright},${bright},0.22)`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (kit.noise(i * 0.51, 2.2) - 0.5) * 3.0, y + streakLen);
      ctx.stroke();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createHeadTexture(THREE, kit, pal) {
  const tex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    // Base fur coat
    ctx.fillStyle = colHex(pal.fur);
    ctx.fillRect(0, 0, w, h);

    // Subtle dorsal crown & muzzle-bridge warm shading (cy = 0 top, cx = w/2 front +z)
    const crownGrad = ctx.createRadialGradient(w * 0.5, h * 0.24, w * 0.04, w * 0.5, h * 0.30, w * 0.48);
    crownGrad.addColorStop(0, colRgba(pal.furShade, 0.32));
    crownGrad.addColorStop(0.55, colRgba(pal.fur, 0.0));
    crownGrad.addColorStop(1, colRgba(pal.fur, 0.0));
    ctx.fillStyle = crownGrad;
    ctx.fillRect(0, 0, w, h);

    // Classic stylised fox lower-cheek & muzzle cream furAccent mask
    ctx.save();
    ctx.fillStyle = colHex(pal.furAccent);
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.68);
    ctx.bezierCurveTo(w * 0.14, h * 0.66, w * 0.26, h * 0.56, w * 0.36, h * 0.58);
    ctx.bezierCurveTo(w * 0.44, h * 0.60, w * 0.46, h * 0.58, w * 0.50, h * 0.59);
    ctx.bezierCurveTo(w * 0.54, h * 0.58, w * 0.56, h * 0.60, w * 0.64, h * 0.58);
    ctx.bezierCurveTo(w * 0.74, h * 0.56, w * 0.86, h * 0.66, w, h * 0.68);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.filter = 'blur(8px)';
    ctx.fill();
    ctx.restore();

    // Soften back-of-head cream so neck back stays fur coloured
    const backGradL = ctx.createLinearGradient(0, 0, w * 0.22, 0);
    backGradL.addColorStop(0, colRgba(pal.fur, 0.92));
    backGradL.addColorStop(1, colRgba(pal.fur, 0.0));
    ctx.fillStyle = backGradL;
    ctx.fillRect(0, h * 0.45, w * 0.24, h * 0.55);

    const backGradR = ctx.createLinearGradient(w, 0, w * 0.78, 0);
    backGradR.addColorStop(0, colRgba(pal.fur, 0.92));
    backGradR.addColorStop(1, colRgba(pal.fur, 0.0));
    ctx.fillStyle = backGradR;
    ctx.fillRect(w * 0.76, h * 0.45, w * 0.24, h * 0.55);

    // Subtle nose-bridge soft shading
    const bridgeGrad = ctx.createRadialGradient(w * 0.5, h * 0.52, 4, w * 0.5, h * 0.51, 36);
    bridgeGrad.addColorStop(0, colRgba(pal.furShade, 0.22));
    bridgeGrad.addColorStop(1, colRgba(pal.furShade, 0.0));
    ctx.fillStyle = bridgeGrad;
    ctx.fillRect(w * 0.35, h * 0.38, w * 0.30, h * 0.26);

    // Cute soft kitsune brow dots (vermilion on Snow Inari, warm cream on Red/Gold)
    const browCol = pal.variant === 0 ? pal.tipTint : pal.furAccent;
    for (const s of [-1, 1]) {
      const bx = w * (0.5 + s * 0.068);
      const by = h * 0.365;
      const bg = ctx.createRadialGradient(bx, by, 1.5, bx, by, 13);
      bg.addColorStop(0, colRgba(browCol, 0.72));
      bg.addColorStop(0.65, colRgba(browCol, 0.28));
      bg.addColorStop(1, colRgba(browCol, 0.0));
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.ellipse(bx, by, 13, 8, s * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fine directional fur flecks painted with kit.noise
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 2400; i++) {
      const u = kit.noise(i * 0.193, 2.13);
      const v = kit.noise(7.41, i * 0.137);
      const x = u * w;
      const y = v * h;
      const isLight = kit.noise(i * 0.41, 8.2) > 0.48;
      ctx.strokeStyle = isLight ? colRgba(pal.furAccent, 0.16) : colRgba(pal.furShade, 0.12);
      ctx.beginPath();
      ctx.moveTo(x, y);
      const dx = (u - 0.5) * 6.0;
      ctx.lineTo(x + dx, y + 6.5);
      ctx.stroke();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createBodyTexture(THREE, kit, pal) {
  const tex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = colHex(pal.fur);
    ctx.fillRect(0, 0, w, h);

    // Richer warm dorsal coat along back (edges u = 0 / 1)
    const backL = ctx.createLinearGradient(0, 0, w * 0.36, 0);
    backL.addColorStop(0, colRgba(pal.furShade, 0.34));
    backL.addColorStop(1, colRgba(pal.furShade, 0.0));
    ctx.fillStyle = backL;
    ctx.fillRect(0, 0, w * 0.38, h);

    const backR = ctx.createLinearGradient(w, 0, w * 0.64, 0);
    backR.addColorStop(0, colRgba(pal.furShade, 0.34));
    backR.addColorStop(1, colRgba(pal.furShade, 0.0));
    ctx.fillStyle = backR;
    ctx.fillRect(w * 0.62, 0, w * 0.38, h);

    // Soft lighter belly/chest furAccent down front centre (u = 0.5)
    const bellyGrad = ctx.createRadialGradient(w * 0.5, h * 0.52, w * 0.03, w * 0.5, h * 0.54, w * 0.23);
    bellyGrad.addColorStop(0, colRgba(pal.furAccent, 0.94));
    bellyGrad.addColorStop(0.65, colRgba(pal.furAccent, 0.65));
    bellyGrad.addColorStop(1, colRgba(pal.furAccent, 0.0));
    ctx.fillStyle = bellyGrad;
    ctx.fillRect(w * 0.24, h * 0.14, w * 0.52, h * 0.78);

    // Cozy floor-contact grounding AO along very bottom (cy near h)
    const aoGrad = ctx.createLinearGradient(0, h * 0.80, 0, h);
    aoGrad.addColorStop(0, colRgba(pal.furShade, 0.0));
    aoGrad.addColorStop(1, colRgba(pal.furShade, 0.36));
    ctx.fillStyle = aoGrad;
    ctx.fillRect(0, h * 0.80, w, h * 0.20);

    // Directional fur strokes
    ctx.lineWidth = 1.25;
    for (let i = 0; i < 2600; i++) {
      const u = kit.noise(i * 0.157, 6.19);
      const v = kit.noise(3.83, i * 0.223);
      const x = u * w;
      const y = v * h;
      const tone = kit.noise(i * 0.29, 5.5);
      ctx.strokeStyle = tone > 0.5 ? colRgba(pal.furAccent, 0.14) : colRgba(pal.furShade, 0.13);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (tone - 0.5) * 3.0, y + 9.0);
      ctx.stroke();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createTailTextures(THREE, kit, pal) {
  const colorTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    // Remember flipY = true: cy = h is v = 0 (root), cy = 0 is v = 1 (tip)
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0.0, lerpColCss(THREE, pal.fur, pal.furShade, 0.35));
    grad.addColorStop(0.24, colHex(pal.fur));
    grad.addColorStop(0.64, colHex(pal.fur));
    grad.addColorStop(0.76, colHex(pal.furAccent));
    grad.addColorStop(1.0, lerpColCss(THREE, pal.furAccent, new THREE.Color('#ffffff'), 0.22));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Paint organic flame-tufted feathered transition border into lighter tip
    const cols = 128;
    for (let ix = 0; ix < cols; ix++) {
      const u = ix / cols;
      const a = u * Math.PI * 2;
      const n = kit.noise(Math.cos(a) * 3.0 + 4.2, Math.sin(a) * 3.0 + 9.1);
      const wave = 0.055 * Math.sin(a * 5.0) + 0.045 * (n - 0.5);
      const tipStartV = 0.68 + wave; // in [0..1] from base to tip
      const yTipStart = (1.0 - tipStartV) * h;

      const x0 = u * w;
      const cw = w / cols + 1.5;
      const gCol = ctx.createLinearGradient(0, yTipStart + 34, 0, yTipStart - 22);
      gCol.addColorStop(0, colRgba(pal.fur, 0.0));
      gCol.addColorStop(0.45, colRgba(pal.furAccent, 0.72));
      gCol.addColorStop(1, colRgba(pal.furAccent, 1.0));
      ctx.fillStyle = gCol;
      ctx.fillRect(x0, 0, cw, yTipStart + 34);
    }

    // Subtle warm snow-kitsune vermilion blush band right before white tip on variant 0
    if (pal.variant === 0) {
      const bandGrad = ctx.createLinearGradient(0, h * 0.44, 0, h * 0.16);
      bandGrad.addColorStop(0.0, colRgba(pal.tipTint, 0.0));
      bandGrad.addColorStop(0.42, colRgba(pal.tipTint, 0.32));
      bandGrad.addColorStop(0.72, colRgba(pal.tipTint, 0.18));
      bandGrad.addColorStop(1.0, colRgba(pal.tipTint, 0.0));
      ctx.fillStyle = bandGrad;
      ctx.fillRect(0, h * 0.14, w, h * 0.34);
    }

    // Fine longitudinal silk-brush fur streaks along tail
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 3000; i++) {
      const u = kit.noise(i * 0.131, 1.77);
      const v = kit.noise(8.53, i * 0.197);
      const x = u * w;
      const y = v * h;
      const nearTip = v < 0.32;
      const light = kit.noise(i * 0.43, 3.3) > 0.46;
      ctx.strokeStyle = nearTip
        ? (light ? 'rgba(255,255,255,0.22)' : colRgba(pal.fur, 0.10))
        : (light ? colRgba(pal.furAccent, 0.16) : colRgba(pal.furShade, 0.14));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (kit.noise(i * 0.61, 1.2) - 0.5) * 2.5, y - 16);
      ctx.stroke();
    }
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.ClampToEdgeWrapping;

  // Faint luminous tip emissiveMap (pairs with emissiveIntensity ~ 1.5 for soft cozy glow)
  const emissiveTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    // Soft glowing tip bloom in upper 30% of texture (cy = 0 is tip)
    const cols = 64;
    for (let ix = 0; ix < cols; ix++) {
      const u = ix / cols;
      const a = u * Math.PI * 2;
      const n = kit.noise(Math.cos(a) * 3.0 + 4.2, Math.sin(a) * 3.0 + 9.1);
      const wave = 0.045 * Math.sin(a * 5.0) + 0.035 * (n - 0.5);
      const glowBottom = (0.31 - wave) * h;

      const g = ctx.createLinearGradient(0, glowBottom, 0, 0);
      g.addColorStop(0.0, 'rgba(0,0,0,0)');
      g.addColorStop(0.45, 'rgba(58,58,58,0.55)');
      g.addColorStop(0.82, 'rgba(105,105,105,0.88)');
      g.addColorStop(1.0, 'rgba(128,128,128,1.0)');
      ctx.fillStyle = g;
      ctx.fillRect(u * w, 0, w / cols + 1.5, glowBottom);
    }
  });
  emissiveTex.wrapS = THREE.RepeatWrapping;
  emissiveTex.wrapT = THREE.ClampToEdgeWrapping;

  return { colorTex, emissiveTex };
}

function createEarTexture(THREE, kit, pal) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    // cy = h is base (v = 0), cy = 0 is ear tip (v = 1)
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0.0, colHex(pal.fur));
    grad.addColorStop(0.55, colHex(pal.fur));
    grad.addColorStop(0.82, lerpColCss(THREE, pal.fur, pal.tipTint, 0.72));
    grad.addColorStop(1.0, colHex(pal.tipTint));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.lineWidth = 1.0;
    for (let i = 0; i < 900; i++) {
      const x = kit.noise(i * 0.21, 1.5) * w;
      const y = kit.noise(5.4, i * 0.19) * h;
      ctx.strokeStyle = kit.noise(i * 0.4, 2.9) > 0.5
        ? colRgba(pal.furAccent, 0.14)
        : colRgba(pal.furShade, 0.14);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 9);
      ctx.stroke();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createChestRuffTexture(THREE, kit, pal) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = colHex(pal.furAccent);
    ctx.fillRect(0, 0, w, h);

    // Subtle warm shadow shading near collar top & underside
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, colRgba(pal.furShade, 0.22));
    grad.addColorStop(0.32, colRgba(pal.furAccent, 0.0));
    grad.addColorStop(0.78, colRgba(pal.furAccent, 0.0));
    grad.addColorStop(1.0, colRgba(pal.furShade, 0.20));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Fluffy downward fur lock strokes
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 1100; i++) {
      const x = kit.noise(i * 0.18, 9.2) * w;
      const y = kit.noise(2.7, i * 0.23) * h;
      const light = kit.noise(i * 0.37, 4.1) > 0.45;
      ctx.strokeStyle = light ? 'rgba(255,255,255,0.22)' : colRgba(pal.furShade, 0.12);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 10);
      ctx.stroke();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createPawTexture(THREE, kit, pal) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    // Tube v = 0 (shoulder, cy = h) -> v = 1 (paw tip, cy = 0)
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0.0, colHex(pal.fur));
    grad.addColorStop(0.45, colHex(pal.fur));
    grad.addColorStop(0.78, lerpColCss(THREE, pal.fur, pal.pawTint, 0.65));
    grad.addColorStop(1.0, colHex(pal.pawTint));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.lineWidth = 1.0;
    for (let i = 0; i < 750; i++) {
      const x = kit.noise(i * 0.27, 3.1) * w;
      const y = kit.noise(6.8, i * 0.17) * h;
      ctx.strokeStyle = kit.noise(i * 0.5, 1.4) > 0.5
        ? colRgba(pal.furAccent, 0.14)
        : colRgba(pal.furShade, 0.14);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 8);
      ctx.stroke();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createIrisTexture(THREE, kit, eyeCol) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const R = w * 0.48;

    const darkRim = eyeCol.clone().multiplyScalar(0.28);
    const brightCore = eyeCol.clone().lerp(new THREE.Color('#fff5d6'), 0.45);

    ctx.fillStyle = colHex(darkRim);
    ctx.fillRect(0, 0, w, h);

    // Rich radial iris base
    const baseG = ctx.createRadialGradient(cx, cy, R * 0.18, cx, cy, R);
    baseG.addColorStop(0.0, colHex(eyeCol));
    baseG.addColorStop(0.55, colHex(eyeCol));
    baseG.addColorStop(0.84, colHex(darkRim));
    baseG.addColorStop(1.0, '#100808');
    ctx.fillStyle = baseG;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();

    // Luminous lower crescent bounce light
    const glowG = ctx.createRadialGradient(cx, cy + R * 0.34, R * 0.04, cx, cy + R * 0.28, R * 0.52);
    glowG.addColorStop(0.0, colRgba(brightCore, 0.92));
    glowG.addColorStop(0.55, colRgba(brightCore, 0.36));
    glowG.addColorStop(1.0, colRgba(brightCore, 0.0));
    ctx.fillStyle = glowG;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.85, 0, Math.PI * 2);
    ctx.fill();

    // Delicate radial iris fibres
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const n = kit.noise(i * 0.33, 2.4);
      const r0 = R * (0.34 + n * 0.12);
      const r1 = R * (0.74 + n * 0.12);
      ctx.strokeStyle = n > 0.5 ? colRgba(brightCore, 0.28) : colRgba(darkRim, 0.32);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }

    // Soft upper eyelid shadow cast onto top of iris
    const topShad = ctx.createLinearGradient(0, cy - R, 0, cy + R * 0.05);
    topShad.addColorStop(0.0, 'rgba(12,6,6,0.72)');
    topShad.addColorStop(0.65, 'rgba(12,6,6,0.22)');
    topShad.addColorStop(1.0, 'rgba(12,6,6,0.0)');
    ctx.fillStyle = topShad;
    ctx.fillRect(0, 0, w, h * 0.58);

    // Deep glossy fox pupil
    ctx.fillStyle = '#120a0a';
    ctx.beginPath();
    ctx.ellipse(cx, cy - R * 0.02, R * 0.31, R * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBlushTexture(THREE, kit, blushCol) {
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 4, w * 0.5, h * 0.5, w * 0.48);
    g.addColorStop(0.0, colRgba(blushCol, 0.44));
    g.addColorStop(0.55, colRgba(blushCol, 0.18));
    g.addColorStop(1.0, colRgba(blushCol, 0.0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// --- Main Export: build(THREE, opts, kit) ---

export function build(THREE, opts, kit) {
  const pal = resolvePalette(THREE, opts);
  const root = new THREE.Group();
  root.name = 'nineTailedFox';

  // Generate painted surface textures & bump maps
  const furBump = createFurBumpTexture(THREE, kit, 512, 9);
  const tailBump = createFurBumpTexture(THREE, kit, 512, 16);
  const headTex = createHeadTexture(THREE, kit, pal);
  const bodyTex = createBodyTexture(THREE, kit, pal);
  const { colorTex: tailTex, emissiveTex: tailEmissiveTex } = createTailTextures(THREE, kit, pal);
  const earTex = createEarTexture(THREE, kit, pal);
  const ruffTex = createChestRuffTexture(THREE, kit, pal);
  const pawTex = createPawTexture(THREE, kit, pal);
  const irisTex = createIrisTexture(THREE, kit, pal.eye);
  const blushTex = createBlushTexture(THREE, kit, pal.blush);

  // Materials (MeshPhysicalMaterial)
  const headMat = new THREE.MeshPhysicalMaterial({
    map: headTex,
    bumpMap: furBump,
    bumpScale: 0.0014,
    roughness: 0.90,
    metalness: 0.0,
    sheen: 0.85,
    sheenRoughness: 0.65,
    sheenColor: pal.sheenFur
  });

  const bodyMat = new THREE.MeshPhysicalMaterial({
    map: bodyTex,
    bumpMap: furBump,
    bumpScale: 0.0016,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.85,
    sheenRoughness: 0.68,
    sheenColor: pal.sheenFur
  });

  const ruffMat = new THREE.MeshPhysicalMaterial({
    map: ruffTex,
    bumpMap: furBump,
    bumpScale: 0.0018,
    roughness: 0.94,
    metalness: 0.0,
    sheen: 0.92,
    sheenRoughness: 0.62,
    sheenColor: pal.sheenAccent
  });

  const earOuterMat = new THREE.MeshPhysicalMaterial({
    map: earTex,
    bumpMap: furBump,
    bumpScale: 0.0013,
    roughness: 0.90,
    metalness: 0.0,
    sheen: 0.80,
    sheenRoughness: 0.65,
    sheenColor: pal.sheenFur
  });

  const innerEarMat = new THREE.MeshPhysicalMaterial({
    color: pal.innerEar,
    bumpMap: furBump,
    bumpScale: 0.0008,
    roughness: 0.94,
    metalness: 0.0,
    sheen: 0.72,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color('#ffe8e2')
  });

  const pawMat = new THREE.MeshPhysicalMaterial({
    map: pawTex,
    bumpMap: furBump,
    bumpScale: 0.0013,
    roughness: 0.90,
    metalness: 0.0,
    sheen: 0.78,
    sheenRoughness: 0.68,
    sheenColor: pal.sheenFur
  });

  const tailMat = new THREE.MeshPhysicalMaterial({
    map: tailTex,
    bumpMap: tailBump,
    bumpScale: 0.0020,
    roughness: 0.88,
    metalness: 0.0,
    sheen: 0.95,
    sheenRoughness: 0.58,
    sheenColor: pal.sheenAccent,
    emissive: pal.glow,
    emissiveMap: tailEmissiveTex,
    emissiveIntensity: 1.5
  });

  const eyeMats = {
    eyeBase: new THREE.MeshPhysicalMaterial({
      color: '#140c0b',
      roughness: 0.05,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03
    }),
    eyeIris: new THREE.MeshPhysicalMaterial({
      map: irisTex,
      roughness: 0.08,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04
    }),
    eyeHighlight: new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.45,
      roughness: 0.04,
      clearcoat: 1.0
    }),
    liner: new THREE.MeshPhysicalMaterial({
      color: pal.liner,
      roughness: 0.55,
      metalness: 0.0
    })
  };

  const noseMat = new THREE.MeshPhysicalMaterial({
    color: '#241412',
    roughness: 0.14,
    metalness: 0.0,
    clearcoat: 0.88,
    clearcoatRoughness: 0.10
  });

  const whiskerMat = new THREE.MeshPhysicalMaterial({
    color: pal.furAccent,
    roughness: 0.65,
    metalness: 0.0,
    sheen: 0.5,
    sheenColor: new THREE.Color('#ffffff')
  });

  const blushMat = new THREE.MeshPhysicalMaterial({
    map: blushTex,
    transparent: true,
    depthWrite: false,
    roughness: 0.95,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -1
  });

  const cordMat = new THREE.MeshPhysicalMaterial({
    color: pal.accent,
    roughness: 0.86,
    metalness: 0.0,
    sheen: 0.72,
    sheenRoughness: 0.65,
    sheenColor: pal.accent.clone().lerp(new THREE.Color('#ffffff'), 0.45)
  });

  const metalMat = new THREE.MeshPhysicalMaterial({
    color: pal.metal,
    roughness: 0.22,
    metalness: 0.86,
    clearcoat: 0.55,
    clearcoatRoughness: 0.15
  });

  const padMat = new THREE.MeshPhysicalMaterial({
    color: pal.innerEar.clone().multiplyScalar(0.86),
    roughness: 0.62,
    metalness: 0.0,
    clearcoat: 0.15
  });

  // 1. BODY GROUP (torso, plush chest ruff, shrine collar)
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'body';

  const bodyMesh = new THREE.Mesh(buildBodyGeometry(THREE), bodyMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.userData.slot = 'fur';
  bodyGroup.add(bodyMesh);

  const ruffMesh = new THREE.Mesh(buildChestRuffGeometry(THREE), ruffMat);
  ruffMesh.position.set(0, 0.122, 0.044);
  ruffMesh.rotation.x = 0.12;
  ruffMesh.castShadow = true;
  ruffMesh.receiveShadow = true;
  ruffMesh.userData.slot = 'furAccent';
  bodyGroup.add(ruffMesh);

  const collar = buildShrineCollar(THREE, cordMat, metalMat);
  bodyGroup.add(collar);

  root.add(bodyGroup);

  // 2. LIMBS (planted left foreleg, charming raised right foreleg, cozy seated hind legs)
  const { armL, armR } = buildForelegGroups(THREE, pawMat, padMat);
  root.add(armL);
  root.add(armR);

  const legL = buildHindLegGroup(THREE, 1, bodyMat, pawMat);
  const legR = buildHindLegGroup(THREE, -1, bodyMat, pawMat);
  root.add(legL);
  root.add(legR);

  // 3. HEAD GROUP (sculpted continuous head, 3-layer eyes, nose, mouth, whiskers, blush, ears)
  const headGroup = new THREE.Group();
  headGroup.name = 'head';
  headGroup.position.set(0.0, 0.194, 0.064);
  // Charming asymmetric head tilt
  headGroup.rotation.set(0.05, 0.08, -0.09);

  // Sculpted continuous head mesh
  const headGeo = new THREE.SphereGeometry(1, 60, 40);
  headGeo.rotateY(-Math.PI / 2);
  const hPos = headGeo.attributes.position;
  for (let i = 0; i < hPos.count; i++) {
    const p = deformHeadVertex(hPos.getX(i), hPos.getY(i), hPos.getZ(i));
    hPos.setXYZ(i, p.x, p.y, p.z);
  }
  headGeo.computeVertexNormals();
  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headMesh.userData.slot = 'fur';
  headGroup.add(headMesh);

  // Eyes placed snugly on exact sculpted sockets
  const eyeDirL = new THREE.Vector3(0.445, 0.055, 0.8938).normalize();
  const eyeDirR = new THREE.Vector3(-0.445, 0.055, 0.8938).normalize();
  const surfL = sampleHeadSurface(THREE, eyeDirL);
  const surfR = sampleHeadSurface(THREE, eyeDirR);

  const eyeL = buildEyeGroup(THREE, 1, eyeMats);
  eyeL.position.copy(surfL.point).addScaledVector(surfL.normal, -0.0020);
  eyeL.quaternion.copy(orientBasisToNormal(THREE, surfL.normal));
  headGroup.add(eyeL);

  const eyeR = buildEyeGroup(THREE, -1, eyeMats);
  eyeR.position.copy(surfR.point).addScaledVector(surfR.normal, -0.0020);
  eyeR.quaternion.copy(orientBasisToNormal(THREE, surfR.normal));
  headGroup.add(eyeR);

  // Subtle surface-conformed cheek blush discs
  headGroup.add(buildBlushDisc(THREE, 1, blushMat));
  headGroup.add(buildBlushDisc(THREE, -1, blushMat));

  // Nose placed right on snout tip
  const noseSurf = sampleHeadSurface(THREE, new THREE.Vector3(0, -0.195, 0.981));
  const noseMesh = buildNoseMesh(THREE, noseMat);
  noseMesh.position.copy(noseSurf.point).addScaledVector(noseSurf.normal, 0.0012);
  noseMesh.rotation.x = 0.14;
  headGroup.add(noseMesh);

  // Cute curved fox "w" smile mouth from thin tapered tubes hugging the muzzle
  for (const side of [-1, 1]) {
    const rawDirs = [
      new THREE.Vector3(0.0, -0.26, 0.966),
      new THREE.Vector3(side * 0.05, -0.34, 0.939),
      new THREE.Vector3(side * 0.14, -0.37, 0.918),
      new THREE.Vector3(side * 0.23, -0.32, 0.919)
    ];
    const pts = rawDirs.map((d) => {
      const s = sampleHeadSurface(THREE, d);
      return s.point.addScaledVector(s.normal, 0.0008);
    });
    const mCurve = new THREE.CatmullRomCurve3(pts);
    const mGeo = buildTaperedTube(
      THREE,
      mCurve,
      7,
      14,
      (u) => 0.00105 * (1.0 - 0.55 * u)
    );
    const mMesh = new THREE.Mesh(mGeo, eyeMats.liner);
    mMesh.userData.slot = 'accent';
    headGroup.add(mMesh);
  }

  // Delicate whiskers (3 per side)
  for (const side of [-1, 1]) {
    for (let w = 0; w < 3; w++) {
      const baseSurf = sampleHeadSurface(
        THREE,
        new THREE.Vector3(side * (0.28 + w * 0.04), -0.28 - w * 0.045, 0.91 - w * 0.02)
      );
      const p0 = baseSurf.point.clone().addScaledVector(baseSurf.normal, -0.002);
      const p1 = p0.clone().add(new THREE.Vector3(side * 0.017, (1 - w) * 0.0025, 0.004));
      const p2 = p0.clone().add(new THREE.Vector3(side * 0.036, (1 - w) * 0.004 - 0.003, -0.002));
      const wGeo = buildTaperedTube(
        THREE,
        new THREE.CatmullRomCurve3([p0, p1, p2]),
        6,
        10,
        (u) => 0.00058 * (1.0 - 0.78 * u)
      );
      const wMesh = new THREE.Mesh(wGeo, whiskerMat);
      wMesh.userData.slot = 'furAccent';
      headGroup.add(wMesh);
    }
  }

  // Expressive sculpted fox ears (with slight asymmetry)
  const earSurfL = sampleHeadSurface(THREE, new THREE.Vector3(0.55, 0.74, -0.06));
  const earL = buildFoxEarGroup(THREE, 1, earOuterMat, innerEarMat, ruffMat);
  earL.position.copy(earSurfL.point).add(new THREE.Vector3(-0.004, -0.011, 0.002));
  earL.rotation.set(0.06, 0.24, -0.34);
  headGroup.add(earL);

  const earSurfR = sampleHeadSurface(THREE, new THREE.Vector3(-0.55, 0.74, -0.06));
  const earR = buildFoxEarGroup(THREE, -1, earOuterMat, innerEarMat, ruffMat);
  earR.position.copy(earSurfR.point).add(new THREE.Vector3(0.004, -0.011, 0.002));
  earR.rotation.set(0.09, -0.22, 0.42);
  headGroup.add(earR);

  root.add(headGroup);

  // 4. NINE FANNED BRUSH TAILS
  const tailGroup = buildNineTails(THREE, tailMat);
  root.add(tailGroup);

  // Store rest transforms for smooth stateless idle() animation
  root.userData.anim = {
    body: bodyGroup,
    head: headGroup,
    headRestPos: headGroup.position.clone(),
    headRestRot: headGroup.rotation.clone(),
    earL,
    earLRestRot: earL.rotation.clone(),
    earR,
    earRRestRot: earR.rotation.clone(),
    eyeL,
    eyeR,
    armR,
    armRRestPos: armR.position.clone(),
    armRRestRot: armR.rotation.clone(),
    bell: collar.userData.bellPivot,
    tailPivots: tailGroup.userData.tailPivots
  };

  return root;
}

// --- Idle Animation: breathing, head sway, ear twitch, 9-tail peacock ripple, blinking ---

export function idle(group, t) {
  const anim = group && group.userData && group.userData.anim;
  if (!anim) return;

  // 1. Cozy gentle breathing
  const breath = Math.sin(t * 1.85);
  anim.body.scale.set(
    1.0 - 0.006 * breath,
    1.0 + 0.014 * breath,
    1.0 + 0.008 * breath
  );

  // 2. Soft curious head sway synced gently with breathing
  const swayY = Math.sin(t * 0.72) * 0.065 + Math.sin(t * 1.31) * 0.020;
  const swayZ = Math.sin(t * 0.58 + 0.9) * 0.042;
  const nodX = Math.sin(t * 1.85 - 0.4) * 0.018;
  anim.head.position.set(
    anim.headRestPos.x,
    anim.headRestPos.y + 0.0024 * breath,
    anim.headRestPos.z + 0.0010 * breath
  );
  anim.head.rotation.set(
    anim.headRestRot.x + nodX,
    anim.headRestRot.y + swayY,
    anim.headRestRot.z + swayZ
  );

  // 3. Gentle ear sway + occasional cute asymmetric ear flick
  const twitchCycleL = t % 5.8;
  const twitchL = Math.exp(-Math.pow((twitchCycleL - 2.1) / 0.11, 2)) * 0.16;
  const twitchCycleR = (t + 2.7) % 7.3;
  const twitchR = Math.exp(-Math.pow((twitchCycleR - 3.4) / 0.11, 2)) * 0.14;

  anim.earL.rotation.set(
    anim.earLRestRot.x + Math.sin(t * 1.1) * 0.025,
    anim.earLRestRot.y,
    anim.earLRestRot.z - twitchL - Math.sin(t * 0.9) * 0.028
  );
  anim.earR.rotation.set(
    anim.earRRestRot.x + Math.sin(t * 1.05 + 1.2) * 0.025,
    anim.earRRestRot.y,
    anim.earRRestRot.z + twitchR + Math.sin(t * 0.85 + 0.7) * 0.028
  );

  // 4. Raised paw gentle breathing bob
  anim.armR.position.set(
    anim.armRRestPos.x,
    anim.armRRestPos.y + 0.0022 * breath,
    anim.armRRestPos.z
  );
  anim.armR.rotation.set(
    anim.armRRestRot.x + Math.sin(t * 1.85 - 0.5) * 0.045,
    anim.armRRestRot.y,
    anim.armRRestRot.z + Math.sin(t * 0.95) * 0.025
  );

  // 5. Subtle bell pendulum swing
  if (anim.bell) {
    anim.bell.rotation.z = Math.sin(t * 1.85 + 0.6) * 0.055 + swayZ * 0.6;
    anim.bell.rotation.x = Math.sin(t * 1.85) * 0.03;
  }

  // 6. Peacock-fan silky wave across all nine brush tails
  const pivots = anim.tailPivots;
  for (let i = 0; i < pivots.length; i++) {
    const p = pivots[i];
    const phase = t * 1.28 + i * 0.58;
    const isFloorTail = i === 0 || i === 8;
    const ampZ = isFloorTail ? 0.014 : 0.042;
    const ampX = isFloorTail ? 0.012 : 0.032;
    const ampY = isFloorTail ? 0.028 : 0.024;
    p.rotation.set(
      Math.sin(phase) * ampX + 0.012 * breath,
      Math.cos(phase * 0.82 + i) * ampY,
      Math.sin(phase * 0.94 + 0.6) * ampZ
    );
  }

  // 7. Natural periodic blink (scale eye groups on Y)
  const blinkCycle = t % 4.3;
  let eyeScaleY = 1.0;
  if (blinkCycle > 3.92 && blinkCycle < 4.10) {
    const bPhase = (blinkCycle - 3.92) / 0.18; // 0..1
    const close = Math.sin(bPhase * Math.PI);
    eyeScaleY = 1.0 - 0.92 * close * close;
  }
  anim.eyeL.scale.y = eyeScaleY;
  anim.eyeR.scale.y = eyeScaleY;
}
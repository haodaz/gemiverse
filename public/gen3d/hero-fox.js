export const META = {
  id: 'cozy-stylised-fox',
  name: 'Cozy Stylised Fox',
  kind: 'creature',
  footprint: [0.32, 0.42],
  variants: ['Red Fox', 'Arctic White', 'Silver Fox'],
  note: 'Hero-quality sitting stylised fox (~0.42 m long) with wrapped brush tail, white chest and tail tip, dark socks, and expressive face.'
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function mixHex(THREE, hexA, hexB, t) {
  const c = new THREE.Color(hexA);
  c.lerp(new THREE.Color(hexB), clamp(t, 0, 1));
  return '#' + c.getHexString();
}

function shiftColor(THREE, hex, dh, ds, dl) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(
    (hsl.h + dh + 1) % 1,
    clamp(hsl.s + ds, 0, 1),
    clamp(hsl.l + dl, 0, 1)
  );
  return '#' + c.getHexString();
}

function getPalette(THREE, opts) {
  const variant = Number.isFinite(opts?.variant) ? Math.round(opts.variant) : 0;
  const presets = [
    {
      fur: '#d45d2a',
      furDark: '#963414',
      furLight: '#f0945d',
      furAccent: '#fbf2e3',
      sock: '#2b201e',
      earInner: '#eba896',
      nose: '#211817',
      eye: '#c87c1e',
      blush: '#e8786d',
      whisker: '#46332c',
      pad: '#4a3533'
    },
    {
      fur: '#e9edf3',
      furDark: '#bfc9d6',
      furLight: '#ffffff',
      furAccent: '#fcfdff',
      sock: '#9ea9b8',
      earInner: '#ecc2c7',
      nose: '#2b2c34',
      eye: '#5aa0cf',
      blush: '#efa1ae',
      whisker: '#9da7b5',
      pad: '#7d7a84'
    },
    {
      fur: '#35333a',
      furDark: '#1b191f',
      furLight: '#9c9eab',
      furAccent: '#e8eaf0',
      sock: '#161419',
      earInner: '#b9999c',
      nose: '#131216',
      eye: '#d99a26',
      blush: '#cf787d',
      whisker: '#8a8994',
      pad: '#2c272c'
    }
  ];

  const base = { ...presets[clamp(variant, 0, 2)] };
  if (opts?.fur) {
    base.fur = new THREE.Color(opts.fur).getStyle();
    base.furDark = shiftColor(THREE, opts.fur, -0.015, 0.06, -0.17);
    base.furLight = shiftColor(THREE, opts.fur, 0.015, -0.05, 0.16);
  }
  if (opts?.furAccent) {
    base.furAccent = new THREE.Color(opts.furAccent).getStyle();
  }
  if (opts?.eye) {
    base.eye = new THREE.Color(opts.eye).getStyle();
  }
  base.furSheen = mixHex(THREE, base.furLight, '#ffffff', 0.35);
  base.accentSheen = mixHex(THREE, base.furAccent, '#ffffff', 0.45);
  base.sockSheen = mixHex(THREE, base.sock, '#ffffff', 0.22);
  return base;
}

function createTaperedTube(THREE, curve, cfg) {
  const tubularSegs = cfg.tubularSegments || 40;
  const radialSegs = cfg.radialSegments || 20;
  const radiusFn = cfg.radiusFn || (() => 0.02);
  const preferUp = cfg.preferUp ? cfg.preferUp.clone().normalize() : null;
  const deformFn = cfg.deformFn || null;
  const capStart = cfg.capStart !== false;
  const capEnd = cfg.capEnd !== false;

  const points = [];
  const tangents = [];
  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    points.push(curve.getPointAt(t));
    tangents.push(curve.getTangentAt(t).normalize());
  }

  const normals = [];
  const binormals = [];
  const tmpUp = new THREE.Vector3(0, 1, 0);
  const tmpAlt = new THREE.Vector3(0, 0, 1);
  const rotQ = new THREE.Quaternion();

  for (let i = 0; i <= tubularSegs; i++) {
    const T = tangents[i];
    let N;
    if (preferUp && Math.abs(T.dot(preferUp)) < 0.92) {
      N = preferUp.clone().addScaledVector(T, -preferUp.dot(T)).normalize();
    } else if (i === 0) {
      const ref = Math.abs(T.dot(tmpUp)) < 0.9 ? tmpUp : tmpAlt;
      N = ref.clone().addScaledVector(T, -ref.dot(T)).normalize();
    } else {
      rotQ.setFromUnitVectors(tangents[i - 1], T);
      N = normals[i - 1].clone().applyQuaternion(rotQ);
      N.addScaledVector(T, -N.dot(T)).normalize();
    }
    const B = new THREE.Vector3().crossVectors(T, N).normalize();
    normals.push(N);
    binormals.push(B);
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const ringStride = radialSegs + 1;
  const vPos = new THREE.Vector3();
  const radialDir = new THREE.Vector3();

  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    const P = points[i];
    const N = normals[i];
    const B = binormals[i];
    const T = tangents[i];

    for (let j = 0; j <= radialSegs; j++) {
      const u = j / radialSegs;
      const angle = u * Math.PI * 2;
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      const r = Math.max(0.0003, radiusFn(t, angle));

      radialDir.set(
        N.x * ca + B.x * sa,
        N.y * ca + B.y * sa,
        N.z * ca + B.z * sa
      );
      vPos.copy(P).addScaledVector(radialDir, r);

      if (deformFn) {
        deformFn(vPos, t, angle, P, N, B, T);
      }

      positions.push(vPos.x, vPos.y, vPos.z);
      uvs.push(u, t);
    }
  }

  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const v00 = i * ringStride + j;
      const v01 = i * ringStride + (j + 1);
      const v10 = (i + 1) * ringStride + j;
      const v11 = (i + 1) * ringStride + (j + 1);
      indices.push(v00, v01, v10);
      indices.push(v01, v11, v10);
    }
  }

  if (capStart) {
    const centerIdx = positions.length / 3;
    const p0 = points[0].clone().addScaledVector(tangents[0], -radiusFn(0, 0) * 0.35);
    if (deformFn) deformFn(p0, 0, 0, points[0], normals[0], binormals[0], tangents[0]);
    positions.push(p0.x, p0.y, p0.z);
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(centerIdx, j + 1, j);
    }
  }

  if (capEnd) {
    const centerIdx = positions.length / 3;
    const last = tubularSegs;
    const p1 = points[last].clone().addScaledVector(tangents[last], radiusFn(1, 0) * 0.35);
    if (deformFn) deformFn(p1, 1, 0, points[last], normals[last], binormals[last], tangents[last]);
    positions.push(p1.x, p1.y, p1.z);
    uvs.push(0.5, 1);
    const ringStart = last * ringStride;
    for (let j = 0; j < radialSegs; j++) {
      indices.push(centerIdx, ringStart + j, ringStart + j + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function sculptHeadPoint(nx, ny, nz, out) {
  // Base chibi cranium
  let x = nx * 0.079;
  let y = ny * 0.068;
  let z = nz * 0.074;

  // Gently rounded slightly wider crown & fuller upper brow
  if (ny > 0) {
    const crownSoft = Math.pow(ny, 1.8);
    y -= crownSoft * 0.004;
    x *= 1 - 0.08 * crownSoft;
  }

  // Fluffy swept-back cheek tufts for the iconic stylised fox diamond-heart silhouette
  const cheekSide = Math.exp(-Math.pow((Math.abs(nx) - 0.78) / 0.34, 2));
  const cheekVert = Math.exp(-Math.pow((ny + 0.16) / 0.36, 2));
  const cheekFront = Math.exp(-Math.pow((nz - 0.05) / 0.58, 2));
  const cheekMask = cheekSide * cheekVert * cheekFront;
  const cheekTuftWave = 1 + 0.16 * Math.cos((ny + 0.18) * 18.0);
  x += Math.sign(nx) * 0.025 * cheekMask * cheekTuftWave;
  z -= 0.008 * cheekMask;
  y -= 0.004 * cheekMask;

  // Continuous sculpted fox muzzle projecting forward along +Z
  const frontMask = smoothstep(0.12, 0.72, nz);
  const muzzleCore = Math.exp(-Math.pow(nx / 0.44, 2)) * Math.exp(-Math.pow((ny + 0.19) / 0.38, 2)) * frontMask;
  const muzzleTip = Math.exp(-Math.pow(nx / 0.25, 2)) * Math.exp(-Math.pow((ny + 0.18) / 0.24, 2)) * smoothstep(0.55, 0.96, nz);

  z += 0.044 * muzzleCore + 0.017 * muzzleTip;
  // Taper snout smoothly toward nose tip while keeping plump whisker pads
  x *= 1 - 0.34 * muzzleTip;
  y += -0.006 * muzzleCore + 0.004 * muzzleTip;

  // Soft whisker pad fullness on either side of lower muzzle
  const padMask = Math.exp(-Math.pow((Math.abs(nx) - 0.22) / 0.18, 2))
    * Math.exp(-Math.pow((ny + 0.27) / 0.16, 2))
    * smoothstep(0.45, 0.88, nz);
  z += 0.006 * padMask;
  x += Math.sign(nx) * 0.004 * padMask;

  // Subtle nasal bridge slope & soft brow ridge
  const browMask = Math.exp(-Math.pow((Math.abs(nx) - 0.34) / 0.24, 2))
    * Math.exp(-Math.pow((ny - 0.28) / 0.18, 2))
    * smoothstep(0.45, 0.9, nz);
  z += 0.004 * browMask;
  y += 0.003 * browMask;

  // Gentle concave eye sockets so large glossy eyes nestle flush without floating
  const eyeSocket = Math.exp(-Math.pow((Math.abs(nx) - 0.43) / 0.18, 2))
    * Math.exp(-Math.pow((ny - 0.04) / 0.19, 2))
    * smoothstep(0.48, 0.88, nz);
  z -= 0.0055 * eyeSocket;
  x -= Math.sign(nx) * 0.0025 * eyeSocket;

  // Soft chin tuck & deep neck-overlap lobe at the lower back
  const chinMask = Math.exp(-Math.pow(nx / 0.4, 2)) * smoothstep(-0.35, -0.85, ny);
  y += 0.005 * chinMask * smoothstep(0.1, 0.7, nz);
  const occiput = smoothstep(-0.1, -0.85, nz) * Math.exp(-Math.pow((ny + 0.15) / 0.55, 2));
  z -= 0.008 * occiput;

  out.set(x, y, z);
  return out;
}

function buildSculptedHead(THREE, kit) {
  const geo = new THREE.SphereGeometry(1, 64, 48, -Math.PI / 2);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);
    sculptHeadPoint(nx, ny, nz, v);

    // Subtle organic fur surface undulation
    const furN = (kit.noise(nx * 4.2 + 3.1, ny * 4.2 + nz * 3.1) - 0.5) * 0.0022;
    const maskFur = 1 - smoothstep(0.7, 0.95, nz) * Math.exp(-Math.pow((ny + 0.16) / 0.25, 2));
    v.x += nx * furN * maskFur;
    v.y += ny * furN * maskFur;
    v.z += nz * furN * maskFur;

    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildSculptedBody(THREE, kit) {
  const geo = new THREE.SphereGeometry(1, 64, 44, -Math.PI / 2);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    // Sitting pear torso: wider plush haunches below, tapered upright chest above
    const haunchProfile = 1.06 - 0.30 * ny - 0.14 * ny * ny;
    let x = nx * 0.082 * haunchProfile;
    let y = ny * 0.108 + 0.106;
    let z = nz * 0.088 * (1.02 - 0.20 * ny);

    // Cozy forward sitting posture lean
    z += 0.022 * ny - 0.016 * (1 - ny * ny);

    // Rounded seated rear haunch fullness
    const haunchBulge = Math.exp(-Math.pow((ny + 0.38) / 0.42, 2)) * smoothstep(-0.1, -0.85, nz);
    z -= 0.016 * haunchBulge;
    x *= 1 + 0.14 * haunchBulge;

    // Soft side-hip fullness
    const hipSide = Math.exp(-Math.pow((ny + 0.42) / 0.36, 2)) * Math.pow(Math.abs(nx), 1.4);
    x += Math.sign(nx) * 0.010 * hipSide;

    // Plush chest projection forward
    const chestBulge = Math.exp(-Math.pow((ny - 0.20) / 0.42, 2)) * smoothstep(0.15, 0.9, nz);
    z += 0.016 * chestBulge;

    // Pinched neck transition at top for deep seamless overlap with head
    const neckPinch = smoothstep(0.62, 0.98, ny);
    x *= 1 - 0.24 * neckPinch;
    z = z * (1 - 0.20 * neckPinch) + 0.014 * neckPinch;

    // Plush fur micro-displacement
    const furW = (kit.noise(nx * 3.8 + 7.2, ny * 4.4 + nz * 3.4) - 0.5) * 0.0028;
    x += nx * furW;
    z += nz * furW;

    // Grounded weight: gently flatten underside resting cleanly on floor y = 0
    if (y < 0.026) {
      const flatT = smoothstep(0.026, -0.01, y);
      y = y * (1 - flatT) + 0.0012 * flatT;
      x *= 1 + 0.06 * flatT;
      z *= 1 + 0.04 * flatT;
    }

    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildChestRuff(THREE, kit) {
  const geo = new THREE.SphereGeometry(1, 48, 32, -Math.PI / 2);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    // Heart-teardrop fluffy chest bib hugging the front torso
    const taperDown = 0.62 + 0.45 * smoothstep(-0.85, 0.35, ny);
    let x = nx * 0.056 * taperDown;
    let y = ny * 0.066;
    let z = nz * 0.036;

    // Curve the ruff smoothly around the chest cylinder
    z -= 0.018 * nx * nx;
    // Slight forward plush puff in upper-middle chest
    const puff = Math.exp(-Math.pow((ny - 0.12) / 0.52, 2)) * smoothstep(0.0, 0.9, nz);
    z += 0.014 * puff;

    // Sculpted scalloped fur tufts along lower point & sides
    const tuftMask = smoothstep(0.3, -0.75, ny) * smoothstep(-0.2, 0.8, nz);
    const ridges = Math.cos(nx * 14.5) * 0.5 + 0.5;
    y -= 0.010 * tuftMask * ridges;
    z += 0.004 * tuftMask * ridges;

    const n = (kit.noise(nx * 5.0 + 1.7, ny * 5.0 + nz * 3.0) - 0.5) * 0.0022;
    x += nx * n;
    y += ny * n;
    z += nz * n;

    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildEarGeometries(THREE) {
  function deformEar(geo, zOffset, heightRef) {
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      const h = clamp(y / heightRef, 0, 1);
      // Taper thickness gracefully from plush base to slim pointed tip
      z *= 1.15 - 0.72 * Math.pow(h, 1.1);

      // Cup horizontally so inner ear forms a cozy concave dish facing +Z
      const xNorm = x / 0.031;
      const cup = 0.0135 * xNorm * xNorm * (1 - 0.52 * h) - 0.0055 * (1 - h) * (1 - h);
      z += cup;

      // Gentle graceful backward sweep near tip
      z -= 0.013 * h * h + zOffset;

      pos.setXYZ(i, x, y, z);
      uv.setXY(i, clamp(x / 0.068 + 0.5, 0, 1), clamp(y / (heightRef * 1.04), 0, 1));
    }
    geo.computeVertexNormals();
    return geo;
  }

  // Outer sculpted ear shell via bezierCurveTo Shape + ExtrudeGeometry
  const outerShape = new THREE.Shape();
  outerShape.moveTo(-0.028, 0.0);
  outerShape.bezierCurveTo(-0.035, 0.034, -0.023, 0.076, 0.0, 0.104);
  outerShape.bezierCurveTo(0.023, 0.076, 0.035, 0.034, 0.028, 0.0);
  outerShape.bezierCurveTo(0.014, -0.009, -0.014, -0.009, -0.028, 0.0);

  const outerGeo = new THREE.ExtrudeGeometry(outerShape, {
    depth: 0.009,
    bevelEnabled: true,
    bevelThickness: 0.0055,
    bevelSize: 0.0045,
    bevelSegments: 5,
    curveSegments: 24
  });
  outerGeo.translate(0, 0, -0.0045);
  deformEar(outerGeo, 0, 0.104);

  // Inner ear soft lining nestled inside the cupped dish
  const innerShape = new THREE.Shape();
  innerShape.moveTo(-0.018, 0.007);
  innerShape.bezierCurveTo(-0.022, 0.030, -0.014, 0.060, 0.0, 0.080);
  innerShape.bezierCurveTo(0.014, 0.060, 0.022, 0.030, 0.018, 0.007);
  innerShape.bezierCurveTo(0.009, 0.002, -0.009, 0.002, -0.018, 0.007);

  const innerGeo = new THREE.ExtrudeGeometry(innerShape, {
    depth: 0.0025,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 3,
    curveSegments: 20
  });
  innerGeo.translate(0, 0, -0.00125);
  deformEar(innerGeo, -0.0042, 0.104);

  return { outerGeo, innerGeo };
}

function buildEyeLensGeometry(THREE) {
  // Smooth cornea dome via LatheGeometry (20 profile points)
  const pts = [];
  const count = 20;
  const rx = 0.0168;
  const ry = 0.0092;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const angle = -0.25 + t * (Math.PI * 0.5 + 0.25);
    const r = Math.max(0.0001, Math.cos(angle) * rx);
    const y = Math.sin(angle) * ry;
    pts.push(new THREE.Vector2(r, y));
  }
  const geo = new THREE.LatheGeometry(pts, 28);
  geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function buildIrisGeometry(THREE) {
  // Curved iris shell hugging just in front of the cornea dome
  const pts = [];
  const count = 16;
  const rx = 0.0146;
  const ry = 0.0086;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const angle = 0.34 + t * (Math.PI * 0.5 - 0.34);
    const r = Math.max(0.0001, Math.cos(angle) * rx);
    const y = Math.sin(angle) * ry + 0.0012;
    pts.push(new THREE.Vector2(r, y));
  }
  const geo = new THREE.LatheGeometry(pts, 28);
  geo.rotateX(Math.PI / 2);
  // Planar front UVs so radial iris painting maps cleanly
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const maxR = Math.cos(0.34) * rx;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / (maxR * 2) + 0.5, pos.getY(i) / (maxR * 2) + 0.5);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildNoseGeometry(THREE) {
  const geo = new THREE.SphereGeometry(1, 28, 20);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    // Stylised rounded shield-triangle fox nose
    const widthTaper = 0.78 + 0.32 * smoothstep(-0.7, 0.5, ny);
    let x = nx * 0.0128 * widthTaper;
    let y = ny * 0.0092;
    let z = nz * 0.0086;

    // Gentle flat top bridge
    if (ny > 0.2) y -= (ny - 0.2) * 0.0022;
    // Slight philtrum cleft at bottom center
    const cleft = Math.exp(-Math.pow(nx / 0.18, 2)) * smoothstep(0.0, -0.8, ny) * smoothstep(0.1, 0.8, nz);
    z -= 0.0015 * cleft;
    // Subtle nostril dimples
    const nostril = Math.exp(-Math.pow((Math.abs(nx) - 0.46) / 0.16, 2))
      * Math.exp(-Math.pow((ny + 0.18) / 0.22, 2))
      * smoothstep(0.2, 0.9, nz);
    z -= 0.0018 * nostril;

    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function paintFurStrokes(ctx, w, h, rng, kit, cfg) {
  const count = cfg.count || 2200;
  const lenMin = cfg.lenMin || 8;
  const lenMax = cfg.lenMax || 22;
  const width = cfg.width || 1.4;
  const dirAngle = cfg.dirAngle ?? Math.PI * 0.5;
  const alpha = cfg.alpha ?? 0.22;
  const colorFn = cfg.colorFn;
  const angleFn = cfg.angleFn;

  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const u = rng();
    const v = rng();
    const x = u * w;
    const y = v * h;
    const len = lenMin + rng() * (lenMax - lenMin);
    const jitter = (kit.noise(u * 9 + 1.3, v * 9 + 4.7) - 0.5) * 0.35;
    const ang = (angleFn ? angleFn(u, v) : dirAngle) + jitter;
    const dx = Math.cos(ang) * len;
    const dy = Math.sin(ang) * len;

    ctx.strokeStyle = colorFn(u, v, rng);
    ctx.globalAlpha = alpha * (0.6 + 0.8 * rng());
    ctx.lineWidth = width * (0.7 + 0.6 * rng());

    ctx.beginPath();
    ctx.moveTo(x - dx * 0.35, y - dy * 0.35);
    ctx.lineTo(x + dx * 0.65, y + dy * 0.65);
    ctx.stroke();

    // Seamless horizontal wrap for strokes near x = 0 or x = w
    if (x < len) {
      ctx.beginPath();
      ctx.moveTo(x + w - dx * 0.35, y - dy * 0.35);
      ctx.lineTo(x + w + dx * 0.65, y + dy * 0.65);
      ctx.stroke();
    } else if (x > w - len) {
      ctx.beginPath();
      ctx.moveTo(x - w - dx * 0.35, y - dy * 0.35);
      ctx.lineTo(x - w + dx * 0.65, y + dy * 0.65);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function createFurBumpTexture(THREE, kit, seed, verticalBias) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const rng = makeRng(seed);
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);

    // Broad soft noise mottling
    for (let i = 0; i < 450; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const r = 8 + rng() * 18;
      const n = kit.noise(Math.cos((x / w) * Math.PI * 2) * 2 + 3, (y / h) * 4 + 2);
      const g = Math.round(112 + n * 32);
      ctx.fillStyle = `rgba(${g},${g},${g},0.16)`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    paintFurStrokes(ctx, w, h, rng, kit, {
      count: 2600,
      lenMin: 6,
      lenMax: 16,
      width: 1.2,
      dirAngle: verticalBias ? Math.PI * 0.5 : Math.PI * 0.5,
      alpha: 0.28,
      colorFn: (_u, _v, r) => (r() > 0.48 ? '#bcbcbc' : '#4a4a4a')
    });
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createBodyTexture(THREE, kit, pal) {
  const tex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const rng = makeRng(1041);
    ctx.fillStyle = pal.fur;
    ctx.fillRect(0, 0, w, h);

    // Rich dorsal dark saddle along back (cx near 0 & w) and warm sunlit shoulders
    const backL = ctx.createLinearGradient(0, 0, w * 0.34, 0);
    backL.addColorStop(0, pal.furDark);
    backL.addColorStop(0.55, pal.fur);
    backL.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = backL;
    ctx.fillRect(0, 0, w * 0.35, h);

    const backR = ctx.createLinearGradient(w, 0, w * 0.66, 0);
    backR.addColorStop(0, pal.furDark);
    backR.addColorStop(0.55, pal.fur);
    backR.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = backR;
    ctx.fillRect(w * 0.65, 0, w * 0.35, h);

    // Soft warm top sheen
    const topGlow = ctx.createLinearGradient(0, 0, 0, h * 0.45);
    topGlow.addColorStop(0, pal.furLight);
    topGlow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = topGlow;
    ctx.fillRect(0, 0, w, h * 0.45);
    ctx.globalAlpha = 1;

    // Creamy white chest & belly bib centered on front (+Z => cx = 0.5 * w)
    ctx.save();
    ctx.beginPath();
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cy = h * (0.08 + t * 0.92);
      const bibHalf = w * (0.145 * Math.sin(clamp(t * 1.15, 0, 1) * Math.PI) + 0.055 * (1 - t));
      const jagged = (kit.noise(t * 14 + 2.1, 1.4) - 0.5) * 16;
      const cx = w * 0.5 + bibHalf + jagged;
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const cy = h * (0.08 + t * 0.92);
      const bibHalf = w * (0.145 * Math.sin(clamp(t * 1.15, 0, 1) * Math.PI) + 0.055 * (1 - t));
      const jagged = (kit.noise(t * 14 + 6.7, 3.2) - 0.5) * 16;
      const cx = w * 0.5 - bibHalf - jagged;
      ctx.lineTo(cx, cy);
    }
    ctx.closePath();
    ctx.fillStyle = pal.furAccent;
    ctx.fill();
    ctx.restore();

    // Soft underside shadow resting on floor
    const bottomAO = ctx.createLinearGradient(0, h * 0.78, 0, h);
    bottomAO.addColorStop(0, 'rgba(30,18,14,0)');
    bottomAO.addColorStop(1, 'rgba(30,18,14,0.22)');
    ctx.fillStyle = bottomAO;
    ctx.fillRect(0, h * 0.78, w, h * 0.22);

    // Painterly directional fur flecks
    paintFurStrokes(ctx, w, h, rng, kit, {
      count: 3400,
      lenMin: 10,
      lenMax: 24,
      width: 1.8,
      dirAngle: Math.PI * 0.5,
      alpha: 0.26,
      colorFn: (u, v, r) => {
        const distFront = Math.abs(u - 0.5);
        const inBib = v > 0.10 && distFront < (0.15 * Math.sin(clamp((v - 0.08) * 1.15, 0, 1) * Math.PI) + 0.06);
        if (inBib) return r() > 0.45 ? pal.furAccent : mixHex(THREE, pal.furAccent, pal.furLight, 0.22);
        const onBack = distFront > 0.34;
        if (onBack) return r() > 0.42 ? pal.furDark : pal.fur;
        return r() > 0.5 ? pal.furLight : pal.furDark;
      }
    });
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createHeadTexture(THREE, kit, pal) {
  const tex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const rng = makeRng(2083);
    ctx.fillStyle = pal.fur;
    ctx.fillRect(0, 0, w, h);

    // Rich crown & nape depth
    const crownGrad = ctx.createLinearGradient(0, 0, 0, h * 0.42);
    crownGrad.addColorStop(0, pal.furDark);
    crownGrad.addColorStop(0.55, pal.fur);
    crownGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = crownGrad;
    ctx.fillRect(0, 0, w, h * 0.42);
    ctx.globalAlpha = 1;

    // Warm lighter eyebrow spots for extra charm
    for (const side of [-1, 1]) {
      const gx = w * (0.5 + side * 0.065);
      const gy = h * 0.36;
      const g = ctx.createRadialGradient(gx, gy, 2, gx, gy, w * 0.045);
      g.addColorStop(0, pal.furLight);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = g;
      ctx.fillRect(gx - 32, gy - 32, 64, 64);
    }
    ctx.globalAlpha = 1;

    // Iconic stylised fox white cheeks, lower muzzle & chin mask
    // Remember: cx = 0.5*w is front nose (+Z), cx = 0.25*w right cheek, cx = 0.75*w left cheek
    ctx.save();
    ctx.beginPath();
    const nPts = 96;
    for (let i = 0; i <= nPts; i++) {
      const u = 0.14 + (i / nPts) * 0.72;
      const d = Math.abs(u - 0.5);
      // Dip down around nose bridge (d ~ 0) so bridge stays rich fur,
      // rise gracefully up over the fluffy cheeks (d ~ 0.18..0.28),
      // then sweep down toward back of jaw (d ~ 0.36)
      const noseDip = 0.125 * Math.exp(-Math.pow(d / 0.072, 2));
      const cheekArch = 0.075 * Math.exp(-Math.pow((d - 0.22) / 0.11, 2));
      const jawDrop = 0.16 * smoothstep(0.27, 0.36, d);
      const tuftNoise = (kit.noise(u * 26 + 3.4, 2.2) - 0.5) * 0.032;
      const vBoundary = 0.545 + noseDip - cheekArch + jawDrop + tuftNoise;
      const cx = u * w;
      const cy = vBoundary * h;
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.lineTo(w * 0.86, h);
    ctx.lineTo(w * 0.14, h);
    ctx.closePath();
    ctx.fillStyle = pal.furAccent;
    ctx.fill();
    ctx.restore();

    // Subtle warm muzzle-bridge shading right behind nose
    const noseGrad = ctx.createRadialGradient(w * 0.5, h * 0.54, 4, w * 0.5, h * 0.54, w * 0.075);
    noseGrad.addColorStop(0, pal.furDark);
    noseGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = noseGrad;
    ctx.fillRect(w * 0.4, h * 0.44, w * 0.2, h * 0.2);
    ctx.globalAlpha = 1;

    // Fine directional facial fur strokes radiating from snout across cheeks
    paintFurStrokes(ctx, w, h, rng, kit, {
      count: 3200,
      lenMin: 7,
      lenMax: 18,
      width: 1.5,
      alpha: 0.24,
      angleFn: (u, v) => {
        const du = u - 0.5;
        const dv = v - 0.52;
        if (Math.abs(du) < 0.08 && v < 0.55) return -Math.PI * 0.5;
        return Math.atan2(dv * 0.6 + 0.18, du);
      },
      colorFn: (u, v, r) => {
        const d = Math.abs(u - 0.5);
        const noseDip = 0.125 * Math.exp(-Math.pow(d / 0.072, 2));
        const cheekArch = 0.075 * Math.exp(-Math.pow((d - 0.22) / 0.11, 2));
        const jawDrop = 0.16 * smoothstep(0.27, 0.36, d);
        const inWhite = d < 0.35 && v > (0.545 + noseDip - cheekArch + jawDrop);
        if (inWhite) return r() > 0.45 ? pal.furAccent : mixHex(THREE, pal.furAccent, pal.furLight, 0.18);
        return r() > 0.5 ? pal.furLight : pal.furDark;
      }
    });
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createTailTexture(THREE, kit, pal) {
  const tex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const rng = makeRng(3097);
    ctx.fillStyle = pal.fur;
    ctx.fillRect(0, 0, w, h);

    // Dorsal dark brush shading near u = 0 & 1 (top of tail), lighter underside at u = 0.5
    const dorsalL = ctx.createLinearGradient(0, 0, w * 0.32, 0);
    dorsalL.addColorStop(0, pal.furDark);
    dorsalL.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = dorsalL;
    ctx.fillRect(0, 0, w * 0.32, h);

    const dorsalR = ctx.createLinearGradient(w, 0, w * 0.68, 0);
    dorsalR.addColorStop(0, pal.furDark);
    dorsalR.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = dorsalR;
    ctx.fillRect(w * 0.68, 0, w * 0.32, h);

    const belly = ctx.createLinearGradient(w * 0.28, 0, w * 0.72, 0);
    belly.addColorStop(0, 'rgba(255,255,255,0)');
    belly.addColorStop(0.5, pal.furLight);
    belly.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = belly;
    ctx.fillRect(w * 0.28, 0, w * 0.44, h);
    ctx.globalAlpha = 1;

    // Iconic feathery white tail tip at top of canvas (v = 1 => cy = 0)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    const segs = 72;
    for (let i = segs; i >= 0; i--) {
      const u = i / segs;
      const angle = u * Math.PI * 2;
      // Feathery zigzag fur tufts along the white-tip boundary
      const zig = Math.sin(angle * 7) * 0.024 + Math.cos(angle * 13 + 0.8) * 0.014;
      const n = (kit.noise(Math.cos(angle) * 2.4 + 4.1, Math.sin(angle) * 2.4 + 2.7) - 0.5) * 0.045;
      const cy = h * (0.31 + zig + n);
      ctx.lineTo(u * w, cy);
    }
    ctx.closePath();
    ctx.fillStyle = pal.furAccent;
    ctx.fill();
    ctx.restore();

    // Long silky directional fur strokes running base -> tip
    paintFurStrokes(ctx, w, h, rng, kit, {
      count: 3800,
      lenMin: 14,
      lenMax: 34,
      width: 2.0,
      dirAngle: -Math.PI * 0.5,
      alpha: 0.28,
      colorFn: (u, v, r) => {
        const angle = u * Math.PI * 2;
        const border = 0.31 + Math.sin(angle * 7) * 0.024;
        if (v < border) {
          return r() > 0.4 ? pal.furAccent : mixHex(THREE, pal.furAccent, pal.furLight, 0.2);
        }
        const nearTop = Math.min(u, 1 - u) < 0.22;
        if (nearTop) return r() > 0.45 ? pal.furDark : pal.fur;
        return r() > 0.5 ? pal.furLight : pal.furDark;
      }
    });
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createLegTexture(THREE, kit, pal, sockHeight, seed) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const rng = makeRng(seed);
    ctx.fillStyle = pal.fur;
    ctx.fillRect(0, 0, w, h);

    // Subtle warm top-to-lower fur gradient
    const gFur = ctx.createLinearGradient(0, h, 0, h * sockHeight);
    gFur.addColorStop(0, pal.furLight);
    gFur.addColorStop(0.5, pal.fur);
    gFur.addColorStop(1, pal.furDark);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = gFur;
    ctx.fillRect(0, h * sockHeight, w, h * (1 - sockHeight));
    ctx.globalAlpha = 1;

    // Dark velvety fox socks on lower leg & paw (v = 1 => cy = 0)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    const segs = 48;
    for (let i = segs; i >= 0; i--) {
      const u = i / segs;
      const a = u * Math.PI * 2;
      const tuft = Math.sin(a * 6 + 0.4) * 0.022 + (kit.noise(Math.cos(a) * 2 + 5, Math.sin(a) * 2 + 1) - 0.5) * 0.04;
      ctx.lineTo(u * w, h * (sockHeight + tuft));
    }
    ctx.closePath();
    ctx.fillStyle = pal.sock;
    ctx.fill();
    ctx.restore();

    // Soft transition band & fur strokes
    paintFurStrokes(ctx, w, h, rng, kit, {
      count: 1600,
      lenMin: 7,
      lenMax: 16,
      width: 1.6,
      dirAngle: -Math.PI * 0.5,
      alpha: 0.28,
      colorFn: (u, v, r) => {
        if (v < sockHeight) return r() > 0.55 ? pal.sock : mixHex(THREE, pal.sock, pal.furDark, 0.35);
        return r() > 0.5 ? pal.furLight : pal.furDark;
      }
    });
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createOuterEarTexture(THREE, kit, pal) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const rng = makeRng(4111);
    ctx.fillStyle = pal.fur;
    ctx.fillRect(0, 0, w, h);

    // Smooth dark velvety ear-tip gradient (cy = 0 is pointed tip, cy = h is base)
    const tipGrad = ctx.createLinearGradient(0, 0, 0, h * 0.62);
    tipGrad.addColorStop(0, pal.sock);
    tipGrad.addColorStop(0.45, pal.sock);
    tipGrad.addColorStop(0.75, pal.furDark);
    tipGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = tipGrad;
    ctx.fillRect(0, 0, w, h * 0.65);

    paintFurStrokes(ctx, w, h, rng, kit, {
      count: 1400,
      lenMin: 6,
      lenMax: 15,
      width: 1.5,
      dirAngle: -Math.PI * 0.5,
      alpha: 0.28,
      colorFn: (_u, v, r) => {
        if (v < 0.36) return r() > 0.5 ? pal.sock : mixHex(THREE, pal.sock, '#ffffff', 0.14);
        if (v < 0.55) return r() > 0.5 ? pal.furDark : pal.sock;
        return r() > 0.5 ? pal.furLight : pal.fur;
      }
    });
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createInnerEarTexture(THREE, kit, pal) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const rng = makeRng(4229);
    ctx.fillStyle = pal.furAccent;
    ctx.fillRect(0, 0, w, h);

    const g = ctx.createRadialGradient(w * 0.5, h * 0.58, 6, w * 0.5, h * 0.55, w * 0.44);
    g.addColorStop(0, pal.earInner);
    g.addColorStop(0.62, mixHex(THREE, pal.earInner, pal.furAccent, 0.35));
    g.addColorStop(1, pal.furAccent);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Gentle shadow near ear tip inside
    const tipS = ctx.createLinearGradient(0, 0, 0, h * 0.42);
    tipS.addColorStop(0, pal.sock);
    tipS.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = tipS;
    ctx.fillRect(0, 0, w, h * 0.42);
    ctx.globalAlpha = 1;

    paintFurStrokes(ctx, w, h, rng, kit, {
      count: 750,
      lenMin: 5,
      lenMax: 12,
      width: 1.3,
      dirAngle: -Math.PI * 0.5,
      alpha: 0.22,
      colorFn: (_u, _v, r) => (r() > 0.5 ? pal.furAccent : pal.earInner)
    });
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createIrisTexture(THREE, kit, pal) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const rad = w * 0.48;

    // Dark glossy outer limbal ring
    const baseG = ctx.createRadialGradient(cx, cy, rad * 0.25, cx, cy, rad);
    baseG.addColorStop(0, shiftColor(THREE, pal.eye, 0.02, 0.1, 0.14));
    baseG.addColorStop(0.68, pal.eye);
    baseG.addColorStop(0.86, shiftColor(THREE, pal.eye, -0.02, 0.05, -0.26));
    baseG.addColorStop(1, '#140f0e');
    ctx.fillStyle = baseG;
    ctx.fillRect(0, 0, w, h);

    // Luminous sunlit lower iris crescent
    const glowG = ctx.createRadialGradient(cx, cy + rad * 0.34, 4, cx, cy + rad * 0.26, rad * 0.56);
    glowG.addColorStop(0, mixHex(THREE, pal.eye, '#fff4cc', 0.65));
    glowG.addColorStop(0.65, mixHex(THREE, pal.eye, '#ffe7a8', 0.25));
    glowG.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = glowG;
    ctx.beginPath();
    ctx.arc(cx, cy, rad * 0.84, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Delicate radial iris fibers
    const rng = makeRng(5199);
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2 + (rng() - 0.5) * 0.04;
      const r0 = rad * (0.44 + rng() * 0.06);
      const r1 = rad * (0.82 + rng() * 0.08);
      ctx.strokeStyle = rng() > 0.5 ? mixHex(THREE, pal.eye, '#ffffff', 0.32) : shiftColor(THREE, pal.eye, 0, 0, -0.22);
      ctx.globalAlpha = 0.24;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Upper eyelid shadow softly across top of iris
    const topShade = ctx.createLinearGradient(0, cy - rad, 0, cy + rad * 0.1);
    topShade.addColorStop(0, 'rgba(18,12,12,0.58)');
    topShade.addColorStop(0.55, 'rgba(18,12,12,0.18)');
    topShade.addColorStop(1, 'rgba(18,12,12,0)');
    ctx.fillStyle = topShade;
    ctx.fillRect(0, 0, w, h);

    // Expressive large dark pupil
    const pupG = ctx.createRadialGradient(cx, cy, rad * 0.15, cx, cy, rad * 0.56);
    pupG.addColorStop(0, '#090708');
    pupG.addColorStop(0.84, '#130e10');
    pupG.addColorStop(1, 'rgba(19,14,16,0)');
    ctx.fillStyle = pupG;
    ctx.beginPath();
    ctx.arc(cx, cy, rad * 0.56, 0, Math.PI * 2);
    ctx.fill();
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBlushTexture(THREE, kit, pal) {
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    const c = new THREE.Color(pal.blush);
    const r = Math.round(c.r * 255);
    const g = Math.round(c.g * 255);
    const b = Math.round(c.b * 255);
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 4, w * 0.5, h * 0.5, w * 0.48);
    grad.addColorStop(0, `rgba(${r},${g},${b},0.62)`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b},0.28)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function tagMesh(mesh, slot, castShadow = true) {
  mesh.userData.slot = slot;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

function saveBase(obj) {
  obj.userData.base = {
    pos: obj.position.clone(),
    rot: obj.rotation.clone(),
    scale: obj.scale.clone()
  };
}

export function build(THREE, opts = {}, kit) {
  const pal = getPalette(THREE, opts);

  const root = new THREE.Group();
  root.name = 'stylisedFox';

  // Inner centering rig so visual mass sits balanced over world origin (0, 0, 0)
  const rig = new THREE.Group();
  rig.position.set(0.022, 0, 0.015);
  root.add(rig);

  // Shared procedural textures
  const furBump = createFurBumpTexture(THREE, kit, 9001, true);
  const bodyTex = createBodyTexture(THREE, kit, pal);
  const headTex = createHeadTexture(THREE, kit, pal);
  const tailTex = createTailTexture(THREE, kit, pal);
  const frontLegTex = createLegTexture(THREE, kit, pal, 0.52, 6101);
  const hindLegTex = createLegTexture(THREE, kit, pal, 0.38, 6203);
  const outerEarTex = createOuterEarTexture(THREE, kit, pal);
  const innerEarTex = createInnerEarTexture(THREE, kit, pal);
  const irisTex = createIrisTexture(THREE, kit, pal);
  const blushTex = createBlushTexture(THREE, kit, pal);

  // Materials (MeshPhysicalMaterial)
  const bodyMat = new THREE.MeshPhysicalMaterial({
    map: bodyTex,
    bumpMap: furBump,
    bumpScale: 0.0022,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.85,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color(pal.furSheen)
  });

  const headMat = new THREE.MeshPhysicalMaterial({
    map: headTex,
    bumpMap: furBump,
    bumpScale: 0.0018,
    roughness: 0.90,
    metalness: 0.0,
    sheen: 0.85,
    sheenRoughness: 0.70,
    sheenColor: new THREE.Color(pal.furSheen)
  });

  const accentFurMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(pal.furAccent),
    bumpMap: furBump,
    bumpScale: 0.0020,
    roughness: 0.93,
    metalness: 0.0,
    sheen: 0.88,
    sheenRoughness: 0.68,
    sheenColor: new THREE.Color(pal.accentSheen)
  });

  const tailMat = new THREE.MeshPhysicalMaterial({
    map: tailTex,
    bumpMap: furBump,
    bumpScale: 0.0026,
    roughness: 0.93,
    metalness: 0.0,
    sheen: 0.92,
    sheenRoughness: 0.65,
    sheenColor: new THREE.Color(pal.furSheen)
  });

  const frontLegMat = new THREE.MeshPhysicalMaterial({
    map: frontLegTex,
    bumpMap: furBump,
    bumpScale: 0.0018,
    roughness: 0.91,
    metalness: 0.0,
    sheen: 0.78,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color(pal.furSheen)
  });

  const hindLegMat = new THREE.MeshPhysicalMaterial({
    map: hindLegTex,
    bumpMap: furBump,
    bumpScale: 0.0020,
    roughness: 0.91,
    metalness: 0.0,
    sheen: 0.80,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color(pal.furSheen)
  });

  const outerEarMat = new THREE.MeshPhysicalMaterial({
    map: outerEarTex,
    bumpMap: furBump,
    bumpScale: 0.0016,
    roughness: 0.90,
    metalness: 0.0,
    sheen: 0.80,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color(pal.furSheen)
  });

  const innerEarMat = new THREE.MeshPhysicalMaterial({
    map: innerEarTex,
    bumpMap: furBump,
    bumpScale: 0.0010,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.65,
    sheenRoughness: 0.78,
    sheenColor: new THREE.Color(pal.accentSheen)
  });

  const eyeBaseMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#140e0e'),
    roughness: 0.05,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04
  });

  const irisMat = new THREE.MeshPhysicalMaterial({
    map: irisTex,
    roughness: 0.06,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05
  });

  const highlightMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffffff'),
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.45,
    roughness: 0.04,
    clearcoat: 1.0
  });

  const noseMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(pal.nose),
    roughness: 0.18,
    metalness: 0.0,
    clearcoat: 0.88,
    clearcoatRoughness: 0.12
  });

  const darkFeatureMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(pal.nose),
    roughness: 0.35,
    metalness: 0.0,
    clearcoat: 0.45
  });

  const whiskerMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(pal.whisker),
    roughness: 0.55,
    metalness: 0.0
  });

  const padMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(pal.pad),
    roughness: 0.52,
    metalness: 0.0,
    clearcoat: 0.25
  });

  const clawMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#1c1616'),
    roughness: 0.16,
    metalness: 0.0,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1
  });

  const blushMat = new THREE.MeshPhysicalMaterial({
    map: blushTex,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    roughness: 0.95
  });

  // =========================================================================
  // 1. BODY GROUP (sculpted torso + plush sculpted chest ruff)
  // =========================================================================
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'body';
  bodyGroup.position.set(0, 0, -0.025);
  rig.add(bodyGroup);

  const bodyMesh = tagMesh(new THREE.Mesh(buildSculptedBody(THREE, kit), bodyMat), 'fur');
  bodyGroup.add(bodyMesh);

  const chestRuff = tagMesh(new THREE.Mesh(buildChestRuff(THREE, kit), accentFurMat), 'furAccent');
  chestRuff.position.set(0, 0.132, 0.056);
  chestRuff.rotation.x = 0.18;
  bodyGroup.add(chestRuff);

  // =========================================================================
  // 2. HEAD GROUP (continuous sculpted head + ears + 3-layer expressive face)
  // =========================================================================
  const headGroup = new THREE.Group();
  headGroup.name = 'head';
  headGroup.position.set(0, 0.214, 0.026);
  // Charming curious slight tilt and turn
  headGroup.rotation.set(0.06, -0.09, 0.085);
  rig.add(headGroup);

  const headMesh = tagMesh(new THREE.Mesh(buildSculptedHead(THREE, kit), headMat), 'fur');
  headGroup.add(headMesh);

  // Helper to evaluate head surface point & outward normal cleanly
  const headSurfaceInfo = (nx, ny, nz) => {
    const dir = new THREE.Vector3(nx, ny, nz).normalize();
    const p = sculptHeadPoint(dir.x, dir.y, dir.z, new THREE.Vector3());
    const eps = 0.025;
    const t1 = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    if (t1.lengthSq() < 0.01) t1.set(1, 0, 0);
    const t2 = new THREE.Vector3().crossVectors(dir, t1).normalize();
    const d1 = dir.clone().addScaledVector(t1, eps).normalize();
    const d2 = dir.clone().addScaledVector(t2, eps).normalize();
    const p1 = sculptHeadPoint(d1.x, d1.y, d1.z, new THREE.Vector3());
    const p2 = sculptHeadPoint(d2.x, d2.y, d2.z, new THREE.Vector3());
    const n = new THREE.Vector3().crossVectors(p1.sub(p), p2.sub(p)).normalize();
    if (n.dot(dir) < 0) n.negate();
    return { pos: p, normal: n };
  };

  // Sculpted Ears (earL at +X, earR at -X)
  const { outerGeo, innerGeo } = buildEarGeometries(THREE);

  function createEar(side, name) {
    const earGroup = new THREE.Group();
    earGroup.name = name;
    // Deeply overlap ear base into upper cranium so there is no gap
    earGroup.position.set(side * 0.045, 0.044, -0.010);
    earGroup.rotation.set(
      0.08 + (side < 0 ? 0.04 : 0),
      side * 0.24,
      -side * (0.28 + (side < 0 ? 0.06 : 0))
    );

    const outerMesh = tagMesh(new THREE.Mesh(outerGeo, outerEarMat), 'fur');
    const innerMesh = tagMesh(new THREE.Mesh(innerGeo, innerEarMat), 'skin');
    earGroup.add(outerMesh, innerMesh);

    // 3 wispy cream inner-ear fur tufts sweeping softly across the lower ear opening
    for (let k = 0; k < 3; k++) {
      const yBase = 0.013 + k * 0.010;
      const tuftCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-side * 0.022, yBase, 0.004),
        new THREE.Vector3(-side * 0.009, yBase + 0.006, 0.0065),
        new THREE.Vector3(side * (0.004 - k * 0.002), yBase + 0.009, 0.005)
      ]);
      const tuftGeo = createTaperedTube(THREE, tuftCurve, {
        tubularSegments: 10,
        radialSegments: 7,
        radiusFn: (t) => 0.0038 * (1 - 0.85 * t) * Math.sin(t * Math.PI * 0.85 + 0.35)
      });
      const tuftMesh = tagMesh(new THREE.Mesh(tuftGeo, accentFurMat), 'furAccent', false);
      earGroup.add(tuftMesh);
    }

    headGroup.add(earGroup);
    return earGroup;
  }

  const earL = createEar(1, 'earL');
  const earR = createEar(-1, 'earR');

  // Expressive 3-layer Eyes (eyeL at +X, eyeR at -X)
  const eyeLensGeo = buildEyeLensGeometry(THREE);
  const irisGeo = buildIrisGeometry(THREE);
  const hlMainGeo = new THREE.SphereGeometry(0.0040, 14, 10);
  hlMainGeo.scale(1.15, 0.95, 0.45);
  const hlSubGeo = new THREE.SphereGeometry(0.0019, 10, 8);
  hlSubGeo.scale(1.0, 1.0, 0.45);

  function createEye(side, name) {
    const eyeGroup = new THREE.Group();
    eyeGroup.name = name;

    const info = headSurfaceInfo(side * 0.44, 0.055, 0.89);
    // Slightly inset into sculpted socket
    eyeGroup.position.copy(info.pos).addScaledVector(info.normal, -0.0032);
    const lookTarget = eyeGroup.position.clone().add(info.normal);
    eyeGroup.lookAt(lookTarget);

    // Layer 1: Dark glossy eye dome (LatheGeometry)
    const baseEye = tagMesh(new THREE.Mesh(eyeLensGeo, eyeBaseMat), 'eye', false);
    eyeGroup.add(baseEye);

    // Layer 2: Coloured radial iris ring
    const irisMesh = tagMesh(new THREE.Mesh(irisGeo, irisMat), 'eye', false);
    eyeGroup.add(irisMesh);

    // Layer 3: Crisp glossy catchlight highlight dots (up and to one side)
    const hl1 = tagMesh(new THREE.Mesh(hlMainGeo, highlightMat), 'eye', false);
    hl1.position.set(0.0052, 0.0054, 0.0086);
    hl1.rotation.set(-0.28, 0.32, 0);
    const hl2 = tagMesh(new THREE.Mesh(hlSubGeo, highlightMat), 'eye', false);
    hl2.position.set(-0.0046, -0.0042, 0.0085);
    eyeGroup.add(hl1, hl2);

    // Subtle upper lash-line curve hugging top rim of eye
    const lashCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-side * 0.0155, 0.0035, 0.0045),
      new THREE.Vector3(-side * 0.006, 0.0145, 0.0068),
      new THREE.Vector3(side * 0.008, 0.0140, 0.0062),
      new THREE.Vector3(side * 0.0185, 0.0075, 0.0025)
    ]);
    const lashGeo = createTaperedTube(THREE, lashCurve, {
      tubularSegments: 14,
      radialSegments: 8,
      radiusFn: (t) => 0.0018 * Math.sin(t * Math.PI * 0.82 + 0.25) + 0.0004
    });
    const lashMesh = tagMesh(new THREE.Mesh(lashGeo, darkFeatureMat), 'secondary', false);
    eyeGroup.add(lashMesh);

    headGroup.add(eyeGroup);
    return eyeGroup;
  }

  const eyeL = createEye(1, 'eyeL');
  const eyeR = createEye(-1, 'eyeR');

  // Subtle Blush Discs beneath the eyes on the cheek contour
  const blushGeo = new THREE.CircleGeometry(0.0175, 24);
  blushGeo.scale(1.22, 0.78, 1);
  for (const side of [1, -1]) {
    const bInfo = headSurfaceInfo(side * 0.56, -0.14, 0.81);
    const blush = new THREE.Mesh(blushGeo, blushMat);
    blush.userData.slot = 'skin';
    blush.castShadow = false;
    blush.receiveShadow = false;
    blush.position.copy(bInfo.pos).addScaledVector(bInfo.normal, 0.0012);
    blush.lookAt(blush.position.clone().add(bInfo.normal));
    headGroup.add(blush);
  }

  // Sculpted Dark Glossy Nose at muzzle tip
  const noseInfo = headSurfaceInfo(0, -0.17, 0.985);
  const noseMesh = tagMesh(new THREE.Mesh(buildNoseGeometry(THREE), noseMat), 'secondary');
  noseMesh.position.copy(noseInfo.pos).add(new THREE.Vector3(0, 0.001, 0.0015));
  noseMesh.rotation.x = 0.14;
  headGroup.add(noseMesh);

  // Curved Gentle Fox Smile (thin tapered tubes hugging muzzle underside)
  const philtrumCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, noseInfo.pos.y - 0.006, noseInfo.pos.z + 0.001),
    new THREE.Vector3(0, noseInfo.pos.y - 0.013, noseInfo.pos.z - 0.003)
  ]);
  headGroup.add(tagMesh(new THREE.Mesh(createTaperedTube(THREE, philtrumCurve, {
    tubularSegments: 6,
    radialSegments: 6,
    radiusFn: () => 0.00105
  }), darkFeatureMat), 'secondary', false));

  for (const side of [1, -1]) {
    const m1 = headSurfaceInfo(side * 0.10, -0.34, 0.935).pos;
    const m2 = headSurfaceInfo(side * 0.22, -0.31, 0.92).pos;
    const mouthCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, noseInfo.pos.y - 0.013, noseInfo.pos.z - 0.003),
      new THREE.Vector3(m1.x, m1.y - 0.0015, m1.z + 0.0012),
      new THREE.Vector3(m2.x, m2.y + 0.0020, m2.z + 0.0005)
    ]);
    const mouthGeo = createTaperedTube(THREE, mouthCurve, {
      tubularSegments: 12,
      radialSegments: 6,
      radiusFn: (t) => 0.00125 * (1 - 0.35 * t)
    });
    headGroup.add(tagMesh(new THREE.Mesh(mouthGeo, darkFeatureMat), 'secondary', false));
  }

  // Delicate Curved Whiskers (3 per cheek)
  for (const side of [1, -1]) {
    for (let k = 0; k < 3; k++) {
      const start = headSurfaceInfo(side * 0.28, -0.23 - k * 0.045, 0.91 - k * 0.02).pos;
      const len = 0.036 + (k === 1 ? 0.007 : 0);
      const lift = (1 - k) * 0.006;
      const wCurve = new THREE.CatmullRomCurve3([
        start.clone().add(new THREE.Vector3(-side * 0.003, 0, -0.002)),
        start.clone().add(new THREE.Vector3(side * len * 0.55, lift * 0.5, 0.003)),
        start.clone().add(new THREE.Vector3(side * len, lift - 0.005, -0.007))
      ]);
      const wGeo = createTaperedTube(THREE, wCurve, {
        tubularSegments: 10,
        radialSegments: 5,
        radiusFn: (t) => 0.00085 * (1 - 0.72 * t)
      });
      headGroup.add(tagMesh(new THREE.Mesh(wGeo, whiskerMat), 'secondary', false));
    }
  }

  // =========================================================================
  // 3. BIG WRAPPED BRUSH TAIL (ring-by-ring tapered tube, lush white tip)
  // =========================================================================
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tail';
  tailGroup.position.set(0, 0.048, -0.105);
  rig.add(tailGroup);

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.000, 0.006, 0.024),   // deeply embedded inside lower rump
    new THREE.Vector3(-0.048, -0.006, -0.068), // curves out behind to the right
    new THREE.Vector3(-0.132, -0.005, -0.052), // lush sweep around right flank
    new THREE.Vector3(-0.148, -0.002, 0.062),  // hugs alongside right side
    new THREE.Vector3(-0.088, 0.000, 0.184),   // wraps cozily around front
    new THREE.Vector3(0.018, 0.012, 0.244),    // arches across front of paws
    new THREE.Vector3(0.095, 0.038, 0.258)     // fluffy white tip curling upward
  ]);

  const tailGeo = createTaperedTube(THREE, tailCurve, {
    tubularSegments: 64,
    radialSegments: 32,
    preferUp: new THREE.Vector3(0, 1, 0),
    radiusFn: (t, angle) => {
      // Plush fox-brush profile: slender base, big full mid-plume, pointed feathery tip
      const baseSwell = smoothstep(0.0, 0.24, t);
      const tipTaper = 1 - Math.pow(smoothstep(0.68, 1.0, t), 1.45);
      const midBelly = Math.sin(t * Math.PI) * 0.012;
      let r = (0.024 + 0.026 * baseSwell + midBelly) * (0.06 + 0.94 * tipTaper);
      if (t > 0.96) r *= 1 - smoothstep(0.96, 1.0, t) * 0.88;

      // Subtle sculpted fur-plume ridges along length
      const ridges = 1 + 0.042 * Math.sin(angle * 7 + t * 5.2) + 0.026 * Math.cos(angle * 4 - t * 3.1);
      // Slight elliptical cross-section (slightly plush wider)
      const ellipse = 1 + 0.06 * Math.cos(angle * 2);
      return r * ridges * ellipse;
    },
    deformFn: (vPos, t, angle) => {
      // Gently flatten underside against diorama floor (local y = -0.048 is world y = 0)
      const floorLocalY = -0.0468;
      if (vPos.y < floorLocalY + 0.014) {
        const s = smoothstep(floorLocalY + 0.014, floorLocalY - 0.015, vPos.y);
        vPos.y = vPos.y * (1 - s) + floorLocalY * s;
      }
      // Slight subtle furry organic modulation
      const f = (kit.noise(t * 8.5 + 1.1, Math.cos(angle) * 2.2 + 3.4) - 0.5) * 0.0024;
      vPos.y += f;
    }
  });
  const tailMesh = tagMesh(new THREE.Mesh(tailGeo, tailMat), 'fur');
  tailGroup.add(tailMesh);

  // =========================================================================
  // 4. LIMBS WITH DARK SOCKS & SCULPTED PAWS (armL planted, armR raised!)
  // =========================================================================
  function addPawDetails(parent, pos, rot, showPads) {
    const pawGroup = new THREE.Group();
    pawGroup.position.copy(pos);
    pawGroup.rotation.copy(rot);

    // 3 tiny tucked glossy dark claws at the toe front
    const clawGeo = new THREE.ConeGeometry(0.0026, 0.0075, 8);
    clawGeo.rotateX(Math.PI * 0.62);
    for (const dx of [-0.0085, 0, 0.0085]) {
      const claw = tagMesh(new THREE.Mesh(clawGeo, clawMat), 'secondary', false);
      claw.position.set(dx, -0.003, 0.016 - Math.abs(dx) * 0.25);
      pawGroup.add(claw);
    }

    if (showPads) {
      // Cozy soft paw pads visible on the raised playful paw
      const mainPadGeo = new THREE.SphereGeometry(0.0068, 14, 10);
      mainPadGeo.scale(1.18, 0.45, 1.0);
      const mainPad = tagMesh(new THREE.Mesh(mainPadGeo, padMat), 'skin', false);
      mainPad.position.set(0, -0.0122, -0.001);
      pawGroup.add(mainPad);

      const toePadGeo = new THREE.SphereGeometry(0.0033, 10, 8);
      toePadGeo.scale(0.95, 0.45, 1.15);
      const toeOffsets = [
        [-0.0072, -0.0112, 0.0078],
        [0.0, -0.0114, 0.0102],
        [0.0072, -0.0112, 0.0078]
      ];
      for (const [tx, ty, tz] of toeOffsets) {
        const tp = tagMesh(new THREE.Mesh(toePadGeo, padMat), 'skin', false);
        tp.position.set(tx, ty, tz);
        pawGroup.add(tp);
      }
    }

    parent.add(pawGroup);
  }

  // Front Left Leg (armL at +X, solidly planted on the floor)
  const armL = new THREE.Group();
  armL.name = 'armL';
  armL.position.set(0.044, 0.138, 0.022);
  rig.add(armL);

  const armLCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.012, 0.010, -0.024), // deep inside shoulder
    new THREE.Vector3(0.010, -0.042, 0.008),  // upper arm / elbow
    new THREE.Vector3(0.011, -0.112, 0.032),  // slender dark-sock forearm
    new THREE.Vector3(0.012, -0.123, 0.056)   // neat planted paw
  ]);

  const armLGeo = createTaperedTube(THREE, armLCurve, {
    tubularSegments: 32,
    radialSegments: 20,
    radiusFn: (t, angle) => {
      const upper = 0.028 * (1 - smoothstep(0.0, 0.55, t));
      const wrist = 0.0148;
      const pawSwell = 0.0068 * Math.exp(-Math.pow((t - 0.90) / 0.11, 2));
      const tipClose = 1 - smoothstep(0.94, 1.0, t) * 0.42;
      const toeScallop = 1 + 0.05 * smoothstep(0.82, 0.98, t) * Math.cos(angle * 3);
      return (wrist + upper * 0.52 + pawSwell) * tipClose * toeScallop;
    },
    deformFn: (vPos) => {
      // Flatten planted paw sole cleanly onto floor (armL.y = 0.138 => floor local y = -0.138)
      const floorLocal = -0.1368;
      if (vPos.y < floorLocal + 0.008) {
        const s = smoothstep(floorLocal + 0.008, floorLocal - 0.012, vPos.y);
        vPos.y = vPos.y * (1 - s) + floorLocal * s;
      }
    }
  });
  armL.add(tagMesh(new THREE.Mesh(armLGeo, frontLegMat), 'fur'));
  addPawDetails(armL, new THREE.Vector3(0.012, -0.125, 0.055), new THREE.Euler(0, 0.06, 0), false);

  // Front Right Leg (armR at -X, gently lifted & curled in a curious cozy pose!)
  const armR = new THREE.Group();
  armR.name = 'armR';
  armR.position.set(-0.044, 0.138, 0.022);
  rig.add(armR);

  const armRCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.012, 0.010, -0.024),   // deep inside shoulder
    new THREE.Vector3(-0.014, -0.036, 0.014),  // gentle lifted elbow
    new THREE.Vector3(-0.004, -0.042, 0.062),  // forearm lifted above tail
    new THREE.Vector3(0.004, -0.054, 0.082)    // softly curled paw!
  ]);

  const armRGeo = createTaperedTube(THREE, armRCurve, {
    tubularSegments: 32,
    radialSegments: 20,
    radiusFn: (t, angle) => {
      const upper = 0.028 * (1 - smoothstep(0.0, 0.55, t));
      const wrist = 0.0145;
      const pawSwell = 0.0066 * Math.exp(-Math.pow((t - 0.89) / 0.11, 2));
      const tipClose = 1 - smoothstep(0.94, 1.0, t) * 0.42;
      const toeScallop = 1 + 0.05 * smoothstep(0.82, 0.98, t) * Math.cos(angle * 3);
      return (wrist + upper * 0.52 + pawSwell) * tipClose * toeScallop;
    }
  });
  armR.add(tagMesh(new THREE.Mesh(armRGeo, frontLegMat), 'fur'));
  addPawDetails(armR, new THREE.Vector3(0.004, -0.054, 0.081), new THREE.Euler(0.68, 0.16, -0.1), true);

  // Hind Legs (legL at +X, legR at -X, folded seated haunches + resting hind paws)
  function createHindLeg(side, name) {
    const legGroup = new THREE.Group();
    legGroup.name = name;
    legGroup.position.set(side * 0.048, 0.072, -0.054);
    rig.add(legGroup);

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-side * 0.016, 0.014, -0.012), // deep inside body hip
      new THREE.Vector3(side * 0.026, -0.010, 0.014),  // plush folded haunch thigh
      new THREE.Vector3(side * 0.024, -0.052, 0.002),  // tucked hock/ankle
      new THREE.Vector3(side * 0.028, -0.057, 0.062)   // resting hind paw
    ]);

    const legGeo = createTaperedTube(THREE, curve, {
      tubularSegments: 32,
      radialSegments: 20,
      radiusFn: (t, angle) => {
        const haunch = 0.028 * Math.exp(-Math.pow((t - 0.25) / 0.26, 2));
        const base = 0.0155;
        const paw = 0.0072 * Math.exp(-Math.pow((t - 0.89) / 0.12, 2));
        const tipClose = 1 - smoothstep(0.94, 1.0, t) * 0.40;
        const toeScallop = 1 + 0.045 * smoothstep(0.82, 0.98, t) * Math.cos(angle * 3);
        return (base + haunch + paw) * tipClose * toeScallop;
      },
      deformFn: (vPos) => {
        // Flatten hind paw & lower hock onto floor (legGroup.y = 0.072 => floor local y = -0.072)
        const floorLocal = -0.0708;
        if (vPos.y < floorLocal + 0.008) {
          const s = smoothstep(floorLocal + 0.008, floorLocal - 0.014, vPos.y);
          vPos.y = vPos.y * (1 - s) + floorLocal * s;
        }
      }
    });

    legGroup.add(tagMesh(new THREE.Mesh(legGeo, hindLegMat), 'fur'));
    addPawDetails(legGroup, new THREE.Vector3(side * 0.028, -0.058, 0.060), new THREE.Euler(0, side * 0.14, 0), false);
    return legGroup;
  }

  const legL = createHindLeg(1, 'legL');
  const legR = createHindLeg(-1, 'legR');

  // Record base transforms for clean deterministic idle animation
  saveBase(bodyGroup);
  saveBase(headGroup);
  saveBase(tailGroup);
  saveBase(earL);
  saveBase(earR);
  saveBase(armL);
  saveBase(armR);
  saveBase(legL);
  saveBase(legR);
  saveBase(eyeL);
  saveBase(eyeR);

  return root;
}

export function idle(group, t) {
  const body = group.getObjectByName('body');
  const head = group.getObjectByName('head');
  const tail = group.getObjectByName('tail');
  const earL = group.getObjectByName('earL');
  const earR = group.getObjectByName('earR');
  const armR = group.getObjectByName('armR');
  const eyeL = group.getObjectByName('eyeL');
  const eyeR = group.getObjectByName('eyeR');

  const breath = Math.sin(t * 2.05);
  const slow = Math.sin(t * 0.72);
  const slow2 = Math.sin(t * 0.47 + 1.1);

  if (body?.userData.base) {
    const b = body.userData.base;
    body.scale.set(
      b.scale.x * (1 - 0.007 * breath),
      b.scale.y * (1 + 0.014 * breath),
      b.scale.z * (1 + 0.013 * breath)
    );
  }

  if (head?.userData.base) {
    const b = head.userData.base;
    head.position.y = b.pos.y + 0.0022 * breath;
    head.rotation.x = b.rot.x + 0.022 * breath + 0.03 * slow2;
    head.rotation.y = b.rot.y + 0.085 * slow;
    head.rotation.z = b.rot.z + 0.048 * Math.sin(t * 0.62 + 0.5);
  }

  // Gentle ear sway + occasional cute quick ear flick
  const flickPhaseL = (t + 1.4) % 5.2;
  const flickL = flickPhaseL < 0.24 ? Math.sin((flickPhaseL / 0.24) * Math.PI) : 0;
  const flickPhaseR = (t + 3.9) % 6.4;
  const flickR = flickPhaseR < 0.22 ? Math.sin((flickPhaseR / 0.22) * Math.PI) : 0;

  if (earL?.userData.base) {
    const b = earL.userData.base;
    earL.rotation.z = b.rot.z - 0.03 * breath - 0.14 * flickL;
    earL.rotation.x = b.rot.x + 0.025 * slow - 0.06 * flickL;
  }

  if (earR?.userData.base) {
    const b = earR.userData.base;
    earR.rotation.z = b.rot.z + 0.03 * breath + 0.16 * flickR;
    earR.rotation.x = b.rot.x - 0.025 * slow - 0.07 * flickR;
  }

  // Cozy brush tail gentle wag & breathe lift
  if (tail?.userData.base) {
    const b = tail.userData.base;
    tail.rotation.y = b.rot.y + 0.048 * Math.sin(t * 1.15);
    tail.rotation.x = b.rot.x + 0.018 * Math.sin(t * 2.05 - 0.6);
  }

  // Lifted paw gentle curious bob
  if (armR?.userData.base) {
    const b = armR.userData.base;
    armR.position.y = b.pos.y + 0.0025 * breath;
    armR.rotation.x = b.rot.x - 0.065 * Math.sin(t * 1.35 + 0.4);
    armR.rotation.z = b.rot.z + 0.03 * slow;
  }

  // Natural periodic eye blink every ~3.8 seconds (with occasional soft double-blink)
  const blinkCycle = t % 3.8;
  let blinkAmt = 0;
  if (blinkCycle > 3.55 && blinkCycle < 3.74) {
    blinkAmt = Math.sin(((blinkCycle - 3.55) / 0.19) * Math.PI);
  } else if ((t % 11.4) > 10.75 && (t % 11.4) < 10.92) {
    blinkAmt = Math.sin((((t % 11.4) - 10.75) / 0.17) * Math.PI);
  }
  const eyeScaleY = 1 - 0.92 * blinkAmt * blinkAmt;

  if (eyeL?.userData.base) {
    eyeL.scale.y = eyeL.userData.base.scale.y * eyeScaleY;
  }
  if (eyeR?.userData.base) {
    eyeR.scale.y = eyeR.userData.base.scale.y * eyeScaleY;
  }
}
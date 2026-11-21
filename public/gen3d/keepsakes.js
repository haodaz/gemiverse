const DEFAULTS = {
  primary: 0xd96b52,
  secondary: 0xf3e8d6,
  accent: 0xf0b849,
  wood: 0xa6784e,
  metal: 0xc8ced4,
  fabric: 0x6b88a8,
  skin: 0xe8be9e,
  fur: 0xc9a37c,
  furAccent: 0xf5ede0,
};

function resolveOpts(opts = {}) {
  const v = Number.isFinite(opts.variant) ? Math.abs(Math.floor(opts.variant)) % 3 : 0;
  return {
    primary: opts.primary ?? DEFAULTS.primary,
    secondary: opts.secondary ?? DEFAULTS.secondary,
    accent: opts.accent ?? DEFAULTS.accent,
    wood: opts.wood ?? DEFAULTS.wood,
    metal: opts.metal ?? DEFAULTS.metal,
    fabric: opts.fabric ?? DEFAULTS.fabric,
    skin: opts.skin ?? DEFAULTS.skin,
    fur: opts.fur ?? DEFAULTS.fur,
    furAccent: opts.furAccent ?? DEFAULTS.furAccent,
    variant: v,
    count: opts.count,
  };
}

function seededRand(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeMat(THREE, color, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.65,
    metalness: 0.05,
    ...extra,
  });
}

function makeGlassMat(THREE, opacity = 0.32) {
  return new THREE.MeshStandardMaterial({
    color: 0xeef7ff,
    roughness: 0.08,
    metalness: 0.08,
    transparent: true,
    opacity,
    depthWrite: false,
  });
}

function addMesh(parent, geo, mat, slot, pos, rot, scale) {
  const m = new parent.constructor.prototype.constructor === Object
    ? null
    : null;
  void m;
  const mesh = new mat.constructor.prototype.constructor === Object ? null : null;
  void mesh;
  return null;
}

function place(THREE, parent, geo, mat, slot, pos, rot, scale, extraData) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (slot) mesh.userData.slot = slot;
  if (extraData) Object.assign(mesh.userData, extraData);
  if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
  if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
  if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
  parent.add(mesh);
  return mesh;
}

function roundedRectShape(THREE, w, h, r) {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const cr = Math.max(0.0004, Math.min(r, hw * 0.95, hh * 0.95));
  const s = new THREE.Shape();
  s.moveTo(-hw + cr, -hh);
  s.lineTo(hw - cr, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + cr);
  s.lineTo(hw, hh - cr);
  s.quadraticCurveTo(hw, hh, hw - cr, hh);
  s.lineTo(-hw + cr, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - cr);
  s.lineTo(-hw, -hh + cr);
  s.quadraticCurveTo(-hw, -hh, -hw + cr, -hh);
  return s;
}

function roundedBox(THREE, w, h, d, r = 0.004, bevel = 0.002) {
  const b = Math.min(bevel, w * 0.25, h * 0.25, d * 0.35);
  const iw = Math.max(0.0008, w - b * 2);
  const ih = Math.max(0.0008, h - b * 2);
  const id = Math.max(0.0006, d - b * 2);
  const shape = roundedRectShape(THREE, iw, ih, Math.max(0.0004, r - b));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: id,
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
    curveSegments: 8,
  });
  geo.translate(0, 0, -id * 0.5);
  return geo;
}

function starShape(THREE, outerR, innerR, points = 5) {
  const s = new THREE.Shape();
  const step = Math.PI / points;
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? outerR : innerR;
    const a = i * step - Math.PI * 0.5;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function starGeo(THREE, outerR, innerR, depth = 0.004, bevel = 0.0012) {
  const shape = starShape(THREE, outerR, innerR, 5);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -depth * 0.5);
  return geo;
}

function ticketShape(THREE, w, h, notchR) {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const nr = Math.min(notchR, hh * 0.35);
  const s = new THREE.Shape();
  s.moveTo(-hw, -hh);
  s.lineTo(hw, -hh);
  s.lineTo(hw, -nr);
  s.absarc(hw, 0, nr, -Math.PI * 0.5, Math.PI * 0.5, true);
  s.lineTo(hw, hh);
  s.lineTo(-hw, hh);
  s.lineTo(-hw, nr);
  s.absarc(-hw, 0, nr, Math.PI * 0.5, Math.PI * 1.5, true);
  s.closePath();
  return s;
}

function tubeArc(THREE, pts, radius, tubularSegs = 20, radialSegs = 8) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  return new THREE.TubeGeometry(curve, tubularSegs, radius, radialSegs, false);
}

// ---------------------------------------------------------------------------
// 1. ticketStub
// ---------------------------------------------------------------------------
function ticketStub(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matPri = makeMat(THREE, o.primary, { roughness: 0.72 });
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.78 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.45, metalness: 0.15 });
  const matWood = makeMat(THREE, o.wood, { roughness: 0.7 });
  const matMet = makeMat(THREE, o.metal, { roughness: 0.3, metalness: 0.85 });

  const makeSingleTicket = () => {
    const tg = new THREE.Group();
    const shape = ticketShape(THREE, 0.095, 0.048, 0.008);
    const bodyGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.0022,
      bevelEnabled: true,
      bevelThickness: 0.0005,
      bevelSize: 0.0005,
      bevelSegments: 2,
    });
    bodyGeo.translate(0, 0, -0.0011);
    place(THREE, tg, bodyGeo, matPri, "primary");
    place(THREE, tg, roundedBox(THREE, 0.068, 0.034, 0.0036, 0.003, 0.0005), matSec, "secondary", [-0.005, 0, 0]);
    place(THREE, tg, roundedBox(THREE, 0.012, 0.032, 0.0038, 0.002, 0.0004), matAcc, "accent", [0.034, 0, 0]);
    place(THREE, tg, starGeo(THREE, 0.0085, 0.004, 0.0015, 0.0004), matAcc, "accent", [-0.022, 0.003, 0.0016]);
    place(THREE, tg, roundedBox(THREE, 0.034, 0.004, 0.0012, 0.001, 0.0002), matPri, "primary", [0.004, 0.006, 0.0018]);
    place(THREE, tg, roundedBox(THREE, 0.026, 0.003, 0.0012, 0.001, 0.0002), matPri, "primary", [0.0, -0.004, 0.0018]);
    return tg;
  };

  if (o.variant === 2) {
    const t = makeSingleTicket();
    t.position.set(0, 0.003, 0);
    t.rotation.set(-Math.PI * 0.5, 0, 0.14);
    g.add(t);
    const clip = tubeArc(THREE, [
      [-0.01, 0.0045, -0.015],
      [-0.01, 0.005, 0.012],
      [0.004, 0.005, 0.012],
      [0.004, 0.005, -0.008],
      [-0.004, 0.005, -0.008],
    ], 0.0012, 24, 6);
    place(THREE, g, clip, matMet, "metal", [0.026, 0.001, -0.014], [0, 0.14, 0]);
  } else {
    place(THREE, g, roundedBox(THREE, 0.078, 0.016, 0.028, 0.004, 0.002), matWood, "wood", [0, 0.008, 0]);
    const t1 = makeSingleTicket();
    t1.position.set(o.variant === 1 ? -0.008 : 0, 0.036, -0.001);
    t1.rotation.set(-0.18, 0, o.variant === 1 ? 0.12 : 0.03);
    g.add(t1);
    if (o.variant === 1) {
      const t2 = makeSingleTicket();
      t2.position.set(0.012, 0.034, 0.003);
      t2.rotation.set(-0.22, 0.08, -0.14);
      g.add(t2);
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// 2. concertWristband
// ---------------------------------------------------------------------------
function concertWristband(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matPri = makeMat(THREE, o.primary, { roughness: 0.82 });
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.85 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.45, metalness: 0.25 });
  const matMet = makeMat(THREE, o.metal, { roughness: 0.3, metalness: 0.85 });

  const addBand = (yOff, rotY, scaleXZ = 1) => {
    const bg = new THREE.Group();
    bg.position.y = yOff;
    bg.rotation.y = rotY;
    bg.scale.set(scaleXZ, 1, scaleXZ * 0.84);
    const bandGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.016, 36, 1, true);
    const bandOuter = new THREE.TorusGeometry(0.038, 0.0082, 10, 36);
    place(THREE, bg, bandOuter, matPri, "primary", [0, 0.009, 0], [Math.PI * 0.5, 0, 0], [1, 1, 0.32]);
    place(THREE, bg, new THREE.TorusGeometry(0.0392, 0.0022, 8, 36), matAcc, "accent", [0, 0.009, 0], [Math.PI * 0.5, 0, 0]);
    place(THREE, bg, new THREE.TorusGeometry(0.0365, 0.002, 8, 36), matSec, "secondary", [0, 0.009, 0], [Math.PI * 0.5, 0, 0]);
    bandGeo.dispose();

    place(THREE, bg, new THREE.CylinderGeometry(0.006, 0.006, 0.013, 14), matMet, "metal", [0.041, 0.009, 0], [0, 0, Math.PI * 0.5]);
    place(THREE, bg, roundedBox(THREE, 0.026, 0.011, 0.0025, 0.002, 0.0005), matPri, "primary", [0.056, 0.008, 0.005], [0.2, 0.3, -0.15]);
    place(THREE, bg, roundedBox(THREE, 0.022, 0.011, 0.0025, 0.002, 0.0005), matPri, "primary", [0.054, 0.007, -0.006], [-0.15, -0.35, -0.2]);
    g.add(bg);
  };

  addBand(0, 0, 1);
  if (o.variant === 1) {
    addBand(0.015, 0.85, 0.94);
  } else if (o.variant === 2) {
    place(THREE, g, roundedBox(THREE, 0.024, 0.015, 0.003, 0.003, 0.0008), matAcc, "accent", [0.046, 0.004, 0.022], [Math.PI * 0.5, 0, 0.5]);
    place(THREE, g, new THREE.TorusGeometry(0.0045, 0.001, 8, 16), matMet, "metal", [0.042, 0.007, 0.012], [0.3, 0.4, 0]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 3. programBooklet
// ---------------------------------------------------------------------------
function programBooklet(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matPri = makeMat(THREE, o.primary, { roughness: 0.6 });
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.82 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.42, metalness: 0.2 });
  const matMet = makeMat(THREE, o.metal, { roughness: 0.3, metalness: 0.85 });

  const makeBook = () => {
    const bg = new THREE.Group();
    place(THREE, bg, roundedBox(THREE, 0.128, 0.014, 0.174, 0.003, 0.0012), matSec, "secondary", [0.002, 0.009, 0]);
    place(THREE, bg, roundedBox(THREE, 0.132, 0.003, 0.178, 0.003, 0.001), matPri, "primary", [0, 0.0015, 0]);
    place(THREE, bg, roundedBox(THREE, 0.008, 0.018, 0.178, 0.003, 0.0015), matPri, "primary", [-0.064, 0.009, 0]);

    const cover = new THREE.Group();
    cover.position.set(-0.064, 0.0165, 0);
    if (o.variant === 1) cover.rotation.z = 0.24;
    place(THREE, cover, roundedBox(THREE, 0.132, 0.003, 0.178, 0.003, 0.001), matPri, "primary", [0.064, 0, 0]);
    place(THREE, cover, roundedBox(THREE, 0.092, 0.002, 0.118, 0.004, 0.0005), matSec, "secondary", [0.066, 0.0016, -0.01]);
    place(THREE, cover, new THREE.CylinderGeometry(0.026, 0.026, 0.0022, 24), matAcc, "accent", [0.066, 0.0022, -0.02]);
    place(THREE, cover, roundedBox(THREE, 0.068, 0.002, 0.01, 0.002, 0.0004), matAcc, "accent", [0.066, 0.002, 0.062]);
    bg.add(cover);

    place(THREE, bg, roundedBox(THREE, 0.01, 0.0015, 0.036, 0.002, 0.0004), matAcc, "accent", [0.016, 0.006, 0.098], [0.08, 0.12, 0]);
    return bg;
  };

  if (o.variant === 2) {
    const book = makeBook();
    book.position.set(0, 0.092, 0.014);
    book.rotation.set(1.22, 0, 0);
    g.add(book);
    const wireL = tubeArc(THREE, [[-0.04, 0.003, 0.04], [-0.04, 0.003, -0.038], [-0.03, 0.11, -0.018]], 0.0026);
    const wireR = tubeArc(THREE, [[0.04, 0.003, 0.04], [0.04, 0.003, -0.038], [0.03, 0.11, -0.018]], 0.0026);
    const wireB = tubeArc(THREE, [[-0.04, 0.003, 0.04], [0.04, 0.003, 0.04]], 0.0026);
    place(THREE, g, wireL, matMet, "metal");
    place(THREE, g, wireR, matMet, "metal");
    place(THREE, g, wireB, matMet, "metal");
  } else {
    g.add(makeBook());
  }
  return g;
}

// ---------------------------------------------------------------------------
// 4. paperCrane
// ---------------------------------------------------------------------------
function paperCrane(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matPri = makeMat(THREE, o.primary, { roughness: 0.78 });
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.82 });
  const matWood = makeMat(THREE, o.wood, { roughness: 0.68 });

  const crane = new THREE.Group();
  const yBase = o.variant === 2 ? 0.014 : 0;
  crane.position.y = yBase;

  if (o.variant === 2) {
    place(THREE, g, new THREE.CylinderGeometry(0.036, 0.04, 0.014, 28), matWood, "wood", [0, 0.007, 0]);
  }

  place(THREE, crane, new THREE.OctahedronGeometry(0.022, 0), matPri, "primary", [0, 0.019, 0], [0, 0, 0], [1.05, 0.82, 1.45]);
  place(THREE, crane, new THREE.OctahedronGeometry(0.014, 0), matSec, "secondary", [0, 0.027, 0], [0, 0, 0], [0.95, 0.55, 1.15]);

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, -0.016);
  wingShape.lineTo(0.056, -0.004);
  wingShape.lineTo(0.062, 0.018);
  wingShape.lineTo(0, 0.018);
  wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.002,
    bevelEnabled: true,
    bevelThickness: 0.0006,
    bevelSize: 0.0006,
    bevelSegments: 1,
  });
  wingGeo.translate(0, 0, -0.001);

  const wingAngle = o.variant === 1 ? 0.58 : 0.22;
  place(THREE, crane, wingGeo, matPri, "primary", [0.012, 0.024, 0], [Math.PI * 0.5, -wingAngle, 0]);
  place(THREE, crane, wingGeo, matPri, "primary", [-0.012, 0.024, 0], [Math.PI * 0.5, Math.PI + wingAngle, 0]);

  const neckGeo = new THREE.ConeGeometry(0.0085, 0.058, 4);
  place(THREE, crane, neckGeo, matPri, "primary", [0, 0.046, 0.036], [0.55, Math.PI * 0.25, 0]);

  const headGeo = new THREE.ConeGeometry(0.006, 0.024, 4);
  place(THREE, crane, headGeo, matPri, "primary", [0, 0.069, 0.058], [1.95, Math.PI * 0.25, 0]);

  const tailGeo = new THREE.ConeGeometry(0.0085, 0.056, 4);
  place(THREE, crane, tailGeo, matPri, "primary", [0, 0.044, -0.036], [-0.62, Math.PI * 0.25, 0]);

  g.add(crane);
  return g;
}

// ---------------------------------------------------------------------------
// 5. zine
// ---------------------------------------------------------------------------
function zine(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matPri = makeMat(THREE, o.primary, { roughness: 0.72 });
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.85 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.58 });
  const matFab = makeMat(THREE, o.fabric, { roughness: 0.8 });
  const matMet = makeMat(THREE, o.metal, { roughness: 0.3, metalness: 0.85 });

  const makeSingleZine = () => {
    const zg = new THREE.Group();
    place(THREE, zg, roundedBox(THREE, 0.122, 0.01, 0.166, 0.002, 0.001), matSec, "secondary", [0.002, 0.006, 0]);
    place(THREE, zg, roundedBox(THREE, 0.126, 0.0025, 0.17, 0.002, 0.0008), matPri, "primary", [0, 0.0012, 0]);
    place(THREE, zg, roundedBox(THREE, 0.126, 0.0025, 0.17, 0.002, 0.0008), matPri, "primary", [0, 0.0115, 0]);
    place(THREE, zg, roundedBox(THREE, 0.006, 0.013, 0.17, 0.002, 0.001), matPri, "primary", [-0.061, 0.0065, 0]);

    // Saddle staples on spine
    place(THREE, zg, roundedBox(THREE, 0.0025, 0.003, 0.014, 0.0008, 0.0003), matMet, "metal", [-0.064, 0.0065, -0.04]);
    place(THREE, zg, roundedBox(THREE, 0.0025, 0.003, 0.014, 0.0008, 0.0003), matMet, "metal", [-0.064, 0.0065, 0.04]);

    // Collage cutouts on cover
    place(THREE, zg, roundedBox(THREE, 0.062, 0.0018, 0.082, 0.002, 0.0004), matSec, "secondary", [0.008, 0.0132, -0.012], [0, 0.08, 0]);
    place(THREE, zg, new THREE.CylinderGeometry(0.022, 0.022, 0.002, 22), matAcc, "accent", [-0.012, 0.014, 0.018]);
    place(THREE, zg, roundedBox(THREE, 0.044, 0.0018, 0.018, 0.002, 0.0004), matFab, "fabric", [0.018, 0.0142, 0.048], [0, -0.1, 0]);
    place(THREE, zg, roundedBox(THREE, 0.034, 0.0016, 0.01, 0.001, 0.0003), matAcc, "accent", [-0.026, 0.0138, -0.056], [0, 0.35, 0]);
    return zg;
  };

  const z1 = makeSingleZine();
  g.add(z1);

  if (o.variant === 1) {
    const z2 = makeSingleZine();
    z2.position.set(0.006, 0.013, 0.004);
    z2.rotation.y = -0.18;
    g.add(z2);
  } else if (o.variant === 2) {
    z1.position.set(0, 0.018, 0);
    z1.rotation.set(0.18, 0, 0);
    place(THREE, g, roundedBox(THREE, 0.05, 0.016, 0.028, 0.006, 0.003), matFab, "fabric", [0, 0.008, -0.055]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 6. pinBadge
// ---------------------------------------------------------------------------
function pinBadge(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matPri = makeMat(THREE, o.primary, { roughness: 0.25, metalness: 0.1 });
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.8 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.22, metalness: 0.35 });
  const matMet = makeMat(THREE, o.metal, { roughness: 0.25, metalness: 0.9 });
  const matWood = makeMat(THREE, o.wood, { roughness: 0.68 });

  // Mini wooden easel base
  place(THREE, g, roundedBox(THREE, 0.068, 0.012, 0.032, 0.004, 0.002), matWood, "wood", [0, 0.006, 0]);

  // Backing card
  const card = new THREE.Group();
  card.position.set(0, 0.048, -0.002);
  card.rotation.x = -0.22;
  place(THREE, card, roundedBox(THREE, 0.066, 0.078, 0.004, 0.005, 0.001), matSec, "secondary");

  if (o.variant === 0) {
    place(THREE, card, new THREE.CylinderGeometry(0.024, 0.024, 0.006, 28), matMet, "metal", [0, 0.004, 0.004], [Math.PI * 0.5, 0, 0]);
    place(THREE, card, new THREE.CylinderGeometry(0.021, 0.021, 0.0068, 28), matPri, "primary", [0, 0.004, 0.0044], [Math.PI * 0.5, 0, 0]);
    place(THREE, card, starGeo(THREE, 0.014, 0.006, 0.0025, 0.0006), matAcc, "accent", [0, 0.004, 0.0085]);
  } else if (o.variant === 1) {
    const sh = new THREE.Shape();
    sh.moveTo(-0.02, 0.022);
    sh.lineTo(0.02, 0.022);
    sh.lineTo(0.02, -0.004);
    sh.quadraticCurveTo(0.016, -0.02, 0, -0.026);
    sh.quadraticCurveTo(-0.016, -0.02, -0.02, -0.004);
    sh.closePath();
    const shieldGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.005, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 2 });
    place(THREE, card, shieldGeo, matMet, "metal", [0, 0.004, 0.002]);
    place(THREE, card, shieldGeo, matPri, "primary", [0, 0.004, 0.0032], null, [0.86, 0.86, 1]);
    place(THREE, card, roundedBox(THREE, 0.024, 0.006, 0.003, 0.001, 0.0005), matAcc, "accent", [0, 0.005, 0.0088], [0, 0, 0.35]);
    place(THREE, card, roundedBox(THREE, 0.024, 0.006, 0.003, 0.001, 0.0005), matAcc, "accent", [0, 0.005, 0.0088], [0, 0, -0.35]);
  } else {
    place(THREE, card, new THREE.CylinderGeometry(0.024, 0.024, 0.006, 6), matMet, "metal", [0, 0.004, 0.004], [Math.PI * 0.5, 0, 0]);
    place(THREE, card, new THREE.CylinderGeometry(0.021, 0.021, 0.0068, 6), matPri, "primary", [0, 0.004, 0.0044], [Math.PI * 0.5, 0, 0]);
    place(THREE, card, new THREE.ConeGeometry(0.012, 0.018, 4), matSec, "secondary", [-0.004, 0.002, 0.0082], [0, 0, 0], [1, 1, 0.2]);
    place(THREE, card, new THREE.SphereGeometry(0.0055, 14, 10), matAcc, "accent", [0.008, 0.011, 0.0082], null, [1, 1, 0.45]);
  }

  g.add(card);
  return g;
}

// ---------------------------------------------------------------------------
// 7. enamelMug
// ---------------------------------------------------------------------------
function enamelMug(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matPri = makeMat(THREE, o.primary, { roughness: 0.24, metalness: 0.12 });
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.22, metalness: 0.08 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.26, metalness: 0.25 });

  const h = o.variant === 2 ? 0.105 : 0.086;
  const r = o.variant === 2 ? 0.04 : 0.043;

  const outerPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(r - 0.005, 0),
    new THREE.Vector2(r, 0.006),
    new THREE.Vector2(r + 0.001, h - 0.006),
    new THREE.Vector2(r + 0.004, h - 0.002),
    new THREE.Vector2(r + 0.002, h),
    new THREE.Vector2(r - 0.004, h - 0.001),
  ];
  place(THREE, g, new THREE.LatheGeometry(outerPts, 32), matPri, "primary");

  const innerPts = [
    new THREE.Vector2(0, 0.007),
    new THREE.Vector2(r - 0.006, 0.007),
    new THREE.Vector2(r - 0.005, h - 0.002),
  ];
  const innerGeo = new THREE.LatheGeometry(innerPts, 32);
  innerGeo.scale(-1, 1, 1);
  // Use DoubleSide so interior cavity renders cleanly
  const matInner = makeMat(THREE, o.secondary, { roughness: 0.22, metalness: 0.06, side: THREE.DoubleSide });
  place(THREE, g, new THREE.LatheGeometry(innerPts, 32), matInner, "secondary");
  innerGeo.dispose();

  // Rolled accent rim
  place(THREE, g, new THREE.TorusGeometry(r + 0.0005, 0.0038, 12, 32), matAcc, "accent", [0, h - 0.001, 0], [Math.PI * 0.5, 0, 0]);

  // Decorative stripe(s)
  place(THREE, g, new THREE.CylinderGeometry(r + 0.0016, r + 0.0016, 0.009, 32, 1, true), matSec, "secondary", [0, h * 0.52, 0]);
  if (o.variant === 2) {
    place(THREE, g, new THREE.CylinderGeometry(r + 0.0016, r + 0.0016, 0.005, 32, 1, true), matAcc, "accent", [0, h * 0.34, 0]);
  }

  // Curved handle
  const handle = tubeArc(THREE, [
    [r - 0.002, h * 0.78, 0],
    [r + 0.022, h * 0.76, 0],
    [r + 0.026, h * 0.5, 0],
    [r + 0.02, h * 0.24, 0],
    [r - 0.002, h * 0.22, 0],
  ], 0.0048, 22, 10);
  place(THREE, g, handle, matPri, "primary");

  if (o.variant === 1) {
    // Tea bag string & tag hanging over rim
    const str = tubeArc(THREE, [
      [-r * 0.3, h * 0.65, 0],
      [-r - 0.002, h + 0.004, 0],
      [-r - 0.008, h * 0.66, 0],
    ], 0.001, 14, 6);
    place(THREE, g, str, matSec, "secondary");
    place(THREE, g, roundedBox(THREE, 0.003, 0.016, 0.013, 0.002, 0.0004), matAcc, "accent", [-r - 0.009, h * 0.56, 0], [0, 0, 0.08]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 8. toteOnHook (wall-mounted, z=0 at wall, y=0 at bottom of bag)
// ---------------------------------------------------------------------------
function toteOnHook(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matFab = makeMat(THREE, o.fabric, { roughness: 0.88 });
  const matPri = makeMat(THREE, o.primary, { roughness: 0.82 });
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.85 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.55 });
  const matWood = makeMat(THREE, o.wood, { roughness: 0.68 });
  const matMet = makeMat(THREE, o.metal, { roughness: 0.3, metalness: 0.85 });

  // Wall peg plaque at top
  place(THREE, g, new THREE.CylinderGeometry(0.022, 0.024, 0.01, 24), matWood, "wood", [0, 0.256, 0.005], [Math.PI * 0.5, 0, 0]);
  place(THREE, g, new THREE.CylinderGeometry(0.007, 0.009, 0.036, 16), matWood, "wood", [0, 0.256, 0.024], [Math.PI * 0.5 - 0.12, 0, 0]);
  place(THREE, g, new THREE.SphereGeometry(0.008, 14, 10), matWood, "wood", [0, 0.259, 0.042]);

  // Bag body (bottom at y=0)
  place(THREE, g, roundedBox(THREE, 0.175, 0.172, 0.044, 0.018, 0.009), matFab, "fabric", [0, 0.086, 0.028]);
  // Pocket
  place(THREE, g, roundedBox(THREE, 0.092, 0.072, 0.01, 0.008, 0.003), matSec, "secondary", [0, 0.072, 0.052]);

  // Straps looping up onto peg
  const strapL = tubeArc(THREE, [
    [-0.046, 0.168, 0.034],
    [-0.036, 0.224, 0.03],
    [0, 0.262, 0.026],
    [0.036, 0.224, 0.03],
    [0.046, 0.168, 0.034],
  ], 0.0055, 24, 8);
  const strapR = tubeArc(THREE, [
    [-0.046, 0.168, 0.02],
    [-0.034, 0.222, 0.022],
    [0, 0.261, 0.022],
    [0.034, 0.222, 0.022],
    [0.046, 0.168, 0.02],
  ], 0.0055, 24, 8);
  place(THREE, g, strapL, matPri, "primary");
  place(THREE, g, strapR, matPri, "primary");

  if (o.variant === 0) {
    place(THREE, g, starGeo(THREE, 0.016, 0.007, 0.003, 0.0008), matAcc, "accent", [0.032, 0.128, 0.052]);
  } else if (o.variant === 1) {
    // Rolled poster & notebook peeking out
    place(THREE, g, new THREE.CylinderGeometry(0.014, 0.014, 0.11, 18), matSec, "secondary", [-0.036, 0.175, 0.028], [0, 0, 0.24]);
    place(THREE, g, new THREE.CylinderGeometry(0.0148, 0.0148, 0.008, 18), matAcc, "accent", [-0.042, 0.198, 0.028], [0, 0, 0.24]);
    place(THREE, g, roundedBox(THREE, 0.068, 0.088, 0.012, 0.003, 0.001), matPri, "primary", [0.028, 0.162, 0.028], [0, 0, -0.14]);
  } else {
    place(THREE, g, roundedBox(THREE, 0.172, 0.024, 0.048, 0.006, 0.002), matAcc, "accent", [0, 0.126, 0.028]);
    place(THREE, g, new THREE.TorusGeometry(0.009, 0.002, 8, 18), matMet, "metal", [-0.054, 0.156, 0.046]);
    place(THREE, g, new THREE.SphereGeometry(0.011, 14, 10), matAcc, "accent", [-0.056, 0.136, 0.048]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 9. pottedSeedling
// ---------------------------------------------------------------------------
function pottedSeedling(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matPri = makeMat(THREE, o.primary, { roughness: 0.72 });
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.65 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.5 });
  const matWood = makeMat(THREE, o.wood, { roughness: 0.78 });
  const matSoil = makeMat(THREE, 0x4b382a, { roughness: 0.95 });
  const matLeaf = makeMat(THREE, 0x5da15c, { roughness: 0.58 });
  const matLeaf2 = makeMat(THREE, 0x77ba6d, { roughness: 0.55 });

  // Saucer
  place(THREE, g, new THREE.CylinderGeometry(0.046, 0.041, 0.009, 28), matSec, "secondary", [0, 0.0045, 0]);

  // Pot via Lathe
  const potPts = [
    new THREE.Vector2(0, 0.009),
    new THREE.Vector2(0.032, 0.009),
    new THREE.Vector2(0.042, 0.068),
    new THREE.Vector2(0.046, 0.072),
    new THREE.Vector2(0.046, 0.084),
    new THREE.Vector2(0.041, 0.084),
    new THREE.Vector2(0.038, 0.072),
  ];
  place(THREE, g, new THREE.LatheGeometry(potPts, 28), matPri, "primary");
  place(THREE, g, new THREE.CylinderGeometry(0.041, 0.039, 0.01, 28), matAcc, "accent", [0, 0.052, 0]);

  // Soil dome
  place(THREE, g, new THREE.SphereGeometry(0.038, 20, 12), matSoil, null, [0, 0.072, 0], null, [1, 0.28, 1]);

  if (o.variant === 2) {
    // Cozy succulent rosette
    for (let ring = 0; ring < 2; ring++) {
      const n = ring === 0 ? 7 : 5;
      const rad = ring === 0 ? 0.018 : 0.009;
      const tilt = ring === 0 ? 0.85 : 0.42;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring * 0.4;
        const leaf = new THREE.SphereGeometry(0.012, 12, 10);
        const lg = new THREE.Group();
        lg.position.set(Math.cos(a) * rad, 0.086 + ring * 0.006, Math.sin(a) * rad);
        lg.rotation.set(0, -a, -tilt);
        place(THREE, lg, leaf, ring === 0 ? matLeaf : matLeaf2, null, [0, 0.008, 0], null, [0.55, 1.35, 0.9]);
        g.add(lg);
      }
    }
  } else {
    // Stem
    const stem = tubeArc(THREE, [
      [0, 0.076, 0],
      [0.003, 0.106, 0.002],
      [0, 0.134, 0],
    ], 0.0032, 14, 8);
    place(THREE, g, stem, matLeaf, null);

    const addLeaf = (y, yaw, pitch, s, mat) => {
      const lg = new THREE.Group();
      lg.position.set(0, y, 0);
      lg.rotation.set(0, yaw, pitch);
      place(THREE, lg, new THREE.SphereGeometry(0.016 * s, 14, 10), mat, null, [0.015 * s, 0, 0], null, [1.25, 0.25, 0.72]);
      g.add(lg);
    };

    addLeaf(0.128, 0.2, 0.35, 1.0, matLeaf2);
    addLeaf(0.128, Math.PI + 0.2, 0.35, 1.0, matLeaf);

    if (o.variant === 0) {
      place(THREE, g, new THREE.SphereGeometry(0.006, 12, 10), matAcc, "accent", [0, 0.139, 0]);
    } else {
      addLeaf(0.104, 1.8, 0.25, 0.85, matLeaf);
      addLeaf(0.104, -1.3, 0.25, 0.85, matLeaf2);
      // Tiny wooden plant marker
      place(THREE, g, roundedBox(THREE, 0.012, 0.048, 0.003, 0.002, 0.0005), matWood, "wood", [0.022, 0.095, 0.01], [0.1, -0.3, -0.15]);
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// 10. polaroid
// ---------------------------------------------------------------------------
function polaroid(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matPri = makeMat(THREE, o.primary, { roughness: 0.35 });
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.6 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.35 });
  const matFab = makeMat(THREE, o.fabric, { roughness: 0.5 });
  const matWood = makeMat(THREE, o.wood, { roughness: 0.68 });
  const matMet = makeMat(THREE, o.metal, { roughness: 0.28, metalness: 0.88 });

  const makePrint = () => {
    const pg = new THREE.Group();
    place(THREE, pg, roundedBox(THREE, 0.088, 0.106, 0.0032, 0.003, 0.0008), matSec, "secondary");
    // Photo window (slightly shifted upward for iconic thick bottom margin)
    place(THREE, pg, roundedBox(THREE, 0.074, 0.074, 0.0015, 0.002, 0.0003), matPri, "primary", [0, 0.009, 0.0014]);
    // Stylized landscape inside photo
    place(THREE, pg, roundedBox(THREE, 0.072, 0.026, 0.0016, 0.001, 0.0002), matFab, "fabric", [0, -0.014, 0.0018]);
    place(THREE, pg, new THREE.CylinderGeometry(0.011, 0.011, 0.0018, 18), matAcc, "accent", [0.018, 0.024, 0.002], [Math.PI * 0.5, 0, 0]);
    return pg;
  };

  if (o.variant === 2) {
    // Wooden cube + wire alligator clip
    place(THREE, g, roundedBox(THREE, 0.032, 0.032, 0.032, 0.004, 0.002), matWood, "wood", [0, 0.016, 0]);
    place(THREE, g, new THREE.CylinderGeometry(0.002, 0.002, 0.04, 10), matMet, "metal", [0, 0.048, 0]);
    place(THREE, g, roundedBox(THREE, 0.016, 0.012, 0.008, 0.002, 0.001), matMet, "metal", [0, 0.068, 0]);
    const p = makePrint();
    p.position.set(0, 0.114, 0.002);
    p.rotation.set(-0.08, 0, 0.05);
    g.add(p);
  } else {
    place(THREE, g, roundedBox(THREE, 0.078, 0.016, 0.03, 0.004, 0.002), matWood, "wood", [0, 0.008, 0]);
    const p1 = makePrint();
    p1.position.set(o.variant === 1 ? -0.014 : 0, 0.062, 0);
    p1.rotation.set(-0.18, 0, o.variant === 1 ? 0.12 : 0.02);
    g.add(p1);
    if (o.variant === 1) {
      const p2 = makePrint();
      p2.position.set(0.022, 0.059, 0.004);
      p2.rotation.set(-0.22, -0.08, -0.14);
      g.add(p2);
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// 11. medal
// ---------------------------------------------------------------------------
function medal(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matPri = makeMat(THREE, o.primary, { roughness: 0.78 });
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.8 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.25, metalness: 0.82 });
  const matWood = makeMat(THREE, o.wood, { roughness: 0.68 });
  const matMet = makeMat(THREE, o.metal, { roughness: 0.28, metalness: 0.88 });

  const makeMedallion = () => {
    const mg = new THREE.Group();
    place(THREE, mg, new THREE.CylinderGeometry(0.028, 0.028, 0.006, 32), matAcc, "accent", [0, 0, 0], [Math.PI * 0.5, 0, 0]);
    place(THREE, mg, new THREE.TorusGeometry(0.024, 0.0025, 10, 32), matAcc, "accent", [0, 0, 0.0025]);
    place(THREE, mg, starGeo(THREE, 0.015, 0.0065, 0.003, 0.0008), matAcc, "accent", [0, 0, 0.0035]);
    place(THREE, mg, new THREE.TorusGeometry(0.006, 0.0018, 8, 16), matMet, "metal", [0, 0.031, 0]);
    return mg;
  };

  if (o.variant === 1) {
    // Lying flat with coiled ribbon
    place(THREE, g, new THREE.TorusGeometry(0.036, 0.006, 10, 32), matPri, "primary", [0, 0.005, -0.012], [Math.PI * 0.5, 0, 0], [1, 0.78, 0.45]);
    place(THREE, g, new THREE.TorusGeometry(0.036, 0.0025, 8, 32), matSec, "secondary", [0, 0.008, -0.012], [Math.PI * 0.5, 0, 0], [1, 0.78, 0.45]);
    const med = makeMedallion();
    med.position.set(0, 0.006, 0.022);
    med.rotation.set(-Math.PI * 0.5, 0, 0);
    g.add(med);
  } else if (o.variant === 2) {
    // Mini T-bar stand
    place(THREE, g, new THREE.CylinderGeometry(0.032, 0.036, 0.012, 24), matWood, "wood", [0, 0.006, 0]);
    place(THREE, g, new THREE.CylinderGeometry(0.004, 0.004, 0.13, 12), matMet, "metal", [0, 0.072, -0.008]);
    place(THREE, g, new THREE.CylinderGeometry(0.0035, 0.0035, 0.068, 12), matMet, "metal", [0, 0.136, -0.008], [0, 0, Math.PI * 0.5]);
    place(THREE, g, roundedBox(THREE, 0.022, 0.064, 0.004, 0.002, 0.0005), matPri, "primary", [-0.011, 0.104, 0.002], [0, 0, 0.16]);
    place(THREE, g, roundedBox(THREE, 0.022, 0.064, 0.004, 0.002, 0.0005), matPri, "primary", [0.011, 0.104, 0.002], [0, 0, -0.16]);
    const med = makeMedallion();
    med.position.set(0, 0.048, 0.006);
    g.add(med);
  } else {
    // Angled wooden presentation plaque
    place(THREE, g, roundedBox(THREE, 0.074, 0.012, 0.044, 0.004, 0.002), matWood, "wood", [0, 0.006, 0]);
    const board = new THREE.Group();
    board.position.set(0, 0.068, -0.004);
    board.rotation.x = -0.26;
    place(THREE, board, roundedBox(THREE, 0.076, 0.118, 0.008, 0.006, 0.002), matWood, "wood");
    place(THREE, board, roundedBox(THREE, 0.02, 0.062, 0.003, 0.002, 0.0005), matPri, "primary", [-0.011, 0.022, 0.005], [0, 0, 0.2]);
    place(THREE, board, roundedBox(THREE, 0.02, 0.062, 0.003, 0.002, 0.0005), matPri, "primary", [0.011, 0.022, 0.005], [0, 0, -0.2]);
    place(THREE, board, roundedBox(THREE, 0.006, 0.06, 0.0035, 0.001, 0.0003), matSec, "secondary", [-0.011, 0.022, 0.0052], [0, 0, 0.2]);
    place(THREE, board, roundedBox(THREE, 0.006, 0.06, 0.0035, 0.001, 0.0003), matSec, "secondary", [0.011, 0.022, 0.0052], [0, 0, -0.2]);
    const med = makeMedallion();
    med.position.set(0, -0.022, 0.008);
    board.add(med);
    g.add(board);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 12. smallTrophy
// ---------------------------------------------------------------------------
function smallTrophy(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matWood = makeMat(THREE, o.wood, { roughness: 0.6 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.22, metalness: 0.86 });
  const matMet = makeMat(THREE, o.metal, { roughness: 0.26, metalness: 0.9 });
  const matPri = makeMat(THREE, o.primary, { roughness: 0.45, metalness: 0.2 });

  // Stepped wooden plinth
  place(THREE, g, roundedBox(THREE, 0.078, 0.014, 0.078, 0.006, 0.002), matWood, "wood", [0, 0.007, 0]);
  place(THREE, g, roundedBox(THREE, 0.062, 0.036, 0.062, 0.005, 0.002), matWood, "wood", [0, 0.032, 0]);
  place(THREE, g, roundedBox(THREE, 0.044, 0.018, 0.003, 0.002, 0.0006), matMet, "metal", [0, 0.032, 0.0315]);

  if (o.variant === 1) {
    // Rising star trophy
    place(THREE, g, new THREE.CylinderGeometry(0.012, 0.02, 0.03, 24), matAcc, "accent", [0, 0.065, 0]);
    place(THREE, g, new THREE.CylinderGeometry(0.006, 0.01, 0.045, 16), matPri, "primary", [0, 0.095, 0]);
    place(THREE, g, starGeo(THREE, 0.044, 0.02, 0.012, 0.003), matAcc, "accent", [0, 0.148, 0]);
  } else if (o.variant === 2) {
    // Laurel ring & orb trophy
    place(THREE, g, new THREE.CylinderGeometry(0.014, 0.022, 0.028, 24), matAcc, "accent", [0, 0.064, 0]);
    place(THREE, g, new THREE.TorusGeometry(0.042, 0.006, 12, 32), matAcc, "accent", [0, 0.122, 0]);
    place(THREE, g, new THREE.SphereGeometry(0.022, 24, 18), matPri, "primary", [0, 0.122, 0]);
    place(THREE, g, new THREE.TorusGeometry(0.024, 0.0025, 8, 24), matAcc, "accent", [0, 0.122, 0], [0.5, 0.4, 0]);
  } else {
    // Classic two-handled cup
    const cupPts = [
      new THREE.Vector2(0, 0.05),
      new THREE.Vector2(0.024, 0.05),
      new THREE.Vector2(0.016, 0.064),
      new THREE.Vector2(0.008, 0.088),
      new THREE.Vector2(0.015, 0.104),
      new THREE.Vector2(0.034, 0.128),
      new THREE.Vector2(0.042, 0.178),
      new THREE.Vector2(0.045, 0.184),
      new THREE.Vector2(0.037, 0.184),
      new THREE.Vector2(0.031, 0.132),
      new THREE.Vector2(0, 0.114),
    ];
    place(THREE, g, new THREE.LatheGeometry(cupPts, 32), matAcc, "accent");
    const hL = tubeArc(THREE, [
      [-0.038, 0.172, 0],
      [-0.058, 0.168, 0],
      [-0.054, 0.132, 0],
      [-0.026, 0.118, 0],
    ], 0.0042, 18, 8);
    const hR = tubeArc(THREE, [
      [0.038, 0.172, 0],
      [0.058, 0.168, 0],
      [0.054, 0.132, 0],
      [0.026, 0.118, 0],
    ], 0.0042, 18, 8);
    place(THREE, g, hL, matAcc, "accent");
    place(THREE, g, hR, matAcc, "accent");
  }
  return g;
}

// ---------------------------------------------------------------------------
// 13. chessPiece
// ---------------------------------------------------------------------------
function chessPiece(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matBody = makeMat(THREE, o.wood, { roughness: 0.42, metalness: 0.05 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.3, metalness: 0.7 });
  const matFab = makeMat(THREE, o.fabric, { roughness: 0.92 });

  // Felt base pad
  place(THREE, g, new THREE.CylinderGeometry(0.032, 0.033, 0.004, 28), matFab, "fabric", [0, 0.002, 0]);

  if (o.variant === 2) {
    // Knight
    const basePts = [
      new THREE.Vector2(0, 0.004),
      new THREE.Vector2(0.033, 0.004),
      new THREE.Vector2(0.032, 0.016),
      new THREE.Vector2(0.024, 0.024),
      new THREE.Vector2(0.027, 0.032),
      new THREE.Vector2(0.02, 0.044),
      new THREE.Vector2(0, 0.044),
    ];
    place(THREE, g, new THREE.LatheGeometry(basePts, 28), matBody, "wood");
    place(THREE, g, new THREE.TorusGeometry(0.022, 0.0026, 8, 28), matAcc, "accent", [0, 0.032, 0], [Math.PI * 0.5, 0, 0]);

    const sh = new THREE.Shape();
    sh.moveTo(-0.018, 0);
    sh.lineTo(0.018, 0);
    sh.quadraticCurveTo(0.024, 0.035, 0.012, 0.065);
    sh.lineTo(0.018, 0.088);
    sh.lineTo(0.004, 0.078);
    sh.lineTo(-0.026, 0.062);
    sh.quadraticCurveTo(-0.032, 0.054, -0.024, 0.046);
    sh.lineTo(-0.006, 0.046);
    sh.quadraticCurveTo(-0.018, 0.025, -0.018, 0);
    const headGeo = new THREE.ExtrudeGeometry(sh, {
      depth: 0.024,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.004,
      bevelSegments: 3,
    });
    headGeo.translate(0, 0, -0.012);
    place(THREE, g, headGeo, matBody, "wood", [0, 0.042, 0]);
  } else {
    // King (0) or Queen (1)
    const pts = [
      new THREE.Vector2(0, 0.004),
      new THREE.Vector2(0.033, 0.004),
      new THREE.Vector2(0.032, 0.016),
      new THREE.Vector2(0.025, 0.026),
      new THREE.Vector2(0.028, 0.034),
      new THREE.Vector2(0.019, 0.052),
      new THREE.Vector2(0.014, 0.095),
      new THREE.Vector2(0.022, 0.104),
      new THREE.Vector2(0.016, 0.112),
      new THREE.Vector2(0.024, 0.132),
      new THREE.Vector2(0.018, 0.138),
      new THREE.Vector2(0, 0.14),
    ];
    place(THREE, g, new THREE.LatheGeometry(pts, 32), matBody, "wood");
    place(THREE, g, new THREE.TorusGeometry(0.022, 0.0028, 8, 28), matAcc, "accent", [0, 0.104, 0], [Math.PI * 0.5, 0, 0]);

    if (o.variant === 0) {
      // King cross finial
      place(THREE, g, roundedBox(THREE, 0.008, 0.028, 0.008, 0.002, 0.001), matAcc, "accent", [0, 0.152, 0]);
      place(THREE, g, roundedBox(THREE, 0.022, 0.008, 0.008, 0.002, 0.001), matAcc, "accent", [0, 0.155, 0]);
    } else {
      // Queen coronet pearls
      place(THREE, g, new THREE.SphereGeometry(0.008, 16, 12), matAcc, "accent", [0, 0.147, 0]);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        place(THREE, g, new THREE.SphereGeometry(0.004, 10, 8), matAcc, "accent", [Math.cos(a) * 0.021, 0.138, Math.sin(a) * 0.021]);
      }
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// 14. paintPalette
// ---------------------------------------------------------------------------
function paintPalette(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matWood = makeMat(THREE, o.wood, { roughness: 0.62 });
  const matPri = makeMat(THREE, o.primary, { roughness: 0.28 });
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.3 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.28 });
  const matFab = makeMat(THREE, o.fabric, { roughness: 0.35 });
  const matMet = makeMat(THREE, o.metal, { roughness: 0.28, metalness: 0.88 });
  const matGreen = makeMat(THREE, 0x589a67, { roughness: 0.3 });

  const makeBrush = (len = 0.145) => {
    const bg = new THREE.Group();
    place(THREE, bg, new THREE.CylinderGeometry(0.0032, 0.002, len * 0.72, 12), matWood, "wood", [0, 0, 0], [0, 0, Math.PI * 0.5]);
    place(THREE, bg, new THREE.CylinderGeometry(0.0035, 0.0034, len * 0.14, 12), matMet, "metal", [len * 0.43, 0, 0], [0, 0, Math.PI * 0.5]);
    place(THREE, bg, new THREE.ConeGeometry(0.0036, len * 0.16, 12), matFab, "fabric", [len * 0.57, 0, 0], [0, 0, -Math.PI * 0.5]);
    return bg;
  };

  // Kidney palette shape with thumb hole
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, 0.078, 0.056, 0, Math.PI * 2, false, 0);
  const hole = new THREE.Path();
  hole.absellipse(-0.042, -0.012, 0.013, 0.01, 0, Math.PI * 2, true, 0);
  shape.holes.push(hole);

  const palGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.006,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 2,
    curveSegments: 28,
  });
  palGeo.rotateX(-Math.PI * 0.5);

  const palGroup = new THREE.Group();
  place(THREE, palGroup, palGeo, matWood, "wood", [0, 0.002, 0]);

  const dabs = [
    [0.042, -0.026, matPri, "primary"],
    [0.052, 0.004, matAcc, "accent"],
    [0.032, 0.03, matFab, "fabric"],
    [-0.004, 0.034, matGreen, null],
    [-0.038, 0.022, matSec, "secondary"],
  ];
  for (let i = 0; i < dabs.length; i++) {
    const [dx, dz, mat, slot] = dabs[i];
    place(THREE, palGroup, new THREE.SphereGeometry(0.011, 14, 10), mat, slot, [dx, 0.01, dz], null, [1.1, 0.38, 0.92]);
  }

  if (o.variant === 1) {
    place(THREE, g, roundedBox(THREE, 0.06, 0.014, 0.024, 0.004, 0.002), matWood, "wood", [0, 0.007, -0.018]);
    palGroup.position.set(0, 0.046, 0.004);
    palGroup.rotation.set(0.75, 0, 0);
    g.add(palGroup);
    const b1 = makeBrush(0.14);
    b1.position.set(0.01, 0.006, 0.045);
    b1.rotation.y = 0.25;
    g.add(b1);
  } else {
    g.add(palGroup);
    const b1 = makeBrush(0.145);
    b1.position.set(-0.005, 0.014, -0.005);
    b1.rotation.set(0, 0.42, 0.02);
    g.add(b1);
    if (o.variant === 2) {
      const b2 = makeBrush(0.135);
      b2.position.set(0.008, 0.019, 0.004);
      b2.rotation.set(0, -0.52, -0.02);
      g.add(b2);
      place(THREE, g, new THREE.CylinderGeometry(0.008, 0.009, 0.042, 14), matPri, "primary", [-0.048, 0.009, 0.046], [0, 0.4, Math.PI * 0.5]);
      place(THREE, g, new THREE.CylinderGeometry(0.004, 0.004, 0.008, 12), matMet, "metal", [-0.026, 0.009, 0.036], [0, 0.4, Math.PI * 0.5]);
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// 15. circuitBoard
// ---------------------------------------------------------------------------
function circuitBoard(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matPri = makeMat(THREE, o.primary, { roughness: 0.42, metalness: 0.15 });
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.5 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.28, metalness: 0.75 });
  const matMet = makeMat(THREE, o.metal, { roughness: 0.25, metalness: 0.9 });
  const matWood = makeMat(THREE, o.wood, { roughness: 0.68 });
  const matChip = makeMat(THREE, 0x262a30, { roughness: 0.55, metalness: 0.1 });
  const matLed = makeMat(THREE, o.accent, {
    roughness: 0.2,
    emissive: new THREE.Color(o.accent),
    emissiveIntensity: 0.85,
  });

  const pcb = new THREE.Group();
  place(THREE, pcb, roundedBox(THREE, 0.118, 0.004, 0.084, 0.006, 0.001), matPri, "primary");

  // Gold trace bars
  place(THREE, pcb, roundedBox(THREE, 0.048, 0.001, 0.003, 0.0005, 0.0002), matAcc, "accent", [-0.015, 0.0024, 0.016]);
  place(THREE, pcb, roundedBox(THREE, 0.036, 0.001, 0.003, 0.0005, 0.0002), matAcc, "accent", [0.018, 0.0024, -0.018]);

  // Central IC chip
  place(THREE, pcb, roundedBox(THREE, 0.028, 0.006, 0.028, 0.002, 0.001), matChip, null, [-0.006, 0.005, 0]);
  // USB-C port
  place(THREE, pcb, roundedBox(THREE, 0.016, 0.008, 0.014, 0.002, 0.001), matMet, "metal", [-0.054, 0.006, 0]);
  // Pin header row
  for (let i = 0; i < 6; i++) {
    place(THREE, pcb, new THREE.CylinderGeometry(0.0014, 0.0014, 0.012, 8), matAcc, "accent", [-0.03 + i * 0.012, 0.008, -0.034]);
  }
  // Capacitors
  place(THREE, pcb, new THREE.CylinderGeometry(0.006, 0.006, 0.015, 16), matSec, "secondary", [0.036, 0.0095, 0.018]);
  place(THREE, pcb, new THREE.CylinderGeometry(0.0055, 0.0055, 0.002, 16), matMet, "metal", [0.036, 0.0175, 0.018]);
  // Glowing LED
  place(THREE, pcb, new THREE.SphereGeometry(0.0045, 12, 10), matLed, "accent", [0.042, 0.005, -0.016], null, null, { emissiveMatch: true });

  if (o.variant === 2) {
    // Mini OLED module + rotary knob
    place(THREE, pcb, roundedBox(THREE, 0.036, 0.008, 0.024, 0.002, 0.001), matChip, null, [0.022, 0.008, 0.014]);
    place(THREE, pcb, new THREE.CylinderGeometry(0.009, 0.01, 0.014, 18), matAcc, "accent", [-0.036, 0.011, 0.022]);
  }

  if (o.variant === 1) {
    place(THREE, g, roundedBox(THREE, 0.09, 0.016, 0.032, 0.004, 0.002), matWood, "wood", [0, 0.008, 0]);
    pcb.position.set(0, 0.052, 0);
    pcb.rotation.set(1.28, 0, 0);
    g.add(pcb);
  } else {
    // 4 brass standoffs
    const offs = [[-0.048, -0.032], [0.048, -0.032], [-0.048, 0.032], [0.048, 0.032]];
    for (let i = 0; i < offs.length; i++) {
      place(THREE, g, new THREE.CylinderGeometry(0.0035, 0.0035, 0.014, 6), matAcc, "accent", [offs[i][0], 0.007, offs[i][1]]);
    }
    pcb.position.y = 0.016;
    g.add(pcb);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 16. labFlask
// ---------------------------------------------------------------------------
function labFlask(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matGlass = makeGlassMat(THREE, 0.34);
  const matLiq = makeMat(THREE, o.primary, {
    roughness: 0.18,
    metalness: 0.05,
    emissive: new THREE.Color(o.primary),
    emissiveIntensity: 0.18,
  });
  const matBub = makeMat(THREE, o.secondary, { roughness: 0.25 });
  const matCork = makeMat(THREE, o.wood, { roughness: 0.85 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.35, metalness: 0.5 });

  // Cork coaster
  place(THREE, g, new THREE.CylinderGeometry(0.044, 0.045, 0.007, 28), matCork, "wood", [0, 0.0035, 0]);

  if (o.variant === 1) {
    // Round-bottom flask on wooden ring
    place(THREE, g, new THREE.TorusGeometry(0.026, 0.006, 10, 24), matCork, "wood", [0, 0.013, 0], [Math.PI * 0.5, 0, 0]);
    place(THREE, g, new THREE.SphereGeometry(0.036, 24, 18, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58), matLiq, "primary", [0, 0.052, 0], null, null, { emissiveMatch: true });
    place(THREE, g, new THREE.CircleGeometry(0.0345, 24), matLiq, "primary", [0, 0.061, 0], [-Math.PI * 0.5, 0, 0], null, { emissiveMatch: true });
    place(THREE, g, new THREE.SphereGeometry(0.005, 10, 8), matBub, "secondary", [0.01, 0.045, 0.008]);
    place(THREE, g, new THREE.SphereGeometry(0.0035, 10, 8), matBub, "secondary", [-0.012, 0.052, -0.006]);

    // Glass bulb + neck
    place(THREE, g, new THREE.SphereGeometry(0.041, 28, 20), matGlass, null, [0, 0.052, 0]);
    place(THREE, g, new THREE.CylinderGeometry(0.015, 0.015, 0.065, 24, 1, true), matGlass, null, [0, 0.118, 0]);
    place(THREE, g, new THREE.TorusGeometry(0.016, 0.0028, 10, 24), matGlass, null, [0, 0.15, 0], [Math.PI * 0.5, 0, 0]);
    place(THREE, g, new THREE.CylinderGeometry(0.013, 0.011, 0.02, 20), matCork, "wood", [0, 0.156, 0]);
  } else if (o.variant === 2) {
    // Tall graduated cylinder + small vial
    place(THREE, g, new THREE.CylinderGeometry(0.015, 0.015, 0.078, 22), matLiq, "primary", [-0.012, 0.048, 0], null, null, { emissiveMatch: true });
    place(THREE, g, new THREE.CylinderGeometry(0.018, 0.018, 0.145, 24), matGlass, null, [-0.012, 0.082, 0]);
    for (let i = 0; i < 4; i++) {
      place(THREE, g, new THREE.TorusGeometry(0.0185, 0.001, 6, 20), matAcc, "accent", [-0.012, 0.04 + i * 0.026, 0], [Math.PI * 0.5, 0, 0]);
    }
    place(THREE, g, new THREE.CylinderGeometry(0.01, 0.01, 0.036, 18), matAcc, "accent", [0.024, 0.028, 0.008]);
    place(THREE, g, new THREE.CylinderGeometry(0.012, 0.012, 0.064, 18), matGlass, null, [0.024, 0.042, 0.008]);
    place(THREE, g, new THREE.CylinderGeometry(0.01, 0.008, 0.014, 14), matCork, "wood", [0.024, 0.078, 0.008]);
  } else {
    // Classic Erlenmeyer conical flask
    const liqPts = [
      new THREE.Vector2(0, 0.012),
      new THREE.Vector2(0.036, 0.012),
      new THREE.Vector2(0.023, 0.064),
      new THREE.Vector2(0, 0.064),
    ];
    place(THREE, g, new THREE.LatheGeometry(liqPts, 28), matLiq, "primary", null, null, null, { emissiveMatch: true });
    place(THREE, g, new THREE.SphereGeometry(0.0045, 10, 8), matBub, "secondary", [0.01, 0.034, 0.006]);
    place(THREE, g, new THREE.SphereGeometry(0.0032, 10, 8), matBub, "secondary", [-0.008, 0.052, -0.004]);

    const glassPts = [
      new THREE.Vector2(0, 0.008),
      new THREE.Vector2(0.038, 0.008),
      new THREE.Vector2(0.042, 0.016),
      new THREE.Vector2(0.016, 0.104),
      new THREE.Vector2(0.016, 0.146),
      new THREE.Vector2(0.02, 0.151),
    ];
    place(THREE, g, new THREE.LatheGeometry(glassPts, 32), matGlass, null);
    place(THREE, g, new THREE.CylinderGeometry(0.014, 0.011, 0.022, 20), matCork, "wood", [0, 0.156, 0]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 17. microphone
// ---------------------------------------------------------------------------
function microphone(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matMet = makeMat(THREE, o.metal, { roughness: 0.25, metalness: 0.88 });
  const matPri = makeMat(THREE, o.primary, { roughness: 0.48, metalness: 0.15 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.28, metalness: 0.78 });
  const matFab = makeMat(THREE, o.fabric, { roughness: 0.88 });

  // Weighted base
  place(THREE, g, new THREE.CylinderGeometry(0.038, 0.044, 0.016, 28), matPri, "primary", [0, 0.008, 0]);
  place(THREE, g, new THREE.TorusGeometry(0.041, 0.0025, 8, 28), matAcc, "accent", [0, 0.015, 0], [Math.PI * 0.5, 0, 0]);
  place(THREE, g, new THREE.CylinderGeometry(0.007, 0.009, 0.08, 16), matMet, "metal", [0, 0.054, 0]);

  if (o.variant === 2) {
    // Stage dynamic mic in angled clip
    place(THREE, g, new THREE.CylinderGeometry(0.011, 0.011, 0.024, 16), matPri, "primary", [0, 0.098, 0], [0.55, 0, 0]);
    const mg = new THREE.Group();
    mg.position.set(0, 0.11, 0.004);
    mg.rotation.x = 0.55;
    place(THREE, mg, new THREE.CylinderGeometry(0.013, 0.009, 0.088, 20), matPri, "primary", [0, 0, 0]);
    place(THREE, mg, new THREE.SphereGeometry(0.022, 20, 16), matMet, "metal", [0, 0.056, 0]);
    place(THREE, mg, new THREE.TorusGeometry(0.0225, 0.0022, 8, 24), matAcc, "accent", [0, 0.056, 0], [Math.PI * 0.5, 0, 0]);
    g.add(mg);
  } else {
    // U-yoke cradle
    const yoke = tubeArc(THREE, [
      [-0.032, 0.142, 0],
      [-0.03, 0.104, 0],
      [0, 0.094, 0],
      [0.03, 0.104, 0],
      [0.032, 0.142, 0],
    ], 0.0038, 20, 8);
    place(THREE, g, yoke, matMet, "metal");
    place(THREE, g, new THREE.CylinderGeometry(0.006, 0.006, 0.072, 12), matAcc, "accent", [0, 0.142, 0], [0, 0, Math.PI * 0.5]);

    // Capsule body
    place(THREE, g, new THREE.CapsuleGeometry(0.024, 0.044, 12, 24), matMet, "metal", [0, 0.144, 0]);
    for (let i = -2; i <= 2; i++) {
      place(THREE, g, new THREE.TorusGeometry(0.0246, 0.0018, 8, 24), matPri, "primary", [0, 0.144 + i * 0.01, 0], [Math.PI * 0.5, 0, 0]);
    }
    if (o.variant === 1) {
      // Mini pop filter
      const arm = tubeArc(THREE, [[0, 0.072, 0], [0.028, 0.09, 0.038], [0, 0.144, 0.052]], 0.0022, 16, 6);
      place(THREE, g, arm, matMet, "metal");
      place(THREE, g, new THREE.TorusGeometry(0.026, 0.003, 10, 24), matPri, "primary", [0, 0.144, 0.052]);
      place(THREE, g, new THREE.CylinderGeometry(0.025, 0.025, 0.002, 24), matFab, "fabric", [0, 0.144, 0.052], [Math.PI * 0.5, 0, 0]);
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// 18. filmClapper
// ---------------------------------------------------------------------------
function filmClapper(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matPri = makeMat(THREE, o.primary, { roughness: 0.65 });
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.72 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.5 });
  const matMet = makeMat(THREE, o.metal, { roughness: 0.28, metalness: 0.88 });
  const matWood = makeMat(THREE, o.wood, { roughness: 0.68 });

  const slate = new THREE.Group();
  const yOff = o.variant === 2 ? 0.012 : 0;
  slate.position.y = yOff;

  if (o.variant === 2) {
    place(THREE, g, roundedBox(THREE, 0.11, 0.014, 0.036, 0.004, 0.002), matWood, "wood", [0, 0.007, 0]);
  }

  // Main slate body
  place(THREE, slate, roundedBox(THREE, 0.15, 0.106, 0.012, 0.004, 0.0018), matPri, "primary", [0, 0.053, 0]);
  // Horizontal divider bars on front
  place(THREE, slate, roundedBox(THREE, 0.132, 0.0035, 0.002, 0.001, 0.0003), matSec, "secondary", [0, 0.072, 0.0064]);
  place(THREE, slate, roundedBox(THREE, 0.132, 0.0035, 0.002, 0.001, 0.0003), matSec, "secondary", [0, 0.044, 0.0064]);
  place(THREE, slate, roundedBox(THREE, 0.0035, 0.028, 0.002, 0.001, 0.0003), matSec, "secondary", [-0.02, 0.058, 0.0064]);
  place(THREE, slate, roundedBox(THREE, 0.0035, 0.028, 0.002, 0.001, 0.0003), matSec, "secondary", [0.024, 0.058, 0.0064]);

  // Fixed lower clap bar with alternating stripes
  place(THREE, slate, roundedBox(THREE, 0.15, 0.018, 0.013, 0.002, 0.0012), matSec, "secondary", [0, 0.114, 0]);
  for (let i = 0; i < 4; i++) {
    place(THREE, slate, roundedBox(THREE, 0.018, 0.017, 0.0142, 0.001, 0.0006), matAcc, "accent", [-0.05 + i * 0.034, 0.114, 0], [0, 0, -0.35]);
  }

  // Hinged top clapper arm
  const arm = new THREE.Group();
  arm.position.set(-0.073, 0.124, 0);
  arm.rotation.z = o.variant === 1 ? 0 : o.variant === 2 ? 0.58 : 0.28;
  place(THREE, arm, roundedBox(THREE, 0.15, 0.018, 0.013, 0.002, 0.0012), matSec, "secondary", [0.073, 0.009, 0]);
  for (let i = 0; i < 4; i++) {
    place(THREE, arm, roundedBox(THREE, 0.018, 0.017, 0.0142, 0.001, 0.0006), matAcc, "accent", [0.023 + i * 0.034, 0.009, 0], [0, 0, 0.35]);
  }
  slate.add(arm);

  // Metal hinge plate & rivets
  place(THREE, slate, roundedBox(THREE, 0.016, 0.028, 0.016, 0.002, 0.001), matMet, "metal", [-0.071, 0.123, 0]);
  g.add(slate);
  return g;
}

// ---------------------------------------------------------------------------
// 19. danceShoes
// ---------------------------------------------------------------------------
function danceShoes(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matPri = makeMat(THREE, o.primary, { roughness: o.variant === 1 ? 0.25 : 0.55 });
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.78 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.45 });
  const matMet = makeMat(THREE, o.metal, { roughness: 0.24, metalness: 0.9 });

  const makeShoe = (side) => {
    const sg = new THREE.Group();
    // Sole
    place(THREE, sg, roundedBox(THREE, 0.044, 0.008, 0.112, 0.018, 0.003), matSec, "secondary", [0, 0.004, 0]);
    if (o.variant === 2) {
      // High-top dance sneaker
      place(THREE, sg, roundedBox(THREE, 0.042, 0.026, 0.102, 0.016, 0.006), matPri, "primary", [0, 0.02, -0.002]);
      place(THREE, sg, new THREE.CylinderGeometry(0.02, 0.022, 0.042, 18), matPri, "primary", [0, 0.048, -0.024]);
      place(THREE, sg, new THREE.TorusGeometry(0.02, 0.0045, 8, 18), matSec, "secondary", [0, 0.068, -0.024], [Math.PI * 0.5, 0, 0]);
      for (let i = 0; i < 3; i++) {
        place(THREE, sg, roundedBox(THREE, 0.024, 0.003, 0.005, 0.001, 0.0005), matAcc, "accent", [0, 0.036 + i * 0.01, 0.005 - i * 0.006]);
      }
    } else {
      // Ballet pointe shoe or tap slipper
      place(THREE, sg, new THREE.CapsuleGeometry(0.019, 0.058, 10, 18), matPri, "primary", [0, 0.022, 0.004], [Math.PI * 0.5, 0, 0], [1.05, 1, 0.78]);
      // Foot opening recess
      place(THREE, sg, new THREE.CylinderGeometry(0.014, 0.014, 0.006, 18), matSec, "secondary", [0, 0.034, -0.012], null, [0.85, 1, 1.4]);
      if (o.variant === 1) {
        // Tap shoe heel, strap & metal tap
        place(THREE, sg, new THREE.CylinderGeometry(0.015, 0.014, 0.014, 16), matPri, "primary", [0, 0.007, -0.036]);
        place(THREE, sg, new THREE.CylinderGeometry(0.014, 0.014, 0.0025, 16), matMet, "metal", [0, 0.0015, 0.034]);
        place(THREE, sg, roundedBox(THREE, 0.042, 0.005, 0.008, 0.002, 0.001), matAcc, "accent", [0, 0.037, -0.004]);
      } else {
        // Satin ankle ribbon curled gracefully
        const rib = tubeArc(THREE, [
          [side * 0.016, 0.032, -0.016],
          [side * 0.032, 0.012, -0.042],
          [side * 0.01, 0.005, -0.068],
          [-side * 0.018, 0.004, -0.056],
        ], 0.0032, 18, 6);
        place(THREE, sg, rib, matAcc, "accent");
      }
    }
    return sg;
  };

  const left = makeShoe(-1);
  left.position.set(-0.032, 0, 0.006);
  left.rotation.y = 0.22;
  g.add(left);

  const right = makeShoe(1);
  right.position.set(0.034, 0, -0.006);
  right.rotation.y = -0.28;
  g.add(right);

  return g;
}

// ---------------------------------------------------------------------------
// 20. basketball
// ---------------------------------------------------------------------------
function basketball(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matPri = makeMat(THREE, o.primary, { roughness: 0.72 });
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.65 });
  const matWood = makeMat(THREE, o.wood, { roughness: 0.65 });
  const matMet = makeMat(THREE, o.metal, { roughness: 0.28, metalness: 0.88 });
  const matSeam = makeMat(THREE, 0x2b2420, { roughness: 0.8 });

  const R = 0.066;
  const ballY = o.variant === 1 ? R + 0.018 : R + 0.008;

  if (o.variant === 1) {
    // 3-peg metal trophy stand
    place(THREE, g, new THREE.CylinderGeometry(0.04, 0.044, 0.01, 24), matMet, "metal", [0, 0.005, 0]);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      place(THREE, g, new THREE.CylinderGeometry(0.004, 0.005, 0.032, 10), matMet, "metal", [Math.cos(a) * 0.03, 0.022, Math.sin(a) * 0.03]);
    }
  } else {
    // Wooden display ring
    place(THREE, g, new THREE.TorusGeometry(0.038, 0.008, 12, 28), matWood, "wood", [0, 0.008, 0], [Math.PI * 0.5, 0, 0]);
  }

  const ball = new THREE.Group();
  ball.position.y = ballY;
  ball.rotation.set(0.2, 0.4, 0.15);

  place(THREE, ball, new THREE.SphereGeometry(R, 32, 24), matPri, "primary");
  if (o.variant === 2) {
    // Vintage contrast panel
    place(THREE, ball, new THREE.SphereGeometry(R + 0.0006, 24, 18, 0, Math.PI * 0.5, 0, Math.PI), matSec, "secondary");
    place(THREE, ball, new THREE.SphereGeometry(R + 0.0006, 24, 18, Math.PI, Math.PI * 0.5, 0, Math.PI), matSec, "secondary");
  }

  // Classic basketball seams
  const seamTorus = new THREE.TorusGeometry(R + 0.0008, 0.0018, 8, 40);
  place(THREE, ball, seamTorus, matSeam, null, null, [Math.PI * 0.5, 0, 0]);
  place(THREE, ball, seamTorus, matSeam, null, null, [0, 0, 0]);
  const sideSeam = new THREE.TorusGeometry(R * 0.72, 0.0018, 8, 32);
  place(THREE, ball, sideSeam, matSeam, null, [0, 0, R * 0.69]);
  place(THREE, ball, sideSeam, matSeam, null, [0, 0, -R * 0.69]);

  g.add(ball);
  return g;
}

// ---------------------------------------------------------------------------
// 21. soccerBall
// ---------------------------------------------------------------------------
function soccerBall(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.48 });
  const matPri = makeMat(THREE, o.primary, { roughness: 0.52 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.3, metalness: 0.75 });
  const matWood = makeMat(THREE, o.wood, { roughness: 0.65 });
  const matTurf = makeMat(THREE, 0x4f8a4b, { roughness: 0.92 });

  const R = 0.066;
  const ballY = R + 0.008;

  if (o.variant === 2) {
    place(THREE, g, new THREE.CylinderGeometry(0.056, 0.058, 0.012, 28), matTurf, null, [0, 0.006, 0]);
  } else {
    place(THREE, g, new THREE.TorusGeometry(0.038, 0.008, 12, 28), matWood, "wood", [0, 0.008, 0], [Math.PI * 0.5, 0, 0]);
    if (o.variant === 1) {
      place(THREE, g, new THREE.TorusGeometry(0.044, 0.0025, 8, 28), matAcc, "accent", [0, 0.008, 0], [Math.PI * 0.5, 0, 0]);
    }
  }

  const ball = new THREE.Group();
  ball.position.y = ballY;
  ball.rotation.set(0.3, 0.5, 0.1);
  place(THREE, ball, new THREE.SphereGeometry(R, 32, 24), matSec, "secondary");

  // 12 icosahedron pentagon patches
  const phi = (1 + Math.sqrt(5)) * 0.5;
  const verts = [
    [0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi],
    [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0],
    [phi, 0, 1], [-phi, 0, 1], [phi, 0, -1], [-phi, 0, -1],
  ];
  const up = new THREE.Vector3(0, 1, 0);
  const patchGeo = new THREE.CylinderGeometry(0.019, 0.02, 0.004, 5);
  for (let i = 0; i < verts.length; i++) {
    const dir = new THREE.Vector3(verts[i][0], verts[i][1], verts[i][2]).normalize();
    const m = new THREE.Mesh(patchGeo, matPri);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.slot = "primary";
    m.position.copy(dir).multiplyScalar(R - 0.0004);
    m.quaternion.setFromUnitVectors(up, dir);
    ball.add(m);
  }

  g.add(ball);
  return g;
}

// ---------------------------------------------------------------------------
// 22. runningBib
// ---------------------------------------------------------------------------
function runningBib(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matPri = makeMat(THREE, o.primary, { roughness: 0.65 });
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.78 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.5 });
  const matMet = makeMat(THREE, o.metal, { roughness: 0.25, metalness: 0.9 });
  const matWood = makeMat(THREE, o.wood, { roughness: 0.68 });

  const makeBibSheet = () => {
    const bg = new THREE.Group();
    place(THREE, bg, roundedBox(THREE, 0.136, 0.104, 0.003, 0.004, 0.0008), matSec, "secondary");
    // Top event stripe
    place(THREE, bg, roundedBox(THREE, 0.124, 0.018, 0.0018, 0.002, 0.0003), matPri, "primary", [0, 0.036, 0.0014]);
    // Abstract geometric bib digits (no text/fonts)
    place(THREE, bg, roundedBox(THREE, 0.014, 0.036, 0.0018, 0.002, 0.0003), matAcc, "accent", [-0.034, -0.004, 0.0014]);
    place(THREE, bg, roundedBox(THREE, 0.022, 0.036, 0.0018, 0.003, 0.0003), matAcc, "accent", [-0.004, -0.004, 0.0014]);
    place(THREE, bg, roundedBox(THREE, 0.01, 0.022, 0.0022, 0.002, 0.0002), matSec, "secondary", [-0.004, -0.004, 0.0018]);
    place(THREE, bg, roundedBox(THREE, 0.022, 0.036, 0.0018, 0.003, 0.0003), matAcc, "accent", [0.028, -0.004, 0.0014]);
    // Bottom accent bar
    place(THREE, bg, roundedBox(THREE, 0.104, 0.007, 0.0016, 0.001, 0.0002), matPri, "primary", [0, -0.036, 0.0014]);

    // 4 corner safety pins
    const corners = [[-0.056, 0.04], [0.056, 0.04], [-0.056, -0.04], [0.056, -0.04]];
    for (let i = 0; i < corners.length; i++) {
      place(THREE, bg, new THREE.CapsuleGeometry(0.0015, 0.011, 6, 8), matMet, "metal", [corners[i][0], corners[i][1], 0.0026], [0, 0, 0.7]);
    }
    return bg;
  };

  if (o.variant === 1) {
    const bib = makeBibSheet();
    bib.position.set(0, 0.003, 0);
    bib.rotation.set(-Math.PI * 0.5, 0, 0.06);
    g.add(bib);
    place(THREE, g, new THREE.TorusGeometry(0.02, 0.004, 8, 24), matAcc, "accent", [0.048, 0.006, 0.036], [Math.PI * 0.5, 0, 0]);
  } else if (o.variant === 2) {
    // Framed mini bib
    const frame = new THREE.Group();
    frame.position.set(0, 0.064, 0);
    frame.rotation.x = -0.18;
    place(THREE, frame, roundedBox(THREE, 0.154, 0.122, 0.012, 0.005, 0.002), matWood, "wood");
    const bib = makeBibSheet();
    bib.position.z = 0.0055;
    frame.add(bib);
    g.add(frame);
  } else {
    place(THREE, g, roundedBox(THREE, 0.096, 0.016, 0.03, 0.004, 0.002), matWood, "wood", [0, 0.008, 0]);
    const bib = makeBibSheet();
    bib.position.set(0, 0.064, 0);
    bib.rotation.x = -0.18;
    g.add(bib);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 23. teaCup
// ---------------------------------------------------------------------------
function teaCup(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matPri = makeMat(THREE, o.primary, { roughness: 0.24, metalness: 0.06 });
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.24, metalness: 0.06 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.25, metalness: 0.72 });
  const matWood = makeMat(THREE, o.wood, { roughness: 0.68 });
  const matMet = makeMat(THREE, o.metal, { roughness: 0.22, metalness: 0.9 });
  const matTea = makeMat(THREE, 0x8d572a, { roughness: 0.12, metalness: 0.05 });

  if (o.variant === 1) {
    // Japanese yunomi cup on wooden coaster
    place(THREE, g, roundedBox(THREE, 0.092, 0.009, 0.092, 0.014, 0.003), matWood, "wood", [0, 0.0045, 0]);
    const pts = [
      new THREE.Vector2(0, 0.009),
      new THREE.Vector2(0.025, 0.009),
      new THREE.Vector2(0.032, 0.024),
      new THREE.Vector2(0.034, 0.064),
      new THREE.Vector2(0.032, 0.078),
      new THREE.Vector2(0.028, 0.078),
      new THREE.Vector2(0.028, 0.024),
      new THREE.Vector2(0, 0.02),
    ];
    place(THREE, g, new THREE.LatheGeometry(pts, 32), matPri, "primary");
    place(THREE, g, new THREE.CylinderGeometry(0.0345, 0.0345, 0.009, 32, 1, true), matAcc, "accent", [0, 0.048, 0]);
    place(THREE, g, new THREE.CircleGeometry(0.0285, 24), matTea, null, [0, 0.064, 0], [-Math.PI * 0.5, 0, 0]);
  } else {
    // Classic saucer
    const saucerPts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.034, 0),
      new THREE.Vector2(0.058, 0.012),
      new THREE.Vector2(0.056, 0.015),
      new THREE.Vector2(0.032, 0.006),
      new THREE.Vector2(0, 0.006),
    ];
    place(THREE, g, new THREE.LatheGeometry(saucerPts, 32), matSec, "secondary");
    place(THREE, g, new THREE.TorusGeometry(0.057, 0.0016, 8, 32), matAcc, "accent", [0, 0.0135, 0], [Math.PI * 0.5, 0, 0]);

    // Cup
    const cupPts = [
      new THREE.Vector2(0, 0.006),
      new THREE.Vector2(0.022, 0.006),
      new THREE.Vector2(0.035, 0.026),
      new THREE.Vector2(0.041, 0.066),
      new THREE.Vector2(0.038, 0.068),
      new THREE.Vector2(0.033, 0.028),
      new THREE.Vector2(0, 0.018),
    ];
    place(THREE, g, new THREE.LatheGeometry(cupPts, 32), matPri, "primary");
    place(THREE, g, new THREE.TorusGeometry(0.0395, 0.0018, 8, 32), matAcc, "accent", [0, 0.067, 0], [Math.PI * 0.5, 0, 0]);
    place(THREE, g, new THREE.CircleGeometry(0.036, 24), matTea, null, [0, 0.056, 0], [-Math.PI * 0.5, 0, 0]);

    // Delicate ear handle
    const handle = tubeArc(THREE, [
      [0.037, 0.056, 0],
      [0.056, 0.058, 0],
      [0.057, 0.038, 0],
      [0.044, 0.024, 0],
      [0.032, 0.022, 0],
    ], 0.0036, 18, 8);
    place(THREE, g, handle, matPri, "primary");

    if (o.variant === 2) {
      // Ceramic lid resting slightly askew
      const lid = new THREE.Group();
      lid.position.set(-0.006, 0.072, 0.004);
      lid.rotation.set(0.12, 0, 0.14);
      place(THREE, lid, new THREE.CylinderGeometry(0.034, 0.041, 0.009, 28), matSec, "secondary");
      place(THREE, lid, new THREE.SphereGeometry(0.007, 14, 10), matAcc, "accent", [0, 0.008, 0]);
      g.add(lid);
    } else {
      // Teaspoon on saucer
      place(THREE, g, roundedBox(THREE, 0.052, 0.002, 0.005, 0.001, 0.0005), matMet, "metal", [-0.012, 0.015, 0.036], [0, 0.32, 0.12]);
      place(THREE, g, new THREE.SphereGeometry(0.0075, 12, 8), matMet, "metal", [0.016, 0.013, 0.028], [0, 0.32, 0], [1.2, 0.25, 0.7]);
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// 24. snowGlobe
// ---------------------------------------------------------------------------
function snowGlobe(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matWood = makeMat(THREE, o.wood, { roughness: 0.55 });
  const matPri = makeMat(THREE, o.primary, { roughness: 0.55 });
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.85 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.35, metalness: 0.45 });
  const matPine = makeMat(THREE, 0x3f7b4c, { roughness: 0.78 });
  const matGlass = makeGlassMat(THREE, 0.3);

  // Lathe pedestal base
  const basePts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.044, 0),
    new THREE.Vector2(0.043, 0.014),
    new THREE.Vector2(0.036, 0.026),
    new THREE.Vector2(0.038, 0.038),
    new THREE.Vector2(0, 0.038),
  ];
  place(THREE, g, new THREE.LatheGeometry(basePts, 32), matWood, "wood");
  place(THREE, g, new THREE.TorusGeometry(0.0385, 0.0028, 8, 32), matAcc, "accent", [0, 0.036, 0], [Math.PI * 0.5, 0, 0]);

  // Snow mound inside globe
  place(THREE, g, new THREE.SphereGeometry(0.041, 22, 12), matSec, "secondary", [0, 0.048, 0], null, [1, 0.32, 1]);

  // Inner diorama
  if (o.variant === 1) {
    // Moon & stars
    place(THREE, g, new THREE.TorusGeometry(0.018, 0.0055, 10, 24, Math.PI * 1.35), matAcc, "accent", [-0.004, 0.088, 0], [0, 0, 1.1]);
    place(THREE, g, starGeo(THREE, 0.008, 0.0035, 0.0025, 0.0006), matAcc, "accent", [0.018, 0.098, 0.006]);
    place(THREE, g, starGeo(THREE, 0.006, 0.0028, 0.002, 0.0005), matPri, "primary", [0.014, 0.072, -0.008]);
  } else if (o.variant === 2) {
    // Alpine mountain + pine
    place(THREE, g, new THREE.ConeGeometry(0.024, 0.048, 6), matPri, "primary", [-0.008, 0.078, -0.006]);
    place(THREE, g, new THREE.ConeGeometry(0.012, 0.022, 6), matSec, "secondary", [-0.008, 0.092, -0.006]);
    place(THREE, g, new THREE.ConeGeometry(0.012, 0.028, 10), matPine, null, [0.018, 0.068, 0.01]);
  } else {
    // Cozy cabin + pine tree
    place(THREE, g, roundedBox(THREE, 0.024, 0.02, 0.022, 0.002, 0.0008), matPri, "primary", [-0.01, 0.066, 0]);
    place(THREE, g, new THREE.ConeGeometry(0.02, 0.018, 4), matSec, "secondary", [-0.01, 0.084, 0], [0, Math.PI * 0.25, 0]);
    place(THREE, g, new THREE.ConeGeometry(0.013, 0.032, 10), matPine, null, [0.017, 0.072, 0.006]);
    place(THREE, g, new THREE.ConeGeometry(0.01, 0.022, 10), matPine, null, [0.017, 0.086, 0.006]);
  }

  // Suspended snowflakes
  const rand = seededRand(240 + o.variant);
  const flakeGeo = new THREE.SphereGeometry(0.0022, 6, 6);
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2;
    const rad = 0.01 + rand() * 0.032;
    const y = 0.064 + rand() * 0.056;
    place(THREE, g, flakeGeo, matSec, "secondary", [Math.cos(a) * rad, y, Math.sin(a) * rad]);
  }

  // Outer glass globe
  place(THREE, g, new THREE.SphereGeometry(0.051, 32, 24), matGlass, null, [0, 0.082, 0]);
  return g;
}

// ---------------------------------------------------------------------------
// 25. lantern
// ---------------------------------------------------------------------------
function lantern(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matPri = makeMat(THREE, o.primary, { roughness: 0.48, metalness: 0.2 });
  const matSec = makeMat(THREE, o.secondary, {
    roughness: 0.55,
    emissive: new THREE.Color(o.accent),
    emissiveIntensity: 0.25,
  });
  const matGlow = makeMat(THREE, o.accent, {
    roughness: 0.2,
    emissive: new THREE.Color(o.accent),
    emissiveIntensity: 0.95,
  });
  const matWood = makeMat(THREE, o.wood, { roughness: 0.65 });
  const matMet = makeMat(THREE, o.metal, { roughness: 0.28, metalness: 0.88 });
  const matGlass = makeGlassMat(THREE, 0.35);

  if (o.variant === 1) {
    // Wooden shoji table lantern
    place(THREE, g, roundedBox(THREE, 0.094, 0.016, 0.094, 0.006, 0.002), matWood, "wood", [0, 0.008, 0]);
    place(THREE, g, roundedBox(THREE, 0.094, 0.014, 0.094, 0.006, 0.002), matWood, "wood", [0, 0.146, 0]);
    place(THREE, g, roundedBox(THREE, 0.076, 0.126, 0.076, 0.004, 0.001), matSec, "secondary", [0, 0.08, 0]);
    const posts = [[-0.04, -0.04], [0.04, -0.04], [-0.04, 0.04], [0.04, 0.04]];
    for (let i = 0; i < posts.length; i++) {
      place(THREE, g, roundedBox(THREE, 0.01, 0.132, 0.01, 0.002, 0.001), matWood, "wood", [posts[i][0], 0.078, posts[i][1]]);
    }
    const handle = tubeArc(THREE, [[-0.036, 0.152, 0], [0, 0.19, 0], [0.036, 0.152, 0]], 0.003, 18, 8);
    place(THREE, g, handle, matMet, "metal");
  } else if (o.variant === 2) {
    // Rounded festival paper lantern on mini stand
    place(THREE, g, new THREE.CylinderGeometry(0.038, 0.042, 0.012, 24), matWood, "wood", [0, 0.006, 0]);
    place(THREE, g, new THREE.CylinderGeometry(0.026, 0.028, 0.012, 24), matPri, "primary", [0, 0.022, 0]);
    place(THREE, g, new THREE.SphereGeometry(0.05, 24, 18), matSec, "secondary", [0, 0.082, 0], null, [1, 1.15, 1]);
    for (let i = -2; i <= 2; i++) {
      const y = 0.082 + i * 0.018;
      const rad = Math.sqrt(Math.max(0.0004, 1 - (i * 0.31) * (i * 0.31))) * 0.0505;
      place(THREE, g, new THREE.TorusGeometry(rad, 0.0014, 6, 28), matPri, "primary", [0, y, 0], [Math.PI * 0.5, 0, 0]);
    }
    place(THREE, g, new THREE.CylinderGeometry(0.024, 0.026, 0.012, 24), matPri, "primary", [0, 0.142, 0]);
    place(THREE, g, new THREE.TorusGeometry(0.014, 0.0025, 8, 18), matMet, "metal", [0, 0.158, 0]);
  } else {
    // Classic camp/dorm lantern
    place(THREE, g, new THREE.CylinderGeometry(0.042, 0.048, 0.024, 28), matPri, "primary", [0, 0.012, 0]);
    // Inner glowing core
    place(THREE, g, new THREE.CylinderGeometry(0.012, 0.013, 0.042, 16), matSec, "secondary", [0, 0.045, 0]);
    place(THREE, g, new THREE.SphereGeometry(0.012, 16, 12), matGlow, "accent", [0, 0.072, 0], null, [0.85, 1.25, 0.85], { emissiveMatch: true });
    // Glass chimney
    place(THREE, g, new THREE.CylinderGeometry(0.032, 0.032, 0.09, 24), matGlass, null, [0, 0.069, 0]);
    // 4 metal guard struts
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
      place(THREE, g, new THREE.CylinderGeometry(0.0024, 0.0024, 0.096, 8), matMet, "metal", [Math.cos(a) * 0.038, 0.072, Math.sin(a) * 0.038]);
    }
    // Cap + dome
    place(THREE, g, new THREE.CylinderGeometry(0.028, 0.044, 0.022, 28), matPri, "primary", [0, 0.125, 0]);
    place(THREE, g, new THREE.CylinderGeometry(0.016, 0.022, 0.016, 20), matMet, "metal", [0, 0.144, 0]);
    const handle = tubeArc(THREE, [[-0.038, 0.122, 0], [0, 0.188, 0], [0.038, 0.122, 0]], 0.003, 20, 8);
    place(THREE, g, handle, matMet, "metal");
  }
  return g;
}

// ---------------------------------------------------------------------------
// 26. origamiStar
// ---------------------------------------------------------------------------
function origamiStar(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matPri = makeMat(THREE, o.primary, { roughness: 0.72 });
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.76 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.55 });
  const matWood = makeMat(THREE, o.wood, { roughness: 0.68 });
  const matMet = makeMat(THREE, o.metal, { roughness: 0.28, metalness: 0.88 });

  const makePuffyStar = (r, mat, slot) => {
    const sg = new THREE.Group();
    const geo = starGeo(THREE, r, r * 0.52, r * 0.28, r * 0.16);
    place(THREE, sg, geo, mat, slot);
    place(THREE, sg, new THREE.SphereGeometry(r * 0.44, 14, 10), mat, slot, [0, 0, 0], null, [1, 1, 0.72]);
    return sg;
  };

  if (o.variant === 1) {
    // Cozy trio of lucky stars
    const s1 = makePuffyStar(0.036, matPri, "primary");
    s1.position.set(-0.02, 0.028, 0.004);
    s1.rotation.set(-0.35, 0.3, 0.2);
    g.add(s1);

    const s2 = makePuffyStar(0.03, matAcc, "accent");
    s2.position.set(0.028, 0.024, 0.012);
    s2.rotation.set(-0.4, -0.45, -0.15);
    g.add(s2);

    const s3 = makePuffyStar(0.026, matSec, "secondary");
    s3.position.set(0.004, 0.02, -0.026);
    s3.rotation.set(-0.9, 0.1, 0.4);
    g.add(s3);
  } else if (o.variant === 2) {
    // Perched on a tiny wire pedestal
    place(THREE, g, new THREE.CylinderGeometry(0.028, 0.032, 0.012, 24), matWood, "wood", [0, 0.006, 0]);
    place(THREE, g, new THREE.CylinderGeometry(0.0022, 0.0022, 0.05, 10), matMet, "metal", [0, 0.036, 0]);
    const s = makePuffyStar(0.038, matPri, "primary");
    s.position.set(0, 0.088, 0);
    s.rotation.set(0, 0.15, 0.08);
    g.add(s);
  } else {
    // Single sculptural puffy star standing slightly angled
    const s = makePuffyStar(0.044, matPri, "primary");
    s.position.set(0, 0.038, 0);
    s.rotation.set(-0.22, 0.12, 0);
    g.add(s);
    place(THREE, g, new THREE.TorusGeometry(0.02, 0.0028, 8, 20), matAcc, "accent", [0, 0.038, 0], [0.4, 0.6, 0]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 27. postcardStack
// ---------------------------------------------------------------------------
function postcardStack(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matPri = makeMat(THREE, o.primary, { roughness: 0.65 });
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.8 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.5 });
  const matFab = makeMat(THREE, o.fabric, { roughness: 0.72 });

  const makeCard = (decorated) => {
    const cg = new THREE.Group();
    place(THREE, cg, roundedBox(THREE, 0.138, 0.0032, 0.094, 0.003, 0.0008), matSec, "secondary");
    if (decorated) {
      // Stylized travel art
      place(THREE, cg, roundedBox(THREE, 0.122, 0.0014, 0.078, 0.002, 0.0003), matFab, "fabric", [0, 0.0016, 0]);
      place(THREE, cg, roundedBox(THREE, 0.122, 0.0016, 0.03, 0.001, 0.0002), matPri, "primary", [0, 0.0019, 0.024]);
      place(THREE, cg, new THREE.CylinderGeometry(0.013, 0.013, 0.0018, 18), matAcc, "accent", [0.026, 0.0022, -0.014]);
    }
    return cg;
  };

  if (o.variant === 2) {
    // Fanned postcards
    for (let i = 0; i < 4; i++) {
      const c = makeCard(i === 3);
      c.position.set((i - 1.5) * 0.012, 0.002 + i * 0.0036, (i - 1.5) * 0.006);
      c.rotation.y = (i - 1.5) * 0.16;
      g.add(c);
    }
  } else {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const c = makeCard(i === count - 1);
      c.position.set(((i % 2) - 0.5) * 0.003, 0.0018 + i * 0.0035, (((i + 1) % 2) - 0.5) * 0.002);
      c.rotation.y = ((i % 3) - 1) * 0.035;
      g.add(c);
    }
    const stackH = count * 0.0035 + 0.002;
    // Ribbon wrap + bow
    place(THREE, g, roundedBox(THREE, 0.014, stackH + 0.003, 0.098, 0.002, 0.0006), matAcc, "accent", [0, stackH * 0.5, 0]);
    place(THREE, g, new THREE.TorusGeometry(0.01, 0.003, 8, 16), matAcc, "accent", [-0.01, stackH + 0.005, 0], [0.3, 0.2, 0.4]);
    place(THREE, g, new THREE.TorusGeometry(0.01, 0.003, 8, 16), matAcc, "accent", [0.01, stackH + 0.005, 0], [0.3, -0.2, -0.4]);

    if (o.variant === 1) {
      // Extra postcard propped upright behind stack
      const prop = makeCard(true);
      prop.position.set(0, 0.052, -0.058);
      prop.rotation.set(1.32, 0, 0.04);
      g.add(prop);
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// 28. keyring
// ---------------------------------------------------------------------------
function keyring(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const matMet = makeMat(THREE, o.metal, { roughness: 0.24, metalness: 0.9 });
  const matPri = makeMat(THREE, o.primary, { roughness: 0.35, metalness: 0.1 });
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.65 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.28, metalness: 0.78 });
  const matWood = makeMat(THREE, o.wood, { roughness: 0.65 });

  const makeKey = (mat, slot) => {
    const kg = new THREE.Group();
    place(THREE, kg, new THREE.CylinderGeometry(0.011, 0.011, 0.0032, 18), mat, slot, [0, 0, 0]);
    place(THREE, kg, roundedBox(THREE, 0.032, 0.0028, 0.006, 0.001, 0.0004), mat, slot, [0.022, 0, 0]);
    place(THREE, kg, roundedBox(THREE, 0.005, 0.0028, 0.005, 0.0008, 0.0003), mat, slot, [0.022, 0, 0.0045]);
    place(THREE, kg, roundedBox(THREE, 0.005, 0.0028, 0.006, 0.0008, 0.0003), mat, slot, [0.032, 0, 0.005]);
    return kg;
  };

  // Main split ring
  place(THREE, g, new THREE.TorusGeometry(0.016, 0.0024, 10, 28), matMet, "metal", [-0.018, 0.004, 0], [Math.PI * 0.5, 0, 0]);

  const k1 = makeKey(matMet, "metal");
  k1.position.set(0.004, 0.003, -0.008);
  k1.rotation.y = 0.28;
  g.add(k1);

  const k2 = makeKey(matAcc, "accent");
  k2.position.set(0.002, 0.0065, 0.008);
  k2.rotation.y = -0.36;
  g.add(k2);

  if (o.variant === 1) {
    // Wooden capsule fob + mini tassel
    place(THREE, g, new THREE.CapsuleGeometry(0.01, 0.024, 8, 16), matWood, "wood", [-0.048, 0.01, 0.016], [Math.PI * 0.5, 0, 0.6]);
    place(THREE, g, new THREE.ConeGeometry(0.008, 0.02, 12), matAcc, "accent", [-0.032, 0.008, -0.024], [Math.PI * 0.5, 0, -0.7]);
  } else if (o.variant === 2) {
    // Star charm + carabiner loop
    place(THREE, g, starGeo(THREE, 0.018, 0.008, 0.004, 0.0012), matAcc, "accent", [-0.046, 0.005, 0.01], [Math.PI * 0.5, 0, 0.3]);
    place(THREE, g, new THREE.TorusGeometry(0.012, 0.0024, 8, 20), matPri, "primary", [-0.038, 0.004, -0.022], [Math.PI * 0.5, 0, 0], [1.3, 0.75, 1]);
  } else {
    // Round enamel charm tag
    place(THREE, g, new THREE.CylinderGeometry(0.018, 0.018, 0.005, 24), matMet, "metal", [-0.046, 0.0035, 0.01]);
    place(THREE, g, new THREE.CylinderGeometry(0.0155, 0.0155, 0.0058, 24), matPri, "primary", [-0.046, 0.0036, 0.01]);
    place(THREE, g, new THREE.CylinderGeometry(0.007, 0.007, 0.0064, 16), matSec, "secondary", [-0.046, 0.0038, 0.01]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 29. nameCardHolder (takes opts.count 0..8)
// ---------------------------------------------------------------------------
function nameCardHolder(THREE, opts) {
  const o = resolveOpts(opts);
  const count = Math.max(0, Math.min(8, Math.round(o.count ?? 4)));
  const g = new THREE.Group();
  const matWood = makeMat(THREE, o.wood, { roughness: 0.62 });
  const matMet = makeMat(THREE, o.metal, { roughness: 0.26, metalness: 0.88 });
  const matPri = makeMat(THREE, o.primary, { roughness: 0.55 });
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.8 });
  const matAcc = makeMat(THREE, o.accent, { roughness: 0.45 });

  if (o.variant === 1) {
    // Brass wire desk holder
    place(THREE, g, roundedBox(THREE, 0.104, 0.008, 0.046, 0.004, 0.002), matWood, "wood", [0, 0.004, 0]);
    const wL = tubeArc(THREE, [[-0.046, 0.008, 0.018], [-0.046, 0.022, 0.018], [-0.046, 0.044, -0.018], [-0.046, 0.008, -0.018]], 0.0025);
    const wR = tubeArc(THREE, [[0.046, 0.008, 0.018], [0.046, 0.022, 0.018], [0.046, 0.044, -0.018], [0.046, 0.008, -0.018]], 0.0025);
    const wF = tubeArc(THREE, [[-0.046, 0.022, 0.018], [0.046, 0.022, 0.018]], 0.0025);
    const wB = tubeArc(THREE, [[-0.046, 0.044, -0.018], [0.046, 0.044, -0.018]], 0.0025);
    place(THREE, g, wL, matMet, "metal");
    place(THREE, g, wR, matMet, "metal");
    place(THREE, g, wF, matMet, "metal");
    place(THREE, g, wB, matMet, "metal");
  } else if (o.variant === 2) {
    // Enamel & wood desk caddy
    place(THREE, g, roundedBox(THREE, 0.106, 0.01, 0.048, 0.005, 0.002), matWood, "wood", [0, 0.005, 0]);
    place(THREE, g, roundedBox(THREE, 0.104, 0.022, 0.007, 0.003, 0.0015), matPri, "primary", [0, 0.019, 0.02]);
    place(THREE, g, roundedBox(THREE, 0.104, 0.036, 0.007, 0.003, 0.0015), matPri, "primary", [0, 0.026, -0.02]);
    place(THREE, g, roundedBox(THREE, 0.007, 0.028, 0.046, 0.003, 0.0015), matPri, "primary", [-0.049, 0.022, 0]);
    place(THREE, g, roundedBox(THREE, 0.007, 0.028, 0.046, 0.003, 0.0015), matPri, "primary", [0.049, 0.022, 0]);
  } else {
    // Classic angled wooden slot caddy
    place(THREE, g, roundedBox(THREE, 0.106, 0.022, 0.048, 0.006, 0.003), matWood, "wood", [0, 0.011, 0]);
    place(THREE, g, roundedBox(THREE, 0.104, 0.03, 0.012, 0.004, 0.002), matWood, "wood", [0, 0.024, -0.018]);
    place(THREE, g, roundedBox(THREE, 0.088, 0.005, 0.003, 0.001, 0.0005), matAcc, "accent", [0, 0.012, 0.0245]);
  }

  // Cards (0 to 8)
  const rand = seededRand(290 + count);
  const startZ = 0.012;
  const stepZ = count > 1 ? 0.024 / (count - 1) : 0;

  for (let i = 0; i < count; i++) {
    const cg = new THREE.Group();
    const z = count === 1 ? 0 : startZ - i * stepZ;
    const xJit = (rand() - 0.5) * 0.005;
    const rotZ = (rand() - 0.5) * 0.06;
    cg.position.set(xJit, 0.037 + i * 0.0006, z);
    cg.rotation.set(-0.16, 0, rotZ);

    place(THREE, cg, roundedBox(THREE, 0.086, 0.05, 0.0018, 0.002, 0.0004), matSec, "secondary");
    const stripeMat = i % 3 === 0 ? matPri : i % 3 === 1 ? matAcc : matMet;
    const stripeSlot = i % 3 === 0 ? "primary" : i % 3 === 1 ? "accent" : "metal";
    place(THREE, cg, roundedBox(THREE, 0.074, 0.006, 0.0022, 0.001, 0.0002), stripeMat, stripeSlot, [0, 0.013, 0.0002]);
    place(THREE, cg, roundedBox(THREE, 0.042, 0.0035, 0.0022, 0.001, 0.0002), stripeMat, stripeSlot, [-0.014, 0.001, 0.0002]);
    g.add(cg);
  }

  return g;
}

// ---------------------------------------------------------------------------
// 30. jarOfStars (takes opts.count 0..30)
// ---------------------------------------------------------------------------
function jarOfStars(THREE, opts) {
  const o = resolveOpts(opts);
  const count = Math.max(0, Math.min(30, Math.round(o.count ?? 12)));
  const g = new THREE.Group();
  const matGlass = makeGlassMat(THREE, 0.3);
  const matCork = makeMat(THREE, o.wood, { roughness: 0.82 });
  const matMet = makeMat(THREE, o.metal, { roughness: 0.28, metalness: 0.88 });
  const matPri = makeMat(THREE, o.primary, { roughness: 0.72 });
  const matSec = makeMat(THREE, o.secondary, { roughness: 0.8 });
  const matStar = makeMat(THREE, o.accent, {
    roughness: 0.28,
    metalness: 0.15,
    emissive: new THREE.Color(o.accent),
    emissiveIntensity: 0.85,
  });

  // Glowing origami stars packed organically from the bottom up
  const rand = seededRand(3000 + o.variant * 31);
  const sGeo = starGeo(THREE, 0.0115, 0.0056, 0.0048, 0.0018);

  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1);
    const layer = Math.floor(i / 5);
    const inLayer = i % 5;
    const baseY = 0.018 + layer * 0.0155 + (rand() - 0.5) * 0.006;
    const y = Math.min(0.106, baseY);
    const maxR = o.variant === 2 ? (y < 0.08 ? 0.033 : 0.022) : 0.028;
    const ang = inLayer * ((Math.PI * 2) / 5) + layer * 0.65 + (rand() - 0.5) * 0.55;
    const rad = inLayer === 0 && layer % 2 === 0 ? rand() * 0.008 : (0.38 + rand() * 0.62) * maxR;
    const s = 0.86 + rand() * 0.26 + t * 0.0;
    place(
      THREE,
      g,
      sGeo,
      matStar,
      "accent",
      [Math.cos(ang) * rad, y, Math.sin(ang) * rad],
      [rand() * Math.PI, rand() * Math.PI, rand() * Math.PI],
      [s, s, s],
      { emissiveMatch: true }
    );
  }

  // Outer glass jar silhouette
  let jarPts;
  let neckY = 0.126;
  let neckR = 0.03;

  if (o.variant === 1) {
    // Wide-mouth mason jar
    neckY = 0.132;
    neckR = 0.036;
    jarPts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.038, 0),
      new THREE.Vector2(0.044, 0.008),
      new THREE.Vector2(0.044, 0.114),
      new THREE.Vector2(0.036, 0.126),
      new THREE.Vector2(0.036, 0.14),
      new THREE.Vector2(0.032, 0.14),
    ];
    place(THREE, g, new THREE.CylinderGeometry(0.039, 0.039, 0.016, 28), matMet, "metal", [0, 0.144, 0]);
    place(THREE, g, new THREE.TorusGeometry(0.039, 0.0022, 8, 28), matMet, "metal", [0, 0.138, 0], [Math.PI * 0.5, 0, 0]);
  } else if (o.variant === 2) {
    // Rounded apothecary / potion star jar
    neckY = 0.122;
    neckR = 0.024;
    jarPts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.034, 0),
      new THREE.Vector2(0.048, 0.028),
      new THREE.Vector2(0.05, 0.068),
      new THREE.Vector2(0.038, 0.104),
      new THREE.Vector2(0.024, 0.118),
      new THREE.Vector2(0.024, 0.136),
      new THREE.Vector2(0.028, 0.14),
    ];
    place(THREE, g, new THREE.CylinderGeometry(0.022, 0.019, 0.026, 22), matCork, "wood", [0, 0.144, 0]);
    // Tiny hanging paper tag
    place(THREE, g, roundedBox(THREE, 0.016, 0.022, 0.002, 0.002, 0.0004), matSec, "secondary", [0.032, 0.102, 0.016], [0.1, 0.5, -0.25]);
  } else {
    // Classic dorm cork-stoppered jar
    jarPts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.036, 0),
      new THREE.Vector2(0.044, 0.012),
      new THREE.Vector2(0.044, 0.108),
      new THREE.Vector2(0.03, 0.124),
      new THREE.Vector2(0.03, 0.138),
      new THREE.Vector2(0.034, 0.142),
    ];
    place(THREE, g, new THREE.CylinderGeometry(0.028, 0.024, 0.026, 24), matCork, "wood", [0, 0.146, 0]);
  }

  place(THREE, g, new THREE.LatheGeometry(jarPts, 32), matGlass, null);

  // Cozy ribbon around jar neck
  place(THREE, g, new THREE.TorusGeometry(neckR + 0.002, 0.0032, 8, 28), matPri, "primary", [0, neckY, 0], [Math.PI * 0.5, 0, 0]);
  place(THREE, g, new THREE.TorusGeometry(0.008, 0.0024, 8, 16), matPri, "primary", [-0.007, neckY - 0.002, neckR + 0.006], [0.2, 0.3, 0.4]);
  place(THREE, g, new THREE.TorusGeometry(0.008, 0.0024, 8, 16), matPri, "primary", [0.007, neckY - 0.002, neckR + 0.006], [0.2, -0.3, -0.4]);

  return g;
}

// ---------------------------------------------------------------------------
// Recolor helper
// ---------------------------------------------------------------------------
export function recolor(group, palette) {
  if (!group || !palette) return group;
  group.traverse((obj) => {
    if (!obj.isMesh || !obj.userData || !obj.userData.slot) return;
    const col = palette[obj.userData.slot];
    if (col === undefined || col === null) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (let i = 0; i < mats.length; i++) {
      const m = mats[i];
      if (m && m.color) m.color.set(col);
      if (m && obj.userData.emissiveMatch && m.emissive) {
        m.emissive.set(col);
      }
    }
  });
  return group;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export const KEEPSAKES = {
  ticketStub,
  concertWristband,
  programBooklet,
  paperCrane,
  zine,
  pinBadge,
  enamelMug,
  toteOnHook,
  pottedSeedling,
  polaroid,
  medal,
  smallTrophy,
  chessPiece,
  paintPalette,
  circuitBoard,
  labFlask,
  microphone,
  filmClapper,
  danceShoes,
  basketball,
  soccerBall,
  runningBib,
  teaCup,
  snowGlobe,
  lantern,
  origamiStar,
  postcardStack,
  keyring,
  nameCardHolder,
  jarOfStars,
};

export const CATALOG = [
  { id: "ticketStub", name: "Ticket Stub", kind: "keepsake", footprint: [0.1, 0.05], placement: "surface", variants: 3, note: "Saved from a show, screening, or campus event." },
  { id: "concertWristband", name: "Concert Wristband", kind: "keepsake", footprint: [0.1, 0.09], placement: "surface", variants: 3, note: "Woven festival band kept long after the encore." },
  { id: "programBooklet", name: "Program Booklet", kind: "keepsake", footprint: [0.14, 0.18], placement: "surface", variants: 3, note: "Playbill from a recital, play, or lecture." },
  { id: "paperCrane", name: "Paper Crane", kind: "keepsake", footprint: [0.13, 0.12], placement: "surface", variants: 3, note: "Hand-folded origami crane gifted by a friend." },
  { id: "zine", name: "Indie Zine", kind: "keepsake", footprint: [0.14, 0.18], placement: "surface", variants: 3, note: "Stapled handmade booklet from a club fair." },
  { id: "pinBadge", name: "Enamel Pin Badge", kind: "keepsake", footprint: [0.08, 0.05], placement: "surface", variants: 3, note: "Collectible enamel pin propped on a mini stand." },
  { id: "enamelMug", name: "Enamel Mug", kind: "keepsake", footprint: [0.12, 0.09], placement: "surface", variants: 3, note: "Camp-style mug from a retreat or late-night study." },
  { id: "toteOnHook", name: "Canvas Tote on Hook", kind: "keepsake", footprint: [0.19, 0.07], placement: "wall", variants: 3, note: "Event tote bag hanging neatly on a wooden wall peg." },
  { id: "pottedSeedling", name: "Potted Seedling", kind: "keepsake", footprint: [0.1, 0.1], placement: "surface", variants: 3, note: "Tiny sprout grown from a gardening workshop." },
  { id: "polaroid", name: "Instant Polaroid", kind: "keepsake", footprint: [0.1, 0.05], placement: "surface", variants: 3, note: "Snapshot of a favourite afternoon on campus." },
  { id: "medal", name: "Award Medal", kind: "trophy", footprint: [0.09, 0.06], placement: "surface", variants: 3, note: "Ribboned medallion earned at a meet or contest." },
  { id: "smallTrophy", name: "Small Trophy", kind: "trophy", footprint: [0.09, 0.09], placement: "surface", variants: 3, note: "Miniature desk trophy celebrating a milestone." },
  { id: "chessPiece", name: "Keepsake Chess Piece", kind: "keepsake", footprint: [0.08, 0.08], placement: "surface", variants: 3, note: "Carved wooden piece from a memorable match." },
  { id: "paintPalette", name: "Paint Palette", kind: "keepsake", footprint: [0.16, 0.12], placement: "surface", variants: 3, note: "Well-loved wooden palette and studio brush." },
  { id: "circuitBoard", name: "Custom Circuit Board", kind: "keepsake", footprint: [0.12, 0.09], placement: "surface", variants: 3, note: "Hand-soldered maker board with a glowing LED." },
  { id: "labFlask", name: "Lab Flask", kind: "keepsake", footprint: [0.1, 0.1], placement: "surface", variants: 3, note: "Corked glass flask from a chemistry project." },
  { id: "microphone", name: "Desk Microphone", kind: "keepsake", footprint: [0.1, 0.1], placement: "surface", variants: 3, note: "Retro mic from a campus radio show or open mic." },
  { id: "filmClapper", name: "Mini Film Clapper", kind: "keepsake", footprint: [0.16, 0.05], placement: "surface", variants: 3, note: "Slate from a student short film shoot." },
  { id: "danceShoes", name: "Dance Shoes", kind: "keepsake", footprint: [0.15, 0.14], placement: "surface", variants: 3, note: "Pair of rehearsal shoes kept on the shelf." },
  { id: "basketball", name: "Mini Basketball", kind: "trophy", footprint: [0.14, 0.14], placement: "surface", variants: 3, note: "Display basketball from an intramural season." },
  { id: "soccerBall", name: "Mini Soccer Ball", kind: "trophy", footprint: [0.14, 0.14], placement: "surface", variants: 3, note: "Pentagon-panelled ball from a weekend tournament." },
  { id: "runningBib", name: "Running Bib", kind: "keepsake", footprint: [0.15, 0.05], placement: "surface", variants: 3, note: "Pinned race bib from a 5K or charity run." },
  { id: "teaCup", name: "Ceramic Tea Cup", kind: "keepsake", footprint: [0.12, 0.12], placement: "surface", variants: 3, note: "Delicate cup from a quiet tea-tasting afternoon." },
  { id: "snowGlobe", name: "Snow Globe", kind: "keepsake", footprint: [0.11, 0.11], placement: "surface", variants: 3, note: "Cozy glass souvenir globe from a winter trip." },
  { id: "lantern", name: "Table Lantern", kind: "keepsake", footprint: [0.11, 0.11], placement: "surface", variants: 3, note: "Warm glowing mini lantern from a night festival." },
  { id: "origamiStar", name: "Origami Lucky Star", kind: "keepsake", footprint: [0.1, 0.09], placement: "surface", variants: 3, note: "Puffy folded paper star wished upon during finals." },
  { id: "postcardStack", name: "Postcard Stack", kind: "keepsake", footprint: [0.15, 0.11], placement: "surface", variants: 3, note: "Ribbon-tied bundle of postcards from pen pals." },
  { id: "keyring", name: "Souvenir Keyring", kind: "keepsake", footprint: [0.11, 0.08], placement: "surface", variants: 3, note: "Metal ring with keys and a favourite enamel charm." },
  { id: "nameCardHolder", name: "Name Card Holder", kind: "keepsake", footprint: [0.11, 0.06], placement: "surface", variants: 3, note: "Desk caddy displaying up to 8 cards from people met." },
  { id: "jarOfStars", name: "Jar of Stars", kind: "keepsake", footprint: [0.11, 0.11], placement: "surface", variants: 3, note: "Glass jar holding up to 30 glowing saved stars." },
];
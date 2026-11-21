// Second set of cozy dorm room furniture and decor (Three.js r160 ES module)
// Pure ES module: no imports, no globals, no textures, no text/fonts.

const DEFAULTS = {
  primary: 0x5c7d8e,
  secondary: 0xebe0cf,
  accent: 0xd97a54,
  wood: 0xb68557,
  metal: 0x454a52,
  fabric: 0x7c907b,
  material: "wood",
  variant: 0,
};

function resolveOpts(opts) {
  const o = Object.assign({}, DEFAULTS, opts || {});
  const v = Number(o.variant);
  o.variant = v === 1 ? 1 : v === 2 ? 2 : 0;
  return o;
}

function slotProps(slot, matKind) {
  if (slot === "metal") return { roughness: 0.3, metalness: 0.78 };
  if (slot === "wood") return { roughness: 0.66, metalness: 0.04 };
  if (slot === "fabric") return { roughness: 0.92, metalness: 0.0 };
  if (matKind === "metal") return { roughness: 0.34, metalness: 0.72 };
  if (matKind === "wood") return { roughness: 0.65, metalness: 0.04 };
  if (matKind === "fabric") return { roughness: 0.9, metalness: 0.0 };
  return { roughness: 0.45, metalness: 0.06 };
}

function makeMat(THREE, opts, slot, extra) {
  const color = opts[slot] !== undefined ? opts[slot] : DEFAULTS[slot] || DEFAULTS.primary;
  const base = slotProps(slot, opts.material);
  return new THREE.MeshStandardMaterial(Object.assign({ color }, base, extra || {}));
}

function makeFixedMat(THREE, color, extra) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0.05 }, extra || {}));
}

function addMesh(THREE, parent, geo, mat, slot, pos, rot, scale) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = !mat.transparent;
  m.receiveShadow = true;
  if (slot) m.userData.slot = slot;
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  if (scale) m.scale.set(scale[0], scale[1], scale[2]);
  parent.add(m);
  return m;
}

function roundedRectShape(THREE, w, h, r) {
  const s = new THREE.Shape();
  const hw = w * 0.5;
  const hh = h * 0.5;
  const cr = Math.min(r, hw * 0.95, hh * 0.95);
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

function bevelBox(THREE, w, h, d, r = 0.02, bevel = 0.008, curveSegs = 5) {
  const b = Math.min(bevel, w * 0.22, h * 0.22, d * 0.22);
  const iw = Math.max(0.002, w - b * 2);
  const ih = Math.max(0.002, h - b * 2);
  const id = Math.max(0.002, d - b * 2);
  const cr = Math.min(r, iw * 0.45, ih * 0.45);
  const shape = roundedRectShape(THREE, iw, ih, cr);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: id,
    bevelEnabled: b > 0.0005,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
    curveSegments: curveSegs,
  });
  geo.center();
  return geo;
}

function latheFromPairs(THREE, pairs, segs = 24) {
  const pts = pairs.map((p) => new THREE.Vector2(Math.max(0.0005, p[0]), p[1]));
  return new THREE.LatheGeometry(pts, segs);
}

function addGlow(THREE, parent, color, intensity, distance, pos) {
  const light = new THREE.PointLight(color, intensity, distance, 2);
  light.name = "glow";
  light.position.set(pos[0], pos[1], pos[2]);
  parent.add(light);
  return light;
}

function addLeg(THREE, parent, mat, slot, x, z, h, rTop, rBot, splayX = 0, splayZ = 0) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, 10);
  const m = addMesh(THREE, parent, geo, mat, slot, [x, h * 0.5, z]);
  m.rotation.z = splayX;
  m.rotation.x = splayZ;
  return m;
}

function addPillow(THREE, parent, mat, slot, w, h, d, pos, rot) {
  const geo = bevelBox(THREE, w, h, d, Math.min(w, h) * 0.32, Math.min(w, h, d) * 0.24, 6);
  return addMesh(THREE, parent, geo, mat, slot, pos, rot);
}

function addMiniBook(THREE, parent, mat, slot, w, h, d, pos, rot) {
  const g = new THREE.Group();
  if (pos) g.position.set(pos[0], pos[1], pos[2]);
  if (rot) g.rotation.set(rot[0], rot[1], rot[2]);
  const cover = bevelBox(THREE, w, h, d, 0.005, 0.003, 3);
  addMesh(THREE, g, cover, mat, slot);
  const pageMat = makeFixedMat(THREE, 0xf2ead9, { roughness: 0.85 });
  const pages = new THREE.BoxGeometry(w * 0.9, h * 0.92, d * 0.92);
  addMesh(THREE, g, pages, pageMat, null, [0.003, 0, 0]);
  parent.add(g);
  return g;
}

function addLeafCluster(THREE, parent, pos, scale = 1, color = 0x4f7d4c, count = 7) {
  const mat = makeFixedMat(THREE, color, { roughness: 0.72 });
  const g = new THREE.Group();
  g.position.set(pos[0], pos[1], pos[2]);
  const leafGeo = new THREE.SphereGeometry(0.032 * scale, 8, 6);
  leafGeo.scale(0.6, 1.3, 0.25);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const tilt = 0.35 + (i % 3) * 0.28;
    const m = addMesh(THREE, g, leafGeo, mat, null, [
      Math.cos(a) * 0.025 * scale,
      0.02 * scale + (i % 2) * 0.015 * scale,
      Math.sin(a) * 0.025 * scale,
    ]);
    m.rotation.set(Math.sin(a) * tilt, a, -Math.cos(a) * tilt);
  }
  parent.add(g);
  return g;
}

// ---------------------------------------------------------------------------
// 1. SOFA
// ---------------------------------------------------------------------------
function sofa(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const fabPrimary = makeMat(THREE, o, "primary", { roughness: 0.9, metalness: 0.0 });
  const fabSecondary = makeMat(THREE, o, "secondary", { roughness: 0.9, metalness: 0.0 });
  const fabAccent = makeMat(THREE, o, "accent", { roughness: 0.88, metalness: 0.0 });
  const woodMat = makeMat(THREE, o, "wood");
  const metalMat = makeMat(THREE, o, "metal");

  if (o.variant === 0) {
    // Mid-century loveseat with splayed wood legs & throw pillows
    addMesh(THREE, g, bevelBox(THREE, 1.54, 0.14, 0.76, 0.04, 0.015), fabPrimary, "primary", [0, 0.24, 0]);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        addLeg(THREE, g, woodMat, "wood", sx * 0.66, sz * 0.29, 0.18, 0.022, 0.014, sx * 0.1, -sz * 0.08);
      }
      addMesh(THREE, g, bevelBox(THREE, 0.14, 0.36, 0.76, 0.05, 0.02), fabPrimary, "primary", [sx * 0.73, 0.44, 0]);
    }
    addMesh(THREE, g, bevelBox(THREE, 1.56, 0.44, 0.14, 0.05, 0.02), fabPrimary, "primary", [0, 0.56, -0.32]);
    for (const sx of [-0.34, 0.34]) {
      addMesh(THREE, g, bevelBox(THREE, 0.65, 0.15, 0.64, 0.05, 0.025), fabPrimary, "primary", [sx, 0.38, 0.04]);
      addMesh(THREE, g, bevelBox(THREE, 0.63, 0.34, 0.16, 0.06, 0.03), fabPrimary, "primary", [sx, 0.61, -0.19], [-0.14, 0, 0]);
    }
    addPillow(THREE, g, fabAccent, "accent", 0.3, 0.28, 0.11, [-0.52, 0.55, -0.04], [-0.15, 0.32, 0.08]);
    addPillow(THREE, g, fabSecondary, "secondary", 0.28, 0.26, 0.1, [0.52, 0.54, -0.02], [-0.12, -0.28, -0.06]);
  } else if (o.variant === 1) {
    // Plush low modern sofa with plinth base and draped throw blanket
    addMesh(THREE, g, bevelBox(THREE, 1.52, 0.08, 0.72, 0.03, 0.008), woodMat, "wood", [0, 0.04, 0]);
    addMesh(THREE, g, bevelBox(THREE, 1.62, 0.22, 0.8, 0.06, 0.03), fabPrimary, "primary", [0, 0.19, 0]);
    for (const sx of [-1, 1]) {
      addMesh(THREE, g, bevelBox(THREE, 0.22, 0.42, 0.8, 0.08, 0.035), fabPrimary, "primary", [sx * 0.72, 0.38, 0]);
    }
    addMesh(THREE, g, bevelBox(THREE, 1.6, 0.46, 0.2, 0.07, 0.035), fabPrimary, "primary", [0, 0.52, -0.3]);
    for (let i = -1; i <= 1; i++) {
      addMesh(THREE, g, bevelBox(THREE, 0.41, 0.14, 0.64, 0.05, 0.025), fabSecondary, "secondary", [i * 0.42, 0.36, 0.05]);
      addMesh(THREE, g, bevelBox(THREE, 0.4, 0.32, 0.16, 0.06, 0.03), fabSecondary, "secondary", [i * 0.42, 0.58, -0.17], [-0.16, 0, 0]);
    }
    // Draped throw blanket on right arm
    addMesh(THREE, g, bevelBox(THREE, 0.25, 0.06, 0.46, 0.025, 0.01), fabAccent, "accent", [0.72, 0.6, 0.06]);
    addMesh(THREE, g, bevelBox(THREE, 0.06, 0.36, 0.44, 0.02, 0.01), fabAccent, "accent", [0.84, 0.41, 0.06]);
  } else {
    // Slatted wooden futon sofa with bolster pillows
    for (const sx of [-0.74, 0.74]) {
      addMesh(THREE, g, bevelBox(THREE, 0.06, 0.52, 0.06, 0.015, 0.005), woodMat, "wood", [sx, 0.26, 0.32]);
      addMesh(THREE, g, bevelBox(THREE, 0.06, 0.56, 0.06, 0.015, 0.005), woodMat, "wood", [sx, 0.28, -0.32]);
      addMesh(THREE, g, bevelBox(THREE, 0.07, 0.05, 0.74, 0.02, 0.008), woodMat, "wood", [sx, 0.52, 0]);
      addMesh(THREE, g, bevelBox(THREE, 0.04, 0.05, 0.64, 0.01, 0.005), woodMat, "wood", [sx, 0.24, 0]);
      addMesh(THREE, g, new THREE.CylinderGeometry(0.018, 0.018, 0.07, 10), metalMat, "metal", [sx, 0.26, -0.22], [0, 0, Math.PI / 2]);
    }
    addMesh(THREE, g, bevelBox(THREE, 1.46, 0.06, 0.68, 0.02, 0.008), woodMat, "wood", [0, 0.24, 0]);
    // Thick tufted futon mattress (seat + angled back)
    addMesh(THREE, g, bevelBox(THREE, 1.4, 0.16, 0.62, 0.06, 0.03), fabPrimary, "primary", [0, 0.35, 0.04]);
    addMesh(THREE, g, bevelBox(THREE, 1.4, 0.42, 0.16, 0.06, 0.03), fabPrimary, "primary", [0, 0.58, -0.22], [-0.24, 0, 0]);
    // Bolster pillows
    const bolsterGeo = new THREE.CapsuleGeometry(0.09, 0.34, 8, 12);
    addMesh(THREE, g, bolsterGeo, fabAccent, "accent", [-0.58, 0.51, 0.02], [Math.PI / 2, 0, 0]);
    addMesh(THREE, g, bolsterGeo, fabAccent, "accent", [0.58, 0.51, 0.02], [Math.PI / 2, 0, 0]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 2. BEANBAG
// ---------------------------------------------------------------------------
function beanbag(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const mat1 = makeMat(THREE, o, "primary", { roughness: 0.92, metalness: 0.0 });
  const mat2 = makeMat(THREE, o, "secondary", { roughness: 0.9, metalness: 0.0 });
  const matAcc = makeMat(THREE, o, "accent", { roughness: 0.88, metalness: 0.0 });

  if (o.variant === 0) {
    // Classic pear/teardrop beanbag
    const body = latheFromPairs(THREE, [
      [0.01, 0.0], [0.34, 0.01], [0.43, 0.12], [0.42, 0.28], [0.32, 0.48],
      [0.2, 0.64], [0.09, 0.74], [0.01, 0.76],
    ], 24);
    const m = addMesh(THREE, g, body, mat1, "primary");
    m.scale.set(1.0, 1.0, 1.08);
    // Subtle front slouch dimple cushion
    addMesh(THREE, g, new THREE.SphereGeometry(0.28, 16, 12), mat1, "primary", [0, 0.21, 0.14], [0, 0, 0], [1.1, 0.65, 0.95]);
    // Handle loop at top
    addMesh(THREE, g, new THREE.TorusGeometry(0.038, 0.012, 8, 16, Math.PI), matAcc, "accent", [0, 0.75, -0.02], [0, Math.PI / 2, 0]);
  } else if (o.variant === 1) {
    // Wide low slouch pouf beanbag
    const body = latheFromPairs(THREE, [
      [0.01, 0.0], [0.38, 0.01], [0.46, 0.1], [0.45, 0.24], [0.36, 0.34],
      [0.2, 0.32], [0.01, 0.28],
    ], 26);
    addMesh(THREE, g, body, mat1, "primary");
    addMesh(THREE, g, new THREE.TorusGeometry(0.42, 0.016, 8, 28), matAcc, "accent", [0, 0.22, 0], [Math.PI / 2, 0, 0]);
  } else {
    // Armchair-style structured beanbag
    const base = latheFromPairs(THREE, [
      [0.01, 0.0], [0.38, 0.01], [0.44, 0.14], [0.41, 0.28], [0.24, 0.32], [0.01, 0.3],
    ], 22);
    addMesh(THREE, g, base, mat1, "primary");
    addMesh(THREE, g, new THREE.SphereGeometry(0.32, 18, 14), mat1, "primary", [0, 0.44, -0.18], [0, 0, 0], [1.15, 0.95, 0.75]);
    addMesh(THREE, g, new THREE.SphereGeometry(0.18, 14, 12), mat1, "primary", [-0.3, 0.3, 0.02], [0, 0, 0], [0.8, 0.85, 1.3]);
    addMesh(THREE, g, new THREE.SphereGeometry(0.18, 14, 12), mat1, "primary", [0.3, 0.3, 0.02], [0, 0, 0], [0.8, 0.85, 1.3]);
    addPillow(THREE, g, mat2, "secondary", 0.28, 0.24, 0.1, [0, 0.4, -0.02], [-0.25, 0, 0]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 3. ARMCHAIR
// ---------------------------------------------------------------------------
function armchair(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const fab1 = makeMat(THREE, o, "primary", { roughness: 0.9, metalness: 0.0 });
  const fabAcc = makeMat(THREE, o, "accent", { roughness: 0.88, metalness: 0.0 });
  const woodMat = makeMat(THREE, o, "wood");
  const metalMat = makeMat(THREE, o, "metal");

  if (o.variant === 0) {
    // Cozy reading armchair with splayed wooden legs
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        addLeg(THREE, g, woodMat, "wood", sx * 0.28, sz * 0.26, 0.2, 0.022, 0.014, sx * 0.1, -sz * 0.08);
      }
      addMesh(THREE, g, bevelBox(THREE, 0.13, 0.36, 0.68, 0.05, 0.02), fab1, "primary", [sx * 0.33, 0.44, 0]);
    }
    addMesh(THREE, g, bevelBox(THREE, 0.68, 0.14, 0.68, 0.05, 0.02), fab1, "primary", [0, 0.26, 0]);
    addMesh(THREE, g, bevelBox(THREE, 0.56, 0.15, 0.6, 0.05, 0.025), fab1, "primary", [0, 0.39, 0.04]);
    addMesh(THREE, g, bevelBox(THREE, 0.72, 0.54, 0.16, 0.07, 0.03), fab1, "primary", [0, 0.66, -0.27], [-0.12, 0, 0]);
    addPillow(THREE, g, fabAcc, "accent", 0.38, 0.22, 0.1, [0, 0.52, -0.12], [-0.15, 0, 0]);
  } else if (o.variant === 1) {
    // Exposed wood-frame mid-century lounge chair
    for (const sx of [-0.33, 0.33]) {
      addLeg(THREE, g, woodMat, "wood", sx, 0.26, 0.54, 0.022, 0.018, 0, 0.06);
      addLeg(THREE, g, woodMat, "wood", sx, -0.26, 0.5, 0.022, 0.018, 0, -0.14);
      addMesh(THREE, g, bevelBox(THREE, 0.055, 0.04, 0.62, 0.018, 0.008), woodMat, "wood", [sx, 0.54, -0.02], [0.05, 0, 0]);
      addMesh(THREE, g, bevelBox(THREE, 0.04, 0.045, 0.56, 0.012, 0.006), woodMat, "wood", [sx, 0.28, 0], [0.12, 0, 0]);
    }
    addMesh(THREE, g, bevelBox(THREE, 0.62, 0.14, 0.56, 0.05, 0.025), fab1, "primary", [0, 0.34, 0.03], [-0.1, 0, 0]);
    addMesh(THREE, g, bevelBox(THREE, 0.6, 0.44, 0.14, 0.05, 0.025), fab1, "primary", [0, 0.6, -0.22], [-0.24, 0, 0]);
  } else {
    // Swivel barrel/tub chair on metal pedestal
    addMesh(THREE, g, new THREE.CylinderGeometry(0.24, 0.26, 0.03, 24), metalMat, "metal", [0, 0.015, 0]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.035, 0.04, 0.22, 14), metalMat, "metal", [0, 0.13, 0]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.35, 0.32, 0.16, 24), fab1, "primary", [0, 0.3, 0]);
    // Curved wrap-around backrest using Lathe/Cylinder arc
    const backGeo = new THREE.CylinderGeometry(0.36, 0.34, 0.44, 24, 1, true, Math.PI * 0.28, Math.PI * 1.44);
    const backShell = new THREE.Mesh(backGeo, makeMat(THREE, o, "primary", { roughness: 0.9, side: THREE.DoubleSide }));
    backShell.position.set(0, 0.54, 0);
    backShell.castShadow = true;
    backShell.receiveShadow = true;
    backShell.userData.slot = "primary";
    g.add(backShell);
    // Rounded rim along top of barrel back
    addMesh(THREE, g, new THREE.TorusGeometry(0.35, 0.045, 10, 24, Math.PI * 1.44), fab1, "primary", [0, 0.74, 0], [Math.PI / 2, 0, -Math.PI * 0.22]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.3, 0.3, 0.12, 22), fabAcc, "accent", [0, 0.42, 0.03]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 4. COFFEE TABLE
// ---------------------------------------------------------------------------
function coffeeTable(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const woodMat = makeMat(THREE, o, "wood");
  const primMat = makeMat(THREE, o, "primary");
  const secMat = makeMat(THREE, o, "secondary");
  const accMat = makeMat(THREE, o, "accent");
  const metalMat = makeMat(THREE, o, "metal");

  if (o.variant === 0) {
    // Scandi rounded-rectangle table with lower shelf
    addMesh(THREE, g, bevelBox(THREE, 0.98, 0.04, 0.54, 0.08, 0.01), woodMat, "wood", [0, 0.4, 0]);
    addMesh(THREE, g, bevelBox(THREE, 0.78, 0.025, 0.38, 0.04, 0.006), woodMat, "wood", [0, 0.16, 0]);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        addLeg(THREE, g, woodMat, "wood", sx * 0.38, sz * 0.19, 0.39, 0.02, 0.013, sx * 0.08, -sz * 0.06);
      }
    }
  } else if (o.variant === 1) {
    // Organic oval top with hairpin metal legs & tray
    const top = new THREE.CylinderGeometry(0.48, 0.47, 0.035, 28);
    top.scale(1.05, 1, 0.58);
    addMesh(THREE, g, top, woodMat, "wood", [0, 0.38, 0]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
      const lx = Math.cos(a) * 0.34;
      const lz = Math.sin(a) * 0.18;
      addLeg(THREE, g, metalMat, "metal", lx, lz, 0.37, 0.007, 0.007, Math.cos(a) * 0.08, Math.sin(a) * 0.08);
      addLeg(THREE, g, metalMat, "metal", lx * 0.92, lz * 0.92, 0.37, 0.007, 0.007, Math.cos(a) * 0.14, Math.sin(a) * 0.14);
    }
    addMesh(THREE, g, new THREE.CylinderGeometry(0.14, 0.13, 0.022, 20), accMat, "accent", [0.16, 0.41, 0.02]);
  } else {
    // Nesting dual round tables
    addMesh(THREE, g, new THREE.CylinderGeometry(0.32, 0.32, 0.032, 26), woodMat, "wood", [-0.14, 0.42, -0.02]);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      addLeg(THREE, g, metalMat, "metal", -0.14 + Math.cos(a) * 0.23, -0.02 + Math.sin(a) * 0.23, 0.41, 0.01, 0.01);
    }
    addMesh(THREE, g, new THREE.CylinderGeometry(0.24, 0.24, 0.03, 24), secMat, "secondary", [0.22, 0.33, 0.08]);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      addLeg(THREE, g, primMat, "primary", 0.22 + Math.cos(a) * 0.17, 0.08 + Math.sin(a) * 0.17, 0.32, 0.01, 0.01);
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// 5. SIDE TABLE
// ---------------------------------------------------------------------------
function sideTable(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const woodMat = makeMat(THREE, o, "wood");
  const primMat = makeMat(THREE, o, "primary");
  const metalMat = makeMat(THREE, o, "metal");
  const accMat = makeMat(THREE, o, "accent");

  if (o.variant === 0) {
    // Round tray-top tripod table
    addMesh(THREE, g, new THREE.CylinderGeometry(0.22, 0.22, 0.022, 24), woodMat, "wood", [0, 0.51, 0]);
    addMesh(THREE, g, new THREE.TorusGeometry(0.215, 0.012, 8, 28), woodMat, "wood", [0, 0.53, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      addLeg(THREE, g, woodMat, "wood", Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0.51, 0.017, 0.011, Math.cos(a) * 0.14, Math.sin(a) * 0.14);
    }
  } else if (o.variant === 1) {
    // Square nightstand with drawer & open cubby
    for (const sx of [-0.18, 0.18]) {
      for (const sz of [-0.18, 0.18]) {
        addLeg(THREE, g, woodMat, "wood", sx, sz, 0.16, 0.018, 0.013);
      }
    }
    addMesh(THREE, g, bevelBox(THREE, 0.44, 0.36, 0.42, 0.025, 0.008), primMat, "primary", [0, 0.34, 0]);
    addMesh(THREE, g, bevelBox(THREE, 0.38, 0.14, 0.03, 0.015, 0.005), woodMat, "wood", [0, 0.42, 0.21]);
    addMesh(THREE, g, new THREE.SphereGeometry(0.016, 10, 10), accMat, "accent", [0, 0.42, 0.235]);
    addMesh(THREE, g, bevelBox(THREE, 0.36, 0.13, 0.36, 0.01, 0.004), makeFixedMat(THREE, 0x2c2a28, { roughness: 0.8 }), null, [0, 0.25, 0.04]);
  } else {
    // C-shaped sofa side table
    addMesh(THREE, g, bevelBox(THREE, 0.42, 0.032, 0.3, 0.03, 0.008), woodMat, "wood", [0, 0.56, 0]);
    for (const sx of [-0.17, 0.17]) {
      addMesh(THREE, g, new THREE.CylinderGeometry(0.011, 0.011, 0.55, 10), metalMat, "metal", [sx, 0.28, -0.12]);
      addMesh(THREE, g, new THREE.CylinderGeometry(0.011, 0.011, 0.28, 10), metalMat, "metal", [sx, 0.015, 0.01], [Math.PI / 2, 0, 0]);
    }
    addMesh(THREE, g, new THREE.CylinderGeometry(0.011, 0.011, 0.34, 10), metalMat, "metal", [0, 0.015, -0.12], [0, 0, Math.PI / 2]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 6. FLOOR LAMP (with "glow" PointLight)
// ---------------------------------------------------------------------------
function floorLamp(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const woodMat = makeMat(THREE, o, "wood");
  const metalMat = makeMat(THREE, o, "metal");
  const primMat = makeMat(THREE, o, "primary");
  const shadeMat = makeMat(THREE, o, "secondary", {
    roughness: 0.85,
    emissive: new THREE.Color(0xffd7a0),
    emissiveIntensity: 0.38,
  });
  const bulbMat = makeFixedMat(THREE, 0xfff4d6, { emissive: 0xffd58a, emissiveIntensity: 1.4, roughness: 0.2 });

  if (o.variant === 0) {
    // Wooden tripod floor lamp with drum shade
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      addLeg(THREE, g, woodMat, "wood", Math.cos(a) * 0.13, Math.sin(a) * 0.13, 1.32, 0.014, 0.012, -Math.cos(a) * 0.12, -Math.sin(a) * 0.12);
    }
    addMesh(THREE, g, new THREE.CylinderGeometry(0.04, 0.04, 0.06, 14), metalMat, "metal", [0, 1.3, 0]);
    const shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.21, 0.26, 24, 1, true),
      makeMat(THREE, o, "secondary", { roughness: 0.85, side: THREE.DoubleSide, emissive: new THREE.Color(0xffd296), emissiveIntensity: 0.35 })
    );
    shade.position.set(0, 1.46, 0);
    shade.castShadow = true;
    shade.userData.slot = "secondary";
    g.add(shade);
    addMesh(THREE, g, new THREE.SphereGeometry(0.04, 12, 12), bulbMat, null, [0, 1.44, 0]);
    addGlow(THREE, g, 0xffd296, 0.75, 3.2, [0, 1.44, 0]);
  } else if (o.variant === 1) {
    // Arched mid-century metal floor lamp
    addMesh(THREE, g, new THREE.CylinderGeometry(0.15, 0.16, 0.04, 22), metalMat, "metal", [0, 0.02, -0.1]);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.04, -0.1),
      new THREE.Vector3(0, 1.15, -0.12),
      new THREE.Vector3(0, 1.62, 0.02),
      new THREE.Vector3(0, 1.56, 0.24),
    ]);
    addMesh(THREE, g, new THREE.TubeGeometry(curve, 24, 0.012, 10, false), metalMat, "metal");
    const dome = new THREE.SphereGeometry(0.13, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
    addMesh(THREE, g, dome, primMat, "primary", [0, 1.44, 0.24]);
    addMesh(THREE, g, new THREE.SphereGeometry(0.045, 12, 12), bulbMat, null, [0, 1.42, 0.24]);
    addGlow(THREE, g, 0xffd89c, 0.75, 3.2, [0, 1.38, 0.24]);
  } else {
    // Modern 3-globe tree floor lamp
    addMesh(THREE, g, new THREE.CylinderGeometry(0.14, 0.15, 0.03, 20), metalMat, "metal", [0, 0.015, 0]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.013, 0.015, 1.54, 12), metalMat, "metal", [0, 0.78, 0]);
    const orbs = [
      [0.11, 1.24, 0.04],
      [-0.11, 1.4, -0.02],
      [0.04, 1.56, 0.08],
    ];
    for (const p of orbs) {
      addMesh(THREE, g, new THREE.CylinderGeometry(0.007, 0.007, Math.hypot(p[0], p[2]), 8), metalMat, "metal", [p[0] * 0.5, p[1], p[2] * 0.5], [0, -Math.atan2(p[2], p[0]), Math.PI / 2]);
      addMesh(THREE, g, new THREE.SphereGeometry(0.082, 16, 14), shadeMat, "secondary", p);
    }
    addGlow(THREE, g, 0xffdca8, 0.7, 3.2, [0, 1.42, 0.04]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 7. STRING LIGHTS (wall, with "glow" PointLight)
// ---------------------------------------------------------------------------
function stringLights(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const wireMat = makeMat(THREE, o, "metal", { roughness: 0.7 });
  const bulbMat = makeFixedMat(THREE, 0xfff2cc, { emissive: 0xffcc70, emissiveIntensity: 1.5, roughness: 0.25 });
  const accBulbMat = makeMat(THREE, o, "accent", { emissive: new THREE.Color(o.accent), emissiveIntensity: 0.9, roughness: 0.25 });

  function addSwag(x0, y0, x1, y1, sag, bulbs, useAccent) {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * sag;
      const z = 0.02 + Math.sin(t * Math.PI) * 0.025;
      pts.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    addMesh(THREE, g, new THREE.TubeGeometry(curve, 20, 0.004, 6, false), wireMat, "metal");
    const bulbGeo = new THREE.SphereGeometry(0.022, 10, 10);
    for (let i = 1; i <= bulbs; i++) {
      const p = curve.getPoint(i / (bulbs + 1));
      const m = addMesh(THREE, g, bulbGeo, useAccent && i % 2 === 0 ? accBulbMat : bulbMat, useAccent && i % 2 === 0 ? "accent" : null, [p.x, p.y - 0.022, p.z]);
      if (useAccent && i % 2 === 0) m.userData.emissiveMatch = true;
    }
  }

  if (o.variant === 0) {
    addSwag(-0.85, 0.14, 0.85, 0.14, 0.24, 9, false);
  } else if (o.variant === 1) {
    addSwag(-0.88, 0.16, 0.04, 0.12, 0.2, 6, true);
    addSwag(-0.04, 0.12, 0.88, 0.16, 0.22, 6, true);
  } else {
    // Curtain-style icicle fairy lights
    const topPts = [new THREE.Vector3(-0.8, 0.28, 0.02), new THREE.Vector3(0.8, 0.28, 0.02)];
    addMesh(THREE, g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(topPts), 8, 0.004, 6, false), wireMat, "metal");
    const drops = [0.42, 0.56, 0.48, 0.58, 0.44];
    const beadGeo = new THREE.SphereGeometry(0.015, 8, 8);
    for (let i = 0; i < drops.length; i++) {
      const x = -0.64 + i * 0.32;
      const len = drops[i];
      addMesh(THREE, g, new THREE.CylinderGeometry(0.0025, 0.0025, len, 6), wireMat, "metal", [x, 0.28 - len * 0.5, 0.022]);
      for (let j = 1; j <= 4; j++) {
        addMesh(THREE, g, beadGeo, bulbMat, null, [x, 0.28 - (len * j) / 4, 0.026]);
      }
    }
  }
  addGlow(THREE, g, 0xffd28a, 0.55, 2.6, [0, 0.0, 0.18]);
  return g;
}

// ---------------------------------------------------------------------------
// 8. MINI FRIDGE
// ---------------------------------------------------------------------------
function miniFridge(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const primMat = makeMat(THREE, o, "primary", { roughness: 0.28, metalness: 0.18 });
  const secMat = makeMat(THREE, o, "secondary", { roughness: 0.35, metalness: 0.12 });
  const metalMat = makeMat(THREE, o, "metal", { roughness: 0.22, metalness: 0.85 });
  const footMat = makeFixedMat(THREE, 0x262626, { roughness: 0.8 });

  for (const sx of [-0.2, 0.2]) {
    for (const sz of [-0.2, 0.2]) {
      addMesh(THREE, g, new THREE.CylinderGeometry(0.02, 0.02, 0.03, 10), footMat, null, [sx, 0.015, sz]);
    }
  }

  if (o.variant === 0) {
    // Retro rounded mini fridge
    addMesh(THREE, g, bevelBox(THREE, 0.5, 0.78, 0.48, 0.06, 0.025), primMat, "primary", [0, 0.42, -0.02]);
    addMesh(THREE, g, bevelBox(THREE, 0.48, 0.74, 0.06, 0.055, 0.02), primMat, "primary", [0, 0.42, 0.23]);
    addMesh(THREE, g, new THREE.CapsuleGeometry(0.014, 0.18, 6, 10), metalMat, "metal", [-0.18, 0.56, 0.275]);
    addMesh(THREE, g, bevelBox(THREE, 0.14, 0.025, 0.012, 0.008, 0.003), metalMat, "metal", [0, 0.68, 0.265]);
  } else if (o.variant === 1) {
    // Modern two-door dorm mini fridge
    addMesh(THREE, g, bevelBox(THREE, 0.5, 0.84, 0.5, 0.025, 0.01), primMat, "primary", [0, 0.45, -0.01]);
    addMesh(THREE, g, bevelBox(THREE, 0.49, 0.24, 0.04, 0.018, 0.008), secMat, "secondary", [0, 0.74, 0.25]);
    addMesh(THREE, g, bevelBox(THREE, 0.49, 0.54, 0.04, 0.018, 0.008), secMat, "secondary", [0, 0.32, 0.25]);
    addMesh(THREE, g, bevelBox(THREE, 0.16, 0.018, 0.02, 0.006, 0.003), metalMat, "metal", [-0.14, 0.65, 0.275]);
    addMesh(THREE, g, bevelBox(THREE, 0.16, 0.018, 0.02, 0.006, 0.003), metalMat, "metal", [-0.14, 0.54, 0.275]);
  } else {
    // Glass-door beverage cooler with cans inside
    addMesh(THREE, g, bevelBox(THREE, 0.48, 0.72, 0.46, 0.03, 0.012), metalMat, "metal", [0, 0.39, -0.02]);
    // Interior cavity
    addMesh(THREE, g, new THREE.BoxGeometry(0.4, 0.62, 0.34), makeFixedMat(THREE, 0xdce4ea, { roughness: 0.5 }), null, [0, 0.39, 0.04]);
    // Shelves + drink cans
    const canGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.1, 10);
    const accMat = makeMat(THREE, o, "accent", { roughness: 0.3, metalness: 0.35 });
    for (const sy of [0.24, 0.48]) {
      addMesh(THREE, g, new THREE.BoxGeometry(0.39, 0.012, 0.3), metalMat, "metal", [0, sy, 0.04]);
      for (let i = -1; i <= 1; i++) {
        addMesh(THREE, g, canGeo, i === 0 ? accMat : primMat, i === 0 ? "accent" : "primary", [i * 0.1, sy + 0.056, 0.06]);
      }
    }
    // Glass front door
    const glass = makeFixedMat(THREE, 0xbfe2f2, { transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.1 });
    addMesh(THREE, g, new THREE.BoxGeometry(0.41, 0.63, 0.018), glass, null, [0, 0.39, 0.22]);
    addMesh(THREE, g, new THREE.CapsuleGeometry(0.01, 0.2, 6, 8), metalMat, "metal", [-0.21, 0.42, 0.245]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 9. MICROWAVE CART
// ---------------------------------------------------------------------------
function microwaveCart(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const woodMat = makeMat(THREE, o, "wood");
  const metalMat = makeMat(THREE, o, "metal");
  const primMat = makeMat(THREE, o, "primary", { roughness: 0.35 });
  const secMat = makeMat(THREE, o, "secondary", { roughness: 0.4 });
  const accMat = makeMat(THREE, o, "accent", { roughness: 0.35 });
  const darkGlass = makeFixedMat(THREE, 0x1e2228, { roughness: 0.15, metalness: 0.3 });

  function addMicrowave(y, bodyMat, bodySlot, retro) {
    addMesh(THREE, g, bevelBox(THREE, 0.46, 0.26, 0.32, retro ? 0.04 : 0.015, 0.008), bodyMat, bodySlot, [0, y + 0.13, 0]);
    addMesh(THREE, g, bevelBox(THREE, 0.28, 0.18, 0.015, 0.012, 0.003), darkGlass, null, [-0.06, y + 0.13, 0.16]);
    addMesh(THREE, g, new THREE.CapsuleGeometry(0.008, 0.12, 4, 8), metalMat, "metal", [0.1, y + 0.13, 0.175]);
    if (retro) {
      addMesh(THREE, g, new THREE.CylinderGeometry(0.02, 0.02, 0.02, 12), metalMat, "metal", [0.17, y + 0.17, 0.165], [Math.PI / 2, 0, 0]);
      addMesh(THREE, g, new THREE.CylinderGeometry(0.02, 0.02, 0.02, 12), metalMat, "metal", [0.17, y + 0.1, 0.165], [Math.PI / 2, 0, 0]);
    } else {
      addMesh(THREE, g, new THREE.BoxGeometry(0.075, 0.16, 0.008), makeFixedMat(THREE, 0x2f343c), null, [0.17, y + 0.13, 0.162]);
    }
  }

  // 4 caster wheels
  const wheelMat = makeFixedMat(THREE, 0x222222, { roughness: 0.7 });
  for (const sx of [-0.26, 0.26]) {
    for (const sz of [-0.16, 0.16]) {
      addMesh(THREE, g, new THREE.CylinderGeometry(0.026, 0.026, 0.018, 12), wheelMat, null, [sx, 0.026, sz], [0, 0, Math.PI / 2]);
    }
  }

  if (o.variant === 0) {
    // 2-tier wooden rolling cart
    for (const sx of [-0.27, 0.27]) {
      for (const sz of [-0.17, 0.17]) {
        addMesh(THREE, g, new THREE.CylinderGeometry(0.016, 0.016, 0.74, 10), woodMat, "wood", [sx, 0.42, sz]);
      }
    }
    for (const sy of [0.14, 0.46, 0.78]) {
      addMesh(THREE, g, bevelBox(THREE, 0.62, 0.03, 0.42, 0.02, 0.006), woodMat, "wood", [0, sy, 0]);
    }
    addMicrowave(0.795, secMat, "secondary", false);
    // Mug on middle shelf
    addMesh(THREE, g, new THREE.CylinderGeometry(0.04, 0.036, 0.09, 14), accMat, "accent", [-0.14, 0.52, 0.04]);
  } else if (o.variant === 1) {
    // Metal industrial frame + retro accent microwave + basket
    for (const sx of [-0.28, 0.28]) {
      for (const sz of [-0.17, 0.17]) {
        addMesh(THREE, g, new THREE.CylinderGeometry(0.012, 0.012, 0.74, 10), metalMat, "metal", [sx, 0.42, sz]);
      }
    }
    for (const sy of [0.14, 0.46, 0.78]) {
      addMesh(THREE, g, bevelBox(THREE, 0.6, 0.026, 0.4, 0.018, 0.006), woodMat, "wood", [0, sy, 0]);
    }
    addMicrowave(0.793, accMat, "accent", true);
    addMesh(THREE, g, bevelBox(THREE, 0.34, 0.18, 0.3, 0.03, 0.01), primMat, "primary", [0, 0.25, 0]);
  } else {
    // Enclosed cabinet cart with side towel bar
    addMesh(THREE, g, bevelBox(THREE, 0.6, 0.7, 0.4, 0.02, 0.008), secMat, "secondary", [0, 0.42, 0]);
    addMesh(THREE, g, bevelBox(THREE, 0.64, 0.032, 0.44, 0.022, 0.006), woodMat, "wood", [0, 0.785, 0]);
    for (const sx of [-0.14, 0.14]) {
      addMesh(THREE, g, bevelBox(THREE, 0.26, 0.56, 0.02, 0.012, 0.004), primMat, "primary", [sx, 0.42, 0.205]);
      addMesh(THREE, g, new THREE.SphereGeometry(0.014, 8, 8), metalMat, "metal", [sx * 0.25, 0.48, 0.225]);
    }
    addMesh(THREE, g, new THREE.CylinderGeometry(0.009, 0.009, 0.3, 8), metalMat, "metal", [0.34, 0.66, 0], [Math.PI / 2, 0, 0]);
    addMicrowave(0.8, metalMat, "metal", false);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 10. BOOK STACK (surface)
// ---------------------------------------------------------------------------
function bookStack(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const m1 = makeMat(THREE, o, "primary", { roughness: 0.72 });
  const m2 = makeMat(THREE, o, "secondary", { roughness: 0.75 });
  const m3 = makeMat(THREE, o, "accent", { roughness: 0.7 });
  const metalMat = makeMat(THREE, o, "metal");

  if (o.variant === 0) {
    // 4 stacked books with subtle yaw offsets
    const specs = [
      [0.23, 0.036, 0.16, m1, "primary", 0.04],
      [0.21, 0.032, 0.15, m2, "secondary", -0.1],
      [0.2, 0.034, 0.145, m3, "accent", 0.08],
      [0.18, 0.028, 0.135, m1, "primary", -0.05],
    ];
    let y = 0;
    for (const [w, h, d, mat, slot, ry] of specs) {
      addMiniBook(THREE, g, mat, slot, w, h, d, [0, y + h * 0.5, 0], [0, ry, 0]);
      y += h;
    }
  } else if (o.variant === 1) {
    // 5 stacked books + small ceramic orb on top
    const mats = [[m2, "secondary"], [m1, "primary"], [m3, "accent"], [m2, "secondary"], [m1, "primary"]];
    let y = 0;
    for (let i = 0; i < 5; i++) {
      const h = 0.03;
      addMiniBook(THREE, g, mats[i][0], mats[i][1], 0.22 - i * 0.008, h, 0.155 - i * 0.005, [0, y + h * 0.5, 0], [0, (i % 2 ? 1 : -1) * 0.07, 0]);
      y += h;
    }
    addMesh(THREE, g, new THREE.SphereGeometry(0.035, 14, 12), m3, "accent", [0.02, y + 0.033, 0]);
  } else {
    // Upright books with metal bookend + leaning books
    addMesh(THREE, g, bevelBox(THREE, 0.012, 0.14, 0.12, 0.004, 0.002), metalMat, "metal", [-0.1, 0.07, 0]);
    addMesh(THREE, g, bevelBox(THREE, 0.08, 0.01, 0.12, 0.004, 0.002), metalMat, "metal", [-0.065, 0.005, 0]);
    addMiniBook(THREE, g, m1, "primary", 0.034, 0.21, 0.15, [-0.075, 0.105, 0]);
    addMiniBook(THREE, g, m2, "secondary", 0.03, 0.19, 0.14, [-0.042, 0.095, 0]);
    addMiniBook(THREE, g, m3, "accent", 0.032, 0.2, 0.145, [-0.01, 0.1, 0]);
    addMiniBook(THREE, g, m1, "primary", 0.03, 0.185, 0.14, [0.045, 0.09, 0], [0, 0, -0.32]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 11. LOW BOOKCASE
// ---------------------------------------------------------------------------
function lowBookcase(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const woodMat = makeMat(THREE, o, "wood");
  const primMat = makeMat(THREE, o, "primary");
  const secMat = makeMat(THREE, o, "secondary");
  const accMat = makeMat(THREE, o, "accent");

  if (o.variant === 0) {
    // Mid-century 2-tier open bookcase on tapered legs
    for (const sx of [-0.46, 0.46]) {
      for (const sz of [-0.12, 0.12]) {
        addLeg(THREE, g, woodMat, "wood", sx, sz, 0.14, 0.018, 0.012, sx * 0.12, 0);
      }
    }
    addMesh(THREE, g, bevelBox(THREE, 1.08, 0.032, 0.32, 0.015, 0.005), woodMat, "wood", [0, 0.15, 0]);
    addMesh(THREE, g, bevelBox(THREE, 1.08, 0.028, 0.32, 0.015, 0.005), woodMat, "wood", [0, 0.47, 0]);
    addMesh(THREE, g, bevelBox(THREE, 1.08, 0.032, 0.32, 0.015, 0.005), woodMat, "wood", [0, 0.8, 0]);
    for (const sx of [-0.52, 0.52]) {
      addMesh(THREE, g, bevelBox(THREE, 0.032, 0.66, 0.32, 0.015, 0.005), woodMat, "wood", [sx, 0.475, 0]);
    }
    addMesh(THREE, g, new THREE.BoxGeometry(1.04, 0.64, 0.016), secMat, "secondary", [0, 0.475, -0.15]);
    // Books & ceramic vase
    for (let i = 0; i < 5; i++) {
      addMiniBook(THREE, g, i % 2 ? primMat : accMat, i % 2 ? "primary" : "accent", 0.032, 0.2 + (i % 3) * 0.02, 0.16, [-0.42 + i * 0.036, 0.59, 0]);
    }
    addMesh(THREE, g, latheFromPairs(THREE, [[0.01, 0], [0.045, 0.02], [0.06, 0.09], [0.03, 0.16], [0.04, 0.19]], 14), accMat, "accent", [0.34, 0.485, 0]);
  } else if (o.variant === 1) {
    // 3x2 cube organizer with 2 fabric storage bins
    addMesh(THREE, g, bevelBox(THREE, 1.08, 0.03, 0.34, 0.012, 0.005), woodMat, "wood", [0, 0.015, 0]);
    addMesh(THREE, g, bevelBox(THREE, 1.08, 0.026, 0.34, 0.012, 0.005), woodMat, "wood", [0, 0.37, 0]);
    addMesh(THREE, g, bevelBox(THREE, 1.08, 0.03, 0.34, 0.012, 0.005), woodMat, "wood", [0, 0.72, 0]);
    for (const sx of [-0.52, -0.175, 0.175, 0.52]) {
      addMesh(THREE, g, bevelBox(THREE, 0.03, 0.72, 0.34, 0.012, 0.005), woodMat, "wood", [sx, 0.37, 0]);
    }
    // 2 fabric cube bins
    for (const bx of [-0.35, 0.35]) {
      addMesh(THREE, g, bevelBox(THREE, 0.29, 0.28, 0.29, 0.02, 0.008), accMat, "accent", [bx, 0.175, 0.01]);
      addMesh(THREE, g, new THREE.CylinderGeometry(0.014, 0.014, 0.015, 10), secMat, "secondary", [bx, 0.21, 0.155], [Math.PI / 2, 0, 0]);
    }
    for (let i = 0; i < 4; i++) {
      addMiniBook(THREE, g, i % 2 ? primMat : secMat, i % 2 ? "primary" : "secondary", 0.034, 0.22, 0.18, [-0.08 + i * 0.04, 0.5, 0]);
    }
  } else {
    // Leaning 3-tier ladder shelf
    for (const sx of [-0.46, 0.46]) {
      addMesh(THREE, g, bevelBox(THREE, 0.034, 0.96, 0.04, 0.01, 0.004), woodMat, "wood", [sx, 0.47, -0.02], [-0.14, 0, 0]);
      addMesh(THREE, g, bevelBox(THREE, 0.034, 0.92, 0.035, 0.01, 0.004), woodMat, "wood", [sx, 0.45, -0.14]);
    }
    const tiers = [[0.18, 0.32], [0.5, 0.26], [0.8, 0.2]];
    for (const [ty, td] of tiers) {
      addMesh(THREE, g, bevelBox(THREE, 0.96, 0.028, td, 0.012, 0.005), primMat, "primary", [0, ty, -0.14 + td * 0.5]);
    }
    for (let i = 0; i < 5; i++) {
      addMiniBook(THREE, g, i % 2 ? accMat : secMat, i % 2 ? "accent" : "secondary", 0.032, 0.19, 0.14, [-0.28 + i * 0.038, 0.61, -0.02]);
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// 12. TV (surface, with "glow" PointLight)
// ---------------------------------------------------------------------------
function tv(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const metalMat = makeMat(THREE, o, "metal", { roughness: 0.3 });
  const primMat = makeMat(THREE, o, "primary", { roughness: 0.38 });
  const accMat = makeMat(THREE, o, "accent");
  const screenMat = makeFixedMat(THREE, 0x2a4a66, {
    emissive: 0x4f84b0,
    emissiveIntensity: 0.72,
    roughness: 0.18,
  });

  if (o.variant === 0) {
    // Slim modern flatscreen on V-feet
    addMesh(THREE, g, bevelBox(THREE, 0.86, 0.5, 0.036, 0.016, 0.006), metalMat, "metal", [0, 0.31, 0]);
    addMesh(THREE, g, new THREE.BoxGeometry(0.81, 0.45, 0.008), screenMat, null, [0, 0.31, 0.018]);
    for (const sx of [-0.28, 0.28]) {
      addMesh(THREE, g, bevelBox(THREE, 0.024, 0.08, 0.024, 0.006, 0.002), metalMat, "metal", [sx, 0.04, 0]);
      addMesh(THREE, g, bevelBox(THREE, 0.024, 0.016, 0.2, 0.006, 0.002), metalMat, "metal", [sx, 0.008, 0.01]);
    }
    addGlow(THREE, g, 0x7cb8e8, 0.55, 2.6, [0, 0.31, 0.22]);
  } else if (o.variant === 1) {
    // Pedestal flatscreen + soundbar
    addMesh(THREE, g, bevelBox(THREE, 0.34, 0.02, 0.2, 0.015, 0.004), metalMat, "metal", [0, 0.01, 0]);
    addMesh(THREE, g, bevelBox(THREE, 0.09, 0.1, 0.04, 0.01, 0.004), metalMat, "metal", [0, 0.06, -0.02]);
    addMesh(THREE, g, bevelBox(THREE, 0.88, 0.51, 0.036, 0.014, 0.005), metalMat, "metal", [0, 0.35, -0.02]);
    addMesh(THREE, g, new THREE.BoxGeometry(0.83, 0.46, 0.008), screenMat, null, [0, 0.35, 0]);
    addMesh(THREE, g, bevelBox(THREE, 0.58, 0.055, 0.07, 0.018, 0.006), primMat, "primary", [0, 0.03, 0.1]);
    addGlow(THREE, g, 0x7cb8e8, 0.55, 2.6, [0, 0.35, 0.22]);
  } else {
    // Retro chunky CRT TV with rabbit-ear antennas
    addMesh(THREE, g, bevelBox(THREE, 0.52, 0.44, 0.36, 0.05, 0.02), primMat, "primary", [0, 0.24, -0.02]);
    addMesh(THREE, g, bevelBox(THREE, 0.34, 0.28, 0.03, 0.04, 0.01), screenMat, null, [-0.04, 0.25, 0.16]);
    for (const dy of [0.32, 0.22]) {
      addMesh(THREE, g, new THREE.CylinderGeometry(0.026, 0.026, 0.025, 14), accMat, "accent", [0.18, dy, 0.165], [Math.PI / 2, 0, 0]);
    }
    for (const sx of [-0.18, 0.18]) {
      addMesh(THREE, g, new THREE.CylinderGeometry(0.02, 0.016, 0.04, 10), metalMat, "metal", [sx, 0.02, 0.06]);
      addMesh(THREE, g, new THREE.CylinderGeometry(0.02, 0.016, 0.04, 10), metalMat, "metal", [sx, 0.02, -0.1]);
    }
    // Rabbit ears
    addMesh(THREE, g, new THREE.CylinderGeometry(0.005, 0.005, 0.28, 6), metalMat, "metal", [-0.07, 0.57, -0.04], [0, 0, 0.42]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.005, 0.005, 0.28, 6), metalMat, "metal", [0.07, 0.57, -0.04], [0, 0, -0.42]);
    addGlow(THREE, g, 0x8ac4f0, 0.5, 2.4, [-0.04, 0.25, 0.3]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 13. GAMING SETUP
// ---------------------------------------------------------------------------
function gamingSetup(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const woodMat = makeMat(THREE, o, "wood");
  const metalMat = makeMat(THREE, o, "metal", { roughness: 0.3 });
  const primMat = makeMat(THREE, o, "primary");
  const accMat = makeMat(THREE, o, "accent", { emissive: new THREE.Color(o.accent), emissiveIntensity: 0.55 });
  const screenMat = makeFixedMat(THREE, 0x263859, { emissive: 0x5c7ce0, emissiveIntensity: 0.65, roughness: 0.2 });

  // Desk frame + top
  addMesh(THREE, g, bevelBox(THREE, 1.24, 0.036, 0.64, 0.025, 0.008), o.variant === 0 ? metalMat : woodMat, o.variant === 0 ? "metal" : "wood", [0, 0.74, 0]);
  for (const sx of [-0.56, 0.56]) {
    addMesh(THREE, g, bevelBox(THREE, 0.04, 0.72, 0.04, 0.008, 0.003), metalMat, "metal", [sx, 0.36, -0.24]);
    addMesh(THREE, g, bevelBox(THREE, 0.04, 0.72, 0.04, 0.008, 0.003), metalMat, "metal", [sx, 0.36, 0.24]);
    addMesh(THREE, g, bevelBox(THREE, 0.04, 0.035, 0.54, 0.008, 0.003), metalMat, "metal", [sx, 0.02, 0]);
  }
  // Desk mat + keyboard + mouse
  addMesh(THREE, g, bevelBox(THREE, 0.66, 0.006, 0.28, 0.015, 0.002), primMat, "primary", [-0.1, 0.761, 0.1]);
  addMesh(THREE, g, bevelBox(THREE, 0.34, 0.018, 0.12, 0.008, 0.003), metalMat, "metal", [-0.14, 0.772, 0.1]);
  addMesh(THREE, g, new THREE.CapsuleGeometry(0.022, 0.04, 6, 8), metalMat, "metal", [0.14, 0.775, 0.1], [Math.PI / 2, 0, 0]);

  if (o.variant === 0) {
    // Ultrawide monitor + glass RGB tower
    addMesh(THREE, g, bevelBox(THREE, 0.7, 0.32, 0.026, 0.012, 0.004), metalMat, "metal", [-0.12, 1.03, -0.16]);
    addMesh(THREE, g, new THREE.BoxGeometry(0.66, 0.28, 0.008), screenMat, null, [-0.12, 1.03, -0.144]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.02, 0.025, 0.14, 10), metalMat, "metal", [-0.12, 0.82, -0.18]);
    // PC tower on right
    addMesh(THREE, g, bevelBox(THREE, 0.22, 0.42, 0.42, 0.016, 0.005), metalMat, "metal", [0.46, 0.97, -0.05]);
    const rgb = addMesh(THREE, g, new THREE.BoxGeometry(0.012, 0.34, 0.015), accMat, "accent", [0.35, 0.97, 0.14]);
    rgb.userData.emissiveMatch = true;
  } else if (o.variant === 1) {
    // Dual angled monitors + compact cube PC
    for (const sx of [-1, 1]) {
      const mGrp = new THREE.Group();
      mGrp.position.set(-0.14 + sx * 0.24, 1.02, -0.16);
      mGrp.rotation.y = -sx * 0.16;
      addMesh(THREE, mGrp, bevelBox(THREE, 0.44, 0.28, 0.024, 0.01, 0.004), metalMat, "metal");
      addMesh(THREE, mGrp, new THREE.BoxGeometry(0.41, 0.25, 0.008), screenMat, null, [0, 0, 0.013]);
      g.add(mGrp);
    }
    addMesh(THREE, g, bevelBox(THREE, 0.22, 0.26, 0.28, 0.02, 0.006), primMat, "primary", [0.46, 0.89, -0.08]);
  } else {
    // Single monitor + standing game console + headphones on stand
    addMesh(THREE, g, bevelBox(THREE, 0.56, 0.34, 0.026, 0.012, 0.004), metalMat, "metal", [-0.08, 1.04, -0.16]);
    addMesh(THREE, g, new THREE.BoxGeometry(0.52, 0.3, 0.008), screenMat, null, [-0.08, 1.04, -0.144]);
    addMesh(THREE, g, bevelBox(THREE, 0.09, 0.34, 0.24, 0.02, 0.006), makeMat(THREE, o, "secondary"), "secondary", [0.44, 0.93, -0.1]);
    // Headphone stand + headphones
    addMesh(THREE, g, new THREE.CylinderGeometry(0.008, 0.008, 0.22, 8), metalMat, "metal", [-0.48, 0.87, 0.02]);
    addMesh(THREE, g, new THREE.TorusGeometry(0.06, 0.012, 8, 16, Math.PI), accMat, "accent", [-0.48, 0.96, 0.02]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 14. EASEL
// ---------------------------------------------------------------------------
function easel(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const woodMat = makeMat(THREE, o, "wood");
  const canvasMat = makeFixedMat(THREE, 0xf6f1e6, { roughness: 0.88 });
  const primMat = makeMat(THREE, o, "primary", { roughness: 0.65 });
  const accMat = makeMat(THREE, o, "accent", { roughness: 0.65 });

  function addPainting(w, h, pos, rotX) {
    const p = new THREE.Group();
    p.position.set(pos[0], pos[1], pos[2]);
    p.rotation.x = rotX;
    addMesh(THREE, p, bevelBox(THREE, w, h, 0.024, 0.008, 0.003), canvasMat, null);
    // Abstract geometric art blocks
    addMesh(THREE, p, new THREE.BoxGeometry(w * 0.45, h * 0.42, 0.004), primMat, "primary", [-w * 0.14, h * 0.12, 0.013]);
    addMesh(THREE, p, new THREE.CircleGeometry(Math.min(w, h) * 0.2, 16), accMat, "accent", [w * 0.16, -h * 0.1, 0.015]);
    g.add(p);
  }

  if (o.variant === 0) {
    // Classic A-frame tripod easel
    addMesh(THREE, g, bevelBox(THREE, 0.032, 1.56, 0.032, 0.008, 0.003), woodMat, "wood", [-0.15, 0.76, 0.06], [-0.14, 0, -0.14]);
    addMesh(THREE, g, bevelBox(THREE, 0.032, 1.56, 0.032, 0.008, 0.003), woodMat, "wood", [0.15, 0.76, 0.06], [-0.14, 0, 0.14]);
    addMesh(THREE, g, bevelBox(THREE, 0.032, 1.52, 0.032, 0.008, 0.003), woodMat, "wood", [0, 0.72, -0.22], [0.24, 0, 0]);
    addMesh(THREE, g, bevelBox(THREE, 0.56, 0.03, 0.07, 0.008, 0.003), woodMat, "wood", [0, 0.82, 0.1], [-0.14, 0, 0]);
    addPainting(0.46, 0.58, [0, 1.12, 0.05], -0.14);
  } else if (o.variant === 1) {
    // H-frame heavy studio easel with horizontal landscape canvas
    for (const sx of [-0.22, 0.22]) {
      addMesh(THREE, g, bevelBox(THREE, 0.04, 0.04, 0.62, 0.008, 0.003), woodMat, "wood", [sx, 0.02, 0]);
      addMesh(THREE, g, bevelBox(THREE, 0.036, 1.5, 0.036, 0.008, 0.003), woodMat, "wood", [sx, 0.77, -0.02], [-0.08, 0, 0]);
    }
    addMesh(THREE, g, bevelBox(THREE, 0.54, 0.036, 0.08, 0.008, 0.003), woodMat, "wood", [0, 0.86, 0.04]);
    addPainting(0.62, 0.44, [0, 1.1, 0.01], -0.08);
  } else {
    // Stool + tabletop mini easel
    addMesh(THREE, g, new THREE.CylinderGeometry(0.18, 0.18, 0.03, 18), woodMat, "wood", [0, 0.54, 0]);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      addLeg(THREE, g, woodMat, "wood", Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0.54, 0.015, 0.011, Math.cos(a) * 0.1, Math.sin(a) * 0.1);
    }
    addMesh(THREE, g, bevelBox(THREE, 0.024, 0.5, 0.024, 0.006, 0.002), woodMat, "wood", [0, 0.78, -0.06], [0.22, 0, 0]);
    addMesh(THREE, g, bevelBox(THREE, 0.34, 0.024, 0.05, 0.006, 0.002), woodMat, "wood", [0, 0.64, 0.06]);
    addPainting(0.32, 0.4, [0, 0.85, 0.02], -0.18);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 15. KEYBOARD PIANO
// ---------------------------------------------------------------------------
function keyboardPiano(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const metalMat = makeMat(THREE, o, "metal", { roughness: 0.32 });
  const woodMat = makeMat(THREE, o, "wood");
  const primMat = makeMat(THREE, o, "primary", { roughness: 0.35 });
  const accMat = makeMat(THREE, o, "accent", { roughness: 0.4 });
  const whiteKey = makeFixedMat(THREE, 0xf7f5ee, { roughness: 0.3 });
  const blackKey = makeFixedMat(THREE, 0x1d1f22, { roughness: 0.35 });

  function addKeybed(y, w, z) {
    addMesh(THREE, g, bevelBox(THREE, w * 0.9, 0.024, 0.13, 0.006, 0.002), whiteKey, null, [0, y + 0.04, z + 0.06]);
    const count = Math.floor(w * 18);
    const bkGeo = new THREE.BoxGeometry(0.016, 0.018, 0.075);
    for (let i = 0; i < count; i++) {
      if (i % 7 === 2 || i % 7 === 6) continue;
      const x = -w * 0.42 + (i / count) * (w * 0.84);
      addMesh(THREE, g, bkGeo, blackKey, null, [x, y + 0.056, z + 0.03]);
    }
  }

  if (o.variant === 0) {
    // Stage piano on X-frame stand
    for (const sz of [-0.14, 0.14]) {
      addMesh(THREE, g, new THREE.CylinderGeometry(0.014, 0.014, 0.94, 10), metalMat, "metal", [0, 0.36, sz], [0, 0, 0.72]);
      addMesh(THREE, g, new THREE.CylinderGeometry(0.014, 0.014, 0.94, 10), metalMat, "metal", [0, 0.36, sz], [0, 0, -0.72]);
    }
    addMesh(THREE, g, bevelBox(THREE, 1.12, 0.09, 0.3, 0.02, 0.008), metalMat, "metal", [0, 0.74, 0]);
    addKeybed(0.74, 1.1, 0.02);
    // Music rest
    addMesh(THREE, g, bevelBox(THREE, 0.42, 0.2, 0.012, 0.01, 0.003), metalMat, "metal", [0, 0.88, -0.1], [-0.25, 0, 0]);
    // Sustain pedal
    addMesh(THREE, g, bevelBox(THREE, 0.07, 0.025, 0.11, 0.008, 0.003), metalMat, "metal", [0.08, 0.014, 0.14]);
  } else if (o.variant === 1) {
    // Wooden cabinet digital piano
    for (const sx of [-0.52, 0.52]) {
      addMesh(THREE, g, bevelBox(THREE, 0.04, 0.74, 0.34, 0.015, 0.005), woodMat, "wood", [sx, 0.37, 0]);
    }
    addMesh(THREE, g, new THREE.BoxGeometry(1.04, 0.56, 0.025), woodMat, "wood", [0, 0.32, -0.14]);
    addMesh(THREE, g, bevelBox(THREE, 1.1, 0.12, 0.36, 0.02, 0.008), woodMat, "wood", [0, 0.74, 0]);
    addKeybed(0.75, 1.04, 0.03);
    for (const px of [-0.07, 0, 0.07]) {
      addMesh(THREE, g, bevelBox(THREE, 0.022, 0.02, 0.07, 0.005, 0.002), accMat, "accent", [px, 0.04, 0.06]);
    }
  } else {
    // Retro synthesizer with wood end cheeks & knobs
    for (const sx of [-0.42, 0.42]) {
      addMesh(THREE, g, bevelBox(THREE, 0.03, 0.72, 0.03, 0.008, 0.003), metalMat, "metal", [sx, 0.36, 0]);
      addMesh(THREE, g, bevelBox(THREE, 0.03, 0.03, 0.38, 0.008, 0.003), metalMat, "metal", [sx, 0.015, 0]);
    }
    addMesh(THREE, g, bevelBox(THREE, 0.94, 0.095, 0.34, 0.018, 0.006), primMat, "primary", [0, 0.74, 0]);
    for (const sx of [-0.48, 0.48]) {
      addMesh(THREE, g, bevelBox(THREE, 0.035, 0.11, 0.36, 0.015, 0.005), woodMat, "wood", [sx, 0.745, 0]);
    }
    addKeybed(0.74, 0.9, 0.03);
    for (let i = 0; i < 8; i++) {
      addMesh(THREE, g, new THREE.CylinderGeometry(0.012, 0.012, 0.02, 10), accMat, "accent", [-0.34 + i * 0.09, 0.8, -0.09]);
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// 16. GUITAR ON STAND
// ---------------------------------------------------------------------------
function guitarOnStand(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const woodMat = makeMat(THREE, o, "wood");
  const primMat = makeMat(THREE, o, "primary", { roughness: 0.25, metalness: 0.15 });
  const secMat = makeMat(THREE, o, "secondary");
  const metalMat = makeMat(THREE, o, "metal");
  const darkWood = makeFixedMat(THREE, 0x3b2a1e, { roughness: 0.65 });

  // Metal A-frame stand
  for (const sx of [-0.13, 0.13]) {
    addMesh(THREE, g, new THREE.CylinderGeometry(0.009, 0.009, 0.42, 8), metalMat, "metal", [sx, 0.2, 0.02], [0.22, 0, sx * 0.4]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.009, 0.009, 0.38, 8), metalMat, "metal", [sx, 0.18, -0.14], [-0.3, 0, 0]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.009, 0.009, 0.14, 8), metalMat, "metal", [sx, 0.07, 0.12], [Math.PI / 2, 0, 0]);
  }

  const gtr = new THREE.Group();
  gtr.position.set(0, 0.08, 0.04);
  gtr.rotation.x = -0.16;

  const isUke = o.variant === 2;
  const s = isUke ? 0.72 : 1.0;

  if (o.variant === 0 || isUke) {
    // Acoustic / ukulele figure-8 body
    const body = new THREE.Shape();
    body.moveTo(0, 0);
    body.bezierCurveTo(0.2 * s, 0, 0.22 * s, 0.2 * s, 0.12 * s, 0.26 * s);
    body.bezierCurveTo(0.17 * s, 0.34 * s, 0.15 * s, 0.46 * s, 0, 0.46 * s);
    body.bezierCurveTo(-0.15 * s, 0.46 * s, -0.17 * s, 0.34 * s, -0.12 * s, 0.26 * s);
    body.bezierCurveTo(-0.22 * s, 0.2 * s, -0.2 * s, 0, 0, 0);
    const bodyGeo = new THREE.ExtrudeGeometry(body, { depth: 0.08 * s, bevelEnabled: true, bevelSize: 0.012 * s, bevelThickness: 0.012 * s, bevelSegments: 2 });
    bodyGeo.translate(0, 0, -0.04 * s);
    addMesh(THREE, gtr, bodyGeo, isUke ? makeMat(THREE, o, "accent") : woodMat, isUke ? "accent" : "wood");
    addMesh(THREE, gtr, new THREE.CircleGeometry(0.048 * s, 18), makeFixedMat(THREE, 0x1b1410), null, [0, 0.3 * s, 0.054 * s]);
    addMesh(THREE, gtr, new THREE.BoxGeometry(0.12 * s, 0.025 * s, 0.012 * s), darkWood, null, [0, 0.16 * s, 0.055 * s]);
  } else {
    // Solid-body electric guitar
    addMesh(THREE, gtr, bevelBox(THREE, 0.32, 0.42, 0.045, 0.1, 0.014), primMat, "primary", [0, 0.22, 0]);
    addMesh(THREE, gtr, bevelBox(THREE, 0.2, 0.22, 0.008, 0.06, 0.002), secMat, "secondary", [0.02, 0.22, 0.024]);
    addMesh(THREE, gtr, new THREE.BoxGeometry(0.08, 0.022, 0.012), metalMat, "metal", [0, 0.28, 0.03]);
    addMesh(THREE, gtr, new THREE.BoxGeometry(0.08, 0.022, 0.012), metalMat, "metal", [0, 0.18, 0.03]);
  }
  // Neck + headstock
  addMesh(THREE, gtr, bevelBox(THREE, 0.048 * s, 0.48 * s, 0.026 * s, 0.006, 0.003), darkWood, null, [0, 0.66 * s, 0.01 * s]);
  addMesh(THREE, gtr, bevelBox(THREE, 0.072 * s, 0.14 * s, 0.024 * s, 0.014, 0.004), woodMat, "wood", [0, 0.94 * s, 0.008 * s]);
  g.add(gtr);
  return g;
}

// ---------------------------------------------------------------------------
// 17. YOGA MAT
// ---------------------------------------------------------------------------
function yogaMat(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const mat1 = makeMat(THREE, o, "primary", { roughness: 0.85, metalness: 0.0 });
  const matAcc = makeMat(THREE, o, "accent", { roughness: 0.82, metalness: 0.0 });
  const matSec = makeMat(THREE, o, "secondary", { roughness: 0.85, metalness: 0.0 });

  if (o.variant === 0) {
    // Unrolled flat mat + foam yoga block
    addMesh(THREE, g, bevelBox(THREE, 0.62, 0.012, 1.72, 0.03, 0.004), mat1, "primary", [0, 0.006, 0]);
    addMesh(THREE, g, new THREE.BoxGeometry(0.02, 0.004, 1.56), matAcc, "accent", [0, 0.013, 0]);
    addMesh(THREE, g, bevelBox(THREE, 0.22, 0.1, 0.14, 0.02, 0.008), matSec, "secondary", [0.44, 0.05, -0.52], [0, 0.25, 0]);
  } else if (o.variant === 1) {
    // Rolled upright yoga mat with strap
    addMesh(THREE, g, new THREE.CylinderGeometry(0.075, 0.075, 0.62, 22), mat1, "primary", [0, 0.31, 0]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.03, 0.03, 0.624, 14), makeFixedMat(THREE, 0x262626), null, [0, 0.31, 0]);
    for (const sy of [0.16, 0.46]) {
      addMesh(THREE, g, new THREE.TorusGeometry(0.076, 0.009, 8, 22), matSec, "secondary", [0, sy, 0], [Math.PI / 2, 0, 0]);
    }
    addMesh(THREE, g, new THREE.CylinderGeometry(0.008, 0.008, 0.3, 8), matAcc, "accent", [0.082, 0.31, 0]);
  } else {
    // Partially unrolled mat + water bottle
    addMesh(THREE, g, bevelBox(THREE, 0.62, 0.012, 1.08, 0.025, 0.004), mat1, "primary", [0, 0.006, 0.22]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.062, 0.062, 0.62, 20), mat1, "primary", [0, 0.064, -0.32], [0, 0, Math.PI / 2]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.038, 0.038, 0.22, 14), matAcc, "accent", [0.42, 0.11, 0.4]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.024, 0.026, 0.04, 12), matSec, "secondary", [0.42, 0.24, 0.4]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 18. BIKE
// ---------------------------------------------------------------------------
function bike(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const frameMat = makeMat(THREE, o, "primary", { roughness: 0.28, metalness: 0.45 });
  const metalMat = makeMat(THREE, o, "metal", { roughness: 0.25, metalness: 0.8 });
  const woodMat = makeMat(THREE, o, "wood");
  const accMat = makeMat(THREE, o, "accent");
  const tireMat = makeFixedMat(THREE, 0x242629, { roughness: 0.85 });

  const isFold = o.variant === 2;
  const r = isFold ? 0.24 : 0.33;
  const wb = isFold ? 0.48 : 0.54;

  function addWheel(x) {
    const wg = new THREE.Group();
    wg.position.set(x, r, 0);
    addMesh(THREE, wg, new THREE.TorusGeometry(r - 0.025, 0.026, 10, 26), tireMat, null);
    addMesh(THREE, wg, new THREE.TorusGeometry(r - 0.048, 0.01, 8, 26), o.variant === 1 ? accMat : metalMat, o.variant === 1 ? "accent" : "metal");
    for (let i = 0; i < 6; i++) {
      addMesh(THREE, wg, new THREE.CylinderGeometry(0.003, 0.003, (r - 0.05) * 2, 6), metalMat, "metal", [0, 0, 0], [0, 0, (i / 6) * Math.PI]);
    }
    addMesh(THREE, wg, new THREE.CylinderGeometry(0.022, 0.022, 0.06, 10), metalMat, "metal", [0, 0, 0], [Math.PI / 2, 0, 0]);
    g.add(wg);
  }

  function addTube(p1, p2, rad, mat, slot) {
    const curve = new THREE.LineCurve3(new THREE.Vector3(p1[0], p1[1], p1[2]), new THREE.Vector3(p2[0], p2[1], p2[2]));
    addMesh(THREE, g, new THREE.TubeGeometry(curve, 4, rad, 8, false), mat, slot);
  }

  addWheel(-wb);
  addWheel(wb);

  const bb = [-0.08, r - 0.03, 0];
  const seatTop = [-0.22, r + (isFold ? 0.48 : 0.44), 0];
  const headTop = [wb - 0.14, r + (isFold ? 0.44 : 0.4), 0];

  addTube([-wb, r, 0], bb, 0.014, frameMat, "primary");
  addTube([-wb, r, 0], [-0.18, r + 0.34, 0], 0.012, frameMat, "primary");
  addTube(bb, [-0.18, r + 0.34, 0], 0.016, frameMat, "primary");
  addTube(bb, [wb - 0.1, r + 0.32, 0], 0.016, frameMat, "primary");
  if (o.variant === 1) {
    addTube([-0.18, r + 0.34, 0], [wb - 0.12, r + 0.34, 0], 0.015, frameMat, "primary");
  }
  addTube([wb, r, 0], headTop, 0.015, frameMat, "primary");
  addTube([-0.18, r + 0.34, 0], seatTop, 0.012, metalMat, "metal");
  addTube(headTop, [wb - 0.16, r + (isFold ? 0.56 : 0.48), 0], 0.012, metalMat, "metal");

  // Handlebars
  const hbY = r + (isFold ? 0.56 : 0.48);
  addMesh(THREE, g, new THREE.CylinderGeometry(0.011, 0.011, 0.46, 10), metalMat, "metal", [wb - 0.16, hbY, 0], [Math.PI / 2, 0, 0]);
  // Saddle
  addMesh(THREE, g, bevelBox(THREE, 0.22, 0.045, 0.12, 0.04, 0.012), woodMat, "wood", [seatTop[0], seatTop[1] + 0.02, 0]);
  // Kickstand
  addTube(bb, [-0.14, 0.01, 0.12], 0.008, metalMat, "metal");

  if (o.variant === 0) {
    // Front cruiser basket
    addMesh(THREE, g, bevelBox(THREE, 0.22, 0.2, 0.26, 0.03, 0.01), woodMat, "wood", [wb - 0.04, hbY - 0.1, 0]);
  } else if (o.variant === 2) {
    // Rear rack
    addMesh(THREE, g, bevelBox(THREE, 0.32, 0.02, 0.14, 0.01, 0.003), metalMat, "metal", [-wb, r + 0.32, 0]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 19. LAUNDRY BASKET
// ---------------------------------------------------------------------------
function laundryBasket(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const primMat = makeMat(THREE, o, "primary", { roughness: 0.88 });
  const secMat = makeMat(THREE, o, "secondary", { roughness: 0.9 });
  const accMat = makeMat(THREE, o, "accent", { roughness: 0.88 });
  const woodMat = makeMat(THREE, o, "wood");

  if (o.variant === 0) {
    // Round woven rope hamper with peeking laundry
    const body = latheFromPairs(THREE, [
      [0.01, 0], [0.18, 0.01], [0.22, 0.16], [0.23, 0.38], [0.21, 0.52], [0.19, 0.52],
    ], 24);
    addMesh(THREE, g, body, secMat, "secondary");
    for (let i = 0; i < 6; i++) {
      addMesh(THREE, g, new THREE.TorusGeometry(0.215, 0.012, 8, 24), i % 2 ? primMat : secMat, i % 2 ? "primary" : "secondary", [0, 0.08 + i * 0.08, 0], [Math.PI / 2, 0, 0]);
    }
    for (const sx of [-0.21, 0.21]) {
      addMesh(THREE, g, new THREE.TorusGeometry(0.045, 0.01, 8, 14, Math.PI), woodMat, "wood", [sx, 0.52, 0], [0, Math.PI / 2, 0]);
    }
    // Soft folded clothes peeking out
    addMesh(THREE, g, new THREE.SphereGeometry(0.13, 12, 10), accMat, "accent", [-0.04, 0.51, 0.02], [0, 0, 0], [1.1, 0.65, 0.9]);
    addMesh(THREE, g, new THREE.SphereGeometry(0.11, 12, 10), primMat, "primary", [0.06, 0.53, -0.04], [0, 0, 0], [1.0, 0.6, 1.0]);
  } else if (o.variant === 1) {
    // Wooden X-frame canvas hamper
    for (const sz of [-0.18, 0.18]) {
      addMesh(THREE, g, bevelBox(THREE, 0.028, 0.62, 0.028, 0.006, 0.003), woodMat, "wood", [0, 0.28, sz], [0, 0, 0.42]);
      addMesh(THREE, g, bevelBox(THREE, 0.028, 0.62, 0.028, 0.006, 0.003), woodMat, "wood", [0, 0.28, sz], [0, 0, -0.42]);
    }
    addMesh(THREE, g, bevelBox(THREE, 0.4, 0.42, 0.32, 0.05, 0.018), secMat, "secondary", [0, 0.34, 0]);
    addMesh(THREE, g, bevelBox(THREE, 0.42, 0.08, 0.34, 0.04, 0.012), accMat, "accent", [0, 0.52, 0]);
  } else {
    // Tall lidded wooden/bamboo hamper
    addMesh(THREE, g, bevelBox(THREE, 0.4, 0.58, 0.34, 0.05, 0.015), woodMat, "wood", [0, 0.29, 0]);
    addMesh(THREE, g, bevelBox(THREE, 0.42, 0.036, 0.36, 0.04, 0.01), primMat, "primary", [0, 0.61, -0.02], [-0.12, 0, 0]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 20. COAT RACK
// ---------------------------------------------------------------------------
function coatRack(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const woodMat = makeMat(THREE, o, "wood");
  const metalMat = makeMat(THREE, o, "metal");
  const accMat = makeMat(THREE, o, "accent", { roughness: 0.9 });
  const primMat = makeMat(THREE, o, "primary", { roughness: 0.9 });

  if (o.variant === 0) {
    // Classic wooden tree coat rack with draped scarf
    addMesh(THREE, g, new THREE.CylinderGeometry(0.022, 0.032, 1.7, 14), woodMat, "wood", [0, 0.87, 0]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      addLeg(THREE, g, woodMat, "wood", Math.cos(a) * 0.14, Math.sin(a) * 0.14, 0.24, 0.018, 0.014, -Math.cos(a) * 0.7, -Math.sin(a) * 0.7);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const y = 1.48 + (i % 2) * 0.14;
      const peg = addMesh(THREE, g, new THREE.CapsuleGeometry(0.01, 0.1, 6, 8), woodMat, "wood", [Math.cos(a) * 0.06, y, Math.sin(a) * 0.06]);
      peg.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    }
    // Cozy beanie / scarf hanging on one peg
    addMesh(THREE, g, new THREE.SphereGeometry(0.07, 12, 10), accMat, "accent", [0.09, 1.56, 0.03], [0, 0, 0], [0.9, 1.15, 0.9]);
  } else if (o.variant === 1) {
    // Minimalist crossing metal tripod coat rack
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.78, 10), metalMat);
      rod.position.set(Math.cos(a) * 0.11, 0.87, Math.sin(a) * 0.11);
      rod.rotation.set(-Math.sin(a) * 0.14, 0, Math.cos(a) * 0.14);
      rod.castShadow = true;
      rod.receiveShadow = true;
      rod.userData.slot = "metal";
      g.add(rod);
      addMesh(THREE, g, new THREE.SphereGeometry(0.022, 10, 10), woodMat, "wood", [-Math.cos(a) * 0.02, 1.74, -Math.sin(a) * 0.02]);
    }
  } else {
    // Hall-tree rack with umbrella ring & hanging tote bag
    addMesh(THREE, g, new THREE.CylinderGeometry(0.18, 0.19, 0.03, 20), metalMat, "metal", [0, 0.015, 0]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.018, 0.02, 1.72, 12), metalMat, "metal", [0, 0.87, 0]);
    addMesh(THREE, g, new THREE.TorusGeometry(0.13, 0.01, 8, 22), metalMat, "metal", [0, 0.44, 0], [Math.PI / 2, 0, 0]);
    addMesh(THREE, g, new THREE.TorusGeometry(0.12, 0.01, 8, 22), metalMat, "metal", [0, 1.66, 0], [Math.PI / 2, 0, 0]);
    addMesh(THREE, g, bevelBox(THREE, 0.22, 0.26, 0.06, 0.03, 0.01), primMat, "primary", [0.14, 1.38, 0.02], [0, 0.2, 0.08]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 21. FULL MIRROR
// ---------------------------------------------------------------------------
function fullMirror(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const woodMat = makeMat(THREE, o, "wood");
  const metalMat = makeMat(THREE, o, "metal");
  const accMat = makeMat(THREE, o, "accent", { roughness: 0.4 });
  const glassMat = makeFixedMat(THREE, 0xcadbe6, { roughness: 0.06, metalness: 0.92 });

  if (o.variant === 0) {
    // Arched leaning floor mirror
    const mGrp = new THREE.Group();
    mGrp.position.set(0, 0.82, 0.02);
    mGrp.rotation.x = -0.1;
    const s = new THREE.Shape();
    s.moveTo(-0.26, -0.8);
    s.lineTo(0.26, -0.8);
    s.lineTo(0.26, 0.54);
    s.absarc(0, 0.54, 0.26, 0, Math.PI, false);
    s.lineTo(-0.26, -0.8);
    const frameGeo = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 });
    frameGeo.translate(0, 0, -0.015);
    addMesh(THREE, mGrp, frameGeo, metalMat, "metal");
    const gs = new THREE.Shape();
    gs.moveTo(-0.23, -0.77);
    gs.lineTo(0.23, -0.77);
    gs.lineTo(0.23, 0.54);
    gs.absarc(0, 0.54, 0.23, 0, Math.PI, false);
    gs.lineTo(-0.23, -0.77);
    addMesh(THREE, mGrp, new THREE.ShapeGeometry(gs), glassMat, null, [0, 0, 0.024]);
    g.add(mGrp);
    // Back easel leg
    addMesh(THREE, g, bevelBox(THREE, 0.024, 1.24, 0.024, 0.005, 0.002), metalMat, "metal", [0, 0.6, -0.18], [0.22, 0, 0]);
  } else if (o.variant === 1) {
    // Cheval wood-frame standing mirror
    for (const sx of [-0.28, 0.28]) {
      addMesh(THREE, g, bevelBox(THREE, 0.035, 0.035, 0.42, 0.012, 0.005), woodMat, "wood", [sx, 0.02, 0]);
      addMesh(THREE, g, bevelBox(THREE, 0.032, 1.1, 0.032, 0.01, 0.004), woodMat, "wood", [sx, 0.56, 0]);
    }
    const mGrp = new THREE.Group();
    mGrp.position.set(0, 0.92, 0);
    mGrp.rotation.x = -0.08;
    addMesh(THREE, mGrp, bevelBox(THREE, 0.48, 1.38, 0.036, 0.02, 0.008), woodMat, "wood");
    addMesh(THREE, mGrp, new THREE.BoxGeometry(0.41, 1.3, 0.008), glassMat, null, [0, 0, 0.017]);
    g.add(mGrp);
  } else {
    // Chunky aesthetic accent-framed rounded mirror
    const mGrp = new THREE.Group();
    mGrp.position.set(0, 0.78, 0.02);
    mGrp.rotation.x = -0.1;
    addMesh(THREE, mGrp, bevelBox(THREE, 0.56, 1.54, 0.05, 0.1, 0.02), accMat, "accent");
    addMesh(THREE, mGrp, bevelBox(THREE, 0.44, 1.4, 0.01, 0.07, 0.002), glassMat, null, [0, 0, 0.024]);
    g.add(mGrp);
    addMesh(THREE, g, bevelBox(THREE, 0.026, 1.18, 0.026, 0.006, 0.002), woodMat, "wood", [0, 0.58, -0.17], [0.22, 0, 0]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 22. WALL CLOCK (wall)
// ---------------------------------------------------------------------------
function wallClock(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const woodMat = makeMat(THREE, o, "wood");
  const primMat = makeMat(THREE, o, "primary");
  const secMat = makeMat(THREE, o, "secondary");
  const accMat = makeMat(THREE, o, "accent");
  const metalMat = makeMat(THREE, o, "metal");
  const handMat = makeFixedMat(THREE, 0x222222);

  function addHands(z, scale = 1) {
    addMesh(THREE, g, new THREE.BoxGeometry(0.01 * scale, 0.085 * scale, 0.006), handMat, null, [0.02 * scale, 0.025 * scale, z], [0, 0, -0.65]);
    addMesh(THREE, g, new THREE.BoxGeometry(0.008 * scale, 0.115 * scale, 0.006), handMat, null, [-0.02 * scale, 0.04 * scale, z + 0.004], [0, 0, 0.45]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.01 * scale, 0.01 * scale, 0.012, 10), accMat, "accent", [0, 0, z + 0.006], [Math.PI / 2, 0, 0]);
  }

  if (o.variant === 0) {
    // Minimalist round wood-rimmed clock
    addMesh(THREE, g, new THREE.CylinderGeometry(0.16, 0.16, 0.036, 28), woodMat, "wood", [0, 0, 0.018], [Math.PI / 2, 0, 0]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.142, 0.142, 0.01, 26), secMat, "secondary", [0, 0, 0.034], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      addMesh(THREE, g, new THREE.BoxGeometry(0.006, i % 3 === 0 ? 0.022 : 0.012, 0.005), metalMat, "metal", [Math.sin(a) * 0.118, Math.cos(a) * 0.118, 0.041], [0, 0, -a]);
    }
    addHands(0.045, 1);
  } else if (o.variant === 1) {
    // Mid-century sunburst clock
    addMesh(THREE, g, new THREE.CylinderGeometry(0.095, 0.095, 0.03, 24), secMat, "secondary", [0, 0, 0.02], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const len = i % 2 === 0 ? 0.18 : 0.14;
      addMesh(THREE, g, new THREE.CylinderGeometry(0.004, 0.007, len, 6), accMat, "accent", [Math.sin(a) * (0.08 + len * 0.4), Math.cos(a) * (0.08 + len * 0.4), 0.014], [0, 0, -a]);
      if (i % 2 === 0) {
        addMesh(THREE, g, new THREE.SphereGeometry(0.013, 8, 8), woodMat, "wood", [Math.sin(a) * 0.24, Math.cos(a) * 0.24, 0.014]);
      }
    }
    addHands(0.04, 0.72);
  } else {
    // Retro rounded-square station clock
    addMesh(THREE, g, bevelBox(THREE, 0.3, 0.3, 0.055, 0.06, 0.014), primMat, "primary", [0, 0, 0.027]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.115, 0.115, 0.01, 24), secMat, "secondary", [0, 0, 0.053], [Math.PI / 2, 0, 0]);
    addHands(0.062, 0.88);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 23. WALL SHELF (wall)
// ---------------------------------------------------------------------------
function wallShelf(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const woodMat = makeMat(THREE, o, "wood");
  const metalMat = makeMat(THREE, o, "metal");
  const primMat = makeMat(THREE, o, "primary");
  const accMat = makeMat(THREE, o, "accent");

  if (o.variant === 0) {
    // Floating ledge shelf with mini books & tiny plant
    addMesh(THREE, g, bevelBox(THREE, 0.84, 0.036, 0.2, 0.014, 0.005), woodMat, "wood", [0, 0, 0.1]);
    addMiniBook(THREE, g, primMat, "primary", 0.03, 0.17, 0.13, [-0.28, 0.105, 0.1]);
    addMiniBook(THREE, g, accMat, "accent", 0.028, 0.15, 0.12, [-0.245, 0.095, 0.1], [0, 0, -0.14]);
    // Tiny succulent pot
    addMesh(THREE, g, new THREE.CylinderGeometry(0.045, 0.035, 0.07, 14), accMat, "accent", [0.26, 0.053, 0.1]);
    addLeafCluster(THREE, g, [0.26, 0.09, 0.1], 0.9, 0x568b52, 6);
  } else if (o.variant === 1) {
    // 2-tier metal-bracketed wall shelf
    for (const sy of [-0.14, 0.14]) {
      addMesh(THREE, g, bevelBox(THREE, 0.76, 0.028, 0.19, 0.012, 0.004), woodMat, "wood", [0, sy, 0.095]);
    }
    for (const sx of [-0.28, 0.28]) {
      addMesh(THREE, g, new THREE.CylinderGeometry(0.008, 0.008, 0.36, 8), metalMat, "metal", [sx, 0, 0.015]);
      addMesh(THREE, g, new THREE.CylinderGeometry(0.008, 0.008, 0.17, 8), metalMat, "metal", [sx, -0.16, 0.095], [Math.PI / 2, 0, 0]);
      addMesh(THREE, g, new THREE.CylinderGeometry(0.008, 0.008, 0.17, 8), metalMat, "metal", [sx, 0.12, 0.095], [Math.PI / 2, 0, 0]);
    }
    addMesh(THREE, g, bevelBox(THREE, 0.14, 0.09, 0.11, 0.015, 0.005), primMat, "primary", [-0.1, 0.2, 0.095]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.036, 0.034, 0.08, 12), accMat, "accent", [0.16, -0.086, 0.1]);
  } else {
    // Geometric hexagon wall shelf cubby
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r = 0.22;
      addMesh(THREE, g, bevelBox(THREE, 0.255, 0.024, 0.16, 0.006, 0.003), woodMat, "wood", [Math.sin(a) * r, Math.cos(a) * r, 0.08], [0, 0, -a]);
    }
    addMesh(THREE, g, bevelBox(THREE, 0.42, 0.02, 0.15, 0.006, 0.002), woodMat, "wood", [0, 0, 0.08]);
    addMesh(THREE, g, new THREE.SphereGeometry(0.045, 14, 12), accMat, "accent", [-0.07, 0.055, 0.08]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.028, 0.028, 0.07, 12), primMat, "primary", [0.08, 0.045, 0.08]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 24. PENNANT (wall, no text)
// ---------------------------------------------------------------------------
function pennant(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const primMat = makeMat(THREE, o, "primary", { roughness: 0.92 });
  const secMat = makeMat(THREE, o, "secondary", { roughness: 0.92 });
  const accMat = makeMat(THREE, o, "accent", { roughness: 0.9 });
  const woodMat = makeMat(THREE, o, "wood");

  if (o.variant === 0) {
    // Classic triangular dorm felt pennant with abstract diamond emblem
    const s = new THREE.Shape();
    s.moveTo(-0.27, 0.12);
    s.lineTo(0.27, 0);
    s.lineTo(-0.27, -0.12);
    s.closePath();
    addMesh(THREE, g, new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: false }), primMat, "primary", [0, 0, 0.004]);
    addMesh(THREE, g, new THREE.BoxGeometry(0.036, 0.24, 0.012), secMat, "secondary", [-0.255, 0, 0.008]);
    // Geometric diamond motif (no text)
    addMesh(THREE, g, new THREE.BoxGeometry(0.07, 0.07, 0.005), accMat, "accent", [-0.1, 0, 0.013], [0, 0, Math.PI / 4]);
    addMesh(THREE, g, new THREE.BoxGeometry(0.022, 0.13, 0.005), secMat, "secondary", [0.02, 0, 0.013]);
  } else if (o.variant === 1) {
    // Vertical swallowtail hanging banner on wooden dowel
    addMesh(THREE, g, new THREE.CylinderGeometry(0.009, 0.009, 0.36, 10), woodMat, "wood", [0, 0.22, 0.015], [0, 0, Math.PI / 2]);
    const s = new THREE.Shape();
    s.moveTo(-0.15, 0.21);
    s.lineTo(0.15, 0.21);
    s.lineTo(0.15, -0.14);
    s.lineTo(0, -0.24);
    s.lineTo(-0.15, -0.14);
    s.closePath();
    addMesh(THREE, g, new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: false }), primMat, "primary", [0, 0, 0.006]);
    addMesh(THREE, g, new THREE.CircleGeometry(0.055, 18), accMat, "accent", [0, 0.06, 0.016]);
    addMesh(THREE, g, new THREE.BoxGeometry(0.24, 0.026, 0.004), secMat, "secondary", [0, -0.06, 0.015]);
  } else {
    // Mini triangular bunting garland (5 flags)
    const pts = [new THREE.Vector3(-0.34, 0.08, 0.012), new THREE.Vector3(0, 0.01, 0.015), new THREE.Vector3(0.34, 0.08, 0.012)];
    const curve = new THREE.CatmullRomCurve3(pts);
    addMesh(THREE, g, new THREE.TubeGeometry(curve, 16, 0.003, 6, false), woodMat, "wood");
    const tri = new THREE.Shape();
    tri.moveTo(-0.05, 0);
    tri.lineTo(0.05, 0);
    tri.lineTo(0, -0.11);
    tri.closePath();
    const triGeo = new THREE.ExtrudeGeometry(tri, { depth: 0.005, bevelEnabled: false });
    const mats = [[primMat, "primary"], [secMat, "secondary"], [accMat, "accent"]];
    for (let i = 0; i < 5; i++) {
      const p = curve.getPoint((i + 0.5) / 5);
      const [m, sl] = mats[i % 3];
      addMesh(THREE, g, triGeo, m, sl, [p.x, p.y, p.z]);
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// 25. POLAROID STRING (wall)
// ---------------------------------------------------------------------------
function polaroidString(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const cordMat = makeMat(THREE, o, "wood");
  const metalMat = makeMat(THREE, o, "metal");
  const cardMat = makeFixedMat(THREE, 0xf7f4ec, { roughness: 0.8 });
  const artMats = [
    [makeMat(THREE, o, "primary", { roughness: 0.65 }), "primary"],
    [makeMat(THREE, o, "accent", { roughness: 0.65 }), "accent"],
    [makeMat(THREE, o, "secondary", { roughness: 0.65 }), "secondary"],
  ];

  function addCard(x, y, z, rz, idx) {
    const cg = new THREE.Group();
    cg.position.set(x, y, z);
    cg.rotation.z = rz;
    addMesh(THREE, cg, new THREE.BoxGeometry(0.11, 0.135, 0.004), cardMat, null);
    const [am, sl] = artMats[idx % 3];
    addMesh(THREE, cg, new THREE.BoxGeometry(0.092, 0.092, 0.005), am, sl, [0, 0.012, 0.001]);
    addMesh(THREE, cg, new THREE.BoxGeometry(0.012, 0.026, 0.012), cordMat, "wood", [0, 0.07, 0.004]);
    g.add(cg);
  }

  if (o.variant === 0) {
    // Single draped twine with 6 photos
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.62, 0.12, 0.012),
      new THREE.Vector3(0, -0.02, 0.02),
      new THREE.Vector3(0.62, 0.12, 0.012),
    ]);
    addMesh(THREE, g, new THREE.TubeGeometry(curve, 18, 0.003, 6, false), cordMat, "wood");
    for (let i = 0; i < 6; i++) {
      const p = curve.getPoint((i + 0.5) / 6);
      addCard(p.x, p.y - 0.072, p.z, ((i % 2) * 2 - 1) * 0.09, i);
    }
  } else if (o.variant === 1) {
    // Two parallel strings with 8 photos
    for (let row = 0; row < 2; row++) {
      const ry = row === 0 ? 0.18 : -0.06;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.56, ry, 0.012),
        new THREE.Vector3(0, ry - 0.05, 0.018),
        new THREE.Vector3(0.56, ry, 0.012),
      ]);
      addMesh(THREE, g, new THREE.TubeGeometry(curve, 16, 0.003, 6, false), cordMat, "wood");
      for (let i = 0; i < 4; i++) {
        const p = curve.getPoint((i + 0.5) / 4);
        addCard(p.x, p.y - 0.07, p.z, ((i + row) % 2 ? 1 : -1) * 0.07, i + row * 4);
      }
    }
  } else {
    // Wire grid memo board with clipped photos
    for (let i = -3; i <= 3; i++) {
      addMesh(THREE, g, new THREE.CylinderGeometry(0.003, 0.003, 0.44, 6), metalMat, "metal", [i * 0.1, 0, 0.012]);
    }
    for (let j = -2; j <= 2; j++) {
      addMesh(THREE, g, new THREE.CylinderGeometry(0.003, 0.003, 0.62, 6), metalMat, "metal", [0, j * 0.11, 0.012], [0, 0, Math.PI / 2]);
    }
    const spots = [[-0.2, 0.1, 0.08], [0.02, 0.11, -0.05], [0.22, 0.08, 0.04], [-0.12, -0.1, -0.07], [0.14, -0.09, 0.06]];
    spots.forEach((sp, idx) => addCard(sp[0], sp[1], 0.02, sp[2], idx));
  }
  return g;
}

// ---------------------------------------------------------------------------
// 26. NEON SIGN (wall, abstract shape only, with "glow" PointLight)
// ---------------------------------------------------------------------------
function neonSign(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  g.userData.glowFollowsSlot = "accent";
  const backMat = makeFixedMat(THREE, 0x20242c, { transparent: true, opacity: 0.35, roughness: 0.2 });
  const neonMat = makeMat(THREE, o, "accent", {
    emissive: new THREE.Color(o.accent),
    emissiveIntensity: 1.8,
    roughness: 0.2,
    metalness: 0.0,
  });

  // Subtle translucent acrylic backing plate
  addMesh(THREE, g, bevelBox(THREE, 0.5, 0.48, 0.012, 0.05, 0.003), backMat, null, [0, 0, 0.01]);

  let pts = [];
  if (o.variant === 0) {
    // Heart curve
    for (let i = 0; i < 32; i++) {
      const t = (i / 32) * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(t), 3) * 0.012;
      const y = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 0.012 + 0.02;
      pts.push(new THREE.Vector3(x, y, 0.032));
    }
  } else if (o.variant === 1) {
    // 5-pointed star
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const rad = i % 2 === 0 ? 0.21 : 0.09;
      pts.push(new THREE.Vector3(Math.cos(a) * rad, Math.sin(a) * rad, 0.032));
    }
  } else {
    // Lightning bolt
    const raw = [
      [0.04, 0.21], [-0.11, 0.01], [0.01, 0.01],
      [-0.05, -0.21], [0.12, 0.03], [0.0, 0.03],
    ];
    pts = raw.map((p) => new THREE.Vector3(p[0], p[1], 0.032));
  }

  const curve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", o.variant === 0 ? 0.5 : 0.05);
  const tube = addMesh(THREE, g, new THREE.TubeGeometry(curve, 64, 0.013, 10, true), neonMat, "accent");
  tube.userData.emissiveMatch = true;
  addGlow(THREE, g, o.accent, 0.75, 2.8, [0, 0, 0.22]);
  return g;
}

// ---------------------------------------------------------------------------
// 27. WINDOW PLANTER (surface)
// ---------------------------------------------------------------------------
function windowPlanter(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const primMat = makeMat(THREE, o, "primary", { roughness: 0.72 });
  const secMat = makeMat(THREE, o, "secondary", { roughness: 0.65 });
  const accMat = makeMat(THREE, o, "accent", { roughness: 0.6 });
  const woodMat = makeMat(THREE, o, "wood");
  const soilMat = makeFixedMat(THREE, 0x3b2c20, { roughness: 0.95 });

  if (o.variant === 0) {
    // Rectangular planter box with blossoms
    addMesh(THREE, g, bevelBox(THREE, 0.58, 0.16, 0.2, 0.03, 0.01), primMat, "primary", [0, 0.08, 0]);
    addMesh(THREE, g, bevelBox(THREE, 0.61, 0.028, 0.22, 0.03, 0.008), primMat, "primary", [0, 0.16, 0]);
    addMesh(THREE, g, new THREE.BoxGeometry(0.52, 0.02, 0.15), soilMat, null, [0, 0.16, 0]);
    for (const px of [-0.18, 0, 0.18]) {
      addLeafCluster(THREE, g, [px, 0.18, 0], 1.4, 0x4c7e47, 8);
      addMesh(THREE, g, new THREE.SphereGeometry(0.024, 10, 8), accMat, "accent", [px + 0.02, 0.25, 0.02]);
      addMesh(THREE, g, new THREE.SphereGeometry(0.02, 10, 8), secMat, "secondary", [px - 0.03, 0.24, -0.02]);
    }
  } else if (o.variant === 1) {
    // Wooden slatted trough with trailing ivy
    addMesh(THREE, g, bevelBox(THREE, 0.6, 0.17, 0.2, 0.016, 0.006), woodMat, "wood", [0, 0.085, 0]);
    addMesh(THREE, g, new THREE.BoxGeometry(0.54, 0.02, 0.15), soilMat, null, [0, 0.165, 0]);
    for (const px of [-0.2, 0, 0.2]) {
      addLeafCluster(THREE, g, [px, 0.18, 0], 1.35, 0x447541, 7);
    }
    // Trailing vines over front edge
    const vineMat = makeFixedMat(THREE, 0x4b8047, { roughness: 0.72 });
    for (const vx of [-0.16, 0.04, 0.21]) {
      for (let j = 0; j < 4; j++) {
        addMesh(THREE, g, new THREE.SphereGeometry(0.02, 8, 6), vineMat, null, [vx + Math.sin(j) * 0.015, 0.15 - j * 0.04, 0.115], [0, 0, 0], [1, 0.7, 0.5]);
      }
    }
  } else {
    // Trio of ceramic pots on wooden tray
    addMesh(THREE, g, bevelBox(THREE, 0.6, 0.024, 0.2, 0.025, 0.006), woodMat, "wood", [0, 0.012, 0]);
    const pots = [[-0.19, primMat, "primary"], [0, secMat, "secondary"], [0.19, accMat, "accent"]];
    for (const [px, pm, sl] of pots) {
      addMesh(THREE, g, new THREE.CylinderGeometry(0.072, 0.056, 0.13, 16), pm, sl, [px, 0.085, 0]);
      addMesh(THREE, g, new THREE.CylinderGeometry(0.064, 0.064, 0.015, 14), soilMat, null, [px, 0.148, 0]);
      addLeafCluster(THREE, g, [px, 0.16, 0], 1.15, 0x52854d, 7);
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// 28. HANGING PLANT (ceiling-mounted at y = 0, hangs downward)
// ---------------------------------------------------------------------------
function hangingPlant(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const primMat = makeMat(THREE, o, "primary", { roughness: 0.65 });
  const secMat = makeMat(THREE, o, "secondary", { roughness: 0.85 });
  const metalMat = makeMat(THREE, o, "metal");
  const leafMat = makeFixedMat(THREE, 0x4c8048, { roughness: 0.72 });

  // Ceiling hook ring at y = 0
  addMesh(THREE, g, new THREE.TorusGeometry(0.018, 0.005, 8, 14), metalMat, "metal", [0, -0.015, 0]);

  if (o.variant === 0) {
    // Macramé 3-cord hanging round pot with trailing vines
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const curve = new THREE.LineCurve3(new THREE.Vector3(0, -0.02, 0), new THREE.Vector3(Math.cos(a) * 0.1, -0.48, Math.sin(a) * 0.1));
      addMesh(THREE, g, new THREE.TubeGeometry(curve, 4, 0.004, 6, false), secMat, "secondary");
    }
    const pot = latheFromPairs(THREE, [[0.01, 0], [0.08, 0.02], [0.11, 0.09], [0.1, 0.16]], 20);
    addMesh(THREE, g, pot, primMat, "primary", [0, -0.62, 0]);
    addLeafCluster(THREE, g, [0, -0.46, 0], 1.5, 0x4c8048, 9);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      for (let j = 0; j < 5; j++) {
        addMesh(THREE, g, new THREE.SphereGeometry(0.022, 8, 6), leafMat, null, [
          Math.cos(a) * (0.11 + j * 0.008),
          -0.48 - j * 0.055,
          Math.sin(a) * (0.11 + j * 0.008),
        ], [0, a, 0], [1, 0.7, 0.4]);
      }
    }
  } else if (o.variant === 1) {
    // Metal hoop hanger with conical pot & spider plant leaves
    addMesh(THREE, g, new THREE.CylinderGeometry(0.004, 0.004, 0.22, 6), metalMat, "metal", [0, -0.12, 0]);
    addMesh(THREE, g, new THREE.TorusGeometry(0.18, 0.007, 8, 28), metalMat, "metal", [0, -0.41, 0]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.095, 0.055, 0.14, 18), secMat, "secondary", [0, -0.5, 0]);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const blade = new THREE.CapsuleGeometry(0.012, 0.16, 4, 6);
      const m = addMesh(THREE, g, blade, leafMat, null, [Math.cos(a) * 0.08, -0.41, Math.sin(a) * 0.08]);
      m.rotation.set(Math.sin(a) * 1.15, a, -Math.cos(a) * 1.15);
    }
  } else {
    // Woven bowl with string-of-pearls
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const curve = new THREE.LineCurve3(new THREE.Vector3(0, -0.02, 0), new THREE.Vector3(Math.cos(a) * 0.12, -0.46, Math.sin(a) * 0.12));
      addMesh(THREE, g, new THREE.TubeGeometry(curve, 4, 0.003, 6, false), metalMat, "metal");
    }
    const bowl = latheFromPairs(THREE, [[0.01, 0], [0.09, 0.01], [0.13, 0.06], [0.125, 0.11]], 20);
    addMesh(THREE, g, bowl, makeMat(THREE, o, "wood"), "wood", [0, -0.56, 0]);
    const pearlGeo = new THREE.SphereGeometry(0.013, 8, 8);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const len = 4 + (i % 3);
      for (let j = 0; j < len; j++) {
        addMesh(THREE, g, pearlGeo, leafMat, null, [Math.cos(a) * 0.125, -0.46 - j * 0.036, Math.sin(a) * 0.125]);
      }
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// 29. CACTUS (surface)
// ---------------------------------------------------------------------------
function cactus(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const potMat = makeMat(THREE, o, "accent", { roughness: 0.78 });
  const primMat = makeMat(THREE, o, "primary", { roughness: 0.65 });
  const secMat = makeMat(THREE, o, "secondary", { roughness: 0.65 });
  const soilMat = makeFixedMat(THREE, 0x453526, { roughness: 0.95 });
  const greenMat = makeFixedMat(THREE, 0x4d8250, { roughness: 0.8 });

  if (o.variant === 0) {
    // Saguaro column cactus with 2 arms & tiny flower
    addMesh(THREE, g, new THREE.CylinderGeometry(0.085, 0.065, 0.13, 18), potMat, "accent", [0, 0.065, 0]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.092, 0.088, 0.025, 18), potMat, "accent", [0, 0.125, 0]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.076, 0.076, 0.01, 16), soilMat, null, [0, 0.132, 0]);
    addMesh(THREE, g, new THREE.CapsuleGeometry(0.036, 0.22, 8, 12), greenMat, null, [0, 0.26, 0]);
    addMesh(THREE, g, new THREE.CapsuleGeometry(0.024, 0.09, 6, 10), greenMat, null, [0.062, 0.28, 0], [0, 0, -0.35]);
    addMesh(THREE, g, new THREE.CapsuleGeometry(0.022, 0.07, 6, 10), greenMat, null, [-0.058, 0.24, 0.01], [0, 0, 0.4]);
    addMesh(THREE, g, new THREE.SphereGeometry(0.018, 10, 8), secMat, "secondary", [0.01, 0.4, 0]);
  } else if (o.variant === 1) {
    // Plump barrel cactus cluster in wide ceramic bowl
    const bowl = latheFromPairs(THREE, [[0.01, 0], [0.08, 0.01], [0.115, 0.05], [0.105, 0.1]], 20);
    addMesh(THREE, g, bowl, primMat, "primary");
    addMesh(THREE, g, new THREE.SphereGeometry(0.068, 14, 12), greenMat, null, [-0.02, 0.14, 0]);
    addMesh(THREE, g, new THREE.SphereGeometry(0.044, 12, 10), greenMat, null, [0.05, 0.12, 0.03]);
    addMesh(THREE, g, new THREE.SphereGeometry(0.035, 10, 8), greenMat, null, [0.03, 0.115, -0.045]);
  } else {
    // Prickly-pear paddle cactus in footed planter
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      addMesh(THREE, g, new THREE.CylinderGeometry(0.01, 0.008, 0.04, 8), makeMat(THREE, o, "wood"), "wood", [Math.cos(a) * 0.06, 0.02, Math.sin(a) * 0.06]);
    }
    addMesh(THREE, g, new THREE.CylinderGeometry(0.08, 0.075, 0.11, 18), primMat, "primary", [0, 0.09, 0]);
    const padGeo = new THREE.SphereGeometry(0.052, 12, 10);
    padGeo.scale(1.0, 1.35, 0.34);
    addMesh(THREE, g, padGeo, greenMat, null, [0, 0.2, 0]);
    addMesh(THREE, g, padGeo, greenMat, null, [0.05, 0.3, 0.01], [0, 0.3, -0.35], [0.75, 0.75, 0.75]);
    addMesh(THREE, g, padGeo, greenMat, null, [-0.045, 0.29, -0.01], [0, -0.25, 0.4], [0.68, 0.68, 0.68]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 30. BONSAI (surface)
// ---------------------------------------------------------------------------
function bonsai(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const potMat = makeMat(THREE, o, "primary", { roughness: 0.45 });
  const barkMat = makeFixedMat(THREE, 0x5c4330, { roughness: 0.9 });
  const mossMat = makeFixedMat(THREE, 0x5a8544, { roughness: 0.92 });
  const leafMat = makeFixedMat(THREE, 0x3f7041, { roughness: 0.78 });
  const blossomMat = makeMat(THREE, o, "accent", { roughness: 0.78 });

  if (o.variant === 0) {
    // Classic windswept bonsai in shallow rectangular tray
    addMesh(THREE, g, bevelBox(THREE, 0.3, 0.07, 0.21, 0.025, 0.008), potMat, "primary", [0, 0.035, 0]);
    addMesh(THREE, g, new THREE.SphereGeometry(0.11, 14, 8), mossMat, null, [0, 0.06, 0], [0, 0, 0], [1.2, 0.35, 0.8]);
    const trunk = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.04, 0.06, 0),
      new THREE.Vector3(-0.02, 0.16, 0.01),
      new THREE.Vector3(0.05, 0.25, -0.01),
      new THREE.Vector3(0.01, 0.33, 0),
    ]);
    addMesh(THREE, g, new THREE.TubeGeometry(trunk, 16, 0.018, 8, false), barkMat, null);
    const pads = [[0.01, 0.35, 0, 0.095], [0.1, 0.27, 0.02, 0.075], [-0.08, 0.24, -0.02, 0.065]];
    for (const [x, y, z, r] of pads) {
      addMesh(THREE, g, new THREE.SphereGeometry(r, 12, 10), leafMat, null, [x, y, z], [0, 0, 0], [1.3, 0.55, 1.0]);
    }
  } else if (o.variant === 1) {
    // Cherry-blossom bonsai in oval pot
    const pot = new THREE.CylinderGeometry(0.12, 0.1, 0.08, 20);
    pot.scale(1.25, 1, 0.85);
    addMesh(THREE, g, pot, potMat, "primary", [0, 0.04, 0]);
    const t1 = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.07, 0), new THREE.Vector3(-0.03, 0.18, 0), new THREE.Vector3(-0.08, 0.29, 0.02)]);
    const t2 = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.02, 0.16, 0), new THREE.Vector3(0.06, 0.25, -0.02)]);
    addMesh(THREE, g, new THREE.TubeGeometry(t1, 14, 0.016, 8, false), barkMat, null);
    addMesh(THREE, g, new THREE.TubeGeometry(t2, 10, 0.012, 8, false), barkMat, null);
    for (const [x, y, z, r] of [[-0.08, 0.31, 0.02, 0.085], [0.07, 0.27, -0.02, 0.075], [0.0, 0.34, -0.01, 0.065]]) {
      addMesh(THREE, g, new THREE.SphereGeometry(r, 12, 10), blossomMat, "accent", [x, y, z], [0, 0, 0], [1.25, 0.65, 1.0]);
    }
  } else {
    // Cascade bonsai in taller square pot
    addMesh(THREE, g, bevelBox(THREE, 0.16, 0.14, 0.16, 0.02, 0.008), potMat, "primary", [-0.04, 0.07, 0]);
    const cascade = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.04, 0.13, 0),
      new THREE.Vector3(-0.02, 0.24, 0),
      new THREE.Vector3(0.08, 0.22, 0.02),
      new THREE.Vector3(0.14, 0.1, 0.02),
    ]);
    addMesh(THREE, g, new THREE.TubeGeometry(cascade, 18, 0.015, 8, false), barkMat, null);
    for (const [x, y, z, r] of [[-0.02, 0.26, 0, 0.075], [0.09, 0.22, 0.02, 0.065], [0.15, 0.11, 0.02, 0.055]]) {
      addMesh(THREE, g, new THREE.SphereGeometry(r, 12, 10), leafMat, null, [x, y, z], [0, 0, 0], [1.2, 0.55, 0.95]);
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// 31. FISH TANK (surface, with "glow" PointLight)
// ---------------------------------------------------------------------------
function fishTank(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const metalMat = makeMat(THREE, o, "metal");
  const woodMat = makeMat(THREE, o, "wood");
  const fishMat = makeMat(THREE, o, "accent", { roughness: 0.35 });
  const gravelMat = makeFixedMat(THREE, 0xc7b79c, { roughness: 0.95 });
  const glassMat = makeFixedMat(THREE, 0x9ad8f0, { transparent: true, opacity: 0.28, roughness: 0.08, metalness: 0.1 });
  const waterMat = makeFixedMat(THREE, 0x4db6d9, { transparent: true, opacity: 0.32, roughness: 0.1, emissive: 0x26799c, emissiveIntensity: 0.45 });
  const ledMat = makeFixedMat(THREE, 0xdff7ff, { emissive: 0x99e6ff, emissiveIntensity: 1.5 });

  function addFish(x, y, z, ry) {
    const fg = new THREE.Group();
    fg.position.set(x, y, z);
    fg.rotation.y = ry;
    addMesh(THREE, fg, new THREE.SphereGeometry(0.018, 10, 8), fishMat, "accent", [0, 0, 0], [0, 0, 0], [1.4, 0.85, 0.55]);
    addMesh(THREE, fg, new THREE.ConeGeometry(0.014, 0.022, 6), fishMat, "accent", [-0.028, 0, 0], [0, 0, -Math.PI / 2]);
    g.add(fg);
  }

  if (o.variant === 0) {
    // Rimless rectangular aquarium with overhead LED bar
    addMesh(THREE, g, new THREE.BoxGeometry(0.54, 0.016, 0.28), metalMat, "metal", [0, 0.008, 0]);
    addMesh(THREE, g, new THREE.BoxGeometry(0.51, 0.036, 0.25), gravelMat, null, [0, 0.034, 0]);
    addMesh(THREE, g, new THREE.BoxGeometry(0.52, 0.27, 0.26), waterMat, null, [0, 0.18, 0]);
    addMesh(THREE, g, new THREE.BoxGeometry(0.54, 0.32, 0.28), glassMat, null, [0, 0.176, 0]);
    // Rocks + plants + fish
    addMesh(THREE, g, new THREE.DodecahedronGeometry(0.045, 0), makeFixedMat(THREE, 0x6b6f73), null, [-0.14, 0.06, -0.03]);
    addLeafCluster(THREE, g, [0.15, 0.07, -0.04], 1.3, 0x3b8c59, 6);
    addFish(-0.04, 0.2, 0.02, 0.2);
    addFish(0.1, 0.16, -0.02, -2.6);
    // Overhead LED bar
    addMesh(THREE, g, bevelBox(THREE, 0.42, 0.016, 0.05, 0.006, 0.002), metalMat, "metal", [0, 0.38, 0]);
    addMesh(THREE, g, new THREE.BoxGeometry(0.36, 0.006, 0.03), ledMat, null, [0, 0.37, 0]);
    addGlow(THREE, g, 0x7ad9f5, 0.6, 2.4, [0, 0.22, 0.12]);
  } else if (o.variant === 1) {
    // Classic round glass fishbowl on wooden coaster
    addMesh(THREE, g, new THREE.CylinderGeometry(0.11, 0.12, 0.02, 20), woodMat, "wood", [0, 0.01, 0]);
    addMesh(THREE, g, new THREE.SphereGeometry(0.15, 22, 18), glassMat, null, [0, 0.15, 0]);
    addMesh(THREE, g, new THREE.SphereGeometry(0.138, 20, 14), waterMat, null, [0, 0.14, 0]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.08, 0.06, 0.025, 16), gravelMat, null, [0, 0.04, 0]);
    addFish(-0.03, 0.16, 0.02, 0.4);
    addFish(0.04, 0.13, -0.02, -2.5);
    addGlow(THREE, g, 0x7ad9f5, 0.45, 2.0, [0, 0.16, 0.08]);
  } else {
    // Tall desktop nano-tank with hood & bubble column
    addMesh(THREE, g, new THREE.CylinderGeometry(0.15, 0.15, 0.03, 6), metalMat, "metal", [0, 0.015, 0]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.145, 0.145, 0.34, 6), glassMat, null, [0, 0.2, 0]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.135, 0.135, 0.3, 6), waterMat, null, [0, 0.19, 0]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.155, 0.155, 0.036, 6), metalMat, "metal", [0, 0.38, 0]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.1, 0.1, 0.008, 6), ledMat, null, [0, 0.358, 0]);
    addFish(0.02, 0.22, 0.02, 0.5);
    addFish(-0.04, 0.15, -0.02, -2.4);
    const bubMat = makeFixedMat(THREE, 0xe8f9ff, { transparent: true, opacity: 0.7 });
    for (let i = 0; i < 4; i++) {
      addMesh(THREE, g, new THREE.SphereGeometry(0.008 + (i % 2) * 0.003, 8, 8), bubMat, null, [-0.06, 0.08 + i * 0.065, 0.03]);
    }
    addGlow(THREE, g, 0x7ad9f5, 0.55, 2.2, [0, 0.22, 0.08]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 32. PET BED
// ---------------------------------------------------------------------------
function petBed(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const fab1 = makeMat(THREE, o, "primary", { roughness: 0.94, metalness: 0.0 });
  const fab2 = makeMat(THREE, o, "secondary", { roughness: 0.94, metalness: 0.0 });
  const fabAcc = makeMat(THREE, o, "accent", { roughness: 0.88, metalness: 0.0 });
  const woodMat = makeMat(THREE, o, "wood");

  if (o.variant === 0) {
    // Oval bolstered donut pet bed + mini toy
    const rim = new THREE.TorusGeometry(0.25, 0.08, 14, 28);
    rim.scale(1.18, 0.92, 1.0);
    addMesh(THREE, g, rim, fab1, "primary", [0, 0.08, 0], [Math.PI / 2, 0, 0]);
    const pad = new THREE.CylinderGeometry(0.23, 0.23, 0.07, 22);
    pad.scale(1.16, 1, 0.9);
    addMesh(THREE, g, pad, fab2, "secondary", [0, 0.045, 0]);
    addMesh(THREE, g, new THREE.CapsuleGeometry(0.022, 0.08, 6, 8), fabAcc, "accent", [0.1, 0.095, 0.04], [0, 0.5, Math.PI / 2]);
  } else if (o.variant === 1) {
    // Round fluffy marshmallow puff bed
    addMesh(THREE, g, new THREE.CylinderGeometry(0.26, 0.27, 0.08, 22), fab2, "secondary", [0, 0.04, 0]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      addMesh(THREE, g, new THREE.SphereGeometry(0.105, 12, 10), fab1, "primary", [Math.cos(a) * 0.22, 0.095, Math.sin(a) * 0.22], [0, 0, 0], [1, 0.85, 1]);
    }
  } else {
    // Elevated mid-century wooden pet cot
    for (const sx of [-0.26, 0.26]) {
      for (const sz of [-0.18, 0.18]) {
        addLeg(THREE, g, woodMat, "wood", sx, sz, 0.12, 0.018, 0.013, sx * 0.12, 0);
      }
    }
    addMesh(THREE, g, bevelBox(THREE, 0.64, 0.05, 0.46, 0.04, 0.01), woodMat, "wood", [0, 0.13, 0]);
    addMesh(THREE, g, bevelBox(THREE, 0.62, 0.16, 0.04, 0.02, 0.008), woodMat, "wood", [0, 0.23, -0.21]);
    addMesh(THREE, g, bevelBox(THREE, 0.56, 0.09, 0.38, 0.04, 0.02), fab1, "primary", [0, 0.19, 0.01]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 33. PET BOWL
// ---------------------------------------------------------------------------
function petBowl(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const woodMat = makeMat(THREE, o, "wood");
  const primMat = makeMat(THREE, o, "primary", { roughness: 0.35 });
  const secMat = makeMat(THREE, o, "secondary", { roughness: 0.7 });
  const accMat = makeMat(THREE, o, "accent", { roughness: 0.35 });
  const steelMat = makeMat(THREE, o, "metal", { roughness: 0.2, metalness: 0.88 });
  const waterMat = makeFixedMat(THREE, 0x6ac3e8, { transparent: true, opacity: 0.65, roughness: 0.1 });
  const kibbleMat = makeFixedMat(THREE, 0x6b472a, { roughness: 0.92 });

  if (o.variant === 0) {
    // Raised wooden double-bowl feeder
    addMesh(THREE, g, bevelBox(THREE, 0.36, 0.025, 0.18, 0.025, 0.006), woodMat, "wood", [0, 0.085, 0]);
    for (const sx of [-0.15, 0.15]) {
      addMesh(THREE, g, bevelBox(THREE, 0.024, 0.08, 0.16, 0.01, 0.004), woodMat, "wood", [sx, 0.04, 0]);
    }
    for (const sx of [-0.085, 0.085]) {
      addMesh(THREE, g, new THREE.CylinderGeometry(0.068, 0.056, 0.055, 18), steelMat, "metal", [sx, 0.075, 0]);
    }
    addMesh(THREE, g, new THREE.SphereGeometry(0.056, 12, 8), kibbleMat, null, [-0.085, 0.095, 0], [0, 0, 0], [1, 0.32, 1]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.058, 0.058, 0.008, 16), waterMat, null, [0.085, 0.096, 0]);
  } else if (o.variant === 1) {
    // Single chunky ceramic bowl on silicone mat
    addMesh(THREE, g, bevelBox(THREE, 0.28, 0.008, 0.22, 0.05, 0.003), secMat, "secondary", [0, 0.004, 0]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.082, 0.09, 0.068, 22), primMat, "primary", [0, 0.042, 0]);
    addMesh(THREE, g, new THREE.TorusGeometry(0.082, 0.009, 8, 22), accMat, "accent", [0, 0.074, 0], [Math.PI / 2, 0, 0]);
    addMesh(THREE, g, new THREE.SphereGeometry(0.066, 12, 8), kibbleMat, null, [0, 0.065, 0], [0, 0, 0], [1, 0.35, 1]);
  } else {
    // Gravity dispenser + bowl on tray
    addMesh(THREE, g, bevelBox(THREE, 0.36, 0.016, 0.2, 0.03, 0.004), secMat, "secondary", [0, 0.008, 0]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.058, 0.062, 0.16, 18), makeFixedMat(THREE, 0xcceeff, { transparent: true, opacity: 0.45 }), null, [-0.09, 0.13, -0.02]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.064, 0.068, 0.05, 18), primMat, "primary", [-0.09, 0.035, 0.02]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.072, 0.066, 0.056, 18), accMat, "accent", [0.09, 0.042, 0.01]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 34. FLOOR CUSHION
// ---------------------------------------------------------------------------
function floorCushion(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const fab1 = makeMat(THREE, o, "primary", { roughness: 0.92, metalness: 0.0 });
  const fab2 = makeMat(THREE, o, "secondary", { roughness: 0.92, metalness: 0.0 });
  const fabAcc = makeMat(THREE, o, "accent", { roughness: 0.88, metalness: 0.0 });

  if (o.variant === 0) {
    // Round pleated pouf cushion with center button tuft
    const body = latheFromPairs(THREE, [
      [0.01, 0.0], [0.24, 0.01], [0.3, 0.07], [0.29, 0.14], [0.22, 0.175], [0.06, 0.155], [0.01, 0.14],
    ], 24);
    addMesh(THREE, g, body, fab1, "primary");
    addMesh(THREE, g, new THREE.CylinderGeometry(0.026, 0.026, 0.018, 14), fabAcc, "accent", [0, 0.152, 0]);
  } else if (o.variant === 1) {
    // Square tufted floor pillow with corner tassels
    addMesh(THREE, g, bevelBox(THREE, 0.56, 0.14, 0.56, 0.09, 0.045, 6), fab1, "primary", [0, 0.07, 0]);
    for (const sx of [-0.27, 0.27]) {
      for (const sz of [-0.27, 0.27]) {
        addMesh(THREE, g, new THREE.SphereGeometry(0.024, 10, 8), fabAcc, "accent", [sx, 0.055, sz]);
      }
    }
  } else {
    // Stacked pair of round cushions
    const c1 = new THREE.CylinderGeometry(0.28, 0.29, 0.1, 24);
    addMesh(THREE, g, c1, fab1, "primary", [-0.02, 0.05, 0]);
    const c2 = new THREE.CylinderGeometry(0.25, 0.26, 0.09, 24);
    addMesh(THREE, g, c2, fab2, "secondary", [0.03, 0.145, 0.02], [0.03, 0.2, -0.02]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// 35. CURTAIN SET (wall)
// ---------------------------------------------------------------------------
function curtainSet(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const fab1 = makeMat(THREE, o, "primary", { roughness: 0.9, metalness: 0.0 });
  const fab2 = makeMat(THREE, o, "secondary", { roughness: 0.85, transparent: true, opacity: 0.72 });
  const fabAcc = makeMat(THREE, o, "accent", { roughness: 0.88 });
  const metalMat = makeMat(THREE, o, "metal");
  const woodMat = makeMat(THREE, o, "wood");

  function addPleatedPanel(x, y, h, folds, wStep, mat, slot, gather = false) {
    const pg = new THREE.Group();
    pg.position.set(x, y, 0.075);
    for (let i = 0; i < folds; i++) {
      const fx = (i - (folds - 1) * 0.5) * wStep;
      const fz = (i % 2 === 0 ? 1 : -1) * 0.018;
      const geo = new THREE.CylinderGeometry(wStep * 0.55, gather ? wStep * 0.72 : wStep * 0.58, h, 10);
      addMesh(THREE, pg, geo, mat, slot, [fx, 0, fz]);
    }
    g.add(pg);
  }

  // Curtain rod + brackets
  const rodMat = o.variant === 0 ? metalMat : woodMat;
  const rodSlot = o.variant === 0 ? "metal" : "wood";
  addMesh(THREE, g, new THREE.CylinderGeometry(0.013, 0.013, 1.62, 12), rodMat, rodSlot, [0, 0.82, 0.075], [0, 0, Math.PI / 2]);
  for (const sx of [-0.82, 0.82]) {
    addMesh(THREE, g, new THREE.SphereGeometry(0.026, 12, 10), rodMat, rodSlot, [sx, 0.82, 0.075]);
    addMesh(THREE, g, new THREE.CylinderGeometry(0.008, 0.008, 0.08, 8), rodMat, rodSlot, [sx * 0.9, 0.82, 0.038], [Math.PI / 2, 0, 0]);
  }

  if (o.variant === 0) {
    // Full-length twin curtains with accent tiebacks
    addPleatedPanel(-0.56, -0.02, 1.66, 5, 0.056, fab1, "primary", true);
    addPleatedPanel(0.56, -0.02, 1.66, 5, 0.056, fab1, "primary", true);
    for (const sx of [-0.56, 0.56]) {
      addMesh(THREE, g, new THREE.TorusGeometry(0.12, 0.016, 8, 18), fabAcc, "accent", [sx, -0.18, 0.075], [Math.PI / 2, 0, 0], [1.2, 0.45, 1]);
    }
  } else if (o.variant === 1) {
    // Layered sheer + outer panels
    addPleatedPanel(-0.6, -0.02, 1.66, 4, 0.058, fab1, "primary");
    addPleatedPanel(0.6, -0.02, 1.66, 4, 0.058, fab1, "primary");
    addPleatedPanel(-0.28, -0.02, 1.64, 4, 0.052, fab2, "secondary");
    addPleatedPanel(0.28, -0.02, 1.64, 4, 0.052, fab2, "secondary");
  } else {
    // Cozy café valance + short curtains
    addMesh(THREE, g, bevelBox(THREE, 1.48, 0.24, 0.05, 0.02, 0.008), fabAcc, "accent", [0, 0.7, 0.08]);
    addPleatedPanel(-0.54, 0.14, 1.06, 5, 0.058, fab1, "primary");
    addPleatedPanel(0.54, 0.14, 1.06, 5, 0.058, fab1, "primary");
  }
  return g;
}

// ---------------------------------------------------------------------------
// 36. CEILING FAN LIGHT (ceiling-mounted at y = 0, hangs downward, with "glow")
// ---------------------------------------------------------------------------
function ceilingFanLight(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const woodMat = makeMat(THREE, o, "wood");
  const metalMat = makeMat(THREE, o, "metal", { roughness: 0.28, metalness: 0.75 });
  const primMat = makeMat(THREE, o, "primary");
  const globeMat = makeFixedMat(THREE, 0xfff4dc, { emissive: 0xffd99c, emissiveIntensity: 1.2, roughness: 0.25 });

  // Ceiling canopy & downrod
  addMesh(THREE, g, new THREE.CylinderGeometry(0.08, 0.06, 0.04, 18), metalMat, "metal", [0, -0.02, 0]);
  addMesh(THREE, g, new THREE.CylinderGeometry(0.015, 0.015, 0.16, 10), metalMat, "metal", [0, -0.1, 0]);

  if (o.variant === 0) {
    // Classic 4-blade wood fan with frosted globe light
    addMesh(THREE, g, new THREE.CylinderGeometry(0.11, 0.11, 0.08, 22), metalMat, "metal", [0, -0.2, 0]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const blade = addMesh(THREE, g, bevelBox(THREE, 0.44, 0.012, 0.12, 0.03, 0.003), woodMat, "wood", [Math.cos(a) * 0.3, -0.2, Math.sin(a) * 0.3]);
      blade.rotation.set(0.1, -a, 0);
    }
    addMesh(THREE, g, new THREE.SphereGeometry(0.095, 18, 14), globeMat, null, [0, -0.3, 0], [0, 0, 0], [1, 0.78, 1]);
    addGlow(THREE, g, 0xffe0aa, 0.85, 4.2, [0, -0.36, 0]);
  } else if (o.variant === 1) {
    // Modern 3-blade sleek fan with integrated LED disc
    addMesh(THREE, g, new THREE.CylinderGeometry(0.1, 0.1, 0.07, 22), primMat, "primary", [0, -0.2, 0]);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const blade = addMesh(THREE, g, bevelBox(THREE, 0.46, 0.014, 0.11, 0.04, 0.004), primMat, "primary", [Math.cos(a) * 0.3, -0.2, Math.sin(a) * 0.3]);
      blade.rotation.set(0.12, -a, 0);
    }
    addMesh(THREE, g, new THREE.CylinderGeometry(0.1, 0.09, 0.03, 22), globeMat, null, [0, -0.25, 0]);
    addGlow(THREE, g, 0xfff0d4, 0.85, 4.2, [0, -0.32, 0]);
  } else {
    // Industrial caged "fandelier" with 3 warm bulbs
    addMesh(THREE, g, new THREE.TorusGeometry(0.24, 0.01, 8, 26), metalMat, "metal", [0, -0.18, 0], [Math.PI / 2, 0, 0]);
    addMesh(THREE, g, new THREE.TorusGeometry(0.24, 0.01, 8, 26), metalMat, "metal", [0, -0.36, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      addMesh(THREE, g, new THREE.CylinderGeometry(0.005, 0.005, 0.18, 6), metalMat, "metal", [Math.cos(a) * 0.24, -0.27, Math.sin(a) * 0.24]);
    }
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      addMesh(THREE, g, bevelBox(THREE, 0.16, 0.01, 0.06, 0.02, 0.002), woodMat, "wood", [Math.cos(a) * 0.1, -0.24, Math.sin(a) * 0.1], [0.15, -a, 0]);
      addMesh(THREE, g, new THREE.SphereGeometry(0.028, 10, 10), globeMat, null, [Math.cos(a + 0.5) * 0.1, -0.31, Math.sin(a + 0.5) * 0.1]);
    }
    addGlow(THREE, g, 0xffd596, 0.85, 4.2, [0, -0.34, 0]);
  }
  return g;
}

// ---------------------------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------------------------
export const ITEMS = {
  sofa,
  beanbag,
  armchair,
  coffeeTable,
  sideTable,
  floorLamp,
  stringLights,
  miniFridge,
  microwaveCart,
  bookStack,
  lowBookcase,
  tv,
  gamingSetup,
  easel,
  keyboardPiano,
  guitarOnStand,
  yogaMat,
  bike,
  laundryBasket,
  coatRack,
  fullMirror,
  wallClock,
  wallShelf,
  pennant,
  polaroidString,
  neonSign,
  windowPlanter,
  hangingPlant,
  cactus,
  bonsai,
  fishTank,
  petBed,
  petBowl,
  floorCushion,
  curtainSet,
  ceilingFanLight,
};

export function recolor(group, palette) {
  if (!group || !palette) return group;
  group.traverse((obj) => {
    if (!obj.isMesh) return;
    const slot = obj.userData && obj.userData.slot;
    if (!slot || palette[slot] === undefined || palette[slot] === null) return;
    const col = palette[slot];
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (m && m.color) {
        m.color.set(col);
        if (obj.userData.emissiveMatch && m.emissive) {
          m.emissive.set(col);
        }
      }
    }
  });
  const glowSlot = group.userData && group.userData.glowFollowsSlot;
  if (glowSlot && palette[glowSlot] !== undefined && palette[glowSlot] !== null) {
    group.traverse((obj) => {
      if (obj.isPointLight && obj.name === "glow") {
        obj.color.set(palette[glowSlot]);
      }
    });
  }
  return group;
}

export const CATALOG = [
  { id: "sofa", name: "Dorm Sofa", kind: "seating", footprint: [1.65, 0.82], placement: "floor", variants: 3, note: "Loveseat, plush modern, or slatted futon" },
  { id: "beanbag", name: "Beanbag Chair", kind: "seating", footprint: [0.88, 0.88], placement: "floor", variants: 3, note: "Teardrop, wide pouf, or structured armchair" },
  { id: "armchair", name: "Reading Armchair", kind: "seating", footprint: [0.78, 0.78], placement: "floor", variants: 3, note: "Upholstered, wood-frame lounge, or swivel tub" },
  { id: "coffeeTable", name: "Coffee Table", kind: "table", footprint: [1.0, 0.55], placement: "floor", variants: 3, note: "Scandi shelf, hairpin oval, or nesting pair" },
  { id: "sideTable", name: "Side Table", kind: "table", footprint: [0.46, 0.46], placement: "floor", variants: 3, note: "Tripod tray, drawer nightstand, or C-table" },
  { id: "floorLamp", name: "Floor Lamp", kind: "lighting", footprint: [0.38, 0.38], placement: "floor", variants: 3, note: "Tripod drum, arched dome, or 3-globe tree; emits glow" },
  { id: "stringLights", name: "String Lights", kind: "lighting", footprint: [1.8, 0.12], placement: "wall", variants: 3, note: "Single swag, double festoon, or curtain drops; emits glow" },
  { id: "miniFridge", name: "Mini Fridge", kind: "appliance", footprint: [0.52, 0.54], placement: "floor", variants: 3, note: "Retro rounded, two-door, or glass beverage cooler" },
  { id: "microwaveCart", name: "Microwave Cart", kind: "appliance", footprint: [0.64, 0.44], placement: "floor", variants: 3, note: "Rolling wood cart, industrial wire, or cabinet cart" },
  { id: "bookStack", name: "Book Stack", kind: "decor", footprint: [0.24, 0.18], placement: "surface", variants: 3, note: "Neat stack, tall stack with orb, or bookend row" },
  { id: "lowBookcase", name: "Low Bookcase", kind: "storage", footprint: [1.1, 0.34], placement: "floor", variants: 3, note: "Mid-century 2-tier, 3x2 cubes, or ladder shelf" },
  { id: "tv", name: "Television", kind: "electronics", footprint: [0.88, 0.22], placement: "surface", variants: 3, note: "Slim V-feet, pedestal with soundbar, or retro CRT; emits glow" },
  { id: "gamingSetup", name: "Gaming Setup", kind: "electronics", footprint: [1.25, 0.65], placement: "floor", variants: 3, note: "Ultrawide + RGB tower, dual monitors, or console desk" },
  { id: "easel", name: "Artist Easel", kind: "hobby", footprint: [0.62, 0.68], placement: "floor", variants: 3, note: "A-frame tripod, H-frame studio, or stool mini easel" },
  { id: "keyboardPiano", name: "Keyboard Piano", kind: "hobby", footprint: [1.15, 0.42], placement: "floor", variants: 3, note: "Stage piano on X-stand, wood cabinet, or retro synth" },
  { id: "guitarOnStand", name: "Guitar on Stand", kind: "hobby", footprint: [0.42, 0.38], placement: "floor", variants: 3, note: "Acoustic guitar, electric guitar, or parlor ukulele" },
  { id: "yogaMat", name: "Yoga Mat", kind: "hobby", footprint: [0.65, 1.75], placement: "floor", variants: 3, note: "Unrolled with block, upright rolled, or half-unrolled" },
  { id: "bike", name: "Commuter Bike", kind: "hobby", footprint: [1.55, 0.52], placement: "floor", variants: 3, note: "Basket cruiser, fixie road bike, or folding bike" },
  { id: "laundryBasket", name: "Laundry Basket", kind: "storage", footprint: [0.46, 0.46], placement: "floor", variants: 3, note: "Woven rope hamper, X-frame canvas, or lidded bamboo" },
  { id: "coatRack", name: "Coat Rack", kind: "storage", footprint: [0.46, 0.46], placement: "floor", variants: 3, note: "Wood tree rack, minimalist tripod, or hall-tree" },
  { id: "fullMirror", name: "Full-Length Mirror", kind: "decor", footprint: [0.56, 0.38], placement: "floor", variants: 3, note: "Arched leaning, wood cheval, or chunky rounded frame" },
  { id: "wallClock", name: "Wall Clock", kind: "decor", footprint: [0.34, 0.06], placement: "wall", variants: 3, note: "Minimalist wood, mid-century sunburst, or retro square" },
  { id: "wallShelf", name: "Wall Shelf", kind: "storage", footprint: [0.85, 0.22], placement: "wall", variants: 3, note: "Floating ledge, 2-tier bracketed, or hexagon cubby" },
  { id: "pennant", name: "Dorm Pennant", kind: "decor", footprint: [0.55, 0.03], placement: "wall", variants: 3, note: "Triangle felt pennant, vertical banner, or bunting garland" },
  { id: "polaroidString", name: "Photo String", kind: "decor", footprint: [1.3, 0.05], placement: "wall", variants: 3, note: "Single twine, double row, or wire grid memo board" },
  { id: "neonSign", name: "Neon Sign", kind: "lighting", footprint: [0.55, 0.08], placement: "wall", variants: 3, note: "Glowing abstract heart, star, or lightning bolt; emits glow" },
  { id: "windowPlanter", name: "Window Planter", kind: "plant", footprint: [0.62, 0.22], placement: "surface", variants: 3, note: "Blossom box, trailing ivy trough, or trio of pots" },
  { id: "hangingPlant", name: "Hanging Plant", kind: "plant", footprint: [0.32, 0.32], placement: "surface", variants: 3, note: "Hangs downward from y = 0; macrame, hoop, or pearls" },
  { id: "cactus", name: "Potted Cactus", kind: "plant", footprint: [0.24, 0.24], placement: "surface", variants: 3, note: "Saguaro with flower, barrel cluster, or prickly pear" },
  { id: "bonsai", name: "Bonsai Tree", kind: "plant", footprint: [0.34, 0.26], placement: "surface", variants: 3, note: "Windswept, cherry-blossom, or cascade style" },
  { id: "fishTank", name: "Fish Tank", kind: "pet", footprint: [0.56, 0.3], placement: "surface", variants: 3, note: "Rimless aquarium, round bowl, or nano hex tank; emits glow" },
  { id: "petBed", name: "Pet Bed", kind: "pet", footprint: [0.66, 0.54], placement: "floor", variants: 3, note: "Oval bolster donut, fluffy puff, or wooden pet cot" },
  { id: "petBowl", name: "Pet Bowl", kind: "pet", footprint: [0.38, 0.22], placement: "floor", variants: 3, note: "Raised double feeder, ceramic bowl on mat, or dispenser" },
  { id: "floorCushion", name: "Floor Cushion", kind: "seating", footprint: [0.62, 0.62], placement: "floor", variants: 3, note: "Pleated round pouf, tasseled square, or stacked pair" },
  { id: "curtainSet", name: "Curtain Set", kind: "decor", footprint: [1.6, 0.14], placement: "wall", variants: 3, note: "Tieback drapes, layered sheer/outer, or cafe valance" },
  { id: "ceilingFanLight", name: "Ceiling Fan Light", kind: "lighting", footprint: [1.05, 1.05], placement: "surface", variants: 3, note: "Hangs downward from y = 0; wood 4-blade, sleek 3-blade, or caged" },
];
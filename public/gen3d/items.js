// Dorm Room Diorama Furniture Module (Three.js r160, plain ES module, no imports)

const DEFAULTS = {
  primary: 0xd98a6c,
  secondary: 0xf4ede1,
  accent: 0x6f9a8d,
  wood: 0xb98b60,
  metal: 0x4b4f58,
  fabric: 0xe9ddcc,
  material: "wood",
  variant: 0,
};

function resolveOpts(opts = {}) {
  const v = Number.isFinite(opts.variant) ? (((opts.variant | 0) % 3) + 3) % 3 : 0;
  return {
    primary: opts.primary ?? DEFAULTS.primary,
    secondary: opts.secondary ?? DEFAULTS.secondary,
    accent: opts.accent ?? DEFAULTS.accent,
    wood: opts.wood ?? DEFAULTS.wood,
    metal: opts.metal ?? DEFAULTS.metal,
    fabric: opts.fabric ?? opts.secondary ?? DEFAULTS.fabric,
    material: opts.material ?? DEFAULTS.material,
    variant: v,
  };
}

function makeMat(THREE, o, slot, overrides = {}) {
  const presets = {
    wood: { roughness: 0.72, metalness: 0.04 },
    metal: { roughness: 0.26, metalness: 0.84 },
    fabric: { roughness: 0.92, metalness: 0.0 },
    primary: { roughness: 0.52, metalness: 0.05 },
    secondary: { roughness: 0.64, metalness: 0.03 },
    accent: { roughness: 0.56, metalness: 0.05 },
  };
  const base = presets[slot] || { roughness: 0.6, metalness: 0.05 };
  const color = overrides.color !== undefined ? overrides.color : (o[slot] ?? DEFAULTS.secondary);
  return new THREE.MeshStandardMaterial({
    color,
    roughness: base.roughness,
    metalness: base.metalness,
    ...overrides,
  });
}

function bodySpec(THREE, o, overrides = {}) {
  switch (o.material) {
    case "painted":
      return {
        slot: "primary",
        mat: makeMat(THREE, o, "primary", { roughness: 0.34, metalness: 0.06, ...overrides }),
      };
    case "metal":
      return {
        slot: "metal",
        mat: makeMat(THREE, o, "metal", { roughness: 0.28, metalness: 0.82, ...overrides }),
      };
    case "fabric":
      return {
        slot: "fabric",
        mat: makeMat(THREE, o, "fabric", { roughness: 0.92, metalness: 0.0, ...overrides }),
      };
    case "wood":
    default:
      return {
        slot: "wood",
        mat: makeMat(THREE, o, "wood", { roughness: 0.72, metalness: 0.04, ...overrides }),
      };
  }
}

function addMesh(parent, geo, mat, slot, pos, rot, scale) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  if (slot) m.userData.slot = slot;
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  if (scale) m.scale.set(scale[0], scale[1], scale[2]);
  parent.add(m);
  return m;
}

// ---------- Soft Procedural Geometry Helpers ----------

function roundedRectShape(THREE, w, h, r) {
  const s = new THREE.Shape();
  const hw = w * 0.5;
  const hh = h * 0.5;
  const cr = Math.max(0.0005, Math.min(r, hw * 0.92, hh * 0.92));
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

function archShape(THREE, w, h) {
  const s = new THREE.Shape();
  const hw = w * 0.5;
  const hh = h * 0.5;
  const r = Math.min(hw, h * 0.48);
  const straightTop = hh - r;
  s.moveTo(-hw, -hh);
  s.lineTo(hw, -hh);
  s.lineTo(hw, straightTop);
  s.absarc(0, straightTop, r, 0, Math.PI, false);
  s.lineTo(-hw, -hh);
  return s;
}

function roundedBoxGeo(THREE, w, h, d, r = 0.014, segs = 3) {
  const b = Math.max(0.001, Math.min(r, w * 0.34, h * 0.34, d * 0.34));
  const iw = Math.max(0.002, w - b * 2);
  const ih = Math.max(0.002, h - b * 2);
  const depth = Math.max(0.002, d - b * 2);
  const shape = roundedRectShape(THREE, iw, ih, b * 0.65);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: segs,
    curveSegments: segs + 2,
  });
  geo.center();
  return geo;
}

function pillowGeo(THREE, w, h, d, segs = 18) {
  const geo = new THREE.SphereGeometry(1, segs, Math.max(10, Math.floor(segs * 0.7)));
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const px = Math.sign(x) * Math.pow(Math.abs(x), 0.72) * (w * 0.5);
    const py = Math.sign(y) * Math.pow(Math.abs(y), 0.86) * (h * 0.5);
    const pz = Math.sign(z) * Math.pow(Math.abs(z), 0.72) * (d * 0.5);
    pos.setXYZ(i, px, py, pz);
  }
  geo.computeVertexNormals();
  return geo;
}

function latheGeo(THREE, pts, segs = 24) {
  const vecs = pts.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
  return new THREE.LatheGeometry(vecs, segs);
}

function taperedLegGeo(THREE, rTop, rBot, h, segs = 12) {
  return new THREE.CylinderGeometry(rTop, rBot, h, segs);
}

// Helper for adding a mattress, duvet, and pillows at a given base height
function addBedding(THREE, g, o, baseY, plush = false) {
  const mw = 0.92;
  const mh = 0.19;
  const ml = 1.9;

  // Mattress
  addMesh(
    g,
    roundedBoxGeo(THREE, mw, mh, ml, 0.045, 3),
    makeMat(THREE, o, "secondary", { roughness: 0.9 }),
    "secondary",
    [0, baseY + mh * 0.5, 0]
  );

  // Subtle mattress piping seam
  addMesh(
    g,
    roundedBoxGeo(THREE, mw + 0.008, 0.014, ml + 0.008, 0.006, 2),
    makeMat(THREE, o, "fabric", { roughness: 0.88 }),
    "fabric",
    [0, baseY + mh - 0.015, 0]
  );

  // Cozy duvet covering lower ~68% of bed
  const duvL = 1.32;
  const duvZ = 0.29;
  addMesh(
    g,
    roundedBoxGeo(THREE, mw + 0.045, 0.075, duvL, 0.032, 3),
    makeMat(THREE, o, "primary", { roughness: 0.92 }),
    "primary",
    [0, baseY + mh + 0.015, duvZ]
  );
  // Side drapes of duvet
  for (const sx of [-1, 1]) {
    addMesh(
      g,
      roundedBoxGeo(THREE, 0.04, 0.16, duvL - 0.02, 0.018, 2),
      makeMat(THREE, o, "primary", { roughness: 0.92 }),
      "primary",
      [sx * (mw * 0.5 + 0.012), baseY + mh - 0.04, duvZ]
    );
  }
  // Folded top cuff of duvet
  addMesh(
    g,
    roundedBoxGeo(THREE, mw + 0.055, 0.065, 0.22, 0.028, 3),
    makeMat(THREE, o, "fabric", { roughness: 0.94 }),
    "fabric",
    [0, baseY + mh + 0.042, duvZ - duvL * 0.5 + 0.09]
  );

  // Foot throw blanket
  addMesh(
    g,
    roundedBoxGeo(THREE, mw + 0.06, 0.045, 0.36, 0.02, 2),
    makeMat(THREE, o, "accent", { roughness: 0.93 }),
    "accent",
    [0, baseY + mh + 0.045, 0.68]
  );

  // Two sleeping pillows
  for (const sx of [-0.21, 0.21]) {
    addMesh(
      g,
      pillowGeo(THREE, 0.4, 0.13, 0.3),
      makeMat(THREE, o, "secondary", { roughness: 0.92 }),
      "secondary",
      [sx, baseY + mh + 0.055, -0.74],
      [0.14, sx * 0.12, 0]
    );
  }

  // Extra accent throw cushion
  if (plush) {
    addMesh(
      g,
      pillowGeo(THREE, 0.34, 0.12, 0.26),
      makeMat(THREE, o, "accent", { roughness: 0.92 }),
      "accent",
      [0, baseY + mh + 0.09, -0.53],
      [0.32, 0.08, 0]
    );
  }
}

// =====================================================================
// 1. BED (1.0 x 2.0 m, origin on floor, facing +z)
// =====================================================================
function bed(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const body = bodySpec(THREE, o);
  const metalMat = () => makeMat(THREE, o, "metal");
  const isMetal = o.material === "metal";

  if (o.variant === 0) {
    // Plain cozy frame bed with slatted headboard
    const legH = 0.24;
    const legR = isMetal ? 0.02 : 0.028;
    for (const sx of [-0.46, 0.46]) {
      for (const sz of [-0.96, 0.96]) {
        addMesh(
          g,
          taperedLegGeo(THREE, legR, legR * 0.78, legH, 12),
          body.mat.clone(),
          body.slot,
          [sx, legH * 0.5, sz]
        );
      }
    }
    // Side & end rails
    for (const sx of [-0.475, 0.475]) {
      addMesh(g, roundedBoxGeo(THREE, 0.045, 0.14, 1.98, 0.012), body.mat.clone(), body.slot, [sx, 0.27, 0]);
    }
    for (const sz of [-0.97, 0.97]) {
      addMesh(g, roundedBoxGeo(THREE, 0.99, 0.14, 0.05, 0.012), body.mat.clone(), body.slot, [0, 0.27, sz]);
    }
    // Mattress support base
    addMesh(g, roundedBoxGeo(THREE, 0.92, 0.04, 1.9, 0.01), body.mat.clone(), body.slot, [0, 0.25, 0]);

    // Headboard posts & slatted back
    for (const sx of [-0.47, 0.47]) {
      addMesh(g, roundedBoxGeo(THREE, 0.05, 0.82, 0.05, 0.014), body.mat.clone(), body.slot, [sx, 0.56, -0.97]);
    }
    addMesh(g, roundedBoxGeo(THREE, 1.0, 0.06, 0.055, 0.018), body.mat.clone(), body.slot, [0, 0.96, -0.97]);
    for (let i = 0; i < 6; i++) {
      const x = -0.35 + i * 0.14;
      addMesh(g, roundedBoxGeo(THREE, 0.065, 0.56, 0.024, 0.008), body.mat.clone(), body.slot, [x, 0.65, -0.97]);
    }
    // Low footboard lip
    addMesh(g, roundedBoxGeo(THREE, 1.0, 0.06, 0.055, 0.016), body.mat.clone(), body.slot, [0, 0.36, 0.97]);

    addBedding(THREE, g, o, 0.27, false);
  } else if (o.variant === 1) {
    // Upholstered headboard bed
    const footH = 0.12;
    for (const sx of [-0.43, 0.43]) {
      for (const sz of [-0.92, 0.92]) {
        addMesh(
          g,
          taperedLegGeo(THREE, 0.028, 0.018, footH, 12),
          makeMat(THREE, o, "wood"),
          "wood",
          [sx, footH * 0.5, sz]
        );
      }
    }
    // Soft upholstered base
    const baseMat = () => makeMat(THREE, o, "fabric", { roughness: 0.92 });
    addMesh(g, roundedBoxGeo(THREE, 1.0, 0.22, 2.0, 0.032, 3), baseMat(), "fabric", [0, 0.22, 0]);

    // Tall channelled upholstered headboard
    addMesh(g, roundedBoxGeo(THREE, 1.0, 0.86, 0.09, 0.035, 3), baseMat(), "fabric", [0, 0.66, -0.955]);
    for (let i = 0; i < 4; i++) {
      const x = -0.345 + i * 0.23;
      addMesh(
        g,
        roundedBoxGeo(THREE, 0.21, 0.72, 0.05, 0.022, 3),
        makeMat(THREE, o, "fabric", { roughness: 0.94 }),
        "fabric",
        [x, 0.68, -0.91]
      );
    }
    // Trim piping along headboard top
    addMesh(
      g,
      roundedBoxGeo(THREE, 0.98, 0.02, 0.095, 0.008, 2),
      makeMat(THREE, o, "accent", { roughness: 0.85 }),
      "accent",
      [0, 1.085, -0.955]
    );

    addBedding(THREE, g, o, 0.31, true);
  } else {
    // Loft-style bed (elevated sleeping platform + guardrails + ladder)
    const postH = 1.88;
    const deckY = 1.38;
    const postW = isMetal ? 0.045 : 0.06;

    // 4 corner posts
    for (const sx of [-0.465, 0.465]) {
      for (const sz of [-0.965, 0.965]) {
        addMesh(g, roundedBoxGeo(THREE, postW, postH, postW, 0.012), body.mat.clone(), body.slot, [sx, postH * 0.5, sz]);
      }
    }
    // Lower back & side stabilizer braces
    addMesh(g, roundedBoxGeo(THREE, 0.92, 0.045, 0.035, 0.01), body.mat.clone(), body.slot, [0, 0.26, -0.965]);
    for (const sx of [-0.465, 0.465]) {
      addMesh(g, roundedBoxGeo(THREE, 0.035, 0.045, 1.9, 0.01), body.mat.clone(), body.slot, [sx, 0.26, 0]);
    }
    // Platform rails & deck
    for (const sx of [-0.47, 0.47]) {
      addMesh(g, roundedBoxGeo(THREE, 0.05, 0.13, 1.98, 0.012), body.mat.clone(), body.slot, [sx, deckY, 0]);
    }
    for (const sz of [-0.97, 0.97]) {
      addMesh(g, roundedBoxGeo(THREE, 0.98, 0.13, 0.05, 0.012), body.mat.clone(), body.slot, [0, deckY, sz]);
    }
    addMesh(g, roundedBoxGeo(THREE, 0.92, 0.04, 1.9, 0.01), body.mat.clone(), body.slot, [0, deckY - 0.02, 0]);

    // Guardrails (full back, left, head, foot, partial right leaving ladder opening)
    addMesh(g, roundedBoxGeo(THREE, 0.035, 0.04, 1.92, 0.01), body.mat.clone(), body.slot, [-0.47, 1.82, 0]);
    addMesh(g, roundedBoxGeo(THREE, 0.035, 0.04, 1.92, 0.01), body.mat.clone(), body.slot, [-0.47, 1.62, 0]);
    addMesh(g, roundedBoxGeo(THREE, 0.035, 0.04, 1.32, 0.01), body.mat.clone(), body.slot, [0.47, 1.82, -0.3]);
    addMesh(g, roundedBoxGeo(THREE, 0.035, 0.04, 1.32, 0.01), body.mat.clone(), body.slot, [0.47, 1.62, -0.3]);
    for (const sz of [-0.97, 0.97]) {
      addMesh(g, roundedBoxGeo(THREE, 0.94, 0.04, 0.035, 0.01), body.mat.clone(), body.slot, [0, 1.82, sz]);
      addMesh(g, roundedBoxGeo(THREE, 0.94, 0.04, 0.035, 0.01), body.mat.clone(), body.slot, [0, 1.62, sz]);
    }

    // Ladder on +x side near foot (+z)
    const ladX = 0.485;
    for (const sz of [0.42, 0.88]) {
      addMesh(g, roundedBoxGeo(THREE, 0.032, 1.56, 0.04, 0.01), metalMat(), "metal", [ladX, 0.78, sz]);
    }
    for (let i = 0; i < 5; i++) {
      const y = 0.24 + i * 0.28;
      addMesh(g, roundedBoxGeo(THREE, 0.03, 0.028, 0.46, 0.01), metalMat(), "metal", [ladX, y, 0.65]);
    }

    addBedding(THREE, g, o, deckY, false);
  }

  return g;
}

// =====================================================================
// 2. DESK (1.2 x 0.6 m, 0.75 m high, origin on floor, facing +z)
// =====================================================================
function desk(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const body = bodySpec(THREE, o);
  const metalMat = () => makeMat(THREE, o, "metal");
  const topH = 0.036;
  const topY = 0.75 - topH * 0.5;

  // Bevelled desktop
  addMesh(g, roundedBoxGeo(THREE, 1.2, topH, 0.6, 0.014, 3), body.mat.clone(), body.slot, [0, topY, 0]);

  // Subtle desk mat
  addMesh(
    g,
    roundedBoxGeo(THREE, 0.56, 0.005, 0.34, 0.004, 2),
    makeMat(THREE, o, "accent", { roughness: 0.88 }),
    "accent",
    [-0.1, 0.7525, 0.04]
  );

  if (o.variant === 0) {
    // Mid-century study desk with 2 under-top drawers and splayed legs
    const apronH = 0.11;
    const apronY = 0.75 - topH - apronH * 0.5;
    addMesh(g, roundedBoxGeo(THREE, 1.12, apronH, 0.52, 0.01), body.mat.clone(), body.slot, [0, apronY, -0.01]);

    // 2 drawer fronts facing +z
    for (const sx of [-0.27, 0.27]) {
      addMesh(
        g,
        roundedBoxGeo(THREE, 0.5, 0.088, 0.022, 0.008),
        makeMat(THREE, o, "secondary", { roughness: 0.5 }),
        "secondary",
        [sx, apronY, 0.255]
      );
      // Rounded knob
      addMesh(g, new THREE.SphereGeometry(0.014, 12, 10), metalMat(), "metal", [sx, apronY, 0.275]);
    }

    // 4 slightly splayed tapered legs
    const legH = 0.62;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        addMesh(
          g,
          taperedLegGeo(THREE, 0.024, 0.015, legH, 12),
          body.mat.clone(),
          body.slot,
          [sx * 0.51, legH * 0.5, sz * 0.22],
          [sz * 0.06, 0, -sx * 0.06]
        );
      }
    }
    // Side stretchers
    for (const sx of [-0.52, 0.52]) {
      addMesh(g, roundedBoxGeo(THREE, 0.022, 0.026, 0.44, 0.008), body.mat.clone(), body.slot, [sx, 0.2, 0]);
    }
  } else if (o.variant === 1) {
    // Pedestal dorm desk (3-drawer cabinet on right, sleek metal frame on left)
    const cabW = 0.38;
    const cabH = 0.64;
    const cabX = 0.37;
    addMesh(g, roundedBoxGeo(THREE, cabW, cabH, 0.54, 0.014), body.mat.clone(), body.slot, [cabX, 0.075 + cabH * 0.5, 0]);
    // Short feet under cabinet
    for (const sx of [-0.14, 0.14]) {
      for (const sz of [-0.21, 0.21]) {
        addMesh(g, taperedLegGeo(THREE, 0.018, 0.014, 0.08, 10), metalMat(), "metal", [cabX + sx, 0.04, sz]);
      }
    }
    // 3 drawer fronts + bar handles
    for (let i = 0; i < 3; i++) {
      const dy = 0.19 + i * 0.195;
      addMesh(
        g,
        roundedBoxGeo(THREE, cabW - 0.04, 0.17, 0.022, 0.008),
        makeMat(THREE, o, "secondary", { roughness: 0.48 }),
        "secondary",
        [cabX, dy, 0.275]
      );
      addMesh(g, roundedBoxGeo(THREE, 0.11, 0.014, 0.022, 0.005), metalMat(), "metal", [cabX, dy + 0.02, 0.295]);
    }
    // Left U-frame legs
    const lx = -0.54;
    for (const sz of [-0.24, 0.24]) {
      addMesh(g, roundedBoxGeo(THREE, 0.036, 0.715, 0.036, 0.009), metalMat(), "metal", [lx, 0.3575, sz]);
    }
    addMesh(g, roundedBoxGeo(THREE, 0.036, 0.032, 0.52, 0.008), metalMat(), "metal", [lx, 0.018, 0]);
    // Back modesty panel
    addMesh(g, roundedBoxGeo(THREE, 0.72, 0.28, 0.022, 0.008), body.mat.clone(), body.slot, [-0.18, 0.52, -0.25]);
  } else {
    // Hutch / shelf desk
    const legH = 0.715;
    for (const sx of [-0.55, 0.55]) {
      for (const sz of [-0.25, 0.25]) {
        addMesh(g, taperedLegGeo(THREE, 0.022, 0.018, legH, 12), body.mat.clone(), body.slot, [sx, legH * 0.5, sz]);
      }
    }
    // Under-desk pencil tray / apron
    addMesh(g, roundedBoxGeo(THREE, 1.08, 0.06, 0.5, 0.01), body.mat.clone(), body.slot, [0, 0.685, 0]);
    // Raised back hutch (y = 0.75 to 1.13)
    const hutchD = 0.2;
    const hutchZ = -0.2;
    for (const sx of [-0.57, 0.57]) {
      addMesh(g, roundedBoxGeo(THREE, 0.028, 0.36, hutchD, 0.009), body.mat.clone(), body.slot, [sx, 0.93, hutchZ]);
    }
    addMesh(g, roundedBoxGeo(THREE, 1.18, 0.028, hutchD + 0.01, 0.01), body.mat.clone(), body.slot, [0, 1.11, hutchZ]);
    addMesh(g, roundedBoxGeo(THREE, 1.14, 0.024, hutchD - 0.01, 0.008), body.mat.clone(), body.slot, [0, 0.91, hutchZ]);
    // Cubby dividers
    for (const sx of [-0.2, 0.22]) {
      addMesh(g, roundedBoxGeo(THREE, 0.022, 0.16, hutchD - 0.02, 0.007), body.mat.clone(), body.slot, [sx, 0.83, hutchZ]);
    }
    // Little back panel on hutch
    addMesh(
      g,
      roundedBoxGeo(THREE, 1.14, 0.34, 0.014, 0.005),
      makeMat(THREE, o, "secondary"),
      "secondary",
      [0, 0.93, -0.292]
    );
    // Cable grommet
    addMesh(g, new THREE.CylinderGeometry(0.024, 0.024, 0.008, 16), metalMat(), "metal", [0.42, 0.752, -0.02]);
  }

  return g;
}

// =====================================================================
// 3. CHAIR (0.45 x 0.45 m, origin on floor, facing +z)
// =====================================================================
function chair(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const body = bodySpec(THREE, o);
  const metalMat = () => makeMat(THREE, o, "metal");

  if (o.variant === 0) {
    // Wooden study chair with soft seat pad & curved slatted backrest
    const seatY = 0.44;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        addMesh(
          g,
          taperedLegGeo(THREE, 0.018, 0.013, seatY, 12),
          body.mat.clone(),
          body.slot,
          [sx * 0.175, seatY * 0.5, sz * 0.175],
          [sz * 0.05, 0, -sx * 0.05]
        );
      }
    }
    // H-stretcher
    for (const sx of [-0.18, 0.18]) {
      addMesh(g, roundedBoxGeo(THREE, 0.018, 0.018, 0.35, 0.006), body.mat.clone(), body.slot, [sx, 0.16, 0]);
    }
    addMesh(g, roundedBoxGeo(THREE, 0.36, 0.018, 0.018, 0.006), body.mat.clone(), body.slot, [0, 0.16, 0]);

    // Seat + soft pad
    addMesh(g, roundedBoxGeo(THREE, 0.43, 0.032, 0.42, 0.014, 3), body.mat.clone(), body.slot, [0, seatY, 0]);
    addMesh(
      g,
      pillowGeo(THREE, 0.38, 0.04, 0.36),
      makeMat(THREE, o, "fabric", { roughness: 0.92 }),
      "fabric",
      [0, seatY + 0.028, 0.01]
    );

    // Backrest stiles & curved top rail
    for (const sx of [-0.175, 0.175]) {
      addMesh(
        g,
        taperedLegGeo(THREE, 0.015, 0.018, 0.41, 12),
        body.mat.clone(),
        body.slot,
        [sx, seatY + 0.2, -0.19],
        [-0.08, 0, 0]
      );
    }
    addMesh(
      g,
      roundedBoxGeo(THREE, 0.42, 0.09, 0.03, 0.014, 3),
      body.mat.clone(),
      body.slot,
      [0, seatY + 0.36, -0.205],
      [-0.08, 0, 0]
    );
    // Vertical spindles
    for (const sx of [-0.08, 0, 0.08]) {
      addMesh(
        g,
        taperedLegGeo(THREE, 0.009, 0.009, 0.32, 8),
        body.mat.clone(),
        body.slot,
        [sx, seatY + 0.17, -0.19],
        [-0.08, 0, 0]
      );
    }
  } else if (o.variant === 1) {
    // Swivel desk chair with 5-star caster base
    const hubY = 0.09;
    addMesh(g, new THREE.CylinderGeometry(0.036, 0.04, 0.05, 16), metalMat(), "metal", [0, hubY, 0]);
    for (let i = 0; i < 5; i++) {
      const ang = (i * Math.PI * 2) / 5;
      const arm = new THREE.Group();
      arm.rotation.y = ang;
      addMesh(arm, roundedBoxGeo(THREE, 0.026, 0.024, 0.21, 0.008), metalMat(), "metal", [0, hubY - 0.01, 0.11], [0.12, 0, 0]);
      // Caster wheel
      addMesh(arm, new THREE.CylinderGeometry(0.022, 0.022, 0.024, 12), metalMat(), "metal", [0, 0.022, 0.2], [0, 0, Math.PI / 2]);
      g.add(arm);
    }
    // Pneumatic lift column
    addMesh(g, new THREE.CylinderGeometry(0.022, 0.026, 0.34, 14), metalMat(), "metal", [0, 0.26, 0]);
    // Seat pan + cushion
    addMesh(g, roundedBoxGeo(THREE, 0.44, 0.04, 0.43, 0.018, 3), metalMat(), "metal", [0, 0.43, 0]);
    addMesh(
      g,
      pillowGeo(THREE, 0.43, 0.075, 0.42),
      makeMat(THREE, o, "primary", { roughness: 0.88 }),
      "primary",
      [0, 0.468, 0.005]
    );
    // Backrest spine + cushioned back
    addMesh(g, roundedBoxGeo(THREE, 0.055, 0.34, 0.026, 0.01), metalMat(), "metal", [0, 0.6, -0.21], [-0.1, 0, 0]);
    addMesh(
      g,
      roundedBoxGeo(THREE, 0.4, 0.32, 0.065, 0.028, 3),
      makeMat(THREE, o, "primary", { roughness: 0.88 }),
      "primary",
      [0, 0.72, -0.195],
      [-0.1, 0, 0]
    );
    // Compact armrests
    for (const sx of [-0.215, 0.215]) {
      addMesh(g, roundedBoxGeo(THREE, 0.024, 0.18, 0.03, 0.008), metalMat(), "metal", [sx, 0.53, -0.02]);
      addMesh(
        g,
        roundedBoxGeo(THREE, 0.042, 0.026, 0.24, 0.012),
        makeMat(THREE, o, "secondary", { roughness: 0.5 }),
        "secondary",
        [sx, 0.62, -0.01]
      );
    }
  } else {
    // Soft cozy armchair (compact 0.45 x 0.45 footprint)
    const legH = 0.16;
    for (const sx of [-0.16, 0.16]) {
      for (const sz of [-0.16, 0.16]) {
        addMesh(
          g,
          taperedLegGeo(THREE, 0.022, 0.014, legH, 12),
          makeMat(THREE, o, "wood"),
          "wood",
          [sx, legH * 0.5, sz],
          [sz * 0.3, 0, -sx * 0.3]
        );
      }
    }
    const uphMat = () => makeMat(THREE, o, "primary", { roughness: 0.92 });
    // Upholstered seat base & plush cushion
    addMesh(g, roundedBoxGeo(THREE, 0.44, 0.14, 0.44, 0.04, 3), uphMat(), "primary", [0, 0.23, 0]);
    addMesh(
      g,
      pillowGeo(THREE, 0.38, 0.12, 0.38),
      makeMat(THREE, o, "fabric", { roughness: 0.94 }),
      "fabric",
      [0, 0.33, 0.02]
    );
    // Curved wrap-around arms & tall cushioned back
    for (const sx of [-0.19, 0.19]) {
      addMesh(g, roundedBoxGeo(THREE, 0.085, 0.3, 0.4, 0.038, 3), uphMat(), "primary", [sx, 0.42, -0.02]);
    }
    addMesh(g, roundedBoxGeo(THREE, 0.44, 0.48, 0.11, 0.045, 3), uphMat(), "primary", [0, 0.54, -0.175], [-0.08, 0, 0]);
    // Cozy accent lumbar pillow
    addMesh(
      g,
      pillowGeo(THREE, 0.26, 0.14, 0.09),
      makeMat(THREE, o, "accent", { roughness: 0.92 }),
      "accent",
      [0, 0.44, -0.08],
      [-0.18, 0, 0]
    );
  }

  return g;
}

// =====================================================================
// 4. SHELF (0.8 x 0.3 m, 1.6 m high with books, origin on floor, +z)
// =====================================================================
function addBooksRow(THREE, g, o, startX, shelfY, z, count, seed = 0) {
  const slots = ["primary", "accent", "secondary", "fabric"];
  let x = startX;
  for (let i = 0; i < count; i++) {
    const bw = 0.024 + ((i * 7 + seed) % 3) * 0.008;
    const bh = 0.17 + ((i * 11 + seed * 3) % 5) * 0.018;
    const bd = 0.16 + ((i * 5 + seed) % 3) * 0.018;
    const slot = slots[(i + seed) % slots.length];
    addMesh(
      g,
      roundedBoxGeo(THREE, bw, bh, bd, 0.005, 2),
      makeMat(THREE, o, slot, { roughness: 0.7 }),
      slot,
      [x + bw * 0.5, shelfY + bh * 0.5, z]
    );
    x += bw + 0.004;
  }
  return x;
}

function shelf(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const body = bodySpec(THREE, o);
  const metalMat = () => makeMat(THREE, o, "metal");
  const w = 0.8;
  const d = 0.3;
  const h = 1.6;

  let shelfYs = [];

  if (o.variant === 0) {
    // Classic 5-tier bookcase
    for (const sx of [-w * 0.5 + 0.016, w * 0.5 - 0.016]) {
      addMesh(g, roundedBoxGeo(THREE, 0.032, h, d, 0.009), body.mat.clone(), body.slot, [sx, h * 0.5, 0]);
    }
    // Back panel
    addMesh(
      g,
      roundedBoxGeo(THREE, w - 0.03, h - 0.04, 0.016, 0.005),
      makeMat(THREE, o, "secondary", { roughness: 0.78 }),
      "secondary",
      [0, h * 0.5, -d * 0.5 + 0.01]
    );
    // Base kickplate & top crown
    addMesh(g, roundedBoxGeo(THREE, w + 0.015, 0.034, d + 0.012, 0.01), body.mat.clone(), body.slot, [0, h - 0.017, 0.004]);
    addMesh(g, roundedBoxGeo(THREE, w - 0.04, 0.07, d - 0.02, 0.008), body.mat.clone(), body.slot, [0, 0.035, 0]);

    const tiers = [0.08, 0.39, 0.7, 1.01, 1.3];
    for (const y of tiers) {
      addMesh(g, roundedBoxGeo(THREE, w - 0.04, 0.026, d - 0.02, 0.007), body.mat.clone(), body.slot, [0, y, 0.004]);
      shelfYs.push(y + 0.013);
    }
  } else if (o.variant === 1) {
    // Open ladder / modern frame shelf with rear X-brace
    for (const sx of [-0.375, 0.375]) {
      for (const sz of [-0.125, 0.125]) {
        addMesh(g, roundedBoxGeo(THREE, 0.026, h, 0.026, 0.008), metalMat(), "metal", [sx, h * 0.5, sz]);
      }
    }
    // Rear X-brace
    for (const s of [-1, 1]) {
      addMesh(g, roundedBoxGeo(THREE, 0.014, 1.55, 0.014, 0.004), metalMat(), "metal", [0, 0.82, -0.135], [0, 0, s * 0.44]);
    }
    const tiers = [0.14, 0.49, 0.84, 1.19, 1.54];
    for (const y of tiers) {
      addMesh(g, roundedBoxGeo(THREE, w - 0.02, 0.028, d - 0.01, 0.009), body.mat.clone(), body.slot, [0, y, 0]);
      if (y < 1.5) shelfYs.push(y + 0.014);
    }
  } else {
    // Cabinet-base bookcase (lower double doors + 3 upper open shelves)
    // Short legs
    for (const sx of [-0.34, 0.34]) {
      for (const sz of [-0.11, 0.11]) {
        addMesh(g, taperedLegGeo(THREE, 0.018, 0.013, 0.1, 10), body.mat.clone(), body.slot, [sx, 0.05, sz]);
      }
    }
    // Side walls & back
    for (const sx of [-0.384, 0.384]) {
      addMesh(g, roundedBoxGeo(THREE, 0.032, 1.5, d, 0.009), body.mat.clone(), body.slot, [sx, 0.85, 0]);
    }
    addMesh(
      g,
      roundedBoxGeo(THREE, w - 0.03, 1.48, 0.016, 0.005),
      makeMat(THREE, o, "secondary", { roughness: 0.78 }),
      "secondary",
      [0, 0.85, -d * 0.5 + 0.01]
    );
    // Lower cabinet bottom & top
    addMesh(g, roundedBoxGeo(THREE, w - 0.04, 0.028, d - 0.01, 0.008), body.mat.clone(), body.slot, [0, 0.114, 0]);
    addMesh(g, roundedBoxGeo(THREE, w - 0.04, 0.028, d - 0.01, 0.008), body.mat.clone(), body.slot, [0, 0.62, 0]);
    // Cabinet doors facing +z
    for (const sx of [-0.185, 0.185]) {
      addMesh(
        g,
        roundedBoxGeo(THREE, 0.355, 0.47, 0.022, 0.008),
        makeMat(THREE, o, "secondary", { roughness: 0.52 }),
        "secondary",
        [sx, 0.367, d * 0.5 - 0.006]
      );
      addMesh(g, new THREE.SphereGeometry(0.014, 12, 10), metalMat(), "metal", [sx > 0 ? 0.045 : -0.045, 0.44, d * 0.5 + 0.015]);
    }
    // Upper shelves & top
    const tiers = [0.62, 0.94, 1.26, 1.586];
    for (const y of tiers) {
      addMesh(g, roundedBoxGeo(THREE, w - 0.02, 0.028, d, 0.009), body.mat.clone(), body.slot, [0, y, 0]);
      if (y < 1.5) shelfYs.push(y + 0.014);
    }
  }

  // Populate shelves with books, horizontal stacks, and small decorative objects
  shelfYs.forEach((sy, idx) => {
    if (idx % 2 === 0) {
      const endX = addBooksRow(THREE, g, o, -0.34, sy, 0.01, 6, idx * 2);
      // One gently leaning book
      addMesh(
        g,
        roundedBoxGeo(THREE, 0.028, 0.2, 0.17, 0.005, 2),
        makeMat(THREE, o, "accent", { roughness: 0.72 }),
        "accent",
        [endX + 0.04, sy + 0.095, 0.01],
        [0, 0, 0.22]
      );
      // Small ceramic vase on the right
      const vase = latheGeo(THREE, [[0, 0], [0.036, 0], [0.052, 0.06], [0.038, 0.12], [0.026, 0.155], [0.032, 0.17], [0.024, 0.17]], 18);
      addMesh(g, vase, makeMat(THREE, o, "secondary", { roughness: 0.28 }), "secondary", [0.24, sy, 0.02]);
    } else {
      // Horizontal stack of 3 books on the left
      for (let b = 0; b < 3; b++) {
        const slot = b === 1 ? "primary" : b === 0 ? "accent" : "secondary";
        addMesh(
          g,
          roundedBoxGeo(THREE, 0.2 - b * 0.016, 0.026, 0.15, 0.005, 2),
          makeMat(THREE, o, slot, { roughness: 0.72 }),
          slot,
          [-0.22, sy + 0.013 + b * 0.027, 0.01],
          [0, (b - 1) * 0.08, 0]
        );
      }
      // Storage basket / box in middle-right
      addMesh(
        g,
        roundedBoxGeo(THREE, 0.22, 0.15, 0.21, 0.016, 2),
        makeMat(THREE, o, "fabric", { roughness: 0.92 }),
        "fabric",
        [0.04, sy + 0.075, 0.01]
      );
      addBooksRow(THREE, g, o, 0.19, sy, 0.01, 4, idx * 3 + 1);
    }
  });

  return g;
}

// =====================================================================
// 5. RUG (1.6 m round or rectangular, origin on floor)
// =====================================================================
function rug(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const fMat = (slot) => makeMat(THREE, o, slot, { roughness: 0.95, metalness: 0.0 });

  if (o.variant === 0) {
    // Round 1.6 m braided / concentric rug
    const disc = latheGeo(THREE, [[0, 0], [0.79, 0], [0.8, 0.006], [0.785, 0.012], [0, 0.012]], 44);
    addMesh(g, disc, fMat("secondary"), "secondary", [0, 0, 0]);
    // Concentric accent & primary rings
    addMesh(g, new THREE.CylinderGeometry(0.64, 0.65, 0.004, 40), fMat("primary"), "primary", [0, 0.012, 0]);
    addMesh(g, new THREE.CylinderGeometry(0.46, 0.47, 0.004, 36), fMat("fabric"), "fabric", [0, 0.014, 0]);
    addMesh(g, new THREE.CylinderGeometry(0.24, 0.25, 0.004, 32), fMat("accent"), "accent", [0, 0.016, 0]);
  } else if (o.variant === 1) {
    // Rectangular 1.6 x 1.15 m woven rug with border & fringe tassels
    addMesh(g, roundedBoxGeo(THREE, 1.6, 0.014, 1.15, 0.006, 2), fMat("fabric"), "fabric", [0, 0.007, 0]);
    // Inset decorative border stripes
    addMesh(g, roundedBoxGeo(THREE, 1.44, 0.004, 0.99, 0.002, 2), fMat("primary"), "primary", [0, 0.014, 0]);
    addMesh(g, roundedBoxGeo(THREE, 1.32, 0.004, 0.87, 0.002, 2), fMat("secondary"), "secondary", [0, 0.016, 0]);
    // Accent center diamond/stripe bands
    for (const sx of [-0.42, 0.42]) {
      addMesh(g, roundedBoxGeo(THREE, 0.06, 0.004, 0.86, 0.002, 2), fMat("accent"), "accent", [sx, 0.018, 0]);
    }
    // Fringe tassels on left and right edges
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 11; i++) {
        const z = -0.5 + i * 0.1;
        addMesh(
          g,
          new THREE.CapsuleGeometry(0.006, 0.055, 4, 6),
          fMat("secondary"),
          "secondary",
          [sx * 0.835, 0.006, z],
          [0, 0, Math.PI / 2]
        );
      }
    }
  } else {
    // Soft oval 1.6 x 1.18 m layered rug
    const oval = latheGeo(THREE, [[0, 0], [0.79, 0], [0.8, 0.007], [0.785, 0.014], [0, 0.014]], 44);
    addMesh(g, oval, fMat("primary"), "primary", [0, 0, 0], null, [1, 1, 0.74]);
    addMesh(g, new THREE.CylinderGeometry(0.62, 0.63, 0.004, 40), fMat("secondary"), "secondary", [0.06, 0.014, 0.02], null, [1, 1, 0.72]);
    addMesh(g, new THREE.CylinderGeometry(0.32, 0.33, 0.004, 32), fMat("accent"), "accent", [-0.26, 0.016, -0.05], null, [1, 1, 0.85]);
  }

  return g;
}

// =====================================================================
// 6. PLANT (in pot, ~0.9 m high, origin on floor)
// =====================================================================
function leafGeo(THREE, len, wid) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(wid * 0.85, len * 0.25, wid * 0.75, len * 0.78, 0, len);
  s.bezierCurveTo(-wid * 0.75, len * 0.78, -wid * 0.85, len * 0.25, 0, 0);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.005,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
    curveSegments: 10,
  });
  // Gentle arch along leaf length
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = y / Math.max(0.001, len);
    pos.setZ(i, pos.getZ(i) - t * t * len * 0.22);
  }
  geo.computeVertexNormals();
  return geo;
}

function plant(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x4b3b2f, roughness: 0.96, metalness: 0.0 });
  const leafMat1 = new THREE.MeshStandardMaterial({ color: 0x4f7f5a, roughness: 0.62, metalness: 0.02 });
  const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x62966b, roughness: 0.6, metalness: 0.02 });
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x466d4d, roughness: 0.75, metalness: 0.0 });

  if (o.variant === 0) {
    // Broad-leaf tropical plant in tapered ceramic pot + saucer (~0.9 m)
    const saucer = latheGeo(THREE, [[0, 0], [0.14, 0], [0.16, 0.026], [0.15, 0.032], [0.125, 0.012], [0, 0.012]], 28);
    addMesh(g, saucer, makeMat(THREE, o, "secondary", { roughness: 0.35 }), "secondary", [0, 0, 0]);
    const pot = latheGeo(THREE, [[0, 0.012], [0.115, 0.012], [0.165, 0.29], [0.175, 0.32], [0.162, 0.33], [0.145, 0.31], [0.135, 0.27]], 28);
    addMesh(g, pot, makeMat(THREE, o, "primary", { roughness: 0.32 }), "primary", [0, 0, 0]);
    addMesh(g, new THREE.CylinderGeometry(0.145, 0.13, 0.03, 20), soilMat, null, [0, 0.285, 0]);

    const lg = leafGeo(THREE, 0.26, 0.15);
    const count = 9;
    for (let i = 0; i < count; i++) {
      const ang = (i * Math.PI * 2) / count + (i % 2) * 0.2;
      const tier = i % 3;
      const stemH = 0.26 + tier * 0.14;
      const tilt = 0.22 + (2 - tier) * 0.18;
      const stemGroup = new THREE.Group();
      stemGroup.position.set(0, 0.29, 0);
      stemGroup.rotation.y = ang;

      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, stemH * 0.55, stemH * 0.18 * tilt),
        new THREE.Vector3(0, stemH, stemH * 0.45 * tilt),
      ]);
      addMesh(stemGroup, new THREE.TubeGeometry(curve, 10, 0.007, 8, false), stemMat, null);
      const end = curve.getPoint(1);
      addMesh(
        stemGroup,
        lg,
        i % 2 === 0 ? leafMat1 : leafMat2,
        null,
        [end.x, end.y, end.z],
        [0.65 + (2 - tier) * 0.25, 0, 0],
        [0.85 + tier * 0.1, 0.85 + tier * 0.1, 1]
      );
      g.add(stemGroup);
    }
  } else if (o.variant === 1) {
    // Mini ficus tree in cylinder pot on a 3-legged wooden stand (~0.92 m)
    const woodMat = () => makeMat(THREE, o, "wood");
    for (let i = 0; i < 3; i++) {
      const ang = (i * Math.PI * 2) / 3;
      const x = Math.cos(ang) * 0.135;
      const z = Math.sin(ang) * 0.135;
      addMesh(g, taperedLegGeo(THREE, 0.015, 0.012, 0.34, 10), woodMat(), "wood", [x, 0.17, z]);
      addMesh(g, roundedBoxGeo(THREE, 0.022, 0.022, 0.15, 0.006), woodMat(), "wood", [x * 0.5, 0.13, z * 0.5], [0, -ang + Math.PI / 2, 0]);
    }
    const pot = latheGeo(THREE, [[0, 0.14], [0.125, 0.14], [0.132, 0.37], [0.122, 0.38], [0.112, 0.37], [0.11, 0.34]], 26);
    addMesh(g, pot, makeMat(THREE, o, "secondary", { roughness: 0.3 }), "secondary", [0, 0, 0]);
    // Decorative accent band
    addMesh(g, new THREE.CylinderGeometry(0.134, 0.133, 0.04, 26), makeMat(THREE, o, "accent", { roughness: 0.38 }), "accent", [0, 0.24, 0]);
    addMesh(g, new THREE.CylinderGeometry(0.115, 0.11, 0.025, 18), soilMat, null, [0, 0.345, 0]);

    // Woody trunk & branches
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5c43, roughness: 0.86 });
    addMesh(g, taperedLegGeo(THREE, 0.014, 0.022, 0.34, 10), trunkMat, null, [0, 0.51, 0]);
    // Stylized foliage canopy clusters
    const blobs = [
      [0, 0.8, 0, 0.13],
      [0.09, 0.72, 0.06, 0.105],
      [-0.09, 0.74, 0.05, 0.1],
      [0.04, 0.69, -0.09, 0.1],
      [-0.07, 0.66, -0.07, 0.095],
      [0.02, 0.88, -0.02, 0.08],
    ];
    blobs.forEach(([x, y, z, r], i) => {
      addMesh(g, pillowGeo(THREE, r * 2.1, r * 1.75, r * 2.1, 14), i % 2 === 0 ? leafMat1 : leafMat2, null, [x, y, z]);
    });
  } else {
    // Snake plant (sansevieria) in ribbed planter (~0.86 m)
    const pot = latheGeo(THREE, [[0, 0], [0.12, 0], [0.155, 0.12], [0.16, 0.26], [0.15, 0.29], [0.135, 0.28], [0.13, 0.25]], 28);
    addMesh(g, pot, makeMat(THREE, o, "primary", { roughness: 0.42 }), "primary", [0, 0, 0]);
    // Subtle vertical ribs around pot
    for (let i = 0; i < 12; i++) {
      const ang = (i * Math.PI * 2) / 12;
      addMesh(
        g,
        new THREE.CapsuleGeometry(0.009, 0.16, 4, 8),
        makeMat(THREE, o, "secondary", { roughness: 0.45 }),
        "secondary",
        [Math.cos(ang) * 0.155, 0.16, Math.sin(ang) * 0.155]
      );
    }
    addMesh(g, new THREE.CylinderGeometry(0.135, 0.125, 0.025, 20), soilMat, null, [0, 0.255, 0]);

    // Upright sword-like blades
    const blades = 11;
    for (let i = 0; i < blades; i++) {
      const ang = (i * Math.PI * 2) / blades;
      const dist = (i % 3) * 0.035 + 0.015;
      const h = 0.38 + ((i * 7) % 5) * 0.055;
      const blade = leafGeo(THREE, h, 0.048);
      addMesh(
        g,
        blade,
        i % 2 === 0 ? leafMat1 : leafMat2,
        null,
        [Math.cos(ang) * dist, 0.25, Math.sin(ang) * dist],
        [0.06 + (i % 3) * 0.05, ang, (i % 2 === 0 ? 1 : -1) * 0.06]
      );
    }
  }

  return g;
}

// =====================================================================
// 7. DESK LAMP (~0.45 m high, origin at base, PointLight named "glow")
// =====================================================================
function lamp(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const metalMat = () => makeMat(THREE, o, "metal");
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff3d6,
    emissive: 0xffd28a,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });

  let glowPos = [0, 0.34, 0.08];

  if (o.variant === 0) {
    // Classic articulated architect/study desk lamp
    const base = latheGeo(THREE, [[0, 0], [0.085, 0], [0.088, 0.012], [0.075, 0.026], [0, 0.028]], 26);
    addMesh(g, base, makeMat(THREE, o, "primary", { roughness: 0.35 }), "primary", [0, 0, 0]);
    // Small toggle switch
    addMesh(g, new THREE.CylinderGeometry(0.008, 0.01, 0.014, 10), metalMat(), "metal", [0.04, 0.03, 0.035]);
    // Lower arm leaning slightly back, upper arm reaching toward +z
    addMesh(g, new THREE.CylinderGeometry(0.009, 0.01, 0.24, 12), metalMat(), "metal", [0, 0.135, -0.04], [-0.3, 0, 0]);
    // Elbow joint
    addMesh(g, new THREE.SphereGeometry(0.016, 12, 10), metalMat(), "metal", [0, 0.245, -0.075]);
    addMesh(g, new THREE.CylinderGeometry(0.008, 0.009, 0.23, 12), metalMat(), "metal", [0, 0.34, 0.0], [0.68, 0, 0]);
    // Shade joint & domed cone shade
    addMesh(g, new THREE.SphereGeometry(0.014, 12, 10), metalMat(), "metal", [0, 0.425, 0.072]);
    const shade = latheGeo(THREE, [[0.018, 0.11], [0.036, 0.1], [0.078, 0.015], [0.082, 0], [0.076, 0], [0.034, 0.095]], 26);
    const shadeGroup = new THREE.Group();
    shadeGroup.position.set(0, 0.34, 0.105);
    shadeGroup.rotation.x = 0.28;
    addMesh(shadeGroup, shade, makeMat(THREE, o, "primary", { roughness: 0.34, side: THREE.DoubleSide }), "primary", [0, 0, 0]);
    addMesh(shadeGroup, new THREE.SphereGeometry(0.024, 14, 12), bulbMat, null, [0, 0.045, 0]);
    g.add(shadeGroup);
    glowPos = [0, 0.33, 0.12];
  } else if (o.variant === 1) {
    // Cozy mushroom dome lamp
    const stem = latheGeo(THREE, [[0, 0], [0.075, 0], [0.078, 0.02], [0.048, 0.09], [0.032, 0.22], [0.042, 0.3], [0, 0.3]], 28);
    addMesh(g, stem, makeMat(THREE, o, "secondary", { roughness: 0.32 }), "secondary", [0, 0, 0]);
    addMesh(g, new THREE.CylinderGeometry(0.044, 0.044, 0.018, 20), metalMat(), "metal", [0, 0.3, 0]);
    // Mushroom dome shade
    const dome = latheGeo(THREE, [[0, 0.44], [0.07, 0.43], [0.135, 0.38], [0.155, 0.31], [0.148, 0.295], [0.135, 0.305], [0.12, 0.36]], 32);
    addMesh(g, dome, makeMat(THREE, o, "primary", { roughness: 0.34, side: THREE.DoubleSide }), "primary", [0, 0, 0]);
    addMesh(g, new THREE.SphereGeometry(0.03, 14, 12), bulbMat, null, [0, 0.315, 0]);
    glowPos = [0, 0.29, 0.02];
  } else {
    // Curved gooseneck globe lamp on wooden base
    addMesh(g, roundedBoxGeo(THREE, 0.15, 0.032, 0.15, 0.012, 3), makeMat(THREE, o, "wood"), "wood", [0, 0.016, 0]);
    addMesh(g, new THREE.CylinderGeometry(0.012, 0.012, 0.012, 12), metalMat(), "metal", [0.042, 0.034, 0.042]);
    const neckCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.03, -0.02),
      new THREE.Vector3(0, 0.24, -0.04),
      new THREE.Vector3(0, 0.42, 0.0),
      new THREE.Vector3(0, 0.43, 0.08),
      new THREE.Vector3(0, 0.38, 0.1),
    ]);
    addMesh(g, new THREE.TubeGeometry(neckCurve, 22, 0.008, 10, false), metalMat(), "metal");
    addMesh(g, new THREE.CylinderGeometry(0.022, 0.014, 0.026, 16), metalMat(), "metal", [0, 0.37, 0.1]);
    // Opal glass globe
    const globeMat = makeMat(THREE, o, "secondary", {
      roughness: 0.18,
      emissive: 0xffd79a,
      emissiveIntensity: 0.45,
    });
    addMesh(g, new THREE.SphereGeometry(0.068, 22, 16), globeMat, "secondary", [0, 0.31, 0.1]);
    glowPos = [0, 0.31, 0.1];
  }

  // Required warm, low-intensity PointLight named "glow"
  const glow = new THREE.PointLight(0xffd6a0, 0.75, 2.4, 2);
  glow.name = "glow";
  glow.position.set(glowPos[0], glowPos[1], glowPos[2]);
  g.add(glow);

  return g;
}

// =====================================================================
// 8. WALL ART (thin panel, origin at centre of back face z=0, faces +z)
// =====================================================================
function wallArt(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const body = bodySpec(THREE, o);

  if (o.variant === 0) {
    // Portrait framed geometric relief print (0.50 x 0.64 m)
    const w = 0.5;
    const h = 0.64;
    const d = 0.026;
    // Backboard
    addMesh(g, roundedBoxGeo(THREE, w - 0.02, h - 0.02, 0.012, 0.004, 2), makeMat(THREE, o, "secondary", { roughness: 0.85 }), "secondary", [0, 0, 0.006]);
    // Frame bars
    const ft = 0.026;
    addMesh(g, roundedBoxGeo(THREE, w, ft, d, 0.007, 2), body.mat.clone(), body.slot, [0, h * 0.5 - ft * 0.5, d * 0.5]);
    addMesh(g, roundedBoxGeo(THREE, w, ft, d, 0.007, 2), body.mat.clone(), body.slot, [0, -h * 0.5 + ft * 0.5, d * 0.5]);
    addMesh(g, roundedBoxGeo(THREE, ft, h - ft * 1.6, d, 0.007, 2), body.mat.clone(), body.slot, [-w * 0.5 + ft * 0.5, 0, d * 0.5]);
    addMesh(g, roundedBoxGeo(THREE, ft, h - ft * 1.6, d, 0.007, 2), body.mat.clone(), body.slot, [w * 0.5 - ft * 0.5, 0, d * 0.5]);

    // Geometric relief art inside
    const arch = new THREE.ExtrudeGeometry(archShape(THREE, 0.24, 0.34), { depth: 0.005, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 });
    addMesh(g, arch, makeMat(THREE, o, "primary", { roughness: 0.78 }), "primary", [-0.04, -0.06, 0.012]);
    addMesh(g, new THREE.CylinderGeometry(0.065, 0.065, 0.008, 24), makeMat(THREE, o, "accent", { roughness: 0.75 }), "accent", [0.09, 0.13, 0.016], [Math.PI / 2, 0, 0]);
    addMesh(g, roundedBoxGeo(THREE, 0.16, 0.08, 0.008, 0.003, 2), makeMat(THREE, o, "fabric", { roughness: 0.85 }), "fabric", [0.08, -0.15, 0.017]);
  } else if (o.variant === 1) {
    // Landscape wide minimalist frame (0.72 x 0.44 m)
    const w = 0.72;
    const h = 0.44;
    const d = 0.024;
    addMesh(g, roundedBoxGeo(THREE, w - 0.02, h - 0.02, 0.012, 0.004, 2), makeMat(THREE, o, "secondary", { roughness: 0.86 }), "secondary", [0, 0, 0.006]);
    const ft = 0.02;
    addMesh(g, roundedBoxGeo(THREE, w, ft, d, 0.006, 2), body.mat.clone(), body.slot, [0, h * 0.5 - ft * 0.5, d * 0.5]);
    addMesh(g, roundedBoxGeo(THREE, w, ft, d, 0.006, 2), body.mat.clone(), body.slot, [0, -h * 0.5 + ft * 0.5, d * 0.5]);
    addMesh(g, roundedBoxGeo(THREE, ft, h - ft * 1.6, d, 0.006, 2), body.mat.clone(), body.slot, [-w * 0.5 + ft * 0.5, 0, d * 0.5]);
    addMesh(g, roundedBoxGeo(THREE, ft, h - ft * 1.6, d, 0.006, 2), body.mat.clone(), body.slot, [w * 0.5 - ft * 0.5, 0, d * 0.5]);

    // Layered horizon & sun relief
    addMesh(g, new THREE.CylinderGeometry(0.055, 0.055, 0.006, 24), makeMat(THREE, o, "primary", { roughness: 0.75 }), "primary", [0.16, 0.08, 0.015], [Math.PI / 2, 0, 0]);
    addMesh(g, roundedBoxGeo(THREE, 0.64, 0.14, 0.006, 0.003, 2), makeMat(THREE, o, "accent", { roughness: 0.82 }), "accent", [0, -0.11, 0.015]);
    addMesh(g, roundedBoxGeo(THREE, 0.42, 0.09, 0.006, 0.003, 2), makeMat(THREE, o, "primary", { roughness: 0.82 }), "primary", [-0.1, -0.05, 0.018]);
  } else {
    // Round framed textile / sun relief art (0.50 m diameter)
    const r = 0.25;
    addMesh(g, new THREE.CylinderGeometry(r - 0.015, r - 0.015, 0.012, 36), makeMat(THREE, o, "fabric", { roughness: 0.92 }), "fabric", [0, 0, 0.006], [Math.PI / 2, 0, 0]);
    addMesh(g, new THREE.TorusGeometry(r - 0.01, 0.014, 12, 40), body.mat.clone(), body.slot, [0, 0, 0.014]);
    // Concentric soft half-arcs & sun
    addMesh(g, new THREE.TorusGeometry(0.14, 0.012, 10, 28, Math.PI), makeMat(THREE, o, "primary", { roughness: 0.88 }), "primary", [0, -0.04, 0.014]);
    addMesh(g, new THREE.TorusGeometry(0.09, 0.012, 10, 24, Math.PI), makeMat(THREE, o, "accent", { roughness: 0.88 }), "accent", [0, -0.04, 0.014]);
    addMesh(g, new THREE.CylinderGeometry(0.042, 0.042, 0.008, 20), makeMat(THREE, o, "secondary", { roughness: 0.85 }), "secondary", [0, -0.04, 0.015], [Math.PI / 2, 0, 0]);
  }

  return g;
}

// =====================================================================
// 9. CORKBOARD (thin panel, origin at centre of back face z=0, faces +z)
// =====================================================================
function corkboard(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const body = bodySpec(THREE, o);
  const corkMat = new THREE.MeshStandardMaterial({ color: 0xc59a6b, roughness: 0.94, metalness: 0.0 });
  const pinSlots = ["accent", "primary", "metal"];

  const addNote = (x, y, z, w, h, rotZ, slot, pinIdx) => {
    addMesh(
      g,
      roundedBoxGeo(THREE, w, h, 0.004, 0.0015, 1),
      makeMat(THREE, o, slot, { roughness: 0.82 }),
      slot,
      [x, y, z],
      [0, 0, rotZ]
    );
    const ps = pinSlots[pinIdx % pinSlots.length];
    addMesh(
      g,
      new THREE.SphereGeometry(0.007, 10, 8),
      makeMat(THREE, o, ps, { roughness: 0.35 }),
      ps,
      [x, y + h * 0.38, z + 0.005]
    );
  };

  if (o.variant === 0) {
    // Classic rectangular corkboard (0.68 x 0.48 m)
    const w = 0.68;
    const h = 0.48;
    const d = 0.024;
    addMesh(g, roundedBoxGeo(THREE, w - 0.03, h - 0.03, 0.016, 0.004, 2), corkMat, null, [0, 0, 0.008]);
    const ft = 0.026;
    addMesh(g, roundedBoxGeo(THREE, w, ft, d, 0.007, 2), body.mat.clone(), body.slot, [0, h * 0.5 - ft * 0.5, d * 0.5]);
    addMesh(g, roundedBoxGeo(THREE, w, ft, d, 0.007, 2), body.mat.clone(), body.slot, [0, -h * 0.5 + ft * 0.5, d * 0.5]);
    addMesh(g, roundedBoxGeo(THREE, ft, h - ft * 1.6, d, 0.007, 2), body.mat.clone(), body.slot, [-w * 0.5 + ft * 0.5, 0, d * 0.5]);
    addMesh(g, roundedBoxGeo(THREE, ft, h - ft * 1.6, d, 0.007, 2), body.mat.clone(), body.slot, [w * 0.5 - ft * 0.5, 0, d * 0.5]);

    addNote(-0.18, 0.08, 0.018, 0.13, 0.16, 0.06, "secondary", 0);
    addNote(-0.01, 0.1, 0.018, 0.11, 0.11, -0.08, "primary", 1);
    addNote(0.16, 0.07, 0.018, 0.14, 0.12, 0.04, "secondary", 2);
    addNote(-0.13, -0.1, 0.018, 0.12, 0.1, -0.05, "accent", 1);
    addNote(0.08, -0.09, 0.018, 0.13, 0.14, 0.07, "fabric", 0);
  } else if (o.variant === 1) {
    // Half cork + half wire grid combo board (0.66 x 0.48 m)
    const w = 0.66;
    const h = 0.48;
    const d = 0.022;
    const metalMat = () => makeMat(THREE, o, "metal");
    // Left cork half
    addMesh(g, roundedBoxGeo(THREE, 0.31, h - 0.03, 0.015, 0.004, 2), corkMat, null, [-0.16, 0, 0.008]);
    // Outer frame
    const ft = 0.02;
    addMesh(g, roundedBoxGeo(THREE, w, ft, d, 0.006, 2), metalMat(), "metal", [0, h * 0.5 - ft * 0.5, d * 0.5]);
    addMesh(g, roundedBoxGeo(THREE, w, ft, d, 0.006, 2), metalMat(), "metal", [0, -h * 0.5 + ft * 0.5, d * 0.5]);
    addMesh(g, roundedBoxGeo(THREE, ft, h, d, 0.006, 2), metalMat(), "metal", [-w * 0.5 + ft * 0.5, 0, d * 0.5]);
    addMesh(g, roundedBoxGeo(THREE, ft, h, d, 0.006, 2), metalMat(), "metal", [w * 0.5 - ft * 0.5, 0, d * 0.5]);
    addMesh(g, roundedBoxGeo(THREE, 0.014, h - 0.02, d, 0.004, 2), metalMat(), "metal", [0, 0, d * 0.5]);
    // Right wire grid
    for (let i = 1; i <= 3; i++) {
      addMesh(g, new THREE.CylinderGeometry(0.003, 0.003, h - 0.04, 8), metalMat(), "metal", [i * 0.08, 0, 0.012]);
    }
    for (let j = -2; j <= 2; j++) {
      addMesh(g, new THREE.CylinderGeometry(0.003, 0.003, 0.31, 8), metalMat(), "metal", [0.16, j * 0.075, 0.012], [0, 0, Math.PI / 2]);
    }
    addNote(-0.18, 0.08, 0.018, 0.13, 0.14, -0.05, "secondary", 0);
    addNote(-0.14, -0.09, 0.018, 0.14, 0.11, 0.07, "primary", 1);
    addNote(0.16, 0.06, 0.017, 0.14, 0.15, -0.03, "secondary", 2);
    addNote(0.18, -0.1, 0.017, 0.12, 0.1, 0.05, "accent", 0);
  } else {
    // Arch-top framed pinboard with ribbon bands (0.54 x 0.60 m)
    const archBoard = new THREE.ExtrudeGeometry(archShape(THREE, 0.5, 0.56), {
      depth: 0.016,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 2,
    });
    addMesh(g, archBoard, makeMat(THREE, o, "fabric", { roughness: 0.92 }), "fabric", [0, 0, 0.004]);
    // Subtle outer rim
    const archRim = new THREE.ExtrudeGeometry(archShape(THREE, 0.54, 0.6), {
      depth: 0.01,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 2,
    });
    addMesh(g, archRim, body.mat.clone(), body.slot, [0, 0, 0.004]);
    // Diagonal crisscross ribbons
    for (const s of [-1, 1]) {
      addMesh(
        g,
        roundedBoxGeo(THREE, 0.014, 0.48, 0.004, 0.0015, 1),
        makeMat(THREE, o, "accent", { roughness: 0.8 }),
        "accent",
        [0, -0.02, 0.024],
        [0, 0, s * 0.62]
      );
    }
    addNote(-0.09, 0.09, 0.025, 0.12, 0.14, 0.08, "secondary", 0);
    addNote(0.09, -0.02, 0.025, 0.12, 0.13, -0.06, "primary", 1);
    addNote(-0.06, -0.15, 0.025, 0.14, 0.1, 0.04, "secondary", 2);
  }

  return g;
}

// =====================================================================
// 10. DIARY (closed notebook with ribbon & elastic band, origin at base)
// =====================================================================
function diary(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const w = 0.15;
  const h = o.variant === 2 ? 0.03 : 0.025;
  const l = 0.21;
  const coverSlot = o.variant === 2 ? "fabric" : "primary";
  const coverMat = () => makeMat(THREE, o, coverSlot, { roughness: o.variant === 2 ? 0.9 : 0.62 });

  // Bottom & top covers
  addMesh(g, roundedBoxGeo(THREE, w, 0.0045, l, 0.002, 2), coverMat(), coverSlot, [0, 0.00225, 0]);
  addMesh(g, roundedBoxGeo(THREE, w, 0.0045, l, 0.002, 2), coverMat(), coverSlot, [0, h - 0.00225, 0]);
  // Rounded spine on -x
  addMesh(
    g,
    new THREE.CylinderGeometry(h * 0.5, h * 0.5, l - 0.002, 16, 1, false, Math.PI, Math.PI),
    coverMat(),
    coverSlot,
    [-w * 0.5 + 0.004, h * 0.5, 0],
    [Math.PI / 2, 0, 0]
  );
  // Page block recessed slightly inside covers
  addMesh(
    g,
    roundedBoxGeo(THREE, w - 0.01, h - 0.008, l - 0.01, 0.002, 2),
    makeMat(THREE, o, "secondary", { roughness: 0.88 }),
    "secondary",
    [0.003, h * 0.5, 0]
  );

  // Bookmark ribbon emerging from bottom (+z) edge
  const ribCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.012, h * 0.45, l * 0.45),
    new THREE.Vector3(-0.01, h * 0.2, l * 0.54),
    new THREE.Vector3(-0.005, 0.002, l * 0.62),
    new THREE.Vector3(0.01, 0.002, l * 0.72),
  ]);
  const ribGeo = new THREE.TubeGeometry(ribCurve, 14, 0.0035, 6, false);
  ribGeo.scale(1.6, 0.32, 1);
  addMesh(g, ribGeo, makeMat(THREE, o, "accent", { roughness: 0.75 }), "accent");

  if (o.variant === 0) {
    // Classic Moleskine vertical elastic closure band near +x edge
    addMesh(
      g,
      roundedBoxGeo(THREE, 0.011, h + 0.003, l + 0.004, 0.002, 2),
      makeMat(THREE, o, "accent", { roughness: 0.85 }),
      "accent",
      [w * 0.5 - 0.022, h * 0.5, 0]
    );
  } else if (o.variant === 1) {
    // Metal corner protectors + horizontal elastic band with clasp
    const metalMat = () => makeMat(THREE, o, "metal");
    for (const sz of [-l * 0.5 + 0.01, l * 0.5 - 0.01]) {
      addMesh(g, roundedBoxGeo(THREE, 0.02, h + 0.002, 0.02, 0.003, 2), metalMat(), "metal", [w * 0.5 - 0.01, h * 0.5, sz]);
    }
    addMesh(
      g,
      roundedBoxGeo(THREE, w + 0.005, h + 0.003, 0.014, 0.002, 2),
      makeMat(THREE, o, "accent", { roughness: 0.85 }),
      "accent",
      [0, h * 0.5, 0]
    );
    addMesh(g, new THREE.CylinderGeometry(0.008, 0.008, 0.004, 14), metalMat(), "metal", [0.02, h + 0.002, 0]);
  } else {
    // Plush fabric journal with elastic band & side pen loop + mini pen
    addMesh(
      g,
      roundedBoxGeo(THREE, 0.012, h + 0.003, l + 0.004, 0.002, 2),
      makeMat(THREE, o, "accent", { roughness: 0.85 }),
      "accent",
      [w * 0.5 - 0.02, h * 0.5, 0]
    );
    // Pen loop & slim pen on +x side
    addMesh(
      g,
      new THREE.TorusGeometry(0.007, 0.0022, 8, 16),
      makeMat(THREE, o, "accent", { roughness: 0.85 }),
      "accent",
      [w * 0.5 + 0.005, h * 0.5, 0.01]
    );
    addMesh(
      g,
      new THREE.CylinderGeometry(0.0045, 0.0045, 0.14, 10),
      makeMat(THREE, o, "metal"),
      "metal",
      [w * 0.5 + 0.006, h * 0.5, 0.01],
      [Math.PI / 2, 0, 0]
    );
  }

  return g;
}

// =====================================================================
// 11. WARDROBE (0.9 x 0.55 m, 1.9 m high, origin on floor, facing +z)
// =====================================================================
function wardrobe(THREE, opts) {
  const o = resolveOpts(opts);
  const g = new THREE.Group();
  const body = bodySpec(THREE, o);
  const metalMat = () => makeMat(THREE, o, "metal");
  const w = 0.9;
  const d = 0.55;
  const h = 1.9;

  if (o.variant === 0) {
    // Classic double-door shaker wardrobe
    const legH = 0.12;
    for (const sx of [-0.39, 0.39]) {
      for (const sz of [-0.22, 0.22]) {
        addMesh(g, taperedLegGeo(THREE, 0.025, 0.018, legH, 12), body.mat.clone(), body.slot, [sx, legH * 0.5, sz]);
      }
    }
    const carH = h - legH - 0.03;
    const carY = legH + carH * 0.5;
    addMesh(g, roundedBoxGeo(THREE, w, carH, d - 0.025, 0.014, 3), body.mat.clone(), body.slot, [0, carY, -0.012]);
    // Crown moulding
    addMesh(g, roundedBoxGeo(THREE, w + 0.03, 0.038, d + 0.02, 0.012, 3), body.mat.clone(), body.slot, [0, h - 0.019, 0]);

    // 2 tall panelled doors facing +z
    const doorW = 0.425;
    const doorH = carH - 0.05;
    for (const sx of [-0.22, 0.22]) {
      addMesh(
        g,
        roundedBoxGeo(THREE, doorW, doorH, 0.024, 0.009, 2),
        makeMat(THREE, o, "secondary", { roughness: 0.54 }),
        "secondary",
        [sx, carY, d * 0.5 - 0.014]
      );
      // Recessed shaker trim frame
      addMesh(
        g,
        roundedBoxGeo(THREE, doorW - 0.09, doorH - 0.12, 0.008, 0.004, 2),
        makeMat(THREE, o, "fabric", { roughness: 0.65 }),
        "fabric",
        [sx, carY, d * 0.5 - 0.001]
      );
      // Vertical bar handle
      addMesh(
        g,
        roundedBoxGeo(THREE, 0.016, 0.18, 0.024, 0.006, 2),
        metalMat(),
        "metal",
        [sx > 0 ? 0.045 : -0.045, carY - 0.04, d * 0.5 + 0.012]
      );
    }
  } else if (o.variant === 1) {
    // Wardrobe with 2 upper doors + 2 wide lower drawers
    const legH = 0.11;
    for (const sx of [-0.38, 0.38]) {
      for (const sz of [-0.21, 0.21]) {
        addMesh(g, taperedLegGeo(THREE, 0.024, 0.016, legH, 12), body.mat.clone(), body.slot, [sx, legH * 0.5, sz]);
      }
    }
    const carH = h - legH;
    addMesh(g, roundedBoxGeo(THREE, w, carH, d - 0.025, 0.016, 3), body.mat.clone(), body.slot, [0, legH + carH * 0.5, -0.012]);

    // 2 wide lower drawers
    for (let i = 0; i < 2; i++) {
      const dy = legH + 0.13 + i * 0.23;
      addMesh(
        g,
        roundedBoxGeo(THREE, w - 0.05, 0.205, 0.024, 0.009, 2),
        makeMat(THREE, o, "secondary", { roughness: 0.52 }),
        "secondary",
        [0, dy, d * 0.5 - 0.012]
      );
      for (const sx of [-0.18, 0.18]) {
        addMesh(g, roundedBoxGeo(THREE, 0.1, 0.015, 0.022, 0.005, 2), metalMat(), "metal", [sx, dy + 0.02, d * 0.5 + 0.01]);
      }
    }
    // 2 upper doors
    const doorH = 1.24;
    const doorY = legH + 0.5 + doorH * 0.5;
    for (const sx of [-0.22, 0.22]) {
      addMesh(
        g,
        roundedBoxGeo(THREE, 0.425, doorH, 0.024, 0.009, 2),
        makeMat(THREE, o, "secondary", { roughness: 0.52 }),
        "secondary",
        [sx, doorY, d * 0.5 - 0.012]
      );
      addMesh(g, new THREE.SphereGeometry(0.018, 12, 10), metalMat(), "metal", [sx > 0 ? 0.045 : -0.045, doorY - 0.22, d * 0.5 + 0.014]);
    }
  } else {
    // Modern dorm wardrobe with tall left door, right half-door & 2 open cubbies
    // Slim metal base frame
    const baseH = 0.14;
    for (const sx of [-0.42, 0.42]) {
      for (const sz of [-0.24, 0.24]) {
        addMesh(g, roundedBoxGeo(THREE, 0.026, baseH, 0.026, 0.006), metalMat(), "metal", [sx, baseH * 0.5, sz]);
      }
    }
    addMesh(g, roundedBoxGeo(THREE, 0.86, 0.024, 0.5, 0.006), metalMat(), "metal", [0, baseH - 0.012, 0]);

    const carH = h - baseH;
    const carY = baseH + carH * 0.5;
    // Left enclosed section
    addMesh(g, roundedBoxGeo(THREE, 0.46, carH, d - 0.025, 0.014, 3), body.mat.clone(), body.slot, [-0.22, carY, -0.012]);
    // Right lower cabinet
    addMesh(g, roundedBoxGeo(THREE, 0.44, 0.96, d - 0.025, 0.014, 3), body.mat.clone(), body.slot, [0.23, baseH + 0.48, -0.012]);
    // Right upper open cubbies frame
    addMesh(g, roundedBoxGeo(THREE, 0.028, 0.8, d - 0.025, 0.009), body.mat.clone(), body.slot, [0.436, 1.5, -0.012]);
    addMesh(g, roundedBoxGeo(THREE, 0.44, 0.028, d - 0.025, 0.009), body.mat.clone(), body.slot, [0.23, 1.886, -0.012]);
    addMesh(g, roundedBoxGeo(THREE, 0.42, 0.026, d - 0.03, 0.008), body.mat.clone(), body.slot, [0.23, 1.49, -0.012]);
    addMesh(
      g,
      roundedBoxGeo(THREE, 0.43, 0.78, 0.018, 0.005),
      makeMat(THREE, o, "secondary", { roughness: 0.75 }),
      "secondary",
      [0.23, 1.5, -d * 0.5 + 0.01]
    );

    // Tall left accent door
    addMesh(
      g,
      roundedBoxGeo(THREE, 0.43, carH - 0.04, 0.024, 0.009, 2),
      makeMat(THREE, o, "primary", { roughness: 0.5 }),
      "primary",
      [-0.22, carY, d * 0.5 - 0.012]
    );
    addMesh(g, roundedBoxGeo(THREE, 0.016, 0.16, 0.022, 0.005), metalMat(), "metal", [-0.04, carY - 0.06, d * 0.5 + 0.012]);

    // Lower right door
    addMesh(
      g,
      roundedBoxGeo(THREE, 0.41, 0.92, 0.024, 0.009, 2),
      makeMat(THREE, o, "secondary", { roughness: 0.54 }),
      "secondary",
      [0.23, baseH + 0.48, d * 0.5 - 0.012]
    );
    addMesh(g, roundedBoxGeo(THREE, 0.016, 0.14, 0.022, 0.005), metalMat(), "metal", [0.06, baseH + 0.72, d * 0.5 + 0.012]);

    // Cozy folded sweater stack & storage bin inside open cubbies
    addMesh(
      g,
      roundedBoxGeo(THREE, 0.28, 0.19, 0.34, 0.02, 2),
      makeMat(THREE, o, "fabric", { roughness: 0.92 }),
      "fabric",
      [0.23, 1.2, 0.02]
    );
    for (let i = 0; i < 3; i++) {
      const slot = i === 1 ? "accent" : "secondary";
      addMesh(
        g,
        pillowGeo(THREE, 0.28, 0.065, 0.26, 12),
        makeMat(THREE, o, slot, { roughness: 0.94 }),
        slot,
        [0.22, 1.535 + i * 0.056, 0.02]
      );
    }
  }

  return g;
}

// =====================================================================
// EXPORTS
// =====================================================================
export const ITEMS = {
  bed,
  desk,
  chair,
  shelf,
  rug,
  plant,
  lamp,
  wallArt,
  corkboard,
  diary,
  wardrobe,
};

export function recolor(group, palette) {
  if (!group || !palette) return;
  group.traverse((obj) => {
    if (!obj.isMesh) return;
    const slot = obj.userData && obj.userData.slot;
    if (!slot || !Object.prototype.hasOwnProperty.call(palette, slot) || palette[slot] == null) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (m && m.color) m.color.set(palette[slot]);
    }
  });
}
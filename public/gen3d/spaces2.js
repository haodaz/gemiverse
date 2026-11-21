// Cutaway-diorama extra spaces for a student's AI companion:
// Personal Science Laboratory (`lab`) and Library Reading Room (`readingRoom`).
// Plain ES module, zero imports, zero globals. Every builder takes `THREE` (r160) first.

const DEFAULT_OPTS = {
  lab: {
    wall: 0xeef4f2,
    trim: 0xcad6d2,
    floor: 0xe5ece9,
    accent: 0x45b5a4,
    time: "day"
  },
  readingRoom: {
    wall: 0xe8dfd0,
    trim: 0x6b4a34,
    floor: 0x9c6f48,
    accent: 0x2c6e49,
    time: "day"
  }
};

const TIME_PRESETS = {
  day: {
    skyColor: 0xaad8f7,
    skyEmissive: 0x8ccaf4,
    skyEmissiveIntensity: 0.55,
    lampIntensity: 0.35,
    stripIntensity: 0.45,
    liquidGlow: 0.16,
    showNightSky: false
  },
  dusk: {
    skyColor: 0xe89874,
    skyEmissive: 0xd97468,
    skyEmissiveIntensity: 0.65,
    lampIntensity: 1.15,
    stripIntensity: 0.95,
    liquidGlow: 0.42,
    showNightSky: false
  },
  night: {
    skyColor: 0x162146,
    skyEmissive: 0x1e2e63,
    skyEmissiveIntensity: 0.48,
    lampIntensity: 1.75,
    stripIntensity: 1.45,
    liquidGlow: 0.68,
    showNightSky: true
  }
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function resolveOpts(defaults, opts) {
  const o = opts || {};
  const time = o.time === "dusk" || o.time === "night" ? o.time : "day";
  return {
    wall: o.wall !== undefined ? o.wall : defaults.wall,
    trim: o.trim !== undefined ? o.trim : defaults.trim,
    floor: o.floor !== undefined ? o.floor : defaults.floor,
    accent: o.accent !== undefined ? o.accent : defaults.accent,
    time
  };
}

function makeMat(THREE, color, props) {
  const p = props || {};
  return new THREE.MeshStandardMaterial({
    color,
    roughness: p.roughness !== undefined ? p.roughness : 0.72,
    metalness: p.metalness !== undefined ? p.metalness : 0.05,
    transparent: Boolean(p.transparent),
    opacity: p.opacity !== undefined ? p.opacity : 1,
    emissive: p.emissive !== undefined ? p.emissive : 0x000000,
    emissiveIntensity: p.emissiveIntensity !== undefined ? p.emissiveIntensity : 0,
    side: p.side !== undefined ? p.side : THREE.FrontSide
  });
}

function addMesh(THREE, parent, geometry, material, cfg) {
  const c = cfg || {};
  const mesh = new THREE.Mesh(geometry, material);
  if (c.pos) mesh.position.set(c.pos[0], c.pos[1], c.pos[2]);
  if (c.rot) mesh.rotation.set(c.rot[0], c.rot[1], c.rot[2]);
  if (c.scale) mesh.scale.set(c.scale[0], c.scale[1], c.scale[2]);
  mesh.castShadow = c.castShadow !== undefined ? c.castShadow : true;
  mesh.receiveShadow = c.receiveShadow !== undefined ? c.receiveShadow : true;
  if (c.slot) mesh.userData.slot = c.slot;
  if (c.name) mesh.name = c.name;
  parent.add(mesh);
  return mesh;
}

function roundedRectShape(THREE, w, h, r) {
  const shape = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;
  const rad = Math.min(r, hw * 0.9, hh * 0.9);
  shape.moveTo(-hw + rad, -hh);
  shape.lineTo(hw - rad, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + rad);
  shape.lineTo(hw, hh - rad);
  shape.quadraticCurveTo(hw, hh, hw - rad, hh);
  shape.lineTo(-hw + rad, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - rad);
  shape.lineTo(-hw, -hh + rad);
  shape.quadraticCurveTo(-hw, -hh, -hw + rad, -hh);
  return shape;
}

function roundedBoxGeo(THREE, w, h, d, radius, bevelSegs) {
  const b = Math.min(radius !== undefined ? radius : 0.015, w * 0.22, h * 0.22, d * 0.22);
  const iw = Math.max(0.002, w - b * 2);
  const ih = Math.max(0.002, h - b * 2);
  const id = Math.max(0.002, d - b * 2);
  const shape = roundedRectShape(THREE, iw, ih, b * 0.7);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: id,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: bevelSegs !== undefined ? bevelSegs : 2,
    curveSegments: 6
  });
  geo.center();
  return geo;
}

function addSkyBackdrop(THREE, parent, timeKey, bounds) {
  const preset = TIME_PRESETS[timeKey] || TIME_PRESETS.day;
  const w = bounds.w;
  const h = bounds.h;
  const mat = makeMat(THREE, preset.skyColor, {
    roughness: 0.95,
    metalness: 0,
    emissive: preset.skyEmissive,
    emissiveIntensity: preset.skyEmissiveIntensity
  });
  addMesh(THREE, parent, new THREE.PlaneGeometry(w, h), mat, {
    pos: [bounds.x, bounds.y, bounds.z],
    castShadow: false,
    receiveShadow: false,
    name: "skyBackdrop"
  });

  if (preset.showNightSky) {
    const starMat = makeMat(THREE, 0xfff8dc, {
      roughness: 0.4,
      emissive: 0xfff2b8,
      emissiveIntensity: 1.4
    });
    const rand = mulberry32(9021);
    const starGeo = new THREE.CircleGeometry(0.012, 8);
    for (let i = 0; i < 18; i++) {
      const sx = bounds.x + (rand() - 0.5) * (w * 0.82);
      const sy = bounds.y + (rand() - 0.5) * (h * 0.72);
      const s = 0.55 + rand() * 0.85;
      addMesh(THREE, parent, starGeo, starMat, {
        pos: [sx, sy, bounds.z + 0.006],
        scale: [s, s, 1],
        castShadow: false,
        receiveShadow: false
      });
    }
    const moonMat = makeMat(THREE, 0xfff4cc, {
      roughness: 0.3,
      emissive: 0xffe9a6,
      emissiveIntensity: 1.25
    });
    addMesh(THREE, parent, new THREE.CircleGeometry(0.085, 20), moonMat, {
      pos: [bounds.x + w * 0.2, bounds.y + h * 0.16, bounds.z + 0.008],
      castShadow: false,
      receiveShadow: false
    });
  } else if (timeKey === "dusk") {
    const glowMat = makeMat(THREE, 0xffd2a6, {
      roughness: 0.9,
      emissive: 0xffa466,
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.55
    });
    addMesh(THREE, parent, new THREE.PlaneGeometry(w, h * 0.38), glowMat, {
      pos: [bounds.x, bounds.y - h * 0.25, bounds.z + 0.005],
      castShadow: false,
      receiveShadow: false
    });
  }
}

// ============================================================================
// SPACE 1: PERSONAL SCIENCE LABORATORY
// ============================================================================

function buildLabShell(THREE, root, cfg, preset) {
  const wallT = 0.16;
  const wallH = 2.7;
  const floorT = 0.16;

  // Floor slab (4x4 interior from -2 to 2, extended under walls)
  const floorMat = makeMat(THREE, cfg.floor, { roughness: 0.42, metalness: 0.04 });
  addMesh(THREE, root, new THREE.BoxGeometry(4 + wallT, floorT, 4 + wallT), floorMat, {
    pos: [-wallT / 2, -floorT / 2, -wallT / 2],
    slot: "secondary",
    name: "labFloor"
  });

  // Subtle speckled vinyl flecks
  const rand = mulberry32(4217);
  const speckColors = [0xc2d0cc, 0xd8e2df, 0x9db8b2, 0xf6faf8];
  const speckMats = speckColors.map((c) => makeMat(THREE, c, { roughness: 0.45, metalness: 0.02 }));
  const speckGeo = new THREE.CircleGeometry(0.016, 6);
  for (let i = 0; i < 95; i++) {
    const sx = -1.9 + rand() * 3.8;
    const sz = -1.9 + rand() * 3.8;
    const sc = 0.55 + rand() * 0.95;
    addMesh(THREE, root, speckGeo, speckMats[i % speckMats.length], {
      pos: [sx, 0.0018, sz],
      rot: [-Math.PI / 2, 0, rand() * Math.PI],
      scale: [sc, sc * (0.7 + rand() * 0.6), 1],
      castShadow: false,
      receiveShadow: true
    });
  }

  // Back wall (z = -2) with sleek clerestory window cutout
  const backShape = new THREE.Shape();
  backShape.moveTo(-2 - wallT, 0);
  backShape.lineTo(2, 0);
  backShape.lineTo(2, wallH);
  backShape.lineTo(-2 - wallT, wallH);
  backShape.closePath();

  const winX0 = -1.1;
  const winX1 = 1.78;
  const winY0 = 2.24;
  const winY1 = 2.54;
  const winHole = new THREE.Path();
  winHole.moveTo(winX0, winY0);
  winHole.lineTo(winX1, winY0);
  winHole.lineTo(winX1, winY1);
  winHole.lineTo(winX0, winY1);
  winHole.closePath();
  backShape.holes.push(winHole);

  const wallMat = makeMat(THREE, cfg.wall, { roughness: 0.78, metalness: 0.02 });
  const backGeo = new THREE.ExtrudeGeometry(backShape, { depth: wallT, bevelEnabled: false });
  addMesh(THREE, root, backGeo, wallMat, {
    pos: [0, 0, -2 - wallT],
    slot: "primary",
    name: "labBackWall"
  });

  // Clerestory window frame, mullions, and glass
  const frameMat = makeMat(THREE, cfg.trim, { roughness: 0.55, metalness: 0.08 });
  const winW = winX1 - winX0;
  const winH = winY1 - winY0;
  const winCx = (winX0 + winX1) / 2;
  const winCy = (winY0 + winY1) / 2;
  addMesh(THREE, root, roundedBoxGeo(THREE, winW + 0.06, 0.035, wallT + 0.03, 0.008), frameMat, {
    pos: [winCx, winY0, -2 - wallT / 2],
    slot: "secondary"
  });
  addMesh(THREE, root, roundedBoxGeo(THREE, winW + 0.06, 0.035, wallT + 0.03, 0.008), frameMat, {
    pos: [winCx, winY1, -2 - wallT / 2],
    slot: "secondary"
  });
  for (let i = 0; i <= 3; i++) {
    const mx = winX0 + (winW * i) / 3;
    addMesh(THREE, root, roundedBoxGeo(THREE, 0.032, winH, wallT + 0.02, 0.006), frameMat, {
      pos: [mx, winCy, -2 - wallT / 2],
      slot: "secondary"
    });
  }
  const glassMat = makeMat(THREE, 0xdff5ff, {
    roughness: 0.08,
    metalness: 0.1,
    transparent: true,
    opacity: 0.24
  });
  addMesh(THREE, root, new THREE.PlaneGeometry(winW, winH), glassMat, {
    pos: [winCx, winCy, -2.08],
    castShadow: false,
    receiveShadow: false
  });

  // Sky backdrop plane behind the clerestory window
  addSkyBackdrop(THREE, root, cfg.time, {
    x: winCx,
    y: winCy,
    z: -2.26,
    w: winW + 0.35,
    h: winH + 0.28
  });

  // Left wall (x = -2)
  addMesh(THREE, root, new THREE.BoxGeometry(wallT, wallH, 4), wallMat, {
    pos: [-2 - wallT / 2, wallH / 2, 0],
    slot: "primary",
    name: "labLeftWall"
  });

  // Coved skirting along both walls (quarter-round concave cove curving into the floor)
  const coveShape = new THREE.Shape();
  coveShape.moveTo(0, 0);
  coveShape.lineTo(0.045, 0);
  coveShape.quadraticCurveTo(0.015, 0.015, 0.014, 0.048);
  coveShape.lineTo(0.014, 0.105);
  coveShape.lineTo(0, 0.105);
  coveShape.closePath();

  const coveMat = makeMat(THREE, cfg.trim, { roughness: 0.45, metalness: 0.04 });
  const backCoveGeo = new THREE.ExtrudeGeometry(coveShape, { depth: 4, bevelEnabled: false });
  addMesh(THREE, root, backCoveGeo, coveMat, {
    pos: [-2, 0, -2],
    rot: [0, Math.PI / 2, 0],
    slot: "secondary",
    name: "coveSkirtingBack"
  });

  const leftCoveGeo = new THREE.ExtrudeGeometry(coveShape, { depth: 4, bevelEnabled: false });
  addMesh(THREE, root, leftCoveGeo, coveMat, {
    pos: [-2, 0, -2],
    slot: "secondary",
    name: "coveSkirtingLeft"
  });
}

function buildLabBench(THREE, root, cfg) {
  const bench = new THREE.Group();
  bench.name = "labBench";
  root.add(bench);

  const x0 = -0.95;
  const x1 = 1.92;
  const len = x1 - x0;
  const cx = (x0 + x1) / 2;
  const depth = 0.72;
  const cz = -2 + depth / 2;
  const topY = 0.88;
  const topThick = 0.048;

  const cabMat = makeMat(THREE, 0xf4f7f6, { roughness: 0.58, metalness: 0.04 });
  const kickMat = makeMat(THREE, 0x3b4449, { roughness: 0.7, metalness: 0.1 });
  const resinMat = makeMat(THREE, 0x252b30, { roughness: 0.34, metalness: 0.08 });
  const metalMat = makeMat(THREE, 0xc7d0d4, { roughness: 0.25, metalness: 0.85 });
  const accentMat = makeMat(THREE, cfg.accent, { roughness: 0.5, metalness: 0.08 });

  // Left cabinet bank (-0.95 to 0.25)
  const leftW = 1.18;
  const leftCx = x0 + leftW / 2;
  addMesh(THREE, bench, new THREE.BoxGeometry(leftW - 0.02, 0.09, depth - 0.12), kickMat, {
    pos: [leftCx, 0.045, cz - 0.02]
  });
  addMesh(THREE, bench, roundedBoxGeo(THREE, leftW, 0.74, depth - 0.04, 0.012), cabMat, {
    pos: [leftCx, 0.09 + 0.37, cz - 0.01],
    slot: "primary"
  });

  // Left bank drawer & door fronts
  for (let col = 0; col < 2; col++) {
    const dx = x0 + 0.3 + col * 0.58;
    // Top drawer
    addMesh(THREE, bench, roundedBoxGeo(THREE, 0.53, 0.16, 0.022, 0.008), cabMat, {
      pos: [dx, 0.72, cz + depth / 2 - 0.018],
      slot: "primary"
    });
    addMesh(THREE, bench, roundedBoxGeo(THREE, 0.14, 0.016, 0.024, 0.005), metalMat, {
      pos: [dx, 0.72, cz + depth / 2],
      slot: "metal"
    });
    // Lower door
    addMesh(THREE, bench, roundedBoxGeo(THREE, 0.53, 0.48, 0.022, 0.008), cabMat, {
      pos: [dx, 0.37, cz + depth / 2 - 0.018],
      slot: "primary"
    });
    addMesh(THREE, bench, roundedBoxGeo(THREE, 0.016, 0.14, 0.024, 0.005), metalMat, {
      pos: [dx + (col === 0 ? 0.2 : -0.2), 0.48, cz + depth / 2],
      slot: "metal"
    });
  }

  // Right sink cabinet bank (1.02 to 1.92)
  const rightW = 0.88;
  const rightCx = x1 - rightW / 2;
  addMesh(THREE, bench, new THREE.BoxGeometry(rightW - 0.02, 0.09, depth - 0.12), kickMat, {
    pos: [rightCx, 0.045, cz - 0.02]
  });
  addMesh(THREE, bench, roundedBoxGeo(THREE, rightW, 0.74, depth - 0.04, 0.012), cabMat, {
    pos: [rightCx, 0.09 + 0.37, cz - 0.01],
    slot: "primary"
  });
  for (let col = 0; col < 2; col++) {
    const dx = rightCx - 0.21 + col * 0.42;
    addMesh(THREE, bench, roundedBoxGeo(THREE, 0.39, 0.66, 0.022, 0.008), cabMat, {
      pos: [dx, 0.46, cz + depth / 2 - 0.018],
      slot: "primary"
    });
    addMesh(THREE, bench, roundedBoxGeo(THREE, 0.016, 0.14, 0.024, 0.005), metalMat, {
      pos: [dx + (col === 0 ? 0.14 : -0.14), 0.55, cz + depth / 2],
      slot: "metal"
    });
  }

  // Under-bench support rail across knee space
  addMesh(THREE, bench, roundedBoxGeo(THREE, 0.85, 0.06, 0.06, 0.008), accentMat, {
    pos: [0.64, 0.8, cz + 0.24],
    slot: "accent"
  });

  // Dark resin tabletop with bevelled edges
  addMesh(THREE, bench, roundedBoxGeo(THREE, len + 0.04, topThick, depth + 0.04, 0.012), resinMat, {
    pos: [cx, topY - topThick / 2, cz + 0.01],
    name: "labResinTop"
  });

  // Back resin backsplash
  addMesh(THREE, bench, roundedBoxGeo(THREE, len + 0.04, 0.11, 0.028, 0.006), resinMat, {
    pos: [cx, topY + 0.055, -1.986]
  });

  // Integrated small lab sink on right side
  const sinkX = 1.48;
  const sinkZ = cz + 0.02;
  const rimMat = makeMat(THREE, 0xb8c3c8, { roughness: 0.28, metalness: 0.82 });
  const basinMat = makeMat(THREE, 0x161b1e, { roughness: 0.4, metalness: 0.15 });
  addMesh(THREE, bench, roundedBoxGeo(THREE, 0.44, 0.016, 0.36, 0.01), rimMat, {
    pos: [sinkX, topY + 0.004, sinkZ],
    slot: "metal"
  });
  addMesh(THREE, bench, roundedBoxGeo(THREE, 0.37, 0.014, 0.29, 0.008), basinMat, {
    pos: [sinkX, topY + 0.008, sinkZ]
  });
  // Drain
  addMesh(THREE, bench, new THREE.CylinderGeometry(0.024, 0.024, 0.008, 16), rimMat, {
    pos: [sinkX, topY + 0.014, sinkZ],
    slot: "metal"
  });

  // Gooseneck lab faucet
  const faucetZ = sinkZ - 0.21;
  addMesh(THREE, bench, new THREE.CylinderGeometry(0.026, 0.03, 0.022, 16), metalMat, {
    pos: [sinkX, topY + 0.011, faucetZ],
    slot: "metal"
  });
  addMesh(THREE, bench, new THREE.CylinderGeometry(0.012, 0.013, 0.21, 14), metalMat, {
    pos: [sinkX, topY + 0.12, faucetZ],
    slot: "metal"
  });
  addMesh(THREE, bench, new THREE.TorusGeometry(0.068, 0.011, 12, 20, Math.PI), metalMat, {
    pos: [sinkX, topY + 0.225, faucetZ + 0.068],
    rot: [0, Math.PI / 2, 0],
    slot: "metal"
  });
  addMesh(THREE, bench, new THREE.CylinderGeometry(0.01, 0.012, 0.04, 12), metalMat, {
    pos: [sinkX, topY + 0.205, faucetZ + 0.136],
    slot: "metal"
  });
  // Twin faucet handles
  for (const dir of [-1, 1]) {
    addMesh(THREE, bench, new THREE.CylinderGeometry(0.01, 0.012, 0.036, 12), metalMat, {
      pos: [sinkX + dir * 0.075, topY + 0.022, faucetZ],
      slot: "metal"
    });
    addMesh(THREE, bench, roundedBoxGeo(THREE, 0.044, 0.01, 0.01, 0.004), accentMat, {
      pos: [sinkX + dir * 0.075, topY + 0.042, faucetZ],
      slot: "accent"
    });
  }
}

function buildReagentShelf(THREE, root, cfg, preset) {
  const shelfGroup = new THREE.Group();
  shelfGroup.name = "reagentShelf";
  root.add(shelfGroup);

  const shelfMat = makeMat(THREE, 0xf2f6f5, { roughness: 0.5, metalness: 0.05 });
  const metalMat = makeMat(THREE, 0xb9c5c9, { roughness: 0.28, metalness: 0.82 });
  const glassMat = makeMat(THREE, 0xebfaff, {
    roughness: 0.08,
    metalness: 0.08,
    transparent: true,
    opacity: 0.34
  });
  const corkMat = makeMat(THREE, 0xb88b5a, { roughness: 0.85, metalness: 0.02 });

  const shelfCx = -0.12;
  const shelfW = 1.48;
  const shelfD = 0.24;
  const shelfZ = -2 + shelfD / 2;
  const heights = [1.46, 1.84];

  for (const sy of heights) {
    // Shelf plank
    addMesh(THREE, shelfGroup, roundedBoxGeo(THREE, shelfW, 0.028, shelfD, 0.007), shelfMat, {
      pos: [shelfCx, sy, shelfZ],
      slot: "primary"
    });
    // Front safety rail
    addMesh(THREE, shelfGroup, new THREE.CylinderGeometry(0.005, 0.005, shelfW - 0.04, 10), metalMat, {
      pos: [shelfCx, sy + 0.042, shelfZ + shelfD / 2 - 0.018],
      rot: [0, 0, Math.PI / 2],
      slot: "metal"
    });
    // Brackets & rail posts
    for (const bx of [shelfCx - 0.58, shelfCx, shelfCx + 0.58]) {
      addMesh(THREE, shelfGroup, roundedBoxGeo(THREE, 0.022, 0.12, 0.022, 0.004), metalMat, {
        pos: [bx, sy - 0.068, -1.988],
        slot: "metal"
      });
      addMesh(THREE, shelfGroup, roundedBoxGeo(THREE, 0.02, 0.02, shelfD - 0.03, 0.004), metalMat, {
        pos: [bx, sy - 0.022, shelfZ - 0.01],
        slot: "metal"
      });
      addMesh(THREE, shelfGroup, new THREE.CylinderGeometry(0.005, 0.005, 0.04, 8), metalMat, {
        pos: [bx, sy + 0.022, shelfZ + shelfD / 2 - 0.018],
        slot: "metal"
      });
    }
  }

  // Reusable Lathe geometries for glass flasks and reagent bottles
  const erlenmeyerPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.048, 0.0),
    new THREE.Vector2(0.052, 0.016),
    new THREE.Vector2(0.017, 0.105),
    new THREE.Vector2(0.016, 0.145),
    new THREE.Vector2(0.021, 0.152)
  ];
  const erlenmeyerGeo = new THREE.LatheGeometry(erlenmeyerPts, 18);
  const erlenLiquidPts = [
    new THREE.Vector2(0.0, 0.004),
    new THREE.Vector2(0.044, 0.004),
    new THREE.Vector2(0.047, 0.016),
    new THREE.Vector2(0.032, 0.056),
    new THREE.Vector2(0.0, 0.056)
  ];
  const erlenLiquidGeo = new THREE.LatheGeometry(erlenLiquidPts, 18);

  const roundFlaskPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.028, 0.0),
    new THREE.Vector2(0.05, 0.044),
    new THREE.Vector2(0.044, 0.082),
    new THREE.Vector2(0.015, 0.102),
    new THREE.Vector2(0.015, 0.148),
    new THREE.Vector2(0.02, 0.155)
  ];
  const roundFlaskGeo = new THREE.LatheGeometry(roundFlaskPts, 18);
  const roundLiquidPts = [
    new THREE.Vector2(0.0, 0.005),
    new THREE.Vector2(0.026, 0.005),
    new THREE.Vector2(0.045, 0.044),
    new THREE.Vector2(0.04, 0.068),
    new THREE.Vector2(0.0, 0.068)
  ];
  const roundLiquidGeo = new THREE.LatheGeometry(roundLiquidPts, 18);

  const bottlePts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.038, 0.0),
    new THREE.Vector2(0.038, 0.105),
    new THREE.Vector2(0.018, 0.125),
    new THREE.Vector2(0.018, 0.148),
    new THREE.Vector2(0.022, 0.152)
  ];
  const bottleGeo = new THREE.LatheGeometry(bottlePts, 16);
  const bottleLiquidGeo = new THREE.CylinderGeometry(0.033, 0.033, 0.072, 16);

  const vesselSpecs = [
    // Lower shelf (y = 1.474)
    { type: "erlen", x: -0.72, y: 1.474, z: shelfZ + 0.01, color: 0x5be3d4, scale: 1.05 },
    { type: "round", x: -0.54, y: 1.474, z: shelfZ - 0.01, color: 0xd98ef5, scale: 1.0 },
    { type: "bottle", x: -0.34, y: 1.474, z: shelfZ + 0.01, color: 0xffc86b, scale: 1.08 },
    { type: "bottle", x: -0.21, y: 1.474, z: shelfZ - 0.015, color: 0x79c2ff, scale: 0.92 },
    { type: "erlen", x: 0.24, y: 1.474, z: shelfZ + 0.01, color: 0x8ef0a8, scale: 0.96 },
    { type: "round", x: 0.44, y: 1.474, z: shelfZ, color: 0xff8ea8, scale: 1.08 },
    // Upper shelf (y = 1.854)
    { type: "bottle", x: -0.68, y: 1.854, z: shelfZ, color: 0x85d4ff, scale: 1.1 },
    { type: "bottle", x: -0.52, y: 1.854, z: shelfZ + 0.015, color: 0x9df2c6, scale: 0.95 },
    { type: "erlen", x: -0.28, y: 1.854, z: shelfZ, color: 0xffb38a, scale: 1.0 },
    { type: "round", x: -0.05, y: 1.854, z: shelfZ - 0.01, color: 0x67e8dc, scale: 1.12 },
    { type: "bottle", x: 0.18, y: 1.854, z: shelfZ + 0.01, color: 0xc9a3ff, scale: 1.02 },
    { type: "erlen", x: 0.42, y: 1.854, z: shelfZ, color: 0xffe07d, scale: 0.9 }
  ];

  for (const v of vesselSpecs) {
    const liqMat = makeMat(THREE, v.color, {
      roughness: 0.18,
      metalness: 0.02,
      transparent: true,
      opacity: 0.78,
      emissive: v.color,
      emissiveIntensity: preset.liquidGlow
    });
    const s = v.scale;
    if (v.type === "erlen") {
      addMesh(THREE, shelfGroup, erlenLiquidGeo, liqMat, {
        pos: [v.x, v.y, v.z],
        scale: [s, s, s],
        castShadow: false
      });
      addMesh(THREE, shelfGroup, erlenmeyerGeo, glassMat, {
        pos: [v.x, v.y, v.z],
        scale: [s, s, s],
        castShadow: false
      });
    } else if (v.type === "round") {
      addMesh(THREE, shelfGroup, roundLiquidGeo, liqMat, {
        pos: [v.x, v.y, v.z],
        scale: [s, s, s],
        castShadow: false
      });
      addMesh(THREE, shelfGroup, roundFlaskGeo, glassMat, {
        pos: [v.x, v.y, v.z],
        scale: [s, s, s],
        castShadow: false
      });
    } else {
      addMesh(THREE, shelfGroup, bottleLiquidGeo, liqMat, {
        pos: [v.x, v.y + 0.042 * s, v.z],
        scale: [s, s, s],
        castShadow: false
      });
      addMesh(THREE, shelfGroup, bottleGeo, glassMat, {
        pos: [v.x, v.y, v.z],
        scale: [s, s, s],
        castShadow: false
      });
      // Cork stopper
      addMesh(THREE, shelfGroup, new THREE.CylinderGeometry(0.017, 0.014, 0.026, 12), corkMat, {
        pos: [v.x, v.y + 0.158 * s, v.z],
        scale: [s, s, s],
        slot: "wood"
      });
    }
  }

  // Small wooden test-tube rack on the lower shelf center
  const rackX = 0.02;
  const rackY = 1.474;
  const rackWood = makeMat(THREE, 0xc79f72, { roughness: 0.65, metalness: 0.03 });
  addMesh(THREE, shelfGroup, roundedBoxGeo(THREE, 0.22, 0.014, 0.065, 0.004), rackWood, {
    pos: [rackX, rackY + 0.007, shelfZ],
    slot: "wood"
  });
  addMesh(THREE, shelfGroup, roundedBoxGeo(THREE, 0.22, 0.012, 0.06, 0.004), rackWood, {
    pos: [rackX, rackY + 0.075, shelfZ],
    slot: "wood"
  });
  for (const dx of [-0.095, 0.095]) {
    addMesh(THREE, shelfGroup, roundedBoxGeo(THREE, 0.014, 0.078, 0.055, 0.003), rackWood, {
      pos: [rackX + dx, rackY + 0.042, shelfZ],
      slot: "wood"
    });
  }
  const tubeColors = [0x65f0d8, 0xff9ec7, 0x8cc8ff, 0xffe074];
  const tubeGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.12, 12);
  const tubeLiqGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.058, 12);
  for (let i = 0; i < 4; i++) {
    const tx = rackX - 0.06 + i * 0.04;
    const tMat = makeMat(THREE, tubeColors[i], {
      roughness: 0.18,
      transparent: true,
      opacity: 0.82,
      emissive: tubeColors[i],
      emissiveIntensity: preset.liquidGlow
    });
    addMesh(THREE, shelfGroup, tubeLiqGeo, tMat, {
      pos: [tx, rackY + 0.044, shelfZ],
      castShadow: false
    });
    addMesh(THREE, shelfGroup, tubeGeo, glassMat, {
      pos: [tx, rackY + 0.075, shelfZ],
      castShadow: false
    });
  }
}

function buildFumeHood(THREE, root, cfg, preset) {
  const hood = new THREE.Group();
  hood.name = "fumeHood";
  root.add(hood);

  // Left wall placement: x = -2.0 to -1.18 (depth 0.82), z = -1.85 to -0.45 (width 1.40)
  const d = 0.82;
  const w = 1.4;
  const cx = -2 + d / 2;
  const cz = -1.15;

  const bodyMat = makeMat(THREE, 0xe8efed, { roughness: 0.52, metalness: 0.06 });
  const trimMat = makeMat(THREE, cfg.trim, { roughness: 0.5, metalness: 0.1 });
  const darkMat = makeMat(THREE, 0x262c31, { roughness: 0.38, metalness: 0.08 });
  const chamberMat = makeMat(THREE, 0xdce5e3, { roughness: 0.65, metalness: 0.04 });
  const metalMat = makeMat(THREE, 0xbfcace, { roughness: 0.28, metalness: 0.82 });
  const accentMat = makeMat(THREE, cfg.accent, { roughness: 0.45, metalness: 0.1 });

  // Lower base cabinet (y = 0 to 0.86)
  addMesh(THREE, hood, new THREE.BoxGeometry(d - 0.08, 0.08, w - 0.04), darkMat, {
    pos: [cx - 0.02, 0.04, cz]
  });
  addMesh(THREE, hood, roundedBoxGeo(THREE, d, 0.78, w, 0.014), bodyMat, {
    pos: [cx, 0.08 + 0.39, cz],
    slot: "primary"
  });
  // Double doors on front (+X face)
  for (const dz of [-0.33, 0.33]) {
    addMesh(THREE, hood, roundedBoxGeo(THREE, 0.022, 0.68, 0.62, 0.008), bodyMat, {
      pos: [cx + d / 2 + 0.006, 0.47, cz + dz],
      slot: "primary"
    });
    addMesh(THREE, hood, roundedBoxGeo(THREE, 0.024, 0.14, 0.016, 0.005), metalMat, {
      pos: [cx + d / 2 + 0.022, 0.56, cz + dz + (dz < 0 ? 0.24 : -0.24)],
      slot: "metal"
    });
  }

  // Work surface (y = 0.86 to 0.90)
  addMesh(THREE, hood, roundedBoxGeo(THREE, d + 0.03, 0.044, w + 0.02, 0.01), darkMat, {
    pos: [cx + 0.01, 0.88, cz]
  });

  // Side cheeks and back baffle of work chamber (y = 0.90 to 1.94)
  const chH = 1.04;
  const chCy = 0.9 + chH / 2;
  const sideT = 0.1;
  // Back chamber wall
  addMesh(THREE, hood, new THREE.BoxGeometry(0.12, chH, w - 0.02), chamberMat, {
    pos: [-2 + 0.06, chCy, cz],
    slot: "secondary"
  });
  // Rear slotted baffle plate
  addMesh(THREE, hood, roundedBoxGeo(THREE, 0.025, chH - 0.14, w - 0.26, 0.006), trimMat, {
    pos: [-2 + 0.16, chCy, cz],
    slot: "secondary"
  });
  // Left & right side walls
  for (const dz of [-(w / 2 - sideT / 2), w / 2 - sideT / 2]) {
    addMesh(THREE, hood, roundedBoxGeo(THREE, d, chH, sideT, 0.012), bodyMat, {
      pos: [cx, chCy, cz + dz],
      slot: "primary"
    });
  }

  // Small utility control knobs on the front fascia cheeks
  const knobColors = [cfg.accent, 0xe8b44c];
  for (let i = 0; i < 2; i++) {
    const kMat = makeMat(THREE, knobColors[i], { roughness: 0.4, metalness: 0.15 });
    addMesh(THREE, hood, new THREE.CylinderGeometry(0.02, 0.022, 0.032, 14), kMat, {
      pos: [cx + d / 2 + 0.012, 1.06 + i * 0.12, cz + w / 2 - 0.05],
      rot: [0, 0, Math.PI / 2],
      slot: i === 0 ? "accent" : undefined
    });
  }

  // Upper hood canopy (y = 1.94 to 2.36)
  addMesh(THREE, hood, roundedBoxGeo(THREE, d + 0.02, 0.42, w + 0.02, 0.016), bodyMat, {
    pos: [cx + 0.005, 1.94 + 0.21, cz],
    slot: "primary"
  });
  // Accent control strip on canopy front
  addMesh(THREE, hood, roundedBoxGeo(THREE, 0.024, 0.07, w - 0.16, 0.006), accentMat, {
    pos: [cx + d / 2 + 0.014, 2.02, cz],
    slot: "accent"
  });
  // Exhaust duct rising to ceiling (y = 2.36 to 2.70)
  addMesh(THREE, hood, new THREE.CylinderGeometry(0.14, 0.15, 0.34, 20), metalMat, {
    pos: [cx - 0.08, 2.53, cz],
    slot: "metal"
  });

  // Interior glowing task light bar
  const hoodLightMat = makeMat(THREE, 0xf7fffe, {
    roughness: 0.2,
    emissive: 0xdffef8,
    emissiveIntensity: preset.stripIntensity * 0.85
  });
  addMesh(THREE, hood, roundedBoxGeo(THREE, 0.12, 0.022, w - 0.34, 0.006), hoodLightMat, {
    pos: [cx + 0.02, 1.925, cz],
    castShadow: false,
    receiveShadow: false
  });

  // Sliding glass sash (partially raised: bottom at y = 1.34, top at y = 1.92)
  const sashW = w - sideT * 2 + 0.02;
  const sashH = 0.58;
  const sashCy = 1.34 + sashH / 2;
  const sashX = cx + d / 2 - 0.04;
  const sashGlassMat = makeMat(THREE, 0xdff7ff, {
    roughness: 0.06,
    metalness: 0.12,
    transparent: true,
    opacity: 0.3
  });
  addMesh(THREE, hood, new THREE.BoxGeometry(0.012, sashH, sashW), sashGlassMat, {
    pos: [sashX, sashCy, cz],
    castShadow: false,
    receiveShadow: false
  });
  // Sash aluminum frame & bottom pull handle
  addMesh(THREE, hood, roundedBoxGeo(THREE, 0.028, 0.032, sashW + 0.02, 0.006), metalMat, {
    pos: [sashX, 1.34, cz],
    slot: "metal"
  });
  addMesh(THREE, hood, roundedBoxGeo(THREE, 0.026, 0.024, sashW + 0.02, 0.005), metalMat, {
    pos: [sashX, 1.92, cz],
    slot: "metal"
  });
  // Sleek protruding sash grab bar
  addMesh(THREE, hood, roundedBoxGeo(THREE, 0.022, 0.016, 0.52, 0.006), metalMat, {
    pos: [sashX + 0.036, 1.34, cz],
    slot: "metal"
  });
  for (const dz of [-0.22, 0.22]) {
    addMesh(THREE, hood, new THREE.BoxGeometry(0.036, 0.014, 0.014), metalMat, {
      pos: [sashX + 0.018, 1.34, cz + dz],
      slot: "metal"
    });
  }
}

function buildPeriodicTileGrid(THREE, root, cfg) {
  const board = new THREE.Group();
  board.name = "periodicTileBoard";
  root.add(board);

  const cx = 1.34;
  const cy = 1.66;
  const bw = 0.98;
  const bh = 0.62;

  const frameMat = makeMat(THREE, cfg.trim, { roughness: 0.5, metalness: 0.08 });
  const backMat = makeMat(THREE, 0xf8fbfa, { roughness: 0.72, metalness: 0.02 });
  addMesh(THREE, board, roundedBoxGeo(THREE, bw + 0.05, bh + 0.05, 0.024, 0.008), frameMat, {
    pos: [cx, cy, -1.988],
    slot: "secondary"
  });
  addMesh(THREE, board, new THREE.BoxGeometry(bw, bh, 0.012), backMat, {
    pos: [cx, cy, -1.978]
  });

  // 18-column periodic silhouette of blank coloured tiles (no text)
  const groupColors = {
    alkali: 0xf28b82,
    alkaline: 0xfbbc6d,
    transition: 0x80cbc4,
    post: 0x81d4fa,
    metalloid: 0xa5d6a7,
    nonmetal: 0xc5e1a5,
    halogen: 0xce93d8,
    noble: 0x9fa8da,
    lanth: 0xf48fb1,
    act: 0xffab91
  };
  const mats = {};
  for (const k of Object.keys(groupColors)) {
    mats[k] = makeMat(THREE, groupColors[k], { roughness: 0.45, metalness: 0.04 });
  }

  const tileSize = 0.042;
  const step = 0.05;
  const tileGeo = roundedBoxGeo(THREE, tileSize, tileSize, 0.012, 0.004, 1);
  const startX = cx - (17 * step) / 2;
  const startY = cy + bh / 2 - 0.065;

  function pickGroup(r, c) {
    if (r === 0 && c === 0) return "nonmetal";
    if (c === 0) return "alkali";
    if (c === 1) return "alkaline";
    if (c >= 2 && c <= 11) return "transition";
    if (c === 17) return "noble";
    if (c === 16) return "halogen";
    if ((r === 1 && c === 12) || (r === 2 && c === 13) || (r === 3 && (c === 13 || c === 14)) || (r === 4 && (c === 14 || c === 15))) {
      return "metalloid";
    }
    if (c >= 12 && r >= 2 && c <= 12 + (r - 2)) return "post";
    return "nonmetal";
  }

  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 18; c++) {
      const present =
        (r === 0 && (c === 0 || c === 17)) ||
        ((r === 1 || r === 2) && (c <= 1 || c >= 12)) ||
        r >= 3;
      if (!present) continue;
      addMesh(THREE, board, tileGeo, mats[pickGroup(r, c)], {
        pos: [startX + c * step, startY - r * step, -1.968],
        castShadow: false
      });
    }
  }
  // Lanthanide / Actinide bottom strip
  for (let r = 0; r < 2; r++) {
    for (let c = 2; c < 16; c++) {
      addMesh(THREE, board, tileGeo, mats[r === 0 ? "lanth" : "act"], {
        pos: [startX + c * step, startY - (7.6 + r) * step, -1.968],
        castShadow: false
      });
    }
  }
}

function buildLabWallFixtures(THREE, root, cfg) {
  // Round wall clock on left wall (x = -2, z = 0.45, y = 2.02)
  const clock = new THREE.Group();
  clock.name = "wallClock";
  clock.position.set(-1.985, 2.02, 0.45);
  clock.rotation.y = Math.PI / 2;
  root.add(clock);

  const bezelMat = makeMat(THREE, 0x3b454a, { roughness: 0.35, metalness: 0.65 });
  const faceMat = makeMat(THREE, 0xfcfefd, { roughness: 0.7, metalness: 0.02 });
  const handMat = makeMat(THREE, 0x262d32, { roughness: 0.4, metalness: 0.3 });
  const secMat = makeMat(THREE, cfg.accent, { roughness: 0.35, metalness: 0.2 });

  addMesh(THREE, clock, new THREE.CylinderGeometry(0.18, 0.185, 0.032, 28), bezelMat, {
    rot: [Math.PI / 2, 0, 0],
    slot: "metal"
  });
  addMesh(THREE, clock, new THREE.TorusGeometry(0.172, 0.015, 12, 28), bezelMat, {
    pos: [0, 0, 0.015],
    slot: "metal"
  });
  addMesh(THREE, clock, new THREE.CircleGeometry(0.162, 28), faceMat, {
    pos: [0, 0, 0.017],
    castShadow: false
  });
  // 12 raised tick marks (no numbers)
  const tickGeo = new THREE.BoxGeometry(0.008, 0.022, 0.004);
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const isMajor = i % 3 === 0;
    addMesh(THREE, clock, tickGeo, handMat, {
      pos: [Math.sin(ang) * 0.132, Math.cos(ang) * 0.132, 0.02],
      rot: [0, 0, -ang],
      scale: [isMajor ? 1.5 : 0.9, isMajor ? 1.25 : 0.85, 1],
      castShadow: false
    });
  }
  // Hour, minute, and accent second hands
  addMesh(THREE, clock, roundedBoxGeo(THREE, 0.012, 0.085, 0.005, 0.002), handMat, {
    pos: [-0.026, 0.024, 0.024],
    rot: [0, 0, 0.82],
    castShadow: false
  });
  addMesh(THREE, clock, roundedBoxGeo(THREE, 0.009, 0.122, 0.005, 0.002), handMat, {
    pos: [0.032, 0.04, 0.027],
    rot: [0, 0, -0.68],
    castShadow: false
  });
  addMesh(THREE, clock, new THREE.BoxGeometry(0.004, 0.135, 0.004), secMat, {
    pos: [0.012, -0.045, 0.03],
    rot: [0, 0, 0.28],
    castShadow: false,
    slot: "accent"
  });
  addMesh(THREE, clock, new THREE.SphereGeometry(0.011, 12, 10), secMat, {
    pos: [0, 0, 0.03],
    castShadow: false,
    slot: "accent"
  });

  // Emergency eyewash sign: a crisp plain green square (no text/icons)
  const signMat = makeMat(THREE, 0x269955, { roughness: 0.42, metalness: 0.06 });
  addMesh(THREE, root, roundedBoxGeo(THREE, 0.018, 0.26, 0.26, 0.008), signMat, {
    pos: [-1.99, 1.48, 0.45],
    name: "eyewashSign"
  });
}

function buildLabStripLight(THREE, root, preset) {
  const lightGroup = new THREE.Group();
  lightGroup.name = "ceilingStripLight";
  root.add(lightGroup);

  const lx = 0.22;
  const ly = 2.48;
  const lz = -0.32;
  const len = 2.05;

  const metalMat = makeMat(THREE, 0xcbd4d8, { roughness: 0.28, metalness: 0.82 });
  const diffuserMat = makeMat(THREE, 0xfafefe, {
    roughness: 0.22,
    metalness: 0.02,
    emissive: 0xe6fffc,
    emissiveIntensity: preset.stripIntensity
  });

  // Sleek suspended housing
  addMesh(THREE, lightGroup, roundedBoxGeo(THREE, len, 0.055, 0.16, 0.016), metalMat, {
    pos: [lx, ly, lz],
    slot: "metal"
  });
  // Glowing frosted diffuser underside
  addMesh(THREE, lightGroup, roundedBoxGeo(THREE, len - 0.08, 0.022, 0.125, 0.008), diffuserMat, {
    pos: [lx, ly - 0.028, lz],
    castShadow: false,
    receiveShadow: false
  });
  // Ceiling suspension rods and canopies
  for (const dx of [-0.72, 0.72]) {
    addMesh(THREE, lightGroup, new THREE.CylinderGeometry(0.007, 0.007, 0.22, 10), metalMat, {
      pos: [lx + dx, ly + 0.11, lz],
      slot: "metal"
    });
    addMesh(THREE, lightGroup, new THREE.CylinderGeometry(0.032, 0.036, 0.016, 14), metalMat, {
      pos: [lx + dx, 2.692, lz],
      slot: "metal"
    });
  }
}

function lab(THREE, opts) {
  const cfg = resolveOpts(DEFAULT_OPTS.lab, opts);
  const preset = TIME_PRESETS[cfg.time] || TIME_PRESETS.day;
  const root = new THREE.Group();
  root.name = "space_lab";
  root.userData.spaceId = "lab";
  root.userData.time = cfg.time;

  buildLabShell(THREE, root, cfg, preset);
  buildLabBench(THREE, root, cfg);
  buildReagentShelf(THREE, root, cfg, preset);
  buildFumeHood(THREE, root, cfg, preset);
  buildPeriodicTileGrid(THREE, root, cfg);
  buildLabWallFixtures(THREE, root, cfg);
  buildLabStripLight(THREE, root, preset);

  return root;
}

// ============================================================================
// SPACE 2: LIBRARY READING ROOM
// ============================================================================

function buildReadingRoomShell(THREE, root, cfg) {
  const wallT = 0.16;
  const wallH = 2.7;
  const floorT = 0.16;

  // Base floor slab
  const baseFloorMat = makeMat(THREE, cfg.floor, { roughness: 0.6, metalness: 0.04 });
  addMesh(THREE, root, new THREE.BoxGeometry(4 + wallT, floorT, 4 + wallT), baseFloorMat, {
    pos: [-wallT / 2, -floorT / 2, -wallT / 2],
    slot: "wood",
    name: "readingRoomFloorBase"
  });

  // Basketweave parquet floor tiles (6x6 grid, 3 planks per tile)
  const baseColor = new THREE.Color(cfg.floor);
  const toneA = baseColor.clone().multiplyScalar(1.06);
  const toneB = baseColor.clone().multiplyScalar(0.92);
  const toneC = baseColor.clone().multiplyScalar(0.84);
  const plankMats = [
    makeMat(THREE, toneA, { roughness: 0.48, metalness: 0.05 }),
    makeMat(THREE, toneB, { roughness: 0.52, metalness: 0.05 }),
    makeMat(THREE, toneC, { roughness: 0.5, metalness: 0.05 })
  ];
  const gridN = 6;
  const cell = 4 / gridN;
  const plankW = cell / 3 - 0.005;
  const plankL = cell - 0.006;
  const plankGeoH = new THREE.BoxGeometry(plankL, 0.006, plankW);
  const plankGeoV = new THREE.BoxGeometry(plankW, 0.006, plankL);

  for (let gx = 0; gx < gridN; gx++) {
    for (let gz = 0; gz < gridN; gz++) {
      const cx = -2 + (gx + 0.5) * cell;
      const cz = -2 + (gz + 0.5) * cell;
      const horiz = (gx + gz) % 2 === 0;
      for (let p = 0; p < 3; p++) {
        const offset = (p - 1) * (cell / 3);
        const mat = plankMats[(gx + gz + p) % 3];
        if (horiz) {
          addMesh(THREE, root, plankGeoH, mat, {
            pos: [cx, 0.003, cz + offset],
            castShadow: false,
            receiveShadow: true,
            slot: "wood"
          });
        } else {
          addMesh(THREE, root, plankGeoV, mat, {
            pos: [cx + offset, 0.003, cz],
            castShadow: false,
            receiveShadow: true,
            slot: "wood"
          });
        }
      }
    }
  }

  // Back wall (z = -2) with tall arched window cutout centered at x = 0
  const archR = 0.64;
  const winBottom = 0.56;
  const springY = 1.76;

  const backShape = new THREE.Shape();
  backShape.moveTo(-2 - wallT, 0);
  backShape.lineTo(2, 0);
  backShape.lineTo(2, wallH);
  backShape.lineTo(-2 - wallT, wallH);
  backShape.closePath();

  const archHole = new THREE.Path();
  archHole.moveTo(-archR, winBottom);
  archHole.lineTo(archR, winBottom);
  archHole.lineTo(archR, springY);
  archHole.absarc(0, springY, archR, 0, Math.PI, false);
  archHole.lineTo(-archR, winBottom);
  backShape.holes.push(archHole);

  const wallMat = makeMat(THREE, cfg.wall, { roughness: 0.82, metalness: 0.02 });
  const backGeo = new THREE.ExtrudeGeometry(backShape, {
    depth: wallT,
    bevelEnabled: false,
    curveSegments: 24
  });
  addMesh(THREE, root, backGeo, wallMat, {
    pos: [0, 0, -2 - wallT],
    slot: "primary",
    name: "readingRoomBackWall"
  });

  // Left wall (x = -2)
  addMesh(THREE, root, new THREE.BoxGeometry(wallT, wallH, 4), wallMat, {
    pos: [-2 - wallT / 2, wallH / 2, 0],
    slot: "primary",
    name: "readingRoomLeftWall"
  });

  // Baseboard molding along both walls
  const trimMat = makeMat(THREE, cfg.trim, { roughness: 0.52, metalness: 0.05 });
  addMesh(THREE, root, roundedBoxGeo(THREE, 4, 0.12, 0.026, 0.006), trimMat, {
    pos: [0, 0.06, -1.987],
    slot: "wood"
  });
  addMesh(THREE, root, roundedBoxGeo(THREE, 0.026, 0.12, 4, 0.006), trimMat, {
    pos: [-1.987, 0.06, 0],
    slot: "wood"
  });

  // Sky backdrop plane behind the arched window
  addSkyBackdrop(THREE, root, cfg.time, {
    x: 0,
    y: 1.5,
    z: -2.28,
    w: 1.65,
    h: 2.15
  });
}

function buildArchedWindowAndSeat(THREE, root, cfg) {
  const group = new THREE.Group();
  group.name = "archedWindowSeat";
  root.add(group);

  const archR = 0.64;
  const winBottom = 0.56;
  const springY = 1.76;
  const woodMat = makeMat(THREE, cfg.trim, { roughness: 0.52, metalness: 0.05 });
  const glassMat = makeMat(THREE, 0xe3f4ff, {
    roughness: 0.08,
    metalness: 0.1,
    transparent: true,
    opacity: 0.22
  });

  // Arched wood casing around the opening
  const outerR = archR + 0.055;
  const casingShape = new THREE.Shape();
  casingShape.moveTo(-outerR, winBottom - 0.03);
  casingShape.lineTo(outerR, winBottom - 0.03);
  casingShape.lineTo(outerR, springY);
  casingShape.absarc(0, springY, outerR, 0, Math.PI, false);
  casingShape.closePath();

  const innerHole = new THREE.Path();
  innerHole.moveTo(-archR, winBottom);
  innerHole.lineTo(archR, winBottom);
  innerHole.lineTo(archR, springY);
  innerHole.absarc(0, springY, archR, 0, Math.PI, false);
  innerHole.closePath();
  casingShape.holes.push(innerHole);

  const casingGeo = new THREE.ExtrudeGeometry(casingShape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
    curveSegments: 24
  });
  addMesh(THREE, group, casingGeo, woodMat, {
    pos: [0, 0, -2.14],
    slot: "wood"
  });

  // Window mullions & fanlight spokes
  const mullionZ = -2.06;
  addMesh(THREE, group, roundedBoxGeo(THREE, 0.034, springY - winBottom + archR, 0.036, 0.005), woodMat, {
    pos: [0, (winBottom + springY + archR) / 2, mullionZ],
    slot: "wood"
  });
  for (const ty of [1.16, springY]) {
    addMesh(THREE, group, roundedBoxGeo(THREE, archR * 2, 0.034, 0.036, 0.005), woodMat, {
      pos: [0, ty, mullionZ],
      slot: "wood"
    });
  }
  // Radial fanlight spokes in arch
  for (const ang of [Math.PI * 0.25, Math.PI * 0.75]) {
    addMesh(THREE, group, roundedBoxGeo(THREE, 0.024, archR, 0.028, 0.004), woodMat, {
      pos: [Math.cos(ang) * (archR / 2), springY + Math.sin(ang) * (archR / 2), mullionZ],
      rot: [0, 0, ang - Math.PI / 2],
      slot: "wood"
    });
  }

  // Arched window glass pane
  const glassShape = new THREE.Shape();
  glassShape.moveTo(-archR, winBottom);
  glassShape.lineTo(archR, winBottom);
  glassShape.lineTo(archR, springY);
  glassShape.absarc(0, springY, archR, 0, Math.PI, false);
  glassShape.closePath();
  addMesh(THREE, group, new THREE.ShapeGeometry(glassShape, 24), glassMat, {
    pos: [0, 0, -2.08],
    castShadow: false,
    receiveShadow: false
  });

  // Deep window seat bench (x = -0.68 to 0.68, z = -2.0 to -1.46, height = 0.44)
  const seatW = 1.36;
  const seatD = 0.54;
  const seatH = 0.44;
  const seatZ = -2 + seatD / 2;
  addMesh(THREE, group, roundedBoxGeo(THREE, seatW, seatH - 0.03, seatD - 0.03, 0.012), woodMat, {
    pos: [0, (seatH - 0.03) / 2, seatZ - 0.01],
    slot: "wood"
  });
  // Recessed decorative front panels on bench base
  for (const px of [-0.34, 0.34]) {
    addMesh(THREE, group, roundedBoxGeo(THREE, 0.54, 0.26, 0.018, 0.006), woodMat, {
      pos: [px, 0.21, -2 + seatD - 0.022],
      slot: "wood"
    });
  }
  // Overhanging bench top ledge
  addMesh(THREE, group, roundedBoxGeo(THREE, seatW + 0.04, 0.038, seatD + 0.03, 0.01), woodMat, {
    pos: [0, seatH, seatZ + 0.01],
    slot: "wood"
  });

  // Plush seat cushion
  const fabricMat = makeMat(THREE, cfg.accent, { roughness: 0.88, metalness: 0.02 });
  const cushionLightMat = makeMat(THREE, 0xd8c3a5, { roughness: 0.9, metalness: 0.01 });
  const cushionWarmMat = makeMat(THREE, 0xb55947, { roughness: 0.88, metalness: 0.02 });

  addMesh(THREE, group, roundedBoxGeo(THREE, seatW - 0.04, 0.1, seatD - 0.04, 0.035, 3), fabricMat, {
    pos: [0, seatH + 0.068, seatZ + 0.01],
    slot: "fabric",
    name: "windowSeatCushion"
  });

  // Cozy throw pillows tucked into both sides of the window alcove
  const pillowGeo = roundedBoxGeo(THREE, 0.34, 0.3, 0.12, 0.045, 3);
  addMesh(THREE, group, pillowGeo, cushionLightMat, {
    pos: [-0.48, seatH + 0.24, seatZ - 0.05],
    rot: [-0.18, 0.42, -0.1],
    slot: "fabric"
  });
  addMesh(THREE, group, pillowGeo, cushionWarmMat, {
    pos: [0.48, seatH + 0.24, seatZ - 0.05],
    rot: [-0.18, -0.46, 0.1],
    slot: "fabric"
  });
  addMesh(THREE, group, roundedBoxGeo(THREE, 0.28, 0.25, 0.11, 0.04, 3), fabricMat, {
    pos: [0.3, seatH + 0.21, seatZ - 0.1],
    rot: [-0.24, -0.2, 0.05],
    scale: [0.95, 0.95, 0.95],
    slot: "fabric"
  });
}

function buildBookshelfUnit(THREE, parent, cfg, spec, rand) {
  const { width, depth, height, bays, woodMat, bookMats } = spec;
  const unit = new THREE.Group();
  unit.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
  unit.rotation.y = spec.rotY || 0;
  parent.add(unit);

  const sideT = 0.038;
  const baseH = 0.48;
  const shelfLevels = [0.48, 0.85, 1.22, 1.59, 1.96, 2.31];

  // Back panel
  addMesh(THREE, unit, new THREE.BoxGeometry(width - 0.02, height - 0.04, 0.02), woodMat, {
    pos: [0, height / 2, -depth / 2 + 0.01],
    slot: "wood"
  });

  // Lower paneled base cabinet
  addMesh(THREE, unit, roundedBoxGeo(THREE, width, baseH, depth, 0.01), woodMat, {
    pos: [0, baseH / 2, 0],
    slot: "wood"
  });

  // Vertical stiles (outer walls + bay dividers)
  const bayW = (width - sideT * (bays + 1)) / bays;
  for (let i = 0; i <= bays; i++) {
    const sx = -width / 2 + sideT / 2 + i * (bayW + sideT);
    addMesh(THREE, unit, roundedBoxGeo(THREE, sideT, height, depth, 0.008), woodMat, {
      pos: [sx, height / 2, 0],
      slot: "wood"
    });
  }

  // Shelves
  for (const sy of shelfLevels) {
    addMesh(THREE, unit, roundedBoxGeo(THREE, width - 0.02, 0.028, depth - 0.02, 0.006), woodMat, {
      pos: [0, sy, 0.005],
      slot: "wood"
    });
  }

  // Stepped crown molding at top
  addMesh(THREE, unit, roundedBoxGeo(THREE, width + 0.05, 0.075, depth + 0.05, 0.012), woodMat, {
    pos: [0, height - 0.038, 0.02],
    slot: "wood"
  });

  // Fill every bay & shelf level with varied books
  for (let b = 0; b < bays; b++) {
    const bayLeft = -width / 2 + sideT + b * (bayW + sideT) + 0.012;
    const bayRight = bayLeft + bayW - 0.024;
    for (let s = 0; s < shelfLevels.length; s++) {
      const sy = shelfLevels[s] + 0.014;
      const maxH = s < shelfLevels.length - 1 ? 0.31 : 0.25;
      let cursor = bayLeft;

      // Occasional horizontal stack at end of shelf
      const makeStack = rand() < 0.22;
      const endLimit = makeStack ? bayRight - 0.19 : bayRight;

      while (cursor < endLimit - 0.032) {
        if (rand() < 0.08) {
          cursor += 0.025 + rand() * 0.03;
          continue;
        }
        const bw = 0.024 + rand() * 0.03;
        if (cursor + bw > endLimit) break;
        const bh = Math.min(maxH, 0.17 + rand() * 0.13);
        const bd = 0.16 + rand() * 0.09;
        const mat = bookMats[Math.floor(rand() * bookMats.length)];
        const lean = cursor + bw + 0.05 > endLimit && rand() < 0.35 ? -0.14 : 0;

        addMesh(THREE, unit, roundedBoxGeo(THREE, bw, bh, bd, 0.004, 1), mat, {
          pos: [cursor + bw / 2 + (lean ? 0.018 : 0), sy + bh / 2, depth / 2 - bd / 2 - 0.025 - rand() * 0.02],
          rot: [0, 0, lean]
        });
        cursor += bw + 0.003;
      }

      if (makeStack && endLimit < bayRight - 0.1) {
        const stackX = bayRight - 0.09;
        let stackY = sy;
        const count = 2 + Math.floor(rand() * 2);
        for (let k = 0; k < count; k++) {
          const sh = 0.026 + rand() * 0.012;
          const sw = 0.14 + rand() * 0.03;
          const sd = 0.18 + rand() * 0.04;
          const mat = bookMats[Math.floor(rand() * bookMats.length)];
          addMesh(THREE, unit, roundedBoxGeo(THREE, sw, sh, sd, 0.004, 1), mat, {
            pos: [stackX, stackY + sh / 2, depth / 2 - sd / 2 - 0.035],
            rot: [0, (rand() - 0.5) * 0.12, 0]
          });
          stackY += sh;
        }
      }
    }
  }
}

function buildBookshelvesAndLadder(THREE, root, cfg) {
  const woodMat = makeMat(THREE, cfg.trim, { roughness: 0.52, metalness: 0.05 });
  const brassMat = makeMat(THREE, 0xd4ad55, { roughness: 0.25, metalness: 0.86 });
  const rand = mulberry32(7331);

  const bookPalette = [
    0x7c2d2d, 0x2c5e43, 0x2a4263, 0xb8863b, 0xd9cbb8,
    0x9c4f3b, 0x4c4a6b, 0x5c6b45, 0x874059, 0x3b6978,
    0xc49c68, 0x593a2e
  ];
  const bookMats = bookPalette.map((c) => makeMat(THREE, c, { roughness: 0.72, metalness: 0.04 }));

  const shelfD = 0.38;
  const shelfH = 2.66;

  // Back wall left bookshelf (x = -1.62 to -0.68, width = 0.94)
  buildBookshelfUnit(THREE, root, cfg, {
    width: 0.94,
    depth: shelfD,
    height: shelfH,
    bays: 1,
    pos: [-1.15, 0, -2 + shelfD / 2],
    rotY: 0,
    woodMat,
    bookMats
  }, rand);

  // Back wall right bookshelf (x = 0.68 to 1.98, width = 1.30)
  buildBookshelfUnit(THREE, root, cfg, {
    width: 1.3,
    depth: shelfD,
    height: shelfH,
    bays: 2,
    pos: [1.33, 0, -2 + shelfD / 2],
    rotY: 0,
    woodMat,
    bookMats
  }, rand);

  // Left wall bookshelf (z = -2.0 to 1.12, width = 3.12, facing +X)
  buildBookshelfUnit(THREE, root, cfg, {
    width: 3.12,
    depth: shelfD,
    height: shelfH,
    bays: 3,
    pos: [-2 + shelfD / 2, 0, -0.44],
    rotY: Math.PI / 2,
    woodMat,
    bookMats
  }, rand);

  // Brass rolling ladder rail along the left-wall bookshelves
  const railX = -2 + shelfD + 0.045;
  const railY = 2.24;
  addMesh(THREE, root, new THREE.CylinderGeometry(0.013, 0.013, 2.7, 14), brassMat, {
    pos: [railX, railY, -0.28],
    rot: [Math.PI / 2, 0, 0],
    slot: "metal",
    name: "ladderBrassRail"
  });
  for (const rz of [-1.52, -0.68, 0.16, 1.0]) {
    addMesh(THREE, root, new THREE.CylinderGeometry(0.009, 0.009, 0.055, 10), brassMat, {
      pos: [railX - 0.028, railY, rz],
      rot: [0, 0, Math.PI / 2],
      slot: "metal"
    });
    addMesh(THREE, root, new THREE.SphereGeometry(0.017, 10, 10), brassMat, {
      pos: [railX, railY, rz],
      slot: "metal"
    });
  }

  // Rolling ladder leaning against the left-wall rail at z = -0.32
  const ladder = new THREE.Group();
  ladder.name = "rollingLadder";
  const ladderZ = -0.32;
  const topX = railX;
  const topY = railY;
  const botX = railX + 0.44;
  const botY = 0.025;
  const dx = botX - topX;
  const dy = topY - botY;
  const ladderLen = Math.hypot(dx, dy);
  const tilt = Math.atan2(dx, dy);

  ladder.position.set((topX + botX) / 2, (topY + botY) / 2, ladderZ);
  ladder.rotation.z = tilt;
  root.add(ladder);

  const railSpacing = 0.38;
  for (const dz of [-railSpacing / 2, railSpacing / 2]) {
    // Side rail
    addMesh(THREE, ladder, roundedBoxGeo(THREE, 0.045, ladderLen, 0.026, 0.008), woodMat, {
      pos: [0, 0, dz],
      slot: "wood"
    });
    // Top brass hook wrapping over the brass rail
    addMesh(THREE, ladder, new THREE.TorusGeometry(0.024, 0.008, 10, 16, Math.PI * 1.25), brassMat, {
      pos: [-0.01, ladderLen / 2 + 0.006, dz],
      rot: [0, 0, -0.35],
      slot: "metal"
    });
    // Bottom brass wheel
    addMesh(THREE, ladder, new THREE.CylinderGeometry(0.022, 0.022, 0.014, 14), brassMat, {
      pos: [0, -ladderLen / 2 - 0.004, dz],
      rot: [Math.PI / 2, 0, 0],
      slot: "metal"
    });
  }

  // 7 flat wooden steps with brass tie rods
  const steps = 7;
  for (let i = 0; i < steps; i++) {
    const t = -0.4 + (i / (steps - 1)) * 0.8;
    const sy = t * ladderLen;
    addMesh(THREE, ladder, roundedBoxGeo(THREE, 0.072, 0.02, railSpacing - 0.01, 0.005), woodMat, {
      pos: [0, sy, 0],
      rot: [0, 0, -tilt],
      slot: "wood"
    });
  }
}

function buildBankersLamp(THREE, parent, pos, preset, accentColor) {
  const lamp = new THREE.Group();
  lamp.position.set(pos[0], pos[1], pos[2]);
  parent.add(lamp);

  const brassMat = makeMat(THREE, 0xd4ae57, { roughness: 0.24, metalness: 0.88 });
  const shadeColor = accentColor !== undefined ? accentColor : 0x246b47;
  const shadeMat = makeMat(THREE, shadeColor, {
    roughness: 0.16,
    metalness: 0.05,
    emissive: 0x1e7a48,
    emissiveIntensity: preset.lampIntensity * 0.45
  });
  const bulbMat = makeMat(THREE, 0xfff7dc, {
    roughness: 0.2,
    emissive: 0xffdf94,
    emissiveIntensity: preset.lampIntensity
  });

  // Stepped turned brass base
  const basePts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.078, 0.0),
    new THREE.Vector2(0.076, 0.014),
    new THREE.Vector2(0.062, 0.022),
    new THREE.Vector2(0.052, 0.032),
    new THREE.Vector2(0.018, 0.044),
    new THREE.Vector2(0.014, 0.054)
  ];
  addMesh(THREE, lamp, new THREE.LatheGeometry(basePts, 20), brassMat, {
    slot: "metal"
  });

  // Brass stem
  addMesh(THREE, lamp, new THREE.CylinderGeometry(0.009, 0.012, 0.27, 14), brassMat, {
    pos: [0, 0.18, 0],
    slot: "metal"
  });
  // Brass yoke arms
  for (const dz of [-0.108, 0.108]) {
    addMesh(THREE, lamp, new THREE.CylinderGeometry(0.006, 0.006, 0.11, 10), brassMat, {
      pos: [0, 0.305, dz * 0.55],
      rot: [dz > 0 ? 0.92 : -0.92, 0, 0],
      slot: "metal"
    });
    addMesh(THREE, lamp, new THREE.SphereGeometry(0.012, 10, 10), brassMat, {
      pos: [0, 0.335, dz],
      slot: "metal"
    });
  }

  // Hollow curved green glass shade
  const shadeShape = new THREE.Shape();
  const rOut = 0.072;
  const rIn = 0.061;
  shadeShape.absarc(0, 0, rOut, 0, Math.PI, false);
  shadeShape.lineTo(-rIn, 0);
  shadeShape.absarc(0, 0, rIn, Math.PI, 0, true);
  shadeShape.closePath();

  const shadeGeo = new THREE.ExtrudeGeometry(shadeShape, {
    depth: 0.2,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
    curveSegments: 18
  });
  shadeGeo.center();
  addMesh(THREE, lamp, shadeGeo, shadeMat, {
    pos: [0, 0.352, 0],
    slot: "accent",
    name: "bankersLampShade"
  });

  // Glowing warm bulb tucked inside the shade
  addMesh(THREE, lamp, new THREE.SphereGeometry(0.024, 14, 12), bulbMat, {
    pos: [0, 0.33, 0],
    castShadow: false,
    receiveShadow: false
  });

  // Tiny brass pull chain
  addMesh(THREE, lamp, new THREE.CylinderGeometry(0.0022, 0.0022, 0.085, 8), brassMat, {
    pos: [0.022, 0.275, 0.02],
    slot: "metal",
    castShadow: false
  });
  addMesh(THREE, lamp, new THREE.SphereGeometry(0.0065, 8, 8), brassMat, {
    pos: [0.022, 0.23, 0.02],
    slot: "metal",
    castShadow: false
  });
}

function buildReadingTable(THREE, root, cfg, preset) {
  const table = new THREE.Group();
  table.name = "readingTable";
  const tx = 0.42;
  const tz = 0.15;
  table.position.set(tx, 0, tz);
  root.add(table);

  const w = 0.92;
  const l = 1.86;
  const topY = 0.79;
  const topThick = 0.052;

  const woodMat = makeMat(THREE, cfg.trim, { roughness: 0.46, metalness: 0.06 });
  const brassMat = makeMat(THREE, 0xd4ae57, { roughness: 0.26, metalness: 0.86 });

  // Bevelled tabletop
  addMesh(THREE, table, roundedBoxGeo(THREE, w, topThick, l, 0.015), woodMat, {
    pos: [0, topY - topThick / 2, 0],
    slot: "wood"
  });
  // Apron rail
  addMesh(THREE, table, roundedBoxGeo(THREE, w - 0.1, 0.085, l - 0.12, 0.01), woodMat, {
    pos: [0, topY - topThick - 0.04, 0],
    slot: "wood"
  });

  // Four turned legs with brass foot ferrules
  const legPts = [
    new THREE.Vector2(0.022, 0.0),
    new THREE.Vector2(0.026, 0.08),
    new THREE.Vector2(0.032, 0.36),
    new THREE.Vector2(0.04, 0.56),
    new THREE.Vector2(0.034, 0.62),
    new THREE.Vector2(0.042, 0.74)
  ];
  const legGeo = new THREE.LatheGeometry(legPts, 16);
  const ferruleGeo = new THREE.CylinderGeometry(0.025, 0.022, 0.065, 16);
  for (const lx of [-w / 2 + 0.095, w / 2 - 0.095]) {
    for (const lz of [-l / 2 + 0.11, l / 2 - 0.11]) {
      addMesh(THREE, table, legGeo, woodMat, {
        pos: [lx, 0, lz],
        slot: "wood"
      });
      addMesh(THREE, table, ferruleGeo, brassMat, {
        pos: [lx, 0.033, lz],
        slot: "metal"
      });
    }
  }

  // H-stretcher bars connecting the legs
  for (const lz of [-l / 2 + 0.11, l / 2 - 0.11]) {
    addMesh(THREE, table, roundedBoxGeo(THREE, w - 0.22, 0.036, 0.036, 0.008), woodMat, {
      pos: [0, 0.18, lz],
      slot: "wood"
    });
  }
  addMesh(THREE, table, roundedBoxGeo(THREE, 0.042, 0.038, l - 0.24, 0.008), woodMat, {
    pos: [0, 0.18, 0],
    slot: "wood"
  });

  // Two green-shaded brass banker's lamps fixed to the reading table
  buildBankersLamp(THREE, table, [0, topY, -0.48], preset, cfg.accent);
  buildBankersLamp(THREE, table, [0, topY, 0.48], preset, cfg.accent);
}

function buildCardCatalogue(THREE, root, cfg) {
  const cab = new THREE.Group();
  cab.name = "cardCatalogue";
  // Against left wall, beside the floor-to-ceiling bookshelves, facing +X
  cab.position.set(-1.76, 0, 1.56);
  root.add(cab);

  const depth = 0.44;
  const width = 0.68;
  const legH = 0.36;
  const bodyH = 0.78;

  const woodMat = makeMat(THREE, cfg.trim, { roughness: 0.5, metalness: 0.05 });
  const brassMat = makeMat(THREE, 0xd4ae57, { roughness: 0.26, metalness: 0.85 });
  const cardMat = makeMat(THREE, 0xf5efe2, { roughness: 0.85, metalness: 0.01 });

  // Four tapered legs
  const legGeo = new THREE.CylinderGeometry(0.022, 0.014, legH, 12);
  for (const lx of [-depth / 2 + 0.05, depth / 2 - 0.05]) {
    for (const lz of [-width / 2 + 0.06, width / 2 - 0.06]) {
      addMesh(THREE, cab, legGeo, woodMat, {
        pos: [lx, legH / 2, lz],
        slot: "wood"
      });
    }
  }

  // Main cabinet body & top cap
  addMesh(THREE, cab, roundedBoxGeo(THREE, depth, bodyH, width, 0.012), woodMat, {
    pos: [0, legH + bodyH / 2, 0],
    slot: "wood"
  });
  addMesh(THREE, cab, roundedBoxGeo(THREE, depth + 0.03, 0.028, width + 0.03, 0.008), woodMat, {
    pos: [0.006, legH + bodyH + 0.012, 0],
    slot: "wood"
  });

  // 20 tiny drawers (4 columns x 5 rows) on the +X face
  const cols = 4;
  const rows = 5;
  const dw = (width - 0.08) / cols;
  const dh = (bodyH - 0.08) / rows;
  const drawerGeo = roundedBoxGeo(THREE, 0.022, dh - 0.012, dw - 0.012, 0.004, 1);
  const frameGeo = new THREE.BoxGeometry(0.006, 0.032, 0.064);
  const slipGeo = new THREE.BoxGeometry(0.007, 0.022, 0.052);
  const knobGeo = new THREE.SphereGeometry(0.0075, 8, 8);

  const frontX = depth / 2 + 0.006;
  for (let r = 0; r < rows; r++) {
    const dy = legH + 0.04 + (r + 0.5) * dh;
    for (let c = 0; c < cols; c++) {
      const dz = -width / 2 + 0.04 + (c + 0.5) * dw;
      addMesh(THREE, cab, drawerGeo, woodMat, {
        pos: [frontX, dy, dz],
        slot: "wood"
      });
      // Brass label holder & tiny blank cream card
      addMesh(THREE, cab, frameGeo, brassMat, {
        pos: [frontX + 0.011, dy + 0.014, dz],
        slot: "metal",
        castShadow: false
      });
      addMesh(THREE, cab, slipGeo, cardMat, {
        pos: [frontX + 0.012, dy + 0.014, dz],
        castShadow: false
      });
      // Tiny brass drawer pull knob
      addMesh(THREE, cab, knobGeo, brassMat, {
        pos: [frontX + 0.016, dy - 0.022, dz],
        slot: "metal",
        castShadow: false
      });
    }
  }
}

function readingRoom(THREE, opts) {
  const cfg = resolveOpts(DEFAULT_OPTS.readingRoom, opts);
  const preset = TIME_PRESETS[cfg.time] || TIME_PRESETS.day;
  const root = new THREE.Group();
  root.name = "space_readingRoom";
  root.userData.spaceId = "readingRoom";
  root.userData.time = cfg.time;

  buildReadingRoomShell(THREE, root, cfg);
  buildArchedWindowAndSeat(THREE, root, cfg);
  buildBookshelvesAndLadder(THREE, root, cfg);
  buildReadingTable(THREE, root, cfg, preset);
  buildCardCatalogue(THREE, root, cfg);

  return root;
}

// ============================================================================
// EXPORTS: SPACES, SLOTS, CATALOG, recolor
// ============================================================================

export const SPACES = { lab, readingRoom };

export const SLOTS = {
  lab: {
    centerFloor: {
      position: [0.35, 0, 0.45],
      rotationY: 0,
      footprint: [1.5, 1.5],
      kind: "floor"
    },
    benchStool: {
      position: [0.64, 0, -1.04],
      rotationY: Math.PI,
      footprint: [0.6, 0.6],
      kind: "floor"
    },
    frontLeftFloor: {
      position: [-1.42, 0, 1.25],
      rotationY: Math.PI / 2,
      footprint: [0.85, 0.9],
      kind: "floor"
    },
    benchLeftSurface: {
      position: [-0.45, 0.88, -1.62],
      rotationY: 0,
      footprint: [0.75, 0.55],
      kind: "surface"
    },
    benchCenterSurface: {
      position: [0.55, 0.88, -1.62],
      rotationY: 0,
      footprint: [0.8, 0.55],
      kind: "surface"
    },
    fumeHoodSurface: {
      position: [-1.58, 0.9, -1.15],
      rotationY: Math.PI / 2,
      footprint: [0.5, 0.9],
      kind: "surface"
    },
    leftWallFront: {
      position: [-1.99, 1.55, 1.48],
      rotationY: Math.PI / 2,
      footprint: [0.7, 0.6],
      kind: "wall"
    }
  },
  readingRoom: {
    tableChairLeft1: {
      position: [-0.42, 0, -0.32],
      rotationY: Math.PI / 2,
      footprint: [0.6, 0.6],
      kind: "floor"
    },
    tableChairLeft2: {
      position: [-0.42, 0, 0.62],
      rotationY: Math.PI / 2,
      footprint: [0.6, 0.6],
      kind: "floor"
    },
    tableChairRight1: {
      position: [1.26, 0, -0.32],
      rotationY: -Math.PI / 2,
      footprint: [0.6, 0.6],
      kind: "floor"
    },
    tableChairRight2: {
      position: [1.26, 0, 0.62],
      rotationY: -Math.PI / 2,
      footprint: [0.6, 0.6],
      kind: "floor"
    },
    frontRightCorner: {
      position: [1.45, 0, 1.45],
      rotationY: -Math.PI * 0.75,
      footprint: [0.95, 0.95],
      kind: "floor"
    },
    tableCenterSurface: {
      position: [0.42, 0.79, 0.15],
      rotationY: 0,
      footprint: [0.65, 0.55],
      kind: "surface"
    },
    cardCatalogueTop: {
      position: [-1.76, 1.16, 1.56],
      rotationY: Math.PI / 2,
      footprint: [0.4, 0.6],
      kind: "surface"
    },
    leftWallFront: {
      position: [-1.99, 1.78, 1.56],
      rotationY: Math.PI / 2,
      footprint: [0.65, 0.65],
      kind: "wall"
    }
  }
};

export function recolor(group, palette) {
  if (!group || !palette) return;
  const resolved = {
    primary: palette.primary !== undefined ? palette.primary : palette.wall,
    secondary:
      palette.secondary !== undefined
        ? palette.secondary
        : palette.trim !== undefined
        ? palette.trim
        : palette.floor,
    accent: palette.accent,
    wood: palette.wood !== undefined ? palette.wood : palette.trim,
    metal: palette.metal,
    fabric: palette.fabric !== undefined ? palette.fabric : palette.accent,
    skin: palette.skin,
    fur: palette.fur,
    furAccent: palette.furAccent
  };

  group.traverse((obj) => {
    if (!obj.isMesh || !obj.material || !obj.userData || !obj.userData.slot) return;
    const nextColor = resolved[obj.userData.slot];
    if (nextColor === undefined) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (m && m.color) m.color.set(nextColor);
    }
  });
}

export const CATALOG = [
  {
    id: "lab",
    name: "Personal Science Lab",
    kind: "space",
    footprint: [4, 4],
    placement: "floor",
    variants: 3,
    note: "Bright 4x4m cutaway laboratory with resin bench, sink, glowing reagent shelf, fume hood, periodic tile board, clock, eyewash plaque, and ceiling strip light."
  },
  {
    id: "readingRoom",
    name: "Library Reading Room",
    kind: "space",
    footprint: [4, 4],
    placement: "floor",
    variants: 3,
    note: "Cozy 4x4m cutaway library with floor-to-ceiling bookshelves, brass rolling ladder, arched window seat, parquet floor, card catalogue, and banker's lamps."
  }
];
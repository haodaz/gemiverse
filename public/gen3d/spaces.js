// Extra cutaway-diorama spaces for an AI companion (4 m x 4 m, Y-up, three.js r160)

function makeRoundedBox(THREE, w, h, d, r = 0.018, segs = 2) {
  const rr = Math.min(r, w * 0.42, h * 0.42, d * 0.42);
  const iw = Math.max(0.001, w - rr * 2);
  const ih = Math.max(0.001, h - rr * 2);
  const id = Math.max(0.001, d - rr * 2);
  const hw = iw * 0.5;
  const hh = ih * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, -hh);
  shape.lineTo(hw, -hh);
  shape.lineTo(hw, hh);
  shape.lineTo(-hw, hh);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: id,
    bevelEnabled: true,
    bevelThickness: rr,
    bevelSize: rr,
    bevelSegments: segs,
    curveSegments: segs,
  });
  geo.center();
  return geo;
}

function makeRoundedDisc(THREE, rx, rz, h, r = 0.015, segs = 12) {
  const rr = Math.min(r, rx * 0.35, rz * 0.35, h * 0.42);
  const irx = Math.max(0.005, rx - rr);
  const irz = Math.max(0.005, rz - rr);
  const id = Math.max(0.002, h - rr * 2);
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, irx, irz, 0, Math.PI * 2, false, 0);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: id,
    bevelEnabled: true,
    bevelThickness: rr,
    bevelSize: rr,
    bevelSegments: 2,
    curveSegments: segs,
  });
  geo.rotateX(Math.PI / 2);
  geo.center();
  return geo;
}

function makeMat(THREE, color, props = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: props.roughness ?? 0.72,
    metalness: props.metalness ?? 0.04,
    transparent: props.transparent ?? false,
    opacity: props.opacity ?? 1.0,
    emissive: props.emissive ?? 0x000000,
    emissiveIntensity: props.emissiveIntensity ?? 0,
    side: props.side ?? THREE.FrontSide,
  });
}

function addMesh(THREE, parent, geo, mat, pos, rot, slot, opts = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = opts.castShadow ?? true;
  m.receiveShadow = opts.receiveShadow ?? true;
  if (slot) m.userData.slot = slot;
  if (opts.toneScale != null) m.userData.toneScale = opts.toneScale;
  parent.add(m);
  return m;
}

function getTimeConfig(time = "day") {
  if (time === "dusk") {
    return {
      time: "dusk",
      sky: 0x5c5b8c,
      horizon: 0xe88b68,
      lampColor: 0xffc67a,
      lampIntensity: 1.05,
      windowGlow: 0xffe0a6,
      windowGlowIntensity: 0.75,
      stars: false,
      skyEmissive: 0.45,
    };
  }
  if (time === "night") {
    return {
      time: "night",
      sky: 0x161d36,
      horizon: 0x263257,
      lampColor: 0xffb95e,
      lampIntensity: 1.8,
      windowGlow: 0xffd27d,
      windowGlowIntensity: 1.25,
      stars: true,
      skyEmissive: 0.35,
    };
  }
  return {
    time: "day",
    sky: 0x9fd3f5,
    horizon: 0xdcf0ff,
    lampColor: 0xfff1d6,
    lampIntensity: 0.12,
    windowGlow: 0x9fd3f5,
    windowGlowIntensity: 0.0,
    stars: false,
    skyEmissive: 0.55,
  };
}

function resolvePalette(opts = {}, defaults = {}) {
  return {
    primary: opts.wall ?? defaults.primary ?? 0xf2ebe1,
    secondary: opts.trim ?? defaults.secondary ?? 0xffffff,
    wood: opts.floor ?? defaults.wood ?? 0xc49566,
    accent: opts.accent ?? defaults.accent ?? 0x6b9a8b,
    metal: defaults.metal ?? 0x454c54,
    fabric: defaults.fabric ?? 0xd98a6c,
  };
}

function addSkyBackdrop(THREE, group, tCfg, height = 3.5) {
  const skyGroup = new THREE.Group();
  skyGroup.name = "skyBackdrop";
  const skyMat = makeMat(THREE, tCfg.sky, {
    roughness: 1.0,
    metalness: 0.0,
    emissive: tCfg.sky,
    emissiveIntensity: tCfg.skyEmissive,
  });
  const horMat = makeMat(THREE, tCfg.horizon, {
    roughness: 1.0,
    metalness: 0.0,
    emissive: tCfg.horizon,
    emissiveIntensity: tCfg.skyEmissive,
  });

  const span = 4.95;
  const backGeo = new THREE.PlaneGeometry(span, height);
  const leftGeo = new THREE.PlaneGeometry(span, height);

  addMesh(THREE, skyGroup, backGeo, skyMat, [-0.15, height * 0.5 - 0.18, -2.75], [0, 0, 0], null, {
    castShadow: false,
    receiveShadow: false,
  });
  addMesh(THREE, skyGroup, leftGeo, skyMat, [-2.75, height * 0.5 - 0.18, -0.15], [0, Math.PI / 2, 0], null, {
    castShadow: false,
    receiveShadow: false,
  });

  const bandH = 0.95;
  const bandGeo = new THREE.PlaneGeometry(span, bandH);
  addMesh(THREE, skyGroup, bandGeo, horMat, [-0.15, bandH * 0.5 - 0.18, -2.74], [0, 0, 0], null, {
    castShadow: false,
    receiveShadow: false,
  });
  addMesh(THREE, skyGroup, bandGeo, horMat, [-2.74, bandH * 0.5 - 0.18, -0.15], [0, Math.PI / 2, 0], null, {
    castShadow: false,
    receiveShadow: false,
  });

  if (tCfg.stars) {
    const starGeo = new THREE.SphereGeometry(0.022, 6, 6);
    const starMat = makeMat(THREE, 0xfff8dc, {
      roughness: 0.4,
      emissive: 0xfff4c4,
      emissiveIntensity: 1.6,
    });
    const backCoords = [
      [-1.9, 2.9], [-1.1, 2.45], [-0.3, 3.05], [0.55, 2.6], [1.3, 2.95], [1.85, 2.3],
      [-0.7, 1.9], [0.9, 1.95], [1.65, 1.65],
    ];
    for (let i = 0; i < backCoords.length; i++) {
      addMesh(THREE, skyGroup, starGeo, starMat, [backCoords[i][0], backCoords[i][1], -2.72], null, null, {
        castShadow: false,
        receiveShadow: false,
      });
    }
    const leftCoords = [
      [-1.7, 2.85], [-0.8, 2.55], [0.1, 3.0], [0.95, 2.4], [1.7, 2.8], [-1.2, 1.95], [0.6, 1.85],
    ];
    for (let i = 0; i < leftCoords.length; i++) {
      addMesh(THREE, skyGroup, starGeo, starMat, [-2.72, leftCoords[i][1], leftCoords[i][0]], null, null, {
        castShadow: false,
        receiveShadow: false,
      });
    }
  }

  group.add(skyGroup);
}

function addBasePlinth(THREE, group, plinthMat, slot = "secondary", wallThick = 0.16) {
  const w = 4 + wallThick;
  const geo = makeRoundedBox(THREE, w, 0.18, w, 0.02, 2);
  addMesh(THREE, group, geo, plinthMat, [-wallThick * 0.5, -0.09, -wallThick * 0.5], null, slot);
}

// ============================================================================
// 1. LOFT
// ============================================================================
function loft(THREE, opts = {}) {
  const group = new THREE.Group();
  group.name = "loft";
  const pal = resolvePalette(opts, {
    primary: 0xf4eee6,
    secondary: 0xebe4da,
    wood: 0xc29362,
    accent: 0x6f8f7d,
    metal: 0x3b4046,
    fabric: 0xd99b78,
  });
  const tCfg = getTimeConfig(opts.time);
  addSkyBackdrop(THREE, group, tCfg, 3.6);

  const wallMat = makeMat(THREE, pal.primary, { roughness: 0.85 });
  const trimMat = makeMat(THREE, pal.secondary, { roughness: 0.65 });
  const woodMat = makeMat(THREE, pal.wood, { roughness: 0.62 });
  const woodDarkMat = makeMat(THREE, pal.wood, { roughness: 0.68 });
  woodDarkMat.color.multiplyScalar(0.84);
  const metalMat = makeMat(THREE, pal.metal, { roughness: 0.35, metalness: 0.72 });
  const accentMat = makeMat(THREE, pal.accent, { roughness: 0.72 });
  const glassMat = makeMat(THREE, 0xdff2ff, {
    roughness: 0.08,
    metalness: 0.1,
    transparent: true,
    opacity: 0.28,
  });
  const lampMat = makeMat(THREE, tCfg.lampColor, {
    roughness: 0.3,
    emissive: tCfg.lampColor,
    emissiveIntensity: tCfg.lampIntensity,
  });

  // Base plinth & planked floor
  addBasePlinth(THREE, group, trimMat, "secondary", 0.16);
  const plankCount = 12;
  const plankW = 4 / plankCount;
  const plankGeo = makeRoundedBox(THREE, plankW - 0.008, 0.03, 3.98, 0.006, 1);
  for (let i = 0; i < plankCount; i++) {
    const px = -2 + plankW * (i + 0.5);
    const mat = i % 2 === 0 ? woodMat : woodDarkMat;
    addMesh(THREE, group, plankGeo, mat, [px, -0.012, 0], null, "wood", {
      toneScale: i % 2 === 0 ? 1.0 : 0.84,
    });
  }

  // Left wall (x = -2, full height 2.7 m)
  addMesh(THREE, group, makeRoundedBox(THREE, 0.16, 2.7, 4.16, 0.015), wallMat, [-2.08, 1.35, -0.08], null, "primary");
  // Left wall baseboards & mid-level wainscot trim
  addMesh(THREE, group, makeRoundedBox(THREE, 0.024, 0.11, 4.0, 0.006), trimMat, [-1.99, 0.055, 0], null, "secondary");
  addMesh(THREE, group, makeRoundedBox(THREE, 0.028, 0.06, 4.0, 0.008), trimMat, [-1.99, 2.67, 0], null, "secondary");

  // Back wall (z = -2): vertical lower section up to y = 1.65
  addMesh(THREE, group, makeRoundedBox(THREE, 4.0, 1.65, 0.16, 0.015), wallMat, [0, 0.825, -2.08], null, "primary");
  addMesh(THREE, group, makeRoundedBox(THREE, 4.0, 0.11, 0.024, 0.006), trimMat, [0, 0.055, -1.99], null, "secondary");

  // Upper sloped attic back wall (y = 1.65 -> 2.7, sloping inward from z = -2.0 to z = -1.55)
  const slopeAngle = Math.atan2(0.45, 1.05); // ~0.405 rad
  const slopeLen = Math.hypot(0.45, 1.05); // ~1.142 m
  const slopeMidY = 2.175;
  const slopeMidZ = -1.855;
  // Left & right solid cheek panels framing the skylight (x: -2..-1.15 and 1.15..2)
  const sideW = 0.85;
  const cheekGeo = makeRoundedBox(THREE, sideW, slopeLen + 0.06, 0.16, 0.012);
  addMesh(THREE, group, cheekGeo, wallMat, [-2 + sideW * 0.5, slopeMidY, slopeMidZ], [slopeAngle, 0, 0], "primary");
  addMesh(THREE, group, cheekGeo, wallMat, [2 - sideW * 0.5, slopeMidY, slopeMidZ], [slopeAngle, 0, 0], "primary");
  // Top & bottom headers of the skylight
  addMesh(THREE, group, makeRoundedBox(THREE, 2.34, 0.14, 0.18, 0.012), trimMat, [0, 2.66, -1.63], [slopeAngle, 0, 0], "secondary");
  addMesh(THREE, group, makeRoundedBox(THREE, 2.34, 0.12, 0.18, 0.012), trimMat, [0, 1.68, -2.04], [slopeAngle, 0, 0], "secondary");

  // Sloped skylight window frame, mullions & 3 transparent panes
  const skyGroup = new THREE.Group();
  skyGroup.position.set(0, slopeMidY, slopeMidZ + 0.02);
  skyGroup.rotation.x = slopeAngle;
  const mullionGeo = makeRoundedBox(THREE, 0.055, slopeLen - 0.14, 0.08, 0.008);
  const mullionXs = [-1.14, -0.38, 0.38, 1.14];
  for (let i = 0; i < mullionXs.length; i++) {
    addMesh(THREE, skyGroup, mullionGeo, woodDarkMat, [mullionXs[i], 0, 0], null, "wood", { toneScale: 0.84 });
  }
  const paneGeo = new THREE.BoxGeometry(0.72, slopeLen - 0.18, 0.018);
  for (let i = 0; i < 3; i++) {
    addMesh(THREE, skyGroup, paneGeo, glassMat, [-0.76 + i * 0.76, 0, -0.01], null, null, {
      castShadow: false,
      receiveShadow: false,
    });
  }
  group.add(skyGroup);

  // Mezzanine platform at y = 1.4 over back half (z from -2 to 0, x from -2 to 2)
  addMesh(THREE, group, makeRoundedBox(THREE, 3.98, 0.11, 2.0, 0.016), woodMat, [0, 1.345, -1.0], null, "wood");
  // Exposed timber joists beneath mezzanine
  const joistGeo = makeRoundedBox(THREE, 0.09, 0.12, 1.94, 0.012);
  for (let i = 0; i < 5; i++) {
    addMesh(THREE, group, joistGeo, woodDarkMat, [-1.85 + i * 0.925, 1.24, -1.0], null, "wood", { toneScale: 0.84 });
  }
  // Front edge fascia beam
  addMesh(THREE, group, makeRoundedBox(THREE, 4.0, 0.16, 0.08, 0.012), woodDarkMat, [0, 1.31, -0.02], null, "wood", {
    toneScale: 0.84,
  });
  // Support columns & knee braces
  const colGeo = makeRoundedBox(THREE, 0.11, 1.28, 0.11, 0.014);
  addMesh(THREE, group, colGeo, woodDarkMat, [-1.92, 0.64, -0.06], null, "wood", { toneScale: 0.84 });
  addMesh(THREE, group, colGeo, woodDarkMat, [1.92, 0.64, -0.06], null, "wood", { toneScale: 0.84 });
  const braceGeo = makeRoundedBox(THREE, 0.07, 0.42, 0.07, 0.01);
  addMesh(THREE, group, braceGeo, woodDarkMat, [-1.76, 1.12, -0.06], [0, 0, -Math.PI / 4], "wood", { toneScale: 0.84 });
  addMesh(THREE, group, braceGeo, woodDarkMat, [1.76, 1.12, -0.06], [0, 0, Math.PI / 4], "wood", { toneScale: 0.84 });

  // Mezzanine railing (x from -1.96 to 1.02; ladder gap x: 1.02..1.72; short right end x: 1.72..1.96)
  const railY = 2.16;
  addMesh(THREE, group, makeRoundedBox(THREE, 3.04, 0.055, 0.065, 0.014), woodMat, [-0.46, railY, -0.04], null, "wood");
  addMesh(THREE, group, makeRoundedBox(THREE, 0.3, 0.055, 0.065, 0.014), woodMat, [1.85, railY, -0.04], null, "wood");
  const newelGeo = makeRoundedBox(THREE, 0.065, 0.8, 0.065, 0.012);
  const newelXs = [-1.94, 1.02, 1.72, 1.94];
  for (let i = 0; i < newelXs.length; i++) {
    addMesh(THREE, group, newelGeo, woodDarkMat, [newelXs[i], 1.78, -0.04], null, "wood", { toneScale: 0.84 });
  }
  const balusterGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.74, 8);
  for (let bx = -1.78; bx <= 0.88; bx += 0.19) {
    addMesh(THREE, group, balusterGeo, metalMat, [bx, 1.77, -0.04], null, "metal");
  }
  // Horizontal mid-wire bar
  addMesh(THREE, group, makeRoundedBox(THREE, 2.94, 0.018, 0.018, 0.004), metalMat, [-0.46, 1.78, -0.04], null, "metal");

  // Ladder at x = 1.37, leaning from z = 0.44 (y = 0) to z = 0.02 (y = 1.44)
  const ladderGroup = new THREE.Group();
  ladderGroup.position.set(1.37, 0.72, 0.23);
  ladderGroup.rotation.x = -Math.atan2(0.42, 1.44);
  const ladderLen = Math.hypot(0.42, 1.44) + 0.08;
  const stileGeo = makeRoundedBox(THREE, 0.042, ladderLen, 0.075, 0.01);
  addMesh(THREE, ladderGroup, stileGeo, woodMat, [-0.21, 0, 0], null, "wood");
  addMesh(THREE, ladderGroup, stileGeo, woodMat, [0.21, 0, 0], null, "wood");
  const rungGeo = makeRoundedBox(THREE, 0.4, 0.032, 0.065, 0.009);
  for (let i = 0; i < 6; i++) {
    const ry = -0.62 + i * 0.24;
    addMesh(THREE, ladderGroup, rungGeo, woodDarkMat, [0, ry, 0], null, "wood", { toneScale: 0.84 });
  }
  const hookGeo = new THREE.TorusGeometry(0.036, 0.01, 8, 14, Math.PI);
  addMesh(THREE, ladderGroup, hookGeo, metalMat, [-0.21, ladderLen * 0.47, -0.03], [0, Math.PI / 2, 0], "metal");
  addMesh(THREE, ladderGroup, hookGeo, metalMat, [0.21, ladderLen * 0.47, -0.03], [0, Math.PI / 2, 0], "metal");
  group.add(ladderGroup);

  // Cozy lighting details: under-mezzanine puck lights & two wall sconces
  const puckGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.02, 12);
  for (let px = -1.3; px <= 1.3; px += 1.3) {
    addMesh(THREE, group, puckGeo, lampMat, [px, 1.28, -0.95], null, null, { castShadow: false });
  }
  const sconceBaseGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.03, 12);
  const sconceShadeGeo = new THREE.ConeGeometry(0.085, 0.11, 14, 1, true);
  const bulbGeo = new THREE.SphereGeometry(0.042, 12, 10);
  const sconcePos = [
    [-1.98, 1.05, 0.75],
    [-1.98, 2.08, -0.95],
  ];
  for (let i = 0; i < sconcePos.length; i++) {
    const [sx, sy, sz] = sconcePos[i];
    addMesh(THREE, group, sconceBaseGeo, metalMat, [sx, sy, sz], [0, 0, Math.PI / 2], "metal");
    addMesh(THREE, group, sconceShadeGeo, accentMat, [sx + 0.09, sy + 0.02, sz], null, "accent");
    addMesh(THREE, group, bulbGeo, lampMat, [sx + 0.09, sy - 0.02, sz], null, null, { castShadow: false });
  }

  return group;
}

// ============================================================================
// 2. BACKYARD
// ============================================================================
function backyard(THREE, opts = {}) {
  const group = new THREE.Group();
  group.name = "backyard";
  const pal = resolvePalette(opts, {
    primary: 0x73a857,
    secondary: 0x8f7965,
    wood: 0xb98555,
    accent: 0x5c9646,
    metal: 0x3f474d,
    fabric: 0xe3967b,
  });
  const tCfg = getTimeConfig(opts.time);
  addSkyBackdrop(THREE, group, tCfg, 3.2);

  const grassMat = makeMat(THREE, pal.primary, { roughness: 0.92 });
  const soilMat = makeMat(THREE, pal.secondary, { roughness: 0.95 });
  const woodMat = makeMat(THREE, pal.wood, { roughness: 0.76 });
  const woodDarkMat = makeMat(THREE, pal.wood, { roughness: 0.82 });
  woodDarkMat.color.multiplyScalar(0.8);
  const foliageMat = makeMat(THREE, pal.accent, { roughness: 0.85 });
  const foliageLightMat = makeMat(THREE, pal.accent, { roughness: 0.85 });
  foliageLightMat.color.multiplyScalar(1.16);
  const stoneMat = makeMat(THREE, pal.secondary, { roughness: 0.84 });
  stoneMat.color.multiplyScalar(1.18);
  const metalMat = makeMat(THREE, pal.metal, { roughness: 0.4, metalness: 0.65 });
  const ropeMat = makeMat(THREE, 0xd8c39e, { roughness: 0.9 });
  const waterMat = makeMat(THREE, 0x4ba9b8, {
    roughness: 0.12,
    metalness: 0.15,
    transparent: true,
    opacity: 0.78,
  });
  const pondBedMat = makeMat(THREE, 0x2a5c63, { roughness: 0.9 });
  const flowerMat = makeMat(THREE, pal.fabric, { roughness: 0.65 });
  const lampMat = makeMat(THREE, tCfg.lampColor, {
    roughness: 0.3,
    emissive: tCfg.lampColor,
    emissiveIntensity: tCfg.lampIntensity,
  });

  // Soil cutaway base & lush grass lawn top
  addMesh(THREE, group, makeRoundedBox(THREE, 4.14, 0.17, 4.14, 0.02), soilMat, [-0.07, -0.105, -0.07], null, "secondary");
  addMesh(THREE, group, makeRoundedBox(THREE, 4.12, 0.055, 4.12, 0.022), grassMat, [-0.06, -0.015, -0.06], null, "primary");

  // Wooden fence (1.2 m high) along z = -2 and x = -2
  const postGeo = makeRoundedBox(THREE, 0.1, 1.24, 0.1, 0.012);
  const capGeo = makeRoundedBox(THREE, 0.13, 0.035, 0.13, 0.01);
  const lanternGeo = makeRoundedBox(THREE, 0.075, 0.075, 0.075, 0.012);
  const railGeo = makeRoundedBox(THREE, 4.0, 0.055, 0.04, 0.008);
  const picketGeo = makeRoundedBox(THREE, 0.135, 1.15, 0.026, 0.01);

  // Back fence rails & pickets
  addMesh(THREE, group, railGeo, woodDarkMat, [0, 0.32, -2.02], null, "wood", { toneScale: 0.8 });
  addMesh(THREE, group, railGeo, woodDarkMat, [0, 0.94, -2.02], null, "wood", { toneScale: 0.8 });
  for (let px = -1.9; px <= 1.92; px += 0.155) {
    const hVar = ((Math.round(px * 10) % 3) - 1) * 0.015;
    addMesh(THREE, group, picketGeo, woodMat, [px, 0.58 + hVar, -1.99], null, "wood");
  }
  // Left fence rails & pickets
  addMesh(THREE, group, railGeo, woodDarkMat, [-2.02, 0.32, 0], [0, Math.PI / 2, 0], "wood", { toneScale: 0.8 });
  addMesh(THREE, group, railGeo, woodDarkMat, [-2.02, 0.94, 0], [0, Math.PI / 2, 0], "wood", { toneScale: 0.8 });
  for (let pz = -1.9; pz <= 1.92; pz += 0.155) {
    const hVar = ((Math.round(pz * 10) % 3) - 1) * 0.015;
    addMesh(THREE, group, picketGeo, woodMat, [-1.99, 0.58 + hVar, pz], [0, Math.PI / 2, 0], "wood");
  }
  // Fence posts & solar cap lights
  const postCoords = [
    [-2.02, -2.02, true],
    [-0.68, -2.02, false],
    [0.66, -2.02, true],
    [1.96, -2.02, true],
    [-2.02, -0.68, false],
    [-2.02, 0.66, true],
    [-2.02, 1.96, false],
  ];
  for (let i = 0; i < postCoords.length; i++) {
    const [x, z, hasLight] = postCoords[i];
    addMesh(THREE, group, postGeo, woodDarkMat, [x, 0.62, z], null, "wood", { toneScale: 0.8 });
    addMesh(THREE, group, capGeo, woodMat, [x, 1.255, z], null, "wood");
    if (hasLight) {
      addMesh(THREE, group, lanternGeo, lampMat, [x, 1.31, z], null, null, { castShadow: false });
      addMesh(THREE, group, makeRoundedBox(THREE, 0.09, 0.02, 0.09, 0.006), metalMat, [x, 1.355, z], null, "metal");
    }
  }

  // Stepping stones curving through the lawn
  const stones = [
    [0.2, 1.62, 0.24, 0.18, 0.15],
    [0.42, 1.16, 0.22, 0.19, -0.2],
    [0.68, 0.68, 0.25, 0.2, 0.3],
    [0.92, 0.18, 0.21, 0.18, -0.15],
    [1.12, -0.34, 0.24, 0.19, 0.25],
    [1.22, -0.88, 0.23, 0.18, -0.1],
    [0.18, 0.56, 0.19, 0.16, 0.4],
  ];
  for (let i = 0; i < stones.length; i++) {
    const [sx, sz, rx, rz, ry] = stones[i];
    const sGeo = makeRoundedDisc(THREE, rx, rz, 0.042, 0.014, 10);
    addMesh(THREE, group, sGeo, stoneMat, [sx, 0.012, sz], [0, ry, 0], "secondary", { toneScale: 1.18 });
  }

  // Small pond at (-0.95, 0.82)
  const pondX = -0.95;
  const pondZ = 0.82;
  addMesh(THREE, group, makeRoundedDisc(THREE, 0.66, 0.52, 0.02, 0.006, 20), pondBedMat, [pondX, 0.006, pondZ], [0, 0.25, 0], null, {
    castShadow: false,
  });
  addMesh(THREE, group, makeRoundedDisc(THREE, 0.64, 0.5, 0.018, 0.005, 20), waterMat, [pondX, 0.018, pondZ], [0, 0.25, 0], null, {
    castShadow: false,
  });
  // River stones rimming the pond
  const rockGeo = new THREE.SphereGeometry(0.11, 10, 8);
  const rockCount = 16;
  for (let i = 0; i < rockCount; i++) {
    const a = (i / rockCount) * Math.PI * 2;
    const rx = pondX + Math.cos(a + 0.25) * 0.65;
    const rz = pondZ + Math.sin(a + 0.25) * 0.52;
    const m = addMesh(THREE, group, rockGeo, stoneMat, [rx, 0.035, rz], [0, a, 0], "secondary", { toneScale: 1.18 });
    const sc = 0.78 + (i % 3) * 0.22;
    m.scale.set(sc * 1.15, sc * 0.58, sc * 0.95);
  }
  // Lily pads & small lotus flower
  const padShape = new THREE.Shape();
  padShape.moveTo(0, 0);
  padShape.absarc(0, 0, 0.11, 0.25, Math.PI * 2 - 0.25, false);
  padShape.lineTo(0, 0);
  const padGeo = new THREE.ExtrudeGeometry(padShape, {
    depth: 0.008,
    bevelEnabled: true,
    bevelSize: 0.004,
    bevelThickness: 0.003,
    bevelSegments: 1,
    curveSegments: 14,
  });
  padGeo.rotateX(Math.PI / 2);
  addMesh(THREE, group, padGeo, foliageMat, [pondX - 0.18, 0.032, pondZ - 0.08], [0, 0.8, 0], "accent");
  addMesh(THREE, group, padGeo, foliageLightMat, [pondX + 0.2, 0.032, pondZ + 0.1], [0, 2.5, 0], "accent", { toneScale: 1.16 });
  addMesh(THREE, group, new THREE.SphereGeometry(0.042, 10, 8), flowerMat, [pondX - 0.18, 0.055, pondZ - 0.08], null, "fabric");

  // Tree with swing in back-left corner (-1.28, -1.22)
  const treeGroup = new THREE.Group();
  treeGroup.position.set(-1.28, 0, -1.22);
  const trunkPts = [
    new THREE.Vector2(0.26, 0.0),
    new THREE.Vector2(0.19, 0.25),
    new THREE.Vector2(0.16, 0.95),
    new THREE.Vector2(0.14, 1.65),
    new THREE.Vector2(0.11, 2.2),
  ];
  const trunkGeo = new THREE.LatheGeometry(trunkPts, 12);
  addMesh(THREE, treeGroup, trunkGeo, woodDarkMat, [0, 0, 0], null, "wood", { toneScale: 0.8 });

  // Strong extending swing bough toward +X
  const boughGeo = new THREE.CylinderGeometry(0.055, 0.085, 1.25, 10);
  addMesh(THREE, treeGroup, boughGeo, woodDarkMat, [0.55, 1.98, 0.06], [0, 0, -Math.PI / 2 + 0.14], "wood", {
    toneScale: 0.8,
  });
  // Secondary branch
  addMesh(THREE, treeGroup, new THREE.CylinderGeometry(0.04, 0.065, 0.72, 8), woodDarkMat, [-0.18, 1.95, 0.25], [0.45, 0, 0.38], "wood", {
    toneScale: 0.8,
  });

  // Layered stylised canopy puffs
  const puffGeo = new THREE.SphereGeometry(1, 14, 12);
  const puffs = [
    [0.0, 2.48, 0.0, 0.62, 0.48, 0.58, false],
    [-0.36, 2.25, 0.22, 0.46, 0.38, 0.46, true],
    [0.42, 2.34, -0.18, 0.52, 0.42, 0.48, true],
    [0.68, 2.26, 0.16, 0.48, 0.38, 0.46, false],
    [-0.25, 2.38, -0.34, 0.45, 0.36, 0.44, false],
    [0.12, 2.72, 0.14, 0.44, 0.34, 0.42, true],
  ];
  for (let i = 0; i < puffs.length; i++) {
    const [px, py, pz, sx, sy, sz, light] = puffs[i];
    const m = addMesh(THREE, treeGroup, puffGeo, light ? foliageLightMat : foliageMat, [px, py, pz], null, "accent", {
      toneScale: light ? 1.16 : 1.0,
    });
    m.scale.set(sx, sy, sz);
  }

  // Hanging swing on the extending bough (local x = 0.82, z = 0.08 -> world x = -0.46, z = -1.14)
  const ropeGeo = new THREE.CylinderGeometry(0.011, 0.011, 1.44, 8);
  addMesh(THREE, treeGroup, ropeGeo, ropeMat, [0.62, 1.28, 0.08], null, "secondary");
  addMesh(THREE, treeGroup, ropeGeo, ropeMat, [1.02, 1.28, 0.08], null, "secondary");
  addMesh(THREE, treeGroup, makeRoundedBox(THREE, 0.52, 0.042, 0.22, 0.012), woodMat, [0.82, 0.56, 0.08], null, "wood");
  group.add(treeGroup);

  // Corner garden shrubs
  const bushPositions = [
    [1.68, 0.18, -1.68, 0.28],
    [1.42, 0.14, -1.78, 0.2],
    [-1.72, 0.16, 1.65, 0.24],
  ];
  for (let i = 0; i < bushPositions.length; i++) {
    const [bx, by, bz, br] = bushPositions[i];
    const b = addMesh(THREE, group, puffGeo, i % 2 === 0 ? foliageMat : foliageLightMat, [bx, by, bz], null, "accent", {
      toneScale: i % 2 === 0 ? 1.0 : 1.16,
    });
    b.scale.set(br * 1.15, br * 0.82, br * 1.1);
  }

  return group;
}

// ============================================================================
// 3. STUDY NOOK
// ============================================================================
function studyNook(THREE, opts = {}) {
  const group = new THREE.Group();
  group.name = "studyNook";
  const pal = resolvePalette(opts, {
    primary: 0x3f544a,
    secondary: 0xf5efe6,
    wood: 0xb68250,
    accent: 0xc99c4c,
    metal: 0xc29c53,
    fabric: 0xd17e64,
  });
  const tCfg = getTimeConfig(opts.time);
  addSkyBackdrop(THREE, group, tCfg, 3.4);

  const wallMat = makeMat(THREE, pal.primary, { roughness: 0.82 });
  const trimMat = makeMat(THREE, pal.secondary, { roughness: 0.65 });
  const woodMat = makeMat(THREE, pal.wood, { roughness: 0.56 });
  const woodAltMat = makeMat(THREE, pal.wood, { roughness: 0.6 });
  woodAltMat.color.multiplyScalar(0.86);
  const brassMat = makeMat(THREE, pal.metal, { roughness: 0.28, metalness: 0.82 });
  const fabricMat = makeMat(THREE, pal.fabric, { roughness: 0.9 });
  const fabricAltMat = makeMat(THREE, pal.accent, { roughness: 0.88 });
  const glassMat = makeMat(THREE, 0xdff2ff, {
    roughness: 0.08,
    metalness: 0.1,
    transparent: true,
    opacity: 0.25,
  });
  const lampMat = makeMat(THREE, tCfg.lampColor, {
    roughness: 0.3,
    emissive: tCfg.lampColor,
    emissiveIntensity: tCfg.lampIntensity,
  });

  // Base plinth & basketweave parquet floor
  addBasePlinth(THREE, group, trimMat, "secondary", 0.16);
  const blockSize = 0.5; // 8x8 blocks across 4x4
  const tileGeo = makeRoundedBox(THREE, blockSize - 0.008, 0.026, blockSize / 2 - 0.006, 0.005, 1);
  for (let gx = 0; gx < 8; gx++) {
    for (let gz = 0; gz < 8; gz++) {
      const cx = -2 + (gx + 0.5) * blockSize;
      const cz = -2 + (gz + 0.5) * blockSize;
      const horiz = (gx + gz) % 2 === 0;
      const mat = horiz ? woodMat : woodAltMat;
      const ts = horiz ? 1.0 : 0.86;
      if (horiz) {
        addMesh(THREE, group, tileGeo, mat, [cx, -0.012, cz - blockSize * 0.25], null, "wood", { toneScale: ts });
        addMesh(THREE, group, tileGeo, mat, [cx, -0.012, cz + blockSize * 0.25], null, "wood", { toneScale: ts });
      } else {
        addMesh(THREE, group, tileGeo, mat, [cx - blockSize * 0.25, -0.012, cz], [0, Math.PI / 2, 0], "wood", { toneScale: ts });
        addMesh(THREE, group, tileGeo, mat, [cx + blockSize * 0.25, -0.012, cz], [0, Math.PI / 2, 0], "wood", { toneScale: ts });
      }
    }
  }

  // Left solid backing wall (x = -2)
  addMesh(THREE, group, makeRoundedBox(THREE, 0.16, 2.7, 4.16, 0.014), wallMat, [-2.08, 1.35, -0.08], null, "primary");

  // Back wall (z = -2) with central bay window opening (x: -0.92..0.92, y: 0.45..2.32)
  addMesh(THREE, group, makeRoundedBox(THREE, 1.08, 2.7, 0.16, 0.014), wallMat, [-1.46, 1.35, -2.08], null, "primary");
  addMesh(THREE, group, makeRoundedBox(THREE, 1.08, 2.7, 0.16, 0.014), wallMat, [1.46, 1.35, -2.08], null, "primary");
  addMesh(THREE, group, makeRoundedBox(THREE, 1.88, 0.46, 0.16, 0.014), wallMat, [0, 0.23, -2.08], null, "primary");
  addMesh(THREE, group, makeRoundedBox(THREE, 1.88, 0.38, 0.16, 0.014), wallMat, [0, 2.51, -2.08], null, "primary");

  // Bay window projection (extends outward behind z = -2.0 to z = -2.52)
  const bayGroup = new THREE.Group();
  // Bottom seat cabinet & top soffit roof
  addMesh(THREE, bayGroup, makeRoundedBox(THREE, 1.88, 0.44, 0.62, 0.014), trimMat, [0, 0.22, -2.21], null, "secondary");
  addMesh(THREE, bayGroup, makeRoundedBox(THREE, 1.94, 0.045, 0.68, 0.012), woodMat, [0, 0.45, -2.21], null, "wood");
  addMesh(THREE, bayGroup, makeRoundedBox(THREE, 1.98, 0.12, 0.68, 0.014), trimMat, [0, 2.36, -2.22], null, "secondary");
  // Drawer fronts & brass pulls below window seat
  for (let i = -1; i <= 1; i++) {
    addMesh(THREE, bayGroup, makeRoundedBox(THREE, 0.54, 0.28, 0.024, 0.008), wallMat, [i * 0.59, 0.23, -1.9], null, "primary");
    addMesh(THREE, bayGroup, new THREE.SphereGeometry(0.018, 10, 8), brassMat, [i * 0.59, 0.24, -1.88], null, "metal");
  }
  // Plush upholstered window seat cushion + 2 accent pillows
  addMesh(THREE, bayGroup, makeRoundedBox(THREE, 1.76, 0.085, 0.56, 0.032), fabricMat, [0, 0.51, -2.19], null, "fabric");
  addMesh(THREE, bayGroup, makeRoundedBox(THREE, 0.28, 0.28, 0.11, 0.045), fabricAltMat, [-0.72, 0.69, -2.22], [0.15, 0.45, -0.15], "accent");
  addMesh(THREE, bayGroup, makeRoundedBox(THREE, 0.28, 0.28, 0.11, 0.045), fabricAltMat, [0.72, 0.69, -2.22], [0.15, -0.45, 0.15], "accent");

  // Bay window mullions & glass panes (back & two side panels)
  const postGeo = makeRoundedBox(THREE, 0.065, 1.88, 0.065, 0.01);
  const bayPosts = [
    [-0.91, -1.98],
    [-0.91, -2.5],
    [-0.31, -2.5],
    [0.31, -2.5],
    [0.91, -2.5],
    [0.91, -1.98],
  ];
  for (let i = 0; i < bayPosts.length; i++) {
    addMesh(THREE, bayGroup, postGeo, trimMat, [bayPosts[i][0], 1.4, bayPosts[i][1]], null, "secondary");
  }
  // Horizontal transom bar
  addMesh(THREE, bayGroup, makeRoundedBox(THREE, 1.86, 0.045, 0.05, 0.008), trimMat, [0, 1.88, -2.5], null, "secondary");
  // Glass panes
  addMesh(THREE, bayGroup, new THREE.BoxGeometry(1.78, 1.82, 0.016), glassMat, [0, 1.4, -2.5], null, null, {
    castShadow: false,
    receiveShadow: false,
  });
  addMesh(THREE, bayGroup, new THREE.BoxGeometry(0.016, 1.82, 0.48), glassMat, [-0.91, 1.4, -2.24], null, null, {
    castShadow: false,
    receiveShadow: false,
  });
  addMesh(THREE, bayGroup, new THREE.BoxGeometry(0.016, 1.82, 0.48), glassMat, [0.91, 1.4, -2.24], null, null, {
    castShadow: false,
    receiveShadow: false,
  });
  // Recessed reading puck light in bay soffit
  addMesh(THREE, bayGroup, new THREE.CylinderGeometry(0.065, 0.065, 0.02, 12), lampMat, [0, 2.29, -2.18], null, null, {
    castShadow: false,
  });
  group.add(bayGroup);

  // Floor-to-ceiling built-in bookshelves on BACK wall (flanking bay window)
  const backBookcaseXs = [-1.48, 1.48];
  const shelfYs = [0.42, 0.82, 1.22, 1.62, 2.02, 2.42];
  for (let b = 0; b < backBookcaseXs.length; b++) {
    const cx = backBookcaseXs[b];
    // Side verticals
    addMesh(THREE, group, makeRoundedBox(THREE, 0.05, 2.66, 0.34, 0.008), wallMat, [cx - 0.48, 1.33, -1.83], null, "primary");
    addMesh(THREE, group, makeRoundedBox(THREE, 0.05, 2.66, 0.34, 0.008), wallMat, [cx + 0.48, 1.33, -1.83], null, "primary");
    // Toe kick & crown
    addMesh(THREE, group, makeRoundedBox(THREE, 1.0, 0.1, 0.32, 0.008), wallMat, [cx, 0.05, -1.84], null, "primary");
    addMesh(THREE, group, makeRoundedBox(THREE, 1.04, 0.12, 0.38, 0.012), trimMat, [cx, 2.64, -1.82], null, "secondary");
    // Shelves
    const shGeo = makeRoundedBox(THREE, 0.94, 0.032, 0.31, 0.006);
    for (let s = 0; s < shelfYs.length; s++) {
      addMesh(THREE, group, shGeo, woodMat, [cx, shelfYs[s], -1.83], null, "wood");
    }
    // Brass picture light above bookcase
    addMesh(THREE, group, makeRoundedBox(THREE, 0.26, 0.032, 0.05, 0.01), brassMat, [cx, 2.52, -1.6], null, "metal");
    addMesh(THREE, group, new THREE.BoxGeometry(0.22, 0.014, 0.02), lampMat, [cx, 2.5, -1.6], null, null, {
      castShadow: false,
    });
  }

  // Floor-to-ceiling built-in bookshelves on LEFT wall (z from -1.62 to 1.96)
  const leftDivZs = [-1.62, -0.43, 0.76, 1.95];
  for (let i = 0; i < leftDivZs.length; i++) {
    addMesh(THREE, group, makeRoundedBox(THREE, 0.36, 2.66, 0.05, 0.008), wallMat, [-1.82, 1.33, leftDivZs[i]], null, "primary");
  }
  // Lower closed cabinet base (y = 0..0.74) with ledge counter
  addMesh(THREE, group, makeRoundedBox(THREE, 0.36, 0.7, 3.56, 0.01), wallMat, [-1.82, 0.35, 0.165], null, "primary");
  addMesh(THREE, group, makeRoundedBox(THREE, 0.4, 0.04, 3.62, 0.01), woodMat, [-1.8, 0.72, 0.165], null, "wood");
  // Cabinet door panels & brass knobs
  for (let i = 0; i < 6; i++) {
    const dz = -1.32 + i * 0.595;
    addMesh(THREE, group, makeRoundedBox(THREE, 0.024, 0.52, 0.52, 0.008), trimMat, [-1.64, 0.37, dz], null, "secondary");
    addMesh(THREE, group, new THREE.SphereGeometry(0.018, 10, 8), brassMat, [-1.615, 0.45, dz + (i % 2 === 0 ? 0.18 : -0.18)], null, "metal");
  }
  // Upper shelves along left wall (4 tiers above counter)
  const leftShelfYs = [1.14, 1.54, 1.94, 2.34];
  const leftShGeo = makeRoundedBox(THREE, 0.32, 0.032, 3.56, 0.006);
  for (let s = 0; s < leftShelfYs.length; s++) {
    addMesh(THREE, group, leftShGeo, woodMat, [-1.84, leftShelfYs[s], 0.165], null, "wood");
  }
  // Crown moulding & brass library-ladder rail
  addMesh(THREE, group, makeRoundedBox(THREE, 0.42, 0.12, 3.64, 0.012), trimMat, [-1.8, 2.64, 0.165], null, "secondary");
  addMesh(THREE, group, new THREE.CylinderGeometry(0.014, 0.014, 3.5, 10), brassMat, [-1.61, 2.38, 0.165], [Math.PI / 2, 0, 0], "metal");

  return group;
}

// ============================================================================
// 4. MAKER LAB
// ============================================================================
function makerLab(THREE, opts = {}) {
  const group = new THREE.Group();
  group.name = "makerLab";
  const pal = resolvePalette(opts, {
    primary: 0xd9dde0,
    secondary: 0xb5bcc2,
    wood: 0xc99a67,
    accent: 0xe6b43c,
    metal: 0x3b424a,
    fabric: 0xc8644e,
  });
  const tCfg = getTimeConfig(opts.time);
  addSkyBackdrop(THREE, group, tCfg, 3.4);

  const wallMat = makeMat(THREE, pal.primary, { roughness: 0.86 });
  const concreteMat = makeMat(THREE, pal.secondary, { roughness: 0.88 });
  const concreteDarkMat = makeMat(THREE, pal.secondary, { roughness: 0.9 });
  concreteDarkMat.color.multiplyScalar(0.84);
  const woodMat = makeMat(THREE, pal.wood, { roughness: 0.58 });
  const pegMat = makeMat(THREE, pal.wood, { roughness: 0.72 });
  pegMat.color.multiplyScalar(0.88);
  const metalMat = makeMat(THREE, pal.metal, { roughness: 0.38, metalness: 0.75 });
  const tapeMat = makeMat(THREE, pal.accent, { roughness: 0.5 });
  const outlineMat = makeMat(THREE, pal.metal, { roughness: 0.75, metalness: 0.2 });
  const glassMat = makeMat(THREE, 0xdff2ff, {
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.28,
  });
  const lampMat = makeMat(THREE, tCfg.lampColor, {
    roughness: 0.25,
    emissive: tCfg.lampColor,
    emissiveIntensity: tCfg.lampIntensity,
  });

  // Base plinth & concrete floor with subtle expansion-joint lines
  addBasePlinth(THREE, group, concreteDarkMat, "secondary", 0.16);
  const quadGeo = makeRoundedBox(THREE, 1.985, 0.03, 1.985, 0.008, 1);
  const quads = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  for (let i = 0; i < quads.length; i++) {
    addMesh(THREE, group, quadGeo, concreteMat, [quads[i][0], -0.012, quads[i][1]], null, "secondary");
  }

  // Taped safety line marking the workbench & window work-zone
  const dashGeo = makeRoundedBox(THREE, 0.22, 0.006, 0.065, 0.002, 1);
  for (let dx = -1.0; dx <= 1.85; dx += 0.32) {
    addMesh(THREE, group, dashGeo, tapeMat, [dx, 0.004, -0.92], null, "accent", { castShadow: false });
  }
  const sideDashGeo = makeRoundedBox(THREE, 0.065, 0.006, 0.22, 0.002, 1);
  for (let dz = -0.68; dz <= 1.85; dz += 0.32) {
    addMesh(THREE, group, sideDashGeo, tapeMat, [-1.14, 0.004, dz], null, "accent", { castShadow: false });
  }
  addMesh(THREE, group, makeRoundedBox(THREE, 0.075, 0.006, 0.075, 0.002, 1), tapeMat, [-1.14, 0.004, -0.92], null, "accent", {
    castShadow: false,
  });

  // Back wall (z = -2, solid)
  addMesh(THREE, group, makeRoundedBox(THREE, 4.0, 2.7, 0.16, 0.014), wallMat, [0, 1.35, -2.08], null, "primary");

  // Long fixed workbench along back wall (x: -1.86..1.88, z: -2.0..-1.28, top y = 0.88)
  addMesh(THREE, group, makeRoundedBox(THREE, 3.74, 0.065, 0.72, 0.014), woodMat, [0.01, 0.848, -1.64], null, "wood");
  addMesh(THREE, group, makeRoundedBox(THREE, 3.74, 0.09, 0.03, 0.008), woodMat, [0.01, 0.91, -1.985], null, "wood");
  // Sturdy metal legs, crossbars & lower shelf
  const legGeo = makeRoundedBox(THREE, 0.06, 0.82, 0.06, 0.008);
  const legXs = [-1.78, -0.58, 0.62, 1.8];
  for (let i = 0; i < legXs.length; i++) {
    addMesh(THREE, group, legGeo, metalMat, [legXs[i], 0.41, -1.34], null, "metal");
    addMesh(THREE, group, legGeo, metalMat, [legXs[i], 0.41, -1.94], null, "metal");
  }
  addMesh(THREE, group, makeRoundedBox(THREE, 3.64, 0.036, 0.6, 0.008), metalMat, [0.01, 0.22, -1.64], null, "metal");
  // Fixed front bench vise on right edge
  addMesh(THREE, group, makeRoundedBox(THREE, 0.18, 0.11, 0.14, 0.012), metalMat, [1.56, 0.82, -1.24], null, "metal");
  addMesh(THREE, group, new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), tapeMat, [1.56, 0.81, -1.16], [0, 0, Math.PI / 2], "accent");

  // Pegboard wall panel above workbench (x: -1.72..1.76, y: 1.04..2.22)
  addMesh(THREE, group, makeRoundedBox(THREE, 3.52, 1.22, 0.045, 0.012), metalMat, [0.02, 1.63, -1.98], null, "metal");
  addMesh(THREE, group, makeRoundedBox(THREE, 3.42, 1.12, 0.03, 0.008), pegMat, [0.02, 1.63, -1.965], null, "wood", {
    toneScale: 0.88,
  });
  // Peg hole grid (clean spaced dots)
  const holeGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.01, 6);
  holeGeo.rotateX(Math.PI / 2);
  for (let hx = -1.55; hx <= 1.6; hx += 0.21) {
    for (let hy = 1.18; hy <= 2.1; hy += 0.21) {
      addMesh(THREE, group, holeGeo, outlineMat, [hx, hy, -1.948], null, "metal", { castShadow: false });
    }
  }

  // Painted/raised tool outlines on the pegboard
  // 1) Wrench silhouette (x = -1.22)
  addMesh(THREE, group, makeRoundedBox(THREE, 0.045, 0.34, 0.012, 0.004), outlineMat, [-1.22, 1.62, -1.944], [0, 0, 0.12], "metal");
  addMesh(THREE, group, new THREE.TorusGeometry(0.055, 0.018, 6, 12, Math.PI * 1.45), outlineMat, [-1.24, 1.8, -1.944], [0, 0, 0.7], "metal");
  // 2) Hammer silhouette (x = -0.68)
  addMesh(THREE, group, makeRoundedBox(THREE, 0.04, 0.38, 0.012, 0.004), outlineMat, [-0.68, 1.56, -1.944], null, "metal");
  addMesh(THREE, group, makeRoundedBox(THREE, 0.2, 0.065, 0.014, 0.005), outlineMat, [-0.68, 1.76, -1.944], null, "metal");
  // 3) Handsaw silhouette (x = 0.02)
  addMesh(THREE, group, makeRoundedBox(THREE, 0.56, 0.11, 0.012, 0.004), outlineMat, [0.06, 1.76, -1.944], [0, 0, -0.06], "metal");
  addMesh(THREE, group, makeRoundedBox(THREE, 0.13, 0.16, 0.014, 0.005), outlineMat, [-0.24, 1.78, -1.944], null, "metal");
  // 4) Two screwdrivers (x = 0.76, 0.94)
  for (let s = 0; s < 2; s++) {
    const sx = 0.74 + s * 0.18;
    addMesh(THREE, group, makeRoundedBox(THREE, 0.055, 0.14, 0.014, 0.005), outlineMat, [sx, 1.76, -1.944], null, "metal");
    addMesh(THREE, group, makeRoundedBox(THREE, 0.018, 0.24, 0.01, 0.003), outlineMat, [sx, 1.58, -1.944], null, "metal");
  }
  // 5) T-square / ruler outline (x = 1.38)
  addMesh(THREE, group, makeRoundedBox(THREE, 0.05, 0.44, 0.012, 0.004), outlineMat, [1.38, 1.62, -1.944], null, "metal");
  addMesh(THREE, group, makeRoundedBox(THREE, 0.28, 0.05, 0.012, 0.004), outlineMat, [1.38, 1.84, -1.944], null, "metal");

  // Upper shop shelf & industrial LED strip light
  addMesh(THREE, group, makeRoundedBox(THREE, 3.54, 0.04, 0.28, 0.008), woodMat, [0.02, 2.32, -1.86], null, "wood");
  addMesh(THREE, group, makeRoundedBox(THREE, 2.6, 0.045, 0.09, 0.008), metalMat, [0.02, 2.275, -1.84], null, "metal");
  addMesh(THREE, group, new THREE.BoxGeometry(2.45, 0.018, 0.055), lampMat, [0.02, 2.248, -1.84], null, null, {
    castShadow: false,
  });

  // Left wall (x = -2) with big roll-up window (z: -1.05..1.55, y: 0.85..2.35)
  addMesh(THREE, group, makeRoundedBox(THREE, 0.16, 2.7, 1.11, 0.014), wallMat, [-2.08, 1.35, -1.605], null, "primary");
  addMesh(THREE, group, makeRoundedBox(THREE, 0.16, 2.7, 0.45, 0.014), wallMat, [-2.08, 1.35, 1.775], null, "primary");
  addMesh(THREE, group, makeRoundedBox(THREE, 0.16, 0.85, 2.6, 0.014), wallMat, [-2.08, 0.425, 0.25], null, "primary");
  addMesh(THREE, group, makeRoundedBox(THREE, 0.16, 0.35, 2.6, 0.014), wallMat, [-2.08, 2.525, 0.25], null, "primary");

  // Roll-up window metal guide tracks, sill, shutter drum & partially open glazed slats
  addMesh(THREE, group, makeRoundedBox(THREE, 0.22, 0.05, 2.64, 0.01), metalMat, [-2.04, 0.86, 0.25], null, "metal");
  addMesh(THREE, group, makeRoundedBox(THREE, 0.08, 1.54, 0.06, 0.008), metalMat, [-1.99, 1.61, -1.05], null, "metal");
  addMesh(THREE, group, makeRoundedBox(THREE, 0.08, 1.54, 0.06, 0.008), metalMat, [-1.99, 1.61, 1.55], null, "metal");
  // Upper cylindrical roll-up housing drum
  addMesh(THREE, group, makeRoundedBox(THREE, 0.22, 0.24, 2.72, 0.025), metalMat, [-1.94, 2.42, 0.25], null, "metal");
  // Partially rolled-down upper glass-slat panel (top 0.42 m of window)
  addMesh(THREE, group, makeRoundedBox(THREE, 0.045, 0.045, 2.58, 0.008), metalMat, [-2.02, 1.96, 0.25], null, "metal");
  addMesh(THREE, group, new THREE.BoxGeometry(0.02, 0.36, 2.52), glassMat, [-2.02, 2.15, 0.25], null, null, {
    castShadow: false,
    receiveShadow: false,
  });
  for (let mz = -0.4; mz <= 0.9; mz += 0.65) {
    addMesh(THREE, group, makeRoundedBox(THREE, 0.036, 0.38, 0.036, 0.005), metalMat, [-2.02, 2.15, mz], null, "metal");
  }
  // Metal kickplate & conduit strip below window
  addMesh(THREE, group, makeRoundedBox(THREE, 0.02, 0.24, 2.7, 0.005), metalMat, [-1.99, 0.12, 0.25], null, "metal");
  addMesh(THREE, group, new THREE.CylinderGeometry(0.014, 0.014, 2.6, 8), tapeMat, [-1.98, 0.72, 0.25], [Math.PI / 2, 0, 0], "accent");

  return group;
}

// ============================================================================
// 5. ROOFTOP
// ============================================================================
function rooftop(THREE, opts = {}) {
  const group = new THREE.Group();
  group.name = "rooftop";
  const pal = resolvePalette(opts, {
    primary: 0xc27b63,
    secondary: 0xd6cfc4,
    wood: 0xb48052,
    accent: 0x4b5c73,
    metal: 0x383e45,
    fabric: 0xe3b261,
  });
  const tCfg = getTimeConfig(opts.time);
  addSkyBackdrop(THREE, group, tCfg, 3.5);

  const parapetMat = makeMat(THREE, pal.primary, { roughness: 0.88 });
  const copingMat = makeMat(THREE, pal.secondary, { roughness: 0.78 });
  const woodMat = makeMat(THREE, pal.wood, { roughness: 0.72 });
  const woodDarkMat = makeMat(THREE, pal.wood, { roughness: 0.78 });
  woodDarkMat.color.multiplyScalar(0.82);
  const metalMat = makeMat(THREE, pal.metal, { roughness: 0.38, metalness: 0.74 });
  const skylineMat = makeMat(THREE, pal.accent, { roughness: 0.92 });
  const skylineBackMat = makeMat(THREE, pal.accent, { roughness: 0.94 });
  skylineBackMat.color.multiplyScalar(0.76);
  const bulbMat = makeMat(THREE, tCfg.lampColor, {
    roughness: 0.25,
    emissive: tCfg.lampColor,
    emissiveIntensity: tCfg.lampIntensity,
  });
  const cityWinMat = makeMat(THREE, tCfg.windowGlow, {
    roughness: 0.4,
    emissive: tCfg.windowGlow,
    emissiveIntensity: tCfg.windowGlowIntensity,
  });

  // Base concrete slab & wooden decking planks
  addBasePlinth(THREE, group, copingMat, "secondary", 0.22);
  const deckCount = 16;
  const deckD = 4 / deckCount;
  const deckGeo = makeRoundedBox(THREE, 3.98, 0.032, deckD - 0.012, 0.007, 1);
  for (let i = 0; i < deckCount; i++) {
    const pz = -2 + deckD * (i + 0.5);
    const mat = i % 2 === 0 ? woodMat : woodDarkMat;
    addMesh(THREE, group, deckGeo, mat, [0, -0.01, pz], null, "wood", { toneScale: i % 2 === 0 ? 1.0 : 0.82 });
  }

  // Parapet walls (1.0 m high) on z = -2 and x = -2 with stone coping caps
  addMesh(THREE, group, makeRoundedBox(THREE, 4.22, 0.95, 0.22, 0.016), parapetMat, [-0.11, 0.475, -2.11], null, "primary");
  addMesh(THREE, group, makeRoundedBox(THREE, 0.22, 0.95, 4.0, 0.016), parapetMat, [-2.11, 0.475, 0], null, "primary");
  addMesh(THREE, group, makeRoundedBox(THREE, 4.28, 0.075, 0.28, 0.015), copingMat, [-0.11, 0.985, -2.11], null, "secondary");
  addMesh(THREE, group, makeRoundedBox(THREE, 0.28, 0.075, 4.06, 0.015), copingMat, [-2.11, 0.985, 0.02], null, "secondary");

  // Water tower in back-left corner (-1.38, -1.38)
  const tower = new THREE.Group();
  tower.position.set(-1.38, 0, -1.38);
  // 4 steel trestle legs
  const legGeo = new THREE.CylinderGeometry(0.028, 0.034, 1.18, 8);
  const legOffs = [
    [-0.36, -0.36, 0.1, -0.1],
    [0.36, -0.36, 0.1, 0.1],
    [-0.36, 0.36, -0.1, -0.1],
    [0.36, 0.36, -0.1, 0.1],
  ];
  for (let i = 0; i < legOffs.length; i++) {
    const [lx, lz, rx, rz] = legOffs[i];
    addMesh(THREE, tower, legGeo, metalMat, [lx, 0.58, lz], [rx, 0, rz], "metal");
  }
  // Cross braces
  const braceGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.78, 6);
  addMesh(THREE, tower, braceGeo, metalMat, [0, 0.56, 0.34], [0, 0, 0.78], "metal");
  addMesh(THREE, tower, braceGeo, metalMat, [0, 0.56, 0.34], [0, 0, -0.78], "metal");
  addMesh(THREE, tower, braceGeo, metalMat, [0.34, 0.56, 0], [0.78, 0, 0], "metal");
  addMesh(THREE, tower, braceGeo, metalMat, [0.34, 0.56, 0], [-0.78, 0, 0], "metal");
  // Platform deck, staved wooden barrel, metal hoops & conical roof
  addMesh(THREE, tower, new THREE.CylinderGeometry(0.54, 0.54, 0.055, 18), woodDarkMat, [0, 1.16, 0], null, "wood", {
    toneScale: 0.82,
  });
  addMesh(THREE, tower, new THREE.CylinderGeometry(0.45, 0.47, 0.9, 18), woodMat, [0, 1.63, 0], null, "wood");
  const hoopGeo = new THREE.TorusGeometry(0.468, 0.014, 8, 22);
  hoopGeo.rotateX(Math.PI / 2);
  for (let hy = 1.32; hy <= 1.94; hy += 0.3) {
    addMesh(THREE, tower, hoopGeo, metalMat, [0, hy, 0], null, "metal");
  }
  addMesh(THREE, tower, new THREE.ConeGeometry(0.54, 0.42, 18), metalMat, [0, 2.28, 0], null, "metal");
  addMesh(THREE, tower, new THREE.SphereGeometry(0.04, 10, 8), metalMat, [0, 2.5, 0], null, "metal");
  group.add(tower);

  // String-light poles & draped festoon lights
  const poleGeo = new THREE.CylinderGeometry(0.024, 0.028, 2.42, 10);
  const baseGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.04, 10);
  const poles = [
    [-1.88, 1.82],
    [1.86, -1.88],
    [1.86, 1.82],
  ];
  for (let i = 0; i < poles.length; i++) {
    const [px, pz] = poles[i];
    addMesh(THREE, group, poleGeo, metalMat, [px, 1.21, pz], null, "metal");
    addMesh(THREE, group, baseGeo, metalMat, [px, 0.02, pz], null, "metal");
  }

  // Catenary string lights between tower/poles
  const strands = [
    [[-1.0, 2.08, -1.0], [1.86, 2.38, -1.88], 9],
    [[-1.0, 2.08, -1.0], [-1.88, 2.38, 1.82], 9],
    [[1.86, 2.38, -1.88], [1.86, 2.38, 1.82], 10],
    [[-1.88, 2.38, 1.82], [1.86, 2.38, 1.82], 10],
  ];
  const bulbGeo = new THREE.SphereGeometry(0.036, 10, 8);
  const socketGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.03, 6);
  for (let s = 0; s < strands.length; s++) {
    const [a, b, count] = strands[s];
    for (let i = 1; i < count; i++) {
      const t = i / count;
      const sag = Math.sin(t * Math.PI) * 0.24;
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t - sag;
      const z = a[2] + (b[2] - a[2]) * t;
      addMesh(THREE, group, socketGeo, metalMat, [x, y + 0.03, z], null, "metal", { castShadow: false });
      addMesh(THREE, group, bulbGeo, bulbMat, [x, y, z], null, null, { castShadow: false });
    }
    // Cord segment approximation
    for (let i = 0; i < count; i++) {
      const t0 = i / count;
      const t1 = (i + 1) / count;
      const p0 = new THREE.Vector3(
        a[0] + (b[0] - a[0]) * t0,
        a[1] + (b[1] - a[1]) * t0 - Math.sin(t0 * Math.PI) * 0.24 + 0.04,
        a[2] + (b[2] - a[2]) * t0
      );
      const p1 = new THREE.Vector3(
        a[0] + (b[0] - a[0]) * t1,
        a[1] + (b[1] - a[1]) * t1 - Math.sin(t1 * Math.PI) * 0.24 + 0.04,
        a[2] + (b[2] - a[2]) * t1
      );
      const dir = new THREE.Vector3().subVectors(p1, p0);
      const len = dir.length();
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, len, 5), metalMat);
      seg.position.copy(p0).add(p1).multiplyScalar(0.5);
      seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      seg.userData.slot = "metal";
      group.add(seg);
    }
  }

  // City-skyline silhouette panels behind parapet (z = -2.45 and x = -2.45)
  const winGeo = new THREE.BoxGeometry(0.075, 0.1, 0.012);
  const backBuildings = [
    [-1.75, 0.72, 2.05, false],
    [-0.95, 0.68, 2.55, true],
    [-0.22, 0.76, 1.85, false],
    [0.52, 0.66, 2.38, true],
    [1.22, 0.74, 2.15, false],
    [1.82, 0.56, 1.65, true],
  ];
  for (let i = 0; i < backBuildings.length; i++) {
    const [bx, bw, bh, backLayer] = backBuildings[i];
    const bz = backLayer ? -2.54 : -2.4;
    addMesh(
      THREE,
      group,
      makeRoundedBox(THREE, bw, bh, 0.1, 0.01),
      backLayer ? skylineBackMat : skylineMat,
      [bx, bh * 0.5 - 0.1, bz],
      null,
      "accent",
      { castShadow: false, receiveShadow: false, toneScale: backLayer ? 0.76 : 1.0 }
    );
    if (tCfg.time !== "day") {
      for (let wy = 1.2; wy < bh - 0.25; wy += 0.28) {
        for (let wx = -bw * 0.28; wx <= bw * 0.29; wx += 0.2) {
          if ((Math.round((bx + wx + wy) * 10) % 3) !== 0) {
            addMesh(THREE, group, winGeo, cityWinMat, [bx + wx, wy, bz + 0.055], null, null, {
              castShadow: false,
              receiveShadow: false,
            });
          }
        }
      }
    }
  }

  const leftBuildings = [
    [-1.6, 0.68, 2.2, true],
    [-0.86, 0.74, 1.9, false],
    [-0.1, 0.68, 2.48, true],
    [0.64, 0.72, 2.05, false],
    [1.42, 0.74, 1.75, true],
  ];
  for (let i = 0; i < leftBuildings.length; i++) {
    const [bz, bw, bh, backLayer] = leftBuildings[i];
    const bx = backLayer ? -2.54 : -2.4;
    addMesh(
      THREE,
      group,
      makeRoundedBox(THREE, 0.1, bh, bw, 0.01),
      backLayer ? skylineBackMat : skylineMat,
      [bx, bh * 0.5 - 0.1, bz],
      null,
      "accent",
      { castShadow: false, receiveShadow: false, toneScale: backLayer ? 0.76 : 1.0 }
    );
    if (tCfg.time !== "day") {
      for (let wy = 1.2; wy < bh - 0.25; wy += 0.28) {
        for (let wz = -bw * 0.28; wz <= bw * 0.29; wz += 0.2) {
          if ((Math.round((bz + wz + wy) * 10) % 3) !== 0) {
            addMesh(THREE, group, winGeo, cityWinMat, [bx + 0.055, wy, bz + wz], [0, Math.PI / 2, 0], null, {
              castShadow: false,
              receiveShadow: false,
            });
          }
        }
      }
    }
  }

  return group;
}

// ============================================================================
// 6. GREENHOUSE
// ============================================================================
function greenhouse(THREE, opts = {}) {
  const group = new THREE.Group();
  group.name = "greenhouse";
  const pal = resolvePalette(opts, {
    primary: 0xd9c7b2,
    secondary: 0xede6da,
    wood: 0xb9885a,
    accent: 0x5c9658,
    metal: 0x354d42,
    fabric: 0xc97b5d,
  });
  const tCfg = getTimeConfig(opts.time);
  addSkyBackdrop(THREE, group, tCfg, 3.6);

  const kneeMat = makeMat(THREE, pal.primary, { roughness: 0.86 });
  const tileLightMat = makeMat(THREE, pal.secondary, { roughness: 0.62 });
  const tileTerraMat = makeMat(THREE, pal.fabric, { roughness: 0.68 });
  const woodMat = makeMat(THREE, pal.wood, { roughness: 0.72 });
  const frameMat = makeMat(THREE, pal.metal, { roughness: 0.36, metalness: 0.68 });
  const foliageMat = makeMat(THREE, pal.accent, { roughness: 0.84 });
  const soilMat = makeMat(THREE, 0x543f31, { roughness: 0.96 });
  const glassMat = makeMat(THREE, 0xe3f6ff, {
    roughness: 0.06,
    metalness: 0.1,
    transparent: true,
    opacity: 0.26,
  });
  const lampMat = makeMat(THREE, tCfg.lampColor, {
    roughness: 0.28,
    emissive: tCfg.lampColor,
    emissiveIntensity: tCfg.lampIntensity,
  });

  // Base plinth & tiled checkerboard floor (8x8 tiles of 0.5 m)
  addBasePlinth(THREE, group, kneeMat, "primary", 0.16);
  const tileGeo = makeRoundedBox(THREE, 0.486, 0.028, 0.486, 0.008, 1);
  for (let gx = 0; gx < 8; gx++) {
    for (let gz = 0; gz < 8; gz++) {
      const tx = -2 + (gx + 0.5) * 0.5;
      const tz = -2 + (gz + 0.5) * 0.5;
      const isTerra = (gx + gz) % 2 === 0;
      addMesh(THREE, group, tileGeo, isTerra ? tileTerraMat : tileLightMat, [tx, -0.011, tz], null, isTerra ? "fabric" : "secondary");
    }
  }

  // Low masonry knee walls (y = 0..0.48) with coping sill on z = -2 and x = -2
  addMesh(THREE, group, makeRoundedBox(THREE, 4.16, 0.46, 0.16, 0.014), kneeMat, [-0.08, 0.23, -2.08], null, "primary");
  addMesh(THREE, group, makeRoundedBox(THREE, 0.16, 0.46, 4.0, 0.014), kneeMat, [-2.08, 0.23, 0], null, "primary");
  addMesh(THREE, group, makeRoundedBox(THREE, 4.2, 0.045, 0.2, 0.01), tileLightMat, [-0.08, 0.48, -2.08], null, "secondary");
  addMesh(THREE, group, makeRoundedBox(THREE, 0.2, 0.045, 4.04, 0.01), tileLightMat, [-2.08, 0.48, 0.02], null, "secondary");

  // Glass walls (y = 0.5..2.22) made of slim metal mullions & transparent panes
  const wallH = 1.72;
  const mullionGeo = makeRoundedBox(THREE, 0.045, wallH, 0.045, 0.008);
  const backMullionXs = [-2.02, -1.22, -0.42, 0.38, 1.18, 1.98];
  for (let i = 0; i < backMullionXs.length; i++) {
    addMesh(THREE, group, mullionGeo, frameMat, [backMullionXs[i], 0.5 + wallH * 0.5, -2.02], null, "metal");
  }
  const leftMullionZs = [-1.22, -0.42, 0.38, 1.18, 1.98];
  for (let i = 0; i < leftMullionZs.length; i++) {
    addMesh(THREE, group, mullionGeo, frameMat, [-2.02, 0.5 + wallH * 0.5, leftMullionZs[i]], null, "metal");
  }
  // Eaves & mid-transom horizontal bars
  addMesh(THREE, group, makeRoundedBox(THREE, 4.08, 0.055, 0.055, 0.008), frameMat, [-0.02, 2.22, -2.02], null, "metal");
  addMesh(THREE, group, makeRoundedBox(THREE, 4.04, 0.032, 0.036, 0.006), frameMat, [-0.02, 1.38, -2.02], null, "metal");
  addMesh(THREE, group, makeRoundedBox(THREE, 0.055, 0.055, 4.08, 0.008), frameMat, [-2.02, 2.22, -0.02], null, "metal");
  addMesh(THREE, group, makeRoundedBox(THREE, 0.036, 0.032, 4.04, 0.006), frameMat, [-2.02, 1.38, -0.02], null, "metal");
  // Wall glass panes
  addMesh(THREE, group, new THREE.BoxGeometry(3.96, wallH - 0.04, 0.016), glassMat, [-0.02, 1.36, -2.02], null, null, {
    castShadow: false,
    receiveShadow: false,
  });
  addMesh(THREE, group, new THREE.BoxGeometry(0.016, wallH - 0.04, 3.96), glassMat, [-2.02, 1.36, -0.02], null, null, {
    castShadow: false,
    receiveShadow: false,
  });

  // Pitched glass roof (cutaway: full back slope z = -2.02 -> 0, plus partial front pitch z = 0 -> 0.55)
  const ridgeY = 2.94;
  const eaveY = 2.22;
  const backRun = 2.02;
  const rise = ridgeY - eaveY; // 0.72
  const pitchAngle = Math.atan2(rise, backRun); // ~0.342 rad
  const backRafterLen = Math.hypot(backRun, rise);

  // Ridge beam along X (z = 0, y = 2.94)
  addMesh(THREE, group, makeRoundedBox(THREE, 4.08, 0.06, 0.06, 0.008), frameMat, [-0.02, ridgeY, 0], null, "metal");
  // Back slope rafters & glass panes
  const rafterGeo = makeRoundedBox(THREE, 0.042, 0.048, backRafterLen + 0.04, 0.008);
  for (let i = 0; i < backMullionXs.length; i++) {
    addMesh(
      THREE,
      group,
      rafterGeo,
      frameMat,
      [backMullionXs[i], (eaveY + ridgeY) * 0.5, -backRun * 0.5],
      [-pitchAngle, 0, 0],
      "metal"
    );
  }
  addMesh(
    THREE,
    group,
    makeRoundedBox(THREE, 4.04, 0.03, 0.036, 0.006),
    frameMat,
    [-0.02, (eaveY + ridgeY) * 0.5, -backRun * 0.5],
    [-pitchAngle, 0, 0],
    "metal"
  );
  addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(3.96, 0.016, backRafterLen - 0.04),
    glassMat,
    [-0.02, (eaveY + ridgeY) * 0.5, -backRun * 0.5],
    [-pitchAngle, 0, 0],
    null,
    { castShadow: false, receiveShadow: false }
  );

  // Partial front roof pitch canopy (z = 0 -> 0.62) to complete the pitched silhouette while keeping front open
  const frontRun = 0.62;
  const frontLen = Math.hypot(frontRun, frontRun * Math.tan(pitchAngle));
  const frontDrop = frontRun * Math.tan(pitchAngle);
  const frontRafterGeo = makeRoundedBox(THREE, 0.042, 0.048, frontLen, 0.008);
  for (let i = 0; i < backMullionXs.length; i++) {
    addMesh(
      THREE,
      group,
      frontRafterGeo,
      frameMat,
      [backMullionXs[i], ridgeY - frontDrop * 0.5, frontRun * 0.5],
      [pitchAngle, 0, 0],
      "metal"
    );
  }
  addMesh(
    THREE,
    group,
    makeRoundedBox(THREE, 4.04, 0.038, 0.038, 0.006),
    frameMat,
    [-0.02, ridgeY - frontDrop, frontRun],
    [pitchAngle, 0, 0],
    "metal"
  );
  addMesh(
    THREE,
    group,
    new THREE.BoxGeometry(3.96, 0.016, frontLen - 0.04),
    glassMat,
    [-0.02, ridgeY - frontDrop * 0.5, frontRun * 0.5],
    [pitchAngle, 0, 0],
    null,
    { castShadow: false, receiveShadow: false }
  );

  // Glass gable triangle on left wall (x = -2.02)
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-2.02, 0);
  gableShape.lineTo(0, rise);
  gableShape.lineTo(frontRun, rise - frontDrop);
  gableShape.lineTo(frontRun, 0);
  gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 0.016, bevelEnabled: false });
  gableGeo.rotateY(-Math.PI / 2);
  addMesh(THREE, group, gableGeo, glassMat, [-2.012, eaveY, 0], null, null, {
    castShadow: false,
    receiveShadow: false,
  });
  // Gable vertical king post
  addMesh(THREE, group, makeRoundedBox(THREE, 0.045, rise, 0.045, 0.008), frameMat, [-2.02, eaveY + rise * 0.5, 0], null, "metal");

  // Raised wooden planting beds along both walls
  // Back bed (x: -1.25..1.85, z: -1.94..-1.26, height 0.62)
  addMesh(THREE, group, makeRoundedBox(THREE, 3.12, 0.58, 0.68, 0.016), woodMat, [0.3, 0.29, -1.6], null, "wood");
  addMesh(THREE, group, makeRoundedBox(THREE, 3.18, 0.055, 0.74, 0.014), woodMat, [0.3, 0.6, -1.6], null, "wood");
  addMesh(THREE, group, makeRoundedBox(THREE, 2.98, 0.04, 0.56, 0.01), soilMat, [0.3, 0.59, -1.6], null, null);
  // Left bed (x: -1.94..-1.26, z: -1.22..1.82, height 0.62)
  addMesh(THREE, group, makeRoundedBox(THREE, 0.68, 0.58, 3.04, 0.016), woodMat, [-1.6, 0.29, 0.3], null, "wood");
  addMesh(THREE, group, makeRoundedBox(THREE, 0.74, 0.055, 3.1, 0.014), woodMat, [-1.6, 0.6, 0.3], null, "wood");
  addMesh(THREE, group, makeRoundedBox(THREE, 0.56, 0.04, 2.9, 0.01), soilMat, [-1.6, 0.59, 0.3], null, null);

  // Small starter foliage sprouts at far ends of the planting beds
  const sproutGeo = new THREE.SphereGeometry(0.11, 10, 8);
  const sproutPos = [
    [-1.08, 0.67, -1.62, 0.9],
    [1.68, 0.67, -1.58, 1.05],
    [-1.6, 0.67, -1.04, 0.95],
    [-1.58, 0.67, 1.62, 1.0],
  ];
  for (let i = 0; i < sproutPos.length; i++) {
    const [sx, sy, sz, sc] = sproutPos[i];
    const m = addMesh(THREE, group, sproutGeo, foliageMat, [sx, sy, sz], null, "accent");
    m.scale.set(sc * 1.1, sc * 0.78, sc);
  }

  // Two hanging greenhouse pendant lamps from the ridge beam
  const cordGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.54, 6);
  const shadeGeo = new THREE.ConeGeometry(0.14, 0.11, 16, 1, true);
  const bulbGeo = new THREE.SphereGeometry(0.05, 10, 8);
  const lampXs = [-0.75, 0.85];
  for (let i = 0; i < lampXs.length; i++) {
    const lx = lampXs[i];
    addMesh(THREE, group, cordGeo, frameMat, [lx, 2.66, 0], null, "metal", { castShadow: false });
    addMesh(THREE, group, shadeGeo, frameMat, [lx, 2.38, 0], null, "metal");
    addMesh(THREE, group, bulbGeo, lampMat, [lx, 2.33, 0], null, null, { castShadow: false });
  }

  return group;
}

// ============================================================================
// EXPORTS: SPACES, SLOTS, CATALOG, recolor
// ============================================================================
export const SPACES = {
  loft,
  backyard,
  studyNook,
  makerLab,
  rooftop,
  greenhouse,
};

export const SLOTS = {
  loft: {
    mezzanineBed: { position: [-0.85, 1.4, -1.0], rotationY: 0, footprint: [1.6, 1.4], kind: "floor" },
    mezzanineDesk: { position: [0.55, 1.4, -1.25], rotationY: 0, footprint: [1.0, 0.7], kind: "floor" },
    underLoftLounge: { position: [-0.75, 0, -0.98], rotationY: 0, footprint: [1.6, 1.2], kind: "floor" },
    frontCenter: { position: [-0.15, 0, 1.05], rotationY: 0, footprint: [1.6, 1.3], kind: "floor" },
    frontRightCorner: { position: [1.25, 0, 1.25], rotationY: -Math.PI / 4, footprint: [1.0, 1.0], kind: "floor" },
    lowerLeftWall: { position: [-1.98, 0.85, 0.9], rotationY: Math.PI / 2, footprint: [1.2, 0.2], kind: "wall" },
    upperLeftWall: { position: [-1.98, 2.0, -0.9], rotationY: Math.PI / 2, footprint: [1.0, 0.2], kind: "wall" },
  },
  backyard: {
    patioCenter: { position: [0.85, 0, 0.85], rotationY: -Math.PI / 4, footprint: [1.4, 1.4], kind: "floor" },
    backRightLawn: { position: [1.1, 0, -0.95], rotationY: 0, footprint: [1.3, 1.3], kind: "floor" },
    pondSide: { position: [0.15, 0, 0.35], rotationY: 0, footprint: [0.9, 0.9], kind: "floor" },
    frontLeftCorner: { position: [-1.35, 0, 1.55], rotationY: Math.PI / 4, footprint: [0.8, 0.8], kind: "floor" },
    backFenceMount: { position: [0.8, 0.75, -1.96], rotationY: 0, footprint: [1.0, 0.15], kind: "wall" },
    leftFenceMount: { position: [-1.96, 0.75, 0.3], rotationY: Math.PI / 2, footprint: [1.0, 0.15], kind: "wall" },
    swingSeat: { position: [-0.46, 0.58, -1.14], rotationY: 0, footprint: [0.52, 0.22], kind: "surface" },
  },
  studyNook: {
    centerFloor: { position: [0.25, 0, 0.35], rotationY: 0, footprint: [1.8, 1.8], kind: "floor" },
    frontRightFloor: { position: [1.25, 0, 1.25], rotationY: -Math.PI / 4, footprint: [1.1, 1.1], kind: "floor" },
    frontLeftFloor: { position: [-0.95, 0, 1.25], rotationY: Math.PI / 4, footprint: [1.0, 1.0], kind: "floor" },
    bayWindowSeat: { position: [0, 0.55, -2.18], rotationY: 0, footprint: [1.4, 0.5], kind: "surface" },
    leftCredenzaLedge: { position: [-1.8, 0.74, 0.18], rotationY: Math.PI / 2, footprint: [1.8, 0.36], kind: "surface" },
    backRightShelf: { position: [1.48, 1.24, -1.83], rotationY: 0, footprint: [0.86, 0.3], kind: "surface" },
    backLeftShelf: { position: [-1.48, 1.24, -1.83], rotationY: 0, footprint: [0.86, 0.3], kind: "surface" },
  },
  makerLab: {
    workbenchLeft: { position: [-1.1, 0.88, -1.64], rotationY: 0, footprint: [1.1, 0.65], kind: "surface" },
    workbenchCenter: { position: [0.02, 0.88, -1.64], rotationY: 0, footprint: [1.1, 0.65], kind: "surface" },
    workbenchRight: { position: [1.15, 0.88, -1.64], rotationY: 0, footprint: [1.0, 0.65], kind: "surface" },
    shopFloorCenter: { position: [0.25, 0, 0.45], rotationY: 0, footprint: [1.8, 1.6], kind: "floor" },
    windowSideFloor: { position: [-1.25, 0, 0.55], rotationY: Math.PI / 2, footprint: [1.0, 1.4], kind: "floor" },
    frontRightFloor: { position: [1.3, 0, 1.3], rotationY: -Math.PI / 4, footprint: [1.1, 1.1], kind: "floor" },
    pegboardWall: { position: [0.02, 1.63, -1.94], rotationY: 0, footprint: [2.6, 0.12], kind: "wall" },
  },
  rooftop: {
    deckCenter: { position: [0.2, 0, 0.2], rotationY: 0, footprint: [1.8, 1.8], kind: "floor" },
    backRightLounge: { position: [1.05, 0, -1.05], rotationY: -Math.PI / 4, footprint: [1.3, 1.3], kind: "floor" },
    frontLeftDeck: { position: [-1.05, 0, 1.05], rotationY: Math.PI / 4, footprint: [1.2, 1.2], kind: "floor" },
    frontRightCorner: { position: [1.25, 0, 1.25], rotationY: -Math.PI / 4, footprint: [1.0, 1.0], kind: "floor" },
    backParapetLedge: { position: [0.7, 1.02, -2.11], rotationY: 0, footprint: [1.6, 0.26], kind: "surface" },
    leftParapetLedge: { position: [-2.11, 1.02, 0.4], rotationY: Math.PI / 2, footprint: [1.6, 0.26], kind: "surface" },
    waterTowerShade: { position: [-0.45, 0, -1.05], rotationY: 0, footprint: [0.9, 0.9], kind: "floor" },
  },
  greenhouse: {
    centerTileFloor: { position: [0.35, 0, 0.35], rotationY: 0, footprint: [1.8, 1.8], kind: "floor" },
    frontRightFloor: { position: [1.35, 0, 1.35], rotationY: -Math.PI / 4, footprint: [1.1, 1.1], kind: "floor" },
    frontLeftFloor: { position: [-0.55, 0, 1.35], rotationY: 0, footprint: [1.0, 1.0], kind: "floor" },
    backBedLeft: { position: [-0.35, 0.61, -1.6], rotationY: 0, footprint: [1.15, 0.56], kind: "surface" },
    backBedRight: { position: [0.95, 0.61, -1.6], rotationY: 0, footprint: [1.15, 0.56], kind: "surface" },
    leftBedBack: { position: [-1.6, 0.61, -0.3], rotationY: Math.PI / 2, footprint: [1.15, 0.56], kind: "surface" },
    leftBedFront: { position: [-1.6, 0.61, 0.95], rotationY: Math.PI / 2, footprint: [1.15, 0.56], kind: "surface" },
  },
};

export const CATALOG = [
  {
    id: "loft",
    name: "Skylight Loft",
    kind: "space",
    footprint: [4, 4],
    placement: "floor",
    variants: 3,
    note: "Two-level timber mezzanine with ladder, railing, and sloped attic skylight.",
  },
  {
    id: "backyard",
    name: "Garden Backyard",
    kind: "space",
    footprint: [4, 4],
    placement: "floor",
    variants: 3,
    note: "Fenced lawn with stepping stones, lily-pad pond, and a tree swing.",
  },
  {
    id: "studyNook",
    name: "Library Study Nook",
    kind: "space",
    footprint: [4, 4],
    placement: "floor",
    variants: 3,
    note: "Floor-to-ceiling built-in bookcases, cushioned bay window seat, and parquet floor.",
  },
  {
    id: "makerLab",
    name: "Maker Workshop",
    kind: "space",
    footprint: [4, 4],
    placement: "floor",
    variants: 3,
    note: "Fixed butcher-block workbench, tool-outline pegboard, safety-taped concrete, and roll-up window.",
  },
  {
    id: "rooftop",
    name: "City Rooftop Deck",
    kind: "space",
    footprint: [4, 4],
    placement: "floor",
    variants: 3,
    note: "Cedar decking, brick parapet, corner water tower, festoon lights, and city skyline.",
  },
  {
    id: "greenhouse",
    name: "Sunlit Greenhouse",
    kind: "space",
    footprint: [4, 4],
    placement: "floor",
    variants: 3,
    note: "Metal-framed glass walls and pitched roof, tiled floor, and raised planting beds.",
  },
];

export function recolor(group, palette) {
  if (!group || !palette) return;
  const map = {
    primary: palette.primary ?? palette.wall,
    secondary: palette.secondary ?? palette.trim,
    accent: palette.accent,
    wood: palette.wood ?? palette.floor,
    metal: palette.metal,
    fabric: palette.fabric,
    skin: palette.skin,
    fur: palette.fur,
    furAccent: palette.furAccent,
  };
  const updated = new Set();
  group.traverse((obj) => {
    if (!obj.isMesh) return;
    const slot = obj.userData && obj.userData.slot;
    if (!slot || map[slot] == null) return;
    const scale = obj.userData.toneScale ?? 1.0;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (let i = 0; i < mats.length; i++) {
      const m = mats[i];
      if (m && m.color && !updated.has(m)) {
        m.color.set(map[slot]);
        if (scale !== 1.0) m.color.multiplyScalar(scale);
        updated.add(m);
      }
    }
  });
}
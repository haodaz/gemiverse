// Cozy dorm room diorama companion animals (Three.js r160 ES module)

function makeMat(THREE, color, { roughness = 0.86, metalness = 0.02 } = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function addMesh(THREE, parent, geo, mat, opts = {}) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (opts.pos) mesh.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
  if (opts.rot) mesh.rotation.set(opts.rot[0], opts.rot[1], opts.rot[2]);
  if (opts.scale) {
    if (typeof opts.scale === "number") mesh.scale.setScalar(opts.scale);
    else mesh.scale.set(opts.scale[0], opts.scale[1], opts.scale[2]);
  }
  if (opts.name) mesh.name = opts.name;
  if (opts.slot) mesh.userData.slot = opts.slot;
  if (opts.isEye) mesh.userData.isEye = true;
  parent.add(mesh);
  return mesh;
}

function createBaseMats(THREE, defaults, opts = {}) {
  const furCol = opts.fur !== undefined ? opts.fur : defaults.fur;
  const accentCol = opts.furAccent !== undefined ? opts.furAccent : defaults.furAccent;
  const eyeCol = opts.eye !== undefined ? opts.eye : defaults.eye;
  return {
    fur: makeMat(THREE, furCol, { roughness: 0.9 }),
    furAccent: makeMat(THREE, accentCol, { roughness: 0.92 }),
    eye: makeMat(THREE, eyeCol, { roughness: 0.14, metalness: 0.08 }),
    highlight: makeMat(THREE, 0xffffff, { roughness: 0.08, metalness: 0.0 }),
    skin: makeMat(THREE, defaults.skin ?? 0xf0a6a6, { roughness: 0.78 }),
    primary: makeMat(THREE, defaults.primary ?? 0x3a2e2a, { roughness: 0.7 }),
    secondary: makeMat(THREE, defaults.secondary ?? 0x4a3b34, { roughness: 0.85 }),
    fabric: makeMat(THREE, defaults.fabric ?? 0xd65a6c, { roughness: 0.92 }),
    accent: makeMat(THREE, defaults.accent ?? 0xf4d36e, { roughness: 0.85 }),
    metal: makeMat(THREE, defaults.metal ?? 0xe8c45a, { roughness: 0.25, metalness: 0.82 }),
    wood: makeMat(THREE, defaults.wood ?? 0x7a9e52, { roughness: 0.82 })
  };
}

function addEyes(THREE, head, mats, { x = 0.036, y = 0.01, z = 0.078, r = 0.014, cheekY = -0.014, cheekOffset = 0.012 } = {}) {
  const eyeGeo = new THREE.SphereGeometry(r, 14, 12);
  const hlGeo = new THREE.SphereGeometry(r * 0.34, 8, 8);
  const cheekGeo = new THREE.SphereGeometry(r * 0.95, 10, 8);

  [-1, 1].forEach((side) => {
    const eg = new THREE.Group();
    eg.name = side < 0 ? "eyeL" : "eyeR";
    eg.userData.isEyeGroup = true;
    eg.position.set(side * x, y, z);
    head.add(eg);

    addMesh(THREE, eg, eyeGeo, mats.eye, { scale: [1, 1.06, 0.75], isEye: true });
    addMesh(THREE, eg, hlGeo, mats.highlight, {
      pos: [side * -r * 0.26, r * 0.34, r * 0.62],
      scale: [1, 1, 0.6]
    });

    addMesh(THREE, head, cheekGeo, mats.skin, {
      pos: [side * (x + cheekOffset), y + cheekY, z - 0.008],
      scale: [1.1, 0.55, 0.35],
      slot: "skin"
    });
  });
}

function addCuteMouth(THREE, head, mats, { y = -0.018, z = 0.088, noseR = 0.01, noseSlot = "skin", smile = true } = {}) {
  const noseMat = noseSlot === "primary" ? mats.primary : mats.skin;
  addMesh(THREE, head, new THREE.SphereGeometry(noseR, 12, 10), noseMat, {
    pos: [0, y + noseR * 0.7, z],
    scale: [1.2, 0.85, 0.85],
    slot: noseSlot
  });
  if (smile) {
    const arcGeo = new THREE.TorusGeometry(noseR * 0.85, noseR * 0.16, 6, 12, Math.PI);
    [-1, 1].forEach((side) => {
      addMesh(THREE, head, arcGeo, mats.primary, {
        pos: [side * noseR * 0.8, y - noseR * 0.15, z - noseR * 0.15],
        rot: [0, 0, Math.PI],
        slot: "primary"
      });
    });
  }
}

function makeRoundedEarGeo(THREE, w, h, depth) {
  const shape = new THREE.Shape();
  shape.moveTo(-w * 0.5, 0);
  shape.quadraticCurveTo(-w * 0.55, h * 0.65, 0, h);
  shape.quadraticCurveTo(w * 0.55, h * 0.65, w * 0.5, 0);
  shape.quadraticCurveTo(0, -h * 0.12, -w * 0.5, 0);
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.45,
    bevelSize: w * 0.14,
    bevelSegments: 4,
    curveSegments: 12
  });
}

function makeWingGeo(THREE, len, height, depth) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(len * 0.5, height * 0.45, len, -height * 0.15);
  shape.quadraticCurveTo(len * 0.72, -height * 0.85, 0, -height * 0.55);
  shape.quadraticCurveTo(-len * 0.12, -height * 0.25, 0, 0);
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.5,
    bevelSize: height * 0.12,
    bevelSegments: 3,
    curveSegments: 10
  });
}

function addAccessory(THREE, head, body, cfg, accessory, mats) {
  if (!accessory || accessory === "none") return;

  if (accessory === "bow") {
    const bow = new THREE.Group();
    bow.name = "accessory_bow";
    const bp = cfg.bowPos || [0.03, 0.08, 0.02];
    bow.position.set(bp[0], bp[1], bp[2]);
    bow.rotation.set(0.15, 0.2, -0.35);
    head.add(bow);

    const s = cfg.bowScale || 1;
    const loopGeo = new THREE.SphereGeometry(0.018 * s, 12, 10);
    addMesh(THREE, bow, loopGeo, mats.fabric, { pos: [-0.016 * s, 0, 0], scale: [1.25, 0.8, 0.55], slot: "fabric" });
    addMesh(THREE, bow, loopGeo, mats.fabric, { pos: [0.016 * s, 0, 0], scale: [1.25, 0.8, 0.55], slot: "fabric" });
    addMesh(THREE, bow, new THREE.SphereGeometry(0.009 * s, 10, 8), mats.accent, { pos: [0, 0, 0.004 * s], slot: "accent" });
    const tailGeo = new THREE.CapsuleGeometry(0.004 * s, 0.016 * s, 4, 8);
    addMesh(THREE, bow, tailGeo, mats.fabric, { pos: [-0.008 * s, -0.014 * s, 0], rot: [0, 0, 0.28], slot: "fabric" });
    addMesh(THREE, bow, tailGeo, mats.fabric, { pos: [0.008 * s, -0.014 * s, 0], rot: [0, 0, -0.28], slot: "fabric" });
  } else if (accessory === "scarf") {
    const scarf = new THREE.Group();
    scarf.name = "accessory_scarf";
    const np = cfg.neckPos || [0, 0.06, 0.04];
    const nr = cfg.neckR || 0.048;
    scarf.position.set(np[0], np[1], np[2]);
    if (cfg.neckRot) scarf.rotation.set(cfg.neckRot[0], cfg.neckRot[1], cfg.neckRot[2]);
    body.add(scarf);

    addMesh(THREE, scarf, new THREE.TorusGeometry(nr, nr * 0.28, 12, 24), mats.fabric, {
      rot: [Math.PI * 0.5, 0, 0],
      slot: "fabric"
    });
    const endGeo = new THREE.CapsuleGeometry(nr * 0.2, nr * 0.7, 6, 10);
    addMesh(THREE, scarf, endGeo, mats.fabric, {
      pos: [nr * 0.25, -nr * 0.55, nr * 0.95],
      rot: [0.22, 0, -0.18],
      scale: [1.1, 1, 0.5],
      slot: "fabric"
    });
    addMesh(THREE, scarf, new THREE.BoxGeometry(nr * 0.44, nr * 0.14, nr * 0.24), mats.accent, {
      pos: [nr * 0.29, -nr * 0.72, nr * 1.0],
      rot: [0.22, 0, -0.18],
      slot: "accent"
    });
    addMesh(THREE, scarf, endGeo, mats.fabric, {
      pos: [-nr * 0.18, -nr * 0.42, nr * 0.92],
      rot: [0.28, 0, 0.24],
      scale: [1.0, 0.75, 0.48],
      slot: "fabric"
    });
  } else if (accessory === "bell") {
    const collar = new THREE.Group();
    collar.name = "accessory_bell";
    const np = cfg.neckPos || [0, 0.06, 0.04];
    const nr = cfg.neckR || 0.048;
    collar.position.set(np[0], np[1], np[2]);
    if (cfg.neckRot) collar.rotation.set(cfg.neckRot[0], cfg.neckRot[1], cfg.neckRot[2]);
    body.add(collar);

    addMesh(THREE, collar, new THREE.TorusGeometry(nr, nr * 0.14, 10, 24), mats.fabric, {
      rot: [Math.PI * 0.5, 0, 0],
      slot: "fabric"
    });
    const bellR = Math.max(0.011, nr * 0.26);
    addMesh(THREE, collar, new THREE.SphereGeometry(bellR, 14, 12), mats.metal, {
      pos: [0, -bellR * 0.85, nr * 1.02],
      slot: "metal"
    });
    addMesh(THREE, collar, new THREE.TorusGeometry(bellR * 0.95, bellR * 0.12, 8, 16), mats.metal, {
      pos: [0, -bellR * 0.85, nr * 1.02],
      rot: [Math.PI * 0.5, 0, 0],
      slot: "metal"
    });
    addMesh(THREE, collar, new THREE.SphereGeometry(bellR * 0.25, 8, 8), mats.primary, {
      pos: [0, -bellR * 1.65, nr * 1.02],
      slot: "primary"
    });
  }
}

function finalizePet(THREE, group, petType, variant) {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  if (isFinite(box.min.y)) {
    const dy = -box.min.y;
    for (const child of group.children) {
      child.position.y += dy;
    }
  }
  group.userData.petType = petType;
  group.userData.variant = variant;
  group.userData.phase = 0;
  captureBase(group);
  return group;
}

function captureBase(group) {
  group.traverse((obj) => {
    if (
      obj.name === "head" ||
      obj.name === "body" ||
      obj.name === "tail" ||
      obj.name === "earL" ||
      obj.name === "earR" ||
      obj.name === "wingL" ||
      obj.name === "wingR" ||
      obj.userData.isEyeGroup
    ) {
      obj.userData.base = {
        px: obj.position.x,
        py: obj.position.y,
        pz: obj.position.z,
        rx: obj.rotation.x,
        ry: obj.rotation.y,
        rz: obj.rotation.z,
        sx: obj.scale.x,
        sy: obj.scale.y,
        sz: obj.scale.z
      };
    }
  });
}

function addQuadrupedLegs(THREE, body, mats, {
  r = 0.022,
  len = 0.045,
  xSpread = 0.042,
  zFront = 0.048,
  zBack = -0.052,
  yOffset = -0.04,
  variant = 0,
  sockSlot = "furAccent",
  sockMat = null
} = {}) {
  const legGeo = new THREE.CapsuleGeometry(r, len, 6, 10);
  const pawGeo = new THREE.SphereGeometry(r * 1.12, 10, 8);
  const sMat = sockMat || mats.furAccent;

  [-1, 1].forEach((side) => {
    if (variant === 0) {
      // Standing
      addMesh(THREE, body, legGeo, mats.fur, { pos: [side * xSpread, yOffset, zFront], slot: "fur" });
      addMesh(THREE, body, pawGeo, sMat, { pos: [side * xSpread, yOffset - len * 0.55, zFront + r * 0.25], scale: [1, 0.72, 1.2], slot: sockSlot });
      addMesh(THREE, body, legGeo, mats.fur, { pos: [side * xSpread, yOffset, zBack], slot: "fur" });
      addMesh(THREE, body, pawGeo, sMat, { pos: [side * xSpread, yOffset - len * 0.55, zBack + r * 0.25], scale: [1, 0.72, 1.2], slot: sockSlot });
    } else if (variant === 1) {
      // Sitting: front legs straight down-forward, hind legs tucked
      addMesh(THREE, body, legGeo, mats.fur, { pos: [side * xSpread * 0.72, yOffset - 0.004, zFront + 0.01], rot: [-0.2, 0, 0], slot: "fur" });
      addMesh(THREE, body, pawGeo, sMat, { pos: [side * xSpread * 0.72, yOffset - len * 0.62, zFront + 0.02], scale: [1, 0.7, 1.2], slot: sockSlot });
      addMesh(THREE, body, legGeo, mats.fur, { pos: [side * xSpread * 1.15, yOffset - 0.015, zBack + 0.025], rot: [1.35, side * 0.25, 0], slot: "fur" });
      addMesh(THREE, body, pawGeo, sMat, { pos: [side * xSpread * 1.22, yOffset - 0.022, zBack + 0.055], scale: [1, 0.72, 1.2], slot: sockSlot });
    } else {
      // Curled / lying
      addMesh(THREE, body, legGeo, mats.fur, { pos: [side * xSpread * 0.85, yOffset + 0.012, zFront + 0.02], rot: [1.45, side * -0.18, 0], slot: "fur" });
      addMesh(THREE, body, pawGeo, sMat, { pos: [side * xSpread * 0.78, yOffset + 0.01, zFront + 0.05], scale: [1, 0.65, 1.2], slot: sockSlot });
      addMesh(THREE, body, legGeo, mats.fur, { pos: [side * xSpread * 1.1, yOffset + 0.014, zBack + 0.01], rot: [1.5, side * 0.3, 0], slot: "fur" });
    }
  });
}

// 1. CAT
function cat(THREE, opts = {}) {
  const variant = opts.variant ?? 0;
  const mats = createBaseMats(THREE, {
    fur: 0xe69c5c,
    furAccent: 0xfbf2e3,
    eye: 0x2a4530,
    skin: 0xf2a7b0,
    primary: 0x3b2c26,
    secondary: 0xb86d35,
    fabric: 0xd95b6a
  }, opts);

  const group = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";
  group.add(body, head, tail);

  // Body
  const bodyGeo = new THREE.SphereGeometry(0.072, 18, 16);
  addMesh(THREE, body, bodyGeo, mats.fur, { scale: [0.95, 0.88, 1.22], slot: "fur" });
  addMesh(THREE, body, new THREE.SphereGeometry(0.056, 16, 14), mats.furAccent, {
    pos: [0, -0.018, 0.026],
    scale: [0.88, 0.76, 0.95],
    slot: "furAccent"
  });

  // Back tabby stripes
  for (let i = -1; i <= 1; i++) {
    addMesh(THREE, body, new THREE.TorusGeometry(0.062, 0.008, 8, 18, Math.PI * 0.85), mats.secondary, {
      pos: [0, 0.005, i * 0.028 - 0.006],
      rot: [0, 0, Math.PI * 0.075],
      scale: [1, 0.96, 1],
      slot: "secondary"
    });
  }

  addQuadrupedLegs(THREE, body, mats, { r: 0.02, len: 0.044, xSpread: 0.038, zFront: 0.046, zBack: -0.048, yOffset: -0.042, variant });

  // Head
  addMesh(THREE, head, new THREE.SphereGeometry(0.088, 20, 18), mats.fur, { scale: [1.08, 0.96, 0.98], slot: "fur" });
  addMesh(THREE, head, new THREE.SphereGeometry(0.042, 14, 12), mats.furAccent, {
    pos: [0, -0.022, 0.064],
    scale: [1.22, 0.72, 0.72],
    slot: "furAccent"
  });
  // Forehead tabby marks
  for (let i = -1; i <= 1; i++) {
    addMesh(THREE, head, new THREE.CapsuleGeometry(0.005, 0.018, 4, 8), mats.secondary, {
      pos: [i * 0.016, 0.052, 0.065],
      rot: [0.55, 0, i * -0.14],
      slot: "secondary"
    });
  }
  addEyes(THREE, head, mats, { x: 0.036, y: 0.008, z: 0.078, r: 0.014 });
  addCuteMouth(THREE, head, mats, { y: -0.016, z: 0.092, noseR: 0.0085, noseSlot: "skin" });

  // Whiskers
  const whiskGeo = new THREE.CylinderGeometry(0.0014, 0.001, 0.044, 6);
  [-1, 1].forEach((side) => {
    [-0.12, 0.12].forEach((ang, idx) => {
      addMesh(THREE, head, whiskGeo, mats.primary, {
        pos: [side * 0.062, -0.014 - idx * 0.009, 0.066],
        rot: [0, side * -0.2, Math.PI * 0.5 + side * ang],
        slot: "primary"
      });
    });
  });

  // Ears
  const earGeo = makeRoundedEarGeo(THREE, 0.048, 0.062, 0.014);
  const innerEarGeo = makeRoundedEarGeo(THREE, 0.028, 0.038, 0.008);
  [-1, 1].forEach((side) => {
    const ear = new THREE.Group();
    ear.name = side < 0 ? "earL" : "earR";
    ear.position.set(side * 0.055, 0.062, 0.006);
    ear.rotation.set(0.08, side * -0.16, side * -0.26);
    head.add(ear);
    addMesh(THREE, ear, earGeo, mats.fur, { pos: [0, 0, -0.007], slot: "fur" });
    addMesh(THREE, ear, innerEarGeo, mats.skin, { pos: [0, 0.006, 0.003], slot: "skin" });
  });

  // Curved tail
  const tailPts = variant === 2
    ? [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.055, 0.005, -0.02),
        new THREE.Vector3(0.095, 0.008, 0.045),
        new THREE.Vector3(0.062, 0.012, 0.115)
      ]
    : [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0.035, -0.055),
        new THREE.Vector3(0.012, 0.095, -0.075),
        new THREE.Vector3(0.028, 0.125, -0.042)
      ];
  const tailCurve = new THREE.CatmullRomCurve3(tailPts);
  addMesh(THREE, tail, new THREE.TubeGeometry(tailCurve, 18, 0.015, 10, false), mats.fur, { slot: "fur" });
  const tipPos = tailPts[tailPts.length - 1];
  addMesh(THREE, tail, new THREE.SphereGeometry(0.016, 10, 10), mats.furAccent, { pos: [tipPos.x, tipPos.y, tipPos.z], slot: "furAccent" });

  // Pose arrangement
  if (variant === 0) {
    body.position.set(0, 0.1, 0);
    head.position.set(0, 0.21, 0.075);
    tail.position.set(0, 0.125, -0.078);
  } else if (variant === 1) {
    body.position.set(0, 0.11, -0.01);
    body.rotation.x = -0.35;
    head.position.set(0, 0.23, 0.045);
    tail.position.set(0, 0.075, -0.072);
    tail.rotation.y = 0.55;
  } else {
    body.position.set(0, 0.072, 0);
    body.scale.set(1.06, 0.88, 1.0);
    head.position.set(0.012, 0.145, 0.078);
    head.rotation.set(0.14, -0.2, 0.12);
    tail.position.set(0.02, 0.04, -0.068);
  }

  addAccessory(THREE, head, body, {
    bowPos: [0.032, 0.088, 0.025],
    neckPos: [0, 0.045, 0.058],
    neckR: 0.052,
    neckRot: [0.35, 0, 0]
  }, opts.accessory, mats);

  return finalizePet(THREE, group, "cat", variant);
}

// 2. DOG
function dog(THREE, opts = {}) {
  const variant = opts.variant ?? 0;
  const mats = createBaseMats(THREE, {
    fur: 0xd9924c,
    furAccent: 0xfaf0df,
    eye: 0x261d18,
    skin: 0xf08c96,
    primary: 0x2b201c,
    secondary: 0xb06b2e,
    fabric: 0x4b87c8
  }, opts);

  const group = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";
  group.add(body, head, tail);

  // Body
  addMesh(THREE, body, new THREE.SphereGeometry(0.078, 18, 16), mats.fur, { scale: [0.98, 0.92, 1.24], slot: "fur" });
  addMesh(THREE, body, new THREE.SphereGeometry(0.062, 16, 14), mats.furAccent, {
    pos: [0, -0.016, 0.034],
    scale: [0.9, 0.8, 0.95],
    slot: "furAccent"
  });
  addQuadrupedLegs(THREE, body, mats, { r: 0.022, len: 0.048, xSpread: 0.042, zFront: 0.052, zBack: -0.052, yOffset: -0.045, variant });

  // Head + prominent puppy snout
  addMesh(THREE, head, new THREE.SphereGeometry(0.092, 20, 18), mats.fur, { scale: [1.04, 0.98, 0.98], slot: "fur" });
  addMesh(THREE, head, new THREE.SphereGeometry(0.046, 16, 14), mats.furAccent, {
    pos: [0, -0.02, 0.076],
    scale: [1.14, 0.82, 0.95],
    slot: "furAccent"
  });
  // Eyebrow dots
  [-1, 1].forEach((side) => {
    addMesh(THREE, head, new THREE.SphereGeometry(0.012, 10, 8), mats.furAccent, {
      pos: [side * 0.03, 0.038, 0.08],
      scale: [1.1, 0.75, 0.5],
      slot: "furAccent"
    });
  });

  addEyes(THREE, head, mats, { x: 0.038, y: 0.012, z: 0.08, r: 0.0145 });
  addCuteMouth(THREE, head, mats, { y: -0.012, z: 0.114, noseR: 0.012, noseSlot: "primary" });

  // Happy little tongue in standing/sitting
  if (variant !== 2) {
    addMesh(THREE, head, new THREE.CapsuleGeometry(0.008, 0.012, 6, 8), mats.skin, {
      pos: [0, -0.032, 0.106],
      rot: [0.35, 0, 0],
      scale: [1.1, 1, 0.45],
      slot: "skin"
    });
  }

  // Floppy rounded ears
  const earGeo = new THREE.CapsuleGeometry(0.024, 0.048, 8, 12);
  [-1, 1].forEach((side) => {
    const ear = new THREE.Group();
    ear.name = side < 0 ? "earL" : "earR";
    ear.position.set(side * 0.078, 0.048, 0.002);
    ear.rotation.set(0.15, side * 0.15, side * 0.34);
    head.add(ear);
    addMesh(THREE, ear, earGeo, mats.secondary, { pos: [side * 0.008, -0.024, 0], scale: [1.0, 1.0, 0.55], slot: "secondary" });
  });

  // Curled fluffy tail
  const tCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.036, -0.042),
    new THREE.Vector3(0, 0.072, -0.018),
    new THREE.Vector3(0, 0.062, 0.018)
  ]);
  addMesh(THREE, tail, new THREE.TubeGeometry(tCurve, 16, 0.02, 10, false), mats.fur, { slot: "fur" });
  addMesh(THREE, tail, new THREE.SphereGeometry(0.022, 10, 10), mats.furAccent, { pos: [0, 0.062, 0.018], slot: "furAccent" });

  if (variant === 0) {
    body.position.set(0, 0.11, 0);
    head.position.set(0, 0.225, 0.078);
    tail.position.set(0, 0.145, -0.082);
  } else if (variant === 1) {
    body.position.set(0, 0.115, -0.01);
    body.rotation.x = -0.38;
    head.position.set(0, 0.242, 0.046);
    tail.position.set(0, 0.085, -0.082);
  } else {
    body.position.set(0, 0.076, 0);
    body.scale.set(1.06, 0.85, 1.04);
    head.position.set(0, 0.15, 0.088);
    head.rotation.set(0.12, 0.14, -0.08);
    tail.position.set(0, 0.1, -0.088);
    tail.rotation.x = -0.35;
  }

  addAccessory(THREE, head, body, {
    bowPos: [0.028, 0.092, 0.024],
    neckPos: [0, 0.048, 0.06],
    neckR: 0.056,
    neckRot: [0.35, 0, 0]
  }, opts.accessory, mats);

  return finalizePet(THREE, group, "dog", variant);
}

// 3. RABBIT
function rabbit(THREE, opts = {}) {
  const variant = opts.variant ?? 0;
  const mats = createBaseMats(THREE, {
    fur: 0xf0e4d7,
    furAccent: 0xffffff,
    eye: 0x3b2824,
    skin: 0xf4b2bc,
    primary: 0x4a3832,
    fabric: 0xe6849e
  }, opts);

  const group = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";
  group.add(body, head, tail);

  // Plump pear body
  addMesh(THREE, body, new THREE.SphereGeometry(0.076, 18, 16), mats.fur, { scale: [1.02, 0.96, 1.16], slot: "fur" });
  addMesh(THREE, body, new THREE.SphereGeometry(0.058, 16, 14), mats.furAccent, {
    pos: [0, -0.012, 0.028],
    scale: [0.92, 0.86, 0.95],
    slot: "furAccent"
  });
  addQuadrupedLegs(THREE, body, mats, { r: 0.02, len: 0.036, xSpread: 0.04, zFront: 0.044, zBack: -0.04, yOffset: -0.046, variant });

  // Chubby cheeked head
  addMesh(THREE, head, new THREE.SphereGeometry(0.082, 20, 18), mats.fur, { scale: [1.08, 0.96, 1.0], slot: "fur" });
  [-1, 1].forEach((side) => {
    addMesh(THREE, head, new THREE.SphereGeometry(0.036, 12, 10), mats.fur, {
      pos: [side * 0.046, -0.022, 0.042],
      scale: [1.1, 0.9, 0.85],
      slot: "fur"
    });
  });
  addEyes(THREE, head, mats, { x: 0.036, y: 0.008, z: 0.074, r: 0.014 });
  addCuteMouth(THREE, head, mats, { y: -0.014, z: 0.088, noseR: 0.009, noseSlot: "skin" });

  // Tall velvety bunny ears
  const earGeo = new THREE.CapsuleGeometry(0.02, 0.095, 8, 14);
  const innerGeo = new THREE.CapsuleGeometry(0.012, 0.072, 6, 10);
  [-1, 1].forEach((side) => {
    const ear = new THREE.Group();
    ear.name = side < 0 ? "earL" : "earR";
    ear.position.set(side * 0.034, 0.068, -0.005);
    const droop = variant === 2 ? -0.45 : side > 0 ? -0.18 : 0.08;
    ear.rotation.set(variant === 2 ? -0.55 : -0.1, side * -0.15, droop);
    head.add(ear);
    addMesh(THREE, ear, earGeo, mats.fur, { pos: [0, 0.052, 0], scale: [1.0, 1.0, 0.55], slot: "fur" });
    addMesh(THREE, ear, innerGeo, mats.skin, { pos: [0, 0.05, 0.007], scale: [1.0, 1.0, 0.4], slot: "skin" });
  });

  // Fluffy cotton-ball tail
  const puffGeo = new THREE.SphereGeometry(0.028, 12, 10);
  addMesh(THREE, tail, puffGeo, mats.furAccent, { slot: "furAccent" });
  addMesh(THREE, tail, new THREE.SphereGeometry(0.018, 10, 8), mats.furAccent, { pos: [0.014, 0.01, -0.006], slot: "furAccent" });
  addMesh(THREE, tail, new THREE.SphereGeometry(0.018, 10, 8), mats.furAccent, { pos: [-0.014, 0.008, -0.008], slot: "furAccent" });

  if (variant === 0) {
    body.position.set(0, 0.095, 0);
    head.position.set(0, 0.195, 0.065);
    tail.position.set(0, 0.102, -0.092);
  } else if (variant === 1) {
    body.position.set(0, 0.105, -0.005);
    body.rotation.x = -0.48;
    head.position.set(0, 0.218, 0.032);
    tail.position.set(0, 0.068, -0.084);
  } else {
    body.position.set(0, 0.072, 0);
    body.scale.set(1.12, 0.85, 1.06);
    head.position.set(0, 0.145, 0.072);
    tail.position.set(0, 0.075, -0.096);
  }

  addAccessory(THREE, head, body, {
    bowPos: [0.016, 0.082, 0.036],
    neckPos: [0, 0.044, 0.052],
    neckR: 0.052,
    neckRot: [0.35, 0, 0]
  }, opts.accessory, mats);

  return finalizePet(THREE, group, "rabbit", variant);
}

// 4. HAMSTER
function hamster(THREE, opts = {}) {
  const variant = opts.variant ?? 0;
  const mats = createBaseMats(THREE, {
    fur: 0xe2a868,
    furAccent: 0xfdf7ee,
    eye: 0x1e1a18,
    skin: 0xf3a8b0,
    primary: 0x3b2f2a,
    secondary: 0x524942,
    fabric: 0x76b87c
  }, opts);

  const group = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";
  group.add(body, head, tail);

  // Chubby round body
  addMesh(THREE, body, new THREE.SphereGeometry(0.072, 18, 16), mats.fur, { scale: [1.06, 0.96, 1.08], slot: "fur" });
  addMesh(THREE, body, new THREE.SphereGeometry(0.062, 16, 14), mats.furAccent, {
    pos: [0, -0.012, 0.025],
    scale: [0.96, 0.86, 0.95],
    slot: "furAccent"
  });

  // Tiny stubby paws
  const pawGeo = new THREE.SphereGeometry(0.015, 10, 8);
  [-1, 1].forEach((side) => {
    if (variant === 1) {
      // Sitting upright holding a sunflower seed
      addMesh(THREE, body, pawGeo, mats.skin, { pos: [side * 0.022, 0.015, 0.068], scale: [1, 0.8, 1.1], slot: "skin" });
      addMesh(THREE, body, pawGeo, mats.skin, { pos: [side * 0.042, -0.056, 0.036], scale: [1.1, 0.6, 1.35], slot: "skin" });
    } else {
      addMesh(THREE, body, pawGeo, mats.skin, { pos: [side * 0.042, -0.056, 0.042], scale: [1.0, 0.65, 1.25], slot: "skin" });
      addMesh(THREE, body, pawGeo, mats.skin, { pos: [side * 0.045, -0.056, -0.036], scale: [1.0, 0.65, 1.25], slot: "skin" });
    }
  });
  if (variant === 1) {
    // Tiny sunflower seed
    addMesh(THREE, body, new THREE.SphereGeometry(0.014, 10, 8), mats.secondary, {
      pos: [0, 0.016, 0.078],
      scale: [0.65, 1.35, 0.45],
      slot: "secondary"
    });
  }

  // Big puffy-cheeked head
  addMesh(THREE, head, new THREE.SphereGeometry(0.072, 18, 16), mats.fur, { scale: [1.1, 0.96, 0.98], slot: "fur" });
  [-1, 1].forEach((side) => {
    addMesh(THREE, head, new THREE.SphereGeometry(0.04, 14, 12), mats.furAccent, {
      pos: [side * 0.048, -0.018, 0.032],
      scale: [1.05, 0.92, 0.92],
      slot: "furAccent"
    });
  });
  addEyes(THREE, head, mats, { x: 0.032, y: 0.01, z: 0.064, r: 0.013, cheekOffset: 0.016 });
  addCuteMouth(THREE, head, mats, { y: -0.012, z: 0.076, noseR: 0.008, noseSlot: "skin" });

  // Small round cup ears
  const earGeo = new THREE.SphereGeometry(0.022, 12, 10);
  [-1, 1].forEach((side) => {
    const ear = new THREE.Group();
    ear.name = side < 0 ? "earL" : "earR";
    ear.position.set(side * 0.056, 0.052, 0.004);
    ear.rotation.set(0.1, side * -0.2, side * -0.35);
    head.add(ear);
    addMesh(THREE, ear, earGeo, mats.fur, { scale: [1.0, 1.0, 0.48], slot: "fur" });
    addMesh(THREE, ear, new THREE.SphereGeometry(0.014, 10, 8), mats.skin, { pos: [0, 0, 0.006], scale: [1.0, 1.0, 0.35], slot: "skin" });
  });

  // Tiny nubbin tail
  addMesh(THREE, tail, new THREE.SphereGeometry(0.014, 10, 8), mats.furAccent, { slot: "furAccent" });

  if (variant === 0) {
    body.position.set(0, 0.072, 0);
    head.position.set(0, 0.142, 0.048);
    tail.position.set(0, 0.068, -0.08);
  } else if (variant === 1) {
    body.position.set(0, 0.078, 0);
    body.scale.set(1.0, 1.08, 0.98);
    head.position.set(0, 0.168, 0.018);
    tail.position.set(0, 0.048, -0.072);
  } else {
    body.position.set(0, 0.065, 0);
    body.scale.set(1.12, 0.86, 1.08);
    head.position.set(0.01, 0.118, 0.045);
    head.rotation.set(0.18, -0.25, 0.12);
    tail.position.set(0, 0.056, -0.082);
  }

  addAccessory(THREE, head, body, {
    bowPos: [0.025, 0.07, 0.024],
    bowScale: 0.85,
    neckPos: [0, 0.04, 0.036],
    neckR: 0.054,
    neckRot: [0.3, 0, 0]
  }, opts.accessory, mats);

  return finalizePet(THREE, group, "hamster", variant);
}

// 5. BIRD
function bird(THREE, opts = {}) {
  const variant = opts.variant ?? 0;
  const mats = createBaseMats(THREE, {
    fur: 0x6ea8d6,
    furAccent: 0xf7f2e4,
    eye: 0x1d1c21,
    skin: 0xf29ca6,
    primary: 0xf0a63b,
    secondary: 0x4c82b0,
    fabric: 0xe66a6a
  }, opts);

  const group = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";
  group.add(body, head, tail);

  // Plump teardrop body
  addMesh(THREE, body, new THREE.SphereGeometry(0.07, 18, 16), mats.fur, { scale: [0.96, 0.94, 1.18], slot: "fur" });
  addMesh(THREE, body, new THREE.SphereGeometry(0.058, 16, 14), mats.furAccent, {
    pos: [0, -0.012, 0.026],
    scale: [0.88, 0.84, 0.95],
    slot: "furAccent"
  });

  // Folded wings
  const wingGeo = makeWingGeo(THREE, 0.082, 0.058, 0.012);
  [-1, 1].forEach((side) => {
    const wing = new THREE.Group();
    wing.name = side < 0 ? "wingL" : "wingR";
    wing.position.set(side * 0.062, 0.015, 0.018);
    wing.rotation.set(0.15, side * -Math.PI * 0.45, side * -0.1);
    body.add(wing);
    addMesh(THREE, wing, wingGeo, mats.secondary, { pos: [0, 0, -0.006], slot: "secondary" });
  });

  // Delicate feet
  const legGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.036, 8);
  const toeGeo = new THREE.CapsuleGeometry(0.0035, 0.018, 4, 6);
  const footY = variant === 0 ? -0.072 : -0.052;
  [-1, 1].forEach((side) => {
    if (variant === 0) {
      addMesh(THREE, body, legGeo, mats.primary, { pos: [side * 0.024, -0.058, 0.005], slot: "primary" });
    }
    [-0.35, 0, 0.35].forEach((ang) => {
      addMesh(THREE, body, toeGeo, mats.primary, {
        pos: [side * 0.024 + Math.sin(ang) * 0.01, footY, 0.018 + Math.cos(ang) * 0.008],
        rot: [Math.PI * 0.5, 0, -ang],
        slot: "primary"
      });
    });
  });

  // Big round head + cute crest tuft + curved beak
  addMesh(THREE, head, new THREE.SphereGeometry(0.068, 18, 16), mats.fur, { scale: [1.02, 0.98, 1.0], slot: "fur" });
  // Head tuft
  addMesh(THREE, head, new THREE.CapsuleGeometry(0.008, 0.022, 6, 8), mats.secondary, {
    pos: [0, 0.072, 0.005],
    rot: [-0.35, 0, 0.08],
    slot: "secondary"
  });
  addMesh(THREE, head, new THREE.CapsuleGeometry(0.006, 0.016, 6, 8), mats.fur, {
    pos: [0.008, 0.068, -0.006],
    rot: [-0.55, 0, -0.15],
    slot: "fur"
  });

  addEyes(THREE, head, mats, { x: 0.034, y: 0.01, z: 0.056, r: 0.0125, cheekY: -0.012, cheekOffset: 0.008 });

  // Beak
  addMesh(THREE, head, new THREE.ConeGeometry(0.014, 0.032, 12), mats.primary, {
    pos: [0, -0.004, 0.074],
    rot: [Math.PI * 0.52, 0, 0],
    scale: [1.0, 1.0, 0.78],
    slot: "primary"
  });
  addMesh(THREE, head, new THREE.ConeGeometry(0.01, 0.02, 10), mats.primary, {
    pos: [0, -0.012, 0.068],
    rot: [Math.PI * 0.58, 0, 0],
    scale: [0.95, 1.0, 0.65],
    slot: "primary"
  });

  // Fan tail feathers
  const featGeo = new THREE.CapsuleGeometry(0.012, 0.052, 6, 8);
  [-0.22, 0, 0.22].forEach((ang) => {
    addMesh(THREE, tail, featGeo, mats.secondary, {
      pos: [Math.sin(ang) * 0.022, 0.006, -0.028],
      rot: [1.32, ang, 0],
      scale: [1.0, 1.0, 0.35],
      slot: "secondary"
    });
  });

  if (variant === 0) {
    body.position.set(0, 0.092, 0);
    head.position.set(0, 0.172, 0.034);
    tail.position.set(0, 0.095, -0.074);
  } else if (variant === 1) {
    body.position.set(0, 0.072, 0);
    body.scale.set(1.06, 0.94, 1.04);
    head.position.set(0, 0.148, 0.03);
    tail.position.set(0, 0.075, -0.074);
  } else {
    body.position.set(0, 0.068, 0);
    body.scale.set(1.08, 0.9, 1.06);
    head.position.set(0.008, 0.136, 0.032);
    head.rotation.set(0.08, -0.35, 0.12);
    tail.position.set(0, 0.07, -0.076);
  }

  addAccessory(THREE, head, body, {
    bowPos: [0.022, 0.066, 0.02],
    bowScale: 0.8,
    neckPos: [0, 0.044, 0.028],
    neckR: 0.048,
    neckRot: [0.22, 0, 0]
  }, opts.accessory, mats);

  return finalizePet(THREE, group, "bird", variant);
}

// 6. FOX
function fox(THREE, opts = {}) {
  const variant = opts.variant ?? 0;
  const mats = createBaseMats(THREE, {
    fur: 0xd96b34,
    furAccent: 0xfaf3e8,
    eye: 0x2b2018,
    skin: 0xf0a6a6,
    primary: 0x26201e,
    secondary: 0x332824,
    fabric: 0x4f8a68
  }, opts);

  const group = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";
  group.add(body, head, tail);

  // Body
  addMesh(THREE, body, new THREE.SphereGeometry(0.072, 18, 16), mats.fur, { scale: [0.92, 0.88, 1.26], slot: "fur" });
  addMesh(THREE, body, new THREE.SphereGeometry(0.056, 16, 14), mats.furAccent, {
    pos: [0, -0.01, 0.036],
    scale: [0.88, 0.82, 0.92],
    slot: "furAccent"
  });
  addQuadrupedLegs(THREE, body, mats, {
    r: 0.019,
    len: 0.05,
    xSpread: 0.038,
    zFront: 0.05,
    zBack: -0.052,
    yOffset: -0.044,
    variant,
    sockSlot: "secondary",
    sockMat: mats.secondary
  });

  // Head with tapered fox snout & fluffy cheek ruffs
  addMesh(THREE, head, new THREE.SphereGeometry(0.084, 20, 18), mats.fur, { scale: [1.1, 0.94, 0.98], slot: "fur" });
  addMesh(THREE, head, new THREE.ConeGeometry(0.042, 0.072, 16), mats.furAccent, {
    pos: [0, -0.018, 0.086],
    rot: [Math.PI * 0.5, 0, 0],
    scale: [1.15, 1.0, 0.78],
    slot: "furAccent"
  });
  [-1, 1].forEach((side) => {
    addMesh(THREE, head, new THREE.SphereGeometry(0.036, 12, 10), mats.furAccent, {
      pos: [side * 0.058, -0.022, 0.032],
      scale: [1.2, 0.76, 0.75],
      slot: "furAccent"
    });
  });

  addEyes(THREE, head, mats, { x: 0.038, y: 0.01, z: 0.074, r: 0.0135 });
  addCuteMouth(THREE, head, mats, { y: -0.016, z: 0.122, noseR: 0.01, noseSlot: "primary" });

  // Large pointed fox ears with dark tips
  const earGeo = makeRoundedEarGeo(THREE, 0.054, 0.084, 0.014);
  const innerGeo = makeRoundedEarGeo(THREE, 0.03, 0.052, 0.008);
  [-1, 1].forEach((side) => {
    const ear = new THREE.Group();
    ear.name = side < 0 ? "earL" : "earR";
    ear.position.set(side * 0.056, 0.06, 0.002);
    ear.rotation.set(0.06, side * -0.18, side * -0.28);
    head.add(ear);
    addMesh(THREE, ear, earGeo, mats.fur, { pos: [0, 0, -0.007], slot: "fur" });
    addMesh(THREE, ear, innerGeo, mats.furAccent, { pos: [0, 0.006, 0.003], slot: "furAccent" });
    addMesh(THREE, ear, new THREE.ConeGeometry(0.015, 0.03, 10), mats.secondary, {
      pos: [0, 0.078, 0],
      scale: [1.0, 1.0, 0.65],
      slot: "secondary"
    });
  });

  // Huge plush bushy tail using LatheGeometry
  const lathePts = [
    new THREE.Vector2(0.008, 0.0),
    new THREE.Vector2(0.032, 0.035),
    new THREE.Vector2(0.052, 0.09),
    new THREE.Vector2(0.044, 0.145),
    new THREE.Vector2(0.022, 0.185),
    new THREE.Vector2(0.001, 0.205)
  ];
  const tailGeo = new THREE.LatheGeometry(lathePts, 16);
  addMesh(THREE, tail, tailGeo, mats.fur, { rot: [-Math.PI * 0.42, 0, 0], slot: "fur" });
  addMesh(THREE, tail, new THREE.SphereGeometry(0.038, 14, 12), mats.furAccent, {
    pos: [0, 0.036, -0.155],
    scale: [0.9, 0.9, 1.35],
    slot: "furAccent"
  });

  if (variant === 0) {
    body.position.set(0, 0.105, 0);
    head.position.set(0, 0.215, 0.078);
    tail.position.set(0, 0.115, -0.082);
  } else if (variant === 1) {
    body.position.set(0, 0.112, -0.01);
    body.rotation.x = -0.36;
    head.position.set(0, 0.232, 0.046);
    tail.position.set(0.032, 0.072, -0.068);
    tail.rotation.set(-0.22, 1.15, 0);
  } else {
    // Cozy fox donut curl
    body.position.set(0, 0.072, 0);
    body.scale.set(1.08, 0.85, 1.0);
    head.position.set(0.025, 0.135, 0.072);
    head.rotation.set(0.16, -0.45, 0.15);
    tail.position.set(0.045, 0.062, -0.048);
    tail.rotation.set(-0.25, 1.75, 0);
  }

  addAccessory(THREE, head, body, {
    bowPos: [0.028, 0.084, 0.025],
    neckPos: [0, 0.046, 0.06],
    neckR: 0.052,
    neckRot: [0.35, 0, 0]
  }, opts.accessory, mats);

  return finalizePet(THREE, group, "fox", variant);
}

// 7. TURTLE
function turtle(THREE, opts = {}) {
  const variant = opts.variant ?? 0;
  const mats = createBaseMats(THREE, {
    fur: 0x7da868,
    furAccent: 0xd9cfa8,
    eye: 0x23201b,
    skin: 0xeb9e9e,
    primary: 0x3b4d30,
    secondary: 0x4f7042,
    wood: 0x5c7a49,
    fabric: 0xe68a5c
  }, opts);

  const group = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";
  group.add(body, head, tail);

  // Domed shell + underbelly plastron + hexagonal scutes
  const domeGeo = new THREE.SphereGeometry(0.105, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.54);
  addMesh(THREE, body, domeGeo, mats.secondary, { scale: [0.94, 0.78, 1.12], slot: "secondary" });
  addMesh(THREE, body, new THREE.TorusGeometry(0.098, 0.014, 10, 24), mats.wood, {
    pos: [0, 0.002, 0],
    rot: [Math.PI * 0.5, 0, 0],
    scale: [0.94, 1.12, 0.7],
    slot: "wood"
  });
  addMesh(THREE, body, new THREE.CylinderGeometry(0.092, 0.086, 0.022, 18), mats.furAccent, {
    pos: [0, -0.008, 0],
    scale: [0.92, 1.0, 1.1],
    slot: "furAccent"
  });

  // Scute plates on shell
  const scuteGeo = new THREE.CylinderGeometry(0.026, 0.032, 0.014, 6);
  addMesh(THREE, body, scuteGeo, mats.wood, { pos: [0, 0.078, 0], slot: "wood" });
  [
    [0, 0.064, 0.056, 0.55, 0],
    [0, 0.064, -0.056, -0.55, 0],
    [0.052, 0.058, 0.028, 0.35, -0.55],
    [-0.052, 0.058, 0.028, 0.35, 0.55],
    [0.052, 0.058, -0.028, -0.35, -0.55],
    [-0.052, 0.058, -0.028, -0.35, 0.55]
  ].forEach(([x, y, z, rx, rz]) => {
    addMesh(THREE, body, scuteGeo, mats.wood, { pos: [x, y, z], rot: [rx, 0, rz], scale: 0.85, slot: "wood" });
  });

  // Stubby legs
  const legGeo = new THREE.CapsuleGeometry(0.022, 0.026, 6, 10);
  const tuck = variant === 2 ? 0.75 : 1.0;
  [-1, 1].forEach((side) => {
    addMesh(THREE, body, legGeo, mats.fur, {
      pos: [side * 0.072 * tuck, -0.022, 0.068 * tuck],
      rot: [0.2, 0, side * -0.2],
      slot: "fur"
    });
    addMesh(THREE, body, legGeo, mats.fur, {
      pos: [side * 0.072 * tuck, -0.022, -0.068 * tuck],
      rot: [-0.2, 0, side * -0.2],
      slot: "fur"
    });
  });

  // Cute round chibi turtle head
  addMesh(THREE, head, new THREE.SphereGeometry(0.058, 18, 16), mats.fur, { scale: [1.02, 0.94, 1.08], slot: "fur" });
  addEyes(THREE, head, mats, { x: 0.028, y: 0.008, z: 0.052, r: 0.012, cheekY: -0.012, cheekOffset: 0.008 });
  addMesh(THREE, head, new THREE.TorusGeometry(0.016, 0.0028, 6, 14, Math.PI), mats.primary, {
    pos: [0, -0.012, 0.058],
    rot: [0.2, 0, Math.PI],
    slot: "primary"
  });

  // Tiny pointed tail
  addMesh(THREE, tail, new THREE.ConeGeometry(0.014, 0.036, 10), mats.fur, {
    rot: [-Math.PI * 0.55, 0, 0],
    slot: "fur"
  });

  if (variant === 0) {
    body.position.set(0, 0.052, 0);
    head.position.set(0, 0.092, 0.132);
    tail.position.set(0, 0.048, -0.125);
  } else if (variant === 1) {
    body.position.set(0, 0.042, 0);
    head.position.set(0, 0.088, 0.126);
    head.rotation.x = -0.15;
    tail.position.set(0, 0.038, -0.122);
  } else {
    body.position.set(0, 0.036, 0);
    head.position.set(0, 0.062, 0.098);
    tail.position.set(0, 0.032, -0.105);
  }

  addAccessory(THREE, head, body, {
    bowPos: [0.022, 0.055, 0.018],
    bowScale: 0.85,
    neckPos: [0, 0.024, 0.102],
    neckR: 0.038,
    neckRot: [0.45, 0, 0]
  }, opts.accessory, mats);

  return finalizePet(THREE, group, "turtle", variant);
}

// 8. HEDGEHOG
function hedgehog(THREE, opts = {}) {
  const variant = opts.variant ?? 0;
  const mats = createBaseMats(THREE, {
    fur: 0x7d604b,
    furAccent: 0xf2e4d0,
    eye: 0x1f1a17,
    skin: 0xeda3ab,
    primary: 0x241d1a,
    secondary: 0x5c4435,
    fabric: 0xc96859
  }, opts);

  const group = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";
  group.add(body, head, tail);

  // Soft cream belly + spiky mantle
  addMesh(THREE, body, new THREE.SphereGeometry(0.078, 18, 16), mats.furAccent, { scale: [1.0, 0.9, 1.12], slot: "furAccent" });
  addMesh(THREE, body, new THREE.SphereGeometry(0.082, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), mats.fur, {
    pos: [0, 0.008, -0.014],
    rot: [-0.25, 0, 0],
    scale: [1.04, 0.96, 1.14],
    slot: "fur"
  });

  // Layered cozy rounded spines
  const spineGeo = new THREE.ConeGeometry(0.014, 0.044, 8);
  for (let row = 0; row < 4; row++) {
    const phi = 0.25 + row * 0.34;
    const count = row === 0 ? 5 : 8 + row * 2;
    for (let i = 0; i < count; i++) {
      const theta = (i / count) * Math.PI * 2 + row * 0.35;
      const sx = Math.sin(phi) * Math.cos(theta) * 0.082;
      const sy = Math.cos(phi) * 0.078 + 0.008;
      const sz = Math.sin(phi) * Math.sin(theta) * 0.092 - 0.016;
      if (sz > 0.046 && sy < 0.042) continue; // leave face opening clear
      const isAlt = (i + row) % 2 === 0;
      addMesh(THREE, body, spineGeo, isAlt ? mats.fur : mats.secondary, {
        pos: [sx, sy, sz],
        rot: [Math.sin(theta) * phi - 0.35, 0, -Math.cos(theta) * phi],
        slot: isAlt ? "fur" : "secondary"
      });
    }
  }

  // Tiny paws
  const pawGeo = new THREE.SphereGeometry(0.016, 10, 8);
  [-1, 1].forEach((side) => {
    addMesh(THREE, body, pawGeo, mats.skin, { pos: [side * 0.044, -0.062, 0.042], scale: [1, 0.65, 1.25], slot: "skin" });
    addMesh(THREE, body, pawGeo, mats.skin, { pos: [side * 0.048, -0.062, -0.04], scale: [1, 0.65, 1.25], slot: "skin" });
  });

  // Cream pointed face
  addMesh(THREE, head, new THREE.SphereGeometry(0.062, 18, 16), mats.furAccent, { scale: [1.04, 0.92, 1.02], slot: "furAccent" });
  addMesh(THREE, head, new THREE.ConeGeometry(0.036, 0.056, 14), mats.furAccent, {
    pos: [0, -0.01, 0.062],
    rot: [Math.PI * 0.52, 0, 0],
    scale: [1.05, 1.0, 0.85],
    slot: "furAccent"
  });
  addEyes(THREE, head, mats, { x: 0.03, y: 0.008, z: 0.054, r: 0.012 });
  addCuteMouth(THREE, head, mats, { y: -0.012, z: 0.09, noseR: 0.01, noseSlot: "primary", smile: false });

  // Small rounded ears
  const earGeo = new THREE.SphereGeometry(0.018, 10, 8);
  [-1, 1].forEach((side) => {
    const ear = new THREE.Group();
    ear.name = side < 0 ? "earL" : "earR";
    ear.position.set(side * 0.048, 0.042, 0.008);
    head.add(ear);
    addMesh(THREE, ear, earGeo, mats.furAccent, { scale: [1.0, 1.0, 0.45], slot: "furAccent" });
    addMesh(THREE, ear, new THREE.SphereGeometry(0.011, 8, 8), mats.skin, { pos: [0, 0, 0.005], scale: [1, 1, 0.35], slot: "skin" });
  });

  // Tiny nub tail
  addMesh(THREE, tail, new THREE.SphereGeometry(0.012, 8, 8), mats.fur, { slot: "fur" });

  if (variant === 0) {
    body.position.set(0, 0.075, -0.01);
    head.position.set(0, 0.088, 0.062);
    tail.position.set(0, 0.055, -0.105);
  } else if (variant === 1) {
    body.position.set(0, 0.086, -0.01);
    body.rotation.x = -0.58;
    head.position.set(0, 0.152, 0.038);
    tail.position.set(0, 0.042, -0.092);
  } else {
    body.position.set(0, 0.082, 0);
    body.scale.set(1.06, 1.0, 1.04);
    head.position.set(0, 0.078, 0.046);
    tail.position.set(0, 0.062, -0.095);
  }

  addAccessory(THREE, head, body, {
    bowPos: [0.02, 0.058, 0.024],
    bowScale: 0.8,
    neckPos: [0, 0.01, 0.058],
    neckR: 0.052,
    neckRot: [0.6, 0, 0]
  }, opts.accessory, mats);

  return finalizePet(THREE, group, "hedgehog", variant);
}

// 9. DUCK
function duck(THREE, opts = {}) {
  const variant = opts.variant ?? 0;
  const mats = createBaseMats(THREE, {
    fur: 0xfaf2d6,
    furAccent: 0xf5d67a,
    eye: 0x1f1d1c,
    skin: 0xf2a0a6,
    primary: 0xf08c34,
    secondary: 0xeae0c0,
    fabric: 0x5c9ad6
  }, opts);

  const group = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";
  group.add(body, head, tail);

  // Plump duck body
  addMesh(THREE, body, new THREE.SphereGeometry(0.082, 18, 16), mats.fur, { scale: [0.98, 0.88, 1.24], slot: "fur" });
  addMesh(THREE, body, new THREE.SphereGeometry(0.064, 16, 14), mats.furAccent, {
    pos: [0, -0.014, 0.028],
    scale: [0.9, 0.78, 0.98],
    slot: "furAccent"
  });

  // Rounded wings
  const wingGeo = makeWingGeo(THREE, 0.092, 0.062, 0.014);
  [-1, 1].forEach((side) => {
    const wing = new THREE.Group();
    wing.name = side < 0 ? "wingL" : "wingR";
    wing.position.set(side * 0.076, 0.012, 0.02);
    wing.rotation.set(0.1, side * -Math.PI * 0.45, side * -0.1);
    body.add(wing);
    addMesh(THREE, wing, wingGeo, mats.secondary, { pos: [0, 0, -0.007], slot: "secondary" });
  });

  // Webbed orange feet
  const webShape = new THREE.Shape();
  webShape.moveTo(0, 0);
  webShape.lineTo(-0.024, 0.036);
  webShape.quadraticCurveTo(0, 0.044, 0.024, 0.036);
  webShape.closePath();
  const webGeo = new THREE.ExtrudeGeometry(webShape, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 });
  const legGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.034, 8);
  [-1, 1].forEach((side) => {
    if (variant === 0) {
      addMesh(THREE, body, legGeo, mats.primary, { pos: [side * 0.034, -0.072, 0.004], slot: "primary" });
      addMesh(THREE, body, webGeo, mats.primary, {
        pos: [side * 0.034, -0.088, 0.0],
        rot: [Math.PI * 0.5, 0, side * -0.15],
        slot: "primary"
      });
    } else {
      addMesh(THREE, body, webGeo, mats.primary, {
        pos: [side * 0.04, -0.064, 0.015],
        rot: [Math.PI * 0.5, 0, side * -0.25],
        slot: "primary"
      });
    }
  });

  // Big round head + cute curl tuft + wide flat bill
  addMesh(THREE, head, new THREE.SphereGeometry(0.076, 18, 16), mats.fur, { scale: [1.02, 0.98, 1.0], slot: "fur" });
  addMesh(THREE, head, new THREE.CapsuleGeometry(0.008, 0.018, 6, 8), mats.fur, {
    pos: [0, 0.08, 0.0],
    rot: [-0.45, 0, 0.2],
    slot: "fur"
  });
  addEyes(THREE, head, mats, { x: 0.036, y: 0.012, z: 0.065, r: 0.0135 });

  // Wide duck bill
  addMesh(THREE, head, new THREE.SphereGeometry(0.034, 14, 12), mats.primary, {
    pos: [0, -0.012, 0.082],
    scale: [1.18, 0.42, 1.15],
    slot: "primary"
  });
  addMesh(THREE, head, new THREE.SphereGeometry(0.028, 12, 10), mats.primary, {
    pos: [0, -0.022, 0.076],
    scale: [1.05, 0.3, 1.0],
    slot: "primary"
  });

  // Upturned duck tail
  addMesh(THREE, tail, new THREE.ConeGeometry(0.028, 0.056, 12), mats.fur, {
    rot: [-0.85, 0, 0],
    scale: [1.1, 1.0, 0.7],
    slot: "fur"
  });

  if (variant === 0) {
    body.position.set(0, 0.105, 0);
    head.position.set(0, 0.205, 0.055);
    tail.position.set(0, 0.132, -0.105);
  } else if (variant === 1) {
    body.position.set(0, 0.075, 0);
    head.position.set(0, 0.175, 0.052);
    tail.position.set(0, 0.102, -0.105);
  } else {
    body.position.set(0, 0.07, 0);
    body.scale.set(1.06, 0.88, 1.05);
    head.position.set(0.01, 0.155, 0.058);
    head.rotation.set(0.12, -0.28, 0.1);
    tail.position.set(0, 0.095, -0.108);
  }

  addAccessory(THREE, head, body, {
    bowPos: [0.026, 0.074, 0.022],
    neckPos: [0, 0.055, 0.048],
    neckR: 0.052,
    neckRot: [0.25, 0, 0]
  }, opts.accessory, mats);

  return finalizePet(THREE, group, "duck", variant);
}

// 10. PANDA
function panda(THREE, opts = {}) {
  const variant = opts.variant ?? 0;
  const mats = createBaseMats(THREE, {
    fur: 0xf7f5f0,
    furAccent: 0x2b2b30,
    eye: 0x16161a,
    skin: 0xf0a6b0,
    primary: 0x242428,
    wood: 0x6ea656,
    fabric: 0xd95555
  }, opts);

  const group = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";
  group.add(body, head, tail);

  // Plump white body + dark shoulder saddle
  addMesh(THREE, body, new THREE.SphereGeometry(0.095, 20, 18), mats.fur, { scale: [1.02, 0.96, 1.16], slot: "fur" });
  addMesh(THREE, body, new THREE.TorusGeometry(0.088, 0.024, 12, 22), mats.furAccent, {
    pos: [0, 0.018, 0.036],
    rot: [0.35, 0, 0],
    scale: [1.0, 0.92, 0.88],
    slot: "furAccent"
  });

  // Dark panda limbs
  const legGeo = new THREE.CapsuleGeometry(0.028, 0.052, 8, 12);
  const pawGeo = new THREE.SphereGeometry(0.031, 12, 10);
  [-1, 1].forEach((side) => {
    if (variant === 0) {
      addMesh(THREE, body, legGeo, mats.furAccent, { pos: [side * 0.056, -0.054, 0.058], slot: "furAccent" });
      addMesh(THREE, body, legGeo, mats.furAccent, { pos: [side * 0.058, -0.054, -0.058], slot: "furAccent" });
    } else if (variant === 1) {
      // Classic chubby panda sit
      addMesh(THREE, body, legGeo, mats.furAccent, { pos: [side * 0.068, 0.008, 0.064], rot: [0.75, 0, side * -0.35], slot: "furAccent" });
      addMesh(THREE, body, legGeo, mats.furAccent, { pos: [side * 0.064, -0.064, 0.062], rot: [1.45, side * 0.25, 0], slot: "furAccent" });
      addMesh(THREE, body, pawGeo, mats.skin, { pos: [side * 0.072, -0.062, 0.098], scale: [0.8, 0.8, 0.35], slot: "skin" });
    } else {
      addMesh(THREE, body, legGeo, mats.furAccent, { pos: [side * 0.066, -0.038, 0.078], rot: [1.45, side * -0.2, 0], slot: "furAccent" });
      addMesh(THREE, body, legGeo, mats.furAccent, { pos: [side * 0.068, -0.038, -0.068], rot: [1.5, side * 0.25, 0], slot: "furAccent" });
    }
  });
  if (variant === 1) {
    // Tiny bamboo stalk held in front
    addMesh(THREE, body, new THREE.CylinderGeometry(0.009, 0.01, 0.11, 10), mats.wood, {
      pos: [0.02, 0.025, 0.105],
      rot: [0.15, 0, 0.38],
      slot: "wood"
    });
  }

  // Big round panda head + dark eye patches + round dark ears
  addMesh(THREE, head, new THREE.SphereGeometry(0.105, 22, 18), mats.fur, { scale: [1.08, 0.96, 0.98], slot: "fur" });
  [-1, 1].forEach((side) => {
    addMesh(THREE, head, new THREE.SphereGeometry(0.032, 14, 12), mats.furAccent, {
      pos: [side * 0.044, 0.008, 0.084],
      rot: [0, side * 0.22, side * -0.32],
      scale: [1.0, 1.24, 0.45],
      slot: "furAccent"
    });
  });
  addEyes(THREE, head, mats, { x: 0.042, y: 0.012, z: 0.094, r: 0.014, cheekOffset: 0.018 });
  addCuteMouth(THREE, head, mats, { y: -0.02, z: 0.105, noseR: 0.012, noseSlot: "primary" });

  // Round dark ears
  const earGeo = new THREE.SphereGeometry(0.032, 14, 12);
  [-1, 1].forEach((side) => {
    const ear = new THREE.Group();
    ear.name = side < 0 ? "earL" : "earR";
    ear.position.set(side * 0.078, 0.082, 0.0);
    head.add(ear);
    addMesh(THREE, ear, earGeo, mats.furAccent, { scale: [1.0, 1.0, 0.58], slot: "furAccent" });
  });

  // Stubby tail
  addMesh(THREE, tail, new THREE.SphereGeometry(0.024, 10, 10), mats.fur, { slot: "fur" });

  if (variant === 0) {
    body.position.set(0, 0.132, 0);
    head.position.set(0, 0.268, 0.088);
    tail.position.set(0, 0.142, -0.112);
  } else if (variant === 1) {
    body.position.set(0, 0.112, -0.01);
    body.rotation.x = -0.22;
    head.position.set(0, 0.275, 0.035);
    tail.position.set(0, 0.082, -0.105);
  } else {
    body.position.set(0, 0.092, 0);
    body.scale.set(1.06, 0.86, 1.04);
    head.position.set(0, 0.185, 0.098);
    head.rotation.set(0.14, 0.15, -0.08);
    tail.position.set(0, 0.102, -0.115);
  }

  addAccessory(THREE, head, body, {
    bowPos: [0.032, 0.102, 0.028],
    bowScale: 1.15,
    neckPos: [0, 0.068, 0.062],
    neckR: 0.068,
    neckRot: [0.3, 0, 0]
  }, opts.accessory, mats);

  return finalizePet(THREE, group, "panda", variant);
}

// 11. TIGER (plush-sized cub, ~0.48 m)
function tiger(THREE, opts = {}) {
  const variant = opts.variant ?? 0;
  const mats = createBaseMats(THREE, {
    fur: 0xe5873e,
    furAccent: 0xfcf2e1,
    eye: 0x2e2418,
    skin: 0xf09ca2,
    primary: 0x2a201b,
    secondary: 0x33241c,
    fabric: 0xc94949
  }, opts);

  const group = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";
  group.add(body, head, tail);

  // Plush cub body
  addMesh(THREE, body, new THREE.SphereGeometry(0.108, 20, 18), mats.fur, { scale: [0.98, 0.92, 1.28], slot: "fur" });
  addMesh(THREE, body, new THREE.SphereGeometry(0.086, 16, 14), mats.furAccent, {
    pos: [0, -0.024, 0.032],
    scale: [0.88, 0.78, 1.0],
    slot: "furAccent"
  });
  // Body stripes
  for (let i = -2; i <= 2; i++) {
    addMesh(THREE, body, new THREE.TorusGeometry(0.095, 0.011, 8, 20, Math.PI * 0.9), mats.secondary, {
      pos: [0, 0.008, i * 0.038],
      rot: [0, 0, Math.PI * 0.05],
      scale: [1.0, 0.94, 1.0],
      slot: "secondary"
    });
  }

  addQuadrupedLegs(THREE, body, mats, {
    r: 0.032,
    len: 0.068,
    xSpread: 0.062,
    zFront: 0.072,
    zBack: -0.074,
    yOffset: -0.062,
    variant
  });

  // Big plush cub head + wide cheek ruffs + broad muzzle
  addMesh(THREE, head, new THREE.SphereGeometry(0.118, 22, 18), mats.fur, { scale: [1.1, 0.96, 0.98], slot: "fur" });
  addMesh(THREE, head, new THREE.SphereGeometry(0.058, 16, 14), mats.furAccent, {
    pos: [0, -0.026, 0.088],
    scale: [1.24, 0.8, 0.85],
    slot: "furAccent"
  });
  [-1, 1].forEach((side) => {
    addMesh(THREE, head, new THREE.SphereGeometry(0.048, 12, 10), mats.furAccent, {
      pos: [side * 0.084, -0.028, 0.032],
      scale: [1.18, 0.76, 0.75],
      slot: "furAccent"
    });
    // Cheek stripes
    addMesh(THREE, head, new THREE.CapsuleGeometry(0.007, 0.028, 4, 8), mats.secondary, {
      pos: [side * 0.092, -0.008, 0.068],
      rot: [0, side * 0.55, Math.PI * 0.5],
      slot: "secondary"
    });
  });

  // Forehead stripes
  for (let i = -1; i <= 1; i++) {
    addMesh(THREE, head, new THREE.CapsuleGeometry(0.008, 0.028, 4, 8), mats.secondary, {
      pos: [i * 0.024, 0.07, 0.088],
      rot: [0.5, 0, i * -0.12],
      slot: "secondary"
    });
  }
  addMesh(THREE, head, new THREE.CapsuleGeometry(0.007, 0.046, 4, 8), mats.secondary, {
    pos: [0, 0.068, 0.09],
    rot: [0, 0, Math.PI * 0.5],
    slot: "secondary"
  });

  addEyes(THREE, head, mats, { x: 0.048, y: 0.014, z: 0.104, r: 0.0165 });
  addCuteMouth(THREE, head, mats, { y: -0.018, z: 0.132, noseR: 0.014, noseSlot: "skin" });

  // Round tiger cub ears
  const earGeo = new THREE.SphereGeometry(0.036, 14, 12);
  [-1, 1].forEach((side) => {
    const ear = new THREE.Group();
    ear.name = side < 0 ? "earL" : "earR";
    ear.position.set(side * 0.084, 0.088, 0.005);
    ear.rotation.set(0.1, side * -0.15, side * -0.25);
    head.add(ear);
    addMesh(THREE, ear, earGeo, mats.secondary, { scale: [1.0, 1.0, 0.56], slot: "secondary" });
    addMesh(THREE, ear, new THREE.SphereGeometry(0.022, 10, 8), mats.furAccent, { pos: [0, 0, 0.01], scale: [1.0, 1.0, 0.45], slot: "furAccent" });
  });

  // Curved striped plush tail
  const tPts = variant === 2
    ? [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.07, 0.008, -0.04),
        new THREE.Vector3(0.13, 0.012, 0.04),
        new THREE.Vector3(0.11, 0.018, 0.13)
      ]
    : [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0.032, -0.075),
        new THREE.Vector3(0.018, 0.105, -0.115),
        new THREE.Vector3(0.035, 0.15, -0.072)
      ];
  const tCurve = new THREE.CatmullRomCurve3(tPts);
  addMesh(THREE, tail, new THREE.TubeGeometry(tCurve, 20, 0.021, 10, false), mats.fur, { slot: "fur" });
  [0.25, 0.5, 0.75].forEach((u) => {
    const p = tCurve.getPoint(u);
    addMesh(THREE, tail, new THREE.SphereGeometry(0.0225, 10, 8), mats.secondary, {
      pos: [p.x, p.y, p.z],
      scale: [1.02, 0.65, 1.02],
      slot: "secondary"
    });
  });
  const endP = tPts[tPts.length - 1];
  addMesh(THREE, tail, new THREE.SphereGeometry(0.023, 10, 10), mats.secondary, { pos: [endP.x, endP.y, endP.z], slot: "secondary" });

  if (variant === 0) {
    body.position.set(0, 0.155, 0);
    head.position.set(0, 0.305, 0.112);
    tail.position.set(0, 0.175, -0.125);
  } else if (variant === 1) {
    body.position.set(0, 0.16, -0.015);
    body.rotation.x = -0.35;
    head.position.set(0, 0.33, 0.068);
    tail.position.set(0, 0.105, -0.115);
    tail.rotation.y = 0.5;
  } else {
    body.position.set(0, 0.105, 0);
    body.scale.set(1.06, 0.86, 1.04);
    head.position.set(0, 0.215, 0.125);
    head.rotation.set(0.1, -0.12, 0.06);
    tail.position.set(0.03, 0.055, -0.11);
  }

  addAccessory(THREE, head, body, {
    bowPos: [0.038, 0.116, 0.032],
    bowScale: 1.25,
    neckPos: [0, 0.068, 0.088],
    neckR: 0.076,
    neckRot: [0.35, 0, 0]
  }, opts.accessory, mats);

  return finalizePet(THREE, group, "tiger", variant);
}

// 12. OWL
function owl(THREE, opts = {}) {
  const variant = opts.variant ?? 0;
  const mats = createBaseMats(THREE, {
    fur: 0x9c7b60,
    furAccent: 0xf4ead8,
    eye: 0x241a12,
    skin: 0xe8a49c,
    primary: 0xe6a63e,
    secondary: 0x735742,
    fabric: 0x7d5ba6
  }, opts);

  const group = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";
  group.add(body, head, tail);

  // Plump oval owl body
  addMesh(THREE, body, new THREE.SphereGeometry(0.084, 18, 16), mats.fur, { scale: [0.98, 1.1, 0.96], slot: "fur" });
  addMesh(THREE, body, new THREE.SphereGeometry(0.068, 16, 14), mats.furAccent, {
    pos: [0, -0.008, 0.032],
    scale: [0.88, 0.96, 0.78],
    slot: "furAccent"
  });

  // Scalloped belly feather spots
  for (let row = 0; row < 3; row++) {
    const count = row === 1 ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) * 0.5) * 0.032;
      addMesh(THREE, body, new THREE.SphereGeometry(0.01, 8, 8), mats.secondary, {
        pos: [x, 0.012 - row * 0.024, 0.078 - Math.abs(x) * 0.25],
        scale: [1.1, 0.65, 0.35],
        slot: "secondary"
      });
    }
  }

  // Rounded folded owl wings
  const wingGeo = makeWingGeo(THREE, 0.095, 0.072, 0.014);
  [-1, 1].forEach((side) => {
    const wing = new THREE.Group();
    wing.name = side < 0 ? "wingL" : "wingR";
    wing.position.set(side * 0.076, 0.028, 0.01);
    wing.rotation.set(0.28, side * -Math.PI * 0.48, side * -0.15);
    body.add(wing);
    addMesh(THREE, wing, wingGeo, mats.secondary, { pos: [0, 0, -0.007], slot: "secondary" });
  });

  // Perched talons
  const toeGeo = new THREE.CapsuleGeometry(0.005, 0.02, 4, 6);
  [-1, 1].forEach((side) => {
    [-0.28, 0, 0.28].forEach((ang) => {
      addMesh(THREE, body, toeGeo, mats.primary, {
        pos: [side * 0.032 + Math.sin(ang) * 0.01, -0.092, 0.018 + Math.cos(ang) * 0.008],
        rot: [Math.PI * 0.5, 0, -ang],
        slot: "primary"
      });
    });
  });

  // Big round owl head + heart-shaped double facial disc + ear tufts
  addMesh(THREE, head, new THREE.SphereGeometry(0.086, 20, 18), mats.fur, { scale: [1.08, 0.94, 0.96], slot: "fur" });
  [-1, 1].forEach((side) => {
    addMesh(THREE, head, new THREE.SphereGeometry(0.044, 14, 12), mats.furAccent, {
      pos: [side * 0.034, 0.004, 0.068],
      scale: [1.0, 1.0, 0.42],
      slot: "furAccent"
    });
  });

  addEyes(THREE, head, mats, { x: 0.036, y: 0.008, z: 0.082, r: 0.016, cheekY: -0.02, cheekOffset: 0.014 });

  // Small hooked owl beak
  addMesh(THREE, head, new THREE.ConeGeometry(0.014, 0.028, 10), mats.primary, {
    pos: [0, -0.012, 0.092],
    rot: [Math.PI * 0.65, 0, 0],
    scale: [0.9, 1.0, 0.8],
    slot: "primary"
  });

  // Feathered ear tufts
  const tuftGeo = makeRoundedEarGeo(THREE, 0.034, 0.048, 0.012);
  [-1, 1].forEach((side) => {
    const ear = new THREE.Group();
    ear.name = side < 0 ? "earL" : "earR";
    ear.position.set(side * 0.062, 0.062, 0.008);
    ear.rotation.set(0.08, side * -0.2, side * -0.42);
    head.add(ear);
    addMesh(THREE, ear, tuftGeo, mats.secondary, { pos: [0, 0, -0.006], slot: "secondary" });
  });

  // Short tail feathers
  const featGeo = new THREE.CapsuleGeometry(0.014, 0.042, 6, 8);
  [-0.2, 0, 0.2].forEach((ang) => {
    addMesh(THREE, tail, featGeo, mats.secondary, {
      pos: [Math.sin(ang) * 0.02, -0.012, -0.024],
      rot: [1.18, ang, 0],
      scale: [1.0, 1.0, 0.35],
      slot: "secondary"
    });
  });

  if (variant === 0) {
    body.position.set(0, 0.098, 0);
    head.position.set(0, 0.215, 0.012);
    tail.position.set(0, 0.056, -0.072);
  } else if (variant === 1) {
    body.position.set(0, 0.092, 0);
    body.scale.set(1.06, 0.96, 1.04);
    head.position.set(0, 0.198, 0.014);
    tail.position.set(0, 0.052, -0.074);
  } else {
    body.position.set(0, 0.084, 0);
    body.scale.set(1.1, 0.88, 1.08);
    head.position.set(0, 0.176, 0.016);
    head.rotation.set(0.12, 0.18, -0.1);
    tail.position.set(0, 0.048, -0.076);
  }

  addAccessory(THREE, head, body, {
    bowPos: [0.026, 0.08, 0.028],
    neckPos: [0, 0.068, 0.012],
    neckR: 0.068,
    neckRot: [0.1, 0, 0]
  }, opts.accessory, mats);

  return finalizePet(THREE, group, "owl", variant);
}

export const PETS = {
  cat,
  dog,
  rabbit,
  hamster,
  bird,
  fox,
  turtle,
  hedgehog,
  duck,
  panda,
  tiger,
  owl
};

export function idle(group, t) {
  if (!group) return;
  const phase = group.userData.phase || 0;
  const time = t + phase;

  const breath = Math.sin(time * 2.1);
  const head = group.getObjectByName("head");
  const body = group.getObjectByName("body");
  const tail = group.getObjectByName("tail");
  const earL = group.getObjectByName("earL");
  const earR = group.getObjectByName("earR");
  const wingL = group.getObjectByName("wingL");
  const wingR = group.getObjectByName("wingR");

  if (body && body.userData.base) {
    const b = body.userData.base;
    body.scale.set(
      b.sx * (1 + breath * 0.018),
      b.sy * (1 - breath * 0.012),
      b.sz * (1 + breath * 0.014)
    );
  }

  if (head && head.userData.base) {
    const b = head.userData.base;
    head.position.y = b.py + breath * 0.0025;
    head.rotation.z = b.rz + Math.sin(time * 0.9) * 0.045;
    head.rotation.y = b.ry + Math.sin(time * 0.65) * 0.055;
    head.rotation.x = b.rx + Math.sin(time * 1.05) * 0.025;
  }

  if (tail && tail.userData.base) {
    const b = tail.userData.base;
    const wagSpeed = group.userData.petType === "dog" ? 5.2 : 2.4;
    const wagAmp = group.userData.petType === "dog" ? 0.22 : 0.12;
    tail.rotation.y = b.ry + Math.sin(time * wagSpeed) * wagAmp;
    tail.rotation.x = b.rx + Math.cos(time * wagSpeed * 0.5) * 0.04;
  }

  // Occasional gentle ear twitch
  const twitchCycle = ((time * 0.27) % 1 + 1) % 1;
  const twitchPulse = twitchCycle > 0.92 ? Math.sin(((twitchCycle - 0.92) / 0.08) * Math.PI) : 0;
  if (earL && earL.userData.base) {
    const b = earL.userData.base;
    earL.rotation.z = b.rz + Math.sin(time * 1.4) * 0.025 + twitchPulse * 0.14;
  }
  if (earR && earR.userData.base) {
    const b = earR.userData.base;
    earR.rotation.z = b.rz - Math.sin(time * 1.4 + 0.4) * 0.025 - twitchPulse * 0.08;
  }

  // Gentle wing breath ruffle
  if (wingL && wingL.userData.base) {
    const b = wingL.userData.base;
    wingL.rotation.z = b.rz + breath * 0.045;
  }
  if (wingR && wingR.userData.base) {
    const b = wingR.userData.base;
    wingR.rotation.z = b.rz - breath * 0.045;
  }

  // Occasional blink every ~3.8s
  const blinkCycle = ((time % 3.8) + 3.8) % 3.8;
  let eyeScaleY = 1;
  if (blinkCycle > 3.62) {
    const u = (blinkCycle - 3.62) / 0.18;
    eyeScaleY = 1 - Math.sin(u * Math.PI) * 0.92;
  }
  if (head) {
    for (const child of head.children) {
      if (child.userData.isEyeGroup && child.userData.base) {
        child.scale.y = child.userData.base.sy * eyeScaleY;
      }
    }
  }
}

export function recolor(group, palette) {
  if (!group || !palette) return;
  group.traverse((obj) => {
    if (!obj.isMesh || !obj.material || !obj.material.color) return;
    if (obj.userData.isEye && palette.eye !== undefined) {
      obj.material.color.set(palette.eye);
      return;
    }
    const slot = obj.userData.slot;
    if (slot && palette[slot] !== undefined) {
      obj.material.color.set(palette[slot]);
    }
  });
}

export const CATALOG = [
  { id: "cat", name: "Cozy Cat", kind: "pet", footprint: [0.24, 0.34], placement: "pet", variants: 3, note: "Chibi tabby cat with curved tail; standing, sitting, or curled." },
  { id: "dog", name: "Plush Puppy", kind: "pet", footprint: [0.26, 0.36], placement: "pet", variants: 3, note: "Floppy-eared puppy with curled tail; standing, sitting, or lying." },
  { id: "rabbit", name: "Velvet Bunny", kind: "pet", footprint: [0.24, 0.30], placement: "pet", variants: 3, note: "Long-eared rabbit with cotton-ball tail; standing, sitting, or loafing." },
  { id: "hamster", name: "Chubby Hamster", kind: "pet", footprint: [0.20, 0.24], placement: "pet", variants: 3, note: "Puffy-cheeked hamster; standing, sitting with a seed, or curled." },
  { id: "bird", name: "Songbird", kind: "pet", footprint: [0.20, 0.26], placement: "pet", variants: 3, note: "Plump crested songbird with folded wings and fan tail." },
  { id: "fox", name: "Dorm Fox", kind: "pet", footprint: [0.28, 0.38], placement: "pet", variants: 3, note: "Pointed-eared fox with oversized bushy tail; standing, sitting, or curled." },
  { id: "turtle", name: "Pocket Turtle", kind: "pet", footprint: [0.24, 0.30], placement: "pet", variants: 3, note: "Domed scute-shell turtle; walking, resting, or tucked in." },
  { id: "hedgehog", name: "Spiky Hedgehog", kind: "pet", footprint: [0.22, 0.27], placement: "pet", variants: 3, note: "Cozy rounded-spine hedgehog; trotting, sitting, or rolled." },
  { id: "duck", name: "Butter Duck", kind: "pet", footprint: [0.24, 0.32], placement: "pet", variants: 3, note: "Plump chibi duck with wide orange bill and webbed feet." },
  { id: "panda", name: "Bamboo Panda", kind: "pet", footprint: [0.30, 0.38], placement: "pet", variants: 3, note: "Round panda cub; standing, sitting with bamboo, or lounging." },
  { id: "tiger", name: "Plush Tiger Cub", kind: "pet", footprint: [0.36, 0.48], placement: "pet", variants: 3, note: "Plush-sized striped tiger cub with fluffy cheeks and long striped tail." },
  { id: "owl", name: "Study Owl", kind: "pet", footprint: [0.24, 0.26], placement: "pet", variants: 3, note: "Plump tufted owl with heart facial disc and scalloped belly feathers." }
];
// Cozy Dorm Room Diorama — Mythical Companion Creatures
// Plain ES module for three.js r160. No imports, no globals.

const DEFAULT_PALETTES = {
  westernDragon: { fur: 0x3f8f72, furAccent: 0xf0d699, eye: 0xf5a623, glow: 0xffb347 },
  easternDragon: { fur: 0x4ca696, furAccent: 0xf2c86b, eye: 0xd94e3b, glow: 0xffe484 },
  unicorn: { fur: 0xf7f3f0, furAccent: 0xd8b4e2, eye: 0x5c7cfa, glow: 0xf0d6ff },
  phoenix: { fur: 0xd94b38, furAccent: 0xffc145, eye: 0x2b1d1d, glow: 0xff8c32 },
  pegasus: { fur: 0xf4f6fa, furAccent: 0x9ec5f0, eye: 0x4a6fa5, glow: 0xd0e6ff },
  griffin: { fur: 0xd9a85b, furAccent: 0xf5ede0, eye: 0xd97b1e, glow: 0xffe099 },
  kirin: { fur: 0x7cb8a8, furAccent: 0xf7c768, eye: 0x3b6e5c, glow: 0xffcf6e },
  nineTailFox: { fur: 0xfaf2e8, furAccent: 0xe36b54, eye: 0x3b2323, glow: 0xffa88c },
  jadeRabbit: { fur: 0xe6f5ec, furAccent: 0x94d9b5, eye: 0x2e6b54, glow: 0x8cffbe },
  moonMoth: { fur: 0xebe6f5, furAccent: 0x8cc9c4, eye: 0x231d33, glow: 0xd9f7ff },
  kitsuneLantern: { fur: 0xe8834a, furAccent: 0xfff3e0, eye: 0x2e1c16, glow: 0xffb454 },
  baku: { fur: 0x6b6f94, furAccent: 0xe8dff0, eye: 0x262436, glow: 0xc2b8ff },
  kelpie: { fur: 0x3c8d94, furAccent: 0x9de6db, eye: 0x1b4754, glow: 0x7ef2e6 },
  thunderbird: { fur: 0x495c78, furAccent: 0xffcf40, eye: 0xffe066, glow: 0x80d8ff },
  seaSerpent: { fur: 0x2f7d8a, furAccent: 0x8fe3cf, eye: 0xffb84d, glow: 0x70f0ff },
  jackalope: { fur: 0xb5855e, furAccent: 0xf2e4d5, eye: 0x362318, glow: 0xffe3b3 }
};

function mergeOpts(id, opts) {
  const def = DEFAULT_PALETTES[id];
  const o = opts || {};
  return {
    fur: o.fur !== undefined ? o.fur : def.fur,
    furAccent: o.furAccent !== undefined ? o.furAccent : def.furAccent,
    eye: o.eye !== undefined ? o.eye : def.eye,
    glow: o.glow !== undefined ? o.glow : def.glow,
    variant: o.variant === 1 || o.variant === 2 ? o.variant : 0,
    accessory: o.accessory || "none"
  };
}

function makeMat(THREE, color, cfg) {
  const c = cfg || {};
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: c.roughness !== undefined ? c.roughness : 0.72,
    metalness: c.metalness !== undefined ? c.metalness : 0.05
  });
  if (c.emissive !== undefined) {
    mat.emissive = new THREE.Color(c.emissive);
    mat.emissiveIntensity = c.emissiveIntensity !== undefined ? c.emissiveIntensity : 0.6;
  }
  return mat;
}

function makePaletteMats(THREE, o) {
  return {
    fur: makeMat(THREE, o.fur, { roughness: 0.78, metalness: 0.02 }),
    furAccent: makeMat(THREE, o.furAccent, { roughness: 0.72, metalness: 0.04 }),
    eye: makeMat(THREE, o.eye, { roughness: 0.12, metalness: 0.1 }),
    highlight: makeMat(THREE, 0xffffff, { roughness: 0.05, metalness: 0.0, emissive: 0xffffff, emissiveIntensity: 0.35 }),
    nose: makeMat(THREE, 0x3b2c2c, { roughness: 0.4, metalness: 0.05 }),
    wood: makeMat(THREE, 0x6b4f3a, { roughness: 0.7, metalness: 0.05 }),
    secondary: makeMat(THREE, 0xe8dec8, { roughness: 0.55, metalness: 0.08 }),
    accent: makeMat(THREE, 0xe6a139, { roughness: 0.45, metalness: 0.18 }),
    metal: makeMat(THREE, 0xe3be64, { roughness: 0.28, metalness: 0.75 }),
    fabric: makeMat(THREE, 0xd65a5a, { roughness: 0.85, metalness: 0.02 }),
    skin: makeMat(THREE, 0xf2c6b8, { roughness: 0.68, metalness: 0.02 }),
    glow: makeMat(THREE, o.glow, { roughness: 0.25, metalness: 0.05, emissive: o.glow, emissiveIntensity: 0.85 })
  };
}

function addMesh(THREE, parent, geo, mat, slot, pos, rot, scale) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  if (slot) m.userData.slot = slot;
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  if (scale) {
    if (Array.isArray(scale)) m.scale.set(scale[0], scale[1], scale[2]);
    else m.scale.setScalar(scale);
  }
  parent.add(m);
  return m;
}

function addGlowLight(THREE, parent, color, pos, intensity, distance) {
  const light = new THREE.PointLight(color, intensity || 0.45, distance || 0.9, 2);
  light.name = "glow";
  light.position.set(pos[0], pos[1], pos[2]);
  light.userData.baseIntensity = light.intensity;
  parent.add(light);
  return light;
}

function addEyes(THREE, head, mats, opts) {
  const sep = opts.sep || 0.036;
  const y = opts.y || 0.01;
  const z = opts.z || 0.055;
  const r = opts.r || 0.014;
  const eyeGeo = new THREE.SphereGeometry(r, 14, 12);
  const hlGeo = new THREE.SphereGeometry(r * 0.34, 8, 8);
  for (const s of [-1, 1]) {
    const e = addMesh(THREE, head, eyeGeo, mats.eye, "accent", [s * sep, y, z], null, [1, 1.08, 0.85]);
    e.userData.isEye = true;
    const h = addMesh(THREE, e, hlGeo, mats.highlight, "primary", [s * r * 0.22, r * 0.32, r * 0.78]);
    h.castShadow = false;
  }
}

function addAccessory(THREE, parent, accessory, mats, pos, neckR) {
  if (!accessory || accessory === "none") return;
  const g = new THREE.Group();
  g.name = "accessory";
  g.position.set(pos[0], pos[1], pos[2]);
  const r = neckR || 0.042;

  if (accessory === "scarf") {
    addMesh(THREE, g, new THREE.TorusGeometry(r, r * 0.26, 10, 22), mats.fabric, "fabric", [0, 0, 0], [Math.PI / 2, 0, 0]);
    const tailGeo = new THREE.CapsuleGeometry(r * 0.18, r * 0.75, 6, 10);
    addMesh(THREE, g, tailGeo, mats.fabric, "fabric", [r * 0.35, -r * 0.55, r * 0.82], [0.28, 0.1, -0.25]);
    addMesh(THREE, g, tailGeo, mats.furAccent, "furAccent", [r * 0.12, -r * 0.45, r * 0.92], [0.35, -0.1, 0.12], [0.85, 0.8, 0.85]);
  } else if (accessory === "bow") {
    addMesh(THREE, g, new THREE.TorusGeometry(r * 0.96, r * 0.11, 8, 20), mats.fabric, "fabric", [0, 0, 0], [Math.PI / 2, 0, 0]);
    const bowG = new THREE.Group();
    bowG.position.set(0, -r * 0.08, r * 1.02);
    addMesh(THREE, bowG, new THREE.SphereGeometry(r * 0.2, 10, 8), mats.fabric, "fabric", [0, 0, 0]);
    const loopGeo = new THREE.SphereGeometry(r * 0.34, 10, 8);
    addMesh(THREE, bowG, loopGeo, mats.fabric, "fabric", [-r * 0.32, 0.002, -0.002], [0, 0.15, 0.22], [1.1, 0.75, 0.45]);
    addMesh(THREE, bowG, loopGeo, mats.fabric, "fabric", [r * 0.32, 0.002, -0.002], [0, -0.15, -0.22], [1.1, 0.75, 0.45]);
    const ribGeo = new THREE.CapsuleGeometry(r * 0.09, r * 0.36, 4, 8);
    addMesh(THREE, bowG, ribGeo, mats.fabric, "fabric", [-r * 0.14, -r * 0.32, 0], [0.15, 0, -0.25]);
    addMesh(THREE, bowG, ribGeo, mats.fabric, "fabric", [r * 0.14, -r * 0.32, 0], [0.15, 0, 0.25]);
    g.add(bowG);
  } else if (accessory === "bell") {
    addMesh(THREE, g, new THREE.TorusGeometry(r * 0.98, r * 0.12, 8, 20), mats.fabric, "fabric", [0, 0, 0], [Math.PI / 2, 0, 0]);
    addMesh(THREE, g, new THREE.SphereGeometry(r * 0.3, 12, 10), mats.metal, "metal", [0, -r * 0.22, r * 1.02]);
    addMesh(THREE, g, new THREE.TorusGeometry(r * 0.29, r * 0.04, 6, 14), mats.metal, "metal", [0, -r * 0.22, r * 1.02], [Math.PI / 2, 0, 0]);
    addMesh(THREE, g, new THREE.SphereGeometry(r * 0.09, 8, 6), mats.wood, "wood", [0, -r * 0.46, r * 1.02]);
  }
  parent.add(g);
}

function makeBatWingGeo(THREE, scale) {
  const s = scale || 1;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.05 * s, 0.08 * s, 0.14 * s, 0.11 * s);
  shape.quadraticCurveTo(0.19 * s, 0.06 * s, 0.2 * s, 0.01 * s);
  shape.quadraticCurveTo(0.15 * s, 0.02 * s, 0.12 * s, -0.04 * s);
  shape.quadraticCurveTo(0.08 * s, 0.01 * s, 0.05 * s, -0.05 * s);
  shape.quadraticCurveTo(0.02 * s, -0.02 * s, 0, -0.03 * s);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.008 * s,
    bevelEnabled: true,
    bevelThickness: 0.004 * s,
    bevelSize: 0.004 * s,
    bevelSegments: 2
  });
}

function makeFeatherWingGeo(THREE, scale, zigzag) {
  const s = scale || 1;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.07 * s, 0.07 * s, 0.19 * s, 0.08 * s);
  if (zigzag) {
    shape.lineTo(0.22 * s, 0.05 * s);
    shape.lineTo(0.16 * s, 0.03 * s);
    shape.lineTo(0.2 * s, -0.01 * s);
    shape.lineTo(0.13 * s, -0.02 * s);
    shape.lineTo(0.16 * s, -0.06 * s);
    shape.lineTo(0.08 * s, -0.04 * s);
    shape.lineTo(0.09 * s, -0.07 * s);
    shape.lineTo(0.02 * s, -0.04 * s);
  } else {
    shape.quadraticCurveTo(0.21 * s, 0.03 * s, 0.17 * s, 0.01 * s);
    shape.quadraticCurveTo(0.18 * s, -0.02 * s, 0.13 * s, -0.02 * s);
    shape.quadraticCurveTo(0.13 * s, -0.05 * s, 0.08 * s, -0.04 * s);
    shape.quadraticCurveTo(0.06 * s, -0.06 * s, 0.01 * s, -0.03 * s);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.01 * s,
    bevelEnabled: true,
    bevelThickness: 0.005 * s,
    bevelSize: 0.005 * s,
    bevelSegments: 2
  });
}

function makeFlameGeo(THREE, w, h) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(w, h * 0.35, w * 0.35, h * 0.72);
  shape.quadraticCurveTo(w * 0.15, h * 0.9, 0, h);
  shape.quadraticCurveTo(-w * 0.25, h * 0.7, -w * 0.7, h * 0.45);
  shape.quadraticCurveTo(-w * 0.85, h * 0.15, 0, 0);
  return new THREE.ExtrudeGeometry(shape, {
    depth: w * 0.3,
    bevelEnabled: true,
    bevelThickness: w * 0.15,
    bevelSize: w * 0.12,
    bevelSegments: 2
  });
}

function makeFinGeo(THREE, w, h) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(w * 0.9, h * 0.25, w, h * 0.85);
  shape.quadraticCurveTo(w * 0.4, h * 0.95, 0, h * 0.65);
  shape.quadraticCurveTo(-w * 0.4, h * 0.95, -w, h * 0.85);
  shape.quadraticCurveTo(-w * 0.9, h * 0.25, 0, 0);
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.006,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2
  });
}

function makeCrescentGeo(THREE, r) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, r, -Math.PI * 0.62, Math.PI * 0.62, false);
  shape.absarc(r * 0.38, 0, r * 0.74, Math.PI * 0.48, -Math.PI * 0.48, true);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.004,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 2
  });
}

function addAntler(THREE, parent, mat, slot, scale, side) {
  const s = scale || 1;
  const g = new THREE.Group();
  const main = new THREE.CapsuleGeometry(0.0045 * s, 0.045 * s, 4, 8);
  addMesh(THREE, g, main, mat, slot, [side * 0.012 * s, 0.025 * s, -0.005 * s], [-0.15, 0, -side * 0.38]);
  const tine1 = new THREE.CapsuleGeometry(0.0035 * s, 0.024 * s, 4, 8);
  addMesh(THREE, g, tine1, mat, slot, [side * 0.022 * s, 0.04 * s, 0.006 * s], [0.45, 0, -side * 0.2]);
  const tine2 = new THREE.CapsuleGeometry(0.0032 * s, 0.02 * s, 4, 8);
  addMesh(THREE, g, tine2, mat, slot, [side * 0.028 * s, 0.052 * s, -0.012 * s], [-0.35, 0, -side * 0.65]);
  parent.add(g);
  return g;
}

function addSpiralHorn(THREE, parent, mat, slot, len, baseR) {
  const g = new THREE.Group();
  addMesh(THREE, g, new THREE.ConeGeometry(baseR, len, 14), mat, slot, [0, len * 0.5, 0]);
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const r = baseR * (1 - t * 0.78);
    addMesh(THREE, g, new THREE.TorusGeometry(r * 0.95, baseR * 0.16, 6, 12), mat, slot, [0, len * (0.14 + t * 0.72), 0], [Math.PI / 2 + 0.22, 0, t * 2.2]);
  }
  parent.add(g);
  return g;
}

function makeTube(THREE, pts, radius, tubularSegs, radialSegs) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
  return new THREE.TubeGeometry(curve, tubularSegs || 20, radius, radialSegs || 10, false);
}

function finalizeCreature(group, id, variant, opts) {
  group.userData.creature = id;
  group.userData.variant = variant;
  if (opts && opts.floats) group.userData.floats = true;
  group.traverse(obj => {
    if (
      obj.name === "head" ||
      obj.name === "body" ||
      obj.name === "tail" ||
      obj.name === "wingL" ||
      obj.name === "wingR" ||
      obj.name === "horn" ||
      obj.userData.isEye
    ) {
      obj.userData.basePos = obj.position.clone();
      obj.userData.baseRot = obj.rotation.clone();
      obj.userData.baseScale = obj.scale.clone();
    }
    if (obj.isMesh && obj.userData.isGlow && obj.material) {
      obj.userData.baseEmissive = obj.material.emissiveIntensity;
    }
  });
  return group;
}

function buildChibiQuadrupedBody(THREE, body, mats, cfg) {
  const y = cfg.bodyY;
  const r = cfg.bodyR;
  const len = cfg.bodyLen;
  const variant = cfg.variant;
  const legH = cfg.legH;
  const legR = cfg.legR;

  const torsoRotX = variant === 1 ? -0.35 : 0;
  const torsoY = variant === 2 ? r * 0.78 : variant === 1 ? y - 0.015 : y;
  addMesh(THREE, body, new THREE.SphereGeometry(r, 18, 14), mats.fur, "fur", [0, torsoY, 0], [torsoRotX, 0, 0], [0.92, 0.88, len / r]);

  if (cfg.belly) {
    addMesh(THREE, body, new THREE.SphereGeometry(r * 0.78, 14, 12), mats.furAccent, "furAccent", [0, torsoY - r * 0.2, 0.008], [torsoRotX, 0, 0], [0.85, 0.72, (len / r) * 0.9]);
  }

  const legGeo = new THREE.CapsuleGeometry(legR, legH * 0.55, 6, 10);
  const footGeo = new THREE.SphereGeometry(legR * 1.15, 10, 8);
  const fx = r * 0.56;
  const fz = len * 0.55;
  const bz = -len * 0.52;

  for (const s of [-1, 1]) {
    if (variant === 0) {
      addMesh(THREE, body, legGeo, mats.fur, "fur", [s * fx, legH * 0.52, fz]);
      addMesh(THREE, body, legGeo, mats.fur, "fur", [s * fx, legH * 0.52, bz]);
      if (cfg.hooves) {
        addMesh(THREE, body, new THREE.CylinderGeometry(legR * 0.95, legR * 1.05, 0.016, 10), mats.wood, "wood", [s * fx, 0.008, fz]);
        addMesh(THREE, body, new THREE.CylinderGeometry(legR * 0.95, legR * 1.05, 0.016, 10), mats.wood, "wood", [s * fx, 0.008, bz]);
      } else {
        addMesh(THREE, body, footGeo, mats.fur, "fur", [s * fx, legR * 0.85, fz + 0.008], null, [1, 0.75, 1.25]);
        addMesh(THREE, body, footGeo, mats.fur, "fur", [s * fx, legR * 0.85, bz + 0.008], null, [1, 0.75, 1.25]);
      }
    } else if (variant === 1) {
      // Sitting: front legs straight, back legs folded forward
      addMesh(THREE, body, legGeo, mats.fur, "fur", [s * fx * 0.92, legH * 0.55, fz + 0.015], [-0.12, 0, 0]);
      addMesh(THREE, body, legGeo, mats.fur, "fur", [s * (fx + 0.015), legR * 1.1, bz * 0.35], [Math.PI * 0.48, 0, s * 0.15]);
      if (cfg.hooves) {
        addMesh(THREE, body, new THREE.CylinderGeometry(legR * 0.95, legR * 1.05, 0.016, 10), mats.wood, "wood", [s * fx * 0.92, 0.008, fz + 0.02]);
        addMesh(THREE, body, new THREE.CylinderGeometry(legR * 0.95, legR * 1.05, 0.016, 10), mats.wood, "wood", [s * (fx + 0.02), 0.014, bz * 0.35 + legH * 0.45], [Math.PI / 2, 0, 0]);
      } else {
        addMesh(THREE, body, footGeo, mats.fur, "fur", [s * fx * 0.92, legR * 0.82, fz + 0.024], null, [1, 0.75, 1.2]);
        addMesh(THREE, body, footGeo, mats.fur, "fur", [s * (fx + 0.02), legR * 0.82, bz * 0.35 + legH * 0.42], null, [1, 0.75, 1.2]);
      }
    } else {
      // Resting/curled: legs tucked underneath
      addMesh(THREE, body, legGeo, mats.fur, "fur", [s * fx, legR * 0.95, fz * 0.85], [Math.PI * 0.46, 0, -s * 0.2]);
      addMesh(THREE, body, legGeo, mats.fur, "fur", [s * (fx + 0.01), legR * 0.95, bz * 0.75], [Math.PI * 0.48, 0, s * 0.25]);
    }
  }
  return torsoY;
}

// 1. Western Dragon
function westernDragon(THREE, opts) {
  const o = mergeOpts("westernDragon", opts);
  const mats = makePaletteMats(THREE, o);
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";
  const wingL = new THREE.Group();
  wingL.name = "wingL";
  const wingR = new THREE.Group();
  wingR.name = "wingR";
  const horn = new THREE.Group();
  horn.name = "horn";

  const torsoY = buildChibiQuadrupedBody(THREE, body, mats, {
    bodyY: 0.115, bodyR: 0.072, bodyLen: 0.095, legH: 0.072, legR: 0.021, variant: o.variant, belly: false
  });

  // Belly plates
  for (let i = 0; i < 5; i++) {
    const t = (i - 2) * 0.026;
    addMesh(THREE, body, new THREE.CylinderGeometry(0.056, 0.056, 0.014, 14, 1, false, -Math.PI * 0.4, Math.PI * 0.8), mats.furAccent, "furAccent", [0, torsoY - 0.022, t], [0, Math.PI, Math.PI / 2], [0.85, 1, 0.85]);
  }
  // Dorsal spines
  const spineGeo = new THREE.ConeGeometry(0.011, 0.024, 6);
  for (let i = 0; i < 4; i++) {
    addMesh(THREE, body, spineGeo, mats.furAccent, "furAccent", [0, torsoY + 0.062 - i * 0.004, 0.035 - i * 0.032], [-0.35, 0, 0]);
  }

  // Head
  const headY = o.variant === 2 ? 0.125 : o.variant === 1 ? 0.215 : 0.205;
  const headZ = o.variant === 2 ? 0.105 : 0.095;
  head.position.set(0, headY, headZ);
  if (o.variant === 2) head.rotation.set(0.22, 0.25, 0.08);
  addMesh(THREE, head, new THREE.SphereGeometry(0.068, 18, 14), mats.fur, "fur", [0, 0, 0], null, [1.04, 0.96, 1.05]);
  // Snout
  addMesh(THREE, head, new THREE.SphereGeometry(0.042, 14, 12), mats.fur, "fur", [0, -0.012, 0.056], null, [1.05, 0.78, 1.1]);
  addMesh(THREE, head, new THREE.SphereGeometry(0.006, 8, 6), mats.nose, "wood", [-0.015, -0.002, 0.095]);
  addMesh(THREE, head, new THREE.SphereGeometry(0.006, 8, 6), mats.nose, "wood", [0.015, -0.002, 0.095]);
  addEyes(THREE, head, mats, { sep: 0.038, y: 0.012, z: 0.052, r: 0.015 });

  // Horns
  for (const s of [-1, 1]) {
    addMesh(THREE, horn, new THREE.ConeGeometry(0.014, 0.068, 10), mats.secondary, "secondary", [s * 0.036, 0.068, -0.022], [-0.65, 0, -s * 0.35]);
    addMesh(THREE, head, new THREE.ConeGeometry(0.012, 0.026, 8), mats.fur, "fur", [s * 0.062, 0.015, -0.012], [0, 0, -s * 1.1]);
  }
  head.add(horn);

  // Bat wings
  const wGeo = makeBatWingGeo(THREE, 0.92);
  addMesh(THREE, wingL, wGeo, mats.furAccent, "furAccent", [0, 0, 0], [0, -0.25, 0]);
  addMesh(THREE, wingL, new THREE.CapsuleGeometry(0.007, 0.13, 4, 8), mats.fur, "fur", [0.068, 0.055, 0.005], [0, 0, -0.95]);
  wingL.position.set(0.052, torsoY + 0.035, 0.01);
  wingL.rotation.set(0.15, -0.35, o.variant === 2 ? -0.45 : 0.12);

  addMesh(THREE, wingR, wGeo, mats.furAccent, "furAccent", [0, 0, 0], [0, Math.PI + 0.25, 0]);
  addMesh(THREE, wingR, new THREE.CapsuleGeometry(0.007, 0.13, 4, 8), mats.fur, "fur", [-0.068, 0.055, 0.005], [0, 0, 0.95]);
  wingR.position.set(-0.052, torsoY + 0.035, 0.01);
  wingR.rotation.set(0.15, 0.35, o.variant === 2 ? 0.45 : -0.12);

  // Thick tail
  tail.position.set(0, torsoY - 0.01, -0.075);
  const tPts = o.variant === 2
    ? [[0, 0, 0], [0.06, -0.02, -0.06], [0.12, -0.03, 0.01], [0.1, -0.03, 0.08]]
    : [[0, 0, 0], [0.01, -0.02, -0.06], [0.03, 0.01, -0.13], [0.05, 0.045, -0.17]];
  addMesh(THREE, tail, makeTube(THREE, tPts, 0.024, 18, 10), mats.fur, "fur");
  const tipP = tPts[tPts.length - 1];
  addMesh(THREE, tail, makeFlameGeo(THREE, 0.024, 0.048), mats.furAccent, "furAccent", [tipP[0], tipP[1], tipP[2]], [-0.8, 0, 0]);

  addAccessory(THREE, body, o.accessory, mats, [0, headY - 0.058, headZ - 0.022], 0.046);
  root.add(body, head, tail, wingL, wingR);
  return finalizeCreature(root, "westernDragon", o.variant);
}

// 2. Eastern Dragon
function easternDragon(THREE, opts) {
  const o = mergeOpts("easternDragon", opts);
  const mats = makePaletteMats(THREE, o);
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";
  const horn = new THREE.Group();
  horn.name = "horn";

  const pts = o.variant === 0
    ? [[0, 0.21, 0.14], [0.065, 0.16, 0.05], [-0.065, 0.12, -0.05], [0.045, 0.15, -0.15]]
    : o.variant === 1
      ? [[0, 0.26, 0.08], [0.06, 0.19, 0.02], [0.02, 0.11, -0.06], [-0.06, 0.08, 0.01]]
      : [[0.04, 0.12, 0.11], [0.11, 0.07, 0.01], [0.02, 0.06, -0.1], [-0.09, 0.07, -0.02]];

  addMesh(THREE, body, makeTube(THREE, pts, 0.038, 30, 14), mats.fur, "fur");
  // Mane puffs along neck & spine
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
  for (let i = 0; i < 9; i++) {
    const p = curve.getPoint(i / 8);
    addMesh(THREE, body, new THREE.SphereGeometry(0.022 - i * 0.001, 10, 8), mats.furAccent, "furAccent", [p.x, p.y + 0.032, p.z], null, [0.8, 1.1, 1.2]);
  }
  // Small clawed feet
  const pFront = curve.getPoint(0.28);
  const pBack = curve.getPoint(0.72);
  const legGeo = new THREE.CapsuleGeometry(0.012, 0.032, 4, 8);
  for (const s of [-1, 1]) {
    addMesh(THREE, body, legGeo, mats.fur, "fur", [pFront.x + s * 0.034, pFront.y - 0.032, pFront.z + 0.01], [0.3, 0, s * 0.35]);
    addMesh(THREE, body, legGeo, mats.fur, "fur", [pBack.x + s * 0.034, pBack.y - 0.032, pBack.z], [-0.2, 0, s * 0.35]);
  }

  // Glowing pearl
  const pearlPos = o.variant === 2 ? [0, 0.06, 0.01] : [0, 0.13, 0.185];
  const pearl = addMesh(THREE, body, new THREE.SphereGeometry(0.026, 16, 12), mats.glow, "accent", pearlPos);
  pearl.userData.isGlow = true;
  addGlowLight(THREE, body, o.glow, pearlPos, 0.55, 0.9);

  // Head
  const hp = pts[0];
  head.position.set(hp[0], hp[1] + 0.02, hp[2] + 0.035);
  addMesh(THREE, head, new THREE.SphereGeometry(0.056, 16, 14), mats.fur, "fur", [0, 0, 0], null, [0.95, 0.9, 1.15]);
  addMesh(THREE, head, new THREE.SphereGeometry(0.036, 14, 10), mats.fur, "fur", [0, -0.008, 0.052], null, [1.0, 0.72, 1.1]);
  addEyes(THREE, head, mats, { sep: 0.034, y: 0.012, z: 0.044, r: 0.013 });
  // Whiskers
  for (const s of [-1, 1]) {
    const wPts = [[s * 0.024, -0.012, 0.072], [s * 0.068, -0.005, 0.05], [s * 0.095, 0.018, -0.005]];
    addMesh(THREE, head, makeTube(THREE, wPts, 0.0045, 12, 6), mats.furAccent, "furAccent");
    addAntler(THREE, horn, mats.secondary, "secondary", 0.95, s);
  }
  horn.position.set(0, 0.042, -0.012);
  head.add(horn);

  // Tail tuft
  const tp = pts[pts.length - 1];
  tail.position.set(tp[0], tp[1], tp[2]);
  addMesh(THREE, tail, makeTube(THREE, [[0, 0, 0], [0.02, 0.02, -0.055], [-0.01, 0.05, -0.095]], 0.02, 12, 8), mats.fur, "fur");
  addMesh(THREE, tail, makeFlameGeo(THREE, 0.03, 0.068), mats.furAccent, "furAccent", [-0.01, 0.05, -0.095], [-0.7, 0, 0]);

  addAccessory(THREE, body, o.accessory, mats, [hp[0], hp[1] - 0.015, hp[2] + 0.008], 0.042);
  root.add(body, head, tail);
  return finalizeCreature(root, "easternDragon", o.variant, { floats: o.variant !== 2 });
}

function buildChibiHorse(THREE, id, opts, config) {
  const o = mergeOpts(id, opts);
  const mats = makePaletteMats(THREE, o);
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";

  const torsoY = buildChibiQuadrupedBody(THREE, body, mats, {
    bodyY: 0.135, bodyR: 0.066, bodyLen: 0.092, legH: 0.092, legR: 0.016, variant: o.variant, hooves: true
  });

  // Neck
  const neckY = o.variant === 2 ? torsoY + 0.042 : torsoY + 0.065;
  addMesh(THREE, body, new THREE.CapsuleGeometry(0.032, 0.055, 6, 12), mats.fur, "fur", [0, neckY, 0.065], [0.35, 0, 0]);

  // Flowing mane
  for (let i = 0; i < 4; i++) {
    addMesh(THREE, body, new THREE.SphereGeometry(0.026 - i * 0.002, 12, 10), mats.furAccent, "furAccent", [0, neckY + 0.042 - i * 0.022, 0.045 - i * 0.016], null, [0.75, 1.0, 1.3]);
  }

  // Head
  head.position.set(0, neckY + 0.062, 0.095);
  if (o.variant === 2) head.rotation.set(0.28, 0.18, 0);
  addMesh(THREE, head, new THREE.SphereGeometry(0.06, 18, 14), mats.fur, "fur", [0, 0, 0], null, [0.92, 0.96, 1.08]);
  addMesh(THREE, head, new THREE.SphereGeometry(0.036, 14, 12), mats.fur, "fur", [0, -0.014, 0.052], null, [0.95, 0.82, 1.15]);
  addMesh(THREE, head, new THREE.SphereGeometry(0.026, 10, 8), mats.furAccent, "furAccent", [0, 0.048, 0.024], [0.4, 0, 0], [0.9, 0.7, 1.3]);
  addEyes(THREE, head, mats, { sep: 0.036, y: 0.012, z: 0.045, r: 0.014 });

  // Ears
  for (const s of [-1, 1]) {
    addMesh(THREE, head, new THREE.ConeGeometry(0.014, 0.042, 8), mats.fur, "fur", [s * 0.032, 0.062, -0.005], [0.1, 0, -s * 0.25]);
  }

  // Spiral horn for unicorn
  if (config.hasHorn) {
    const horn = new THREE.Group();
    horn.name = "horn";
    horn.position.set(0, 0.05, 0.038);
    horn.rotation.set(0.45, 0, 0);
    const hMat = mats.glow;
    addSpiralHorn(THREE, horn, hMat, "accent", 0.095, 0.013);
    horn.traverse(c => { if (c.isMesh) c.userData.isGlow = true; });
    addGlowLight(THREE, horn, o.glow, [0, 0.075, 0], 0.35, 0.7);
    head.add(horn);
  }

  // Feathered wings for pegasus
  if (config.hasWings) {
    const wingL = new THREE.Group();
    wingL.name = "wingL";
    const wingR = new THREE.Group();
    wingR.name = "wingR";
    const wGeo = makeFeatherWingGeo(THREE, 0.95, false);
    const wGeo2 = makeFeatherWingGeo(THREE, 0.7, false);
    addMesh(THREE, wingL, wGeo, mats.fur, "fur", [0, 0, 0]);
    addMesh(THREE, wingL, wGeo2, mats.furAccent, "furAccent", [0.01, -0.012, 0.008]);
    wingL.position.set(0.052, torsoY + 0.035, 0.01);
    wingL.rotation.set(0.15, -0.45, o.variant === 2 ? -0.4 : 0.22);

    addMesh(THREE, wingR, wGeo, mats.fur, "fur", [0, 0, 0], [0, Math.PI, 0]);
    addMesh(THREE, wingR, wGeo2, mats.furAccent, "furAccent", [-0.01, -0.012, 0.008], [0, Math.PI, 0]);
    wingR.position.set(-0.052, torsoY + 0.035, 0.01);
    wingR.rotation.set(0.15, 0.45, o.variant === 2 ? 0.4 : -0.22);
    root.add(wingL, wingR);
  }

  // Flowing tail
  tail.position.set(0, torsoY + 0.012, -0.088);
  const tPts = [[0, 0, 0], [0, -0.015, -0.055], [0.01, -0.065, -0.085], [0.015, -0.1, -0.065]];
  addMesh(THREE, tail, makeTube(THREE, tPts, 0.022, 16, 10), mats.furAccent, "furAccent");
  addMesh(THREE, tail, new THREE.SphereGeometry(0.028, 12, 10), mats.furAccent, "furAccent", [0.012, -0.075, -0.075], null, [0.9, 1.35, 0.9]);

  addAccessory(THREE, body, o.accessory, mats, [0, neckY + 0.01, 0.072], 0.038);
  root.add(body, head, tail);
  return finalizeCreature(root, id, o.variant);
}

// 3. Unicorn
function unicorn(THREE, opts) {
  return buildChibiHorse(THREE, "unicorn", opts, { hasHorn: true, hasWings: false });
}

// 4. Phoenix
function phoenix(THREE, opts) {
  const o = mergeOpts("phoenix", opts);
  const mats = makePaletteMats(THREE, o);
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";
  const wingL = new THREE.Group();
  wingL.name = "wingL";
  const wingR = new THREE.Group();
  wingR.name = "wingR";

  const bodyY = o.variant === 2 ? 0.075 : o.variant === 1 ? 0.095 : 0.125;
  addMesh(THREE, body, new THREE.SphereGeometry(0.068, 18, 14), mats.fur, "fur", [0, bodyY, 0], [-0.25, 0, 0], [0.95, 1.05, 1.18]);
  addMesh(THREE, body, new THREE.SphereGeometry(0.054, 14, 12), mats.furAccent, "furAccent", [0, bodyY - 0.008, 0.032], null, [0.9, 0.95, 0.78]);

  // Bird legs
  if (o.variant !== 2) {
    const legH = o.variant === 1 ? 0.042 : 0.068;
    for (const s of [-1, 1]) {
      addMesh(THREE, body, new THREE.CylinderGeometry(0.007, 0.006, legH, 8), mats.accent, "accent", [s * 0.026, legH * 0.5, 0.008]);
      for (const a of [-0.45, 0, 0.45]) {
        addMesh(THREE, body, new THREE.CapsuleGeometry(0.005, 0.022, 4, 6), mats.accent, "accent", [s * 0.026 + Math.sin(a) * 0.012, 0.006, 0.022], [Math.PI / 2, 0, -a]);
      }
    }
  }

  // Head + crest
  head.position.set(0, bodyY + 0.092, 0.048);
  if (o.variant === 2) head.rotation.set(0.25, 0.2, 0);
  addMesh(THREE, head, new THREE.SphereGeometry(0.055, 16, 14), mats.fur, "fur");
  addMesh(THREE, head, new THREE.ConeGeometry(0.018, 0.038, 10), mats.accent, "accent", [0, -0.008, 0.062], [Math.PI * 0.56, 0, 0]);
  addEyes(THREE, head, mats, { sep: 0.034, y: 0.008, z: 0.04, r: 0.013 });

  // 3-plume glowing crest
  for (let i = -1; i <= 1; i++) {
    const c = addMesh(THREE, head, makeFlameGeo(THREE, 0.015, 0.068 - Math.abs(i) * 0.014), mats.glow, "furAccent", [i * 0.012, 0.045, -0.008], [-0.55, i * 0.25, i * 0.2]);
    c.userData.isGlow = true;
  }

  // Wings with glowing tips
  const wGeo = makeFeatherWingGeo(THREE, 0.95, false);
  const tipGeo = makeFlameGeo(THREE, 0.02, 0.055);
  for (const [wg, s] of [[wingL, 1], [wingR, -1]]) {
    addMesh(THREE, wg, wGeo, mats.fur, "fur", [0, 0, 0], [0, s === 1 ? 0 : Math.PI, 0]);
    const t = addMesh(THREE, wg, tipGeo, mats.glow, "furAccent", [s * 0.165, 0.045, 0.006], [0, 0, -s * 1.15]);
    t.userData.isGlow = true;
    wg.position.set(s * 0.058, bodyY + 0.025, 0.005);
    wg.rotation.set(0.15, -s * 0.55, s * (o.variant === 2 ? -0.45 : 0.18));
  }

  // Long sweeping tail plumes
  tail.position.set(0, bodyY - 0.015, -0.068);
  for (let i = -1; i <= 1; i++) {
    const tPts = [[0, 0, 0], [i * 0.035, 0.015, -0.075], [i * 0.065, 0.045 - Math.abs(i) * 0.015, -0.155], [i * 0.08, 0.01, -0.21]];
    addMesh(THREE, tail, makeTube(THREE, tPts, 0.009, 16, 8), mats.furAccent, "furAccent");
    const last = tPts[tPts.length - 1];
    const pl = addMesh(THREE, tail, makeFlameGeo(THREE, 0.024, 0.06), mats.glow, "furAccent", last, [-1.15, i * 0.25, 0]);
    pl.userData.isGlow = true;
  }

  addGlowLight(THREE, body, o.glow, [0, bodyY + 0.06, -0.05], 0.55, 1.0);
  addAccessory(THREE, body, o.accessory, mats, [0, bodyY + 0.052, 0.042], 0.038);
  root.add(body, head, tail, wingL, wingR);
  return finalizeCreature(root, "phoenix", o.variant);
}

// 5. Pegasus
function pegasus(THREE, opts) {
  return buildChibiHorse(THREE, "pegasus", opts, { hasHorn: false, hasWings: true });
}

// 6. Griffin
function griffin(THREE, opts) {
  const o = mergeOpts("griffin", opts);
  const mats = makePaletteMats(THREE, o);
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";
  const wingL = new THREE.Group();
  wingL.name = "wingL";
  const wingR = new THREE.Group();
  wingR.name = "wingR";

  const torsoY = buildChibiQuadrupedBody(THREE, body, mats, {
    bodyY: 0.118, bodyR: 0.068, bodyLen: 0.095, legH: 0.075, legR: 0.019, variant: o.variant, belly: false
  });
  // Feathered chest ruff
  addMesh(THREE, body, new THREE.SphereGeometry(0.066, 16, 12), mats.furAccent, "furAccent", [0, torsoY + 0.025, 0.058], null, [1.02, 1.05, 0.85]);

  // Eagle head
  const headY = o.variant === 2 ? 0.145 : 0.215;
  head.position.set(0, headY, 0.092);
  if (o.variant === 2) head.rotation.set(0.24, 0.15, 0);
  addMesh(THREE, head, new THREE.SphereGeometry(0.06, 18, 14), mats.furAccent, "furAccent");
  // Hooked eagle beak
  addMesh(THREE, head, new THREE.ConeGeometry(0.022, 0.045, 10), mats.accent, "accent", [0, -0.008, 0.062], [Math.PI * 0.56, 0, 0]);
  addMesh(THREE, head, new THREE.ConeGeometry(0.011, 0.022, 8), mats.accent, "accent", [0, -0.02, 0.078], [Math.PI * 0.88, 0, 0]);
  addEyes(THREE, head, mats, { sep: 0.036, y: 0.012, z: 0.044, r: 0.014 });
  // Ear tufts
  for (const s of [-1, 1]) {
    addMesh(THREE, head, new THREE.ConeGeometry(0.015, 0.042, 8), mats.furAccent, "furAccent", [s * 0.042, 0.052, -0.015], [-0.45, 0, -s * 0.45]);
  }

  // Eagle wings
  const wGeo = makeFeatherWingGeo(THREE, 0.92, false);
  for (const [wg, s] of [[wingL, 1], [wingR, -1]]) {
    addMesh(THREE, wg, wGeo, mats.furAccent, "furAccent", [0, 0, 0], [0, s === 1 ? 0 : Math.PI, 0]);
    wg.position.set(s * 0.055, torsoY + 0.038, 0.01);
    wg.rotation.set(0.15, -s * 0.42, s * (o.variant === 2 ? -0.4 : 0.2));
  }

  // Lion tail
  tail.position.set(0, torsoY + 0.005, -0.088);
  const tPts = [[0, 0, 0], [0, -0.025, -0.055], [0.02, 0.015, -0.115], [0.03, 0.055, -0.135]];
  addMesh(THREE, tail, makeTube(THREE, tPts, 0.011, 16, 8), mats.fur, "fur");
  addMesh(THREE, tail, new THREE.SphereGeometry(0.026, 12, 10), mats.furAccent, "furAccent", [0.03, 0.062, -0.14], null, [0.9, 1.25, 0.9]);

  addAccessory(THREE, body, o.accessory, mats, [0, headY - 0.052, 0.072], 0.046);
  root.add(body, head, tail, wingL, wingR);
  return finalizeCreature(root, "griffin", o.variant);
}

// 7. Kirin
function kirin(THREE, opts) {
  const o = mergeOpts("kirin", opts);
  const mats = makePaletteMats(THREE, o);
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";
  const horn = new THREE.Group();
  horn.name = "horn";

  const torsoY = buildChibiQuadrupedBody(THREE, body, mats, {
    bodyY: 0.14, bodyR: 0.062, bodyLen: 0.09, legH: 0.098, legR: 0.014, variant: o.variant, hooves: true
  });
  // Scaled dorsal plates
  for (let i = 0; i < 5; i++) {
    addMesh(THREE, body, new THREE.SphereGeometry(0.022, 10, 8), mats.furAccent, "furAccent", [0, torsoY + 0.052, 0.04 - i * 0.024], null, [1.2, 0.35, 0.9]);
  }
  // Flame tufts at shoulders
  const tuftGeo = makeFlameGeo(THREE, 0.018, 0.048);
  for (const s of [-1, 1]) {
    const f = addMesh(THREE, body, tuftGeo, mats.glow, "furAccent", [s * 0.058, torsoY + 0.01, 0.045], [-0.4, s * 0.5, -s * 0.65]);
    f.userData.isGlow = true;
  }

  // Slender neck + deer head
  const neckY = o.variant === 2 ? torsoY + 0.048 : torsoY + 0.072;
  addMesh(THREE, body, new THREE.CapsuleGeometry(0.026, 0.062, 6, 10), mats.fur, "fur", [0, neckY, 0.062], [0.28, 0, 0]);
  head.position.set(0, neckY + 0.068, 0.088);
  if (o.variant === 2) head.rotation.set(0.24, 0.18, 0);
  addMesh(THREE, head, new THREE.SphereGeometry(0.055, 16, 14), mats.fur, "fur", [0, 0, 0], null, [0.9, 0.94, 1.12]);
  addMesh(THREE, head, new THREE.SphereGeometry(0.03, 12, 10), mats.fur, "fur", [0, -0.012, 0.052], null, [0.9, 0.78, 1.15]);
  addEyes(THREE, head, mats, { sep: 0.034, y: 0.012, z: 0.042, r: 0.013 });
  for (const s of [-1, 1]) {
    addMesh(THREE, head, new THREE.ConeGeometry(0.014, 0.045, 8), mats.fur, "fur", [s * 0.036, 0.054, -0.008], [0, 0, -s * 0.48]);
  }

  // Single branched horn
  horn.position.set(0, 0.05, 0.022);
  addMesh(THREE, horn, new THREE.CapsuleGeometry(0.007, 0.065, 6, 8), mats.accent, "accent", [0, 0.035, 0], [-0.28, 0, 0]);
  addMesh(THREE, horn, new THREE.CapsuleGeometry(0.005, 0.03, 4, 8), mats.accent, "accent", [0.014, 0.052, 0.005], [0.25, 0, -0.55]);
  addMesh(THREE, horn, new THREE.CapsuleGeometry(0.005, 0.026, 4, 8), mats.accent, "accent", [-0.012, 0.062, -0.008], [-0.35, 0, 0.5]);
  head.add(horn);

  // Flame-tufted tail
  tail.position.set(0, torsoY + 0.01, -0.085);
  addMesh(THREE, tail, makeTube(THREE, [[0, 0, 0], [0, 0.02, -0.05], [0, 0.055, -0.085]], 0.01, 12, 8), mats.fur, "fur");
  const tf = addMesh(THREE, tail, makeFlameGeo(THREE, 0.026, 0.065), mats.glow, "furAccent", [0, 0.055, -0.085], [-0.6, 0, 0]);
  tf.userData.isGlow = true;

  addGlowLight(THREE, body, o.glow, [0, torsoY + 0.08, 0.02], 0.42, 0.85);
  addAccessory(THREE, body, o.accessory, mats, [0, neckY + 0.012, 0.068], 0.033);
  root.add(body, head, tail);
  return finalizeCreature(root, "kirin", o.variant);
}

// 8. Nine-Tail Fox
function nineTailFox(THREE, opts) {
  const o = mergeOpts("nineTailFox", opts);
  const mats = makePaletteMats(THREE, o);
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";

  const torsoY = buildChibiQuadrupedBody(THREE, body, mats, {
    bodyY: 0.105, bodyR: 0.062, bodyLen: 0.086, legH: 0.068, legR: 0.016, variant: o.variant, belly: true
  });
  // Chest ruff
  addMesh(THREE, body, new THREE.SphereGeometry(0.054, 14, 12), mats.furAccent, "furAccent", [0, torsoY + 0.015, 0.058], null, [1.05, 0.95, 0.78]);

  // Fox head
  const headY = o.variant === 2 ? 0.125 : 0.195;
  head.position.set(0, headY, 0.086);
  if (o.variant === 2) head.rotation.set(0.22, 0.25, 0.08);
  addMesh(THREE, head, new THREE.SphereGeometry(0.06, 18, 14), mats.fur, "fur", [0, 0, 0], null, [1.1, 0.94, 1.0]);
  // Pointed muzzle
  addMesh(THREE, head, new THREE.ConeGeometry(0.028, 0.055, 12), mats.fur, "fur", [0, -0.014, 0.065], [Math.PI * 0.52, 0, 0]);
  addMesh(THREE, head, new THREE.SphereGeometry(0.008, 8, 8), mats.nose, "wood", [0, -0.014, 0.092]);
  addEyes(THREE, head, mats, { sep: 0.036, y: 0.01, z: 0.048, r: 0.014 });
  // Big fox ears
  for (const s of [-1, 1]) {
    addMesh(THREE, head, new THREE.ConeGeometry(0.025, 0.068, 10), mats.fur, "fur", [s * 0.042, 0.065, -0.005], [0.08, 0, -s * 0.32]);
    addMesh(THREE, head, new THREE.ConeGeometry(0.015, 0.046, 8), mats.furAccent, "furAccent", [s * 0.042, 0.062, 0.006], [0.08, 0, -s * 0.32]);
  }

  // Nine fanned tails
  tail.position.set(0, torsoY + 0.005, -0.072);
  for (let i = 0; i < 9; i++) {
    const u = (i - 4) / 4; // -1 to 1
    const spreadX = u * 0.155;
    const liftY = (1 - u * u * 0.55) * 0.135;
    const backZ = -0.115 - (1 - Math.abs(u)) * 0.035;
    const tPts = [[0, 0, 0], [spreadX * 0.55, liftY * 0.55, backZ * 0.55], [spreadX, liftY, backZ]];
    addMesh(THREE, tail, makeTube(THREE, tPts, 0.019, 14, 8), mats.fur, "fur");
    addMesh(THREE, tail, new THREE.SphereGeometry(0.022, 10, 8), mats.furAccent, "furAccent", [spreadX, liftY + 0.008, backZ - 0.008], null, [0.95, 1.2, 0.95]);
  }

  addAccessory(THREE, body, o.accessory, mats, [0, headY - 0.052, 0.068], 0.042);
  root.add(body, head, tail);
  return finalizeCreature(root, "nineTailFox", o.variant);
}

// 9. Jade Rabbit
function jadeRabbit(THREE, opts) {
  const o = mergeOpts("jadeRabbit", opts);
  const mats = makePaletteMats(THREE, o);
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";

  const bodyY = o.variant === 2 ? 0.068 : 0.088;
  addMesh(THREE, body, new THREE.SphereGeometry(0.072, 18, 14), mats.fur, "fur", [0, bodyY, 0], null, [1.0, o.variant === 2 ? 0.85 : 1.05, 1.05]);
  addMesh(THREE, body, new THREE.SphereGeometry(0.054, 14, 12), mats.furAccent, "furAccent", [0, bodyY - 0.008, 0.036], null, [0.9, 0.9, 0.72]);

  // Hind feet
  for (const s of [-1, 1]) {
    addMesh(THREE, body, new THREE.SphereGeometry(0.026, 12, 10), mats.fur, "fur", [s * 0.046, 0.02, 0.02], null, [0.85, 0.65, 1.45]);
    // Front paws holding mortar
    addMesh(THREE, body, new THREE.CapsuleGeometry(0.015, 0.038, 6, 8), mats.fur, "fur", [s * 0.042, bodyY + 0.005, 0.068], [Math.PI * 0.42, 0, -s * 0.32]);
  }

  // Small glowing jade mortar + pestle
  const bowlPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.028, 0),
    new THREE.Vector2(0.038, 0.024),
    new THREE.Vector2(0.036, 0.048),
    new THREE.Vector2(0.029, 0.048),
    new THREE.Vector2(0.025, 0.016),
    new THREE.Vector2(0, 0.014)
  ];
  const mortar = addMesh(THREE, body, new THREE.LatheGeometry(bowlPts, 18), mats.glow, "furAccent", [0, bodyY - 0.032, 0.095]);
  mortar.userData.isGlow = true;
  addMesh(THREE, body, new THREE.CapsuleGeometry(0.007, 0.048, 6, 8), mats.secondary, "secondary", [0.012, bodyY + 0.012, 0.098], [0.2, 0, -0.42]);
  addGlowLight(THREE, body, o.glow, [0, bodyY + 0.02, 0.1], 0.5, 0.95);

  // Bunny head
  head.position.set(0, bodyY + 0.098, 0.018);
  if (o.variant === 2) head.rotation.set(0.22, 0, 0.12);
  addMesh(THREE, head, new THREE.SphereGeometry(0.064, 18, 14), mats.fur, "fur", [0, 0, 0], null, [1.06, 0.96, 0.98]);
  addMesh(THREE, head, new THREE.SphereGeometry(0.009, 8, 8), mats.skin, "skin", [0, -0.006, 0.064], null, [1.2, 0.85, 0.85]);
  addEyes(THREE, head, mats, { sep: 0.034, y: 0.01, z: 0.052, r: 0.014 });

  // Long rabbit ears
  const earGeo = new THREE.CapsuleGeometry(0.018, 0.082, 8, 12);
  for (const s of [-1, 1]) {
    const tilt = o.variant === 1 && s === 1 ? -0.65 : -s * 0.2;
    addMesh(THREE, head, earGeo, mats.fur, "fur", [s * 0.032, 0.092, -0.006], [-0.1, 0, tilt], [0.85, 1.0, 0.55]);
    addMesh(THREE, head, earGeo, mats.skin, "skin", [s * 0.032, 0.09, 0.002], [-0.1, 0, tilt], [0.5, 0.8, 0.3]);
  }

  // Cotton tail
  tail.position.set(0, bodyY - 0.018, -0.078);
  addMesh(THREE, tail, new THREE.SphereGeometry(0.032, 12, 10), mats.furAccent, "furAccent");

  addAccessory(THREE, body, o.accessory, mats, [0, bodyY + 0.052, 0.022], 0.044);
  root.add(body, head, tail);
  return finalizeCreature(root, "jadeRabbit", o.variant);
}

// 10. Moon Moth
function moonMoth(THREE, opts) {
  const o = mergeOpts("moonMoth", opts);
  const mats = makePaletteMats(THREE, o);
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";
  const wingL = new THREE.Group();
  wingL.name = "wingL";
  const wingR = new THREE.Group();
  wingR.name = "wingR";

  const baseY = o.variant === 2 ? 0.062 : o.variant === 1 ? 0.095 : 0.135;
  // Fluffy thorax & abdomen
  addMesh(THREE, body, new THREE.SphereGeometry(0.056, 16, 14), mats.fur, "fur", [0, baseY, 0.015], null, [1.0, 0.95, 1.15]);
  // Fluffy collar
  addMesh(THREE, body, new THREE.TorusGeometry(0.048, 0.02, 10, 18), mats.furAccent, "furAccent", [0, baseY + 0.018, 0.052], [Math.PI * 0.42, 0, 0]);
  // Tiny tucked legs
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      addMesh(THREE, body, new THREE.CapsuleGeometry(0.006, 0.024, 4, 6), mats.wood, "wood", [s * 0.032, baseY - 0.042, 0.035 - i * 0.025], [0.2, 0, s * 0.35]);
    }
  }

  // Abdomen as "tail"
  tail.position.set(0, baseY - 0.008, -0.042);
  addMesh(THREE, tail, new THREE.SphereGeometry(0.046, 14, 12), mats.fur, "fur", [0, -0.005, -0.035], [0.2, 0, 0], [0.92, 0.85, 1.45]);

  // Head + feathery antennae
  head.position.set(0, baseY + 0.025, 0.082);
  addMesh(THREE, head, new THREE.SphereGeometry(0.048, 16, 14), mats.fur, "fur");
  addEyes(THREE, head, mats, { sep: 0.028, y: 0.004, z: 0.038, r: 0.017 });
  for (const s of [-1, 1]) {
    addMesh(THREE, head, makeTube(THREE, [[s * 0.018, 0.035, 0.015], [s * 0.052, 0.075, 0.028], [s * 0.078, 0.09, 0.012]], 0.005, 10, 6), mats.furAccent, "furAccent");
    for (let j = 0; j < 4; j++) {
      addMesh(THREE, head, new THREE.SphereGeometry(0.008, 6, 6), mats.furAccent, "furAccent", [s * (0.032 + j * 0.013), 0.052 + j * 0.012, 0.022], null, [1.5, 0.5, 0.5]);
    }
  }

  // Moth wings with crescent patterns
  const foreShape = new THREE.Shape();
  foreShape.moveTo(0, 0);
  foreShape.quadraticCurveTo(0.08, 0.095, 0.195, 0.085);
  foreShape.quadraticCurveTo(0.21, 0.01, 0.145, -0.035);
  foreShape.quadraticCurveTo(0.07, -0.04, 0, -0.015);
  foreShape.closePath();
  const foreGeo = new THREE.ExtrudeGeometry(foreShape, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 });

  const hindShape = new THREE.Shape();
  hindShape.moveTo(0, -0.01);
  hindShape.quadraticCurveTo(0.1, -0.015, 0.125, -0.075);
  hindShape.quadraticCurveTo(0.095, -0.14, 0.078, -0.17);
  hindShape.quadraticCurveTo(0.06, -0.12, 0.035, -0.095);
  hindShape.quadraticCurveTo(0.008, -0.06, 0, -0.01);
  hindShape.closePath();
  const hindGeo = new THREE.ExtrudeGeometry(hindShape, { depth: 0.005, bevelEnabled: true, bevelThickness: 0.0025, bevelSize: 0.0025, bevelSegments: 2 });

  const cresGeo = makeCrescentGeo(THREE, 0.026);

  for (const [wg, s] of [[wingL, 1], [wingR, -1]]) {
    const rotY = s === 1 ? 0 : Math.PI;
    addMesh(THREE, wg, foreGeo, mats.furAccent, "furAccent", [0, 0, 0], [0, rotY, 0]);
    addMesh(THREE, wg, hindGeo, mats.fur, "fur", [0, 0, -0.006], [0, rotY, 0]);
    const c1 = addMesh(THREE, wg, cresGeo, mats.glow, "accent", [s * 0.115, 0.03, 0.008], [0, rotY, -0.3]);
    c1.userData.isGlow = true;
    const c2 = addMesh(THREE, wg, cresGeo, mats.glow, "accent", [s * 0.068, -0.055, 0.004], [0, rotY, 0.4], 0.65);
    c2.userData.isGlow = true;
    wg.position.set(s * 0.042, baseY + 0.012, 0.005);
    wg.rotation.set(0.38, -s * 0.15, s * (o.variant === 2 ? -0.25 : 0.15));
  }

  addGlowLight(THREE, body, o.glow, [0, baseY + 0.05, 0.04], 0.48, 0.95);
  addAccessory(THREE, body, o.accessory, mats, [0, baseY + 0.008, 0.058], 0.044);
  root.add(body, head, tail, wingL, wingR);
  return finalizeCreature(root, "moonMoth", o.variant, { floats: o.variant === 0 });
}

// 11. Kitsune Lantern
function kitsuneLantern(THREE, opts) {
  const o = mergeOpts("kitsuneLantern", opts);
  const mats = makePaletteMats(THREE, o);
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";

  // Paper lantern in the center
  const lPts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const r = 0.032 + Math.sin(t * Math.PI) * 0.036;
    lPts.push(new THREE.Vector2(r, t * 0.135));
  }
  const lantern = addMesh(THREE, body, new THREE.LatheGeometry(lPts, 18), mats.glow, "accent", [0, 0.014, 0.01]);
  lantern.userData.isGlow = true;
  // Lantern wooden caps & ribs
  addMesh(THREE, body, new THREE.CylinderGeometry(0.038, 0.04, 0.016, 16), mats.wood, "wood", [0, 0.008, 0.01]);
  addMesh(THREE, body, new THREE.CylinderGeometry(0.036, 0.038, 0.014, 16), mats.wood, "wood", [0, 0.154, 0.01]);
  addMesh(THREE, body, new THREE.TorusGeometry(0.03, 0.004, 8, 16, Math.PI), mats.metal, "metal", [0, 0.16, 0.01]);
  for (let i = 1; i <= 3; i++) {
    const y = 0.014 + i * 0.034;
    const rr = 0.032 + Math.sin((i / 4) * Math.PI) * 0.037;
    addMesh(THREE, body, new THREE.TorusGeometry(rr, 0.0025, 6, 18), mats.wood, "wood", [0, y, 0.01], [Math.PI / 2, 0, 0]);
  }
  addGlowLight(THREE, body, o.glow, [0, 0.095, 0.01], 0.65, 1.15);

  // Small fox spirit curled around lantern
  const fx = o.variant === 0 ? -0.075 : -0.068;
  const fy = o.variant === 1 ? 0.088 : 0.052;
  const fz = 0.015;
  addMesh(THREE, body, new THREE.SphereGeometry(0.052, 16, 14), mats.fur, "fur", [fx, fy, fz], [0, 0.45, 0], [0.95, 0.88, 1.25]);
  addMesh(THREE, body, new THREE.SphereGeometry(0.038, 12, 10), mats.furAccent, "furAccent", [fx + 0.025, fy, fz + 0.032]);
  // Paws resting on lantern
  addMesh(THREE, body, new THREE.CapsuleGeometry(0.012, 0.032, 4, 8), mats.fur, "fur", [fx + 0.045, fy + 0.02, fz + 0.042], [0.2, 0, -0.8]);

  // Fox head peeking over/beside lantern
  head.position.set(fx + 0.02, fy + 0.072, fz + 0.042);
  head.rotation.set(o.variant === 2 ? 0.25 : 0.05, 0.45, -0.08);
  addMesh(THREE, head, new THREE.SphereGeometry(0.052, 16, 14), mats.fur, "fur", [0, 0, 0], null, [1.08, 0.94, 0.98]);
  addMesh(THREE, head, new THREE.ConeGeometry(0.022, 0.045, 10), mats.fur, "fur", [0, -0.01, 0.056], [Math.PI * 0.52, 0, 0]);
  addMesh(THREE, head, new THREE.SphereGeometry(0.007, 8, 8), mats.nose, "wood", [0, -0.01, 0.078]);
  addEyes(THREE, head, mats, { sep: 0.03, y: 0.008, z: 0.042, r: 0.013 });
  for (const s of [-1, 1]) {
    addMesh(THREE, head, new THREE.ConeGeometry(0.022, 0.058, 10), mats.fur, "fur", [s * 0.036, 0.055, -0.004], [0.05, 0, -s * 0.32]);
    addMesh(THREE, head, new THREE.ConeGeometry(0.013, 0.038, 8), mats.furAccent, "furAccent", [s * 0.036, 0.052, 0.005], [0.05, 0, -s * 0.32]);
  }

  // Lush tail wrapping around the back/right of lantern
  tail.position.set(fx - 0.01, fy - 0.01, fz - 0.045);
  const tPts = [[0, 0, 0], [0.07, 0.0, -0.055], [0.15, 0.012, -0.01], [0.145, 0.035, 0.068]];
  addMesh(THREE, tail, makeTube(THREE, tPts, 0.026, 20, 10), mats.fur, "fur");
  addMesh(THREE, tail, new THREE.SphereGeometry(0.03, 12, 10), mats.furAccent, "furAccent", [0.145, 0.038, 0.072]);

  addAccessory(THREE, body, o.accessory, mats, [fx + 0.015, fy + 0.035, fz + 0.036], 0.036);
  root.add(body, head, tail);
  return finalizeCreature(root, "kitsuneLantern", o.variant);
}

// 12. Baku
function baku(THREE, opts) {
  const o = mergeOpts("baku", opts);
  const mats = makePaletteMats(THREE, o);
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";

  const torsoY = buildChibiQuadrupedBody(THREE, body, mats, {
    bodyY: 0.105, bodyR: 0.076, bodyLen: 0.1, legH: 0.058, legR: 0.022, variant: o.variant, belly: false
  });
  // Striped back saddle markings
  for (let i = 0; i < 3; i++) {
    const z = 0.03 - i * 0.034;
    addMesh(THREE, body, new THREE.TorusGeometry(0.068, 0.012, 8, 18, Math.PI * 1.1), mats.furAccent, "furAccent", [0, torsoY + 0.002, z], [0, 0, -Math.PI * 0.05], [0.95, 0.92, 0.8]);
  }

  // Head with short tapir trunk + small tusks
  const headY = o.variant === 2 ? 0.115 : 0.165;
  head.position.set(0, headY, 0.098);
  if (o.variant === 2) head.rotation.set(0.25, 0.12, 0);
  addMesh(THREE, head, new THREE.SphereGeometry(0.065, 18, 14), mats.fur, "fur", [0, 0, 0], null, [1.02, 0.95, 1.05]);
  // Short flexible trunk
  const trPts = [[0, -0.008, 0.052], [0, -0.015, 0.095], [0, -0.042, 0.115]];
  addMesh(THREE, head, makeTube(THREE, trPts, 0.019, 14, 10), mats.fur, "fur");
  addMesh(THREE, head, new THREE.SphereGeometry(0.018, 10, 8), mats.furAccent, "furAccent", [0, -0.044, 0.116]);
  // Small curved tusks
  for (const s of [-1, 1]) {
    addMesh(THREE, head, new THREE.ConeGeometry(0.008, 0.03, 8), mats.secondary, "secondary", [s * 0.028, -0.028, 0.068], [0.55, 0, -s * 0.35]);
    // Rounded ears
    addMesh(THREE, head, new THREE.SphereGeometry(0.022, 10, 8), mats.fur, "fur", [s * 0.048, 0.052, -0.008], null, [1.0, 1.0, 0.45]);
    addMesh(THREE, head, new THREE.SphereGeometry(0.014, 8, 8), mats.furAccent, "furAccent", [s * 0.048, 0.052, 0.0], null, [1.0, 1.0, 0.35]);
  }
  addEyes(THREE, head, mats, { sep: 0.038, y: 0.014, z: 0.048, r: 0.014 });

  // Stubby tail
  tail.position.set(0, torsoY, -0.098);
  addMesh(THREE, tail, new THREE.CapsuleGeometry(0.012, 0.025, 6, 8), mats.fur, "fur", [0, -0.008, -0.015], [0.6, 0, 0]);

  addAccessory(THREE, body, o.accessory, mats, [0, headY - 0.045, 0.072], 0.052);
  root.add(body, head, tail);
  return finalizeCreature(root, "baku", o.variant);
}

// 13. Kelpie
function kelpie(THREE, opts) {
  const o = mergeOpts("kelpie", opts);
  const mats = makePaletteMats(THREE, o);
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";

  const torsoY = buildChibiQuadrupedBody(THREE, body, mats, {
    bodyY: 0.13, bodyR: 0.064, bodyLen: 0.092, legH: 0.088, legR: 0.016, variant: o.variant, hooves: true
  });
  const neckY = o.variant === 2 ? torsoY + 0.042 : torsoY + 0.065;
  addMesh(THREE, body, new THREE.CapsuleGeometry(0.03, 0.055, 6, 12), mats.fur, "fur", [0, neckY, 0.062], [0.32, 0, 0]);

  // Wave-shaped mane crests
  const waveShape = new THREE.Shape();
  waveShape.moveTo(0, 0);
  waveShape.quadraticCurveTo(0.01, 0.045, 0.048, 0.042);
  waveShape.quadraticCurveTo(0.032, 0.022, 0.028, 0);
  waveShape.closePath();
  const waveGeo = new THREE.ExtrudeGeometry(waveShape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.004, bevelSegments: 2 });
  for (let i = 0; i < 4; i++) {
    addMesh(THREE, body, waveGeo, mats.furAccent, "furAccent", [-0.006, neckY + 0.045 - i * 0.026, 0.052 - i * 0.022], [0, Math.PI / 2, 0.25]);
  }

  // Head with finned ears
  head.position.set(0, neckY + 0.062, 0.092);
  if (o.variant === 2) head.rotation.set(0.24, 0.15, 0);
  addMesh(THREE, head, new THREE.SphereGeometry(0.058, 18, 14), mats.fur, "fur", [0, 0, 0], null, [0.92, 0.96, 1.08]);
  addMesh(THREE, head, new THREE.SphereGeometry(0.034, 14, 10), mats.fur, "fur", [0, -0.014, 0.052], null, [0.95, 0.8, 1.15]);
  addMesh(THREE, head, waveGeo, mats.furAccent, "furAccent", [-0.006, 0.045, 0.015], [0, Math.PI / 2, -0.25], 0.85);
  addEyes(THREE, head, mats, { sep: 0.035, y: 0.012, z: 0.044, r: 0.014 });
  const earFin = makeFinGeo(THREE, 0.02, 0.045);
  for (const s of [-1, 1]) {
    addMesh(THREE, head, earFin, mats.furAccent, "furAccent", [s * 0.038, 0.042, -0.01], [0, s * 0.4, -s * 0.55]);
  }

  // Sweeping fin tail
  tail.position.set(0, torsoY + 0.005, -0.088);
  const tPts = [[0, 0, 0], [0, -0.01, -0.055], [0, 0.018, -0.115]];
  addMesh(THREE, tail, makeTube(THREE, tPts, 0.02, 14, 10), mats.fur, "fur");
  addMesh(THREE, tail, makeFinGeo(THREE, 0.058, 0.085), mats.furAccent, "furAccent", [0, 0.018, -0.115], [-1.25, 0, 0]);

  addAccessory(THREE, body, o.accessory, mats, [0, neckY + 0.01, 0.07], 0.036);
  root.add(body, head, tail);
  return finalizeCreature(root, "kelpie", o.variant);
}

// 14. Thunderbird
function thunderbird(THREE, opts) {
  const o = mergeOpts("thunderbird", opts);
  const mats = makePaletteMats(THREE, o);
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";
  const wingL = new THREE.Group();
  wingL.name = "wingL";
  const wingR = new THREE.Group();
  wingR.name = "wingR";

  const bodyY = o.variant === 2 ? 0.078 : o.variant === 1 ? 0.1 : 0.132;
  addMesh(THREE, body, new THREE.SphereGeometry(0.072, 18, 14), mats.fur, "fur", [0, bodyY, 0], [-0.2, 0, 0], [1.02, 1.08, 1.1]);
  addMesh(THREE, body, new THREE.SphereGeometry(0.056, 14, 12), mats.furAccent, "furAccent", [0, bodyY - 0.008, 0.036], null, [0.92, 0.95, 0.72]);

  if (o.variant !== 2) {
    const legH = o.variant === 1 ? 0.045 : 0.072;
    for (const s of [-1, 1]) {
      addMesh(THREE, body, new THREE.CylinderGeometry(0.009, 0.008, legH, 8), mats.accent, "accent", [s * 0.03, legH * 0.5, 0.008]);
      for (const a of [-0.45, 0, 0.45]) {
        addMesh(THREE, body, new THREE.CapsuleGeometry(0.006, 0.024, 4, 6), mats.accent, "accent", [s * 0.03 + Math.sin(a) * 0.014, 0.007, 0.024], [Math.PI / 2, 0, -a]);
      }
    }
  }

  // Head + swept crest
  head.position.set(0, bodyY + 0.095, 0.042);
  addMesh(THREE, head, new THREE.SphereGeometry(0.058, 16, 14), mats.fur, "fur");
  addMesh(THREE, head, new THREE.ConeGeometry(0.02, 0.042, 10), mats.accent, "accent", [0, -0.008, 0.064], [Math.PI * 0.58, 0, 0]);
  addEyes(THREE, head, mats, { sep: 0.035, y: 0.01, z: 0.042, r: 0.014 });
  // Zigzag crest
  for (let i = -1; i <= 1; i++) {
    const cr = addMesh(THREE, head, new THREE.ConeGeometry(0.012, 0.055, 6), mats.furAccent, "furAccent", [i * 0.02, 0.055, -0.018], [-0.85, i * 0.25, -i * 0.25]);
    cr.userData.isGlow = true;
  }

  // Broad wings with zigzag feather edges
  const wGeo = makeFeatherWingGeo(THREE, 1.22, true);
  const boltGeo = makeFeatherWingGeo(THREE, 0.72, true);
  for (const [wg, s] of [[wingL, 1], [wingR, -1]]) {
    const rotY = s === 1 ? 0 : Math.PI;
    addMesh(THREE, wg, wGeo, mats.fur, "fur", [0, 0, 0], [0, rotY, 0]);
    const b = addMesh(THREE, wg, boltGeo, mats.glow, "furAccent", [s * 0.03, 0.005, 0.012], [0, rotY, 0]);
    b.userData.isGlow = true;
    wg.position.set(s * 0.062, bodyY + 0.03, 0.005);
    wg.rotation.set(0.12, -s * 0.22, s * (o.variant === 2 ? -0.35 : 0.14));
  }

  // Banded zigzag tail
  tail.position.set(0, bodyY - 0.02, -0.068);
  addMesh(THREE, tail, makeFinGeo(THREE, 0.068, 0.095), mats.fur, "fur", [0, 0, 0], [-1.3, 0, 0]);
  addMesh(THREE, tail, makeFinGeo(THREE, 0.048, 0.065), mats.furAccent, "furAccent", [0, 0.008, -0.012], [-1.3, 0, 0]);

  addGlowLight(THREE, body, o.glow, [0, bodyY + 0.06, 0.02], 0.45, 0.95);
  addAccessory(THREE, body, o.accessory, mats, [0, bodyY + 0.052, 0.038], 0.042);
  root.add(body, head, tail, wingL, wingR);
  return finalizeCreature(root, "thunderbird", o.variant);
}

// 15. Sea Serpent
function seaSerpent(THREE, opts) {
  const o = mergeOpts("seaSerpent", opts);
  const mats = makePaletteMats(THREE, o);
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";

  const archH = o.variant === 2 ? 0.075 : o.variant === 1 ? 0.115 : 0.105;
  const rippleGeo = new THREE.TorusGeometry(0.042, 0.006, 8, 18);
  const finGeo = makeFlameGeo(THREE, 0.018, 0.042);

  // Three arches rising from the floor
  const arches = [
    [[0, 0.01, 0.165], [0, archH * 1.15, 0.13], [0, 0.01, 0.08]],
    [[0.015, 0.01, 0.045], [0.022, archH, -0.005], [0.01, 0.01, -0.055]],
    [[-0.012, 0.01, -0.09], [-0.018, archH * 0.85, -0.14], [-0.01, 0.01, -0.185]]
  ];

  arches.forEach((pts, idx) => {
    const r = 0.032 - idx * 0.004;
    addMesh(THREE, body, makeTube(THREE, pts, r, 18, 12), mats.fur, "fur");
    // Water ripple rings where body meets floor
    addMesh(THREE, body, rippleGeo, mats.furAccent, "furAccent", [pts[0][0], 0.006, pts[0][2]], [Math.PI / 2, 0, 0], 1 - idx * 0.08);
    addMesh(THREE, body, rippleGeo, mats.furAccent, "furAccent", [pts[2][0], 0.006, pts[2][2]], [Math.PI / 2, 0, 0], 1 - idx * 0.08);
    // Dorsal crest fin on each arch
    addMesh(THREE, body, finGeo, mats.furAccent, "furAccent", [pts[1][0], pts[1][1] + r * 0.7, pts[1][2]], [-0.25, Math.PI / 2, 0], 0.9 - idx * 0.1);
  });

  // Finned head rising on front neck
  const headY = archH * 1.15 + 0.078;
  addMesh(THREE, body, new THREE.CapsuleGeometry(0.028, 0.065, 6, 12), mats.fur, "fur", [0, archH * 1.15 + 0.028, 0.155], [0.22, 0, 0]);
  head.position.set(0, headY, 0.175);
  addMesh(THREE, head, new THREE.SphereGeometry(0.054, 16, 14), mats.fur, "fur", [0, 0, 0], null, [0.98, 0.9, 1.15]);
  addMesh(THREE, head, new THREE.SphereGeometry(0.034, 14, 10), mats.fur, "fur", [0, -0.008, 0.048], null, [1.0, 0.75, 1.1]);
  addEyes(THREE, head, mats, { sep: 0.034, y: 0.012, z: 0.042, r: 0.014 });
  // Cheek & head fins
  const sideFin = makeFinGeo(THREE, 0.025, 0.055);
  for (const s of [-1, 1]) {
    addMesh(THREE, head, sideFin, mats.furAccent, "furAccent", [s * 0.046, 0.008, -0.012], [0, s * 0.5, -s * 1.15]);
  }
  addMesh(THREE, head, finGeo, mats.furAccent, "furAccent", [0, 0.042, -0.01], [-0.35, Math.PI / 2, 0]);

  // Finned tail rising at the back
  tail.position.set(-0.01, 0.03, -0.185);
  addMesh(THREE, tail, makeTube(THREE, [[0, 0, 0], [0, 0.045, -0.032], [0, 0.088, -0.048]], 0.018, 12, 8), mats.fur, "fur");
  addMesh(THREE, tail, makeFinGeo(THREE, 0.055, 0.075), mats.furAccent, "furAccent", [0, 0.088, -0.048], [-0.45, 0, 0]);

  addAccessory(THREE, body, o.accessory, mats, [0, headY - 0.048, 0.162], 0.034);
  root.add(body, head, tail);
  return finalizeCreature(root, "seaSerpent", o.variant);
}

// 16. Jackalope
function jackalope(THREE, opts) {
  const o = mergeOpts("jackalope", opts);
  const mats = makePaletteMats(THREE, o);
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const head = new THREE.Group();
  head.name = "head";
  const tail = new THREE.Group();
  tail.name = "tail";
  const horn = new THREE.Group();
  horn.name = "horn";

  const bodyY = o.variant === 2 ? 0.068 : 0.095;
  addMesh(THREE, body, new THREE.SphereGeometry(0.066, 18, 14), mats.fur, "fur", [0, bodyY, 0], [o.variant === 0 ? -0.22 : 0, 0, 0], [0.95, 1.05, 1.15]);
  addMesh(THREE, body, new THREE.SphereGeometry(0.048, 14, 12), mats.furAccent, "furAccent", [0, bodyY - 0.008, 0.035], null, [0.88, 0.9, 0.72]);

  // Hare legs
  for (const s of [-1, 1]) {
    addMesh(THREE, body, new THREE.SphereGeometry(0.025, 12, 10), mats.fur, "fur", [s * 0.045, 0.02, -0.005], null, [0.82, 0.65, 1.5]);
    const pawY = o.variant === 1 ? bodyY + 0.008 : 0.022;
    const pawRot = o.variant === 1 ? Math.PI * 0.35 : 0.1;
    addMesh(THREE, body, new THREE.CapsuleGeometry(0.013, 0.038, 6, 8), mats.fur, "fur", [s * 0.032, pawY, 0.056], [pawRot, 0, 0]);
  }

  // Hare head
  head.position.set(0, bodyY + 0.095, 0.035);
  if (o.variant === 2) head.rotation.set(0.24, 0.18, 0);
  addMesh(THREE, head, new THREE.SphereGeometry(0.058, 18, 14), mats.fur, "fur", [0, 0, 0], null, [0.98, 0.94, 1.06]);
  addMesh(THREE, head, new THREE.SphereGeometry(0.009, 8, 8), mats.skin, "skin", [0, -0.008, 0.062], null, [1.2, 0.85, 0.85]);
  addEyes(THREE, head, mats, { sep: 0.034, y: 0.012, z: 0.048, r: 0.014 });

  // Long hare ears
  const earGeo = new THREE.CapsuleGeometry(0.016, 0.088, 8, 12);
  for (const s of [-1, 1]) {
    addMesh(THREE, head, earGeo, mats.fur, "fur", [s * 0.034, 0.092, -0.014], [-0.2, 0, -s * 0.28], [0.8, 1.0, 0.5]);
    addMesh(THREE, head, earGeo, mats.skin, "skin", [s * 0.034, 0.09, -0.008], [-0.2, 0, -s * 0.28], [0.46, 0.78, 0.28]);
    addAntler(THREE, horn, mats.wood, "wood", 1.15, s);
  }
  horn.position.set(0, 0.048, 0.012);
  head.add(horn);

  // Fluffy tail
  tail.position.set(0, bodyY - 0.015, -0.078);
  addMesh(THREE, tail, new THREE.SphereGeometry(0.03, 12, 10), mats.furAccent, "furAccent");

  addAccessory(THREE, body, o.accessory, mats, [0, bodyY + 0.052, 0.032], 0.04);
  root.add(body, head, tail);
  return finalizeCreature(root, "jackalope", o.variant);
}

export const MYTHICAL = {
  westernDragon,
  easternDragon,
  unicorn,
  phoenix,
  pegasus,
  griffin,
  kirin,
  nineTailFox,
  jadeRabbit,
  moonMoth,
  kitsuneLantern,
  baku,
  kelpie,
  thunderbird,
  seaSerpent,
  jackalope
};

export function idle(group, t) {
  if (!group) return;
  const time = t || 0;
  const breath = Math.sin(time * 2.3);
  const sway = Math.sin(time * 1.45);
  const wingFlap = Math.sin(time * 2.6);
  const tailWag = Math.sin(time * 2.9);
  const floatY = group.userData.floats ? Math.sin(time * 1.8) * 0.012 : 0;

  // Periodic smooth blink
  const cycle = (time + 1.4) % 3.9;
  const blink = cycle < 0.14 ? Math.sin((cycle / 0.14) * Math.PI) : 0;

  const body = group.getObjectByName("body");
  if (body && body.userData.baseScale) {
    body.scale.set(
      body.userData.baseScale.x * (1 - breath * 0.014),
      body.userData.baseScale.y * (1 + breath * 0.024),
      body.userData.baseScale.z * (1 - breath * 0.012)
    );
    body.position.y = body.userData.basePos.y + floatY;
  }

  const head = group.getObjectByName("head");
  if (head && head.userData.basePos) {
    head.position.y = head.userData.basePos.y + breath * 0.003 + floatY;
    head.rotation.x = head.userData.baseRot.x + breath * 0.035;
    head.rotation.z = head.userData.baseRot.z + sway * 0.045;
  }

  const tail = group.getObjectByName("tail");
  if (tail && tail.userData.baseRot) {
    tail.position.y = tail.userData.basePos.y + floatY;
    tail.rotation.y = tail.userData.baseRot.y + tailWag * 0.14;
    tail.rotation.x = tail.userData.baseRot.x + breath * 0.04;
  }

  const wingL = group.getObjectByName("wingL");
  if (wingL && wingL.userData.baseRot) {
    wingL.position.y = wingL.userData.basePos.y + floatY;
    wingL.rotation.z = wingL.userData.baseRot.z + wingFlap * 0.16;
  }

  const wingR = group.getObjectByName("wingR");
  if (wingR && wingR.userData.baseRot) {
    wingR.position.y = wingR.userData.basePos.y + floatY;
    wingR.rotation.z = wingR.userData.baseRot.z - wingFlap * 0.16;
  }

  const glowPulse = 0.85 + 0.25 * Math.sin(time * 2.4);
  group.traverse(obj => {
    if (obj.userData.isEye && obj.userData.baseScale) {
      obj.scale.y = obj.userData.baseScale.y * (1 - blink * 0.88);
    }
    if (obj.isPointLight && obj.name === "glow") {
      const baseI = obj.userData.baseIntensity !== undefined ? obj.userData.baseIntensity : 0.45;
      obj.intensity = baseI * glowPulse;
    }
    if (obj.isMesh && obj.userData.isGlow && obj.material) {
      const baseE = obj.userData.baseEmissive !== undefined ? obj.userData.baseEmissive : 0.8;
      obj.material.emissiveIntensity = baseE * glowPulse;
    }
  });
}

export function recolor(group, palette) {
  if (!group || !palette) return;
  group.traverse(obj => {
    if (obj.isPointLight && obj.name === "glow" && palette.glow !== undefined) {
      obj.color.set(palette.glow);
    }
    if (!obj.isMesh || !obj.material) return;
    if (obj.userData.isEye && palette.eye !== undefined) {
      obj.material.color.set(palette.eye);
      return;
    }
    if (obj.userData.isGlow && palette.glow !== undefined) {
      obj.material.color.set(palette.glow);
      if (obj.material.emissive) obj.material.emissive.set(palette.glow);
      return;
    }
    const slot = obj.userData.slot;
    if (!slot) return;
    if (palette[slot] !== undefined) {
      obj.material.color.set(palette[slot]);
    } else if (slot === "fur" && palette.primary !== undefined) {
      obj.material.color.set(palette.primary);
    } else if (slot === "furAccent" && palette.secondary !== undefined) {
      obj.material.color.set(palette.secondary);
    }
  });
}

export const CATALOG = [
  { id: "westernDragon", name: "Western Dragon", kind: "mythical", footprint: [0.34, 0.38], placement: "pet", variants: 3, note: "Plump chibi dragon with bat wings, curved horns, belly plates, and spade tail." },
  { id: "easternDragon", name: "Eastern Dragon", kind: "mythical", footprint: [0.28, 0.46], placement: "pet", variants: 3, note: "Floating serpentine dragon with stag antlers, whiskers, mane, and glowing pearl." },
  { id: "unicorn", name: "Unicorn", kind: "mythical", footprint: [0.24, 0.34], placement: "pet", variants: 3, note: "Chibi horse with a shimmering spiral horn and flowing mane and tail." },
  { id: "phoenix", name: "Phoenix", kind: "mythical", footprint: [0.36, 0.42], placement: "pet", variants: 3, note: "Fiery companion bird with sweeping tail plumes, crest, and warm glowing feather tips." },
  { id: "pegasus", name: "Pegasus", kind: "mythical", footprint: [0.38, 0.34], placement: "pet", variants: 3, note: "Chibi winged horse with soft layered feathered wings." },
  { id: "griffin", name: "Griffin", kind: "mythical", footprint: [0.36, 0.36], placement: "pet", variants: 3, note: "Noble companion with eagle head and wings paired with a lion body and tufted tail." },
  { id: "kirin", name: "Kirin", kind: "mythical", footprint: [0.26, 0.36], placement: "pet", variants: 3, note: "Gentle scaled deer-like beast with a single branched horn and glowing flame tufts." },
  { id: "nineTailFox", name: "Nine-Tail Fox", kind: "mythical", footprint: [0.36, 0.38], placement: "pet", variants: 3, note: "Fluffy fox spirit sporting nine fanned, accent-tipped tails." },
  { id: "jadeRabbit", name: "Jade Rabbit", kind: "mythical", footprint: [0.24, 0.28], placement: "pet", variants: 3, note: "Cozy moon rabbit holding a small pestle and pale-green glowing jade mortar." },
  { id: "moonMoth", name: "Moon Moth", kind: "mythical", footprint: [0.44, 0.32], placement: "pet", variants: 3, note: "Large fluffy moth with feathery antennae and glowing crescent-patterned wings." },
  { id: "kitsuneLantern", name: "Kitsune Lantern", kind: "mythical", footprint: [0.3, 0.3], placement: "pet", variants: 3, note: "Tiny fox spirit curled snugly around a warm glowing paper lantern." },
  { id: "baku", name: "Baku", kind: "mythical", footprint: [0.26, 0.34], placement: "pet", variants: 3, note: "Tapir-like dream eater with a short trunk, tiny tusks, and striped back." },
  { id: "kelpie", name: "Kelpie", kind: "mythical", footprint: [0.24, 0.38], placement: "pet", variants: 3, note: "Aquatic horse with a wave-crested mane, finned ears, and sweeping fin tail." },
  { id: "thunderbird", name: "Thunderbird", kind: "mythical", footprint: [0.5, 0.34], placement: "pet", variants: 3, note: "Broad-winged storm raptor with zigzag feather edges and electric glowing accents." },
  { id: "seaSerpent", name: "Sea Serpent", kind: "mythical", footprint: [0.24, 0.48], placement: "pet", variants: 3, note: "Three graceful serpent arches rising from water ripples with a finned head and tail." },
  { id: "jackalope", name: "Jackalope", kind: "mythical", footprint: [0.24, 0.28], placement: "pet", variants: 3, note: "Perky chibi hare crowned with a pair of small branched antlers." }
];
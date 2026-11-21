export const FACE_DIR = [0, 0, 1];

export const RIG = {
  root:     { parent: null,       pos: [0, 0, 0],          rot: [0, 0, 0] },
  pelvis:   { parent: 'root',     pos: [0, 0.385, 0],      rot: [0, 0, 0] },
  chest:    { parent: 'pelvis',   pos: [0, 0.095, 0],      rot: [0, 0, 0] },
  neck:     { parent: 'chest',    pos: [0, 0.16, 0],       rot: [0, 0, 0] },
  head:     { parent: 'neck',     pos: [0, 0.05, 0],       rot: [0, 0, 0] },
  armL:     { parent: 'chest',    pos: [0.105, 0.135, 0],  rot: [0, 0, 0.14] },
  armR:     { parent: 'chest',    pos: [-0.105, 0.135, 0], rot: [0, 0, -0.14] },
  forearmL: { parent: 'armL',     pos: [0, -0.12, 0],      rot: [0, 0, 0] },
  forearmR: { parent: 'armR',     pos: [0, -0.12, 0],      rot: [0, 0, 0] },
  handL:    { parent: 'forearmL', pos: [0, -0.11, 0],      rot: [0, 0, 0] },
  handR:    { parent: 'forearmR', pos: [0, -0.11, 0],      rot: [0, 0, 0] },
  legL:     { parent: 'pelvis',   pos: [0.045, 0, 0],      rot: [0, 0, 0] },
  legR:     { parent: 'pelvis',   pos: [-0.045, 0, 0],     rot: [0, 0, 0] },
  shinL:    { parent: 'legL',     pos: [0, -0.16, 0],      rot: [0, 0, 0] },
  shinR:    { parent: 'legR',     pos: [0, -0.16, 0],      rot: [0, 0, 0] },
  footL:    { parent: 'shinL',    pos: [0, -0.16, 0],      rot: [0, 0, 0] },
  footR:    { parent: 'shinR',    pos: [0, -0.16, 0],      rot: [0, 0, 0] },
  joints: {
    shoulder: 0.028,
    elbow: 0.022,
    wrist: 0.016,
    hip: 0.040,
    knee: 0.030,
    ankle: 0.020,
    waist: 0.050,
    neck: 0.026,
  },
  headSpec: {
    width: 0.30,
    height: 0.31,
    depth: 0.29,
    centerOffset: [0, 0.14, 0],
    faceDirection: [0, 0, 1],
  },
  dimensions: {
    pelvis: { halfWidth: 0.080, depth: 0.075, height: 0.10 },
    chest:  { waistHalfWidth: 0.058, shoulderHalfWidth: 0.085, depth: 0.072, height: 0.14 },
    neck:   { radius: 0.028, length: 0.05 },
    upperArm: { length: 0.12, rTop: 0.026, rBot: 0.022 },
    forearm:  { length: 0.11, rTop: 0.022, rBot: 0.017 },
    hand:     { length: 0.055 },
    thigh:    { length: 0.16, rTop: 0.042, rBot: 0.032 },
    shin:     { length: 0.16, rTop: 0.032, rBot: 0.022 },
    foot:     { length: 0.085, height: 0.04, width: 0.04, ankleHeight: 0.065 },
  },
};

const PIVOT_NAMES = [
  'root', 'pelvis', 'chest', 'neck', 'head',
  'armL', 'armR', 'forearmL', 'forearmR', 'handL', 'handR',
  'legL', 'legR', 'shinL', 'shinR', 'footL', 'footR',
];

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function gauss(d, s) {
  const k = d / s;
  return Math.exp(-0.5 * k * k);
}

function setSRGB(THREE, tex) {
  if (THREE.SRGBColorSpace) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.needsUpdate = true;
  return tex;
}

function fillBlushPixel(data, idx, blush, grain) {
  const b = clamp(blush, 0, 0.45);
  const g = (grain - 0.5) * 4;
  data[idx]     = clamp(Math.round(255 + g), 0, 255);
  data[idx + 1] = clamp(Math.round(255 * (1 - 0.56 * b) + g), 0, 255);
  data[idx + 2] = clamp(Math.round(255 * (1 - 0.70 * b) + g * 0.8), 0, 255);
  data[idx + 3] = 255;
}

function makeHeadBlushTexture(THREE, kit) {
  const tex = kit.canvasTexture(512, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let py = 0; py < h; py++) {
      const theta = ((py + 0.5) / h) * Math.PI;
      const sinT = Math.sin(theta);
      const uy = Math.cos(theta);
      for (let px = 0; px < w; px++) {
        const phi = ((px + 0.5) / w) * Math.PI * 2;
        const ux = -Math.cos(phi) * sinT;
        const uz = Math.sin(phi) * sinT;

        let blush = 0;
        if (uz > 0.2) {
          const frontFade = smoothstep(0.25, 0.75, uz);
          const cheekL = gauss(ux - 0.40, 0.16) * gauss(uy + 0.25, 0.13);
          const cheekR = gauss(ux + 0.40, 0.16) * gauss(uy + 0.25, 0.13);
          const noseTip = gauss(ux, 0.09) * gauss(uy + 0.22, 0.08);
          const chinHint = gauss(ux, 0.16) * gauss(uy + 0.84, 0.12);
          blush += frontFade * (0.24 * (cheekL + cheekR) + 0.11 * noseTip + 0.06 * chinHint);
        }
        const grain = kit.noise(px * 0.045, py * 0.045);
        fillBlushPixel(data, (py * w + px) * 4, blush, grain);
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  return setSRGB(THREE, tex);
}

function makeLimbBlushTexture(THREE, kit, cfg) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let py = 0; py < h; py++) {
      const v = 1 - (py + 0.5) / h; // 0 = distal (bottom), 1 = proximal (top)
      for (let px = 0; px < w; px++) {
        const u = (px + 0.5) / w;
        const phi = u * Math.PI * 2;
        const uz = Math.sin(phi);

        let blush = 0;
        if (cfg.topBlush) {
          const dir = cfg.topDir === 'front' ? smoothstep(-0.2, 0.9, uz)
            : cfg.topDir === 'back' ? smoothstep(-0.2, 0.9, -uz) : 1.0;
          blush += cfg.topBlush * gauss(v - 0.90, 0.14) * (0.35 + 0.65 * dir);
        }
        if (cfg.botBlush) {
          const dir = cfg.botDir === 'front' ? smoothstep(-0.2, 0.9, uz)
            : cfg.botDir === 'back' ? smoothstep(-0.2, 0.9, -uz) : 1.0;
          blush += cfg.botBlush * gauss(v - 0.10, 0.14) * (0.35 + 0.65 * dir);
        }
        const grain = kit.noise(px * 0.06, py * 0.06);
        fillBlushPixel(data, (py * w + px) * 4, blush, grain);
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  return setSRGB(THREE, tex);
}

function makeTorsoBlushTexture(THREE, kit) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let py = 0; py < h; py++) {
      const v = 1 - (py + 0.5) / h;
      for (let px = 0; px < w; px++) {
        const u = (px + 0.5) / w;
        const phi = u * Math.PI * 2;
        const ux = -Math.cos(phi);
        const uz = Math.sin(phi);
        const shoulderWarm = 0.11 * gauss(v - 0.80, 0.14) * smoothstep(0.4, 0.95, Math.abs(ux));
        const collarWarm = 0.06 * gauss(v - 0.86, 0.10) * smoothstep(0.1, 0.8, uz);
        const grain = kit.noise(px * 0.05, py * 0.05);
        fillBlushPixel(data, (py * w + px) * 4, shoulderWarm + collarWarm, grain);
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  return setSRGB(THREE, tex);
}

function makeHandBlushTexture(THREE, kit) {
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let py = 0; py < h; py++) {
      const v = 1 - (py + 0.5) / h; // 0 = tip, 1 = base
      for (let px = 0; px < w; px++) {
        const tipWarm = 0.20 * gauss(v - 0.12, 0.22);
        const knuckleWarm = 0.13 * gauss(v - 0.78, 0.18);
        const grain = kit.noise(px * 0.08, py * 0.08);
        fillBlushPixel(data, (py * w + px) * 4, tipWarm + knuckleWarm, grain);
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  return setSRGB(THREE, tex);
}

function makeFootBlushTexture(THREE, kit) {
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let py = 0; py < h; py++) {
      const t = 1 - (py + 0.5) / h; // 0 = heel, 1 = toes
      for (let px = 0; px < w; px++) {
        const toeWarm = 0.17 * gauss(t - 0.92, 0.16);
        const heelWarm = 0.10 * gauss(t - 0.08, 0.14);
        const grain = kit.noise(px * 0.08, py * 0.08);
        fillBlushPixel(data, (py * w + px) * 4, toeWarm + heelWarm, grain);
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  return setSRGB(THREE, tex);
}

function makeJointTexture(THREE, kit) {
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let py = 0; py < h; py++) {
      const v = (py + 0.5) / h;
      const eq = gauss(v - 0.5, 0.28);
      for (let px = 0; px < w; px++) {
        const grain = kit.noise(px * 0.07, py * 0.07);
        fillBlushPixel(data, (py * w + px) * 4, 0.08 + 0.06 * eq, grain);
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  return setSRGB(THREE, tex);
}

function makeSkinMaterial(THREE, skinHex, map, isJoint = false) {
  const base = new THREE.Color(skinHex);
  const sheenCol = base.clone().lerp(new THREE.Color(0xffe6dc), 0.45);
  return new THREE.MeshPhysicalMaterial({
    color: base,
    map,
    roughness: isJoint ? 0.34 : 0.55,
    metalness: 0.0,
    sheen: isJoint ? 0.22 : 0.32,
    sheenRoughness: isJoint ? 0.50 : 0.62,
    sheenColor: sheenCol,
    clearcoat: isJoint ? 0.24 : 0.07,
    clearcoatRoughness: isJoint ? 0.26 : 0.45,
  });
}

function tagMesh(mesh, slot = 'skin') {
  mesh.userData.slot = slot;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildParametricGrid(THREE, uSegs, vSegs, sampleFn) {
  const cols = uSegs + 1;
  const rows = vSegs + 1;
  const positions = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);

  for (let iv = 0; iv <= vSegs; iv++) {
    const v = iv / vSegs;
    for (let iu = 0; iu <= uSegs; iu++) {
      const u = iu / uSegs;
      const p = sampleFn(u, v);
      const idx = iv * cols + iu;
      positions[idx * 3]     = p[0];
      positions[idx * 3 + 1] = p[1];
      positions[idx * 3 + 2] = p[2];
      uvs[idx * 2]     = u;
      uvs[idx * 2 + 1] = v;
    }
  }

  const indices = [];
  for (let iv = 0; iv < vSegs; iv++) {
    for (let iu = 0; iu < uSegs; iu++) {
      const i00 = iv * cols + iu;
      const i10 = i00 + 1;
      const i01 = i00 + cols;
      const i11 = i01 + 1;
      indices.push(i00, i10, i11);
      indices.push(i00, i11, i01);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  // Average normals across the u = 0 / u = 1 seam so round surfaces are seamless
  const normAttr = geo.getAttribute('normal');
  const norm = normAttr.array;
  for (let iv = 0; iv <= vSegs; iv++) {
    const a = (iv * cols) * 3;
    const b = (iv * cols + uSegs) * 3;
    const nx = norm[a] + norm[b];
    const ny = norm[a + 1] + norm[b + 1];
    const nz = norm[a + 2] + norm[b + 2];
    const len = Math.hypot(nx, ny, nz) || 1;
    norm[a] = norm[b] = nx / len;
    norm[a + 1] = norm[b + 1] = ny / len;
    norm[a + 2] = norm[b + 2] = nz / len;
  }
  normAttr.needsUpdate = true;
  return geo;
}

function buildHeadGeometry(THREE) {
  const geo = new THREE.SphereGeometry(1, 72, 56);
  const pos = geo.getAttribute('position');
  const rx = 0.150;
  const ry = 0.155;
  const rz = 0.145;
  const cy = 0.140;

  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);

    // Base egg silhouette: fuller cranium, delicate tapering chibi jawline
    const lowerT = smoothstep(0.05, -0.95, uy);
    const upperT = smoothstep(0.0, 0.75, uy);
    const frontMask = smoothstep(-0.10, 0.55, uz);

    let sx = 1.0 + 0.025 * upperT - 0.17 * Math.pow(lowerT, 1.55);
    let sy = 1.0;
    let sz = 1.0 + 0.020 * upperT - 0.08 * Math.pow(lowerT, 1.7);

    // Gentle back-of-skull fullness
    const backSkull = smoothstep(-0.15, -0.85, uz) * gauss(uy - 0.15, 0.45);
    sz += 0.032 * backSkull;

    let x = ux * rx * sx;
    let y = uy * ry * sy + cy;
    let z = uz * rz * sz;

    // Flatter face plane for clean painted features
    const facePlane = smoothstep(0.32, 0.88, uz) * gauss(ux, 0.58) * gauss(uy + 0.12, 0.52);
    z -= 0.0115 * facePlane;

    // Soft rounded chibi cheeks
    const cheekL = gauss(ux - 0.43, 0.22) * gauss(uy + 0.28, 0.18) * smoothstep(0.18, 0.78, uz);
    const cheekR = gauss(ux + 0.43, 0.22) * gauss(uy + 0.28, 0.18) * smoothstep(0.18, 0.78, uz);
    const cheeks = cheekL + cheekR;
    z += 0.0082 * cheeks;
    x += Math.sign(ux) * 0.0055 * cheeks;

    // Small pointed chin at bottom-front (world y ~0.675 -> local y ~-0.015)
    const chinArea = gauss(ux, 0.26) * gauss(uy + 0.88, 0.18) * smoothstep(0.0, 0.55, uz);
    z += 0.010 * chinArea;
    y -= 0.004 * chinArea;
    // Gently pull jaw sides slightly inward below cheeks to define chin V-line
    const jawPinch = smoothstep(0.18, 0.65, Math.abs(ux)) * smoothstep(-0.35, -0.85, uy) * frontMask;
    x *= 1.0 - 0.08 * jawPinch;

    // Subtle brow shelf
    const brow = gauss(uy - 0.13, 0.11) * gauss(ux, 0.48) * smoothstep(0.55, 0.92, uz);
    z += 0.0042 * brow;

    // Shallow smooth eye sockets where FACE module paints eyes
    const eyeL = gauss(ux - 0.30, 0.17) * gauss(uy + 0.05, 0.14) * smoothstep(0.62, 0.94, uz);
    const eyeR = gauss(ux + 0.30, 0.17) * gauss(uy + 0.05, 0.14) * smoothstep(0.62, 0.94, uz);
    z -= 0.0048 * (eyeL + eyeR);

    // Small cute button nose bump
    const noseBridge = gauss(ux, 0.055) * gauss(uy + 0.12, 0.10) * smoothstep(0.75, 0.98, uz);
    const noseTip = gauss(ux, 0.068) * gauss(uy + 0.22, 0.055) * smoothstep(0.78, 0.98, uz);
    const underNose = gauss(ux, 0.085) * gauss(uy + 0.30, 0.045) * smoothstep(0.78, 0.98, uz);
    z += 0.0032 * noseBridge + 0.0095 * noseTip - 0.0018 * underNose;
    y += 0.0012 * noseTip;

    // Very subtle mouth pillow and labiomental hint
    const mouthArea = gauss(ux, 0.14) * gauss(uy + 0.46, 0.09) * smoothstep(0.65, 0.95, uz);
    const underLip = gauss(ux, 0.13) * gauss(uy + 0.60, 0.07) * smoothstep(0.60, 0.92, uz);
    z += 0.0022 * mouthArea - 0.0020 * underLip;

    // Neck socket recess on the underside of the skull (centered near x=0, z=-0.012)
    if (uy < -0.55) {
      const rNeckDist = Math.hypot(x, z + 0.010);
      const sock = smoothstep(0.046, 0.016, rNeckDist) * smoothstep(-0.60, -0.88, uy);
      y += 0.022 * sock;
    }

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function buildEarGeometry(THREE, side) {
  const geo = new THREE.SphereGeometry(1, 36, 28);
  const pos = geo.getAttribute('position');

  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);

    // Cute rounded ear silhouette: slightly taller than deep, gentle taper at lobe
    const lobeTaper = 1.0 - 0.22 * smoothstep(-0.1, -0.95, uy);
    let x = ux * 0.0085;
    let y = uy * 0.0245;
    let z = uz * 0.0165 * lobeTaper;

    // Curve top helix slightly outward/back
    x += side * 0.0032 * smoothstep(-0.2, 0.8, -uz);

    // Sculpted inner concha fold on the outer-front side of the ear
    const outerFace = smoothstep(-0.05, 0.65, side * ux);
    const concha = gauss(uz - 0.08, 0.48) * gauss(uy + 0.05, 0.50) * outerFace;
    const antihelix = gauss(Math.hypot(uz + 0.05, uy - 0.08) - 0.45, 0.18) * outerFace;
    x -= side * 0.0052 * concha;
    x += side * 0.0018 * antihelix;

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function buildNeckGeometry(THREE, w, h) {
  const len = 0.05 * h;
  const rBase = 0.028 * w;
  return buildParametricGrid(THREE, 40, 28, (u, v) => {
    const phi = u * Math.PI * 2;
    const y = lerp(-0.008, len + 0.018, v);

    // Slight flare at chest base, gentle graceful taper mid-neck, dome inside skull
    const baseFlare = 0.0055 * w * gauss(v - 0.04, 0.12);
    const midWaist = -0.0022 * w * gauss(v - 0.46, 0.24);
    const topCap = v > 0.86 ? Math.sqrt(Math.max(0.0004, 1 - Math.pow((v - 0.86) / 0.14, 2))) : 1.0;
    const botCap = v < 0.06 ? Math.sqrt(Math.max(0.0004, 1 - Math.pow((0.06 - v) / 0.06, 2))) : 1.0;

    const r = (rBase + baseFlare + midWaist) * topCap * botCap;
    const rx = r;
    const rz = r * 1.03;
    return [-Math.cos(phi) * rx, y, Math.sin(phi) * rz];
  });
}

function buildChestGeometry(THREE, w, h) {
  const chestTop = 0.14 * h;
  const neckY = 0.16 * h;
  const waistHW = 0.058 * w;
  const shoulderHW = 0.085 * w;
  const chestDepth = 0.072 * w;

  return buildParametricGrid(THREE, 64, 48, (u, v) => {
    const phi = u * Math.PI * 2;
    const cx = -Math.cos(phi); // -1 right, +1 left
    const cz = Math.sin(phi);  // +1 front, -1 back

    // Map v in [0, 1]:
    // 0.00..0.06: rolled inner waist lip curling around the waist ball
    // 0.06..0.84: main continuous torso surface from waist cut line to shoulders
    // 0.84..0.95: trapezius shoulder-to-neck slope
    // 0.95..1.00: neck socket collar rim curling inward
    let t, rx, rz, y;

    // Curved BJD torso joint cut line along bottom edge
    const cutCurve = (-0.009 * cz * cz + 0.011 * cx * cx - 0.003 * cz) * h;

    if (v < 0.06) {
      const k = v / 0.06; // 0 = inner socket rim, 1 = outer bottom lip
      const lip = Math.sin(k * Math.PI * 0.5);
      rx = lerp(0.046 * w, waistHW, lip);
      rz = lerp(0.044 * w, 0.056 * w, lip);
      y = cutCurve + lerp(0.012 * h, 0.0, k);
    } else if (v <= 0.84) {
      t = (v - 0.06) / 0.78; // 0 at waist, 1 at shoulder line
      const yBase = lerp(0.0, chestTop, t);
      y = yBase + cutCurve * Math.pow(1 - t, 1.8);

      // Smooth anatomical torso width & depth curve
      const waistPinch = -0.004 * w * gauss(t - 0.14, 0.16);
      const ribSwell = 0.006 * w * gauss(t - 0.62, 0.24);
      rx = lerp(waistHW, shoulderHW, smoothstep(0.0, 0.92, t)) + waistPinch + ribSwell;
      rz = lerp(0.056 * w, chestDepth, smoothstep(0.0, 0.62, t))
         - 0.008 * w * smoothstep(0.70, 1.0, t);

      // Gentle chest volume in front
      const frontMask = smoothstep(-0.1, 0.85, cz);
      const chestVol = 0.0095 * w * gauss(t - 0.60, 0.20) * frontMask * gauss(Math.abs(cx) - 0.24, 0.42);
      const sternum = -0.0018 * w * gauss(cx, 0.14) * gauss(t - 0.64, 0.18) * frontMask;

      // Subtle back spine furrow & shoulder-blade hints
      const backMask = smoothstep(-0.1, 0.85, -cz);
      const spineFurrow = -0.0032 * w * gauss(cx, 0.15) * gauss(t - 0.48, 0.34) * backMask;
      const scapula = 0.0042 * w * gauss(Math.abs(cx) - 0.44, 0.22) * gauss(t - 0.72, 0.16) * backMask;

      // Shallow shoulder socket dimple on outer sides near y = 0.135*h (t ~ 0.95)
      const sideMask = smoothstep(0.68, 0.98, Math.abs(cx));
      const shoulderSocket = -0.0065 * w * sideMask * gauss(t - 0.90, 0.13);

      rx += shoulderSocket;
      rz += chestVol + sternum + spineFurrow + scapula;
    } else if (v <= 0.95) {
      const k = (v - 0.84) / 0.11;
      const ease = smoothstep(0, 1, k);
      rx = lerp(shoulderHW - 0.005 * w, 0.032 * w, ease);
      rz = lerp(0.062 * w, 0.032 * w, ease);
      // Rounded dome over the shoulders sloping gracefully up to neck collar
      const shoulderArc = 0.010 * h * Math.sin(k * Math.PI);
      y = lerp(chestTop, neckY + 0.002 * h, ease) + shoulderArc;
    } else {
      const k = (v - 0.95) / 0.05;
      rx = lerp(0.032 * w, 0.022 * w, k);
      rz = lerp(0.032 * w, 0.022 * w, k);
      y = lerp(neckY + 0.002 * h, neckY - 0.008 * h, k);
    }

    // Subtle posture curve (gentle natural lumbar sway)
    const zShift = 0.003 * w * Math.sin(clamp((v - 0.06) / 0.78, 0, 1) * Math.PI);
    return [cx * rx, y, cz * rz + zShift];
  });
}

function buildPelvisGeometry(THREE, w, h) {
  const topY = 0.095 * h;
  const hipHW = 0.080 * w;
  const hipDepth = 0.075 * w;

  return buildParametricGrid(THREE, 64, 42, (u, v) => {
    const phi = u * Math.PI * 2;
    const cx = -Math.cos(phi);
    const cz = Math.sin(phi);

    // v = 0: bottom center crotch pole; v = 1: inner waist cup
    let rx, rz, y;

    if (v <= 0.88) {
      const t = v / 0.88; // 0 = bottom, 1 = waist rim
      const theta = lerp(Math.PI, 0.30 * Math.PI, t);
      const s = Math.sin(theta);

      // Rounded hip block profile: gentle tummy in front, cute fuller seat in back
      const waistTransition = smoothstep(0.58, 1.0, t);
      const baseRx = lerp(hipHW, 0.060 * w, waistTransition);
      const baseRz = lerp(hipDepth, 0.056 * w, waistTransition);

      const env = t < 0.35 ? Math.pow(s, 0.65) : 1.0;
      rx = baseRx * env;
      rz = baseRz * env;

      y = lerp(-0.024, topY + 0.005 * h, smoothstep(0.0, 1.0, t));

      // Subtle back fullness (doll seat) and front soft tummy
      const backFull = 0.0075 * w * smoothstep(-0.1, 0.85, -cz) * gauss(t - 0.42, 0.24);
      const frontSoft = 0.0035 * w * smoothstep(0.1, 0.9, cz) * gauss(t - 0.56, 0.22);
      rz += backFull + frontSoft;

      // Leg sockets cut as shallow dimples around (+/-0.045*w, 0, 0)
      const px = cx * rx;
      const pz = cz * rz;
      const dL = Math.hypot(px - 0.048 * w, y - 0.002, pz);
      const dR = Math.hypot(px + 0.048 * w, y - 0.002, pz);
      const dMin = Math.min(dL, dR);
      const dimple = smoothstep(0.048 * w, 0.012 * w, dMin) * smoothstep(0.55, 0.18, t);

      // Indent gently inward and slightly upward toward hip center
      const indent = 0.011 * w * dimple;
      return [
        px - Math.sign(px || 1) * indent * 0.65,
        y + indent * 0.72,
        pz * (1 - 0.14 * dimple),
      ];
    } else {
      // Top rim curls smoothly inward to cradle the waist ball
      const k = (v - 0.88) / 0.12;
      rx = lerp(0.060 * w, 0.042 * w, k);
      rz = lerp(0.056 * w, 0.040 * w, k);
      y = lerp(topY + 0.005 * h, topY - 0.014 * h, k);
      return [cx * rx, y, cz * rz];
    }
  });
}

function buildLimbGeometry(THREE, cfg) {
  const {
    length,
    rTop,
    rBot,
    topBallR,
    botBallR,
    profileFn,
  } = cfg;

  // Limb segment spans from near top ball down to near bottom ball,
  // with shallow rolled socket rims at both ends cradling the ball joints.
  const yTopOuter = -topBallR * 0.46;
  const yBotOuter = -length + botBallR * 0.46;

  return buildParametricGrid(THREE, 40, 36, (u, v) => {
    const phi = u * Math.PI * 2;
    const cx = -Math.cos(phi);
    const cz = Math.sin(phi);

    // v = 0..0.07: lower socket rim curling inward toward lower ball
    // v = 0.07..0.93: main limb shaft from distal (0) to proximal (1)
    // v = 0.93..1.00: upper socket rim curling inward toward upper ball
    let y, rx, rz, zOff = 0, xOff = 0;

    if (v < 0.07) {
      const k = v / 0.07; // 0 = inner socket edge, 1 = outer rim lip
      const lip = Math.sin(k * Math.PI * 0.5);
      const rRim = Math.max(rBot, botBallR * 0.96);
      const rIn = botBallR * 0.74;
      rx = lerp(rIn, rRim, lip);
      rz = rx;
      y = lerp(yBotOuter + botBallR * 0.24, yBotOuter, k);
    } else if (v > 0.93) {
      const k = (v - 0.93) / 0.07; // 0 = outer rim lip, 1 = inner socket edge
      const lip = Math.cos(k * Math.PI * 0.5);
      const rRim = Math.max(rTop, topBallR * 0.96);
      const rIn = topBallR * 0.74;
      rx = lerp(rIn, rRim, lip);
      rz = rx;
      y = lerp(yTopOuter, yTopOuter - topBallR * 0.24, k);
    } else {
      const t = (v - 0.07) / 0.86; // 0 at bottom (distal), 1 at top (proximal)
      y = lerp(yBotOuter, yTopOuter, t);

      // Subtle flare right at socket rims
      const botRim = Math.max(0, botBallR * 0.96 - rBot) * Math.pow(1 - t, 5);
      const topRim = Math.max(0, topBallR * 0.96 - rTop) * Math.pow(t, 5);
      const baseR = lerp(rBot, rTop, t) + botRim + topRim;

      const mod = profileFn ? profileFn(t, cx, cz) : null;
      rx = baseR * (mod ? mod.sx : 1);
      rz = baseR * (mod ? mod.sz : 1);
      if (mod) {
        if (mod.dr) {
          rx += mod.dr;
          rz += mod.dr;
        }
        zOff = mod.zOff || 0;
        xOff = mod.xOff || 0;
      }
    }

    return [cx * rx + xOff, y, cz * rz + zOff];
  });
}

function buildCurvedTube(THREE, radialSegs, lengthSegs, pathFn) {
  // Sample centerline points including smooth rounded start & end dome caps
  const samples = [];
  const capSteps = 4;

  // Start cap
  const p0 = pathFn(0);
  const p1 = pathFn(0.02);
  let t0x = p1.x - p0.x, t0y = p1.y - p0.y, t0z = p1.z - p0.z;
  const t0l = Math.hypot(t0x, t0y, t0z) || 1;
  t0x /= t0l; t0y /= t0l; t0z /= t0l;

  for (let i = 0; i < capSteps; i++) {
    const a = (i / capSteps) * (Math.PI * 0.5);
    const s = Math.max(0.02, Math.sin(a));
    const c = Math.cos(a);
    samples.push({
      x: p0.x - t0x * p0.r * c * 0.6,
      y: p0.y - t0y * p0.r * c * 0.6,
      z: p0.z - t0z * p0.r * c * 0.6,
      r: p0.r * s,
      v: 1.0,
    });
  }

  for (let i = 0; i <= lengthSegs; i++) {
    const t = i / lengthSegs;
    const p = pathFn(t);
    samples.push({ x: p.x, y: p.y, z: p.z, r: p.r, v: 1 - t });
  }

  // End rounded fingertip cap
  const pe = pathFn(1);
  const pb = pathFn(0.98);
  let tex = pe.x - pb.x, tey = pe.y - pb.y, tez = pe.z - pb.z;
  const tel = Math.hypot(tex, tey, tez) || 1;
  tex /= tel; tey /= tel; tez /= tel;

  for (let i = 1; i <= capSteps; i++) {
    const a = (i / capSteps) * (Math.PI * 0.5);
    const c = Math.max(0.02, Math.cos(a));
    const s = Math.sin(a);
    samples.push({
      x: pe.x + tex * pe.r * s * 0.95,
      y: pe.y + tey * pe.r * s * 0.95,
      z: pe.z + tez * pe.r * s * 0.95,
      r: pe.r * c,
      v: 0.0,
    });
  }

  const rows = samples.length;
  const cols = radialSegs + 1;
  const positions = new Float32Array(rows * cols * 3);
  const uvs = new Float32Array(rows * cols * 2);

  // Build parallel-transport frame (N, B, T) with N x B = T
  let prevN = null;
  for (let iv = 0; iv < rows; iv++) {
    const cur = samples[iv];
    const prv = samples[Math.max(0, iv - 1)];
    const nxt = samples[Math.min(rows - 1, iv + 1)];
    let tx = nxt.x - prv.x, ty = nxt.y - prv.y, tz = nxt.z - prv.z;
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl; ty /= tl; tz /= tl;

    let nx, ny, nz;
    if (!prevN) {
      // Pick reference vector not parallel to T
      const rx = Math.abs(tx) < 0.8 ? 1 : 0;
      const ry = Math.abs(tx) < 0.8 ? 0 : 1;
      const rz = 0;
      // N = normalize(ref - (ref.T)T)
      const dot = rx * tx + ry * ty + rz * tz;
      nx = rx - dot * tx;
      ny = ry - dot * ty;
      nz = rz - dot * tz;
    } else {
      const dot = prevN[0] * tx + prevN[1] * ty + prevN[2] * tz;
      nx = prevN[0] - dot * tx;
      ny = prevN[1] - dot * ty;
      nz = prevN[2] - dot * tz;
    }
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    prevN = [nx, ny, nz];

    // B = T x N so that N x B = T (and B x T = N -> outward normals!)
    const bx = ty * nz - tz * ny;
    const by = tz * nx - tx * nz;
    const bz = tx * ny - ty * nx;

    for (let iu = 0; iu <= radialSegs; iu++) {
      const u = iu / radialSegs;
      const a = u * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const idx = iv * cols + iu;
      positions[idx * 3]     = cur.x + cur.r * (ca * nx + sa * bx);
      positions[idx * 3 + 1] = cur.y + cur.r * (ca * ny + sa * by);
      positions[idx * 3 + 2] = cur.z + cur.r * (ca * nz + sa * bz);
      uvs[idx * 2]     = u;
      uvs[idx * 2 + 1] = cur.v;
    }
  }

  const indices = [];
  for (let iv = 0; iv < rows - 1; iv++) {
    for (let iu = 0; iu < radialSegs; iu++) {
      const i00 = iv * cols + iu;
      const i10 = i00 + 1;
      const i01 = i00 + cols;
      const i11 = i01 + 1;
      indices.push(i00, i10, i11);
      indices.push(i00, i11, i01);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  // Stitch seam normals
  const normAttr = geo.getAttribute('normal');
  const norm = normAttr.array;
  for (let iv = 0; iv < rows; iv++) {
    const a = (iv * cols) * 3;
    const b = (iv * cols + radialSegs) * 3;
    const nx = norm[a] + norm[b];
    const ny = norm[a + 1] + norm[b + 1];
    const nz = norm[a + 2] + norm[b + 2];
    const len = Math.hypot(nx, ny, nz) || 1;
    norm[a] = norm[b] = nx / len;
    norm[a + 1] = norm[b + 1] = ny / len;
    norm[a + 2] = norm[b + 2] = nz / len;
  }
  normAttr.needsUpdate = true;
  return geo;
}

function buildHandGroup(THREE, side, w, skinMat, jointMat) {
  const group = new THREE.Group();
  const hwScale = 0.45 + 0.55 * w;

  // Wrist ball joint
  const wristBall = tagMesh(
    new THREE.Mesh(new THREE.SphereGeometry(RIG.joints.wrist * w, 32, 24), jointMat)
  );
  group.add(wristBall);

  // Sculpted palm: hangs down along -y, palm faces inward (-side * x), thumb on +z
  const palmGeo = buildParametricGrid(THREE, 36, 26, (u, v) => {
    const phi = u * Math.PI * 2;
    const cx = -Math.cos(phi);
    const cz = Math.sin(phi);

    // v = 0 at knuckle base (y = -0.032), v = 1 at wrist cuff (y = -0.006)
    const y = lerp(-0.0325, -0.0055, v);

    // Taper smoothly at both ends into rounded cushions
    const botCap = v < 0.14 ? Math.sqrt(Math.max(0.01, 1 - Math.pow((0.14 - v) / 0.14, 2))) : 1.0;
    const topCap = v > 0.88 ? Math.sqrt(Math.max(0.04, 1 - Math.pow((v - 0.88) / 0.12, 2))) : 1.0;

    // Wider along Z near knuckles, narrower near wrist
    const rz = lerp(0.0138, 0.0095, smoothstep(0.10, 0.92, v)) * hwScale * botCap * topCap;
    const rx = lerp(0.0062, 0.0085, smoothstep(0.05, 0.90, v)) * hwScale * botCap * topCap;

    // Soft thumb pad (thenar eminence) on inner palm +z side
    const palmMask = smoothstep(-0.1, 0.85, -side * cx);
    const thenar = 0.0028 * hwScale * palmMask * smoothstep(-0.1, 0.8, cz) * gauss(v - 0.52, 0.24);
    const palmHollow = -0.0014 * hwScale * palmMask * gauss(cz, 0.45) * gauss(v - 0.34, 0.22);
    // Slight knuckle bump on dorsal side (+side * x)
    const dorsalMask = smoothstep(-0.1, 0.85, side * cx);
    const knuckle = 0.0014 * hwScale * dorsalMask * gauss(v - 0.16, 0.12);

    return [
      cx * (rx + thenar + palmHollow + knuckle) - side * 0.0012 * (1 - v),
      y,
      cz * rz,
    ];
  });
  group.add(tagMesh(new THREE.Mesh(palmGeo, skinMat)));

  // Four fingers as slightly curled tapered tubes with distinct gap lines between them
  const fingerSpecs = [
    // index, middle, ring, pinky (ordered from +z to -z)
    { z0:  0.0096, len: 0.0225, r0: 0.0030, r1: 0.0021, curl: 0.28, splay:  0.0012, y0: -0.0305 },
    { z0:  0.0033, len: 0.0245, r0: 0.0031, r1: 0.0022, curl: 0.35, splay:  0.0003, y0: -0.0315 },
    { z0: -0.0031, len: 0.0225, r0: 0.0029, r1: 0.0020, curl: 0.43, splay: -0.0005, y0: -0.0308 },
    { z0: -0.0092, len: 0.0178, r0: 0.0025, r1: 0.0018, curl: 0.52, splay: -0.0014, y0: -0.0290 },
  ];

  for (const f of fingerSpecs) {
    const fGeo = buildCurvedTube(THREE, 32, 16, (t) => {
      const curveAngle = f.curl * t * t;
      const x = -side * (0.0008 + f.len * Math.sin(curveAngle) * 0.72);
      const y = f.y0 - f.len * t * Math.cos(curveAngle * 0.65);
      const z = (f.z0 + f.splay * t) * hwScale;
      const knucklePinch = 1.0 + 0.04 * Math.sin(t * Math.PI * 2);
      const r = lerp(f.r0, f.r1, t) * hwScale * knucklePinch;
      return { x, y, z, r };
    });
    group.add(tagMesh(new THREE.Mesh(fGeo, skinMat)));
  }

  // Separate thumb angling gently forward (+z), downward (-y), and slightly inward (-side * x)
  const thumbGeo = buildCurvedTube(THREE, 32, 16, (t) => {
    const x = -side * (0.0032 + 0.0068 * Math.pow(t, 1.15)) * hwScale;
    const y = -0.0155 - 0.0185 * t;
    const z = (0.0102 + 0.0122 * Math.sin(t * Math.PI * 0.58)) * hwScale;
    const r = lerp(0.0037, 0.0025, t) * hwScale;
    return { x, y, z, r };
  });
  group.add(tagMesh(new THREE.Mesh(thumbGeo, skinMat)));

  return group;
}

function buildFootGeometry(THREE, side, w) {
  // Ankle pivot is at (0, 0, 0) (world y = 0.065).
  // Foot rests on floor at y = -0.065, 0.085 long (z from -0.024 to +0.061),
  // 0.040 high (y from -0.065 to -0.025), 0.040*w wide.
  const soleY = -0.065;
  const footLen = 0.085;
  const zHeel = -0.024;
  const zToe = zHeel + footLen; // +0.061
  const halfW = 0.020 * w;

  const footGeo = buildParametricGrid(THREE, 44, 40, (u, v) => {
    // v in [0, 1] runs lengthwise from heel tip (0) to toe tip (1)
    const a = u * Math.PI * 2;
    const ca = Math.cos(a); // +1 toward +x, -1 toward -x
    const sa = Math.sin(a); // +1 top of foot, -1 sole of foot

    // Smooth cap envelope at heel (v=0) and toes (v=1)
    const heelCap = v < 0.14 ? Math.sqrt(Math.max(0.001, 1 - Math.pow((0.14 - v) / 0.14, 2))) : 1.0;
    const toeCap = v > 0.82 ? Math.sqrt(Math.max(0.001, 1 - Math.pow((v - 0.82) / 0.18, 2))) : 1.0;

    // Width profile: narrower heel, slight midfoot waist, wider ball of foot
    const widthShape = 0.76 + 0.26 * smoothstep(0.16, 0.72, v) - 0.06 * gauss(v - 0.38, 0.16);
    const rx = halfW * widthShape * heelCap * toeCap;

    // Slight anatomical asymmetry: big toe is on the medial side (-side * x)
    const medialMask = smoothstep(-0.15, 0.85, -side * ca);
    const lateralMask = smoothstep(-0.15, 0.85, side * ca);

    // Height profile: rounded heel, raised instep/dorsum, low delicate toes
    const topH = (
      0.036 * smoothstep(0.0, 0.22, v) * (1 - 0.54 * smoothstep(0.32, 0.88, v))
      + 0.008 * gauss(v - 0.24, 0.16)
    ) * heelCap * toeCap;

    // Sole profile: flat heel and forefoot resting cleanly at soleY, smooth medial arch!
    const archLift = 0.0068 * gauss(v - 0.42, 0.16) * (0.25 + 0.75 * medialMask);
    const toeSpring = 0.0026 * smoothstep(0.84, 1.0, v);

    let y;
    if (sa >= 0) {
      // Upper surface (instep / dorsum)
      const dome = Math.pow(sa, 0.78);
      y = soleY + archLift + toeSpring + topH * dome + 0.004 * heelCap * toeCap;
    } else {
      // Sole surface: gently flattened underside so foot sits firmly on floor
      const flat = 1 - Math.pow(Math.abs(sa), 2.4);
      y = soleY + archLift + toeSpring + 0.004 * flat * heelCap * toeCap;
    }

    // Centerline x shifts subtly inward at forefoot
    const xCenter = -side * 0.0015 * w * smoothstep(0.30, 0.85, v);
    const x = xCenter + ca * rx;

    // Toe line contour: big toe side extends slightly further forward than pinky side,
    // plus subtle scalloped toe-line undulations across the front rim
    let z = lerp(zHeel, zToe, v);
    const toeFront = smoothstep(0.70, 1.0, v);
    z += toeFront * (0.0032 * medialMask - 0.0042 * lateralMask);
    const toeRipple = 0.0011 * Math.sin((ca * side + 0.6) * Math.PI * 2.5) * smoothstep(0.84, 0.99, v);
    z += toeRipple;

    return [x, y, z];
  });

  // Ankle collar rising cleanly from top of foot instep up to cradle the ankle ball
  const collarGeo = buildParametricGrid(THREE, 36, 18, (u, v) => {
    const phi = u * Math.PI * 2;
    const cx = -Math.cos(phi);
    const cz = Math.sin(phi);

    // v = 0 inside foot top (y = -0.042), v = 0.82 outer ankle socket rim (y = -0.010), v = 1 inner rim
    let y, rx, rz;
    if (v <= 0.82) {
      const t = v / 0.82;
      y = lerp(-0.044, -0.010, t);
      const rBase = lerp(0.0195 * w, 0.0198 * w, t);
      // Subtle ankle bone (malleoli) fullness on left/right sides near y = -0.016
      const malleolus = 0.0018 * w * gauss(t - 0.72, 0.22) * smoothstep(0.5, 0.95, Math.abs(cx));
      rx = rBase + malleolus;
      rz = lerp(0.023 * w, 0.0198 * w, t);
    } else {
      const k = (v - 0.82) / 0.18;
      y = lerp(-0.010, -0.016, k);
      rx = lerp(0.0198 * w, 0.0155 * w, k);
      rz = rx;
    }
    const zOff = lerp(0.004, 0.0, Math.min(1, v / 0.82));
    return [cx * rx, y, cz * rz + zOff];
  });

  return { footGeo, collarGeo };
}

export function buildBody(THREE, opts = {}, kit) {
  const skin = opts.skin ?? '#f6d8c6';
  const w = clamp(opts.bodyWidth ?? 1.0, 0.8, 1.3);
  const h = clamp(opts.bodyHeight ?? 1.0, 0.9, 1.1);

  // Materials (all MeshPhysicalMaterial, resin skin + slightly glossier joints)
  const headMat = makeSkinMaterial(THREE, skin, makeHeadBlushTexture(THREE, kit), false);
  const torsoMat = makeSkinMaterial(THREE, skin, makeTorsoBlushTexture(THREE, kit), false);
  const upperArmMat = makeSkinMaterial(THREE, skin, makeLimbBlushTexture(THREE, kit, {
    topBlush: 0.09, topDir: 'all', botBlush: 0.16, botDir: 'back',
  }), false);
  const forearmMat = makeSkinMaterial(THREE, skin, makeLimbBlushTexture(THREE, kit, {
    topBlush: 0.16, topDir: 'back', botBlush: 0.08, botDir: 'all',
  }), false);
  const thighMat = makeSkinMaterial(THREE, skin, makeLimbBlushTexture(THREE, kit, {
    topBlush: 0.07, topDir: 'all', botBlush: 0.19, botDir: 'front',
  }), false);
  const shinMat = makeSkinMaterial(THREE, skin, makeLimbBlushTexture(THREE, kit, {
    topBlush: 0.19, topDir: 'front', botBlush: 0.10, botDir: 'all',
  }), false);
  const handMat = makeSkinMaterial(THREE, skin, makeHandBlushTexture(THREE, kit), false);
  const footMat = makeSkinMaterial(THREE, skin, makeFootBlushTexture(THREE, kit), false);
  const jointMat = makeSkinMaterial(THREE, skin, makeJointTexture(THREE, kit), true);

  // Build pivot hierarchy
  const pivots = {};
  for (const name of PIVOT_NAMES) {
    const g = new THREE.Group();
    g.name = name;
    pivots[name] = g;
  }

  // Pelvis height keeps foot soles anchored on floor y = 0 for all bodyHeight values
  const pelvisY = 0.065 + (0.16 + 0.16) * h;
  const scaledPos = {
    root:     [0, 0, 0],
    pelvis:   [0, pelvisY, 0],
    chest:    [0, 0.095 * h, 0],
    neck:     [0, 0.16 * h, 0],
    head:     [0, 0.05 * h, 0],
    armL:     [0.105 * w, 0.135 * h, 0],
    armR:     [-0.105 * w, 0.135 * h, 0],
    forearmL: [0, -0.12 * h, 0],
    forearmR: [0, -0.12 * h, 0],
    handL:    [0, -0.11 * h, 0],
    handR:    [0, -0.11 * h, 0],
    legL:     [0.045 * w, 0, 0],
    legR:     [-0.045 * w, 0, 0],
    shinL:    [0, -0.16 * h, 0],
    shinR:    [0, -0.16 * h, 0],
    footL:    [0, -0.16 * h, 0],
    footR:    [0, -0.16 * h, 0],
  };

  for (const name of PIVOT_NAMES) {
    const spec = RIG[name];
    const p = scaledPos[name];
    pivots[name].position.set(p[0], p[1], p[2]);
    pivots[name].rotation.set(spec.rot[0], spec.rot[1], spec.rot[2]);
    if (spec.parent) {
      pivots[spec.parent].add(pivots[name]);
    }
  }

  const root = pivots.root;
  root.userData.faceDirection = FACE_DIR.slice();
  root.userData.rig = RIG;
  pivots.head.userData.faceDirection = FACE_DIR.slice();

  // --- PELVIS ---
  pivots.pelvis.add(tagMesh(new THREE.Mesh(buildPelvisGeometry(THREE, w, h), torsoMat)));

  // --- CHEST & WAIST BALL ---
  pivots.chest.add(tagMesh(
    new THREE.Mesh(new THREE.SphereGeometry(RIG.joints.waist * w, 36, 28), jointMat)
  ));
  pivots.chest.add(tagMesh(new THREE.Mesh(buildChestGeometry(THREE, w, h), torsoMat)));

  // --- NECK & NECK BALLS ---
  pivots.neck.add(tagMesh(
    new THREE.Mesh(new THREE.SphereGeometry(RIG.joints.neck * w, 32, 24), jointMat)
  ));
  pivots.neck.add(tagMesh(new THREE.Mesh(buildNeckGeometry(THREE, w, h), torsoMat)));

  // Upper neck pivot ball nested inside skull socket for gap-free head tilt
  const headSocketBall = tagMesh(
    new THREE.Mesh(new THREE.SphereGeometry(RIG.joints.neck * 0.94 * w, 32, 24), jointMat)
  );
  headSocketBall.position.set(0, 0.05 * h, 0);
  pivots.neck.add(headSocketBall);

  // --- HEAD & EARS (never scaled by bodyWidth/bodyHeight) ---
  pivots.head.add(tagMesh(new THREE.Mesh(buildHeadGeometry(THREE), headMat)));

  for (const side of [1, -1]) {
    const ear = tagMesh(new THREE.Mesh(buildEarGeometry(THREE, side), headMat));
    ear.position.set(side * 0.144, 0.114, -0.010);
    ear.rotation.set(0.05, side * -0.22, side * -0.08);
    pivots.head.add(ear);
  }

  // --- ARMS, FOREARMS & HANDS ---
  const upperArmGeo = buildLimbGeometry(THREE, {
    length: 0.12 * h,
    rTop: 0.026 * w,
    rBot: 0.022 * w,
    topBallR: RIG.joints.shoulder * w,
    botBallR: RIG.joints.elbow * w,
    profileFn: (t, _cx, cz) => {
      // Slightly thicker in the middle (gentle bicep/tricep swell)
      const swell = 0.0026 * w * gauss(t - 0.50, 0.25);
      const deltoid = 0.0018 * w * gauss(t - 0.85, 0.15);
      return { sx: 0.96, sz: 1.03, dr: swell + deltoid, zOff: 0.0010 * w * Math.sin(t * Math.PI) * (cz > 0 ? 1 : 0.4) };
    },
  });

  const forearmGeo = buildLimbGeometry(THREE, {
    length: 0.11 * h,
    rTop: 0.022 * w,
    rBot: 0.017 * w,
    topBallR: RIG.joints.elbow * w,
    botBallR: RIG.joints.wrist * w,
    profileFn: (t) => {
      // Thicker near the elbow, tapering delicately to the wrist
      const swell = 0.0032 * w * gauss(t - 0.74, 0.22);
      return { sx: 0.95, sz: 1.04, dr: swell };
    },
  });

  const shoulderBallGeo = new THREE.SphereGeometry(RIG.joints.shoulder * w, 36, 28);
  const elbowBallGeo = new THREE.SphereGeometry(RIG.joints.elbow * w, 32, 24);

  for (const [side, suf] of [[1, 'L'], [-1, 'R']]) {
    const arm = pivots[`arm${suf}`];
    const forearm = pivots[`forearm${suf}`];
    const hand = pivots[`hand${suf}`];

    arm.add(tagMesh(new THREE.Mesh(shoulderBallGeo, jointMat)));
    arm.add(tagMesh(new THREE.Mesh(upperArmGeo, upperArmMat)));

    forearm.add(tagMesh(new THREE.Mesh(elbowBallGeo, jointMat)));
    forearm.add(tagMesh(new THREE.Mesh(forearmGeo, forearmMat)));

    hand.add(buildHandGroup(THREE, side, w, handMat, jointMat));
  }

  // --- LEGS, SHINS & FEET ---
  const hipBallGeo = new THREE.SphereGeometry(RIG.joints.hip * w, 36, 28);
  const kneeBallGeo = new THREE.SphereGeometry(RIG.joints.knee * w, 36, 28);
  const ankleBallGeo = new THREE.SphereGeometry(RIG.joints.ankle * w, 32, 24);

  for (const [side, suf] of [[1, 'L'], [-1, 'R']]) {
    const leg = pivots[`leg${suf}`];
    const shin = pivots[`shin${suf}`];
    const foot = pivots[`foot${suf}`];

    const thighGeo = buildLimbGeometry(THREE, {
      length: 0.16 * h,
      rTop: 0.042 * w,
      rBot: 0.032 * w,
      topBallR: RIG.joints.hip * w,
      botBallR: RIG.joints.knee * w,
      profileFn: (t, cx, cz) => {
        // Soft chibi thigh fullness slightly toward front and outer side
        const midSwell = 0.0042 * w * gauss(t - 0.64, 0.26);
        const frontQuad = 0.0022 * w * smoothstep(-0.1, 0.9, cz) * gauss(t - 0.56, 0.24);
        const outerCurve = 0.0018 * w * smoothstep(0.0, 0.9, side * cx) * gauss(t - 0.68, 0.24);
        return {
          sx: 0.99,
          sz: 1.03,
          dr: midSwell + frontQuad + outerCurve,
          zOff: 0.0015 * w * Math.sin(t * Math.PI),
        };
      },
    });

    const shinGeo = buildLimbGeometry(THREE, {
      length: 0.16 * h,
      rTop: 0.032 * w,
      rBot: 0.022 * w,
      topBallR: RIG.joints.knee * w,
      botBallR: RIG.joints.ankle * w,
      profileFn: (t, _cx, cz) => {
        // Distinct calf bulge on the back (-z) of the shin
        const calf = 0.0062 * w * gauss(t - 0.64, 0.20) * smoothstep(-0.2, 0.9, -cz);
        const shinFront = -0.0012 * w * gauss(t - 0.45, 0.26) * smoothstep(0.2, 0.95, cz);
        const ankleSlim = -0.0018 * w * gauss(t - 0.14, 0.12);
        return {
          sx: 0.96,
          sz: 1.02,
          dr: calf + shinFront + ankleSlim,
          zOff: -0.0036 * w * gauss(t - 0.62, 0.20),
        };
      },
    });

    leg.add(tagMesh(new THREE.Mesh(hipBallGeo, jointMat)));
    leg.add(tagMesh(new THREE.Mesh(thighGeo, thighMat)));

    shin.add(tagMesh(new THREE.Mesh(kneeBallGeo, jointMat)));
    shin.add(tagMesh(new THREE.Mesh(shinGeo, shinMat)));

    foot.add(tagMesh(new THREE.Mesh(ankleBallGeo, jointMat)));
    const { footGeo, collarGeo } = buildFootGeometry(THREE, side, w);
    foot.add(tagMesh(new THREE.Mesh(footGeo, footMat)));
    foot.add(tagMesh(new THREE.Mesh(collarGeo, footMat)));
  }

  return root;
}

export function pose(root, name = 'stand', t = 0) {
  if (!root) return;

  const p = {};
  for (const key of PIVOT_NAMES) {
    const obj = key === 'root' ? root : root.getObjectByName(key);
    if (obj) {
      p[key] = obj;
      const r = RIG[key].rot;
      obj.rotation.set(r[0], r[1], r[2]);
    }
  }

  const setR = (key, x, y, z) => {
    if (p[key]) p[key].rotation.set(x, y, z);
  };

  const breath = Math.sin(t * 1.8) * 0.012;

  switch (name) {
    case 'stand': {
      // Weight on right leg, gentle contrapposto, slight head tilt
      setR('pelvis', 0.02, -0.08, -0.07);
      setR('chest', -0.02 + breath, 0.08, 0.09);
      setR('neck', 0.03, 0.03, 0.04);
      setR('head', 0.04 + breath * 0.5, 0.06, 0.11);

      setR('legR', 0.02, 0.04, 0.07);
      setR('shinR', 0.03, 0, 0);
      setR('footR', -0.04, 0.04, 0.00);

      setR('legL', -0.14, 0.14, 0.12);
      setR('shinL', 0.22, 0, 0);
      setR('footL', -0.08, 0.05, -0.05);

      setR('armL', 0.04, 0.04, 0.19 + breath);
      setR('forearmL', -0.22, 0, -0.05);
      setR('handL', 0.05, 0.06, -0.06);

      setR('armR', -0.05, -0.04, -0.17 - breath);
      setR('forearmR', -0.18, 0, 0.04);
      setR('handR', 0.04, -0.06, 0.05);
      break;
    }

    case 'walk': {
      const phase = t * 3.4 + 0.65;
      const s = Math.sin(phase);
      const liftL = Math.max(0, Math.sin(phase - 0.85));
      const liftR = Math.max(0, Math.sin(phase + Math.PI - 0.85));

      setR('pelvis', 0.04, -0.14 * s, 0.05 * s);
      setR('chest', 0.04, 0.18 * s, -0.05 * s);
      setR('neck', -0.02, -0.03 * s, 0.01 * s);
      setR('head', -0.03, -0.04 * s, 0.03 * s);

      setR('legL', -0.44 * s, 0, 0.03);
      setR('shinL', 0.08 + 0.62 * liftL, 0, 0);
      setR('footL', 0.18 * s - 0.18 * liftL, 0, 0);

      setR('legR', 0.44 * s, 0, -0.03);
      setR('shinR', 0.08 + 0.62 * liftR, 0, 0);
      setR('footR', -0.18 * s - 0.18 * liftR, 0, 0);

      setR('armL', 0.40 * s, 0, 0.16);
      setR('forearmL', -0.22 - 0.36 * Math.max(0, -s), 0, 0);
      setR('handL', 0.06, 0, -0.04);

      setR('armR', -0.40 * s, 0, -0.16);
      setR('forearmR', -0.22 - 0.36 * Math.max(0, s), 0, 0);
      setR('handR', 0.06, 0, 0.04);
      break;
    }

    case 'sit': {
      setR('pelvis', -0.06, 0, 0);
      setR('chest', 0.10 + breath, 0, 0);
      setR('neck', 0.02, 0, 0);
      setR('head', 0.04, 0.05, 0.06);

      setR('legL', -1.48, 0.06, 0.10);
      setR('shinL', 1.42, 0, 0);
      setR('footL', 0.18, 0.04, 0);

      setR('legR', -1.48, -0.06, -0.10);
      setR('shinR', 1.42, 0, 0);
      setR('footR', 0.18, -0.04, 0);

      setR('armL', -0.32, 0.10, 0.20);
      setR('forearmL', -0.84, 0.10, -0.22);
      setR('handL', 0.16, -0.25, -0.14);

      setR('armR', -0.32, -0.10, -0.20);
      setR('forearmR', -0.84, -0.10, 0.22);
      setR('handR', 0.16, 0.25, 0.14);
      break;
    }

    case 'wave': {
      const wave = Math.sin(t * 5.2);
      setR('pelvis', 0.01, -0.06, -0.04);
      setR('chest', -0.03 + breath, 0.08, -0.05);
      setR('neck', 0, 0.04, -0.04);
      setR('head', -0.03, 0.06, -0.10 + 0.03 * wave);

      setR('armL', -0.22, 0.10, 2.05);
      setR('forearmL', -0.12, 0, 0.62 + 0.26 * wave);
      setR('handL', 0, 1.35, 0.18 * wave);

      setR('armR', 0.05, -0.04, -0.22);
      setR('forearmR', -0.26, 0, 0.05);
      setR('handR', 0.05, 0, 0.06);

      setR('legR', 0.02, -0.04, 0.04);
      setR('shinR', 0.03, 0, 0);
      setR('footR', -0.03, 0, 0);

      setR('legL', -0.08, 0.08, 0.08);
      setR('shinL', 0.12, 0, 0);
      setR('footL', -0.04, 0, -0.04);
      break;
    }

    case 'think': {
      // Right hand raised thoughtfully toward the chin, left arm lightly folded
      setR('pelvis', 0.01, 0.08, 0.04);
      setR('chest', 0.02 + breath, -0.08, -0.05);
      setR('neck', 0.04, -0.04, -0.04);
      setR('head', 0.09, -0.10, -0.11);

      setR('armR', -1.15, 0.0, -0.12);
      setR('forearmR', -1.75, 0.0, 0.68);
      setR('handR', -0.24, -0.20, 0.14);

      setR('armL', -0.34, 0.12, 0.16);
      setR('forearmL', -1.25, 0.0, -0.58);
      setR('handL', 0.10, 0.15, -0.10);

      setR('legL', 0.02, -0.04, -0.04);
      setR('shinL', 0.03, 0, 0);
      setR('footL', -0.03, 0, 0);

      setR('legR', -0.10, -0.10, -0.10);
      setR('shinR', 0.16, 0, 0);
      setR('footR', -0.06, -0.04, 0.04);
      break;
    }

    default:
      break;
  }
}
export const ENTRANCE = [0, 0.15, 2.95];

const DEFAULT_ACCENT = 0x2251a8;

function setTexColorSpace(THREE, tex) {
  if (THREE.SRGBColorSpace) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
}

function roundedRectShape(THREE, w, h, r) {
  const s = new THREE.Shape();
  const hw = w * 0.5;
  const hh = h * 0.5;
  const cr = Math.min(r, hw * 0.9, hh * 0.9);
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

// Extrudes footprint (X, Z) along Y so side-wall UVs stay horizontal (u) & vertical (v)
function bevelledBlockGeo(THREE, w, h, d, r = 0.04, bevel = 0.018, segs = 3) {
  const b = Math.min(bevel, w * 0.25, h * 0.25, d * 0.25);
  const innerW = Math.max(0.002, w - b * 2);
  const innerD = Math.max(0.002, d - b * 2);
  const innerH = Math.max(0.002, h - b * 2);
  const shape = roundedRectShape(THREE, innerW, innerD, Math.max(0.002, r - b));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: innerH,
    bevelEnabled: b > 0.001,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
    curveSegments: segs,
  });
  geo.rotateX(-Math.PI * 0.5);
  geo.translate(0, -innerH * 0.5, 0);
  geo.computeVertexNormals();
  return geo;
}

function bevelledPanelGeo(THREE, w, h, d, r = 0.03, bevel = 0.012, segs = 3) {
  const b = Math.min(bevel, w * 0.25, h * 0.25, d * 0.25);
  const shape = roundedRectShape(THREE, Math.max(0.002, w - b * 2), Math.max(0.002, h - b * 2), Math.max(0.002, r - b));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.002, d - b * 2),
    bevelEnabled: b > 0.001,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
    curveSegments: segs,
  });
  geo.translate(0, 0, -Math.max(0.002, d - b * 2) * 0.5);
  geo.computeVertexNormals();
  return geo;
}

function lFootprintGeo(THREE, h, bevel = 0.02) {
  // L-shape matching main building (-3.22..+3.22, z -2.66..+1.46) + front-right interview bay (+0.94..+3.22, z +1.46..+1.82)
  const b = bevel;
  const s = new THREE.Shape();
  const r = 0.06;
  const xL = -3.22 + b;
  const xM = 0.94 + b;
  const xR = 3.22 - b;
  const yB = -2.66 + b;
  const yF1 = 1.46 - b;
  const yF2 = 1.82 - b;
  // Note: shape Y maps to -Z after rotateX(-PI/2), so negate Z coords in shape Y
  const zBack = -yB;
  const zFront1 = -yF1;
  const zFront2 = -yF2;

  s.moveTo(xL + r, zBack);
  s.lineTo(xR - r, zBack);
  s.quadraticCurveTo(xR, zBack, xR, zBack - r);
  s.lineTo(xR, zFront2 + r);
  s.quadraticCurveTo(xR, zFront2, xR - r, zFront2);
  s.lineTo(xM + r, zFront2);
  s.quadraticCurveTo(xM, zFront2, xM, zFront2 + r);
  s.lineTo(xM, zFront1 - r);
  s.quadraticCurveTo(xM, zFront1, xM - r, zFront1);
  s.lineTo(xL + r, zFront1);
  s.quadraticCurveTo(xL, zFront1, xL, zFront1 + r);
  s.lineTo(xL, zBack - r);
  s.quadraticCurveTo(xL, zBack, xL + r, zBack);

  const innerH = Math.max(0.01, h - b * 2);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: innerH,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
    curveSegments: 3,
  });
  geo.rotateX(-Math.PI * 0.5);
  geo.translate(0, -innerH * 0.5, 0);
  geo.computeVertexNormals();
  return geo;
}

function addMesh(THREE, parent, geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function pseudoRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// --- Procedural Textures ---

function makeBrickTexture(THREE, kit) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const rand = pseudoRand(4021);
    ctx.fillStyle = '#cfc4b5';
    ctx.fillRect(0, 0, w, h);

    const rows = 12;
    const cols = 6;
    const rowH = h / rows;
    const colW = w / cols;
    const mortar = 2.4;
    const palette = ['#b85d43', '#a9513a', '#c36a4e', '#9e4c38', '#be6246', '#b1573f'];

    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (colW * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * colW + offset;
        const y = r * rowH;
        const base = palette[Math.floor(rand() * palette.length)];
        ctx.fillStyle = base;
        ctx.fillRect(x + mortar * 0.5, y + mortar * 0.5, colW - mortar, rowH - mortar);

        // Subtle warm highlight along top edge and shade along bottom
        ctx.fillStyle = 'rgba(255,235,215,0.12)';
        ctx.fillRect(x + mortar * 0.5, y + mortar * 0.5, colW - mortar, 2.2);
        ctx.fillStyle = 'rgba(40,18,10,0.14)';
        ctx.fillRect(x + mortar * 0.5, y + rowH - mortar * 0.5 - 2.2, colW - mortar, 2.2);

        // Micro speckles
        for (let k = 0; k < 5; k++) {
          ctx.fillStyle = rand() > 0.5 ? 'rgba(255,240,220,0.08)' : 'rgba(50,20,12,0.09)';
          ctx.fillRect(x + 3 + rand() * (colW - 6), y + 2 + rand() * (rowH - 5), 2, 2);
        }
      }
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(0.75, 0.75);
  setTexColorSpace(THREE, tex);
  return tex;
}

function makePavingTexture(THREE, kit) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const rand = pseudoRand(9917);
    ctx.fillStyle = '#bdb5a8';
    ctx.fillRect(0, 0, w, h);

    const rows = 8;
    const cols = 4;
    const rowH = h / rows;
    const colW = w / cols;
    const gap = 2.5;
    const tones = ['#dfd8cb', '#d7cfc1', '#e3ddd1', '#d2c9ba', '#dbd3c5'];

    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (colW * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * colW + off;
        const y = r * rowH;
        ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
        ctx.fillRect(x + gap * 0.5, y + gap * 0.5, colW - gap, rowH - gap);

        ctx.fillStyle = 'rgba(255,255,250,0.18)';
        ctx.fillRect(x + gap * 0.5, y + gap * 0.5, colW - gap, 2);
        ctx.fillStyle = 'rgba(90,82,70,0.08)';
        ctx.fillRect(x + gap * 0.5, y + rowH - gap * 0.5 - 2, colW - gap, 2);
      }
    }
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(80,72,62,0.06)';
      ctx.fillRect(rand() * w, rand() * h, 2, 2);
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(0.45, 0.45);
  setTexColorSpace(THREE, tex);
  return tex;
}

function makeWoodTexture(THREE, kit) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const rand = pseudoRand(7123);
    ctx.fillStyle = '#c48a54';
    ctx.fillRect(0, 0, w, h);

    const planks = 8;
    const pw = w / planks;
    const tones = ['#c88e57', '#be824c', '#cf965f', '#b87c47', '#c58a53'];
    for (let p = 0; p < planks; p++) {
      ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
      ctx.fillRect(p * pw, 0, pw - 1.5, h);
      ctx.fillStyle = 'rgba(72,40,18,0.22)';
      ctx.fillRect((p + 1) * pw - 1.5, 0, 1.5, h);

      for (let g = 0; g < 16; g++) {
        const gx = p * pw + rand() * (pw - 2);
        ctx.fillStyle = rand() > 0.45 ? 'rgba(95,52,22,0.11)' : 'rgba(255,220,175,0.11)';
        ctx.fillRect(gx, 0, 1.2 + rand() * 1.4, h);
      }
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(0.9, 0.9);
  setTexColorSpace(THREE, tex);
  return tex;
}

function makeRoofTexture(THREE, kit, accentColor) {
  const base = accentColor.clone();
  const dark = base.clone().multiplyScalar(0.76);
  const light = base.clone().lerp(new THREE.Color(0xffffff), 0.16);
  const baseHex = '#' + base.getHexString();
  const darkHex = '#' + dark.getHexString();
  const lightHex = '#' + light.getHexString();

  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const rand = pseudoRand(5519);
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, w, h);

    const seams = 8;
    const sw = w / seams;
    for (let i = 0; i < seams; i++) {
      const x = i * sw;
      const grad = ctx.createLinearGradient(x, 0, x + sw, 0);
      grad.addColorStop(0, darkHex);
      grad.addColorStop(0.12, lightHex);
      grad.addColorStop(0.55, baseHex);
      grad.addColorStop(0.92, darkHex);
      grad.addColorStop(1, darkHex);
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, sw, h);

      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(x + 2, 0, 2, h);
    }
    for (let i = 0; i < 180; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,20,0.05)';
      ctx.fillRect(rand() * w, rand() * h, 1.5, 10 + rand() * 24);
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(0.85, 0.85);
  setTexColorSpace(THREE, tex);
  return tex;
}

function makeStoneTexture(THREE, kit) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const rand = pseudoRand(3301);
    ctx.fillStyle = '#d9d2c5';
    ctx.fillRect(0, 0, w, h);

    for (let r = 0; r < 6; r++) {
      const y = (r / 6) * h;
      ctx.fillStyle = 'rgba(110,102,90,0.16)';
      ctx.fillRect(0, y, w, 2);
      ctx.fillStyle = 'rgba(255,252,245,0.22)';
      ctx.fillRect(0, y + 2, w, 1.5);
    }
    for (let i = 0; i < 550; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,250,0.12)' : 'rgba(95,88,78,0.1)';
      ctx.fillRect(rand() * w, rand() * h, 2, 2);
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(0.65, 0.65);
  setTexColorSpace(THREE, tex);
  return tex;
}

function makeCorkTexture(THREE, kit) {
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    const rand = pseudoRand(8821);
    ctx.fillStyle = '#b98856';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(130,82,42,0.25)' : 'rgba(235,195,145,0.22)';
      ctx.fillRect(rand() * w, rand() * h, 2 + rand() * 2, 1.5 + rand() * 2);
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  setTexColorSpace(THREE, tex);
  return tex;
}

// --- Material Factory ---

function createMaterials(THREE, kit, accentColor, hl) {
  const brickTex = makeBrickTexture(THREE, kit);
  const pavingTex = makePavingTexture(THREE, kit);
  const woodTex = makeWoodTexture(THREE, kit);
  const roofTex = makeRoofTexture(THREE, kit, accentColor);
  const stoneTex = makeStoneTexture(THREE, kit);
  const corkTex = makeCorkTexture(THREE, kit);

  const roofMat = new THREE.MeshStandardMaterial({
    map: roofTex,
    roughness: 0.42,
    metalness: 0.24,
    emissive: accentColor.clone(),
    emissiveIntensity: 0,
  });
  const roofTrimMat = new THREE.MeshStandardMaterial({
    color: accentColor.clone().multiplyScalar(0.88),
    roughness: 0.38,
    metalness: 0.28,
    emissive: accentColor.clone(),
    emissiveIntensity: 0,
  });
  hl.roofMats.push(
    { mat: roofMat, base: 0, on: 0.26 },
    { mat: roofTrimMat, base: 0, on: 0.22 }
  );

  const litWindowMat = new THREE.MeshStandardMaterial({
    color: 0xf4e3be,
    emissive: new THREE.Color(0xffc773),
    emissiveIntensity: 0.42,
    roughness: 0.16,
    metalness: 0.12,
  });
  const lobbyGlassMat = new THREE.MeshStandardMaterial({
    color: 0xf7e8c8,
    emissive: new THREE.Color(0xffce7d),
    emissiveIntensity: 0.5,
    roughness: 0.14,
    metalness: 0.1,
  });
  const clerestoryMat = new THREE.MeshStandardMaterial({
    color: 0xf9ebd0,
    emissive: new THREE.Color(0xffd082),
    emissiveIntensity: 0.46,
    roughness: 0.15,
    metalness: 0.1,
  });
  const interviewWallMat = new THREE.MeshStandardMaterial({
    color: 0xf3ead9,
    emissive: new THREE.Color(0xffdfa6),
    emissiveIntensity: 0.22,
    roughness: 0.82,
  });
  const interviewBackMat = new THREE.MeshStandardMaterial({
    color: 0xdce4dc,
    emissive: new THREE.Color(0xffdfa6),
    emissiveIntensity: 0.2,
    roughness: 0.8,
  });
  const lampGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfff5dc,
    emissive: new THREE.Color(0xffda8c),
    emissiveIntensity: 0.78,
    roughness: 0.25,
  });

  hl.windowMats.push(
    { mat: litWindowMat, base: 0.42, on: 1.25 },
    { mat: lobbyGlassMat, base: 0.5, on: 1.35 },
    { mat: clerestoryMat, base: 0.46, on: 1.3 },
    { mat: interviewWallMat, base: 0.22, on: 0.58 },
    { mat: interviewBackMat, base: 0.2, on: 0.52 },
    { mat: lampGlowMat, base: 0.78, on: 1.65 }
  );

  const emblemBrassMat = new THREE.MeshStandardMaterial({
    color: 0xd8a84e,
    roughness: 0.28,
    metalness: 0.72,
    emissive: new THREE.Color(0xffbe4a),
    emissiveIntensity: 0.1,
  });
  const emblemGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfff3d4,
    roughness: 0.22,
    metalness: 0.18,
    emissive: new THREE.Color(0xffd26a),
    emissiveIntensity: 0.3,
  });
  const emblemRingGlowMat = new THREE.MeshStandardMaterial({
    color: 0x9ec5ff,
    roughness: 0.25,
    metalness: 0.2,
    emissive: accentColor.clone().lerp(new THREE.Color(0x88c8ff), 0.55),
    emissiveIntensity: 0.25,
  });
  hl.emblemMats.push(
    { mat: emblemBrassMat, base: 0.1, on: 0.7 },
    { mat: emblemGlowMat, base: 0.3, on: 1.65 },
    { mat: emblemRingGlowMat, base: 0.25, on: 1.4 }
  );

  return {
    brick: new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.84, metalness: 0.02 }),
    paving: new THREE.MeshStandardMaterial({ map: pavingTex, roughness: 0.86, metalness: 0.02 }),
    pavingAccent: new THREE.MeshStandardMaterial({ color: 0xc9bfb0, roughness: 0.85 }),
    stone: new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.78, metalness: 0.03 }),
    wood: new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.68, metalness: 0.04 }),
    woodDark: new THREE.MeshStandardMaterial({ color: 0x7b4f2f, map: woodTex, roughness: 0.65 }),
    woodFloor: new THREE.MeshStandardMaterial({ color: 0xd4a472, map: woodTex, roughness: 0.6 }),
    bronze: new THREE.MeshStandardMaterial({ color: 0x3b3d42, roughness: 0.44, metalness: 0.58 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xcfd5dc, roughness: 0.3, metalness: 0.76 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xd9aa52, roughness: 0.32, metalness: 0.75 }),
    roof: roofMat,
    roofTrim: roofTrimMat,
    litWindow: litWindowMat,
    lobbyGlass: lobbyGlassMat,
    clerestory: clerestoryMat,
    clearGlass: new THREE.MeshStandardMaterial({
      color: 0xdcf0ff,
      roughness: 0.08,
      metalness: 0.12,
      transparent: true,
      opacity: 0.19,
      depthWrite: false,
    }),
    interviewWall: interviewWallMat,
    interviewBack: interviewBackMat,
    lampGlow: lampGlowMat,
    emblemBrass: emblemBrassMat,
    emblemGlow: emblemGlowMat,
    emblemRingGlow: emblemRingGlowMat,
    cork: new THREE.MeshStandardMaterial({ map: corkTex, roughness: 0.92 }),
    soil: new THREE.MeshStandardMaterial({ color: 0x5d4635, roughness: 0.95 }),
    foliage1: new THREE.MeshStandardMaterial({ color: 0x588c4b, roughness: 0.78 }),
    foliage2: new THREE.MeshStandardMaterial({ color: 0x6ea055, roughness: 0.76 }),
    foliage3: new THREE.MeshStandardMaterial({ color: 0x48763e, roughness: 0.8 }),
    flowerWarm: new THREE.MeshStandardMaterial({ color: 0xf4c45c, roughness: 0.62 }),
    flowerCoral: new THREE.MeshStandardMaterial({ color: 0xe6836c, roughness: 0.64 }),
    chair1: new THREE.MeshStandardMaterial({ color: 0xc96b4b, roughness: 0.74 }),
    chair2: new THREE.MeshStandardMaterial({ color: 0x3d7387, roughness: 0.74 }),
    cream: new THREE.MeshStandardMaterial({ color: 0xf4eee2, roughness: 0.72 }),
    pennant: new THREE.MeshStandardMaterial({ color: accentColor.clone(), roughness: 0.62, metalness: 0.05 }),
    pennantTrim: new THREE.MeshStandardMaterial({ color: 0xe8bc5a, roughness: 0.55, metalness: 0.1 }),
    slatBack: new THREE.MeshStandardMaterial({ color: 0x2f2b28, roughness: 0.8 }),
  };
}

// --- Sub-Builders ---

function buildBasePlaza(THREE, mats, root) {
  const g = new THREE.Group();

  // Main 8 x 7 x 0.15 bevelled paved plaza
  const baseGeo = bevelledBlockGeo(THREE, 8.0, 0.15, 7.0, 0.16, 0.025, 4);
  addMesh(THREE, g, baseGeo, mats.paving, 0, 0.075, 0);

  // Subtle decorative kerb/apron inlays along front entrance walkway
  const walkGeo = bevelledBlockGeo(THREE, 2.25, 0.018, 1.55, 0.06, 0.006, 2);
  addMesh(THREE, g, walkGeo, mats.stone, 0, 0.154, 2.72);

  // Stepping border bands flanking the entrance path
  const stripGeo = bevelledBlockGeo(THREE, 0.14, 0.02, 1.52, 0.03, 0.006, 2);
  addMesh(THREE, g, stripGeo, mats.pavingAccent, -1.16, 0.154, 2.72);
  addMesh(THREE, g, stripGeo, mats.pavingAccent, 1.16, 0.154, 2.72);

  // Rear service stone pad
  const rearPad = bevelledBlockGeo(THREE, 1.3, 0.018, 0.8, 0.06, 0.006, 2);
  addMesh(THREE, g, rearPad, mats.stone, 0, 0.154, -3.02);

  root.add(g);
}

function buildMainBuilding(THREE, mats, root) {
  const g = new THREE.Group();

  // Stone plinth (L-shaped, seamless, Y: 0.15 -> 0.46)
  const plinthGeo = lFootprintGeo(THREE, 0.31, 0.02);
  addMesh(THREE, g, plinthGeo, mats.stone, 0, 0.305, 0);

  // Ground-floor brick volumes (leaving hollow cavity for front-right interview room)
  // Left wing: X -3.16..-0.96, Z -2.60..+1.40, Y 0.45..2.10
  const gfLeftGeo = bevelledBlockGeo(THREE, 2.2, 1.65, 4.0, 0.05, 0.018);
  addMesh(THREE, g, gfLeftGeo, mats.brick, -2.06, 1.275, -0.6);

  // Center lobby body (slightly recessed on +Z to give depth behind glass facade)
  const gfCenterGeo = bevelledBlockGeo(THREE, 2.04, 1.65, 3.88, 0.04, 0.015);
  addMesh(THREE, g, gfCenterGeo, mats.brick, 0.02, 1.275, -0.66);

  // Back-right behind interview room: X +0.96..+3.16, Z -2.60..+0.22
  const gfBackRightGeo = bevelledBlockGeo(THREE, 2.2, 1.65, 2.82, 0.05, 0.018);
  addMesh(THREE, g, gfBackRightGeo, mats.brick, 2.06, 1.275, -1.19);

  // Stone stringcourse belt between 1st & 2nd stories (L-shaped, Y: 2.07 -> 2.21)
  const beltGeo = lFootprintGeo(THREE, 0.14, 0.016);
  addMesh(THREE, g, beltGeo, mats.stone, 0, 2.14, 0);

  // Second-floor main brick volume: X -3.16..+3.16, Z -2.60..+1.40, Y 2.20..3.78
  const sfMainGeo = bevelledBlockGeo(THREE, 6.32, 1.58, 4.0, 0.05, 0.018);
  addMesh(THREE, g, sfMainGeo, mats.brick, 0, 2.99, -0.6);

  // Second-floor front-right projecting contemporary wood-slat wing above interview room
  const sfBayBackGeo = bevelledBlockGeo(THREE, 2.16, 1.56, 0.42, 0.04, 0.014);
  addMesh(THREE, g, sfBayBackGeo, mats.slatBack, 2.06, 2.99, 1.56);

  // Second-floor front center architectural glazed atrium frame
  const sfCenterFrameGeo = bevelledBlockGeo(THREE, 2.18, 1.56, 0.28, 0.04, 0.014);
  addMesh(THREE, g, sfCenterFrameGeo, mats.woodDark, 0, 2.99, 1.48);

  // Crisp brick corner pilasters for architectural relief
  const pilasterGeo = bevelledBlockGeo(THREE, 0.24, 3.3, 0.24, 0.03, 0.012);
  const pilasterCoords = [
    [-3.12, 2.12, 1.36],
    [-3.12, 2.12, -2.56],
    [3.12, 2.12, -2.56],
    [-1.08, 2.12, 1.38],
  ];
  for (const [x, y, z] of pilasterCoords) {
    addMesh(THREE, g, pilasterGeo, mats.brick, x, y, z);
  }

  // Stone cornice band beneath eaves (Y: 3.74 -> 3.86)
  const corniceGeo = bevelledBlockGeo(THREE, 6.46, 0.12, 4.14, 0.05, 0.016);
  addMesh(THREE, g, corniceGeo, mats.stone, 0, 3.8, -0.6);

  // --- Instanced Warm Wood Facade Slats ---
  const slatGeo = bevelledBlockGeo(THREE, 0.055, 1.46, 0.065, 0.016, 0.008, 2);
  const slatTransforms = [];
  const dummy = new THREE.Object3D();

  // Front-right 2nd floor vertical wood slats flanking the studio ribbon window
  for (let x = 1.06; x <= 3.06; x += 0.115) {
    // Leave clean opening for the wide 2nd-floor window (X: 1.46..2.66)
    if (x > 1.42 && x < 2.7) continue;
    slatTransforms.push({ x, y: 2.99, z: 1.77, ry: 0, sy: 1 });
  }
  // Right-side 2nd floor wood slats above interview room side window
  for (let z = 0.28; z <= 1.66; z += 0.12) {
    slatTransforms.push({ x: 3.16, y: 2.99, z, ry: Math.PI * 0.5, sy: 1 });
  }
  // Front-left 2nd-floor vertical accent slat panel beside left window
  for (let x = -1.48; x <= -1.16; x += 0.1) {
    slatTransforms.push({ x, y: 2.99, z: 1.42, ry: 0, sy: 0.96 });
  }
  // Rear center stairwell wood slat accent flanking rear glass bay
  for (let x = -0.92; x <= -0.64; x += 0.1) {
    slatTransforms.push({ x, y: 2.15, z: -2.62, ry: 0, sy: 2.05 });
  }
  for (let x = 0.64; x <= 0.92; x += 0.1) {
    slatTransforms.push({ x, y: 2.15, z: -2.62, ry: 0, sy: 2.05 });
  }

  const slatInst = new THREE.InstancedMesh(slatGeo, mats.wood, slatTransforms.length);
  slatInst.castShadow = true;
  slatInst.receiveShadow = true;
  slatTransforms.forEach((t, i) => {
    dummy.position.set(t.x, t.y, t.z);
    dummy.rotation.set(0, t.ry, 0);
    dummy.scale.set(1, t.sy, 1);
    dummy.updateMatrix();
    slatInst.setMatrixAt(i, dummy.matrix);
  });
  slatInst.instanceMatrix.needsUpdate = true;
  g.add(slatInst);

  // --- Instanced Inset Framed Windows ---
  const winSpecs = [
    // Front (+Z)
    { x: -2.18, y: 1.32, z: 1.4, ry: 0, w: 1.18, h: 1.08 }, // GF left lounge
    { x: -2.28, y: 2.98, z: 1.4, ry: 0, w: 1.05, h: 1.05 }, // 2F left office
    { x: 2.06, y: 2.98, z: 1.77, ry: 0, w: 1.24, h: 0.98 }, // 2F right wood-slat studio
    { x: -0.48, y: 2.98, z: 1.62, ry: 0, w: 0.82, h: 1.16 }, // 2F center atrium left
    { x: 0.48, y: 2.98, z: 1.62, ry: 0, w: 0.82, h: 1.16 }, // 2F center atrium right

    // Left Side (-X)
    { x: -3.16, y: 1.32, z: 0.25, ry: -Math.PI * 0.5, w: 1.05, h: 1.05 },
    { x: -3.16, y: 1.32, z: -1.45, ry: -Math.PI * 0.5, w: 1.05, h: 1.05 },
    { x: -3.16, y: 2.98, z: 0.25, ry: -Math.PI * 0.5, w: 1.05, h: 1.02 },
    { x: -3.16, y: 2.98, z: -1.45, ry: -Math.PI * 0.5, w: 1.05, h: 1.02 },

    // Right Side (+X, rear half; front-right GF is interview room)
    { x: 3.16, y: 1.32, z: -0.75, ry: Math.PI * 0.5, w: 1.02, h: 1.05 },
    { x: 3.16, y: 1.32, z: -1.92, ry: Math.PI * 0.5, w: 0.82, h: 1.05 },
    { x: 3.16, y: 2.98, z: -0.75, ry: Math.PI * 0.5, w: 1.02, h: 1.02 },
    { x: 3.16, y: 2.98, z: -1.92, ry: Math.PI * 0.5, w: 0.82, h: 1.02 },

    // Rear (-Z)
    { x: -2.1, y: 1.32, z: -2.6, ry: Math.PI, w: 1.05, h: 1.05 },
    { x: 2.1, y: 1.32, z: -2.6, ry: Math.PI, w: 1.05, h: 1.05 },
    { x: -2.1, y: 2.98, z: -2.6, ry: Math.PI, w: 1.05, h: 1.02 },
    { x: 2.1, y: 2.98, z: -2.6, ry: Math.PI, w: 1.05, h: 1.02 },
    { x: 0, y: 2.98, z: -2.6, ry: Math.PI, w: 1.05, h: 1.18 }, // Rear stairwell upper
  ];

  // Unit-sized reusable window parts instanced across all 18 windows
  const frameOuterGeo = bevelledPanelGeo(THREE, 1.0, 1.0, 0.14, 0.035, 0.012, 2);
  const paneGeo = bevelledPanelGeo(THREE, 0.84, 0.84, 0.06, 0.015, 0.005, 2);
  const sillGeo = bevelledBlockGeo(THREE, 1.1, 0.08, 0.18, 0.02, 0.01, 2);
  const mullionVGeo = bevelledPanelGeo(THREE, 0.045, 0.86, 0.12, 0.01, 0.005, 2);
  const mullionHGeo = bevelledPanelGeo(THREE, 0.86, 0.045, 0.12, 0.01, 0.005, 2);

  const nWin = winSpecs.length;
  const frameInst = new THREE.InstancedMesh(frameOuterGeo, mats.bronze, nWin);
  const paneInst = new THREE.InstancedMesh(paneGeo, mats.litWindow, nWin);
  const sillInst = new THREE.InstancedMesh(sillGeo, mats.stone, nWin);
  const mulVInst = new THREE.InstancedMesh(mullionVGeo, mats.bronze, nWin);
  const mulHInst = new THREE.InstancedMesh(mullionHGeo, mats.bronze, nWin);

  [frameInst, paneInst, sillInst, mulVInst, mulHInst].forEach((inst) => {
    inst.castShadow = true;
    inst.receiveShadow = true;
    g.add(inst);
  });

  winSpecs.forEach((ws, i) => {
    const nx = Math.sin(ws.ry);
    const nz = Math.cos(ws.ry);

    // Frame slightly proud of wall
    dummy.position.set(ws.x + nx * 0.02, ws.y, ws.z + nz * 0.02);
    dummy.rotation.set(0, ws.ry, 0);
    dummy.scale.set(ws.w, ws.h, 1);
    dummy.updateMatrix();
    frameInst.setMatrixAt(i, dummy.matrix);

    // Inset lit glass pane
    dummy.position.set(ws.x + nx * 0.055, ws.y, ws.z + nz * 0.055);
    dummy.scale.set(ws.w, ws.h, 1);
    dummy.updateMatrix();
    paneInst.setMatrixAt(i, dummy.matrix);

    // Stone sill
    dummy.position.set(ws.x + nx * 0.05, ws.y - ws.h * 0.5 - 0.02, ws.z + nz * 0.05);
    dummy.scale.set(ws.w, 1, 1);
    dummy.updateMatrix();
    sillInst.setMatrixAt(i, dummy.matrix);

    // Vertical & horizontal mullions
    dummy.position.set(ws.x + nx * 0.055, ws.y, ws.z + nz * 0.055);
    dummy.scale.set(1, ws.h, 1);
    dummy.updateMatrix();
    mulVInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(ws.x + nx * 0.055, ws.y + ws.h * 0.14, ws.z + nz * 0.055);
    dummy.scale.set(ws.w, 1, 1);
    dummy.updateMatrix();
    mulHInst.setMatrixAt(i, dummy.matrix);
  });
  [frameInst, paneInst, sillInst, mulVInst, mulHInst].forEach((inst) => {
    inst.instanceMatrix.needsUpdate = true;
  });

  // Rear staff door with slim shelter hood
  const rearFrame = bevelledPanelGeo(THREE, 0.96, 1.56, 0.14, 0.03, 0.012);
  addMesh(THREE, g, rearFrame, mats.bronze, 0, 1.24, -2.61);
  const rearDoor = bevelledPanelGeo(THREE, 0.82, 1.44, 0.08, 0.02, 0.008);
  addMesh(THREE, g, rearDoor, mats.wood, 0, 1.24, -2.64);
  const rearWindow = bevelledPanelGeo(THREE, 0.44, 0.58, 0.09, 0.02, 0.006);
  addMesh(THREE, g, rearWindow, mats.litWindow, 0, 1.48, -2.65);
  const rearHood = bevelledBlockGeo(THREE, 1.22, 0.09, 0.46, 0.03, 0.014);
  addMesh(THREE, g, rearHood, mats.bronze, 0, 2.08, -2.8);

  // Slim bronze rainwater downspouts on rear corners
  const pipeGeo = new THREE.CylinderGeometry(0.032, 0.032, 3.55, 8);
  addMesh(THREE, g, pipeGeo, mats.bronze, -3.22, 1.98, -2.62);
  addMesh(THREE, g, pipeGeo, mats.bronze, 3.22, 1.98, -2.62);

  root.add(g);
}

function buildInterviewRoom(THREE, mats, root) {
  // Hollow front-right showcase room: X +1.00..+3.14, Y 0.46..2.06, Z +0.22..+1.76
  const g = new THREE.Group();

  // Warm wood floor & cream ceiling
  const floorGeo = bevelledBlockGeo(THREE, 2.14, 0.06, 1.56, 0.02, 0.008);
  addMesh(THREE, g, floorGeo, mats.woodFloor, 2.07, 0.48, 0.99);
  addMesh(THREE, g, floorGeo, mats.interviewWall, 2.07, 2.04, 0.99);

  // Back interior wall & left partition wall
  const backWallGeo = bevelledBlockGeo(THREE, 2.1, 1.56, 0.08, 0.02, 0.008);
  addMesh(THREE, g, backWallGeo, mats.interviewBack, 2.07, 1.26, 0.25);

  const leftWallGeo = bevelledBlockGeo(THREE, 0.08, 1.56, 1.52, 0.02, 0.008);
  addMesh(THREE, g, leftWallGeo, mats.interviewWall, 1.03, 1.26, 0.99);

  // Subtle decorative abstract geometric wall art (pure shapes, no text)
  const artFrame = bevelledPanelGeo(THREE, 0.62, 0.42, 0.03, 0.02, 0.006);
  addMesh(THREE, g, artFrame, mats.woodDark, 2.07, 1.48, 0.3);
  const artCanvas = bevelledPanelGeo(THREE, 0.54, 0.34, 0.032, 0.01, 0.004);
  addMesh(THREE, g, artCanvas, mats.cream, 2.07, 1.48, 0.305);
  const artDisc = new THREE.CylinderGeometry(0.095, 0.095, 0.02, 16);
  artDisc.rotateX(Math.PI * 0.5);
  addMesh(THREE, g, artDisc, mats.chair2, 1.97, 1.49, 0.32, false);
  const artBlock = bevelledPanelGeo(THREE, 0.16, 0.2, 0.02, 0.02, 0.004);
  addMesh(THREE, g, artBlock, mats.chair1, 2.17, 1.46, 0.32, false);

  // Front & side brick piers + stone apron beneath panoramic window
  const pierGeo = bevelledBlockGeo(THREE, 0.22, 1.62, 0.22, 0.03, 0.012);
  addMesh(THREE, g, pierGeo, mats.brick, 1.07, 1.27, 1.67);
  addMesh(THREE, g, pierGeo, mats.brick, 3.06, 1.27, 1.67);

  const apronFront = bevelledBlockGeo(THREE, 1.88, 0.24, 0.16, 0.02, 0.01);
  addMesh(THREE, g, apronFront, mats.brick, 2.07, 0.57, 1.7);
  const sillFront = bevelledBlockGeo(THREE, 1.94, 0.07, 0.22, 0.02, 0.01);
  addMesh(THREE, g, sillFront, mats.stone, 2.07, 0.7, 1.72);

  const apronSide = bevelledBlockGeo(THREE, 0.16, 0.24, 1.38, 0.02, 0.01);
  addMesh(THREE, g, apronSide, mats.brick, 3.09, 0.57, 0.94);
  const sillSide = bevelledBlockGeo(THREE, 0.22, 0.07, 1.44, 0.02, 0.01);
  addMesh(THREE, g, sillSide, mats.stone, 3.11, 0.7, 0.94);

  // Window framing bars (bronze top/bottom/side mullions)
  const barHFront = bevelledBlockGeo(THREE, 1.82, 0.06, 0.08, 0.015, 0.008);
  addMesh(THREE, g, barHFront, mats.bronze, 2.07, 1.98, 1.72);
  addMesh(THREE, g, barHFront, mats.bronze, 2.07, 0.75, 1.72);
  const barV = bevelledBlockGeo(THREE, 0.05, 1.26, 0.07, 0.012, 0.006);
  addMesh(THREE, g, barV, mats.bronze, 1.21, 1.36, 1.72);
  addMesh(THREE, g, barV, mats.bronze, 2.93, 1.36, 1.72);

  const barHSide = bevelledBlockGeo(THREE, 0.08, 0.06, 1.34, 0.015, 0.008);
  addMesh(THREE, g, barHSide, mats.bronze, 3.11, 1.98, 0.94);
  addMesh(THREE, g, barHSide, mats.bronze, 3.11, 0.75, 0.94);
  addMesh(THREE, g, barV, mats.bronze, 3.11, 1.36, 0.31);
  addMesh(THREE, g, barV, mats.bronze, 3.11, 1.36, 1.56);

  // Clear transparent showcase glass (castShadow=false so room stays bright & clear)
  const frontGlass = new THREE.PlaneGeometry(1.74, 1.22);
  const fgMesh = new THREE.Mesh(frontGlass, mats.clearGlass);
  fgMesh.position.set(2.07, 1.36, 1.73);
  fgMesh.receiveShadow = true;
  g.add(fgMesh);

  const sideGlass = new THREE.PlaneGeometry(1.26, 1.22);
  const sgMesh = new THREE.Mesh(sideGlass, mats.clearGlass);
  sgMesh.position.set(3.12, 1.36, 0.94);
  sgMesh.rotation.y = Math.PI * 0.5;
  sgMesh.receiveShadow = true;
  g.add(sgMesh);

  // --- Interview Room Furniture: Table & Two Chairs ---
  const tableX = 2.06;
  const tableZ = 1.06;

  // Rounded wood interview table
  const topGeo = bevelledBlockGeo(THREE, 0.72, 0.055, 0.54, 0.14, 0.015, 4);
  addMesh(THREE, g, topGeo, mats.wood, tableX, 0.95, tableZ);

  const legGeo = new THREE.CylinderGeometry(0.022, 0.016, 0.44, 8);
  for (const [dx, dz] of [[-0.25, -0.17], [0.25, -0.17], [-0.25, 0.17], [0.25, 0.17]]) {
    addMesh(THREE, g, legGeo, mats.woodDark, tableX + dx, 0.72, tableZ + dz);
  }

  // Tiny blank portfolio folder & two ceramic mugs on the table
  const folderGeo = bevelledBlockGeo(THREE, 0.19, 0.016, 0.14, 0.012, 0.004);
  const folder = addMesh(THREE, g, folderGeo, mats.cream, tableX - 0.11, 0.985, tableZ + 0.04);
  folder.rotation.y = 0.18;

  const mugGeo = new THREE.CylinderGeometry(0.028, 0.024, 0.05, 10);
  addMesh(THREE, g, mugGeo, mats.cream, tableX + 0.16, 1.0, tableZ - 0.06);
  addMesh(THREE, g, mugGeo, mats.chair1, tableX - 0.18, 1.0, tableZ - 0.1);

  // Cozy mid-century armchair helper
  const seatGeo = bevelledBlockGeo(THREE, 0.34, 0.07, 0.34, 0.09, 0.018, 3);
  const backGeo = bevelledBlockGeo(THREE, 0.34, 0.32, 0.075, 0.09, 0.018, 3);
  const armGeo = bevelledBlockGeo(THREE, 0.055, 0.15, 0.28, 0.02, 0.01, 2);
  const cLegGeo = new THREE.CylinderGeometry(0.016, 0.012, 0.28, 7);

  function buildChair(cx, cz, rotY, fabricMat) {
    const cg = new THREE.Group();
    cg.position.set(cx, 0.51, cz);
    cg.rotation.y = rotY;
    addMesh(THREE, cg, seatGeo, fabricMat, 0, 0.28, 0);
    addMesh(THREE, cg, backGeo, fabricMat, 0, 0.45, -0.14);
    addMesh(THREE, cg, armGeo, fabricMat, -0.15, 0.37, -0.02);
    addMesh(THREE, cg, armGeo, fabricMat, 0.15, 0.37, -0.02);
    for (const [lx, lz] of [[-0.12, -0.11], [0.12, -0.11], [-0.12, 0.11], [0.12, 0.11]]) {
      addMesh(THREE, cg, cLegGeo, mats.woodDark, lx, 0.13, lz);
    }
    g.add(cg);
  }

  // Two chairs facing each other across the table, angled subtly so both read clearly from +Z
  buildChair(tableX - 0.56, tableZ + 0.02, Math.PI * 0.46, mats.chair1);
  buildChair(tableX + 0.56, tableZ + 0.02, -Math.PI * 0.46, mats.chair2);

  // Warm hanging dome pendant lamp above the interview table
  const cordGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.34, 6);
  addMesh(THREE, g, cordGeo, mats.bronze, tableX, 1.85, tableZ, false);
  const shadeProfile = [
    new THREE.Vector2(0.02, 0.12),
    new THREE.Vector2(0.11, 0.08),
    new THREE.Vector2(0.16, 0.0),
    new THREE.Vector2(0.14, 0.0),
    new THREE.Vector2(0.09, 0.065),
  ];
  const shadeGeo = new THREE.LatheGeometry(shadeProfile, 14);
  addMesh(THREE, g, shadeGeo, mats.brass, tableX, 1.58, tableZ, false);
  const bulbGeo = new THREE.SphereGeometry(0.065, 10, 8);
  addMesh(THREE, g, bulbGeo, mats.lampGlow, tableX, 1.59, tableZ, false);

  // Small potted corner plant inside interview room
  const potGeo = new THREE.CylinderGeometry(0.09, 0.065, 0.16, 10);
  addMesh(THREE, g, potGeo, mats.cream, 2.74, 0.59, 0.46);
  const leafBall = new THREE.IcosahedronGeometry(0.12, 1);
  addMesh(THREE, g, leafBall, mats.foliage2, 2.74, 0.74, 0.46);
  addMesh(THREE, g, leafBall, mats.foliage1, 2.79, 0.81, 0.43).scale.setScalar(0.72);

  root.add(g);
}

function buildEntranceCanopy(THREE, mats, root) {
  const g = new THREE.Group();

  // Welcoming broad stone steps (Y: 0.15 -> 0.28)
  const step1 = bevelledBlockGeo(THREE, 2.38, 0.075, 1.38, 0.08, 0.016, 3);
  addMesh(THREE, g, step1, mats.stone, 0, 0.188, 2.04);
  const step2 = bevelledBlockGeo(THREE, 2.08, 0.075, 1.08, 0.06, 0.015, 3);
  addMesh(THREE, g, step2, mats.stone, 0, 0.258, 1.9);

  // Recessed glazed entrance lobby wall & double glass doors (Z = +1.36)
  const portalFrame = bevelledBlockGeo(THREE, 2.04, 1.84, 0.18, 0.04, 0.014);
  addMesh(THREE, g, portalFrame, mats.bronze, 0, 1.21, 1.35);

  const glassBack = bevelledPanelGeo(THREE, 1.88, 1.7, 0.08, 0.02, 0.008);
  addMesh(THREE, g, glassBack, mats.lobbyGlass, 0, 1.21, 1.37);

  // Door stiles & transom bar
  const stileGeo = bevelledBlockGeo(THREE, 0.055, 1.72, 0.14, 0.012, 0.006);
  addMesh(THREE, g, stileGeo, mats.bronze, -0.62, 1.21, 1.39);
  addMesh(THREE, g, stileGeo, mats.bronze, 0.62, 1.21, 1.39);
  addMesh(THREE, g, stileGeo, mats.bronze, 0, 1.05, 1.39).scale.set(0.8, 0.82, 1);

  const transomGeo = bevelledBlockGeo(THREE, 1.92, 0.06, 0.14, 0.012, 0.006);
  addMesh(THREE, g, transomGeo, mats.bronze, 0, 1.72, 1.39);

  // Warm vertical brass door pull handles
  const handleGeo = new THREE.CapsuleGeometry(0.016, 0.36, 4, 8);
  addMesh(THREE, g, handleGeo, mats.brass, -0.09, 1.08, 1.46);
  addMesh(THREE, g, handleGeo, mats.brass, 0.09, 1.08, 1.46);

  // Canopy roof: sleek dark-bronze bevelled fascia + warm cedar wood soffit
  const canopyOuter = bevelledBlockGeo(THREE, 2.54, 0.21, 1.32, 0.09, 0.024, 4);
  addMesh(THREE, g, canopyOuter, mats.bronze, 0, 2.29, 2.02);

  const canopyCap = bevelledBlockGeo(THREE, 2.38, 0.05, 1.18, 0.07, 0.012, 3);
  addMesh(THREE, g, canopyCap, mats.roofTrim, 0, 2.405, 2.02);

  const soffitGeo = bevelledBlockGeo(THREE, 2.32, 0.06, 1.14, 0.06, 0.01, 3);
  addMesh(THREE, g, soffitGeo, mats.wood, 0, 2.18, 2.02);

  // Recessed warm canopy downlights
  const downlightGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.025, 12);
  for (const x of [-0.68, 0, 0.68]) {
    addMesh(THREE, g, downlightGeo, mats.lampGlow, x, 2.15, 2.1, false);
  }

  // Two refined canopy columns on stone plinth footings
  const colFootGeo = bevelledBlockGeo(THREE, 0.22, 0.22, 0.22, 0.04, 0.014);
  const colShaftGeo = new THREE.CylinderGeometry(0.065, 0.072, 1.88, 12);
  const colRingGeo = new THREE.CylinderGeometry(0.088, 0.088, 0.06, 12);
  for (const x of [-1.05, 1.05]) {
    addMesh(THREE, g, colFootGeo, mats.stone, x, 0.31, 2.46);
    addMesh(THREE, g, colShaftGeo, mats.bronze, x, 1.32, 2.46);
    addMesh(THREE, g, colRingGeo, mats.brass, x, 2.12, 2.46);
  }

  root.add(g);
}

function buildRoofAndEmblem(THREE, mats, root) {
  const g = new THREE.Group();

  // --- Main Royal-Blue Standing-Seam Pitched Roof ---
  // Ridge along X at Z = -0.55, Y = 5.04; Eaves at Z = -2.95 and +1.85, Y = 3.74
  const ridgeZ = -0.55;
  const ridgeY = 5.04;
  const eaveY = 3.74;
  const halfSpan = 2.4;
  const rise = ridgeY - eaveY; // 1.30
  const pitch = Math.atan2(rise, halfSpan);
  const slopeLen = Math.hypot(halfSpan, rise) + 0.08;
  const roofLenX = 6.96;

  // Solid warm-wood gable infill triangles closing the roof ends cleanly
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-2.12, 0);
  gableShape.lineTo(2.12, 0);
  gableShape.lineTo(0, rise - 0.06);
  gableShape.closePath();

  const gableWallGeo = new THREE.ExtrudeGeometry(gableShape, {
    depth: 6.26,
    bevelEnabled: false,
  });
  gableWallGeo.rotateY(Math.PI * 0.5);
  gableWallGeo.translate(-3.13, eaveY + 0.04, ridgeZ);
  gableWallGeo.computeVertexNormals();
  addMesh(THREE, g, gableWallGeo, mats.wood, 0, 0, 0);

  // Two thick bevelled roof slope slabs (front & back)
  const slabGeo = bevelledBlockGeo(THREE, roofLenX, 0.13, slopeLen, 0.04, 0.02, 2);

  const frontSlab = addMesh(THREE, g, slabGeo, mats.roof, 0, (ridgeY + eaveY) * 0.5 + 0.04, ridgeZ + halfSpan * 0.5);
  frontSlab.rotation.x = pitch;

  const backSlab = addMesh(THREE, g, slabGeo, mats.roof, 0, (ridgeY + eaveY) * 0.5 + 0.04, ridgeZ - halfSpan * 0.5);
  backSlab.rotation.x = -pitch;

  // Main ridge cap
  const ridgeCapGeo = bevelledBlockGeo(THREE, roofLenX + 0.06, 0.11, 0.22, 0.05, 0.02, 3);
  addMesh(THREE, g, ridgeCapGeo, mats.roofTrim, 0, ridgeY + 0.09, ridgeZ);

  // Dark bronze gutters along front & back eaves
  const gutterGeo = bevelledBlockGeo(THREE, roofLenX + 0.04, 0.075, 0.09, 0.025, 0.01, 2);
  addMesh(THREE, g, gutterGeo, mats.bronze, 0, eaveY - 0.01, ridgeZ + halfSpan + 0.05);
  addMesh(THREE, g, gutterGeo, mats.bronze, 0, eaveY - 0.01, ridgeZ - halfSpan - 0.05);

  // --- Front Center Cross-Gable Over Entrance (X: -1.42..+1.42, Z: -0.55..+2.05) ---
  const cgHalfSpan = 1.42;
  const cgEaveY = 4.18;
  const cgRise = ridgeY - cgEaveY; // 0.86
  const cgPitch = Math.atan2(cgRise, cgHalfSpan);
  const cgSlopeLen = Math.hypot(cgHalfSpan, cgRise) + 0.08;
  const cgLenZ = 2.62;
  const cgCenterZ = 0.74;

  // Front cross-gable infill wall with glowing triangular clerestory window
  const cgInfillShape = new THREE.Shape();
  cgInfillShape.moveTo(-1.26, 0);
  cgInfillShape.lineTo(1.26, 0);
  cgInfillShape.lineTo(0, cgRise - 0.05);
  cgInfillShape.closePath();

  const cgInfillGeo = new THREE.ExtrudeGeometry(cgInfillShape, {
    depth: 1.98,
    bevelEnabled: false,
  });
  cgInfillGeo.translate(0, cgEaveY, -0.32);
  cgInfillGeo.computeVertexNormals();
  addMesh(THREE, g, cgInfillGeo, mats.wood, 0, 0, 0);

  // Glowing triangular clerestory window tucked into the front cross-gable
  const clereFrameShape = new THREE.Shape();
  clereFrameShape.moveTo(-0.96, 0);
  clereFrameShape.lineTo(0.96, 0);
  clereFrameShape.lineTo(0, 0.56);
  clereFrameShape.closePath();

  const clereFrameGeo = new THREE.ExtrudeGeometry(clereFrameShape, {
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  addMesh(THREE, g, clereFrameGeo, mats.bronze, 0, cgEaveY + 0.05, 1.62);

  const clereGlassShape = new THREE.Shape();
  clereGlassShape.moveTo(-0.82, 0.06);
  clereGlassShape.lineTo(0.82, 0.06);
  clereGlassShape.lineTo(0, 0.48);
  clereGlassShape.closePath();

  const clereGlassGeo = new THREE.ExtrudeGeometry(clereGlassShape, {
    depth: 0.06,
    bevelEnabled: false,
  });
  addMesh(THREE, g, clereGlassGeo, mats.clerestory, 0, cgEaveY + 0.05, 1.68);

  // Cross-gable roof slopes (left & right)
  const cgSlabGeo = bevelledBlockGeo(THREE, cgSlopeLen, 0.12, cgLenZ, 0.04, 0.018, 2);

  const cgLeft = addMesh(THREE, g, cgSlabGeo, mats.roof, -cgHalfSpan * 0.5, (ridgeY + cgEaveY) * 0.5 + 0.05, cgCenterZ);
  cgLeft.rotation.z = cgPitch;

  const cgRight = addMesh(THREE, g, cgSlabGeo, mats.roof, cgHalfSpan * 0.5, (ridgeY + cgEaveY) * 0.5 + 0.05, cgCenterZ);
  cgRight.rotation.z = -cgPitch;

  const cgRidgeCap = bevelledBlockGeo(THREE, 0.21, 0.11, cgLenZ + 0.05, 0.05, 0.018, 3);
  addMesh(THREE, g, cgRidgeCap, mats.roofTrim, 0, ridgeY + 0.095, cgCenterZ);

  // --- Instanced Standing-Seam Roof Ribs ---
  const ribGeoMain = bevelledBlockGeo(THREE, 0.042, 0.055, slopeLen - 0.12, 0.012, 0.006, 2);
  const ribTransforms = [];
  const dummy = new THREE.Object3D();
  const nY = Math.cos(pitch);
  const nZ = Math.sin(pitch);

  for (let x = -3.28; x <= 3.29; x += 0.365) {
    // Back slope ribs (all the way across)
    ribTransforms.push({
      x,
      y: (ridgeY + eaveY) * 0.5 + 0.04 + nY * 0.085,
      z: ridgeZ - halfSpan * 0.5 - nZ * 0.085,
      rx: -pitch,
      rz: 0,
      scaleZ: 1,
    });
    // Front slope ribs (clear of center cross-gable)
    if (Math.abs(x) > 1.44) {
      ribTransforms.push({
        x,
        y: (ridgeY + eaveY) * 0.5 + 0.04 + nY * 0.085,
        z: ridgeZ + halfSpan * 0.5 + nZ * 0.085,
        rx: pitch,
        rz: 0,
        scaleZ: 1,
      });
    }
  }

  const ribInst = new THREE.InstancedMesh(ribGeoMain, mats.roofTrim, ribTransforms.length);
  ribInst.castShadow = true;
  ribInst.receiveShadow = true;
  ribTransforms.forEach((t, i) => {
    dummy.position.set(t.x, t.y, t.z);
    dummy.rotation.set(t.rx, 0, t.rz);
    dummy.scale.set(1, 1, t.scaleZ);
    dummy.updateMatrix();
    ribInst.setMatrixAt(i, dummy.matrix);
  });
  ribInst.instanceMatrix.needsUpdate = true;
  g.add(ribInst);

  // Cross-gable standing-seam ribs
  const ribGeoCG = bevelledBlockGeo(THREE, cgSlopeLen - 0.14, 0.05, 0.04, 0.012, 0.006, 2);
  const cgRibCoords = [0.62, 1.0, 1.38, 1.76];
  const cgRibInst = new THREE.InstancedMesh(ribGeoCG, mats.roofTrim, cgRibCoords.length * 2);
  cgRibInst.castShadow = true;
  cgRibInst.receiveShadow = true;
  const cgNY = Math.cos(cgPitch);
  const cgNX = Math.sin(cgPitch);
  let idx = 0;
  for (const z of cgRibCoords) {
    // Left slope
    dummy.position.set(-cgHalfSpan * 0.5 - cgNX * 0.08, (ridgeY + cgEaveY) * 0.5 + 0.05 + cgNY * 0.08, z);
    dummy.rotation.set(0, 0, cgPitch);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    cgRibInst.setMatrixAt(idx++, dummy.matrix);
    // Right slope
    dummy.position.set(cgHalfSpan * 0.5 + cgNX * 0.08, (ridgeY + cgEaveY) * 0.5 + 0.05 + cgNY * 0.08, z);
    dummy.rotation.set(0, 0, -cgPitch);
    dummy.updateMatrix();
    cgRibInst.setMatrixAt(idx++, dummy.matrix);
  }
  cgRibInst.instanceMatrix.needsUpdate = true;
  g.add(cgRibInst);

  // --- Roof Emblem: Sculpted Compass with Rising Arrow ---
  const emblem = new THREE.Group();
  emblem.position.set(0, 5.62, 1.35);

  // Pedestal base straddling the front ridge cleanly
  const pedBase = bevelledBlockGeo(THREE, 0.36, 0.18, 0.32, 0.06, 0.02, 3);
  addMesh(THREE, emblem, pedBase, mats.bronze, 0, -0.5, 0);
  const pedNeck = new THREE.CylinderGeometry(0.065, 0.095, 0.18, 12);
  addMesh(THREE, emblem, pedNeck, mats.emblemBrass, 0, -0.36, 0);

  // Outer brass compass ring & glowing inner ring
  const outerRingGeo = new THREE.TorusGeometry(0.39, 0.042, 10, 32);
  addMesh(THREE, emblem, outerRingGeo, mats.emblemBrass, 0, 0, 0);

  const innerRingGeo = new THREE.TorusGeometry(0.31, 0.018, 8, 28);
  addMesh(THREE, emblem, innerRingGeo, mats.emblemRingGlow, 0, 0, 0);

  // Four cardinal sculpted diamond compass points (no letters!)
  const pointShape = new THREE.Shape();
  pointShape.moveTo(0, 0.24);
  pointShape.lineTo(0.068, 0);
  pointShape.lineTo(0, -0.07);
  pointShape.lineTo(-0.068, 0);
  pointShape.closePath();

  const pointGeo = new THREE.ExtrudeGeometry(pointShape, {
    depth: 0.036,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.01,
    bevelSegments: 2,
  });
  pointGeo.translate(0, 0, -0.018);

  const cardinals = [
    { x: 0, y: 0.36, rz: 0, s: 1.08 },
    { x: 0, y: -0.36, rz: Math.PI, s: 0.92 },
    { x: 0.36, y: 0, rz: -Math.PI * 0.5, s: 0.92 },
    { x: -0.36, y: 0, rz: Math.PI * 0.5, s: 0.92 },
  ];
  for (const c of cardinals) {
    const pm = addMesh(THREE, emblem, pointGeo, mats.emblemBrass, c.x, c.y, 0);
    pm.rotation.z = c.rz;
    pm.scale.setScalar(c.s);
  }

  // Minor diagonal ticks (NW, SE, SW; NE is swept by the rising arrow)
  const tickGeo = bevelledBlockGeo(THREE, 0.038, 0.13, 0.036, 0.01, 0.006, 2);
  for (const ang of [Math.PI * 0.75, -Math.PI * 0.25, -Math.PI * 0.75]) {
    const r = 0.29;
    const tm = addMesh(THREE, emblem, tickGeo, mats.emblemBrass, Math.cos(ang) * r, Math.sin(ang) * r, 0);
    tm.rotation.z = ang - Math.PI * 0.5;
  }

  // Central luminous compass hub
  const hubGeo = new THREE.SphereGeometry(0.075, 12, 10);
  hubGeo.scale(1, 1, 0.65);
  addMesh(THREE, emblem, hubGeo, mats.emblemBrass, 0, 0, 0);

  // Bold dynamic Rising Arrow surging diagonally upward-right through the compass
  const arrowShape = new THREE.Shape();
  // Local arrow pointing +X, then rotated to ~44 degrees
  arrowShape.moveTo(-0.46, -0.028);
  arrowShape.lineTo(0.28, -0.044);
  arrowShape.lineTo(0.24, -0.14);
  arrowShape.lineTo(0.56, 0.0);
  arrowShape.lineTo(0.24, 0.14);
  arrowShape.lineTo(0.28, 0.044);
  arrowShape.lineTo(-0.46, 0.028);
  arrowShape.lineTo(-0.39, 0.0);
  arrowShape.closePath();

  const arrowGeo = new THREE.ExtrudeGeometry(arrowShape, {
    depth: 0.056,
    bevelEnabled: true,
    bevelThickness: 0.016,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  arrowGeo.translate(0, 0, -0.028);
  arrowGeo.computeVertexNormals();

  const arrowMesh = addMesh(THREE, emblem, arrowGeo, mats.emblemGlow, 0.04, 0.04, 0.025);
  arrowMesh.rotation.z = Math.PI * 0.245;

  g.add(emblem);
  root.add(g);
}

function buildNoticeKiosk(THREE, mats, root) {
  const g = new THREE.Group();
  g.position.set(-2.65, 0.15, 2.52);
  g.rotation.y = 0.32;

  // Stone footing blocks & two warm wood posts
  const footGeo = bevelledBlockGeo(THREE, 0.15, 0.12, 0.15, 0.03, 0.01, 2);
  const postGeo = bevelledBlockGeo(THREE, 0.075, 1.32, 0.075, 0.02, 0.008, 2);
  for (const x of [-0.46, 0.46]) {
    addMesh(THREE, g, footGeo, mats.stone, x, 0.06, 0);
    addMesh(THREE, g, postGeo, mats.woodDark, x, 0.72, 0);
  }

  // Display case frame & cork backing (double-sided neat finish)
  const boxGeo = bevelledBlockGeo(THREE, 0.96, 0.64, 0.11, 0.035, 0.012, 2);
  addMesh(THREE, g, boxGeo, mats.wood, 0, 0.92, 0);

  const corkGeo = bevelledPanelGeo(THREE, 0.84, 0.52, 0.03, 0.015, 0.004, 2);
  addMesh(THREE, g, corkGeo, mats.cork, 0, 0.92, 0.05);

  // Subtle warm light strip tucked under the hood
  const stripGeo = bevelledBlockGeo(THREE, 0.74, 0.026, 0.04, 0.01, 0.004, 2);
  addMesh(THREE, g, stripGeo, mats.lampGlow, 0, 1.24, 0.09, false);

  // Mini pitched royal-blue shelter roof matching the main building
  const hoodSlope = bevelledBlockGeo(THREE, 1.16, 0.055, 0.34, 0.025, 0.01, 2);
  const hoodF = addMesh(THREE, g, hoodSlope, mats.roof, 0, 1.37, 0.12);
  hoodF.rotation.x = 0.42;
  const hoodB = addMesh(THREE, g, hoodSlope, mats.roof, 0, 1.37, -0.12);
  hoodB.rotation.x = -0.42;
  const hoodRidge = bevelledBlockGeo(THREE, 1.18, 0.055, 0.08, 0.02, 0.008, 2);
  addMesh(THREE, g, hoodRidge, mats.roofTrim, 0, 1.44, 0);

  // Blank pastel notice cards with tiny coloured pinheads (no text, no letters!)
  const cardGeo = bevelledPanelGeo(THREE, 1, 1, 0.012, 0.015, 0.003, 2);
  const pinGeo = new THREE.SphereGeometry(0.016, 8, 6);
  const cardMats = [
    new THREE.MeshStandardMaterial({ color: 0xfbf6ea, roughness: 0.82 }),
    new THREE.MeshStandardMaterial({ color: 0xdae9fb, roughness: 0.82 }),
    new THREE.MeshStandardMaterial({ color: 0xfce6cf, roughness: 0.82 }),
    new THREE.MeshStandardMaterial({ color: 0xddf2e2, roughness: 0.82 }),
    new THREE.MeshStandardMaterial({ color: 0xfef3c5, roughness: 0.82 }),
  ];
  const cards = [
    { x: -0.28, y: 1.04, w: 0.16, h: 0.19, rz: 0.04, m: 0 },
    { x: -0.07, y: 1.05, w: 0.15, h: 0.16, rz: -0.05, m: 1 },
    { x: 0.12, y: 1.03, w: 0.17, h: 0.18, rz: 0.02, m: 2 },
    { x: 0.31, y: 1.05, w: 0.14, h: 0.17, rz: -0.04, m: 3 },
    { x: -0.25, y: 0.81, w: 0.18, h: 0.15, rz: -0.03, m: 4 },
    { x: -0.04, y: 0.81, w: 0.15, h: 0.17, rz: 0.05, m: 0 },
    { x: 0.15, y: 0.8, w: 0.14, h: 0.14, rz: -0.06, m: 1 },
    { x: 0.31, y: 0.82, w: 0.15, h: 0.16, rz: 0.03, m: 2 },
  ];

  for (const c of cards) {
    const cm = new THREE.Mesh(cardGeo, cardMats[c.m]);
    cm.position.set(c.x, c.y, 0.072);
    cm.scale.set(c.w, c.h, 1);
    cm.rotation.z = c.rz;
    cm.receiveShadow = true;
    g.add(cm);

    const pin = new THREE.Mesh(pinGeo, c.m % 2 === 0 ? mats.chair1 : mats.pennant);
    pin.position.set(c.x, c.y + c.h * 0.38, 0.082);
    g.add(pin);
  }

  root.add(g);
}

function createWavingPennantGeo(THREE, len = 1.08, height = 0.42, segs = 12, thick = 0.016) {
  // Smooth closed waving triangular pennant (plain, no text/logo)
  const positions = [];
  const indices = [];
  const halfT = thick * 0.5;

  for (let side = 0; side < 2; side++) {
    const zSign = side === 0 ? 1 : -1;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = t * len;
      const halfH = (1 - t * 0.94) * (height * 0.5);
      const wave = Math.sin(t * Math.PI * 2.1) * 0.055 * t + Math.sin(t * Math.PI * 1.1) * 0.03 * t;
      const drop = -t * t * 0.04;
      positions.push(x, halfH + drop, wave + zSign * halfT);
      positions.push(x, -halfH + drop, wave + zSign * halfT);
    }
  }

  const stride = (segs + 1) * 2;
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    // Front face
    indices.push(a, b, c, b, d, c);
    // Back face
    const a2 = stride + a;
    const b2 = stride + b;
    const c2 = stride + c;
    const d2 = stride + d;
    indices.push(a2, c2, b2, b2, c2, d2);
    // Top edge
    indices.push(a, c, a2, c, c2, a2);
    // Bottom edge
    indices.push(b, b2, d, d, b2, d2);
  }
  // Hoist edge & tip
  indices.push(0, stride, 1, 1, stride, stride + 1);
  const last = segs * 2;
  indices.push(last, last + 1, stride + last, last + 1, stride + last + 1, stride + last);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildFlagpole(THREE, mats, root) {
  const g = new THREE.Group();
  g.position.set(3.22, 0.15, 2.74);

  // Rounded stone plinth & bronze collar
  const plinthGeo = new THREE.CylinderGeometry(0.28, 0.34, 0.18, 12);
  addMesh(THREE, g, plinthGeo, mats.stone, 0, 0.09, 0);
  const collarGeo = new THREE.CylinderGeometry(0.1, 0.13, 0.1, 12);
  addMesh(THREE, g, collarGeo, mats.bronze, 0, 0.22, 0);

  // Slender tapered steel flagpole
  const poleH = 3.95;
  const poleGeo = new THREE.CylinderGeometry(0.026, 0.052, poleH, 12);
  addMesh(THREE, g, poleGeo, mats.steel, 0, 0.22 + poleH * 0.5, 0);

  // Brass ball finial
  const finialGeo = new THREE.SphereGeometry(0.068, 12, 10);
  addMesh(THREE, g, finialGeo, mats.brass, 0, 0.22 + poleH + 0.05, 0);

  // Plain waving pennant (royal blue / accent) with slim gold hoist band
  const pennantGroup = new THREE.Group();
  pennantGroup.position.set(0, 0.22 + poleH - 0.26, 0);
  pennantGroup.rotation.y = -0.35;

  const pennantGeo = createWavingPennantGeo(THREE, 1.05, 0.42, 12, 0.016);
  addMesh(THREE, pennantGroup, pennantGeo, mats.pennant, 0.03, 0, 0);

  const hoistBand = new THREE.CylinderGeometry(0.034, 0.034, 0.43, 8);
  addMesh(THREE, pennantGroup, hoistBand, mats.pennantTrim, 0.01, 0, 0);

  g.add(pennantGroup);
  root.add(g);
}

function buildPlazaFurnitureAndFoliage(THREE, mats, root) {
  const g = new THREE.Group();

  // --- Cozy Contemporary Benches ---
  const seatSlatGeo = bevelledBlockGeo(THREE, 0.96, 0.042, 0.1, 0.015, 0.008, 2);
  const legFrameGeo = bevelledBlockGeo(THREE, 0.06, 0.26, 0.34, 0.02, 0.008, 2);
  const backPostGeo = bevelledBlockGeo(THREE, 0.045, 0.28, 0.045, 0.012, 0.006, 2);

  function addBench(x, z, rotY) {
    const bg = new THREE.Group();
    bg.position.set(x, 0.15, z);
    bg.rotation.y = rotY;
    addMesh(THREE, bg, legFrameGeo, mats.bronze, -0.36, 0.13, 0);
    addMesh(THREE, bg, legFrameGeo, mats.bronze, 0.36, 0.13, 0);
    // Seat slats
    for (const dz of [-0.11, 0, 0.11]) {
      addMesh(THREE, bg, seatSlatGeo, mats.wood, 0, 0.27, dz);
    }
    // Slight tilted backrest
    for (const bx of [-0.36, 0.36]) {
      const bp = addMesh(THREE, bg, backPostGeo, mats.bronze, bx, 0.38, -0.17);
      bp.rotation.x = -0.2;
    }
    const back1 = addMesh(THREE, bg, seatSlatGeo, mats.wood, 0, 0.43, -0.18);
    back1.rotation.x = Math.PI * 0.5 - 0.2;
    const back2 = addMesh(THREE, bg, seatSlatGeo, mats.wood, 0, 0.54, -0.205);
    back2.rotation.x = Math.PI * 0.5 - 0.2;
    g.add(bg);
  }

  // Bench 1 under front-left brick facade, Bench 2 along front-right plaza edge
  addBench(-2.05, 1.82, 0);
  addBench(2.08, 2.94, 0);

  // --- Sculpted Stone Planters + Instanced Foliage & Flowers ---
  const planterSpecs = [
    // Flanking entrance columns
    { x: -1.48, z: 2.52, w: 0.58, d: 0.58, h: 0.34, tree: false, flowers: true },
    { x: 1.48, z: 2.52, w: 0.58, d: 0.58, h: 0.34, tree: false, flowers: true },
    // Front-left plaza corner
    { x: -3.48, z: 2.94, w: 0.72, d: 0.72, h: 0.38, tree: true, treeH: 1.15, flowers: true },
    // Left side walkway
    { x: -3.55, z: -0.4, w: 0.64, d: 1.25, h: 0.36, tree: true, treeH: 1.4, flowers: false },
    // Right side (clear of interview room side window)
    { x: 3.55, z: -1.25, w: 0.64, d: 1.35, h: 0.36, tree: false, flowers: true },
    // Rear corners
    { x: -3.45, z: -2.92, w: 0.74, d: 0.74, h: 0.38, tree: true, treeH: 1.3, flowers: false },
    { x: 3.45, z: -2.92, w: 0.74, d: 0.74, h: 0.38, tree: true, treeH: 1.25, flowers: false },
  ];

  const foliagePuffs1 = [];
  const foliagePuffs2 = [];
  const foliagePuffs3 = [];
  const flowerPuffs = [];
  const rand = pseudoRand(6143);

  const trunkGeo = new THREE.CylinderGeometry(0.045, 0.072, 1, 8);

  for (const p of planterSpecs) {
    const bodyGeo = bevelledBlockGeo(THREE, p.w, p.h, p.d, 0.09, 0.02, 3);
    addMesh(THREE, g, bodyGeo, mats.stone, p.x, 0.15 + p.h * 0.5, p.z);

    const rimGeo = bevelledBlockGeo(THREE, p.w + 0.06, 0.06, p.d + 0.06, 0.1, 0.015, 3);
    addMesh(THREE, g, rimGeo, mats.stone, p.x, 0.15 + p.h - 0.02, p.z);

    const soilGeo = bevelledBlockGeo(THREE, p.w - 0.12, 0.04, p.d - 0.12, 0.05, 0.008, 2);
    addMesh(THREE, g, soilGeo, mats.soil, p.x, 0.15 + p.h - 0.01, p.z);

    const topY = 0.15 + p.h + 0.02;

    if (p.tree) {
      const th = p.treeH;
      const trunk = addMesh(THREE, g, trunkGeo, mats.woodDark, p.x, topY + th * 0.45, p.z);
      trunk.scale.set(1, th, 1);

      // Multi-puff cozy stylized canopy
      const cy = topY + th + 0.25;
      foliagePuffs1.push({ x: p.x, y: cy + 0.18, z: p.z, sx: 0.42, sy: 0.38, sz: 0.42 });
      foliagePuffs2.push({ x: p.x - 0.22, y: cy, z: p.z + 0.16, sx: 0.32, sy: 0.28, sz: 0.32 });
      foliagePuffs2.push({ x: p.x + 0.22, y: cy + 0.04, z: p.z - 0.14, sx: 0.33, sy: 0.3, sz: 0.33 });
      foliagePuffs3.push({ x: p.x + 0.1, y: cy - 0.08, z: p.z + 0.2, sx: 0.27, sy: 0.24, sz: 0.27 });
      foliagePuffs3.push({ x: p.x - 0.18, y: cy - 0.05, z: p.z - 0.18, sx: 0.28, sy: 0.25, sz: 0.28 });

      // Low groundcover bushes around tree base
      foliagePuffs1.push({ x: p.x - 0.14, y: topY + 0.08, z: p.z + 0.14, sx: 0.16, sy: 0.12, sz: 0.16 });
      foliagePuffs3.push({ x: p.x + 0.15, y: topY + 0.08, z: p.z - 0.1, sx: 0.15, sy: 0.11, sz: 0.15 });
    } else {
      // Sculpted rounded shrubs filling the planter
      const countZ = p.d > 0.9 ? 3 : 1;
      for (let k = 0; k < countZ; k++) {
        const oz = countZ === 1 ? 0 : (k - 1) * 0.34;
        const r = 0.22 + rand() * 0.04;
        foliagePuffs1.push({ x: p.x, y: topY + 0.14, z: p.z + oz, sx: r, sy: r * 0.85, sz: r });
        foliagePuffs2.push({ x: p.x - 0.1, y: topY + 0.18, z: p.z + oz + 0.08, sx: r * 0.72, sy: r * 0.68, sz: r * 0.72 });
        foliagePuffs3.push({ x: p.x + 0.11, y: topY + 0.12, z: p.z + oz - 0.07, sx: r * 0.68, sy: r * 0.6, sz: r * 0.68 });
      }
    }

    if (p.flowers) {
      const fCount = p.d > 0.9 ? 7 : 4;
      for (let f = 0; f < fCount; f++) {
        flowerPuffs.push({
          x: p.x + (rand() - 0.5) * (p.w * 0.6),
          y: topY + 0.2 + rand() * 0.12,
          z: p.z + (rand() - 0.5) * (p.d * 0.6),
          s: 0.045 + rand() * 0.02,
        });
      }
    }
  }

  // Instanced foliage clusters
  const puffGeo = new THREE.IcosahedronGeometry(1, 1);
  const dummy = new THREE.Object3D();

  function addPuffInst(list, mat) {
    if (!list.length) return;
    const inst = new THREE.InstancedMesh(puffGeo, mat, list.length);
    inst.castShadow = true;
    inst.receiveShadow = true;
    list.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(i * 0.7, i * 1.1, i * 0.5);
      dummy.scale.set(p.sx, p.sy, p.sz);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    g.add(inst);
  }

  addPuffInst(foliagePuffs1, mats.foliage1);
  addPuffInst(foliagePuffs2, mats.foliage2);
  addPuffInst(foliagePuffs3, mats.foliage3);

  // Warm flower accents
  const flowerGeo = new THREE.DodecahedronGeometry(1, 0);
  const warmFlowers = flowerPuffs.filter((_, i) => i % 2 === 0);
  const coralFlowers = flowerPuffs.filter((_, i) => i % 2 === 1);
  for (const [list, mat] of [[warmFlowers, mats.flowerWarm], [coralFlowers, mats.flowerCoral]]) {
    if (!list.length) continue;
    const inst = new THREE.InstancedMesh(flowerGeo, mat, list.length);
    list.forEach((f, i) => {
      dummy.position.set(f.x, f.y, f.z);
      dummy.rotation.set(i, i * 0.6, 0);
      dummy.scale.setScalar(f.s);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    g.add(inst);
  }

  // --- Instanced Contemporary Plaza Bollard Lights ---
  const bollardCoords = [
    [-1.24, 3.22],
    [1.24, 3.22],
    [-3.58, 1.48],
    [3.58, 1.48],
  ];
  const bolPostGeo = new THREE.CylinderGeometry(0.055, 0.068, 0.44, 10);
  const bolLensGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.11, 10);
  const bolCapGeo = new THREE.SphereGeometry(0.062, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);

  const nBol = bollardCoords.length;
  const bolPostInst = new THREE.InstancedMesh(bolPostGeo, mats.bronze, nBol);
  const bolLensInst = new THREE.InstancedMesh(bolLensGeo, mats.lampGlow, nBol);
  const bolCapInst = new THREE.InstancedMesh(bolCapGeo, mats.bronze, nBol);
  bolPostInst.castShadow = true;
  bolPostInst.receiveShadow = true;
  bolCapInst.castShadow = true;

  bollardCoords.forEach(([x, z], i) => {
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);

    dummy.position.set(x, 0.15 + 0.22, z);
    dummy.updateMatrix();
    bolPostInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, 0.15 + 0.48, z);
    dummy.updateMatrix();
    bolLensInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, 0.15 + 0.53, z);
    dummy.updateMatrix();
    bolCapInst.setMatrixAt(i, dummy.matrix);
  });
  [bolPostInst, bolLensInst, bolCapInst].forEach((inst) => {
    inst.instanceMatrix.needsUpdate = true;
    g.add(inst);
  });

  root.add(g);
}

// --- Public API ---

export function build(THREE, opts = {}, kit) {
  const group = new THREE.Group();
  group.name = 'CareerAndOpportunitiesCenter';

  const accentColor = new THREE.Color(opts && opts.accent !== undefined ? opts.accent : DEFAULT_ACCENT);
  const hl = {
    windowMats: [],
    emblemMats: [],
    roofMats: [],
  };

  const mats = createMaterials(THREE, kit, accentColor, hl);

  buildBasePlaza(THREE, mats, group);
  buildMainBuilding(THREE, mats, group);
  buildInterviewRoom(THREE, mats, group);
  buildEntranceCanopy(THREE, mats, group);
  buildRoofAndEmblem(THREE, mats, group);
  buildNoticeKiosk(THREE, mats, group);
  buildFlagpole(THREE, mats, group);
  buildPlazaFurnitureAndFoliage(THREE, mats, group);

  group.userData.highlightTargets = hl;
  return group;
}

export function setHighlight(group, on) {
  const hl = group && group.userData && group.userData.highlightTargets;
  if (!hl) return;
  const active = Boolean(on);

  for (const item of hl.windowMats) {
    item.mat.emissiveIntensity = active ? item.on : item.base;
  }
  for (const item of hl.emblemMats) {
    item.mat.emissiveIntensity = active ? item.on : item.base;
  }
  for (const item of hl.roofMats) {
    item.mat.emissiveIntensity = active ? item.on : item.base;
  }
}
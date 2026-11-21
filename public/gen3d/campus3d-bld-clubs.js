export const ENTRANCE = [0, 0.15, 2.12];

export function setHighlight(group, on) {
  if (!group || !group.userData || !group.userData.highlight) return;
  const h = group.userData.highlight;
  const active = Boolean(on);
  for (let i = 0; i < h.windows.length; i++) {
    const e = h.windows[i];
    e.mat.emissive.copy(active ? e.hiColor : e.baseColor);
    e.mat.emissiveIntensity = active ? e.hiIntensity : e.baseIntensity;
  }
  for (let i = 0; i < h.lights.length; i++) {
    const e = h.lights[i];
    e.mat.emissive.copy(active ? e.hiColor : e.baseColor);
    e.mat.emissiveIntensity = active ? e.hiIntensity : e.baseIntensity;
  }
  for (let i = 0; i < h.canopies.length; i++) {
    const e = h.canopies[i];
    e.mat.emissive.copy(active ? e.hiColor : e.baseColor);
    e.mat.emissiveIntensity = active ? e.hiIntensity : e.baseIntensity;
  }
}

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function applyBoxUVs(geo, scale = 1) {
  const pos = geo.attributes.position;
  let uv = geo.attributes.uv;
  if (!uv) {
    uv = new pos.constructor(new Float32Array(pos.count * 2), 2);
    geo.setAttribute('uv', uv);
  }
  if (!geo.index) {
    for (let i = 0; i < pos.count; i += 3) {
      const ax = pos.getX(i), ay = pos.getY(i), az = pos.getZ(i);
      const bx = pos.getX(i + 1), by = pos.getY(i + 1), bz = pos.getZ(i + 1);
      const cx = pos.getX(i + 2), cy = pos.getY(i + 2), cz = pos.getZ(i + 2);
      const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
      const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
      const nx = Math.abs(e1y * e2z - e1z * e2y);
      const ny = Math.abs(e1z * e2x - e1x * e2z);
      const nz = Math.abs(e1x * e2y - e1y * e2x);
      for (let k = 0; k < 3; k++) {
        const vi = i + k;
        const x = pos.getX(vi), y = pos.getY(vi), z = pos.getZ(vi);
        if (ny >= nx && ny >= nz) uv.setXY(vi, x * scale, z * scale);
        else if (nx >= ny && nx >= nz) uv.setXY(vi, z * scale, y * scale);
        else uv.setXY(vi, x * scale, y * scale);
      }
    }
  }
  uv.needsUpdate = true;
  return geo;
}

function roundedBoxGeo(THREE, w, h, d, r = 0.03, segs = 2, uvScale = 0.5) {
  const bevel = Math.min(r, w * 0.28, h * 0.28, d * 0.28);
  const iw = Math.max(0.002, w - 2 * bevel);
  const ih = Math.max(0.002, h - 2 * bevel);
  const hw = iw * 0.5;
  const hh = ih * 0.5;
  const cr = Math.max(0.001, Math.min(r * 0.7, hw * 0.85, hh * 0.85));

  const shape = new THREE.Shape();
  shape.moveTo(-hw + cr, -hh);
  shape.lineTo(hw - cr, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + cr);
  shape.lineTo(hw, hh - cr);
  shape.quadraticCurveTo(hw, hh, hw - cr, hh);
  shape.lineTo(-hw + cr, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - cr);
  shape.lineTo(-hw, -hh + cr);
  shape.quadraticCurveTo(-hw, -hh, -hw + cr, -hh);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.002, d - 2 * bevel),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: segs,
    curveSegments: segs
  });
  geo.center();
  applyBoxUVs(geo, uvScale);
  return geo;
}

function makeTex(THREE, kit, w, h, rx, ry, drawFn) {
  const tex = kit.canvasTexture(w, h, drawFn);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  if ('colorSpace' in tex && THREE.SRGBColorSpace) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.needsUpdate = true;
  return tex;
}

function createTextures(THREE, kit) {
  const rng = makeRng(4207);

  const brick = makeTex(THREE, kit, 256, 256, 1, 1, (ctx, w, h) => {
    ctx.fillStyle = '#d9cbb9';
    ctx.fillRect(0, 0, w, h);
    const rows = 12;
    const cols = 6;
    const rh = h / rows;
    const cw = w / cols;
    const mortar = 2.4;
    const palette = ['#b85840', '#c26146', '#ad4e39', '#c96c50', '#b3533d', '#bc5d43'];
    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (cw * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * cw + offset + mortar * 0.5;
        const y = r * rh + mortar * 0.5;
        const bw = cw - mortar;
        const bh = rh - mortar;
        ctx.fillStyle = palette[Math.floor(rng() * palette.length)];
        ctx.fillRect(x, y, bw, bh);
        ctx.fillStyle = 'rgba(255,235,215,0.14)';
        ctx.fillRect(x, y, bw, 2.2);
        ctx.fillStyle = 'rgba(65,24,15,0.14)';
        ctx.fillRect(x, y + bh - 2.2, bw, 2.2);
      }
    }
    for (let i = 0; i < 600; i++) {
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255,245,230,0.06)' : 'rgba(50,20,10,0.07)';
      ctx.fillRect(rng() * w, rng() * h, 2, 2);
    }
  });

  const stone = makeTex(THREE, kit, 256, 256, 1, 1, (ctx, w, h) => {
    ctx.fillStyle = '#e7dfd1';
    ctx.fillRect(0, 0, w, h);
    const rows = 6;
    const cols = 3;
    const rh = h / rows;
    const cw = w / cols;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (cw * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * cw + off;
        const y = r * rh;
        const shade = Math.floor((rng() - 0.5) * 14);
        ctx.fillStyle = `rgb(${232 + shade},${223 + shade},${208 + shade})`;
        ctx.fillRect(x + 1.5, y + 1.5, cw - 3, rh - 3);
      }
    }
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.1)' : 'rgba(120,108,92,0.08)';
      ctx.fillRect(rng() * w, rng() * h, 2, 2);
    }
  });

  const paving = makeTex(THREE, kit, 256, 256, 1.15, 1.15, (ctx, w, h) => {
    ctx.fillStyle = '#bfb4a4';
    ctx.fillRect(0, 0, w, h);
    const rows = 8;
    const cols = 8;
    const rh = h / rows;
    const cw = w / cols;
    const tones = ['#dad0c2', '#d3c8b8', '#ded5c8', '#cdc1b0', '#d8cec0'];
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (cw * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * cw + off + 1.5;
        const y = r * rh + 1.5;
        ctx.fillStyle = tones[Math.floor(rng() * tones.length)];
        ctx.fillRect(x, y, cw - 3, rh - 3);
        ctx.fillStyle = 'rgba(255,250,242,0.22)';
        ctx.fillRect(x, y, cw - 3, 2);
      }
    }
    for (let i = 0; i < 650; i++) {
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(90,78,66,0.07)';
      ctx.fillRect(rng() * w, rng() * h, 2, 2);
    }
  });

  const wood = makeTex(THREE, kit, 256, 256, 1, 1, (ctx, w, h) => {
    ctx.fillStyle = '#b9824f';
    ctx.fillRect(0, 0, w, h);
    const planks = 8;
    const ph = h / planks;
    for (let i = 0; i < planks; i++) {
      const y = i * ph;
      const d = Math.floor((rng() - 0.5) * 20);
      ctx.fillStyle = `rgb(${188 + d},${131 + d},${79 + Math.floor(d * 0.6)})`;
      ctx.fillRect(0, y + 1, w, ph - 2);
      ctx.fillStyle = 'rgba(72,40,18,0.28)';
      ctx.fillRect(0, y, w, 1.5);
      for (let g = 0; g < 6; g++) {
        ctx.fillStyle = 'rgba(110,65,28,0.1)';
        ctx.fillRect(0, y + 3 + rng() * (ph - 6), w, 1.2);
      }
    }
  });

  const roofTile = makeTex(THREE, kit, 256, 256, 1.2, 1.2, (ctx, w, h) => {
    ctx.fillStyle = '#c4bbb0';
    ctx.fillRect(0, 0, w, h);
    const n = 6;
    const s = w / n;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const d = Math.floor((rng() - 0.5) * 14);
        ctx.fillStyle = `rgb(${205 + d},${197 + d},${187 + d})`;
        ctx.fillRect(c * s + 2, r * s + 2, s - 4, s - 4);
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(c * s + 2, r * s + 2, s - 4, 2);
      }
    }
  });

  const canopy = makeTex(THREE, kit, 128, 128, 2, 2, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 8) {
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(i, 0, 2, h);
    }
    for (let j = 0; j < h; j += 8) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, j, w, 2);
    }
  });

  return { brick, stone, paving, wood, roofTile, canopy };
}

function createMaterials(THREE, tex, accentInput) {
  const accentCol = new THREE.Color(accentInput !== undefined && accentInput !== null ? accentInput : '#e85d56');
  const accentDark = accentCol.clone().multiplyScalar(0.76);
  const accentGlow = accentCol.clone().lerp(new THREE.Color('#ffb088'), 0.28);

  const windowLit = new THREE.MeshStandardMaterial({
    color: '#ffe6b8',
    emissive: new THREE.Color('#ffbe66'),
    emissiveIntensity: 0.62,
    roughness: 0.16,
    metalness: 0.12
  });

  const lobbyGlass = new THREE.MeshStandardMaterial({
    color: '#dff2fa',
    emissive: new THREE.Color('#ffd38a'),
    emissiveIntensity: 0.24,
    roughness: 0.12,
    metalness: 0.18,
    transparent: true,
    opacity: 0.42
  });

  const railGlass = new THREE.MeshStandardMaterial({
    color: '#d9eef7',
    roughness: 0.12,
    metalness: 0.15,
    transparent: true,
    opacity: 0.34
  });

  const stringBulb = new THREE.MeshStandardMaterial({
    color: '#fff6d6',
    emissive: new THREE.Color('#ffc966'),
    emissiveIntensity: 1.15,
    roughness: 0.2
  });

  const lampGlobe = new THREE.MeshStandardMaterial({
    color: '#fff9e6',
    emissive: new THREE.Color('#ffd07a'),
    emissiveIntensity: 0.95,
    roughness: 0.22
  });

  const canopyMain = new THREE.MeshStandardMaterial({
    color: accentCol,
    map: tex.canopy,
    emissive: new THREE.Color('#000000'),
    emissiveIntensity: 0,
    roughness: 0.74,
    metalness: 0.04
  });

  const canopyTrim = new THREE.MeshStandardMaterial({
    color: accentDark,
    emissive: new THREE.Color('#000000'),
    emissiveIntensity: 0,
    roughness: 0.65,
    metalness: 0.08
  });

  const highlight = {
    windows: [
      {
        mat: windowLit,
        baseColor: new THREE.Color('#ffbe66'),
        hiColor: new THREE.Color('#ffd685'),
        baseIntensity: 0.62,
        hiIntensity: 1.45
      },
      {
        mat: lobbyGlass,
        baseColor: new THREE.Color('#ffd38a'),
        hiColor: new THREE.Color('#ffe09e'),
        baseIntensity: 0.24,
        hiIntensity: 0.72
      }
    ],
    lights: [
      {
        mat: stringBulb,
        baseColor: new THREE.Color('#ffc966'),
        hiColor: new THREE.Color('#ffe8a6'),
        baseIntensity: 1.15,
        hiIntensity: 2.75
      },
      {
        mat: lampGlobe,
        baseColor: new THREE.Color('#ffd07a'),
        hiColor: new THREE.Color('#ffebb3'),
        baseIntensity: 0.95,
        hiIntensity: 2.35
      }
    ],
    canopies: [
      {
        mat: canopyMain,
        baseColor: new THREE.Color('#000000'),
        hiColor: accentGlow,
        baseIntensity: 0,
        hiIntensity: 0.36
      },
      {
        mat: canopyTrim,
        baseColor: new THREE.Color('#000000'),
        hiColor: accentGlow,
        baseIntensity: 0,
        hiIntensity: 0.26
      }
    ]
  };

  const mats = {
    brick: new THREE.MeshStandardMaterial({ map: tex.brick, roughness: 0.86, metalness: 0.02 }),
    stone: new THREE.MeshStandardMaterial({ map: tex.stone, roughness: 0.82, metalness: 0.02 }),
    paving: new THREE.MeshStandardMaterial({ map: tex.paving, roughness: 0.88, metalness: 0.02 }),
    walkway: new THREE.MeshStandardMaterial({ map: tex.stone, color: '#f3ece0', roughness: 0.84 }),
    wood: new THREE.MeshStandardMaterial({ map: tex.wood, roughness: 0.68, metalness: 0.04 }),
    woodDark: new THREE.MeshStandardMaterial({ map: tex.wood, color: '#8f623d', roughness: 0.72 }),
    roofTile: new THREE.MeshStandardMaterial({ map: tex.roofTile, roughness: 0.86 }),
    bronze: new THREE.MeshStandardMaterial({ color: '#373b42', roughness: 0.42, metalness: 0.52 }),
    steel: new THREE.MeshStandardMaterial({ color: '#c4cad2', roughness: 0.34, metalness: 0.65 }),
    brass: new THREE.MeshStandardMaterial({ color: '#d8ab54', roughness: 0.3, metalness: 0.75 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#27292e', roughness: 0.82, metalness: 0.05 }),
    cork: new THREE.MeshStandardMaterial({ color: '#c49664', roughness: 0.92 }),
    terracotta: new THREE.MeshStandardMaterial({ color: '#c66d4b', roughness: 0.8 }),
    soil: new THREE.MeshStandardMaterial({ color: '#5c4635', roughness: 0.95 }),
    trunk: new THREE.MeshStandardMaterial({ color: '#78563c', roughness: 0.88 }),
    foliage1: new THREE.MeshStandardMaterial({ color: '#619b58', roughness: 0.78 }),
    foliage2: new THREE.MeshStandardMaterial({ color: '#79b368', roughness: 0.76 }),
    creamCloth: new THREE.MeshStandardMaterial({ color: '#f4eee2', roughness: 0.84 }),
    cushionMustard: new THREE.MeshStandardMaterial({ color: '#ebb149', roughness: 0.82 }),
    cushionTeal: new THREE.MeshStandardMaterial({ color: '#4da895', roughness: 0.82 }),
    leather: new THREE.MeshStandardMaterial({ color: '#6a4028', roughness: 0.62 }),
    bikeFrame: new THREE.MeshStandardMaterial({ color: '#4a9e8b', roughness: 0.36, metalness: 0.35 }),
    basket: new THREE.MeshStandardMaterial({ color: '#cfa064', roughness: 0.86 }),
    speakerBody: new THREE.MeshStandardMaterial({ color: '#2c3037', roughness: 0.68, metalness: 0.15 }),
    speakerCone: new THREE.MeshStandardMaterial({ color: '#1b1d22', roughness: 0.55, metalness: 0.2 }),
    matWelcome: new THREE.MeshStandardMaterial({ color: '#4a433d', roughness: 0.94 }),
    instanceFlat: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.76 }),
    canopyMain,
    canopyTrim,
    windowLit,
    lobbyGlass,
    railGlass,
    stringBulb,
    lampGlobe,
    tentCanopies: [
      new THREE.MeshStandardMaterial({ color: '#eeb34b', map: tex.canopy, roughness: 0.78 }),
      new THREE.MeshStandardMaterial({ color: '#4bb39a', map: tex.canopy, roughness: 0.78 }),
      new THREE.MeshStandardMaterial({ color: '#5c9ed6', map: tex.canopy, roughness: 0.78 }),
      new THREE.MeshStandardMaterial({ color: '#d47aa6', map: tex.canopy, roughness: 0.78 })
    ]
  };

  return { mats, highlight };
}

function addMesh(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, cast = true, recv = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (rx || ry || rz) m.rotation.set(rx, ry, rz);
  m.castShadow = cast;
  m.receiveShadow = recv;
  parent.add(m);
  return m;
}

function addMeshRef(THREE, parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, cast = true, recv = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (rx || ry || rz) m.rotation.set(rx, ry, rz);
  m.castShadow = cast;
  m.receiveShadow = recv;
  parent.add(m);
  return m;
}

function buildBase(THREE, root, mats) {
  const baseGeo = roundedBoxGeo(THREE, 8.0, 0.15, 7.0, 0.04, 2, 0.35);
  addMeshRef(THREE, root, baseGeo, mats.paving, 0, 0.075, 0, 0, 0, 0, false, true);

  const curbH = 0.032;
  const curbT = 0.12;
  const curbLong = roundedBoxGeo(THREE, 7.92, curbH, curbT, 0.014, 2, 0.5);
  const curbSide = roundedBoxGeo(THREE, curbT, curbH, 6.72, 0.014, 2, 0.5);
  addMeshRef(THREE, root, curbLong, mats.stone, 0, 0.158, -3.44, 0, 0, 0, false, true);
  addMeshRef(THREE, root, curbSide, mats.stone, -3.94, 0.158, 0, 0, 0, 0, false, true);
  addMeshRef(THREE, root, curbSide, mats.stone, 3.94, 0.158, 0, 0, 0, 0, false, true);

  const frontCurbSeg = roundedBoxGeo(THREE, 3.36, curbH, curbT, 0.014, 2, 0.5);
  addMeshRef(THREE, root, frontCurbSeg, mats.stone, -2.26, 0.158, 3.44, 0, 0, 0, false, true);
  addMeshRef(THREE, root, frontCurbSeg, mats.stone, 2.26, 0.158, 3.44, 0, 0, 0, false, true);

  const stepGeo = roundedBoxGeo(THREE, 1.06, 0.018, 0.42, 0.008, 1, 0.5);
  for (let i = 0; i < 5; i++) {
    addMeshRef(THREE, root, stepGeo, mats.walkway, 0, 0.155, 1.48 + i * 0.46, 0, 0, 0, false, true);
  }
}

function buildMainBuilding(THREE, root, mats) {
  const g = new THREE.Group();
  root.add(g);

  // Left wing, Right wing, Center rear block (non-overlapping outer faces)
  const leftWingGeo = roundedBoxGeo(THREE, 2.08, 3.60, 3.42, 0.035, 2, 0.48);
  addMeshRef(THREE, g, leftWingGeo, mats.brick, -2.31, 1.95, -1.23, 0, 0, 0);

  const rightWingGeo = roundedBoxGeo(THREE, 2.08, 3.60, 3.30, 0.035, 2, 0.48);
  addMeshRef(THREE, g, rightWingGeo, mats.brick, 2.31, 1.95, -1.29, 0, 0, 0);

  const centerRearGeo = roundedBoxGeo(THREE, 2.60, 3.56, 2.54, 0.03, 2, 0.48);
  addMeshRef(THREE, g, centerRearGeo, mats.brick, 0, 1.93, -1.62, 0, 0, 0);

  // Stone plinth bands & mid-floor string courses
  const leftBand = roundedBoxGeo(THREE, 2.14, 0.24, 3.48, 0.02, 2, 0.5);
  const rightBand = roundedBoxGeo(THREE, 2.14, 0.24, 3.36, 0.02, 2, 0.5);
  addMeshRef(THREE, g, leftBand, mats.stone, -2.31, 0.27, -1.23);
  addMeshRef(THREE, g, rightBand, mats.stone, 2.31, 0.27, -1.29);

  const leftString = roundedBoxGeo(THREE, 2.15, 0.11, 3.49, 0.02, 2, 0.5);
  const rightString = roundedBoxGeo(THREE, 2.15, 0.11, 3.37, 0.02, 2, 0.5);
  addMeshRef(THREE, g, leftString, mats.stone, -2.31, 1.98, -1.23);
  addMeshRef(THREE, g, rightString, mats.stone, 2.31, 1.98, -1.29);

  const rearString = roundedBoxGeo(THREE, 2.66, 0.11, 0.12, 0.02, 2, 0.5);
  addMeshRef(THREE, g, rearString, mats.stone, 0, 1.98, -2.89);

  // Corner pilasters for architectural depth
  const pilasterGeo = roundedBoxGeo(THREE, 0.16, 3.56, 0.16, 0.02, 2, 0.48);
  const pilasterPos = [
    [-3.33, -2.92], [-3.33, 0.46], [-1.30, 0.46],
    [3.33, -2.92], [3.33, 0.34], [1.30, 0.34]
  ];
  for (let i = 0; i < pilasterPos.length; i++) {
    addMeshRef(THREE, g, pilasterGeo, mats.brick, pilasterPos[i][0], 1.95, pilasterPos[i][1]);
  }

  // Instanced inset windows across all 4 facades
  const winPlacements = [
    // Left wing +z upper floor (above notice wall)
    { x: -2.72, y: 2.82, z: 0.48, ry: 0, sx: 0.92, sy: 1.02 },
    { x: -1.86, y: 2.82, z: 0.48, ry: 0, sx: 0.92, sy: 1.02 },
    // Right wing +z ground & upper floor
    { x: 1.88, y: 1.12, z: 0.36, ry: 0, sx: 0.95, sy: 1.12 },
    { x: 2.74, y: 1.12, z: 0.36, ry: 0, sx: 0.95, sy: 1.12 },
    { x: 1.88, y: 2.82, z: 0.36, ry: 0, sx: 0.95, sy: 1.05 },
    { x: 2.74, y: 2.82, z: 0.36, ry: 0, sx: 0.95, sy: 1.05 },
    // Left wing -x side
    { x: -3.35, y: 1.12, z: -2.18, ry: -Math.PI / 2, sx: 0.95, sy: 1.08 },
    { x: -3.35, y: 1.12, z: -0.45, ry: -Math.PI / 2, sx: 0.95, sy: 1.08 },
    { x: -3.35, y: 2.82, z: -2.18, ry: -Math.PI / 2, sx: 0.95, sy: 1.02 },
    { x: -3.35, y: 2.82, z: -1.30, ry: -Math.PI / 2, sx: 0.95, sy: 1.02 },
    { x: -3.35, y: 2.82, z: -0.45, ry: -Math.PI / 2, sx: 0.95, sy: 1.02 },
    // Right wing +x side
    { x: 3.35, y: 1.12, z: -2.15, ry: Math.PI / 2, sx: 0.95, sy: 1.08 },
    { x: 3.35, y: 1.12, z: -1.28, ry: Math.PI / 2, sx: 0.95, sy: 1.08 },
    { x: 3.35, y: 1.12, z: -0.42, ry: Math.PI / 2, sx: 0.95, sy: 1.08 },
    { x: 3.35, y: 2.82, z: -2.15, ry: Math.PI / 2, sx: 0.95, sy: 1.02 },
    { x: 3.35, y: 2.82, z: -1.28, ry: Math.PI / 2, sx: 0.95, sy: 1.02 },
    { x: 3.35, y: 2.82, z: -0.42, ry: Math.PI / 2, sx: 0.95, sy: 1.02 },
    // Rear -z facade
    { x: -2.32, y: 1.12, z: -2.94, ry: Math.PI, sx: 1.12, sy: 1.05 },
    { x: -2.32, y: 2.82, z: -2.94, ry: Math.PI, sx: 1.12, sy: 1.02 },
    { x: 0.0, y: 2.82, z: -2.89, ry: Math.PI, sx: 1.55, sy: 1.02 },
    { x: 2.32, y: 1.12, z: -2.94, ry: Math.PI, sx: 1.12, sy: 1.05 },
    { x: 2.32, y: 2.82, z: -2.94, ry: Math.PI, sx: 1.12, sy: 1.02 }
  ];

  const count = winPlacements.length;
  const frameTopGeo = roundedBoxGeo(THREE, 0.72, 0.06, 0.11, 0.012, 1);
  const frameSideGeo = roundedBoxGeo(THREE, 0.06, 0.88, 0.11, 0.012, 1);
  const mullionGeo = roundedBoxGeo(THREE, 0.036, 0.82, 0.06, 0.008, 1);
  const sillGeo = roundedBoxGeo(THREE, 0.78, 0.065, 0.15, 0.015, 1, 0.6);
  const paneGeo = roundedBoxGeo(THREE, 0.62, 0.78, 0.03, 0.006, 1);

  const instFrameT = new THREE.InstancedMesh(frameTopGeo, mats.bronze, count * 2);
  const instFrameS = new THREE.InstancedMesh(frameSideGeo, mats.bronze, count * 2);
  const instMull = new THREE.InstancedMesh(mullionGeo, mats.bronze, count);
  const instSill = new THREE.InstancedMesh(sillGeo, mats.stone, count);
  const instPane = new THREE.InstancedMesh(paneGeo, mats.windowLit, count);

  const arr = [instFrameT, instFrameS, instMull, instSill, instPane];
  for (let i = 0; i < arr.length; i++) {
    arr[i].castShadow = i !== 4;
    arr[i].receiveShadow = true;
    g.add(arr[i]);
  }

  const dummy = new THREE.Object3D();
  const baseMat = new THREE.Matrix4();
  const locMat = new THREE.Matrix4();
  const resMat = new THREE.Matrix4();

  for (let i = 0; i < count; i++) {
    const w = winPlacements[i];
    dummy.position.set(w.x, w.y, w.z);
    dummy.rotation.set(0, w.ry, 0);
    dummy.scale.set(w.sx, w.sy, 1);
    dummy.updateMatrix();
    baseMat.copy(dummy.matrix);

    // Top & bottom frame bars
    locMat.makeTranslation(0, 0.41, 0.02);
    resMat.multiplyMatrices(baseMat, locMat);
    instFrameT.setMatrixAt(i * 2, resMat);

    locMat.makeTranslation(0, -0.41, 0.02);
    resMat.multiplyMatrices(baseMat, locMat);
    instFrameT.setMatrixAt(i * 2 + 1, resMat);

    // Left & right jambs
    locMat.makeTranslation(-0.33, 0, 0.02);
    resMat.multiplyMatrices(baseMat, locMat);
    instFrameS.setMatrixAt(i * 2, resMat);

    locMat.makeTranslation(0.33, 0, 0.02);
    resMat.multiplyMatrices(baseMat, locMat);
    instFrameS.setMatrixAt(i * 2 + 1, resMat);

    // Center mullion
    locMat.makeTranslation(0, 0, 0.018);
    resMat.multiplyMatrices(baseMat, locMat);
    instMull.setMatrixAt(i, resMat);

    // Stone sill
    locMat.makeTranslation(0, -0.46, 0.045);
    resMat.multiplyMatrices(baseMat, locMat);
    instSill.setMatrixAt(i, resMat);

    // Recessed warm lit pane
    locMat.makeTranslation(0, 0, -0.008);
    resMat.multiplyMatrices(baseMat, locMat);
    instPane.setMatrixAt(i, resMat);
  }
  for (let i = 0; i < arr.length; i++) arr[i].instanceMatrix.needsUpdate = true;

  // Vertical wood accent louvers on left side (-x) & rear
  const louverGeo = roundedBoxGeo(THREE, 0.04, 1.24, 0.06, 0.008, 1, 0.5);
  const louverInst = new THREE.InstancedMesh(louverGeo, mats.wood, 12);
  louverInst.castShadow = true;
  louverInst.receiveShadow = true;
  for (let i = 0; i < 6; i++) {
    dummy.position.set(-3.38, 1.12, -1.60 + i * 0.12);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    louverInst.setMatrixAt(i, dummy.matrix);
  }
  for (let i = 0; i < 6; i++) {
    dummy.position.set(-0.85 + i * 0.14, 1.12, -2.92);
    dummy.rotation.set(0, Math.PI / 2, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    louverInst.setMatrixAt(6 + i, dummy.matrix);
  }
  louverInst.instanceMatrix.needsUpdate = true;
  g.add(louverInst);

  // Back club entrance door + small canopy
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.72, 1.02, 0.10, 0.015, 1), mats.bronze, 0.45, 0.66, -2.90);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.54, 0.82, 0.04, 0.008, 1), mats.windowLit, 0.45, 0.70, -2.93, 0, 0, 0, false, true);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 1.05, 0.08, 0.42, 0.02, 2), mats.canopyTrim, 0.45, 1.32, -3.08);
  addMeshRef(THREE, g, new THREE.SphereGeometry(0.055, 8, 6), mats.lampGlobe, 0.96, 1.16, -2.96, 0, 0, 0, false, false);

  // Subtle rainwater downspouts at back corners
  const pipeGeo = new THREE.CylinderGeometry(0.032, 0.032, 3.55, 8);
  addMeshRef(THREE, g, pipeGeo, mats.bronze, -3.39, 1.95, -2.85);
  addMeshRef(THREE, g, pipeGeo, mats.bronze, 3.39, 1.95, -2.85);
}

function buildGlassLobby(THREE, root, mats) {
  const g = new THREE.Group();
  root.add(g);

  // Interior floor & warm slatted back wall
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 2.58, 0.10, 1.54, 0.02, 1, 0.6), mats.stone, 0, 0.20, 0.37);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 2.50, 3.46, 0.08, 0.02, 1, 0.5), mats.wood, 0, 1.96, -0.34);

  // Interior mezzanine balcony + wood-framed glass rail
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 2.48, 0.12, 0.80, 0.02, 1, 0.5), mats.woodDark, 0, 1.98, 0.04);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 2.42, 0.34, 0.03, 0.006, 1), mats.railGlass, 0, 2.21, 0.42, 0, 0, 0, false, false);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 2.46, 0.04, 0.05, 0.01, 1), mats.wood, 0, 2.39, 0.42);

  // Interior staircase rising to mezzanine (left side)
  const stepGeo = roundedBoxGeo(THREE, 0.44, 0.06, 0.14, 0.01, 1);
  for (let i = 0; i < 8; i++) {
    addMeshRef(THREE, g, stepGeo, mats.wood, -0.92, 0.38 + i * 0.21, 0.72 - i * 0.11);
  }

  // Interior cozy lounge sofa & coffee table (right side)
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.86, 0.18, 0.34, 0.04, 2), mats.cushionTeal, 0.60, 0.35, 0.18);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.86, 0.26, 0.10, 0.04, 2), mats.cushionTeal, 0.60, 0.50, 0.05);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.10, 0.20, 0.34, 0.03, 2), mats.cushionTeal, 0.20, 0.42, 0.18);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.10, 0.20, 0.34, 0.03, 2), mats.cushionTeal, 1.00, 0.42, 0.18);
  addMeshRef(THREE, g, new THREE.CylinderGeometry(0.19, 0.19, 0.04, 12), mats.wood, 0.60, 0.40, 0.60);
  addMeshRef(THREE, g, new THREE.CylinderGeometry(0.03, 0.04, 0.16, 8), mats.bronze, 0.60, 0.32, 0.60);

  // Three warm hanging globe pendant lamps inside double-height lobby
  const cordGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.78, 6);
  const pendGeo = new THREE.SphereGeometry(0.11, 10, 8);
  const pendPos = [[-0.52, 3.04, 0.56], [0.02, 2.86, 0.62], [0.56, 3.08, 0.54]];
  for (let i = 0; i < pendPos.length; i++) {
    const p = pendPos[i];
    addMeshRef(THREE, g, cordGeo, mats.bronze, p[0], p[1] + 0.38, p[2], 0, 0, 0, false, false);
    addMeshRef(THREE, g, pendGeo, mats.lampGlobe, p[0], p[1], p[2], 0, 0, 0, false, false);
  }

  // Exterior double-height curtain wall mullions (+z and projecting sides)
  const vMullGeo = roundedBoxGeo(THREE, 0.075, 3.56, 0.095, 0.014, 1);
  const vXs = [-1.28, -0.50, 0.50, 1.28];
  for (let i = 0; i < vXs.length; i++) {
    addMeshRef(THREE, g, vMullGeo, mats.bronze, vXs[i], 1.97, 1.13);
  }
  const hMullGeo = roundedBoxGeo(THREE, 2.62, 0.075, 0.095, 0.014, 1);
  const hYs = [0.22, 1.24, 2.04, 2.88, 3.70];
  for (let i = 0; i < hYs.length; i++) {
    addMeshRef(THREE, g, hMullGeo, mats.bronze, 0, hYs[i], 1.13);
  }

  // Side projecting mullions
  const sideHGeo = roundedBoxGeo(THREE, 0.08, 0.075, 0.78, 0.014, 1);
  for (let i = 0; i < hYs.length; i++) {
    addMeshRef(THREE, g, sideHGeo, mats.bronze, -1.28, hYs[i], 0.78);
    addMeshRef(THREE, g, sideHGeo, mats.bronze, 1.28, hYs[i], 0.74);
  }

  // Front & side glass curtain panels (leaving center ground doorway clear)
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.72, 0.96, 0.025, 0.005, 1), mats.lobbyGlass, -0.89, 0.73, 1.12, 0, 0, 0, false, true);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.72, 0.96, 0.025, 0.005, 1), mats.lobbyGlass, 0.89, 0.73, 1.12, 0, 0, 0, false, true);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 2.48, 2.40, 0.025, 0.005, 1), mats.lobbyGlass, 0, 2.47, 1.12, 0, 0, 0, false, true);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.025, 3.44, 0.68, 0.005, 1), mats.lobbyGlass, -1.28, 1.96, 0.78, 0, 0, 0, false, true);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.025, 3.44, 0.76, 0.005, 1), mats.lobbyGlass, 1.28, 1.96, 0.74, 0, 0, 0, false, true);

  // Double glass entrance doors + brass pulls
  const doorFrameGeo = roundedBoxGeo(THREE, 0.45, 0.96, 0.05, 0.01, 1);
  const doorPaneGeo = roundedBoxGeo(THREE, 0.35, 0.84, 0.03, 0.006, 1);
  const handleGeo = new THREE.CylinderGeometry(0.013, 0.013, 0.24, 8);
  for (let s = -1; s <= 1; s += 2) {
    addMeshRef(THREE, g, doorFrameGeo, mats.bronze, s * 0.24, 0.72, 1.13);
    addMeshRef(THREE, g, doorPaneGeo, mats.windowLit, s * 0.24, 0.74, 1.14, 0, 0, 0, false, true);
    addMeshRef(THREE, g, handleGeo, mats.brass, s * 0.075, 0.70, 1.18);
  }

  // Welcome mat in front of doors
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.96, 0.02, 0.42, 0.008, 1), mats.matWelcome, 0, 0.162, 1.40, 0, 0, 0, false, true);

  // Cantilevered accent-coloured entrance canopy awning + tie rods + soffit lights
  const awningGeo = roundedBoxGeo(THREE, 1.72, 0.11, 0.66, 0.03, 2, 0.5);
  addMeshRef(THREE, g, awningGeo, mats.canopyMain, 0, 1.44, 1.44, 0.06, 0, 0);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 1.62, 0.03, 0.56, 0.01, 1, 0.6), mats.wood, 0, 1.38, 1.43, 0.06, 0, 0);

  const rodGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.72, 6);
  addMeshRef(THREE, g, rodGeo, mats.bronze, -0.68, 1.70, 1.36, -0.78, 0, 0);
  addMeshRef(THREE, g, rodGeo, mats.bronze, 0.68, 1.70, 1.36, -0.78, 0, 0);

  const soffitGeo = new THREE.SphereGeometry(0.036, 8, 6);
  for (let i = -1; i <= 1; i++) {
    addMeshRef(THREE, g, soffitGeo, mats.stringBulb, i * 0.48, 1.35, 1.48, 0, 0, 0, false, false);
  }
}

function buildRoofTerrace(THREE, root, mats) {
  const g = new THREE.Group();
  root.add(g);

  // Main flat roof slab + lobby terrace extension
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 6.82, 0.14, 3.52, 0.03, 2, 0.45), mats.stone, 0, 3.80, -1.24);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 2.74, 0.14, 0.80, 0.03, 2, 0.45), mats.stone, 0, 3.80, 0.84);

  // Roof membrane/tile surface (back-left) & warm timber terrace deck (front & right)
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 1.94, 0.04, 3.16, 0.01, 1, 0.5), mats.roofTile, -2.30, 3.88, -1.24, 0, 0, 0, false, true);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 4.54, 0.05, 3.14, 0.015, 1, 0.5), mats.wood, 0.98, 3.89, -1.22, 0, 0, 0, false, true);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 2.48, 0.05, 0.78, 0.015, 1, 0.5), mats.wood, 0, 3.89, 0.74, 0, 0, 0, false, true);

  // Low brick/stone parapet along back & left edges
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 6.76, 0.28, 0.16, 0.025, 2, 0.5), mats.stone, 0, 4.00, -2.92);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.16, 0.28, 3.38, 0.025, 2, 0.5), mats.stone, -3.32, 4.00, -1.22);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 2.02, 0.28, 0.16, 0.025, 2, 0.5), mats.stone, -2.30, 4.00, 0.44);

  // Sleek glass safety railing around open front & right roof terrace
  const railSegments = [
    { x: 0, z: 1.16, w: 2.54, ry: 0 },
    { x: -1.30, z: 0.80, w: 0.74, ry: Math.PI / 2 },
    { x: 1.30, z: 0.76, w: 0.82, ry: Math.PI / 2 },
    { x: 2.30, z: 0.36, w: 2.04, ry: 0 },
    { x: 3.32, z: -1.26, w: 3.28, ry: Math.PI / 2 }
  ];
  for (let i = 0; i < railSegments.length; i++) {
    const s = railSegments[i];
    addMeshRef(THREE, g, roundedBoxGeo(THREE, s.w, 0.34, 0.03, 0.006, 1), mats.railGlass, s.x, 4.08, s.z, 0, s.ry, 0, false, false);
    addMeshRef(THREE, g, roundedBoxGeo(THREE, s.w + 0.06, 0.045, 0.065, 0.012, 1), mats.woodDark, s.x, 4.27, s.z, 0, s.ry, 0);
  }
  const postGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.42, 8);
  const postPts = [
    [-1.30, 0.44], [-1.30, 1.16], [0, 1.16], [1.30, 1.16],
    [1.30, 0.36], [2.30, 0.36], [3.32, 0.36], [3.32, -1.26], [3.32, -2.86]
  ];
  for (let i = 0; i < postPts.length; i++) {
    addMeshRef(THREE, g, postGeo, mats.bronze, postPts[i][0], 4.08, postPts[i][1]);
  }

  // Rooftop stair/elevator penthouse at back-left
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 1.66, 1.02, 1.62, 0.035, 2, 0.5), mats.wood, -2.30, 4.40, -1.94);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 1.76, 0.10, 1.72, 0.025, 2, 0.5), mats.stone, -2.30, 4.94, -1.94);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 1.38, 0.22, 0.05, 0.008, 1), mats.windowLit, -2.30, 4.68, -1.12, 0, 0, 0, false, true);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.05, 0.22, 1.24, 0.008, 1), mats.windowLit, -3.14, 4.68, -1.94, 0, 0, 0, false, true);
  // Terrace glass access door on +x face of penthouse
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.08, 0.86, 0.62, 0.015, 1), mats.bronze, -1.46, 4.34, -1.78);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.04, 0.72, 0.48, 0.008, 1), mats.windowLit, -1.44, 4.35, -1.78, 0, 0, 0, false, true);

  // Coral-Red Rooftop Canopy (sculpted gently arched wing profile!)
  const colBackGeo = new THREE.CylinderGeometry(0.042, 0.056, 1.20, 10);
  const colFrontGeo = new THREE.CylinderGeometry(0.042, 0.056, 1.44, 10);
  const colXs = [-1.10, 0.96, 2.98];
  for (let i = 0; i < colXs.length; i++) {
    addMeshRef(THREE, g, colBackGeo, mats.bronze, colXs[i], 4.50, -2.22);
    addMeshRef(THREE, g, colFrontGeo, mats.bronze, colXs[i], 4.62, 0.22);
  }
  // Support crossbeams under canopy
  const beamXGeo = roundedBoxGeo(THREE, 4.24, 0.075, 0.09, 0.015, 1);
  addMeshRef(THREE, g, beamXGeo, mats.bronze, 0.94, 5.08, -2.22);
  addMeshRef(THREE, g, beamXGeo, mats.bronze, 0.94, 5.31, 0.22);

  // Curved cantilevered coral-red canopy wing (profile in shape XY -> world ZY)
  const wing = new THREE.Shape();
  wing.moveTo(-1.76, -0.14);
  wing.quadraticCurveTo(0.10, 0.14, 1.76, 0.10);
  wing.quadraticCurveTo(1.86, 0.17, 1.76, 0.24);
  wing.quadraticCurveTo(0.10, 0.30, -1.74, 0.01);
  wing.quadraticCurveTo(-1.86, -0.06, -1.76, -0.14);

  const canopyGeo = new THREE.ExtrudeGeometry(wing, {
    depth: 4.64,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.035,
    bevelSegments: 2,
    curveSegments: 8
  });
  canopyGeo.center();
  applyBoxUVs(canopyGeo, 0.35);
  addMeshRef(THREE, g, canopyGeo, mats.canopyMain, 0.94, 5.26, -0.84, 0, -Math.PI / 2, 0);

  // Crisp accent edge trim along front lip & warm wood soffit slats underneath
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 4.74, 0.055, 0.09, 0.02, 2), mats.canopyTrim, 0.94, 5.39, 0.94);

  const slatGeo = roundedBoxGeo(THREE, 4.38, 0.035, 0.08, 0.008, 1, 0.5);
  const slatInst = new THREE.InstancedMesh(slatGeo, mats.wood, 9);
  slatInst.castShadow = true;
  slatInst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const z = -2.28 + t * 2.86;
    const y = 5.07 + t * 0.24 + Math.sin(t * Math.PI) * 0.07;
    dummy.position.set(0.94, y, z);
    dummy.rotation.set(-0.08, 0, 0);
    dummy.updateMatrix();
    slatInst.setMatrixAt(i, dummy.matrix);
  }
  slatInst.instanceMatrix.needsUpdate = true;
  g.add(slatInst);

  // Festive string lights draped underneath the coral-red canopy
  const bulbGeo = new THREE.SphereGeometry(0.034, 7, 5);
  const roofBulbs = new THREE.InstancedMesh(bulbGeo, mats.stringBulb, 22);
  let bi = 0;
  const canopySpans = [
    [[-1.08, 5.06, -2.18], [2.96, 5.29, 0.18]],
    [[-1.08, 5.29, 0.18], [2.96, 5.06, -2.18]]
  ];
  for (let s = 0; s < canopySpans.length; s++) {
    const a = new THREE.Vector3(...canopySpans[s][0]);
    const b = new THREE.Vector3(...canopySpans[s][1]);
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      const p = new THREE.Vector3().lerpVectors(a, b, t);
      p.y -= Math.sin(t * Math.PI) * 0.22;
      pts.push(p);
      if (k >= 1 && k <= 11) {
        dummy.position.set(p.x, p.y - 0.03, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        roofBulbs.setMatrixAt(bi++, dummy.matrix);
      }
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    addMeshRef(THREE, g, new THREE.TubeGeometry(curve, 14, 0.009, 4, false), mats.bronze, 0, 0, 0, 0, 0, 0, false, false);
  }
  roofBulbs.instanceMatrix.needsUpdate = true;
  g.add(roofBulbs);

  // Roof terrace lounge furniture & planters
  const benchBase = roundedBoxGeo(THREE, 1.02, 0.18, 0.36, 0.03, 2, 0.6);
  const benchBack = roundedBoxGeo(THREE, 1.02, 0.24, 0.09, 0.03, 2, 0.6);
  const cushion = roundedBoxGeo(THREE, 0.94, 0.08, 0.32, 0.03, 2);

  // Bench 1 (facing +z)
  addMeshRef(THREE, g, benchBase, mats.woodDark, 0.30, 4.00, -1.78);
  addMeshRef(THREE, g, benchBack, mats.woodDark, 0.30, 4.18, -1.94);
  addMeshRef(THREE, g, cushion, mats.cushionMustard, 0.30, 4.12, -1.76);

  // Bench 2 (facing -x near right terrace)
  addMeshRef(THREE, g, benchBase, mats.woodDark, 2.52, 4.00, -1.05, 0, Math.PI / 2, 0);
  addMeshRef(THREE, g, benchBack, mats.woodDark, 2.68, 4.18, -1.05, 0, Math.PI / 2, 0);
  addMeshRef(THREE, g, cushion, mats.cushionTeal, 2.50, 4.12, -1.05, 0, Math.PI / 2, 0);

  // Two cozy round terrace cafe tables + stools
  const tabTop = new THREE.CylinderGeometry(0.24, 0.24, 0.04, 14);
  const tabLeg = new THREE.CylinderGeometry(0.03, 0.045, 0.34, 8);
  const tabPts = [[0.32, -1.16], [1.86, -1.05], [-0.15, 0.56]];
  for (let i = 0; i < tabPts.length; i++) {
    addMeshRef(THREE, g, tabTop, mats.creamCloth, tabPts[i][0], 4.26, tabPts[i][1]);
    addMeshRef(THREE, g, tabLeg, mats.bronze, tabPts[i][0], 4.08, tabPts[i][1]);
  }

  // Terrace terracotta planter boxes with rounded shrubs
  const boxGeo = roundedBoxGeo(THREE, 0.44, 0.28, 0.44, 0.03, 2);
  const bushGeo = new THREE.IcosahedronGeometry(0.18, 1);
  const pCoords = [[-0.95, 0.78], [0.95, 0.78], [2.92, -0.02], [2.92, -2.52]];
  for (let i = 0; i < pCoords.length; i++) {
    const px = pCoords[i][0], pz = pCoords[i][1];
    addMeshRef(THREE, g, boxGeo, mats.terracotta, px, 4.05, pz);
    addMeshRef(THREE, g, bushGeo, i % 2 === 0 ? mats.foliage1 : mats.foliage2, px - 0.06, 4.28, pz + 0.04);
    addMeshRef(THREE, g, bushGeo, i % 2 === 0 ? mats.foliage2 : mats.foliage1, px + 0.08, 4.25, pz - 0.05, 0, 0.8, 0);
  }
}

function buildNoticeWall(THREE, root, mats) {
  const g = new THREE.Group();
  g.position.set(-2.32, 1.12, 0.50);
  root.add(g);

  // Dark-wood outer frame & warm cork pinboard
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 1.66, 1.04, 0.09, 0.02, 2, 0.5), mats.woodDark, 0, 0, 0);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 1.54, 0.92, 0.05, 0.01, 1), mats.cork, 0, 0, 0.03);

  // Little timber shelter hood + 2 tiny warm gallery downlights
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 1.74, 0.06, 0.28, 0.018, 2, 0.5), mats.wood, 0, 0.56, 0.11, 0.16, 0, 0);
  const lampGeo = new THREE.SphereGeometry(0.035, 8, 6);
  addMeshRef(THREE, g, lampGeo, mats.stringBulb, -0.48, 0.51, 0.17, 0, 0, 0, false, false);
  addMeshRef(THREE, g, lampGeo, mats.stringBulb, 0.48, 0.51, 0.17, 0, 0, 0, false, false);

  // Instanced blank colourful flyers + pushpins (no text, no letters, no logos)
  const rng = makeRng(9012);
  const flyerColors = [
    '#ff7b72', '#ffd166', '#67d1b5', '#74b9ff', '#f7f1e3',
    '#d99bff', '#ffaa6c', '#a3e072', '#ff9ec4', '#ffeaa7'
  ];
  const flyerGeo = roundedBoxGeo(THREE, 0.14, 0.18, 0.012, 0.003, 1);
  const pinGeo = new THREE.SphereGeometry(0.014, 6, 5);
  const cols = 7;
  const rows = 4;
  const total = cols * rows;
  const flyers = new THREE.InstancedMesh(flyerGeo, mats.instanceFlat, total);
  const pins = new THREE.InstancedMesh(pinGeo, mats.instanceFlat, total);
  flyers.castShadow = false;
  flyers.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const fx = -0.63 + c * 0.21 + (rng() - 0.5) * 0.045;
      const fy = 0.31 - r * 0.205 + (rng() - 0.5) * 0.035;
      const fz = 0.062 + (idx % 4) * 0.003;
      const rotZ = (rng() - 0.5) * 0.24;
      const sx = 0.78 + rng() * 0.45;
      const sy = 0.78 + rng() * 0.38;

      dummy.position.set(fx, fy, fz);
      dummy.rotation.set(0, 0, rotZ);
      dummy.scale.set(sx, sy, 1);
      dummy.updateMatrix();
      flyers.setMatrixAt(idx, dummy.matrix);
      col.set(flyerColors[Math.floor(rng() * flyerColors.length)]);
      flyers.setColorAt(idx, col);

      dummy.position.set(fx - Math.sin(rotZ) * 0.065 * sy, fy + Math.cos(rotZ) * 0.065 * sy, fz + 0.01);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      pins.setMatrixAt(idx, dummy.matrix);
      col.set(flyerColors[(idx * 3 + 2) % flyerColors.length]);
      pins.setColorAt(idx, col);
      idx++;
    }
  }
  flyers.instanceMatrix.needsUpdate = true;
  if (flyers.instanceColor) flyers.instanceColor.needsUpdate = true;
  pins.instanceMatrix.needsUpdate = true;
  if (pins.instanceColor) pins.instanceColor.needsUpdate = true;
  g.add(flyers);
  g.add(pins);
}

function buildTentCanopyGeo(THREE) {
  const pts = [
    new THREE.Vector2(0.001, 0.27),
    new THREE.Vector2(0.06, 0.245),
    new THREE.Vector2(0.24, 0.165),
    new THREE.Vector2(0.47, 0.065),
    new THREE.Vector2(0.495, 0.045),
    new THREE.Vector2(0.495, 0.0),
    new THREE.Vector2(0.468, 0.0),
    new THREE.Vector2(0.455, 0.052),
    new THREE.Vector2(0.02, 0.225)
  ];
  const geo = new THREE.LatheGeometry(pts, 4);
  geo.rotateY(Math.PI / 4);
  geo.computeVertexNormals();
  return geo;
}

function buildClubTables(THREE, root, mats) {
  const g = new THREE.Group();
  root.add(g);

  const xs = [-3.24, -2.46, -1.68, -0.90];
  const tz = 2.48;

  const tentGeo = buildTentCanopyGeo(THREE);
  const finialGeo = new THREE.SphereGeometry(0.026, 8, 6);
  const legGeo = new THREE.CylinderGeometry(0.014, 0.016, 0.72, 6);
  const legsInst = new THREE.InstancedMesh(legGeo, mats.steel, xs.length * 4);
  legsInst.castShadow = true;
  legsInst.receiveShadow = true;

  const clothGeo = roundedBoxGeo(THREE, 0.56, 0.29, 0.30, 0.025, 2);
  const topGeo = roundedBoxGeo(THREE, 0.58, 0.035, 0.32, 0.012, 1, 0.6);
  const chairSeatGeo = roundedBoxGeo(THREE, 0.16, 0.028, 0.16, 0.008, 1);
  const chairBackGeo = roundedBoxGeo(THREE, 0.16, 0.18, 0.026, 0.008, 1);
  const chairLegGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.17, 5);

  const dummy = new THREE.Object3D();
  let li = 0;

  for (let i = 0; i < xs.length; i++) {
    const cx = xs[i];
    // Four pop-up canopy legs
    const off = 0.30;
    const corners = [[-off, -off], [off, -off], [-off, off], [off, off]];
    for (let c = 0; c < 4; c++) {
      dummy.position.set(cx + corners[c][0], 0.15 + 0.36, tz + corners[c][1]);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      legsInst.setMatrixAt(li++, dummy.matrix);
    }

    // Coloured pitched canopy roof + finial
    addMeshRef(THREE, g, tentGeo, mats.tentCanopies[i], cx, 0.85, tz);
    addMeshRef(THREE, g, finialGeo, mats.brass, cx, 1.13, tz);

    // Draped club table
    addMeshRef(THREE, g, clothGeo, mats.creamCloth, cx, 0.30, tz);
    addMeshRef(THREE, g, topGeo, mats.wood, cx, 0.46, tz);

    // Folding club chair behind table
    addMeshRef(THREE, g, chairSeatGeo, mats.tentCanopies[i], cx, 0.32, tz - 0.25);
    addMeshRef(THREE, g, chairBackGeo, mats.tentCanopies[i], cx, 0.42, tz - 0.32);
    addMeshRef(THREE, g, chairLegGeo, mats.bronze, cx - 0.06, 0.235, tz - 0.25);
    addMeshRef(THREE, g, chairLegGeo, mats.bronze, cx + 0.06, 0.235, tz - 0.25);

    // Distinct club props on each table
    if (i === 0) {
      // Art club: mini easel & colourful blank canvases
      addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.15, 0.18, 0.02, 0.005, 1), mats.creamCloth, cx - 0.10, 0.56, tz - 0.02, -0.22, 0.2, 0);
      addMeshRef(THREE, g, new THREE.CylinderGeometry(0.032, 0.026, 0.07, 8), mats.terracotta, cx + 0.14, 0.51, tz + 0.03);
      addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.14, 0.03, 0.11, 0.006, 1), mats.tentCanopies[3], cx + 0.02, 0.49, tz + 0.05);
    } else if (i === 1) {
      // Games club: mini game board & stacked boxes
      addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.22, 0.02, 0.18, 0.005, 1), mats.woodDark, cx - 0.08, 0.488, tz);
      addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.14, 0.05, 0.14, 0.01, 1), mats.tentCanopies[0], cx + 0.15, 0.50, tz - 0.02);
      addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.12, 0.04, 0.12, 0.01, 1), mats.tentCanopies[2], cx + 0.15, 0.54, tz - 0.02, 0, 0.3, 0);
    } else if (i === 2) {
      // Plant/Eco club: three tiny terracotta pots with leafy sprouts
      const potGeo = new THREE.CylinderGeometry(0.042, 0.030, 0.065, 8);
      const leafGeo = new THREE.IcosahedronGeometry(0.048, 1);
      for (let p = -1; p <= 1; p++) {
        addMeshRef(THREE, g, potGeo, mats.terracotta, cx + p * 0.15, 0.51, tz + (p % 2) * 0.03);
        addMeshRef(THREE, g, leafGeo, p === 0 ? mats.foliage2 : mats.foliage1, cx + p * 0.15, 0.57, tz + (p % 2) * 0.03);
      }
    } else {
      // Zine / Social club: colourful paper stacks & little tray
      addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.13, 0.04, 0.16, 0.006, 1), mats.tentCanopies[0], cx - 0.14, 0.50, tz + 0.01);
      addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.13, 0.035, 0.16, 0.006, 1), mats.tentCanopies[1], cx + 0.01, 0.495, tz - 0.02, 0, 0.12, 0);
      addMeshRef(THREE, g, new THREE.CylinderGeometry(0.075, 0.065, 0.035, 10), mats.brass, cx + 0.16, 0.495, tz + 0.02);
    }
  }
  legsInst.instanceMatrix.needsUpdate = true;
  g.add(legsInst);
}

function buildOutdoorStage(THREE, root, mats) {
  const g = new THREE.Group();
  g.position.set(2.28, 0.15, 2.22);
  root.add(g);

  // Raised wooden stage deck + dark skirting + side steps
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 1.88, 0.18, 1.12, 0.025, 2), mats.bronze, 0, 0.09, 0);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 1.94, 0.07, 1.18, 0.02, 2, 0.55), mats.wood, 0, 0.215, 0);

  addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.20, 0.09, 0.44, 0.015, 1, 0.6), mats.woodDark, -1.04, 0.045, 0.08);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.16, 0.16, 0.44, 0.015, 1, 0.6), mats.wood, -0.98, 0.08, 0.08);

  // Curved acoustic wood-slat backdrop arch
  const archFrame = new THREE.Shape();
  archFrame.absarc(0, 0.36, 0.72, 0, Math.PI, false);
  archFrame.lineTo(-0.72, 0);
  archFrame.lineTo(-0.62, 0);
  archFrame.absarc(0, 0.36, 0.62, Math.PI, 0, true);
  archFrame.lineTo(0.72, 0);
  archFrame.closePath();

  const archGeo = new THREE.ExtrudeGeometry(archFrame, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 14
  });
  archGeo.center();
  addMeshRef(THREE, g, archGeo, mats.canopyMain, 0, 0.78, -0.49);

  // Vertical acoustic cedar slats inside arch
  for (let i = -5; i <= 5; i++) {
    const sx = i * 0.11;
    const h = 0.36 + Math.sqrt(Math.max(0.01, 0.63 * 0.63 - sx * sx));
    addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.055, h, 0.04, 0.008, 1, 0.5), mats.wood, sx, 0.25 + h * 0.5, -0.49);
  }

  // Mic stand, performer stool, and floor monitor
  addMeshRef(THREE, g, new THREE.CylinderGeometry(0.09, 0.10, 0.025, 10), mats.bronze, -0.04, 0.26, 0.16);
  addMeshRef(THREE, g, new THREE.CylinderGeometry(0.012, 0.014, 0.54, 6), mats.steel, -0.04, 0.53, 0.16);
  addMeshRef(THREE, g, new THREE.SphereGeometry(0.028, 8, 6), mats.bronze, -0.04, 0.81, 0.18);

  addMeshRef(THREE, g, new THREE.CylinderGeometry(0.11, 0.11, 0.035, 10), mats.woodDark, 0.30, 0.49, -0.05);
  addMeshRef(THREE, g, new THREE.CylinderGeometry(0.02, 0.04, 0.24, 8), mats.bronze, 0.30, 0.36, -0.05);

  addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.24, 0.10, 0.15, 0.02, 1), mats.speakerBody, -0.26, 0.30, 0.42, 0.35, 0.2, 0);

  // Two chunky stylized PA speakers on tripod stands
  const spkBodyGeo = roundedBoxGeo(THREE, 0.26, 0.40, 0.22, 0.035, 2);
  const wooferGeo = new THREE.CylinderGeometry(0.088, 0.072, 0.028, 14);
  const tweeterGeo = new THREE.CylinderGeometry(0.048, 0.040, 0.025, 12);
  const dustCapGeo = new THREE.SphereGeometry(0.028, 8, 6);
  const poleGeo = new THREE.CylinderGeometry(0.016, 0.018, 0.34, 8);
  const legGeo = new THREE.CylinderGeometry(0.011, 0.013, 0.24, 6);

  const spkPositions = [
    { x: -0.76, z: 0.34, ry: 0.28 },
    { x: 0.76, z: 0.34, ry: -0.28 }
  ];
  for (let i = 0; i < spkPositions.length; i++) {
    const sp = new THREE.Group();
    sp.position.set(spkPositions[i].x, 0.25, spkPositions[i].z);
    sp.rotation.y = spkPositions[i].ry;
    g.add(sp);

    addMeshRef(THREE, sp, poleGeo, mats.bronze, 0, 0.17, 0);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      addMeshRef(THREE, sp, legGeo, mats.bronze, Math.cos(a) * 0.065, 0.08, Math.sin(a) * 0.065, Math.sin(a) * 0.48, 0, -Math.cos(a) * 0.48);
    }
    addMeshRef(THREE, sp, spkBodyGeo, mats.speakerBody, 0, 0.50, 0);
    addMeshRef(THREE, sp, wooferGeo, mats.speakerCone, 0, 0.43, 0.105, Math.PI / 2, 0, 0);
    addMeshRef(THREE, sp, dustCapGeo, mats.steel, 0, 0.43, 0.112);
    addMeshRef(THREE, sp, tweeterGeo, mats.speakerCone, 0, 0.60, 0.105, Math.PI / 2, 0, 0);
    addMeshRef(THREE, sp, new THREE.SphereGeometry(0.018, 8, 6), mats.steel, 0, 0.60, 0.112);
  }
}

function buildDoorProps(THREE, root, mats) {
  // 1. Stylized campus bicycle leaning by the left side of the lobby door
  const bike = new THREE.Group();
  bike.position.set(-0.84, 0.15, 1.24);
  bike.rotation.set(-0.17, 0.12, 0);
  root.add(bike);

  const tireGeo = new THREE.TorusGeometry(0.145, 0.024, 8, 18);
  const rimGeo = new THREE.TorusGeometry(0.125, 0.010, 6, 18);
  const hubGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.04, 8);
  const spokeGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.24, 4);

  for (let w = -1; w <= 1; w += 2) {
    const wx = w * 0.24;
    addMeshRef(THREE, bike, tireGeo, mats.rubber, wx, 0.165, 0);
    addMeshRef(THREE, bike, rimGeo, mats.steel, wx, 0.165, 0);
    addMeshRef(THREE, bike, hubGeo, mats.steel, wx, 0.165, 0, Math.PI / 2, 0, 0);
    for (let s = 0; s < 3; s++) {
      addMeshRef(THREE, bike, spokeGeo, mats.steel, wx, 0.165, 0, 0, 0, (s * Math.PI) / 3, false, false);
    }
  }

  const tube = (x1, y1, x2, y2, r, mat) => {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const geo = new THREE.CylinderGeometry(r, r, len, 7);
    const ang = Math.atan2(dy, dx) - Math.PI / 2;
    addMeshRef(THREE, bike, geo, mat, (x1 + x2) * 0.5, (y1 + y2) * 0.5, 0, 0, 0, ang);
  };

  // Classic step-through / diamond frame
  tube(-0.24, 0.165, -0.02, 0.18, 0.014, mats.bikeFrame);
  tube(-0.24, 0.165, -0.07, 0.34, 0.014, mats.bikeFrame);
  tube(-0.02, 0.18, -0.08, 0.39, 0.015, mats.bikeFrame);
  tube(-0.02, 0.18, 0.16, 0.35, 0.016, mats.bikeFrame);
  tube(-0.07, 0.34, 0.15, 0.38, 0.014, mats.bikeFrame);
  tube(0.24, 0.165, 0.14, 0.43, 0.015, mats.bikeFrame);

  // Saddle, handlebars & woven front basket
  addMeshRef(THREE, bike, roundedBoxGeo(THREE, 0.13, 0.036, 0.075, 0.014, 2), mats.leather, -0.09, 0.41, 0, 0, 0, 0.06);
  addMeshRef(THREE, bike, new THREE.CylinderGeometry(0.012, 0.012, 0.24, 7), mats.steel, 0.13, 0.44, 0, Math.PI / 2, 0, 0);
  addMeshRef(THREE, bike, new THREE.CylinderGeometry(0.016, 0.016, 0.055, 7), mats.leather, 0.13, 0.44, -0.105, Math.PI / 2, 0, 0);
  addMeshRef(THREE, bike, new THREE.CylinderGeometry(0.016, 0.016, 0.055, 7), mats.leather, 0.13, 0.44, 0.105, Math.PI / 2, 0, 0);
  addMeshRef(THREE, bike, roundedBoxGeo(THREE, 0.13, 0.11, 0.15, 0.02, 2), mats.basket, 0.22, 0.39, 0);

  // 2. Sculpted hardshell guitar case leaning by the right side of the door
  const gc = new THREE.Group();
  gc.position.set(0.76, 0.38, 1.24);
  gc.rotation.set(-0.22, -0.18, 0.06);
  root.add(gc);

  const gs = new THREE.Shape();
  gs.moveTo(0, -0.23);
  gs.bezierCurveTo(0.11, -0.23, 0.12, -0.11, 0.07, -0.02);
  gs.bezierCurveTo(0.05, 0.02, 0.095, 0.05, 0.088, 0.10);
  gs.bezierCurveTo(0.08, 0.145, 0.038, 0.15, 0.036, 0.175);
  gs.lineTo(0.038, 0.245);
  gs.quadraticCurveTo(0.038, 0.27, 0, 0.27);
  gs.quadraticCurveTo(-0.038, 0.27, -0.038, 0.245);
  gs.lineTo(-0.036, 0.175);
  gs.bezierCurveTo(-0.038, 0.15, -0.08, 0.145, -0.088, 0.10);
  gs.bezierCurveTo(-0.095, 0.05, -0.05, 0.02, -0.07, -0.02);
  gs.bezierCurveTo(-0.12, -0.11, -0.11, -0.23, 0, -0.23);

  const gcGeo = new THREE.ExtrudeGeometry(gs, {
    depth: 0.062,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 6
  });
  gcGeo.center();
  addMeshRef(THREE, gc, gcGeo, mats.leather, 0, 0, 0);

  // Brass carry handle & latches
  addMeshRef(THREE, gc, roundedBoxGeo(THREE, 0.022, 0.075, 0.024, 0.006, 1), mats.brass, 0.092, -0.02, 0);
  addMeshRef(THREE, gc, roundedBoxGeo(THREE, 0.018, 0.026, 0.026, 0.004, 1), mats.brass, 0.088, 0.08, 0);
  addMeshRef(THREE, gc, roundedBoxGeo(THREE, 0.018, 0.026, 0.026, 0.004, 1), mats.brass, 0.108, -0.14, 0);

  // Cute blank geometric travel stickers on front of guitar case
  addMeshRef(THREE, gc, new THREE.CylinderGeometry(0.022, 0.022, 0.006, 10), mats.tentCanopies[0], -0.032, -0.12, 0.048, Math.PI / 2, 0, 0, false, false);
  addMeshRef(THREE, gc, roundedBoxGeo(THREE, 0.044, 0.028, 0.006, 0.003, 1), mats.tentCanopies[1], 0.028, -0.07, 0.048, 0, 0, 0.25, false, false);
  addMeshRef(THREE, gc, roundedBoxGeo(THREE, 0.032, 0.032, 0.006, 0.004, 1), mats.canopyMain, -0.01, 0.06, 0.048, 0, 0, 0.78, false, false);
}

function buildPennantsAndPoles(THREE, root, mats) {
  const g = new THREE.Group();
  root.add(g);

  const poleCoords = [
    [-3.58, 0.72],
    [-3.58, 3.12],
    [-0.56, 3.12],
    [0.58, 3.12],
    [3.58, 3.12],
    [3.58, 0.72]
  ];

  // Tapered decorative campus lamp poles via LatheGeometry
  const polePts = [
    new THREE.Vector2(0.075, 0.0),
    new THREE.Vector2(0.072, 0.07),
    new THREE.Vector2(0.046, 0.14),
    new THREE.Vector2(0.034, 0.22),
    new THREE.Vector2(0.025, 1.62),
    new THREE.Vector2(0.050, 1.67),
    new THREE.Vector2(0.032, 1.71)
  ];
  const poleGeo = new THREE.LatheGeometry(polePts, 10);
  const globeGeo = new THREE.SphereGeometry(0.095, 10, 8);
  const capGeo = new THREE.ConeGeometry(0.065, 0.04, 10);

  const polesInst = new THREE.InstancedMesh(poleGeo, mats.bronze, poleCoords.length);
  const globesInst = new THREE.InstancedMesh(globeGeo, mats.lampGlobe, poleCoords.length);
  const capsInst = new THREE.InstancedMesh(capGeo, mats.bronze, poleCoords.length);
  polesInst.castShadow = true;
  polesInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < poleCoords.length; i++) {
    const px = poleCoords[i][0], pz = poleCoords[i][1];
    dummy.position.set(px, 0.15, pz);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    polesInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(px, 1.93, pz);
    dummy.updateMatrix();
    globesInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(px, 2.02, pz);
    dummy.updateMatrix();
    capsInst.setMatrixAt(i, dummy.matrix);
  }
  polesInst.instanceMatrix.needsUpdate = true;
  globesInst.instanceMatrix.needsUpdate = true;
  capsInst.instanceMatrix.needsUpdate = true;
  g.add(polesInst, globesInst, capsInst);

  // Pennant strings & warm string lights along catenary spans
  const spans = [
    [[-3.58, 1.78, 0.72], [-3.58, 1.78, 3.12], 0.20, 11],
    [[-3.58, 1.78, 3.12], [-0.56, 1.78, 3.12], 0.24, 14],
    [[-0.56, 1.78, 3.12], [0.58, 1.78, 3.12], 0.12, 6],
    [[0.58, 1.78, 3.12], [3.58, 1.78, 3.12], 0.24, 14],
    [[3.58, 1.78, 3.12], [3.58, 1.78, 0.72], 0.20, 11],
    [[-0.56, 1.78, 3.12], [-1.24, 2.04, 1.15], 0.20, 9],
    [[0.58, 1.78, 3.12], [1.24, 2.04, 1.15], 0.20, 9]
  ];

  // Beveled triangular pennant flag geometry (hanging downward from y=0)
  const flagShape = new THREE.Shape();
  flagShape.moveTo(-0.055, 0);
  flagShape.lineTo(0.055, 0);
  flagShape.lineTo(0, -0.155);
  flagShape.closePath();
  const flagGeo = new THREE.ExtrudeGeometry(flagShape, {
    depth: 0.008,
    bevelEnabled: false
  });
  flagGeo.translate(0, 0, -0.004);

  const bulbGeo = new THREE.SphereGeometry(0.030, 7, 5);
  const flagPalette = ['#ef6258', '#f2bd4e', '#4bb59a', '#5ea1db', '#f7f1e3', '#e084b5'];

  let totalFlags = 0;
  let totalBulbs = 0;
  for (let i = 0; i < spans.length; i++) {
    totalFlags += spans[i][3];
    totalBulbs += Math.floor(spans[i][3] * 0.55);
  }

  const flagsInst = new THREE.InstancedMesh(flagGeo, mats.instanceFlat, totalFlags);
  const bulbsInst = new THREE.InstancedMesh(bulbGeo, mats.stringBulb, totalBulbs);
  flagsInst.castShadow = true;

  let fi = 0;
  let bi = 0;
  const col = new THREE.Color();

  for (let s = 0; s < spans.length; s++) {
    const a = new THREE.Vector3(...spans[s][0]);
    const b = new THREE.Vector3(...spans[s][1]);
    const sag = spans[s][2];
    const nFlags = spans[s][3];
    const yaw = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2;

    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      const p = new THREE.Vector3().lerpVectors(a, b, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      pts.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    addMeshRef(THREE, g, new THREE.TubeGeometry(curve, 14, 0.009, 4, false), mats.bronze, 0, 0, 0, 0, 0, 0, false, false);

    for (let k = 0; k < nFlags; k++) {
      const t = (k + 0.5) / nFlags;
      const p = curve.getPoint(t);
      dummy.position.set(p.x, p.y - 0.006, p.z);
      dummy.rotation.set(0.08 * Math.sin(k * 1.7), yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      flagsInst.setMatrixAt(fi, dummy.matrix);
      col.set(flagPalette[(fi + s) % flagPalette.length]);
      flagsInst.setColorAt(fi, col);
      fi++;
    }

    const nBulbs = Math.floor(nFlags * 0.55);
    for (let k = 0; k < nBulbs; k++) {
      const t = (k + 0.5) / nBulbs;
      const p = curve.getPoint(t);
      dummy.position.set(p.x, p.y - 0.032, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bulbsInst.setMatrixAt(bi++, dummy.matrix);
    }
  }

  flagsInst.instanceMatrix.needsUpdate = true;
  if (flagsInst.instanceColor) flagsInst.instanceColor.needsUpdate = true;
  bulbsInst.instanceMatrix.needsUpdate = true;
  g.add(flagsInst, bulbsInst);
}

function buildGreeneryAndBench(THREE, root, mats) {
  const g = new THREE.Group();
  root.add(g);

  // Cozy wooden campus bench tucked behind the stage against right wing wall
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 1.18, 0.07, 0.34, 0.02, 2, 0.6), mats.wood, 2.30, 0.38, 0.64);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 1.18, 0.22, 0.065, 0.02, 2, 0.6), mats.wood, 2.30, 0.55, 0.49, -0.12, 0, 0);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.07, 0.24, 0.30, 0.015, 1), mats.bronze, 1.82, 0.27, 0.64);
  addMeshRef(THREE, g, roundedBoxGeo(THREE, 0.07, 0.24, 0.30, 0.015, 1), mats.bronze, 2.78, 0.27, 0.64);

  // Stylized recycling & trash bins near right side of plaza
  const binGeo = new THREE.CylinderGeometry(0.10, 0.088, 0.28, 12);
  const lidGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.04, 12);
  addMeshRef(THREE, g, binGeo, mats.bronze, 3.60, 0.29, 0.02);
  addMeshRef(THREE, g, lidGeo, mats.tentCanopies[2], 3.60, 0.44, 0.02);
  addMeshRef(THREE, g, binGeo, mats.bronze, 3.60, 0.29, -0.24);
  addMeshRef(THREE, g, lidGeo, mats.tentCanopies[1], 3.60, 0.44, -0.24);

  // Stylized miniature campus trees & shrub planters (Instanced foliage clusters)
  const treeSpots = [
    [-3.64, -2.72, 1.05],
    [3.64, -2.72, 0.98],
    [-3.64, 1.48, 0.72]
  ];
  const planterGeo = roundedBoxGeo(THREE, 0.54, 0.24, 0.54, 0.04, 2, 0.5);
  const soilGeo = roundedBoxGeo(THREE, 0.44, 0.05, 0.44, 0.02, 1);
  const trunkGeo = new THREE.CylinderGeometry(0.055, 0.085, 0.72, 8);
  const puffGeo = new THREE.IcosahedronGeometry(0.26, 2);

  const shrubSpots = [
    [-3.64, -0.78],
    [3.64, -1.08],
    [3.64, 1.46],
    [-1.12, -3.14],
    [1.12, -3.14]
  ];

  const puffCount = treeSpots.length * 5 + shrubSpots.length * 3;
  const puffInst = new THREE.InstancedMesh(puffGeo, mats.instanceFlat, puffCount);
  puffInst.castShadow = true;
  puffInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const leafCols = ['#5c9954', '#72ad62', '#82be6f', '#64a359'];
  let pi = 0;

  for (let i = 0; i < treeSpots.length; i++) {
    const [tx, tz, sc] = treeSpots[i];
    addMeshRef(THREE, g, planterGeo, mats.stone, tx, 0.27, tz);
    addMeshRef(THREE, g, soilGeo, mats.soil, tx, 0.38, tz);
    addMeshRef(THREE, g, trunkGeo, mats.trunk, tx, 0.38 + 0.36 * sc, tz, 0, 0, 0);

    const crownY = 0.38 + 0.74 * sc;
    const offsets = [
      [0, 0.16, 0, 1.0],
      [-0.17, 0.0, 0.12, 0.78],
      [0.18, 0.02, 0.08, 0.80],
      [0.02, 0.02, -0.17, 0.76],
      [-0.08, -0.06, -0.10, 0.68]
    ];
    for (let k = 0; k < offsets.length; k++) {
      const o = offsets[k];
      dummy.position.set(tx + o[0] * sc, crownY + o[1] * sc, tz + o[2] * sc);
      dummy.rotation.set(k * 0.5, k * 0.9, 0);
      const s = o[3] * sc;
      dummy.scale.set(s, s * 0.92, s);
      dummy.updateMatrix();
      puffInst.setMatrixAt(pi, dummy.matrix);
      col.set(leafCols[(pi + i) % leafCols.length]);
      puffInst.setColorAt(pi, col);
      pi++;
    }
  }

  const smallPotGeo = roundedBoxGeo(THREE, 0.42, 0.22, 0.42, 0.035, 2);
  for (let i = 0; i < shrubSpots.length; i++) {
    const [sx, sz] = shrubSpots[i];
    addMeshRef(THREE, g, smallPotGeo, mats.terracotta, sx, 0.26, sz);
    const offs = [[-0.07, 0.44, 0.05, 0.56], [0.08, 0.43, -0.04, 0.52], [0.0, 0.52, -0.01, 0.50]];
    for (let k = 0; k < offs.length; k++) {
      const o = offs[k];
      dummy.position.set(sx + o[0], o[1], sz + o[2]);
      dummy.rotation.set(0.3 * k, 1.1 * k, 0);
      dummy.scale.set(o[3], o[3] * 0.88, o[3]);
      dummy.updateMatrix();
      puffInst.setMatrixAt(pi, dummy.matrix);
      col.set(leafCols[(pi + 1) % leafCols.length]);
      puffInst.setColorAt(pi, col);
      pi++;
    }
  }
  puffInst.instanceMatrix.needsUpdate = true;
  if (puffInst.instanceColor) puffInst.instanceColor.needsUpdate = true;
  g.add(puffInst);
}

export function build(THREE, opts, kit) {
  const root = new THREE.Group();
  root.name = 'StudentActivitiesCenter';

  const accent = opts && opts.accent !== undefined ? opts.accent : '#e85d56';
  const tex = createTextures(THREE, kit);
  const { mats, highlight } = createMaterials(THREE, tex, accent);

  buildBase(THREE, root, mats);
  buildMainBuilding(THREE, root, mats);
  buildGlassLobby(THREE, root, mats);
  buildRoofTerrace(THREE, root, mats);
  buildNoticeWall(THREE, root, mats);
  buildClubTables(THREE, root, mats);
  buildOutdoorStage(THREE, root, mats);
  buildDoorProps(THREE, root, mats);
  buildPennantsAndPoles(THREE, root, mats);
  buildGreeneryAndBench(THREE, root, mats);

  root.userData.highlight = highlight;
  return root;
}
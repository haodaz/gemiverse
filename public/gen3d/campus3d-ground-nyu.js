export const PLOTS = {
  library: [-20, 0, -8],
  clubs: [20, 0, -8],
  commons: [-20, 0, 9],
  career: [20, 0, 9],
};

export const HOME = [0, 0, 14];

export const WALKWAYS = {
  library: [
    [0, 14],
    [0, 11.8],
    [0, 6.8],
    [0, 3.3],
    [-2.2, 2.5],
    [-2.9, 0.5],
    [-2.2, -1.5],
    [-10, -6.5],
    [-14.8, -6.5],
    [-15.2, -8],
  ],
  clubs: [
    [0, 14],
    [0, 11.8],
    [0, 6.8],
    [0, 3.3],
    [2.2, 2.5],
    [2.9, 0.5],
    [2.2, -1.5],
    [10, -6.5],
    [14.8, -6.5],
    [15.2, -8],
  ],
  commons: [
    [0, 14],
    [0, 11.8],
    [0, 6.8],
    [-10, 6.8],
    [-14.8, 6.8],
    [-15.2, 9],
  ],
  career: [
    [0, 14],
    [0, 11.8],
    [0, 6.8],
    [10, 6.8],
    [14.8, 6.8],
    [15.2, 9],
  ],
};

// ---------------------------------------------------------------------------
// Deterministic PRNG & Geometry Utilities
// ---------------------------------------------------------------------------

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function setShadow(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function scaleUVs(geo, sx, sy) {
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  }
  uv.needsUpdate = true;
  return geo;
}

function makeRoundedRectShape(THREE, w, d, r) {
  const hw = w * 0.5;
  const hd = d * 0.5;
  const cr = Math.min(r, hw * 0.85, hd * 0.85);
  const s = new THREE.Shape();
  s.moveTo(-hw + cr, -hd);
  s.lineTo(hw - cr, -hd);
  s.quadraticCurveTo(hw, -hd, hw, -hd + cr);
  s.lineTo(hw, hd - cr);
  s.quadraticCurveTo(hw, hd, hw - cr, hd);
  s.lineTo(-hw + cr, hd);
  s.quadraticCurveTo(-hw, hd, -hw, hd - cr);
  s.lineTo(-hw, -hd + cr);
  s.quadraticCurveTo(-hw, -hd, -hw + cr, -hd);
  return s;
}

function makeBevelBox(THREE, w, h, d, r = 0.08, bevel = 0.04, bevelSegs = 1, curveSegs = 2) {
  const b = Math.min(bevel, w * 0.25, h * 0.25, d * 0.25);
  const sw = Math.max(0.01, w - b * 2);
  const sd = Math.max(0.01, d - b * 2);
  const sh = Math.max(0.01, h - b * 2);
  const shape = makeRoundedRectShape(THREE, sw, sd, Math.max(0.005, r - b * 0.5));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: sh,
    bevelEnabled: b > 0.001,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: bevelSegs,
    curveSegments: curveSegs,
    steps: 1,
  });
  geo.translate(0, 0, -sh * 0.5);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function makeRoundedPolygon(THREE, worldPts, radius, height, bevel = 0.025) {
  const pts = worldPts.map(([x, z]) => [x, -z]);
  const n = pts.length;
  const shape = new THREE.Shape();
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const dx1 = p0[0] - p1[0];
    const dy1 = p0[1] - p1[1];
    const l1 = Math.hypot(dx1, dy1) || 1;
    const dx2 = p2[0] - p1[0];
    const dy2 = p2[1] - p1[1];
    const l2 = Math.hypot(dx2, dy2) || 1;
    const r = Math.min(radius, l1 * 0.35, l2 * 0.35);
    const sx = p1[0] + (dx1 / l1) * r;
    const sy = p1[1] + (dy1 / l1) * r;
    const ex = p1[0] + (dx2 / l2) * r;
    const ey = p1[1] + (dy2 / l2) * r;
    if (i === 0) shape.moveTo(sx, sy);
    else shape.lineTo(sx, sy);
    shape.quadraticCurveTo(p1[0], p1[1], ex, ey);
  }
  shape.closePath();
  const b = Math.min(bevel, height * 0.45);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.005, height - b),
    bevelEnabled: b > 0.001,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
    curveSegments: 4,
    steps: 1,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function makeInsetWindowFrameGeo(THREE) {
  const pos = [];
  const pushQuad = (a, b, c, d) => {
    pos.push(
      a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2],
      a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]
    );
  };
  const ox = 0.5, oy = 0.5;
  const ix = 0.38, iy = 0.40;
  const z0 = 0.0, z1 = 0.07;

  // Front frame border (+Z)
  pushQuad([-ox, iy, z1], [ox, iy, z1], [ox, oy, z1], [-ox, oy, z1]);
  pushQuad([-ox, -oy, z1], [ox, -oy, z1], [ox, -iy, z1], [-ox, -iy, z1]);
  pushQuad([-ox, -iy, z1], [-ix, -iy, z1], [-ix, iy, z1], [-ox, iy, z1]);
  pushQuad([ix, -iy, z1], [ox, -iy, z1], [ox, iy, z1], [ix, iy, z1]);

  // Outer sides
  pushQuad([-ox, oy, z1], [ox, oy, z1], [ox, oy, z0], [-ox, oy, z0]);
  pushQuad([-ox, -oy, z0], [ox, -oy, z0], [ox, -oy, z1], [-ox, -oy, z1]);
  pushQuad([ox, -oy, z1], [ox, -oy, z0], [ox, oy, z0], [ox, oy, z1]);
  pushQuad([-ox, -oy, z0], [-ox, -oy, z1], [-ox, oy, z1], [-ox, oy, z0]);

  // Inner inset reveal
  pushQuad([-ix, iy, z0], [ix, iy, z0], [ix, iy, z1], [-ix, iy, z1]);
  pushQuad([-ix, -iy, z1], [ix, -iy, z1], [ix, -iy, z0], [-ix, -iy, z0]);
  pushQuad([-ix, -iy, z1], [-ix, -iy, z0], [-ix, iy, z0], [-ix, iy, z1]);
  pushQuad([ix, -iy, z0], [ix, -iy, z1], [ix, iy, z1], [ix, iy, z0]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Procedural Canvas Textures
// ---------------------------------------------------------------------------

function prepTex(THREE, tex, rx = 1, ry = 1) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createTextures(THREE, kit, accentHex) {
  const rng = makeRng(4201);

  const asphalt = prepTex(THREE, kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3f434b';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) {
      const v = 52 + Math.floor(rng() * 28);
      ctx.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
      ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 2, 1 + rng() * 2);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < 16; i++) {
      ctx.fillRect(0, rng() * h, w, 2 + rng() * 4);
    }
  }), 10, 10);

  const sidewalk = prepTex(THREE, kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#cbc5ba';
    ctx.fillRect(0, 0, w, h);
    const step = 64;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const d = Math.floor((rng() - 0.5) * 12);
        ctx.fillStyle = `rgb(${202 + d},${196 + d},${185 + d})`;
        ctx.fillRect(x + 2, y + 2, step - 4, step - 4);
      }
    }
    ctx.strokeStyle = 'rgba(110,104,96,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= w; i += step) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
    }
    for (let i = 0; i < 600; i++) {
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(80,75,68,0.06)';
      ctx.fillRect(rng() * w, rng() * h, 2, 2);
    }
  }), 0.45, 0.45);

  const parkStone = prepTex(THREE, kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#d3c8b6';
    ctx.fillRect(0, 0, w, h);
    const rows = 8;
    const cols = 4;
    const rh = h / rows;
    const cw = w / cols;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (cw * 0.5);
      for (let c = -1; c <= cols; c++) {
        const shade = Math.floor((rng() - 0.5) * 16);
        ctx.fillStyle = `rgb(${212 + shade},${201 + shade},${183 + shade})`;
        ctx.fillRect(c * cw + off + 2, r * rh + 2, cw - 4, rh - 4);
      }
    }
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = 'rgba(105,94,80,0.08)';
      ctx.fillRect(rng() * w, rng() * h, 2, 2);
    }
  }), 0.5, 0.5);

  const plotPale = prepTex(THREE, kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e5ded0';
    ctx.fillRect(0, 0, w, h);
    const step = 64;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const d = Math.floor((rng() - 0.5) * 10);
        ctx.fillStyle = `rgb(${232 + d},${225 + d},${212 + d})`;
        ctx.fillRect(x + 2, y + 2, step - 4, step - 4);
      }
    }
    ctx.strokeStyle = 'rgba(148,139,126,0.32)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= w; i += step) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
    }
  }), 0.45, 0.45);

  const plotEdge = prepTex(THREE, kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#7e776e';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) {
      const v = 108 + Math.floor(rng() * 34);
      ctx.fillStyle = `rgb(${v},${v - 4},${v - 9})`;
      ctx.fillRect(rng() * w, rng() * h, 2 + rng() * 3, 2);
    }
    ctx.strokeStyle = 'rgba(55,50,45,0.35)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= w; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
  }), 0.6, 0.6);

  const grass = prepTex(THREE, kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6c9253';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const g = 132 + Math.floor(rng() * 32);
      ctx.fillStyle = `rgb(${Math.floor(g * 0.72)},${g},${Math.floor(g * 0.54)})`;
      ctx.fillRect(rng() * w, rng() * h, 2 + rng() * 3, 2 + rng() * 3);
    }
    // Subtle scattered fallen autumn leaves
    const leaves = ['#d97b2b', '#e2ac38', '#bf4a32'];
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = leaves[Math.floor(rng() * leaves.length)];
      ctx.beginPath();
      ctx.arc(rng() * w, rng() * h, 1.4 + rng() * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }), 0.32, 0.32);

  const marble = prepTex(THREE, kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f2ede4';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(178,170,158,0.22)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      let x = rng() * w;
      let y = 0;
      ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x += (rng() - 0.5) * 40;
        y += h / 6;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(165,157,145,0.25)';
    ctx.lineWidth = 1.5;
    for (let y = 0; y < h; y += 42) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  }), 0.5, 0.5);

  const brick = prepTex(THREE, kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#bfb4a7';
    ctx.fillRect(0, 0, w, h);
    const rows = 16;
    const cols = 8;
    const rh = h / rows;
    const cw = w / cols;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (cw * 0.5);
      for (let c = -1; c <= cols; c++) {
        const v = 195 + Math.floor((rng() - 0.5) * 32);
        ctx.fillStyle = `rgb(${v},${Math.floor(v * 0.94)},${Math.floor(v * 0.9)})`;
        ctx.fillRect(c * cw + off + 1.5, r * rh + 1.5, cw - 3, rh - 3);
      }
    }
  }), 0.55, 0.55);

  const sandstone = prepTex(THREE, kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#9c5c4e';
    ctx.fillRect(0, 0, w, h);
    const rows = 10;
    const cols = 5;
    const rh = h / rows;
    const cw = w / cols;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (cw * 0.5);
      for (let c = -1; c <= cols; c++) {
        const d = Math.floor((rng() - 0.5) * 18);
        ctx.fillStyle = `rgb(${168 + d},${102 + Math.floor(d * 0.7)},${86 + Math.floor(d * 0.6)})`;
        ctx.fillRect(c * cw + off + 2, r * rh + 2, cw - 4, rh - 4);
      }
    }
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = 'rgba(240,210,190,0.06)';
      ctx.fillRect(rng() * w, rng() * h, 4, 1.5);
    }
  }), 0.4, 0.4);

  const glassWall = prepTex(THREE, kit.canvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#9cb4c4');
    grad.addColorStop(0.5, '#7e97a9');
    grad.addColorStop(1, '#6f8799');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    // Floor spandrel bands & vertical mullions
    ctx.fillStyle = 'rgba(42,56,68,0.45)';
    for (let y = 0; y < h; y += 42) {
      ctx.fillRect(0, y, w, 9);
    }
    ctx.strokeStyle = 'rgba(225,235,242,0.5)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= w; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    // Soft sunlit reflections
    ctx.fillStyle = 'rgba(255,242,216,0.14)';
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 8; c++) {
        if (rng() > 0.65) ctx.fillRect(c * 32 + 3, r * 42 + 12, 26, 27);
      }
    }
  }), 0.35, 0.35);

  const roof = prepTex(THREE, kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#7c7874';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      const d = Math.floor((rng() - 0.5) * 14);
      ctx.fillStyle = `rgb(${120 + d},${116 + d},${112 + d})`;
      ctx.fillRect(0, y, w, 14);
    }
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = 'rgba(50,48,46,0.1)';
      ctx.fillRect(rng() * w, rng() * h, 2, 2);
    }
  }), 0.6, 0.6);

  const wood = prepTex(THREE, kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#8b5e3c';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      const d = Math.floor((rng() - 0.5) * 18);
      ctx.fillStyle = `rgb(${142 + d},${96 + Math.floor(d * 0.7)},${62 + Math.floor(d * 0.5)})`;
      ctx.fillRect(0, y, w, 15);
      ctx.fillStyle = 'rgba(60,36,20,0.35)';
      ctx.fillRect(0, y + 15, w, 1);
    }
  }), 0.8, 0.8);

  const water = prepTex(THREE, kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5, cy = h * 0.5;
    const grad = ctx.createRadialGradient(cx, cy, 8, cx, cy, w * 0.5);
    grad.addColorStop(0, '#c6f1f5');
    grad.addColorStop(0.35, '#72c5d3');
    grad.addColorStop(1, '#4c9eb2');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.38)';
    ctx.lineWidth = 3;
    for (let r = 24; r < 118; r += 22) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }), 1, 1);

  const banner = prepTex(THREE, kit.canvasTexture(64, 128, (ctx, w, h) => {
    ctx.fillStyle = accentHex;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(6, 10, w - 12, 8);
    ctx.fillRect(6, h - 22, w - 12, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.5, 13, 0, Math.PI * 2);
    ctx.fill();
  }), 1, 1);

  return {
    asphalt, sidewalk, parkStone, plotPale, plotEdge, grass,
    marble, brick, sandstone, glassWall, roof, wood, water, banner,
  };
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

function createMaterials(THREE, tex, accentColor) {
  return {
    plinth: new THREE.MeshStandardMaterial({ map: tex.wood, color: 0x6f533e, roughness: 0.78 }),
    asphalt: new THREE.MeshStandardMaterial({ map: tex.asphalt, roughness: 0.92 }),
    sidewalk: new THREE.MeshStandardMaterial({ map: tex.sidewalk, roughness: 0.85 }),
    parkStone: new THREE.MeshStandardMaterial({ map: tex.parkStone, roughness: 0.82 }),
    plotPale: new THREE.MeshStandardMaterial({ map: tex.plotPale, roughness: 0.78 }),
    plotEdge: new THREE.MeshStandardMaterial({ map: tex.plotEdge, roughness: 0.84 }),
    grass: new THREE.MeshStandardMaterial({ map: tex.grass, roughness: 0.94 }),
    curbStone: new THREE.MeshStandardMaterial({ color: 0xb4aca0, roughness: 0.86 }),
    marble: new THREE.MeshStandardMaterial({ map: tex.marble, roughness: 0.48 }),
    marbleTrim: new THREE.MeshStandardMaterial({ map: tex.marble, color: 0xe6dfd2, roughness: 0.55 }),
    water: new THREE.MeshStandardMaterial({
      map: tex.water,
      color: 0x8ad7e3,
      roughness: 0.14,
      metalness: 0.05,
      transparent: true,
      opacity: 0.76,
    }),
    spray: new THREE.MeshStandardMaterial({
      color: 0xe8f9fc,
      emissive: 0x7ab8c4,
      emissiveIntensity: 0.18,
      roughness: 0.25,
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide,
    }),
    laneYellow: new THREE.MeshStandardMaterial({ color: 0xd9b359, roughness: 0.78 }),
    crosswalk: new THREE.MeshStandardMaterial({ color: 0xe7e1d6, roughness: 0.8 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x353b40, roughness: 0.45, metalness: 0.45 }),
    woodBench: new THREE.MeshStandardMaterial({ map: tex.wood, color: 0xb97e4f, roughness: 0.72 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x6f503a, roughness: 0.92 }),
    canopy: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86 }),
    lampGlobe: new THREE.MeshStandardMaterial({
      color: 0xfff3d4,
      emissive: 0xffcf77,
      emissiveIntensity: 0.85,
      roughness: 0.3,
    }),
    banner: new THREE.MeshStandardMaterial({
      map: tex.banner,
      color: 0xffffff,
      roughness: 0.7,
      side: THREE.DoubleSide,
    }),
    accentSolid: new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.65 }),
    winFrame: new THREE.MeshStandardMaterial({ color: 0xded7ca, roughness: 0.72 }),
    winDark: new THREE.MeshStandardMaterial({ color: 0x3c4d5e, roughness: 0.22, metalness: 0.25 }),
    winLit: new THREE.MeshStandardMaterial({
      color: 0xffe5aa,
      emissive: 0xffba52,
      emissiveIntensity: 0.78,
      roughness: 0.25,
    }),
    roof: new THREE.MeshStandardMaterial({ map: tex.roof, roughness: 0.88 }),
    roofCopper: new THREE.MeshStandardMaterial({ color: 0x749488, roughness: 0.58, metalness: 0.22 }),
    stoneTrim: new THREE.MeshStandardMaterial({ color: 0xd7cfc2, roughness: 0.76 }),
    sandstone: new THREE.MeshStandardMaterial({ map: tex.sandstone, roughness: 0.78 }),
    glassWall: new THREE.MeshStandardMaterial({
      map: tex.glassWall,
      roughness: 0.24,
      metalness: 0.32,
    }),
    taxiYellow: new THREE.MeshStandardMaterial({ color: 0xeeb732, roughness: 0.34, metalness: 0.1 }),
    busWhite: new THREE.MeshStandardMaterial({ color: 0xebe8e0, roughness: 0.38 }),
    busBlue: new THREE.MeshStandardMaterial({ color: 0x3b6fa3, roughness: 0.4 }),
    carGlass: new THREE.MeshStandardMaterial({ color: 0x2e3b47, roughness: 0.16, metalness: 0.3 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x282b2f, roughness: 0.88 }),
    headlight: new THREE.MeshStandardMaterial({
      color: 0xfff6d8,
      emissive: 0xffe296,
      emissiveIntensity: 0.85,
      roughness: 0.2,
    }),
    taillight: new THREE.MeshStandardMaterial({
      color: 0xd94338,
      emissive: 0xc92c22,
      emissiveIntensity: 0.55,
      roughness: 0.3,
    }),
    shelterGlass: new THREE.MeshStandardMaterial({
      color: 0xcde2eb,
      roughness: 0.14,
      transparent: true,
      opacity: 0.42,
    }),
    brickPalette: [
      0xb88072, // desaturated terracotta
      0xa67c6a, // warm muted brownstone
      0xc29e7d, // dusty ochre sandstone
      0x99736b, // soft muted plum-brown
      0xb28a79, // rose-taupe brick
      0x8e6e5c, // classic cocoa brownstone
      0xbfb5a6, // pale warm limestone
    ].map((c) => new THREE.MeshStandardMaterial({ map: tex.brick, color: c, roughness: 0.84 })),
  };
}

// ---------------------------------------------------------------------------
// Ground, Streets, Crosswalks, Sidewalks & Four Empty Plots
// ---------------------------------------------------------------------------

function buildGroundAndStreets(THREE, mats) {
  const g = new THREE.Group();

  // Miniature wooden diorama plinth under the 64x40 campus
  const plinthGeo = makeBevelBox(THREE, 64.6, 1.15, 40.6, 0.55, 0.12, 2, 3);
  const plinth = setShadow(new THREE.Mesh(plinthGeo, mats.plinth), false, true);
  plinth.position.set(0, -0.72, 0);
  g.add(plinth);

  // Continuous asphalt base across entire 64x40 footprint (top at y = -0.07)
  const asphaltGeo = makeBevelBox(THREE, 64, 0.18, 40, 0.35, 0.03, 1, 2);
  scaleUVs(asphaltGeo, 0.12, 0.12);
  const asphalt = setShadow(new THREE.Mesh(asphaltGeo, mats.asphalt), false, true);
  asphalt.position.set(0, -0.16, 0);
  g.add(asphalt);

  // Raised sidewalk blocks (top at y = -0.008) carving out the street grid:
  // Streets:
  //   West Ave: x [-14, -10], z [-20, 20]
  //   East Ave: x [10, 14], z [-20, 20]
  //   North Park St: z [-11.5, -8], x [-14, 14]
  //   South Park St: z [8, 11.5], x [-14, 14]
  //   West Cross St: z [-2, 2], x [-32, -14]
  //   East Cross St: z [-2, 2], x [14, 32]
  const sidewalkBlocks = [
    // North-Center (behind North Park St)
    { x: 0, z: -15.75, w: 20, d: 8.5, r: 0.45 },
    // South-Center (includes HOME arrival plaza at [0, 0, 14])
    { x: 0, z: 15.75, w: 20, d: 8.5, r: 0.45 },
    // North-West campus block (contains library plot)
    { x: -23, z: -11, w: 18, d: 18, r: 0.45 },
    // South-West campus block (contains commons plot)
    { x: -23, z: 11, w: 18, d: 18, r: 0.45 },
    // North-East campus block (contains clubs plot)
    { x: 23, z: -11, w: 18, d: 18, r: 0.45 },
    // South-East campus block (contains career plot)
    { x: 23, z: 11, w: 18, d: 18, r: 0.45 },
  ];

  for (const b of sidewalkBlocks) {
    const geo = makeBevelBox(THREE, b.w, 0.08, b.d, b.r, 0.025, 1, 2);
    const mesh = setShadow(new THREE.Mesh(geo, mats.sidewalk), false, true);
    mesh.position.set(b.x, -0.048, b.z);
    g.add(mesh);
  }

  // HOME arrival plaza subtle pale paving medallion at (0, 0, 14)
  const homePadGeo = makeBevelBox(THREE, 5.4, 0.02, 3.6, 0.6, 0.008, 1, 3);
  const homePad = setShadow(new THREE.Mesh(homePadGeo, mats.parkStone), false, true);
  homePad.position.set(0, -0.006, 13.7);
  g.add(homePad);

  // Four Empty Paved Plots (9x8 pale stone with darker border + path apron to street)
  const plotEntries = [
    { pos: PLOTS.library, side: 1 },
    { pos: PLOTS.clubs, side: -1 },
    { pos: PLOTS.commons, side: 1 },
    { pos: PLOTS.career, side: -1 },
  ];

  const outerBorderGeo = makeBevelBox(THREE, 9.6, 0.03, 8.6, 0.25, 0.012, 1, 2);
  const innerPadGeo = makeBevelBox(THREE, 8.95, 0.036, 7.95, 0.16, 0.01, 1, 2);
  const apronGeo = makeBevelBox(THREE, 1.5, 0.03, 2.2, 0.12, 0.01, 1, 2);

  for (const p of plotEntries) {
    const [px, , pz] = p.pos;
    const border = setShadow(new THREE.Mesh(outerBorderGeo, mats.plotEdge), false, true);
    border.position.set(px, -0.014, pz);
    g.add(border);

    const pad = setShadow(new THREE.Mesh(innerPadGeo, mats.plotPale), false, true);
    pad.position.set(px, -0.012, pz);
    g.add(pad);

    // Connecting paved spur from plot inward face to the avenue crosswalk sidewalk
    const apron = setShadow(new THREE.Mesh(apronGeo, mats.parkStone), false, true);
    apron.position.set(px + p.side * 5.05, -0.014, pz);
    g.add(apron);
  }

  // Street lane dashes (InstancedMesh)
  const dashGeo = makeBevelBox(THREE, 0.14, 0.012, 1.15, 0.04, 0.004, 1, 1);
  const dashList = [];
  // West & East Avenues (x = -12, +12)
  for (const ax of [-12, 12]) {
    for (let z = -18.5; z <= 18.5; z += 2.6) {
      if (Math.abs(z - 9.75) < 2.2 || Math.abs(z + 9.75) < 2.2 || Math.abs(z) < 2.3) continue;
      if (Math.abs(z - 6.8) < 1.3 || Math.abs(z + 6.5) < 1.3) continue;
      dashList.push([ax, z, 0]);
    }
  }
  // North & South Park Streets (z = -9.75, +9.75)
  for (const sz of [-9.75, 9.75]) {
    for (let x = -8.5; x <= 8.5; x += 2.6) {
      if (Math.abs(x) < 1.8) continue;
      dashList.push([x, sz, Math.PI / 2]);
    }
  }
  // West & East Cross Streets (z = 0)
  for (let x = -30; x <= -16; x += 2.6) dashList.push([x, 0, Math.PI / 2]);
  for (let x = 16; x <= 30; x += 2.6) dashList.push([x, 0, Math.PI / 2]);

  const dashMesh = new THREE.InstancedMesh(dashGeo, mats.laneYellow, dashList.length);
  dashMesh.receiveShadow = true;
  const dummy = new THREE.Object3D();
  dashList.forEach(([x, z, ry], i) => {
    dummy.position.set(x, -0.065, z);
    dummy.rotation.set(0, ry, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    dashMesh.setMatrixAt(i, dummy.matrix);
  });
  dashMesh.instanceMatrix.needsUpdate = true;
  g.add(dashMesh);

  // Crosswalks (InstancedMesh)
  const stripeGeo = makeBevelBox(THREE, 0.34, 0.012, 1.8, 0.04, 0.004, 1, 1);
  const stripes = [];
  const addCrosswalk = (cx, cz, verticalStreet) => {
    const count = 5;
    const spacing = 0.62;
    for (let i = 0; i < count; i++) {
      const off = (i - (count - 1) * 0.5) * spacing;
      if (verticalStreet) {
        stripes.push([cx + off, cz, 0]);
      } else {
        stripes.push([cx, cz + off, Math.PI / 2]);
      }
    }
  };

  // Crosswalks connecting HOME & North arch to park
  addCrosswalk(0, 9.75, true);
  addCrosswalk(0, -9.75, true);
  // Crosswalks from park portals across West/East Avenues toward the 4 plots
  addCrosswalk(-12, -6.5, false);
  addCrosswalk(12, -6.5, false);
  addCrosswalk(-12, 6.8, false);
  addCrosswalk(12, 6.8, false);
  // Crosswalks at Cross Street intersections
  addCrosswalk(-12, 0.5, false);
  addCrosswalk(12, 0.5, false);
  addCrosswalk(-15.1, 0, true);
  addCrosswalk(15.1, 0, true);
  // Avenue intersection crosswalks near park corners
  addCrosswalk(-12, 12.6, true);
  addCrosswalk(12, 12.6, true);
  addCrosswalk(-12, -12.6, true);
  addCrosswalk(12, -12.6, true);

  const cwMesh = new THREE.InstancedMesh(stripeGeo, mats.crosswalk, stripes.length);
  cwMesh.receiveShadow = true;
  stripes.forEach(([x, z, ry], i) => {
    dummy.position.set(x, -0.064, z);
    dummy.rotation.set(0, ry, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    cwMesh.setMatrixAt(i, dummy.matrix);
  });
  cwMesh.instanceMatrix.needsUpdate = true;
  g.add(cwMesh);

  return g;
}

// ---------------------------------------------------------------------------
// Central City Park Square: Stone Base, Lawns, Arch, Fountain, Benches
// ---------------------------------------------------------------------------

function buildArch(THREE, mats) {
  const arch = new THREE.Group();

  // Main arched body extruded along Z
  const s = new THREE.Shape();
  s.moveTo(-2.1, 0);
  s.lineTo(-2.1, 3.82);
  s.lineTo(2.1, 3.82);
  s.lineTo(2.1, 0);
  s.lineTo(0.92, 0);
  s.lineTo(0.92, 2.15);
  s.absarc(0, 2.15, 0.92, 0, Math.PI, false);
  s.lineTo(-0.92, 0);
  s.closePath();

  const bodyGeo = new THREE.ExtrudeGeometry(s, {
    depth: 1.12,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 2,
    curveSegments: 12,
  });
  bodyGeo.translate(0, 0, -0.56);
  scaleUVs(bodyGeo, 0.45, 0.45);
  arch.add(setShadow(new THREE.Mesh(bodyGeo, mats.marble)));

  // Pier plinth bases & impost mouldings
  const plinthGeo = makeBevelBox(THREE, 1.38, 0.46, 1.42, 0.06, 0.035);
  const impostGeo = makeBevelBox(THREE, 1.32, 0.14, 1.34, 0.04, 0.025);
  const nicheGeo = makeBevelBox(THREE, 0.62, 1.35, 0.12, 0.06, 0.025);
  const statuePedGeo = makeBevelBox(THREE, 0.42, 0.48, 0.24, 0.05, 0.02);
  const statueGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.14, 0.0),
      new THREE.Vector2(0.12, 0.42),
      new THREE.Vector2(0.15, 0.65),
      new THREE.Vector2(0.08, 0.78),
      new THREE.Vector2(0.09, 0.92),
      new THREE.Vector2(0.0, 0.98),
    ],
    10
  );

  for (const sx of [-1, 1]) {
    const px = sx * 1.51;
    const pBase = setShadow(new THREE.Mesh(plinthGeo, mats.marbleTrim));
    pBase.position.set(px, 0.23, 0);
    arch.add(pBase);

    const imp = setShadow(new THREE.Mesh(impostGeo, mats.marbleTrim));
    imp.position.set(px, 2.16, 0);
    arch.add(imp);

    for (const sz of [-1, 1]) {
      const panel = setShadow(new THREE.Mesh(nicheGeo, mats.marbleTrim));
      panel.position.set(px, 1.3, sz * 0.62);
      arch.add(panel);
    }

    // Subtle sculptural pier accents on the south face
    const sPed = setShadow(new THREE.Mesh(statuePedGeo, mats.marbleTrim));
    sPed.position.set(px, 0.62, 0.68);
    arch.add(sPed);

    const fig = setShadow(new THREE.Mesh(statueGeo, mats.marble));
    fig.position.set(px, 0.86, 0.72);
    arch.add(fig);
  }

  // Keystone accents on front and back of arch crown
  const keyGeo = makeBevelBox(THREE, 0.26, 0.36, 0.16, 0.04, 0.02);
  for (const sz of [-1, 1]) {
    const key = setShadow(new THREE.Mesh(keyGeo, mats.marbleTrim));
    key.position.set(0, 3.16, sz * 0.62);
    arch.add(key);
  }

  // Main projecting cornice
  const corniceGeo = makeBevelBox(THREE, 4.66, 0.24, 1.54, 0.08, 0.04);
  const cornice = setShadow(new THREE.Mesh(corniceGeo, mats.marbleTrim));
  cornice.position.set(0, 3.94, 0);
  arch.add(cornice);

  // Attic parapet & recessed frieze band
  const atticGeo = makeBevelBox(THREE, 4.24, 0.84, 1.24, 0.06, 0.035);
  const attic = setShadow(new THREE.Mesh(atticGeo, mats.marble));
  attic.position.set(0, 4.46, 0);
  arch.add(attic);

  const friezeGeo = makeBevelBox(THREE, 2.4, 0.42, 0.1, 0.04, 0.02);
  for (const sz of [-1, 1]) {
    const fr = setShadow(new THREE.Mesh(friezeGeo, mats.marbleTrim));
    fr.position.set(0, 4.46, sz * 0.62);
    arch.add(fr);
  }

  // Top parapet cap (total height ~5.04)
  const capGeo = makeBevelBox(THREE, 4.48, 0.18, 1.4, 0.06, 0.035);
  const cap = setShadow(new THREE.Mesh(capGeo, mats.marbleTrim));
  cap.position.set(0, 4.95, 0);
  arch.add(cap);

  return arch;
}

function buildFountain(THREE, mats) {
  const f = new THREE.Group();

  // Circular stone plaza ring around fountain
  const plazaOuter = setShadow(
    new THREE.Mesh(new THREE.CylinderGeometry(3.45, 3.5, 0.04, 32), mats.parkStone),
    false,
    true
  );
  plazaOuter.position.y = -0.008;
  f.add(plazaOuter);

  const plazaTrim = setShadow(
    new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.4, 0.045, 28), mats.plotEdge),
    false,
    true
  );
  plazaTrim.position.y = -0.004;
  f.add(plazaTrim);

  // Sculpted marble round basin (LatheGeometry)
  const basinPts = [
    new THREE.Vector2(0.0, 0.02),
    new THREE.Vector2(2.04, 0.02),
    new THREE.Vector2(2.08, 0.12),
    new THREE.Vector2(1.96, 0.18),
    new THREE.Vector2(1.98, 0.44),
    new THREE.Vector2(2.08, 0.48),
    new THREE.Vector2(2.08, 0.56),
    new THREE.Vector2(1.94, 0.60),
    new THREE.Vector2(1.76, 0.56),
    new THREE.Vector2(1.73, 0.48),
    new THREE.Vector2(1.70, 0.16),
    new THREE.Vector2(0.0, 0.16),
  ];
  const basinGeo = new THREE.LatheGeometry(basinPts, 28);
  f.add(setShadow(new THREE.Mesh(basinGeo, mats.marble)));

  // Translucent water surface
  const waterGeo = new THREE.CylinderGeometry(1.72, 1.72, 0.04, 24);
  const water = setShadow(new THREE.Mesh(waterGeo, mats.water), false, true);
  water.position.y = 0.45;
  f.add(water);

  // Center pedestal & upper bowl
  const pedPts = [
    new THREE.Vector2(0.0, 0.14),
    new THREE.Vector2(0.46, 0.14),
    new THREE.Vector2(0.42, 0.34),
    new THREE.Vector2(0.24, 0.56),
    new THREE.Vector2(0.22, 0.78),
    new THREE.Vector2(0.56, 0.88),
    new THREE.Vector2(0.58, 0.96),
    new THREE.Vector2(0.46, 0.98),
    new THREE.Vector2(0.18, 0.90),
    new THREE.Vector2(0.14, 1.06),
    new THREE.Vector2(0.0, 1.08),
  ];
  const pedGeo = new THREE.LatheGeometry(pedPts, 18);
  f.add(setShadow(new THREE.Mesh(pedGeo, mats.marbleTrim)));

  // Central frothy water jet column
  const jetPts = [
    new THREE.Vector2(0.05, 1.02),
    new THREE.Vector2(0.08, 1.55),
    new THREE.Vector2(0.14, 2.02),
    new THREE.Vector2(0.09, 2.22),
    new THREE.Vector2(0.0, 2.28),
  ];
  const jetGeo = new THREE.LatheGeometry(jetPts, 12);
  const jet = setShadow(new THREE.Mesh(jetGeo, mats.spray), false, false);
  f.add(jet);

  // Graceful arcing spray veil
  const veilPts = [
    new THREE.Vector2(0.06, 2.16),
    new THREE.Vector2(0.28, 1.92),
    new THREE.Vector2(0.54, 1.38),
    new THREE.Vector2(0.76, 0.47),
  ];
  const veilGeo = new THREE.LatheGeometry(veilPts, 16);
  const veil = setShadow(new THREE.Mesh(veilGeo, mats.spray), false, false);
  f.add(veil);

  return f;
}

function buildBenches(THREE, mats) {
  const g = new THREE.Group();
  const placements = [
    // Around central fountain plaza
    { x: -3.2, z: -1.65, ry: Math.PI * 0.25 },
    { x: 3.2, z: -1.65, ry: -Math.PI * 0.25 },
    { x: -3.2, z: 2.65, ry: Math.PI * 0.75 },
    { x: 3.2, z: 2.65, ry: -Math.PI * 0.75 },
    // Along south park promenade (north side of z=6.8 path, facing south)
    { x: -4.2, z: 5.95, ry: 0 },
    { x: 4.2, z: 5.95, ry: 0 },
    // Along north perimeter near arch
    { x: -5.2, z: -6.9, ry: Math.PI },
    { x: 5.2, z: -6.9, ry: Math.PI },
    // Along east & west park edges
    { x: -8.9, z: -2.4, ry: Math.PI / 2 },
    { x: -8.9, z: 3.2, ry: Math.PI / 2 },
    { x: 8.9, z: -2.4, ry: -Math.PI / 2 },
    { x: 8.9, z: 3.2, ry: -Math.PI / 2 },
    // Near HOME arrival plaza
    { x: -3.0, z: 14.8, ry: Math.PI },
    { x: 3.0, z: 14.8, ry: Math.PI },
  ];

  const seatGeo = makeBevelBox(THREE, 1.15, 0.06, 0.34, 0.03, 0.012);
  const backGeo = makeBevelBox(THREE, 1.15, 0.3, 0.055, 0.03, 0.012);
  const legGeo = makeBevelBox(THREE, 0.07, 0.34, 0.36, 0.025, 0.01);

  const count = placements.length;
  const seatIM = new THREE.InstancedMesh(seatGeo, mats.woodBench, count);
  const backIM = new THREE.InstancedMesh(backGeo, mats.woodBench, count);
  const legIM = new THREE.InstancedMesh(legGeo, mats.iron, count * 2);
  setShadow(seatIM); setShadow(backIM); setShadow(legIM);

  const root = new THREE.Object3D();
  const child = new THREE.Object3D();
  const mat4 = new THREE.Matrix4();

  placements.forEach((p, i) => {
    root.position.set(p.x, 0, p.z);
    root.rotation.set(0, p.ry, 0);
    root.updateMatrix();

    child.position.set(0, 0.25, 0);
    child.rotation.set(0, 0, 0);
    child.updateMatrix();
    mat4.multiplyMatrices(root.matrix, child.matrix);
    seatIM.setMatrixAt(i, mat4);

    child.position.set(0, 0.44, -0.15);
    child.rotation.set(-0.2, 0, 0);
    child.updateMatrix();
    mat4.multiplyMatrices(root.matrix, child.matrix);
    backIM.setMatrixAt(i, mat4);

    for (let s = 0; s < 2; s++) {
      child.position.set(s === 0 ? -0.44 : 0.44, 0.17, 0);
      child.rotation.set(0, 0, 0);
      child.updateMatrix();
      mat4.multiplyMatrices(root.matrix, child.matrix);
      legIM.setMatrixAt(i * 2 + s, mat4);
    }
  });

  seatIM.instanceMatrix.needsUpdate = true;
  backIM.instanceMatrix.needsUpdate = true;
  legIM.instanceMatrix.needsUpdate = true;
  g.add(seatIM, backIM, legIM);
  return g;
}

function buildPark(THREE, mats) {
  const park = new THREE.Group();

  // Main 20x16 park stone slab (top at y = 0.0 so all paths sit seamlessly at y = 0)
  const baseGeo = makeBevelBox(THREE, 20, 0.08, 16, 0.9, 0.03, 1, 3);
  const base = setShadow(new THREE.Mesh(baseGeo, mats.parkStone), false, true);
  base.position.set(0, -0.04, 0);
  park.add(base);

  // 8 symmetrical rounded grass lawn beds leaving radiating paths & perimeter walkways clear
  const eastLawns = [
    // NE-North lawn (clear of arch pier & NE diagonal path)
    [[1.45, -3.5], [2.6, -4.4], [2.6, -6.65], [7.4, -6.65], [7.4, -6.0], [3.5, -3.3]],
    // NE-East lawn
    [[4.0, -0.75], [8.65, -0.75], [8.65, -4.2], [4.5, -1.45]],
    // SE-East lawn
    [[4.0, 1.75], [8.65, 1.75], [8.65, 4.7], [4.4, 2.25]],
    // SE-South lawn (north of z=6.8 promenade)
    [[1.4, 4.15], [2.8, 3.65], [6.4, 5.7], [1.4, 5.7]],
  ];

  const allLawns = [
    ...eastLawns,
    ...eastLawns.map((poly) => poly.map(([x, z]) => [-x, z]).reverse()),
  ];

  for (const pts of allLawns) {
    // Low stone edging slightly larger/underneath
    const curbGeo = makeRoundedPolygon(THREE, pts, 0.45, 0.045, 0.015);
    const curb = setShadow(new THREE.Mesh(curbGeo, mats.curbStone), false, true);
    curb.position.y = -0.005;
    park.add(curb);

    // Lush bevelled grass mound slightly inset
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    const insetPts = pts.map(([x, z]) => [cx + (x - cx) * 0.93, cz + (z - cz) * 0.93]);
    const grassGeo = makeRoundedPolygon(THREE, insetPts, 0.4, 0.075, 0.03);
    const lawn = setShadow(new THREE.Mesh(grassGeo, mats.grass), false, true);
    lawn.position.y = 0.0;
    park.add(lawn);
  }

  // White marble Triumphal Arch on north side
  const arch = buildArch(THREE, mats);
  arch.position.set(0, 0, -5.6);
  park.add(arch);

  // Round fountain in the center
  const fountain = buildFountain(THREE, mats);
  fountain.position.set(0, 0, 0.5);
  park.add(fountain);

  // Park & plaza benches
  park.add(buildBenches(THREE, mats));

  return park;
}

// ---------------------------------------------------------------------------
// Scenery Buildings Along Outer Edges & Instanced Inset Windows
// ---------------------------------------------------------------------------

function buildSceneryBuildings(THREE, mats) {
  const g = new THREE.Group();
  const rng = makeRng(8817);
  const windows = [];

  const queueWindows = (bx, bz, bw, bh, bd, faces, opts = {}) => {
    const winW = opts.winW || 0.52;
    const winH = opts.winH || 0.72;
    const colStep = opts.colStep || 1.18;
    const rowStep = opts.rowStep || 1.15;
    const startY = opts.startY || 1.05;
    const topMargin = opts.topMargin || 0.72;
    const litChance = opts.litChance ?? 0.36;

    const rows = Math.max(1, Math.floor((bh - startY - topMargin) / rowStep) + 1);

    for (const face of faces) {
      const span = face === 'N' || face === 'S' ? bw : bd;
      const cols = Math.max(1, Math.floor((span - 0.85) / colStep));
      const totalSpan = (cols - 1) * colStep;
      for (let r = 0; r < rows; r++) {
        const wy = startY + r * rowStep;
        if (wy + winH * 0.5 > bh - 0.35) continue;
        for (let c = 0; c < cols; c++) {
          const offset = -totalSpan * 0.5 + c * colStep;
          let wx = bx, wz = bz, ry = 0;
          if (face === 'S') { wx = bx + offset; wz = bz + bd * 0.5 - 0.01; ry = 0; }
          else if (face === 'N') { wx = bx + offset; wz = bz - bd * 0.5 + 0.01; ry = Math.PI; }
          else if (face === 'E') { wx = bx + bw * 0.5 - 0.01; wz = bz + offset; ry = Math.PI / 2; }
          else if (face === 'W') { wx = bx - bw * 0.5 + 0.01; wz = bz + offset; ry = -Math.PI / 2; }
          windows.push({
            x: wx, y: wy, z: wz, ry,
            sx: winW, sy: winH,
            lit: rng() < litChance,
          });
        }
      }
    }
  };

  const addStoop = (x, z, rotY) => {
    const sg = new THREE.Group();
    sg.position.set(x, 0, z);
    sg.rotation.y = rotY;
    for (let s = 0; s < 3; s++) {
      const step = setShadow(
        new THREE.Mesh(makeBevelBox(THREE, 0.96, 0.14, 0.26, 0.025, 0.012), mats.stoneTrim)
      );
      step.position.set(0, 0.07 + s * 0.13, 0.42 - s * 0.22);
      sg.add(step);
    }
    // Stoop side cheeks / rails
    const cheekGeo = makeBevelBox(THREE, 0.1, 0.42, 0.78, 0.03, 0.015);
    for (const sx of [-0.5, 0.5]) {
      const cheek = setShadow(new THREE.Mesh(cheekGeo, mats.stoneTrim));
      cheek.position.set(sx, 0.21, 0.22);
      sg.add(cheek);
    }
    // Warm recessed doorway
    const door = setShadow(
      new THREE.Mesh(makeBevelBox(THREE, 0.58, 0.92, 0.08, 0.03, 0.015), mats.woodBench)
    );
    door.position.set(0, 0.86, -0.02);
    sg.add(door);
    g.add(sg);
  };

  const addWaterTower = (x, y, z) => {
    const wt = new THREE.Group();
    wt.position.set(x, y, z);
    const legGeo = new THREE.CylinderGeometry(0.035, 0.045, 0.65, 6);
    for (const [lx, lz] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) {
      const leg = setShadow(new THREE.Mesh(legGeo, mats.iron));
      leg.position.set(lx, 0.32, lz);
      wt.add(leg);
    }
    const tank = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.72, 10), mats.woodBench));
    tank.position.y = 0.98;
    wt.add(tank);
    const cone = setShadow(new THREE.Mesh(new THREE.ConeGeometry(0.41, 0.32, 10), mats.roof));
    cone.position.y = 1.48;
    wt.add(cone);
    g.add(wt);
  };

  const addRoofDetails = (x, y, z, w, d, kind) => {
    // Roof parapet cap / mechanical boxes / skylights
    if (kind === 'hall' || kind === 'sandstone') {
      const pent = setShadow(
        new THREE.Mesh(makeBevelBox(THREE, w * 0.42, 0.58, d * 0.42, 0.08, 0.035), mats.stoneTrim)
      );
      pent.position.set(x - w * 0.1, y + 0.28, z);
      g.add(pent);
      const hvac = setShadow(
        new THREE.Mesh(makeBevelBox(THREE, 0.75, 0.34, 0.6, 0.05, 0.025), mats.roof)
      );
      hvac.position.set(x + w * 0.22, y + 0.16, z + d * 0.12);
      g.add(hvac);
    } else if (kind === 'brownstone') {
      const sky = setShadow(
        new THREE.Mesh(makeBevelBox(THREE, 0.8, 0.22, 0.65, 0.05, 0.025), mats.winDark)
      );
      sky.position.set(x, y + 0.1, z);
      g.add(sky);
      const chim = setShadow(
        new THREE.Mesh(makeBevelBox(THREE, 0.34, 0.56, 0.34, 0.04, 0.02), mats.brickPalette[1])
      );
      chim.position.set(x + w * 0.28, y + 0.25, z - d * 0.2);
      g.add(chim);
    } else if (kind === 'glass') {
      const core = setShadow(
        new THREE.Mesh(makeBevelBox(THREE, w * 0.52, 0.72, d * 0.48, 0.1, 0.04), mats.iron)
      );
      core.position.set(x, y + 0.34, z);
      g.add(core);
    }
  };

  const addBuilding = (cfg) => {
    const { x, z, w, h, d, mat, faces, type = 'brownstone', stoopFace = null, waterTower = false } = cfg;
    const bodyGeo = makeBevelBox(THREE, w, h, d, 0.12, 0.05, 1, 2);
    scaleUVs(bodyGeo, 0.5, 0.5);
    const body = setShadow(new THREE.Mesh(bodyGeo, mat));
    body.position.set(x, h * 0.5, z);
    g.add(body);

    // Stone base plinth
    const baseGeo = makeBevelBox(THREE, w + 0.12, 0.48, d + 0.12, 0.1, 0.035);
    const base = setShadow(new THREE.Mesh(baseGeo, mats.stoneTrim));
    base.position.set(x, 0.24, z);
    g.add(base);

    // Roof cornice & recessed roof surface
    const corniceMat = type === 'glass' ? mats.iron : type === 'hall' ? mats.roofCopper : mats.stoneTrim;
    const cornice = setShadow(
      new THREE.Mesh(makeBevelBox(THREE, w + 0.2, 0.22, d + 0.2, 0.08, 0.035), corniceMat)
    );
    cornice.position.set(x, h + 0.04, z);
    g.add(cornice);

    const roofPad = setShadow(
      new THREE.Mesh(makeBevelBox(THREE, w - 0.18, 0.08, d - 0.18, 0.06, 0.02), mats.roof),
      false,
      true
    );
    roofPad.position.set(x, h + 0.12, z);
    g.add(roofPad);

    // Optional stone belt course on academic halls & sandstone block
    if (type === 'hall' || type === 'sandstone') {
      const belt = setShadow(
        new THREE.Mesh(makeBevelBox(THREE, w + 0.1, 0.14, d + 0.1, 0.08, 0.025), mats.stoneTrim)
      );
      belt.position.set(x, Math.min(2.0, h * 0.32), z);
      g.add(belt);
    }

    if (stoopFace === 'S') addStoop(x, z + d * 0.5, 0);
    else if (stoopFace === 'N') addStoop(x, z - d * 0.5, Math.PI);
    else if (stoopFace === 'E') addStoop(x + w * 0.5, z, Math.PI / 2);
    else if (stoopFace === 'W') addStoop(x - w * 0.5, z, -Math.PI / 2);

    addRoofDetails(x, h + 0.14, z, w, d, type);
    if (waterTower) addWaterTower(x + w * 0.18, h + 0.14, z - d * 0.16);

    if (type !== 'glass') {
      queueWindows(x, z, w, h, d, faces, {
        winW: type === 'sandstone' ? 0.48 : 0.52,
        winH: type === 'sandstone' ? 0.85 : 0.72,
        colStep: type === 'sandstone' ? 1.02 : 1.18,
        rowStep: type === 'sandstone' ? 1.26 : 1.16,
        startY: stoopFace ? 1.55 : 1.15,
      });
    } else {
      // Sleek vertical accent fins & a few glowing office window bays on glass building
      queueWindows(x, z, w, h, d, faces, {
        winW: 0.95,
        winH: 0.68,
        colStep: 1.55,
        rowStep: 1.32,
        startY: 1.4,
        litChance: 0.48,
      });
    }
  };

  const bp = mats.brickPalette;

  // 1. North-Center Row (Washington Square North brownstones with stoops facing South)
  const northRow = [
    { x: -7.9, w: 3.0, h: 4.5, m: 0 },
    { x: -4.75, w: 3.1, h: 4.9, m: 1 },
    { x: -1.55, w: 3.1, h: 4.6, m: 4 },
    { x: 1.6, w: 3.0, h: 5.0, m: 2 },
    { x: 4.75, w: 3.1, h: 4.4, m: 5 },
    { x: 7.9, w: 3.0, h: 4.7, m: 0 },
  ];
  for (const b of northRow) {
    addBuilding({
      x: b.x, z: -16.8, w: b.w, h: b.h, d: 4.4,
      mat: bp[b.m], faces: ['S', 'N'], type: 'brownstone', stoopFace: 'S',
    });
  }

  // 2. North-West Outer Edge: Brick Academic Hall + Limestone Corner Block
  addBuilding({
    x: -20.2, z: -16.8, w: 7.6, h: 6.8, d: 4.6,
    mat: bp[0], faces: ['S', 'E', 'W'], type: 'hall', waterTower: true,
  });
  addBuilding({
    x: -28.4, z: -16.8, w: 5.4, h: 5.6, d: 4.6,
    mat: bp[6], faces: ['S', 'E'], type: 'hall',
  });

  // 3. West Outer Edge (North of West Cross St): Brownstone row with stoops facing East
  addBuilding({
    x: -28.8, z: -11.4, w: 4.4, h: 4.5, d: 3.6,
    mat: bp[1], faces: ['E', 'S'], type: 'brownstone', stoopFace: 'E',
  });
  addBuilding({
    x: -28.8, z: -7.5, w: 4.4, h: 4.9, d: 3.6,
    mat: bp[3], faces: ['E'], type: 'brownstone', stoopFace: 'E',
  });
  addBuilding({
    x: -28.8, z: -4.1, w: 4.4, h: 4.2, d: 2.8,
    mat: bp[2], faces: ['E', 'S'], type: 'brownstone', stoopFace: 'E',
  });

  // 4. West Outer Edge (South of West Cross St): Brick Academic Hall + Brownstones
  addBuilding({
    x: -28.6, z: 7.0, w: 4.8, h: 6.1, d: 6.4,
    mat: bp[4], faces: ['E', 'N'], type: 'hall', waterTower: true,
  });
  addBuilding({
    x: -28.8, z: 12.6, w: 4.4, h: 4.2, d: 3.8,
    mat: bp[5], faces: ['E'], type: 'brownstone', stoopFace: 'E',
  });
  addBuilding({
    x: -28.8, z: 16.9, w: 4.4, h: 3.8, d: 3.8,
    mat: bp[1], faces: ['E', 'N'], type: 'brownstone', stoopFace: 'E',
  });

  // 5. North-East Outer Edge: Modern Glass Building + Brick Hall
  addBuilding({
    x: 20.0, z: -16.8, w: 7.4, h: 8.1, d: 4.6,
    mat: mats.glassWall, faces: ['S', 'W', 'E'], type: 'glass',
  });
  addBuilding({
    x: 28.4, z: -16.8, w: 5.4, h: 5.8, d: 4.6,
    mat: bp[2], faces: ['S', 'W'], type: 'hall',
  });

  // 6. East Outer Edge (North of East Cross St): Tall Red Sandstone Block (landmark ~8.6 high)
  addBuilding({
    x: 28.6, z: -7.6, w: 5.0, h: 8.6, d: 7.8,
    mat: mats.sandstone, faces: ['W', 'S', 'N'], type: 'sandstone',
  });

  // 7. East Outer Edge (South of East Cross St): Brick Academic Hall + Townhouse
  addBuilding({
    x: 28.6, z: 7.4, w: 4.8, h: 5.7, d: 6.8,
    mat: bp[0], faces: ['W', 'N'], type: 'hall',
  });
  addBuilding({
    x: 28.8, z: 14.8, w: 4.4, h: 4.1, d: 6.6,
    mat: bp[6], faces: ['W', 'N'], type: 'brownstone', stoopFace: 'W',
  });

  // 8. South Outer Edges (kept lower, 3.2-3.9 high, so south camera views remain open)
  addBuilding({
    x: -20.2, z: 17.3, w: 7.6, h: 3.7, d: 3.6,
    mat: bp[3], faces: ['N', 'E'], type: 'hall',
  });
  addBuilding({
    x: 20.2, z: 17.3, w: 7.6, h: 3.6, d: 3.6,
    mat: bp[1], faces: ['N', 'W'], type: 'hall',
  });
  // Low cozy brownstones flanking the open HOME arrival plaza (x: -3.5..3.5 stays open)
  addBuilding({
    x: -7.9, z: 17.6, w: 3.0, h: 3.5, d: 3.2,
    mat: bp[5], faces: ['N', 'E'], type: 'brownstone', stoopFace: 'N',
  });
  addBuilding({
    x: -4.75, z: 17.6, w: 3.0, h: 3.3, d: 3.2,
    mat: bp[2], faces: ['N', 'E'], type: 'brownstone', stoopFace: 'N',
  });
  addBuilding({
    x: 4.75, z: 17.6, w: 3.0, h: 3.4, d: 3.2,
    mat: bp[4], faces: ['N', 'W'], type: 'brownstone', stoopFace: 'N',
  });
  addBuilding({
    x: 7.9, z: 17.6, w: 3.0, h: 3.6, d: 3.2,
    mat: bp[0], faces: ['N', 'W'], type: 'brownstone', stoopFace: 'N',
  });

  // Low stone planter behind HOME arrival plaza
  const planter = setShadow(
    new THREE.Mesh(makeBevelBox(THREE, 4.4, 0.36, 0.72, 0.14, 0.04), mats.stoneTrim)
  );
  planter.position.set(0, 0.18, 16.5);
  g.add(planter);
  const planterSoil = setShadow(
    new THREE.Mesh(makeBevelBox(THREE, 4.0, 0.16, 0.44, 0.1, 0.03), mats.grass),
    false,
    true
  );
  planterSoil.position.set(0, 0.34, 16.5);
  g.add(planterSoil);

  // Build InstancedMeshes for all inset windows (frame + lit pane + dark pane)
  const frameGeo = makeInsetWindowFrameGeo(THREE);
  const paneGeo = new THREE.PlaneGeometry(0.78, 0.82);
  paneGeo.translate(0, 0, 0.022);

  const frameIM = new THREE.InstancedMesh(frameGeo, mats.winFrame, windows.length);
  frameIM.receiveShadow = true;

  const litList = windows.filter((w) => w.lit);
  const darkList = windows.filter((w) => !w.lit);
  const litIM = new THREE.InstancedMesh(paneGeo, mats.winLit, Math.max(1, litList.length));
  const darkIM = new THREE.InstancedMesh(paneGeo, mats.winDark, Math.max(1, darkList.length));

  const dummy = new THREE.Object3D();
  windows.forEach((w, i) => {
    dummy.position.set(w.x, w.y, w.z);
    dummy.rotation.set(0, w.ry, 0);
    dummy.scale.set(w.sx, w.sy, 1);
    dummy.updateMatrix();
    frameIM.setMatrixAt(i, dummy.matrix);
  });
  litList.forEach((w, i) => {
    dummy.position.set(w.x, w.y, w.z);
    dummy.rotation.set(0, w.ry, 0);
    dummy.scale.set(w.sx, w.sy, 1);
    dummy.updateMatrix();
    litIM.setMatrixAt(i, dummy.matrix);
  });
  darkList.forEach((w, i) => {
    dummy.position.set(w.x, w.y, w.z);
    dummy.rotation.set(0, w.ry, 0);
    dummy.scale.set(w.sx, w.sy, 1);
    dummy.updateMatrix();
    darkIM.setMatrixAt(i, dummy.matrix);
  });

  frameIM.instanceMatrix.needsUpdate = true;
  litIM.instanceMatrix.needsUpdate = true;
  darkIM.instanceMatrix.needsUpdate = true;

  g.add(frameIM);
  if (litList.length > 0) g.add(litIM);
  if (darkList.length > 0) g.add(darkIM);

  return g;
}

// ---------------------------------------------------------------------------
// Instanced Autumn Trees (Rounded Canopies on Trunks)
// ---------------------------------------------------------------------------

function buildTrees(THREE, mats) {
  const g = new THREE.Group();
  const rng = makeRng(31415);

  const treeCoords = [
    // Park lawns - NE & NW North beds
    [3.8, -5.6, 1.12], [5.8, -5.8, 0.96], [2.8, -4.7, 0.86],
    [-3.8, -5.6, 1.08], [-5.8, -5.8, 1.0], [-2.8, -4.7, 0.88],
    // Park lawns - NE & NW Side beds
    [5.6, -1.7, 1.05], [7.6, -2.5, 1.15], [7.1, -1.2, 0.85],
    [-5.6, -1.7, 1.02], [-7.6, -2.5, 1.12], [-7.1, -1.2, 0.9],
    // Park lawns - SE & SW Side beds
    [5.6, 2.7, 1.06], [7.7, 3.3, 1.12], [7.2, 2.2, 0.86],
    [-5.6, 2.7, 1.0], [-7.7, 3.3, 1.1], [-7.2, 2.2, 0.88],
    // Park lawns - SE & SW South beds
    [2.6, 4.9, 1.02], [4.5, 5.1, 0.92],
    [-2.6, 4.9, 1.05], [-4.5, 5.1, 0.94],
    // Street trees along North & South Park sidewalks
    [-8.2, -12.8, 0.88], [-3.2, -12.8, 0.85], [3.2, -12.8, 0.86], [8.2, -12.8, 0.9],
    [-8.5, 12.6, 0.86], [4.4, 12.6, 0.88], [8.5, 12.6, 0.86],
    // Accent street trees near campus blocks (well outside the 4 plots & crosswalks)
    [-15.2, -13.5, 0.85], [15.2, -13.5, 0.88],
    [-15.2, 3.4, 0.84], [15.2, 3.4, 0.86],
    [-15.2, 14.6, 0.85], [15.2, 14.6, 0.85],
    [-25.2, -2.9, 0.82], [25.2, -2.9, 0.84],
    [-25.2, 3.0, 0.84], [25.2, 3.0, 0.82],
    [-1.4, 16.5, 0.68], [1.4, 16.5, 0.68],
  ];

  const palette = [
    0xd96827, // burnt orange
    0xe5a42c, // golden amber
    0xbe3d2b, // crimson maple red
    0xe38436, // warm apricot orange
    0xc8542a, // russet sienna
    0xd6b038, // sunlit gold
    0xa93e2e, // deep autumn red
  ];

  const trunkGeo = new THREE.CylinderGeometry(0.075, 0.14, 1.0, 7);
  trunkGeo.translate(0, 0.5, 0);
  const puffGeo = new THREE.SphereGeometry(1, 8, 6);

  const trunkIM = new THREE.InstancedMesh(trunkGeo, mats.trunk, treeCoords.length);
  setShadow(trunkIM, true, true);

  const puffs = [];
  const dummy = new THREE.Object3D();

  treeCoords.forEach(([x, z, sc], idx) => {
    const trunkH = (1.0 + rng() * 0.35) * sc;
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, rng() * Math.PI * 2, 0);
    dummy.scale.set(sc, trunkH, sc);
    dummy.updateMatrix();
    trunkIM.setMatrixAt(idx, dummy.matrix);

    const baseColor = palette[idx % palette.length];
    const mainR = (0.72 + rng() * 0.18) * sc;
    puffs.push({
      x,
      y: trunkH + mainR * 0.52,
      z,
      sx: mainR * 1.08,
      sy: mainR * 0.86,
      sz: mainR * 1.04,
      color: baseColor,
    });

    // Secondary organic puff for cozy silhouette
    const ang = rng() * Math.PI * 2;
    const offR = mainR * 0.42;
    const subR = mainR * (0.64 + rng() * 0.14);
    puffs.push({
      x: x + Math.cos(ang) * offR,
      y: trunkH + mainR * 0.38 + (rng() - 0.3) * 0.25,
      z: z + Math.sin(ang) * offR,
      sx: subR * 1.05,
      sy: subR * 0.88,
      sz: subR * 1.02,
      color: palette[(idx + 2) % palette.length],
    });
  });

  trunkIM.instanceMatrix.needsUpdate = true;
  g.add(trunkIM);

  const canopyIM = new THREE.InstancedMesh(puffGeo, mats.canopy, puffs.length);
  setShadow(canopyIM, true, true);
  const col = new THREE.Color();

  puffs.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, rng() * Math.PI, 0);
    dummy.scale.set(p.sx, p.sy, p.sz);
    dummy.updateMatrix();
    canopyIM.setMatrixAt(i, dummy.matrix);
    col.setHex(p.color);
    canopyIM.setColorAt(i, col);
  });

  canopyIM.instanceMatrix.needsUpdate = true;
  if (canopyIM.instanceColor) canopyIM.instanceColor.needsUpdate = true;
  g.add(canopyIM);

  return g;
}

// ---------------------------------------------------------------------------
// Instanced Lamp Posts with Violet Banners
// ---------------------------------------------------------------------------

function buildLampPosts(THREE, mats) {
  const g = new THREE.Group();

  // [x, z, bannerFacingAngle]
  const posts = [
    // Park perimeter & arch flank
    [-2.4, -7.2, 0], [2.4, -7.2, Math.PI],
    [-9.2, -5.0, Math.PI / 2], [9.2, -5.0, -Math.PI / 2],
    [-9.2, 5.2, Math.PI / 2], [9.2, 5.2, -Math.PI / 2],
    [-2.1, 7.2, 0], [2.1, 7.2, Math.PI],
    // Fountain plaza accents
    [-3.7, 0.5, 0], [3.7, 0.5, Math.PI],
    // Flanking HOME arrival plaza
    [-2.6, 12.6, 0], [2.6, 12.6, Math.PI],
    // Along West & East Avenues near the 4 plots
    [-14.6, -10.8, 0], [-14.6, -3.5, 0],
    [-14.6, 4.4, 0], [-14.6, 11.4, 0],
    [14.6, -10.8, Math.PI], [14.6, -3.5, Math.PI],
    [14.6, 4.4, Math.PI], [14.6, 11.4, Math.PI],
    // Along Cross Streets
    [-22.0, -2.5, Math.PI / 2], [22.0, -2.5, Math.PI / 2],
  ];

  const polePts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.13, 0.0),
    new THREE.Vector2(0.12, 0.16),
    new THREE.Vector2(0.075, 0.34),
    new THREE.Vector2(0.05, 1.55),
    new THREE.Vector2(0.085, 1.62),
    new THREE.Vector2(0.055, 1.68),
    new THREE.Vector2(0.0, 1.68),
  ];
  const poleGeo = new THREE.LatheGeometry(polePts, 6);
  const globeGeo = new THREE.SphereGeometry(0.145, 8, 6);
  const armGeo = makeBevelBox(THREE, 0.34, 0.035, 0.035, 0.01, 0.006);
  const bannerGeo = makeBevelBox(THREE, 0.28, 0.54, 0.024, 0.025, 0.008);

  const n = posts.length;
  const poleIM = new THREE.InstancedMesh(poleGeo, mats.iron, n);
  const globeIM = new THREE.InstancedMesh(globeGeo, mats.lampGlobe, n);
  const armIM = new THREE.InstancedMesh(armGeo, mats.iron, n);
  const bannerIM = new THREE.InstancedMesh(bannerGeo, mats.banner, n);
  setShadow(poleIM, true, false);
  setShadow(bannerIM, true, false);

  const root = new THREE.Object3D();
  const child = new THREE.Object3D();
  const mat4 = new THREE.Matrix4();

  posts.forEach(([x, z, ry], i) => {
    root.position.set(x, 0, z);
    root.rotation.set(0, ry, 0);
    root.updateMatrix();
    poleIM.setMatrixAt(i, root.matrix);

    child.position.set(0, 1.81, 0);
    child.rotation.set(0, 0, 0);
    child.updateMatrix();
    mat4.multiplyMatrices(root.matrix, child.matrix);
    globeIM.setMatrixAt(i, mat4);

    child.position.set(0.17, 1.44, 0);
    child.updateMatrix();
    mat4.multiplyMatrices(root.matrix, child.matrix);
    armIM.setMatrixAt(i, mat4);

    child.position.set(0.19, 1.15, 0);
    child.updateMatrix();
    mat4.multiplyMatrices(root.matrix, child.matrix);
    bannerIM.setMatrixAt(i, mat4);
  });

  poleIM.instanceMatrix.needsUpdate = true;
  globeIM.instanceMatrix.needsUpdate = true;
  armIM.instanceMatrix.needsUpdate = true;
  bannerIM.instanceMatrix.needsUpdate = true;

  g.add(poleIM, globeIM, armIM, bannerIM);
  return g;
}

// ---------------------------------------------------------------------------
// Street Life: Bus, Bus Shelter, Yellow Taxis
// ---------------------------------------------------------------------------

function buildBus(THREE, mats) {
  const bus = new THREE.Group();

  // Extruded smooth rounded side profile along Z (bus drives along +X)
  const s = new THREE.Shape();
  s.moveTo(-1.52, 0.16);
  s.lineTo(1.52, 0.16);
  s.quadraticCurveTo(1.68, 0.16, 1.68, 0.34);
  s.lineTo(1.62, 0.94);
  s.quadraticCurveTo(1.56, 1.12, 1.36, 1.12);
  s.lineTo(-1.46, 1.12);
  s.quadraticCurveTo(-1.66, 1.12, -1.66, 0.92);
  s.lineTo(-1.66, 0.32);
  s.quadraticCurveTo(-1.66, 0.16, -1.52, 0.16);

  const bodyGeo = new THREE.ExtrudeGeometry(s, {
    depth: 0.92,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 2,
    curveSegments: 4,
  });
  bodyGeo.translate(0, 0, -0.46);
  bus.add(setShadow(new THREE.Mesh(bodyGeo, mats.busWhite)));

  // Transit blue lower stripe band
  const stripe = setShadow(
    new THREE.Mesh(makeBevelBox(THREE, 3.36, 0.24, 1.06, 0.06, 0.02), mats.busBlue)
  );
  stripe.position.set(0, 0.36, 0);
  bus.add(stripe);

  // Dark tinted wrap-around window strip
  const winBand = setShadow(
    new THREE.Mesh(makeBevelBox(THREE, 3.16, 0.38, 1.05, 0.06, 0.02), mats.carGlass),
    false,
    false
  );
  winBand.position.set(0.06, 0.78, 0);
  bus.add(winBand);

  // Rooftop AC pods
  const acGeo = makeBevelBox(THREE, 0.72, 0.14, 0.62, 0.06, 0.025);
  for (const ax of [-0.55, 0.45]) {
    const ac = setShadow(new THREE.Mesh(acGeo, mats.stoneTrim));
    ac.position.set(ax, 1.2, 0);
    bus.add(ac);
  }

  // Headlights & taillights
  const lampGeo = makeBevelBox(THREE, 0.06, 0.11, 0.16, 0.02, 0.01);
  for (const sz of [-0.32, 0.32]) {
    const hl = new THREE.Mesh(lampGeo, mats.headlight);
    hl.position.set(1.69, 0.36, sz);
    bus.add(hl);
    const tl = new THREE.Mesh(lampGeo, mats.taillight);
    tl.position.set(-1.67, 0.4, sz);
    bus.add(tl);
  }

  // 4 rounded wheels
  const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.14, 10);
  wheelGeo.rotateX(Math.PI / 2);
  for (const [wx, wz] of [[-1.02, 0.48], [-1.02, -0.48], [1.02, 0.48], [1.02, -0.48]]) {
    const w = setShadow(new THREE.Mesh(wheelGeo, mats.tire));
    w.position.set(wx, 0.2, wz);
    bus.add(w);
  }

  return bus;
}

function buildBusShelter(THREE, mats) {
  const sh = new THREE.Group();

  // Back glass panel & charcoal posts
  const postGeo = new THREE.CylinderGeometry(0.04, 0.045, 1.22, 8);
  for (const [px, pz] of [[-1.05, -0.36], [1.05, -0.36], [-1.05, 0.32], [1.05, 0.32]]) {
    const p = setShadow(new THREE.Mesh(postGeo, mats.iron));
    p.position.set(px, 0.61, pz);
    sh.add(p);
  }

  // Curved canopy roof
  const roof = setShadow(
    new THREE.Mesh(makeBevelBox(THREE, 2.52, 0.09, 1.06, 0.12, 0.03), mats.iron)
  );
  roof.position.set(0, 1.24, 0);
  sh.add(roof);

  // Translucent back & side glass
  const backGlass = new THREE.Mesh(makeBevelBox(THREE, 2.02, 0.96, 0.04, 0.02, 0.01), mats.shelterGlass);
  backGlass.position.set(0, 0.64, -0.36);
  sh.add(backGlass);

  // Side accent display box (cozy warm glow, no text)
  const boxFrame = setShadow(
    new THREE.Mesh(makeBevelBox(THREE, 0.12, 1.12, 0.68, 0.04, 0.02), mats.iron)
  );
  boxFrame.position.set(-1.05, 0.62, -0.02);
  sh.add(boxFrame);

  const glowPanel = new THREE.Mesh(makeBevelBox(THREE, 0.14, 0.82, 0.48, 0.02, 0.01), mats.accentSolid);
  glowPanel.position.set(-1.05, 0.65, -0.02);
  sh.add(glowPanel);

  // Wooden waiting bench inside shelter
  const bench = setShadow(
    new THREE.Mesh(makeBevelBox(THREE, 1.35, 0.07, 0.32, 0.03, 0.012), mats.woodBench)
  );
  bench.position.set(0.18, 0.3, -0.14);
  sh.add(bench);

  return sh;
}

function buildVehiclesAndShelter(THREE, mats) {
  const g = new THREE.Group();

  // Bus pulled up on South Park Street near the shelter (clear of crosswalk at x = 0)
  const bus = buildBus(THREE, mats);
  bus.position.set(-5.6, -0.07, 10.45);
  g.add(bus);

  // Bus shelter on the South Park Street sidewalk facing the bus
  const shelter = buildBusShelter(THREE, mats);
  shelter.position.set(-6.0, 0, 12.25);
  g.add(shelter);

  // Shared yellow taxi geometries (smooth rounded sedan silhouette driving along +X)
  const carShape = new THREE.Shape();
  carShape.moveTo(-0.74, 0.12);
  carShape.lineTo(0.76, 0.12);
  carShape.quadraticCurveTo(0.88, 0.12, 0.88, 0.26);
  carShape.lineTo(0.84, 0.38);
  carShape.lineTo(0.42, 0.44);
  carShape.lineTo(0.24, 0.68);
  carShape.lineTo(-0.32, 0.68);
  carShape.lineTo(-0.56, 0.44);
  carShape.lineTo(-0.82, 0.40);
  carShape.quadraticCurveTo(-0.88, 0.26, -0.74, 0.12);

  const taxiBodyGeo = new THREE.ExtrudeGeometry(carShape, {
    depth: 0.68,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.04,
    bevelSegments: 2,
    curveSegments: 3,
  });
  taxiBodyGeo.translate(0, 0, -0.34);

  const cabGlassGeo = makeBevelBox(THREE, 0.68, 0.22, 0.72, 0.06, 0.02);
  const roofSignGeo = makeBevelBox(THREE, 0.16, 0.1, 0.32, 0.03, 0.015);
  const wheelGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.11, 10);
  wheelGeo.rotateX(Math.PI / 2);
  const lightGeo = makeBevelBox(THREE, 0.05, 0.08, 0.14, 0.02, 0.01);

  const taxis = [
    { x: -12.9, z: -15.4, ry: -Math.PI / 2 }, // West Ave southbound
    { x: 12.9, z: 3.4, ry: Math.PI / 2 },     // East Ave northbound
    { x: 5.2, z: -9.05, ry: Math.PI },        // North Park St westbound
    { x: 20.6, z: 0.9, ry: 0 },               // East Cross St eastbound
    { x: -22.2, z: -0.9, ry: Math.PI },       // West Cross St westbound
  ];

  for (const t of taxis) {
    const cab = new THREE.Group();
    cab.position.set(t.x, -0.07, t.z);
    cab.rotation.y = t.ry;

    cab.add(setShadow(new THREE.Mesh(taxiBodyGeo, mats.taxiYellow)));

    const glass = new THREE.Mesh(cabGlassGeo, mats.carGlass);
    glass.position.set(-0.04, 0.54, 0);
    cab.add(glass);

    const sign = new THREE.Mesh(roofSignGeo, mats.headlight);
    sign.position.set(-0.04, 0.74, 0);
    cab.add(sign);

    for (const sz of [-0.22, 0.22]) {
      const hl = new THREE.Mesh(lightGeo, mats.headlight);
      hl.position.set(0.88, 0.28, sz);
      cab.add(hl);
      const tl = new THREE.Mesh(lightGeo, mats.taillight);
      tl.position.set(-0.84, 0.3, sz);
      cab.add(tl);
    }

    for (const [wx, wz] of [[-0.48, 0.36], [-0.48, -0.36], [0.5, 0.36], [0.5, -0.36]]) {
      const w = setShadow(new THREE.Mesh(wheelGeo, mats.tire));
      w.position.set(wx, 0.14, wz);
      cab.add(w);
    }

    g.add(cab);
  }

  return g;
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

export function buildCampus(THREE, opts = {}, kit) {
  const safeOpts = opts || {};
  const accentColor = new THREE.Color(
    safeOpts.accent !== undefined ? safeOpts.accent : 0x7c3aed
  );
  const accentHex = '#' + accentColor.getHexString();

  const textures = createTextures(THREE, kit, accentHex);
  const mats = createMaterials(THREE, textures, accentColor);

  const root = new THREE.Group();
  root.name = 'campus';

  root.add(buildGroundAndStreets(THREE, mats));
  root.add(buildPark(THREE, mats));
  root.add(buildSceneryBuildings(THREE, mats));
  root.add(buildTrees(THREE, mats));
  root.add(buildLampPosts(THREE, mats));
  root.add(buildVehiclesAndShelter(THREE, mats));

  return root;
}
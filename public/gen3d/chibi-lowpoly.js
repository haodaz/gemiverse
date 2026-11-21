export const OPTIONS = {
  skin: ['#fde2cc', '#f5cba7', '#e0ac69', '#c68642', '#8d5524', '#fff0e5'],
  bodyWidth: [0.8, 1.3],
  bodyHeight: [0.9, 1.1],
  hairStyle: [
    'bob',
    'long',
    'short',
    'pixie',
    'ponytail',
    'twinTails',
    'bun',
    'curly',
    'buzz',
    'sidePart',
  ],
  hairColor: [
    '#2c222b',
    '#5a3825',
    '#b87a3d',
    '#e6c36a',
    '#c94c4c',
    '#d87a9c',
    '#5b7db1',
    '#67a38c',
    '#8e6db8',
    '#e8e6eb',
  ],
  eye: [
    '#3b6ea5',
    '#4f8a5b',
    '#7b4f9d',
    '#b85c38',
    '#c94a6a',
    '#3d3540',
    '#d49a3a',
    '#3c999c',
  ],
  top: ['hoodie', 'blazer', 'cardigan', 'sweater', 'tee', 'shirt'],
  topColor: [
    '#e86f68',
    '#5c85b8',
    '#68a67d',
    '#e6b85c',
    '#9c78b8',
    '#f2efe9',
    '#3b4252',
    '#e08ca8',
  ],
  bottom: ['trousers', 'jeans', 'shorts', 'skirt', 'longSkirt'],
  bottomColor: [
    '#3b4a66',
    '#2e3440',
    '#8c6d53',
    '#526b5c',
    '#a8525c',
    '#d9cbb8',
    '#5c4b73',
  ],
  shoes: ['sneakers', 'boots', 'maryJanes', 'loafers'],
  shoeColor: ['#3b3f4a', '#8c4a3c', '#d9534f', '#f0ede6', '#4a6b8a', '#6b4c3b'],
  socks: ['none', 'ankle', 'knee'],
  sockColor: ['#f5f3ef', '#2f343f', '#d98a9c', '#5c7fa3', '#d9c48a'],
  glasses: ['none', 'round', 'square'],
  bag: ['none', 'backpack', 'tote'],
  accent: ['#f2c14e', '#e86f68', '#5fb3b3', '#d982b5', '#f5f3ef', '#3d405b'],
  blush: [true, false],
};

const DEFAULTS = {
  skin: '#fde2cc',
  bodyWidth: 1.0,
  bodyHeight: 1.0,
  hairStyle: 'bob',
  hairColor: '#5a3825',
  eye: '#3b6ea5',
  top: 'hoodie',
  topColor: '#e86f68',
  bottom: 'shorts',
  bottomColor: '#3b4a66',
  shoes: 'sneakers',
  shoeColor: '#3b3f4a',
  socks: 'ankle',
  sockColor: '#f5f3ef',
  glasses: 'none',
  bag: 'none',
  accent: '#f2c14e',
  blush: true,
};

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function parseHex(hex) {
  const s = String(hex || '#888888').replace('#', '');
  const full = s.length === 3 ? s.replace(/(.)/g, '$1$1') : s.padEnd(6, '0');
  const n = parseInt(full.slice(0, 6), 16) || 0x888888;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixRgb(hex, factor, add = 0) {
  const [r, g, b] = parseHex(hex);
  const f = (c) => clamp(Math.round(c * factor + add), 0, 255);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function makeMat(THREE, color, useVertexColors = true) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.85,
    metalness: 0.04,
    flatShading: true,
    vertexColors: useVertexColors,
  });
}

function shadeFacets(THREE, geom, opts = {}) {
  const g = geom.index ? geom.toNonIndexed() : geom;
  const pos = g.attributes.position;
  const count = pos.count;
  const cols = new Float32Array(count * 3);
  const dark = opts.dark || [0.78, 0.77, 0.82];
  const base = opts.base || [1.0, 1.0, 1.0];
  const light = opts.light || [1.18, 1.17, 1.13];
  const downCut = opts.downCut !== undefined ? opts.downCut : -0.22;
  const hiFn = opts.highlightFn || null;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i < count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    n.crossVectors(ab, ac).normalize();
    const cx = (a.x + b.x + c.x) / 3;
    const cy = (a.y + b.y + c.y) / 3;
    const cz = (a.z + b.z + c.z) / 3;

    let col = base;
    if (n.y < downCut) {
      col = dark;
    } else if (hiFn && hiFn(cx, cy, cz, n.x, n.y, n.z)) {
      col = light;
    }
    for (let k = 0; k < 3; k++) {
      const idx = (i + k) * 3;
      cols[idx] = col[0];
      cols[idx + 1] = col[1];
      cols[idx + 2] = col[2];
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}

function addMesh(THREE, parent, geom, mat, slot, pos, rot, scale) {
  const m = new THREE.Mesh(geom, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  if (slot) m.userData.slot = slot;
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  if (scale) m.scale.set(scale[0], scale[1], scale[2]);
  parent.add(m);
  return m;
}

function makePrism(THREE, rings, segs = 8, opts = {}) {
  const verts = [];
  const capBottom = opts.capBottom !== false;
  const capTop = opts.capTop !== false;
  const phase = opts.phase || 0;
  const ringPts = [];

  for (let r = 0; r < rings.length; r++) {
    const rg = rings[r];
    const pts = [];
    const ox = rg.ox || 0;
    const oz = rg.oz || 0;
    const pleat = rg.pleat || 0;
    for (let j = 0; j < segs; j++) {
      const th = (j / segs) * Math.PI * 2 + phase;
      const pf = pleat ? 1 + (j % 2 === 0 ? pleat : -pleat) : 1;
      const x = ox + Math.sin(th) * rg.rx * pf;
      const z = oz + Math.cos(th) * rg.rz * pf;
      pts.push([x, rg.y, z]);
    }
    ringPts.push(pts);
  }

  const pushTri = (p0, p1, p2) => {
    verts.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
  };

  for (let r = 0; r < ringPts.length - 1; r++) {
    const r0 = ringPts[r];
    const r1 = ringPts[r + 1];
    for (let j = 0; j < segs; j++) {
      const jn = (j + 1) % segs;
      pushTri(r0[j], r0[jn], r1[jn]);
      pushTri(r0[j], r1[jn], r1[j]);
    }
  }

  if (capBottom) {
    const b0 = ringPts[0];
    const rg = rings[0];
    const ctr = [rg.ox || 0, rg.y, rg.oz || 0];
    for (let j = 0; j < segs; j++) {
      const jn = (j + 1) % segs;
      pushTri(ctr, b0[jn], b0[j]);
    }
  }
  if (capTop) {
    const t0 = ringPts[ringPts.length - 1];
    const rg = rings[rings.length - 1];
    const ctr = [rg.ox || 0, rg.y, rg.oz || 0];
    for (let j = 0; j < segs; j++) {
      const jn = (j + 1) % segs;
      pushTri(ctr, t0[j], t0[jn]);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return shadeFacets(THREE, g, opts.shade);
}

function makeShell(THREE, rings, wall = 0.01, segs = 8, opts = {}) {
  const inner = [];
  for (let i = rings.length - 1; i >= 0; i--) {
    const rg = rings[i];
    inner.push({
      y: rg.y,
      rx: Math.max(0.004, rg.rx - wall),
      rz: Math.max(0.004, rg.rz - wall),
      ox: rg.ox || 0,
      oz: rg.oz || 0,
      pleat: (rg.pleat || 0) * 0.5,
    });
  }
  const all = rings.concat(inner, [rings[0]]);
  return makePrism(THREE, all, segs, {
    capBottom: false,
    capTop: false,
    phase: opts.phase || 0,
    shade: opts.shade,
  });
}

function makeBox(THREE, w, h, d, opts = {}) {
  const tx = opts.taperTopX !== undefined ? opts.taperTopX : 1;
  const tz = opts.taperTopZ !== undefined ? opts.taperTopZ : 1;
  const bx = opts.taperBotX !== undefined ? opts.taperBotX : 1;
  const bz = opts.taperBotZ !== undefined ? opts.taperBotZ : 1;
  const sx = opts.shiftTopX || 0;
  const sz = opts.shiftTopZ || 0;
  const g = new THREE.BoxGeometry(w, h, d, 1, 1, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);
    if (y > 0) {
      x = x * tx + sx;
      z = z * tz + sz;
    } else {
      x *= bx;
      z *= bz;
    }
    pos.setXYZ(i, x, y, z);
  }
  return shadeFacets(THREE, g, opts.shade);
}

function makeWedgeLock(THREE, len, w, d, bendZ = 0.02, bendX = 0, shade = {}) {
  const segs = [
    { t: 0.0, s: 0.85, bx: 0, bz: 0 },
    { t: 0.35, s: 1.0, bx: bendX * 0.3, bz: bendZ * 0.55 },
    { t: 0.72, s: 0.58, bx: bendX * 0.72, bz: bendZ * 0.9 },
    { t: 1.0, s: 0.04, bx: bendX, bz: bendZ },
  ];
  const rings = segs.map((k) => ({
    y: -k.t * len,
    rx: (w * 0.5) * k.s,
    rz: (d * 0.5) * k.s,
    ox: k.bx,
    oz: k.bz,
  }));
  return makePrism(THREE, rings, 4, { phase: Math.PI / 4, shade });
}

function makeLump(THREE, radius, kit, seed = 0, shade = {}) {
  const g = new THREE.IcosahedronGeometry(radius, 0);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n = kit && kit.noise ? kit.noise(x * 7 + seed, y * 7 - z * 5) : 0;
    const s = 1 + n * 0.14;
    pos.setXYZ(i, x * s, y * s * 0.95, z * s);
  }
  return shadeFacets(THREE, g, shade);
}

// Parametric sculpted chibi head surface (centred at y = 0.19 above head pivot)
function headPoint(theta, phi) {
  const ny = Math.cos(phi);
  const sr = Math.sin(phi);
  const st = Math.sin(theta);
  const ct = Math.cos(theta);

  const blockSr = Math.pow(Math.max(0, sr), 0.86);
  const cheek = 1 + 0.085 * Math.exp(-Math.pow((ny + 0.25) / 0.38, 2));
  const crown = 1 - 0.055 * Math.max(0, ny);
  const chinX = ny < -0.35 ? 1 - 0.18 * ((-ny - 0.35) / 0.65) : 1;
  const rx = 0.19 * cheek * crown * chinX;
  const rz = 0.178 * (1 + 0.03 * Math.exp(-Math.pow((ny + 0.2) / 0.4, 2))) * crown;

  let x = blockSr * st * rx;
  let y = 0.19 + ny * 0.19;
  let z = blockSr * ct * rz;

  if (ct > 0 && ny > -0.6 && ny < 0.5) {
    z -= 0.008 * ct * ct * (1 - Math.abs(ny + 0.05));
  }
  if (ny < -0.55 && ct > 0) {
    const chinFactor = (-ny - 0.55) / 0.45;
    z += 0.012 * chinFactor * ct;
  }
  return [x, y, z];
}

const HEAD_LON = 12;
const HEAD_PHIS = [0, 0.58, 1.14, 1.72, 2.34, Math.PI];

function buildHeadGeometry(THREE) {
  const grid = [];
  for (let r = 0; r < HEAD_PHIS.length; r++) {
    const row = [];
    for (let j = 0; j < HEAD_LON; j++) {
      const th = (j / HEAD_LON) * Math.PI * 2;
      row.push(headPoint(th, HEAD_PHIS[r]));
    }
    grid.push(row);
  }
  const verts = [];
  const pushTri = (p0, p1, p2) => {
    verts.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
  };
  const top = headPoint(0, 0);
  const bot = headPoint(0, Math.PI);

  for (let j = 0; j < HEAD_LON; j++) {
    const jn = (j + 1) % HEAD_LON;
    pushTri(top, grid[1][j], grid[1][jn]);
    for (let r = 1; r < HEAD_PHIS.length - 2; r++) {
      pushTri(grid[r][j], grid[r + 1][j], grid[r + 1][jn]);
      pushTri(grid[r][j], grid[r + 1][jn], grid[r][jn]);
    }
    const last = HEAD_PHIS.length - 2;
    pushTri(grid[last][j], bot, grid[last][jn]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return shadeFacets(THREE, g, { dark: [0.88, 0.84, 0.85], downCut: -0.35 });
}

function buildFacePatch(THREE) {
  const cols = [-2, -1, 0, 1, 2];
  const rows = [2, 3, 4];
  const offset = 0.0042;
  const span = 0.38;
  const pts = [];
  const uvs = [];
  const norms = [];

  for (let r = 0; r < rows.length; r++) {
    const pRow = [];
    const uRow = [];
    const nRow = [];
    const phi = HEAD_PHIS[rows[r]];
    for (let c = 0; c < cols.length; c++) {
      const th = (cols[c] / HEAD_LON) * Math.PI * 2;
      const p = headPoint(th, phi);
      const nx = p[0];
      const ny = (p[1] - 0.19) * 0.65;
      const nz = p[2];
      const len = Math.hypot(nx, ny, nz) || 1;
      const ux = nx / len;
      const uy = ny / len;
      const uz = nz / len;
      pRow.push([p[0] + ux * offset, p[1] + uy * offset, p[2] + uz * offset]);
      uRow.push([0.5 + (th * 0.188) / span, 0.5 + (p[1] - 0.16) / span]);
      nRow.push([ux, uy, uz]);
    }
    pts.push(pRow);
    uvs.push(uRow);
    norms.push(nRow);
  }

  const verts = [];
  const uvArr = [];
  const nArr = [];
  const push = (r, c) => {
    verts.push(...pts[r][c]);
    uvArr.push(...uvs[r][c]);
    nArr.push(...norms[r][c]);
  };

  for (let r = 0; r < rows.length - 1; r++) {
    for (let c = 0; c < cols.length - 1; c++) {
      push(r, c);
      push(r + 1, c);
      push(r + 1, c + 1);
      push(r, c);
      push(r + 1, c + 1);
      push(r, c + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nArr, 3));
  return g;
}

// 1024x1024 flat-painted anime face renderer
function drawFace(ctx, w, h, cfg) {
  ctx.clearRect(0, 0, w, h);
  const span = 0.38;
  const px = (xm) => (0.5 + xm / span) * w;
  const py = (ym) => (0.5 - (ym - 0.16) / span) * h;
  const sc = w / span;

  const expr = cfg.expression || 'awake';
  const blinkAmt = clamp(cfg.blink || 0, 0, 1);
  const eyeHex = cfg.eye || DEFAULTS.eye;
  const browColor = mixRgb(cfg.hairColor || DEFAULTS.hairColor, 0.55);
  const lidColor = '#2a1a17';

  // Soft square-ish blush patches under the eyes
  if (cfg.blush) {
    const blushAlpha = expr === 'happy' ? 0.34 : 0.24;
    for (const side of [-1, 1]) {
      const bx = px(side * 0.095);
      const by = py(0.098);
      const bw = 0.056 * sc;
      const bh = 0.028 * sc;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(side * -0.08);
      const grad = ctx.createRadialGradient(0, 0, bw * 0.12, 0, 0, bw * 0.65);
      grad.addColorStop(0, `rgba(242, 114, 128, ${blushAlpha})`);
      grad.addColorStop(0.7, `rgba(242, 114, 128, ${blushAlpha * 0.65})`);
      grad.addColorStop(1, 'rgba(242, 114, 128, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(-bw * 0.55, -bh * 0.55, bw * 1.1, bh * 1.1, bh * 0.35);
      ctx.fill();
      ctx.restore();
    }
  }

  // Eyes: centres +/-0.085, y = 0.15, width 0.085, height 0.095
  const eyeY = 0.15;
  const eyeW = 0.085 * sc;
  const eyeH = 0.095 * sc;

  for (const side of [-1, 1]) {
    const cx = px(side * 0.085);
    const cy = py(eyeY);

    if (expr === 'happy') {
      ctx.strokeStyle = lidColor;
      ctx.lineWidth = 0.013 * sc;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - eyeW * 0.44, cy + eyeH * 0.12);
      ctx.quadraticCurveTo(cx, cy - eyeH * 0.42, cx + eyeW * 0.44, cy + eyeH * 0.12);
      ctx.stroke();
      continue;
    }

    if (expr === 'asleep' || blinkAmt > 0.88) {
      ctx.strokeStyle = lidColor;
      ctx.lineWidth = 0.012 * sc;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - eyeW * 0.44, cy - eyeH * 0.05);
      ctx.quadraticCurveTo(cx, cy + eyeH * 0.34, cx + eyeW * 0.44, cy - eyeH * 0.05);
      ctx.stroke();
      ctx.lineWidth = 0.007 * sc;
      ctx.beginPath();
      ctx.moveTo(cx + side * eyeW * 0.36, cy + eyeH * 0.04);
      ctx.lineTo(cx + side * eyeW * 0.48, cy + eyeH * 0.12);
      ctx.stroke();
      continue;
    }

    const openScale = Math.max(0.12, 1 - blinkAmt * 0.92);
    const curH = eyeH * openScale;
    const topY = cy - eyeH * 0.46 + (1 - openScale) * eyeH * 0.62;
    const botY = topY + curH;

    // Clip to eye opening
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - eyeW * 0.5, topY + curH * 0.46);
    ctx.bezierCurveTo(
      cx - eyeW * 0.46,
      topY - curH * 0.06,
      cx + eyeW * 0.46,
      topY - curH * 0.06,
      cx + eyeW * 0.5,
      topY + curH * 0.46
    );
    ctx.bezierCurveTo(
      cx + eyeW * 0.45,
      botY + curH * 0.04,
      cx - eyeW * 0.45,
      botY + curH * 0.04,
      cx - eyeW * 0.5,
      topY + curH * 0.46
    );
    ctx.closePath();
    ctx.fillStyle = '#fbfbfc';
    ctx.fill();
    ctx.clip();

    // Subtle upper sclera shadow
    ctx.fillStyle = 'rgba(130, 128, 155, 0.22)';
    ctx.fillRect(cx - eyeW * 0.55, topY - 4, eyeW * 1.1, curH * 0.24);

    // Iris shift for expressions
    let shiftX = 0;
    let shiftY = 0;
    if (expr === 'thinking') {
      shiftX = 0.014 * sc;
      shiftY = -0.013 * sc;
    } else if (expr === 'unsure') {
      shiftX = -0.008 * sc;
      shiftY = 0.003 * sc;
    }

    const ix = cx + shiftX;
    const iy = topY + curH * 0.52 + shiftY;
    const irx = eyeW * 0.39;
    const iry = eyeH * 0.44 * (0.45 + 0.55 * openScale);

    // Iris vertical gradient (dark top -> lighter saturated bottom)
    const ig = ctx.createLinearGradient(ix, iy - iry, ix, iy + iry);
    ig.addColorStop(0.0, mixRgb(eyeHex, 0.32));
    ig.addColorStop(0.38, mixRgb(eyeHex, 0.72));
    ig.addColorStop(0.78, mixRgb(eyeHex, 1.18, 12));
    ig.addColorStop(1.0, mixRgb(eyeHex, 1.38, 28));
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.ellipse(ix, iy, irx, iry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Soft dark iris rim (subtle, no full eye outline)
    ctx.strokeStyle = mixRgb(eyeHex, 0.28);
    ctx.lineWidth = 0.0032 * sc;
    ctx.stroke();

    // Lighter crescent at bottom of iris
    ctx.fillStyle = mixRgb(eyeHex, 1.65, 55);
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    ctx.ellipse(ix, iy + iry * 0.42, irx * 0.62, iry * 0.32, 0, 0, Math.PI);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Darker pupil
    ctx.fillStyle = mixRgb(eyeHex, 0.2);
    ctx.beginPath();
    ctx.ellipse(ix, iy - iry * 0.03, irx * 0.44, iry * 0.44, 0, 0, Math.PI * 2);
    ctx.fill();

    // Two clean white highlights
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(
      ix - irx * 0.38,
      iy - iry * 0.36,
      irx * 0.28,
      iry * 0.24,
      -0.25,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ix + irx * 0.36, iy + iry * 0.32, irx * 0.14, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Thick dark-brown upper lid line thickening outward
    ctx.fillStyle = lidColor;
    ctx.beginPath();
    const lx0 = cx - side * eyeW * 0.48;
    const ly0 = topY + curH * 0.24;
    const lx1 = cx + side * eyeW * 0.54;
    const ly1 = topY + curH * 0.2;
    ctx.moveTo(lx0, ly0);
    ctx.quadraticCurveTo(cx, topY - curH * 0.18, lx1, ly1 - 0.004 * sc);
    ctx.lineTo(lx1 + side * 0.006 * sc, ly1 + 0.011 * sc);
    ctx.quadraticCurveTo(cx, topY + curH * 0.03, lx0, ly0 + 0.009 * sc);
    ctx.closePath();
    ctx.fill();
  }

  // Thin short brows above eyes
  ctx.strokeStyle = browColor;
  ctx.lineWidth = 0.0065 * sc;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const bx = px(side * 0.082);
    let by = py(0.22);
    let tilt = side * 0.004 * sc;
    let arch = -0.006 * sc;
    if (expr === 'thinking') {
      if (side === 1) {
        by -= 0.012 * sc;
        arch = -0.011 * sc;
      } else {
        by += 0.004 * sc;
        arch = -0.002 * sc;
      }
    } else if (expr === 'unsure') {
      tilt = -side * 0.011 * sc;
      arch = -0.003 * sc;
    } else if (expr === 'asleep') {
      by += 0.007 * sc;
      arch = -0.002 * sc;
    } else if (expr === 'happy') {
      by -= 0.006 * sc;
      arch = -0.009 * sc;
    }
    const half = 0.025 * sc;
    ctx.beginPath();
    ctx.moveTo(bx - half, by - tilt);
    ctx.quadraticCurveTo(bx, by + arch, bx + half, by + tilt);
    ctx.stroke();
  }

  // Tiny nose dot
  ctx.fillStyle = 'rgba(130, 78, 66, 0.55)';
  ctx.beginPath();
  ctx.arc(px(0), py(0.123), 0.0034 * sc, 0, Math.PI * 2);
  ctx.fill();

  // Small gentle mouth 0.055 below eye line (y = 0.095)
  const mx = px(0);
  const my = py(0.095);
  ctx.strokeStyle = '#6c3833';
  ctx.lineWidth = 0.0062 * sc;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (expr === 'happy') {
    const mw = 0.024 * sc;
    const mh = 0.022 * sc;
    ctx.fillStyle = '#d96b70';
    ctx.beginPath();
    ctx.moveTo(mx - mw, my - mh * 0.2);
    ctx.quadraticCurveTo(mx, my + mh * 1.4, mx + mw, my - mh * 0.2);
    ctx.quadraticCurveTo(mx, my - mh * 0.05, mx - mw, my - mh * 0.2);
    ctx.fill();
    ctx.stroke();
  } else if (expr === 'asleep') {
    ctx.beginPath();
    ctx.moveTo(mx - 0.011 * sc, my);
    ctx.quadraticCurveTo(mx, my + 0.005 * sc, mx + 0.011 * sc, my);
    ctx.stroke();
  } else if (expr === 'thinking') {
    ctx.beginPath();
    ctx.moveTo(mx - 0.015 * sc, my + 0.002 * sc);
    ctx.lineTo(mx + 0.017 * sc, my - 0.002 * sc);
    ctx.stroke();
  } else if (expr === 'unsure') {
    const mw = 0.022 * sc;
    const amp = 0.0055 * sc;
    ctx.beginPath();
    ctx.moveTo(mx - mw, my);
    ctx.bezierCurveTo(mx - mw * 0.45, my - amp * 2, mx - mw * 0.05, my + amp * 2, mx, my);
    ctx.bezierCurveTo(mx + mw * 0.05, my - amp * 2, mx + mw * 0.45, my + amp * 2, mx + mw, my);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(mx - 0.017 * sc, my - 0.002 * sc);
    ctx.quadraticCurveTo(mx, my + 0.011 * sc, mx + 0.017 * sc, my - 0.002 * sc);
    ctx.stroke();
  }
}

// Parametric thick hair helmet cap over the skull
function buildHairCap(THREE, opts = {}) {
  const segLon = 12;
  const segLat = 4;
  const expand = opts.expand || 0.028;
  const wall = opts.wall || 0.022;
  const frontPhi = opts.frontPhi || 1.04;
  const sidePhi = opts.sidePhi || 1.72;
  const backPhi = opts.backPhi || 2.34;
  const hairShade = opts.shade;

  const maxPhiAt = (th) => {
    const c = Math.cos(th);
    if (c > 0) {
      const t = Math.pow(c, 1.35);
      return sidePhi * (1 - t) + frontPhi * t;
    }
    const t = Math.pow(-c, 1.15);
    return sidePhi * (1 - t) + backPhi * t;
  };

  const sample = (th, phi, ex) => {
    const p = headPoint(th, phi);
    const nx = p[0];
    const ny = p[1] - 0.19;
    const nz = p[2];
    const l = Math.hypot(nx, ny, nz) || 1;
    const crownBoost = ny > 0.04 ? ex * 1.12 : ex;
    return [p[0] + (nx / l) * crownBoost, p[1] + (ny / l) * crownBoost, p[2] + (nz / l) * crownBoost];
  };

  const outer = [];
  const inner = [];
  for (let r = 0; r <= segLat; r++) {
    const oRow = [];
    const iRow = [];
    const f = r / segLat;
    for (let j = 0; j < segLon; j++) {
      const th = (j / segLon) * Math.PI * 2;
      const phi = maxPhiAt(th) * f;
      oRow.push(sample(th, phi, expand));
      iRow.push(sample(th, phi, Math.max(0.004, expand - wall)));
    }
    outer.push(oRow);
    inner.push(iRow);
  }

  const verts = [];
  const pushTri = (a, b, c) => {
    verts.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  };
  const topO = sample(0, 0, expand);
  const topI = sample(0, 0, Math.max(0.004, expand - wall));

  for (let j = 0; j < segLon; j++) {
    const jn = (j + 1) % segLon;
    pushTri(topO, outer[1][j], outer[1][jn]);
    pushTri(topI, inner[1][jn], inner[1][j]);
    for (let r = 1; r < segLat; r++) {
      pushTri(outer[r][j], outer[r + 1][j], outer[r + 1][jn]);
      pushTri(outer[r][j], outer[r + 1][jn], outer[r][jn]);
      pushTri(inner[r][j], inner[r + 1][jn], inner[r + 1][j]);
      pushTri(inner[r][j], inner[r][jn], inner[r + 1][jn]);
    }
    // Thick rim connecting outer and inner borders
    const o0 = outer[segLat][j];
    const o1 = outer[segLat][jn];
    const i0 = inner[segLat][j];
    const i1 = inner[segLat][jn];
    pushTri(o0, i0, i1);
    pushTri(o0, i1, o1);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return shadeFacets(THREE, g, hairShade);
}

function addSway(swayItems, obj, ampX, ampZ, phase, speed = 1.6) {
  swayItems.push({
    obj,
    rx: obj.rotation.x,
    rz: obj.rotation.z,
    ampX,
    ampZ,
    phase,
    speed,
  });
}

function buildHair(THREE, headGroup, opts, mats, kit, swayItems) {
  const style = opts.hairStyle;
  const hairMat = mats.hair;
  const accentMat = mats.accent;
  const hairShade = {
    dark: [0.74, 0.72, 0.8],
    base: [1.0, 1.0, 1.0],
    light: [1.22, 1.2, 1.16],
    downCut: -0.2,
    highlightFn: (_x, y, z, _nx, ny) => y > 0.255 && y < 0.335 && ny > 0.15 && z > -0.14,
  };
  const lockShade = {
    dark: [0.74, 0.72, 0.8],
    base: [1.0, 1.0, 1.0],
    light: [1.18, 1.16, 1.12],
    downCut: -0.22,
    highlightFn: (_x, y, _z, _nx, ny) => y > -0.055 && ny > 0.05,
  };

  const capCfg = { shade: hairShade };
  if (style === 'buzz') {
    capCfg.expand = 0.015;
    capCfg.wall = 0.011;
    capCfg.frontPhi = 1.02;
    capCfg.sidePhi = 1.56;
    capCfg.backPhi = 2.22;
  } else if (style === 'pixie') {
    capCfg.expand = 0.024;
    capCfg.sidePhi = 1.62;
    capCfg.backPhi = 2.26;
  } else if (style === 'bob') {
    capCfg.expand = 0.032;
    capCfg.sidePhi = 1.88;
    capCfg.backPhi = 2.42;
  } else if (style === 'curly') {
    capCfg.expand = 0.034;
    capCfg.sidePhi = 1.78;
  } else {
    capCfg.expand = 0.03;
  }

  addMesh(THREE, headGroup, buildHairCap(THREE, capCfg), hairMat, 'hair');

  // Helper to attach angular fringe locks that always stay above the eyes (y >= 0.215)
  const addFringe = (specs) => {
    for (const [x, y, z, len, w, d, rx, ry, rz, bz, bx] of specs) {
      const g = makeWedgeLock(THREE, len, w, d, bz || 0.018, bx || 0, lockShade);
      addMesh(THREE, headGroup, g, hairMat, 'hair', [x, y, z], [rx, ry, rz]);
    }
  };

  if (style === 'buzz') {
    // Crisp short hairline fringe ridge, no hanging locks
    const g = makeBox(THREE, 0.24, 0.035, 0.04, { taperBotX: 1.06, shade: lockShade });
    addMesh(THREE, headGroup, g, hairMat, 'hair', [0, 0.305, 0.16], [-0.25, 0, 0]);
    return;
  }

  if (style === 'sidePart') {
    // Part crest & asymmetrical sweeping bangs (well above eyes)
    const crest = makeBox(THREE, 0.06, 0.035, 0.26, { taperTopX: 0.5, shade: hairShade });
    addMesh(THREE, headGroup, crest, hairMat, 'hair', [-0.07, 0.39, 0.02], [0, 0, 0.15]);
    addFringe([
      [-0.08, 0.33, 0.155, 0.105, 0.095, 0.044, -0.22, -0.15, 0.52, 0.024, 0.03],
      [-0.01, 0.335, 0.165, 0.105, 0.095, 0.044, -0.22, 0.05, 0.42, 0.026, 0.025],
      [0.075, 0.325, 0.155, 0.11, 0.085, 0.042, -0.2, 0.25, 0.3, 0.022, 0.02],
      [-0.145, 0.3, 0.115, 0.105, 0.072, 0.038, -0.12, -0.55, -0.32, 0.016, -0.01],
    ]);
    // Longer asymmetrical swept side panel on +X, neat tucked side on -X
    const sweep = new THREE.Group();
    sweep.position.set(0.18, 0.26, 0.06);
    headGroup.add(sweep);
    addMesh(
      THREE,
      sweep,
      makeWedgeLock(THREE, 0.23, 0.11, 0.065, -0.015, 0.03, lockShade),
      hairMat,
      'hair',
      [0, 0, 0],
      [0.05, 0.25, 0.08]
    );
    addSway(swayItems, sweep, 0.03, 0.045, 0.4);

    addMesh(
      THREE,
      headGroup,
      makeWedgeLock(THREE, 0.15, 0.09, 0.055, -0.01, -0.012, lockShade),
      hairMat,
      'hair',
      [-0.185, 0.25, 0.04],
      [0.08, -0.2, -0.06]
    );
    // Mid-short back panels
    for (let i = -1; i <= 1; i++) {
      addMesh(
        THREE,
        headGroup,
        makeWedgeLock(THREE, 0.16, 0.13, 0.06, -0.012, i * 0.01, lockShade),
        hairMat,
        'hair',
        [i * 0.085, 0.17, -0.175],
        [0.14, i * 0.22, 0]
      );
    }
    return;
  }

  if (style === 'pixie') {
    addFringe([
      [-0.09, 0.325, 0.155, 0.09, 0.078, 0.036, -0.22, -0.22, 0.24, 0.018, 0.018],
      [-0.01, 0.332, 0.165, 0.088, 0.082, 0.038, -0.22, 0, 0.2, 0.02, 0.015],
      [0.07, 0.325, 0.155, 0.092, 0.075, 0.036, -0.22, 0.24, 0.16, 0.018, 0.015],
      [0.135, 0.295, 0.115, 0.085, 0.06, 0.032, -0.14, 0.55, 0.12, 0.012, 0.01],
    ]);
    // Cute crown tuft
    const tuft = new THREE.Group();
    tuft.position.set(0.02, 0.39, 0.02);
    headGroup.add(tuft);
    addMesh(
      THREE,
      tuft,
      makeWedgeLock(THREE, 0.085, 0.045, 0.032, 0.02, 0.025, lockShade),
      hairMat,
      'hair',
      [0, 0.075, 0],
      [2.65, 0.2, -0.35]
    );
    addSway(swayItems, tuft, 0.05, 0.06, 1.1, 2.0);
    // Cropped nape tufts
    for (let i = -1; i <= 1; i++) {
      addMesh(
        THREE,
        headGroup,
        makeWedgeLock(THREE, 0.09, 0.095, 0.045, -0.008, 0, lockShade),
        hairMat,
        'hair',
        [i * 0.075, 0.12, -0.175],
        [0.08, i * 0.25, 0]
      );
    }
    return;
  }

  if (style === 'short') {
    addFringe([
      [-0.12, 0.315, 0.14, 0.095, 0.072, 0.038, -0.2, -0.38, -0.12, 0.02, -0.01],
      [-0.045, 0.33, 0.165, 0.102, 0.078, 0.04, -0.22, -0.12, -0.04, 0.022, 0],
      [0.035, 0.332, 0.166, 0.098, 0.076, 0.04, -0.22, 0.1, 0.05, 0.022, 0],
      [0.115, 0.315, 0.142, 0.095, 0.072, 0.038, -0.2, 0.36, 0.14, 0.02, 0.01],
    ]);
    // Layered spiky crown & side/back wedges
    for (let i = 0; i < 7; i++) {
      const a = -1.9 + (i / 6) * 3.8 + Math.PI;
      const sx = Math.sin(a) * 0.195;
      const sz = Math.cos(a) * 0.185;
      addMesh(
        THREE,
        headGroup,
        makeWedgeLock(THREE, 0.135, 0.095, 0.052, -0.025, 0, lockShade),
        hairMat,
        'hair',
        [sx, 0.2, sz],
        [0.24, a + Math.PI, 0]
      );
    }
    return;
  }

  if (style === 'curly') {
    // Clustered faceted lumps forming a voluminous curly silhouette + curled fringe
    const lumps = [
      // Fringe puffs well above eyes
      [-0.12, 0.31, 0.16, 0.055],
      [-0.04, 0.325, 0.185, 0.058],
      [0.045, 0.322, 0.184, 0.058],
      [0.125, 0.308, 0.158, 0.054],
      // Crown volume
      [-0.11, 0.37, 0.05, 0.072],
      [0.0, 0.395, 0.02, 0.078],
      [0.11, 0.368, 0.05, 0.072],
      [-0.12, 0.35, -0.1, 0.076],
      [0.0, 0.375, -0.13, 0.08],
      [0.12, 0.35, -0.1, 0.076],
    ];
    lumps.forEach(([x, y, z, r], i) => {
      addMesh(THREE, headGroup, makeLump(THREE, r, kit, i * 1.7, hairShade), hairMat, 'hair', [x, y, z]);
    });

    // Side and back curly clusters that gently sway
    const curlPivotL = new THREE.Group();
    curlPivotL.position.set(0.2, 0.24, -0.01);
    headGroup.add(curlPivotL);
    const curlPivotR = new THREE.Group();
    curlPivotR.position.set(-0.2, 0.24, -0.01);
    headGroup.add(curlPivotR);
    const curlPivotB = new THREE.Group();
    curlPivotB.position.set(0, 0.22, -0.18);
    headGroup.add(curlPivotB);

    const sideDrops = [
      [0.02, -0.01, 0.05, 0.072],
      [0.04, -0.09, 0.02, 0.078],
      [0.03, -0.16, -0.02, 0.07],
      [0.01, -0.05, -0.08, 0.074],
    ];
    sideDrops.forEach(([x, y, z, r], i) => {
      addMesh(THREE, curlPivotL, makeLump(THREE, r, kit, 20 + i, lockShade), hairMat, 'hair', [x, y, z]);
      addMesh(THREE, curlPivotR, makeLump(THREE, r, kit, 30 + i, lockShade), hairMat, 'hair', [-x, y, z]);
    });
    const backDrops = [
      [-0.11, -0.02, -0.02, 0.078],
      [0, -0.01, -0.04, 0.084],
      [0.11, -0.02, -0.02, 0.078],
      [-0.09, -0.11, -0.02, 0.076],
      [0, -0.12, -0.04, 0.082],
      [0.09, -0.11, -0.02, 0.076],
    ];
    backDrops.forEach(([x, y, z, r], i) => {
      addMesh(THREE, curlPivotB, makeLump(THREE, r, kit, 40 + i, lockShade), hairMat, 'hair', [x, y, z]);
    });
    addSway(swayItems, curlPivotL, 0.025, 0.04, 0.2);
    addSway(swayItems, curlPivotR, 0.025, -0.04, 0.8);
    addSway(swayItems, curlPivotB, 0.035, 0.02, 1.4);
    return;
  }

  // Standard clean 5-wedge anime fringe for bob, long, ponytail, twinTails, bun
  addFringe([
    [-0.125, 0.315, 0.138, 0.1, 0.076, 0.04, -0.2, -0.4, -0.1, 0.018, -0.008],
    [-0.055, 0.33, 0.164, 0.104, 0.082, 0.042, -0.22, -0.15, -0.03, 0.022, 0],
    [0.0, 0.334, 0.168, 0.098, 0.074, 0.04, -0.22, 0, 0, 0.022, 0],
    [0.055, 0.33, 0.164, 0.104, 0.082, 0.042, -0.22, 0.15, 0.03, 0.022, 0],
    [0.125, 0.315, 0.138, 0.1, 0.076, 0.04, -0.2, 0.4, 0.1, 0.018, 0.008],
  ]);

  if (style === 'bob') {
    // Side panels reaching jaw & flicking outward at tips
    for (const side of [-1, 1]) {
      const p = new THREE.Group();
      p.position.set(side * 0.19, 0.25, 0.02);
      headGroup.add(p);
      const bobRings = [
        { y: 0.02, rx: 0.052, rz: 0.1, ox: 0, oz: 0 },
        { y: -0.08, rx: 0.058, rz: 0.115, ox: side * 0.012, oz: -0.01 },
        { y: -0.175, rx: 0.048, rz: 0.098, ox: side * 0.005, oz: -0.015 },
        { y: -0.23, rx: 0.032, rz: 0.078, ox: side * 0.045, oz: -0.01 },
      ];
      addMesh(THREE, p, makePrism(THREE, bobRings, 6, { shade: lockShade }), hairMat, 'hair');
      addSway(swayItems, p, 0.02, side * 0.045, side > 0 ? 0.3 : 1.1);
    }
    // Back bob curtain with subtle outward flick
    const backP = new THREE.Group();
    backP.position.set(0, 0.24, -0.16);
    headGroup.add(backP);
    for (let i = -1; i <= 1; i++) {
      const rings = [
        { y: 0.02, rx: 0.082, rz: 0.048, ox: i * 0.09, oz: Math.abs(i) * 0.03 },
        { y: -0.11, rx: 0.09, rz: 0.052, ox: i * 0.1, oz: -0.015 + Math.abs(i) * 0.03 },
        { y: -0.22, rx: 0.078, rz: 0.036, ox: i * 0.115, oz: -0.045 + Math.abs(i) * 0.03 },
      ];
      addMesh(THREE, backP, makePrism(THREE, rings, 6, { shade: lockShade }), hairMat, 'hair');
    }
    addSway(swayItems, backP, 0.04, 0.015, 0.7);
    return;
  }

  if (style === 'long') {
    // Framing front side locks
    for (const side of [-1, 1]) {
      const sp = new THREE.Group();
      sp.position.set(side * 0.185, 0.26, 0.06);
      headGroup.add(sp);
      addMesh(
        THREE,
        sp,
        makeWedgeLock(THREE, 0.27, 0.088, 0.052, -0.01, side * 0.012, lockShade),
        hairMat,
        'hair'
      );
      addSway(swayItems, sp, 0.03, side * 0.04, side > 0 ? 0.2 : 0.9);
    }
    // Four big faceted back panels down to the waist (two-tier sway so tips move more)
    const upper = new THREE.Group();
    upper.position.set(0, 0.25, -0.165);
    headGroup.add(upper);
    const lower = new THREE.Group();
    lower.position.set(0, -0.22, -0.025);
    upper.add(lower);

    const offsets = [-0.135, -0.045, 0.045, 0.135];
    offsets.forEach((ox, idx) => {
      const zOff = Math.abs(ox) * 0.28;
      const topR = [
        { y: 0.03, rx: 0.068, rz: 0.046, ox, oz: zOff },
        { y: -0.12, rx: 0.072, rz: 0.048, ox: ox * 1.06, oz: zOff - 0.015 },
        { y: -0.24, rx: 0.066, rz: 0.042, ox: ox * 1.12, oz: zOff - 0.028 },
      ];
      addMesh(THREE, upper, makePrism(THREE, topR, 6, { shade: lockShade }), hairMat, 'hair');
      const botR = [
        { y: 0.02, rx: 0.065, rz: 0.04, ox: ox * 1.12, oz: zOff },
        { y: -0.14, rx: 0.058, rz: 0.034, ox: ox * 1.18, oz: zOff - 0.018 },
        { y: -0.27 - (idx === 1 || idx === 2 ? 0.03 : 0), rx: 0.015, rz: 0.012, ox: ox * 1.14, oz: zOff - 0.01 },
      ];
      addMesh(THREE, lower, makePrism(THREE, botR, 6, { shade: lockShade }), hairMat, 'hair');
    });
    addSway(swayItems, upper, 0.035, 0.02, 0.3);
    addSway(swayItems, lower, 0.065, 0.04, 0.9);
    return;
  }

  if (style === 'ponytail') {
    // Accent hair band at back crown
    const band = makePrism(
      THREE,
      [
        { y: -0.016, rx: 0.046, rz: 0.046 },
        { y: 0.016, rx: 0.046, rz: 0.046 },
      ],
      8
    );
    addMesh(THREE, headGroup, band, accentMat, 'accent', [0, 0.27, -0.2], [0.75, 0, 0]);

    const tailRoot = new THREE.Group();
    tailRoot.position.set(0, 0.27, -0.21);
    headGroup.add(tailRoot);
    const tailTip = new THREE.Group();
    tailTip.position.set(0, -0.15, -0.11);
    tailRoot.add(tailTip);

    const upperRings = [
      { y: 0.01, rx: 0.035, rz: 0.035, oz: 0 },
      { y: -0.05, rx: 0.075, rz: 0.068, oz: -0.07 },
      { y: -0.16, rx: 0.078, rz: 0.062, oz: -0.115 },
    ];
    addMesh(THREE, tailRoot, makePrism(THREE, upperRings, 7, { shade: lockShade }), hairMat, 'hair');
    addMesh(
      THREE,
      tailTip,
      makeWedgeLock(THREE, 0.23, 0.14, 0.105, -0.02, 0, lockShade),
      hairMat,
      'hair',
      [0, 0.01, 0],
      [-0.12, 0, 0]
    );
    addSway(swayItems, tailRoot, 0.045, 0.045, 0.2);
    addSway(swayItems, tailTip, 0.075, 0.075, 0.9);
    return;
  }

  if (style === 'twinTails') {
    for (const side of [-1, 1]) {
      const band = makePrism(
        THREE,
        [
          { y: -0.014, rx: 0.038, rz: 0.038 },
          { y: 0.014, rx: 0.038, rz: 0.038 },
        ],
        8
      );
      addMesh(
        THREE,
        headGroup,
        band,
        accentMat,
        'accent',
        [side * 0.2, 0.27, -0.05],
        [0, 0, side * -0.95]
      );

      const rootP = new THREE.Group();
      rootP.position.set(side * 0.21, 0.27, -0.05);
      headGroup.add(rootP);
      const tipP = new THREE.Group();
      tipP.position.set(side * 0.1, -0.16, -0.02);
      rootP.add(tipP);

      const tRings = [
        { y: 0.0, rx: 0.028, rz: 0.028, ox: 0, oz: 0 },
        { y: -0.04, rx: 0.062, rz: 0.058, ox: side * 0.065, oz: -0.01 },
        { y: -0.17, rx: 0.066, rz: 0.058, ox: side * 0.1, oz: -0.02 },
      ];
      addMesh(THREE, rootP, makePrism(THREE, tRings, 6, { shade: lockShade }), hairMat, 'hair');
      addMesh(
        THREE,
        tipP,
        makeWedgeLock(THREE, 0.24, 0.125, 0.095, -0.015, side * 0.025, lockShade),
        hairMat,
        'hair',
        [0, 0.01, 0],
        [0, 0, side * 0.08]
      );
      addSway(swayItems, rootP, 0.03, 0.05, side > 0 ? 0.1 : 1.2);
      addSway(swayItems, tipP, 0.045, 0.085, side > 0 ? 0.8 : 1.9);
    }
    return;
  }

  if (style === 'bun') {
    // High faceted geometric bun + accent band + tiny side tendrils
    const band = makePrism(
      THREE,
      [
        { y: -0.016, rx: 0.065, rz: 0.065 },
        { y: 0.016, rx: 0.065, rz: 0.065 },
      ],
      8
    );
    addMesh(THREE, headGroup, band, accentMat, 'accent', [0, 0.36, -0.13], [0.58, 0, 0]);
    const bunG = makeLump(THREE, 0.095, kit, 5.5, hairShade);
    addMesh(THREE, headGroup, bunG, hairMat, 'hair', [0, 0.415, -0.165], [0.3, 0.2, 0]);
    for (const side of [-1, 1]) {
      const tendril = new THREE.Group();
      tendril.position.set(side * 0.175, 0.22, 0.075);
      headGroup.add(tendril);
      addMesh(
        THREE,
        tendril,
        makeWedgeLock(THREE, 0.11, 0.042, 0.028, 0.01, side * 0.01, lockShade),
        hairMat,
        'hair'
      );
      addSway(swayItems, tendril, 0.03, 0.05, side > 0 ? 0.4 : 1.5);
    }
  }
}

function buildClothes(THREE, joints, opts, mats, swayItems) {
  const bw = opts.bodyWidth;
  const bh = opts.bodyHeight;
  const top = opts.top;
  const bottom = opts.bottom;
  const clothShade = { dark: [0.76, 0.76, 0.82], downCut: -0.2 };
  const topMat = mats.top;
  const botMat = mats.bottom;
  const accentMat = mats.accent;
  const whiteMat = mats.white;

  // --- TOPS ---
  const longHem = top === 'blazer' || top === 'hoodie' || top === 'cardigan';
  const botY = longHem ? -0.055 * bh : -0.018 * bh;
  const topY = 0.198 * bh;
  const torsoRings = [
    { y: botY, rx: (longHem ? 0.104 : 0.094) * bw, rz: (longHem ? 0.08 : 0.072) * bw },
    { y: 0.06 * bh, rx: 0.096 * bw, rz: 0.074 * bw },
    { y: 0.175 * bh, rx: 0.116 * bw, rz: 0.082 * bw },
    { y: topY, rx: 0.082 * bw, rz: 0.066 * bw },
  ];
  addMesh(THREE, joints.chest, makeShell(THREE, torsoRings, 0.012, 8, { shade: clothShade }), topMat, 'top');

  // Sleeves on armL/R and forearmL/R
  const isShortSleeve = top === 'tee';
  for (const side of ['L', 'R']) {
    const arm = joints['arm' + side];
    const fore = joints['forearm' + side];
    const upperRings = [
      { y: (isShortSleeve ? -0.068 : -0.108) * bh, rx: (isShortSleeve ? 0.044 : 0.039) * bw, rz: (isShortSleeve ? 0.044 : 0.039) * bw },
      { y: -0.015 * bh, rx: 0.048 * bw, rz: 0.048 * bw },
      { y: 0.028 * bh, rx: 0.036 * bw, rz: 0.036 * bw },
    ];
    addMesh(THREE, arm, makeShell(THREE, upperRings, 0.008, 6, { shade: clothShade }), topMat, 'top');

    if (!isShortSleeve) {
      const foreRings = [
        { y: -0.086 * bh, rx: 0.035 * bw, rz: 0.035 * bw },
        { y: -0.02 * bh, rx: 0.038 * bw, rz: 0.038 * bw },
        { y: 0.016 * bh, rx: 0.037 * bw, rz: 0.037 * bw },
      ];
      addMesh(THREE, fore, makeShell(THREE, foreRings, 0.008, 6, { shade: clothShade }), topMat, 'top');
      if (top === 'sweater' || top === 'hoodie' || top === 'cardigan') {
        const cuff = makePrism(
          THREE,
          [
            { y: -0.092 * bh, rx: 0.038 * bw, rz: 0.038 * bw },
            { y: -0.068 * bh, rx: 0.04 * bw, rz: 0.04 * bw },
          ],
          6,
          { shade: clothShade }
        );
        addMesh(THREE, fore, cuff, topMat, 'top');
      }
    }
  }

  // Top-specific details
  if (top === 'hoodie') {
    // Faceted hood behind neck (sways!)
    const hoodP = new THREE.Group();
    hoodP.position.set(0, 0.195 * bh, -0.055 * bw);
    joints.chest.add(hoodP);
    const hoodG = makeBox(THREE, 0.175 * bw, 0.115 * bh, 0.105 * bw, {
      taperTopX: 0.82,
      taperBotX: 1.05,
      shiftTopZ: -0.015 * bw,
      shade: clothShade,
    });
    addMesh(THREE, hoodP, hoodG, topMat, 'top', [0, -0.01 * bh, -0.04 * bw], [0.22, 0, 0]);
    // Hood rim collar around front neck
    const collar = makePrism(
      THREE,
      [
        { y: 0.18 * bh, rx: 0.072 * bw, rz: 0.064 * bw },
        { y: 0.215 * bh, rx: 0.076 * bw, rz: 0.068 * bw },
      ],
      8,
      { shade: clothShade }
    );
    addMesh(THREE, joints.chest, collar, topMat, 'top');
    addSway(swayItems, hoodP, 0.055, 0.025, 0.5, 1.5);

    // Kangaroo pocket & two drawstring prisms
    const pkt = makeBox(THREE, 0.115 * bw, 0.056 * bh, 0.022 * bw, { taperTopX: 0.78, shade: clothShade });
    addMesh(THREE, joints.chest, pkt, topMat, 'top', [0, 0.012 * bh, 0.076 * bw]);
    for (const s of [-1, 1]) {
      const ds = makeBox(THREE, 0.009 * bw, 0.068 * bh, 0.009 * bw, { shade: clothShade });
      addMesh(THREE, joints.chest, ds, accentMat, 'accent', [s * 0.026 * bw, 0.135 * bh, 0.08 * bw], [0, 0, s * -0.06]);
    }
  } else if (top === 'blazer') {
    // Inner lighter shirt strip
    const inner = makeBox(THREE, 0.068 * bw, 0.22 * bh, 0.018 * bw, { taperTopX: 1.15, shade: clothShade });
    addMesh(THREE, joints.chest, inner, whiteMat, null, [0, 0.08 * bh, 0.076 * bw]);
    // Angular lapels
    for (const s of [-1, 1]) {
      const lap = makeBox(THREE, 0.038 * bw, 0.125 * bh, 0.018 * bw, { taperBotX: 0.45, shade: clothShade });
      addMesh(
        THREE,
        joints.chest,
        lap,
        topMat,
        'top',
        [s * 0.044 * bw, 0.132 * bh, 0.082 * bw],
        [0, s * -0.18, s * -0.22]
      );
    }
    // Two blazer buttons
    for (let i = 0; i < 2; i++) {
      const btn = makeBox(THREE, 0.014 * bw, 0.014 * bh, 0.01 * bw);
      addMesh(THREE, joints.chest, btn, accentMat, 'accent', [0.025 * bw, (0.045 - i * 0.036) * bh, 0.084 * bw]);
    }
  } else if (top === 'cardigan') {
    const inner = makeBox(THREE, 0.066 * bw, 0.225 * bh, 0.016 * bw, { shade: clothShade });
    addMesh(THREE, joints.chest, inner, whiteMat, null, [0, 0.078 * bh, 0.075 * bw]);
    for (const s of [-1, 1]) {
      const trim = makeBox(THREE, 0.022 * bw, 0.23 * bh, 0.018 * bw, { shade: clothShade });
      addMesh(THREE, joints.chest, trim, topMat, 'top', [s * 0.04 * bw, 0.075 * bh, 0.08 * bw], [0, 0, s * -0.05]);
    }
    for (let i = 0; i < 3; i++) {
      const dot = makeBox(THREE, 0.013 * bw, 0.013 * bh, 0.012 * bw);
      addMesh(THREE, joints.chest, dot, accentMat, 'accent', [0.036 * bw, (0.11 - i * 0.042) * bh, 0.088 * bw]);
    }
  } else if (top === 'sweater') {
    // Thick ribbed collar ring + bottom band
    const col = makePrism(
      THREE,
      [
        { y: 0.185 * bh, rx: 0.068 * bw, rz: 0.062 * bw },
        { y: 0.232 * bh, rx: 0.064 * bw, rz: 0.058 * bw },
      ],
      8,
      { shade: clothShade }
    );
    addMesh(THREE, joints.chest, col, topMat, 'top');
    const hem = makePrism(
      THREE,
      [
        { y: -0.032 * bh, rx: 0.102 * bw, rz: 0.078 * bw },
        { y: 0.01 * bh, rx: 0.104 * bw, rz: 0.08 * bw },
      ],
      8,
      { shade: clothShade }
    );
    addMesh(THREE, joints.chest, hem, topMat, 'top');
  } else if (top === 'shirt') {
    // Crisp folded collar wedges + front placket + buttons
    for (const s of [-1, 1]) {
      const cw = makeBox(THREE, 0.052 * bw, 0.032 * bh, 0.044 * bw, { taperBotX: 0.4, shade: clothShade });
      addMesh(
        THREE,
        joints.chest,
        cw,
        topMat,
        'top',
        [s * 0.036 * bw, 0.205 * bh, 0.042 * bw],
        [0.35, s * 0.35, s * -0.35]
      );
    }
    const placket = makeBox(THREE, 0.024 * bw, 0.205 * bh, 0.012 * bw, { shade: clothShade });
    addMesh(THREE, joints.chest, placket, topMat, 'top', [0, 0.09 * bh, 0.079 * bw]);
    for (let i = 0; i < 3; i++) {
      const btn = makeBox(THREE, 0.01 * bw, 0.01 * bh, 0.01 * bw);
      addMesh(THREE, joints.chest, btn, accentMat, 'accent', [0, (0.14 - i * 0.05) * bh, 0.085 * bw]);
    }
  } else {
    // Tee neckline ring
    const neckR = makePrism(
      THREE,
      [
        { y: 0.188 * bh, rx: 0.068 * bw, rz: 0.06 * bw },
        { y: 0.21 * bh, rx: 0.064 * bw, rz: 0.056 * bw },
      ],
      8,
      { shade: clothShade }
    );
    addMesh(THREE, joints.chest, neckR, topMat, 'top');
  }

  // --- BOTTOMS ---
  const hipShell = makePrism(
    THREE,
    [
      { y: -0.04 * bh, rx: 0.098 * bw, rz: 0.074 * bw },
      { y: 0.068 * bh, rx: 0.092 * bw, rz: 0.07 * bw },
    ],
    8,
    { shade: clothShade }
  );
  addMesh(THREE, joints.pelvis, hipShell, botMat, 'bottom');

  if (bottom === 'skirt' || bottom === 'longSkirt') {
    const isLong = bottom === 'longSkirt';
    const skRings = [
      { y: (isLong ? -0.225 : -0.115) * bh, rx: (isLong ? 0.158 : 0.148) * bw, rz: (isLong ? 0.128 : 0.12) * bw, pleat: 0.075 },
      { y: (isLong ? -0.08 : -0.03) * bh, rx: (isLong ? 0.128 : 0.122) * bw, rz: (isLong ? 0.102 : 0.096) * bw, pleat: 0.055 },
      { y: 0.062 * bh, rx: 0.095 * bw, rz: 0.074 * bw, pleat: 0.015 },
    ];
    addMesh(THREE, joints.pelvis, makeShell(THREE, skRings, 0.01, 20, { shade: clothShade }), botMat, 'bottom');
  } else {
    const isShorts = bottom === 'shorts';
    const isJeans = bottom === 'jeans';
    for (const side of ['L', 'R']) {
      const leg = joints['leg' + side];
      const shin = joints['shin' + side];
      const uRings = [
        { y: (isShorts ? -0.078 : -0.138) * bh, rx: (isShorts ? 0.056 : 0.047) * bw, rz: (isShorts ? 0.056 : 0.047) * bw },
        { y: 0.018 * bh, rx: 0.054 * bw, rz: 0.054 * bw },
      ];
      addMesh(THREE, leg, makeShell(THREE, uRings, 0.008, 6, { shade: clothShade }), botMat, 'bottom');

      if (!isShorts) {
        const lRings = [
          { y: -0.128 * bh, rx: 0.04 * bw, rz: 0.04 * bw },
          { y: 0.015 * bh, rx: 0.046 * bw, rz: 0.046 * bw },
        ];
        addMesh(THREE, shin, makeShell(THREE, lRings, 0.008, 6, { shade: clothShade }), botMat, 'bottom');
        if (isJeans) {
          const cuff = makePrism(
            THREE,
            [
              { y: -0.132 * bh, rx: 0.045 * bw, rz: 0.045 * bw },
              { y: -0.102 * bh, rx: 0.046 * bw, rz: 0.046 * bw },
            ],
            6,
            { shade: { dark: [0.85, 0.88, 0.94], base: [1.15, 1.18, 1.22] } }
          );
          addMesh(THREE, shin, cuff, botMat, 'bottom');
        }
      }
    }
  }

  // --- SOCKS ---
  if (opts.socks !== 'none') {
    const sockMat = mats.sock;
    const isKnee = opts.socks === 'knee';
    for (const side of ['L', 'R']) {
      const shin = joints['shin' + side];
      const sRings = [
        { y: -0.132 * bh, rx: 0.031 * bw, rz: 0.031 * bw },
        { y: (isKnee ? 0.006 : -0.078) * bh, rx: (isKnee ? 0.038 : 0.034) * bw, rz: (isKnee ? 0.038 : 0.034) * bw },
      ];
      addMesh(THREE, shin, makePrism(THREE, sRings, 6, { shade: clothShade }), sockMat, 'accent');
    }
  }

  // --- SHOES (sole sits at y = -0.04 in foot space -> world y = 0) ---
  const shoeType = opts.shoes;
  const shoeMat = mats.shoes;
  for (const side of ['L', 'R']) {
    const foot = joints['foot' + side];
    const shin = joints['shin' + side];
    const soleMat = shoeType === 'sneakers' ? whiteMat : shoeMat;
    const soleSlot = shoeType === 'sneakers' ? null : 'shoes';

    // Flat wedge sole
    const sole = makeBox(THREE, 0.068 * bw, 0.015, 0.108, { taperTopX: 0.94, taperTopZ: 0.96, shade: clothShade });
    addMesh(THREE, foot, sole, soleMat, soleSlot, [0, -0.0325, 0.018]);

    // Upper shoe body
    const upH = shoeType === 'maryJanes' ? 0.022 : 0.03;
    const upper = makeBox(THREE, 0.064 * bw, upH, 0.098, {
      taperTopX: 0.82,
      taperTopZ: 0.72,
      shiftTopZ: -0.014,
      shade: clothShade,
    });
    addMesh(THREE, foot, upper, shoeMat, 'shoes', [0, -0.025 + upH * 0.5, 0.015]);

    if (shoeType === 'sneakers') {
      const toe = makeBox(THREE, 0.058 * bw, 0.016, 0.034, { taperTopZ: 0.75, shade: clothShade });
      addMesh(THREE, foot, toe, whiteMat, null, [0, -0.018, 0.052]);
      const tongue = makeBox(THREE, 0.04 * bw, 0.02, 0.024, { shade: clothShade });
      addMesh(THREE, foot, tongue, whiteMat, null, [0, 0.002, 0.018], [-0.45, 0, 0]);
    } else if (shoeType === 'boots') {
      const shaft = makePrism(
        THREE,
        [
          { y: -0.132 * bh, rx: 0.042 * bw, rz: 0.044 * bw },
          { y: -0.052 * bh, rx: 0.046 * bw, rz: 0.048 * bw },
        ],
        6,
        { shade: clothShade }
      );
      addMesh(THREE, shin, shaft, shoeMat, 'shoes');
      const strap = makeBox(THREE, 0.082 * bw, 0.012, 0.012);
      addMesh(THREE, shin, strap, accentMat, 'accent', [0, -0.072 * bh, 0.042 * bw]);
    } else if (shoeType === 'maryJanes') {
      const instep = makeBox(THREE, 0.042 * bw, 0.016, 0.044);
      addMesh(THREE, foot, instep, opts.socks !== 'none' ? mats.sock : mats.skin, opts.socks !== 'none' ? 'accent' : 'skin', [0, -0.012, 0.014]);
      const strap = makeBox(THREE, 0.068 * bw, 0.008, 0.015);
      addMesh(THREE, foot, strap, shoeMat, 'shoes', [0, -0.002, 0.014]);
      const buckle = makeBox(THREE, 0.012 * bw, 0.012, 0.012);
      addMesh(THREE, foot, buckle, accentMat, 'accent', [(side === 'L' ? 1 : -1) * 0.032 * bw, -0.002, 0.014]);
    } else if (shoeType === 'loafers') {
      const bar = makeBox(THREE, 0.062 * bw, 0.009, 0.02);
      addMesh(THREE, foot, bar, accentMat, 'accent', [0, 0.001, 0.022], [0.2, 0, 0]);
    }
  }
}

function buildAccessories(THREE, joints, opts, mats, swayItems) {
  const bw = opts.bodyWidth;
  const bh = opts.bodyHeight;
  const accentMat = mats.accent;
  const shade = { dark: [0.76, 0.76, 0.82], downCut: -0.2 };

  // --- GLASSES ---
  if (opts.glasses !== 'none') {
    const gGroup = new THREE.Group();
    gGroup.position.set(0, 0.15, 0.194);
    joints.head.add(gGroup);
    const frameMat = mats.glasses;

    const isRound = opts.glasses === 'round';
    const segs = isRound ? 10 : 4;
    const phase = isRound ? 0 : Math.PI / 4;
    const rad = isRound ? 0.052 : 0.062;
    for (const s of [-1, 1]) {
      const ring = makeShell(
        THREE,
        [
          { y: -0.004, rx: rad, rz: rad * (isRound ? 1 : 0.84) },
          { y: 0.004, rx: rad, rz: rad * (isRound ? 1 : 0.84) },
        ],
        0.007,
        segs,
        { phase, shade }
      );
      addMesh(THREE, gGroup, ring, frameMat, 'accent', [s * 0.084, 0, 0], [Math.PI / 2, 0, 0]);
      // Temple arms reaching back to ears
      const arm = makeBox(THREE, 0.007, 0.007, 0.19, { shade });
      addMesh(THREE, gGroup, arm, frameMat, 'accent', [s * 0.138, 0.006, -0.095], [0, s * 0.25, 0]);
    }
    const bridge = makeBox(THREE, 0.044, 0.008, 0.008, { shade });
    addMesh(THREE, gGroup, bridge, frameMat, 'accent', [0, 0.008, 0.002]);
  }

  // --- BAGS ---
  if (opts.bag === 'backpack') {
    const bp = new THREE.Group();
    bp.position.set(0, 0.09 * bh, -0.115 * bw);
    joints.chest.add(bp);
    const main = makeBox(THREE, 0.155 * bw, 0.185 * bh, 0.085 * bw, { taperTopX: 0.88, taperTopZ: 0.82, shade });
    addMesh(THREE, bp, main, accentMat, 'accent');
    const pocket = makeBox(THREE, 0.12 * bw, 0.072 * bh, 0.028 * bw, { taperTopX: 0.92, shade });
    addMesh(THREE, bp, pocket, accentMat, 'accent', [0, -0.042 * bh, -0.048 * bw]);
    const flap = makeBox(THREE, 0.14 * bw, 0.024 * bh, 0.088 * bw, { shade });
    addMesh(THREE, bp, flap, accentMat, 'accent', [0, 0.092 * bh, -0.004 * bw], [0.12, 0, 0]);
    // Shoulder straps wrapping to chest
    for (const s of [-1, 1]) {
      const topS = makeBox(THREE, 0.024 * bw, 0.016 * bh, 0.17 * bw, { shade });
      addMesh(THREE, joints.chest, topS, accentMat, 'accent', [s * 0.072 * bw, 0.195 * bh, -0.005 * bw]);
      const frontS = makeBox(THREE, 0.024 * bw, 0.145 * bh, 0.016 * bw, { shade });
      addMesh(THREE, joints.chest, frontS, accentMat, 'accent', [s * 0.072 * bw, 0.125 * bh, 0.078 * bw]);
    }
  } else if (opts.bag === 'tote') {
    const toteP = new THREE.Group();
    toteP.position.set(0, -0.042 * bh, 0.008);
    toteP.rotation.z = 0.25; // Counter arm rest angle so tote hangs straight
    joints.handR.add(toteP);
    // Straps
    for (const z of [-0.016, 0.016]) {
      const strap = makeBox(THREE, 0.012, 0.068, 0.01, { shade });
      addMesh(THREE, toteP, strap, accentMat, 'accent', [0, -0.025, z]);
    }
    const body = makeBox(THREE, 0.055, 0.135, 0.13, { taperTopZ: 1.12, taperBotZ: 0.9, shade });
    addMesh(THREE, toteP, body, accentMat, 'accent', [0, -0.115, 0]);
    const trim = makeBox(THREE, 0.06, 0.018, 0.146, { shade });
    addMesh(THREE, toteP, trim, mats.top, 'top', [0, -0.054, 0]);
    addSway(swayItems, toteP, 0.03, 0.05, 1.3, 1.4);
  }
}

export function buildChibi(THREE, opts = {}, kit) {
  const cfg = { ...DEFAULTS, ...(opts || {}) };
  cfg.bodyWidth = clamp(Number(cfg.bodyWidth) || 1.0, 0.8, 1.3);
  cfg.bodyHeight = clamp(Number(cfg.bodyHeight) || 1.0, 0.9, 1.1);
  const bw = cfg.bodyWidth;
  const bh = cfg.bodyHeight;

  const mats = {
    skin: makeMat(THREE, cfg.skin),
    hair: makeMat(THREE, cfg.hairColor),
    top: makeMat(THREE, cfg.topColor),
    bottom: makeMat(THREE, cfg.bottomColor),
    shoes: makeMat(THREE, cfg.shoeColor),
    sock: makeMat(THREE, cfg.sockColor),
    accent: makeMat(THREE, cfg.accent),
    glasses: makeMat(THREE, cfg.accent),
    white: makeMat(THREE, '#f4f2ec'),
  };

  const makeJoint = (name, parent, x, y, z) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    if (parent) parent.add(g);
    return g;
  };

  // Exact skeleton hierarchy (origin on floor between feet; total height ~1.00m)
  const root = makeJoint('root', null, 0, 0, 0);
  const pelvis = makeJoint('pelvis', root, 0, 0.04 + 0.26 * bh, 0);
  const chest = makeJoint('chest', pelvis, 0, 0.08 * bh, 0);
  const neck = makeJoint('neck', chest, 0, 0.20 * bh, 0);
  const head = makeJoint('head', neck, 0, 0.03, 0);

  const armL = makeJoint('armL', chest, 0.115 * bw, 0.17 * bh, 0);
  const forearmL = makeJoint('forearmL', armL, 0, -0.10 * bh, 0);
  const handL = makeJoint('handL', forearmL, 0, -0.09 * bh, 0);
  const armR = makeJoint('armR', chest, -0.115 * bw, 0.17 * bh, 0);
  const forearmR = makeJoint('forearmR', armR, 0, -0.10 * bh, 0);
  const handR = makeJoint('handR', forearmR, 0, -0.09 * bh, 0);
  armL.rotation.z = 0.25;
  armR.rotation.z = -0.25;

  const legL = makeJoint('legL', pelvis, 0.055 * bw, 0, 0);
  const shinL = makeJoint('shinL', legL, 0, -0.13 * bh, 0);
  const footL = makeJoint('footL', shinL, 0, -0.13 * bh, 0);
  const legR = makeJoint('legR', pelvis, -0.055 * bw, 0, 0);
  const shinR = makeJoint('shinR', legR, 0, -0.13 * bh, 0);
  const footR = makeJoint('footR', shinR, 0, -0.13 * bh, 0);

  const joints = {
    root, pelvis, chest, neck, head,
    armL, forearmL, handL, armR, forearmR, handR,
    legL, shinL, footL, legR, shinR, footR,
  };
  const swayItems = [];
  const skinShade = { dark: [0.87, 0.83, 0.84], downCut: -0.28 };

  // --- HEAD & EARS ---
  addMesh(THREE, head, buildHeadGeometry(THREE), mats.skin, 'skin');
  for (const s of [-1, 1]) {
    const ear = makePrism(
      THREE,
      [
        { y: -0.028, rx: 0.016, rz: 0.024 },
        { y: 0.008, rx: 0.022, rz: 0.032 },
        { y: 0.032, rx: 0.006, rz: 0.01 },
      ],
      3,
      { phase: s > 0 ? 0.3 : -0.3, shade: skinShade }
    );
    addMesh(THREE, head, ear, mats.skin, 'skin', [s * 0.194, 0.155, -0.01], [0, s * -0.35, s * -0.25]);
  }

  // --- PAINTED ANIME FACE PATCH ---
  const faceState = {
    expression: 'awake',
    blink: 0,
    eye: cfg.eye,
    hairColor: cfg.hairColor,
    blush: Boolean(cfg.blush),
    ctx: null,
    w: 1024,
    h: 1024,
    tex: null,
  };
  const faceTex = kit.canvasTexture(1024, 1024, (ctx, w, h) => {
    faceState.ctx = ctx;
    faceState.w = w;
    faceState.h = h;
    drawFace(ctx, w, h, faceState);
  });
  if ('SRGBColorSpace' in THREE) faceTex.colorSpace = THREE.SRGBColorSpace;
  faceState.tex = faceTex;

  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTex,
    transparent: true,
    alphaTest: 0.01,
    depthWrite: false,
    roughness: 0.72,
    metalness: 0.0,
    flatShading: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const faceMesh = new THREE.Mesh(buildFacePatch(THREE), faceMat);
  faceMesh.receiveShadow = true;
  head.add(faceMesh);

  // --- BODY & LIMBS ---
  const pelvisG = makePrism(
    THREE,
    [
      { y: -0.042 * bh, rx: 0.088 * bw, rz: 0.064 * bw },
      { y: 0.075 * bh, rx: 0.08 * bw, rz: 0.058 * bw },
    ],
    8,
    { shade: skinShade }
  );
  addMesh(THREE, pelvis, pelvisG, mats.skin, 'skin');

  const torsoG = makePrism(
    THREE,
    [
      { y: -0.015 * bh, rx: 0.08 * bw, rz: 0.058 * bw },
      { y: 0.09 * bh, rx: 0.088 * bw, rz: 0.064 * bw },
      { y: 0.175 * bh, rx: 0.10 * bw, rz: 0.068 * bw },
      { y: 0.205 * bh, rx: 0.065 * bw, rz: 0.052 * bw },
    ],
    8,
    { shade: skinShade }
  );
  addMesh(THREE, chest, torsoG, mats.skin, 'skin');

  const neckG = makePrism(
    THREE,
    [
      { y: -0.01, rx: 0.044 * bw, rz: 0.042 * bw },
      { y: 0.055, rx: 0.04 * bw, rz: 0.038 * bw },
    ],
    6,
    { shade: skinShade }
  );
  addMesh(THREE, neck, neckG, mats.skin, 'skin');

  // Short faceted arms tapering to point-like mitten hands
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1;
    const arm = joints['arm' + side];
    const fore = joints['forearm' + side];
    const hand = joints['hand' + side];

    const uArm = makePrism(
      THREE,
      [
        { y: -0.105 * bh, rx: 0.028 * bw, rz: 0.028 * bw },
        { y: -0.01 * bh, rx: 0.036 * bw, rz: 0.036 * bw },
        { y: 0.022 * bh, rx: 0.024 * bw, rz: 0.024 * bw },
      ],
      6,
      { shade: skinShade }
    );
    addMesh(THREE, arm, uArm, mats.skin, 'skin');

    const lArm = makePrism(
      THREE,
      [
        { y: -0.094 * bh, rx: 0.022 * bw, rz: 0.022 * bw },
        { y: 0.014 * bh, rx: 0.028 * bw, rz: 0.028 * bw },
      ],
      6,
      { shade: skinShade }
    );
    addMesh(THREE, fore, lArm, mats.skin, 'skin');

    const mitten = makePrism(
      THREE,
      [
        { y: -0.056 * bh, rx: 0.008 * bw, rz: 0.008 * bw },
        { y: -0.028 * bh, rx: 0.026 * bw, rz: 0.022 * bw },
        { y: 0.008 * bh, rx: 0.022 * bw, rz: 0.02 * bw },
      ],
      6,
      { shade: skinShade }
    );
    addMesh(THREE, hand, mitten, mats.skin, 'skin');
    const thumb = makeBox(THREE, 0.014 * bw, 0.022 * bh, 0.014 * bw, { taperBotX: 0.5, shade: skinShade });
    addMesh(THREE, hand, thumb, mats.skin, 'skin', [-s * 0.018 * bw, -0.018 * bh, 0.014 * bw], [0.25, 0, s * 0.35]);
  }

  // Short faceted legs as tapered prisms
  for (const side of ['L', 'R']) {
    const leg = joints['leg' + side];
    const shin = joints['shin' + side];
    const thigh = makePrism(
      THREE,
      [
        { y: -0.135 * bh, rx: 0.035 * bw, rz: 0.035 * bw },
        { y: 0.02 * bh, rx: 0.044 * bw, rz: 0.044 * bw },
      ],
      6,
      { shade: skinShade }
    );
    addMesh(THREE, leg, thigh, mats.skin, 'skin');

    const calf = makePrism(
      THREE,
      [
        { y: -0.132 * bh, rx: 0.027 * bw, rz: 0.027 * bw },
        { y: 0.015 * bh, rx: 0.035 * bw, rz: 0.035 * bw },
      ],
      6,
      { shade: skinShade }
    );
    addMesh(THREE, shin, calf, mats.skin, 'skin');
  }

  // --- HAIR, CLOTHES, ACCESSORIES ---
  buildHair(THREE, head, cfg, mats, kit, swayItems);
  buildClothes(THREE, joints, cfg, mats, swayItems);
  buildAccessories(THREE, joints, cfg, mats, swayItems);

  root.userData.faceState = faceState;
  root.userData.swayItems = swayItems;
  root.userData.joints = joints;
  return root;
}

export function setExpression(root, name) {
  const st = root && root.userData && root.userData.faceState;
  if (!st || !st.ctx) return;
  const valid = ['awake', 'happy', 'asleep', 'thinking', 'unsure'];
  const next = valid.includes(name) ? name : 'awake';
  if (st.expression === next) return;
  st.expression = next;
  drawFace(st.ctx, st.w, st.h, st);
  if (st.tex) st.tex.needsUpdate = true;
}

export function blink(root, t) {
  const st = root && root.userData && root.userData.faceState;
  if (!st || !st.ctx) return;
  const next = Math.round(clamp(Number(t) || 0, 0, 1) * 24) / 24;
  if (st.blink === next) return;
  st.blink = next;
  drawFace(st.ctx, st.w, st.h, st);
  if (st.tex) st.tex.needsUpdate = true;
}

export function sway(root, t) {
  const items = root && root.userData && root.userData.swayItems;
  if (!items) return;
  const time = Number(t) || 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const w =
      Math.sin(time * it.speed + it.phase) * 0.72 +
      Math.sin(time * it.speed * 1.65 + it.phase * 1.4) * 0.28;
    it.obj.rotation.x = it.rx + w * it.ampX;
    it.obj.rotation.z = it.rz + w * it.ampZ;
  }
}
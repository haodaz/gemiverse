export const PLOTS = {
  library: [-20, 0, -8],
  clubs: [20, 0, -8],
  commons: [-20, 0, 9],
  career: [20, 0, 9],
};

export const HOME = [0, 0, 15];

export const WALKWAYS = {
  library: [[0, 15], [-12.6, 15], [-12.6, -8], [-14.8, -8]],
  clubs: [[0, 15], [12.6, 15], [12.6, -8], [14.8, -8]],
  commons: [[0, 15], [-12.6, 15], [-12.6, 9], [-14.8, 9]],
  career: [[0, 15], [12.6, 15], [12.6, 9], [14.8, 9]],
};

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function applyBoxUVs(geo, scale = 0.35) {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ax = Math.abs(norm.getX(i));
    const ay = Math.abs(norm.getY(i));
    const az = Math.abs(norm.getZ(i));
    if (ay >= ax && ay >= az) {
      uv[i * 2] = x * scale;
      uv[i * 2 + 1] = z * scale;
    } else if (ax >= az) {
      uv[i * 2] = z * scale;
      uv[i * 2 + 1] = y * scale;
    } else {
      uv[i * 2] = x * scale;
      uv[i * 2 + 1] = y * scale;
    }
  }
  geo.setAttribute('uv', new geo.attributes.position.constructor(uv, 2));
  return geo;
}

function mergeGeos(THREE, geos) {
  const nonIndexed = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let totalVerts = 0;
  for (const g of nonIndexed) totalVerts += g.attributes.position.count;
  const posArr = new Float32Array(totalVerts * 3);
  const normArr = new Float32Array(totalVerts * 3);
  const uvArr = new Float32Array(totalVerts * 2);
  let offset = 0;
  for (const g of nonIndexed) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const count = g.attributes.position.count;
    posArr.set(g.attributes.position.array, offset * 3);
    normArr.set(g.attributes.normal.array, offset * 3);
    if (g.attributes.uv) {
      uvArr.set(g.attributes.uv.array, offset * 2);
    }
    offset += count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
  return out;
}

function roundedRectShape(THREE, w, h, r) {
  const s = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;
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

function makeBevelBox(THREE, w, h, d, r = 0.05, segs = 1, uvScale = 0.35) {
  const br = Math.min(r, w * 0.38, h * 0.38, d * 0.38);
  const iw = Math.max(0.01, w - 2 * br);
  const id = Math.max(0.01, d - 2 * br);
  const ih = Math.max(0.008, h - 2 * br);
  const shape = roundedRectShape(THREE, iw, id, br);
  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: ih,
    bevelEnabled: true,
    bevelThickness: br,
    bevelSize: br,
    bevelSegments: segs,
    curveSegments: segs,
  });
  geo.translate(0, 0, -ih / 2);
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return applyBoxUVs(geo, uvScale);
}

function makeChamferBar(THREE, w, h, d, c = 0.018, uvScale = 0.5) {
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;
  const cc = Math.min(c, hw * 0.45, hh * 0.45, hd * 0.6);
  const f = [
    [-hw + cc, -hh + cc, hd],
    [hw - cc, -hh + cc, hd],
    [hw - cc, hh - cc, hd],
    [-hw + cc, hh - cc, hd],
  ];
  const m = [
    [-hw, -hh, hd - cc],
    [hw, -hh, hd - cc],
    [hw, hh, hd - cc],
    [-hw, hh, hd - cc],
  ];
  const b = [
    [-hw, -hh, -hd],
    [hw, -hh, -hd],
    [hw, hh, -hd],
    [-hw, hh, -hd],
  ];
  const pts = [];
  const pushTri = (a, p, q) => {
    pts.push(a[0], a[1], a[2], p[0], p[1], p[2], q[0], q[1], q[2]);
  };
  const pushQuad = (a, p, q, r) => {
    pushTri(a, p, q);
    pushTri(a, q, r);
  };
  pushQuad(f[0], f[1], f[2], f[3]);
  for (let i = 0; i < 4; i++) {
    const n = (i + 1) % 4;
    pushQuad(m[i], m[n], f[n], f[i]);
    pushQuad(b[i], b[n], m[n], m[i]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.computeVertexNormals();
  return applyBoxUVs(geo, uvScale);
}

function makeHippedRoofGeo(THREE, w, h, d, uvScale = 0.42) {
  const hw = w / 2;
  const hd = d / 2;
  const ridgeAlongX = w >= d;
  const rx = ridgeAlongX ? Math.max(0.12, (w - d) * 0.48) : 0.04;
  const rz = ridgeAlongX ? 0.04 : Math.max(0.12, (d - w) * 0.48);
  const rings = [
    [hw, 0, hd],
    [hw - 0.04, 0.08, hd - 0.04],
    [rx + 0.08, h - 0.06, rz + 0.08],
    [rx, h, rz],
  ];
  const corners = (r) => [
    [-r[0], r[1], r[2]],
    [r[0], r[1], r[2]],
    [r[0], r[1], -r[2]],
    [-r[0], r[1], -r[2]],
  ];
  const pts = [];
  const pushQuad = (a, b, c, e) => {
    pts.push(
      a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2],
      a[0], a[1], a[2], c[0], c[1], c[2], e[0], e[1], e[2]
    );
  };
  for (let k = 0; k < rings.length - 1; k++) {
    const r0 = corners(rings[k]);
    const r1 = corners(rings[k + 1]);
    for (let i = 0; i < 4; i++) {
      const n = (i + 1) % 4;
      pushQuad(r0[i], r0[n], r1[n], r1[i]);
    }
  }
  const top = corners(rings[rings.length - 1]);
  pushQuad(top[0], top[1], top[2], top[3]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.computeVertexNormals();
  return applyBoxUVs(geo, uvScale);
}

function makePedimentGeo(THREE, w, h, d, r = 0.04) {
  const s = new THREE.Shape();
  const hw = w / 2;
  const cr = Math.min(0.12, h * 0.15);
  s.moveTo(-hw + cr, 0);
  s.lineTo(hw - cr, 0);
  s.quadraticCurveTo(hw, 0, hw - cr, cr * 0.55);
  s.lineTo(cr, h - cr * 0.55);
  s.quadraticCurveTo(0, h, -cr, h - cr * 0.55);
  s.lineTo(-hw + cr, cr * 0.55);
  s.quadraticCurveTo(-hw, 0, -hw + cr, 0);
  const depth = Math.max(0.02, d - 2 * r);
  const geo = new THREE.ExtrudeGeometry(s, {
    steps: 1,
    depth,
    bevelEnabled: true,
    bevelThickness: r,
    bevelSize: r,
    bevelSegments: 1,
    curveSegments: 2,
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return applyBoxUVs(geo, 0.35);
}

function makeColumnGeo(THREE, r, h) {
  const pts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(r * 1.48, 0),
    new THREE.Vector2(r * 1.48, h * 0.05),
    new THREE.Vector2(r * 1.28, h * 0.075),
    new THREE.Vector2(r * 1.06, h * 0.1),
    new THREE.Vector2(r * 1.0, h * 0.45),
    new THREE.Vector2(r * 0.88, h * 0.89),
    new THREE.Vector2(r * 1.08, h * 0.92),
    new THREE.Vector2(r * 1.42, h * 0.955),
    new THREE.Vector2(r * 1.42, h),
    new THREE.Vector2(0.001, h),
  ];
  const geo = new THREE.LatheGeometry(pts, 10);
  geo.computeVertexNormals();
  return geo;
}

function addMesh(THREE, parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, cast = true, recv = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (rx || ry || rz) m.rotation.set(rx, ry, rz);
  m.castShadow = cast;
  m.receiveShadow = recv;
  parent.add(m);
  return m;
}

function createTextures(THREE, kit, accent) {
  const makeTex = (w, h, fn, rx = 1, ry = 1) => {
    const tex = kit.canvasTexture(w, h, fn);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(rx, ry);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  const brick = makeTex(256, 256, (ctx, w, h) => {
    const rnd = makeRng(101);
    ctx.fillStyle = '#c8bfb0';
    ctx.fillRect(0, 0, w, h);
    const rows = 16;
    const cols = 8;
    const rh = h / rows;
    const cw = w / cols;
    const shades = ['#b37c6f', '#a77063', '#bd8677', '#9e695d', '#b78174'];
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (cw * 0.5);
      for (let c = -1; c <= cols; c++) {
        ctx.fillStyle = shades[Math.floor(rnd() * shades.length)];
        ctx.fillRect(c * cw + off + 1.5, r * rh + 1.5, cw - 3, rh - 3);
        ctx.fillStyle = `rgba(255,245,235,${(rnd() * 0.08).toFixed(3)})`;
        ctx.fillRect(c * cw + off + 2, r * rh + 2, cw - 4, rh * 0.35);
      }
    }
  });

  const limestone = makeTex(256, 256, (ctx, w, h) => {
    const rnd = makeRng(202);
    ctx.fillStyle = '#cfc5b4';
    ctx.fillRect(0, 0, w, h);
    const rows = 8;
    const cols = 4;
    const rh = h / rows;
    const cw = w / cols;
    const tones = ['#e6dcc9', '#dfd5c2', '#eae1cf', '#d9ceb9'];
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (cw * 0.5);
      for (let c = -1; c <= cols; c++) {
        ctx.fillStyle = tones[Math.floor(rnd() * tones.length)];
        ctx.fillRect(c * cw + off + 1.2, r * rh + 1.2, cw - 2.4, rh - 2.4);
      }
    }
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(110,95,75,0.06)';
      ctx.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 4, 2);
    }
  });

  const copper = makeTex(256, 256, (ctx, w, h) => {
    const rnd = makeRng(303);
    ctx.fillStyle = '#799c90';
    ctx.fillRect(0, 0, w, h);
    const seams = 12;
    const sw = w / seams;
    for (let i = 0; i < seams; i++) {
      const g = ctx.createLinearGradient(i * sw, 0, (i + 1) * sw, 0);
      g.addColorStop(0, '#6a8d81');
      g.addColorStop(0.2, '#86a99d');
      g.addColorStop(0.85, '#769a8e');
      g.addColorStop(1, '#5e7f74');
      ctx.fillStyle = g;
      ctx.fillRect(i * sw, 0, sw, h);
    }
    for (let i = 0; i < 320; i++) {
      ctx.fillStyle = rnd() > 0.45 ? 'rgba(180,215,200,0.09)' : 'rgba(55,80,72,0.08)';
      ctx.fillRect(rnd() * w, rnd() * h, 3, 6 + rnd() * 18);
    }
  });

  const brickPath = makeTex(256, 256, (ctx, w, h) => {
    const rnd = makeRng(404);
    ctx.fillStyle = '#d3c7b6';
    ctx.fillRect(0, 0, w, h);
    const rows = 16;
    const cols = 8;
    const rh = h / rows;
    const cw = w / cols;
    const tones = ['#bf8470', '#b47866', '#c78e7a', '#aa7160', '#c28976'];
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (cw * 0.5);
      for (let c = -1; c <= cols; c++) {
        ctx.fillStyle = tones[Math.floor(rnd() * tones.length)];
        ctx.fillRect(c * cw + off + 1.4, r * rh + 1.4, cw - 2.8, rh - 2.8);
      }
    }
  });

  const stonePaving = makeTex(256, 256, (ctx, w, h) => {
    const rnd = makeRng(505);
    ctx.fillStyle = '#c5bcb0';
    ctx.fillRect(0, 0, w, h);
    const rows = 6;
    const cols = 6;
    const rh = h / rows;
    const cw = w / cols;
    const tones = ['#ece6da', '#e5dfd1', '#f0ebe0', '#e0d9ca'];
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (cw * 0.5);
      for (let c = -1; c <= cols; c++) {
        ctx.fillStyle = tones[Math.floor(rnd() * tones.length)];
        ctx.fillRect(c * cw + off + 1.5, r * rh + 1.5, cw - 3, rh - 3);
      }
    }
  });

  const grass = makeTex(256, 256, (ctx, w, h) => {
    const rnd = makeRng(606);
    ctx.fillStyle = '#6f9a58';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(130,175,95,0.16)' : 'rgba(75,115,60,0.12)';
      ctx.fillRect(i * (w / 8), 0, w / 8, h);
    }
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(155,195,110,0.16)' : 'rgba(65,105,52,0.14)';
      ctx.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 3, 2 + rnd() * 3);
    }
  });

  const wood = makeTex(128, 128, (ctx, w, h) => {
    const rnd = makeRng(707);
    ctx.fillStyle = '#9b6b45';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(215,165,120,0.12)' : 'rgba(80,45,25,0.12)';
      ctx.fillRect(0, y, w, 2);
    }
  });

  const asphalt = makeTex(256, 256, (ctx, w, h) => {
    const rnd = makeRng(808);
    ctx.fillStyle = '#50555c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1200; i++) {
      const v = 65 + Math.floor(rnd() * 35);
      ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
      ctx.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
  });

  const banner = makeTex(64, 128, (ctx, w, h) => {
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(0, 0, w, h * 0.25);
    ctx.strokeStyle = 'rgba(255,252,245,0.85)';
    ctx.lineWidth = 4;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.fillStyle = 'rgba(255,252,245,0.9)';
    ctx.fillRect(10, h * 0.72, w - 20, 5);
    ctx.fillRect(16, h * 0.8, w - 32, 4);
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.42, 11, 0, Math.PI * 2);
    ctx.fill();
  }, 1, 1);

  const transit = makeTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f5f0e2';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e6decb';
    ctx.fillRect(8, 8, w - 16, h - 16);
    const drawLine = (col, pts) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 4, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    drawLine('#5b9bd5', [[20, 26], [54, 48], [96, 48], [108, 96]]);
    drawLine('#d96b5c', [[24, 98], [58, 72], [82, 26]]);
    drawLine('#6ea86b', [[18, 64], [54, 48], [94, 88]]);
  }, 1, 1);

  return { brick, limestone, copper, brickPath, stonePaving, grass, wood, asphalt, banner, transit };
}

function buildGroundAndPaths(THREE, root, mats) {
  // Base miniature diorama ground slab (64 x 40, top at y = -0.05)
  addMesh(THREE, root, makeBevelBox(THREE, 64, 1.2, 40, 0.14, 2, 0.14), mats.earthBase, 0, -0.66, 0, 0, 0, 0, false, true);
  // Campus turf cover from north edge (-20) to south fence (16.4)
  addMesh(THREE, root, makeBevelBox(THREE, 63.6, 0.12, 36.2, 0.04, 1, 0.18), mats.grass, 0, -0.09, -1.8, 0, 0, 0, false, true);

  // Helper for flat bevelled brick walkways (top at y = 0.0)
  const addPath = (w, d, x, z, ry = 0, mat = mats.brickPath) => {
    const geo = makeBevelBox(THREE, w, 0.1, d, 0.03, 1, 0.55);
    addMesh(THREE, root, geo, mat, x, -0.05, z, 0, ry, 0, false, true);
  };

  // Main South Gate Promenade (passing through HOME = [0, 0, 15])
  addPath(56, 2.0, 0, 15.0);
  // South Gate Entrance Plaza right around HOME
  addPath(6.8, 3.0, 0, 15.0, 0, mats.stonePaving);

  // West & East Main Campus Avenues (x = +/-12.6)
  addPath(2.2, 31.6, -12.6, 0.2);
  addPath(2.2, 31.6, 12.6, 0.2);

  // North Terrace Plaza & East-West Walk in front of Domed Library steps (z = -2.8)
  addPath(52, 1.9, 0, -2.8);
  addPath(17.4, 3.2, 0, -3.4, 0, mats.stonePaving);

  // Central East-West Brick Cross Walk (z = 3.9)
  addPath(28.0, 1.8, 0, 3.9);
  // Central North-South Brick Walk across lawn (x = 0)
  addPath(2.0, 14.6, 0, 3.6);

  // Diagonal X-shaped crossing brick paths across the central lawn
  const diagLen = 19.8;
  const diagAngle = Math.atan2(10.8, 17.8);
  addPath(diagLen, 1.25, 0, 3.9, diagAngle);
  addPath(diagLen, 1.25, 0, 3.9, -diagAngle);

  // Circular pale stone central plaza for Sundial at (0, 0, 3.9)
  const plazaGeo = new THREE.CylinderGeometry(2.35, 2.45, 0.11, 24);
  applyBoxUVs(plazaGeo, 0.4);
  addMesh(THREE, root, plazaGeo, mats.stonePaving, 0, -0.048, 3.9, 0, 0, 0, false, true);

  const ringGeo = new THREE.CylinderGeometry(1.72, 1.74, 0.116, 24);
  addMesh(THREE, root, ringGeo, mats.plotEdge, 0, -0.048, 3.9, 0, 0, 0, false, true);
  const innerDisk = new THREE.CylinderGeometry(1.56, 1.56, 0.12, 24);
  applyBoxUVs(innerDisk, 0.4);
  addMesh(THREE, root, innerDisk, mats.stonePaving, 0, -0.048, 3.9, 0, 0, 0, false, true);

  // Spurs from each of the 4 empty plots to the side avenues & cross-walks
  for (const side of [-1, 1]) {
    // North plots (z = -8) to avenue (x = +/-12.6) & to north cross-walk (z = -2.8)
    addPath(3.6, 2.0, side * 14.2, -8.0);
    addPath(2.0, 2.4, side * 20.0, -3.4);
    // South plots (z = 9) to avenue (x = +/-12.6) & to south promenade / garden walk
    addPath(3.6, 2.0, side * 14.2, 9.0);
    addPath(2.0, 2.6, side * 20.0, 14.0);
    // East-west garden path connecting north & south plots' cherry blossom pocket
    addPath(13.6, 1.4, side * 19.6, 0.5);
  }

  // Four Empty Paved Plots (9 wide x 8 deep, top flush at y = 0.0, darker edge + pale stone)
  const borderGeo = makeBevelBox(THREE, 9.0, 0.1, 8.0, 0.035, 1, 0.4);
  const innerGeo = makeBevelBox(THREE, 8.15, 0.106, 7.15, 0.03, 1, 0.4);
  for (const key of Object.keys(PLOTS)) {
    const [px, , pz] = PLOTS[key];
    addMesh(THREE, root, borderGeo, mats.plotEdge, px, -0.052, pz, 0, 0, 0, false, true);
    addMesh(THREE, root, innerGeo, mats.plotStone, px, -0.052, pz, 0, 0, 0, false, true);
  }
}

function buildDomedLibrary(THREE, root, mats, winCollector) {
  const g = new THREE.Group();
  root.add(g);

  // Very wide classical stone steps ascending from z = -3.8 to z = -7.8 (y = 0 -> 1.4)
  const stepCount = 7;
  for (let i = 0; i < stepCount; i++) {
    const yTop = ((i + 1) / stepCount) * 1.4;
    const zFront = -3.8 - i * 0.56;
    const depth = 4.2 - i * 0.56;
    const width = 13.6 - i * 0.14;
    const geo = makeBevelBox(THREE, width, 0.24, depth, 0.03, 1, 0.35);
    addMesh(THREE, g, geo, mats.limestone, 0, yTop - 0.12, zFront - depth / 2, 0, 0, 0, true, true);
  }

  // Stepped limestone cheek walls flanking the wide steps
  for (const s of [-1, 1]) {
    addMesh(THREE, g, makeBevelBox(THREE, 0.72, 0.85, 4.4, 0.04, 1, 0.35), mats.limestoneDark, s * 6.85, 0.42, -5.9);
    addMesh(THREE, g, makeBevelBox(THREE, 0.92, 1.05, 0.92, 0.05, 1, 0.35), mats.limestone, s * 6.85, 0.52, -3.75);
    // Decorative classical stone urns on bottom cheek pedestals
    const urnPts = [
      new THREE.Vector2(0.01, 0),
      new THREE.Vector2(0.22, 0),
      new THREE.Vector2(0.14, 0.12),
      new THREE.Vector2(0.28, 0.34),
      new THREE.Vector2(0.22, 0.5),
      new THREE.Vector2(0.28, 0.56),
      new THREE.Vector2(0.01, 0.56),
    ];
    addMesh(THREE, g, new THREE.LatheGeometry(urnPts, 10), mats.limestone, s * 6.85, 1.04, -3.75);
  }

  // Seated Bronze Statue on mid-step pedestal at (0, 0.7, -5.75)
  const statGroup = new THREE.Group();
  statGroup.position.set(0, 0.72, -5.75);
  g.add(statGroup);
  addMesh(THREE, statGroup, makeBevelBox(THREE, 1.24, 0.18, 1.24, 0.03, 1, 0.4), mats.limestoneDark, 0, 0.09, 0);
  addMesh(THREE, statGroup, makeBevelBox(THREE, 0.86, 0.68, 0.86, 0.04, 1, 0.4), mats.limestone, 0, 0.5, 0);
  addMesh(THREE, statGroup, makeBevelBox(THREE, 1.06, 0.12, 1.06, 0.03, 1, 0.4), mats.limestoneDark, 0, 0.88, 0);

  // Bronze throne + seated draped figure
  const by = 0.94;
  addMesh(THREE, statGroup, makeBevelBox(THREE, 0.54, 0.24, 0.48, 0.04, 1), mats.bronze, 0, by + 0.12, -0.04);
  addMesh(THREE, statGroup, makeBevelBox(THREE, 0.56, 0.64, 0.1, 0.03, 1), mats.bronze, 0, by + 0.34, -0.24);
  for (const s of [-1, 1]) {
    addMesh(THREE, statGroup, makeBevelBox(THREE, 0.08, 0.34, 0.42, 0.025, 1), mats.bronze, s * 0.24, by + 0.22, -0.04);
  }
  const robePts = [
    new THREE.Vector2(0.01, 0),
    new THREE.Vector2(0.24, 0),
    new THREE.Vector2(0.22, 0.25),
    new THREE.Vector2(0.16, 0.48),
    new THREE.Vector2(0.18, 0.68),
    new THREE.Vector2(0.09, 0.78),
    new THREE.Vector2(0.01, 0.8),
  ];
  addMesh(THREE, statGroup, new THREE.LatheGeometry(robePts, 10), mats.bronze, 0, by + 0.02, 0.05);
  addMesh(THREE, statGroup, new THREE.SphereGeometry(0.11, 10, 8), mats.bronze, 0, by + 0.89, 0.03);
  // Outstretched welcoming arms
  const armGeo = new THREE.CylinderGeometry(0.036, 0.045, 0.36, 7);
  addMesh(THREE, statGroup, armGeo, mats.bronze, -0.19, by + 0.64, 0.14, 0.7, 0, 0.55);
  addMesh(THREE, statGroup, armGeo, mats.bronze, 0.19, by + 0.64, 0.14, 0.7, 0, -0.55);
  // Subtle bronze sceptre
  addMesh(THREE, statGroup, new THREE.CylinderGeometry(0.016, 0.016, 0.88, 6), mats.bronze, 0.25, by + 0.46, 0.18, 0.12, 0, -0.08);

  // Main Limestone Building Base Podium & Greek-Cross Body (center z = -13.2)
  addMesh(THREE, g, makeBevelBox(THREE, 14.4, 1.45, 9.4, 0.06, 1, 0.32), mats.limestoneDark, 0, 0.72, -13.0);
  // Wide east-west body
  addMesh(THREE, g, makeBevelBox(THREE, 13.6, 3.9, 6.8, 0.07, 1, 0.32), mats.limestone, 0, 3.35, -13.2);
  // Central projecting north-south cross wing
  addMesh(THREE, g, makeBevelBox(THREE, 8.6, 4.1, 8.6, 0.07, 1, 0.32), mats.limestone, 0, 3.45, -13.2);
  // Projecting Cornice & Entablature band
  addMesh(THREE, g, makeBevelBox(THREE, 14.1, 0.42, 7.3, 0.05, 1, 0.35), mats.limestoneDark, 0, 5.42, -13.2);
  addMesh(THREE, g, makeBevelBox(THREE, 9.1, 0.46, 9.1, 0.05, 1, 0.35), mats.limestoneDark, 0, 5.52, -13.2);

  // Grand South Portico Colonnade (8 Ionic columns at z = -8.25)
  const colGeo = makeColumnGeo(THREE, 0.22, 3.95);
  for (let i = 0; i < 8; i++) {
    const cx = -4.2 + i * 1.2;
    addMesh(THREE, g, colGeo, mats.limestone, cx, 1.42, -8.25);
  }
  // Portico Entablature & Triangular Classical Pediment
  addMesh(THREE, g, makeBevelBox(THREE, 9.6, 0.56, 1.35, 0.05, 1, 0.35), mats.limestone, 0, 5.55, -8.45);
  addMesh(THREE, g, makePedimentGeo(THREE, 9.5, 1.45, 1.2, 0.05), mats.limestone, 0, 5.82, -8.45);
  // Grand Recessed Bronze Entrance Doorway behind columns
  addMesh(THREE, g, makeBevelBox(THREE, 2.2, 2.6, 0.22, 0.04, 1), mats.bronze, 0, 2.7, -8.92);
  addMesh(THREE, g, makeBevelBox(THREE, 1.65, 2.2, 0.24, 0.03, 1), mats.winLit, 0, 2.65, -8.9, 0, 0, 0, false, false);

  // Attic Plinth, Drum & Saucer Dome rising to ~9.1 high
  addMesh(THREE, g, makeBevelBox(THREE, 7.1, 0.72, 7.1, 0.08, 1, 0.35), mats.limestone, 0, 6.02, -13.2);
  const drumPts = [
    new THREE.Vector2(3.35, 0),
    new THREE.Vector2(3.35, 0.22),
    new THREE.Vector2(3.15, 0.32),
    new THREE.Vector2(3.12, 1.05),
    new THREE.Vector2(3.32, 1.15),
    new THREE.Vector2(3.32, 1.3),
    new THREE.Vector2(3.05, 1.35),
  ];
  addMesh(THREE, g, new THREE.LatheGeometry(drumPts, 24), mats.limestone, 0, 6.26, -13.2);

  // Saucer Dome in soft weathered stone-copper patina
  const domePts = [];
  const domeSteps = 12;
  for (let i = 0; i <= domeSteps; i++) {
    const t = i / domeSteps;
    const ang = t * (Math.PI * 0.5);
    const rad = Math.cos(ang) * 3.05;
    const yy = Math.sin(ang) * 1.48;
    domePts.push(new THREE.Vector2(Math.max(0.01, rad), yy));
  }
  addMesh(THREE, g, new THREE.LatheGeometry(domePts, 24), mats.domeCopper, 0, 7.56, -13.2);

  // Cupola Lantern & Finial on top of dome (y = 8.95..9.35)
  const capPts = [
    new THREE.Vector2(0.62, 0),
    new THREE.Vector2(0.56, 0.16),
    new THREE.Vector2(0.45, 0.28),
    new THREE.Vector2(0.18, 0.42),
    new THREE.Vector2(0.02, 0.55),
  ];
  addMesh(THREE, g, new THREE.LatheGeometry(capPts, 14), mats.limestone, 0, 8.92, -13.2);

  // Warm Clerestory Windows around the Drum (12 evenly spaced)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const wx = Math.sin(a) * 3.13;
    const wz = -13.2 + Math.cos(a) * 3.13;
    winCollector.push({ x: wx, y: 6.95, z: wz, ry: a, sx: 0.9, sy: 0.75, forceLit: true });
  }
  // Wing windows on east, west & south flanks
  for (const s of [-1, 1]) {
    winCollector.push({ x: s * 5.4, y: 3.35, z: -9.8, ry: 0, sx: 1.15, sy: 1.5 });
    winCollector.push({ x: s * 6.8, y: 3.35, z: -12.0, ry: s * Math.PI * 0.5, sx: 1.15, sy: 1.5 });
    winCollector.push({ x: s * 6.8, y: 3.35, z: -14.4, ry: s * Math.PI * 0.5, sx: 1.15, sy: 1.5 });
  }
}

function buildSouthLibrary(THREE, root, mats, winCollector) {
  // Long Colonnaded Library Facade about 5 high on the south side of the lawn (z = 12.2)
  const g = new THREE.Group();
  g.position.set(0, 0, 12.2);
  root.add(g);

  // Raised podium & broad low steps on both north (lawn) and south (HOME) faces
  addMesh(THREE, g, makeBevelBox(THREE, 18.6, 0.36, 3.5, 0.04, 1, 0.35), mats.limestoneDark, 0, 0.18, 0);
  addMesh(THREE, g, makeBevelBox(THREE, 13.0, 0.18, 4.1, 0.03, 1, 0.35), mats.limestone, 0, 0.09, 0);

  // Main Limestone Building Volume (width 17.8, height 4.15, depth 2.55)
  addMesh(THREE, g, makeBevelBox(THREE, 17.8, 4.1, 2.55, 0.06, 1, 0.32), mats.limestone, 0, 2.38, 0);
  // Cornice & Classical Attic Parapet (total height ~5.1)
  addMesh(THREE, g, makeBevelBox(THREE, 18.4, 0.34, 3.15, 0.05, 1, 0.35), mats.limestoneDark, 0, 4.56, 0);
  addMesh(THREE, g, makeBevelBox(THREE, 17.6, 0.44, 2.5, 0.05, 1, 0.35), mats.limestone, 0, 4.92, 0);
  // Subtle copper roof crown tucked behind parapet
  addMesh(THREE, g, makeHippedRoofGeo(THREE, 15.8, 0.48, 1.8, 0.45), mats.copper, 0, 5.05, 0);

  // Colonnade on North & South Facades using InstancedMesh (12 per side = 24 columns)
  const colGeo = makeColumnGeo(THREE, 0.16, 4.0);
  const colInst = new THREE.InstancedMesh(colGeo, mats.limestone, 24);
  colInst.castShadow = true;
  colInst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  let idx = 0;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 12; i++) {
      const cx = -7.7 + i * 1.4;
      dummy.position.set(cx, 0.36, side * 1.44);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      colInst.setMatrixAt(idx++, dummy.matrix);
    }
  }
  colInst.instanceMatrix.needsUpdate = true;
  g.add(colInst);

  // Tall Inset Windows behind the Colonnade (North & South faces)
  for (const side of [-1, 1]) {
    const ry = side > 0 ? 0 : Math.PI;
    for (let i = 0; i < 9; i++) {
      const wx = -6.4 + i * 1.6;
      winCollector.push({ x: wx, y: 2.5, z: 12.2 + side * 1.28, ry, sx: 1.05, sy: 1.85 });
    }
  }
  for (const s of [-1, 1]) {
    winCollector.push({ x: s * 8.9, y: 2.5, z: 12.2, ry: s * Math.PI * 0.5, sx: 1.1, sy: 1.7 });
  }
}

function buildRedBrickHalls(THREE, root, mats, winCollector) {
  // 5 Symmetrical Pairs of McKim-style Red-Brick Halls (height 4.5 to 6.6)
  // Carefully clear of all 4 plots (9x8 at +/-20, -8 and +/-20, 9) and walkways
  const specs = [
    // Pair 1: North flanking halls
    { x: -14.6, z: -16.2, w: 8.4, d: 4.2, wallH: 4.5, roofH: 1.35, cupola: true, face: 'S' },
    { x: 14.6, z: -16.2, w: 8.4, d: 4.2, wallH: 4.5, roofH: 1.35, cupola: true, face: 'S' },
    // Pair 2: North corner halls
    { x: -26.4, z: -16.2, w: 7.4, d: 4.2, wallH: 3.8, roofH: 1.15, cupola: false, face: 'S' },
    { x: 26.4, z: -16.2, w: 7.4, d: 4.2, wallH: 3.8, roofH: 1.15, cupola: false, face: 'S' },
    // Pair 3: Outer West/East North halls
    { x: -28.6, z: -8.0, w: 4.4, d: 7.8, wallH: 4.3, roofH: 1.25, cupola: false, face: 'E' },
    { x: 28.6, z: -8.0, w: 4.4, d: 7.8, wallH: 4.3, roofH: 1.25, cupola: false, face: 'W' },
    // Pair 4: Outer West/East Mid pavilions
    { x: -28.6, z: 0.5, w: 4.0, d: 5.2, wallH: 3.4, roofH: 1.05, cupola: false, face: 'E' },
    { x: 28.6, z: 0.5, w: 4.0, d: 5.2, wallH: 3.4, roofH: 1.05, cupola: false, face: 'W' },
    // Pair 5: Outer West/East South halls
    { x: -28.6, z: 9.0, w: 4.4, d: 8.0, wallH: 4.8, roofH: 1.35, cupola: true, face: 'E' },
    { x: 28.6, z: 9.0, w: 4.4, d: 8.0, wallH: 4.8, roofH: 1.35, cupola: true, face: 'W' },
  ];

  const dormerGeo = makeBevelBox(THREE, 0.72, 0.65, 0.68, 0.03, 1, 0.4);
  const dormerRoof = makePedimentGeo(THREE, 0.84, 0.36, 0.74, 0.025);
  const chimGeo = makeBevelBox(THREE, 0.52, 0.85, 0.52, 0.03, 1, 0.4);
  const chimCap = makeBevelBox(THREE, 0.62, 0.1, 0.62, 0.02, 1, 0.4);

  for (const h of specs) {
    const g = new THREE.Group();
    g.position.set(h.x, 0, h.z);
    root.add(g);

    // Limestone rusticated base plinth
    addMesh(THREE, g, makeBevelBox(THREE, h.w + 0.16, 0.78, h.d + 0.16, 0.04, 1, 0.35), mats.hallLimestone, 0, 0.39, 0);
    // Main desaturated red-brick mass
    addMesh(THREE, g, makeBevelBox(THREE, h.w, h.wallH - 0.7, h.d, 0.06, 1, 0.42), mats.hallBrick, 0, 0.75 + (h.wallH - 0.7) / 2, 0);
    // Limestone belt stringcourse & projecting cornice
    addMesh(THREE, g, makeBevelBox(THREE, h.w + 0.14, 0.14, h.d + 0.14, 0.03, 1, 0.35), mats.hallLimestone, 0, h.wallH * 0.56, 0);
    addMesh(THREE, g, makeBevelBox(THREE, h.w + 0.36, 0.24, h.d + 0.36, 0.04, 1, 0.35), mats.hallLimestone, 0, h.wallH + 0.04, 0);

    // Hipped Copper-Green Roof + rounded ridge roll
    addMesh(THREE, g, makeHippedRoofGeo(THREE, h.w + 0.28, h.roofH, h.d + 0.28, 0.42), mats.copper, 0, h.wallH + 0.14, 0);
    const alongX = h.w >= h.d;
    const ridgeLen = Math.max(0.4, Math.abs(h.w - h.d) * 0.96);
    const ridgeGeo = new THREE.CylinderGeometry(0.075, 0.075, ridgeLen, 7);
    addMesh(THREE, g, ridgeGeo, mats.copperDark, 0, h.wallH + 0.14 + h.roofH, 0, alongX ? 0 : Math.PI / 2, 0, alongX ? Math.PI / 2 : 0);

    // Petite copper cupola on taller landmark halls
    if (h.cupola) {
      const cy = h.wallH + h.roofH + 0.1;
      addMesh(THREE, g, new THREE.CylinderGeometry(0.36, 0.42, 0.42, 8), mats.hallLimestone, 0, cy + 0.16, 0);
      addMesh(THREE, g, new THREE.ConeGeometry(0.44, 0.45, 8), mats.copperDark, 0, cy + 0.56, 0);
    }

    // Brick chimneys
    const cOff = alongX ? h.w * 0.28 : h.d * 0.28;
    for (const s of [-1, 1]) {
      const cx = alongX ? s * cOff : 0;
      const cz = alongX ? 0 : s * cOff;
      addMesh(THREE, g, chimGeo, mats.hallBrick, cx, h.wallH + h.roofH * 0.65, cz);
      addMesh(THREE, g, chimCap, mats.hallLimestone, cx, h.wallH + h.roofH * 0.65 + 0.44, cz);
    }

    // Small inward-facing limestone entrance surround & roof dormers
    const fDir = h.face === 'S' ? [0, 1] : h.face === 'E' ? [1, 0] : [-1, 0];
    const fRy = h.face === 'S' ? 0 : h.face === 'E' ? Math.PI / 2 : -Math.PI / 2;
    const pDist = h.face === 'S' ? h.d / 2 : h.w / 2;
    addMesh(THREE, g, makeBevelBox(THREE, 1.35, 1.55, 0.34, 0.04, 1, 0.4), mats.hallLimestone, fDir[0] * (pDist + 0.1), 0.78, fDir[1] * (pDist + 0.1), 0, fRy, 0);
    addMesh(THREE, g, makePedimentGeo(THREE, 1.5, 0.46, 0.4, 0.03), mats.hallLimestone, fDir[0] * (pDist + 0.12), 1.54, fDir[1] * (pDist + 0.12), 0, fRy, 0);
    addMesh(THREE, g, makeBevelBox(THREE, 0.76, 1.15, 0.12, 0.02, 1), mats.wood, fDir[0] * (pDist + 0.24), 0.62, fDir[1] * (pDist + 0.24), 0, fRy, 0);

    // Pair of cozy roof dormers on main inward face
    const dSpan = (alongX ? h.w : h.d) * 0.24;
    for (const s of [-1, 1]) {
      const dx = fDir[0] * (pDist - 0.55) + (alongX ? s * dSpan : 0);
      const dz = fDir[1] * (pDist - 0.55) + (alongX ? 0 : s * dSpan);
      addMesh(THREE, g, dormerGeo, mats.hallLimestone, dx, h.wallH + 0.42, dz, 0, fRy, 0);
      addMesh(THREE, g, dormerRoof, mats.copperDark, dx, h.wallH + 0.74, dz, 0, fRy, 0);
    }

    // Collect regularly spaced windows for shared InstancedMesh
    const floors = h.wallH >= 4.2 ? [1.75, 3.25] : [1.7, 2.75];
    const mainLen = alongX ? h.w : h.d;
    const count = mainLen >= 7.2 ? 4 : 3;
    const spacing = (mainLen - 1.5) / Math.max(1, count - 1);
    for (const fy of floors) {
      for (let i = 0; i < count; i++) {
        const offset = -(mainLen - 1.5) / 2 + i * spacing;
        // Skip bottom center window where entrance door sits
        if (fy < 2.0 && Math.abs(offset) < 0.7) continue;
        if (alongX) {
          winCollector.push({ x: h.x + offset, y: fy, z: h.z + h.d / 2, ry: 0, sx: 1, sy: 1 });
          if (i === 0 || i === count - 1) {
            winCollector.push({ x: h.x + offset, y: fy, z: h.z - h.d / 2, ry: Math.PI, sx: 1, sy: 1 });
          }
        } else {
          const sxFace = h.face === 'E' ? 1 : -1;
          winCollector.push({ x: h.x + sxFace * (h.w / 2), y: fy, z: h.z + offset, ry: sxFace * Math.PI / 2, sx: 1, sy: 1 });
          if (i === 0 || i === count - 1) {
            winCollector.push({ x: h.x - sxFace * (h.w / 2), y: fy, z: h.z + offset, ry: -sxFace * Math.PI / 2, sx: 1, sy: 1 });
          }
        }
      }
      // End-wall accent windows
      if (alongX) {
        winCollector.push({ x: h.x - h.w / 2, y: fy, z: h.z, ry: -Math.PI / 2, sx: 0.95, sy: 1 });
        winCollector.push({ x: h.x + h.w / 2, y: fy, z: h.z, ry: Math.PI / 2, sx: 0.95, sy: 1 });
      } else {
        winCollector.push({ x: h.x, y: fy, z: h.z + h.d / 2, ry: 0, sx: 0.95, sy: 1 });
        winCollector.push({ x: h.x, y: fy, z: h.z - h.d / 2, ry: Math.PI, sx: 0.95, sy: 1 });
      }
    }
  }
}

function buildWindowsInstanced(THREE, root, mats, list, rng) {
  if (!list.length) return;

  // Build reusable chamfered limestone sill + lintel + recessed wood frame
  const sill = makeChamferBar(THREE, 0.6, 0.085, 0.14, 0.02, 0.5);
  sill.translate(0, -0.39, 0.06);
  const lintel = makeChamferBar(THREE, 0.58, 0.09, 0.11, 0.02, 0.5);
  lintel.translate(0, 0.39, 0.045);
  const trimGeo = mergeGeos(THREE, [sill, lintel]);

  // 4-part recessed frame surround (top, bottom, left, right)
  const left = makeChamferBar(THREE, 0.065, 0.72, 0.08, 0.014, 0.5);
  left.translate(-0.22, 0, 0.035);
  const right = makeChamferBar(THREE, 0.065, 0.72, 0.08, 0.014, 0.5);
  right.translate(0.22, 0, 0.035);
  const top = makeChamferBar(THREE, 0.48, 0.055, 0.08, 0.014, 0.5);
  top.translate(0, 0.33, 0.035);
  const mid = makeChamferBar(THREE, 0.42, 0.038, 0.06, 0.01, 0.5);
  mid.translate(0, 0.02, 0.03);
  const frameGeo = mergeGeos(THREE, [left, right, top, mid]);

  const paneGeo = new THREE.PlaneGeometry(0.41, 0.66);
  paneGeo.translate(0, 0, 0.018);

  const litList = [];
  const darkList = [];
  for (const w of list) {
    if (w.forceLit || rng() < 0.36) litList.push(w);
    else darkList.push(w);
  }

  const trimInst = new THREE.InstancedMesh(trimGeo, mats.hallLimestone, list.length);
  const frameInst = new THREE.InstancedMesh(frameGeo, mats.winFrame, list.length);
  const litInst = new THREE.InstancedMesh(paneGeo, mats.winLit, Math.max(1, litList.length));
  const darkInst = new THREE.InstancedMesh(paneGeo, mats.winDark, Math.max(1, darkList.length));

  trimInst.castShadow = true;
  trimInst.receiveShadow = true;
  frameInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  list.forEach((w, i) => {
    dummy.position.set(w.x, w.y, w.z);
    dummy.rotation.set(0, w.ry, 0);
    dummy.scale.set(w.sx, w.sy, 1);
    dummy.updateMatrix();
    trimInst.setMatrixAt(i, dummy.matrix);
    frameInst.setMatrixAt(i, dummy.matrix);
  });
  litList.forEach((w, i) => {
    dummy.position.set(w.x, w.y, w.z);
    dummy.rotation.set(0, w.ry, 0);
    dummy.scale.set(w.sx, w.sy, 1);
    dummy.updateMatrix();
    litInst.setMatrixAt(i, dummy.matrix);
  });
  darkList.forEach((w, i) => {
    dummy.position.set(w.x, w.y, w.z);
    dummy.rotation.set(0, w.ry, 0);
    dummy.scale.set(w.sx, w.sy, 1);
    dummy.updateMatrix();
    darkInst.setMatrixAt(i, dummy.matrix);
  });

  trimInst.instanceMatrix.needsUpdate = true;
  frameInst.instanceMatrix.needsUpdate = true;
  litInst.instanceMatrix.needsUpdate = true;
  darkInst.instanceMatrix.needsUpdate = true;

  root.add(trimInst, frameInst);
  if (litList.length) root.add(litInst);
  if (darkList.length) root.add(darkInst);
}

function buildSundialAndHedges(THREE, root, mats) {
  // Sundial at central lawn crossing (0, 0, 3.9)
  const sd = new THREE.Group();
  sd.position.set(0, 0, 3.9);
  root.add(sd);

  addMesh(THREE, sd, new THREE.CylinderGeometry(0.84, 0.9, 0.14, 18), mats.limestoneDark, 0, 0.07, 0);
  addMesh(THREE, sd, new THREE.CylinderGeometry(0.6, 0.66, 0.14, 18), mats.limestone, 0, 0.21, 0);
  const pedPts = [
    new THREE.Vector2(0.01, 0),
    new THREE.Vector2(0.42, 0),
    new THREE.Vector2(0.36, 0.14),
    new THREE.Vector2(0.24, 0.26),
    new THREE.Vector2(0.21, 0.68),
    new THREE.Vector2(0.32, 0.8),
    new THREE.Vector2(0.44, 0.86),
    new THREE.Vector2(0.44, 0.96),
    new THREE.Vector2(0.01, 0.96),
  ];
  addMesh(THREE, sd, new THREE.LatheGeometry(pedPts, 16), mats.limestone, 0, 0.28, 0);
  // Bronze sundial plate & gnomon
  addMesh(THREE, sd, new THREE.CylinderGeometry(0.4, 0.42, 0.05, 16), mats.bronze, 0, 1.26, 0);
  const gnomonShape = new THREE.Shape();
  gnomonShape.moveTo(0, 0);
  gnomonShape.lineTo(0.32, 0);
  gnomonShape.lineTo(0.04, 0.38);
  gnomonShape.quadraticCurveTo(0.0, 0.36, 0, 0);
  const gnomonGeo = new THREE.ExtrudeGeometry(gnomonShape, {
    steps: 1,
    depth: 0.03,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 1,
  });
  gnomonGeo.translate(-0.14, 0, -0.015);
  addMesh(THREE, sd, gnomonGeo, mats.bronzeBright, 0, 1.28, 0, 0, Math.PI / 2, 0);

  // Softly bevelled manicured boxwood hedges framing the central lawn panels
  const hedgeRuns = [
    // North edge of central lawn (z = -1.65)
    { w: 6.2, d: 0.52, x: -6.4, z: -1.65 },
    { w: 6.2, d: 0.52, x: 6.4, z: -1.65 },
    // South edge of central lawn (z = 9.55)
    { w: 6.2, d: 0.52, x: -6.4, z: 9.55 },
    { w: 6.2, d: 0.52, x: 6.4, z: 9.55 },
    // West & East edges of central lawn (x = +/-10.75)
    { w: 0.52, d: 3.4, x: -10.75, z: 0.4 },
    { w: 0.52, d: 3.4, x: 10.75, z: 0.4 },
    { w: 0.52, d: 3.4, x: -10.75, z: 7.4 },
    { w: 0.52, d: 3.4, x: 10.75, z: 7.4 },
    // Low hedges flanking south library wings
    { w: 0.5, d: 2.2, x: -10.6, z: 12.2 },
    { w: 0.5, d: 2.2, x: 10.6, z: 12.2 },
    // Cherry blossom pocket garden framing hedges
    { w: 3.6, d: 0.48, x: -20.0, z: -2.4 },
    { w: 3.6, d: 0.48, x: 20.0, z: -2.4 },
    { w: 3.6, d: 0.48, x: -20.0, z: 3.4 },
    { w: 3.6, d: 0.48, x: 20.0, z: 3.4 },
  ];
  for (const h of hedgeRuns) {
    addMesh(THREE, root, makeBevelBox(THREE, h.w, 0.54, h.d, 0.14, 2, 0.5), mats.hedge, h.x, 0.24, h.z);
  }
}

function buildGatesAndStreet(THREE, root, mats, accent) {
  // South Sidewalk (z = 16.4..17.65, top at y = 0.0) & Curb
  addMesh(THREE, root, makeBevelBox(THREE, 64, 0.14, 1.35, 0.035, 1, 0.38), mats.stonePaving, 0, -0.07, 17.0, 0, 0, 0, false, true);
  // Street Asphalt beyond the sidewalk (z = 17.65..20.0, recessed to y = -0.06)
  addMesh(THREE, root, makeBevelBox(THREE, 64, 0.1, 2.4, 0.025, 1, 0.3), mats.asphalt, 0, -0.11, 18.82, 0, 0, 0, false, true);

  // Dashed yellow road centerline & soft white crosswalk stripes
  const dashGeo = makeBevelBox(THREE, 1.6, 0.02, 0.1, 0.006, 1);
  const dashInst = new THREE.InstancedMesh(dashGeo, mats.roadYellow, 18);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 18; i++) {
    dummy.position.set(-29.5 + i * 3.45, -0.055, 18.82);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    dashInst.setMatrixAt(i, dummy.matrix);
  }
  dashInst.instanceMatrix.needsUpdate = true;
  root.add(dashInst);

  // Crosswalk at main south gate (x = 0)
  const stripeGeo = makeBevelBox(THREE, 0.34, 0.02, 1.75, 0.008, 1);
  for (let i = -3; i <= 3; i++) {
    addMesh(THREE, root, stripeGeo, mats.roadWhite, i * 0.65, -0.055, 18.82, 0, 0, 0, false, true);
  }

  // Iron Gates & Brick-Pier Perimeter Fence along z = 16.3
  const fz = 16.3;
  // Fence spans avoiding Central Gate (-2.4..2.4) and Side Gates (+/-11.4..+/-13.8)
  const spans = [
    [-31.2, -13.8],
    [-11.4, -2.4],
    [2.4, 11.4],
    [13.8, 31.2],
  ];
  const picketPositions = [];
  for (const [x0, x1] of spans) {
    const len = x1 - x0;
    const mid = (x0 + x1) / 2;
    // Low bevelled brick & limestone knee wall
    addMesh(THREE, root, makeBevelBox(THREE, len, 0.44, 0.34, 0.03, 1, 0.45), mats.hallBrick, mid, 0.22, fz);
    addMesh(THREE, root, makeBevelBox(THREE, len + 0.08, 0.1, 0.42, 0.025, 1, 0.4), mats.hallLimestone, mid, 0.47, fz);
    // Top & bottom iron rails
    addMesh(THREE, root, makeBevelBox(THREE, len, 0.06, 0.06, 0.015, 1), mats.iron, mid, 1.56, fz);
    addMesh(THREE, root, makeBevelBox(THREE, len, 0.05, 0.05, 0.015, 1), mats.iron, mid, 0.64, fz);
    // Collect picket x coordinates
    const n = Math.floor(len / 0.42);
    for (let i = 1; i < n; i++) {
      picketPositions.push(x0 + (i / n) * len);
    }
  }

  // Instanced wrought-iron fence pickets
  const picketGeo = new THREE.CylinderGeometry(0.022, 0.026, 1.18, 5);
  const picketInst = new THREE.InstancedMesh(picketGeo, mats.iron, picketPositions.length);
  picketInst.castShadow = true;
  picketPositions.forEach((px, i) => {
    dummy.position.set(px, 1.12, fz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    picketInst.setMatrixAt(i, dummy.matrix);
  });
  picketInst.instanceMatrix.needsUpdate = true;
  root.add(picketInst);

  // Brick & Limestone Gate Piers
  const pierXs = [-31.2, -22.5, -13.8, -11.4, -6.9, -2.4, 2.4, 6.9, 11.4, 13.8, 22.5, 31.2];
  const pierBody = makeBevelBox(THREE, 0.72, 2.05, 0.72, 0.04, 1, 0.42);
  const pierCap = makeBevelBox(THREE, 0.88, 0.16, 0.88, 0.04, 1, 0.4);
  const pierBase = makeBevelBox(THREE, 0.84, 0.36, 0.84, 0.04, 1, 0.4);
  const globeGeo = new THREE.SphereGeometry(0.17, 10, 8);
  for (const px of pierXs) {
    const isMain = Math.abs(px) === 2.4 || Math.abs(px) === 11.4 || Math.abs(px) === 13.8;
    const hScale = Math.abs(px) === 2.4 ? 1.18 : isMain ? 1.04 : 0.88;
    addMesh(THREE, root, pierBase, mats.hallLimestone, px, 0.18, fz);
    const body = addMesh(THREE, root, pierBody, mats.hallBrick, px, 0.28 + 1.02 * hScale, fz);
    body.scale.y = hScale;
    const topY = 0.28 + 2.05 * hScale;
    addMesh(THREE, root, pierCap, mats.hallLimestone, px, topY + 0.06, fz);
    if (isMain) {
      addMesh(THREE, root, new THREE.CylinderGeometry(0.05, 0.09, 0.22, 8), mats.iron, px, topY + 0.22, fz);
      addMesh(THREE, root, globeGeo, mats.lanternGlow, px, topY + 0.44, fz, 0, 0, 0, false, false);
    }
  }

  // Ornate Wrought-Iron Archway over Central Gate (-2.4..2.4) & open gate leaves
  const archCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.35, 2.4, fz),
    new THREE.Vector3(-1.3, 3.25, fz),
    new THREE.Vector3(0, 3.55, fz),
    new THREE.Vector3(1.3, 3.25, fz),
    new THREE.Vector3(2.35, 2.4, fz),
  ]);
  addMesh(THREE, root, new THREE.TubeGeometry(archCurve, 20, 0.065, 6, false), mats.iron);
  const innerArch = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.2, 2.15, fz),
    new THREE.Vector3(-1.1, 2.85, fz),
    new THREE.Vector3(0, 3.08, fz),
    new THREE.Vector3(1.1, 2.85, fz),
    new THREE.Vector3(2.2, 2.15, fz),
  ]);
  addMesh(THREE, root, new THREE.TubeGeometry(innerArch, 18, 0.04, 6, false), mats.iron);
  // Decorative central crest medallion (pure geometry, no text)
  addMesh(THREE, root, new THREE.TorusGeometry(0.24, 0.04, 7, 14), mats.iron, 0, 3.3, fz);
  addMesh(THREE, root, new THREE.CylinderGeometry(0.18, 0.18, 0.06, 12), mats.bronzeBright, 0, 3.3, fz, Math.PI / 2, 0, 0);

  // Welcoming swung-open iron gate leaves flanking central gate
  for (const s of [-1, 1]) {
    const leaf = new THREE.Group();
    leaf.position.set(s * 2.1, 0, fz);
    leaf.rotation.y = s * 1.15;
    root.add(leaf);
    addMesh(THREE, leaf, makeBevelBox(THREE, 1.55, 0.06, 0.05, 0.012, 1), mats.iron, -s * 0.78, 1.65, 0);
    addMesh(THREE, leaf, makeBevelBox(THREE, 1.55, 0.06, 0.05, 0.012, 1), mats.iron, -s * 0.78, 0.35, 0);
    for (let k = 0; k < 5; k++) {
      addMesh(THREE, leaf, picketGeo, mats.iron, -s * (0.18 + k * 0.32), 1.02, 0);
    }
  }

  // Stylized NYC Bus Shelter on South Sidewalk at (6.4, 0, 17.05)
  const bs = new THREE.Group();
  bs.position.set(6.4, 0, 17.02);
  root.add(bs);
  // Dark iron vertical posts
  const postGeo = new THREE.CylinderGeometry(0.045, 0.05, 1.48, 8);
  for (const px of [-1.25, 0, 1.25]) {
    addMesh(THREE, bs, postGeo, mats.iron, px, 0.74, -0.34);
  }
  addMesh(THREE, bs, postGeo, mats.iron, -1.25, 0.74, 0.32);
  addMesh(THREE, bs, postGeo, mats.iron, 1.25, 0.74, 0.32);
  // Gently curved barrel-vault shelter roof
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-0.56, 0);
  roofShape.quadraticCurveTo(0, 0.24, 0.56, 0);
  roofShape.lineTo(0.56, -0.07);
  roofShape.quadraticCurveTo(0, 0.15, -0.56, -0.07);
  roofShape.closePath();
  const bsRoof = new THREE.ExtrudeGeometry(roofShape, {
    steps: 1,
    depth: 2.9,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.025,
    bevelSegments: 1,
    curveSegments: 8,
  });
  bsRoof.translate(0, 0, -1.45);
  bsRoof.rotateY(Math.PI / 2);
  addMesh(THREE, bs, bsRoof, mats.iron, 0, 1.48, 0);
  // Translucent tinted glass windbreak panels
  addMesh(THREE, bs, makeBevelBox(THREE, 2.42, 1.15, 0.04, 0.01, 1), mats.shelterGlass, 0, 0.78, -0.34, 0, 0, 0, false, true);
  addMesh(THREE, bs, makeBevelBox(THREE, 0.04, 1.15, 0.6, 0.01, 1), mats.shelterGlass, -1.25, 0.78, -0.02, 0, 0, 0, false, true);
  // Illuminated abstract transit-map display box on right end (NO text)
  addMesh(THREE, bs, makeBevelBox(THREE, 0.14, 1.18, 0.64, 0.03, 1), mats.iron, 1.25, 0.78, -0.02);
  addMesh(THREE, bs, new THREE.PlaneGeometry(0.5, 0.96), mats.transitPanel, 1.33, 0.78, -0.02, 0, Math.PI / 2, 0, false, false);
  // Warm wooden waiting bench inside bus shelter
  addMesh(THREE, bs, makeBevelBox(THREE, 1.75, 0.07, 0.34, 0.02, 1, 0.8), mats.wood, -0.1, 0.42, -0.14);
  for (const bx of [-0.75, 0.55]) {
    addMesh(THREE, bs, makeBevelBox(THREE, 0.08, 0.4, 0.28, 0.015, 1), mats.iron, bx, 0.2, -0.14);
  }
  // Cute round bus-stop marker pole beside shelter (no text)
  addMesh(THREE, bs, new THREE.CylinderGeometry(0.03, 0.035, 1.7, 7), mats.iron, 1.85, 0.85, 0.34);
  const stopDiscMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.45, metalness: 0.1 });
  addMesh(THREE, bs, new THREE.CylinderGeometry(0.18, 0.18, 0.05, 14), stopDiscMat, 1.85, 1.62, 0.34, Math.PI / 2, 0, 0);
}

function buildTrees(THREE, root, mats, rng) {
  // Smooth tapered trunk geometry (shared by plane & cherry trees)
  const trunkPts = [
    new THREE.Vector2(0.01, 0),
    new THREE.Vector2(0.24, 0),
    new THREE.Vector2(0.16, 0.35),
    new THREE.Vector2(0.12, 1.25),
    new THREE.Vector2(0.09, 1.85),
    new THREE.Vector2(0.01, 1.92),
  ];
  const trunkGeo = new THREE.LatheGeometry(trunkPts, 7);
  trunkGeo.computeVertexNormals();

  // Billowy stylized 3-puff rounded canopy geometry
  const makeCanopyGeo = (r0, r1, r2) => {
    const p0 = new THREE.SphereGeometry(r0, 8, 6);
    p0.scale(1.06, 0.84, 1.06);
    p0.translate(0, 2.25, 0);

    const p1 = new THREE.SphereGeometry(r1, 7, 5);
    p1.scale(1.05, 0.82, 1.0);
    p1.translate(r0 * 0.56, 1.95, r0 * 0.24);

    const p2 = new THREE.SphereGeometry(r2, 7, 5);
    p2.scale(1.0, 0.84, 1.05);
    p2.translate(-r0 * 0.52, 2.02, -r0 * 0.28);

    const g = mergeGeos(THREE, [p0, p1, p2]);
    g.computeVertexNormals();
    return g;
  };

  const planeCanopyGeo = makeCanopyGeo(1.12, 0.78, 0.74);
  const cherryCanopyGeo = makeCanopyGeo(0.95, 0.68, 0.64);

  const planeCoords = [
    // Street trees along south sidewalk
    [-26.5, 17.0], [-18.5, 17.0], [-9.8, 17.0], [9.8, 17.0], [18.5, 17.0], [26.5, 17.0],
    // Central lawn corner shade trees
    [-9.4, -0.8], [9.4, -0.8], [-9.4, 8.6], [9.4, 8.6],
    // Mid east-west corridor framing trees
    [-16.0, 0.5], [16.0, 0.5], [-24.4, 0.5], [24.4, 0.5],
    // North quad & corner shade trees
    [-9.0, -14.8], [9.0, -14.8], [-20.8, -16.2], [20.8, -16.2],
    // South flanking trees
    [-10.4, 11.8], [10.4, 11.8], [-25.4, 14.7], [25.4, 14.7],
  ];

  const cherryCoords = [
    // Flanking domed library steps
    [-8.9, -6.2], [8.9, -6.2], [-8.9, -9.8], [8.9, -9.8],
    // Framing central lawn paths
    [-5.5, -1.0], [5.5, -1.0], [-5.5, 8.7], [5.5, 8.7],
    // Cherry blossom pocket gardens between north & south plots
    [-20.0, -1.2], [20.0, -1.2], [-20.0, 2.2], [20.0, 2.2],
    // South outer blossoms
    [-17.4, 14.7], [17.4, 14.7], [-22.6, 14.7], [22.6, 14.7],
  ];

  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  // Instanced Plane Trees
  const pTrunks = new THREE.InstancedMesh(trunkGeo, mats.planeBark, planeCoords.length);
  const pCanopies = new THREE.InstancedMesh(planeCanopyGeo, mats.foliageBase, planeCoords.length);
  pTrunks.castShadow = true;
  pTrunks.receiveShadow = true;
  pCanopies.castShadow = true;
  pCanopies.receiveShadow = true;
  const planePalette = [0x6c9452, 0x7aa35c, 0x608749, 0x749c56];
  planeCoords.forEach(([x, z], i) => {
    const s = 0.88 + rng() * 0.24;
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, rng() * Math.PI * 2, 0);
    dummy.scale.set(s, s * (0.95 + rng() * 0.14), s);
    dummy.updateMatrix();
    pTrunks.setMatrixAt(i, dummy.matrix);
    pCanopies.setMatrixAt(i, dummy.matrix);
    col.setHex(planePalette[i % planePalette.length]);
    pCanopies.setColorAt(i, col);
  });
  pTrunks.instanceMatrix.needsUpdate = true;
  pCanopies.instanceMatrix.needsUpdate = true;
  pCanopies.instanceColor.needsUpdate = true;
  root.add(pTrunks, pCanopies);

  // Instanced Cherry Trees
  const cTrunks = new THREE.InstancedMesh(trunkGeo, mats.cherryBark, cherryCoords.length);
  const cCanopies = new THREE.InstancedMesh(cherryCanopyGeo, mats.foliageBase, cherryCoords.length);
  cTrunks.castShadow = true;
  cTrunks.receiveShadow = true;
  cCanopies.castShadow = true;
  cCanopies.receiveShadow = true;
  const cherryPalette = [0xf2bcc9, 0xf7d3dc, 0xedb0c0, 0xf6c9d4];
  cherryCoords.forEach(([x, z], i) => {
    const s = 0.78 + rng() * 0.2;
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, rng() * Math.PI * 2, 0);
    dummy.scale.set(s, s * (0.9 + rng() * 0.14), s);
    dummy.updateMatrix();
    cTrunks.setMatrixAt(i, dummy.matrix);
    cCanopies.setMatrixAt(i, dummy.matrix);
    col.setHex(cherryPalette[i % cherryPalette.length]);
    cCanopies.setColorAt(i, col);
  });
  cTrunks.instanceMatrix.needsUpdate = true;
  cCanopies.instanceMatrix.needsUpdate = true;
  cCanopies.instanceColor.needsUpdate = true;
  root.add(cTrunks, cCanopies);
}

function buildFurniture(THREE, root, mats) {
  const dummy = new THREE.Object3D();

  // 1. Classical Lamp Posts with Light Blue Banners (InstancedMesh)
  const polePts = [
    new THREE.Vector2(0.01, 0),
    new THREE.Vector2(0.14, 0),
    new THREE.Vector2(0.12, 0.28),
    new THREE.Vector2(0.065, 0.42),
    new THREE.Vector2(0.048, 2.02),
    new THREE.Vector2(0.11, 2.12),
    new THREE.Vector2(0.01, 2.14),
  ];
  const poleBase = new THREE.LatheGeometry(polePts, 8);
  const armTop = new THREE.CylinderGeometry(0.018, 0.018, 0.42, 6);
  armTop.rotateZ(Math.PI / 2);
  armTop.translate(0.21, 1.82, 0);
  const armBot = new THREE.CylinderGeometry(0.016, 0.016, 0.42, 6);
  armBot.rotateZ(Math.PI / 2);
  armBot.translate(0.21, 1.12, 0);
  const capFinial = new THREE.ConeGeometry(0.1, 0.16, 8);
  capFinial.translate(0, 2.48, 0);
  const lampPoleGeo = mergeGeos(THREE, [poleBase, armTop, armBot, capFinial]);

  const lampGlobeGeo = new THREE.SphereGeometry(0.145, 9, 7);
  lampGlobeGeo.scale(0.95, 1.2, 0.95);
  lampGlobeGeo.translate(0, 2.28, 0);

  // Gently curving banner hanging from the lamp arm
  const bannerGeo = makeBevelBox(THREE, 0.34, 0.66, 0.028, 0.01, 1);
  bannerGeo.translate(0.23, 1.47, 0);
  // Assign clean 0..1 UVs on banner face for crisp stripe texture
  const bPos = bannerGeo.attributes.position;
  const bUv = new Float32Array(bPos.count * 2);
  for (let i = 0; i < bPos.count; i++) {
    bUv[i * 2] = (bPos.getX(i) - 0.06) / 0.34;
    bUv[i * 2 + 1] = (bPos.getY(i) - 1.14) / 0.66;
  }
  bannerGeo.setAttribute('uv', new THREE.BufferAttribute(bUv, 2));

  const lamps = [
    // Along West & East Avenues
    [-11.2, -11.5, 0], [11.2, -11.5, Math.PI],
    [-11.2, -5.0, 0], [11.2, -5.0, Math.PI],
    [-11.2, 0.8, 0], [11.2, 0.8, Math.PI],
    [-11.2, 6.2, 0], [11.2, 6.2, Math.PI],
    [-11.2, 12.6, 0], [11.2, 12.6, Math.PI],
    // Along Central North-South Walk
    [-1.6, -2.0, Math.PI], [1.6, -2.0, 0],
    [-1.6, 1.0, Math.PI], [1.6, 1.0, 0],
    [-1.6, 6.8, Math.PI], [1.6, 6.8, 0],
    [-1.6, 9.6, Math.PI], [1.6, 9.6, 0],
    // South Gate Plaza & Sidewalk
    [-4.6, 14.0, 0], [4.6, 14.0, Math.PI],
    [-15.0, 17.3, Math.PI / 2], [15.0, 17.3, -Math.PI / 2],
  ];

  const lampPoles = new THREE.InstancedMesh(lampPoleGeo, mats.iron, lamps.length);
  const lampGlobes = new THREE.InstancedMesh(lampGlobeGeo, mats.lanternGlow, lamps.length);
  const lampBanners = new THREE.InstancedMesh(bannerGeo, mats.banner, lamps.length);
  lampPoles.castShadow = true;
  lampPoles.receiveShadow = true;
  lampBanners.castShadow = true;

  lamps.forEach(([x, z, ry], i) => {
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, ry, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    lampPoles.setMatrixAt(i, dummy.matrix);
    lampGlobes.setMatrixAt(i, dummy.matrix);
    lampBanners.setMatrixAt(i, dummy.matrix);
  });
  lampPoles.instanceMatrix.needsUpdate = true;
  lampGlobes.instanceMatrix.needsUpdate = true;
  lampBanners.instanceMatrix.needsUpdate = true;
  root.add(lampPoles, lampGlobes, lampBanners);

  // 2. Cozy Park Benches (InstancedMesh for wood slats & cast-iron frames)
  const seatSlat1 = makeBevelBox(THREE, 1.24, 0.055, 0.16, 0.015, 1, 0.9);
  seatSlat1.translate(0, 0.34, 0.09);
  const seatSlat2 = makeBevelBox(THREE, 1.24, 0.055, 0.16, 0.015, 1, 0.9);
  seatSlat2.translate(0, 0.34, -0.09);
  const backSlat1 = makeBevelBox(THREE, 1.24, 0.14, 0.05, 0.015, 1, 0.9);
  backSlat1.rotateX(-0.18);
  backSlat1.translate(0, 0.56, -0.19);
  const backSlat2 = makeBevelBox(THREE, 1.24, 0.14, 0.05, 0.015, 1, 0.9);
  backSlat2.rotateX(-0.18);
  backSlat2.translate(0, 0.72, -0.22);
  const benchWoodGeo = mergeGeos(THREE, [seatSlat1, seatSlat2, backSlat1, backSlat2]);

  const legParts = [];
  for (const s of [-0.52, 0.52]) {
    const fl = makeBevelBox(THREE, 0.055, 0.34, 0.055, 0.012, 1);
    fl.translate(s, 0.17, 0.14);
    const bl = makeBevelBox(THREE, 0.055, 0.72, 0.055, 0.012, 1);
    bl.translate(s, 0.36, -0.17);
    const arm = makeBevelBox(THREE, 0.055, 0.05, 0.38, 0.012, 1);
    arm.translate(s, 0.5, -0.01);
    legParts.push(fl, bl, arm);
  }
  const benchIronGeo = mergeGeos(THREE, legParts);

  const benches = [
    // 4 around Sundial Plaza (facing sundial at 0, 3.9)
    [-1.72, 2.18, Math.PI * 0.25],
    [1.72, 2.18, -Math.PI * 0.25],
    [-1.72, 5.62, Math.PI * 0.75],
    [1.72, 5.62, -Math.PI * 0.75],
    // 4 along North Terrace Walk
    [-4.4, -2.05, 0], [4.4, -2.05, 0],
    [-8.2, -2.05, 0], [8.2, -2.05, 0],
    // 4 in Cherry Blossom Pocket Gardens
    [-18.2, -0.35, 0], [18.2, -0.35, 0],
    [-21.8, 1.35, Math.PI], [21.8, 1.35, Math.PI],
    // 4 along South Entrance Promenade
    [-6.6, 13.9, 0], [6.6, 13.9, 0],
    [-6.6, 15.85, Math.PI], [6.6, 15.85, Math.PI],
  ];

  const bWoodInst = new THREE.InstancedMesh(benchWoodGeo, mats.wood, benches.length);
  const bIronInst = new THREE.InstancedMesh(benchIronGeo, mats.iron, benches.length);
  bWoodInst.castShadow = true;
  bWoodInst.receiveShadow = true;
  bIronInst.castShadow = true;
  bIronInst.receiveShadow = true;

  benches.forEach(([x, z, ry], i) => {
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, ry, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    bWoodInst.setMatrixAt(i, dummy.matrix);
    bIronInst.setMatrixAt(i, dummy.matrix);
  });
  bWoodInst.instanceMatrix.needsUpdate = true;
  bIronInst.instanceMatrix.needsUpdate = true;
  root.add(bWoodInst, bIronInst);

  // 3. Tubular Bike Racks (4 clusters x 4 hoops = 16 hoops via InstancedMesh)
  const hoopCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.24, 0, 0),
    new THREE.Vector3(-0.24, 0.42, 0),
    new THREE.Vector3(-0.14, 0.56, 0),
    new THREE.Vector3(0.14, 0.56, 0),
    new THREE.Vector3(0.24, 0.42, 0),
    new THREE.Vector3(0.24, 0, 0),
  ]);
  const hoopGeo = new THREE.TubeGeometry(hoopCurve, 12, 0.028, 6, false);

  const rackClusters = [
    { x: -10.3, z: 13.9, ry: 0 },
    { x: 10.3, z: 13.9, ry: 0 },
    { x: -10.5, z: -3.55, ry: Math.PI / 2 },
    { x: 10.5, z: -3.55, ry: Math.PI / 2 },
  ];
  const padGeo = makeBevelBox(THREE, 1.55, 0.07, 0.72, 0.02, 1, 0.4);
  const hoops = [];
  for (const c of rackClusters) {
    addMesh(THREE, root, padGeo, mats.plotEdge, c.x, -0.02, c.z, 0, c.ry, 0, false, true);
    for (let k = 0; k < 4; k++) {
      const off = -0.54 + k * 0.36;
      const hx = c.x + Math.cos(c.ry) * off;
      const hz = c.z - Math.sin(c.ry) * off;
      hoops.push([hx, hz, c.ry + Math.PI / 2]);
    }
  }
  const hoopInst = new THREE.InstancedMesh(hoopGeo, mats.bikeMetal, hoops.length);
  hoopInst.castShadow = true;
  hoopInst.receiveShadow = true;
  hoops.forEach(([x, z, ry], i) => {
    dummy.position.set(x, 0.01, z);
    dummy.rotation.set(0, ry, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    hoopInst.setMatrixAt(i, dummy.matrix);
  });
  hoopInst.instanceMatrix.needsUpdate = true;
  root.add(hoopInst);
}

export function buildCampus(THREE, opts, kit) {
  const accent = (opts && opts.accent) ? opts.accent : '#7bc2eb';
  const root = new THREE.Group();
  root.name = 'campus';

  const rng = makeRng(202504);
  const tex = createTextures(THREE, kit, accent);

  const mats = {
    earthBase: new THREE.MeshStandardMaterial({ color: 0x6c5e50, roughness: 0.92, metalness: 0.0 }),
    grass: new THREE.MeshStandardMaterial({ map: tex.grass, roughness: 0.88, metalness: 0.0 }),
    hedge: new THREE.MeshStandardMaterial({ color: 0x4f7844, roughness: 0.86, metalness: 0.0 }),
    brickPath: new THREE.MeshStandardMaterial({ map: tex.brickPath, roughness: 0.84, metalness: 0.02 }),
    stonePaving: new THREE.MeshStandardMaterial({ map: tex.stonePaving, roughness: 0.78, metalness: 0.02 }),
    plotStone: new THREE.MeshStandardMaterial({ map: tex.stonePaving, color: 0xfbf8f2, roughness: 0.76, metalness: 0.02 }),
    plotEdge: new THREE.MeshStandardMaterial({ color: 0x999082, roughness: 0.84, metalness: 0.02 }),
    asphalt: new THREE.MeshStandardMaterial({ map: tex.asphalt, roughness: 0.9, metalness: 0.02 }),
    roadYellow: new THREE.MeshStandardMaterial({ color: 0xe3c26d, roughness: 0.78, metalness: 0.0 }),
    roadWhite: new THREE.MeshStandardMaterial({ color: 0xeae5da, roughness: 0.82, metalness: 0.0 }),

    // Landmark stone & copper
    limestone: new THREE.MeshStandardMaterial({ map: tex.limestone, color: 0xf7f1e5, roughness: 0.72, metalness: 0.02 }),
    limestoneDark: new THREE.MeshStandardMaterial({ map: tex.limestone, color: 0xddd3c1, roughness: 0.76, metalness: 0.02 }),
    domeCopper: new THREE.MeshStandardMaterial({ map: tex.copper, color: 0xd8ebe3, roughness: 0.52, metalness: 0.24 }),
    bronze: new THREE.MeshStandardMaterial({ color: 0x5d4c3b, roughness: 0.44, metalness: 0.56 }),
    bronzeBright: new THREE.MeshStandardMaterial({ color: 0x9e7d4f, roughness: 0.36, metalness: 0.65 }),

    // Softer, slightly desaturated background halls so the 4 special buildings stand out
    hallBrick: new THREE.MeshStandardMaterial({ map: tex.brick, color: 0xebd9d2, roughness: 0.82, metalness: 0.02 }),
    hallLimestone: new THREE.MeshStandardMaterial({ map: tex.limestone, color: 0xe8dfd1, roughness: 0.78, metalness: 0.02 }),
    copper: new THREE.MeshStandardMaterial({ map: tex.copper, color: 0xe6f0ec, roughness: 0.58, metalness: 0.18 }),
    copperDark: new THREE.MeshStandardMaterial({ color: 0x628075, roughness: 0.54, metalness: 0.22 }),

    // Windows
    winFrame: new THREE.MeshStandardMaterial({ color: 0xede6da, roughness: 0.68, metalness: 0.04 }),
    winDark: new THREE.MeshStandardMaterial({ color: 0x45586b, roughness: 0.24, metalness: 0.28 }),
    winLit: new THREE.MeshStandardMaterial({
      color: 0xffebc2,
      emissive: 0xffcf77,
      emissiveIntensity: 0.72,
      roughness: 0.3,
      metalness: 0.05,
    }),

    // Iron, wood, glass, lanterns, banners, trees
    iron: new THREE.MeshStandardMaterial({ color: 0x383d43, roughness: 0.48, metalness: 0.52 }),
    bikeMetal: new THREE.MeshStandardMaterial({ color: 0x5c646d, roughness: 0.38, metalness: 0.62 }),
    wood: new THREE.MeshStandardMaterial({ map: tex.wood, roughness: 0.74, metalness: 0.02 }),
    shelterGlass: new THREE.MeshStandardMaterial({
      color: 0xcbe2ea,
      roughness: 0.16,
      metalness: 0.12,
      transparent: true,
      opacity: 0.46,
    }),
    transitPanel: new THREE.MeshStandardMaterial({
      map: tex.transit,
      emissive: 0xfff3d6,
      emissiveIntensity: 0.28,
      roughness: 0.45,
    }),
    lanternGlow: new THREE.MeshStandardMaterial({
      color: 0xfff5d6,
      emissive: 0xffd782,
      emissiveIntensity: 0.95,
      roughness: 0.25,
    }),
    banner: new THREE.MeshStandardMaterial({ map: tex.banner, roughness: 0.75, metalness: 0.02 }),
    planeBark: new THREE.MeshStandardMaterial({ color: 0x7e7466, roughness: 0.9, metalness: 0.0 }),
    cherryBark: new THREE.MeshStandardMaterial({ color: 0x614e44, roughness: 0.9, metalness: 0.0 }),
    foliageBase: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.84, metalness: 0.0 }),
  };

  const winCollector = [];

  buildGroundAndPaths(THREE, root, mats);
  buildDomedLibrary(THREE, root, mats, winCollector);
  buildSouthLibrary(THREE, root, mats, winCollector);
  buildRedBrickHalls(THREE, root, mats, winCollector);
  buildWindowsInstanced(THREE, root, mats, winCollector, rng);
  buildSundialAndHedges(THREE, root, mats);
  buildGatesAndStreet(THREE, root, mats, accent);
  buildTrees(THREE, root, mats, rng);
  buildFurniture(THREE, root, mats);

  return root;
}
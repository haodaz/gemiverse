export const META = {
  id: "wooden-go-table",
  name: "Wooden Go Game Table",
  kind: "prop",
  footprint: [0.74, 0.46],
  variants: [
    { name: "Kaya & Indigo", opts: { wood: "#d9a877", accent: "#2b2536" } },
    { name: "Warm Walnut & Ink", opts: { wood: "#b68052", accent: "#201e26" } },
    { name: "Pale Hinoki & Plum", opts: { wood: "#e6c79c", accent: "#3f2638" } },
  ],
  note: "Thick sculpted wooden Go board game table with a 13x13 inlaid square grid, two turned lidded bowls on curved woven coasters, and biconvex black and white stones mid-game.",
};

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

function hexToRgb(hex) {
  const clean = String(hex || "#888888").replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
      : clean.padEnd(6, "0").slice(0, 6);
  const n = parseInt(full, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

function mixRgb(c1, c2, t) {
  return {
    r: Math.round(lerp(c1.r, c2.r, t)),
    g: Math.round(lerp(c1.g, c2.g, t)),
    b: Math.round(lerp(c1.b, c2.b, t)),
  };
}

function scaleRgb(c, f) {
  return {
    r: clamp(Math.round(c.r * f), 0, 255),
    g: clamp(Math.round(c.g * f), 0, 255),
    b: clamp(Math.round(c.b * f), 0, 255),
  };
}

function rgbCss(c, a = 1) {
  return a < 1
    ? `rgba(${c.r},${c.g},${c.b},${a})`
    : `rgb(${c.r},${c.g},${c.b})`;
}

function rgbHex(c) {
  return (
    "#" +
    [c.r, c.g, c.b]
      .map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

function fbm(kit, x, y, octaves = 3) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += kit.noise(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

function computeSmoothNormalsByPosition(geometry) {
  const pos = geometry.attributes.position;
  const idx = geometry.index;
  const count = pos.count;
  const normals = new Float32Array(count * 3);
  const buckets = new Map();

  const keys = new Array(count);
  for (let i = 0; i < count; i++) {
    const k =
      Math.round(pos.getX(i) * 1e4) +
      "," +
      Math.round(pos.getY(i) * 1e4) +
      "," +
      Math.round(pos.getZ(i) * 1e4);
    keys[i] = k;
    if (!buckets.has(k)) {
      buckets.set(k, [0, 0, 0]);
    }
  }

  const triCount = idx ? idx.count / 3 : count / 3;
  for (let t = 0; t < triCount; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3;
    const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;

    const ax = pos.getX(i0), ay = pos.getY(i0), az = pos.getZ(i0);
    const bx = pos.getX(i1), by = pos.getY(i1), bz = pos.getZ(i1);
    const cx = pos.getX(i2), cy = pos.getY(i2), cz = pos.getZ(i2);

    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;

    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;

    const b0 = buckets.get(keys[i0]);
    b0[0] += nx; b0[1] += ny; b0[2] += nz;
    const b1 = buckets.get(keys[i1]);
    b1[0] += nx; b1[1] += ny; b1[2] += nz;
    const b2 = buckets.get(keys[i2]);
    b2[0] += nx; b2[1] += ny; b2[2] += nz;
  }

  for (let i = 0; i < count; i++) {
    const b = buckets.get(keys[i]);
    const len = Math.hypot(b[0], b[1], b[2]) || 1;
    normals[i * 3] = b[0] / len;
    normals[i * 3 + 1] = b[1] / len;
    normals[i * 3 + 2] = b[2] / len;
  }

  geometry.setAttribute(
    "normal",
    new pos.constructor(normals, 3)
  );
  geometry.attributes.normal.needsUpdate = true;
}

function buildTaperedTube(THREE, curve, tubularSegs, radialSegs, radiusFn, closed = false) {
  const frames = curve.computeFrenetFrames(tubularSegs, closed);
  const ringCount = tubularSegs + 1;
  const vertCount = ringCount * (radialSegs + 1);
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices = [];

  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const vNorm = new THREE.Vector3();

  let vi = 0;
  let ui = 0;

  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    curve.getPointAt(closed ? u % 1 : u, P);
    N.copy(frames.normals[i]);
    B.copy(frames.binormals[i]);
    const r = radiusFn(u);

    for (let j = 0; j <= radialSegs; j++) {
      const v = j / radialSegs;
      const theta = v * Math.PI * 2;
      const sin = Math.sin(theta);
      const cos = -Math.cos(theta);

      vNorm.set(
        cos * N.x + sin * B.x,
        cos * N.y + sin * B.y,
        cos * N.z + sin * B.z
      ).normalize();

      positions[vi] = P.x + r * vNorm.x;
      positions[vi + 1] = P.y + r * vNorm.y;
      positions[vi + 2] = P.z + r * vNorm.z;

      normals[vi] = vNorm.x;
      normals[vi + 1] = vNorm.y;
      normals[vi + 2] = vNorm.z;
      vi += 3;

      uvs[ui] = u;
      uvs[ui + 1] = v;
      ui += 2;
    }
  }

  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * (radialSegs + 1) + j;
      const b = (i + 1) * (radialSegs + 1) + j;
      const c = (i + 1) * (radialSegs + 1) + (j + 1);
      const d = i * (radialSegs + 1) + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

function paintWoodGrain(ctx, w, h, kit, baseRgb, opts = {}) {
  const darkGrain = mixRgb(baseRgb, { r: 72, g: 38, b: 18 }, opts.grainDepth ?? 0.36);
  const lightGrain = mixRgb(baseRgb, { r: 255, g: 242, b: 218 }, 0.22);
  const horizontal = opts.horizontal ?? true;
  const seed = opts.seed ?? 0;

  ctx.fillStyle = rgbCss(baseRgb);
  ctx.fillRect(0, 0, w, h);

  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      const along = horizontal ? u : v;
      const across = horizontal ? v : u;

      const warp = fbm(kit, along * 3.2 + seed, across * 5.0 + seed * 1.7, 3) * 0.22;
      const ringVal = Math.sin((across * (opts.rings ?? 24) + warp * 12) * Math.PI * 2);
      const band = 0.5 + 0.5 * ringVal;
      const sharp = Math.pow(band, 2.2);

      const fine = kit.noise(along * 95 + seed, across * 16 + seed);
      const streak = kit.noise(along * 18 + seed * 2, across * 70 + seed);
      const warmShift = (fbm(kit, u * 2.5 + seed, v * 2.5 + seed, 2) - 0.5) * 0.14;

      const grainT = clamp(sharp * 0.58 + (1 - fine) * 0.16 + (1 - streak) * 0.18, 0, 1);
      let c = mixRgb(lightGrain, darkGrain, grainT);

      if (warmShift > 0) {
        c = mixRgb(c, lightGrain, warmShift);
      } else {
        c = mixRgb(c, darkGrain, -warmShift);
      }

      const idx = (y * w + x) * 4;
      data[idx] = c.r;
      data[idx + 1] = c.g;
      data[idx + 2] = c.b;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function makeBoardTopTextures(THREE, kit, woodRgb, accentRgb, dims) {
  const inkRgb = mixRgb(accentRgb, { r: 16, g: 12, b: 20 }, 0.55);
  const grooveRgb = mixRgb(woodRgb, { r: 65, g: 36, b: 18 }, 0.42);

  const map = kit.canvasTexture(1024, 1024, (ctx, w, h) => {
    paintWoodGrain(ctx, w, h, kit, woodRgb, {
      horizontal: true,
      rings: 28,
      grainDepth: 0.34,
      seed: 1.3,
    });

    // Subtle warm center sheen and honey edge burnish
    const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.18, w * 0.5, h * 0.5, w * 0.68);
    vig.addColorStop(0, "rgba(255,248,232,0.08)");
    vig.addColorStop(0.72, "rgba(180,120,65,0.02)");
    vig.addColorStop(1, "rgba(85,48,20,0.22)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    // Subtle plank joinery lines along length for artisanal timber feel
    ctx.strokeStyle = rgbCss(grooveRgb, 0.16);
    ctx.lineWidth = 1.5;
    for (const frac of [0.22, 0.78]) {
      ctx.beginPath();
      ctx.moveTo(0, frac * h);
      ctx.lineTo(w, frac * h);
      ctx.stroke();
    }

    const toPxX = (wx) => ((wx / dims.tableW) + 0.5) * w;
    const toPxY = (wz) => ((wz / dims.tableD) + 0.5) * h;

    const gMinX = toPxX(-dims.gridHalf);
    const gMaxX = toPxX(dims.gridHalf);
    const gMinY = toPxY(-dims.gridHalf);
    const gMaxY = toPxY(dims.gridHalf);

    // Subtle inlaid wooden frame border surrounding the square grid
    const padX = (0.017 / dims.tableW) * w;
    const padY = (0.017 / dims.tableD) * h;
    ctx.fillStyle = "rgba(255,248,234,0.06)";
    ctx.fillRect(gMinX - padX, gMinY - padY, (gMaxX - gMinX) + padX * 2, (gMaxY - gMinY) + padY * 2);

    ctx.strokeStyle = rgbCss(grooveRgb, 0.55);
    ctx.lineWidth = 2.4;
    ctx.strokeRect(gMinX - padX, gMinY - padY, (gMaxX - gMinX) + padX * 2, (gMaxY - gMinY) + padY * 2);

    ctx.strokeStyle = rgbCss(inkRgb, 0.32);
    ctx.lineWidth = 1.1;
    ctx.strokeRect(gMinX - padX * 0.72, gMinY - padY * 0.72, (gMaxX - gMinX) + padX * 1.44, (gMaxY - gMinY) + padY * 1.44);

    // Crisp 13x13 square Go grid
    const steps = dims.gridSteps;
    ctx.lineCap = "square";

    for (let i = 0; i <= steps; i++) {
      const wx = -dims.gridHalf + (i / steps) * dims.gridSize;
      const wz = -dims.gridHalf + (i / steps) * dims.gridSize;
      const px = toPxX(wx);
      const py = toPxY(wz);
      const isBorder = i === 0 || i === steps;

      ctx.strokeStyle = rgbCss(inkRgb, isBorder ? 0.92 : 0.84);
      ctx.lineWidth = isBorder ? 3.2 : 2.1;

      // Vertical grid line
      ctx.beginPath();
      ctx.moveTo(px, gMinY);
      ctx.lineTo(px, gMaxY);
      ctx.stroke();

      // Horizontal grid line
      ctx.beginPath();
      ctx.moveTo(gMinX, py);
      ctx.lineTo(gMaxX, py);
      ctx.stroke();
    }

    // 5 Hoshi star points for 13x13 Go board
    const hoshiCoords = [
      [3, 3],
      [3, 9],
      [9, 3],
      [9, 9],
      [6, 6],
    ];
    ctx.fillStyle = rgbCss(inkRgb, 0.94);
    for (const [col, row] of hoshiCoords) {
      const cx = toPxX(-dims.gridHalf + (col / steps) * dims.gridSize);
      const cy = toPxY(-dims.gridHalf + (row / steps) * dims.gridSize);
      ctx.beginPath();
      // Compensate ellipse for aspect ratio so star points render round in world space
      const rx = (0.0038 / dims.tableW) * w;
      const ry = (0.0038 / dims.tableD) * h;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const bumpMap = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = "rgb(142,142,142)";
    ctx.fillRect(0, 0, w, h);

    // Fine wood grain ridges
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const v = y / h;
        const n = kit.noise(u * 60 + 1.3, v * 14 + 1.3);
        const s = Math.sin((v * 28 + kit.noise(u * 4, v * 5) * 2.5) * Math.PI * 2);
        const val = clamp(Math.round(145 + s * 14 + (n - 0.5) * 18), 90, 200);
        const idx = (y * w + x) * 4;
        d[idx] = d[idx + 1] = d[idx + 2] = val;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Subtle incised grooves along the inlaid border and grid lines
    const toPxX = (wx) => ((wx / dims.tableW) + 0.5) * w;
    const toPxY = (wz) => ((wz / dims.tableD) + 0.5) * h;
    const gMinX = toPxX(-dims.gridHalf);
    const gMaxX = toPxX(dims.gridHalf);
    const gMinY = toPxY(-dims.gridHalf);
    const gMaxY = toPxY(dims.gridHalf);
    const padX = (0.017 / dims.tableW) * w;
    const padY = (0.017 / dims.tableD) * h;

    ctx.strokeStyle = "rgb(72,72,72)";
    ctx.lineWidth = 2.0;
    ctx.strokeRect(gMinX - padX, gMinY - padY, (gMaxX - gMinX) + padX * 2, (gMaxY - gMinY) + padY * 2);

    ctx.strokeStyle = "rgb(106,106,106)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i <= dims.gridSteps; i++) {
      const px = toPxX(-dims.gridHalf + (i / dims.gridSteps) * dims.gridSize);
      const py = toPxY(-dims.gridHalf + (i / dims.gridSteps) * dims.gridSize);
      ctx.beginPath();
      ctx.moveTo(px, gMinY);
      ctx.lineTo(px, gMaxY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(gMinX, py);
      ctx.lineTo(gMaxX, py);
      ctx.stroke();
    }
  });
  bumpMap.anisotropy = 4;

  return { map, bumpMap };
}

function makeWoodSideTextures(THREE, kit, woodRgb) {
  const sideRgb = mixRgb(woodRgb, { r: 120, g: 76, b: 42 }, 0.14);
  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    paintWoodGrain(ctx, w, h, kit, sideRgb, {
      horizontal: true,
      rings: 20,
      grainDepth: 0.42,
      seed: 4.7,
    });
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(255,244,225,0.06)");
    grad.addColorStop(0.55, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(48,26,12,0.18)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const v = y / h;
        const n = fbm(kit, u * 35 + 4.7, v * 12 + 4.7, 2);
        const r = Math.sin((v * 20 + n * 2.2) * Math.PI * 2);
        const val = clamp(Math.round(135 + r * 24 + (n - 0.5) * 32), 60, 215);
        const idx = (y * w + x) * 4;
        d[idx] = d[idx + 1] = d[idx + 2] = val;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

function makeBowlWoodTextures(THREE, kit, woodRgb, accentRgb) {
  const stainedBase = mixRgb(accentRgb, { r: 92, g: 52, b: 36 }, 0.34);
  const darkBand = mixRgb(accentRgb, { r: 20, g: 14, b: 22 }, 0.45);
  const inlayGold = mixRgb(woodRgb, { r: 232, g: 190, b: 138 }, 0.35);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    paintWoodGrain(ctx, w, h, kit, stainedBase, {
      horizontal: true,
      rings: 34,
      grainDepth: 0.46,
      seed: 9.2,
    });

    // Lathe-turned horizontal polishing sheen bands
    for (let y = 0; y < h; y += 2) {
      const band = kit.noise(2.1, y * 0.08);
      ctx.fillStyle = band > 0.5
        ? `rgba(255,228,200,${(band - 0.5) * 0.1})`
        : `rgba(12,8,16,${(0.5 - band) * 0.16})`;
      ctx.fillRect(0, y, w, 2);
    }

    // Subtle warm wood decorative turned inlay ring along the upper shoulder
    const stripeY = Math.round(h * 0.58);
    ctx.fillStyle = rgbCss(darkBand, 0.72);
    ctx.fillRect(0, stripeY - 5, w, 14);
    ctx.fillStyle = rgbCss(inlayGold, 0.85);
    ctx.fillRect(0, stripeY, w, 5);
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const latheGroove = Math.sin(y * 0.75) * 10 + (kit.noise(1.5, y * 0.18) - 0.5) * 20;
      for (let x = 0; x < w; x++) {
        const grain = (kit.noise(x * 0.12, y * 0.05) - 0.5) * 24;
        const val = clamp(Math.round(136 + latheGroove + grain), 70, 210);
        const idx = (y * w + x) * 4;
        d[idx] = d[idx + 1] = d[idx + 2] = val;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  bumpMap.wrapS = THREE.RepeatWrapping;

  return { map, bumpMap };
}

function makeCoasterTextures(THREE, kit, woodRgb, accentRgb) {
  const linenBase = mixRgb(woodRgb, { r: 238, g: 229, b: 214 }, 0.76);
  const warpCol = mixRgb(linenBase, { r: 196, g: 180, b: 158 }, 0.35);
  const weftCol = mixRgb(linenBase, { r: 252, g: 247, b: 238 }, 0.3);
  const borderCol = mixRgb(accentRgb, linenBase, 0.25);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = rgbCss(linenBase);
    ctx.fillRect(0, 0, w, h);

    const step = 4;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const over = ((x / step) + (y / step)) % 2 === 0;
        const n = kit.noise(x * 0.09, y * 0.09);
        const base = over ? warpCol : weftCol;
        const c = scaleRgb(base, 0.92 + n * 0.16);
        ctx.fillStyle = rgbCss(c);
        ctx.fillRect(x, y, step - 0.4, step - 0.4);
      }
    }

    // Subtle stitched woven border frame
    ctx.strokeStyle = rgbCss(borderCol, 0.65);
    ctx.lineWidth = 4;
    ctx.setLineDash([7, 4]);
    ctx.strokeRect(20, 20, w - 40, h - 40);
    ctx.setLineDash([]);
  });
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "rgb(110,110,110)";
    ctx.fillRect(0, 0, w, h);
    const step = 4;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const over = ((x / step) + (y / step)) % 2 === 0;
        const v = over ? 190 : 120;
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x + 0.5, y + 0.5, step - 1, step - 1);
      }
    }
  });

  return { map, bumpMap };
}

function makeWhiteStoneTextures(THREE, kit) {
  // Hamaguri clamshell creamy ivory with delicate pearlescent striations
  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#f4efe4";
    ctx.fillRect(0, 0, w, h);

    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const v = y / h;
        const wave = Math.sin((u * 14 + fbm(kit, u * 3, v * 3, 2) * 1.6) * Math.PI * 2);
        const striation = 0.5 + 0.5 * wave;
        const pearl = kit.noise(u * 18, v * 18);
        const t = striation * 0.65 + pearl * 0.35;
        const r = Math.round(lerp(233, 250, t));
        const g = Math.round(lerp(225, 246, t));
        const b = Math.round(lerp(209, 236, t));
        const idx = (y * w + x) * 4;
        d[idx] = r;
        d[idx + 1] = g;
        d[idx + 2] = b;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = kit.canvasTexture(128, 128, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const v = y / h;
        const s = Math.sin((u * 14 + kit.noise(u * 3, v * 3) * 1.4) * Math.PI * 2);
        const val = Math.round(132 + s * 14);
        const idx = (y * w + x) * 4;
        d[idx] = d[idx + 1] = d[idx + 2] = val;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  return { map, bumpMap };
}

function makeBlackStoneTextures(THREE, kit, accentRgb) {
  // Nachi-guro slate stone: deep charcoal-indigo with fine mineral grain
  const slateBase = mixRgb(accentRgb, { r: 22, g: 22, b: 26 }, 0.68);
  const slateDark = mixRgb(slateBase, { r: 10, g: 10, b: 14 }, 0.45);
  const slateLight = mixRgb(slateBase, { r: 66, g: 64, b: 78 }, 0.32);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const v = y / h;
        const fleck = kit.noise(u * 48, v * 48);
        const cloud = fbm(kit, u * 5, v * 5, 2);
        let c = mixRgb(slateDark, slateBase, cloud);
        if (fleck > 0.72) {
          c = mixRgb(c, slateLight, (fleck - 0.72) * 1.4);
        }
        const idx = (y * w + x) * 4;
        d[idx] = c.r;
        d[idx + 1] = c.g;
        d[idx + 2] = c.b;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = kit.canvasTexture(128, 128, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = kit.noise((x / w) * 42, (y / h) * 42);
        const val = Math.round(118 + n * 28);
        const idx = (y * w + x) * 4;
        d[idx] = d[idx + 1] = d[idx + 2] = val;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  return { map, bumpMap };
}

function buildSculptedTableSlab(THREE, kit, W, H, D) {
  // Dense box with edge-clustered subdivisions sculpted into a continuous rounded solid-wood slab
  const geo = new THREE.BoxGeometry(W, H, D, 44, 14, 30);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  const hx = W * 0.5;
  const hy = H * 0.5;
  const hz = D * 0.5;
  const rXZ = 0.022;
  const rY = 0.013;
  const cx = hx - rXZ;
  const cy = hy - rY;
  const cz = hz - rXZ;

  const edgeCluster = (t, p) => Math.sign(t) * (1 - Math.pow(1 - Math.abs(t), p));

  for (let i = 0; i < pos.count; i++) {
    const ox = pos.getX(i);
    const oy = pos.getY(i);
    const oz = pos.getZ(i);

    const isTopFace = oy > hy - 1e-5;
    const isBottomFace = oy < -hy + 1e-5;

    // Remap coordinates so subdivisions cluster cleanly along the beveled edges
    const rx = edgeCluster(clamp(ox / hx, -1, 1), 1.65) * hx;
    const ry = edgeCluster(clamp(oy / hy, -1, 1), 1.55) * hy;
    const rz = edgeCluster(clamp(oz / hz, -1, 1), 1.65) * hz;

    // Preserve exact planar UV coordinates on top playing surface before bevel projection
    if (isTopFace) {
      uv.setXY(i, rx / W + 0.5, 0.5 - rz / D);
    } else if (isBottomFace) {
      uv.setXY(i, rx / W + 0.5, rz / D + 0.5);
    }

    // Ellipsoidal bevel projection onto smooth rounded slab
    const qx = clamp(rx, -cx, cx);
    const qy = clamp(ry, -cy, cy);
    const qz = clamp(rz, -cz, cz);

    const dx = rx - qx;
    const dy = ry - qy;
    const dz = rz - qz;

    let sx = rx;
    let sy = ry;
    let sz = rz;

    const eLen = Math.hypot(dx / rXZ, dy / rY, dz / rXZ);
    if (eLen > 1e-6) {
      sx = qx + dx / eLen;
      sy = qy + dy / eLen;
      sz = qz + dz / eLen;
    }

    // Subtle artisanal underside chamfer taper toward the lower face
    const lowerT = smoothstep(-hy * 0.1, -hy, sy);
    const underTaper = 1 - lowerT * 0.032;
    sx *= underTaper;
    sz *= underTaper;

    // Subtle hand-planed organic warmth along side walls (keep playing top dead flat)
    const sideMask = smoothstep(hy - rY * 0.5, hy - rY * 1.6, sy);
    if (sideMask > 0.001) {
      const n = (kit.noise(sx * 9 + 2.1, sz * 9 + sy * 12) - 0.5) * 0.0014 * sideMask;
      sx += Math.sign(sx) * n;
      sz += Math.sign(sz) * n;
    }

    pos.setXYZ(i, sx, sy, sz);
  }

  pos.needsUpdate = true;
  uv.needsUpdate = true;
  computeSmoothNormalsByPosition(geo);
  return geo;
}

function buildSculptedLeg(THREE, legH) {
  // Traditional kuchinashi-inspired turned and 8-fluted carved wooden table leg
  const pts = [
    [0.000, 0.000],
    [0.022, 0.000],
    [0.025, 0.003],
    [0.025, 0.011],
    [0.021, 0.017],
    [0.019, 0.024],
    [0.023, 0.034],
    [0.031, 0.048],
    [0.037, 0.064],
    [0.041, 0.082],
    [0.042, 0.098],
    [0.040, 0.114],
    [0.036, 0.130],
    [0.031, 0.144],
    [0.027, 0.156],
    [0.025, 0.167],
    [0.027, 0.176],
    [0.033, 0.184],
    [0.038, 0.191],
    [0.038, legH],
    [0.000, legH],
  ];

  const profile = pts.map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(profile, 36);
  const pos = geo.attributes.position;

  // Sculpt 8 soft vertical carved flutes along the bulbous mid-section
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > 0.002) {
      const env = smoothstep(0.024, 0.056, y) * (1 - smoothstep(0.132, 0.168, y));
      const ang = Math.atan2(z, x);
      const flute = 1 + env * 0.058 * Math.cos(8 * ang);
      pos.setX(i, x * flute);
      pos.setZ(i, z * flute);
    }
  }

  pos.needsUpdate = true;
  computeSmoothNormalsByPosition(geo);
  return geo;
}

function buildLegCollar(THREE) {
  const pts = [
    [0.0185, 0.017],
    [0.0222, 0.0185],
    [0.0230, 0.022],
    [0.0222, 0.0255],
    [0.0190, 0.027],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, 28);
  geo.computeVertexNormals();
  return geo;
}

function buildApronRail(THREE, span, height, thickness) {
  // Graceful arched wooden underside stretcher using ExtrudeGeometry with bezierCurveTo
  const half = span * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-half, height);
  shape.lineTo(half, height);
  shape.lineTo(half, 0.002);
  shape.bezierCurveTo(
    half * 0.65, 0.002,
    half * 0.42, height * 0.42,
    0, height * 0.44
  );
  shape.bezierCurveTo(
    -half * 0.42, height * 0.42,
    -half * 0.65, 0.002,
    -half, 0.002
  );
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.0022,
    bevelSize: 0.002,
    bevelSegments: 2,
    curveSegments: 16,
  });
  geo.translate(0, 0, -thickness * 0.5);
  geo.computeVertexNormals();
  return geo;
}

function buildBowTieInlay(THREE) {
  // Sculpted hardwood butterfly key (chigiri) inlay with curved hourglass waist
  const shape = new THREE.Shape();
  shape.moveTo(-0.024, -0.011);
  shape.bezierCurveTo(-0.008, -0.006, 0.008, -0.006, 0.024, -0.011);
  shape.bezierCurveTo(0.026, -0.004, 0.026, 0.004, 0.024, 0.011);
  shape.bezierCurveTo(0.008, 0.006, -0.008, 0.006, -0.024, 0.011);
  shape.bezierCurveTo(-0.026, 0.004, -0.026, -0.004, -0.024, -0.011);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0032,
    bevelEnabled: true,
    bevelThickness: 0.001,
    bevelSize: 0.001,
    bevelSegments: 2,
    curveSegments: 12,
  });
  geo.computeVertexNormals();
  return geo;
}

function buildGoBowl(THREE) {
  // Iconic Japanese turned goke bowl (26-point LatheGeometry profile with thick wall & hollow interior)
  const pts = [
    [0.000, 0.000],
    [0.028, 0.000],
    [0.032, 0.0015],
    [0.035, 0.005],
    [0.043, 0.011],
    [0.051, 0.020],
    [0.056, 0.030],
    [0.058, 0.039],
    [0.057, 0.048],
    [0.053, 0.055],
    [0.048, 0.060],
    [0.0455, 0.0635],
    [0.0450, 0.0665],
    [0.0435, 0.0678],
    [0.0415, 0.0672],
    [0.0405, 0.0635],
    [0.0425, 0.058],
    [0.0475, 0.050],
    [0.0505, 0.040],
    [0.0495, 0.030],
    [0.0450, 0.021],
    [0.0370, 0.014],
    [0.0270, 0.010],
    [0.0160, 0.0085],
    [0.0070, 0.008],
    [0.000, 0.008],
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const geo = new THREE.LatheGeometry(pts, 40);
  geo.computeVertexNormals();
  return geo;
}

function buildBowlLid(THREE) {
  // Matching turned goke lid (20-point LatheGeometry) with flat crown so it sits steady upturned
  const pts = [
    [0.000, 0.024],
    [0.014, 0.024],
    [0.024, 0.0232],
    [0.034, 0.0212],
    [0.042, 0.0180],
    [0.048, 0.0138],
    [0.0515, 0.0095],
    [0.0522, 0.0055],
    [0.0505, 0.0020],
    [0.0475, 0.0005],
    [0.0445, 0.0005],
    [0.0435, 0.0038],
    [0.0415, 0.0045],
    [0.0398, 0.0075],
    [0.0365, 0.0115],
    [0.0300, 0.0148],
    [0.0210, 0.0168],
    [0.0120, 0.0176],
    [0.0050, 0.0178],
    [0.000, 0.0178],
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const geo = new THREE.LatheGeometry(pts, 40);
  geo.computeVertexNormals();
  return geo;
}

function buildGoStone(THREE, radius, height) {
  // True biconvex lenticular Go stone (16-point LatheGeometry profile)
  const pts = [];
  const steps = 15;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 bottom pole -> 1 top pole
    const theta = (t - 0.5) * Math.PI; // -pi/2 .. +pi/2
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    // Slightly fuller shoulder than a pure sphere for authentic plump stone feel
    const r = radius * Math.pow(Math.max(0, cosT), 0.78);
    const y = (height * 0.5) * (1 + Math.sign(sinT) * Math.pow(Math.abs(sinT), 0.92));
    pts.push(new THREE.Vector2(i === 0 || i === steps ? 0 : r, y));
  }

  const geo = new THREE.LatheGeometry(pts, 16);
  geo.computeVertexNormals();
  return geo;
}

function buildCurvedCoaster(THREE, size) {
  // Soft rounded woven cloth coaster drawn with bezierCurveTo, beveled, and gently draped/curved
  const s = size * 0.5;
  const k = s * 0.88;
  const shape = new THREE.Shape();
  shape.moveTo(-k, -s);
  shape.lineTo(k, -s);
  shape.bezierCurveTo(s, -s, s, -s, s, -k);
  shape.lineTo(s, k);
  shape.bezierCurveTo(s, s, s, s, k, s);
  shape.lineTo(-k, s);
  shape.bezierCurveTo(-s, s, -s, s, -s, k);
  shape.lineTo(-s, -k);
  shape.bezierCurveTo(-s, -s, -s, -s, -k, -s);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0022,
    bevelEnabled: true,
    bevelThickness: 0.0009,
    bevelSize: 0.0014,
    bevelSegments: 2,
    curveSegments: 10,
  });

  // Rotate to lie flat on XZ plane
  geo.rotateX(Math.PI * 0.5);
  geo.translate(0, 0.0024, 0);

  // Remap UVs cleanly into [0,1]x[0,1] and gently curve corners upward for organic cloth drape
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    uv.setXY(i, x / (size + 0.004) + 0.5, z / (size + 0.004) + 0.5);

    const dist = Math.hypot(x, z);
    const edgeCurl = smoothstep(s * 0.72, s * 1.32, dist) * 0.0026;
    const softWave = Math.sin(x * 42 + z * 28) * 0.00035 * smoothstep(s * 0.4, s, dist);
    pos.setY(i, y + edgeCurl + softWave);
  }
  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function buildCoasterCord(THREE, size) {
  // Subtle braided piping cord along coaster perimeter + tiny curved corner tail using tapered TubeGeometry
  const s = size * 0.5 + 0.0012;
  const r = s * 0.92;
  const pts = [];
  const count = 24;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    // Superellipse perimeter matching the rounded-square coaster
    const sx = Math.sign(ca) * Math.pow(Math.abs(ca), 0.42) * r;
    const sz = Math.sign(sa) * Math.pow(Math.abs(sa), 0.42) * r;
    const dist = Math.hypot(sx, sz);
    const lift = smoothstep(s * 0.72, s * 1.32, dist) * 0.0025;
    pts.push(new THREE.Vector3(sx, 0.0018 + lift, sz));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true);
  return buildTaperedTube(
    THREE,
    curve,
    48,
    7,
    (u) => 0.00145 + 0.00018 * Math.sin(u * Math.PI * 24),
    true
  );
}

function buildBowlStoneBed(THREE) {
  // Gently domed inner filler mound tucked inside bowl walls so no gaps show under the top stones
  const pts = [
    [0.000, 0.050],
    [0.015, 0.0495],
    [0.028, 0.0480],
    [0.039, 0.0450],
    [0.0465, 0.0410],
    [0.0470, 0.0360],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, 24);
  geo.computeVertexNormals();
  return geo;
}

function populateBowlStones(THREE, parent, stoneGeo, stoneMat, slot, seedOffset) {
  // Deterministic 3-layer sculpted pile of 20 stones nestled cleanly inside the bowl rim
  const layers = [
    // Lower visible ring (9 stones)
    { count: 9, radius: 0.0305, y: 0.0470, tilt: 0.24, phase: 0.2 },
    // Middle ring (7 stones)
    { count: 7, radius: 0.0185, y: 0.0535, tilt: 0.19, phase: 0.9 },
    // Crown cluster (4 stones)
    { count: 4, radius: 0.0092, y: 0.0592, tilt: 0.14, phase: 1.7 },
  ];

  let idx = 0;
  for (const layer of layers) {
    for (let i = 0; i < layer.count; i++) {
      idx++;
      const hash1 = Math.sin(idx * 12.9898 + seedOffset * 78.233) * 43758.5453;
      const r1 = hash1 - Math.floor(hash1);
      const hash2 = Math.sin(idx * 39.346 + seedOffset * 11.135) * 24634.6345;
      const r2 = hash2 - Math.floor(hash2);
      const hash3 = Math.sin(idx * 73.156 + seedOffset * 53.71) * 19384.213;
      const r3 = hash3 - Math.floor(hash3);

      const angle = (i / layer.count) * Math.PI * 2 + layer.phase + (r1 - 0.5) * 0.26;
      const rad = layer.radius + (r2 - 0.5) * 0.0034;

      const stone = new THREE.Mesh(stoneGeo, stoneMat);
      stone.userData.slot = slot;
      stone.position.set(
        Math.cos(angle) * rad,
        layer.y + (r3 - 0.5) * 0.0024,
        Math.sin(angle) * rad
      );
      stone.rotation.set(
        (r1 - 0.5) * layer.tilt * 2,
        r2 * Math.PI * 2,
        (r3 - 0.5) * layer.tilt * 2
      );
      stone.castShadow = true;
      stone.receiveShadow = true;
      parent.add(stone);
    }
  }
}

export function build(THREE, opts = {}, kit) {
  const woodHex = opts.wood || opts.primary || "#d9a877";
  const accentHex = opts.accent || opts.secondary || "#2b2536";

  const woodRgb = hexToRgb(woodHex);
  const accentRgb = hexToRgb(accentHex);

  const dims = {
    tableW: 0.74,
    tableD: 0.46,
    slabH: 0.088,
    slabBottomY: 0.192,
    topY: 0.280,
    gridSize: 0.352,
    gridHalf: 0.176,
    gridSteps: 12, // 13x13 intersections
  };

  const root = new THREE.Group();
  root.name = "woodenGoTable";

  const bodyGroup = new THREE.Group();
  bodyGroup.name = "body";
  root.add(bodyGroup);

  // --- Textures ---
  const boardTex = makeBoardTopTextures(THREE, kit, woodRgb, accentRgb, dims);
  const sideTex = makeWoodSideTextures(THREE, kit, woodRgb);
  const bowlTex = makeBowlWoodTextures(THREE, kit, woodRgb, accentRgb);
  const coasterTex = makeCoasterTextures(THREE, kit, woodRgb, accentRgb);
  const whiteStoneTex = makeWhiteStoneTextures(THREE, kit);
  const blackStoneTex = makeBlackStoneTextures(THREE, kit, accentRgb);

  // --- Materials (MeshPhysicalMaterial) ---
  const boardTopMat = new THREE.MeshPhysicalMaterial({
    map: boardTex.map,
    bumpMap: boardTex.bumpMap,
    bumpScale: 0.0014,
    roughness: 0.42,
    metalness: 0.0,
    clearcoat: 0.28,
    clearcoatRoughness: 0.34,
  });

  const woodSideMat = new THREE.MeshPhysicalMaterial({
    map: sideTex.map,
    bumpMap: sideTex.bumpMap,
    bumpScale: 0.0022,
    roughness: 0.48,
    metalness: 0.0,
    clearcoat: 0.22,
    clearcoatRoughness: 0.38,
  });

  const woodUnderMat = new THREE.MeshPhysicalMaterial({
    map: sideTex.map,
    color: rgbHex(mixRgb(woodRgb, { r: 95, g: 58, b: 30 }, 0.25)),
    bumpMap: sideTex.bumpMap,
    bumpScale: 0.002,
    roughness: 0.62,
    metalness: 0.0,
  });

  const bowlMat = new THREE.MeshPhysicalMaterial({
    map: bowlTex.map,
    bumpMap: bowlTex.bumpMap,
    bumpScale: 0.0012,
    roughness: 0.28,
    metalness: 0.02,
    clearcoat: 0.68,
    clearcoatRoughness: 0.20,
  });

  const accentWoodMat = new THREE.MeshPhysicalMaterial({
    color: rgbHex(mixRgb(accentRgb, { r: 44, g: 30, b: 28 }, 0.25)),
    roughness: 0.44,
    metalness: 0.03,
    clearcoat: 0.32,
    clearcoatRoughness: 0.32,
  });

  const coasterMat = new THREE.MeshPhysicalMaterial({
    map: coasterTex.map,
    bumpMap: coasterTex.bumpMap,
    bumpScale: 0.0028,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.85,
    sheenRoughness: 0.8,
    sheenColor: rgbHex(mixRgb(woodRgb, { r: 255, g: 250, b: 242 }, 0.85)),
  });

  const cordMat = new THREE.MeshPhysicalMaterial({
    color: rgbHex(mixRgb(accentRgb, woodRgb, 0.22)),
    roughness: 0.9,
    metalness: 0.0,
    sheen: 0.7,
    sheenColor: rgbHex(mixRgb(accentRgb, { r: 220, g: 210, b: 225 }, 0.45)),
  });

  const blackStoneMat = new THREE.MeshPhysicalMaterial({
    map: blackStoneTex.map,
    bumpMap: blackStoneTex.bumpMap,
    bumpScale: 0.0005,
    roughness: 0.32,
    metalness: 0.04,
    clearcoat: 0.48,
    clearcoatRoughness: 0.24,
  });

  const whiteStoneMat = new THREE.MeshPhysicalMaterial({
    map: whiteStoneTex.map,
    bumpMap: whiteStoneTex.bumpMap,
    bumpScale: 0.0004,
    roughness: 0.22,
    metalness: 0.0,
    clearcoat: 0.74,
    clearcoatRoughness: 0.14,
    sheen: 0.2,
    sheenColor: "#fffaf0",
  });

  // --- 1. Thick Sculpted Wooden Table Slab ---
  const slabGeo = buildSculptedTableSlab(THREE, kit, dims.tableW, dims.slabH, dims.tableD);
  const slabMaterials = [
    woodSideMat,
    woodSideMat,
    boardTopMat,
    woodUnderMat,
    woodSideMat,
    woodSideMat,
  ];
  const slabMesh = new THREE.Mesh(slabGeo, slabMaterials);
  slabMesh.name = "tableSlab";
  slabMesh.userData.slot = "primary";
  slabMesh.position.y = dims.slabBottomY + dims.slabH * 0.5;
  slabMesh.castShadow = true;
  slabMesh.receiveShadow = true;
  bodyGroup.add(slabMesh);

  // Decorative butterfly-key (chigiri) hardwood inlays on front & back thick edges
  const bowTieGeo = buildBowTieInlay(THREE);
  const bowTiePlacements = [
    { x: -0.22, z: dims.tableD * 0.5 - 0.0038, ry: 0 },
    { x: 0.22, z: dims.tableD * 0.5 - 0.0038, ry: 0 },
    { x: -0.22, z: -dims.tableD * 0.5 + 0.0038, ry: Math.PI },
    { x: 0.22, z: -dims.tableD * 0.5 + 0.0038, ry: Math.PI },
  ];
  for (const p of bowTiePlacements) {
    const inlay = new THREE.Mesh(bowTieGeo, accentWoodMat);
    inlay.userData.slot = "accent";
    inlay.position.set(p.x, dims.slabBottomY + dims.slabH * 0.52, p.z);
    inlay.rotation.y = p.ry;
    inlay.castShadow = true;
    inlay.receiveShadow = true;
    bodyGroup.add(inlay);
  }

  // --- 2. Four Carved Fluted Wooden Legs & Arched Apron Rails ---
  const legH = dims.slabBottomY + 0.016; // overlaps deeply into slab underside
  const legGeo = buildSculptedLeg(THREE, legH);
  const collarGeo = buildLegCollar(THREE);

  const legPositions = [
    { name: "legFL", x: -0.275, z: 0.150 },
    { name: "legFR", x: 0.275, z: 0.150 },
    { name: "legBL", x: -0.275, z: -0.150 },
    { name: "legBR", x: 0.275, z: -0.150 },
  ];

  for (const lp of legPositions) {
    const legGroup = new THREE.Group();
    legGroup.name = lp.name;
    legGroup.position.set(lp.x, 0, lp.z);

    const legMesh = new THREE.Mesh(legGeo, woodSideMat);
    legMesh.userData.slot = "primary";
    legMesh.castShadow = true;
    legMesh.receiveShadow = true;
    legGroup.add(legMesh);

    const collarMesh = new THREE.Mesh(collarGeo, accentWoodMat);
    collarMesh.userData.slot = "accent";
    collarMesh.castShadow = true;
    collarMesh.receiveShadow = true;
    legGroup.add(collarMesh);

    bodyGroup.add(legGroup);
  }

  // Arched wooden apron stretchers linking legs cleanly beneath the thick slab
  const apronH = 0.038;
  const apronThick = 0.016;
  const longApronGeo = buildApronRail(THREE, 0.53, apronH, apronThick);
  const shortApronGeo = buildApronRail(THREE, 0.28, apronH, apronThick);

  const apronConfigs = [
    { geo: longApronGeo, x: 0, z: 0.150, ry: 0 },
    { geo: longApronGeo, x: 0, z: -0.150, ry: 0 },
    { geo: shortApronGeo, x: -0.275, z: 0, ry: Math.PI * 0.5 },
    { geo: shortApronGeo, x: 0.275, z: 0, ry: Math.PI * 0.5 },
  ];

  for (const ac of apronConfigs) {
    const apron = new THREE.Mesh(ac.geo, woodUnderMat);
    apron.userData.slot = "primary";
    apron.position.set(ac.x, dims.slabBottomY - apronH + 0.005, ac.z);
    apron.rotation.y = ac.ry;
    apron.castShadow = true;
    apron.receiveShadow = true;
    bodyGroup.add(apron);
  }

  // --- 3. Two Lidded Bowls (Goke) on Curved Woven Coasters ---
  const coasterSize = 0.128;
  const coasterGeo = buildCurvedCoaster(THREE, coasterSize);
  const cordGeo = buildCoasterCord(THREE, coasterSize);
  const bowlGeo = buildGoBowl(THREE);
  const lidGeo = buildBowlLid(THREE);
  const bedGeo = buildBowlStoneBed(THREE);
  const stoneGeo = buildGoStone(THREE, 0.0132, 0.0108);

  // Left side: Open Black Stones Bowl + Upturned Lid with 2 Captured White Stones
  const bowlBlackGroup = new THREE.Group();
  bowlBlackGroup.name = "bowlBlack";
  bowlBlackGroup.position.set(-0.274, dims.topY, 0.056);
  bowlBlackGroup.rotation.y = 0.22;
  bodyGroup.add(bowlBlackGroup);

  const coasterL = new THREE.Mesh(coasterGeo, coasterMat);
  coasterL.userData.slot = "secondary";
  coasterL.rotation.y = -0.09;
  coasterL.receiveShadow = true;
  coasterL.castShadow = true;
  bowlBlackGroup.add(coasterL);

  const cordL = new THREE.Mesh(cordGeo, cordMat);
  cordL.userData.slot = "accent";
  cordL.rotation.y = -0.09;
  cordL.castShadow = true;
  bowlBlackGroup.add(cordL);

  const bowlBlackMesh = new THREE.Mesh(bowlGeo, bowlMat);
  bowlBlackMesh.userData.slot = "accent";
  bowlBlackMesh.position.y = 0.0022;
  bowlBlackMesh.castShadow = true;
  bowlBlackMesh.receiveShadow = true;
  bowlBlackGroup.add(bowlBlackMesh);

  const blackBed = new THREE.Mesh(bedGeo, blackStoneMat);
  blackBed.userData.slot = "accent";
  blackBed.position.y = 0.0022;
  blackBed.receiveShadow = true;
  bowlBlackGroup.add(blackBed);

  populateBowlStones(THREE, bowlBlackGroup, stoneGeo, blackStoneMat, "accent", 1.7);

  // Left lid resting upturned behind black bowl, cradling 2 captured white stones
  const lidBlackGroup = new THREE.Group();
  lidBlackGroup.name = "lidBlack";
  lidBlackGroup.position.set(-0.270, dims.topY, -0.092);
  lidBlackGroup.rotation.y = -0.35;
  bodyGroup.add(lidBlackGroup);

  const lidBlackMesh = new THREE.Mesh(lidGeo, bowlMat);
  lidBlackMesh.userData.slot = "accent";
  lidBlackMesh.position.y = 0.024; // exact height so flat crown touches topY when flipped
  lidBlackMesh.rotation.x = Math.PI;
  lidBlackMesh.castShadow = true;
  lidBlackMesh.receiveShadow = true;
  lidBlackGroup.add(lidBlackMesh);

  const capturedOffsets = [
    { x: -0.013, z: -0.005, rx: 0.08, rz: -0.10 },
    { x: 0.012, z: 0.007, rx: -0.06, rz: 0.11 },
  ];
  for (const co of capturedOffsets) {
    const cap = new THREE.Mesh(stoneGeo, whiteStoneMat);
    cap.userData.slot = "secondary";
    cap.position.set(co.x, 0.0064, co.z);
    cap.rotation.set(co.rx, co.x * 40, co.rz);
    cap.castShadow = true;
    cap.receiveShadow = true;
    lidBlackGroup.add(cap);
  }

  // Right side: Open White Stones Bowl + Matching Domed Lid resting right-side up beside it
  const bowlWhiteGroup = new THREE.Group();
  bowlWhiteGroup.name = "bowlWhite";
  bowlWhiteGroup.position.set(0.274, dims.topY, -0.052);
  bowlWhiteGroup.rotation.y = -0.30;
  bodyGroup.add(bowlWhiteGroup);

  const coasterR = new THREE.Mesh(coasterGeo, coasterMat);
  coasterR.userData.slot = "secondary";
  coasterR.rotation.y = 0.12;
  coasterR.receiveShadow = true;
  coasterR.castShadow = true;
  bowlWhiteGroup.add(coasterR);

  const cordR = new THREE.Mesh(cordGeo, cordMat);
  cordR.userData.slot = "accent";
  cordR.rotation.y = 0.12;
  cordR.castShadow = true;
  bowlWhiteGroup.add(cordR);

  const bowlWhiteMesh = new THREE.Mesh(bowlGeo, bowlMat);
  bowlWhiteMesh.userData.slot = "accent";
  bowlWhiteMesh.position.y = 0.0022;
  bowlWhiteMesh.castShadow = true;
  bowlWhiteMesh.receiveShadow = true;
  bowlWhiteGroup.add(bowlWhiteMesh);

  const whiteBed = new THREE.Mesh(bedGeo, whiteStoneMat);
  whiteBed.userData.slot = "secondary";
  whiteBed.position.y = 0.0022;
  whiteBed.receiveShadow = true;
  bowlWhiteGroup.add(whiteBed);

  populateBowlStones(THREE, bowlWhiteGroup, stoneGeo, whiteStoneMat, "secondary", 5.3);

  // Right lid resting cleanly right-side up showing its turned wooden dome & accent ring
  const lidWhiteGroup = new THREE.Group();
  lidWhiteGroup.name = "lidWhite";
  lidWhiteGroup.position.set(0.268, dims.topY, 0.095);
  lidWhiteGroup.rotation.y = 0.48;
  bodyGroup.add(lidWhiteGroup);

  const lidWhiteMesh = new THREE.Mesh(lidGeo, bowlMat);
  lidWhiteMesh.userData.slot = "accent";
  lidWhiteMesh.position.y = -0.0004;
  lidWhiteMesh.castShadow = true;
  lidWhiteMesh.receiveShadow = true;
  lidWhiteGroup.add(lidWhiteMesh);

  // --- 4. Cozy Mid-Game Stones Placed on the 13x13 Square Grid ---
  const stonesGroup = new THREE.Group();
  stonesGroup.name = "boardStones";
  bodyGroup.add(stonesGroup);

  // [col (0..12), row (0..12), color ("B" or "W")]
  const boardLayout = [
    // Upper-left corner approach & enclosure
    [3, 3, "B"],
    [5, 2, "B"],
    [2, 6, "B"],
    [4, 5, "B"],
    [3, 5, "W"],
    [2, 4, "W"],
    [5, 4, "W"],

    // Upper-right joseki
    [9, 3, "W"],
    [10, 5, "W"],
    [7, 2, "W"],
    [9, 5, "B"],
    [8, 4, "B"],
    [10, 6, "B"],

    // Lower-right corner
    [9, 9, "B"],
    [7, 10, "B"],
    [10, 8, "B"],
    [8, 9, "W"],
    [8, 8, "W"],
    [10, 10, "W"],

    // Lower-left & center tension
    [3, 9, "W"],
    [5, 10, "W"],
    [4, 8, "W"],
    [3, 8, "B"],
    [2, 9, "B"],
    [6, 6, "B"],
    [5, 7, "B"],
  ];

  const cell = dims.gridSize / dims.gridSteps;

  for (let i = 0; i < boardLayout.length; i++) {
    const [col, row, kind] = boardLayout[i];
    const isBlack = kind === "B";
    const stone = new THREE.Mesh(stoneGeo, isBlack ? blackStoneMat : whiteStoneMat);
    stone.userData.slot = isBlack ? "accent" : "secondary";

    // Subtle organic human hand-placement micro-jitter (+/- 0.7 mm)
    const jx = (kit.noise(col * 3.1 + i, row * 2.7) - 0.5) * 0.0014;
    const jz = (kit.noise(row * 3.9, col * 2.3 + i) - 0.5) * 0.0014;

    const wx = -dims.gridHalf + col * cell + jx;
    const wz = -dims.gridHalf + row * cell + jz;

    stone.position.set(wx, dims.topY - 0.0002, wz);
    stone.rotation.y = kit.noise(col * 7.3, row * 5.1) * Math.PI * 2;
    stone.castShadow = true;
    stone.receiveShadow = true;
    stonesGroup.add(stone);
  }

  return root;
}

export function idle(group, t) {
  // Static cozy wooden game table resting firmly on the floor
  if (!group || typeof t !== "number") return;
}
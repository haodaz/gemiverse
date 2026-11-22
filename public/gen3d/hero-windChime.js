export const META = {
  id: "cozy-wind-chime",
  name: "Cozy Dorm Wind Chime",
  kind: "prop",
  footprint: [0.16, 0.16],
  variants: [
    { name: "Sky Cotton", opts: { metal: "#d9d9d9", wood: "#c89462", accent: "#8fc1e8" } },
    { name: "Matcha Brass", opts: { metal: "#dfc488", wood: "#b78353", accent: "#a8cfa0" } },
    { name: "Peach Walnut", opts: { metal: "#e5c5b8", wood: "#7c5238", accent: "#f2a990" } },
    { name: "Lavender Silver", opts: { metal: "#dde2ea", wood: "#d2ad84", accent: "#b9a6e2" } }
  ],
  note: "Turned wooden top disc, five graduated hollow metal tubes, contoured wooden striker, braided cords, and a hand-painted curved paper wind-catcher for a cozy dorm-room diorama."
};

function parseHex(hex) {
  const clean = (hex || "#cccccc").replace("#", "").trim();
  const full = clean.length === 3
    ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
    : clean.padEnd(6, "0").slice(0, 6);
  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function rgbStr(c, a = 1) {
  if (a >= 0.999) return `rgb(${clampByte(c.r)},${clampByte(c.g)},${clampByte(c.b)})`;
  return `rgba(${clampByte(c.r)},${clampByte(c.g)},${clampByte(c.b)},${a.toFixed(3)})`;
}

function mixRgb(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
  };
}

function shadeRgb(c, factor) {
  return {
    r: clampByte(c.r * factor),
    g: clampByte(c.g * factor),
    b: clampByte(c.b * factor)
  };
}

function fbm(kit, x, y, octaves = 3) {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    val += kit.noise(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return val / norm;
}

function makeWoodTextures(THREE, kit, woodHex) {
  const base = parseHex(woodHex);
  const dark = shadeRgb(base, 0.58);
  const light = mixRgb(base, { r: 248, g: 232, b: 208 }, 0.28);
  const pore = shadeRgb(base, 0.42);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      const ny = y / h;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const warp = fbm(kit, nx * 2.4 + 1.3, ny * 6.5 + 4.1, 3);
        const rings = Math.sin((nx * 14.0 + warp * 5.2) * Math.PI);
        const grain = Math.pow(0.5 + 0.5 * rings, 1.85);
        const fine = kit.noise(nx * 44.0, ny * 8.0);
        const micro = kit.noise(nx * 96.0 + 7.2, ny * 18.0 + 2.4);
        let c = mixRgb(dark, light, 0.25 + grain * 0.65);
        c = mixRgb(c, base, 0.22);
        if (fine < 0.2) {
          c = mixRgb(c, pore, (0.2 - fine) * 2.4);
        }
        const shimmer = (micro - 0.5) * 14;
        const idx = (y * w + x) * 4;
        data[idx] = clampByte(c.r + shimmer);
        data[idx + 1] = clampByte(c.g + shimmer * 0.9);
        data[idx + 2] = clampByte(c.b + shimmer * 0.7);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      const ny = y / h;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const warp = fbm(kit, nx * 2.4 + 1.3, ny * 6.5 + 4.1, 3);
        const rings = 0.5 + 0.5 * Math.sin((nx * 14.0 + warp * 5.2) * Math.PI);
        const fine = kit.noise(nx * 44.0, ny * 8.0);
        let v = 135 + rings * 55;
        if (fine < 0.22) v -= (0.22 - fine) * 230;
        const b = clampByte(v);
        const idx = (y * w + x) * 4;
        data[idx] = b;
        data[idx + 1] = b;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

function makeMetalTextures(THREE, kit, metalHex) {
  const base = parseHex(metalHex);
  const bright = mixRgb(base, { r: 255, g: 253, b: 248 }, 0.32);
  const dim = shadeRgb(base, 0.74);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      const ny = y / h;
      const rimTone = 1.0 - 0.12 * Math.exp(-Math.pow((ny - 0.04) * 14, 2))
        - 0.12 * Math.exp(-Math.pow((ny - 0.96) * 14, 2));
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const brush = kit.noise(nx * 6.0, ny * 95.0);
        const sheen = kit.noise(nx * 4.0 + 3.1, ny * 10.0 + 1.7);
        let c = mixRgb(dim, bright, 0.36 + brush * 0.34 + sheen * 0.22);
        c = shadeRgb(c, rimTone);
        const idx = (y * w + x) * 4;
        data[idx] = clampByte(c.r);
        data[idx + 1] = clampByte(c.g);
        data[idx + 2] = clampByte(c.b);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      const ny = y / h;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const brush = kit.noise(nx * 7.0, ny * 110.0);
        const v = clampByte(110 + brush * 52);
        const idx = (y * w + x) * 4;
        data[idx] = v;
        data[idx + 1] = v;
        data[idx + 2] = v;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

function makeCordTextures(THREE, kit, woodHex) {
  const warmCotton = mixRgb({ r: 238, g: 229, b: 214 }, parseHex(woodHex), 0.18);
  const groove = shadeRgb(warmCotton, 0.68);
  const crest = mixRgb(warmCotton, { r: 255, g: 252, b: 245 }, 0.35);

  const map = kit.canvasTexture(128, 128, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      const ny = y / h;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const strandA = 0.5 + 0.5 * Math.sin((nx * 6 + ny * 18) * Math.PI * 2);
        const strandB = 0.5 + 0.5 * Math.sin((-nx * 6 + ny * 18) * Math.PI * 2);
        const weave = Math.max(strandA, strandB * 0.85);
        const fuzz = kit.noise(nx * 24, ny * 40) * 0.2;
        const c = mixRgb(groove, crest, Math.min(1, weave * 0.82 + fuzz));
        const idx = (y * w + x) * 4;
        data[idx] = clampByte(c.r);
        data[idx + 1] = clampByte(c.g);
        data[idx + 2] = clampByte(c.b);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(128, 128, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      const ny = y / h;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const strandA = 0.5 + 0.5 * Math.sin((nx * 6 + ny * 18) * Math.PI * 2);
        const strandB = 0.5 + 0.5 * Math.sin((-nx * 6 + ny * 18) * Math.PI * 2);
        const v = clampByte(70 + Math.max(strandA, strandB * 0.85) * 165);
        const idx = (y * w + x) * 4;
        data[idx] = v;
        data[idx + 1] = v;
        data[idx + 2] = v;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

function makePaperTagTextures(THREE, kit, accentHex, woodHex) {
  const accent = parseHex(accentHex);
  const cream = { r: 252, g: 247, b: 238 };
  const softTint = mixRgb(cream, accent, 0.34);
  const deepTint = mixRgb(accent, shadeRgb(accent, 0.62), 0.45);
  const goldInk = mixRgb({ r: 215, g: 174, b: 108 }, parseHex(woodHex), 0.35);

  const map = kit.canvasTexture(256, 704, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, rgbStr(cream));
    grad.addColorStop(0.24, rgbStr(softTint));
    grad.addColorStop(0.62, rgbStr(mixRgb(cream, accent, 0.72)));
    grad.addColorStop(1.0, rgbStr(deepTint));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Soft watercolor blooms
    for (let i = 0; i < 18; i++) {
      const bx = kit.noise(i * 1.7 + 0.4, 2.3) * w;
      const by = (0.15 + kit.noise(3.1, i * 2.1 + 0.7) * 0.8) * h;
      const br = 34 + kit.noise(i * 3.3, 5.1) * 62;
      const bloomCol = i % 3 === 0 ? cream : (i % 2 === 0 ? accent : deepTint);
      const rg = ctx.createRadialGradient(bx, by, 4, bx, by, br);
      rg.addColorStop(0, rgbStr(bloomCol, 0.22));
      rg.addColorStop(1, rgbStr(bloomCol, 0.0));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }

    // Handmade washi paper speckles & delicate fibers
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 240; i++) {
      const fx = kit.noise(i * 0.73 + 11.2, 4.7) * w;
      const fy = kit.noise(7.9, i * 0.89 + 3.4) * h;
      const ang = kit.noise(i * 1.4, i * 0.5) * Math.PI * 2;
      const len = 4 + kit.noise(i * 2.2, 9.1) * 10;
      ctx.strokeStyle = i % 2 === 0 ? rgbStr(cream, 0.34) : rgbStr(goldInk, 0.16);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + Math.cos(ang) * len, fy + Math.sin(ang) * len);
      ctx.stroke();
    }

    // Hand-drawn inner frame border
    ctx.strokeStyle = rgbStr(goldInk, 0.65);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(18, 28, w - 36, h - 66, 22);
    ctx.stroke();

    ctx.strokeStyle = rgbStr(cream, 0.55);
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.roundRect(26, 36, w - 52, h - 82, 16);
    ctx.stroke();
    ctx.setLineDash([]);

    // Cozy crescent moon illustration
    const moonX = w * 0.52;
    const moonY = h * 0.35;
    const moonR = 40;
    ctx.save();
    ctx.fillStyle = rgbStr({ r: 255, g: 249, b: 230 }, 0.94);
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-atop";
    const cutGrad = ctx.createLinearGradient(0, moonY - moonR, 0, moonY + moonR);
    cutGrad.addColorStop(0, rgbStr(mixRgb(cream, accent, 0.54)));
    cutGrad.addColorStop(1, rgbStr(mixRgb(cream, accent, 0.74)));
    ctx.fillStyle = cutGrad;
    ctx.beginPath();
    ctx.arc(moonX + 16, moonY - 10, moonR * 0.86, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Tiny hanging star dangling from moon tip
    ctx.strokeStyle = rgbStr(goldInk, 0.82);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(moonX - 18, moonY + 34);
    ctx.lineTo(moonX - 18, moonY + 62);
    ctx.stroke();

    const drawSparkle = (cx, cy, r, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const rad = i % 2 === 0 ? r : r * 0.28;
        const px = cx + Math.cos(a) * rad;
        const py = cy + Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    };

    drawSparkle(moonX - 18, moonY + 70, 11, rgbStr({ r: 255, g: 247, b: 215 }, 0.95));
    drawSparkle(w * 0.28, h * 0.26, 8, rgbStr(cream, 0.88));
    drawSparkle(w * 0.74, h * 0.29, 7, rgbStr(cream, 0.85));
    drawSparkle(w * 0.72, h * 0.48, 9, rgbStr({ r: 255, g: 248, b: 224 }, 0.9));
    drawSparkle(w * 0.30, h * 0.62, 7, rgbStr(cream, 0.82));

    // Scattered tiny stardust dots
    ctx.fillStyle = rgbStr(cream, 0.75);
    const dots = [
      [0.24, 0.34, 2.5], [0.78, 0.37, 2.2], [0.36, 0.22, 2.0],
      [0.64, 0.21, 2.4], [0.26, 0.51, 2.6], [0.76, 0.60, 2.3],
      [0.50, 0.19, 2.2], [0.62, 0.66, 2.0]
    ];
    for (const [dx, dy, dr] of dots) {
      ctx.beginPath();
      ctx.arc(w * dx, h * dy, dr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fluffy cloud puff below the moon
    const drawCloud = (cx, cy, sc, alpha) => {
      ctx.fillStyle = rgbStr(cream, alpha);
      const puffs = [
        [-28, 4, 18], [-10, -6, 22], [12, -3, 20], [30, 5, 15], [0, 8, 22]
      ];
      ctx.beginPath();
      for (const [ox, oy, or] of puffs) {
        ctx.moveTo(cx + ox * sc + or * sc, cy + oy * sc);
        ctx.arc(cx + ox * sc, cy + oy * sc, or * sc, 0, Math.PI * 2);
      }
      ctx.fill();
    };
    drawCloud(w * 0.56, h * 0.54, 1.08, 0.86);
    drawCloud(w * 0.34, h * 0.47, 0.68, 0.62);

    // Gentle breeze ribbon swirls near bottom
    ctx.strokeStyle = rgbStr(cream, 0.68);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    for (let k = 0; k < 3; k++) {
      const sy = h * (0.70 + k * 0.055);
      ctx.beginPath();
      ctx.moveTo(w * 0.22, sy);
      ctx.bezierCurveTo(w * 0.38, sy - 14, w * 0.62, sy + 14, w * 0.78, sy - 4);
      ctx.stroke();
    }

    // Soft eyelet shadow ring at top
    const ey = h * 0.085;
    const eg = ctx.createRadialGradient(w * 0.5, ey, 4, w * 0.5, ey, 22);
    eg.addColorStop(0, rgbStr(shadeRgb(goldInk, 0.5), 0.35));
    eg.addColorStop(1, rgbStr(goldInk, 0.0));
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.arc(w * 0.5, ey, 22, 0, Math.PI * 2);
    ctx.fill();
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      const ny = y / h;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const tooth = fbm(kit, nx * 28.0, ny * 28.0, 3);
        const weave = kit.noise(nx * 64.0, ny * 16.0) * 0.4 + kit.noise(nx * 16.0, ny * 64.0) * 0.4;
        const v = clampByte(95 + tooth * 90 + weave * 55);
        const idx = (y * w + x) * 4;
        data[idx] = v;
        data[idx + 1] = v;
        data[idx + 2] = v;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 5);

  return { map, bumpMap };
}

function applySolidWoodUVs(geom, scale = 0.14) {
  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const u = (x * 0.88 + y * 0.36) / scale + 0.5;
    const v = (z * 0.88 - y * 0.24) / scale + 0.5;
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
}

function buildTaperedTube(THREE, points, radiusFn, tubularSegs = 28, radialSegs = 10, capEnds = true) {
  const curve = new THREE.CatmullRomCurve3(points);
  const length = curve.getLength();
  const framesT = [];
  const framesN = [];
  const framesB = [];
  const samplePts = [];

  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    samplePts.push(curve.getPoint(t));
    framesT.push(curve.getTangent(t).normalize());
  }

  const initN = new THREE.Vector3();
  if (Math.abs(framesT[0].y) < 0.9) {
    initN.set(0, 1, 0).cross(framesT[0]).normalize();
  } else {
    initN.set(1, 0, 0).cross(framesT[0]).normalize();
  }
  framesN.push(initN);
  framesB.push(new THREE.Vector3().crossVectors(framesT[0], initN).normalize());

  const q = new THREE.Quaternion();
  for (let i = 1; i <= tubularSegs; i++) {
    q.setFromUnitVectors(framesT[i - 1], framesT[i]);
    const n = framesN[i - 1].clone().applyQuaternion(q);
    n.addScaledVector(framesT[i], -n.dot(framesT[i])).normalize();
    framesN.push(n);
    framesB.push(new THREE.Vector3().crossVectors(framesT[i], n).normalize());
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const ringStride = radialSegs + 1;
  const uvRepeatV = Math.max(1, length / 0.015);

  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    const p = samplePts[i];
    const r = radiusFn(t);
    const N = framesN[i];
    const B = framesB[i];
    for (let j = 0; j <= radialSegs; j++) {
      const a = (j / radialSegs) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      positions.push(
        p.x + (N.x * ca + B.x * sa) * r,
        p.y + (N.y * ca + B.y * sa) * r,
        p.z + (N.z * ca + B.z * sa) * r
      );
      uvs.push(j / radialSegs, t * uvRepeatV);
    }
  }

  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * ringStride + j;
      const b = (i + 1) * ringStride + j;
      const c = (i + 1) * ringStride + j + 1;
      const d = i * ringStride + j + 1;
      indices.push(a, b, d, b, c, d);
    }
  }

  if (capEnds) {
    const startCenterIdx = positions.length / 3;
    positions.push(samplePts[0].x, samplePts[0].y, samplePts[0].z);
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(startCenterIdx, j + 1, j);
    }

    const endCenterIdx = positions.length / 3;
    const lastPt = samplePts[tubularSegs];
    positions.push(lastPt.x, lastPt.y, lastPt.z);
    uvs.push(0.5, uvRepeatV);
    const lastRing = tubularSegs * ringStride;
    for (let j = 0; j < radialSegs; j++) {
      indices.push(endCenterIdx, lastRing + j, lastRing + j + 1);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function buildTopDiscGeometry(THREE) {
  const pts = [
    [0.0001, -0.0102],
    [0.012, -0.0092],
    [0.026, -0.0086],
    [0.036, -0.0092],
    [0.043, -0.0104],
    [0.052, -0.0104],
    [0.061, -0.0101],
    [0.0665, -0.0086],
    [0.0702, -0.0056],
    [0.0720, -0.0018],
    [0.0722, 0.0016],
    [0.0708, 0.0050],
    [0.0676, 0.0076],
    [0.0630, 0.0089],
    [0.0588, 0.0086],
    [0.0566, 0.0074],
    [0.0542, 0.0088],
    [0.0485, 0.0098],
    [0.0410, 0.0106],
    [0.0315, 0.0114],
    [0.0210, 0.0120],
    [0.0110, 0.0124],
    [0.0001, 0.0126]
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const geom = new THREE.LatheGeometry(pts, 64);
  applySolidWoodUVs(geom, 0.145);
  geom.computeVertexNormals();
  return geom;
}

function buildStrikerGeometry(THREE) {
  const pts = [
    [0.0001, -0.0078],
    [0.008, -0.0076],
    [0.015, -0.0072],
    [0.0215, -0.0064],
    [0.0262, -0.0049],
    [0.0290, -0.0028],
    [0.0302, -0.0006],
    [0.0302, 0.0006],
    [0.0290, 0.0028],
    [0.0262, 0.0049],
    [0.0215, 0.0064],
    [0.015, 0.0072],
    [0.008, 0.0076],
    [0.0038, 0.0079],
    [0.0024, 0.0084],
    [0.0001, 0.0085]
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const geom = new THREE.LatheGeometry(pts, 48);
  applySolidWoodUVs(geom, 0.075);
  geom.computeVertexNormals();
  return geom;
}

function buildBeadGeometry(THREE, radius = 0.0065, heightRatio = 0.88) {
  const pts = [];
  const segs = 18;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const ang = -Math.PI * 0.5 + t * Math.PI;
    const r = Math.max(0.0002, Math.cos(ang) * radius * (1.0 - 0.08 * Math.pow(Math.sin(ang), 2)));
    const y = Math.sin(ang) * radius * heightRatio;
    pts.push(new THREE.Vector2(r, y));
  }
  const geom = new THREE.LatheGeometry(pts, 32);
  applySolidWoodUVs(geom, radius * 3.5);
  geom.computeVertexNormals();
  return geom;
}

function buildHollowTubeGeometry(THREE, length, outerR = 0.0084, innerR = 0.0065) {
  const topY = 0;
  const botY = -length;
  const rim = (outerR - innerR) * 0.5;
  const midR = (outerR + innerR) * 0.5;

  const pts = [
    // Bottom outer bevel up to top outer bevel
    [midR, botY],
    [outerR - rim * 0.35, botY + rim * 0.12],
    [outerR - rim * 0.05, botY + rim * 0.45],
    [outerR, botY + rim * 1.15],
    [outerR, botY + length * 0.25],
    [outerR, botY + length * 0.50],
    [outerR, botY + length * 0.75],
    [outerR, topY - rim * 1.15],
    [outerR - rim * 0.05, topY - rim * 0.45],
    [outerR - rim * 0.35, topY - rim * 0.12],
    // Rounded top lip
    [midR, topY],
    [innerR + rim * 0.35, topY - rim * 0.12],
    [innerR + rim * 0.05, topY - rim * 0.45],
    [innerR, topY - rim * 1.15],
    // Down inner cavity wall
    [innerR, botY + length * 0.72],
    [innerR, botY + length * 0.32],
    [innerR, botY + rim * 1.15],
    [innerR + rim * 0.05, botY + rim * 0.45],
    [innerR + rim * 0.35, botY + rim * 0.12],
    [midR, botY]
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const geom = new THREE.LatheGeometry(pts, 38);
  geom.computeVertexNormals();
  return geom;
}

function buildGrommetGeometry(THREE, outerR = 0.0032, innerR = 0.0017, halfH = 0.0011) {
  const midR = (outerR + innerR) * 0.5;
  const pts = [];
  const segs = 16;
  for (let i = 0; i <= segs; i++) {
    const a = -Math.PI * 0.5 + (i / segs) * Math.PI * 2;
    const r = midR + Math.cos(a) * (outerR - midR);
    const y = Math.sin(a) * halfH;
    pts.push(new THREE.Vector2(Math.max(0.0002, r), y));
  }
  const geom = new THREE.LatheGeometry(pts, 20);
  geom.computeVertexNormals();
  return geom;
}

function buildPaperTagGeometry(THREE, width = 0.048, height = 0.132, thickness = 0.0013) {
  const hw = width * 0.5;
  const shape = new THREE.Shape();

  // Origin at top-center (0, 0), hanging down to (0, -height)
  // Top rounded crest
  shape.moveTo(0, 0);
  shape.bezierCurveTo(hw * 0.45, 0, hw * 0.88, -0.003, hw * 0.96, -0.014);

  // Right side split into gentle Bezier spans for silky bending
  const rightSpans = [
    [hw * 0.99, -0.028, hw * 0.96, -0.042],
    [hw * 0.94, -0.056, hw * 0.95, -0.070],
    [hw * 0.97, -0.084, hw * 1.00, -0.098],
    [hw * 1.01, -0.109, hw * 0.96, -0.119]
  ];
  let prevX = hw * 0.96;
  let prevY = -0.014;
  for (const [cx, cy, ex, ey] of rightSpans) {
    shape.bezierCurveTo(
      (prevX + cx) * 0.5, (prevY + cy) * 0.5,
      cx, cy,
      ex, ey
    );
    prevX = ex;
    prevY = ey;
  }

  // Scalloped cozy bookmark tip at bottom
  shape.bezierCurveTo(hw * 0.82, -height + 0.004, hw * 0.34, -height + 0.007, 0, -height);
  shape.bezierCurveTo(-hw * 0.34, -height + 0.007, -hw * 0.82, -height + 0.004, -hw * 0.96, -0.119);

  // Left side rising smoothly back to top crest
  const leftSpans = [
    [-hw * 1.01, -0.109, -hw * 1.00, -0.098],
    [-hw * 0.97, -0.084, -hw * 0.95, -0.070],
    [-hw * 0.94, -0.056, -hw * 0.96, -0.042],
    [-hw * 0.99, -0.028, -hw * 0.96, -0.014]
  ];
  prevX = -hw * 0.96;
  prevY = -0.119;
  for (const [cx, cy, ex, ey] of leftSpans) {
    shape.bezierCurveTo(
      (prevX + cx) * 0.5, (prevY + cy) * 0.5,
      cx, cy,
      ex, ey
    );
    prevX = ex;
    prevY = ey;
  }
  shape.bezierCurveTo(-hw * 0.88, -0.003, -hw * 0.45, 0, 0, 0);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.00035,
    bevelSize: 0.00035,
    bevelSegments: 2,
    curveSegments: 16
  });

  // Center thickness on Z = 0, normalize UVs to [0, 1], and curl like a fluttering paper strip
  geom.translate(0, 0, -thickness * 0.5);
  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const u = Math.max(0, Math.min(1, (x + hw) / width));
    const v = Math.max(0, Math.min(1, (y + height) / height));
    uv.setXY(i, u, v);

    // Distance down from top eyelet (0 at top, 1 at bottom tip)
    const s = Math.max(0, Math.min(1, -y / height));
    const waveZ = 0.0072 * Math.sin(s * Math.PI * 1.18) * Math.pow(s, 0.9);
    const twist = 0.16 * s * s;
    const ct = Math.cos(twist);
    const st = Math.sin(twist);
    const nz = z + waveZ;
    const rx = x * ct - nz * st;
    const rz = x * st + nz * ct;
    pos.setXYZ(i, rx, y, rz);
  }
  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

export function build(THREE, opts = {}, kit) {
  const cfg = {
    metal: opts.metal || "#d9d9d9",
    wood: opts.wood || "#c89462",
    accent: opts.accent || "#8fc1e8"
  };

  const root = new THREE.Group();
  root.name = "cozyWindChime";

  // Procedural textures
  const woodTex = makeWoodTextures(THREE, kit, cfg.wood);
  const metalTex = makeMetalTextures(THREE, kit, cfg.metal);
  const cordTex = makeCordTextures(THREE, kit, cfg.wood);
  const paperTex = makePaperTagTextures(THREE, kit, cfg.accent, cfg.wood);

  // Physical materials
  const woodMat = new THREE.MeshPhysicalMaterial({
    map: woodTex.map,
    bumpMap: woodTex.bumpMap,
    bumpScale: 0.0012,
    roughness: 0.44,
    metalness: 0.0,
    clearcoat: 0.38,
    clearcoatRoughness: 0.34
  });

  const metalMat = new THREE.MeshPhysicalMaterial({
    map: metalTex.map,
    bumpMap: metalTex.bumpMap,
    bumpScale: 0.0005,
    metalness: 0.88,
    roughness: 0.24,
    clearcoat: 0.22,
    clearcoatRoughness: 0.25
  });

  const brassMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#d8b674"),
    metalness: 0.90,
    roughness: 0.28,
    clearcoat: 0.2
  });

  const cordMat = new THREE.MeshPhysicalMaterial({
    map: cordTex.map,
    bumpMap: cordTex.bumpMap,
    bumpScale: 0.0016,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.78,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color("#fff9ef")
  });

  const paperSheenCol = new THREE.Color(cfg.accent).lerp(new THREE.Color("#ffffff"), 0.55);
  const paperMat = new THREE.MeshPhysicalMaterial({
    map: paperTex.map,
    bumpMap: paperTex.bumpMap,
    bumpScale: 0.0008,
    roughness: 0.88,
    metalness: 0.0,
    sheen: 0.68,
    sheenRoughness: 0.82,
    sheenColor: paperSheenCol
  });

  const ceramicAccentMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(cfg.accent),
    roughness: 0.18,
    metalness: 0.02,
    clearcoat: 0.92,
    clearcoatRoughness: 0.12
  });

  const tagMesh = (mesh, slot) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (slot) mesh.userData.slot = slot;
    return mesh;
  };

  // Whole wind chime pivots gently from the top suspension point at world y = 0.610
  const body = new THREE.Group();
  body.name = "body";
  body.position.set(0, 0.610, 0);
  root.add(body);

  // Shared small geometries
  const grommetSmallGeo = buildGrommetGeometry(THREE, 0.0029, 0.0014, 0.0011);
  const grommetTinyGeo = buildGrommetGeometry(THREE, 0.0022, 0.0010, 0.0009);
  const beadSmallGeo = buildBeadGeometry(THREE, 0.0046, 0.86);
  const beadCrownGeo = buildBeadGeometry(THREE, 0.0102, 0.92);
  const beadAccentGeo = buildBeadGeometry(THREE, 0.0076, 0.95);

  // Top hanging brass ring
  const ringPts = [];
  const ringSegs = 24;
  const ringR = 0.0145;
  for (let i = 0; i <= ringSegs; i++) {
    const a = (i / ringSegs) * Math.PI * 2;
    ringPts.push(new THREE.Vector3(Math.sin(a) * ringR, -0.0135 + Math.cos(a) * ringR, 0));
  }
  const hangRingGeo = buildTaperedTube(THREE, ringPts, () => 0.0019, 40, 12, false);
  const hangRing = tagMesh(new THREE.Mesh(hangRingGeo, brassMat), "secondary");
  hangRing.name = "hangingRing";
  body.add(hangRing);

  // Braided top loop connecting hanging ring to wooden crown bead
  const topLoopPts = [
    new THREE.Vector3(-0.0022, -0.040, 0),
    new THREE.Vector3(-0.0042, -0.032, 0.0006),
    new THREE.Vector3(-0.0025, -0.025, 0.0004),
    new THREE.Vector3(0, -0.024, 0),
    new THREE.Vector3(0.0025, -0.025, -0.0004),
    new THREE.Vector3(0.0042, -0.032, -0.0006),
    new THREE.Vector3(0.0022, -0.040, 0)
  ];
  const topLoopMesh = tagMesh(
    new THREE.Mesh(buildTaperedTube(THREE, topLoopPts, () => 0.0015, 24, 8, false), cordMat)
  );
  body.add(topLoopMesh);

  // Wooden crown bead
  const crownBead = tagMesh(new THREE.Mesh(beadCrownGeo, woodMat), "primary");
  crownBead.position.set(0, -0.044, 0);
  body.add(crownBead);

  const crownCollar = tagMesh(new THREE.Mesh(grommetSmallGeo, brassMat), "secondary");
  crownCollar.position.set(0, -0.0348, 0);
  body.add(crownCollar);

  // Wooden top disc ("head")
  const head = new THREE.Group();
  head.name = "head";
  head.position.set(0, -0.115, 0);
  body.add(head);

  const topDiscMesh = tagMesh(new THREE.Mesh(buildTopDiscGeometry(THREE), woodMat), "primary");
  topDiscMesh.name = "woodenTopDisc";
  head.add(topDiscMesh);

  // Decorative brass center pin on top of disc
  const centerPinGeo = buildBeadGeometry(THREE, 0.0042, 0.45);
  const centerPin = tagMesh(new THREE.Mesh(centerPinGeo, brassMat), "secondary");
  centerPin.position.set(0, 0.0126, 0);
  head.add(centerPin);

  // Three suspension harness cords from crown bead to wooden top disc
  const harnessR = 0.043;
  for (let i = 0; i < 3; i++) {
    const a = 0.35 + (i * Math.PI * 2) / 3;
    const tx = Math.sin(a) * harnessR;
    const tz = Math.cos(a) * harnessR;
    const pts = [
      new THREE.Vector3(Math.sin(a) * 0.003, -0.049, Math.cos(a) * 0.003),
      new THREE.Vector3(tx * 0.34, -0.068, tz * 0.34),
      new THREE.Vector3(tx * 0.72, -0.088, tz * 0.72),
      new THREE.Vector3(tx, -0.1045, tz)
    ];
    const cordMesh = tagMesh(
      new THREE.Mesh(
        buildTaperedTube(THREE, pts, (t) => 0.00125 * (1.0 - 0.1 * Math.sin(t * Math.PI)), 20, 8, true),
        cordMat
      )
    );
    body.add(cordMesh);

    const eyeTop = tagMesh(new THREE.Mesh(grommetSmallGeo, brassMat), "secondary");
    eyeTop.position.set(tx, 0.0105, tz);
    head.add(eyeTop);
  }

  // Underside center eyelet for striker cord
  const centerUnderEye = tagMesh(new THREE.Mesh(grommetSmallGeo, brassMat), "secondary");
  centerUnderEye.position.set(0, -0.0104, 0);
  head.add(centerUnderEye);

  // Five graduated metal tubes hanging from the underside of the wooden top disc
  const tubeConfigs = [
    { length: 0.148, drop: 0.072 },
    { length: 0.172, drop: 0.064 },
    { length: 0.196, drop: 0.056 },
    { length: 0.222, drop: 0.048 },
    { length: 0.248, drop: 0.040 }
  ];
  const ringRadius = 0.052;
  const tubeOuterR = 0.0084;
  const tubeInnerR = 0.0065;
  const baseTheta = 0.06;
  const tubePivots = [];

  for (let i = 0; i < tubeConfigs.length; i++) {
    const { length, drop } = tubeConfigs[i];
    const theta = baseTheta + (i * Math.PI * 2) / 5;
    const ax = Math.sin(theta) * ringRadius;
    const az = Math.cos(theta) * ringRadius;

    // Brass grommet under top disc
    const underEye = tagMesh(new THREE.Mesh(grommetSmallGeo, brassMat), "secondary");
    underEye.position.set(ax, -0.0104, az);
    head.add(underEye);

    // Tube pendulum pivot anchored right at the underside eyelet
    const pivot = new THREE.Group();
    pivot.name = `tubePivot${i + 1}`;
    pivot.position.set(ax, -0.1254, az);
    body.add(pivot);

    // Orient cradle plane tangentially for neat visual alignment
    const holeAng = theta + Math.PI * 0.5;
    const hx = Math.sin(holeAng);
    const hz = Math.cos(holeAng);
    const knotY = -drop + 0.016;
    const holeY = -drop - 0.0135;

    // Vertical drop cord from disc eyelet to cradle knot bead
    const dropCordPts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, knotY * 0.5, 0),
      new THREE.Vector3(0, knotY, 0)
    ];
    pivot.add(tagMesh(
      new THREE.Mesh(buildTaperedTube(THREE, dropCordPts, () => 0.00085, 10, 7, false), cordMat)
    ));

    // Tiny wooden knot bead at the Y-split
    const knotBead = tagMesh(new THREE.Mesh(beadSmallGeo, woodMat), "primary");
    knotBead.scale.setScalar(0.74);
    knotBead.position.set(0, knotY, 0);
    pivot.add(knotBead);

    // Cradle loop cord descending to both sides of the tube and threading through the holes
    const cradlePts = [
      new THREE.Vector3(0, knotY, 0),
      new THREE.Vector3(hx * (tubeOuterR * 0.72), (knotY + holeY) * 0.52, hz * (tubeOuterR * 0.72)),
      new THREE.Vector3(hx * (tubeOuterR + 0.0006), holeY, hz * (tubeOuterR + 0.0006)),
      new THREE.Vector3(0, holeY - 0.0008, 0),
      new THREE.Vector3(-hx * (tubeOuterR + 0.0006), holeY, -hz * (tubeOuterR + 0.0006)),
      new THREE.Vector3(-hx * (tubeOuterR * 0.72), (knotY + holeY) * 0.52, -hz * (tubeOuterR * 0.72)),
      new THREE.Vector3(0, knotY, 0)
    ];
    pivot.add(tagMesh(
      new THREE.Mesh(buildTaperedTube(THREE, cradlePts, () => 0.00075, 24, 7, false), cordMat)
    ));

    // Hollow metal tube
    const tubeMesh = tagMesh(
      new THREE.Mesh(buildHollowTubeGeometry(THREE, length, tubeOuterR, tubeInnerR), metalMat),
      "secondary"
    );
    tubeMesh.name = `metalTube${i + 1}`;
    tubeMesh.position.set(0, -drop, 0);
    pivot.add(tubeMesh);

    // Pair of tiny brass grommets at the tube's suspension holes
    for (const side of [-1, 1]) {
      const holeEye = tagMesh(new THREE.Mesh(grommetTinyGeo, brassMat), "secondary");
      holeEye.position.set(side * hx * (tubeOuterR + 0.0002), holeY, side * hz * (tubeOuterR + 0.0002));
      holeEye.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(side * hx, 0, side * hz).normalize()
      );
      pivot.add(holeEye);
    }

    tubePivots.push({ pivot, length, phase: i * 1.37 + 0.4 });
  }

  // Central striker pendulum pivoted at underside center of top disc
  const strikerPivot = new THREE.Group();
  strikerPivot.name = "strikerPivot";
  strikerPivot.position.set(0, -0.1254, 0);
  body.add(strikerPivot);

  const strikerLocalY = -0.203; // World y = 0.610 - 0.1254 - 0.203 = 0.2816 m

  // Central cord from top disc down to striker
  const strikerCordPts = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.0004, strikerLocalY * 0.35, -0.0003),
    new THREE.Vector3(-0.0003, strikerLocalY * 0.7, 0.0004),
    new THREE.Vector3(0, strikerLocalY, 0)
  ];
  strikerPivot.add(tagMesh(
    new THREE.Mesh(buildTaperedTube(THREE, strikerCordPts, () => 0.00105, 18, 8, false), cordMat)
  ));

  // Small wooden bead above striker
  const upperStrikerBead = tagMesh(new THREE.Mesh(beadSmallGeo, woodMat), "primary");
  upperStrikerBead.position.set(0, strikerLocalY + 0.0115, 0);
  strikerPivot.add(upperStrikerBead);

  // Round contoured wooden striker
  const strikerMesh = tagMesh(new THREE.Mesh(buildStrikerGeometry(THREE), woodMat), "primary");
  strikerMesh.name = "roundStriker";
  strikerMesh.position.set(0, strikerLocalY, 0);
  strikerPivot.add(strikerMesh);

  // Small brass ferrule on top and bottom of striker
  const strikerCapTop = tagMesh(new THREE.Mesh(grommetTinyGeo, brassMat), "secondary");
  strikerCapTop.position.set(0, strikerLocalY + 0.0082, 0);
  strikerPivot.add(strikerCapTop);

  // Hanging paper tag ("tail") pivoted right beneath the striker
  const tail = new THREE.Group();
  tail.name = "tail";
  tail.position.set(0, strikerLocalY - 0.008, 0);
  strikerPivot.add(tail);

  const lowerStrikerBead = tagMesh(new THREE.Mesh(beadSmallGeo, woodMat), "primary");
  lowerStrikerBead.position.set(0, -0.0042, 0);
  tail.add(lowerStrikerBead);

  // Lower braided cord from striker down to the paper tag eyelet
  const tagTopY = -0.095; // World y = 0.2816 - 0.008 - 0.095 = 0.1786 m
  const tagHoleY = tagTopY - 0.011;
  const lowerCordPts = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.0005, tagHoleY * 0.36, 0.0004),
    new THREE.Vector3(0.0004, tagHoleY * 0.72, -0.0003),
    new THREE.Vector3(0, tagHoleY, 0)
  ];
  tail.add(tagMesh(
    new THREE.Mesh(buildTaperedTube(THREE, lowerCordPts, () => 0.0010, 18, 8, false), cordMat)
  ));

  // Decorative bead trio above the paper tag (wood - glossy ceramic accent - wood)
  const beadClusterY = -0.052;
  const accentBead = tagMesh(new THREE.Mesh(beadAccentGeo, ceramicAccentMat), "accent");
  accentBead.position.set(0, beadClusterY, 0);
  tail.add(accentBead);

  const spacerTop = tagMesh(new THREE.Mesh(beadSmallGeo, woodMat), "primary");
  spacerTop.scale.setScalar(0.82);
  spacerTop.position.set(0, beadClusterY + 0.0102, 0);
  tail.add(spacerTop);

  const spacerBot = tagMesh(new THREE.Mesh(beadSmallGeo, woodMat), "primary");
  spacerBot.scale.setScalar(0.82);
  spacerBot.position.set(0, beadClusterY - 0.0102, 0);
  tail.add(spacerBot);

  // Curved hanging paper tag
  const tagGeo = buildPaperTagGeometry(THREE, 0.048, 0.132, 0.0013);
  const paperTagMesh = tagMesh(new THREE.Mesh(tagGeo, paperMat), "accent");
  paperTagMesh.name = "paperTag";
  paperTagMesh.position.set(0, tagTopY, 0);
  tail.add(paperTagMesh);

  // Brass eyelet ring on the paper tag hole
  const tagEyelet = tagMesh(new THREE.Mesh(grommetSmallGeo, brassMat), "secondary");
  tagEyelet.rotation.x = Math.PI * 0.5;
  tagEyelet.position.set(0, tagHoleY, 0.0004);
  tail.add(tagEyelet);

  // Cozy little tied cotton bow & trailing knot ends at the paper tag eyelet
  const bowLoopL = [
    new THREE.Vector3(0, tagHoleY + 0.001, 0.0015),
    new THREE.Vector3(-0.007, tagHoleY + 0.007, 0.0032),
    new THREE.Vector3(-0.011, tagHoleY + 0.002, 0.0028),
    new THREE.Vector3(-0.006, tagHoleY - 0.003, 0.0020),
    new THREE.Vector3(0, tagHoleY, 0.0015)
  ];
  const bowLoopR = bowLoopL.map((p) => new THREE.Vector3(-p.x, p.y, p.z));
  const bowTailL = [
    new THREE.Vector3(0, tagHoleY, 0.0016),
    new THREE.Vector3(-0.004, tagHoleY - 0.007, 0.0026),
    new THREE.Vector3(-0.0075, tagHoleY - 0.016, 0.0034)
  ];
  const bowTailR = [
    new THREE.Vector3(0, tagHoleY, 0.0016),
    new THREE.Vector3(0.0045, tagHoleY - 0.006, 0.0025),
    new THREE.Vector3(0.0085, tagHoleY - 0.014, 0.0036)
  ];
  tail.add(tagMesh(new THREE.Mesh(buildTaperedTube(THREE, bowLoopL, () => 0.00085, 16, 6, false), cordMat)));
  tail.add(tagMesh(new THREE.Mesh(buildTaperedTube(THREE, bowLoopR, () => 0.00085, 16, 6, false), cordMat)));
  tail.add(tagMesh(new THREE.Mesh(buildTaperedTube(THREE, bowTailL, (t) => 0.00085 * (1 - t * 0.45), 12, 6, true), cordMat)));
  tail.add(tagMesh(new THREE.Mesh(buildTaperedTube(THREE, bowTailR, (t) => 0.00085 * (1 - t * 0.45), 12, 6, true), cordMat)));

  root.userData._anim = {
    body,
    head,
    strikerPivot,
    tail,
    tubePivots
  };

  return root;
}

export function idle(group, t) {
  const anim = group.userData && group.userData._anim;
  if (!anim) return;

  const { body, strikerPivot, tail, tubePivots } = anim;

  // Gentle dorm-window breeze modulation
  const gust = 0.65 + 0.35 * Math.sin(t * 0.42) + 0.2 * Math.sin(t * 0.91 + 1.1);

  // Subtle whole-chime pendulum sway from the top hanging ring
  body.rotation.z = Math.sin(t * 0.85) * 0.022 * gust;
  body.rotation.x = Math.cos(t * 0.68 + 0.5) * 0.016 * gust;
  body.rotation.y = Math.sin(t * 0.34) * 0.08;

  // Individual tubes sway softly with length-based pendulum frequencies
  for (let i = 0; i < tubePivots.length; i++) {
    const { pivot, length, phase } = tubePivots[i];
    const freq = 1.45 + (0.25 - length) * 4.2;
    pivot.rotation.z = Math.sin(t * freq + phase) * 0.032 * gust;
    pivot.rotation.x = Math.cos(t * (freq * 0.87) + phase * 1.3) * 0.024 * gust;
  }

  // Round striker drifts smoothly between the tubes
  strikerPivot.rotation.z = Math.sin(t * 1.18 + 0.9) * 0.042 * gust;
  strikerPivot.rotation.x = Math.cos(t * 1.02 + 2.1) * 0.034 * gust;

  // Paper wind-catcher flutters and twists gracefully in the air current
  tail.rotation.z = Math.sin(t * 1.32 - 0.5) * 0.068 * gust;
  tail.rotation.x = Math.cos(t * 1.12 + 0.4) * 0.052 * gust;
  tail.rotation.y = Math.sin(t * 0.72 + 0.3) * 0.36 * gust + Math.sin(t * 1.65) * 0.08;
}
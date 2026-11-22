// Cozy dorm-room wooden painter's easel with an abstract landscape canvas,
// brush ledge, glazed ceramic brush cup, squeezed paint tube, sculpted palette,
// and gently swaying linen paint rag.

function parseHex(hex, fallback) {
  const src = typeof hex === "string" ? hex.trim() : fallback;
  const clean = (src || fallback).replace("#", "");
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16) || 0,
      g: parseInt(clean[1] + clean[1], 16) || 0,
      b: parseInt(clean[2] + clean[2], 16) || 0,
    };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16) || 0,
      g: parseInt(clean.slice(2, 4), 16) || 0,
      b: parseInt(clean.slice(4, 6), 16) || 0,
    };
  }
  return parseHex(fallback, "#c89462");
}

function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function rgbCss(c, a) {
  if (a === undefined) return `rgb(${clampByte(c.r)},${clampByte(c.g)},${clampByte(c.b)})`;
  return `rgba(${clampByte(c.r)},${clampByte(c.g)},${clampByte(c.b)},${a})`;
}

function mixRgb(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function shadeRgb(c, factor) {
  if (factor >= 0) {
    return mixRgb(c, { r: 255, g: 249, b: 240 }, factor);
  }
  return mixRgb(c, { r: 28, g: 18, b: 12 }, -factor);
}

function rgbToHex(c) {
  const toH = (n) => clampByte(n).toString(16).padStart(2, "0");
  return `#${toH(c.r)}${toH(c.g)}${toH(c.b)}`;
}

// --- Geometry Craft Helpers ---

function makeSculptedBlob(THREE, segU, segV, deformFn) {
  const geo = new THREE.SphereGeometry(1, segU, segV);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    deformFn(v, i);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function makeTaperedTube(THREE, curve, tubularSegs, radialSegs, radiusXFn, radiusYFn, capEnds) {
  const frames = curve.computeFrenetFrames(tubularSegs, false);
  const positions = [];
  const uvs = [];
  const indices = [];
  const stride = radialSegs + 1;
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const b = new THREE.Vector3();
  const v = new THREE.Vector3();

  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    curve.getPointAt(t, p);
    n.copy(frames.normals[i]);
    b.copy(frames.binormals[i]);
    const rx = radiusXFn(t);
    const ry = radiusYFn ? radiusYFn(t) : rx;

    for (let j = 0; j <= radialSegs; j++) {
      const u = j / radialSegs;
      const theta = u * Math.PI * 2;
      const cs = Math.cos(theta);
      const sn = Math.sin(theta);
      v.copy(p)
        .addScaledVector(n, cs * rx)
        .addScaledVector(b, sn * ry);
      positions.push(v.x, v.y, v.z);
      uvs.push(u, t);
    }
  }

  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const bIdx = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, d, bIdx);
      indices.push(bIdx, d, c);
    }
  }

  if (capEnds) {
    const startCenter = positions.length / 3;
    curve.getPointAt(0, p);
    positions.push(p.x, p.y, p.z);
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(startCenter, j, j + 1);
    }

    const endCenter = positions.length / 3;
    curve.getPointAt(1, p);
    positions.push(p.x, p.y, p.z);
    uvs.push(0.5, 1);
    const base = tubularSegs * stride;
    for (let j = 0; j < radialSegs; j++) {
      indices.push(endCenter, base + j + 1, base + j);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function makeRoundedRectShape(THREE, w, h, r) {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const rad = Math.min(r, hw * 0.45, hh * 0.45);
  const s = new THREE.Shape();
  s.moveTo(-hw + rad, -hh);
  s.lineTo(hw - rad, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + rad);
  s.lineTo(hw, hh - rad);
  s.quadraticCurveTo(hw, hh, hw - rad, hh);
  s.lineTo(-hw + rad, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - rad);
  s.lineTo(-hw, -hh + rad);
  s.quadraticCurveTo(-hw, -hh, -hw + rad, -hh);
  return s;
}

function makeBeveledBeam(THREE, width, depth, length, bevel, noiseFn, seed) {
  const r = Math.min(bevel, width * 0.3, depth * 0.3);
  const shape = makeRoundedRectShape(THREE, width - r * 0.4, depth - r * 0.4, r);
  const steps = Math.max(8, Math.round(length * 16));
  const extrudeLen = Math.max(0.004, length - r * 1.1);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: extrudeLen,
    steps,
    bevelEnabled: true,
    bevelThickness: r * 0.55,
    bevelSize: r * 0.35,
    bevelSegments: 2,
    curveSegments: 6,
  });

  // Orient beam so length runs along Y centered at 0
  geo.translate(0, 0, -extrudeLen * 0.5);
  geo.rotateX(-Math.PI * 0.5);
  geo.computeVertexNormals();

  // Subtle hand-planed organic surface variation + lengthwise wood UVs
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const uv = geo.attributes.uv;
  const sOff = seed || 0;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const nx = Math.abs(nrm.getX(i));
    const nz = Math.abs(nrm.getZ(i));

    if (noiseFn) {
      const n1 = (noiseFn(y * 3.8 + sOff, x * 14 + z * 14 + sOff) - 0.5) * 0.0007;
      x += nrm.getX(i) * n1;
      z += nrm.getZ(i) * n1;
      pos.setXYZ(i, x, y, z);
    }

    const uCoord = nx > nz ? z * 4.5 + sOff * 0.13 : x * 4.5 + sOff * 0.13;
    const vCoord = y * 0.85 + sOff * 0.21;
    uv.setXY(i, uCoord, vCoord);
  }
  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function makeCurvedExtrude(THREE, shape, extrudeOpts, bendFn) {
  const geo = new THREE.ExtrudeGeometry(shape, extrudeOpts);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    bendFn(v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// --- Procedural Canvas Textures ---

function makeWoodTextures(THREE, kit, woodHex, grainStrength) {
  const base = parseHex(woodHex, "#c89462");
  const dark = shadeRgb(base, -0.34);
  const midDark = shadeRgb(base, -0.15);
  const light = shadeRgb(base, 0.2);

  const colorTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = rgbCss(base);
    ctx.fillRect(0, 0, w, h);

    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const v = y / h;
        const warp = (kit.noise(u * 6.0, v * 2.2) - 0.5) * 2.2;
        const fine = kit.noise(u * 42.0, v * 5.0);
        const ringVal = Math.sin((u * 14.0 + warp) * Math.PI * 2) * 0.5 + 0.5;
        const ring = Math.pow(ringVal, 1.55);
        const streak = (kit.noise(u * 90.0, v * 3.5) - 0.5) * 0.22;
        const pore = kit.noise(u * 120.0, v * 28.0) > 0.84 ? -0.14 : 0;

        const mixT = Math.max(0, Math.min(1, ring * grainStrength + fine * 0.22 + streak + pore));
        let col = mixRgb(dark, base, Math.min(1, mixT * 1.25));
        if (mixT > 0.72) {
          col = mixRgb(col, light, (mixT - 0.72) * 1.4);
        }
        const idx = (y * w + x) * 4;
        d[idx] = clampByte(col.r);
        d[idx + 1] = clampByte(col.g);
        d[idx + 2] = clampByte(col.b);
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Soft cathedral grain ribbons
    ctx.strokeStyle = rgbCss(midDark, 0.16);
    for (let i = 0; i < 18; i++) {
      const bx = (i / 18) * w + (kit.noise(i * 1.3, 2.1) - 0.5) * 20;
      ctx.lineWidth = 1.2 + kit.noise(i, 7.2) * 2.4;
      ctx.beginPath();
      for (let y = 0; y <= h; y += 16) {
        const dx = (kit.noise(i * 0.7, y * 0.008) - 0.5) * 18;
        if (y === 0) ctx.moveTo(bx + dx, y);
        else ctx.lineTo(bx + dx, y);
      }
      ctx.stroke();
    }
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.RepeatWrapping;

  const bumpTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const v = y / h;
        const warp = (kit.noise(u * 6.0, v * 2.2) - 0.5) * 2.2;
        const ring = Math.sin((u * 14.0 + warp) * Math.PI * 2) * 0.5 + 0.5;
        const fiber = kit.noise(u * 85.0, v * 4.5);
        const pore = kit.noise(u * 110.0, v * 24.0) > 0.85 ? -45 : 0;
        const val = clampByte(112 + ring * 38 + fiber * 36 + pore);
        const idx = (y * w + x) * 4;
        d[idx] = val;
        d[idx + 1] = val;
        d[idx + 2] = val;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;

  return { colorTex, bumpTex };
}

function makePaintingTextures(THREE, kit, accentHex) {
  const accent = parseHex(accentHex, "#8fc1e8");
  const skyTop = shadeRgb(accent, -0.08);
  const skyMid = mixRgb(accent, { r: 240, g: 232, b: 222 }, 0.42);
  const skyWarm = { r: 247, g: 224, b: 196 };
  const cream = { r: 249, g: 242, b: 230 };
  const sunCol = { r: 238, g: 146, b: 92 };
  const sunGlow = { r: 248, g: 199, b: 145 };
  const farHill = mixRgb(shadeRgb(accent, -0.36), { r: 78, g: 94, b: 112 }, 0.45);
  const midHill = mixRgb({ r: 108, g: 132, b: 108 }, accent, 0.16);
  const warmHill = { r: 204, g: 122, b: 84 };
  const ochreHill = { r: 224, g: 170, b: 92 };
  const deepSage = { r: 72, g: 96, b: 78 };
  const riverCol = mixRgb(accent, { r: 235, g: 244, b: 250 }, 0.25);

  const brushDab = (ctx, x, y, len, wid, ang, col, alpha) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = rgbCss(col, alpha);
    ctx.beginPath();
    ctx.moveTo(-len * 0.5, -wid * 0.38);
    ctx.quadraticCurveTo(0, -wid * 0.56, len * 0.5, -wid * 0.26);
    ctx.lineTo(len * 0.52, wid * 0.34);
    ctx.quadraticCurveTo(0, wid * 0.52, -len * 0.5, wid * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const colorTex = kit.canvasTexture(768, 960, (ctx, w, h) => {
    // Warm gesso base
    ctx.fillStyle = rgbCss(cream);
    ctx.fillRect(0, 0, w, h);

    // Dreamy sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.56);
    skyGrad.addColorStop(0.0, rgbCss(skyTop));
    skyGrad.addColorStop(0.45, rgbCss(skyMid));
    skyGrad.addColorStop(0.84, rgbCss(skyWarm));
    skyGrad.addColorStop(1.0, rgbCss(cream));
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h * 0.58);

    // Painterly horizontal sky strokes
    for (let i = 0; i < 160; i++) {
      const rx = kit.noise(i * 1.7, 3.1) * w;
      const ry = kit.noise(i * 2.3, 8.7) * h * 0.48;
      const t = ry / (h * 0.5);
      const col = mixRgb(skyTop, skyWarm, Math.min(1, t + (kit.noise(i, 1.1) - 0.5) * 0.25));
      const len = 58 + kit.noise(i * 0.9, 5.2) * 110;
      const wid = 12 + kit.noise(i * 3.1, 2.4) * 18;
      brushDab(ctx, rx, ry, len, wid, (kit.noise(i, 9.1) - 0.5) * 0.14, col, 0.34);
    }

    // Soft glowing sun disc (upper right third)
    const sx = w * 0.71;
    const sy = h * 0.24;
    const halo = ctx.createRadialGradient(sx, sy, 18, sx, sy, 130);
    halo.addColorStop(0, rgbCss(sunGlow, 0.7));
    halo.addColorStop(0.5, rgbCss(sunGlow, 0.22));
    halo.addColorStop(1, rgbCss(sunGlow, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(sx, sy, 130, 0, Math.PI * 2);
    ctx.fill();

    // Textured painterly sun
    ctx.fillStyle = rgbCss(sunCol, 0.94);
    ctx.beginPath();
    ctx.arc(sx, sy, 54, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const r = 18 + kit.noise(i * 2.1, 4.4) * 28;
      brushDab(
        ctx,
        sx + Math.cos(a) * r * 0.55,
        sy + Math.sin(a) * r * 0.55,
        34,
        14,
        a + Math.PI * 0.5,
        mixRgb(sunCol, sunGlow, kit.noise(i, 6.2)),
        0.55
      );
    }

    // Sculptural cream clouds
    const drawCloud = (cx, cy, sc) => {
      for (let i = 0; i < 16; i++) {
        const dx = (kit.noise(i * 1.4, cx * 0.01) - 0.5) * 170 * sc;
        const dy = (kit.noise(i * 2.7, cy * 0.01) - 0.5) * 34 * sc;
        const c = mixRgb(cream, skyWarm, kit.noise(i, 3.3) * 0.38);
        brushDab(ctx, cx + dx, cy + dy, (68 + kit.noise(i, 8.2) * 55) * sc, (20 + kit.noise(i, 1.9) * 14) * sc, -0.05, c, 0.58);
      }
    };
    drawCloud(w * 0.27, h * 0.19, 1.05);
    drawCloud(w * 0.56, h * 0.33, 0.85);

    // Distant blue-slate abstract mountain range
    ctx.fillStyle = rgbCss(farHill);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.54);
    ctx.bezierCurveTo(w * 0.2, h * 0.38, w * 0.38, h * 0.41, w * 0.54, h * 0.49);
    ctx.bezierCurveTo(w * 0.71, h * 0.56, w * 0.85, h * 0.43, w, h * 0.46);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // Sunlit strokes along far ridge
    for (let i = 0; i < 42; i++) {
      const t = i / 42;
      const rx = t * w;
      const ry = h * (0.46 + Math.sin(t * Math.PI * 2.1) * 0.045) + kit.noise(i, 2.2) * 48;
      const c = mixRgb(farHill, skyMid, kit.noise(i * 1.3, 4.1) * 0.45);
      brushDab(ctx, rx, ry, 62, 18, -0.18 + kit.noise(i, 7.1) * 0.3, c, 0.42);
    }

    // Mid-ground rolling sage hill (left to right)
    ctx.fillStyle = rgbCss(midHill);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.56);
    ctx.bezierCurveTo(w * 0.24, h * 0.49, w * 0.46, h * 0.62, w * 0.72, h * 0.57);
    ctx.bezierCurveTo(w * 0.86, h * 0.54, w * 0.94, h * 0.56, w, h * 0.59);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // Golden ochre sunlit meadow sweep (right)
    ctx.fillStyle = rgbCss(ochreHill);
    ctx.beginPath();
    ctx.moveTo(w * 0.22, h * 0.74);
    ctx.bezierCurveTo(w * 0.48, h * 0.61, w * 0.76, h * 0.58, w, h * 0.64);
    ctx.lineTo(w, h);
    ctx.lineTo(w * 0.14, h);
    ctx.closePath();
    ctx.fill();

    // Warm terracotta foreground slope (left)
    ctx.fillStyle = rgbCss(warmHill);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.65);
    ctx.bezierCurveTo(w * 0.25, h * 0.63, w * 0.44, h * 0.74, w * 0.64, h * 0.86);
    ctx.lineTo(w * 0.68, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // Deep sage foreground hill (bottom right corner)
    ctx.fillStyle = rgbCss(deepSage);
    ctx.beginPath();
    ctx.moveTo(w * 0.42, h);
    ctx.bezierCurveTo(w * 0.62, h * 0.78, w * 0.82, h * 0.75, w, h * 0.79);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Winding luminous accent river ribbon
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = rgbCss(riverCol, 0.92);
    ctx.lineWidth = 42;
    ctx.beginPath();
    ctx.moveTo(w * 0.52, h * 0.61);
    ctx.bezierCurveTo(w * 0.37, h * 0.67, w * 0.62, h * 0.77, w * 0.34, h * 0.99);
    ctx.stroke();

    // Shimmer highlights on the river
    ctx.strokeStyle = rgbCss(cream, 0.62);
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(w * 0.51, h * 0.62);
    ctx.bezierCurveTo(w * 0.39, h * 0.675, w * 0.60, h * 0.77, w * 0.36, h * 0.96);
    ctx.stroke();
    ctx.restore();

    // Rich impasto palette-knife & brushstroke texture over all hills
    const paletteSwatches = [warmHill, ochreHill, midHill, deepSage, cream, skyMid, sunGlow];
    for (let i = 0; i < 240; i++) {
      const rx = kit.noise(i * 2.1, 11.3) * w;
      const ry = h * 0.54 + kit.noise(i * 1.7, 17.9) * h * 0.46;
      const pick = Math.floor(kit.noise(i * 3.7, 4.9) * paletteSwatches.length);
      let c = paletteSwatches[pick % paletteSwatches.length];
      if (rx < w * 0.45 && ry > h * 0.68) c = mixRgb(warmHill, ochreHill, kit.noise(i, 2.2));
      else if (rx > w * 0.55 && ry > h * 0.80) c = mixRgb(deepSage, midHill, kit.noise(i, 5.5));
      else if (ry < h * 0.68) c = mixRgb(midHill, ochreHill, kit.noise(i, 8.8));
      const ang = -0.32 + kit.noise(i * 1.1, 6.4) * 0.64;
      brushDab(ctx, rx, ry, 34 + kit.noise(i, 3.1) * 56, 9 + kit.noise(i, 9.2) * 14, ang, c, 0.44);
    }

    // Stylized abstract cypress/tree vertical dabs on the ridge
    const trees = [
      { x: w * 0.19, y: h * 0.66, s: 1.05 },
      { x: w * 0.24, y: h * 0.67, s: 0.78 },
      { x: w * 0.79, y: h * 0.76, s: 1.15 },
      { x: w * 0.85, y: h * 0.78, s: 0.82 },
    ];
    for (const tr of trees) {
      brushDab(ctx, tr.x, tr.y - 26 * tr.s, 58 * tr.s, 18 * tr.s, Math.PI * 0.5 - 0.04, shadeRgb(deepSage, -0.25), 0.92);
      brushDab(ctx, tr.x - 3, tr.y - 28 * tr.s, 44 * tr.s, 10 * tr.s, Math.PI * 0.5, midHill, 0.55);
    }

    // Minimalist cozy floral/grass flecks in foreground
    for (let i = 0; i < 28; i++) {
      const fx = w * 0.08 + kit.noise(i * 4.1, 2.3) * w * 0.84;
      const fy = h * 0.82 + kit.noise(i * 2.9, 7.7) * h * 0.15;
      ctx.fillStyle = rgbCss(i % 2 === 0 ? cream : sunGlow, 0.88);
      ctx.beginPath();
      ctx.arc(fx, fy, 3.5 + kit.noise(i, 1.2) * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle linen canvas weave overlay
    ctx.strokeStyle = "rgba(60, 48, 36, 0.045)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 4) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Tiny charming artist signature mark bottom-right
    ctx.strokeStyle = rgbCss(cream, 0.72);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(w * 0.84, h * 0.955);
    ctx.bezierCurveTo(w * 0.86, h * 0.94, w * 0.88, h * 0.96, w * 0.91, h * 0.948);
    ctx.stroke();
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.ClampToEdgeWrapping;
  colorTex.wrapT = THREE.ClampToEdgeWrapping;

  const bumpTex = kit.canvasTexture(512, 640, (ctx, w, h) => {
    ctx.fillStyle = "rgb(128,128,128)";
    ctx.fillRect(0, 0, w, h);

    // Woven canvas grid
    ctx.fillStyle = "rgba(170,170,170,0.45)";
    for (let x = 0; x < w; x += 3) ctx.fillRect(x, 0, 1, h);
    ctx.fillStyle = "rgba(95,95,95,0.45)";
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

    // Impasto stroke ridges
    for (let i = 0; i < 220; i++) {
      const rx = kit.noise(i * 2.1, 11.3) * w;
      const ry = kit.noise(i * 1.7, 17.9) * h;
      const ang = ry < h * 0.5 ? (kit.noise(i, 9.1) - 0.5) * 0.16 : (kit.noise(i, 6.4) - 0.5) * 0.65;
      const bright = ry > h * 0.5 ? 185 : 155;
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(ang);
      ctx.fillStyle = `rgba(${bright},${bright},${bright},0.32)`;
      ctx.fillRect(-26, -6, 52, 12);
      ctx.strokeStyle = "rgba(225,225,225,0.28)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-26, -6, 52, 12);
      ctx.restore();
    }
  });
  bumpTex.wrapS = THREE.ClampToEdgeWrapping;
  bumpTex.wrapT = THREE.ClampToEdgeWrapping;

  return { colorTex, bumpTex };
}

function makeRawLinenTexture(THREE, kit) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#e7dcc8";
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 3) {
      const shade = 212 + Math.floor(kit.noise(x * 0.25, 1.3) * 24);
      ctx.fillStyle = `rgba(${shade},${shade - 10},${shade - 26},0.48)`;
      ctx.fillRect(x, 0, 1.5, h);
    }
    for (let y = 0; y < h; y += 3) {
      const shade = 205 + Math.floor(kit.noise(3.1, y * 0.25) * 26);
      ctx.fillStyle = `rgba(${shade},${shade - 12},${shade - 28},0.44)`;
      ctx.fillRect(0, y, w, 1.5);
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makePaletteWoodTexture(THREE, kit, accentHex) {
  const accent = parseHex(accentHex, "#8fc1e8");
  const tex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = "#dfc39c";
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      const n = kit.noise(y * 0.03, 4.2);
      ctx.fillStyle = `rgba(176,134,88,${0.08 + n * 0.14})`;
      ctx.fillRect(0, y, w, 2);
    }
    // Soft mixed paint smudges in center mixing area
    const smears = [
      { x: 0.46, y: 0.48, r: 62, c: mixRgb(accent, { r: 245, g: 242, b: 235 }, 0.35), a: 0.45 },
      { x: 0.56, y: 0.56, r: 50, c: { r: 222, g: 168, b: 92 }, a: 0.36 },
      { x: 0.38, y: 0.58, r: 44, c: { r: 198, g: 112, b: 82 }, a: 0.3 },
      { x: 0.52, y: 0.42, r: 38, c: { r: 120, g: 146, b: 118 }, a: 0.28 },
    ];
    for (const sm of smears) {
      const g = ctx.createRadialGradient(sm.x * w, sm.y * h, 4, sm.x * w, sm.y * h, sm.r);
      g.addColorStop(0, rgbCss(sm.c, sm.a));
      g.addColorStop(0.65, rgbCss(sm.c, sm.a * 0.45));
      g.addColorStop(1, rgbCss(sm.c, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sm.x * w, sm.y * h, sm.r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeCeramicCupTexture(THREE, kit, accentHex) {
  const accent = parseHex(accentHex, "#8fc1e8");
  const glazeDark = shadeRgb(accent, -0.2);
  const glazeLight = shadeRgb(accent, 0.26);
  const clay = { r: 229, g: 214, b: 192 };

  const tex = kit.canvasTexture(512, 256, (ctx, w, h) => {
    // Upper two-thirds dipped accent glaze, lower third warm speckled stoneware
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, rgbCss(glazeLight));
    grad.addColorStop(0.18, rgbCss(accent));
    grad.addColorStop(0.62, rgbCss(glazeDark));
    grad.addColorStop(0.68, rgbCss(clay));
    grad.addColorStop(1.0, rgbCss(shadeRgb(clay, -0.08)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Organic hand-dipped glaze drip line
    ctx.fillStyle = rgbCss(glazeDark, 0.92);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.56);
    for (let x = 0; x <= w; x += 8) {
      const drip = Math.sin(x * 0.045) * 8 + kit.noise(x * 0.03, 5.1) * 22;
      ctx.lineTo(x, h * 0.62 + drip);
    }
    ctx.lineTo(w, h * 0.5);
    ctx.lineTo(0, h * 0.5);
    ctx.closePath();
    ctx.fill();

    // Subtle pottery stoneware speckles
    for (let i = 0; i < 340; i++) {
      const sx = kit.noise(i * 3.1, 1.4) * w;
      const sy = kit.noise(i * 2.7, 9.2) * h;
      ctx.fillStyle = sy > h * 0.64 ? "rgba(110,82,58,0.34)" : "rgba(255,250,242,0.22)";
      ctx.beginPath();
      ctx.arc(sx, sy, 0.9 + kit.noise(i, 4.1) * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeRagTextures(THREE, kit, accentHex) {
  const accent = parseHex(accentHex, "#8fc1e8");
  const colorTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = "#efe6d7";
    ctx.fillRect(0, 0, w, h);

    // Soft woven tea-towel stripes near edges
    ctx.fillStyle = rgbCss(accent, 0.24);
    ctx.fillRect(w * 0.1, 0, w * 0.04, h);
    ctx.fillRect(w * 0.86, 0, w * 0.04, h);

    // Fine linen weave
    for (let i = 0; i < w; i += 4) {
      ctx.fillStyle = "rgba(140,120,98,0.08)";
      ctx.fillRect(i, 0, 1.5, h);
      ctx.fillRect(0, i, w, 1.5);
    }

    // Playful cozy paint wipes from cleaning brushes
    const wipes = [
      { x: 0.34, y: 0.62, rx: 52, ry: 28, ang: 0.4, col: accent, a: 0.56 },
      { x: 0.58, y: 0.54, rx: 46, ry: 22, ang: -0.35, col: { r: 212, g: 120, b: 84 }, a: 0.48 },
      { x: 0.48, y: 0.74, rx: 56, ry: 24, ang: 0.18, col: { r: 224, g: 170, b: 88 }, a: 0.45 },
      { x: 0.66, y: 0.72, rx: 38, ry: 20, ang: -0.5, col: { r: 96, g: 124, b: 96 }, a: 0.44 },
    ];
    for (const wp of wipes) {
      ctx.save();
      ctx.translate(wp.x * w, wp.y * h);
      ctx.rotate(wp.ang);
      const g = ctx.createRadialGradient(0, 0, 6, 0, 0, wp.rx);
      g.addColorStop(0, rgbCss(wp.col, wp.a));
      g.addColorStop(0.7, rgbCss(wp.col, wp.a * 0.45));
      g.addColorStop(1, rgbCss(wp.col, 0));
      ctx.fillStyle = g;
      ctx.scale(1, wp.ry / wp.rx);
      ctx.beginPath();
      ctx.arc(0, 0, wp.rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;

  const bumpTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "rgb(128,128,128)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(180,180,180,0.4)";
    for (let x = 0; x < w; x += 3) ctx.fillRect(x, 0, 1, h);
    ctx.fillStyle = "rgba(84,84,84,0.4)";
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  });
  return { colorTex, bumpTex };
}

function makeBristleTexture(THREE, kit, tipHex) {
  const tip = parseHex(tipHex, "#8fc1e8");
  const tex = kit.canvasTexture(128, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0.0, "#c8a97e");
    grad.addColorStop(0.55, "#ddc49d");
    grad.addColorStop(0.72, rgbCss(mixRgb({ r: 221, g: 196, b: 157 }, tip, 0.72)));
    grad.addColorStop(1.0, rgbCss(tip));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Individual fine bristle strands
    for (let x = 0; x < w; x += 2) {
      const dark = kit.noise(x * 0.4, 2.3) > 0.5;
      ctx.fillStyle = dark ? "rgba(70,48,28,0.22)" : "rgba(255,248,235,0.2)";
      ctx.fillRect(x, 0, 1, h);
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeTubeLabelTexture(THREE, kit, accentHex) {
  const accent = parseHex(accentHex, "#8fc1e8");
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#f4ede0";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = rgbCss(accent);
    ctx.fillRect(0, h * 0.24, w, h * 0.38);
    ctx.fillStyle = "#2f3338";
    ctx.fillRect(w * 0.14, h * 0.70, w * 0.72, 6);
    ctx.fillRect(w * 0.22, h * 0.78, w * 0.56, 4);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillRect(w * 0.18, h * 0.40, w * 0.64, 7);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// --- Component Builders ---

function buildFootPad(THREE, rubberMat) {
  const pts = [];
  const profile = [
    [0.0, 0.0],
    [0.017, 0.0],
    [0.020, 0.0012],
    [0.021, 0.004],
    [0.0205, 0.008],
    [0.0195, 0.012],
    [0.019, 0.016],
    [0.018, 0.0195],
    [0.0155, 0.0205],
    [0.013, 0.018],
    [0.012, 0.010],
    [0.0, 0.010],
  ];
  for (const [r, y] of profile) pts.push(new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, 20);
  const mesh = new THREE.Mesh(geo, rubberMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildBrassKnob(THREE, brassMat) {
  const pts = [
    [0.0, 0.0],
    [0.0045, 0.0],
    [0.0045, 0.012],
    [0.007, 0.0135],
    [0.0115, 0.015],
    [0.013, 0.0185],
    [0.013, 0.023],
    [0.011, 0.0255],
    [0.006, 0.0265],
    [0.0, 0.027],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, 20);
  const mesh = new THREE.Mesh(geo, brassMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.slot = "secondary";
  return mesh;
}

function buildStretchedCanvas(THREE, kit, width, height, depth, mats) {
  const g = new THREE.Group();
  g.name = "canvas";

  // Continuous rounded-edge stretched canvas body using analytical rounded-box projection
  const bodyGeo = new THREE.BoxGeometry(width, height, depth, 28, 34, 6);
  const pos = bodyGeo.attributes.position;
  const hw = width * 0.5;
  const hh = height * 0.5;
  const hd = depth * 0.5;
  const r = 0.0036;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const cx = Math.max(-hw + r, Math.min(hw - r, x));
    const cy = Math.max(-hh + r, Math.min(hh - r, y));
    const cz = Math.max(-hd + r, Math.min(hd - r, z));
    const dx = x - cx;
    const dy = y - cy;
    const dz = z - cz;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len > 1e-6) {
      x = cx + (dx / len) * r;
      y = cy + (dy / len) * r;
      z = cz + (dz / len) * r;
    }

    // Subtle organic taut-canvas pillow across the front
    if (z > 0) {
      const nx = x / hw;
      const ny = y / hh;
      const taut = (1 - nx * nx) * (1 - ny * ny);
      z += taut * 0.0016;
    }
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  bodyGeo.computeVertexNormals();

  // BoxGeometry face order: +x, -x, +y, -y, +z (front painting), -z (back linen)
  const canvasMesh = new THREE.Mesh(bodyGeo, [
    mats.canvasEdge,
    mats.canvasEdge,
    mats.canvasEdge,
    mats.canvasEdge,
    mats.painting,
    mats.rawLinen,
  ]);
  canvasMesh.castShadow = true;
  canvasMesh.receiveShadow = true;
  canvasMesh.userData.slot = "accent";
  g.add(canvasMesh);

  // Wooden stretcher bars mounted on the back face (-z)
  const barW = 0.024;
  const barD = 0.008;
  const zBack = -hd - barD * 0.35;

  const topBar = new THREE.Mesh(
    makeBeveledBeam(THREE, barD, barW, width - 0.018, 0.002, kit.noise, 31),
    mats.stretcherWood
  );
  topBar.rotation.z = Math.PI * 0.5;
  topBar.position.set(0, hh - barW * 0.5 - 0.008, zBack);
  topBar.castShadow = true;
  topBar.receiveShadow = true;
  topBar.userData.slot = "secondary";
  g.add(topBar);

  const botBar = topBar.clone();
  botBar.position.y = -hh + barW * 0.5 + 0.008;
  g.add(botBar);

  const leftBar = new THREE.Mesh(
    makeBeveledBeam(THREE, barW, barD, height - barW * 2 - 0.014, 0.002, kit.noise, 37),
    mats.stretcherWood
  );
  leftBar.position.set(-hw + barW * 0.5 + 0.008, 0, zBack);
  leftBar.castShadow = true;
  leftBar.receiveShadow = true;
  leftBar.userData.slot = "secondary";
  g.add(leftBar);

  const rightBar = leftBar.clone();
  rightBar.position.x = hw - barW * 0.5 - 0.008;
  g.add(rightBar);

  const midBrace = new THREE.Mesh(
    makeBeveledBeam(THREE, barD * 0.85, 0.018, width - barW * 2 - 0.016, 0.0018, kit.noise, 41),
    mats.stretcherWood
  );
  midBrace.rotation.z = Math.PI * 0.5;
  midBrace.position.set(0, 0, zBack + 0.0005);
  midBrace.userData.slot = "secondary";
  g.add(midBrace);

  // Tiny brass staples along back wrapped border
  const stapleGeo = new THREE.BoxGeometry(0.006, 0.0016, 0.0016);
  const stapleOffsets = [-0.15, -0.05, 0.05, 0.15];
  for (const sx of stapleOffsets) {
    for (const sy of [-hh + 0.014, hh - 0.014]) {
      const st = new THREE.Mesh(stapleGeo, mats.brass);
      st.position.set(sx, sy, zBack - barD * 0.45);
      st.userData.slot = "secondary";
      g.add(st);
    }
  }

  return g;
}

function buildPalette(THREE, kit, accentHex, mats) {
  const g = new THREE.Group();
  g.name = "palette";

  // Classic curved kidney-bean artist palette silhouette
  const shape = new THREE.Shape();
  shape.moveTo(-0.072, -0.016);
  shape.bezierCurveTo(-0.082, 0.028, -0.044, 0.062, 0.008, 0.060);
  shape.bezierCurveTo(0.056, 0.058, 0.082, 0.032, 0.080, -0.008);
  shape.bezierCurveTo(0.078, -0.042, 0.046, -0.060, 0.010, -0.056);
  shape.bezierCurveTo(-0.010, -0.054, -0.016, -0.030, -0.032, -0.032);
  shape.bezierCurveTo(-0.050, -0.034, -0.066, -0.040, -0.072, -0.016);

  // Carved oval thumbhole
  const hole = new THREE.Path();
  hole.absellipse(-0.046, -0.012, 0.012, 0.0095, 0, Math.PI * 2, true, 0.25);
  shape.holes.push(hole);

  const palGeo = makeCurvedExtrude(
    THREE,
    shape,
    {
      depth: 0.0046,
      bevelEnabled: true,
      bevelThickness: 0.0014,
      bevelSize: 0.0015,
      bevelSegments: 3,
      curveSegments: 32,
    },
    (v) => {
      // Gentle hand-carved ergonomic contour
      const bend = (v.x * v.x * 0.45 - v.y * v.y * 0.22);
      v.z += bend;
    }
  );

  // Normalize UVs cleanly onto [0, 1] for painted palette texture
  const pos = palGeo.attributes.position;
  const uv = palGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + 0.085) / 0.17, (pos.getY(i) + 0.065) / 0.13);
  }
  uv.needsUpdate = true;

  const palMesh = new THREE.Mesh(palGeo, mats.paletteWood);
  palMesh.castShadow = true;
  palMesh.receiveShadow = true;
  palMesh.userData.slot = "secondary";
  g.add(palMesh);

  // 6 sculpted glossy wet paint mounds along the upper/outer rim
  const dabs = [
    { x: -0.036, y: 0.038, col: accentHex, slot: "accent", s: 1.05 },
    { x: -0.006, y: 0.045, col: "#f7f0e2", slot: "secondary", s: 0.96 },
    { x: 0.025, y: 0.042, col: "#e0a94c", slot: "secondary", s: 1.0 },
    { x: 0.052, y: 0.024, col: "#cf6b4a", slot: "secondary", s: 0.94 },
    { x: 0.058, y: -0.006, col: "#6b8a6b", slot: "secondary", s: 0.92 },
    { x: 0.042, y: -0.033, col: "#3c4e68", slot: "secondary", s: 0.88 },
  ];

  for (let idx = 0; idx < dabs.length; idx++) {
    const db = dabs[idx];
    const blobGeo = makeSculptedBlob(THREE, 20, 16, (v) => {
      // Organic squashed dollop with slight swirl peak on +z
      const rad = Math.sqrt(v.x * v.x + v.y * v.y);
      const ang = Math.atan2(v.y, v.x);
      const wobble = 1 + 0.14 * Math.sin(ang * 3 + idx * 1.9) + 0.08 * Math.cos(ang * 2 - idx);
      v.x *= 0.0112 * db.s * wobble;
      v.y *= 0.0094 * db.s * wobble;
      if (v.z < 0) {
        v.z *= 0.0012;
      } else {
        const peak = Math.pow(Math.max(0, 1 - rad), 1.6) * 0.0038;
        v.z = v.z * 0.0046 * db.s + peak;
        v.x += peak * 0.6 * Math.cos(idx * 2.3);
        v.y += peak * 0.6 * Math.sin(idx * 2.3);
      }
    });
    const blobMat = new THREE.MeshPhysicalMaterial({
      color: db.col,
      roughness: 0.15,
      metalness: 0.0,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
    });
    const blob = new THREE.Mesh(blobGeo, blobMat);
    const surfZ = 0.0058 + (db.x * db.x * 0.45 - db.y * db.y * 0.22);
    blob.position.set(db.x, db.y, surfZ);
    blob.castShadow = true;
    blob.receiveShadow = true;
    blob.userData.slot = db.slot;
    g.add(blob);
  }

  return g;
}

function buildBrush(THREE, kit, spec, mats) {
  const g = new THREE.Group();
  const handleLen = spec.handleLen;
  const maxR = spec.radius;

  // Ergonomic tapered artist brush handle via LatheGeometry (20 profile points)
  const hPts = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let r;
    if (t < 0.05) {
      r = maxR * 0.42 * Math.sin((t / 0.05) * Math.PI * 0.5);
    } else if (t < 0.72) {
      const u = (t - 0.05) / 0.67;
      r = maxR * (0.42 + 0.58 * Math.sin(u * Math.PI * 0.55));
    } else {
      const u = (t - 0.72) / 0.28;
      r = maxR * (0.99 - 0.20 * u);
    }
    hPts.push(new THREE.Vector2(Math.max(0.0002, r), t * handleLen));
  }
  const handleGeo = new THREE.LatheGeometry(hPts, 18);
  const handleMat = new THREE.MeshPhysicalMaterial({
    color: spec.handleColor,
    roughness: 0.3,
    metalness: 0.0,
    clearcoat: 0.65,
    clearcoatRoughness: 0.22,
  });
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.castShadow = true;
  handle.receiveShadow = true;
  handle.userData.slot = spec.slot || "primary";
  g.add(handle);

  // Decorative painted ring near ferrule
  const ringGeo = new THREE.CylinderGeometry(maxR * 0.85, maxR * 0.88, 0.006, 16);
  const ringMat = new THREE.MeshPhysicalMaterial({
    color: spec.bandColor || "#f4ecdc",
    roughness: 0.32,
    clearcoat: 0.5,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = handleLen - 0.011;
  ring.userData.slot = "secondary";
  g.add(ring);

  // Crimped metal ferrule (LatheGeometry, 16 points)
  const ferrLen = spec.ferruleLen || 0.028;
  const fBase = maxR * 0.81;
  const fPts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    let r = fBase * (1.0 - 0.05 * t);
    // Two subtle mechanical crimp grooves
    if (Math.abs(t - 0.24) < 0.06 || Math.abs(t - 0.42) < 0.06) {
      r *= 0.92;
    }
    fPts.push(new THREE.Vector2(r, t * ferrLen));
  }
  const ferrGeo = new THREE.LatheGeometry(fPts, 18);
  // Flatten ferrule upper part for flat/filbert brushes
  if (spec.type === "flat" || spec.type === "filbert") {
    const fPos = ferrGeo.attributes.position;
    for (let i = 0; i < fPos.count; i++) {
      const y = fPos.getY(i);
      const t = Math.max(0, Math.min(1, y / ferrLen));
      const sq = Math.pow(t, 1.3);
      fPos.setX(i, fPos.getX(i) * (1 + 0.52 * sq));
      fPos.setZ(i, fPos.getZ(i) * (1 - 0.55 * sq));
    }
    fPos.needsUpdate = true;
    ferrGeo.computeVertexNormals();
  }
  const ferrule = new THREE.Mesh(ferrGeo, mats.ferrule);
  ferrule.position.y = handleLen - 0.002;
  ferrule.castShadow = true;
  ferrule.receiveShadow = true;
  ferrule.userData.slot = "secondary";
  g.add(ferrule);

  // Sculpted continuous bristle tuft dipped in paint
  const bLen = spec.bristleLen || 0.024;
  const bRad = fBase * 0.94;
  const bristleGeo = makeSculptedBlob(THREE, 24, 18, (v) => {
    const t = (v.y + 1) * 0.5; // 0 at ferrule, 1 at tip
    let sx = bRad;
    let sz = bRad;
    if (spec.type === "flat") {
      sx = bRad * (1.46 + 0.08 * Math.sin(t * Math.PI));
      sz = bRad * (0.44 * (1 - 0.72 * Math.pow(t, 1.8)));
    } else if (spec.type === "filbert") {
      const arch = Math.sin(Math.min(1, t * 1.1) * Math.PI * 0.75);
      sx = bRad * (1.35 * (0.35 + 0.65 * Math.pow(1 - t * 0.78, 0.55)));
      sz = bRad * (0.48 * (1 - 0.76 * Math.pow(t, 1.5)) + 0.05 * arch);
    } else {
      // Round tapered point
      const belly = Math.sin(t * Math.PI * 0.68);
      const taper = Math.pow(1 - t, 0.82);
      sx = bRad * (0.28 + 0.85 * belly) * taper + bRad * 0.06 * (1 - t);
      sz = sx;
    }
    v.x *= sx;
    v.z *= sz;
    v.y = t * bLen;
  });

  const bristleTex = makeBristleTexture(THREE, kit, spec.paintTip);
  const bristleMat = new THREE.MeshPhysicalMaterial({
    map: bristleTex,
    roughness: 0.72,
    sheen: 0.45,
    sheenColor: "#fff4e2",
    clearcoat: 0.16,
  });
  const bristles = new THREE.Mesh(bristleGeo, bristleMat);
  bristles.position.y = handleLen + ferrLen - 0.003;
  bristles.castShadow = true;
  bristles.receiveShadow = true;
  bristles.userData.slot = spec.tipSlot || "accent";
  g.add(bristles);

  return g;
}

function buildBrushCup(THREE, kit, accentHex, mats) {
  const g = new THREE.Group();
  g.name = "brushCup";

  // Glazed ceramic pottery profile via LatheGeometry (22 points, footed + hollow inside)
  const profile = [
    [0.0, 0.0],
    [0.022, 0.0],
    [0.025, 0.0015],
    [0.0265, 0.005],
    [0.0295, 0.016],
    [0.032, 0.034],
    [0.0322, 0.052],
    [0.0305, 0.070],
    [0.0296, 0.082],
    [0.0312, 0.0875],
    [0.0305, 0.091],
    [0.0278, 0.0915],
    [0.0258, 0.089],
    [0.0256, 0.076],
    [0.027, 0.054],
    [0.0265, 0.030],
    [0.023, 0.012],
    [0.015, 0.008],
    [0.0, 0.008],
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const cupGeo = new THREE.LatheGeometry(profile, 32);
  const cupTex = makeCeramicCupTexture(THREE, kit, accentHex);
  const cupMat = new THREE.MeshPhysicalMaterial({
    map: cupTex,
    roughness: 0.22,
    metalness: 0.0,
    clearcoat: 0.8,
    clearcoatRoughness: 0.14,
  });
  const cupMesh = new THREE.Mesh(cupGeo, cupMat);
  cupMesh.castShadow = true;
  cupMesh.receiveShadow = true;
  cupMesh.userData.slot = "accent";
  g.add(cupMesh);

  // Tinted rinse water inside the ceramic cup
  const waterCol = mixRgb(parseHex(accentHex, "#8fc1e8"), { r: 195, g: 215, b: 222 }, 0.45);
  const waterGeo = new THREE.CylinderGeometry(0.0262, 0.025, 0.004, 24);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: rgbToHex(waterCol),
    roughness: 0.08,
    metalness: 0.0,
    transparent: true,
    opacity: 0.64,
    clearcoat: 0.9,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = 0.058;
  water.userData.slot = "accent";
  g.add(water);

  // 3 upright artist brushes resting naturally inside the cup
  const uprightSpecs = [
    {
      handleLen: 0.155,
      radius: 0.0048,
      handleColor: "#6e462d",
      bandColor: "#efe4cf",
      type: "flat",
      ferruleLen: 0.026,
      bristleLen: 0.024,
      paintTip: accentHex,
      tipSlot: "accent",
      pos: [-0.006, 0.010, -0.003],
      rot: [-0.14, 0.4, 0.16],
    },
    {
      handleLen: 0.142,
      radius: 0.0038,
      handleColor: "#2f4b5e",
      bandColor: "#d9b46c",
      type: "round",
      ferruleLen: 0.022,
      bristleLen: 0.022,
      paintTip: "#e2aa4e",
      tipSlot: "secondary",
      pos: [0.007, 0.010, 0.005],
      rot: [0.16, -0.5, -0.14],
    },
    {
      handleLen: 0.130,
      radius: 0.0032,
      handleColor: "#b85d44",
      bandColor: "#f3ead9",
      type: "filbert",
      ferruleLen: 0.020,
      bristleLen: 0.019,
      paintTip: "#d16b4c",
      tipSlot: "secondary",
      pos: [0.001, 0.010, -0.007],
      rot: [-0.12, 1.1, -0.18],
    },
  ];

  for (const sp of uprightSpecs) {
    const br = buildBrush(THREE, kit, sp, mats);
    br.position.set(sp.pos[0], sp.pos[1], sp.pos[2]);
    br.rotation.set(sp.rot[0], sp.rot[1], sp.rot[2]);
    g.add(br);
  }

  return g;
}

function buildPaintTube(THREE, kit, accentHex) {
  const g = new THREE.Group();
  g.name = "paintTube";

  // Continuous squeezed metal tube body (crimped flat tail -> pinched belly -> round shoulder)
  const tubeLen = 0.068;
  const tubeGeo = makeSculptedBlob(THREE, 28, 22, (v) => {
    const t = (v.y + 1) * 0.5; // 0 = crimped tail, 1 = shoulder/neck
    let rx = 0.0095;
    let rz = 0.0095;

    if (t < 0.18) {
      // Flat crimped end
      const u = t / 0.18;
      rx = 0.0128 * (1 - 0.12 * u);
      rz = 0.0014 + 0.005 * u;
    } else if (t < 0.86) {
      const u = (t - 0.18) / 0.68;
      // Gently squeezed thumb dimple in the middle
      const pinch = Math.exp(-Math.pow((u - 0.42) / 0.24, 2)) * 0.38;
      rx = 0.0112 * (1 - 0.18 * u) * (1 + pinch * 0.28);
      rz = 0.0064 + 0.0034 * Math.sin(u * Math.PI * 0.82);
      rz *= 1 - pinch;
    } else {
      const u = (t - 0.86) / 0.14;
      const rad = 0.009 * (1 - 0.62 * u);
      rx = rad;
      rz = rad;
    }

    v.x *= rx;
    v.z *= rz;
    v.y = t * tubeLen;
  });

  const labelTex = makeTubeLabelTexture(THREE, kit, accentHex);
  const tubeMat = new THREE.MeshPhysicalMaterial({
    map: labelTex,
    roughness: 0.36,
    metalness: 0.18,
    clearcoat: 0.24,
  });
  const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
  tubeMesh.castShadow = true;
  tubeMesh.receiveShadow = true;
  tubeMesh.userData.slot = "accent";
  g.add(tubeMesh);

  // Turned ribbed plastic cap
  const capPts = [
    [0.0, 0.0],
    [0.0048, 0.0],
    [0.0049, 0.003],
    [0.0046, 0.011],
    [0.0041, 0.0128],
    [0.0, 0.013],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const capGeo = new THREE.LatheGeometry(capPts, 16);
  const capMat = new THREE.MeshPhysicalMaterial({
    color: "#2b2a29",
    roughness: 0.45,
    clearcoat: 0.35,
  });
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.y = tubeLen - 0.001;
  cap.castShadow = true;
  cap.userData.slot = "secondary";
  g.add(cap);

  return g;
}

function buildDrapedRag(THREE, kit, accentHex) {
  const g = new THREE.Group();
  g.name = "cloth";

  // Draped linen handkerchief gathered over a wooden side peg, with gravity folds
  const segU = 28;
  const segV = 34;
  const geo = new THREE.PlaneGeometry(1, 1, segU, segV);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) * 2; // -1 to 1 across cloth width
    const v = 0.5 - pos.getY(i); // 0 at peg top, 1 at bottom hem

    let x, y, z;
    if (v < 0.08) {
      // Smooth wrap over top of peg
      const a = (v / 0.08) * Math.PI * 0.5;
      const spread = 0.011 + v * 0.16;
      x = u * spread;
      y = Math.cos(a) * 0.0095 - 0.002;
      z = Math.sin(a) * 0.0105;
    } else {
      const vt = (v - 0.08) / 0.92;
      const width = 0.018 + 0.064 * Math.pow(vt, 0.72);
      const ripple = Math.sin(u * Math.PI * 2.4 + 0.35) * 0.015 * Math.pow(vt, 0.85);
      const subFold = Math.cos(u * Math.PI * 4.5 - vt * 1.4) * 0.0045 * vt;
      const hemCurve = Math.cos(u * 1.35) * 0.042 * vt;
      const swayDrift = Math.sin(vt * 2.2) * 0.005;

      x = u * width + swayDrift + 0.008 * vt;
      y = -0.002 - vt * 0.245 - hemCurve;
      z = 0.0105 * (1 - vt * 0.55) + ripple + subFold;
    }

    pos.setXYZ(i, x, y, z);
    uv.setXY(i, (u + 1) * 0.5, v);
  }
  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();

  const { colorTex, bumpTex } = makeRagTextures(THREE, kit, accentHex);
  const ragMat = new THREE.MeshPhysicalMaterial({
    map: colorTex,
    bumpMap: bumpTex,
    bumpScale: 0.0018,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.82,
    sheenColor: "#f8f0e4",
    side: THREE.DoubleSide,
  });

  const ragMesh = new THREE.Mesh(geo, ragMat);
  ragMesh.castShadow = true;
  ragMesh.receiveShadow = true;
  ragMesh.userData.slot = "accent";
  g.add(ragMesh);

  return g;
}

// --- Main Build & Idle ---

export function build(THREE, opts, kit) {
  const cfg = {
    wood: (opts && opts.wood) || "#c89462",
    accent: (opts && opts.accent) || "#8fc1e8",
  };

  const root = new THREE.Group();
  root.name = "painters_easel";

  // Procedural textures
  const mainWoodTex = makeWoodTextures(THREE, kit, cfg.wood, 0.65);
  const lighterWoodHex = rgbToHex(shadeRgb(parseHex(cfg.wood, "#c89462"), 0.24));
  const stretcherWoodTex = makeWoodTextures(THREE, kit, lighterWoodHex, 0.45);
  const paintingTex = makePaintingTextures(THREE, kit, cfg.accent);
  const rawLinenTex = makeRawLinenTexture(THREE, kit);
  const paletteTex = makePaletteWoodTexture(THREE, kit, cfg.accent);

  // Shared physical materials
  const mats = {
    wood: new THREE.MeshPhysicalMaterial({
      map: mainWoodTex.colorTex,
      bumpMap: mainWoodTex.bumpTex,
      bumpScale: 0.0024,
      roughness: 0.56,
      metalness: 0.0,
      clearcoat: 0.18,
      clearcoatRoughness: 0.44,
    }),
    stretcherWood: new THREE.MeshPhysicalMaterial({
      map: stretcherWoodTex.colorTex,
      bumpMap: stretcherWoodTex.bumpTex,
      bumpScale: 0.0018,
      roughness: 0.68,
      metalness: 0.0,
    }),
    paletteWood: new THREE.MeshPhysicalMaterial({
      map: paletteTex,
      bumpMap: stretcherWoodTex.bumpTex,
      bumpScale: 0.0012,
      roughness: 0.44,
      clearcoat: 0.28,
      clearcoatRoughness: 0.34,
    }),
    painting: new THREE.MeshPhysicalMaterial({
      map: paintingTex.colorTex,
      bumpMap: paintingTex.bumpTex,
      bumpScale: 0.0038,
      roughness: 0.76,
      sheen: 0.32,
      sheenColor: "#fff8ee",
      clearcoat: 0.06,
      clearcoatRoughness: 0.6,
    }),
    canvasEdge: new THREE.MeshPhysicalMaterial({
      map: rawLinenTex,
      color: "#f4ede2",
      bumpMap: paintingTex.bumpTex,
      bumpScale: 0.002,
      roughness: 0.86,
      sheen: 0.45,
      sheenColor: "#fff8ee",
    }),
    rawLinen: new THREE.MeshPhysicalMaterial({
      map: rawLinenTex,
      roughness: 0.92,
      sheen: 0.68,
      sheenColor: "#efe4d2",
    }),
    brass: new THREE.MeshPhysicalMaterial({
      color: "#d4af64",
      metalness: 0.84,
      roughness: 0.27,
      clearcoat: 0.22,
    }),
    ferrule: new THREE.MeshPhysicalMaterial({
      color: "#d4cfc6",
      metalness: 0.88,
      roughness: 0.24,
      clearcoat: 0.18,
    }),
    leather: new THREE.MeshPhysicalMaterial({
      color: "#6b4228",
      roughness: 0.76,
      sheen: 0.35,
      sheenColor: "#9e6b46",
    }),
    rubber: new THREE.MeshPhysicalMaterial({
      color: "#36312d",
      roughness: 0.88,
    }),
  };

  const body = new THREE.Group();
  body.name = "body";
  root.add(body);

  // Front A-frame group tilted gently backward (~8.3 deg)
  const tilt = 0.145;
  const frameGroup = new THREE.Group();
  frameGroup.name = "frame";
  frameGroup.position.set(0, 0.008, 0.235);
  frameGroup.rotation.x = -tilt;
  body.add(frameGroup);

  // --- Front Left & Right A-Frame Legs ---
  const botX = 0.265;
  const topX = 0.056;
  const topY = 1.43;
  const legLen = Math.hypot(botX - topX, topY);
  const legAngle = Math.atan2(botX - topX, topY);

  const legGeo = makeBeveledBeam(THREE, 0.034, 0.026, legLen, 0.0045, kit.noise, 1);

  const legL = new THREE.Mesh(legGeo, mats.wood);
  legL.name = "legL";
  legL.position.set(-(botX + topX) * 0.5, topY * 0.5, 0);
  legL.rotation.z = -legAngle;
  legL.castShadow = true;
  legL.receiveShadow = true;
  legL.userData.slot = "primary";
  frameGroup.add(legL);

  const legR = new THREE.Mesh(legGeo, mats.wood);
  legR.name = "legR";
  legR.position.set((botX + topX) * 0.5, topY * 0.5, 0);
  legR.rotation.z = legAngle;
  legR.castShadow = true;
  legR.receiveShadow = true;
  legR.userData.slot = "primary";
  frameGroup.add(legR);

  // Sculpted rubber floor pads cleanly grounding the front legs at y = 0
  const footL = buildFootPad(THREE, mats.rubber);
  footL.position.set(-botX, 0, 0.235);
  footL.userData.slot = "secondary";
  body.add(footL);

  const footR = buildFootPad(THREE, mats.rubber);
  footR.position.set(botX, 0, 0.235);
  footR.userData.slot = "secondary";
  body.add(footR);

  // Helper for horizontal leg centerline X at given local Y
  const legXAtY = (y) => botX - (botX - topX) * (y / topY);

  // --- Crossbars & Wooden Dowel Pins ---
  const crossbars = [
    { y: 0.24, h: 0.036, d: 0.021, seed: 5 },
    { y: 0.49, h: 0.034, d: 0.020, seed: 9 },
    { y: 1.32, h: 0.036, d: 0.022, seed: 13 },
  ];
  const dowelGeo = new THREE.CylinderGeometry(0.0042, 0.0042, 0.028, 12);
  dowelGeo.rotateX(Math.PI * 0.5);

  for (const cb of crossbars) {
    const span = legXAtY(cb.y) * 2 + 0.012;
    const barGeo = makeBeveledBeam(THREE, cb.h, cb.d, span, 0.004, kit.noise, cb.seed);
    const bar = new THREE.Mesh(barGeo, mats.wood);
    bar.rotation.z = Math.PI * 0.5;
    bar.position.set(0, cb.y, -0.0015);
    bar.castShadow = true;
    bar.receiveShadow = true;
    bar.userData.slot = "primary";
    frameGroup.add(bar);

    for (const side of [-1, 1]) {
      const pin = new THREE.Mesh(dowelGeo, mats.stretcherWood);
      pin.position.set(side * legXAtY(cb.y), cb.y, 0.001);
      pin.userData.slot = "secondary";
      frameGroup.add(pin);
    }
  }

  // Carved decorative top bridge cap uniting the apex
  const capShape = new THREE.Shape();
  capShape.moveTo(-0.088, -0.016);
  capShape.lineTo(0.088, -0.016);
  capShape.lineTo(0.082, 0.012);
  capShape.bezierCurveTo(0.045, 0.028, -0.045, 0.028, -0.082, 0.012);
  capShape.closePath();
  const capGeo = new THREE.ExtrudeGeometry(capShape, {
    depth: 0.024,
    bevelEnabled: true,
    bevelThickness: 0.0035,
    bevelSize: 0.003,
    bevelSegments: 3,
    curveSegments: 16,
  });
  capGeo.translate(0, 0, -0.012);
  const topCap = new THREE.Mesh(capGeo, mats.wood);
  topCap.position.set(0, 1.425, 0.0);
  topCap.castShadow = true;
  topCap.receiveShadow = true;
  topCap.userData.slot = "primary";
  frameGroup.add(topCap);

  // --- Central Mast (Spine) ---
  const mastLen = 1.29;
  const mastGeo = makeBeveledBeam(THREE, 0.038, 0.024, mastLen, 0.0045, kit.noise, 17);
  const mast = new THREE.Mesh(mastGeo, mats.wood);
  mast.position.set(0, 0.21 + mastLen * 0.5, -0.004);
  mast.castShadow = true;
  mast.receiveShadow = true;
  mast.userData.slot = "primary";
  frameGroup.add(mast);

  // Carved height-adjustment peg holes along the central mast
  const notchGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 0.004, 10);
  notchGeo.rotateX(Math.PI * 0.5);
  for (let ny = 0.62; ny <= 1.26; ny += 0.08) {
    const hole = new THREE.Mesh(notchGeo, mats.rubber);
    hole.position.set(0, ny, -0.0155);
    frameGroup.add(hole);
  }

  // --- Back Support Leg & Brass Hinge ---
  const hingeLocal = new THREE.Vector3(0, 1.34, -0.022);
  const hingeWorld = hingeLocal.clone().applyEuler(frameGroup.rotation).add(frameGroup.position);
  const backFootWorld = new THREE.Vector3(0, 0.012, -0.315);

  const backDir = new THREE.Vector3().subVectors(hingeWorld, backFootWorld);
  const backLen = backDir.length();
  const backMid = new THREE.Vector3().addVectors(backFootWorld, hingeWorld).multiplyScalar(0.5);

  const backLegGeo = makeBeveledBeam(THREE, 0.032, 0.024, backLen, 0.0045, kit.noise, 23);
  const backLeg = new THREE.Mesh(backLegGeo, mats.wood);
  backLeg.name = "backLeg";
  backLeg.position.copy(backMid);
  backLeg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), backDir.clone().normalize());
  backLeg.castShadow = true;
  backLeg.receiveShadow = true;
  backLeg.userData.slot = "primary";
  body.add(backLeg);

  const footBack = buildFootPad(THREE, mats.rubber);
  footBack.position.set(0, 0, -0.315);
  footBack.userData.slot = "secondary";
  body.add(footBack);

  // Brass top hinge barrel & leaves
  const hingeGroup = new THREE.Group();
  hingeGroup.position.copy(hingeWorld);
  const barrelGeo = new THREE.CylinderGeometry(0.0075, 0.0075, 0.044, 16);
  barrelGeo.rotateZ(Math.PI * 0.5);
  const barrel = new THREE.Mesh(barrelGeo, mats.brass);
  barrel.castShadow = true;
  barrel.userData.slot = "secondary";
  hingeGroup.add(barrel);

  const leafGeo = new THREE.BoxGeometry(0.036, 0.032, 0.004);
  const leafFront = new THREE.Mesh(leafGeo, mats.brass);
  leafFront.position.set(0, -0.016, 0.006);
  leafFront.userData.slot = "secondary";
  hingeGroup.add(leafFront);

  const leafBack = new THREE.Mesh(leafGeo, mats.brass);
  leafBack.position.set(0, -0.016, -0.008);
  leafBack.rotation.x = 0.26;
  leafBack.userData.slot = "secondary";
  hingeGroup.add(leafBack);
  body.add(hingeGroup);

  // --- Curved Leather Stay Strap (Tapered Tube along CatmullRomCurve3) ---
  const strapAnchorFront = new THREE.Vector3(0, 0.44, -0.016)
    .applyEuler(frameGroup.rotation)
    .add(frameGroup.position);
  const strapAnchorBack = backFootWorld.clone().lerp(hingeWorld, 0.32);
  strapAnchorBack.z += 0.012;

  const strapGroup = new THREE.Group();
  strapGroup.name = "strap";
  const strapPivot = strapAnchorFront.clone().lerp(strapAnchorBack, 0.5);
  strapGroup.position.copy(strapPivot);

  const p0 = strapAnchorFront.clone().sub(strapPivot);
  const p4 = strapAnchorBack.clone().sub(strapPivot);
  const p1 = p0.clone().lerp(p4, 0.25);
  p1.y -= 0.036;
  const p2 = p0.clone().lerp(p4, 0.5);
  p2.y -= 0.052;
  const p3 = p0.clone().lerp(p4, 0.75);
  p3.y -= 0.036;

  const strapCurve = new THREE.CatmullRomCurve3([p0, p1, p2, p3, p4]);
  const strapGeo = makeTaperedTube(
    THREE,
    strapCurve,
    28,
    12,
    (t) => 0.0028 + 0.0006 * Math.sin(t * Math.PI),
    (t) => 0.0085 - 0.0012 * Math.sin(t * Math.PI),
    true
  );
  const strapMesh = new THREE.Mesh(strapGeo, mats.leather);
  strapMesh.castShadow = true;
  strapMesh.receiveShadow = true;
  strapMesh.userData.slot = "secondary";
  strapGroup.add(strapMesh);
  body.add(strapGroup);

  // Brass anchor rivets for the leather stay strap
  const rivetGeo = new THREE.SphereGeometry(0.0052, 12, 10);
  const rivetF = new THREE.Mesh(rivetGeo, mats.brass);
  rivetF.position.copy(strapAnchorFront);
  rivetF.userData.slot = "secondary";
  body.add(rivetF);

  const rivetB = new THREE.Mesh(rivetGeo, mats.brass);
  rivetB.position.copy(strapAnchorBack);
  rivetB.userData.slot = "secondary";
  body.add(rivetB);

  // --- Stretched Canvas & Abstract Landscape Painting ---
  const canvasW = 0.44;
  const canvasH = 0.56;
  const canvasD = 0.024;
  const canvasBottomY = 0.538;

  const canvas = buildStretchedCanvas(THREE, kit, canvasW, canvasH, canvasD, mats);
  canvas.position.set(0, canvasBottomY + canvasH * 0.5, 0.018 + canvasD * 0.5);
  frameGroup.add(canvas);

  // --- Sliding Wooden Top Canvas Clamp + Brass Thumbscrew ---
  const clampY = canvasBottomY + canvasH;
  const clampGroup = new THREE.Group();
  clampGroup.name = "topClamp";
  clampGroup.position.set(0, clampY, 0.0);

  const clampBlock = new THREE.Mesh(
    makeBeveledBeam(THREE, 0.072, 0.068, 0.032, 0.004, kit.noise, 53),
    mats.wood
  );
  clampBlock.position.set(0, 0.017, 0.014);
  clampBlock.castShadow = true;
  clampBlock.receiveShadow = true;
  clampBlock.userData.slot = "primary";
  clampGroup.add(clampBlock);

  const clampLip = new THREE.Mesh(
    makeBeveledBeam(THREE, 0.070, 0.012, 0.022, 0.0025, kit.noise, 55),
    mats.wood
  );
  clampLip.position.set(0, -0.004, 0.046);
  clampLip.castShadow = true;
  clampLip.userData.slot = "primary";
  clampGroup.add(clampLip);

  const clampKnob = buildBrassKnob(THREE, mats.brass);
  clampKnob.rotation.x = -Math.PI * 0.5;
  clampKnob.position.set(0, 0.017, -0.018);
  clampGroup.add(clampKnob);
  frameGroup.add(clampGroup);

  // --- Horizontal Canvas Ledge / Shelf Tray ---
  const ledgeGroup = new THREE.Group();
  ledgeGroup.name = "ledge";
  ledgeGroup.position.set(0, 0.535, 0.014);
  // Counter-rotate so shelf deck is nearly horizontal (tilted ~1.1 deg back so brushes stay put)
  ledgeGroup.rotation.x = tilt - 0.02;
  frameGroup.add(ledgeGroup);

  const shelfW = 0.60;
  const shelfD = 0.125;
  const shelfH = 0.021;

  // Main shelf deck (top surface sits cleanly at y = 0)
  const deckGeo = makeBeveledBeam(THREE, shelfH, shelfD, shelfW, 0.004, kit.noise, 61);
  const deck = new THREE.Mesh(deckGeo, mats.wood);
  deck.rotation.z = Math.PI * 0.5;
  deck.position.set(0, -shelfH * 0.5, shelfD * 0.5 - 0.006);
  deck.castShadow = true;
  deck.receiveShadow = true;
  deck.userData.slot = "primary";
  ledgeGroup.add(deck);

  // Front retainer lip so brushes & palette nestle safely
  const lipGeo = makeBeveledBeam(THREE, 0.024, 0.012, shelfW, 0.003, kit.noise, 67);
  const frontLip = new THREE.Mesh(lipGeo, mats.wood);
  frontLip.rotation.z = Math.PI * 0.5;
  frontLip.position.set(0, 0.008, shelfD - 0.012);
  frontLip.castShadow = true;
  frontLip.receiveShadow = true;
  frontLip.userData.slot = "primary";
  ledgeGroup.add(frontLip);

  // Back flange & curved wooden support corbels beneath the ledge
  const backFlange = new THREE.Mesh(
    makeBeveledBeam(THREE, 0.044, 0.014, 0.42, 0.003, kit.noise, 71),
    mats.wood
  );
  backFlange.rotation.z = Math.PI * 0.5;
  backFlange.position.set(0, -0.032, -0.002);
  backFlange.castShadow = true;
  backFlange.userData.slot = "primary";
  ledgeGroup.add(backFlange);

  const corbelShape = new THREE.Shape();
  corbelShape.moveTo(0, 0);
  corbelShape.lineTo(0.088, 0);
  corbelShape.bezierCurveTo(0.068, -0.008, 0.022, -0.024, 0.012, -0.056);
  corbelShape.lineTo(0, -0.056);
  corbelShape.closePath();
  const corbelGeo = new THREE.ExtrudeGeometry(corbelShape, {
    depth: 0.016,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 2,
    curveSegments: 14,
  });
  corbelGeo.translate(0, 0, -0.008);
  corbelGeo.rotateY(-Math.PI * 0.5);

  for (const sx of [-0.175, 0.175]) {
    const corbel = new THREE.Mesh(corbelGeo, mats.wood);
    corbel.position.set(sx, -shelfH + 0.002, 0.004);
    corbel.castShadow = true;
    corbel.receiveShadow = true;
    corbel.userData.slot = "primary";
    ledgeGroup.add(corbel);
  }

  // Brass adjustment knob beneath the shelf center
  const shelfKnob = buildBrassKnob(THREE, mats.brass);
  shelfKnob.rotation.x = Math.PI * 0.5;
  shelfKnob.position.set(0, -0.034, 0.006);
  ledgeGroup.add(shelfKnob);

  // --- Small Artist's Palette propped on left side of the ledge ---
  const palette = buildPalette(THREE, kit, cfg.accent, mats);
  palette.position.set(-0.205, 0.053, 0.075);
  palette.rotation.set(-0.52, 0.18, 0.08);
  ledgeGroup.add(palette);

  // --- Glazed Ceramic Brush Cup with 3 Upright Brushes on right end of ledge ---
  const brushCup = buildBrushCup(THREE, kit, cfg.accent, mats);
  brushCup.position.set(0.246, 0.0, 0.076);
  ledgeGroup.add(brushCup);

  // --- 3 Horizontal Paintbrushes resting casually on the ledge ---
  const flatBrushesGroup = new THREE.Group();
  flatBrushesGroup.name = "ledgeBrushes";
  ledgeGroup.add(flatBrushesGroup);

  const ledgeBrushSpecs = [
    {
      handleLen: 0.158,
      radius: 0.0046,
      handleColor: "#8c5434",
      bandColor: "#efe4cf",
      type: "flat",
      ferruleLen: 0.025,
      bristleLen: 0.022,
      paintTip: cfg.accent,
      tipSlot: "accent",
      pos: [0.115, 0.0048, 0.078],
      rotZ: Math.PI * 0.5,
      rotY: 0.13,
    },
    {
      handleLen: 0.148,
      radius: 0.0038,
      handleColor: "#486b5c",
      bandColor: "#e4c47d",
      type: "filbert",
      ferruleLen: 0.022,
      bristleLen: 0.020,
      paintTip: "#df9e48",
      tipSlot: "secondary",
      pos: [-0.032, 0.0040, 0.058],
      rotZ: -Math.PI * 0.5,
      rotY: -0.09,
    },
    {
      handleLen: 0.136,
      radius: 0.0032,
      handleColor: "#c26c4e",
      bandColor: "#f7efe0",
      type: "round",
      ferruleLen: 0.019,
      bristleLen: 0.018,
      paintTip: "#f4ead9",
      tipSlot: "secondary",
      pos: [0.148, 0.0034, 0.096],
      rotZ: Math.PI * 0.5,
      rotY: -0.14,
    },
  ];

  for (const sp of ledgeBrushSpecs) {
    const br = buildBrush(THREE, kit, sp, mats);
    br.position.set(sp.pos[0], sp.pos[1], sp.pos[2]);
    br.rotation.order = "YXZ";
    br.rotation.set(0, sp.rotY, sp.rotZ);
    flatBrushesGroup.add(br);
  }

  // --- Squeezed Tube of Accent Paint resting on the ledge ---
  const paintTube = buildPaintTube(THREE, kit, cfg.accent);
  paintTube.position.set(-0.078, 0.0075, 0.088);
  paintTube.rotation.order = "YXZ";
  paintTube.rotation.set(0, 0.48, -Math.PI * 0.5);
  ledgeGroup.add(paintTube);

  // --- Wooden Side Peg & Gently Swaying Draped Linen Paint Rag ---
  const pegYLocal = 0.80;
  const pegXLocal = legXAtY(pegYLocal) + 0.014;
  const pegGeo = new THREE.LatheGeometry(
    [
      [0.0, 0.0],
      [0.0065, 0.0],
      [0.0065, 0.026],
      [0.0095, 0.036],
      [0.0095, 0.044],
      [0.0065, 0.048],
      [0.0, 0.049],
    ].map(([r, y]) => new THREE.Vector2(r, y)),
    16
  );
  const peg = new THREE.Mesh(pegGeo, mats.wood);
  peg.rotation.z = -Math.PI * 0.5;
  peg.position.set(pegXLocal, pegYLocal, 0.0);
  peg.castShadow = true;
  peg.userData.slot = "primary";
  frameGroup.add(peg);

  // Place rag in root world space at peg tip so it hangs straight down under gravity
  const ragAnchorWorld = new THREE.Vector3(pegXLocal + 0.030, pegYLocal, 0.0)
    .applyEuler(frameGroup.rotation)
    .add(frameGroup.position);

  const cloth = buildDrapedRag(THREE, kit, cfg.accent);
  cloth.position.copy(ragAnchorWorld);
  body.add(cloth);

  // Store animation handles for idle()
  root.userData._anim = {
    cloth,
    strap: strapGroup,
  };

  return root;
}

export function idle(group, t) {
  const anim = group && group.userData && group.userData._anim;
  if (!anim) return;

  // Soft dorm-room breeze stirring the hanging paint rag
  if (anim.cloth) {
    anim.cloth.rotation.z = Math.sin(t * 1.1) * 0.034 + Math.sin(t * 2.15 + 0.7) * 0.012;
    anim.cloth.rotation.x = Math.cos(t * 0.85 + 0.4) * 0.018;
  }

  // Subtle sympathetic whisper of motion in the hanging leather stay strap
  if (anim.strap) {
    anim.strap.rotation.z = Math.sin(t * 1.35 + 0.9) * 0.009;
  }
}

export const META = {
  id: "painters_easel",
  name: "Painter's Easel",
  kind: "prop",
  footprint: [0.62, 0.60],
  variants: [
    { name: "Honey Oak & Sky", opts: { wood: "#c89462", accent: "#8fc1e8" } },
    { name: "Warm Walnut & Sage", opts: { wood: "#8c5c3c", accent: "#8fb89d" } },
    { name: "Pale Birch & Terracotta", opts: { wood: "#dfc096", accent: "#d98468" } },
    { name: "Cherry Wood & Lavender", opts: { wood: "#a96045", accent: "#b19cd9" } },
  ],
  note: "Cozy dorm-room wooden A-frame easel holding a stretched canvas with an impasto abstract landscape, brush ledge with sculpted paintbrushes, glazed ceramic cup, squeezed paint tube, curved wooden palette with glossy wet paint dollops, and a softly swaying linen paint rag.",
};
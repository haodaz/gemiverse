// Stylised Framed Abstract Landscape for a Cozy Dorm-Room Diorama
// Origin at the centre of the back face (z = 0), facing +z. Units in metres, Y up.

export const META = {
  id: 'framed_picture',
  name: 'Framed Abstract Landscape',
  kind: 'wall_decor',
  footprint: [0.45, 0.034],
  variants: ['Single Frame', 'Triptych Set', 'Round Frame'],
  note: 'Hero stylised framed wall picture (0.45 m x 0.60 m single, triptych set of three, or lathe-turned round frame). Origin at centre of back face, facing +z.'
};

// ---------------------------------------------------------------------------
// Deterministic PRNG & Noise Helpers
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fbm(kit, x, y, octaves = 3) {
  let v = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    v += kit.noise(x * freq, y * freq) * amp;
    norm += amp;
    freq *= 2.03;
    amp *= 0.5;
  }
  return v / norm;
}

// ---------------------------------------------------------------------------
// Colour Utilities (THREE.Color only, no globals)
// ---------------------------------------------------------------------------

function makeColor(THREE, input, fallback) {
  const c = new THREE.Color();
  try {
    c.set(input != null ? input : fallback);
  } catch {
    c.set(fallback);
  }
  return c;
}

function mixColor(THREE, a, b, t) {
  return a.clone().lerp(b, t);
}

function rgbStr(c, alpha = 1) {
  const r = Math.round(Math.min(1, Math.max(0, c.r)) * 255);
  const g = Math.round(Math.min(1, Math.max(0, c.g)) * 255);
  const b = Math.round(Math.min(1, Math.max(0, c.b)) * 255);
  return alpha >= 0.999 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

function setSRGB(THREE, tex) {
  if (tex && 'colorSpace' in tex && THREE.SRGBColorSpace) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  return tex;
}

// ---------------------------------------------------------------------------
// Procedural Textures via kit.canvasTexture
// ---------------------------------------------------------------------------

function makeWoodTextures(THREE, kit, woodHex) {
  const base = makeColor(THREE, woodHex, '#8a5a3b');
  const dark = mixColor(THREE, base, new THREE.Color('#24130a'), 0.52);
  const light = mixColor(THREE, base, new THREE.Color('#e8caa4'), 0.28);
  const pore = mixColor(THREE, base, new THREE.Color('#1a0c05'), 0.72);

  const size = 256;
  const grainData = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const warp = fbm(kit, u * 3.2 + 1.7, v * 1.4 + 4.1, 3) * 0.45;
      const rings = Math.sin((v * 14.0 + warp * 11.0) * Math.PI * 2) * 0.5 + 0.5;
      const fine = kit.noise(u * 6.0 + 9.2, v * 72.0 + warp * 18.0);
      const streak = kit.noise(u * 2.5 + 3.1, v * 28.0);
      const val = rings * 0.42 + fine * 0.36 + streak * 0.22;
      grainData[y * size + x] = val;
    }
  }

  const map = kit.canvasTexture(size, size, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const rng = mulberry32(4109);
    const tmp = new THREE.Color();

    for (let i = 0; i < w * h; i++) {
      const g = grainData[i];
      if (g < 0.45) {
        tmp.copy(dark).lerp(base, g / 0.45);
      } else {
        tmp.copy(base).lerp(light, (g - 0.45) / 0.55);
      }
      // Subtle wood pores
      if (g < 0.22 && rng() < 0.35) {
        tmp.lerp(pore, 0.55);
      }
      const idx = i * 4;
      d[idx] = Math.round(tmp.r * 255);
      d[idx + 1] = Math.round(tmp.g * 255);
      d[idx + 2] = Math.round(tmp.b * 255);
      d[idx + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });

  const bumpMap = kit.canvasTexture(size, size, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < w * h; i++) {
      const v = Math.round(Math.min(1, Math.max(0, grainData[i])) * 255);
      const idx = i * 4;
      d[idx] = v;
      d[idx + 1] = v;
      d[idx + 2] = v;
      d[idx + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });

  for (const t of [map, bumpMap]) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
  }
  setSRGB(THREE, map);
  return { map, bumpMap };
}

function makeMatTextures(THREE, kit) {
  const size = 256;
  const rng = mulberry32(8821);
  const tooth = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n1 = kit.noise(x * 0.08 + 2.3, y * 0.08 + 5.7);
      const n2 = rng();
      tooth[y * size + x] = n1 * 0.65 + n2 * 0.35;
    }
  }

  const map = kit.canvasTexture(size, size, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < w * h; i++) {
      const t = (tooth[i] - 0.5) * 14;
      const idx = i * 4;
      d[idx] = Math.min(255, Math.max(0, Math.round(244 + t)));
      d[idx + 1] = Math.min(255, Math.max(0, Math.round(238 + t)));
      d[idx + 2] = Math.min(255, Math.max(0, Math.round(227 + t * 0.9)));
      d[idx + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);

    // Subtle cotton-rag fibers
    ctx.strokeStyle = 'rgba(180, 165, 145, 0.14)';
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 160; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const len = 3 + rng() * 9;
      const ang = rng() * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
  });

  const bumpMap = kit.canvasTexture(size, size, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < w * h; i++) {
      const v = Math.round(tooth[i] * 255);
      const idx = i * 4;
      d[idx] = v;
      d[idx + 1] = v;
      d[idx + 2] = v;
      d[idx + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });

  for (const t of [map, bumpMap]) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    t.needsUpdate = true;
  }
  setSRGB(THREE, map);
  return { map, bumpMap };
}

function makeBackingTexture(THREE, kit) {
  const rng = mulberry32(3197);
  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#40362e';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1200; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const s = 1 + rng() * 2.5;
      const shade = 48 + Math.floor(rng() * 34);
      ctx.fillStyle = `rgba(${shade + 12}, ${shade + 4}, ${shade - 4}, 0.32)`;
      ctx.fillRect(x, y, s * 2.2, s * 0.8);
    }
    // Subtle stamped framer's mark in back center
    ctx.strokeStyle = 'rgba(215, 195, 165, 0.16)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(w * 0.36, h * 0.44, w * 0.28, h * 0.12);
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.5, w * 0.032, 0, Math.PI * 2);
    ctx.stroke();
  });
  setSRGB(THREE, map);
  return map;
}

function makeGlassTexture(THREE, kit) {
  // Subtle diagonal dorm-window reflection sheen painted into an RGBA texture
  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);

    // Very soft ambient glass tint
    const baseGrad = ctx.createLinearGradient(0, 0, w, h);
    baseGrad.addColorStop(0.0, 'rgba(255, 252, 246, 0.13)');
    baseGrad.addColorStop(0.45, 'rgba(245, 250, 255, 0.03)');
    baseGrad.addColorStop(1.0, 'rgba(235, 245, 255, 0.08)');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, w, h);

    // Primary diagonal reflection band
    ctx.save();
    ctx.translate(w * 0.5, h * 0.5);
    ctx.rotate(-0.56);

    const band1 = ctx.createLinearGradient(-w * 0.26, 0, w * 0.02, 0);
    band1.addColorStop(0.0, 'rgba(255, 253, 248, 0.0)');
    band1.addColorStop(0.32, 'rgba(255, 253, 248, 0.19)');
    band1.addColorStop(0.55, 'rgba(255, 253, 248, 0.22)');
    band1.addColorStop(0.85, 'rgba(255, 253, 248, 0.05)');
    band1.addColorStop(1.0, 'rgba(255, 253, 248, 0.0)');
    ctx.fillStyle = band1;
    ctx.fillRect(-w * 0.26, -h * 0.9, w * 0.28, h * 1.8);

    // Secondary thinner streak parallel to the first
    const band2 = ctx.createLinearGradient(w * 0.05, 0, w * 0.18, 0);
    band2.addColorStop(0.0, 'rgba(255, 253, 248, 0.0)');
    band2.addColorStop(0.45, 'rgba(255, 253, 248, 0.13)');
    band2.addColorStop(1.0, 'rgba(255, 253, 248, 0.0)');
    ctx.fillStyle = band2;
    ctx.fillRect(w * 0.05, -h * 0.9, w * 0.13, h * 1.8);

    // Faint soft edge highlight
    const band3 = ctx.createLinearGradient(-w * 0.48, 0, -w * 0.35, 0);
    band3.addColorStop(0.0, 'rgba(255, 252, 245, 0.0)');
    band3.addColorStop(0.5, 'rgba(255, 252, 245, 0.08)');
    band3.addColorStop(1.0, 'rgba(255, 252, 245, 0.0)');
    ctx.fillStyle = band3;
    ctx.fillRect(-w * 0.48, -h * 0.9, w * 0.13, h * 1.8);

    ctx.restore();
  });

  setSRGB(THREE, map);
  return map;
}

// ---------------------------------------------------------------------------
// Procedural Abstract Landscape Artwork (Gouache on Cold-Press Paper)
// ---------------------------------------------------------------------------

function makeLandscapeTextures(THREE, kit, opts, widthPx, heightPx, region) {
  const cream = new THREE.Color('#f6efe2');
  const warmWhite = new THREE.Color('#fbf7ee');
  const primary = makeColor(THREE, opts?.primary, '#d97b54');
  const secondary = makeColor(THREE, opts?.secondary, '#5b7d7c');
  const accent = makeColor(THREE, opts?.accent, '#e8b95b');

  // Curated harmonious cozy gouache palette derived from opts
  const skyTop = mixColor(THREE, secondary, cream, 0.56);
  const skyMid1 = mixColor(THREE, secondary, cream, 0.76);
  const skyMid2 = mixColor(THREE, primary, cream, 0.68);
  const skyMid3 = mixColor(THREE, mixColor(THREE, primary, accent, 0.48), cream, 0.46);
  const skyHorizon = mixColor(THREE, accent, cream, 0.64);

  const sunCore = mixColor(THREE, accent, warmWhite, 0.14);
  const sunWarm = mixColor(THREE, accent, primary, 0.25);

  const hillFar = mixColor(THREE, secondary, cream, 0.42);
  const hillMidCool = mixColor(THREE, secondary, new THREE.Color('#2c3d3f'), 0.16);
  const hillMidCoolLight = mixColor(THREE, secondary, cream, 0.26);
  const hillWarm = mixColor(THREE, primary, new THREE.Color('#5a2614'), 0.08);
  const hillWarmRim = mixColor(THREE, primary, accent, 0.42);
  const hillForeLeft = mixColor(THREE, mixColor(THREE, primary, secondary, 0.48), new THREE.Color('#1d1917'), 0.38);
  const hillForeRight = mixColor(THREE, mixColor(THREE, secondary, primary, 0.35), new THREE.Color('#191f1e'), 0.46);
  const riverLight = mixColor(THREE, accent, warmWhite, 0.52);

  const { u0, u1, v0, v1, seedOffset = 0 } = region;
  const uSpan = u1 - u0;
  const vSpan = v1 - v0;

  // Map normalized global landscape coords (U, V) -> canvas pixel coords (x, y)
  const toX = (U) => ((U - u0) / uSpan) * widthPx;
  const toY = (V) => ((V - v0) / vSpan) * heightPx;
  const fromX = (x) => u0 + (x / widthPx) * uSpan;

  // Deterministic hill ridge height functions in global landscape (U, V) space
  const farHillV = (U) =>
    0.535
    - Math.sin(U * Math.PI * 1.35 + 0.5) * 0.055
    - Math.cos(U * Math.PI * 2.6 - 0.8) * 0.024
    - (kit.noise(U * 4.5 + 1.2, 2.3) - 0.5) * 0.025;

  const midCoolHillV = (U) =>
    0.618
    - Math.sin((U - 0.05) * Math.PI * 1.45) * 0.068
    + Math.cos(U * Math.PI * 3.1 + 0.4) * 0.022
    - (kit.noise(U * 5.2 + 4.1, 6.4) - 0.5) * 0.024;

  const warmHillV = (U) =>
    0.705
    - Math.sin((U - 0.32) * Math.PI * 1.35) * 0.078
    - Math.sin(U * Math.PI * 2.8 + 1.1) * 0.026
    - (kit.noise(U * 4.8 + 8.3, 1.7) - 0.5) * 0.022;

  const foreLeftHillV = (U) =>
    0.835
    - Math.pow(Math.max(0, 1.0 - U * 1.32), 1.7) * 0.145
    + Math.sin(U * Math.PI * 3.2) * 0.014
    - (kit.noise(U * 6.0 + 3.4, 9.1) - 0.5) * 0.015;

  const foreRightHillV = (U) =>
    0.855
    - Math.pow(Math.max(0, (U - 0.24) / 0.76), 1.85) * 0.155
    - Math.sin(U * Math.PI * 2.5 + 0.7) * 0.016
    - (kit.noise(U * 5.5 + 7.2, 4.9) - 0.5) * 0.015;

  const map = kit.canvasTexture(widthPx, heightPx, (ctx, w, h) => {
    const rng = mulberry32(1471 + seedOffset);

    // 1. Warm cream paper base
    ctx.fillStyle = rgbStr(cream);
    ctx.fillRect(0, 0, w, h);

    // 2. Soft painterly horizontal bands of colour in the sky
    const bands = [
      { vStart: -0.05, vEnd: 0.17, color: skyTop, waveAmp: 0.014, phase: 0.3 },
      { vStart: 0.13, vEnd: 0.29, color: skyMid1, waveAmp: 0.016, phase: 1.4 },
      { vStart: 0.24, vEnd: 0.41, color: skyMid2, waveAmp: 0.015, phase: 2.6 },
      { vStart: 0.36, vEnd: 0.52, color: skyMid3, waveAmp: 0.013, phase: 3.9 },
      { vStart: 0.46, vEnd: 0.68, color: skyHorizon, waveAmp: 0.012, phase: 5.1 }
    ];

    for (let b = 0; b < bands.length; b++) {
      const band = bands[b];
      const grad = ctx.createLinearGradient(0, toY(band.vStart), 0, toY(band.vEnd));
      grad.addColorStop(0.0, rgbStr(band.color, b === 0 ? 1.0 : 0.0));
      grad.addColorStop(0.28, rgbStr(band.color, 0.92));
      grad.addColorStop(0.78, rgbStr(band.color, 0.95));
      grad.addColorStop(1.0, rgbStr(band.color, 0.0));

      ctx.beginPath();
      ctx.moveTo(-4, toY(band.vStart));
      const steps = 48;
      for (let i = 0; i <= steps; i++) {
        const px = (i / steps) * (w + 8) - 4;
        const U = fromX(px);
        const ripple =
          Math.sin(U * Math.PI * 2.2 + band.phase) * band.waveAmp +
          (kit.noise(U * 3.5 + b * 2.1, b * 1.7) - 0.5) * band.waveAmp;
        ctx.lineTo(px, toY(band.vStart + ripple));
      }
      for (let i = steps; i >= 0; i--) {
        const px = (i / steps) * (w + 8) - 4;
        const U = fromX(px);
        const ripple =
          Math.cos(U * Math.PI * 1.9 + band.phase) * band.waveAmp +
          (kit.noise(U * 3.1 + b * 2.9, b * 2.4 + 5) - 0.5) * band.waveAmp;
        ctx.lineTo(px, toY(band.vEnd + ripple));
      }
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Extra delicate gouache wash bands across upper sky
    for (let i = 0; i < 8; i++) {
      const bandV = 0.06 + i * 0.062;
      const bandH = (0.018 + (i % 3) * 0.008) * (h / vSpan);
      const col = i < 3 ? skyMid1 : i < 6 ? skyMid2 : skyHorizon;
      ctx.fillStyle = rgbStr(mixColor(THREE, col, warmWhite, 0.35), 0.22);
      ctx.beginPath();
      ctx.moveTo(0, toY(bandV));
      for (let s = 0; s <= 24; s++) {
        const px = (s / 24) * w;
        const U = fromX(px);
        const dy = Math.sin(U * 7.5 + i * 1.3) * 4;
        ctx.lineTo(px, toY(bandV) + dy);
      }
      ctx.lineTo(w, toY(bandV) + bandH);
      ctx.lineTo(0, toY(bandV) + bandH);
      ctx.closePath();
      ctx.fill();
    }

    // 3. Stylized Sun & Glowing Halo Rings
    const sunU = 0.51;
    const sunV = 0.315;
    const sunX = toX(sunU);
    const sunY = toY(sunV);
    // Keep sun circular in pixel space
    const sunR = 0.105 * (h / vSpan);

    // Outer warm atmospheric glow
    const haloGrad = ctx.createRadialGradient(sunX, sunY, sunR * 0.3, sunX, sunY, sunR * 2.7);
    haloGrad.addColorStop(0.0, rgbStr(sunCore, 0.48));
    haloGrad.addColorStop(0.45, rgbStr(skyHorizon, 0.24));
    haloGrad.addColorStop(1.0, rgbStr(skyHorizon, 0.0));
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 2.7, 0, Math.PI * 2);
    ctx.fill();

    // Soft concentric print rings around the sun
    ctx.strokeStyle = rgbStr(warmWhite, 0.34);
    ctx.lineWidth = Math.max(1.2, sunR * 0.045);
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 1.38, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = rgbStr(sunCore, 0.22);
    ctx.lineWidth = Math.max(1.0, sunR * 0.028);
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 1.76, 0, Math.PI * 2);
    ctx.stroke();

    // Main sun disc with warm internal gouache gradient
    const sunGrad = ctx.createLinearGradient(sunX, sunY - sunR, sunX, sunY + sunR);
    sunGrad.addColorStop(0.0, rgbStr(mixColor(THREE, sunCore, warmWhite, 0.28)));
    sunGrad.addColorStop(0.55, rgbStr(sunCore));
    sunGrad.addColorStop(1.0, rgbStr(sunWarm));
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();

    // Subtle painterly dry-brush stipple inside sun disc
    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.clip();
    for (let i = 0; i < 42; i++) {
      const sy = sunY - sunR + (i / 42) * sunR * 2;
      ctx.fillStyle = i % 2 === 0 ? rgbStr(warmWhite, 0.09) : rgbStr(sunWarm, 0.08);
      ctx.fillRect(sunX - sunR, sy, sunR * 2, Math.max(1, sunR * 0.035));
    }
    ctx.restore();

    // 4. Stylized Soft Cloud Ribbons
    const drawCloud = (cU, cV, lenU, thickV, alpha) => {
      const cx = toX(cU);
      const cy = toY(cV);
      const rx = (lenU / uSpan) * w * 0.5;
      const ry = (thickV / vSpan) * h * 0.5;
      ctx.fillStyle = rgbStr(warmWhite, alpha);
      ctx.beginPath();
      ctx.moveTo(cx - rx, cy + ry * 0.4);
      ctx.bezierCurveTo(cx - rx * 0.7, cy - ry * 1.15, cx - rx * 0.1, cy - ry * 1.25, cx + rx * 0.15, cy - ry * 0.45);
      ctx.bezierCurveTo(cx + rx * 0.45, cy - ry * 0.95, cx + rx * 0.85, cy - ry * 0.55, cx + rx, cy + ry * 0.4);
      ctx.closePath();
      ctx.fill();
    };
    drawCloud(0.24, 0.23, 0.24, 0.032, 0.46);
    drawCloud(0.76, 0.26, 0.22, 0.028, 0.42);
    drawCloud(0.45, 0.405, 0.26, 0.024, 0.48); // softly crosses lower sun edge
    drawCloud(0.68, 0.44, 0.18, 0.02, 0.34);

    // Helper to fill a hill silhouette with a smooth vertical gradient + optional ridge highlights/strata
    const fillHill = (heightFn, topColor, bottomColor, options = {}) => {
      const steps = 96;
      let minY = h;
      const pts = [];
      for (let i = 0; i <= steps; i++) {
        const px = (i / steps) * (w + 4) - 2;
        const U = fromX(px);
        const py = toY(heightFn(U));
        pts.push([px, py, U]);
        if (py < minY) minY = py;
      }

      const grad = ctx.createLinearGradient(0, minY, 0, h);
      grad.addColorStop(0.0, rgbStr(topColor));
      grad.addColorStop(0.55, rgbStr(mixColor(THREE, topColor, bottomColor, 0.6)));
      grad.addColorStop(1.0, rgbStr(bottomColor));

      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0], pts[i][1]);
      }
      ctx.lineTo(w + 4, h + 4);
      ctx.lineTo(-4, h + 4);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Sunlit crest rim
      if (options.rimColor) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i][0], pts[i][1]);
        }
        ctx.strokeStyle = rgbStr(options.rimColor, options.rimAlpha ?? 0.48);
        ctx.lineWidth = options.rimWidth ?? Math.max(2, h * 0.008);
        ctx.stroke();
        ctx.restore();
      }

      // Soft mid-century terraced contour bands inside the hill
      if (options.strata) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i][0], pts[i][1]);
        }
        ctx.lineTo(w + 4, h + 4);
        ctx.lineTo(-4, h + 4);
        ctx.closePath();
        ctx.clip();

        for (let k = 1; k <= options.strata; k++) {
          const offsetPx = k * (h * 0.036);
          ctx.beginPath();
          for (let i = 0; i < pts.length; i++) {
            const [px, py, U] = pts[i];
            const wave = Math.sin(U * 9.0 + k * 1.4) * (h * 0.006);
            if (i === 0) ctx.moveTo(px, py + offsetPx + wave);
            else ctx.lineTo(px, py + offsetPx + wave);
          }
          ctx.strokeStyle = rgbStr(options.strataColor || warmWhite, 0.14);
          ctx.lineWidth = Math.max(1.5, h * 0.009);
          ctx.stroke();
        }
        ctx.restore();
      }
    };

    // 5. Layered Rolling Hills
    // Far misty ridge
    fillHill(farHillV, hillFar, mixColor(THREE, hillFar, skyHorizon, 0.45), {
      rimColor: warmWhite,
      rimAlpha: 0.25,
      rimWidth: Math.max(1.5, h * 0.004)
    });

    // Mid-far sage-teal rolling hills
    fillHill(midCoolHillV, hillMidCoolLight, hillMidCool, {
      rimColor: mixColor(THREE, hillMidCoolLight, warmWhite, 0.45),
      rimAlpha: 0.34,
      rimWidth: Math.max(1.8, h * 0.006),
      strata: 3,
      strataColor: skyHorizon
    });

    // Warm terracotta sunlit mid-hill
    fillHill(warmHillV, hillWarmRim, hillWarm, {
      rimColor: mixColor(THREE, accent, warmWhite, 0.35),
      rimAlpha: 0.5,
      rimWidth: Math.max(2.2, h * 0.007),
      strata: 4,
      strataColor: accent
    });

    // 6. Winding Sunlit Valley River Ribbon
    ctx.save();
    ctx.beginPath();
    const rSteps = 44;
    const leftEdge = [];
    const rightEdge = [];
    for (let i = 0; i <= rSteps; i++) {
      const t = i / rSteps;
      const V = 0.685 + t * 0.335;
      const centerU = 0.51 + Math.sin(t * Math.PI * 2.1 - 0.35) * (0.045 + t * 0.055) - t * 0.04;
      const halfW = 0.006 + Math.pow(t, 1.55) * 0.055;
      leftEdge.push([toX(centerU - halfW), toY(V)]);
      rightEdge.push([toX(centerU + halfW), toY(V)]);
    }
    ctx.moveTo(leftEdge[0][0], leftEdge[0][1]);
    for (let i = 1; i < leftEdge.length; i++) ctx.lineTo(leftEdge[i][0], leftEdge[i][1]);
    for (let i = rightEdge.length - 1; i >= 0; i--) ctx.lineTo(rightEdge[i][0], rightEdge[i][1]);
    ctx.closePath();

    const riverGrad = ctx.createLinearGradient(0, toY(0.68), 0, h);
    riverGrad.addColorStop(0.0, rgbStr(riverLight, 0.92));
    riverGrad.addColorStop(0.45, rgbStr(mixColor(THREE, accent, skyMid1, 0.38), 0.88));
    riverGrad.addColorStop(1.0, rgbStr(mixColor(THREE, secondary, cream, 0.45), 0.92));
    ctx.fillStyle = riverGrad;
    ctx.fill();

    // Shimmering sun glints on the river
    ctx.strokeStyle = rgbStr(warmWhite, 0.45);
    ctx.lineWidth = Math.max(1.2, h * 0.003);
    for (let i = 2; i < rSteps; i += 3) {
      const lx = leftEdge[i][0];
      const rx = rightEdge[i][0];
      const py = leftEdge[i][1];
      const pad = (rx - lx) * 0.22;
      ctx.beginPath();
      ctx.moveTo(lx + pad, py);
      ctx.lineTo(rx - pad, py);
      ctx.stroke();
    }
    ctx.restore();

    // 7. Cozy Deep Foreground Hills
    fillHill(foreLeftHillV, mixColor(THREE, hillForeLeft, primary, 0.25), hillForeLeft, {
      rimColor: hillWarmRim,
      rimAlpha: 0.36,
      rimWidth: Math.max(1.8, h * 0.005)
    });

    fillHill(foreRightHillV, mixColor(THREE, hillForeRight, secondary, 0.28), hillForeRight, {
      rimColor: mixColor(THREE, accent, hillMidCoolLight, 0.5),
      rimAlpha: 0.32,
      rimWidth: Math.max(1.8, h * 0.005)
    });

    // 8. Stylised Minimalist Cypress / Botanical Silhouette Accents along Ridges
    const drawTree = (U, V, scaleH, color) => {
      const tx = toX(U);
      const ty = toY(V);
      const th = (scaleH / vSpan) * h;
      const tw = th * 0.24;
      ctx.fillStyle = rgbStr(color, 0.9);
      ctx.beginPath();
      ctx.moveTo(tx, ty - th);
      ctx.bezierCurveTo(tx + tw, ty - th * 0.55, tx + tw * 0.95, ty - th * 0.1, tx, ty + th * 0.08);
      ctx.bezierCurveTo(tx - tw * 0.95, ty - th * 0.1, tx - tw, ty - th * 0.55, tx, ty - th);
      ctx.closePath();
      ctx.fill();
    };

    const treeDark = mixColor(THREE, hillForeRight, new THREE.Color('#121614'), 0.35);
    const treeClusters = [
      [0.18, foreLeftHillV(0.18) + 0.01, 0.052],
      [0.215, foreLeftHillV(0.215) + 0.015, 0.038],
      [0.242, foreLeftHillV(0.242) + 0.018, 0.028],
      [0.77, foreRightHillV(0.77) + 0.014, 0.044],
      [0.805, foreRightHillV(0.805) + 0.01, 0.056],
      [0.84, foreRightHillV(0.84) + 0.012, 0.036]
    ];
    for (const [tu, tv, ts] of treeClusters) {
      drawTree(tu, tv, ts, treeDark);
    }

    // Tiny warm botanical flecks / wildflower brush dots in foreground
    for (let i = 0; i < 65; i++) {
      const U = u0 + rng() * uSpan;
      const baseV = Math.min(foreLeftHillV(U), foreRightHillV(U));
      const V = baseV + 0.015 + rng() * (1.0 - baseV);
      if (V < v0 || V > v1) continue;
      const fx = toX(U);
      const fy = toY(V);
      const r = 1.2 + rng() * 2.4;
      ctx.fillStyle = i % 3 === 0 ? rgbStr(sunCore, 0.55) : rgbStr(warmWhite, 0.38);
      ctx.beginPath();
      ctx.ellipse(fx, fy, r * 1.4, r * 0.75, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // 9. Tactile Gouache Dry-Brush & Cold-Press Watercolour Paper Grain Overlay
    for (let i = 0; i < 420; i++) {
      const bx = rng() * w;
      const by = rng() * h;
      const bw = 14 + rng() * 52;
      const bh = 1 + rng() * 2.4;
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255, 250, 240, 0.045)' : 'rgba(65, 45, 30, 0.035)';
      ctx.fillRect(bx, by, bw, bh);
    }

    // Fine organic paper tooth via pixel overlay
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const grain = (rng() - 0.5) * 11;
        d[idx] = Math.min(255, Math.max(0, d[idx] + grain));
        d[idx + 1] = Math.min(255, Math.max(0, d[idx + 1] + grain));
        d[idx + 2] = Math.min(255, Math.max(0, d[idx + 2] + grain * 0.9));
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  // Matching subtle canvas/paper bumpMap
  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const rng = mulberry32(6203);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = kit.noise(x * 0.14 + 3.1, y * 0.14 + 7.4);
        const v = Math.round((n * 0.6 + rng() * 0.4) * 255);
        const idx = (y * w + x) * 4;
        d[idx] = v;
        d[idx + 1] = v;
        d[idx + 2] = v;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 2);

  setSRGB(THREE, map);
  return { map, bumpMap };
}

// ---------------------------------------------------------------------------
// Sculpted Geometry Builders
// ---------------------------------------------------------------------------

// Custom tapered tube along a CatmullRomCurve3 (used for braided hanging wire & D-rings)
function buildTaperedTube(THREE, curve, tubularSegments, radialSegments, radiusFn) {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions = [];
  const uvs = [];
  const indices = [];

  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const V = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    curve.getPointAt(t, P);
    N.copy(frames.normals[i]);
    B.copy(frames.binormals[i]);
    const r = radiusFn(t);

    for (let j = 0; j <= radialSegments; j++) {
      const v = j / radialSegments;
      const theta = v * Math.PI * 2;
      const sin = Math.sin(theta);
      const cos = -Math.cos(theta);
      V.copy(P)
        .addScaledVector(N, r * cos)
        .addScaledVector(B, r * sin);
      positions.push(V.x, V.y, V.z);
      uvs.push(t, v);
    }
  }

  const row = radialSegments + 1;
  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * row + j;
      const b = (i + 1) * row + j;
      const c = (i + 1) * row + (j + 1);
      const d = i * row + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Sculpted rectangular moulded frame with exact 45-degree mitred corners,
// crisp fillet creases, smooth ogee curves, and longitudinal wood-grain UVs per rail.
function buildMitredMouldingGeometry(THREE, width, height, profilePoints, lengthSegments = 10) {
  // Expand profile into smooth strips split at hard corners for crisp lighting creases
  const expanded = [];
  let cumDist = 0;
  const dists = [0];
  for (let i = 1; i < profilePoints.length; i++) {
    const du = profilePoints[i].u - profilePoints[i - 1].u;
    const dz = profilePoints[i].z - profilePoints[i - 1].z;
    cumDist += Math.hypot(du, dz);
    dists.push(cumDist);
  }
  const totalProfileLen = Math.max(cumDist, 1e-5);

  const strips = [];
  let curStrip = [{ ...profilePoints[0], vCoord: 0 }];
  for (let i = 1; i < profilePoints.length; i++) {
    const pt = { ...profilePoints[i], vCoord: dists[i] / totalProfileLen };
    curStrip.push(pt);
    if (pt.hard && i < profilePoints.length - 1) {
      strips.push(curStrip);
      curStrip = [{ ...pt }];
    }
  }
  strips.push(curStrip);

  const positions = [];
  const uvs = [];
  const indices = [];
  let vertexOffset = 0;

  // Four clockwise rails: top, right, bottom, left
  const hw = width * 0.5;
  const hh = height * 0.5;
  const railDefs = [
    // [startX(u), startY(u), endX(u), endY(u), nominalLen]
    { p0: (u) => [-hw + u, hh - u], p1: (u) => [hw - u, hh - u], len: width, uShift: 0.0 },
    { p0: (u) => [hw - u, hh - u], p1: (u) => [hw - u, -hh + u], len: height, uShift: 0.27 },
    { p0: (u) => [hw - u, -hh + u], p1: (u) => [-hw + u, -hh + u], len: width, uShift: 0.54 },
    { p0: (u) => [-hw + u, -hh + u], p1: (u) => [-hw + u, hh - u], len: height, uShift: 0.81 }
  ];

  for (const rail of railDefs) {
    for (const strip of strips) {
      const m = strip.length;
      for (let i = 0; i <= lengthSegments; i++) {
        const s = i / lengthSegments;
        for (let j = 0; j < m; j++) {
          const { u, z, vCoord } = strip[j];
          const [x0, y0] = rail.p0(u);
          const [x1, y1] = rail.p1(u);
          const x = x0 + (x1 - x0) * s;
          const y = y0 + (y1 - y0) * s;
          positions.push(x, y, z);
          // Wood grain runs along rail length (U) and wraps smoothly across profile (V)
          uvs.push(s * rail.len * 2.2 + rail.uShift, vCoord * 1.4);
        }
      }

      for (let i = 0; i < lengthSegments; i++) {
        for (let j = 0; j < m - 1; j++) {
          const v00 = vertexOffset + i * m + j;
          const v10 = vertexOffset + (i + 1) * m + j;
          const v01 = vertexOffset + i * m + (j + 1);
          const v11 = vertexOffset + (i + 1) * m + (j + 1);
          indices.push(v00, v01, v10, v10, v01, v11);
        }
      }
      vertexOffset += (lengthSegments + 1) * m;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Sculpted gallery moulding cross-section profile (u inward from outer edge, z forward from wall)
function createFrameMouldingProfile(borderW, depth, backZ) {
  const b = borderW;
  const d = depth;
  const z0 = backZ;
  const lipZ = z0 + (d - z0) * 0.42;
  const rabbetZ = z0 + (d - z0) * 0.14;

  // Profile winds: outer-back -> outer-side -> sculpted ogee top -> inner bead -> inner lip -> rabbet -> back
  return [
    { u: 0.0, z: z0, hard: true },
    { u: 0.0, z: z0 + (d - z0) * 0.72, hard: false },
    { u: b * 0.04, z: z0 + (d - z0) * 0.84, hard: false },
    { u: b * 0.11, z: z0 + (d - z0) * 0.94, hard: false },
    { u: b * 0.20, z: d, hard: false },
    { u: b * 0.30, z: d * 0.995, hard: false },
    { u: b * 0.38, z: z0 + (d - z0) * 0.91, hard: false },
    // Gentle cove sweep
    { u: b * 0.47, z: z0 + (d - z0) * 0.76, hard: false },
    { u: b * 0.57, z: z0 + (d - z0) * 0.66, hard: false },
    { u: b * 0.68, z: z0 + (d - z0) * 0.63, hard: false },
    { u: b * 0.77, z: z0 + (d - z0) * 0.66, hard: false },
    // Raised inner gallery bead
    { u: b * 0.84, z: z0 + (d - z0) * 0.73, hard: false },
    { u: b * 0.91, z: z0 + (d - z0) * 0.72, hard: false },
    { u: b * 0.97, z: z0 + (d - z0) * 0.64, hard: false },
    { u: b, z: z0 + (d - z0) * 0.56, hard: true },
    // Inner lip down to glass plane
    { u: b, z: lipZ, hard: true },
    // Recessed inner rabbet holding glass, mat, art, and backing
    { u: b * 0.74, z: lipZ, hard: true },
    { u: b * 0.74, z: rabbetZ, hard: true },
    { u: b * 0.80, z: z0, hard: true },
    { u: 0.0, z: z0, hard: true }
  ];
}

// Thin sculpted brass inner fillet liner tucked inside the wood lip
function createBrassFilletProfile(borderW, filletW, zLow, zHigh) {
  const u0 = borderW - 0.0004;
  const u1 = borderW + filletW;
  const zMid = zLow + (zHigh - zLow) * 0.75;
  return [
    { u: u0, z: zLow, hard: true },
    { u: u0, z: zMid, hard: false },
    { u: u0 + filletW * 0.35, z: zHigh, hard: false },
    { u: u0 + filletW * 0.72, z: zHigh * 0.99, hard: false },
    { u: u1, z: zMid, hard: true },
    { u: u1, z: zLow, hard: true },
    { u: u0, z: zLow, hard: true }
  ];
}

// Rectangular museum bevel-cut mat (returns { frontGeo, bevelGeo })
function buildRectangularBevelMat(THREE, matW, matH, winW, winH, winOffY, bevelW, zBack, zFront) {
  const mw = matW * 0.5;
  const mh = matH * 0.5;
  const ww = winW * 0.5;
  const wh = winH * 0.5;

  const O = [
    [-mw, mh],
    [mw, mh],
    [mw, -mh],
    [-mw, -mh]
  ];
  const B = [
    [-ww - bevelW, winOffY + wh + bevelW],
    [ww + bevelW, winOffY + wh + bevelW],
    [ww + bevelW, winOffY - wh - bevelW],
    [-ww - bevelW, winOffY - wh - bevelW]
  ];
  const W = [
    [-ww, winOffY + wh],
    [ww, winOffY + wh],
    [ww, winOffY - wh],
    [-ww, winOffY - wh]
  ];

  // Front face of the mat
  const fPos = [];
  const fUvs = [];
  const fIdx = [];
  for (let k = 0; k < 4; k++) {
    const kn = (k + 1) % 4;
    const base = k * 4;
    const pts = [O[k], B[k], O[kn], B[kn]];
    for (const [x, y] of pts) {
      fPos.push(x, y, zFront);
      fUvs.push(x / matW + 0.5, y / matH + 0.5);
    }
    fIdx.push(base + 0, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
  const frontGeo = new THREE.BufferGeometry();
  frontGeo.setAttribute('position', new THREE.Float32BufferAttribute(fPos, 3));
  frontGeo.setAttribute('uv', new THREE.Float32BufferAttribute(fUvs, 2));
  frontGeo.setIndex(fIdx);
  frontGeo.computeVertexNormals();

  // Crisp 45-degree white paper core bevel around window
  const bPos = [];
  const bUvs = [];
  const bIdx = [];
  for (let k = 0; k < 4; k++) {
    const kn = (k + 1) % 4;
    const base = k * 4;
    bPos.push(B[k][0], B[k][1], zFront);
    bPos.push(W[k][0], W[k][1], zBack);
    bPos.push(B[kn][0], B[kn][1], zFront);
    bPos.push(W[kn][0], W[kn][1], zBack);
    bUvs.push(0, 1, 0, 0, 1, 1, 1, 0);
    bIdx.push(base + 0, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
  const bevelGeo = new THREE.BufferGeometry();
  bevelGeo.setAttribute('position', new THREE.Float32BufferAttribute(bPos, 3));
  bevelGeo.setAttribute('uv', new THREE.Float32BufferAttribute(bUvs, 2));
  bevelGeo.setIndex(bIdx);
  bevelGeo.computeVertexNormals();

  return { frontGeo, bevelGeo };
}

// Sculpted extrude turn-button clip for the back of the frame
function buildTurnButtonGeometry(THREE, scale = 1) {
  const s = new THREE.Shape();
  const l = 0.011 * scale;
  const w = 0.0038 * scale;
  s.moveTo(-w * 0.85, -w);
  s.bezierCurveTo(-w * 1.15, 0, -w * 0.85, w, 0, w * 0.9);
  s.lineTo(l * 0.72, w * 0.72);
  s.bezierCurveTo(l, w * 0.55, l, -w * 0.55, l * 0.72, -w * 0.72);
  s.lineTo(0, -w * 0.9);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.0014 * scale,
    bevelEnabled: true,
    bevelThickness: 0.0004 * scale,
    bevelSize: 0.0004 * scale,
    bevelSegments: 2,
    curveSegments: 10
  });
  geo.computeVertexNormals();
  return geo;
}

// Back hanging hardware (braided tapered wire, curved D-rings, turn-buttons, felt wall pads)
function buildBackHardware(THREE, opts, mats, cfg) {
  const hw = new THREE.Group();
  hw.name = 'backHardware';
  const { isRound, width, height, radius, backZ, backingZ, scale = 1 } = cfg;

  // 1. Braided hanging wire tucked cleanly in the back recess (z >= 0.0009)
  const wireZ = Math.max(0.0011, backingZ - 0.0014);
  const halfSpan = isRound ? radius * 0.54 : width * 0.34;
  const anchorY = isRound ? radius * 0.28 : height * 0.22;
  const peakY = isRound ? radius * 0.52 : height * 0.34;

  const wireCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-halfSpan, anchorY, wireZ + 0.0005),
    new THREE.Vector3(-halfSpan * 0.52, anchorY + (peakY - anchorY) * 0.62, wireZ),
    new THREE.Vector3(0, peakY, wireZ - 0.0002),
    new THREE.Vector3(halfSpan * 0.52, anchorY + (peakY - anchorY) * 0.62, wireZ),
    new THREE.Vector3(halfSpan, anchorY, wireZ + 0.0005)
  ]);

  const wireGeo = buildTaperedTube(THREE, wireCurve, 32, 8, (t) => {
    const endBoost = Math.pow(Math.abs(t - 0.5) * 2, 4) * 0.00045;
    return (0.00065 + endBoost) * scale;
  });
  const wireMesh = new THREE.Mesh(wireGeo, mats.wire);
  wireMesh.name = 'hangingWire';
  hw.add(wireMesh);

  // Two small D-ring anchor loops where the wire attaches
  const ringR = 0.0055 * scale;
  const dCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -ringR, 0),
    new THREE.Vector3(ringR * 0.9, -ringR * 0.5, 0),
    new THREE.Vector3(ringR * 0.9, ringR * 0.5, 0),
    new THREE.Vector3(0, ringR, 0),
    new THREE.Vector3(-ringR * 0.35, 0, 0),
    new THREE.Vector3(0, -ringR, 0)
  ]);
  const dRingGeo = buildTaperedTube(THREE, dCurve, 20, 7, () => 0.0007 * scale);
  for (const dir of [-1, 1]) {
    const dRing = new THREE.Mesh(dRingGeo, mats.brass);
    dRing.position.set(dir * halfSpan, anchorY, wireZ + 0.0007);
    if (dir > 0) dRing.rotation.y = Math.PI;
    dRing.userData.slot = 'accent';
    hw.add(dRing);
  }

  // 2. Bevelled metal turn-button clips securing the backing board
  const clipGeo = buildTurnButtonGeometry(THREE, scale);
  const clipPositions = isRound
    ? [0, 1, 2, 3, 4, 5].map((i) => {
        const ang = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const r = radius * 0.78;
        return [Math.cos(ang) * r, Math.sin(ang) * r, ang + Math.PI];
      })
    : [
        [-width * 0.24, height * 0.42, -Math.PI * 0.5],
        [width * 0.24, height * 0.42, -Math.PI * 0.5],
        [-width * 0.24, -height * 0.42, Math.PI * 0.5],
        [width * 0.24, -height * 0.42, Math.PI * 0.5],
        [-width * 0.41, 0, 0],
        [width * 0.41, 0, Math.PI]
      ];

  for (const [cx, cy, rot] of clipPositions) {
    const clip = new THREE.Mesh(clipGeo, mats.hardware);
    clip.position.set(cx, cy, backingZ - 0.0018 * scale);
    clip.rotation.z = rot;
    hw.add(clip);
  }

  // 3. Soft felt wall-bumper pads flush with z = 0 so the frame sits gently on the wall
  const padGeo = new THREE.CylinderGeometry(0.0065 * scale, 0.007 * scale, backZ, 16);
  padGeo.rotateX(Math.PI / 2);
  const padCoords = isRound
    ? [
        [0, radius * 0.89],
        [-radius * 0.76, -radius * 0.46],
        [radius * 0.76, -radius * 0.46]
      ]
    : [
        [-width * 0.44, height * 0.45],
        [width * 0.44, height * 0.45],
        [-width * 0.44, -height * 0.45],
        [width * 0.44, -height * 0.45]
      ];
  for (const [px, py] of padCoords) {
    const pad = new THREE.Mesh(padGeo, mats.felt);
    pad.position.set(px, py, backZ * 0.5);
    hw.add(pad);
  }

  return hw;
}

// ---------------------------------------------------------------------------
// Single Rectangular Framed Picture Assembly (used by Variant 0 & Variant 1)
// ---------------------------------------------------------------------------

function buildRectangularFrameUnit(THREE, kit, opts, mats, cfg) {
  const unit = new THREE.Group();
  unit.name = cfg.name || 'frameUnit';

  const {
    width,
    height,
    borderW,
    depth,
    filletW,
    matSide,
    matTop,
    matBottom,
    artWpx,
    artHpx,
    artRegion,
    hardwareScale = 1
  } = cfg;

  const backZ = 0.001 * hardwareScale;
  const backingZ = backZ + depth * 0.14;
  const artZ = backZ + depth * 0.24;
  const matBackZ = artZ + 0.0005;
  const matFrontZ = matBackZ + 0.0028 * Math.max(0.75, hardwareScale);
  const glassZ = matFrontZ + 0.0032 * Math.max(0.75, hardwareScale);
  const filletLowZ = glassZ - 0.0006;
  const filletHighZ = glassZ + 0.0046 * Math.max(0.75, hardwareScale);

  // 1. Moulded wooden frame
  const woodProfile = createFrameMouldingProfile(borderW, depth, backZ);
  const frameGeo = buildMitredMouldingGeometry(THREE, width, height, woodProfile, 10);
  const frameMesh = new THREE.Mesh(frameGeo, mats.wood);
  frameMesh.name = 'mouldedFrame';
  frameMesh.userData.slot = 'wood';
  frameMesh.castShadow = true;
  frameMesh.receiveShadow = true;
  unit.add(frameMesh);

  // Artisanal inlaid brass corner mitre splines (4 subtle woodwork details on the outer corners)
  const splineLen = borderW * 0.46;
  const splineGeo = new THREE.BoxGeometry(splineLen, 0.0018 * hardwareScale, depth * 0.42);
  const cornerSigns = [
    [-1, 1, -Math.PI / 4],
    [1, 1, Math.PI / 4],
    [1, -1, -Math.PI / 4],
    [-1, -1, Math.PI / 4]
  ];
  for (const [sx, sy, rot] of cornerSigns) {
    const spline = new THREE.Mesh(splineGeo, mats.brass);
    spline.position.set(
      sx * (width * 0.5 - borderW * 0.13),
      sy * (height * 0.5 - borderW * 0.13),
      backZ + depth * 0.36
    );
    spline.rotation.z = rot;
    spline.userData.slot = 'accent';
    unit.add(spline);
  }

  // 2. Brushed-brass inner fillet rim
  const filletProfile = createBrassFilletProfile(borderW, filletW, filletLowZ, filletHighZ);
  const filletGeo = buildMitredMouldingGeometry(THREE, width, height, filletProfile, 6);
  const filletMesh = new THREE.Mesh(filletGeo, mats.brass);
  filletMesh.name = 'brassFillet';
  filletMesh.userData.slot = 'accent';
  unit.add(filletMesh);

  // 3. Bevel-cut museum mat
  const matOuterW = width - borderW * 1.65;
  const matOuterH = height - borderW * 1.65;
  const visibleW = width - (borderW + filletW) * 2;
  const visibleH = height - (borderW + filletW) * 2;
  const winW = visibleW - matSide * 2;
  const winH = visibleH - matTop - matBottom;
  const winOffY = (matBottom - matTop) * 0.5;
  const bevelW = 0.0026 * Math.max(0.75, hardwareScale);

  const { frontGeo, bevelGeo } = buildRectangularBevelMat(
    THREE,
    matOuterW,
    matOuterH,
    winW,
    winH,
    winOffY,
    bevelW,
    matBackZ,
    matFrontZ
  );
  const matFrontMesh = new THREE.Mesh(frontGeo, mats.matFront);
  matFrontMesh.name = 'matBoard';
  matFrontMesh.receiveShadow = true;
  unit.add(matFrontMesh);

  const matBevelMesh = new THREE.Mesh(bevelGeo, mats.matBevel);
  matBevelMesh.name = 'matBevel';
  unit.add(matBevelMesh);

  // 4. Painted abstract landscape artwork
  const artTex = makeLandscapeTextures(THREE, kit, opts, artWpx, artHpx, artRegion);
  const artMat = new THREE.MeshPhysicalMaterial({
    map: artTex.map,
    bumpMap: artTex.bumpMap,
    bumpScale: 0.0005,
    roughness: 0.88,
    metalness: 0.0,
    sheen: 0.25,
    sheenRoughness: 0.85,
    sheenColor: new THREE.Color('#fff6e8')
  });
  const artGeo = new THREE.PlaneGeometry(winW + 0.012, winH + 0.012, 4, 4);
  const artMesh = new THREE.Mesh(artGeo, artMat);
  artMesh.name = 'artwork';
  artMesh.position.set(0, winOffY, artZ);
  artMesh.receiveShadow = true;
  unit.add(artMesh);

  // 5. Glass pane with faint reflection sheen
  const glassGeo = new THREE.PlaneGeometry(visibleW + 0.006, visibleH + 0.006, 2, 2);
  const glassMesh = new THREE.Mesh(glassGeo, mats.glass.clone());
  glassMesh.name = 'glass';
  glassMesh.position.set(0, 0, glassZ);
  glassMesh.renderOrder = 2;
  unit.add(glassMesh);

  // 6. Recessed backing board
  const backW = width - borderW * 1.56;
  const backH = height - borderW * 1.56;
  const backingThick = 0.0024 * hardwareScale;
  const backingGeo = new THREE.BoxGeometry(backW, backH, backingThick);
  const backingMesh = new THREE.Mesh(backingGeo, mats.backing);
  backingMesh.name = 'backingBoard';
  backingMesh.position.set(0, 0, backingZ + backingThick * 0.5);
  unit.add(backingMesh);

  // 7. Back hanging hardware & wall bumpers
  const hw = buildBackHardware(THREE, opts, mats, {
    isRound: false,
    width,
    height,
    backZ,
    backingZ,
    scale: hardwareScale
  });
  unit.add(hw);

  unit.userData._glassMesh = glassMesh;
  return unit;
}

// ---------------------------------------------------------------------------
// Variant 2: Lathe-Turned Round Frame Assembly
// ---------------------------------------------------------------------------

function buildRoundFrameUnit(THREE, kit, opts, mats) {
  const unit = new THREE.Group();
  unit.name = 'roundFrame';

  const outerR = 0.23; // 0.46 m diameter
  const borderW = 0.038;
  const filletW = 0.0042;
  const innerWoodR = outerR - borderW;
  const visibleR = innerWoodR - filletW;
  const matWidth = 0.044;
  const winR = visibleR - matWidth;

  const depth = 0.032;
  const backZ = 0.001;
  const backingZ = backZ + 0.0044;
  const artZ = backZ + 0.0074;
  const matBackZ = artZ + 0.0005;
  const matFrontZ = matBackZ + 0.0028;
  const glassZ = matFrontZ + 0.0034;

  // Helper to convert (u, z) moulding profile to THREE.Vector2(r, z) for LatheGeometry
  const radialSegs = 96;
  const woodProfile = createFrameMouldingProfile(borderW, depth, backZ);
  // LatheGeometry expects points going bottom-inner -> outer -> top -> inner-down for outward normals
  const lathePts = [];
  for (let i = 0; i < woodProfile.length; i++) {
    const { u, z } = woodProfile[i];
    lathePts.push(new THREE.Vector2(outerR - u, z));
  }
  const roundFrameGeo = new THREE.LatheGeometry(lathePts, radialSegs);
  roundFrameGeo.rotateX(Math.PI / 2); // Orient axis along +z

  // Project continuous solid-wood plank UVs across XY face so grain runs naturally like carved walnut
  const posAttr = roundFrameGeo.attributes.position;
  const uvAttr = roundFrameGeo.attributes.uv;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    uvAttr.setXY(i, (x + outerR) / (outerR * 2) * 1.3 + z * 2.5, (y + outerR) / (outerR * 2) * 1.3);
  }
  uvAttr.needsUpdate = true;
  roundFrameGeo.computeVertexNormals();

  const frameMesh = new THREE.Mesh(roundFrameGeo, mats.wood);
  frameMesh.name = 'mouldedFrame';
  frameMesh.userData.slot = 'wood';
  frameMesh.castShadow = true;
  frameMesh.receiveShadow = true;
  unit.add(frameMesh);

  // Brass inner fillet ring via LatheGeometry
  const filletProfile = createBrassFilletProfile(borderW, filletW, glassZ - 0.0006, glassZ + 0.0048);
  const filletPts = filletProfile.map(({ u, z }) => new THREE.Vector2(outerR - u, z));
  const filletGeo = new THREE.LatheGeometry(filletPts, radialSegs);
  filletGeo.rotateX(Math.PI / 2);
  filletGeo.computeVertexNormals();
  const filletMesh = new THREE.Mesh(filletGeo, mats.brass);
  filletMesh.name = 'brassFillet';
  filletMesh.userData.slot = 'accent';
  unit.add(filletMesh);

  // Circular bevel-cut mat (flat cotton-rag front ring + bright 45-degree conical inner bevel)
  const bevelW = 0.0026;
  const matOuterR = innerWoodR + 0.005;
  const matFrontGeo = new THREE.RingGeometry(winR + bevelW, matOuterR, radialSegs, 1);
  // Planar UVs for seamless cotton paper texture
  const mPos = matFrontGeo.attributes.position;
  const mUv = matFrontGeo.attributes.uv;
  for (let i = 0; i < mPos.count; i++) {
    mUv.setXY(i, mPos.getX(i) / (matOuterR * 2) + 0.5, mPos.getY(i) / (matOuterR * 2) + 0.5);
  }
  mUv.needsUpdate = true;
  const matFrontMesh = new THREE.Mesh(matFrontGeo, mats.matFront);
  matFrontMesh.name = 'matBoard';
  matFrontMesh.position.z = matFrontZ;
  matFrontMesh.receiveShadow = true;
  unit.add(matFrontMesh);

  const bevelPts = [
    new THREE.Vector2(winR + bevelW, matFrontZ),
    new THREE.Vector2(winR, matBackZ)
  ];
  const matBevelGeo = new THREE.LatheGeometry(bevelPts, radialSegs);
  matBevelGeo.rotateX(Math.PI / 2);
  matBevelGeo.computeVertexNormals();
  const matBevelMesh = new THREE.Mesh(matBevelGeo, mats.matBevel);
  matBevelMesh.name = 'matBevel';
  unit.add(matBevelMesh);

  // Circular painted abstract landscape artwork
  const artTex = makeLandscapeTextures(THREE, kit, opts, 512, 512, {
    u0: 0.08,
    u1: 0.92,
    v0: 0.04,
    v1: 0.96,
    seedOffset: 71
  });
  const artMat = new THREE.MeshPhysicalMaterial({
    map: artTex.map,
    bumpMap: artTex.bumpMap,
    bumpScale: 0.0005,
    roughness: 0.88,
    metalness: 0.0,
    sheen: 0.25,
    sheenRoughness: 0.85,
    sheenColor: new THREE.Color('#fff6e8')
  });
  const artGeo = new THREE.CircleGeometry(winR + 0.008, radialSegs);
  const artMesh = new THREE.Mesh(artGeo, artMat);
  artMesh.name = 'artwork';
  artMesh.position.z = artZ;
  artMesh.receiveShadow = true;
  unit.add(artMesh);

  // Circular glass pane with faint reflection
  const glassGeo = new THREE.CircleGeometry(visibleR + 0.004, radialSegs);
  const glassMesh = new THREE.Mesh(glassGeo, mats.glass.clone());
  glassMesh.name = 'glass';
  glassMesh.position.z = glassZ;
  glassMesh.renderOrder = 2;
  unit.add(glassMesh);

  // Circular backing board
  const backingThick = 0.0024;
  const backingGeo = new THREE.CylinderGeometry(outerR - borderW * 0.78, outerR - borderW * 0.78, backingThick, radialSegs);
  backingGeo.rotateX(Math.PI / 2);
  const backingMesh = new THREE.Mesh(backingGeo, mats.backing);
  backingMesh.name = 'backingBoard';
  backingMesh.position.z = backingZ + backingThick * 0.5;
  unit.add(backingMesh);

  // Back hanging hardware & felt bumpers
  const hw = buildBackHardware(THREE, opts, mats, {
    isRound: true,
    radius: outerR,
    backZ,
    backingZ,
    scale: 1
  });
  unit.add(hw);

  unit.userData._glassMesh = glassMesh;
  return unit;
}

// ---------------------------------------------------------------------------
// Shared Material Palette Factory
// ---------------------------------------------------------------------------

function createSharedMaterials(THREE, kit, opts) {
  const woodHex = opts?.wood ?? '#8a5a3b';
  const accentCol = makeColor(THREE, opts?.accent, '#e8b95b');
  const brassCol = mixColor(THREE, accentCol, new THREE.Color('#c8a258'), 0.45);

  const woodTex = makeWoodTextures(THREE, kit, woodHex);
  const matTex = makeMatTextures(THREE, kit);
  const glassTex = makeGlassTexture(THREE, kit);
  const backingTex = makeBackingTexture(THREE, kit);

  const wood = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffffff'),
    map: woodTex.map,
    bumpMap: woodTex.bumpMap,
    bumpScale: 0.0014,
    roughness: 0.46,
    metalness: 0.0,
    clearcoat: 0.24,
    clearcoatRoughness: 0.36
  });

  const brass = new THREE.MeshPhysicalMaterial({
    color: brassCol,
    roughness: 0.28,
    metalness: 0.86,
    clearcoat: 0.3,
    clearcoatRoughness: 0.2
  });

  const matFront = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffffff'),
    map: matTex.map,
    bumpMap: matTex.bumpMap,
    bumpScale: 0.0005,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.65,
    sheenRoughness: 0.85,
    sheenColor: new THREE.Color('#fffaf0')
  });

  const matBevel = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#fbf8f1'),
    roughness: 0.9,
    metalness: 0.0,
    sheen: 0.5,
    sheenColor: new THREE.Color('#ffffff')
  });

  const glass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffffff'),
    map: glassTex,
    transparent: true,
    opacity: 0.52,
    roughness: 0.04,
    metalness: 0.05,
    ior: 1.5,
    reflectivity: 0.95,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    depthWrite: false
  });

  const backing = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffffff'),
    map: backingTex,
    roughness: 0.94,
    metalness: 0.0
  });

  const hardware = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#3b332c'),
    roughness: 0.42,
    metalness: 0.78
  });

  const wire = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#a8a298'),
    roughness: 0.36,
    metalness: 0.85
  });

  const felt = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#2c2824'),
    roughness: 0.98,
    metalness: 0.0,
    sheen: 0.8,
    sheenColor: new THREE.Color('#5a534c')
  });

  return { wood, brass, matFront, matBevel, glass, backing, hardware, wire, felt };
}

// ---------------------------------------------------------------------------
// Public Module Exports: build() & idle()
// ---------------------------------------------------------------------------

export function build(THREE, opts = {}, kit) {
  const safeOpts = {
    primary: opts?.primary ?? '#d97b54',
    secondary: opts?.secondary ?? '#5b7d7c',
    accent: opts?.accent ?? '#e8b95b',
    wood: opts?.wood ?? '#8a5a3b',
    variant: opts?.variant ?? 0
  };

  const root = new THREE.Group();
  root.name = 'framedPicture';
  const mats = createSharedMaterials(THREE, kit, safeOpts);

  const animUnits = [];
  const variant = Number(safeOpts.variant) || 0;

  if (variant === 1) {
    // Variant 1: Curated Triptych Set of Three Small Frames (0.45 m total width)
    const panelW = 0.142;
    const panelH = 0.27;
    const gap = 0.012;
    const stepX = panelW + gap;
    const regions = [
      { u0: 0.02, u1: 0.32, v0: 0.05, v1: 0.97, seedOffset: 11 },
      { u0: 0.35, u1: 0.65, v0: 0.05, v1: 0.97, seedOffset: 23 },
      { u0: 0.68, u1: 0.98, v0: 0.05, v1: 0.97, seedOffset: 37 }
    ];

    for (let i = 0; i < 3; i++) {
      const panel = buildRectangularFrameUnit(THREE, kit, safeOpts, mats, {
        name: `triptychFrame_${i}`,
        width: panelW,
        height: panelH,
        borderW: 0.017,
        depth: 0.022,
        filletW: 0.0024,
        matSide: 0.015,
        matTop: 0.016,
        matBottom: 0.019,
        artWpx: 320,
        artHpx: 560,
        artRegion: regions[i],
        hardwareScale: 0.65
      });
      panel.position.set((i - 1) * stepX, 0, 0);
      root.add(panel);
      animUnits.push({ group: panel, glass: panel.userData._glassMesh, phase: i * 1.15 });
    }
  } else if (variant === 2) {
    // Variant 2: Lathe-Turned Round Frame (0.46 m diameter)
    const roundUnit = buildRoundFrameUnit(THREE, kit, safeOpts, mats);
    root.add(roundUnit);
    animUnits.push({ group: roundUnit, glass: roundUnit.userData._glassMesh, phase: 0 });
  } else {
    // Variant 0: Hero Single Moulded Frame (0.45 m wide x 0.60 m high)
    const singleUnit = buildRectangularFrameUnit(THREE, kit, safeOpts, mats, {
      name: 'singleFrame',
      width: 0.45,
      height: 0.60,
      borderW: 0.038,
      depth: 0.032,
      filletW: 0.0042,
      matSide: 0.048,
      matTop: 0.048,
      matBottom: 0.058,
      artWpx: 480,
      artHpx: 680,
      artRegion: { u0: 0.14, u1: 0.86, v0: 0.02, v1: 0.98, seedOffset: 0 },
      hardwareScale: 1.0
    });
    root.add(singleUnit);
    animUnits.push({ group: singleUnit, glass: singleUnit.userData._glassMesh, phase: 0 });
  }

  root.userData._animUnits = animUnits;
  return root;
}

export function idle(group, t) {
  if (!group || !group.userData || !group.userData._animUnits) return;
  const units = group.userData._animUnits;
  for (let i = 0; i < units.length; i++) {
    const item = units[i];
    // Barely perceptible settling micro-sway as if suspended from a braided wire
    if (item.group) {
      item.group.rotation.z = Math.sin(t * 0.55 + item.phase) * 0.0016;
    }
    // Gentle daylight sheen shimmer across the glass pane
    if (item.glass && item.glass.material) {
      item.glass.material.opacity = 0.50 + Math.sin(t * 0.75 + item.phase) * 0.045;
    }
  }
}
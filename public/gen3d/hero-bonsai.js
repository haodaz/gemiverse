export const META = {
  id: "bonsai-tree",
  name: "Bonsai Tree",
  kind: "plant",
  footprint: [0.34, 0.24],
  variants: [
    { name: "Celadon", wood: "#8a5a3c", leaf: "#7fb48a", ceramic: "#8fc1e8" },
    { name: "Sakura", wood: "#734b38", leaf: "#e8a4b8", ceramic: "#e6dcd0" },
    { name: "Autumn Maple", wood: "#6e4630", leaf: "#d46a43", ceramic: "#527182" },
    { name: "Deep Pine", wood: "#7c5438", leaf: "#567d62", ceramic: "#c89f7b" },
  ],
  note: "A cozy tabletop moyogi bonsai with a twisted trunk, three sculpted cloud foliage pads, velvety moss, and a viewing stone in a shallow glazed ceramic tray.",
};

// ---------------------------------------------------------------------------
// Colour helpers (pure THREE.Color, no DOM/globals)
// ---------------------------------------------------------------------------

function makeColor(THREE, hex) {
  return new THREE.Color(hex);
}

function shiftHSL(THREE, hexOrColor, dh, ds, dl) {
  const c = hexOrColor instanceof THREE.Color ? hexOrColor.clone() : new THREE.Color(hexOrColor);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  hsl.h = (hsl.h + dh + 1) % 1;
  hsl.s = Math.max(0, Math.min(1, hsl.s + ds));
  hsl.l = Math.max(0, Math.min(1, hsl.l + dl));
  c.setHSL(hsl.h, hsl.s, hsl.l);
  return c;
}

function toRGBA(color, alpha = 1) {
  const r = Math.round(Math.max(0, Math.min(1, color.r)) * 255);
  const g = Math.round(Math.max(0, Math.min(1, color.g)) * 255);
  const b = Math.round(Math.max(0, Math.min(1, color.b)) * 255);
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

// Deterministic hash for organic variation without Math.random drift
function hash1(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function fbm(kit, x, y, octaves = 4) {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    value += amp * kit.noise(x * freq, y * freq);
    norm += amp;
    freq *= 2.03;
    amp *= 0.5;
  }
  return value / norm;
}

// ---------------------------------------------------------------------------
// Procedural CanvasTextures via kit.canvasTexture
// ---------------------------------------------------------------------------

function createCeramicTextures(THREE, kit, ceramicHex) {
  const base = makeColor(THREE, ceramicHex);
  const rimLight = shiftHSL(THREE, base, -0.01, -0.1, 0.16);
  const bellyMid = shiftHSL(THREE, base, 0.0, 0.02, 0.0);
  const grooveDeep = shiftHSL(THREE, base, 0.015, 0.08, -0.14);
  const clayFoot = new THREE.Color("#c8b69e");

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    // Vertical kiln glaze gradient (v=0 is bottom underside, v=1 is inner center)
    // In Three.js CanvasTexture (flipY=true), canvas y=h is v=0 and y=0 is v=1.
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0.0, toRGBA(clayFoot));
    grad.addColorStop(0.14, toRGBA(clayFoot));
    grad.addColorStop(0.22, toRGBA(grooveDeep));
    grad.addColorStop(0.42, toRGBA(bellyMid));
    grad.addColorStop(0.56, toRGBA(grooveDeep));
    grad.addColorStop(0.68, toRGBA(rimLight));
    grad.addColorStop(0.76, toRGBA(bellyMid));
    grad.addColorStop(1.0, toRGBA(grooveDeep));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Soft organic glaze pooling clouds
    for (let i = 0; i < 90; i++) {
      const cx = hash1(i * 3.1) * w;
      const cy = (0.15 + hash1(i * 7.3) * 0.72) * h;
      const rx = 20 + hash1(i * 11.7) * 55;
      const ry = 10 + hash1(i * 5.9) * 28;
      const col = i % 2 === 0 ? rimLight : grooveDeep;
      const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, rx);
      g.addColorStop(0, toRGBA(col, 0.14));
      g.addColorStop(1, toRGBA(col, 0));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Subtle celadon craquelure glaze lines
    ctx.strokeStyle = toRGBA(shiftHSL(THREE, base, 0, -0.05, -0.25), 0.16);
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 42; i++) {
      let x = hash1(i * 19.3) * w;
      let y = (0.12 + hash1(i * 23.1) * 0.72) * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const steps = 6 + Math.floor(hash1(i * 13.7) * 8);
      for (let s = 0; s < steps; s++) {
        const ang = (kit.noise(x * 0.02 + i, y * 0.02) - 0.5) * Math.PI * 2;
        x += Math.cos(ang) * 18;
        y += Math.sin(ang) * 14;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Fine iron kiln speckles
    for (let i = 0; i < 420; i++) {
      const sx = hash1(i * 41.3) * w;
      const sy = hash1(i * 53.9) * h;
      const r = 0.6 + hash1(i * 17.1) * 1.4;
      ctx.fillStyle = i % 5 === 0
        ? toRGBA(rimLight, 0.25)
        : "rgba(58, 44, 34, 0.14)";
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "rgb(128,128,128)";
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const n = fbm(kit, x * 0.04, y * 0.04, 3);
        const v = Math.round(118 + n * 22);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
  });
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.ClampToEdgeWrapping;

  return { map, bump };
}

function createBarkTextures(THREE, kit, woodHex) {
  const base = makeColor(THREE, woodHex);
  const darkFurrow = shiftHSL(THREE, base, -0.015, 0.06, -0.22);
  const ridgeLight = shiftHSL(THREE, base, 0.02, -0.06, 0.14);
  const lichen = new THREE.Color("#9db093");

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = toRGBA(base);
    ctx.fillRect(0, 0, w, h);

    // Fibrous longitudinal bark strips
    for (let i = 0; i < 320; i++) {
      const x = hash1(i * 13.7) * w;
      const y = hash1(i * 29.3) * h;
      const len = 60 + hash1(i * 17.9) * 160;
      const bw = 2 + hash1(i * 7.1) * 7;
      const isDark = i % 3 !== 0;
      const col = isDark ? darkFurrow : ridgeLight;
      ctx.strokeStyle = toRGBA(col, isDark ? 0.42 : 0.28);
      ctx.lineWidth = bw;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      const midX = x + (kit.noise(x * 0.03, y * 0.015) - 0.5) * 18;
      const endX = x + (kit.noise(x * 0.03 + 4, (y + len) * 0.015) - 0.5) * 20;
      ctx.quadraticCurveTo(midX, y + len * 0.5, endX, y + len);
      ctx.stroke();
    }

    // Fine horizontal bark lenticels & papery cracks
    ctx.strokeStyle = toRGBA(darkFurrow, 0.3);
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 160; i++) {
      const x = hash1(i * 61.1) * w;
      const y = hash1(i * 47.3) * h;
      const lw = 6 + hash1(i * 19.7) * 16;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + lw, y + (hash1(i * 3.3) - 0.5) * 3);
      ctx.stroke();
    }

    // Subtle soft lichen patches near bark crevices
    for (let i = 0; i < 24; i++) {
      const cx = hash1(i * 83.1) * w;
      const cy = hash1(i * 97.7) * h;
      const r = 6 + hash1(i * 31.3) * 14;
      const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
      g.addColorStop(0, toRGBA(lichen, 0.24));
      g.addColorStop(1, toRGBA(lichen, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bump = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = "rgb(130,130,130)";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 340; i++) {
      const x = hash1(i * 13.7) * w;
      const y = hash1(i * 29.3) * h;
      const len = 55 + hash1(i * 17.9) * 150;
      const bw = 2 + hash1(i * 7.1) * 6;
      const v = i % 3 !== 0 ? 55 : 210;
      ctx.strokeStyle = `rgba(${v},${v},${v},0.45)`;
      ctx.lineWidth = bw;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      const midX = x + (kit.noise(x * 0.03, y * 0.015) - 0.5) * 16;
      ctx.quadraticCurveTo(midX, y + len * 0.5, x, y + len);
      ctx.stroke();
    }
  });
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;

  return { map, bump };
}

function createFoliageTextures(THREE, kit, leafHex) {
  const base = makeColor(THREE, leafHex);
  const deep = shiftHSL(THREE, base, 0.035, 0.08, -0.22);
  const shadow = shiftHSL(THREE, base, 0.02, 0.04, -0.11);
  const bright = shiftHSL(THREE, base, -0.025, 0.06, 0.11);
  const sprout = shiftHSL(THREE, base, -0.045, 0.09, 0.19);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = toRGBA(deep);
    ctx.fillRect(0, 0, w, h);

    // Painterly overlapping bonsai foliage clusters (seamless wrap drawing)
    const palette = [deep, shadow, base, base, bright, sprout];
    const count = 950;
    for (let i = 0; i < count; i++) {
      const cx = hash1(i * 17.3 + 1.1) * w;
      const cy = hash1(i * 31.7 + 2.3) * h;
      const ang = hash1(i * 43.1) * Math.PI * 2;
      const rx = 5 + hash1(i * 11.9) * 8;
      const ry = 2.8 + hash1(i * 23.3) * 4.5;
      const layer = Math.floor((i / count) * palette.length);
      const col = palette[Math.min(palette.length - 1, layer)];

      // Draw wrapped across edges so seams never appear
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const px = cx + ox * w;
          const py = cy + oy * h;
          if (px < -20 || px > w + 20 || py < -20 || py > h + 20) continue;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(ang);
          ctx.fillStyle = toRGBA(col, 0.88);
          ctx.beginPath();
          ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();

          // Tiny subtle central leaf vein highlight on top-layer leaves
          if (layer >= 4) {
            ctx.strokeStyle = toRGBA(sprout, 0.35);
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(-rx * 0.65, 0);
            ctx.lineTo(rx * 0.65, 0);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bump = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = "rgb(70,70,70)";
    ctx.fillRect(0, 0, w, h);
    const count = 850;
    for (let i = 0; i < count; i++) {
      const cx = hash1(i * 17.3 + 1.1) * w;
      const cy = hash1(i * 31.7 + 2.3) * h;
      const ang = hash1(i * 43.1) * Math.PI * 2;
      const rx = 5 + hash1(i * 11.9) * 8;
      const ry = 2.8 + hash1(i * 23.3) * 4.5;
      const v = Math.round(95 + (i / count) * 145);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const px = cx + ox * w;
          const py = cy + oy * h;
          if (px < -20 || px > w + 20 || py < -20 || py > h + 20) continue;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(ang);
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  });
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;

  return { map, bump };
}

function createMossTextures(THREE, kit, leafHex) {
  // Derive velvety moss harmoniously from opts.leaf, shifted slightly warmer/richer
  const baseLeaf = makeColor(THREE, leafHex);
  const mossBase = shiftHSL(THREE, baseLeaf, -0.055, 0.1, -0.08);
  const mossDark = shiftHSL(THREE, mossBase, 0.03, 0.08, -0.19);
  const mossBright = shiftHSL(THREE, mossBase, -0.04, 0.14, 0.15);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = toRGBA(mossDark);
    ctx.fillRect(0, 0, w, h);

    // Mottled velvety cushions
    for (let i = 0; i < 160; i++) {
      const cx = hash1(i * 19.1) * w;
      const cy = hash1(i * 27.7) * h;
      const r = 18 + hash1(i * 37.3) * 42;
      const col = i % 3 === 0 ? mossBright : mossBase;
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
      g.addColorStop(0, toRGBA(col, 0.55));
      g.addColorStop(1, toRGBA(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fine mossy stipple/tufts
    for (let i = 0; i < 2400; i++) {
      const sx = hash1(i * 71.3) * w;
      const sy = hash1(i * 89.7) * h;
      const r = 1.0 + hash1(i * 13.1) * 2.4;
      const pick = i % 4;
      const col = pick === 0 ? mossDark : pick === 3 ? mossBright : mossBase;
      ctx.fillStyle = toRGBA(col, 0.72);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "rgb(100,100,100)";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2000; i++) {
      const sx = hash1(i * 71.3) * w;
      const sy = hash1(i * 89.7) * h;
      const r = 0.8 + hash1(i * 13.1) * 2.0;
      const v = Math.round(70 + hash1(i * 23.7) * 170);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;

  return { map, bump, mossBright };
}

function createSoilTextures(THREE, kit, woodHex) {
  const base = shiftHSL(THREE, woodHex, -0.02, -0.12, -0.22);
  const dark = shiftHSL(THREE, base, 0, 0.04, -0.14);
  const akadama = shiftHSL(THREE, base, 0.02, 0.08, 0.14);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = toRGBA(dark);
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) {
      const x = hash1(i * 31.1) * w;
      const y = hash1(i * 47.9) * h;
      const r = 1.2 + hash1(i * 19.3) * 3.0;
      const col = i % 5 === 0 ? akadama : i % 2 === 0 ? base : dark;
      ctx.fillStyle = toRGBA(col, 0.88);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "rgb(90,90,90)";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) {
      const x = hash1(i * 31.1) * w;
      const y = hash1(i * 47.9) * h;
      const r = 1.2 + hash1(i * 19.3) * 3.0;
      const v = Math.round(60 + hash1(i * 11.3) * 185);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;

  return { map, bump };
}

function createStoneTextures(THREE, kit) {
  const base = new THREE.Color("#7f8285");
  const dark = new THREE.Color("#575a5e");
  const light = new THREE.Color("#a8aaab");
  const vein = new THREE.Color("#d0cfc8");

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = toRGBA(base);
    ctx.fillRect(0, 0, w, h);

    // Mineral strata bands
    for (let y = 0; y < h; y += 2) {
      const n = fbm(kit, 1.5, y * 0.035, 3);
      const col = n > 0.55 ? light : dark;
      ctx.fillStyle = toRGBA(col, Math.abs(n - 0.5) * 0.55);
      ctx.fillRect(0, y, w, 2);
    }

    // Subtle mineral quartz veins
    ctx.strokeStyle = toRGBA(vein, 0.32);
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 8; i++) {
      let x = 0;
      let y = hash1(i * 23.7) * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      while (x < w) {
        x += 16;
        y += (kit.noise(x * 0.04, i * 3.1) - 0.5) * 14;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Fine granitic speckle
    for (let i = 0; i < 900; i++) {
      const sx = hash1(i * 59.3) * w;
      const sy = hash1(i * 73.1) * h;
      const r = 0.7 + hash1(i * 11.7) * 1.4;
      ctx.fillStyle = i % 2 === 0 ? toRGBA(dark, 0.28) : toRGBA(light, 0.25);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "rgb(128,128,128)";
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const n = fbm(kit, x * 0.06, y * 0.06, 4);
        const v = Math.round(50 + n * 165);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
  });
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;

  return { map, bump };
}

// ---------------------------------------------------------------------------
// Geometry Builders
// ---------------------------------------------------------------------------

/**
 * Evaluates a C1-continuous rounded-rectangle perimeter in the exact angular
 * winding direction of THREE.LatheGeometry (+Z -> +X -> -Z -> -X).
 */
function sampleRoundedRect(u, hx, hz, cr) {
  const ix = hx - cr;
  const iz = hz - cr;
  const arc = cr * Math.PI * 0.5;
  const segs = [ix, arc, 2 * iz, arc, 2 * ix, arc, 2 * iz, arc, ix];
  let total = 0;
  for (let i = 0; i < segs.length; i++) total += segs[i];

  let d = (((u % 1) + 1) % 1) * total;

  // 1. Front-right half edge (+Z)
  if (d <= segs[0]) {
    return { x: d, z: hz, nx: 0, nz: 1 };
  }
  d -= segs[0];

  // 2. Front-right corner arc
  if (d <= segs[1]) {
    const a = (d / arc) * Math.PI * 0.5;
    const s = Math.sin(a), c = Math.cos(a);
    return { x: ix + cr * s, z: iz + cr * c, nx: s, nz: c };
  }
  d -= segs[1];

  // 3. Right edge (+X)
  if (d <= segs[2]) {
    return { x: hx, z: iz - d, nx: 1, nz: 0 };
  }
  d -= segs[2];

  // 4. Back-right corner arc
  if (d <= segs[3]) {
    const a = Math.PI * 0.5 + (d / arc) * Math.PI * 0.5;
    const s = Math.sin(a), c = Math.cos(a);
    return { x: ix + cr * s, z: -iz + cr * c, nx: s, nz: c };
  }
  d -= segs[3];

  // 5. Back edge (-Z)
  if (d <= segs[4]) {
    return { x: ix - d, z: -hz, nx: 0, nz: -1 };
  }
  d -= segs[4];

  // 6. Back-left corner arc
  if (d <= segs[5]) {
    const a = Math.PI + (d / arc) * Math.PI * 0.5;
    const s = Math.sin(a), c = Math.cos(a);
    return { x: -ix + cr * s, z: -iz + cr * c, nx: s, nz: c };
  }
  d -= segs[5];

  // 7. Left edge (-X)
  if (d <= segs[6]) {
    return { x: -hx, z: -iz + d, nx: -1, nz: 0 };
  }
  d -= segs[6];

  // 8. Front-left corner arc
  if (d <= segs[7]) {
    const a = Math.PI * 1.5 + (d / arc) * Math.PI * 0.5;
    const s = Math.sin(a), c = Math.cos(a);
    return { x: -ix + cr * s, z: iz + cr * c, nx: s, nz: c };
  }
  d -= segs[7];

  // 9. Front-left half edge (+Z)
  return { x: -ix + d, z: hz, nx: 0, nz: 1 };
}

/**
 * Shallow rectangular bonsai pot built from a 24-point LatheGeometry profile
 * smoothly morphed onto a C1 rounded-rectangle contour.
 */
function buildBonsaiPotGeo(THREE) {
  // 24-point profile (x = radial parameter s, y = elevation in metres)
  // s <= 0.88 scales inward to center; s > 0.88 offsets along outward contour normal
  const profile = [
    new THREE.Vector2(0.000, 0.011), // 0: bottom center
    new THREE.Vector2(0.550, 0.011), // 1: bottom mid
    new THREE.Vector2(0.860, 0.011), // 2: bottom outer
    new THREE.Vector2(0.900, 0.012), // 3: base bevel
    new THREE.Vector2(0.935, 0.015), // 4: base shoulder
    new THREE.Vector2(0.955, 0.019), // 5: foot band
    new THREE.Vector2(0.946, 0.023), // 6: shadow groove
    new THREE.Vector2(0.976, 0.027), // 7: lower belly start
    new THREE.Vector2(1.006, 0.035), // 8: lower belly swell
    new THREE.Vector2(1.024, 0.044), // 9: mid belly flare
    new THREE.Vector2(1.030, 0.052), // 10: upper shoulder
    new THREE.Vector2(1.016, 0.057), // 11: subtle neck pinch
    new THREE.Vector2(1.046, 0.060), // 12: under-lip overhang
    new THREE.Vector2(1.078, 0.064), // 13: rolled rim outer
    new THREE.Vector2(1.084, 0.069), // 14: rim outer crest
    new THREE.Vector2(1.066, 0.074), // 15: rim top outer round
    new THREE.Vector2(1.026, 0.0755), // 16: rim top crest
    new THREE.Vector2(0.982, 0.074), // 17: rim inner round
    new THREE.Vector2(0.948, 0.069), // 18: inner lip curve
    new THREE.Vector2(0.916, 0.059), // 19: inner basin upper wall
    new THREE.Vector2(0.896, 0.044), // 20: inner basin lower wall
    new THREE.Vector2(0.882, 0.032), // 21: inner corner fillet
    new THREE.Vector2(0.820, 0.027), // 22: inner floor edge
    new THREE.Vector2(0.000, 0.027), // 23: inner floor center
  ];

  const segments = 96;
  const geo = new THREE.LatheGeometry(profile, segments);
  const pos = geo.attributes.position;
  const pLen = profile.length;

  const hx = 0.130;
  const hz = 0.094;
  const cr = 0.025;
  const offsetScale = 0.10; // at s=0.88 -> offset = -0.012

  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const pt = sampleRoundedRect(u, hx, hz, cr);
    const innerX = pt.x - 0.012 * pt.nx;
    const innerZ = pt.z - 0.012 * pt.nz;

    for (let j = 0; j < pLen; j++) {
      const idx = i * pLen + j;
      const s = profile[j].x;
      const y = profile[j].y;

      let vx, vz;
      if (s <= 0.88) {
        const frac = s / 0.88;
        vx = innerX * frac;
        vz = innerZ * frac;
      } else {
        const off = (s - 1.0) * offsetScale;
        vx = pt.x + off * pt.nx;
        vz = pt.z + off * pt.nz;
      }
      pos.setXYZ(idx, vx, y, vz);
    }
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sculpted ceramic corner foot (stout, gently flared cloud-scroll foot)
 * resting flat on y = 0 and embedding seamlessly into the pot base.
 */
function buildPotFootGeo(THREE) {
  const geo = new THREE.SphereGeometry(1, 28, 18);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // Flatten bottom at y = -1 so foot rests solidly on the floor
    let ny = y;
    if (ny < -0.55) {
      ny = -0.55 + (ny + 0.55) * 0.22;
    }
    // Slight flare toward the top where it joins the pot base
    const flare = 1.0 + 0.22 * Math.max(0, ny);
    // Slightly squared pillow cross-section
    const sq = 1.0 + 0.08 * Math.cos(4 * Math.atan2(z, x));
    const vx = x * 0.022 * flare * sq;
    const vz = z * 0.018 * flare * sq;
    // Map ny in [-0.65, 1] -> [0.0, 0.0155]
    const vy = ((ny + 0.65) / 1.65) * 0.0155;
    pos.setXYZ(i, vx, vy, vz);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sculpted organic soil base inside the rectangular pot basin.
 */
function buildSoilGeo(THREE, kit) {
  const geo = new THREE.SphereGeometry(1, 48, 24);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const ang = Math.atan2(z, x);
    const hr = Math.hypot(x, z);
    // Superellipse mapping to conform to the rounded rectangular basin
    const ca = Math.abs(Math.cos(ang));
    const sa = Math.abs(Math.sin(ang));
    const superR = Math.pow(Math.pow(ca, 4) + Math.pow(sa, 4), -0.25);
    const rScale = 1 + (superR - 1) * 0.72 * Math.min(1, hr * 1.15);

    const vx = x * 0.114 * rScale;
    const vz = z * 0.079 * rScale;
    const grain = (fbm(kit, vx * 35 + 2.1, vz * 35 - 1.4, 3) - 0.5) * 0.003;

    let vy;
    if (y >= 0) {
      // Gentle mound peaking slightly under the trunk on the left
      const dx = vx + 0.022;
      const dz = vz - 0.006;
      const trunkMound = Math.exp(-(dx * dx + dz * dz) / 0.0042) * 0.009;
      vy = 0.056 + Math.pow(y, 0.8) * 0.006 + trunkMound + grain;
    } else {
      vy = 0.056 + y * 0.022;
    }
    pos.setXYZ(i, vx, vy, vz);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sculpted velvety moss cushion: one continuous organic domed pillow surface
 * undulating around the nebari roots and hugging the accent stone, leaving
 * a subtle rim of rich soil near the pot edge.
 */
function buildMossGeo(THREE, kit) {
  const geo = new THREE.SphereGeometry(1, 56, 36);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const ang = Math.atan2(z, x);
    const hr = Math.hypot(x, z);
    const ca = Math.abs(Math.cos(ang));
    const sa = Math.abs(Math.sin(ang));
    const superR = Math.pow(Math.pow(ca, 4) + Math.pow(sa, 4), -0.25);
    const rScale = 1 + (superR - 1) * 0.7 * Math.min(1, hr * 1.15);

    // Organic scalloped moss perimeter so soil peeks naturally near edges
    const edgeWobble = 0.94 + 0.08 * fbm(kit, Math.cos(ang) * 2.4 + 3.1, Math.sin(ang) * 2.4 - 1.7, 3);
    const vx = x * 0.107 * rScale * edgeWobble;
    const vz = z * 0.073 * rScale * edgeWobble;

    // Undulating moss pillows
    const pillow = fbm(kit, vx * 16 + 4.2, vz * 16 + 1.9, 4);
    const micro = (kit.noise(vx * 55, vz * 55) - 0.5) * 0.0022;

    // Rise softly around trunk base (-0.024, 0.006)
    const dtx = vx + 0.024;
    const dtz = vz - 0.006;
    const rootRise = Math.exp(-(dtx * dtx + dtz * dtz) / 0.0024) * 0.011;

    // Gentle cradle around the accent stone (0.066, 0.022)
    const dsx = vx - 0.066;
    const dsz = vz - 0.022;
    const stoneDist = Math.hypot(dsx, dsz);
    const stoneHug = Math.exp(-Math.pow((stoneDist - 0.022) / 0.014, 2)) * 0.004;

    let vy;
    if (y >= 0) {
      const dome = Math.pow(y, 0.65) * 0.0085;
      vy = 0.059 + dome + (pillow - 0.42) * 0.010 * (0.35 + 0.65 * y) + rootRise + stoneHug + micro;
    } else {
      vy = 0.059 + y * 0.011;
    }

    pos.setXYZ(i, vx, vy, vz);

    // Soft ambient occlusion & sunlit pillow vertex shading
    const shade = 0.72 + 0.34 * Math.max(0, y) + (pillow - 0.45) * 0.24;
    const s = Math.max(0.55, Math.min(1.12, shade));
    colors[i * 3] = s * 0.98;
    colors[i * 3 + 1] = s * 1.02;
    colors[i * 3 + 2] = s * 0.94;
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sculpted viewing stone (suiseki) from one continuous dense surface,
 * with stratified crags, weathered ridges, and a flattened grounded base.
 */
function buildStoneGeo(THREE, kit, seed, sx, sy, sz) {
  const geo = new THREE.SphereGeometry(1, 48, 32);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // Broad asymmetric mountain-stone profile
    const ridge1 = fbm(kit, x * 1.9 + seed, z * 1.9 - seed, 3) - 0.5;
    const ridge2 = fbm(kit, y * 2.8 + seed * 1.7, x * 2.2 + z * 1.5, 4) - 0.5;
    // Stratified angularity
    const strata = Math.sin(y * 7.5 + x * 2.5 + seed) * 0.055;
    const disp = 1.0 + ridge1 * 0.32 + ridge2 * 0.18 + strata;

    let vx = x * sx * disp;
    let vz = z * sz * disp;
    // Slight charming lean toward the bonsai trunk (-X)
    vx -= Math.max(0, y) * sx * 0.18;

    let vy = y * sy * (1.0 + ridge1 * 0.24);
    // Flatten underside so it embeds cleanly into the moss
    if (y < -0.25) {
      vy = -0.25 * sy + (y + 0.25) * sy * 0.35;
    }

    pos.setXYZ(i, vx, vy, vz);

    // Subtle moss-kissed darker base and sunlit pale stone crest
    const hFactor = Math.max(0, Math.min(1, (y + 0.5) / 1.4));
    const r = 0.74 + hFactor * 0.28 + ridge2 * 0.14;
    const g = 0.78 + hFactor * 0.24 + ridge2 * 0.12;
    const b = 0.73 + hFactor * 0.27 + ridge2 * 0.12;
    colors[i * 3] = Math.min(1.1, r);
    colors[i * 3 + 1] = Math.min(1.1, g);
    colors[i * 3 + 2] = Math.min(1.1, b);
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Ring-by-ring tapered tube along a CatmullRomCurve3 using parallel-transport
 * (Bishop) frames so S-curved twisted trunks never suffer Frenet flips.
 */
function buildTaperedTube(THREE, curve, opts) {
  const {
    tubularSegments = 48,
    radialSegments = 24,
    radiusFn,
    barkFn = null,
    uRepeat = 1,
    vRepeat = 2,
    capStart = true,
    capEnd = true,
  } = opts;

  const pts = [];
  const tangents = [];
  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    pts.push(curve.getPointAt(t));
    tangents.push(curve.getTangentAt(t).normalize());
  }

  // Parallel-transport (rotation-minimizing) frames
  const normals = new Array(tubularSegments + 1);
  const binormals = new Array(tubularSegments + 1);

  const ref = Math.abs(tangents[0].x) < 0.85
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 0, 1);
  binormals[0] = new THREE.Vector3().crossVectors(tangents[0], ref).normalize();
  normals[0] = new THREE.Vector3().crossVectors(binormals[0], tangents[0]).normalize();

  const axis = new THREE.Vector3();
  for (let i = 1; i <= tubularSegments; i++) {
    const prevT = tangents[i - 1];
    const currT = tangents[i];
    axis.crossVectors(prevT, currT);
    const n = normals[i - 1].clone();
    if (axis.lengthSq() > 1e-10) {
      axis.normalize();
      const dot = Math.max(-1, Math.min(1, prevT.dot(currT)));
      n.applyAxisAngle(axis, Math.acos(dot));
    }
    n.addScaledVector(currT, -n.dot(currT)).normalize();
    normals[i] = n;
    binormals[i] = new THREE.Vector3().crossVectors(currT, n).normalize();
  }

  const stride = radialSegments + 1;
  const positions = [];
  const uvs = [];
  const indices = [];
  const dir = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    const baseR = radiusFn(t);
    const p = pts[i];
    const N = normals[i];
    const B = binormals[i];

    for (let j = 0; j <= radialSegments; j++) {
      const frac = j / radialSegments;
      const theta = frac * Math.PI * 2;
      const mod = barkFn ? 1 + barkFn(t, theta) : 1;
      const r = Math.max(0.0004, baseR * mod);

      const c = Math.cos(theta);
      const s = Math.sin(theta);
      dir.set(
        N.x * c + B.x * s,
        N.y * c + B.y * s,
        N.z * c + B.z * s
      );

      positions.push(p.x + dir.x * r, p.y + dir.y * r, p.z + dir.z * r);
      uvs.push(frac * uRepeat, t * vRepeat);
    }
  }

  // Outward winding: (d - a) x (b - a) = d_theta x d_t = +N
  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, d, b);
      indices.push(d, c, b);
    }
  }

  // Optional closed caps
  if (capStart) {
    const centerIdx = positions.length / 3;
    const p0 = pts[0];
    positions.push(p0.x, p0.y, p0.z);
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegments; j++) {
      indices.push(centerIdx, j, j + 1);
    }
  }

  if (capEnd) {
    const centerIdx = positions.length / 3;
    const pEnd = pts[tubularSegments];
    const ringStart = tubularSegments * stride;
    positions.push(pEnd.x, pEnd.y, pEnd.z);
    uvs.push(0.5, vRepeat);
    for (let j = 0; j < radialSegments; j++) {
      indices.push(centerIdx, ringStart + j + 1, ringStart + j);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sculpted cloud-shaped bonsai foliage pad: ONE continuous high-res surface
 * deformed with multi-lobed cumulus pillows, cupped underside, fine leafy
 * tuft micro-displacement, and sunlit-to-shaded vertex colours.
 */
function buildCloudPadGeo(THREE, kit, params) {
  const {
    rx,
    ry,
    rz,
    seed,
    cupDepth = 0.008,
    tiltX = 0,
    tiltZ = 0,
  } = params;

  const geo = new THREE.SphereGeometry(1, 64, 42);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const ang = Math.atan2(z, x);
    const hr = Math.hypot(x, z);

    // Smooth coalesced cloud-pad perimeter lobes (never stuck-together spheres)
    const lobeHarm =
      0.13 * Math.cos(3 * ang + seed * 1.7) +
      0.085 * Math.cos(5 * ang - seed * 2.3) +
      0.055 * Math.cos(2 * ang + seed * 0.9) +
      0.04 * Math.sin(7 * ang + seed * 3.1);
    const lobeNoise = (fbm(kit, x * 1.6 + seed, z * 1.6 - seed, 3) - 0.5) * 0.24;
    const horizScale = 1.0 + (lobeHarm + lobeNoise) * (0.4 + 0.6 * hr);

    // Multi-scale organic leafy pillow billows
    const puff = fbm(kit, x * 2.7 + seed * 2.1, z * 2.7 + y * 1.4 - seed, 3) - 0.48;
    const micro = (kit.noise(x * 7.5 + seed * 4.3, z * 7.5 + y * 6.2) - 0.5) * 0.075;

    let vx = x * rx * horizScale * (1 + puff * 0.14 + micro * 0.55);
    let vz = z * rz * horizScale * (1 + puff * 0.14 + micro * 0.55);

    let vy;
    if (y >= 0) {
      // Billowy, tiered cumulus dome on top
      const dome = Math.pow(y, 0.76);
      const lobeLift = Math.max(0, lobeHarm) * 0.55 * (1 - y * 0.45);
      const billow = puff * 0.34 * (0.35 + 0.65 * hr) + micro * 0.45;
      vy = (dome + lobeLift + billow) * ry;
    } else {
      // Compressed, gently cupped underside so woody branches tuck neatly in
      const flatBottom = -Math.pow(-y, 0.72) * ry * 0.34;
      const cup = cupDepth * Math.max(0, 1 - hr * hr * 1.15) * (1 - Math.abs(y) * 0.25);
      vy = flatBottom + cup + micro * ry * 0.25;
    }

    // Subtle artistic pruning slant
    vy += vx * tiltZ + vz * tiltX;

    pos.setXYZ(i, vx, vy, vz);

    // Canopy vertex shading: shadowed underside, rich midtones, warm sunlit top
    const upFactor = Math.max(0, Math.min(1, (y + 0.45) / 1.35));
    const crevice = Math.min(0, lobeHarm) * 0.65;
    const light = 0.58 + upFactor * 0.48 + puff * 0.24 + crevice;
    const clamped = Math.max(0.48, Math.min(1.16, light));
    // Slightly warmer yellow-green on sunlit tops, cooler emerald underneath
    colors[i * 3] = clamped * (0.94 + upFactor * 0.09);
    colors[i * 3 + 1] = clamped * (0.99 + upFactor * 0.04);
    colors[i * 3 + 2] = clamped * (1.03 - upFactor * 0.09);
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Curved accent bonsai leaf built from ExtrudeGeometry + bezierCurveTo with
 * bevel, then bent longitudinally and cupped transversely so it is never flat.
 */
function buildCurvedLeafGeo(THREE, length = 0.019, width = 0.0105) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(
    width * 0.55, length * 0.18,
    width * 0.62, length * 0.64,
    0, length
  );
  shape.bezierCurveTo(
    -width * 0.62, length * 0.64,
    -width * 0.55, length * 0.18,
    0, 0
  );

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.001,
    bevelEnabled: true,
    bevelThickness: 0.00055,
    bevelSize: 0.00055,
    bevelSegments: 2,
    curveSegments: 9,
  });

  // Bend & cup the leaf vertices so it arches gracefully like a real leaf
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const u = Math.max(0, Math.min(1, y / length));
    const v = x / (width * 0.55);

    // Gentle upward arch then graceful droop at tip + transverse V-cupping
    const arch = Math.sin(u * Math.PI) * 0.0022 - u * u * 0.0036;
    const cup = Math.abs(v) * 0.0016 * Math.sin(u * Math.PI);

    // Orient leaf growing along +Z, arched in Y, width in X
    pos.setXYZ(i, x, z + arch + cup, y);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Populates a cloud foliage pad group with dainty curved accent leaf sprigs
 * emerging naturally around the perimeter and sunlit ridges.
 */
function addAccentLeavesToPad(THREE, padGroup, leafGeo, leafMat, params) {
  const { rx, ry, rz, seed, count = 18 } = params;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + hash1(seed * 13 + i * 7.1) * 0.45;
    const isTop = i % 3 === 0;
    const radFrac = isTop
      ? 0.42 + hash1(seed + i * 11.3) * 0.38
      : 0.78 + hash1(seed + i * 5.7) * 0.18;

    const px = Math.cos(ang) * rx * radFrac;
    const pz = Math.sin(ang) * rz * radFrac;
    const py = isTop
      ? ry * (0.68 + hash1(seed + i * 19.1) * 0.24)
      : ry * (0.04 + hash1(seed + i * 17.3) * 0.34);

    // Pair of curved leaves fanning out as a tiny sprout sprig
    const pairCount = i % 2 === 0 ? 2 : 1;
    for (let p = 0; p < pairCount; p++) {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(px, py, pz);
      const yaw = Math.atan2(px, pz) + (p === 0 ? -0.32 : 0.38) + (hash1(i * 29 + p) - 0.5) * 0.3;
      const pitch = isTop
        ? -0.45 - hash1(i * 13 + p) * 0.35
        : -0.15 + (hash1(i * 23 + p) - 0.5) * 0.3;
      const roll = (p === 0 ? -0.22 : 0.22) + (hash1(i * 37 + p) - 0.5) * 0.25;
      leaf.rotation.set(pitch, yaw, roll, "YXZ");
      const sc = 0.82 + hash1(seed * 3 + i * 17 + p * 5) * 0.42;
      leaf.scale.setScalar(sc);
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      leaf.userData.slot = "leaf";
      padGroup.add(leaf);
    }
  }
}

// ---------------------------------------------------------------------------
// Main Build & Idle Export
// ---------------------------------------------------------------------------

export function build(THREE, opts, kit) {
  const cfg = {
    wood: (opts && opts.wood) || "#8a5a3c",
    leaf: (opts && opts.leaf) || "#7fb48a",
    ceramic: (opts && opts.ceramic) || "#8fc1e8",
  };

  const root = new THREE.Group();
  root.name = "bonsaiTree";

  // 1. Procedural textures & MeshPhysicalMaterials
  const ceramicTex = createCeramicTextures(THREE, kit, cfg.ceramic);
  const ceramicMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: ceramicTex.map,
    bumpMap: ceramicTex.bump,
    bumpScale: 0.0006,
    roughness: 0.22,
    metalness: 0.02,
    clearcoat: 0.88,
    clearcoatRoughness: 0.13,
  });

  const footMat = new THREE.MeshPhysicalMaterial({
    color: shiftHSL(THREE, cfg.ceramic, 0.01, -0.08, -0.06),
    roughness: 0.36,
    metalness: 0.02,
    clearcoat: 0.55,
    clearcoatRoughness: 0.24,
  });

  const barkTex = createBarkTextures(THREE, kit, cfg.wood);
  const barkMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: barkTex.map,
    bumpMap: barkTex.bump,
    bumpScale: 0.0038,
    roughness: 0.88,
    metalness: 0.0,
    sheen: 0.22,
    sheenRoughness: 0.85,
    sheenColor: shiftHSL(THREE, cfg.wood, 0.02, -0.1, 0.22),
  });

  const foliageTex = createFoliageTextures(THREE, kit, cfg.leaf);
  const foliagePadMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: foliageTex.map,
    bumpMap: foliageTex.bump,
    bumpScale: 0.0032,
    vertexColors: true,
    roughness: 0.86,
    metalness: 0.0,
    sheen: 0.68,
    sheenRoughness: 0.74,
    sheenColor: shiftHSL(THREE, cfg.leaf, -0.03, 0.08, 0.24),
  });

  const accentLeafMat = new THREE.MeshPhysicalMaterial({
    color: shiftHSL(THREE, cfg.leaf, -0.025, 0.06, 0.08),
    roughness: 0.68,
    metalness: 0.0,
    sheen: 0.55,
    sheenRoughness: 0.62,
    sheenColor: shiftHSL(THREE, cfg.leaf, -0.04, 0.1, 0.28),
  });

  const mossTex = createMossTextures(THREE, kit, cfg.leaf);
  const mossMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: mossTex.map,
    bumpMap: mossTex.bump,
    bumpScale: 0.0028,
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.0,
    sheen: 0.86,
    sheenRoughness: 0.72,
    sheenColor: shiftHSL(THREE, mossTex.mossBright, -0.02, 0.06, 0.16),
  });

  const soilTex = createSoilTextures(THREE, kit, cfg.wood);
  const soilMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: soilTex.map,
    bumpMap: soilTex.bump,
    bumpScale: 0.003,
    roughness: 0.96,
    metalness: 0.0,
  });

  const stoneTex = createStoneTextures(THREE, kit);
  const stoneMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: stoneTex.map,
    bumpMap: stoneTex.bump,
    bumpScale: 0.0025,
    vertexColors: true,
    roughness: 0.82,
    metalness: 0.04,
  });

  // 2. Shallow Rectangular Glazed Ceramic Pot & Corner Feet
  const potGroup = new THREE.Group();
  potGroup.name = "pot";

  const potMesh = new THREE.Mesh(buildBonsaiPotGeo(THREE), ceramicMat);
  potMesh.castShadow = true;
  potMesh.receiveShadow = true;
  potMesh.userData.slot = "ceramic";
  potGroup.add(potMesh);

  const footGeo = buildPotFootGeo(THREE);
  const footCoords = [
    [-0.095, -0.062],
    [0.095, -0.062],
    [-0.095, 0.062],
    [0.095, 0.062],
  ];
  for (let i = 0; i < footCoords.length; i++) {
    const [fx, fz] = footCoords[i];
    const foot = new THREE.Mesh(footGeo, footMat);
    foot.position.set(fx, 0, fz);
    foot.castShadow = true;
    foot.receiveShadow = true;
    foot.userData.slot = "ceramic";
    potGroup.add(foot);
  }
  root.add(potGroup);

  // 3. Soil Bed, Velvety Sculpted Moss Cushion & Viewing Stone
  const landscapeGroup = new THREE.Group();
  landscapeGroup.name = "moss";

  const soilMesh = new THREE.Mesh(buildSoilGeo(THREE, kit), soilMat);
  soilMesh.receiveShadow = true;
  soilMesh.userData.slot = "wood";
  landscapeGroup.add(soilMesh);

  const mossMesh = new THREE.Mesh(buildMossGeo(THREE, kit), mossMat);
  mossMesh.castShadow = true;
  mossMesh.receiveShadow = true;
  mossMesh.userData.slot = "leaf";
  landscapeGroup.add(mossMesh);

  // Hero viewing stone nestled in the right-front moss
  const mainStone = new THREE.Mesh(
    buildStoneGeo(THREE, kit, 3.7, 0.025, 0.021, 0.019),
    stoneMat
  );
  mainStone.position.set(0.066, 0.068, 0.022);
  mainStone.rotation.set(0.08, -0.42, 0.12);
  mainStone.castShadow = true;
  mainStone.receiveShadow = true;
  mainStone.userData.slot = "secondary";
  landscapeGroup.add(mainStone);

  // Two small companion pebbles near the viewing stone for cozy scale
  const pebble1 = new THREE.Mesh(
    buildStoneGeo(THREE, kit, 9.2, 0.0085, 0.0062, 0.0072),
    stoneMat
  );
  pebble1.position.set(0.041, 0.064, 0.036);
  pebble1.rotation.set(0.1, 0.7, -0.08);
  pebble1.castShadow = true;
  pebble1.receiveShadow = true;
  pebble1.userData.slot = "secondary";
  landscapeGroup.add(pebble1);

  const pebble2 = new THREE.Mesh(
    buildStoneGeo(THREE, kit, 14.5, 0.0065, 0.005, 0.0055),
    stoneMat
  );
  pebble2.position.set(0.084, 0.064, 0.004);
  pebble2.rotation.set(-0.08, 1.3, 0.14);
  pebble2.castShadow = true;
  pebble2.receiveShadow = true;
  pebble2.userData.slot = "secondary";
  landscapeGroup.add(pebble2);

  root.add(landscapeGroup);

  // 4. Twisted Moyogi Trunk, Nebari Surface Roots & Primary Branches
  const bodyGroup = new THREE.Group();
  bodyGroup.name = "body";

  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.027, 0.050, 0.006),
    new THREE.Vector3(-0.024, 0.078, 0.008),
    new THREE.Vector3(0.006, 0.118, 0.018),
    new THREE.Vector3(0.026, 0.156, 0.004),
    new THREE.Vector3(-0.004, 0.194, -0.010),
    new THREE.Vector3(-0.024, 0.228, 0.000),
    new THREE.Vector3(-0.008, 0.268, 0.008),
  ]);

  const trunkGeo = buildTaperedTube(THREE, trunkCurve, {
    tubularSegments: 58,
    radialSegments: 28,
    uRepeat: 2,
    vRepeat: 4,
    capStart: true,
    capEnd: true,
    radiusFn: (t) => {
      // Dramatic nebari root flare at base, gentle gnarled taper toward crown
      const flare = 0.011 * Math.pow(Math.max(0, 1 - t / 0.24), 2.1);
      const baseTaper = 0.021 * Math.pow(1 - t, 0.72) + 0.0062;
      const knot = 0.0016 * Math.sin(t * Math.PI * 5.2) * (1 - t * 0.5);
      return baseTaper + flare + knot;
    },
    barkFn: (t, theta) => {
      // Helical twisted bark flutes (classic aged bonsai torsion)
      const twist = t * 5.4;
      const flute =
        0.095 * Math.sin(theta * 5 + twist) * (1 - t * 0.45) +
        0.055 * Math.cos(theta * 3 - twist * 0.6) +
        0.04 * (kit.noise(Math.cos(theta) * 2.2 + t * 5, Math.sin(theta) * 2.2 + t * 3) - 0.5);
      return flute;
    },
  });

  const trunkMesh = new THREE.Mesh(trunkGeo, barkMat);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  trunkMesh.userData.slot = "wood";
  bodyGroup.add(trunkMesh);

  // 6 Nebari surface roots flaring cleanly from the lower trunk into the moss
  const rootAngles = [0.22, 1.15, 2.25, 3.25, 4.35, 5.42];
  for (let i = 0; i < rootAngles.length; i++) {
    const ang = rootAngles[i];
    const len = 0.044 + hash1(i * 17.3) * 0.026;
    const dx = Math.cos(ang);
    const dz = Math.sin(ang);
    const sway = (hash1(i * 29.1) - 0.5) * 0.014;

    const rCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.023 + dx * 0.004, 0.082, 0.007 + dz * 0.004),
      new THREE.Vector3(-0.023 + dx * len * 0.45 - dz * sway, 0.075, 0.007 + dz * len * 0.45 + dx * sway),
      new THREE.Vector3(-0.023 + dx * len * 0.82 + dz * sway * 0.6, 0.065, 0.007 + dz * len * 0.82 - dx * sway * 0.6),
      new THREE.Vector3(-0.023 + dx * len, 0.050, 0.007 + dz * len),
    ]);

    const rGeo = buildTaperedTube(THREE, rCurve, {
      tubularSegments: 18,
      radialSegments: 14,
      uRepeat: 1,
      vRepeat: 1.5,
      radiusFn: (t) => (0.0115 * Math.pow(1 - t, 0.85) + 0.0022) * (1 + 0.25 * Math.pow(1 - t, 3)),
      barkFn: (t, theta) => 0.08 * Math.sin(theta * 3 + t * 3),
    });

    const rMesh = new THREE.Mesh(rGeo, barkMat);
    rMesh.castShadow = true;
    rMesh.receiveShadow = true;
    rMesh.userData.slot = "wood";
    bodyGroup.add(rMesh);
  }

  // Helper to add a flared branch or feeder twig
  const addBranch = (pts, startR, endR, segs = 22, radSegs = 14) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    const bGeo = buildTaperedTube(THREE, curve, {
      tubularSegments: segs,
      radialSegments: radSegs,
      uRepeat: 1,
      vRepeat: 2.2,
      radiusFn: (t) => {
        const collar = 0.35 * startR * Math.pow(Math.max(0, 1 - t / 0.22), 2);
        return startR * (1 - t) + endR * t + collar;
      },
      barkFn: (t, theta) => 0.07 * Math.sin(theta * 4 + t * 4.2),
    });
    const bMesh = new THREE.Mesh(bGeo, barkMat);
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    bMesh.userData.slot = "wood";
    bodyGroup.add(bMesh);
  };

  // Branch 1 -> Lower-Left Cloud Pad (Pad 1)
  addBranch([
    new THREE.Vector3(0.008, 0.136, 0.012),
    new THREE.Vector3(-0.026, 0.150, 0.019),
    new THREE.Vector3(-0.068, 0.160, 0.025),
    new THREE.Vector3(-0.104, 0.178, 0.026),
  ], 0.0105, 0.0042, 24, 16);

  // Feeder twigs into Pad 1 underside
  addBranch([
    new THREE.Vector3(-0.062, 0.159, 0.024),
    new THREE.Vector3(-0.095, 0.167, 0.008),
    new THREE.Vector3(-0.128, 0.180, 0.006),
  ], 0.0055, 0.0024, 14, 10);

  addBranch([
    new THREE.Vector3(-0.056, 0.158, 0.024),
    new THREE.Vector3(-0.076, 0.168, 0.042),
    new THREE.Vector3(-0.092, 0.181, 0.050),
  ], 0.0052, 0.0022, 14, 10);

  // Branch 2 -> Mid-Right Cloud Pad (Pad 2, overhanging the viewing stone)
  addBranch([
    new THREE.Vector3(0.016, 0.172, -0.002),
    new THREE.Vector3(0.048, 0.184, -0.008),
    new THREE.Vector3(0.078, 0.198, -0.010),
    new THREE.Vector3(0.096, 0.214, -0.010),
  ], 0.0095, 0.004, 24, 16);

  // Feeder twigs into Pad 2 underside
  addBranch([
    new THREE.Vector3(0.062, 0.190, -0.009),
    new THREE.Vector3(0.092, 0.200, 0.007),
    new THREE.Vector3(0.118, 0.215, 0.012),
  ], 0.005, 0.0022, 14, 10);

  addBranch([
    new THREE.Vector3(0.058, 0.189, -0.009),
    new THREE.Vector3(0.078, 0.202, -0.026),
    new THREE.Vector3(0.090, 0.216, -0.036),
  ], 0.0048, 0.0022, 14, 10);

  // Crown feeder twigs into Pad 3 underside
  addBranch([
    new THREE.Vector3(-0.016, 0.244, 0.004),
    new THREE.Vector3(-0.034, 0.260, 0.004),
    new THREE.Vector3(-0.046, 0.278, 0.008),
  ], 0.0058, 0.0025, 14, 10);

  addBranch([
    new THREE.Vector3(-0.010, 0.252, 0.006),
    new THREE.Vector3(0.014, 0.264, 0.002),
    new THREE.Vector3(0.030, 0.279, 0.002),
  ], 0.0055, 0.0024, 14, 10);

  addBranch([
    new THREE.Vector3(-0.012, 0.254, 0.006),
    new THREE.Vector3(-0.006, 0.266, 0.024),
    new THREE.Vector3(-0.004, 0.280, 0.036),
  ], 0.0048, 0.0022, 14, 10);

  root.add(bodyGroup);

  // 5. Three Sculpted Cloud-Shaped Foliage Pads + Curved Accent Leaf Sprigs
  const canopyGroup = new THREE.Group();
  canopyGroup.name = "head";

  const accentLeafGeo = buildCurvedLeafGeo(THREE, 0.0185, 0.0105);

  const padConfigs = [
    {
      name: "pad1",
      pivot: [-0.072, 0.164, 0.025],
      offset: [-0.034, 0.021, 0.001],
      rx: 0.074,
      ry: 0.037,
      rz: 0.056,
      seed: 1.7,
      cupDepth: 0.007,
      tiltX: 0.04,
      tiltZ: 0.06,
      leafCount: 16,
    },
    {
      name: "pad2",
      pivot: [0.066, 0.194, -0.010],
      offset: [0.030, 0.024, 0.000],
      rx: 0.068,
      ry: 0.035,
      rz: 0.052,
      seed: 5.3,
      cupDepth: 0.007,
      tiltX: -0.03,
      tiltZ: -0.05,
      leafCount: 15,
    },
    {
      name: "pad3",
      pivot: [-0.010, 0.258, 0.008],
      offset: [0.002, 0.027, 0.000],
      rx: 0.084,
      ry: 0.045,
      rz: 0.065,
      seed: 9.8,
      cupDepth: 0.009,
      tiltX: 0.02,
      tiltZ: -0.02,
      leafCount: 18,
    },
  ];

  const animPads = [];
  for (let i = 0; i < padConfigs.length; i++) {
    const pc = padConfigs[i];
    const padPivot = new THREE.Group();
    padPivot.name = pc.name;
    padPivot.position.set(pc.pivot[0], pc.pivot[1], pc.pivot[2]);

    const padHolder = new THREE.Group();
    padHolder.position.set(pc.offset[0], pc.offset[1], pc.offset[2]);

    const padGeo = buildCloudPadGeo(THREE, kit, pc);
    const padMesh = new THREE.Mesh(padGeo, foliagePadMat);
    padMesh.castShadow = true;
    padMesh.receiveShadow = true;
    padMesh.userData.slot = "leaf";
    padHolder.add(padMesh);

    addAccentLeavesToPad(THREE, padHolder, accentLeafGeo, accentLeafMat, {
      rx: pc.rx,
      ry: pc.ry,
      rz: pc.rz,
      seed: pc.seed,
      count: pc.leafCount,
    });

    padPivot.add(padHolder);
    canopyGroup.add(padPivot);
    animPads.push(padPivot);
  }

  root.add(canopyGroup);

  // Cache animated references for zero-allocation idle updates
  root.userData._anim = {
    canopy: canopyGroup,
    pads: animPads,
  };

  return root;
}

export function idle(group, t) {
  const anim = group.userData && group.userData._anim;
  if (!anim) return;

  // Gentle cozy window-breeze sway across the three cloud pads (out of phase)
  const pads = anim.pads;
  for (let i = 0; i < pads.length; i++) {
    const pad = pads[i];
    const phase = i * 1.45;
    const freq = 1.05 + i * 0.18;
    const primary = Math.sin(t * freq + phase);
    const flutter = Math.sin(t * (freq * 2.35) + phase * 1.7) * 0.3;

    pad.rotation.z = (primary + flutter) * 0.018;
    pad.rotation.x = (Math.cos(t * (freq * 0.82) + phase) + flutter * 0.6) * 0.014;
    pad.rotation.y = Math.sin(t * (freq * 0.65) + phase) * 0.012;

    // Subtle organic breathing fullness
    const breathe = 1 + Math.sin(t * 1.3 + phase) * 0.0055;
    pad.scale.set(breathe, 1 / Math.sqrt(breathe), breathe);
  }
}
export const META = {
  id: "desk_globe",
  name: "Desk Globe",
  kind: "prop",
  footprint: [0.24, 0.22],
  variants: [
    {
      name: "Cozy Pastel",
      opts: { sea: "#8fc1e8", land: "#a8e0c0", metal: "#d9c08a", wood: "#c89462" }
    },
    {
      name: "Vintage Parchment",
      opts: { sea: "#bdd4d4", land: "#dfd0a8", metal: "#caa86a", wood: "#92603c" }
    },
    {
      name: "Midnight Study",
      opts: { sea: "#4e7396", land: "#8eb89c", metal: "#dec180", wood: "#6e4730" }
    },
    {
      name: "Blush Dorm",
      opts: { sea: "#b4d7eb", land: "#e6b8ae", metal: "#dfb792", wood: "#d2a276" }
    }
  ],
  note: "Cozy desk globe with sculpted raised continents on a curved engraved brass meridian arm and turned wooden base."
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

function parseColorRGB(THREE, value, fallbackHex) {
  const str = typeof value === "string" ? value.trim() : fallbackHex;
  const hex = str.startsWith("#") ? str.slice(1) : "";
  if (hex.length === 6 && /^[0-9a-fA-F]{6}$/.test(hex)) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16)
    ];
  }
  if (hex.length === 3 && /^[0-9a-fA-F]{3}$/.test(hex)) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16)
    ];
  }
  const c = new THREE.Color(str || fallbackHex);
  const out = { r: 0.5, g: 0.5, b: 0.5 };
  if (THREE.SRGBColorSpace && c.getRGB) {
    c.getRGB(out, THREE.SRGBColorSpace);
  } else {
    out.r = c.r;
    out.g = c.g;
    out.b = c.b;
  }
  return [
    Math.round(clamp(out.r, 0, 1) * 255),
    Math.round(clamp(out.g, 0, 1) * 255),
    Math.round(clamp(out.b, 0, 1) * 255)
  ];
}

function mixRGB(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}

function scaleRGB(c, factor) {
  return [
    clamp(c[0] * factor, 0, 255),
    clamp(c[1] * factor, 0, 255),
    clamp(c[2] * factor, 0, 255)
  ];
}

function rgbCSS(c, alpha = 1) {
  const r = Math.round(clamp(c[0], 0, 255));
  const g = Math.round(clamp(c[1], 0, 255));
  const b = Math.round(clamp(c[2], 0, 255));
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

// Seamless, pole-safe noise evaluated on 3D unit sphere coordinates
function sphereNoise(kit, px, py, pz, scale, seed) {
  const n1 = kit.noise(px * scale + 13.7 + seed, pz * scale + 7.3 - seed);
  const n2 = kit.noise(py * scale + 29.1 - seed, (px - pz) * scale * 0.7071 + 41.3 + seed);
  return 0.5 * (n1 + n2);
}

// Precompute stylized continent lobes in 3D unit-sphere tangent frames
function createWorldModel(kit) {
  const DEG = Math.PI / 180;
  // [latDeg, lonDeg, rEastDeg, rNorthDeg, rotDeg, weight]
  const rawLobes = [
    // North America
    [63, -150, 8.5, 6.5, -10, 0.92],
    [58, -118, 14.5, 11.5, -12, 1.18],
    [54, -84, 12.0, 10.5, 16, 1.02],
    [40, -104, 17.5, 11.5, -8, 1.24],
    [36, -83, 11.0, 9.5, 18, 0.98],
    [22, -101, 8.0, 9.5, -35, 0.92],
    [12, -85, 6.5, 4.8, -40, 0.84],
    [21, -76, 5.8, 2.8, -15, 0.72],
    // Greenland & Iceland
    [73, -41, 6.2, 10.2, 15, 1.1],
    [65, -18, 3.4, 2.6, 0, 0.68],
    // South America
    [4, -68, 11.5, 9.8, -15, 1.08],
    [-9, -53, 16.0, 13.5, -18, 1.24],
    [-23, -62, 10.5, 12.5, 10, 1.06],
    [-39, -68, 6.5, 12.8, 12, 0.96],
    // Europe
    [40, -4, 6.4, 5.2, 0, 0.88],
    [48, 9, 10.5, 7.2, 10, 1.04],
    [54, -2, 3.8, 5.0, -10, 0.74],
    [63, 15, 5.8, 8.8, 30, 0.96],
    [42, 14, 3.8, 6.0, -35, 0.74],
    [54, 34, 13.5, 10.2, 5, 1.12],
    // Africa
    [26, 8, 20.0, 11.8, -5, 1.22],
    [13, -7, 12.2, 8.8, -15, 1.08],
    [8, 24, 15.2, 11.8, 0, 1.16],
    [8, 43, 8.5, 6.6, 24, 0.88],
    [-10, 25, 12.8, 12.8, 5, 1.12],
    [-26, 24, 8.8, 9.6, 0, 1.02],
    [-19, 46, 3.8, 6.8, 15, 0.76],
    // Asia
    [39, 36, 9.2, 5.5, 0, 0.92],
    [24, 46, 10.5, 8.5, -25, 0.98],
    [60, 72, 18.0, 12.5, 4, 1.22],
    [62, 122, 18.0, 11.5, -8, 1.18],
    [44, 82, 22.0, 13.2, 0, 1.22],
    [33, 108, 16.5, 12.2, 10, 1.18],
    [20, 78, 9.5, 11.8, 5, 1.04],
    [15, 102, 7.5, 8.8, -15, 0.90],
    [36, 138, 4.4, 7.6, 35, 0.78],
    [-2, 115, 8.2, 5.4, 10, 0.74],
    [-6, 142, 8.5, 4.6, -15, 0.74],
    // Australia & New Zealand
    [-25, 133, 17.0, 11.8, -8, 1.20],
    [-41, 173, 3.8, 6.2, 35, 0.72],
    // Antarctic Peninsula
    [-68, -62, 4.2, 7.0, 22, 0.92]
  ];

  const lobes = rawLobes.map(([latD, lonD, reD, rnD, rotD, w]) => {
    const lat = latD * DEG;
    const lon = lonD * DEG;
    const u = (lonD + 180) / 360;
    const phi = u * Math.PI * 2;
    const theta = Math.PI * 0.5 - lat;

    // Match Three.js SphereGeometry coordinates
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    const sinP = Math.sin(phi);
    const cosP = Math.cos(phi);

    const cx = -cosP * sinT;
    const cy = cosT;
    const cz = sinP * sinT;

    // East unit vector (direction of increasing phi)
    const ex0 = sinP;
    const ey0 = 0;
    const ez0 = cosP;

    // North unit vector (direction of decreasing theta)
    const nx0 = -cosP * cosT;
    const ny0 = sinT;
    const nz0 = sinP * cosT;

    const rot = rotD * DEG;
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);

    const ex = ex0 * cr + nx0 * sr;
    const ey = ey0 * cr + ny0 * sr;
    const ez = ez0 * cr + nz0 * sr;

    const nx = -ex0 * sr + nx0 * cr;
    const ny = -ey0 * sr + ny0 * cr;
    const nz = -ez0 * sr + nz0 * cr;

    const re = reD * DEG;
    const rn = rnD * DEG;
    const maxR = Math.max(re, rn);
    const cosMax = Math.cos(maxR * 1.15);
    const sinMax = Math.sin(maxR * 1.15);

    return {
      cx, cy, cz,
      ex, ey, ez,
      nx, ny, nz,
      invRE: 1 / Math.sin(re),
      invRN: 1 / Math.sin(rn),
      cosMax,
      yMin: cy - sinMax,
      yMax: cy + sinMax,
      w
    };
  });

  function evaluate(px, py, pz, activeLobes) {
    const list = activeLobes || lobes;
    let sum = 0;

    for (let i = 0; i < list.length; i++) {
      const lb = list[i];
      const dotC = px * lb.cx + py * lb.cy + pz * lb.cz;
      if (dotC <= lb.cosMax) continue;
      const de = (px * lb.ex + py * lb.ey + pz * lb.ez) * lb.invRE;
      const dn = (px * lb.nx + py * lb.ny + pz * lb.nz) * lb.invRN;
      const d2 = de * de + dn * dn;
      if (d2 < 1) {
        const t = 1 - d2;
        sum += lb.w * t * t;
      }
    }

    // Antarctica polar cap (py = sin(lat))
    if (py < -0.84) {
      const antLat = -py;
      const wave = 0.038 * (sphereNoise(kit, px, py, pz, 2.8, 3.1) - 0.5);
      const ant = smoothstep(0.905 + wave, 0.965 + wave, antLat);
      sum += ant * 1.15;
    }

    const nCoast = sphereNoise(kit, px, py, pz, 3.6, 1.7) - 0.5;
    const nFine = sphereNoise(kit, px, py, pz, 8.4, 9.2) - 0.5;
    const field = sum + nCoast * 0.24 + nFine * 0.095;

    const shelf = smoothstep(0.41, 0.50, field);
    const hills = smoothstep(0.50, 1.40, field) * (0.58 + 0.42 * (nFine + 0.5));
    return { field, shelf, hills, nFine };
  }

  function getActiveLobesForY(py) {
    const out = [];
    for (let i = 0; i < lobes.length; i++) {
      const lb = lobes[i];
      if (py >= lb.yMin && py <= lb.yMax) out.push(lb);
    }
    return out;
  }

  return { evaluate, getActiveLobesForY };
}

function buildGlobeTextures(THREE, kit, world, seaRGB, landRGB, metalRGB) {
  const shallowSea = mixRGB(seaRGB, [238, 249, 255], 0.36);
  const deepSea = scaleRGB(seaRGB, 0.88);
  const landEdge = scaleRGB(landRGB, 0.78);
  const landHigh = mixRGB(landRGB, [248, 245, 224], 0.34);
  const polarCream = mixRGB(landRGB, [246, 249, 248], 0.62);
  const inkLine = mixRGB(seaRGB, [46, 62, 76], 0.42);
  const goldLine = mixRGB(metalRGB, [248, 238, 206], 0.35);

  const colorTex = kit.canvasTexture(1024, 512, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;

    for (let y = 0; y < h; y++) {
      const v = 1 - (y + 0.5) / h;
      const theta = (1 - v) * Math.PI;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      const active = world.getActiveLobesForY(cosT);
      const polarT = smoothstep(0.86, 0.96, Math.abs(cosT));

      for (let x = 0; x < w; x++) {
        const u = (x + 0.5) / w;
        const phi = u * Math.PI * 2;
        const px = -Math.cos(phi) * sinT;
        const py = cosT;
        const pz = Math.sin(phi) * sinT;

        const { field, hills, nFine } = world.evaluate(px, py, pz, active);
        const grain = (kit.noise(x * 0.14 + 3.1, y * 0.14 + 5.7) - 0.5) * 9;

        // Subtle vintage paper-gore shade every 30 degrees (12 gores)
        const gorePhase = Math.abs(((u * 12) % 1) - 0.5) * 2;
        const goreShade = -smoothstep(0.86, 1.0, gorePhase) * 6;

        let c;
        if (field < 0.435) {
          const coastT = smoothstep(0.24, 0.435, field);
          const depthT = smoothstep(0.02, 0.24, field);
          c = mixRGB(deepSea, seaRGB, depthT);
          c = mixRGB(c, shallowSea, coastT * 0.58);
          // Delicate soft shoreline ripple
          const ripple = smoothstep(0.36, 0.415, field) * (1 - smoothstep(0.415, 0.435, field));
          c = mixRGB(c, [252, 255, 255], ripple * 0.28);
        } else {
          const innerT = smoothstep(0.435, 0.495, field);
          c = mixRGB(landEdge, landRGB, innerT);
          c = mixRGB(c, landHigh, hills * 0.55);
          c = mixRGB(c, polarCream, polarT * 0.65);
          // Subtle coastline ink contour
          const outline = 1 - smoothstep(0.435, 0.462, field);
          c = mixRGB(c, scaleRGB(landEdge, 0.84), outline * 0.55);
        }

        const idx = (y * w + x) * 4;
        const micro = grain + goreShade + nFine * 5;
        data[idx] = clamp(c[0] + micro, 0, 255);
        data[idx + 1] = clamp(c[1] + micro, 0, 255);
        data[idx + 2] = clamp(c[2] + micro, 0, 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Latitude & longitude graticule lines
    ctx.save();
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = rgbCSS(inkLine, 0.22);

    // Meridians every 30 deg
    for (let i = 0; i < 12; i++) {
      const gx = (i / 12) * w;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }

    // Parallels every 30 deg
    for (let lat = -60; lat <= 60; lat += 30) {
      if (lat === 0) continue;
      const gy = (0.5 - lat / 180) * h;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    // Tropics and polar circles (dashed)
    ctx.setLineDash([5, 6]);
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = rgbCSS(goldLine, 0.42);
    for (const lat of [-66.5, -23.4, 23.4, 66.5]) {
      const gy = (0.5 - lat / 180) * h;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    // Equator decorative double line with degree ticks
    ctx.setLineDash([]);
    const eqY = h * 0.5;
    ctx.lineWidth = 2.0;
    ctx.strokeStyle = rgbCSS(goldLine, 0.55);
    ctx.beginPath();
    ctx.moveTo(0, eqY);
    ctx.lineTo(w, eqY);
    ctx.stroke();

    ctx.lineWidth = 1.0;
    ctx.strokeStyle = rgbCSS(inkLine, 0.38);
    for (let i = 0; i < 72; i++) {
      const tx = (i / 72) * w;
      const tickH = i % 3 === 0 ? 5 : 2.5;
      ctx.beginPath();
      ctx.moveTo(tx, eqY - tickH);
      ctx.lineTo(tx, eqY + tickH);
      ctx.stroke();
    }

    // Cozy compass roses in open ocean (Mid-Atlantic & Pacific)
    function drawCompassRose(cx, cy, r) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = rgbCSS(inkLine, 0.36);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, r * 0.56, 0, Math.PI * 2);
      ctx.stroke();

      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4;
        const len = i % 2 === 0 ? r : r * 0.68;
        const spread = i % 2 === 0 ? 0.22 : 0.16;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang - spread) * r * 0.24, Math.sin(ang - spread) * r * 0.24);
        ctx.lineTo(Math.cos(ang) * len, Math.sin(ang) * len);
        ctx.closePath();
        ctx.fillStyle = rgbCSS(goldLine, i % 2 === 0 ? 0.62 : 0.36);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang) * len, Math.sin(ang) * len);
        ctx.lineTo(Math.cos(ang + spread) * r * 0.24, Math.sin(ang + spread) * r * 0.24);
        ctx.closePath();
        ctx.fillStyle = rgbCSS(inkLine, i % 2 === 0 ? 0.42 : 0.24);
        ctx.fill();
      }
      ctx.restore();
    }

    drawCompassRose(w * 0.395, h * 0.42, 18); // Mid-Atlantic
    drawCompassRose(w * 0.115, h * 0.58, 22); // South Pacific
    drawCompassRose(w * 0.715, h * 0.62, 17); // Indian Ocean
    ctx.restore();
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.ClampToEdgeWrapping;

  const roughBumpTex = kit.canvasTexture(512, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      const v = 1 - (y + 0.5) / h;
      const theta = (1 - v) * Math.PI;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      const active = world.getActiveLobesForY(cosT);

      for (let x = 0; x < w; x++) {
        const u = (x + 0.5) / w;
        const phi = u * Math.PI * 2;
        const px = -Math.cos(phi) * sinT;
        const py = cosT;
        const pz = Math.sin(phi) * sinT;

        const { shelf, hills } = world.evaluate(px, py, pz, active);
        const paper = (kit.noise(x * 0.25 + 9.2, y * 0.25 + 1.4) - 0.5) * 18;
        // Sea = smoother satin (value ~88), Land = tactile matte paper (value ~178)
        const roughVal = clamp(88 + shelf * 84 + hills * 18 + paper, 40, 235);
        const idx = (y * w + x) * 4;
        data[idx] = roughVal;
        data[idx + 1] = roughVal;
        data[idx + 2] = roughVal;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  roughBumpTex.wrapS = THREE.RepeatWrapping;
  roughBumpTex.wrapT = THREE.ClampToEdgeWrapping;

  return { colorTex, roughBumpTex };
}

function buildWoodTextures(THREE, kit, woodRGB) {
  const darkWood = scaleRGB(woodRGB, 0.72);
  const lightWood = mixRGB(woodRGB, [252, 232, 200], 0.24);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;

    for (let y = 0; y < h; y++) {
      const vy = y / h;
      for (let x = 0; x < w; x++) {
        const ux = x / w;
        // Periodic along x for seamless LatheGeometry wrap
        const ang = ux * Math.PI * 2;
        const nx = Math.cos(ang) * 2.2 + 5.0;
        const nz = Math.sin(ang) * 2.2 + 5.0;
        const warp = kit.noise(nx * 1.4, vy * 4.5 + nz * 0.4) * 3.4;
        const rings = Math.sin((vy * 22.0 + warp) * Math.PI);
        const ringT = 0.5 + 0.5 * rings;
        const fine = kit.noise(nx * 6.5, vy * 36.0) - 0.5;

        let c = mixRGB(darkWood, lightWood, ringT * 0.72 + 0.14);
        c = mixRGB(c, woodRGB, 0.35);
        const grain = fine * 16;

        const idx = (y * w + x) * 4;
        data[idx] = clamp(c[0] + grain, 0, 255);
        data[idx + 1] = clamp(c[1] + grain, 0, 255);
        data[idx + 2] = clamp(c[2] + grain, 0, 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      const vy = y / h;
      for (let x = 0; x < w; x++) {
        const ang = (x / w) * Math.PI * 2;
        const nx = Math.cos(ang) * 2.2 + 5.0;
        const nz = Math.sin(ang) * 2.2 + 5.0;
        const warp = kit.noise(nx * 1.4, vy * 4.5 + nz * 0.4) * 3.4;
        const ring = 0.5 + 0.5 * Math.sin((vy * 22.0 + warp) * Math.PI);
        const pore = kit.noise(nx * 9.0, vy * 42.0);
        const val = clamp(95 + ring * 95 + (pore - 0.5) * 42, 0, 255);
        const idx = (y * w + x) * 4;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;

  return { map, bump };
}

function buildBrassTextures(THREE, kit, metalRGB) {
  const lightBrass = mixRGB(metalRGB, [255, 248, 224], 0.28);
  const darkBrass = scaleRGB(metalRGB, 0.72);
  const engraveColor = scaleRGB(metalRGB, 0.42);

  const brushed = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      const streak = (kit.noise(y * 0.35 + 2.1, 4.7) - 0.5) * 22;
      for (let x = 0; x < w; x++) {
        const fine = (kit.noise(x * 0.06, y * 0.45 + 11.3) - 0.5) * 14;
        const t = clamp(0.5 + (streak + fine) / 70, 0, 1);
        const c = mixRGB(darkBrass, lightBrass, t);
        const idx = (y * w + x) * 4;
        data[idx] = c[0];
        data[idx + 1] = c[1];
        data[idx + 2] = c[2];
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  brushed.colorSpace = THREE.SRGBColorSpace;
  brushed.wrapS = THREE.RepeatWrapping;
  brushed.wrapT = THREE.RepeatWrapping;

  // Meridian arm texture: u = arc length (0..180 deg), v = perimeter around cross-section
  const meridianMap = kit.canvasTexture(1024, 128, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, rgbCSS(lightBrass));
    grad.addColorStop(0.5, rgbCSS(metalRGB));
    grad.addColorStop(1.0, rgbCSS(darkBrass));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Fine brushed streaks
    ctx.fillStyle = rgbCSS(lightBrass, 0.14);
    for (let i = 0; i < 60; i++) {
      const sy = kit.noise(i * 1.7, 3.3) * h;
      ctx.fillRect(0, sy, w, 1.2);
    }

    // Engraved degree ticks along front & back side bands of the bar
    ctx.strokeStyle = rgbCSS(engraveColor, 0.78);
    const totalDeg = 180;
    for (let d = 5; d <= totalDeg - 5; d += 5) {
      const x = (d / totalDeg) * w;
      const major = d % 15 === 0;
      const len = major ? 16 : 9;
      ctx.lineWidth = major ? 2.2 : 1.3;

      // Side face 1 (around v ~ 0.25) and side face 2 (around v ~ 0.75)
      for (const cy of [h * 0.25, h * 0.75]) {
        ctx.beginPath();
        ctx.moveTo(x, cy - len * 0.5);
        ctx.lineTo(x, cy + len * 0.5);
        ctx.stroke();
      }
    }
  });
  meridianMap.colorSpace = THREE.SRGBColorSpace;
  meridianMap.wrapS = THREE.ClampToEdgeWrapping;
  meridianMap.wrapT = THREE.RepeatWrapping;

  const meridianBump = kit.canvasTexture(1024, 128, (ctx, w, h) => {
    ctx.fillStyle = "#c8c8c8";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#282828";
    for (let d = 5; d <= 175; d += 5) {
      const x = (d / 180) * w;
      const major = d % 15 === 0;
      const len = major ? 16 : 9;
      ctx.lineWidth = major ? 2.4 : 1.4;
      for (const cy of [h * 0.25, h * 0.75]) {
        ctx.beginPath();
        ctx.moveTo(x, cy - len * 0.5);
        ctx.lineTo(x, cy + len * 0.5);
        ctx.stroke();
      }
    }
  });
  meridianBump.wrapS = THREE.ClampToEdgeWrapping;
  meridianBump.wrapT = THREE.RepeatWrapping;

  // Base compass medallion texture
  const compassMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const cream = mixRGB(metalRGB, [252, 244, 224], 0.65);

    ctx.fillStyle = rgbCSS(metalRGB);
    ctx.fillRect(0, 0, w, h);

    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = rgbCSS(cream);
    ctx.fill();

    ctx.strokeStyle = rgbCSS(engraveColor, 0.85);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.45, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.39, 0, Math.PI * 2);
    ctx.stroke();

    // Degree ring ticks
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const r0 = i % 3 === 0 ? w * 0.39 : w * 0.415;
      const r1 = w * 0.45;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }

    // 8-point compass star
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const len = i % 2 === 0 ? w * 0.38 : w * 0.28;
      const sp = 0.19;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a - sp) * w * 0.12, cy + Math.sin(a - sp) * w * 0.12);
      ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      ctx.closePath();
      ctx.fillStyle = rgbCSS(engraveColor, i % 2 === 0 ? 0.85 : 0.45);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      ctx.lineTo(cx + Math.cos(a + sp) * w * 0.12, cy + Math.sin(a + sp) * w * 0.12);
      ctx.closePath();
      ctx.fillStyle = rgbCSS(metalRGB, 0.9);
      ctx.fill();
    }
  });
  compassMap.colorSpace = THREE.SRGBColorSpace;

  return { brushed, meridianMap, meridianBump, compassMap };
}

// Build a continuous sculpted globe sphere with raised continents
function buildSculptedGlobeGeometry(THREE, radius, world) {
  const geo = new THREE.SphereGeometry(radius, 96, 64);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    const phi = u * Math.PI * 2;
    const theta = (1 - v) * Math.PI;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);

    const px = -Math.cos(phi) * sinT;
    const py = cosT;
    const pz = Math.sin(phi) * sinT;

    const { shelf, hills } = world.evaluate(px, py, pz, null);
    // Raised smooth continent relief + gentle interior topography
    const disp = shelf * 0.0024 + hills * 0.0018;
    const r = radius + disp;
    pos.setXYZ(i, px * r, py * r, pz * r);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Build a tapered, beveled brass meridian arc swept ring-by-ring along a smooth curve
function buildMeridianArcGeometry(THREE, armRadius, aStart, aEnd, arcSegments) {
  // 12-point beveled rectangular profile in local (r, z) coordinates
  const ringPts = 13; // 12 segments + seam duplicate
  const positions = [];
  const uvs = [];
  const indices = [];

  const profileTemplate = [
    [1.0, -0.68],
    [1.0, 0.68],
    [0.72, 1.0],
    [-0.72, 1.0],
    [-1.0, 0.68],
    [-1.0, -0.68],
    [-0.72, -1.0],
    [0.72, -1.0]
  ];

  // Subdivide corners softly into 12 perimeter points
  const unitProfile = [];
  for (let i = 0; i < profileTemplate.length; i++) {
    const a = profileTemplate[i];
    const b = profileTemplate[(i + 1) % profileTemplate.length];
    unitProfile.push(a);
    if (i % 2 === 1) {
      unitProfile.push([(a[0] + b[0]) * 0.54, (a[1] + b[1]) * 0.54]);
    }
  }
  // Now 12 points; push first again for UV wrap (13 verts per ring)
  unitProfile.push(unitProfile[0]);

  for (let i = 0; i <= arcSegments; i++) {
    const s = i / arcSegments;
    const ang = lerp(aStart, aEnd, s);
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);

    // Subtle organic cast-brass taper: fuller near bottom saddle and pole eyelets
    const bottomSwell = Math.exp(-Math.pow((ang + Math.PI * 0.5) / 0.34, 2));
    const endBoss =
      Math.exp(-Math.pow(s / 0.055, 2)) + Math.exp(-Math.pow((1 - s) / 0.055, 2));
    const hr = 0.0036 + 0.0014 * bottomSwell + 0.0008 * endBoss;
    const hz = 0.0060 + 0.0018 * bottomSwell + 0.0016 * endBoss;

    const cx = armRadius * ca;
    const cy = armRadius * sa;

    for (let j = 0; j < ringPts; j++) {
      const pr = unitProfile[j][0] * hr;
      const pz = unitProfile[j][1] * hz;
      positions.push(cx + pr * ca, cy + pr * sa, pz);
      uvs.push(s, j / (ringPts - 1));
    }
  }

  for (let i = 0; i < arcSegments; i++) {
    for (let j = 0; j < ringPts - 1; j++) {
      const a00 = i * ringPts + j;
      const a10 = (i + 1) * ringPts + j;
      const a11 = (i + 1) * ringPts + j + 1;
      const a01 = i * ringPts + j + 1;
      indices.push(a00, a10, a11);
      indices.push(a00, a11, a01);
    }
  }

  // Cap start end (outward normal -T)
  const startCenterIdx = positions.length / 3;
  positions.push(armRadius * Math.cos(aStart), armRadius * Math.sin(aStart), 0);
  uvs.push(0, 0.5);
  for (let j = 0; j < ringPts - 1; j++) {
    indices.push(startCenterIdx, j, j + 1);
  }

  // Cap far end (outward normal +T)
  const endCenterIdx = positions.length / 3;
  positions.push(armRadius * Math.cos(aEnd), armRadius * Math.sin(aEnd), 0);
  uvs.push(1, 0.5);
  const lastRingOffset = arcSegments * ringPts;
  for (let j = 0; j < ringPts - 1; j++) {
    indices.push(endCenterIdx, lastRingOffset + j + 1, lastRingOffset + j);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Interpolate radius on a lathe profile along y
function sampleProfileRadius(pts, y) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if ((y >= a[1] && y <= b[1]) || (y <= a[1] && y >= b[1])) {
      const dy = b[1] - a[1];
      if (Math.abs(dy) < 1e-6) return a[0];
      const t = (y - a[1]) / dy;
      return lerp(a[0], b[0], t);
    }
  }
  return pts[pts.length - 1][0];
}

// Build a curved beveled brass cartouche nameplate hugging the wooden base
function buildCurvedNameplateGeometry(THREE, baseProfile, centerY) {
  const shape = new THREE.Shape();
  const hw = 0.0185;
  const hh = 0.0062;

  shape.moveTo(-hw + 0.004, -hh);
  shape.bezierCurveTo(-hw * 0.35, -hh * 1.12, hw * 0.35, -hh * 1.12, hw - 0.004, -hh);
  shape.bezierCurveTo(hw + 0.001, -hh, hw + 0.001, hh, hw - 0.004, hh);
  shape.bezierCurveTo(hw * 0.35, hh * 1.12, -hw * 0.35, hh * 1.12, -hw + 0.004, hh);
  shape.bezierCurveTo(-hw - 0.001, hh, -hw - 0.001, -hh, -hw + 0.004, -hh);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0020,
    bevelEnabled: true,
    bevelThickness: 0.0007,
    bevelSize: 0.0007,
    bevelSegments: 3,
    curveSegments: 20
  });

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const yWorld = centerY + y;
    const baseR = sampleProfileRadius(baseProfile, yWorld);
    const ang = x / baseR;
    const r = baseR + z - 0.0007;
    pos.setXYZ(i, r * Math.sin(ang), yWorld, r * Math.cos(ang));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Build an extruded beveled brass saddle yoke joining stem and meridian arc
function buildSaddleYokeGeometry(THREE) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.015, -0.0065);
  shape.bezierCurveTo(-0.010, -0.0082, 0.010, -0.0082, 0.015, -0.0065);
  shape.bezierCurveTo(0.017, -0.004, 0.017, 0.0045, 0.0135, 0.0065);
  shape.bezierCurveTo(0.007, 0.0078, -0.007, 0.0078, -0.0135, 0.0065);
  shape.bezierCurveTo(-0.017, 0.0045, -0.017, -0.004, -0.015, -0.0065);

  const depth = 0.0172;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.0014,
    bevelSize: 0.0014,
    bevelSegments: 3,
    curveSegments: 16
  });
  geo.translate(0, 0, -depth * 0.5);
  geo.computeVertexNormals();
  return geo;
}

export function build(THREE, opts = {}, kit) {
  const seaHex = opts.sea || "#8fc1e8";
  const landHex = opts.land || "#a8e0c0";
  const metalHex = opts.metal || "#d9c08a";
  const woodHex = opts.wood || "#c89462";

  const seaRGB = parseColorRGB(THREE, seaHex, "#8fc1e8");
  const landRGB = parseColorRGB(THREE, landHex, "#a8e0c0");
  const metalRGB = parseColorRGB(THREE, metalHex, "#d9c08a");
  const woodRGB = parseColorRGB(THREE, woodHex, "#c89462");

  const root = new THREE.Group();
  root.name = "desk_globe";

  // Build world model & textures
  const world = createWorldModel(kit);
  const globeTex = buildGlobeTextures(THREE, kit, world, seaRGB, landRGB, metalRGB);
  const woodTex = buildWoodTextures(THREE, kit, woodRGB);
  const brassTex = buildBrassTextures(THREE, kit, metalRGB);

  // Materials (MeshPhysicalMaterial)
  const globeMat = new THREE.MeshPhysicalMaterial({
    map: globeTex.colorTex,
    roughnessMap: globeTex.roughBumpTex,
    bumpMap: globeTex.roughBumpTex,
    bumpScale: 0.0005,
    roughness: 0.92,
    metalness: 0.02,
    clearcoat: 0.28,
    clearcoatRoughness: 0.34
  });

  const woodMat = new THREE.MeshPhysicalMaterial({
    map: woodTex.map,
    bumpMap: woodTex.bump,
    bumpScale: 0.0008,
    roughness: 0.42,
    metalness: 0.02,
    clearcoat: 0.48,
    clearcoatRoughness: 0.26
  });

  const brassMat = new THREE.MeshPhysicalMaterial({
    map: brassTex.brushed,
    roughness: 0.27,
    metalness: 0.88,
    clearcoat: 0.24,
    clearcoatRoughness: 0.22
  });

  const meridianMat = new THREE.MeshPhysicalMaterial({
    map: brassTex.meridianMap,
    bumpMap: brassTex.meridianBump,
    bumpScale: 0.0007,
    roughness: 0.28,
    metalness: 0.87,
    clearcoat: 0.22,
    clearcoatRoughness: 0.24
  });

  const compassMat = new THREE.MeshPhysicalMaterial({
    map: brassTex.compassMap,
    roughness: 0.34,
    metalness: 0.65,
    clearcoat: 0.4,
    clearcoatRoughness: 0.2
  });

  const feltColor = new THREE.Color(woodHex).multiplyScalar(0.28);
  const feltSheen = new THREE.Color(woodHex).lerp(new THREE.Color(0xffffff), 0.35);
  const feltMat = new THREE.MeshPhysicalMaterial({
    color: feltColor,
    roughness: 0.96,
    metalness: 0.0,
    sheen: 0.85,
    sheenRoughness: 0.78,
    sheenColor: feltSheen
  });

  // --- 1. STAND GROUP (body) ---
  const bodyGroup = new THREE.Group();
  bodyGroup.name = "body";
  root.add(bodyGroup);

  // Cozy recessed felt pad resting on the floor (y = 0)
  const feltGeo = new THREE.CylinderGeometry(0.077, 0.077, 0.0024, 36);
  const feltMesh = new THREE.Mesh(feltGeo, feltMat);
  feltMesh.position.y = 0.0012;
  feltMesh.userData.slot = "fur";
  bodyGroup.add(feltMesh);

  // Turned wooden base (26-point LatheGeometry)
  const baseProfileRaw = [
    [0.000, 0.0020],
    [0.077, 0.0020],
    [0.0785, 0.0004],
    [0.0845, 0.0004],
    [0.0872, 0.0020],
    [0.0882, 0.0048],
    [0.0875, 0.0074],
    [0.0848, 0.0094],
    [0.0815, 0.0108],
    [0.0802, 0.0124],
    [0.0792, 0.0148],
    [0.0772, 0.0178],
    [0.0746, 0.0210],
    [0.0715, 0.0242],
    [0.0678, 0.0272],
    [0.0635, 0.0298],
    [0.0604, 0.0320],
    [0.0598, 0.0338],
    [0.0610, 0.0356],
    [0.0594, 0.0376],
    [0.0552, 0.0398],
    [0.0496, 0.0420],
    [0.0445, 0.0436],
    [0.0392, 0.0442],
    [0.0368, 0.0430],
    [0.000, 0.0428]
  ];
  const basePts = baseProfileRaw.map(([r, y]) => new THREE.Vector2(r, y));
  const baseGeo = new THREE.LatheGeometry(basePts, 52);
  baseGeo.computeVertexNormals();
  const baseMesh = new THREE.Mesh(baseGeo, woodMat);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  baseMesh.userData.slot = "secondary";
  bodyGroup.add(baseMesh);

  // Outer belly subset for exact nameplate curvature sampling
  const bellyProfile = baseProfileRaw.slice(8, 17);

  // Curved brass nameplate on front (+z) of wooden base
  const plaqueCenterY = 0.0205;
  const plaqueGeo = buildCurvedNameplateGeometry(THREE, bellyProfile, plaqueCenterY);
  const plaqueMesh = new THREE.Mesh(plaqueGeo, brassMat);
  plaqueMesh.castShadow = true;
  plaqueMesh.userData.slot = "accent";
  bodyGroup.add(plaqueMesh);

  // Two tiny brass tacks on nameplate
  const tackGeo = new THREE.SphereGeometry(0.0012, 12, 10);
  const tackR = sampleProfileRadius(bellyProfile, plaqueCenterY) + 0.0016;
  for (const side of [-1, 1]) {
    const ang = (side * 0.0138) / tackR;
    const tack = new THREE.Mesh(tackGeo, brassMat);
    tack.position.set(tackR * Math.sin(ang), plaqueCenterY, tackR * Math.cos(ang));
    tack.userData.slot = "accent";
    bodyGroup.add(tack);
  }

  // Inlaid brass compass rose medallion on base top plateau
  const compassGeo = new THREE.CylinderGeometry(0.0365, 0.0372, 0.0018, 40);
  const compassMesh = new THREE.Mesh(compassGeo, compassMat);
  compassMesh.position.y = 0.0435;
  compassMesh.receiveShadow = true;
  compassMesh.userData.slot = "accent";
  bodyGroup.add(compassMesh);

  // Turned brass pedestal stem (24-point LatheGeometry)
  const stemRaw = [
    [0.000, 0.0410],
    [0.0235, 0.0410],
    [0.0235, 0.0446],
    [0.0218, 0.0462],
    [0.0178, 0.0476],
    [0.0188, 0.0496],
    [0.0164, 0.0512],
    [0.0124, 0.0528],
    [0.0094, 0.0554],
    [0.0086, 0.0582],
    [0.0105, 0.0612],
    [0.0145, 0.0644],
    [0.0162, 0.0672],
    [0.0156, 0.0702],
    [0.0128, 0.0730],
    [0.0098, 0.0752],
    [0.0094, 0.0772],
    [0.0114, 0.0788],
    [0.0102, 0.0804],
    [0.0124, 0.0826],
    [0.0140, 0.0852],
    [0.0110, 0.0868],
    [0.000, 0.0868]
  ];
  const stemPts = stemRaw.map(([r, y]) => new THREE.Vector2(r, y));
  const stemGeo = new THREE.LatheGeometry(stemPts, 40);
  stemGeo.computeVertexNormals();
  const stemMesh = new THREE.Mesh(stemGeo, brassMat);
  stemMesh.castShadow = true;
  stemMesh.receiveShadow = true;
  stemMesh.userData.slot = "accent";
  bodyGroup.add(stemMesh);

  // --- 2. CRADLE & CURVED BRASS MERIDIAN ARM ---
  const globeY = 0.214;
  const globeRadius = 0.110;
  const armRadius = 0.128;
  const axialTilt = (23.4 * Math.PI) / 180;

  // Slight cozy yaw (-14 deg) so the meridian arc gives rich three-quarter depth from +z
  const cradleGroup = new THREE.Group();
  cradleGroup.name = "cradle";
  cradleGroup.position.y = globeY;
  cradleGroup.rotation.y = -0.24;
  bodyGroup.add(cradleGroup);

  // Meridian arc sweeping from South Pole through bottom mount up to North Pole
  const aSouth = -Math.PI * 0.5 - axialTilt;
  const aNorth = Math.PI * 0.5 - axialTilt;
  const arcGeo = buildMeridianArcGeometry(THREE, armRadius, aSouth - 0.042, aNorth + 0.042, 76);
  const arcMesh = new THREE.Mesh(arcGeo, meridianMat);
  arcMesh.castShadow = true;
  arcMesh.receiveShadow = true;
  arcMesh.userData.slot = "accent";
  cradleGroup.add(arcMesh);

  // Brass saddle yoke at bottom of meridian arc (joins vertical stem cleanly)
  const yokeGeo = buildSaddleYokeGeometry(THREE);
  const yokeMesh = new THREE.Mesh(yokeGeo, brassMat);
  yokeMesh.position.set(0, -armRadius, 0);
  yokeMesh.castShadow = true;
  yokeMesh.userData.slot = "accent";
  cradleGroup.add(yokeMesh);

  // Two brass mounting rivets on front & back of the saddle yoke
  const rivetGeo = new THREE.SphereGeometry(0.0024, 14, 10);
  for (const side of [-1, 1]) {
    const rivet = new THREE.Mesh(rivetGeo, brassMat);
    rivet.scale.set(1, 1, 0.58);
    rivet.position.set(0, -armRadius, side * 0.0095);
    rivet.userData.slot = "accent";
    cradleGroup.add(rivet);
  }

  // Tilted axial assembly for finials, polar caps, and spinning globe
  const axisGroup = new THREE.Group();
  axisGroup.name = "axis";
  axisGroup.rotation.z = -axialTilt;
  cradleGroup.add(axisGroup);

  // North pole turned brass finial (acorn-style cozy topper)
  const northFinialRaw = [
    [0.000, 0.000],
    [0.0068, 0.000],
    [0.0072, 0.0022],
    [0.0052, 0.0038],
    [0.0040, 0.0052],
    [0.0058, 0.0078],
    [0.0066, 0.0110],
    [0.0054, 0.0144],
    [0.0030, 0.0168],
    [0.0012, 0.0182],
    [0.000, 0.0188]
  ];
  const northFinialGeo = new THREE.LatheGeometry(
    northFinialRaw.map(([r, y]) => new THREE.Vector2(r, y)),
    28
  );
  northFinialGeo.computeVertexNormals();
  const northFinial = new THREE.Mesh(northFinialGeo, brassMat);
  northFinial.position.y = armRadius + 0.0028;
  northFinial.castShadow = true;
  northFinial.userData.slot = "accent";
  axisGroup.add(northFinial);

  // South pole turned brass lock-nut cap
  const southCapRaw = [
    [0.000, 0.000],
    [0.0066, 0.000],
    [0.0068, 0.0026],
    [0.0052, 0.0052],
    [0.0026, 0.0068],
    [0.000, 0.0074]
  ];
  const southCapGeo = new THREE.LatheGeometry(
    southCapRaw.map(([r, y]) => new THREE.Vector2(r, y)),
    24
  );
  southCapGeo.computeVertexNormals();
  const southCap = new THREE.Mesh(southCapGeo, brassMat);
  southCap.position.y = -(armRadius + 0.0026);
  southCap.rotation.z = Math.PI;
  southCap.castShadow = true;
  southCap.userData.slot = "accent";
  axisGroup.add(southCap);

  // Axial brass pins & turned spacer bushings connecting meridian arm to globe poles
  const bushingRaw = [
    [0.0026, 0.000],
    [0.0060, 0.000],
    [0.0060, 0.0026],
    [0.0044, 0.0045],
    [0.0038, 0.0115],
    [0.0052, 0.0135],
    [0.0052, 0.0165],
    [0.0026, 0.0175]
  ];
  const bushingGeo = new THREE.LatheGeometry(
    bushingRaw.map(([r, y]) => new THREE.Vector2(r, y)),
    24
  );
  bushingGeo.computeVertexNormals();

  const northBushing = new THREE.Mesh(bushingGeo, brassMat);
  northBushing.position.y = globeRadius - 0.001;
  northBushing.userData.slot = "accent";
  axisGroup.add(northBushing);

  const southBushing = new THREE.Mesh(bushingGeo, brassMat);
  southBushing.position.y = -(globeRadius - 0.001);
  southBushing.rotation.z = Math.PI;
  southBushing.userData.slot = "accent";
  axisGroup.add(southBushing);

  // --- 3. SPINNING GLOBE GROUP (head) ---
  const globeGroup = new THREE.Group();
  globeGroup.name = "head";
  // Orient Atlantic framed by Americas on left and Europe/Africa on right
  globeGroup.rotation.y = -0.68;
  globeGroup.userData.baseSpin = -0.68;
  axisGroup.add(globeGroup);

  const globeGeo = buildSculptedGlobeGeometry(THREE, globeRadius, world);
  const globeMesh = new THREE.Mesh(globeGeo, globeMat);
  globeMesh.castShadow = true;
  globeMesh.receiveShadow = true;
  globeMesh.userData.slot = "primary";
  globeGroup.add(globeMesh);

  // Flush brass polar medallion caps on North & South poles of the globe
  const polarCapRaw = [
    [0.000, 0.0026],
    [0.010, 0.0022],
    [0.016, 0.0012],
    [0.0185, -0.0012],
    [0.014, -0.0020]
  ];
  const polarCapGeo = new THREE.LatheGeometry(
    polarCapRaw.map(([r, y]) => new THREE.Vector2(r, y)),
    28
  );
  polarCapGeo.computeVertexNormals();

  const northPolarCap = new THREE.Mesh(polarCapGeo, brassMat);
  northPolarCap.position.y = globeRadius - 0.0002;
  northPolarCap.userData.slot = "accent";
  globeGroup.add(northPolarCap);

  const southPolarCap = new THREE.Mesh(polarCapGeo, brassMat);
  southPolarCap.position.y = -(globeRadius + 0.0018);
  southPolarCap.rotation.z = Math.PI;
  southPolarCap.userData.slot = "accent";
  globeGroup.add(southPolarCap);

  return root;
}

export function idle(group, t) {
  const globe = group.getObjectByName("head");
  if (globe) {
    const base = globe.userData.baseSpin ?? -0.68;
    // Gentle cozy showcase rotation around the tilted polar axis
    globe.rotation.y = base + t * 0.22 + Math.sin(t * 0.55) * 0.035;
  }
}
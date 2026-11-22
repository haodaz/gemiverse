export const META = {
  id: "rolling-book-cart",
  name: "Cozy Dorm Rolling Book Cart",
  kind: "prop",
  footprint: [0.72, 0.36],
  variants: [
    {
      name: "Honey Oak & Lavender",
      opts: { wood: "#c89462", metal: "#d9c08a", accent: "#b8a2e3" }
    },
    {
      name: "Warm Walnut & Sage",
      opts: { wood: "#8c5c3c", metal: "#cfa96e", accent: "#90b094" }
    },
    {
      name: "Cream Birch & Dusty Rose",
      opts: { wood: "#d8be98", metal: "#e0c99e", accent: "#d89aa4" }
    }
  ],
  note: "Small rolling wooden book cart with three sloped shelves packed with varied sculpted books, four swiveling brass-and-rubber casters, a hanging yarn tassel, and a tiny dorm plush buddy perched on the top shelf."
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const clean = String(hex || "#c89462").replace("#", "");
  const full =
    clean.length === 3
      ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
      : clean.padEnd(6, "0");
  const n = parseInt(full, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255
  };
}

function rgbToCss(r, g, b, a = 1) {
  const ri = clamp(Math.round(r), 0, 255);
  const gi = clamp(Math.round(g), 0, 255);
  const bi = clamp(Math.round(b), 0, 255);
  return a < 1 ? `rgba(${ri},${gi},${bi},${a})` : `rgb(${ri},${gi},${bi})`;
}

function rgbToHex(r, g, b) {
  const toH = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return `#${toH(r)}${toH(g)}${toH(b)}`;
}

function mixHex(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t
  );
}

function scaleHex(hex, mul) {
  const c = hexToRgb(hex);
  return rgbToHex(c.r * mul, c.g * mul, c.b * mul);
}

function createTaperedTube(THREE, curve, tubularSegs, radialSegs, radiusFn, capped = true) {
  const frames = curve.computeFrenetFrames(tubularSegs, false);
  const positions = [];
  const uvs = [];
  const indices = [];
  const pt = new THREE.Vector3();
  const v = new THREE.Vector3();

  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    curve.getPointAt(t, pt);
    const r = Math.max(0.0002, radiusFn(t));
    const N = frames.normals[i];
    const B = frames.binormals[i];
    for (let j = 0; j <= radialSegs; j++) {
      const u = j / radialSegs;
      const th = u * Math.PI * 2;
      const cos = Math.cos(th);
      const sin = Math.sin(th);
      v.set(
        pt.x + r * (cos * N.x + sin * B.x),
        pt.y + r * (cos * N.y + sin * B.y),
        pt.z + r * (cos * N.z + sin * B.z)
      );
      positions.push(v.x, v.y, v.z);
      uvs.push(u, t);
    }
  }

  const stride = radialSegs + 1;
  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const b = i * stride + (j + 1);
      const c = (i + 1) * stride + (j + 1);
      const d = (i + 1) * stride + j;
      indices.push(a, b, c, a, c, d);
    }
  }

  if (capped) {
    const startCenterIdx = positions.length / 3;
    const p0 = curve.getPointAt(0);
    positions.push(p0.x, p0.y, p0.z);
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(startCenterIdx, j + 1, j);
    }

    const endCenterIdx = positions.length / 3;
    const p1 = curve.getPointAt(1);
    positions.push(p1.x, p1.y, p1.z);
    uvs.push(0.5, 1);
    const base = tubularSegs * stride;
    for (let j = 0; j < radialSegs; j++) {
      indices.push(endCenterIdx, base + j, base + j + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function makeWoodTextures(THREE, kit, woodHex) {
  const base = hexToRgb(woodHex);
  const dark = { r: base.r * 0.66, g: base.g * 0.62, b: base.b * 0.57 };
  const light = {
    r: Math.min(255, base.r * 1.14 + 10),
    g: Math.min(255, base.g * 1.11 + 8),
    b: Math.min(255, base.b * 1.07 + 6)
  };

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = rgbToCss(base.r, base.g, base.b);
    ctx.fillRect(0, 0, w, h);

    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const ny = y / h;
        const warp = kit.noise(nx * 3.5 + 1.2, ny * 1.8 + 0.7) * 0.65;
        const fine = kit.noise(nx * 28.0 + 4.1, ny * 5.0 + 2.3);
        const pore = kit.noise(nx * 90.0 + 7.4, ny * 14.0 + 1.9);
        const ringVal = Math.sin((nx * 19.0 + warp * 5.4) * Math.PI * 2) * 0.5 + 0.5;
        const grain = Math.pow(ringVal, 1.85) * 0.65 + fine * 0.25 + pore * 0.1;
        const t = clamp(grain, 0, 1);

        let r, g, b;
        if (t < 0.5) {
          const k = t * 2;
          r = dark.r + (base.r - dark.r) * k;
          g = dark.g + (base.g - dark.g) * k;
          b = dark.b + (base.b - dark.b) * k;
        } else {
          const k = (t - 0.5) * 2;
          r = base.r + (light.r - base.r) * k;
          g = base.g + (light.g - base.g) * k;
          b = base.b + (light.b - base.b) * k;
        }

        const idx = (y * w + x) * 4;
        data[idx] = clamp(r, 0, 255);
        data[idx + 1] = clamp(g, 0, 255);
        data[idx + 2] = clamp(b, 0, 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Subtle warm satin variation across planks
    for (let i = 0; i < 6; i++) {
      const gx = (i + 0.5) * (w / 6);
      const grad = ctx.createLinearGradient(gx - 42, 0, gx + 42, 0);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(0.5, i % 2 === 0 ? "rgba(255,244,225,0.06)" : "rgba(55,28,10,0.06)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(gx - 42, 0, 84, h);
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bump = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const ny = y / h;
        const warp = kit.noise(nx * 3.5 + 1.2, ny * 1.8 + 0.7) * 0.65;
        const ring = Math.sin((nx * 19.0 + warp * 5.4) * Math.PI * 2) * 0.5 + 0.5;
        const pore = kit.noise(nx * 90.0 + 7.4, ny * 14.0 + 1.9);
        const v = clamp((ring * 0.55 + pore * 0.45) * 255, 0, 255);
        const idx = (y * w + x) * 4;
        data[idx] = v;
        data[idx + 1] = v;
        data[idx + 2] = v;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;

  return { map, bump };
}

function makeBrushedMetalTextures(THREE, kit, metalHex) {
  const c = hexToRgb(metalHex);
  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = rgbToCss(c.r, c.g, c.b);
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const n = kit.noise(1.7, y * 0.42);
      const alpha = 0.04 + n * 0.08;
      ctx.fillStyle = n > 0.5 ? `rgba(255,250,235,${alpha})` : `rgba(60,42,18,${alpha})`;
      ctx.fillRect(0, y, w, 1);
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
      const v = Math.round((0.35 + kit.noise(3.1, y * 0.55) * 0.5) * 255);
      ctx.fillStyle = rgbToCss(v, v, v);
      ctx.fillRect(0, y, w, 1);
    }
  });
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;

  return { map, bump };
}

function makePaperTextures(THREE, kit) {
  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#f2ead8";
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x++) {
      const n = kit.noise(x * 0.45, 2.3);
      const stripe = Math.sin(x * 1.45) * 0.5 + 0.5;
      const shade = 224 + Math.round(n * 18 + stripe * 10);
      ctx.fillStyle = rgbToCss(shade, shade - 7, shade - 22);
      ctx.fillRect(x, 0, 1, h);
    }
    // Slight warm aging at top/bottom edges
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(170,142,102,0.16)");
    grad.addColorStop(0.12, "rgba(170,142,102,0)");
    grad.addColorStop(0.88, "rgba(170,142,102,0)");
    grad.addColorStop(1, "rgba(170,142,102,0.18)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    for (let x = 0; x < w; x++) {
      const v = Math.round((0.35 + (Math.sin(x * 1.45) * 0.5 + 0.5) * 0.4 + kit.noise(x * 0.5, 5.1) * 0.25) * 255);
      ctx.fillStyle = rgbToCss(v, v, v);
      ctx.fillRect(x, 0, 1, h);
    }
  });
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;

  return { map, bump };
}

function makeFabricBump(THREE, kit) {
  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const warp = Math.sin(x * 1.15) * 0.5 + 0.5;
        const weft = Math.sin(y * 1.15) * 0.5 + 0.5;
        const checker = ((Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0) ? warp : weft;
        const n = kit.noise(x * 0.08, y * 0.08);
        const v = clamp((checker * 0.55 + n * 0.45) * 255, 0, 255);
        const idx = (y * w + x) * 4;
        d[idx] = v;
        d[idx + 1] = v;
        d[idx + 2] = v;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(3, 3);
  return bump;
}

function makeBookCoverTexture(THREE, kit, spec) {
  const { primary, secondary, foil, style, vol = 0 } = spec;
  const pRgb = hexToRgb(primary);

  const tex = kit.canvasTexture(256, 512, (ctx, w, h) => {
    // Base book cloth colour
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, w, h);

    // Subtle fabric linen texture & warm paper wear
    for (let y = 0; y < h; y += 2) {
      const n = kit.noise(2.4, y * 0.09);
      ctx.fillStyle = n > 0.5 ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.05)";
      ctx.fillRect(0, y, w, 1);
    }
    for (let x = 0; x < w; x += 2) {
      const n = kit.noise(x * 0.09, 6.2);
      ctx.fillStyle = n > 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.04)";
      ctx.fillRect(x, 0, 1, h);
    }

    // Spine zone u in [0.34, 0.66] -> x in [87, 169]
    const sx = Math.round(w * 0.34);
    const sw = Math.round(w * 0.32);
    const smid = w * 0.5;

    // Slight hinge shading along spine edges
    const hingeL = ctx.createLinearGradient(sx - 8, 0, sx + 10, 0);
    hingeL.addColorStop(0, "rgba(0,0,0,0)");
    hingeL.addColorStop(0.5, "rgba(0,0,0,0.18)");
    hingeL.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = hingeL;
    ctx.fillRect(sx - 8, 0, 18, h);

    const hingeR = ctx.createLinearGradient(sx + sw - 10, 0, sx + sw + 8, 0);
    hingeR.addColorStop(0, "rgba(0,0,0,0)");
    hingeR.addColorStop(0.5, "rgba(0,0,0,0.18)");
    hingeR.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = hingeR;
    ctx.fillRect(sx + sw - 10, 0, 18, h);

    if (style === "classic") {
      // Half-bound accent bands + gilded spine rules
      ctx.fillStyle = secondary;
      ctx.fillRect(sx + 2, 0, sw - 4, h * 0.14);
      ctx.fillRect(sx + 2, h * 0.86, sw - 4, h * 0.14);

      ctx.fillStyle = foil;
      const bands = [0.14, 0.16, 0.34, 0.68, 0.84, 0.86];
      for (const b of bands) {
        ctx.fillRect(sx + 5, h * b, sw - 10, 4);
      }
      // Title box & faux gilded lines
      ctx.strokeStyle = foil;
      ctx.lineWidth = 3;
      ctx.strokeRect(sx + 10, h * 0.19, sw - 20, h * 0.12);
      ctx.fillStyle = foil;
      ctx.fillRect(sx + 18, h * 0.225, sw - 36, 5);
      ctx.fillRect(sx + 22, h * 0.255, sw - 44, 4);
      ctx.fillRect(sx + 26, h * 0.28, sw - 52, 3);

      // Ornamental diamond emblem
      ctx.beginPath();
      ctx.moveTo(smid, h * 0.47);
      ctx.lineTo(smid + 14, h * 0.51);
      ctx.lineTo(smid, h * 0.55);
      ctx.lineTo(smid - 14, h * 0.51);
      ctx.closePath();
      ctx.fill();
    } else if (style === "label") {
      // Cozy cream paper label pasted onto cloth spine
      ctx.fillStyle = "#f4ecdc";
      ctx.fillRect(sx + 8, h * 0.17, sw - 16, h * 0.23);
      ctx.strokeStyle = secondary;
      ctx.lineWidth = 3;
      ctx.strokeRect(sx + 12, h * 0.185, sw - 24, h * 0.20);

      // Printed title bars on label
      ctx.fillStyle = "#4b3e35";
      ctx.fillRect(sx + 18, h * 0.23, sw - 36, 6);
      ctx.fillRect(sx + 22, h * 0.265, sw - 44, 5);
      ctx.fillRect(sx + 25, h * 0.30, sw - 50, 4);
      ctx.fillStyle = secondary;
      ctx.fillRect(sx + 20, h * 0.34, sw - 40, 3);

      // Small publisher dot near bottom
      ctx.fillStyle = "#f4ecdc";
      ctx.beginPath();
      ctx.arc(smid, h * 0.84, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.arc(smid, h * 0.84, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (style === "celestial") {
      // Dorm aesthetic moon & botanical sparkles
      ctx.fillStyle = foil;
      // Crescent moon on spine
      ctx.beginPath();
      ctx.arc(smid, h * 0.25, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = primary;
      ctx.beginPath();
      ctx.arc(smid + 7, h * 0.235, 13, 0, Math.PI * 2);
      ctx.fill();

      // Tiny stars & vertical title rule
      ctx.fillStyle = foil;
      const stars = [
        [smid - 14, h * 0.17, 3.5],
        [smid + 14, h * 0.31, 3.0],
        [smid, h * 0.78, 4.5],
        [smid - 10, h * 0.83, 2.5],
        [smid + 11, h * 0.82, 2.5]
      ];
      for (const [cx, cy, r] of stars) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillRect(smid - 2, h * 0.38, 4, h * 0.30);
      ctx.fillRect(smid - 9, h * 0.42, 3, h * 0.22);
      ctx.fillRect(smid + 6, h * 0.45, 3, h * 0.16);
    } else if (style === "colorblock") {
      // Modern dorm paperback two-tone colour block
      ctx.fillStyle = secondary;
      ctx.fillRect(0, h * 0.58, w, h * 0.42);
      ctx.fillStyle = foil;
      ctx.fillRect(0, h * 0.56, w, h * 0.025);

      ctx.fillStyle = "#faf5ea";
      ctx.fillRect(sx + 14, h * 0.16, sw - 28, 9);
      ctx.fillRect(sx + 20, h * 0.20, sw - 40, 6);
      ctx.fillRect(sx + 16, h * 0.24, sw - 32, 6);

      ctx.fillStyle = primary;
      ctx.fillRect(sx + 18, h * 0.74, sw - 36, 7);
      ctx.fillRect(sx + 24, h * 0.78, sw - 48, 5);
    } else if (style === "volume") {
      // Matching 3-volume clothbound anthology series
      ctx.fillStyle = secondary;
      ctx.fillRect(sx, h * 0.14, sw, h * 0.24);
      ctx.fillStyle = foil;
      ctx.fillRect(sx + 4, h * 0.14, sw - 8, 4);
      ctx.fillRect(sx + 4, h * 0.38, sw - 8, 4);
      ctx.fillRect(sx + 4, h * 0.72, sw - 8, 4);
      ctx.fillRect(sx + 4, h * 0.85, sw - 8, 4);

      ctx.fillStyle = "#faf3e6";
      ctx.fillRect(sx + 16, h * 0.21, sw - 32, 6);
      ctx.fillRect(sx + 22, h * 0.255, sw - 44, 5);
      ctx.fillRect(sx + 18, h * 0.30, sw - 36, 4);

      // Roman numeral volume marks (I, II, III)
      const count = clamp(vol || 1, 1, 3);
      const spacing = 12;
      const startX = smid - ((count - 1) * spacing) / 2;
      ctx.fillStyle = foil;
      for (let i = 0; i < count; i++) {
        ctx.fillRect(startX + i * spacing - 2.5, h * 0.755, 5, h * 0.06);
      }
      ctx.fillRect(startX - 8, h * 0.752, (count - 1) * spacing + 16, 3);
      ctx.fillRect(startX - 8, h * 0.815, (count - 1) * spacing + 16, 3);
    } else {
      // Cozy plaid / striped dorm journal
      ctx.fillStyle = secondary;
      for (let y = 0; y < h; y += 36) {
        ctx.fillRect(0, y, w, 10);
      }
      ctx.fillStyle = "rgba(255,250,240,0.22)";
      for (let x = 0; x < w; x += 28) {
        ctx.fillRect(x, 0, 7, h);
      }
      // Clean cream spine band
      ctx.fillStyle = "#f5efe2";
      ctx.fillRect(sx + 8, h * 0.24, sw - 16, h * 0.18);
      ctx.fillStyle = rgbToCss(pRgb.r * 0.65, pRgb.g * 0.65, pRgb.b * 0.65);
      ctx.fillRect(sx + 18, h * 0.30, sw - 36, 6);
      ctx.fillRect(sx + 22, h * 0.34, sw - 44, 5);
    }

    // Subtle soft darkening at top & bottom worn spine edges
    const edgeGrad = ctx.createLinearGradient(0, 0, 0, h);
    edgeGrad.addColorStop(0, "rgba(25,15,8,0.16)");
    edgeGrad.addColorStop(0.05, "rgba(25,15,8,0)");
    edgeGrad.addColorStop(0.95, "rgba(25,15,8,0)");
    edgeGrad.addColorStop(1, "rgba(25,15,8,0.18)");
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, 0, w, h);
  });

  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePlushTexture(THREE, kit, furHex, bellyHex) {
  const topC = hexToRgb(furHex);
  const belC = hexToRgb(bellyHex);
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, rgbToCss(topC.r * 0.94, topC.g * 0.93, topC.b * 0.92));
    grad.addColorStop(0.55, rgbToCss(topC.r, topC.g, topC.b));
    grad.addColorStop(1, rgbToCss(belC.r, belC.g, belC.b));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Cozy fleece flecks
    for (let i = 0; i < 900; i++) {
      const fx = ((i * 73) % w);
      const fy = ((i * 137) % h);
      const n = kit.noise(fx * 0.08, fy * 0.08);
      ctx.fillStyle = n > 0.5 ? "rgba(255,252,246,0.12)" : "rgba(110,92,80,0.08)";
      ctx.fillRect(fx, fy, 3, 2);
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds a watertight sculpted hardcover book wrap with rounded +Z spine,
 * French hinge grooves, beveled top/bottom board edges, and distortion-free spine UVs.
 * Local origin: bottom-center of book (y in [0, h], x in [-w/2, +w/2], z in [-d/2, +d/2 + bulge]).
 */
function createHardcoverShellGeometry(THREE, w, h, d, isPaperback = false) {
  const hw = w * 0.5;
  const hd = d * 0.5;
  const boardT = isPaperback ? Math.min(0.0012, w * 0.08) : Math.min(0.0024, w * 0.11);
  const bulge = isPaperback ? Math.min(0.0024, w * 0.12) : Math.min(0.0056, w * 0.24);
  const hingeDepth = isPaperback ? 0.0 : Math.min(0.0012, w * 0.04);

  // Outer path from back board fore-edge (-hw, -hd) -> around +Z rounded spine -> front board fore-edge (+hw, -hd)
  const outer = [];
  outer.push({ x: -hw, z: -hd, u: 0.0 });
  outer.push({ x: -hw, z: hd - 0.012, u: 0.28 });
  outer.push({ x: -hw + hingeDepth, z: hd - 0.006, u: 0.32 });
  outer.push({ x: -hw, z: hd - 0.001, u: 0.34 });

  const spineSegs = 8;
  for (let i = 1; i < spineSegs; i++) {
    const f = i / spineSegs;
    const ang = Math.PI * (1 - f);
    const sx = Math.cos(ang) * hw;
    const sz = hd + Math.sin(ang) * bulge;
    outer.push({ x: sx, z: sz, u: 0.34 + f * 0.32 });
  }

  outer.push({ x: hw, z: hd - 0.001, u: 0.66 });
  outer.push({ x: hw - hingeDepth, z: hd - 0.006, u: 0.68 });
  outer.push({ x: hw, z: hd - 0.012, u: 0.72 });
  outer.push({ x: hw, z: -hd, u: 1.0 });

  // Matching inner wall offset inward by boardT
  const inner = outer.map((p, idx) => {
    const last = outer.length - 1;
    const prev = outer[Math.max(0, idx - 1)];
    const next = outer[Math.min(last, idx + 1)];
    let tx = next.x - prev.x;
    let tz = next.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;
    // Outer normal for path going (-x,-z) -> (+z) -> (+x,-z) is (-tz, +tx)
    // Wait: test at spine (tx=+1, tz=0): outward is (0,+1), so inward is (0,-1) = (tz, -tx)
    // Test at left board (tx=0, tz=+1): outward is (-1,0), so inward is (+1,0) = (tz, -tx)
    // Test at right board (tx=0, tz=-1): outward is (+1,0), so inward is (-1,0) = (tz, -tx)
    const inX = tz;
    const inZ = -tx;
    return {
      x: p.x + inX * boardT,
      z: p.z + inZ * boardT,
      u: p.u
    };
  });

  const N = outer.length;
  const positions = [];
  const uvs = [];
  const indices = [];

  const yLevels = [
    { y: 0.0, inset: 0.0005, v: 0.0 },
    { y: 0.0012, inset: 0.0, v: 0.01 },
    { y: h - 0.0012, inset: 0.0, v: 0.99 },
    { y: h, inset: 0.0005, v: 1.0 }
  ];

  // Outer surface vertices (4 y-rings x N)
  const outerBase = 0;
  for (let r = 0; r < yLevels.length; r++) {
    const { y, inset, v } = yLevels[r];
    for (let i = 0; i < N; i++) {
      const p = outer[i];
      const pin = inner[i];
      const ox = p.x + (pin.x - p.x) * (inset / Math.max(boardT, 0.0005));
      const oz = p.z + (pin.z - p.z) * (inset / Math.max(boardT, 0.0005));
      positions.push(ox, y, oz);
      uvs.push(p.u, v);
    }
  }

  for (let r = 0; r < yLevels.length - 1; r++) {
    for (let i = 0; i < N - 1; i++) {
      const a = outerBase + r * N + i;
      const b = outerBase + r * N + (i + 1);
      const c = outerBase + (r + 1) * N + (i + 1);
      const dIdx = outerBase + (r + 1) * N + i;
      indices.push(a, b, c, a, c, dIdx);
    }
  }

  // Inner surface vertices (2 y-rings x N)
  const innerBase = positions.length / 3;
  const innerYs = [0, h];
  for (let r = 0; r < 2; r++) {
    const y = innerYs[r];
    for (let i = 0; i < N; i++) {
      positions.push(inner[i].x, y, inner[i].z);
      uvs.push(inner[i].u, r);
    }
  }
  for (let i = 0; i < N - 1; i++) {
    const a = innerBase + i;
    const b = innerBase + (i + 1);
    const c = innerBase + N + (i + 1);
    const dIdx = innerBase + N + i;
    // Reversed winding so normals face inward toward page block
    indices.push(a, c, b, a, dIdx, c);
  }

  // Top & bottom board edge caps
  const topOut = outerBase + (yLevels.length - 1) * N;
  const topIn = innerBase + N;
  for (let i = 0; i < N - 1; i++) {
    indices.push(
      topOut + i,
      topOut + i + 1,
      topIn + i + 1,
      topOut + i,
      topIn + i + 1,
      topIn + i
    );
  }

  const botOut = outerBase;
  const botIn = innerBase;
  for (let i = 0; i < N - 1; i++) {
    indices.push(
      botOut + i,
      botIn + i + 1,
      botOut + i + 1,
      botOut + i,
      botIn + i,
      botIn + i + 1
    );
  }

  // Fore-edge caps at i = 0 (left board) and i = N - 1 (right board)
  const addQuad = (p0, p1, p2, p3) => {
    const s = positions.length / 3;
    positions.push(
      p0[0], p0[1], p0[2],
      p1[0], p1[1], p1[2],
      p2[0], p2[1], p2[2],
      p3[0], p3[1], p3[2]
    );
    uvs.push(0.02, 0, 0.04, 0, 0.04, 1, 0.02, 1);
    indices.push(s, s + 1, s + 2, s, s + 2, s + 3);
  };

  // Left board fore-edge (-Z facing)
  addQuad(
    [inner[0].x, 0, inner[0].z],
    [outer[0].x, 0, outer[0].z],
    [outer[0].x, h, outer[0].z],
    [inner[0].x, h, inner[0].z]
  );
  // Right board fore-edge (-Z facing)
  addQuad(
    [outer[N - 1].x, 0, outer[N - 1].z],
    [inner[N - 1].x, 0, inner[N - 1].z],
    [inner[N - 1].x, h, inner[N - 1].z],
    [outer[N - 1].x, h, outer[N - 1].z]
  );

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Recessed cream page-block with subtly concave fore-edge and page-aligned UVs.
 */
function createPageBlockGeometry(THREE, w, h, d, isPaperback = false) {
  const boardT = isPaperback ? Math.min(0.0012, w * 0.08) : Math.min(0.0025, w * 0.115);
  const overhangY = isPaperback ? 0.0004 : 0.0034;
  const overhangZ = isPaperback ? 0.0005 : 0.0036;

  const pw = Math.max(0.004, w - boardT * 2.05);
  const ph = Math.max(0.02, h - overhangY * 2);
  const pd = Math.max(0.04, d - overhangZ);
  const y0 = overhangY;
  const zBack = -d * 0.5 + overhangZ;
  const zFront = d * 0.5 - boardT * 0.5;
  const concave = isPaperback ? 0.0008 : Math.min(0.0028, pw * 0.1);

  const segX = 6;
  const positions = [];
  const uvs = [];
  const indices = [];
  const uScale = pw / 0.028;

  // Helper to push a quad with crisp flat/curved normals
  const pushFace = (verts, uvList) => {
    const base = positions.length / 3;
    for (let i = 0; i < 4; i++) {
      positions.push(verts[i][0], verts[i][1], verts[i][2]);
      uvs.push(uvList[i][0], uvList[i][1]);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  for (let i = 0; i < segX; i++) {
    const f0 = i / segX;
    const f1 = (i + 1) / segX;
    const x0 = -pw * 0.5 + f0 * pw;
    const x1 = -pw * 0.5 + f1 * pw;
    const c0 = Math.sin(f0 * Math.PI) * concave;
    const c1 = Math.sin(f1 * Math.PI) * concave;
    const zb0 = zBack + c0;
    const zb1 = zBack + c1;
    const u0 = f0 * uScale;
    const u1 = f1 * uScale;

    // Top page edge (+Y)
    pushFace(
      [
        [x0, y0 + ph, zb0],
        [x0, y0 + ph, zFront],
        [x1, y0 + ph, zFront],
        [x1, y0 + ph, zb1]
      ],
      [
        [u0, 0],
        [u0, 1],
        [u1, 1],
        [u1, 0]
      ]
    );
    // Bottom page edge (-Y)
    pushFace(
      [
        [x0, y0, zFront],
        [x0, y0, zb0],
        [x1, y0, zb1],
        [x1, y0, zFront]
      ],
      [
        [u0, 1],
        [u0, 0],
        [u1, 0],
        [u1, 1]
      ]
    );
    // Concave fore-edge (-Z)
    pushFace(
      [
        [x1, y0, zb1],
        [x0, y0, zb0],
        [x0, y0 + ph, zb0],
        [x1, y0 + ph, zb1]
      ],
      [
        [u1, 0],
        [u0, 0],
        [u0, 1],
        [u1, 1]
      ]
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildBook(THREE, spec, materials) {
  const { w, h, d, coverMat, isPaperback, hasRibs, hasElastic, hasBookmark, hasTabs, accentMat, foilMat, paperMat } = spec;
  const group = new THREE.Group();

  const coverGeo = createHardcoverShellGeometry(THREE, w, h, d, isPaperback);
  const coverMesh = new THREE.Mesh(coverGeo, coverMat);
  coverMesh.castShadow = true;
  coverMesh.receiveShadow = true;
  if (spec.slot) coverMesh.userData.slot = spec.slot;
  group.add(coverMesh);

  const pageGeo = createPageBlockGeometry(THREE, w, h, d, isPaperback);
  const pageMesh = new THREE.Mesh(pageGeo, paperMat);
  pageMesh.castShadow = true;
  pageMesh.receiveShadow = true;
  group.add(pageMesh);

  // Woven decorative headband tucked at top of hardcover spine
  if (!isPaperback && w >= 0.018) {
    const hbGeo = new THREE.CylinderGeometry(w * 0.34, w * 0.34, 0.0028, 12, 1, false, -Math.PI * 0.45, Math.PI * 0.9);
    const hbMesh = new THREE.Mesh(hbGeo, accentMat);
    hbMesh.position.set(0, h - 0.0032, d * 0.5 - 0.001);
    hbMesh.rotation.y = Math.PI * 0.5;
    group.add(hbMesh);
  }

  // Raised vintage spine ribs on select hardcovers
  if (hasRibs && !isPaperback) {
    const bulge = Math.min(0.0056, w * 0.24);
    const hw = w * 0.49;
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const f = i / 6;
      const ang = Math.PI * (1 - f);
      pts.push(new THREE.Vector3(Math.cos(ang) * hw, 0, d * 0.5 + Math.sin(ang) * (bulge + 0.0005)));
    }
    const ribCurve = new THREE.CatmullRomCurve3(pts);
    const ribGeo = createTaperedTube(THREE, ribCurve, 10, 6, (t) => 0.0013 * (0.55 + 0.45 * Math.sin(t * Math.PI)), true);
    const ys = [h * 0.18, h * 0.37, h * 0.65, h * 0.83];
    for (const ry of ys) {
      const rib = new THREE.Mesh(ribGeo, coverMat);
      rib.position.y = ry;
      group.add(rib);
    }
  }

  // Cozy elastic band around sketchbook/journal
  if (hasElastic) {
    const bandGeo = new THREE.BoxGeometry(w + 0.0018, h + 0.0022, 0.0075);
    const band = new THREE.Mesh(bandGeo, accentMat);
    band.position.set(0, h * 0.5, -d * 0.5 + 0.022);
    band.userData.slot = "accent";
    group.add(band);
  }

  // Gently curving woven ribbon bookmark draping out the top & down the spine
  if (hasBookmark) {
    const bmCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.001, h - 0.018, d * 0.5 - 0.012),
      new THREE.Vector3(0.002, h + 0.007, d * 0.5 + 0.004),
      new THREE.Vector3(0.005, h - 0.016, d * 0.5 + 0.013),
      new THREE.Vector3(0.001, h - 0.048, d * 0.5 + 0.011),
      new THREE.Vector3(-0.002, h - 0.072, d * 0.5 + 0.016)
    ]);
    const bmGeo = createTaperedTube(THREE, bmCurve, 18, 6, (t) => 0.0024 * (1 - 0.15 * t), true);
    bmGeo.scale(1.35, 1.0, 0.35);
    bmGeo.computeVertexNormals();
    const bm = new THREE.Mesh(bmGeo, accentMat);
    bm.userData.slot = "accent";
    group.add(bm);
  }

  // Tiny pastel dorm study sticky-note page tabs peeking out the top
  if (hasTabs) {
    const tabColors = ["#f3d58d", "#e4a3b1", "#a3d3c0"];
    for (let t = 0; t < 3; t++) {
      const tabShape = new THREE.Shape();
      tabShape.moveTo(0, 0);
      tabShape.lineTo(0.014, 0);
      tabShape.quadraticCurveTo(0.016, 0.005, 0.014, 0.010);
      tabShape.lineTo(0, 0.010);
      tabShape.closePath();
      const tabGeo = new THREE.ExtrudeGeometry(tabShape, { depth: 0.0008, bevelEnabled: false });
      const tabMat = new THREE.MeshPhysicalMaterial({
        color: tabColors[t % tabColors.length],
        roughness: 0.85,
        sheen: 0.25
      });
      const tab = new THREE.Mesh(tabGeo, tabMat);
      tab.position.set(-w * 0.24 + t * (w * 0.22), h - 0.004, -d * 0.18 + t * 0.032);
      tab.rotation.y = Math.PI * 0.5;
      tab.rotation.z = 0.08 * (t - 1);
      group.add(tab);
    }
  }

  return group;
}

/**
 * Sculpted wooden side panel with gentle arch crest and two rounded viewing cutouts
 * placed strictly in the open bays between the sloped shelves.
 */
function buildSidePanel(THREE, woodMat) {
  // Drawn in 2D: X = cart Z (-0.165..+0.165), Y = cart Y (0.082..0.778)
  const s = new THREE.Shape();
  s.moveTo(-0.164, 0.082);
  s.lineTo(0.164, 0.082);
  s.bezierCurveTo(0.166, 0.28, 0.156, 0.56, 0.146, 0.742);
  s.bezierCurveTo(0.142, 0.768, 0.118, 0.778, 0.0, 0.782);
  s.bezierCurveTo(-0.118, 0.778, -0.142, 0.768, -0.146, 0.742);
  s.bezierCurveTo(-0.156, 0.56, -0.166, 0.28, -0.164, 0.082);

  // Two clean pill-shaped architectural cutouts between shelf boards
  const addPillHole = (zMin, zMax, yMin, yMax, r) => {
    const h = new THREE.Path();
    h.moveTo(zMin + r, yMin);
    h.lineTo(zMax - r, yMin);
    h.quadraticCurveTo(zMax, yMin, zMax, yMin + r);
    h.lineTo(zMax, yMax - r);
    h.quadraticCurveTo(zMax, yMax, zMax - r, yMax);
    h.lineTo(zMin + r, yMax);
    h.quadraticCurveTo(zMin, yMax, zMin, yMax - r);
    h.lineTo(zMin, yMin + r);
    h.quadraticCurveTo(zMin, yMin, zMin + r, yMin);
    s.holes.push(h);
  };

  addPillHole(-0.056, 0.068, 0.232, 0.348, 0.024);
  addPillHole(-0.054, 0.066, 0.482, 0.598, 0.024);

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.015,
    bevelEnabled: true,
    bevelThickness: 0.0028,
    bevelSize: 0.0028,
    bevelSegments: 4,
    curveSegments: 24
  });

  // Center thickness on Z, then rotate so thickness is along X and 2D X becomes cart Z
  geo.translate(0, 0, -0.0075);
  geo.rotateY(-Math.PI * 0.5);

  // Clean metre-scaled UVs so vertical oak grain runs naturally along Y
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getZ(i) * 2.2 + 0.5, pos.getY(i) * 1.4);
  }
  uv.needsUpdate = true;
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, woodMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.slot = "wood";
  return mesh;
}

/**
 * Builds one swiveling caster wheel grounded accurately at local y = 0.000
 * with top mounting plate meeting the cart base at y = 0.082.
 */
function buildCaster(THREE, metalMat, rubberMat, swivelAngle) {
  const group = new THREE.Group();

  // 1. Beveled brass top mounting plate (y = 0.076 .. 0.083)
  const plateShape = new THREE.Shape();
  const pw = 0.024;
  const pr = 0.005;
  plateShape.moveTo(-pw + pr, -pw);
  plateShape.lineTo(pw - pr, -pw);
  plateShape.quadraticCurveTo(pw, -pw, pw, -pw + pr);
  plateShape.lineTo(pw, pw - pr);
  plateShape.quadraticCurveTo(pw, pw, pw - pr, pw);
  plateShape.lineTo(-pw + pr, pw);
  plateShape.quadraticCurveTo(-pw, pw, -pw, pw - pr);
  plateShape.lineTo(-pw, -pw + pr);
  plateShape.quadraticCurveTo(-pw, -pw, -pw + pr, -pw);

  const plateGeo = new THREE.ExtrudeGeometry(plateShape, {
    depth: 0.004,
    bevelEnabled: true,
    bevelThickness: 0.0012,
    bevelSize: 0.0012,
    bevelSegments: 2
  });
  plateGeo.rotateX(Math.PI * 0.5);
  const plate = new THREE.Mesh(plateGeo, metalMat);
  plate.position.y = 0.0815;
  plate.castShadow = true;
  plate.userData.slot = "metal";
  group.add(plate);

  // 4 tiny screw heads on the plate corners
  const screwGeo = new THREE.SphereGeometry(0.0022, 10, 8);
  for (const sx of [-0.016, 0.016]) {
    for (const sz of [-0.016, 0.016]) {
      const sc = new THREE.Mesh(screwGeo, metalMat);
      sc.scale.set(1, 0.5, 1);
      sc.position.set(sx, 0.0765, sz);
      sc.userData.slot = "metal";
      group.add(sc);
    }
  }

  // 2. Turned brass swivel bearing housing (LatheGeometry >= 16 points)
  const stemPts = [
    new THREE.Vector2(0.0, 0.056),
    new THREE.Vector2(0.010, 0.056),
    new THREE.Vector2(0.0135, 0.0575),
    new THREE.Vector2(0.0145, 0.060),
    new THREE.Vector2(0.013, 0.062),
    new THREE.Vector2(0.0115, 0.0635),
    new THREE.Vector2(0.0155, 0.065),
    new THREE.Vector2(0.0165, 0.067),
    new THREE.Vector2(0.0165, 0.069),
    new THREE.Vector2(0.015, 0.0705),
    new THREE.Vector2(0.0125, 0.0715),
    new THREE.Vector2(0.0145, 0.073),
    new THREE.Vector2(0.0165, 0.0745),
    new THREE.Vector2(0.0175, 0.076),
    new THREE.Vector2(0.0175, 0.0775),
    new THREE.Vector2(0.0, 0.0775)
  ];
  const stemGeo = new THREE.LatheGeometry(stemPts, 20);
  const stem = new THREE.Mesh(stemGeo, metalMat);
  stem.castShadow = true;
  stem.userData.slot = "metal";
  group.add(stem);

  // 3. Swiveling fork + wheel sub-group
  const swivel = new THREE.Group();
  swivel.rotation.y = swivelAngle;
  group.add(swivel);

  const trail = -0.0145;
  const wheelY = 0.027;

  // Curved brass fork arms (ExtrudeGeometry with bezierCurveTo)
  const forkShape = new THREE.Shape();
  forkShape.moveTo(0.008, 0.060);
  forkShape.bezierCurveTo(0.006, 0.049, trail + 0.009, 0.041, trail + 0.0065, wheelY);
  forkShape.bezierCurveTo(trail + 0.0065, wheelY - 0.0065, trail - 0.0065, wheelY - 0.0065, trail - 0.0065, wheelY);
  forkShape.bezierCurveTo(trail - 0.008, 0.044, -0.010, 0.052, -0.011, 0.060);
  forkShape.closePath();

  const forkGeo = new THREE.ExtrudeGeometry(forkShape, {
    depth: 0.0028,
    bevelEnabled: true,
    bevelThickness: 0.0008,
    bevelSize: 0.0008,
    bevelSegments: 2,
    curveSegments: 16
  });
  forkGeo.translate(0, 0, -0.0014);
  forkGeo.rotateY(-Math.PI * 0.5);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(forkGeo, metalMat);
    arm.position.x = side * 0.0125;
    arm.castShadow = true;
    arm.userData.slot = "metal";
    swivel.add(arm);
  }

  // Fork yoke bridge connecting both arms cleanly under swivel stem
  const yokeGeo = new THREE.CylinderGeometry(0.0125, 0.0135, 0.006, 16);
  const yoke = new THREE.Mesh(yokeGeo, metalMat);
  yoke.position.set(-0.002, 0.0585, 0);
  yoke.userData.slot = "metal";
  swivel.add(yoke);

  // 4. Turned soft-rubber caster tire (LatheGeometry, 20 points, max radius = 0.027 -> touches y = 0.000!)
  const tirePts = [
    new THREE.Vector2(0.0155, -0.0085),
    new THREE.Vector2(0.0175, -0.0085),
    new THREE.Vector2(0.019, -0.0078),
    new THREE.Vector2(0.0215, -0.0082),
    new THREE.Vector2(0.0245, -0.0080),
    new THREE.Vector2(0.0262, -0.0064),
    new THREE.Vector2(0.0268, -0.0038),
    new THREE.Vector2(0.0270, -0.0012),
    new THREE.Vector2(0.0270, 0.0012),
    new THREE.Vector2(0.0268, 0.0038),
    new THREE.Vector2(0.0262, 0.0064),
    new THREE.Vector2(0.0245, 0.0080),
    new THREE.Vector2(0.0215, 0.0082),
    new THREE.Vector2(0.019, 0.0078),
    new THREE.Vector2(0.0175, 0.0085),
    new THREE.Vector2(0.0155, 0.0085)
  ];
  const tireGeo = new THREE.LatheGeometry(tirePts, 24);
  tireGeo.rotateZ(Math.PI * 0.5);
  const tire = new THREE.Mesh(tireGeo, rubberMat);
  tire.position.set(0, wheelY, trail);
  tire.castShadow = true;
  tire.receiveShadow = true;
  swivel.add(tire);

  // 5. Turned brass wheel hub + rim (LatheGeometry, 18 points)
  const hubPts = [
    new THREE.Vector2(0.0, -0.0155),
    new THREE.Vector2(0.0042, -0.0155),
    new THREE.Vector2(0.0052, -0.0145),
    new THREE.Vector2(0.0052, -0.0105),
    new THREE.Vector2(0.0085, -0.0092),
    new THREE.Vector2(0.0125, -0.0072),
    new THREE.Vector2(0.0152, -0.0086),
    new THREE.Vector2(0.0162, -0.0082),
    new THREE.Vector2(0.0162, 0.0082),
    new THREE.Vector2(0.0152, 0.0086),
    new THREE.Vector2(0.0125, 0.0072),
    new THREE.Vector2(0.0085, 0.0092),
    new THREE.Vector2(0.0052, 0.0105),
    new THREE.Vector2(0.0052, 0.0145),
    new THREE.Vector2(0.0042, 0.0155),
    new THREE.Vector2(0.0, 0.0155)
  ];
  const hubGeo = new THREE.LatheGeometry(hubPts, 20);
  hubGeo.rotateZ(Math.PI * 0.5);
  const hub = new THREE.Mesh(hubGeo, metalMat);
  hub.position.set(0, wheelY, trail);
  hub.castShadow = true;
  hub.userData.slot = "metal";
  swivel.add(hub);

  return group;
}

/**
 * Arched brass push handle with turned mounting ferrules (LatheGeometry >= 16 points).
 */
function buildBrassHandle(THREE, metalMat, side) {
  const group = new THREE.Group();
  const baseX = side * 0.312;
  const archOutX = side * 0.344;

  // Handle tube sweeping smoothly up from side panel arch
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(baseX, 0.768, -0.088),
    new THREE.Vector3(baseX + side * 0.008, 0.818, -0.086),
    new THREE.Vector3(archOutX, 0.866, -0.056),
    new THREE.Vector3(archOutX, 0.878, 0.0),
    new THREE.Vector3(archOutX, 0.866, 0.056),
    new THREE.Vector3(baseX + side * 0.008, 0.818, 0.086),
    new THREE.Vector3(baseX, 0.768, 0.088)
  ]);

  const tubeGeo = createTaperedTube(
    THREE,
    curve,
    36,
    14,
    (t) => {
      // Gentle ergonomic swell along top grip, subtle flare at base collars
      const endFlare = Math.exp(-t * 14) + Math.exp(-(1 - t) * 14);
      const gripSwell = Math.sin(t * Math.PI) * 0.0014;
      return 0.0068 + gripSwell + endFlare * 0.0018;
    },
    true
  );
  const tube = new THREE.Mesh(tubeGeo, metalMat);
  tube.castShadow = true;
  tube.userData.slot = "metal";
  group.add(tube);

  // Turned brass ferrules where handle meets wood
  const ferrulePts = [
    new THREE.Vector2(0.005, 0.0),
    new THREE.Vector2(0.0115, 0.0),
    new THREE.Vector2(0.0118, 0.0022),
    new THREE.Vector2(0.0102, 0.0038),
    new THREE.Vector2(0.0110, 0.0052),
    new THREE.Vector2(0.0108, 0.0068),
    new THREE.Vector2(0.0094, 0.0085),
    new THREE.Vector2(0.0088, 0.0105),
    new THREE.Vector2(0.0096, 0.0122),
    new THREE.Vector2(0.0094, 0.0138),
    new THREE.Vector2(0.0082, 0.0155),
    new THREE.Vector2(0.0076, 0.0172),
    new THREE.Vector2(0.0082, 0.0185),
    new THREE.Vector2(0.0075, 0.020),
    new THREE.Vector2(0.0068, 0.021),
    new THREE.Vector2(0.005, 0.021)
  ];
  const ferruleGeo = new THREE.LatheGeometry(ferrulePts, 18);

  for (const zSign of [-1, 1]) {
    const f = new THREE.Mesh(ferruleGeo, metalMat);
    f.position.set(baseX, 0.774, zSign * 0.088);
    f.rotation.z = -side * 0.08;
    f.castShadow = true;
    f.userData.slot = "metal";
    group.add(f);
  }

  return group;
}

/**
 * Cozy hanging yarn tassel & turned wooden bead looped onto the right brass handle.
 */
function buildHangingTassel(THREE, woodMat, metalMat, accentMat) {
  const pivot = new THREE.Group();
  pivot.name = "tassel";
  // Attached at the front-right slope of the right push handle
  pivot.position.set(0.344, 0.870, 0.044);

  // Braided cord loop hanging down from the brass bar
  const cordCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.006, 0),
    new THREE.Vector3(0.004, -0.012, 0.002),
    new THREE.Vector3(0.002, -0.042, 0.001),
    new THREE.Vector3(0.0, -0.072, 0.0)
  ]);
  const cordGeo = createTaperedTube(THREE, cordCurve, 16, 8, () => 0.0018, true);
  const cord = new THREE.Mesh(cordGeo, accentMat);
  cord.userData.slot = "accent";
  pivot.add(cord);

  // Small brass mounting loop collar around handle
  const ringGeo = new THREE.TorusGeometry(0.0095, 0.0016, 10, 20);
  ringGeo.rotateY(Math.PI * 0.5);
  const ring = new THREE.Mesh(ringGeo, metalMat);
  ring.userData.slot = "metal";
  pivot.add(ring);

  // Turned wooden bead (LatheGeometry, 16 points)
  const beadPts = [];
  for (let i = 0; i <= 16; i++) {
    const f = i / 16;
    const ang = f * Math.PI;
    const r = Math.max(0.0015, Math.sin(ang) * 0.0085);
    const y = -0.068 - f * 0.016;
    beadPts.push(new THREE.Vector2(r, y));
  }
  const beadGeo = new THREE.LatheGeometry(beadPts, 16);
  const bead = new THREE.Mesh(beadGeo, woodMat);
  bead.castShadow = true;
  bead.userData.slot = "wood";
  pivot.add(bead);

  // Brass tassel crown cap
  const capGeo = new THREE.CylinderGeometry(0.0042, 0.0072, 0.009, 16);
  const cap = new THREE.Mesh(capGeo, metalMat);
  cap.position.y = -0.088;
  cap.userData.slot = "metal";
  pivot.add(cap);

  // Sculpted fluted yarn tassel skirt (LatheGeometry displaced with yarn-strand flutes)
  const skirtPts = [
    new THREE.Vector2(0.0055, -0.091),
    new THREE.Vector2(0.0070, -0.098),
    new THREE.Vector2(0.0088, -0.109),
    new THREE.Vector2(0.0108, -0.122),
    new THREE.Vector2(0.0124, -0.136),
    new THREE.Vector2(0.0132, -0.148),
    new THREE.Vector2(0.0120, -0.153),
    new THREE.Vector2(0.0050, -0.153),
    new THREE.Vector2(0.0, -0.151)
  ];
  const skirtGeo = new THREE.LatheGeometry(skirtPts, 28);
  const spos = skirtGeo.attributes.position;
  for (let i = 0; i < spos.count; i++) {
    const x = spos.getX(i);
    const y = spos.getY(i);
    const z = spos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > 0.003) {
      const ang = Math.atan2(z, x);
      const depth = clamp((-0.091 - y) / 0.062, 0, 1);
      const flute = 1 + Math.sin(ang * 14) * 0.085 * depth;
      spos.setX(i, x * flute);
      spos.setZ(i, z * flute);
    }
  }
  skirtGeo.computeVertexNormals();
  const skirt = new THREE.Mesh(skirtGeo, accentMat);
  skirt.castShadow = true;
  skirt.userData.slot = "accent";
  pivot.add(skirt);

  pivot.userData.baseRot = { x: 0, y: 0, z: 0 };
  return pivot;
}

/**
 * Builds a cozy miniature sculpted dorm plush kitty perched on the top shelf book stack.
 * Continuous sculpted 48x32 body & head, curved extruded ears, 3-layer glossy eyes,
 * tapered curled tail, blush discs, and knitted accent scarf.
 */
function buildDormPlush(THREE, kit, opts, fabricBump, accentMat) {
  const root = new THREE.Group();
  root.name = "plushBuddy";

  const furHex = "#f2e7d7";
  const bellyHex = "#fbf5eb";
  const furMap = makePlushTexture(THREE, kit, furHex, bellyHex);

  const furMat = new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    map: furMap,
    bumpMap: fabricBump,
    bumpScale: 0.0012,
    roughness: 0.92,
    sheen: 0.85,
    sheenRoughness: 0.65,
    sheenColor: new THREE.Color("#fffbf4")
  });

  const innerEarMat = new THREE.MeshPhysicalMaterial({
    color: mixHex(opts.accent, "#f4cfd8", 0.55),
    roughness: 0.9,
    sheen: 0.75,
    sheenColor: new THREE.Color("#fff5f7")
  });

  const eyeDarkMat = new THREE.MeshPhysicalMaterial({
    color: "#1b161c",
    roughness: 0.06,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04
  });

  const irisMat = new THREE.MeshPhysicalMaterial({
    color: mixHex(opts.accent, "#5e4a78", 0.35),
    roughness: 0.14,
    clearcoat: 0.85
  });

  const highlightMat = new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    roughness: 0.08,
    emissive: new THREE.Color("#ffffff"),
    emissiveIntensity: 0.35
  });

  const noseMat = new THREE.MeshPhysicalMaterial({
    color: "#cf8b94",
    roughness: 0.32,
    clearcoat: 0.45
  });

  const blushMat = new THREE.MeshPhysicalMaterial({
    color: "#eba3ac",
    roughness: 0.9,
    sheen: 0.6,
    transparent: true,
    opacity: 0.68
  });

  // 1. Sculpted continuous plush body (SphereGeometry 48x32 displaced into seated chibi loaf)
  const bodyGroup = new THREE.Group();
  bodyGroup.name = "body";
  root.add(bodyGroup);

  const bodyGeo = new THREE.SphereGeometry(1, 48, 32);
  const bPos = bodyGeo.attributes.position;
  for (let i = 0; i < bPos.count; i++) {
    let x = bPos.getX(i);
    let y = bPos.getY(i);
    let z = bPos.getZ(i);

    // Taper smoothly toward neck, plump low tummy & seated haunches
    const hNorm = (y + 1) * 0.5;
    const taper = 1.0 - 0.24 * Math.pow(hNorm, 1.5);
    const haunch = 1.0 + 0.14 * Math.exp(-Math.pow((y + 0.35) / 0.42, 2));
    const belly = z > 0 ? 1.0 + 0.12 * z * Math.exp(-Math.pow((y + 0.15) / 0.5, 2)) : 1.0;

    x *= 0.032 * taper * haunch;
    z *= 0.031 * taper * haunch * belly;
    y *= 0.029;

    // Flatten underside cleanly onto local y = 0
    if (y < -0.021) {
      y = -0.021 - (-0.021 - y) * 0.12;
    }
    bPos.setXYZ(i, x, y + 0.022, z);
  }
  bodyGeo.computeVertexNormals();
  const bodyMesh = new THREE.Mesh(bodyGeo, furMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.userData.slot = "fur";
  bodyGroup.add(bodyMesh);

  // Two tiny sculpted front paws tucked smoothly into lower body
  const pawGeo = new THREE.SphereGeometry(0.0085, 20, 14);
  pawGeo.scale(1.05, 0.72, 1.25);
  for (const side of [-1, 1]) {
    const paw = new THREE.Mesh(pawGeo, furMat);
    paw.position.set(side * 0.013, 0.0068, 0.024);
    paw.rotation.y = side * 0.2;
    paw.castShadow = true;
    paw.userData.slot = "fur";
    bodyGroup.add(paw);
  }

  // Knitted cozy scarf wrapping around the neck seam
  const scarfCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0.022, 0.043, 0.0),
      new THREE.Vector3(0.015, 0.041, 0.018),
      new THREE.Vector3(0.0, 0.040, 0.023),
      new THREE.Vector3(-0.015, 0.041, 0.018),
      new THREE.Vector3(-0.022, 0.043, 0.0),
      new THREE.Vector3(-0.015, 0.044, -0.018),
      new THREE.Vector3(0.0, 0.045, -0.022),
      new THREE.Vector3(0.015, 0.044, -0.018)
    ],
    true
  );
  const scarfGeo = createTaperedTube(THREE, scarfCurve, 32, 12, () => 0.0058, false);
  const scarf = new THREE.Mesh(scarfGeo, accentMat);
  scarf.castShadow = true;
  scarf.userData.slot = "accent";
  bodyGroup.add(scarf);

  // Draped scarf tail (curved ExtrudeGeometry)
  const scarfTailShape = new THREE.Shape();
  scarfTailShape.moveTo(-0.0045, 0);
  scarfTailShape.bezierCurveTo(-0.005, -0.010, -0.006, -0.020, -0.0055, -0.025);
  scarfTailShape.lineTo(0.0055, -0.025);
  scarfTailShape.bezierCurveTo(0.006, -0.020, 0.005, -0.010, 0.0045, 0);
  scarfTailShape.closePath();
  const stGeo = new THREE.ExtrudeGeometry(scarfTailShape, {
    depth: 0.0028,
    bevelEnabled: true,
    bevelThickness: 0.0008,
    bevelSize: 0.0008,
    bevelSegments: 2
  });
  const stPos = stGeo.attributes.position;
  for (let i = 0; i < stPos.count; i++) {
    const y = stPos.getY(i);
    const z = stPos.getZ(i);
    stPos.setZ(i, z + Math.sin(clamp(-y / 0.025, 0, 1) * Math.PI * 0.85) * 0.005);
  }
  stGeo.computeVertexNormals();
  const scarfTail = new THREE.Mesh(stGeo, accentMat);
  scarfTail.position.set(0.011, 0.040, 0.021);
  scarfTail.rotation.y = 0.25;
  scarfTail.rotation.z = 0.14;
  scarfTail.userData.slot = "accent";
  bodyGroup.add(scarfTail);

  // 2. Sculpted continuous plush head (SphereGeometry 48x32 with soft cheeks & subtle muzzle)
  const headGroup = new THREE.Group();
  headGroup.name = "head";
  headGroup.position.set(0, 0.066, 0.002);
  headGroup.rotation.set(0.04, 0.06, -0.07); // Charming gentle head tilt
  bodyGroup.add(headGroup);

  const headGeo = new THREE.SphereGeometry(1, 48, 32);
  const hPos = headGeo.attributes.position;
  for (let i = 0; i < hPos.count; i++) {
    let x = hPos.getX(i);
    let y = hPos.getY(i);
    let z = hPos.getZ(i);

    const cheekBulge = 1.0 + 0.14 * Math.exp(-Math.pow((y + 0.22) / 0.42, 2)) * (0.4 + 0.6 * Math.abs(x));
    const muzzle = z > 0.2 ? 0.0032 * Math.exp(-Math.pow(x / 0.45, 2) - Math.pow((y + 0.15) / 0.35, 2)) : 0;
    const crownTaper = y > 0 ? 1.0 - 0.08 * y * y : 1.0;

    x *= 0.031 * cheekBulge * crownTaper;
    y *= 0.0265;
    z = z * 0.0275 * crownTaper + muzzle;

    hPos.setXYZ(i, x, y, z);
  }
  headGeo.computeVertexNormals();
  const headMesh = new THREE.Mesh(headGeo, furMat);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headMesh.userData.slot = "fur";
  headGroup.add(headMesh);

  // 3. Curved extruded ears ("earL", "earR") with soft inner ear inserts
  const makeEar = (side) => {
    const earGrp = new THREE.Group();
    earGrp.name = side < 0 ? "earL" : "earR";
    earGrp.position.set(side * 0.018, 0.018, -0.002);
    earGrp.rotation.set(0.12, side * 0.22, -side * 0.36);

    const es = new THREE.Shape();
    es.moveTo(-0.010, -0.002);
    es.bezierCurveTo(-0.011, 0.007, -0.004, 0.019, 0.0, 0.020);
    es.bezierCurveTo(0.004, 0.019, 0.011, 0.007, 0.010, -0.002);
    es.closePath();

    const eGeo = new THREE.ExtrudeGeometry(es, {
      depth: 0.0045,
      bevelEnabled: true,
      bevelThickness: 0.0018,
      bevelSize: 0.0016,
      bevelSegments: 3
    });
    eGeo.translate(0, 0, -0.00225);
    const ep = eGeo.attributes.position;
    for (let i = 0; i < ep.count; i++) {
      const ex = ep.getX(i);
      const ey = ep.getY(i);
      const ez = ep.getZ(i);
      // Cup gently forward along X and curl slightly at the tip
      const cup = (ex * ex) * 18.0 + Math.max(0, ey) * 0.14;
      ep.setZ(i, ez + cup);
    }
    eGeo.computeVertexNormals();
    const earMesh = new THREE.Mesh(eGeo, furMat);
    earMesh.castShadow = true;
    earMesh.userData.slot = "fur";
    earGrp.add(earMesh);

    // Soft inner ear insert
    const ins = new THREE.Shape();
    ins.moveTo(-0.0055, 0.001);
    ins.bezierCurveTo(-0.0055, 0.007, -0.002, 0.013, 0.0, 0.0135);
    ins.bezierCurveTo(0.002, 0.013, 0.0055, 0.007, 0.0055, 0.001);
    ins.closePath();
    const inGeo = new THREE.ExtrudeGeometry(ins, { depth: 0.0012, bevelEnabled: false });
    const inMesh = new THREE.Mesh(inGeo, innerEarMat);
    inMesh.position.set(0, 0, 0.0033);
    inMesh.userData.slot = "furAccent";
    earGrp.add(inMesh);

    earGrp.userData.baseRot = { x: earGrp.rotation.x, y: earGrp.rotation.y, z: earGrp.rotation.z };
    return earGrp;
  };
  headGroup.add(makeEar(-1));
  headGroup.add(makeEar(1));

  // 4. Expressive 3-layer eyes slightly inset on the face surface
  const makeEye = (side) => {
    const eyeGrp = new THREE.Group();
    eyeGrp.name = side < 0 ? "eyeL" : "eyeR";
    eyeGrp.position.set(side * 0.0115, 0.0015, 0.0252);
    eyeGrp.rotation.y = side * 0.34;
    eyeGrp.rotation.x = -0.06;

    // Layer 1: Dark glossy clearcoat eye
    const orbGeo = new THREE.SphereGeometry(0.0046, 18, 14);
    orbGeo.scale(1.0, 1.08, 0.62);
    const orb = new THREE.Mesh(orbGeo, eyeDarkMat);
    orb.userData.slot = "eye";
    eyeGrp.add(orb);

    // Layer 2: Subtle coloured iris ring nestled inside lower rim
    const irisGeo = new THREE.TorusGeometry(0.0028, 0.0009, 10, 18);
    irisGeo.scale(1.0, 1.05, 0.55);
    const iris = new THREE.Mesh(irisGeo, irisMat);
    iris.position.set(0, -0.0005, 0.0019);
    iris.userData.slot = "accent";
    eyeGrp.add(iris);

    // Layer 3: Two crisp white catchlight dots placed up and to one side
    const hi1 = new THREE.Mesh(new THREE.SphereGeometry(0.00125, 10, 8), highlightMat);
    hi1.position.set(-0.0013, 0.0016, 0.0026);
    eyeGrp.add(hi1);

    const hi2 = new THREE.Mesh(new THREE.SphereGeometry(0.00062, 8, 8), highlightMat);
    hi2.position.set(0.0011, -0.0012, 0.0025);
    eyeGrp.add(hi2);

    return eyeGrp;
  };
  headGroup.add(makeEye(-1));
  headGroup.add(makeEye(1));

  // Tiny shaped kitty nose
  const noseGeo = new THREE.SphereGeometry(0.0024, 14, 10);
  noseGeo.scale(1.25, 0.85, 0.72);
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, -0.0036, 0.0294);
  nose.userData.slot = "skin";
  headGroup.add(nose);

  // Curved "w" mouth line made from a thin tapered tube
  const mouthCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.0052, -0.0068, 0.0276),
    new THREE.Vector3(-0.0024, -0.0086, 0.0286),
    new THREE.Vector3(0.0, -0.0062, 0.0290),
    new THREE.Vector3(0.0024, -0.0086, 0.0286),
    new THREE.Vector3(0.0052, -0.0068, 0.0276)
  ]);
  const mouthGeo = createTaperedTube(THREE, mouthCurve, 18, 6, (t) => 0.00065 * (0.7 + 0.3 * Math.sin(t * Math.PI)), true);
  const mouthMat = new THREE.MeshPhysicalMaterial({ color: "#5e4347", roughness: 0.65 });
  const mouth = new THREE.Mesh(mouthGeo, mouthMat);
  headGroup.add(mouth);

  // Soft blush discs resting flush on cheeks
  const blushGeo = new THREE.CircleGeometry(0.0046, 16);
  for (const side of [-1, 1]) {
    const blush = new THREE.Mesh(blushGeo, blushMat);
    blush.scale.set(1.25, 0.8, 1);
    blush.position.set(side * 0.0172, -0.0048, 0.0238);
    blush.rotation.y = side * 0.56;
    blush.rotation.x = 0.08;
    headGroup.add(blush);
  }

  // 5. Tapered curled plush tail along CatmullRomCurve3
  const tailGroup = new THREE.Group();
  tailGroup.name = "tail";
  tailGroup.position.set(0.0, 0.010, -0.022);
  bodyGroup.add(tailGroup);

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 0.0, 0.0),
    new THREE.Vector3(-0.022, -0.002, -0.010),
    new THREE.Vector3(-0.036, -0.003, 0.008),
    new THREE.Vector3(-0.032, 0.001, 0.026),
    new THREE.Vector3(-0.020, 0.004, 0.033)
  ]);
  const tailGeo = createTaperedTube(
    THREE,
    tailCurve,
    24,
    12,
    (t) => 0.0052 * (0.82 + 0.36 * Math.sin(t * Math.PI * 0.85)) * (1 - 0.18 * t),
    true
  );
  const tailMesh = new THREE.Mesh(tailGeo, furMat);
  tailMesh.castShadow = true;
  tailMesh.userData.slot = "fur";
  tailGroup.add(tailMesh);

  headGroup.userData.baseRot = {
    x: headGroup.rotation.x,
    y: headGroup.rotation.y,
    z: headGroup.rotation.z
  };
  tailGroup.userData.baseRot = { x: 0, y: 0, z: 0 };

  return root;
}

export function build(THREE, opts = {}, kit) {
  const woodHex = opts.wood || "#c89462";
  const metalHex = opts.metal || "#d9c08a";
  const accentHex = opts.accent || "#b8a2e3";

  const rng = mulberry32(20250317);
  const root = new THREE.Group();
  root.name = "rollingBookCart";

  // 1. Procedural textures & physical materials
  const woodTex = makeWoodTextures(THREE, kit, woodHex);
  const metalTex = makeBrushedMetalTextures(THREE, kit, metalHex);
  const paperTex = makePaperTextures(THREE, kit);
  const fabricBump = makeFabricBump(THREE, kit);

  const woodMat = new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    map: woodTex.map,
    bumpMap: woodTex.bump,
    bumpScale: 0.0018,
    roughness: 0.46,
    metalness: 0.02,
    clearcoat: 0.24,
    clearcoatRoughness: 0.34
  });

  const metalMat = new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    map: metalTex.map,
    bumpMap: metalTex.bump,
    bumpScale: 0.0006,
    metalness: 0.84,
    roughness: 0.24,
    clearcoat: 0.18,
    clearcoatRoughness: 0.22
  });

  const rubberMat = new THREE.MeshPhysicalMaterial({
    color: "#36333a",
    roughness: 0.78,
    metalness: 0.04,
    sheen: 0.18,
    sheenColor: new THREE.Color("#5c5662")
  });

  const paperMat = new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    map: paperTex.map,
    bumpMap: paperTex.bump,
    bumpScale: 0.0014,
    roughness: 0.92,
    sheen: 0.22,
    sheenColor: new THREE.Color("#fffcf4")
  });

  const accentClothMat = new THREE.MeshPhysicalMaterial({
    color: accentHex,
    bumpMap: fabricBump,
    bumpScale: 0.0016,
    roughness: 0.9,
    sheen: 0.85,
    sheenRoughness: 0.65,
    sheenColor: new THREE.Color(mixHex(accentHex, "#ffffff", 0.55))
  });

  // 2. Cart frame: wooden side panels, bottom plinth & brass joinery
  const frameGroup = new THREE.Group();
  frameGroup.name = "cartFrame";
  root.add(frameGroup);

  const leftPanel = buildSidePanel(THREE, woodMat);
  leftPanel.position.x = -0.312;
  frameGroup.add(leftPanel);

  const rightPanel = buildSidePanel(THREE, woodMat);
  rightPanel.position.x = 0.312;
  frameGroup.add(rightPanel);

  // Lower plinth apron connecting left & right panels and supporting casters
  const plinthShape = new THREE.Shape();
  const plW = 0.308;
  const plD = 0.156;
  const plR = 0.012;
  plinthShape.moveTo(-plW + plR, -plD);
  plinthShape.lineTo(plW - plR, -plD);
  plinthShape.quadraticCurveTo(plW, -plD, plW, -plD + plR);
  plinthShape.lineTo(plW, plD - plR);
  plinthShape.quadraticCurveTo(plW, plD, plW - plR, plD);
  plinthShape.lineTo(-plW + plR, plD);
  plinthShape.quadraticCurveTo(-plW, plD, -plW, plD - plR);
  plinthShape.lineTo(-plW, -plD + plR);
  plinthShape.quadraticCurveTo(-plW, -plD, -plW + plR, -plD);

  const plinthGeo = new THREE.ExtrudeGeometry(plinthShape, {
    depth: 0.016,
    bevelEnabled: true,
    bevelThickness: 0.0025,
    bevelSize: 0.0025,
    bevelSegments: 3
  });
  plinthGeo.rotateX(Math.PI * 0.5);
  const pPos = plinthGeo.attributes.position;
  const pUv = plinthGeo.attributes.uv;
  for (let i = 0; i < pPos.count; i++) {
    pUv.setXY(i, pPos.getX(i) * 1.6 + 0.5, pPos.getZ(i) * 2.4 + 0.5);
  }
  pUv.needsUpdate = true;
  plinthGeo.computeVertexNormals();

  const plinth = new THREE.Mesh(plinthGeo, woodMat);
  plinth.position.y = 0.100; // bottom rests cleanly at y = 0.0815 matching caster plates
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  plinth.userData.slot = "wood";
  frameGroup.add(plinth);

  // Decorative brass joinery cap-bolts on outer faces of both side panels
  const boltGeo = new THREE.SphereGeometry(0.0052, 14, 10);
  boltGeo.scale(0.45, 1, 1);
  const shelfSpecs = [
    { y: 0.165, z: 0.006 },
    { y: 0.415, z: 0.002 },
    { y: 0.665, z: -0.002 }
  ];
  const slopeAngle = -0.24; // Tilts front (+Z) up & back (-Z) down so spines angle toward viewer

  for (const side of [-1, 1]) {
    for (const sh of shelfSpecs) {
      for (const localZ of [-0.095, 0.085]) {
        const bolt = new THREE.Mesh(boltGeo, metalMat);
        const wy = sh.y - localZ * Math.sin(slopeAngle) - 0.008;
        const wz = sh.z + localZ * Math.cos(slopeAngle);
        bolt.position.set(side * 0.323, wy, wz);
        bolt.userData.slot = "metal";
        frameGroup.add(bolt);
      }
    }
  }

  // Arched brass push handles on left & right tops
  frameGroup.add(buildBrassHandle(THREE, metalMat, -1));
  frameGroup.add(buildBrassHandle(THREE, metalMat, 1));

  // Cozy hanging tassel on right handle
  const tassel = buildHangingTassel(THREE, woodMat, metalMat, accentClothMat);
  frameGroup.add(tassel);

  // 3. Four swiveling caster wheels (grounded accurately at y = 0)
  const castersGroup = new THREE.Group();
  castersGroup.name = "casters";
  root.add(castersGroup);

  const casterCoords = [
    [-0.258, -0.108, 0.38],
    [0.258, -0.108, -0.26],
    [-0.258, 0.108, 0.62],
    [0.258, 0.108, -0.44]
  ];
  for (const [cx, cz, sw] of casterCoords) {
    const caster = buildCaster(THREE, metalMat, rubberMat, sw);
    caster.position.set(cx, 0, cz);
    castersGroup.add(caster);
  }

  // 4. Curated dorm book cover material library (harmonized with opts.accent & opts.metal)
  const coverSpecs = [
    { primary: accentHex, secondary: mixHex(accentHex, "#3c2e56", 0.42), foil: metalHex, style: "celestial", slot: "accent", cloth: true },
    { primary: "#d27d62", secondary: "#f1e3c8", foil: metalHex, style: "classic", cloth: true },
    { primary: "#7c9b84", secondary: "#4e6957", foil: "#f3e6c8", style: "label", cloth: true },
    { primary: "#5a728c", secondary: "#d8c499", foil: metalHex, style: "classic", cloth: true },
    { primary: "#e8dcc4", secondary: accentHex, foil: "#735d49", style: "label", cloth: true },
    { primary: "#cf939a", secondary: "#8d5863", foil: "#f7eedb", style: "colorblock", cloth: false },
    { primary: "#d7a959", secondary: "#8a5f2b", foil: "#fdf4de", style: "plaid", cloth: true },
    { primary: "#6f5578", secondary: mixHex(accentHex, "#ffffff", 0.25), foil: metalHex, style: "celestial", slot: "accent", cloth: true },
    { primary: "#4c685c", secondary: "#d4b57a", foil: metalHex, style: "classic", cloth: true },
    { primary: "#8c614c", secondary: "#e7d7bd", foil: metalHex, style: "label", cloth: true },
    { primary: "#7e90be", secondary: "#f0e5d1", foil: "#f5e3b0", style: "colorblock", cloth: false },
    { primary: "#e4c986", secondary: "#9e7744", foil: "#5a4128", style: "colorblock", cloth: false },
    // Matching 3-volume anthology set
    { primary: mixHex(accentHex, "#554272", 0.38), secondary: accentHex, foil: metalHex, style: "volume", vol: 1, slot: "accent", cloth: true },
    { primary: mixHex(accentHex, "#554272", 0.38), secondary: accentHex, foil: metalHex, style: "volume", vol: 2, slot: "accent", cloth: true },
    { primary: mixHex(accentHex, "#554272", 0.38), secondary: accentHex, foil: metalHex, style: "volume", vol: 3, slot: "accent", cloth: true },
    { primary: "#c4797c", secondary: "#f2e5d3", foil: metalHex, style: "plaid", cloth: true }
  ];

  const coverMaterials = coverSpecs.map((sp) => {
    const map = makeBookCoverTexture(THREE, kit, sp);
    if (sp.cloth) {
      return {
        mat: new THREE.MeshPhysicalMaterial({
          color: "#ffffff",
          map,
          bumpMap: fabricBump,
          bumpScale: 0.0014,
          roughness: 0.88,
          sheen: 0.72,
          sheenRoughness: 0.68,
          sheenColor: new THREE.Color(mixHex(sp.primary, "#ffffff", 0.45))
        }),
        slot: sp.slot
      };
    }
    return {
      mat: new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        map,
        roughness: 0.4,
        clearcoat: 0.28,
        clearcoatRoughness: 0.25
      }),
      slot: sp.slot
    };
  });

  // 5. Three sloped shelves + brass front guard rails + rich dorm book arrangements
  const shelvesGroup = new THREE.Group();
  shelvesGroup.name = "shelves";
  root.add(shelvesGroup);

  // Reusable beveled shelf board & backstop geometries
  const makeShelfBoard = () => {
    const sh = new THREE.Shape();
    sh.moveTo(-0.112, -0.015);
    sh.lineTo(0.106, -0.015);
    sh.quadraticCurveTo(0.114, -0.015, 0.114, -0.0075);
    sh.quadraticCurveTo(0.114, 0.0, 0.106, 0.0);
    sh.lineTo(-0.112, 0.0);
    sh.closePath();

    const g = new THREE.ExtrudeGeometry(sh, {
      depth: 0.606,
      bevelEnabled: true,
      bevelThickness: 0.0018,
      bevelSize: 0.0015,
      bevelSegments: 2
    });
    g.translate(0, 0, -0.303);
    g.rotateY(-Math.PI * 0.5);
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getZ(i) * 2.5 + 0.5, pos.getX(i) * 1.5 + 0.5);
    }
    uv.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  };

  const makeBackstopBoard = () => {
    const sh = new THREE.Shape();
    sh.moveTo(-0.113, -0.015);
    sh.lineTo(-0.099, -0.015);
    sh.lineTo(-0.099, 0.098);
    sh.quadraticCurveTo(-0.099, 0.104, -0.106, 0.104);
    sh.quadraticCurveTo(-0.113, 0.104, -0.113, 0.098);
    sh.closePath();

    const g = new THREE.ExtrudeGeometry(sh, {
      depth: 0.606,
      bevelEnabled: true,
      bevelThickness: 0.0016,
      bevelSize: 0.0014,
      bevelSegments: 2
    });
    g.translate(0, 0, -0.303);
    g.rotateY(-Math.PI * 0.5);
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getY(i) * 3.0 + 0.2, pos.getX(i) * 1.5 + 0.5);
    }
    uv.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  };

  const boardGeo = makeShelfBoard();
  const backstopGeo = makeBackstopBoard();
  const railGeo = new THREE.CylinderGeometry(0.0034, 0.0034, 0.606, 12);
  railGeo.rotateZ(Math.PI * 0.5);
  const railCollarGeo = new THREE.CylinderGeometry(0.0062, 0.0062, 0.008, 14);
  railCollarGeo.rotateZ(Math.PI * 0.5);

  const shelfGroups = [];
  for (let sIdx = 0; sIdx < 3; sIdx++) {
    const sg = new THREE.Group();
    sg.name = `shelf${sIdx}`;
    sg.position.set(0, shelfSpecs[sIdx].y, shelfSpecs[sIdx].z);
    sg.rotation.x = slopeAngle;
    shelvesGroup.add(sg);
    shelfGroups.push(sg);

    const board = new THREE.Mesh(boardGeo, woodMat);
    board.castShadow = true;
    board.receiveShadow = true;
    board.userData.slot = "wood";
    sg.add(board);

    const backstop = new THREE.Mesh(backstopGeo, woodMat);
    backstop.castShadow = true;
    backstop.receiveShadow = true;
    backstop.userData.slot = "wood";
    sg.add(backstop);

    // Sleek brass front book-retaining bar with end collars
    const rail = new THREE.Mesh(railGeo, metalMat);
    rail.position.set(0, 0.029, 0.105);
    rail.castShadow = true;
    rail.userData.slot = "metal";
    sg.add(rail);

    for (const side of [-1, 1]) {
      const col = new THREE.Mesh(railCollarGeo, metalMat);
      col.position.set(side * 0.298, 0.029, 0.105);
      col.userData.slot = "metal";
      sg.add(col);
    }
  }

  // Helper to instantiate a book from a compact recipe
  const makeBookObj = (w, h, d, matIdx, extra = {}) => {
    const entry = coverMaterials[matIdx % coverMaterials.length];
    return buildBook(
      THREE,
      {
        w,
        h,
        d,
        coverMat: entry.mat,
        slot: entry.slot,
        isPaperback: Boolean(extra.pb),
        hasRibs: Boolean(extra.ribs),
        hasElastic: Boolean(extra.elastic),
        hasBookmark: Boolean(extra.bookmark),
        hasTabs: Boolean(extra.tabs),
        accentMat: accentClothMat,
        foilMat: metalMat,
        paperMat
      },
      null
    );
  };

  // Place a row of upright books along local X, resting squarely on y = 0 and against backstop z = -0.095
  const placeUprightRow = (shelfGrp, startX, items) => {
    let cursor = startX;
    for (const it of items) {
      const book = makeBookObj(it.w, it.h, it.d, it.m, it);
      const zJitter = (rng() - 0.5) * 0.011;
      const zBack = -0.094 + it.d * 0.5 + Math.max(0, zJitter);
      const tilt = (rng() - 0.5) * 0.022;
      book.position.set(
        cursor + it.w * 0.5,
        (it.w * 0.5) * Math.abs(Math.sin(tilt)),
        zBack
      );
      book.rotation.z = tilt;
      book.rotation.y = (rng() - 0.5) * 0.025;
      shelfGrp.add(book);
      cursor += it.w + 0.0014;
    }
    return cursor;
  };

  // Place a cozy horizontal stack of books with spines facing +Z
  const placeFlatStack = (shelfGrp, centerX, centerZ, items) => {
    let stackY = 0;
    for (const it of items) {
      const holder = new THREE.Group();
      const book = makeBookObj(it.w, it.h, it.d, it.m, it);
      // Rotate +90 deg around Z so spine remains at +Z, thickness w becomes vertical height
      book.rotation.z = Math.PI * 0.5;
      book.position.set(it.h * 0.5, it.w * 0.5, 0);
      holder.add(book);
      holder.position.set(centerX + (rng() - 0.5) * 0.008, stackY, centerZ + (rng() - 0.5) * 0.007);
      holder.rotation.y = (rng() - 0.5) * 0.085;
      shelfGrp.add(holder);
      stackY += it.w + 0.0005;
    }
    return stackY;
  };

  // Place leaning books resting accurately on y = 0 without sinking into the shelf
  const placeLeaningBook = (shelfGrp, baseX, angleZ, it) => {
    const book = makeBookObj(it.w, it.h, it.d, it.m, it);
    const yLift = (it.w * 0.5) * Math.abs(Math.sin(angleZ));
    book.position.set(baseX, yLift, -0.093 + it.d * 0.5 + 0.004);
    book.rotation.z = angleZ;
    shelfGrp.add(book);
  };

  // --- SHELF 0 (Bottom): Large art hardcovers, flat stack, and right upright volumes ---
  placeUprightRow(shelfGroups[0], -0.294, [
    { w: 0.036, h: 0.202, d: 0.178, m: 3, ribs: true },
    { w: 0.028, h: 0.194, d: 0.168, m: 0, bookmark: true },
    { w: 0.032, h: 0.205, d: 0.180, m: 8, ribs: true },
    { w: 0.022, h: 0.176, d: 0.156, m: 4 },
    { w: 0.030, h: 0.196, d: 0.172, m: 1 },
    { w: 0.024, h: 0.182, d: 0.162, m: 6, pb: true },
    { w: 0.034, h: 0.200, d: 0.174, m: 9, ribs: true },
    { w: 0.020, h: 0.168, d: 0.150, m: 5, pb: true },
    { w: 0.026, h: 0.188, d: 0.165, m: 2 }
  ]);

  placeFlatStack(shelfGroups[0], 0.088, -0.004, [
    { w: 0.030, h: 0.186, d: 0.166, m: 7, ribs: true },
    { w: 0.025, h: 0.174, d: 0.158, m: 4 },
    { w: 0.022, h: 0.164, d: 0.148, m: 15 },
    { w: 0.018, h: 0.150, d: 0.140, m: 10, pb: true }
  ]);

  placeUprightRow(shelfGroups[0], 0.194, [
    { w: 0.025, h: 0.186, d: 0.162, m: 11, pb: true },
    { w: 0.032, h: 0.198, d: 0.172, m: 3, ribs: true },
    { w: 0.022, h: 0.176, d: 0.156, m: 0 },
    { w: 0.020, h: 0.192, d: 0.168, m: 1 }
  ]);

  // --- SHELF 1 (Middle): Lively novels, matching 3-volume anthology, leaning pair & dorm notebooks ---
  const midEnd = placeUprightRow(shelfGroups[1], -0.294, [
    { w: 0.026, h: 0.188, d: 0.158, m: 2 },
    { w: 0.018, h: 0.162, d: 0.142, m: 5, pb: true },
    { w: 0.028, h: 0.194, d: 0.164, m: 12, ribs: true }, // Vol I
    { w: 0.028, h: 0.194, d: 0.164, m: 13, ribs: true }, // Vol II
    { w: 0.028, h: 0.194, d: 0.164, m: 14, ribs: true }, // Vol III
    { w: 0.020, h: 0.170, d: 0.148, m: 11, pb: true },
    { w: 0.024, h: 0.182, d: 0.154, m: 1, tabs: true },
    { w: 0.017, h: 0.154, d: 0.138, m: 4, pb: true },
    { w: 0.030, h: 0.196, d: 0.166, m: 8, bookmark: true },
    { w: 0.022, h: 0.178, d: 0.152, m: 10, pb: true },
    { w: 0.024, h: 0.186, d: 0.158, m: 6 },
    { w: 0.019, h: 0.166, d: 0.145, m: 15, pb: true }
  ]);

  // Two books leaning cozily toward the left row
  placeLeaningBook(shelfGroups[1], midEnd + 0.034, 0.21, {
    w: 0.024,
    h: 0.178,
    d: 0.152,
    m: 0
  });
  placeLeaningBook(shelfGroups[1], midEnd + 0.064, 0.24, {
    w: 0.020,
    h: 0.164,
    d: 0.144,
    m: 9,
    pb: true
  });

  // Two flat dorm notebooks on right side of middle shelf
  placeFlatStack(shelfGroups[1], 0.205, -0.006, [
    { w: 0.024, h: 0.162, d: 0.148, m: 4, elastic: true },
    { w: 0.020, h: 0.148, d: 0.138, m: 7, elastic: true }
  ]);

  // --- SHELF 2 (Top): Hero varied skyline, bookmark, study tabs, flat stack + cozy dorm plush buddy! ---
  const topEnd = placeUprightRow(shelfGroups[2], -0.294, [
    { w: 0.032, h: 0.222, d: 0.176, m: 0, ribs: true, bookmark: true },
    { w: 0.024, h: 0.194, d: 0.158, m: 4 },
    { w: 0.028, h: 0.212, d: 0.168, m: 1, tabs: true },
    { w: 0.019, h: 0.172, d: 0.146, m: 5, pb: true },
    { w: 0.034, h: 0.228, d: 0.180, m: 3, ribs: true },
    { w: 0.022, h: 0.186, d: 0.154, m: 6 },
    { w: 0.026, h: 0.204, d: 0.164, m: 7, bookmark: true },
    { w: 0.018, h: 0.166, d: 0.142, m: 11, pb: true },
    { w: 0.030, h: 0.216, d: 0.172, m: 2, ribs: true },
    { w: 0.022, h: 0.182, d: 0.152, m: 15, pb: true },
    { w: 0.025, h: 0.196, d: 0.160, m: 10 }
  ]);

  placeLeaningBook(shelfGroups[2], topEnd + 0.035, 0.22, {
    w: 0.024,
    h: 0.186,
    d: 0.154,
    m: 8
  });
  placeLeaningBook(shelfGroups[2], topEnd + 0.064, 0.25, {
    w: 0.019,
    h: 0.168,
    d: 0.144,
    m: 4,
    pb: true
  });

  // Flat 2-book pedestal on right end of top shelf
  const topStackH = placeFlatStack(shelfGroups[2], 0.206, -0.004, [
    { w: 0.026, h: 0.166, d: 0.156, m: 9, ribs: true },
    { w: 0.022, h: 0.152, d: 0.146, m: 0, elastic: true }
  ]);

  // Cozy dorm plush kitty perched neatly on top of the right flat stack
  const plush = buildDormPlush(
    THREE,
    kit,
    { wood: woodHex, metal: metalHex, accent: accentHex },
    fabricBump,
    accentClothMat
  );
  // Tilt plush gently forward to counteract the shelf slope so it sits level & adorable
  plush.position.set(0.206, topStackH - 0.001, 0.002);
  plush.rotation.set(-slopeAngle * 0.45, -0.26, 0);
  shelfGroups[2].add(plush);

  return root;
}

export function idle(group, t) {
  // 1. Soft dorm breeze sway on the hanging handle tassel
  const tassel = group.getObjectByName("tassel");
  if (tassel) {
    const br = tassel.userData.baseRot || { x: 0, y: 0, z: 0 };
    tassel.rotation.z = br.z + Math.sin(t * 1.35) * 0.055 + Math.sin(t * 2.25) * 0.018;
    tassel.rotation.x = br.x + Math.cos(t * 1.1) * 0.028;
  }

  // 2. Subtle cozy life on the top-shelf dorm plush buddy (breathing, head sway, ears, tail, blink)
  const body = group.getObjectByName("body");
  if (body) {
    const breath = Math.sin(t * 2.1);
    body.scale.set(1 - breath * 0.012, 1 + breath * 0.022, 1 - breath * 0.01);
  }

  const head = group.getObjectByName("head");
  if (head) {
    const br = head.userData.baseRot || { x: 0, y: 0, z: 0 };
    head.rotation.z = br.z + Math.sin(t * 1.05) * 0.045;
    head.rotation.y = br.y + Math.sin(t * 0.72) * 0.055;
    head.rotation.x = br.x + Math.sin(t * 1.45) * 0.022;
  }

  const earL = group.getObjectByName("earL");
  const earR = group.getObjectByName("earR");
  if (earL && earR) {
    const twitch = Math.pow(Math.max(0, Math.sin(t * 0.95)), 16) * 0.14;
    const bL = earL.userData.baseRot || { x: 0, y: 0, z: 0 };
    const bR = earR.userData.baseRot || { x: 0, y: 0, z: 0 };
    earL.rotation.z = bL.z + Math.sin(t * 1.7) * 0.03 + twitch;
    earR.rotation.z = bR.z - Math.sin(t * 1.7 + 0.5) * 0.03;
  }

  const tail = group.getObjectByName("tail");
  if (tail) {
    const br = tail.userData.baseRot || { x: 0, y: 0, z: 0 };
    tail.rotation.y = br.y + Math.sin(t * 1.6) * 0.07;
    tail.rotation.z = br.z + Math.cos(t * 1.2) * 0.03;
  }

  // Blink every ~4.2 seconds
  const eyeL = group.getObjectByName("eyeL");
  const eyeR = group.getObjectByName("eyeR");
  if (eyeL && eyeR) {
    const cycle = t % 4.2;
    let blinkScale = 1.0;
    if (cycle > 3.96 && cycle < 4.14) {
      const p = (cycle - 3.96) / 0.18;
      blinkScale = 1.0 - 0.92 * Math.sin(p * Math.PI);
    }
    eyeL.scale.y = blinkScale;
    eyeR.scale.y = blinkScale;
  }
}
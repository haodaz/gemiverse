export const META = {
  id: "cozy_dorm_aquarium",
  name: "Cozy Dorm Aquarium",
  kind: "prop",
  footprint: [0.58, 0.38],
  variants: [
    { name: "Sakura Peach", glass: "#cfeaf5", accent: "#f2a7b8", wood: "#c89462" },
    { name: "Mint Matcha", glass: "#d2f2ea", accent: "#8fd1b5", wood: "#cfa374" },
    { name: "Lavender Dusk", glass: "#d7e2fa", accent: "#c5a3e6", wood: "#b6855c" },
    { name: "Honey Cream", glass: "#d6eef7", accent: "#f5c47a", wood: "#b97f4c" }
  ],
  note: "Small glass dorm-room aquarium on a turned-leg low wooden stand with sculpted gravel, river stones, two curved aquatic plants, three chibi fish with layered glossy eyes, a bubbling sponge filter, and a clip-on glowing lamp."
};

// ---------------------------------------------------------------------------
// Geometry & Math Helpers (no globals; THREE passed explicitly)
// ---------------------------------------------------------------------------

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hexToRgb(THREE, hex, fallback) {
  const c = new THREE.Color(hex || fallback);
  return {
    r: Math.round(c.r * 255),
    g: Math.round(c.g * 255),
    b: Math.round(c.b * 255),
    color: c
  };
}

function rgbStr(r, g, b, a = 1) {
  const rr = clamp(Math.round(r), 0, 255);
  const gg = clamp(Math.round(g), 0, 255);
  const bb = clamp(Math.round(b), 0, 255);
  return a < 1 ? `rgba(${rr},${gg},${bb},${a})` : `rgb(${rr},${gg},${bb})`;
}

function mixRgb(c1, c2, t) {
  return {
    r: lerp(c1.r, c2.r, t),
    g: lerp(c1.g, c2.g, t),
    b: lerp(c1.b, c2.b, t)
  };
}

/**
 * Builds a tapered tube ring-by-ring along a CatmullRomCurve3.
 */
function createTaperedTubeGeometry(
  THREE,
  curve,
  tubularSegments,
  radialSegments,
  radiusFn,
  capStart = true,
  capEnd = true
) {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    const p = curve.getPointAt(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r = Math.max(0.00015, radiusFn(t));

    for (let j = 0; j <= radialSegments; j++) {
      const v = j / radialSegments;
      const theta = v * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);

      const vx = p.x + r * (cos * N.x + sin * B.x);
      const vy = p.y + r * (cos * N.y + sin * B.y);
      const vz = p.z + r * (cos * N.z + sin * B.z);

      positions.push(vx, vy, vz);
      uvs.push(v, t);
    }
  }

  const stride = radialSegments + 1;
  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      // Outward normals for Frenet frame (T, N, B)
      indices.push(a, d, b);
      indices.push(d, c, b);
    }
  }

  if (capStart) {
    const p0 = curve.getPointAt(0);
    const centerIdx = positions.length / 3;
    positions.push(p0.x, p0.y, p0.z);
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegments; j++) {
      indices.push(centerIdx, j, j + 1);
    }
  }

  if (capEnd) {
    const p1 = curve.getPointAt(1);
    const centerIdx = positions.length / 3;
    positions.push(p1.x, p1.y, p1.z);
    uvs.push(0.5, 1);
    const base = tubularSegments * stride;
    for (let j = 0; j < radialSegments; j++) {
      indices.push(centerIdx, base + j + 1, base + j);
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
 * Displaces vertices of any BufferGeometry and recomputes smooth normals.
 */
function deformGeometry(geo, fn) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const out = fn(x, y, z, i);
    pos.setXYZ(i, out[0], out[1], out[2]);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a rounded rectangle THREE.Shape centered at (0,0).
 */
function roundedRectShape(THREE, w, h, r) {
  const s = new THREE.Shape();
  const hw = w * 0.5;
  const hh = h * 0.5;
  const cr = Math.min(r, hw * 0.45, hh * 0.45);
  s.moveTo(-hw + cr, -hh);
  s.lineTo(hw - cr, -hh);
  s.bezierCurveTo(hw - cr * 0.45, -hh, hw, -hh + cr * 0.45, hw, -hh + cr);
  s.lineTo(hw, hh - cr);
  s.bezierCurveTo(hw, hh - cr * 0.45, hw - cr * 0.45, hh, hw - cr, hh);
  s.lineTo(-hw + cr, hh);
  s.bezierCurveTo(-hw + cr * 0.45, hh, -hw, hh - cr * 0.45, -hw, hh - cr);
  s.lineTo(-hw, -hh + cr);
  s.bezierCurveTo(-hw, -hh + cr * 0.45, -hw + cr * 0.45, -hh, -hw + cr, -hh);
  return s;
}

// ---------------------------------------------------------------------------
// Procedural Canvas Textures (via kit.canvasTexture & kit.noise)
// ---------------------------------------------------------------------------

function makeWoodTextures(THREE, kit, woodHex) {
  const base = hexToRgb(THREE, woodHex, "#c89462");
  const dark = { r: base.r * 0.72, g: base.g * 0.68, b: base.b * 0.62 };
  const light = {
    r: lerp(base.r, 255, 0.22),
    g: lerp(base.g, 245, 0.2),
    b: lerp(base.b, 225, 0.16)
  };

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = rgbStr(base.r, base.g, base.b);
    ctx.fillRect(0, 0, w, h);

    // Grain streaks using smooth value noise
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 4) {
        const nx = x * 0.012;
        const ny = y * 0.09;
        const warp = kit.noise(nx * 0.7, ny * 0.35) * 4.5;
        const ring = Math.sin((ny + warp) * 2.4) * 0.5 + 0.5;
        const fine = kit.noise(x * 0.06, y * 0.45);
        const mixT = clamp(ring * 0.72 + fine * 0.28, 0, 1);
        const col = mixT < 0.5
          ? mixRgb(dark, base, mixT * 2)
          : mixRgb(base, light, (mixT - 0.5) * 2);
        ctx.fillStyle = rgbStr(col.r, col.g, col.b);
        ctx.fillRect(x, y, 4, 2);
      }
    }

    // Subtle soft warm wood pores
    ctx.globalAlpha = 0.14;
    for (let i = 0; i < 240; i++) {
      const px = kit.noise(i * 1.73, 3.1) * w;
      const py = kit.noise(7.2, i * 2.17) * h;
      const len = 18 + kit.noise(i * 3.1, i * 0.7) * 52;
      ctx.fillStyle = rgbStr(dark.r * 0.85, dark.g * 0.82, dark.b * 0.78);
      ctx.fillRect(px, py, len, 1.4);
    }
    ctx.globalAlpha = 1;
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const warp = kit.noise(x * 0.02, y * 0.05) * 4.0;
        const ring = Math.sin((y * 0.18 + warp) * 2.2) * 0.5 + 0.5;
        const grain = kit.noise(x * 0.12, y * 0.8);
        const v = Math.round((ring * 0.65 + grain * 0.35) * 255);
        ctx.fillStyle = rgbStr(v, v, v);
        ctx.fillRect(x, y, 2, 2);
      }
    }
  });
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;

  return { map, bump };
}

function makeGravelTextures(THREE, kit, woodHex, accentHex) {
  const warmWood = hexToRgb(THREE, woodHex, "#c89462");
  const softAccent = hexToRgb(THREE, accentHex, "#f2a7b8");

  const palette = [
    { r: 224, g: 206, b: 180 },
    { r: 198, g: 175, b: 148 },
    { r: 168, g: 152, b: 136 },
    { r: 238, g: 226, b: 204 },
    mixRgb({ r: 205, g: 188, b: 166 }, warmWood, 0.35),
    mixRgb({ r: 215, g: 195, b: 185 }, softAccent, 0.25),
    { r: 142, g: 135, b: 128 }
  ];

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = "#b8a38b";
    ctx.fillRect(0, 0, w, h);

    // Subtle sandy under-bed
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const n = kit.noise(x * 0.05, y * 0.05);
        const v = lerp(155, 205, n);
        ctx.fillStyle = rgbStr(v, v * 0.91, v * 0.79);
        ctx.fillRect(x, y, 4, 4);
      }
    }

    // Layered smooth pebbles for rich granular look
    for (let i = 0; i < 1650; i++) {
      const px = kit.noise(i * 1.17, 4.31) * w;
      const py = kit.noise(8.92, i * 1.43) * h;
      const rx = 3.5 + kit.noise(i * 2.1, 1.7) * 8.5;
      const ry = rx * (0.62 + kit.noise(3.4, i * 1.9) * 0.45);
      const rot = kit.noise(i * 0.83, i * 0.41) * Math.PI * 2;
      const pIdx = Math.floor(kit.noise(i * 3.11, 2.7) * palette.length) % palette.length;
      const col = palette[pIdx];

      // Draw wrapped across edges for seamless tiling
      for (const ox of [-w, 0, w]) {
        for (const oy of [-h, 0, h]) {
          const cx = px + ox;
          const cy = py + oy;
          if (cx < -20 || cx > w + 20 || cy < -20 || cy > h + 20) continue;

          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(rot);

          // Soft crevice shadow
          ctx.fillStyle = "rgba(72, 58, 45, 0.38)";
          ctx.beginPath();
          ctx.ellipse(1.2, 1.4, rx * 1.06, ry * 1.06, 0, 0, Math.PI * 2);
          ctx.fill();

          // Pebble body with radial shading
          const grad = ctx.createRadialGradient(-rx * 0.25, -ry * 0.25, rx * 0.1, 0, 0, rx * 1.05);
          grad.addColorStop(0, rgbStr(lerp(col.r, 255, 0.32), lerp(col.g, 255, 0.3), lerp(col.b, 255, 0.25)));
          grad.addColorStop(0.7, rgbStr(col.r, col.g, col.b));
          grad.addColorStop(1, rgbStr(col.r * 0.72, col.g * 0.7, col.b * 0.68));
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2.2, 1.4);

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#303030";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1200; i++) {
      const px = kit.noise(i * 1.17, 4.31) * w;
      const py = kit.noise(8.92, i * 1.43) * h;
      const rx = 2.2 + kit.noise(i * 2.1, 1.7) * 4.5;
      const ry = rx * (0.65 + kit.noise(3.4, i * 1.9) * 0.4);
      const grad = ctx.createRadialGradient(px, py, 0.2, px, py, rx);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.75, "#9c9c9c");
      grad.addColorStop(1, "#202020");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(2.2, 1.4);

  return { map, bump };
}

function makeRiverStoneTexture(THREE, kit, baseRgb) {
  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = rgbStr(baseRgb.r, baseRgb.g, baseRgb.b);
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 3) {
        const n1 = kit.noise(x * 0.03, y * 0.03);
        const n2 = kit.noise(x * 0.12, y * 0.12);
        const f = 0.8 + (n1 * 0.7 + n2 * 0.3) * 0.34;
        ctx.fillStyle = rgbStr(baseRgb.r * f, baseRgb.g * f, baseRgb.b * f);
        ctx.fillRect(x, y, 3, 3);
      }
    }
    // Mineral flecks
    for (let i = 0; i < 180; i++) {
      const x = kit.noise(i * 1.9, 5.1) * w;
      const y = kit.noise(2.3, i * 1.7) * h;
      const r = 1 + kit.noise(i, 9.2) * 2.8;
      const bright = kit.noise(i * 2.5, 1.1) > 0.5;
      ctx.fillStyle = bright ? "rgba(255,250,240,0.18)" : "rgba(55,50,48,0.18)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function makeLeafTexture(THREE, kit, baseColor, tipColor, veinColor) {
  const map = kit.canvasTexture(256, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, baseColor);
    grad.addColorStop(0.65, baseColor);
    grad.addColorStop(1, tipColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle organic mottling
    for (let y = 0; y < h; y += 6) {
      for (let x = 0; x < w; x += 6) {
        const n = kit.noise(x * 0.04, y * 0.025);
        ctx.fillStyle = n > 0.5 ? "rgba(255,255,220,0.06)" : "rgba(10,45,25,0.08)";
        ctx.fillRect(x, y, 6, 6);
      }
    }

    // Central midrib vein
    ctx.strokeStyle = veinColor;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h);
    ctx.lineTo(w * 0.5, h * 0.06);
    ctx.stroke();

    // Sweeping lateral veins
    ctx.lineWidth = 2.4;
    ctx.globalAlpha = 0.65;
    for (let i = 1; i <= 11; i++) {
      const sy = h * (0.94 - i * 0.075);
      const ey = sy - h * 0.11;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(w * 0.5, sy);
        ctx.quadraticCurveTo(
          w * 0.5 + side * w * 0.24,
          sy - h * 0.03,
          w * 0.5 + side * w * 0.46,
          ey
        );
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function makeSpongeTextures(THREE, kit) {
  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#363b42";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      const x = kit.noise(i * 1.37, 2.91) * w;
      const y = kit.noise(6.13, i * 1.61) * h;
      const r = 1.2 + kit.noise(i * 2.7, 0.8) * 3.2;
      ctx.fillStyle = i % 3 === 0 ? "#202429" : "#4b525c";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 2);

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#a0a0a0";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      const x = kit.noise(i * 1.37, 2.91) * w;
      const y = kit.noise(6.13, i * 1.61) * h;
      const r = 1.2 + kit.noise(i * 2.7, 0.8) * 3.0;
      ctx.fillStyle = "#181818";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(3, 2);

  return { map, bump };
}

function makeFabricTexture(THREE, kit, accentHex) {
  const acc = hexToRgb(THREE, accentHex, "#f2a7b8");
  const cream = { r: 248, g: 241, b: 233 };
  const stripe = mixRgb(cream, acc, 0.45);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = rgbStr(cream.r, cream.g, cream.b);
    ctx.fillRect(0, 0, w, h);

    // Cozy dorm gingham/weave stripes
    ctx.fillStyle = rgbStr(stripe.r, stripe.g, stripe.b, 0.55);
    for (let x = 0; x < w; x += 32) {
      ctx.fillRect(x, 0, 12, h);
    }
    ctx.fillStyle = rgbStr(stripe.r, stripe.g, stripe.b, 0.35);
    for (let y = 0; y < h; y += 32) {
      ctx.fillRect(0, y, w, 12);
    }

    // Fine fabric weave threads
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const checker = ((x + y) / 4) % 2 === 0;
        ctx.fillStyle = checker ? "rgba(255,255,255,0.14)" : "rgba(120,100,90,0.08)";
        ctx.fillRect(x, y, 2, 2);
      }
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return map;
}

function makeFoodLabelTexture(THREE, kit, accentHex) {
  const acc = hexToRgb(THREE, accentHex, "#f2a7b8");
  const map = kit.canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = "#fff8ee";
    ctx.fillRect(0, 0, w, h);

    // Accent top and bottom bands
    ctx.fillStyle = rgbStr(acc.r, acc.g, acc.b);
    ctx.fillRect(0, 0, w, 18);
    ctx.fillRect(0, h - 18, w, 18);

    // Little cute fish silhouette icon on the front of the label
    ctx.save();
    ctx.translate(w * 0.5, h * 0.5);
    ctx.fillStyle = rgbStr(acc.r * 0.85, acc.g * 0.72, acc.b * 0.75);
    ctx.beginPath();
    ctx.ellipse(-4, 0, 22, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(30, -12);
    ctx.lineTo(27, 0);
    ctx.lineTo(30, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff8ee";
    ctx.beginPath();
    ctx.arc(-13, -3, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Little decorative bubbles
    ctx.fillStyle = "#a8d8eb";
    ctx.beginPath();
    ctx.arc(w * 0.32, h * 0.36, 4.5, 0, Math.PI * 2);
    ctx.arc(w * 0.28, h * 0.5, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

/**
 * Painted fish texture matching SphereGeometry UV layout:
 * v=1 (canvas y=0) = dorsal top, v=0 (canvas y=h) = belly bottom,
 * u=0.25 = nose (+z), u=0.75 = tail (-z), u=0 & 0.5 = flanks.
 */
function makeFishTexture(THREE, kit, config) {
  const { backCol, midCol, bellyCol, spotCol, stripeCol, style } = config;
  const map = kit.canvasTexture(512, 256, (ctx, w, h) => {
    // Smooth dorsal-to-belly vertical gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, backCol);
    grad.addColorStop(0.32, midCol);
    grad.addColorStop(0.68, midCol);
    grad.addColorStop(0.9, bellyCol);
    grad.addColorStop(1.0, bellyCol);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (style === "calico") {
      // Soft calico pastel/peach patches across flanks & dorsal back
      const patches = [
        [0.14, 0.34, 46, 34, spotCol],
        [0.36, 0.36, 44, 32, spotCol],
        [0.60, 0.32, 52, 36, spotCol],
        [0.88, 0.32, 48, 36, spotCol],
        [0.25, 0.22, 42, 24, stripeCol],
        [0.52, 0.50, 34, 24, bellyCol],
        [0.02, 0.48, 36, 24, bellyCol]
      ];
      for (const [ux, vy, rx, ry, col] of patches) {
        for (const shift of [-w, 0, w]) {
          const cx = ux * w + shift;
          const cy = vy * h;
          const pg = ctx.createRadialGradient(cx, cy, rx * 0.15, cx, cy, rx);
          pg.addColorStop(0, col);
          pg.addColorStop(0.75, col);
          pg.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = pg;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (style === "striped") {
      // Iridescent gentle vertical-curved bands along flanks
      ctx.globalAlpha = 0.45;
      for (let i = 0; i < 6; i++) {
        const uPos = 0.04 + i * 0.16;
        if (Math.abs(uPos - 0.25) < 0.09) continue; // Keep face clear
        ctx.fillStyle = i % 2 === 0 ? stripeCol : spotCol;
        ctx.beginPath();
        ctx.ellipse(uPos * w, h * 0.44, 14, h * 0.36, 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (style === "dorsalStripe") {
      // Cute horizontal lateral shimmer stripe + soft saddle
      const band = ctx.createLinearGradient(0, h * 0.35, 0, h * 0.58);
      band.addColorStop(0, "rgba(255,255,255,0)");
      band.addColorStop(0.5, stripeCol);
      band.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = band;
      ctx.fillRect(0, h * 0.35, w, h * 0.23);

      // Cute spots near tail peduncle
      ctx.fillStyle = spotCol;
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.arc(0.68 * w, 0.45 * h, 14, 0, Math.PI * 2);
      ctx.arc(0.82 * w, 0.45 * h, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Delicate overlapping scale arcs on mid-body
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 1.4;
    for (let row = 0; row < 10; row++) {
      const y = h * (0.22 + row * 0.056);
      const offset = (row % 2) * 11;
      for (let x = -12; x < w + 12; x += 22) {
        const u = x / w;
        // Skip nose/face region so cheeks stay clean and expressive
        if (u > 0.16 && u < 0.34) continue;
        ctx.beginPath();
        ctx.arc(x + offset, y, 10, -0.35 * Math.PI, 0.35 * Math.PI);
        ctx.stroke();
      }
    }

    // Soft pearl belly highlight
    const bellyGlow = ctx.createLinearGradient(0, h * 0.72, 0, h);
    bellyGlow.addColorStop(0, "rgba(255,250,245,0)");
    bellyGlow.addColorStop(1, "rgba(255,252,248,0.45)");
    ctx.fillStyle = bellyGlow;
    ctx.fillRect(0, h * 0.72, w, h * 0.28);
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

// ---------------------------------------------------------------------------
// Component Builders
// ---------------------------------------------------------------------------

/**
 * Low cozy wooden stand with turned Lathe legs, brass-accent ferrules,
 * beveled tabletop, lower shelf, tiny turned fish-food jar, and folded cloth.
 */
function buildLowStand(THREE, opts, kit, woodTex) {
  const stand = new THREE.Group();
  stand.name = "stand";

  const woodMat = new THREE.MeshPhysicalMaterial({
    map: woodTex.map,
    bumpMap: woodTex.bump,
    bumpScale: 0.0022,
    roughness: 0.56,
    metalness: 0.02,
    clearcoat: 0.22,
    clearcoatRoughness: 0.45
  });

  const woodDarkMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(opts.wood).multiplyScalar(0.84),
    map: woodTex.map,
    bumpMap: woodTex.bump,
    bumpScale: 0.002,
    roughness: 0.62,
    metalness: 0.02,
    clearcoat: 0.15
  });

  const brassMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#e4c384"),
    roughness: 0.28,
    metalness: 0.75,
    clearcoat: 0.4
  });

  const accentMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(opts.accent),
    roughness: 0.42,
    metalness: 0.04,
    clearcoat: 0.38,
    clearcoatRoughness: 0.28
  });

  // 1. Beveled tabletop (y = 0.235 .. 0.260)
  const topShape = roundedRectShape(THREE, 0.56, 0.36, 0.036);
  const topGeo = new THREE.ExtrudeGeometry(topShape, {
    depth: 0.017,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.005,
    bevelSegments: 4,
    curveSegments: 16
  });
  topGeo.rotateX(-Math.PI / 2);
  topGeo.translate(0, 0.239, 0);
  const topMesh = new THREE.Mesh(topGeo, woodMat);
  topMesh.userData.slot = "primary";
  topMesh.castShadow = true;
  topMesh.receiveShadow = true;
  stand.add(topMesh);

  // Subtle wooden apron under tabletop
  const apronShape = roundedRectShape(THREE, 0.49, 0.29, 0.028);
  const apronGeo = new THREE.ExtrudeGeometry(apronShape, {
    depth: 0.016,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 2,
    curveSegments: 12
  });
  apronGeo.rotateX(-Math.PI / 2);
  apronGeo.translate(0, 0.219, 0);
  const apronMesh = new THREE.Mesh(apronGeo, woodDarkMat);
  apronMesh.userData.slot = "primary";
  stand.add(apronMesh);

  // 2. Lower cozy shelf (y = 0.080 .. 0.095)
  const shelfShape = roundedRectShape(THREE, 0.48, 0.28, 0.028);
  const shelfGeo = new THREE.ExtrudeGeometry(shelfShape, {
    depth: 0.011,
    bevelEnabled: true,
    bevelThickness: 0.0025,
    bevelSize: 0.003,
    bevelSegments: 3,
    curveSegments: 14
  });
  shelfGeo.rotateX(-Math.PI / 2);
  shelfGeo.translate(0, 0.0825, 0);
  const shelfMesh = new THREE.Mesh(shelfGeo, woodMat);
  shelfMesh.userData.slot = "primary";
  shelfMesh.receiveShadow = true;
  stand.add(shelfMesh);

  // 3. Four Lathe-turned mid-century tapered legs (18 profile points)
  const legPts = [];
  const legProfile = [
    [0.001, 0.0],
    [0.0095, 0.0],
    [0.0112, 0.005],
    [0.0116, 0.016],
    [0.0124, 0.032],
    [0.0132, 0.048],
    [0.0126, 0.056],
    [0.0140, 0.072],
    [0.0156, 0.092],
    [0.0148, 0.104],
    [0.0158, 0.125],
    [0.0172, 0.150],
    [0.0184, 0.175],
    [0.0194, 0.198],
    [0.0180, 0.212],
    [0.0205, 0.224],
    [0.0212, 0.236],
    [0.001, 0.238]
  ];
  for (const [r, y] of legProfile) {
    legPts.push(new THREE.Vector2(r, y));
  }
  const legGeo = new THREE.LatheGeometry(legPts, 24);

  // Brass ferrule cap on lower part of each leg (16 points)
  const ferrulePts = [];
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const y = lerp(0.001, 0.036, t);
    const r = lerp(0.0102, 0.0132, t) + Math.sin(t * Math.PI) * 0.0005;
    ferrulePts.push(new THREE.Vector2(r, y));
  }
  const ferruleGeo = new THREE.LatheGeometry(ferrulePts, 20);

  const legOffsets = [
    [-0.225, -0.130, 0.065, -0.055],
    [0.225, -0.130, -0.065, -0.055],
    [-0.225, 0.130, 0.065, 0.055],
    [0.225, 0.130, -0.065, 0.055]
  ];

  for (const [lx, lz, rz, rx] of legOffsets) {
    const legGroup = new THREE.Group();
    legGroup.position.set(lx, 0, lz);
    legGroup.rotation.set(rx, 0, rz);

    const legMesh = new THREE.Mesh(legGeo, woodMat);
    legMesh.userData.slot = "primary";
    legMesh.castShadow = true;
    legGroup.add(legMesh);

    const fMesh = new THREE.Mesh(ferruleGeo, brassMat);
    fMesh.userData.slot = "secondary";
    legGroup.add(fMesh);

    stand.add(legGroup);
  }

  // 4. Tiny Lathe-turned fish-food jar resting on the lower shelf (left-front)
  const jarGroup = new THREE.Group();
  jarGroup.position.set(-0.145, 0.0955, 0.032);
  jarGroup.rotation.y = 0.35;

  const jarPts = [
    [0.001, 0.0],
    [0.019, 0.0],
    [0.022, 0.003],
    [0.023, 0.010],
    [0.0235, 0.024],
    [0.0235, 0.042],
    [0.023, 0.056],
    [0.0215, 0.064],
    [0.0185, 0.069],
    [0.0168, 0.072],
    [0.0172, 0.075],
    [0.0172, 0.080],
    [0.0165, 0.082],
    [0.0145, 0.082],
    [0.014, 0.075],
    [0.001, 0.074]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const jarGeo = new THREE.LatheGeometry(jarPts, 24);
  const jarMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#f5e3c2"),
    roughness: 0.25,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18
  });
  const jarMesh = new THREE.Mesh(jarGeo, jarMat);
  jarMesh.userData.slot = "secondary";
  jarGroup.add(jarMesh);

  // Cute printed fish-food label wrapped around the jar
  const labelTex = makeFoodLabelTexture(THREE, kit, opts.accent);
  const labelGeo = new THREE.CylinderGeometry(0.0239, 0.0239, 0.040, 24, 1, true);
  const labelMat = new THREE.MeshPhysicalMaterial({
    map: labelTex,
    roughness: 0.65,
    metalness: 0.0
  });
  const labelMesh = new THREE.Mesh(labelGeo, labelMat);
  labelMesh.position.y = 0.034;
  labelMesh.userData.slot = "accent";
  jarGroup.add(labelMesh);

  // Accent screw lid (16-point Lathe)
  const lidPts = [];
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    if (t < 0.15) {
      lidPts.push(new THREE.Vector2(lerp(0.017, 0.0195, t / 0.15), 0.071));
    } else if (t < 0.78) {
      const k = (t - 0.15) / 0.63;
      lidPts.push(new THREE.Vector2(0.0195 + Math.sin(k * Math.PI) * 0.0007, lerp(0.071, 0.085, k)));
    } else {
      const k = (t - 0.78) / 0.22;
      lidPts.push(new THREE.Vector2(lerp(0.0195, 0.001, k), lerp(0.085, 0.0875, k)));
    }
  }
  const lidMesh = new THREE.Mesh(new THREE.LatheGeometry(lidPts, 24), accentMat);
  lidMesh.userData.slot = "accent";
  jarGroup.add(lidMesh);
  stand.add(jarGroup);

  // 5. Folded cozy dorm cloth on the right side of the lower shelf
  const clothTex = makeFabricTexture(THREE, kit, opts.accent);
  const clothMat = new THREE.MeshPhysicalMaterial({
    map: clothTex,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.82,
    sheenRoughness: 0.85,
    sheenColor: new THREE.Color("#fff7f2")
  });

  const clothShape = roundedRectShape(THREE, 0.145, 0.115, 0.018);
  const clothGeo = new THREE.ExtrudeGeometry(clothShape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.005,
    bevelSegments: 4,
    curveSegments: 12
  });
  clothGeo.rotateX(-Math.PI / 2);
  deformGeometry(clothGeo, (x, y, z) => {
    const pillow = Math.cos(x * 16) * Math.cos(z * 18) * 0.003;
    const edgeDrop = -Math.max(0, (Math.abs(x) - 0.055) * 0.08);
    return [x, Math.max(0, y + pillow + edgeDrop), z];
  });
  const clothMesh = new THREE.Mesh(clothGeo, clothMat);
  clothMesh.position.set(0.115, 0.0955, 0.015);
  clothMesh.rotation.y = -0.18;
  clothMesh.userData.slot = "accent";
  stand.add(clothMesh);

  return stand;
}

/**
 * Glass tank, accent base & corner trim, silicone seams, rippled water surface,
 * and a cozy arched clip-on LED aquarium lamp.
 */
function buildTankAndLamp(THREE, opts) {
  const tankGroup = new THREE.Group();
  tankGroup.name = "tank";

  const W = 0.50;
  const D = 0.30;
  const H = 0.31;
  const baseY = 0.260;
  const wallT = 0.0055;

  const accentMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(opts.accent),
    roughness: 0.36,
    metalness: 0.04,
    clearcoat: 0.45,
    clearcoatRoughness: 0.22
  });

  // Soft pastel accent cradle tray under the tank
  const trayShape = roundedRectShape(THREE, W + 0.014, D + 0.014, 0.014);
  const trayGeo = new THREE.ExtrudeGeometry(trayShape, {
    depth: 0.013,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 3,
    curveSegments: 12
  });
  trayGeo.rotateX(-Math.PI / 2);
  trayGeo.translate(0, baseY + 0.002, 0);
  const trayMesh = new THREE.Mesh(trayGeo, accentMat);
  trayMesh.userData.slot = "accent";
  tankGroup.add(trayMesh);

  // Cute accent corner bumper clips on the top rim
  const cornerClipShape = roundedRectShape(THREE, 0.028, 0.028, 0.007);
  const cornerClipGeo = new THREE.ExtrudeGeometry(cornerClipShape, {
    depth: 0.011,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 2,
    curveSegments: 8
  });
  cornerClipGeo.rotateX(-Math.PI / 2);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const clip = new THREE.Mesh(cornerClipGeo, accentMat);
      clip.position.set(sx * (W * 0.5 - 0.006), baseY + H - 0.008, sz * (D * 0.5 - 0.006));
      clip.userData.slot = "accent";
      tankGroup.add(clip);
    }
  }

  // Translucent glass material tinted with opts.glass
  const glassColor = new THREE.Color(opts.glass || "#cfeaf5");
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: glassColor,
    roughness: 0.06,
    metalness: 0.02,
    transparent: true,
    opacity: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    reflectivity: 0.92,
    depthWrite: false
  });

  // Rim edge glass material (slightly brighter icy-aqua edge highlight for crisp silhouette)
  const glassEdgeMat = new THREE.MeshPhysicalMaterial({
    color: glassColor.clone().lerp(new THREE.Color("#ffffff"), 0.35),
    roughness: 0.12,
    metalness: 0.05,
    transparent: true,
    opacity: 0.48,
    clearcoat: 1.0,
    depthWrite: false
  });

  // 4 Glass walls
  const panelSpecs = [
    { w: W, h: H - 0.012, d: wallT, x: 0, y: baseY + 0.012 + (H - 0.012) * 0.5, z: D * 0.5 - wallT * 0.5 },
    { w: W, h: H - 0.012, d: wallT, x: 0, y: baseY + 0.012 + (H - 0.012) * 0.5, z: -D * 0.5 + wallT * 0.5 },
    { w: wallT, h: H - 0.012, d: D - wallT * 2, x: -W * 0.5 + wallT * 0.5, y: baseY + 0.012 + (H - 0.012) * 0.5, z: 0 },
    { w: wallT, h: H - 0.012, d: D - wallT * 2, x: W * 0.5 - wallT * 0.5, y: baseY + 0.012 + (H - 0.012) * 0.5, z: 0 }
  ];

  for (const p of panelSpecs) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), glassMat);
    mesh.position.set(p.x, p.y, p.z);
    mesh.renderOrder = 3;
    mesh.userData.slot = "secondary";
    tankGroup.add(mesh);
  }

  // Crisp luminous glass rim strips along top edge and vertical silicone corner beads
  const topRimY = baseY + H;
  const edgeBars = [
    [W, 0.005, 0.0055, 0, topRimY, D * 0.5 - 0.0028],
    [W, 0.005, 0.0055, 0, topRimY, -D * 0.5 + 0.0028],
    [0.0055, 0.005, D, -W * 0.5 + 0.0028, topRimY, 0],
    [0.0055, 0.005, D, W * 0.5 - 0.0028, topRimY, 0]
  ];
  for (const [bw, bh, bd, bx, by, bz] of edgeBars) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), glassEdgeMat);
    bar.position.set(bx, by, bz);
    bar.renderOrder = 3;
    bar.userData.slot = "secondary";
    tankGroup.add(bar);
  }

  // Silicone corner beads via tapered tubes
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx * (W * 0.5 - 0.004), baseY + 0.014, sz * (D * 0.5 - 0.004)),
        new THREE.Vector3(sx * (W * 0.5 - 0.004), baseY + H * 0.5, sz * (D * 0.5 - 0.004)),
        new THREE.Vector3(sx * (W * 0.5 - 0.004), baseY + H - 0.004, sz * (D * 0.5 - 0.004))
      ]);
      const beadGeo = createTaperedTubeGeometry(THREE, curve, 10, 8, () => 0.0032, false, false);
      const bead = new THREE.Mesh(beadGeo, glassEdgeMat);
      bead.renderOrder = 3;
      bead.userData.slot = "secondary";
      tankGroup.add(bead);
    }
  }

  // Sculpted gently rippled water surface (y = 0.535)
  const waterY = 0.535;
  const waterGeo = new THREE.PlaneGeometry(W - 0.013, D - 0.013, 36, 22);
  waterGeo.rotateX(-Math.PI / 2);
  // Concentric ripples radiating from the filter bubble spout at (-0.165, -0.075)
  deformGeometry(waterGeo, (x, y, z) => {
    const dx = x - (-0.165);
    const dz = z - (-0.075);
    const dist = Math.sqrt(dx * dx + dz * dz);
    const ripple = Math.sin(dist * 75) * Math.exp(-dist * 7.5) * 0.0028;
    const swell = Math.sin(x * 18 + z * 12) * 0.0009;
    return [x, y + ripple + swell, z];
  });

  const waterMat = new THREE.MeshPhysicalMaterial({
    color: glassColor.clone().lerp(new THREE.Color("#9de2f5"), 0.35),
    roughness: 0.08,
    metalness: 0.02,
    transparent: true,
    opacity: 0.38,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = waterY;
  waterMesh.renderOrder = 2;
  waterMesh.userData.slot = "secondary";
  tankGroup.add(waterMesh);

  // Expanding surface ripple rings right above the bubble spout
  const rippleRings = [];
  const ringMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#eefaff"),
    roughness: 0.1,
    transparent: true,
    opacity: 0.45,
    depthWrite: false
  });
  for (let i = 0; i < 3; i++) {
    const rGeo = new THREE.TorusGeometry(0.016, 0.0012, 8, 28);
    rGeo.rotateX(Math.PI / 2);
    const ring = new THREE.Mesh(rGeo, ringMat.clone());
    ring.position.set(-0.158, waterY + 0.0018, -0.075);
    ring.renderOrder = 2;
    ring.userData.slot = "secondary";
    tankGroup.add(ring);
    rippleRings.push({ mesh: ring, phase: i / 3 });
  }

  // Cozy arched clip-on dorm aquarium lamp on the back-center rim
  const lampGroup = new THREE.Group();
  lampGroup.name = "lamp";

  // Clip mount on back glass
  const clampShape = roundedRectShape(THREE, 0.054, 0.032, 0.008);
  const clampGeo = new THREE.ExtrudeGeometry(clampShape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 3,
    curveSegments: 10
  });
  clampGeo.translate(0, 0, -0.011);
  const clampMesh = new THREE.Mesh(clampGeo, accentMat);
  clampMesh.position.set(0, topRimY - 0.004, -D * 0.5);
  clampMesh.userData.slot = "accent";
  lampGroup.add(clampMesh);

  // Curved tapered gooseneck arm
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, topRimY + 0.008, -D * 0.5 - 0.002),
    new THREE.Vector3(0, topRimY + 0.058, -D * 0.5 + 0.005),
    new THREE.Vector3(0, topRimY + 0.076, -D * 0.5 + 0.068),
    new THREE.Vector3(0, topRimY + 0.068, -0.012)
  ]);
  const neckGeo = createTaperedTubeGeometry(
    THREE,
    neckCurve,
    24,
    14,
    (t) => lerp(0.0075, 0.0052, t),
    true,
    true
  );
  const neckMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#f4efe8"),
    roughness: 0.35,
    metalness: 0.15,
    clearcoat: 0.4
  });
  const neckMesh = new THREE.Mesh(neckGeo, neckMat);
  neckMesh.userData.slot = "secondary";
  lampGroup.add(neckMesh);

  // Sculpted pill-shaped lamp hood (continuous displaced sphere)
  const hoodGeo = new THREE.SphereGeometry(1, 36, 24);
  deformGeometry(hoodGeo, (x, y, z) => {
    const sx = x * 0.115;
    const sz = z * 0.028;
    const sy = y > 0 ? y * 0.014 : y * 0.004;
    const taper = 1 - 0.14 * Math.abs(x) * Math.abs(x);
    return [sx, sy * taper, sz * taper];
  });
  const hoodMesh = new THREE.Mesh(hoodGeo, accentMat);
  hoodMesh.position.set(0, topRimY + 0.066, -0.005);
  hoodMesh.userData.slot = "accent";
  lampGroup.add(hoodMesh);

  // Glowing warm LED diffuser bar on the underside of the lamp hood
  const ledGeo = new THREE.SphereGeometry(1, 24, 16);
  deformGeometry(ledGeo, (x, y, z) => [x * 0.095, y * 0.0045, z * 0.017]);
  const ledMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#fff7e2"),
    emissive: new THREE.Color("#ffebc2"),
    emissiveIntensity: 1.5,
    roughness: 0.25,
    metalness: 0.0
  });
  const ledMesh = new THREE.Mesh(ledGeo, ledMat);
  ledMesh.position.set(0, topRimY + 0.0615, -0.005);
  ledMesh.userData.slot = "glow";
  lampGroup.add(ledMesh);

  tankGroup.add(lampGroup);

  return { tankGroup, waterMesh, rippleRings, ledMat };
}

/**
 * Continuous sculpted gravel bed with terraced organic mounds + smooth sculpted river stones.
 */
function buildGravelAndStones(THREE, opts, kit) {
  const bedGroup = new THREE.Group();
  bedGroup.name = "gravelBed";

  const gravelTex = makeGravelTextures(THREE, kit, opts.wood, opts.accent);
  const gravelMat = new THREE.MeshPhysicalMaterial({
    map: gravelTex.map,
    bumpMap: gravelTex.bump,
    bumpScale: 0.0045,
    roughness: 0.86,
    metalness: 0.02
  });

  // Sculpted gravel volume from a dense subdivided box (continuous surface)
  const gw = 0.484;
  const gd = 0.284;
  const gh = 0.042;
  const bedGeo = new THREE.BoxGeometry(gw, gh, gd, 44, 6, 28);
  const baseFloorY = 0.273;

  deformGeometry(bedGeo, (x, y, z) => {
    // Normalize y from [-gh/2, +gh/2] to [0, 1]
    const ny = (y + gh * 0.5) / gh;
    if (ny <= 0.02) {
      return [x, baseFloorY, z];
    }
    // Gentle slope higher toward the back (-z) and corners, organic noise dunes
    const backSlope = smoothstep(0.14, -0.14, z) * 0.022;
    const cornerMound =
      Math.exp(-((x + 0.14) * (x + 0.14) + (z + 0.08) * (z + 0.08)) * 38) * 0.012 +
      Math.exp(-((x - 0.15) * (x - 0.15) + (z + 0.06) * (z + 0.06)) * 34) * 0.014;
    const dune = (kit.noise(x * 16 + 3.1, z * 16 + 1.7) - 0.5) * 0.012;
    const micro = (kit.noise(x * 46 + 8.4, z * 46 + 4.2) - 0.5) * 0.003;
    const topY = baseFloorY + 0.024 + backSlope + cornerMound + dune + micro;
    return [x, lerp(baseFloorY, topY, ny), z];
  });

  const bedMesh = new THREE.Mesh(bedGeo, gravelMat);
  bedMesh.userData.slot = "secondary";
  bedMesh.receiveShadow = true;
  bedGroup.add(bedMesh);

  // Smooth sculpted river stones nestled into the gravel
  const stoneSpecs = [
    { pos: [-0.042, 0.304, -0.028], scale: [0.036, 0.020, 0.027], rotY: 0.42, rgb: { r: 145, g: 148, b: 152 }, seed: 1.3 },
    { pos: [-0.122, 0.301, 0.012], scale: [0.024, 0.014, 0.020], rotY: -0.65, rgb: { r: 220, g: 205, b: 185 }, seed: 4.7 },
    { pos: [0.082, 0.305, -0.032], scale: [0.038, 0.022, 0.029], rotY: -0.35, rgb: { r: 162, g: 150, b: 140 }, seed: 7.2 },
    { pos: [0.118, 0.298, 0.056], scale: [0.022, 0.012, 0.018], rotY: 0.95, rgb: { r: 204, g: 166, b: 148 }, seed: 11.4 },
    { pos: [0.018, 0.298, 0.032], scale: [0.019, 0.010, 0.016], rotY: 0.25, rgb: { r: 188, g: 184, b: 174 }, seed: 15.8 }
  ];

  for (const s of stoneSpecs) {
    const sGeo = new THREE.SphereGeometry(1, 24, 16);
    deformGeometry(sGeo, (x, y, z) => {
      const n = kit.noise(x * 2.2 + s.seed, z * 2.2 + y * 1.5);
      const bump = 0.88 + n * 0.24;
      // Flatten underside so rock sits snugly in the gravel
      const fy = y < 0 ? y * 0.52 : y;
      return [x * s.scale[0] * bump, fy * s.scale[1] * bump, z * s.scale[2] * bump];
    });
    const sTex = makeRiverStoneTexture(THREE, kit, s.rgb);
    const sMat = new THREE.MeshPhysicalMaterial({
      map: sTex,
      roughness: 0.45,
      metalness: 0.02,
      clearcoat: 0.32,
      clearcoatRoughness: 0.35
    });
    const stone = new THREE.Mesh(sGeo, sMat);
    stone.position.set(s.pos[0], s.pos[1], s.pos[2]);
    stone.rotation.y = s.rotY;
    stone.userData.slot = "secondary";
    bedGroup.add(stone);
  }

  return bedGroup;
}

/**
 * Little bubbling sponge filter in the back-left corner with Lathe-turned sponge,
 * pastel-accent diffuser cap, tapered curved lift tube, suction cups, airline tubing,
 * and rising animated bubbles.
 */
function buildBubblingFilter(THREE, opts, kit) {
  const filterGroup = new THREE.Group();
  filterGroup.name = "filter";

  const fx = -0.175;
  const fz = -0.090;
  const baseY = 0.304;

  const spongeTex = makeSpongeTextures(THREE, kit);
  const spongeMat = new THREE.MeshPhysicalMaterial({
    map: spongeTex.map,
    bumpMap: spongeTex.bump,
    bumpScale: 0.0035,
    roughness: 0.94,
    metalness: 0.0,
    sheen: 0.35,
    sheenColor: new THREE.Color("#606a75")
  });

  const darkCapMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#424b54"),
    roughness: 0.42,
    metalness: 0.08,
    clearcoat: 0.35
  });

  const accentMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(opts.accent),
    roughness: 0.35,
    metalness: 0.04,
    clearcoat: 0.52,
    clearcoatRoughness: 0.2
  });

  const tubeMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(opts.glass || "#cfeaf5").lerp(new THREE.Color("#ffffff"), 0.4),
    roughness: 0.14,
    metalness: 0.02,
    transparent: true,
    opacity: 0.52,
    clearcoat: 0.9,
    depthWrite: false
  });

  const unit = new THREE.Group();
  unit.position.set(fx, baseY, fz);

  // 1. Weighted Lathe base (16 points)
  const basePts = [];
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const y = lerp(0, 0.018, t);
    const r = t < 0.15
      ? lerp(0.002, 0.028, t / 0.15)
      : t < 0.78
      ? 0.030 - Math.pow((t - 0.35), 2) * 0.012
      : lerp(0.027, 0.023, (t - 0.78) / 0.22);
    basePts.push(new THREE.Vector2(r, y));
  }
  const baseMesh = new THREE.Mesh(new THREE.LatheGeometry(basePts, 24), darkCapMat);
  baseMesh.userData.slot = "secondary";
  unit.add(baseMesh);

  // 2. Lathe-turned ribbed cylindrical sponge (20 profile points)
  const spongePts = [];
  for (let i = 0; i < 20; i++) {
    const t = i / 19;
    const y = lerp(0.016, 0.102, t);
    const groove = Math.sin(t * Math.PI * 10) * 0.0014;
    const bulge = Math.sin(t * Math.PI) * 0.002;
    const endRound = (t < 0.08 || t > 0.92) ? -0.003 : 0;
    const r = 0.0255 + groove + bulge + endRound;
    spongePts.push(new THREE.Vector2(r, y));
  }
  const spongeMesh = new THREE.Mesh(new THREE.LatheGeometry(spongePts, 28), spongeMat);
  spongeMesh.userData.slot = "secondary";
  unit.add(spongeMesh);

  // 3. Cute pastel-accent Lathe diffuser collar / motor cap (18 points)
  const capPts = [
    [0.022, 0.100],
    [0.026, 0.103],
    [0.027, 0.108],
    [0.0265, 0.114],
    [0.0245, 0.120],
    [0.021, 0.124],
    [0.0165, 0.127],
    [0.0135, 0.129],
    [0.0125, 0.133],
    [0.0122, 0.138],
    [0.0115, 0.141],
    [0.0102, 0.142],
    [0.0092, 0.140],
    [0.0090, 0.134],
    [0.0085, 0.126],
    [0.0075, 0.118],
    [0.006, 0.110],
    [0.002, 0.105]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const capMesh = new THREE.Mesh(new THREE.LatheGeometry(capPts, 24), accentMat);
  capMesh.userData.slot = "accent";
  unit.add(capMesh);

  // 4. Tapered curved bubble lift tube rising toward the surface
  const liftCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.132, 0),
    new THREE.Vector3(0.001, 0.168, 0.002),
    new THREE.Vector3(0.005, 0.198, 0.007),
    new THREE.Vector3(0.016, 0.212, 0.015)
  ]);
  const liftGeo = createTaperedTubeGeometry(
    THREE,
    liftCurve,
    22,
    14,
    (t) => lerp(0.0088, 0.0072, t) + (t > 0.85 ? (t - 0.85) * 0.018 : 0),
    false,
    false
  );
  const liftMesh = new THREE.Mesh(liftGeo, tubeMat);
  liftMesh.renderOrder = 1;
  liftMesh.userData.slot = "secondary";
  unit.add(liftMesh);

  // Accent spout collar ring
  const spoutRing = new THREE.Mesh(new THREE.TorusGeometry(0.0092, 0.002, 10, 20), accentMat);
  spoutRing.position.set(0.015, 0.211, 0.014);
  spoutRing.rotation.set(0.4, 0.6, -0.5);
  spoutRing.userData.slot = "accent";
  unit.add(spoutRing);

  // Two cute suction cups attaching filter to back glass
  const cupPts = [];
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const z = lerp(0, 0.012, t);
    const r = t < 0.35 ? lerp(0.0035, 0.0045, t / 0.35) : lerp(0.0045, 0.0115, (t - 0.35) / 0.65);
    cupPts.push(new THREE.Vector2(r, z));
  }
  const cupGeo = new THREE.LatheGeometry(cupPts, 18);
  cupGeo.rotateX(-Math.PI / 2);
  for (const cy of [0.065, 0.155]) {
    const cup = new THREE.Mesh(cupGeo, darkCapMat);
    cup.position.set(0, cy, -0.037);
    cup.userData.slot = "secondary";
    unit.add(cup);
  }

  filterGroup.add(unit);

  // 5. Silicone airline tubing looping neatly over back glass rim
  const airCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(fx + 0.011, baseY + 0.122, fz - 0.008),
    new THREE.Vector3(fx + 0.004, baseY + 0.155, -0.132),
    new THREE.Vector3(fx - 0.008, 0.542, -0.136),
    new THREE.Vector3(fx - 0.010, 0.576, -0.148),
    new THREE.Vector3(fx - 0.012, 0.558, -0.162),
    new THREE.Vector3(fx - 0.018, 0.390, -0.164),
    new THREE.Vector3(fx - 0.022, 0.252, -0.156)
  ]);
  const airGeo = createTaperedTubeGeometry(THREE, airCurve, 34, 10, () => 0.0028, true, true);
  const airMesh = new THREE.Mesh(airGeo, tubeMat);
  airMesh.renderOrder = 1;
  airMesh.userData.slot = "secondary";
  filterGroup.add(airMesh);

  // 6. Rising glossy bubbles (animated smoothly in idle())
  const bubbleMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#f0fbff"),
    roughness: 0.04,
    metalness: 0.05,
    transparent: true,
    opacity: 0.62,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    reflectivity: 1.0,
    depthWrite: false
  });
  const bubbleGeo = new THREE.SphereGeometry(1, 14, 10);
  const bubbles = [];

  for (let i = 0; i < 18; i++) {
    const fromSpout = i < 13;
    const mesh = new THREE.Mesh(bubbleGeo, bubbleMat);
    const radius = fromSpout
      ? 0.0024 + kit.noise(i * 1.9, 2.3) * 0.0046
      : 0.0018 + kit.noise(i * 2.7, 5.1) * 0.0026;
    const minY = fromSpout ? baseY + 0.208 : baseY + 0.125;
    const maxY = 0.533;
    const bx = fromSpout
      ? fx + 0.016 + (kit.noise(i * 3.1, 0.9) - 0.5) * 0.014
      : fx + (kit.noise(i * 1.4, 7.2) - 0.5) * 0.024;
    const bz = fromSpout
      ? fz + 0.015 + (kit.noise(4.2, i * 2.1) - 0.5) * 0.014
      : fz + (kit.noise(9.1, i * 1.8) - 0.5) * 0.024;

    mesh.scale.setScalar(radius);
    mesh.position.set(bx, lerp(minY, maxY, i / 18), bz);
    mesh.renderOrder = 1;
    mesh.userData.slot = "secondary";
    filterGroup.add(mesh);

    bubbles.push({
      mesh,
      baseX: bx,
      baseZ: bz,
      minY,
      maxY,
      speed: fromSpout ? 0.52 + (i % 5) * 0.08 : 0.34 + (i % 4) * 0.06,
      phase: i / 18,
      wobbleR: 0.004 + (i % 3) * 0.002,
      baseScale: radius
    });
  }

  return { filterGroup, bubbles };
}

/**
 * Two distinct lush aquatic plants using tapered curved stems + extruded,
 * beveled, vertex-bent leaves with painted vein textures.
 */
function buildAquaticPlants(THREE, opts, kit) {
  const plantsGroup = new THREE.Group();
  plantsGroup.name = "plants";
  const animatedFronds = [];

  // ---- PLANT 1: Broad-Leaf Amazon Sword / Anubias (left-center-back) ----
  const plant1 = new THREE.Group();
  plant1.name = "plantSword";
  plant1.position.set(-0.086, 0.304, -0.072);

  const leafTex1 = makeLeafTexture(THREE, kit, "#2e7a52", "#69b878", "#9ae09b");
  const leafMat1 = new THREE.MeshPhysicalMaterial({
    map: leafTex1,
    roughness: 0.42,
    metalness: 0.0,
    clearcoat: 0.25,
    clearcoatRoughness: 0.4,
    sheen: 0.35,
    sheenColor: new THREE.Color("#a8e6b4")
  });
  const stemMat1 = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#3b8759"),
    roughness: 0.55
  });

  // Broad heart-lanceolate extruded leaf shape (multi-bezier for smooth bend)
  const broadShape = new THREE.Shape();
  broadShape.moveTo(0, 0);
  broadShape.bezierCurveTo(0.015, 0.008, 0.028, 0.025, 0.026, 0.048);
  broadShape.bezierCurveTo(0.024, 0.070, 0.014, 0.092, 0, 0.106);
  broadShape.bezierCurveTo(-0.014, 0.092, -0.024, 0.070, -0.026, 0.048);
  broadShape.bezierCurveTo(-0.028, 0.025, -0.015, 0.008, 0, 0);

  const broadGeo = new THREE.ExtrudeGeometry(broadShape, {
    depth: 0.0018,
    bevelEnabled: true,
    bevelThickness: 0.0008,
    bevelSize: 0.0008,
    bevelSegments: 2,
    curveSegments: 14
  });
  // Normalize UVs to [0..1] for painted leaf veins
  {
    const pos = broadGeo.attributes.position;
    const uv = broadGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      uv.setXY(i, clamp((px + 0.028) / 0.056, 0, 1), clamp(py / 0.106, 0, 1));
    }
    uv.needsUpdate = true;
  }
  // Cup & arch the leaf smoothly
  deformGeometry(broadGeo, (x, y, z) => {
    const t = clamp(y / 0.106, 0, 1);
    const archZ = Math.sin(t * Math.PI * 0.85) * 0.014 + t * t * 0.018;
    const cupZ = -(x * x) * 14.0;
    const ripple = Math.sin(t * Math.PI * 3.5) * Math.abs(x) * 0.16;
    return [x, y, z + archZ + cupZ + ripple];
  });

  const swordSpecs = [
    { angle: 0.3, tilt: 0.42, stemH: 0.055, leafS: 0.92, bend: 0.018 },
    { angle: 1.25, tilt: 0.34, stemH: 0.078, leafS: 1.05, bend: 0.022 },
    { angle: 2.35, tilt: 0.38, stemH: 0.068, leafS: 0.95, bend: 0.016 },
    { angle: 3.45, tilt: 0.48, stemH: 0.048, leafS: 0.82, bend: 0.020 },
    { angle: 4.55, tilt: 0.30, stemH: 0.086, leafS: 1.08, bend: 0.015 },
    { angle: 5.55, tilt: 0.44, stemH: 0.052, leafS: 0.86, bend: 0.020 },
    { angle: 0.85, tilt: 0.16, stemH: 0.095, leafS: 0.96, bend: 0.012 }
  ];

  for (let i = 0; i < swordSpecs.length; i++) {
    const sp = swordSpecs[i];
    const frondPivot = new THREE.Group();
    frondPivot.rotation.y = sp.angle;

    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, sp.stemH * 0.5, sp.bend * 0.45),
      new THREE.Vector3(0, sp.stemH, sp.bend)
    ]);
    const stemGeo = createTaperedTubeGeometry(
      THREE,
      stemCurve,
      12,
      8,
      (t) => lerp(0.0036, 0.0020, t),
      false,
      true
    );
    const stemMesh = new THREE.Mesh(stemGeo, stemMat1);
    stemMesh.userData.slot = "secondary";
    frondPivot.add(stemMesh);

    const leafMesh = new THREE.Mesh(broadGeo, leafMat1);
    leafMesh.position.set(0, sp.stemH - 0.004, sp.bend);
    leafMesh.rotation.x = sp.tilt;
    leafMesh.scale.setScalar(sp.leafS);
    leafMesh.userData.slot = "secondary";
    frondPivot.add(leafMesh);

    plant1.add(frondPivot);
    animatedFronds.push({
      pivot: frondPivot,
      baseRotZ: 0,
      baseRotX: 0,
      phase: i * 0.9,
      speed: 1.35 + (i % 3) * 0.18,
      amp: 0.045
    });
  }
  plantsGroup.add(plant1);

  // ---- PLANT 2: Flowing Ribbon Vallisneria + Rosy-Tipped Accent Sprigs (right-back) ----
  const plant2 = new THREE.Group();
  plant2.name = "plantRibbon";
  plant2.position.set(0.145, 0.306, -0.062);

  const accCol = new THREE.Color(opts.accent);
  const rosyTip = "#" + new THREE.Color("#88c96b").lerp(accCol, 0.42).getHexString();
  const ribbonTex = makeLeafTexture(THREE, kit, "#3c8d56", "#8cd47a", "#b8f09c");
  const rosetteTex = makeLeafTexture(THREE, kit, "#4a965c", rosyTip, "#d6f2c2");

  const ribbonMat = new THREE.MeshPhysicalMaterial({
    map: ribbonTex,
    roughness: 0.44,
    clearcoat: 0.22,
    sheen: 0.4,
    sheenColor: new THREE.Color("#c6f2b4")
  });
  const rosetteMat = new THREE.MeshPhysicalMaterial({
    map: rosetteTex,
    roughness: 0.45,
    clearcoat: 0.2,
    sheen: 0.45,
    sheenColor: accCol.clone().lerp(new THREE.Color("#ffffff"), 0.5)
  });

  // Tall undulating ribbon blade (ExtrudeGeometry + gentle S-wave bend)
  const ribbonShape = new THREE.Shape();
  ribbonShape.moveTo(0, 0);
  ribbonShape.bezierCurveTo(0.0085, 0.035, 0.0095, 0.085, 0.008, 0.135);
  ribbonShape.bezierCurveTo(0.0065, 0.165, 0.004, 0.188, 0, 0.205);
  ribbonShape.bezierCurveTo(-0.004, 0.188, -0.0065, 0.165, -0.008, 0.135);
  ribbonShape.bezierCurveTo(-0.0095, 0.085, -0.0085, 0.035, 0, 0);

  const ribbonGeo = new THREE.ExtrudeGeometry(ribbonShape, {
    depth: 0.0014,
    bevelEnabled: true,
    bevelThickness: 0.0005,
    bevelSize: 0.0005,
    bevelSegments: 2,
    curveSegments: 18
  });
  {
    const pos = ribbonGeo.attributes.position;
    const uv = ribbonGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, clamp((pos.getX(i) + 0.01) / 0.02, 0, 1), clamp(pos.getY(i) / 0.205, 0, 1));
    }
    uv.needsUpdate = true;
  }
  deformGeometry(ribbonGeo, (x, y, z) => {
    const t = clamp(y / 0.205, 0, 1);
    const waveZ = Math.sin(t * Math.PI * 2.1) * 0.014 + t * t * 0.024;
    const driftX = -t * t * 0.022; // Flows softly toward center away from right wall
    const twist = t * 0.55;
    const rx = x * Math.cos(twist) - z * Math.sin(twist);
    const rz = x * Math.sin(twist) + z * Math.cos(twist);
    return [rx + driftX, y, rz + waveZ];
  });

  const ribbonSpecs = [
    { x: -0.018, z: -0.012, rotY: 0.4, sY: 1.02, sX: 1.05 },
    { x: 0.002, z: -0.018, rotY: 1.1, sY: 0.96, sX: 0.95 },
    { x: 0.020, z: -0.008, rotY: 2.0, sY: 0.88, sX: 1.0 },
    { x: -0.008, z: 0.008, rotY: -0.5, sY: 0.84, sX: 0.92 },
    { x: 0.014, z: 0.012, rotY: 2.8, sY: 0.78, sX: 0.96 },
    { x: -0.026, z: 0.006, rotY: 0.95, sY: 0.72, sX: 0.88 },
    { x: 0.028, z: 0.004, rotY: -1.4, sY: 0.82, sX: 0.90 }
  ];

  for (let i = 0; i < ribbonSpecs.length; i++) {
    const rs = ribbonSpecs[i];
    const pivot = new THREE.Group();
    pivot.position.set(rs.x, 0, rs.z);
    pivot.rotation.y = rs.rotY;

    const blade = new THREE.Mesh(ribbonGeo, ribbonMat);
    blade.scale.set(rs.sX, rs.sY, 1);
    blade.userData.slot = "secondary";
    pivot.add(blade);
    plant2.add(pivot);

    animatedFronds.push({
      pivot,
      baseRotZ: 0,
      baseRotX: 0,
      phase: i * 0.75 + 2.1,
      speed: 1.55 + (i % 3) * 0.2,
      amp: 0.068
    });
  }

  // Lower cluster of cute rounded rosy-tipped rosette leaves around the base of Plant 2
  const roundLeafShape = new THREE.Shape();
  roundLeafShape.moveTo(0, 0);
  roundLeafShape.bezierCurveTo(0.014, 0.005, 0.020, 0.020, 0.015, 0.036);
  roundLeafShape.bezierCurveTo(0.010, 0.048, -0.010, 0.048, -0.015, 0.036);
  roundLeafShape.bezierCurveTo(-0.020, 0.020, -0.014, 0.005, 0, 0);

  const roundLeafGeo = new THREE.ExtrudeGeometry(roundLeafShape, {
    depth: 0.0015,
    bevelEnabled: true,
    bevelThickness: 0.0007,
    bevelSize: 0.0007,
    bevelSegments: 2,
    curveSegments: 12
  });
  {
    const pos = roundLeafGeo.attributes.position;
    const uv = roundLeafGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, clamp((pos.getX(i) + 0.02) / 0.04, 0, 1), clamp(pos.getY(i) / 0.048, 0, 1));
    }
    uv.needsUpdate = true;
  }
  deformGeometry(roundLeafGeo, (x, y, z) => {
    const t = clamp(y / 0.048, 0, 1);
    return [x, y, z + Math.sin(t * Math.PI) * 0.007 - x * x * 12];
  });

  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + 0.4;
    const sprigPivot = new THREE.Group();
    sprigPivot.position.set(Math.cos(ang) * 0.018, 0.002, Math.sin(ang) * 0.016 + 0.018);
    sprigPivot.rotation.y = ang;

    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.025, 0.006),
      new THREE.Vector3(0, 0.046 + (i % 2) * 0.016, 0.014)
    ]);
    const stemGeo = createTaperedTubeGeometry(THREE, stemCurve, 10, 6, (t) => lerp(0.0024, 0.0013, t), false, true);
    const stem = new THREE.Mesh(stemGeo, stemMat1);
    stem.userData.slot = "secondary";
    sprigPivot.add(stem);

    const rLeaf = new THREE.Mesh(roundLeafGeo, rosetteMat);
    rLeaf.position.set(0, 0.044 + (i % 2) * 0.016, 0.014);
    rLeaf.rotation.x = 0.55;
    rLeaf.scale.setScalar(0.85 + (i % 3) * 0.14);
    rLeaf.userData.slot = "accent";
    sprigPivot.add(rLeaf);

    plant2.add(sprigPivot);
    animatedFronds.push({
      pivot: sprigPivot,
      baseRotZ: 0,
      baseRotX: 0,
      phase: i * 1.1 + 0.5,
      speed: 1.4,
      amp: 0.04
    });
  }

  plantsGroup.add(plant2);
  return { plantsGroup, animatedFronds };
}

/**
 * Builds one charming sculpted chibi fish:
 * - Single continuous body sculpted from a 48x32 sphere
 * - 3-layer glossy inset chibi eyes (dark glossy globe, coloured iris ring, highlight dots)
 * - Curved thin-tube happy mouth & soft rosy cheek blush discs
 * - Extruded, beveled, curved fins (caudal tail, dorsal, left/right pectorals, ventrals)
 */
function buildChibiFish(THREE, kit, spec) {
  const {
    isHero,
    length,
    height,
    width,
    tailStyle,
    irisHex,
    finColorHex,
    finTipHex,
    blushHex,
    slotName,
    texConfig
  } = spec;

  const root = new THREE.Group();
  root.name = spec.name;

  const bodyGroup = new THREE.Group();
  bodyGroup.name = isHero ? "body" : `${spec.name}_body`;
  root.add(bodyGroup);

  // Continuous sculpting function mapping unit sphere (ux, uy, uz) -> fish body point
  // Fish faces +z; tail peduncle at -z.
  function sculptBodyPoint(ux, uy, uz) {
    // Taper smoothly toward tail (-z) while keeping a plump chibi forehead & belly (+z)
    const backT = smoothstep(0.15, -1.0, uz);
    const widthProfile = lerp(1.0, 0.22, Math.pow(backT, 1.35));
    const heightProfile = lerp(1.0, 0.26, Math.pow(backT, 1.45));

    // Cute plump cheek bulge near head
    const cheekZone = Math.exp(-Math.pow(uz - 0.42, 2) * 5.5) * Math.exp(-Math.pow(uy + 0.08, 2) * 4.5);
    const cheekBulge = 1.0 + cheekZone * 0.16;

    // Gentle dorsal ridge narrowing so the top isn't boxy
    const dorsalPinch = uy > 0 ? 1.0 - Math.pow(uy, 2) * 0.24 : 1.0;

    // Rounded chibi belly fullness
    const bellyDrop = uy < 0 ? 1.0 + Math.exp(-Math.pow(uz - 0.12, 2) * 3.0) * 0.14 : 1.0;

    // Subtle snout rounding at front tip
    const snoutPull = smoothstep(0.62, 1.0, uz);
    const snoutYShift = -snoutPull * 0.08 * height;

    const sx = ux * width * widthProfile * cheekBulge * dorsalPinch;
    const sy = uy * height * heightProfile * bellyDrop + snoutYShift;
    const sz = uz * length * (uz < 0 ? 1.12 : 0.96);
    return [sx, sy, sz];
  }

  // 1. Sculpted body mesh (dense 48x32 sphere)
  const bodyGeo = new THREE.SphereGeometry(1, 48, 32);
  deformGeometry(bodyGeo, (x, y, z) => sculptBodyPoint(x, y, z));

  const fishTex = makeFishTexture(THREE, kit, texConfig);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    map: fishTex,
    roughness: 0.24,
    metalness: 0.06,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
    sheen: 0.35,
    sheenColor: new THREE.Color("#fff5f0")
  });

  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.userData.slot = slotName;
  bodyGroup.add(bodyMesh);

  // 2. Head feature group (eyes, blush, mouth) mounted seamlessly on the sculpted front
  const headGroup = new THREE.Group();
  headGroup.name = isHero ? "head" : `${spec.name}_head`;
  bodyGroup.add(headGroup);

  const eyeRadius = height * 0.245;
  const eyeDarkMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#14151c"),
    roughness: 0.05,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03
  });
  const irisMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(irisHex),
    roughness: 0.14,
    metalness: 0.08,
    clearcoat: 0.9
  });
  const highlightMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#ffffff"),
    emissive: new THREE.Color("#ffffff"),
    emissiveIntensity: 0.45,
    roughness: 0.05
  });

  const eyeGroups = {};
  for (const side of [-1, 1]) {
    // Evaluate exact point on the sculpted cheek/head surface so eyes sit slightly inset
    const dir = new THREE.Vector3(side * 0.72, 0.18, 0.67).normalize();
    const pt = sculptBodyPoint(dir.x, dir.y, dir.z);
    // Estimate local outward normal via finite difference
    const eps = 0.04;
    const pA = new THREE.Vector3(...sculptBodyPoint(dir.x, dir.y + eps, dir.z));
    const pB = new THREE.Vector3(...sculptBodyPoint(dir.x + side * eps, dir.y, dir.z));
    const p0 = new THREE.Vector3(...pt);
    const outNormal = new THREE.Vector3().subVectors(pA, p0).cross(new THREE.Vector3().subVectors(pB, p0));
    if (outNormal.x * side < 0) outNormal.negate();
    outNormal.normalize();

    const eyePivot = new THREE.Group();
    eyePivot.name = side < 0 ? "eyeL" : "eyeR";
    // Slightly inset into surface so eye never floats
    eyePivot.position.copy(p0).addScaledVector(outNormal, -eyeRadius * 0.22);
    eyePivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), outNormal);

    // Layer 1: Glossy dark eyeball dome
    const globe = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius, 20, 16), eyeDarkMat);
    globe.scale.set(1.0, 1.04, 0.72);
    globe.userData.slot = "eye";
    eyePivot.add(globe);

    // Layer 2: Coloured iris ring nestled around the pupil
    const iris = new THREE.Mesh(new THREE.TorusGeometry(eyeRadius * 0.62, eyeRadius * 0.21, 10, 24), irisMat);
    iris.position.z = eyeRadius * 0.56;
    iris.scale.set(1, 1.04, 0.55);
    iris.userData.slot = "eye";
    eyePivot.add(iris);

    // Layer 3: Two crisp white catchlight dots placed up and to one side
    const dotBig = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius * 0.24, 12, 10), highlightMat);
    dotBig.position.set(side * -eyeRadius * 0.28, eyeRadius * 0.30, eyeRadius * 0.70);
    dotBig.scale.z = 0.5;
    dotBig.userData.slot = "eye";
    eyePivot.add(dotBig);

    const dotSmall = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius * 0.12, 10, 8), highlightMat);
    dotSmall.position.set(side * eyeRadius * 0.24, -eyeRadius * 0.24, eyeRadius * 0.68);
    dotSmall.scale.z = 0.5;
    dotSmall.userData.slot = "eye";
    eyePivot.add(dotSmall);

    headGroup.add(eyePivot);
    if (side < 0) eyeGroups.eyeL = eyePivot;
    else eyeGroups.eyeR = eyePivot;

    // Subtle rosy cheek blush disc sitting flush on the lower cheek
    const bDir = new THREE.Vector3(side * 0.80, -0.15, 0.58).normalize();
    const bPt = sculptBodyPoint(bDir.x, bDir.y, bDir.z);
    const blushMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(blushHex),
      roughness: 0.75,
      transparent: true,
      opacity: 0.52,
      depthWrite: false
    });
    const blush = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius * 0.55, 14, 10), blushMat);
    blush.scale.set(1.2, 0.72, 0.25);
    blush.position.set(bPt[0] * 0.99, bPt[1], bPt[2] * 0.99);
    blush.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(side * 0.85, -0.1, 0.52).normalize()
    );
    blush.userData.slot = "accent";
    headGroup.add(blush);
  }

  // Cute curved mouth line built from a thin tapered tube at the front snout
  const mouthCenter = sculptBodyPoint(0, -0.16, 0.985);
  const mouthLeft = sculptBodyPoint(-0.22, -0.10, 0.955);
  const mouthRight = sculptBodyPoint(0.22, -0.10, 0.955);
  const mouthCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(mouthLeft[0], mouthLeft[1], mouthLeft[2] + 0.0008),
    new THREE.Vector3(mouthCenter[0], mouthCenter[1] - height * 0.04, mouthCenter[2] + 0.0014),
    new THREE.Vector3(mouthRight[0], mouthRight[1], mouthRight[2] + 0.0008)
  ]);
  const mouthGeo = createTaperedTubeGeometry(
    THREE,
    mouthCurve,
    12,
    8,
    (t) => height * 0.036 * (0.65 + 0.55 * Math.sin(t * Math.PI)),
    true,
    true
  );
  const mouthMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#7a3c48"),
    roughness: 0.35,
    clearcoat: 0.5
  });
  const mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
  mouthMesh.userData.slot = "accent";
  headGroup.add(mouthMesh);

  // Translucent iridescent fin material painted with gradient rays
  const finTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, h, w, 0);
    g.addColorStop(0, finColorHex);
    g.addColorStop(0.6, finColorHex);
    g.addColorStop(1, finTipHex);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Delicate fin rays
    ctx.strokeStyle = "rgba(255,255,255,0.34)";
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 14; i++) {
      const t = i / 13;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.5);
      ctx.lineTo(w, lerp(h * 0.05, h * 0.95, t));
      ctx.stroke();
    }
  });
  finTex.colorSpace = THREE.SRGBColorSpace;

  const finMat = new THREE.MeshPhysicalMaterial({
    map: finTex,
    roughness: 0.22,
    metalness: 0.04,
    transparent: true,
    opacity: 0.84,
    clearcoat: 0.75,
    clearcoatRoughness: 0.14,
    side: THREE.DoubleSide
  });

  // 3. Flowing Caudal (Tail) Fin — deeply overlapped into tail peduncle, extruded & wave-bent
  const tailGroup = new THREE.Group();
  tailGroup.name = isHero ? "tail" : `${spec.name}_tail`;
  tailGroup.position.set(0, 0, -length * 0.92);
  bodyGroup.add(tailGroup);

  const tailShape = new THREE.Shape();
  const tLen = tailStyle === "veil" ? length * 0.95 : tailStyle === "fan" ? length * 0.82 : length * 0.62;
  const tHalfH = tailStyle === "veil" ? height * 0.92 : tailStyle === "fan" ? height * 0.85 : height * 0.68;

  // Tail shape drawn in XY (x = backward length, y = vertical spread), then rotated to YZ plane
  tailShape.moveTo(0, height * 0.16);
  tailShape.bezierCurveTo(tLen * 0.35, tHalfH * 0.45, tLen * 0.72, tHalfH * 1.05, tLen, tHalfH * 0.88);
  tailShape.bezierCurveTo(tLen * 1.06, tHalfH * 0.52, tLen * 0.82, tHalfH * 0.16, tLen * (tailStyle === "fan" ? 0.94 : 0.62), 0);
  tailShape.bezierCurveTo(tLen * 0.82, -tHalfH * 0.16, tLen * 1.06, -tHalfH * 0.52, tLen, -tHalfH * 0.88);
  tailShape.bezierCurveTo(tLen * 0.72, -tHalfH * 1.05, tLen * 0.35, -tHalfH * 0.45, 0, -height * 0.16);
  tailShape.closePath();

  const tailGeo = new THREE.ExtrudeGeometry(tailShape, {
    depth: 0.0014,
    bevelEnabled: true,
    bevelThickness: 0.0005,
    bevelSize: 0.0005,
    bevelSegments: 2,
    curveSegments: 14
  });
  // Rotate so fin extends along -z and spreads along y, centered in x
  tailGeo.translate(0, 0, -0.0007);
  tailGeo.rotateY(Math.PI / 2);
  // Gentle graceful S-flutter wave in the tail fin
  deformGeometry(tailGeo, (x, y, z) => {
    const nt = clamp(-z / tLen, 0, 1);
    const waveX = Math.sin(nt * Math.PI * 1.65) * width * 0.24 * nt + Math.sin(y * 120) * 0.0012 * nt;
    return [x + waveX, y, z];
  });

  if (tailStyle === "veil") {
    // Double-lobed flowing fantail for the hero goldfish
    for (const s of [-1, 1]) {
      const lobe = new THREE.Mesh(tailGeo, finMat);
      lobe.rotation.y = s * 0.18;
      lobe.rotation.z = s * 0.08;
      lobe.userData.slot = slotName;
      tailGroup.add(lobe);
    }
  } else {
    const tailMesh = new THREE.Mesh(tailGeo, finMat);
    tailMesh.userData.slot = slotName;
    tailGroup.add(tailMesh);
  }

  // 4. Sculpted curved Dorsal Fin (extruded & bent)
  const dorsalShape = new THREE.Shape();
  const dLen = length * 0.78;
  const dH = tailStyle === "fan" ? height * 0.78 : height * 0.58;
  dorsalShape.moveTo(0, 0);
  dorsalShape.bezierCurveTo(dLen * 0.22, dH * 0.85, dLen * 0.65, dH * 1.15, dLen, dH * 0.62);
  dorsalShape.bezierCurveTo(dLen * 0.92, dH * 0.25, dLen * 0.78, 0.002, dLen * 0.62, -height * 0.10);
  dorsalShape.lineTo(0, -height * 0.12);
  dorsalShape.closePath();

  const dorsalGeo = new THREE.ExtrudeGeometry(dorsalShape, {
    depth: 0.0014,
    bevelEnabled: true,
    bevelThickness: 0.0005,
    bevelSize: 0.0005,
    bevelSegments: 2,
    curveSegments: 12
  });
  dorsalGeo.translate(0, 0, -0.0007);
  dorsalGeo.rotateY(Math.PI / 2);
  deformGeometry(dorsalGeo, (x, y, z) => {
    const nt = clamp(y / dH, 0, 1);
    return [x + Math.sin(nt * Math.PI) * width * 0.14, y, z];
  });
  const dorsalMesh = new THREE.Mesh(dorsalGeo, finMat);
  dorsalMesh.position.set(0, height * 0.76, length * 0.16);
  dorsalMesh.userData.slot = slotName;
  bodyGroup.add(dorsalMesh);

  // 5. Left & Right Fluttering Pectoral Fins (extruded, cupped & bent)
  const pecShape = new THREE.Shape();
  const pLen = length * 0.44;
  const pW = height * 0.36;
  pecShape.moveTo(0, 0);
  pecShape.bezierCurveTo(pLen * 0.35, pW * 0.72, pLen * 0.85, pW * 0.55, pLen, 0);
  pecShape.bezierCurveTo(pLen * 0.82, -pW * 0.55, pLen * 0.32, -pW * 0.52, 0, -pW * 0.12);
  pecShape.closePath();

  const pecGeo = new THREE.ExtrudeGeometry(pecShape, {
    depth: 0.0012,
    bevelEnabled: true,
    bevelThickness: 0.0004,
    bevelSize: 0.0004,
    bevelSegments: 2,
    curveSegments: 10
  });
  pecGeo.translate(0, 0, -0.0006);
  deformGeometry(pecGeo, (x, y, z) => {
    const t = clamp(x / pLen, 0, 1);
    return [x, y - t * t * pW * 0.25, z + Math.sin(t * Math.PI) * pW * 0.18];
  });

  const finL = new THREE.Group();
  finL.name = isHero ? "wingL" : `${spec.name}_finL`;
  const finR = new THREE.Group();
  finR.name = isHero ? "wingR" : `${spec.name}_finR`;

  for (const side of [-1, 1]) {
    const pPivot = side < 0 ? finL : finR;
    const anchor = sculptBodyPoint(side * 0.86, -0.26, 0.26);
    pPivot.position.set(anchor[0] * 0.90, anchor[1], anchor[2]);
    const mesh = new THREE.Mesh(pecGeo, finMat);
    if (side < 0) {
      mesh.rotation.y = Math.PI + 0.55;
      mesh.rotation.z = 0.25;
    } else {
      mesh.rotation.y = -0.55;
      mesh.rotation.z = -0.25;
    }
    mesh.userData.slot = slotName;
    pPivot.add(mesh);
    bodyGroup.add(pPivot);
  }

  // 6. Tiny ventral fins under the belly
  for (const side of [-1, 1]) {
    const vMesh = new THREE.Mesh(pecGeo, finMat);
    vMesh.scale.setScalar(0.58);
    vMesh.position.set(side * width * 0.26, -height * 0.78, -length * 0.08);
    vMesh.rotation.set(0.3, side < 0 ? Math.PI + 0.75 : -0.75, side * -0.65);
    vMesh.userData.slot = slotName;
    bodyGroup.add(vMesh);
  }

  return {
    root,
    body: bodyGroup,
    head: headGroup,
    tail: tailGroup,
    finL,
    finR,
    dorsal: dorsalMesh,
    eyeL: eyeGroups.eyeL,
    eyeR: eyeGroups.eyeR
  };
}

// ---------------------------------------------------------------------------
// Main Exports: build(THREE, opts, kit) & idle(group, t)
// ---------------------------------------------------------------------------

export function build(THREE, opts = {}, kit) {
  const cfg = {
    glass: opts.glass || "#cfeaf5",
    accent: opts.accent || "#f2a7b8",
    wood: opts.wood || "#c89462"
  };

  const root = new THREE.Group();
  root.name = "cozyDormAquarium";

  // 1. Low wooden stand with turned legs & cozy shelf props
  const woodTex = makeWoodTextures(THREE, kit, cfg.wood);
  const stand = buildLowStand(THREE, cfg, kit, woodTex);
  root.add(stand);

  // 2. Sculpted gravel bed & smooth river stones
  const gravel = buildGravelAndStones(THREE, cfg, kit);
  root.add(gravel);

  // 3. Bubbling sponge filter & rising bubbles
  const { filterGroup, bubbles } = buildBubblingFilter(THREE, cfg, kit);
  root.add(filterGroup);

  // 4. Two lush curved aquatic plants
  const { plantsGroup, animatedFronds } = buildAquaticPlants(THREE, cfg, kit);
  root.add(plantsGroup);

  // 5. Three charming sculpted chibi fish
  const fishGroup = new THREE.Group();
  fishGroup.name = "fishSchool";
  const animatedFish = [];

  const accColor = new THREE.Color(cfg.accent);
  const heroBack = "#" + accColor.clone().lerp(new THREE.Color("#f0785a"), 0.45).getHexString();
  const heroMid = "#" + accColor.clone().lerp(new THREE.Color("#ffd1ba"), 0.35).getHexString();
  const heroSpot = "#" + accColor.clone().lerp(new THREE.Color("#e85d75"), 0.35).getHexString();
  const heroFin = "#" + accColor.clone().lerp(new THREE.Color("#ffe3d9"), 0.42).getHexString();

  const glassColor = new THREE.Color(cfg.glass);
  const blueBack = "#" + glassColor.clone().lerp(new THREE.Color("#2b7fb8"), 0.72).getHexString();
  const blueMid = "#" + glassColor.clone().lerp(new THREE.Color("#56b8e0"), 0.62).getHexString();
  const blueFin = "#" + glassColor.clone().lerp(new THREE.Color("#88dbf5"), 0.5).getHexString();

  const fishSpecs = [
    {
      name: "heroGoldfish",
      isHero: true,
      length: 0.032,
      height: 0.022,
      width: 0.0155,
      tailStyle: "veil",
      irisHex: "#7c4734",
      finColorHex: heroFin,
      finTipHex: "#fff7f2",
      blushHex: cfg.accent,
      slotName: "accent",
      texConfig: {
        backCol: heroBack,
        midCol: heroMid,
        bellyCol: "#fff6ec",
        spotCol: heroSpot,
        stripeCol: "#f59d78",
        style: "calico"
      },
      basePos: [-0.010, 0.432, 0.042],
      baseRotY: 0.48,
      basePitch: -0.06,
      phase: 0.0,
      speed: 0.85,
      ampX: 0.026,
      ampY: 0.010,
      ampZ: 0.014,
      blinkOffset: 0.4
    },
    {
      name: "blueBetta",
      isHero: false,
      length: 0.027,
      height: 0.0165,
      width: 0.0115,
      tailStyle: "fan",
      irisHex: "#285f8c",
      finColorHex: blueFin,
      finTipHex: "#edfaff",
      blushHex: "#f4a9bd",
      slotName: "secondary",
      texConfig: {
        backCol: blueBack,
        midCol: blueMid,
        bellyCol: "#eef8fc",
        spotCol: "#8de0f0",
        stripeCol: "#3489bd",
        style: "striped"
      },
      basePos: [0.115, 0.468, 0.040],
      baseRotY: -2.28,
      basePitch: 0.05,
      phase: 2.1,
      speed: 0.74,
      ampX: 0.022,
      ampY: 0.009,
      ampZ: 0.012,
      blinkOffset: 2.1
    },
    {
      name: "honeyTetra",
      isHero: false,
      length: 0.023,
      height: 0.0175,
      width: 0.013,
      tailStyle: "fork",
      irisHex: "#6e4d26",
      finColorHex: "#ffe19e",
      finTipHex: "#fff9e6",
      blushHex: cfg.accent,
      slotName: "accent",
      texConfig: {
        backCol: "#e69c47",
        midCol: "#f7cb74",
        bellyCol: "#fff8e6",
        spotCol: "#e88464",
        stripeCol: heroBack,
        style: "dorsalStripe"
      },
      basePos: [-0.122, 0.378, 0.058],
      baseRotY: 0.78,
      basePitch: -0.04,
      phase: 4.3,
      speed: 0.96,
      ampX: 0.020,
      ampY: 0.008,
      ampZ: 0.012,
      blinkOffset: 3.4
    }
  ];

  for (const spec of fishSpecs) {
    const f = buildChibiFish(THREE, kit, spec);
    f.root.position.set(spec.basePos[0], spec.basePos[1], spec.basePos[2]);
    f.root.rotation.set(spec.basePitch, spec.baseRotY, 0);
    fishGroup.add(f.root);

    animatedFish.push({
      ...f,
      basePos: spec.basePos,
      baseRotY: spec.baseRotY,
      basePitch: spec.basePitch,
      phase: spec.phase,
      speed: spec.speed,
      ampX: spec.ampX,
      ampY: spec.ampY,
      ampZ: spec.ampZ,
      blinkOffset: spec.blinkOffset
    });
  }
  root.add(fishGroup);

  // 6. Glass tank, rippled water surface & cozy glowing clip-on lamp
  const { tankGroup, waterMesh, rippleRings, ledMat } = buildTankAndLamp(THREE, cfg);
  root.add(tankGroup);

  // Store animation handles cleanly on root.userData
  root.userData.anim = {
    fish: animatedFish,
    fronds: animatedFronds,
    bubbles,
    waterMesh,
    rippleRings,
    ledMat
  };

  return root;
}

export function idle(group, t) {
  const anim = group && group.userData && group.userData.anim;
  if (!anim) return;

  // 1. Animate all three chibi fish (gentle figure-8 swimming, tail wag, fin flutter, head sway, periodic blink)
  for (const f of anim.fish) {
    const p = t * f.speed + f.phase;
    const dx = Math.sin(p) * f.ampX;
    const dy = Math.sin(p * 1.45 + 0.6) * f.ampY;
    const dz = Math.sin(p * 0.75 + 1.2) * f.ampZ;

    f.root.position.set(
      f.basePos[0] + dx,
      f.basePos[1] + dy,
      f.basePos[2] + dz
    );

    // Subtle steering yaw & gentle pitch breathing
    const yawOffset = Math.cos(p) * 0.22;
    f.root.rotation.y = f.baseRotY + yawOffset;
    f.root.rotation.x = f.basePitch + Math.cos(p * 1.45 + 0.6) * 0.08;
    f.root.rotation.z = Math.sin(p * 1.1) * 0.05;

    // Rhythmic swimming tail wag + slight counter-sway on body/head
    const wagPhase = t * (5.2 + f.speed * 1.8) + f.phase * 2.0;
    f.body.rotation.y = Math.sin(wagPhase) * 0.055;
    f.head.rotation.y = -Math.sin(wagPhase - 0.5) * 0.04;
    f.tail.rotation.y = Math.sin(wagPhase - 1.1) * 0.34;
    f.dorsal.rotation.z = Math.sin(wagPhase - 0.7) * 0.09;

    // Pectoral fin flutter
    const flutter = Math.sin(t * 7.5 + f.phase) * 0.28;
    f.finL.rotation.y = flutter;
    f.finR.rotation.y = -flutter;

    // Gentle gill/breathing scale pulse
    const breath = 1.0 + Math.sin(t * 2.8 + f.phase) * 0.022;
    f.body.scale.set(breath, 1.0 + (breath - 1.0) * 0.5, 1.0);

    // Periodic cute blink every ~4.2 seconds by scaling eye groups on Y
    const blinkCycle = (t + f.blinkOffset) % 4.2;
    let eyeScaleY = 1.0;
    if (blinkCycle < 0.16) {
      const k = blinkCycle / 0.16;
      eyeScaleY = 1.0 - Math.sin(k * Math.PI) * 0.88;
    }
    f.eyeL.scale.y = eyeScaleY;
    f.eyeR.scale.y = eyeScaleY;
  }

  // 2. Sway aquatic plant fronds gently in the filter current
  for (const fr of anim.fronds) {
    const s = Math.sin(t * fr.speed + fr.phase);
    const s2 = Math.cos(t * fr.speed * 0.65 + fr.phase * 1.3);
    fr.pivot.rotation.z = fr.baseRotZ + s * fr.amp;
    fr.pivot.rotation.x = fr.baseRotX + s2 * fr.amp * 0.65;
  }

  // 3. Rising & wobbling bubble stream from the bubbling filter
  for (const b of anim.bubbles) {
    const u = (t * b.speed + b.phase) % 1;
    const y = lerp(b.minY, b.maxY, u);
    const wobbleX = Math.sin(t * 4.5 + b.phase * 12) * b.wobbleR * u;
    const wobbleZ = Math.cos(t * 3.9 + b.phase * 15) * b.wobbleR * u;
    b.mesh.position.set(b.baseX + wobbleX, y, b.baseZ + wobbleZ);

    // Slight pop growth near water surface, smooth spawn at bottom
    const fadeIn = smoothstep(0.0, 0.12, u);
    const popOut = 1.0 - smoothstep(0.92, 1.0, u);
    const grow = 0.85 + u * 0.35;
    b.mesh.scale.setScalar(b.baseScale * grow * fadeIn * popOut);
  }

  // 4. Water surface gentle shimmer & expanding surface ripple rings above filter
  anim.waterMesh.position.y = 0.535 + Math.sin(t * 2.4) * 0.0009;
  for (const r of anim.rippleRings) {
    const u = (t * 0.58 + r.phase) % 1;
    const sc = 0.35 + u * 2.15;
    r.mesh.scale.set(sc, 1, sc);
    r.mesh.material.opacity = (1.0 - u) * (1.0 - u) * 0.42;
  }

  // 5. Soft cozy LED breathing on the clip-on lamp
  if (anim.ledMat) {
    anim.ledMat.emissiveIntensity = 1.48 + Math.sin(t * 1.5) * 0.08;
  }
}
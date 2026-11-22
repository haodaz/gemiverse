export const META = {
  id: "paper-lantern",
  name: "Hanging Paper Lantern",
  kind: "prop",
  footprint: [0.46, 0.46],
  variants: [
    { name: "Cozy Dorm Cream", paper: "#ffe9c9", accent: "#d9534f", glow: "#ffd27a" },
    { name: "Sakura Blush", paper: "#ffe4e6", accent: "#b84357", glow: "#ffc999" },
    { name: "Matcha Study", paper: "#eef2d5", accent: "#5c7a52", glow: "#ffe08a" },
    { name: "Midnight Ink", paper: "#f6ead8", accent: "#354b6e", glow: "#ffca6e" }
  ],
  note: "Sculpted ribbed washi-paper lantern with turned lacquer rings, glowing inner bulb, silk tassel, and curved charm tag."
};

const DEFAULT_OPTS = {
  paper: "#ffe9c9",
  accent: "#d9534f",
  glow: "#ffd27a"
};

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function rgbStr(c, alpha = 1) {
  const r = Math.round(clamp(c.r, 0, 1) * 255);
  const g = Math.round(clamp(c.g, 0, 1) * 255);
  const b = Math.round(clamp(c.b, 0, 1) * 255);
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha.toFixed(3)})` : `rgb(${r},${g},${b})`;
}

function shadeColor(THREE, hex, mul = 1, add = 0) {
  const c = new THREE.Color(hex);
  c.r = clamp(c.r * mul + add, 0, 1);
  c.g = clamp(c.g * mul + add, 0, 1);
  c.b = clamp(c.b * mul + add, 0, 1);
  return c;
}

function mixColors(THREE, hexA, hexB, t) {
  return new THREE.Color(hexA).lerp(new THREE.Color(hexB), clamp(t, 0, 1));
}

function seededRand(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function createTaperedTube(THREE, curve, tubularSegments, radialSegments, radiusFn, options = {}) {
  const closed = Boolean(options.closed);
  const capStart = options.capStart !== undefined ? options.capStart : !closed;
  const capEnd = options.capEnd !== undefined ? options.capEnd : !closed;

  const frames = curve.computeFrenetFrames(tubularSegments, closed);
  const positions = [];
  const uvs = [];
  const indices = [];

  const ringCount = tubularSegments + 1;
  const vertPerRing = radialSegments + 1;
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const b = new THREE.Vector3();
  const v = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments;
    curve.getPointAt(closed && i === tubularSegments ? 0 : u, p);
    const frameIdx = closed && i === tubularSegments ? 0 : i;
    n.copy(frames.normals[frameIdx]);
    b.copy(frames.binormals[frameIdx]);
    const r = Math.max(0.00015, typeof radiusFn === "function" ? radiusFn(u) : radiusFn);

    for (let j = 0; j <= radialSegments; j++) {
      const a = (j / radialSegments) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      v.copy(p).addScaledVector(n, ca * r).addScaledVector(b, sa * r);
      positions.push(v.x, v.y, v.z);
      uvs.push(j / radialSegments, u);
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * vertPerRing + j;
      const bIdx = (i + 1) * vertPerRing + j;
      const c = (i + 1) * vertPerRing + (j + 1);
      const d = i * vertPerRing + (j + 1);
      indices.push(a, bIdx, d);
      indices.push(bIdx, c, d);
    }
  }

  if (capStart) {
    curve.getPointAt(0, p);
    const centerIdx = positions.length / 3;
    positions.push(p.x, p.y, p.z);
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegments; j++) {
      indices.push(centerIdx, j + 1, j);
    }
  }

  if (capEnd) {
    curve.getPointAt(1, p);
    const centerIdx = positions.length / 3;
    positions.push(p.x, p.y, p.z);
    uvs.push(0.5, 1);
    const base = tubularSegments * vertPerRing;
    for (let j = 0; j < radialSegments; j++) {
      indices.push(centerIdx, base + j, base + j + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createHorizontalRibGeo(THREE, sampleFn, ringSegments, tubeSegments, tubeRadius) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const vertPerRing = tubeSegments + 1;

  const up = new THREE.Vector3(0, 1, 0);
  const radDir = new THREE.Vector3();
  const pt = new THREE.Vector3();

  for (let i = 0; i <= ringSegments; i++) {
    const u = i / ringSegments;
    const phi = u * Math.PI * 2;
    sampleFn(phi, pt);
    radDir.set(Math.cos(phi), 0, Math.sin(phi));

    for (let j = 0; j <= tubeSegments; j++) {
      const a = (j / tubeSegments) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const x = pt.x + radDir.x * ca * tubeRadius;
      const y = pt.y + up.y * sa * tubeRadius;
      const z = pt.z + radDir.z * ca * tubeRadius;
      positions.push(x, y, z);
      uvs.push(u * 6, j / tubeSegments);
    }
  }

  for (let i = 0; i < ringSegments; i++) {
    for (let j = 0; j < tubeSegments; j++) {
      const a = i * vertPerRing + j;
      const b = (i + 1) * vertPerRing + j;
      const c = (i + 1) * vertPerRing + (j + 1);
      const d = i * vertPerRing + (j + 1);
      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildPaperTextures(THREE, kit, cfg, ribUs) {
  const baseCol = new THREE.Color(cfg.paper);
  const warmMid = mixColors(THREE, cfg.paper, cfg.glow, 0.22);
  const warmEdge = shadeColor(THREE, cfg.paper, 0.87, -0.02);
  const accentSoft = mixColors(THREE, cfg.accent, cfg.paper, 0.55);
  const glowCol = new THREE.Color(cfg.glow);
  const glowDeep = mixColors(THREE, cfg.glow, cfg.accent, 0.35);

  const colorTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, rgbStr(warmEdge));
    grad.addColorStop(0.18, rgbStr(baseCol));
    grad.addColorStop(0.5, rgbStr(warmMid));
    grad.addColorStop(0.82, rgbStr(baseCol));
    grad.addColorStop(1.0, rgbStr(warmEdge));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Seamless mottled washi pulp grain
    const step = 4;
    for (let y = 0; y < h; y += step) {
      const ny = y / h;
      for (let x = 0; x < w; x += step) {
        const ang = (x / w) * Math.PI * 2;
        const n1 = kit.noise(Math.cos(ang) * 2.6 + 5.0, Math.sin(ang) * 2.6 + ny * 7.5);
        const n2 = kit.noise(Math.cos(ang) * 7.2 + 13.0, Math.sin(ang) * 7.2 + ny * 18.0);
        const v = (n1 * 0.65 + n2 * 0.35) - 0.5;
        if (Math.abs(v) > 0.03) {
          ctx.fillStyle = v > 0
            ? `rgba(255,250,240,${(v * 0.24).toFixed(3)})`
            : `rgba(145,105,68,${(-v * 0.16).toFixed(3)})`;
          ctx.fillRect(x, y, step, step);
        }
      }
    }

    // Handmade mulberry paper fibers
    const rand = seededRand(4109);
    ctx.lineCap = "round";
    for (let i = 0; i < 420; i++) {
      const fx = rand() * w;
      const fy = rand() * h;
      const len = 8 + rand() * 26;
      const angle = rand() * Math.PI * 2;
      const cx = fx + Math.cos(angle + 0.5) * len * 0.5;
      const cy = fy + Math.sin(angle + 0.5) * len * 0.5;
      const ex = fx + Math.cos(angle) * len;
      const ey = fy + Math.sin(angle) * len;

      const isLight = rand() > 0.42;
      ctx.strokeStyle = isLight
        ? `rgba(255,252,245,${(0.16 + rand() * 0.2).toFixed(3)})`
        : `rgba(175,132,88,${(0.08 + rand() * 0.12).toFixed(3)})`;
      ctx.lineWidth = 0.6 + rand() * 1.1;

      for (let wrap = -1; wrap <= 1; wrap++) {
        const ox = wrap * w;
        if (fx + ox < -40 || fx + ox > w + 40) continue;
        ctx.beginPath();
        ctx.moveTo(fx + ox, fy);
        ctx.quadraticCurveTo(cx + ox, cy, ex + ox, ey);
        ctx.stroke();
      }
    }

    // Subtle delicate warm-gold & soft-accent speckles embedded in paper
    for (let i = 0; i < 95; i++) {
      const sx = rand() * w;
      const sy = (0.12 + rand() * 0.76) * h;
      const r = 0.7 + rand() * 1.6;
      ctx.fillStyle = rand() > 0.35
        ? rgbStr(glowCol, 0.25 + rand() * 0.2)
        : rgbStr(accentSoft, 0.16 + rand() * 0.15);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle horizontal rib crease shading aligned with 3D ribs
    for (let i = 0; i < ribUs.length; i++) {
      const cy = ribUs[i] * h;
      const rGrad = ctx.createLinearGradient(0, cy - 5, 0, cy + 5);
      rGrad.addColorStop(0.0, "rgba(120,82,48,0)");
      rGrad.addColorStop(0.5, "rgba(120,82,48,0.16)");
      rGrad.addColorStop(1.0, "rgba(120,82,48,0)");
      ctx.fillStyle = rGrad;
      ctx.fillRect(0, cy - 5, w, 10);
    }
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.ClampToEdgeWrapping;

  const bumpTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, w, h);

    const step = 4;
    for (let y = 0; y < h; y += step) {
      const ny = y / h;
      for (let x = 0; x < w; x += step) {
        const ang = (x / w) * Math.PI * 2;
        const n = kit.noise(Math.cos(ang) * 4.5 + 2.0, Math.sin(ang) * 4.5 + ny * 12.0);
        const v = Math.round(108 + n * 42);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, step, step);
      }
    }

    const rand = seededRand(4109);
    ctx.lineCap = "round";
    for (let i = 0; i < 320; i++) {
      const fx = rand() * w;
      const fy = rand() * h;
      const len = 8 + rand() * 24;
      const angle = rand() * Math.PI * 2;
      const cx = fx + Math.cos(angle + 0.5) * len * 0.5;
      const cy = fy + Math.sin(angle + 0.5) * len * 0.5;
      const ex = fx + Math.cos(angle) * len;
      const ey = fy + Math.sin(angle) * len;
      ctx.strokeStyle = "rgba(215,215,215,0.22)";
      ctx.lineWidth = 0.8 + rand() * 0.9;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.quadraticCurveTo(cx, cy, ex, ey);
      ctx.stroke();
    }

    // Indented groove along ribs
    for (let i = 0; i < ribUs.length; i++) {
      const cy = ribUs[i] * h;
      const g = ctx.createLinearGradient(0, cy - 6, 0, cy + 6);
      g.addColorStop(0.0, "rgba(180,180,180,0)");
      g.addColorStop(0.3, "rgba(190,190,190,0.35)");
      g.addColorStop(0.5, "rgba(45,45,45,0.65)");
      g.addColorStop(0.7, "rgba(190,190,190,0.35)");
      g.addColorStop(1.0, "rgba(180,180,180,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, cy - 6, w, 12);
    }
  });
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.ClampToEdgeWrapping;

  const emissiveTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    // Warm core glow from the inner bulb fading gently toward top and bottom rings
    const eGrad = ctx.createLinearGradient(0, 0, 0, h);
    eGrad.addColorStop(0.0, rgbStr(shadeColor(THREE, cfg.glow, 0.28)));
    eGrad.addColorStop(0.14, rgbStr(shadeColor(THREE, glowDeep.getStyle ? cfg.glow : cfg.glow, 0.62)));
    eGrad.addColorStop(0.36, rgbStr(glowCol));
    eGrad.addColorStop(0.50, rgbStr(shadeColor(THREE, cfg.glow, 1.0, 0.14)));
    eGrad.addColorStop(0.64, rgbStr(glowCol));
    eGrad.addColorStop(0.86, rgbStr(shadeColor(THREE, cfg.glow, 0.58)));
    eGrad.addColorStop(1.0, rgbStr(shadeColor(THREE, cfg.glow, 0.25)));
    ctx.fillStyle = eGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle internal translucency mottling
    const step = 6;
    for (let y = 0; y < h; y += step) {
      const ny = y / h;
      for (let x = 0; x < w; x += step) {
        const ang = (x / w) * Math.PI * 2;
        const n = kit.noise(Math.cos(ang) * 3.0 + 7.0, Math.sin(ang) * 3.0 + ny * 9.0);
        const shade = (n - 0.5) * 0.22;
        if (shade < 0) {
          ctx.fillStyle = `rgba(90,45,15,${(-shade).toFixed(3)})`;
          ctx.fillRect(x, y, step, step);
        }
      }
    }

    // Soft internal rib silhouette lines blocking light slightly
    for (let i = 0; i < ribUs.length; i++) {
      const cy = ribUs[i] * h;
      const g = ctx.createLinearGradient(0, cy - 4, 0, cy + 4);
      g.addColorStop(0.0, "rgba(75,32,10,0)");
      g.addColorStop(0.5, "rgba(75,32,10,0.48)");
      g.addColorStop(1.0, "rgba(75,32,10,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, cy - 4, w, 8);
    }

    // Delicate warm amber tint near poles
    const topDim = ctx.createLinearGradient(0, 0, 0, h * 0.18);
    topDim.addColorStop(0, rgbStr(glowDeep, 0.45));
    topDim.addColorStop(1, rgbStr(glowDeep, 0));
    ctx.fillStyle = topDim;
    ctx.fillRect(0, 0, w, h * 0.18);
  });
  emissiveTex.colorSpace = THREE.SRGBColorSpace;
  emissiveTex.wrapS = THREE.RepeatWrapping;
  emissiveTex.wrapT = THREE.ClampToEdgeWrapping;

  return { colorTex, bumpTex, emissiveTex };
}

function buildWoodAccentTextures(THREE, kit, cfg) {
  const base = new THREE.Color(cfg.accent);
  const dark = shadeColor(THREE, cfg.accent, 0.62);
  const light = shadeColor(THREE, cfg.accent, 1.15, 0.04);

  const colorTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = rgbStr(base);
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < h; y += 2) {
      const ny = y / h;
      for (let x = 0; x < w; x += 4) {
        const ang = (x / w) * Math.PI * 2;
        const n = kit.noise(Math.cos(ang) * 1.8 + 4.0, ny * 18.0 + Math.sin(ang) * 0.8);
        const c = n > 0.5 ? light : dark;
        ctx.fillStyle = rgbStr(c, Math.abs(n - 0.5) * 0.55);
        ctx.fillRect(x, y, 4, 2);
      }
    }

    // Subtle dark satin edge shading along lathe height
    const edgeGrad = ctx.createLinearGradient(0, 0, 0, h);
    edgeGrad.addColorStop(0, "rgba(25,10,8,0.28)");
    edgeGrad.addColorStop(0.25, "rgba(255,255,255,0.06)");
    edgeGrad.addColorStop(0.75, "rgba(255,255,255,0.04)");
    edgeGrad.addColorStop(1, "rgba(25,10,8,0.32)");
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, 0, w, h);
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.ClampToEdgeWrapping;

  const bumpTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      const ny = y / h;
      for (let x = 0; x < w; x += 4) {
        const ang = (x / w) * Math.PI * 2;
        const n = kit.noise(Math.cos(ang) * 2.2 + 9.0, ny * 22.0);
        const v = Math.round(95 + n * 65);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 4, 2);
      }
    }
  });
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.ClampToEdgeWrapping;

  return { colorTex, bumpTex };
}

function buildSilkTextures(THREE, kit, cfg) {
  const base = new THREE.Color(cfg.accent);
  const bright = shadeColor(THREE, cfg.accent, 1.22, 0.08);
  const deep = shadeColor(THREE, cfg.accent, 0.58);

  const colorTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, rgbStr(deep));
    grad.addColorStop(0.32, rgbStr(base));
    grad.addColorStop(0.65, rgbStr(bright));
    grad.addColorStop(1.0, rgbStr(shadeColor(THREE, cfg.accent, 0.82)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Fine vertical silk thread striations
    for (let x = 0; x < w; x += 2) {
      const ang = (x / w) * Math.PI * 2;
      const n = kit.noise(Math.cos(ang) * 9.0 + 3.0, Math.sin(ang) * 9.0 + 1.5);
      ctx.fillStyle = n > 0.5
        ? rgbStr(bright, (n - 0.5) * 0.55)
        : rgbStr(deep, (0.5 - n) * 0.65);
      ctx.fillRect(x, 0, 2, h);
    }
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.ClampToEdgeWrapping;

  const bumpTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 2) {
      const ang = (x / w) * Math.PI * 2;
      const n = kit.noise(Math.cos(ang) * 14.0 + 1.0, Math.sin(ang) * 14.0 + 2.0);
      const v = Math.round(70 + n * 115);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, 0, 2, h);
    }
  });
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.ClampToEdgeWrapping;

  return { colorTex, bumpTex };
}

function buildCharmTexture(THREE, kit, cfg) {
  const paper = new THREE.Color(cfg.paper);
  const accent = new THREE.Color(cfg.accent);
  const gold = mixColors(THREE, cfg.glow, "#c89b3c", 0.55);

  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = rgbStr(paper);
    ctx.fillRect(0, 0, w, h);

    // Subtle paper grain
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const n = kit.noise(x * 0.05 + 3.1, y * 0.05 + 8.4) - 0.5;
        ctx.fillStyle = n > 0
          ? `rgba(255,250,240,${(n * 0.25).toFixed(3)})`
          : `rgba(150,110,70,${(-n * 0.16).toFixed(3)})`;
        ctx.fillRect(x, y, 4, 4);
      }
    }

    // Delicate inner border
    ctx.strokeStyle = rgbStr(accent, 0.72);
    ctx.lineWidth = 5;
    ctx.strokeRect(24, 24, w - 48, h - 48);

    ctx.strokeStyle = rgbStr(gold, 0.65);
    ctx.lineWidth = 2;
    ctx.strokeRect(34, 34, w - 68, h - 68);

    // Cozy hand-painted crescent moon & little star emblem
    ctx.save();
    ctx.translate(w * 0.5, h * 0.52);

    ctx.fillStyle = rgbStr(accent, 0.85);
    ctx.beginPath();
    ctx.arc(-4, 0, 34, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = rgbStr(paper);
    ctx.beginPath();
    ctx.arc(10, -8, 29, 0, Math.PI * 2);
    ctx.fill();

    // Small golden four-point star
    ctx.fillStyle = rgbStr(gold, 0.95);
    ctx.beginPath();
    const sx = 18;
    const sy = -14;
    const sr = 12;
    ctx.moveTo(sx, sy - sr);
    ctx.quadraticCurveTo(sx + 2, sy - 2, sx + sr, sy);
    ctx.quadraticCurveTo(sx + 2, sy + 2, sx, sy + sr);
    ctx.quadraticCurveTo(sx - 2, sy + 2, sx - sr, sy);
    ctx.quadraticCurveTo(sx - 2, sy - 2, sx, sy - sr);
    ctx.fill();

    // Tiny accent dot
    ctx.fillStyle = rgbStr(accent, 0.7);
    ctx.beginPath();
    ctx.arc(-28, 36, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(26, 32, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildCordBumpTexture(THREE, kit) {
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#d8d8d8";
    ctx.lineWidth = 5;
    for (let i = -h; i < w + h; i += 14) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h, h);
      ctx.stroke();
    }
    ctx.strokeStyle = "#484848";
    ctx.lineWidth = 3;
    for (let i = -h + 7; i < w + h; i += 14) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h, h);
      ctx.stroke();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 18);
  return tex;
}

function buildTopRingGeometry(THREE) {
  // 26-point turned lacquered wood collar gripping the top paper opening
  const pts = [
    [0.044, -0.016],
    [0.046, -0.015],
    [0.049, -0.008],
    [0.052, 0.002],
    [0.054, 0.012],
    [0.056, 0.020],
    [0.060, 0.025],
    [0.065, 0.027],
    [0.070, 0.026],
    [0.074, 0.022],
    [0.075, 0.017],
    [0.073, 0.013],
    [0.071, 0.010],
    [0.074, 0.006],
    [0.077, 0.001],
    [0.079, -0.005],
    [0.079, -0.012],
    [0.077, -0.017],
    [0.074, -0.020],
    [0.069, -0.020],
    [0.066, -0.017],
    [0.063, -0.011],
    [0.059, -0.006],
    [0.054, -0.009],
    [0.049, -0.014],
    [0.044, -0.016]
  ].map(([x, y]) => new THREE.Vector2(x, y));

  const geo = new THREE.LatheGeometry(pts, 48);
  geo.computeVertexNormals();
  return geo;
}

function buildBottomRingGeometry(THREE) {
  // 26-point turned lacquered wood bottom ring with recessed seat & decorative rim
  const pts = [
    [0.036, 0.014],
    [0.040, 0.013],
    [0.046, 0.009],
    [0.052, 0.008],
    [0.058, 0.013],
    [0.064, 0.018],
    [0.069, 0.019],
    [0.072, 0.016],
    [0.073, 0.010],
    [0.072, 0.003],
    [0.069, -0.003],
    [0.067, -0.006],
    [0.069, -0.010],
    [0.068, -0.015],
    [0.064, -0.019],
    [0.058, -0.021],
    [0.050, -0.022],
    [0.040, -0.022],
    [0.028, -0.024],
    [0.018, -0.027],
    [0.011, -0.030],
    [0.006, -0.032],
    [0.001, -0.032],
    [0.001, -0.010],
    [0.018, -0.004],
    [0.036, 0.014]
  ].map(([x, y]) => new THREE.Vector2(x, y));

  const geo = new THREE.LatheGeometry(pts, 48);
  geo.computeVertexNormals();
  return geo;
}

function buildCeilingCanopyGeometry(THREE) {
  // 20-point turned wooden ceiling rosette
  const pts = [
    [0.001, 0.036],
    [0.056, 0.036],
    [0.056, 0.030],
    [0.053, 0.025],
    [0.048, 0.021],
    [0.045, 0.017],
    [0.044, 0.013],
    [0.039, 0.009],
    [0.033, 0.006],
    [0.026, 0.004],
    [0.019, 0.002],
    [0.014, -0.001],
    [0.011, -0.005],
    [0.010, -0.009],
    [0.008, -0.012],
    [0.006, -0.013],
    [0.005, -0.010],
    [0.004, 0.005],
    [0.003, 0.022],
    [0.001, 0.036]
  ].map(([x, y]) => new THREE.Vector2(x, y));

  const geo = new THREE.LatheGeometry(pts, 36);
  geo.computeVertexNormals();
  return geo;
}

function buildBeadGeometry(THREE, rScale = 1) {
  const pts = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * Math.PI;
    const y = Math.cos(a) * 0.0145 * rScale;
    const bulge = Math.sin(a);
    const r = Math.max(0.0028 * rScale, (0.003 + 0.0125 * Math.pow(bulge, 0.78)) * rScale);
    pts.push(new THREE.Vector2(r, y));
  }
  const geo = new THREE.LatheGeometry(pts, 28);
  geo.computeVertexNormals();
  return geo;
}

function buildEdisonBulbGeometry(THREE) {
  // 22-point vintage teardrop filament bulb profile
  const pts = [
    [0.001, -0.052],
    [0.008, -0.051],
    [0.016, -0.048],
    [0.023, -0.042],
    [0.028, -0.034],
    [0.031, -0.024],
    [0.032, -0.013],
    [0.031, -0.002],
    [0.028, 0.008],
    [0.024, 0.017],
    [0.020, 0.024],
    [0.016, 0.031],
    [0.014, 0.038],
    [0.013, 0.044],
    [0.012, 0.049],
    [0.011, 0.052],
    [0.001, 0.052]
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(pts, 28);
  geo.computeVertexNormals();
  return geo;
}

function buildBulbSocketGeometry(THREE) {
  const pts = [
    [0.001, 0.036],
    [0.013, 0.036],
    [0.015, 0.032],
    [0.015, 0.024],
    [0.014, 0.020],
    [0.015, 0.016],
    [0.014, 0.011],
    [0.015, 0.007],
    [0.013, 0.002],
    [0.011, 0.000],
    [0.010, -0.005],
    [0.009, -0.010],
    [0.007, -0.013],
    [0.005, -0.016],
    [0.003, -0.018],
    [0.001, -0.018]
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(pts, 24);
  geo.computeVertexNormals();
  return geo;
}

function buildTasselCapGeometry(THREE) {
  // 20-point silk-wrapped cinch cap
  const pts = [
    [0.002, 0.022],
    [0.005, 0.021],
    [0.008, 0.018],
    [0.011, 0.014],
    [0.013, 0.010],
    [0.014, 0.006],
    [0.013, 0.003],
    [0.015, 0.000],
    [0.015, -0.004],
    [0.013, -0.007],
    [0.014, -0.010],
    [0.015, -0.014],
    [0.014, -0.017],
    [0.012, -0.019],
    [0.009, -0.019],
    [0.002, -0.016]
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(pts, 28);
  geo.computeVertexNormals();
  return geo;
}

function buildSculptedTasselCore(THREE, kit) {
  // 22-point gently flared silk tassel skirt sculpted with organic pleats & subtle drape
  const profile = [];
  const steps = 22;
  const len = 0.21;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = -t * len;
    const flare = 0.010 + 0.017 * Math.pow(t, 0.85) + 0.003 * Math.sin(t * Math.PI);
    const pinchTip = t > 0.92 ? 1.0 - smoothstep(0.92, 1.0, t) * 0.25 : 1.0;
    profile.push(new THREE.Vector2(flare * pinchTip, y));
  }
  const geo = new THREE.LatheGeometry(profile, 36);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = clamp(-y / len, 0, 1);
    const ang = Math.atan2(z, x);
    const r = Math.hypot(x, z);

    // Organic silk pleats + gentle resting curve
    const pleat = 1.0
      + 0.12 * Math.sin(ang * 11 + t * 1.4) * smoothstep(0.08, 0.55, t)
      + 0.07 * Math.cos(ang * 7 - t * 1.1) * t
      + (kit.noise(Math.cos(ang) * 2.5 + 4.0, Math.sin(ang) * 2.5 + t * 3.5) - 0.5) * 0.14 * t;

    const drapeX = 0.0045 * t * t;
    const drapeZ = -0.003 * t * t;
    const nr = r * pleat;
    pos.setXYZ(i, Math.cos(ang) * nr + drapeX, y, Math.sin(ang) * nr + drapeZ);
  }

  geo.computeVertexNormals();
  return geo;
}

function buildCurvedCharmGeometry(THREE) {
  // Scalloped lantern charm tag built with bezierCurveTo, beveled and organically curved
  const shape = new THREE.Shape();
  const w = 0.022;
  const h = 0.036;
  shape.moveTo(0, h);
  shape.bezierCurveTo(w * 0.65, h, w, h * 0.72, w * 0.92, h * 0.36);
  shape.bezierCurveTo(w * 1.08, 0.0, w * 1.02, -h * 0.55, w * 0.75, -h * 0.85);
  shape.bezierCurveTo(w * 0.42, -h * 1.04, -w * 0.42, -h * 1.04, -w * 0.75, -h * 0.85);
  shape.bezierCurveTo(-w * 1.02, -h * 0.55, -w * 1.08, 0.0, -w * 0.92, h * 0.36);
  shape.bezierCurveTo(-w, h * 0.72, -w * 0.65, h, 0, h);

  const hole = new THREE.Path();
  hole.absarc(0, h * 0.68, 0.0032, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0022,
    bevelEnabled: true,
    bevelThickness: 0.0009,
    bevelSize: 0.0008,
    bevelSegments: 3,
    curveSegments: 16
  });

  geo.translate(0, 0, -0.0011);

  // Normalize UVs to [0, 1] and apply organic paper curl
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const sx = bb.max.x - bb.min.x || 1;
  const sy = bb.max.y - bb.min.y || 1;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = (x - bb.min.x) / sx;
    const ny = (y - bb.min.y) / sy;
    uv.setXY(i, nx, ny);

    // Gentle S-curl + slight transverse arch so tag feels like real handmade card
    const bendZ = Math.sin((ny - 0.5) * Math.PI) * 0.0042 + Math.pow((nx - 0.5) * 2, 2) * 0.0022;
    const twistX = (ny - 0.5) * 0.0018;
    pos.setXYZ(i, x + twistX, y, z + bendZ);
  }

  geo.computeVertexNormals();
  return geo;
}

export function build(THREE, opts = {}, kit) {
  const cfg = {
    paper: opts.paper || DEFAULT_OPTS.paper,
    accent: opts.accent || DEFAULT_OPTS.accent,
    glow: opts.glow || DEFAULT_OPTS.glow
  };

  const root = new THREE.Group();
  root.name = "paper-lantern";

  // Vertical layout (metres, Y up, origin on floor at y = 0)
  const CEILING_Y = 1.82;
  const GLOBE_CENTER_Y = 1.15;
  const GLOBE_H_HALF = 0.188;
  const GLOBE_R_EQ = 0.225;
  const THETA_TOP = 0.285;
  const THETA_BOT = Math.PI - 0.275;
  const THETA_SPAN = THETA_BOT - THETA_TOP;

  // 13 thin horizontal bamboo/wire ribs between top and bottom collars
  const NUM_RIBS = 13;
  const ribUs = [];
  for (let i = 1; i <= NUM_RIBS; i++) {
    ribUs.push(i / (NUM_RIBS + 1));
  }

  // Shared surface sculpting function for the lantern paper & fitted ribs
  function lanternSurfacePoint(theta, phi, out) {
    const u = clamp((theta - THETA_TOP) / THETA_SPAN, 0, 1);
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);

    // Full oblate lantern contour slightly fuller on upper shoulders, graceful narrower bottom
    const shoulderBias = 1.0 + 0.04 * cosT;
    let r = GLOBE_R_EQ * Math.pow(Math.max(0.001, sinT), 0.84) * shoulderBias;

    // Smooth collar tuck at top and bottom rims so paper seats cleanly into turned rings
    const topTuck = smoothstep(0.0, 0.055, u);
    const botTuck = smoothstep(1.0, 0.945, u);
    const rTopCollar = 0.068;
    const rBotCollar = 0.062;
    r = r * topTuck + rTopCollar * (1 - topTuck);
    r = r * botTuck + rBotCollar * (1 - botTuck);

    // Scalloped paper pillowing between adjacent horizontal ribs
    const bayFloat = u * (NUM_RIBS + 1);
    const bayPhase = bayFloat - Math.floor(bayFloat);
    const scallop = Math.sin(bayPhase * Math.PI) * 0.0044 * Math.pow(sinT, 0.7) * topTuck * botTuck;

    // Gentle organic handmade paper waviness (periodic in phi => zero seam)
    const cPhi = Math.cos(phi);
    const sPhi = Math.sin(phi);
    const organic = (kit.noise(cPhi * 2.2 + 3.7, sPhi * 2.2 + u * 5.2) - 0.5) * 0.0048 * sinT * topTuck * botTuck;
    const subtleFlute = Math.cos(phi * 10) * 0.0011 * sinT * topTuck * botTuck;

    const finalR = r + scallop + organic + subtleFlute;
    const y = GLOBE_H_HALF * cosT * (1.0 - 0.05 * sinT * sinT);

    out.set(finalR * cPhi, y, finalR * sPhi);
    return out;
  }

  // Textures
  const paperTex = buildPaperTextures(THREE, kit, cfg, ribUs);
  const woodTex = buildWoodAccentTextures(THREE, kit, cfg);
  const silkTex = buildSilkTextures(THREE, kit, cfg);
  const charmTex = buildCharmTexture(THREE, kit, cfg);
  const cordBumpTex = buildCordBumpTexture(THREE, kit);

  // Materials (MeshPhysicalMaterial throughout)
  const paperMat = new THREE.MeshPhysicalMaterial({
    map: paperTex.colorTex,
    bumpMap: paperTex.bumpTex,
    bumpScale: 0.0022,
    emissive: new THREE.Color(cfg.glow),
    emissiveMap: paperTex.emissiveTex,
    emissiveIntensity: 0.92,
    roughness: 0.89,
    metalness: 0.0,
    sheen: 0.72,
    sheenRoughness: 0.82,
    sheenColor: shadeColor(THREE, cfg.paper, 1.0, 0.14),
    side: THREE.DoubleSide
  });

  const accentLacquerMat = new THREE.MeshPhysicalMaterial({
    map: woodTex.colorTex,
    bumpMap: woodTex.bumpTex,
    bumpScale: 0.0012,
    roughness: 0.34,
    metalness: 0.04,
    clearcoat: 0.68,
    clearcoatRoughness: 0.24
  });

  const brassMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#d8b268"),
    roughness: 0.28,
    metalness: 0.82,
    clearcoat: 0.35,
    clearcoatRoughness: 0.22
  });

  const ribMat = new THREE.MeshPhysicalMaterial({
    color: shadeColor(THREE, "#6b4d32", 1.0),
    roughness: 0.62,
    metalness: 0.18,
    sheen: 0.25,
    sheenColor: new THREE.Color("#a88762")
  });

  const cordMat = new THREE.MeshPhysicalMaterial({
    color: shadeColor(THREE, cfg.accent, 0.78),
    bumpMap: cordBumpTex,
    bumpScale: 0.0025,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.75,
    sheenRoughness: 0.85,
    sheenColor: shadeColor(THREE, cfg.accent, 1.15, 0.1)
  });

  const silkMat = new THREE.MeshPhysicalMaterial({
    map: silkTex.colorTex,
    bumpMap: silkTex.bumpTex,
    bumpScale: 0.0028,
    roughness: 0.86,
    metalness: 0.0,
    sheen: 0.92,
    sheenRoughness: 0.58,
    sheenColor: shadeColor(THREE, cfg.accent, 1.25, 0.16)
  });

  const charmMat = new THREE.MeshPhysicalMaterial({
    map: charmTex,
    bumpMap: paperTex.bumpTex,
    bumpScale: 0.0012,
    roughness: 0.86,
    metalness: 0.0,
    sheen: 0.55,
    sheenColor: shadeColor(THREE, cfg.paper, 1.0, 0.12)
  });

  const bulbMat = new THREE.MeshPhysicalMaterial({
    color: shadeColor(THREE, cfg.glow, 1.0, 0.2),
    emissive: new THREE.Color(cfg.glow),
    emissiveIntensity: 2.1,
    roughness: 0.14,
    metalness: 0.0,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1
  });

  const haloMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(cfg.glow),
    emissive: new THREE.Color(cfg.glow),
    emissiveIntensity: 1.4,
    roughness: 1.0,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide
  });

  // 1. "head" group: fixed ceiling canopy mount at y = CEILING_Y
  const headGroup = new THREE.Group();
  headGroup.name = "head";
  headGroup.position.set(0, CEILING_Y, 0);
  root.add(headGroup);

  const canopyMesh = new THREE.Mesh(buildCeilingCanopyGeometry(THREE), accentLacquerMat);
  canopyMesh.userData.slot = "accent";
  canopyMesh.castShadow = true;
  headGroup.add(canopyMesh);

  const canopyBrassRing = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0022, 12, 28), brassMat);
  canopyBrassRing.rotation.x = Math.PI / 2;
  canopyBrassRing.position.y = -0.010;
  canopyBrassRing.userData.slot = "secondary";
  headGroup.add(canopyBrassRing);

  // 2. "body" group: entire swinging hanging lantern pivoted right under ceiling canopy
  const bodyGroup = new THREE.Group();
  bodyGroup.name = "body";
  bodyGroup.position.set(0, CEILING_Y - 0.010, 0);
  root.add(bodyGroup);

  const localGlobeY = GLOBE_CENTER_Y - (CEILING_Y - 0.010);
  const topCollarY = localGlobeY + GLOBE_H_HALF * Math.cos(THETA_TOP);
  const botCollarY = localGlobeY + GLOBE_H_HALF * Math.cos(THETA_BOT);

  // Braided hanging cord with subtle natural dorm drape
  const cordCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.0, 0),
    new THREE.Vector3(0.0025, topCollarY * 0.34, 0.0018),
    new THREE.Vector3(-0.0018, topCollarY * 0.68, -0.0015),
    new THREE.Vector3(0, topCollarY + 0.012, 0)
  ]);
  const cordMesh = new THREE.Mesh(
    createTaperedTube(THREE, cordCurve, 28, 10, (u) => 0.0032 + 0.0004 * Math.sin(u * Math.PI * 6)),
    cordMat
  );
  cordMesh.userData.slot = "accent";
  cordMesh.castShadow = true;
  bodyGroup.add(cordMesh);

  // Decorative wooden accent bead & small Chinese knot loops above the top ring
  const topBeadY = topCollarY + 0.056;
  const topBead = new THREE.Mesh(buildBeadGeometry(THREE, 1.05), accentLacquerMat);
  topBead.position.set(0, topBeadY, 0);
  topBead.userData.slot = "accent";
  bodyGroup.add(topBead);

  const beadGoldRingTop = new THREE.Mesh(new THREE.TorusGeometry(0.0082, 0.0016, 10, 24), brassMat);
  beadGoldRingTop.rotation.x = Math.PI / 2;
  beadGoldRingTop.position.set(0, topBeadY + 0.0145, 0);
  beadGoldRingTop.userData.slot = "secondary";
  bodyGroup.add(beadGoldRingTop);

  const beadGoldRingBot = beadGoldRingTop.clone();
  beadGoldRingBot.position.y = topBeadY - 0.0145;
  bodyGroup.add(beadGoldRingBot);

  // Two delicate decorative knot loops flanking the cord right under the top bead
  for (let side = -1; side <= 1; side += 2) {
    const knotCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, topBeadY - 0.014, 0),
      new THREE.Vector3(side * 0.016, topBeadY - 0.019, side * 0.004),
      new THREE.Vector3(side * 0.020, topBeadY - 0.030, 0),
      new THREE.Vector3(side * 0.012, topBeadY - 0.036, -side * 0.004),
      new THREE.Vector3(0, topBeadY - 0.031, 0)
    ]);
    const knotLoop = new THREE.Mesh(
      createTaperedTube(THREE, knotCurve, 20, 8, () => 0.0024, { capStart: false, capEnd: false }),
      cordMat
    );
    knotLoop.userData.slot = "accent";
    bodyGroup.add(knotLoop);
  }

  // Sculpted continuous paper lantern globe (72 x 56 dense sphere segment surface)
  const lanternGroup = new THREE.Group();
  lanternGroup.name = "lantern-globe";
  lanternGroup.position.set(0, localGlobeY, 0);
  bodyGroup.add(lanternGroup);

  const globeGeo = new THREE.SphereGeometry(1, 72, 56, 0, Math.PI * 2, THETA_TOP, THETA_SPAN);
  const gPos = globeGeo.attributes.position;
  const gUv = globeGeo.attributes.uv;
  const tmp = new THREE.Vector3();

  for (let i = 0; i < gPos.count; i++) {
    const uvx = gUv.getX(i);
    const uvy = gUv.getY(i);
    const phi = uvx * Math.PI * 2;
    const theta = THETA_TOP + (1 - uvy) * THETA_SPAN;
    lanternSurfacePoint(theta, phi, tmp);
    gPos.setXYZ(i, tmp.x, tmp.y, tmp.z);
  }
  globeGeo.computeVertexNormals();

  const globeMesh = new THREE.Mesh(globeGeo, paperMat);
  globeMesh.name = "lantern-paper";
  globeMesh.userData.slot = "primary";
  globeMesh.castShadow = true;
  globeMesh.receiveShadow = true;
  lanternGroup.add(globeMesh);

  // 13 thin horizontal ribs sculpted tightly into the paper grooves
  const ribGroup = new THREE.Group();
  ribGroup.name = "ribs";
  lanternGroup.add(ribGroup);

  for (let i = 0; i < ribUs.length; i++) {
    const theta = THETA_TOP + ribUs[i] * THETA_SPAN;
    const ribGeo = createHorizontalRibGeo(
      THREE,
      (phi, out) => {
        lanternSurfacePoint(theta, phi, out);
        // Sit delicately right on the exterior groove of the paper
        const lenXZ = Math.hypot(out.x, out.z) || 1;
        const offset = 0.0009;
        out.x += (out.x / lenXZ) * offset;
        out.z += (out.z / lenXZ) * offset;
      },
      52,
      6,
      0.00145
    );
    const ribMesh = new THREE.Mesh(ribGeo, ribMat);
    ribMesh.userData.slot = "secondary";
    ribGroup.add(ribMesh);
  }

  // Internal wire expander frame (2 curved C-struts + top hanger bridge)
  for (let k = 0; k < 2; k++) {
    const ang = k * Math.PI + Math.PI * 0.25;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const strutCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ca * 0.044, GLOBE_H_HALF * Math.cos(THETA_BOT) + 0.006, sa * 0.044),
      new THREE.Vector3(ca * 0.138, -0.095, sa * 0.138),
      new THREE.Vector3(ca * 0.162, 0.0, sa * 0.162),
      new THREE.Vector3(ca * 0.138, 0.095, sa * 0.138),
      new THREE.Vector3(ca * 0.048, GLOBE_H_HALF * Math.cos(THETA_TOP) - 0.004, sa * 0.048)
    ]);
    const strutMesh = new THREE.Mesh(
      createTaperedTube(THREE, strutCurve, 22, 6, () => 0.0015),
      brassMat
    );
    strutMesh.userData.slot = "secondary";
    lanternGroup.add(strutMesh);
  }

  // Top internal cross-bar bridge & hook loop visible when peeking into top collar
  const bridgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.048, GLOBE_H_HALF * Math.cos(THETA_TOP) + 0.002, 0),
    new THREE.Vector3(-0.015, GLOBE_H_HALF * Math.cos(THETA_TOP) + 0.010, 0),
    new THREE.Vector3(0.0, GLOBE_H_HALF * Math.cos(THETA_TOP) + 0.015, 0),
    new THREE.Vector3(0.015, GLOBE_H_HALF * Math.cos(THETA_TOP) + 0.010, 0),
    new THREE.Vector3(0.048, GLOBE_H_HALF * Math.cos(THETA_TOP) + 0.002, 0)
  ]);
  const bridgeMesh = new THREE.Mesh(
    createTaperedTube(THREE, bridgeCurve, 18, 6, () => 0.0019),
    brassMat
  );
  bridgeMesh.userData.slot = "secondary";
  lanternGroup.add(bridgeMesh);

  // Top and bottom turned lacquered rings + gilded inlay trim rings
  const topRingY = GLOBE_H_HALF * Math.cos(THETA_TOP);
  const topRingMesh = new THREE.Mesh(buildTopRingGeometry(THREE), accentLacquerMat);
  topRingMesh.position.set(0, topRingY, 0);
  topRingMesh.userData.slot = "accent";
  topRingMesh.castShadow = true;
  lanternGroup.add(topRingMesh);

  const topTrimRing = new THREE.Mesh(new THREE.TorusGeometry(0.0735, 0.0021, 10, 44), brassMat);
  topTrimRing.rotation.x = Math.PI / 2;
  topTrimRing.position.set(0, topRingY + 0.011, 0);
  topTrimRing.userData.slot = "secondary";
  lanternGroup.add(topTrimRing);

  const botRingY = GLOBE_H_HALF * Math.cos(THETA_BOT);
  const botRingMesh = new THREE.Mesh(buildBottomRingGeometry(THREE), accentLacquerMat);
  botRingMesh.position.set(0, botRingY, 0);
  botRingMesh.userData.slot = "accent";
  botRingMesh.castShadow = true;
  lanternGroup.add(botRingMesh);

  const botTrimRing = new THREE.Mesh(new THREE.TorusGeometry(0.0685, 0.0020, 10, 44), brassMat);
  botTrimRing.rotation.x = Math.PI / 2;
  botTrimRing.position.set(0, botRingY - 0.006, 0);
  botTrimRing.userData.slot = "secondary";
  lanternGroup.add(botTrimRing);

  // Small brass eyelet at underside of bottom ring for tassel suspension
  const botEyelet = new THREE.Mesh(new THREE.TorusGeometry(0.0068, 0.0017, 10, 22), brassMat);
  botEyelet.position.set(0, botRingY - 0.036, 0);
  botEyelet.userData.slot = "secondary";
  lanternGroup.add(botEyelet);

  // Warm inner Edison bulb, brass socket, soft glow halo & warm PointLight
  const dropCordCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, topRingY + 0.014, 0),
    new THREE.Vector3(0, 0.072, 0)
  ]);
  const dropCord = new THREE.Mesh(createTaperedTube(THREE, dropCordCurve, 8, 6, () => 0.0022), ribMat);
  dropCord.userData.slot = "secondary";
  lanternGroup.add(dropCord);

  const socketMesh = new THREE.Mesh(buildBulbSocketGeometry(THREE), brassMat);
  socketMesh.position.set(0, 0.056, 0);
  socketMesh.userData.slot = "secondary";
  lanternGroup.add(socketMesh);

  const bulbMesh = new THREE.Mesh(buildEdisonBulbGeometry(THREE), bulbMat);
  bulbMesh.name = "inner-bulb";
  bulbMesh.position.set(0, 0.002, 0);
  bulbMesh.userData.slot = "glow";
  lanternGroup.add(bulbMesh);

  const haloGeo = new THREE.SphereGeometry(0.115, 24, 18);
  const haloMesh = new THREE.Mesh(haloGeo, haloMat);
  haloMesh.name = "glow-halo";
  haloMesh.position.set(0, 0.0, 0);
  haloMesh.userData.slot = "glow";
  lanternGroup.add(haloMesh);

  const warmLight = new THREE.PointLight(new THREE.Color(cfg.glow), 0.95, 2.8, 2.0);
  warmLight.name = "warm-light";
  warmLight.position.set(0, 0.0, 0);
  lanternGroup.add(warmLight);

  // 3. "tail" group: silk tassel & curved paper charm pivoted at bottom eyelet
  const tailGroup = new THREE.Group();
  tailGroup.name = "tail";
  tailGroup.position.set(0, botCollarY - 0.036, 0);
  bodyGroup.add(tailGroup);

  // Upper tassel suspension cord
  const tasselCordCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.0, 0),
    new THREE.Vector3(0.0014, -0.025, 0.001),
    new THREE.Vector3(0, -0.052, 0)
  ]);
  const tasselCord = new THREE.Mesh(
    createTaperedTube(THREE, tasselCordCurve, 12, 8, () => 0.0025),
    cordMat
  );
  tasselCord.userData.slot = "accent";
  tailGroup.add(tasselCord);

  // Turned accent bead & gold spacer above silk cap
  const tasselBeadY = -0.048;
  const tasselBead = new THREE.Mesh(buildBeadGeometry(THREE, 0.92), accentLacquerMat);
  tasselBead.position.set(0, tasselBeadY, 0);
  tasselBead.userData.slot = "accent";
  tailGroup.add(tasselBead);

  const tasselSpacer = new THREE.Mesh(new THREE.TorusGeometry(0.0075, 0.0017, 10, 22), brassMat);
  tasselSpacer.rotation.x = Math.PI / 2;
  tasselSpacer.position.set(0, tasselBeadY - 0.014, 0);
  tasselSpacer.userData.slot = "secondary";
  tailGroup.add(tasselSpacer);

  // Silk-wrapped tassel bell/cap + gold thread cinch bands
  const capY = -0.082;
  const tasselCap = new THREE.Mesh(buildTasselCapGeometry(THREE), silkMat);
  tasselCap.position.set(0, capY, 0);
  tasselCap.userData.slot = "accent";
  tailGroup.add(tasselCap);

  for (let b = 0; b < 2; b++) {
    const cinch = new THREE.Mesh(new THREE.TorusGeometry(0.0138, 0.0014, 8, 24), brassMat);
    cinch.rotation.x = Math.PI / 2;
    cinch.position.set(0, capY + 0.002 - b * 0.010, 0);
    cinch.userData.slot = "secondary";
    tailGroup.add(cinch);
  }

  // Sculpted fluted silk tassel core
  const skirtTopY = capY - 0.014;
  const tasselCore = new THREE.Mesh(buildSculptedTasselCore(THREE, kit), silkMat);
  tasselCore.position.set(0, skirtTopY, 0);
  tasselCore.userData.slot = "accent";
  tasselCore.castShadow = true;
  tailGroup.add(tasselCore);

  // 28 individual curved tapering silk strands for a soft, tactile tassel silhouette
  const strandRand = seededRand(8273);
  const strandCount = 28;
  for (let i = 0; i < strandCount; i++) {
    const ang = (i / strandCount) * Math.PI * 2 + (strandRand() - 0.5) * 0.14;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const len = 0.195 + strandRand() * 0.038;
    const r0 = 0.009 + strandRand() * 0.003;
    const rMid = 0.019 + strandRand() * 0.008;
    const rEnd = 0.025 + strandRand() * 0.012;
    const twist = (strandRand() - 0.5) * 0.24;
    const cMid = Math.cos(ang + twist * 0.5);
    const sMid = Math.sin(ang + twist * 0.5);
    const cEnd = Math.cos(ang + twist);
    const sEnd = Math.sin(ang + twist);

    const sCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ca * r0, skirtTopY + 0.002, sa * r0),
      new THREE.Vector3(cMid * rMid + 0.0018, skirtTopY - len * 0.45, sMid * rMid - 0.0012),
      new THREE.Vector3(cEnd * (rEnd * 0.96) + 0.0036, skirtTopY - len * 0.78, sEnd * (rEnd * 0.96) - 0.0024),
      new THREE.Vector3(cEnd * rEnd + 0.005, skirtTopY - len, sEnd * rEnd - 0.0032)
    ]);

    const strandGeo = createTaperedTube(
      THREE,
      sCurve,
      10,
      5,
      (u) => (0.0020 * (1.0 - 0.52 * u * u)),
      { capStart: false, capEnd: true }
    );
    const strandMesh = new THREE.Mesh(strandGeo, silkMat);
    strandMesh.userData.slot = "accent";
    tailGroup.add(strandMesh);
  }

  // Delicate curved handmade paper charm tag hanging slightly off to the +x/+z side
  const charmLoopCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.006, tasselBeadY - 0.012, 0.004),
    new THREE.Vector3(0.024, tasselBeadY - 0.032, 0.016),
    new THREE.Vector3(0.034, tasselBeadY - 0.062, 0.022),
    new THREE.Vector3(0.036, tasselBeadY - 0.088, 0.022)
  ]);
  const charmThread = new THREE.Mesh(
    createTaperedTube(THREE, charmLoopCurve, 12, 5, () => 0.00095),
    cordMat
  );
  charmThread.userData.slot = "accent";
  tailGroup.add(charmThread);

  const charmMesh = new THREE.Mesh(buildCurvedCharmGeometry(THREE), charmMat);
  charmMesh.name = "charm-tag";
  charmMesh.position.set(0.036, tasselBeadY - 0.112, 0.022);
  charmMesh.rotation.set(0.08, 0.46, -0.11);
  charmMesh.userData.slot = "primary";
  charmMesh.castShadow = true;
  tailGroup.add(charmMesh);

  // Store animation references cleanly on root.userData
  root.userData._anim = {
    body: bodyGroup,
    tail: tailGroup,
    charm: charmMesh,
    paperMat,
    bulbMat,
    haloMesh,
    warmLight
  };

  return root;
}

export function idle(group, t) {
  const anim = group.userData && group.userData._anim;
  const body = (anim && anim.body) || group.getObjectByName("body");
  const tail = (anim && anim.tail) || group.getObjectByName("tail");

  if (body) {
    // Gentle cozy dorm-breeze pendulum sway & slow lazy drift twist
    const swayZ = Math.sin(t * 0.85) * 0.034 + Math.sin(t * 1.42 + 0.7) * 0.012;
    const swayX = Math.cos(t * 0.68 + 0.4) * 0.024 + Math.sin(t * 1.18) * 0.009;
    const spinY = Math.sin(t * 0.34) * 0.14;
    body.rotation.set(swayX, spinY, swayZ);
  }

  if (tail) {
    // Secondary delayed pendulum swing trailing naturally behind the lantern
    const lagT = t - 0.45;
    const tailZ = Math.sin(lagT * 0.85) * 0.048 + Math.sin(lagT * 1.9 + 1.1) * 0.018;
    const tailX = Math.cos(lagT * 0.68 + 0.4) * 0.036 + Math.cos(lagT * 1.6) * 0.014;
    tail.rotation.set(tailX, Math.sin(t * 0.55) * 0.08, tailZ);
  }

  if (anim) {
    // Subtle warm candlelight/bulb breathing glow
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.65) * 0.65 + 0.5 * Math.sin(t * 3.7 + 1.2) * 0.35;
    if (anim.paperMat) {
      anim.paperMat.emissiveIntensity = 0.86 + pulse * 0.16;
    }
    if (anim.bulbMat) {
      anim.bulbMat.emissiveIntensity = 1.95 + pulse * 0.38;
    }
    if (anim.haloMesh) {
      const s = 0.96 + pulse * 0.09;
      anim.haloMesh.scale.set(s, s, s);
      anim.haloMesh.material.opacity = 0.18 + pulse * 0.08;
    }
    if (anim.warmLight) {
      anim.warmLight.intensity = 0.86 + pulse * 0.22;
    }
    if (anim.charm) {
      anim.charm.rotation.y = 0.46 + Math.sin(t * 1.35 + 0.8) * 0.14;
      anim.charm.rotation.z = -0.11 + Math.cos(t * 1.1) * 0.04;
    }
  }
}
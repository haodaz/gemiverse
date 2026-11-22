export const META = {
  id: "acoustic-guitar-stand",
  name: "Acoustic Guitar on Wooden Stand",
  kind: "prop",
  footprint: [0.44, 0.44],
  variants: [
    { name: "Honey Spruce & Rosewood", opts: { wood: "#c89462", accent: "#5a3b2e" } },
    { name: "Warm Cedar & Walnut", opts: { wood: "#b87444", accent: "#3f261c" } },
    { name: "Natural Maple & Ebony", opts: { wood: "#dfc195", accent: "#2d2522" } },
    { name: "Amber Sunburst & Mahogany", opts: { wood: "#bc6c42", accent: "#4e251d" } }
  ],
  note: "Acoustic guitar with arched spruce top, recessed sound hole, herringbone rosette, tortoiseshell pickguard, belly bridge, six strings, fretted neck, tuning pegs, and tucked pick leaning on a padded wooden A-frame stand."
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hexToRgb(hex) {
  const s = (hex || "#c89462").replace("#", "");
  const n = parseInt(s.length === 3 ? s.replace(/(.)/g, "$1$1") : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbStr(r, g, b, a) {
  const rr = clamp(Math.round(r), 0, 255);
  const gg = clamp(Math.round(g), 0, 255);
  const bb = clamp(Math.round(b), 0, 255);
  return a === undefined ? `rgb(${rr},${gg},${bb})` : `rgba(${rr},${gg},${bb},${a})`;
}

function mixRgb(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

function scaleRgb(c, f) {
  return [clamp(c[0] * f, 0, 255), clamp(c[1] * f, 0, 255), clamp(c[2] * f, 0, 255)];
}

function rgbToHexNum(c) {
  const r = clamp(Math.round(c[0]), 0, 255);
  const g = clamp(Math.round(c[1]), 0, 255);
  const b = clamp(Math.round(c[2]), 0, 255);
  return (r << 16) | (g << 8) | b;
}

function fbm(kit, x, y, octaves) {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    val += amp * kit.noise(x * freq, y * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return val / norm;
}

function setSlot(mesh, slot) {
  mesh.userData.slot = slot;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function taperedTube(THREE, curve, radialSegs, tubularSegs, radiusFn, capEnds) {
  const frames = curve.computeFrenetFrames(tubularSegs, false);
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    const p = curve.getPointAt(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r = Math.max(0.00005, radiusFn(t));

    for (let j = 0; j <= radialSegs; j++) {
      const u = j / radialSegs;
      const phi = u * Math.PI * 2;
      const cs = Math.cos(phi);
      const sn = Math.sin(phi);
      const vx = p.x + r * (cs * N.x + sn * B.x);
      const vy = p.y + r * (cs * N.y + sn * B.y);
      const vz = p.z + r * (cs * N.z + sn * B.z);
      positions.push(vx, vy, vz);
      uvs.push(u, t);
    }
  }

  const stride = radialSegs + 1;
  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + j + 1;
      const d = i * stride + j + 1;
      indices.push(a, c, b, a, d, c);
    }
  }

  if (capEnds) {
    const p0 = curve.getPointAt(0);
    const c0 = positions.length / 3;
    positions.push(p0.x, p0.y, p0.z);
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(c0, j, j + 1);
    }
    const p1 = curve.getPointAt(1);
    const c1 = positions.length / 3;
    positions.push(p1.x, p1.y, p1.z);
    uvs.push(0.5, 1);
    const base = tubularSegs * stride;
    for (let j = 0; j < radialSegs; j++) {
      indices.push(c1, base + j + 1, base + j);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function makeTextures(THREE, kit, woodRgb, accentRgb) {
  // 1. Spruce soundboard color & bump
  const spruceColor = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    const warmEdge = mixRgb(woodRgb, accentRgb, 0.38);
    const lightHeart = scaleRgb(mixRgb(woodRgb, [248, 224, 185], 0.28), 1.04);

    for (let y = 0; y < h; y++) {
      const v = y / h;
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const dx = (u - 0.5) * 2;
        const dy = (v - 0.52) * 2;
        const radial = clamp(Math.sqrt(dx * dx * 1.1 + dy * dy * 0.9), 0, 1.2);
        const burst = smoothstep(0.55, 1.15, radial);

        // Tight vertical spruce grain + subtle cross-silking
        const warp = (kit.noise(u * 4.5, v * 3.2) - 0.5) * 0.03;
        const g1 = Math.sin((u + warp) * 210 + kit.noise(u * 14, v * 2.5) * 3.5) * 0.5 + 0.5;
        const g2 = kit.noise(u * 85, v * 3.5);
        const silk = kit.noise(u * 6, v * 62);
        const grain = g1 * 0.55 + g2 * 0.35 + silk * 0.1;

        const base = mixRgb(lightHeart, warmEdge, burst * 0.65);
        const shade = 0.87 + grain * 0.22;
        const idx = (y * w + x) * 4;
        data[idx] = clamp(base[0] * shade, 0, 255);
        data[idx + 1] = clamp(base[1] * shade, 0, 255);
        data[idx + 2] = clamp(base[2] * shade, 0, 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  spruceColor.colorSpace = THREE.SRGBColorSpace;
  spruceColor.wrapS = spruceColor.wrapT = THREE.ClampToEdgeWrapping;

  const spruceBump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      const v = y / h;
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const g = Math.sin(u * 210 + kit.noise(u * 14, v * 2.5) * 3.5) * 0.5 + 0.5;
        const silk = kit.noise(u * 8, v * 58);
        const val = clamp(Math.round((g * 0.72 + silk * 0.28) * 255), 0, 255);
        const idx = (y * w + x) * 4;
        data[idx] = data[idx + 1] = data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  // 2. Mahogany / Rosewood back, sides & neck
  const darkBase = mixRgb(accentRgb, woodRgb, 0.26);
  const darkWoodColor = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    const deep = scaleRgb(accentRgb, 0.62);
    const hi = scaleRgb(darkBase, 1.22);

    for (let y = 0; y < h; y++) {
      const v = y / h;
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const n = fbm(kit, u * 5.2, v * 1.9, 3);
        const rings = Math.sin((u * 18 + n * 5.8) * Math.PI) * 0.5 + 0.5;
        const pores = kit.noise(u * 70, v * 10);
        const t = clamp(rings * 0.62 + pores * 0.38, 0, 1);
        const col = mixRgb(deep, hi, t);
        const idx = (y * w + x) * 4;
        data[idx] = col[0];
        data[idx + 1] = col[1];
        data[idx + 2] = col[2];
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  darkWoodColor.colorSpace = THREE.SRGBColorSpace;
  darkWoodColor.wrapS = darkWoodColor.wrapT = THREE.RepeatWrapping;

  const darkWoodBump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      const v = y / h;
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const n = fbm(kit, u * 5.2, v * 1.9, 2);
        const rings = Math.sin((u * 18 + n * 5.8) * Math.PI) * 0.5 + 0.5;
        const pores = kit.noise(u * 75, v * 11);
        const val = clamp(Math.round((rings * 0.45 + pores * 0.55) * 255), 0, 255);
        const idx = (y * w + x) * 4;
        data[idx] = data[idx + 1] = data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  darkWoodBump.wrapS = darkWoodBump.wrapT = THREE.RepeatWrapping;

  // 3. Stand warm oak / walnut grain
  const standBase = mixRgb(accentRgb, woodRgb, 0.48);
  const standWoodColor = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    const lo = scaleRgb(standBase, 0.72);
    const hi = scaleRgb(standBase, 1.18);
    for (let y = 0; y < h; y++) {
      const v = y / h;
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const wv = fbm(kit, u * 3.5, v * 1.6, 3);
        const band = Math.sin((u * 14 + wv * 4.2) * Math.PI) * 0.5 + 0.5;
        const fine = kit.noise(u * 48, v * 6);
        const col = mixRgb(lo, hi, band * 0.6 + fine * 0.4);
        const idx = (y * w + x) * 4;
        data[idx] = col[0];
        data[idx + 1] = col[1];
        data[idx + 2] = col[2];
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  standWoodColor.colorSpace = THREE.SRGBColorSpace;
  standWoodColor.wrapS = standWoodColor.wrapT = THREE.RepeatWrapping;

  // 4. Fretboard dark rosewood
  const fretWood = kit.canvasTexture(256, 512, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    const dark = scaleRgb(accentRgb, 0.44);
    const mid = scaleRgb(accentRgb, 0.76);
    for (let y = 0; y < h; y++) {
      const v = y / h;
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const streak = fbm(kit, u * 16, v * 2.2, 3);
        const fine = kit.noise(u * 55, v * 7);
        const col = mixRgb(dark, mid, streak * 0.7 + fine * 0.3);
        const idx = (y * w + x) * 4;
        data[idx] = col[0];
        data[idx + 1] = col[1];
        data[idx + 2] = col[2];
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  fretWood.colorSpace = THREE.SRGBColorSpace;

  // 5. Ornate Marquetry Rosette
  const rosetteColor = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    ctx.fillStyle = rgbStr(...scaleRgb(woodRgb, 0.92));
    ctx.fillRect(0, 0, w, h);

    const drawRing = (rIn, rOut, color) => {
      ctx.beginPath();
      ctx.arc(cx, cy, rOut, 0, Math.PI * 2);
      ctx.arc(cx, cy, rIn, 0, Math.PI * 2, true);
      ctx.fillStyle = color;
      ctx.fill();
    };

    const ebony = rgbStr(...scaleRgb(accentRgb, 0.32));
    const cream = "#f3e8d2";
    const gold = rgbStr(...mixRgb(woodRgb, [238, 198, 128], 0.45));
    const mahog = rgbStr(...scaleRgb(accentRgb, 0.82));

    // Outer purfling rings
    drawRing(240, 250, ebony);
    drawRing(233, 240, cream);
    drawRing(226, 233, ebony);

    // Main herringbone / marquetry band
    drawRing(194, 226, mahog);
    const segs = 72;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 0.52) / segs) * Math.PI * 2;
      const aMid = ((i + 0.25) / segs) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a0) * 196, cy + Math.sin(a0) * 196);
      ctx.lineTo(cx + Math.cos(aMid) * 210, cy + Math.sin(aMid) * 210);
      ctx.lineTo(cx + Math.cos(a0) * 224, cy + Math.sin(a0) * 224);
      ctx.lineTo(cx + Math.cos(a1) * 224, cy + Math.sin(a1) * 224);
      ctx.lineTo(cx + Math.cos(a1 + (aMid - a0)) * 210, cy + Math.sin(a1 + (aMid - a0)) * 210);
      ctx.lineTo(cx + Math.cos(a1) * 196, cy + Math.sin(a1) * 196);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? cream : gold;
      ctx.fill();
    }

    // Center accent abalone-warm pearl dashes
    for (let i = 0; i < segs; i++) {
      const a = ((i + 0.5) / segs) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * 210, cy + Math.sin(a) * 210, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = ebony;
      ctx.fill();
    }

    // Inner purfling rings
    drawRing(187, 194, ebony);
    drawRing(180, 187, cream);
    drawRing(172, 180, ebony);
  });
  rosetteColor.colorSpace = THREE.SRGBColorSpace;

  // 6. Tortoiseshell pickguard & pick
  const tortoiseColor = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    const dark = [34, 14, 9];
    const mid = [128, 42, 16];
    const amber = [226, 134, 42];
    for (let y = 0; y < h; y++) {
      const v = y / h;
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const n1 = fbm(kit, u * 6.5, v * 6.5, 4);
        const n2 = fbm(kit, u * 13 + n1 * 2.1, v * 13 - n1 * 1.7, 3);
        const cell = smoothstep(0.32, 0.72, n2);
        const glow = smoothstep(0.58, 0.85, n1 * 0.6 + n2 * 0.4);
        let col = mixRgb(dark, mid, cell);
        col = mixRgb(col, amber, glow * 0.9);
        const idx = (y * w + x) * 4;
        data[idx] = col[0];
        data[idx + 1] = col[1];
        data[idx + 2] = col[2];
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  tortoiseColor.colorSpace = THREE.SRGBColorSpace;

  // 7. Interior luthier paper label (dimly visible inside sound hole)
  const labelColor = kit.canvasTexture(256, 192, (ctx, w, h) => {
    ctx.fillStyle = "#eadcc0";
    ctx.fillRect(0, 0, w, h);
    // Subtle aged paper vignette
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 20, w * 0.5, h * 0.5, 135);
    grad.addColorStop(0, "rgba(255,248,232,0.2)");
    grad.addColorStop(1, "rgba(130,96,58,0.35)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "#5c3d28";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.5, w * 0.44, h * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.5, w * 0.4, h * 0.37, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#482e1e";
    ctx.font = "italic bold 22px serif";
    ctx.textAlign = "center";
    ctx.fillText("Luthier Atelier", w * 0.5, h * 0.43);
    ctx.font = "14px serif";
    ctx.fillText("Handcrafted Acoustic", w * 0.5, h * 0.58);
    ctx.font = "12px monospace";
    ctx.fillText("NO. 042  -  SERIES C", w * 0.5, h * 0.72);
  });
  labelColor.colorSpace = THREE.SRGBColorSpace;

  // 8. Soft velvet/felt stand cushion texture
  const velvetBase = scaleRgb(accentRgb, 0.34);
  const velvetColor = kit.canvasTexture(128, 128, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = kit.noise(x * 0.35, y * 0.35);
        const weave = ((x + y) & 1) ? 0.05 : -0.05;
        const s = 0.85 + n * 0.25 + weave;
        const idx = (y * w + x) * 4;
        data[idx] = clamp(velvetBase[0] * s, 0, 255);
        data[idx + 1] = clamp(velvetBase[1] * s, 0, 255);
        data[idx + 2] = clamp(velvetBase[2] * s, 0, 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  velvetColor.colorSpace = THREE.SRGBColorSpace;
  velvetColor.wrapS = velvetColor.wrapT = THREE.RepeatWrapping;

  return {
    spruceColor,
    spruceBump,
    darkWoodColor,
    darkWoodBump,
    standWoodColor,
    fretWood,
    rosetteColor,
    tortoiseColor,
    labelColor,
    velvetColor
  };
}

// Acoustic guitar body silhouette (CCW, y in [0, 0.476], centered in x)
function makeGuitarOutlineShape(THREE) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  // Right lower bout
  s.bezierCurveTo(0.105, 0.0, 0.192, 0.052, 0.190, 0.145);
  // Right lower-to-waist
  s.bezierCurveTo(0.188, 0.220, 0.122, 0.246, 0.120, 0.295);
  // Right waist-to-upper bout
  s.bezierCurveTo(0.118, 0.342, 0.150, 0.358, 0.146, 0.402);
  // Right upper shoulder to neck block
  s.bezierCurveTo(0.142, 0.452, 0.075, 0.476, 0.0, 0.476);
  // Left upper shoulder
  s.bezierCurveTo(-0.075, 0.476, -0.142, 0.452, -0.146, 0.402);
  // Left upper bout-to-waist
  s.bezierCurveTo(-0.150, 0.358, -0.118, 0.342, -0.120, 0.295);
  // Left waist-to-lower bout
  s.bezierCurveTo(-0.122, 0.246, -0.188, 0.220, -0.190, 0.145);
  // Left lower bout back to tailblock
  s.bezierCurveTo(-0.192, 0.052, -0.105, 0.0, 0.0, 0.0);
  return s;
}

function buildGuitarBody(THREE, mats, cfg) {
  const { SH_Y, SH_R, zTop, zBack } = cfg;
  const bodyGroup = new THREE.Group();
  bodyGroup.name = "guitarBodyShell";

  const outlineShape = makeGuitarOutlineShape(THREE);
  const N = 160;
  const pts = outlineShape.getSpacedPoints(N);
  // Ensure exact closure
  pts[N].copy(pts[0]);

  // 1. Arched Spruce Top Plate with circular Sound Hole
  {
    const RINGS = 14;
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let r = 0; r <= RINGS; r++) {
      const f = r / RINGS;
      // Slightly denser near sound hole and perimeter
      const t = 0.5 - 0.5 * Math.cos(f * Math.PI);
      for (let i = 0; i <= N; i++) {
        const ox = pts[i].x;
        const oy = pts[i].y;
        const ang = Math.atan2(oy - SH_Y, ox);
        const ix = Math.cos(ang) * SH_R;
        const iy = SH_Y + Math.sin(ang) * SH_R;
        const x = lerp(ix, ox, t);
        const y = lerp(iy, oy, t);
        const z = zTop(x, y);
        positions.push(x, y, z);
        uvs.push(x / 0.40 + 0.5, y / 0.50);
      }
    }

    const stride = N + 1;
    for (let r = 0; r < RINGS; r++) {
      for (let i = 0; i < N; i++) {
        const a = r * stride + i;
        const b = (r + 1) * stride + i;
        const c = (r + 1) * stride + i + 1;
        const d = r * stride + i + 1;
        indices.push(a, b, c, a, c, d);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    bodyGroup.add(setSlot(new THREE.Mesh(geom, mats.spruce), "primary"));
  }

  // 1b. Sound hole wood rim thickness (shows thin spruce ply inside the opening)
  {
    const positions = [];
    const uvs = [];
    const indices = [];
    const lipDepth = 0.0036;
    for (let k = 0; k <= 1; k++) {
      for (let i = 0; i <= N; i++) {
        const ox = pts[i].x;
        const oy = pts[i].y;
        const ang = Math.atan2(oy - SH_Y, ox);
        const x = Math.cos(ang) * SH_R;
        const y = SH_Y + Math.sin(ang) * SH_R;
        const z = zTop(x, y) - k * lipDepth;
        positions.push(x, y, z);
        uvs.push(i / N, k);
      }
    }
    const stride = N + 1;
    for (let i = 0; i < N; i++) {
      const a = i;
      const b = stride + i;
      const c = stride + i + 1;
      const d = i + 1;
      indices.push(a, c, b, a, d, c);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    bodyGroup.add(setSlot(new THREE.Mesh(geom, mats.spruceEdge), "primary"));
  }

  // 2. Arched Mahogany Back Plate (outer -z) + Shadowed Interior Back (+z)
  {
    const RINGS = 14;
    const cx = 0;
    const cy = 0.23;
    const positions = [];
    const uvs = [];
    const outIdx = [];
    const inIdx = [];
    const inPositions = [];

    for (let r = 0; r <= RINGS; r++) {
      const f = r / RINGS;
      for (let i = 0; i <= N; i++) {
        const x = lerp(cx, pts[i].x, f);
        const y = lerp(cy, pts[i].y, f);
        const zb = zBack(x, y);
        positions.push(x, y, zb);
        inPositions.push(x * 0.975, lerp(cy, y, 0.975), zb + 0.004);
        uvs.push(x / 0.40 + 0.5, y / 0.50);
      }
    }

    const stride = N + 1;
    for (let r = 0; r < RINGS; r++) {
      for (let i = 0; i < N; i++) {
        const a = r * stride + i;
        const b = (r + 1) * stride + i;
        const c = (r + 1) * stride + i + 1;
        const d = r * stride + i + 1;
        outIdx.push(a, c, b, a, d, c);
        inIdx.push(a, b, c, a, c, d);
      }
    }

    const backGeom = new THREE.BufferGeometry();
    backGeom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    backGeom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    backGeom.setIndex(outIdx);
    backGeom.computeVertexNormals();
    bodyGroup.add(setSlot(new THREE.Mesh(backGeom, mats.darkWood), "accent"));

    const inBackGeom = new THREE.BufferGeometry();
    inBackGeom.setAttribute("position", new THREE.Float32BufferAttribute(inPositions, 3));
    inBackGeom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    inBackGeom.setIndex(inIdx);
    inBackGeom.computeVertexNormals();
    const inBackMesh = new THREE.Mesh(inBackGeom, mats.interiorWood);
    inBackMesh.userData.slot = "accent";
    inBackMesh.receiveShadow = true;
    bodyGroup.add(inBackMesh);
  }

  // 3. Side Ribs (outer + shadowed interior liner)
  {
    const ZSEGS = 8;
    const positions = [];
    const inPos = [];
    const uvs = [];
    const outIdx = [];
    const inIdx = [];

    // Compute cumulative arc length for clean horizontal wood grain UVs
    const arcLen = [0];
    for (let i = 1; i <= N; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      arcLen.push(arcLen[i - 1] + Math.hypot(dx, dy));
    }
    const totalLen = arcLen[N];

    for (let k = 0; k <= ZSEGS; k++) {
      const v = k / ZSEGS;
      // Subtle barrel curve across the ribs
      const barrel = Math.sin(v * Math.PI) * 0.0012;
      for (let i = 0; i <= N; i++) {
        const ox = pts[i].x;
        const oy = pts[i].y;
        const prev = pts[(i - 1 + N) % N];
        const next = pts[(i + 1) % N];
        let tx = next.x - prev.x;
        let ty = next.y - prev.y;
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        // Outward normal for CCW contour
        const nx = ty;
        const ny = -tx;

        const zb = zBack(ox, oy);
        const zt = zTop(ox, oy);
        const z = lerp(zb, zt, v);
        positions.push(ox + nx * barrel, oy + ny * barrel, z);
        inPos.push(ox - nx * 0.0035, oy - ny * 0.0035, lerp(zb + 0.003, zt - 0.003, v));
        uvs.push((arcLen[i] / totalLen) * 3.0, v);
      }
    }

    const stride = N + 1;
    for (let k = 0; k < ZSEGS; k++) {
      for (let i = 0; i < N; i++) {
        const a = k * stride + i;
        const b = (k + 1) * stride + i;
        const c = (k + 1) * stride + i + 1;
        const d = k * stride + i + 1;
        outIdx.push(a, c, b, a, d, c);
        inIdx.push(a, b, c, a, c, d);
      }
    }

    const ribGeom = new THREE.BufferGeometry();
    ribGeom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    ribGeom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    ribGeom.setIndex(outIdx);
    ribGeom.computeVertexNormals();
    bodyGroup.add(setSlot(new THREE.Mesh(ribGeom, mats.darkWood), "accent"));

    const inRibGeom = new THREE.BufferGeometry();
    inRibGeom.setAttribute("position", new THREE.Float32BufferAttribute(inPos, 3));
    inRibGeom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    inRibGeom.setIndex(inIdx);
    inRibGeom.computeVertexNormals();
    const inRibMesh = new THREE.Mesh(inRibGeom, mats.interiorWood);
    inRibMesh.userData.slot = "accent";
    bodyGroup.add(inRibMesh);
  }

  // 4. Cream Ivory Perimeter Binding (top & back edges)
  const makeBinding = (isTop) => {
    const prof = isTop
      ? [
          [-0.0028, 0.0007],
          [0.0009, 0.0007],
          [0.0014, 0.0001],
          [0.0014, -0.0042],
          [0.0002, -0.0046]
        ]
      : [
          [0.0002, 0.0046],
          [0.0014, 0.0042],
          [0.0014, -0.0001],
          [0.0009, -0.0007],
          [-0.0028, -0.0007]
        ];
    const P = prof.length;
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let k = 0; k < P; k++) {
      const dn = prof[k][0];
      const dz = prof[k][1];
      for (let i = 0; i <= N; i++) {
        const ox = pts[i].x;
        const oy = pts[i].y;
        const prev = pts[(i - 1 + N) % N];
        const next = pts[(i + 1) % N];
        let tx = next.x - prev.x;
        let ty = next.y - prev.y;
        const tl = Math.hypot(tx, ty) || 1;
        const nx = ty / tl;
        const ny = -tx / tl;
        const baseZ = isTop ? zTop(ox, oy) : zBack(ox, oy);
        positions.push(ox + nx * dn, oy + ny * dn, baseZ + dz);
        uvs.push(i / N, k / (P - 1));
      }
    }
    const stride = N + 1;
    for (let k = 0; k < P - 1; k++) {
      for (let i = 0; i < N; i++) {
        const a = k * stride + i;
        const b = (k + 1) * stride + i;
        const c = (k + 1) * stride + i + 1;
        const d = k * stride + i + 1;
        indices.push(a, b, c, a, c, d);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return setSlot(new THREE.Mesh(geom, mats.ivory), "secondary");
  };
  bodyGroup.add(makeBinding(true));
  bodyGroup.add(makeBinding(false));

  // 5. Interior Luthier Paper Label + subtle interior back brace
  {
    const labelGeom = new THREE.PlaneGeometry(0.088, 0.064, 8, 6);
    const lPos = labelGeom.attributes.position;
    for (let i = 0; i < lPos.count; i++) {
      const lx = lPos.getX(i);
      const ly = lPos.getY(i) + SH_Y;
      lPos.setY(i, ly);
      lPos.setZ(i, zBack(lx, ly) + 0.0052);
    }
    labelGeom.computeVertexNormals();
    const labelMesh = new THREE.Mesh(labelGeom, mats.label);
    labelMesh.userData.slot = "secondary";
    bodyGroup.add(labelMesh);

    // Subtle interior horizontal tone-bar visible below label
    const braceGeom = new THREE.BoxGeometry(0.18, 0.008, 0.011);
    const brace = new THREE.Mesh(braceGeom, mats.spruceEdge);
    brace.position.set(0, SH_Y - 0.044, zBack(0, SH_Y - 0.044) + 0.009);
    brace.userData.slot = "primary";
    bodyGroup.add(brace);
  }

  // 6. Marquetry Rosette flush on curved soundboard
  {
    const rIn = SH_R + 0.0012;
    const rOut = SH_R + 0.0175;
    const SEGS = 96;
    const RINGS = 4;
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let r = 0; r <= RINGS; r++) {
      const rad = lerp(rIn, rOut, r / RINGS);
      const uvR = lerp(0.335, 0.49, r / RINGS);
      for (let i = 0; i <= SEGS; i++) {
        const ang = (i / SEGS) * Math.PI * 2;
        const x = Math.cos(ang) * rad;
        const y = SH_Y + Math.sin(ang) * rad;
        const z = zTop(x, y) + 0.00045;
        positions.push(x, y, z);
        uvs.push(0.5 + Math.cos(ang) * uvR, 0.5 + Math.sin(ang) * uvR);
      }
    }
    const stride = SEGS + 1;
    for (let r = 0; r < RINGS; r++) {
      for (let i = 0; i < SEGS; i++) {
        const a = r * stride + i;
        const b = (r + 1) * stride + i;
        const c = (r + 1) * stride + i + 1;
        const d = r * stride + i + 1;
        indices.push(a, b, c, a, c, d);
      }
    }
    const rosGeom = new THREE.BufferGeometry();
    rosGeom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    rosGeom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    rosGeom.setIndex(indices);
    rosGeom.computeVertexNormals();
    bodyGroup.add(setSlot(new THREE.Mesh(rosGeom, mats.rosette), "secondary"));
  }

  // 7. Curved Tortoiseshell Teardrop Pickguard
  {
    const pg = new THREE.Shape();
    const rArc = SH_R + 0.0195;
    // Start at top-right edge near rosette
    const aStart = 0.72;
    const aEnd = -1.32;
    const sx = Math.cos(aStart) * rArc;
    const sy = SH_Y + Math.sin(aStart) * rArc;
    pg.moveTo(sx, sy);
    // Hug the rosette curve clockwise down to bottom-right
    const arcSteps = 20;
    for (let i = 1; i <= arcSteps; i++) {
      const a = lerp(aStart, aEnd, i / arcSteps);
      pg.lineTo(Math.cos(a) * rArc, SH_Y + Math.sin(a) * rArc);
    }
    // Sweep into classic teardrop belly toward lower bout treble side
    pg.bezierCurveTo(0.055, SH_Y - 0.115, 0.145, SH_Y - 0.125, 0.155, SH_Y - 0.060);
    pg.bezierCurveTo(0.160, SH_Y - 0.010, 0.105, SH_Y + 0.025, sx + 0.018, sy + 0.008);
    pg.bezierCurveTo(sx + 0.008, sy + 0.010, sx + 0.002, sy + 0.005, sx, sy);

    const pgGeom = new THREE.ExtrudeGeometry(pg, {
      depth: 0.001,
      bevelEnabled: true,
      bevelThickness: 0.0004,
      bevelSize: 0.0004,
      bevelSegments: 2,
      curveSegments: 24
    });
    const pAttr = pgGeom.attributes.position;
    const uvAttr = pgGeom.attributes.uv;
    for (let i = 0; i < pAttr.count; i++) {
      const px = pAttr.getX(i);
      const py = pAttr.getY(i);
      const pz = pAttr.getZ(i);
      pAttr.setZ(i, zTop(px, py) + 0.0003 + pz);
      uvAttr.setXY(i, (px - 0.01) / 0.16, (py - (SH_Y - 0.13)) / 0.22);
    }
    pgGeom.computeVertexNormals();
    bodyGroup.add(setSlot(new THREE.Mesh(pgGeom, mats.tortoise), "secondary"));
  }

  return bodyGroup;
}

function buildBridge(THREE, mats, cfg) {
  const { SADDLE_Y, zTop, stringBridgeX } = cfg;
  const g = new THREE.Group();
  g.name = "bridge";

  // Classic acoustic belly bridge shape
  const s = new THREE.Shape();
  const hw = 0.077;
  const topY = SADDLE_Y + 0.011;
  const wingBotY = SADDLE_Y - 0.012;
  const bellyBotY = SADDLE_Y - 0.024;

  s.moveTo(-hw, topY);
  s.lineTo(hw, topY);
  s.bezierCurveTo(hw + 0.002, topY - 0.005, hw + 0.001, wingBotY + 0.003, hw - 0.005, wingBotY);
  s.bezierCurveTo(0.052, wingBotY - 0.001, 0.042, bellyBotY, 0.0, bellyBotY);
  s.bezierCurveTo(-0.042, bellyBotY, -0.052, wingBotY - 0.001, -hw + 0.005, wingBotY);
  s.bezierCurveTo(-hw - 0.001, wingBotY + 0.003, -hw - 0.002, topY - 0.005, -hw, topY);

  const bDepth = 0.0072;
  const bGeom = new THREE.ExtrudeGeometry(s, {
    depth: bDepth,
    bevelEnabled: true,
    bevelThickness: 0.0012,
    bevelSize: 0.0014,
    bevelSegments: 3,
    curveSegments: 24
  });

  // Sculpt wings slightly lower than center belly + hug curved top
  const p = bGeom.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const wingTaper = smoothstep(0.036, 0.078, Math.abs(x));
    const topZVal = zTop(x, y);
    const scaledZ = z > 0.001 ? z * (1 - wingTaper * 0.32) : z;
    p.setZ(i, topZVal - 0.0005 + scaledZ);
  }
  bGeom.computeVertexNormals();
  g.add(setSlot(new THREE.Mesh(bGeom, mats.fretboard), "accent"));

  // Compensated angled bone saddle
  const saddleLen = 0.072;
  const sadShape = new THREE.Shape();
  sadShape.moveTo(-saddleLen * 0.5, -0.0016);
  sadShape.lineTo(saddleLen * 0.5, -0.0016);
  sadShape.lineTo(saddleLen * 0.5, 0.0016);
  sadShape.lineTo(-saddleLen * 0.5, 0.0016);
  sadShape.closePath();

  const sadGeom = new THREE.ExtrudeGeometry(sadShape, {
    depth: 0.0034,
    bevelEnabled: true,
    bevelThickness: 0.0007,
    bevelSize: 0.0005,
    bevelSegments: 2
  });
  const saddleMesh = setSlot(new THREE.Mesh(sadGeom, mats.ivory), "secondary");
  saddleMesh.position.set(0, SADDLE_Y, zTop(0, SADDLE_Y) + bDepth + 0.0002);
  saddleMesh.rotation.z = 0.048; // subtle acoustic intonation compensation
  g.add(saddleMesh);

  // 6 Turned Bridge Pins (LatheGeometry, 18 points)
  const pinPts = [];
  for (let i = 0; i <= 17; i++) {
    const t = i / 17;
    let r;
    let y;
    if (t < 0.35) {
      const f = t / 0.35;
      r = lerp(0.0022, 0.0028, f);
      y = lerp(0.0, 0.0015, f);
    } else if (t < 0.65) {
      const f = (t - 0.35) / 0.30;
      r = lerp(0.0028, 0.0033, Math.sin(f * Math.PI * 0.5));
      y = lerp(0.0015, 0.0034, f);
    } else {
      const f = (t - 0.65) / 0.35;
      r = Math.max(0.00008, 0.0033 * Math.cos(f * Math.PI * 0.5));
      y = 0.0034 + 0.0016 * Math.sin(f * Math.PI * 0.5);
    }
    pinPts.push(new THREE.Vector2(r, y));
  }
  const pinGeom = new THREE.LatheGeometry(pinPts, 18);
  pinGeom.rotateX(Math.PI * 0.5);
  const dotGeom = new THREE.SphereGeometry(0.0011, 10, 8);
  dotGeom.scale(1, 1, 0.45);

  for (let i = 0; i < 6; i++) {
    const px = stringBridgeX[i];
    const py = SADDLE_Y - 0.0115;
    const pz = zTop(px, py) + bDepth + 0.0005;
    const pin = setSlot(new THREE.Mesh(pinGeom, mats.ivory), "secondary");
    pin.position.set(px, py, pz);
    g.add(pin);

    const dot = setSlot(new THREE.Mesh(dotGeom, mats.ebony), "accent");
    dot.position.set(px, py, pz + 0.0049);
    g.add(dot);
  }

  return g;
}

function buildSculptedNeckAndHeadstock(THREE, mats, cfg) {
  const { NUT_Y, BODY_H, SCALE, zFretBase, zFretTop } = cfg;
  const neckGroup = new THREE.Group();
  neckGroup.name = "neckAssembly";

  // 1. Continuous Sculpted Neck Shaft + Flared Rounded Heel + Volute
  {
    const VSEGS = 44;
    const USEGS = 24;
    const yStart = BODY_H - 0.036; // heel extends slightly down the back of upper bout
    const yEnd = NUT_Y + 0.012;    // overlaps smoothly into headstock base

    const positions = [];
    const uvs = [];
    const indices = [];

    for (let v = 0; v <= VSEGS; v++) {
      const tv = v / VSEGS;
      const y = lerp(yStart, yEnd, tv);

      // Width tapers smoothly from 14th fret to nut, narrowing into rounded heel cap at yStart
      const shaftT = clamp((y - BODY_H) / (NUT_Y - BODY_H), 0, 1);
      let halfW = lerp(0.0278, 0.0222, shaftT);
      let depth = lerp(0.0245, 0.0205, shaftT);

      // Sculpted neck heel flare near body joint (y <= BODY_H + 0.042)
      const heelMask = 1 - smoothstep(BODY_H - 0.002, BODY_H + 0.044, y);
      depth += heelMask * 0.068;

      // Taper heel gracefully to a rounded heel cap at the very bottom
      if (y < BODY_H) {
        const capT = clamp((BODY_H - y) / (BODY_H - yStart), 0, 1);
        const capScale = Math.sqrt(Math.max(0.02, 1 - capT * capT * 0.92));
        halfW *= lerp(1, 0.56, capT);
        depth = lerp(0.095, 0.088, capT) * capScale;
      }

      // Subtle ergonomic volute bulge right behind the nut
      const volute = Math.exp(-Math.pow((y - (NUT_Y - 0.004)) / 0.018, 2)) * 0.0038;
      depth += volute;

      for (let u = 0; u <= USEGS; u++) {
        const tu = u / USEGS;
        let x;
        let z;
        if (tu <= 0.85) {
          // Ergonomic C-profile back of neck from -halfW to +halfW
          const a = (tu / 0.85) * Math.PI; // 0 -> PI
          x = -Math.cos(a) * halfW;
          const arch = Math.pow(Math.sin(a), 0.88);
          z = zFretBase - arch * depth;
        } else {
          // Flat fretboard glue face closing from +halfW back to -halfW
          const f = (tu - 0.85) / 0.15;
          x = lerp(halfW, -halfW, f);
          z = zFretBase;
        }
        positions.push(x, y, z);
        uvs.push(tu * 1.4, tv * 2.2);
      }
    }

    const stride = USEGS + 1;
    for (let v = 0; v < VSEGS; v++) {
      for (let u = 0; u < USEGS; u++) {
        const a = v * stride + u;
        const b = (v + 1) * stride + u;
        const c = (v + 1) * stride + u + 1;
        const d = v * stride + u + 1;
        indices.push(a, b, c, a, c, d);
      }
    }

    // Close bottom heel cap cleanly
    const capCenterIdx = positions.length / 3;
    positions.push(0, yStart, zFretBase - 0.036);
    uvs.push(0.5, 0);
    for (let u = 0; u < USEGS; u++) {
      indices.push(capCenterIdx, u + 1, u);
    }

    const neckGeom = new THREE.BufferGeometry();
    neckGeom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    neckGeom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    neckGeom.setIndex(indices);
    neckGeom.computeVertexNormals();
    neckGroup.add(setSlot(new THREE.Mesh(neckGeom, mats.darkWood), "accent"));
  }

  // 2. Radiused Rosewood Fretboard (extends cleanly from 20th fret over upper bout to nut)
  const fbY0 = 0.388;
  const fbY1 = NUT_Y;
  const fretHalfW = (y) => lerp(0.0294, 0.0222, clamp((y - fbY0) / (fbY1 - fbY0), 0, 1));
  const fretCrownZ = (x, y) => {
    const hw = fretHalfW(y);
    const nx = clamp(x / hw, -1, 1);
    return zFretTop - nx * nx * 0.0014;
  };

  {
    const VSEGS = 28;
    const USEGS = 14;
    const positions = [];
    const uvs = [];
    const indices = [];

    // Cross-section perimeter: left side up -> arched top -> right side down -> flat bottom
    const profPts = [];
    profPts.push([-1, 0]);
    for (let i = 0; i <= USEGS; i++) {
      const s = lerp(-1, 1, i / USEGS);
      profPts.push([s, 1 - s * s * 0.24]);
    }
    profPts.push([1, 0]);
    profPts.push([-1, 0]);
    const P = profPts.length;

    for (let v = 0; v <= VSEGS; v++) {
      const tv = v / VSEGS;
      const y = lerp(fbY0, fbY1, tv);
      const hw = fretHalfW(y);
      for (let p = 0; p < P; p++) {
        const sx = profPts[p][0];
        const sz = profPts[p][1];
        positions.push(sx * hw, y, lerp(zFretBase - 0.0004, zFretTop, sz));
        uvs.push(sx * 0.5 + 0.5, tv);
      }
    }

    for (let v = 0; v < VSEGS; v++) {
      for (let p = 0; p < P - 1; p++) {
        const a = v * P + p;
        const b = (v + 1) * P + p;
        const c = (v + 1) * P + p + 1;
        const d = v * P + p + 1;
        indices.push(a, c, b, a, d, c);
      }
    }

    // End caps at fbY0 (near sound hole) and fbY1 (nut)
    const c0 = positions.length / 3;
    positions.push(0, fbY0, (zFretBase + zFretTop) * 0.5);
    uvs.push(0.5, 0);
    for (let p = 0; p < P - 1; p++) {
      indices.push(c0, p, p + 1);
    }

    const fbGeom = new THREE.BufferGeometry();
    fbGeom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    fbGeom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    fbGeom.setIndex(indices);
    fbGeom.computeVertexNormals();
    neckGroup.add(setSlot(new THREE.Mesh(fbGeom, mats.fretboard), "accent"));
  }

  // 3. 20 Arched Nickel-Silver Fret Wires + Mother-of-Pearl Inlay Dots
  const fretYs = [NUT_Y];
  for (let n = 1; n <= 20; n++) {
    const fy = NUT_Y - SCALE * (1 - Math.pow(2, -n / 12));
    fretYs.push(fy);
    const hw = fretHalfW(fy) - 0.0005;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-hw, fy, fretCrownZ(-hw, fy) + 0.0004),
      new THREE.Vector3(0, fy, fretCrownZ(0, fy) + 0.0006),
      new THREE.Vector3(hw, fy, fretCrownZ(hw, fy) + 0.0004)
    ]);
    const fretGeom = taperedTube(THREE, curve, 6, 8, () => 0.0009, true);
    neckGroup.add(setSlot(new THREE.Mesh(fretGeom, mats.chrome), "secondary"));
  }

  const inlayFrets = [3, 5, 7, 9, 12, 15, 17];
  const inlayGeom = new THREE.CylinderGeometry(0.0029, 0.0029, 0.0005, 16);
  inlayGeom.rotateX(Math.PI * 0.5);
  for (const n of inlayFrets) {
    const midY = (fretYs[n - 1] + fretYs[n]) * 0.5;
    if (n === 12) {
      for (const sx of [-0.0115, 0.0115]) {
        const dot = setSlot(new THREE.Mesh(inlayGeom, mats.pearl), "secondary");
        dot.position.set(sx, midY, fretCrownZ(sx, midY) + 0.00018);
        neckGroup.add(dot);
      }
    } else {
      const dot = setSlot(new THREE.Mesh(inlayGeom, mats.pearl), "secondary");
      dot.position.set(0, midY, fretCrownZ(0, midY) + 0.00018);
      neckGroup.add(dot);
    }
  }

  // 4. Bone Nut at NUT_Y
  {
    const nutW = 0.0445;
    const nutShape = new THREE.Shape();
    nutShape.moveTo(-nutW * 0.5, -0.0022);
    nutShape.lineTo(nutW * 0.5, -0.0022);
    nutShape.lineTo(nutW * 0.5, 0.0022);
    nutShape.lineTo(-nutW * 0.5, 0.0022);
    nutShape.closePath();

    const nutGeom = new THREE.ExtrudeGeometry(nutShape, {
      depth: 0.0078,
      bevelEnabled: true,
      bevelThickness: 0.0007,
      bevelSize: 0.0006,
      bevelSegments: 2
    });
    const nut = setSlot(new THREE.Mesh(nutGeom, mats.ivory), "secondary");
    nut.position.set(0, NUT_Y + 0.0012, zFretBase - 0.0002);
    neckGroup.add(nut);
  }

  // 5. Angled Headstock & 6 Tuning Machines
  const HEAD_TILT = -0.235; // 13.5 deg back toward -z
  const headOrigin = new THREE.Vector3(0, NUT_Y, zFretBase + 0.0012);
  const headGroup = new THREE.Group();
  headGroup.name = "head";
  headGroup.position.copy(headOrigin);
  headGroup.rotation.x = HEAD_TILT;
  neckGroup.add(headGroup);

  const hs = new THREE.Shape();
  hs.moveTo(-0.0222, -0.004);
  hs.lineTo(0.0222, -0.004);
  hs.bezierCurveTo(0.025, 0.012, 0.0335, 0.024, 0.0345, 0.042);
  hs.bezierCurveTo(0.0365, 0.088, 0.039, 0.132, 0.035, 0.156);
  // Subtle sculpted acoustic crown dip/arch
  hs.bezierCurveTo(0.022, 0.163, 0.008, 0.157, 0.0, 0.161);
  hs.bezierCurveTo(-0.008, 0.157, -0.022, 0.163, -0.035, 0.156);
  hs.bezierCurveTo(-0.039, 0.132, -0.0365, 0.088, -0.0345, 0.042);
  hs.bezierCurveTo(-0.0335, 0.024, -0.025, 0.012, -0.0222, -0.004);

  const hsGeom = new THREE.ExtrudeGeometry(hs, {
    depth: 0.0145,
    bevelEnabled: true,
    bevelThickness: 0.0016,
    bevelSize: 0.0014,
    bevelSegments: 3,
    curveSegments: 24
  });
  hsGeom.translate(0, 0, -0.0155);
  headGroup.add(setSlot(new THREE.Mesh(hsGeom, mats.darkWood), "accent"));

  // Headstock dark rosewood face veneer + inlaid pearl star emblem
  const venGeom = new THREE.ExtrudeGeometry(hs, {
    depth: 0.0012,
    bevelEnabled: false,
    curveSegments: 20
  });
  venGeom.scale(0.96, 0.985, 1);
  venGeom.translate(0, 0.0015, -0.0004);
  headGroup.add(setSlot(new THREE.Mesh(venGeom, mats.fretboard), "accent"));

  // Inlaid luthier diamond emblem on headstock
  const emb = new THREE.Shape();
  emb.moveTo(0, 0.011);
  emb.quadraticCurveTo(0.0022, 0.0022, 0.0075, 0);
  emb.quadraticCurveTo(0.0022, -0.0022, 0, -0.011);
  emb.quadraticCurveTo(-0.0022, -0.0022, -0.0075, 0);
  emb.quadraticCurveTo(-0.0022, 0.0022, 0, 0.011);
  const embGeom = new THREE.ExtrudeGeometry(emb, { depth: 0.0006, bevelEnabled: false });
  const emblem = setSlot(new THREE.Mesh(embGeom, mats.pearl), "secondary");
  emblem.position.set(0, 0.132, 0.0007);
  headGroup.add(emblem);

  // Shared Lathe geometries for the 6 Tuning Machines
  const bushingPts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const r = t < 0.45 ? lerp(0.0062, 0.0058, t / 0.45) : lerp(0.0044, 0.0041, (t - 0.45) / 0.55);
    const y = t * 0.0034;
    bushingPts.push(new THREE.Vector2(r, y));
  }
  const bushingGeom = new THREE.LatheGeometry(bushingPts, 16);
  bushingGeom.rotateX(Math.PI * 0.5);

  // Capstan string post (LatheGeometry, 20 points with hourglass waist)
  const postPts = [];
  for (let i = 0; i <= 19; i++) {
    const t = i / 19;
    const y = t * 0.0235;
    let r = 0.0031;
    if (t > 0.22 && t < 0.78) {
      const f = (t - 0.22) / 0.56;
      r = 0.0031 - Math.sin(f * Math.PI) * 0.00075;
    } else if (t >= 0.88) {
      const f = (t - 0.88) / 0.12;
      r = Math.max(0.0001, 0.0031 * Math.cos(f * Math.PI * 0.5));
    }
    postPts.push(new THREE.Vector2(r, y));
  }
  const postGeom = new THREE.LatheGeometry(postPts, 18);
  postGeom.rotateX(Math.PI * 0.5);

  // Peg shaft (LatheGeometry, 16 points)
  const shaftPts = [];
  for (let i = 0; i <= 15; i++) {
    const t = i / 15;
    const r = t < 0.25 ? lerp(0.0036, 0.0024, t / 0.25) : lerp(0.0024, 0.0020, (t - 0.25) / 0.75);
    shaftPts.push(new THREE.Vector2(r, t * 0.024));
  }
  const shaftGeom = new THREE.LatheGeometry(shaftPts, 14);

  // Sculpted butterbean tuning key button (dense SphereGeometry displaced with thumb dimples)
  const btnGeom = new THREE.SphereGeometry(0.0115, 28, 20);
  const bPos = btnGeom.attributes.position;
  for (let i = 0; i < bPos.count; i++) {
    let x = bPos.getX(i);
    let y = bPos.getY(i);
    let z = bPos.getZ(i);
    x *= 1.05;
    y *= 0.82;
    z *= 0.34;
    // Slight concave thumb dimple near center on both sides
    const r2 = (x * x + y * y) / (0.011 * 0.011);
    const dimple = Math.exp(-r2 * 2.4) * 0.0012;
    z += z >= 0 ? -dimple : dimple;
    bPos.setXYZ(i, x, y, z);
  }
  btnGeom.computeVertexNormals();

  // Rear sealed tuner gear housing
  const gearShape = new THREE.Shape();
  gearShape.absarc(0, 0, 0.0085, 0, Math.PI * 2, false);
  const gearGeom = new THREE.ExtrudeGeometry(gearShape, {
    depth: 0.0095,
    bevelEnabled: true,
    bevelThickness: 0.0015,
    bevelSize: 0.0012,
    bevelSegments: 2
  });

  // 6 Tuning posts: left side (strings 0, 1, 2 -> low E, A, D), right side (strings 3, 4, 5 -> G, B, high E)
  const postWorldTargets = new Array(6);
  const pegSpecs = [
    { strIdx: 0, side: -1, y: 0.044, x: -0.0205, angle: 0.28 },
    { strIdx: 1, side: -1, y: 0.082, x: -0.0218, angle: -0.35 },
    { strIdx: 2, side: -1, y: 0.120, x: -0.0212, angle: 0.52 },
    { strIdx: 3, side: 1, y: 0.120, x: 0.0212, angle: -0.18 },
    { strIdx: 4, side: 1, y: 0.082, x: 0.0218, angle: 0.42 },
    { strIdx: 5, side: 1, y: 0.044, x: 0.0205, angle: -0.48 }
  ];

  const cosH = Math.cos(HEAD_TILT);
  const sinH = Math.sin(HEAD_TILT);
  const headToNeck = (lx, ly, lz) =>
    new THREE.Vector3(
      headOrigin.x + lx,
      headOrigin.y + ly * cosH - lz * sinH,
      headOrigin.z + ly * sinH + lz * cosH
    );

  for (const spec of pegSpecs) {
    const bushing = setSlot(new THREE.Mesh(bushingGeom, mats.chrome), "secondary");
    bushing.position.set(spec.x, spec.y, 0.0005);
    headGroup.add(bushing);

    const post = setSlot(new THREE.Mesh(postGeom, mats.chrome), "secondary");
    post.position.set(spec.x, spec.y, 0.0015);
    headGroup.add(post);

    const gear = setSlot(new THREE.Mesh(gearGeom, mats.chrome), "secondary");
    gear.position.set(spec.x, spec.y, -0.0255);
    headGroup.add(gear);

    // Sideways peg shaft & sculpted button
    const pegSub = new THREE.Group();
    pegSub.position.set(spec.x + spec.side * 0.006, spec.y, -0.0205);
    pegSub.rotation.z = spec.side < 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    pegSub.rotation.y = spec.angle;

    const shaft = setSlot(new THREE.Mesh(shaftGeom, mats.chrome), "secondary");
    pegSub.add(shaft);

    const btn = setSlot(new THREE.Mesh(btnGeom, mats.chrome), "secondary");
    btn.position.set(0, 0.0285, 0);
    pegSub.add(btn);
    headGroup.add(pegSub);

    // Helical string winding coil around each tuning post
    const coilPts = [];
    const turns = 3.2;
    const coilSteps = 22;
    for (let k = 0; k <= coilSteps; k++) {
      const f = k / coilSteps;
      const a = f * turns * Math.PI * 2;
      const cr = 0.0031;
      coilPts.push(new THREE.Vector3(spec.x + Math.cos(a) * cr, spec.y + Math.sin(a) * cr, 0.0085 + f * 0.0055));
    }
    const coilCurve = new THREE.CatmullRomCurve3(coilPts);
    const strMat = spec.strIdx < 4 ? mats.stringBronze : mats.stringSteel;
    const coilGeom = taperedTube(THREE, coilCurve, 5, 18, () => 0.00055, false);
    headGroup.add(setSlot(new THREE.Mesh(coilGeom, strMat), "secondary"));

    // Record exact string anchor point in guitarGroup space (inner edge of post)
    const innerOffset = spec.side < 0 ? 0.0028 : -0.0028;
    postWorldTargets[spec.strIdx] = headToNeck(spec.x + innerOffset, spec.y, 0.0115);
  }

  return { neckGroup, postWorldTargets, fretYs };
}

function buildStringsAndPick(THREE, mats, cfg, postWorldTargets, fretYs) {
  const { SADDLE_Y, NUT_Y, zTop, zFretTop, stringBridgeX, stringNutX } = cfg;
  const stringsRoot = new THREE.Group();
  stringsRoot.name = "stringsRoot";

  const vibratingStrings = new THREE.Group();
  vibratingStrings.name = "strings";
  stringsRoot.add(vibratingStrings);

  // Slightly enhanced gauges for crisp diorama readability (low E -> high E)
  const radii = [0.00112, 0.00094, 0.00078, 0.00063, 0.00049, 0.00039];
  const vibratingMeshes = [];

  for (let i = 0; i < 6; i++) {
    const r = radii[i];
    const mat = i < 4 ? mats.stringBronze : mats.stringSteel;
    const bx = stringBridgeX[i];
    const nx = stringNutX[i];

    // Exact contact points along the string path
    const pinY = SADDLE_Y - 0.0112;
    const sadY = SADDLE_Y + bx * 0.048; // follows angled saddle
    const pPin = new THREE.Vector3(bx, pinY, zTop(bx, pinY) + 0.0084);
    const pSaddle = new THREE.Vector3(bx, sadY, zTop(bx, sadY) + 0.0112);
    const pNut = new THREE.Vector3(nx, NUT_Y + 0.0012, zFretTop + 0.0021);
    const pPost = postWorldTargets[i];

    // Segment A: pin to saddle
    const segA = new THREE.CatmullRomCurve3([pPin, pPin.clone().lerp(pSaddle, 0.5), pSaddle]);
    stringsRoot.add(setSlot(new THREE.Mesh(taperedTube(THREE, segA, 6, 4, () => r, false), mat), "secondary"));

    // Segment B: main vibrating span (saddle -> nut)
    const segB = new THREE.CatmullRomCurve3([pSaddle, pSaddle.clone().lerp(pNut, 0.5), pNut]);
    const mainMesh = setSlot(new THREE.Mesh(taperedTube(THREE, segB, 6, 12, () => r, false), mat), "secondary");
    mainMesh.userData.baseX = 0;
    mainMesh.userData.stringIndex = i;
    vibratingStrings.add(mainMesh);
    vibratingMeshes.push(mainMesh);

    // Segment C: nut to tuning post
    const segC = new THREE.CatmullRomCurve3([pNut, pNut.clone().lerp(pPost, 0.5), pPost]);
    stringsRoot.add(setSlot(new THREE.Mesh(taperedTube(THREE, segC, 6, 4, () => r, false), mat), "secondary"));
  }

  // Cozy Dorm Detail: Tortoiseshell Guitar Pick tucked between strings at 3rd fret!
  {
    const pickShape = new THREE.Shape();
    pickShape.moveTo(0, -0.0165);
    pickShape.bezierCurveTo(0.0085, -0.011, 0.0145, 0.002, 0.0132, 0.0105);
    pickShape.bezierCurveTo(0.0115, 0.0165, 0.005, 0.0175, 0, 0.0175);
    pickShape.bezierCurveTo(-0.005, 0.0175, -0.0115, 0.0165, -0.0132, 0.0105);
    pickShape.bezierCurveTo(-0.0145, 0.002, -0.0085, -0.011, 0, -0.0165);

    const pickGeom = new THREE.ExtrudeGeometry(pickShape, {
      depth: 0.0009,
      bevelEnabled: true,
      bevelThickness: 0.0003,
      bevelSize: 0.0003,
      bevelSegments: 2,
      curveSegments: 18
    });
    // Slight flex bend as it weaves through the strings
    const pAttr = pickGeom.attributes.position;
    const uAttr = pickGeom.attributes.uv;
    for (let i = 0; i < pAttr.count; i++) {
      const px = pAttr.getX(i);
      const py = pAttr.getY(i);
      const pz = pAttr.getZ(i);
      pAttr.setZ(i, pz + Math.sin(px * 95) * 0.0008);
      uAttr.setXY(i, px / 0.03 + 0.5, py / 0.036 + 0.5);
    }
    pickGeom.computeVertexNormals();

    const pick = setSlot(new THREE.Mesh(pickGeom, mats.tortoise), "secondary");
    const yPick = (fretYs[2] + fretYs[3]) * 0.5;
    pick.position.set(0.0035, yPick, zFretTop + 0.0022);
    pick.rotation.set(0.04, -0.08, -0.48);
    stringsRoot.add(pick);
  }

  return { stringsRoot, vibratingMeshes };
}

function buildStrapButtons(THREE, mats, cfg) {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const y = t * 0.0125;
    let r;
    if (t < 0.2) r = 0.0062;
    else if (t < 0.6) r = lerp(0.0046, 0.0034, (t - 0.2) / 0.4);
    else if (t < 0.9) r = lerp(0.0034, 0.0064, (t - 0.6) / 0.3);
    else r = Math.max(0.0001, 0.0064 * Math.cos(((t - 0.9) / 0.1) * Math.PI * 0.5));
    pts.push(new THREE.Vector2(r, y));
  }
  const btnGeom = new THREE.LatheGeometry(pts, 18);

  // Tailblock strap button
  const tailBtn = setSlot(new THREE.Mesh(btnGeom, mats.chrome), "secondary");
  tailBtn.position.set(0, 0.001, 0);
  tailBtn.rotation.x = Math.PI;
  g.add(tailBtn);

  // Heel strap button
  const heelBtn = setSlot(new THREE.Mesh(btnGeom, mats.chrome), "secondary");
  heelBtn.position.set(0.017, cfg.BODY_H - 0.012, cfg.zFretBase - 0.042);
  heelBtn.rotation.z = -Math.PI * 0.5;
  g.add(heelBtn);

  return g;
}

function buildWoodenStand(THREE, mats, guitarToWorld) {
  const standGroup = new THREE.Group();
  standGroup.name = "stand";

  // Derive exact contact geometry from the guitar's leaned pose
  const backHi = guitarToWorld(0, 0.38, -0.056);
  const backLo = guitarToWorld(0, 0.08, -0.056);
  const leanVec = new THREE.Vector3().subVectors(backHi, backLo).normalize();

  // Front inclined A-frame rails (left & right)
  const apexY = 0.425;
  const footY = 0.012;
  const zAtY = (targetY) => backLo.z + ((targetY - backLo.y) / leanVec.y) * leanVec.z - 0.016;
  const apexZ = zAtY(apexY);
  const frontFootZ = zAtY(footY);
  const rearFootZ = apexZ - 0.195;

  const xTop = 0.096;
  const xFrontBot = 0.148;
  const xRearBot = 0.158;

  // Helper to build a sculpted tapered wooden strut with rounded ends between two 3D points
  const makeWoodStrut = (pA, pB, wA, wB, thick) => {
    const dir = new THREE.Vector3().subVectors(pB, pA);
    const len = dir.length();
    const shape = new THREE.Shape();
    const rA = wA * 0.5;
    const rB = wB * 0.5;
    shape.absarc(0, 0, rA, Math.PI, Math.PI * 2, false);
    shape.bezierCurveTo(rA, len * 0.35, rB, len * 0.65, rB, len);
    shape.absarc(0, len, rB, 0, Math.PI, false);
    shape.bezierCurveTo(-rB, len * 0.65, -rA, len * 0.35, -rA, 0);

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: thick,
      bevelEnabled: true,
      bevelThickness: 0.0032,
      bevelSize: 0.0028,
      bevelSegments: 3,
      curveSegments: 16
    });
    geom.translate(0, 0, -thick * 0.5);
    const mesh = setSlot(new THREE.Mesh(geom, mats.standWood), "primary");

    // Orient local +Y along dir, local +X along world X-ish
    const up = dir.clone().normalize();
    const side = new THREE.Vector3(1, 0, 0);
    const fwd = new THREE.Vector3().crossVectors(side, up).normalize();
    side.crossVectors(up, fwd).normalize();
    const mat4 = new THREE.Matrix4().makeBasis(side, up, fwd);
    mesh.quaternion.setFromRotationMatrix(mat4);
    mesh.position.copy(pA);
    return mesh;
  };

  // Rubber non-slip foot geometry (LatheGeometry, 16 points, sits flat at y = 0)
  const footPts = [];
  for (let i = 0; i <= 15; i++) {
    const t = i / 15;
    const y = t * 0.015;
    const r = t < 0.15 ? lerp(0.0145, 0.0155, t / 0.15) : lerp(0.0155, 0.0128, (t - 0.15) / 0.85);
    footPts.push(new THREE.Vector2(r, y));
  }
  const footGeom = new THREE.LatheGeometry(footPts, 18);

  // Brass hinge end-cap (LatheGeometry, 16 points)
  const capPts = [];
  for (let i = 0; i <= 15; i++) {
    const t = i / 15;
    const y = t * 0.009;
    const r = t < 0.65 ? 0.0095 : Math.max(0.0001, 0.0095 * Math.cos(((t - 0.65) / 0.35) * Math.PI * 0.5));
    capPts.push(new THREE.Vector2(r, y));
  }
  const capGeom = new THREE.LatheGeometry(capPts, 16);

  for (const side of [-1, 1]) {
    const pTopFront = new THREE.Vector3(side * xTop, apexY, apexZ);
    const pBotFront = new THREE.Vector3(side * xFrontBot, footY, frontFootZ);
    standGroup.add(makeWoodStrut(pBotFront, pTopFront, 0.029, 0.025, 0.021));

    const pTopRear = new THREE.Vector3(side * (xTop + 0.025), apexY - 0.016, apexZ - 0.006);
    const pBotRear = new THREE.Vector3(side * xRearBot, footY, rearFootZ);
    standGroup.add(makeWoodStrut(pBotRear, pTopRear, 0.027, 0.023, 0.019));

    // Non-slip rubber feet resting cleanly at y = 0.000
    const fFront = setSlot(new THREE.Mesh(footGeom, mats.rubber), "accent");
    fFront.position.set(pBotFront.x, 0, pBotFront.z);
    standGroup.add(fFront);

    const fRear = setSlot(new THREE.Mesh(footGeom, mats.rubber), "accent");
    fRear.position.set(pBotRear.x, 0, pBotRear.z);
    standGroup.add(fRear);

    // Brass hinge cap on outer side of A-frame apex
    const cap = setSlot(new THREE.Mesh(capGeom, mats.brass), "secondary");
    cap.position.set(pTopRear.x + side * 0.011, pTopRear.y, pTopRear.z);
    cap.rotation.z = side < 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    standGroup.add(cap);

    // Upper plush velvet backrest strip along each front rail
    const padLo = new THREE.Vector3().lerpVectors(pBotFront, pTopFront, 0.62);
    const padHi = new THREE.Vector3().lerpVectors(pBotFront, pTopFront, 0.94);
    const backNormal = new THREE.Vector3(0, -leanVec.z, leanVec.y).normalize();
    const padCurve = new THREE.CatmullRomCurve3([
      padLo.clone().addScaledVector(backNormal, 0.0125),
      padLo.clone().lerp(padHi, 0.5).addScaledVector(backNormal, 0.0132),
      padHi.clone().addScaledVector(backNormal, 0.0125)
    ]);
    const backPadGeom = taperedTube(THREE, padCurve, 14, 14, (t) => 0.0085 * (0.85 + 0.15 * Math.sin(t * Math.PI)), true);
    standGroup.add(setSlot(new THREE.Mesh(backPadGeom, mats.velvet), "accent"));

    // Curved Lower Wooden Cradle Arm (hugging right under guitar lower bout)
    const armX = side * 0.118;
    const cBack = guitarToWorld(armX, 0.028, -0.056);
    const cMid = guitarToWorld(armX, 0.028, 0.005);
    const cFront = guitarToWorld(armX, 0.028, 0.060);
    // Offset slightly below the guitar bottom edge so velvet cushion contacts the guitar body cleanly
    const downOff = 0.017;
    const armShape = new THREE.Shape();
    const z0 = cBack.z - 0.022;
    const y0 = cBack.y - downOff;
    const z1 = cFront.z + 0.016;
    const y1 = cFront.y - downOff;
    const lipZ = z1 + 0.016;
    const lipY = y1 + 0.036;

    // Draw side profile in 2D (x2d = z, y2d = y)
    armShape.moveTo(z0, y0 - 0.014);
    armShape.lineTo(z1, y1 - 0.012);
    armShape.bezierCurveTo(lipZ + 0.006, y1 - 0.008, lipZ + 0.008, lipY - 0.008, lipZ, lipY);
    armShape.bezierCurveTo(lipZ - 0.008, lipY + 0.007, lipZ - 0.017, lipY + 0.002, lipZ - 0.015, lipY - 0.010);
    armShape.bezierCurveTo(z1 - 0.002, y1 + 0.004, z1 - 0.008, y1 + 0.006, z1 - 0.014, y1 + 0.005);
    armShape.lineTo(z0, y0 + 0.008);
    armShape.bezierCurveTo(z0 - 0.012, y0 + 0.006, z0 - 0.014, y0 - 0.012, z0, y0 - 0.014);

    const armGeom = new THREE.ExtrudeGeometry(armShape, {
      depth: 0.021,
      bevelEnabled: true,
      bevelThickness: 0.0028,
      bevelSize: 0.0025,
      bevelSegments: 3,
      curveSegments: 16
    });
    // Map 2D (x->z, y->y, z->x)
    armGeom.rotateY(-Math.PI * 0.5);
    armGeom.translate(armX + 0.0105, 0, 0);
    standGroup.add(setSlot(new THREE.Mesh(armGeom, mats.standWood), "primary"));

    // Plush Velvet Cradle Sleeve wrapping top of cradle arm
    const sleeveCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(armX, y0 + 0.007, z0 + 0.006),
      new THREE.Vector3(armX, cMid.y - 0.010, cMid.z),
      new THREE.Vector3(armX, y1 + 0.006, z1 - 0.005),
      new THREE.Vector3(armX, lipY - 0.004, lipZ - 0.007)
    ]);
    const sleeveGeom = taperedTube(
      THREE,
      sleeveCurve,
      16,
      20,
      (t) => lerp(0.0115, 0.0098, smoothstep(0.65, 1.0, t)),
      true
    );
    standGroup.add(setSlot(new THREE.Mesh(sleeveGeom, mats.velvet), "accent"));
  }

  // Top turned wooden hinge bar + brass rod connecting both A-frames
  {
    const barCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-xTop - 0.028, apexY - 0.016, apexZ - 0.006),
      new THREE.Vector3(0, apexY - 0.016, apexZ - 0.006),
      new THREE.Vector3(xTop + 0.028, apexY - 0.016, apexZ - 0.006)
    ]);
    const topBarGeom = taperedTube(
      THREE,
      barCurve,
      16,
      16,
      (t) => 0.0108 + Math.sin(t * Math.PI) * 0.0018,
      true
    );
    standGroup.add(setSlot(new THREE.Mesh(topBarGeom, mats.standWood), "primary"));

    // Soft center backrest bumper collar on top bar
    const bumpCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.042, apexY - 0.016, apexZ - 0.006),
      new THREE.Vector3(0, apexY - 0.016, apexZ - 0.006),
      new THREE.Vector3(0.042, apexY - 0.016, apexZ - 0.006)
    ]);
    const bumpGeom = taperedTube(THREE, bumpCurve, 16, 10, () => 0.0145, true);
    standGroup.add(setSlot(new THREE.Mesh(bumpGeom, mats.velvet), "accent"));
  }

  // Lower Front & Rear Cross-Stretchers for rock-solid woodworking joinery
  {
    const frontCrossY = 0.095;
    const frontCrossZ = zAtY(frontCrossY);
    const fcX = lerp(xFrontBot, xTop, (frontCrossY - footY) / (apexY - footY));
    const fcCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-fcX, frontCrossY, frontCrossZ),
      new THREE.Vector3(0, frontCrossY, frontCrossZ),
      new THREE.Vector3(fcX, frontCrossY, frontCrossZ)
    ]);
    standGroup.add(setSlot(new THREE.Mesh(taperedTube(THREE, fcCurve, 14, 12, () => 0.0095, true), mats.standWood), "primary"));

    const rearCrossY = 0.125;
    const tRear = (rearCrossY - footY) / (apexY - 0.016 - footY);
    const rearCrossZ = lerp(rearFootZ, apexZ - 0.006, tRear);
    const rcX = lerp(xRearBot, xTop + 0.025, tRear);
    const rcCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-rcX, rearCrossY, rearCrossZ),
      new THREE.Vector3(0, rearCrossY, rearCrossZ),
      new THREE.Vector3(rcX, rearCrossY, rearCrossZ)
    ]);
    standGroup.add(setSlot(new THREE.Mesh(taperedTube(THREE, rcCurve, 14, 12, () => 0.009, true), mats.standWood), "primary"));
  }

  return standGroup;
}

export function build(THREE, opts = {}, kit) {
  const woodHex = opts.wood || "#c89462";
  const accentHex = opts.accent || "#5a3b2e";
  const woodRgb = hexToRgb(woodHex);
  const accentRgb = hexToRgb(accentHex);

  const tex = makeTextures(THREE, kit, woodRgb, accentRgb);

  const mats = {
    spruce: new THREE.MeshPhysicalMaterial({
      map: tex.spruceColor,
      bumpMap: tex.spruceBump,
      bumpScale: 0.0005,
      roughness: 0.24,
      metalness: 0.0,
      clearcoat: 0.82,
      clearcoatRoughness: 0.14
    }),
    spruceEdge: new THREE.MeshPhysicalMaterial({
      color: rgbToHexNum(scaleRgb(woodRgb, 0.88)),
      roughness: 0.58,
      metalness: 0.0
    }),
    darkWood: new THREE.MeshPhysicalMaterial({
      map: tex.darkWoodColor,
      bumpMap: tex.darkWoodBump,
      bumpScale: 0.0006,
      roughness: 0.26,
      metalness: 0.0,
      clearcoat: 0.78,
      clearcoatRoughness: 0.16
    }),
    interiorWood: new THREE.MeshPhysicalMaterial({
      color: rgbToHexNum(scaleRgb(accentRgb, 0.34)),
      roughness: 0.92,
      metalness: 0.0
    }),
    standWood: new THREE.MeshPhysicalMaterial({
      map: tex.standWoodColor,
      bumpMap: tex.darkWoodBump,
      bumpScale: 0.0008,
      roughness: 0.52,
      metalness: 0.0,
      clearcoat: 0.18,
      clearcoatRoughness: 0.42
    }),
    fretboard: new THREE.MeshPhysicalMaterial({
      map: tex.fretWood,
      bumpMap: tex.darkWoodBump,
      bumpScale: 0.0005,
      roughness: 0.44,
      metalness: 0.0,
      clearcoat: 0.16,
      clearcoatRoughness: 0.38
    }),
    rosette: new THREE.MeshPhysicalMaterial({
      map: tex.rosetteColor,
      roughness: 0.22,
      metalness: 0.0,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12
    }),
    tortoise: new THREE.MeshPhysicalMaterial({
      map: tex.tortoiseColor,
      roughness: 0.18,
      metalness: 0.0,
      clearcoat: 0.92,
      clearcoatRoughness: 0.08
    }),
    label: new THREE.MeshPhysicalMaterial({
      map: tex.labelColor,
      roughness: 0.88,
      metalness: 0.0
    }),
    ivory: new THREE.MeshPhysicalMaterial({
      color: 0xf1e7d2,
      roughness: 0.25,
      metalness: 0.0,
      clearcoat: 0.55,
      clearcoatRoughness: 0.18
    }),
    pearl: new THREE.MeshPhysicalMaterial({
      color: 0xf5f2e8,
      roughness: 0.14,
      metalness: 0.08,
      clearcoat: 0.95,
      clearcoatRoughness: 0.08,
      iridescence: 0.45
    }),
    ebony: new THREE.MeshPhysicalMaterial({
      color: 0x1d1714,
      roughness: 0.32,
      metalness: 0.0,
      clearcoat: 0.35
    }),
    chrome: new THREE.MeshPhysicalMaterial({
      color: 0xe2e5ea,
      roughness: 0.22,
      metalness: 0.9,
      clearcoat: 0.3
    }),
    brass: new THREE.MeshPhysicalMaterial({
      color: 0xd4ad5a,
      roughness: 0.30,
      metalness: 0.86
    }),
    stringBronze: new THREE.MeshPhysicalMaterial({
      color: 0xd4a46a,
      roughness: 0.28,
      metalness: 0.88
    }),
    stringSteel: new THREE.MeshPhysicalMaterial({
      color: 0xe3e7ee,
      roughness: 0.18,
      metalness: 0.94
    }),
    velvet: new THREE.MeshPhysicalMaterial({
      map: tex.velvetColor,
      roughness: 0.92,
      metalness: 0.0,
      sheen: 0.85,
      sheenRoughness: 0.65,
      sheenColor: new THREE.Color(rgbToHexNum(mixRgb(accentRgb, [225, 205, 190], 0.38)))
    }),
    rubber: new THREE.MeshPhysicalMaterial({
      color: 0x22201f,
      roughness: 0.84,
      metalness: 0.0
    })
  };

  // Exact acoustic guitar layout dimensions (metres)
  const BODY_H = 0.476;
  const SH_Y = 0.336;
  const SH_R = 0.048;
  const SADDLE_Y = 0.195;
  const SCALE = 0.630;
  const NUT_Y = SADDLE_Y + SCALE; // 0.825

  const halfDepth = (y) => 0.0535 - 0.0035 * smoothstep(0.0, 0.38, y);
  const topArch = (x, y) => {
    const ux = x / 0.195;
    const uy = (y - 0.195) / 0.195;
    const r2 = ux * ux + uy * uy;
    return r2 >= 1 ? 0 : 0.0044 * (1 - r2) * (1 - r2 * 0.35);
  };
  const backArch = (x, y) => {
    const ux = x / 0.198;
    const uy = (y - 0.23) / 0.26;
    const r2 = ux * ux + uy * uy;
    return r2 >= 1 ? 0 : 0.0072 * (1 - r2);
  };
  const zTop = (x, y) => halfDepth(y) + topArch(x, y);
  const zBack = (x, y) => -halfDepth(y) - backArch(x, y);

  const zFretBase = zTop(0, BODY_H);
  const zFretTop = zFretBase + 0.0056;

  const stringBridgeX = [];
  const stringNutX = [];
  for (let i = 0; i < 6; i++) {
    const t = i / 5 - 0.5;
    stringBridgeX.push(t * 0.054);
    stringNutX.push(t * 0.036);
  }

  const cfg = {
    BODY_H,
    SH_Y,
    SH_R,
    SADDLE_Y,
    SCALE,
    NUT_Y,
    zTop,
    zBack,
    zFretBase,
    zFretTop,
    stringBridgeX,
    stringNutX
  };

  const root = new THREE.Group();
  root.name = "acousticGuitarDiorama";

  // Guitar assembly leaning gently back on the stand
  const LEAN_ANGLE = -0.22; // ~12.6 deg backward lean
  const guitarPos = new THREE.Vector3(0, 0.068, 0.115);

  const bodyGroup = new THREE.Group();
  bodyGroup.name = "body";
  bodyGroup.position.copy(guitarPos);
  bodyGroup.rotation.x = LEAN_ANGLE;
  root.add(bodyGroup);

  bodyGroup.add(buildGuitarBody(THREE, mats, cfg));
  bodyGroup.add(buildBridge(THREE, mats, cfg));
  const { neckGroup, postWorldTargets, fretYs } = buildSculptedNeckAndHeadstock(THREE, mats, cfg);
  bodyGroup.add(neckGroup);
  const { stringsRoot, vibratingMeshes } = buildStringsAndPick(THREE, mats, cfg, postWorldTargets, fretYs);
  bodyGroup.add(stringsRoot);
  bodyGroup.add(buildStrapButtons(THREE, mats, cfg));

  // Helper to convert guitar-local coordinates to diorama world coordinates
  const cosL = Math.cos(LEAN_ANGLE);
  const sinL = Math.sin(LEAN_ANGLE);
  const guitarToWorld = (lx, ly, lz) =>
    new THREE.Vector3(
      guitarPos.x + lx,
      guitarPos.y + ly * cosL - lz * sinL,
      guitarPos.z + ly * sinL + lz * cosL
    );

  // Wooden A-frame stand constructed directly against the guitar's exact contact points
  const standGroup = buildWoodenStand(THREE, mats, guitarToWorld);
  root.add(standGroup);

  root.userData.vibratingStrings = vibratingMeshes;
  return root;
}

export function idle(group, t) {
  const strings = group.userData && group.userData.vibratingStrings;
  if (!strings || !strings.length) return;

  // Gentle sympathetic chord shimmer every ~5.5 seconds while guitar stays solidly planted
  const cycle = t % 5.5;
  for (let i = 0; i < strings.length; i++) {
    const m = strings[i];
    const strumDelay = i * 0.065;
    const localT = cycle - strumDelay;
    if (localT > 0 && localT < 2.4) {
      const env = Math.exp(-localT * 2.1) * Math.min(1, localT * 18);
      const freq = 34 + i * 7.5;
      m.position.x = Math.sin(localT * freq) * 0.00055 * env;
    } else {
      m.position.x = 0;
    }
  }
}
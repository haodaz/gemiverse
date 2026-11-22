export const META = {
  id: "retro-record-player-cabinet",
  name: "Retro Record Player Cabinet",
  kind: "furniture",
  footprint: [0.62, 0.42],
  variants: [
    { id: "cozy-peach", name: "Cozy Peach", opts: { wood: "#c89462", accent: "#f2a7b8", metal: "#d9c08a" } },
    { id: "sage-walnut", name: "Sage Walnut", opts: { wood: "#8c5f3c", accent: "#a8c6a2", metal: "#d6b97c" } },
    { id: "butter-oak", name: "Buttercream Oak", opts: { wood: "#d4ab78", accent: "#f4d78c", metal: "#cfb582" } },
    { id: "cherry-sky", name: "Cherry Sky", opts: { wood: "#9e5342", accent: "#a9cce3", metal: "#dfcb9a" } },
  ],
  note: "Mid-century turntable on a compact dorm-room cabinet with spinning vinyl, S-shaped tonearm, backlit VU meter, rotary dials, built-in tweed speaker, and record sleeve storage.",
};

function parseColor(THREE, hex, fallback) {
  const c = new THREE.Color();
  try {
    c.set(hex || fallback);
  } catch (_) {
    c.set(fallback);
  }
  return c;
}

function shiftColorHex(THREE, hex, dl, ds = 0, dh = 0) {
  const c = parseColor(THREE, hex, "#888888");
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  hsl.h = (hsl.h + dh + 1) % 1;
  hsl.s = Math.max(0, Math.min(1, hsl.s + ds));
  hsl.l = Math.max(0, Math.min(1, hsl.l + dl));
  c.setHSL(hsl.h, hsl.s, hsl.l);
  return "#" + c.getHexString();
}

function fbm(kit, x, y, octaves = 3) {
  let v = 0;
  let amp = 0.55;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    v += amp * kit.noise(x * freq, y * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return v / norm;
}

function setColorSpace(THREE, tex) {
  if ("colorSpace" in tex && THREE.SRGBColorSpace) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  return tex;
}

function roundedRectShape(THREE, w, h, r) {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const rad = Math.min(r, hw * 0.95, hh * 0.95);
  const k = 0.55228475 * rad;
  const s = new THREE.Shape();
  s.moveTo(-hw + rad, -hh);
  s.lineTo(hw - rad, -hh);
  s.bezierCurveTo(hw - rad + k, -hh, hw, -hh + rad - k, hw, -hh + rad);
  s.lineTo(hw, hh - rad);
  s.bezierCurveTo(hw, hh - rad + k, hw - rad + k, hh, hw - rad, hh);
  s.lineTo(-hw + rad, hh);
  s.bezierCurveTo(-hw + rad - k, hh, -hw, hh - rad + k, -hw, hh - rad);
  s.lineTo(-hw, -hh + rad);
  s.bezierCurveTo(-hw, -hh + rad - k, -hw + rad - k, -hh, -hw + rad, -hh);
  return s;
}

function roundedRectHolePath(THREE, w, h, r) {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const rad = Math.min(r, hw * 0.95, hh * 0.95);
  const k = 0.55228475 * rad;
  const p = new THREE.Path();
  p.moveTo(-hw + rad, -hh);
  p.bezierCurveTo(-hw + rad - k, -hh, -hw, -hh + rad - k, -hw, -hh + rad);
  p.lineTo(-hw, hh - rad);
  p.bezierCurveTo(-hw, hh - rad + k, -hw + rad - k, hh, -hw + rad, hh);
  p.lineTo(hw - rad, hh);
  p.bezierCurveTo(hw - rad + k, hh, hw, hh - rad + k, hw, hh - rad);
  p.lineTo(hw, -hh + rad);
  p.bezierCurveTo(hw, -hh + rad - k, hw - rad + k, -hh, hw - rad, -hh);
  p.lineTo(-hw + rad, -hh);
  return p;
}

function createTaperedTube(THREE, curve, tubularSegs, radialSegs, radiusFn, capped = true) {
  const frames = curve.computeFrenetFrames(tubularSegs, false);
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    const p = curve.getPointAt(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r = Math.max(0.00015, typeof radiusFn === "function" ? radiusFn(t) : radiusFn);

    for (let j = 0; j <= radialSegs; j++) {
      const u = j / radialSegs;
      const theta = u * Math.PI * 2;
      const ct = Math.cos(theta);
      const st = Math.sin(theta);
      const vx = p.x + r * (ct * N.x + st * B.x);
      const vy = p.y + r * (ct * N.y + st * B.y);
      const vz = p.z + r * (ct * N.z + st * B.z);
      positions.push(vx, vy, vz);
      uvs.push(u, t);
    }
  }

  const stride = radialSegs + 1;
  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, d, b);
      indices.push(d, c, b);
    }
  }

  if (capped) {
    const pStart = curve.getPointAt(0);
    const startCenterIdx = positions.length / 3;
    positions.push(pStart.x, pStart.y, pStart.z);
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(startCenterIdx, j + 1, j);
    }

    const pEnd = curve.getPointAt(1);
    const endCenterIdx = positions.length / 3;
    positions.push(pEnd.x, pEnd.y, pEnd.z);
    uvs.push(0.5, 1);
    const ringOffset = tubularSegs * stride;
    for (let j = 0; j < radialSegs; j++) {
      indices.push(endCenterIdx, ringOffset + j, ringOffset + j + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function sculptSphere(THREE, radius, wSegs, hSegs, deformFn) {
  const geo = new THREE.SphereGeometry(radius, wSegs, hSegs);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    deformFn(v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function applyPlanarTopUVs(geo, radius) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const inv = 1 / (radius * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    uv.setXY(i, 0.5 + x * inv, 0.5 - z * inv);
  }
  uv.needsUpdate = true;
}

function makeWoodTextures(THREE, kit, woodHex) {
  const base = parseColor(THREE, woodHex, "#c89462");
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const cTmp = new THREE.Color();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const v = y / h;
        const warp = fbm(kit, u * 4.5, v * 1.4, 3) * 2.4;
        const ring = Math.sin((u * 14 + warp) * Math.PI * 2) * 0.5 + 0.5;
        const grain = Math.pow(ring, 1.85);
        const fine = fbm(kit, u * 48, v * 6.5, 2);
        const pore = kit.noise(u * 95, v * 16) > 0.82 ? -0.06 : 0;
        const shade = (grain - 0.45) * 0.14 + (fine - 0.5) * 0.06 + pore;

        cTmp.setHSL(
          (hsl.h + shade * 0.08 + 1) % 1,
          Math.max(0.08, Math.min(0.95, hsl.s + (grain - 0.5) * 0.08)),
          Math.max(0.1, Math.min(0.92, hsl.l + shade))
        );
        const idx = (y * w + x) * 4;
        d[idx] = Math.round(cTmp.r * 255);
        d[idx + 1] = Math.round(cTmp.g * 255);
        d[idx + 2] = Math.round(cTmp.b * 255);
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  setColorSpace(THREE, map);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2.0, 2.0);

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const v = y / h;
        const warp = fbm(kit, u * 4.5, v * 1.4, 3) * 2.4;
        const ring = Math.sin((u * 14 + warp) * Math.PI * 2) * 0.5 + 0.5;
        const fine = kit.noise(u * 60, v * 10);
        const val = Math.max(0, Math.min(255, Math.round((0.55 + ring * 0.25 + (fine - 0.5) * 0.22) * 255)));
        const idx = (y * w + x) * 4;
        d[idx] = val;
        d[idx + 1] = val;
        d[idx + 2] = val;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(2.0, 2.0);

  return { map, bump };
}

function makeBrushedMetalTextures(THREE, kit, metalHex) {
  const base = parseColor(THREE, metalHex, "#d9c08a");
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#" + base.getHexString();
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const n = kit.noise(0.5, y * 0.35);
      const alpha = (n - 0.5) * 0.14;
      ctx.fillStyle = alpha > 0 ? `rgba(255,250,235,${alpha})` : `rgba(40,30,15,${-alpha})`;
      ctx.fillRect(0, y, w, 1);
    }
    for (let i = 0; i < 220; i++) {
      const yy = kit.noise(i * 1.7, 3.1) * h;
      const xx = kit.noise(i * 2.3, 8.7) * w;
      const len = 30 + kit.noise(i * 0.9, 1.2) * 110;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(xx, yy, len, 1);
    }
  });
  setColorSpace(THREE, map);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const g = Math.round(115 + kit.noise(1.2, y * 0.55) * 35);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(0, y, w, 1);
    }
  });
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  return { map, bump };
}

function makeAccentTexture(THREE, kit, accentHex) {
  const cLight = shiftColorHex(THREE, accentHex, 0.04, -0.02);
  const cDark = shiftColorHex(THREE, accentHex, -0.04, 0.02);
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, cLight);
    grad.addColorStop(0.55, accentHex);
    grad.addColorStop(1, cDark);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = kit.noise(i * 1.37, 2.13) * w;
      const y = kit.noise(4.71, i * 1.91) * h;
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.045)" : "rgba(40,20,30,0.03)";
      ctx.fillRect(x, y, 2, 2);
    }
  });
  setColorSpace(THREE, tex);
  return tex;
}

function makeTweedTextures(THREE, kit, woodHex, accentHex) {
  const cream = "#efe6d5";
  const warmThread = shiftColorHex(THREE, woodHex, 0.14, -0.18);
  const darkThread = shiftColorHex(THREE, woodHex, -0.16, -0.15);
  const fleck = shiftColorHex(THREE, accentHex, -0.05, -0.1);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = cream;
    ctx.fillRect(0, 0, w, h);
    const step = 4;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const checker = ((x / step) + (y / step)) % 2 === 0;
        const n = kit.noise(x * 0.09, y * 0.09);
        ctx.fillStyle = checker ? warmThread : cream;
        if (n > 0.78) ctx.fillStyle = darkThread;
        else if (n < 0.18) ctx.fillStyle = fleck;
        ctx.fillRect(x, y, step - 0.6, step - 0.6);
        ctx.fillStyle = "rgba(45,30,20,0.12)";
        ctx.fillRect(x + step - 1, y, 1, step);
        ctx.fillRect(x, y + step - 1, step, 1);
      }
    }
  });
  setColorSpace(THREE, map);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1.6, 1.4);

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#505050";
    ctx.fillRect(0, 0, w, h);
    const step = 4;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const checker = ((x / step) + (y / step)) % 2 === 0;
        ctx.fillStyle = checker ? "#dcdcdc" : "#9c9c9c";
        ctx.fillRect(x + 0.5, y + 0.5, step - 1.2, step - 1.2);
      }
    }
  });
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(1.6, 1.4);

  return { map, bump };
}

function makeVinylTextures(THREE, kit, accentHex, metalHex) {
  const accentDark = shiftColorHex(THREE, accentHex, -0.16, 0.08);
  const cream = "#faf2e4";

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const R = w * 0.495;

    ctx.fillStyle = "#121215";
    ctx.fillRect(0, 0, w, h);

    // Subtle anisotropic sheen wedges baked gently
    const sheen = ctx.createConicGradient(0.4, cx, cy);
    sheen.addColorStop(0.0, "rgba(255,255,255,0.01)");
    sheen.addColorStop(0.11, "rgba(255,248,240,0.11)");
    sheen.addColorStop(0.22, "rgba(255,255,255,0.01)");
    sheen.addColorStop(0.5, "rgba(255,255,255,0.01)");
    sheen.addColorStop(0.61, "rgba(255,248,240,0.10)");
    sheen.addColorStop(0.72, "rgba(255,255,255,0.01)");
    sheen.addColorStop(1.0, "rgba(255,255,255,0.01)");
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();

    // Concentric microgrooves + 4 track separation bands
    const trackGaps = [R * 0.82, R * 0.67, R * 0.54];
    for (let r = R * 0.36; r < R * 0.975; r += 1.35) {
      let isGap = false;
      for (let g = 0; g < trackGaps.length; g++) {
        if (Math.abs(r - trackGaps[g]) < 2.2) isGap = true;
      }
      const n = kit.noise(r * 0.27, 4.2);
      ctx.strokeStyle = isGap
        ? "rgba(8,8,10,0.85)"
        : `rgba(${34 + Math.round(n * 24)},${34 + Math.round(n * 24)},${40 + Math.round(n * 26)},0.58)`;
      ctx.lineWidth = isGap ? 1.8 : 0.75;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Center retro pastel record label
    const lr = R * 0.34;
    ctx.fillStyle = accentHex;
    ctx.beginPath();
    ctx.arc(cx, cy, lr, 0, Math.PI * 2);
    ctx.fill();

    // Half-moon retro design on label
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, lr, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = cream;
    ctx.fillRect(cx - lr, cy + lr * 0.04, lr * 2, lr);
    ctx.fillStyle = accentDark;
    ctx.fillRect(cx - lr, cy - lr * 0.08, lr * 2, lr * 0.14);
    ctx.fillStyle = metalHex;
    ctx.fillRect(cx - lr, cy + lr * 0.06, lr * 2, lr * 0.045);
    ctx.restore();

    // Decorative gold inner rings & tiny typography blocks
    ctx.strokeStyle = metalHex;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, lr * 0.89, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = cream;
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("COZY LO-FI", cx, cy - lr * 0.34);

    ctx.fillStyle = accentDark;
    ctx.font = "bold 11px sans-serif";
    ctx.fillText("SIDE A  •  33⅓", cx, cy + lr * 0.44);

    // Subtle track lines on lower half
    ctx.fillStyle = "rgba(60,40,45,0.45)";
    ctx.fillRect(cx - 28, cy + lr * 0.56, 56, 2.5);
    ctx.fillRect(cx - 18, cy + lr * 0.68, 36, 2.5);

    // Center spindle hole ring
    ctx.fillStyle = "#18181b";
    ctx.beginPath();
    ctx.arc(cx, cy, lr * 0.095, 0, Math.PI * 2);
    ctx.fill();
  });
  setColorSpace(THREE, map);

  const bump = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const R = w * 0.495;
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, w, h);
    for (let r = R * 0.36; r < R * 0.975; r += 1.5) {
      const v = Math.round(95 + kit.noise(r * 0.4, 1.7) * 95);
      ctx.strokeStyle = `rgb(${v},${v},${v})`;
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#888888";
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.34, 0, Math.PI * 2);
    ctx.fill();
  });

  return { map, bump };
}

function makeStrobeTexture(THREE, kit, metalHex) {
  const darkMetal = shiftColorHex(THREE, metalHex, -0.34, -0.1);
  const lightMetal = shiftColorHex(THREE, metalHex, 0.14, -0.05);
  const tex = kit.canvasTexture(512, 64, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, lightMetal);
    grad.addColorStop(0.5, metalHex);
    grad.addColorStop(1, darkMetal);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Dark recessed strobe band with machined silver dots
    ctx.fillStyle = "#262320";
    ctx.fillRect(0, h * 0.24, w, h * 0.52);

    ctx.fillStyle = lightMetal;
    const count = 48;
    for (let i = 0; i < count; i++) {
      const x = (i / count) * w;
      ctx.beginPath();
      ctx.arc(x + 4, h * 0.38, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 4, h * 0.62, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  setColorSpace(THREE, tex);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function makeControlPlateTexture(THREE, kit, metalHex, accentHex) {
  const base = shiftColorHex(THREE, metalHex, 0.04, -0.08);
  const ink = "#3a2e25";
  const tex = kit.canvasTexture(256, 384, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      const a = (kit.noise(0.5, y * 0.3) - 0.5) * 0.08;
      ctx.fillStyle = a > 0 ? `rgba(255,255,255,${a})` : `rgba(30,20,10,${-a})`;
      ctx.fillRect(0, y, w, 2);
    }
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    // Tick arcs around the 3 knob centers (mapped to control plate local layout)
    const knobs = [
      { x: w * 0.72, y: h * 0.54, r: 34, label: "PITCH" },
      { x: w * 0.28, y: h * 0.80, r: 42, label: "VOL" },
      { x: w * 0.72, y: h * 0.80, r: 42, label: "TONE" },
    ];
    ctx.fillStyle = ink;
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";

    for (const k of knobs) {
      for (let i = 0; i <= 10; i++) {
        const ang = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
        const r0 = k.r;
        const r1 = k.r + (i % 5 === 0 ? 8 : 5);
        ctx.beginPath();
        ctx.moveTo(k.x + Math.cos(ang) * r0, k.y + Math.sin(ang) * r0);
        ctx.lineTo(k.x + Math.cos(ang) * r1, k.y + Math.sin(ang) * r1);
        ctx.stroke();
      }
      ctx.fillText(k.label, k.x, k.y + k.r + 20);
    }

    // Speed switch label
    ctx.fillText("33", w * 0.28, h * 0.43);
    ctx.fillText("45", w * 0.28, h * 0.64);

    // Power lamp label
    ctx.fillStyle = shiftColorHex(THREE, accentHex, -0.25, 0.15);
    ctx.fillText("PWR", w * 0.78, h * 0.34);
  });
  setColorSpace(THREE, tex);
  return tex;
}

function makeVuMeterTexture(THREE, kit, accentHex) {
  const redZone = shiftColorHex(THREE, accentHex, -0.18, 0.25);
  const tex = kit.canvasTexture(256, 128, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.9, 10, w * 0.5, h * 0.7, w * 0.65);
    grad.addColorStop(0, "#fff5d2");
    grad.addColorStop(0.65, "#f9d690");
    grad.addColorStop(1, "#d99d56");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // VU scale arc
    const cx = w * 0.5;
    const cy = h * 1.15;
    const rad = h * 0.82;
    ctx.strokeStyle = "#3a2818";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, Math.PI * 1.24, Math.PI * 1.62);
    ctx.stroke();

    ctx.strokeStyle = redZone;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, Math.PI * 1.62, Math.PI * 1.76);
    ctx.stroke();

    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * (1.24 + (i / 10) * 0.52);
      ctx.strokeStyle = i >= 8 ? redZone : "#3a2818";
      ctx.lineWidth = i % 2 === 0 ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (rad - 8), cy + Math.sin(a) * (rad - 8));
      ctx.lineTo(cx + Math.cos(a) * (rad + 6), cy + Math.sin(a) * (rad + 6));
      ctx.stroke();
    }

    ctx.fillStyle = "#3a2818";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("VU", cx, h * 0.84);

    // Needle
    ctx.strokeStyle = "#2b1b12";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(Math.PI * 1.56) * (rad + 4), cy + Math.sin(Math.PI * 1.56) * (rad + 4));
    ctx.stroke();
  });
  setColorSpace(THREE, tex);
  return tex;
}

function makeSleeveTexture(THREE, kit, index, cfg) {
  const palettes = [
    { bg: cfg.accent, c1: "#fff6ea", c2: shiftColorHex(THREE, cfg.wood, -0.1, 0.05), c3: cfg.metal },
    { bg: "#2e4656", c1: "#f5c27a", c2: cfg.accent, c3: "#f5efe6" },
    { bg: "#f3e5cf", c1: "#d96b52", c2: "#3b5f5c", c3: cfg.metal },
    { bg: "#5c436b", c1: cfg.accent, c2: "#f7d488", c3: "#ffffff" },
    { bg: "#799b7c", c1: "#f7efdc", c2: cfg.wood, c3: "#354739" },
    { bg: "#d9825b", c1: "#fff3df", c2: "#47312c", c3: cfg.metal },
    { bg: "#374357", c1: "#a9cce3", c2: cfg.accent, c3: "#fdf6e9" },
  ];
  const p = palettes[index % palettes.length];

  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, w, h);

    // Cozy retro album art patterns
    const motif = index % 7;
    if (motif === 0) {
      // Sunset stripes & sun
      ctx.fillStyle = p.c1;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.44, w * 0.25, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i % 2 === 0 ? p.c2 : p.c3;
        ctx.fillRect(0, h * (0.58 + i * 0.065), w, h * 0.045);
      }
    } else if (motif === 1) {
      // Crescent moon & stars lo-fi jazz
      ctx.fillStyle = p.c1;
      ctx.beginPath();
      ctx.arc(w * 0.52, h * 0.42, w * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.bg;
      ctx.beginPath();
      ctx.arc(w * 0.62, h * 0.36, w * 0.21, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.c3;
      for (let i = 0; i < 14; i++) {
        const sx = kit.noise(i * 2.1, 1.3) * w;
        const sy = kit.noise(3.4, i * 1.9) * h * 0.72;
        ctx.beginPath();
        ctx.arc(sx, sy, 2 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = p.c2;
      ctx.fillRect(w * 0.14, h * 0.78, w * 0.72, h * 0.08);
    } else if (motif === 2) {
      // Mid-century geometric jazz arches
      ctx.fillStyle = p.c1;
      ctx.beginPath();
      ctx.arc(w * 0.35, h * 0.52, w * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.c2;
      ctx.beginPath();
      ctx.arc(w * 0.68, h * 0.52, w * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.c3;
      ctx.fillRect(w * 0.12, h * 0.14, w * 0.76, h * 0.06);
    } else if (motif === 3) {
      // Diagonal synth waves
      for (let i = -2; i < 7; i++) {
        ctx.strokeStyle = i % 2 === 0 ? p.c1 : p.c2;
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(0, h * (0.2 + i * 0.13));
        ctx.bezierCurveTo(w * 0.35, h * (0.08 + i * 0.13), w * 0.65, h * (0.32 + i * 0.13), w, h * (0.2 + i * 0.13));
        ctx.stroke();
      }
    } else if (motif === 4) {
      // Botanical indie leaf circles
      ctx.fillStyle = p.c1;
      ctx.fillRect(w * 0.12, h * 0.12, w * 0.76, h * 0.76);
      ctx.fillStyle = p.c3;
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.52, w * 0.14, h * 0.28, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.c2;
      ctx.beginPath();
      ctx.ellipse(w * 0.54, h * 0.54, w * 0.11, h * 0.22, 0.45, 0, Math.PI * 2);
      ctx.fill();
    } else if (motif === 5) {
      // Retro concentric rings
      for (let r = 92; r >= 22; r -= 18) {
        ctx.fillStyle = (r / 18) % 2 === 0 ? p.c1 : p.c2;
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.5, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Cozy city-pop pastel window
      ctx.fillStyle = p.c1;
      ctx.fillRect(w * 0.18, h * 0.18, w * 0.64, h * 0.54);
      ctx.fillStyle = p.c2;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.46, w * 0.17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.c3;
      ctx.fillRect(w * 0.18, h * 0.78, w * 0.64, h * 0.06);
    }

    // Subtle paper grain & vinyl ring-wear hint
    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.5, w * 0.45, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(0,0,0,0.14)";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);
  });
  setColorSpace(THREE, tex);
  return { map: tex, spineColor: p.bg, spineAccent: p.c1 };
}

function buildSleeveMesh(THREE, width, height, thickness, coverMat, spineMat) {
  // Extrude square cover along Z, then map planar UVs on faces so art fits cleanly
  const shape = roundedRectShape(THREE, width, height, 0.004);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.0009,
    bevelSize: 0.0009,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.translate(0, 0, -thickness * 0.5);

  // Gently bow sleeve faces slightly outward for tactile cardboard realism
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);
    const nx = x / (width * 0.5);
    const ny = y / (height * 0.5);
    const bow = Math.cos(Math.min(1, Math.abs(nx)) * Math.PI * 0.5) * Math.cos(Math.min(1, Math.abs(ny)) * Math.PI * 0.5);
    z += Math.sign(z) * bow * 0.0011;
    pos.setZ(i, z);
    uv.setXY(i, 0.5 + x / width, 0.5 + y / height);
  }
  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();

  // Group 0 = front/back faces, Group 1 = extruded spine edges
  const mesh = new THREE.Mesh(geo, [coverMat, spineMat]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function build(THREE, opts, kit) {
  const cfg = {
    wood: "#c89462",
    accent: "#f2a7b8",
    metal: "#d9c08a",
    ...(opts || {}),
  };

  const root = new THREE.Group();
  root.name = "recordPlayerCabinet";

  // Procedural textures
  const woodTex = makeWoodTextures(THREE, kit, cfg.wood);
  const metalTex = makeBrushedMetalTextures(THREE, kit, cfg.metal);
  const accentMap = makeAccentTexture(THREE, kit, cfg.accent);
  const tweedTex = makeTweedTextures(THREE, kit, cfg.wood, cfg.accent);
  const vinylTex = makeVinylTextures(THREE, kit, cfg.accent, cfg.metal);
  const strobeMap = makeStrobeTexture(THREE, kit, cfg.metal);
  const controlMap = makeControlPlateTexture(THREE, kit, cfg.metal, cfg.accent);
  const vuMap = makeVuMeterTexture(THREE, kit, cfg.accent);

  // Materials (MeshPhysicalMaterial)
  const woodMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: woodTex.map,
    bumpMap: woodTex.bump,
    bumpScale: 0.0025,
    roughness: 0.44,
    metalness: 0.02,
    clearcoat: 0.34,
    clearcoatRoughness: 0.28,
  });

  const woodDarkMat = new THREE.MeshPhysicalMaterial({
    color: parseColor(THREE, shiftColorHex(THREE, cfg.wood, -0.14, 0.02), "#9c6d41"),
    map: woodTex.map,
    bumpMap: woodTex.bump,
    bumpScale: 0.0022,
    roughness: 0.54,
    metalness: 0.02,
    clearcoat: 0.2,
    clearcoatRoughness: 0.35,
  });

  const accentMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: accentMap,
    roughness: 0.28,
    metalness: 0.04,
    clearcoat: 0.62,
    clearcoatRoughness: 0.16,
  });

  const brassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: metalTex.map,
    bumpMap: metalTex.bump,
    bumpScale: 0.0012,
    roughness: 0.25,
    metalness: 0.88,
    clearcoat: 0.25,
    clearcoatRoughness: 0.2,
  });

  const chromeMat = new THREE.MeshPhysicalMaterial({
    color: parseColor(THREE, shiftColorHex(THREE, cfg.metal, 0.18, -0.35), "#e8e2d5"),
    bumpMap: metalTex.bump,
    bumpScale: 0.0008,
    roughness: 0.16,
    metalness: 0.94,
    clearcoat: 0.3,
  });

  const darkMetalMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a2726,
    roughness: 0.42,
    metalness: 0.72,
  });

  const rubberMat = new THREE.MeshPhysicalMaterial({
    color: 0x201e20,
    roughness: 0.88,
    metalness: 0.02,
    sheen: 0.2,
  });

  const vinylMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: vinylTex.map,
    bumpMap: vinylTex.bump,
    bumpScale: 0.0018,
    roughness: 0.22,
    metalness: 0.08,
    clearcoat: 0.88,
    clearcoatRoughness: 0.12,
  });

  const platterRimMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: strobeMap,
    roughness: 0.28,
    metalness: 0.85,
  });

  const tweedMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: tweedTex.map,
    bumpMap: tweedTex.bump,
    bumpScale: 0.0045,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.88,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color("#fff7e8"),
  });

  const controlPlateMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: controlMap,
    bumpMap: metalTex.bump,
    bumpScale: 0.0008,
    roughness: 0.3,
    metalness: 0.8,
  });

  const glowColor = parseColor(THREE, shiftColorHex(THREE, cfg.accent, 0.08, 0.22), "#ff9eb5");
  const powerLampMat = new THREE.MeshPhysicalMaterial({
    color: glowColor,
    emissive: glowColor,
    emissiveIntensity: 1.55,
    roughness: 0.14,
    clearcoat: 1.0,
  });

  const vuMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: vuMap,
    emissive: new THREE.Color("#ffca7a"),
    emissiveMap: vuMap,
    emissiveIntensity: 1.35,
    roughness: 0.16,
    clearcoat: 0.9,
  });

  const acrylicMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#f5f7fa"),
    roughness: 0.08,
    metalness: 0.0,
    transmission: 0.78,
    ior: 1.48,
    transparent: true,
    opacity: 0.34,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    depthWrite: false,
  });

  const mark = (mesh, slot) => {
    mesh.userData.slot = slot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  // ============================================================================
  // 1. SPLAYED MID-CENTURY LEGS (LatheGeometry with brass ferrules & floor pads)
  // ============================================================================
  const legsGroup = new THREE.Group();
  legsGroup.name = "legs";
  root.add(legsGroup);

  const legHeight = 0.214;
  // 18-point lathe profile for tapered mid-century wood shaft (upper portion)
  const woodLegPts = [];
  for (let i = 0; i <= 17; i++) {
    const t = i / 17; // 0 = top of ferrule, 1 = top of leg
    const y = 0.038 + t * (legHeight - 0.038);
    // Gentle mid-century swell near upper third
    const swell = Math.sin(t * Math.PI) * 0.0026;
    const r = 0.0115 + t * 0.0095 + swell;
    woodLegPts.push(new THREE.Vector2(r, y));
  }
  const woodLegGeo = new THREE.LatheGeometry(woodLegPts, 28);

  // Brass ferrule tip (16-point lathe)
  const ferrulePts = [
    new THREE.Vector2(0.001, 0.002),
    new THREE.Vector2(0.0095, 0.002),
    new THREE.Vector2(0.0102, 0.005),
    new THREE.Vector2(0.0106, 0.010),
    new THREE.Vector2(0.0109, 0.016),
    new THREE.Vector2(0.0112, 0.022),
    new THREE.Vector2(0.0116, 0.028),
    new THREE.Vector2(0.0121, 0.034),
    new THREE.Vector2(0.0125, 0.037),
    new THREE.Vector2(0.0128, 0.039),
    new THREE.Vector2(0.0124, 0.041),
    new THREE.Vector2(0.0116, 0.042),
    new THREE.Vector2(0.0114, 0.043),
    new THREE.Vector2(0.0110, 0.044),
    new THREE.Vector2(0.0080, 0.044),
    new THREE.Vector2(0.001, 0.044),
  ];
  const ferruleGeo = new THREE.LatheGeometry(ferrulePts, 24);

  // Sculpted floor pad resting cleanly at y = 0
  const floorPadGeo = sculptSphere(THREE, 0.012, 32, 24, (v) => {
    v.y *= 0.45;
    if (v.y < 0) v.y *= 0.35; // Flat underside on floor
    v.y += 0.0022;
  });

  // Mounting block under cabinet
  const mountPlateShape = roundedRectShape(THREE, 0.068, 0.068, 0.014);
  const mountPlateGeo = new THREE.ExtrudeGeometry(mountPlateShape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelSize: 0.002,
    bevelThickness: 0.002,
    bevelSegments: 2,
    curveSegments: 10,
  });
  mountPlateGeo.rotateX(Math.PI * 0.5);

  const legSpecs = [
    { sx: -1, sz: 1 },
    { sx: 1, sz: 1 },
    { sx: -1, sz: -1 },
    { sx: 1, sz: -1 },
  ];
  const upVec = new THREE.Vector3(0, 1, 0);

  for (const ls of legSpecs) {
    const topPos = new THREE.Vector3(ls.sx * 0.224, 0.222, ls.sz * 0.124);
    const botPos = new THREE.Vector3(ls.sx * 0.264, 0.004, ls.sz * 0.156);
    const dir = new THREE.Vector3().subVectors(topPos, botPos);
    const len = dir.length();
    const unitDir = dir.clone().normalize();

    const legWrap = new THREE.Group();
    legWrap.position.copy(botPos);
    legWrap.quaternion.setFromUnitVectors(upVec, unitDir);
    legWrap.scale.set(1, len / legHeight, 1);

    legWrap.add(mark(new THREE.Mesh(woodLegGeo, woodMat), "primary"));
    legWrap.add(mark(new THREE.Mesh(ferruleGeo, brassMat), "secondary"));
    legsGroup.add(legWrap);

    const pad = mark(new THREE.Mesh(floorPadGeo, rubberMat), "secondary");
    pad.position.set(botPos.x, 0, botPos.z);
    legsGroup.add(pad);

    const plate = mark(new THREE.Mesh(mountPlateGeo, woodDarkMat), "primary");
    plate.position.set(topPos.x, 0.224, topPos.z);
    legsGroup.add(plate);
  }

  // ============================================================================
  // 2. SMALL RECORD CABINET (Continuous rounded hollow ExtrudeGeometry shell)
  // ============================================================================
  const cabinetGroup = new THREE.Group();
  cabinetGroup.name = "body";
  root.add(cabinetGroup);

  const cabW = 0.60;
  const cabH = 0.36;
  const cabD = 0.37;
  const cabWall = 0.022;
  const cabCenterY = 0.22 + cabH * 0.5; // 0.40

  const cabOuter = roundedRectShape(THREE, cabW, cabH, 0.032);
  cabOuter.holes.push(roundedRectHolePath(THREE, cabW - cabWall * 2, cabH - cabWall * 2, 0.015));
  const cabShellGeo = new THREE.ExtrudeGeometry(cabOuter, {
    depth: cabD,
    bevelEnabled: true,
    bevelThickness: 0.009,
    bevelSize: 0.008,
    bevelSegments: 5,
    curveSegments: 24,
  });
  cabShellGeo.translate(0, 0, -cabD * 0.5);
  const cabShell = mark(new THREE.Mesh(cabShellGeo, woodMat), "primary");
  cabShell.position.y = cabCenterY;
  cabinetGroup.add(cabShell);

  // Recessed back panel
  const backShape = roundedRectShape(THREE, cabW - cabWall * 1.4, cabH - cabWall * 1.4, 0.016);
  const backGeo = new THREE.ExtrudeGeometry(backShape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 2,
    curveSegments: 12,
  });
  const backPanel = mark(new THREE.Mesh(backGeo, woodDarkMat), "primary");
  backPanel.position.set(0, cabCenterY, -cabD * 0.5 + 0.006);
  cabinetGroup.add(backPanel);

  // Interior vertical divider between record slot (left) and speaker+drawer (right)
  const divX = 0.078;
  const innerFloorY = 0.22 + cabWall; // 0.242
  const innerCeilY = 0.22 + cabH - cabWall; // 0.558
  const innerH = innerCeilY - innerFloorY; // 0.316

  const vDivShape = roundedRectShape(THREE, 0.016, innerH + 0.006, 0.004);
  const vDivGeo = new THREE.ExtrudeGeometry(vDivShape, {
    depth: cabD - 0.036,
    bevelEnabled: true,
    bevelSize: 0.0018,
    bevelThickness: 0.002,
    bevelSegments: 2,
    curveSegments: 8,
  });
  vDivGeo.translate(0, 0, -(cabD - 0.036) * 0.5);
  const vDiv = mark(new THREE.Mesh(vDivGeo, woodMat), "primary");
  vDiv.position.set(divX, cabCenterY, 0.004);
  cabinetGroup.add(vDiv);

  // Horizontal divider in right bay (speaker above, drawer below)
  const rightBayLeft = divX + 0.008;
  const rightBayRight = cabW * 0.5 - cabWall;
  const rightBayW = rightBayRight - rightBayLeft;
  const rightBayCenterX = (rightBayLeft + rightBayRight) * 0.5;
  const shelfY = 0.386;

  const hDivShape = roundedRectShape(THREE, rightBayW + 0.006, 0.014, 0.003);
  const hDivGeo = new THREE.ExtrudeGeometry(hDivShape, {
    depth: cabD - 0.04,
    bevelEnabled: true,
    bevelSize: 0.0015,
    bevelThickness: 0.0018,
    bevelSegments: 2,
    curveSegments: 8,
  });
  hDivGeo.translate(0, 0, -(cabD - 0.04) * 0.5);
  const hDiv = mark(new THREE.Mesh(hDivGeo, woodMat), "primary");
  hDiv.position.set(rightBayCenterX, shelfY, 0.002);
  cabinetGroup.add(hDiv);

  // Brass wire record dividers inside the left storage slot
  const wireXs = [-0.158, -0.042];
  for (const wx of wireXs) {
    const wireCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(wx, innerFloorY - 0.002, -0.145),
      new THREE.Vector3(wx, innerFloorY + 0.14, -0.142),
      new THREE.Vector3(wx, innerFloorY + 0.195, -0.06),
      new THREE.Vector3(wx, innerFloorY + 0.185, 0.095),
      new THREE.Vector3(wx, innerFloorY + 0.11, 0.138),
      new THREE.Vector3(wx, innerFloorY - 0.002, 0.142),
    ]);
    const wireGeo = createTaperedTube(THREE, wireCurve, 36, 10, 0.0024, true);
    cabinetGroup.add(mark(new THREE.Mesh(wireGeo, brassMat), "secondary"));
  }

  // ============================================================================
  // 3. RECORD SLEEVES IN THE SLOT (7 varied sleeves with procedural retro covers)
  // ============================================================================
  const sleevesGroup = new THREE.Group();
  sleevesGroup.name = "recordSleeves";
  cabinetGroup.add(sleevesGroup);

  const sleeveSpecs = [
    { x: -0.258, z: 0.022, tilt: -0.055, h: 0.292 },
    { x: -0.236, z: 0.032, tilt: -0.065, h: 0.296 },
    { x: -0.212, z: 0.018, tilt: -0.045, h: 0.290 },
    { x: -0.132, z: 0.052, tilt: -0.075, h: 0.298 }, // Pulled slightly forward
    { x: -0.104, z: 0.026, tilt: -0.040, h: 0.292 },
    { x: -0.016, z: 0.042, tilt: -0.115, h: 0.294 },
    { x: 0.016, z: 0.062, tilt: -0.175, h: 0.296 }, // Leaned artfully so cover shows in 3/4 view
  ];

  for (let i = 0; i < sleeveSpecs.length; i++) {
    const sp = sleeveSpecs[i];
    const art = makeSleeveTexture(THREE, kit, i, cfg);
    const coverMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: art.map,
      roughness: 0.68,
      metalness: 0.02,
      sheen: 0.28,
      sheenRoughness: 0.7,
    });
    const spineMat = new THREE.MeshPhysicalMaterial({
      color: parseColor(THREE, art.spineColor, cfg.accent),
      roughness: 0.66,
      metalness: 0.02,
      sheen: 0.25,
    });

    const sleevePivot = new THREE.Group();
    // Place pivot on inner floor so tilting never clips through bottom slab
    const thick = 0.0075;
    const mesh = buildSleeveMesh(THREE, sp.h, sp.h, thick, coverMat, spineMat);
    mesh.userData.slot = i % 3 === 0 ? "accent" : "primary";
    // Rotate so square cover faces +/- X and spine faces +Z
    mesh.rotation.y = Math.PI * 0.5;
    mesh.position.y = sp.h * 0.5 + Math.abs(Math.sin(sp.tilt)) * thick * 0.6;
    sleevePivot.add(mesh);

    // Tiny white/black inner record edge peeking out slightly on sleeves 3 and 6
    if (i === 3 || i === 6) {
      const innerRimGeo = new THREE.CylinderGeometry(sp.h * 0.45, sp.h * 0.45, 0.0022, 32);
      innerRimGeo.rotateZ(Math.PI * 0.5);
      const innerRim = mark(new THREE.Mesh(innerRimGeo, rubberMat), "secondary");
      innerRim.position.set(0, sp.h * 0.5, 0.018);
      sleevePivot.add(innerRim);
    }

    sleevePivot.position.set(sp.x, innerFloorY + 0.001, sp.z);
    sleevePivot.rotation.z = sp.tilt;
    sleevesGroup.add(sleevePivot);
  }

  // ============================================================================
  // 4. BUILT-IN COZY TWEED SPEAKER (Upper Right) & ACCESSORY DRAWER (Lower Right)
  // ============================================================================
  const spkW = rightBayW - 0.012;
  const spkH = innerCeilY - (shelfY + 0.007) - 0.012;
  const spkCenterY = (innerCeilY + shelfY + 0.007) * 0.5;

  // Recessed wood bezel frame around speaker
  const spkBezelOuter = roundedRectShape(THREE, spkW, spkH, 0.016);
  spkBezelOuter.holes.push(roundedRectHolePath(THREE, spkW - 0.018, spkH - 0.018, 0.01));
  const spkBezelGeo = new THREE.ExtrudeGeometry(spkBezelOuter, {
    depth: 0.022,
    bevelEnabled: true,
    bevelSize: 0.0025,
    bevelThickness: 0.0025,
    bevelSegments: 3,
    curveSegments: 14,
  });
  const spkBezel = mark(new THREE.Mesh(spkBezelGeo, woodDarkMat), "primary");
  spkBezel.position.set(rightBayCenterX, spkCenterY, 0.158);
  cabinetGroup.add(spkBezel);

  // Bowed tweed speaker cloth (extruded shape bent slightly outward)
  const clothShape = roundedRectShape(THREE, spkW - 0.012, spkH - 0.012, 0.012);
  const clothGeo = new THREE.ExtrudeGeometry(clothShape, {
    depth: 0.01,
    bevelEnabled: true,
    bevelSize: 0.002,
    bevelThickness: 0.002,
    bevelSegments: 2,
    curveSegments: 14,
  });
  const cPos = clothGeo.attributes.position;
  const cUv = clothGeo.attributes.uv;
  for (let i = 0; i < cPos.count; i++) {
    const x = cPos.getX(i);
    const y = cPos.getY(i);
    let z = cPos.getZ(i);
    const nx = x / (spkW * 0.5);
    const ny = y / (spkH * 0.5);
    const swell = Math.cos(Math.min(1, Math.abs(nx)) * Math.PI * 0.5) * Math.cos(Math.min(1, Math.abs(ny)) * Math.PI * 0.5);
    z += swell * 0.007;
    cPos.setZ(i, z);
    cUv.setXY(i, 0.5 + x / spkW, 0.5 + y / spkH);
  }
  cPos.needsUpdate = true;
  cUv.needsUpdate = true;
  clothGeo.computeVertexNormals();
  const speakerCloth = mark(new THREE.Mesh(clothGeo, tweedMat), "accent");
  speakerCloth.position.set(rightBayCenterX, spkCenterY, 0.164);
  cabinetGroup.add(speakerCloth);

  // Tiny brass speaker crest badge on lower-right of cloth
  const badgeShape = roundedRectShape(THREE, 0.032, 0.011, 0.004);
  const badgeGeo = new THREE.ExtrudeGeometry(badgeShape, {
    depth: 0.0025,
    bevelEnabled: true,
    bevelSize: 0.0008,
    bevelThickness: 0.0008,
    bevelSegments: 2,
    curveSegments: 8,
  });
  const badge = mark(new THREE.Mesh(badgeGeo, brassMat), "secondary");
  badge.position.set(rightBayCenterX + spkW * 0.26, spkCenterY - spkH * 0.28, 0.178);
  cabinetGroup.add(badge);

  // Lower-right accessory drawer (slightly pulled ajar for cozy dorm charm)
  const drwW = rightBayW - 0.008;
  const drwH = shelfY - 0.007 - innerFloorY - 0.008;
  const drwCenterY = (shelfY - 0.007 + innerFloorY) * 0.5;
  const drawerGroup = new THREE.Group();
  drawerGroup.name = "drawer";
  drawerGroup.position.set(rightBayCenterX, drwCenterY, 0.175);
  cabinetGroup.add(drawerGroup);

  const drwFaceShape = roundedRectShape(THREE, drwW, drwH, 0.01);
  const drwFaceGeo = new THREE.ExtrudeGeometry(drwFaceShape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelSize: 0.003,
    bevelThickness: 0.003,
    bevelSegments: 3,
    curveSegments: 12,
  });
  const drwFace = mark(new THREE.Mesh(drwFaceGeo, woodMat), "primary");
  drwFace.position.z = -0.006;
  drawerGroup.add(drwFace);

  // Recessed drawer inner box behind front face
  const drwBoxGeo = new THREE.BoxGeometry(drwW - 0.016, drwH - 0.014, 0.24);
  const drwBox = mark(new THREE.Mesh(drwBoxGeo, woodDarkMat), "primary");
  drwBox.position.z = -0.125;
  drawerGroup.add(drwBox);

  // Curved brass drawer handle (tapered TubeGeometry along CatmullRomCurve3)
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.036, 0.004, 0.014),
    new THREE.Vector3(-0.034, 0.004, 0.034),
    new THREE.Vector3(-0.016, 0.004, 0.041),
    new THREE.Vector3(0.016, 0.004, 0.041),
    new THREE.Vector3(0.034, 0.004, 0.034),
    new THREE.Vector3(0.036, 0.004, 0.014),
  ]);
  const handleGeo = createTaperedTube(THREE, handleCurve, 32, 12, (t) => 0.0034 + Math.sin(t * Math.PI) * 0.0014, true);
  drawerGroup.add(mark(new THREE.Mesh(handleGeo, brassMat), "secondary"));

  // ============================================================================
  // 5. TURNTABLE PLINTH, ISOLATION FEET & ACCENT DECK
  // ============================================================================
  const deckBaseY = 0.58; // Top of cabinet
  const turntableGroup = new THREE.Group();
  turntableGroup.name = "turntable";
  root.add(turntableGroup);

  // 4 turned isolation feet (LatheGeometry)
  const isoFootPts = [];
  for (let i = 0; i <= 15; i++) {
    const t = i / 15;
    const y = t * 0.013;
    const r = 0.018 - Math.sin(t * Math.PI) * 0.0028 - t * 0.002;
    isoFootPts.push(new THREE.Vector2(r, y));
  }
  const isoFootGeo = new THREE.LatheGeometry(isoFootPts, 24);
  const isoFootPos = [
    [-0.215, 0.132],
    [0.215, 0.132],
    [-0.215, -0.132],
    [0.215, -0.132],
  ];
  for (const [fx, fz] of isoFootPos) {
    const foot = mark(new THREE.Mesh(isoFootGeo, rubberMat), "secondary");
    foot.position.set(fx, deckBaseY, fz);
    turntableGroup.add(foot);
  }

  // Sculpted wooden plinth skirt
  const plinthW = 0.534;
  const plinthD = 0.358;
  const plinthH = 0.048;
  const plinthY = deckBaseY + 0.012; // 0.592

  const plinthShape = roundedRectShape(THREE, plinthW, plinthD, 0.026);
  const plinthGeo = new THREE.ExtrudeGeometry(plinthShape, {
    depth: plinthH,
    bevelEnabled: true,
    bevelSize: 0.006,
    bevelThickness: 0.006,
    bevelSegments: 4,
    curveSegments: 20,
  });
  plinthGeo.rotateX(-Math.PI * 0.5);
  const plinthMesh = mark(new THREE.Mesh(plinthGeo, woodMat), "primary");
  plinthMesh.position.y = plinthY;
  turntableGroup.add(plinthMesh);

  // Subtle brass waist trim strip wrapping around the plinth
  const trimShape = roundedRectShape(THREE, plinthW + 0.014, plinthD + 0.014, 0.03);
  trimShape.holes.push(roundedRectHolePath(THREE, plinthW - 0.002, plinthD - 0.002, 0.024));
  const trimGeo = new THREE.ExtrudeGeometry(trimShape, {
    depth: 0.005,
    bevelEnabled: true,
    bevelSize: 0.001,
    bevelThickness: 0.001,
    bevelSegments: 2,
    curveSegments: 20,
  });
  trimGeo.rotateX(-Math.PI * 0.5);
  const trimMesh = mark(new THREE.Mesh(trimGeo, brassMat), "secondary");
  trimMesh.position.y = plinthY + 0.012;
  turntableGroup.add(trimMesh);

  // Pastel accent upper deck plate
  const deckTopY = plinthY + plinthH + 0.006; // 0.646
  const deckPlateShape = roundedRectShape(THREE, plinthW - 0.022, plinthD - 0.022, 0.02);
  const deckPlateGeo = new THREE.ExtrudeGeometry(deckPlateShape, {
    depth: 0.008,
    bevelEnabled: true,
    bevelSize: 0.0035,
    bevelThickness: 0.0035,
    bevelSegments: 3,
    curveSegments: 20,
  });
  deckPlateGeo.rotateX(-Math.PI * 0.5);
  const deckPlate = mark(new THREE.Mesh(deckPlateGeo, accentMat), "accent");
  deckPlate.position.y = deckTopY - 0.002;
  turntableGroup.add(deckPlate);

  const deckSurfaceY = deckTopY + 0.0095; // 0.6555

  // Top-left corner 45 RPM brass adapter puck resting in a shallow dish
  const adapterGroup = new THREE.Group();
  adapterGroup.position.set(-0.214, deckSurfaceY, -0.128);
  turntableGroup.add(adapterGroup);

  const dishPts = [];
  for (let i = 0; i <= 15; i++) {
    const t = i / 15;
    const r = 0.0225 - t * 0.0025;
    const y = (1 - Math.sin(t * Math.PI * 0.5)) * 0.0025;
    dishPts.push(new THREE.Vector2(r, y));
  }
  adapterGroup.add(mark(new THREE.Mesh(new THREE.LatheGeometry(dishPts, 24), darkMetalMat), "secondary"));

  const puckPts = [
    new THREE.Vector2(0.0042, 0.0005),
    new THREE.Vector2(0.0042, 0.0075),
    new THREE.Vector2(0.0055, 0.0085),
    new THREE.Vector2(0.011, 0.0085),
    new THREE.Vector2(0.013, 0.0075),
    new THREE.Vector2(0.0155, 0.0075),
    new THREE.Vector2(0.0175, 0.0068),
    new THREE.Vector2(0.0182, 0.0055),
    new THREE.Vector2(0.0182, 0.002),
    new THREE.Vector2(0.0172, 0.0005),
    new THREE.Vector2(0.014, 0.0005),
    new THREE.Vector2(0.012, 0.002),
    new THREE.Vector2(0.009, 0.002),
    new THREE.Vector2(0.007, 0.0005),
    new THREE.Vector2(0.005, 0.0005),
    new THREE.Vector2(0.0042, 0.0005),
  ];
  adapterGroup.add(mark(new THREE.Mesh(new THREE.LatheGeometry(puckPts, 28), brassMat), "secondary"));

  // ============================================================================
  // 6. PLATTER, RUBBER MAT, VINYL RECORD & SPINDLE (Spinning Group)
  // ============================================================================
  const platterCenter = new THREE.Vector3(-0.068, deckSurfaceY, -0.006);
  const platterGroup = new THREE.Group();
  platterGroup.name = "platter";
  platterGroup.position.copy(platterCenter);
  turntableGroup.add(platterGroup);

  // Platter collar ring sitting stationary beneath platter
  const wellPts = [
    new THREE.Vector2(0.135, 0.0),
    new THREE.Vector2(0.151, 0.0),
    new THREE.Vector2(0.152, 0.003),
    new THREE.Vector2(0.149, 0.005),
    new THREE.Vector2(0.145, 0.005),
    new THREE.Vector2(0.142, 0.002),
    new THREE.Vector2(0.135, 0.002),
    new THREE.Vector2(0.130, 0.001),
    new THREE.Vector2(0.125, 0.001),
    new THREE.Vector2(0.120, 0.001),
    new THREE.Vector2(0.115, 0.001),
    new THREE.Vector2(0.110, 0.001),
    new THREE.Vector2(0.105, 0.001),
    new THREE.Vector2(0.100, 0.001),
    new THREE.Vector2(0.095, 0.001),
    new THREE.Vector2(0.090, 0.0),
  ];
  const wellRing = mark(new THREE.Mesh(new THREE.LatheGeometry(wellPts, 48), darkMetalMat), "secondary");
  wellRing.position.copy(platterCenter);
  turntableGroup.add(wellRing);

  // Die-cast stepped platter (20-point LatheGeometry)
  const platterPts = [
    new THREE.Vector2(0.001, 0.002),
    new THREE.Vector2(0.146, 0.002),
    new THREE.Vector2(0.1465, 0.004),
    new THREE.Vector2(0.1458, 0.007),
    new THREE.Vector2(0.1448, 0.010),
    new THREE.Vector2(0.1438, 0.013),
    new THREE.Vector2(0.1428, 0.016),
    new THREE.Vector2(0.1418, 0.0185),
    new THREE.Vector2(0.1402, 0.0195),
    new THREE.Vector2(0.138, 0.0195),
    new THREE.Vector2(0.135, 0.0192),
    new THREE.Vector2(0.115, 0.0192),
    new THREE.Vector2(0.095, 0.0192),
    new THREE.Vector2(0.075, 0.0192),
    new THREE.Vector2(0.055, 0.0192),
    new THREE.Vector2(0.035, 0.0192),
    new THREE.Vector2(0.015, 0.0192),
    new THREE.Vector2(0.001, 0.0192),
  ];
  const platterGeo = new THREE.LatheGeometry(platterPts, 56);
  const platterMesh = mark(new THREE.Mesh(platterGeo, platterRimMat), "secondary");
  platterGroup.add(platterMesh);

  // Rubber slip mat (16-point LatheGeometry with subtle concentric ribs)
  const matPts = [
    new THREE.Vector2(0.004, 0.0192),
    new THREE.Vector2(0.138, 0.0192),
    new THREE.Vector2(0.138, 0.022),
    new THREE.Vector2(0.135, 0.0228),
    new THREE.Vector2(0.120, 0.0224),
    new THREE.Vector2(0.112, 0.0230),
    new THREE.Vector2(0.104, 0.0224),
    new THREE.Vector2(0.088, 0.0224),
    new THREE.Vector2(0.080, 0.0230),
    new THREE.Vector2(0.072, 0.0224),
    new THREE.Vector2(0.055, 0.0224),
    new THREE.Vector2(0.048, 0.0230),
    new THREE.Vector2(0.040, 0.0222),
    new THREE.Vector2(0.022, 0.0222),
    new THREE.Vector2(0.008, 0.0222),
    new THREE.Vector2(0.004, 0.0222),
  ];
  platterGroup.add(mark(new THREE.Mesh(new THREE.LatheGeometry(matPts, 48), rubberMat), "secondary"));

  // 12" Vinyl Record (LatheGeometry with planar top-down UVs for grooves + center label)
  const vinylR = 0.141;
  const vinylY = 0.023;
  const vinylPts = [
    new THREE.Vector2(0.004, vinylY),
    new THREE.Vector2(vinylR, vinylY),
    new THREE.Vector2(vinylR + 0.0008, vinylY + 0.0014),
    new THREE.Vector2(vinylR, vinylY + 0.0030),
    new THREE.Vector2(vinylR - 0.003, vinylY + 0.0033),
    new THREE.Vector2(vinylR - 0.007, vinylY + 0.0028),
    new THREE.Vector2(0.115, vinylY + 0.0027),
    new THREE.Vector2(0.095, vinylY + 0.0027),
    new THREE.Vector2(0.075, vinylY + 0.0027),
    new THREE.Vector2(0.056, vinylY + 0.0027),
    new THREE.Vector2(0.050, vinylY + 0.0025),
    new THREE.Vector2(0.048, vinylY + 0.0031),
    new THREE.Vector2(0.036, vinylY + 0.0032),
    new THREE.Vector2(0.022, vinylY + 0.0032),
    new THREE.Vector2(0.010, vinylY + 0.0031),
    new THREE.Vector2(0.004, vinylY + 0.0030),
  ];
  const vinylGeo = new THREE.LatheGeometry(vinylPts, 64);
  applyPlanarTopUVs(vinylGeo, vinylR + 0.001);
  const vinylMesh = mark(new THREE.Mesh(vinylGeo, vinylMat), "accent");
  platterGroup.add(vinylMesh);

  // Brass center spindle (LatheGeometry with smooth rounded dome tip)
  const spindlePts = [];
  for (let i = 0; i <= 17; i++) {
    const t = i / 17;
    if (t < 0.72) {
      const k = t / 0.72;
      spindlePts.push(new THREE.Vector2(0.0041 - k * 0.0004, vinylY + 0.001 + k * 0.015));
    } else {
      const k = (t - 0.72) / 0.28;
      const ang = k * Math.PI * 0.5;
      spindlePts.push(new THREE.Vector2(Math.cos(ang) * 0.0037, vinylY + 0.016 + Math.sin(ang) * 0.0042));
    }
  }
  platterGroup.add(mark(new THREE.Mesh(new THREE.LatheGeometry(spindlePts, 24), brassMat), "secondary"));

  // ============================================================================
  // 7. S-SHAPED RETRO TONEARM, GIMBAL, COUNTERWEIGHT & HEADSHELL
  // ============================================================================
  const gimbalX = 0.168;
  const gimbalZ = -0.095;
  const gimbalBaseGroup = new THREE.Group();
  gimbalBaseGroup.position.set(gimbalX, deckSurfaceY, gimbalZ);
  turntableGroup.add(gimbalBaseGroup);

  // Multi-tiered turned gimbal base & bearing tower (LatheGeometry)
  const basePts = [
    new THREE.Vector2(0.034, 0.0),
    new THREE.Vector2(0.034, 0.004),
    new THREE.Vector2(0.031, 0.007),
    new THREE.Vector2(0.027, 0.008),
    new THREE.Vector2(0.025, 0.012),
    new THREE.Vector2(0.024, 0.016),
    new THREE.Vector2(0.020, 0.019),
    new THREE.Vector2(0.016, 0.021),
    new THREE.Vector2(0.015, 0.027),
    new THREE.Vector2(0.016, 0.030),
    new THREE.Vector2(0.014, 0.033),
    new THREE.Vector2(0.012, 0.036),
    new THREE.Vector2(0.012, 0.042),
    new THREE.Vector2(0.014, 0.044),
    new THREE.Vector2(0.014, 0.047),
    new THREE.Vector2(0.001, 0.048),
  ];
  gimbalBaseGroup.add(mark(new THREE.Mesh(new THREE.LatheGeometry(basePts, 32), darkMetalMat), "secondary"));

  // Brass height-adjust collar ring
  const collarPts = [
    new THREE.Vector2(0.0245, 0.008),
    new THREE.Vector2(0.0275, 0.0085),
    new THREE.Vector2(0.0280, 0.0105),
    new THREE.Vector2(0.0275, 0.0125),
    new THREE.Vector2(0.0245, 0.013),
    new THREE.Vector2(0.0235, 0.012),
    new THREE.Vector2(0.0235, 0.009),
    new THREE.Vector2(0.0245, 0.008),
  ];
  gimbalBaseGroup.add(mark(new THREE.Mesh(new THREE.LatheGeometry(collarPts, 32), brassMat), "secondary"));

  // Cueing lever (small tapered curved brass arm on gimbal base)
  const cueCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.016, 0.022, 0.014),
    new THREE.Vector3(-0.026, 0.026, 0.024),
    new THREE.Vector3(-0.030, 0.032, 0.036),
  ]);
  gimbalBaseGroup.add(mark(new THREE.Mesh(createTaperedTube(THREE, cueCurve, 16, 10, (t) => 0.0018 + t * 0.001, true), chromeMat), "secondary"));

  // Tonearm rest post standing on deck
  const restPostGroup = new THREE.Group();
  restPostGroup.position.set(0.146, deckSurfaceY, 0.006);
  turntableGroup.add(restPostGroup);
  const restPts = [];
  for (let i = 0; i <= 15; i++) {
    const t = i / 15;
    const r = t < 0.15 ? 0.008 - t * 0.02 : 0.0036 - t * 0.0008;
    restPts.push(new THREE.Vector2(r, t * 0.036));
  }
  restPostGroup.add(mark(new THREE.Mesh(new THREE.LatheGeometry(restPts, 16), darkMetalMat), "secondary"));
  const restClipCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.005, 0.041, 0),
    new THREE.Vector3(-0.004, 0.036, 0),
    new THREE.Vector3(0.0, 0.034, 0),
    new THREE.Vector3(0.004, 0.036, 0),
    new THREE.Vector3(0.005, 0.041, 0),
  ]);
  restPostGroup.add(mark(new THREE.Mesh(createTaperedTube(THREE, restClipCurve, 16, 8, 0.0016, true), brassMat), "secondary"));

  // Pivoting tonearm group centered at gimbal bearing height
  const pivotY = deckSurfaceY + 0.048; // 0.7035
  const tonearmGroup = new THREE.Group();
  tonearmGroup.name = "tonearm";
  tonearmGroup.position.set(gimbalX, pivotY, gimbalZ);
  turntableGroup.add(tonearmGroup);

  // Gimbal U-yoke arch
  const yokeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.015, -0.008, -0.011),
    new THREE.Vector3(-0.015, 0.012, -0.011),
    new THREE.Vector3(0.0, 0.018, 0.0),
    new THREE.Vector3(0.015, 0.012, 0.011),
    new THREE.Vector3(0.015, -0.008, 0.011),
  ]);
  tonearmGroup.add(mark(new THREE.Mesh(createTaperedTube(THREE, yokeCurve, 24, 12, 0.0036, true), brassMat), "secondary"));

  // Gimbal bearing housing barrel
  const pivotBarrelGeo = new THREE.CylinderGeometry(0.0085, 0.0085, 0.026, 20);
  pivotBarrelGeo.rotateZ(Math.PI * 0.5);
  pivotBarrelGeo.rotateY(-0.62);
  tonearmGroup.add(mark(new THREE.Mesh(pivotBarrelGeo, chromeMat), "secondary"));

  // Classic S-shaped tonearm tube sweeping from counterweight to groove!
  // Stylus target on vinyl in world space: (+0.0175, deckSurfaceY + 0.026, +0.035)
  // In tonearm local coords: (-0.1505, -0.022, +0.130)
  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.042, 0.003, -0.044),
    new THREE.Vector3(0.0, 0.0, 0.0),
    new THREE.Vector3(-0.036, -0.002, 0.048),
    new THREE.Vector3(-0.068, -0.004, 0.092),
    new THREE.Vector3(-0.106, -0.006, 0.114),
    new THREE.Vector3(-0.134, -0.008, 0.123),
  ]);
  const armTubeGeo = createTaperedTube(
    THREE,
    armCurve,
    48,
    14,
    (t) => 0.0042 - t * 0.0014,
    true
  );
  tonearmGroup.add(mark(new THREE.Mesh(armTubeGeo, chromeMat), "secondary"));

  // Counterweight cylinder (LatheGeometry) on the rear tail of the tonearm
  const cwPts = [
    new THREE.Vector2(0.004, -0.014),
    new THREE.Vector2(0.0135, -0.014),
    new THREE.Vector2(0.0145, -0.012),
    new THREE.Vector2(0.0145, -0.007),
    new THREE.Vector2(0.0138, -0.006),
    new THREE.Vector2(0.0145, -0.005),
    new THREE.Vector2(0.0145, 0.004),
    new THREE.Vector2(0.0132, 0.0055),
    new THREE.Vector2(0.0132, 0.009),
    new THREE.Vector2(0.0124, 0.011),
    new THREE.Vector2(0.0115, 0.012),
    new THREE.Vector2(0.010, 0.0125),
    new THREE.Vector2(0.008, 0.0125),
    new THREE.Vector2(0.006, 0.0125),
    new THREE.Vector2(0.0045, 0.012),
    new THREE.Vector2(0.004, 0.010),
  ];
  const cwGeo = new THREE.LatheGeometry(cwPts, 28);
  const cwMesh = mark(new THREE.Mesh(cwGeo, brassMat), "secondary");
  const tailDir = new THREE.Vector3(-0.042, -0.003, 0.044).normalize();
  cwMesh.position.set(0.030, 0.0022, -0.032);
  cwMesh.quaternion.setFromUnitVectors(upVec, tailDir);
  tonearmGroup.add(cwMesh);

  // Headshell, finger lift, cartridge & stylus at end of arm
  const headshellGroup = new THREE.Group();
  headshellGroup.position.set(-0.134, -0.008, 0.123);
  // Align headshell tangent to groove at (+0.0175, +0.035)
  headshellGroup.rotation.y = -0.34;
  tonearmGroup.add(headshellGroup);

  // Headshell locking collar
  const lockGeo = new THREE.CylinderGeometry(0.0042, 0.0042, 0.009, 16);
  lockGeo.rotateZ(Math.PI * 0.5);
  headshellGroup.add(mark(new THREE.Mesh(lockGeo, brassMat), "secondary"));

  // Beveled retro headshell plate
  const hsShape = roundedRectShape(THREE, 0.032, 0.016, 0.0045);
  const hsGeo = new THREE.ExtrudeGeometry(hsShape, {
    depth: 0.0042,
    bevelEnabled: true,
    bevelSize: 0.0012,
    bevelThickness: 0.0012,
    bevelSegments: 2,
    curveSegments: 10,
  });
  hsGeo.rotateX(-Math.PI * 0.5);
  const hsMesh = mark(new THREE.Mesh(hsGeo, darkMetalMat), "secondary");
  hsMesh.position.set(-0.017, -0.001, 0);
  headshellGroup.add(hsMesh);

  // Curved brass finger-lift hook on headshell
  const liftCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.018, 0.002, 0.006),
    new THREE.Vector3(-0.020, 0.003, 0.016),
    new THREE.Vector3(-0.016, 0.007, 0.021),
    new THREE.Vector3(-0.012, 0.010, 0.022),
  ]);
  headshellGroup.add(mark(new THREE.Mesh(createTaperedTube(THREE, liftCurve, 16, 8, 0.0012, true), brassMat), "secondary"));

  // Accent-colored phono cartridge underneath headshell
  const cartShape = roundedRectShape(THREE, 0.020, 0.011, 0.0025);
  const cartGeo = new THREE.ExtrudeGeometry(cartShape, {
    depth: 0.0085,
    bevelEnabled: true,
    bevelSize: 0.0008,
    bevelThickness: 0.0008,
    bevelSegments: 2,
    curveSegments: 8,
  });
  cartGeo.rotateX(-Math.PI * 0.5);
  const cartMesh = mark(new THREE.Mesh(cartGeo, accentMat), "accent");
  cartMesh.position.set(-0.018, -0.0095, 0);
  headshellGroup.add(cartMesh);

  // Delicate stylus cantilever kissing the vinyl surface
  const stylusCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.020, -0.009, 0),
    new THREE.Vector3(-0.025, -0.0135, 0),
    new THREE.Vector3(-0.026, -0.0145, 0),
  ]);
  headshellGroup.add(mark(new THREE.Mesh(createTaperedTube(THREE, stylusCurve, 8, 6, (t) => 0.0009 * (1 - t * 0.55), true), chromeMat), "secondary"));

  // ============================================================================
  // 8. CONTROL PANEL: DIALS, TOGGLE SWITCH, BACKLIT VU METER & POWER LAMP
  // ============================================================================
  const ctrlGroup = new THREE.Group();
  ctrlGroup.name = "controls";
  ctrlGroup.position.set(0.184, deckSurfaceY, 0.080);
  turntableGroup.add(ctrlGroup);

  const plateW = 0.108;
  const plateD = 0.144;
  const plateShape = roundedRectShape(THREE, plateW, plateD, 0.011);
  const plateGeo = new THREE.ExtrudeGeometry(plateShape, {
    depth: 0.0035,
    bevelEnabled: true,
    bevelSize: 0.0012,
    bevelThickness: 0.0012,
    bevelSegments: 2,
    curveSegments: 12,
  });
  plateGeo.rotateX(-Math.PI * 0.5);
  // Map planar UVs for printed control plate markings
  const pPos = plateGeo.attributes.position;
  const pUv = plateGeo.attributes.uv;
  for (let i = 0; i < pPos.count; i++) {
    pUv.setXY(i, 0.5 + pPos.getX(i) / plateW, 0.5 - pPos.getZ(i) / plateD);
  }
  pUv.needsUpdate = true;
  const controlPlate = mark(new THREE.Mesh(plateGeo, controlPlateMat), "secondary");
  ctrlGroup.add(controlPlate);

  const plateTopY = 0.0048;

  // Vintage backlit VU Meter (top-left of control strip, gently angled forward)
  const vuGroup = new THREE.Group();
  vuGroup.position.set(-0.018, plateTopY + 0.007, -0.044);
  vuGroup.rotation.x = 0.28;
  ctrlGroup.add(vuGroup);

  const vuBezelShape = roundedRectShape(THREE, 0.046, 0.025, 0.005);
  const vuBezelGeo = new THREE.ExtrudeGeometry(vuBezelShape, {
    depth: 0.012,
    bevelEnabled: true,
    bevelSize: 0.0015,
    bevelThickness: 0.0015,
    bevelSegments: 2,
    curveSegments: 10,
  });
  vuBezelGeo.translate(0, 0, -0.006);
  vuGroup.add(mark(new THREE.Mesh(vuBezelGeo, brassMat), "secondary"));

  const vuScreenGeo = new THREE.PlaneGeometry(0.038, 0.018);
  const vuScreen = new THREE.Mesh(vuScreenGeo, vuMat);
  vuScreen.name = "vuGlow";
  vuScreen.userData.slot = "glow";
  vuScreen.position.z = 0.0078;
  vuGroup.add(vuScreen);

  // Warm glowing faceted/domed power jewel lamp (top-right of control strip)
  const lampGroup = new THREE.Group();
  lampGroup.position.set(0.030, plateTopY, -0.042);
  ctrlGroup.add(lampGroup);

  const lampBezelPts = [];
  for (let i = 0; i <= 15; i++) {
    const t = i / 15;
    lampBezelPts.push(new THREE.Vector2(0.0095 - t * 0.0018, t * 0.0065));
  }
  lampGroup.add(mark(new THREE.Mesh(new THREE.LatheGeometry(lampBezelPts, 24), brassMat), "secondary"));

  const jewelGeo = sculptSphere(THREE, 0.0068, 32, 24, (v) => {
    v.y *= 0.85;
    if (v.y < 0) v.y *= 0.3;
  });
  const jewelMesh = new THREE.Mesh(jewelGeo, powerLampMat);
  jewelMesh.name = "glowLamp";
  jewelMesh.userData.slot = "glow";
  jewelMesh.position.y = 0.0062;
  lampGroup.add(jewelMesh);

  // Speed selector toggle switch (33 / 45)
  const toggleGroup = new THREE.Group();
  toggleGroup.position.set(-0.024, plateTopY, 0.005);
  ctrlGroup.add(toggleGroup);

  const nutGeo = new THREE.CylinderGeometry(0.0062, 0.0068, 0.0045, 6);
  nutGeo.translate(0, 0.0022, 0);
  toggleGroup.add(mark(new THREE.Mesh(nutGeo, brassMat), "secondary"));

  const batPts = [];
  for (let i = 0; i <= 15; i++) {
    const t = i / 15;
    const r = 0.0018 + t * 0.0018 - (t > 0.85 ? (t - 0.85) * 0.012 : 0);
    batPts.push(new THREE.Vector2(Math.max(0.0002, r), t * 0.016));
  }
  const batMesh = mark(new THREE.Mesh(new THREE.LatheGeometry(batPts, 16), chromeMat), "secondary");
  batMesh.position.y = 0.003;
  batMesh.rotation.x = -0.32;
  toggleGroup.add(batMesh);

  // Retro skirted rotary dials (Volume, Tone, Pitch) via LatheGeometry
  function createDial(radius, height, rotY) {
    const g = new THREE.Group();
    const pts = [
      new THREE.Vector2(radius * 1.08, 0.0),
      new THREE.Vector2(radius * 1.08, height * 0.14),
      new THREE.Vector2(radius * 0.92, height * 0.24),
      new THREE.Vector2(radius * 0.86, height * 0.30),
      new THREE.Vector2(radius * 0.84, height * 0.55),
      new THREE.Vector2(radius * 0.80, height * 0.78),
      new THREE.Vector2(radius * 0.76, height * 0.90),
      new THREE.Vector2(radius * 0.72, height * 0.96),
      new THREE.Vector2(radius * 0.65, height),
      new THREE.Vector2(radius * 0.55, height),
      new THREE.Vector2(radius * 0.45, height * 0.98),
      new THREE.Vector2(radius * 0.35, height * 0.98),
      new THREE.Vector2(radius * 0.25, height * 0.98),
      new THREE.Vector2(radius * 0.15, height * 0.98),
      new THREE.Vector2(radius * 0.06, height * 0.98),
      new THREE.Vector2(0.0005, height * 0.98),
    ];
    const body = mark(new THREE.Mesh(new THREE.LatheGeometry(pts, 32), darkMetalMat), "secondary");
    g.add(body);

    // Brass top cap disc
    const capGeo = new THREE.CylinderGeometry(radius * 0.66, radius * 0.72, height * 0.16, 28);
    capGeo.translate(0, height * 0.96, 0);
    g.add(mark(new THREE.Mesh(capGeo, brassMat), "secondary"));

    // Pointer indicator rib on top
    const ptrGeo = new THREE.BoxGeometry(radius * 0.14, height * 0.12, radius * 0.52);
    ptrGeo.translate(0, height * 1.05, -radius * 0.22);
    g.add(mark(new THREE.Mesh(ptrGeo, accentMat), "accent"));

    g.rotation.y = rotY;
    return g;
  }

  const pitchDial = createDial(0.0115, 0.016, 0.35);
  pitchDial.position.set(0.024, plateTopY, 0.005);
  ctrlGroup.add(pitchDial);

  const volDial = createDial(0.0145, 0.019, -0.55);
  volDial.position.set(-0.024, plateTopY, 0.044);
  ctrlGroup.add(volDial);

  const toneDial = createDial(0.0145, 0.019, 0.42);
  toneDial.position.set(0.024, plateTopY, 0.044);
  ctrlGroup.add(toneDial);

  // ============================================================================
  // 9. HINGED ACRYLIC DUST COVER (Propped gently open with brass hinges & stay)
  // ============================================================================
  const hingeY = deckTopY - 0.001; // 0.645
  const hingeZ = -plinthD * 0.5 + 0.006; // -0.173

  const hingeXs = [-0.165, 0.165];
  for (const hx of hingeXs) {
    const hBaseGeo = new THREE.BoxGeometry(0.032, 0.016, 0.012);
    const hBase = mark(new THREE.Mesh(hBaseGeo, brassMat), "secondary");
    hBase.position.set(hx, hingeY - 0.002, hingeZ - 0.004);
    turntableGroup.add(hBase);

    const pinGeo = new THREE.CylinderGeometry(0.0038, 0.0038, 0.036, 16);
    pinGeo.rotateZ(Math.PI * 0.5);
    const pin = mark(new THREE.Mesh(pinGeo, chromeMat), "secondary");
    pin.position.set(hx, hingeY + 0.004, hingeZ - 0.002);
    turntableGroup.add(pin);
  }

  const lidGroup = new THREE.Group();
  lidGroup.name = "lid";
  lidGroup.position.set(0, hingeY + 0.004, hingeZ);
  const lidOpenAngle = -0.44;
  lidGroup.rotation.x = lidOpenAngle;
  turntableGroup.add(lidGroup);

  const lidW = plinthW - 0.012; // 0.522
  const lidD = plinthD - 0.014; // 0.344
  const lidH = 0.082;
  const lidT = 0.0045;

  // Bent-acrylic wrap (back + top + front) extruded along X for seamless rounded corners
  const wrapShape = new THREE.Shape();
  const rLid = 0.014;
  // Local 2D plane: X = lid Z (0 at back hinge to +lidD at front), Y = lid height (0 to +lidH)
  wrapShape.moveTo(0, 0);
  wrapShape.lineTo(0, lidH - rLid);
  wrapShape.quadraticCurveTo(0, lidH, rLid, lidH);
  wrapShape.lineTo(lidD - rLid, lidH);
  wrapShape.quadraticCurveTo(lidD, lidH, lidD, lidH - rLid);
  wrapShape.lineTo(lidD, 0);
  wrapShape.lineTo(lidD - lidT, 0);
  wrapShape.lineTo(lidD - lidT, lidH - rLid);
  wrapShape.quadraticCurveTo(lidD - lidT, lidH - lidT, lidD - rLid, lidH - lidT);
  wrapShape.lineTo(rLid, lidH - lidT);
  wrapShape.quadraticCurveTo(lidT, lidH - lidT, lidT, lidH - rLid);
  wrapShape.lineTo(lidT, 0);
  wrapShape.closePath();

  const lidWrapGeo = new THREE.ExtrudeGeometry(wrapShape, {
    depth: lidW,
    bevelEnabled: true,
    bevelSize: 0.001,
    bevelThickness: 0.001,
    bevelSegments: 2,
    curveSegments: 12,
  });
  // Extrude went along +Z; rotate so shape X -> +Z (front) and extrusion depth -> X
  lidWrapGeo.translate(0, 0, -lidW * 0.5);
  lidWrapGeo.rotateY(-Math.PI * 0.5);
  const lidWrap = new THREE.Mesh(lidWrapGeo, acrylicMat);
  lidWrap.userData.slot = "secondary";
  lidGroup.add(lidWrap);

  // Two clear side cheeks of dust cover
  const cheekShape = new THREE.Shape();
  cheekShape.moveTo(lidT * 0.5, 0);
  cheekShape.lineTo(lidT * 0.5, lidH - rLid);
  cheekShape.quadraticCurveTo(lidT * 0.5, lidH - lidT * 0.5, rLid, lidH - lidT * 0.5);
  cheekShape.lineTo(lidD - rLid, lidH - lidT * 0.5);
  cheekShape.quadraticCurveTo(lidD - lidT * 0.5, lidH - lidT * 0.5, lidD - lidT * 0.5, lidH - rLid);
  cheekShape.lineTo(lidD - lidT * 0.5, 0);
  cheekShape.closePath();

  const cheekGeo = new THREE.ExtrudeGeometry(cheekShape, {
    depth: lidT,
    bevelEnabled: false,
    curveSegments: 12,
  });
  cheekGeo.translate(0, 0, -lidT * 0.5);
  cheekGeo.rotateY(-Math.PI * 0.5);

  const cheekL = new THREE.Mesh(cheekGeo, acrylicMat);
  cheekL.position.x = -lidW * 0.5 + lidT * 0.5;
  cheekL.userData.slot = "secondary";
  lidGroup.add(cheekL);

  const cheekR = new THREE.Mesh(cheekGeo, acrylicMat);
  cheekR.position.x = lidW * 0.5 - lidT * 0.5;
  cheekR.userData.slot = "secondary";
  lidGroup.add(cheekR);

  // Subtle brass grip tab at front-center of lid
  const tabShape = roundedRectShape(THREE, 0.048, 0.007, 0.0025);
  const tabGeo = new THREE.ExtrudeGeometry(tabShape, {
    depth: 0.006,
    bevelEnabled: true,
    bevelSize: 0.0008,
    bevelThickness: 0.0008,
    bevelSegments: 2,
  });
  const lidTab = mark(new THREE.Mesh(tabGeo, brassMat), "secondary");
  lidTab.position.set(0, 0.005, lidD - 0.001);
  lidGroup.add(lidTab);

  // Brass lid prop stay rod on the left side connecting deck to open lid
  const lidAttachLocal = new THREE.Vector3(-lidW * 0.5 + 0.009, 0.008, 0.118);
  const lidAttachWorld = lidAttachLocal.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), lidOpenAngle);
  lidAttachWorld.add(lidGroup.position);

  const stayCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-lidW * 0.5 + 0.009, deckSurfaceY - 0.001, -0.072),
    new THREE.Vector3(-lidW * 0.5 + 0.009, (deckSurfaceY + lidAttachWorld.y) * 0.5, (-0.072 + lidAttachWorld.z) * 0.5),
    lidAttachWorld,
  ]);
  turntableGroup.add(mark(new THREE.Mesh(createTaperedTube(THREE, stayCurve, 12, 8, 0.0018, true), brassMat), "secondary"));

  // ============================================================================
  // 10. COZY BRAIDED POWER CORD CURLING BEHIND CABINET ONTO FLOOR
  // ============================================================================
  const cordCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.14, 0.34, -0.175),
    new THREE.Vector3(0.15, 0.31, -0.215),
    new THREE.Vector3(0.18, 0.16, -0.228),
    new THREE.Vector3(0.17, 0.025, -0.205),
    new THREE.Vector3(0.12, 0.0045, -0.175),
    new THREE.Vector3(0.05, 0.0045, -0.195),
    new THREE.Vector3(0.01, 0.0045, -0.165),
  ]);
  const cordGeo = createTaperedTube(THREE, cordCurve, 48, 10, 0.0042, true);
  const cordMat = new THREE.MeshPhysicalMaterial({
    color: parseColor(THREE, shiftColorHex(THREE, cfg.wood, -0.26, -0.2), "#5a4636"),
    roughness: 0.9,
    sheen: 0.65,
    sheenColor: new THREE.Color("#d9c8b4"),
  });
  root.add(mark(new THREE.Mesh(cordGeo, cordMat), "primary"));

  return root;
}

export function idle(group, t) {
  if (!group) return;

  const platter = group.getObjectByName("platter");
  if (platter) {
    // Smooth 33⅓ RPM clockwise spin viewed from above
    platter.rotation.y = -t * 1.55;
  }

  const tonearm = group.getObjectByName("tonearm");
  if (tonearm) {
    // Gentle micro-tracking sway & subtle vinyl surface breath
    tonearm.rotation.y = Math.sin(t * 0.55) * 0.008;
    tonearm.rotation.z = Math.sin(t * 1.55) * 0.0032;
  }

  const glowLamp = group.getObjectByName("glowLamp");
  if (glowLamp && glowLamp.material) {
    glowLamp.material.emissiveIntensity = 1.45 + 0.22 * Math.sin(t * 2.2);
  }

  const vuGlow = group.getObjectByName("vuGlow");
  if (vuGlow && vuGlow.material) {
    const beat = Math.abs(Math.sin(t * 2.9) * Math.cos(t * 1.7));
    vuGlow.material.emissiveIntensity = 1.18 + beat * 0.36;
  }
}
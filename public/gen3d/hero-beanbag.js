export const META = {
  id: "bean_bag_chair",
  name: "Slumped Bean Bag Chair",
  kind: "furniture",
  footprint: [0.96, 1.06],
  variants: [
    { name: "Mint Butter", fabric: "#a8e0c0", accent: "#ffe08a" },
    { name: "Terracotta Cream", fabric: "#d9886a", accent: "#f5e6c8" },
    { name: "Lavender Peach", fabric: "#c3b2e3", accent: "#ffd0a6" },
    { name: "Denim Mustard", fabric: "#7fa0bd", accent: "#e8c468" }
  ],
  note: "Sculpted 6-panel teardrop dorm bean bag with corded piping, plush sit-dent, carry handle, and side stash pocket."
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function parseHex(hex) {
  const clean = String(hex || "#cccccc").replace("#", "");
  const full = clean.length === 3
    ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
    : clean.padEnd(6, "0").slice(0, 6);
  const n = parseInt(full, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255
  };
}

function rgbToHex(r, g, b) {
  const to2 = (c) => clamp(Math.round(c), 0, 255).toString(16).padStart(2, "0");
  return "#" + to2(r) + to2(g) + to2(b);
}

function mixRgb(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
  };
}

function shadeRgb(c, delta) {
  if (delta >= 0) {
    return mixRgb(c, { r: 255, g: 253, b: 248 }, delta);
  }
  return mixRgb(c, { r: 22, g: 20, b: 28 }, -delta);
}

function rgbaStr(c, a = 1) {
  return `rgba(${clamp(Math.round(c.r), 0, 255)},${clamp(Math.round(c.g), 0, 255)},${clamp(Math.round(c.b), 0, 255)},${a})`;
}

function createTaperedTube(THREE, points, radiusFn, tubularSegs, radialSegs, closed = false, aspect = [1, 1], sideHint = null) {
  const curve = new THREE.CatmullRomCurve3(points, closed, "catmullrom", 0.5);
  const frames = curve.computeFrenetFrames(tubularSegs, closed);

  const positions = [];
  const uvs = [];
  const indices = [];

  const ringCount = tubularSegs + 1;
  const stride = radialSegs + 1;

  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();

  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    const sampleU = closed && i === tubularSegs ? 0 : u;
    const p = curve.getPointAt(sampleU);
    const r = radiusFn(sampleU);

    if (sideHint) {
      curve.getTangentAt(sampleU, tangent).normalize();
      binormal.copy(sideHint);
      // Orthogonalize sideHint against tangent
      binormal.addScaledVector(tangent, -binormal.dot(tangent));
      if (binormal.lengthSq() < 1e-6) {
        binormal.copy(frames.binormals[i]);
      } else {
        binormal.normalize();
      }
      normal.crossVectors(binormal, tangent).normalize();
    } else {
      normal.copy(frames.normals[i]);
      binormal.copy(frames.binormals[i]);
    }

    for (let j = 0; j <= radialSegs; j++) {
      const v = j / radialSegs;
      const angle = v * Math.PI * 2;
      const ca = Math.cos(angle) * aspect[0];
      const sa = Math.sin(angle) * aspect[1];

      const vx = p.x + r * (ca * normal.x + sa * binormal.x);
      const vy = p.y + r * (ca * normal.y + sa * binormal.y);
      const vz = p.z + r * (ca * normal.z + sa * binormal.z);

      positions.push(vx, vy, vz);
      uvs.push(u * 8, v);
    }
  }

  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }

  // Cap open ends cleanly for watertight meshes
  if (!closed) {
    const startCenter = curve.getPointAt(0);
    const startIdx = positions.length / 3;
    positions.push(startCenter.x, startCenter.y, startCenter.z);
    uvs.push(0, 0.5);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(startIdx, j, j + 1);
    }

    const endCenter = curve.getPointAt(1);
    const endIdx = positions.length / 3;
    const baseRing = (ringCount - 1) * stride;
    positions.push(endCenter.x, endCenter.y, endCenter.z);
    uvs.push(1, 0.5);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(endIdx, baseRing + j + 1, baseRing + j);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function makeEvaluator(THREE, kit) {
  const snoise = (x, y) => (kit.noise(x, y) - 0.5) * 2;

  return function evalBeanBag(theta, phi) {
    const t = clamp(theta / Math.PI, 0, 1);
    const uRaw = phi / (Math.PI * 2);
    const u = ((uRaw % 1) + 1) % 1;

    const st = Math.sin(theta);
    const ct = Math.cos(theta);
    const cp = Math.cos(phi);
    const sp = Math.sin(phi);

    // Three.js SphereGeometry basis: u=0 -> -X, u=0.25 -> +Z (front), u=0.5 -> +X, u=0.75 -> -Z (back)
    const ux = -cp * st;
    const uz = sp * st;
    const h = 0.5 * (1 + ct); // 1 at top apex, 0 at bottom center

    // Broad teardrop radial silhouette with bead-pool weight near the floor
    const lowerSwell = smoothstep(0.05, 0.66, t);
    const floorSpread = smoothstep(0.58, 0.95, t);
    const gravityBulge = 0.044 * Math.exp(-Math.pow((t - 0.70) / 0.14, 2));
    const rProfile = 0.24 + 0.285 * lowerSwell + 0.14 * floorSpread + gravityBulge;

    // Gentle front elongation and side fullness
    const frontStretch = 1.0 + 0.115 * smoothstep(0.22, 0.84, t) * (0.45 + 0.55 * sp);
    const sideStretch = 1.0 + 0.045 * Math.sin(t * Math.PI);

    let x = ux * rProfile * sideStretch;
    let z = uz * rProfile * frontStretch;

    // Smooth height profile that rolls softly onto a flat floor pad (y = 0)
    const floorCut = 0.062;
    const yNorm = Math.max(0, (h - floorCut) / (1 - floorCut));
    let y = 0.75 * Math.pow(yNorm, 1.16);

    // Slumped teardrop backrest lean (-Z) and cozy lived-in sideways slouch
    const topWeight = Math.pow(h, 1.32);
    const tipDroop = Math.exp(-Math.pow(t / 0.19, 2));
    const xOffset = -0.042 * topWeight + 0.016 * Math.sin(t * Math.PI);
    const zOffset = -0.245 * topWeight + 0.036 * tipDroop;

    x += xOffset;
    z += zOffset;
    y -= 0.048 * tipDroop;

    // Soft organic bead-settling undulation (periodic in phi via cos/sin)
    const aboveFloor = smoothstep(0.055, 0.21, y);
    const beadWave = snoise(cp * 2.1 + 4.3, sp * 2.1 + t * 4.2) * 0.012 * aboveFloor * smoothstep(0.05, 0.22, t);
    const radLen = Math.hypot(x - xOffset * 0.5, z - zOffset * 0.5) || 1;
    x += ((x - xOffset * 0.5) / radLen) * beadWave;
    z += ((z - zOffset * 0.5) / radLen) * beadWave;

    // --- SOFT DENT WHERE SOMEONE SAT ---
    // Primary seat bowl slightly forward (+Z) and off-center for cozy asymmetry
    const dx = (x - 0.022) / 0.275;
    const dz = (z - 0.135) / 0.255;
    const seatBowl = Math.exp(-(dx * dx + dz * dz));

    // Lower-back hollow pressed into the backrest behind the sitter
    const bx = (x - 0.012) / 0.26;
    const bz = (z + 0.075) / 0.21;
    const by = (y - 0.42) / 0.22;
    const backHollow = Math.exp(-(bx * bx + bz * bz + by * by));

    // Gentle asymmetric thigh scoops rolling off the front lip
    const lx = (x + 0.135) / 0.145;
    const lz = (z - 0.325) / 0.195;
    const leftThigh = Math.exp(-(lx * lx + lz * lz));

    const rx = (x - 0.155) / 0.155;
    const rz = (z - 0.305) / 0.195;
    const rightThigh = Math.exp(-(rx * rx + rz * rz));

    // Apply seat & lumbar depressions
    y -= aboveFloor * (0.185 * seatBowl + 0.056 * leftThigh + 0.048 * rightThigh + 0.042 * backHollow);
    z -= aboveFloor * (0.095 * backHollow + 0.032 * seatBowl);

    // Volume conservation: displaced beads bulge into plump side bolsters & front roll
    const sideL = Math.exp(-(Math.pow((x + 0.40) / 0.175, 2) + Math.pow((z - 0.05) / 0.29, 2)));
    const sideR = Math.exp(-(Math.pow((x - 0.41) / 0.175, 2) + Math.pow((z - 0.03) / 0.29, 2)));
    const sideBolster = (sideL + sideR) * smoothstep(0.05, 0.20, y) * smoothstep(0.66, 0.32, y);
    x += (x >= 0 ? 1 : -1) * 0.044 * sideBolster;
    y += 0.034 * sideBolster;

    const frontRoll = Math.exp(-(Math.pow(x / 0.32, 2) + Math.pow((z - 0.46) / 0.14, 2))) * aboveFloor;
    z += 0.024 * frontRoll;
    y += 0.014 * frontRoll;

    // Soft gravity slump folds along the lower back and hinge creases
    const backCreaseBand = Math.exp(-Math.pow((y - 0.23) / 0.09, 2)) * (0.35 + 0.65 * Math.max(0, -sp));
    const foldRipple = Math.sin(y * 32.0 + sp * 2.2 + cp * 1.6) * 0.0075 * backCreaseBand;

    const hingeCrease = Math.exp(-(Math.pow(x / 0.34, 2) + Math.pow((z + 0.02) / 0.12, 2))) * aboveFloor;
    const hingeWrinkle = Math.sin((z * 42.0) + x * 6.0) * 0.0055 * hingeCrease * smoothstep(0.18, 0.38, y);

    // --- 6 VISIBLE SEAM PANELS (GORES) + TOP CAP & BOTTOM SKIRT SEAMS ---
    const panelPhase = (u * 6) % 1;
    const distSeam = Math.min(panelPhase, 1 - panelPhase); // 0 on seam, 0.5 mid-panel

    const vertSeamMask = smoothstep(0.088, 0.122, t) * smoothstep(0.825, 0.772, t);
    const vGroove = -0.0125 * Math.exp(-Math.pow(distSeam / 0.042, 2)) * vertSeamMask;
    const panelPuff = 0.0155 * Math.pow(Math.max(0, Math.sin(panelPhase * Math.PI)), 0.72) * vertSeamMask;

    // Subtle fabric gather puckers right alongside each seam line
    const puckerEnv = Math.exp(-Math.pow(distSeam / 0.075, 2)) * vertSeamMask;
    const pucker = snoise(cp * 4.5 + 1.2, t * 24.0 + sp * 4.5) * 0.0038 * puckerEnv;

    // Circular top cap seam at t = 0.105 and center button dimple at t = 0
    const topRingGroove = -0.0095 * Math.exp(-Math.pow((t - 0.105) / 0.015, 2));
    const topCapPuff = 0.0095 * smoothstep(0.105, 0.045, t) - 0.013 * Math.exp(-Math.pow(t / 0.032, 2));

    // Circular bottom skirt seam at t = 0.79
    const botRingGroove = -0.0085 * Math.exp(-Math.pow((t - 0.79) / 0.015, 2));

    // Approximate local outward normal from internal core spine
    const xCore = xOffset * 0.55;
    const yCore = 0.19 + 0.19 * h;
    const zCore = zOffset * 0.55;
    let nx = x - xCore;
    let ny = y - yCore;
    let nz = z - zCore;
    const nLen = Math.hypot(nx, ny, nz) || 1;
    nx /= nLen;
    ny /= nLen;
    nz /= nLen;

    const totalDisp = vGroove + panelPuff + pucker + topRingGroove + topCapPuff + botRingGroove + foldRipple + hingeWrinkle;
    x += nx * totalDisp;
    y += ny * totalDisp * smoothstep(0.012, 0.09, y);
    z += nz * totalDisp;

    // Ensure bottom pad rests cleanly on y = 0
    if (y < 0) y = 0;

    return {
      pos: new THREE.Vector3(x, y, z),
      normal: new THREE.Vector3(nx, ny, nz)
    };
  };
}

function makeFabricTextures(THREE, kit, fabricHex, accentHex) {
  const baseRgb = parseHex(fabricHex);
  const accRgb = parseHex(accentHex);
  const stitchRgb = mixRgb(shadeRgb(baseRgb, 0.38), shadeRgb(accRgb, 0.25), 0.45);
  const darkRgb = shadeRgb(baseRgb, -0.34);

  const colorMap = kit.canvasTexture(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = rgbToHex(baseRgb.r, baseRgb.g, baseRgb.b);
    ctx.fillRect(0, 0, w, h);

    // 1. Subtle panel-to-panel nap variation across the 6 sewn gores
    const panelShifts = [-0.030, 0.022, -0.016, 0.026, -0.022, 0.018];
    const panelW = w / 6;
    for (let k = 0; k < 6; k++) {
      const c = shadeRgb(baseRgb, panelShifts[k]);
      ctx.fillStyle = rgbaStr(c, 1);
      ctx.fillRect(k * panelW, 0, panelW + 1, h);
    }

    // 2. Cozy woven chenille / wide-wale corduroy grain & soft slub threads
    const waleCount = 192;
    const waleW = w / waleCount;
    for (let i = 0; i < waleCount; i++) {
      const x = i * waleW;
      const n = kit.noise(i * 0.37, 2.1);
      ctx.fillStyle = rgbaStr(shadeRgb(baseRgb, (n - 0.5) * 0.08), 0.38);
      ctx.fillRect(x, 0, waleW * 0.55, h);
      ctx.fillStyle = rgbaStr(darkRgb, 0.08 + (1 - n) * 0.04);
      ctx.fillRect(x + waleW * 0.55, 0, waleW * 0.45, h);
    }

    // Horizontal weft cross-threads and micro fabric flecks
    for (let y = 0; y < h; y += 3) {
      const n = kit.noise(5.4, y * 0.08);
      ctx.fillStyle = rgbaStr(shadeRgb(baseRgb, (n - 0.5) * 0.14), 0.14);
      ctx.fillRect(0, y, w, 1.4);
    }

    for (let i = 0; i < 4200; i++) {
      const rx = kit.noise(i * 0.73, 11.2) * w;
      const ry = kit.noise(23.7, i * 0.61) * h;
      const bright = kit.noise(i * 1.13, i * 0.47) > 0.48;
      ctx.fillStyle = bright
        ? rgbaStr(shadeRgb(baseRgb, 0.24), 0.16)
        : rgbaStr(darkRgb, 0.13);
      ctx.fillRect(rx, ry, 2.2, 1.5);
    }

    // 3. Soft cozy shading inside the sit-dent (centered around u = 0.25, t = 0.47)
    const dentGrad = ctx.createRadialGradient(w * 0.25, h * 0.47, w * 0.02, w * 0.25, h * 0.47, w * 0.16);
    dentGrad.addColorStop(0, rgbaStr(darkRgb, 0.22));
    dentGrad.addColorStop(0.55, rgbaStr(darkRgb, 0.10));
    dentGrad.addColorStop(1, rgbaStr(darkRgb, 0));
    ctx.fillStyle = dentGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle grounding shade along the floor base skirt
    const floorGrad = ctx.createLinearGradient(0, h * 0.72, 0, h);
    floorGrad.addColorStop(0, rgbaStr(darkRgb, 0));
    floorGrad.addColorStop(0.45, rgbaStr(darkRgb, 0.16));
    floorGrad.addColorStop(1, rgbaStr(darkRgb, 0.34));
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, h * 0.72, w, h * 0.28);

    // 4. Seam valley ambient occlusion + crisp twin-needle topstitching
    const topY = h * 0.105;
    const botY = h * 0.79;

    const drawSeamShadowV = (cx) => {
      const g = ctx.createLinearGradient(cx - 14, 0, cx + 14, 0);
      g.addColorStop(0, rgbaStr(darkRgb, 0));
      g.addColorStop(0.5, rgbaStr(darkRgb, 0.32));
      g.addColorStop(1, rgbaStr(darkRgb, 0));
      ctx.fillStyle = g;
      ctx.fillRect(cx - 14, topY, 28, botY - topY);
    };

    for (let k = 0; k <= 6; k++) {
      drawSeamShadowV(k * panelW);
    }

    const drawSeamShadowH = (cy) => {
      const g = ctx.createLinearGradient(0, cy - 11, 0, cy + 11);
      g.addColorStop(0, rgbaStr(darkRgb, 0));
      g.addColorStop(0.5, rgbaStr(darkRgb, 0.30));
      g.addColorStop(1, rgbaStr(darkRgb, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, cy - 11, w, 22);
    };
    drawSeamShadowH(topY);
    drawSeamShadowH(botY);

    // Twin-needle topstitching along both sides of all 6 vertical seams
    const drawDashedLine = (x1, y1, x2, y2) => {
      ctx.save();
      ctx.setLineDash([7, 5]);
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = rgbaStr(darkRgb, 0.38);
      ctx.beginPath();
      ctx.moveTo(x1 + 1, y1 + 1);
      ctx.lineTo(x2 + 1, y2 + 1);
      ctx.stroke();

      ctx.lineWidth = 1.6;
      ctx.strokeStyle = rgbaStr(stitchRgb, 0.85);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    };

    const stitchOff = 9;
    for (let k = 0; k < 6; k++) {
      const sx = k * panelW;
      drawDashedLine(sx + stitchOff, topY + 6, sx + stitchOff, botY - 6);
      const leftX = k === 0 ? w - stitchOff : sx - stitchOff;
      drawDashedLine(leftX, topY + 6, leftX, botY - 6);
    }

    // Top cap & bottom skirt circular topstitching
    drawDashedLine(0, topY - 7, w, topY - 7);
    drawDashedLine(0, topY + 7, w, topY + 7);
    drawDashedLine(0, botY - 7, w, botY - 7);
    drawDashedLine(0, botY + 7, w, botY + 7);
  });
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.ClampToEdgeWrapping;
  colorMap.anisotropy = 4;

  const bumpMap = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = "rgb(128,128,128)";
    ctx.fillRect(0, 0, w, h);

    // Fine corduroy wales
    const waleCount = 192;
    const waleW = w / waleCount;
    for (let i = 0; i < waleCount; i++) {
      const x = i * waleW;
      ctx.fillStyle = "rgb(156,156,156)";
      ctx.fillRect(x, 0, waleW * 0.55, h);
      ctx.fillStyle = "rgb(102,102,102)";
      ctx.fillRect(x + waleW * 0.55, 0, waleW * 0.45, h);
    }

    // Horizontal weave bump
    for (let y = 0; y < h; y += 2) {
      const v = 118 + Math.round(kit.noise(3.1, y * 0.14) * 24);
      ctx.fillStyle = `rgba(${v},${v},${v},0.45)`;
      ctx.fillRect(0, y, w, 1);
    }

    // Seam grooves & raised stitch bumps
    const panelW = w / 6;
    const topY = h * 0.105;
    const botY = h * 0.79;

    for (let k = 0; k <= 6; k++) {
      const cx = k * panelW;
      const g = ctx.createLinearGradient(cx - 7, 0, cx + 7, 0);
      g.addColorStop(0, "rgba(128,128,128,0)");
      g.addColorStop(0.5, "rgba(42,42,42,0.85)");
      g.addColorStop(1, "rgba(128,128,128,0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - 7, topY, 14, botY - topY);
    }

    const drawBumpStitch = (x1, y1, x2, y2) => {
      ctx.save();
      ctx.setLineDash([3.5, 2.5]);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = "rgb(232,232,232)";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    };

    const off = 4.5;
    for (let k = 0; k < 6; k++) {
      const sx = k * panelW;
      drawBumpStitch(sx + off, topY + 3, sx + off, botY - 3);
      drawBumpStitch(k === 0 ? w - off : sx - off, topY + 3, k === 0 ? w - off : sx - off, botY - 3);
    }
    drawBumpStitch(0, topY - 3.5, w, topY - 3.5);
    drawBumpStitch(0, topY + 3.5, w, topY + 3.5);
    drawBumpStitch(0, botY - 3.5, w, botY - 3.5);
    drawBumpStitch(0, botY + 3.5, w, botY + 3.5);
  });
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;

  return { colorMap, bumpMap };
}

function makeAccentTextures(THREE, kit, accentHex) {
  const baseRgb = parseHex(accentHex);
  const darkRgb = shadeRgb(baseRgb, -0.26);
  const lightRgb = shadeRgb(baseRgb, 0.24);

  const colorMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = rgbToHex(baseRgb.r, baseRgb.g, baseRgb.b);
    ctx.fillRect(0, 0, w, h);

    // Diagonal braided twill ribbing for corded piping & webbing handle
    ctx.lineWidth = 3;
    for (let i = -h; i < w + h; i += 8) {
      ctx.strokeStyle = rgbaStr(lightRgb, 0.35);
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h, h);
      ctx.stroke();

      ctx.strokeStyle = rgbaStr(darkRgb, 0.22);
      ctx.beginPath();
      ctx.moveTo(i + 4, 0);
      ctx.lineTo(i + 4 + h, h);
      ctx.stroke();
    }

    for (let i = 0; i < 650; i++) {
      const rx = kit.noise(i * 0.91, 4.1) * w;
      const ry = kit.noise(8.3, i * 0.67) * h;
      ctx.fillStyle = rgbaStr(i % 2 === 0 ? lightRgb : darkRgb, 0.14);
      ctx.fillRect(rx, ry, 2, 2);
    }
  });
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = THREE.RepeatWrapping;
  colorMap.wrapT = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "rgb(128,128,128)";
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 3.5;
    for (let i = -h; i < w + h; i += 8) {
      ctx.strokeStyle = "rgb(196,196,196)";
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h, h);
      ctx.stroke();

      ctx.strokeStyle = "rgb(78,78,78)";
      ctx.beginPath();
      ctx.moveTo(i + 4, 0);
      ctx.lineTo(i + 4 + h, h);
      ctx.stroke();
    }
  });
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  return { colorMap, bumpMap };
}

function makeTagTexture(THREE, kit, fabricHex, accentHex) {
  const fabRgb = parseHex(fabricHex);
  const accRgb = parseHex(accentHex);
  const cream = mixRgb(shadeRgb(accRgb, 0.52), { r: 252, g: 248, b: 238 }, 0.55);
  const ink = shadeRgb(fabRgb, -0.45);

  const tex = kit.canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = rgbToHex(cream.r, cream.g, cream.b);
    ctx.fillRect(0, 0, w, h);

    // Fine woven cloth lines
    for (let y = 0; y < h; y += 3) {
      ctx.fillStyle = rgbaStr(shadeRgb(cream, -0.08), 0.35);
      ctx.fillRect(0, y, w, 1);
    }

    // Accent border stripe
    ctx.fillStyle = rgbToHex(accRgb.r, accRgb.g, accRgb.b);
    ctx.fillRect(0, 8, w, 10);
    ctx.fillRect(0, h - 18, w, 10);

    // Cute miniature leaf/bean emblem in the center
    ctx.fillStyle = rgbToHex(ink.r, ink.g, ink.b);
    ctx.beginPath();
    ctx.ellipse(w * 0.55, h * 0.5, 22, 14, -0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = rgbToHex(cream.r, cream.g, cream.b);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.44, h * 0.54);
    ctx.quadraticCurveTo(w * 0.55, h * 0.48, w * 0.66, h * 0.44);
    ctx.stroke();

    // Decorative stitch dashes along outer edge
    ctx.strokeStyle = rgbaStr(ink, 0.65);
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(10, 24, w - 20, h - 48);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildSculptedBodyGeometry(THREE, evalBeanBag) {
  const segU = 96;
  const segV = 64;
  const geo = new THREE.SphereGeometry(1, segU, segV);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    const theta = (1 - v) * Math.PI;
    const phi = u * Math.PI * 2;
    const res = evalBeanBag(theta, phi);
    pos.setXYZ(i, res.pos.x, res.pos.y, res.pos.z);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();

  // Stitch normals seamlessly across the u = 0 / u = 1 wrap seam and smooth poles
  const norm = geo.attributes.normal;
  const rowStride = segU + 1;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();

  for (let iy = 1; iy < segV; iy++) {
    const i0 = iy * rowStride;
    const i1 = iy * rowStride + segU;
    a.fromBufferAttribute(norm, i0);
    b.fromBufferAttribute(norm, i1);
    a.add(b).normalize();
    norm.setXYZ(i0, a.x, a.y, a.z);
    norm.setXYZ(i1, a.x, a.y, a.z);
  }

  // Average top & bottom pole normals so caps shade with zero pinching
  for (const row of [0, segV]) {
    a.set(0, 0, 0);
    for (let ix = 0; ix <= segU; ix++) {
      b.fromBufferAttribute(norm, row * rowStride + ix);
      a.add(b);
    }
    a.normalize();
    for (let ix = 0; ix <= segU; ix++) {
      norm.setXYZ(row * rowStride + ix, a.x, a.y, a.z);
    }
  }
  norm.needsUpdate = true;
  return geo;
}

function buildSidePocket(THREE, evalBeanBag, fabricMat, accentMat) {
  const group = new THREE.Group();
  group.name = "pocket";

  // Rounded cozy pouch shape drawn with bezierCurveTo in normalized [-1, 1] space
  const shape = new THREE.Shape();
  shape.moveTo(-0.98, 0.88);
  // Slight gentle dip across the pocket opening lip
  shape.bezierCurveTo(-0.40, 0.74, 0.40, 0.74, 0.98, 0.88);
  // Right edge curving softly into a rounded bottom corner
  shape.bezierCurveTo(1.03, 0.15, 0.98, -0.78, 0.56, -0.96);
  // Rounded bottom edge
  shape.bezierCurveTo(0.20, -1.04, -0.20, -1.04, -0.56, -0.96);
  // Left edge returning to top-left corner
  shape.bezierCurveTo(-0.98, -0.78, -1.03, 0.15, -0.98, 0.88);

  const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.006,
    bevelSegments: 3,
    curveSegments: 24
  });

  // Bend extruded pocket directly onto the front-right sculpted panel (panel 2: u in [2/6, 3/6])
  const uCenter = 0.418;
  const uHalf = 0.036;
  const tCenter = 0.625;
  const tHalf = 0.072;

  const pos = extrudeGeo.attributes.position;
  const uv = extrudeGeo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);

    const u = uCenter + vx * uHalf;
    const t = tCenter - vy * tHalf;
    const surf = evalBeanBag(t * Math.PI, u * Math.PI * 2);

    // Pouch belly puffs softly outward toward the open top while stitched sides hug the chair
    const archX = Math.cos(clamp(vx, -1, 1) * Math.PI * 0.5);
    const openTop = smoothstep(-0.95, 0.65, vy);
    const belly = 0.015 * archX * openTop + 0.009;
    const offset = vz + belly - 0.009;

    const px = surf.pos.x + surf.normal.x * offset;
    const py = Math.max(0.01, surf.pos.y + surf.normal.y * offset);
    const pz = surf.pos.z + surf.normal.z * offset;

    pos.setXYZ(i, px, py, pz);
    // Remap UVs to clean fabric tile space so weave scales naturally
    uv.setXY(i, 0.35 + vx * 0.06, 0.55 + vy * 0.09);
  }
  pos.needsUpdate = true;
  uv.needsUpdate = true;
  extrudeGeo.computeVertexNormals();

  const pocketMesh = new THREE.Mesh(extrudeGeo, fabricMat);
  pocketMesh.userData.slot = "primary";
  pocketMesh.castShadow = true;
  pocketMesh.receiveShadow = true;
  group.add(pocketMesh);

  // Matching accent piped trim along the pocket's curved top opening lip
  const lipPts = [];
  const lipSamples = 18;
  for (let i = 0; i <= lipSamples; i++) {
    const s = i / lipSamples;
    const vx = -0.97 + s * 1.94;
    // Matches top bezier dip
    const vy = 0.88 - 0.105 * Math.sin(s * Math.PI);
    const u = uCenter + vx * uHalf;
    const t = tCenter - vy * tHalf;
    const surf = evalBeanBag(t * Math.PI, u * Math.PI * 2);

    const archX = Math.cos(clamp(vx, -1, 1) * Math.PI * 0.5);
    const offset = 0.016 + 0.015 * archX;
    lipPts.push(surf.pos.clone().addScaledVector(surf.normal, offset));
  }
  const lipGeo = createTaperedTube(
    THREE,
    lipPts,
    (s) => 0.0068 * (0.72 + 0.28 * Math.sin(s * Math.PI)),
    24,
    8,
    false
  );
  const lipMesh = new THREE.Mesh(lipGeo, accentMat);
  lipMesh.userData.slot = "accent";
  lipMesh.castShadow = true;
  lipMesh.receiveShadow = true;
  group.add(lipMesh);

  return group;
}

function buildCrownButton(THREE, evalBeanBag, accentMat) {
  // LatheGeometry (20 points) for a softly domed fabric-covered crown button
  const profile = [];
  const pts = 20;
  for (let i = 0; i <= pts; i++) {
    const s = i / pts;
    let r, y;
    if (s < 0.72) {
      // Smooth upholstered dome top
      const a = (s / 0.72) * Math.PI * 0.5;
      r = 0.030 * Math.sin(a);
      y = 0.0155 * Math.cos(a) + 0.004;
    } else {
      // Tucked underside rim
      const b = (s - 0.72) / 0.28;
      r = 0.030 * (1 - 0.65 * b * b);
      y = 0.004 - 0.009 * Math.sin(b * Math.PI * 0.5);
    }
    profile.push(new THREE.Vector2(Math.max(0.0005, r), y));
  }
  const latheGeo = new THREE.LatheGeometry(profile, 32);
  const mesh = new THREE.Mesh(latheGeo, accentMat);
  mesh.userData.slot = "accent";
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Compute true local surface normal at the slumped apex (theta = 0)
  const apex = evalBeanBag(0.001, 0);
  const p0 = evalBeanBag(0.03 * Math.PI, 0).pos;
  const p1 = evalBeanBag(0.03 * Math.PI, Math.PI * 0.5).pos;
  const p2 = evalBeanBag(0.03 * Math.PI, Math.PI).pos;
  const p3 = evalBeanBag(0.03 * Math.PI, Math.PI * 1.5).pos;
  const tX = p2.clone().sub(p0);
  const tZ = p1.clone().sub(p3);
  const surfNorm = new THREE.Vector3().crossVectors(tZ, tX).normalize();
  if (surfNorm.y < 0) surfNorm.negate();

  mesh.position.copy(apex.pos).addScaledVector(surfNorm, -0.002);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), surfNorm);
  return mesh;
}

function buildCarryHandle(THREE, evalBeanBag, accentMat) {
  // Anchored on the top-back shoulder (u = 0.75, -Z) so you can drag the bean bag around the dorm
  const uBack = 0.75;
  const pTop = evalBeanBag(0.088 * Math.PI, uBack * Math.PI * 2);
  const pMid1 = evalBeanBag(0.125 * Math.PI, uBack * Math.PI * 2);
  const pMid2 = evalBeanBag(0.168 * Math.PI, uBack * Math.PI * 2);
  const pBot = evalBeanBag(0.215 * Math.PI, uBack * Math.PI * 2);

  // Pivot right at top seam attachment so gentle idle sway stays anchored
  const anchor = pTop.pos.clone();
  const rawPts = [
    pTop.pos.clone().addScaledVector(pTop.normal, -0.012),
    pTop.pos.clone().addScaledVector(pTop.normal, 0.014),
    pMid1.pos.clone().addScaledVector(pMid1.normal, 0.044).add(new THREE.Vector3(0, 0.008, -0.008)),
    pMid2.pos.clone().addScaledVector(pMid2.normal, 0.040).add(new THREE.Vector3(0, -0.012, -0.006)),
    pBot.pos.clone().addScaledVector(pBot.normal, 0.010),
    pBot.pos.clone().addScaledVector(pBot.normal, -0.014)
  ].map((p) => p.sub(anchor));

  // Flat plush stitched webbing strap using elliptical cross-section with X side hint
  const handleGeo = createTaperedTube(
    THREE,
    rawPts,
    (s) => 0.0175 * (0.86 + 0.18 * Math.sin(s * Math.PI)),
    32,
    14,
    false,
    [0.36, 1.0],
    new THREE.Vector3(1, 0, 0)
  );

  const handleGroup = new THREE.Group();
  handleGroup.name = "handle";
  handleGroup.position.copy(anchor);

  const handleMesh = new THREE.Mesh(handleGeo, accentMat);
  handleMesh.userData.slot = "accent";
  handleMesh.castShadow = true;
  handleMesh.receiveShadow = true;
  handleGroup.add(handleMesh);

  return handleGroup;
}

function buildSeamTag(THREE, evalBeanBag, kit, fabricHex, accentHex) {
  // Tucked cleanly into the front-right vertical seam (u = 2/6)
  const uSeam = 2 / 6;
  const tTag = 0.61;
  const pHere = evalBeanBag(tTag * Math.PI, uSeam * Math.PI * 2);
  const pAbove = evalBeanBag((tTag - 0.025) * Math.PI, uSeam * Math.PI * 2);
  const pBelow = evalBeanBag((tTag + 0.025) * Math.PI, uSeam * Math.PI * 2);

  const seamDown = pBelow.pos.clone().sub(pAbove.pos).normalize();
  const outDir = pHere.normal.clone().normalize();
  const across = new THREE.Vector3().crossVectors(outDir, seamDown).normalize();
  // Re-orthogonalize outward normal
  const trueOut = new THREE.Vector3().crossVectors(seamDown, across).normalize();

  const tagGroup = new THREE.Group();
  tagGroup.name = "tag";
  tagGroup.position.copy(pHere.pos);

  // Orient local X = outward from seam, Y = along seam, Z = across seam
  const basis = new THREE.Matrix4().makeBasis(trueOut, seamDown, across);
  tagGroup.quaternion.setFromRotationMatrix(basis);

  // Rounded folded fabric label using bezierCurveTo
  const s = new THREE.Shape();
  s.moveTo(-0.008, -0.018);
  s.lineTo(0.026, -0.018);
  s.bezierCurveTo(0.034, -0.018, 0.036, -0.012, 0.036, 0.0);
  s.bezierCurveTo(0.036, 0.012, 0.034, 0.018, 0.026, 0.018);
  s.lineTo(-0.008, 0.018);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.0024,
    bevelEnabled: true,
    bevelThickness: 0.0008,
    bevelSize: 0.0008,
    bevelSegments: 2,
    curveSegments: 10
  });
  geo.translate(0, 0, -0.0012);

  // Gently bend the cloth tag outward and slightly drooping along the seam
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const lz = pos.getZ(i);
    const outFrac = clamp((lx + 0.008) / 0.044, 0, 1);
    const curlZ = 0.008 * outFrac * outFrac;
    const droopY = 0.005 * outFrac * outFrac;
    pos.setXYZ(i, lx, ly + droopY, lz + curlZ);
    uv.setXY(i, clamp((lx + 0.008) / 0.044, 0, 1), clamp((ly + 0.018) / 0.036, 0, 1));
  }
  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();

  const tagTex = makeTagTexture(THREE, kit, fabricHex, accentHex);
  const tagMat = new THREE.MeshPhysicalMaterial({
    map: tagTex,
    roughness: 0.9,
    metalness: 0,
    sheen: 0.65,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color("#fffcf5")
  });

  const mesh = new THREE.Mesh(geo, tagMat);
  mesh.userData.slot = "accent";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  tagGroup.add(mesh);

  return tagGroup;
}

function buildZipperDetail(THREE, evalBeanBag, accentHex, accentMat) {
  // Subtle concealed zipper welt + rounded pull tab tucked along lower back-left seam (u = 5/6)
  const group = new THREE.Group();
  group.name = "zipper";

  const uZip = 5 / 6;
  const weltPts = [];
  for (let i = 0; i <= 10; i++) {
    const t = 0.68 + (i / 10) * 0.085;
    const s = evalBeanBag(t * Math.PI, uZip * Math.PI * 2);
    weltPts.push(s.pos.clone().addScaledVector(s.normal, 0.005));
  }
  const weltGeo = createTaperedTube(
    THREE,
    weltPts,
    (s) => 0.0055 * (0.45 + 0.55 * Math.sin(s * Math.PI)),
    14,
    8,
    false
  );
  const weltMesh = new THREE.Mesh(weltGeo, accentMat);
  weltMesh.userData.slot = "accent";
  weltMesh.castShadow = true;
  weltMesh.receiveShadow = true;
  group.add(weltMesh);

  // Miniature teardrop zipper pull tab hanging smoothly from the seam
  const anchor = evalBeanBag(0.722 * Math.PI, uZip * Math.PI * 2);
  const pullShape = new THREE.Shape();
  pullShape.moveTo(0, 0.004);
  pullShape.bezierCurveTo(0.006, 0.004, 0.009, -0.008, 0.008, -0.018);
  pullShape.bezierCurveTo(0.007, -0.026, -0.007, -0.026, -0.008, -0.018);
  pullShape.bezierCurveTo(-0.009, -0.008, -0.006, 0.004, 0, 0.004);

  const pullGeo = new THREE.ExtrudeGeometry(pullShape, {
    depth: 0.0026,
    bevelEnabled: true,
    bevelThickness: 0.001,
    bevelSize: 0.001,
    bevelSegments: 2,
    curveSegments: 10
  });
  pullGeo.translate(0, 0, -0.0013);

  // Subtle outward bend along the pull tab
  const pAttr = pullGeo.attributes.position;
  for (let i = 0; i < pAttr.count; i++) {
    const py = pAttr.getY(i);
    const pz = pAttr.getZ(i);
    const frac = clamp(-py / 0.026, 0, 1);
    pAttr.setZ(i, pz + 0.003 * frac * frac);
  }
  pAttr.needsUpdate = true;
  pullGeo.computeVertexNormals();

  const accRgb = parseHex(accentHex);
  const brass = mixRgb(accRgb, { r: 215, g: 185, b: 120 }, 0.55);
  const pullMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(rgbToHex(brass.r, brass.g, brass.b)),
    roughness: 0.28,
    metalness: 0.55,
    clearcoat: 0.55,
    clearcoatRoughness: 0.2
  });

  const pullMesh = new THREE.Mesh(pullGeo, pullMat);
  pullMesh.userData.slot = "accent";
  pullMesh.position.copy(anchor.pos).addScaledVector(anchor.normal, 0.009);
  pullMesh.rotation.y = Math.atan2(anchor.normal.x, anchor.normal.z);
  pullMesh.rotation.x = 0.22;
  pullMesh.castShadow = true;
  group.add(pullMesh);

  return group;
}

export function build(THREE, opts, kit) {
  const fabricHex = (opts && opts.fabric) || "#a8e0c0";
  const accentHex = (opts && opts.accent) || "#ffe08a";

  const root = new THREE.Group();
  root.name = "bean_bag_chair";

  const bodyGroup = new THREE.Group();
  bodyGroup.name = "body";
  root.add(bodyGroup);

  const fabRgb = parseHex(fabricHex);
  const accRgb = parseHex(accentHex);
  const fabSheen = shadeRgb(fabRgb, 0.42);
  const accSheen = shadeRgb(accRgb, 0.36);

  const { colorMap: fabMap, bumpMap: fabBump } = makeFabricTextures(THREE, kit, fabricHex, accentHex);
  const { colorMap: accMap, bumpMap: accBump } = makeAccentTextures(THREE, kit, accentHex);

  const fabricMat = new THREE.MeshPhysicalMaterial({
    map: fabMap,
    bumpMap: fabBump,
    bumpScale: 0.011,
    roughness: 0.91,
    metalness: 0.0,
    sheen: 0.82,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color(rgbToHex(fabSheen.r, fabSheen.g, fabSheen.b))
  });

  const accentMat = new THREE.MeshPhysicalMaterial({
    map: accMap,
    bumpMap: accBump,
    bumpScale: 0.008,
    roughness: 0.88,
    metalness: 0.0,
    sheen: 0.74,
    sheenRoughness: 0.75,
    sheenColor: new THREE.Color(rgbToHex(accSheen.r, accSheen.g, accSheen.b))
  });

  const evalBeanBag = makeEvaluator(THREE, kit);

  // 1. Main continuous sculpted 6-panel slumped bean bag body
  const bodyGeo = buildSculptedBodyGeometry(THREE, evalBeanBag);
  const bodyMesh = new THREE.Mesh(bodyGeo, fabricMat);
  bodyMesh.userData.slot = "primary";
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyGroup.add(bodyMesh);

  // 2. 6 vertical meridian corded piping seams nested snugly inside the sculpted valleys
  const tTopRing = 0.105;
  const tBotRing = 0.79;
  const vertSamples = 42;

  for (let k = 0; k < 6; k++) {
    const phi = (k / 6) * Math.PI * 2;
    const pts = [];
    for (let i = 0; i <= vertSamples; i++) {
      const s = i / vertSamples;
      const t = tTopRing + s * (tBotRing - tTopRing);
      const surf = evalBeanBag(t * Math.PI, phi);
      pts.push(surf.pos.clone().addScaledVector(surf.normal, 0.0042));
    }
    const pipingGeo = createTaperedTube(
      THREE,
      pts,
      (s) => 0.0076 * (0.86 + 0.18 * Math.sin(s * Math.PI)),
      48,
      10,
      false
    );
    const pipingMesh = new THREE.Mesh(pipingGeo, accentMat);
    pipingMesh.userData.slot = "accent";
    pipingMesh.castShadow = true;
    pipingMesh.receiveShadow = true;
    bodyGroup.add(pipingMesh);
  }

  // 3. Top circular crown cap piping ring where the 6 gore panels converge
  const topRingPts = [];
  const topRingSamples = 36;
  for (let i = 0; i < topRingSamples; i++) {
    const phi = (i / topRingSamples) * Math.PI * 2;
    const surf = evalBeanBag(tTopRing * Math.PI, phi);
    topRingPts.push(surf.pos.clone().addScaledVector(surf.normal, 0.0044));
  }
  const topRingGeo = createTaperedTube(
    THREE,
    topRingPts,
    () => 0.0074,
    48,
    10,
    true
  );
  const topRingMesh = new THREE.Mesh(topRingGeo, accentMat);
  topRingMesh.userData.slot = "accent";
  topRingMesh.castShadow = true;
  topRingMesh.receiveShadow = true;
  bodyGroup.add(topRingMesh);

  // 4. Bottom circular floor-skirt piping ring
  const botRingPts = [];
  const botRingSamples = 54;
  for (let i = 0; i < botRingSamples; i++) {
    const phi = (i / botRingSamples) * Math.PI * 2;
    const surf = evalBeanBag(tBotRing * Math.PI, phi);
    const p = surf.pos.clone().addScaledVector(surf.normal, 0.0042);
    p.y = Math.max(0.008, p.y);
    botRingPts.push(p);
  }
  const botRingGeo = createTaperedTube(
    THREE,
    botRingPts,
    () => 0.0078,
    72,
    10,
    true
  );
  const botRingMesh = new THREE.Mesh(botRingGeo, accentMat);
  botRingMesh.userData.slot = "accent";
  botRingMesh.castShadow = true;
  botRingMesh.receiveShadow = true;
  bodyGroup.add(botRingMesh);

  // 5. Fabric-covered crown button (LatheGeometry) nestled in the slumped top dimple
  bodyGroup.add(buildCrownButton(THREE, evalBeanBag, accentMat));

  // 6. Slumped dorm carry-handle loop along the top-back shoulder
  bodyGroup.add(buildCarryHandle(THREE, evalBeanBag, accentMat));

  // 7. Curved dorm side stash pocket on the front-right panel
  bodyGroup.add(buildSidePocket(THREE, evalBeanBag, fabricMat, accentMat));

  // 8. Folded woven cloth seam label tucked into the front-right seam
  bodyGroup.add(buildSeamTag(THREE, evalBeanBag, kit, fabricHex, accentHex));

  // 9. Concealed lower back-left zipper welt & miniature pull tab
  bodyGroup.add(buildZipperDetail(THREE, evalBeanBag, accentHex, accentMat));

  // Guarantee exact floor contact at y = 0
  const box = new THREE.Box3().setFromObject(bodyGroup);
  if (isFinite(box.min.y) && Math.abs(box.min.y) > 1e-4) {
    bodyGroup.position.y -= box.min.y;
  }

  return root;
}

export function idle(group, t) {
  const body = group.getObjectByName("body");
  if (body) {
    // Gentle cozy loft settling / breathing motion anchored on the floor (y = 0)
    const settle = Math.sin(t * 0.85) * 0.0055;
    body.scale.set(1 - settle * 0.45, 1 + settle, 1 - settle * 0.45);
  }

  const handle = group.getObjectByName("handle");
  if (handle) {
    handle.rotation.x = Math.sin(t * 1.15 + 0.4) * 0.028;
    handle.rotation.z = Math.sin(t * 0.72) * 0.012;
  }

  const tag = group.getObjectByName("tag");
  if (tag) {
    if (tag.userData.baseQuat === undefined) {
      tag.userData.baseQuat = tag.quaternion.clone();
    }
    const flutter = Math.sin(t * 1.65) * 0.045 + Math.sin(t * 2.9) * 0.015;
    tag.quaternion.copy(tag.userData.baseQuat);
    tag.rotateY(flutter);
  }
}
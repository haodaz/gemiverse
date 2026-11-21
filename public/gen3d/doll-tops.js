// TOPS module for the stylised ball-jointed doll
// Export: wearTop(THREE, rig, opts, kit)

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function safeNorm(v, fx = 0, fy = 1, fz = 0) {
  const l = v.length();
  if (l > 1e-8) return v.divideScalar(l);
  return v.set(fx, fy, fz);
}

function addMesh(pivot, geo, mat, slot, out) {
  if (!pivot) return null;
  const mesh = new pivot.constructor === undefined ? null : null; // unused
  return mesh;
}

function createAndAttach(THREE, pivot, geo, mat, slot, out, pos, rot) {
  if (!pivot) return null;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.slot = slot;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
  if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
  pivot.add(mesh);
  out.push(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------
// Procedural Fabric Textures & Physical Materials
// ---------------------------------------------------------------------------

function makeFabricMat(THREE, kit, kind, hexColor, opts = {}) {
  const col = new THREE.Color(hexColor || "#c85a6a");
  const acc = new THREE.Color(opts.accent || "#f2e9df");
  const repX = opts.repX ?? 3;
  const repY = opts.repY ?? 3;
  const bumpScale = opts.bumpScale ?? 0.0022;
  const w = 256;
  const h = 256;

  // High-key diffuse map so material.color cleanly tints & supports re-theming
  const map = kit.canvasTexture(w, h, (ctx, cw, ch) => {
    const img = ctx.createImageData(cw, ch);
    const d = img.data;
    const isCable = kind === "cable";
    const isStripeAcc = isCable && opts.accentStripe;
    const accR = acc.r * 255;
    const accG = acc.g * 255;
    const accB = acc.b * 255;

    for (let y = 0; y < ch; y++) {
      const ny = y / ch;
      for (let x = 0; x < cw; x++) {
        const nx = x / cw;
        const n1 = kit.noise(nx * 24, ny * 24);
        const n2 = kit.noise(nx * 64 + 7.1, ny * 64 + 3.4);
        let lum = 0.94;
        let mixAcc = 0;

        if (kind === "fleece") {
          const wale = Math.sin(nx * Math.PI * 64) * 0.018;
          lum = 0.91 + (n1 - 0.5) * 0.07 + (n2 - 0.5) * 0.05 + wale;
        } else if (kind === "jersey") {
          const rib = Math.sin(nx * Math.PI * 96) * 0.016;
          const row = Math.sin(ny * Math.PI * 112) * 0.01;
          lum = 0.93 + (n1 - 0.5) * 0.05 + (n2 - 0.5) * 0.03 + rib + row;
        } else if (kind === "weave") {
          const warp = Math.sin(nx * Math.PI * 96);
          const weft = Math.sin(ny * Math.PI * 96);
          const basket = ((x >> 1) + (y >> 1)) & 1 ? 0.022 : -0.022;
          lum = 0.94 + basket + (warp + weft) * 0.012 + (n1 - 0.5) * 0.03;
        } else if (kind === "twill") {
          const diag = Math.sin((nx * 64 + ny * 64) * Math.PI * 2) * 0.032;
          const fine = Math.sin((nx * 128 - ny * 64) * Math.PI * 2) * 0.01;
          lum = 0.92 + diag + fine + (n1 - 0.5) * 0.045;
        } else if (kind === "rib") {
          const colWave = Math.cos(nx * Math.PI * 32);
          const vStitch = Math.cos((ny * 64 + Math.abs(colWave) * 0.4) * Math.PI * 2) * 0.028;
          lum = 0.87 + colWave * 0.095 + vStitch + (n2 - 0.5) * 0.03;
        } else if (kind === "knit") {
          const gx = (nx * 32) % 1;
          const gy = (ny * 40) % 1;
          const vLoop = Math.cos((gy + Math.abs(gx - 0.5) * 1.1) * Math.PI * 2);
          const colGroove = Math.cos(nx * Math.PI * 64);
          lum = 0.89 + vLoop * 0.045 + colGroove * 0.04 + (n2 - 0.5) * 0.04;
        } else if (kind === "cable") {
          // Alternating braided cable columns & purl/rib channels + horizontal sweater stripes
          const tileX = (nx * 4) % 1;
          const phase = ny * Math.PI * 16;
          const yarn = Math.sin((ny * 80 + nx * 12) * Math.PI * 2) * 0.02;
          let relief = 0;
          if (tileX > 0.16 && tileX < 0.84) {
            const cx = (tileX - 0.5) / 0.34; // [-1, 1]
            const s1 = Math.sin(phase) * 0.45;
            const s2 = -s1;
            const d1 = Math.abs(cx - s1);
            const d2 = Math.abs(cx - s2);
            const strand1 = Math.max(0, 1 - d1 * 2.5);
            const strand2 = Math.max(0, 1 - d2 * 2.5);
            const over = Math.cos(phase) > 0;
            const h1 = strand1 * (over ? 1.0 : 0.72);
            const h2 = strand2 * (over ? 0.72 : 1.0);
            relief = Math.max(h1, h2) * 0.16 - 0.06;
          } else {
            relief = Math.cos(nx * Math.PI * 64) * 0.045 - 0.04;
          }
          // Subtle horizontal knit stripe bands
          const stripeBand = Math.abs(((ny * 3) % 1) - 0.5);
          if (stripeBand < 0.075) {
            lum = 0.88 + relief + yarn;
            if (isStripeAcc) mixAcc = 0.38;
          } else if (stripeBand < 0.11) {
            lum = 0.82 + relief + yarn;
          } else {
            lum = 0.90 + relief + yarn + (n1 - 0.5) * 0.04;
          }
        }

        lum = clamp(lum, 0.55, 1.0);
        const idx = (y * cw + x) * 4;
        const baseVal = lum * 255;
        if (mixAcc > 0) {
          // Mild neutralised blend so base tint stays vibrant
          d[idx] = clamp(lerp(baseVal, accR * lum * 1.05, mixAcc), 0, 255);
          d[idx + 1] = clamp(lerp(baseVal, accG * lum * 1.05, mixAcc), 0, 255);
          d[idx + 2] = clamp(lerp(baseVal, accB * lum * 1.05, mixAcc), 0, 255);
        } else {
          d[idx] = baseVal;
          d[idx + 1] = baseVal;
          d[idx + 2] = baseVal;
        }
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Subtle topstitching hint on woven/fleece fabrics
    if (kind === "weave" || kind === "twill") {
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(8, ch);
      ctx.stroke();
    }
  });

  const bumpMap = kit.canvasTexture(w, h, (ctx, cw, ch) => {
    const img = ctx.createImageData(cw, ch);
    const d = img.data;
    for (let y = 0; y < ch; y++) {
      const ny = y / ch;
      for (let x = 0; x < cw; x++) {
        const nx = x / cw;
        const n = kit.noise(nx * 48 + 1.7, ny * 48 + 5.2);
        let hVal = 0.5;
        if (kind === "fleece") {
          hVal = 0.5 + (n - 0.5) * 0.35 + Math.sin(nx * Math.PI * 64) * 0.1;
        } else if (kind === "jersey") {
          hVal = 0.5 + Math.sin(nx * Math.PI * 96) * 0.14 + (n - 0.5) * 0.2;
        } else if (kind === "weave") {
          const check = ((x >> 1) + (y >> 1)) & 1 ? 0.16 : -0.16;
          hVal = 0.5 + check + (n - 0.5) * 0.12;
        } else if (kind === "twill") {
          hVal = 0.5 + Math.sin((nx * 64 + ny * 64) * Math.PI * 2) * 0.24 + (n - 0.5) * 0.14;
        } else if (kind === "rib") {
          const colWave = Math.cos(nx * Math.PI * 32);
          const st = Math.cos((ny * 64 + Math.abs(colWave) * 0.4) * Math.PI * 2) * 0.14;
          hVal = 0.5 + colWave * 0.36 + st;
        } else if (kind === "knit") {
          const gx = (nx * 32) % 1;
          const gy = (ny * 40) % 1;
          hVal = 0.5 + Math.cos((gy + Math.abs(gx - 0.5) * 1.1) * Math.PI * 2) * 0.25 +
            Math.cos(nx * Math.PI * 64) * 0.18;
        } else if (kind === "cable") {
          const tileX = (nx * 4) % 1;
          const phase = ny * Math.PI * 16;
          if (tileX > 0.16 && tileX < 0.84) {
            const cx = (tileX - 0.5) / 0.34;
            const s1 = Math.sin(phase) * 0.45;
            const strand1 = Math.max(0, 1 - Math.abs(cx - s1) * 2.4);
            const strand2 = Math.max(0, 1 - Math.abs(cx + s1) * 2.4);
            const over = Math.cos(phase) > 0;
            hVal = 0.24 + Math.max(strand1 * (over ? 1 : 0.7), strand2 * (over ? 0.7 : 1)) * 0.72;
          } else {
            hVal = 0.35 + Math.cos(nx * Math.PI * 64) * 0.18;
          }
          hVal += (n - 0.5) * 0.1;
        }
        const v = clamp(hVal * 255, 0, 255);
        const idx = (y * cw + x) * 4;
        d[idx] = v;
        d[idx + 1] = v;
        d[idx + 2] = v;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  [map, bumpMap].forEach((t) => {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repX, repY);
  });
  if (THREE.SRGBColorSpace) map.colorSpace = THREE.SRGBColorSpace;

  const sheenColor = col.clone().lerp(new THREE.Color(0xffffff), 0.45);
  return new THREE.MeshPhysicalMaterial({
    color: col,
    map,
    bumpMap,
    bumpScale,
    roughness: opts.roughness ?? 0.9,
    metalness: 0.0,
    sheen: opts.sheen ?? 0.5,
    sheenRoughness: opts.sheenRoughness ?? 0.72,
    sheenColor,
  });
}

function makeHardwareMat(THREE, hexColor, metal = false) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(hexColor || "#e8dfd5"),
    roughness: metal ? 0.32 : 0.28,
    metalness: metal ? 0.55 : 0.05,
    clearcoat: metal ? 0.3 : 0.65,
    clearcoatRoughness: 0.2,
  });
}

// ---------------------------------------------------------------------------
// Core Watertight Thick Shell Geometry Builders
// ---------------------------------------------------------------------------

function evalSurfaceNormal(THREE, evalPt, u, v, closedU) {
  const du = 0.0025;
  const dv = 0.0025;
  const u0 = closedU ? (u - du + 1) % 1 : Math.max(0, u - du);
  const u1 = closedU ? (u + du) % 1 : Math.min(1, u + du);
  const v0 = Math.max(0, v - dv);
  const v1 = Math.min(1, v + dv);
  const pu0 = evalPt(u0, v);
  const pu1 = evalPt(u1, v);
  const pv0 = evalPt(u, v0);
  const pv1 = evalPt(u, v1);
  const tu = pu1.clone().sub(pu0);
  const tv = pv1.clone().sub(pv0);
  return safeNorm(new THREE.Vector3().crossVectors(tu, tv), 0, 0, 1);
}

/**
 * Watertight closed-U tube shell with inner wall, outer wall, rolled bottom hem,
 * and either rolled top rim or smoothly closed dome pole (closedTop: true).
 * Convention: dP/du x dP/dv points OUTWARD.
 */
function buildThickTube(THREE, evalPt, uSegs, vSegs, opts = {}) {
  const thick = opts.thick ?? 0.004;
  const rBot = opts.rBot ?? thick * 0.5;
  const rTop = opts.rTop ?? thick * 0.5;
  const rollSegs = opts.rollSegs ?? 4;
  const closedTop = !!opts.closedTop;
  const uvScaleU = opts.uvScaleU ?? 1;
  const uvScaleV = opts.uvScaleV ?? 1;

  const uN = uSegs + 1;
  const vMax = closedTop ? vSegs - 1 : vSegs;
  const outerPts = [];
  const innerPts = [];
  const norms = [];

  for (let j = 0; j <= vMax; j++) {
    const v = closedTop ? (j / vSegs) * 0.992 : j / vSegs;
    const oRow = [];
    const iRow = [];
    const nRow = [];
    for (let i = 0; i <= uSegs; i++) {
      const u = (i % uSegs) / uSegs;
      const p = evalPt(u, v);
      const n = evalSurfaceNormal(THREE, evalPt, u, v, true);
      oRow.push(p);
      nRow.push(n);
      iRow.push(p.clone().addScaledVector(n, -thick));
    }
    outerPts.push(oRow);
    norms.push(nRow);
    innerPts.push(iRow);
  }

  const pos = [];
  const uvs = [];
  const idx = [];
  const pushV = (p, u, v) => {
    pos.push(p.x, p.y, p.z);
    uvs.push(u * uvScaleU, v * uvScaleV);
    return pos.length / 3 - 1;
  };

  // Outer wall
  const oBase = 0;
  for (let j = 0; j <= vMax; j++) {
    const v = j / vSegs;
    for (let i = 0; i <= uSegs; i++) {
      pushV(outerPts[j][i], i / uSegs, v);
    }
  }
  for (let j = 0; j < vMax; j++) {
    for (let i = 0; i < uSegs; i++) {
      const a = oBase + j * uN + i;
      const b = a + 1;
      const c = a + uN + 1;
      const d = a + uN;
      idx.push(a, b, c, a, c, d);
    }
  }

  // Inner wall (reversed winding)
  const iBase = pos.length / 3;
  for (let j = 0; j <= vMax; j++) {
    const v = j / vSegs;
    for (let i = 0; i <= uSegs; i++) {
      pushV(innerPts[j][i], i / uSegs, v);
    }
  }
  for (let j = 0; j < vMax; j++) {
    for (let i = 0; i < uSegs; i++) {
      const a = iBase + j * uN + i;
      const b = a + 1;
      const c = a + uN + 1;
      const d = a + uN;
      idx.push(a, c, b, a, d, c);
    }
  }

  // Helper to build a rolled closed-U rim connecting outer ring to inner ring
  const addRolledRim = (oRing, iRing, nRing, dirSign, rEdge, vCoord) => {
    const rBase = pos.length / 3;
    for (let s = 0; s <= rollSegs; s++) {
      const ang = (s / rollSegs) * Math.PI;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      for (let i = 0; i <= uSegs; i++) {
        const im = (i - 1 + uSegs) % uSegs;
        const ip = (i + 1) % uSegs;
        const tDir = oRing[ip].clone().sub(oRing[im]).multiplyScalar(dirSign);
        const to = safeNorm(new THREE.Vector3().crossVectors(tDir, nRing[i]), 0, -dirSign, 0);
        const mid = oRing[i].clone().add(iRing[i]).multiplyScalar(0.5);
        const halfN = oRing[i].clone().sub(mid);
        const pt = mid.addScaledVector(halfN, ca).addScaledVector(to, rEdge * sa);
        pushV(pt, i / uSegs, vCoord);
      }
    }
    for (let s = 0; s < rollSegs; s++) {
      for (let i = 0; i < uSegs; i++) {
        const a = rBase + s * uN + i;
        const b = a + 1;
        const c = a + uN + 1;
        const d = a + uN;
        if (dirSign > 0) {
          idx.push(a, d, c, a, c, b);
        } else {
          idx.push(a, b, c, a, c, d);
        }
      }
    }
  };

  // Bottom rolled hem (dirSign = +1, moving +u around bottom v = 0)
  addRolledRim(outerPts[0], innerPts[0], norms[0], 1, rBot, 0);

  if (closedTop) {
    // Smooth closed dome pole for outer and inner walls
    const poleOuter = evalPt(0, 1);
    const poleN = new THREE.Vector3();
    for (let i = 0; i < uSegs; i++) poleN.add(norms[vMax][i]);
    safeNorm(poleN, 0, 1, 0);
    const poleInner = poleOuter.clone().addScaledVector(poleN, -thick);

    const pOutIdx = pushV(poleOuter, 0.5, 1);
    const pInIdx = pushV(poleInner, 0.5, 1);
    const oTopStart = oBase + vMax * uN;
    const iTopStart = iBase + vMax * uN;
    for (let i = 0; i < uSegs; i++) {
      idx.push(oTopStart + i, oTopStart + i + 1, pOutIdx);
      idx.push(iTopStart + i, pInIdx, iTopStart + i + 1);
    }
  } else {
    // Top rolled rim (dirSign = -1, moving -u around top v = 1)
    addRolledRim(outerPts[vMax], innerPts[vMax], norms[vMax], -1, rTop, 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Watertight open-U / open-V thick cloth patch with a single continuous rolled
 * edge wrapping seamlessly around all four sides and corners.
 * Convention: dP/du x dP/dv points OUTWARD.
 */
function buildThickPatch(THREE, evalPt, uSegs, vSegs, opts = {}) {
  const thick = opts.thick ?? 0.004;
  const rEdge = opts.rEdge ?? thick * 0.52;
  const rollSegs = opts.rollSegs ?? 4;
  const uvScaleU = opts.uvScaleU ?? 1;
  const uvScaleV = opts.uvScaleV ?? 1;

  const uN = uSegs + 1;
  const outerPts = [];
  const innerPts = [];
  const norms = [];

  for (let j = 0; j <= vSegs; j++) {
    const v = j / vSegs;
    const oRow = [];
    const iRow = [];
    const nRow = [];
    for (let i = 0; i <= uSegs; i++) {
      const u = i / uSegs;
      const p = evalPt(u, v);
      const n = evalSurfaceNormal(THREE, evalPt, u, v, false);
      oRow.push(p);
      nRow.push(n);
      iRow.push(p.clone().addScaledVector(n, -thick));
    }
    outerPts.push(oRow);
    norms.push(nRow);
    innerPts.push(iRow);
  }

  const pos = [];
  const uvs = [];
  const idx = [];
  const pushV = (p, u, v) => {
    pos.push(p.x, p.y, p.z);
    uvs.push(u * uvScaleU, v * uvScaleV);
    return pos.length / 3 - 1;
  };

  // Outer surface
  const oBase = 0;
  for (let j = 0; j <= vSegs; j++) {
    for (let i = 0; i <= uSegs; i++) {
      pushV(outerPts[j][i], i / uSegs, j / vSegs);
    }
  }
  for (let j = 0; j < vSegs; j++) {
    for (let i = 0; i < uSegs; i++) {
      const a = oBase + j * uN + i;
      const b = a + 1;
      const c = a + uN + 1;
      const d = a + uN;
      idx.push(a, b, c, a, c, d);
    }
  }

  // Inner surface (reversed winding)
  const iBase = pos.length / 3;
  for (let j = 0; j <= vSegs; j++) {
    for (let i = 0; i <= uSegs; i++) {
      pushV(innerPts[j][i], i / uSegs, j / vSegs);
    }
  }
  for (let j = 0; j < vSegs; j++) {
    for (let i = 0; i < uSegs; i++) {
      const a = iBase + j * uN + i;
      const b = a + 1;
      const c = a + uN + 1;
      const d = a + uN;
      idx.push(a, c, b, a, d, c);
    }
  }

  // Closed CCW perimeter loop: bottom -> right -> top -> left
  const perim = [];
  for (let i = 0; i < uSegs; i++) perim.push([i, 0]);
  for (let j = 0; j < vSegs; j++) perim.push([uSegs, j]);
  for (let i = uSegs; i > 0; i--) perim.push([i, vSegs]);
  for (let j = vSegs; j > 0; j--) perim.push([0, j]);

  const M = perim.length;
  const pOut = perim.map(([i, j]) => outerPts[j][i]);
  const pIn = perim.map(([i, j]) => innerPts[j][i]);
  const pNorm = perim.map(([i, j]) => norms[j][i]);
  const pUV = perim.map(([i, j]) => [i / uSegs, j / vSegs]);

  const pTo = [];
  for (let k = 0; k < M; k++) {
    const kp = (k - 1 + M) % M;
    const kn = (k + 1) % M;
    const dPrev = safeNorm(pOut[k].clone().sub(pOut[kp]), 1, 0, 0);
    const dNext = safeNorm(pOut[kn].clone().sub(pOut[k]), 1, 0, 0);
    const oPrev = safeNorm(new THREE.Vector3().crossVectors(dPrev, pNorm[k]), 0, -1, 0);
    const oNext = safeNorm(new THREE.Vector3().crossVectors(dNext, pNorm[k]), 0, -1, 0);
    pTo.push(safeNorm(oPrev.add(oNext), oNext.x, oNext.y, oNext.z));
  }

  const rBase = pos.length / 3;
  const mN = M + 1;
  for (let s = 0; s <= rollSegs; s++) {
    const ang = (s / rollSegs) * Math.PI;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    for (let k = 0; k <= M; k++) {
      const kk = k % M;
      const mid = pOut[kk].clone().add(pIn[kk]).multiplyScalar(0.5);
      const halfN = pOut[kk].clone().sub(mid);
      const pt = mid.addScaledVector(halfN, ca).addScaledVector(pTo[kk], rEdge * sa);
      pushV(pt, pUV[kk][0], pUV[kk][1]);
    }
  }
  for (let s = 0; s < rollSegs; s++) {
    for (let k = 0; k < M; k++) {
      const a = rBase + s * mN + k;
      const b = a + 1;
      const c = a + mN + 1;
      const d = a + mN;
      idx.push(a, d, c, a, c, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sweeps a 32-segment rounded-stadium cross-section along a 3D Bezier curve path
 * to build collars with curved flare, rolled edges, thickness, and clean end caps.
 */
function buildBentBezierCollar(THREE, bezierCurves, profileFn, uSegs, opts = {}) {
  const closedU = !!opts.closedU;
  const pSegs = 32; // >= 32 segments on every round form
  const curvePath = new THREE.CurvePath();
  bezierCurves.forEach((c) => curvePath.add(c));

  const stations = [];
  for (let i = 0; i <= uSegs; i++) {
    const u = i / uSegs;
    const pos = curvePath.getPointAt(closedU && i === uSegs ? 0 : u);
    const tan = safeNorm(curvePath.getTangentAt(closedU && i === uSegs ? 0 : u), 1, 0, 0);
    const prof = profileFn(u, pos, tan);
    const up = safeNorm(prof.up.clone(), 0, 1, 0);
    const out = safeNorm(new THREE.Vector3().crossVectors(tan, up), 0, 0, 1);
    const orthoUp = safeNorm(new THREE.Vector3().crossVectors(out, tan), 0, 1, 0);
    stations.push({ pos, tan, up: orthoUp, out, ...prof });
  }

  const posArr = [];
  const uvArr = [];
  const idx = [];
  const pushV = (p, u, v) => {
    posArr.push(p.x, p.y, p.z);
    uvArr.push(u, v);
    return posArr.length / 3 - 1;
  };

  // Sample 32-point rounded stadium cross-section at each station
  const pN = pSegs + 1;
  const rings = [];
  for (let i = 0; i <= uSegs; i++) {
    const st = stations[i];
    const H = Math.max(st.height, 0.004);
    const T = Math.max(st.thick ?? 0.004, 0.002);
    const R = Math.min(T * 0.5, H * 0.45);
    const flare = st.flare ?? 0;
    const drop = st.drop ?? 0;
    const rib = st.rib ?? 0;
    const ringPts = [];

    for (let j = 0; j <= pSegs; j++) {
      const jj = j % pSegs;
      let h = 0;
      let w = 0;
      if (jj < 8) {
        // Outer face bottom -> top
        const t = jj / 8;
        h = lerp(R, H - R, t);
        w = R;
      } else if (jj < 16) {
        // Top semicircle
        const a = ((jj - 8) / 8) * Math.PI;
        h = H - R + R * Math.sin(a);
        w = R * Math.cos(a);
      } else if (jj < 24) {
        // Inner face top -> bottom
        const t = (jj - 16) / 8;
        h = lerp(H - R, R, t);
        w = -R;
      } else {
        // Bottom semicircle
        const a = Math.PI + ((jj - 24) / 8) * Math.PI;
        h = R + R * Math.sin(a);
        w = R * Math.cos(a);
      }
      const frac = clamp(h / H, 0, 1);
      const fCurve = frac * frac;
      const outOff = w + flare * fCurve + (rib ? Math.sin((i / uSegs) * Math.PI * 2 * 24) * rib * (w > 0 ? 1 : 0) : 0);
      const upOff = h - drop * fCurve;
      const pt = st.pos.clone()
        .addScaledVector(st.up, upOff)
        .addScaledVector(st.out, outOff);
      ringPts.push(pt);
      pushV(pt, (i / uSegs) * (opts.uvScaleU ?? 2), j / pSegs);
    }
    rings.push(ringPts);
  }

  for (let i = 0; i < uSegs; i++) {
    for (let j = 0; j < pSegs; j++) {
      const a = i * pN + j;
      const b = (i + 1) * pN + j;
      const c = (i + 1) * pN + j + 1;
      const d = i * pN + j + 1;
      idx.push(a, b, c, a, c, d);
    }
  }

  if (!closedU) {
    // Cap start (u = 0, outward -tan) and end (u = 1, outward +tan)
    const addCap = (ring, reverse) => {
      const center = new THREE.Vector3();
      for (let j = 0; j < pSegs; j++) center.add(ring[j]);
      center.divideScalar(pSegs);
      const cIdx = pushV(center, 0.5, 0.5);
      const rStart = posArr.length / 3;
      for (let j = 0; j < pSegs; j++) pushV(ring[j], 0.5, j / pSegs);
      for (let j = 0; j < pSegs; j++) {
        const jn = (j + 1) % pSegs;
        if (reverse) idx.push(cIdx, rStart + jn, rStart + j);
        else idx.push(cIdx, rStart + j, rStart + jn);
      }
    };
    addCap(rings[0], false);
    addCap(rings[uSegs], true);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(posArr, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvArr, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function buildButtonGeo(THREE, radius = 0.0065, height = 0.0032) {
  const pts = [
    new THREE.Vector2(0.0001, -height * 0.4),
    new THREE.Vector2(radius * 0.82, -height * 0.4),
    new THREE.Vector2(radius, -height * 0.1),
    new THREE.Vector2(radius, height * 0.25),
    new THREE.Vector2(radius * 0.88, height * 0.5),
    new THREE.Vector2(radius * 0.72, height * 0.45),
    new THREE.Vector2(radius * 0.55, height * 0.18),
    new THREE.Vector2(0.0001, height * 0.14),
  ];
  const geo = new THREE.LatheGeometry(pts, 32);
  geo.rotateX(Math.PI * 0.5); // face +z
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Anatomical Chibi Bodice Evaluator (in "chest" local space)
// ---------------------------------------------------------------------------

function makeBodiceEvaluator(THREE, bw, bh, cfg = {}) {
  const yBot = (cfg.yBot ?? -0.068) * bh;
  const yNeck = Math.max(0.162 * bh, 0.135 * bh + 0.030 * bw);
  const easeHem = cfg.easeHem ?? 0.013;
  const easeWaist = cfg.easeWaist ?? 0.018;
  const easeChest = cfg.easeChest ?? 0.013;
  const easeShoulder = cfg.easeShoulder ?? 0.013;
  const shoulderLift = cfg.shoulderLift ?? 0;
  const neckDipFront = (cfg.neckDipFront ?? 0.020) * bh;
  const neckRad = (cfg.neckRad ?? 0.0365) * bw;
  const shirttail = cfg.shirttail ?? 0;
  const drapeAmp = cfg.drapeAmp ?? 0.0014;
  const openGapFn = cfg.openGapFn || null;
  const ribAmp = cfg.ribAmp ?? 0;

  // Compute bodice point at exact (theta, v)
  const evalAtTheta = (theta, v) => {
    const st = Math.sin(theta);
    const ct = Math.cos(theta);
    const side = Math.abs(st);
    const front = Math.max(0, ct);
    const back = Math.max(0, -ct);

    // Bottom edge with optional curved shirttail
    const hemWave = shirttail ? -shirttail * bh * (front * front * 0.8 + back * back * 0.9 - side * side * 0.65) : 0;
    const y0 = yBot + hemWave;

    // Top neckline curve
    const yTopTheta = yNeck - neckDipFront * Math.pow(front, 1.55) - 0.004 * bh * side * side;

    // Smooth non-linear v -> y progression so shoulder dome gets rich resolution
    let y;
    if (v <= 0.78) {
      const t = v / 0.78;
      const ySh = Math.max(0.138 * bh, 0.135 * bh + 0.006 * bw) + shoulderLift * side * side;
      y = lerp(y0, ySh, t);
    } else {
      const t = (v - 0.78) / 0.22;
      const ySh = Math.max(0.138 * bh, 0.135 * bh + 0.006 * bw) + shoulderLift * side * side;
      // Arch slightly up over the shoulder cap before dropping smoothly to neck opening
      const arch = Math.sin(t * Math.PI) * (0.015 * bh + shoulderLift * 0.7) * side * side;
      y = lerp(ySh, yTopTheta, smoothstep(0, 1, t)) + arch;
    }

    // Horizontal cross-section radii (rx, rz) matching pelvis -> waist -> chest -> shoulders -> neck
    const yNorm = clamp((y - yBot) / Math.max(0.001, yNeck - yBot), 0, 1);
    let rx;
    let rz;
    if (v <= 0.78) {
      // Waist sits around y = 0 -> find normalised height
      const tWaist = smoothstep(yBot, 0.0, y);
      const tChest = smoothstep(0.0, 0.105 * bh, y);
      const tSh = smoothstep(0.095 * bh, 0.142 * bh, y);

      const rxHip = (0.080 + easeHem) * bw;
      const rxWaist = (0.058 + easeWaist) * bw;
      const rxChest = (0.082 + easeChest) * bw;
      const rxSh = (0.086 + easeShoulder) * bw;

      const rzHip = (0.075 + easeHem) * bw;
      const rzWaist = (0.068 + easeWaist * 0.85) * bw;
      const rzChest = (0.074 + easeChest) * bw;
      const rzSh = (0.069 + easeShoulder * 0.75) * bw;

      rx = lerp(lerp(rxHip, rxWaist, tWaist), rxChest, tChest);
      rx = lerp(rx, rxSh, tSh);
      rz = lerp(lerp(rzHip, rzWaist, tWaist), rzChest, tChest);
      rz = lerp(rz, rzSh, tSh);

      // Gentle hem flare for shadow gap between cloth and pelvis
      const hemFlare = Math.pow(1 - clamp(v / 0.22, 0, 1), 2) * (cfg.hemFlare ?? 0.003);
      rx += hemFlare;
      rz += hemFlare;
    } else {
      const t = (v - 0.78) / 0.22;
      const s = smoothstep(0, 1, t);
      const rxSh = (0.086 + easeShoulder) * bw;
      const rzSh = (0.069 + easeShoulder * 0.75) * bw;
      // Keep shoulders fuller slightly longer before curving into neck
      const sX = Math.pow(s, cfg.structuredShoulder ? 1.55 : 1.15);
      const sZ = Math.pow(s, 0.92);
      rx = lerp(rxSh, neckRad * 1.04, sX);
      rz = lerp(rzSh, neckRad * 0.98, sZ);
    }

    // Subtle chibi torso fullness in front chest & slight back curve
    const chestFull = Math.sin(clamp((y + 0.02 * bh) / (0.14 * bh), 0, 1) * Math.PI);
    const zChestMod = front * 0.0035 * bw * chestFull - back * 0.0015 * bw * (1 - yNorm);

    // Superellipse fullness at shoulders/chest for natural tailored shape
    const sq = 0.04 * (1 - smoothstep(0.78, 0.98, v));
    const sx = st * (1 + sq * ct * ct);
    const cz = ct * (1 + sq * st * st);

    let x = rx * sx;
    let z = rz * cz + zChestMod;

    // Sculpted shoulder seam ridge along top of shoulders (theta ≈ ±PI/2, v in [0.80, 0.99])
    const seamLine = Math.exp(-(ct * ct) / 0.0055) * smoothstep(0.78, 0.86, v) * (1 - smoothstep(0.95, 1.0, v));
    y += seamLine * 0.0014;

    // Subtle contoured armhole seam lip around sides at shoulder height
    const armBand = Math.exp(-Math.pow((v - 0.76) / 0.075, 2)) * Math.pow(side, 3);
    x += Math.sign(st) * armBand * (cfg.structuredShoulder ? 0.003 : 0.0012);

    // Gentle vertical fabric drape folds near the hem
    const drapeEnv = (1 - smoothstep(0.0, 0.65, v));
    const drape = (Math.sin(theta * 5 + 0.4) * 0.55 + Math.cos(theta * 7 - 0.8) * 0.45) * drapeAmp * drapeEnv;
    const rib = ribAmp ? Math.sin(theta * 36) * ribAmp : 0;
    const radial = drape + rib;
    x += st * radial;
    z += ct * radial;

    return new THREE.Vector3(x, y, z);
  };

  const evalUV = (u, v) => {
    let theta;
    if (openGapFn) {
      const gap = openGapFn(v);
      theta = gap + u * (Math.PI * 2 - 2 * gap);
    } else {
      theta = u * Math.PI * 2;
    }
    return evalAtTheta(theta, v);
  };

  return { evalUV, evalAtTheta, yBot, yNeck };
}

/**
 * Separate fluted ribbed hem band joined cleanly right below a bodice (zero overlap).
 */
function buildRibbedHemBand(THREE, pivot, bw, bh, cfg, mat, slot, out) {
  const yTop = cfg.yJoin * bh;
  const yBot = cfg.yBot * bh;
  const ease = cfg.ease ?? 0.011;
  const openGapFn = cfg.openGapFn || null;
  const ribAmp = cfg.ribAmp ?? 0.0011;

  const evalAtTheta = (theta, v) => {
    const st = Math.sin(theta);
    const ct = Math.cos(theta);
    const y = lerp(yBot, yTop, v);
    // Slightly snugger at bottom lip, gently rounded like real knitted ribbing
    const bulge = Math.sin(v * Math.PI) * 0.0016;
    const snug = lerp(-0.0022, 0.0005, v);
    const rx = (0.080 + ease + snug + bulge) * bw;
    const rz = (0.075 + ease + snug + bulge) * bw;
    const rib = Math.sin(theta * 40) * ribAmp;
    return new THREE.Vector3((rx + rib) * st, y, (rz + rib) * ct);
  };

  let geo;
  if (openGapFn) {
    geo = buildThickPatch(
      THREE,
      (u, v) => {
        const gap = openGapFn(v);
        const theta = gap + u * (Math.PI * 2 - 2 * gap);
        return evalAtTheta(theta, v);
      },
      48,
      10,
      { thick: 0.0044, rEdge: 0.0024, uvScaleU: 3, uvScaleV: 0.5 }
    );
  } else {
    geo = buildThickTube(
      THREE,
      (u, v) => evalAtTheta(u * Math.PI * 2, v),
      56,
      10,
      { thick: 0.0044, rBot: 0.0032, rTop: 0.0022, uvScaleU: 3, uvScaleV: 0.5 }
    );
  }
  return createAndAttach(THREE, pivot, geo, mat, slot, out);
}

// ---------------------------------------------------------------------------
// Set-In Sleeves (Upper on armL/armR, Lower + Cuffs on forearmL/forearmR)
// ---------------------------------------------------------------------------

function buildSleeves(THREE, rig, bw, bh, cfg, sleeveMat, cuffMat, btnMat, slot, accSlot, out) {
  const isShort = !!cfg.short;
  const ease = cfg.ease ?? 0.011;
  const cuffStyle = cfg.cuffStyle ?? "rib"; // "rib" | "shirt" | "blazer" | "none"
  const wrinkleAmp = cfg.wrinkleAmp ?? 0.0022;
  const structuredCap = !!cfg.structuredCap;
  const blouse = cfg.blouse ?? 0.003;

  const sides = [
    { side: 1, arm: rig.getObjectByName("armL"), fore: rig.getObjectByName("forearmL") },
    { side: -1, arm: rig.getObjectByName("armR"), fore: rig.getObjectByName("forearmR") },
  ];

  const yUpperBot = isShort ? -0.072 * bh : -0.112 * bh;
  const capH = 0.028 * bw + Math.max(0.006, ease * 0.55) + (structuredCap ? 0.003 : 0);

  for (const { side, arm, fore } of sides) {
    // --- Upper Sleeve with set-in shoulder cap ---
    if (arm) {
      const evalUpper = (u, v) => {
        const theta = u * Math.PI * 2;
        const st = Math.sin(theta);
        const ct = Math.cos(theta);
        const outward = side * st; // +1 outer shoulder, -1 armpit

        if (v <= 0.72) {
          const t = v / 0.72; // 0 = bottom, 1 = shoulder center y=0
          const y = lerp(yUpperBot, 0, t);
          const bodyR = lerp(isShort ? 0.0235 : 0.0222, 0.0275, t) * bw;
          let r = bodyR + ease + (isShort ? (1 - t) * 0.0025 : 0);
          // Slight flare at elbow end so lower sleeve dome nests inside cleanly (>=0.005 gap)
          if (!isShort) {
            const elbFlare = Math.pow(1 - clamp(t / 0.35, 0, 1), 2) * 0.004;
            r += elbFlare;
            // Two ring-shaped elbow wrinkles near bottom of upper sleeve
            const wEnv = Math.exp(-Math.pow((t - 0.16) / 0.13, 2));
            const creaseBias = 0.65 + 0.35 * ct; // slightly stronger at front elbow bend (+z)
            r += Math.sin((t - 0.05) * Math.PI * 10) * wrinkleAmp * wEnv * creaseBias;
          }
          // Subtle armpit contour near top
          const pitIndent = Math.max(0, -outward) * smoothstep(0.6, 1.0, t) * 0.0025 * bw;
          return new THREE.Vector3((r - pitIndent) * st, y, r * ct);
        } else {
          // Set-in domed shoulder cap enclosing shoulder ball
          const s = (v - 0.72) / 0.28;
          const phi = s * Math.PI * 0.5;
          const baseR = 0.0275 * bw + ease;
          const cosP = Math.cos(phi);
          const sinP = Math.sin(phi);
          const sqCap = structuredCap ? 1 + 0.12 * Math.sin(s * Math.PI) * Math.max(0, outward) : 1;
          const pitPull = Math.max(0, -outward) * 0.0045 * bw * Math.sin(s * Math.PI);
          const rx = Math.max(0.0004, baseR * cosP * sqCap - pitPull);
          const rz = Math.max(0.0004, baseR * cosP);
          // Crown slightly taller on outer side, sloping toward armpit/neck
          const y = capH * sinP * (0.94 + 0.08 * outward);
          return new THREE.Vector3(rx * st, y, rz * ct);
        }
      };

      const upperGeo = buildThickTube(THREE, evalUpper, 36, 26, {
        thick: 0.0038,
        rBot: isShort ? 0.0035 : 0.0024,
        closedTop: true,
        uvScaleU: 1.5,
        uvScaleV: 1.5,
      });
      createAndAttach(THREE, arm, upperGeo, sleeveMat, slot, out);
    }

    if (isShort || !fore) continue;

    // --- Lower Sleeve on forearmL/R ---
    const hasSepCuff = cuffStyle === "rib" || cuffStyle === "shirt";
    const yLowerBot = hasSepCuff ? -0.086 * bh : -0.109 * bh;
    const domeH = 0.015 * bw;

    const evalLower = (u, v) => {
      const theta = u * Math.PI * 2;
      const st = Math.sin(theta);
      const ct = Math.cos(theta);

      if (v <= 0.84) {
        const t = v / 0.84; // 0 = wrist/cuff join, 1 = elbow center y = 0
        const y = lerp(yLowerBot, 0, t);
        const bodyR = lerp(hasSepCuff ? 0.0182 : 0.0172, 0.022, t) * bw;
        // Tuck neatly inside upper sleeve opening near elbow (gap >= 0.005, zero z-fighting)
        const elbowTuck = smoothstep(0.72, 1.0, t) * (ease - 0.006);
        let r = bodyR + ease - elbowTuck;

        // Gentle blousing just above ribbed/shirt cuff
        if (hasSepCuff) {
          const bEnv = Math.exp(-Math.pow((t - 0.14) / 0.18, 2));
          r += blouse * bEnv + Math.sin(theta * 7) * 0.0009 * bEnv;
        } else {
          // Blazer slight crisp cuff ease
          r += (1 - t) * 0.0018;
        }

        // Two more ring-shaped elbow wrinkles on upper forearm (total 4 across elbow)
        const wEnv = Math.exp(-Math.pow((t - 0.72) / 0.14, 2));
        const creaseBias = 0.65 + 0.35 * ct;
        r += Math.sin((t - 0.58) * Math.PI * 10) * wrinkleAmp * wEnv * creaseBias;

        return new THREE.Vector3(r * st, y, r * ct);
      } else {
        // Closed elbow ball dome tucked cleanly inside upper sleeve
        const s = (v - 0.84) / 0.16;
        const phi = s * Math.PI * 0.5;
        const baseR = 0.022 * bw + 0.006;
        const r = Math.max(0.0004, baseR * Math.cos(phi));
        return new THREE.Vector3(r * st, domeH * Math.sin(phi), r * ct);
      }
    };

    const lowerGeo = buildThickTube(THREE, evalLower, 36, 26, {
      thick: 0.0036,
      rBot: hasSepCuff ? 0.0022 : 0.0032,
      closedTop: true,
      uvScaleU: 1.4,
      uvScaleV: 1.5,
    });
    createAndAttach(THREE, fore, lowerGeo, sleeveMat, slot, out);

    // --- Wrist Cuffs ---
    if (cuffStyle === "rib") {
      const yCuffTop = yLowerBot;
      const yCuffBot = -0.111 * bh;
      const evalCuff = (u, v) => {
        const theta = u * Math.PI * 2;
        const y = lerp(yCuffBot, yCuffTop, v);
        const bodyR = lerp(0.017, 0.0182, v) * bw;
        const r = bodyR + 0.0075 + Math.sin(v * Math.PI) * 0.0012 + Math.sin(theta * 24) * 0.0009;
        return new THREE.Vector3(r * Math.sin(theta), y, r * Math.cos(theta));
      };
      const cuffGeo = buildThickTube(THREE, evalCuff, 36, 10, {
        thick: 0.004,
        rBot: 0.003,
        rTop: 0.002,
        uvScaleU: 2,
        uvScaleV: 0.5,
      });
      createAndAttach(THREE, fore, cuffGeo, cuffMat || sleeveMat, slot, out);
    } else if (cuffStyle === "shirt") {
      const yCuffTop = yLowerBot;
      const yCuffBot = -0.110 * bh;
      const evalCuff = (u, v) => {
        const theta = u * Math.PI * 2;
        const y = lerp(yCuffBot, yCuffTop, v);
        const bodyR = lerp(0.017, 0.0182, v) * bw;
        // Crisp structured cuff band with subtle overlap step at outer-back vent
        const overlap = smoothstep(0.6, 0.9, -Math.cos(theta) * side * Math.sin(theta) + 0.5) * 0.0008;
        const r = bodyR + 0.0082 + overlap;
        return new THREE.Vector3(r * Math.sin(theta), y, r * Math.cos(theta));
      };
      const cuffGeo = buildThickTube(THREE, evalCuff, 36, 10, {
        thick: 0.0038,
        rBot: 0.0024,
        rTop: 0.002,
        uvScaleU: 1.5,
        uvScaleV: 0.5,
      });
      createAndAttach(THREE, fore, cuffGeo, cuffMat || sleeveMat, slot, out);

      // Tiny cuff button on outer side
      if (btnMat) {
        const bGeo = buildButtonGeo(THREE, 0.0036, 0.0022);
        const br = 0.0176 * bw + 0.0088;
        createAndAttach(
          THREE,
          fore,
          bGeo,
          btnMat,
          accSlot,
          out,
          [side * br * 0.92, lerp(yCuffBot, yCuffTop, 0.5), -br * 0.38],
          [0, side * Math.PI * 0.62, 0]
        );
      }
    } else if (cuffStyle === "blazer" && btnMat) {
      // Two tiny decorative blazer sleeve buttons on outer back wrist
      const bGeo = buildButtonGeo(THREE, 0.0038, 0.0022);
      const rBtn = 0.0176 * bw + ease + 0.0022;
      for (let k = 0; k < 2; k++) {
        const by = -0.097 * bh + k * 0.010 * bh;
        createAndAttach(
          THREE,
          fore,
          bGeo,
          btnMat,
          accSlot,
          out,
          [side * rBtn * 0.85, by, -rBtn * 0.52],
          [0, side * Math.PI * 0.68, 0]
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Bent Bezier Collars (sitting on "neck" pivot)
// ---------------------------------------------------------------------------

function makeNeckArcBeziers(THREE, rX, rZ, yFront, ySide, yBack, startAng, endAng, segCount = 4) {
  // Approximate elliptical dipped neck curve with chained CubicBezierCurve3 segments
  const ptAt = (a) => {
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const front = Math.max(0, ca);
    const back = Math.max(0, -ca);
    const side = Math.abs(sa);
    const y = ySide * (side * side) + yFront * (front * front) + yBack * (back * back);
    return new THREE.Vector3(rX * sa, y, rZ * ca);
  };
  const tanAt = (a) => {
    const eps = 0.005;
    return ptAt(a + eps).sub(ptAt(a - eps)).divideScalar(2 * eps);
  };
  const curves = [];
  const step = (endAng - startAng) / segCount;
  for (let i = 0; i < segCount; i++) {
    const a0 = startAng + i * step;
    const a1 = a0 + step;
    const p0 = ptAt(a0);
    const p3 = ptAt(a1);
    const p1 = p0.clone().addScaledVector(tanAt(a0), step / 3);
    const p2 = p3.clone().addScaledVector(tanAt(a1), -step / 3);
    curves.push(new THREE.CubicBezierCurve3(p0, p1, p2, p3));
  }
  return curves;
}

function buildCollar(THREE, neckPivot, bw, bh, style, mat, slot, out) {
  if (!neckPivot) return;
  const rNeck = 0.028 * bw;

  if (style === "crew" || style === "hoodieRim") {
    const r = rNeck + (style === "hoodieRim" ? 0.011 : 0.0085);
    const curves = makeNeckArcBeziers(
      THREE,
      r * 1.03,
      r * 0.99,
      -0.016 * bh,
      -0.002 * bh,
      0.002 * bh,
      0,
      Math.PI * 2,
      4
    );
    const geo = buildBentBezierCollar(
      THREE,
      curves,
      () => ({
        up: new THREE.Vector3(0, 1, 0),
        height: (style === "hoodieRim" ? 0.014 : 0.012) * bh,
        thick: 0.0044,
        flare: -0.002,
        rib: 0.0005,
      }),
      48,
      { closedU: true, uvScaleU: 3 }
    );
    createAndAttach(THREE, neckPivot, geo, mat, slot, out);
  } else if (style === "ribMock") {
    // Chunky folded ribbed sweater collar
    const r = rNeck + 0.0095;
    const curves = makeNeckArcBeziers(
      THREE,
      r * 1.02,
      r * 1.0,
      -0.012 * bh,
      -0.003 * bh,
      0.001 * bh,
      0,
      Math.PI * 2,
      4
    );
    const geo = buildBentBezierCollar(
      THREE,
      curves,
      () => ({
        up: new THREE.Vector3(0, 1, 0),
        height: 0.026 * bh,
        thick: 0.0062,
        flare: 0.0038,
        drop: 0.003 * bh,
        rib: 0.0011,
      }),
      56,
      { closedU: true, uvScaleU: 3.5 }
    );
    createAndAttach(THREE, neckPivot, geo, mat, slot, out);
  } else if (style === "shirt") {
    // 1. Crisp collar stand hugging the neck
    const rStand = rNeck + 0.0072;
    const standCurves = makeNeckArcBeziers(
      THREE,
      rStand * 1.02,
      rStand,
      -0.008 * bh,
      -0.002 * bh,
      0.001 * bh,
      0.16,
      Math.PI * 2 - 0.16,
      4
    );
    const standGeo = buildBentBezierCollar(
      THREE,
      standCurves,
      () => ({
        up: new THREE.Vector3(0, 1, 0),
        height: 0.018 * bh,
        thick: 0.0036,
        flare: -0.0012,
      }),
      44,
      { closedU: false, uvScaleU: 2 }
    );
    createAndAttach(THREE, neckPivot, standGeo, mat, slot, out);

    // 2. Folded turn-down collar blade with pointed front tips
    const rLeaf = rStand + 0.0026;
    const leafCurves = makeNeckArcBeziers(
      THREE,
      rLeaf * 1.02,
      rLeaf,
      0.008 * bh,
      0.013 * bh,
      0.015 * bh,
      0.14,
      Math.PI * 2 - 0.14,
      4
    );
    const leafGeo = buildBentBezierCollar(
      THREE,
      leafCurves,
      (u) => {
        // Longer crisp collar points near the front ends (u near 0 and 1)
        const frontTip = Math.pow(Math.abs(u * 2 - 1), 2.4);
        const h = (0.019 + 0.012 * frontTip) * bh;
        return {
          up: new THREE.Vector3(0, -0.82, 0),
          height: h,
          thick: 0.0036,
          flare: 0.0145 * bw * (0.85 + 0.3 * frontTip),
          drop: -0.003 * bh,
        };
      },
      48,
      { closedU: false, uvScaleU: 2.5 }
    );
    createAndAttach(THREE, neckPivot, leafGeo, mat, slot, out);
  } else if (style === "cardiganBand" || style === "blazerStand") {
    // Open-front back/side neck collar band feeding smoothly into front bands / lapels
    const isBlazer = style === "blazerStand";
    const r = rNeck + (isBlazer ? 0.0125 : 0.0115);
    const gap = isBlazer ? 0.56 : 0.44;
    const curves = makeNeckArcBeziers(
      THREE,
      r * 1.04,
      r * 1.0,
      -0.010 * bh,
      -0.001 * bh,
      0.002 * bh,
      gap,
      Math.PI * 2 - gap,
      4
    );
    const geo = buildBentBezierCollar(
      THREE,
      curves,
      (u) => {
        const endTaper = smoothstep(0, 0.14, u) * smoothstep(0, 0.14, 1 - u);
        return {
          up: new THREE.Vector3(0, 1, 0),
          height: (isBlazer ? 0.020 : 0.017) * bh * (0.65 + 0.35 * endTaper),
          thick: isBlazer ? 0.0044 : 0.0048,
          flare: isBlazer ? 0.0085 * bw : 0.0035 * bw,
          drop: isBlazer ? 0.004 * bh : 0.001 * bh,
          rib: isBlazer ? 0 : 0.0007,
        };
      },
      44,
      { closedU: false, uvScaleU: 2.5 }
    );
    createAndAttach(THREE, neckPivot, geo, mat, slot, out);
  }
}

// ---------------------------------------------------------------------------
// 1. HOODIE
// ---------------------------------------------------------------------------

function wearHoodie(THREE, rig, bw, bh, opts, kit, out) {
  const chest = rig.getObjectByName("chest");
  const neck = rig.getObjectByName("neck");

  const mainMat = makeFabricMat(THREE, kit, "fleece", opts.topColor, { repX: 3, repY: 3, bumpScale: 0.0022 });
  const ribMat = makeFabricMat(THREE, kit, "rib", opts.topColor, { repX: 4, repY: 1.5, bumpScale: 0.0028 });
  const cordMat = makeFabricMat(THREE, kit, "knit", opts.accent, { repX: 2, repY: 6, bumpScale: 0.0018 });
  const metalMat = makeHardwareMat(THREE, opts.accent, true);
  const darkInnerMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(opts.topColor).multiplyScalar(0.32),
    roughness: 0.95,
    sheen: 0.2,
  });

  // Bodice shell (ends at ribbed hem join y = -0.044*bh)
  const bod = makeBodiceEvaluator(THREE, bw, bh, {
    yBot: -0.044,
    easeHem: 0.016,
    easeWaist: 0.026,
    easeChest: 0.016,
    easeShoulder: 0.015,
    neckDipFront: 0.022,
    neckRad: 0.039,
    hemFlare: 0.0025,
    drapeAmp: 0.0022,
  });
  const bodGeo = buildThickTube(THREE, bod.evalUV, 56, 28, {
    thick: 0.0044,
    rBot: 0.0024,
    rTop: 0.0028,
    uvScaleU: 2,
    uvScaleV: 2,
  });
  createAndAttach(THREE, chest, bodGeo, mainMat, "top", out);

  // Ribbed hem overlapping waist & top of pelvis
  buildRibbedHemBand(THREE, chest, bw, bh, {
    yJoin: -0.044,
    yBot: -0.072,
    ease: 0.012,
    ribAmp: 0.0011,
  }, ribMat, "top", out);

  // Cozy long sleeves with elbow wrinkles & ribbed cuffs
  buildSleeves(THREE, rig, bw, bh, {
    ease: 0.013,
    cuffStyle: "rib",
    wrinkleAmp: 0.0026,
    blouse: 0.0042,
  }, mainMat, ribMat, null, "top", "accent", out);

  // Soft neck rim
  buildCollar(THREE, neck, bw, bh, "hoodieRim", ribMat, "top", out);

  // Soft draped hood resting on the back and shoulders
  if (chest) {
    const yBase = Math.max(0.156 * bh, 0.135 * bh + 0.024 * bw);
    // u: 0 (left shoulder +x) -> 0.5 (back center -z) -> 1 (right shoulder -x)
    // v: 0 (neck attachment) -> 0.5 (bottom back pouch) -> 1 (top rolled hood opening rim)
    const evalHood = (u, v) => {
      const ang = lerp(Math.PI * 0.28, Math.PI * 1.72, u); // wraps from front-left around back to front-right
      const backW = Math.pow(Math.sin(u * Math.PI), 1.35); // 1 at back center, 0 at front ends

      // 2D cross-section of the folded back pouch at full back depth (backW = 1)
      let depth;
      let yDrop;
      if (v <= 0.5) {
        const t = v / 0.5;
        depth = lerp(0.042, 0.128, Math.pow(t, 0.85));
        yDrop = lerp(0.0, 0.104, Math.sin(t * Math.PI * 0.5));
      } else {
        const t = (v - 0.5) / 0.5;
        depth = lerp(0.128, 0.068, t) + Math.sin(t * Math.PI) * 0.032;
        yDrop = lerp(0.104, -0.012, smoothstep(0, 1, t));
      }

      // Soft organic cloth folds along the resting hood
      const fold = (Math.sin(u * Math.PI * 5) * 0.0045 + Math.cos(u * Math.PI * 3) * 0.003) *
        Math.sin(v * Math.PI) * backW;

      const rSide = lerp(0.044, 0.088 + 0.022 * Math.sin(v * Math.PI), backW) * bw;
      const rBack = lerp(0.044, depth, backW) * bw + fold;

      const x = Math.sin(ang) * rSide;
      const z = Math.cos(ang) * rBack - 0.010 * bw * backW;
      const y = yBase - yDrop * bh * backW + (1 - backW) * lerp(-0.014, 0.006, v) * bh;
      return new THREE.Vector3(x, y, z);
    };

    const hoodGeo = buildThickPatch(THREE, evalHood, 44, 24, {
      thick: 0.0052,
      rEdge: 0.0032,
      uvScaleU: 2.2,
      uvScaleV: 1.4,
    });
    createAndAttach(THREE, chest, hoodGeo, mainMat, "top", out);

    // Kangaroo pocket with two raised slanted side openings
    const evalPocket = (u, v) => {
      // Trapezoidal width: wider at bottom (v=0), narrower at top (v=1)
      const halfSpan = lerp(0.58, 0.36, smoothstep(0, 1, v));
      const theta = lerp(-halfSpan, halfSpan, u);
      const vBod = lerp(0.05, 0.41, v);
      const base = bod.evalAtTheta(theta, vBod);
      const n = evalSurfaceNormal(THREE, bod.evalUV, ((theta / (Math.PI * 2)) + 1) % 1, vBod, true);
      // Pocket bulges gently in center & lifts slightly at the slanted side entry lips
      const edgeLip = Math.pow(Math.abs(u * 2 - 1), 2.5) * Math.sin(v * Math.PI);
      const pouch = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.0055;
      const offset = 0.0052 + pouch + edgeLip * 0.0038;
      return base.addScaledVector(n, offset);
    };
    const pocketGeo = buildThickPatch(THREE, evalPocket, 24, 16, {
      thick: 0.0042,
      rEdge: 0.0028,
      uvScaleU: 1.0,
      uvScaleV: 0.7,
    });
    createAndAttach(THREE, chest, pocketGeo, mainMat, "top", out);

    // Subtle dark shadowed backing tucked behind the two side pocket openings
    for (const side of [-1, 1]) {
      const evalSlotShadow = (u, v) => {
        const halfSpan = lerp(0.56, 0.36, smoothstep(0, 1, v));
        const theta = side * (halfSpan - lerp(0.01, 0.10, u));
        const vBod = lerp(0.08, 0.38, v);
        const base = bod.evalAtTheta(theta, vBod);
        const n = evalSurfaceNormal(THREE, bod.evalUV, ((theta / (Math.PI * 2)) + 1) % 1, vBod, true);
        return base.addScaledVector(n, 0.0042);
      };
      // Build thin shadow strip (order u cleanly so normals face out)
      const sGeo = buildThickPatch(
        THREE,
        (u, v) => evalSlotShadow(side > 0 ? 1 - u : u, v),
        6,
        10,
        { thick: 0.0018, rEdge: 0.0009 }
      );
      createAndAttach(THREE, chest, sGeo, darkInnerMat, "top", out);
    }

    // Two grommets + curved drawstrings + metal aglets
    const gromGeo = new THREE.TorusGeometry(0.0036, 0.0012, 32, 32);
    const agletGeo = new THREE.CylinderGeometry(0.0026, 0.0023, 0.014, 32);
    for (const side of [-1, 1]) {
      const thetaG = side * 0.32;
      const gPos = bod.evalAtTheta(thetaG, 0.88);
      const gNorm = evalSurfaceNormal(THREE, bod.evalUV, ((thetaG / (Math.PI * 2)) + 1) % 1, 0.88, true);
      const gWorld = gPos.clone().addScaledVector(gNorm, 0.0035);
      createAndAttach(THREE, chest, gromGeo, metalMat, "accent", out, [gWorld.x, gWorld.y, gWorld.z], [0.22, side * 0.28, 0]);

      // Slightly asymmetric natural hanging drawstring curves
      const len = (side > 0 ? 0.088 : 0.082) * bh;
      const sway = side * 0.006 * bw;
      const p0 = gWorld.clone();
      const p1 = bod.evalAtTheta(thetaG + side * 0.04, 0.72).add(new THREE.Vector3(0, 0, 0.009));
      const p2 = bod.evalAtTheta(thetaG + side * 0.02, 0.54).add(new THREE.Vector3(sway * 0.4, 0, 0.010));
      const p3 = new THREE.Vector3(p2.x + sway * 0.35, p0.y - len, p2.z + 0.002);
      const cordCurve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
      const cordGeo = new THREE.TubeGeometry(cordCurve, 28, 0.0023, 32, false);
      createAndAttach(THREE, chest, cordGeo, cordMat, "accent", out);

      // Aglet capping the tip
      const tipTan = safeNorm(cordCurve.getTangent(1), 0, -1, 0);
      const agletPos = p3.clone().addScaledVector(tipTan, 0.006);
      const agletMesh = createAndAttach(THREE, chest, agletGeo, metalMat, "accent", out, [agletPos.x, agletPos.y, agletPos.z]);
      if (agletMesh) {
        agletMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), tipTan);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 2. CARDIGAN (over a plain tee layer, button band + 4 buttons)
// ---------------------------------------------------------------------------

function wearCardigan(THREE, rig, bw, bh, opts, kit, out) {
  const chest = rig.getObjectByName("chest");
  const neck = rig.getObjectByName("neck");

  const cardMat = makeFabricMat(THREE, kit, "knit", opts.topColor, { repX: 3.5, repY: 3.5, bumpScale: 0.0028 });
  const ribMat = makeFabricMat(THREE, kit, "rib", opts.topColor, { repX: 4, repY: 1.5, bumpScale: 0.003 });
  const teeMat = makeFabricMat(THREE, kit, "jersey", opts.accent, { repX: 3, repY: 3, bumpScale: 0.0014 });
  const btnMat = makeHardwareMat(THREE, opts.accent, false);

  // Inner plain tee layer (offset +0.0075 from body -> zero z-fighting with cardigan at +0.016)
  const teeBod = makeBodiceEvaluator(THREE, bw, bh, {
    yBot: -0.062,
    easeHem: 0.008,
    easeWaist: 0.011,
    easeChest: 0.008,
    easeShoulder: 0.0075,
    neckDipFront: 0.022,
    neckRad: 0.0345,
    hemFlare: 0.0015,
    drapeAmp: 0.0008,
  });
  const teeGeo = buildThickTube(THREE, teeBod.evalUV, 48, 22, {
    thick: 0.003,
    rBot: 0.002,
    rTop: 0.002,
    uvScaleU: 2,
    uvScaleV: 2,
  });
  createAndAttach(THREE, chest, teeGeo, teeMat, "accent", out);
  buildCollar(THREE, neck, bw, bh, "crew", teeMat, "accent", out);

  // Open-front cardigan gap curve: open over tee, widening gracefully at V-neck
  const openGapFn = (v) => {
    const baseGap = 0.24; // shows plain tee nicely down front
    const vNeck = smoothstep(0.42, 0.88, v) * 0.26;
    const neckPull = smoothstep(0.88, 1.0, v) * 0.04;
    return baseGap + vNeck - neckPull;
  };

  // Cardigan bodice (ends at ribbed hem y = -0.048*bh)
  const cardBod = makeBodiceEvaluator(THREE, bw, bh, {
    yBot: -0.048,
    easeHem: 0.016,
    easeWaist: 0.021,
    easeChest: 0.016,
    easeShoulder: 0.0155,
    neckDipFront: 0.016,
    neckRad: 0.040,
    hemFlare: 0.002,
    drapeAmp: 0.0016,
    openGapFn,
  });
  const cardGeo = buildThickPatch(THREE, cardBod.evalUV, 52, 26, {
    thick: 0.0044,
    rEdge: 0.0026,
    uvScaleU: 2.2,
    uvScaleV: 2,
  });
  createAndAttach(THREE, chest, cardGeo, cardMat, "top", out);

  // Ribbed bottom hem (open at front matching cardigan gap)
  buildRibbedHemBand(THREE, chest, bw, bh, {
    yJoin: -0.048,
    yBot: -0.072,
    ease: 0.0155,
    ribAmp: 0.001,
    openGapFn: () => 0.24,
  }, ribMat, "top", out);

  // Raised ribbed button bands framing both left & right front openings
  if (chest) {
    const bandW = 0.145; // angular width of placket band
    for (const side of [-1, 1]) {
      const evalBand = (u, v) => {
        // v goes from bottom of ribbed hem (-0.072) up to shoulder/neck (v=1)
        const vBod = clamp((v - 0.11) / 0.89, 0, 1);
        const gap = openGapFn(vBod);
        // side=+1 (left edge, theta near +gap), side=-1 (right edge, theta near 2PI - gap)
        const tInner = side > 0 ? gap - 0.015 : Math.PI * 2 - gap + 0.015;
        const tOuter = side > 0 ? gap + bandW : Math.PI * 2 - gap - bandW;
        const theta = side > 0 ? lerp(tInner, tOuter, u) : lerp(tOuter, tInner, u);

        const base = cardBod.evalAtTheta(theta, vBod);
        if (v < 0.11) {
          base.y = lerp(-0.072 * bh, -0.048 * bh, v / 0.11);
        }
        const n = evalSurfaceNormal(THREE, (uu, vv) => cardBod.evalAtTheta(uu * Math.PI * 2, vv), ((theta / (Math.PI * 2)) + 1) % 1, vBod, true);
        return base.addScaledVector(n, 0.0046);
      };
      const bandGeo = buildThickPatch(THREE, evalBand, 10, 26, {
        thick: 0.0038,
        rEdge: 0.0022,
        uvScaleU: 0.4,
        uvScaleV: 3,
      });
      createAndAttach(THREE, chest, bandGeo, ribMat, "top", out);
    }

    // Four buttons on the right-side button band + four subtle stitched buttonholes on left
    const btnGeo = buildButtonGeo(THREE, 0.0064, 0.0032);
    const holeGeo = new THREE.BoxGeometry(0.0068, 0.0018, 0.0018);
    const btnVs = [0.05, 0.21, 0.37, 0.53];
    for (const bv of btnVs) {
      const gap = openGapFn(bv);
      const tBtn = Math.PI * 2 - (gap + bandW * 0.5);
      const bPos = cardBod.evalAtTheta(tBtn, bv);
      const bNorm = evalSurfaceNormal(THREE, (uu, vv) => cardBod.evalAtTheta(uu * Math.PI * 2, vv), ((tBtn / (Math.PI * 2)) + 1) % 1, bv, true);
      const pOut = bPos.clone().addScaledVector(bNorm, 0.0062);
      const bMesh = createAndAttach(THREE, chest, btnGeo, btnMat, "accent", out, [pOut.x, pOut.y, pOut.z]);
      if (bMesh) bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), bNorm);

      // Opposite buttonhole bar
      const tHole = gap + bandW * 0.5;
      const hPos = cardBod.evalAtTheta(tHole, bv);
      const hNorm = evalSurfaceNormal(THREE, (uu, vv) => cardBod.evalAtTheta(uu * Math.PI * 2, vv), ((tHole / (Math.PI * 2)) + 1) % 1, bv, true);
      const hOut = hPos.clone().addScaledVector(hNorm, 0.005);
      const hMesh = createAndAttach(THREE, chest, holeGeo, btnMat, "accent", out, [hOut.x, hOut.y, hOut.z]);
      if (hMesh) hMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), hNorm);
    }
  }

  // Long knitted sleeves with elbow wrinkles & ribbed cuffs
  buildSleeves(THREE, rig, bw, bh, {
    ease: 0.012,
    cuffStyle: "rib",
    wrinkleAmp: 0.0022,
    blouse: 0.003,
  }, cardMat, ribMat, null, "top", "accent", out);

  // Ribbed neckband joining the front button bands
  buildCollar(THREE, neck, bw, bh, "cardiganBand", ribMat, "top", out);
}

// ---------------------------------------------------------------------------
// 3. SWEATER (ribbed collar/cuffs/hem, painted cable & stripe pattern)
// ---------------------------------------------------------------------------

function wearSweater(THREE, rig, bw, bh, opts, kit, out) {
  const chest = rig.getObjectByName("chest");
  const neck = rig.getObjectByName("neck");

  const cableMat = makeFabricMat(THREE, kit, "cable", opts.topColor, {
    accent: opts.accent,
    accentStripe: true,
    repX: 2.5,
    repY: 2.0,
    bumpScale: 0.0036,
  });
  const ribMat = makeFabricMat(THREE, kit, "rib", opts.topColor, { repX: 4, repY: 1.5, bumpScale: 0.0032 });

  const bod = makeBodiceEvaluator(THREE, bw, bh, {
    yBot: -0.044,
    easeHem: 0.017,
    easeWaist: 0.025,
    easeChest: 0.017,
    easeShoulder: 0.016,
    neckDipFront: 0.018,
    neckRad: 0.038,
    hemFlare: 0.003,
    drapeAmp: 0.0018,
  });
  const bodGeo = buildThickTube(THREE, bod.evalUV, 56, 28, {
    thick: 0.0048,
    rBot: 0.0026,
    rTop: 0.0028,
    uvScaleU: 2,
    uvScaleV: 2,
  });
  createAndAttach(THREE, chest, bodGeo, cableMat, "top", out);

  // Thick fluted ribbed hem overlapping waist & pelvis
  buildRibbedHemBand(THREE, chest, bw, bh, {
    yJoin: -0.044,
    yBot: -0.073,
    ease: 0.0125,
    ribAmp: 0.0013,
  }, ribMat, "top", out);

  // Plush cable-knit sleeves with elbow wrinkles & ribbed cuffs
  buildSleeves(THREE, rig, bw, bh, {
    ease: 0.0135,
    cuffStyle: "rib",
    wrinkleAmp: 0.0024,
    blouse: 0.0045,
  }, cableMat, ribMat, null, "top", "accent", out);

  // Chunky ribbed mock-neck collar
  buildCollar(THREE, neck, bw, bh, "ribMock", ribMat, "top", out);
}

// ---------------------------------------------------------------------------
// 4. SHIRT (folded collar, placket, buttons, chest pocket, buttoned cuffs)
// ---------------------------------------------------------------------------

function wearShirt(THREE, rig, bw, bh, opts, kit, out) {
  const chest = rig.getObjectByName("chest");
  const neck = rig.getObjectByName("neck");

  const shirtMat = makeFabricMat(THREE, kit, "weave", opts.topColor, {
    repX: 4,
    repY: 4,
    bumpScale: 0.0016,
    roughness: 0.88,
    sheen: 0.45,
  });
  const btnMat = makeHardwareMat(THREE, opts.accent, false);

  // Tailored button-down bodice with curved shirttail hem
  const bod = makeBodiceEvaluator(THREE, bw, bh, {
    yBot: -0.068,
    easeHem: 0.011,
    easeWaist: 0.015,
    easeChest: 0.011,
    easeShoulder: 0.011,
    neckDipFront: 0.013,
    neckRad: 0.0355,
    shirttail: 0.010,
    hemFlare: 0.0025,
    drapeAmp: 0.0012,
  });
  const bodGeo = buildThickTube(THREE, bod.evalUV, 56, 28, {
    thick: 0.0038,
    rBot: 0.0026,
    rTop: 0.0022,
    uvScaleU: 2.2,
    uvScaleV: 2.2,
  });
  createAndAttach(THREE, chest, bodGeo, shirtMat, "top", out);

  if (chest) {
    // Crisp front placket strip down center front
    const evalPlacket = (u, v) => {
      const halfSpan = 0.135;
      const theta = lerp(-halfSpan, halfSpan, u);
      const vBod = lerp(0.015, 0.96, v);
      const base = bod.evalAtTheta(theta, vBod);
      const n = evalSurfaceNormal(THREE, bod.evalUV, ((theta / (Math.PI * 2)) + 1) % 1, vBod, true);
      return base.addScaledVector(n, 0.0044);
    };
    const plakGeo = buildThickPatch(THREE, evalPlacket, 8, 24, {
      thick: 0.0032,
      rEdge: 0.0018,
      uvScaleU: 0.3,
      uvScaleV: 2.2,
    });
    createAndAttach(THREE, chest, plakGeo, shirtMat, "top", out);

    // Five shirt buttons evenly spaced down the placket
    const btnGeo = buildButtonGeo(THREE, 0.0046, 0.0026);
    const btnVs = [0.16, 0.34, 0.52, 0.70, 0.88];
    for (const bv of btnVs) {
      const p = bod.evalAtTheta(0, bv);
      const n = evalSurfaceNormal(THREE, bod.evalUV, 0, bv, true);
      const pOut = p.clone().addScaledVector(n, 0.0056);
      const bMesh = createAndAttach(THREE, chest, btnGeo, btnMat, "accent", out, [pOut.x, pOut.y, pOut.z]);
      if (bMesh) bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    }

    // Left chest pocket with crisp pentagon-tapered bottom corners
    const evalPocket = (u, v) => {
      const centerT = 0.44;
      const taper = 1 - (1 - smoothstep(0, 0.24, v)) * 0.28;
      const halfW = 0.21 * taper;
      const theta = centerT + lerp(-halfW, halfW, u);
      const vBod = lerp(0.50, 0.71, v) - (1 - Math.abs(u * 2 - 1)) * 0.025 * (1 - smoothstep(0, 0.25, v));
      const base = bod.evalAtTheta(theta, vBod);
      const n = evalSurfaceNormal(THREE, bod.evalUV, ((theta / (Math.PI * 2)) + 1) % 1, vBod, true);
      const topFold = smoothstep(0.82, 1.0, v) * 0.0012;
      return base.addScaledVector(n, 0.0046 + topFold);
    };
    const pockGeo = buildThickPatch(THREE, evalPocket, 14, 14, {
      thick: 0.003,
      rEdge: 0.0018,
      uvScaleU: 0.6,
      uvScaleV: 0.6,
    });
    createAndAttach(THREE, chest, pockGeo, shirtMat, "top", out);
  }

  // Crisp long sleeves with elbow wrinkles & buttoned shirt cuffs
  buildSleeves(THREE, rig, bw, bh, {
    ease: 0.010,
    cuffStyle: "shirt",
    wrinkleAmp: 0.002,
    blouse: 0.0025,
  }, shirtMat, shirtMat, btnMat, "top", "accent", out);

  // Structured bent-Bezier folded shirt collar
  buildCollar(THREE, neck, bw, bh, "shirt", shirtMat, "top", out);
}

// ---------------------------------------------------------------------------
// 5. TEE (bodice, short sleeves on armL/armR, ribbed crew collar)
// ---------------------------------------------------------------------------

function wearTee(THREE, rig, bw, bh, opts, kit, out) {
  const chest = rig.getObjectByName("chest");
  const neck = rig.getObjectByName("neck");

  const teeMat = makeFabricMat(THREE, kit, "jersey", opts.topColor, { repX: 3.5, repY: 3.5, bumpScale: 0.0015 });
  const ribMat = makeFabricMat(THREE, kit, "rib", opts.topColor, { repX: 4, repY: 1.5, bumpScale: 0.0024 });

  const bod = makeBodiceEvaluator(THREE, bw, bh, {
    yBot: -0.064,
    easeHem: 0.012,
    easeWaist: 0.017,
    easeChest: 0.0115,
    easeShoulder: 0.011,
    neckDipFront: 0.023,
    neckRad: 0.037,
    hemFlare: 0.0035,
    drapeAmp: 0.0015,
  });
  const bodGeo = buildThickTube(THREE, bod.evalUV, 56, 28, {
    thick: 0.004,
    rBot: 0.0034,
    rTop: 0.0022,
    uvScaleU: 2,
    uvScaleV: 2,
  });
  createAndAttach(THREE, chest, bodGeo, teeMat, "top", out);

  // Short set-in sleeves on upper arms only
  buildSleeves(THREE, rig, bw, bh, {
    short: true,
    ease: 0.010,
    cuffStyle: "none",
  }, teeMat, null, null, "top", "accent", out);

  // Bent-Bezier crew neck collar
  buildCollar(THREE, neck, bw, bh, "crew", ribMat, "top", out);
}

// ---------------------------------------------------------------------------
// 6. BLAZER (structured shoulders, lapels, one button, flap pockets)
// ---------------------------------------------------------------------------

function wearBlazer(THREE, rig, bw, bh, opts, kit, out) {
  const chest = rig.getObjectByName("chest");
  const neck = rig.getObjectByName("neck");

  const blazerMat = makeFabricMat(THREE, kit, "twill", opts.topColor, {
    repX: 4,
    repY: 4,
    bumpScale: 0.002,
    roughness: 0.88,
    sheen: 0.52,
  });
  const innerMat = makeFabricMat(THREE, kit, "weave", opts.accent, { repX: 3.5, repY: 3.5, bumpScale: 0.0014 });
  const btnMat = makeHardwareMat(THREE, opts.accent, true);

  // Clean inner shirt/tee layer showing through the blazer V-opening
  const innerBod = makeBodiceEvaluator(THREE, bw, bh, {
    yBot: -0.062,
    easeHem: 0.0075,
    easeWaist: 0.010,
    easeChest: 0.0075,
    easeShoulder: 0.0075,
    neckDipFront: 0.020,
    neckRad: 0.0345,
    hemFlare: 0.001,
    drapeAmp: 0.0006,
  });
  const innerGeo = buildThickTube(THREE, innerBod.evalUV, 48, 22, {
    thick: 0.003,
    rBot: 0.002,
    rTop: 0.002,
    uvScaleU: 2,
    uvScaleV: 2,
  });
  createAndAttach(THREE, chest, innerGeo, innerMat, "accent", out);
  buildCollar(THREE, neck, bw, bh, "crew", innerMat, "accent", out);

  // Tailored open-front blazer silhouette: meets at waist button (v ≈ 0.34),
  // cutaway curves gently open below, crisp V-neck opening above
  const openGapFn = (v) => {
    const vBtn = 0.34;
    if (v < vBtn) {
      const t = (vBtn - v) / vBtn;
      return 0.045 + Math.pow(t, 1.7) * 0.25;
    }
    const t = (v - vBtn) / (1 - vBtn);
    const vOpen = smoothstep(0, 0.72, t) * 0.44;
    return 0.045 + vOpen;
  };

  const blazBod = makeBodiceEvaluator(THREE, bw, bh, {
    yBot: -0.078,
    easeHem: 0.017,
    easeWaist: 0.0185,
    easeChest: 0.0165,
    easeShoulder: 0.018,
    shoulderLift: 0.006 * bh,
    structuredShoulder: true,
    neckDipFront: 0.014,
    neckRad: 0.041,
    hemFlare: 0.003,
    drapeAmp: 0.0009,
    openGapFn,
  });
  const blazGeo = buildThickPatch(THREE, blazBod.evalUV, 56, 28, {
    thick: 0.0046,
    rEdge: 0.0026,
    uvScaleU: 2.4,
    uvScaleV: 2.2,
  });
  createAndAttach(THREE, chest, blazGeo, blazerMat, "top", out);

  if (chest) {
    // Sculpted notched lapels folding outward along the V-opening
    for (const side of [-1, 1]) {
      const evalLapel = (u, v) => {
        // v = 0 at waist button (vBod = 0.34), v = 1 at collar/shoulder join (vBod = 0.96)
        const vBod = lerp(0.34, 0.96, v);
        const gap = openGapFn(vBod);

        // Lapel angular width swells across chest, indents crisply at notch (v ≈ 0.76), meets collar
        const baseWidth = Math.sin(Math.pow(v, 0.85) * Math.PI) * 0.34 + 0.03;
        const notchCut = Math.exp(-Math.pow((v - 0.76) / 0.055, 2)) * 0.14;
        const topCollarFlare = smoothstep(0.78, 0.92, v) * (1 - smoothstep(0.92, 1.0, v)) * 0.12;
        const width = Math.max(0.025, baseWidth - notchCut + topCollarFlare);

        // Keep u increasing in +theta direction so normals always face outward
        const tInner = side > 0 ? gap - 0.01 : Math.PI * 2 - gap + 0.01;
        const tOuter = side > 0 ? gap + width : Math.PI * 2 - gap - width;
        const theta = side > 0 ? lerp(tInner, tOuter, u) : lerp(tOuter, tInner, u);

        const base = blazBod.evalAtTheta(theta, vBod);
        const n = evalSurfaceNormal(
          THREE,
          (uu, vv) => blazBod.evalAtTheta(uu * Math.PI * 2, vv),
          ((theta / (Math.PI * 2)) + 1) % 1,
          vBod,
          true
        );
        // Outer lapel edge lifts crisply off the chest for tailored shadow
        const outerFrac = side > 0 ? u : 1 - u;
        const lift = 0.0046 + outerFrac * 0.0036 * Math.sin(v * Math.PI);
        return base.addScaledVector(n, lift);
      };

      const lapelGeo = buildThickPatch(THREE, evalLapel, 14, 24, {
        thick: 0.0038,
        rEdge: 0.0022,
        uvScaleU: 0.8,
        uvScaleV: 1.6,
      });
      createAndAttach(THREE, chest, lapelGeo, blazerMat, "top", out);
    }

    // One prominent tailored button at the waist closure
    const btnGeo = buildButtonGeo(THREE, 0.0076, 0.0036);
    const pBtn = blazBod.evalAtTheta(0, 0.34);
    const nBtn = evalSurfaceNormal(THREE, (uu, vv) => blazBod.evalAtTheta(uu * Math.PI * 2, vv), 0, 0.34, true);
    const pOut = pBtn.clone().addScaledVector(nBtn, 0.0048);
    const bMesh = createAndAttach(THREE, chest, btnGeo, btnMat, "accent", out, [pOut.x, pOut.y, pOut.z]);
    if (bMesh) bMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nBtn);

    // Left and right hip-level flap pockets with crisp welt lips
    for (const side of [-1, 1]) {
      const centerT = side * 0.56;
      const halfSpan = 0.24;
      const evalFlap = (u, v) => {
        const theta = centerT + lerp(-halfSpan, halfSpan, u);
        // Gentle rounded bottom corners on flap
        const cornerRound = Math.pow(Math.abs(u * 2 - 1), 4) * 0.02 * (1 - v);
        const tilt = (u - 0.5) * side * 0.015;
        const vBod = lerp(0.11 + cornerRound, 0.21, v) + tilt;
        const base = blazBod.evalAtTheta(theta, vBod);
        const n = evalSurfaceNormal(
          THREE,
          (uu, vv) => blazBod.evalAtTheta(uu * Math.PI * 2, vv),
          ((theta / (Math.PI * 2)) + 1) % 1,
          vBod,
          true
        );
        // Overhang slightly more at bottom lip so the flap casts a clean crisp shadow
        const overhang = lerp(0.0074, 0.0046, v);
        return base.addScaledVector(n, overhang);
      };
      const flapGeo = buildThickPatch(THREE, evalFlap, 14, 10, {
        thick: 0.0034,
        rEdge: 0.002,
        uvScaleU: 0.7,
        uvScaleV: 0.4,
      });
      createAndAttach(THREE, chest, flapGeo, blazerMat, "top", out);

      // Subtle top pocket welt bar
      const evalWelt = (u, v) => {
        const theta = centerT + lerp(-halfSpan * 1.04, halfSpan * 1.04, u);
        const tilt = (u - 0.5) * side * 0.015;
        const vBod = lerp(0.206, 0.224, v) + tilt;
        const base = blazBod.evalAtTheta(theta, vBod);
        const n = evalSurfaceNormal(
          THREE,
          (uu, vv) => blazBod.evalAtTheta(uu * Math.PI * 2, vv),
          ((theta / (Math.PI * 2)) + 1) % 1,
          vBod,
          true
        );
        return base.addScaledVector(n, 0.0046);
      };
      const weltGeo = buildThickPatch(THREE, evalWelt, 12, 4, {
        thick: 0.0026,
        rEdge: 0.0014,
      });
      createAndAttach(THREE, chest, weltGeo, blazerMat, "top", out);
    }
  }

  // Tailored long sleeves with structured shoulder crowns & 2 decorative wrist buttons
  buildSleeves(THREE, rig, bw, bh, {
    ease: 0.0105,
    cuffStyle: "blazer",
    wrinkleAmp: 0.0018,
    structuredCap: true,
  }, blazerMat, null, btnMat, "top", "accent", out);

  // Bent-Bezier structured stand collar feeding into the lapels
  buildCollar(THREE, neck, bw, bh, "blazerStand", blazerMat, "top", out);
}

// ---------------------------------------------------------------------------
// Public Entry Point
// ---------------------------------------------------------------------------

export function wearTop(THREE, rig, opts = {}, kit) {
  const bw = clamp(opts.bodyWidth ?? 1.0, 0.8, 1.3);
  const bh = clamp(opts.bodyHeight ?? 1.0, 0.9, 1.1);
  const top = opts.top || "hoodie";
  const resolvedOpts = {
    top,
    topColor: opts.topColor || "#c85a6a",
    accent: opts.accent || "#f2e9df",
    bodyWidth: bw,
    bodyHeight: bh,
  };

  const added = [];
  switch (top) {
    case "hoodie":
      wearHoodie(THREE, rig, bw, bh, resolvedOpts, kit, added);
      break;
    case "cardigan":
      wearCardigan(THREE, rig, bw, bh, resolvedOpts, kit, added);
      break;
    case "sweater":
      wearSweater(THREE, rig, bw, bh, resolvedOpts, kit, added);
      break;
    case "shirt":
      wearShirt(THREE, rig, bw, bh, resolvedOpts, kit, added);
      break;
    case "tee":
      wearTee(THREE, rig, bw, bh, resolvedOpts, kit, added);
      break;
    case "blazer":
      wearBlazer(THREE, rig, bw, bh, resolvedOpts, kit, added);
      break;
    default:
      wearHoodie(THREE, rig, bw, bh, resolvedOpts, kit, added);
      break;
  }
  return added;
}
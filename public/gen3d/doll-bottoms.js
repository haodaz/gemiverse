// BOTTOMS module for the stylised BJD doll
// Exports: wearBottom(THREE, rig, opts, kit)

const TWO_PI = Math.PI * 2;

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

function fract(x) {
  return ((x % 1) + 1) % 1;
}

// Measure pivot offsets and actual pelvis body bounds (with exact spec fallbacks)
function measureRig(THREE, rig, bw, bh) {
  const pelvis = rig.getObjectByName("pelvis");
  const chest = rig.getObjectByName("chest");
  const legL = rig.getObjectByName("legL");
  const legR = rig.getObjectByName("legR");
  const shinL = rig.getObjectByName("shinL");
  const shinR = rig.getObjectByName("shinR");
  const footL = rig.getObjectByName("footL");
  const footR = rig.getObjectByName("footR");

  const waistY = chest && Math.abs(chest.position.y) > 0.01 ? chest.position.y : 0.095 * bh;
  const legX = legL && Math.abs(legL.position.x) > 0.01 ? Math.abs(legL.position.x) : 0.045 * bw;
  const thighLen = shinL && Math.abs(shinL.position.y) > 0.01 ? Math.abs(shinL.position.y) : 0.16 * bh;
  const shinLen = footL && Math.abs(footL.position.y) > 0.01 ? Math.abs(footL.position.y) : 0.16 * bh;

  // Spec defaults for pelvis & waist cross-sections
  let waistRx = 0.058 * bw;
  let waistRz = 0.064 * bw;
  let hipRx = 0.080 * bw;
  let hipRz = 0.075 * bw;

  // Probe existing body meshes under pelvis to match body depth interpretation cleanly
  if (pelvis) {
    rig.updateMatrixWorld(true);
    const invPelvis = new THREE.Matrix4().copy(pelvis.matrixWorld).invert();
    const toLocal = new THREE.Matrix4();
    const v = new THREE.Vector3();
    let maxWX = 0, maxWZ = 0, maxHX = 0, maxHZ = 0;

    const visit = (obj) => {
      if (obj === chest || obj === legL || obj === legR) return;
      if (obj.isMesh && obj.geometry && obj.geometry.attributes && obj.geometry.attributes.position) {
        const slot = obj.userData && obj.userData.slot;
        const isBody = !slot || slot === "skin" || slot === "body" || slot === "doll" || slot === "vinyl";
        if (isBody) {
          toLocal.multiplyMatrices(invPelvis, obj.matrixWorld);
          const pos = obj.geometry.attributes.position;
          const step = Math.max(1, Math.floor(pos.count / 600));
          for (let i = 0; i < pos.count; i += step) {
            v.fromBufferAttribute(pos, i).applyMatrix4(toLocal);
            const ax = Math.abs(v.x);
            const az = Math.abs(v.z);
            if (v.y >= waistY - 0.022 * bh && v.y <= waistY + 0.018 * bh) {
              if (ax > maxWX) maxWX = ax;
              if (az > maxWZ) maxWZ = az;
            }
            if (v.y >= -0.015 * bh && v.y <= 0.055 * bh) {
              if (ax > maxHX) maxHX = ax;
              if (az > maxHZ) maxHZ = az;
            }
          }
        }
      }
      for (let i = 0; i < obj.children.length; i++) visit(obj.children[i]);
    };
    visit(pelvis);

    if (maxWX > 0.03 * bw) waistRx = clamp(maxWX, 0.052 * bw, 0.078 * bw);
    if (maxWZ > 0.03 * bw) waistRz = clamp(maxWZ, 0.046 * bw, 0.076 * bw);
    if (maxHX > 0.04 * bw) hipRx = clamp(maxHX, 0.074 * bw, 0.094 * bw);
    if (maxHZ > 0.03 * bw) hipRz = clamp(maxHZ, 0.044 * bw, 0.082 * bw);
  }

  return {
    pelvis, chest, legL, legR, shinL, shinR, footL, footR,
    bw, bh, waistY, legX, thighLen, shinLen,
    waistRx, waistRz, hipRx, hipRz,
    thighTopR: 0.042 * bw,
    thighBotR: 0.032 * bw,
    shinTopR: 0.032 * bw,
    shinBotR: 0.022 * bw,
  };
}

// Painted procedural fabric maps (high-key neutral albedo so material.color themes cleanly)
function createFabricMaps(THREE, kit, kind, repX, repY) {
  const size = 256;

  const paint = (isBump) => {
    const tex = kit.canvasTexture(size, size, (ctx, w, h) => {
      if (isBump) {
        ctx.fillStyle = "#808080";
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.fillStyle = "#ececec";
        ctx.fillRect(0, 0, w, h);
      }

      // Soft organic cloth slub / wash variation from kit.noise
      const cell = 4;
      for (let y = 0; y < h; y += cell) {
        for (let x = 0; x < w; x += cell) {
          const nx = x / w;
          const ny = y / h;
          const n1 = kit.noise(nx * 6.0, ny * 6.0);
          const n2 = kit.noise(nx * 18.0 + 11.3, ny * 18.0 + 4.7);
          const n = n1 * 0.65 + n2 * 0.35;
          if (kind === "denim") {
            // Subtle stonewash fade & vertical warp slub
            const slub = kit.noise(nx * 36.0 + 2.1, ny * 4.0);
            const v = isBump
              ? Math.round(114 + n * 28 + slub * 14)
              : Math.round(218 + n * 24 + slub * 12);
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(x, y, cell, cell);
          } else if (kind === "knitRib") {
            const v = isBump
              ? Math.round(118 + n * 20)
              : Math.round(228 + n * 20);
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(x, y, cell, cell);
          } else {
            const v = isBump
              ? Math.round(120 + n * 16)
              : Math.round(230 + n * 18);
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(x, y, cell, cell);
          }
        }
      }

      if (kind === "denim") {
        // 3x1 diagonal denim twill ridges + subtle pale weft flecks
        ctx.lineWidth = 1.6;
        for (let i = -h; i < w + h; i += 4) {
          ctx.strokeStyle = isBump ? "rgba(215,215,215,0.42)" : "rgba(255,255,255,0.26)";
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + h, h);
          ctx.stroke();

          ctx.strokeStyle = isBump ? "rgba(45,45,45,0.36)" : "rgba(155,155,155,0.22)";
          ctx.beginPath();
          ctx.moveTo(i + 2, 0);
          ctx.lineTo(i + 2 + h, h);
          ctx.stroke();
        }
        // Horizontal pale weft specks
        ctx.fillStyle = isBump ? "rgba(180,180,180,0.22)" : "rgba(255,255,255,0.24)";
        for (let y = 0; y < h; y += 6) {
          for (let x = (y % 12 === 0 ? 0 : 4); x < w; x += 12) {
            if (kit.noise(x * 0.13, y * 0.17) > 0.45) {
              ctx.fillRect(x, y, 3, 1.5);
            }
          }
        }
        // Subtle stitched seam track along one edge of tile
        ctx.strokeStyle = isBump ? "rgba(245,245,245,0.65)" : "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(w * 0.5 - 3, 0);
        ctx.lineTo(w * 0.5 - 3, h);
        ctx.moveTo(w * 0.5 + 3, 0);
        ctx.lineTo(w * 0.5 + 3, h);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (kind === "knitRib") {
        // Soft vertical knit ribs with subtle chevron loops
        for (let x = 0; x < w; x += 4) {
          const ridge = (x % 8 === 0);
          ctx.fillStyle = isBump
            ? (ridge ? "rgba(210,210,210,0.45)" : "rgba(55,55,55,0.38)")
            : (ridge ? "rgba(255,255,255,0.22)" : "rgba(180,180,180,0.20)");
          ctx.fillRect(x, 0, 2, h);
        }
        ctx.strokeStyle = isBump ? "rgba(170,170,170,0.24)" : "rgba(245,245,245,0.16)";
        ctx.lineWidth = 1;
        for (let y = 0; y < h; y += 6) {
          ctx.beginPath();
          for (let x = 0; x < w; x += 8) {
            ctx.moveTo(x, y);
            ctx.lineTo(x + 4, y + 3);
            ctx.lineTo(x + 8, y);
          }
          ctx.stroke();
        }
      } else {
        // Fine suiting weave (crisp warp and weft crosshatch)
        for (let y = 0; y < h; y += 3) {
          ctx.fillStyle = isBump ? "rgba(190,190,190,0.28)" : "rgba(255,255,255,0.16)";
          ctx.fillRect(0, y, w, 1);
          ctx.fillStyle = isBump ? "rgba(70,70,70,0.22)" : "rgba(175,175,175,0.14)";
          ctx.fillRect(0, y + 1.5, w, 1);
        }
        for (let x = 0; x < w; x += 3) {
          ctx.fillStyle = isBump ? "rgba(185,185,185,0.25)" : "rgba(255,255,255,0.14)";
          ctx.fillRect(x, 0, 1, h);
        }
      }
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repX, repY);
    if (!isBump && "colorSpace" in tex) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    tex.needsUpdate = true;
    return tex;
  };

  return { map: paint(false), bumpMap: paint(true) };
}

function createMaterials(THREE, kit, bottomStyle, bottomColor, accentColor) {
  const baseCol = new THREE.Color(bottomColor || "#3c4e6b");
  const accCol = new THREE.Color(accentColor || "#d9c298");

  const fabricKind =
    bottomStyle === "jeans" || bottomStyle === "shorts"
      ? "denim"
      : bottomStyle === "longSkirt"
      ? "knitRib"
      : "fineWeave";

  const rep = fabricKind === "denim" ? [3.5, 4.5] : fabricKind === "knitRib" ? [7, 5] : [6, 5];
  const mainMaps = createFabricMaps(THREE, kit, fabricKind, rep[0], rep[1]);
  const fineMaps = createFabricMaps(THREE, kit, "fineWeave", 4, 4);

  const sheenCol = baseCol.clone().lerp(new THREE.Color(0xffffff), 0.38);
  const accSheen = accCol.clone().lerp(new THREE.Color(0xffffff), 0.35);

  const mainMat = new THREE.MeshPhysicalMaterial({
    color: baseCol,
    map: mainMaps.map,
    bumpMap: mainMaps.bumpMap,
    bumpScale: fabricKind === "denim" ? 0.0028 : fabricKind === "knitRib" ? 0.0022 : 0.0014,
    roughness: 0.9,
    metalness: 0.0,
    sheen: 0.5,
    sheenRoughness: 0.72,
    sheenColor: sheenCol,
  });

  // Slightly lighter weft-side denim for turned-up jeans cuffs
  const cuffCol = baseCol.clone().lerp(new THREE.Color(0xeef1f5), 0.34);
  const cuffMat = new THREE.MeshPhysicalMaterial({
    color: cuffCol,
    map: mainMaps.map,
    bumpMap: mainMaps.bumpMap,
    bumpScale: 0.0026,
    roughness: 0.9,
    metalness: 0.0,
    sheen: 0.5,
    sheenRoughness: 0.75,
    sheenColor: cuffCol.clone().lerp(new THREE.Color(0xffffff), 0.3),
  });

  const accentClothMat = new THREE.MeshPhysicalMaterial({
    color: accCol,
    map: fineMaps.map,
    bumpMap: fineMaps.bumpMap,
    bumpScale: 0.0012,
    roughness: 0.88,
    metalness: 0.0,
    sheen: 0.5,
    sheenRoughness: 0.65,
    sheenColor: accSheen,
  });

  const hardwareMat = new THREE.MeshPhysicalMaterial({
    color: accCol,
    roughness: 0.28,
    metalness: 0.76,
    clearcoat: 0.35,
    clearcoatRoughness: 0.22,
  });

  return { mainMat, cuffMat, accentClothMat, hardwareMat };
}

function registerMesh(parent, geometry, material, slot, list) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.slot = slot;
  parent.add(mesh);
  list.push(mesh);
  return mesh;
}

// Smoothly average normals along UV wrap seam (u=0 / u=uSegs) and closed profile loop (v=0 / v=last)
function fixClosedGridNormals(geom, uSegs, vRows) {
  geom.computeVertexNormals();
  const nAttr = geom.attributes.normal;
  const stride = uSegs + 1;

  for (let j = 0; j < vRows; j++) {
    const i0 = j * stride;
    const i1 = j * stride + uSegs;
    let nx = nAttr.getX(i0) + nAttr.getX(i1);
    let ny = nAttr.getY(i0) + nAttr.getY(i1);
    let nz = nAttr.getZ(i0) + nAttr.getZ(i1);
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    nAttr.setXYZ(i0, nx, ny, nz);
    nAttr.setXYZ(i1, nx, ny, nz);
  }

  const lastRow = (vRows - 1) * stride;
  for (let i = 0; i <= uSegs; i++) {
    const i0 = i;
    const i1 = lastRow + i;
    let nx = nAttr.getX(i0) + nAttr.getX(i1);
    let ny = nAttr.getY(i0) + nAttr.getY(i1);
    let nz = nAttr.getZ(i0) + nAttr.getZ(i1);
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    nAttr.setXYZ(i0, nx, ny, nz);
    nAttr.setXYZ(i1, nx, ny, nz);
  }

  nAttr.needsUpdate = true;
}

// Universal closed thick-shell builder:
// outer wall -> rolled bottom hem (radius ~0.004) -> inner wall -> rolled top rim -> closed loop
function buildClosedShell(THREE, cfg) {
  const uSegs = cfg.uSegs || 48;
  const outerSteps = cfg.outerSteps || 18;
  const innerSteps = cfg.innerSteps || 10;
  const hemSteps = cfg.hemSteps || 5;
  const topSteps = cfg.topSteps || 3;
  const hemR = cfg.hemRadius !== undefined ? cfg.hemRadius : 0.0038;
  const topR = cfg.topRadius !== undefined ? cfg.topRadius : 0.0022;
  const sampleOuter = cfg.sampleOuter;
  const sampleCenter = cfg.sampleCenter || (() => ({ x: 0, z: 0 }));
  const uvScaleU = cfg.uvScaleU || 1;
  const uvScaleV = cfg.uvScaleV || 1;

  const dth = 0.004;

  // Compute local horizontal inward unit vector (blend cross-section normal + radial inward)
  function inwardDir(theta, t, pOut) {
    const pPrev = sampleOuter(theta - dth, t);
    const pNext = sampleOuter(theta + dth, t);
    const tx = pNext.x - pPrev.x;
    const tz = pNext.z - pPrev.z;
    const tLen = Math.hypot(tx, tz) || 1;
    // Outward tangent is (+tx, +tz); inward normal is (+tz, -tx)
    const nx = tz / tLen;
    const nz = -tx / tLen;

    const c = sampleCenter(t);
    const rx = c.x - pOut.x;
    const rz = c.z - pOut.z;
    const rLen = Math.hypot(rx, rz) || 1;
    const rux = rx / rLen;
    const ruz = rz / rLen;

    const bx = nx * 0.72 + rux * 0.28;
    const bz = nz * 0.72 + ruz * 0.28;
    const bLen = Math.hypot(bx, bz) || 1;
    return { ix: bx / bLen, iz: bz / bLen };
  }

  function thickAt(t) {
    return lerp(topR * 2, hemR * 2, smoothstep(0.0, 1.0, t));
  }

  // Build meridional ring list
  const rings = [];
  const ringV = [];

  // 1. Outer wall from top (t=0) to bottom (t=1)
  for (let s = 0; s <= outerSteps; s++) {
    const t = s / outerSteps;
    rings.push({ kind: "outer", t });
    ringV.push(t);
  }
  // 2. Rolled bottom hem (semicircle from outer to inner)
  for (let s = 1; s < hemSteps; s++) {
    const alpha = (Math.PI * s) / hemSteps;
    rings.push({ kind: "hem", alpha });
    ringV.push(1.0 + 0.04 * (s / hemSteps));
  }
  // 3. Inner wall from bottom (t=1) back up to top (t=0)
  for (let s = 0; s <= innerSteps; s++) {
    const t = 1 - s / innerSteps;
    rings.push({ kind: "inner", t });
    ringV.push(1.04 + (1 - t));
  }
  // 4. Rolled top rim (semicircle from inner back to outer) + closing ring at outer top
  for (let s = 1; s <= topSteps; s++) {
    const alpha = Math.PI * (1 - s / topSteps);
    rings.push({ kind: "top", alpha });
    ringV.push(2.04 + 0.04 * (s / topSteps));
  }

  const vRows = rings.length;
  const stride = uSegs + 1;
  const positions = new Float32Array(vRows * stride * 3);
  const uvs = new Float32Array(vRows * stride * 2);

  for (let i = 0; i <= uSegs; i++) {
    const uFrac = i / uSegs;
    const theta = uFrac * TWO_PI;

    // Precompute bottom & top endpoints for rolled rims
    const pBotOut = sampleOuter(theta, 1);
    const inBot = inwardDir(theta, 1, pBotOut);
    const thBot = thickAt(1);
    const rH = thBot * 0.5;
    const mBotX = pBotOut.x + inBot.ix * rH;
    const mBotZ = pBotOut.z + inBot.iz * rH;

    const pTopOut = sampleOuter(theta, 0);
    const inTop = inwardDir(theta, 0, pTopOut);
    const thTop = thickAt(0);
    const rT = thTop * 0.5;
    const mTopX = pTopOut.x + inTop.ix * rT;
    const mTopZ = pTopOut.z + inTop.iz * rT;

    for (let j = 0; j < vRows; j++) {
      const r = rings[j];
      let px, py, pz;
      if (r.kind === "outer") {
        const p = sampleOuter(theta, r.t);
        px = p.x; py = p.y; pz = p.z;
      } else if (r.kind === "hem") {
        const c = Math.cos(r.alpha);
        const s = Math.sin(r.alpha);
        px = mBotX - inBot.ix * (rH * c);
        py = pBotOut.y - rH * s;
        pz = mBotZ - inBot.iz * (rH * c);
      } else if (r.kind === "inner") {
        const p = sampleOuter(theta, r.t);
        const dir = inwardDir(theta, r.t, p);
        const th = thickAt(r.t);
        px = p.x + dir.ix * th;
        py = p.y;
        pz = p.z + dir.iz * th;
      } else {
        // top rolled rim
        const c = Math.cos(r.alpha);
        const s = Math.sin(r.alpha);
        px = mTopX - inTop.ix * (rT * c);
        py = pTopOut.y + rT * s;
        pz = mTopZ - inTop.iz * (rT * c);
      }

      const idx = j * stride + i;
      positions[idx * 3] = px;
      positions[idx * 3 + 1] = py;
      positions[idx * 3 + 2] = pz;
      uvs[idx * 2] = uFrac * uvScaleU;
      uvs[idx * 2 + 1] = ringV[j] * uvScaleV;
    }
  }

  const indices = [];
  for (let j = 0; j < vRows - 1; j++) {
    for (let i = 0; i < uSegs; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  fixClosedGridNormals(geom, uSegs, vRows);
  return geom;
}

// Smooth closed tube along a 3D point sequence (for seams, fly line, stitching, drawstrings)
function buildSeamTube(THREE, points, radius, radialSegs = 32) {
  const curve = new THREE.CatmullRomCurve3(points);
  const tubularSegs = Math.max(16, points.length * 4);
  const geom = new THREE.TubeGeometry(curve, tubularSegs, radius, radialSegs, false);
  geom.computeVertexNormals();
  return geom;
}

// Sculpted 3D patch pocket conforming directly to a parametric surface sampleOuter(theta, t)
function buildPatchPocket(THREE, sampleOuter, cfg) {
  const { thetaCenter, thetaHalf, tTop, tBot, depth = 0.0046, uSegs = 16, vSegs = 14 } = cfg;
  const dth = 0.004;

  function outNormal(theta, t, p) {
    const p1 = sampleOuter(theta - dth, t);
    const p2 = sampleOuter(theta + dth, t);
    const tx = p2.x - p1.x;
    const tz = p2.z - p1.z;
    const len = Math.hypot(tx, tz) || 1;
    // Outward normal in XZ is (-tz, tx)
    return { nx: -tz / len, nz: tx / len };
  }

  // Rounded-pentagon pocket shape: top flat, bottom tapers to gentle point
  function shapeMask(u, v) {
    // u in [-1, 1], v in [0, 1] (0=top, 1=bottom)
    const widthAtV = v < 0.68 ? 1.0 : lerp(1.0, 0.22, smoothstep(0.68, 1.0, v));
    const au = Math.abs(u) / widthAtV;
    const edgeU = 1 - smoothstep(0.86, 1.0, au);
    const edgeTop = smoothstep(0.0, 0.1, v);
    const edgeBot = 1 - smoothstep(0.9, 1.0, v);
    return edgeU * edgeTop * edgeBot;
  }

  const stride = uSegs + 1;
  const vRows = vSegs + 1;
  const positions = new Float32Array(vRows * stride * 3);
  const uvs = new Float32Array(vRows * stride * 2);

  for (let j = 0; j <= vSegs; j++) {
    const vf = j / vSegs;
    const t = lerp(tTop, tBot, vf);
    const widthAtV = vf < 0.68 ? 1.0 : lerp(1.0, 0.24, smoothstep(0.68, 1.0, vf));
    for (let i = 0; i <= uSegs; i++) {
      const uf = (i / uSegs) * 2 - 1;
      const theta = thetaCenter + uf * thetaHalf * widthAtV;
      const p = sampleOuter(theta, t);
      const n = outNormal(theta, t, p);
      // Beveled edges drop back cleanly to surface, main face stands proud by `depth`
      const m = shapeMask(uf * widthAtV, vf);
      const lift = lerp(-0.0005, depth, Math.pow(m, 0.45));
      const idx = j * stride + i;
      positions[idx * 3] = p.x + n.nx * lift;
      positions[idx * 3 + 1] = p.y;
      positions[idx * 3 + 2] = p.z + n.nz * lift;
      uvs[idx * 2] = i / uSegs;
      uvs[idx * 2 + 1] = vf;
    }
  }

  const indices = [];
  for (let j = 0; j < vSegs; j++) {
    for (let i = 0; i < uSegs; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

// Sculpted closed crotch-bridge gusset connecting front & back center beneath pelvis
function buildCrotchGusset(THREE, m) {
  const { bw, bh } = m;
  const uSegs = 24;
  const vSegs = 24;
  const stride = uSegs + 1;
  const vRows = vSegs + 1;
  const positions = new Float32Array(vRows * stride * 3);
  const uvs = new Float32Array(vRows * stride * 2);

  const zFront = Math.max(m.hipRz, 0.044 * bw) + 0.002;
  const zBack = Math.max(m.hipRz, 0.046 * bw) + 0.004;

  for (let j = 0; j <= vSegs; j++) {
    const s = j / vSegs; // 0 = front, 0.5 = bottom crotch, 1 = back
    const arch = Math.sin(s * Math.PI);
    const zCenter = lerp(zFront * 0.72, -zBack * 0.74, s);
    const yCenter = lerp(-0.014 * bh, -0.036 * bh, Math.pow(arch, 0.8));
    const halfW = lerp(0.025 * bw, 0.015 * bw, arch);
    const thick = 0.0055;

    for (let i = 0; i <= uSegs; i++) {
      const phi = (i / uSegs) * TWO_PI;
      const px = Math.cos(phi) * halfW;
      const py = yCenter + Math.sin(phi) * thick;
      const pz = zCenter;
      const idx = j * stride + i;
      positions[idx * 3] = px;
      positions[idx * 3 + 1] = py;
      positions[idx * 3 + 2] = pz;
      uvs[idx * 2] = i / uSegs;
      uvs[idx * 2 + 1] = s;
    }
  }

  const indices = [];
  for (let j = 0; j < vSegs; j++) {
    for (let i = 0; i < uSegs; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  fixClosedGridNormals(geom, uSegs, vRows);
  return geom;
}

// Smooth round button or rivet (32 radial segments)
function buildButtonMesh(THREE, parent, pos, normalDir, radius, height, mat, slot, meshes) {
  const geom = new THREE.CylinderGeometry(radius * 0.92, radius, height, 32, 2);
  // Gently dome the top face
  const p = geom.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > 0) {
      const r = Math.hypot(p.getX(i), p.getZ(i)) / radius;
      p.setY(i, y + height * 0.45 * (1 - r * r));
    }
  }
  geom.computeVertexNormals();
  const mesh = registerMesh(parent, geom, mat, slot, meshes);
  mesh.position.copy(pos);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normalDir.clone().normalize());
  return mesh;
}

// Belt loops positioned cleanly around waistband
function addBeltLoops(THREE, pelvis, sampleWB, bh, mat, meshes) {
  const angles = [0.56, -0.56, 1.57, -1.57, Math.PI];
  for (let k = 0; k < angles.length; k++) {
    const th = angles[k];
    const pts = [];
    const steps = 8;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const p = sampleWB(th, lerp(-0.08, 1.08, t));
      const len = Math.hypot(p.x, p.z) || 1;
      const arch = Math.sin(t * Math.PI);
      const lift = 0.0015 + 0.0048 * arch;
      pts.push(new THREE.Vector3(p.x + (p.x / len) * lift, p.y, p.z + (p.z / len) * lift));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const loopGeom = new THREE.TubeGeometry(curve, 16, 0.0028, 32, false);
    // Flatten loop slightly into a cloth strap
    loopGeom.scale(1, 1, 1);
    loopGeom.computeVertexNormals();
    registerMesh(pelvis, loopGeom, mat, "bottom", meshes);
  }
}

// Cute sculpted front bow/tie for the long skirt waistband
function addWaistBow(THREE, pelvis, centerPos, bw, mat, meshes) {
  const bowGroup = new THREE.Group();
  bowGroup.position.copy(centerPos);
  pelvis.add(bowGroup);

  // Center knot
  const knotGeom = new THREE.SphereGeometry(0.0065, 32, 16);
  knotGeom.scale(1.15, 0.9, 0.85);
  registerMesh(bowGroup, knotGeom, mat, "accent", meshes);

  // Two ribbon loops & dangling tails
  for (const s of [-1, 1]) {
    const loopPts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(s * 0.014 * bw, 0.009, 0.006),
      new THREE.Vector3(s * 0.024 * bw, 0.002, 0.003),
      new THREE.Vector3(s * 0.015 * bw, -0.007, 0.004),
      new THREE.Vector3(0, -0.001, 0),
    ];
    const loopGeom = buildSeamTube(THREE, loopPts, 0.0036, 32);
    registerMesh(bowGroup, loopGeom, mat, "accent", meshes);

    const tailPts = [
      new THREE.Vector3(s * 0.002, -0.002, 0.001),
      new THREE.Vector3(s * 0.009 * bw, -0.018, 0.006),
      new THREE.Vector3(s * 0.015 * bw, -0.038, 0.009),
      new THREE.Vector3(s * 0.018 * bw, -0.056, 0.008),
    ];
    const tailGeom = buildSeamTube(THREE, tailPts, 0.0028, 32);
    registerMesh(bowGroup, tailGeom, mat, "accent", meshes);
  }
}

// Shared waistband builder on "pelvis"
function buildWaistband(THREE, m, mats, style, meshes) {
  const { pelvis, bw, bh, waistY, waistRx, waistRz, hipRx, hipRz } = m;
  const isGathered = style === "longSkirt";
  const yTop = waistY + (isGathered ? 0.015 : 0.012) * bh;
  const yBot = waistY - (isGathered ? 0.025 : 0.022) * bh;

  const sampleWB = (theta, t) => {
    const ct = clamp(t, 0, 1);
    const y = lerp(yTop, yBot, t);
    const hipBlend = smoothstep(0, 1, ct) * 0.24;
    let rx = lerp(waistRx, hipRx, hipBlend) + 0.011;
    let rz = lerp(waistRz, hipRz, hipBlend) + 0.011;
    if (isGathered) {
      // Soft elastic shirring ripples
      const ripple = 0.0016 * Math.sin(theta * 18) * Math.sin(ct * Math.PI);
      rx += ripple;
      rz += ripple;
    }
    return {
      x: Math.sin(theta) * rx,
      y,
      z: Math.cos(theta) * rz,
    };
  };

  const wbGeom = buildClosedShell(THREE, {
    uSegs: 64,
    outerSteps: 10,
    innerSteps: 6,
    hemSteps: 4,
    topSteps: 4,
    hemRadius: 0.0032,
    topRadius: 0.0032,
    sampleOuter: sampleWB,
    uvScaleU: 1.0,
    uvScaleV: 0.25,
  });
  registerMesh(pelvis, wbGeom, mats.mainMat, "bottom", meshes);

  // Style-specific waistband embellishments
  if (style === "pleatedSkirt") {
    // Neat side button on left hip of waistband
    const pSide = sampleWB(Math.PI * 0.46, 0.48);
    const pos = new THREE.Vector3(pSide.x + 0.0015, pSide.y, pSide.z);
    buildButtonMesh(THREE, pelvis, pos, new THREE.Vector3(pSide.x, 0, pSide.z), 0.0052, 0.0032, mats.hardwareMat, "accent", meshes);
  } else if (style === "longSkirt") {
    const pFront = sampleWB(0, 0.5);
    addWaistBow(THREE, pelvis, new THREE.Vector3(pFront.x, pFront.y, pFront.z + 0.0045), bw, mats.accentClothMat, meshes);
  } else {
    // Trousers, jeans, shorts: 5 belt loops + center-front button
    addBeltLoops(THREE, pelvis, sampleWB, bh, mats.mainMat, meshes);
    const pFront = sampleWB(0, 0.48);
    const btnR = style === "trousers" ? 0.0055 : 0.0068;
    buildButtonMesh(
      THREE,
      pelvis,
      new THREE.Vector3(pFront.x, pFront.y, pFront.z + 0.0022),
      new THREE.Vector3(0, 0, 1),
      btnR,
      0.0038,
      mats.hardwareMat,
      "accent",
      meshes
    );
  }

  return { sampleWB, yBot };
}

// Knife-pleat profile: crisp fold + flat panel in [-1, +1]
function knifePleatProfile(theta, numPleats) {
  const p = fract((theta / TWO_PI) * numPleats);
  if (p < 0.06) {
    // Smooth inner trough
    const u = p / 0.06;
    return -1.0 + 0.08 * u * u;
  } else if (p < 0.78) {
    // Flat crisp panel
    const u = (p - 0.06) / 0.72;
    return lerp(-0.92, 0.92, u);
  } else if (p < 0.84) {
    // Crisp outer fold ridge
    const u = (p - 0.78) / 0.06;
    return 0.92 + 0.08 * Math.sin(u * Math.PI);
  } else if (p < 0.96) {
    // Steep folded under-tuck
    const u = (p - 0.84) / 0.12;
    return lerp(0.92, -0.92, u);
  } else {
    const u = (p - 0.96) / 0.04;
    return -0.92 - 0.08 * (1 - (1 - u) * (1 - u));
  }
}

// 1. PLEATED SKIRT on "pelvis"
function buildPleatedSkirt(THREE, m, mats, wbInfo, meshes) {
  const { pelvis, bw, bh, waistRx, waistRz, hipRx, hipRz, thighLen } = m;
  const numPleats = 14;
  const yTop = wbInfo.yBot + 0.006 * bh;
  const yBot = -thighLen * 0.54; // Mid-thigh hem

  const baseWaistRx = waistRx + 0.011;
  const baseWaistRz = waistRz + 0.011;
  const hemRx = baseWaistRx * 2.3;
  const hemRz = baseWaistRz * 2.3;

  const sampleOuter = (theta, t) => {
    // Smoothly clear the hips, then flare out to 2.3x waist radius
    const flare = Math.pow(t, 1.12);
    const hipCurve = Math.sin(Math.min(1, t * 1.4) * Math.PI) * 0.012 * bw;
    const baseRx = Math.max(lerp(baseWaistRx, hemRx, flare) + hipCurve, lerp(hipRx + 0.013, hemRx, t));
    const baseRz = Math.max(lerp(baseWaistRz, hemRz, flare) + hipCurve, lerp(hipRz + 0.013, hemRz, t));

    const pleat = knifePleatProfile(theta, numPleats);
    const pleatDepth = (0.0022 + 0.0165 * Math.pow(t, 1.32)) * bw;

    // Slight tangential fold shear gives genuine overlapping knife-pleat shading
    const shear = 0.022 * Math.pow(t, 1.4) * pleat;
    const th = theta + shear;

    const rx = baseRx + pleat * pleatDepth;
    const rz = baseRz + pleat * pleatDepth;

    // Slightly wavy mid-thigh hem
    const hemWave =
      (0.0045 * Math.sin(theta * numPleats + 0.4) +
        0.0038 * Math.sin(theta * 3 + 0.8) +
        0.0026 * Math.cos(theta * 2 - 0.5)) *
      bh *
      t *
      t;

    return {
      x: Math.sin(th) * rx,
      y: lerp(yTop, yBot, t) + hemWave,
      z: Math.cos(th) * rz,
    };
  };

  const geom = buildClosedShell(THREE, {
    uSegs: numPleats * 8, // 112 segments: crisp knife folds with zero faceting
    outerSteps: 20,
    innerSteps: 14,
    hemSteps: 5,
    topSteps: 3,
    hemRadius: 0.0038,
    topRadius: 0.0022,
    sampleOuter,
    uvScaleU: 1.6,
    uvScaleV: 0.9,
  });
  registerMesh(pelvis, geom, mats.mainMat, "bottom", meshes);
}

// 2. LONG SKIRT on "pelvis"
function buildLongSkirt(THREE, m, mats, wbInfo, kit, meshes) {
  const { pelvis, bw, bh, waistRx, waistRz, hipRx, hipRz, thighLen, shinLen } = m;
  const yTop = wbInfo.yBot + 0.006 * bh;
  const yBot = -(thighLen + shinLen * 0.52); // Mid-shin hem

  const topRx = waistRx + 0.012;
  const topRz = waistRz + 0.012;
  const hemRx = hipRx * 1.92 + 0.014;
  const hemRz = hipRz * 1.92 + 0.014;

  const sampleOuter = (theta, t) => {
    // Graceful A-line profile clearing hips and legs generously
    const hipBulge = smoothstep(0.0, 0.24, t) * (1 - smoothstep(0.24, 0.65, t)) * 0.014 * bw;
    const flare = Math.pow(t, 0.88);
    const baseRx = Math.max(lerp(topRx, hemRx, flare) + hipBulge, lerp(hipRx + 0.014, hemRx, t));
    const baseRz = Math.max(lerp(topRz, hemRz, flare) + hipBulge, lerp(hipRz + 0.014, hemRz, t));

    // Soft organic vertical drapery folds with gentle gravitational sway
    const sway = 0.07 * Math.sin(theta * 3 - 0.5) * t;
    const th = theta + sway;
    const nFold = kit.noise(Math.cos(th) * 1.6 + 3.1, Math.sin(th) * 1.6 + 2.4) - 0.5;
    const foldWave =
      0.46 * Math.sin(th * 7 + 0.4) +
      0.32 * Math.sin(th * 11 - 1.1) +
      0.22 * Math.cos(th * 5 + 1.9) +
      0.16 * Math.sin(th * 14 + 0.2) +
      0.35 * nFold;

    const foldAmp = (0.0038 + 0.0165 * Math.pow(t, 1.15)) * bw;
    const rx = baseRx + foldWave * foldAmp;
    const rz = baseRz + foldWave * foldAmp;

    // Gentle undulating hem driven by the folds
    const hemRipple = (0.0052 * foldWave + 0.003 * Math.cos(theta * 2 + 0.6)) * bh * t * t;

    return {
      x: Math.sin(theta) * rx,
      y: lerp(yTop, yBot, t) + hemRipple,
      z: Math.cos(theta) * rz,
    };
  };

  const geom = buildClosedShell(THREE, {
    uSegs: 80,
    outerSteps: 28,
    innerSteps: 16,
    hemSteps: 5,
    topSteps: 3,
    hemRadius: 0.0040,
    topRadius: 0.0024,
    sampleOuter,
    uvScaleU: 1.5,
    uvScaleV: 1.5,
  });
  registerMesh(pelvis, geom, mats.mainMat, "bottom", meshes);
}

// 3. SEAT SHELL on "pelvis" (shared for trousers, jeans, shorts)
function buildSeat(THREE, m, mats, wbInfo, style, meshes) {
  const { pelvis, bw, bh, waistRx, waistRz, hipRx, hipRz, legX, thighTopR } = m;
  const isJeansLike = style === "jeans" || style === "shorts";

  const yTop = wbInfo.yBot + 0.006 * bh;
  const minSeatRx = Math.max(hipRx + 0.012, legX + thighTopR + 0.013);
  const minSeatRz = Math.max(hipRz + 0.011, thighTopR + 0.014);

  const sampleSeat = (theta, t) => {
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    const cos2 = cosT * cosT;

    // Lower hem arches slightly up on outer hips and dips down at front/back crotch
    const yBotAtTheta = (-0.015 - 0.018 * cos2) * bh;
    const y = lerp(yTop, yBotAtTheta, t);

    const hipEase = smoothstep(0.0, 0.72, t);
    let rx = lerp(waistRx + 0.011, minSeatRx, hipEase);
    let rz = lerp(waistRz + 0.011, minSeatRz, hipEase);

    // Subtle anatomical seat fullness in back + slight center crotch-seam pinch
    const isBack = Math.max(0, -cosT);
    const backFullness = 0.0055 * bw * isBack * Math.sin(t * Math.PI) * (0.4 + 0.6 * Math.abs(sinT));
    const crotchPinch = 0.0085 * bw * Math.pow(Math.abs(cosT), 6) * smoothstep(0.55, 1.0, t);
    const centerCrease = 0.0026 * Math.pow(Math.abs(cosT), 14) * smoothstep(0.18, 1.0, t);

    // Tailored trouser front darts
    let dart = 0;
    if (style === "trousers" && cosT > 0.35) {
      const dAngle = Math.abs(Math.abs(theta) - 0.36);
      dart = 0.0022 * Math.exp(-dAngle * dAngle * 60) * Math.sin(t * Math.PI);
    }

    rx += 0;
    rz += backFullness - crotchPinch - centerCrease + dart;

    return {
      x: sinT * rx,
      y,
      z: cosT * rz,
    };
  };

  // Main thick closed seat shell
  const seatGeom = buildClosedShell(THREE, {
    uSegs: 64,
    outerSteps: 16,
    innerSteps: 10,
    hemSteps: 4,
    topSteps: 3,
    hemRadius: 0.0034,
    topRadius: 0.0022,
    sampleOuter: sampleSeat,
    uvScaleU: 1.2,
    uvScaleV: 0.6,
  });
  registerMesh(pelvis, seatGeom, mats.mainMat, "bottom", meshes);

  // Sculpted closed crotch bridge underneath pelvis
  const gussetGeom = buildCrotchGusset(THREE, m);
  registerMesh(pelvis, gussetGeom, mats.mainMat, "bottom", meshes);

  // Crotch seam welt running from front fly, underneath crotch, and up center back
  const seamPts = [];
  for (let i = 0; i <= 8; i++) {
    const t = lerp(0.55, 1.0, i / 8);
    const p = sampleSeat(0, t);
    seamPts.push(new THREE.Vector3(0, p.y, p.z + 0.0014));
  }
  seamPts.push(new THREE.Vector3(0, -0.0405 * bh, 0.012 * bw));
  seamPts.push(new THREE.Vector3(0, -0.0415 * bh, -0.012 * bw));
  for (let i = 0; i <= 10; i++) {
    const t = lerp(1.0, 0.04, i / 10);
    const p = sampleSeat(Math.PI, t);
    seamPts.push(new THREE.Vector3(0, p.y, p.z - 0.0014));
  }
  const crotchSeamGeom = buildSeamTube(THREE, seamPts, 0.0017, 32);
  registerMesh(pelvis, crotchSeamGeom, isJeansLike ? mats.accentClothMat : mats.mainMat, isJeansLike ? "accent" : "bottom", meshes);

  // Center-front J-shaped fly line
  const flyPts = [];
  for (let i = 0; i <= 10; i++) {
    const s = i / 10;
    const t = lerp(0.02, 0.62, s);
    const jCurve = s < 0.72 ? 0.14 : lerp(0.14, 0.0, smoothstep(0.72, 1.0, s));
    const p = sampleSeat(jCurve, t);
    flyPts.push(new THREE.Vector3(p.x, p.y, p.z + 0.0016));
  }
  const flyGeom = buildSeamTube(THREE, flyPts, 0.0014, 32);
  registerMesh(pelvis, flyGeom, isJeansLike ? mats.accentClothMat : mats.mainMat, isJeansLike ? "accent" : "bottom", meshes);

  // Center fly edge welt
  const flyCenterPts = [];
  for (let i = 0; i <= 8; i++) {
    const t = lerp(0.02, 0.58, i / 8);
    const p = sampleSeat(0.01, t);
    flyCenterPts.push(new THREE.Vector3(p.x, p.y, p.z + 0.0015));
  }
  registerMesh(pelvis, buildSeamTube(THREE, flyCenterPts, 0.0015, 32), mats.mainMat, "bottom", meshes);

  if (isJeansLike) {
    // Scoop front pockets + metallic corner rivets
    for (const s of [-1, 1]) {
      const scoopPts = [];
      for (let i = 0; i <= 10; i++) {
        const f = i / 10;
        const th = s * lerp(0.46, 1.38, f);
        const t = lerp(0.04, 0.44, Math.sin(f * Math.PI * 0.55));
        const p = sampleSeat(th, t);
        const len = Math.hypot(p.x, p.z) || 1;
        scoopPts.push(new THREE.Vector3(p.x + (p.x / len) * 0.0018, p.y, p.z + (p.z / len) * 0.0018));
      }
      registerMesh(pelvis, buildSeamTube(THREE, scoopPts, 0.0016, 32), mats.accentClothMat, "accent", meshes);

      // Corner metallic rivets
      for (const idx of [0, scoopPts.length - 1]) {
        const rp = scoopPts[idx];
        const norm = new THREE.Vector3(rp.x, 0, rp.z).normalize();
        buildButtonMesh(THREE, pelvis, rp.clone().addScaledVector(norm, 0.001), norm, 0.0026, 0.0018, mats.hardwareMat, "accent", meshes);
      }
    }

    // Back patch pockets + stitched V-arcuate
    for (const s of [-1, 1]) {
      const thCenter = Math.PI + s * 0.52;
      const pocketGeom = buildPatchPocket(THREE, sampleSeat, {
        thetaCenter: thCenter,
        thetaHalf: 0.34,
        tTop: 0.22,
        tBot: 0.78,
        depth: 0.0044,
      });
      registerMesh(pelvis, pocketGeom, mats.mainMat, "bottom", meshes);

      // Decorative contrast stitching arc across pocket face
      const arcPts = [];
      for (let i = 0; i <= 8; i++) {
        const u = (i / 8) * 2 - 1;
        const th = thCenter + u * 0.28;
        const t = 0.48 + (1 - Math.abs(u)) * 0.12;
        const p = sampleSeat(th, t);
        const len = Math.hypot(p.x, p.z) || 1;
        arcPts.push(new THREE.Vector3(p.x + (p.x / len) * 0.0048, p.y, p.z + (p.z / len) * 0.0048));
      }
      registerMesh(pelvis, buildSeamTube(THREE, arcPts, 0.0012, 32), mats.accentClothMat, "accent", meshes);
    }

    // Back V-yoke seam below waistband
    const yokePts = [];
    for (let i = 0; i <= 14; i++) {
      const u = (i / 14) * 2 - 1;
      const th = Math.PI + u * 1.45;
      const t = lerp(0.18, 0.06, Math.abs(u));
      const p = sampleSeat(th, t);
      const len = Math.hypot(p.x, p.z) || 1;
      yokePts.push(new THREE.Vector3(p.x + (p.x / len) * 0.0014, p.y, p.z + (p.z / len) * 0.0014));
    }
    registerMesh(pelvis, buildSeamTube(THREE, yokePts, 0.0013, 32), mats.accentClothMat, "accent", meshes);
  } else {
    // Trousers: diagonal slash side-pocket welts + sleek back welt pockets
    for (const s of [-1, 1]) {
      const slashPts = [];
      for (let i = 0; i <= 8; i++) {
        const f = i / 8;
        const th = s * lerp(0.88, 1.38, f);
        const t = lerp(0.06, 0.56, f);
        const p = sampleSeat(th, t);
        const len = Math.hypot(p.x, p.z) || 1;
        slashPts.push(new THREE.Vector3(p.x + (p.x / len) * 0.0016, p.y, p.z + (p.z / len) * 0.0016));
      }
      registerMesh(pelvis, buildSeamTube(THREE, slashPts, 0.0016, 32), mats.mainMat, "bottom", meshes);

      // Rear welt pocket + tiny accent button
      const weltPts = [];
      for (let i = 0; i <= 6; i++) {
        const u = (i / 6) * 2 - 1;
        const th = Math.PI + s * 0.52 + u * 0.24;
        const p = sampleSeat(th, 0.28);
        const len = Math.hypot(p.x, p.z) || 1;
        weltPts.push(new THREE.Vector3(p.x + (p.x / len) * 0.0018, p.y, p.z + (p.z / len) * 0.0018));
      }
      registerMesh(pelvis, buildSeamTube(THREE, weltPts, 0.0018, 32), mats.mainMat, "bottom", meshes);
      const mid = weltPts[3];
      const norm = new THREE.Vector3(mid.x, 0, mid.z).normalize();
      buildButtonMesh(THREE, pelvis, mid.clone().addScaledVector(norm, 0.0016).add(new THREE.Vector3(0, -0.003, 0)), norm, 0.0028, 0.0018, mats.hardwareMat, "accent", meshes);
    }
  }
}

// 4. LEG TUBE BUILDER (thigh on legL/legR, shin on shinL/shinR)
function buildLegTube(THREE, m, mats, opts, meshes) {
  const { pivot, side, segment, style } = opts;
  const { bw, bh, legX, thighLen, shinLen, thighTopR, thighBotR, shinTopR, shinBotR } = m;
  const isThigh = segment === "thigh";
  const isShorts = style === "shorts";
  const isTrousers = style === "trousers";
  const isJeans = style === "jeans";

  // Vertical range in pivot local space
  const yTop = isThigh ? 0.020 * bh : 0.018 * bh;
  const yBot = isThigh
    ? isShorts
      ? -thighLen * 0.47
      : -thighLen - 0.012 * bh
    : -shinLen + 0.008 * bh;

  const sampleOuter = (theta, t) => {
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    const y = lerp(yTop, yBot, t);

    // Body radius along the segment
    let bodyR;
    if (isThigh) {
      const frac = clamp(-y / thighLen, 0, 1);
      bodyR = lerp(thighTopR, thighBotR, frac);
    } else {
      const frac = clamp(-y / shinLen, 0, 1);
      bodyR = lerp(shinTopR, shinBotR, frac);
    }

    // Cloth offset from skin (slightly looser at hems & knee overlaps)
    let offset;
    if (isThigh) {
      const hemLoose = isShorts ? 0.0135 : 0.0165;
      offset = lerp(0.0085, hemLoose, smoothstep(0.15, 1.0, t));
      // Smoothly round top cap inward so it tucks cleanly inside the seat shell (>= 0.0045 gap)
      if (t < 0.16) {
        const cap = 1 - smoothstep(0.0, 0.16, t);
        offset -= cap * 0.0045;
      }
    } else {
      // Shin tube: tucked knee cap slightly narrower so thigh tube overlaps with >= 0.0045 gap
      const ankleLoose = isTrousers ? 0.0155 : 0.0135;
      offset = lerp(0.0085, ankleLoose, smoothstep(0.14, 1.0, t));
      if (t < 0.16) {
        const cap = 1 - smoothstep(0.0, 0.16, t);
        offset -= cap * 0.0038;
      }
    }

    let r = bodyR + offset;

    // Prevent left/right thigh tubes from overlapping each other near the crotch midline
    if (isThigh) {
      const medial = Math.max(0, -side * sinT);
      const topZone = 1 - smoothstep(0.0, 0.65, t);
      const maxMedial = legX - 0.0018;
      if (medial > 0.01 && r > maxMedial) {
        r = lerp(r, maxMedial, medial * medial * topZone);
      }
    }

    // Pressed crisp front & back creases for tailored trousers
    if (isTrousers) {
      const frontCrease = Math.pow(Math.max(0, cosT), 10);
      const backCrease = Math.pow(Math.max(0, -cosT), 10);
      const fadeEnds = smoothstep(0.08, 0.22, t);
      r += (0.0052 * frontCrease + 0.0038 * backCrease) * fadeEnds;
    }

    // Horizontal compression folds behind the knee (lower thigh + upper shin)
    if (!isShorts) {
      const backMask = Math.pow(Math.max(0, -cosT), 1.6);
      if (isThigh && t > 0.65) {
        const w = smoothstep(0.65, 0.85, t) * (1 - smoothstep(0.94, 1.0, t));
        const foldAmp = isJeans ? 0.0042 : 0.0032;
        r += foldAmp * backMask * Math.sin((t - 0.65) * 28.0) * w;
      } else if (!isThigh && t < 0.34) {
        const w = smoothstep(0.06, 0.14, t) * (1 - smoothstep(0.24, 0.34, t));
        const foldAmp = isJeans ? 0.0040 : 0.0030;
        r += foldAmp * backMask * Math.sin(t * 32.0) * w;
      }

      // Horizontal pooling/compression folds at the ankle
      if (!isThigh && t > 0.66) {
        const w = smoothstep(0.66, 0.80, t) * (1 - smoothstep(0.95, 1.0, t));
        const frontBreak = 0.55 + 0.45 * Math.max(0, cosT);
        const foldAmp = isJeans ? 0.0038 : 0.0032;
        r += foldAmp * frontBreak * Math.sin((t - 0.66) * 34.0) * w;
      }
    } else {
      // Subtle soft wear ripples near upper hip on shorts
      const hipRipple = 0.0014 * Math.sin(t * 14 + cosT * 2.5) * smoothstep(0.15, 0.5, t) * (1 - t);
      r += hipRipple;
    }

    return {
      x: sinT * r,
      y,
      z: cosT * r,
    };
  };

  const geom = buildClosedShell(THREE, {
    uSegs: 48,
    outerSteps: isShorts ? 14 : 22,
    innerSteps: 10,
    hemSteps: 5,
    topSteps: 3,
    hemRadius: isShorts ? 0.0036 : 0.0038,
    topRadius: 0.0022,
    sampleOuter,
    uvScaleU: 0.85,
    uvScaleV: isShorts ? 0.55 : 1.0,
  });
  registerMesh(pivot, geom, mats.mainMat, "bottom", meshes);

  // Outer side seam & inseam welts for jeans (and crisp outer seam for shorts)
  if (isJeans || isShorts) {
    const outerTh = side > 0 ? Math.PI * 0.5 : Math.PI * 1.5;
    const tStart = isThigh ? 0.22 : 0.12;
    const tEnd = isJeans && !isThigh ? 0.86 : 0.96;

    const buildLine = (th, offset, rad, mat, slot) => {
      const pts = [];
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const t = lerp(tStart, tEnd, i / steps);
        const p = sampleOuter(th, t);
        const len = Math.hypot(p.x, p.z) || 1;
        pts.push(new THREE.Vector3(p.x + (p.x / len) * offset, p.y, p.z + (p.z / len) * offset));
      }
      registerMesh(pivot, buildSeamTube(THREE, pts, rad, 32), mat, slot, meshes);
    };

    // Double-stitched outer side seam
    buildLine(outerTh - 0.04, 0.0012, 0.0012, mats.accentClothMat, "accent");
    buildLine(outerTh + 0.04, 0.0012, 0.0012, mats.accentClothMat, "accent");

    // Inseam welt on jeans
    if (isJeans) {
      const innerTh = side > 0 ? Math.PI * 1.5 : Math.PI * 0.5;
      buildLine(innerTh, 0.0010, 0.0012, mats.mainMat, "bottom");
    }
  }

  // Turned-up / rolled cuffs for jeans ankles and shorts hems
  if ((isJeans && !isThigh) || (isShorts && isThigh)) {
    buildRolledCuff(THREE, pivot, side, sampleOuter, isJeans ? mats.cuffMat : mats.mainMat, mats.accentClothMat, isJeans, bh, meshes);
  }
}

// 5. TURNED-UP / ROLLED CUFF (jeans ankle cuffs & shorts rolled cuffs)
function buildRolledCuff(THREE, pivot, side, sampleLeg, cuffMat, stitchMat, isJeans, bh, meshes) {
  const cuffH = (isJeans ? 0.028 : 0.019) * bh;
  const tBot = 0.99;
  const pRefBot = sampleLeg(0, tBot);
  const yBot = pRefBot.y - 0.0022;
  const yTop = yBot + cuffH;

  // Compute approximate t on the leg corresponding to height y
  const pRefTop = sampleLeg(0, 0.72);
  const tSpan = (tBot - 0.72) / Math.max(0.001, pRefTop.y - pRefBot.y);

  const sampleCuff = (theta, t) => {
    const y = lerp(yTop, yBot, t);
    const legT = clamp(tBot - (y - pRefBot.y) * tSpan, 0.5, 1.0);
    const p = sampleLeg(theta, legT);
    const len = Math.hypot(p.x, p.z) || 1;
    // Soft plush barrel profile for rolled cloth, offset >= 0.0048 outside leg surface
    const puff = Math.sin(t * Math.PI) * (isJeans ? 0.0018 : 0.0026);
    const radialPush = (isJeans ? 0.0052 : 0.0056) + puff;
    return {
      x: p.x + (p.x / len) * radialPush,
      y,
      z: p.z + (p.z / len) * radialPush,
    };
  };

  const geom = buildClosedShell(THREE, {
    uSegs: 48,
    outerSteps: 10,
    innerSteps: 6,
    hemSteps: 5,
    topSteps: 5,
    hemRadius: 0.0040,
    topRadius: 0.0034,
    sampleOuter: sampleCuff,
    uvScaleU: 0.9,
    uvScaleV: 0.22,
  });
  registerMesh(pivot, geom, cuffMat, "bottom", meshes);

  // Subtle side-seam cuff-tack stitch holding the turned-up cuff in place
  const outerTh = side > 0 ? Math.PI * 0.5 : Math.PI * 1.5;
  const tackPts = [];
  for (let i = 0; i <= 5; i++) {
    const p = sampleCuff(outerTh, lerp(0.18, 0.85, i / 5));
    const len = Math.hypot(p.x, p.z) || 1;
    tackPts.push(new THREE.Vector3(p.x + (p.x / len) * 0.0012, p.y, p.z + (p.z / len) * 0.0012));
  }
  registerMesh(pivot, buildSeamTube(THREE, tackPts, 0.0012, 32), stitchMat, "accent", meshes);
}

// MAIN EXPORT
export function wearBottom(THREE, rig, opts, kit) {
  const safeOpts = opts || {};
  const style = safeOpts.bottom || "pleatedSkirt";
  const bw = clamp(safeOpts.bodyWidth !== undefined ? safeOpts.bodyWidth : 1.0, 0.8, 1.3);
  const bh = clamp(safeOpts.bodyHeight !== undefined ? safeOpts.bodyHeight : 1.0, 0.9, 1.1);

  const m = measureRig(THREE, rig, bw, bh);
  const mats = createMaterials(THREE, kit, style, safeOpts.bottomColor, safeOpts.accent);
  const meshes = [];

  if (!m.pelvis) return meshes;

  // Every style gets a tailored waistband on "pelvis"
  const wbInfo = buildWaistband(THREE, m, mats, style, meshes);

  if (style === "pleatedSkirt") {
    buildPleatedSkirt(THREE, m, mats, wbInfo, meshes);
  } else if (style === "longSkirt") {
    buildLongSkirt(THREE, m, mats, wbInfo, kit, meshes);
  } else if (style === "trousers" || style === "jeans" || style === "shorts") {
    buildSeat(THREE, m, mats, wbInfo, style, meshes);

    if (m.legL) {
      buildLegTube(THREE, m, mats, { pivot: m.legL, side: 1, segment: "thigh", style }, meshes);
    }
    if (m.legR) {
      buildLegTube(THREE, m, mats, { pivot: m.legR, side: -1, segment: "thigh", style }, meshes);
    }

    if (style === "trousers" || style === "jeans") {
      if (m.shinL) {
        buildLegTube(THREE, m, mats, { pivot: m.shinL, side: 1, segment: "shin", style }, meshes);
      }
      if (m.shinR) {
        buildLegTube(THREE, m, mats, { pivot: m.shinR, side: -1, segment: "shin", style }, meshes);
      }
    }
  } else {
    // Fallback to pleated skirt if an unknown bottom name is passed
    buildPleatedSkirt(THREE, m, mats, wbInfo, meshes);
  }

  return meshes;
}
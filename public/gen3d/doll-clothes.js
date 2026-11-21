```js
export function dress(THREE, rig, opts = {}, kit) {
  const cfg = {
    top: opts.top ?? "hoodie",
    topColor: opts.topColor ?? "#d98996",
    bottom: opts.bottom ?? "pleatedSkirt",
    bottomColor: opts.bottomColor ?? "#323d52",
    shoes: opts.shoes ?? "maryJanes",
    shoeColor: opts.shoeColor ?? "#3b2624",
    socks: opts.socks ?? "knee",
    sockColor: opts.sockColor ?? "#f4efe8",
    accent: opts.accent ?? "#e8c47a",
    bodyWidth: clamp(opts.bodyWidth ?? 1.0, 0.8, 1.3),
    bodyHeight: clamp(opts.bodyHeight ?? 1.0, 0.9, 1.1)
  };

  const pivots = {
    root: rig,
    pelvis: rig.getObjectByName("pelvis"),
    chest: rig.getObjectByName("chest"),
    neck: rig.getObjectByName("neck"),
    armL: rig.getObjectByName("armL"),
    armR: rig.getObjectByName("armR"),
    forearmL: rig.getObjectByName("forearmL"),
    forearmR: rig.getObjectByName("forearmR"),
    legL: rig.getObjectByName("legL"),
    legR: rig.getObjectByName("legR"),
    shinL: rig.getObjectByName("shinL"),
    shinR: rig.getObjectByName("shinR"),
    footL: rig.getObjectByName("footL"),
    footR: rig.getObjectByName("footR")
  };

  const metrics = computeMetrics(THREE, pivots, cfg.bodyWidth, cfg.bodyHeight);
  const added = [];
  const texCache = new Map();

  const ctx = {
    THREE,
    kit,
    cfg,
    pivots,
    metrics,
    added,
    texCache
  };

  // Build bottom first so tops and boots coordinate clearances seamlessly
  const bottomInfo = buildBottom(ctx);
  buildTop(ctx, bottomInfo);
  buildSocks(ctx);
  buildShoes(ctx, bottomInfo);

  return added;
}

/* ============================================================================
 * MATH & RIG METRICS
 * ========================================================================== */

const PIVOT_NAMES = new Set([
  "root", "pelvis", "chest", "neck", "head",
  "armL", "armR", "forearmL", "forearmR", "handL", "handR",
  "legL", "legR", "shinL", "shinR", "footL", "footR"
]);

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
}

function evalStations(stations, y) {
  if (y <= stations[0][0]) return [stations[0][1], stations[0][2]];
  const last = stations.length - 1;
  if (y >= stations[last][0]) return [stations[last][1], stations[last][2]];
  for (let i = 0; i < last; i++) {
    const a = stations[i];
    const b = stations[i + 1];
    if (y >= a[0] && y <= b[0]) {
      const t = smoothstep(a[0], b[0], y);
      return [lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
    }
  }
  return [stations[last][1], stations[last][2]];
}

function measureDirectBounds(THREE, pivot) {
  if (!pivot) return null;
  const box = new THREE.Box3();
  let found = false;

  const visit = (obj, mat) => {
    for (const child of obj.children) {
      if (PIVOT_NAMES.has(child.name)) continue;
      child.updateMatrix();
      const childMat = mat ? mat.clone().multiply(child.matrix) : child.matrix.clone();
      if (child.isMesh && child.geometry) {
        if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
        if (child.geometry.boundingBox && !child.geometry.boundingBox.isEmpty()) {
          const b = child.geometry.boundingBox.clone().applyMatrix4(childMat);
          box.union(b);
          found = true;
        }
      }
      if (child.children && child.children.length > 0) {
        visit(child, childMat);
      }
    }
  };

  visit(pivot, null);
  return found ? box : null;
}

function computeMetrics(THREE, pivots, bw, bh) {
  const chestBox = measureDirectBounds(THREE, pivots.chest);
  const pelvisBox = measureDirectBounds(THREE, pivots.pelvis);
  const footBox = measureDirectBounds(THREE, pivots.footL) || measureDirectBounds(THREE, pivots.footR);

  // Measure torso depth safely if meshes exist, else use spec defaults
  const measuredChestZ = chestBox
    ? Math.max(Math.abs(chestBox.min.z), Math.abs(chestBox.max.z))
    : 0;
  const measuredPelvisZ = pelvisBox
    ? Math.max(Math.abs(pelvisBox.min.z), Math.abs(pelvisBox.max.z))
    : 0;

  const pelvisRZ = clamp(measuredPelvisZ || 0.068 * bw, 0.048 * bw, 0.078 * bw);
  const chestRZ = clamp(measuredChestZ || 0.064 * bw, 0.046 * bw, 0.076 * bw);
  const waistRZ = clamp(Math.min(pelvisRZ, chestRZ) * 0.84, 0.051 * bw, 0.064 * bw);

  // Foot metrics in footL/footR local space
  const footMinY = footBox ? clamp(footBox.min.y, -0.075 * bh, -0.032 * bh) : -0.065 * bh;
  const footMaxY = footBox ? clamp(footBox.max.y, footMinY + 0.030, -0.005) : footMinY + 0.040;
  const footMinZ = footBox ? clamp(footBox.min.z, -0.042, -0.014) : -0.024;
  const footMaxZ = footBox ? clamp(footBox.max.z, 0.048, 0.078) : 0.061;
  const footHalfW = footBox
    ? clamp((footBox.max.x - footBox.min.x) * 0.5, 0.017 * bw, 0.028 * bw)
    : 0.021 * bw;

  return {
    bw,
    bh,
    waistYInPelvis: 0.095 * bh,
    hipHalfW: 0.080 * bw,
    pelvisRZ,
    waistHalfW: 0.058 * bw,
    waistRZ,
    shoulderHalfW: 0.085 * bw,
    chestRZ,
    neckR: 0.028 * bw,
    neckYInChest: 0.16 * bh,
    shoulderYInChest: 0.135 * bh,
    armX: 0.105 * bw,
    upperArmLen: 0.12 * bh,
    forearmLen: 0.11 * bh,
    upperArmTopR: 0.026 * bw,
    elbowR: 0.022 * bw,
    wristR: 0.017 * bw,
    shoulderBallR: 0.028 * bw,
    legX: 0.045 * bw,
    thighLen: 0.16 * bh,
    shinLen: 0.16 * bh,
    hipBallR: 0.040 * bw,
    thighTopR: 0.042 * bw,
    kneeR: 0.032 * bw,
    ankleR: 0.022 * bw,
    footMinY,
    footMaxY,
    footMinZ,
    footMaxZ,
    footHalfW,
    torsoProfile(yInChest) {
      const stations = [
        [-0.095 * bh, 0.080 * bw, pelvisRZ],
        [-0.055 * bh, 0.078 * bw, pelvisRZ * 0.96],
        [-0.022 * bh, 0.066 * bw, lerp(pelvisRZ, waistRZ, 0.65)],
        [0.000 * bh, 0.058 * bw, waistRZ],
        [0.055 * bh, 0.072 * bw, lerp(waistRZ, chestRZ, 0.72)],
        [0.105 * bh, 0.083 * bw, chestRZ],
        [0.140 * bh, 0.086 * bw, chestRZ * 0.86],
        [0.158 * bh, 0.035 * bw, 0.034 * bw]
      ];
      return evalStations(stations, yInChest);
    },
    pelvisProfile(yInPelvis) {
      const stations = [
        [-0.035 * bh, 0.084 * bw, Math.max(pelvisRZ * 0.78, 0.044 * bw)],
        [0.000 * bh, 0.082 * bw, pelvisRZ],
        [0.035 * bh, 0.079 * bw, pelvisRZ * 0.96],
        [0.070 * bh, 0.067 * bw, lerp(pelvisRZ, waistRZ, 0.65)],
        [0.095 * bh, 0.058 * bw, waistRZ],
        [0.115 * bh, 0.060 * bw, waistRZ * 1.02]
      ];
      return evalStations(stations, yInPelvis);
    }
  };
}

/* ============================================================================
 * TEXTURE & MATERIAL FACTORY
 * ========================================================================== */

function getFabricTextures(ctx, style) {
  if (ctx.texCache.has(style)) return ctx.texCache.get(style);
  const { THREE, kit } = ctx;
  const size = 256;

  const paint = (isBump) => {
    const tex = kit.canvasTexture(size, size, (c, w, h) => {
      const baseLum = isBump ? 128 : 236;
      c.fillStyle = `rgb(${baseLum},${baseLum},${baseLum})`;
      c.fillRect(0, 0, w, h);

      if (style === "knit" || style === "rib" || style === "ribSock") {
        const cols = style === "rib" ? 32 : style === "ribSock" ? 40 : 22;
        const rows = style === "rib" ? 36 : style === "ribSock" ? 48 : 30;
        const colW = w / cols;
        const rowH = h / rows;

        // Vertical rib channel shading
        for (let i = 0; i < cols; i++) {
          const x = i * colW;
          const isWideRib = style === "knit" ? (i % 2 === 0) : true;
          const grad = c.createLinearGradient(x, 0, x + colW, 0);
          if (isBump) {
            grad.addColorStop(0.0, "rgb(70,70,70)");
            grad.addColorStop(0.25, isWideRib ? "rgb(205,205,205)" : "rgb(150,150,150)");
            grad.addColorStop(0.5, isWideRib ? "rgb(235,235,235)" : "rgb(165,165,165)");
            grad.addColorStop(0.75, isWideRib ? "rgb(205,205,205)" : "rgb(150,150,150)");
            grad.addColorStop(1.0, "rgb(70,70,70)");
          } else {
            grad.addColorStop(0.0, "rgb(198,198,198)");
            grad.addColorStop(0.28, isWideRib ? "rgb(246,246,246)" : "rgb(228,228,228)");
            grad.addColorStop(0.5, isWideRib ? "rgb(252,252,252)" : "rgb(234,234,234)");
            grad.addColorStop(0.72, isWideRib ? "rgb(246,246,246)" : "rgb(228,228,228)");
            grad.addColorStop(1.0, "rgb(198,198,198)");
          }
          c.fillStyle = grad;
          c.fillRect(x, 0, colW + 0.5, h);
        }

        // V-shaped knit stitch loops
        c.lineCap = "round";
        for (let i = 0; i < cols; i++) {
          const cx = (i + 0.5) * colW;
          for (let j = 0; j < rows; j++) {
            const cy = (j + 0.5) * rowH;
            const n = kit.noise(i * 0.37, j * 0.41);
            const hl = isBump ? Math.round(185 + n * 55) : Math.round(235 + n * 18);
            const sh = isBump ? Math.round(85 + n * 35) : Math.round(202 + n * 16);

            c.strokeStyle = `rgb(${sh},${sh},${sh})`;
            c.lineWidth = Math.max(1, colW * 0.14);
            c.beginPath();
            c.moveTo(cx - colW * 0.34, cy - rowH * 0.38);
            c.lineTo(cx, cy + rowH * 0.28);
            c.lineTo(cx + colW * 0.34, cy - rowH * 0.38);
            c.stroke();

            c.strokeStyle = `rgb(${hl},${hl},${hl})`;
            c.lineWidth = Math.max(1, colW * 0.18);
            c.beginPath();
            c.moveTo(cx - colW * 0.28, cy - rowH * 0.24);
            c.lineTo(cx, cy + rowH * 0.34);
            c.lineTo(cx + colW * 0.28, cy - rowH * 0.24);
            c.stroke();
          }
        }
      } else if (style === "denim") {
        // 2x1 diagonal denim twill + organic slub + stitched seam guides
        const step = 4;
        for (let y = 0; y < h; y += step) {
          for (let x = 0; x < w; x += step) {
            const diag = ((x + y) / step) % 3;
            const slub = kit.noise(x * 0.04, y * 0.14);
            const weft = kit.noise(x * 0.19, y * 0.05);
            let lum;
            if (isBump) {
              lum = diag < 1.2 ? 175 + slub * 45 : 95 + weft * 35;
            } else {
              lum = diag < 0.9 ? 248 - slub * 12 : 212 + slub * 22 + weft * 10;
            }
            const v = Math.round(clamp(lum, 50, 255));
            c.fillStyle = `rgb(${v},${v},${v})`;
            c.fillRect(x, y, step, step);
          }
        }
        // Subtle fine diagonal twill lines
        c.strokeStyle = isBump ? "rgba(220,220,220,0.35)" : "rgba(255,255,255,0.22)";
        c.lineWidth = 1.2;
        for (let k = -h; k < w + h; k += 6) {
          c.beginPath();
          c.moveTo(k, 0);
          c.lineTo(k + h, h);
          c.stroke();
        }
        // Double topstitched seam lines at edges of tile
        const seamX = [6, 12];
        for (const sx of seamX) {
          c.strokeStyle = isBump ? "rgb(235,235,235)" : "rgb(235,205,148)";
          c.lineWidth = 1.6;
          c.setLineDash([5, 3]);
          c.beginPath();
          c.moveTo(sx, 0);
          c.lineTo(sx, h);
          c.stroke();
          c.setLineDash([]);
        }
      } else if (style === "fleece") {
        // Soft brushed cotton fleece / French terry
        const step = 4;
        for (let y = 0; y < h; y += step) {
          for (let x = 0; x < w; x += step) {
            const n1 = kit.noise(x * 0.09, y * 0.09);
            const n2 = kit.noise(x * 0.27 + 11, y * 0.27 + 7);
            const v = isBump
              ? Math.round(95 + n1 * 70 + n2 * 45)
              : Math.round(220 + n1 * 20 + n2 * 14);
            c.fillStyle = `rgb(${v},${v},${v})`;
            c.fillRect(x, y, step, step);
          }
        }
        // Subtle vertical micro-wale
        c.fillStyle = isBump ? "rgba(180,180,180,0.18)" : "rgba(255,255,255,0.12)";
        for (let x = 0; x < w; x += 6) {
          c.fillRect(x, 0, 2, h);
        }
      } else if (style === "suiting") {
        // Fine tailored herringbone / worsted wool
        const step = 4;
        for (let y = 0; y < h; y += step) {
          for (let x = 0; x < w; x += step) {
            const band = Math.floor(x / 16) % 2;
            const d = band === 0 ? ((x + y) / step) % 4 : ((x - y + 256) / step) % 4;
            const n = kit.noise(x * 0.11, y * 0.11);
            const lum = isBump
              ? (d < 2 ? 165 : 100) + (n - 0.5) * 35
              : (d < 2 ? 242 : 222) + (n - 0.5) * 14;
            const v = Math.round(clamp(lum, 50, 255));
            c.fillStyle = `rgb(${v},${v},${v})`;
            c.fillRect(x, y, step, step);
          }
        }
      } else if (style === "weave" || style === "jersey" || style === "canvas") {
        // Plain cotton weave / fine jersey / sneaker canvas
        const step = style === "canvas" ? 4 : 3;
        for (let y = 0; y < h; y += step) {
          for (let x = 0; x < w; x += step) {
            const ix = Math.floor(x / step);
            const iy = Math.floor(y / step);
            const checker = (ix + iy) % 2 === 0;
            const n = kit.noise(x * 0.12, y * 0.12);
            const contrast = style === "canvas" ? 36 : style === "jersey" ? 16 : 24;
            const lum = isBump
              ? 128 + (checker ? contrast : -contrast) + (n - 0.5) * 28
              : 235 + (checker ? contrast * 0.35 : -contrast * 0.35) + (n - 0.5) * 14;
            const v = Math.round(clamp(lum, 50, 255));
            c.fillStyle = `rgb(${v},${v},${v})`;
            c.fillRect(x, y, step, step);
          }
        }
      } else if (style === "leather") {
        // Fine pebble grain leather
        const step = 4;
        for (let y = 0; y < h; y += step) {
          for (let x = 0; x < w; x += step) {
            const n1 = kit.noise(x * 0.16, y * 0.16);
            const n2 = kit.noise(x * 0.35 + 5, y * 0.35 + 3);
            const lum = isBump
              ? 100 + n1 * 65 + n2 * 30
              : 230 + n1 * 16 + n2 * 8;
            const v = Math.round(clamp(lum, 60, 255));
            c.fillStyle = `rgb(${v},${v},${v})`;
            c.fillRect(x, y, step, step);
          }
        }
      }
    });

    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    if (!isBump && THREE.SRGBColorSpace) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    return tex;
  };

  const pair = { map: paint(false), bumpMap: paint(true) };
  ctx.texCache.set(style, pair);
  return pair;
}

function makeMaterial(ctx, params) {
  const { THREE } = ctx;
  const color = new THREE.Color(params.color ?? "#cccccc");
  const isFabric = params.isFabric !== false;
  const matOpts = {
    color,
    roughness: params.roughness ?? (isFabric ? 0.9 : 0.35),
    metalness: params.metalness ?? 0.0,
    sheen: params.sheen ?? (isFabric ? 0.5 : 0.0),
    sheenRoughness: params.sheenRoughness ?? 0.72,
    clearcoat: params.clearcoat ?? 0.0,
    clearcoatRoughness: params.clearcoatRoughness ?? 0.2
  };

  if (isFabric || (params.sheen ?? 0) > 0) {
    const sheenCol = color.clone().lerp(new THREE.Color("#ffffff"), 0.45);
    matOpts.sheenColor = sheenCol;
  }

  if (params.style) {
    const pair = getFabricTextures(ctx, params.style);
    const map = pair.map.clone();
    const bumpMap = pair.bumpMap.clone();
    map.needsUpdate = true;
    bumpMap.needsUpdate = true;
    const ru = params.repeatU ?? 4;
    const rv = params.repeatV ?? 4;
    map.repeat.set(ru, rv);
    bumpMap.repeat.set(ru, rv);
    matOpts.map = map;
    matOpts.bumpMap = bumpMap;
    matOpts.bumpScale = params.bumpScale ?? (isFabric ? 0.0028 : 0.0012);
  }

  return new THREE.MeshPhysicalMaterial(matOpts);
}

function addMesh(ctx, parent, geometry, material, slot, name) {
  if (!parent || !geometry) return null;
  const mesh = new ctx.THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.slot = slot;
  if (name) mesh.name = name;
  parent.add(mesh);
  ctx.added.push(mesh);
  return mesh;
}

/* ============================================================================
 * THICK CLOSED SHELL & SCULPTED GEOMETRY BUILDERS
 * ========================================================================== */

/**
 * Builds a watertight, thick closed garment shell with outer wall, rolled bottom hem,
 * full inner wall, and rolled top rim. Supports both closed tubes (closedU = true)
 * and open front/draped shells (closedU = false) with rounded vertical end caps.
 *
 * evalFn(u, v) returns [x, y, z] where u in [0, 1] runs around circumference
 * (theta: 0 = +z front, PI/2 = +x left, PI = -z back, 3PI/2 = -x right)
 * and v in [0, 1] runs from top rim (0) to bottom hem (1).
 */
function buildThickTube(THREE, options) {
  const {
    uSegs = 48,
    vSegs = 24,
    thickness = 0.0048,
    rollRadius = 0.0038,
    topRollRadius = rollRadius * 0.85,
    closedU = true,
    radialNormalBlend = 0.0,
    uvScaleU = 1,
    uvScaleV = 1,
    evalFn
  } = options;

  const cols = uSegs + 1;
  const rollSteps = 4;
  // Ring order along loop:
  // 0 .. vSegs                         : outer wall (top -> bottom)
  // vSegs+1 .. vSegs+rollSteps         : bottom rolled hem (outer -> inner)
  // vSegs+rollSteps+1 .. 2*vSegs+rollSteps+1 : inner wall (bottom -> top)
  // 2*vSegs+rollSteps+2 .. 2*vSegs+2*rollSteps+1 : top rolled rim (inner -> outer)
  const loopLen = 2 * (vSegs + 1) + 2 * rollSteps;
  const rows = loopLen + 1; // +1 duplicates ring 0 for clean V UV closure

  const outerPts = [];
  const outerNorms = [];
  const outerTv = [];

  const epsU = 0.5 / uSegs;
  const epsV = 0.5 / vSegs;

  // Evaluate outer grid + analytical finite-difference normals & tangents
  for (let j = 0; j < cols; j++) {
    const u = closedU && j === uSegs ? 0 : j / uSegs;
    const colP = new Array(vSegs + 1);
    const colN = new Array(vSegs + 1);
    const colT = new Array(vSegs + 1);

    for (let k = 0; k <= vSegs; k++) {
      const v = k / vSegs;
      const p = evalFn(u, v);
      colP[k] = p;

      // Tangent along u
      let pU0, pU1;
      if (closedU) {
        pU0 = evalFn((u - epsU + 1) % 1, v);
        pU1 = evalFn((u + epsU) % 1, v);
      } else {
        const u0 = Math.max(0, u - epsU);
        const u1 = Math.min(1, u + epsU);
        pU0 = evalFn(u0, v);
        pU1 = evalFn(u1, v);
      }
      const tux = pU1[0] - pU0[0];
      const tuy = pU1[1] - pU0[1];
      const tuz = pU1[2] - pU0[2];

      // Tangent along v (downward)
      const v0 = Math.max(0, v - epsV);
      const v1 = Math.min(1, v + epsV);
      const pV0 = evalFn(u, v0);
      const pV1 = evalFn(u, v1);
      let tvx = pV1[0] - pV0[0];
      let tvy = pV1[1] - pV0[1];
      let tvz = pV1[2] - pV0[2];
      const tvLen = Math.hypot(tvx, tvy, tvz) || 1e-6;
      tvx /= tvLen;
      tvy /= tvLen;
      tvz /= tvLen;
      colT[k] = [tvx, tvy, tvz];

      // Outward normal = Tv x Tu
      let nx = tvy * tuz - tvz * tuy;
      let ny = tvz * tux - tvx * tuz;
      let nz = tvx * tuy - tvy * tux;
      let nLen = Math.hypot(nx, ny, nz);
      if (nLen < 1e-7) {
        const rLen = Math.hypot(p[0], p[2]) || 1;
        nx = p[0] / rLen;
        ny = 0;
        nz = p[2] / rLen;
      } else {
        nx /= nLen;
        ny /= nLen;
        nz /= nLen;
      }

      if (radialNormalBlend > 0) {
        const rLen = Math.hypot(p[0], p[2]) || 1;
        const rx = p[0] / rLen;
        const rz = p[2] / rLen;
        nx = lerp(nx, rx, radialNormalBlend);
        ny = lerp(ny, 0, radialNormalBlend);
        nz = lerp(nz, rz, radialNormalBlend);
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl;
        ny /= nl;
        nz /= nl;
      }

      colN[k] = [nx, ny, nz];
    }

    outerPts.push(colP);
    outerNorms.push(colN);
    outerTv.push(colT);
  }

  const positions = [];
  const uvs = [];
  const indices = [];

  const halfT = thickness * 0.5;
  const botExt = Math.max(halfT, rollRadius);
  const topExt = Math.max(halfT, topRollRadius);

  // Build loop vertices for each row and column
  for (let r = 0; r < rows; r++) {
    const loopIdx = r % loopLen;
    for (let j = 0; j < cols; j++) {
      const u = j / uSegs;
      const colP = outerPts[j];
      const colN = outerNorms[j];
      const colT = outerTv[j];

      let x, y, z, vCoord;

      if (loopIdx <= vSegs) {
        // Outer wall
        const k = loopIdx;
        const p = colP[k];
        x = p[0];
        y = p[1];
        z = p[2];
        vCoord = k / vSegs;
      } else if (loopIdx <= vSegs + rollSteps) {
        // Bottom rolled hem
        const step = loopIdx - vSegs;
        const ang = (step / (rollSteps + 1)) * Math.PI;
        const p = colP[vSegs];
        const n = colN[vSegs];
        const t = colT[vSegs];
        const cx = p[0] - n[0] * halfT;
        const cy = p[1] - n[1] * halfT;
        const cz = p[2] - n[2] * halfT;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        x = cx + n[0] * halfT * ca + t[0] * botExt * sa;
        y = cy + n[1] * halfT * ca + t[1] * botExt * sa;
        z = cz + n[2] * halfT * ca + t[2] * botExt * sa;
        vCoord = 1 + (step / (rollSteps + 1)) * 0.04;
      } else if (loopIdx <= 2 * vSegs + rollSteps + 1) {
        // Inner wall (bottom -> top)
        const k = vSegs - (loopIdx - (vSegs + rollSteps + 1));
        const p = colP[k];
        const n = colN[k];
        x = p[0] - n[0] * thickness;
        y = p[1] - n[1] * thickness;
        z = p[2] - n[2] * thickness;
        vCoord = k / vSegs;
      } else {
        // Top rolled rim (inner -> outer)
        const step = loopIdx - (2 * vSegs + rollSteps + 1);
        const ang = (step / (rollSteps + 1)) * Math.PI;
        const p = colP[0];
        const n = colN[0];
        const t = colT[0];
        const cx = p[0] - n[0] * halfT;
        const cy = p[1] - n[1] * halfT;
        const cz = p[2] - n[2] * halfT;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        x = cx - n[0] * halfT * ca - t[0] * topExt * sa;
        y = cy - n[1] * halfT * ca - t[1] * topExt * sa;
        z = cz - n[2] * halfT * ca - t[2] * topExt * sa;
        vCoord = -(step / (rollSteps + 1)) * 0.04;
      }

      positions.push(x, y, z);
      uvs.push(u * uvScaleU, vCoord * uvScaleV);
    }
  }

  for (let r = 0; r < rows - 1; r++) {
    const r0 = r * cols;
    const r1 = (r + 1) * cols;
    for (let j = 0; j < uSegs; j++) {
      const a = r0 + j;
      const b = r1 + j;
      const c = r1 + j + 1;
      const d = r0 + j + 1;
      indices.push(a, b, c, a, c, d);
    }
  }

  // Cap open vertical edges (j = 0 and j = uSegs) with rounded bevel caps
  if (!closedU) {
    const addSideCap = (jIdx, flip) => {
      const colP = outerPts[jIdx];
      const colN = outerNorms[jIdx];
      const colT = outerTv[jIdx];
      const baseStart = positions.length / 3;

      // Compute outward side direction along +/-u
      const otherJ = jIdx === 0 ? 1 : uSegs - 1;
      const midK = Math.floor(vSegs * 0.5);
      const pHere = colP[midK];
      const pOther = outerPts[otherJ][midK];
      let sx = pHere[0] - pOther[0];
      let sy = pHere[1] - pOther[1];
      let sz = pHere[2] - pOther[2];
      const sLen = Math.hypot(sx, sy, sz) || 1;
      sx /= sLen;
      sy /= sLen;
      sz /= sLen;

      // Create 3-column strip: outer edge, rounded mid-lip, inner edge
      const capRows = vSegs + 1;
      for (let k = 0; k < capRows; k++) {
        const p = colP[k];
        const n = colN[k];
        const ix = p[0] - n[0] * thickness;
        const iy = p[1] - n[1] * thickness;
        const iz = p[2] - n[2] * thickness;
        const mx = (p[0] + ix) * 0.5 + sx * halfT * 0.7;
        const my = (p[1] + iy) * 0.5 + sy * halfT * 0.7;
        const mz = (p[2] + iz) * 0.5 + sz * halfT * 0.7;
        const vCoord = (k / vSegs) * uvScaleV;

        positions.push(p[0], p[1], p[2]);
        uvs.push(0, vCoord);
        positions.push(mx, my, mz);
        uvs.push(0.02, vCoord);
        positions.push(ix, iy, iz);
        uvs.push(0.04, vCoord);
      }

      for (let k = 0; k < capRows - 1; k++) {
        const a0 = baseStart + k * 3;
        const b0 = baseStart + (k + 1) * 3;
        for (let s = 0; s < 2; s++) {
          const p00 = a0 + s;
          const p01 = a0 + s + 1;
          const p10 = b0 + s;
          const p11 = b0 + s + 1;
          if (!flip) {
            indices.push(p00, p01, p11, p00, p11, p10);
          } else {
            indices.push(p00, p11, p01, p00, p10, p11);
          }
        }
      }

      // Small corner fans for bottom roll and top roll ends
      const addRollFan = (kEdge, isBottom) => {
        const p = colP[kEdge];
        const n = colN[kEdge];
        const t = colT[kEdge];
        const ext = isBottom ? botExt : topExt;
        const dir = isBottom ? 1 : -1;
        const cx = p[0] - n[0] * halfT;
        const cy = p[1] - n[1] * halfT;
        const cz = p[2] - n[2] * halfT;
        const centerIdx = positions.length / 3;
        positions.push(cx + sx * halfT * 0.35, cy + sy * halfT * 0.35, cz + sz * halfT * 0.35);
        uvs.push(0.02, isBottom ? uvScaleV : 0);

        const rimStart = positions.length / 3;
        const segs = rollSteps + 2;
        for (let s = 0; s < segs; s++) {
          const ang = (s / (segs - 1)) * Math.PI;
          const ca = Math.cos(ang);
          const sa = Math.sin(ang);
          positions.push(
            cx + n[0] * halfT * ca + t[0] * ext * sa * dir,
            cy + n[1] * halfT * ca + t[1] * ext * sa * dir,
            cz + n[2] * halfT * ca + t[2] * ext * sa * dir
          );
          uvs.push(0.02, isBottom ? uvScaleV : 0);
        }
        for (let s = 0; s < segs - 1; s++) {
          const i1 = rimStart + s;
          const i2 = rimStart + s + 1;
          if ((isBottom && !flip) || (!isBottom && flip)) {
            indices.push(centerIdx, i1, i2);
          } else {
            indices.push(centerIdx, i2, i1);
          }
        }
      };

      addRollFan(vSegs, true);
      addRollFan(0, false);
    };

    addSideCap(0, false);
    addSideCap(uSegs, true);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  // Stitch radial seam normals so closed tubes have zero visible vertical seam
  if (closedU) {
    const nAttr = geo.getAttribute("normal");
    for (let r = 0; r < rows; r++) {
      const i0 = r * cols;
      const i1 = r * cols + uSegs;
      let nx = nAttr.getX(i0) + nAttr.getX(i1);
      let ny = nAttr.getY(i0) + nAttr.getY(i1);
      let nz = nAttr.getZ(i0) + nAttr.getZ(i1);
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      nAttr.setXYZ(i0, nx, ny, nz);
      nAttr.setXYZ(i1, nx, ny, nz);
    }
    nAttr.needsUpdate = true;
  }

  return geo;
}

function makeButtonGeo(THREE, radius, thickness) {
  const pts = [
    new THREE.Vector2(0.0001, -thickness * 0.5),
    new THREE.Vector2(radius * 0.85, -thickness * 0.5),
    new THREE.Vector2(radius, -thickness * 0.2),
    new THREE.Vector2(radius, thickness * 0.28),
    new THREE.Vector2(radius * 0.88, thickness * 0.5),
    new THREE.Vector2(radius * 0.72, thickness * 0.42),
    new THREE.Vector2(radius * 0.55, thickness * 0.22),
    new THREE.Vector2(0.0001, thickness * 0.24)
  ];
  const geo = new THREE.LatheGeometry(pts, 32);
  geo.rotateX(Math.PI * 0.5);
  geo.computeVertexNormals();
  return geo;
}

/* ============================================================================
 * BOTTOMS (pleatedSkirt, longSkirt, trousers, jeans, shorts)
 * ========================================================================== */

function buildBottom(ctx) {
  const { cfg } = ctx;
  switch (cfg.bottom) {
    case "pleatedSkirt":
      return buildPleatedSkirt(ctx);
    case "longSkirt":
      return buildLongSkirt(ctx);
    case "jeans":
      return buildPants(ctx, true);
    case "shorts":
      return buildShorts(ctx);
    case "trousers":
    default:
      return buildPants(ctx, false);
  }
}

function addWaistband(ctx, mat, yBot, yTop, rxExtra, rzExtra, optsExtra = {}) {
  const { THREE, pivots, metrics } = ctx;
  const { bw } = metrics;

  const geo = buildThickTube(THREE, {
    uSegs: 48,
    vSegs: 8,
    thickness: 0.0046,
    rollRadius: 0.0032,
    uvScaleU: 4,
    uvScaleV: 0.6,
    evalFn(u, v) {
      const th = u * Math.PI * 2;
      const y = lerp(yTop, yBot, v);
      const [brx, brz] = metrics.pelvisProfile(y);
      const rx = brx + rxExtra;
      const rz = brz + rzExtra;
      return [Math.sin(th) * rx, y, Math.cos(th) * rz];
    }
  });
  addMesh(ctx, pivots.pelvis, geo, mat, "bottom", "waistband");

  if (optsExtra.beltLoops) {
    const loopAngles = [0.42, -0.42, 1.57, -1.57, 2.55, -2.55];
    const loopH = (yTop - yBot) * 0.92;
    const loopY = (yTop + yBot) * 0.5;
    const [brx, brz] = metrics.pelvisProfile(loopY);
    const rx = brx + rxExtra + 0.0018;
    const rz = brz + rzExtra + 0.0018;

    for (let i = 0; i < loopAngles.length; i++) {
      const th = loopAngles[i];
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, loopH * 0.48, -0.0015),
        new THREE.Vector3(0, loopH * 0.25, 0.0022),
        new THREE.Vector3(0, -loopH * 0.25, 0.0022),
        new THREE.Vector3(0, -loopH * 0.48, -0.0015)
      ]);
      const loopGeo = new THREE.TubeGeometry(curve, 12, 0.0026, 32, false);
      loopGeo.scale(1.35, 1.0, 0.65);
      loopGeo.computeVertexNormals();
      const mesh = addMesh(ctx, pivots.pelvis, loopGeo, mat, "bottom", `beltLoop_${i}`);
      if (mesh) {
        mesh.position.set(Math.sin(th) * rx, loopY, Math.cos(th) * rz);
        mesh.rotation.y = th;
      }
    }
  }

  if (optsExtra.buttonMat) {
    const btnY = (yTop + yBot) * 0.5;
    const [, brz] = metrics.pelvisProfile(btnY);
    const btnGeo = makeButtonGeo(THREE, 0.0052 * bw, 0.0032);
    const btn = addMesh(ctx, pivots.pelvis, btnGeo, optsExtra.buttonMat, "accent", "waistButton");
    if (btn) {
      btn.position.set(0, btnY, brz + rzExtra + 0.0018);
    }
  }
}

function buildPleatedSkirt(ctx) {
  const { THREE, pivots, cfg, metrics } = ctx;
  const { bw, bh } = metrics;
  const mat = makeMaterial(ctx, {
    color: cfg.bottomColor,
    style: "suiting",
    repeatU: 6,
    repeatV: 3,
    roughness: 0.9,
    sheen: 0.5
  });

  const wbBot = 0.068 * bh;
  const wbTop = 0.104 * bh;
  addWaistband(ctx, mat, wbBot, wbTop, 0.0085, 0.0085);

  const skirtTop = 0.073 * bh;
  const skirtBot = -0.108 * bh;
  const pleatCount = 16;
  const [waistRX, waistRZ] = metrics.pelvisProfile(0.090 * bh);
  const baseTopRX = waistRX + 0.009;
  const baseTopRZ = waistRZ + 0.009;
  const flareFactor = 2.3;

  const evalSkirtRadius = (v) => {
    // Smooth flare reaching 2.3x waist radius at hem
    const f = Math.pow(v, 0.92);
    const rx = lerp(baseTopRX, baseTopRX * flareFactor, f);
    const rz = lerp(baseTopRZ, baseTopRZ * flareFactor * 0.96, f);
    // Ensure hip clearance at upper skirt
    const y = lerp(skirtTop, skirtBot, v);
    const [prx, prz] = metrics.pelvisProfile(Math.max(y, -0.02 * bh));
    return [Math.max(rx, prx + 0.011), Math.max(rz, prz + 0.011)];
  };

  // Knife-pleat profile: sharp fold crest, crisp flat slanted panel, clean inner tuck
  const pleatWave = (u) => {
    const p = (u * pleatCount) % 1;
    if (p < 0.10) {
      return lerp(-1.0, 1.0, smoothstep(0.0, 0.10, p));
    }
    if (p < 0.88) {
      return lerp(1.0, -0.82, (p - 0.10) / 0.78);
    }
    return lerp(-0.82, -1.0, smoothstep(0.88, 1.0, p));
  };

  const geo = buildThickTube(THREE, {
    uSegs: pleatCount * 8, // 128 segments -> razor-sharp folds & flat panels
    vSegs: 28,
    thickness: 0.0038,
    rollRadius: 0.0034,
    topRollRadius: 0.0022,
    radialNormalBlend: 0.45,
    uvScaleU: 8,
    uvScaleV: 2.5,
    evalFn(u, v) {
      const th = u * Math.PI * 2;
      const [rx0, rz0] = evalSkirtRadius(v);
      const depth = Math.pow(v, 0.82) * 0.019 * bw + 0.002 * bw;
      const pw = pleatWave(u) * depth;

      const rx = rx0 + pw;
      const rz = rz0 + pw * 0.96;

      // Subtle hem waviness following pleats + gentle gravity undulation
      const hemWave = (pleatWave(u) * 0.0022 + Math.sin(th * 3 + 0.6) * 0.0035) * v * v;
      const y = lerp(skirtTop, skirtBot, v) + hemWave;

      return [Math.sin(th) * rx, y, Math.cos(th) * rz];
    }
  });
  addMesh(ctx, pivots.pelvis, geo, mat, "bottom", "pleatedSkirt");

  return {
    type: "skirt",
    waistOuterRX: baseTopRX + 0.004,
    waistOuterRZ: baseTopRZ + 0.004,
    waistInnerRX: baseTopRX - 0.003,
    waistInnerRZ: baseTopRZ - 0.003,
    outerAtPelvisY(y) {
      if (y >= wbBot) return [baseTopRX + 0.004, baseTopRZ + 0.004];
      const v = clamp((skirtTop - y) / (skirtTop - skirtBot), 0, 1);
      const [rx, rz] = evalSkirtRadius(v);
      const pad = Math.pow(v, 0.82) * 0.019 * bw + 0.004;
      return [rx + pad, rz + pad];
    },
    ankleOuterR: 0
  };
}

function buildLongSkirt(ctx) {
  const { THREE, pivots, cfg, metrics } = ctx;
  const { bw, bh } = metrics;
  const mat = makeMaterial(ctx, {
    color: cfg.bottomColor,
    style: "weave",
    repeatU: 6,
    repeatV: 5,
    roughness: 0.9,
    sheen: 0.52
  });

  const wbBot = 0.068 * bh;
  const wbTop = 0.104 * bh;
  addWaistband(ctx, mat, wbBot, wbTop, 0.0085, 0.0085);

  const skirtTop = 0.073 * bh;
  const skirtBot = -0.278 * bh; // Graceful calf/ankle length
  const [waistRX, waistRZ] = metrics.pelvisProfile(0.090 * bh);
  const baseTopRX = waistRX + 0.009;
  const baseTopRZ = waistRZ + 0.009;

  const evalSkirtRadius = (v) => {
    const y = lerp(skirtTop, skirtBot, v);
    const hipCurve = smoothstep(0.0, 0.25, v);
    const flare = Math.pow(v, 1.05);
    const rx = lerp(baseTopRX, baseTopRX * 1.98, flare) + hipCurve * (1 - v) * 0.016 * bw;
    const rz = lerp(baseTopRZ, baseTopRZ * 1.90, flare) + hipCurve * (1 - v) * 0.014 * bw;
    const [prx, prz] = metrics.pelvisProfile(Math.max(y, -0.02 * bh));
    return [Math.max(rx, prx + 0.011), Math.max(rz, prz + 0.011)];
  };

  const geo = buildThickTube(THREE, {
    uSegs: 72,
    vSegs: 36,
    thickness: 0.0042,
    rollRadius: 0.0038,
    topRollRadius: 0.0024,
    radialNormalBlend: 0.25,
    uvScaleU: 6,
    uvScaleV: 4.5,
    evalFn(u, v) {
      const th = u * Math.PI * 2;
      const [rx0, rz0] = evalSkirtRadius(v);

      // Soft vertical gravity drapery folds deepening toward hem
      const fold =
        Math.sin(th * 7 + 0.35) * 0.45 +
        Math.sin(th * 11 - 1.1) * 0.32 +
        Math.sin(th * 5 + 2.0) * 0.23;
      const foldAmp = (0.0025 + Math.pow(v, 1.1) * 0.0155) * bw;

      const rx = rx0 + fold * foldAmp;
      const rz = rz0 + fold * foldAmp;
      const hemWave = fold * 0.0045 * v * v;
      const y = lerp(skirtTop, skirtBot, v) + hemWave;

      return [Math.sin(th) * rx, y, Math.cos(th) * rz];
    }
  });
  addMesh(ctx, pivots.pelvis, geo, mat, "bottom", "longSkirt");

  return {
    type: "skirt",
    waistOuterRX: baseTopRX + 0.004,
    waistOuterRZ: baseTopRZ + 0.004,
    waistInnerRX: baseTopRX - 0.003,
    waistInnerRZ: baseTopRZ - 0.003,
    outerAtPelvisY(y) {
      if (y >= wbBot) return [baseTopRX + 0.004, baseTopRZ + 0.004];
      const v = clamp((skirtTop - y) / (skirtTop - skirtBot), 0, 1);
      const [rx, rz] = evalSkirtRadius(v);
      const pad = (0.004 + Math.pow(v, 1.1) * 0.015) * bw;
      return [rx + pad, rz + pad];
    },
    ankleOuterR: 0
  };
}

function buildPelvisHipShell(ctx, mat, isJeans) {
  const { THREE, pivots, cfg, metrics } = ctx;
  const { bw, bh } = metrics;

  const wbBot = 0.070 * bh;
  const wbTop = 0.104 * bh;
  const btnMat = makeMaterial(ctx, {
    color: isJeans ? cfg.accent : cfg.bottomColor,
    roughness: isJeans ? 0.28 : 0.45,
    metalness: isJeans ? 0.75 : 0.1,
    isFabric: false
  });
  addWaistband(ctx, mat, wbBot, wbTop, 0.009, 0.009, { beltLoops: true, buttonMat: btnMat });

  const topY = 0.074 * bh;
  const botY = -0.036 * bh;

  // Sculpted hip block with subtle front/back crotch seam pinch near bottom
  const hipGeo = buildThickTube(THREE, {
    uSegs: 56,
    vSegs: 20,
    thickness: 0.0048,
    rollRadius: 0.003,
    uvScaleU: 4,
    uvScaleV: 2,
    evalFn(u, v) {
      const th = u * Math.PI * 2;
      const y = lerp(topY, botY, v);
      const [prx, prz] = metrics.pelvisProfile(y);
      const loose = isJeans ? 0.0085 : 0.0105;
      const rx = prx + loose;
      const rz = prz + loose;

      const sx = Math.sin(th);
      const cz = Math.cos(th);

      // Gentle crotch center pinch toward bottom (figure-8 transition into leg tubes)
      const centerProximity = Math.exp(-Math.pow(sx / 0.28, 2));
      const pinch = smoothstep(0.45, 1.0, v) * centerProximity;
      const zScale = 1 - pinch * 0.28;
      const yDip = -pinch * 0.006 * bh;

      // Subtle side seam line
      const sideSeam = Math.exp(-Math.pow(cz / 0.08, 2)) * 0.0012;

      return [sx * (rx + sideSeam), y + yDip, cz * rz * zScale];
    }
  });
  addMesh(ctx, pivots.pelvis, hipGeo, mat, "bottom", "pelvisTrouserShell");

  // Closed crotch bridge under the pelvis connecting front and back crotch seams
  const crotchCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.012 * bh, metrics.pelvisRZ * 0.72),
    new THREE.Vector3(0, -0.038 * bh, metrics.pelvisRZ * 0.28),
    new THREE.Vector3(0, -0.044 * bh, 0),
    new THREE.Vector3(0, -0.038 * bh, -metrics.pelvisRZ * 0.28),
    new THREE.Vector3(0, -0.012 * bh, -metrics.pelvisRZ * 0.72)
  ]);
  const crotchGeo = new THREE.TubeGeometry(crotchCurve, 24, 0.016 * bw, 32, false);
  crotchGeo.scale(1.15, 0.8, 1.0);
  crotchGeo.computeVertexNormals();
  addMesh(ctx, pivots.pelvis, crotchGeo, mat, "bottom", "crotchSeam");

  // Front fly placket line (J-curve)
  const flyPts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const y = lerp(wbBot + 0.003 * bh, 0.005 * bh, t);
    const [, prz] = metrics.pelvisProfile(y);
    const x = t < 0.72 ? 0.006 * bw : lerp(0.006 * bw, 0.0, smoothstep(0.72, 1.0, t));
    const z = prz + (isJeans ? 0.0095 : 0.0115);
    flyPts.push(new THREE.Vector3(x, y, z));
  }
  const flyCurve = new THREE.CatmullRomCurve3(flyPts);
  const flyMat = isJeans
    ? makeMaterial(ctx, { color: cfg.accent, roughness: 0.75, sheen: 0.2, isFabric: true })
    : mat;
  const flyGeo = new THREE.TubeGeometry(flyCurve, 20, isJeans ? 0.0014 : 0.0018, 32, false);
  addMesh(ctx, pivots.pelvis, flyGeo, flyMat, isJeans ? "accent" : "bottom", "flyLine");

  // Jeans details: curved front scoop pockets, rivets, and pentagonal back patch pockets
  if (isJeans) {
    const rivetMat = makeMaterial(ctx, {
      color: cfg.accent,
      roughness: 0.28,
      metalness: 0.85,
      isFabric: false
    });
    const rivetGeo = new THREE.SphereGeometry(0.0022, 32, 16);

    for (const side of [1, -1]) {
      // Front scoop pocket trim
      const pPts = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const th = side * lerp(0.55, 1.38, t);
        const y = lerp(wbBot - 0.001 * bh, 0.025 * bh, Math.sin(t * Math.PI * 0.65));
        const [prx, prz] = metrics.pelvisProfile(y);
        pPts.push(new THREE.Vector3(
          Math.sin(th) * (prx + 0.0098),
          y,
          Math.cos(th) * (prz + 0.0098)
        ));
      }
      const pGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pPts), 16, 0.0014, 32, false);
      addMesh(ctx, pivots.pelvis, pGeo, flyMat, "accent", `jeanFrontPocket_${side}`);

      // Rivet at inner pocket corner
      const r0 = pPts[0];
      const rivet = addMesh(ctx, pivots.pelvis, rivetGeo, rivetMat, "accent", `jeanRivet_${side}`);
      if (rivet) rivet.position.copy(r0);

      // Pentagonal back patch pocket sculpted onto back of pelvis
      const backPatch = buildCurvedPatch(THREE, {
        uSegs: 16,
        vSegs: 14,
        thickness: 0.0026,
        evalFn(u, v) {
          const thCenter = Math.PI - side * 0.56;
          const halfAng = 0.34;
          // Slight taper + bottom point for classic denim back pocket
          const pointDrop = (1 - Math.abs(u * 2 - 1)) * 0.010 * bh * smoothstep(0.6, 1.0, v);
          const taper = lerp(1.0, 0.84, smoothstep(0.65, 1.0, v));
          const th = thCenter + (u - 0.5) * 2 * halfAng * taper;
          const y = lerp(0.056 * bh, 0.004 * bh, v) - pointDrop;
          const [prx, prz] = metrics.pelvisProfile(y);
          const off = 0.0112;
          return [Math.sin(th) * (prx + off), y, Math.cos(th) * (prz + off)];
        }
      });
      addMesh(ctx, pivots.pelvis, backPatch, mat, "bottom", `jeanBackPocket_${side}`);
    }
  }

  const [wrx, wrz] = metrics.pelvisProfile(0.090 * bh);
  return {
    waistOuterRX: wrx + 0.012,
    waistOuterRZ: wrz + 0.012,
    waistInnerRX: wrx + 0.005,
    waistInnerRZ: wrz + 0.005
  };
}

function buildPants(ctx, isJeans) {
  const { THREE, pivots, cfg, metrics } = ctx;
  const { bw, bh, thighLen, shinLen, legX } = metrics;

  const mat = makeMaterial(ctx, {
    color: cfg.bottomColor,
    style: isJeans ? "denim" : "suiting",
    repeatU: 3,
    repeatV: 5,
    roughness: 0.9,
    sheen: isJeans ? 0.35 : 0.5
  });

  const hipInfo = buildPelvisHipShell(ctx, mat, isJeans);
  const bootWiden = cfg.shoes === "boots" ? 0.0055 : 0.0;

  for (const side of [1, -1]) {
    const legPivot = side > 0 ? pivots.legL : pivots.legR;
    const shinPivot = side > 0 ? pivots.shinL : pivots.shinR;
    const tag = side > 0 ? "L" : "R";

    // Upper leg (thigh) tube
    const thighTopY = 0.032 * bh;
    const thighBotY = -thighLen - 0.008 * bh;
    const thighGeo = buildThickTube(THREE, {
      uSegs: 40,
      vSegs: 28,
      thickness: 0.0046,
      rollRadius: 0.0032,
      uvScaleU: 2.5,
      uvScaleV: 3,
      evalFn(u, v) {
        const th = u * Math.PI * 2;
        const y = lerp(thighTopY, thighBotY, v);
        const tLen = clamp(-y / thighLen, 0, 1);

        // Dome cap over top of hip joint
        const capFactor = y > 0 ? Math.sqrt(Math.max(0.18, 1 - Math.pow(y / (thighTopY * 1.15), 2))) : 1;
        const baseR = lerp(metrics.thighTopR, metrics.kneeR, tLen);
        const loose = isJeans ? lerp(0.008, 0.0095, tLen) : lerp(0.010, 0.012, tLen);
        let r = (baseR + loose) * capFactor;

        const sx = Math.sin(th);
        const cz = Math.cos(th);

        // Front & back tailored crease on trousers; subtle outseam on jeans
        if (!isJeans) {
          const frontCrease = Math.exp(-Math.pow((1 - cz) / 0.04, 2)) * 0.0032 * bw;
          const backCrease = Math.exp(-Math.pow((1 + cz) / 0.05, 2)) * 0.0020 * bw;
          r += (frontCrease + backCrease) * smoothstep(0.08, 0.3, v);
        } else {
          const outSeam = Math.exp(-Math.pow((side * sx - 1) / 0.06, 2)) * 0.0014;
          r += outSeam;
        }

        // Horizontal compression folds behind the knee (lower back of thigh)
        const backWeight = Math.pow(Math.max(0, -cz), 1.6);
        const kneeFoldZone = smoothstep(0.72, 0.96, v);
        const kneeRipples = Math.sin(v * Math.PI * 16) * 0.0024 * bw * backWeight * kneeFoldZone;
        r += kneeRipples;

        let lx = sx * r;
        const lz = cz * r;

        // Prevent inner thigh overlap across x = 0 near top of leg
        const medialLimit = legX - 0.0008;
        if (side * lx < -medialLimit) {
          const blend = smoothstep(0.0, 0.45, v);
          const clampedX = -side * medialLimit;
          lx = lerp(clampedX, lx, blend * 0.25);
        }

        return [lx, y, lz];
      }
    });
    addMesh(ctx, legPivot, thighGeo, mat, "bottom", `pantThigh_${tag}`);

    // Lower leg (shin) tube with behind-knee folds & ankle stacking folds
    const shinTopY = 0.014 * bh;
    const shinBotY = -shinLen + 0.008 * bh;
    const shinGeo = buildThickTube(THREE, {
      uSegs: 40,
      vSegs: 32,
      thickness: 0.0046,
      rollRadius: 0.0038,
      uvScaleU: 2.5,
      uvScaleV: 3.2,
      evalFn(u, v) {
        const th = u * Math.PI * 2;
        const y = lerp(shinTopY, shinBotY, v);
        const tLen = clamp(-y / shinLen, 0, 1);

        // Smooth knee taper down to slightly looser hem
        const baseR = lerp(metrics.kneeR, metrics.ankleR, tLen);
        const hemFlare = smoothstep(0.75, 1.0, v) * (isJeans ? 0.0028 : 0.0045) * bw;
        const loose = (isJeans ? 0.0095 : 0.0115) + bootWiden * smoothstep(0.35, 0.9, v);
        // Slightly inset right at top overlap so thigh & shin never z-fight
        const overlapInset = (1 - smoothstep(0.0, 0.14, v)) * 0.0028;
        let r = baseR + loose + hemFlare - overlapInset;

        const sx = Math.sin(th);
        const cz = Math.cos(th);

        // Front crease on trousers
        if (!isJeans) {
          const frontCrease = Math.exp(-Math.pow((1 - cz) / 0.04, 2)) * 0.0032 * bw;
          const backCrease = Math.exp(-Math.pow((1 + cz) / 0.05, 2)) * 0.0018 * bw;
          r += (frontCrease + backCrease) * smoothstep(0.05, 0.2, v);
        }

        // Horizontal compression folds behind the knee (upper back of shin)
        const backWeight = Math.pow(Math.max(0, -cz), 1.5);
        const behindKnee = (1 - smoothstep(0.04, 0.28, v)) * smoothstep(0.0, 0.06, v);
        r += Math.sin(v * Math.PI * 22) * 0.0028 * bw * backWeight * behindKnee;

        // Horizontal compression folds / stacking ripples at the ankle
        const ankleZone = smoothstep(0.68, 0.95, v) * (1 - smoothstep(0.95, 1.0, v) * 0.4);
        const ankleWave = Math.sin(v * Math.PI * 24 + cz * 0.7) * 0.0024 * bw * ankleZone;
        r += ankleWave;

        return [sx * r, y, cz * r];
      }
    });
    addMesh(ctx, shinPivot, shinGeo, mat, "bottom", `pantShin_${tag}`);

    // Turned-up denim cuff at ankle for jeans
    if (isJeans) {
      const cuffBot = shinBotY - 0.001;
      const cuffTop = shinBotY + 0.019 * bh;
      const cuffMat = makeMaterial(ctx, {
        color: new THREE.Color(cfg.bottomColor).lerp(new THREE.Color("#dfe4ec"), 0.28),
        style: "denim",
        repeatU: 3,
        repeatV: 0.7,
        roughness: 0.9,
        sheen: 0.35
      });
      const cuffGeo = buildThickTube(THREE, {
        uSegs: 40,
        vSegs: 8,
        thickness: 0.0042,
        rollRadius: 0.0034,
        uvScaleU: 2.5,
        uvScaleV: 0.5,
        evalFn(u, v) {
          const th = u * Math.PI * 2;
          const y = lerp(cuffTop, cuffBot, v);
          const r = metrics.ankleR + 0.0155 + bootWiden + Math.sin(v * Math.PI) * 0.0012;
          return [Math.sin(th) * r, y, Math.cos(th) * r];
        }
      });
      addMesh(ctx, shinPivot, cuffGeo, cuffMat, "bottom", `jeanCuff_${tag}`);
    }
  }

  return {
    type: isJeans ? "jeans" : "trousers",
    ...hipInfo,
    outerAtPelvisY(y) {
      const [prx, prz] = metrics.pelvisProfile(y);
      const pad = isJeans ? 0.011 : 0.013;
      return [prx + pad, prz + pad];
    },
    ankleOuterR: metrics.ankleR + 0.015 + bootWiden
  };
}

function buildShorts(ctx) {
  const { THREE, pivots, cfg, metrics } = ctx;
  const { bw, bh, thighLen, legX } = metrics;

  const mat = makeMaterial(ctx, {
    color: cfg.bottomColor,
    style: "weave",
    repeatU: 4,
    repeatV: 3,
    roughness: 0.9,
    sheen: 0.5
  });

  const hipInfo = buildPelvisHipShell(ctx, mat, false);

  for (const side of [1, -1]) {
    const legPivot = side > 0 ? pivots.legL : pivots.legR;
    const tag = side > 0 ? "L" : "R";

    const topY = 0.032 * bh;
    const botY = -0.072 * bh;

    const legGeo = buildThickTube(THREE, {
      uSegs: 40,
      vSegs: 18,
      thickness: 0.0045,
      rollRadius: 0.0032,
      uvScaleU: 2.5,
      uvScaleV: 1.5,
      evalFn(u, v) {
        const th = u * Math.PI * 2;
        const y = lerp(topY, botY, v);
        const tLen = clamp(-y / thighLen, 0, 1);
        const capFactor = y > 0 ? Math.sqrt(Math.max(0.18, 1 - Math.pow(y / (topY * 1.15), 2))) : 1;
        const baseR = lerp(metrics.thighTopR, metrics.kneeR, tLen);
        const flare = smoothstep(0.4, 1.0, v) * 0.003 * bw;
        const r = (baseR + 0.0105 + flare) * capFactor;

        let lx = Math.sin(th) * r;
        const lz = Math.cos(th) * r;

        const medialLimit = legX - 0.0008;
        if (side * lx < -medialLimit) {
          lx = lerp(-side * medialLimit, lx, smoothstep(0.0, 0.75, v) * 0.35);
        }
        return [lx, y, lz];
      }
    });
    addMesh(ctx, legPivot, legGeo, mat, "bottom", `shortsLeg_${tag}`);

    // Distinct rolled cuff at the bottom of the shorts
    const cuffTop = botY + 0.016 * bh;
    const cuffBot = botY - 0.003 * bh;
    const cuffGeo = buildThickTube(THREE, {
      uSegs: 40,
      vSegs: 10,
      thickness: 0.0048,
      rollRadius: 0.0040,
      uvScaleU: 2.5,
      uvScaleV: 0.5,
      evalFn(u, v) {
        const th = u * Math.PI * 2;
        const y = lerp(cuffTop, cuffBot, v);
        const tLen = clamp(-botY / thighLen, 0, 1);
        const baseR = lerp(metrics.thighTopR, metrics.kneeR, tLen);
        const bulge = Math.sin(v * Math.PI) * 0.0018;
        const r = baseR + 0.0165 + bulge;
        let lx = Math.sin(th) * r;
        const lz = Math.cos(th) * r;
        const medialLimit = legX - 0.0012;
        if (side * lx < -medialLimit) {
          lx = lerp(-side * medialLimit, lx, 0.35);
        }
        return [lx, y, lz];
      }
    });
    addMesh(ctx, legPivot, cuffGeo, mat, "bottom", `shortsCuff_${tag}`);
  }

  return {
    type: "shorts",
    ...hipInfo,
    outerAtPelvisY(y) {
      const [prx, prz] = metrics.pelvisProfile(y);
      return [prx + 0.013, prz + 0.013];
    },
    ankleOuterR: 0
  };
}

/* ============================================================================
 * TOPS (hoodie, cardigan, sweater, shirt, tee, blazer)
 * ========================================================================== */

function buildTop(ctx, bottomInfo) {
  const { cfg } = ctx;
  switch (cfg.top) {
    case "cardigan":
      buildCardigan(ctx, bottomInfo);
      break;
    case "sweater":
      buildSweater(ctx, bottomInfo);
      break;
    case "shirt":
      buildShirt(ctx, bottomInfo);
      break;
    case "tee":
      buildTee(ctx, bottomInfo);
      break;
    case "blazer":
      buildBlazer(ctx, bottomInfo);
      break;
    case "hoodie":
    default:
      buildHoodie(ctx, bottomInfo);
      break;
  }
}

function buildBodiceShell(ctx, params) {
  const { THREE, pivots, metrics } = ctx;
  const { bw, bh, waistYInPelvis } = metrics;
  const {
    mat,
    slot = "top",
    name = "bodice",
    topY = 0.155 * bh,
    botY = -0.052 * bh,
    offset = 0.0095,
    hemFlare = 0.005,
    tucked = false,
    openFrontAngle = 0, // > 0 for open cardigan/blazer
    vNeckDepth = 0,
    ribHem = false,
    cableRelief = false,
    bottomInfo = null,
    uvScaleU = 4,
    uvScaleV = 3
  } = params;

  const closedU = openFrontAngle <= 0.001;
  const uStart = openFrontAngle;
  const uSpan = Math.PI * 2 - openFrontAngle * 2;

  const geo = buildThickTube(THREE, {
    uSegs: closedU ? 56 : 52,
    vSegs: 32,
    thickness: 0.0046,
    rollRadius: 0.0038,
    topRollRadius: 0.0030,
    closedU,
    uvScaleU,
    uvScaleV,
    evalFn(u, v) {
      const th = closedU ? u * Math.PI * 2 : uStart + u * uSpan;
      const sx = Math.sin(th);
      const cz = Math.cos(th);

      // Optional V-neck dip at top front
      let yTopLocal = topY;
      if (vNeckDepth > 0 && cz > 0) {
        const frontW = Math.pow(cz, 2.2);
        yTopLocal -= vNeckDepth * frontW;
      }

      const y = lerp(yTopLocal, botY, v);
      const [trx, trz] = metrics.torsoProfile(y);

      let rx = trx + offset;
      let rz = trz + offset;

      // Natural shoulder slope broadening & armhole subtle indent
      const shoulderBand = Math.exp(-Math.pow((y - 0.132 * bh) / (0.022 * bh), 2));
      const sideFactor = Math.pow(Math.abs(sx), 2.5);
      rx += shoulderBand * 0.005 * bw * sideFactor;

      const armholeBand = Math.exp(-Math.pow((y - 0.105 * bh) / (0.022 * bh), 2));
      rx -= armholeBand * 0.0035 * bw * sideFactor;

      // Subtle shoulder seam ridge along top of shoulder (theta near +-PI/2)
      const seamRidge = Math.exp(-Math.pow((y - 0.146 * bh) / (0.007 * bh), 2)) * sideFactor * 0.0014;
      rx += seamRidge;

      // Hem flare or tucked waist shaping
      if (tucked) {
        // Soft blousing puff above waistband, then tapering neatly inside waistband
        const blouse = Math.exp(-Math.pow((y - 0.024 * bh) / (0.022 * bh), 2)) * 0.005 * bw;
        rx += blouse;
        rz += blouse;
        if (bottomInfo && y < 0.012 * bh) {
          const tIn = smoothstep(0.012 * bh, -0.014 * bh, y);
          rx = lerp(rx, Math.min(rx, bottomInfo.waistInnerRX - 0.0015), tIn);
          rz = lerp(rz, Math.min(rz, bottomInfo.waistInnerRZ - 0.0015), tIn);
        }
      } else {
        const hemT = smoothstep(0.6, 1.0, v);
        rx += hemT * hemFlare * bw;
        rz += hemT * hemFlare * bw;

        // Guarantee clearance over skirts/trousers below waist
        if (bottomInfo && y < 0.016 * bh) {
          const pelvisY = y + waistYInPelvis;
          const [brx, brz] = bottomInfo.outerAtPelvisY(pelvisY);
          const clearT = smoothstep(0.016 * bh, -0.008 * bh, y);
          const minRX = brx + 0.0055;
          const minRZ = brz + 0.0055;
          rx = Math.max(rx, lerp(rx, minRX, clearT));
          rz = Math.max(rz, lerp(rz, minRZ, clearT));
        }

        if (ribHem) {
          const cinch = smoothstep(0.84, 1.0, v) * 0.0035 * bw;
          rx -= cinch;
          rz -= cinch;
        }
      }

      // Subtle knit cable undulation on sweaters
      if (cableRelief) {
        const cable = Math.sin(th * 12) * 0.0016 * bw * smoothstep(0.1, 0.25, v) * (1 - smoothstep(0.82, 0.96, v));
        rx += cable;
        rz += cable;
      }

      // Subtle drape fold ripples near lower bodice
      const drape = Math.sin(th * 6 + 0.5) * 0.0014 * bw * smoothstep(0.55, 1.0, v);
      return [sx * (rx + drape), y, cz * (rz + drape)];
    }
  });

  return addMesh(ctx, pivots.chest, geo, mat, slot, name);
}

function buildSleeves(ctx, params) {
  const { THREE, pivots, metrics } = ctx;
  const { bw, bh, upperArmLen, forearmLen } = metrics;
  const {
    mat,
    cuffMat = mat,
    slot = "top",
    cuffSlot = slot,
    short = false,
    offset = 0.0095,
    cuffStyle = "rib", // "rib" | "shirt" | "blazer" | "none"
    buttonMat = null
  } = params;

  for (const side of [1, -1]) {
    const armPivot = side > 0 ? pivots.armL : pivots.armR;
    const forePivot = side > 0 ? pivots.forearmL : pivots.forearmR;
    const tag = side > 0 ? "L" : "R";

    const capTopY = 0.032 * bh;
    const upperBotY = short ? -0.068 * bh : -upperArmLen - 0.006 * bh;

    // Upper sleeve with set-in rounded shoulder cap & elbow wrinkles
    const upperGeo = buildThickTube(THREE, {
      uSegs: 36,
      vSegs: short ? 20 : 26,
      thickness: 0.0044,
      rollRadius: 0.0036,
      topRollRadius: 0.0022,
      uvScaleU: 2.2,
      uvScaleV: short ? 1.4 : 2.4,
      evalFn(u, v) {
        const th = u * Math.PI * 2;
        const y = lerp(capTopY, upperBotY, v);
        const tLen = clamp(-y / upperArmLen, 0, 1);

        // Smooth shoulder cap dome covering shoulder ball (r = 0.028)
        let r;
        if (y > 0) {
          const capT = clamp(y / capTopY, 0, 1);
          const dome = Math.sqrt(Math.max(0.08, 1 - capT * capT * 0.92));
          r = (metrics.shoulderBallR + offset) * dome;
        } else {
          const armR = lerp(metrics.upperArmTopR, metrics.elbowR, tLen);
          const hemLoosen = short ? smoothstep(0.55, 1.0, v) * 0.0045 * bw : 0;
          r = armR + offset + hemLoosen;
        }

        // Ring-shaped compression wrinkles approaching the elbow
        if (!short) {
          const cz = Math.cos(th);
          const elbowZone = smoothstep(0.68, 0.96, v);
          const creaseBias = 0.55 + 0.45 * Math.max(0, cz);
          const wrinkles = Math.sin(v * Math.PI * 18) * 0.0024 * bw * elbowZone * creaseBias;
          r += wrinkles;
        }

        return [Math.sin(th) * r, y, Math.cos(th) * r];
      }
    });
    addMesh(ctx, armPivot, upperGeo, mat, slot, `sleeveUpper_${tag}`);

    if (short) continue;

    // Lower sleeve (forearm) with 4 ring-shaped elbow wrinkles
    const foreTopY = 0.012 * bh;
    const foreBotY = cuffStyle === "none" ? -forearmLen + 0.006 * bh : -forearmLen + 0.024 * bh;

    const foreGeo = buildThickTube(THREE, {
      uSegs: 36,
      vSegs: 28,
      thickness: 0.0044,
      rollRadius: 0.0036,
      topRollRadius: 0.0022,
      uvScaleU: 2.2,
      uvScaleV: 2.2,
      evalFn(u, v) {
        const th = u * Math.PI * 2;
        const y = lerp(foreTopY, foreBotY, v);
        const tLen = clamp(-y / forearmLen, 0, 1);
        const armR = lerp(metrics.elbowR, metrics.wristR, tLen);

        // Slight inset right at top elbow overlap to avoid z-fighting with upper sleeve
        const topInset = (1 - smoothstep(0.0, 0.14, v)) * 0.0026;
        // Soft blousing right above ribbed/shirt cuffs
        const cuffBlouse = cuffStyle === "rib" || cuffStyle === "shirt"
          ? Math.exp(-Math.pow((v - 0.88) / 0.16, 2)) * 0.0038 * bw
          : smoothstep(0.7, 1.0, v) * 0.0025 * bw;

        let r = armR + offset + cuffBlouse - topInset;

        // 3-4 distinct ring-shaped wrinkles at the elbow
        const cz = Math.cos(th);
        const elbowZone = smoothstep(0.02, 0.12, v) * (1 - smoothstep(0.28, 0.50, v));
        const frontBias = 0.65 + 0.35 * Math.max(0, cz);
        r += Math.sin(v * Math.PI * 26) * 0.0028 * bw * elbowZone * frontBias;

        return [Math.sin(th) * r, y, Math.cos(th) * r];
      }
    });
    addMesh(ctx, forePivot, foreGeo, mat, slot, `sleeveFore_${tag}`);

    // Wrist cuffs
    if (cuffStyle === "rib" || cuffStyle === "shirt") {
      const cTop = foreBotY + 0.004 * bh;
      const cBot = -forearmLen + 0.003 * bh;
      const cuffGeo = buildThickTube(THREE, {
        uSegs: 36,
        vSegs: 10,
        thickness: 0.0044,
        rollRadius: 0.0036,
        uvScaleU: 2.2,
        uvScaleV: 0.6,
        evalFn(u, v) {
          const th = u * Math.PI * 2;
          const y = lerp(cTop, cBot, v);
          const snug = cuffStyle === "rib" ? 0.0072 : 0.0085;
          const flare = cuffStyle === "shirt" ? v * 0.0022 : -Math.sin(v * Math.PI) * 0.0012;
          const r = metrics.wristR + snug + flare;
          return [Math.sin(th) * r, y, Math.cos(th) * r];
        }
      });
      addMesh(ctx, forePivot, cuffGeo, cuffMat, cuffSlot, `cuff_${tag}`);

      if (cuffStyle === "shirt" && buttonMat) {
        const btnGeo = makeButtonGeo(THREE, 0.0030 * bw, 0.0020);
        const btn = addMesh(ctx, forePivot, btnGeo, buttonMat, "accent", `cuffBtn_${tag}`);
        if (btn) {
          const br = metrics.wristR + 0.0102;
          btn.position.set(side * br * 0.65, (cTop + cBot) * 0.5, -br * 0.76);
          btn.rotation.y = side > 0 ? Math.PI * 0.78 : -Math.PI * 0.78;
        }
      }
    } else if (cuffStyle === "blazer" && buttonMat) {
      // Two tailored decorative sleeve cuff buttons
      const btnGeo = makeButtonGeo(THREE, 0.0028 * bw, 0.0020);
      for (let i = 0; i < 2; i++) {
        const btn = addMesh(ctx, forePivot, btnGeo, buttonMat, "accent", `blazerCuffBtn_${tag}_${i}`);
        if (btn) {
          const br = metrics.wristR + offset + 0.0025;
          btn.position.set(side * br * 0.85, -forearmLen + (0.016 + i * 0.011) * bh, -br * 0.52);
          btn.rotation.y = side > 0 ? Math.PI * 0.68 : -Math.PI * 0.68;
        }
      }
    }
  }
}

function buildNeckBand(ctx, mat, slot, topY, botY, extraR, rollR = 0.0035) {
  const { THREE, pivots, metrics } = ctx;
  const rBase = metrics.neckR + extraR;
  const geo = buildThickTube(THREE, {
    uSegs: 40,
    vSegs: 10,
    thickness: 0.0044,
    rollRadius: rollR,
    uvScaleU: 3,
    uvScaleV: 0.6,
    evalFn(u, v) {
      const th = u * Math.PI * 2;
      const y = lerp(topY, botY, v);
      const flare = v * 0.0055 * metrics.bw;
      const dipFront = Math.max(0, Math.cos(th)) * 0.006 * metrics.bh * (1 - v * 0.4);
      const r = rBase + flare;
      return [Math.sin(th) * r, y - dipFront, Math.cos(th) * r];
    }
  });
  return addMesh(ctx, pivots.chest, geo, mat, slot, "neckBand");
}

function buildCurvedPatch(THREE, { uSegs = 20, vSegs = 16, thickness = 0.0036, evalFn }) {
  return buildThickTube(THREE, {
    uSegs,
    vSegs,
    thickness,
    rollRadius: thickness * 0.65,
    topRollRadius: thickness * 0.65,
    closedU: false,
    uvScaleU: 1,
    uvScaleV: 1,
    evalFn
  });
}

function buildHoodie(ctx, bottomInfo) {
  const { THREE, pivots, cfg, metrics } = ctx;
  const { bw, bh } = metrics;

  const mat = makeMaterial(ctx, {
    color: cfg.topColor,
    style: "fleece",
    repeatU: 4,
    repeatV: 4,
    roughness: 0.9,
    sheen: 0.55
  });
  const ribMat = makeMaterial(ctx, {
    color: cfg.topColor,
    style: "rib",
    repeatU: 6,
    repeatV: 1.5,
    roughness: 0.92,
    sheen: 0.5
  });
  const cordMat = makeMaterial(ctx, {
    color: cfg.accent,
    style: "weave",
    repeatU: 2,
    repeatV: 8,
    roughness: 0.85,
    sheen: 0.35
  });
  const metalMat = makeMaterial(ctx, {
    color: cfg.accent,
    roughness: 0.25,
    metalness: 0.85,
    isFabric: false
  });

  // Cozy hoodie bodice
  const botY = -0.048 * bh;
  buildBodiceShell(ctx, {
    mat,
    slot: "top",
    name: "hoodieBodice",
    topY: 0.155 * bh,
    botY: botY + 0.016 * bh,
    offset: 0.0115,
    hemFlare: 0.004,
    bottomInfo
  });

  // Thick ribbed bottom waistband of hoodie
  const hemTopY = botY + 0.020 * bh;
  const hemGeo = buildThickTube(THREE, {
    uSegs: 56,
    vSegs: 10,
    thickness: 0.0052,
    rollRadius: 0.0040,
    uvScaleU: 6,
    uvScaleV: 0.6,
    evalFn(u, v) {
      const th = u * Math.PI * 2;
      const y = lerp(hemTopY, botY, v);
      const [trx, trz] = metrics.torsoProfile(y);
      let rx = trx + 0.0135;
      let rz = trz + 0.0135;
      if (bottomInfo) {
        const [brx, brz] = bottomInfo.outerAtPelvisY(y + metrics.waistYInPelvis);
        rx = Math.max(rx, brx + 0.006);
        rz = Math.max(rz, brz + 0.006);
      }
      const cinch = smoothstep(0.2, 1.0, v) * 0.0028 * bw;
      return [Math.sin(th) * (rx - cinch), y, Math.cos(th) * (rz - cinch)];
    }
  });
  addMesh(ctx, pivots.chest, hemGeo, ribMat, "top", "hoodieHemRib");

  // Long wrinkled sleeves with ribbed cuffs
  buildSleeves(ctx, {
    mat,
    cuffMat: ribMat,
    slot: "top",
    offset: 0.011,
    cuffStyle: "rib"
  });

  // Soft draped hood resting on the back and shoulders (open thick shell)
  const hoodGeo = buildThickTube(THREE, {
    uSegs: 48,
    vSegs: 24,
    thickness: 0.0052,
    rollRadius: 0.0044,
    topRollRadius: 0.0038,
    closedU: false,
    uvScaleU: 3,
    uvScaleV: 2,
    evalFn(u, v) {
      // u sweeps from front-left collar (0) around back (0.5) to front-right collar (1)
      // v=0 is attached neckline rim, v=1 is outer draped hood opening resting on upper back
      const th = lerp(0.26, Math.PI * 2 - 0.26, u);
      const sx = Math.sin(th);
      const cz = Math.cos(th);
      const backness = smoothstep(-0.1, 1.0, -cz); // 1 at back, 0 at front

      // Neckline base
      const nx = sx * (metrics.neckR + 0.013 * bw);
      const nz = cz * (metrics.neckR + 0.013 * bw);
      const ny = 0.150 * bh - Math.max(0, cz) * 0.010 * bh;

      // Draped hood outer contour: puffs softly around shoulders & drops over upper back
      const puffW = (0.072 + 0.016 * Math.sin(v * Math.PI)) * bw;
      const backDepth = metrics.chestRZ + (0.044 + 0.018 * Math.sin(v * Math.PI * 0.85)) * bw;
      const frontCollarZ = metrics.neckR + 0.016 * bw;

      const ox = sx * puffW;
      const oz = cz > 0
        ? cz * frontCollarZ
        : cz * lerp(metrics.neckR + 0.025 * bw, backDepth, Math.pow(v, 0.72));

      // Keep hood comfortably below the back of the head (head chin/skull base at chest y ~ 0.195)
      const crestLift = Math.sin(v * Math.PI) * 0.022 * bh * (0.4 + 0.6 * backness);
      const backDrop = Math.pow(v, 1.15) * 0.078 * bh * backness;
      const oy = 0.154 * bh + crestLift - backDrop - Math.max(0, cz) * 0.016 * bh;

      // Soft gravity cloth bunches across the resting hood back
      const bunch = Math.sin(u * Math.PI * 7) * 0.0038 * bw * Math.sin(v * Math.PI) * backness;
      const x = lerp(nx, ox, smoothstep(0, 0.85, v)) + sx * bunch;
      const z = lerp(nz, oz, smoothstep(0, 0.9, v)) + cz * bunch;
      const y = lerp(ny, oy, v);

      return [x, y, z];
    }
  });
  addMesh(ctx, pivots.chest, hoodGeo, mat, "top", "hoodieHood");

  // Kangaroo pocket as a raised thick curved patch with side openings
  const pocketTopY = 0.046 * bh;
  const pocketBotY = botY + 0.022 * bh;
  const pocketGeo = buildCurvedPatch(THREE, {
    uSegs: 28,
    vSegs: 16,
    thickness: 0.0042,
    evalFn(u, v) {
      // Trapezoid narrows at top where angled hand openings sit
      const halfSpan = lerp(0.46, 0.72, smoothstep(0.0, 0.62, v));
      const th = (u - 0.5) * 2 * halfSpan;
      const y = lerp(pocketTopY, pocketBotY, v);
      const [trx, trz] = metrics.torsoProfile(y);

      let rx = trx + 0.0165;
      let rz = trz + 0.0165;
      if (bottomInfo && y < 0.015 * bh) {
        const [brx, brz] = bottomInfo.outerAtPelvisY(y + metrics.waistYInPelvis);
        rx = Math.max(rx, brx + 0.0115);
        rz = Math.max(rz, brz + 0.0115);
      }

      // Soft puff in the center of the pocket
      const puff = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.0055 * bw;
      return [Math.sin(th) * (rx + puff), y, Math.cos(th) * (rz + puff)];
    }
  });
  addMesh(ctx, pivots.chest, pocketGeo, mat, "top", "kangarooPocket");

  // Dark shadowed pocket opening trim along left & right diagonal entrances
  const pocketShadowMat = makeMaterial(ctx, {
    color: new THREE.Color(cfg.topColor).multiplyScalar(0.42),
    roughness: 0.95,
    sheen: 0.2
  });
  for (const side of [1, -1]) {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const th = side * lerp(0.46, 0.71, t);
      const y = lerp(pocketTopY - 0.003 * bh, lerp(pocketTopY, pocketBotY, 0.62), t);
      const [trx, trz] = metrics.torsoProfile(y);
      const rx = trx + 0.0155;
      const rz = trz + 0.0155;
      pts.push(new THREE.Vector3(Math.sin(th) * rx, y, Math.cos(th) * rz));
    }
    const openGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.0022, 32, false);
    addMesh(ctx, pivots.chest, openGeo, pocketShadowMat, "top", `pocketOpening_${side}`);
  }

  // Drawstrings emerging from eyelets with metallic aglets
  const eyeletGeo = new THREE.TorusGeometry(0.0034, 0.0011, 16, 32);
  const agletGeo = new THREE.CylinderGeometry(0.0021, 0.0019, 0.011, 32);

  for (const side of [1, -1]) {
    const startY = 0.136 * bh;
    const [, trz0] = metrics.torsoProfile(startY);
    const startZ = trz0 + 0.0165;
    const startX = side * 0.016 * bw;

    const eyelet = addMesh(ctx, pivots.chest, eyeletGeo, metalMat, "accent", `hoodEyelet_${side}`);
    if (eyelet) {
      eyelet.position.set(startX, startY, startZ);
      eyelet.rotation.y = side * 0.22;
    }

    const cordPts = [];
    const cordLen = 0.072 * bh;
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const y = startY - t * cordLen;
      const [, trz] = metrics.torsoProfile(y);
      const x = startX + side * (0.004 * t + Math.sin(t * Math.PI * 1.4) * 0.0035) * bw;
      const z = trz + 0.0175 + Math.sin(t * Math.PI) * 0.004;
      cordPts.push(new THREE.Vector3(x, y, z));
    }
    const cordCurve = new THREE.CatmullRomCurve3(cordPts);
    const cordGeo = new THREE.TubeGeometry(cordCurve, 20, 0.0017, 32, false);
    addMesh(ctx, pivots.chest, cordGeo, cordMat, "accent", `drawstring_${side}`);

    const endPt = cordPts[cordPts.length - 1];
    const aglet = addMesh(ctx, pivots.chest, agletGeo, metalMat, "accent", `aglet_${side}`);
    if (aglet) {
      aglet.position.set(endPt.x, endPt.y - 0.005, endPt.z);
    }
  }
}

function buildCardigan(ctx, bottomInfo) {
  const { THREE, pivots, cfg, metrics } = ctx;
  const { bw, bh } = metrics;

  // Inner tee underneath
  const teeMat = makeMaterial(ctx, {
    color: cfg.accent,
    style: "jersey",
    repeatU: 5,
    repeatV: 5,
    roughness: 0.9,
    sheen: 0.45
  });
  buildBodiceShell(ctx, {
    mat: teeMat,
    slot: "accent",
    name: "cardiganInnerTee",
    topY: 0.153 * bh,
    botY: -0.022 * bh,
    offset: 0.0062,
    tucked: true,
    bottomInfo
  });
  buildNeckBand(ctx, teeMat, "accent", 0.160 * bh, 0.146 * bh, 0.007, 0.0026);

  // Open-front knit cardigan shell
  const cardMat = makeMaterial(ctx, {
    color: cfg.topColor,
    style: "knit",
    repeatU: 5,
    repeatV: 4,
    roughness: 0.9,
    sheen: 0.52
  });
  const ribMat = makeMaterial(ctx, {
    color: cfg.topColor,
    style: "rib",
    repeatU: 6,
    repeatV: 2,
    roughness: 0.92,
    sheen: 0.5
  });
  const btnMat = makeMaterial(ctx, {
    color: cfg.accent,
    roughness: 0.32,
    clearcoat: 0.45,
    isFabric: false
  });

  const botY = -0.068 * bh;
  const openAngle = 0.28;
  buildBodiceShell(ctx, {
    mat: cardMat,
    slot: "top",
    name: "cardiganBodice",
    topY: 0.156 * bh,
    botY,
    offset: 0.0128,
    hemFlare: 0.009,
    openFrontAngle: openAngle,
    vNeckDepth: 0.018 * bh,
    bottomInfo
  });

  // Ribbed front button bands (left & right plackets) wrapping around back neck
  for (const side of [1, -1]) {
    const placketPts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const y = lerp(0.150 * bh, botY + 0.003 * bh, t);
      const [trx, trz] = metrics.torsoProfile(y);
      let rx = trx + 0.014;
      let rz = trz + 0.014;
      if (bottomInfo && y < 0.016 * bh) {
        const [brx, brz] = bottomInfo.outerAtPelvisY(y + metrics.waistYInPelvis);
        rx = Math.max(rx, brx + 0.007);
        rz = Math.max(rz, brz + 0.007);
      }
      const th = side * lerp(openAngle * 1.15, openAngle, smoothstep(0.0, 0.35, t));
      placketPts.push(new THREE.Vector3(Math.sin(th) * rx, y, Math.cos(th) * rz));
    }
    const plCurve = new THREE.CatmullRomCurve3(placketPts);
    const plGeo = new THREE.TubeGeometry(plCurve, 28, 0.0052 * bw, 32, false);
    plGeo.scale(1.15, 1.0, 0.65);
    plGeo.computeVertexNormals();
    addMesh(ctx, pivots.chest, plGeo, ribMat, "top", `cardiganPlacket_${side}`);
  }

  // Buttons along right placket
  const btnGeo = makeButtonGeo(THREE, 0.0046 * bw, 0.0028);
  for (let i = 0; i < 4; i++) {
    const t = 0.25 + i * 0.20;
    const y = lerp(0.145 * bh, botY + 0.006 * bh, t);
    const [trx, trz] = metrics.torsoProfile(y);
    let rx = trx + 0.0175;
    let rz = trz + 0.0175;
    if (bottomInfo && y < 0.016 * bh) {
      const [brx, brz] = bottomInfo.outerAtPelvisY(y + metrics.waistYInPelvis);
      rx = Math.max(rx, brx + 0.010);
      rz = Math.max(rz, brz + 0.010);
    }
    const th = -openAngle;
    const btn = addMesh(ctx, pivots.chest, btnGeo, btnMat, "accent", `cardiganBtn_${i}`);
    if (btn) {
      btn.position.set(Math.sin(th) * rx, y, Math.cos(th) * rz);
      btn.rotation.y = th;
    }
  }

  // Knit sleeves with elbow folds & ribbed cuffs
  buildSleeves(ctx, {
    mat: cardMat,
    cuffMat: ribMat,
    slot: "top",
    offset: 0.011,
    cuffStyle: "rib"
  });
}

function buildSweater(ctx, bottomInfo) {
  const { THREE, pivots, cfg, metrics } = ctx;
  const { bh } = metrics;

  const mat = makeMaterial(ctx, {
    color: cfg.topColor,
    style: "knit",
    repeatU: 5,
    repeatV: 4,
    roughness: 0.9,
    sheen: 0.55
  });
  const ribMat = makeMaterial(ctx, {
    color: cfg.topColor,
    style: "rib",
    repeatU: 7,
    repeatV: 1.5,
    roughness: 0.92,
    sheen: 0.5
  });

  const botY = -0.048 * bh;
  buildBodiceShell(ctx, {
    mat,
    slot: "top",
    name: "sweaterBodice",
    topY: 0.155 * bh,
    botY: botY + 0.018 * bh,
    offset: 0.011,
    hemFlare: 0.003,
    cableRelief: true,
    bottomInfo
  });

  // Chunky ribbed bottom hem
  const hemGeo = buildThickTube(THREE, {
    uSegs: 56,
    vSegs: 10,
    thickness: 0.0052,
    rollRadius: 0.0040,
    uvScaleU: 7,
    uvScaleV: 0.6,
    evalFn(u, v) {
      const th = u * Math.PI * 2;
      const y = lerp(botY + 0.022 * bh, botY, v);
      const [trx, trz] = metrics.torsoProfile(y);
      let rx = trx + 0.013;
      let rz = trz + 0.013;
      if (bottomInfo) {
        const [brx, brz] = bottomInfo.outerAtPelvisY(y + metrics.waistYInPelvis);
        rx = Math.max(rx, brx + 0.0058);
        rz = Math.max(rz, brz + 0.0058);
      }
      const cinch = smoothstep(0.25, 1.0, v) * 0.0025 * metrics.bw;
      return [Math.sin(th) * (rx - cinch), y, Math.cos(th) * (rz - cinch)];
    }
  });
  addMesh(ctx, pivots.chest, hemGeo, ribMat, "top", "sweaterHemRib");

  // Plush ribbed mock-neck collar sitting cleanly around neck
  buildNeckBand(ctx, ribMat, "top", 0.174 * bh, 0.146 * bh, 0.011, 0.0042);

  // Knit long sleeves with elbow wrinkles & ribbed cuffs
  buildSleeves(ctx, {
    mat,
    cuffMat: ribMat,
    slot: "top",
    offset: 0.0108,
    cuffStyle: "rib"
  });
}

function buildShirt(ctx, bottomInfo) {
  const { THREE, pivots, cfg, metrics } = ctx;
  const { bw, bh } = metrics;

  const mat = makeMaterial(ctx, {
    color: cfg.topColor,
    style: "weave",
    repeatU: 6,
    repeatV: 5,
    roughness: 0.88,
    sheen: 0.5
  });
  const btnMat = makeMaterial(ctx, {
    color: cfg.accent,
    roughness: 0.25,
    clearcoat: 0.6,
    isFabric: false
  });

  // Tailored tucked bodice
  buildBodiceShell(ctx, {
    mat,
    slot: "top",
    name: "shirtBodice",
    topY: 0.155 * bh,
    botY: -0.016 * bh,
    offset: 0.0082,
    tucked: true,
    bottomInfo
  });

  // Standing collar band around neck
  buildNeckBand(ctx, mat, "top", 0.172 * bh, 0.148 * bh, 0.0085, 0.0024);

  // Folded pointed shirt collar (bent curved shell sitting on neck)
  const collarGeo = buildThickTube(THREE, {
    uSegs: 48,
    vSegs: 14,
    thickness: 0.0032,
    rollRadius: 0.0022,
    topRollRadius: 0.0022,
    closedU: false,
    uvScaleU: 3,
    uvScaleV: 1,
    evalFn(u, v) {
      // Sweeps from front-left point around back of neck to front-right point
      const th = lerp(0.18, Math.PI * 2 - 0.18, u);
      const sx = Math.sin(th);
      const cz = Math.cos(th);
      const frontPoint = Math.pow(Math.max(0, cz), 2.5);

      const baseR = metrics.neckR + 0.0095 * bw;
      const spread = (0.018 + frontPoint * 0.014) * bw;
      // Arched fold profile: lifts slightly at crease (v ~ 0.15), then folds down onto chest
      const r = baseR + spread * Math.pow(v, 0.85);
      const yCrease = 0.170 * bh - Math.max(0, cz) * 0.006 * bh;
      const drop = (0.020 + frontPoint * 0.014) * bh;
      const y = yCrease + Math.sin(v * Math.PI * 0.6) * 0.004 * bh - drop * Math.pow(v, 1.15);

      return [sx * r, y, cz * r];
    }
  });
  addMesh(ctx, pivots.chest, collarGeo, mat, "top", "shirtCollar");

  // Front center placket + buttons
  const placketPts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const y = lerp(0.145 * bh, 0.004 * bh, t);
    const [, trz] = metrics.torsoProfile(y);
    const blouse = Math.exp(-Math.pow((y - 0.024 * bh) / (0.022 * bh), 2)) * 0.005 * bw;
    placketPts.push(new THREE.Vector3(0, y, trz + 0.0088 + blouse));
  }
  const plGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(placketPts), 20, 0.0042 * bw, 32, false);
  plGeo.scale(1.4, 1.0, 0.35);
  plGeo.computeVertexNormals();
  addMesh(ctx, pivots.chest, plGeo, mat, "top", "shirtPlacket");

  const btnGeo = makeButtonGeo(THREE, 0.0034 * bw, 0.0020);
  for (let i = 0; i < 4; i++) {
    const t = 0.15 + i * 0.24;
    const p = new THREE.CatmullRomCurve3(placketPts).getPoint(t);
    const btn = addMesh(ctx, pivots.chest, btnGeo, btnMat, "accent", `shirtBtn_${i}`);
    if (btn) btn.position.set(0, p.y, p.z + 0.0018);
  }

  // Long sleeves with elbow folds & crisp buttoned cuffs
  buildSleeves(ctx, {
    mat,
    slot: "top",
    offset: 0.009,
    cuffStyle: "shirt",
    buttonMat: btnMat
  });
}

function buildTee(ctx, bottomInfo) {
  const { cfg, metrics } = ctx;
  const { bh } = metrics;

  const mat = makeMaterial(ctx, {
    color: cfg.topColor,
    style: "jersey",
    repeatU: 5,
    repeatV: 5,
    roughness: 0.9,
    sheen: 0.5
  });
  const ribMat = makeMaterial(ctx, {
    color: cfg.topColor,
    style: "rib",
    repeatU: 8,
    repeatV: 1,
    roughness: 0.92,
    sheen: 0.5
  });

  buildBodiceShell(ctx, {
    mat,
    slot: "top",
    name: "teeBodice",
    topY: 0.153 * bh,
    botY: -0.044 * bh,
    offset: 0.009,
    hemFlare: 0.004,
    bottomInfo
  });

  buildNeckBand(ctx, ribMat, "top", 0.161 * bh, 0.147 * bh, 0.0085, 0.003);

  buildSleeves(ctx, {
    mat,
    slot: "top",
    short: true,
    offset: 0.0092,
    cuffStyle: "none"
  });
}

function buildBlazer(ctx, bottomInfo) {
  const { THREE, pivots, cfg, metrics } = ctx;
  const { bw, bh } = metrics;

  // Inner blouse underneath blazer
  const innerMat = makeMaterial(ctx, {
    color: cfg.accent,
    style: "weave",
    repeatU: 6,
    repeatV: 5,
    roughness: 0.88,
    sheen: 0.45
  });
  buildBodiceShell(ctx, {
    mat: innerMat,
    slot: "accent",
    name: "blazerInnerTop",
    topY: 0.153 * bh,
    botY: -0.020 * bh,
    offset: 0.0062,
    tucked: true,
    bottomInfo
  });
  buildNeckBand(ctx, innerMat, "accent", 0.160 * bh, 0.146 * bh, 0.0072, 0.0024);

  // Structured suiting blazer jacket
  const mat = makeMaterial(ctx, {
    color: cfg.topColor,
    style: "suiting",
    repeatU: 5,
    repeatV: 4,
    roughness: 0.88,
    sheen: 0.52
  });
  const btnMat = makeMaterial(ctx, {
    color: cfg.accent,
    roughness: 0.28,
    metalness: 0.6,
    isFabric: false
  });

  const botY = -0.072 * bh;
  // Jacket shell: open V at top chest, meets at waist button, slight cutaway split below
  const blazerGeo = buildThickTube(THREE, {
    uSegs: 56,
    vSegs: 32,
    thickness: 0.0048,
    rollRadius: 0.0036,
    topRollRadius: 0.0028,
    closedU: false,
    uvScaleU: 4,
    uvScaleV: 3.5,
    evalFn(u, v) {
      const y = lerp(0.156 * bh, botY, v);
      // Opening angle narrows from V-neck at top to closed waist closure, then opens slightly at hem
      const topOpen = lerp(0.42, 0.03, smoothstep(0.0, 0.62, v));
      const botCutaway = smoothstep(0.66, 1.0, v) * 0.24;
      const openA = Math.max(topOpen, botCutaway);
      const th = openA + u * (Math.PI * 2 - openA * 2);

      const sx = Math.sin(th);
      const cz = Math.cos(th);
      const [trx, trz] = metrics.torsoProfile(y);

      let rx = trx + 0.0125;
      let rz = trz + 0.0125;

      // Structured blazer shoulders
      const shoulderPad = Math.exp(-Math.pow((y - 0.136 * bh) / (0.020 * bh), 2)) * Math.pow(Math.abs(sx), 2);
      rx += shoulderPad * 0.0085 * bw;

      // Tailored peplum flare below waist
      const flare = smoothstep(0.55, 1.0, v) * 0.012 * bw;
      rx += flare;
      rz += flare;

      if (bottomInfo && y < 0.016 * bh) {
        const [brx, brz] = bottomInfo.outerAtPelvisY(y + metrics.waistYInPelvis);
        const clearT = smoothstep(0.016 * bh, -0.008 * bh, y);
        rx = Math.max(rx, lerp(rx, brx + 0.006, clearT));
        rz = Math.max(rz, lerp(rz, brz + 0.006, clearT));
      }

      return [sx * rx, y, cz * rz];
    }
  });
  addMesh(ctx, pivots.chest, blazerGeo, mat, "top", "blazerBodice");

  // Standing back collar connecting into notched lapels
  const backCollarGeo = buildThickTube(THREE, {
    uSegs: 36,
    vSegs: 10,
    thickness: 0.0038,
    rollRadius: 0.0024,
    closedU: false,
    uvScaleU: 2,
    uvScaleV: 0.6,
    evalFn(u, v) {
      const th = lerp(0.55, Math.PI * 2 - 0.55, u);
      const y = lerp(0.170 * bh, 0.148 * bh, v);
      const r = metrics.neckR + 0.011 * bw + v * 0.008 * bw;
      return [Math.sin(th) * r, y, Math.cos(th) * r];
    }
  });
  addMesh(ctx, pivots.chest, backCollarGeo, mat, "top", "blazerCollar");

  // Crisp notched lapels folding back against upper chest
  for (const side of [1, -1]) {
    const lapelGeo = buildCurvedPatch(THREE, {
      uSegs: 16,
      vSegs: 18,
      thickness: 0.0034,
      evalFn(u, v) {
        // v = 0 at neck/collar notch, v = 1 at waist button point
        const y = lerp(0.150 * bh, 0.016 * bh, v);
        const [trx, trz] = metrics.torsoProfile(y);

        // Inner fold edge follows blazer V-opening
        const innerA = lerp(0.40, 0.05, v);
        // Outer lapel edge peaks cleanly at mid-chest with a classic notch near v = 0.20
        const notchDip = 1 - Math.exp(-Math.pow((v - 0.18) / 0.055, 2)) * 0.45;
        const lapelWidth = Math.sin(Math.pow(v, 0.65) * Math.PI) * 0.36 * notchDip;
        const outerA = innerA + lapelWidth;

        const th = side * lerp(innerA, outerA, u);
        // Lift outer edge slightly off the bodice for crisp lapel shadow
        const lift = 0.0155 + u * 0.0032;
        return [Math.sin(th) * (trx + lift), y, Math.cos(th) * (trz + lift)];
      }
    });
    addMesh(ctx, pivots.chest, lapelGeo, mat, "top", `blazerLapel_${side}`);

    // Tailored hip pocket flaps
    const flapGeo = buildCurvedPatch(THREE, {
      uSegs: 14,
      vSegs: 6,
      thickness: 0.0030,
      evalFn(u, v) {
        const th = side * lerp(0.32, 0.78, u);
        const y = lerp(-0.012 * bh, -0.028 * bh, v);
        const [trx, trz] = metrics.torsoProfile(y);
        let rx = trx + 0.0165;
        let rz = trz + 0.0165;
        if (bottomInfo) {
          const [brx, brz] = bottomInfo.outerAtPelvisY(y + metrics.waistYInPelvis);
          rx = Math.max(rx, brx + 0.0095);
          rz = Math.max(rz, brz + 0.0095);
        }
        return [Math.sin(th) * rx, y, Math.cos(th) * rz];
      }
    });
    addMesh(ctx, pivots.chest, flapGeo, mat, "top", `blazerPocketFlap_${side}`);
  }

  // Single waist closure button
  const waistY = 0.014 * bh;
  const [, trzW] = metrics.torsoProfile(waistY);
  const singleBtn = addMesh(
    ctx,
    pivots.chest,
    makeButtonGeo(THREE, 0.0054 * bw, 0.0032),
    btnMat,
    "accent",
    "blazerButton"
  );
  if (singleBtn) {
    singleBtn.position.set(0, waistY, trzW + 0.0168);
  }

  // Tailored long sleeves with elbow creases & mini cuff buttons
  buildSleeves(ctx, {
    mat,
    slot: "top",
    offset: 0.0105,
    cuffStyle: "blazer",
    buttonMat: btnMat
  });
}

/* ============================================================================
 * SOCKS (none, ankle, knee)
 * ========================================================================== */

function buildSocks(ctx) {
  const { THREE, pivots, cfg, metrics } = ctx;
  if (!cfg.socks || cfg.socks === "none") return;

  const { bw, bh, shinLen } = metrics;
  const isKnee = cfg.socks === "knee";

  const sockMat = makeMaterial(ctx, {
    color: cfg.sockColor,
    style: "ribSock",
    repeatU: 3,
    repeatV: isKnee ? 4 : 1.5,
    roughness: 0.92,
    sheen: 0.5
  });
  const cuffMat = makeMaterial(ctx, {
    color: cfg.sockColor,
    style: "rib",
    repeatU: 5,
    repeatV: 0.8,
    roughness: 0.92,
    sheen: 0.5
  });

  const topY = isKnee ? -0.028 * bh : -0.108 * bh;
  const botY = -shinLen - 0.004 * bh;
  const cuffHeight = isKnee ? 0.024 * bh : 0.018 * bh;

  for (const side of [1, -1]) {
    const shinPivot = side > 0 ? pivots.shinL : pivots.shinR;
    const footPivot = side > 0 ? pivots.footL : pivots.footR;
    const tag = side > 0 ? "L" : "R";

    // Main shin sock shell (thin, hugs leg closely at +0.0042 so shoes & trousers clear it)
    const tubeGeo = buildThickTube(THREE, {
      uSegs: 36,
      vSegs: isKnee ? 22 : 12,
      thickness: 0.0022,
      rollRadius: 0.0018,
      uvScaleU: 2.5,
      uvScaleV: isKnee ? 3.5 : 1.2,
      evalFn(u, v) {
        const th = u * Math.PI * 2;
        const y = lerp(topY - cuffHeight * 0.7, botY, v);
        const tLen = clamp(-y / shinLen, 0, 1);
        const calf = Math.exp(-Math.pow((tLen - 0.34) / 0.24, 2)) * 0.002 * bw;
        const r = lerp(metrics.kneeR, metrics.ankleR, tLen) + calf + 0.0042;
        return [Math.sin(th) * r, y, Math.cos(th) * r];
      }
    });
    addMesh(ctx, shinPivot, tubeGeo, sockMat, "socks", `sockShin_${tag}`);

    // Distinct ribbed top cuff band
    const cuffGeo = buildThickTube(THREE, {
      uSegs: 36,
      vSegs: 8,
      thickness: 0.0028,
      rollRadius: 0.0024,
      uvScaleU: 3,
      uvScaleV: 0.6,
      evalFn(u, v) {
        const th = u * Math.PI * 2;
        const y = lerp(topY, topY - cuffHeight, v);
        const tLen = clamp(-y / shinLen, 0, 1);
        const calf = Math.exp(-Math.pow((tLen - 0.34) / 0.24, 2)) * 0.002 * bw;
        const r = lerp(metrics.kneeR, metrics.ankleR, tLen) + calf + 0.0052;
        return [Math.sin(th) * r, y, Math.cos(th) * r];
      }
    });
    addMesh(ctx, shinPivot, cuffGeo, cuffMat, "socks", `sockCuff_${tag}`);

    // Foot sock covering ankle & instep (visible inside Mary Janes & loafers!)
    const footSockGeo = buildFootSockGeo(THREE, metrics, side);
    addMesh(ctx, footPivot, footSockGeo, sockMat, "socks", `sockFoot_${tag}`);
  }
}

function buildFootSockGeo(THREE, metrics, side) {
  const { footMinY, footMaxY, footMinZ, footMaxZ, footHalfW } = metrics;
  const footLen = footMaxZ - footMinZ;
  const footH = footMaxY - footMinY;

  // Smooth closed ellipsoid-like sock sleeve wrapping the foot + ankle
  const geo = new THREE.SphereGeometry(1, 36, 24);
  const pos = geo.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    // Map z in [-1, 1] to [footMinZ - 0.003, footMaxZ + 0.003]
    const tz = (z + 1) * 0.5;
    const widthScale = lerp(0.82, 1.06, Math.sin(Math.pow(tz, 0.8) * Math.PI)) * (footHalfW + 0.0036);
    const px = x * widthScale + side * 0.001 * Math.sin(tz * Math.PI);
    const pz = lerp(footMinZ - 0.0035, footMaxZ + 0.0035, tz);

    // Flat underside, arched instep sloping toward toe
    const toeLower = smoothstep(0.42, 1.0, tz) * 0.38;
    const localTop = lerp(footMaxY + 0.016, footMinY + footH * 0.62, toeLower);
    const localBot = footMinY + 0.001;
    const py = y >= 0
      ? lerp((localBot + localTop) * 0.5, localTop, Math.pow(y, 0.85))
      : lerp((localBot + localTop) * 0.5, localBot, Math.pow(-y, 0.65));

    pos.setXYZ(i, px, py, pz);
  }
  geo.computeVertexNormals();
  return geo;
}

/* ============================================================================
 * SHOES (sneakers, maryJanes, boots, loafers)
 * ========================================================================== */

function buildShoes(ctx, bottomInfo) {
  const { cfg } = ctx;
  switch (cfg.shoes) {
    case "sneakers":
      buildSneakers(ctx);
      break;
    case "boots":
      buildBoots(ctx, bottomInfo);
      break;
    case "loafers":
      buildLoafers(ctx);
      break;
    case "maryJanes":
    default:
      buildMaryJanes(ctx);
      break;
  }
}

/**
 * Computes a cute anatomical chibi shoe last contour in (x, z) for angle theta in [0, 2*PI]
 * (theta = 0 is +z toe tip, PI is -z heel back).
 */
function shoeLastXZ(metrics, side, th, scaleW = 1.0, scaleL = 1.0) {
  const { footMinZ, footMaxZ, footHalfW } = metrics;
  const centerZ = (footMinZ + footMaxZ) * 0.5 + 0.002;
  const halfLen = (footMaxZ - footMinZ) * 0.5 * scaleL + 0.007;
  const cz = Math.cos(th);
  const sx = Math.sin(th);

  // Broad rounded toe box, gentle midfoot waist, snug rounded heel
  const foreWeight = smoothstep(-0.3, 0.65, cz);
  const heelNarrow = smoothstep(-0.2, -0.95, cz) * 0.22;
  const waistNip = Math.exp(-Math.pow((cz + 0.12) / 0.28, 2)) * 0.08;
  const toeFullness = Math.pow(Math.max(0, cz), 0.7) * 0.14;

  const baseHalfW = (footHalfW + 0.0075) * scaleW;
  const wFactor = 1.0 + foreWeight * 0.12 - heelNarrow - waistNip + toeFullness;

  // Slight anatomical medial/lateral asymmetry (fuller on big-toe side)
  const asym = sx * side > 0 ? 1.03 : 0.98;
  const x = sx * baseHalfW * wFactor * asym;
  const z = centerZ + cz * halfLen;

  return [x, z];
}

function buildSoleAndWelt(ctx, footPivot, tag, side, optsSole) {
  const { THREE, metrics } = ctx;
  const {
    soleMat,
    weltMat,
    soleSlot = "shoeSole",
    soleThick = 0.011,
    heelBoost = 0.005,
    scaleW = 1.06,
    scaleL = 1.04
  } = optsSole;

  const soleTopY = metrics.footMinY + 0.007;
  const soleBotY = soleTopY - soleThick;

  // Extruded beveled sole shape (in XY then rotated to XZ)
  const shape = new THREE.Shape();
  const segs = 48;
  for (let i = 0; i <= segs; i++) {
    const th = (i / segs) * Math.PI * 2;
    const [x, z] = shoeLastXZ(metrics, side, th, scaleW, scaleL);
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  }

  const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: soleThick - 0.003,
    bevelEnabled: true,
    bevelThickness: 0.0018,
    bevelSize: 0.0016,
    bevelSegments: 5,
    curveSegments: 32
  });
  extrudeGeo.rotateX(-Math.PI * 0.5);
  extrudeGeo.translate(0, soleBotY + 0.0018, 0);
  extrudeGeo.computeVertexNormals();
  addMesh(ctx, footPivot, extrudeGeo, soleMat, soleSlot, `sole_${tag}`);

  // Optional sculpted block heel underneath rear sole
  if (heelBoost > 0.0005) {
    const heelShape = new THREE.Shape();
    for (let i = 0; i <= 32; i++) {
      const t = i / 32;
      const th = lerp(Math.PI * 0.62, Math.PI * 1.38, t);
      const [x, z] = shoeLastXZ(metrics, side, th, scaleW * 0.96, scaleL * 0.98);
      if (i === 0) heelShape.moveTo(x, -z);
      else heelShape.lineTo(x, -z);
    }
    heelShape.closePath();
    const heelGeo = new THREE.ExtrudeGeometry(heelShape, {
      depth: heelBoost,
      bevelEnabled: true,
      bevelThickness: 0.001,
      bevelSize: 0.001,
      bevelSegments: 4,
      curveSegments: 32
    });
    heelGeo.rotateX(-Math.PI * 0.5);
    heelGeo.translate(0, soleBotY - heelBoost + 0.001, 0);
    heelGeo.computeVertexNormals();
    addMesh(ctx, footPivot, heelGeo, soleMat, soleSlot, `heelBlock_${tag}`);
  }

  // Crisp stitched welt running around the perimeter where upper meets sole
  const weltPts = [];
  for (let i = 0; i < 48; i++) {
    const th = (i / 48) * Math.PI * 2;
    const [x, z] = shoeLastXZ(metrics, side, th, scaleW * 0.99, scaleL * 0.99);
    weltPts.push(new THREE.Vector3(x, soleTopY + 0.001, z));
  }
  const weltCurve = new THREE.CatmullRomCurve3(weltPts, true);
  const weltGeo = new THREE.TubeGeometry(weltCurve, 64, 0.0022, 32, true);
  addMesh(ctx, footPivot, weltGeo, weltMat, "accent", `welt_${tag}`);

  return { soleTopY, soleBotY };
}

/**
 * Builds a closed, sculpted hollow shoe upper shell with anatomical collar opening,
 * rounded vamp/instep, and closed toe box.
 */
function buildShoeUpperShell(THREE, metrics, side, params) {
  const {
    soleTopY,
    heelHeight = 0.044,
    vampCutZ = 0.012,
    collarDip = 0.012,
    scaleW = 1.0,
    scaleL = 1.0,
    thickness = 0.0038
  } = params;

  const { footMaxZ } = metrics;
  const toeTipZ = footMaxZ + 0.007 * scaleL;

  return buildThickTube(THREE, {
    uSegs: 48,
    vSegs: 24,
    thickness,
    rollRadius: 0.0026,
    topRollRadius: 0.0030,
    uvScaleU: 3,
    uvScaleV: 1.5,
    evalFn(u, v) {
      const th = u * Math.PI * 2;
      const sx = Math.sin(th);
      const cz = Math.cos(th);

      // Base sole perimeter point
      const [bx, bz] = shoeLastXZ(metrics, side, th, scaleW, scaleL);

      // Top collar opening contour (centered around ankle at z = 0)
      const ankleR = metrics.ankleR + 0.0085;
      let topX = sx * ankleR * 1.02;
      let topZ = cz > 0
        ? lerp(vampCutZ, vampCutZ + 0.018, Math.pow(cz, 0.7))
        : cz * (ankleR * 1.15);

      // Collar height drops smoothly along sides and dips over the instep vamp
      const sideDip = Math.pow(Math.abs(sx), 2) * collarDip;
      const frontDrop = Math.pow(Math.max(0, cz), 1.4) * (heelHeight * 0.42);
      const topY = soleTopY + heelHeight - sideDip - frontDrop;

      // Interpolate from collar (v = 0) down to sole (v = 1) with plump dome over toe box
      const tDome = Math.pow(v, 0.72);
      const x = lerp(topX, bx, tDome);
      const z = lerp(topZ, bz, tDome);

      // Rounded toe dome & arched instep profile
      const toeArc = Math.sin(v * Math.PI) * 0.014 * Math.pow(Math.max(0, cz), 1.2);
      const y = lerp(topY, soleTopY - 0.001, Math.pow(v, 1.08)) + toeArc;

      // Ensure toe stays smoothly capped
      return [x, y, Math.min(z, toeTipZ + 0.006)];
    }
  });
}

function buildToeCap(THREE, metrics, side, soleTopY, height = 0.024, scaleW = 1.02, scaleL = 1.02) {
  return buildCurvedPatch(THREE, {
    uSegs: 28,
    vSegs: 14,
    thickness: 0.0026,
    evalFn(u, v) {
      // Sweeps around front toe arc (-72 deg to +72 deg)
      const th = lerp(-1.26, 1.26, u);
      const cz = Math.cos(th);
      const [bx, bz] = shoeLastXZ(metrics, side, th, scaleW, scaleL);

      // Rear seam of toe cap arches gently over toe box
      const capStartZ = lerp(metrics.footMaxZ - 0.016, bz, Math.pow(v, 0.75));
      const x = bx * lerp(0.76, 1.015, Math.pow(v, 0.62));
      const z = lerp(capStartZ, bz + 0.0025, Math.pow(v, 0.72));
      const dome = Math.sin(v * Math.PI * 0.75) * 0.006 * Math.max(0, cz);
      const y = lerp(soleTopY + height * Math.max(0.3, cz), soleTopY, Math.pow(v, 1.15)) + dome;

      return [x, y, z];
    }
  });
}

function buildSneakers(ctx) {
  const { THREE, pivots, cfg, metrics } = ctx;
  const { bw } = metrics;

  const upperMat = makeMaterial(ctx, {
    color: cfg.shoeColor,
    style: "canvas",
    repeatU: 4,
    repeatV: 3,
    roughness: 0.85,
    sheen: 0.35
  });
  const soleMat = makeMaterial(ctx, {
    color: "#f2efe9",
    roughness: 0.72,
    isFabric: false
  });
  const weltMat = makeMaterial(ctx, {
    color: cfg.accent,
    roughness: 0.55,
    isFabric: false
  });
  const laceMat = makeMaterial(ctx, {
    color: "#faf8f4",
    style: "weave",
    repeatU: 2,
    repeatV: 6,
    roughness: 0.88,
    sheen: 0.3
  });
  const eyeletMat = makeMaterial(ctx, {
    color: cfg.accent,
    roughness: 0.22,
    metalness: 0.88,
    isFabric: false
  });

  const eyeletGeo = new THREE.TorusGeometry(0.0024, 0.0008, 16, 32);

  for (const side of [1, -1]) {
    const footPivot = side > 0 ? pivots.footL : pivots.footR;
    const tag = side > 0 ? "L" : "R";

    const { soleTopY } = buildSoleAndWelt(ctx, footPivot, tag, side, {
      soleMat,
      weltMat,
      soleSlot: "shoeSole",
      soleThick: 0.013,
      heelBoost: 0,
      scaleW: 1.07,
      scaleL: 1.05
    });

    // Canvas upper
    const upperGeo = buildShoeUpperShell(THREE, metrics, side, {
      soleTopY,
      heelHeight: 0.044,
      vampCutZ: 0.022,
      collarDip: 0.009,
      scaleW: 1.02,
      scaleL: 1.01
    });
    addMesh(ctx, footPivot, upperGeo, upperMat, "shoes", `sneakerUpper_${tag}`);

    // Classic rubber toe cap
    const toeGeo = buildToeCap(THREE, metrics, side, soleTopY, 0.022, 1.04, 1.03);
    addMesh(ctx, footPivot, toeGeo, soleMat, "shoeSole", `sneakerToeCap_${tag}`);

    // Padded tongue arching up the instep
    const tongueGeo = buildCurvedPatch(THREE, {
      uSegs: 16,
      vSegs: 14,
      thickness: 0.0034,
      evalFn(u, v) {
        const w = (0.012 + Math.sin(v * Math.PI) * 0.003) * bw;
        const x = (u - 0.5) * 2 * w;
        const arch = Math.cos((u - 0.5) * Math.PI) * 0.005;
        const z = lerp(0.011, 0.042, v);
        const y = lerp(soleTopY + 0.050, soleTopY + 0.022, Math.pow(v, 0.9)) + arch;
        return [x, y, z];
      }
    });
    addMesh(ctx, footPivot, tongueGeo, upperMat, "shoes", `sneakerTongue_${tag}`);

    // 4 pairs of eyelets + crisscross laces + tied bow
    const rows = 4;
    const leftPts = [];
    const rightPts = [];
    for (let i = 0; i < rows; i++) {
      const t = i / (rows - 1);
      const z = lerp(0.040, 0.018, t);
      const y = lerp(soleTopY + 0.027, soleTopY + 0.044, t);
      const halfW = lerp(0.0115, 0.0135, t) * bw;

      for (const s of [1, -1]) {
        const ex = s * halfW;
        const eye = addMesh(ctx, footPivot, eyeletGeo, eyeletMat, "accent", `eyelet_${tag}_${i}_${s}`);
        if (eye) {
          eye.position.set(ex, y, z);
          eye.rotation.x = Math.PI * 0.32;
          eye.rotation.y = s * 0.3;
        }
      }
      leftPts.push(new THREE.Vector3(-halfW, y + 0.0014, z));
      rightPts.push(new THREE.Vector3(halfW, y + 0.0014, z));
    }

    // Straight bottom bar lace + crisscross pairs
    const addLaceSeg = (pA, pB, idx) => {
      const mid = pA.clone().lerp(pB, 0.5);
      mid.y += 0.0022;
      mid.z += 0.0012;
      const curve = new THREE.CatmullRomCurve3([pA, mid, pB]);
      const geo = new THREE.TubeGeometry(curve, 14, 0.0014, 32, false);
      addMesh(ctx, footPivot, geo, laceMat, "accent", `lace_${tag}_${idx}`);
    };

    addLaceSeg(leftPts[0], rightPts[0], "bar");
    for (let i = 0; i < rows - 1; i++) {
      addLaceSeg(leftPts[i], rightPts[i + 1], `xA_${i}`);
      addLaceSeg(rightPts[i], leftPts[i + 1], `xB_${i}`);
    }

    // Tied lace bow at top of tongue
    const knotPos = leftPts[rows - 1].clone().lerp(rightPts[rows - 1], 0.5);
    knotPos.y += 0.0025;
    for (const s of [1, -1]) {
      const loopCurve = new THREE.CatmullRomCurve3([
        knotPos.clone(),
        knotPos.clone().add(new THREE.Vector3(s * 0.010, 0.006, 0.003)),
        knotPos.clone().add(new THREE.Vector3(s * 0.014, 0.000, 0.004)),
        knotPos.clone().add(new THREE.Vector3(s * 0.007, -0.003, 0.002)),
        knotPos.clone()
      ]);
      const loopGeo = new THREE.TubeGeometry(loopCurve, 20, 0.0013, 32, false);
      addMesh(ctx, footPivot, loopGeo, laceMat, "accent", `bowLoop_${tag}_${s}`);

      const tipCurve = new THREE.CatmullRomCurve3([
        knotPos.clone(),
        knotPos.clone().add(new THREE.Vector3(s * 0.007, -0.004, 0.004)),
        knotPos.clone().add(new THREE.Vector3(s * 0.011, -0.010, 0.005))
      ]);
      const tipGeo = new THREE.TubeGeometry(tipCurve, 12, 0.0012, 32, false);
      addMesh(ctx, footPivot, tipGeo, laceMat, "accent", `bowTip_${tag}_${s}`);
    }
  }
}

function buildMaryJanes(ctx) {
  const { THREE, pivots, cfg, metrics } = ctx;
  const { bw } = metrics;

  // Glossy patent-leather Mary Janes with rich clearcoat
  const upperMat = makeMaterial(ctx, {
    color: cfg.shoeColor,
    style: "leather",
    repeatU: 3,
    repeatV: 3,
    roughness: 0.18,
    sheen: 0.12,
    clearcoat: 0.92,
    clearcoatRoughness: 0.09,
    bumpScale: 0.0006,
    isFabric: false
  });
  const soleMat = makeMaterial(ctx, {
    color: new THREE.Color(cfg.shoeColor).multiplyScalar(0.45),
    roughness: 0.55,
    clearcoat: 0.25,
    isFabric: false
  });
  const buckleMat = makeMaterial(ctx, {
    color: cfg.accent,
    roughness: 0.18,
    metalness: 0.92,
    isFabric: false
  });

  for (const side of [1, -1]) {
    const footPivot = side > 0 ? pivots.footL : pivots.footR;
    const tag = side > 0 ? "L" : "R";

    const { soleTopY } = buildSoleAndWelt(ctx, footPivot, tag, side, {
      soleMat,
      weltMat: soleMat,
      soleSlot: "shoeSole",
      soleThick: 0.009,
      heelBoost: 0.006,
      scaleW: 1.04,
      scaleL: 1.03
    });

    // Low-cut glossy upper showing the sock/instep
    const upperGeo = buildShoeUpperShell(THREE, metrics, side, {
      soleTopY,
      heelHeight: 0.036,
      vampCutZ: 0.032,
      collarDip: 0.014,
      scaleW: 1.01,
      scaleL: 1.01
    });
    addMesh(ctx, footPivot, upperGeo, upperMat, "shoes", `maryJaneUpper_${tag}`);

    // Glossy sculpted toe cap
    const toeGeo = buildToeCap(THREE, metrics, side, soleTopY, 0.021, 1.02, 1.02);
    addMesh(ctx, footPivot, toeGeo, upperMat, "shoes", `maryJaneToeCap_${tag
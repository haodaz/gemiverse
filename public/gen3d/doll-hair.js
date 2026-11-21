export function buildHair(THREE, opts = {}, kit) {
  const hairStyle = opts.hairStyle || "longStraight";
  const fringe = opts.fringe || "full";
  const bodyWidth = clamp(opts.bodyWidth ?? 1.0, 0.8, 1.3);
  const bodyHeight = clamp(opts.bodyHeight ?? 1.0, 0.9, 1.1);

  const HC_Y = 0.14;
  const RX = 0.15;
  const RY = 0.155;
  const RZ = 0.145;

  const noise2D =
    kit && typeof kit.noise === "function"
      ? (x, y) => kit.noise(x, y)
      : (x, y) => 0.5 + 0.5 * Math.sin(x * 12.9898 + y * 78.233);

  const seed = hashString(`${hairStyle}|${fringe}`);
  const rand = mulberry32(seed);

  const baseColor = new THREE.Color(opts.hairColor ?? "#4a3022");
  const highlightColor = opts.highlight
    ? new THREE.Color(opts.highlight)
    : deriveHighlight(THREE, baseColor);
  const accessoryColor = deriveAccessoryColor(THREE, baseColor, opts.accessoryColor || opts.accentColor);

  const hairMat = createHairMaterial(THREE, baseColor, highlightColor, kit, noise2D);

  const rootGroup = new THREE.Group();
  rootGroup.name = "hair";
  const swayLocks = [];
  rootGroup.userData.swayLocks = swayLocks;

  // 1. Thin scalp cap following a natural hairline (no skin shows between strands)
  const capGeo = buildScalpCapGeometry(THREE, hairStyle, RX, RY, RZ, HC_Y);
  const capMesh = new THREE.Mesh(capGeo, hairMat);
  capMesh.name = "hairScalpCap";
  capMesh.castShadow = true;
  capMesh.receiveShadow = true;
  capMesh.userData.slot = "hair";
  rootGroup.add(capMesh);

  // Geometry & collision context shared by all lock builders
  const ctx = {
    THREE,
    hairMat,
    rootGroup,
    swayLocks,
    rand,
    noise2D,
    HC_Y,
    RX,
    RY,
    RZ,
    bw: bodyWidth,
    bh: bodyHeight,
  };

  // 2. Build main hair style locks (under, middle, top layers) + accessories
  switch (hairStyle) {
    case "longWavy":
      buildLongStyle(ctx, true);
      break;
    case "bob":
      buildBobStyle(ctx);
      break;
    case "shortLayered":
      buildShortLayeredStyle(ctx);
      break;
    case "pixie":
      buildPixieStyle(ctx);
      break;
    case "ponytail":
      buildPonytailStyle(ctx, accessoryColor);
      break;
    case "twinTails":
      buildTwinTailsStyle(ctx, accessoryColor);
      break;
    case "bun":
      buildBunStyle(ctx, accessoryColor);
      break;
    case "curlyMedium":
      buildCurlyMediumStyle(ctx);
      break;
    case "buzz":
      buildBuzzStyle(ctx);
      break;
    case "longStraight":
    default:
      buildLongStyle(ctx, false);
      break;
  }

  // 3. Build fringe locks last so they layer cleanly on top
  buildFringe(ctx, fringe, hairStyle);

  return rootGroup;
}

export function sway(group, t, amount = 1.0) {
  if (!group || !group.userData || !group.userData.swayLocks) return;
  const locks = group.userData.swayLocks;
  const amp = amount == null ? 1.0 : amount;
  const time = t || 0;

  for (let i = 0; i < locks.length; i++) {
    const L = locks[i];
    if (amp === 0) {
      L.pivot.rotation.set(0, 0, 0);
      continue;
    }
    const w = 1.55 * L.freq;
    const wave1 = Math.sin(time * w + L.phase);
    const wave2 = Math.sin(time * w * 1.73 + L.phase * 1.41 + 0.7);
    const breeze = wave1 * 0.74 + wave2 * 0.26;
    const lift = 0.5 + 0.5 * Math.sin(time * w * 0.85 + L.phase * 0.8);

    // Subtle outward bias keeps swaying strands from clipping into skull or shoulders
    L.pivot.rotation.x = (breeze * L.ampX + lift * L.biasX) * amp;
    L.pivot.rotation.z = (breeze * L.ampZ + lift * L.biasZ) * amp;
    L.pivot.rotation.y = Math.cos(time * w * 0.9 + L.phase) * L.ampY * amp;
  }
}

/* -------------------------------------------------------------------------- */
/*  Utilities & Material                                                      */
/* -------------------------------------------------------------------------- */

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

function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  let s = a >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deriveHighlight(THREE, baseColor) {
  const hsl = { h: 0, s: 0, l: 0 };
  baseColor.getHSL(hsl);
  const col = new THREE.Color();
  col.setHSL(
    (hsl.h + 0.018) % 1.0,
    clamp(hsl.s * 0.92 + 0.05, 0, 1),
    clamp(hsl.l + 0.22, 0.22, 0.92)
  );
  return col;
}

function deriveAccessoryColor(THREE, hairColor, explicit) {
  if (explicit) return new THREE.Color(explicit);
  const hsl = { h: 0, s: 0, l: 0 };
  hairColor.getHSL(hsl);
  const col = new THREE.Color();
  if (hsl.l < 0.35) {
    // Soft rose-cream ribbon for dark hair
    col.setHSL(0.96, 0.38, 0.72);
  } else {
    // Deep velvet berry/plum ribbon for lighter hair
    col.setHSL(0.95, 0.45, 0.32);
  }
  return col;
}

function createHairMaterial(THREE, baseColor, highlightColor, kit, noise2D) {
  const r0 = Math.round(baseColor.r * 255);
  const g0 = Math.round(baseColor.g * 255);
  const b0 = Math.round(baseColor.b * 255);

  const rh = Math.round(highlightColor.r * 255);
  const gh = Math.round(highlightColor.g * 255);
  const bh = Math.round(highlightColor.b * 255);

  const strandTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    // Base lengthwise gradient: darker at roots (y=0), highlight band in upper-mid shaft, soft warm tips
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, `rgb(${Math.round(r0 * 0.56)},${Math.round(g0 * 0.54)},${Math.round(b0 * 0.56)})`);
    grad.addColorStop(0.16, `rgb(${Math.round(r0 * 0.84)},${Math.round(g0 * 0.82)},${Math.round(b0 * 0.84)})`);
    grad.addColorStop(
      0.34,
      `rgb(${Math.round(lerp(r0, rh, 0.55))},${Math.round(lerp(g0, gh, 0.55))},${Math.round(lerp(b0, bh, 0.55))})`
    );
    grad.addColorStop(0.50, `rgb(${r0},${g0},${b0})`);
    grad.addColorStop(
      0.70,
      `rgb(${Math.round(lerp(r0, rh, 0.22))},${Math.round(lerp(g0, gh, 0.22))},${Math.round(lerp(b0, bh, 0.22))})`
    );
    grad.addColorStop(
      1.0,
      `rgb(${Math.round(lerp(r0, rh, 0.30))},${Math.round(lerp(g0, gh, 0.30))},${Math.round(lerp(b0, bh, 0.30))})`
    );
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Fine lengthwise painted hair fibers with subtle varied brightness
    const strandCount = 340;
    for (let i = 0; i < strandCount; i++) {
      const u = i / strandCount;
      const xBase = u * w;
      const n1 = noise2D(u * 23.7 + 1.3, 4.1);
      const n2 = noise2D(u * 51.3 + 7.9, 11.4);
      const bright = n1 * 0.65 + n2 * 0.35;

      let sr, sg, sb, alpha;
      if (bright > 0.55) {
        const k = (bright - 0.55) / 0.45;
        sr = Math.round(lerp(r0, rh, 0.35 + 0.55 * k));
        sg = Math.round(lerp(g0, gh, 0.35 + 0.55 * k));
        sb = Math.round(lerp(b0, bh, 0.35 + 0.55 * k));
        alpha = 0.22 + 0.32 * k;
      } else {
        const k = (0.55 - bright) / 0.55;
        sr = Math.round(r0 * (0.45 + 0.4 * (1 - k)));
        sg = Math.round(g0 * (0.43 + 0.4 * (1 - k)));
        sb = Math.round(b0 * (0.46 + 0.4 * (1 - k)));
        alpha = 0.20 + 0.36 * k;
      }

      ctx.strokeStyle = `rgba(${sr},${sg},${sb},${alpha.toFixed(3)})`;
      ctx.lineWidth = 0.9 + n2 * 1.9;
      ctx.beginPath();
      const swayAmp = 0.6 + n1 * 1.4;
      const phase = n2 * Math.PI * 2;
      for (let y = 0; y <= h; y += 32) {
        const dx = Math.sin((y / h) * Math.PI * 2 + phase) * swayAmp;
        if (y === 0) ctx.moveTo(xBase + dx, y);
        else ctx.lineTo(xBase + dx, y);
      }
      ctx.stroke();
    }

    // Soft angel-ring specular highlight band across fibers
    for (let i = 0; i < 140; i++) {
      const u = (i + 0.5) / 140;
      const x = u * w;
      const n = noise2D(u * 31.1, 19.7);
      const yCenter = h * (0.31 + (n - 0.5) * 0.07);
      const halfSpan = h * (0.06 + n * 0.05);
      const hg = ctx.createLinearGradient(0, yCenter - halfSpan, 0, yCenter + halfSpan);
      const aPeak = (0.16 + 0.28 * n).toFixed(3);
      hg.addColorStop(0.0, `rgba(${rh},${gh},${bh},0)`);
      hg.addColorStop(0.5, `rgba(${rh},${gh},${bh},${aPeak})`);
      hg.addColorStop(1.0, `rgba(${rh},${gh},${bh},0)`);
      ctx.strokeStyle = hg;
      ctx.lineWidth = 1.4 + n * 2.0;
      ctx.beginPath();
      ctx.moveTo(x, yCenter - halfSpan);
      ctx.lineTo(x, yCenter + halfSpan);
      ctx.stroke();
    }

    // Subtle darkening right at the root edge for depth
    const rootGrad = ctx.createLinearGradient(0, 0, 0, h * 0.16);
    rootGrad.addColorStop(0, "rgba(0,0,0,0.34)");
    rootGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rootGrad;
    ctx.fillRect(0, 0, w, h * 0.16);
  });
  strandTex.wrapS = THREE.RepeatWrapping;
  strandTex.wrapT = THREE.ClampToEdgeWrapping;
  if ("SRGBColorSpace" in THREE) {
    strandTex.colorSpace = THREE.SRGBColorSpace;
  }

  // Alpha gradient along the last 15% of each ribbon with fine feathery fiber breakup
  const alphaTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // Base alpha fade in the bottom 15% (y from 0.85*h to h)
    const tipStart = Math.floor(h * 0.83);
    const baseFade = ctx.createLinearGradient(0, tipStart, 0, h);
    baseFade.addColorStop(0.0, "rgb(255,255,255)");
    baseFade.addColorStop(0.55, "rgb(145,145,145)");
    baseFade.addColorStop(0.85, "rgb(48,48,48)");
    baseFade.addColorStop(1.0, "rgb(0,0,0)");
    ctx.fillStyle = baseFade;
    ctx.fillRect(0, tipStart, w, h - tipStart);

    // Modulate the last 15% into fine tapering hair micro-points
    const cols = 128;
    for (let i = 0; i < cols; i++) {
      const u = i / cols;
      const x = u * w;
      const n = noise2D(u * 37.3 + 2.1, 6.7);
      const nFine = noise2D(u * 83.1 + 9.4, 2.3);
      const reach = 0.86 + (n * 0.65 + nFine * 0.35) * 0.14;
      const yEnd = Math.floor(h * reach);
      const yFade = Math.floor(h * (reach - 0.11));

      const g = ctx.createLinearGradient(0, yFade, 0, yEnd);
      g.addColorStop(0.0, "rgba(255,255,255,0.85)");
      g.addColorStop(0.55, "rgba(180,180,180,0.75)");
      g.addColorStop(1.0, "rgba(0,0,0,1.0)");
      ctx.fillStyle = g;
      ctx.fillRect(x, yFade, Math.ceil(w / cols) + 1, h - yFade);

      if (yEnd < h) {
        ctx.fillStyle = "#000000";
        ctx.fillRect(x, yEnd, Math.ceil(w / cols) + 1, h - yEnd);
      }
    }
  });
  alphaTex.wrapS = THREE.RepeatWrapping;
  alphaTex.wrapT = THREE.ClampToEdgeWrapping;

  const sheenCol = highlightColor.clone().lerp(new THREE.Color(0xffffff), 0.25);

  const mat = new THREE.MeshPhysicalMaterial({
    map: strandTex,
    alphaMap: alphaTex,
    alphaTest: 0.3,
    side: THREE.DoubleSide,
    roughness: 0.45,
    metalness: 0.0,
    sheen: 1.0,
    sheenRoughness: 0.45,
    sheenColor: sheenCol,
    clearcoat: 0.12,
    clearcoatRoughness: 0.42,
  });

  if ("anisotropy" in mat) {
    mat.anisotropy = 0.65;
    mat.anisotropyRotation = Math.PI * 0.5;
  }

  return mat;
}

/* -------------------------------------------------------------------------- */
/*  Scalp Cap & Head/Body Spatial Helpers                                     */
/* -------------------------------------------------------------------------- */

function hairlinePhi(theta, hairStyle) {
  const a = Math.abs(theta); // 0 = front center, PI = back center
  const isBuzz = hairStyle === "buzz";
  // Smooth natural hairline: rounded forehead, slight temple dip, curve over ears, low at nape
  const frontPhi = isBuzz ? 0.90 : 0.93;
  const templePhi = isBuzz ? 1.18 : 1.12;
  const earPhi = isBuzz ? 1.44 : 1.40;
  const behindEarPhi = 1.98;
  const napePhi = isBuzz ? 2.34 : 2.40;

  if (a < 0.75) {
    const t = smoothstep(0, 0.75, a);
    return lerp(frontPhi, templePhi, t);
  }
  if (a < 1.32) {
    const t = smoothstep(0.75, 1.32, a);
    return lerp(templePhi, earPhi, t);
  }
  if (a < 1.85) {
    const t = smoothstep(1.32, 1.85, a);
    return lerp(earPhi, behindEarPhi, t);
  }
  const t = smoothstep(1.85, Math.PI, a);
  return lerp(behindEarPhi, napePhi, t);
}

function buildScalpCapGeometry(THREE, hairStyle, RX, RY, RZ, HC_Y) {
  const radialSegs = 64;
  const ringSegs = 28;
  // Scale ~1.028 (~0.0042m offset) so it matches ~1.02 spec without z-fighting
  const baseScale = hairStyle === "buzz" ? 1.032 : 1.028;

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let r = 0; r <= ringSegs; r++) {
    const vFrac = r / ringSegs;
    // Slight feather tuck at the very hairline edge while staying >= 0.004m outside head
    const rimTuck = vFrac > 0.88 ? ((vFrac - 0.88) / 0.12) * 0.0005 : 0;

    for (let s = 0; s <= radialSegs; s++) {
      const uFrac = s / radialSegs;
      const theta = (uFrac - 0.5) * Math.PI * 2;
      const maxPhi = hairlinePhi(theta, hairStyle);
      const phi = vFrac * maxPhi;

      const sp = Math.sin(phi);
      const cp = Math.cos(phi);
      const st = Math.sin(theta);
      const ct = Math.cos(theta);

      const x = (RX * baseScale - rimTuck) * sp * st;
      const y = HC_Y + (RY * baseScale - rimTuck) * cp;
      const z = (RZ * baseScale - rimTuck) * sp * ct;

      positions.push(x, y, z);
      // Map UVs into the opaque root/upper-shaft region of the shared hair texture
      uvs.push(uFrac * 6.0, lerp(0.97, 0.62, vFrac));
    }
  }

  const stride = radialSegs + 1;
  for (let r = 0; r < ringSegs; r++) {
    for (let s = 0; s < radialSegs; s++) {
      const a = r * stride + s;
      const b = a + 1;
      const c = (r + 1) * stride + s;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function headSurfacePoint(THREE, ctx, theta, phi, offset) {
  const sp = Math.sin(phi);
  const cp = Math.cos(phi);
  const st = Math.sin(theta);
  const ct = Math.cos(theta);
  return new THREE.Vector3(
    (ctx.RX + offset) * sp * st,
    ctx.HC_Y + (ctx.RY + offset) * cp,
    (ctx.RZ + offset) * sp * ct
  );
}

function pushOutOfHead(p, ctx, clearance) {
  const rx = ctx.RX + clearance;
  const ry = ctx.RY + clearance;
  const rz = ctx.RZ + clearance;
  const nx = p.x / rx;
  const ny = (p.y - ctx.HC_Y) / ry;
  const nz = p.z / rz;
  const d = Math.hypot(nx, ny, nz);
  if (d < 1.0 && d > 1e-5) {
    const inv = 1.0 / d;
    p.x = nx * inv * rx;
    p.y = ctx.HC_Y + ny * inv * ry;
    p.z = nz * inv * rz;
  }
}

function pushOutOfBody(p, ctx, clearance, routeBack) {
  pushOutOfHead(p, ctx, clearance);

  const bw = ctx.bw;
  const bh = ctx.bh;

  // Neck cylinder (head space y from +0.025 down to -0.075 * bh)
  if (p.y < 0.03 && p.y > -0.09 * bh) {
    const rNeck = 0.034 * bw + clearance;
    const dXZ = Math.hypot(p.x, p.z);
    if (dXZ < rNeck) {
      if (dXZ < 1e-4) {
        p.z = routeBack ? -rNeck : rNeck;
      } else {
        const s = rNeck / dXZ;
        p.x *= s;
        p.z *= s;
      }
    }
  }

  // Shoulders, upper chest & back ellipsoid/cylinder (starts around y = -0.045 * bh)
  const shoulderTop = -0.045 * bh;
  if (p.y < shoulderTop) {
    const tDown = clamp((shoulderTop - p.y) / (0.28 * bh), 0, 1);
    // Shoulder line at y = -0.075*bh is widest (includes shoulder joints & upper arms)
    const shoulderPeak = Math.exp(-Math.pow((p.y + 0.078 * bh) / (0.045 * bh), 2));
    const halfW = (lerp(0.118, 0.088, tDown) + 0.022 * shoulderPeak) * bw + clearance;
    const halfD = (0.076 + 0.008 * shoulderPeak) * bw + clearance;

    // Gentle dome taper at the very top of the shoulders
    const capT = smoothstep(shoulderTop, shoulderTop - 0.032 * bh, p.y);
    const effW = lerp(0.05 * bw + clearance, halfW, capT);
    const effD = lerp(0.045 * bw + clearance, halfD, capT);

    const ex = p.x / effW;
    const ez = p.z / effD;
    const d = Math.hypot(ex, ez);
    if (d < 1.0) {
      if (routeBack) {
        // Flow behind the shoulders/back smoothly
        const targetZ = -effD * Math.sqrt(Math.max(0.12, 1.0 - Math.min(0.88, ex * ex)));
        p.z = Math.min(p.z, targetZ);
      } else {
        // Front-draping strands flow over chest or outside shoulders
        if (Math.abs(ex) > 0.62) {
          const sign = p.x >= 0 ? 1 : -1;
          const targetX = sign * effW * Math.sqrt(Math.max(0.12, 1.0 - Math.min(0.88, ez * ez)));
          p.x = sign > 0 ? Math.max(p.x, targetX) : Math.min(p.x, targetX);
        } else {
          const targetZ = effD * Math.sqrt(Math.max(0.12, 1.0 - Math.min(0.88, ex * ex)));
          p.z = Math.max(p.z, targetZ);
        }
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Ribbon & Lock Geometry Builder                                            */
/* -------------------------------------------------------------------------- */

function buildLockMeshFromGuide(ctx, guideCurve, opts) {
  const { THREE, hairMat, rootGroup, swayLocks, rand } = ctx;

  const ribbonCount = opts.ribbonCount ?? 7;
  const segs = opts.segs ?? 18;
  const baseWidthMin = opts.widthMin ?? 0.007;
  const baseWidthMax = opts.widthMax ?? 0.013;
  const spreadLat = opts.spreadLat ?? 0.012;
  const spreadNorm = opts.spreadNorm ?? 0.004;
  const tipSpread = opts.tipSpread ?? 1.45;
  const rootBundle = opts.rootBundle ?? 0.42;
  const isFringe = !!opts.isFringe;
  const cupFactor = opts.cupFactor ?? 0.25;
  const flyawayBoost = opts.flyawayBoost ?? 1.0;

  const rootPos = guideCurve.getPoint(0).clone();

  // Sample base guide curve frames smoothly
  const sampleCount = segs + 1;
  const guidePts = new Array(sampleCount);
  const guideT = new Array(sampleCount);
  const guideB = new Array(sampleCount);
  const guideN = new Array(sampleCount);

  const tmp = new THREE.Vector3();
  const refOut = new THREE.Vector3();

  for (let i = 0; i < sampleCount; i++) {
    const u = i / segs;
    const pt = guideCurve.getPoint(u);
    const tan = guideCurve.getTangent(u).normalize();
    guidePts[i] = pt;
    guideT[i] = tan;

    // Reference outward vector from head center (or vertical spine below head)
    const spineY = Math.min(pt.y, ctx.HC_Y);
    refOut.set(pt.x, pt.y - (pt.y > 0.0 ? ctx.HC_Y : spineY), pt.z);
    if (refOut.lengthSq() < 1e-5) refOut.set(0, 0, -1);
    refOut.normalize();

    let bin = new THREE.Vector3().crossVectors(tan, refOut);
    if (bin.lengthSq() < 1e-5) {
      if (i > 0) {
        bin.copy(guideB[i - 1]);
      } else {
        bin.set(1, 0, 0);
      }
    } else {
      bin.normalize();
    }

    if (i > 0 && bin.dot(guideB[i - 1]) < 0) {
      bin.negate();
    }
    const norm = new THREE.Vector3().crossVectors(bin, tan).normalize();
    if (i === 0 && norm.dot(refOut) < 0) {
      bin.negate();
      norm.negate();
    }

    guideB[i] = bin;
    guideN[i] = norm;
  }

  // Merge all ribbons of this lock into one BufferGeometry in lock-local coordinates
  const acrossSteps = 4; // 5 vertices per ring for smooth cupping
  const vertsPerRing = acrossSteps + 1;
  const positions = [];
  const uvs = [];
  const indices = [];
  let vertexOffset = 0;

  const pCenter = new THREE.Vector3();
  const rB = new THREE.Vector3();
  const rN = new THREE.Vector3();
  const vPos = new THREE.Vector3();

  for (let r = 0; r < ribbonCount; r++) {
    const isFlyaway = r >= ribbonCount - 2 && ribbonCount >= 5;
    const frac = ribbonCount > 1 ? r / (ribbonCount - 1) - 0.5 : 0;

    // Per-ribbon randomized offsets, lengths, width, roll, and micro-curl
    const latOff = (frac * 2.0 + (rand() - 0.5) * 0.45) * spreadLat * (isFlyaway ? 1.25 : 1.0);
    const normOff = (rand() - 0.42) * 2.0 * spreadNorm + (isFlyaway ? 0.0025 * flyawayBoost : 0);
    const lenRatio = isFlyaway
      ? lerp(0.80, 1.07, rand())
      : lerp(0.88, 1.03, rand());

    const ribWidth = isFlyaway
      ? lerp(Math.max(0.006, baseWidthMin * 0.85), Math.min(0.0095, baseWidthMax * 0.78), rand())
      : lerp(baseWidthMin, baseWidthMax, rand());

    // Roll each ribbon slightly around the curve tangent for rich 3D fullness from every angle
    const rollBase = (rand() - 0.5) * (isFlyaway ? 0.95 : 0.65);
    const rollTwist = (rand() - 0.5) * 0.5;

    // Slight per-ribbon wiggle/separation near tips
    const wigPhase = rand() * Math.PI * 2;
    const wigAmp = (isFlyaway ? 0.0055 * flyawayBoost : 0.0025) * (isFringe ? 0.55 : 1.0);
    const uTexOff = rand();
    const uTexSpan = lerp(0.16, 0.34, rand());

    for (let i = 0; i < sampleCount; i++) {
      const u = i / segs;
      const gU = clamp(u * lenRatio, 0, 1);
      const gIdxF = gU * segs;
      const g0 = Math.min(segs - 1, Math.floor(gIdxF));
      const g1 = g0 + 1;
      const gt = gIdxF - g0;

      // Interpolate guide frame smoothly
      pCenter.lerpVectors(guidePts[g0], guidePts[g1], gt);
      const T = tmp.lerpVectors(guideT[g0], guideT[g1], gt).normalize();
      const B = rB.lerpVectors(guideB[g0], guideB[g1], gt).normalize();
      const N = rN.lerpVectors(guideN[g0], guideN[g1], gt).normalize();

      // Separation profile along the lock length
      let latScale;
      if (isFringe) {
        // Fringe locks taper slightly toward a cohesive pointed tuft, with airy flyaway separation
        latScale = lerp(rootBundle, isFlyaway ? 1.15 : 0.52, smoothstep(0.0, 0.9, u));
      } else {
        latScale = lerp(rootBundle, 1.0, smoothstep(0.0, 0.35, u)) + (tipSpread - 1.0) * u * u;
      }
      const normScale = lerp(0.55, 1.0 + (isFlyaway ? 0.65 * u * u : 0.15 * u), u);

      const wiggleLat = Math.sin(u * 8.5 + wigPhase) * wigAmp * u;
      const wiggleNorm = Math.cos(u * 6.5 + wigPhase) * wigAmp * 0.6 * u;

      pCenter.addScaledVector(B, latOff * latScale + wiggleLat);
      pCenter.addScaledVector(N, normOff * normScale + wiggleNorm);

      // Apply local roll around T
      const roll = rollBase + rollTwist * u;
      const cr = Math.cos(roll);
      const sr = Math.sin(roll);
      const rBx = B.x * cr + N.x * sr;
      const rBy = B.y * cr + N.y * sr;
      const rBz = B.z * cr + N.z * sr;
      const rNx = N.x * cr - B.x * sr;
      const rNy = N.y * cr - B.y * sr;
      const rNz = N.z * cr - B.z * sr;

      // Taper width smoothly toward a fine point at the tip
      let wProfile = 1.0;
      if (u < 0.08) {
        wProfile = lerp(0.72, 1.0, u / 0.08);
      } else if (u > 0.52) {
        const tp = (u - 0.52) / 0.48;
        wProfile = Math.max(0.03, Math.pow(1.0 - tp, 1.35));
      }
      const halfW = ribWidth * 0.5 * wProfile;
      const cupD = ribWidth * cupFactor * wProfile;

      // Lock-local center
      const lx = pCenter.x - rootPos.x;
      const ly = pCenter.y - rootPos.y;
      const lz = pCenter.z - rootPos.z;

      for (let c = 0; c <= acrossSteps; c++) {
        const cf = c / acrossSteps;
        const s = cf * 2.0 - 1.0; // -1 to +1
        const cup = cupD * (1.0 - s * s);

        vPos.set(
          lx + rBx * (s * halfW) + rNx * cup,
          ly + rBy * (s * halfW) + rNy * cup,
          lz + rBz * (s * halfW) + rNz * cup
        );
        positions.push(vPos.x, vPos.y, vPos.z);
        // v = 1 at root (canvas top), v = 0 at tip (canvas bottom, alpha fade)
        uvs.push(uTexOff + cf * uTexSpan, 1.0 - u);
      }
    }

    for (let i = 0; i < segs; i++) {
      const rowA = vertexOffset + i * vertsPerRing;
      const rowB = rowA + vertsPerRing;
      for (let c = 0; c < acrossSteps; c++) {
        const a = rowA + c;
        const b = a + 1;
        const d = rowB + c;
        const e = d + 1;
        indices.push(a, d, b);
        indices.push(b, d, e);
      }
    }
    vertexOffset += sampleCount * vertsPerRing;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const lockGroup = new THREE.Group();
  lockGroup.position.copy(rootPos);

  const mesh = new THREE.Mesh(geo, hairMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.slot = "hair";
  lockGroup.add(mesh);
  rootGroup.add(lockGroup);

  // Register sway metadata on the lock group
  const swayWeight = opts.swayWeight ?? 1.0;
  if (swayWeight > 0) {
    const az = Math.atan2(rootPos.x, rootPos.z);
    const outX = Math.sin(az);
    const outZ = Math.cos(az);
    // Outward rotation bias so lower hair swings slightly outward rather than inward into skull
    const baseAmp = 0.032 * swayWeight;
    swayLocks.push({
      pivot: lockGroup,
      phase: az * 1.4 + rand() * 1.6,
      freq: lerp(0.88, 1.16, rand()),
      ampX: baseAmp * (0.55 + 0.45 * Math.abs(outZ)),
      ampZ: baseAmp * (0.55 + 0.45 * Math.abs(outX)),
      ampY: baseAmp * 0.35,
      // Positive rotX swings -Y toward -Z; positive rotZ swings -Y toward +X
      biasX: -outZ * baseAmp * 0.30,
      biasZ: outX * baseAmp * 0.30,
    });
  }

  return lockGroup;
}

/* -------------------------------------------------------------------------- */
/*  Guide Curve Generators                                                    */
/* -------------------------------------------------------------------------- */

function makeGravityGuide(ctx, cfg) {
  const { THREE } = ctx;
  const steps = cfg.steps ?? 11;
  const rootTheta = cfg.rootTheta;
  const rootPhi = cfg.rootPhi;
  const drapeTheta = cfg.drapeTheta ?? rootTheta;
  const layerOff = cfg.layerOff ?? 0.015;
  const length = cfg.length ?? 0.34;
  const detachPhi = cfg.detachPhi ?? 1.58;
  const flareOut = cfg.flareOut ?? 0.012;
  const curlIn = cfg.curlIn ?? 0.0;
  const rootLift = cfg.rootLift ?? 0.0;
  const waveAmp = cfg.waveAmp ?? 0.0;
  const waveFreq = cfg.waveFreq ?? 2.2;
  const wavePhase = cfg.wavePhase ?? 0.0;
  const spiralAmp = cfg.spiralAmp ?? 0.0;
  const spiralFreq = cfg.spiralFreq ?? 3.0;
  const spiralSign = cfg.spiralSign ?? 1;
  const routeBack = cfg.routeBack ?? Math.abs(drapeTheta) > 1.32;

  const pts = [];
  const stepLen = length / (steps - 1);

  let curPhi = rootPhi;
  let curTheta = rootTheta;
  let curPos = headSurfacePoint(THREE, ctx, rootTheta, rootPhi, Math.max(0.0055, layerOff * 0.72));
  pts.push(curPos.clone());

  const dir = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);

  for (let i = 1; i < steps; i++) {
    const s = i / (steps - 1);
    const curOff = layerOff + rootLift * Math.sin(Math.min(1, s * 3.2) * Math.PI);

    if (curPhi < detachPhi) {
      const nextPhi = curPhi + stepLen / 0.155;
      const nextTheta = lerp(curTheta, drapeTheta, 0.32);
      const nextP = headSurfacePoint(THREE, ctx, nextTheta, Math.min(nextPhi, Math.PI - 0.12), curOff);
      dir.subVectors(nextP, curPos).normalize();
      curPos = curPos.clone().addScaledVector(dir, stepLen);
      curPhi = nextPhi;
      curTheta = nextTheta;
    } else {
      const freeS = clamp((s - 0.25) / 0.75, 0, 1);
      const radX = Math.sin(drapeTheta);
      const radZ = Math.cos(drapeTheta);
      const radialPush = flareOut * (0.4 + 0.9 * freeS) - curlIn * Math.pow(freeS, 1.5);
      dir.set(radX * radialPush, -1.0, radZ * radialPush).normalize();
      curPos = curPos.clone().addScaledVector(dir, stepLen);
    }

    pushOutOfBody(curPos, ctx, curOff, routeBack);
    pts.push(curPos.clone());
  }

  // Apply smooth sinusoidal waves / helical ringlets ramped in below the root
  if (waveAmp > 0 || spiralAmp > 0) {
    const rad = new THREE.Vector3();
    const lat = new THREE.Vector3();
    for (let i = 1; i < pts.length; i++) {
      const s = i / (pts.length - 1);
      const env = smoothstep(0.14, 0.58, s);
      const p = pts[i];
      rad.set(p.x, 0, p.z);
      if (rad.lengthSq() < 1e-5) rad.set(Math.sin(drapeTheta), 0, Math.cos(drapeTheta));
      else rad.normalize();
      lat.set(-rad.z, 0, rad.x);

      if (waveAmp > 0) {
        const ang = s * waveFreq * Math.PI * 2 + wavePhase;
        p.addScaledVector(lat, Math.sin(ang) * waveAmp * env);
        p.addScaledVector(rad, Math.cos(ang) * waveAmp * 0.52 * env);
      }
      if (spiralAmp > 0) {
        const ang = spiralSign * (s * spiralFreq * Math.PI * 2 + wavePhase);
        const taperEnv = env * (0.75 + 0.35 * s);
        p.addScaledVector(lat, Math.sin(ang) * spiralAmp * taperEnv);
        p.addScaledVector(rad, (Math.cos(ang) * 0.85 + 0.25) * spiralAmp * taperEnv);
      }

      pushOutOfBody(p, ctx, layerOff * 0.92, routeBack);
    }
  }

  return new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
}

function makeGatheredGuide(ctx, rootTheta, rootPhi, tiePos, layerOff, tieJitter) {
  const { THREE } = ctx;
  const start = headSurfacePoint(THREE, ctx, rootTheta, rootPhi, Math.max(0.0055, layerOff * 0.72));
  const end = tiePos.clone().add(tieJitter);
  const pts = [];
  const steps = 8;

  for (let i = 0; i < steps; i++) {
    const s = i / (steps - 1);
    const p = new THREE.Vector3().lerpVectors(start, end, s);
    // Keep gathered scalp locks smoothly hugging the skull egg
    const off = lerp(layerOff * 0.85, layerOff * 1.15, Math.sin(s * Math.PI));
    if (s < 0.92) {
      pushOutOfHead(p, ctx, off);
    }
    pts.push(p);
  }
  return new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
}

function makeTailCascadeGuide(ctx, tiePos, launchDir, cfg) {
  const { THREE } = ctx;
  const steps = cfg.steps ?? 12;
  const length = cfg.length ?? 0.38;
  const archStrength = cfg.archStrength ?? 0.24;
  const spreadDir = cfg.spreadDir || new THREE.Vector3(0, 0, -1);
  const spreadAmt = cfg.spreadAmt ?? 0.03;
  const waveAmp = cfg.waveAmp ?? 0.015;
  const waveFreq = cfg.waveFreq ?? 2.2;
  const wavePhase = cfg.wavePhase ?? 0;
  const spiralAmp = cfg.spiralAmp ?? 0.0;
  const routeBack = cfg.routeBack ?? true;

  const pts = [];
  const stepLen = length / (steps - 1);
  let cur = tiePos.clone();
  pts.push(cur.clone());

  const vel = launchDir.clone().normalize();
  const grav = new THREE.Vector3(0, -1, 0);

  for (let i = 1; i < steps; i++) {
    const s = i / (steps - 1);
    const blendGrav = smoothstep(0.0, archStrength, s);
    const dir = new THREE.Vector3()
      .lerpVectors(vel, grav, blendGrav)
      .addScaledVector(spreadDir, spreadAmt * (1 - s * 0.3))
      .normalize();
    cur = cur.clone().addScaledVector(dir, stepLen);
    pushOutOfBody(cur, ctx, 0.014, routeBack);
    pts.push(cur.clone());
  }

  // Soft wave & spiral motion down the tail
  const rad = spreadDir.clone().setY(0);
  if (rad.lengthSq() < 1e-5) rad.set(0, 0, -1);
  else rad.normalize();
  const lat = new THREE.Vector3(-rad.z, 0, rad.x);

  for (let i = 1; i < pts.length; i++) {
    const s = i / (pts.length - 1);
    const env = smoothstep(0.12, 0.52, s);
    const ang = s * waveFreq * Math.PI * 2 + wavePhase;
    pts[i].addScaledVector(lat, Math.sin(ang) * (waveAmp + spiralAmp) * env);
    pts[i].addScaledVector(rad, Math.cos(ang) * (waveAmp * 0.55 + spiralAmp) * env);
    pushOutOfBody(pts[i], ctx, 0.012, routeBack);
  }

  return new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
}

/* -------------------------------------------------------------------------- */
/*  Hairstyle Builders                                                        */
/* -------------------------------------------------------------------------- */

function buildLongStyle(ctx, isWavy) {
  const { rand, bh } = ctx;
  const lenScale = 0.88 + 0.14 * bh;

  // Under layer (back, longest) - 12 locks
  const underCount = 12;
  for (let i = 0; i < underCount; i++) {
    const u = (i + 0.5) / underCount;
    const theta = lerp(-Math.PI + 0.12, Math.PI - 0.12, u);
    // Concentrate on back/lower-side hemisphere
    const backTheta = theta >= 0 ? lerp(1.52, Math.PI - 0.06, u) : lerp(-Math.PI + 0.06, -1.52, u);
    const a = lerp(-Math.PI + 0.1, Math.PI - 0.1, u);
    const tSigned = a < 0 ? lerp(-Math.PI + 0.08, -1.52, (a + Math.PI) / Math.PI) : lerp(1.52, Math.PI - 0.08, a / Math.PI);
    const rootTheta = tSigned;
    const rootPhi = lerp(1.42, 1.72, rand());
    const length = lerp(0.36, 0.44, rand()) * lenScale;

    const guide = makeGravityGuide(ctx, {
      rootTheta,
      rootPhi,
      drapeTheta: rootTheta + (rand() - 0.5) * 0.12,
      layerOff: 0.0095,
      length,
      detachPhi: 1.72,
      flareOut: isWavy ? lerp(0.025, 0.045, rand()) : lerp(0.006, 0.018, rand()),
      waveAmp: isWavy ? lerp(0.017, 0.026, rand()) : lerp(0.002, 0.005, rand()),
      waveFreq: isWavy ? lerp(2.2, 3.1, rand()) : 1.3,
      wavePhase: rand() * Math.PI * 2,
      routeBack: true,
      steps: isWavy ? 14 : 11,
    });

    buildLockMeshFromGuide(ctx, guide, {
      ribbonCount: 6 + Math.floor(rand() * 3),
      segs: isWavy ? 22 : 17,
      widthMin: 0.0075,
      widthMax: 0.0135,
      spreadLat: 0.015,
      spreadNorm: 0.004,
      tipSpread: isWavy ? 1.65 : 1.45,
      swayWeight: 1.25,
    });
  }

  // Middle layer (sides & mid-back) - 14 locks
  const midCount = 14;
  for (let i = 0; i < midCount; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const idx = Math.floor(i / 2);
    const frac = idx / (midCount / 2 - 1); // 0 = front side, 1 = rear back
    const rootTheta = side * lerp(1.02, Math.PI - 0.14, frac);
    const rootPhi = lerp(0.82, 1.22, frac * 0.6 + rand() * 0.4);
    const frontSide = frac < 0.28;
    const length = (frontSide ? lerp(0.30, 0.38, rand()) : lerp(0.36, 0.44, rand())) * lenScale;

    const guide = makeGravityGuide(ctx, {
      rootTheta,
      rootPhi,
      drapeTheta: frontSide ? rootTheta * 0.94 : rootTheta + side * 0.06,
      layerOff: 0.0155,
      length,
      detachPhi: frontSide ? 1.48 : 1.62,
      flareOut: isWavy ? lerp(0.03, 0.05, rand()) : lerp(0.01, 0.022, rand()),
      waveAmp: isWavy ? lerp(0.018, 0.027, rand()) : lerp(0.0025, 0.0055, rand()),
      waveFreq: isWavy ? lerp(2.3, 3.2, rand()) : 1.4,
      wavePhase: rand() * Math.PI * 2,
      routeBack: !frontSide,
      steps: isWavy ? 14 : 11,
    });

    buildLockMeshFromGuide(ctx, guide, {
      ribbonCount: 6 + Math.floor(rand() * 3),
      segs: isWavy ? 22 : 17,
      widthMin: 0.007,
      widthMax: 0.013,
      spreadLat: 0.014,
      spreadNorm: 0.0045,
      tipSpread: isWavy ? 1.65 : 1.5,
      swayWeight: frontSide ? 1.05 : 1.2,
    });
  }

  // Top / crown layer (parted softly at crown) - 12 locks
  const topCount = 12;
  for (let i = 0; i < topCount; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const idx = Math.floor(i / 2);
    const frac = idx / (topCount / 2 - 1);
    const drapeTheta = side * lerp(1.08, Math.PI - 0.16, frac);
    const rootTheta = side * lerp(0.65, Math.PI - 0.2, frac);
    const rootPhi = lerp(0.14, 0.50, rand());
    const frontCrown = frac < 0.22;
    const length = lerp(0.35, 0.45, rand()) * lenScale;

    const guide = makeGravityGuide(ctx, {
      rootTheta,
      rootPhi,
      drapeTheta,
      layerOff: 0.0215,
      rootLift: 0.006,
      length,
      detachPhi: 1.56,
      flareOut: isWavy ? lerp(0.032, 0.055, rand()) : lerp(0.012, 0.025, rand()),
      waveAmp: isWavy ? lerp(0.016, 0.025, rand()) : lerp(0.002, 0.005, rand()),
      waveFreq: isWavy ? lerp(2.2, 3.0, rand()) : 1.3,
      wavePhase: rand() * Math.PI * 2,
      routeBack: !frontCrown,
      steps: isWavy ? 14 : 11,
    });

    buildLockMeshFromGuide(ctx, guide, {
      ribbonCount: 5 + Math.floor(rand() * 4),
      segs: isWavy ? 22 : 17,
      widthMin: 0.0065,
      widthMax: 0.0125,
      spreadLat: 0.014,
      spreadNorm: 0.0045,
      tipSpread: isWavy ? 1.7 : 1.55,
      swayWeight: 1.15,
    });
  }
}

function buildBobStyle(ctx) {
  const { rand } = ctx;

  // Under layer (neatly tucked nape) - 8 locks
  for (let i = 0; i < 8; i++) {
    const u = (i + 0.5) / 8;
    const rootTheta = lerp(-Math.PI + 0.18, Math.PI - 0.18, u);
    const backT = rootTheta < 0 ? lerp(-Math.PI + 0.12, -1.75, (rootTheta + Math.PI) / Math.PI) : lerp(1.75, Math.PI - 0.12, rootTheta / Math.PI);
    const guide = makeGravityGuide(ctx, {
      rootTheta: backT,
      rootPhi: lerp(1.62, 1.92, rand()),
      layerOff: 0.009,
      length: lerp(0.095, 0.125, rand()),
      detachPhi: 1.85,
      curlIn: lerp(0.022, 0.032, rand()),
      flareOut: 0.004,
      waveAmp: 0.002,
      routeBack: true,
      steps: 9,
    });
    buildLockMeshFromGuide(ctx, guide, {
      ribbonCount: 6 + Math.floor(rand() * 2),
      segs: 14,
      widthMin: 0.007,
      widthMax: 0.012,
      spreadLat: 0.013,
      tipSpread: 1.35,
      swayWeight: 0.45,
    });
  }

  // Middle layer (cheek & jaw framing bob) - 10 locks
  for (let i = 0; i < 10; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const idx = Math.floor(i / 2);
    const frac = idx / 4;
    const rootTheta = side * lerp(0.96, Math.PI - 0.16, frac);
    const rootPhi = lerp(0.95, 1.32, frac * 0.5 + rand() * 0.5);
    const guide = makeGravityGuide(ctx, {
      rootTheta,
      rootPhi,
      drapeTheta: rootTheta + (frac < 0.3 ? -side * 0.08 : 0),
      layerOff: 0.0155,
      length: lerp(0.175, 0.215, 1 - frac * 0.25) + (rand() - 0.5) * 0.018,
      detachPhi: 1.52,
      flareOut: 0.012,
      curlIn: lerp(0.028, 0.042, rand()),
      waveAmp: 0.003,
      wavePhase: rand() * Math.PI * 2,
      routeBack: frac > 0.35,
      steps: 10,
    });
    buildLockMeshFromGuide(ctx, guide, {
      ribbonCount: 6 + Math.floor(rand() * 3),
      segs: 16,
      widthMin: 0.007,
      widthMax: 0.0125,
      spreadLat: 0.014,
      tipSpread: 1.38,
      swayWeight: 0.62,
    });
  }

  // Top / crown layer (voluminous smooth dome curling under at chin) - 10 locks
  for (let i = 0; i < 10; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const idx = Math.floor(i / 2);
    const frac = idx / 4;
    const drapeTheta = side * lerp(1.04, Math.PI - 0.18, frac);
    const rootTheta = side * lerp(0.55, Math.PI - 0.25, frac);
    const rootPhi = lerp(0.14, 0.48, rand());
    const guide = makeGravityGuide(ctx, {
      rootTheta,
      rootPhi,
      drapeTheta,
      layerOff: 0.0225,
      rootLift: 0.007,
      length: lerp(0.24, 0.285, 1 - frac * 0.15) + (rand() - 0.5) * 0.016,
      detachPhi: 1.50,
      flareOut: 0.018,
      curlIn: lerp(0.032, 0.046, rand()),
      waveAmp: 0.003,
      wavePhase: rand() * Math.PI * 2,
      routeBack: frac > 0.35,
      steps: 10,
    });
    buildLockMeshFromGuide(ctx, guide, {
      ribbonCount: 6 + Math.floor(rand() * 3),
      segs: 16,
      widthMin: 0.0065,
      widthMax: 0.012,
      spreadLat: 0.014,
      tipSpread: 1.45,
      swayWeight: 0.7,
    });
  }
}

function buildShortLayeredStyle(ctx) {
  const { rand } = ctx;

  // Under layer (feathered nape wisps flicking gently out) - 8 locks
  for (let i = 0; i < 8; i++) {
    const u = (i + 0.5) / 8;
    const rootTheta = u < 0.5 ? lerp(-Math.PI + 0.14, -1.65, u * 2) : lerp(1.65, Math.PI - 0.14, (u - 0.5) * 2);
    const guide = makeGravityGuide(ctx, {
      rootTheta,
      rootPhi: lerp(1.62, 1.92, rand()),
      layerOff: 0.0095,
      length: lerp(0.11, 0.155, rand()),
      detachPhi: 1.78,
      flareOut: lerp(0.024, 0.044, rand()),
      waveAmp: 0.005,
      waveFreq: 1.5,
      wavePhase: rand() * Math.PI * 2,
      routeBack: true,
      steps: 9,
    });
    buildLockMeshFromGuide(ctx, guide, {
      ribbonCount: 5 + Math.floor(rand() * 3),
      segs: 14,
      widthMin: 0.006,
      widthMax: 0.0105,
      spreadLat: 0.012,
      tipSpread: 1.65,
      swayWeight: 0.65,
    });
  }

  // Middle layer (choppy textured sides and back) - 10 locks
  for (let i = 0; i < 10; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const idx = Math.floor(i / 2);
    const frac = idx / 4;
    const rootTheta = side * lerp(0.95, Math.PI - 0.16, frac);
    const guide = makeGravityGuide(ctx, {
      rootTheta,
      rootPhi: lerp(0.90, 1.28, rand()),
      drapeTheta: rootTheta + (rand() - 0.5) * 0.18,
      layerOff: 0.0155,
      length: lerp(0.14, 0.195, rand()),
      detachPhi: 1.52,
      flareOut: lerp(0.022, 0.042, rand()),
      curlIn: frac < 0.25 ? 0.016 : 0.0,
      waveAmp: lerp(0.006, 0.011, rand()),
      waveFreq: 1.6,
      wavePhase: rand() * Math.PI * 2,
      routeBack: frac > 0.3,
      steps: 10,
    });
    buildLockMeshFromGuide(ctx, guide, {
      ribbonCount: 5 + Math.floor(rand() * 3),
      segs: 15,
      widthMin: 0.006,
      widthMax: 0.011,
      spreadLat: 0.013,
      tipSpread: 1.7,
      swayWeight: 0.62,
    });
  }

  // Top / crown layer (shorter airy volume layers) - 10 locks
  for (let i = 0; i < 10; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const idx = Math.floor(i / 2);
    const frac = idx / 4;
    const drapeTheta = side * lerp(1.02, Math.PI - 0.18, frac);
    const guide = makeGravityGuide(ctx, {
      rootTheta: side * lerp(0.45, Math.PI - 0.22, frac),
      rootPhi: lerp(0.14, 0.52, rand()),
      drapeTheta,
      layerOff: 0.022,
      rootLift: 0.008,
      length: lerp(0.155, 0.215, rand()),
      detachPhi: 1.48,
      flareOut: lerp(0.024, 0.048, rand()),
      waveAmp: lerp(0.006, 0.012, rand()),
      waveFreq: 1.5,
      wavePhase: rand() * Math.PI * 2,
      routeBack: frac > 0.35,
      steps: 10,
    });
    buildLockMeshFromGuide(ctx, guide, {
      ribbonCount: 5 + Math.floor(rand() * 3),
      segs: 15,
      widthMin: 0.006,
      widthMax: 0.0105,
      spreadLat: 0.013,
      tipSpread: 1.75,
      swayWeight: 0.6,
    });
  }
}

function buildPixieStyle(ctx) {
  const { rand } = ctx;

  // Under layer (close tapered nape wisps) - 6 locks
  for (let i = 0; i < 6; i++) {
    const u = (i + 0.5) / 6;
    const rootTheta = u < 0.5 ? lerp(-Math.PI + 0.18, -1.85, u * 2) : lerp(1.85, Math.PI - 0.18, (u - 0.5) * 2);
    const guide = makeGravityGuide(ctx, {
      rootTheta,
      rootPhi: lerp(1.75, 2.02, rand()),
      layerOff: 0.009,
      length: lerp(0.058, 0.085, rand()),
      detachPhi: 2.15,
      curlIn: 0.018,
      flareOut: 0.0,
      routeBack: true,
      steps: 8,
    });
    buildLockMeshFromGuide(ctx, guide, {
      ribbonCount: 5 + Math.floor(rand() * 2),
      segs: 12,
      widthMin: 0.006,
      widthMax: 0.0095,
      spreadLat: 0.011,
      tipSpread: 1.4,
      swayWeight: 0.28,
    });
  }

  // Middle layer (tapered around ears & temples) - 8 locks
  for (let i = 0; i < 8; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const idx = Math.floor(i / 2);
    const frac = idx / 3;
    const rootTheta = side * lerp(1.02, Math.PI - 0.22, frac);
    const guide = makeGravityGuide(ctx, {
      rootTheta,
      rootPhi: lerp(0.95, 1.38, frac * 0.55 + rand() * 0.45),
      drapeTheta: rootTheta + (frac < 0.35 ? -side * 0.18 : 0.08 * side),
      layerOff: 0.014,
      length: lerp(0.085, 0.125, rand()),
      detachPhi: 1.82,
      curlIn: 0.016,
      flareOut: 0.008,
      waveAmp: 0.003,
      wavePhase: rand() * Math.PI * 2,
      routeBack: frac > 0.35,
      steps: 9,
    });
    buildLockMeshFromGuide(ctx, guide, {
      ribbonCount: 5 + Math.floor(rand() * 3),
      segs: 13,
      widthMin: 0.006,
      widthMax: 0.010,
      spreadLat: 0.011,
      tipSpread: 1.45,
      swayWeight: 0.35,
    });
  }

  // Top / crown layer (soft feathered elfin sweep from side whorl) - 10 locks
  for (let i = 0; i < 10; i++) {
    const u = (i + 0.5) / 10;
    const drapeTheta = lerp(-Math.PI + 0.2, Math.PI - 0.2, u);
    const rootTheta = drapeTheta + 0.22; // gentle asymmetric pixie sweep
    const guide = makeGravityGuide(ctx, {
      rootTheta,
      rootPhi: lerp(0.12, 0.55, rand()),
      drapeTheta,
      layerOff: 0.0195,
      rootLift: 0.006,
      length: lerp(0.11, 0.16, rand()),
      detachPhi: 1.65,
      flareOut: lerp(0.010, 0.022, rand()),
      waveAmp: 0.0045,
      waveFreq: 1.4,
      wavePhase: rand() * Math.PI * 2,
      routeBack: Math.abs(drapeTheta) > 1.25,
      steps: 9,
    });
    buildLockMeshFromGuide(ctx, guide, {
      ribbonCount: 5 + Math.floor(rand() * 3),
      segs: 13,
      widthMin: 0.006,
      widthMax: 0.010,
      spreadLat: 0.012,
      tipSpread: 1.55,
      swayWeight: 0.42,
    });
  }
}

function buildPonytailStyle(ctx, accessoryColor) {
  const { THREE, rand, bh, rootGroup } = ctx;
  const tiePos = new THREE.Vector3(0, 0.205, -0.158);
  const lenScale = 0.88 + 0.14 * bh;

  // 18 sleek pulled-back scalp locks converging into tiePos
  const scalpCount = 18;
  for (let i = 0; i < scalpCount; i++) {
    const u = (i + 0.5) / scalpCount;
    const rootTheta = lerp(-Math.PI + 0.12, Math.PI - 0.12, u);
    const maxP = hairlinePhi(rootTheta, "ponytail");
    const rootPhi = lerp(0.58, maxP * 0.88, (i % 3) / 2.2);
    const jitter = new THREE.Vector3(
      (rand() - 0.5) * 0.022,
      (rand() - 0.5) * 0.020,
      (rand() - 0.5) * 0.012
    );
    const guide = makeGatheredGuide(ctx, rootTheta, rootPhi, tiePos, 0.011 + (i % 2) * 0.004, jitter);
    buildLockMeshFromGuide(ctx, guide, {
      ribbonCount: 5 + Math.floor(rand() * 2),
      segs: 12,
      widthMin: 0.007,
      widthMax: 0.012,
      spreadLat: 0.013,
      spreadNorm: 0.0025,
      tipSpread: 0.55,
      swayWeight: 0.08,
    });
  }

  // Soft elastic / scrunchie tie at tiePos
  const tieDir = new THREE.Vector3(0, 0.35, -1).normalize();
  addPonytailElastic(THREE, rootGroup, tiePos, tieDir, accessoryColor);

  // 18 bouncy cascading ponytail locks (under, middle, outer layers) rooted at tiePos
  const tailCount = 18;
  for (let i = 0; i < tailCount; i++) {
    const layer = i < 6 ? 0 : i < 12 ? 1 : 2;
    const ang = (i / tailCount) * Math.PI * 2 + layer * 0.4;
    const ringR = lerp(0.005, 0.015, layer / 2);
    const startPos = tiePos.clone().add(
      new THREE.Vector3(Math.cos(ang) * ringR, Math.sin(ang) * ringR * 0.8, -0.006)
    );

    const spreadDir = new THREE.Vector3(Math.cos(ang) * 0.65, 0, -1.0 + Math.sin(ang) * 0.25).normalize();
    const launchDir = new THREE.Vector3(
      Math.cos(ang) * (0.28 + layer * 0.15),
      0.32 + layer * 0.26 + Math.sin(ang) * 0.14,
      -0.88
    ).normalize();

    const guide = makeTailCascadeGuide(ctx, startPos, launchDir, {
      length: lerp(0.36, 0.46, rand()) * lenScale * (1 - layer * 0.05),
      archStrength: 0.22 + layer * 0.09,
      spreadDir,
      spreadAmt: 0.03 + layer * 0.025,
      waveAmp: lerp(0.012, 0.022, rand()),
      waveFreq: lerp(1.9, 2.7, rand()),
      wavePhase: rand() * Math.PI * 2,
      routeBack: true,
      steps: 14,
    });

    buildLockMeshFromGuide(ctx, guide, {
      ribbonCount: 6 + Math.floor(rand() * 3),
      segs: 20,
      widthMin: 0.007,
      widthMax: 0.013,
      spreadLat: 0.013,
      spreadNorm: 0.004,
      tipSpread: 1.65,
      rootBundle: 0.35,
      swayWeight: 1.55 + layer * 0.2,
    });
  }
}

function buildTwinTailsStyle(ctx, accessoryColor) {
  const { THREE, rand, bh, bw, rootGroup } = ctx;
  const lenScale = 0.88 + 0.14 * bh;

  for (const side of [1, -1]) {
    const tiePos = new THREE.Vector3(side * 0.138, 0.195, -0.072);

    // 9 gathered scalp locks per side sweeping smoothly from center part & nape into tiePos
    for (let i = 0; i < 9; i++) {
      const u = i / 8;
      const rootTheta = side * lerp(0.18, Math.PI - 0.12, u);
      const maxP = hairlinePhi(rootTheta, "twinTails");
      const rootPhi = lerp(0.28, maxP * 0.85, (i % 3) / 2.2);
      const jitter = new THREE.Vector3(
        (rand() - 0.5) * 0.014,
        (rand() - 0.5) * 0.018,
        (rand() - 0.5) * 0.018
      );
      const guide = makeGatheredGuide(ctx, rootTheta, rootPhi, tiePos, 0.011 + (i % 2) * 0.004, jitter);
      buildLockMeshFromGuide(ctx, guide, {
        ribbonCount: 5 + Math.floor(rand() * 2),
        segs: 12,
        widthMin: 0.007,
        widthMax: 0.0115,
        spreadLat: 0.012,
        spreadNorm: 0.0025,
        tipSpread: 0.55,
        swayWeight: 0.08,
      });
    }

    // Dainty ribbon bow at each tie
    addRibbonBow(THREE, rootGroup, tiePos, side, accessoryColor);

    // 12 lush bouncy twin-tail cascade locks per side (24 total)
    const tailCount = 12;
    for (let i = 0; i < tailCount; i++) {
      const layer = i < 4 ? 0 : i < 8 ? 1 : 2;
      const ang = (i / tailCount) * Math.PI * 2 + layer * 0.45;
      const ringR = lerp(0.004, 0.012, layer / 2);
      const startPos = tiePos.clone().add(
        new THREE.Vector3(side * 0.008, Math.sin(ang) * ringR, Math.cos(ang) * ringR)
      );

      const spreadDir = new THREE.Vector3(
        side * (0.85 + 0.15 * bw),
        0,
        -0.38 + Math.cos(ang) * 0.35
      ).normalize();
      const launchDir = new THREE.Vector3(
        side * (0.78 + layer * 0.14),
        0.26 + layer * 0.22 + Math.sin(ang) * 0.12,
        -0.35 + Math.cos(ang) * 0.22
      ).normalize();

      const guide = makeTailCascadeGuide(ctx, startPos, launchDir, {
        length: lerp(0.35, 0.44, rand()) * lenScale * (1 - layer * 0.04),
        archStrength: 0.25 + layer * 0.08,
        spreadDir,
        spreadAmt: 0.045 + layer * 0.025,
        waveAmp: lerp(0.012, 0.020, rand()),
        spiralAmp: lerp(0.008, 0.016, rand()),
        waveFreq: lerp(2.2, 3.0, rand()),
        wavePhase: rand() * Math.PI * 2,
        routeBack: true,
        steps: 14,
      });

      buildLockMeshFromGuide(ctx, guide, {
        ribbonCount: 5 + Math.floor(rand() * 3),
        segs: 20,
        widthMin: 0.0065,
        widthMax: 0.012,
        spreadLat: 0.012,
        spreadNorm: 0.004,
        tipSpread: 1.65,
        rootBundle: 0.35,
        swayWeight: 1.6 + layer * 0.2,
      });
    }
  }
}

function buildBunStyle(ctx, accessoryColor) {
  const { THREE, rand, rootGroup, hairMat } = ctx;
  const bunPos = new THREE.Vector3(0, 0.268, -0.108);

  // Subtle hidden hair-colored inner core inside the bun coils so no gap shows through
  const coreGeo = new THREE.SphereGeometry(0.044, 32, 32);
  const coreUvs = coreGeo.attributes.uv;
  for (let i = 0; i < coreUvs.count; i++) {
    coreUvs.setY(i, lerp(0.65, 0.95, coreUvs.getY(i)));
  }
  const coreMesh = new THREE.Mesh(coreGeo, hairMat);
  coreMesh.position.copy(bunPos);
  coreMesh.scale.set(1.08, 0.92, 1.0);
  coreMesh.castShadow = true;
  coreMesh.receiveShadow = true;
  coreMesh.userData.slot = "hair";
  rootGroup.add(coreMesh);

  // 16 sleek gathered scalp locks sweeping up into the bun base
  for (let i = 0; i < 16; i++) {
    const u = (i + 0.5) / 16;
    const rootTheta = lerp(-Math.PI + 0.14, Math.PI - 0.14, u);
    const maxP = hairlinePhi(rootTheta, "bun");
    const rootPhi = lerp(0.75, maxP * 0.9, (i % 3) / 2.2);
    const jitter = new THREE.Vector3(
      (rand() - 0.5) * 0.03,
      -0.02 + (rand() - 0.5) * 0.015,
      (rand() - 0.5) * 0.025
    );
    const guide = makeGatheredGuide(ctx, rootTheta, rootPhi, bunPos, 0.011 + (i % 2) * 0.004, jitter);
    buildLockMeshFromGuide(ctx, guide, {
      ribbonCount: 5 + Math.floor(rand() * 2),
      segs: 12,
      widthMin: 0.007,
      widthMax: 0.012,
      spreadLat: 0.013,
      spreadNorm: 0.0025,
      tipSpread: 0.65,
      swayWeight: 0.06,
    });
  }

  // 2 delicate loose ear/nape tendrils framing the neck for soft doll romance
  for (const side of [1, -1]) {
    const guide = makeGravityGuide(ctx, {
      rootTheta: side * 1.48,
      rootPhi: 1.56,
      drapeTheta: side * 1.32,
      layerOff: 0.014,
      length: lerp(0.11, 0.145, rand()),
      detachPhi: 1.62,
      flareOut: 0.014,
      waveAmp: 0.009,
      waveFreq: 2.0,
      wavePhase: rand() * Math.PI * 2,
      routeBack: false,
      steps: 10,
    });
    buildLockMeshFromGuide(ctx, guide, {
      ribbonCount: 5,
      segs: 16,
      widthMin: 0.006,
      widthMax: 0.0085,
      spreadLat: 0.007,
      tipSpread: 1.45,
      swayWeight: 1.1,
    });
  }

  // 12 coiled strand locks wrapping organically around bunPos
  const bunAxis = new THREE.Vector3(0, 0.62, -0.78).normalize();
  const bunU = new THREE.Vector3(1, 0, 0);
  const bunV = new THREE.Vector3().crossVectors(bunAxis, bunU).normalize();

  for (let i = 0; i < 12; i++) {
    const startAngle = (i / 12) * Math.PI * 2;
    const turns = lerp(0.95, 1.35, rand());
    const rMax = lerp(0.052, 0.066, rand());
    const hShift = lerp(-0.024, 0.028, (i % 4) / 3);
    const pts = [];
    const cSteps = 12;

    for (let k = 0; k < cSteps; k++) {
      const s = k / (cSteps - 1);
      const ang = startAngle + s * turns * Math.PI * 2;
      const arch = Math.sin(s * Math.PI);
      const r = lerp(0.036, rMax, 0.35 + 0.65 * arch);
      const hOff = hShift * Math.cos(s * Math.PI * 0.85) + (s - 0.5) * 0.022;
      const p = bunPos
        .clone()
        .addScaledVector(bunU, Math.cos(ang) * r)
        .addScaledVector(bunV, Math.sin(ang) * r * 0.92)
        .addScaledVector(bunAxis, hOff);
      pts.push(p);
    }

    const guide = new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
    buildLockMeshFromGuide(ctx, guide, {
      ribbonCount: 5 + Math.floor(rand() * 3),
      segs: 18,
      widthMin: 0.007,
      widthMax: 0.0125,
      spreadLat: 0.012,
      spreadNorm: 0.0035,
      tipSpread: 1.15,
      swayWeight: 0.14,
    });
  }

  // Decorative pearl hairpins tucked cleanly into the bun
  addBunPins(THREE, rootGroup, bunPos, bunAxis, bunU, bunV, accessoryColor);
}

function buildCurlyMediumStyle(ctx) {
  const { rand, bh } = ctx;
  const lenScale = 0.92 + 0.08 * bh;

  // Under layer (back curls resting around shoulders) - 8 locks
  for (let i = 0; i < 8; i++) {
    const u = (i + 0.5) / 8;
    const rootTheta = u < 0.5 ? lerp(-Math.PI + 0.16, -1.55, u * 2) : lerp(1.55, Math.PI - 0.16, (u - 0.5) * 2);
    const guide = makeGravityGuide(ctx, {
      rootTheta,
      rootPhi: lerp(1.45, 1.78, rand()),
      layerOff: 0.010,
      length: lerp(0.21, 0.27, rand()) * lenScale,
      detachPhi: 1.65,
      flareOut: lerp(0.032, 0.055, rand()),
      spiralAmp: lerp(0.016, 0.024, rand()),
      spiralFreq: lerp(2.6, 3.6, rand()),
      spiralSign: i % 2 === 0 ? 1 : -1,
      wavePhase: rand() * Math.PI * 2,
      routeBack: true,
      steps: 15,
    });
    buildLockMeshFromGuide(ctx, guide, {
      ribbonCount: 6 + Math.floor(rand() * 3),
      segs: 24,
      widthMin: 0.0065,
      widthMax: 0.0115,
      spreadLat: 0.013,
      spreadNorm: 0.005,
      tipSpread: 1.6,
      swayWeight: 0.95,
    });
  }

  // Middle layer (voluminous bouncy side & back ringlets) - 12 locks
  for (let i = 0; i < 12; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const idx = Math.floor(i / 2);
    const frac = idx / 5;
    const rootTheta = side * lerp(0.95, Math.PI - 0.15, frac);
    const guide = makeGravityGuide(ctx, {
      rootTheta,
      rootPhi: lerp(0.85, 1.25, rand()),
      drapeTheta: rootTheta + (rand() - 0.5) * 0.15,
      layerOff: 0.0165,
      length: lerp(0.22, 0.29, rand()) * lenScale,
      detachPhi: 1.48,
      flareOut: lerp(0.042, 0.068, rand()),
      spiralAmp: lerp(0.018, 0.027, rand()),
      spiralFreq: lerp(2.8, 3.8, rand()),
      spiralSign: i % 2 === 0 ? 1 : -1,
      wavePhase: rand() * Math.PI * 2,
      routeBack: frac > 0.3,
      steps: 15,
    });
    buildLockMeshFromGuide(ctx, guide, {
      ribbonCount: 6 + Math.floor(rand() * 3),
      segs: 24,
      widthMin: 0.0065,
      widthMax: 0.0115,
      spreadLat: 0.014,
      spreadNorm: 0.0055,
      tipSpread: 1.65,
      swayWeight: 1.0,
    });
  }

  // Top / crown layer (fluffy halo curls) - 10 locks
  for (let i = 0; i < 10; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const idx = Math.floor(i / 2);
    const frac = idx / 4;
    const drapeTheta = side * lerp(1.02, Math.PI - 0.18, frac);
    const guide = makeGravityGuide(ctx, {
      rootTheta: side * lerp(0.45, Math.PI - 0.22, frac),
      rootPhi: lerp(0.14, 0.52, rand()),
      drapeTheta,
      layerOff: 0.023,
      rootLift: 0.009,
      length: lerp(0.24, 0.31, rand()) * lenScale,
      detachPhi: 1.44,
      flareOut: lerp(0.048, 0.072, rand()),
      spiralAmp: lerp(0.017, 0.026, rand()),
      spiralFreq: lerp(2.7, 3.7, rand()),
      spiralSign: i % 2 === 0 ? -1 : 1,
      wavePhase: rand() * Math.PI * 2,
      routeBack: frac > 0.32,
      steps: 15,
    });
    buildLockMeshFromGuide(ctx, guide, {
      ribbonCount: 5 + Math.floor(rand() * 3),
      segs: 24,
      widthMin: 0.006,
      widthMax: 0.011,
      spreadLat: 0.014,
      spreadNorm: 0.0055,
      tipSpread: 1.75,
      swayWeight: 1.05,
    });
  }
}

function buildBuzzStyle(ctx) {
  const { THREE, rand } = ctx;

  // 24 short soft micro-tuft lock clusters hugging the skull along natural crown whorl growth
  const rings = [
    { phi: 0.22, count: 5, len: 0.022 },
    { phi: 0.65, count: 7, len: 0.020 },
    { phi: 1.12, count: 6, len: 0.019 },
    { phi: 1.65, count: 6, len: 0.018 },
  ];

  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const u = (i + 0.5) / ring.count;
      let theta;
      if (ring.phi > 1.35) {
        // Back & sides only where hairline reaches low
        theta = u < 0.5 ? lerp(-Math.PI + 0.2, -1.45, u * 2) : lerp(1.45, Math.PI - 0.2, (u - 0.5) * 2);
      } else {
        theta = lerp(-Math.PI + 0.15, Math.PI - 0.15, u);
      }
      const maxP = hairlinePhi(theta, "buzz") - 0.14;
      const phi = Math.min(ring.phi + (rand() - 0.5) * 0.12, maxP);
      if (phi < 0.06) continue;

      const pts = [];
      const steps = 5;
      for (let k = 0; k < steps; k++) {
        const s = k / (steps - 1);
        const p = headSurfacePoint(
          THREE,
          ctx,
          theta + s * 0.08 * (rand() > 0.5 ? 1 : -1),
          phi + s * (ring.len / 0.155),
          0.0085 + Math.sin(s * Math.PI) * 0.003
        );
        pts.push(p);
      }
      const guide = new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
      buildLockMeshFromGuide(ctx, guide, {
        ribbonCount: 6 + Math.floor(rand() * 2),
        segs: 8,
        widthMin: 0.006,
        widthMax: 0.0085,
        spreadLat: 0.016,
        spreadNorm: 0.002,
        tipSpread: 1.25,
        flyawayBoost: 0.45,
        swayWeight: 0.12,
      });
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Fringe Builder ("full" | "sideSwept" | "curtain" | "none")                */
/* -------------------------------------------------------------------------- */

function buildFringe(ctx, fringe, hairStyle) {
  const { THREE, rand } = ctx;
  const isBuzz = hairStyle === "buzz";
  const isCurly = hairStyle === "curlyMedium" || hairStyle === "longWavy";

  if (fringe === "none") {
    if (isBuzz) return;
    // Soft subtle temple hairline wisps so the forehead edge never looks hard
    for (const side of [1, -1]) {
      for (let k = 0; k < 2; k++) {
        const rootTheta = side * (0.82 + k * 0.16);
        const pts = [];
        for (let i = 0; i < 6; i++) {
          const s = i / 5;
          const p = headSurfacePoint(
            THREE,
            ctx,
            rootTheta + side * s * 0.25,
            lerp(0.88, 1.38, s),
            lerp(0.010, 0.016, Math.sin(s * Math.PI * 0.8))
          );
          pts.push(p);
        }
        const guide = new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
        buildLockMeshFromGuide(ctx, guide, {
          ribbonCount: 5,
          segs: 12,
          widthMin: 0.006,
          widthMax: 0.0085,
          spreadLat: 0.008,
          spreadNorm: 0.002,
          isFringe: true,
          swayWeight: 0.3,
        });
      }
    }
    return;
  }

  // Buzz cut with fringe option gets very short feathery micro-bangs
  if (isBuzz) {
    const count = 7;
    for (let i = 0; i < count; i++) {
      const u = i / (count - 1);
      const theta = lerp(-0.62, 0.62, u);
      const pts = [];
      for (let k = 0; k < 5; k++) {
        const s = k / 4;
        const sweep = fringe === "sideSwept" ? -0.18 * s : fringe === "curtain" ? Math.sign(theta || 1) * 0.14 * s : 0;
        const p = headSurfacePoint(
          THREE,
          ctx,
          theta + sweep,
          lerp(0.62, 0.98 + (rand() - 0.5) * 0.08, s),
          0.009 + Math.sin(s * Math.PI) * 0.003
        );
        pts.push(p);
      }
      const guide = new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
      buildLockMeshFromGuide(ctx, guide, {
        ribbonCount: 5,
        segs: 8,
        widthMin: 0.006,
        widthMax: 0.008,
        spreadLat: 0.009,
        isFringe: true,
        flyawayBoost: 0.4,
        swayWeight: 0.15,
      });
    }
    return;
  }

  if (fringe === "full") {
    // 9 main forehead bangs ending in separated points above the eyes + 2 temple framing locks = 11 locks
    const bangCount = 9;
    for (let i = 0; i < bangCount; i++) {
      const u = i / (bangCount - 1);
      const theta = lerp(-0.68, 0.68, u);
      const edgeT = Math.abs(u - 0.5) * 2.0; // 0 at center, 1 at temples
      const rootPhi = lerp(0.36, 0.56, edgeT * 0.6 + rand() * 0.4);
      // Center ends right above eyes (y ~ 0.152..0.168), tapering gently longer at outer brow
      const tipY = lerp(0.154, 0.132, edgeT * edgeT) + (rand() - 0.5) * 0.015;
      const guide = makeFringeGuide(ctx, {
        rootTheta: theta * 0.85,
        rootPhi,
        tipTheta: theta + (rand() - 0.5) * 0.06,
        tipY,
        loft: lerp(0.021, 0.027, 1 - edgeT * 0.35),
        tipZClear: 0.019,
        curlAmp: isCurly ? 0.007 : 0.0025,
        phase: rand() * Math.PI * 2,
      });
      buildLockMeshFromGuide(ctx, guide, {
        ribbonCount: 5 + Math.floor(rand() * 3),
        segs: 15,
        widthMin: 0.006,
        widthMax: 0.0095,
        spreadLat: 0.009,
        spreadNorm: 0.003,
        isFringe: true,
        swayWeight: 0.42,
      });
    }

    // 2 delicate side-framing cheek locks blending fringe into the sides
    for (const side of [1, -1]) {
      const guide = makeFringeGuide(ctx, {
        rootTheta: side * 0.78,
        rootPhi: 0.58,
        tipTheta: side * 0.92,
        tipY: lerp(0.075, 0.105, rand()),
        loft: 0.022,
        tipZClear: 0.017,
        curlAmp: isCurly ? 0.009 : 0.0035,
        phase: rand() * Math.PI * 2,
      });
      buildLockMeshFromGuide(ctx, guide, {
        ribbonCount: 5 + Math.floor(rand() * 2),
        segs: 16,
        widthMin: 0.006,
        widthMax: 0.0095,
        spreadLat: 0.0085,
        spreadNorm: 0.003,
        isFringe: true,
        swayWeight: 0.58,
      });
    }
  } else if (fringe === "sideSwept") {
    // Parted at left-front (+0.48), sweeping softly across forehead to right temple (-0.86)
    const count = 9;
    for (let i = 0; i < count; i++) {
      const u = i / (count - 1);
      const onSmallSide = i < 2;
      let rootTheta, tipTheta, tipY;
      if (onSmallSide) {
        rootTheta = lerp(0.52, 0.72, i);
        tipTheta = lerp(0.84, 0.98, i);
        tipY = lerp(0.142, 0.105, i) + (rand() - 0.5) * 0.01;
      } else {
        const su = (i - 2) / (count - 3);
        rootTheta = lerp(0.42, -0.58, su);
        tipTheta = lerp(-0.08, -0.92, su) + (rand() - 0.5) * 0.05;
        tipY = lerp(0.178, 0.115, su) + (rand() - 0.5) * 0.012;
      }

      const guide = makeFringeGuide(ctx, {
        rootTheta,
        rootPhi: lerp(0.36, 0.60, rand()),
        tipTheta,
        tipY,
        loft: lerp(0.021, 0.028, rand()),
        tipZClear: 0.020,
        curlAmp: isCurly ? 0.008 : 0.003,
        phase: rand() * Math.PI * 2,
      });

      buildLockMeshFromGuide(ctx, guide, {
        ribbonCount: 5 + Math.floor(rand() * 3),
        segs: 16,
        widthMin: 0.006,
        widthMax: 0.0095,
        spreadLat: 0.009,
        spreadNorm: 0.003,
        isFringe: true,
        swayWeight: 0.45,
      });
    }
  } else if (fringe === "curtain") {
    // 10 locks (5 per side) parted at center, sweeping gently outward around brows and cheekbones
    const perSide = 5;
    for (const side of [1, -1]) {
      for (let i = 0; i < perSide; i++) {
        const u = i / (perSide - 1);
        const rootTheta = side * lerp(0.08, 0.58, u);
        const tipTheta = side * lerp(0.42, 0.98, u);
        const tipY = lerp(0.148, 0.082, u) + (rand() - 0.5) * 0.012;

        const guide = makeFringeGuide(ctx, {
          rootTheta,
          rootPhi: lerp(0.32, 0.58, u * 0.6 + rand() * 0.4),
          tipTheta,
          tipY,
          loft: lerp(0.022, 0.028, 1 - u * 0.3),
          tipZClear: 0.021,
          outFlick: side * (0.009 + u * 0.007),
          curlAmp: isCurly ? 0.008 : 0.003,
          phase: rand() * Math.PI * 2,
        });

        buildLockMeshFromGuide(ctx, guide, {
          ribbonCount: 5 + Math.floor(rand() * 3),
          segs: 16,
          widthMin: 0.006,
          widthMax: 0.0095,
          spreadLat: 0.009,
          spreadNorm: 0.003,
          isFringe: true,
          swayWeight: 0.52,
        });
      }
    }
  }
}

function makeFringeGuide(ctx, cfg) {
  const { THREE } = ctx;
  const steps = 9;
  const rootTheta = cfg.rootTheta;
  const rootPhi = cfg.rootPhi;
  const tipTheta = cfg.tipTheta;
  const tipY = cfg.tipY;
  const loft = cfg.loft ?? 0.023;
  const tipZClear = cfg.tipZClear ?? 0.019;
  const outFlick = cfg.outFlick ?? 0;
  const curlAmp = cfg.curlAmp ?? 0.003;
  const phase = cfg.phase ?? 0;

  // Convert desired tipY into approximate phi on the front of the head egg
  const tipPhi = Math.acos(clamp((tipY - ctx.HC_Y) / (ctx.RY + tipZClear), -0.95, 0.95));

  const pts = [];
  for (let i = 0; i < steps; i++) {
    const s = i / (steps - 1);
    const theta = lerp(rootTheta, tipTheta, smoothstep(0.0, 1.0, s));
    const phi = lerp(rootPhi, tipPhi, Math.pow(s, 0.94));
    // Soft dome loft over the forehead, curving gently toward the brow at the tip
    const arch = Math.sin(s * Math.PI);
    const off = lerp(loft * 0.55, tipZClear, s) + arch * loft * 0.52;

    const p = headSurfacePoint(THREE, ctx, theta, phi, off);

    // Subtle lateral softness + curtain flick
    const env = smoothstep(0.25, 0.95, s);
    p.x += Math.sin(s * 5.0 + phase) * curlAmp * env + outFlick * s * s;
    p.z += Math.cos(s * 4.5 + phase) * curlAmp * 0.5 * env;

    // Ensure fringe always clears forehead/eyes cleanly
    pushOutOfHead(p, ctx, Math.max(0.012, tipZClear * 0.72));
    pts.push(p);
  }

  return new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
}

/* -------------------------------------------------------------------------- */
/*  Accessories: Elastic, Ribbon Bows, Bun Pins                               */
/* -------------------------------------------------------------------------- */

function addPonytailElastic(THREE, parent, tiePos, tieDir, color) {
  const geo = new THREE.TorusGeometry(0.025, 0.0095, 32, 48);
  const pos = geo.attributes.position;
  // Subtle fabric scrunchie pleats
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ang = Math.atan2(y, x);
    const pleat = 1.0 + 0.085 * Math.sin(ang * 10.0) + 0.04 * Math.cos(ang * 20.0);
    pos.setXYZ(i, x * pleat, y * pleat, z * (1.0 + 0.06 * Math.sin(ang * 10.0)));
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.42,
    metalness: 0.0,
    sheen: 0.95,
    sheenRoughness: 0.35,
    sheenColor: color.clone().lerp(new THREE.Color(0xffffff), 0.45),
    clearcoat: 0.12,
    clearcoatRoughness: 0.45,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "ponytailElastic";
  mesh.position.copy(tiePos);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tieDir);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.slot = "hairAccessory";
  parent.add(mesh);
}

function addRibbonBow(THREE, parent, tiePos, side, color) {
  const bowGroup = new THREE.Group();
  bowGroup.name = side > 0 ? "twinTailRibbonL" : "twinTailRibbonR";
  bowGroup.position.copy(tiePos).add(new THREE.Vector3(side * 0.012, 0.010, -0.006));
  // Face bow nicely outward and slightly back
  const outDir = new THREE.Vector3(side * 0.85, 0.18, -0.48).normalize();
  bowGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), outDir);

  const ribbonMat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.34,
    metalness: 0.0,
    sheen: 1.0,
    sheenRoughness: 0.3,
    sheenColor: color.clone().lerp(new THREE.Color(0xffffff), 0.5),
    clearcoat: 0.15,
    clearcoatRoughness: 0.35,
    side: THREE.DoubleSide,
  });

  // Center silk knot
  const knotGeo = new THREE.SphereGeometry(0.0105, 32, 32);
  const knot = new THREE.Mesh(knotGeo, ribbonMat);
  knot.scale.set(1.05, 0.88, 0.72);
  knot.castShadow = true;
  knot.userData.slot = "hairAccessory";
  bowGroup.add(knot);

  // Two satin bow loops
  for (const s of [1, -1]) {
    const loopPts = [
      new THREE.Vector3(0, 0.002, 0.002),
      new THREE.Vector3(s * 0.022, 0.017, 0.010),
      new THREE.Vector3(s * 0.036, 0.004, 0.005),
      new THREE.Vector3(s * 0.024, -0.014, 0.002),
      new THREE.Vector3(0, -0.002, 0.0),
    ];
    const loopCurve = new THREE.CatmullRomCurve3(loopPts, false, "centripetal", 0.5);
    const loopGeo = buildFlatStripGeometry(THREE, loopCurve, 32, 0.014, 0.002, new THREE.Vector3(0, 0, 1));
    const loopMesh = new THREE.Mesh(loopGeo, ribbonMat);
    loopMesh.castShadow = true;
    loopMesh.userData.slot = "hairAccessory";
    bowGroup.add(loopMesh);

    // Dainty hanging ribbon tail
    const tailPts = [
      new THREE.Vector3(s * 0.004, -0.004, 0.0),
      new THREE.Vector3(s * 0.014, -0.022, 0.005),
      new THREE.Vector3(s * 0.022, -0.044, 0.002),
      new THREE.Vector3(s * 0.026, -0.062, -0.002),
    ];
    const tailCurve = new THREE.CatmullRomCurve3(tailPts, false, "centripetal", 0.5);
    const tailGeo = buildFlatStripGeometry(THREE, tailCurve, 24, 0.011, 0.0012, new THREE.Vector3(0, 0, 1));
    const tailMesh = new THREE.Mesh(tailGeo, ribbonMat);
    tailMesh.castShadow = true;
    tailMesh.userData.slot = "hairAccessory";
    bowGroup.add(tailMesh);
  }

  parent.add(bowGroup);
}

function buildFlatStripGeometry(THREE, curve, segs, width, cup, refNormal) {
  const across = 4;
  const vertsPerRing = across + 1;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const p = curve.getPoint(u);
    const tan = curve.getTangent(u).normalize();
    const bin = new THREE.Vector3().crossVectors(tan, refNormal);
    if (bin.lengthSq() < 1e-5) bin.set(0, 1, 0);
    else bin.normalize();
    const norm = new THREE.Vector3().crossVectors(bin, tan).normalize();

    const wScale = 0.65 + 0.35 * Math.sin(u * Math.PI);
    const halfW = width * 0.5 * wScale;

    for (let c = 0; c <= across; c++) {
      const cf = c / across;
      const s = cf * 2 - 1;
      const cOff = cup * (1 - s * s);
      positions.push(
        p.x + bin.x * (s * halfW) + norm.x * cOff,
        p.y + bin.y * (s * halfW) + norm.y * cOff,
        p.z + bin.z * (s * halfW) + norm.z * cOff
      );
      uvs.push(cf, u);
    }
  }

  for (let i = 0; i < segs; i++) {
    const rA = i * vertsPerRing;
    const rB = rA + vertsPerRing;
    for (let c = 0; c < across; c++) {
      indices.push(rA + c, rB + c, rA + c + 1);
      indices.push(rA + c + 1, rB + c, rB + c + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function addBunPins(THREE, parent, bunPos, bunAxis, bunU, bunV, accentColor) {
  const goldMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#d9b476"),
    metalness: 0.78,
    roughness: 0.24,
    clearcoat: 0.45,
    clearcoatRoughness: 0.2,
  });

  const pearlColor = accentColor.clone().lerp(new THREE.Color("#fff7ef"), 0.72);
  const pearlMat = new THREE.MeshPhysicalMaterial({
    color: pearlColor,
    metalness: 0.05,
    roughness: 0.16,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
    sheen: 0.5,
    sheenColor: new THREE.Color("#ffffff"),
  });

  const shaftGeo = new THREE.CylinderGeometry(0.0017, 0.0011, 0.072, 32);
  const pearlGeo = new THREE.SphereGeometry(0.0085, 32, 32);
  const collarGeo = new THREE.SphereGeometry(0.0042, 32, 32);

  // 3 graceful decorative pins radiating asymmetrically from the bun
  const configs = [
    { ang: 0.52, tilt: 0.35, rOff: 0.044, scale: 1.05 },
    { ang: 0.95, tilt: 0.42, rOff: 0.048, scale: 0.88 },
    { ang: -2.25, tilt: 0.38, rOff: 0.045, scale: 0.96 },
  ];

  configs.forEach((cfg, idx) => {
    const pinGroup = new THREE.Group();
    pinGroup.name = `bunPin${idx + 1}`;

    const radialDir = bunU
      .clone()
      .multiplyScalar(Math.cos(cfg.ang))
      .addScaledVector(bunV, Math.sin(cfg.ang))
      .addScaledVector(bunAxis, cfg.tilt)
      .normalize();

    const shaft = new THREE.Mesh(shaftGeo, goldMat);
    shaft.castShadow = true;
    shaft.userData.slot = "hairAccessory";
    pinGroup.add(shaft);

    const collar = new THREE.Mesh(collarGeo, goldMat);
    collar.position.y = 0.032;
    collar.scale.set(1, 0.75, 1);
    collar.userData.slot = "hairAccessory";
    pinGroup.add(collar);

    const pearl = new THREE.Mesh(pearlGeo, pearlMat);
    pearl.position.y = 0.040;
    pearl.scale.setScalar(cfg.scale);
    pearl.castShadow = true;
    pearl.userData.slot = "hairAccessory";
    pinGroup.add(pearl);

    pinGroup.position.copy(bunPos).addScaledVector(radialDir, cfg.rOff);
    pinGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), radialDir);
    parent.add(pinGroup);
  });
}
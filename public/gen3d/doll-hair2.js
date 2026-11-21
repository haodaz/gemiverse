const HC_Y = 0.14;
const HRX = 0.15;
const HRY = 0.155;
const HRZ = 0.145;

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

function hash1(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function headSurface(THREE, theta, phi, offset = 0) {
  const sp = Math.sin(phi);
  const cp = Math.cos(phi);
  const st = Math.sin(theta);
  const ct = Math.cos(theta);
  const sx = HRX * sp * st;
  const sy = HRY * cp;
  const sz = HRZ * sp * ct;
  const nx = sx / (HRX * HRX);
  const ny = sy / (HRY * HRY);
  const nz = sz / (HRZ * HRZ);
  const nLen = Math.hypot(nx, ny, nz) || 1;
  return new THREE.Vector3(
    sx + (nx / nLen) * offset,
    HC_Y + sy + (ny / nLen) * offset,
    sz + (nz / nLen) * offset
  );
}

function hairlinePhi(theta, style) {
  const at = Math.abs(theta);
  let phi = style === "buzz" ? 1.03 : 0.99;
  phi += 0.10 * smoothstep(0.0, 0.72, at);
  phi += 0.35 * smoothstep(0.68, 1.16, at);
  phi -= 0.08 * Math.exp(-Math.pow((at - 1.48) / 0.21, 2));
  phi += 0.82 * smoothstep(1.46, 2.55, at);
  return phi;
}

function heightToV(y) {
  let t;
  if (y >= 0.10) {
    t = 0.02 + clamp((0.315 - y) / 0.215, 0, 1) * 0.52;
  } else {
    t = 0.54 + clamp((0.10 - y) / 0.44, 0, 1) * 0.44;
  }
  return 1.0 - t;
}

function createHairMaterial(THREE, opts, kit) {
  const baseCol = new THREE.Color(opts.hairColor !== undefined ? opts.hairColor : 0x3e2a22);
  let hiCol;
  if (opts.highlight !== undefined) {
    hiCol = new THREE.Color(opts.highlight);
  } else {
    hiCol = baseCol.clone().lerp(new THREE.Color(0xfff1e4), 0.42);
  }
  const darkCol = baseCol.clone().multiplyScalar(0.76);
  const lightCol = baseCol.clone().lerp(hiCol, 0.32);
  const isBuzz = opts.hairStyle === "buzz";

  const tex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = baseCol.getStyle();
    ctx.fillRect(0, 0, w, h);

    // Subtle root depth & soft lower shading
    const vGrad = ctx.createLinearGradient(0, 0, 0, h);
    vGrad.addColorStop(0.0, `rgba(${Math.round(darkCol.r * 255)},${Math.round(darkCol.g * 255)},${Math.round(darkCol.b * 255)},0.30)`);
    vGrad.addColorStop(0.11, "rgba(0,0,0,0)");
    vGrad.addColorStop(0.78, "rgba(0,0,0,0)");
    vGrad.addColorStop(1.0, `rgba(${Math.round(darkCol.r * 255)},${Math.round(darkCol.g * 255)},${Math.round(darkCol.b * 255)},0.16)`);
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, w, h);

    if (isBuzz) {
      // Soft velvety short-crop grain
      for (let i = 0; i < 4200; i++) {
        const rx = hash1(i * 1.3 + 2.1) * w;
        const ry = hash1(i * 2.7 + 9.4) * h;
        const n = kit.noise(rx * 0.08, ry * 0.08);
        ctx.fillStyle = n > 0.5
          ? `rgba(${Math.round(lightCol.r * 255)},${Math.round(lightCol.g * 255)},${Math.round(lightCol.b * 255)},0.09)`
          : `rgba(${Math.round(darkCol.r * 255)},${Math.round(darkCol.g * 255)},${Math.round(darkCol.b * 255)},0.11)`;
        ctx.fillRect(rx, ry, 2, 3);
      }
    } else {
      // Very faint lengthwise streaks
      const streakCount = 160;
      for (let i = 0; i < streakCount; i++) {
        const u = i / streakCount;
        const x = u * w;
        const n = kit.noise(u * 18.0 + 3.1, 1.7);
        const col = n > 0.5 ? lightCol : darkCol;
        const alpha = 0.028 + Math.abs(n - 0.5) * 0.065;
        ctx.fillStyle = `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},${alpha.toFixed(3)})`;
        ctx.fillRect(x, 0, (w / streakCount) * (0.7 + n * 0.8), h);
      }
    }

    // Soft, wide horizontal "angel ring" highlight band across the upper third
    const ringY = h * 0.235;
    const bandHalf = h * (isBuzz ? 0.11 : 0.082);
    const hr = Math.round(hiCol.r * 255);
    const hg = Math.round(hiCol.g * 255);
    const hb = Math.round(hiCol.b * 255);
    const peakAlpha = isBuzz ? 0.14 : 0.25;
    const cols = 128;
    const colW = w / cols + 1;

    for (let i = 0; i < cols; i++) {
      const u = i / cols;
      const wave =
        Math.sin(u * Math.PI * 6.0) * h * 0.011 +
        Math.sin(u * Math.PI * 14.0 + 1.2) * h * 0.005 +
        (kit.noise(u * 10.0, 4.3) - 0.5) * h * 0.014;
      const localAlpha = peakAlpha * (0.82 + 0.34 * kit.noise(u * 14.0 + 5.0, 2.2));
      const cy = ringY + wave;
      const g = ctx.createLinearGradient(0, cy - bandHalf, 0, cy + bandHalf);
      g.addColorStop(0.0, `rgba(${hr},${hg},${hb},0)`);
      g.addColorStop(0.32, `rgba(${hr},${hg},${hb},${(localAlpha * 0.55).toFixed(3)})`);
      g.addColorStop(0.50, `rgba(${hr},${hg},${hb},${localAlpha.toFixed(3)})`);
      g.addColorStop(0.68, `rgba(${hr},${hg},${hb},${(localAlpha * 0.55).toFixed(3)})`);
      g.addColorStop(1.0, `rgba(${hr},${hg},${hb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(i * (w / cols), cy - bandHalf, colW, bandHalf * 2);
    }
  });

  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  if ("SRGBColorSpace" in THREE) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }

  return new THREE.MeshPhysicalMaterial({
    map: tex,
    color: 0xffffff,
    roughness: 0.7,
    metalness: 0.0,
    sheen: 0.6,
    sheenRoughness: 0.68,
    sheenColor: hiCol,
    clearcoat: 0.0,
    specularIntensity: 0.12
  });
}

function createAccessoryMaterials(THREE, opts) {
  const hi = new THREE.Color(opts.highlight !== undefined ? opts.highlight : 0xe8b8a8);
  const base = new THREE.Color(opts.hairColor !== undefined ? opts.hairColor : 0x3e2a22);
  const hsl = { h: 0, s: 0, l: 0 };
  hi.getHSL(hsl);
  const ribbonCol = new THREE.Color().setHSL((hsl.h + 0.45) % 1, clamp(hsl.s * 0.7 + 0.22, 0.25, 0.58), clamp(hsl.l * 0.65 + 0.22, 0.36, 0.68));
  const bandCol = base.clone().multiplyScalar(0.58);

  const ribbonMat = new THREE.MeshPhysicalMaterial({
    color: ribbonCol,
    roughness: 0.52,
    metalness: 0.0,
    sheen: 0.55,
    sheenRoughness: 0.5,
    sheenColor: ribbonCol.clone().lerp(new THREE.Color(0xffffff), 0.35),
    clearcoat: 0.0,
    specularIntensity: 0.2
  });

  const bandMat = new THREE.MeshPhysicalMaterial({
    color: bandCol,
    roughness: 0.72,
    metalness: 0.0,
    sheen: 0.3,
    sheenColor: hi,
    clearcoat: 0.0,
    specularIntensity: 0.1
  });

  const pearlMat = new THREE.MeshPhysicalMaterial({
    color: 0xfff6ee,
    roughness: 0.28,
    metalness: 0.05,
    sheen: 0.4,
    sheenColor: 0xffffff,
    clearcoat: 0.25,
    specularIntensity: 0.35
  });

  return { ribbonMat, bandMat, pearlMat };
}

function applyClearance(p, halfThick, sideBias, bw, bh, skipHead) {
  const m = 0.013 + halfThick;

  // 1. Head ellipsoid clearance
  if (!skipHead) {
    const rx = HRX + 0.006 + halfThick;
    const ry = HRY + 0.006 + halfThick;
    const rz = HRZ + 0.006 + halfThick;
    const dx = p.x / rx;
    const dy = (p.y - HC_Y) / ry;
    const dz = p.z / rz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < 1.0 && d2 > 1e-8) {
      const s = 1.0 / Math.sqrt(d2);
      p.x = dx * s * rx;
      p.y = HC_Y + dy * s * ry;
      p.z = dz * s * rz;
    }
  }

  // 2. Neck cylinder clearance
  if (p.y < 0.045 && p.y > -0.085 * bh) {
    const neckR = 0.028 * Math.max(1.0, bw) + m;
    const r = Math.hypot(p.x, p.z);
    if (r < neckR) {
      if (r < 1e-5) {
        p.z = sideBias === "front" ? neckR : -neckR;
      } else {
        const s = neckR / r;
        p.x *= s;
        p.z *= s;
      }
    }
  }

  // 3. Shoulder capsule clearance (check both nominal spec capsule & bodyWidth/Height scaled capsule)
  const capsules = [
    { halfX: 0.105, y: -0.07, r: 0.04 + m },
    { halfX: 0.105 * Math.max(1.0, bw), y: -0.07 * bh, r: 0.04 * Math.max(1.0, bw) + m }
  ];
  for (let c = 0; c < capsules.length; c++) {
    const cap = capsules[c];
    const cx = clamp(p.x, -cap.halfX, cap.halfX);
    const dx = p.x - cx;
    const dy = p.y - cap.y;
    const dz = p.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < cap.r) {
      let nx = dx;
      let ny = dy;
      let nz = dz;
      if (sideBias === "back") {
        nz = Math.min(nz, -0.02) - 0.035;
        ny = Math.max(ny, 0) * 0.45;
      } else if (sideBias === "front") {
        nz = Math.max(nz, 0.02) + 0.035;
        ny = Math.max(ny, 0) * 0.45;
      } else if (sideBias === "out") {
        const sgn = p.x >= 0 ? 1 : -1;
        nx += sgn * 0.04;
        nz -= 0.015;
      }
      const nLen = Math.hypot(nx, ny, nz) || 1;
      p.x = cx + (nx / nLen) * cap.r;
      p.y = cap.y + (ny / nLen) * cap.r;
      p.z = (nz / nLen) * cap.r;
    }
  }

  // 4. Upper torso / chest clearance below shoulder line
  if (p.y < -0.07 * bh) {
    const tDown = clamp((-0.07 * bh - p.y) / (0.16 * bh), 0, 1);
    const tx = lerp(0.095, 0.068, tDown) * Math.max(1.0, bw) + m;
    const tz = 0.074 * Math.max(1.0, bw) + m;
    const ex = p.x / tx;
    const ez = p.z / tz;
    const e2 = ex * ex + ez * ez;
    if (e2 < 1.0) {
      if (sideBias === "front") {
        const zMin = tz * Math.sqrt(Math.max(0.04, 1.0 - Math.min(0.95, ex * ex)));
        p.z = Math.max(p.z, zMin);
      } else if (sideBias === "back") {
        const zMax = -tz * Math.sqrt(Math.max(0.04, 1.0 - Math.min(0.95, ex * ex)));
        p.z = Math.min(p.z, zMax);
      } else {
        const s = 1.0 / Math.sqrt(Math.max(e2, 1e-6));
        p.x *= s;
        p.z *= s;
      }
    }
  }
}

function buildVolumeShell(THREE, opts, kit, mat) {
  const style = opts.hairStyle || "longStraight";
  const isBuzz = style === "buzz";
  const isCurly = style === "curlyMedium";
  const isSleek = style === "ponytail" || style === "twinTails" || style === "bun" || style === "pixie";

  const segTheta = 64;
  const segPhi = 32;
  const totalRings = segPhi + 2; // 2 extra tucked rim rings at the hairline
  const cols = segTheta + 1;

  const baseThick = isBuzz ? 0.0068 : isCurly ? 0.0185 : isSleek ? 0.0135 : 0.0155;
  const extraTopBack = isBuzz ? 0.0018 : isCurly ? 0.006 : isSleek ? 0.004 : 0.0055;
  const partTheta = opts.fringe === "sideSwept" ? -0.35 : 0.0;
  const hasPart = !isBuzz && style !== "pixie" && style !== "ponytail" && style !== "bun";

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= totalRings; i++) {
    const isLip1 = i === segPhi + 1;
    const isLip2 = i === segPhi + 2;
    const uPhi = Math.min(1.0, i / segPhi);

    for (let j = 0; j <= segTheta; j++) {
      const uTheta = j / segTheta;
      const theta = -Math.PI + uTheta * Math.PI * 2;
      const maxPhi = hairlinePhi(theta, style);
      let phi = uPhi * maxPhi;

      const backWeight = 0.5 - 0.5 * Math.cos(theta);
      const topWeight = Math.pow(Math.max(0, Math.cos(phi)), 1.35);
      let offset = baseThick + extraTopBack * (0.65 * topWeight + 0.55 * backWeight);

      // Gentle crown parting groove so lock roots tuck invisibly into a sculpted part
      if (hasPart && phi < 1.15) {
        let dTheta = Math.atan2(Math.sin(theta - partTheta), Math.cos(theta - partTheta));
        const alongFront = Math.cos(theta - partTheta) > -0.35 ? 1.0 : 0.35;
        const groove = Math.exp(-Math.pow((dTheta * Math.sin(phi)) / 0.14, 2)) * alongFront * smoothstep(0.0, 0.2, phi) * (1.0 - smoothstep(0.75, 1.15, phi));
        offset -= 0.0032 * groove;
      }

      // Soft sculpted micro-variation
      const wave = (kit.noise(Math.cos(theta) * 2.2 + 3.0, Math.sin(theta) * 2.2 + phi * 1.8) - 0.5) * (isBuzz ? 0.0008 : 0.0018);
      offset += wave * smoothstep(0.05, 0.25, uPhi) * (1.0 - smoothstep(0.82, 1.0, uPhi));

      // Taper smoothly near hairline, then tuck neatly inward on the 2 rim rings
      if (!isLip1 && !isLip2) {
        const edgeFade = smoothstep(0.84, 1.0, uPhi);
        const minEdge = isBuzz ? 0.005 : 0.0075;
        offset = lerp(offset, minEdge, edgeFade);
      } else if (isLip1) {
        phi = maxPhi + 0.015;
        offset = 0.004;
      } else {
        phi = maxPhi + 0.025;
        offset = -0.0045;
      }

      const p = headSurface(THREE, theta, phi, offset);
      positions.push(p.x, p.y, p.z);
      uvs.push(uTheta * 2.0, heightToV(p.y));
    }
  }

  for (let i = 0; i < totalRings; i++) {
    for (let j = 0; j < segTheta; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = (i + 1) * cols + j;
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

  // Stitch seam normals & smooth crown pole normals
  const norm = geo.attributes.normal;
  for (let j = 0; j <= segTheta; j++) {
    norm.setXYZ(j, 0, 1, 0);
  }
  for (let i = 1; i <= totalRings; i++) {
    const i0 = i * cols;
    const i1 = i * cols + segTheta;
    const nx = norm.getX(i0) + norm.getX(i1);
    const ny = norm.getY(i0) + norm.getY(i1);
    const nz = norm.getZ(i0) + norm.getZ(i1);
    const l = Math.hypot(nx, ny, nz) || 1;
    norm.setXYZ(i0, nx / l, ny / l, nz / l);
    norm.setXYZ(i1, nx / l, ny / l, nz / l);
  }
  norm.needsUpdate = true;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.slot = "hair";
  return mesh;
}

function buildChunkLock(THREE, cfg, mat) {
  const segsL = cfg.segsL || 22;
  const segsR = 32;
  const cols = segsR + 1;
  const maxW = cfg.width || 0.048;
  const maxT = cfg.thick || 0.016;
  const arch = cfg.arch !== undefined ? cfg.arch : 0.24;
  const taperPow = cfg.taperPow || 1.35;
  const rootScale = cfg.rootScale !== undefined ? cfg.rootScale : 0.68;
  const twistTotal = cfg.twist || 0.0;
  const sideBias = cfg.sideBias || "back";
  const bw = cfg.bw || 1.0;
  const bh = cfg.bh || 1.0;

  const curve = new THREE.CatmullRomCurve3(cfg.points, false, "centripetal", 0.5);
  const pts = [];
  for (let i = 0; i <= segsL; i++) {
    pts.push(curve.getPoint(i / segsL));
  }

  // Resolve clearance along the curve while keeping roots tucked inside volume shell
  if (cfg.clearance !== false) {
    const resolveAll = () => {
      for (let i = 1; i <= segsL; i++) {
        const t = i / segsL;
        const halfT = maxT * 0.5 * Math.pow(1.0 - t * 0.85, 0.8);
        applyClearance(pts[i], halfT, sideBias, bw, bh, i < 2);
      }
    };
    resolveAll();
    // Gentle Laplacian smoothing so bends over shoulders stay silky smooth
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 2; i < segsL; i++) {
        pts[i].x = pts[i].x * 0.5 + (pts[i - 1].x + pts[i + 1].x) * 0.25;
        pts[i].y = pts[i].y * 0.5 + (pts[i - 1].y + pts[i + 1].y) * 0.25;
        pts[i].z = pts[i].z * 0.5 + (pts[i - 1].z + pts[i + 1].z) * 0.25;
      }
      resolveAll();
    }
  }

  // Determine root pivot for sway
  const pivotIdx = clamp(Math.round(segsL * (cfg.pivotT !== undefined ? cfg.pivotT : 0.12)), 0, segsL - 1);
  const pivot = cfg.pivotPos ? cfg.pivotPos.clone() : pts[pivotIdx].clone();

  const positions = [];
  const uvs = [];
  const indices = [];

  const tangents = [];
  for (let i = 0; i <= segsL; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(segsL, i + 1)];
    tangents.push(new THREE.Vector3().subVectors(next, prev).normalize());
  }

  const prevN = new THREE.Vector3();
  const outHint = cfg.outHint ? cfg.outHint.clone().normalize() : null;
  const uOffset = cfg.uOffset || 0;

  for (let i = 0; i <= segsL; i++) {
    const t = i / segsL;
    const p = pts[i];
    const T = tangents[i];

    // Preferred outward normal so locks shingle flat like roof tiles
    const pref = new THREE.Vector3();
    if (p.y > 0.04) {
      pref.set(p.x, (p.y - HC_Y) * 0.85, p.z);
    } else {
      const blend = clamp((0.04 - p.y) / 0.12, 0, 1);
      pref.set(p.x, (p.y - HC_Y) * 0.85 * (1 - blend), p.z);
    }
    if (outHint) {
      pref.normalize().lerp(outHint, cfg.outHintWeight !== undefined ? cfg.outHintWeight : 0.45);
    }
    if (pref.lengthSq() < 1e-6) {
      pref.set(0, 0, -1);
    } else {
      pref.normalize();
    }

    // Orthogonalize against T
    const N = pref.clone().addScaledVector(T, -pref.dot(T));
    if (N.lengthSq() < 1e-6) {
      N.copy(prevN.lengthSq() > 0 ? prevN : new THREE.Vector3(0, 0, 1));
      N.addScaledVector(T, -N.dot(T));
    }
    N.normalize();
    if (i > 0 && N.dot(prevN) < 0) {
      N.negate();
    }
    prevN.copy(N);

    const B = new THREE.Vector3().crossVectors(T, N).normalize();

    // Optional gentle twist
    const tw = twistTotal * smoothstep(0.15, 1.0, t);
    if (Math.abs(tw) > 1e-4) {
      const ct = Math.cos(tw);
      const st = Math.sin(tw);
      const n2 = N.clone().multiplyScalar(ct).addScaledVector(B, st);
      const b2 = B.clone().multiplyScalar(ct).addScaledVector(N, -st);
      N.copy(n2);
      B.copy(b2);
    }

    // Sculptural width & thickness profile along the lock
    let wScale;
    let tScale;
    if (i === 0) {
      wScale = 0.001;
      tScale = 0.001;
    } else if (i === segsL) {
      wScale = 0.0005;
      tScale = 0.0005;
    } else {
      const swell = lerp(rootScale, 1.0, smoothstep(0.0, 0.22, t));
      const tipFade = 1.0 - smoothstep(0.32, 1.0, t);
      wScale = swell * Math.pow(Math.max(0.001, tipFade), taperPow * 0.62);
      tScale = lerp(0.82, 1.0, smoothstep(0.0, 0.18, t)) * Math.pow(Math.max(0.001, 1.0 - smoothstep(0.28, 1.0, t)), taperPow * 0.72);
    }

    const halfW = maxW * 0.5 * wScale;
    const halfT = maxT * 0.5 * tScale;

    for (let j = 0; j <= segsR; j++) {
      const u = j / segsR;
      const a = u * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);

      // Almond / curved crescent cross-section with soft outer crest
      const bx = ca * halfW;
      let by = sa * halfT * (1.0 - 0.16 * ca * ca);
      by -= arch * halfT * ca * ca;
      if (sa > 0) {
        by += 0.14 * halfT * sa * sa * sa;
      }

      const wx = p.x + B.x * bx + N.x * by;
      const wy = p.y + B.y * bx + N.y * by;
      const wz = p.z + B.z * bx + N.z * by;

      positions.push(wx - pivot.x, wy - pivot.y, wz - pivot.z);

      let v;
      if (cfg.uvMode === "tail") {
        v = 1.0 - lerp(0.14, 0.96, t);
      } else if (cfg.uvMode === "bun") {
        v = 1.0 - lerp(0.18, 0.55, 0.5 + 0.5 * Math.sin(t * Math.PI));
      } else {
        v = heightToV(wy);
      }
      uvs.push(uOffset + u * 0.35, v);
    }
  }

  for (let i = 0; i < segsL; i++) {
    for (let j = 0; j < segsR; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = (i + 1) * cols + j;
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

  // Stitch cross-section seam & pole normals
  const norm = geo.attributes.normal;
  const tStart = tangents[0];
  const tEnd = tangents[segsL];
  for (let j = 0; j <= segsR; j++) {
    norm.setXYZ(j, -tStart.x, -tStart.y, -tStart.z);
    norm.setXYZ(segsL * cols + j, tEnd.x, tEnd.y, tEnd.z);
  }
  for (let i = 1; i < segsL; i++) {
    const i0 = i * cols;
    const i1 = i * cols + segsR;
    const nx = norm.getX(i0) + norm.getX(i1);
    const ny = norm.getY(i0) + norm.getY(i1);
    const nz = norm.getZ(i0) + norm.getZ(i1);
    const l = Math.hypot(nx, ny, nz) || 1;
    norm.setXYZ(i0, nx / l, ny / l, nz / l);
    norm.setXYZ(i1, nx / l, ny / l, nz / l);
  }
  norm.needsUpdate = true;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pivot);
  mesh.userData.slot = "hair";
  mesh.userData.sway = {
    amp: cfg.swayAmp !== undefined ? cfg.swayAmp : 0.045,
    phase: cfg.swayPhase !== undefined ? cfg.swayPhase : 0,
    theta: cfg.swayTheta !== undefined ? cfg.swayTheta : Math.atan2(pivot.x, pivot.z)
  };
  return mesh;
}

function makeSkullDrapePoints(THREE, spec) {
  const {
    theta,
    rootPhi = 0.20,
    releasePhi = 1.55,
    endY = -0.22,
    layerOffset = 0.020,
    flare = 0.012,
    tuck = 0.0,
    waveAmp = 0.0,
    waveFreq = 1.8,
    wavePhase = 0.0,
    spiralR = 0.0,
    spiralTurns = 1.1,
    thetaDrift = 0.0,
    pushZ = 0.0
  } = spec;

  const pts = [];
  // Point 0: buried cleanly inside volume shell near crown/part
  pts.push(headSurface(THREE, theta, rootPhi, 0.005));
  // Point 1: emerges smoothly onto volume shell surface
  const midPhi1 = lerp(rootPhi, releasePhi, 0.38);
  pts.push(headSurface(THREE, theta + thetaDrift * 0.2, midPhi1, layerOffset * 0.92));
  // Point 2: hugs skull near release latitude
  const midPhi2 = lerp(rootPhi, releasePhi, 0.80);
  pts.push(headSurface(THREE, theta + thetaDrift * 0.55, midPhi2, layerOffset * 1.05));

  const relPt = headSurface(THREE, theta + thetaDrift * 0.85, releasePhi, layerOffset + flare * 0.35);
  pts.push(relPt);

  const drop = Math.max(0.02, relPt.y - endY);
  const steps = spiralR > 0 ? 9 : waveAmp > 0 ? 7 : 4;
  const finalTheta = theta + thetaDrift;
  const radX = Math.sin(finalTheta);
  const radZ = Math.cos(finalTheta);
  const tanX = Math.cos(finalTheta);
  const tanZ = -Math.sin(finalTheta);

  for (let s = 1; s <= steps; s++) {
    const f = s / steps;
    const y = lerp(relPt.y, endY, f);
    // Outward flare / inward bob tuck
    const rShift = flare * Math.sin(f * Math.PI * 0.72) - tuck * Math.pow(f, 1.8);
    let x = relPt.x + radX * rShift;
    let z = relPt.z + radZ * rShift + pushZ * smoothstep(0.0, 0.65, f);

    // Broad S-wave for wavy style
    if (waveAmp > 0) {
      const env = smoothstep(0.0, 0.25, f) * (1.0 - 0.18 * f);
      const ang = f * Math.PI * 2 * waveFreq + wavePhase;
      const wTan = Math.sin(ang) * waveAmp * env;
      const wRad = Math.cos(ang) * waveAmp * 0.55 * env;
      x += tanX * wTan + radX * wRad;
      z += tanZ * wTan + radZ * wRad;
    }

    // Fat 3D helix spiral for curlyMedium
    if (spiralR > 0) {
      const env = smoothstep(0.0, 0.28, f) * (0.65 + 0.55 * f);
      const ang = f * Math.PI * 2 * spiralTurns + wavePhase;
      const sr = spiralR * env;
      x += (tanX * Math.cos(ang) + radX * Math.sin(ang)) * sr;
      z += (tanZ * Math.cos(ang) + radZ * Math.sin(ang)) * sr;
    }

    pts.push(new THREE.Vector3(x, y, z));
  }

  return pts;
}

function addFringe(THREE, group, swayLocks, opts, mat, bw, bh) {
  const style = opts.hairStyle || "longStraight";
  const fringe = opts.fringe !== undefined ? opts.fringe : "full";
  if (style === "buzz" || fringe === "none") return;

  const isPixie = style === "pixie";
  const tipBaseY = isPixie ? 0.178 : 0.165;
  const locks = [];

  if (fringe === "full") {
    const count = 7;
    for (let i = 0; i < count; i++) {
      const frac = count === 1 ? 0 : (i / (count - 1)) * 2 - 1; // -1..1
      const theta = frac * 0.72;
      const isEdge = Math.abs(frac) > 0.78;
      const jitter = (hash1(i * 4.7 + 1.3) - 0.5) * 0.012;
      const tipY = isEdge ? tipBaseY - 0.025 : tipBaseY + jitter + Math.abs(frac) * 0.008;
      const tipPhi = Math.acos(clamp((tipY - HC_Y) / HRY, -0.95, 0.95));
      const rootPhi = 0.24 + Math.abs(frac) * 0.12;
      const layer = 0.0155 + (i % 2) * 0.0028;

      const pts = [
        headSurface(THREE, theta * 0.45, rootPhi, 0.005),
        headSurface(THREE, theta * 0.78, lerp(rootPhi, tipPhi, 0.36), layer * 0.95),
        headSurface(THREE, theta * 0.96, lerp(rootPhi, tipPhi, 0.72), layer * 1.02),
        headSurface(THREE, theta + frac * 0.04, tipPhi, layer * 0.85)
      ];
      locks.push({
        points: pts,
        width: isEdge ? 0.042 : (isPixie ? 0.036 : 0.044) + (i % 2 === 0 ? 0.005 : -0.003),
        thick: isPixie ? 0.012 : 0.0145,
        taperPow: 1.45,
        arch: 0.26,
        swayAmp: 0.014,
        swayPhase: i * 0.9 + 0.5,
        swayTheta: theta,
        uOffset: i * 0.19
      });
    }
  } else if (fringe === "sideSwept") {
    const count = 7;
    for (let i = 0; i < count; i++) {
      const u = i / (count - 1);
      const startTheta = lerp(-0.52, -0.18, u);
      const endTheta = lerp(-0.78, 0.74, u);
      const isShortSide = i === 0;
      const tipY = isShortSide ? tipBaseY - 0.015 : tipBaseY + 0.005 + (1 - u) * 0.022 + (hash1(i * 3.1) - 0.5) * 0.008;
      const tipPhi = Math.acos(clamp((tipY - HC_Y) / HRY, -0.95, 0.95));
      const rootPhi = 0.26 + Math.abs(u - 0.5) * 0.12;
      const layer = 0.015 + (i % 2) * 0.0032;

      const pts = [
        headSurface(THREE, startTheta, rootPhi, 0.005),
        headSurface(THREE, lerp(startTheta, endTheta, 0.38), lerp(rootPhi, tipPhi, 0.35), layer * 0.96),
        headSurface(THREE, lerp(startTheta, endTheta, 0.74), lerp(rootPhi, tipPhi, 0.72), layer * 1.04),
        headSurface(THREE, endTheta, tipPhi, layer * 0.85)
      ];
      locks.push({
        points: pts,
        width: isPixie ? 0.038 : 0.046,
        thick: 0.014,
        taperPow: 1.4,
        arch: 0.24,
        swayAmp: 0.015,
        swayPhase: i * 0.85 + 1.1,
        swayTheta: endTheta,
        uOffset: i * 0.17
      });
    }
  } else if (fringe === "curtain") {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const rootTheta = side * (0.06 + k * 0.10);
        const midTheta = side * (0.34 + k * 0.20);
        const endTheta = side * (0.58 + k * 0.22);
        const tipY = (isPixie ? 0.165 : 0.145) - k * 0.018;
        const tipPhi = Math.acos(clamp((tipY - HC_Y) / HRY, -0.95, 0.95));
        const rootPhi = 0.22 + k * 0.07;
        const layer = 0.0155 + k * 0.0022;

        const pts = [
          headSurface(THREE, rootTheta, rootPhi, 0.005),
          headSurface(THREE, lerp(rootTheta, midTheta, 0.65), lerp(rootPhi, tipPhi, 0.34), layer),
          headSurface(THREE, lerp(midTheta, endTheta, 0.7), lerp(rootPhi, tipPhi, 0.70), layer * 1.05),
          headSurface(THREE, endTheta, tipPhi, layer * 0.9)
        ];
        locks.push({
          points: pts,
          width: 0.044 - k * 0.003,
          thick: 0.014,
          taperPow: 1.45,
          arch: 0.25,
          swayAmp: 0.018,
          swayPhase: k * 1.1 + (side > 0 ? 0.4 : 2.2),
          swayTheta: endTheta,
          uOffset: (k + (side > 0 ? 3 : 0)) * 0.21
        });
      }
    }
  }

  for (let i = 0; i < locks.length; i++) {
    const lc = locks[i];
    const mesh = buildChunkLock(THREE, {
      ...lc,
      segsL: 16,
      sideBias: "front",
      pivotT: 0.14,
      bw,
      bh
    }, mat);
    group.add(mesh);
    swayLocks.push(mesh);
  }
}

function addFaceFramingLocks(THREE, group, swayLocks, mat, bw, bh, opts = {}) {
  const endY = opts.endY !== undefined ? opts.endY : 0.02;
  const width = opts.width || 0.038;
  const thick = opts.thick || 0.014;
  const swayAmp = opts.swayAmp || 0.032;
  const thetas = opts.thetas || [0.98];

  for (const side of [-1, 1]) {
    for (let k = 0; k < thetas.length; k++) {
      const th = side * thetas[k];
      const pts = makeSkullDrapePoints(THREE, {
        theta: th,
        rootPhi: 0.35 + k * 0.08,
        releasePhi: 1.52,
        endY: endY - k * 0.025,
        layerOffset: 0.017 + k * 0.002,
        flare: 0.010,
        tuck: endY > -0.02 ? 0.012 : 0.0,
        waveAmp: opts.waveAmp || 0.0,
        waveFreq: 1.2,
        wavePhase: side * 0.8 + k,
        thetaDrift: -side * 0.10,
        pushZ: endY < -0.06 ? 0.032 : 0.012
      });
      const mesh = buildChunkLock(THREE, {
        points: pts,
        width,
        thick,
        segsL: 20,
        sideBias: "front",
        swayAmp,
        swayPhase: k * 1.4 + (side > 0 ? 0.7 : 2.9),
        swayTheta: th,
        uOffset: k * 0.3 + (side > 0 ? 0.1 : 0.6),
        bw,
        bh
      }, mat);
      group.add(mesh);
      swayLocks.push(mesh);
    }
  }
}

function buildElastic(THREE, pos, dir, radius, tubeR, mat) {
  const geo = new THREE.TorusGeometry(radius, tubeR, 16, 32);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
  mesh.quaternion.copy(q);
  mesh.userData.slot = "hairAccessory";
  return mesh;
}

function buildRibbon(THREE, pos, outDir, scale, mat) {
  const g = new THREE.Group();
  g.position.copy(pos);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), outDir.clone().normalize());
  g.quaternion.copy(q);

  // Center knot
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.010 * scale, 32, 20), mat);
  knot.scale.set(0.85, 0.75, 0.7);
  knot.userData.slot = "hairAccessory";
  g.add(knot);

  // Two compact sculpted loops + short tails
  for (const s of [-1, 1]) {
    const loopGeo = new THREE.TorusGeometry(0.018 * scale, 0.0058 * scale, 16, 32);
    const loop = new THREE.Mesh(loopGeo, mat);
    loop.position.set(s * 0.017 * scale, 0.003 * scale, 0.002 * scale);
    loop.scale.set(1.15, 0.72, 0.55);
    loop.rotation.z = s * 0.22;
    loop.rotation.y = -s * 0.25;
    loop.userData.slot = "hairAccessory";
    g.add(loop);

    const tailGeo = new THREE.ConeGeometry(0.0075 * scale, 0.036 * scale, 32, 4);
    const tail = new THREE.Mesh(tailGeo, mat);
    tail.position.set(s * 0.011 * scale, -0.020 * scale, 0.002 * scale);
    tail.scale.set(1.0, 1.0, 0.32);
    tail.rotation.z = s * 0.28;
    tail.rotation.x = Math.PI;
    tail.userData.slot = "hairAccessory";
    g.add(tail);
  }
  return g;
}

function buildTailCascade(THREE, group, swayLocks, cfg, mat, bw, bh) {
  const { origin, dir, count, length, spread, waveAmp, waveFreq, baseWidth, baseThick, swayAmp, phaseBase } = cfg;
  const d = dir.clone().normalize();
  const upRef = Math.abs(d.y) > 0.9 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(upRef, d).normalize();
  const up = new THREE.Vector3().crossVectors(d, right).normalize();

  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.3;
    const ring = i % 2 === 0 ? 1.0 : 0.62;
    const radOff = right.clone().multiplyScalar(Math.cos(a) * spread * ring).addScaledVector(up, Math.sin(a) * spread * 0.7 * ring);
    const lenMul = 0.88 + 0.22 * hash1(i * 5.1 + phaseBase);
    const len = length * lenMul;

    const pts = [];
    // Buried slightly inside the tie point
    pts.push(origin.clone().addScaledVector(d, -0.012));
    pts.push(origin.clone().addScaledVector(d, 0.022).addScaledVector(radOff, 0.35));

    const steps = 7;
    for (let s = 1; s <= steps; s++) {
      const f = s / steps;
      const archOut = Math.sin(f * Math.PI * 0.65) * 0.055 + f * 0.035;
      const archUp = Math.sin(f * Math.PI * 0.55) * 0.025 * (1 - f);
      const drop = Math.pow(f, 1.45) * len;
      const p = origin.clone()
        .addScaledVector(d, archOut)
        .addScaledVector(radOff, 0.45 + f * 1.15);
      p.y += archUp - drop;

      if (waveAmp > 0) {
        const wEnv = smoothstep(0.05, 0.35, f);
        const wAng = f * Math.PI * 2 * waveFreq + a + phaseBase;
        p.addScaledVector(right, Math.sin(wAng) * waveAmp * wEnv);
        p.addScaledVector(d, Math.cos(wAng) * waveAmp * 0.45 * wEnv);
      }
      pts.push(p);
    }

    const sideBias = Math.abs(origin.x) > 0.08 ? "out" : "back";
    const mesh = buildChunkLock(THREE, {
      points: pts,
      width: baseWidth * (0.86 + 0.26 * hash1(i * 2.9 + phaseBase)),
      thick: baseThick,
      segsL: 24,
      rootScale: 0.55,
      taperPow: 1.35,
      arch: 0.22,
      outHint: radOff.clone().addScaledVector(d, 0.8),
      outHintWeight: 0.55,
      uvMode: "tail",
      pivotPos: origin,
      sideBias,
      swayAmp: swayAmp * (0.85 + 0.3 * hash1(i * 3.7)),
      swayPhase: phaseBase + i * 0.65,
      swayTheta: Math.atan2(origin.x + d.x * 0.1, origin.z + d.z * 0.1),
      uOffset: i * 0.15,
      bw,
      bh
    }, mat);
    group.add(mesh);
    swayLocks.push(mesh);
  }
}

function buildBackCrownLocks(THREE, group, swayLocks, style, mat, bw, bh) {
  if (style === "longStraight" || style === "longWavy") {
    const isWavy = style === "longWavy";
    const backCount = 13;
    for (let i = 0; i < backCount; i++) {
      const u = i / (backCount - 1); // 0..1
      const theta = lerp(-Math.PI * 0.96, Math.PI * 0.96, u);
      // Skip front forehead zone; concentrate around sides & back
      const mappedTheta = theta >= 0
        ? lerp(1.18, Math.PI, Math.abs(u - 0.5) * 2)
        : -lerp(1.18, Math.PI, Math.abs(u - 0.5) * 2);
      const tAngle = lerp(1.16, Math.PI * 2 - 1.16, u);
      const normAngle = tAngle > Math.PI ? tAngle - Math.PI * 2 : tAngle;
      const isOuterShoulder = Math.abs(normAngle) < 1.65;
      const layer = (i % 2 === 0 ? 0.020 : 0.025);
      const lenVar = (hash1(i * 3.9 + 1.1) - 0.5) * 0.045;
      const endY = (isOuterShoulder ? -0.20 : -0.275) + lenVar;

      const pts = makeSkullDrapePoints(THREE, {
        theta: normAngle,
        rootPhi: 0.18 + (i % 2) * 0.06,
        releasePhi: 1.62,
        endY,
        layerOffset: layer,
        flare: isWavy ? 0.024 : 0.016,
        waveAmp: isWavy ? 0.025 + (i % 2) * 0.007 : 0.004,
        waveFreq: isWavy ? 1.75 : 0.7,
        wavePhase: i * 0.85,
        pushZ: isOuterShoulder ? -0.015 : -0.032
      });

      const mesh = buildChunkLock(THREE, {
        points: pts,
        width: (isWavy ? 0.056 : 0.054) + (i % 2 === 0 ? 0.006 : -0.004),
        thick: isWavy ? 0.019 : 0.016,
        segsL: isWavy ? 28 : 22,
        taperPow: 1.32,
        arch: 0.24,
        sideBias: isOuterShoulder ? "out" : "back",
        swayAmp: 0.048 + (i % 2) * 0.012,
        swayPhase: i * 0.72,
        swayTheta: normAngle,
        uOffset: i * 0.14,
        bw,
        bh
      }, mat);
      group.add(mesh);
      swayLocks.push(mesh);
    }

    // Second subtle upper-back shingle layer for plush thickness
    const upperCount = 5;
    for (let i = 0; i < upperCount; i++) {
      const u = i / (upperCount - 1);
      const ang = lerp(1.75, Math.PI * 2 - 1.75, u);
      const normAngle = ang > Math.PI ? ang - Math.PI * 2 : ang;
      const pts = makeSkullDrapePoints(THREE, {
        theta: normAngle,
        rootPhi: 0.24,
        releasePhi: 1.68,
        endY: -0.21 + (hash1(i * 7.3) - 0.5) * 0.035,
        layerOffset: 0.028,
        flare: isWavy ? 0.028 : 0.020,
        waveAmp: isWavy ? 0.026 : 0.005,
        waveFreq: isWavy ? 1.6 : 0.6,
        wavePhase: i * 1.15 + 0.5,
        pushZ: -0.042
      });
      const mesh = buildChunkLock(THREE, {
        points: pts,
        width: 0.052,
        thick: 0.016,
        segsL: isWavy ? 26 : 22,
        taperPow: 1.4,
        arch: 0.25,
        sideBias: "back",
        swayAmp: 0.055,
        swayPhase: i * 1.05 + 2.1,
        swayTheta: normAngle,
        uOffset: i * 0.23 + 0.5,
        bw,
        bh
      }, mat);
      group.add(mesh);
      swayLocks.push(mesh);
    }

    // Face-framing front shoulder locks
    addFaceFramingLocks(THREE, group, swayLocks, mat, bw, bh, {
      endY: -0.14,
      width: 0.042,
      thick: 0.015,
      swayAmp: 0.042,
      waveAmp: isWavy ? 0.016 : 0.003,
      thetas: [0.95]
    });
  } else if (style === "bob") {
    const count = 16;
    for (let i = 0; i < count; i++) {
      const u = i / (count - 1);
      const ang = lerp(0.95, Math.PI * 2 - 0.95, u);
      const normAngle = ang > Math.PI ? ang - Math.PI * 2 : ang;
      const isFrontSide = Math.abs(normAngle) < 1.35;
      const layer = 0.019 + (i % 2) * 0.0045;
      const jitter = (hash1(i * 4.3 + 2.2) - 0.5) * 0.016;
      const endY = (isFrontSide ? -0.012 : 0.006) + jitter;

      const pts = makeSkullDrapePoints(THREE, {
        theta: normAngle,
        rootPhi: 0.18 + (i % 2) * 0.06,
        releasePhi: 1.56,
        endY,
        layerOffset: layer,
        flare: 0.022,
        tuck: 0.026,
        thetaDrift: isFrontSide ? -Math.sign(normAngle) * 0.12 : 0.0
      });

      const mesh = buildChunkLock(THREE, {
        points: pts,
        width: 0.052 + (i % 2 === 0 ? 0.005 : -0.003),
        thick: 0.017,
        segsL: 20,
        taperPow: 1.45,
        arch: 0.28,
        sideBias: isFrontSide ? "front" : "back",
        swayAmp: 0.030,
        swayPhase: i * 0.68,
        swayTheta: normAngle,
        uOffset: i * 0.13,
        bw,
        bh
      }, mat);
      group.add(mesh);
      swayLocks.push(mesh);
    }
  } else if (style === "shortLayered") {
    // Lower nape & side layer (12 locks)
    const lowerCount = 12;
    for (let i = 0; i < lowerCount; i++) {
      const u = i / (lowerCount - 1);
      const ang = lerp(1.02, Math.PI * 2 - 1.02, u);
      const normAngle = ang > Math.PI ? ang - Math.PI * 2 : ang;
      const isSide = Math.abs(normAngle) < 1.5;
      const flick = (i % 3 === 0 ? 0.016 : -0.012);
      const pts = makeSkullDrapePoints(THREE, {
        theta: normAngle,
        rootPhi: 0.24,
        releasePhi: 1.62,
        endY: (isSide ? 0.032 : 0.016) + (hash1(i * 3.7) - 0.5) * 0.018,
        layerOffset: 0.018 + (i % 2) * 0.003,
        flare: 0.016 + Math.max(0, flick),
        tuck: Math.max(0, -flick),
        thetaDrift: (hash1(i * 6.1) - 0.5) * 0.14
      });
      const mesh = buildChunkLock(THREE, {
        points: pts,
        width: 0.048,
        thick: 0.015,
        segsL: 18,
        taperPow: 1.45,
        arch: 0.25,
        sideBias: isSide ? "out" : "back",
        swayAmp: 0.028,
        swayPhase: i * 0.8,
        swayTheta: normAngle,
        uOffset: i * 0.16,
        bw,
        bh
      }, mat);
      group.add(mesh);
      swayLocks.push(mesh);
    }

    // Upper feathered crown layer (8 locks)
    const upperCount = 8;
    for (let i = 0; i < upperCount; i++) {
      const u = i / (upperCount - 1);
      const ang = lerp(1.05, Math.PI * 2 - 1.05, u);
      const normAngle = ang > Math.PI ? ang - Math.PI * 2 : ang;
      const pts = makeSkullDrapePoints(THREE, {
        theta: normAngle,
        rootPhi: 0.16,
        releasePhi: 1.38,
        endY: 0.088 + (hash1(i * 5.3 + 2.0) - 0.5) * 0.022,
        layerOffset: 0.024,
        flare: 0.020,
        tuck: 0.006,
        thetaDrift: (i % 2 === 0 ? 1 : -1) * 0.10
      });
      const mesh = buildChunkLock(THREE, {
        points: pts,
        width: 0.046,
        thick: 0.015,
        segsL: 16,
        taperPow: 1.5,
        arch: 0.26,
        sideBias: "back",
        swayAmp: 0.024,
        swayPhase: i * 1.1 + 1.4,
        swayTheta: normAngle,
        uOffset: i * 0.22 + 0.3,
        bw,
        bh
      }, mat);
      group.add(mesh);
      swayLocks.push(mesh);
    }
  } else if (style === "pixie") {
    const count = 15;
    for (let i = 0; i < count; i++) {
      const u = i / (count - 1);
      const ang = lerp(0.95, Math.PI * 2 - 0.95, u);
      const normAngle = ang > Math.PI ? ang - Math.PI * 2 : ang;
      const isBack = Math.abs(normAngle) > 1.75;
      const endY = (isBack ? 0.055 : 0.095) + (hash1(i * 4.1) - 0.5) * 0.024;
      const tipPhi = Math.acos(clamp((endY - HC_Y) / HRY, -0.95, 0.95));
      const rootPhi = 0.18 + (i % 2) * 0.12;
      const sweep = (normAngle >= 0 ? -0.14 : 0.14) * (isBack ? 0.4 : 1.0);
      const layer = 0.0145 + (i % 2) * 0.003;

      const pts = [
        headSurface(THREE, normAngle, rootPhi, 0.005),
        headSurface(THREE, normAngle + sweep * 0.35, lerp(rootPhi, tipPhi, 0.38), layer),
        headSurface(THREE, normAngle + sweep * 0.72, lerp(rootPhi, tipPhi, 0.74), layer * 1.06),
        headSurface(THREE, normAngle + sweep, tipPhi, layer * 0.78)
      ];

      const mesh = buildChunkLock(THREE, {
        points: pts,
        width: 0.042 + (i % 2) * 0.005,
        thick: 0.0125,
        segsL: 16,
        taperPow: 1.5,
        arch: 0.25,
        sideBias: isBack ? "back" : "out",
        swayAmp: 0.014,
        swayPhase: i * 0.75,
        swayTheta: normAngle,
        uOffset: i * 0.17,
        bw,
        bh
      }, mat);
      group.add(mesh);
      swayLocks.push(mesh);
    }
  } else if (style === "curlyMedium") {
    // 18 fat spiralling chunks in two bouncy tiers
    const outerCount = 12;
    for (let i = 0; i < outerCount; i++) {
      const u = i / (outerCount - 1);
      const ang = lerp(1.00, Math.PI * 2 - 1.00, u);
      const normAngle = ang > Math.PI ? ang - Math.PI * 2 : ang;
      const isSide = Math.abs(normAngle) < 1.55;
      const endY = (isSide ? -0.055 : -0.085) + (hash1(i * 4.9 + 0.7) - 0.5) * 0.032;

      const pts = makeSkullDrapePoints(THREE, {
        theta: normAngle,
        rootPhi: 0.18 + (i % 2) * 0.07,
        releasePhi: 1.48,
        endY,
        layerOffset: 0.022 + (i % 2) * 0.004,
        flare: 0.032,
        spiralR: 0.024 + (i % 2) * 0.006,
        spiralTurns: 1.15 * (i % 2 === 0 ? 1 : -1),
        wavePhase: i * 1.2,
        pushZ: isSide ? 0.0 : -0.020
      });

      const mesh = buildChunkLock(THREE, {
        points: pts,
        width: 0.052 + (i % 2) * 0.006,
        thick: 0.020,
        segsL: 30,
        taperPow: 1.25,
        arch: 0.18,
        twist: (i % 2 === 0 ? 1 : -1) * 0.9,
        sideBias: isSide ? "out" : "back",
        swayAmp: 0.042,
        swayPhase: i * 0.85,
        swayTheta: normAngle,
        uOffset: i * 0.19,
        bw,
        bh
      }, mat);
      group.add(mesh);
      swayLocks.push(mesh);
    }

    const upperCount = 6;
    for (let i = 0; i < upperCount; i++) {
      const u = i / (upperCount - 1);
      const ang = lerp(1.25, Math.PI * 2 - 1.25, u);
      const normAngle = ang > Math.PI ? ang - Math.PI * 2 : ang;
      const pts = makeSkullDrapePoints(THREE, {
        theta: normAngle,
        rootPhi: 0.20,
        releasePhi: 1.38,
        endY: -0.015 + (hash1(i * 6.3) - 0.5) * 0.025,
        layerOffset: 0.029,
        flare: 0.036,
        spiralR: 0.022,
        spiralTurns: 0.95 * (i % 2 === 0 ? -1 : 1),
        wavePhase: i * 1.4 + 0.9,
        pushZ: -0.015
      });
      const mesh = buildChunkLock(THREE, {
        points: pts,
        width: 0.048,
        thick: 0.019,
        segsL: 26,
        taperPow: 1.3,
        arch: 0.18,
        twist: (i % 2 === 0 ? -0.8 : 0.8),
        sideBias: Math.abs(normAngle) < 1.6 ? "out" : "back",
        swayAmp: 0.036,
        swayPhase: i * 1.1 + 2.0,
        swayTheta: normAngle,
        uOffset: i * 0.25 + 0.4,
        bw,
        bh
      }, mat);
      group.add(mesh);
      swayLocks.push(mesh);
    }
  }
}

function buildSweptBaseLocks(THREE, group, mat, targetPos, count, bw, bh) {
  for (let i = 0; i < count; i++) {
    const u = i / (count - 1);
    const ang = lerp(1.05, Math.PI * 2 - 1.05, u);
    const normAngle = ang > Math.PI ? ang - Math.PI * 2 : ang;
    const startPhi = hairlinePhi(normAngle, "ponytail") - 0.18;
    const p0 = headSurface(THREE, normAngle, startPhi, 0.006);
    const p1 = headSurface(THREE, normAngle, lerp(startPhi, 1.25, 0.5), 0.015);
    const mid = p1.clone().lerp(targetPos, 0.55);
    // Keep mid hugging the outer volume shell
    const d = mid.clone().sub(new THREE.Vector3(0, HC_Y, 0));
    const ell = Math.hypot(d.x / (HRX + 0.015), d.y / (HRY + 0.015), d.z / (HRZ + 0.015)) || 1;
    if (ell < 1.0) {
      d.multiplyScalar(1.0 / ell);
      mid.set(d.x, HC_Y + d.y, d.z);
    }
    const mesh = buildChunkLock(THREE, {
      points: [p0, p1, mid, targetPos.clone()],
      width: 0.044,
      thick: 0.012,
      segsL: 16,
      rootScale: 0.75,
      taperPow: 1.0,
      arch: 0.22,
      clearance: false,
      swayAmp: 0,
      uOffset: i * 0.15,
      bw,
      bh
    }, mat);
    group.add(mesh);
  }
}

function buildUpdoStyles(THREE, group, swayLocks, opts, mat, accMats, bw, bh) {
  const style = opts.hairStyle;

  if (style === "ponytail") {
    const tiePos = new THREE.Vector3(0, 0.185, -0.162);
    const tieDir = new THREE.Vector3(0, 0.22, -1).normalize();
    buildSweptBaseLocks(THREE, group, mat, tiePos, 8, bw, bh);
    addFaceFramingLocks(THREE, group, swayLocks, mat, bw, bh, { endY: 0.03, width: 0.034, thick: 0.012, swayAmp: 0.025 });

    buildTailCascade(THREE, group, swayLocks, {
      origin: tiePos,
      dir: tieDir,
      count: 11,
      length: 0.39,
      spread: 0.036,
      waveAmp: 0.016,
      waveFreq: 1.35,
      baseWidth: 0.052,
      baseThick: 0.018,
      swayAmp: 0.058,
      phaseBase: 0.4
    }, mat, bw, bh);

    group.add(buildElastic(THREE, tiePos.clone().addScaledVector(tieDir, 0.008), tieDir, 0.028, 0.0075, accMats.bandMat));
    group.add(buildRibbon(THREE, tiePos.clone().addScaledVector(tieDir, 0.012).add(new THREE.Vector3(0, 0.025, -0.006)), new THREE.Vector3(0, 0.4, -1), 0.95, accMats.ribbonMat));
  } else if (style === "twinTails") {
    addFaceFramingLocks(THREE, group, swayLocks, mat, bw, bh, { endY: 0.02, width: 0.034, thick: 0.012, swayAmp: 0.026 });

    for (const side of [-1, 1]) {
      const tiePos = new THREE.Vector3(side * 0.145, 0.205, -0.062);
      const tieDir = new THREE.Vector3(side * 0.85, 0.22, -0.35).normalize();

      // 4 sleek swept base locks per side
      for (let k = 0; k < 4; k++) {
        const ang = side * lerp(1.15, 2.75, k / 3);
        const startPhi = hairlinePhi(ang, "twinTails") - 0.18;
        const p0 = headSurface(THREE, ang, startPhi, 0.006);
        const p1 = headSurface(THREE, ang, lerp(startPhi, 1.18, 0.5), 0.015);
        const mesh = buildChunkLock(THREE, {
          points: [p0, p1, p1.clone().lerp(tiePos, 0.55), tiePos.clone()],
          width: 0.044,
          thick: 0.012,
          segsL: 14,
          taperPow: 1.0,
          clearance: false,
          swayAmp: 0,
          uOffset: k * 0.2,
          bw,
          bh
        }, mat);
        group.add(mesh);
      }

      buildTailCascade(THREE, group, swayLocks, {
        origin: tiePos,
        dir: tieDir,
        count: 8,
        length: 0.37,
        spread: 0.028,
        waveAmp: 0.018,
        waveFreq: 1.45,
        baseWidth: 0.046,
        baseThick: 0.016,
        swayAmp: 0.062,
        phaseBase: side > 0 ? 0.3 : 2.1
      }, mat, bw, bh);

      group.add(buildElastic(THREE, tiePos.clone().addScaledVector(tieDir, 0.008), tieDir, 0.024, 0.007, accMats.bandMat));
      group.add(buildRibbon(THREE, tiePos.clone().addScaledVector(tieDir, 0.014).add(new THREE.Vector3(0, 0.020, 0.008)), new THREE.Vector3(side * 0.6, 0.3, 0.7), 0.85, accMats.ribbonMat));
    }
  } else if (style === "bun") {
    const bunCenter = new THREE.Vector3(0, 0.268, -0.132);
    const bunAxis = new THREE.Vector3(0, 0.78, -0.62).normalize();
    const tieBase = new THREE.Vector3(0, 0.232, -0.108);

    buildSweptBaseLocks(THREE, group, mat, tieBase, 10, bw, bh);
    addFaceFramingLocks(THREE, group, swayLocks, mat, bw, bh, { endY: 0.03, width: 0.034, thick: 0.012, swayAmp: 0.024 });

    // Solid sculpted bun core so no gaps show
    const coreGeo = new THREE.SphereGeometry(0.064, 36, 24);
    const corePos = coreGeo.attributes.position;
    const coreUv = coreGeo.attributes.uv;
    for (let i = 0; i < corePos.count; i++) {
      coreUv.setY(i, 1.0 - lerp(0.18, 0.56, 1.0 - coreUv.getY(i)));
    }
    const core = new THREE.Mesh(coreGeo, mat);
    core.position.copy(bunCenter);
    core.scale.set(1.08, 0.88, 1.04);
    core.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bunAxis);
    core.userData.slot = "hair";
    group.add(core);

    // 7 coiled overlapping sculptural chunk bands wrapped around the bun
    const right = new THREE.Vector3(1, 0, 0);
    const fwd = new THREE.Vector3().crossVectors(bunAxis, right).normalize();
    for (let k = 0; k < 7; k++) {
      const startA = (k / 7) * Math.PI * 2;
      const pts = [];
      const steps = 8;
      for (let s = 0; s <= steps; s++) {
        const f = s / steps;
        const a = startA + f * Math.PI * 1.45;
        const h = lerp(-0.036, 0.034, f) + (k % 2 - 0.5) * 0.010;
        const rad = 0.068 * Math.sqrt(Math.max(0.18, 1.0 - Math.pow(h / 0.058, 2)));
        const p = bunCenter.clone()
          .addScaledVector(bunAxis, h)
          .addScaledVector(right, Math.cos(a) * rad * 1.06)
          .addScaledVector(fwd, Math.sin(a) * rad * 1.02);
        pts.push(p);
      }
      const band = buildChunkLock(THREE, {
        points: pts,
        width: 0.044,
        thick: 0.017,
        segsL: 20,
        rootScale: 0.72,
        taperPow: 1.1,
        arch: 0.25,
        outHint: bunAxis,
        outHintWeight: 0.25,
        uvMode: "bun",
        clearance: false,
        swayAmp: 0,
        uOffset: k * 0.18,
        bw,
        bh
      }, mat);
      group.add(band);
    }

    // Small wrap elastic + two tiny decorative bun pins
    group.add(buildElastic(THREE, tieBase.clone().addScaledVector(bunAxis, 0.016), bunAxis, 0.046, 0.007, accMats.bandMat));
    for (const s of [-1, 1]) {
      const pinGroup = new THREE.Group();
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0012, 0.145, 32), accMats.ribbonMat);
      stick.userData.slot = "hairAccessory";
      pinGroup.add(stick);
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 32, 20), accMats.pearlMat);
      bead.position.y = 0.072;
      bead.userData.slot = "hairAccessory";
      pinGroup.add(bead);
      pinGroup.position.copy(bunCenter).add(new THREE.Vector3(s * 0.012, 0.008, -0.006));
      pinGroup.rotation.set(0.35, 0, -s * 0.62);
      group.add(pinGroup);
    }
  }
}

export function buildHair(THREE, opts = {}, kit) {
  const style = opts.hairStyle || "longStraight";
  const bw = clamp(opts.bodyWidth !== undefined ? opts.bodyWidth : 1.0, 0.8, 1.3);
  const bh = clamp(opts.bodyHeight !== undefined ? opts.bodyHeight : 1.0, 0.9, 1.1);

  const group = new THREE.Group();
  group.name = "hair";
  const swayLocks = [];
  group.userData.swayLocks = swayLocks;

  const hairMat = createHairMaterial(THREE, opts, kit);
  const accMats = createAccessoryMaterials(THREE, opts);

  // 1. Full matte hair volume shell (guarantees zero visible scalp)
  const volumeShell = buildVolumeShell(THREE, opts, kit, hairMat);
  group.add(volumeShell);

  // 2. Style-specific chunk locks & accessories
  if (style !== "buzz") {
    if (style === "ponytail" || style === "twinTails" || style === "bun") {
      buildUpdoStyles(THREE, group, swayLocks, opts, hairMat, accMats, bw, bh);
    } else {
      buildBackCrownLocks(THREE, group, swayLocks, style, hairMat, bw, bh);
    }
    // 3. Fringe locks
    addFringe(THREE, group, swayLocks, opts, hairMat, bw, bh);
  }

  return group;
}

export function sway(group, t, amount = 1) {
  if (!group || !group.userData || !group.userData.swayLocks) return;
  const locks = group.userData.swayLocks;
  const a = clamp(amount, 0, 2);

  for (let i = 0; i < locks.length; i++) {
    const mesh = locks[i];
    const s = mesh.userData.sway;
    if (!s || s.amp <= 0) continue;

    const ph = s.phase;
    const sideWave = (Math.sin(t * 1.65 + ph) + 0.35 * Math.sin(t * 2.85 + ph * 1.7)) / 1.35;
    const outWave = 0.5 + 0.5 * Math.sin(t * 1.25 + ph * 0.85);

    const sideA = sideWave * s.amp * a;
    const outA = outWave * s.amp * 0.34 * a;

    const st = Math.sin(s.theta);
    const ct = Math.cos(s.theta);
    const dx = st * outA + ct * sideA;
    const dz = ct * outA - st * sideA;

    mesh.rotation.z = dx;
    mesh.rotation.x = -dz;
  }
}
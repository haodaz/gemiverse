export const STYLES = [
  "bob",
  "longStraight",
  "longWavy",
  "twinTails",
  "sidePonytail",
  "highPonytail",
  "bun",
  "shortCrop",
  "sidePart",
  "tousled",
  "curtainBangs",
  "pixie",
  "curlyMedium",
];

export const FRINGES = ["blunt", "sideSwept", "curtain", "none"];

const HC_Y = 0.165;
const HR_X = 0.18;
const HR_Y = 0.165;
const HR_Z = 0.17;

const EAR_X = 0.182;
const EAR_Y = 0.125;
const EAR_Z = -0.008;
const EAR_RX = 0.036;
const EAR_RY = 0.036;
const EAR_RZ = 0.028;

const NECK_Z = -0.005;
const NECK_R = 0.055;

const SH_X = 0.105;
const SH_Y = -0.07;
const SH_Z = 0.0;
const SH_R = 0.047;

const SEG_U = 20;
const SEG_V = 28;
const PI = Math.PI;

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

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hairlineY(az) {
  const a = Math.abs(az);
  if (a < 0.72) {
    return lerp(0.242, 0.218, smoothstep(0.0, 0.72, a));
  }
  if (a < 1.25) {
    return lerp(0.218, 0.172, smoothstep(0.72, 1.25, a));
  }
  if (a < 1.72) {
    const earArch = Math.sin(((a - 1.25) / 0.47) * PI);
    return lerp(0.172, 0.152, (a - 1.25) / 0.47) + earArch * 0.012;
  }
  if (a < 2.25) {
    return lerp(0.152, 0.075, smoothstep(1.72, 2.25, a));
  }
  return lerp(0.075, 0.056, smoothstep(2.25, PI, a));
}

function skullPoint(THREE, az, el, scale) {
  const ce = Math.cos(el);
  const se = Math.sin(el);
  return new THREE.Vector3(
    Math.sin(az) * ce * HR_X * scale,
    HC_Y + se * HR_Y * scale,
    Math.cos(az) * ce * HR_Z * scale
  );
}

function skullSurfaceAtXZ(THREE, x, z, scale) {
  const rx = HR_X * scale;
  const ry = HR_Y * scale;
  const rz = HR_Z * scale;
  const q = (x * x) / (rx * rx) + (z * z) / (rz * rz);
  const sy = q < 0.98 ? Math.sqrt(1 - q) : 0.14;
  return new THREE.Vector3(x, HC_Y + sy * ry, z);
}

// 18:50: with the larger head, strands pushed out around the ears read as two lumps. opts.coverEars lets the hair fall over the ears instead.
let COVER_EARS = false;
function pushColliders(p, headScale, avoidEars) {
  const rx = HR_X * headScale;
  const ry = HR_Y * headScale;
  const rz = HR_Z * headScale;
  const dx = p.x / rx;
  const dy = (p.y - HC_Y) / ry;
  const dz = p.z / rz;
  const hd = Math.hypot(dx, dy, dz);
  if (hd < 1.0 && hd > 1e-6) {
    const inv = 1.0 / hd;
    p.x = dx * inv * rx;
    p.y = HC_Y + dy * inv * ry;
    p.z = dz * inv * rz;
  }

  if (avoidEars && !COVER_EARS) {
    for (let sx = -1; sx <= 1; sx += 2) {
      const ex = (p.x - sx * EAR_X) / EAR_RX;
      const ey = (p.y - EAR_Y) / EAR_RY;
      const ez = (p.z - EAR_Z) / EAR_RZ;
      const ed = Math.hypot(ex, ey, ez);
      if (ed < 1.0 && ed > 1e-6) {
        const inv = 1.0 / ed;
        p.x = sx * EAR_X + ex * inv * EAR_RX;
        p.y = EAR_Y + ey * inv * EAR_RY;
        p.z = EAR_Z + ez * inv * EAR_RZ;
      }
    }
  }

  if (p.y < 0.065 && p.y > -0.1) {
    const nx = p.x;
    const nz = p.z - NECK_Z;
    const nr = Math.hypot(nx, nz);
    if (nr < NECK_R) {
      if (nr < 1e-5) {
        p.z = NECK_Z - NECK_R;
      } else {
        const inv = NECK_R / nr;
        p.x = nx * inv;
        p.z = NECK_Z + nz * inv;
      }
    }
  }

  const cx = clamp(p.x, -SH_X, SH_X);
  const vx = p.x - cx;
  const vy = p.y - SH_Y;
  const vz = p.z - SH_Z;
  const sd = Math.hypot(vx, vy, vz);
  if (sd < SH_R) {
    if (sd < 1e-5) {
      p.z = SH_Z - SH_R;
    } else {
      const inv = SH_R / sd;
      p.x = cx + vx * inv;
      p.y = SH_Y + vy * inv;
      p.z = SH_Z + vz * inv;
    }
  }
}

function makeGrooveBumpTexture(THREE, kit) {
  if (!kit || typeof kit.canvasTexture !== "function") return null;
  const tex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = "#828282";
    ctx.fillRect(0, 0, w, h);

    const rng = makeRng(90210);
    const count = 12;
    const centers = [];
    for (let i = 0; i < count; i++) {
      const jitter = (rng() - 0.5) * 0.24;
      centers.push(((i + 0.5 + jitter) / count) * w);
    }

    for (let i = 0; i < count; i++) {
      const cx = centers[i];
      const sw = (w / count) * (0.78 + rng() * 0.34);
      const grad = ctx.createLinearGradient(cx - sw * 0.55, 0, cx + sw * 0.55, 0);
      const peak = Math.round(155 + rng() * 34);
      const edge = Math.round(52 + rng() * 26);
      grad.addColorStop(0.0, `rgb(${edge},${edge},${edge})`);
      grad.addColorStop(0.28, `rgb(${peak - 18},${peak - 18},${peak - 18})`);
      grad.addColorStop(0.5, `rgb(${peak},${peak},${peak})`);
      grad.addColorStop(0.72, `rgb(${peak - 18},${peak - 18},${peak - 18})`);
      grad.addColorStop(1.0, `rgb(${edge},${edge},${edge})`);
      ctx.fillStyle = grad;
      ctx.fillRect(cx - sw * 0.55, 0, sw * 1.1, h);

      ctx.strokeStyle = "rgba(42,42,42,0.45)";
      ctx.lineWidth = 1.6 + rng() * 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - sw * 0.5, 0);
      ctx.lineTo(cx - sw * 0.5, h);
      ctx.stroke();

      ctx.strokeStyle = "rgba(210,210,210,0.18)";
      ctx.lineWidth = 1.0;
      const subX = cx + (rng() - 0.5) * sw * 0.3;
      ctx.beginPath();
      ctx.moveTo(subX, 0);
      ctx.lineTo(subX, h);
      ctx.stroke();
    }

    const rootFade = ctx.createLinearGradient(0, 0, 0, h * 0.08);
    rootFade.addColorStop(0, "rgba(130,130,130,0.85)");
    rootFade.addColorStop(1, "rgba(130,130,130,0)");
    ctx.fillStyle = rootFade;
    ctx.fillRect(0, 0, w, h * 0.08);
  });

  if (tex) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 4;
  }
  return tex;
}

function buildSkullCap(THREE, mat) {
  const segAz = 44;
  const segEl = 16;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let j = 0; j <= segEl; j++) {
    const v = j / segEl;
    for (let i = 0; i <= segAz; i++) {
      const u = i / segAz;
      const az = (u * 2 - 1) * PI;
      const minY = hairlineY(az);
      const minEl = Math.asin(clamp((minY - HC_Y) / (HR_Y * 1.02), -0.95, 0.95));
      const el = lerp(PI * 0.498, minEl, v);
      const p = skullPoint(THREE, az, el, 1.02);
      positions.push(p.x, p.y, p.z);
      uvs.push(u * 4, v);
    }
  }

  const stride = segAz + 1;
  for (let j = 0; j < segEl; j++) {
    for (let i = 0; i < segAz; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = a + stride + 1;
      const d = a + stride;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

function makeGrooveProfile(width, rng) {
  const nRidges = clamp(Math.round(7 + width * 32), 8, 12);
  const ridges = [];
  for (let k = 0; k < nRidges; k++) {
    const base = (k + 0.5) / nRidges;
    const jitter = (rng() - 0.5) * (0.28 / nRidges);
    ridges.push({
      c: clamp(base + jitter, 0.04, 0.96),
      w: (0.38 + rng() * 0.14) / nRidges,
      h: 0.0015 + rng() * 0.0015,
    });
  }
  const macroPhase = rng() * PI * 2;
  return (t) => {
    let val = 0;
    for (let k = 0; k < ridges.length; k++) {
      const r = ridges[k];
      const d = (t - r.c) / r.w;
      if (Math.abs(d) < 2.2) {
        val += r.h * Math.exp(-d * d * 1.35);
      }
    }
    val += 0.0007 * Math.sin(t * PI * 5.0 + macroPhase);
    return val;
  };
}

function makeGuideCurve(THREE, cfg) {
  const {
    rootX = 0,
    rootZ = 0,
    az,
    azEnd = az,
    dropEl = 0.05,
    endY = 0.02,
    layer = 0,
    puff = 0.014,
    flare = 0.0,
    curlIn = 0.0,
    backPush = 0.0,
    waveAmp = 0.0,
    waveFreq = 1.8,
    wavePhase = 0.0,
    waveLat = 0.0,
    avoidEars = true,
    skullFollow = false,
  } = cfg;

  const baseScale = 1.03 + layer * 0.009;
  const rootPos = skullSurfaceAtXZ(THREE, rootX, rootZ, 1.022 + layer * 0.005);

  const rdx = rootPos.x / (HR_X * 1.03);
  const rdy = (rootPos.y - HC_Y) / (HR_Y * 1.03);
  const rdz = rootPos.z / (HR_Z * 1.03);
  const dirRoot = new THREE.Vector3(rdx, rdy, rdz).normalize();

  const dropScale = baseScale + puff * 0.35;
  const dropPos = skullPoint(THREE, az, dropEl, dropScale);
  const ddx = dropPos.x / (HR_X * dropScale);
  const ddy = (dropPos.y - HC_Y) / (HR_Y * dropScale);
  const ddz = dropPos.z / (HR_Z * dropScale);
  const dirDrop = new THREE.Vector3(ddx, ddy, ddz).normalize();

  const dropY = dropPos.y;
  const hangLen = Math.max(0.0, dropY - endY);
  const skullArcLen = dirRoot.angleTo(dirDrop) * 0.18;
  const totalLen = Math.max(0.05, skullArcLen + hangLen);
  const tDrop = skullFollow ? 1.0 : clamp(skullArcLen / totalLen, 0.22, 0.92);

  const pts = [];
  for (let j = 0; j <= SEG_V; j++) {
    const v = j / SEG_V;
    let p;
    if (v <= tDrop || skullFollow) {
      const s = v / tDrop;
      const curAz = lerp(az, azEnd, s * 0.55);
      const lift = Math.sin(clamp(s, 0, 1) * PI) * puff;
      const rootBlend = smoothstep(0.0, 0.14, s);
      const sc = lerp(1.022 + layer * 0.004, baseScale + lift, rootBlend);

      const dir = new THREE.Vector3().lerpVectors(dirRoot, dirDrop, s).normalize();
      if (Math.abs(azEnd - az) > 1e-4) {
        const horiz = Math.hypot(dir.x, dir.z);
        if (horiz > 0.05) {
          const dAz = (curAz - az) * smoothstep(0.15, 1.0, s);
          const ca = Math.cos(dAz);
          const sa = Math.sin(dAz);
          const nx = dir.x * ca + dir.z * sa;
          const nz = -dir.x * sa + dir.z * ca;
          dir.x = nx;
          dir.z = nz;
        }
      }
      p = new THREE.Vector3(
        dir.x * HR_X * sc,
        HC_Y + dir.y * HR_Y * sc,
        dir.z * HR_Z * sc
      );
      if (skullFollow && s > 0.6) {
        const f = smoothstep(0.6, 1.0, s);
        const radX = Math.sin(curAz);
        const radZ = Math.cos(curAz);
        p.x += radX * flare * f;
        p.z += radZ * flare * f;
      }
    } else {
      const s = (v - tDrop) / (1 - tDrop);
      const curAz = lerp(az, azEnd, 0.55 + 0.45 * s);
      const radX = Math.sin(curAz);
      const radZ = Math.cos(curAz);
      const tanX = Math.cos(curAz);
      const tanZ = -Math.sin(curAz);

      const y = lerp(dropY, endY, s);
      const baseR = Math.hypot(dropPos.x, dropPos.z);
      const waveEnv = smoothstep(0.05, 0.35, s);
      const waveR = waveAmp * waveEnv * Math.sin(s * waveFreq * PI * 2 + wavePhase);
      const waveT = waveLat * waveEnv * Math.cos(s * waveFreq * PI * 2 + wavePhase);
      const tipCurl = -curlIn * Math.pow(s, 2.4);
      const outFlare = flare * Math.pow(s, 1.5);
      const r = baseR + outFlare + tipCurl + waveR;

      p = new THREE.Vector3(
        radX * r + tanX * waveT,
        y,
        radZ * r + tanZ * waveT - backPush * smoothstep(0.0, 0.6, s)
      );
    }

    if (j > 0) {
      pushColliders(p, 1.028 + layer * 0.005, avoidEars);
    }
    pts.push(p);
  }

  for (let pass = 0; pass < 2; pass++) {
    for (let j = 1; j < SEG_V; j++) {
      pts[j].x = pts[j - 1].x * 0.22 + pts[j].x * 0.56 + pts[j + 1].x * 0.22;
      pts[j].y = pts[j - 1].y * 0.15 + pts[j].y * 0.70 + pts[j + 1].y * 0.15;
      pts[j].z = pts[j - 1].z * 0.22 + pts[j].z * 0.56 + pts[j + 1].z * 0.22;
      pushColliders(pts[j], 1.026 + layer * 0.004, avoidEars);
    }
  }

  return pts;
}

function buildPanel(THREE, cfg, mat, rng, swayItems) {
  const pts = cfg.points || makeGuideCurve(THREE, cfg);
  const width = cfg.width ?? 0.1;
  const thick = cfg.thick ?? 0.015;
  const blunt = cfg.blunt ?? false;
  const tipWidth = cfg.tipWidth ?? (blunt ? 0.94 : 0.12);
  const rootWidth = cfg.rootWidth ?? 0.45;
  const arcCurv = cfg.arcCurv ?? 2.1;
  const tileTilt = cfg.tileTilt ?? 0.0;
  const avoidEars = cfg.avoidEars ?? true;
  const grooveFn = makeGrooveProfile(width, rng);

  const ringCount = SEG_U * 2;
  const positions = [];
  const uvs = [];
  const indices = [];

  const outerTip = [];
  const innerTip = [];
  const outerRoot = [];
  const innerRoot = [];

  const T = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const prevB = new THREE.Vector3();
  const pOut = new THREE.Vector3();
  const pIn = new THREE.Vector3();
  const origIn = new THREE.Vector3();

  let minY = Infinity;

  for (let j = 0; j <= SEG_V; j++) {
    const v = j / SEG_V;
    const p = pts[j];
    if (p.y < minY) minY = p.y;

    if (j === 0) {
      T.subVectors(pts[1], pts[0]).normalize();
    } else if (j === SEG_V) {
      T.subVectors(pts[SEG_V], pts[SEG_V - 1]).normalize();
    } else {
      T.subVectors(pts[j + 1], pts[j - 1]).normalize();
    }

    const skullN = new THREE.Vector3(
      p.x / (HR_X * HR_X),
      (p.y - HC_Y) / (HR_Y * HR_Y),
      p.z / (HR_Z * HR_Z)
    ).normalize();

    const horizLen = Math.hypot(p.x, p.z);
    const radialN =
      horizLen > 0.015
        ? new THREE.Vector3(p.x / horizLen, 0, p.z / horizLen)
        : skullN.clone();

    const hangBlend = smoothstep(0.18, 0.02, p.y);
    N.copy(skullN).lerp(radialN, hangBlend).normalize();
    N.addScaledVector(T, -N.dot(T));
    if (N.lengthSq() < 1e-6) {
      N.set(0, 0, 1);
    } else {
      N.normalize();
    }

    B.crossVectors(N, T).normalize();
    if (j > 0 && B.dot(prevB) < 0) {
      B.negate();
      N.crossVectors(T, B).normalize();
    }
    prevB.copy(B);

    let wf;
    if (v < 0.16) {
      wf = lerp(rootWidth, 1.0, smoothstep(0.0, 0.16, v));
    } else if (blunt) {
      wf = lerp(1.0, tipWidth, smoothstep(0.6, 1.0, v));
    } else {
      wf = lerp(1.0, tipWidth, Math.pow(smoothstep(0.28, 1.0, v), 1.35));
    }

    const halfW = width * 0.5 * wf;
    // 19:05: a blunt cut kept its full thickness to the tip, so the cut face read as a hard dark line under the fringe. cfg.tipThin thins the edge while the outline stays straight.
    const localThick = thick * (blunt ? lerp(0.85, cfg.tipThin ?? 0.92, Math.pow(v, 2.2)) : lerp(0.9, 0.25, Math.pow(v, 1.8)));
    const localArc = arcCurv * lerp(1.0, 0.65, hangBlend);
    const rootFade = smoothstep(0.0, 0.08, v);
    const tipFade = blunt ? 1.0 : clamp(wf * 1.4, 0.1, 1.0);

    const ringOut = new Array(SEG_U + 1);
    const ringIn = new Array(SEG_U + 1);

    for (let i = 0; i <= SEG_U; i++) {
      const t = i / SEG_U;
      const u = t * 2 - 1;
      const lat = u * halfW;
      const arcDrop = -localArc * lat * lat;
      const tilt = tileTilt * lat;
      const edgeShape = Math.pow(Math.max(0, 1 - u * u), 0.42);
      const edgeFade = smoothstep(0.0, 0.07, t) * smoothstep(1.0, 0.93, t);
      const gDisp = grooveFn(t) * edgeFade * rootFade * tipFade;

      const hEdge = localThick * 0.08;
      const nOut = arcDrop + tilt + hEdge + localThick * 0.92 * edgeShape + gDisp;
      const nIn = arcDrop + tilt + hEdge - localThick * 0.16 * edgeShape;

      pIn.copy(p).addScaledVector(B, lat).addScaledVector(N, nIn);
      pOut.copy(p).addScaledVector(B, lat).addScaledVector(N, nOut);

      if (j > 0) {
        origIn.copy(pIn);
        pushColliders(pIn, 1.021, avoidEars);
        pOut.x += pIn.x - origIn.x;
        pOut.y += pIn.y - origIn.y;
        pOut.z += pIn.z - origIn.z;
      }

      ringOut[i] = pOut.clone();
      ringIn[i] = pIn.clone();
    }

    for (let i = 0; i < ringCount; i++) {
      let pt;
      let uUv;
      if (i <= SEG_U) {
        pt = ringOut[i];
        uUv = i / SEG_U;
      } else {
        const k = ringCount - i;
        pt = ringIn[k];
        uUv = k / SEG_U;
      }
      positions.push(pt.x, pt.y, pt.z);
      uvs.push(uUv, v);
    }

    if (j === 0) {
      for (let i = 0; i <= SEG_U; i++) {
        outerRoot.push(ringOut[i]);
        innerRoot.push(ringIn[i]);
      }
    }
    if (j === SEG_V) {
      for (let i = 0; i <= SEG_U; i++) {
        outerTip.push(ringOut[i]);
        innerTip.push(ringIn[i]);
      }
    }
  }

  for (let j = 0; j < SEG_V; j++) {
    const r0 = j * ringCount;
    const r1 = (j + 1) * ringCount;
    for (let i = 0; i < ringCount; i++) {
      const ni = (i + 1) % ringCount;
      const a = r0 + i;
      const b = r0 + ni;
      const c = r1 + ni;
      const d = r1 + i;
      indices.push(a, d, b, b, d, c);
    }
  }

  const addCap = (outerArr, innerArr, flip) => {
    const base = positions.length / 3;
    for (let i = 0; i <= SEG_U; i++) {
      const po = outerArr[i];
      const pi = innerArr[i];
      positions.push(po.x, po.y, po.z);
      uvs.push(i / SEG_U, flip ? 0 : 1);
      positions.push(pi.x, pi.y, pi.z);
      uvs.push(i / SEG_U, flip ? 0 : 1);
    }
    for (let i = 0; i < SEG_U; i++) {
      const o0 = base + i * 2;
      const i0 = o0 + 1;
      const o1 = o0 + 2;
      const i1 = o0 + 3;
      if (flip) {
        indices.push(o0, o1, i0, o1, i1, i0);
      } else {
        indices.push(o0, i0, o1, o1, i0, i1);
      }
    }
  };

  addCap(outerRoot, innerRoot, true);
  addCap(outerTip, innerTip, false);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, mat);

  if (!cfg.noSway && minY < 0.125) {
    const rootPos = pts[0];
    geo.translate(-rootPos.x, -rootPos.y, -rootPos.z);
    const pivot = new THREE.Group();
    pivot.position.copy(rootPos);
    pivot.add(mesh);

    const endP = pts[SEG_V];
    const deg = PI / 180;
    const lenFactor = clamp((0.125 - minY) / 0.35, 0.25, 1.0);
    const amp = lerp(1.0, 2.8, lenFactor) * deg;
    swayItems.push({
      pivot,
      phase: rng() * PI * 2,
      freq: 1.45 + rng() * 0.55,
      ampX: amp * (endP.z < -0.04 ? 0.85 : 0.45),
      ampZ: amp * 0.9,
      sideSign: Math.abs(endP.x) > 0.05 ? Math.sign(endP.x) : 0,
      isBack: endP.z < -0.05,
      isTail: false,
    });
    return pivot;
  }

  return mesh;
}

function buildTailClub(THREE, cfg, mat, bandMat, rng, swayItems) {
  const {
    origin,
    curvePts,
    maxR = 0.045,
    flatX = 1.0,
    flatZ = 0.86,
    bandRadius = 0.022,
    bandTube = 0.0085,
    bandOrient = [0, 0, 0],
    swayScale = 1.0,
  } = cfg;

  const pivot = new THREE.Group();
  pivot.position.copy(origin);

  const curve = new THREE.CatmullRomCurve3(curvePts);
  const segR = 24;
  const segL = SEG_V;
  const grooveFn = makeGrooveProfile(0.13, rng);

  const positions = [];
  const uvs = [];
  const indices = [];

  const worldPts = [];
  for (let j = 0; j <= segL; j++) {
    const v = j / segL;
    const lp = curve.getPoint(v);
    const wp = lp.clone().add(origin);
    if (j > 2) {
      pushColliders(wp, 1.03, true);
    }
    worldPts.push(wp.sub(origin));
  }

  const T = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const ref = new THREE.Vector3(0, 0, 1);
  const vtx = new THREE.Vector3();

  for (let j = 0; j <= segL; j++) {
    const v = j / segL;
    const p = worldPts[j];
    if (j === 0) T.subVectors(worldPts[1], worldPts[0]).normalize();
    else if (j === segL) T.subVectors(worldPts[segL], worldPts[segL - 1]).normalize();
    else T.subVectors(worldPts[j + 1], worldPts[j - 1]).normalize();

    if (Math.abs(T.dot(ref)) > 0.92) ref.set(1, 0, 0);
    N.crossVectors(T, ref).normalize();
    B.crossVectors(T, N).normalize();

    let rf;
    if (v < 0.28) {
      rf = lerp(0.38, 1.0, smoothstep(0.0, 0.28, v));
    } else {
      rf = lerp(1.0, 0.03, Math.pow(smoothstep(0.28, 1.0, v), 1.35));
    }
    const rBase = maxR * rf;
    const gScale = smoothstep(0.0, 0.1, v) * clamp(rf * 1.4, 0.08, 1.0);

    for (let i = 0; i <= segR; i++) {
      const u = i / segR;
      const ang = u * PI * 2;
      const g = grooveFn((u * 1.15) % 1.0) * 1.15 * gScale;
      const rx = (rBase + g) * flatX;
      const rz = (rBase + g) * flatZ;
      vtx
        .copy(p)
        .addScaledVector(N, Math.cos(ang) * rx)
        .addScaledVector(B, Math.sin(ang) * rz);
      positions.push(vtx.x, vtx.y, vtx.z);
      uvs.push(u * 1.5, v);
    }
  }

  const stride = segR + 1;
  for (let j = 0; j < segL; j++) {
    for (let i = 0; i < segR; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = a + stride + 1;
      const d = a + stride;
      indices.push(a, d, b, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  pivot.add(new THREE.Mesh(geo, mat));

  const bandGeo = new THREE.TorusGeometry(bandRadius, bandTube, 12, 24);
  const band = new THREE.Mesh(bandGeo, bandMat);
  band.rotation.set(bandOrient[0], bandOrient[1], bandOrient[2]);
  pivot.add(band);

  const deg = PI / 180;
  swayItems.push({
    pivot,
    phase: rng() * PI * 2,
    freq: 1.7 + rng() * 0.45,
    ampX: 4.0 * deg * swayScale,
    ampZ: 4.8 * deg * swayScale,
    sideSign: Math.abs(origin.x) > 0.04 ? Math.sign(origin.x) : 0,
    isBack: origin.z < -0.05,
    isTail: true,
  });

  return pivot;
}

function buildBun(THREE, origin, mat, bandMat, rng) {
  const grp = new THREE.Group();
  grp.position.copy(origin);
  grp.lookAt(origin.x * 2, origin.y + 0.12, origin.z * 2 - 0.14);

  const bandGeo = new THREE.TorusGeometry(0.044, 0.011, 12, 28);
  const band = new THREE.Mesh(bandGeo, bandMat);
  band.position.z = 0.004;
  grp.add(band);

  const segU = 28;
  const segV = 18;
  const grooveFn = makeGrooveProfile(0.14, rng);
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let j = 0; j <= segV; j++) {
    const v = j / segV;
    const phi = v * PI;
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    for (let i = 0; i <= segU; i++) {
      const u = i / segU;
      const theta = u * PI * 2 + v * 0.85;
      const g = grooveFn((u * 2.0) % 1.0) * 1.1 * Math.sin(phi);
      const r = 0.068 + g;
      const x = Math.cos(theta) * sp * r;
      const y = Math.sin(theta) * sp * r;
      const z = 0.046 + cp * 0.054;
      positions.push(x, y, z);
      uvs.push(u * 2.0, v);
    }
  }

  const stride = segU + 1;
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = a + stride + 1;
      const d = a + stride;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  grp.add(new THREE.Mesh(geo, mat));

  return grp;
}

function addBackAndSides(THREE, group, mat, rng, swayItems, spec) {
  const {
    partX = 0.0,
    partZFront = 0.08,
    partZBack = -0.065,
    backEndY = 0.015,
    sideEndY = 0.02,
    earCut = false,
    tipThin,
    blunt = true,
    tipWidth = 0.92,
    width = 0.115,
    thick = 0.016,
    puff = 0.015,
    flare = 0.0,
    curlIn = 0.0,
    waveAmp = 0.0,
    waveFreq = 1.8,
    waveLat = 0.0,
    backPush = 0.0,
    addFrontLocks = true,
    frontLockEndY = 0.03,
    frontLockBlunt = blunt,
    frontLockWidth = 0.072,
    crownTier = true,
    skullFollow = false,
  } = spec;

  const backAzs = [
    -2.88, -2.52, -2.14, -1.78, -1.36, 1.36, 1.78, 2.14, 2.52, 2.88, PI,
  ];

  backAzs.forEach((az, idx) => {
    const absAz = Math.abs(az);
    const isEarZone = absAz > 1.25 && absAz < 1.65;
    const isBack = absAz > 2.0;

    let endY = isBack ? backEndY : sideEndY;
    let azEnd = az;
    if (isEarZone) {
      if (earCut) {
        endY = Math.max(endY, 0.165);
      } else {
        azEnd = Math.sign(az) * 1.84;
      }
    }

    const frac = clamp((absAz - 1.1) / (PI - 1.1), 0, 1);
    const rootZ = lerp(partZFront * 0.7, partZBack, frac);
    const stagger = (idx % 2) * 0.45 + (isBack ? 0.0 : 0.35);

    const panel = buildPanel(
      THREE,
      {
        rootX: partX,
        rootZ,
        az,
        azEnd,
        dropEl: earCut && isEarZone ? 0.12 : isBack ? 0.04 : 0.08,
        endY,
        layer: stagger,
        puff: puff + (isBack ? 0.0 : 0.003),
        width: width * (isBack ? 1.06 : 0.95),
        thick,
        blunt: earCut && isEarZone ? false : blunt,
        tipThin,
        tipWidth: earCut && isEarZone ? 0.35 : tipWidth,
        flare,
        curlIn: isBack ? curlIn : curlIn * 0.7,
        backPush: isBack ? backPush : backPush * 0.4,
        waveAmp,
        waveFreq,
        waveLat,
        wavePhase: idx * 0.9 + rng() * 0.5,
        tileTilt: (idx % 2 === 0 ? 1 : -1) * 0.035,
        avoidEars: true,
        skullFollow,
      },
      mat,
      rng,
      swayItems
    );
    group.add(panel);
  });

  if (crownTier) {
    const crownAzs = [-2.55, -1.92, -1.28, 1.28, 1.92, 2.55];
    crownAzs.forEach((az, idx) => {
      const absAz = Math.abs(az);
      const isEar = absAz < 1.6;
      const rootZ = lerp(partZFront * 0.8, partZBack * 0.85, (absAz - 1.1) / 1.8);
      const azEnd = isEar && !earCut ? Math.sign(az) * 1.78 : az;
      const endY = earCut
        ? isEar
          ? 0.172
          : Math.max(backEndY + 0.02, 0.085)
        : lerp(sideEndY, backEndY, 0.5) + (blunt ? 0.008 : 0.025);

      const panel = buildPanel(
        THREE,
        {
          rootX: partX,
          rootZ,
          az,
          azEnd,
          dropEl: 0.1,
          endY,
          layer: 1.25 + (idx % 2) * 0.35,
          puff: puff + 0.008,
          width: width * 0.92,
          thick: thick * 0.92,
          blunt: earCut ? false : blunt,
          tipThin,
          tipWidth: earCut ? 0.25 : tipWidth,
          flare: flare * 1.05,
          curlIn,
          backPush: absAz > 1.8 ? backPush : 0,
          waveAmp: waveAmp * 1.05,
          waveFreq,
          waveLat,
          wavePhase: idx * 1.1 + 0.4,
          tileTilt: Math.sign(az) * 0.03,
          avoidEars: true,
          skullFollow,
        },
        mat,
        rng,
        swayItems
      );
      group.add(panel);
    });
  }

  if (addFrontLocks) {
    for (let sx = -1; sx <= 1; sx += 2) {
      const lock = buildPanel(
        THREE,
        {
          rootX: partX,
          rootZ: partZFront * 0.82,
          az: sx * 1.04,
          azEnd: sx * 1.08,
          dropEl: 0.14,
          endY: frontLockEndY,
          layer: 1.7,
          puff: puff * 0.85,
          width: frontLockWidth,
          thick: thick * 0.85,
          blunt: frontLockBlunt,
          tipThin,
          tipWidth: frontLockBlunt ? 0.84 : 0.14,
          curlIn: curlIn + 0.006,
          waveAmp: waveAmp * 0.55,
          waveFreq,
          wavePhase: sx * 1.2,
          avoidEars: true,
        },
        mat,
        rng,
        swayItems
      );
      group.add(lock);
    }
  }
}

function addSleekCap(THREE, group, mat, rng, swayItems, cfg) {
  const { partX = 0, frontLockEndY = 0.055, frontLockWidth = 0.062 } = cfg;
  const capAzs = [-2.85, -2.4, -1.95, -1.5, -1.12, 1.12, 1.5, 1.95, 2.4, 2.85, PI];
  capAzs.forEach((az, idx) => {
    const absAz = Math.abs(az);
    const isEar = absAz > 1.2 && absAz < 1.7;
    const endY = isEar ? 0.165 : absAz > 1.7 ? 0.058 : 0.16;
    const panel = buildPanel(
      THREE,
      {
        rootX: partX,
        rootZ: lerp(0.06, -0.06, clamp((absAz - 1.0) / 2.1, 0, 1)),
        az,
        azEnd: isEar ? Math.sign(az) * 1.82 : az,
        dropEl: isEar ? 0.15 : -0.35,
        endY,
        layer: 0.25 + (idx % 2) * 0.35,
        puff: 0.009,
        width: 0.115,
        thick: 0.013,
        blunt: false,
        tipWidth: 0.42,
        skullFollow: true,
        avoidEars: true,
        noSway: true,
      },
      mat,
      rng,
      swayItems
    );
    group.add(panel);
  });

  if (frontLockEndY !== null) {
    for (let sx = -1; sx <= 1; sx += 2) {
      const lock = buildPanel(
        THREE,
        {
          rootX: partX,
          rootZ: 0.075,
          az: sx * 1.02,
          azEnd: sx * 1.05,
          dropEl: 0.16,
          endY: frontLockEndY,
          layer: 1.4,
          puff: 0.01,
          width: frontLockWidth,
          thick: 0.013,
          blunt: false,
          tipWidth: 0.1,
          curlIn: 0.01,
          avoidEars: true,
        },
        mat,
        rng,
        swayItems
      );
      group.add(lock);
    }
  }
}

function addFringe(THREE, group, mat, rng, swayItems, fringe, partX, styleOpts = {}) {
  const { pointed = false, extraPuff = 0 } = styleOpts;
  if (fringe === "none") {
    for (let sx = -1; sx <= 1; sx += 2) {
      const side = buildPanel(
        THREE,
        {
          rootX: partX,
          rootZ: 0.075,
          az: sx * 0.72,
          azEnd: sx * 1.15,
          dropEl: 0.26,
          endY: 0.215,
          layer: 1.8,
          puff: 0.01 + extraPuff,
          width: 0.085,
          thick: 0.013,
          blunt: false,
          tipWidth: 0.28,
          skullFollow: true,
          noSway: true,
        },
        mat,
        rng,
        swayItems
      );
      group.add(side);
    }
    return;
  }

  if (fringe === "blunt") {
    const azs = [-0.72, -0.36, 0.0, 0.36, 0.72];
    const order = [0, 4, 1, 3, 2];
    order.forEach((k, step) => {
      const az = azs[k];
      const p = buildPanel(
        THREE,
        {
          rootX: partX * 0.5,
          rootZ: 0.085,
          az,
          azEnd: az * 1.02,
          dropEl: 0.34,
          endY: pointed ? 0.202 : 0.176,   // 19:15: the blunt fringe comes down to the brows, as on the reference
          layer: 2.0 + step * 0.1,
          puff: 0.016 + extraPuff,
          width: pointed ? 0.076 : 0.102,
          thick: 0.015,
          tipThin: 0.22,
          blunt: !pointed,
          tipWidth: pointed ? 0.16 : 0.96,
          rootWidth: 0.55,
          curlIn: 0.004,
          noSway: true,
        },
        mat,
        rng,
        swayItems
      );
      group.add(p);
    });
    return;
  }

  if (fringe === "sideSwept") {
    const dir = partX <= 0 ? 1 : -1;
    const sweepPanels = [
      { az: -dir * 0.45, azEnd: dir * 0.18, endY: 0.204, w: 0.095, tip: 0.22, l: 2.2 },
      { az: -dir * 0.22, azEnd: dir * 0.48, endY: 0.204, w: 0.102, tip: 0.18, l: 2.55 },
      { az: dir * 0.08, azEnd: dir * 0.82, endY: 0.202, w: 0.096, tip: 0.14, l: 2.85 },
      { az: -dir * 0.58, azEnd: -dir * 0.94, endY: 0.202, w: 0.078, tip: 0.16, l: 2.1 },
    ];
    sweepPanels.forEach((sp) => {
      const p = buildPanel(
        THREE,
        {
          rootX: partX,
          rootZ: 0.082,
          az: sp.az,
          azEnd: sp.azEnd,
          dropEl: 0.34,
          endY: sp.endY,
          layer: sp.l,
          puff: 0.017 + extraPuff,
          width: sp.w,
          thick: 0.015,
          blunt: false,
          tipWidth: sp.tip,
          rootWidth: 0.48,
          curlIn: 0.004,
          noSway: true,
        },
        mat,
        rng,
        swayItems
      );
      group.add(p);
    });
    return;
  }

  if (fringe === "curtain") {
    for (let sx = -1; sx <= 1; sx += 2) {
      const inner = buildPanel(
        THREE,
        {
          rootX: 0,
          rootZ: 0.085,
          az: sx * 0.22,
          azEnd: sx * 0.68,
          dropEl: 0.35,
          endY: 0.204,
          layer: 2.45,
          puff: 0.02 + extraPuff,
          width: 0.092,
          thick: 0.015,
          blunt: false,
          tipWidth: 0.18,
          rootWidth: 0.46,
          flare: 0.006,
          noSway: true,
        },
        mat,
        rng,
        swayItems
      );
      group.add(inner);

      const outer = buildPanel(
        THREE,
        {
          rootX: 0,
          rootZ: 0.072,
          az: sx * 0.52,
          azEnd: sx * 0.96,
          dropEl: 0.26,
          endY: 0.185,
          layer: 2.15,
          puff: 0.017 + extraPuff,
          width: 0.088,
          thick: 0.014,
          blunt: false,
          tipWidth: 0.16,
          rootWidth: 0.46,
          flare: 0.008,
          noSway: true,
        },
        mat,
        rng,
        swayItems
      );
      group.add(outer);
    }
  }
}

export function buildHair(THREE, opts = {}, kit) {
  COVER_EARS = !!opts.coverEars;
  const hairStyle = STYLES.includes(opts.hairStyle) ? opts.hairStyle : "bob";
  const fringe = FRINGES.includes(opts.fringe) ? opts.fringe : "blunt";
  const hairColor = opts.hairColor ?? "#2c2828";
  const highlight = opts.highlight ?? "#5e5656";

  const rng = makeRng(hashString(`${hairStyle}:${fringe}`));
  const bumpMap = makeGrooveBumpTexture(THREE, kit);

  const hairMat = new THREE.MeshPhysicalMaterial({
    color: hairColor,
    roughness: 0.62,
    metalness: 0.0,
    sheen: 0.8,
    sheenRoughness: 0.48,
    sheenColor: new THREE.Color(highlight),
    clearcoat: 0.05,
    clearcoatRoughness: 0.45,
    bumpMap: bumpMap || null,
    bumpScale: 0.0045,
  });

  const bandMat = new THREE.MeshPhysicalMaterial({
    color: highlight,
    roughness: 0.36,
    metalness: 0.05,
    clearcoat: 0.15,
  });

  const group = new THREE.Group();
  const swayItems = [];
  group.userData.swayItems = swayItems;
  group.userData.hairStyle = hairStyle;

  group.add(buildSkullCap(THREE, hairMat));

  let partX = 0.0;

  if (hairStyle === "bob") {
    partX = fringe === "sideSwept" ? -0.048 : 0.0;
    addBackAndSides(THREE, group, hairMat, rng, swayItems, {
      partX,
      backEndY: 0.015,
      sideEndY: 0.018,
      blunt: true,
      tipThin: 0.45,
      tipWidth: 0.94,
      width: 0.118,
      thick: 0.016,
      puff: 0.015,
      curlIn: 0.016,
      addFrontLocks: true,
      frontLockEndY: 0.022,
      frontLockBlunt: true,
      frontLockWidth: 0.074,
    });
    addFringe(THREE, group, hairMat, rng, swayItems, fringe, partX);
  } else if (hairStyle === "longStraight") {
    partX = 0.0;
    addBackAndSides(THREE, group, hairMat, rng, swayItems, {
      partX,
      backEndY: -0.25,
      sideEndY: -0.23,
      blunt: true,
      tipWidth: 0.92,
      width: 0.122,
      thick: 0.016,
      puff: 0.015,
      backPush: 0.018,
      addFrontLocks: true,
      frontLockEndY: 0.015,
      frontLockBlunt: true,
      frontLockWidth: 0.072,
    });
    addFringe(THREE, group, hairMat, rng, swayItems, fringe, partX);
  } else if (hairStyle === "longWavy") {
    partX = 0.0;
    addBackAndSides(THREE, group, hairMat, rng, swayItems, {
      partX,
      backEndY: -0.24,
      sideEndY: -0.21,
      blunt: false,
      tipWidth: 0.52,
      width: 0.118,
      thick: 0.016,
      puff: 0.016,
      flare: 0.012,
      backPush: 0.022,
      waveAmp: 0.021,
      waveFreq: 2.1,
      waveLat: 0.014,
      addFrontLocks: true,
      frontLockEndY: -0.02,
      frontLockBlunt: false,
      frontLockWidth: 0.07,
    });
    addFringe(THREE, group, hairMat, rng, swayItems, fringe, partX);
  } else if (hairStyle === "twinTails") {
    partX = 0.0;
    addSleekCap(THREE, group, hairMat, rng, swayItems, {
      partX,
      frontLockEndY: 0.048,
      frontLockWidth: 0.062,
    });
    for (let sx = -1; sx <= 1; sx += 2) {
      const origin = new THREE.Vector3(sx * 0.172, 0.205, -0.055);
      const tail = buildTailClub(
        THREE,
        {
          origin,
          curvePts: [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(sx * 0.055, -0.03, -0.01),
            new THREE.Vector3(sx * 0.072, -0.14, -0.015),
            new THREE.Vector3(sx * 0.045, -0.27, -0.01),
            new THREE.Vector3(sx * 0.02, -0.34, 0.0),
          ],
          maxR: 0.043,
          flatX: 0.92,
          flatZ: 0.98,
          bandRadius: 0.021,
          bandTube: 0.0085,
          bandOrient: [0.1, sx * 0.9, 0.35 * sx],
          swayScale: 1.05,
        },
        hairMat,
        bandMat,
        rng,
        swayItems
      );
      group.add(tail);
    }
    addFringe(THREE, group, hairMat, rng, swayItems, fringe, partX);
  } else if (hairStyle === "sidePonytail") {
    partX = -0.025;
    addSleekCap(THREE, group, hairMat, rng, swayItems, {
      partX,
      frontLockEndY: 0.055,
      frontLockWidth: 0.064,
    });
    const origin = new THREE.Vector3(0.168, 0.195, -0.065);
    const tail = buildTailClub(
      THREE,
      {
        origin,
        curvePts: [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0.065, 0.01, -0.015),
          new THREE.Vector3(0.095, -0.075, -0.025),
          new THREE.Vector3(0.062, -0.175, -0.02),
          new THREE.Vector3(0.005, -0.225, -0.01),
        ],
        maxR: 0.054,
        flatX: 0.95,
        flatZ: 0.88,
        bandRadius: 0.024,
        bandTube: 0.009,
        bandOrient: [0.1, 1.05, 0.25],
        swayScale: 1.1,
      },
      hairMat,
      bandMat,
      rng,
      swayItems
    );
    group.add(tail);
    addFringe(THREE, group, hairMat, rng, swayItems, fringe, partX);
  } else if (hairStyle === "highPonytail") {
    partX = 0.0;
    addSleekCap(THREE, group, hairMat, rng, swayItems, {
      partX,
      frontLockEndY: 0.065,
      frontLockWidth: 0.058,
    });
    const origin = new THREE.Vector3(0, 0.305, -0.105);
    const tail = buildTailClub(
      THREE,
      {
        origin,
        curvePts: [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0.045, -0.065),
          new THREE.Vector3(0, -0.025, -0.135),
          new THREE.Vector3(0, -0.21, -0.145),
          new THREE.Vector3(0, -0.41, -0.12),
        ],
        maxR: 0.056,
        flatX: 1.08,
        flatZ: 0.85,
        bandRadius: 0.026,
        bandTube: 0.0095,
        bandOrient: [1.05, 0, 0],
        swayScale: 1.15,
      },
      hairMat,
      bandMat,
      rng,
      swayItems
    );
    group.add(tail);
    addFringe(THREE, group, hairMat, rng, swayItems, fringe, partX);
  } else if (hairStyle === "bun") {
    partX = 0.0;
    addSleekCap(THREE, group, hairMat, rng, swayItems, {
      partX,
      frontLockEndY: 0.075,
      frontLockWidth: 0.055,
    });
    group.add(
      buildBun(THREE, new THREE.Vector3(0, 0.295, -0.115), hairMat, bandMat, rng)
    );
    addFringe(THREE, group, hairMat, rng, swayItems, fringe, partX);
  } else if (hairStyle === "shortCrop") {
    partX = -0.03;
    addBackAndSides(THREE, group, hairMat, rng, swayItems, {
      partX,
      backEndY: 0.065,
      sideEndY: 0.165,
      earCut: true,
      blunt: false,
      tipWidth: 0.52,
      width: 0.108,
      thick: 0.014,
      puff: 0.011,
      addFrontLocks: false,
      crownTier: true,
      skullFollow: true,
    });
    for (let sx = -1; sx <= 1; sx += 2) {
      group.add(
        buildPanel(
          THREE,
          {
            rootX: partX,
            rootZ: 0.06,
            az: sx * 1.14,
            azEnd: sx * 1.16,
            dropEl: 0.12,
            endY: 0.135,
            layer: 1.2,
            puff: 0.008,
            width: 0.062,
            thick: 0.012,
            blunt: false,
            tipWidth: 0.2,
            skullFollow: true,
            noSway: true,
          },
          hairMat,
          rng,
          swayItems
        )
      );
    }
    addFringe(THREE, group, hairMat, rng, swayItems, fringe, partX);
  } else if (hairStyle === "sidePart") {
    partX = -0.065;
    addBackAndSides(THREE, group, hairMat, rng, swayItems, {
      partX,
      backEndY: 0.058,
      sideEndY: 0.155,
      earCut: true,
      blunt: false,
      tipWidth: 0.36,
      width: 0.112,
      thick: 0.015,
      puff: 0.015,
      addFrontLocks: true,
      frontLockEndY: 0.115,
      frontLockBlunt: false,
      frontLockWidth: 0.064,
      crownTier: true,
      skullFollow: true,
    });
    addFringe(THREE, group, hairMat, rng, swayItems, fringe, partX, {
      extraPuff: 0.003,
    });
  } else if (hairStyle === "tousled") {
    partX = 0.0;
    addBackAndSides(THREE, group, hairMat, rng, swayItems, {
      partX,
      backEndY: 0.055,
      sideEndY: 0.118,
      earCut: true,
      blunt: false,
      tipWidth: 0.1,
      width: 0.098,
      thick: 0.015,
      puff: 0.016,
      flare: 0.016,
      addFrontLocks: true,
      frontLockEndY: 0.105,
      frontLockBlunt: false,
      frontLockWidth: 0.065,
      crownTier: true,
    });
    const tuftAzs = [-2.4, -1.75, -1.08, -0.55, 0.55, 1.08, 1.75, 2.4];
    tuftAzs.forEach((az, i) => {
      const isFront = Math.abs(az) < 0.9;
      group.add(
        buildPanel(
          THREE,
          {
            rootX: 0,
            rootZ: lerp(0.06, -0.05, Math.abs(az) / PI),
            az,
            azEnd: az * 0.92,
            dropEl: isFront ? 0.38 : 0.24,
            endY: isFront ? 0.206 : 0.165,
            layer: 1.85 + (i % 2) * 0.25,
            puff: 0.022,
            width: 0.072,
            thick: 0.014,
            blunt: false,
            tipWidth: 0.06,
            flare: 0.022,
            noSway: true,
          },
          hairMat,
          rng,
          swayItems
        )
      );
    });
    addFringe(THREE, group, hairMat, rng, swayItems, fringe, partX, {
      pointed: true,
      extraPuff: 0.004,
    });
  } else if (hairStyle === "curtainBangs") {
    partX = 0.0;
    addBackAndSides(THREE, group, hairMat, rng, swayItems, {
      partX,
      backEndY: 0.042,
      sideEndY: 0.068,
      blunt: false,
      tipWidth: 0.34,
      width: 0.112,
      thick: 0.016,
      puff: 0.018,
      flare: 0.016,
      addFrontLocks: true,
      frontLockEndY: 0.065,
      frontLockBlunt: false,
      frontLockWidth: 0.078,
    });
    addFringe(THREE, group, hairMat, rng, swayItems, fringe, partX, {
      extraPuff: 0.004,
    });
  } else if (hairStyle === "pixie") {
    partX = -0.055;
    addBackAndSides(THREE, group, hairMat, rng, swayItems, {
      partX,
      backEndY: 0.062,
      sideEndY: 0.168,
      earCut: true,
      blunt: false,
      tipWidth: 0.18,
      width: 0.1,
      thick: 0.014,
      puff: 0.013,
      flare: 0.008,
      addFrontLocks: true,
      frontLockEndY: 0.125,
      frontLockBlunt: false,
      frontLockWidth: 0.06,
      crownTier: true,
      skullFollow: true,
    });
    addFringe(THREE, group, hairMat, rng, swayItems, fringe, partX, {
      pointed: true,
    });
  } else if (hairStyle === "curlyMedium") {
    partX = 0.0;
    addBackAndSides(THREE, group, hairMat, rng, swayItems, {
      partX,
      backEndY: -0.012,
      sideEndY: 0.005,
      blunt: false,
      tipWidth: 0.44,
      width: 0.114,
      thick: 0.017,
      puff: 0.018,
      flare: 0.024,
      waveAmp: 0.023,
      waveFreq: 1.75,
      waveLat: 0.016,
      addFrontLocks: true,
      frontLockEndY: 0.018,
      frontLockBlunt: false,
      frontLockWidth: 0.076,
    });
    addFringe(THREE, group, hairMat, rng, swayItems, fringe, partX, {
      extraPuff: 0.004,
    });
  }

  return group;
}

export function sway(group, t, amount = 1) {
  if (!group || !group.userData || !group.userData.swayItems) return;
  const items = group.userData.swayItems;
  const a = clamp(amount ?? 1, 0, 2);
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const s1 = Math.sin(t * it.freq + it.phase);
    const s2 = Math.sin(t * it.freq * 0.63 + it.phase * 1.7);
    if (it.isTail) {
      it.pivot.rotation.z = (s1 * 0.78 + s2 * 0.22) * it.ampZ * a;
      it.pivot.rotation.x = (0.25 + 0.75 * s2) * it.ampX * a;
    } else {
      const zBias = it.sideSign * 0.18;
      it.pivot.rotation.z = (zBias + s1 * 0.82) * it.ampZ * a;
      const xWave = it.isBack ? 0.35 + 0.65 * s2 : s2 * 0.6;
      it.pivot.rotation.x = xWave * it.ampX * a;
    }
  }
}
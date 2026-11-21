export const META = {
  id: 'fluffy-moon-moth',
  name: 'Fluffy Moon Moth',
  kind: 'creature',
  footprint: [0.30, 0.24],
  variants: ['Luna Green', 'Dreamy Lilac', 'Warm Cream'],
  note: 'Hero stylised fluffy moth (~0.3 m wingspan) resting with spread moon-and-eyespot wings, long trailing tails, feathery antennae, and cozy chibi proportions.'
};

const PALETTES = [
  {
    // 0: Luna Green
    fur: '#f6f2e6',
    furAccent: '#94d5a3',
    eye: '#1c1424',
    glow: '#eeff9c'
  },
  {
    // 1: Dreamy Lilac
    fur: '#f5eef9',
    furAccent: '#bda0e0',
    eye: '#21132b',
    glow: '#ffdcf6'
  },
  {
    // 2: Warm Cream
    fur: '#f9f0df',
    furAccent: '#e6c592',
    eye: '#261811',
    glow: '#ffef96'
  }
];

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function resolveColor(THREE, val, fallback) {
  if (val && val.isColor) return val.clone();
  try {
    if (val !== undefined && val !== null) return new THREE.Color(val);
  } catch (_) {
    // fall through to fallback
  }
  return new THREE.Color(fallback);
}

function cssRgb(col, alpha) {
  const r = Math.round(clamp(col.r, 0, 1) * 255);
  const g = Math.round(clamp(col.g, 0, 1) * 255);
  const b = Math.round(clamp(col.b, 0, 1) * 255);
  return alpha === undefined ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

function fbm(kit, x, y, octaves = 3) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += kit.noise(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return sum / norm;
}

// Ring-by-ring tapered tube using parallel-transport frames (zero twist glitches, rounded caps)
function createTaperedTube(THREE, curve, tubularSegments, radialSegments, radiusFn, capEnds = true) {
  const pts = [];
  const tangents = [];
  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    pts.push(curve.getPoint(t));
  }
  for (let i = 0; i <= tubularSegments; i++) {
    const tVec = new THREE.Vector3();
    if (i === 0) tVec.subVectors(pts[1], pts[0]);
    else if (i === tubularSegments) tVec.subVectors(pts[i], pts[i - 1]);
    else tVec.subVectors(pts[i + 1], pts[i - 1]);
    if (tVec.lengthSq() < 1e-12) tVec.set(0, 1, 0);
    tVec.normalize();
    tangents.push(tVec);
  }

  // Parallel transport frames
  const normals = [];
  const binormals = [];
  const up = Math.abs(tangents[0].y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const b0 = new THREE.Vector3().crossVectors(tangents[0], up).normalize();
  const n0 = new THREE.Vector3().crossVectors(b0, tangents[0]).normalize();
  normals.push(n0);
  binormals.push(b0);

  const axis = new THREE.Vector3();
  const q = new THREE.Quaternion();
  for (let i = 1; i <= tubularSegments; i++) {
    const prevN = normals[i - 1].clone();
    axis.crossVectors(tangents[i - 1], tangents[i]);
    if (axis.lengthSq() > 1e-12) {
      axis.normalize();
      const cosA = clamp(tangents[i - 1].dot(tangents[i]), -1, 1);
      q.setFromAxisAngle(axis, Math.acos(cosA));
      prevN.applyQuaternion(q);
    }
    prevN.addScaledVector(tangents[i], -prevN.dot(tangents[i])).normalize();
    const bi = new THREE.Vector3().crossVectors(tangents[i], prevN).normalize();
    normals.push(prevN);
    binormals.push(bi);
  }

  // Build profile rings (including rounded start/end caps if requested)
  const rings = [];
  if (capEnds) {
    const r0 = Math.max(1e-5, radiusFn(0));
    rings.push({ p: pts[0].clone().addScaledVector(tangents[0], -r0 * 0.72), n: normals[0], b: binormals[0], r: 1e-5, v: 0 });
    rings.push({ p: pts[0].clone().addScaledVector(tangents[0], -r0 * 0.42), n: normals[0], b: binormals[0], r: r0 * 0.76, v: 0 });
  }
  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    rings.push({ p: pts[i], n: normals[i], b: binormals[i], r: Math.max(1e-5, radiusFn(t)), v: t });
  }
  if (capEnds) {
    const r1 = Math.max(1e-5, radiusFn(1));
    const last = tubularSegments;
    rings.push({ p: pts[last].clone().addScaledVector(tangents[last], r1 * 0.42), n: normals[last], b: binormals[last], r: r1 * 0.72, v: 1 });
    rings.push({ p: pts[last].clone().addScaledVector(tangents[last], r1 * 0.75), n: normals[last], b: binormals[last], r: 1e-5, v: 1 });
  }

  const ringCount = rings.length;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i < ringCount; i++) {
    const rg = rings[i];
    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const theta = u * Math.PI * 2;
      const cs = Math.cos(theta);
      const sn = Math.sin(theta);
      const vx = rg.p.x + (rg.n.x * cs + rg.b.x * sn) * rg.r;
      const vy = rg.p.y + (rg.n.y * cs + rg.b.y * sn) * rg.r;
      const vz = rg.p.z + (rg.n.z * cs + rg.b.z * sn) * rg.r;
      positions.push(vx, vy, vz);
      uvs.push(u, rg.v);
    }
  }

  const stride = radialSegments + 1;
  for (let i = 0; i < ringCount - 1; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function mergeGeometries(THREE, geometries) {
  const nonIndexed = geometries.map((g) => (g.index ? g.toNonIndexed() : g));
  let totalVerts = 0;
  for (const g of nonIndexed) totalVerts += g.attributes.position.count;

  const pos = new Float32Array(totalVerts * 3);
  const norm = new Float32Array(totalVerts * 3);
  const uv = new Float32Array(totalVerts * 2);

  let offset = 0;
  for (const g of nonIndexed) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const count = g.attributes.position.count;
    pos.set(g.attributes.position.array, offset * 3);
    norm.set(g.attributes.normal.array, offset * 3);
    if (g.attributes.uv) {
      uv.set(g.attributes.uv.array, offset * 2);
    }
    offset += count;
    if (g !== geometries[geometries.indexOf(g)]) g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return merged;
}

// Watertight longest-edge subdivision so broad wing caps bend smoothly without subdividing bevels
function subdivideLongEdges(THREE, geometry, maxEdgeLen, passes = 3) {
  let geo = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const maxSq = maxEdgeLen * maxEdgeLen;

  for (let pass = 0; pass < passes; pass++) {
    const pArr = geo.attributes.position.array;
    const uArr = geo.attributes.uv.array;
    const triCount = pArr.length / 9;

    const outP = [];
    const outU = [];

    const pushVert = (v, u) => {
      outP.push(v[0], v[1], v[2]);
      outU.push(u[0], u[1]);
    };
    const pushTri = (va, ua, vb, ub, vc, uc) => {
      pushVert(va, ua);
      pushVert(vb, ub);
      pushVert(vc, uc);
    };
    const mid3 = (a, b) => [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5];
    const mid2 = (a, b) => [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5];
    const distSq = (a, b) => {
      const dx = a[0] - b[0];
      const dy = a[1] - b[1];
      const dz = a[2] - b[2];
      return dx * dx + dy * dy + dz * dz;
    };

    let splitAny = false;
    for (let t = 0; t < triCount; t++) {
      const pi = t * 9;
      const ui = t * 6;
      const v0 = [pArr[pi], pArr[pi + 1], pArr[pi + 2]];
      const v1 = [pArr[pi + 3], pArr[pi + 4], pArr[pi + 5]];
      const v2 = [pArr[pi + 6], pArr[pi + 7], pArr[pi + 8]];
      const u0 = [uArr[ui], uArr[ui + 1]];
      const u1 = [uArr[ui + 2], uArr[ui + 3]];
      const u2 = [uArr[ui + 4], uArr[ui + 5]];

      const s01 = distSq(v0, v1) > maxSq;
      const s12 = distSq(v1, v2) > maxSq;
      const s20 = distSq(v2, v0) > maxSq;
      const cnt = (s01 ? 1 : 0) + (s12 ? 1 : 0) + (s20 ? 1 : 0);

      if (cnt === 0) {
        pushTri(v0, u0, v1, u1, v2, u2);
      } else if (cnt === 3) {
        splitAny = true;
        const m01 = mid3(v0, v1), um01 = mid2(u0, u1);
        const m12 = mid3(v1, v2), um12 = mid2(u1, u2);
        const m20 = mid3(v2, v0), um20 = mid2(u2, u0);
        pushTri(v0, u0, m01, um01, m20, um20);
        pushTri(m01, um01, v1, u1, m12, um12);
        pushTri(m20, um20, m12, um12, v2, u2);
        pushTri(m01, um01, m12, um12, m20, um20);
      } else if (cnt === 1) {
        splitAny = true;
        let va, ua, vb, ub, vc, uc;
        if (s01) { va = v0; ua = u0; vb = v1; ub = u1; vc = v2; uc = u2; }
        else if (s12) { va = v1; ua = u1; vb = v2; ub = u2; vc = v0; uc = u0; }
        else { va = v2; ua = u2; vb = v0; ub = u0; vc = v1; uc = u1; }
        const m = mid3(va, vb), um = mid2(ua, ub);
        pushTri(va, ua, m, um, vc, uc);
        pushTri(m, um, vb, ub, vc, uc);
      } else {
        splitAny = true;
        let va, ua, vb, ub, vc, uc;
        if (!s12) { va = v0; ua = u0; vb = v1; ub = u1; vc = v2; uc = u2; }
        else if (!s20) { va = v1; ua = u1; vb = v2; ub = u2; vc = v0; uc = u0; }
        else { va = v2; ua = u2; vb = v0; ub = u0; vc = v1; uc = u1; }
        const mAB = mid3(va, vb), umAB = mid2(ua, ub);
        const mCA = mid3(vc, va), umCA = mid2(uc, ua);
        pushTri(va, ua, mAB, umAB, mCA, umCA);
        pushTri(mAB, umAB, vb, ub, vc, uc);
        pushTri(mAB, umAB, vc, uc, mCA, umCA);
      }
    }

    geo.dispose();
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(outP, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(outU, 2));
    if (!splitAny) break;
  }

  return geo;
}

function computeSmoothNormalsWelded(THREE, geo) {
  const pos = geo.attributes.position;
  const count = pos.count;
  const accum = new Map();
  const keys = new Array(count);

  const scale = 20000;
  for (let i = 0; i < count; i++) {
    const k = `${Math.round(pos.getX(i) * scale)},${Math.round(pos.getY(i) * scale)},${Math.round(pos.getZ(i) * scale)}`;
    keys[i] = k;
    if (!accum.has(k)) accum.set(k, [0, 0, 0]);
  }

  for (let i = 0; i < count; i += 3) {
    const ax = pos.getX(i), ay = pos.getY(i), az = pos.getZ(i);
    const bx = pos.getX(i + 1) - ax, by = pos.getY(i + 1) - ay, bz = pos.getZ(i + 1) - az;
    const cx = pos.getX(i + 2) - ax, cy = pos.getY(i + 2) - ay, cz = pos.getZ(i + 2) - az;
    const nx = by * cz - bz * cy;
    const ny = bz * cx - bx * cz;
    const nz = bx * cy - by * cx;
    for (let j = 0; j < 3; j++) {
      const a = accum.get(keys[i + j]);
      a[0] += nx;
      a[1] += ny;
      a[2] += nz;
    }
  }

  const norms = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = accum.get(keys[i]);
    const len = Math.hypot(a[0], a[1], a[2]) || 1;
    norms[i * 3] = a[0] / len;
    norms[i * 3 + 1] = a[1] / len;
    norms[i * 3 + 2] = a[2] / len;
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(norms, 3));
}

function mirrorGeometryX(geo) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, -pos.getX(i));
  }
  for (let i = 0; i < pos.count; i += 3) {
    const x1 = pos.getX(i + 1), y1 = pos.getY(i + 1), z1 = pos.getZ(i + 1);
    const x2 = pos.getX(i + 2), y2 = pos.getY(i + 2), z2 = pos.getZ(i + 2);
    pos.setXYZ(i + 1, x2, y2, z2);
    pos.setXYZ(i + 2, x1, y1, z1);
    if (uv) {
      const u1 = uv.getX(i + 1), v1 = uv.getY(i + 1);
      const u2 = uv.getX(i + 2), v2 = uv.getY(i + 2);
      uv.setXY(i + 1, u2, v2);
      uv.setXY(i + 2, u1, v1);
    }
  }
  pos.needsUpdate = true;
  if (uv) uv.needsUpdate = true;
}

// ---------- PROCEDURAL CANVAS TEXTURES ----------

function makeFurTextures(THREE, kit, furCol, accentCol) {
  const lightCol = furCol.clone().lerp(new THREE.Color('#ffffff'), 0.28);
  const warmBack = furCol.clone().lerp(accentCol, 0.24).multiplyScalar(0.92);
  const stripeCol = furCol.clone().lerp(accentCol, 0.36).multiplyScalar(0.84);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    // Base plush gradient: creamy belly, soft tinted dorsal tone
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, cssRgb(lightCol));
    grad.addColorStop(0.32, cssRgb(furCol));
    grad.addColorStop(0.68, cssRgb(warmBack));
    grad.addColorStop(1.0, cssRgb(furCol));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle soft abdomen bands along upper/lower thirds
    for (let b = 0; b < 5; b++) {
      const y = h * (0.14 + b * 0.14);
      const bandGrad = ctx.createLinearGradient(0, y - 16, 0, y + 16);
      bandGrad.addColorStop(0, cssRgb(stripeCol, 0));
      bandGrad.addColorStop(0.5, cssRgb(stripeCol, 0.20));
      bandGrad.addColorStop(1, cssRgb(stripeCol, 0));
      ctx.fillStyle = bandGrad;
      ctx.fillRect(0, y - 16, w, 32);
    }

    // Fine directional fur flecks & silky locks
    for (let i = 0; i < 4800; i++) {
      const rx = kit.noise(i * 0.173, 4.13);
      const ry = kit.noise(9.71, i * 0.219);
      const x = rx * w;
      const y = ry * h;
      const n = fbm(kit, rx * 8, ry * 8, 2);
      const len = 8 + n * 16;
      const ang = Math.PI * 0.5 + (n - 0.5) * 0.55;
      const isLight = kit.noise(i * 0.37, 1.9) > 0.45;
      ctx.strokeStyle = isLight ? cssRgb(lightCol, 0.38) : cssRgb(stripeCol, 0.26);
      ctx.lineWidth = 1.0 + n * 1.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 5200; i++) {
      const rx = kit.noise(i * 0.197, 2.31);
      const ry = kit.noise(7.11, i * 0.163);
      const x = rx * w;
      const y = ry * h;
      const n = kit.noise(rx * 14, ry * 14);
      const len = 7 + n * 15;
      const ang = Math.PI * 0.5 + (n - 0.5) * 0.5;
      const shade = Math.round(95 + n * 135);
      ctx.strokeStyle = `rgba(${shade},${shade},${shade},0.45)`;
      ctx.lineWidth = 1.3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
  });
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

function drawCrescent(ctx, cx, cy, r, rot, fillStyle) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI * 0.72, Math.PI * 0.72, false);
  ctx.arc(r * 0.36, 0, r * 0.78, Math.PI * 0.60, -Math.PI * 0.60, true);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawStarDot(ctx, x, y, r, colorCss) {
  ctx.save();
  ctx.fillStyle = colorCss;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function makeWingTextures(THREE, kit, isFore, furCol, accentCol, glowCol, eyeCol) {
  const deepAccent = accentCol.clone().multiplyScalar(0.68);
  const paleAccent = accentCol.clone().lerp(furCol, 0.55);
  const costalVelvet = eyeCol.clone().lerp(accentCol, 0.35).lerp(new THREE.Color('#7a4d5c'), 0.38);
  const ocellusGold = glowCol.clone().lerp(new THREE.Color('#e2b659'), 0.42);
  const brightGlow = glowCol.clone().lerp(new THREE.Color('#ffffff'), 0.35);

  // Key pattern centers in normalized UV space (u: 0=root..1=tip, v: 0=rear..1=front)
  // Canvas y = (1 - v) * h
  const ocellusU = isFore ? 0.43 : 0.52;
  const ocellusV = isFore ? 0.54 : 0.75;
  const ocellusR = isFore ? 0.088 : 0.072;

  const moonU = isFore ? 0.71 : 0.66;
  const moonV = isFore ? 0.60 : 0.56;
  const moonR = isFore ? 0.072 : 0.048;

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    // Rich velvety base gradient from fluffy fur root to deep outer accent
    const baseGrad = ctx.createRadialGradient(w * 0.05, h * (isFore ? 0.48 : 0.20), w * 0.04, w * 0.55, h * 0.5, w * 0.92);
    baseGrad.addColorStop(0.0, cssRgb(furCol));
    baseGrad.addColorStop(0.24, cssRgb(paleAccent));
    baseGrad.addColorStop(0.58, cssRgb(accentCol));
    baseGrad.addColorStop(0.92, cssRgb(deepAccent));
    baseGrad.addColorStop(1.0, cssRgb(deepAccent.clone().multiplyScalar(0.86)));
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, w, h);

    // Velvety moth-scale mottling & soft shimmer flecks
    for (let i = 0; i < 2400; i++) {
      const rx = kit.noise(i * 0.131, isFore ? 3.7 : 8.2);
      const ry = kit.noise(isFore ? 6.4 : 1.9, i * 0.187);
      const n = fbm(kit, rx * 6, ry * 6, 2);
      const r = 1.2 + n * 4.2;
      ctx.fillStyle = n > 0.52 ? cssRgb(paleAccent, 0.14) : cssRgb(deepAccent, 0.13);
      ctx.beginPath();
      ctx.arc(rx * w, ry * h, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Velvety costal leading edge stripe on forewing (signature luna/silk moth detail)
    if (isFore) {
      const cGrad = ctx.createLinearGradient(0, 0, 0, h * 0.24);
      cGrad.addColorStop(0.0, cssRgb(costalVelvet, 0.88));
      cGrad.addColorStop(0.55, cssRgb(costalVelvet, 0.42));
      cGrad.addColorStop(1.0, cssRgb(costalVelvet, 0.0));
      ctx.fillStyle = cGrad;
      ctx.fillRect(0, 0, w, h * 0.24);
    } else {
      // Soft gradient along the long trailing hindwing tail
      const tailGrad = ctx.createLinearGradient(0, h * 0.52, 0, h);
      tailGrad.addColorStop(0.0, cssRgb(deepAccent, 0.0));
      tailGrad.addColorStop(0.45, cssRgb(costalVelvet, 0.34));
      tailGrad.addColorStop(0.82, cssRgb(paleAccent, 0.55));
      tailGrad.addColorStop(1.0, cssRgb(furCol, 0.72));
      ctx.fillStyle = tailGrad;
      ctx.fillRect(0, h * 0.52, w, h * 0.48);
    }

    // Delicate scalloped outer margin trim
    const edgeGrad = ctx.createRadialGradient(w * 0.12, h * (isFore ? 0.50 : 0.25), w * 0.62, w * 0.12, h * (isFore ? 0.50 : 0.25), w * 0.96);
    edgeGrad.addColorStop(0.0, cssRgb(furCol, 0));
    edgeGrad.addColorStop(0.76, cssRgb(costalVelvet, 0.22));
    edgeGrad.addColorStop(0.92, cssRgb(furCol, 0.52));
    edgeGrad.addColorStop(1.0, cssRgb(furCol, 0.68));
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, 0, w, h);

    // Radiating wing veins
    ctx.save();
    ctx.lineCap = 'round';
    const rootX = w * 0.02;
    const rootY = h * (isFore ? 0.50 : 0.18);
    const veinTargets = isFore
      ? [[0.96, 0.16], [0.97, 0.30], [0.92, 0.46], [0.85, 0.62], [0.74, 0.76], [0.58, 0.88], [0.38, 0.92]]
      : [[0.90, 0.16], [0.92, 0.30], [0.84, 0.44], [0.72, 0.58], [0.64, 0.86], [0.56, 0.94], [0.36, 0.46]];
    for (let i = 0; i < veinTargets.length; i++) {
      const [tx, ty] = veinTargets[i];
      ctx.strokeStyle = cssRgb(deepAccent, 0.36);
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(rootX, rootY);
      ctx.quadraticCurveTo(w * (tx * 0.52), h * ((rootY / h + ty) * 0.46), w * tx, h * ty);
      ctx.stroke();

      ctx.strokeStyle = cssRgb(paleAccent, 0.42);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(rootX, rootY);
      ctx.quadraticCurveTo(w * (tx * 0.52), h * ((rootY / h + ty) * 0.46), w * tx, h * ty);
      ctx.stroke();
    }
    ctx.restore();

    // Eye-spot (ocellus) with layered velvet ring, golden ring, dark pupil, and glowing crescent core
    const ox = ocellusU * w;
    const oy = (1 - ocellusV) * h;
    const or = ocellusR * w;

    const halo = ctx.createRadialGradient(ox, oy, or * 0.55, ox, oy, or * 1.42);
    halo.addColorStop(0.0, cssRgb(costalVelvet, 0.55));
    halo.addColorStop(0.65, cssRgb(costalVelvet, 0.20));
    halo.addColorStop(1.0, cssRgb(costalVelvet, 0.0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(ox, oy, or * 1.42, 0, Math.PI * 2);
    ctx.fill();

    // Outer dark velvety ring
    ctx.fillStyle = cssRgb(eyeCol, 0.86);
    ctx.beginPath();
    ctx.ellipse(ox, oy, or * 1.04, or * 0.88, -0.22, 0, Math.PI * 2);
    ctx.fill();

    // Warm golden-glow iris ring
    ctx.fillStyle = cssRgb(ocellusGold, 0.95);
    ctx.beginPath();
    ctx.ellipse(ox, oy, or * 0.84, or * 0.70, -0.22, 0, Math.PI * 2);
    ctx.fill();

    // Deep velvet pupil
    ctx.fillStyle = cssRgb(eyeCol, 0.95);
    ctx.beginPath();
    ctx.ellipse(ox, oy, or * 0.62, or * 0.50, -0.22, 0, Math.PI * 2);
    ctx.fill();

    // Luminous crescent inside the eye-spot
    drawCrescent(ctx, ox - or * 0.04, oy - or * 0.04, or * 0.42, -0.45, cssRgb(brightGlow));
    drawStarDot(ctx, ox + or * 0.22, oy + or * 0.14, or * 0.09, cssRgb(brightGlow));

    // Celestial crescent-moon pattern on outer wing
    const mx = moonU * w;
    const my = (1 - moonV) * h;
    const mr = moonR * w;

    const mHalo = ctx.createRadialGradient(mx, my, mr * 0.3, mx, my, mr * 1.65);
    mHalo.addColorStop(0.0, cssRgb(costalVelvet, 0.42));
    mHalo.addColorStop(0.6, cssRgb(deepAccent, 0.18));
    mHalo.addColorStop(1.0, cssRgb(deepAccent, 0.0));
    ctx.fillStyle = mHalo;
    ctx.beginPath();
    ctx.arc(mx, my, mr * 1.65, 0, Math.PI * 2);
    ctx.fill();

    drawCrescent(ctx, mx, my, mr, isFore ? -0.35 : -0.85, cssRgb(brightGlow));

    // Tiny stardust dots around the crescent moon
    const stars = isFore
      ? [[mx + mr * 0.85, my - mr * 0.55, 5.2], [mx + mr * 1.15, my + mr * 0.12, 3.6], [mx - mr * 0.95, my + mr * 0.75, 4.0], [mx + mr * 0.45, my + mr * 0.95, 3.2]]
      : [[mx + mr * 0.9, my - mr * 0.3, 3.8], [mx - mr * 0.6, my + mr * 0.95, 3.2], [w * 0.64, h * 0.87, 6.0], [w * 0.61, h * 0.80, 3.4]];
    for (const [sx, sy, sr] of stars) {
      drawStarDot(ctx, sx, sy, sr, cssRgb(brightGlow, 0.92));
    }

    // Fluffy fur-root feathering strokes so wing base blends seamlessly into thorax fur
    for (let i = 0; i < 420; i++) {
      const t = i / 420;
      const y = (isFore ? 0.14 + t * 0.74 : 0.04 + t * 0.42) * h;
      const len = (24 + kit.noise(i * 0.41, 2.7) * 58);
      ctx.strokeStyle = cssRgb(furCol, 0.48);
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(len, y + (kit.noise(i * 0.23, 5.1) - 0.5) * 18);
      ctx.stroke();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;

  // Emissive map: glowing crescent moon, starlight dots, and eye-spot luminous core
  const emissiveMap = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    const ox = ocellusU * w;
    const oy = (1 - ocellusV) * h;
    const or = ocellusR * w;

    // Soft bloom behind eye-spot ring
    const oGlow = ctx.createRadialGradient(ox, oy, or * 0.15, ox, oy, or * 1.15);
    oGlow.addColorStop(0.0, 'rgba(255,255,255,0.65)');
    oGlow.addColorStop(0.55, 'rgba(220,220,220,0.32)');
    oGlow.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = oGlow;
    ctx.beginPath();
    ctx.arc(ox, oy, or * 1.15, 0, Math.PI * 2);
    ctx.fill();

    // Glowing eye-spot ring outline + inner crescent
    ctx.strokeStyle = 'rgba(230,230,230,0.55)';
    ctx.lineWidth = or * 0.12;
    ctx.beginPath();
    ctx.ellipse(ox, oy, or * 0.78, or * 0.65, -0.22, 0, Math.PI * 2);
    ctx.stroke();
    drawCrescent(ctx, ox - or * 0.04, oy - or * 0.04, or * 0.42, -0.45, '#ffffff');
    drawStarDot(ctx, ox + or * 0.22, oy + or * 0.14, or * 0.10, '#ffffff');

    // Outer crescent moon glow
    const mx = moonU * w;
    const my = (1 - moonV) * h;
    const mr = moonR * w;
    const mGlow = ctx.createRadialGradient(mx, my, mr * 0.1, mx, my, mr * 1.5);
    mGlow.addColorStop(0.0, 'rgba(255,255,255,0.75)');
    mGlow.addColorStop(0.5, 'rgba(180,180,180,0.22)');
    mGlow.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = mGlow;
    ctx.beginPath();
    ctx.arc(mx, my, mr * 1.5, 0, Math.PI * 2);
    ctx.fill();
    drawCrescent(ctx, mx, my, mr, isFore ? -0.35 : -0.85, '#ffffff');

    const stars = isFore
      ? [[mx + mr * 0.85, my - mr * 0.55, 6.2], [mx + mr * 1.15, my + mr * 0.12, 4.4], [mx - mr * 0.95, my + mr * 0.75, 4.8], [mx + mr * 0.45, my + mr * 0.95, 3.8]]
      : [[mx + mr * 0.9, my - mr * 0.3, 4.6], [mx - mr * 0.6, my + mr * 0.95, 4.0], [w * 0.64, h * 0.87, 8.0], [w * 0.61, h * 0.80, 4.2]];
    for (const [sx, sy, sr] of stars) {
      drawStarDot(ctx, sx, sy, sr, '#ffffff');
    }
  });
  emissiveMap.colorSpace = THREE.SRGBColorSpace;

  // Bump map: subtle veins, velvety moth-scale stipple, fuzzy wing root
  const bumpMap = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#787878';
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 3200; i++) {
      const rx = kit.noise(i * 0.17, 5.3);
      const ry = kit.noise(3.1, i * 0.23);
      const shade = Math.round(95 + kit.noise(rx * 18, ry * 18) * 65);
      ctx.fillStyle = `rgba(${shade},${shade},${shade},0.35)`;
      ctx.fillRect(rx * w, ry * h, 3, 2);
    }

    const rootX = w * 0.02;
    const rootY = h * (isFore ? 0.50 : 0.18);
    const veinTargets = isFore
      ? [[0.96, 0.16], [0.97, 0.30], [0.92, 0.46], [0.85, 0.62], [0.74, 0.76], [0.58, 0.88]]
      : [[0.90, 0.16], [0.92, 0.30], [0.84, 0.44], [0.72, 0.58], [0.64, 0.86]];
    ctx.strokeStyle = 'rgba(225,225,225,0.65)';
    ctx.lineWidth = 4.0;
    ctx.lineCap = 'round';
    for (const [tx, ty] of veinTargets) {
      ctx.beginPath();
      ctx.moveTo(rootX, rootY);
      ctx.quadraticCurveTo(w * (tx * 0.52), h * ((rootY / h + ty) * 0.46), w * tx, h * ty);
      ctx.stroke();
    }

    // Raised fluffy root hairs
    for (let i = 0; i < 320; i++) {
      const t = i / 320;
      const y = (isFore ? 0.14 + t * 0.74 : 0.04 + t * 0.42) * h;
      const len = 20 + kit.noise(i * 0.31, 1.4) * 52;
      ctx.strokeStyle = 'rgba(240,240,240,0.48)';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(len, y + (kit.noise(i * 0.19, 8.1) - 0.5) * 14);
      ctx.stroke();
    }
  });

  return { map, emissiveMap, bumpMap };
}

function makeIrisTexture(THREE, kit, eyeCol, accentCol, glowCol) {
  const irisBase = eyeCol.clone().lerp(accentCol, 0.48);
  const irisBright = accentCol.clone().lerp(glowCol, 0.45);
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w * 0.5;
    const cy = h * 0.5;
    const r = w * 0.46;

    // Soft glowing bottom crescent iris ring for cozy storybook eye depth
    const grad = ctx.createRadialGradient(cx, cy, r * 0.48, cx, cy, r);
    grad.addColorStop(0.0, cssRgb(eyeCol, 0.0));
    grad.addColorStop(0.45, cssRgb(irisBase, 0.0));
    grad.addColorStop(0.68, cssRgb(irisBase, 0.82));
    grad.addColorStop(0.86, cssRgb(irisBright, 0.92));
    grad.addColorStop(1.0, cssRgb(eyeCol, 0.0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Subtle iris fibre strokes
    for (let i = 0; i < 48; i++) {
      const ang = (i / 48) * Math.PI * 2;
      const a = 0.2 + 0.35 * Math.max(0, Math.sin(ang)); // brighter in lower half
      ctx.strokeStyle = cssRgb(irisBright, a);
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * r * 0.58, cy + Math.sin(ang) * r * 0.58);
      ctx.lineTo(cx + Math.cos(ang) * r * 0.92, cy + Math.sin(ang) * r * 0.92);
      ctx.stroke();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBlushTexture(THREE, kit, accentCol) {
  const blushCol = new THREE.Color('#f48fa6').lerp(accentCol, 0.22);
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.05, w * 0.5, h * 0.5, w * 0.48);
    g.addColorStop(0.0, cssRgb(blushCol, 0.62));
    g.addColorStop(0.52, cssRgb(blushCol, 0.28));
    g.addColorStop(1.0, cssRgb(blushCol, 0.0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- SCULPTED BODY & FLUFF ----------

function buildBody(THREE, kit, mats) {
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'body';
  bodyGroup.position.set(0, 0.036, 0);

  // 1. ONE continuous sculpted surface for thorax + waist + segmented fluffy abdomen
  const bodyGeo = new THREE.SphereGeometry(1, 56, 40);
  const pos = bodyGeo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const sx = pos.getX(i);
    const sy = pos.getY(i);
    const sz = pos.getZ(i);

    // u = 0 at rear abdomen tip, u = 1 at front of thorax
    const u = (sz + 1) * 0.5;
    const radAngle = Math.atan2(sy, sx);

    // Axial Z span: -0.068 (abdomen tip) to +0.038 (front of thorax)
    const z = -0.068 + u * 0.106;

    // Sculpted longitudinal width & height envelope
    const abdEnv = Math.sin(clamp(u / 0.58, 0, 1) * Math.PI);
    const thxEnv = Math.sin(clamp((u - 0.40) / 0.60, 0, 1) * Math.PI);
    const waistBridge = Math.exp(-Math.pow((u - 0.50) / 0.13, 2)) * 0.0175;

    let rx = Math.max(abdEnv * 0.0225, thxEnv * 0.0315, waistBridge);
    let ry = Math.max(abdEnv * 0.0195, thxEnv * 0.0265, waistBridge * 0.88);

    // Smooth taper at both poles so endpoints stay plush and continuous
    const endCap = Math.sqrt(Math.max(0, 1 - sz * sz));
    rx = rx * (0.45 + 0.55 * endCap) + 0.0015 * endCap;
    ry = ry * (0.45 + 0.55 * endCap) + 0.0015 * endCap;

    // Gentle cozy segmentation ripples along abdomen
    if (u < 0.52) {
      const segFade = smoothstep(0.06, 0.16, u) * (1 - smoothstep(0.42, 0.52, u));
      const ripple = Math.sin(u * Math.PI * 15) * 0.0012 * segFade;
      rx += ripple;
      ry += ripple * 0.85;
    }

    // Lush sculpted fluffy tufts on the thorax (sweeping layered fur ridges)
    const thxMask = smoothstep(0.48, 0.65, u) * (1 - smoothstep(0.92, 1.0, u));
    const nFur = fbm(kit, radAngle * 1.4 + 3.2, u * 6.5 + 1.1, 3);
    const lockWave = Math.sin(radAngle * 9 + u * 12) * 0.5 + 0.5;
    const fluffBoost = (0.0018 + lockWave * 0.0032 + (nFur - 0.5) * 0.0036) * thxMask;
    rx += fluffBoost;
    ry += fluffBoost * (sy > -0.15 ? 1.05 : 0.45);

    // Subtle fur texture across abdomen too
    const abdFluff = (fbm(kit, radAngle * 2.1 + 7.5, u * 8.0, 2) - 0.5) * 0.0016 * (1 - thxMask);
    rx += abdFluff;
    ry += abdFluff;

    const unitLen = Math.hypot(sx, sy) || 1;
    let x = (sx / unitLen) * rx;
    let y = (sy / unitLen) * ry;

    // Subtle organic curve: thorax lifts gently forward, abdomen rests slightly lower & curves gently to +X
    const ySpine = smoothstep(0.45, 0.85, u) * 0.0045 - (1 - smoothstep(0.0, 0.5, u)) * 0.0055;
    const xCurve = Math.sin((1 - u) * 2.4) * 0.0026 * (1 - smoothstep(0.45, 0.72, u));
    x += xCurve;
    y += ySpine;

    // Softly flatten underside so the moth rests comfortably with grounded weight
    if (y < -0.0175) {
      y = -0.0175 + (y + 0.0175) * 0.35;
    }

    pos.setXYZ(i, x, y, z);
  }
  bodyGeo.computeVertexNormals();

  const bodyMesh = new THREE.Mesh(bodyGeo, mats.fur);
  bodyMesh.userData.slot = 'fur';
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyGroup.add(bodyMesh);

  // 2. Ultra-fluffy moth neck-ruff / collar built with LatheGeometry (>=16 points) then sculpted into fur locks
  const ruffProfile = [];
  const profilePts = 20;
  for (let i = 0; i < profilePts; i++) {
    const t = i / (profilePts - 1);
    const ang = t * Math.PI;
    // Plush torus-like collar profile, fuller along the outer rim and tapering cleanly into thorax
    const r = 0.017 + Math.sin(ang) * 0.0145 + Math.sin(ang * 2) * 0.0022;
    const y = (t - 0.5) * 0.025;
    ruffProfile.push(new THREE.Vector2(r, y));
  }
  const ruffGeo = new THREE.LatheGeometry(ruffProfile, 44);
  const rPos = ruffGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    let x = rPos.getX(i);
    let y = rPos.getY(i);
    let z = rPos.getZ(i);
    const ang = Math.atan2(z, x);
    const rad = Math.hypot(x, z) || 1;
    const outerMask = smoothstep(0.018, 0.030, rad);
    const n = fbm(kit, Math.cos(ang) * 2.5 + 4, Math.sin(ang) * 2.5 + y * 40, 3);
    const tufts = Math.pow(0.5 + 0.5 * Math.sin(ang * 11 + n * 2.2), 1.4);
    const spike = (tufts * 0.0068 + (n - 0.5) * 0.0032) * outerMask;
    // Sweep locks backward along the collar axis (-Y in lathe space before rotation)
    x += (x / rad) * spike;
    z += (z / rad) * spike;
    y -= tufts * 0.0045 * outerMask;
    // Slight dip under the chin so face stays unobstructed and cute
    if (z > 0.012 && Math.abs(x) < 0.018) {
      const chinMask = (1 - Math.abs(x) / 0.018) * smoothstep(0.012, 0.026, z);
      x *= 1 - chinMask * 0.14;
      z *= 1 - chinMask * 0.16;
    }
    rPos.setXYZ(i, x, y, z);
  }
  ruffGeo.computeVertexNormals();

  const ruffMesh = new THREE.Mesh(ruffGeo, mats.fur);
  ruffMesh.position.set(0, 0.0055, 0.0265);
  ruffMesh.rotation.x = Math.PI * 0.44;
  ruffMesh.userData.slot = 'fur';
  ruffMesh.castShadow = true;
  ruffMesh.receiveShadow = true;
  bodyGroup.add(ruffMesh);

  // 3. Sculpted shoulder fur tufts (tegulae) overlapping the wing roots deeply so wings emerge from fur
  const makeShoulderTuft = (side) => {
    const geo = new THREE.SphereGeometry(1, 24, 16);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const sx = p.getX(i), sy = p.getY(i), sz = p.getZ(i);
      const u = (sz + 1) * 0.5;
      const ang = Math.atan2(sy, sx);
      const tuft = 0.0018 * Math.sin(ang * 7 + u * 6) * (1 - u * 0.5);
      const n = (kit.noise(sx * 3 + 4.1, sz * 3 + 2.3) - 0.5) * 0.0022;
      const taper = 0.55 + 0.55 * smoothstep(0, 0.75, u);
      const x = sx * (0.0135 * taper + tuft + n);
      const y = sy * (0.0095 * taper + tuft * 0.6) + (1 - u) * 0.002;
      const z = sz * 0.020;
      p.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mats.fur);
    mesh.position.set(side * 0.020, 0.0085, 0.012);
    mesh.rotation.set(-0.14, side * 0.24, -side * 0.28);
    mesh.userData.slot = 'fur';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };
  bodyGroup.add(makeShoulderTuft(1));
  bodyGroup.add(makeShoulderTuft(-1));

  // 4. Fluffy caudal tail plume ("tail" group) deeply embedded in the rear abdomen tip
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tail';
  tailGroup.position.set(0.002, -0.0055, -0.060);

  const tailGeo = new THREE.SphereGeometry(1, 28, 18);
  const tp = tailGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const sx = tp.getX(i), sy = tp.getY(i), sz = tp.getZ(i);
    // sz = 1 embedded in body, sz = -1 flared fluffy plume tip
    const back = (1 - sz) * 0.5;
    const ang = Math.atan2(sy, sx);
    const fan = Math.pow(0.5 + 0.5 * Math.cos(ang * 5), 1.3) * back;
    const n = (fbm(kit, sx * 2.5 + 6, sz * 2.5 + 1.5, 2) - 0.5) * 0.0024;
    const flare = 0.009 + Math.sin(back * Math.PI * 0.85) * 0.0065 + fan * 0.0042;
    const x = sx * (flare * 1.18 + n);
    const y = sy * (flare * 0.72 + n * 0.6) + back * 0.0025;
    const z = -back * 0.023 + 0.004;
    tp.setXYZ(i, x, y, z);
  }
  tailGeo.computeVertexNormals();

  const tailMesh = new THREE.Mesh(tailGeo, mats.fur);
  tailMesh.userData.slot = 'fur';
  tailMesh.castShadow = true;
  tailMesh.receiveShadow = true;
  tailGroup.add(tailMesh);
  bodyGroup.add(tailGroup);

  return bodyGroup;
}

// ---------- FEATHERY ANTENNAE ("earL", "earR") ----------

function buildAntenna(THREE, side, mats) {
  const antGroup = new THREE.Group();
  antGroup.name = side > 0 ? 'earL' : 'earR';
  antGroup.position.set(side * 0.0072, 0.0145, 0.0085);

  // Subtle natural asymmetry between left & right antenna curls
  const asym = side > 0 ? 1.0 : 0.92;
  const liftAsym = side > 0 ? 0.003 : -0.002;

  const shaftCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(side * 0.0085, 0.0155, 0.008),
    new THREE.Vector3(side * 0.0225 * asym, 0.032 + liftAsym, 0.0145),
    new THREE.Vector3(side * 0.0365 * asym, 0.0435 + liftAsym, 0.0125),
    new THREE.Vector3(side * 0.0435 * asym, 0.0465 + liftAsym * 1.4, 0.0065)
  ]);

  const shaftGeo = createTaperedTube(THREE, shaftCurve, 22, 8, (t) => 0.00125 * (1 - t * 0.72) + 0.00018);
  const shaftMesh = new THREE.Mesh(shaftGeo, mats.fur);
  shaftMesh.userData.slot = 'fur';
  shaftMesh.castShadow = true;
  antGroup.add(shaftMesh);

  // Many fine curved feathery barbs (pectinate moth pinnae) branching along both sides
  const barbGeos = [];
  const barbPairs = 26;
  const worldUp = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < barbPairs; i++) {
    const t = 0.07 + (i / (barbPairs - 1)) * 0.89;
    const origin = shaftCurve.getPoint(t);
    const tangent = shaftCurve.getTangent(t).normalize();

    // Orthogonal frame for barb fan plane
    const sideDir = new THREE.Vector3().crossVectors(tangent, worldUp);
    if (sideDir.lengthSq() < 1e-6) sideDir.set(1, 0, 0);
    sideDir.normalize();
    const outDir = new THREE.Vector3().crossVectors(sideDir, tangent).normalize();

    // Lush feather-leaf length envelope
    const env = Math.pow(Math.sin(clamp((t - 0.03) / 0.96, 0, 1) * Math.PI), 0.72);
    const baseLen = 0.0018 + env * 0.0112;

    for (const bSide of [-1, 1]) {
      // Inner/outer barbs have slightly different lengths like real silk moth antennae
      const len = baseLen * (bSide === side ? 1.06 : 0.90);
      const dir = sideDir.clone().multiplyScalar(bSide * 0.88)
        .addScaledVector(tangent, 0.44)
        .addScaledVector(outDir, 0.22 + Math.sin(t * Math.PI) * 0.14)
        .normalize();

      const mid = origin.clone()
        .addScaledVector(dir, len * 0.54)
        .addScaledVector(outDir, len * 0.16);
      const tip = origin.clone()
        .addScaledVector(dir, len)
        .addScaledVector(tangent, len * 0.24)
        .addScaledVector(outDir, len * 0.28);

      const bCurve = new THREE.CatmullRomCurve3([origin, mid, tip]);
      const bGeo = createTaperedTube(
        THREE,
        bCurve,
        4,
        4,
        (u) => (0.00038 + env * 0.00018) * (1 - u * 0.78),
        false
      );
      barbGeos.push(bGeo);
    }
  }

  const mergedBarbs = mergeGeometries(THREE, barbGeos);
  for (const g of barbGeos) g.dispose();

  const barbsMesh = new THREE.Mesh(mergedBarbs, mats.antennaBarbs);
  barbsMesh.userData.slot = 'furAccent';
  barbsMesh.castShadow = true;
  antGroup.add(barbsMesh);

  return antGroup;
}

// ---------- SCULPTED HEAD & CHARMING FACE ----------

function buildHead(THREE, kit, mats, irisTex, blushTex) {
  const headGroup = new THREE.Group();
  headGroup.name = 'head';
  headGroup.position.set(0, 0.045, 0.043);
  // Gentle curious tilt for cozy charm
  headGroup.rotation.set(-0.06, 0.075, 0.085);

  // 1. Continuous sculpted chibi moth head with cheek bulges, fluffy crown, and recessed eye sockets
  const headGeo = new THREE.SphereGeometry(1, 52, 36);
  const hp = headGeo.attributes.position;

  const sockL = new THREE.Vector3(0.47, 0.08, 0.84).normalize();
  const sockR = new THREE.Vector3(-0.47, 0.08, 0.84).normalize();
  const vDir = new THREE.Vector3();

  for (let i = 0; i < hp.count; i++) {
    const sx = hp.getX(i), sy = hp.getY(i), sz = hp.getZ(i);
    vDir.set(sx, sy, sz).normalize();

    let rx = 0.0238;
    let ry = 0.0196;
    let rz = 0.0208;

    // Soft chibi cheek puffs (wider lower-side cheeks)
    const cheekMask = smoothstep(-0.55, -0.08, sy) * (1 - smoothstep(0.05, 0.55, sy)) * smoothstep(0.25, 0.85, Math.abs(sx));
    rx += cheekMask * 0.0036;
    rz += cheekMask * 0.0018;

    // Gentle muzzle / lower-face roundness
    const muzzleMask = smoothstep(0.55, 0.98, sz) * smoothstep(-0.65, -0.10, sy) * (1 - smoothstep(0.0, 0.35, sy));
    rz += muzzleMask * 0.0022;

    // Fluffy forehead / crown tuft
    const crownMask = smoothstep(0.50, 0.96, sy) * (1 - smoothstep(0.65, 0.95, Math.abs(sx)));
    const crownTuft = Math.sin(sx * 16) * 0.5 + 0.5;
    ry += crownMask * (0.0026 + crownTuft * 0.0018);

    // Subtle fluffy fur displacement across back, crown, and outer cheeks (smooth on face)
    const faceSmooth = smoothstep(0.52, 0.88, sz) * (1 - smoothstep(0.45, 0.82, Math.abs(sx)));
    const furNoise = (fbm(kit, sx * 3.5 + 2.2, sy * 3.5 + sz * 2.1, 3) - 0.5) * 0.0024 * (1 - faceSmooth * 0.85);
    rx += furNoise;
    ry += furNoise;
    rz += furNoise;

    // Slight eye socket indentation so the glossy eyes sit naturally inset on the surface
    const dL = vDir.dot(sockL);
    const dR = vDir.dot(sockR);
    const sockIndent = (smoothstep(0.86, 0.99, dL) + smoothstep(0.86, 0.99, dR)) * 0.0028;

    const x = sx * rx - vDir.x * sockIndent;
    const y = sy * ry - vDir.y * sockIndent;
    const z = sz * rz - vDir.z * sockIndent;
    hp.setXYZ(i, x, y, z);
  }
  headGeo.computeVertexNormals();

  const headMesh = new THREE.Mesh(headGeo, mats.fur);
  headMesh.userData.slot = 'fur';
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headGroup.add(headMesh);

  // 2. Large charming 3-layer eyes ("eyeL", "eyeR") slightly inset on the face
  const eyeDomeGeo = new THREE.SphereGeometry(0.0064, 28, 20);
  const irisCapGeo = new THREE.CircleGeometry(0.0056, 28);
  // Gently bow the iris disc to hug the front of the glossy eye dome
  const ip = irisCapGeo.attributes.position;
  for (let i = 0; i < ip.count; i++) {
    const ix = ip.getX(i), iy = ip.getY(i);
    const r2 = ix * ix + iy * iy;
    const zCurve = Math.sqrt(Math.max(0.00001, 0.00655 * 0.00655 - r2)) * 0.74;
    ip.setZ(i, zCurve);
  }
  irisCapGeo.computeVertexNormals();

  const hiBigGeo = new THREE.SphereGeometry(0.00145, 14, 10);
  const hiSmallGeo = new THREE.SphereGeometry(0.00072, 12, 8);

  const irisMat = new THREE.MeshPhysicalMaterial({
    map: irisTex,
    transparent: true,
    roughness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    depthWrite: false
  });
  const hiMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.35,
    roughness: 0.05,
    clearcoat: 1.0
  });

  for (const side of [1, -1]) {
    const eyeGroup = new THREE.Group();
    eyeGroup.name = side > 0 ? 'eyeL' : 'eyeR';
    eyeGroup.position.set(side * 0.0106, 0.0016, 0.0160);
    eyeGroup.rotation.set(-0.07, side * 0.44, 0);

    // Layer 1: dark glossy eyeball with clearcoat
    const ball = new THREE.Mesh(eyeDomeGeo, mats.eye);
    ball.scale.set(1.0, 1.08, 0.72);
    ball.userData.slot = 'eye';
    eyeGroup.add(ball);

    // Layer 2: coloured iris ring curving flush on front of eye
    const iris = new THREE.Mesh(irisCapGeo, irisMat);
    iris.scale.set(1.0, 1.08, 1.0);
    iris.position.z = 0.00012;
    eyeGroup.add(iris);

    // Layer 3: two crisp white highlight dots placed up and to one side (same light direction on both eyes)
    const hi1 = new THREE.Mesh(hiBigGeo, hiMat);
    hi1.scale.set(1.0, 1.15, 0.55);
    hi1.position.set(0.0018, 0.0023, 0.0044);
    eyeGroup.add(hi1);

    const hi2 = new THREE.Mesh(hiSmallGeo, hiMat);
    hi2.scale.set(1.0, 1.0, 0.55);
    hi2.position.set(-0.0017, -0.0020, 0.0044);
    eyeGroup.add(hi2);

    headGroup.add(eyeGroup);
  }

  // 3. Soft blush discs nestled flush against the curved cheeks
  const blushGeo = new THREE.CircleGeometry(0.0056, 20);
  const bp = blushGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const bx = bp.getX(i), by = bp.getY(i);
    bp.setZ(i, -(bx * bx + by * by) * 18);
  }
  blushGeo.computeVertexNormals();
  const blushMat = new THREE.MeshPhysicalMaterial({
    map: blushTex,
    transparent: true,
    roughness: 0.95,
    sheen: 0.5,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1
  });
  for (const side of [1, -1]) {
    const blush = new THREE.Mesh(blushGeo, blushMat);
    blush.position.set(side * 0.0156, -0.0046, 0.0148);
    blush.rotation.set(0.10, side * 0.68, 0);
    headGroup.add(blush);
  }

  // 4. Tiny cute sculpted nose bump + cozy curved mouth line + tiny fluffy labial palps
  const noseGeo = new THREE.SphereGeometry(0.0017, 16, 12);
  const np = noseGeo.attributes.position;
  for (let i = 0; i < np.count; i++) {
    np.setXYZ(i, np.getX(i) * 1.18, np.getY(i) * 0.78, np.getZ(i) * 0.85);
  }
  noseGeo.computeVertexNormals();
  const noseMesh = new THREE.Mesh(noseGeo, mats.nose);
  noseMesh.position.set(0, -0.0026, 0.0210);
  noseMesh.userData.slot = 'eye';
  headGroup.add(noseMesh);

  // Cute gentle "w" chibi moth smile made from a thin tapered tube
  const smileCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.0046, -0.0052, 0.0196),
    new THREE.Vector3(-0.0022, -0.0070, 0.0209),
    new THREE.Vector3(0.0, -0.0056, 0.0213),
    new THREE.Vector3(0.0022, -0.0070, 0.0209),
    new THREE.Vector3(0.0046, -0.0052, 0.0196)
  ]);
  const smileGeo = createTaperedTube(THREE, smileCurve, 18, 6, (t) => 0.00048 * (0.65 + 0.55 * Math.sin(t * Math.PI)));
  const smileMesh = new THREE.Mesh(smileGeo, mats.eye);
  smileMesh.userData.slot = 'eye';
  headGroup.add(smileMesh);

  // Tiny fluffy labial palps framing the smile (adorable silk-moth mouth puffs)
  for (const side of [1, -1]) {
    const palpCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.0052, -0.0082, 0.0175),
      new THREE.Vector3(side * 0.0042, -0.0102, 0.0208),
      new THREE.Vector3(side * 0.0024, -0.0094, 0.0220)
    ]);
    const palpGeo = createTaperedTube(THREE, palpCurve, 10, 8, (t) => 0.0018 * (1 - t * 0.35));
    const palp = new THREE.Mesh(palpGeo, mats.fur);
    palp.userData.slot = 'fur';
    headGroup.add(palp);
  }

  // 5. Feathery antennae ("earL", "earR")
  headGroup.add(buildAntenna(THREE, 1, mats));
  headGroup.add(buildAntenna(THREE, -1, mats));

  return headGroup;
}

// ---------- CURVED BEZIER WINGS WITH CRESCENT MOONS & LONG TAILS ----------

function createForewingShape(THREE) {
  const s = new THREE.Shape();
  s.moveTo(0.0, 0.012);
  // Sweeping falcate leading (costal) edge
  s.bezierCurveTo(0.032, 0.036, 0.088, 0.056, 0.136, 0.044);
  // Rounded falcate apex
  s.bezierCurveTo(0.144, 0.041, 0.143, 0.028, 0.132, 0.017);
  // Softly scalloped outer margin
  s.bezierCurveTo(0.120, 0.005, 0.114, -0.008, 0.105, -0.020);
  s.bezierCurveTo(0.096, -0.032, 0.085, -0.038, 0.071, -0.036);
  // Trailing margin back to thorax
  s.bezierCurveTo(0.047, -0.032, 0.021, -0.028, 0.0, -0.022);
  s.bezierCurveTo(-0.004, -0.010, -0.004, 0.003, 0.0, 0.012);
  return s;
}

function createHindwingShape(THREE) {
  const s = new THREE.Shape();
  s.moveTo(0.0, 0.002);
  // Upper margin tucked gracefully under the forewing
  s.bezierCurveTo(0.028, 0.005, 0.064, -0.002, 0.084, -0.018);
  // Rounded hindwing lobe
  s.bezierCurveTo(0.096, -0.030, 0.094, -0.052, 0.078, -0.066);
  // Outer edge narrowing into long flowing luna-moth tail
  s.bezierCurveTo(0.064, -0.078, 0.058, -0.095, 0.064, -0.115);
  // Flared soft ribbon tip of the tail
  s.bezierCurveTo(0.070, -0.133, 0.073, -0.145, 0.065, -0.149);
  s.bezierCurveTo(0.057, -0.152, 0.049, -0.140, 0.047, -0.124);
  // Inner edge of tail rising smoothly into anal margin
  s.bezierCurveTo(0.045, -0.102, 0.043, -0.082, 0.033, -0.068);
  s.bezierCurveTo(0.021, -0.054, 0.010, -0.046, 0.0, -0.036);
  s.bezierCurveTo(-0.003, -0.024, -0.003, -0.010, 0.0, 0.002);
  return s;
}

// Continuous 3D wing bending math (shared by the wing extrusion and its glowing spot inlays)
function bendWingPoint(x, yChord, zThick, isFore) {
  if (isFore) {
    const u = clamp(x / 0.142, 0, 1);
    const v = clamp((yChord + 0.038) / 0.088, 0, 1);
    // Gentle arched camber upward across span, soft relaxation & upturned falcate tip
    const spanArch = Math.sin(u * Math.PI * 0.88) * 0.0155;
    const tipCurl = Math.pow(u, 3.0) * 0.0065 * v;
    const chordDome = Math.sin(v * Math.PI) * 0.0048 * Math.sin(u * Math.PI);
    const veinAngle = Math.atan2(yChord - 0.004, x + 0.018);
    const veinRipple = Math.sin(veinAngle * 14) * 0.00055 * smoothstep(0.1, 0.9, u);

    // Slight graceful sweep back as span increases
    const wx = x * 0.985;
    const wy = zThick + spanArch + tipCurl + chordDome + veinRipple;
    const wz = yChord - u * u * 0.012;
    return [wx, wy, wz];
  } else {
    const u = clamp(x / 0.095, 0, 1);
    const v = clamp((yChord + 0.150) / 0.155, 0, 1);
    // Tail mask: 0 on main hindwing lobe, 1 along the long trailing tail
    const tailT = smoothstep(-0.062, -0.146, yChord);

    const lobeArch = Math.sin(u * Math.PI * 0.85) * 0.0095 * (1 - tailT * 0.75);
    const chordDome = Math.sin(clamp((yChord + 0.075) / 0.08, 0, 1) * Math.PI) * 0.0032 * u;

    // Graceful downward drape of the long tail so it rests softly near the floor + ribbon twist
    const tailDroop = -tailT * 0.025 + Math.pow(tailT, 3.2) * 0.0055;
    const tailSweepX = Math.sin(tailT * Math.PI * 0.85) * 0.0085;
    const twistAngle = tailT * 0.42;
    const tailCenterX = 0.056;
    const dxTail = x - tailCenterX;
    const twistY = dxTail * Math.sin(twistAngle) * tailT;
    const twistX = dxTail * (Math.cos(twistAngle) - 1) * tailT;

    const veinAngle = Math.atan2(yChord + 0.015, x + 0.012);
    const veinRipple = Math.sin(veinAngle * 12) * 0.00045 * u * (1 - tailT * 0.6);

    const wx = x + tailSweepX + twistX;
    const wy = zThick + lobeArch + chordDome + tailDroop + twistY + veinRipple;
    const wz = yChord;
    return [wx, wy, wz];
  }
}

function buildCurvedWingGeometry(THREE, shape, isFore) {
  const depth = 0.0014;
  const bevelT = 0.0008;
  const raw = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevelT,
    bevelSize: 0.0011,
    bevelSegments: 2,
    curveSegments: 16
  });

  // Compute 2D shape bounds before bending and normalize UVs cleanly to [0, 1]
  raw.computeBoundingBox();
  const bb = raw.boundingBox;
  const minX = bb.min.x, spanX = (bb.max.x - bb.min.x) || 1;
  const minY = bb.min.y, spanY = (bb.max.y - bb.min.y) || 1;

  const rPos = raw.attributes.position;
  const rUv = raw.attributes.uv;
  for (let i = 0; i < rPos.count; i++) {
    const px = rPos.getX(i);
    const py = rPos.getY(i);
    const pz = rPos.getZ(i) - depth * 0.5;
    rPos.setZ(i, pz);
    rUv.setXY(i, (px - minX) / spanX, (py - minY) / spanY);
  }

  // Watertight subdivision of broad cap triangles so the curved wing bends smoothly
  const sub = subdivideLongEdges(THREE, raw, 0.0125, 4);
  raw.dispose();

  // Apply 3D organic bending
  const pos = sub.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const [wx, wy, wz] = bendWingPoint(pos.getX(i), pos.getY(i), pos.getZ(i), isFore);
    pos.setXYZ(i, wx, wy, wz);
  }

  computeSmoothNormalsWelded(THREE, sub);
  return { geo: sub, bounds: { minX, spanX, minY, spanY }, topZ: depth * 0.5 + bevelT };
}

// Ultra-thin luminous crescent-moon & eye-spot inlays conforming to the bent wing surface (slot: "glow")
function buildWingGlowInlays(THREE, isFore, bounds, topZ) {
  const geos = [];
  const uToX = (u) => bounds.minX + u * bounds.spanX;
  const vToY = (v) => bounds.minY + v * bounds.spanY;

  const makeCrescentMeshGeo = (cu, cv, radU, rot) => {
    const cx = uToX(cu);
    const cy = vToY(cv);
    const r = radU * bounds.spanX;
    const shape = new THREE.Shape();
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI * 0.72 + (i / steps) * Math.PI * 1.44;
      const lx = Math.cos(a) * r;
      const ly = Math.sin(a) * r;
      const rx = lx * Math.cos(rot) - ly * Math.sin(rot) + cx;
      const ry = lx * Math.sin(rot) + ly * Math.cos(rot) + cy;
      if (i === 0) shape.moveTo(rx, ry);
      else shape.lineTo(rx, ry);
    }
    for (let i = steps; i >= 0; i--) {
      const a = -Math.PI * 0.60 + (i / steps) * Math.PI * 1.20;
      const lx = Math.cos(a) * r * 0.76 + r * 0.36;
      const ly = Math.sin(a) * r * 0.76;
      const rx = lx * Math.cos(rot) - ly * Math.sin(rot) + cx;
      const ry = lx * Math.sin(rot) + ly * Math.cos(rot) + cy;
      shape.lineTo(rx, ry);
    }
    shape.closePath();
    const g = new THREE.ShapeGeometry(shape, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const [wx, wy, wz] = bendWingPoint(p.getX(i), p.getY(i), topZ + 0.00042, isFore);
      p.setXYZ(i, wx, wy, wz);
    }
    g.computeVertexNormals();
    return g;
  };

  const makeDotGeo = (du, dv, radU) => {
    const cx = uToX(du);
    const cy = vToY(dv);
    const r = radU * bounds.spanX;
    const g = new THREE.CircleGeometry(r, 12);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const [wx, wy, wz] = bendWingPoint(p.getX(i) + cx, p.getY(i) + cy, topZ + 0.00042, isFore);
      p.setXYZ(i, wx, wy, wz);
    }
    g.computeVertexNormals();
    return g;
  };

  if (isFore) {
    // Eye-spot inner crescent + outer celestial crescent + starlight dots
    geos.push(makeCrescentMeshGeo(0.427, 0.543, 0.036, 0.45));
    geos.push(makeCrescentMeshGeo(0.71, 0.60, 0.068, 0.35));
    geos.push(makeDotGeo(0.77, 0.64, 0.011));
    geos.push(makeDotGeo(0.79, 0.59, 0.0075));
    geos.push(makeDotGeo(0.64, 0.54, 0.008));
  } else {
    // Hindwing eye-spot crescent + small outer crescent + luminous tail-tip moon-drop
    geos.push(makeCrescentMeshGeo(0.517, 0.752, 0.029, 0.45));
    geos.push(makeCrescentMeshGeo(0.66, 0.56, 0.045, 0.85));
    geos.push(makeDotGeo(0.64, 0.13, 0.015));
    geos.push(makeDotGeo(0.61, 0.20, 0.008));
  }

  const merged = mergeGeometries(THREE, geos);
  for (const g of geos) g.dispose();
  return merged;
}

function buildWings(THREE, mats) {
  const foreShape = createForewingShape(THREE);
  const hindShape = createHindwingShape(THREE);

  const foreData = buildCurvedWingGeometry(THREE, foreShape, true);
  const hindData = buildCurvedWingGeometry(THREE, hindShape, false);

  const foreGlowL = buildWingGlowInlays(THREE, true, foreData.bounds, foreData.topZ);
  const hindGlowL = buildWingGlowInlays(THREE, false, hindData.bounds, hindData.topZ);

  // Mirror geometries cleanly for the right wing pair
  const foreGeoR = foreData.geo.clone();
  mirrorGeometryX(foreGeoR);
  computeSmoothNormalsWelded(THREE, foreGeoR);

  const hindGeoR = hindData.geo.clone();
  mirrorGeometryX(hindGeoR);
  computeSmoothNormalsWelded(THREE, hindGeoR);

  const foreGlowR = foreGlowL.clone();
  mirrorGeometryX(foreGlowR);
  foreGlowR.computeVertexNormals();

  const hindGlowR = hindGlowL.clone();
  mirrorGeometryX(hindGlowR);
  hindGlowR.computeVertexNormals();

  const buildWingSide = (side, fGeo, hGeo, fGlow, hGlow) => {
    const group = new THREE.Group();
    group.name = side > 0 ? 'wingL' : 'wingR';
    group.position.set(side * 0.015, 0.041, 0.016);
    // Subtle natural resting asymmetry
    group.rotation.set(side > 0 ? 0.04 : 0.02, side * 0.03, side > 0 ? 0.05 : -0.025);

    const foreMesh = new THREE.Mesh(fGeo, mats.forewing);
    foreMesh.userData.slot = 'furAccent';
    foreMesh.castShadow = true;
    foreMesh.receiveShadow = true;
    group.add(foreMesh);

    const foreGlowMesh = new THREE.Mesh(fGlow, mats.glow);
    foreGlowMesh.userData.slot = 'glow';
    group.add(foreGlowMesh);

    const hindPivot = new THREE.Group();
    hindPivot.position.set(0, -0.0052, -0.005);
    hindPivot.rotation.set(0.03, -side * 0.04, -side * 0.02);

    const hindMesh = new THREE.Mesh(hGeo, mats.hindwing);
    hindMesh.userData.slot = 'furAccent';
    hindMesh.castShadow = true;
    hindMesh.receiveShadow = true;
    hindPivot.add(hindMesh);

    const hindGlowMesh = new THREE.Mesh(hGlow, mats.glow);
    hindGlowMesh.userData.slot = 'glow';
    hindPivot.add(hindGlowMesh);

    group.add(hindPivot);
    return group;
  };

  const wingL = buildWingSide(1, foreData.geo, hindData.geo, foreGlowL, hindGlowL);
  const wingR = buildWingSide(-1, foreGeoR, hindGeoR, foreGlowR, hindGlowR);
  return { wingL, wingR };
}

// ---------- COZY FLUFFY MOTH LEGS ("armL", "armR", "legL", "legR") ----------

function buildFluffyLeg(THREE, pts, baseR, tipR, mats) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = createTaperedTube(THREE, curve, 16, 10, (t) => {
    // Plush furry thigh tapering to a cute rounded mitten paw
    const puff = 1 + Math.sin(t * Math.PI * 0.8) * 0.16;
    const paw = smoothstep(0.82, 0.96, t) * 0.0007;
    return (baseR * (1 - t) + tipR * t) * puff + paw;
  });
  const mesh = new THREE.Mesh(geo, mats.fur);
  mesh.userData.slot = 'fur';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildLegs(THREE, mats) {
  // Front-left leg ("armL"): planted gently forward on the floor (y = 0)
  const armL = new THREE.Group();
  armL.name = 'armL';
  armL.position.set(0.011, 0.023, 0.030);
  armL.add(buildFluffyLeg(THREE, [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.006, -0.008, 0.013),
    new THREE.Vector3(0.008, -0.0185, 0.022),
    new THREE.Vector3(0.006, -0.0204, 0.028)
  ], 0.0044, 0.0024, mats));

  // Front-right leg ("armR"): adorably raised & curled near the cheek for gentle asymmetric pose!
  const armR = new THREE.Group();
  armR.name = 'armR';
  armR.position.set(-0.011, 0.024, 0.030);
  armR.add(buildFluffyLeg(THREE, [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.007, -0.004, 0.014),
    new THREE.Vector3(-0.005, 0.001, 0.024),
    new THREE.Vector3(-0.001, 0.0045, 0.027)
  ], 0.0044, 0.0024, mats));

  // Left mid & hind legs ("legL"): grounded firmly at y = 0
  const legL = new THREE.Group();
  legL.name = 'legL';
  legL.add(buildFluffyLeg(THREE, [
    new THREE.Vector3(0.013, 0.022, 0.012),
    new THREE.Vector3(0.023, 0.014, 0.015),
    new THREE.Vector3(0.028, 0.0045, 0.017),
    new THREE.Vector3(0.031, 0.0024, 0.018)
  ], 0.0046, 0.0023, mats));
  legL.add(buildFluffyLeg(THREE, [
    new THREE.Vector3(0.012, 0.020, -0.010),
    new THREE.Vector3(0.021, 0.012, -0.015),
    new THREE.Vector3(0.025, 0.0042, -0.020),
    new THREE.Vector3(0.027, 0.0024, -0.024)
  ], 0.0044, 0.0023, mats));

  // Right mid & hind legs ("legR"): grounded firmly at y = 0 with subtle stance asymmetry
  const legR = new THREE.Group();
  legR.name = 'legR';
  legR.add(buildFluffyLeg(THREE, [
    new THREE.Vector3(-0.013, 0.022, 0.010),
    new THREE.Vector3(-0.023, 0.014, 0.012),
    new THREE.Vector3(-0.028, 0.0045, 0.014),
    new THREE.Vector3(-0.031, 0.0024, 0.015)
  ], 0.0046, 0.0023, mats));
  legR.add(buildFluffyLeg(THREE, [
    new THREE.Vector3(-0.012, 0.020, -0.011),
    new THREE.Vector3(-0.020, 0.012, -0.017),
    new THREE.Vector3(-0.024, 0.0042, -0.022),
    new THREE.Vector3(-0.026, 0.0024, -0.026)
  ], 0.0044, 0.0023, mats));

  return { armL, armR, legL, legR };
}

// ---------- MAIN BUILD & IDLE EXPORTS ----------

export function build(THREE, opts = {}, kit) {
  const variantIdx = clamp(Math.floor(opts.variant ?? 0), 0, PALETTES.length - 1);
  const pal = PALETTES[variantIdx];

  const furCol = resolveColor(THREE, opts.fur, pal.fur);
  const accentCol = resolveColor(THREE, opts.furAccent, pal.furAccent);
  const eyeCol = resolveColor(THREE, opts.eye, pal.eye);
  const glowCol = resolveColor(THREE, opts.glow, pal.glow);

  const furSheenCol = furCol.clone().lerp(new THREE.Color('#ffffff'), 0.45);
  const wingSheenCol = accentCol.clone().lerp(new THREE.Color('#ffffff'), 0.48);

  const furTex = makeFurTextures(THREE, kit, furCol, accentCol);
  const foreTex = makeWingTextures(THREE, kit, true, furCol, accentCol, glowCol, eyeCol);
  const hindTex = makeWingTextures(THREE, kit, false, furCol, accentCol, glowCol, eyeCol);
  const irisTex = makeIrisTexture(THREE, kit, eyeCol, accentCol, glowCol);
  const blushTex = makeBlushTexture(THREE, kit, accentCol);

  const mats = {
    fur: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: furTex.map,
      bumpMap: furTex.bumpMap,
      bumpScale: 0.0018,
      roughness: 0.94,
      metalness: 0.0,
      sheen: 0.95,
      sheenRoughness: 0.62,
      sheenColor: furSheenCol
    }),
    antennaBarbs: new THREE.MeshPhysicalMaterial({
      color: accentCol.clone().lerp(furCol, 0.42),
      roughness: 0.90,
      metalness: 0.0,
      sheen: 0.88,
      sheenRoughness: 0.58,
      sheenColor: furSheenCol
    }),
    forewing: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: foreTex.map,
      bumpMap: foreTex.bumpMap,
      bumpScale: 0.0012,
      emissive: glowCol,
      emissiveMap: foreTex.emissiveMap,
      emissiveIntensity: 1.45,
      roughness: 0.88,
      metalness: 0.0,
      sheen: 0.78,
      sheenRoughness: 0.64,
      sheenColor: wingSheenCol
    }),
    hindwing: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: hindTex.map,
      bumpMap: hindTex.bumpMap,
      bumpScale: 0.0012,
      emissive: glowCol,
      emissiveMap: hindTex.emissiveMap,
      emissiveIntensity: 1.45,
      roughness: 0.88,
      metalness: 0.0,
      sheen: 0.78,
      sheenRoughness: 0.64,
      sheenColor: wingSheenCol
    }),
    glow: new THREE.MeshPhysicalMaterial({
      color: glowCol,
      emissive: glowCol,
      emissiveIntensity: 1.55,
      roughness: 0.35,
      metalness: 0.0,
      polygonOffset: true,
      polygonOffsetFactor: -1
    }),
    eye: new THREE.MeshPhysicalMaterial({
      color: eyeCol,
      roughness: 0.04,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03
    }),
    nose: new THREE.MeshPhysicalMaterial({
      color: eyeCol.clone().lerp(new THREE.Color('#c97a8b'), 0.45),
      roughness: 0.32,
      clearcoat: 0.55,
      clearcoatRoughness: 0.18
    })
  };

  const root = new THREE.Group();
  root.name = 'fluffy-moon-moth';

  const body = buildBody(THREE, kit, mats);
  const head = buildHead(THREE, kit, mats, irisTex, blushTex);
  const { wingL, wingR } = buildWings(THREE, mats);
  const { armL, armR, legL, legR } = buildLegs(THREE, mats);

  root.add(body);
  root.add(head);
  root.add(wingL);
  root.add(wingR);
  root.add(armL);
  root.add(armR);
  root.add(legL);
  root.add(legR);

  // Cache base poses for smooth, drift-free idle animation
  const earL = head.getObjectByName('earL');
  const earR = head.getObjectByName('earR');
  const tail = body.getObjectByName('tail');
  const eyeL = head.getObjectByName('eyeL');
  const eyeR = head.getObjectByName('eyeR');

  root.userData.anim = {
    body,
    head,
    wingL,
    wingR,
    earL,
    earR,
    armR,
    tail,
    eyeL,
    eyeR,
    rest: {
      bodyY: body.position.y,
      headRot: [head.rotation.x, head.rotation.y, head.rotation.z],
      headY: head.position.y,
      wingLRot: [wingL.rotation.x, wingL.rotation.y, wingL.rotation.z],
      wingRRot: [wingR.rotation.x, wingR.rotation.y, wingR.rotation.z],
      armRRot: [armR.rotation.x, armR.rotation.y, armR.rotation.z]
    }
  };

  return root;
}

export function idle(group, t) {
  const a = group.userData && group.userData.anim;
  if (!a) return;
  const r = a.rest;

  // Soft cozy breathing on body
  const breath = Math.sin(t * 1.85);
  a.body.scale.set(1 + breath * 0.015, 1 + breath * 0.022, 1 - breath * 0.008);
  a.body.position.y = r.bodyY + breath * 0.0007;

  // Gentle curious head sway and breath bob
  a.head.position.y = r.headY + breath * 0.0009;
  a.head.rotation.x = r.headRot[0] + Math.sin(t * 1.15) * 0.032;
  a.head.rotation.y = r.headRot[1] + Math.sin(t * 0.72) * 0.055;
  a.head.rotation.z = r.headRot[2] + Math.cos(t * 0.92) * 0.038;

  // Feathery antennae sensing the air with gentle asynchronous flutter
  if (a.earL && a.earR) {
    a.earL.rotation.x = Math.sin(t * 2.4) * 0.055 + Math.sin(t * 5.3) * 0.018;
    a.earL.rotation.z = Math.cos(t * 1.9) * 0.045;
    a.earR.rotation.x = Math.sin(t * 2.1 + 1.1) * 0.055 + Math.sin(t * 4.9 + 0.7) * 0.018;
    a.earR.rotation.z = -Math.cos(t * 1.7 + 0.8) * 0.045;
  }

  // Slow dreamy resting moth wing-wave (gentle lift and settle)
  const wingWave = Math.sin(t * 1.05);
  const wingWave2 = Math.sin(t * 2.1 + 0.4) * 0.25;
  const lift = (wingWave + wingWave2) * 0.055 + 0.035;
  a.wingL.rotation.z = r.wingLRot[2] + lift;
  a.wingR.rotation.z = r.wingRRot[2] - lift * 0.94;
  a.wingL.rotation.x = r.wingLRot[0] + Math.cos(t * 1.05) * 0.018;
  a.wingR.rotation.x = r.wingRRot[0] + Math.cos(t * 1.05 + 0.25) * 0.018;

  // Cozy raised front paw gentle wiggle & tail plume bob
  if (a.armR) {
    a.armR.rotation.x = r.armRRot[0] + Math.sin(t * 2.3) * 0.085;
    a.armR.rotation.z = r.armRRot[2] + Math.cos(t * 1.6) * 0.045;
  }
  if (a.tail) {
    a.tail.rotation.x = Math.sin(t * 1.85 - 0.8) * 0.055;
    a.tail.rotation.y = Math.cos(t * 0.95) * 0.035;
  }

  // Natural blink every ~3.8 seconds (with occasional gentle double-blink)
  if (a.eyeL && a.eyeR) {
    const period = 3.8;
    const phase = t % period;
    let blink = 1.0;
    if (phase < 0.17) {
      blink = 1.0 - Math.sin((phase / 0.17) * Math.PI) * 0.93;
    } else if (phase > 0.26 && phase < 0.41 && Math.floor(t / period) % 3 === 1) {
      blink = 1.0 - Math.sin(((phase - 0.26) / 0.15) * Math.PI) * 0.88;
    }
    a.eyeL.scale.y = blink;
    a.eyeR.scale.y = blink;
  }
}
export const META = {
  id: 'lop_eared_rabbit',
  name: 'Lop-Eared Rabbit',
  kind: 'creature',
  footprint: [0.20, 0.21],
  variants: ['Solid', 'Dutch', 'Spotted'],
  note: 'Hero-quality stylised sitting lop-eared rabbit (~0.30 m) with sculpted forms, one flopped ear, layered glossy eyes, painted fur coats, and lathe-turned collar charm.'
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function gauss(x, center, width) {
  const d = (x - center) / width;
  return Math.exp(-d * d);
}

function fbm(kit, x, y, octaves = 3) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * kit.noise(x * freq, y * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return sum / norm;
}

function getSrgb(THREE, c) {
  const col = c instanceof THREE.Color ? c : new THREE.Color(c);
  if (THREE.SRGBColorSpace && typeof col.getRGB === 'function') {
    const out = { r: 0, g: 0, b: 0 };
    col.getRGB(out, THREE.SRGBColorSpace);
    return out;
  }
  return { r: col.r, g: col.g, b: col.b };
}

function toCss(THREE, c, alpha = 1) {
  const rgb = getSrgb(THREE, c);
  const r = Math.round(clamp(rgb.r, 0, 1) * 255);
  const g = Math.round(clamp(rgb.g, 0, 1) * 255);
  const b = Math.round(clamp(rgb.b, 0, 1) * 255);
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha.toFixed(3)})` : `rgb(${r},${g},${b})`;
}

function mixCol(THREE, a, b, t) {
  const ca = a instanceof THREE.Color ? a.clone() : new THREE.Color(a);
  const cb = b instanceof THREE.Color ? b : new THREE.Color(b);
  return ca.lerp(cb, clamp(t, 0, 1));
}

function shiftCol(THREE, c, dh, ds, dl) {
  const col = c instanceof THREE.Color ? c.clone() : new THREE.Color(c);
  col.offsetHSL(dh, ds, dl);
  return col;
}

function createTaperedTube(THREE, curve, segments, radialSegments, radiusFn, opts = {}) {
  const capStart = opts.capStart !== false;
  const capEnd = opts.capEnd !== false;
  const ovalX = opts.ovalX ?? 1;
  const ovalY = opts.ovalY ?? 1;
  const frames = curve.computeFrenetFrames(segments, false);

  const rings = [];
  const capSteps = 3;

  if (capStart) {
    const p0 = curve.getPointAt(0);
    const t0 = frames.tangents[0];
    const n0 = frames.normals[0];
    const b0 = frames.binormals[0];
    const r0 = radiusFn(0);
    for (let k = capSteps; k >= 1; k--) {
      const ang = (k / capSteps) * (Math.PI * 0.5);
      const r = Math.max(1e-5, r0 * Math.cos(ang));
      const offset = -r0 * Math.sin(ang);
      rings.push({
        center: p0.clone().addScaledVector(t0, offset),
        normal: n0,
        binormal: b0,
        radius: r,
        v: 0
      });
    }
  }

  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    rings.push({
      center: curve.getPointAt(u),
      normal: frames.normals[i],
      binormal: frames.binormals[i],
      radius: Math.max(1e-5, radiusFn(u)),
      v: u
    });
  }

  if (capEnd) {
    const p1 = curve.getPointAt(1);
    const t1 = frames.tangents[segments];
    const n1 = frames.normals[segments];
    const b1 = frames.binormals[segments];
    const r1 = radiusFn(1);
    for (let k = 1; k <= capSteps; k++) {
      const ang = (k / capSteps) * (Math.PI * 0.5);
      const r = Math.max(1e-5, r1 * Math.cos(ang));
      const offset = r1 * Math.sin(ang);
      rings.push({
        center: p1.clone().addScaledVector(t1, offset),
        normal: n1,
        binormal: b1,
        radius: r,
        v: 1
      });
    }
  }

  const ringCount = rings.length;
  const stride = radialSegments + 1;
  const positions = new Float32Array(ringCount * stride * 3);
  const uvs = new Float32Array(ringCount * stride * 2);
  const indices = [];

  for (let i = 0; i < ringCount; i++) {
    const ring = rings[i];
    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const theta = u * Math.PI * 2;
      const cx = Math.cos(theta) * ring.radius * ovalX;
      const cy = Math.sin(theta) * ring.radius * ovalY;
      const idx = i * stride + j;
      positions[idx * 3] = ring.center.x + ring.normal.x * cx + ring.binormal.x * cy;
      positions[idx * 3 + 1] = ring.center.y + ring.normal.y * cx + ring.binormal.y * cy;
      positions[idx * 3 + 2] = ring.center.z + ring.normal.z * cx + ring.binormal.z * cy;
      uvs[idx * 2] = u;
      uvs[idx * 2 + 1] = ring.v;
    }
  }

  for (let i = 0; i < ringCount - 1; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, d, b, d, c, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function subdivideBufferGeometry(THREE, geo, maxEdgeLen, maxPasses = 3) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  for (let pass = 0; pass < maxPasses; pass++) {
    const pos = g.attributes.position.array;
    const uv = g.attributes.uv ? g.attributes.uv.array : null;
    const triCount = pos.length / 9;
    const outPos = [];
    const outUv = uv ? [] : null;
    let didSplit = false;

    const pushV = (p, u) => {
      outPos.push(p[0], p[1], p[2]);
      if (outUv && u) outUv.push(u[0], u[1]);
    };
    const emit = (p0, p1, p2, u0, u1, u2) => {
      pushV(p0, u0);
      pushV(p1, u1);
      pushV(p2, u2);
    };
    const mid3 = (a, b) => [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5];
    const mid2 = (a, b) => (a && b ? [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5] : null);
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

    for (let t = 0; t < triCount; t++) {
      const i = t * 9;
      const p0 = [pos[i], pos[i + 1], pos[i + 2]];
      const p1 = [pos[i + 3], pos[i + 4], pos[i + 5]];
      const p2 = [pos[i + 6], pos[i + 7], pos[i + 8]];
      const ui = t * 6;
      const u0 = uv ? [uv[ui], uv[ui + 1]] : null;
      const u1 = uv ? [uv[ui + 2], uv[ui + 3]] : null;
      const u2 = uv ? [uv[ui + 4], uv[ui + 5]] : null;

      const s01 = dist(p0, p1) > maxEdgeLen;
      const s12 = dist(p1, p2) > maxEdgeLen;
      const s20 = dist(p2, p0) > maxEdgeLen;
      const count = (s01 ? 1 : 0) + (s12 ? 1 : 0) + (s20 ? 1 : 0);

      if (count === 0) {
        emit(p0, p1, p2, u0, u1, u2);
      } else {
        didSplit = true;
        const m01 = s01 ? mid3(p0, p1) : null;
        const m12 = s12 ? mid3(p1, p2) : null;
        const m20 = s20 ? mid3(p2, p0) : null;
        const um01 = s01 ? mid2(u0, u1) : null;
        const um12 = s12 ? mid2(u1, u2) : null;
        const um20 = s20 ? mid2(u2, u0) : null;

        if (count === 3) {
          emit(p0, m01, m20, u0, um01, um20);
          emit(m01, p1, m12, um01, u1, um12);
          emit(m20, m12, p2, um20, um12, u2);
          emit(m01, m12, m20, um01, um12, um20);
        } else if (count === 1) {
          if (s01) {
            emit(p0, m01, p2, u0, um01, u2);
            emit(m01, p1, p2, um01, u1, u2);
          } else if (s12) {
            emit(p0, p1, m12, u0, u1, um12);
            emit(p0, m12, p2, u0, um12, u2);
          } else {
            emit(p0, p1, m20, u0, u1, um20);
            emit(m20, p1, p2, um20, u1, u2);
          }
        } else {
          if (s01 && s12) {
            emit(p0, m01, p2, u0, um01, u2);
            emit(m01, m12, p2, um01, um12, u2);
            emit(m01, p1, m12, um01, u1, um12);
          } else if (s12 && s20) {
            emit(p0, p1, m12, u0, u1, um12);
            emit(p0, m12, m20, u0, um12, um20);
            emit(m20, m12, p2, um20, um12, u2);
          } else {
            emit(p0, m01, m20, u0, um01, um20);
            emit(m01, p1, p2, um01, u1, u2);
            emit(m01, p2, m20, um01, u2, um20);
          }
        }
      }
    }

    const next = new THREE.BufferGeometry();
    next.setAttribute('position', new THREE.Float32BufferAttribute(outPos, 3));
    if (outUv) next.setAttribute('uv', new THREE.Float32BufferAttribute(outUv, 2));
    if (g !== geo) g.dispose();
    g = next;
    if (!didSplit) break;
  }
  return g;
}

function computeSmoothNormals(THREE, geo) {
  const pos = geo.attributes.position.array;
  const vCount = pos.length / 3;
  const normals = new Float32Array(pos.length);
  const accum = new Map();
  const keyOf = (x, y, z) => `${Math.round(x * 25000)},${Math.round(y * 25000)},${Math.round(z * 25000)}`;

  for (let i = 0; i < vCount; i += 3) {
    const i0 = i * 3;
    const i1 = (i + 1) * 3;
    const i2 = (i + 2) * 3;
    const ax = pos[i1] - pos[i0];
    const ay = pos[i1 + 1] - pos[i0 + 1];
    const az = pos[i1 + 2] - pos[i0 + 2];
    const bx = pos[i2] - pos[i0];
    const by = pos[i2 + 1] - pos[i0 + 1];
    const bz = pos[i2 + 2] - pos[i0 + 2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;

    for (const idx of [i0, i1, i2]) {
      const k = keyOf(pos[idx], pos[idx + 1], pos[idx + 2]);
      let acc = accum.get(k);
      if (!acc) {
        acc = [0, 0, 0];
        accum.set(k, acc);
      }
      acc[0] += nx;
      acc[1] += ny;
      acc[2] += nz;
    }
  }

  for (let i = 0; i < vCount; i++) {
    const idx = i * 3;
    const acc = accum.get(keyOf(pos[idx], pos[idx + 1], pos[idx + 2]));
    const len = Math.hypot(acc[0], acc[1], acc[2]) || 1;
    normals[idx] = acc[0] / len;
    normals[idx + 1] = acc[1] / len;
    normals[idx + 2] = acc[2] / len;
  }

  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return geo;
}

function drawFurStrokes(ctx, w, h, kit, THREE, baseCol, lightCol, darkCol, density = 2600, seed = 1) {
  const lightCss = toCss(THREE, lightCol, 0.24);
  const darkCss = toCss(THREE, darkCol, 0.22);
  const midCss = toCss(THREE, baseCol, 0.18);
  ctx.lineCap = 'round';
  for (let i = 0; i < density; i++) {
    const rx = kit.noise(i * 0.37 + seed * 11.3, seed * 3.1);
    const ry = kit.noise(seed * 7.7, i * 0.43 + seed * 5.9);
    const x = rx * w;
    const y = ry * h;
    const n = kit.noise(x * 0.025 + seed, y * 0.025 + seed * 2);
    const angle = (n - 0.5) * 0.48 + Math.PI * 0.5;
    const len = 5 + kit.noise(i * 0.71, seed) * 11;
    ctx.strokeStyle = n > 0.58 ? lightCss : n < 0.42 ? darkCss : midCss;
    ctx.lineWidth = 0.8 + (i % 3) * 0.45;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
}

function drawFeatheredBlob(ctx, cx, cy, rx, ry, rot, fillCss, kit, seed, steps = 44) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.fillStyle = fillCss;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const wobble = 0.78 + 0.42 * fbm(kit, Math.cos(a) * 1.9 + seed, Math.sin(a) * 1.9 + seed * 1.7, 3);
    const x = Math.cos(a) * rx * wobble;
    const y = Math.sin(a) * ry * wobble;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = fillCss;
  ctx.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    const wobble = 0.78 + 0.42 * fbm(kit, Math.cos(a) * 1.9 + seed, Math.sin(a) * 1.9 + seed * 1.7, 3);
    const x = Math.cos(a) * rx * wobble;
    const y = Math.sin(a) * ry * wobble;
    const len = 3 + kit.noise(i * 0.6 + seed, seed * 2) * 7;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len * 0.5, y + Math.abs(Math.sin(a)) * len + 2);
    ctx.stroke();
  }
  ctx.restore();
}

function makeFurBumpTexture(THREE, kit) {
  const tex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const n = fbm(kit, x * 0.03, y * 0.015, 3);
        const v = Math.round(112 + n * 34);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 4, 4);
      }
    }
    ctx.lineCap = 'round';
    for (let i = 0; i < 3600; i++) {
      const x = kit.noise(i * 0.29, 4.1) * w;
      const y = kit.noise(9.3, i * 0.31) * h;
      const n = kit.noise(x * 0.04, y * 0.04);
      const bright = n > 0.5 ? 168 : 92;
      ctx.strokeStyle = `rgba(${bright},${bright},${bright},0.35)`;
      ctx.lineWidth = 1.1;
      const ang = Math.PI * 0.5 + (n - 0.5) * 0.42;
      const len = 6 + kit.noise(i * 0.53, 1.7) * 10;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeHeadFurTexture(THREE, kit, furCol, accentCol, variant) {
  const furLight = shiftCol(THREE, furCol, 0, -0.05, 0.08);
  const furDark = shiftCol(THREE, furCol, 0, 0.04, -0.10);
  const accentDark = shiftCol(THREE, accentCol, 0, 0.02, -0.06);

  const tex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const base = variant === 2 ? accentCol : furCol;
    ctx.fillStyle = toCss(THREE, base);
    ctx.fillRect(0, 0, w, h);

    if (variant === 0) {
      // Darker crown & back, warmer softer muzzle & under-chin
      const crownGrad = ctx.createLinearGradient(0, 0, 0, h);
      crownGrad.addColorStop(0.0, toCss(THREE, furDark, 0.45));
      crownGrad.addColorStop(0.45, toCss(THREE, furCol, 0.0));
      crownGrad.addColorStop(0.82, toCss(THREE, accentCol, 0.55));
      crownGrad.addColorStop(1.0, toCss(THREE, accentCol, 0.72));
      ctx.fillStyle = crownGrad;
      ctx.fillRect(0, 0, w, h);

      // Soft lighter muzzle glow (u=0.5, v~0.42 -> y~0.58*h)
      const muz = ctx.createRadialGradient(w * 0.5, h * 0.60, w * 0.02, w * 0.5, h * 0.60, w * 0.19);
      muz.addColorStop(0, toCss(THREE, accentCol, 0.78));
      muz.addColorStop(0.65, toCss(THREE, mixCol(THREE, furLight, accentCol, 0.5), 0.35));
      muz.addColorStop(1, toCss(THREE, accentCol, 0));
      ctx.fillStyle = muz;
      ctx.fillRect(0, 0, w, h);

      // Gentle brow / eye ring warmth
      for (const sx of [0.38, 0.62]) {
        const er = ctx.createRadialGradient(w * sx, h * 0.46, 4, w * sx, h * 0.46, w * 0.085);
        er.addColorStop(0, toCss(THREE, furLight, 0.38));
        er.addColorStop(1, toCss(THREE, furLight, 0));
        ctx.fillStyle = er;
        ctx.fillRect(0, 0, w, h);
      }
      drawFurStrokes(ctx, w, h, kit, THREE, furCol, furLight, furDark, 2600, 1.3);
    } else if (variant === 1) {
      // Classic Dutch blaze: white muzzle, chin, and tapering blaze up between eyes
      const crownGrad = ctx.createLinearGradient(0, 0, 0, h);
      crownGrad.addColorStop(0, toCss(THREE, furDark, 0.35));
      crownGrad.addColorStop(0.6, toCss(THREE, furCol, 0));
      ctx.fillStyle = crownGrad;
      ctx.fillRect(0, 0, w, h);

      const accentCss = toCss(THREE, accentCol);
      ctx.fillStyle = accentCss;
      ctx.beginPath();
      ctx.moveTo(w * 0.50, h * 0.20);
      ctx.bezierCurveTo(w * 0.46, h * 0.34, w * 0.41, h * 0.50, w * 0.33, h * 0.63);
      ctx.bezierCurveTo(w * 0.25, h * 0.75, w * 0.14, h * 0.85, 0, h * 0.84);
      ctx.lineTo(0, h);
      ctx.lineTo(w, h);
      ctx.lineTo(w, h * 0.84);
      ctx.bezierCurveTo(w * 0.86, h * 0.85, w * 0.75, h * 0.75, w * 0.67, h * 0.63);
      ctx.bezierCurveTo(w * 0.59, h * 0.50, w * 0.54, h * 0.34, w * 0.50, h * 0.20);
      ctx.closePath();
      ctx.fill();

      // Feather Dutch edges with fur hairs
      ctx.lineCap = 'round';
      for (let i = 0; i < 240; i++) {
        const t = i / 240;
        const y = h * (0.22 + t * 0.62);
        const halfW = w * (0.01 + Math.pow(t, 1.35) * 0.24);
        for (const sgn of [-1, 1]) {
          const x = w * 0.5 + sgn * halfW + (kit.noise(i * 0.4, sgn + 3) - 0.5) * 8;
          ctx.strokeStyle = i % 2 === 0 ? accentCss : toCss(THREE, furCol);
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + sgn * 4, y + 6);
          ctx.stroke();
        }
      }
      drawFurStrokes(ctx, w, h, kit, THREE, furCol, accentCol, furDark, 2200, 2.7);
    } else {
      // Spotted / Broken Lop: cream base with asymmetric eye patch & cheek spot
      const backShade = ctx.createLinearGradient(0, 0, 0, h);
      backShade.addColorStop(0, toCss(THREE, accentDark, 0.22));
      backShade.addColorStop(0.7, toCss(THREE, accentCol, 0));
      ctx.fillStyle = backShade;
      ctx.fillRect(0, 0, w, h);

      const spotCss = toCss(THREE, furCol);
      // Charming patch around right eye & temple (u~0.37)
      drawFeatheredBlob(ctx, w * 0.36, h * 0.44, w * 0.115, h * 0.135, -0.25, spotCss, kit, 4.1);
      // Small crown/back spot near left ear base
      drawFeatheredBlob(ctx, w * 0.68, h * 0.26, w * 0.085, h * 0.085, 0.3, spotCss, kit, 8.2);
      // Cute subtle butterfly nose-bridge fleck
      drawFeatheredBlob(ctx, w * 0.52, h * 0.56, w * 0.042, h * 0.032, 0.1, spotCss, kit, 11.4);
      // Back-of-head spot
      drawFeatheredBlob(ctx, w * 0.04, h * 0.46, w * 0.09, h * 0.11, 0.1, spotCss, kit, 15.6);
      drawFeatheredBlob(ctx, w * 0.96, h * 0.46, w * 0.09, h * 0.11, -0.1, spotCss, kit, 15.6);
      drawFurStrokes(ctx, w, h, kit, THREE, accentCol, furLight, accentDark, 2300, 3.9);
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBodyFurTexture(THREE, kit, furCol, accentCol, variant) {
  const furLight = shiftCol(THREE, furCol, 0, -0.05, 0.08);
  const furDark = shiftCol(THREE, furCol, 0, 0.04, -0.11);
  const accentDark = shiftCol(THREE, accentCol, 0, 0.02, -0.07);

  const tex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const base = variant === 2 ? accentCol : furCol;
    ctx.fillStyle = toCss(THREE, base);
    ctx.fillRect(0, 0, w, h);

    if (variant === 0) {
      // Darker back (u near 0 and 1), soft lighter tummy & chest ruff (u near 0.5)
      const backLeft = ctx.createLinearGradient(0, 0, w * 0.36, 0);
      backLeft.addColorStop(0, toCss(THREE, furDark, 0.55));
      backLeft.addColorStop(1, toCss(THREE, furDark, 0));
      ctx.fillStyle = backLeft;
      ctx.fillRect(0, 0, w * 0.38, h);

      const backRight = ctx.createLinearGradient(w, 0, w * 0.64, 0);
      backRight.addColorStop(0, toCss(THREE, furDark, 0.55));
      backRight.addColorStop(1, toCss(THREE, furDark, 0));
      ctx.fillStyle = backRight;
      ctx.fillRect(w * 0.62, 0, w * 0.38, h);

      // Soft cream chest & tummy
      const belly = ctx.createRadialGradient(w * 0.5, h * 0.54, w * 0.04, w * 0.5, h * 0.54, w * 0.25);
      belly.addColorStop(0, toCss(THREE, accentCol, 0.85));
      belly.addColorStop(0.58, toCss(THREE, mixCol(THREE, furLight, accentCol, 0.55), 0.45));
      belly.addColorStop(1, toCss(THREE, accentCol, 0));
      ctx.fillStyle = belly;
      ctx.fillRect(0, 0, w, h);

      drawFurStrokes(ctx, w, h, kit, THREE, furCol, furLight, furDark, 3000, 5.1);
    } else if (variant === 1) {
      // Dutch saddle: upper chest/shoulders cream, lower haunches/rump coloured
      const beltY = h * 0.50;
      ctx.fillStyle = toCss(THREE, accentCol);
      ctx.fillRect(0, 0, w, beltY);

      // Slight dorsal dip at back
      const rumpGrad = ctx.createLinearGradient(0, beltY, 0, h);
      rumpGrad.addColorStop(0, toCss(THREE, furCol, 0.95));
      rumpGrad.addColorStop(0.75, toCss(THREE, furDark, 0.45));
      ctx.fillStyle = rumpGrad;
      ctx.fillRect(0, beltY, w, h - beltY);

      // Feathered Dutch saddle seam
      ctx.lineCap = 'round';
      for (let x = 0; x < w; x += 3) {
        const yOff = (kit.noise(x * 0.05, 8.2) - 0.5) * 14;
        ctx.strokeStyle = x % 6 === 0 ? toCss(THREE, accentCol) : toCss(THREE, furCol);
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(x, beltY + yOff - 5);
        ctx.lineTo(x, beltY + yOff + 8);
        ctx.stroke();
      }
      drawFurStrokes(ctx, w, h, kit, THREE, furCol, accentCol, furDark, 2600, 6.4);
    } else {
      // Spotted coat: organic saddle & flank spots
      const shade = ctx.createRadialGradient(w * 0.5, h * 0.55, w * 0.05, w * 0.5, h * 0.55, w * 0.45);
      shade.addColorStop(0, toCss(THREE, accentCol, 0));
      shade.addColorStop(1, toCss(THREE, accentDark, 0.25));
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, w, h);

      const spotCss = toCss(THREE, furCol);
      // Spine & rump spots (wrapping across u=0/1 seam cleanly)
      drawFeatheredBlob(ctx, w * 0.03, h * 0.46, w * 0.14, h * 0.16, 0.15, spotCss, kit, 19.2);
      drawFeatheredBlob(ctx, w * 1.03, h * 0.46, w * 0.14, h * 0.16, 0.15, spotCss, kit, 19.2);
      drawFeatheredBlob(ctx, w * 0.92, h * 0.68, w * 0.11, h * 0.12, -0.2, spotCss, kit, 23.1);
      drawFeatheredBlob(ctx, w * 0.22, h * 0.62, w * 0.10, h * 0.11, 0.35, spotCss, kit, 27.4);
      drawFeatheredBlob(ctx, w * 0.77, h * 0.36, w * 0.085, h * 0.095, -0.3, spotCss, kit, 31.8);
      drawFurStrokes(ctx, w, h, kit, THREE, accentCol, furLight, accentDark, 2600, 7.2);
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeLimbFurTexture(THREE, kit, furCol, accentCol, variant, kind) {
  const furLight = shiftCol(THREE, furCol, 0, -0.04, 0.07);
  const furDark = shiftCol(THREE, furCol, 0, 0.04, -0.09);

  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    let base = furCol;
    if (variant === 1 && kind === 'arm') base = accentCol;
    if (variant === 2) base = accentCol;

    ctx.fillStyle = toCss(THREE, base);
    ctx.fillRect(0, 0, w, h);

    if (kind === 'foot') {
      if (variant === 1) {
        // Dutch white socks at front toes (u around 0.5, lower-front)
        const sock = ctx.createRadialGradient(w * 0.5, h * 0.55, w * 0.04, w * 0.5, h * 0.55, w * 0.28);
        sock.addColorStop(0, toCss(THREE, accentCol, 1));
        sock.addColorStop(0.7, toCss(THREE, accentCol, 0.95));
        sock.addColorStop(1, toCss(THREE, accentCol, 0));
        ctx.fillStyle = sock;
        ctx.fillRect(0, 0, w, h);
      } else if (variant === 0) {
        const tip = ctx.createRadialGradient(w * 0.5, h * 0.55, 4, w * 0.5, h * 0.55, w * 0.30);
        tip.addColorStop(0, toCss(THREE, accentCol, 0.48));
        tip.addColorStop(1, toCss(THREE, accentCol, 0));
        ctx.fillStyle = tip;
        ctx.fillRect(0, 0, w, h);
      }
    } else if (kind === 'haunch' && variant === 2) {
      drawFeatheredBlob(ctx, w * 0.62, h * 0.45, w * 0.22, h * 0.24, 0.2, toCss(THREE, furCol), kit, 41.2);
    } else if (kind === 'arm' && variant === 0) {
      // Soft lighter paw tips
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, toCss(THREE, furDark, 0.25));
      g.addColorStop(0.65, toCss(THREE, furCol, 0));
      g.addColorStop(1, toCss(THREE, accentCol, 0.65));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    drawFurStrokes(ctx, w, h, kit, THREE, base, furLight, furDark, 900, kind.length * 4.3);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeEarOuterTexture(THREE, kit, furCol, accentCol, variant, isLeft) {
  const furLight = shiftCol(THREE, furCol, 0, -0.04, 0.07);
  const furDark = shiftCol(THREE, furCol, 0, 0.04, -0.12);

  const tex = kit.canvasTexture(256, 512, (ctx, w, h) => {
    const useSpotted = variant === 2 && isLeft;
    const base = useSpotted ? accentCol : furCol;
    ctx.fillStyle = toCss(THREE, base);
    ctx.fillRect(0, 0, w, h);

    // Subtle darker velvety ear tip gradient
    const tipGrad = ctx.createLinearGradient(0, h, 0, 0);
    tipGrad.addColorStop(0, toCss(THREE, furLight, 0.22));
    tipGrad.addColorStop(0.55, toCss(THREE, base, 0));
    tipGrad.addColorStop(1, toCss(THREE, furDark, useSpotted ? 0.22 : 0.48));
    ctx.fillStyle = tipGrad;
    ctx.fillRect(0, 0, w, h);

    if (useSpotted) {
      drawFeatheredBlob(ctx, w * 0.52, h * 0.22, w * 0.42, h * 0.26, 0.1, toCss(THREE, furCol), kit, 52.3);
    }
    drawFurStrokes(ctx, w, h, kit, THREE, base, furLight, furDark, 1400, isLeft ? 8.1 : 9.4);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeInnerEarTexture(THREE, kit, skinCol, furCol) {
  const warmPink = shiftCol(THREE, skinCol, -0.01, 0.06, -0.04);
  const softPeach = shiftCol(THREE, skinCol, 0.01, -0.04, 0.07);
  const tex = kit.canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = toCss(THREE, softPeach);
    ctx.fillRect(0, 0, w, h);

    const g = ctx.createRadialGradient(w * 0.5, h * 0.56, w * 0.06, w * 0.5, h * 0.52, h * 0.52);
    g.addColorStop(0, toCss(THREE, warmPink, 0.92));
    g.addColorStop(0.62, toCss(THREE, softPeach, 0.85));
    g.addColorStop(1, toCss(THREE, mixCol(THREE, softPeach, furCol, 0.45), 0.95));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    drawFurStrokes(ctx, w, h, kit, THREE, softPeach, shiftCol(THREE, softPeach, 0, 0, 0.08), warmPink, 700, 12.6);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeEyeIrisTexture(THREE, kit, eyeCol) {
  const irisBase = eyeCol instanceof THREE.Color ? eyeCol.clone() : new THREE.Color(eyeCol);
  const irisBright = shiftCol(THREE, irisBase, 0.015, 0.14, 0.18);
  const irisDeep = shiftCol(THREE, irisBase, -0.01, 0.08, -0.22);

  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const r = w * 0.48;

    // Deep glossy dark backdrop
    ctx.fillStyle = '#0e0908';
    ctx.fillRect(0, 0, w, h);

    // Rich coloured iris disc
    const irisGrad = ctx.createRadialGradient(cx, cy + r * 0.12, r * 0.25, cx, cy, r * 0.88);
    irisGrad.addColorStop(0, toCss(THREE, irisBright));
    irisGrad.addColorStop(0.55, toCss(THREE, irisBase));
    irisGrad.addColorStop(0.86, toCss(THREE, irisDeep));
    irisGrad.addColorStop(1, '#120b09');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2);
    ctx.fill();

    // Soft warm lower crescent bounce inside iris
    const bounce = ctx.createRadialGradient(cx, cy + r * 0.32, r * 0.04, cx, cy + r * 0.26, r * 0.42);
    bounce.addColorStop(0, toCss(THREE, shiftCol(THREE, irisBright, 0.02, 0.1, 0.14), 0.72));
    bounce.addColorStop(1, toCss(THREE, irisBright, 0));
    ctx.fillStyle = bounce;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
    ctx.fill();

    // Subtle radial iris fibres
    ctx.lineCap = 'round';
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const n = kit.noise(Math.cos(a) * 3 + 2, Math.sin(a) * 3 + 2);
      ctx.strokeStyle = n > 0.5 ? toCss(THREE, irisBright, 0.28) : toCss(THREE, irisDeep, 0.35);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.48, cy + Math.sin(a) * r * 0.48);
      ctx.lineTo(cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82);
      ctx.stroke();
    }

    // Large adorable dark pupil
    const pupil = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 0.56);
    pupil.addColorStop(0, '#070505');
    pupil.addColorStop(0.88, '#0c0807');
    pupil.addColorStop(1, 'rgba(12,8,7,0)');
    ctx.fillStyle = pupil;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.56, 0, Math.PI * 2);
    ctx.fill();
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBlushTexture(THREE, kit, skinCol) {
  const blush = shiftCol(THREE, skinCol, -0.02, 0.22, -0.04);
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 2, w * 0.5, h * 0.5, w * 0.48);
    g.addColorStop(0, toCss(THREE, blush, 0.72));
    g.addColorStop(0.55, toCss(THREE, blush, 0.34));
    g.addColorStop(1, toCss(THREE, blush, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeFabricTextures(THREE, kit, baseCol, isKnit) {
  const light = shiftCol(THREE, baseCol, 0, -0.04, 0.09);
  const dark = shiftCol(THREE, baseCol, 0, 0.05, -0.10);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = toCss(THREE, baseCol);
    ctx.fillRect(0, 0, w, h);
    if (isKnit) {
      // Cozy ribbed knit V-stitches
      const colW = 16;
      const rowH = 12;
      ctx.lineCap = 'round';
      for (let y = 0; y < h + rowH; y += rowH) {
        for (let x = 0; x < w + colW; x += colW) {
          const n = kit.noise(x * 0.06, y * 0.06);
          ctx.strokeStyle = n > 0.5 ? toCss(THREE, light, 0.45) : toCss(THREE, dark, 0.4);
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.moveTo(x + 2, y);
          ctx.lineTo(x + colW * 0.5, y + rowH * 0.85);
          ctx.lineTo(x + colW - 2, y);
          ctx.stroke();
        }
      }
    } else {
      // Soft woven velvet/cotton ribbon weave
      for (let y = 0; y < h; y += 4) {
        ctx.fillStyle = y % 8 === 0 ? toCss(THREE, light, 0.14) : toCss(THREE, dark, 0.12);
        ctx.fillRect(0, y, w, 2);
      }
      for (let x = 0; x < w; x += 4) {
        ctx.fillStyle = x % 8 === 0 ? toCss(THREE, light, 0.12) : toCss(THREE, dark, 0.10);
        ctx.fillRect(x, 0, 2, h);
      }
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    if (isKnit) {
      const colW = 16;
      const rowH = 12;
      ctx.lineCap = 'round';
      for (let y = 0; y < h + rowH; y += rowH) {
        for (let x = 0; x < w + colW; x += colW) {
          ctx.strokeStyle = '#c8c8c8';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(x + 2, y);
          ctx.lineTo(x + colW * 0.5, y + rowH * 0.85);
          ctx.lineTo(x + colW - 2, y);
          ctx.stroke();
        }
      }
    } else {
      for (let y = 0; y < h; y += 4) {
        ctx.fillStyle = y % 8 === 0 ? '#9c9c9c' : '#686868';
        ctx.fillRect(0, y, w, 2);
      }
      for (let x = 0; x < w; x += 4) {
        ctx.fillStyle = x % 8 === 0 ? 'rgba(180,180,180,0.4)' : 'rgba(90,90,90,0.4)';
        ctx.fillRect(x, 0, 2, h);
      }
    }
  });
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  return { map, bump };
}

function makeWoodTexture(THREE, kit, woodCol) {
  const dark = shiftCol(THREE, woodCol, -0.01, 0.05, -0.15);
  const light = shiftCol(THREE, woodCol, 0.01, -0.04, 0.08);
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = toCss(THREE, woodCol);
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      const n = fbm(kit, 2.3, y * 0.04, 3);
      const ring = Math.sin(y * 0.25 + n * 7.0);
      ctx.fillStyle = ring > 0 ? toCss(THREE, light, 0.25) : toCss(THREE, dark, 0.35);
      ctx.fillRect(0, y, w, 2);
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Continuous sculpted head surface function (shared by geometry and facial attachment placement)
function sampleHeadPoint(nx, ny, nz, kit) {
  let x = nx * 0.055;
  let y = ny * 0.050;
  let z = nz * 0.054;

  // Plump Holland-lop lower cheeks & softly tapered forehead crown
  const cheekMask = gauss(ny, -0.22, 0.36) * smoothstep(-0.25, 0.72, nz);
  x *= 1 + 0.21 * cheekMask;
  z += 0.0045 * cheekMask;

  const crownTaper = smoothstep(0.18, 0.95, ny);
  x *= 1 - 0.13 * crownTaper;
  z *= 1 - 0.07 * crownTaper;

  // Slightly fuller rounded occiput (back of head)
  const backHead = gauss(ny, 0.05, 0.45) * smoothstep(-0.2, -0.9, nz);
  z -= 0.004 * backHead;

  // Integrated muzzle + twin whisker pads + subtle philtrum cleft
  const muzzle = gauss(ny, -0.17, 0.27) * gauss(nx, 0, 0.34) * smoothstep(0.35, 0.95, nz);
  z += 0.0165 * muzzle;
  y -= 0.0025 * muzzle;

  const padL = gauss(nx, 0.155, 0.145) * gauss(ny, -0.23, 0.15) * smoothstep(0.55, 0.98, nz);
  const padR = gauss(nx, -0.155, 0.145) * gauss(ny, -0.23, 0.15) * smoothstep(0.55, 0.98, nz);
  z += 0.0065 * (padL + padR);
  y -= 0.0018 * (padL + padR);

  const cleft = gauss(nx, 0, 0.055) * gauss(ny, -0.26, 0.14) * smoothstep(0.72, 0.98, nz);
  z -= 0.0022 * cleft;

  // Soft chin under muzzle
  const chin = gauss(nx, 0, 0.25) * gauss(ny, -0.48, 0.18) * smoothstep(0.32, 0.92, nz);
  z += 0.0045 * chin;

  // Sculpted eye sockets (symmetric)
  const dSqL = (nx - 0.45) ** 2 + (ny - 0.09) ** 2 + (nz - 0.888) ** 2;
  const dSqR = (nx + 0.45) ** 2 + (ny - 0.09) ** 2 + (nz - 0.888) ** 2;
  const socket = Math.exp(-dSqL / 0.042) + Math.exp(-dSqR / 0.042);
  x -= nx * 0.0052 * socket;
  y -= ny * 0.0052 * socket;
  z -= nz * 0.0052 * socket;

  // Gentle brow cushion above sockets
  const bSqL = (nx - 0.37) ** 2 + (ny - 0.30) ** 2 + (nz - 0.878) ** 2;
  const bSqR = (nx + 0.37) ** 2 + (ny - 0.30) ** 2 + (nz - 0.878) ** 2;
  const brow = Math.exp(-bSqL / 0.055) + Math.exp(-bSqR / 0.055);
  z += 0.0026 * brow;
  y += 0.0012 * brow;

  // Deep neck transition skirt sinking smoothly into upper torso
  const neckSkirt = smoothstep(-0.54, -0.96, ny);
  y -= 0.022 * neckSkirt;
  x *= 1 - 0.16 * neckSkirt;
  z *= 1 - 0.16 * neckSkirt;

  // Subtle organic plushness
  const puff = (fbm(kit, nx * 2.2 + 4.1, ny * 2.2 + nz * 1.4 + 2.7, 2) - 0.5) * 0.0016;
  x += nx * puff;
  y += ny * puff;
  z += nz * puff;

  // Offset so head group pivots naturally at neck
  return [x, y + 0.041, z + 0.009];
}

function sampleHeadFrame(THREE, dir, kit) {
  const n = dir.clone().normalize();
  const p = new THREE.Vector3(...sampleHeadPoint(n.x, n.y, n.z, kit));
  const up = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const t1 = new THREE.Vector3().crossVectors(up, n).normalize();
  const t2 = new THREE.Vector3().crossVectors(n, t1).normalize();
  const eps = 0.02;
  const n1 = n.clone().addScaledVector(t1, eps).normalize();
  const n2 = n.clone().addScaledVector(t2, eps).normalize();
  const p1 = new THREE.Vector3(...sampleHeadPoint(n1.x, n1.y, n1.z, kit));
  const p2 = new THREE.Vector3(...sampleHeadPoint(n2.x, n2.y, n2.z, kit));
  const normal = new THREE.Vector3().crossVectors(p1.sub(p), p2.sub(p)).normalize();
  if (normal.dot(n) < 0) normal.negate();
  return { pos: p, normal };
}

function buildHeadGeometry(THREE, kit) {
  const geo = new THREE.SphereGeometry(1, 64, 48, -Math.PI * 0.5, Math.PI * 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);
    const [x, y, z] = sampleHeadPoint(nx, ny, nz, kit);
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildBodyGeometry(THREE, kit) {
  const geo = new THREE.SphereGeometry(1, 56, 40, -Math.PI * 0.5, Math.PI * 2);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    const widthScale = 1.0 + 0.16 * gauss(ny, -0.34, 0.45) - 0.34 * smoothstep(0.12, 0.95, ny);
    const depthScale = 1.0 + 0.14 * gauss(ny, -0.30, 0.45) - 0.30 * smoothstep(0.16, 0.95, ny);

    let x = nx * 0.062 * widthScale;
    let y = ny * 0.086;
    let z = nz * 0.066 * depthScale;

    // Upright bunny posture: gentle forward shoulder lean, curved lower back, cozy tummy
    z += 0.017 * smoothstep(0.0, 0.95, ny);
    z -= 0.013 * gauss(ny, -0.24, 0.45) * smoothstep(0.0, -0.9, nz);
    z += 0.012 * gauss(ny, -0.22, 0.42) * smoothstep(0.1, 0.95, nz);

    // Soft fluffy chest ruff / dewlap under chin
    const chestRuff = gauss(nx, 0, 0.48) * gauss(ny, 0.42, 0.28) * smoothstep(0.32, 0.95, nz);
    z += 0.014 * chestRuff;
    y += 0.0035 * chestRuff;

    // Gentle organic softness
    const puff = (fbm(kit, nx * 2.0 + 1.3, ny * 2.0 + nz * 1.5 + 6.4, 2) - 0.5) * 0.0022;
    x += nx * puff;
    y += ny * puff;
    z += nz * puff;

    // Place bottom resting solidly on floor y = 0 with gently flattened haunch underside
    y += 0.083;
    if (y < 0.016) {
      const t = smoothstep(0.016, -0.012, y);
      y = y * (1 - t) + 0.0015 * t;
      x *= 1 + 0.045 * t;
      z *= 1 + 0.035 * t;
    }

    pos.setXYZ(i, x, y, z - 0.004);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildHaunchGeometry(THREE, kit, side) {
  // side: +1 for left (+x), -1 for right (-x)
  const geo = new THREE.SphereGeometry(1, 48, 32, -Math.PI * 0.5, Math.PI * 2);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    let x = nx * 0.036;
    let y = ny * 0.044;
    let z = nz * 0.048;

    // Teardrop sitting thigh: fuller at lower back, tapering softly toward knee/front
    const frontTaper = smoothstep(-0.1, 0.95, nz);
    y *= 1 - 0.22 * frontTaper;
    x *= 1 - 0.14 * frontTaper;
    y -= 0.009 * frontTaper;

    // Flatten inner face so it blends deeply into the body without a ball seam
    const inner = smoothstep(0.0, 0.85, -side * nx);
    x *= 1 - 0.28 * inner;

    // Plush outer hip contour
    const outer = gauss(ny, -0.15, 0.45) * smoothstep(0.1, 0.9, side * nx);
    x += side * 0.0045 * outer;

    const puff = (fbm(kit, nx * 2.4 + side * 3, ny * 2.4 + nz * 1.8, 2) - 0.5) * 0.0018;
    x += nx * puff;
    y += ny * puff;
    z += nz * puff;

    // Flatten resting underside to kiss floor (leg pivot is at y = 0.044)
    if (y < -0.034) {
      const t = smoothstep(-0.034, -0.048, y);
      y = y * (1 - t) + -0.0425 * t;
    }

    pos.setXYZ(i, x, y, z - 0.006);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildHindFootGeometry(THREE, kit) {
  const geo = new THREE.SphereGeometry(1, 48, 32, -Math.PI * 0.5, Math.PI * 2);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    // Long plush bunny hind paw
    let x = nx * 0.021;
    let y = ny * 0.0155;
    let z = nz * 0.041;

    // Narrow heel, softly wider rounded forefoot
    const forefoot = smoothstep(-0.3, 0.85, nz);
    x *= 0.82 + 0.34 * forefoot;
    y *= 0.92 + 0.18 * gauss(nz, 0.15, 0.55);

    // Subtle sculpted 3-toe plush lobes at front tip
    const tipMask = smoothstep(0.55, 0.98, nz) * gauss(ny, -0.05, 0.55);
    const toeWave = Math.cos(nx * Math.PI * 3.1) * 0.5 + 0.5;
    z += 0.0032 * tipMask * toeWave;
    y += 0.0015 * tipMask * toeWave;

    // Flat floor-contact sole
    if (ny < 0) {
      y *= 0.52;
    }

    const puff = (fbm(kit, nx * 3.0 + 2.1, nz * 3.0 + 5.2, 2) - 0.5) * 0.0009;
    x += nx * puff;
    y += ny * puff;
    z += nz * puff;

    // Positioned under haunch so sole rests at world y = 0.001 (leg pivot y = 0.044)
    pos.setXYZ(i, x, y - 0.0345, z + 0.036);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildTailGeometry(THREE, kit) {
  const geo = new THREE.SphereGeometry(1, 48, 32, -Math.PI * 0.5, Math.PI * 2);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    // Soft multi-lobe cotton puff silhouette
    const lobes =
      0.08 * Math.sin(nx * 5.2 + 0.5) * Math.cos(ny * 4.8) +
      0.07 * Math.cos(nz * 5.5 + ny * 3.2) +
      0.11 * (fbm(kit, nx * 2.8 + 4.0, ny * 2.8 + nz * 2.5 + 1.5, 3) - 0.5);

    const r = 1 + lobes;
    let x = nx * 0.031 * r;
    let y = ny * 0.033 * r;
    let z = nz * 0.034 * r;

    // Slightly pointed fluffy tip tilting upward
    const backTip = smoothstep(-0.1, -0.95, nz);
    y += 0.006 * backTip;
    x *= 1 - 0.14 * backTip;

    // Taper base slightly where it nests into lower back
    const base = smoothstep(0.2, 0.95, nz);
    x *= 1 - 0.20 * base;
    y *= 1 - 0.18 * base;

    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function createEarShape(THREE, length, halfWidth) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(halfWidth * 0.42, 0, halfWidth * 0.88, length * 0.18, halfWidth, length * 0.46);
  s.bezierCurveTo(halfWidth * 1.06, length * 0.72, halfWidth * 0.76, length * 0.97, 0, length);
  s.bezierCurveTo(-halfWidth * 0.76, length * 0.97, -halfWidth * 1.06, length * 0.72, -halfWidth, length * 0.46);
  s.bezierCurveTo(-halfWidth * 0.88, length * 0.18, -halfWidth * 0.42, 0, 0, 0);
  return s;
}

function bendExtrudedEar(THREE, rawGeo, length, halfWidth, spineCurve, refInwardVec, cupAmount, zOffset = 0, taperThickness = true) {
  const geo = subdivideBufferGeometry(THREE, rawGeo, 0.0072, 3);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  // Determine raw z center
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const midZ = (minZ + maxZ) * 0.5;

  const P = new THREE.Vector3();
  const T = new THREE.Vector3();
  const X = new THREE.Vector3();
  const Z = new THREE.Vector3();
  const refIn = refInwardVec.clone().normalize();

  for (let i = 0; i < pos.count; i++) {
    const ox = pos.getX(i);
    const oy = pos.getY(i);
    const oz = pos.getZ(i) - midZ;

    const s = clamp(oy / length, 0, 1);
    spineCurve.getPointAt(s, P);
    spineCurve.getTangentAt(s, T).normalize();

    // Positive-determinant orthonormal frame: X x T = +Z (preserves CCW winding)
    X.crossVectors(T, refIn);
    if (X.lengthSq() < 1e-6) X.set(1, 0, 0);
    X.normalize();
    Z.crossVectors(X, T).normalize();

    const widthRatio = clamp(ox / halfWidth, -1.2, 1.2);
    const cup = cupAmount * widthRatio * widthRatio * Math.sin(Math.PI * Math.pow(s, 0.85));
    const thickScale = taperThickness ? 1.0 - 0.42 * s : 1.0;
    const zEff = oz * thickScale + cup + zOffset * (1.0 - 0.32 * s);

    // Slight gentle plush curl at tip
    const vx = P.x + X.x * ox + Z.x * zEff;
    const vy = P.y + X.y * ox + Z.y * zEff;
    const vz = P.z + X.z * ox + Z.z * zEff;
    pos.setXYZ(i, vx, vy, vz);

    if (uv) {
      uv.setXY(i, clamp(0.5 + ox / (halfWidth * 2.2), 0.01, 0.99), clamp(s, 0.01, 0.99));
    }
  }

  computeSmoothNormals(THREE, geo);
  return geo;
}

function buildLopEarGroup(THREE, isLeft, outerMat, innerMat) {
  const group = new THREE.Group();
  group.name = isLeft ? 'earL' : 'earR';

  const length = isLeft ? 0.094 : 0.122;
  const halfWidth = isLeft ? 0.0195 : 0.0215;

  const spine = isLeft
    ? new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.0, 0.0, 0.0),
        new THREE.Vector3(0.008, 0.026, -0.002),
        new THREE.Vector3(0.018, 0.056, 0.001),
        new THREE.Vector3(0.028, 0.078, 0.012),
        new THREE.Vector3(0.036, 0.088, 0.026)
      ])
    : new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.0, 0.0, 0.0),
        new THREE.Vector3(-0.021, 0.012, -0.002),
        new THREE.Vector3(-0.044, -0.008, 0.004),
        new THREE.Vector3(-0.050, -0.044, 0.016),
        new THREE.Vector3(-0.046, -0.082, 0.031),
        new THREE.Vector3(-0.038, -0.100, 0.044)
      ]);

  const refIn = isLeft
    ? new THREE.Vector3(-0.22, -0.10, 0.97)
    : new THREE.Vector3(0.76, -0.08, 0.64);

  const outerShape = createEarShape(THREE, length, halfWidth);
  const outerRaw = new THREE.ExtrudeGeometry(outerShape, {
    depth: 0.0042,
    bevelEnabled: true,
    bevelThickness: 0.0032,
    bevelSize: 0.0030,
    bevelSegments: 4,
    curveSegments: 22
  });
  const outerGeo = bendExtrudedEar(THREE, outerRaw, length, halfWidth, spine, refIn, 0.0062, 0, true);
  outerRaw.dispose();

  const outerMesh = new THREE.Mesh(outerGeo, outerMat);
  outerMesh.userData.slot = 'fur';
  outerMesh.castShadow = true;
  outerMesh.receiveShadow = true;
  group.add(outerMesh);

  // Soft velvet inner-ear liner nestled cleanly inside concave scoop
  const innerLen = length * 0.78;
  const innerHW = halfWidth * 0.64;
  const innerShape = createEarShape(THREE, innerLen, innerHW);
  const innerRaw = new THREE.ExtrudeGeometry(innerShape, {
    depth: 0.0010,
    bevelEnabled: true,
    bevelThickness: 0.0008,
    bevelSize: 0.0012,
    bevelSegments: 2,
    curveSegments: 16
  });
  innerRaw.translate(0, length * 0.11, 0);
  const innerGeo = bendExtrudedEar(THREE, innerRaw, length, halfWidth, spine, refIn, 0.0060, 0.0046, true);
  innerRaw.dispose();

  const innerMesh = new THREE.Mesh(innerGeo, innerMat);
  innerMesh.userData.slot = 'skin';
  innerMesh.receiveShadow = true;
  group.add(innerMesh);

  return group;
}

function buildEyeGroup(THREE, side, irisMat, corneaMat, dotMat, lashMat) {
  const group = new THREE.Group();
  group.name = side > 0 ? 'eyeL' : 'eyeR';

  // Layer 1 + 2: Glossy deep eye with painted coloured iris ring & dark pupil
  const eyeGeo = new THREE.SphereGeometry(0.0114, 28, 20);
  eyeGeo.scale(0.95, 1.08, 0.72);
  // Rotate so pole-to-pole UV isn't on front; map planar front UVs for crisp circular iris
  const pos = eyeGeo.attributes.position;
  const uv = eyeGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    uv.setXY(i, clamp(0.5 + x / (0.0114 * 1.95), 0.01, 0.99), clamp(0.5 + y / (0.0114 * 2.2), 0.01, 0.99));
  }
  const irisMesh = new THREE.Mesh(eyeGeo, irisMat);
  irisMesh.userData.slot = 'eye';
  group.add(irisMesh);

  // Layer 2b: Clear glossy wet cornea glaze over front hemisphere
  const corneaGeo = new THREE.SphereGeometry(0.0118, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62);
  corneaGeo.rotateX(Math.PI * 0.5);
  corneaGeo.scale(0.95, 1.08, 0.74);
  const corneaMesh = new THREE.Mesh(corneaGeo, corneaMat);
  group.add(corneaMesh);

  // Layer 3: Two crisp white catchlight dots placed consistently up and to viewer's left
  const dot1Geo = new THREE.SphereGeometry(0.0026, 12, 10);
  dot1Geo.scale(1.0, 1.15, 0.45);
  const dot1 = new THREE.Mesh(dot1Geo, dotMat);
  dot1.position.set(0.0035, 0.0045, 0.0072);
  group.add(dot1);

  const dot2Geo = new THREE.SphereGeometry(0.00125, 10, 8);
  dot2Geo.scale(1.0, 1.0, 0.45);
  const dot2 = new THREE.Mesh(dot2Geo, dotMat);
  dot2.position.set(-0.0026, -0.0030, 0.0076);
  group.add(dot2);

  // Subtle upper eyelid / lash accent line framing the eye
  const lashCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-side * 0.0078, 0.0055, 0.0036),
    new THREE.Vector3(0.0, 0.0114, 0.0034),
    new THREE.Vector3(side * 0.0086, 0.0068, 0.0028),
    new THREE.Vector3(side * 0.0108, 0.0044, 0.0016)
  ]);
  const lashGeo = createTaperedTube(THREE, lashCurve, 14, 8, (t) => 0.0005 + 0.00065 * Math.sin(Math.PI * t));
  const lash = new THREE.Mesh(lashGeo, lashMat);
  group.add(lash);

  return group;
}

function buildNoseAndMouth(THREE, kit, skinCol) {
  const faceGroup = new THREE.Group();

  // Sculpted cute rounded-triangle bunny nose
  const noseGeo = new THREE.SphereGeometry(1, 24, 18);
  const np = noseGeo.attributes.position;
  for (let i = 0; i < np.count; i++) {
    const nx = np.getX(i);
    const ny = np.getY(i);
    const nz = np.getZ(i);
    // Wider along top edge, gently tapered to cute rounded point at bottom
    const topWiden = 1.0 + 0.28 * smoothstep(-0.3, 0.7, ny);
    let x = nx * 0.0056 * topWiden;
    let y = ny * 0.0038;
    let z = nz * 0.0038;
    // Slight adorable V-dimple at top center
    const dip = gauss(nx, 0, 0.35) * smoothstep(0.1, 0.9, ny);
    y -= 0.0008 * dip;
    // Tiny subtle nostril indentations
    const nost = (gauss(nx, 0.42, 0.22) + gauss(nx, -0.42, 0.22)) * gauss(ny, -0.25, 0.35) * smoothstep(0.2, 0.9, nz);
    z -= 0.0007 * nost;
    np.setXYZ(i, x, y, z);
  }
  noseGeo.computeVertexNormals();

  const noseMat = new THREE.MeshPhysicalMaterial({
    color: shiftCol(THREE, skinCol, -0.01, 0.14, -0.07),
    roughness: 0.42,
    clearcoat: 0.55,
    clearcoatRoughness: 0.28,
    sheen: 0.25,
    sheenColor: shiftCol(THREE, skinCol, 0, 0, 0.15)
  });

  const noseFrame = sampleHeadFrame(THREE, new THREE.Vector3(0, -0.145, 0.989), kit);
  const nosePivot = new THREE.Group();
  nosePivot.name = 'nose';
  nosePivot.position.copy(noseFrame.pos).addScaledVector(noseFrame.normal, 0.0014);
  const noseMesh = new THREE.Mesh(noseGeo, noseMat);
  noseMesh.userData.slot = 'skin';
  noseMesh.castShadow = true;
  nosePivot.add(noseMesh);
  faceGroup.add(nosePivot);

  // Curved "Y" / "w" bunny mouth made from fine tapered tubes hugging muzzle
  const mouthMat = new THREE.MeshPhysicalMaterial({
    color: 0x4b3128,
    roughness: 0.72,
    clearcoat: 0.15
  });

  const projectMuzzle = (dx, dy, lift = 0.0007) => {
    const f = sampleHeadFrame(THREE, new THREE.Vector3(dx, dy, 1.0), kit);
    return f.pos.addScaledVector(f.normal, lift);
  };

  const stemCurve = new THREE.CatmullRomCurve3([
    projectMuzzle(0, -0.19, 0.0006),
    projectMuzzle(0, -0.24, 0.0009),
    projectMuzzle(0, -0.285, 0.0009)
  ]);
  const stemGeo = createTaperedTube(THREE, stemCurve, 10, 8, (t) => 0.00085 - 0.00012 * t);
  faceGroup.add(new THREE.Mesh(stemGeo, mouthMat));

  for (const sgn of [-1, 1]) {
    const smileCurve = new THREE.CatmullRomCurve3([
      projectMuzzle(0, -0.285, 0.0009),
      projectMuzzle(sgn * 0.065, -0.325, 0.0009),
      projectMuzzle(sgn * 0.135, -0.315, 0.0009),
      projectMuzzle(sgn * 0.185, -0.275, 0.0007)
    ]);
    const smileGeo = createTaperedTube(THREE, smileCurve, 14, 8, (t) => 0.00085 * (1 - 0.35 * t));
    faceGroup.add(new THREE.Mesh(smileGeo, mouthMat));
  }

  // Six delicate tapered-tube whiskers curving from whisker pads
  const whiskerMat = new THREE.MeshPhysicalMaterial({
    color: 0xf4eee6,
    roughness: 0.45,
    sheen: 0.5,
    sheenColor: 0xffffff
  });

  const whiskerSpecs = [
    { dy: -0.18, spread: 0.006, droop: -0.003, len: 0.038 },
    { dy: -0.23, spread: 0.0, droop: -0.007, len: 0.043 },
    { dy: -0.28, spread: -0.005, droop: -0.011, len: 0.035 }
  ];

  for (const sgn of [-1, 1]) {
    for (const w of whiskerSpecs) {
      const root = sampleHeadFrame(THREE, new THREE.Vector3(sgn * 0.21, w.dy, 0.96), kit);
      const p0 = root.pos.clone().addScaledVector(root.normal, -0.002);
      const p1 = p0.clone().add(new THREE.Vector3(sgn * w.len * 0.36, w.spread * 0.4, 0.006));
      const p2 = p0.clone().add(new THREE.Vector3(sgn * w.len * 0.72, w.spread + w.droop * 0.45, 0.004));
      const p3 = p0.clone().add(new THREE.Vector3(sgn * w.len, w.spread + w.droop, -0.002));
      const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
      const wGeo = createTaperedTube(THREE, curve, 12, 6, (t) => 0.00052 * (1 - 0.78 * t));
      faceGroup.add(new THREE.Mesh(wGeo, whiskerMat));
    }
  }

  // Subtle curved cheek blush discs
  const blushMap = makeBlushTexture(THREE, kit, skinCol);
  const blushMat = new THREE.MeshPhysicalMaterial({
    map: blushMap,
    transparent: true,
    opacity: 0.58,
    roughness: 0.95,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1
  });

  for (const sgn of [-1, 1]) {
    const f = sampleHeadFrame(THREE, new THREE.Vector3(sgn * 0.56, -0.15, 0.81), kit);
    const discGeo = new THREE.CircleGeometry(0.0115, 20);
    // Curve disc gently backward around cheek radius
    const dp = discGeo.attributes.position;
    for (let i = 0; i < dp.count; i++) {
      const dx = dp.getX(i);
      const dy = dp.getY(i);
      const r2 = dx * dx + dy * dy;
      dp.setZ(i, -r2 * 14.0);
    }
    discGeo.computeVertexNormals();
    const disc = new THREE.Mesh(discGeo, blushMat);
    disc.userData.slot = 'skin';
    disc.position.copy(f.pos).addScaledVector(f.normal, 0.0012);
    disc.lookAt(f.pos.clone().add(f.normal));
    faceGroup.add(disc);
  }

  return { faceGroup, nosePivot };
}

function buildLatheBell(THREE, accentMat) {
  // 20-point rotational profile for a cozy miniature brass collar bell
  const pts = [
    new THREE.Vector2(0.0001, 0.0135),
    new THREE.Vector2(0.0024, 0.0132),
    new THREE.Vector2(0.0028, 0.0116),
    new THREE.Vector2(0.0016, 0.0108),
    new THREE.Vector2(0.0038, 0.0102),
    new THREE.Vector2(0.0062, 0.0092),
    new THREE.Vector2(0.0079, 0.0074),
    new THREE.Vector2(0.0086, 0.0052),
    new THREE.Vector2(0.0091, 0.0044),
    new THREE.Vector2(0.0091, 0.0036),
    new THREE.Vector2(0.0085, 0.0030),
    new THREE.Vector2(0.0079, 0.0012),
    new THREE.Vector2(0.0066, -0.0008),
    new THREE.Vector2(0.0048, -0.0022),
    new THREE.Vector2(0.0026, -0.0030),
    new THREE.Vector2(0.0016, -0.0026),
    new THREE.Vector2(0.0022, -0.0014),
    new THREE.Vector2(0.0018, -0.0002),
    new THREE.Vector2(0.0008, 0.0004),
    new THREE.Vector2(0.0001, 0.0005)
  ];
  const geo = new THREE.LatheGeometry(pts, 28);
  const mesh = new THREE.Mesh(geo, accentMat);
  mesh.userData.slot = 'accent';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildLatheWoodButton(THREE, woodMat) {
  // 18-point rotational profile for a cozy carved wooden scarf button
  const pts = [
    new THREE.Vector2(0.0001, 0.0028),
    new THREE.Vector2(0.0032, 0.0027),
    new THREE.Vector2(0.0058, 0.0022),
    new THREE.Vector2(0.0074, 0.0026),
    new THREE.Vector2(0.0088, 0.0031),
    new THREE.Vector2(0.0098, 0.0028),
    new THREE.Vector2(0.0104, 0.0019),
    new THREE.Vector2(0.0106, 0.0006),
    new THREE.Vector2(0.0105, -0.0008),
    new THREE.Vector2(0.0100, -0.0018),
    new THREE.Vector2(0.0088, -0.0026),
    new THREE.Vector2(0.0072, -0.0029),
    new THREE.Vector2(0.0054, -0.0030),
    new THREE.Vector2(0.0036, -0.0031),
    new THREE.Vector2(0.0024, -0.0038),
    new THREE.Vector2(0.0020, -0.0046),
    new THREE.Vector2(0.0010, -0.0048),
    new THREE.Vector2(0.0001, -0.0048)
  ];
  const geo = new THREE.LatheGeometry(pts, 24);
  geo.rotateX(Math.PI * 0.5);
  const mesh = new THREE.Mesh(geo, woodMat);
  mesh.userData.slot = 'accent';
  mesh.castShadow = true;
  return mesh;
}

function buildBowLoopGeometry(THREE, side) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(side * 0.007, 0.009, side * 0.021, 0.014, side * 0.025, 0.006);
  s.bezierCurveTo(side * 0.028, -0.001, side * 0.024, -0.011, side * 0.014, -0.010);
  s.bezierCurveTo(side * 0.006, -0.009, side * 0.002, -0.003, 0, 0);

  const raw = new THREE.ExtrudeGeometry(s, {
    depth: 0.0035,
    bevelEnabled: true,
    bevelThickness: 0.0018,
    bevelSize: 0.0016,
    bevelSegments: 3,
    curveSegments: 16
  });
  const geo = subdivideBufferGeometry(THREE, raw, 0.0055, 2);
  raw.dispose();

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i) - 0.00175;
    const dist = Math.abs(x) / 0.026;
    // Curve loop softly backward around neck and puff center
    const bendZ = -0.0075 * dist * dist + 0.0028 * Math.sin(dist * Math.PI);
    const pinchY = y * (0.45 + 0.55 * smoothstep(0, 0.45, dist));
    pos.setXYZ(i, x, pinchY, z * (0.7 + 0.5 * dist) + bendZ);
  }
  computeSmoothNormals(THREE, geo);
  return geo;
}

function buildAccessory(THREE, kit, accessoryType, primaryCol, accentCol) {
  if (!accessoryType || accessoryType === 'none') return null;

  const group = new THREE.Group();
  group.name = 'accessory';

  if (accessoryType === 'scarf') {
    const { map, bump } = makeFabricTextures(THREE, kit, primaryCol, true);
    map.repeat.set(3, 1);
    bump.repeat.set(3, 1);
    const scarfMat = new THREE.MeshPhysicalMaterial({
      map,
      bumpMap: bump,
      bumpScale: 0.0025,
      roughness: 0.94,
      sheen: 0.88,
      sheenRoughness: 0.72,
      sheenColor: shiftCol(THREE, primaryCol, 0, -0.05, 0.24)
    });

    // Cozy wrapped knit neckband
    const ringPts = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const rx = 0.044;
      const rz = 0.048;
      ringPts.push(new THREE.Vector3(Math.sin(a) * rx, 0.149 - 0.007 * Math.cos(a), 0.015 + Math.cos(a) * rz));
    }
    const ringCurve = new THREE.CatmullRomCurve3(ringPts, true);
    const ringGeo = createTaperedTube(
      THREE,
      ringCurve,
      40,
      14,
      (t) => 0.0125 + 0.0018 * Math.sin(t * Math.PI * 4),
      { capStart: false, capEnd: false, ovalX: 1.15, ovalY: 0.85 }
    );
    const ringMesh = new THREE.Mesh(ringGeo, scarfMat);
    ringMesh.userData.slot = 'primary';
    ringMesh.castShadow = true;
    ringMesh.receiveShadow = true;
    group.add(ringMesh);

    // Draped knit scarf tail over left chest
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.022, 0.146, 0.056),
      new THREE.Vector3(0.028, 0.128, 0.068),
      new THREE.Vector3(0.024, 0.100, 0.072),
      new THREE.Vector3(0.019, 0.078, 0.069)
    ]);
    const tailGeo = createTaperedTube(
      THREE,
      tailCurve,
      20,
      12,
      (t) => 0.0105 + 0.0022 * t,
      { ovalX: 1.45, ovalY: 0.55 }
    );
    const tailMesh = new THREE.Mesh(tailGeo, scarfMat);
    tailMesh.userData.slot = 'primary';
    tailMesh.castShadow = true;
    group.add(tailMesh);

    // Lathe-turned wooden button accent
    const woodCol = new THREE.Color('#9a6b43');
    const woodMat = new THREE.MeshPhysicalMaterial({
      map: makeWoodTexture(THREE, kit, woodCol),
      roughness: 0.52,
      clearcoat: 0.25,
      clearcoatRoughness: 0.45
    });
    const button = buildLatheWoodButton(THREE, woodMat);
    button.position.set(0.021, 0.137, 0.069);
    button.rotation.set(0.18, 0.32, 0);
    group.add(button);

    return group;
  }

  // Default cozy velvet ribbon collar + extruded bow + lathe-turned brass bell
  const { map, bump } = makeFabricTextures(THREE, kit, primaryCol, false);
  map.repeat.set(4, 1);
  bump.repeat.set(4, 1);
  const ribbonMat = new THREE.MeshPhysicalMaterial({
    map,
    bumpMap: bump,
    bumpScale: 0.0012,
    roughness: 0.86,
    sheen: 0.92,
    sheenRoughness: 0.62,
    sheenColor: shiftCol(THREE, primaryCol, 0, -0.05, 0.28)
  });

  const bellMat = new THREE.MeshPhysicalMaterial({
    color: accentCol,
    metalness: 0.82,
    roughness: 0.24,
    clearcoat: 0.6,
    clearcoatRoughness: 0.18
  });

  // Collar ribbon wrapping cleanly around neck seam
  const collarPts = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    collarPts.push(new THREE.Vector3(Math.sin(a) * 0.043, 0.150 - 0.006 * Math.cos(a), 0.015 + Math.cos(a) * 0.047));
  }
  const collarCurve = new THREE.CatmullRomCurve3(collarPts, true);
  const collarGeo = createTaperedTube(THREE, collarCurve, 40, 12, () => 0.0052, {
    capStart: false,
    capEnd: false,
    ovalX: 1.45,
    ovalY: 0.55
  });
  const collarMesh = new THREE.Mesh(collarGeo, ribbonMat);
  collarMesh.userData.slot = 'primary';
  collarMesh.castShadow = true;
  collarMesh.receiveShadow = true;
  group.add(collarMesh);

  // Cute off-center sculpted bow
  const bowGroup = new THREE.Group();
  bowGroup.position.set(0.014, 0.143, 0.062);
  bowGroup.rotation.set(0.16, 0.28, -0.08);

  const loopL = new THREE.Mesh(buildBowLoopGeometry(THREE, 1), ribbonMat);
  loopL.userData.slot = 'primary';
  loopL.castShadow = true;
  bowGroup.add(loopL);

  const loopR = new THREE.Mesh(buildBowLoopGeometry(THREE, -1), ribbonMat);
  loopR.userData.slot = 'primary';
  loopR.castShadow = true;
  bowGroup.add(loopR);

  const knotGeo = new THREE.SphereGeometry(0.0052, 16, 12);
  knotGeo.scale(1.05, 1.15, 0.85);
  const knot = new THREE.Mesh(knotGeo, ribbonMat);
  knot.userData.slot = 'secondary';
  bowGroup.add(knot);

  // Two softly draping ribbon ends
  for (const sgn of [-1, 1]) {
    const endCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sgn * 0.002, -0.002, 0.001),
      new THREE.Vector3(sgn * 0.008, -0.014, 0.004),
      new THREE.Vector3(sgn * 0.015, -0.028, 0.001)
    ]);
    const endGeo = createTaperedTube(THREE, endCurve, 12, 8, (t) => 0.0032 + 0.0012 * t, {
      ovalX: 1.5,
      ovalY: 0.38
    });
    const endMesh = new THREE.Mesh(endGeo, ribbonMat);
    endMesh.userData.slot = 'primary';
    endMesh.castShadow = true;
    bowGroup.add(endMesh);
  }
  group.add(bowGroup);

  // Lathe-turned antique brass bell hanging at front center
  const bell = buildLatheBell(THREE, bellMat);
  bell.position.set(-0.002, 0.130, 0.065);
  bell.rotation.set(-0.22, 0, 0.05);
  group.add(bell);

  return group;
}

export function build(THREE, opts = {}, kit) {
  const furCol = new THREE.Color(opts.fur ?? '#c7a07a');
  const accentCol = new THREE.Color(opts.furAccent ?? '#f5ede2');
  const eyeCol = new THREE.Color(opts.eye ?? '#5b341c');
  const variant = Number.isInteger(opts.variant) ? clamp(opts.variant, 0, 2) : 0;
  const accessoryOpt = opts.accessory === undefined ? 'ribbon' : opts.accessory;
  const skinCol = new THREE.Color(opts.skin ?? '#e5aba3');
  const primaryCol = new THREE.Color(opts.primary ?? '#b65b55');
  const charmCol = new THREE.Color(opts.accent ?? '#dab35e');

  const root = new THREE.Group();
  root.name = 'lop_eared_rabbit';

  // Shared fur bump map & sheen colour
  const furBump = makeFurBumpTexture(THREE, kit);
  const sheenTint = mixCol(THREE, furCol, accentCol, 0.7);

  const makeFurMat = (map, bumpRepeatX = 2, bumpRepeatY = 2) => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map,
      bumpMap: furBump,
      bumpScale: 0.0022,
      roughness: 0.93,
      metalness: 0.0,
      sheen: 0.88,
      sheenRoughness: 0.72,
      sheenColor: sheenTint
    });
    if (bumpRepeatX !== 1 || bumpRepeatY !== 1) {
      mat.bumpMap.repeat.set(bumpRepeatX, bumpRepeatY);
    }
    return mat;
  };

  // === BODY GROUP ===
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'body';
  root.add(bodyGroup);

  const bodyMat = makeFurMat(makeBodyFurTexture(THREE, kit, furCol, accentCol, variant));
  const bodyMesh = new THREE.Mesh(buildBodyGeometry(THREE, kit), bodyMat);
  bodyMesh.userData.slot = 'fur';
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyGroup.add(bodyMesh);

  // === HIND LEGS & HAUNCHES ===
  const haunchMat = makeFurMat(makeLimbFurTexture(THREE, kit, furCol, accentCol, variant, 'haunch'));
  const footMat = makeFurMat(makeLimbFurTexture(THREE, kit, furCol, accentCol, variant, 'foot'));
  const footGeo = buildHindFootGeometry(THREE, kit);

  const legs = {};
  for (const side of [1, -1]) {
    const legGroup = new THREE.Group();
    legGroup.name = side > 0 ? 'legL' : 'legR';
    legGroup.position.set(side * 0.043, 0.044, -0.002);
    legGroup.rotation.y = side * 0.24;

    const haunch = new THREE.Mesh(buildHaunchGeometry(THREE, kit, side), haunchMat);
    haunch.userData.slot = 'fur';
    haunch.castShadow = true;
    haunch.receiveShadow = true;
    legGroup.add(haunch);

    const foot = new THREE.Mesh(footGeo, footMat);
    foot.userData.slot = 'fur';
    foot.castShadow = true;
    foot.receiveShadow = true;
    legGroup.add(foot);

    bodyGroup.add(legGroup);
    legs[legGroup.name] = legGroup;
  }

  // === FRONT ARMS / PAWS (Tapered Tubes) ===
  const armMat = makeFurMat(makeLimbFurTexture(THREE, kit, furCol, accentCol, variant, 'arm'));

  // Right arm: cozy resting paw nestled gently on upper tummy
  const armR = new THREE.Group();
  armR.name = 'armR';
  armR.position.set(-0.036, 0.125, 0.015);
  const armRCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.012, 0.008, -0.014),
    new THREE.Vector3(-0.006, -0.016, 0.022),
    new THREE.Vector3(0.004, -0.044, 0.046),
    new THREE.Vector3(0.012, -0.052, 0.056)
  ]);
  const armRGeo = createTaperedTube(
    THREE,
    armRCurve,
    24,
    14,
    (t) => 0.020 * (1 - 0.34 * t) + 0.0036 * gauss(t, 0.90, 0.16),
    { ovalX: 1.08, ovalY: 0.92 }
  );
  const armRMesh = new THREE.Mesh(armRGeo, armMat);
  armRMesh.userData.slot = 'fur';
  armRMesh.castShadow = true;
  armRMesh.receiveShadow = true;
  armR.add(armRMesh);
  bodyGroup.add(armR);

  // Left arm: playfully lifted curious paw
  const armL = new THREE.Group();
  armL.name = 'armL';
  armL.position.set(0.036, 0.127, 0.016);
  const armLCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.012, 0.008, -0.014),
    new THREE.Vector3(0.007, -0.012, 0.028),
    new THREE.Vector3(-0.004, -0.020, 0.054),
    new THREE.Vector3(-0.010, -0.028, 0.062)
  ]);
  const armLGeo = createTaperedTube(
    THREE,
    armLCurve,
    24,
    14,
    (t) => 0.020 * (1 - 0.34 * t) + 0.0038 * gauss(t, 0.90, 0.16),
    { ovalX: 1.08, ovalY: 0.92 }
  );
  const armLMesh = new THREE.Mesh(armLGeo, armMat);
  armLMesh.userData.slot = 'fur';
  armLMesh.castShadow = true;
  armLMesh.receiveShadow = true;
  armL.add(armLMesh);
  bodyGroup.add(armL);

  // === FLUFFY COTTON TAIL ===
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tail';
  tailGroup.position.set(0, 0.048, -0.066);
  tailGroup.rotation.x = 0.24;

  const tailCol = variant === 0 ? mixCol(THREE, accentCol, furCol, 0.18) : accentCol;
  const tailMat = new THREE.MeshPhysicalMaterial({
    color: tailCol,
    bumpMap: furBump,
    bumpScale: 0.0028,
    roughness: 0.96,
    sheen: 1.0,
    sheenRoughness: 0.68,
    sheenColor: 0xffffff
  });
  const tailMesh = new THREE.Mesh(buildTailGeometry(THREE, kit), tailMat);
  tailMesh.userData.slot = 'furAccent';
  tailMesh.castShadow = true;
  tailMesh.receiveShadow = true;
  tailGroup.add(tailMesh);
  bodyGroup.add(tailGroup);

  // === HEAD GROUP ===
  const headGroup = new THREE.Group();
  headGroup.name = 'head';
  headGroup.position.set(0, 0.162, 0.016);
  // Endearing gentle head tilt & curious three-quarter gaze
  headGroup.rotation.set(0.04, 0.09, -0.075);
  root.add(headGroup);

  const headMat = makeFurMat(makeHeadFurTexture(THREE, kit, furCol, accentCol, variant));
  const headMesh = new THREE.Mesh(buildHeadGeometry(THREE, kit), headMat);
  headMesh.userData.slot = 'fur';
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headGroup.add(headMesh);

  // === LAYERED EXPRESSIVE EYES ===
  const irisMat = new THREE.MeshPhysicalMaterial({
    map: makeEyeIrisTexture(THREE, kit, eyeCol),
    roughness: 0.08,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05
  });
  const corneaMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.18,
    roughness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    depthWrite: false
  });
  const dotMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.35,
    roughness: 0.05
  });
  const lashMat = new THREE.MeshPhysicalMaterial({
    color: 0x261812,
    roughness: 0.65
  });

  const eyeGroups = {};
  for (const side of [1, -1]) {
    const dir = new THREE.Vector3(side * 0.45, 0.09, 0.888).normalize();
    const frame = sampleHeadFrame(THREE, dir, kit);
    const eye = buildEyeGroup(THREE, side, irisMat, corneaMat, dotMat, lashMat);
    // Slightly inset inside sculpted socket so eye sits naturally, never floating
    eye.position.copy(frame.pos).addScaledVector(frame.normal, -0.0022);
    const gazeDir = frame.normal.clone().lerp(new THREE.Vector3(side * 0.14, 0.04, 0.99), 0.36).normalize();
    eye.lookAt(eye.position.clone().add(gazeDir));
    headGroup.add(eye);
    eyeGroups[eye.name] = eye;
  }

  // === NOSE, MOUTH, WHISKERS & CHEEK BLUSH ===
  const { faceGroup, nosePivot } = buildNoseAndMouth(THREE, kit, skinCol);
  headGroup.add(faceGroup);

  // === LOP EARS (ExtrudeGeometry + Subdivision + 3D Bending) ===
  const earMatL = makeFurMat(makeEarOuterTexture(THREE, kit, furCol, accentCol, variant, true));
  const earMatR = makeFurMat(makeEarOuterTexture(THREE, kit, furCol, accentCol, variant, false));
  const innerEarMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: makeInnerEarTexture(THREE, kit, skinCol, furCol),
    roughness: 0.88,
    sheen: 0.72,
    sheenRoughness: 0.75,
    sheenColor: shiftCol(THREE, skinCol, 0, -0.05, 0.16)
  });

  const earL = buildLopEarGroup(THREE, true, earMatL, innerEarMat);
  earL.position.set(0.023, 0.078, -0.007);
  earL.rotation.set(0.05, -0.10, -0.06);
  headGroup.add(earL);

  const earR = buildLopEarGroup(THREE, false, earMatR, innerEarMat);
  earR.position.set(-0.025, 0.075, -0.006);
  earR.rotation.set(0.02, 0.06, 0.02);
  headGroup.add(earR);

  // === COZY ACCESSORY ===
  const acc = buildAccessory(THREE, kit, accessoryOpt, primaryCol, charmCol);
  if (acc) {
    bodyGroup.add(acc);
  }

  // Optional tiny daisy accent on perked ear if accessory === 'flower'
  if (accessoryOpt === 'flower') {
    const flower = new THREE.Group();
    flower.position.set(0.012, 0.010, 0.012);
    flower.rotation.set(0.35, 0.25, -0.2);

    const petalShape = new THREE.Shape();
    petalShape.moveTo(0, 0);
    petalShape.bezierCurveTo(0.0035, 0.003, 0.0045, 0.010, 0, 0.0125);
    petalShape.bezierCurveTo(-0.0045, 0.010, -0.0035, 0.003, 0, 0);
    const pRaw = new THREE.ExtrudeGeometry(petalShape, {
      depth: 0.0012,
      bevelEnabled: true,
      bevelThickness: 0.0005,
      bevelSize: 0.0004,
      bevelSegments: 2,
      curveSegments: 10
    });
    const pGeo = subdivideBufferGeometry(THREE, pRaw, 0.004, 1);
    pRaw.dispose();
    const pp = pGeo.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      const y = pp.getY(i);
      pp.setZ(i, pp.getZ(i) - y * y * 14);
    }
    computeSmoothNormals(THREE, pGeo);

    const petalMat = new THREE.MeshPhysicalMaterial({
      color: 0xfffaf2,
      roughness: 0.85,
      sheen: 0.7,
      sheenColor: 0xffffff
    });
    for (let k = 0; k < 7; k++) {
      const pMesh = new THREE.Mesh(pGeo, petalMat);
      pMesh.userData.slot = 'secondary';
      pMesh.rotation.z = (k / 7) * Math.PI * 2;
      flower.add(pMesh);
    }
    const centerMat = new THREE.MeshPhysicalMaterial({
      color: 0xefc04b,
      roughness: 0.65,
      sheen: 0.5
    });
    const bud = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 16, 12), centerMat);
    bud.scale.z = 0.6;
    bud.position.z = 0.0012;
    bud.userData.slot = 'accent';
    flower.add(bud);
    earL.add(flower);
  }

  // Store animation rest transforms for stateless idle(group, t)
  root.userData.anim = {
    body: bodyGroup,
    head: headGroup,
    tail: tailGroup,
    earL,
    earR,
    armL,
    armR,
    eyeL: eyeGroups.eyeL,
    eyeR: eyeGroups.eyeR,
    nose: nosePivot,
    headBasePos: headGroup.position.clone(),
    headBaseRot: headGroup.rotation.clone(),
    earLBaseRot: earL.rotation.clone(),
    earRBaseRot: earR.rotation.clone(),
    tailBaseRot: tailGroup.rotation.clone(),
    armLBaseRot: armL.rotation.clone(),
    armRBaseRot: armR.rotation.clone(),
    noseBasePos: nosePivot.position.clone()
  };

  return root;
}

export function idle(group, t) {
  const a = group && group.userData && group.userData.anim;
  if (!a) return;

  // Soft cozy breathing
  const breath = Math.sin(t * 2.15);
  a.body.scale.set(1 - breath * 0.006, 1 + breath * 0.014, 1 + breath * 0.007);

  // Gentle head sway, tilt, and occasional curious bunny sniff
  const swayY = Math.sin(t * 0.72) * 0.075 + Math.sin(t * 0.31 + 1.1) * 0.035;
  const tiltZ = Math.sin(t * 0.58 + 0.6) * 0.042;
  const sniffCycle = t % 4.2;
  const sniffEnv = sniffCycle < 0.55 ? Math.sin((sniffCycle / 0.55) * Math.PI) : 0;
  const sniffOsc = Math.sin(t * 34.0) * sniffEnv;

  a.head.position.y = a.headBasePos.y + breath * 0.0018;
  a.head.rotation.x = a.headBaseRot.x + Math.sin(t * 0.95) * 0.025 - sniffEnv * 0.028;
  a.head.rotation.y = a.headBaseRot.y + swayY;
  a.head.rotation.z = a.headBaseRot.z + tiltZ;

  // Cute bunny nose twitch
  if (a.nose) {
    a.nose.position.y = a.noseBasePos.y + sniffOsc * 0.0011;
    a.nose.position.z = a.noseBasePos.z + sniffEnv * 0.0007;
  }

  // Expressive ears: perked ear listens softly, flopped ear swings gently with lag
  a.earL.rotation.x = a.earLBaseRot.x + Math.sin(t * 1.15 - 0.3) * 0.045 + sniffEnv * 0.04;
  a.earL.rotation.z = a.earLBaseRot.z + Math.sin(t * 0.85 + 0.4) * 0.055;
  a.earR.rotation.z = a.earRBaseRot.z - tiltZ * 0.55 + Math.sin(t * 0.58 - 0.15) * 0.032;
  a.earR.rotation.x = a.earRBaseRot.x + Math.sin(t * 1.05 - 0.4) * 0.028;

  // Raised paw cozy micro-bob & resting paw breath follow
  a.armL.rotation.x = a.armLBaseRot.x + Math.sin(t * 1.65) * 0.045 - breath * 0.02;
  a.armR.rotation.x = a.armRBaseRot.x + breath * 0.018;

  // Occasional fluffy tail wiggle
  const tailCycle = (t + 1.7) % 5.4;
  const tailBurst = tailCycle < 0.45 ? Math.sin((tailCycle / 0.45) * Math.PI) : 0;
  a.tail.rotation.y = a.tailBaseRot.y + Math.sin(t * 28.0) * 0.14 * tailBurst + Math.sin(t * 1.2) * 0.03;
  a.tail.rotation.x = a.tailBaseRot.x + breath * 0.025;

  // Natural blink every ~3.8 seconds (with occasional soft double-blink)
  const blinkPeriod = 3.85;
  const bt = t % blinkPeriod;
  let blink = 0;
  if (bt < 0.15) {
    blink = Math.sin((bt / 0.15) * Math.PI);
  } else if (Math.floor(t / blinkPeriod) % 3 === 1 && bt > 0.24 && bt < 0.38) {
    blink = Math.sin(((bt - 0.24) / 0.14) * Math.PI);
  }
  const eyeScaleY = 1.0 - 0.92 * blink;
  if (a.eyeL) a.eyeL.scale.y = eyeScaleY;
  if (a.eyeR) a.eyeR.scale.y = eyeScaleY;
}
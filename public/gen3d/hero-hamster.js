export const META = {
  id: 'cozy-hamster',
  name: 'Cozy Hamster',
  kind: 'creature',
  footprint: [0.15, 0.15],
  variants: ['Golden', 'Banded', 'White'],
  note: 'Stylised round chibi hamster (~0.18 m tall) sitting upright with full stuffed cheeks and holding a striped sunflower seed in both paws.'
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function resolvePalette(THREE, opts) {
  const variant = (opts && typeof opts.variant === 'number') ? (opts.variant | 0) : 0;
  const presets = [
    { fur: 0xd48b44, furAccent: 0xf6ead6, eye: 0x522c14, dorsalShade: 0x9b5724, cheekMark: 0x874d24 },
    { fur: 0xb96839, furAccent: 0xfaf3e8, eye: 0x452412, dorsalShade: 0x854321, cheekMark: 0x8f4c28 },
    { fur: 0xf1ece4, furAccent: 0xfffdf9, eye: 0x3b2630, dorsalShade: 0xd9cfc2, cheekMark: 0xe2d8cc }
  ];
  const base = presets[clamp(variant, 0, 2)];

  const furCol = new THREE.Color(opts && opts.fur !== undefined ? opts.fur : base.fur);
  const accentCol = new THREE.Color(opts && opts.furAccent !== undefined ? opts.furAccent : base.furAccent);
  const eyeCol = new THREE.Color(opts && opts.eye !== undefined ? opts.eye : base.eye);

  const dorsalCol = furCol.clone().multiplyScalar(variant === 2 ? 0.89 : 0.74);
  const sheenCol = furCol.clone().lerp(new THREE.Color(0xffffff), 0.58);
  const skinCol = new THREE.Color(0xf0b2a8);
  const noseCol = new THREE.Color(0xe99290);

  return { variant: clamp(variant, 0, 2), furCol, accentCol, eyeCol, dorsalCol, sheenCol, skinCol, noseCol };
}

function evalBodyRaw(ux, uy, uz) {
  const lower = smoothstep(0.45, -0.78, uy);
  const topTaper = 1.0 - 0.17 * smoothstep(0.42, 1.0, uy);

  let x = ux * 0.046 * (1.0 + 0.22 * lower) * topTaper;
  let y = uy * 0.055;
  let z = uz * 0.048 * (1.0 + 0.14 * lower) * topTaper;

  // Plump cozy tummy forward
  const belly = Math.exp(-Math.pow((uy + 0.18) / 0.56, 2)) * Math.pow(Math.max(0, uz), 1.25);
  z += 0.0085 * belly;

  // Soft rounded upper back hunch
  const hunch = Math.exp(-Math.pow((uy - 0.20) / 0.54, 2)) * Math.pow(Math.max(0, -uz), 1.2);
  z -= 0.0052 * hunch;
  y += 0.0025 * hunch;

  // Plush seated haunches on lower front-sides
  const haunch = Math.exp(-Math.pow((uy + 0.48) / 0.36, 2)) * Math.exp(-Math.pow((Math.abs(ux) - 0.70) / 0.36, 2));
  x += Math.sign(ux || 1) * 0.0046 * haunch;
  z += 0.0032 * haunch * Math.max(0, uz + 0.3);

  // Subtle neck lean forward toward head
  z += 0.0075 * smoothstep(0.32, 1.0, uy);

  // Shift up so underside sits near floor, then flatten smoothly
  y += 0.0535;
  const k = 0.0085;
  y = 0.5 * (y + Math.sqrt(y * y + k * k));

  // Soft weight spread near floor contact
  const spread = Math.exp(-Math.pow(Math.max(0, y - 0.004) / 0.020, 2));
  x *= 1.0 + 0.055 * spread;
  z *= 1.0 + 0.045 * spread;

  return [x, y, z];
}

function evalHeadPoint(ux, uy, uz) {
  const crownTaper = 1.0 - 0.14 * smoothstep(0.18, 1.0, uy);
  let x = ux * 0.039 * crownTaper;
  let y = uy * 0.036;
  let z = uz * 0.038 * (1.0 - 0.06 * smoothstep(0.3, 1.0, uy));

  // Extend underside neck smoothly down so head sinks seamlessly into body
  const neckDip = smoothstep(-0.45, -1.0, uy);
  y -= 0.0085 * neckDip;
  z -= 0.0020 * neckDip;

  // Stuffed cheek pouches (asymmetric: left cheek slightly fuller for charm)
  const cLen = Math.hypot(0.75, -0.22, 0.54);
  const cx = 0.75 / cLen, cy = -0.22 / cLen, cz = 0.54 / cLen;
  const dL = Math.max(0, ux * cx + uy * cy + uz * cz);
  const dR = Math.max(0, -ux * cx + uy * cy + uz * cz);
  const cheekL = Math.pow(dL, 3.0) * 0.0205;
  const cheekR = Math.pow(dR, 3.0) * 0.0188;

  x += cheekL * 0.86 - cheekR * 0.86;
  y += (cheekL + cheekR) * -0.22;
  z += (cheekL + cheekR) * 0.44;

  // Soft forward snout / muzzle
  const mLen = Math.hypot(0, -0.14, 0.99);
  const md = Math.max(0, (uy * -0.14 + uz * 0.99) / mLen);
  const muzzle = Math.pow(md, 5.2) * 0.0148;
  z += muzzle;
  y -= muzzle * 0.08;

  // Cute whisker pads flanking the philtrum
  const pLen = Math.hypot(0.24, -0.28, 0.93);
  const px = 0.24 / pLen, py = -0.28 / pLen, pz = 0.93 / pLen;
  const padL = Math.pow(Math.max(0, ux * px + uy * py + uz * pz), 13.0) * 0.0044;
  const padR = Math.pow(Math.max(0, -ux * px + uy * py + uz * pz), 13.0) * 0.0044;
  x += (padL - padR) * 0.30;
  y -= (padL + padR) * 0.12;
  z += (padL + padR) * 0.92;

  // Subtle philtrum cleft
  const clLen = Math.hypot(0, -0.26, 0.965);
  const cleft = Math.exp(-Math.pow(ux / 0.085, 2)) *
    Math.pow(Math.max(0, (uy * -0.26 + uz * 0.965) / clLen), 12.0) * 0.0020;
  z -= cleft;

  // Soft chin puff
  const chLen = Math.hypot(0, -0.52, 0.854);
  const chin = Math.pow(Math.max(0, (uy * -0.52 + uz * 0.854) / chLen), 8.0) * 0.0036;
  y -= chin * 0.35;
  z += chin * 0.72;

  // Gentle eye socket dimples so eyes sit snugly inset
  const eLen = Math.hypot(0.43, 0.17, 0.886);
  const ex = 0.43 / eLen, ey = 0.17 / eLen, ez = 0.886 / eLen;
  const sockL = Math.pow(Math.max(0, ux * ex + uy * ey + uz * ez), 22.0) * 0.0032;
  const sockR = Math.pow(Math.max(0, -ux * ex + uy * ey + uz * ez), 22.0) * 0.0032;
  const sock = sockL + sockR;
  x -= ux * sock;
  y -= uy * sock;
  z -= uz * sock;

  // Soft brow fullness above eyes
  const bLen = Math.hypot(0.38, 0.42, 0.824);
  const bx = 0.38 / bLen, by = 0.42 / bLen, bz = 0.824 / bLen;
  const brow = (Math.pow(Math.max(0, ux * bx + uy * by + uz * bz), 10.0) +
                Math.pow(Math.max(0, -ux * bx + uy * by + uz * bz), 10.0)) * 0.0024;
  y += brow * 0.42;
  z += brow * 0.85;

  // Offset relative to neck pivot
  return [x, y + 0.032, z + 0.006];
}

function evalHeadSurfaceAndNormal(THREE, dir) {
  const u = dir.clone().normalize();
  const ref = Math.abs(u.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const t1 = new THREE.Vector3().crossVectors(ref, u).normalize();
  const t2 = new THREE.Vector3().crossVectors(u, t1).normalize();

  const eps = 0.012;
  const p0 = new THREE.Vector3(...evalHeadPoint(u.x, u.y, u.z));
  const u1 = u.clone().addScaledVector(t1, eps).normalize();
  const u2 = u.clone().addScaledVector(t2, eps).normalize();
  const p1 = new THREE.Vector3(...evalHeadPoint(u1.x, u1.y, u1.z));
  const p2 = new THREE.Vector3(...evalHeadPoint(u2.x, u2.y, u2.z));

  const n = new THREE.Vector3().crossVectors(p1.sub(p0), p2.sub(p0)).normalize();
  if (n.dot(u) < 0) n.negate();
  return { pos: p0, normal: n, t1, t2 };
}

function buildTaperedTube(THREE, curve, tubularSegments, radialSegments, radiusFn, capStart = true, capEnd = true) {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions = [];
  const uvs = [];
  const indices = [];

  const ringPoints = radialSegments + 1;
  const pushRing = (center, N, B, rx, ry, vCoord) => {
    const startIdx = positions.length / 3;
    for (let j = 0; j <= radialSegments; j++) {
      const a = (j / radialSegments) * Math.PI * 2;
      const ca = Math.cos(a) * rx;
      const sa = Math.sin(a) * ry;
      positions.push(
        center.x + ca * N.x + sa * B.x,
        center.y + ca * N.y + sa * B.y,
        center.z + ca * N.z + sa * B.z
      );
      uvs.push(j / radialSegments, vCoord);
    }
    return startIdx;
  };

  const getRadii = (t) => {
    const r = radiusFn(t);
    return Array.isArray(r) ? r : [r, r];
  };

  const ringStarts = [];

  if (capStart) {
    const p0 = curve.getPointAt(0);
    const T0 = frames.tangents[0];
    const N0 = frames.normals[0];
    const B0 = frames.binormals[0];
    const [rx0, ry0] = getRadii(0);
    const rAvg = 0.5 * (rx0 + ry0);
    const steps = 3;
    for (let s = steps; s >= 1; s--) {
      const ang = (s / steps) * (Math.PI * 0.5);
      const scale = Math.cos(ang);
      const offset = -Math.sin(ang) * rAvg * 0.85;
      const c = p0.clone().addScaledVector(T0, offset);
      ringStarts.push(pushRing(c, N0, B0, Math.max(1e-5, rx0 * scale), Math.max(1e-5, ry0 * scale), 0));
    }
  }

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    const p = curve.getPointAt(t);
    const [rx, ry] = getRadii(t);
    ringStarts.push(pushRing(p, frames.normals[i], frames.binormals[i], rx, ry, t));
  }

  if (capEnd) {
    const p1 = curve.getPointAt(1);
    const T1 = frames.tangents[tubularSegments];
    const N1 = frames.normals[tubularSegments];
    const B1 = frames.binormals[tubularSegments];
    const [rx1, ry1] = getRadii(1);
    const rAvg = 0.5 * (rx1 + ry1);
    const steps = 3;
    for (let s = 1; s <= steps; s++) {
      const ang = (s / steps) * (Math.PI * 0.5);
      const scale = Math.cos(ang);
      const offset = Math.sin(ang) * rAvg * 0.85;
      const c = p1.clone().addScaledVector(T1, offset);
      ringStarts.push(pushRing(c, N1, B1, Math.max(1e-5, rx1 * scale), Math.max(1e-5, ry1 * scale), 1));
    }
  }

  for (let r = 0; r < ringStarts.length - 1; r++) {
    const a0 = ringStarts[r];
    const b0 = ringStarts[r + 1];
    for (let j = 0; j < radialSegments; j++) {
      const a = a0 + j;
      const b = b0 + j;
      const c = b0 + j + 1;
      const d = a0 + j + 1;
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

function subdivideGeometryOnce(THREE, srcGeo) {
  const geo = srcGeo.index ? srcGeo.toNonIndexed() : srcGeo;
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const triCount = pos.count / 3;

  const newPos = new Float32Array(triCount * 12 * 3);
  const newUv = uv ? new Float32Array(triCount * 12 * 2) : null;

  let pOut = 0;
  let uOut = 0;

  const emit = (ax, ay, az, au, av) => {
    newPos[pOut++] = ax;
    newPos[pOut++] = ay;
    newPos[pOut++] = az;
    if (newUv) {
      newUv[uOut++] = au;
      newUv[uOut++] = av;
    }
  };

  for (let i = 0; i < triCount; i++) {
    const i0 = i * 3, i1 = i0 + 1, i2 = i0 + 2;
    const x0 = pos.getX(i0), y0 = pos.getY(i0), z0 = pos.getZ(i0);
    const x1 = pos.getX(i1), y1 = pos.getY(i1), z1 = pos.getZ(i1);
    const x2 = pos.getX(i2), y2 = pos.getY(i2), z2 = pos.getZ(i2);

    const u0 = uv ? uv.getX(i0) : 0, v0 = uv ? uv.getY(i0) : 0;
    const u1 = uv ? uv.getX(i1) : 0, v1 = uv ? uv.getY(i1) : 0;
    const u2 = uv ? uv.getX(i2) : 0, v2 = uv ? uv.getY(i2) : 0;

    const m01x = 0.5 * (x0 + x1), m01y = 0.5 * (y0 + y1), m01z = 0.5 * (z0 + z1);
    const m12x = 0.5 * (x1 + x2), m12y = 0.5 * (y1 + y2), m12z = 0.5 * (z1 + z2);
    const m20x = 0.5 * (x2 + x0), m20y = 0.5 * (y2 + y0), m20z = 0.5 * (z2 + z0);

    const m01u = 0.5 * (u0 + u1), m01v = 0.5 * (v0 + v1);
    const m12u = 0.5 * (u1 + u2), m12v = 0.5 * (v1 + v2);
    const m20u = 0.5 * (u2 + u0), m20v = 0.5 * (v2 + v0);

    emit(x0, y0, z0, u0, v0); emit(m01x, m01y, m01z, m01u, m01v); emit(m20x, m20y, m20z, m20u, m20v);
    emit(m01x, m01y, m01z, m01u, m01v); emit(x1, y1, z1, u1, v1); emit(m12x, m12y, m12z, m12u, m12v);
    emit(m20x, m20y, m20z, m20u, m20v); emit(m12x, m12y, m12z, m12u, m12v); emit(x2, y2, z2, u2, v2);
    emit(m01x, m01y, m01z, m01u, m01v); emit(m12x, m12y, m12z, m12u, m12v); emit(m20x, m20y, m20z, m20u, m20v);
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
  if (newUv) out.setAttribute('uv', new THREE.BufferAttribute(newUv, 2));
  out.computeVertexNormals();
  return out;
}

function createFurBumpTexture(THREE, kit) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);

    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n1 = kit.noise(x * 0.09, y * 0.045);
        const n2 = kit.noise(x * 0.28 + 13.7, y * 0.16 + 5.1);
        const v = clamp(Math.round((0.5 + (n1 - 0.5) * 0.34 + (n2 - 0.5) * 0.22) * 255), 0, 255);
        const idx = (y * w + x) * 4;
        d[idx] = d[idx + 1] = d[idx + 2] = v;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Fine directional fur streaks
    for (let i = 0; i < 1600; i++) {
      const rx = kit.noise(i * 1.73, 3.1) * w;
      const ry = kit.noise(7.9, i * 1.41) * h;
      const len = 5 + kit.noise(i * 0.37, 19.2) * 9;
      const dx = (kit.noise(i * 0.61, 2.3) - 0.5) * 3.0;
      const bright = kit.noise(i * 2.13, 11.4) > 0.48;
      ctx.strokeStyle = bright ? 'rgba(235,235,235,0.22)' : 'rgba(40,40,40,0.20)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + dx, ry + len);
      ctx.stroke();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createBodyFurTexture(THREE, kit, pal) {
  const tex = kit.canvasTexture(512, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;

    const fr = pal.furCol.r, fg = pal.furCol.g, fb = pal.furCol.b;
    const ar = pal.accentCol.r, ag = pal.accentCol.g, ab = pal.accentCol.b;
    const dr = pal.dorsalCol.r, dg = pal.dorsalCol.g, db = pal.dorsalCol.b;

    for (let py = 0; py < h; py++) {
      const theta = (py / (h - 1)) * Math.PI;
      const sinT = Math.sin(theta);
      const uy = Math.cos(theta);

      for (let px = 0; px < w; px++) {
        const u = px / w;
        const phi = u * Math.PI * 2;
        const ux = -Math.cos(phi) * sinT;
        const uz = Math.sin(phi) * sinT;

        const nCoarse = kit.noise(ux * 3.2 + 5.1, uy * 3.2 + uz * 2.4 + 3.7);
        const nFine = kit.noise(ux * 11.0 + 17.3, uy * 11.0 + uz * 9.0 + 9.2);
        const edgeJitter = (nCoarse - 0.5) * 0.16 + (nFine - 0.5) * 0.06;

        // Soft belly lightness on front (+z)
        let creamMask = smoothstep(0.26, 0.72, uz + edgeJitter - uy * 0.12);

        // Banded variant: crisp yet softly feathered cream saddle band around midsection
        if (pal.variant === 1) {
          const bandLo = smoothstep(-0.32, -0.18, uy + edgeJitter * 0.65);
          const bandHi = 1.0 - smoothstep(0.20, 0.34, uy + edgeJitter * 0.65);
          const band = bandLo * bandHi;
          creamMask = Math.max(creamMask, band * 0.96);
        }

        // Darker dorsal richness along spine (-z)
        const dorsalMask = smoothstep(0.10, 0.86, -uz + edgeJitter * 0.5) * (1.0 - creamMask * 0.85);
        const spineBoost = pal.variant === 2 ? 0.55 : 0.78;

        let r = lerp(fr, dr, dorsalMask * spineBoost);
        let g = lerp(fg, dg, dorsalMask * spineBoost);
        let b = lerp(fb, db, dorsalMask * spineBoost);

        r = lerp(r, ar, creamMask);
        g = lerp(g, ag, creamMask);
        b = lerp(b, ab, creamMask);

        // Subtle organic coat variation
        const mottle = 1.0 + (nCoarse - 0.5) * 0.08 + (nFine - 0.5) * 0.06;
        const idx = (py * w + px) * 4;
        data[idx] = clamp(Math.round(r * mottle * 255), 0, 255);
        data[idx + 1] = clamp(Math.round(g * mottle * 255), 0, 255);
        data[idx + 2] = clamp(Math.round(b * mottle * 255), 0, 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Painted directional fur flecks
    ctx.lineCap = 'round';
    for (let i = 0; i < 2400; i++) {
      const px = kit.noise(i * 1.17, 4.3) * w;
      const py = (0.06 + kit.noise(9.1, i * 1.37) * 0.88) * h;
      const len = 4 + kit.noise(i * 0.53, 21.7) * 7;
      const slant = (kit.noise(i * 0.89, 13.3) - 0.5) * 2.6;
      const light = kit.noise(i * 2.41, 6.7) > 0.48;
      ctx.strokeStyle = light ? 'rgba(255,248,236,0.14)' : 'rgba(65,35,16,0.10)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + slant, py + len);
      ctx.stroke();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createHeadFurTexture(THREE, kit, pal) {
  const tex = kit.canvasTexture(512, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;

    const fr = pal.furCol.r, fg = pal.furCol.g, fb = pal.furCol.b;
    const ar = pal.accentCol.r, ag = pal.accentCol.g, ab = pal.accentCol.b;
    const dr = pal.dorsalCol.r, dg = pal.dorsalCol.g, db = pal.dorsalCol.b;

    for (let py = 0; py < h; py++) {
      const theta = (py / (h - 1)) * Math.PI;
      const sinT = Math.sin(theta);
      const uy = Math.cos(theta);

      for (let px = 0; px < w; px++) {
        const u = px / w;
        const phi = u * Math.PI * 2;
        const ux = -Math.cos(phi) * sinT;
        const uz = Math.sin(phi) * sinT;

        const nCoarse = kit.noise(ux * 3.8 + 2.3, uy * 3.8 + uz * 3.1 + 8.4);
        const nFine = kit.noise(ux * 12.0 + 11.1, uy * 12.0 + uz * 10.0 + 4.9);
        const jitter = (nCoarse - 0.5) * 0.12 + (nFine - 0.5) * 0.05;

        // Soft cream muzzle, chin, and lower stuffed cheeks
        const muzzleCream = smoothstep(0.54, 0.88, uz + jitter * 0.6) * smoothstep(0.28, -0.18, uy + jitter * 0.5);
        const cheekCream = smoothstep(0.06, -0.45, uy + jitter * 0.6) * smoothstep(-0.15, 0.45, uz + jitter * 0.4);
        let creamMask = clamp(Math.max(muzzleCream, cheekCream * 0.92), 0, 1);

        // Cute gentle forehead blaze for banded variant
        if (pal.variant === 1) {
          const blaze = Math.exp(-Math.pow(ux / 0.16, 2)) *
            smoothstep(0.55, 0.90, uz) * smoothstep(-0.1, 0.25, uy) * smoothstep(0.62, 0.30, uy);
          creamMask = Math.max(creamMask, blaze * 0.85);
        }

        // Warm deeper crown and nape shading
        const crownMask = smoothstep(-0.05, 0.72, uy - uz * 0.35 + jitter * 0.4) * (1.0 - creamMask * 0.9);
        const crownStrength = pal.variant === 2 ? 0.48 : 0.58;

        let r = lerp(fr, dr, crownMask * crownStrength);
        let g = lerp(fg, dg, crownMask * crownStrength);
        let b = lerp(fb, db, crownMask * crownStrength);

        r = lerp(r, ar, creamMask);
        g = lerp(g, ag, creamMask);
        b = lerp(b, ab, creamMask);

        // Subtle golden cheek-flash warmth below eye/ear line for golden variant
        if (pal.variant === 0) {
          const flash = Math.exp(-Math.pow((Math.abs(ux) - 0.78) / 0.18, 2)) *
            Math.exp(-Math.pow((uy + 0.08) / 0.16, 2)) *
            smoothstep(0.05, 0.45, uz);
          r = lerp(r, dr, flash * 0.32);
          g = lerp(g, dg, flash * 0.32);
          b = lerp(b, db, flash * 0.32);
        }

        // Subtle rosy warmth under cheek highlights
        const blushGlow = Math.exp(-Math.pow((Math.abs(ux) - 0.56) / 0.22, 2)) *
          Math.exp(-Math.pow((uy + 0.08) / 0.18, 2)) *
          smoothstep(0.45, 0.85, uz);
        r = lerp(r, 0.96, blushGlow * 0.16);
        g = lerp(g, 0.62, blushGlow * 0.16);
        b = lerp(b, 0.60, blushGlow * 0.16);

        const mottle = 1.0 + (nCoarse - 0.5) * 0.07 + (nFine - 0.5) * 0.05;
        const idx = (py * w + px) * 4;
        data[idx] = clamp(Math.round(r * mottle * 255), 0, 255);
        data[idx + 1] = clamp(Math.round(g * mottle * 255), 0, 255);
        data[idx + 2] = clamp(Math.round(b * mottle * 255), 0, 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Fine facial fur flecks
    ctx.lineCap = 'round';
    for (let i = 0; i < 2000; i++) {
      const px = kit.noise(i * 1.49, 2.7) * w;
      const py = (0.05 + kit.noise(6.3, i * 1.29) * 0.90) * h;
      const len = 3.5 + kit.noise(i * 0.71, 14.9) * 6;
      const slant = (kit.noise(i * 0.97, 8.1) - 0.5) * 3.0;
      const light = kit.noise(i * 2.11, 18.2) > 0.46;
      ctx.strokeStyle = light ? 'rgba(255,250,242,0.14)' : 'rgba(60,32,14,0.09)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + slant, py + len);
      ctx.stroke();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createIrisTexture(THREE, kit, eyeCol) {
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    const cx = w * 0.5, cy = h * 0.5, rMax = w * 0.48;
    const dark = eyeCol.clone().multiplyScalar(0.35);
    const bright = eyeCol.clone().lerp(new THREE.Color(0xffd2a0), 0.35);

    const grad = ctx.createRadialGradient(cx, cy + rMax * 0.18, rMax * 0.25, cx, cy, rMax);
    grad.addColorStop(0.0, '#090608');
    grad.addColorStop(0.46, '#0d090b');
    grad.addColorStop(0.56, `#${bright.getHexString()}`);
    grad.addColorStop(0.84, `#${eyeCol.getHexString()}`);
    grad.addColorStop(1.0, `#${dark.getHexString()}`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle radial iris fibres
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const r0 = rMax * (0.54 + kit.noise(i * 0.7, 2.1) * 0.08);
      const r1 = rMax * (0.86 + kit.noise(4.3, i * 0.9) * 0.08);
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(255,235,205,0.16)' : 'rgba(15,8,5,0.22)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBlushTexture(THREE, kit) {
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 2, w * 0.5, h * 0.5, w * 0.46);
    grad.addColorStop(0.0, 'rgba(242, 128, 134, 0.62)');
    grad.addColorStop(0.45, 'rgba(242, 136, 138, 0.34)');
    grad.addColorStop(0.8, 'rgba(244, 150, 148, 0.09)');
    grad.addColorStop(1.0, 'rgba(244, 150, 148, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSunflowerSeedTextures(THREE, kit) {
  const colorTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;

    for (let y = 0; y < h; y++) {
      const v = y / (h - 1);
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const nWave = kit.noise(u * 14.0 + 3.1, v * 3.5 + 1.7);
        const nGrain = kit.noise(u * 42.0 + 9.2, v * 8.0 + 4.4);

        // Classic sunflower seed longitudinal black & ivory stripes
        const stripePhase = (u * 10.0 + (nWave - 0.5) * 0.45);
        const sVal = Math.sin(stripePhase * Math.PI * 2);
        // Wider cream seams on the two opposing flat edges (u ≈ 0, 0.5)
        const edgeBand = Math.exp(-Math.pow((Math.sin(u * Math.PI * 2)) / 0.24, 2));
        let ivory = smoothstep(0.12, 0.42, sVal);
        ivory = Math.max(ivory, edgeBand * 0.92);

        // Slightly darker pointed base tip
        const tipDark = smoothstep(0.18, 0.0, v) * 0.55;
        ivory *= (1.0 - tipDark);

        const darkR = 0.14, darkG = 0.13, darkB = 0.14;
        const lightR = 0.90, lightG = 0.85, lightB = 0.74;

        const grain = 0.90 + nGrain * 0.20;
        const r = lerp(darkR, lightR, ivory) * grain;
        const g = lerp(darkG, lightG, ivory) * grain;
        const b = lerp(darkB, lightB, ivory) * grain;

        const idx = (y * w + x) * 4;
        data[idx] = clamp(Math.round(r * 255), 0, 255);
        data[idx + 1] = clamp(Math.round(g * 255), 0, 255);
        data[idx + 2] = clamp(Math.round(b * 255), 0, 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.ClampToEdgeWrapping;

  const bumpTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      const v = y / (h - 1);
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const rib = 0.5 + 0.25 * Math.sin(u * Math.PI * 20);
        const grain = kit.noise(u * 48.0 + 4.2, v * 9.0 + 7.1);
        const val = clamp(Math.round((rib * 0.55 + grain * 0.45) * 255), 0, 255);
        const idx = (y * w + x) * 4;
        data[idx] = data[idx + 1] = data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.ClampToEdgeWrapping;

  return { colorTex, bumpTex };
}

function buildSculptedBody(THREE) {
  const geo = new THREE.SphereGeometry(1, 56, 40);
  const pos = geo.attributes.position;
  let minY = Infinity;

  const displaced = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);
    const [x, y, z] = evalBodyRaw(ux, uy, uz);
    displaced[i * 3] = x;
    displaced[i * 3 + 1] = y;
    displaced[i * 3 + 2] = z;
    if (y < minY) minY = y;
  }

  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      displaced[i * 3],
      displaced[i * 3 + 1] - minY,
      displaced[i * 3 + 2]
    );
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function buildSculptedHead(THREE) {
  const geo = new THREE.SphereGeometry(1, 64, 48);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);
    const [x, y, z] = evalHeadPoint(ux, uy, uz);
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function buildEarShellGeometry(THREE, scale, depth, bevelSize, cupStrength) {
  const shape = new THREE.Shape();
  const s = scale;
  shape.moveTo(-0.0082 * s, 0.0);
  shape.bezierCurveTo(-0.0135 * s, 0.0075 * s, -0.0142 * s, 0.0205 * s, -0.0068 * s, 0.0258 * s);
  shape.bezierCurveTo(-0.0010 * s, 0.0298 * s, 0.0068 * s, 0.0285 * s, 0.0110 * s, 0.0230 * s);
  shape.bezierCurveTo(0.0148 * s, 0.0176 * s, 0.0132 * s, 0.0068 * s, 0.0085 * s, 0.0);
  shape.bezierCurveTo(0.0035 * s, -0.0032 * s, -0.0035 * s, -0.0032 * s, -0.0082 * s, 0.0);

  const rawGeo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevelSize * 1.1,
    bevelSize,
    bevelSegments: 4,
    curveSegments: 22
  });
  rawGeo.translate(0, 0, -depth * 0.5);

  const geo = subdivideGeometryOnce(THREE, rawGeo);
  rawGeo.dispose();

  // Bend the extruded ear into a soft cupped spoon shape
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const ny = clamp(y / (0.028 * s), 0, 1.2);
    const cupX = (x * x) * (24.0 * cupStrength);
    const cupY = Math.pow(ny, 1.8) * (0.0036 * s);
    // Curve edges forward (+z) and hollow center gently backward (-z)
    z += cupX - 0.0022 * Math.sin(ny * Math.PI) * cupStrength - cupY * 0.35;
    // Slight inward pinch at the base root
    x *= 1.0 - 0.14 * Math.exp(-ny * 4.5);

    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function buildEyeGroup(THREE, name, side, mats) {
  const eyeGroup = new THREE.Group();
  eyeGroup.name = name;

  const r = 0.0087;
  const scaleZ = 0.80;

  // Layer 1: Dark glossy eyeball
  const ballGeo = new THREE.SphereGeometry(r, 28, 22);
  ballGeo.scale(1.0, 1.04, scaleZ);
  const ballMesh = new THREE.Mesh(ballGeo, mats.eyeball);
  ballMesh.userData.slot = 'eye';
  ballMesh.castShadow = true;
  ballMesh.receiveShadow = true;
  eyeGroup.add(ballMesh);

  // Layer 2: Conformal coloured iris ring (curved front spherical cap annulus)
  const irisPts = [];
  const irisSteps = 12;
  for (let i = 0; i <= irisSteps; i++) {
    const ang = lerp(0.18, 0.72, i / irisSteps);
    const rad = Math.sin(ang) * (r * 1.018);
    const zVal = Math.cos(ang) * (r * scaleZ * 1.022);
    irisPts.push(new THREE.Vector2(rad, zVal));
  }
  const irisGeo = new THREE.LatheGeometry(irisPts, 32);
  irisGeo.rotateX(Math.PI * 0.5);
  // Map planar UVs so radial iris texture centers cleanly on the pupil
  const iPos = irisGeo.attributes.position;
  const iUv = irisGeo.attributes.uv;
  const maxIrisR = Math.sin(0.72) * (r * 1.018);
  for (let i = 0; i < iPos.count; i++) {
    const ix = iPos.getX(i);
    const iy = iPos.getY(i);
    iUv.setXY(i, 0.5 + (ix / (maxIrisR * 2.08)), 0.5 + (iy / (maxIrisR * 2.08)));
  }
  iUv.needsUpdate = true;
  irisGeo.scale(1.0, 1.04, 1.0);
  irisGeo.computeVertexNormals();

  const irisMesh = new THREE.Mesh(irisGeo, mats.iris);
  irisMesh.userData.slot = 'eye';
  eyeGroup.add(irisMesh);

  // Layer 3: Two crisp white specular highlight dots (consistent top-left lighting)
  const placeHighlight = (hx, hy, hr) => {
    const hGeo = new THREE.SphereGeometry(hr, 14, 10);
    hGeo.scale(1.0, 1.12, 0.32);
    const hMesh = new THREE.Mesh(hGeo, mats.highlight);
    hMesh.userData.slot = 'accent';

    // Project onto front ellipsoid surface
    const nx = hx / r;
    const ny = hy / (r * 1.04);
    const nz = Math.sqrt(Math.max(0.05, 1.0 - nx * nx - ny * ny));
    const surfaceZ = nz * r * scaleZ * 1.025;
    hMesh.position.set(hx, hy, surfaceZ);
    hMesh.lookAt(hx * 2.2, hy * 2.2, surfaceZ + 0.02);
    eyeGroup.add(hMesh);
  };

  // Both eyes share the same upper-left key light direction
  const lightX = side > 0 ? -0.0028 : -0.0026;
  placeHighlight(lightX, 0.0031, 0.00225);
  placeHighlight(-lightX * 0.85, -0.0027, 0.00095);

  return eyeGroup;
}

function buildBlushPatch(THREE, side, mat) {
  const segs = 10;
  const positions = [];
  const uvs = [];
  const indices = [];

  const centerDir = new THREE.Vector3(side * 0.60, -0.07, 0.795).normalize();
  const { t1, t2 } = evalHeadSurfaceAndNormal(THREE, centerDir);
  const spreadU = 0.24;
  const spreadV = 0.17;

  for (let iy = 0; iy <= segs; iy++) {
    const v = iy / segs;
    const dv = (v - 0.5) * 2.0 * spreadV;
    for (let ix = 0; ix <= segs; ix++) {
      const u = ix / segs;
      const du = (u - 0.5) * 2.0 * spreadU;
      const dir = centerDir.clone().addScaledVector(t1, du).addScaledVector(t2, dv).normalize();
      const { pos, normal } = evalHeadSurfaceAndNormal(THREE, dir);
      pos.addScaledVector(normal, 0.00075);
      positions.push(pos.x, pos.y, pos.z);
      uvs.push(u, v);
    }
  }

  for (let iy = 0; iy < segs; iy++) {
    for (let ix = 0; ix < segs; ix++) {
      const a = iy * (segs + 1) + ix;
      const b = a + 1;
      const c = a + (segs + 1);
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.slot = 'skin';
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

function buildSunflowerSeed(THREE, mats) {
  // 22-point rotational profile for LatheGeometry (pointed base, plump rounded shoulder)
  const pts = [];
  const numPts = 22;
  const halfLen = 0.0185;
  for (let i = 0; i <= numPts; i++) {
    const t = i / numPts;
    const y = lerp(-halfLen, halfLen, t);
    let r;
    if (i === 0 || i === numPts) {
      r = 0.0001;
    } else {
      // Classic teardrop-almond sunflower seed silhouette
      const swell = Math.pow(Math.sin(t * Math.PI), 0.72);
      const shoulder = 0.52 + 0.62 * smoothstep(0.0, 0.68, t) - 0.16 * smoothstep(0.72, 1.0, t);
      r = 0.0098 * swell * shoulder;
    }
    pts.push(new THREE.Vector2(r, y));
  }

  const geo = new THREE.LatheGeometry(pts, 36);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ang = Math.atan2(z, x);
    // Flatten into lenticular cross-section with crisp side husk ridges
    const ridge = 1.0 + 0.045 * Math.cos(ang * 2.0);
    pos.setXYZ(i, x * ridge, y, z * 0.54 * ridge);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, mats.seed);
  mesh.name = 'seed';
  mesh.userData.slot = 'primary';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildArmGroup(THREE, side, shoulderPos, graspWorldPos, seedCenter, mats) {
  const armGroup = new THREE.Group();
  armGroup.name = side > 0 ? 'armL' : 'armR';
  armGroup.position.copy(shoulderPos);

  const localGrasp = graspWorldPos.clone().sub(shoulderPos);
  const wristPos = localGrasp.clone().add(new THREE.Vector3(side * 0.0028, -0.0012, -0.0028));

  const elbowPos = new THREE.Vector3(
    lerp(0, wristPos.x, 0.42) + side * 0.0085,
    lerp(0, wristPos.y, 0.58) - 0.0068,
    lerp(0, wristPos.z, 0.48) + 0.0065
  );

  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-side * 0.006, 0.003, -0.006), // deep shoulder overlap
    new THREE.Vector3(side * 0.003, -0.001, 0.006),
    elbowPos,
    wristPos
  ]);

  const armGeo = buildTaperedTube(THREE, armCurve, 22, 16, (t) => {
    const baseR = lerp(0.0128, 0.0054, Math.pow(t, 0.85));
    const puff = 1.0 + 0.10 * Math.sin(t * Math.PI);
    return [baseR * puff, baseR * puff * 0.92];
  }, true, true);

  const armMesh = new THREE.Mesh(armGeo, mats.limbFur);
  armMesh.userData.slot = 'fur';
  armMesh.castShadow = true;
  armMesh.receiveShadow = true;
  armGroup.add(armMesh);

  // Sculpted little pink paw palm nestled right against the seed flank
  const palmGeo = new THREE.SphereGeometry(1, 20, 14);
  const pPos = palmGeo.attributes.position;
  for (let i = 0; i < pPos.count; i++) {
    const ux = pPos.getX(i), uy = pPos.getY(i), uz = pPos.getZ(i);
    pPos.setXYZ(i, ux * 0.0046, uy * 0.0044, uz * 0.0056);
  }
  pPos.needsUpdate = true;
  palmGeo.computeVertexNormals();

  const palmMesh = new THREE.Mesh(palmGeo, mats.skin);
  palmMesh.position.copy(localGrasp).add(new THREE.Vector3(side * 0.0014, -0.0005, -0.0010));
  palmMesh.userData.slot = 'skin';
  palmMesh.castShadow = true;
  palmMesh.receiveShadow = true;
  armGroup.add(palmMesh);

  // 4 delicate curved tapered fingers hugging the front curvature of the seed
  const localSeedCenter = seedCenter.clone().sub(shoulderPos);
  for (let f = 0; f < 4; f++) {
    const frac = (f - 1.5) / 1.5;
    const root = palmMesh.position.clone().add(new THREE.Vector3(-side * 0.0012, frac * 0.0026, 0.0025));
    const mid = root.clone().add(new THREE.Vector3(-side * 0.0030, frac * 0.0010, 0.0034));
    const tip = mid.clone().add(new THREE.Vector3(-side * 0.0032, frac * 0.0002, -0.0008));

    // Gently keep fingers hugging outside the seed surface
    const toTip = tip.clone().sub(localSeedCenter);
    if (toTip.z < 0.0042) tip.z = localSeedCenter.z + 0.0046;

    const fCurve = new THREE.CatmullRomCurve3([root, mid, tip]);
    const fGeo = buildTaperedTube(THREE, fCurve, 8, 8, (t) => lerp(0.00135, 0.00075, t), true, true);
    const fMesh = new THREE.Mesh(fGeo, mats.skin);
    fMesh.userData.slot = 'skin';
    fMesh.castShadow = true;
    armGroup.add(fMesh);

    // Tiny glossy claw tip
    const clawDir = tip.clone().sub(mid).normalize();
    const clawCurve = new THREE.CatmullRomCurve3([
      tip.clone().addScaledVector(clawDir, -0.0003),
      tip.clone().addScaledVector(clawDir, 0.0015)
    ]);
    const clawGeo = buildTaperedTube(THREE, clawCurve, 4, 6, (t) => lerp(0.00055, 0.00012, t), false, true);
    const clawMesh = new THREE.Mesh(clawGeo, mats.claw);
    clawMesh.userData.slot = 'secondary';
    armGroup.add(clawMesh);
  }

  return armGroup;
}

function buildFootGroup(THREE, side, pos, yaw, mats) {
  const legGroup = new THREE.Group();
  legGroup.name = side > 0 ? 'legL' : 'legR';
  legGroup.position.copy(pos);
  legGroup.rotation.y = yaw;

  // Furry ankle cuff overlapping deeply into the lower body haunch
  const cuffGeo = new THREE.SphereGeometry(1, 20, 16);
  const cPos = cuffGeo.attributes.position;
  for (let i = 0; i < cPos.count; i++) {
    const ux = cPos.getX(i), uy = cPos.getY(i), uz = cPos.getZ(i);
    let x = ux * 0.0115;
    let y = uy * 0.0105 + 0.0095;
    let z = uz * 0.0125 - 0.0075;
    if (y < 0.001) y = 0.001;
    cPos.setXYZ(i, x, y, z);
  }
  cPos.needsUpdate = true;
  cuffGeo.computeVertexNormals();
  const cuffMesh = new THREE.Mesh(cuffGeo, mats.limbFur);
  cuffMesh.userData.slot = 'fur';
  cuffMesh.castShadow = true;
  cuffMesh.receiveShadow = true;
  legGroup.add(cuffMesh);

  // Sculpted flat-bottomed pink hind foot resting cleanly on y = 0
  const footGeo = new THREE.SphereGeometry(1, 26, 18);
  const fPos = footGeo.attributes.position;
  let minY = Infinity;
  const pts = new Float32Array(fPos.count * 3);
  for (let i = 0; i < fPos.count; i++) {
    const ux = fPos.getX(i), uy = fPos.getY(i), uz = fPos.getZ(i);
    const frontWiden = 1.0 + 0.24 * smoothstep(-0.4, 0.8, uz);
    let x = ux * 0.0096 * frontWiden;
    let y = uy * 0.0058 + 0.0052;
    let z = uz * 0.0155 + 0.0045;
    // Softly flatten underside onto the floor
    const k = 0.0022;
    y = 0.5 * (y + Math.sqrt(y * y + k * k));
    pts[i * 3] = x;
    pts[i * 3 + 1] = y;
    pts[i * 3 + 2] = z;
    if (y < minY) minY = y;
  }
  for (let i = 0; i < fPos.count; i++) {
    fPos.setXYZ(i, pts[i * 3], pts[i * 3 + 1] - minY, pts[i * 3 + 2]);
  }
  fPos.needsUpdate = true;
  footGeo.computeVertexNormals();

  const footMesh = new THREE.Mesh(footGeo, mats.skin);
  footMesh.userData.slot = 'skin';
  footMesh.castShadow = true;
  footMesh.receiveShadow = true;
  legGroup.add(footMesh);

  // 4 cute plump splayed toes + glossy claws resting on the floor
  const toeAngles = [-0.42, -0.14, 0.14, 0.42];
  const toeLens = [0.0072, 0.0086, 0.0084, 0.0070];
  for (let i = 0; i < 4; i++) {
    const a = toeAngles[i];
    const len = toeLens[i];
    const sx = Math.sin(a) * 0.0078;
    const sz = 0.0162 + Math.cos(a) * 0.0018;
    const ex = sx + Math.sin(a) * len;
    const ez = sz + Math.cos(a) * len;

    const tCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx, 0.0038, sz - 0.0022),
      new THREE.Vector3(lerp(sx, ex, 0.55), 0.0036, lerp(sz, ez, 0.55)),
      new THREE.Vector3(ex, 0.0020, ez)
    ]);
    const tGeo = buildTaperedTube(THREE, tCurve, 8, 8, (t) => lerp(0.0023, 0.00155, t), true, true);
    const tMesh = new THREE.Mesh(tGeo, mats.skin);
    tMesh.userData.slot = 'skin';
    tMesh.castShadow = true;
    tMesh.receiveShadow = true;
    legGroup.add(tMesh);

    const clawCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ex, 0.0020, ez),
      new THREE.Vector3(ex + Math.sin(a) * 0.0024, 0.0010, ez + Math.cos(a) * 0.0024)
    ]);
    const clawGeo = buildTaperedTube(THREE, clawCurve, 5, 6, (t) => lerp(0.00085, 0.00018, t), false, true);
    const clawMesh = new THREE.Mesh(clawGeo, mats.claw);
    clawMesh.userData.slot = 'secondary';
    clawMesh.castShadow = true;
    legGroup.add(clawMesh);
  }

  return legGroup;
}

export function build(THREE, opts = {}, kit) {
  const pal = resolvePalette(THREE, opts);

  const furBump = createFurBumpTexture(THREE, kit);
  const bodyFurTex = createBodyFurTexture(THREE, kit, pal);
  const headFurTex = createHeadFurTexture(THREE, kit, pal);
  const irisTex = createIrisTexture(THREE, kit, pal.eyeCol);
  const blushTex = createBlushTexture(THREE, kit);
  const seedTex = createSunflowerSeedTextures(THREE, kit);

  const mats = {
    bodyFur: new THREE.MeshPhysicalMaterial({
      map: bodyFurTex,
      bumpMap: furBump,
      bumpScale: 0.0013,
      roughness: 0.92,
      metalness: 0.0,
      sheen: 0.88,
      sheenRoughness: 0.68,
      sheenColor: pal.sheenCol
    }),
    headFur: new THREE.MeshPhysicalMaterial({
      map: headFurTex,
      bumpMap: furBump,
      bumpScale: 0.0012,
      roughness: 0.92,
      metalness: 0.0,
      sheen: 0.88,
      sheenRoughness: 0.68,
      sheenColor: pal.sheenCol
    }),
    limbFur: new THREE.MeshPhysicalMaterial({
      color: pal.variant === 1 ? pal.accentCol : pal.furCol.clone().lerp(pal.accentCol, 0.42),
      bumpMap: furBump,
      bumpScale: 0.0011,
      roughness: 0.93,
      metalness: 0.0,
      sheen: 0.85,
      sheenRoughness: 0.70,
      sheenColor: pal.sheenCol
    }),
    earFur: new THREE.MeshPhysicalMaterial({
      color: pal.furCol.clone().multiplyScalar(pal.variant === 2 ? 0.96 : 0.88),
      bumpMap: furBump,
      bumpScale: 0.0009,
      roughness: 0.90,
      metalness: 0.0,
      sheen: 0.82,
      sheenRoughness: 0.65,
      sheenColor: pal.sheenCol
    }),
    skin: new THREE.MeshPhysicalMaterial({
      color: pal.skinCol,
      roughness: 0.76,
      metalness: 0.0,
      sheen: 0.35,
      sheenRoughness: 0.75,
      sheenColor: new THREE.Color(0xffe6e0)
    }),
    nose: new THREE.MeshPhysicalMaterial({
      color: pal.noseCol,
      roughness: 0.38,
      metalness: 0.0,
      clearcoat: 0.48,
      clearcoatRoughness: 0.24
    }),
    mouth: new THREE.MeshPhysicalMaterial({
      color: 0x5c3638,
      roughness: 0.65,
      metalness: 0.0
    }),
    whisker: new THREE.MeshPhysicalMaterial({
      color: 0xf9f3ea,
      roughness: 0.42,
      metalness: 0.0,
      sheen: 0.5,
      sheenColor: new THREE.Color(0xffffff)
    }),
    eyeball: new THREE.MeshPhysicalMaterial({
      color: 0x0b080a,
      roughness: 0.05,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04
    }),
    iris: new THREE.MeshPhysicalMaterial({
      map: irisTex,
      roughness: 0.10,
      metalness: 0.0,
      clearcoat: 0.95,
      clearcoatRoughness: 0.04
    }),
    highlight: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.38,
      roughness: 0.04,
      clearcoat: 1.0
    }),
    blush: new THREE.MeshPhysicalMaterial({
      map: blushTex,
      transparent: true,
      opacity: 0.76,
      roughness: 0.95,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1
    }),
    claw: new THREE.MeshPhysicalMaterial({
      color: 0xf4e4d4,
      roughness: 0.24,
      metalness: 0.0,
      clearcoat: 0.78,
      clearcoatRoughness: 0.16
    }),
    seed: new THREE.MeshPhysicalMaterial({
      map: seedTex.colorTex,
      bumpMap: seedTex.bumpTex,
      bumpScale: 0.0010,
      roughness: 0.58,
      metalness: 0.0,
      clearcoat: 0.18,
      clearcoatRoughness: 0.42
    })
  };

  const root = new THREE.Group();
  root.name = 'hamster';

  // --- BODY GROUP (anchored on floor at y = 0 for grounded breathing) ---
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  const bodyMesh = new THREE.Mesh(buildSculptedBody(THREE), mats.bodyFur);
  bodyMesh.userData.slot = 'fur';
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  body.add(bodyMesh);

  // --- CURLED STUBBY TAIL (tapered tube) ---
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(0.0, 0.017, -0.048);
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0.007),
    new THREE.Vector3(0.0015, 0.0015, -0.004),
    new THREE.Vector3(0.0042, 0.0062, -0.0135),
    new THREE.Vector3(0.0052, 0.0120, -0.0155)
  ]);
  const tailGeo = buildTaperedTube(THREE, tailCurve, 16, 14, (t) => {
    const r = lerp(0.0095, 0.0054, t);
    return r * (1.0 + 0.14 * Math.sin(t * Math.PI));
  }, true, true);
  const tailMesh = new THREE.Mesh(tailGeo, mats.limbFur);
  tailMesh.userData.slot = 'fur';
  tailMesh.castShadow = true;
  tailMesh.receiveShadow = true;
  tail.add(tailMesh);
  body.add(tail);

  // --- SUNFLOWER SEED (LatheGeometry, flattened & striped) ---
  const seed = buildSunflowerSeed(THREE, mats);
  seed.position.set(0.0, 0.072, 0.056);
  seed.rotation.set(0.24, 0.12, -0.20);
  seed.updateMatrix();
  body.add(seed);

  // Compute exact asymmetric grasp points on left & right flanks of the tilted seed
  const graspL = new THREE.Vector3(0.0094, 0.0028, 0.0006).applyMatrix4(seed.matrix);
  const graspR = new THREE.Vector3(-0.0094, -0.0026, 0.0008).applyMatrix4(seed.matrix);

  // --- ARMS & PAWS HOLDING THE SEED ---
  const armL = buildArmGroup(THREE, 1, new THREE.Vector3(0.034, 0.079, 0.017), graspL, seed.position, mats);
  const armR = buildArmGroup(THREE, -1, new THREE.Vector3(-0.034, 0.078, 0.017), graspR, seed.position, mats);
  body.add(armL);
  body.add(armR);

  // --- FEET (grounded directly on root at y = 0) ---
  const legL = buildFootGroup(THREE, 1, new THREE.Vector3(0.0265, 0, 0.037), 0.42, mats);
  const legR = buildFootGroup(THREE, -1, new THREE.Vector3(-0.0265, 0, 0.040), -0.34, mats);
  root.add(legL);
  root.add(legR);

  // --- HEAD GROUP (gentle tilted chibi pose, deeply overlapped into neck) ---
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0.0, 0.092, 0.008);
  head.rotation.set(0.07, -0.07, 0.09);
  body.add(head);

  const headMesh = new THREE.Mesh(buildSculptedHead(THREE), mats.headFur);
  headMesh.userData.slot = 'fur';
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  head.add(headMesh);

  // --- EARS (bent ExtrudeGeometry with outer fur + inset soft pink inner ear) ---
  const outerEarGeo = buildEarShellGeometry(THREE, 1.0, 0.0020, 0.0014, 1.0);
  const innerEarGeo = buildEarShellGeometry(THREE, 0.72, 0.0010, 0.0008, 1.15);

  const makeEar = (side) => {
    const earGroup = new THREE.Group();
    earGroup.name = side > 0 ? 'earL' : 'earR';
    const rootDir = new THREE.Vector3(side * 0.64, 0.73, -0.18).normalize();
    const { pos } = evalHeadSurfaceAndNormal(THREE, rootDir);
    earGroup.position.copy(pos).add(new THREE.Vector3(-side * 0.003, -0.004, 0.001));
    earGroup.rotation.set(-0.16, side * 0.34, -side * 0.48 + (side > 0 ? 0.04 : 0));

    const outerMesh = new THREE.Mesh(outerEarGeo, mats.earFur);
    outerMesh.userData.slot = 'fur';
    outerMesh.castShadow = true;
    outerMesh.receiveShadow = true;
    earGroup.add(outerMesh);

    const innerMesh = new THREE.Mesh(innerEarGeo, mats.skin);
    innerMesh.position.set(0, 0.0035, 0.0015);
    innerMesh.userData.slot = 'skin';
    innerMesh.receiveShadow = true;
    earGroup.add(innerMesh);

    return earGroup;
  };

  const earL = makeEar(1);
  const earR = makeEar(-1);
  head.add(earL);
  head.add(earR);

  // --- EYES (3-layer glossy eyes nestled inside the sculpted sockets) ---
  const placeEye = (side) => {
    const dir = new THREE.Vector3(side * 0.43, 0.17, 0.886).normalize();
    const { pos, normal } = evalHeadSurfaceAndNormal(THREE, dir);
    const eyeGroup = buildEyeGroup(THREE, side > 0 ? 'eyeL' : 'eyeR', side, mats);
    // Slightly inset along inward normal so eyes sit snugly in the face
    eyeGroup.position.copy(pos).addScaledVector(normal, -0.0024);
    const lookDir = normal.clone().lerp(new THREE.Vector3(0, 0.03, 1), 0.38).normalize();
    eyeGroup.lookAt(eyeGroup.position.clone().add(lookDir));
    head.add(eyeGroup);
    return eyeGroup;
  };

  const eyeL = placeEye(1);
  const eyeR = placeEye(-1);

  // --- SCULPTED NOSE ---
  const noseDir = new THREE.Vector3(0, -0.10, 0.995).normalize();
  const { pos: nosePos } = evalHeadSurfaceAndNormal(THREE, noseDir);
  const noseGeo = new THREE.SphereGeometry(1, 24, 18);
  const nPos = noseGeo.attributes.position;
  for (let i = 0; i < nPos.count; i++) {
    const ux = nPos.getX(i), uy = nPos.getY(i), uz = nPos.getZ(i);
    // Soft rounded inverted-triangle nose shape
    const tri = 1.0 + 0.28 * uy;
    let x = ux * 0.0046 * tri;
    let y = uy * 0.0033;
    let z = uz * 0.0035;
    // Tiny cute nostril dimples on lower front sides
    const nDimple = (Math.exp(-Math.pow((Math.abs(ux) - 0.46) / 0.24, 2)) *
      Math.exp(-Math.pow((uy + 0.34) / 0.26, 2)) * Math.max(0, uz)) * 0.0008;
    z -= nDimple;
    nPos.setXYZ(i, x, y, z);
  }
  nPos.needsUpdate = true;
  noseGeo.computeVertexNormals();

  const noseMesh = new THREE.Mesh(noseGeo, mats.nose);
  noseMesh.position.copy(nosePos).add(new THREE.Vector3(0, 0.0004, -0.0004));
  noseMesh.userData.slot = 'skin';
  noseMesh.castShadow = true;
  noseMesh.receiveShadow = true;
  head.add(noseMesh);

  // --- CURVED "W" MOUTH LINE (thin tapered tubes hugging muzzle surface) ---
  for (const side of [1, -1]) {
    const sampleMouth = (dx, dy) => {
      const d = new THREE.Vector3(dx, dy, 0.98).normalize();
      const { pos, normal } = evalHeadSurfaceAndNormal(THREE, d);
      return pos.addScaledVector(normal, 0.00045);
    };
    const mCurve = new THREE.CatmullRomCurve3([
      sampleMouth(0.0, -0.22),
      sampleMouth(side * 0.04, -0.29),
      sampleMouth(side * 0.13, -0.32),
      sampleMouth(side * 0.21, -0.27)
    ]);
    const mGeo = buildTaperedTube(THREE, mCurve, 12, 8, (t) => lerp(0.00080, 0.00042, t), true, true);
    const mMesh = new THREE.Mesh(mGeo, mats.mouth);
    mMesh.userData.slot = 'accent';
    head.add(mMesh);
  }

  // --- SUBTLE BLUSH DISCS (curved patches conforming to cheek surface) ---
  head.add(buildBlushPatch(THREE, 1, mats.blush));
  head.add(buildBlushPatch(THREE, -1, mats.blush));

  // --- WHISKERS (fine tapered tubes arching from both whisker pads) ---
  const whiskerSpecs = [
    { dy: -0.18, spreadY: 0.0055, spreadZ: 0.005, len: 0.032 },
    { dy: -0.23, spreadY: 0.0010, spreadZ: 0.007, len: 0.038 },
    { dy: -0.28, spreadY: -0.0040, spreadZ: 0.004, len: 0.034 },
    { dy: -0.33, spreadY: -0.0082, spreadZ: 0.001, len: 0.026 }
  ];
  for (const side of [1, -1]) {
    for (let i = 0; i < whiskerSpecs.length; i++) {
      const ws = whiskerSpecs[i];
      const padDir = new THREE.Vector3(side * (0.28 + i * 0.02), ws.dy, 0.93).normalize();
      const { pos, normal } = evalHeadSurfaceAndNormal(THREE, padDir);
      const p0 = pos.clone().addScaledVector(normal, -0.0022);
      const p1 = pos.clone().add(new THREE.Vector3(side * ws.len * 0.45, ws.spreadY * 0.45, ws.spreadZ * 0.7));
      const p2 = pos.clone().add(new THREE.Vector3(side * ws.len, ws.spreadY - 0.0032, ws.spreadZ - 0.005));

      const wCurve = new THREE.CatmullRomCurve3([p0, p1, p2]);
      const wGeo = buildTaperedTube(THREE, wCurve, 10, 6, (t) => lerp(0.00050, 0.00011, t), false, true);
      const wMesh = new THREE.Mesh(wGeo, mats.whisker);
      wMesh.userData.slot = 'furAccent';
      head.add(wMesh);
    }
  }

  // Store rest pose for deterministic idle animation
  const storeBase = (obj) => {
    obj.userData.basePos = obj.position.clone();
    obj.userData.baseRot = obj.rotation.clone();
    obj.userData.baseScale = obj.scale.clone();
  };
  [body, head, earL, earR, tail, armL, armR, seed, eyeL, eyeR].forEach(storeBase);

  root.userData.rig = { body, head, earL, earR, tail, armL, armR, seed, eyeL, eyeR };
  return root;
}

export function idle(group, t) {
  if (!group) return;
  const rig = group.userData && group.userData.rig;
  const body = (rig && rig.body) || group.getObjectByName('body');
  const head = (rig && rig.head) || group.getObjectByName('head');
  const earL = (rig && rig.earL) || group.getObjectByName('earL');
  const earR = (rig && rig.earR) || group.getObjectByName('earR');
  const tail = (rig && rig.tail) || group.getObjectByName('tail');
  const armL = (rig && rig.armL) || group.getObjectByName('armL');
  const armR = (rig && rig.armR) || group.getObjectByName('armR');
  const seed = (rig && rig.seed) || group.getObjectByName('seed');
  const eyeL = (rig && rig.eyeL) || group.getObjectByName('eyeL');
  const eyeR = (rig && rig.eyeR) || group.getObjectByName('eyeR');

  // Soft cozy breathing anchored on the floor (y = 0)
  const breath = Math.sin(t * 2.5);
  if (body && body.userData.baseScale) {
    const bs = body.userData.baseScale;
    body.scale.set(
      bs.x * (1.0 + 0.013 * breath),
      bs.y * (1.0 + 0.018 * breath),
      bs.z * (1.0 + 0.015 * breath)
    );
  }

  // Gentle curious head sway & micro-nod
  if (head && head.userData.baseRot) {
    const br = head.userData.baseRot;
    head.rotation.x = br.x + Math.sin(t * 2.5 - 0.4) * 0.025 + Math.sin(t * 1.1) * 0.022;
    head.rotation.y = br.y + Math.sin(t * 0.72) * 0.065 + Math.sin(t * 1.65) * 0.018;
    head.rotation.z = br.z + Math.sin(t * 0.95 + 0.6) * 0.038;
  }

  // Subtle ear sway + cute occasional quick ear twitch
  const twitchPhase = (t + 0.8) % 4.6;
  const earTwitch = twitchPhase < 0.24 ? Math.sin((twitchPhase / 0.24) * Math.PI * 2) * 0.14 : 0;
  if (earL && earL.userData.baseRot) {
    const br = earL.userData.baseRot;
    earL.rotation.z = br.z + Math.sin(t * 1.9) * 0.032 + earTwitch;
    earL.rotation.x = br.x + Math.cos(t * 1.4) * 0.024;
  }
  if (earR && earR.userData.baseRot) {
    const br = earR.userData.baseRot;
    earR.rotation.z = br.z - Math.sin(t * 1.9 + 0.4) * 0.032 - earTwitch * 0.35;
    earR.rotation.x = br.x + Math.cos(t * 1.4 + 0.5) * 0.024;
  }

  // Playful little nibble fidget with paws & sunflower seed
  const nibbleWindow = (t % 5.2);
  const nibbleEnv = nibbleWindow < 1.35 ? Math.sin((nibbleWindow / 1.35) * Math.PI) : 0;
  const nibble = Math.sin(t * 16.0) * 0.022 * nibbleEnv;

  if (armL && armL.userData.baseRot) {
    armL.rotation.x = armL.userData.baseRot.x + nibble + breath * 0.016;
  }
  if (armR && armR.userData.baseRot) {
    armR.rotation.x = armR.userData.baseRot.x - nibble * 0.8 + breath * 0.016;
  }
  if (seed && seed.userData.basePos && seed.userData.baseRot) {
    seed.position.y = seed.userData.basePos.y + Math.abs(nibble) * 0.045;
    seed.rotation.z = seed.userData.baseRot.z + nibble * 1.2;
  }

  // Tiny soft tail wiggle
  if (tail && tail.userData.baseRot) {
    tail.rotation.y = tail.userData.baseRot.y + Math.sin(t * 3.1) * 0.075;
    tail.rotation.x = tail.userData.baseRot.x + Math.cos(t * 2.5) * 0.035;
  }

  // Smooth periodic blink every ~3.8 seconds by scaling eye groups on Y
  const blinkCycle = (t + 1.4) % 3.8;
  let eyeScaleY = 1.0;
  if (blinkCycle < 0.16) {
    const p = blinkCycle / 0.16;
    eyeScaleY = 1.0 - 0.92 * Math.sin(p * Math.PI);
  }
  if (eyeL && eyeL.userData.baseScale) {
    eyeL.scale.y = eyeL.userData.baseScale.y * eyeScaleY;
  }
  if (eyeR && eyeR.userData.baseScale) {
    eyeR.scale.y = eyeR.userData.baseScale.y * eyeScaleY;
  }
}
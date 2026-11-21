export const META = {
  id: 'panda-cub',
  name: 'Bamboo Panda Cub',
  kind: 'creature',
  footprint: [0.30, 0.28],
  variants: ['munch', 'proud', 'cradle'],
  note: 'Stylised 0.4 m sitting giant panda cub sculpted with continuous organic forms, layered glossy eyes, plush fur textures, and a lathe-sculpted leafy bamboo stalk.'
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function fbm(kit, x, y, octaves = 3) {
  let val = 0;
  let amp = 0.55;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    val += amp * kit.noise(x * freq + 113.7, y * freq + 241.3);
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return val / norm;
}

function colorRGB(THREE, input, fallback) {
  const c = new THREE.Color(input !== undefined && input !== null ? input : fallback);
  return { r: c.r, g: c.g, b: c.b, color: c };
}

function lighterHex(THREE, input, amount) {
  const c = new THREE.Color(input);
  c.lerp(new THREE.Color(0xffffff), amount);
  return c;
}

function computeParallelFrames(THREE, curve, segments) {
  const tangents = [];
  const normals = [];
  const binormals = [];
  const up = new THREE.Vector3(0, 1, 0);
  const alt = new THREE.Vector3(1, 0, 0);

  for (let i = 0; i <= segments; i++) {
    tangents.push(curve.getTangent(i / segments).normalize());
  }

  let n0 = new THREE.Vector3().crossVectors(tangents[0], up);
  if (n0.lengthSq() < 1e-4) {
    n0 = new THREE.Vector3().crossVectors(tangents[0], alt);
  }
  n0.normalize();
  const b0 = new THREE.Vector3().crossVectors(tangents[0], n0).normalize();
  normals.push(n0);
  binormals.push(b0);

  const axis = new THREE.Vector3();
  const q = new THREE.Quaternion();
  for (let i = 1; i <= segments; i++) {
    const prevT = tangents[i - 1];
    const currT = tangents[i];
    const nextN = normals[i - 1].clone();
    axis.crossVectors(prevT, currT);
    const sinLen = axis.length();
    if (sinLen > 1e-5) {
      axis.divideScalar(sinLen);
      const angle = Math.acos(clamp(prevT.dot(currT), -1, 1));
      q.setFromAxisAngle(axis, angle);
      nextN.applyQuaternion(q);
    }
    nextN.sub(currT.clone().multiplyScalar(nextN.dot(currT))).normalize();
    const nextB = new THREE.Vector3().crossVectors(currT, nextN).normalize();
    normals.push(nextN);
    binormals.push(nextB);
  }

  return { tangents, normals, binormals };
}

function createTaperedTubeGeometry(THREE, curve, config = {}) {
  const tubularSegments = config.tubularSegments || 28;
  const radialSegments = config.radialSegments || 18;
  const radiusFn = config.radiusFn || (() => 0.02);
  const ovalFn = config.ovalFn || null;
  const capStart = config.capStart !== undefined ? config.capStart : true;
  const capEnd = config.capEnd !== undefined ? config.capEnd : true;
  const capRings = config.capRings || 4;
  const postVertex = config.postVertex || null;

  const frames = computeParallelFrames(THREE, curve, tubularSegments);
  const rings = [];

  const pushRing = (center, nVec, bVec, rx, ry, vCoord) => {
    rings.push({ center, nVec, bVec, rx, ry, vCoord });
  };

  if (capStart) {
    const p0 = curve.getPoint(0);
    const t0 = frames.tangents[0];
    const n0 = frames.normals[0];
    const b0 = frames.binormals[0];
    const r0 = radiusFn(0);
    const [ox0, oy0] = ovalFn ? ovalFn(0) : [1, 1];
    const capDepth = r0 * 0.72;
    for (let c = capRings; c >= 1; c--) {
      const a = (c / capRings) * (Math.PI * 0.5);
      const s = Math.cos(a);
      const d = Math.sin(a) * capDepth;
      const center = p0.clone().addScaledVector(t0, -d);
      pushRing(center, n0, b0, Math.max(1e-5, r0 * ox0 * s), Math.max(1e-5, r0 * oy0 * s), 0);
    }
  }

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments;
    const p = curve.getPoint(u);
    const r = radiusFn(u);
    const [ox, oy] = ovalFn ? ovalFn(u) : [1, 1];
    pushRing(p, frames.normals[i], frames.binormals[i], r * ox, r * oy, u);
  }

  if (capEnd) {
    const p1 = curve.getPoint(1);
    const t1 = frames.tangents[tubularSegments];
    const n1 = frames.normals[tubularSegments];
    const b1 = frames.binormals[tubularSegments];
    const r1 = radiusFn(1);
    const [ox1, oy1] = ovalFn ? ovalFn(1) : [1, 1];
    const capDepth = r1 * 0.78;
    for (let c = 1; c <= capRings; c++) {
      const a = (c / capRings) * (Math.PI * 0.5);
      const s = Math.cos(a);
      const d = Math.sin(a) * capDepth;
      const center = p1.clone().addScaledVector(t1, d);
      pushRing(center, n1, b1, Math.max(1e-5, r1 * ox1 * s), Math.max(1e-5, r1 * oy1 * s), 1);
    }
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const vTmp = new THREE.Vector3();

  for (let rIdx = 0; rIdx < rings.length; rIdx++) {
    const ring = rings[rIdx];
    for (let j = 0; j <= radialSegments; j++) {
      const frac = j / radialSegments;
      const theta = frac * Math.PI * 2;
      const cs = Math.cos(theta);
      const sn = Math.sin(theta);
      vTmp.copy(ring.center)
        .addScaledVector(ring.nVec, cs * ring.rx)
        .addScaledVector(ring.bVec, sn * ring.ry);
      if (postVertex) postVertex(vTmp, ring.vCoord, theta);
      positions.push(vTmp.x, vTmp.y, vTmp.z);
      uvs.push(frac, ring.vCoord);
    }
  }

  const stride = radialSegments + 1;
  for (let rIdx = 0; rIdx < rings.length - 1; rIdx++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = rIdx * stride + j;
      const b = (rIdx + 1) * stride + j;
      const c = (rIdx + 1) * stride + j + 1;
      const d = rIdx * stride + j + 1;
      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return { geometry: geo, frames };
}

function sculptHeadPoint(nx, ny, nz, out) {
  const rx = 0.091;
  const ry = 0.079;
  const rz = 0.082;

  const cheekWiden =
    1.0 +
    0.15 * Math.exp(-Math.pow((ny + 0.25) / 0.42, 2)) -
    0.12 * Math.max(0, ny - 0.22);

  let x = nx * rx * cheekWiden;
  let y = ny * ry * (1.0 - 0.04 * Math.max(0, -ny - 0.55));
  let z = nz * rz * (1.0 - 0.06 * Math.max(0, ny - 0.45));

  const ax = Math.abs(nx);
  const cheekBulge =
    0.0115 *
    Math.exp(
      -(Math.pow((ax - 0.56) / 0.38, 2) +
        Math.pow((ny + 0.26) / 0.34, 2) +
        Math.pow((nz - 0.56) / 0.46, 2))
    );
  x += Math.sign(nx) * cheekBulge * 0.92;
  z += cheekBulge * 0.48;
  y -= cheekBulge * 0.14;

  const frontMask = smoothstep(0.32, 0.92, nz);
  const snoutBell =
    Math.exp(-(nx * nx / 0.155 + Math.pow((ny + 0.22) / 0.34, 2))) * frontMask;
  z += 0.0225 * snoutBell;
  y -= 0.0038 * snoutBell;

  const padMask = smoothstep(0.62, 0.96, nz);
  const padL = Math.exp(-(Math.pow((nx - 0.15) / 0.16, 2) + Math.pow((ny + 0.27) / 0.16, 2)));
  const padR = Math.exp(-(Math.pow((nx + 0.15) / 0.16, 2) + Math.pow((ny + 0.27) / 0.16, 2)));
  z += 0.0044 * (padL + padR) * padMask;

  const bridge =
    Math.exp(-(nx * nx / 0.055 + Math.pow((ny + 0.03) / 0.24, 2))) *
    smoothstep(0.62, 0.98, nz);
  z += 0.0055 * bridge;

  const brow =
    (Math.exp(-(Math.pow((nx - 0.31) / 0.24, 2) + Math.pow((ny - 0.27) / 0.18, 2))) +
      Math.exp(-(Math.pow((nx + 0.31) / 0.24, 2) + Math.pow((ny - 0.27) / 0.18, 2)))) *
    smoothstep(0.45, 0.92, nz);
  z += 0.0034 * brow;

  const eLen = Math.hypot(0.365, 0.015, 0.931);
  const ex = 0.365 / eLen;
  const ey = 0.015 / eLen;
  const ez = 0.931 / eLen;
  const d2L = (nx - ex) ** 2 + (ny - ey) ** 2 + (nz - ez) ** 2;
  const d2R = (nx + ex) ** 2 + (ny - ey) ** 2 + (nz - ez) ** 2;
  const socket = Math.exp(-d2L / 0.030) + Math.exp(-d2R / 0.030);
  x -= nx * 0.0052 * socket;
  y -= ny * 0.0050 * socket;
  z -= nz * 0.0064 * socket;

  const chinFlatten = smoothstep(-0.55, -0.95, ny);
  y += 0.006 * chinFlatten;
  const napeTuck = smoothstep(-0.35, -0.82, ny) * smoothstep(-0.1, -0.85, nz);
  z += 0.007 * napeTuck;

  out.set(x, y, z);
  return out;
}

function sculptHeadNormal(THREE, nx, ny, nz) {
  const base = new THREE.Vector3(nx, ny, nz).normalize();
  const ref = Math.abs(base.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const t1 = new THREE.Vector3().crossVectors(ref, base).normalize();
  const t2 = new THREE.Vector3().crossVectors(base, t1).normalize();
  const eps = 0.012;
  const p0 = sculptHeadPoint(base.x, base.y, base.z, new THREE.Vector3());
  const d1 = base.clone().addScaledVector(t1, eps).normalize();
  const d2 = base.clone().addScaledVector(t2, eps).normalize();
  const p1 = sculptHeadPoint(d1.x, d1.y, d1.z, new THREE.Vector3());
  const p2 = sculptHeadPoint(d2.x, d2.y, d2.z, new THREE.Vector3());
  const n = new THREE.Vector3().crossVectors(p1.sub(p0), p2.sub(p0)).normalize();
  if (n.dot(base) < 0) n.negate();
  return n;
}

function sculptBodyPoint(nx, ny, nz, out) {
  const rx = 0.104;
  const ry = 0.112;
  const rz = 0.098;

  const widthProfile =
    1.0 -
    0.26 * smoothstep(-0.22, 0.88, ny) +
    0.10 * Math.exp(-Math.pow((ny + 0.34) / 0.40, 2));

  let x = nx * rx * widthProfile;

  const bellyBulge =
    0.019 *
    Math.exp(-Math.pow((ny + 0.26) / 0.46, 2)) *
    smoothstep(-0.12, 0.85, nz);
  const rumpBulge =
    0.013 *
    Math.exp(-Math.pow((ny + 0.42) / 0.40, 2)) *
    smoothstep(0.0, 0.9, -nz);
  const upperBack =
    0.008 *
    Math.exp(-Math.pow((ny - 0.36) / 0.38, 2)) *
    smoothstep(0.08, 0.9, -nz);
  const spineGroove =
    0.0028 *
    Math.exp(-(nx * nx) / 0.032) *
    smoothstep(0.32, 0.92, -nz) *
    Math.exp(-Math.pow((ny - 0.02) / 0.62, 2));

  let z =
    nz * rz * (1.0 - 0.19 * smoothstep(0.02, 0.90, ny)) +
    bellyBulge -
    rumpBulge -
    upperBack +
    spineGroove;

  const neckPinch = smoothstep(0.68, 0.98, ny);
  x *= 1.0 - 0.16 * neckPinch;
  z *= 1.0 - 0.14 * neckPinch;

  let y = 0.104 + ny * ry;

  const floorZone = 0.036;
  if (y < floorZone) {
    const d = (floorZone - y) / (floorZone + 0.016);
    const flat = Math.tanh(d * 1.55);
    y = floorZone * (1.0 - flat);
    const spread = 1.0 + 0.05 * flat;
    x *= spread;
    z *= spread;
  }

  out.set(x, y, z);
  return out;
}

function makeHeadTextures(THREE, kit, furHex, accentHex) {
  const fur = colorRGB(THREE, furHex, '#f5f0e6');
  const dark = colorRGB(THREE, accentHex, '#232229');
  const blush = { r: 0.93, g: 0.60, b: 0.59 };
  const shadow = { r: fur.r * 0.84, g: fur.g * 0.81, b: fur.b * 0.78 };

  const pLen = Math.hypot(0.415, -0.025, 0.909);
  const px0 = 0.415 / pLen;
  const py0 = -0.025 / pLen;
  const pz0 = 0.909 / pLen;
  const cosTilt = Math.cos(0.42);
  const sinTilt = Math.sin(0.42);

  const w = 512;
  const h = 256;
  const bumpBuf = new Uint8ClampedArray(w * h * 4);

  const colorTex = kit.canvasTexture(w, h, (ctx, cw, ch) => {
    const img = ctx.createImageData(cw, ch);
    const data = img.data;

    for (let iy = 0; iy < ch; iy++) {
      const v = 1 - iy / (ch - 1);
      const theta = (1 - v) * Math.PI;
      const sinT = Math.sin(theta);
      const ny = Math.cos(theta);

      for (let ix = 0; ix < cw; ix++) {
        const u = ix / (cw - 1);
        const phi = u * Math.PI * 2;
        const nx = -Math.cos(phi) * sinT;
        const nz = Math.sin(phi) * sinT;

        const furBase = fbm(kit, nx * 16 + ny * 3, nz * 16 + ny * 26, 3);
        const furFine = kit.noise(nx * 46 + 50, ny * 68 + nz * 46 + 90);
        const furEdgeNoise = (furBase - 0.5) * 0.048 + (furFine - 0.5) * 0.022;

        let patchMask = 0;
        for (let side = -1; side <= 1; side += 2) {
          const cx = side * px0;
          const cy = py0;
          const cz = pz0;
          const dot = nx * cx + ny * cy + nz * cz;
          if (dot > 0.55) {
            const dx = nx - cx;
            const dy = ny - cy;
            const dz = nz - cz;
            const tx = side * (dx * cz - dz * cx);
            const ty = dy;
            const rx = tx * cosTilt - ty * sinTilt;
            const ry = tx * sinTilt + ty * cosTilt;

            const widen = 1.0 + 0.18 * clamp(-ry * 2.2, -0.35, 0.45);
            const rad = Math.hypot(rx / (0.205 * widen), (ry + 0.012) / 0.255);
            const m = 1.0 - smoothstep(0.86, 1.06, rad + furEdgeNoise * 3.1);
            if (m > patchMask) patchMask = m;
          }
        }

        const earL = Math.hypot(nx - 0.64, ny - 0.68, nz + 0.12);
        const earR = Math.hypot(nx + 0.64, ny - 0.68, nz + 0.12);
        const earRoot =
          (1.0 - smoothstep(0.14, 0.28, Math.min(earL, earR) + furEdgeNoise * 1.4)) * 0.85;

        let blackMix = Math.max(patchMask, earRoot);

        const cheekL = Math.hypot(nx - 0.52, ny + 0.27, nz - 0.78);
        const cheekR = Math.hypot(nx + 0.52, ny + 0.27, nz - 0.78);
        const blushMask =
          (1.0 - smoothstep(0.06, 0.30, Math.min(cheekL, cheekR))) * 0.25 * (1.0 - blackMix);

        const chinShade = smoothstep(-0.42, -0.92, ny) * 0.42;
        const crownBright = smoothstep(0.35, 0.95, ny) * 0.04;
        const furVar = (furBase - 0.5) * 0.065 + (furFine - 0.5) * 0.035;

        let r = mix(fur.r, shadow.r, chinShade) + crownBright + furVar;
        let g = mix(fur.g, shadow.g, chinShade) + crownBright + furVar * 0.95;
        let b = mix(fur.b, shadow.b, chinShade) + crownBright + furVar * 0.9;

        r = mix(r, blush.r, blushMask);
        g = mix(g, blush.g, blushMask);
        b = mix(b, blush.b, blushMask);

        const muzzleDots =
          (Math.exp(-(Math.pow((Math.abs(nx) - 0.14) / 0.025, 2) + Math.pow((ny + 0.24) / 0.022, 2))) +
            Math.exp(-(Math.pow((Math.abs(nx) - 0.21) / 0.025, 2) + Math.pow((ny + 0.27) / 0.022, 2)))) *
          smoothstep(0.85, 0.96, nz);
        r *= 1.0 - muzzleDots * 0.12;
        g *= 1.0 - muzzleDots * 0.12;
        b *= 1.0 - muzzleDots * 0.12;

        const darkVar = (furBase - 0.5) * 0.05 + (furFine - 0.5) * 0.03;
        r = mix(r, dark.r + darkVar, blackMix);
        g = mix(g, dark.g + darkVar, blackMix);
        b = mix(b, dark.b + darkVar * 1.1, blackMix);

        const idx = (iy * cw + ix) * 4;
        data[idx] = clamp(Math.round(r * 255), 0, 255);
        data[idx + 1] = clamp(Math.round(g * 255), 0, 255);
        data[idx + 2] = clamp(Math.round(b * 255), 0, 255);
        data[idx + 3] = 255;

        const bumpVal = clamp(Math.round((0.45 + furBase * 0.35 + furFine * 0.20) * 255), 0, 255);
        bumpBuf[idx] = bumpVal;
        bumpBuf[idx + 1] = bumpVal;
        bumpBuf[idx + 2] = bumpVal;
        bumpBuf[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  const bumpTex = kit.canvasTexture(w, h, (ctx, cw, ch) => {
    const img = ctx.createImageData(cw, ch);
    img.data.set(bumpBuf);
    ctx.putImageData(img, 0, 0);
  });

  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.ClampToEdgeWrapping;
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.ClampToEdgeWrapping;
  return { colorTex, bumpTex };
}

function makeBodyTextures(THREE, kit, furHex, accentHex) {
  const fur = colorRGB(THREE, furHex, '#f5f0e6');
  const dark = colorRGB(THREE, accentHex, '#232229');
  const bellyLight = {
    r: Math.min(1, fur.r * 1.03),
    g: Math.min(1, fur.g * 1.02),
    b: Math.min(1, fur.b * 0.99)
  };
  const groundShade = { r: fur.r * 0.80, g: fur.g * 0.77, b: fur.b * 0.74 };

  const w = 512;
  const h = 256;
  const bumpBuf = new Uint8ClampedArray(w * h * 4);

  const colorTex = kit.canvasTexture(w, h, (ctx, cw, ch) => {
    const img = ctx.createImageData(cw, ch);
    const data = img.data;

    for (let iy = 0; iy < ch; iy++) {
      const v = 1 - iy / (ch - 1);
      const theta = (1 - v) * Math.PI;
      const sinT = Math.sin(theta);
      const ny = Math.cos(theta);

      for (let ix = 0; ix < cw; ix++) {
        const u = ix / (cw - 1);
        const phi = u * Math.PI * 2;
        const nx = -Math.cos(phi) * sinT;
        const nz = Math.sin(phi) * sinT;

        const furBase = fbm(kit, nx * 15, ny * 24 + nz * 15, 3);
        const furFine = kit.noise(nx * 44 + 21, ny * 62 + nz * 44 + 73);
        const edgeNoise = (furBase - 0.5) * 0.095 + (furFine - 0.5) * 0.035;

        const frontFactor = smoothstep(-0.25, 0.65, nz);
        const sideFactor = smoothstep(0.28, 0.78, Math.abs(nx));
        const lowerEdge =
          mix(0.14, 0.34, frontFactor) - sideFactor * 0.24 + edgeNoise;
        const upperEdge = 0.96;

        const saddleMask =
          smoothstep(lowerEdge - 0.06, lowerEdge + 0.06, ny) *
          (1.0 - smoothstep(upperEdge - 0.04, upperEdge + 0.04, ny));

        const hipDarkL = Math.hypot(nx - 0.78, ny + 0.44, nz - 0.14);
        const hipDarkR = Math.hypot(nx + 0.78, ny + 0.44, nz - 0.14);
        const hipBlend =
          (1.0 - smoothstep(0.22, 0.42, Math.min(hipDarkL, hipDarkR) + edgeNoise * 0.8)) * 0.72;

        const blackMix = Math.max(saddleMask, hipBlend);

        const bellyMask = smoothstep(0.1, 0.85, nz) * smoothstep(0.25, -0.45, ny) * 0.45;
        const bottomAo = smoothstep(-0.48, -0.92, ny) * 0.52;
        const furVar = (furBase - 0.5) * 0.065 + (furFine - 0.5) * 0.035;

        let r = mix(fur.r, bellyLight.r, bellyMask);
        let g = mix(fur.g, bellyLight.g, bellyMask);
        let b = mix(fur.b, bellyLight.b, bellyMask);

        r = mix(r, groundShade.r, bottomAo) + furVar;
        g = mix(g, groundShade.g, bottomAo) + furVar * 0.96;
        b = mix(b, groundShade.b, bottomAo) + furVar * 0.92;

        const darkVar = (furBase - 0.5) * 0.05 + (furFine - 0.5) * 0.03;
        r = mix(r, dark.r + darkVar, blackMix);
        g = mix(g, dark.g + darkVar, blackMix);
        b = mix(b, dark.b + darkVar * 1.08, blackMix);

        const idx = (iy * cw + ix) * 4;
        data[idx] = clamp(Math.round(r * 255), 0, 255);
        data[idx + 1] = clamp(Math.round(g * 255), 0, 255);
        data[idx + 2] = clamp(Math.round(b * 255), 0, 255);
        data[idx + 3] = 255;

        const bumpVal = clamp(Math.round((0.42 + furBase * 0.38 + furFine * 0.20) * 255), 0, 255);
        bumpBuf[idx] = bumpVal;
        bumpBuf[idx + 1] = bumpVal;
        bumpBuf[idx + 2] = bumpVal;
        bumpBuf[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  const bumpTex = kit.canvasTexture(w, h, (ctx, cw, ch) => {
    const img = ctx.createImageData(cw, ch);
    img.data.set(bumpBuf);
    ctx.putImageData(img, 0, 0);
  });

  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.ClampToEdgeWrapping;
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.ClampToEdgeWrapping;
  return { colorTex, bumpTex };
}

function makeFurFleckTextures(THREE, kit, baseHex) {
  const base = colorRGB(THREE, baseHex, '#232229');
  const w = 256;
  const h = 256;
  const bumpBuf = new Uint8ClampedArray(w * h * 4);

  const colorTex = kit.canvasTexture(w, h, (ctx, cw, ch) => {
    const img = ctx.createImageData(cw, ch);
    const data = img.data;
    for (let iy = 0; iy < ch; iy++) {
      const v = iy / ch;
      for (let ix = 0; ix < cw; ix++) {
        const u = ix / cw;
        const a = u * Math.PI * 2;
        const n1 = fbm(kit, Math.cos(a) * 3.5 + 10, Math.sin(a) * 3.5 + v * 12, 3);
        const n2 = kit.noise(Math.cos(a) * 14 + 40, Math.sin(a) * 14 + v * 36 + 20);
        const shift = (n1 - 0.5) * 0.065 + (n2 - 0.5) * 0.038;
        const grad = (v - 0.5) * 0.025;
        const idx = (iy * cw + ix) * 4;
        data[idx] = clamp(Math.round((base.r + shift + grad) * 255), 0, 255);
        data[idx + 1] = clamp(Math.round((base.g + shift + grad) * 255), 0, 255);
        data[idx + 2] = clamp(Math.round((base.b + shift * 1.1 + grad) * 255), 0, 255);
        data[idx + 3] = 255;

        const bv = clamp(Math.round((0.42 + n1 * 0.36 + n2 * 0.22) * 255), 0, 255);
        bumpBuf[idx] = bv;
        bumpBuf[idx + 1] = bv;
        bumpBuf[idx + 2] = bv;
        bumpBuf[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  const bumpTex = kit.canvasTexture(w, h, (ctx, cw, ch) => {
    const img = ctx.createImageData(cw, ch);
    img.data.set(bumpBuf);
    ctx.putImageData(img, 0, 0);
  });

  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.RepeatWrapping;
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;
  return { colorTex, bumpTex };
}

function makeIrisTexture(THREE, kit, eyeHex) {
  const eye = colorRGB(THREE, eyeHex, '#7a4b2a');
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let iy = 0; iy < h; iy++) {
      const y = (iy / (h - 1)) * 2 - 1;
      for (let ix = 0; ix < w; ix++) {
        const x = (ix / (w - 1)) * 2 - 1;
        const r = Math.hypot(x, y);
        const angle = Math.atan2(y, x);
        const fiber = kit.noise(Math.cos(angle) * 6 + 20, Math.sin(angle) * 6 + r * 4 + 20);

        const pupil = 1.0 - smoothstep(0.46, 0.56, r);
        const limbal = smoothstep(0.76, 0.96, r);
        const lowerGlow =
          smoothstep(-0.05, 0.78, y) *
          (1.0 - smoothstep(0.45, 0.88, Math.abs(x))) *
          smoothstep(0.48, 0.72, r) *
          (1.0 - limbal);

        let cr = eye.r * (0.78 + fiber * 0.42) + lowerGlow * 0.34;
        let cg = eye.g * (0.76 + fiber * 0.40) + lowerGlow * 0.28;
        let cb = eye.b * (0.74 + fiber * 0.34) + lowerGlow * 0.14;

        cr *= 1.0 - limbal * 0.72;
        cg *= 1.0 - limbal * 0.74;
        cb *= 1.0 - limbal * 0.72;

        cr = mix(cr, 0.04, pupil);
        cg = mix(cg, 0.035, pupil);
        cb = mix(cb, 0.045, pupil);

        const idx = (iy * w + ix) * 4;
        data[idx] = clamp(Math.round(cr * 255), 0, 255);
        data[idx + 1] = clamp(Math.round(cg * 255), 0, 255);
        data[idx + 2] = clamp(Math.round(cb * 255), 0, 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBambooTextures(THREE, kit, nodePositions) {
  const w = 256;
  const h = 512;
  const bumpBuf = new Uint8ClampedArray(w * h * 4);

  const colorTex = kit.canvasTexture(w, h, (ctx, cw, ch) => {
    const img = ctx.createImageData(cw, ch);
    const data = img.data;
    for (let iy = 0; iy < ch; iy++) {
      const v = 1 - iy / (ch - 1);
      let nodeGlow = 0;
      let nodeCrease = 0;
      for (let k = 0; k < nodePositions.length; k++) {
        const d = v - nodePositions[k];
        nodeGlow = Math.max(nodeGlow, Math.exp(-(d * d) / 0.00028));
        nodeCrease = Math.max(nodeCrease, Math.exp(-Math.pow((d - 0.011) / 0.009, 2)));
        nodeCrease = Math.max(nodeCrease, Math.exp(-Math.pow((d + 0.014) / 0.011, 2)));
      }

      for (let ix = 0; ix < cw; ix++) {
        const u = ix / (cw - 1);
        const a = u * Math.PI * 2;
        const streak = kit.noise(Math.cos(a) * 26 + 50, Math.sin(a) * 26 + v * 3.5 + 15);
        const mottle = fbm(kit, Math.cos(a) * 3 + 12, Math.sin(a) * 3 + v * 9, 3);

        let r = mix(0.35, 0.47, v) + (streak - 0.5) * 0.06 + (mottle - 0.5) * 0.07;
        let g = mix(0.55, 0.67, v) + (streak - 0.5) * 0.07 + (mottle - 0.5) * 0.08;
        let b = mix(0.26, 0.33, v) + (streak - 0.5) * 0.04 + (mottle - 0.5) * 0.04;

        r = mix(r, 0.77, nodeGlow * 0.68);
        g = mix(g, 0.81, nodeGlow * 0.65);
        b = mix(b, 0.55, nodeGlow * 0.68);

        r *= 1.0 - nodeCrease * 0.24;
        g *= 1.0 - nodeCrease * 0.22;
        b *= 1.0 - nodeCrease * 0.20;

        if (v > 0.96) {
          const cutMix = smoothstep(0.96, 0.99, v);
          r = mix(r, 0.78, cutMix);
          g = mix(g, 0.74, cutMix);
          b = mix(b, 0.54, cutMix);
        }

        const idx = (iy * cw + ix) * 4;
        data[idx] = clamp(Math.round(r * 255), 0, 255);
        data[idx + 1] = clamp(Math.round(g * 255), 0, 255);
        data[idx + 2] = clamp(Math.round(b * 255), 0, 255);
        data[idx + 3] = 255;

        const bv = clamp(Math.round((0.45 + streak * 0.35 + nodeGlow * 0.20 - nodeCrease * 0.18) * 255), 0, 255);
        bumpBuf[idx] = bv;
        bumpBuf[idx + 1] = bv;
        bumpBuf[idx + 2] = bv;
        bumpBuf[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  const bumpTex = kit.canvasTexture(w, h, (ctx, cw, ch) => {
    const img = ctx.createImageData(cw, ch);
    img.data.set(bumpBuf);
    ctx.putImageData(img, 0, 0);
  });

  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.ClampToEdgeWrapping;
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.ClampToEdgeWrapping;
  return { colorTex, bumpTex };
}

function makeLeafTextures(THREE, kit) {
  const w = 256;
  const h = 256;
  const bumpBuf = new Uint8ClampedArray(w * h * 4);

  const colorTex = kit.canvasTexture(w, h, (ctx, cw, ch) => {
    const img = ctx.createImageData(cw, ch);
    const data = img.data;
    for (let iy = 0; iy < ch; iy++) {
      const v = 1 - iy / (ch - 1);
      for (let ix = 0; ix < cw; ix++) {
        const u = ix / (cw - 1);
        const midDist = Math.abs(u - 0.5);
        const midrib = Math.exp(-(midDist * midDist) / 0.0012);
        const veins = Math.sin(midDist * 75) * 0.5 + 0.5;
        const mottle = fbm(kit, u * 5 + 30, v * 8 + 10, 2);

        let r = mix(0.24, 0.44, v) + (mottle - 0.5) * 0.06;
        let g = mix(0.47, 0.66, v) + (mottle - 0.5) * 0.08 + veins * 0.025;
        let b = mix(0.20, 0.27, v) + (mottle - 0.5) * 0.04;

        r = mix(r, 0.64, midrib * 0.55);
        g = mix(g, 0.78, midrib * 0.55);
        b = mix(b, 0.42, midrib * 0.55);

        const idx = (iy * cw + ix) * 4;
        data[idx] = clamp(Math.round(r * 255), 0, 255);
        data[idx + 1] = clamp(Math.round(g * 255), 0, 255);
        data[idx + 2] = clamp(Math.round(b * 255), 0, 255);
        data[idx + 3] = 255;

        const bv = clamp(Math.round((0.45 + midrib * 0.35 + veins * 0.14) * 255), 0, 255);
        bumpBuf[idx] = bv;
        bumpBuf[idx + 1] = bv;
        bumpBuf[idx + 2] = bv;
        bumpBuf[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  const bumpTex = kit.canvasTexture(w, h, (ctx, cw, ch) => {
    const img = ctx.createImageData(cw, ch);
    img.data.set(bumpBuf);
    ctx.putImageData(img, 0, 0);
  });

  colorTex.colorSpace = THREE.SRGBColorSpace;
  return { colorTex, bumpTex };
}

function makeEarGeometry(THREE, scale = 1.0, thinCup = false) {
  const shape = new THREE.Shape();
  const rw = 0.030 * scale;
  const rh = 0.027 * scale;
  shape.moveTo(0, -rh * 0.82);
  shape.bezierCurveTo(rw * 0.95, -rh * 0.85, rw * 1.15, rh * 0.35, rw * 0.55, rh * 0.92);
  shape.bezierCurveTo(rw * 0.18, rh * 1.12, -rw * 0.18, rh * 1.12, -rw * 0.55, rh * 0.92);
  shape.bezierCurveTo(-rw * 1.15, rh * 0.35, -rw * 0.95, -rh * 0.85, 0, -rh * 0.82);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thinCup ? 0.0035 * scale : 0.011 * scale,
    bevelEnabled: true,
    bevelThickness: thinCup ? 0.0025 * scale : 0.0085 * scale,
    bevelSize: thinCup ? 0.0025 * scale : 0.0075 * scale,
    bevelSegments: thinCup ? 3 : 5,
    curveSegments: 24
  });

  geo.center();
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const nx = x / (rw * 1.15);
    const ny = (y - 0.002 * scale) / (rh * 1.1);
    const r2 = nx * nx + ny * ny;

    z += (thinCup ? 0.0085 : 0.0105) * scale * r2;
    if (z > 0) {
      z -= (thinCup ? 0.002 : 0.0045) * scale * Math.exp(-r2 * 2.4);
    }
    const topPinch = smoothstep(0.15, 1.0, ny);
    z *= 1.0 - 0.18 * topPinch;

    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function makeBambooLeafGeometry(THREE) {
  const len = 0.068;
  const maxW = 0.0125;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(maxW * 0.95, len * 0.18, maxW * 1.05, len * 0.56, 0, len);
  shape.bezierCurveTo(-maxW * 1.05, len * 0.56, -maxW * 0.95, len * 0.18, 0, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0011,
    bevelEnabled: true,
    bevelThickness: 0.0007,
    bevelSize: 0.0008,
    bevelSegments: 2,
    curveSegments: 18
  });

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i) - 0.00055;

    const v = clamp(y / len, 0, 1);
    const u = clamp(x / (maxW * 2) + 0.5, 0, 1);

    const droop = -0.020 * Math.pow(v, 1.85);
    const cup = 0.0038 * Math.abs(u - 0.5) * Math.sin(v * Math.PI);
    const twist = 0.0025 * (u - 0.5) * v * v;

    pos.setXYZ(i, x, y, z + droop + cup + twist);
    uv.setXY(i, u, v);
  }
  geo.computeVertexNormals();
  return geo;
}

function makeBambooStalkGeometry(THREE, length, nodePositions) {
  const baseR = 0.0108;
  const pts = [];

  pts.push(new THREE.Vector2(0.0, 0.0));
  pts.push(new THREE.Vector2(baseR * 0.72, 0.002));
  pts.push(new THREE.Vector2(baseR * 1.02, 0.008));

  const segEnds = [0.008 / length, ...nodePositions, 0.988];
  for (let s = 0; s < segEnds.length - 1; s++) {
    const y0 = segEnds[s];
    const y1 = segEnds[s + 1];
    const isTop = s === segEnds.length - 2;
    const taper0 = 1.0 - y0 * 0.14;
    const taper1 = 1.0 - y1 * 0.14;

    const steps = 4;
    for (let k = 1; k <= steps; k++) {
      const f = k / (steps + 1);
      const y = mix(y0, y1, f);
      const waist = 1.0 - 0.075 * Math.sin(f * Math.PI);
      const r = baseR * mix(taper0, taper1, f) * waist;
      pts.push(new THREE.Vector2(r, y * length));
    }

    if (!isTop) {
      const yn = y1 * length;
      const rn = baseR * taper1;
      pts.push(new THREE.Vector2(rn * 1.04, yn - 0.0055));
      pts.push(new THREE.Vector2(rn * 1.15, yn - 0.0018));
      pts.push(new THREE.Vector2(rn * 1.06, yn + 0.0008));
      pts.push(new THREE.Vector2(rn * 1.13, yn + 0.0032));
      pts.push(new THREE.Vector2(rn * 1.02, yn + 0.0062));
    }
  }

  const topR = baseR * 0.86;
  pts.push(new THREE.Vector2(topR * 1.01, length * 0.992));
  pts.push(new THREE.Vector2(topR * 0.95, length));
  pts.push(new THREE.Vector2(topR * 0.66, length));
  pts.push(new THREE.Vector2(topR * 0.60, length * 0.955));
  pts.push(new THREE.Vector2(0.0, length * 0.955));

  const geo = new THREE.LatheGeometry(pts, 24);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = clamp(y / length, 0, 1);

    const bendX = 0.0065 * Math.sin(t * Math.PI);
    const bendZ = 0.0028 * Math.sin(t * Math.PI * 1.35);
    pos.setXYZ(i, x + bendX, y, z + bendZ);
    uv.setY(i, t);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildEyeGroup(THREE, irisTex, darkMat, irisMat, highlightMat) {
  const eyeGroup = new THREE.Group();

  const ballGeo = new THREE.SphereGeometry(0.0156, 26, 20);
  ballGeo.scale(1.0, 1.07, 0.66);
  const ball = new THREE.Mesh(ballGeo, darkMat);
  ball.position.set(0, 0, -0.001);
  ball.userData.slot = 'furAccent';
  ball.castShadow = false;
  ball.receiveShadow = true;
  eyeGroup.add(ball);

  const irisR = 0.0130;
  const irisGeo = new THREE.CircleGeometry(irisR, 28, 0, Math.PI * 2);
  const iPos = irisGeo.attributes.position;
  const iUv = irisGeo.attributes.uv;
  for (let i = 0; i < iPos.count; i++) {
    const ix = iPos.getX(i);
    const iy = iPos.getY(i) * 1.06;
    const rn = Math.min(0.99, Math.hypot(ix / 0.0156, iy / (0.0156 * 1.07)));
    const zBall = -0.001 + 0.0156 * 0.66 * Math.sqrt(Math.max(0.01, 1 - rn * rn));
    const edgeTuck = smoothstep(0.75, 1.0, Math.hypot(ix, iPos.getY(i)) / irisR) * 0.0005;
    iPos.setXYZ(i, ix, iy, zBall + 0.0006 - edgeTuck);
    iUv.setXY(i, ix / (irisR * 2) + 0.5, iPos.getY(i) / (irisR * 2) + 0.5);
  }
  irisGeo.computeVertexNormals();
  const irisMesh = new THREE.Mesh(irisGeo, irisMat);
  irisMesh.userData.slot = 'eye';
  irisMesh.castShadow = false;
  irisMesh.receiveShadow = false;
  eyeGroup.add(irisMesh);

  const hl1Geo = new THREE.SphereGeometry(0.0034, 14, 10);
  hl1Geo.scale(1.08, 0.90, 0.34);
  const hl1 = new THREE.Mesh(hl1Geo, highlightMat);
  hl1.position.set(-0.0044, 0.0048, 0.0091);
  hl1.rotation.set(-0.24, -0.26, 0.22);
  hl1.userData.slot = 'fur';
  hl1.castShadow = false;
  eyeGroup.add(hl1);

  const hl2Geo = new THREE.SphereGeometry(0.0015, 12, 8);
  hl2Geo.scale(1.0, 0.95, 0.35);
  const hl2 = new THREE.Mesh(hl2Geo, highlightMat);
  hl2.position.set(0.0041, -0.0038, 0.0092);
  hl2.rotation.set(0.2, 0.22, 0);
  hl2.userData.slot = 'fur';
  hl2.castShadow = false;
  eyeGroup.add(hl2);

  return eyeGroup;
}

function addPawDetails(THREE, parent, tipPos, dirVec, upHint, padMat, clawMat, isHind) {
  const fwd = dirVec.clone().normalize();
  const side = new THREE.Vector3().crossVectors(upHint, fwd);
  if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
  side.normalize();
  const up = new THREE.Vector3().crossVectors(fwd, side).normalize();

  const basis = new THREE.Matrix4().makeBasis(side, up, fwd);
  const pawGroup = new THREE.Group();
  pawGroup.position.copy(tipPos);
  pawGroup.quaternion.setFromRotationMatrix(basis);

  const padScale = isHind ? 1.0 : 0.74;
  const mainPadGeo = new THREE.SphereGeometry(0.0145 * padScale, 18, 14);
  const mp = mainPadGeo.attributes.position;
  for (let i = 0; i < mp.count; i++) {
    let x = mp.getX(i);
    let y = mp.getY(i);
    let z = mp.getZ(i);
    x *= 1.18 - 0.16 * (y / (0.0145 * padScale));
    y *= 0.88;
    z *= 0.38;
    mp.setXYZ(i, x, y, z);
  }
  mainPadGeo.computeVertexNormals();

  const mainPad = new THREE.Mesh(mainPadGeo, padMat);
  mainPad.position.set(0, -0.0045 * padScale, 0.0155 * padScale);
  mainPad.userData.slot = 'skin';
  mainPad.receiveShadow = true;
  pawGroup.add(mainPad);

  const toeGeo = new THREE.SphereGeometry(0.0056 * padScale, 14, 10);
  toeGeo.scale(0.92, 1.12, 0.44);
  const toeAngles = [-0.62, -0.21, 0.21, 0.62];
  for (let i = 0; i < toeAngles.length; i++) {
    const a = toeAngles[i];
    const toe = new THREE.Mesh(toeGeo, padMat);
    const r = (isHind ? 0.0185 : 0.0142) * (1.0 - Math.abs(a) * 0.14);
    toe.position.set(Math.sin(a) * r, 0.0095 * padScale + Math.cos(a) * 0.005 * padScale, 0.015 * padScale - Math.abs(a) * 0.003);
    toe.rotation.z = -a * 0.55;
    toe.userData.slot = 'skin';
    pawGroup.add(toe);
  }

  const clawGeo = new THREE.SphereGeometry(0.0032 * padScale, 12, 10);
  clawGeo.scale(0.65, 1.35, 0.85);
  const clawAngles = [-0.46, -0.15, 0.15, 0.46];
  for (let i = 0; i < clawAngles.length; i++) {
    const a = clawAngles[i];
    const claw = new THREE.Mesh(clawGeo, clawMat);
    const r = (isHind ? 0.019 : 0.0145);
    claw.position.set(Math.sin(a) * r, (isHind ? 0.020 : 0.015), (isHind ? 0.008 : 0.011) - Math.abs(a) * 0.003);
    claw.rotation.set(0.45, 0, -a * 0.4);
    claw.userData.slot = 'furAccent';
    pawGroup.add(claw);
  }

  parent.add(pawGroup);
}

export function build(THREE, opts = {}, kit) {
  const furHex = opts.fur || '#f5f0e6';
  const accentHex = opts.furAccent || '#232229';
  const eyeHex = opts.eye || '#7a4b2a';
  const variant = META.variants.includes(opts.variant) ? opts.variant : 'munch';

  const root = new THREE.Group();
  root.name = 'pandaCub';
  root.userData.variant = variant;

  const headTex = makeHeadTextures(THREE, kit, furHex, accentHex);
  const bodyTex = makeBodyTextures(THREE, kit, furHex, accentHex);
  const darkFurTex = makeFurFleckTextures(THREE, kit, accentHex);
  const whiteFurTex = makeFurFleckTextures(THREE, kit, furHex);
  const irisTex = makeIrisTexture(THREE, kit, eyeHex);
  const nodePositions = [0.24, 0.53, 0.80];
  const bambooTex = makeBambooTextures(THREE, kit, nodePositions);
  const leafTex = makeLeafTextures(THREE, kit);

  const headMat = new THREE.MeshPhysicalMaterial({
    map: headTex.colorTex,
    bumpMap: headTex.bumpTex,
    bumpScale: 0.0022,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.85,
    sheenRoughness: 0.72,
    sheenColor: lighterHex(THREE, furHex, 0.35)
  });

  const bodyMat = new THREE.MeshPhysicalMaterial({
    map: bodyTex.colorTex,
    bumpMap: bodyTex.bumpTex,
    bumpScale: 0.0024,
    roughness: 0.93,
    metalness: 0.0,
    sheen: 0.85,
    sheenRoughness: 0.74,
    sheenColor: lighterHex(THREE, furHex, 0.35)
  });

  const darkFurMat = new THREE.MeshPhysicalMaterial({
    map: darkFurTex.colorTex,
    bumpMap: darkFurTex.bumpTex,
    bumpScale: 0.0022,
    roughness: 0.91,
    metalness: 0.0,
    sheen: 0.78,
    sheenRoughness: 0.68,
    sheenColor: lighterHex(THREE, accentHex, 0.28)
  });

  const whiteFurMat = new THREE.MeshPhysicalMaterial({
    map: whiteFurTex.colorTex,
    bumpMap: whiteFurTex.bumpTex,
    bumpScale: 0.0022,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.86,
    sheenRoughness: 0.72,
    sheenColor: lighterHex(THREE, furHex, 0.4)
  });

  const innerEarMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#534249'),
    roughness: 0.84,
    metalness: 0.0,
    sheen: 0.55,
    sheenRoughness: 0.75,
    sheenColor: new THREE.Color('#8e767f')
  });

  const padMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#4a3c41'),
    roughness: 0.66,
    metalness: 0.0,
    sheen: 0.3,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color('#77636a')
  });

  const noseMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(accentHex).multiplyScalar(0.85),
    roughness: 0.26,
    metalness: 0.02,
    clearcoat: 0.65,
    clearcoatRoughness: 0.22
  });

  const mouthMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(accentHex).multiplyScalar(0.82),
    roughness: 0.65,
    metalness: 0.0
  });

  const clawMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(accentHex).multiplyScalar(0.9),
    roughness: 0.22,
    metalness: 0.04,
    clearcoat: 0.82,
    clearcoatRoughness: 0.14
  });

  const eyeDarkMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#121015'),
    roughness: 0.04,
    metalness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03
  });

  const irisMat = new THREE.MeshPhysicalMaterial({
    map: irisTex,
    roughness: 0.05,
    metalness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03
  });

  const highlightMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffffff'),
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.28,
    roughness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02
  });

  const blushMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ee9794'),
    roughness: 0.94,
    metalness: 0.0,
    transparent: true,
    opacity: 0.28,
    depthWrite: false
  });

  const bambooMat = new THREE.MeshPhysicalMaterial({
    map: bambooTex.colorTex,
    bumpMap: bambooTex.bumpTex,
    bumpScale: 0.0014,
    roughness: 0.42,
    metalness: 0.0,
    clearcoat: 0.36,
    clearcoatRoughness: 0.30
  });

  const leafMat = new THREE.MeshPhysicalMaterial({
    map: leafTex.colorTex,
    bumpMap: leafTex.bumpTex,
    bumpScale: 0.001,
    roughness: 0.56,
    metalness: 0.0,
    clearcoat: 0.18,
    clearcoatRoughness: 0.38,
    sheen: 0.28,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color('#b6d687')
  });

  // 1. BODY (grounded at y = 0)
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'body';
  root.add(bodyGroup);

  const bodyGeo = new THREE.SphereGeometry(1, 56, 40);
  const bPos = bodyGeo.attributes.position;
  const tmpV = new THREE.Vector3();
  let minY = Infinity;
  for (let i = 0; i < bPos.count; i++) {
    const nx = bPos.getX(i);
    const ny = bPos.getY(i);
    const nz = bPos.getZ(i);
    sculptBodyPoint(nx, ny, nz, tmpV);
    if (tmpV.y < minY) minY = tmpV.y;
    bPos.setXYZ(i, tmpV.x, tmpV.y, tmpV.z);
  }
  for (let i = 0; i < bPos.count; i++) {
    bPos.setY(i, bPos.getY(i) - minY);
  }
  bodyGeo.computeVertexNormals();

  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.userData.slot = 'fur';
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyGroup.add(bodyMesh);

  // 2. TAIL (tapered tube deeply overlapping lower back)
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tail';
  tailGroup.position.set(0, 0.056, -0.082);
  bodyGroup.add(tailGroup);

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.0, 0.018),
    new THREE.Vector3(0.002, 0.005, -0.012),
    new THREE.Vector3(0.006, 0.014, -0.032)
  ]);
  const tailTube = createTaperedTubeGeometry(THREE, tailCurve, {
    tubularSegments: 16,
    radialSegments: 14,
    radiusFn: (t) => 0.021 * (1.0 - 0.15 * t + 0.16 * Math.sin(t * Math.PI)),
    capStart: true,
    capEnd: true
  });
  const tailMesh = new THREE.Mesh(tailTube.geometry, whiteFurMat);
  tailMesh.userData.slot = 'fur';
  tailMesh.castShadow = true;
  tailMesh.receiveShadow = true;
  tailGroup.add(tailMesh);
  tailGroup.userData.rest = { rx: 0, ry: 0, rz: 0 };

  // 3. HIND LEGS (legL, legR) sitting splayed forward with soles turned slightly out
  const buildLeg = (side, name) => {
    const legGroup = new THREE.Group();
    legGroup.name = name;
    bodyGroup.add(legGroup);

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.052, 0.064, -0.002),
      new THREE.Vector3(side * 0.082, 0.046, 0.044),
      new THREE.Vector3(side * 0.092, 0.040, 0.088),
      new THREE.Vector3(side * 0.096, 0.045, 0.118)
    ]);

    const tube = createTaperedTubeGeometry(THREE, curve, {
      tubularSegments: 26,
      radialSegments: 18,
      radiusFn: (t) => {
        const thigh = 0.041 * (1.0 - smoothstep(0.0, 0.55, t) * 0.30);
        const pawSwell = 0.0085 * smoothstep(0.65, 1.0, t);
        return thigh + pawSwell;
      },
      ovalFn: (t) => [
        1.0 + 0.12 * smoothstep(0.6, 1.0, t),
        0.92 + 0.16 * smoothstep(0.7, 1.0, t)
      ],
      postVertex: (v) => {
        if (v.y < 0.012) {
          const d = (0.012 - v.y) / 0.022;
          v.y = 0.012 * (1.0 - Math.tanh(d * 1.5));
        }
        if (v.y < 0.0) v.y = 0.0;
      }
    });

    const legMesh = new THREE.Mesh(tube.geometry, darkFurMat);
    legMesh.userData.slot = 'furAccent';
    legMesh.castShadow = true;
    legMesh.receiveShadow = true;
    legGroup.add(legMesh);

    const tipPos = curve.getPoint(1);
    const soleDir = new THREE.Vector3(side * 0.24, 0.16, 0.96).normalize();
    addPawDetails(THREE, legGroup, tipPos, soleDir, new THREE.Vector3(0, 1, 0), padMat, clawMat, true);
    legGroup.userData.rest = { rx: 0, ry: 0, rz: 0 };
    return legGroup;
  };

  buildLeg(1, 'legL');
  buildLeg(-1, 'legR');

  // 4. VARIANT POSES FOR BAMBOO AND ARMS
  const poses = {
    munch: {
      bambooStart: new THREE.Vector3(-0.086, 0.066, 0.130),
      bambooEnd: new THREE.Vector3(0.068, 0.312, 0.134),
      gripR: 0.24,
      gripL: 0.56,
      armLCustom: null,
      headRot: { x: 0.04, y: 0.07, z: -0.09 }
    },
    proud: {
      bambooStart: new THREE.Vector3(-0.112, 0.006, 0.102),
      bambooEnd: new THREE.Vector3(-0.146, 0.348, 0.086),
      gripR: 0.44,
      gripL: null,
      armLCustom: new THREE.Vector3(0.046, 0.112, 0.114),
      headRot: { x: -0.03, y: -0.09, z: 0.08 }
    },
    cradle: {
      bambooStart: new THREE.Vector3(-0.136, 0.116, 0.126),
      bambooEnd: new THREE.Vector3(0.144, 0.186, 0.122),
      gripR: 0.32,
      gripL: 0.66,
      armLCustom: null,
      headRot: { x: 0.08, y: 0.05, z: 0.10 }
    }
  };

  const pose = poses[variant];
  const stalkVec = pose.bambooEnd.clone().sub(pose.bambooStart);
  const stalkLen = stalkVec.length();
  const stalkDir = stalkVec.clone().normalize();

  const rightGrip = pose.bambooStart.clone().lerp(pose.bambooEnd, pose.gripR);
  const leftGrip =
    pose.gripL !== null
      ? pose.bambooStart.clone().lerp(pose.bambooEnd, pose.gripL)
      : pose.armLCustom.clone();

  // 5. ARMS (armL, armR) emerging smoothly from the black shoulder band
  const buildArm = (side, name, targetPos, grippingBamboo) => {
    const armGroup = new THREE.Group();
    armGroup.name = name;
    const shoulder = new THREE.Vector3(side * 0.062, 0.166, 0.006);
    armGroup.position.copy(shoulder);
    bodyGroup.add(armGroup);

    const localTarget = targetPos.clone().sub(shoulder);
    if (grippingBamboo) {
      localTarget.z -= 0.010;
      localTarget.x += side * 0.004;
    }

    const elbow = new THREE.Vector3(
      side * 0.046 + localTarget.x * 0.42,
      localTarget.y * 0.56 - 0.026,
      localTarget.z * 0.52 + 0.012
    );
    const wrist = localTarget.clone().lerp(elbow, 0.24);
    wrist.z += 0.006;

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-side * 0.012, 0.006, -0.008),
      new THREE.Vector3(side * 0.018, -0.006, 0.016),
      elbow,
      wrist,
      localTarget
    ]);

    const tube = createTaperedTubeGeometry(THREE, curve, {
      tubularSegments: 28,
      radialSegments: 18,
      radiusFn: (t) => {
        const base = 0.032 * (1.0 - 0.24 * smoothstep(0.15, 0.72, t));
        const paw = 0.0055 * smoothstep(0.74, 1.0, t);
        return base + paw;
      },
      ovalFn: (t) => [1.04, 0.94 + 0.08 * smoothstep(0.7, 1.0, t)]
    });

    const armMesh = new THREE.Mesh(tube.geometry, darkFurMat);
    armMesh.userData.slot = 'furAccent';
    armMesh.castShadow = true;
    armMesh.receiveShadow = true;
    armGroup.add(armMesh);

    const palmDir = grippingBamboo
      ? new THREE.Vector3(-side * 0.45, 0.12, 0.88).normalize()
      : new THREE.Vector3(-side * 0.35, -0.25, -0.9).normalize();
    addPawDetails(THREE, armGroup, localTarget, palmDir, new THREE.Vector3(0, 1, 0), padMat, clawMat, false);

    armGroup.userData.rest = { rx: 0, ry: 0, rz: 0 };
    return armGroup;
  };

  buildArm(1, 'armL', leftGrip, pose.gripL !== null);
  buildArm(-1, 'armR', rightGrip, true);

  // 6. BAMBOO STALK WITH TWIGS & LEAVES (parented to body so breathing stays locked to paws)
  const bambooGroup = new THREE.Group();
  bambooGroup.name = 'bamboo';
  bambooGroup.position.copy(pose.bambooStart);
  const bambooQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), stalkDir);
  bambooGroup.quaternion.copy(bambooQuat);
  bodyGroup.add(bambooGroup);

  const stalkGeo = makeBambooStalkGeometry(THREE, stalkLen, nodePositions);
  const stalkMesh = new THREE.Mesh(stalkGeo, bambooMat);
  stalkMesh.userData.slot = 'primary';
  stalkMesh.castShadow = true;
  stalkMesh.receiveShadow = true;
  bambooGroup.add(stalkMesh);

  const leafGeo = makeBambooLeafGeometry(THREE);

  const addTwigAndLeaves = (nodeFrac, yawAngle, twigLen, leafSpecs) => {
    const twigAnchor = new THREE.Group();
    const yNode = nodeFrac * stalkLen;
    const bendX = 0.0065 * Math.sin(nodeFrac * Math.PI);
    const bendZ = 0.0028 * Math.sin(nodeFrac * Math.PI * 1.35);
    twigAnchor.position.set(bendX, yNode, bendZ);
    twigAnchor.rotation.y = yawAngle;
    bambooGroup.add(twigAnchor);

    const twigCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.005, -0.002, 0),
      new THREE.Vector3(twigLen * 0.42, twigLen * 0.46, 0.003),
      new THREE.Vector3(twigLen * 0.85, twigLen * 0.84, 0.006)
    ]);
    const twigTube = createTaperedTubeGeometry(THREE, twigCurve, {
      tubularSegments: 12,
      radialSegments: 8,
      radiusFn: (t) => mix(0.0024, 0.0011, t),
      capStart: false,
      capEnd: true,
      capRings: 2
    });
    const twigMesh = new THREE.Mesh(twigTube.geometry, bambooMat);
    twigMesh.userData.slot = 'primary';
    twigMesh.castShadow = true;
    twigAnchor.add(twigMesh);

    const tip = twigCurve.getPoint(1);
    for (let i = 0; i < leafSpecs.length; i++) {
      const spec = leafSpecs[i];
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.userData.slot = 'secondary';
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      const attach = twigCurve.getPoint(spec.t);
      leaf.position.copy(attach);
      leaf.rotation.set(spec.rx, spec.ry, spec.rz);
      leaf.scale.setScalar(spec.s);
      twigAnchor.add(leaf);
    }

    return tip;
  };

  addTwigAndLeaves(0.80, 0.45, 0.048, [
    { t: 0.65, rx: 0.42, ry: 0.45, rz: -0.68, s: 0.92 },
    { t: 0.96, rx: 0.25, ry: -0.20, rz: -0.32, s: 1.08 },
    { t: 1.0, rx: -0.18, ry: 0.62, rz: -0.82, s: 0.86 }
  ]);
  addTwigAndLeaves(0.80, -2.15, 0.042, [
    { t: 0.72, rx: 0.35, ry: -0.35, rz: -0.65, s: 0.88 },
    { t: 1.0, rx: 0.12, ry: 0.40, rz: -0.38, s: 1.0 }
  ]);
  addTwigAndLeaves(0.53, 1.95, 0.036, [
    { t: 0.78, rx: 0.48, ry: 0.32, rz: -0.78, s: 0.82 },
    { t: 1.0, rx: 0.22, ry: -0.25, rz: -0.45, s: 0.90 }
  ]);
  addTwigAndLeaves(0.97, -0.75, 0.028, [
    { t: 0.85, rx: 0.28, ry: 0.20, rz: -0.42, s: 0.95 },
    { t: 1.0, rx: -0.12, ry: -0.55, rz: -0.18, s: 0.78 }
  ]);

  bambooGroup.userData.restQuat = bambooQuat.clone();

  // 7. HEAD (continuous sculpted surface deeply overlapping torso top)
  const headGroup = new THREE.Group();
  headGroup.name = 'head';
  headGroup.position.set(0, 0.208, 0.010);
  headGroup.rotation.set(pose.headRot.x, pose.headRot.y, pose.headRot.z);
  root.add(headGroup);

  const headCenterY = 0.082;
  const headGeo = new THREE.SphereGeometry(1, 64, 48);
  const hPos = headGeo.attributes.position;
  for (let i = 0; i < hPos.count; i++) {
    sculptHeadPoint(hPos.getX(i), hPos.getY(i), hPos.getZ(i), tmpV);
    hPos.setXYZ(i, tmpV.x, tmpV.y + headCenterY, tmpV.z);
  }
  headGeo.computeVertexNormals();

  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.userData.slot = 'fur';
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headGroup.add(headMesh);

  // 8. EARS (earL, earR) cupped ExtrudeGeometry nestled deeply into cranium
  const outerEarGeo = makeEarGeometry(THREE, 1.0, false);
  const innerEarGeo = makeEarGeometry(THREE, 0.64, true);

  const buildEar = (side, name) => {
    const earGroup = new THREE.Group();
    earGroup.name = name;
    earGroup.position.set(side * 0.068, headCenterY + 0.066, -0.010);
    earGroup.rotation.set(0.14, side * 0.34, -side * 0.44);

    const outerEar = new THREE.Mesh(outerEarGeo, darkFurMat);
    outerEar.userData.slot = 'furAccent';
    outerEar.castShadow = true;
    outerEar.receiveShadow = true;
    earGroup.add(outerEar);

    const innerEar = new THREE.Mesh(innerEarGeo, innerEarMat);
    innerEar.position.set(0, -0.002, 0.0068);
    innerEar.userData.slot = 'skin';
    innerEar.receiveShadow = true;
    earGroup.add(innerEar);

    earGroup.userData.rest = {
      rx: earGroup.rotation.x,
      ry: earGroup.rotation.y,
      rz: earGroup.rotation.z
    };
    headGroup.add(earGroup);
    return earGroup;
  };

  buildEar(1, 'earL');
  buildEar(-1, 'earR');

  // 9. EYES (eyeL, eyeR) inset smoothly into sculpted sockets
  const placeEye = (side, name) => {
    const dir = new THREE.Vector3(side * 0.365, 0.015, 0.931).normalize();
    const pos = sculptHeadPoint(dir.x, dir.y, dir.z, new THREE.Vector3());
    pos.y += headCenterY;
    const norm = sculptHeadNormal(THREE, dir.x, dir.y, dir.z);

    const gaze = norm.clone().lerp(new THREE.Vector3(side * 0.24, 0.0, 0.97).normalize(), 0.45).normalize();
    const eyeGroup = buildEyeGroup(THREE, irisTex, eyeDarkMat, irisMat, highlightMat);
    eyeGroup.name = name;
    eyeGroup.position.copy(pos).addScaledVector(norm, 0.0014);
    eyeGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), gaze);
    headGroup.add(eyeGroup);
    return eyeGroup;
  };

  placeEye(1, 'eyeL');
  placeEye(-1, 'eyeR');

  // 10. SUBTLE CHEEK BLUSH DISCS hugging cheek contour
  const blushGeo = new THREE.CircleGeometry(0.017, 20);
  const blPos = blushGeo.attributes.position;
  for (let i = 0; i < blPos.count; i++) {
    const bx = blPos.getX(i) * 1.15;
    const by = blPos.getY(i) * 0.78;
    const r2 = (bx * bx + by * by) / (0.018 * 0.018);
    blPos.setXYZ(i, bx, by, -0.0024 * r2);
  }
  blushGeo.computeVertexNormals();

  for (let side = -1; side <= 1; side += 2) {
    const bDir = new THREE.Vector3(side * 0.54, -0.25, 0.80).normalize();
    const bPosPt = sculptHeadPoint(bDir.x, bDir.y, bDir.z, new THREE.Vector3());
    bPosPt.y += headCenterY;
    const bNorm = sculptHeadNormal(THREE, bDir.x, bDir.y, bDir.z);
    const blushDisc = new THREE.Mesh(blushGeo, blushMat);
    blushDisc.position.copy(bPosPt).addScaledVector(bNorm, 0.0012);
    blushDisc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), bNorm);
    blushDisc.userData.slot = 'skin';
    blushDisc.castShadow = false;
    headGroup.add(blushDisc);
  }

  // 11. SCULPTED NOSE
  const noseDir = new THREE.Vector3(0, -0.17, 0.985).normalize();
  const nosePos = sculptHeadPoint(noseDir.x, noseDir.y, noseDir.z, new THREE.Vector3());
  nosePos.y += headCenterY;

  const noseGeo = new THREE.SphereGeometry(1, 28, 20);
  const nPos = noseGeo.attributes.position;
  for (let i = 0; i < nPos.count; i++) {
    const nx = nPos.getX(i);
    const ny = nPos.getY(i);
    const nz = nPos.getZ(i);

    const triW = 0.0145 * (1.0 + 0.30 * ny - 0.20 * ny * ny);
    let x = nx * triW;
    let y = ny * 0.0092;
    let z = nz * 0.0088;

    const topFlat = smoothstep(0.35, 0.95, ny);
    y -= 0.0014 * topFlat;
    const crease = Math.exp(-(nx * nx) / 0.04) * smoothstep(-0.1, -0.9, ny) * smoothstep(0.1, 0.9, nz);
    z -= 0.0012 * crease;
    const nostril =
      (Math.exp(-(Math.pow((nx - 0.42) / 0.20, 2) + Math.pow((ny + 0.12) / 0.24, 2))) +
        Math.exp(-(Math.pow((nx + 0.42) / 0.20, 2) + Math.pow((ny + 0.12) / 0.24, 2)))) *
      smoothstep(0.3, 0.9, nz);
    z -= 0.0016 * nostril;

    nPos.setXYZ(i, x, y, z);
  }
  noseGeo.computeVertexNormals();
  const noseMesh = new THREE.Mesh(noseGeo, noseMat);
  noseMesh.position.copy(nosePos).add(new THREE.Vector3(0, 0.001, 0.0018));
  noseMesh.rotation.x = 0.12;
  noseMesh.userData.slot = 'furAccent';
  noseMesh.castShadow = true;
  noseMesh.receiveShadow = true;
  headGroup.add(noseMesh);

  // 12. CURVED MOUTH LINE (thin tapered tubes hugging muzzle contour)
  const muzzlePt = (nx, ny, nz, lift = 0.0007) => {
    const d = new THREE.Vector3(nx, ny, nz).normalize();
    const p = sculptHeadPoint(d.x, d.y, d.z, new THREE.Vector3());
    const n = sculptHeadNormal(THREE, d.x, d.y, d.z);
    p.addScaledVector(n, lift);
    p.y += headCenterY;
    return p;
  };

  const philtrumCurve = new THREE.CatmullRomCurve3([
    muzzlePt(0, -0.225, 0.974, 0.0008),
    muzzlePt(0, -0.275, 0.961, 0.0009),
    muzzlePt(0, -0.322, 0.946, 0.0008)
  ]);
  const philtrumTube = createTaperedTubeGeometry(THREE, philtrumCurve, {
    tubularSegments: 10,
    radialSegments: 8,
    radiusFn: (t) => mix(0.0015, 0.0013, t)
  });
  const philtrumMesh = new THREE.Mesh(philtrumTube.geometry, mouthMat);
  philtrumMesh.userData.slot = 'furAccent';
  headGroup.add(philtrumMesh);

  for (let side = -1; side <= 1; side += 2) {
    const smileCurve = new THREE.CatmullRomCurve3([
      muzzlePt(0, -0.322, 0.946, 0.0008),
      muzzlePt(side * 0.062, -0.348, 0.936, 0.0009),
      muzzlePt(side * 0.130, -0.334, 0.934, 0.0009),
      muzzlePt(side * 0.175, -0.298, 0.938, 0.0005)
    ]);
    const smileTube = createTaperedTubeGeometry(THREE, smileCurve, {
      tubularSegments: 14,
      radialSegments: 8,
      radiusFn: (t) => 0.00155 * (1.0 - 0.35 * t * t)
    });
    const smileMesh = new THREE.Mesh(smileTube.geometry, mouthMat);
    smileMesh.userData.slot = 'furAccent';
    headGroup.add(smileMesh);
  }

  headGroup.userData.rest = {
    x: headGroup.position.x,
    y: headGroup.position.y,
    z: headGroup.position.z,
    rx: headGroup.rotation.x,
    ry: headGroup.rotation.y,
    rz: headGroup.rotation.z
  };

  return root;
}

export function idle(group, t) {
  if (!group) return;
  const breath = Math.sin(t * 2.05);

  const body = group.getObjectByName('body');
  if (body) {
    body.scale.set(
      1.0 + breath * 0.011,
      1.0 + breath * 0.016,
      1.0 + breath * 0.013
    );
  }

  const head = group.getObjectByName('head');
  if (head && head.userData.rest) {
    const r = head.userData.rest;
    head.position.y = r.y + breath * 0.0028;
    head.rotation.x = r.rx + Math.sin(t * 1.25) * 0.022 + breath * 0.014;
    head.rotation.y = r.ry + Math.sin(t * 0.62 + 0.7) * 0.055;
    head.rotation.z = r.rz + Math.sin(t * 0.92) * 0.042;
  }

  const earL = group.getObjectByName('earL');
  const earR = group.getObjectByName('earR');
  const twitchCycle = t % 6.4;
  const twitch =
    twitchCycle > 5.85 && twitchCycle < 6.25
      ? Math.sin(((twitchCycle - 5.85) / 0.4) * Math.PI * 2) * 0.14
      : 0;

  if (earL && earL.userData.rest) {
    earL.rotation.z = earL.userData.rest.rz + breath * 0.025 - twitch;
    earL.rotation.x = earL.userData.rest.rx + Math.sin(t * 1.4) * 0.02;
  }
  if (earR && earR.userData.rest) {
    earR.rotation.z = earR.userData.rest.rz - breath * 0.025 + twitch * 0.35;
    earR.rotation.x = earR.userData.rest.rx + Math.sin(t * 1.4 + 0.5) * 0.02;
  }

  const tail = group.getObjectByName('tail');
  if (tail && tail.userData.rest) {
    tail.rotation.y = Math.sin(t * 2.6) * 0.09;
    tail.rotation.x = Math.sin(t * 1.9 + 0.4) * 0.05;
  }

  const armL = group.getObjectByName('armL');
  const armR = group.getObjectByName('armR');
  const armSway = Math.sin(t * 1.35) * 0.018;
  if (armL && armL.userData.rest) {
    armL.rotation.x = armL.userData.rest.rx + armSway;
    armL.rotation.z = armL.userData.rest.rz + breath * 0.012;
  }
  if (armR && armR.userData.rest) {
    armR.rotation.x = armR.userData.rest.rx + armSway * 0.8;
    armR.rotation.z = armR.userData.rest.rz - breath * 0.010;
  }

  const eyeL = group.getObjectByName('eyeL');
  const eyeR = group.getObjectByName('eyeR');
  if (eyeL && eyeR) {
    const blinkPeriod = 3.9;
    const phase = t % blinkPeriod;
    const cycleIdx = Math.floor(t / blinkPeriod);
    let blinkScale = 1.0;

    if (phase > blinkPeriod - 0.18) {
      const u = (phase - (blinkPeriod - 0.18)) / 0.18;
      blinkScale = 1.0 - 0.92 * Math.sin(u * Math.PI);
    } else if (cycleIdx % 3 === 2 && phase > blinkPeriod - 0.46 && phase < blinkPeriod - 0.30) {
      const u = (phase - (blinkPeriod - 0.46)) / 0.16;
      blinkScale = 1.0 - 0.88 * Math.sin(u * Math.PI);
    }

    eyeL.scale.y = blinkScale;
    eyeR.scale.y = blinkScale;
  }
}
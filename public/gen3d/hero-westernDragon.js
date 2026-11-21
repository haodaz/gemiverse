export const META = {
  id: 'young-western-dragon',
  name: 'Young Western Dragon',
  kind: 'creature',
  footprint: [0.38, 0.48],
  variants: ['Meadow Green', 'Hearth Red', 'Starlight Blue'],
  note: 'Hero-quality stylised young western dragon sitting like a cat with folded bat wings, curled tail, belly plates, dorsal spines, and tiny nostril smoke puffs.'
};

const PALETTES = [
  { fur: '#4b8e5e', furAccent: '#ebd9aa', eye: '#e89d2a', glow: '#ffb84d' },
  { fur: '#b9453d', furAccent: '#f2d1a3', eye: '#42b898', glow: '#ff7a33' },
  { fur: '#4875ab', furAccent: '#dfe8f5', eye: '#f0b844', glow: '#78d4ff' }
];

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

function resolvePalette(THREE, opts = {}) {
  const idx = clamp(Math.floor(opts.variant ?? 0), 0, PALETTES.length - 1);
  const base = PALETTES[idx];
  const fur = new THREE.Color(opts.fur ?? base.fur);
  const furAccent = new THREE.Color(opts.furAccent ?? base.furAccent);
  const eye = new THREE.Color(opts.eye ?? base.eye);
  const glow = new THREE.Color(opts.glow ?? base.glow);

  const furDark = fur.clone().multiplyScalar(0.62);
  const furLight = fur.clone().lerp(new THREE.Color('#ffffff'), 0.28);
  const sheen = fur.clone().lerp(furAccent, 0.48).lerp(new THREE.Color('#ffffff'), 0.22);
  const accentSheen = furAccent.clone().lerp(new THREE.Color('#ffffff'), 0.35);
  const blush = new THREE.Color('#e87882').lerp(furAccent, 0.22);
  const hornBase = furAccent.clone().lerp(new THREE.Color('#d8cab2'), 0.55);
  const hornTip = furDark.clone().lerp(new THREE.Color('#473b32'), 0.65);

  return {
    fur,
    furAccent,
    eye,
    glow,
    furDark,
    furLight,
    sheen,
    accentSheen,
    blush,
    hornBase,
    hornTip
  };
}

function colorCSS(c, alpha = 1) {
  const r = Math.round(clamp(c.r, 0, 1) * 255);
  const g = Math.round(clamp(c.g, 0, 1) * 255);
  const b = Math.round(clamp(c.b, 0, 1) * 255);
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
}

// ---------------------------------------------------------------------------
// Procedural Canvas Textures (using kit.canvasTexture & kit.noise)
// ---------------------------------------------------------------------------

function makeScaleTextures(THREE, kit, pal, isHead = false) {
  const size = isHead ? 512 : 512;
  const furHex = colorCSS(pal.fur);
  const darkHex = colorCSS(pal.furDark);
  const lightHex = colorCSS(pal.furLight);
  const accentHex = colorCSS(pal.furAccent);
  const blushHex = colorCSS(pal.blush, 0.36);

  const map = kit.canvasTexture(size, size, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    if (isHead) {
      grad.addColorStop(0.0, darkHex);
      grad.addColorStop(0.38, furHex);
      grad.addColorStop(0.76, lightHex);
      grad.addColorStop(1.0, accentHex);
    } else {
      grad.addColorStop(0.0, darkHex);
      grad.addColorStop(0.32, furHex);
      grad.addColorStop(0.74, furHex);
      grad.addColorStop(1.0, lightHex);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle organic mottling and cozy spots via kit.noise
    const step = 8;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const u = x / w;
        const v = y / h;
        const n1 = kit.noise(u * 9.5 + (isHead ? 4.2 : 0), v * 9.5);
        const n2 = kit.noise(u * 22.0 + 3.1, v * 22.0 + 1.7);
        const dorsalMask = isHead ? smoothstep(0.65, 0.1, v) : smoothstep(0.75, 0.15, v);
        if (n1 > 0.62 && dorsalMask > 0.15) {
          ctx.fillStyle = colorCSS(pal.furDark, (n1 - 0.62) * 0.65 * dorsalMask);
          ctx.fillRect(x, y, step, step);
        } else if (n2 > 0.64) {
          ctx.fillStyle = colorCSS(pal.furLight, (n2 - 0.64) * 0.35);
          ctx.fillRect(x, y, step, step);
        }
      }
    }

    // Soft overlapping stylized pebble scales
    const rows = isHead ? 36 : 30;
    const cols = isHead ? 44 : 36;
    const rw = w / cols;
    const rh = h / rows;
    for (let r = 0; r <= rows; r++) {
      const offset = (r % 2) * rw * 0.5;
      for (let c = -1; c <= cols + 1; c++) {
        const cx = c * rw + offset;
        const cy = r * rh;
        const n = kit.noise(c * 0.43 + 1.5, r * 0.43 + 2.7);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rw * 0.46, rh * 0.56, 0, 0, Math.PI * 2);
        ctx.fillStyle = n > 0.5
          ? colorCSS(pal.furLight, (n - 0.5) * 0.24)
          : colorCSS(pal.furDark, (0.5 - n) * 0.26);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy + rh * 0.06, rw * 0.42, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.strokeStyle = colorCSS(pal.furDark, 0.22);
        ctx.lineWidth = isHead ? 1.0 : 1.25;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy - rh * 0.08, rw * 0.32, 1.15 * Math.PI, 1.85 * Math.PI);
        ctx.strokeStyle = colorCSS(pal.furLight, 0.18);
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
    }

    // Soft belly lighter gradient band on front of body UV (u ~ 0.25 on Three SphereGeometry)
    if (!isHead) {
      const bellyGrad = ctx.createRadialGradient(w * 0.25, h * 0.58, w * 0.02, w * 0.25, h * 0.58, w * 0.22);
      bellyGrad.addColorStop(0, colorCSS(pal.furAccent, 0.72));
      bellyGrad.addColorStop(0.55, colorCSS(pal.furAccent, 0.28));
      bellyGrad.addColorStop(1, colorCSS(pal.furAccent, 0));
      ctx.fillStyle = bellyGrad;
      ctx.fillRect(0, 0, w, h);
    } else {
      // Gentle warm snout underside & cheek blush hint
      const cheekL = ctx.createRadialGradient(w * 0.35, h * 0.58, 2, w * 0.35, h * 0.58, w * 0.085);
      cheekL.addColorStop(0, blushHex);
      cheekL.addColorStop(1, colorCSS(pal.blush, 0));
      ctx.fillStyle = cheekL;
      ctx.fillRect(0, 0, w, h);

      const cheekR = ctx.createRadialGradient(w * 0.15, h * 0.58, 2, w * 0.15, h * 0.58, w * 0.085);
      cheekR.addColorStop(0, blushHex);
      cheekR.addColorStop(1, colorCSS(pal.blush, 0));
      ctx.fillStyle = cheekR;
      ctx.fillRect(0, 0, w, h);
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;

  const bump = kit.canvasTexture(size, size, (ctx, w, h) => {
    ctx.fillStyle = '#707070';
    ctx.fillRect(0, 0, w, h);
    const rows = isHead ? 36 : 30;
    const cols = isHead ? 44 : 36;
    const rw = w / cols;
    const rh = h / rows;
    for (let r = 0; r <= rows; r++) {
      const offset = (r % 2) * rw * 0.5;
      for (let c = -1; c <= cols + 1; c++) {
        const cx = c * rw + offset;
        const cy = r * rh;
        const g = ctx.createRadialGradient(cx, cy - rh * 0.1, rw * 0.05, cx, cy, rw * 0.52);
        g.addColorStop(0, '#d8d8d8');
        g.addColorStop(0.75, '#929292');
        g.addColorStop(1, '#3e3e3e');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rw * 0.46, rh * 0.56, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.ClampToEdgeWrapping;

  return { map, bump };
}

function makeWingMembraneTextures(THREE, kit, pal) {
  const warmEdge = pal.furAccent.clone().lerp(pal.fur, 0.34);
  const warmCenter = pal.furAccent.clone().lerp(new THREE.Color('#fff7e6'), 0.22);
  const veinCol = pal.fur.clone().lerp(pal.furAccent, 0.45);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w * 0.45, h * 0.45, w * 0.06, w * 0.45, h * 0.45, w * 0.65);
    grad.addColorStop(0, colorCSS(warmCenter));
    grad.addColorStop(0.68, colorCSS(pal.furAccent));
    grad.addColorStop(1, colorCSS(warmEdge));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle leathery warmth via kit.noise
    for (let y = 0; y < h; y += 8) {
      for (let x = 0; x < w; x += 8) {
        const n = kit.noise(x * 0.03 + 7.1, y * 0.03 + 2.3);
        ctx.fillStyle = n > 0.5
          ? colorCSS(warmCenter, (n - 0.5) * 0.22)
          : colorCSS(warmEdge, (0.5 - n) * 0.25);
        ctx.fillRect(x, y, 8, 8);
      }
    }

    // Delicate painted wing veins radiating organically
    ctx.strokeStyle = colorCSS(veinCol, 0.3);
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const startX = w * (0.12 + i * 0.06);
      const startY = h * 0.14;
      ctx.lineWidth = 1.4 + (i % 3) * 0.45;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      const midX = startX + (kit.noise(i * 1.7, 0.5) - 0.5) * w * 0.18;
      const midY = h * (0.48 + kit.noise(i, 2.1) * 0.15);
      const endX = midX + (kit.noise(i * 2.3, 4.1) - 0.5) * w * 0.22;
      const endY = h * 0.92;
      ctx.quadraticCurveTo(midX, midY, endX, endY);
      ctx.stroke();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const n = kit.noise(x * 0.08, y * 0.08);
        const v = Math.round(105 + n * 48);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 4, 4);
      }
    }
  });

  return { map, bump };
}

function makeBellyTexture(THREE, kit, pal) {
  const hi = pal.furAccent.clone().lerp(new THREE.Color('#ffffff'), 0.18);
  const lo = pal.furAccent.clone().multiplyScalar(0.84);
  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, colorCSS(hi));
    grad.addColorStop(0.65, colorCSS(pal.furAccent));
    grad.addColorStop(1, colorCSS(lo));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 6) {
      for (let x = 0; x < w; x += 6) {
        const n = kit.noise(x * 0.05 + 1.2, y * 0.14);
        ctx.fillStyle = n > 0.5 ? colorCSS(hi, (n - 0.5) * 0.18) : colorCSS(lo, (0.5 - n) * 0.2);
        ctx.fillRect(x, y, 6, 6);
      }
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function makeEarTexture(THREE, kit, pal) {
  const inner = pal.furAccent.clone().lerp(pal.blush, 0.42);
  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = colorCSS(pal.fur);
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.52, h * 0.48, w * 0.04, w * 0.52, h * 0.48, w * 0.38);
    g.addColorStop(0, colorCSS(inner));
    g.addColorStop(0.65, colorCSS(inner, 0.72));
    g.addColorStop(1, colorCSS(pal.fur, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      const x = kit.noise(i * 1.3, 0.2) * w;
      const y = kit.noise(0.8, i * 1.7) * h;
      ctx.fillStyle = colorCSS(pal.furLight, 0.15);
      ctx.fillRect(x, y, 4, 4);
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function makeHornTextures(THREE, kit, pal) {
  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, colorCSS(pal.hornBase));
    grad.addColorStop(0.55, colorCSS(pal.hornBase.clone().lerp(pal.hornTip, 0.45)));
    grad.addColorStop(1, colorCSS(pal.hornTip));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < h; y += 14) {
      ctx.fillStyle = colorCSS(pal.hornTip, 0.18);
      ctx.fillRect(0, y, w, 4);
      ctx.fillStyle = colorCSS(pal.furAccent, 0.12);
      ctx.fillRect(0, y + 4, w, 2);
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;

  const bump = kit.canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 14) {
      const g = ctx.createLinearGradient(0, y, 0, y + 14);
      g.addColorStop(0, '#505050');
      g.addColorStop(0.5, '#c8c8c8');
      g.addColorStop(1, '#505050');
      ctx.fillStyle = g;
      ctx.fillRect(0, y, w, 14);
    }
  });
  return { map, bump };
}

function makeIrisTexture(THREE, kit, pal) {
  const outer = pal.eye.clone().multiplyScalar(0.32);
  const mid = pal.eye.clone();
  const bright = pal.eye.clone().lerp(new THREE.Color('#fff9d6'), 0.55);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const rad = w * 0.48;

    const grad = ctx.createRadialGradient(cx, cy, rad * 0.15, cx, cy, rad);
    grad.addColorStop(0, colorCSS(bright));
    grad.addColorStop(0.45, colorCSS(mid));
    grad.addColorStop(0.84, colorCSS(outer));
    grad.addColorStop(1, '#090910');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Delicate radial iris fibres
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const n = kit.noise(Math.cos(a) * 3 + 2, Math.sin(a) * 3 + 2);
      ctx.strokeStyle = n > 0.5 ? colorCSS(bright, 0.34) : colorCSS(outer, 0.32);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * rad * 0.28, cy + Math.sin(a) * rad * 0.28);
      ctx.lineTo(cx + Math.cos(a) * rad * 0.9, cy + Math.sin(a) * rad * 0.9);
      ctx.stroke();
    }

    // Warm lower-crescent inner glow for lively charm
    const glowGrad = ctx.createRadialGradient(cx, cy + rad * 0.32, rad * 0.02, cx, cy + rad * 0.32, rad * 0.45);
    glowGrad.addColorStop(0, colorCSS(bright, 0.62));
    glowGrad.addColorStop(1, colorCSS(bright, 0));
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, rad * 0.85, 0, Math.PI * 2);
    ctx.fill();

    // Soft rounded dragon-kitten pupil
    ctx.fillStyle = '#07080d';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rad * 0.36, rad * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

// ---------------------------------------------------------------------------
// Geometry Craft Helpers
// ---------------------------------------------------------------------------

function createTaperedTube(THREE, curve, segments, radialSegments, radiusFn, opts = {}) {
  const frames = curve.computeFrenetFrames(segments, false);
  const positions = [];
  const uvs = [];
  const indices = [];

  const flattenFloorY = opts.flattenFloorY ?? null;
  const aspectFn = opts.aspectFn ?? (() => 1.0);
  const capStart = opts.capStart ?? true;
  const capEnd = opts.capEnd ?? true;

  // Use smooth parallel-transport frames to avoid Frenet twisting on S-curves
  const tangents = frames.tangents;
  const normals = [];
  const binormals = [];

  const up = new THREE.Vector3(0, 1, 0);
  const n0 = new THREE.Vector3();
  if (Math.abs(tangents[0].dot(up)) > 0.92) {
    n0.set(1, 0, 0).cross(tangents[0]).normalize();
  } else {
    n0.copy(up).cross(tangents[0]).normalize();
  }
  const b0 = new THREE.Vector3().crossVectors(tangents[0], n0).normalize();
  normals.push(n0);
  binormals.push(b0);

  const q = new THREE.Quaternion();
  for (let i = 1; i <= segments; i++) {
    const prevT = tangents[i - 1];
    const currT = tangents[i];
    q.setFromUnitVectors(prevT, currT);
    const ni = normals[i - 1].clone().applyQuaternion(q).normalize();
    const bi = new THREE.Vector3().crossVectors(currT, ni).normalize();
    normals.push(ni);
    binormals.push(bi);
  }

  const p = new THREE.Vector3();
  const ringVerts = radialSegments + 1;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, p);
    const r = radiusFn(t);
    const aspect = aspectFn(t);
    const N = normals[i];
    const B = binormals[i];

    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const theta = u * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);

      let vx = p.x + (N.x * cos + B.x * sin * aspect) * r;
      let vy = p.y + (N.y * cos + B.y * sin * aspect) * r;
      let vz = p.z + (N.z * cos + B.z * sin * aspect) * r;

      if (flattenFloorY !== null && vy < flattenFloorY + 0.004) {
        vy = flattenFloorY + Math.max(0, vy - flattenFloorY) * 0.25;
      }

      positions.push(vx, vy, vz);
      uvs.push(u, t);
    }
  }

  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * ringVerts + j;
      const b = (i + 1) * ringVerts + j;
      const c = (i + 1) * ringVerts + (j + 1);
      const d = i * ringVerts + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  if (capStart) {
    const p0 = curve.getPointAt(0);
    const r0 = radiusFn(0);
    const cIdx = positions.length / 3;
    const tip = p0.clone().addScaledVector(tangents[0], -r0 * 0.45);
    if (flattenFloorY !== null && tip.y < flattenFloorY) tip.y = flattenFloorY;
    positions.push(tip.x, tip.y, tip.z);
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegments; j++) {
      indices.push(cIdx, j + 1, j);
    }
  }

  if (capEnd) {
    const p1 = curve.getPointAt(1);
    const r1 = radiusFn(1);
    const cIdx = positions.length / 3;
    const tip = p1.clone().addScaledVector(tangents[segments], r1 * 0.55);
    if (flattenFloorY !== null && tip.y < flattenFloorY) tip.y = flattenFloorY;
    positions.push(tip.x, tip.y, tip.z);
    uvs.push(0.5, 1);
    const base = segments * ringVerts;
    for (let j = 0; j < radialSegments; j++) {
      indices.push(cIdx, base + j, base + j + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function mirrorGeometryX(geo) {
  const out = geo.clone();
  const pos = out.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, -pos.getX(i));
  }
  pos.needsUpdate = true;

  if (out.index) {
    const idx = out.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const tmp = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = tmp;
    }
    out.index.needsUpdate = true;
  } else {
    const arr = pos.array;
    const uv = out.attributes.uv ? out.attributes.uv.array : null;
    for (let i = 0; i < pos.count; i += 3) {
      const i1 = (i + 1) * 3;
      const i2 = (i + 2) * 3;
      for (let k = 0; k < 3; k++) {
        const tmp = arr[i1 + k];
        arr[i1 + k] = arr[i2 + k];
        arr[i2 + k] = tmp;
      }
      if (uv) {
        const u1 = (i + 1) * 2;
        const u2 = (i + 2) * 2;
        for (let k = 0; k < 2; k++) {
          const tmp = uv[u1 + k];
          uv[u1 + k] = uv[u2 + k];
          uv[u2 + k] = tmp;
        }
      }
    }
    pos.needsUpdate = true;
    if (out.attributes.uv) out.attributes.uv.needsUpdate = true;
  }
  out.computeVertexNormals();
  return out;
}

function subdivideLongEdges(THREE, geometry, maxEdgeLen, maxPasses = 4) {
  let geo = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  for (let pass = 0; pass < maxPasses; pass++) {
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const nextPos = [];
    const nextUv = [];
    let didSplit = false;

    for (let i = 0; i < pos.count; i += 3) {
      const ax = pos.getX(i), ay = pos.getY(i), az = pos.getZ(i);
      const bx = pos.getX(i + 1), by = pos.getY(i + 1), bz = pos.getZ(i + 1);
      const cx = pos.getX(i + 2), cy = pos.getY(i + 2), cz = pos.getZ(i + 2);

      const au = uv ? uv.getX(i) : 0, av = uv ? uv.getY(i) : 0;
      const bu = uv ? uv.getX(i + 1) : 0, bv = uv ? uv.getY(i + 1) : 0;
      const cu = uv ? uv.getX(i + 2) : 0, cv = uv ? uv.getY(i + 2) : 0;

      const dab = Math.hypot(bx - ax, by - ay, bz - az);
      const dbc = Math.hypot(cx - bx, cy - by, cz - bz);
      const dca = Math.hypot(ax - cx, ay - cy, az - cz);
      const maxD = Math.max(dab, dbc, dca);

      if (maxD <= maxEdgeLen || nextPos.length > 26000) {
        nextPos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
        nextUv.push(au, av, bu, bv, cu, cv);
        continue;
      }

      didSplit = true;
      if (dab >= dbc && dab >= dca) {
        const mx = (ax + bx) * 0.5, my = (ay + by) * 0.5, mz = (az + bz) * 0.5;
        const mu = (au + bu) * 0.5, mv = (av + bv) * 0.5;
        nextPos.push(ax, ay, az, mx, my, mz, cx, cy, cz);
        nextPos.push(mx, my, mz, bx, by, bz, cx, cy, cz);
        nextUv.push(au, av, mu, mv, cu, cv);
        nextUv.push(mu, mv, bu, bv, cu, cv);
      } else if (dbc >= dab && dbc >= dca) {
        const mx = (bx + cx) * 0.5, my = (by + cy) * 0.5, mz = (bz + cz) * 0.5;
        const mu = (bu + cu) * 0.5, mv = (bv + cv) * 0.5;
        nextPos.push(ax, ay, az, bx, by, bz, mx, my, mz);
        nextPos.push(ax, ay, az, mx, my, mz, cx, cy, cz);
        nextUv.push(au, av, bu, bv, mu, mv);
        nextUv.push(au, av, mu, mv, cu, cv);
      } else {
        const mx = (cx + ax) * 0.5, my = (cy + ay) * 0.5, mz = (cz + az) * 0.5;
        const mu = (cu + au) * 0.5, mv = (cv + av) * 0.5;
        nextPos.push(ax, ay, az, bx, by, bz, mx, my, mz);
        nextPos.push(mx, my, mz, bx, by, bz, cx, cy, cz);
        nextUv.push(au, av, bu, bv, mu, mv);
        nextUv.push(mu, mv, bu, bv, cu, cv);
      }
    }

    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.Float32BufferAttribute(nextPos, 3));
    ng.setAttribute('uv', new THREE.Float32BufferAttribute(nextUv, 2));
    geo = ng;
    if (!didSplit) break;
  }
  geo.computeVertexNormals();
  return geo;
}

function createBentExtrude(THREE, shape, extrudeOpts, bendFn, maxEdgeLen = 0.016) {
  let geo = new THREE.ExtrudeGeometry(shape, extrudeOpts);
  geo.center();
  // Normalize UVs to [0, 1] before bending so textures map cleanly
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const sx = Math.max(1e-5, bb.max.x - bb.min.x);
  const sy = Math.max(1e-5, bb.max.y - bb.min.y);
  const pos0 = geo.attributes.position;
  const uv0 = geo.attributes.uv;
  for (let i = 0; i < pos0.count; i++) {
    uv0.setXY(i, (pos0.getX(i) - bb.min.x) / sx, (pos0.getY(i) - bb.min.y) / sy);
  }
  uv0.needsUpdate = true;

  if (maxEdgeLen > 0) {
    geo = subdivideLongEdges(THREE, geo, maxEdgeLen, 3);
  }

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const [nx, ny, nz] = bendFn(pos.getX(i), pos.getY(i), pos.getZ(i), bb);
    pos.setXYZ(i, nx, ny, nz);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Analytical Sculpting Surfaces (Body & Head)
// ---------------------------------------------------------------------------

function sculptBodyPoint(nx, ny, nz) {
  const ang = Math.acos(clamp(ny, -1, 1));
  const s = 1.0 - ang / Math.PI; // 0 = bottom pole, 1 = top of neck

  const capBot = s < 0.14 ? Math.sin((s / 0.14) * Math.PI * 0.5) : 1.0;
  const capTop = s > 0.90 ? Math.sin(((1.0 - s) / 0.10) * Math.PI * 0.5) : 1.0;
  const cap = capBot * capTop;

  const horizLen = Math.hypot(nx, nz) || 1;
  const hx = nx / horizLen;
  const hz = nz / horizLen;

  // Pear-shaped seated torso narrowing smoothly into an upright dragon neck
  let rx = 0.034
    + 0.049 * Math.exp(-Math.pow((s - 0.23) / 0.34, 2))
    + 0.013 * Math.exp(-Math.pow((s - 0.57) / 0.19, 2));

  let rz = 0.036
    + 0.056 * Math.exp(-Math.pow((s - 0.24) / 0.35, 2))
    + 0.015 * Math.exp(-Math.pow((s - 0.56) / 0.18, 2));

  // Cozy round tummy bulge in front, slight muscular haunch fullness at sides-back
  const bellyBoost = Math.max(0, hz) * 0.015 * Math.exp(-Math.pow((s - 0.34) / 0.23, 2));
  const chestBoost = Math.max(0, hz) * 0.008 * Math.exp(-Math.pow((s - 0.62) / 0.14, 2));
  const rumpBoost = Math.max(0, -hz) * 0.014 * Math.exp(-Math.pow((s - 0.20) / 0.18, 2));

  // Subtle shoulder blade swell on upper back where wings attach
  const shoulderBump = Math.max(0, -hz - 0.1)
    * Math.exp(-Math.pow((Math.abs(hx) - 0.55) / 0.32, 2))
    * Math.exp(-Math.pow((s - 0.66) / 0.11, 2)) * 0.007;

  // Spine curve from seated rump forward into chest and upright neck
  const zc = -0.022 + 0.058 * s + 0.010 * Math.sin(s * Math.PI * 1.15);

  let py = 0.238 * s;
  // Smooth grounded floor contact pad
  if (s < 0.10) {
    py = 0.238 * 0.10 * Math.pow(s / 0.10, 1.75);
  }

  const px = hx * (rx + shoulderBump * 0.5) * cap;
  const pz = zc + hz * (rz + bellyBoost + chestBoost + rumpBoost + shoulderBump) * cap;

  return [px, Math.max(0, py), pz];
}

function sculptHeadPoint(nx, ny, nz) {
  // Base cranium ellipsoid centred slightly above neck pivot
  let x = nx * 0.059;
  let y = ny * 0.051 + 0.038;
  let z = nz * 0.058 + 0.010;

  // Soft neck-to-skull blend underneath so there is zero seam
  const neckBlend = smoothstep(-0.35, -0.88, ny) * smoothstep(0.35, -0.25, nz);
  y -= neckBlend * 0.014;
  z -= neckBlend * 0.005;

  // Rounded chibi cheeks
  const cheekMask = Math.exp(-Math.pow((Math.abs(nx) - 0.72) / 0.34, 2))
    * Math.exp(-Math.pow((ny + 0.16) / 0.34, 2))
    * smoothstep(-0.35, 0.35, nz);
  x += Math.sign(nx) * cheekMask * 0.011;
  y -= cheekMask * 0.003;

  // Gentle forehead dome
  const dome = smoothstep(0.20, 0.85, ny) * smoothstep(-0.2, 0.55, nz);
  y += dome * 0.006;

  // Friendly sculpted western dragon snout / muzzle
  const snoutMask = smoothstep(0.08, 0.70, nz)
    * smoothstep(0.68, 0.02, ny)
    * smoothstep(-0.82, -0.32, ny);
  z += snoutMask * 0.049;
  x *= 1.0 - snoutMask * 0.30;
  y -= snoutMask * 0.012;

  // Soft square-rounded snout tip and gentle nose bridge
  const tipMask = smoothstep(0.74, 0.98, nz) * Math.exp(-Math.pow((ny + 0.05) / 0.38, 2));
  y += tipMask * 0.0035;

  // Flared cute nostril ridges + subtle dimples
  const nostrilDistL = Math.hypot(nx - 0.25, ny - 0.05, nz - 0.93);
  const nostrilDistR = Math.hypot(nx + 0.25, ny - 0.05, nz - 0.93);
  const nDist = Math.min(nostrilDistL, nostrilDistR);
  const nostrilRing = Math.exp(-Math.pow((nDist - 0.075) / 0.055, 2));
  const nostrilPit = Math.exp(-Math.pow(nDist / 0.048, 2));
  z += nostrilRing * 0.0045 - nostrilPit * 0.0038;
  y += nostrilRing * 0.0028 - nostrilPit * 0.0012;

  // Recessed eye sockets so the large 3-layer eyes sit naturally inset
  const eyeDistL = Math.hypot(nx - 0.54, ny - 0.12, nz - 0.73);
  const eyeDistR = Math.hypot(nx + 0.54, ny - 0.12, nz - 0.73);
  const eDist = Math.min(eyeDistL, eyeDistR);
  const socketIndent = Math.exp(-Math.pow(eDist / 0.22, 2));
  x -= Math.sign(nx) * socketIndent * 0.0045;
  z -= socketIndent * 0.0058;

  // Soft expressive brow arches above eyes
  const browDistL = Math.hypot(nx - 0.44, ny - 0.35, nz - 0.69);
  const browDistR = Math.hypot(nx + 0.44, ny - 0.35, nz - 0.69);
  const browBump = Math.exp(-Math.pow(Math.min(browDistL, browDistR) / 0.17, 2));
  y += browBump * 0.0048;
  z += browBump * 0.0042;

  // Cute soft chin / lower jaw curve
  const chinMask = smoothstep(0.18, 0.75, nz) * smoothstep(-0.20, -0.68, ny);
  z += chinMask * 0.016;
  y -= chinMask * 0.003;

  return [x, y, z];
}

function sculptSphere(THREE, segW, segH, shapeFn) {
  const geo = new THREE.SphereGeometry(1, segW, segH);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);
    const [x, y, z] = shapeFn(nx, ny, nz);
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Component Builders
// ---------------------------------------------------------------------------

function buildHornGeometry(THREE) {
  // LatheGeometry with 22 profile points for subtle organic ridges + smooth tip
  const profile = [];
  const pts = 22;
  const hLen = 0.070;
  for (let i = 0; i < pts; i++) {
    const t = i / (pts - 1);
    const baseR = 0.0115 * Math.pow(1.0 - t, 0.72) + 0.0006;
    const ridge = (t > 0.08 && t < 0.86) ? Math.sin(t * Math.PI * 11) * 0.00065 * (1 - t) : 0;
    const tipRound = t > 0.90 ? Math.cos(((t - 0.90) / 0.10) * Math.PI * 0.5) : 1.0;
    const r = Math.max(0.0004, (baseR + ridge) * tipRound);
    profile.push(new THREE.Vector2(r, t * hLen));
  }
  const geo = new THREE.LatheGeometry(profile, 18);

  // Bend the rotational horn smoothly upward, slightly outward, and gracefully back
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = clamp(y / hLen, 0, 1);
    const curveBack = -Math.pow(t, 1.55) * 0.044 + Math.sin(t * Math.PI) * 0.006;
    const curveOut = Math.pow(t, 1.15) * 0.022;
    const curveUp = y * 0.88 + Math.sin(t * Math.PI * 0.75) * 0.008;
    pos.setXYZ(i, x + curveOut, curveUp, z + curveBack);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function buildClawGeometry(THREE, length = 0.011, baseRadius = 0.0026) {
  const profile = [];
  const pts = 16;
  for (let i = 0; i < pts; i++) {
    const t = i / (pts - 1);
    const tip = t > 0.88 ? Math.cos(((t - 0.88) / 0.12) * Math.PI * 0.5) : 1.0;
    const r = Math.max(0.00025, baseRadius * Math.pow(1 - t, 0.75) * tip);
    profile.push(new THREE.Vector2(r, t * length));
  }
  const geo = new THREE.LatheGeometry(profile, 10);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = clamp(y / length, 0, 1);
    // Rotate forward along +z and curl gently downward
    const nz = y * 0.92;
    const ny = -Math.pow(t, 1.8) * length * 0.36 + z;
    pos.setXYZ(i, x, ny, nz);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function buildEarGeometry(THREE) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.006);
  shape.bezierCurveTo(0.012, -0.014, 0.036, -0.010, 0.054, 0.008);
  shape.bezierCurveTo(0.040, 0.018, 0.018, 0.019, 0, 0.008);
  shape.closePath();

  return createBentExtrude(
    THREE,
    shape,
    {
      depth: 0.0042,
      bevelEnabled: true,
      bevelThickness: 0.0022,
      bevelSize: 0.0022,
      bevelSegments: 3,
      curveSegments: 18
    },
    (x, y, z, bb) => {
      const u = (x - bb.min.x) / Math.max(1e-5, bb.max.x - bb.min.x);
      const v = (y - bb.min.y) / Math.max(1e-5, bb.max.y - bb.min.y) - 0.5;
      // Cup the ear gracefully and sweep slightly back and up
      const cup = Math.cos(v * Math.PI) * 0.007 * Math.sin(u * Math.PI);
      const sweepBack = -Math.pow(u, 1.4) * 0.018;
      const lift = Math.pow(u, 1.2) * 0.012;
      const taperZ = 1.0 - u * 0.45;
      return [x - bb.min.x, y + lift, z * taperZ + sweepBack + cup];
    },
    0.012
  );
}

function buildSpineFinGeometry(THREE) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.009, 0);
  shape.bezierCurveTo(-0.008, 0.011, -0.002, 0.020, 0.008, 0.022);
  shape.bezierCurveTo(0.007, 0.012, 0.009, 0.004, 0.010, 0);
  shape.closePath();

  return createBentExtrude(
    THREE,
    shape,
    {
      depth: 0.0038,
      bevelEnabled: true,
      bevelThickness: 0.0018,
      bevelSize: 0.0014,
      bevelSegments: 2,
      curveSegments: 14
    },
    (x, y, z, bb) => {
      const v = (y - bb.min.y) / Math.max(1e-5, bb.max.y - bb.min.y);
      const taper = 1.0 - v * 0.55;
      // Orient fin so thickness is along X, height along Y, length along Z
      return [z * taper, y - bb.min.y, x];
    },
    0.014
  );
}

function buildTailSpadeGeometry(THREE) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.022);
  shape.bezierCurveTo(0.024, -0.014, 0.026, 0.010, 0, 0.028);
  shape.bezierCurveTo(-0.026, 0.010, -0.024, -0.014, 0, -0.022);

  return createBentExtrude(
    THREE,
    shape,
    {
      depth: 0.0045,
      bevelEnabled: true,
      bevelThickness: 0.0022,
      bevelSize: 0.0020,
      bevelSegments: 3,
      curveSegments: 18
    },
    (x, y, z, bb) => {
      const u = (x - bb.min.x) / Math.max(1e-5, bb.max.x - bb.min.x) - 0.5;
      const v = (y - bb.min.y) / Math.max(1e-5, bb.max.y - bb.min.y);
      const arch = -Math.pow(u * 2, 2) * 0.006 + Math.sin(v * Math.PI) * 0.004;
      const lift = Math.pow(v, 1.5) * 0.008;
      // Lay spade horizontally along +Z with gentle leaf curl
      return [x, z * (1 - v * 0.35) + arch + lift, y - bb.min.y];
    },
    0.012
  );
}

function buildSculptedPaw(THREE, clawGeo, furMat, clawMat, isHind = false) {
  const pawGroup = new THREE.Group();
  const sx = isHind ? 0.024 : 0.021;
  const sy = isHind ? 0.013 : 0.0125;
  const sz = isHind ? 0.030 : 0.025;

  const pawGeo = sculptSphere(THREE, 28, 20, (nx, ny, nz) => {
    let x = nx * sx;
    let y = ny * sy;
    let z = nz * sz;

    // Flatten sole cleanly
    if (ny < -0.15) {
      y = -sy * 0.62 + (ny + 0.15) * sy * 0.18;
    }
    // Slight forward broadening for cute toes
    const front = smoothstep(0.05, 0.85, nz);
    x *= 1.0 + front * 0.18;
    // Three subtle sculpted toe lobes at the front
    const toeWave = Math.cos(nx * Math.PI * 2.65) * 0.5 + 0.5;
    z += front * toeWave * 0.0042;
    y += front * toeWave * 0.0018 * smoothstep(-0.3, 0.4, ny);

    return [x, y + sy * 0.65, z + sz * 0.25];
  });

  const pawMesh = new THREE.Mesh(pawGeo, furMat);
  pawMesh.userData.slot = 'fur';
  pawMesh.castShadow = true;
  pawMesh.receiveShadow = true;
  pawGroup.add(pawMesh);

  // Three tiny curved clearcoated claws nestled at the toe tips
  const toeAngles = [-0.28, 0.0, 0.28];
  const toeOffsetsX = [-sx * 0.56, 0, sx * 0.56];
  const toeOffsetsZ = [sz * 1.12, sz * 1.24, sz * 1.12];
  for (let i = 0; i < 3; i++) {
    const claw = new THREE.Mesh(clawGeo, clawMat);
    claw.userData.slot = 'accent';
    claw.position.set(toeOffsetsX[i], sy * 0.36, toeOffsetsZ[i]);
    claw.rotation.y = toeAngles[i];
    claw.castShadow = true;
    pawGroup.add(claw);
  }

  return pawGroup;
}

function buildWingSide(THREE, mats, clawGeo, isRight = false) {
  const group = new THREE.Group();

  // Shared 2D -> 3D wing bending transform so fingers & scalloped membrane align with zero gaps
  const bendWing = (u, v, w) => {
    const x3 = u * 0.45 + Math.sin(u * 14.5) * 0.016 + Math.max(0, v) * 0.08 + w;
    const y3 = v - u * u * 0.22;
    const z3 = -u * 0.88 + Math.sin(v * 14.0) * 0.009 - Math.abs(v) * u * 0.18;
    return [x3, y3, z3];
  };

  // Key 2D anatomical wing landmarks
  const S = [0.000, 0.000];      // Shoulder root
  const E = [0.044, -0.026];     // Elbow
  const W = [0.086, 0.072];      // Wrist peak
  const F1 = [0.195, 0.026];     // Outer wingtip finger
  const F2 = [0.166, -0.056];    // Middle finger tip
  const F3 = [0.106, -0.094];    // Inner finger tip
  const B = [0.002, -0.084];     // Flank attachment

  // Bezier scalloped bat-wing membrane shape in 2D
  const memShape = new THREE.Shape();
  memShape.moveTo(S[0], S[1]);
  memShape.bezierCurveTo(0.022, -0.015, 0.036, -0.024, E[0], E[1]);
  memShape.bezierCurveTo(0.064, 0.016, 0.076, 0.052, W[0], W[1]);
  // Leading finger curve W -> F1
  memShape.bezierCurveTo(0.128, 0.078, 0.168, 0.058, F1[0], F1[1]);
  // Scallop 1: F1 -> F2
  memShape.bezierCurveTo(0.165, -0.002, 0.156, -0.028, F2[0], F2[1]);
  // Scallop 2: F2 -> F3
  memShape.bezierCurveTo(0.136, -0.052, 0.118, -0.068, F3[0], F3[1]);
  // Scallop 3: F3 -> B (body flank)
  memShape.bezierCurveTo(0.072, -0.068, 0.035, -0.070, B[0], B[1]);
  memShape.lineTo(S[0], S[1]);

  let memGeo = new THREE.ExtrudeGeometry(memShape, {
    depth: 0.0026,
    bevelEnabled: true,
    bevelThickness: 0.0012,
    bevelSize: 0.0010,
    bevelSegments: 2,
    curveSegments: 22
  });
  // Normalize UVs in 2D wing space before subdividing & bending
  memGeo.computeBoundingBox();
  const bb = memGeo.boundingBox;
  const uw = Math.max(1e-5, bb.max.x - bb.min.x);
  const vh = Math.max(1e-5, bb.max.y - bb.min.y);
  const p0 = memGeo.attributes.position;
  const uv0 = memGeo.attributes.uv;
  for (let i = 0; i < p0.count; i++) {
    uv0.setXY(i, (p0.getX(i) - bb.min.x) / uw, (p0.getY(i) - bb.min.y) / vh);
  }
  uv0.needsUpdate = true;

  memGeo = subdivideLongEdges(THREE, memGeo, 0.016, 4);
  const mp = memGeo.attributes.position;
  for (let i = 0; i < mp.count; i++) {
    const u = mp.getX(i);
    const v = mp.getY(i);
    const w = mp.getZ(i) - 0.0013;
    const [bx, by, bz] = bendWing(u, v, w);
    mp.setXYZ(i, bx, by, bz);
  }
  mp.needsUpdate = true;
  memGeo.computeVertexNormals();

  if (isRight) memGeo = mirrorGeometryX(memGeo);

  const memMesh = new THREE.Mesh(memGeo, mats.wingMembrane);
  memMesh.userData.slot = 'furAccent';
  memMesh.castShadow = true;
  memMesh.receiveShadow = true;
  group.add(memMesh);

  // Helper to convert 2D bezier sample points into 3D tapered wing bone tubes
  const sampleCubic2D = (p0, c1, c2, p3, n = 10) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const mt = 1 - t;
      const u = mt * mt * mt * p0[0] + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t * t * t * p3[0];
      const v = mt * mt * mt * p0[1] + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t * t * t * p3[1];
      const [x, y, z] = bendWing(u, v, 0.0012);
      pts.push(new THREE.Vector3(isRight ? -x : x, y, z));
    }
    return new THREE.CatmullRomCurve3(pts);
  };

  // Wing arm (shoulder -> elbow -> wrist peak)
  const armPts2D = [
    [-0.008, 0.004],
    [0.018, -0.012],
    E,
    [0.066, 0.024],
    W
  ];
  const armCurve = new THREE.CatmullRomCurve3(
    armPts2D.map(([u, v]) => {
      const [x, y, z] = bendWing(u, v, 0.0022);
      return new THREE.Vector3(isRight ? -x : x, y, z);
    })
  );
  const armGeo = createTaperedTube(THREE, armCurve, 26, 12, (t) => lerp(0.0105, 0.0068, t));
  const armMesh = new THREE.Mesh(armGeo, mats.scales);
  armMesh.userData.slot = 'fur';
  armMesh.castShadow = true;
  group.add(armMesh);

  // Three curved bezier wing fingers radiating from the wrist peak
  const f1Curve = sampleCubic2D(W, [0.128, 0.078], [0.168, 0.058], F1, 10);
  const f2Curve = sampleCubic2D(W, [0.122, 0.032], [0.152, -0.014], F2, 10);
  const f3Curve = sampleCubic2D(W, [0.095, 0.014], [0.104, -0.044], F3, 10);

  const fingerSpecs = [
    { curve: f1Curve, r0: 0.0056, r1: 0.0017 },
    { curve: f2Curve, r0: 0.0044, r1: 0.0014 },
    { curve: f3Curve, r0: 0.0038, r1: 0.0013 }
  ];
  for (const fs of fingerSpecs) {
    const fGeo = createTaperedTube(THREE, fs.curve, 22, 10, (t) => lerp(fs.r0, fs.r1, Math.pow(t, 0.85)));
    const fMesh = new THREE.Mesh(fGeo, mats.scales);
    fMesh.userData.slot = 'fur';
    fMesh.castShadow = true;
    group.add(fMesh);
  }

  // Cute tiny thumb claw perched atop the wrist peak
  const [wx, wy, wz] = bendWing(W[0], W[1], 0.0028);
  const thumb = new THREE.Mesh(clawGeo, mats.horn);
  thumb.userData.slot = 'accent';
  thumb.position.set(isRight ? -wx : wx, wy + 0.002, wz + 0.003);
  thumb.rotation.set(-0.65, isRight ? -0.35 : 0.35, 0);
  thumb.scale.setScalar(0.95);
  group.add(thumb);

  return group;
}

function buildEyeGroup(THREE, mats, isRight = false) {
  const eyeGroup = new THREE.Group();
  const R = 0.0165;

  // Layer 1: Dark glossy eyeball with clearcoat
  const ballGeo = new THREE.SphereGeometry(R, 28, 20);
  ballGeo.scale(1.0, 1.04, 0.72);
  const ball = new THREE.Mesh(ballGeo, mats.eyeGloss);
  ball.userData.slot = 'eye';
  eyeGroup.add(ball);

  // Layer 2: Coloured iris ring / curved front cap (LatheGeometry)
  const irisPts = [];
  const steps = 16;
  const maxTheta = 0.78;
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * maxTheta;
    irisPts.push(new THREE.Vector2(Math.sin(th) * R * 0.99, Math.cos(th) * R * 0.74));
  }
  const irisGeo = new THREE.LatheGeometry(irisPts, 28);
  irisGeo.rotateX(Math.PI * 0.5);
  // Planar front UV mapping so the radial painted iris centres cleanly
  const ip = irisGeo.attributes.position;
  const iuv = irisGeo.attributes.uv;
  const maxR = Math.sin(maxTheta) * R * 0.99;
  for (let i = 0; i < ip.count; i++) {
    const ux = 0.5 + (ip.getX(i) / (maxR * 2));
    const uy = 0.5 + (ip.getY(i) / (maxR * 2));
    iuv.setXY(i, ux, uy);
  }
  iuv.needsUpdate = true;
  const iris = new THREE.Mesh(irisGeo, mats.iris);
  iris.userData.slot = 'eye';
  iris.position.z = 0.0005;
  eyeGroup.add(iris);

  // Layer 3: Two bright crisp highlight catchlights placed up and to one side
  const sideSign = isRight ? 1 : 1; // Keep both highlights consistently from upper-right light
  const hi1 = new THREE.Mesh(new THREE.SphereGeometry(R * 0.24, 14, 12), mats.eyeHighlight);
  hi1.scale.set(1.05, 0.92, 0.42);
  hi1.position.set(R * 0.28 * sideSign, R * 0.34, R * 0.68);
  eyeGroup.add(hi1);

  const hi2 = new THREE.Mesh(new THREE.SphereGeometry(R * 0.11, 10, 10), mats.eyeHighlight);
  hi2.scale.set(1.0, 1.0, 0.42);
  hi2.position.set(-R * 0.24 * sideSign, -R * 0.26, R * 0.69);
  eyeGroup.add(hi2);

  return eyeGroup;
}

// ---------------------------------------------------------------------------
// Main Build Function
// ---------------------------------------------------------------------------

export function build(THREE, opts = {}, kit) {
  const pal = resolvePalette(THREE, opts);

  const bodyTex = makeScaleTextures(THREE, kit, pal, false);
  const headTex = makeScaleTextures(THREE, kit, pal, true);
  const wingTex = makeWingMembraneTextures(THREE, kit, pal);
  const bellyMap = makeBellyTexture(THREE, kit, pal);
  const earMap = makeEarTexture(THREE, kit, pal);
  const hornTex = makeHornTextures(THREE, kit, pal);
  const irisMap = makeIrisTexture(THREE, kit, pal);

  // Shared MeshPhysicalMaterials
  const mats = {
    scales: new THREE.MeshPhysicalMaterial({
      map: bodyTex.map,
      bumpMap: bodyTex.bump,
      bumpScale: 0.0022,
      roughness: 0.86,
      metalness: 0.0,
      sheen: 0.72,
      sheenRoughness: 0.65,
      sheenColor: pal.sheen
    }),
    headScales: new THREE.MeshPhysicalMaterial({
      map: headTex.map,
      bumpMap: headTex.bump,
      bumpScale: 0.0018,
      roughness: 0.86,
      metalness: 0.0,
      sheen: 0.74,
      sheenRoughness: 0.62,
      sheenColor: pal.sheen
    }),
    belly: new THREE.MeshPhysicalMaterial({
      map: bellyMap,
      roughness: 0.88,
      metalness: 0.0,
      sheen: 0.65,
      sheenRoughness: 0.7,
      sheenColor: pal.accentSheen
    }),
    wingMembrane: new THREE.MeshPhysicalMaterial({
      map: wingTex.map,
      bumpMap: wingTex.bump,
      bumpScale: 0.0014,
      roughness: 0.85,
      metalness: 0.0,
      sheen: 0.72,
      sheenRoughness: 0.55,
      sheenColor: pal.accentSheen,
      side: THREE.DoubleSide
    }),
    ear: new THREE.MeshPhysicalMaterial({
      map: earMap,
      roughness: 0.86,
      metalness: 0.0,
      sheen: 0.7,
      sheenColor: pal.sheen
    }),
    horn: new THREE.MeshPhysicalMaterial({
      map: hornTex.map,
      bumpMap: hornTex.bump,
      bumpScale: 0.0018,
      roughness: 0.24,
      metalness: 0.02,
      clearcoat: 0.85,
      clearcoatRoughness: 0.16
    }),
    eyeGloss: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#0c0e14'),
      roughness: 0.06,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04
    }),
    iris: new THREE.MeshPhysicalMaterial({
      map: irisMap,
      roughness: 0.12,
      metalness: 0.0,
      clearcoat: 0.95,
      clearcoatRoughness: 0.06,
      emissive: pal.eye.clone().multiplyScalar(0.24),
      emissiveIntensity: 0.8
    }),
    eyeHighlight: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.9,
      roughness: 0.05,
      clearcoat: 1.0
    }),
    mouth: new THREE.MeshPhysicalMaterial({
      color: pal.furDark.clone().multiplyScalar(0.55),
      roughness: 0.75,
      sheen: 0.3
    }),
    blush: new THREE.MeshPhysicalMaterial({
      color: pal.blush,
      roughness: 0.92,
      transparent: true,
      opacity: 0.36,
      depthWrite: false
    }),
    glow: new THREE.MeshPhysicalMaterial({
      color: pal.glow,
      emissive: pal.glow,
      emissiveIntensity: 1.55,
      roughness: 0.25,
      clearcoat: 0.7
    }),
    smoke: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f4f2ee'),
      emissive: pal.glow.clone().lerp(new THREE.Color('#ffffff'), 0.75),
      emissiveIntensity: 0.18,
      roughness: 0.96,
      transparent: true,
      opacity: 0.36,
      depthWrite: false
    })
  };

  const root = new THREE.Group();
  root.name = 'youngWesternDragon';

  // Reusable small geometries
  const clawGeo = buildClawGeometry(THREE, 0.0105, 0.0024);
  const spineFinGeo = buildSpineFinGeometry(THREE);

  // -------------------------------------------------------------------------
  // 1. BODY (Continuous sculpted seated torso + neck)
  // -------------------------------------------------------------------------
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  const bodyGeo = sculptSphere(THREE, 56, 40, sculptBodyPoint);
  const bodyMesh = new THREE.Mesh(bodyGeo, mats.scales);
  bodyMesh.userData.slot = 'fur';
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  body.add(bodyMesh);

  // Sculpted overlapping curved belly plates hugging the exact front surface
  const plateLevels = [0.15, 0.23, 0.32, 0.41, 0.50, 0.59, 0.68, 0.77];
  const plateShape = new THREE.Shape();
  plateShape.moveTo(-0.042, -0.008);
  plateShape.bezierCurveTo(-0.024, -0.013, 0.024, -0.013, 0.042, -0.008);
  plateShape.bezierCurveTo(0.046, 0.0, 0.036, 0.010, 0.0, 0.011);
  plateShape.bezierCurveTo(-0.036, 0.010, -0.046, 0.0, -0.042, -0.008);

  for (let idx = 0; idx < plateLevels.length; idx++) {
    const sMid = plateLevels[idx];
    const widthScale = lerp(0.96, 0.52, idx / (plateLevels.length - 1));
    const heightScale = lerp(1.05, 0.78, idx / (plateLevels.length - 1));

    const plateGeo = createBentExtrude(
      THREE,
      plateShape,
      {
        depth: 0.0042,
        bevelEnabled: true,
        bevelThickness: 0.0018,
        bevelSize: 0.0015,
        bevelSegments: 2,
        curveSegments: 16
      },
      (x, y, z) => {
        const ax = x * widthScale;
        const ay = y * heightScale;
        const theta = clamp(ax / 0.068, -0.78, 0.78);
        const sLocal = clamp(sMid + ay * 2.6, 0.08, 0.88);
        const ny = Math.cos((1.0 - sLocal) * Math.PI);
        const horiz = Math.sqrt(Math.max(0.0001, 1.0 - ny * ny));
        const nx = Math.sin(theta) * horiz;
        const nz = Math.cos(theta) * horiz;
        const [bx, by, bz] = sculptBodyPoint(nx, ny, nz);
        const pushOut = z + 0.0018;
        return [bx + Math.sin(theta) * pushOut, by, bz + Math.cos(theta) * pushOut];
      },
      0.016
    );
    const plate = new THREE.Mesh(plateGeo, mats.belly);
    plate.userData.slot = 'furAccent';
    plate.castShadow = true;
    plate.receiveShadow = true;
    body.add(plate);
  }

  // Dorsal spine ridge along neck & back (plus tiny glowing crest dots between spines)
  const backSpineS = [0.86, 0.77, 0.68, 0.59, 0.50, 0.41, 0.32, 0.23];
  const glowGemGeo = new THREE.SphereGeometry(0.0038, 12, 10);
  for (let i = 0; i < backSpineS.length; i++) {
    const s = backSpineS[i];
    const ny = Math.cos((1.0 - s) * Math.PI);
    const nz = -Math.sqrt(Math.max(0.0001, 1.0 - ny * ny));
    const [bx, by, bz] = sculptBodyPoint(0, ny, nz);

    const fin = new THREE.Mesh(spineFinGeo, mats.belly);
    fin.userData.slot = 'furAccent';
    const sc = 0.72 + Math.sin((i / (backSpineS.length - 1)) * Math.PI) * 0.42;
    fin.scale.set(sc * 0.85, sc, sc * 0.95);
    fin.position.set(bx, by, bz + 0.004);
    fin.rotation.x = -Math.PI * 0.48 - (1 - s) * 0.22;
    fin.castShadow = true;
    body.add(fin);

    if (i > 0 && i < backSpineS.length - 1 && i % 2 === 1) {
      const gem = new THREE.Mesh(glowGemGeo, mats.glow);
      gem.userData.slot = 'glow';
      gem.scale.set(0.75, 0.9, 1.35);
      gem.position.set(bx, by + 0.004, bz - 0.003);
      body.add(gem);
    }
  }

  // -------------------------------------------------------------------------
  // 2. HEAD (Continuous sculpted head+muzzle, 3-layer eyes, horns, ears, smoke)
  // -------------------------------------------------------------------------
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 0.214, 0.036);
  // Gentle curious cat-dragon head tilt
  head.rotation.set(0.06, 0.09, 0.105);
  body.add(head);

  const headGeo = sculptSphere(THREE, 56, 40, sculptHeadPoint);
  const headMesh = new THREE.Mesh(headGeo, mats.headScales);
  headMesh.userData.slot = 'fur';
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  head.add(headMesh);

  // Two cute mini crown spines on the back of the head so they move with the head
  for (let i = 0; i < 2; i++) {
    const ny = 0.72 - i * 0.34;
    const nz = -Math.sqrt(1 - ny * ny);
    const [hx, hy, hz] = sculptHeadPoint(0, ny, nz);
    const cFin = new THREE.Mesh(spineFinGeo, mats.belly);
    cFin.userData.slot = 'furAccent';
    cFin.scale.setScalar(0.58 + i * 0.12);
    cFin.position.set(hx, hy - 0.002, hz + 0.005);
    cFin.rotation.x = -0.82 - i * 0.38;
    head.add(cFin);
  }

  // Eyes placed flush & slightly inset in sculpted eye sockets
  const placeEye = (side) => {
    const isRight = side < 0;
    const dir = new THREE.Vector3(0.54 * side, 0.12, 0.73).normalize();
    const [ex, ey, ez] = sculptHeadPoint(dir.x, dir.y, dir.z);
    const eyeGrp = buildEyeGroup(THREE, mats, isRight);
    eyeGrp.name = isRight ? 'eyeR' : 'eyeL';
    // Slightly inset into the socket
    eyeGrp.position.set(ex - side * 0.0045, ey, ez - 0.0045);
    eyeGrp.lookAt(ex + side * 0.055, ey + 0.006, ez + 0.095);
    head.add(eyeGrp);

    // Subtle soft upper eyelid brow ridge hugging the eye top
    const lidPts = [
      new THREE.Vector3(-0.015, 0.006, 0.008),
      new THREE.Vector3(-0.006, 0.0155, 0.011),
      new THREE.Vector3(0.007, 0.015, 0.011),
      new THREE.Vector3(0.015, 0.005, 0.007)
    ];
    const lidCurve = new THREE.CatmullRomCurve3(lidPts);
    const lidGeo = createTaperedTube(THREE, lidCurve, 14, 8, (t) => 0.0026 * Math.sin(t * Math.PI) + 0.0007);
    const lid = new THREE.Mesh(lidGeo, mats.headScales);
    lid.userData.slot = 'fur';
    lid.position.copy(eyeGrp.position);
    lid.quaternion.copy(eyeGrp.quaternion);
    head.add(lid);

    // Subtle soft blush disc resting smoothly on the rounded cheek below the eye
    const bDir = new THREE.Vector3(0.68 * side, -0.14, 0.64).normalize();
    const [bx, by, bz] = sculptHeadPoint(bDir.x, bDir.y, bDir.z);
    const blushMesh = new THREE.Mesh(new THREE.CircleGeometry(0.012, 18), mats.blush);
    blushMesh.userData.slot = 'skin';
    blushMesh.scale.set(1.2, 0.75, 1.0);
    blushMesh.position.set(bx + side * 0.0012, by, bz + 0.0014);
    blushMesh.lookAt(bx + side * 0.06, by - 0.005, bz + 0.06);
    head.add(blushMesh);
  };
  placeEye(1);
  placeEye(-1);

  // Friendly curved dragon smile built from a thin tapered tube hugging the muzzle
  const smileSamples = [-0.52, -0.34, -0.16, 0.0, 0.16, 0.34, 0.52];
  const smilePts = smileSamples.map((u) => {
    const ny = -0.25 + Math.pow(Math.abs(u), 1.8) * 0.24;
    const nz = Math.sqrt(Math.max(0.05, 1 - u * u - ny * ny));
    const [sx, sy, sz] = sculptHeadPoint(u, ny, nz);
    return new THREE.Vector3(sx * 1.01, sy, sz + 0.0012);
  });
  const smileCurve = new THREE.CatmullRomCurve3(smilePts);
  const smileGeo = createTaperedTube(THREE, smileCurve, 26, 8, (t) => 0.0017 * Math.sin(t * Math.PI) + 0.00055);
  const smileMesh = new THREE.Mesh(smileGeo, mats.mouth);
  smileMesh.userData.slot = 'skin';
  head.add(smileMesh);

  // Nostril warm ember dots + tiny wispy smoke puffs
  const smokeGroup = new THREE.Group();
  smokeGroup.name = 'nostrilSmoke';
  head.add(smokeGroup);

  const puffGeo = sculptSphere(THREE, 14, 10, (nx, ny, nz) => {
    const bump = 1.0 + 0.22 * Math.sin(nx * 4.2 + ny * 3.1) * Math.cos(nz * 4.5);
    return [nx * 0.0062 * bump, ny * 0.0054 * bump, nz * 0.0060 * bump];
  });
  const emberGeo = new THREE.SphereGeometry(0.0028, 10, 8);

  const smokePuffs = [];
  for (const side of [1, -1]) {
    const nDir = new THREE.Vector3(0.25 * side, 0.04, 0.95).normalize();
    const [nx, ny, nz] = sculptHeadPoint(nDir.x, nDir.y, nDir.z);

    // Subtle warm ember deep inside nostril dimple
    const ember = new THREE.Mesh(emberGeo, mats.glow);
    ember.userData.slot = 'glow';
    ember.position.set(nx, ny, nz + 0.0008);
    head.add(ember);

    // Three delicate rising smoke cloudlets per nostril
    for (let k = 0; k < 3; k++) {
      const puffMat = mats.smoke.clone();
      const puff = new THREE.Mesh(puffGeo, puffMat);
      const basePos = new THREE.Vector3(nx + side * 0.003, ny + 0.007, nz + 0.005);
      puff.position.copy(basePos);
      puff.userData.smokeMeta = {
        baseX: basePos.x,
        baseY: basePos.y,
        baseZ: basePos.z,
        side,
        phase: k / 3 + (side < 0 ? 0.5 : 0)
      };
      smokeGroup.add(puff);
      smokePuffs.push(puff);
    }
  }

  // Small curved horns (LatheGeometry + smooth bend) inside "horn" group
  const hornGroup = new THREE.Group();
  hornGroup.name = 'horn';
  head.add(hornGroup);

  const hornGeoL = buildHornGeometry(THREE);
  const hornGeoR = mirrorGeometryX(hornGeoL);

  const [hlx, hly, hlz] = sculptHeadPoint(0.36, 0.78, -0.18);
  const hornL = new THREE.Mesh(hornGeoL, mats.horn);
  hornL.userData.slot = 'accent';
  hornL.position.set(hlx, hly - 0.007, hlz + 0.004);
  hornL.rotation.set(-0.18, 0.08, -0.14);
  hornL.castShadow = true;
  hornGroup.add(hornL);

  const hornR = new THREE.Mesh(hornGeoR, mats.horn);
  hornR.userData.slot = 'accent';
  hornR.position.set(-hlx, hly - 0.007, hlz + 0.004);
  hornR.rotation.set(-0.18, -0.08, 0.14);
  hornR.castShadow = true;
  hornGroup.add(hornR);

  // Cupped finned ears ("earL", "earR")
  const earGeoL = buildEarGeometry(THREE);
  const earGeoR = mirrorGeometryX(earGeoL);

  const [elx, ely, elz] = sculptHeadPoint(0.84, 0.24, -0.22);
  const earL = new THREE.Group();
  earL.name = 'earL';
  earL.position.set(elx - 0.006, ely, elz);
  earL.rotation.set(0.08, -0.26, 0.16);
  const earMeshL = new THREE.Mesh(earGeoL, mats.ear);
  earMeshL.userData.slot = 'fur';
  earMeshL.castShadow = true;
  earL.add(earMeshL);
  head.add(earL);

  const earR = new THREE.Group();
  earR.name = 'earR';
  earR.position.set(-elx + 0.006, ely, elz);
  earR.rotation.set(0.08, 0.26, -0.16);
  const earMeshR = new THREE.Mesh(earGeoR, mats.ear);
  earMeshR.userData.slot = 'fur';
  earMeshR.castShadow = true;
  earR.add(earMeshR);
  head.add(earR);

  // -------------------------------------------------------------------------
  // 3. FOUR LEGS (Cat-seated hind haunches & planted right paw + lifted left paw)
  // -------------------------------------------------------------------------

  // Front Right Leg (planted cleanly on floor at y = 0)
  const armR = new THREE.Group();
  armR.name = 'armR';
  armR.position.set(-0.048, 0.140, 0.036);
  body.add(armR);

  const armRCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.012, 0.008, -0.010),
    new THREE.Vector3(-0.006, -0.038, 0.016),
    new THREE.Vector3(-0.002, -0.088, 0.038),
    new THREE.Vector3(0.004, -0.129, 0.052)
  ]);
  const armRGeo = createTaperedTube(THREE, armRCurve, 26, 14, (t) => lerp(0.0235, 0.014, t));
  const armRMesh = new THREE.Mesh(armRGeo, mats.scales);
  armRMesh.userData.slot = 'fur';
  armRMesh.castShadow = true;
  armRMesh.receiveShadow = true;
  armR.add(armRMesh);

  const pawFR = buildSculptedPaw(THREE, clawGeo, mats.scales, mats.horn, false);
  pawFR.position.set(0.004, -0.140, 0.055);
  pawFR.rotation.y = -0.08;
  armR.add(pawFR);

  // Front Left Leg (playfully lifted & curled inward for cozy asymmetry!)
  const armL = new THREE.Group();
  armL.name = 'armL';
  armL.position.set(0.048, 0.140, 0.036);
  body.add(armL);

  const armLCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.012, 0.008, -0.010),
    new THREE.Vector3(0.008, -0.034, 0.018),
    new THREE.Vector3(0.008, -0.072, 0.046),
    new THREE.Vector3(-0.004, -0.086, 0.068)
  ]);
  const armLGeo = createTaperedTube(THREE, armLCurve, 26, 14, (t) => lerp(0.0235, 0.014, t));
  const armLMesh = new THREE.Mesh(armLGeo, mats.scales);
  armLMesh.userData.slot = 'fur';
  armLMesh.castShadow = true;
  armLMesh.receiveShadow = true;
  armL.add(armLMesh);

  const pawFL = buildSculptedPaw(THREE, clawGeo, mats.scales, mats.horn, false);
  pawFL.position.set(-0.006, -0.095, 0.070);
  pawFL.rotation.set(0.55, -0.28, -0.18);
  armL.add(pawFL);

  // Hind Legs (sculpted tucked cat haunches + ankle + planted hind paws)
  const buildHindLeg = (side) => {
    const isRight = side < 0;
    const leg = new THREE.Group();
    leg.name = isRight ? 'legR' : 'legL';
    leg.position.set(0.066 * side, 0.058, -0.016);
    body.add(leg);

    // Sculpted tucked thigh/haunch overlapping seamlessly into torso flank
    const haunchGeo = sculptSphere(THREE, 36, 26, (nx, ny, nz) => {
      let x = nx * 0.038;
      let y = ny * 0.056;
      let z = nz * 0.056;
      // Teardrop tuck: fuller lower-back, narrower knee forward
      const fwd = smoothstep(-0.3, 0.85, nz);
      y -= fwd * 0.014;
      x *= 1.0 - fwd * 0.24;
      // Flatten resting underside to sit solidly on y = 0 (local y = -0.058)
      if (y < -0.044) {
        y = -0.054 + (y + 0.044) * 0.22;
      }
      return [x - side * 0.010, y, z + 0.008];
    });
    const haunch = new THREE.Mesh(haunchGeo, mats.scales);
    haunch.userData.slot = 'fur';
    haunch.castShadow = true;
    haunch.receiveShadow = true;
    leg.add(haunch);

    // Lower shin & ankle sweeping forward onto floor
    const shinCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.006 * side, -0.014, 0.034),
      new THREE.Vector3(0.012 * side, -0.038, 0.052),
      new THREE.Vector3(0.015 * side, -0.047, 0.072)
    ]);
    const shinGeo = createTaperedTube(THREE, shinCurve, 18, 12, (t) => lerp(0.020, 0.0155, t), {
      flattenFloorY: -0.058
    });
    const shin = new THREE.Mesh(shinGeo, mats.scales);
    shin.userData.slot = 'fur';
    shin.castShadow = true;
    shin.receiveShadow = true;
    leg.add(shin);

    const hindPaw = buildSculptedPaw(THREE, clawGeo, mats.scales, mats.horn, true);
    hindPaw.position.set(0.016 * side, -0.058, 0.078);
    hindPaw.rotation.y = 0.22 * side;
    leg.add(hindPaw);
  };
  buildHindLeg(1);
  buildHindLeg(-1);

  // -------------------------------------------------------------------------
  // 4. FOLDED BAT WINGS ("wingL", "wingR")
  // -------------------------------------------------------------------------
  const wingL = buildWingSide(THREE, mats, clawGeo, false);
  wingL.name = 'wingL';
  wingL.position.set(0.034, 0.160, -0.026);
  wingL.rotation.set(0.04, 0.14, -0.06);
  body.add(wingL);

  const wingR = buildWingSide(THREE, mats, clawGeo, true);
  wingR.name = 'wingR';
  wingR.position.set(-0.034, 0.160, -0.026);
  wingR.rotation.set(0.04, -0.14, 0.06);
  body.add(wingR);

  // -------------------------------------------------------------------------
  // 5. THICK CURLED TAIL ("tail") with dorsal spines & sculpted spade tip
  // -------------------------------------------------------------------------
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(0, 0.042, -0.066);
  body.add(tail);

  // Sweeps out to the dragon's right (-x) and curls warmly around the front side
  const tailPts = [
    new THREE.Vector3(0.000, 0.006, 0.026),
    new THREE.Vector3(-0.036, -0.010, -0.046),
    new THREE.Vector3(-0.102, -0.020, -0.072),
    new THREE.Vector3(-0.158, -0.024, -0.022),
    new THREE.Vector3(-0.162, -0.026, 0.066),
    new THREE.Vector3(-0.126, -0.027, 0.142),
    new THREE.Vector3(-0.066, -0.024, 0.178),
    new THREE.Vector3(-0.018, -0.014, 0.182)
  ];
  const tailCurve = new THREE.CatmullRomCurve3(tailPts);
  const tailGeo = createTaperedTube(
    THREE,
    tailCurve,
    64,
    18,
    (t) => lerp(0.036, 0.0075, Math.pow(t, 0.78)),
    {
      flattenFloorY: -0.042,
      aspectFn: (t) => lerp(1.06, 0.92, t)
    }
  );
  const tailMesh = new THREE.Mesh(tailGeo, mats.scales);
  tailMesh.userData.slot = 'fur';
  tailMesh.castShadow = true;
  tailMesh.receiveShadow = true;
  tail.add(tailMesh);

  // Dorsal spine fins marching along the top ridge of the curled tail
  const tailSpineCount = 6;
  const tp = new THREE.Vector3();
  const tt = new THREE.Vector3();
  for (let i = 0; i < tailSpineCount; i++) {
    const u = 0.14 + (i / (tailSpineCount - 1)) * 0.68;
    tailCurve.getPointAt(u, tp);
    tailCurve.getTangentAt(u, tt);
    const r = lerp(0.036, 0.0075, Math.pow(u, 0.78));
    const fin = new THREE.Mesh(spineFinGeo, mats.belly);
    fin.userData.slot = 'furAccent';
    const sc = lerp(0.86, 0.42, i / (tailSpineCount - 1));
    fin.scale.set(sc * 0.75, sc, sc * 0.9);
    fin.position.set(tp.x, tp.y + r * 0.78, tp.z);
    fin.lookAt(tp.x + tt.x, tp.y + r * 0.78 + tt.y, tp.z + tt.z);
    fin.castShadow = true;
    tail.add(fin);
  }

  // Stylized dragon tail spade at the curled tip + warm glowing accent gem
  const spadeGeo = buildTailSpadeGeometry(THREE);
  const spade = new THREE.Mesh(spadeGeo, mats.belly);
  spade.userData.slot = 'furAccent';
  const tipP = tailCurve.getPointAt(0.99);
  const tipT = tailCurve.getTangentAt(0.99);
  spade.position.copy(tipP);
  spade.lookAt(tipP.clone().add(tipT));
  spade.castShadow = true;
  tail.add(spade);

  const tailGem = new THREE.Mesh(glowGemGeo, mats.glow);
  tailGem.userData.slot = 'glow';
  tailGem.scale.set(1.1, 0.65, 1.4);
  tailGem.position.set(0, 0.005, 0.016);
  spade.add(tailGem);

  // Store resting transforms for smooth, non-drifting idle() animation
  root.userData.anim = {
    headBaseRot: head.rotation.clone(),
    earLBaseRot: earL.rotation.clone(),
    earRBaseRot: earR.rotation.clone(),
    wingLBaseRot: wingL.rotation.clone(),
    wingRBaseRot: wingR.rotation.clone(),
    armLBaseRot: armL.rotation.clone(),
    tailBaseRot: tail.rotation.clone(),
    smokePuffs
  };

  return root;
}

// ---------------------------------------------------------------------------
// Idle Animation
// ---------------------------------------------------------------------------

export function idle(group, t) {
  const anim = group.userData.anim;
  if (!anim) return;

  const body = group.getObjectByName('body');
  const head = group.getObjectByName('head');
  const tail = group.getObjectByName('tail');
  const earL = group.getObjectByName('earL');
  const earR = group.getObjectByName('earR');
  const wingL = group.getObjectByName('wingL');
  const wingR = group.getObjectByName('wingR');
  const armL = group.getObjectByName('armL');
  const eyeL = group.getObjectByName('eyeL');
  const eyeR = group.getObjectByName('eyeR');

  // 1. Cozy gentle breathing
  const breath = Math.sin(t * 2.1);
  if (body) {
    body.scale.set(1.0 + breath * 0.014, 1.0 + breath * 0.016, 1.0 + breath * 0.014);
  }

  // 2. Curious gentle head sway & nod
  if (head) {
    head.rotation.x = anim.headBaseRot.x + Math.sin(t * 1.15) * 0.045 + breath * 0.015;
    head.rotation.y = anim.headBaseRot.y + Math.sin(t * 0.72) * 0.085;
    head.rotation.z = anim.headBaseRot.z + Math.cos(t * 0.92) * 0.042;
  }

  // 3. Periodic friendly blink every ~3.9 seconds
  const blinkCycle = t % 3.9;
  let eyeScaleY = 1.0;
  if (blinkCycle > 3.68 && blinkCycle < 3.88) {
    const u = (blinkCycle - 3.68) / 0.20;
    eyeScaleY = 1.0 - Math.sin(u * Math.PI) * 0.92;
  }
  if (eyeL) eyeL.scale.y = eyeScaleY;
  if (eyeR) eyeR.scale.y = eyeScaleY;

  // 4. Soft ear flutter & occasional tiny perk
  const earPerk = Math.pow(Math.max(0, Math.sin(t * 0.65 + 1.1)), 12) * 0.14;
  if (earL) {
    earL.rotation.z = anim.earLBaseRot.z + Math.sin(t * 1.9) * 0.04 + earPerk;
    earL.rotation.y = anim.earLBaseRot.y + Math.cos(t * 1.3) * 0.03;
  }
  if (earR) {
    earR.rotation.z = anim.earRBaseRot.z - Math.sin(t * 1.9 + 0.4) * 0.04 - earPerk * 0.7;
    earR.rotation.y = anim.earRBaseRot.y - Math.cos(t * 1.3 + 0.4) * 0.03;
  }

  // 5. Gentle breathing-synced wing settle
  if (wingL) {
    wingL.rotation.y = anim.wingLBaseRot.y + breath * 0.045;
    wingL.rotation.z = anim.wingLBaseRot.z - breath * 0.025;
  }
  if (wingR) {
    wingR.rotation.y = anim.wingRBaseRot.y - breath * 0.045;
    wingR.rotation.z = anim.wingRBaseRot.z + breath * 0.025;
  }

  // 6. Slow playful wag on curled tail (pivoting horizontally along the floor)
  if (tail) {
    tail.rotation.y = anim.tailBaseRot.y + Math.sin(t * 1.35) * 0.055;
  }

  // 7. Gentle playful bob of the raised left paw
  if (armL) {
    armL.rotation.x = anim.armLBaseRot.x + Math.sin(t * 1.85 + 0.8) * 0.065;
    armL.rotation.z = anim.armLBaseRot.z + Math.cos(t * 1.2) * 0.03;
  }

  // 8. Tiny rising smoke puffs drifting softly out of the nostrils
  for (const puff of anim.smokePuffs) {
    const m = puff.userData.smokeMeta;
    const life = (t * 0.48 + m.phase) % 1.0;
    puff.position.x = m.baseX + m.side * life * 0.012 + Math.sin(t * 3.0 + m.phase * 6.28) * 0.0025;
    puff.position.y = m.baseY + life * 0.036;
    puff.position.z = m.baseZ + life * 0.010;
    const sc = 0.42 + life * 1.15;
    puff.scale.setScalar(sc);
    puff.material.opacity = Math.sin(life * Math.PI) * 0.40;
  }
}
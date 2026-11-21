// Young Eastern Dragon (Chinese Long) — Hero-quality stylised ES module

export const META = {
  id: 'young-eastern-dragon',
  name: 'Young Eastern Dragon',
  kind: 'creature',
  footprint: [0.42, 0.58],
  variants: ['Jade Mist', 'Crimson & Gold', 'Porcelain Wave'],
  note: 'Friendly stylised Chinese long hovering in an S-curve with one front paw resting on a softly glowing pearl.'
};

const VARIANT_DEFAULTS = [
  { fur: '#2f9678', furAccent: '#f4e6c2', eye: '#e9a234', glow: '#78f5e8' }, // 0: Jade
  { fur: '#b92e36', furAccent: '#f2c86b', eye: '#ffd24c', glow: '#ffdf88' }, // 1: Crimson & Gold
  { fur: '#eef3f8', furAccent: '#5c93d6', eye: '#3d8cf0', glow: '#9ee4ff' }  // 2: White & Blue
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

function bell(x, center, width) {
  const d = (x - center) / width;
  return Math.exp(-d * d);
}

function toColor(THREE, val, fallback) {
  try {
    if (val !== undefined && val !== null) return new THREE.Color(val);
  } catch (_) {
    // fallback below
  }
  return new THREE.Color(fallback);
}

function rgbStr(col, alpha = 1) {
  const r = Math.round(clamp(col.r, 0, 1) * 255);
  const g = Math.round(clamp(col.g, 0, 1) * 255);
  const b = Math.round(clamp(col.b, 0, 1) * 255);
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

function mixColor(THREE, a, b, t) {
  return a.clone().lerp(b, clamp(t, 0, 1));
}

function shadeColor(THREE, col, factor) {
  const c = col.clone();
  if (factor >= 1) {
    c.lerp(new THREE.Color(1, 1, 1), clamp(factor - 1, 0, 1));
  } else {
    c.multiplyScalar(clamp(factor, 0, 1));
  }
  return c;
}

// Compute twist-free world-up stabilized frame on a 3D curve
function curveFrame(THREE, curve, u, upHint) {
  const pt = curve.getPointAt(clamp(u, 0, 1));
  const tangent = curve.getTangentAt(clamp(u, 0, 1)).normalize();
  const ref = upHint ? upHint.clone() : new THREE.Vector3(0, 1, 0);
  if (Math.abs(tangent.dot(ref)) > 0.94) {
    ref.set(0, 0, 1);
  }
  const side = new THREE.Vector3().crossVectors(tangent, ref).normalize();
  const up = new THREE.Vector3().crossVectors(side, tangent).normalize();
  return { pt, tangent, side, up };
}

// Ring-by-ring tapered tube along a CatmullRomCurve3
function createTaperedTube(THREE, curve, config) {
  const segs = config.segments || 64;
  const radSegs = config.radialSegments || 20;
  const radiusFn = config.radiusFn || (() => 0.02);
  const shapeFn = config.shapeFn || null;
  const upHint = config.upHint || new THREE.Vector3(0, 1, 0);
  const capStart = config.capStart !== undefined ? config.capStart : true;
  const capEnd = config.capEnd !== undefined ? config.capEnd : true;
  const vRepeat = config.vRepeat || 1;

  const ringStride = radSegs + 1;
  const vertCount = (segs + 1) * ringStride + (capStart ? 1 : 0) + (capEnd ? 1 : 0);
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const vertU = new Float32Array(vertCount);
  const indices = [];

  const tmp = new THREE.Vector3();
  let ptr = 0;

  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const { pt, side, up } = curveFrame(THREE, curve, u, upHint);

    for (let j = 0; j <= radSegs; j++) {
      const frac = j / radSegs;
      const theta = frac * Math.PI * 2;
      // theta = 0 -> bottom (-up), theta = PI/2 -> +side, theta = PI -> top (+up)
      let rx = Math.sin(theta);
      let ry = -Math.cos(theta);
      const baseR = radiusFn(u, theta);

      if (shapeFn) {
        const shaped = shapeFn(rx, ry, u, theta);
        rx = shaped[0];
        ry = shaped[1];
      }

      tmp.copy(pt)
        .addScaledVector(side, rx * baseR)
        .addScaledVector(up, ry * baseR);

      positions[ptr * 3] = tmp.x;
      positions[ptr * 3 + 1] = tmp.y;
      positions[ptr * 3 + 2] = tmp.z;

      uvs[ptr * 2] = frac;
      uvs[ptr * 2 + 1] = u * vRepeat;
      vertU[ptr] = u;
      ptr++;
    }
  }

  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radSegs; j++) {
      const a = i * ringStride + j;
      const b = (i + 1) * ringStride + j;
      const c = (i + 1) * ringStride + (j + 1);
      const d = i * ringStride + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  if (capStart) {
    const startPt = curve.getPointAt(0);
    const cIdx = ptr++;
    positions[cIdx * 3] = startPt.x;
    positions[cIdx * 3 + 1] = startPt.y;
    positions[cIdx * 3 + 2] = startPt.z;
    uvs[cIdx * 2] = 0.5;
    uvs[cIdx * 2 + 1] = 0;
    vertU[cIdx] = 0;
    for (let j = 0; j < radSegs; j++) {
      indices.push(cIdx, j, j + 1);
    }
  }

  if (capEnd) {
    const endPt = curve.getPointAt(1);
    const cIdx = ptr++;
    positions[cIdx * 3] = endPt.x;
    positions[cIdx * 3 + 1] = endPt.y;
    positions[cIdx * 3 + 2] = endPt.z;
    uvs[cIdx * 2] = 0.5;
    uvs[cIdx * 2 + 1] = vRepeat;
    vertU[cIdx] = 1;
    const baseRing = segs * ringStride;
    for (let j = 0; j < radSegs; j++) {
      indices.push(cIdx, baseRing + j + 1, baseRing + j);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.userData.vertU = vertU;
  return geo;
}

// Merge an array of geometries (optionally carrying per-geometry spine parameter s)
function mergeGeometriesWithS(THREE, items) {
  let totalVerts = 0;
  let totalIdx = 0;
  const prepared = [];

  for (let k = 0; k < items.length; k++) {
    const g = items[k].geo;
    const pos = g.getAttribute('position');
    const norm = g.getAttribute('normal');
    const uv = g.getAttribute('uv');
    const idx = g.getIndex();
    const vCount = pos.count;
    const iCount = idx ? idx.count : vCount;
    prepared.push({ pos, norm, uv, idx, vCount, iCount, s: items[k].s || 0 });
    totalVerts += vCount;
    totalIdx += iCount;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const vertS = new Float32Array(totalVerts);
  const indices = new Uint32Array(totalIdx);

  let vOff = 0;
  let iOff = 0;
  for (let k = 0; k < prepared.length; k++) {
    const it = prepared[k];
    for (let i = 0; i < it.vCount; i++) {
      const vi = (vOff + i) * 3;
      positions[vi] = it.pos.getX(i);
      positions[vi + 1] = it.pos.getY(i);
      positions[vi + 2] = it.pos.getZ(i);

      if (it.norm) {
        normals[vi] = it.norm.getX(i);
        normals[vi + 1] = it.norm.getY(i);
        normals[vi + 2] = it.norm.getZ(i);
      }
      if (it.uv) {
        uvs[(vOff + i) * 2] = it.uv.getX(i);
        uvs[(vOff + i) * 2 + 1] = it.uv.getY(i);
      }
      vertS[vOff + i] = it.s;
    }

    if (it.idx) {
      for (let i = 0; i < it.iCount; i++) {
        indices[iOff + i] = it.idx.getX(i) + vOff;
      }
    } else {
      for (let i = 0; i < it.vCount; i++) {
        indices[iOff + i] = vOff + i;
      }
    }
    vOff += it.vCount;
    iOff += it.iCount;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.userData.vertS = vertS;
  return merged;
}

// Normalize ExtrudeGeometry UVs from XY bounds and apply 3D vertex bending
function createBentExtrusion(THREE, shape, extrudeOpts, bendFn) {
  const geo = new THREE.ExtrudeGeometry(shape, extrudeOpts);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const minX = bb.min.x;
  const maxX = bb.max.x;
  const minY = bb.min.y;
  const maxY = bb.max.y;
  const midZ = (bb.min.z + bb.max.z) * 0.5;
  const spanX = Math.max(1e-5, maxX - minX);
  const spanY = Math.max(1e-5, maxY - minY);

  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  const out = [0, 0, 0];

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i) - midZ;
    const nx = (x - minX) / spanX;
    const ny = (y - minY) / spanY;
    uv.setXY(i, nx, ny);
    if (bendFn) {
      bendFn(x, y, z, nx, ny, out);
      pos.setXYZ(i, out[0], out[1], out[2]);
    } else {
      pos.setZ(i, z);
    }
  }
  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Sculpt a single point on the unit sphere into the friendly, noble dragon head
function sculptHeadPoint(ux, uy, uz) {
  let x = ux * 0.043;
  let y = uy * 0.036;
  let z = uz * 0.054;

  // Elongated cute rounded snout (+z)
  const snoutT = smoothstep(0.06, 0.96, uz);
  z += snoutT * 0.025;

  // Gentle nose-bridge taper then soft rounded muzzle fullness
  const bridgePinch = bell(uz, 0.44, 0.24);
  const muzzleFull = smoothstep(0.56, 0.94, uz);
  x *= 1.0 - 0.27 * bridgePinch + 0.10 * muzzleFull * (1.0 - 0.35 * Math.max(0, uy));

  // Forehead stop: crown rises smoothly, snout sits lower
  const upperMask = smoothstep(-0.15, 0.55, uy);
  y -= 0.0115 * smoothstep(0.14, 0.84, uz) * upperMask;
  y += 0.0045 * bell(uz, -0.05, 0.42) * smoothstep(0.25, 0.92, uy);

  // Cute chubby cheeks
  const cheekMask = bell(uz, 0.22, 0.30) * bell(uy, -0.18, 0.30) * smoothstep(0.28, 0.82, Math.abs(ux));
  x += Math.sign(ux) * 0.0085 * cheekMask;
  y -= 0.0022 * cheekMask;
  z += 0.003 * cheekMask;

  // Noble brow ridge arching over eyes
  const browMask = bell(uz, 0.34, 0.24) * bell(uy, 0.42, 0.22) * bell(Math.abs(ux), 0.48, 0.26);
  y += 0.0055 * browMask;
  z += 0.0035 * browMask;
  x += Math.sign(ux) * 0.003 * browMask;

  // Shallow eye sockets so the 3-layer eyes sit snugly inset
  const eyeSocket = bell(uz, 0.42, 0.18) * bell(uy, 0.14, 0.18) * bell(Math.abs(ux), 0.60, 0.20);
  x -= Math.sign(ux) * 0.0042 * eyeSocket;
  z -= 0.0032 * eyeSocket;

  // Rounded nose pad & twin soft nostril mounds
  const nosePad = smoothstep(0.84, 0.99, uz) * bell(uy, 0.06, 0.26);
  z += 0.0042 * nosePad;
  y += 0.0016 * nosePad;

  const nostrilMound = bell(uz, 0.88, 0.10) * bell(uy, 0.10, 0.16) * bell(Math.abs(ux), 0.27, 0.12);
  x += Math.sign(ux) * 0.0028 * nostrilMound;
  y += 0.0018 * nostrilMound;

  // Gently flattened soft chin / jaw underside
  if (uy < -0.18) {
    const chinT = smoothstep(-0.18, -0.88, uy);
    y += chinT * 0.0068 * smoothstep(-0.2, 0.85, uz);
  }

  // Smooth occiput transition toward neck
  const neckBlend = smoothstep(-0.45, -0.95, uz) * smoothstep(0.35, -0.55, uy);
  y -= 0.004 * neckBlend;
  x *= 1.0 - 0.14 * neckBlend;

  return [x, y, z];
}

// Create curved tapered claw from a 20-point LatheGeometry bent into a gentle hook
function createCurvedClawGeometry(THREE, length, baseR, curlAmt) {
  const pts = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let r;
    if (t < 0.08) {
      r = baseR * lerp(0.82, 1.0, t / 0.08);
    } else {
      r = baseR * Math.pow(1 - (t - 0.08) / 0.92, 0.78);
    }
    pts.push(new THREE.Vector2(Math.max(0.00018, r), t * length));
  }
  const geo = new THREE.LatheGeometry(pts, 10);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = clamp(y / length, 0, 1);
    const ang = t * curlAmt;
    // Bend forward (+z) and slightly downward (-y)
    const ny = Math.sin(ang) * length * 0.45 + y * (1 - 0.35 * t);
    const nz = z + (1 - Math.cos(ang)) * length * 0.78;
    // Align claw primarily along +z with downward hook
    pos.setXYZ(i, x, -nz * 0.65 + y * 0.12, ny * 1.08);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Procedural CanvasTextures using kit.canvasTexture & kit.noise
function buildTextures(THREE, kit, cols, variant) {
  const { fur, furAccent, eye, glow } = cols;
  const furDark = shadeColor(THREE, fur, 0.56);
  const furLight = mixColor(THREE, fur, furAccent, 0.55);
  const goldTint = new THREE.Color('#f4c860');
  const cobaltTint = new THREE.Color('#3b6cb8');
  const jadeHighlight = new THREE.Color('#aef5df');

  // 1. Body Scale Colour Map (512 x 512, tiles vertically along body, wraps circumference horizontally)
  const scaleMap = kit.canvasTexture(512, 512, (ctx, w, h) => {
    // Horizontal dorsal-ventral gradient (u=0 & 1 belly, u=0.5 dorsal spine)
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0.0, rgbStr(furLight));
    grad.addColorStop(0.18, rgbStr(fur));
    grad.addColorStop(0.5, rgbStr(furDark));
    grad.addColorStop(0.82, rgbStr(fur));
    grad.addColorStop(1.0, rgbStr(furLight));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle organic noise mottling
    for (let py = 0; py < h; py += 8) {
      for (let px = 0; px < w; px += 8) {
        const n = kit.noise(px * 0.025, py * 0.025);
        const dorsal = Math.sin((px / w) * Math.PI);
        if (variant === 0) {
          // Jade cloud-mist mottling
          const mist = smoothstep(0.45, 0.85, n);
          ctx.fillStyle = rgbStr(jadeHighlight, mist * 0.22 * (0.4 + 0.6 * dorsal));
          ctx.fillRect(px, py, 9, 9);
        } else if (variant === 1) {
          // Deep lacquer richness + warm gold cloud shimmer
          const lacquer = smoothstep(0.5, 0.88, n);
          ctx.fillStyle = rgbStr(goldTint, lacquer * 0.14 * dorsal);
          ctx.fillRect(px, py, 9, 9);
        } else {
          // Porcelain ink-wash mist
          const wave = Math.sin(py * 0.049 + n * 4.5) * 0.5 + 0.5;
          ctx.fillStyle = rgbStr(cobaltTint, wave * 0.22 * (0.25 + 0.75 * dorsal));
          ctx.fillRect(px, py, 9, 9);
        }
      }
    }

    // Staggered overlapping eastern dragon scales (seamless vertically & horizontally)
    const colsCount = 16;
    const rowsCount = 14;
    const cellW = w / colsCount;
    const cellH = h / rowsCount;

    for (let row = -1; row <= rowsCount; row++) {
      const xShift = (row & 1) ? cellW * 0.5 : 0;
      const cy = row * cellH;
      for (let col = -1; col <= colsCount; col++) {
        const cx = col * cellW + xShift;
        const uNorm = ((cx % w) + w) % w / w;
        const dorsal = Math.sin(uNorm * Math.PI); // 1 at top back, 0 at belly
        const n = kit.noise(col * 0.7 + 3.1, ((row % rowsCount) + rowsCount) % rowsCount * 0.7);

        const rX = cellW * 0.54;
        const rY = cellH * 0.68;

        // Scale shadow under rim
        ctx.beginPath();
        ctx.ellipse(cx, cy + cellH * 0.12, rX, rY, 0, 0, Math.PI * 2);
        ctx.fillStyle = rgbStr(furDark, 0.34);
        ctx.fill();

        // Main scale body gradient
        const baseScaleCol = mixColor(THREE, furLight, dorsal > 0.55 ? furDark : fur, 0.35 + 0.52 * dorsal);
        const hiCol = shadeColor(THREE, baseScaleCol, 1.24 + n * 0.12);
        const sg = ctx.createRadialGradient(cx, cy - rY * 0.18, rX * 0.1, cx, cy, rY * 1.05);
        sg.addColorStop(0.0, rgbStr(hiCol, 0.88));
        sg.addColorStop(0.7, rgbStr(baseScaleCol, 0.92));
        sg.addColorStop(1.0, rgbStr(shadeColor(THREE, baseScaleCol, 0.72), 0.95));

        ctx.beginPath();
        ctx.ellipse(cx, cy, rX * 0.94, rY * 0.92, 0, 0, Math.PI * 2);
        ctx.fillStyle = sg;
        ctx.fill();

        // Variant-specific scale filigree & rim detail
        ctx.beginPath();
        ctx.arc(cx, cy + rY * 0.04, rX * 0.86, 0.18 * Math.PI, 0.82 * Math.PI);
        if (variant === 0) {
          // Jade celadon translucent rim + occasional gold fleck near back
          ctx.strokeStyle = rgbStr(jadeHighlight, 0.32 + 0.18 * dorsal);
          ctx.lineWidth = 1.4;
          ctx.stroke();
          if (dorsal > 0.65 && n > 0.62) {
            ctx.fillStyle = rgbStr(goldTint, 0.45);
            ctx.beginPath();
            ctx.arc(cx, cy + rY * 0.15, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (variant === 1) {
          // Imperial crimson & gold filigree rims
          ctx.strokeStyle = rgbStr(goldTint, 0.25 + 0.52 * dorsal);
          ctx.lineWidth = dorsal > 0.45 ? 2.0 : 1.2;
          ctx.stroke();
        } else {
          // White & blue porcelain delicate cobalt rims & fine inner wave arc
          ctx.strokeStyle = rgbStr(cobaltTint, 0.28 + 0.44 * dorsal);
          ctx.lineWidth = 1.6;
          ctx.stroke();
          if (dorsal > 0.35) {
            ctx.beginPath();
            ctx.arc(cx, cy - rY * 0.08, rX * 0.48, 0.22 * Math.PI, 0.78 * Math.PI);
            ctx.strokeStyle = rgbStr(cobaltTint, 0.26 * dorsal);
            ctx.lineWidth = 1.1;
            ctx.stroke();
          }
        }
      }
    }

    // Extra flank motif band (seamless vertically)
    if (variant === 1) {
      // Gold cloud-scroll accent dots along upper flanks
      ctx.strokeStyle = rgbStr(goldTint, 0.52);
      ctx.lineWidth = 2.4;
      for (const sideX of [w * 0.31, w * 0.69]) {
        for (let k = 0; k < 4; k++) {
          const sy = (k + 0.5) * (h / 4);
          ctx.beginPath();
          ctx.arc(sideX, sy, 14, 0.2, Math.PI * 1.45);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(sideX + (sideX < w * 0.5 ? -8 : 8), sy + 14, 8, Math.PI * 0.6, Math.PI * 1.9);
          ctx.stroke();
        }
      }
    } else if (variant === 2) {
      // Flowing porcelain wave ribbons along flanks
      ctx.strokeStyle = rgbStr(cobaltTint, 0.36);
      ctx.lineWidth = 2.2;
      for (const sideX of [w * 0.32, w * 0.68]) {
        ctx.beginPath();
        for (let py = 0; py <= h; py += 6) {
          const wx = sideX + Math.sin((py / h) * Math.PI * 4) * 14;
          if (py === 0) ctx.moveTo(wx, py);
          else ctx.lineTo(wx, py);
        }
        ctx.stroke();
      }
    }
  });
  scaleMap.colorSpace = THREE.SRGBColorSpace;
  scaleMap.wrapS = THREE.RepeatWrapping;
  scaleMap.wrapT = THREE.RepeatWrapping;
  scaleMap.repeat.set(1, 5.5);

  // 2. Scale Bump Map (512 x 512)
  const scaleBump = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#383838';
    ctx.fillRect(0, 0, w, h);
    const colsCount = 16;
    const rowsCount = 14;
    const cellW = w / colsCount;
    const cellH = h / rowsCount;

    for (let row = -1; row <= rowsCount; row++) {
      const xShift = (row & 1) ? cellW * 0.5 : 0;
      const cy = row * cellH;
      for (let col = -1; col <= colsCount; col++) {
        const cx = col * cellW + xShift;
        const rX = cellW * 0.52;
        const rY = cellH * 0.64;
        const bg = ctx.createRadialGradient(cx, cy - rY * 0.15, rX * 0.08, cx, cy, rY);
        bg.addColorStop(0.0, '#f0f0f0');
        bg.addColorStop(0.72, '#9a9a9a');
        bg.addColorStop(1.0, '#202020');
        ctx.beginPath();
        ctx.ellipse(cx, cy, rX, rY, 0, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();
      }
    }
  });
  scaleBump.wrapS = THREE.RepeatWrapping;
  scaleBump.wrapT = THREE.RepeatWrapping;
  scaleBump.repeat.set(1, 5.5);

  // 3. Head Texture (512 x 512, SphereGeometry UV: u=0.25 is +z front snout, v_canvas=0 is +y crown)
  const headMap = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, rgbStr(furDark));
    grad.addColorStop(0.32, rgbStr(fur));
    grad.addColorStop(0.62, rgbStr(mixColor(THREE, fur, furLight, 0.35)));
    grad.addColorStop(0.84, rgbStr(furLight));
    grad.addColorStop(1.0, rgbStr(furAccent));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Fine gentle micro-scales on upper head & cheeks
    const colsCount = 34;
    const rowsCount = 24;
    const cw = w / colsCount;
    const ch = h / rowsCount;
    for (let r = 2; r < rowsCount - 5; r++) {
      const y = r * ch;
      const vFrac = r / rowsCount;
      const alpha = smoothstep(0.08, 0.25, vFrac) * (1 - smoothstep(0.55, 0.78, vFrac)) * 0.32;
      const xOff = (r & 1) ? cw * 0.5 : 0;
      for (let c = 0; c <= colsCount; c++) {
        const x = c * cw + xOff;
        ctx.beginPath();
        ctx.arc(x, y, cw * 0.44, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.strokeStyle = rgbStr(shadeColor(THREE, fur, 1.3), alpha);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // Soft lighter muzzle highlight around front snout (u=0.25, py ~ 0.52*h)
    const snoutX = w * 0.25;
    const snoutY = h * 0.54;
    const mGrad = ctx.createRadialGradient(snoutX, snoutY, 4, snoutX, snoutY, 58);
    mGrad.addColorStop(0.0, rgbStr(mixColor(THREE, fur, furAccent, 0.55), 0.55));
    mGrad.addColorStop(1.0, rgbStr(fur, 0.0));
    ctx.fillStyle = mGrad;
    ctx.beginPath();
    ctx.arc(snoutX, snoutY, 58, 0, Math.PI * 2);
    ctx.fill();

    // Cute soft darker nose-tip shading
    const noseGrad = ctx.createRadialGradient(snoutX, h * 0.48, 2, snoutX, h * 0.48, 17);
    noseGrad.addColorStop(0.0, rgbStr(shadeColor(THREE, furDark, 0.72), 0.72));
    noseGrad.addColorStop(1.0, rgbStr(furDark, 0.0));
    ctx.fillStyle = noseGrad;
    ctx.beginPath();
    ctx.ellipse(snoutX, h * 0.48, 18, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Auspicious variant-specific forehead crest mark (u=0.25, py ~ 0.31*h)
    const fx = w * 0.25;
    const fy = h * 0.31;
    ctx.save();
    if (variant === 0) {
      // Jade teardrop-cloud mark
      ctx.fillStyle = rgbStr(jadeHighlight, 0.72);
      ctx.beginPath();
      ctx.moveTo(fx, fy - 14);
      ctx.bezierCurveTo(fx + 10, fy - 2, fx + 8, fy + 12, fx, fy + 14);
      ctx.bezierCurveTo(fx - 8, fy + 12, fx - 10, fy - 2, fx, fy - 14);
      ctx.fill();
      ctx.strokeStyle = rgbStr(goldTint, 0.65);
      ctx.lineWidth = 1.6;
      ctx.stroke();
    } else if (variant === 1) {
      // Imperial golden flame crest mark
      ctx.fillStyle = rgbStr(goldTint, 0.88);
      ctx.beginPath();
      ctx.moveTo(fx, fy - 18);
      ctx.bezierCurveTo(fx + 6, fy - 6, fx + 14, fy + 4, fx, fy + 14);
      ctx.bezierCurveTo(fx - 14, fy + 4, fx - 6, fy - 6, fx, fy - 18);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(fx, fy + 5, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = rgbStr(fur, 0.8);
      ctx.fill();
    } else {
      // Porcelain cobalt wave-lotus mark
      ctx.strokeStyle = rgbStr(cobaltTint, 0.85);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(fx, fy - 15);
      ctx.bezierCurveTo(fx + 11, fy - 2, fx + 9, fy + 10, fx, fy + 13);
      ctx.bezierCurveTo(fx - 9, fy + 10, fx - 11, fy - 2, fx, fy - 15);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(fx, fy + 2, 4, 0, Math.PI * 2);
      ctx.fillStyle = rgbStr(cobaltTint, 0.78);
      ctx.fill();
    }
    ctx.restore();
  });
  headMap.colorSpace = THREE.SRGBColorSpace;

  // 4. Mane & Tail Silky Fur Map + Bump Map (256 x 256)
  const maneRootCol = mixColor(THREE, furAccent, fur, 0.22);
  const maneTipCol = variant === 0
    ? mixColor(THREE, furAccent, jadeHighlight, 0.35)
    : variant === 1
      ? mixColor(THREE, furAccent, new THREE.Color('#fff1be'), 0.45)
      : mixColor(THREE, furAccent, new THREE.Color('#d8eeff'), 0.5);

  const maneMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0.0, rgbStr(maneRootCol));
    g.addColorStop(0.45, rgbStr(furAccent));
    g.addColorStop(1.0, rgbStr(maneTipCol));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 120; i++) {
      const x0 = (i / 120) * w + (kit.noise(i * 0.4, 1.3) - 0.5) * 6;
      const bright = kit.noise(i * 0.9, 4.7);
      const col = bright > 0.5 ? shadeColor(THREE, furAccent, 1.28) : shadeColor(THREE, furAccent, 0.78);
      ctx.strokeStyle = rgbStr(col, 0.42);
      ctx.lineWidth = 1.2 + bright * 1.4;
      ctx.beginPath();
      ctx.moveTo(x0, h);
      ctx.bezierCurveTo(
        x0 + (bright - 0.5) * 16, h * 0.65,
        x0 - (bright - 0.5) * 14, h * 0.32,
        x0 + (bright - 0.5) * 8, 0
      );
      ctx.stroke();
    }
  });
  maneMap.colorSpace = THREE.SRGBColorSpace;

  const maneBump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {
      const x0 = (i / 140) * w;
      const v = Math.floor(85 + kit.noise(i * 0.8, 2.2) * 155);
      ctx.strokeStyle = `rgb(${v},${v},${v})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x0, h);
      ctx.quadraticCurveTo(x0 + ((i & 1) ? 6 : -6), h * 0.5, x0, 0);
      ctx.stroke();
    }
  });

  // 5. Belly Plate Scute Texture + Bump (256 x 256)
  const bellyBase = mixColor(THREE, furAccent, new THREE.Color('#fff8ea'), variant === 2 ? 0.52 : 0.25);
  const bellyEdge = shadeColor(THREE, bellyBase, 0.76);
  const bellyMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, rgbStr(bellyEdge));
    g.addColorStop(0.2, rgbStr(bellyBase));
    g.addColorStop(0.75, rgbStr(shadeColor(THREE, bellyBase, 1.12)));
    g.addColorStop(1.0, rgbStr(bellyEdge));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Subtle horizontal lamellar ridges
    for (let y = 12; y < h; y += 18) {
      ctx.strokeStyle = rgbStr(bellyEdge, 0.22);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Subtle variant trim along bottom border
    if (variant === 1) {
      ctx.strokeStyle = rgbStr(goldTint, 0.45);
      ctx.lineWidth = 5;
      ctx.strokeRect(6, 6, w - 12, h - 12);
    } else if (variant === 2) {
      ctx.strokeStyle = rgbStr(cobaltTint, 0.28);
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, w - 16, h - 16);
    }
  });
  bellyMap.colorSpace = THREE.SRGBColorSpace;

  const bellyBump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, '#444444');
    g.addColorStop(0.25, '#dcdcdc');
    g.addColorStop(0.8, '#e8e8e8');
    g.addColorStop(1.0, '#303030');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

  // 6. Antler Organic Grain Texture + Bump (256 x 256)
  const antlerBase = mixColor(THREE, furAccent, new THREE.Color('#f6edd8'), 0.55);
  const antlerMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0.0, rgbStr(shadeColor(THREE, antlerBase, 0.72)));
    g.addColorStop(0.45, rgbStr(antlerBase));
    g.addColorStop(1.0, rgbStr(shadeColor(THREE, antlerBase, 1.18)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 60; i++) {
      const x = (i / 60) * w;
      const n = kit.noise(i * 0.7, 5.1);
      ctx.strokeStyle = rgbStr(shadeColor(THREE, antlerBase, 0.68 + n * 0.3), 0.3);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + (n - 0.5) * 8, 0);
      ctx.stroke();
    }
  });
  antlerMap.colorSpace = THREE.SRGBColorSpace;

  const antlerBump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = (i / 70) * w;
      const v = Math.floor(90 + kit.noise(i * 1.1, 3.3) * 140);
      ctx.strokeStyle = `rgb(${v},${v},${v})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x, 0);
      ctx.stroke();
    }
  });

  // 7. Expressive Iris Texture (256 x 256)
  const irisMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const r = w * 0.48;

    ctx.fillStyle = '#12101a';
    ctx.fillRect(0, 0, w, h);

    // Rich radial iris colour
    const ig = ctx.createRadialGradient(cx, cy + r * 0.14, r * 0.15, cx, cy, r);
    ig.addColorStop(0.0, rgbStr(shadeColor(THREE, eye, 1.38)));
    ig.addColorStop(0.58, rgbStr(eye));
    ig.addColorStop(0.86, rgbStr(shadeColor(THREE, eye, 0.55)));
    ig.addColorStop(1.0, '#14121d');
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Subtle radial iris fibres
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      ctx.strokeStyle = rgbStr(shadeColor(THREE, eye, (i & 1) ? 1.35 : 0.65), 0.35);
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.34, cy + Math.sin(a) * r * 0.34);
      ctx.lineTo(cx + Math.cos(a) * r * 0.88, cy + Math.sin(a) * r * 0.88);
      ctx.stroke();
    }

    // Warm lower luminous crescent
    const cg = ctx.createRadialGradient(cx, cy + r * 0.44, 4, cx, cy + r * 0.36, r * 0.52);
    cg.addColorStop(0.0, rgbStr(shadeColor(THREE, eye, 1.65), 0.85));
    cg.addColorStop(1.0, rgbStr(eye, 0.0));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.36, r * 0.52, 0, Math.PI * 2);
    ctx.fill();

    // Friendly large rounded pupil
    ctx.fillStyle = '#0e0c16';
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.02, r * 0.43, r * 0.47, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  irisMap.colorSpace = THREE.SRGBColorSpace;

  // 8. Soft Cheek Blush Texture (128 x 128)
  const blushMap = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createRadialGradient(w * 0.5, h * 0.5, 4, w * 0.5, h * 0.5, w * 0.46);
    bg.addColorStop(0.0, 'rgba(255, 136, 152, 0.72)');
    bg.addColorStop(0.55, 'rgba(255, 148, 162, 0.34)');
    bg.addColorStop(1.0, 'rgba(255, 155, 168, 0.0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  });
  blushMap.colorSpace = THREE.SRGBColorSpace;

  // 9. Glowing Dragon Pearl Mist Texture (256 x 256)
  const pearlMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const coreLight = shadeColor(THREE, glow, 1.48);
    ctx.fillStyle = rgbStr(glow);
    ctx.fillRect(0, 0, w, h);

    for (let py = 0; py < h; py += 4) {
      for (let px = 0; px < w; px += 4) {
        const n1 = kit.noise(px * 0.022, py * 0.022);
        const n2 = kit.noise(px * 0.048 + n1 * 2.5, py * 0.048 - n1 * 2.0);
        const swirl = smoothstep(0.32, 0.82, n2);
        const c = mixColor(THREE, glow, coreLight, swirl);
        ctx.fillStyle = rgbStr(c);
        ctx.fillRect(px, py, 5, 5);
      }
    }
  });
  pearlMap.colorSpace = THREE.SRGBColorSpace;

  return {
    scaleMap,
    scaleBump,
    headMap,
    maneMap,
    maneBump,
    bellyMap,
    bellyBump,
    antlerMap,
    antlerBump,
    irisMap,
    blushMap,
    pearlMap
  };
}

// Compute shared traveling body wave displacement at spine parameter s in [0, 1]
function spineWaveOffset(s, t, out) {
  const phase = t * 1.85 - s * 5.2;
  // Dampen subtly near front shoulder (s=0.20) so the front paw stays planted on the pearl
  const anchorDamp = 0.14 + 0.86 * Math.min(1, Math.abs(s - 0.20) * 2.3);
  const tailBoost = 0.55 + 0.78 * s;
  const amp = anchorDamp * tailBoost;
  out[0] = Math.sin(phase) * 0.0072 * amp;
  out[1] = Math.cos(phase * 0.92 + 0.5) * 0.0042 * amp + Math.sin(t * 1.9) * 0.0024 * anchorDamp;
  out[2] = Math.cos(phase) * 0.0030 * amp;
}

export function build(THREE, opts = {}, kit) {
  const variant = (opts.variant === 1 || opts.variant === 2) ? opts.variant : 0;
  const defaults = VARIANT_DEFAULTS[variant];

  const cols = {
    fur: toColor(THREE, opts.fur, defaults.fur),
    furAccent: toColor(THREE, opts.furAccent, defaults.furAccent),
    eye: toColor(THREE, opts.eye, defaults.eye),
    glow: toColor(THREE, opts.glow, defaults.glow)
  };

  const tex = buildTextures(THREE, kit, cols, variant);

  // Shared MeshPhysicalMaterials
  const bodyScaleMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: tex.scaleMap,
    bumpMap: tex.scaleBump,
    bumpScale: 0.0028,
    roughness: 0.48,
    metalness: 0.04,
    clearcoat: 0.34,
    clearcoatRoughness: 0.36,
    sheen: 0.45,
    sheenRoughness: 0.6,
    sheenColor: shadeColor(THREE, cols.fur, 1.35)
  });

  const headMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: tex.headMap,
    bumpMap: tex.scaleBump,
    bumpScale: 0.0012,
    roughness: 0.54,
    metalness: 0.02,
    clearcoat: 0.24,
    clearcoatRoughness: 0.45,
    sheen: 0.55,
    sheenRoughness: 0.65,
    sheenColor: shadeColor(THREE, cols.fur, 1.38)
  });

  const maneMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: tex.maneMap,
    bumpMap: tex.maneBump,
    bumpScale: 0.0022,
    roughness: 0.90,
    metalness: 0.0,
    sheen: 0.92,
    sheenRoughness: 0.58,
    sheenColor: shadeColor(THREE, cols.furAccent, 1.42)
  });

  const bellyMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: tex.bellyMap,
    bumpMap: tex.bellyBump,
    bumpScale: 0.0022,
    roughness: 0.52,
    metalness: 0.05,
    clearcoat: 0.32,
    clearcoatRoughness: 0.38,
    sheen: 0.35,
    sheenColor: shadeColor(THREE, cols.furAccent, 1.3)
  });

  const finMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: tex.maneMap,
    bumpMap: tex.maneBump,
    bumpScale: 0.0016,
    roughness: 0.62,
    metalness: 0.04,
    clearcoat: 0.28,
    clearcoatRoughness: 0.42,
    sheen: 0.65,
    sheenColor: shadeColor(THREE, cols.furAccent, 1.38)
  });

  const antlerMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: tex.antlerMap,
    bumpMap: tex.antlerBump,
    bumpScale: 0.0020,
    roughness: 0.22,
    metalness: 0.06,
    clearcoat: 0.78,
    clearcoatRoughness: 0.22
  });

  const clawMat = new THREE.MeshPhysicalMaterial({
    color: mixColor(THREE, cols.furAccent, new THREE.Color('#fff5e2'), 0.68),
    roughness: 0.16,
    metalness: 0.05,
    clearcoat: 0.92,
    clearcoatRoughness: 0.14
  });

  const whiskerMat = new THREE.MeshPhysicalMaterial({
    color: shadeColor(THREE, cols.furAccent, 1.15),
    roughness: 0.72,
    sheen: 0.82,
    sheenColor: new THREE.Color('#ffffff')
  });

  const innerEarMat = new THREE.MeshPhysicalMaterial({
    color: mixColor(THREE, cols.furAccent, new THREE.Color('#f4a6b0'), 0.42),
    roughness: 0.88,
    sheen: 0.75,
    sheenColor: new THREE.Color('#ffe8ec')
  });

  const mouthMat = new THREE.MeshPhysicalMaterial({
    color: shadeColor(THREE, cols.fur, 0.34),
    roughness: 0.48,
    clearcoat: 0.25
  });

  const eyeBaseMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#14111d'),
    roughness: 0.06,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05
  });

  const irisMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: tex.irisMap,
    roughness: 0.10,
    metalness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06
  });

  const catchlightMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.55,
    roughness: 0.05,
    clearcoat: 1.0
  });

  const blushMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: tex.blushMap,
    transparent: true,
    depthWrite: false,
    roughness: 0.92,
    sheen: 0.6,
    sheenColor: new THREE.Color('#ffd6dc')
  });

  const pearlCoreMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: tex.pearlMap,
    emissive: cols.glow.clone(),
    emissiveMap: tex.pearlMap,
    emissiveIntensity: 1.55,
    roughness: 0.14,
    clearcoat: 0.9
  });

  const pearlShellMat = new THREE.MeshPhysicalMaterial({
    color: shadeColor(THREE, cols.glow, 1.35),
    emissive: cols.glow.clone(),
    emissiveIntensity: 0.42,
    roughness: 0.07,
    metalness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: 0.38
  });

  const root = new THREE.Group();
  root.name = 'young-eastern-dragon';

  // =========================================================================
  // 1. SERPENTINE BODY S-CURVE (~0.90 m length, ~0.07 m thickness)
  // =========================================================================
  const spinePts = [
    new THREE.Vector3( 0.015, 0.258,  0.190), // 0: upper neck inside head
    new THREE.Vector3( 0.008, 0.205,  0.162), // 1: graceful arched neck
    new THREE.Vector3(-0.042, 0.128,  0.118), // 2: chest / shoulders
    new THREE.Vector3(-0.115, 0.092,  0.032), // 3: front-right low sweep
    new THREE.Vector3(-0.028, 0.132, -0.062), // 4: mid-back gentle crest
    new THREE.Vector3( 0.105, 0.096, -0.118), // 5: rear-left low sweep (hips)
    new THREE.Vector3( 0.145, 0.134, -0.212), // 6: tail rise
    new THREE.Vector3( 0.058, 0.198, -0.242), // 7: tail upward curl
    new THREE.Vector3(-0.015, 0.238, -0.202)  // 8: tail tip inward flourish
  ];
  const spineCurve = new THREE.CatmullRomCurve3(spinePts, false, 'centripetal', 0.5);

  function bodyRadius(u) {
    if (u < 0.05) return lerp(0.021, 0.025, u / 0.05);
    if (u < 0.22) return lerp(0.025, 0.036, smoothstep(0.05, 0.22, u));
    if (u < 0.56) return lerp(0.036, 0.034, (u - 0.22) / 0.34);
    if (u < 0.72) return lerp(0.034, 0.028, (u - 0.56) / 0.16);
    if (u < 0.94) return lerp(0.028, 0.012, smoothstep(0.72, 0.94, u));
    return lerp(0.012, 0.003, (u - 0.94) / 0.06);
  }

  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'body';
  root.add(bodyGroup);

  const bodyGeo = createTaperedTube(THREE, spineCurve, {
    segments: 96,
    radialSegments: 26,
    radiusFn: (u) => bodyRadius(u),
    shapeFn: (rx, ry) => {
      // Gently flatten underside for belly plates, subtle dorsal arch
      const yFlat = ry < 0 ? ry * 0.84 : ry * 1.04;
      const xWide = rx * (ry < 0 ? 1.03 : 0.98);
      return [xWide, yFlat];
    },
    vRepeat: 1.0,
    capStart: true,
    capEnd: true
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyScaleMat);
  bodyMesh.userData.slot = 'fur';
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyGroup.add(bodyMesh);

  // =========================================================================
  // 2. OVERLAPPING CURVED BELLY PLATES (ExtrudeGeometry bent to hug belly)
  // =========================================================================
  const bellyShape = new THREE.Shape();
  bellyShape.moveTo(-0.5, -0.35);
  bellyShape.bezierCurveTo(-0.56, 0.05, -0.42, 0.48, 0.0, 0.52);
  bellyShape.bezierCurveTo(0.42, 0.48, 0.56, 0.05, 0.5, -0.35);
  bellyShape.bezierCurveTo(0.22, -0.48, -0.22, -0.48, -0.5, -0.35);

  const baseBellyPlateGeo = createBentExtrusion(
    THREE,
    bellyShape,
    { depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 8 },
    (x, y, z, _nx, _ny, out) => {
      // Cup sideways around the dragon's rounded lower belly + gentle longitudinal curl
      const cupZ = z + (x * x) * 0.72 + (y * y) * 0.10;
      out[0] = x;
      out[1] = y;
      out[2] = cupZ;
    }
  );

  const bellyItems = [];
  const bellyCount = 34;
  const mTmp = new THREE.Matrix4();
  const basisMat = new THREE.Matrix4();
  const qTilt = new THREE.Quaternion();
  const eulerTilt = new THREE.Euler();

  for (let i = 0; i < bellyCount; i++) {
    const s = lerp(0.06, 0.92, i / (bellyCount - 1));
    const { pt, tangent, side, up } = curveFrame(THREE, spineCurve, s);
    const r = bodyRadius(s);
    const g = baseBellyPlateGeo.clone();

    // Scale plate to match local body circumference & overlap cleanly
    const plateW = r * 1.72;
    const plateL = lerp(0.036, 0.017, s);
    const plateT = r * 0.24;
    g.scale(plateW, plateL, plateT);

    // Orient plate: local X = side, local Y = tangent (along body), local Z = up (cupping upward around body)
    basisMat.makeBasis(side, tangent, up);
    // Slight shingle overlap pitch
    eulerTilt.set(0.20, 0, 0);
    qTilt.setFromEuler(eulerTilt);
    mTmp.makeRotationFromQuaternion(qTilt);
    basisMat.multiply(mTmp);

    const pos = pt.clone().addScaledVector(up, -r * 0.85);
    basisMat.setPosition(pos);
    g.applyMatrix4(basisMat);
    bellyItems.push({ geo: g, s });
  }
  baseBellyPlateGeo.dispose();

  const bellyMergedGeo = mergeGeometriesWithS(THREE, bellyItems);
  for (let i = 0; i < bellyItems.length; i++) bellyItems[i].geo.dispose();
  const bellyMesh = new THREE.Mesh(bellyMergedGeo, bellyMat);
  bellyMesh.userData.slot = 'furAccent';
  bellyMesh.castShadow = true;
  bellyMesh.receiveShadow = true;
  bodyGroup.add(bellyMesh);

  // =========================================================================
  // 3. DORSAL RIDGE OF SMALL SCULPTED FINS (ExtrudeGeometry bent with wave)
  // =========================================================================
  const finShape = new THREE.Shape();
  finShape.moveTo(-0.32, 0.0);
  finShape.bezierCurveTo(-0.18, 0.35, -0.05, 0.78, 0.34, 1.0);
  finShape.bezierCurveTo(0.28, 0.62, 0.42, 0.28, 0.40, 0.0);
  finShape.bezierCurveTo(0.15, -0.08, -0.15, -0.08, -0.32, 0.0);

  const baseFinGeo = createBentExtrusion(
    THREE,
    finShape,
    { depth: 0.12, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 2, curveSegments: 8 },
    (x, y, z, _nx, ny, out) => {
      // Gentle playful side ripple toward tip
      out[0] = x;
      out[1] = y;
      out[2] = z + Math.sin(ny * Math.PI) * 0.07;
    }
  );

  const dorsalItems = [];
  const finCount = 25;
  for (let i = 0; i < finCount; i++) {
    const tFin = i / (finCount - 1);
    const s = lerp(0.17, 0.94, tFin);
    const { pt, tangent, side, up } = curveFrame(THREE, spineCurve, s);
    const r = bodyRadius(s);
    const g = baseFinGeo.clone();

    const finH = (0.025 + 0.011 * Math.sin(tFin * Math.PI)) * lerp(1.0, 0.56, tFin);
    const finL = lerp(0.028, 0.014, tFin);
    const finT = lerp(0.0085, 0.0045, tFin);
    // Flip slight alternating wave on Z
    g.scale(finL, finH, (i & 1) ? finT : -finT);

    // Local X = tangent (sweeps back toward tail), local Y = up (dorsal), local Z = side
    basisMat.makeBasis(tangent, up, side);
    const pos = pt.clone().addScaledVector(up, r * 0.88);
    basisMat.setPosition(pos);
    g.applyMatrix4(basisMat);
    dorsalItems.push({ geo: g, s });
  }
  baseFinGeo.dispose();

  const dorsalMergedGeo = mergeGeometriesWithS(THREE, dorsalItems);
  for (let i = 0; i < dorsalItems.length; i++) dorsalItems[i].geo.dispose();
  const dorsalMesh = new THREE.Mesh(dorsalMergedGeo, finMat);
  dorsalMesh.userData.slot = 'furAccent';
  dorsalMesh.castShadow = true;
  dorsalMesh.receiveShadow = true;
  bodyGroup.add(dorsalMesh);

  // =========================================================================
  // 4. FLOWING NECK MANE ALONG THE NECK (curved extruded locks following spine)
  // =========================================================================
  function createManeLockGeometry(length, width, thick, curlX, curlZ) {
    const sh = new THREE.Shape();
    sh.moveTo(-width * 0.45, 0);
    sh.bezierCurveTo(-width * 0.62, length * 0.36, -width * 0.36, length * 0.78, 0, length);
    sh.bezierCurveTo(width * 0.38, length * 0.76, width * 0.60, length * 0.34, width * 0.45, 0);
    sh.bezierCurveTo(width * 0.2, -length * 0.06, -width * 0.2, -length * 0.06, -width * 0.45, 0);

    return createBentExtrusion(
      THREE,
      sh,
      {
        depth: thick,
        bevelEnabled: true,
        bevelThickness: thick * 0.32,
        bevelSize: Math.min(width * 0.14, thick * 0.35),
        bevelSegments: 2,
        curveSegments: 9
      },
      (x, y, z, _nx, ny, out) => {
        // Taper thickness near tip & bend gracefully in S-curve
        const tipTaper = 1.0 - 0.68 * ny * ny;
        const bx = x + Math.sin(ny * Math.PI * 0.9) * curlX;
        const bz = z * tipTaper + (ny * ny) * curlZ;
        out[0] = bx;
        out[1] = y;
        out[2] = bz;
      }
    );
  }

  const neckManeItems = [];
  const neckManeRings = 7;
  for (let i = 0; i < neckManeRings; i++) {
    const f = i / (neckManeRings - 1);
    const s = lerp(0.02, 0.175, f);
    const { pt, tangent, side, up } = curveFrame(THREE, spineCurve, s);
    const r = bodyRadius(s);
    const lockL = lerp(0.048, 0.036, f);
    const lockW = lerp(0.022, 0.017, f);

    // Central dorsal mane crest + left/right cascading neck locks
    const angles = [0, -0.68, 0.68];
    for (let aIdx = 0; aIdx < angles.length; aIdx++) {
      const ang = angles[aIdx];
      const g = createManeLockGeometry(
        lockL * (aIdx === 0 ? 1.12 : 0.95),
        lockW,
        0.0055,
        (aIdx === 1 ? -0.008 : aIdx === 2 ? 0.008 : 0.003 * Math.sin(i * 1.4)),
        -0.016
      );

      // Rotate lock to sweep backward along tangent and slightly outward
      const outDir = up.clone().multiplyScalar(Math.cos(ang)).addScaledVector(side, Math.sin(ang)).normalize();
      const lockDir = tangent.clone().multiplyScalar(0.86).addScaledVector(outDir, 0.50).normalize();
      const lockSide = new THREE.Vector3().crossVectors(outDir, lockDir).normalize();
      const lockNorm = new THREE.Vector3().crossVectors(lockDir, lockSide).normalize();

      basisMat.makeBasis(lockSide, lockDir, lockNorm);
      const pos = pt.clone().addScaledVector(outDir, r * 0.82);
      basisMat.setPosition(pos);
      g.applyMatrix4(basisMat);
      neckManeItems.push({ geo: g, s });
    }
  }
  const neckManeGeo = mergeGeometriesWithS(THREE, neckManeItems);
  for (let i = 0; i < neckManeItems.length; i++) neckManeItems[i].geo.dispose();
  const neckManeMesh = new THREE.Mesh(neckManeGeo, maneMat);
  neckManeMesh.userData.slot = 'furAccent';
  neckManeMesh.castShadow = true;
  neckManeMesh.receiveShadow = true;
  bodyGroup.add(neckManeMesh);

  // =========================================================================
  // 5. FAN-SHAPED TAIL TUFT (tail group at s=1.0)
  // =========================================================================
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tail';
  const tailFrame = curveFrame(THREE, spineCurve, 1.0);
  tailGroup.position.copy(tailFrame.pt);
  // Align tail group local +Y with continuing tail tangent, +Z with up, +X with side
  const tailBasis = new THREE.Matrix4().makeBasis(tailFrame.side, tailFrame.tangent, tailFrame.up);
  tailGroup.quaternion.setFromRotationMatrix(tailBasis);
  root.add(tailGroup);

  // Layered fan of 11 sculpted curved plumes
  const fanConfigs = [
    // Outer wide fan layer (7 plumes)
    { ang:  0.00, len: 0.098, wid: 0.025, zOff:  0.000, curlZ:  0.018, curlX:  0.000 },
    { ang: -0.26, len: 0.092, wid: 0.023, zOff: -0.002, curlZ:  0.015, curlX: -0.006 },
    { ang:  0.26, len: 0.092, wid: 0.023, zOff: -0.002, curlZ:  0.015, curlX:  0.006 },
    { ang: -0.52, len: 0.080, wid: 0.021, zOff: -0.004, curlZ:  0.011, curlX: -0.010 },
    { ang:  0.52, len: 0.080, wid: 0.021, zOff: -0.004, curlZ:  0.011, curlX:  0.010 },
    { ang: -0.78, len: 0.064, wid: 0.018, zOff: -0.006, curlZ:  0.008, curlX: -0.012 },
    { ang:  0.78, len: 0.064, wid: 0.018, zOff: -0.006, curlZ:  0.008, curlX:  0.012 },
    // Upper fuller fluff layer (4 plumes)
    { ang: -0.15, len: 0.072, wid: 0.021, zOff:  0.007, curlZ:  0.022, curlX: -0.004 },
    { ang:  0.15, len: 0.072, wid: 0.021, zOff:  0.007, curlZ:  0.022, curlX:  0.004 },
    { ang: -0.42, len: 0.058, wid: 0.018, zOff:  0.005, curlZ:  0.018, curlX: -0.007 },
    { ang:  0.42, len: 0.058, wid: 0.018, zOff:  0.005, curlZ:  0.018, curlX:  0.007 }
  ];

  const tailPlumeItems = [];
  for (let i = 0; i < fanConfigs.length; i++) {
    const fc = fanConfigs[i];
    const g = createManeLockGeometry(fc.len, fc.wid, 0.0055, fc.curlX, fc.curlZ);
    mTmp.makeRotationZ(fc.ang);
    g.applyMatrix4(mTmp);
    g.translate(0, -0.008, fc.zOff);
    tailPlumeItems.push({ geo: g, s: 1.0 });
  }
  const tailTuftGeo = mergeGeometriesWithS(THREE, tailPlumeItems);
  for (let i = 0; i < tailPlumeItems.length; i++) tailPlumeItems[i].geo.dispose();
  const tailTuftMesh = new THREE.Mesh(tailTuftGeo, maneMat);
  tailTuftMesh.userData.slot = 'furAccent';
  tailTuftMesh.castShadow = true;
  tailTuftMesh.receiveShadow = true;
  tailGroup.add(tailTuftMesh);

  // =========================================================================
  // 6. SOFTLY GLOWING PEARL (LatheGeometry >= 20 points, resting on y = 0)
  // =========================================================================
  const pearlRadius = 0.032;
  const pearlCenter = new THREE.Vector3(0.028, pearlRadius, 0.176);

  const pearlGroup = new THREE.Group();
  pearlGroup.name = 'pearl';
  pearlGroup.position.copy(pearlCenter);
  root.add(pearlGroup);

  function buildPearlLathe(rad, segsLathe) {
    const pts = [];
    const steps = 22;
    for (let i = 0; i <= steps; i++) {
      const th = (i / steps) * Math.PI;
      const r = Math.sin(th) * rad;
      const y = -Math.cos(th) * rad;
      pts.push(new THREE.Vector2(Math.max(0.0001, r), y));
    }
    return new THREE.LatheGeometry(pts, segsLathe);
  }

  const pearlCoreMesh = new THREE.Mesh(buildPearlLathe(pearlRadius * 0.84, 24), pearlCoreMat);
  pearlCoreMesh.userData.slot = 'glow';
  pearlGroup.add(pearlCoreMesh);

  const pearlShellMesh = new THREE.Mesh(buildPearlLathe(pearlRadius, 28), pearlShellMat);
  pearlShellMesh.userData.slot = 'glow';
  pearlShellMesh.castShadow = true;
  pearlShellMesh.receiveShadow = true;
  pearlGroup.add(pearlShellMesh);

  // =========================================================================
  // 7. FOUR SHORT LEGS WITH SMALL CLAWS + ELBOW CLOUD-FUR TUFTS
  // =========================================================================
  const clawGeoSmall = createCurvedClawGeometry(THREE, 0.0115, 0.0024, 0.72);
  const elbowTuftGeo = createManeLockGeometry(0.026, 0.014, 0.004, 0.003, -0.010);

  function buildLimb(name, sAttach, sideSign, worldPoints, pawOrientTarget, restOnPearl) {
    const group = new THREE.Group();
    group.name = name;
    const anchor = worldPoints[0].clone();
    group.position.copy(anchor);
    group.userData.spineS = sAttach;
    group.userData.basePos = anchor.clone();
    group.userData.sideSign = sideSign;
    group.userData.restOnPearl = !!restOnPearl;

    const localPts = worldPoints.map((p) => p.clone().sub(anchor));
    const limbCurve = new THREE.CatmullRomCurve3(localPts, false, 'centripetal', 0.5);

    const limbGeo = createTaperedTube(THREE, limbCurve, {
      segments: 26,
      radialSegments: 14,
      radiusFn: (u) => {
        if (u < 0.16) return lerp(0.024, 0.0165, u / 0.16); // flared shoulder/hip embedded deep in body
        if (u < 0.76) return lerp(0.0165, 0.0125, (u - 0.16) / 0.60);
        if (u < 0.92) return lerp(0.0125, 0.0155, smoothstep(0.76, 0.92, u)); // plump cute paw
        return lerp(0.0155, 0.005, (u - 0.92) / 0.08);
      },
      capStart: true,
      capEnd: true,
      vRepeat: 0.7
    });
    const limbMesh = new THREE.Mesh(limbGeo, bodyScaleMat);
    limbMesh.userData.slot = 'fur';
    limbMesh.castShadow = true;
    limbMesh.receiveShadow = true;
    group.add(limbMesh);

    // Cute elbow/ankle cloud-fur tuft (2 layered locks)
    const elbowFrame = curveFrame(THREE, limbCurve, 0.48);
    const tuft1 = new THREE.Mesh(elbowTuftGeo, maneMat);
    tuft1.userData.slot = 'furAccent';
    tuft1.position.copy(elbowFrame.pt).add(new THREE.Vector3(sideSign * 0.006, 0.003, -0.008));
    tuft1.rotation.set(-0.75, sideSign * 0.45, sideSign * 0.3);
    group.add(tuft1);

    const tuft2 = new THREE.Mesh(elbowTuftGeo, maneMat);
    tuft2.userData.slot = 'furAccent';
    tuft2.scale.setScalar(0.8);
    tuft2.position.copy(elbowFrame.pt).add(new THREE.Vector3(sideSign * 0.005, -0.004, -0.009));
    tuft2.rotation.set(-0.98, sideSign * 0.35, sideSign * 0.42);
    group.add(tuft2);

    // Paw & 4 small claws
    const pawLocal = localPts[localPts.length - 1].clone();
    const pawGroup = new THREE.Group();
    pawGroup.position.copy(pawLocal);

    const fwd = pawOrientTarget.clone().sub(worldPoints[worldPoints.length - 1]).normalize();
    const upRef = new THREE.Vector3(0, 1, 0);
    if (Math.abs(fwd.dot(upRef)) > 0.92) upRef.set(0, 0, 1);
    const pRight = new THREE.Vector3().crossVectors(upRef, fwd).normalize();
    const pUp = new THREE.Vector3().crossVectors(fwd, pRight).normalize();
    const pMat = new THREE.Matrix4().makeBasis(pRight, pUp, fwd);
    pawGroup.quaternion.setFromRotationMatrix(pMat);

    // Sculpted plump paw pad overlapping wrist cleanly
    const padGeo = new THREE.SphereGeometry(0.0145, 16, 12);
    padGeo.scale(1.12, 0.72, 1.18);
    const padMesh = new THREE.Mesh(padGeo, bodyScaleMat);
    padMesh.userData.slot = 'fur';
    padMesh.castShadow = true;
    pawGroup.add(padMesh);

    // 4 cute toes with curved glossy claws
    const toeAngles = [-0.58, -0.18, 0.22, 0.62];
    for (let tIdx = 0; tIdx < toeAngles.length; tIdx++) {
      const ang = toeAngles[tIdx];
      const toeHolder = new THREE.Group();
      toeHolder.rotation.y = ang;
      toeHolder.rotation.x = restOnPearl ? 0.36 : 0.16;

      const toeGeo = new THREE.SphereGeometry(0.0046, 10, 8);
      toeGeo.scale(0.85, 0.75, 1.55);
      const toeMesh = new THREE.Mesh(toeGeo, bodyScaleMat);
      toeMesh.userData.slot = 'fur';
      toeMesh.position.set(0, -0.001, 0.0135);
      toeHolder.add(toeMesh);

      const clawMesh = new THREE.Mesh(clawGeoSmall, clawMat);
      clawMesh.userData.slot = 'furAccent';
      clawMesh.position.set(0, -0.0005, 0.0175);
      clawMesh.castShadow = true;
      toeHolder.add(clawMesh);

      pawGroup.add(toeHolder);
    }

    group.add(pawGroup);
    root.add(group);
    return group;
  }

  // Front Left Leg (armL): paw rests lovingly right on top of the glowing pearl!
  const armLAnchor = spineCurve.getPointAt(0.205);
  const armL = buildLimb(
    'armL',
    0.205,
    1,
    [
      armLAnchor.clone().add(new THREE.Vector3(0.004, -0.004, 0.004)),
      armLAnchor.clone().add(new THREE.Vector3(0.032, -0.028, 0.022)),
      new THREE.Vector3(0.036, 0.092, 0.152),
      new THREE.Vector3(0.022, 0.068, 0.166) // resting on upper curvature of pearl
    ],
    new THREE.Vector3(0.044, 0.042, 0.208),
    true
  );

  // Front Right Leg (armR): playfully raised & tucked near chest for charming asymmetry
  const armRAnchor = spineCurve.getPointAt(0.235);
  const armR = buildLimb(
    'armR',
    0.235,
    -1,
    [
      armRAnchor.clone().add(new THREE.Vector3(-0.005, -0.004, 0.002)),
      armRAnchor.clone().add(new THREE.Vector3(-0.044, -0.026, 0.018)),
      armRAnchor.clone().add(new THREE.Vector3(-0.056, -0.044, 0.046)),
      armRAnchor.clone().add(new THREE.Vector3(-0.042, -0.036, 0.072))
    ],
    armRAnchor.clone().add(new THREE.Vector3(-0.048, -0.054, 0.125)),
    false
  );

  // Hind Left Leg (legL): short hovering hind leg on outer-front side of hip curve
  const legLAnchor = spineCurve.getPointAt(0.625);
  const legL = buildLimb(
    'legL',
    0.625,
    1,
    [
      legLAnchor.clone().add(new THREE.Vector3(0.004, -0.004, 0.005)),
      legLAnchor.clone().add(new THREE.Vector3(0.028, -0.024, 0.038)),
      legLAnchor.clone().add(new THREE.Vector3(0.018, -0.056, 0.030)),
      legLAnchor.clone().add(new THREE.Vector3(0.032, -0.070, 0.052))
    ],
    legLAnchor.clone().add(new THREE.Vector3(0.052, -0.084, 0.105)),
    false
  );

  // Hind Right Leg (legR): trailing gracefully on back side of hip curve
  const legRAnchor = spineCurve.getPointAt(0.645);
  const legR = buildLimb(
    'legR',
    0.645,
    -1,
    [
      legRAnchor.clone().add(new THREE.Vector3(-0.004, -0.004, -0.005)),
      legRAnchor.clone().add(new THREE.Vector3(-0.022, -0.024, -0.042)),
      legRAnchor.clone().add(new THREE.Vector3(-0.012, -0.054, -0.052)),
      legRAnchor.clone().add(new THREE.Vector3(-0.026, -0.064, -0.032))
    ],
    legRAnchor.clone().add(new THREE.Vector3(-0.042, -0.080, 0.020)),
    false
  );

  // =========================================================================
  // 8. NOBLE YET CUTE HEAD (Sculpted continuous 56x40 SphereGeometry)
  // =========================================================================
  const headGroup = new THREE.Group();
  headGroup.name = 'head';
  const headBasePos = new THREE.Vector3(0.018, 0.268, 0.200);
  headGroup.position.copy(headBasePos);
  headGroup.rotation.set(0.16, 0.15, -0.07);
  root.add(headGroup);

  const headGeo = new THREE.SphereGeometry(1, 56, 40);
  const hPos = headGeo.getAttribute('position');
  for (let i = 0; i < hPos.count; i++) {
    const ux = hPos.getX(i);
    const uy = hPos.getY(i);
    const uz = hPos.getZ(i);
    const p = sculptHeadPoint(ux, uy, uz);
    hPos.setXYZ(i, p[0], p[1], p[2]);
  }
  hPos.needsUpdate = true;
  headGeo.computeVertexNormals();

  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.userData.slot = 'fur';
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headGroup.add(headMesh);

  // Subtle sculpted dark nostrils sitting in the twin snout dimples
  for (const sgn of [-1, 1]) {
    const np = sculptHeadPoint(sgn * 0.26, 0.08, 0.94);
    const nostrilMesh = new THREE.Mesh(new THREE.SphereGeometry(0.0030, 10, 8), mouthMat);
    nostrilMesh.scale.set(0.75, 0.55, 0.45);
    nostrilMesh.position.set(np[0] * 0.99, np[1], np[2] * 0.99);
    nostrilMesh.rotation.y = sgn * 0.35;
    nostrilMesh.userData.slot = 'skin';
    headGroup.add(nostrilMesh);
  }

  // Friendly curved smiling mouth line (thin tapered tube hugging snout underside)
  const smileCurvePts = [];
  const smileSamples = [
    [-0.56, -0.22, 0.62],
    [-0.36, -0.32, 0.82],
    [-0.14, -0.26, 0.94],
    [ 0.00, -0.22, 0.96],
    [ 0.14, -0.26, 0.94],
    [ 0.36, -0.32, 0.82],
    [ 0.56, -0.22, 0.62]
  ];
  for (let i = 0; i < smileSamples.length; i++) {
    const sp = smileSamples[i];
    const len = Math.hypot(sp[0], sp[1], sp[2]);
    const p = sculptHeadPoint(sp[0] / len, sp[1] / len, sp[2] / len);
    smileCurvePts.push(new THREE.Vector3(p[0] * 1.005, p[1] * 1.005, p[2] * 1.005));
  }
  const smileCurve = new THREE.CatmullRomCurve3(smileCurvePts);
  const smileGeo = createTaperedTube(THREE, smileCurve, {
    segments: 24,
    radialSegments: 8,
    radiusFn: (u) => 0.0017 * (0.45 + 0.55 * Math.sin(u * Math.PI)),
    capStart: true,
    capEnd: true
  });
  const smileMesh = new THREE.Mesh(smileGeo, mouthMat);
  smileMesh.userData.slot = 'skin';
  headGroup.add(smileMesh);

  // =========================================================================
  // 9. LARGE 3-LAYER EXPRESSIVE EYES (inset in sockets, grouped for blink)
  // =========================================================================
  function buildEye(name, sideSign) {
    const eyeGroup = new THREE.Group();
    eyeGroup.name = name;

    // Place snugly inset at the sculpted eye socket
    const dir = new THREE.Vector3(sideSign * 0.60, 0.14, 0.46).normalize();
    const surf = sculptHeadPoint(dir.x, dir.y, dir.z);
    eyeGroup.position.set(surf[0] - sideSign * 0.0045, surf[1] + 0.0005, surf[2] - 0.0025);
    eyeGroup.rotation.set(-0.08, sideSign * 0.66, sideSign * 0.05);

    // Layer 1: Dark glossy outer eyeball with clearcoat
    const scleraGeo = new THREE.SphereGeometry(0.0128, 22, 18);
    scleraGeo.scale(1.02, 1.08, 0.68);
    const scleraMesh = new THREE.Mesh(scleraGeo, eyeBaseMat);
    scleraMesh.userData.slot = 'eye';
    eyeGroup.add(scleraMesh);

    // Layer 2: Coloured iris ring/disc with radial detail texture
    const irisGeo = new THREE.SphereGeometry(0.0114, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.52);
    irisGeo.rotateX(Math.PI * 0.5);
    irisGeo.scale(0.98, 1.04, 0.42);
    const irisMesh = new THREE.Mesh(irisGeo, irisMat);
    irisMesh.position.set(0, 0, 0.0052);
    irisMesh.userData.slot = 'eye';
    eyeGroup.add(irisMesh);

    // Layer 3: Two crisp white catchlight dots placed up and to one side
    const hiMain = new THREE.Mesh(new THREE.SphereGeometry(0.0031, 12, 10), catchlightMat);
    hiMain.scale.set(1.0, 1.15, 0.45);
    hiMain.position.set(-0.0032, 0.0044, 0.0096);
    eyeGroup.add(hiMain);

    const hiSub = new THREE.Mesh(new THREE.SphereGeometry(0.0014, 10, 8), catchlightMat);
    hiSub.scale.set(1.0, 1.0, 0.45);
    hiSub.position.set(0.0034, -0.0036, 0.0094);
    eyeGroup.add(hiSub);

    headGroup.add(eyeGroup);
    return eyeGroup;
  }

  const eyeL = buildEye('eyeL', 1);
  const eyeR = buildEye('eyeR', -1);

  // Cute sculpted fuzzy eyebrows arching softly above eyes
  for (const sgn of [-1, 1]) {
    const browPts = [
      new THREE.Vector3(sgn * 0.016, 0.025, 0.044),
      new THREE.Vector3(sgn * 0.028, 0.029, 0.036),
      new THREE.Vector3(sgn * 0.038, 0.025, 0.020)
    ];
    const browCurve = new THREE.CatmullRomCurve3(browPts);
    const browGeo = createTaperedTube(THREE, browCurve, {
      segments: 14,
      radialSegments: 8,
      radiusFn: (u) => 0.0046 * Math.sin(clamp(u, 0.05, 0.95) * Math.PI),
      capStart: true,
      capEnd: true
    });
    const browMesh = new THREE.Mesh(browGeo, maneMat);
    browMesh.userData.slot = 'furAccent';
    headGroup.add(browMesh);
  }

  // Subtle curved blush discs sitting flush on cheeks
  for (const sgn of [-1, 1]) {
    const bGeo = new THREE.CircleGeometry(0.0115, 16);
    const bPos = bGeo.getAttribute('position');
    for (let i = 0; i < bPos.count; i++) {
      const bx = bPos.getX(i);
      const by = bPos.getY(i);
      bPos.setZ(i, -(bx * bx + by * by) * 10.0);
    }
    bPos.needsUpdate = true;
    bGeo.computeVertexNormals();

    const dir = new THREE.Vector3(sgn * 0.68, -0.14, 0.56).normalize();
    const surf = sculptHeadPoint(dir.x, dir.y, dir.z);
    const blush = new THREE.Mesh(bGeo, blushMat);
    blush.position.set(surf[0] + sgn * 0.0012, surf[1], surf[2] + 0.0015);
    blush.rotation.set(0.12, sgn * 0.72, 0);
    blush.userData.slot = 'skin';
    headGroup.add(blush);
  }

  // =========================================================================
  // 10. SWEPT CURVED DRAGON EARS (earL, earR) with soft inner ear layer
  // =========================================================================
  const earOuterShape = new THREE.Shape();
  earOuterShape.moveTo(0.0, 0.0);
  earOuterShape.bezierCurveTo(-0.016, 0.010, -0.019, 0.036, 0.0, 0.056);
  earOuterShape.bezierCurveTo(0.018, 0.036, 0.016, 0.010, 0.0, 0.0);

  const earOuterGeo = createBentExtrusion(
    THREE,
    earOuterShape,
    { depth: 0.0045, bevelEnabled: true, bevelThickness: 0.0016, bevelSize: 0.0014, bevelSegments: 2, curveSegments: 12 },
    (x, y, z, _nx, ny, out) => {
      // Cup ear forward and sweep tip gently backward
      const cup = (x * x) * 18.0;
      const sweep = -ny * ny * 0.012;
      out[0] = x;
      out[1] = y;
      out[2] = z + cup + sweep;
    }
  );

  const earInnerShape = new THREE.Shape();
  earInnerShape.moveTo(0.0, 0.006);
  earInnerShape.bezierCurveTo(-0.0095, 0.014, -0.011, 0.032, 0.0, 0.044);
  earInnerShape.bezierCurveTo(0.011, 0.032, 0.0095, 0.014, 0.0, 0.006);

  const earInnerGeo = createBentExtrusion(
    THREE,
    earInnerShape,
    { depth: 0.0022, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0007, bevelSegments: 2, curveSegments: 10 },
    (x, y, z, _nx, ny, out) => {
      const cup = (x * x) * 18.0;
      const sweep = -ny * ny * 0.012;
      out[0] = x;
      out[1] = y;
      out[2] = z + cup + sweep + 0.0024;
    }
  );

  function buildEar(name, sideSign) {
    const earGroup = new THREE.Group();
    earGroup.name = name;
    earGroup.position.set(sideSign * 0.031, 0.016, -0.014);
    earGroup.rotation.set(-0.72, sideSign * 0.42, -sideSign * 0.78);
    earGroup.userData.baseRot = earGroup.rotation.clone();

    const outer = new THREE.Mesh(earOuterGeo, headMat);
    outer.userData.slot = 'fur';
    outer.castShadow = true;
    earGroup.add(outer);

    const inner = new THREE.Mesh(earInnerGeo, innerEarMat);
    inner.userData.slot = 'skin';
    earGroup.add(inner);

    headGroup.add(earGroup);
    return earGroup;
  }

  const earL = buildEar('earL', 1);
  const earR = buildEar('earR', -1);

  // =========================================================================
  // 11. BRANCHING ANTLERS (horn group) + LatheGeometry Coronet Burrs
  // =========================================================================
  const hornGroup = new THREE.Group();
  hornGroup.name = 'horn';
  headGroup.add(hornGroup);

  // Ornate antler-base coronet burr via 20-point LatheGeometry
  const burrPts = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const wave = 0.0012 * Math.sin(t * Math.PI * 4);
    const r = lerp(0.0092, 0.0068, t) + Math.sin(t * Math.PI) * 0.0022 + wave * 0.45;
    burrPts.push(new THREE.Vector2(Math.max(0.001, r), t * 0.010));
  }
  const burrGeo = new THREE.LatheGeometry(burrPts, 18);

  for (const sgn of [-1, 1]) {
    const antlerSide = new THREE.Group();
    const basePos = new THREE.Vector3(sgn * 0.020, 0.029, -0.012);

    const burr = new THREE.Mesh(burrGeo, antlerMat);
    burr.position.copy(basePos);
    burr.rotation.set(-0.68, 0, -sgn * 0.36);
    burr.userData.slot = 'furAccent';
    antlerSide.add(burr);

    // Main sweeping antler beam
    const beamCurve = new THREE.CatmullRomCurve3([
      basePos.clone().add(new THREE.Vector3(0, -0.004, 0.002)),
      basePos.clone().add(new THREE.Vector3(sgn * 0.014, 0.026, -0.024)),
      basePos.clone().add(new THREE.Vector3(sgn * 0.034, 0.056, -0.056)),
      basePos.clone().add(new THREE.Vector3(sgn * 0.044, 0.088, -0.072))
    ]);
    const beamGeo = createTaperedTube(THREE, beamCurve, {
      segments: 22,
      radialSegments: 10,
      radiusFn: (u) => lerp(0.0062, 0.0016, Math.pow(u, 0.85)),
      capStart: true,
      capEnd: true
    });
    const beamMesh = new THREE.Mesh(beamGeo, antlerMat);
    beamMesh.userData.slot = 'furAccent';
    beamMesh.castShadow = true;
    antlerSide.add(beamMesh);

    // Lower forward-upward brow tine
    const tine1Root = beamCurve.getPointAt(0.36);
    const tine1Curve = new THREE.CatmullRomCurve3([
      tine1Root.clone(),
      tine1Root.clone().add(new THREE.Vector3(sgn * 0.010, 0.018, 0.012)),
      tine1Root.clone().add(new THREE.Vector3(sgn * 0.014, 0.036, 0.014))
    ]);
    const tine1Geo = createTaperedTube(THREE, tine1Curve, {
      segments: 14,
      radialSegments: 8,
      radiusFn: (u) => lerp(0.0040, 0.0012, u),
      capStart: true,
      capEnd: true
    });
    const tine1Mesh = new THREE.Mesh(tine1Geo, antlerMat);
    tine1Mesh.userData.slot = 'furAccent';
    tine1Mesh.castShadow = true;
    antlerSide.add(tine1Mesh);

    // Upper back-outward tine
    const tine2Root = beamCurve.getPointAt(0.68);
    const tine2Curve = new THREE.CatmullRomCurve3([
      tine2Root.clone(),
      tine2Root.clone().add(new THREE.Vector3(sgn * 0.016, 0.010, -0.014)),
      tine2Root.clone().add(new THREE.Vector3(sgn * 0.025, 0.028, -0.022))
    ]);
    const tine2Geo = createTaperedTube(THREE, tine2Curve, {
      segments: 14,
      radialSegments: 8,
      radiusFn: (u) => lerp(0.0032, 0.0010, u),
      capStart: true,
      capEnd: true
    });
    const tine2Mesh = new THREE.Mesh(tine2Geo, antlerMat);
    tine2Mesh.userData.slot = 'furAccent';
    tine2Mesh.castShadow = true;
    antlerSide.add(tine2Mesh);

    hornGroup.add(antlerSide);
  }

  // =========================================================================
  // 12. HEAD MANE RUFF & CUTE CHIN BEARD LOCKS (framing face & neck seam)
  // =========================================================================
  const headManeSpecs = [
    // Crown mane locks behind antlers
    { pos: [ 0.000, 0.028, -0.028], rot: [-1.15,  0.00,  0.00], len: 0.056, wid: 0.024, cx:  0.000, cz: -0.018 },
    { pos: [ 0.018, 0.022, -0.026], rot: [-1.10,  0.32, -0.35], len: 0.052, wid: 0.022, cx:  0.006, cz: -0.016 },
    { pos: [-0.018, 0.022, -0.026], rot: [-1.10, -0.32,  0.35], len: 0.052, wid: 0.022, cx: -0.006, cz: -0.016 },
    // Cheek ruff tufts framing cute cheeks
    { pos: [ 0.036, -0.004,  0.004], rot: [-1.32,  0.72, -0.82], len: 0.044, wid: 0.020, cx:  0.007, cz: -0.014 },
    { pos: [-0.036, -0.004,  0.004], rot: [-1.32, -0.72,  0.82], len: 0.044, wid: 0.020, cx: -0.007, cz: -0.014 },
    { pos: [ 0.034, -0.014, -0.010], rot: [-1.42,  0.55, -0.95], len: 0.046, wid: 0.021, cx:  0.006, cz: -0.015 },
    { pos: [-0.034, -0.014, -0.010], rot: [-1.42, -0.55,  0.95], len: 0.046, wid: 0.021, cx: -0.006, cz: -0.015 },
    // Cute wispy dragon chin beard
    { pos: [ 0.000, -0.025,  0.026], rot: [-2.42,  0.00,  0.00], len: 0.034, wid: 0.018, cx:  0.000, cz:  0.012 },
    { pos: [ 0.012, -0.024,  0.018], rot: [-2.35,  0.28, -0.25], len: 0.030, wid: 0.015, cx:  0.004, cz:  0.010 },
    { pos: [-0.012, -0.024,  0.018], rot: [-2.35, -0.28,  0.25], len: 0.030, wid: 0.015, cx: -0.004, cz:  0.010 }
  ];

  const headManeItems = [];
  const eHead = new THREE.Euler();
  for (let i = 0; i < headManeSpecs.length; i++) {
    const sp = headManeSpecs[i];
    const g = createManeLockGeometry(sp.len, sp.wid, 0.0052, sp.cx, sp.cz);
    eHead.set(sp.rot[0], sp.rot[1], sp.rot[2]);
    mTmp.makeRotationFromEuler(eHead);
    mTmp.setPosition(sp.pos[0], sp.pos[1], sp.pos[2]);
    g.applyMatrix4(mTmp);
    headManeItems.push({ geo: g, s: 0 });
  }
  const headManeGeo = mergeGeometriesWithS(THREE, headManeItems);
  for (let i = 0; i < headManeItems.length; i++) headManeItems[i].geo.dispose();
  const headManeMesh = new THREE.Mesh(headManeGeo, maneMat);
  headManeMesh.userData.slot = 'furAccent';
  headManeMesh.castShadow = true;
  headGroup.add(headManeMesh);

  // =========================================================================
  // 13. TWO LONG TRAILING WHISKERS (tapered tubes animated with a smooth wave)
  // =========================================================================
  function buildWhisker(name, sideSign) {
    const rootPt = sculptHeadPoint(sideSign * 0.44, -0.08, 0.85);
    const whiskerCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(rootPt[0] * 0.94, rootPt[1], rootPt[2] * 0.96),
      new THREE.Vector3(sideSign * 0.056, -0.012, 0.072),
      new THREE.Vector3(sideSign * 0.105, -0.028, 0.028),
      new THREE.Vector3(sideSign * 0.132, -0.008, -0.026),
      new THREE.Vector3(sideSign * 0.158, -0.024, -0.078),
      new THREE.Vector3(sideSign * 0.146, -0.004, -0.108)
    ]);

    const wGeo = createTaperedTube(THREE, whiskerCurve, {
      segments: 42,
      radialSegments: 8,
      radiusFn: (u) => lerp(0.0028, 0.0006, Math.pow(u, 0.72)),
      capStart: true,
      capEnd: true
    });

    const wMesh = new THREE.Mesh(wGeo, whiskerMat);
    wMesh.name = name;
    wMesh.userData.slot = 'furAccent';
    wMesh.castShadow = true;
    headGroup.add(wMesh);
    return {
      mesh: wMesh,
      sideSign,
      basePos: new Float32Array(wGeo.getAttribute('position').array),
      vertU: wGeo.userData.vertU
    };
  }

  const whiskerL = buildWhisker('whiskerL', 1);
  const whiskerR = buildWhisker('whiskerR', -1);

  // =========================================================================
  // 14. STORE ANIMATION DATA FOR IDLE()
  // =========================================================================
  const waveMeshes = [bodyMesh, bellyMesh, dorsalMesh, neckManeMesh].map((m) => ({
    mesh: m,
    basePos: new Float32Array(m.geometry.getAttribute('position').array),
    vertS: m.geometry.userData.vertU || m.geometry.userData.vertS
  }));

  root.userData.anim = {
    head: headGroup,
    headBasePos: headBasePos.clone(),
    headBaseRot: headGroup.rotation.clone(),
    tail: tailGroup,
    tailBasePos: tailGroup.position.clone(),
    tailBaseQuat: tailGroup.quaternion.clone(),
    earL,
    earR,
    eyeL,
    eyeR,
    armL,
    armR,
    legL,
    legR,
    whiskers: [whiskerL, whiskerR],
    waveMeshes,
    pearlCoreMat,
    pearlShellMat,
    tmpQuat: new THREE.Quaternion(),
    tmpEuler: new THREE.Euler()
  };

  return root;
}

export function idle(group, t) {
  const anim = group && group.userData && group.userData.anim;
  if (!anim) return;

  const off = [0, 0, 0];

  // 1. Slow traveling wave along serpentine body, belly plates, dorsal ridge, and neck mane
  for (let m = 0; m < anim.waveMeshes.length; m++) {
    const entry = anim.waveMeshes[m];
    const posAttr = entry.mesh.geometry.getAttribute('position');
    const arr = posAttr.array;
    const base = entry.basePos;
    const vs = entry.vertS;
    const count = posAttr.count;

    for (let i = 0; i < count; i++) {
      spineWaveOffset(vs[i], t, off);
      const j = i * 3;
      arr[j] = base[j] + off[0];
      arr[j + 1] = base[j + 1] + off[1];
      arr[j + 2] = base[j + 2] + off[2];
    }
    posAttr.needsUpdate = true;
  }

  // 2. Head follows neck wave + gentle friendly sway & breathing nod
  spineWaveOffset(0.0, t, off);
  anim.head.position.set(
    anim.headBasePos.x + off[0],
    anim.headBasePos.y + off[1],
    anim.headBasePos.z + off[2]
  );
  anim.head.rotation.set(
    anim.headBaseRot.x + Math.sin(t * 1.45) * 0.045,
    anim.headBaseRot.y + Math.sin(t * 0.85) * 0.075,
    anim.headBaseRot.z + Math.cos(t * 1.05) * 0.042
  );

  // 3. Tail tuft rides tail-tip wave + graceful fan sway
  spineWaveOffset(1.0, t, off);
  anim.tail.position.set(
    anim.tailBasePos.x + off[0],
    anim.tailBasePos.y + off[1],
    anim.tailBasePos.z + off[2]
  );
  anim.tmpEuler.set(
    Math.sin(t * 1.85 - 5.2) * 0.10,
    Math.cos(t * 1.45 - 4.0) * 0.14,
    Math.sin(t * 1.85 - 4.6) * 0.16
  );
  anim.tmpQuat.setFromEuler(anim.tmpEuler);
  anim.tail.quaternion.copy(anim.tailBaseQuat).multiply(anim.tmpQuat);

  // 4. Slow trailing wave along both long whiskers
  for (let w = 0; w < anim.whiskers.length; w++) {
    const wh = anim.whiskers[w];
    const posAttr = wh.mesh.geometry.getAttribute('position');
    const arr = posAttr.array;
    const base = wh.basePos;
    const vu = wh.vertU;
    const phaseOff = wh.sideSign > 0 ? 0.0 : 1.1;
    const count = posAttr.count;

    for (let i = 0; i < count; i++) {
      const u = vu[i];
      const env = u * u;
      const ph = t * 2.35 - u * 4.8 + phaseOff;
      const j = i * 3;
      arr[j] = base[j] + Math.sin(ph * 0.85) * 0.0085 * env;
      arr[j + 1] = base[j + 1] + Math.sin(ph) * 0.0145 * env;
      arr[j + 2] = base[j + 2] + Math.cos(ph * 0.9) * 0.0075 * env;
    }
    posAttr.needsUpdate = true;
  }

  // 5. Limbs ride body wave; armL gently stays steadied on pearl while others softly hover
  const limbs = [anim.armL, anim.armR, anim.legL, anim.legR];
  for (let k = 0; k < limbs.length; k++) {
    const lb = limbs[k];
    const s = lb.userData.spineS;
    const bp = lb.userData.basePos;
    spineWaveOffset(s, t, off);
    if (lb.userData.restOnPearl) {
      // Dampen paw motion so claws rest securely on the pearl
      lb.position.set(bp.x + off[0] * 0.35, bp.y + off[1] * 0.35, bp.z + off[2] * 0.35);
      lb.rotation.x = Math.sin(t * 1.9) * 0.015;
    } else {
      lb.position.set(bp.x + off[0], bp.y + off[1], bp.z + off[2]);
      const p = t * 1.65 - s * 4.0 + lb.userData.sideSign * 0.6;
      lb.rotation.x = Math.sin(p) * 0.065;
      lb.rotation.z = Math.cos(p * 0.85) * 0.045;
    }
  }

  // 6. Ears gentle sway & occasional cute twitch
  const earCycle = t % 5.2;
  const twitch = earCycle > 4.65 && earCycle < 4.95
    ? Math.sin(((earCycle - 4.65) / 0.30) * Math.PI * 2) * 0.09
    : 0;
  const earSway = Math.sin(t * 1.3) * 0.04;
  anim.earL.rotation.z = anim.earL.userData.baseRot.z + earSway + twitch;
  anim.earR.rotation.z = anim.earR.userData.baseRot.z - earSway - twitch * 0.5;

  // 7. Friendly eye blink every ~3.8 seconds (scaling eye groups on y)
  const blinkCycle = t % 3.8;
  let eyeScaleY = 1.0;
  if (blinkCycle > 3.56 && blinkCycle < 3.74) {
    const b = Math.sin(((blinkCycle - 3.56) / 0.18) * Math.PI);
    eyeScaleY = 1.0 - 0.92 * b;
  }
  anim.eyeL.scale.y = eyeScaleY;
  anim.eyeR.scale.y = eyeScaleY;

  // 8. Soft magical pulse on the glowing pearl
  const glowPulse = 0.5 + 0.5 * Math.sin(t * 1.75);
  anim.pearlCoreMat.emissiveIntensity = 1.38 + glowPulse * 0.34;
  anim.pearlShellMat.emissiveIntensity = 0.34 + glowPulse * 0.16;
}
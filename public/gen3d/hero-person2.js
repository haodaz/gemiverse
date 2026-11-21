```js
export const META = {
  id: 'dorm-student',
  name: 'Dorm Student',
  kind: 'character',
  footprint: [0.46, 0.38],
  variants: {
    hairStyle: [
      'short', 'bob', 'longStraight', 'longWavy', 'curly',
      'ponytail', 'bun', 'pixie', 'sidePart', 'buzz',
    ],
    top: ['hoodie', 'tee', 'shirt', 'cardigan', 'sweater', 'blazer'],
    bottom: ['trousers', 'jeans', 'shorts', 'skirt', 'longSkirt'],
    shoes: ['sneakers', 'boots', 'loafers'],
    glasses: ['none', 'round', 'square'],
    bag: ['none', 'backpack', 'tote'],
    expression: ['awake', 'happy', 'asleep', 'thinking', 'unsure'],
    pose: ['stand', 'walk', 'sit', 'wave', 'think'],
  },
  note: 'Stylised 1.15m vinyl-figure dorm student with sculpted continuous anatomy, parametric clothes, 10 hairstyles, expressions, and poses.',
};

const DEFAULTS = {
  skin: '#f2c7a5',
  bodyWidth: 1.0,
  bodyHeight: 1.0,
  headSize: 1.0,
  hairStyle: 'bob',
  hairColor: '#3b2922',
  eye: '#476b8c',
  top: 'hoodie',
  topColor: '#c76d58',
  bottom: 'jeans',
  bottomColor: '#48607a',
  shoes: 'sneakers',
  shoeColor: '#d8d2c5',
  glasses: 'none',
  blush: true,
  freckles: false,
  bag: 'backpack',
  accent: '#e0a956',
};

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function gauss(d, s) {
  const k = d / s;
  return Math.exp(-k * k);
}

function toHex(THREE, val, fallback) {
  const c = new THREE.Color(val !== undefined && val !== null ? val : fallback);
  return '#' + c.getHexString();
}

function shiftColor(THREE, hex, lShift = 0, sShift = 0) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, clamp(hsl.s + sShift, 0, 1), clamp(hsl.l + lShift, 0, 1));
  return c;
}

function tagSlot(mesh, slot) {
  if (slot) mesh.userData.slot = slot;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ---------- Parametric Geometry Helpers ----------

function buildParametricGrid(THREE, rows, cols, evalPt, wrapU = true, capBottom = false, capTop = false) {
  const stride = cols + 1;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      const p = evalPt(u, v);
      positions.push(p[0], p[1], p[2]);
      uvs.push(u, v);
    }
  }

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = (j + 1) * stride + i + 1;
      const d = (j + 1) * stride + i;
      indices.push(a, b, c, a, c, d);
    }
  }

  if (capBottom && wrapU) {
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < cols; i++) {
      cx += positions[i * 3];
      cy += positions[i * 3 + 1];
      cz += positions[i * 3 + 2];
    }
    const centerIdx = positions.length / 3;
    positions.push(cx / cols, cy / cols, cz / cols);
    uvs.push(0.5, 0);
    for (let i = 0; i < cols; i++) {
      indices.push(centerIdx, i + 1, i);
    }
  }

  if (capTop && wrapU) {
    const rowStart = rows * stride;
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < cols; i++) {
      const idx = (rowStart + i) * 3;
      cx += positions[idx];
      cy += positions[idx + 1];
      cz += positions[idx + 2];
    }
    const centerIdx = positions.length / 3;
    positions.push(cx / cols, cy / cols, cz / cols);
    uvs.push(0.5, 1);
    for (let i = 0; i < cols; i++) {
      indices.push(centerIdx, rowStart + i, rowStart + i + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildThickShell(THREE, rows, cols, evalOuter, thickness, wrapU = true) {
  const stride = cols + 1;
  const outerPts = [];
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      outerPts.push(evalOuter(u, v));
    }
  }

  // Approximate vertex normals from grid neighbors for clean inward offset
  const innerPts = new Array(outerPts.length);
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const tU = new THREE.Vector3();
  const tV = new THREE.Vector3();
  const nrm = new THREE.Vector3();

  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const idx = j * stride + i;
      const iPrev = i > 0 ? i - 1 : (wrapU ? cols - 1 : 0);
      const iNext = i < cols ? i + 1 : (wrapU ? 1 : cols);
      const jPrev = Math.max(0, j - 1);
      const jNext = Math.min(rows, j + 1);
      const pL = outerPts[j * stride + iPrev];
      const pR = outerPts[j * stride + iNext];
      const pD = outerPts[jPrev * stride + i];
      const pU = outerPts[jNext * stride + i];
      tU.set(pR[0] - pL[0], pR[1] - pL[1], pR[2] - pL[2]);
      tV.set(pU[0] - pD[0], pU[1] - pD[1], pU[2] - pD[2]);
      nrm.crossVectors(tU, tV);
      if (nrm.lengthSq() < 1e-10) nrm.set(0, 0, 1);
      else nrm.normalize();
      const p = outerPts[idx];
      const th = typeof thickness === 'function' ? thickness(i / cols, j / rows) : thickness;
      innerPts[idx] = [p[0] - nrm.x * th, p[1] - nrm.y * th, p[2] - nrm.z * th];
    }
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const count = outerPts.length;

  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const p = outerPts[j * stride + i];
      positions.push(p[0], p[1], p[2]);
      uvs.push(i / cols, j / rows);
    }
  }
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const p = innerPts[j * stride + i];
      positions.push(p[0], p[1], p[2]);
      uvs.push(i / cols, j / rows);
    }
  }

  // Outer surface
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = (j + 1) * stride + i + 1;
      const d = (j + 1) * stride + i;
      indices.push(a, b, c, a, c, d);
    }
  }
  // Inner surface (flipped)
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = count + j * stride + i;
      const b = a + 1;
      const c = count + (j + 1) * stride + i + 1;
      const d = count + (j + 1) * stride + i;
      indices.push(a, c, b, a, d, c);
    }
  }
  // Stitch bottom rim
  for (let i = 0; i < cols; i++) {
    const o0 = i;
    const o1 = i + 1;
    const i0 = count + i;
    const i1 = count + i + 1;
    indices.push(o0, i0, i1, o0, i1, o1);
  }
  // Stitch top rim
  const topOff = rows * stride;
  for (let i = 0; i < cols; i++) {
    const o0 = topOff + i;
    const o1 = topOff + i + 1;
    const i0 = count + topOff + i;
    const i1 = count + topOff + i + 1;
    indices.push(o0, o1, i1, o0, i1, i0);
  }
  // Stitch open side seams if not wrapped
  if (!wrapU) {
    for (let j = 0; j < rows; j++) {
      const o0 = j * stride;
      const o1 = (j + 1) * stride;
      const i0 = count + o0;
      const i1 = count + o1;
      indices.push(o0, o1, i1, o0, i1, i0);
    }
    for (let j = 0; j < rows; j++) {
      const o0 = j * stride + cols;
      const o1 = (j + 1) * stride + cols;
      const i0 = count + o0;
      const i1 = count + o1;
      indices.push(o0, i0, i1, o0, i1, o1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function makeTaperedTube(THREE, curve, radialSegs, lengthSegs, radiusFn, options = {}) {
  const capStart = options.capStart !== undefined ? options.capStart : true;
  const capEnd = options.capEnd !== undefined ? options.capEnd : true;
  const initNormal = options.initNormal || null;
  const points = curve.getSpacedPoints(lengthSegs);
  const tangents = [];

  for (let i = 0; i <= lengthSegs; i++) {
    const pPrev = points[Math.max(0, i - 1)];
    const pNext = points[Math.min(lengthSegs, i + 1)];
    const t = new THREE.Vector3().subVectors(pNext, pPrev);
    if (t.lengthSq() < 1e-10) t.set(0, -1, 0);
    else t.normalize();
    tangents.push(t);
  }

  // Parallel-transport Bishop frames for twist-free limbs and locks
  const normals = [];
  const binormals = [];
  const t0 = tangents[0];
  let n0 = initNormal ? initNormal.clone() : new THREE.Vector3(1, 0, 0);
  if (Math.abs(n0.dot(t0)) > 0.92) n0.set(0, 0, 1);
  n0.addScaledVector(t0, -n0.dot(t0)).normalize();
  const b0 = new THREE.Vector3().crossVectors(t0, n0).normalize();
  // Ensure N x B = T
  n0.crossVectors(b0, t0).normalize();
  normals.push(n0);
  binormals.push(b0);

  const axis = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  for (let i = 1; i <= lengthSegs; i++) {
    const prevT = tangents[i - 1];
    const currT = tangents[i];
    const nPrev = normals[i - 1].clone();
    axis.crossVectors(prevT, currT);
    const sinA = axis.length();
    if (sinA > 1e-6) {
      axis.divideScalar(sinA);
      const angle = Math.acos(clamp(prevT.dot(currT), -1, 1));
      quat.setFromAxisAngle(axis, angle);
      nPrev.applyQuaternion(quat);
    }
    nPrev.addScaledVector(currT, -nPrev.dot(currT)).normalize();
    const bCurr = new THREE.Vector3().crossVectors(currT, nPrev).normalize();
    nPrev.crossVectors(bCurr, currT).normalize();
    normals.push(nPrev);
    binormals.push(bCurr);
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const stride = radialSegs + 1;

  for (let j = 0; j <= lengthSegs; j++) {
    const t = j / lengthSegs;
    const c = points[j];
    const N = normals[j];
    const B = binormals[j];
    for (let i = 0; i <= radialSegs; i++) {
      const u = i / radialSegs;
      const ang = u * Math.PI * 2;
      const rSpec = radiusFn(t, ang, u);
      let rx, ry, ox = 0, oy = 0;
      if (typeof rSpec === 'number') {
        rx = rSpec;
        ry = rSpec;
      } else {
        rx = rSpec[0];
        ry = rSpec[1];
        ox = rSpec[2] || 0;
        oy = rSpec[3] || 0;
      }
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const x = c.x + N.x * (ca * rx + ox) + B.x * (sa * ry + oy);
      const y = c.y + N.y * (ca * rx + ox) + B.y * (sa * ry + oy);
      const z = c.z + N.z * (ca * rx + ox) + B.z * (sa * ry + oy);
      positions.push(x, y, z);
      uvs.push(u, t);
    }
  }

  for (let j = 0; j < lengthSegs; j++) {
    for (let i = 0; i < radialSegs; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = (j + 1) * stride + i + 1;
      const d = (j + 1) * stride + i;
      indices.push(a, b, c, a, c, d);
    }
  }

  if (capStart) {
    const tipIdx = positions.length / 3;
    const p0 = points[0];
    const t0v = tangents[0];
    const r0 = radiusFn(0, 0, 0);
    const rr = typeof r0 === 'number' ? r0 : (r0[0] + r0[1]) * 0.5;
    positions.push(p0.x - t0v.x * rr * 0.35, p0.y - t0v.y * rr * 0.35, p0.z - t0v.z * rr * 0.35);
    uvs.push(0.5, 0);
    for (let i = 0; i < radialSegs; i++) {
      indices.push(tipIdx, i + 1, i);
    }
  }

  if (capEnd) {
    const tipIdx = positions.length / 3;
    const p1 = points[lengthSegs];
    const t1v = tangents[lengthSegs];
    const r1 = radiusFn(1, 0, 0);
    const rr = typeof r1 === 'number' ? r1 : (r1[0] + r1[1]) * 0.5;
    positions.push(p1.x + t1v.x * rr * 0.35, p1.y + t1v.y * rr * 0.35, p1.z + t1v.z * rr * 0.35);
    uvs.push(0.5, 1);
    const rowOff = lengthSegs * stride;
    for (let i = 0; i < radialSegs; i++) {
      indices.push(tipIdx, rowOff + i, rowOff + i + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ---------- Procedural Canvas Textures ----------

function makeSkinTexture(THREE, kit, skinHex, blush, freckles) {
  const base = new THREE.Color(skinHex);
  const warm = shiftColor(THREE, skinHex, -0.05, 0.08);
  const coolShadow = shiftColor(THREE, skinHex, -0.08, 0.02);
  const blushCol = new THREE.Color('#e8757a').lerp(base, 0.25);

  const tex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#' + base.getHexString();
    ctx.fillRect(0, 0, w, h);

    // Subtle organic vinyl warmth & under-chin tint
    const gradY = ctx.createLinearGradient(0, 0, 0, h);
    gradY.addColorStop(0, '#' + base.getHexString());
    gradY.addColorStop(0.55, '#' + base.getHexString());
    gradY.addColorStop(0.88, '#' + warm.getHexString());
    gradY.addColorStop(1, '#' + coolShadow.getHexString());
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = gradY;
    ctx.fillRect(0, 0, w, h);

    // Subtle skin grain via kit.noise
    ctx.globalAlpha = 0.06;
    for (let y = 0; y < h; y += 6) {
      for (let x = 0; x < w; x += 6) {
        const n = kit.noise(x * 0.05, y * 0.05);
        ctx.fillStyle = n > 0.5 ? '#ffffff' : '#6b3a2a';
        ctx.fillRect(x, y, 6, 6);
      }
    }

    // Face center maps near u = 0.5, canvas y = (1 - v) * h
    // Eye level ~ v = 0.49 -> y = 0.51 * h; cheeks ~ v = 0.42 -> y = 0.58 * h
    // Soft nose tip warmth
    const drawSoftBlob = (cx, cy, rx, ry, colorHex, alpha) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(rx, ry);
      const g = ctx.createRadialGradient(0, 0, 0.05, 0, 0, 1);
      g.addColorStop(0, colorHex);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    drawSoftBlob(w * 0.5, h * 0.56, w * 0.025, h * 0.02, '#' + blushCol.getHexString(), 0.25);

    if (blush) {
      drawSoftBlob(w * 0.395, h * 0.575, w * 0.055, h * 0.036, '#' + blushCol.getHexString(), 0.48);
      drawSoftBlob(w * 0.605, h * 0.575, w * 0.055, h * 0.036, '#' + blushCol.getHexString(), 0.48);
      // Tiny stylised highlight slash inside blush
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#fff5f2';
      ctx.beginPath();
      ctx.ellipse(w * 0.388, h * 0.568, w * 0.011, h * 0.005, -0.25, 0, Math.PI * 2);
      ctx.ellipse(w * 0.612, h * 0.568, w * 0.011, h * 0.005, 0.25, 0, Math.PI * 2);
      ctx.fill();
    }

    if (freckles) {
      const freckleCol = shiftColor(THREE, skinHex, -0.28, 0.1);
      ctx.fillStyle = '#' + freckleCol.getHexString();
      const spots = [
        [-0.085, 0.565, 2.2], [-0.072, 0.556, 1.9], [-0.098, 0.574, 2.0],
        [-0.062, 0.571, 2.3], [-0.048, 0.559, 1.7], [-0.080, 0.580, 1.8],
        [-0.032, 0.555, 1.6], [-0.014, 0.552, 1.7], [0.004, 0.554, 1.6],
        [0.022, 0.553, 1.8], [0.045, 0.558, 1.7], [0.060, 0.570, 2.2],
        [0.073, 0.557, 2.0], [0.086, 0.566, 2.2], [0.097, 0.575, 1.9],
        [0.078, 0.581, 1.7], [0.052, 0.577, 1.6], [-0.054, 0.579, 1.6],
      ];
      ctx.globalAlpha = 0.58;
      for (const [dx, py, r] of spots) {
        ctx.beginPath();
        ctx.arc(w * (0.5 + dx), h * py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Subtle rosy lower lip tint on the sculpted lip mound
    drawSoftBlob(w * 0.5, h * 0.648, w * 0.028, h * 0.013, '#' + blushCol.getHexString(), 0.28);
    ctx.globalAlpha = 1;
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeHairTextures(THREE, kit, hairHex) {
  const base = new THREE.Color(hairHex);
  const dark = shiftColor(THREE, hairHex, -0.14, 0.04);
  const light = shiftColor(THREE, hairHex, 0.14, -0.02);
  const sheen = shiftColor(THREE, hairHex, 0.28, -0.05);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#' + dark.getHexString());
    bg.addColorStop(0.32, '#' + base.getHexString());
    bg.addColorStop(0.75, '#' + base.getHexString());
    bg.addColorStop(1, '#' + dark.getHexString());
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Directional hair strands
    for (let i = 0; i < 420; i++) {
      const x = (i / 420) * w + (kit.noise(i * 0.37, 1.2) - 0.5) * 4;
      const n = kit.noise(i * 0.19, 3.4);
      ctx.strokeStyle = n > 0.55 ? '#' + light.getHexString() : '#' + dark.getHexString();
      ctx.globalAlpha = 0.16 + n * 0.24;
      ctx.lineWidth = 1 + (i % 3) * 0.6;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      const sway = (kit.noise(i * 0.23, 7.1) - 0.5) * 8;
      ctx.bezierCurveTo(x + sway, h * 0.33, x - sway, h * 0.66, x, h);
      ctx.stroke();
    }

    // Soft angel-ring highlight band across upper-mid strands
    ctx.globalAlpha = 0.36;
    const bandY = h * 0.34;
    const bandGrad = ctx.createLinearGradient(0, bandY - 46, 0, bandY + 46);
    bandGrad.addColorStop(0, 'rgba(255,255,255,0)');
    bandGrad.addColorStop(0.45, '#' + sheen.getHexString());
    bandGrad.addColorStop(0.55, '#' + sheen.getHexString());
    bandGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = bandGrad;
    ctx.fillRect(0, bandY - 46, w, 92);

    // Broken vertical notches in highlight band for painterly vinyl shine
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = '#' + base.getHexString();
    for (let i = 0; i < 24; i++) {
      const nx = (i / 24) * w;
      const nw = 5 + kit.noise(i * 1.1, 2.3) * 10;
      const ny = bandY + (kit.noise(i * 0.8, 5.1) - 0.5) * 26;
      ctx.fillRect(nx, ny - 22, nw, 44);
    }
    ctx.globalAlpha = 1;
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;

  const bump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 180; i++) {
      const x = (i / 180) * w;
      const n = kit.noise(i * 0.27, 4.1);
      const shade = Math.round(90 + n * 110);
      ctx.strokeStyle = `rgb(${shade},${shade},${shade})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  });
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;

  return { map, bump };
}

function makeFabricTextures(THREE, kit, colorHex, kind = 'cotton') {
  const base = new THREE.Color(colorHex);
  const dark = shiftColor(THREE, colorHex, -0.09, 0.03);
  const light = shiftColor(THREE, colorHex, 0.08, -0.02);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#' + base.getHexString();
    ctx.fillRect(0, 0, w, h);

    if (kind === 'denim') {
      // Diagonal denim twill weave
      ctx.globalAlpha = 0.22;
      for (let i = -h; i < w + h; i += 4) {
        ctx.strokeStyle = i % 8 === 0 ? '#' + light.getHexString() : '#' + dark.getHexString();
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i - h, h);
        ctx.stroke();
      }
      // Subtle weft flecks
      ctx.globalAlpha = 0.14;
      for (let y = 0; y < h; y += 6) {
        for (let x = 0; x < w; x += 12) {
          const n = kit.noise(x * 0.09, y * 0.09);
          if (n > 0.6) {
            ctx.fillStyle = '#' + light.getHexString();
            ctx.fillRect(x, y, 7, 1.5);
          }
        }
      }
    } else if (kind === 'knit' || kind === 'rib') {
      const step = kind === 'rib' ? 8 : 10;
      for (let x = 0; x < w; x += step) {
        ctx.fillStyle = '#' + dark.getHexString();
        ctx.globalAlpha = kind === 'rib' ? 0.34 : 0.18;
        ctx.fillRect(x, 0, step * 0.42, h);
        ctx.fillStyle = '#' + light.getHexString();
        ctx.globalAlpha = kind === 'rib' ? 0.2 : 0.12;
        ctx.fillRect(x + step * 0.45, 0, step * 0.35, h);
      }
      // Knit V-stitch texture
      ctx.strokeStyle = '#' + dark.getHexString();
      ctx.globalAlpha = 0.16;
      ctx.lineWidth = 1.1;
      for (let y = 0; y < h; y += 8) {
        for (let x = 0; x < w; x += step) {
          ctx.beginPath();
          ctx.moveTo(x + 1, y);
          ctx.lineTo(x + step * 0.5, y + 6);
          ctx.lineTo(x + step - 1, y);
          ctx.stroke();
        }
      }
    } else if (kind === 'suiting') {
      ctx.globalAlpha = 0.14;
      for (let y = 0; y < h; y += 4) {
        for (let x = 0; x < w; x += 4) {
          ctx.fillStyle = ((x + y) / 4) % 2 === 0 ? '#' + light.getHexString() : '#' + dark.getHexString();
          ctx.fillRect(x, y, 3, 3);
        }
      }
    } else {
      // Soft woven cotton jersey
      ctx.globalAlpha = 0.12;
      for (let y = 0; y < h; y += 4) {
        ctx.fillStyle = y % 8 === 0 ? '#' + light.getHexString() : '#' + dark.getHexString();
        ctx.fillRect(0, y, w, 1.5);
      }
      for (let x = 0; x < w; x += 4) {
        ctx.fillStyle = x % 8 === 0 ? '#' + dark.getHexString() : '#' + light.getHexString();
        ctx.fillRect(x, 0, 1.5, h);
      }
    }

    // Soft organic mottling so cloth feels lived-in and painterly
    ctx.globalAlpha = 0.08;
    for (let y = 0; y < h; y += 16) {
      for (let x = 0; x < w; x += 16) {
        const n = kit.noise(x * 0.03, y * 0.03);
        ctx.fillStyle = n > 0.5 ? '#ffffff' : '#000000';
        ctx.fillRect(x, y, 16, 16);
      }
    }
    ctx.globalAlpha = 1;
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(kind === 'rib' ? 3 : 2, kind === 'rib' ? 2 : 2);

  const bump = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    if (kind === 'rib' || kind === 'knit') {
      const step = kind === 'rib' ? 6 : 8;
      for (let x = 0; x < w; x += step) {
        ctx.fillStyle = '#b8b8b8';
        ctx.fillRect(x, 0, step * 0.48, h);
        ctx.fillStyle = '#525252';
        ctx.fillRect(x + step * 0.5, 0, step * 0.45, h);
      }
    } else if (kind === 'denim') {
      ctx.strokeStyle = '#a8a8a8';
      ctx.lineWidth = 1.5;
      for (let i = -h; i < w + h; i += 4) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i - h, h);
        ctx.stroke();
      }
    } else {
      for (let y = 0; y < h; y += 4) {
        ctx.fillStyle = y % 8 === 0 ? '#969696' : '#6c6c6c';
        ctx.fillRect(0, y, w, 2);
      }
      for (let x = 0; x < w; x += 4) {
        ctx.fillStyle = x % 8 === 0 ? '#929292' : '#707070';
        ctx.fillRect(x, 0, 2, h);
      }
    }
  });
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.copy(map.repeat);

  return { map, bump };
}

function makeIrisTexture(THREE, kit, eyeHex) {
  const iris = new THREE.Color(eyeHex);
  const darkRim = shiftColor(THREE, eyeHex, -0.26, 0.08);
  const brightLow = shiftColor(THREE, eyeHex, 0.24, 0.06);

  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const r = w * 0.48;

    // Deep glossy limbal ring
    const grad = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
    grad.addColorStop(0, '#101218');
    grad.addColorStop(0.45, '#' + darkRim.getHexString());
    grad.addColorStop(0.84, '#' + iris.getHexString());
    grad.addColorStop(1, '#121319');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Luminous lower iris crescent
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.84, 0, Math.PI * 2);
    ctx.clip();
    const lowGrad = ctx.createRadialGradient(cx, cy + r * 0.38, r * 0.06, cx, cy + r * 0.34, r * 0.55);
    lowGrad.addColorStop(0, '#' + brightLow.getHexString());
    lowGrad.addColorStop(0.7, '#' + iris.getHexString());
    lowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = lowGrad;
    ctx.fillRect(0, 0, w, h);

    // Fine iris radial flecks
    ctx.strokeStyle = '#' + brightLow.getHexString();
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.38, cy + Math.sin(a) * r * 0.38);
      ctx.lineTo(cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82);
      ctx.stroke();
    }

    // Crisp pupil
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0e1016';
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.03, r * 0.38, r * 0.43, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeFabricMaterial(THREE, kit, colorHex, kind = 'cotton') {
  const { map, bump } = makeFabricTextures(THREE, kit, colorHex, kind);
  const sheenCol = shiftColor(THREE, colorHex, 0.22, -0.08);
  return new THREE.MeshPhysicalMaterial({
    map,
    bumpMap: bump,
    bumpScale: kind === 'rib' ? 0.0045 : kind === 'knit' ? 0.003 : 0.0018,
    roughness: kind === 'suiting' ? 0.86 : 0.93,
    metalness: 0.0,
    sheen: kind === 'knit' || kind === 'rib' ? 0.92 : 0.72,
    sheenRoughness: 0.68,
    sheenColor: sheenCol,
  });
}

// ---------- Anatomical Evaluators ----------

function createHeadEvaluator(hs) {
  const rx = 0.172 * hs;
  const ry = 0.194 * hs;
  const rz = 0.178 * hs;

  return function evalHead(theta, phi, extraOffset = 0) {
    // theta in [-PI, PI] (0 is +Z front), phi in [-PI/2, PI/2]
    const cp = Math.cos(phi);
    const sp = Math.sin(phi);
    const ux = cp * Math.sin(theta);
    const uy = sp;
    const uz = cp * Math.cos(theta);

    let x = ux * rx;
    let y = uy * ry;
    let z = uz * rz;

    // 1. Egg-shaped skull: fuller back/top cranium, softer narrower jaw
    const backMask = smoothstep(-0.1, -0.85, uz) * smoothstep(-0.35, 0.35, uy);
    z -= backMask * 0.015 * hs;
    x *= 1 + smoothstep(0.05, 0.55, uy) * 0.035;

    // Jawline taper below cheek level
    const lowerMask = smoothstep(0.06, -0.92, uy);
    const jawCorner = gauss(uy + 0.42, 0.22) * smoothstep(0.25, 0.7, Math.abs(ux)) * smoothstep(-0.3, 0.4, uz);
    x *= 1 - lowerMask * 0.25 + jawCorner * 0.045;
    z *= 1 - smoothstep(-0.35, -0.95, uy) * 0.16;

    // 2. Flatter face plane in front
    const frontFace = smoothstep(0.22, 0.78, uz) * smoothstep(-0.62, -0.25, uy) * smoothstep(0.55, 0.15, uy);
    z -= frontFace * 0.014 * hs;

    // 3. Brow ridge shading the eye sockets
    const brow = gauss(uy - 0.15, 0.085) * smoothstep(0.52, 0.85, uz) * smoothstep(0.62, 0.15, Math.abs(ux));
    z += brow * 0.0085 * hs;

    // 4. Gently recessed eye sockets so eyes sit inset
    const eyeL = gauss(ux - 0.30, 0.15) * gauss(uy + 0.02, 0.13) * smoothstep(0.55, 0.85, uz);
    const eyeR = gauss(ux + 0.30, 0.15) * gauss(uy + 0.02, 0.13) * smoothstep(0.55, 0.85, uz);
    z -= (eyeL + eyeR) * 0.0105 * hs;

    // 5. Sculpted cheeks (zygomata / soft vinyl cheek puff)
    const cheekL = gauss(ux - 0.45, 0.22) * gauss(uy + 0.22, 0.18) * smoothstep(0.25, 0.75, uz);
    const cheekR = gauss(ux + 0.45, 0.22) * gauss(uy + 0.22, 0.18) * smoothstep(0.25, 0.75, uz);
    const cheek = cheekL + cheekR;
    z += cheek * 0.0145 * hs;
    x += (cheekL - cheekR) * 0.0125 * hs;

    // 6. Small sculpted nose: bridge + button tip + subtle alae
    const noseFront = smoothstep(0.76, 0.96, uz);
    const bridge = gauss(ux, 0.055) * smoothstep(-0.18, -0.05, uy) * smoothstep(0.11, -0.02, uy) * noseFront;
    const tip = gauss(ux, 0.072) * gauss(uy + 0.165, 0.068) * noseFront;
    const nostrilL = gauss(ux - 0.068, 0.036) * gauss(uy + 0.195, 0.038) * noseFront;
    const nostrilR = gauss(ux + 0.068, 0.036) * gauss(uy + 0.195, 0.038) * noseFront;
    z += (bridge * 0.011 + tip * 0.023 + (nostrilL + nostrilR) * 0.0085) * hs;
    y += tip * 0.003 * hs;

    // 7. Lips as a soft shaped anatomical form (upper bow + lower cushion + chin dip)
    const lipFront = smoothstep(0.68, 0.92, uz);
    const philtrum = gauss(ux, 0.035) * gauss(uy + 0.275, 0.045) * lipFront;
    const upperLip = gauss(ux, 0.135) * gauss(uy + 0.345, 0.038) * (1 + 0.18 * gauss(Math.abs(ux) - 0.045, 0.03)) * lipFront;
    const lipCrease = gauss(ux, 0.145) * gauss(uy + 0.382, 0.018) * lipFront;
    const lowerLip = gauss(ux, 0.115) * gauss(uy + 0.422, 0.042) * lipFront;
    const mentoDip = gauss(ux, 0.13) * gauss(uy + 0.505, 0.048) * lipFront;
    z += (-philtrum * 0.003 + upperLip * 0.0085 - lipCrease * 0.0045 + lowerLip * 0.0095 - mentoDip * 0.0055) * hs;

    // 8. Defined small rounded chin & softer under-jaw transition
    const chin = gauss(ux, 0.17) * gauss(uy + 0.67, 0.14) * smoothstep(0.35, 0.8, uz);
    z += chin * 0.0125 * hs;
    y -= chin * 0.004 * hs;
    const underJaw = smoothstep(-0.74, -0.96, uy);
    y += underJaw * 0.014 * hs;

    if (extraOffset !== 0) {
      const len = Math.hypot(x, y, z) || 1;
      x += (x / len) * extraOffset;
      y += (y / len) * extraOffset;
      z += (z / len) * extraOffset;
    }

    return [x, y, z];
  };
}

function createTorsoEvaluator(dims) {
  const { bw, bh, pelvisBottomY, neckTopY } = dims;
  const totalH = neckTopY - pelvisBottomY;

  return function evalTorso(u, v, easeFn = null) {
    // u in [0,1] -> theta in [-PI, PI], 0 is +Z front
    const theta = (u - 0.5) * Math.PI * 2;
    const st = Math.sin(theta);
    const ct = Math.cos(theta);

    // Smooth vertical height mapping
    const y = pelvisBottomY + v * totalH;

    // Piece-wise smooth anatomical profile: pelvis -> hips -> waist -> chest -> sloping shoulders -> neck
    let rx, rz, zOff = 0;
    const neckBw = 0.85 + 0.15 * bw;

    if (v < 0.07) {
      const k = smoothstep(0, 0.07, v);
      rx = lerp(0.012, 0.104 * bw, Math.pow(k, 0.52));
      rz = lerp(0.010, 0.082 * bw, Math.pow(k, 0.52));
    } else if (v < 0.24) {
      const k = smoothstep(0.07, 0.24, v);
      rx = lerp(0.104, 0.114, k) * bw;
      rz = lerp(0.082, 0.088, k) * bw;
    } else if (v < 0.45) {
      const k = smoothstep(0.24, 0.45, v);
      rx = lerp(0.114, 0.091, k) * bw;
      rz = lerp(0.088, 0.073, k) * bw;
    } else if (v < 0.67) {
      const k = smoothstep(0.45, 0.67, v);
      rx = lerp(0.091, 0.114, k) * bw;
      rz = lerp(0.073, 0.084, k) * bw;
    } else if (v < 0.77) {
      // Shoulder fullness
      const k = smoothstep(0.67, 0.77, v);
      rx = lerp(0.114, 0.126, k) * bw;
      rz = lerp(0.084, 0.074, k) * bw;
    } else if (v < 0.87) {
      // Clear downward trapezius slope into neck
      const k = smoothstep(0.77, 0.87, v);
      rx = lerp(0.126 * bw, 0.043 * neckBw, k);
      rz = lerp(0.074 * bw, 0.044 * neckBw, k);
    } else {
      // Visible sculpted neck inserting deeply into skull
      const k = smoothstep(0.87, 1.0, v);
      rx = lerp(0.043, 0.039, k) * neckBw;
      rz = lerp(0.044, 0.041, k) * neckBw;
      zOff = lerp(0.002, 0.010, k);
    }

    // Subtle anatomical front/back shaping: glute curve, chest contour, slight spinal dip
    const hipBack = gauss(v - 0.16, 0.09) * smoothstep(0.0, -0.85, ct);
    const chestFront = gauss(v - 0.60, 0.11) * smoothstep(0.15, 0.9, ct);
    const spineDip = gauss(v - 0.48, 0.22) * gauss(st, 0.22) * smoothstep(-0.4, -0.95, ct);
    const shoulderSlope = gauss(v - 0.78, 0.055) * Math.abs(st);

    let x = st * rx;
    let z = ct * rz + zOff;
    z -= hipBack * 0.014 * bw;
    z += chestFront * 0.010 * bw;
    z += spineDip * 0.005 * bw;
    let yy = y - shoulderSlope * 0.011 * bh;

    if (easeFn) {
      const e = easeFn(u, v, theta, x, yy, z);
      const len = Math.hypot(x, z - zOff) || 1;
      const nx = x / len;
      const nz = (z - zOff) / len;
      x += nx * (e.dr || 0) + (e.dx || 0);
      z += nz * (e.dr || 0) + (e.dz || 0);
      yy += e.dy || 0;
    }

    return [x, yy, z];
  };
}

// ---------- Body Parts Builders ----------

function buildHeadGroup(THREE, opts, kit, dims, mats) {
  const { hs } = dims;
  const evalHead = createHeadEvaluator(hs);
  const headGroup = new THREE.Group();
  headGroup.name = 'head';
  headGroup.position.set(0, dims.headPivotY, 0);

  // Sculpted continuous head mesh (64 x 48, warped slightly toward +Z for crisp face resolution)
  const headGeo = buildParametricGrid(THREE, 48, 64, (u, v) => {
    const rawTheta = (u - 0.5) * Math.PI * 2;
    const theta = rawTheta - 0.24 * Math.sin(rawTheta);
    const phi = lerp(-Math.PI * 0.496, Math.PI * 0.496, v);
    const p = evalHead(theta, phi);
    return [p[0], p[1] + dims.headCenterLocalY, p[2]];
  }, true, false, false);

  const headMesh = tagSlot(new THREE.Mesh(headGeo, mats.headSkin), 'skin');
  headGroup.add(headMesh);

  // Sculpted Ears with inner fold (ExtrudeGeometry + curved vertex displacement)
  const buildEar = (side) => {
    const earGroup = new THREE.Group();
    earGroup.name = side > 0 ? 'earL' : 'earR';
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.024 * hs);
    shape.bezierCurveTo(0.020 * hs, -0.028 * hs, 0.032 * hs, -0.008 * hs, 0.030 * hs, 0.016 * hs);
    shape.bezierCurveTo(0.028 * hs, 0.038 * hs, 0.008 * hs, 0.044 * hs, -0.008 * hs, 0.030 * hs);
    shape.bezierCurveTo(-0.015 * hs, 0.018 * hs, -0.014 * hs, -0.015 * hs, 0, -0.024 * hs);

    const earGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.009 * hs,
      bevelEnabled: true,
      bevelThickness: 0.005 * hs,
      bevelSize: 0.0045 * hs,
      bevelSegments: 4,
      curveSegments: 20,
    });
    earGeo.center();

    // Displace vertices to curve ear backward & carve inner concha bowl
    const pos = earGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);
      const nx = x / (0.022 * hs);
      const ny = y / (0.034 * hs);
      // Curve outer helix smoothly backward
      z -= (nx * nx * 0.0055 + Math.max(0, nx) * 0.004) * hs;
      // Carve concave inner fold on front (+Z) side
      if (z > 0) {
        const bowl = gauss(nx - 0.12, 0.62) * gauss(ny - 0.02, 0.68);
        z -= bowl * 0.0075 * hs;
      }
      pos.setXYZ(i, x * side, y, z);
    }
    if (side < 0) {
      // Flip triangle winding after X reflection
      const idx = earGeo.index;
      if (idx) {
        for (let i = 0; i < idx.count; i += 3) {
          const b = idx.getX(i + 1);
          idx.setX(i + 1, idx.getX(i + 2));
          idx.setX(i + 2, b);
        }
      } else {
        for (let i = 0; i < pos.count; i += 3) {
          const x1 = pos.getX(i + 1), y1 = pos.getY(i + 1), z1 = pos.getZ(i + 1);
          pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
          pos.setXYZ(i + 2, x1, y1, z1);
        }
      }
    }
    earGeo.computeVertexNormals();
    const earMesh = tagSlot(new THREE.Mesh(earGeo, mats.skin), 'skin');
    earGroup.add(earMesh);

    // Warm soft inner-ear fold cushion
    const innerGeo = new THREE.SphereGeometry(0.013 * hs, 16, 12);
    innerGeo.scale(0.75, 1.25, 0.35);
    const innerMesh = tagSlot(new THREE.Mesh(innerGeo, mats.innerEar), 'skin');
    innerMesh.position.set(side * 0.002 * hs, 0.001 * hs, 0.002 * hs);
    earGroup.add(innerMesh);

    const anchor = evalHead(side * 1.56, -0.05);
    earGroup.position.set(anchor[0] - side * 0.006 * hs, anchor[1] + dims.headCenterLocalY, anchor[2] - 0.006 * hs);
    earGroup.rotation.y = -side * 0.34;
    earGroup.rotation.z = -side * 0.08;
    return earGroup;
  };
  headGroup.add(buildEar(1));
  headGroup.add(buildEar(-1));

  // ---------- Multi-layer Eyes (inset on face curvature) ----------
  const irisTex = makeIrisTexture(THREE, kit, opts.eye);
  const irisMat = new THREE.MeshPhysicalMaterial({
    map: irisTex,
    roughness: 0.06,
    metalness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  });
  const scleraMat = new THREE.MeshPhysicalMaterial({
    color: '#faf7f2',
    roughness: 0.25,
    clearcoat: 0.6,
  });
  const lashMat = new THREE.MeshPhysicalMaterial({
    color: '#1e1918',
    roughness: 0.45,
  });
  const hiMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });

  const makeEye = (side) => {
    const eyeGroup = new THREE.Group();
    eyeGroup.name = side > 0 ? 'eyeL' : 'eyeR';
    const eyeTheta = side * 0.325;
    const eyePhi = -0.025;
    const p = evalHead(eyeTheta, eyePhi, 0.0015 * hs);
    eyeGroup.position.set(p[0], p[1] + dims.headCenterLocalY, p[2]);
    eyeGroup.rotation.y = side * 0.24;
    eyeGroup.rotation.x = 0.04;

    // 1. Open eye sub-group (awake / thinking / unsure)
    const openG = new THREE.Group();
    openG.name = 'openEye';

    const scleraGeo = new THREE.SphereGeometry(0.031 * hs, 24, 18);
    scleraGeo.scale(1.06, 1.04, 0.34);
    const sclera = new THREE.Mesh(scleraGeo, scleraMat);
    sclera.position.z = -0.003 * hs;
    openG.add(sclera);

    // Iris + highlights pivot (for thinking glance)
    const irisPivot = new THREE.Group();
    irisPivot.name = 'irisPivot';
    const irisGeo = new THREE.CircleGeometry(0.0245 * hs, 32);
    irisGeo.scale(0.95, 1.08, 1);
    const irisMesh = tagSlot(new THREE.Mesh(irisGeo, irisMat), 'eye');
    irisMesh.castShadow = false;
    irisMesh.position.z = 0.0085 * hs;
    irisPivot.add(irisMesh);

    const hi1 = new THREE.Mesh(new THREE.SphereGeometry(0.0058 * hs, 12, 10), hiMat);
    hi1.scale.set(1.0, 1.15, 0.45);
    hi1.position.set(0.0085 * hs, 0.0105 * hs, 0.0105 * hs);
    irisPivot.add(hi1);

    const hi2 = new THREE.Mesh(new THREE.SphereGeometry(0.0030 * hs, 10, 8), hiMat);
    hi2.scale.set(1, 1, 0.45);
    hi2.position.set(-0.0075 * hs, -0.009 * hs, 0.0102 * hs);
    irisPivot.add(hi2);
    openG.add(irisPivot);

    // Sculpted upper eyelash arch with soft outer flick
    const lashPts = [
      new THREE.Vector3(-side * 0.028 * hs, 0.006 * hs, 0.006 * hs),
      new THREE.Vector3(-side * 0.014 * hs, 0.027 * hs, 0.009 * hs),
      new THREE.Vector3(side * 0.012 * hs, 0.028 * hs, 0.009 * hs),
      new THREE.Vector3(side * 0.031 * hs, 0.012 * hs, 0.005 * hs),
      new THREE.Vector3(side * 0.037 * hs, 0.016 * hs, 0.002 * hs),
    ];
    const lashGeo = makeTaperedTube(THREE, new THREE.CatmullRomCurve3(lashPts), 10, 18, (t) => {
      const w = Math.sin(clamp(t, 0, 1) * Math.PI);
      return (0.0014 + w * 0.0038) * hs;
    });
    openG.add(new THREE.Mesh(lashGeo, lashMat));
    eyeGroup.add(openG);

    // 2. Happy crescent eye (^ ^)
    const happyG = new THREE.Group();
    happyG.name = 'happyEye';
    happyG.visible = false;
    const hPts = [
      new THREE.Vector3(-side * 0.026 * hs, -0.004 * hs, 0.006 * hs),
      new THREE.Vector3(-side * 0.010 * hs, 0.016 * hs, 0.009 * hs),
      new THREE.Vector3(side * 0.010 * hs, 0.016 * hs, 0.009 * hs),
      new THREE.Vector3(side * 0.028 * hs, -0.003 * hs, 0.005 * hs),
    ];
    const happyGeo = makeTaperedTube(THREE, new THREE.CatmullRomCurve3(hPts), 10, 16, (t) => (0.0018 + Math.sin(t * Math.PI) * 0.0034) * hs);
    happyG.add(new THREE.Mesh(happyGeo, lashMat));
    eyeGroup.add(happyG);

    // 3. Asleep downward closed lash arc (u u)
    const asleepG = new THREE.Group();
    asleepG.name = 'asleepEye';
    asleepG.visible = false;
    const aPts = [
      new THREE.Vector3(-side * 0.026 * hs, 0.005 * hs, 0.006 * hs),
      new THREE.Vector3(-side * 0.009 * hs, -0.010 * hs, 0.009 * hs),
      new THREE.Vector3(side * 0.009 * hs, -0.010 * hs, 0.009 * hs),
      new THREE.Vector3(side * 0.027 * hs, 0.004 * hs, 0.005 * hs),
    ];
    const asleepGeo = makeTaperedTube(THREE, new THREE.CatmullRomCurve3(aPts), 10, 16, (t) => (0.0016 + Math.sin(t * Math.PI) * 0.0028) * hs);
    asleepG.add(new THREE.Mesh(asleepGeo, lashMat));
    eyeGroup.add(asleepG);

    return eyeGroup;
  };
  headGroup.add(makeEye(1));
  headGroup.add(makeEye(-1));

  // ---------- Eyebrows ----------
  const browMat = new THREE.MeshPhysicalMaterial({
    color: shiftColor(THREE, opts.hairColor, -0.06, 0),
    roughness: 0.72,
  });
  const makeBrow = (side) => {
    const browG = new THREE.Group();
    browG.name = side > 0 ? 'browL' : 'browR';
    const bp = evalHead(side * 0.31, 0.21, 0.0055 * hs);
    browG.position.set(bp[0], bp[1] + dims.headCenterLocalY, bp[2]);
    browG.rotation.y = side * 0.22;
    const bPts = [
      new THREE.Vector3(-side * 0.025 * hs, -0.002 * hs, 0),
      new THREE.Vector3(0, 0.0055 * hs, 0.0025 * hs),
      new THREE.Vector3(side * 0.026 * hs, -0.003 * hs, -0.002 * hs),
    ];
    const browGeo = makeTaperedTube(THREE, new THREE.CatmullRomCurve3(bPts), 8, 14, (t) => (0.0018 + Math.sin(t * Math.PI) * 0.0026) * hs);
    browG.add(tagSlot(new THREE.Mesh(browGeo, browMat), 'fur'));
    browG.userData.basePos = browG.position.clone();
    browG.userData.baseRot = browG.rotation.clone();
    return browG;
  };
  headGroup.add(makeBrow(1));
  headGroup.add(makeBrow(-1));

  // ---------- Mouth Expressions (resting on sculpted lip cushion) ----------
  const mouthAnchor = evalHead(0, -0.382, 0.003 * hs);
  const mouthRoot = new THREE.Group();
  mouthRoot.name = 'mouthRoot';
  mouthRoot.position.set(mouthAnchor[0], mouthAnchor[1] + dims.headCenterLocalY, mouthAnchor[2]);

  const mouthLineMat = new THREE.MeshPhysicalMaterial({
    color: '#7c3f3d',
    roughness: 0.45,
    clearcoat: 0.3,
  });
  const mouthInsideMat = new THREE.MeshPhysicalMaterial({
    color: '#8f3942',
    roughness: 0.35,
  });
  const tongueMat = new THREE.MeshPhysicalMaterial({
    color: '#e57e84',
    roughness: 0.3,
    clearcoat: 0.4,
  });

  // Awake gentle smile
  const mAwakeG = new THREE.Group();
  mAwakeG.name = 'mouth_awake';
  const awakePts = [
    new THREE.Vector3(-0.021 * hs, 0.0035 * hs, -0.003 * hs),
    new THREE.Vector3(-0.008 * hs, -0.0032 * hs, 0.0025 * hs),
    new THREE.Vector3(0.008 * hs, -0.0032 * hs, 0.0025 * hs),
    new THREE.Vector3(0.021 * hs, 0.0035 * hs, -0.003 * hs),
  ];
  mAwakeG.add(new THREE.Mesh(
    makeTaperedTube(THREE, new THREE.CatmullRomCurve3(awakePts), 8, 14, (t) => (0.0012 + Math.sin(t * Math.PI) * 0.0018) * hs),
    mouthLineMat
  ));
  mouthRoot.add(mAwakeG);

  // Happy open cheerful smile
  const mHappyG = new THREE.Group();
  mHappyG.name = 'mouth_happy';
  mHappyG.visible = false;
  const hShape = new THREE.Shape();
  hShape.moveTo(-0.024 * hs, 0.004 * hs);
  hShape.quadraticCurveTo(0, 0.008 * hs, 0.024 * hs, 0.004 * hs);
  hShape.bezierCurveTo(0.022 * hs, -0.020 * hs, -0.022 * hs, -0.020 * hs, -0.024 * hs, 0.004 * hs);
  const hMouthGeo = new THREE.ExtrudeGeometry(hShape, { depth: 0.004 * hs, bevelEnabled: true, bevelSize: 0.0015 * hs, bevelThickness: 0.0015 * hs, bevelSegments: 2 });
  hMouthGeo.center();
  const hMouthPos = hMouthGeo.attributes.position;
  for (let i = 0; i < hMouthPos.count; i++) {
    const x = hMouthPos.getX(i);
    hMouthPos.setZ(i, hMouthPos.getZ(i) - (x * x) / (0.14 * hs));
  }
  hMouthGeo.computeVertexNormals();
  const hMouthMesh = new THREE.Mesh(hMouthGeo, mouthInsideMat);
  hMouthMesh.position.set(0, -0.004 * hs, 0.001 * hs);
  mHappyG.add(hMouthMesh);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.011 * hs, 14, 10), tongueMat);
  tongue.scale.set(1.2, 0.65, 0.4);
  tongue.position.set(0, -0.010 * hs, 0.003 * hs);
  mHappyG.add(tongue);
  mouthRoot.add(mHappyG);

  // Asleep tiny peaceful neutral/soft curve
  const mAsleepG = new THREE.Group();
  mAsleepG.name = 'mouth_asleep';
  mAsleepG.visible = false;
  const asleepMouth = new THREE.Mesh(new THREE.SphereGeometry(0.0055 * hs, 14, 10), mouthInsideMat);
  asleepMouth.scale.set(1.15, 0.85, 0.45);
  asleepMouth.position.set(0, -0.001 * hs, 0.002 * hs);
  mAsleepG.add(asleepMouth);
  mouthRoot.add(mAsleepG);

  // Thinking small pursed off-center curve
  const mThinkG = new THREE.Group();
  mThinkG.name = 'mouth_thinking';
  mThinkG.visible = false;
  const thinkPts = [
    new THREE.Vector3(-0.009 * hs, -0.001 * hs, 0.001 * hs),
    new THREE.Vector3(0.002 * hs, 0.0015 * hs, 0.003 * hs),
    new THREE.Vector3(0.015 * hs, -0.0025 * hs, 0.0005 * hs),
  ];
  mThinkG.add(new THREE.Mesh(
    makeTaperedTube(THREE, new THREE.CatmullRomCurve3(thinkPts), 8, 12, (t) => (0.0015 + Math.sin(t * Math.PI) * 0.0018) * hs),
    mouthLineMat
  ));
  mouthRoot.add(mThinkG);

  // Unsure wavy uncertain mouth
  const mUnsureG = new THREE.Group();
  mUnsureG.name = 'mouth_unsure';
  mUnsureG.visible = false;
  const unsurePts = [
    new THREE.Vector3(-0.020 * hs, -0.003 * hs, -0.002 * hs),
    new THREE.Vector3(-0.007 * hs, 0.0025 * hs, 0.002 * hs),
    new THREE.Vector3(0.007 * hs, -0.003 * hs, 0.002 * hs),
    new THREE.Vector3(0.020 * hs, 0.0015 * hs, -0.002 * hs),
  ];
  mUnsureG.add(new THREE.Mesh(
    makeTaperedTube(THREE, new THREE.CatmullRomCurve3(unsurePts), 8, 16, (t) => (0.0014 + Math.sin(t * Math.PI) * 0.0017) * hs),
    mouthLineMat
  ));
  mouthRoot.add(mUnsureG);

  headGroup.add(mouthRoot);

  // ---------- Glasses ----------
  if (opts.glasses && opts.glasses !== 'none') {
    headGroup.add(buildGlasses(THREE, opts, dims, evalHead));
  }

  // ---------- Hair ----------
  headGroup.add(buildHairGroup(THREE, opts, kit, dims, evalHead));

  return headGroup;
}

function buildGlasses(THREE, opts, dims, evalHead) {
  const { hs } = dims;
  const gGroup = new THREE.Group();
  gGroup.name = 'glasses';

  const frameMat = new THREE.MeshPhysicalMaterial({
    color: opts.glasses === 'round' ? '#36302d' : '#25282e',
    roughness: 0.25,
    metalness: 0.65,
    clearcoat: 0.5,
  });
  const lensMat = new THREE.MeshPhysicalMaterial({
    color: '#eef6ff',
    roughness: 0.05,
    metalness: 0.0,
    transparent: true,
    opacity: 0.17,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    depthWrite: false,
  });

  const bridgeP = evalHead(0, -0.06, 0.022 * hs);
  const cy = bridgeP[1] + dims.headCenterLocalY;
  const cz = bridgeP[2];
  const eyeX = 0.058 * hs;
  const rRim = 0.041 * hs;
  const tubeR = 0.0032 * hs;

  for (const side of [1, -1]) {
    if (opts.glasses === 'round') {
      const rim = tagSlot(new THREE.Mesh(new THREE.TorusGeometry(rRim, tubeR, 12, 32), frameMat), 'accent');
      rim.position.set(side * eyeX, cy, cz);
      rim.rotation.y = side * 0.14;
      gGroup.add(rim);

      const lens = new THREE.Mesh(new THREE.CircleGeometry(rRim - tubeR * 0.5, 28), lensMat);
      lens.position.copy(rim.position);
      lens.rotation.copy(rim.rotation);
      gGroup.add(lens);
    } else {
      // Rounded square frame via closed CatmullRom tube
      const rw = 0.043 * hs;
      const rh = 0.034 * hs;
      const pts = [
        new THREE.Vector3(-rw, rh * 0.65, 0),
        new THREE.Vector3(-rw * 0.68, rh, 0),
        new THREE.Vector3(rw * 0.68, rh, 0),
        new THREE.Vector3(rw, rh * 0.65, 0),
        new THREE.Vector3(rw, -rh * 0.62, 0),
        new THREE.Vector3(rw * 0.65, -rh, 0),
        new THREE.Vector3(-rw * 0.65, -rh, 0),
        new THREE.Vector3(-rw, -rh * 0.62, 0),
      ];
      const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.3);
      const rimGeo = new THREE.TubeGeometry(curve, 40, tubeR * 1.15, 10, true);
      const rim = tagSlot(new THREE.Mesh(rimGeo, frameMat), 'accent');
      rim.position.set(side * eyeX, cy, cz);
      rim.rotation.y = side * 0.14;
      gGroup.add(rim);

      const lShape = new THREE.Shape();
      const lw = rw * 0.94, lh = rh * 0.94, cr = 0.009 * hs;
      lShape.moveTo(-lw + cr, -lh);
      lShape.lineTo(lw - cr, -lh);
      lShape.quadraticCurveTo(lw, -lh, lw, -lh + cr);
      lShape.lineTo(lw, lh - cr);
      lShape.quadraticCurveTo(lw, lh, lw - cr, lh);
      lShape.lineTo(-lw + cr, lh);
      lShape.quadraticCurveTo(-lw, lh, -lw, lh - cr);
      lShape.lineTo(-lw, -lh + cr);
      lShape.quadraticCurveTo(-lw, -lh, -lw + cr, -lh);
      const lens = new THREE.Mesh(new THREE.ShapeGeometry(lShape, 12), lensMat);
      lens.position.copy(rim.position);
      lens.rotation.copy(rim.rotation);
      gGroup.add(lens);
    }

    // Temple arm resting smoothly over the ear
    const earP = evalHead(side * 1.54, 0.06, 0.008 * hs);
    const armPts = [
      new THREE.Vector3(side * (eyeX + rRim * 0.95), cy + 0.008 * hs, cz - 0.005 * hs),
      new THREE.Vector3(side * (0.148 * hs), cy + 0.010 * hs, cz - 0.065 * hs),
      new THREE.Vector3(earP[0] + side * 0.006 * hs, earP[1] + dims.headCenterLocalY + 0.012 * hs, earP[2] - 0.010 * hs),
      new THREE.Vector3(earP[0] + side * 0.002 * hs, earP[1] + dims.headCenterLocalY - 0.016 * hs, earP[2] - 0.028 * hs),
    ];
    const armGeo = makeTaperedTube(THREE, new THREE.CatmullRomCurve3(armPts), 8, 18, (t) => lerp(0.0032, 0.0024, t) * hs);
    gGroup.add(tagSlot(new THREE.Mesh(armGeo, frameMat), 'accent'));
  }

  // Nose bridge
  const brPts = [
    new THREE.Vector3(-0.019 * hs, cy + 0.004 * hs, cz + 0.003 * hs),
    new THREE.Vector3(0, cy + 0.010 * hs, cz + 0.005 * hs),
    new THREE.Vector3(0.019 * hs, cy + 0.004 * hs, cz + 0.003 * hs),
  ];
  gGroup.add(tagSlot(new THREE.Mesh(makeTaperedTube(THREE, new THREE.CatmullRomCurve3(brPts), 8, 12, () => tubeR * 0.9), frameMat), 'accent'));

  return gGroup;
}

// ---------- Hair System (10 Distinct Styles) ----------

function makeHairLock(THREE, pts, widths, thicknesses, segs = 14) {
  const curve = new THREE.CatmullRomCurve3(pts);
  return makeTaperedTube(THREE, curve, 8, segs, (t, ang) => {
    // Interpolate width & thickness arrays
    const wf = t * (widths.length - 1);
    const wi = Math.min(widths.length - 2, Math.floor(wf));
    const w = lerp(widths[wi], widths[wi + 1], wf - wi);

    const tf = t * (thicknesses.length - 1);
    const ti = Math.min(thicknesses.length - 2, Math.floor(tf));
    const th = lerp(thicknesses[ti], thicknesses[ti + 1], tf - ti);

    // Subtle central crest ridge on outer face of lock so light catches sculpted strands
    const ridge = 1 + 0.14 * Math.cos(ang * 2);
    return [w * ridge, th, 0, -th * 0.15];
  }, { capStart: true, capEnd: true });
}

function buildHairGroup(THREE, opts, kit, dims, evalHead) {
  const { hs } = dims;
  const style = opts.hairStyle || 'bob';
  const hairGroup = new THREE.Group();
  hairGroup.name = 'hair';

  const { map: hairMap, bump: hairBump } = makeHairTextures(THREE, kit, opts.hairColor);
  const hairMat = new THREE.MeshPhysicalMaterial({
    map: hairMap,
    bumpMap: hairBump,
    bumpScale: style === 'buzz' ? 0.0038 : 0.0025,
    roughness: style === 'buzz' ? 0.92 : 0.62,
    metalness: 0.0,
    sheen: 0.78,
    sheenRoughness: 0.45,
    sheenColor: shiftColor(THREE, opts.hairColor, 0.28, -0.05),
    clearcoat: style === 'buzz' ? 0.0 : 0.16,
    clearcoatRoughness: 0.42,
  });

  const tieMat = new THREE.MeshPhysicalMaterial({
    color: opts.accent,
    roughness: 0.85,
    sheen: 0.8,
    sheenColor: shiftColor(THREE, opts.accent, 0.2),
  });

  // 1. Hair cap hugging skull with sculpted visible hairline
  const capOffset = style === 'buzz' ? 0.0065 * hs : 0.011 * hs;
  const capGeo = buildParametricGrid(THREE, 24, 44, (u, v) => {
    const theta = (u - 0.5) * Math.PI * 2;
    const absT = Math.abs(theta);
    // Hairline latitude varies cleanly around head: higher on forehead, dips at temples/sideburns, low at nape
    let minPhi;
    if (absT < 0.95) {
      // Forehead hairline with subtle natural curve
      const k = absT / 0.95;
      minPhi = lerp(style === 'buzz' ? 0.40 : 0.36, 0.24, k * k);
    } else if (absT < 1.48) {
      // Sideburn dip in front of ear
      const k = (absT - 0.95) / 0.53;
      minPhi = lerp(0.24, -0.10, smoothstep(0, 1, k));
    } else if (absT < 1.85) {
      // Arch cleanly over top of ear
      const k = (absT - 1.48) / 0.37;
      minPhi = lerp(-0.10, 0.02, Math.sin(k * Math.PI));
    } else {
      // Down to nape of neck
      const k = (absT - 1.85) / (Math.PI - 1.85);
      minPhi = lerp(-0.08, style === 'buzz' ? -0.44 : -0.48, smoothstep(0, 1, k));
    }

    const phi = lerp(minPhi, Math.PI * 0.495, v);
    const edgeTaper = smoothstep(0, 0.14, v);
    const off = capOffset * (0.35 + 0.65 * edgeTaper);
    const p = evalHead(theta, phi, off);
    return [p[0], p[1] + dims.headCenterLocalY, p[2]];
  }, true, false, false);

  hairGroup.add(tagSlot(new THREE.Mesh(capGeo, hairMat), 'fur'));

  // Helper to get head point in headGroup local coordinates
  const hp = (theta, phi, off = 0.014 * hs) => {
    const p = evalHead(theta, phi, off);
    return new THREE.Vector3(p[0], p[1] + dims.headCenterLocalY, p[2]);
  };

  const addLock = (pts, widths, thicknesses, segs = 14) => {
    const mesh = tagSlot(new THREE.Mesh(makeHairLock(THREE, pts, widths, thicknesses, segs), hairMat), 'fur');
    hairGroup.add(mesh);
    return mesh;
  };

  if (style === 'buzz') {
    // Crisp micro-tapered temple sideburn accents only
    for (const side of [1, -1]) {
      const p0 = hp(side * 1.25, 0.16, 0.006 * hs);
      const p1 = hp(side * 1.32, 0.02, 0.005 * hs);
      const p2 = hp(side * 1.35, -0.11, 0.003 * hs);
      addLock([p0, p1, p2], [0.011 * hs, 0.009 * hs, 0.003 * hs], [0.004 * hs, 0.0035 * hs, 0.002 * hs], 8);
    }
    return hairGroup;
  }

  // Helper for common soft bangs across forehead
  const addFringe = (count, lenScale, sweep = 0, partShift = 0) => {
    for (let i = 0; i < count; i++) {
      const f = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
      const thStart = f * 0.65 + partShift;
      const thEnd = thStart + sweep * (0.28 + 0.12 * Math.abs(f));
      const root = hp(thStart, 0.72, 0.016 * hs);
      const mid1 = hp(lerp(thStart, thEnd, 0.45), 0.44, 0.026 * hs);
      const mid2 = hp(lerp(thStart, thEnd, 0.8), 0.24 - 0.08 * lenScale, 0.024 * hs);
      const tip = hp(thEnd, 0.14 - 0.12 * lenScale + Math.abs(f) * 0.05, 0.017 * hs);
      const w = (0.026 - Math.abs(f) * 0.004) * hs;
      addLock([root, mid1, mid2, tip], [w * 0.8, w * 1.15, w * 0.9, 0.003 * hs], [0.009 * hs, 0.012 * hs, 0.009 * hs, 0.002 * hs], 12);
    }
  };

  if (style === 'short') {
    // 24 lively choppy layered short locks around crown, sides, nape + textured bangs
    addFringe(6, 0.85, 0.18);
    const ring1 = 10;
    for (let i = 0; i < ring1; i++) {
      const th = -Math.PI + ((i + 0.5) / ring1) * Math.PI * 2;
      if (Math.abs(th) < 0.72) continue;
      const root = hp(th, 0.95, 0.018 * hs);
      const mid = hp(th + Math.sin(i * 2.1) * 0.06, 0.35, 0.028 * hs);
      const tip = hp(th + Math.sin(i * 3.1) * 0.09, -0.18 - (i % 3) * 0.09, 0.020 * hs);
      addLock([root, mid, tip], [0.028 * hs, 0.036 * hs, 0.005 * hs], [0.011 * hs, 0.014 * hs, 0.003 * hs], 12);
    }
    const ring2 = 10;
    for (let i = 0; i < ring2; i++) {
      const th = lerp(-Math.PI, Math.PI, (i + 0.5) / ring2);
      if (Math.abs(th) < 1.05) continue;
      const root = hp(th, 0.18, 0.018 * hs);
      const mid = hp(th, -0.24, 0.024 * hs);
      const tip = hp(th + (i % 2 === 0 ? 0.08 : -0.08), -0.58, 0.015 * hs);
      addLock([root, mid, tip], [0.024 * hs, 0.028 * hs, 0.004 * hs], [0.010 * hs, 0.011 * hs, 0.003 * hs], 10);
    }
  } else if (style === 'bob') {
    // 26 sleek chin-length inward-curving locks forming a crisp vinyl-bob bell silhouette
    addFringe(6, 0.95, 0.10);
    const nLocks = 20;
    for (let i = 0; i < nLocks; i++) {
      const th = -Math.PI + ((i + 0.5) / nLocks) * Math.PI * 2;
      if (Math.abs(th) < 0.68) continue;
      const isSide = Math.abs(th) < 1.65;
      const root = hp(th, 1.05, 0.018 * hs);
      const upper = hp(th, 0.42, 0.030 * hs);
      const bell = hp(th, -0.18, (isSide ? 0.040 : 0.036) * hs);
      const tuck = hp(th * (isSide ? 0.92 : 1.0), -0.68, (isSide ? 0.024 : 0.028) * hs);
      const tip = hp(th * (isSide ? 0.85 : 1.0), -0.84, 0.012 * hs);
      tip.y = dims.headCenterLocalY - 0.185 * hs;
      addLock(
        [root, upper, bell, tuck, tip],
        [0.026 * hs, 0.036 * hs, 0.038 * hs, 0.028 * hs, 0.005 * hs],
        [0.011 * hs, 0.014 * hs, 0.015 * hs, 0.011 * hs, 0.003 * hs],
        16
      );
    }
  } else if (style === 'longStraight') {
    // 28+ long smooth cascading locks reaching mid-back + soft face-framing locks
    addFringe(6, 0.92, 0.14);
    const nLocks = 22;
    for (let i = 0; i < nLocks; i++) {
      const th = -Math.PI + ((i + 0.5) / nLocks) * Math.PI * 2;
      if (Math.abs(th) < 0.62) continue;
      const isFront = Math.abs(th) < 1.35;
      const len = (isFront ? 0.25 : 0.38 + 0.04 * Math.sin(i * 1.7)) * hs;
      const root = hp(th, 1.05, 0.017 * hs);
      const mid1 = hp(th, 0.35, 0.030 * hs);
      const mid2 = hp(th, -0.25, 0.036 * hs);
      const hang1 = new THREE.Vector3(
        mid2.x * (isFront ? 1.02 : 1.06),
        mid2.y - len * 0.48,
        mid2.z - (isFront ? -0.01 : 0.025) * hs
      );
      const tip = new THREE.Vector3(
        mid2.x * (isFront ? 0.96 : 1.02),
        mid2.y - len,
        mid2.z - (isFront ? -0.015 : 0.042) * hs
      );
      addLock(
        [root, mid1, mid2, hang1, tip],
        [0.026 * hs, 0.035 * hs, 0.036 * hs, 0.028 * hs, 0.005 * hs],
        [0.011 * hs, 0.014 * hs, 0.013 * hs, 0.010 * hs, 0.003 * hs],
        18
      );
    }
  } else if (style === 'longWavy') {
    // 28+ lush undulating S-wave locks cascading down shoulders & back
    addFringe(6, 0.95, 0.22);
    const nLocks = 22;
    for (let i = 0; i < nLocks; i++) {
      const th = -Math.PI + ((i + 0.5) / nLocks) * Math.PI * 2;
      if (Math.abs(th) < 0.62) continue;
      const isFront = Math.abs(th) < 1.35;
      const phase = i * 1.3;
      const len = (isFront ? 0.26 : 0.39) * hs;
      const root = hp(th, 1.05, 0.018 * hs);
      const p1 = hp(th, 0.36, 0.034 * hs);
      const p2 = hp(th, -0.22, 0.044 * hs);
      const waveAmp = 0.022 * hs;
      const nx = Math.sin(th), nz = Math.cos(th);
      const p3 = new THREE.Vector3(
        p2.x + nx * (0.018 * hs + Math.sin(phase) * waveAmp),
        p2.y - len * 0.32,
        p2.z + nz * (0.015 * hs + Math.sin(phase) * waveAmp) - (isFront ? 0 : 0.022 * hs)
      );
      const p4 = new THREE.Vector3(
        p2.x + nx * (0.008 * hs - Math.sin(phase) * waveAmp),
        p2.y - len * 0.68,
        p2.z + nz * (0.005 * hs - Math.sin(phase) * waveAmp) - (isFront ? 0 : 0.036 * hs)
      );
      const tip = new THREE.Vector3(
        p2.x + nx * (0.020 * hs + Math.sin(phase) * waveAmp * 0.8),
        p2.y - len,
        p2.z + nz * (0.012 * hs) - (isFront ? 0 : 0.044 * hs)
      );
      addLock(
        [root, p1, p2, p3, p4, tip],
        [0.026 * hs, 0.036 * hs, 0.040 * hs, 0.035 * hs, 0.026 * hs, 0.006 * hs],
        [0.012 * hs, 0.016 * hs, 0.016 * hs, 0.014 * hs, 0.011 * hs, 0.003 * hs],
        20
      );
    }
  } else if (style === 'curly') {
    // 32+ voluminous coiled spiral ringlets creating a lively sculpted curl silhouette
    const nCurls = 32;
    for (let i = 0; i < nCurls; i++) {
      const layer = i < 12 ? 0 : i < 24 ? 1 : 2;
      const idxInLayer = layer === 0 ? i : layer === 1 ? i - 12 : i - 24;
      const layerCount = layer === 0 ? 12 : layer === 1 ? 12 : 8;
      const th = -Math.PI + ((idxInLayer + 0.5 + layer * 0.35) / layerCount) * Math.PI * 2;
      if (layer === 1 && Math.abs(th) < 0.62) continue;
      if (layer === 2 && Math.abs(th) < 0.85) continue;

      const basePhi = layer === 0 ? 0.78 : layer === 1 ? 0.25 : -0.22;
      const anchor = hp(th, basePhi, 0.022 * hs);
      const nx = Math.sin(th), nz = Math.cos(th);
      const curlPts = [];
      const turns = layer === 0 ? 1.4 : 2.0;
      const drop = (layer === 0 ? 0.09 : layer === 1 ? 0.16 : 0.19) * hs;
      const rSpiral = (0.024 + (i % 3) * 0.005) * hs;
      const dir = i % 2 === 0 ? 1 : -1;

      for (let s = 0; s <= 6; s++) {
        const f = s / 6;
        const a = f * Math.PI * 2 * turns * dir + i;
        const radialOut = (0.018 + Math.sin(f * Math.PI) * 0.032) * hs;
        curlPts.push(new THREE.Vector3(
          anchor.x + nx * radialOut + Math.cos(a) * rSpiral,
          anchor.y - f * drop + Math.sin(f * Math.PI) * 0.012 * hs,
          anchor.z + nz * radialOut + Math.sin(a) * rSpiral
        ));
      }
      addLock(curlPts, [0.024 * hs, 0.032 * hs, 0.030 * hs, 0.014 * hs], [0.022 * hs, 0.028 * hs, 0.024 * hs, 0.010 * hs], 16);
    }
  } else if (style === 'ponytail') {
    // Sleek pulled-back crown + sculpted scrunchie + 20 cascading ponytail locks + front wisps
    addFringe(5, 0.78, 0.25);
    // Side framing wisps
    for (const side of [1, -1]) {
      const p0 = hp(side * 0.92, 0.35, 0.018 * hs);
      const p1 = hp(side * 0.98, -0.05, 0.022 * hs);
      const p2 = hp(side * 0.88, -0.45, 0.018 * hs);
      addLock([p0, p1, p2], [0.015 * hs, 0.016 * hs, 0.004 * hs], [0.007 * hs, 0.007 * hs, 0.002 * hs], 10);
    }
    const tiePos = hp(Math.PI, 0.42, 0.026 * hs);
    const scrunchie = tagSlot(new THREE.Mesh(new THREE.TorusGeometry(0.030 * hs, 0.013 * hs, 12, 24), tieMat), 'furAccent');
    scrunchie.position.copy(tiePos);
    scrunchie.rotation.x = 0.65;
    hairGroup.add(scrunchie);

    // 20 sweeping ponytail locks arching up & cascading down
    const tailGroup = new THREE.Group();
    tailGroup.name = 'ponytailSwing';
    tailGroup.position.copy(tiePos);
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const ring = i < 12 ? 1.0 : 0.55;
      const sx = Math.cos(a) * 0.022 * hs * ring;
      const sy = Math.sin(a) * 0.018 * hs * ring;
      const spreadX = Math.cos(a) * (0.065 * ring + 0.015) * hs;
      const spreadZ = -(0.115 + Math.sin(a) * 0.032 * ring + 0.025 * ring) * hs;
      const len = (0.31 + (i % 4) * 0.025) * hs;

      const pts = [
        new THREE.Vector3(sx * 0.5, sy * 0.5, 0.01 * hs),
        new THREE.Vector3(sx * 1.4, sy + 0.045 * hs, -0.055 * hs),
        new THREE.Vector3(spreadX, -len * 0.25, spreadZ),
        new THREE.Vector3(spreadX * 1.05, -len * 0.68, spreadZ - 0.022 * hs),
        new THREE.Vector3(spreadX * 0.72, -len, spreadZ - 0.005 * hs),
      ];
      const lock = tagSlot(new THREE.Mesh(
        makeHairLock(THREE, pts, [0.020 * hs, 0.030 * hs, 0.028 * hs, 0.018 * hs, 0.004 * hs], [0.010 * hs, 0.014 * hs, 0.012 * hs, 0.008 * hs, 0.002 * hs], 16),
        hairMat
      ), 'fur');
      tailGroup.add(lock);
    }
    hairGroup.add(tailGroup);
  } else if (style === 'bun') {
    // Swept-up crown + tall sculpted twisted top-bun built from 14 wrapped locks + wisps
    addFringe(5, 0.72, 0.2);
    for (const side of [1, -1]) {
      const p0 = hp(side * 0.95, 0.32, 0.018 * hs);
      const p1 = hp(side * 1.02, -0.08, 0.020 * hs);
      const p2 = hp(side * 0.90, -0.40, 0.016 * hs);
      addLock([p0, p1, p2], [0.014 * hs, 0.015 * hs, 0.004 * hs], [0.006 * hs, 0.006 * hs, 0.002 * hs], 10);
    }
    const bunCenter = hp(Math.PI, 0.98, 0.052 * hs);
    const tie = tagSlot(new THREE.Mesh(new THREE.TorusGeometry(0.052 * hs, 0.012 * hs, 12, 24), tieMat), 'furAccent');
    tie.position.set(bunCenter.x, bunCenter.y - 0.036 * hs, bunCenter.z + 0.018 * hs);
    tie.rotation.x = Math.PI * 0.5 + 0.42;
    hairGroup.add(tie);

    // Sculpted core inside wrapped bun locks
    const bunCore = tagSlot(new THREE.Mesh(new THREE.SphereGeometry(0.068 * hs, 24, 18), hairMat), 'fur');
    bunCore.scale.set(1.08, 0.92, 1.04);
    bunCore.position.copy(bunCenter);
    hairGroup.add(bunCore);

    // 14 twisted locks wrapping tightly around the bun
    for (let i = 0; i < 14; i++) {
      const a0 = (i / 14) * Math.PI * 2;
      const pts = [];
      for (let s = 0; s <= 5; s++) {
        const f = s / 5;
        const a = a0 + f * 1.55;
        const lat = lerp(-0.55, 1.15, f);
        const r = 0.072 * hs * Math.cos(lat * 0.75);
        pts.push(new THREE.Vector3(
          bunCenter.x + Math.cos(a) * r,
          bunCenter.y + Math.sin(lat) * 0.062 * hs,
          bunCenter.z + Math.sin(a) * r
        ));
      }
      addLock(pts, [0.022 * hs, 0.028 * hs, 0.022 * hs, 0.008 * hs], [0.012 * hs, 0.014 * hs, 0.011 * hs, 0.004 * hs], 12);
    }
  } else if (style === 'pixie') {
    // Tapered sleek cropped back/sides + bold feathery asymmetric swept fringe (20 locks)
    for (let i = 0; i < 9; i++) {
      const f = i / 8;
      const thStart = lerp(-0.62, 0.85, f);
      const thEnd = thStart + 0.48;
      const root = hp(thStart, 0.88 - f * 0.18, 0.016 * hs);
      const mid = hp(lerp(thStart, thEnd, 0.55), 0.44 - f * 0.14, 0.029 * hs);
      const tip = hp(thEnd, 0.12 - (1 - f) * 0.18, 0.020 * hs);
      addLock([root, mid, tip], [0.022 * hs, 0.030 * hs, 0.004 * hs], [0.009 * hs, 0.012 * hs, 0.002 * hs], 12);
    }
    for (let i = 0; i < 12; i++) {
      const th = lerp(-Math.PI, Math.PI, (i + 0.5) / 12);
      if (Math.abs(th) < 1.1) continue;
      const root = hp(th, 0.48, 0.016 * hs);
      const mid = hp(th, 0.02, 0.020 * hs);
      const tip = hp(th + 0.08, -0.45, 0.012 * hs);
      addLock([root, mid, tip], [0.022 * hs, 0.024 * hs, 0.004 * hs], [0.008 * hs, 0.009 * hs, 0.002 * hs], 10);
    }
  } else if (style === 'sidePart') {
    // Deep asymmetric side part (+X side) with high sweeping wave across forehead + tucked opposite side (24 locks)
    const partTh = 0.52;
    // Dramatic sweeping side fringe from part toward -X
    for (let i = 0; i < 9; i++) {
      const f = i / 8;
      const root = hp(partTh - f * 0.12, 0.85 - f * 0.16, 0.018 * hs);
      const lift = hp(partTh - 0.35 - f * 0.25, 0.62 - f * 0.18, 0.038 * hs);
      const sweep = hp(-0.25 - f * 0.72, 0.18 - f * 0.26, 0.034 * hs);
      const tip = hp(-0.68 - f * 0.55, -0.34 - f * 0.16, 0.022 * hs);
      addLock([root, lift, sweep, tip], [0.024 * hs, 0.034 * hs, 0.030 * hs, 0.005 * hs], [0.010 * hs, 0.015 * hs, 0.012 * hs, 0.003 * hs], 14);
    }
    // Neatly tucked +X side & layered back
    for (let i = 0; i < 15; i++) {
      const th = lerp(partTh + 0.12, Math.PI * 2 - 0.85, i / 14);
      const wrappedTh = th > Math.PI ? th - Math.PI * 2 : th;
      const root = hp(wrappedTh, 0.92, 0.018 * hs);
      const mid = hp(wrappedTh, 0.26, 0.028 * hs);
      const low = hp(wrappedTh, -0.32, 0.026 * hs);
      const tip = hp(wrappedTh, -0.62, 0.014 * hs);
      addLock([root, mid, low, tip], [0.025 * hs, 0.032 * hs, 0.028 * hs, 0.005 * hs], [0.010 * hs, 0.013 * hs, 0.011 * hs, 0.003 * hs], 14);
    }
  }

  return hairGroup;
}

// ---------- Arms, Hands, Legs, Shoes ----------

function buildArmGroup(THREE, side, dims, mats) {
  const { bw, bh, armLen } = dims;
  const armGroup = new THREE.Group();
  armGroup.name = side > 0 ? 'armL' : 'armR';
  armGroup.position.set(side * dims.shoulderX, dims.shoulderY, 0);

  // Continuous curved arm with deltoid overlap, elbow bend, forearm taper
  const armPts = [
    new THREE.Vector3(-side * 0.024 * bw, 0.010, -0.002),
    new THREE.Vector3(side * 0.016 * bw, -0.028 * bh, -0.003),
    new THREE.Vector3(side * 0.034 * bw, -armLen * 0.49, -0.012),
    new THREE.Vector3(side * 0.030 * bw, -armLen * 0.78, 0.012),
    new THREE.Vector3(side * 0.024 * bw, -armLen, 0.034),
  ];
  const armCurve = new THREE.CatmullRomCurve3(armPts);
  armGroup.userData.curve = armCurve;

  const armGeo = makeTaperedTube(THREE, armCurve, 18, 28, (t) => {
    let r;
    if (t < 0.20) {
      r = lerp(0.044, 0.038, smoothstep(0, 0.20, t));
    } else if (t < 0.50) {
      r = lerp(0.038, 0.031, smoothstep(0.20, 0.50, t));
    } else if (t < 0.68) {
      r = lerp(0.031, 0.033, smoothstep(0.50, 0.68, t));
    } else {
      r = lerp(0.033, 0.021, smoothstep(0.68, 1.0, t));
    }
    const rx = r * bw;
    const rz = r * bw * lerp(1.02, 1.12, t);
    return [rx, rz];
  });
  armGroup.add(tagSlot(new THREE.Mesh(armGeo, mats.skin), 'skin'));

  // Sculpted hand: continuous palm + 4-finger grooved mitten + articulated thumb
  const handG = new THREE.Group();
  handG.name = side > 0 ? 'handL' : 'handR';
  const wristP = armCurve.getPoint(1);
  handG.position.copy(wristP);
  handG.rotation.x = -0.22;
  handG.rotation.z = -side * 0.08;

  const hScale = 0.85 + 0.15 * bw;
  const handGeo = buildParametricGrid(THREE, 22, 26, (u, v) => {
    // v = 0 fingertip bottom -> v = 1 wrist top
    const ang = (u - 0.5) * Math.PI * 2;
    const phi = lerp(-Math.PI * 0.49, Math.PI * 0.49, v);
    const cp = Math.cos(phi);
    const sp = Math.sin(phi);
    const ux = cp * Math.sin(ang);
    const uy = sp;
    const uz = cp * Math.cos(ang);

    let x = ux * 0.017 * hScale;
    let y = (uy - 0.72) * 0.044 * hScale;
    let z = uz * 0.030 * hScale;

    // Taper smoothly toward wrist (top) and round fingertips (bottom)
    const fingerZone = smoothstep(0.05, -0.82, uy);
    // Natural fingertip arch (middle finger slightly longer, pinky shorter)
    const fingerArch = Math.cos((uz - 0.12) * 1.45);
    y -= fingerZone * fingerArch * 0.007 * hScale;

    // Shallow sculpted finger grooves along the 4 grouped fingers
    const grooveMask = smoothstep(0.02, -0.45, uy) * smoothstep(-0.96, -0.68, uy);
    const g1 = gauss(uz - 0.42, 0.10);
    const g2 = gauss(uz - 0.02, 0.10);
    const g3 = gauss(uz + 0.38, 0.10);
    const groove = (g1 + g2 + g3) * grooveMask;
    x *= 1 - groove * 0.22;

    // Gentle natural inward curl of palm & fingers toward body (-side X)
    x -= side * Math.pow(smoothstep(0.25, -0.95, uy), 1.6) * 0.011 * hScale;

    return [x, y, z];
  }, true, false, false);
  handG.add(tagSlot(new THREE.Mesh(handGeo, mats.skin), 'skin'));

  // Articulated thumb emerging from inner-front palm
  const thumbPts = [
    new THREE.Vector3(-side * 0.004 * hScale, -0.014 * hScale, 0.018 * hScale),
    new THREE.Vector3(-side * 0.013 * hScale, -0.030 * hScale, 0.031 * hScale),
    new THREE.Vector3(-side * 0.017 * hScale, -0.046 * hScale, 0.027 * hScale),
  ];
  const thumbGeo = makeTaperedTube(THREE, new THREE.CatmullRomCurve3(thumbPts), 10, 10, (t) => lerp(0.0095, 0.0062, t) * hScale);
  handG.add(tagSlot(new THREE.Mesh(thumbGeo, mats.skin), 'skin'));

  armGroup.add(handG);
  return armGroup;
}

function buildLegGroup(THREE, side, opts, dims, mats) {
  const { bw, legLen } = dims;
  const legGroup = new THREE.Group();
  legGroup.name = side > 0 ? 'legL' : 'legR';
  legGroup.position.set(side * dims.hipX, dims.hipY, 0);

  // Continuous sculpted leg: hip overlap -> thigh -> knee -> calf -> ankle
  const legPts = [
    new THREE.Vector3(-side * 0.004, 0.034, 0.0),
    new THREE.Vector3(0, -legLen * 0.28, 0.005),
    new THREE.Vector3(0, -legLen * 0.52, 0.007),
    new THREE.Vector3(0, -legLen * 0.74, -0.006),
    new THREE.Vector3(0, -legLen - 0.018, 0.0),
  ];
  const legCurve = new THREE.CatmullRomCurve3(legPts);
  legGroup.userData.curve = legCurve;

  const legGeo = makeTaperedTube(THREE, legCurve, 20, 28, (t, ang) => {
    let rx, rz;
    if (t < 0.48) {
      const k = smoothstep(0.05, 0.48, t);
      rx = lerp(0.054, 0.039, k) * bw;
      rz = lerp(0.056, 0.040, k) * bw;
    } else if (t < 0.70) {
      const k = smoothstep(0.48, 0.70, t);
      rx = lerp(0.039, 0.041, k) * bw;
      rz = lerp(0.040, 0.043, k) * bw;
    } else {
      const k = smoothstep(0.70, 0.96, t);
      rx = lerp(0.041, 0.025, k) * bw;
      rz = lerp(0.043, 0.028, k) * bw;
    }
    // Subtle knee cap & gastrocnemius calf fullness
    const kneeBump = gauss(t - 0.50, 0.055) * Math.max(0, Math.sin(ang)) * 0.003 * bw;
    const calfBack = gauss(t - 0.68, 0.09) * Math.max(0, -Math.sin(ang)) * 0.0055 * bw;
    return [rx, rz + kneeBump + calfBack];
  }, { initNormal: new THREE.Vector3(1, 0, 0) });

  legGroup.add(tagSlot(new THREE.Mesh(legGeo, mats.skin), 'skin'));

  // Subtle cozy sock cuff above ankle (for sneakers/loafers)
  if (opts.shoes !== 'boots') {
    const sockMat = new THREE.MeshPhysicalMaterial({ color: '#f3efe8', roughness: 0.92, sheen: 0.8, sheenColor: '#ffffff' });
    const sockGeo = new THREE.CylinderGeometry(0.0275 * bw, 0.0285 * bw, 0.052, 18);
    const sock = tagSlot(new THREE.Mesh(sockGeo, sockMat), 'accent');
    sock.position.set(0, -legLen + 0.015, 0.0);
    legGroup.add(sock);
  }

  // Sculpted Shoes resting flush on y = 0 (local y = -dims.hipY)
  legGroup.add(buildShoe(THREE, side, opts, dims, mats));

  return legGroup;
}

function buildShoe(THREE, side, opts, dims) {
  const { bw, hipY } = dims;
  const shoeG = new THREE.Group();
  shoeG.name = side > 0 ? 'shoeL' : 'shoeR';
  shoeG.position.set(0, -hipY, 0.026);

  const sW = 0.048 * (0.86 + 0.14 * bw);
  const sL = 0.088 * (0.92 + 0.08 * bw);
  const style = opts.shoes || 'sneakers';

  const upperMat = new THREE.MeshPhysicalMaterial({
    color: opts.shoeColor,
    roughness: style === 'loafers' ? 0.36 : style === 'boots' ? 0.55 : 0.72,
    clearcoat: style === 'loafers' ? 0.45 : style === 'boots' ? 0.15 : 0.05,
    sheen: style === 'sneakers' ? 0.5 : 0.1,
  });
  const soleColor = style === 'sneakers' ? '#f4f0e8' : '#262322';
  const soleMat = new THREE.MeshPhysicalMaterial({
    color: soleColor,
    roughness: 0.85,
  });
  const accentMat = new THREE.MeshPhysicalMaterial({
    color: opts.accent,
    roughness: 0.65,
  });
  const laceMat = new THREE.MeshPhysicalMaterial({
    color: style === 'boots' ? '#3a322d' : '#f7f4ee',
    roughness: 0.9,
  });

  // 1. Sculpted sole profile resting flat at y = 0
  const soleShape = new THREE.Shape();
  soleShape.moveTo(0, -sL * 0.78);
  soleShape.bezierCurveTo(sW * 0.95, -sL * 0.78, sW * 1.02, -sL * 0.15, sW * 1.05, sL * 0.35);
  soleShape.bezierCurveTo(sW * 1.04, sL * 0.88, sW * 0.45, sL * 1.05, 0, sL * 1.05);
  soleShape.bezierCurveTo(-sW * 0.45, sL * 1.05, -sW * 1.04, sL * 0.88, -sW * 1.05, sL * 0.35);
  soleShape.bezierCurveTo(-sW * 1.02, -sL * 0.15, -sW * 0.95, -sL * 0.78, 0, -sL * 0.78);

  const soleH = style === 'boots' ? 0.022 : style === 'loafers' ? 0.015 : 0.018;
  const soleGeo = new THREE.ExtrudeGeometry(soleShape, {
    depth: soleH,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
    curveSegments: 20,
  });
  soleGeo.rotateX(Math.PI * 0.5);
  // Shift so sole bottom sits cleanly at y = 0
  soleGeo.computeBoundingBox();
  soleGeo.translate(0, -soleGeo.boundingBox.min.y, 0);
  shoeG.add(tagSlot(new THREE.Mesh(soleGeo, soleMat), 'accent'));

  // 2. Sculpted Shoe Upper (continuous displaced dome matching footprint)
  const upperH = style === 'loafers' ? 0.044 : 0.056;
  const upperGeo = buildParametricGrid(THREE, 18, 28, (u, v) => {
    const ang = (u - 0.5) * Math.PI * 2;
    const st = Math.sin(ang);
    const ct = Math.cos(ang);
    const hFrac = v;
    const widthProfile = lerp(1.0, 0.58, Math.pow(hFrac, 1.4));
    const x = st * sW * 0.98 * widthProfile;
    let z = ct * sL * (ct > 0 ? 0.98 : 0.74) * lerp(1.0, 0.55, Math.pow(hFrac, 1.5));
    // Shift ankle collar toward heel (-Z)
    z -= hFrac * 0.024;
    let y = soleH * 0.85 + Math.sin(hFrac * Math.PI * 0.5) * upperH;
    // Lower the toe vamp smoothly in front (+Z)
    const toeMask = smoothstep(0.05, 0.9, ct);
    y -= toeMask * Math.pow(hFrac, 1.1) * upperH * (style === 'loafers' ? 0.45 : 0.34);
    return [x, y, z];
  }, true, false, true);
  shoeG.add(tagSlot(new THREE.Mesh(upperGeo, upperMat), 'accent'));

  if (style === 'sneakers') {
    // Toe cap
    const capGeo = new THREE.SphereGeometry(sW * 0.96, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55);
    capGeo.scale(0.98, 0.62, 0.92);
    const cap = tagSlot(new THREE.Mesh(capGeo, soleMat), 'accent');
    cap.position.set(0, soleH * 0.95, sL * 0.44);
    shoeG.add(cap);

    // Raised curved tongue
    const tShape = new THREE.Shape();
    tShape.moveTo(-sW * 0.42, 0);
    tShape.lineTo(sW * 0.42, 0);
    tShape.quadraticCurveTo(sW * 0.46, 0.042, 0, 0.048);
    tShape.quadraticCurveTo(-sW * 0.46, 0.042, -sW * 0.42, 0);
    const tGeo = new THREE.ExtrudeGeometry(tShape, { depth: 0.005, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2 });
    tGeo.center();
    const tongue = tagSlot(new THREE.Mesh(tGeo, upperMat), 'accent');
    tongue.position.set(0, soleH + 0.044, 0.006);
    tongue.rotation.x = 0.55;
    shoeG.add(tongue);

    // Criss-cross laces + bow loops
    for (let i = 0; i < 3; i++) {
      const ly = soleH + 0.028 + i * 0.011;
      const lz = 0.036 - i * 0.014;
      const lw = sW * (0.48 - i * 0.04);
      const lPts = [
        new THREE.Vector3(-lw, ly, lz),
        new THREE.Vector3(0, ly + 0.005, lz + 0.004),
        new THREE.Vector3(lw, ly, lz),
      ];
      shoeG.add(new THREE.Mesh(makeTaperedTube(THREE, new THREE.CatmullRomCurve3(lPts), 6, 10, () => 0.0026), laceMat));
    }
    // Small sneaker lace bow
    for (const bs of [1, -1]) {
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.0085, 0.0024, 8, 16), laceMat);
      bow.position.set(bs * 0.009, soleH + 0.056, 0.002);
      bow.rotation.set(0.5, bs * 0.4, bs * 0.35);
      shoeG.add(bow);
    }

    // Side accent stripe
    for (const ss of [1, -1]) {
      const sPts = [
        new THREE.Vector3(ss * sW * 0.94, soleH + 0.018, -0.025),
        new THREE.Vector3(ss * sW * 0.97, soleH + 0.025, 0.005),
        new THREE.Vector3(ss * sW * 0.88, soleH + 0.016, 0.034),
      ];
      shoeG.add(tagSlot(new THREE.Mesh(makeTaperedTube(THREE, new THREE.CatmullRomCurve3(sPts), 6, 10, () => 0.0032), accentMat), 'accent'));
    }
  } else if (style === 'boots') {
    // High sculpted boot shaft rising up the lower calf + padded cuff + laces + pull tab
    const shaftGeo = buildThickShell(THREE, 12, 22, (u, v) => {
      const ang = (u - 0.5) * Math.PI * 2;
      const r = lerp(0.036, 0.042, v) * (0.85 + 0.15 * bw);
      const x = Math.sin(ang) * r;
      const z = Math.cos(ang) * r * 1.08 - 0.024;
      const y = soleH + 0.035 + v * 0.095;
      return [x, y, z];
    }, 0.005, true);
    shoeG.add(tagSlot(new THREE.Mesh(shaftGeo, upperMat), 'accent'));

    // Padded cuff rim
    const cuff = tagSlot(new THREE.Mesh(new THREE.TorusGeometry(0.041 * (0.85 + 0.15 * bw), 0.0075, 10, 22), accentMat), 'accent');
    cuff.rotation.x = Math.PI * 0.5;
    cuff.position.set(0, soleH + 0.128, -0.024);
    shoeG.add(cuff);

    // Back pull tab
    const tab = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.0025, 8, 14), accentMat);
    tab.position.set(0, soleH + 0.138, -0.064);
    tab.rotation.y = Math.PI * 0.5;
    shoeG.add(tab);

    // Boot laces up shaft
    for (let i = 0; i < 4; i++) {
      const ly = soleH + 0.034 + i * 0.022;
      const lz = 0.028 - i * 0.006;
      const lPts = [
        new THREE.Vector3(-0.017, ly, lz),
        new THREE.Vector3(0, ly + 0.003, lz + 0.005),
        new THREE.Vector3(0.017, ly, lz),
      ];
      shoeG.add(new THREE.Mesh(makeTaperedTube(THREE, new THREE.CatmullRomCurve3(lPts), 6, 8, () => 0.0025), laceMat));
    }
  } else {
    // Loafers: sleek saddle strap across vamp + subtle apron seam ridge
    const strapPts = [
      new THREE.Vector3(-sW * 0.88, soleH + 0.018, 0.018),
      new THREE.Vector3(-sW * 0.52, soleH + 0.040, 0.022),
      new THREE.Vector3(0, soleH + 0.044, 0.024),
      new THREE.Vector3(sW * 0.52, soleH + 0.040, 0.022),
      new THREE.Vector3(sW * 0.88, soleH + 0.018, 0.018),
    ];
    shoeG.add(tagSlot(new THREE.Mesh(
      makeTaperedTube(THREE, new THREE.CatmullRomCurve3(strapPts), 8, 16, () => [0.009, 0.0035]),
      upperMat
    ), 'accent'));
    const penny = tagSlot(new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.004, 0.006), accentMat), 'accent');
    penny.position.set(0, soleH + 0.046, 0.024);
    shoeG.add(penny);
  }

  return shoeG;
}

// ---------- Clothing Builders (Tops, Bottoms, Bags) ----------

function buildClothes(THREE, opts, kit, dims, evalTorso, torsoGroup, armL, armR, legL, legR) {
  const { bw, bh, hipY, legLen } = dims;
  const topStyle = opts.top || 'hoodie';
  const bottomStyle = opts.bottom || 'jeans';

  const topFabricKind =
    topStyle === 'sweater' || topStyle === 'cardigan' ? 'knit' :
    topStyle === 'blazer' ? 'suiting' : 'cotton';
  const topMat = makeFabricMaterial(THREE, kit, opts.topColor, topFabricKind);
  const ribTopMat = makeFabricMaterial(THREE, kit, shiftColor(THREE, opts.topColor, -0.04).getHexString(), 'rib');
  const innerTeeMat = makeFabricMaterial(THREE, kit, '#f3efe6', 'cotton');
  const buttonMat = new THREE.MeshPhysicalMaterial({ color: '#ede4d3', roughness: 0.35, clearcoat: 0.5 });
  const accentMat = makeFabricMaterial(THREE, kit, opts.accent, 'cotton');

  // --- Helper: Sleeves on armL & armR with elbow fold wrinkles ---
  const addSleeves = (endT, easeBase, hasRibCuff, mat) => {
    for (const arm of [armL, armR]) {
      const curve = arm.userData.curve;
      const pts = [];
      const steps = 16;
      for (let i = 0; i <= steps; i++) {
        pts.push(curve.getPoint((i / steps) * endT));
      }
      const subCurve = new THREE.CatmullRomCurve3(pts);
      const sleeveGeo = makeTaperedTube(THREE, subCurve, 18, 22, (t, ang) => {
        const armT = t * endT;
        let baseR;
        if (armT < 0.20) baseR = lerp(0.044, 0.038, smoothstep(0, 0.20, armT));
        else if (armT < 0.50) baseR = lerp(0.038, 0.031, smoothstep(0.20, 0.50, armT));
        else if (armT < 0.68) baseR = lerp(0.031, 0.033, smoothstep(0.50, 0.68, armT));
        else baseR = lerp(0.033, 0.021, smoothstep(0.68, 1.0, armT));

        let ease = easeBase * lerp(1.0, 1.25, smoothstep(0.15, 0.85, armT));
        if (hasRibCuff && t > 0.86) {
          ease = lerp(ease, 0.0055, smoothstep(0.86, 1.0, t));
        }
        // Sculpted elbow wrinkles around armT = 0.50
        const elbowWrinkle = gauss(armT - 0.50, 0.075) * Math.sin(armT * 52 + Math.cos(ang) * 1.6) * 0.0032;
        const r = baseR * bw + ease + elbowWrinkle;
        return [r, r * 1.06];
      }, { capStart: true, capEnd: false });
      arm.add(tagSlot(new THREE.Mesh(sleeveGeo, mat), 'primary'));

      if (hasRibCuff) {
        const cuffP = curve.getPoint(endT * 0.95);
        const cuffTan = curve.getTangent(endT * 0.95);
        const cuffR = 0.023 * bw + 0.007;
        const cuffGeo = new THREE.CylinderGeometry(cuffR * 1.04, cuffR * 0.96, 0.028, 18);
        const cuff = tagSlot(new THREE.Mesh(cuffGeo, ribTopMat), 'primary');
        cuff.position.copy(cuffP);
        cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), cuffTan);
        arm.add(cuff);
      } else {
        // Turned fabric hem ring at sleeve end
        const endP = curve.getPoint(endT);
        const endTan = curve.getTangent(endT);
        const endR = (endT < 0.5 ? 0.034 : 0.023) * bw + easeBase * 1.05;
        const hem = tagSlot(new THREE.Mesh(new THREE.TorusGeometry(endR, 0.0045, 8, 20), mat), 'primary');
        hem.position.copy(endP);
        hem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), endTan);
        arm.add(hem);
      }
    }
  };

  // --- TOPS ---
  const isOpenFront = topStyle === 'cardigan' || topStyle === 'blazer';

  if (isOpenFront) {
    // Inner fitted cream crew-neck tee visible under cardigan / blazer
    const innerGeo = buildThickShell(THREE, 22, 36, (u, v) => {
      const tv = lerp(0.14, 0.85, v);
      return evalTorso(u, tv, () => ({ dr: 0.008 }));
    }, 0.004, true);
    torsoGroup.add(tagSlot(new THREE.Mesh(innerGeo, innerTeeMat), 'accent'));
  }

  const vMinTop = topStyle === 'hoodie' || topStyle === 'blazer' ? 0.09 : 0.13;
  const vMaxTop = 0.85;
  const topEase =
    topStyle === 'hoodie' ? 0.020 :
    topStyle === 'sweater' ? 0.017 :
    topStyle === 'cardigan' || topStyle === 'blazer' ? 0.019 :
    topStyle === 'shirt' ? 0.012 : 0.013;

  if (!isOpenFront) {
    const topGeo = buildThickShell(THREE, 26, 40, (u, v) => {
      const tv = lerp(vMinTop, vMaxTop, v);
      return evalTorso(u, tv, (uu, ttv, theta) => {
        // Relaxed drape + real waist wrinkle folds
        let dr = topEase;
        if (topStyle === 'hoodie' || topStyle === 'sweater') {
          // Slight boxy fill across waist + gentle inward gather at ribbed hem
          dr += gauss(ttv - 0.42, 0.16) * 0.012;
          if (v < 0.12) dr -= smoothstep(0.12, 0.0, v) * 0.008;
        } else {
          dr += gauss(ttv - 0.42, 0.15) * 0.005;
        }
        // Horizontal cloth folds at waist & underarms
        const waistFold = gauss(ttv - 0.36, 0.10) * Math.sin(ttv * 70 + Math.cos(theta * 2) * 1.4) * 0.0032;
        const sideDrape = Math.sin(theta * 4 + ttv * 9) * 0.0018 * (1 - v);
        return { dr: dr + waistFold + sideDrape };
      });
    }, 0.0055, true);
    torsoGroup.add(tagSlot(new THREE.Mesh(topGeo, topMat), 'primary'));
  } else {
    // Open-front cardigan / blazer (wraps around back & sides, leaving V-opening in front +Z)
    const openGeo = buildThickShell(THREE, 26, 40, (u, v) => {
      const tv = lerp(vMinTop, vMaxTop, v);
      // Map u in [0, 1] to theta from +gap (front-left) around back to -gap (front-right)
      const gap = lerp(0.16, topStyle === 'blazer' ? 0.46 : 0.38, smoothstep(0.28, 1.0, v));
      const theta = lerp(gap, Math.PI * 2 - gap, u);
      const mappedU = ((theta / (Math.PI * 2)) + 0.5) % 1;
      return evalTorso(mappedU, tv, (uu, ttv, th) => {
        const waistFold = gauss(ttv - 0.38, 0.10) * Math.sin(ttv * 64 + Math.cos(th) * 1.5) * 0.0028;
        const shoulderPad = topStyle === 'blazer' ? gauss(ttv - 0.76, 0.05) * Math.abs(Math.sin(th)) * 0.010 : 0;
        return { dr: topEase + waistFold + shoulderPad, dy: topStyle === 'blazer' ? shoulderPad * 0.4 : 0 };
      });
    }, 0.0065, false);
    torsoGroup.add(tagSlot(new THREE.Mesh(openGeo, topMat), 'primary'));
  }

  // Top-specific signature details
  if (topStyle === 'hoodie') {
    addSleeves(0.92, 0.014, true, topMat);

    // Ribbed bottom hem band
    const hemGeo = buildThickShell(THREE, 6, 36, (u, v) => {
      const tv = lerp(vMinTop - 0.03, vMinTop + 0.04, v);
      return evalTorso(u, tv, () => ({ dr: 0.015 }));
    }, 0.006, true);
    torsoGroup.add(tagSlot(new THREE.Mesh(hemGeo, ribTopMat), 'primary'));

    // Draped sculpted hood resting naturally around neck & upper back
    const hoodGeo = buildThickShell(THREE, 14, 28, (u, v) => {
      // u around back/sides of neck; v from neck collar out & folded over back
      const ang = lerp(-2.35, 2.35, u); // 0 is -Z back!
      const sinA = Math.sin(ang);
      const cosA = Math.cos(ang);
      const baseR = (0.056 + 0.010 * bw);
      const flare = Math.sin(v * Math.PI * 0.82) * 0.068 * (0.7 + 0.3 * Math.max(0, cosA));
      const r = baseR + flare;
      const x = sinA * r * 1.05;
      const z = -cosA * r - v * 0.048 * Math.max(0.2, cosA) + 0.006;
      const y = dims.neckBaseY - 0.018 + Math.sin(v * Math.PI * 0.65) * 0.068 - Math.pow(v, 2.2) * 0.072 * Math.max(0, cosA);
      return [x, y, z];
    }, 0.007, false);
    torsoGroup.add(tagSlot(new THREE.Mesh(hoodGeo, topMat), 'primary'));

    // Sculpted Kangaroo Pocket on lower front belly
    const pGeo = buildThickShell(THREE, 10, 18, (u, v) => {
      const tv = lerp(0.15, 0.37, v);
      const halfSpan = lerp(0.30, 0.21, smoothstep(0.15, 1.0, v));
      const pu = lerp(0.5 - halfSpan, 0.5 + halfSpan, u);
      const puff = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.012;
      return evalTorso(pu, tv, () => ({ dr: topEase + 0.012 + puff }));
    }, 0.005, false);
    torsoGroup.add(tagSlot(new THREE.Mesh(pGeo, topMat), 'primary'));

    // Drawstrings with tiny metallic aglets
    const stringMat = new THREE.MeshPhysicalMaterial({ color: '#f2ece2', roughness: 0.9 });
    const agletMat = new THREE.MeshPhysicalMaterial({ color: '#b5b8be', roughness: 0.28, metalness: 0.8 });
    for (const ds of [1, -1]) {
      const p0 = evalTorso(0.5 + ds * 0.065, 0.81, () => ({ dr: topEase + 0.005 }));
      const p1 = evalTorso(0.5 + ds * 0.072, 0.68, () => ({ dr: topEase + 0.013 }));
      const p2 = evalTorso(0.5 + ds * 0.062, 0.52, () => ({ dr: topEase + 0.012 }));
      const sPts = [new THREE.Vector3(...p0), new THREE.Vector3(...p1), new THREE.Vector3(...p2)];
      torsoGroup.add(new THREE.Mesh(makeTaperedTube(THREE, new THREE.CatmullRomCurve3(sPts), 6, 12, () => 0.0030), stringMat));
      const aglet = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 0.012, 8), agletMat);
      aglet.position.set(p2[0], p2[1] - 0.006, p2[2]);
      torsoGroup.add(aglet);
    }
  } else if (topStyle === 'tee') {
    addSleeves(0.42, 0.010, false, topMat);
    // Ribbed crew-neck collar ring
    const collar = tagSlot(new THREE.Mesh(new THREE.TorusGeometry(0.056 * (0.85 + 0.15 * bw), 0.0085, 10, 26), ribTopMat), 'primary');
    collar.rotation.x = Math.PI * 0.5 + 0.16;
    collar.position.set(0, dims.neckBaseY - 0.014, 0.008);
    torsoGroup.add(collar);
  } else if (topStyle === 'shirt') {
    addSleeves(0.92, 0.010, false, topMat);
    // Folded 2-piece shirt collar
    for (const side of [1, -1]) {
      const cShape = new THREE.Shape();
      cShape.moveTo(0, 0);
      cShape.lineTo(side * 0.048, -0.022);
      cShape.quadraticCurveTo(side * 0.054, 0.014, side * 0.032, 0.028);
      cShape.lineTo(0, 0.018);
      const cGeo = new THREE.ExtrudeGeometry(cShape, { depth: 0.004, bevelEnabled: true, bevelSize: 0.0015, bevelThickness: 0.0015, bevelSegments: 2 });
      const collarLeaf = tagSlot(new THREE.Mesh(cGeo, topMat), 'primary');
      collarLeaf.position.set(side * 0.006, dims.neckBaseY - 0.008, 0.052 * (0.85 + 0.15 * bw));
      collarLeaf.rotation.y = -side * 0.35;
      collarLeaf.rotation.x = -0.25;
      torsoGroup.add(collarLeaf);
    }
    const neckBand = tagSlot(new THREE.Mesh(new THREE.CylinderGeometry(0.053 * (0.85 + 0.15 * bw), 0.059 * (0.85 + 0.15 * bw), 0.024, 24, 1, true), topMat), 'primary');
    neckBand.position.set(0, dims.neckBaseY - 0.002, 0.004);
    torsoGroup.add(neckBand);

    // Front placket + 5 buttons
    const plakGeo = buildThickShell(THREE, 12, 6, (u, v) => {
      const tv = lerp(0.14, 0.82, v);
      const pu = lerp(0.478, 0.522, u);
      return evalTorso(pu, tv, () => ({ dr: topEase + 0.005 }));
    }, 0.003, false);
    torsoGroup.add(tagSlot(new THREE.Mesh(plakGeo, topMat), 'primary'));

    for (let i = 0; i < 5; i++) {
      const tv = lerp(0.22, 0.74, i / 4);
      const bp = evalTorso(0.5, tv, () => ({ dr: topEase + 0.009 }));
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.0052, 0.0052, 0.003, 12), buttonMat);
      btn.rotation.x = Math.PI * 0.5;
      btn.position.set(bp[0], bp[1], bp[2]);
      torsoGroup.add(btn);
    }
  } else if (topStyle === 'cardigan') {
    addSleeves(0.92, 0.013, true, topMat);
    // Ribbed bottom hem + buttons along open front placket
    const hemGeo = buildThickShell(THREE, 6, 36, (u, v) => {
      const tv = lerp(vMinTop - 0.02, vMinTop + 0.04, v);
      const theta = lerp(0.16, Math.PI * 2 - 0.16, u);
      const mappedU = ((theta / (Math.PI * 2)) + 0.5) % 1;
      return evalTorso(mappedU, tv, () => ({ dr: topEase + 0.003 }));
    }, 0.006, false);
    torsoGroup.add(tagSlot(new THREE.Mesh(hemGeo, ribTopMat), 'primary'));

    for (let i = 0; i < 4; i++) {
      const tv = lerp(0.18, 0.56, i / 3);
      const bp = evalTorso(0.535, tv, () => ({ dr: topEase + 0.007 }));
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.0072, 0.0072, 0.004, 14), buttonMat);
      btn.rotation.x = Math.PI * 0.5;
      btn.position.set(bp[0], bp[1], bp[2]);
      torsoGroup.add(btn);
    }
  } else if (topStyle === 'sweater') {
    addSleeves(0.92, 0.014, true, topMat);
    // Cozy ribbed collar & bottom hem
    const collar = tagSlot(new THREE.Mesh(new THREE.TorusGeometry(0.057 * (0.85 + 0.15 * bw), 0.014, 12, 26), ribTopMat), 'primary');
    collar.rotation.x = Math.PI * 0.5 + 0.14;
    collar.position.set(0, dims.neckBaseY - 0.010, 0.007);
    torsoGroup.add(collar);

    const hemGeo = buildThickShell(THREE, 6, 36, (u, v) => {
      const tv = lerp(vMinTop - 0.025, vMinTop + 0.045, v);
      return evalTorso(u, tv, () => ({ dr: 0.016 }));
    }, 0.006, true);
    torsoGroup.add(tagSlot(new THREE.Mesh(hemGeo, ribTopMat), 'primary'));
  } else if (topStyle === 'blazer') {
    addSleeves(0.92, 0.012, false, topMat);
    // Sculpted notched lapels bent onto chest
    for (const side of [1, -1]) {
      const lShape = new THREE.Shape();
      lShape.moveTo(0, 0);
      lShape.lineTo(side * 0.036, 0.085 * bh);
      lShape.lineTo(side * 0.020, 0.095 * bh);
      lShape.lineTo(side * 0.034, 0.125 * bh);
      lShape.lineTo(side * 0.008, 0.155 * bh);
      lShape.lineTo(-side * 0.005, 0.020 * bh);
      const lGeo = new THREE.ExtrudeGeometry(lShape, { depth: 0.0045, bevelEnabled: true, bevelSize: 0.0015, bevelThickness: 0.0015, bevelSegments: 2 });
      const lp = evalTorso(0.5 + side * 0.045, 0.42, () => ({ dr: topEase + 0.004 }));
      const lapel = tagSlot(new THREE.Mesh(lGeo, topMat), 'primary');
      lapel.position.set(lp[0], lp[1], lp[2]);
      lapel.rotation.y = side * 0.24;
      lapel.rotation.x = -0.10;
      torsoGroup.add(lapel);

      // Hip flap pocket
      const fp = evalTorso(0.5 + side * 0.14, 0.22, () => ({ dr: topEase + 0.005 }));
      const flap = tagSlot(new THREE.Mesh(new THREE.BoxGeometry(0.044 * bw, 0.016, 0.006), topMat), 'primary');
      flap.position.set(fp[0], fp[1], fp[2]);
      flap.rotation.y = side * 0.48;
      torsoGroup.add(flap);
    }
    for (let i = 0; i < 2; i++) {
      const bp = evalTorso(0.525, 0.28 + i * 0.10, () => ({ dr: topEase + 0.006 }));
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.0068, 0.0068, 0.004, 14), buttonMat);
      btn.rotation.x = Math.PI * 0.5;
      btn.position.set(bp[0], bp[1], bp[2]);
      torsoGroup.add(btn);
    }
  }

  // --- BOTTOMS ---
  const botKind = bottomStyle === 'jeans' ? 'denim' : bottomStyle === 'trousers' ? 'suiting' : 'cotton';
  const botMat = makeFabricMaterial(THREE, kit, opts.bottomColor, botKind);
  const cuffUnderMat = makeFabricMaterial(THREE, kit, shiftColor(THREE, opts.bottomColor, 0.22, -0.10).getHexString(), 'denim');

  if (bottomStyle === 'trousers' || bottomStyle === 'jeans' || bottomStyle === 'shorts') {
    // Pelvis & waistband shell on torso
    const pelvisGeo = buildThickShell(THREE, 14, 36, (u, v) => {
      const tv = lerp(0.04, 0.34, v);
      return evalTorso(u, tv, (uu, ttv, th) => ({
        dr: 0.011 + gauss(ttv - 0.18, 0.08) * 0.004 + Math.sin(th * 4) * 0.001,
      }));
    }, 0.005, true);
    torsoGroup.add(tagSlot(new THREE.Mesh(pelvisGeo, botMat), 'secondary'));

    // Jeans stitched pockets & metallic fly button
    if (bottomStyle === 'jeans') {
      const stitchMat = new THREE.MeshBasicMaterial({ color: '#d49a4c' });
      const flyBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 12), new THREE.MeshPhysicalMaterial({ color: '#c4984c', metalness: 0.75, roughness: 0.3 }));
      const bp = evalTorso(0.5, 0.31, () => ({ dr: 0.014 }));
      flyBtn.rotation.x = Math.PI * 0.5;
      flyBtn.position.set(bp[0], bp[1], bp[2]);
      torsoGroup.add(flyBtn);

      // Back stitched denim pockets
      for (const side of [1, -1]) {
        const pkGeo = buildThickShell(THREE, 6, 8, (u, v) => {
          const tv = lerp(0.11, 0.26, v);
          const pu = side > 0 ? lerp(0.86, 0.97, u) : lerp(0.03, 0.14, u);
          return evalTorso(pu, tv, () => ({ dr: 0.016 }));
        }, 0.003, false);
        torsoGroup.add(tagSlot(new THREE.Mesh(pkGeo, botMat), 'secondary'));

        // Curved front pocket topstitching
        const sPts = [];
        for (let k = 0; k <= 5; k++) {
          const f = k / 5;
          const sp = evalTorso(0.5 + side * lerp(0.11, 0.24, f), lerp(0.30, 0.21, f * f), () => ({ dr: 0.0165 }));
          sPts.push(new THREE.Vector3(...sp));
        }
        torsoGroup.add(new THREE.Mesh(makeTaperedTube(THREE, new THREE.CatmullRomCurve3(sPts), 5, 10, () => 0.0014), stitchMat));
      }
    }

    // Pant legs on legL & legR with sculpted knee wrinkles
    const endT = bottomStyle === 'shorts' ? 0.44 : 0.93;
    const easeLeg = bottomStyle === 'trousers' ? 0.013 : bottomStyle === 'jeans' ? 0.011 : 0.014;

    for (const leg of [legL, legR]) {
      const curve = leg.userData.curve;
      const pts = [];
      const steps = 18;
      for (let i = 0; i <= steps; i++) {
        pts.push(curve.getPoint((i / steps) * endT));
      }
      const subCurve = new THREE.CatmullRomCurve3(pts);
      const legClothGeo = makeTaperedTube(THREE, subCurve, 20, 24, (t, ang) => {
        const lt = t * endT;
        let rx, rz;
        if (lt < 0.48) {
          const k = smoothstep(0.05, 0.48, lt);
          rx = lerp(0.054, 0.039, k) * bw;
          rz = lerp(0.056, 0.040, k) * bw;
        } else if (lt < 0.70) {
          const k = smoothstep(0.48, 0.70, lt);
          rx = lerp(0.039, 0.041, k) * bw;
          rz = lerp(0.040, 0.043, k) * bw;
        } else {
          const k = smoothstep(0.70, 0.96, lt);
          rx = lerp(0.041, 0.027, k) * bw;
          rz = lerp(0.043, 0.029, k) * bw;
        }
        // Sculpted knee folds & ankle gather
        const kneeFold = gauss(lt - 0.50, 0.07) * Math.sin(lt * 58 + Math.sin(ang) * 1.4) * 0.0036;
        const flare = bottomStyle === 'trousers' ? smoothstep(0.5, 0.95, lt) * 0.009 : smoothstep(0.6, 0.95, lt) * 0.005;
        return [rx + easeLeg + flare + kneeFold, rz + easeLeg + flare + kneeFold];
      }, { capStart: true, capEnd: false, initNormal: new THREE.Vector3(1, 0, 0) });

      leg.add(tagSlot(new THREE.Mesh(legClothGeo, botMat), 'secondary'));

      // Rolled cuff for jeans or neat hem torus for trousers/shorts
      const endP = curve.getPoint(endT);
      if (bottomStyle === 'jeans') {
        const cuffR = 0.031 * bw + easeLeg * 1.15;
        const cuff = tagSlot(new THREE.Mesh(new THREE.CylinderGeometry(cuffR, cuffR * 1.04, 0.026, 20), cuffUnderMat), 'secondary');
        cuff.position.set(endP.x, endP.y + 0.010, endP.z);
        leg.add(cuff);
      } else {
        const hemR = (bottomStyle === 'shorts' ? 0.043 : 0.033) * bw + easeLeg * 1.15;
        const hem = tagSlot(new THREE.Mesh(new THREE.TorusGeometry(hemR, 0.005, 8, 22), botMat), 'secondary');
        hem.rotation.x = Math.PI * 0.5;
        hem.position.copy(endP);
        leg.add(hem);
      }
    }
  } else {
    // Pleated skirt ("skirt") or flowing draped long skirt ("longSkirt")
    const isLong = bottomStyle === 'longSkirt';
    const skirtGroup = new THREE.Group();
    skirtGroup.name = 'skirtGroup';
    const waistY = dims.pelvisBottomY + 0.34 * (dims.neckTopY - dims.pelvisBottomY);
    skirtGroup.position.set(0, waistY, 0);

    const skirtLen = (isLong ? legLen * 0.86 : legLen * 0.44);
    const pleats = isLong ? 12 : 18;
    const pleatDepth = isLong ? 0.014 : 0.011;

    const skirtGeo = buildThickShell(THREE, 20, pleats * 4, (u, v) => {
      // v = 0 bottom hem -> v = 1 waistband
      const theta = (u - 0.5) * Math.PI * 2;
      const st = Math.sin(theta);
      const ct = Math.cos(theta);
      const drop = (1 - v);
      const baseRx = lerp(0.106 * bw + 0.012, (isLong ? 0.195 : 0.165) * bw, Math.pow(drop, 0.85));
      const baseRz = lerp(0.084 * bw + 0.012, (isLong ? 0.175 : 0.145) * bw, Math.pow(drop, 0.85));

      // Crisp geometric knife pleats / flowing folds
      const pleatWave = isLong
        ? Math.sin(theta * pleats + drop * 1.2)
        : Math.sin(theta * pleats) + 0.25 * Math.sin(theta * pleats * 2);
      const pAmp = pleatDepth * smoothstep(0.08, 0.95, drop);
      const rX = baseRx + pleatWave * pAmp;
      const rZ = baseRz + pleatWave * pAmp;

      const hemWave = Math.sin(theta * pleats) * 0.004 * drop;
      const y = -drop * skirtLen + hemWave;
      return [st * rX, y, ct * rZ];
    }, 0.0045, true);
    skirtGroup.add(tagSlot(new THREE.Mesh(skirtGeo, botMat), 'secondary'));

    // Fitted waistband
    const wbGeo = buildThickShell(THREE, 5, 32, (u, v) => {
      const tv = lerp(0.28, 0.36, v);
      const p = evalTorso(u, tv, () => ({ dr: 0.013 }));
      return [p[0], p[1] - waistY, p[2]];
    }, 0.005, true);
    skirtGroup.add(tagSlot(new THREE.Mesh(wbGeo, botMat), 'secondary'));

    // Modest dark undershorts inside skirt
    const underMat = new THREE.MeshPhysicalMaterial({ color: '#2b2a2f', roughness: 0.9 });
    const underGeo = buildParametricGrid(THREE, 10, 24, (u, v) => {
      const tv = lerp(0.02, 0.26, v);
      const p = evalTorso(u, tv, () => ({ dr: 0.005 }));
      return [p[0], p[1] - waistY, p[2]];
    }, true, true, false);
    skirtGroup.add(new THREE.Mesh(underGeo, underMat));

    torsoGroup.add(skirtGroup);
  }

  // --- BAGS ---
  if (opts.bag === 'backpack') {
    torsoGroup.add(buildBackpack(THREE, opts, kit, dims, evalTorso));
  } else if (opts.bag === 'tote') {
    torsoGroup.add(buildToteBag(THREE, opts, kit, dims, evalTorso));
  }
}

function buildBackpack(THREE, opts, kit, dims, evalTorso) {
  const { bw, bh } = dims;
  const packG = new THREE.Group();
  packG.name = 'backpack';

  const packMat = makeFabricMaterial(THREE, kit, opts.accent, 'cotton');
  const trimMat = makeFabricMaterial(THREE, kit, shiftColor(THREE, opts.accent, -0.18, 0.04).getHexString(), 'cotton');
  const zipMat = new THREE.MeshPhysicalMaterial({ color: '#d4b872', metalness: 0.78, roughness: 0.28 });

  const backAnchor = evalTorso(0.0, 0.44, () => ({ dr: 0.022 }));
  const cx = 0;
  const cy = backAnchor[1];
  const cz = backAnchor[2] - 0.068;

  // Main rounded dorm backpack body (sculpted displaced sphere)
  const mainGeo = buildParametricGrid(THREE, 24, 30, (u, v) => {
    const theta = (u - 0.5) * Math.PI * 2;
    const phi = lerp(-Math.PI * 0.49, Math.PI * 0.49, v);
    const cp = Math.cos(phi), sp = Math.sin(phi);
    const ux = cp * Math.sin(theta), uy = sp, uz = cp * Math.cos(theta);
    // Slightly pear-shaped dome, flatter against back (+Z)
    const taperTop = lerp(1.08, 0.82, smoothstep(-0.6, 0.9, uy));
    const x = ux * 0.118 * (0.85 + 0.15 * bw) * taperTop;
    const y = uy * 0.142 * bh;
    let z = uz * 0.068 * taperTop;
    if (uz > 0) z *= 0.62; // flat against back
    return [x, y, z];
  }, true, false, false);
  const mainMesh = tagSlot(new THREE.Mesh(mainGeo, packMat), 'accent');
  mainMesh.position.set(cx, cy, cz);
  packG.add(mainMesh);

  // Front zippered pouch
  const pouchGeo = new THREE.SphereGeometry(0.072, 20, 14);
  pouchGeo.scale(1.18, 0.78, 0.46);
  const pouch = tagSlot(new THREE.Mesh(pouchGeo, trimMat), 'accent');
  pouch.position.set(cx, cy - 0.042 * bh, cz - 0.056);
  packG.add(pouch);

  // Zipper pull
  const pull = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.020, 0.005), zipMat);
  pull.position.set(cx + 0.032, cy - 0.008 * bh, cz - 0.082);
  pull.rotation.z = 0.25;
  packG.add(pull);

  // Top carry loop
  const loop = tagSlot(new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 8, 18, Math.PI), trimMat), 'accent');
  loop.position.set(cx, cy + 0.132 * bh, cz + 0.012);
  packG.add(loop);

  // Two curved padded shoulder straps wrapping cleanly over shoulders
  for (const side of [1, -1]) {
    const sPts = [
      new THREE.Vector3(side * 0.048 * bw, cy + 0.115 * bh, cz + 0.024),
      new THREE.Vector3(...evalTorso(0.5 + side * 0.26, 0.79, () => ({ dr: 0.028, dy: 0.012 }))),
      new THREE.Vector3(...evalTorso(0.5 + side * 0.21, 0.60, () => ({ dr: 0.028 }))),
      new THREE.Vector3(...evalTorso(0.5 + side * 0.26, 0.36, () => ({ dr: 0.026 }))),
      new THREE.Vector3(side * 0.088 * bw, cy - 0.105 * bh, cz + 0.020),
    ];
    const strapGeo = makeTaperedTube(THREE, new THREE.CatmullRomCurve3(sPts), 10, 24, () => [0.016, 0.0065]);
    packG.add(tagSlot(new THREE.Mesh(strapGeo, trimMat), 'accent'));
  }

  return packG;
}

function buildToteBag(THREE, opts, kit, dims, evalTorso) {
  const { bw, bh } = dims;
  const toteG = new THREE.Group();
  toteG.name = 'toteBag';

  const canvasMat = makeFabricMaterial(THREE, kit, '#efe8da', 'cotton');
  const stripeMat = makeFabricMaterial(THREE, kit, opts.accent, 'cotton');

  // Slung over left shoulder (+X), resting softly against left hip
  const hipP = evalTorso(0.75, 0.16, () => ({ dr: 0.056 }));
  const bx = hipP[0] + 0.022;
  const by = hipP[1] - 0.065 * bh;
  const bz = -0.015;

  // Soft sculpted canvas tote pouch
  const bagGeo = buildThickShell(THREE, 14, 24, (u, v) => {
    const ang = (u - 0.5) * Math.PI * 2;
    const rx = lerp(0.036, 0.026, v);
    const rz = lerp(0.092, 0.104, v);
    const bulge = Math.sin(v * Math.PI) * 0.010;
    const x = Math.sin(ang) * (rx + bulge);
    const z = Math.cos(ang) * rz;
    const y = (v - 0.5) * 0.185 * bh;
    return [x, y, z];
  }, 0.005, true);
  const bagMesh = tagSlot(new THREE.Mesh(bagGeo, canvasMat), 'accent');
  bagMesh.position.set(bx, by, bz);
  bagMesh.rotation.z = 0.08;
  toteG.add(bagMesh);

  // Decorative accent stripe band around middle of tote
  const band = tagSlot(new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.038, 0.034, 20), stripeMat), 'accent');
  band.scale.set(1.0, 1.0, 2.7);
  band.position.set(bx, by - 0.01, bz);
  band.rotation.z = 0.08;
  toteG.add(band);

  // Twin curved fabric handles arching up over the left shoulder
  const shTop = evalTorso(0.74, 0.78, () => ({ dr: 0.026, dy: 0.014 }));
  for (const sOff of [-0.046, 0.046]) {
    const hPts = [
      new THREE.Vector3(bx - 0.008, by + 0.088 * bh, bz + sOff),
      new THREE.Vector3(bx + 0.005, by + 0.195 * bh, bz + sOff * 0.75),
      new THREE.Vector3(shTop[0] + 0.010 * bw, shTop[1] + 0.012, shTop[2] + sOff * 0.35),
      new THREE.Vector3(shTop[0] - 0.012 * bw, shTop[1] + 0.006, shTop[2] - sOff * 0.35),
      new THREE.Vector3(bx - 0.018, by + 0.190 * bh, bz - sOff * 0.75),
      new THREE.Vector3(bx - 0.012, by + 0.088 * bh, bz - sOff),
    ];
    const hGeo = makeTaperedTube(THREE, new THREE.CatmullRomCurve3(hPts), 8, 22, () => [0.009, 0.0038]);
    toteG.add(tagSlot(new THREE.Mesh(hGeo, stripeMat), 'accent'));
  }

  return toteG;
}

// ---------- Main Export: build ----------

export function build(THREE, userOpts = {}, kit) {
  const opts = { ...DEFAULTS, ...(userOpts || {}) };
  opts.skin = toHex(THREE, opts.skin, DEFAULTS.skin);
  opts.hairColor = toHex(THREE, opts.hairColor, DEFAULTS.hairColor);
  opts.eye = toHex(THREE, opts.eye, DEFAULTS.eye);
  opts.topColor = toHex(THREE, opts.topColor, DEFAULTS.topColor);
  opts.bottomColor = toHex(THREE, opts.bottomColor, DEFAULTS.bottomColor);
  opts.shoeColor = toHex(THREE, opts.shoeColor, DEFAULTS.shoeColor);
  opts.accent = toHex(THREE, opts.accent, DEFAULTS.accent);

  const bw = clamp(Number(opts.bodyWidth) || 1.0, 0.8, 1.3);
  const bh = clamp(Number(opts.bodyHeight) || 1.0, 0.9, 1.1);
  const hs = clamp(Number(opts.headSize) || 1.0, 0.9, 1.1);

  const ankleY = 0.068;
  const legLen = 0.345 * bh;
  const hipY = ankleY + legLen;
  const pelvisBottomY = hipY - 0.045;
  const shoulderY = hipY + 0.268 * bh;
  const neckBaseY = hipY + 0.295 * bh;
  const neckTopY = neckBaseY + 0.095;
  const headPivotY = neckBaseY + 0.042;
  const headCenterLocalY = 0.205 * hs;

  const dims = {
    bw, bh, hs,
    ankleY, legLen, hipY,
    hipX: 0.064 * bw,
    pelvisBottomY,
    shoulderY,
    shoulderX: 0.118 * bw,
    armLen: 0.265 * bh,
    neckBaseY,
    neckTopY,
    headPivotY,
    headCenterLocalY,
  };

  // Shared skin & face materials
  const skinTex = makeSkinTexture(THREE, kit, opts.skin, !!opts.blush, !!opts.freckles);
  const skinBaseMat = new THREE.MeshPhysicalMaterial({
    color: opts.skin,
    roughness: 0.56,
    metalness: 0.0,
    sheen: 0.28,
    sheenRoughness: 0.72,
    sheenColor: shiftColor(THREE, opts.skin, 0.16, -0.05),
    clearcoat: 0.05,
    clearcoatRoughness: 0.6,
  });
  const headSkinMat = skinBaseMat.clone();
  headSkinMat.color.set('#ffffff');
  headSkinMat.map = skinTex;

  const innerEarMat = new THREE.MeshPhysicalMaterial({
    color: shiftColor(THREE, opts.skin, -0.07, 0.12),
    roughness: 0.62,
  });

  const mats = { skin: skinBaseMat, headSkin: headSkinMat, innerEar: innerEarMat };

  // Root & named hierarchy
  const root = new THREE.Group();
  root.name = 'studentCharacter';

  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'body';
  root.add(bodyGroup);

  const torsoGroup = new THREE.Group();
  torsoGroup.name = 'torso';
  torsoGroup.position.set(0, hipY, 0);
  bodyGroup.add(torsoGroup);

  // Continuous sculpted torso + sloping shoulders + visible neck (in torsoGroup local coords)
  const evalTorsoWorld = createTorsoEvaluator(dims);
  const evalTorsoLocal = (u, v, easeFn = null) => {
    const p = evalTorsoWorld(u, v, easeFn);
    return [p[0], p[1] - hipY, p[2]];
  };

  const torsoGeo = buildParametricGrid(THREE, 42, 40, (u, v) => evalTorsoLocal(u, v), true, true, true);
  torsoGroup.add(tagSlot(new THREE.Mesh(torsoGeo, mats.skin), 'skin'));

  // Head attached to torso so breathing/leaning moves head naturally
  const localDims = {
    ...dims,
    pelvisBottomY: pelvisBottomY - hipY,
    shoulderY: shoulderY - hipY,
    neckBaseY: neckBaseY - hipY,
    neckTopY: neckTopY - hipY,
    headPivotY: headPivotY - hipY,
  };
  const headGroup = buildHeadGroup(THREE, opts, kit, localDims, mats);
  torsoGroup.add(headGroup);

  // Arms attached to torso
  const armL = buildArmGroup(THREE, 1, localDims, mats);
  const armR = buildArmGroup(THREE, -1, localDims, mats);
  torsoGroup.add(armL);
  torsoGroup.add(armR);

  // Legs attached to body
  const legL = buildLegGroup(THREE, 1, opts, dims, mats);
  const legR = buildLegGroup(THREE, -1, opts, dims, mats);
  bodyGroup.add(legL);
  bodyGroup.add(legR);

  // Layered clothes & accessories
  buildClothes(THREE, opts, kit, localDims, evalTorsoLocal, torsoGroup, armL, armR, legL, legR);

  // Cache quick lookup refs for fast animation & state updates
  root.userData.parts = {
    body: bodyGroup,
    torso: torsoGroup,
    head: headGroup,
    hair: headGroup.getObjectByName('hair'),
    armL,
    armR,
    legL,
    legR,
    eyeL: headGroup.getObjectByName('eyeL'),
    eyeR: headGroup.getObjectByName('eyeR'),
    browL: headGroup.getObjectByName('browL'),
    browR: headGroup.getObjectByName('browR'),
    mouthRoot: headGroup.getObjectByName('mouthRoot'),
    skirtGroup: torsoGroup.getObjectByName('skirtGroup'),
    ponytailSwing: headGroup.getObjectByName('ponytailSwing'),
  };
  root.userData.dims = dims;
  root.userData.expression = 'awake';
  root.userData.pose = 'stand';

  setExpression(root, 'awake');
  setPose(root, 'stand');

  return root;
}

// ---------- Expressions ----------

export function setExpression(group, name = 'awake') {
  const parts = group.userData.parts || {};
  const eyeL = parts.eyeL || group.getObjectByName('eyeL');
  const eyeR = parts.eyeR || group.getObjectByName('eyeR');
  const browL = parts.browL || group.getObjectByName('browL');
  const browR = parts.browR || group.getObjectByName('browR');
  const mouthRoot = parts.mouthRoot || group.getObjectByName('mouthRoot');

  group.userData.expression = name;

  for (const eye of [eyeL, eyeR]) {
    if (!eye) continue;
    eye.scale.set(1, 1, 1);
    const openG = eye.getObjectByName('openEye');
    const happyG = eye.getObjectByName('happyEye');
    const asleepG = eye.getObjectByName('asleepEye');
    if (openG) openG.visible = name === 'awake' || name === 'thinking' || name === 'unsure';
    if (happyG) happyG.visible = name === 'happy';
    if (asleepG) asleepG.visible = name === 'asleep';

    const irisPivot = eye.getObjectByName('irisPivot');
    if (irisPivot) {
      if (name === 'thinking') irisPivot.position.set(0.0055, 0.0055, 0);
      else if (name === 'unsure') irisPivot.position.set(-0.004, 0.001, 0);
      else irisPivot.position.set(0, 0, 0);
    }
  }

  // Brow angle & height adjustments
  const setBrow = (brow, side, dy, rz) => {
    if (!brow || !brow.userData.basePos) return;
    brow.position.copy(brow.userData.basePos);
    brow.rotation.copy(brow.userData.baseRot);
    brow.position.y += dy;
    brow.rotation.z = rz * side;
  };

  if (name === 'awake') {
    setBrow(browL, 1, 0, 0.04);
    setBrow(browR, -1, 0, 0.04);
  } else if (name === 'happy') {
    setBrow(browL, 1, 0.007, 0.08);
    setBrow(browR, -1, 0.007, 0.08);
  } else if (name === 'asleep') {
    setBrow(browL, 1, -0.006, -0.05);
    setBrow(browR, -1, -0.006, -0.05);
  } else if (name === 'thinking') {
    setBrow(browL, 1, 0.009, 0.14);
    setBrow(browR, -1, -0.005, -0.16);
  } else if (name === 'unsure') {
    setBrow(browL, 1, 0.003, -0.22);
    setBrow(browR, -1, 0.003, -0.22);
  }

  // Swap mouth shapes
  if (mouthRoot) {
    for (const child of mouthRoot.children) {
      child.visible = child.name === `mouth_${name}`;
    }
  }
}

// ---------- Poses ----------

export function setPose(group, name = 'stand') {
  const p = group.userData.parts || {};
  const body = p.body || group.getObjectByName('body');
  const torso = p.torso || group.getObjectByName('torso');
  const head = p.head || group.getObjectByName('head');
  const armL = p.armL || group.getObjectByName('armL');
  const armR = p.armR || group.getObjectByName('armR');
  const legL = p.legL || group.getObjectByName('legL');
  const legR = p.legR || group.getObjectByName('legR');
  const skirt = p.skirtGroup || group.getObjectByName('skirtGroup');

  if (!body || !torso || !head || !armL || !armR || !legL || !legR) return;

  const base = {
    bodyPos: [0, 0, 0],
    torsoRot: [0, 0, 0],
    headRot: [0, 0, 0],
    armLRot: [0, 0, 0],
    armRRot: [0, 0, 0],
    legLRot: [0, 0, 0],
    legRRot: [0, 0, 0],
    skirtRotX: 0,
  };

  if (name === 'stand') {
    // Natural relaxed contrapposto stance: weight on left leg, right hand gently forward, subtle head tilt
    base.bodyPos = [-0.006, 0, 0];
    base.torsoRot = [0.02, -0.05, 0.03];
    base.headRot = [0.03, 0.06, -0.085];
    base.armLRot = [0.06, 0.04, 0.14];
    base.armRRot = [-0.22, -0.06, -0.15];
    base.legLRot = [0.0, 0.04, 0.015];
    base.legRRot = [-0.045, -0.09, -0.04];
  } else if (name === 'walk') {
    base.bodyPos = [0, 0, 0];
    base.torsoRot = [0.05, 0, 0];
    base.headRot = [-0.02, 0, 0];
    base.armLRot = [-0.30, 0, 0.10];
    base.armRRot = [0.30, 0, -0.10];
    base.legLRot = [0.34, 0, 0.02];
    base.legRRot = [-0.34, 0, -0.02];
  } else if (name === 'sit') {
    const hipY = (group.userData.dims && group.userData.dims.hipY) || 0.41;
    base.bodyPos = [0, -(hipY - 0.105), 0];
    base.torsoRot = [-0.06, 0, 0];
    base.headRot = [0.05, 0.04, -0.04];
    base.armLRot = [-0.46, 0.18, 0.16];
    base.armRRot = [-0.46, -0.18, -
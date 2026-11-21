export const META = {
  id: 'desk-chair',
  name: 'Stylised Desk Chair',
  kind: 'furniture',
  footprint: [0.62, 0.62],
  variants: ['Bentwood Chair', 'Swivel Office Chair', 'Soft Armchair'],
  note: 'Cozy dorm-room desk chair with 0.45 m sculpted dipped seat cushion, tailored piping, and ergonomic curved backrest.'
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function rgbStr(c, mul = 1, add = 0) {
  const r = clamp(Math.round((c.r * mul + add) * 255), 0, 255);
  const g = clamp(Math.round((c.g * mul + add) * 255), 0, 255);
  const b = clamp(Math.round((c.b * mul + add) * 255), 0, 255);
  return `rgb(${r},${g},${b})`;
}

function makeFabricTextures(THREE, kit, colorHex, style) {
  const base = new THREE.Color(colorHex);
  const mode = (style || 'linen').toLowerCase();

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = rgbStr(base, 1, 0);
    ctx.fillRect(0, 0, w, h);

    if (mode === 'corduroy') {
      const ribCount = 64;
      const ribW = w / ribCount;
      for (let i = 0; i < ribCount; i++) {
        const x0 = i * ribW;
        const grad = ctx.createLinearGradient(x0, 0, x0 + ribW, 0);
        grad.addColorStop(0.0, rgbStr(base, 0.78));
        grad.addColorStop(0.28, rgbStr(base, 1.04, 0.02));
        grad.addColorStop(0.55, rgbStr(base, 1.09, 0.03));
        grad.addColorStop(0.85, rgbStr(base, 0.92));
        grad.addColorStop(1.0, rgbStr(base, 0.78));
        ctx.fillStyle = grad;
        ctx.fillRect(x0, 0, ribW + 0.5, h);
      }
      for (let y = 0; y < h; y += 3) {
        for (let x = 0; x < w; x += 6) {
          const n = kit.noise(x * 0.08, y * 0.14);
          ctx.fillStyle = n > 0.5 ? 'rgba(255,250,242,0.055)' : 'rgba(20,14,10,0.055)';
          ctx.fillRect(x, y, 4, 2);
        }
      }
    } else if (mode === 'boucle') {
      for (let y = 0; y < h; y += 8) {
        for (let x = 0; x < w; x += 8) {
          const n = kit.noise(x * 0.05, y * 0.05);
          ctx.fillStyle = rgbStr(base, 0.88 + n * 0.24, (n - 0.5) * 0.04);
          ctx.fillRect(x, y, 8, 8);
        }
      }
      for (let i = 0; i < 2400; i++) {
        const nx = kit.noise(i * 0.37, 1.3);
        const ny = kit.noise(2.7, i * 0.41);
        const cx = ((i * 73.13 + nx * 97) % w);
        const cy = ((i * 131.7 + ny * 89) % h);
        const rad = 2.2 + kit.noise(cx * 0.05, cy * 0.05) * 3.2;
        ctx.strokeStyle = i % 3 === 0 ? rgbStr(base, 1.15, 0.05) : rgbStr(base, 0.84);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 1.55);
        ctx.stroke();
      }
    } else if (mode === 'velvet') {
      for (let y = 0; y < h; y += 4) {
        for (let x = 0; x < w; x += 4) {
          const n1 = kit.noise(x * 0.015, y * 0.015);
          const n2 = kit.noise(x * 0.09, y * 0.04);
          const shade = 0.88 + n1 * 0.18 + (n2 - 0.5) * 0.06;
          ctx.fillStyle = rgbStr(base, shade, n1 * 0.02);
          ctx.fillRect(x, y, 4, 4);
        }
      }
    } else {
      // Cozy woven linen / melange upholstery
      const step = 4;
      for (let y = 0; y < h; y += step) {
        const rowN = kit.noise(0.5, y * 0.07);
        ctx.fillStyle = rgbStr(base, 0.94 + rowN * 0.12, (rowN - 0.5) * 0.02);
        ctx.fillRect(0, y, w, step - 1);
      }
      for (let x = 0; x < w; x += step) {
        const colN = kit.noise(x * 0.07, 3.1);
        ctx.fillStyle = colN > 0.5 ? 'rgba(255,248,240,0.08)' : 'rgba(25,18,12,0.08)';
        ctx.fillRect(x, 0, step - 1, h);
      }
      for (let y = 0; y < h; y += step * 2) {
        for (let x = 0; x < w; x += step * 2) {
          const n = kit.noise(x * 0.04, y * 0.04);
          const alt = ((x + y) / (step * 2)) % 2 === 0;
          ctx.fillStyle = alt
            ? `rgba(255,250,244,${(0.04 + n * 0.07).toFixed(3)})`
            : `rgba(20,14,10,${(0.04 + (1 - n) * 0.07).toFixed(3)})`;
          ctx.fillRect(x, y, step, step);
        }
      }
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3.2, 3.2);

  const bumpMap = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = 'rgb(128,128,128)';
    ctx.fillRect(0, 0, w, h);

    if (mode === 'corduroy') {
      const ribCount = 64;
      const ribW = w / ribCount;
      for (let i = 0; i < ribCount; i++) {
        const x0 = i * ribW;
        const grad = ctx.createLinearGradient(x0, 0, x0 + ribW, 0);
        grad.addColorStop(0.0, 'rgb(45,45,45)');
        grad.addColorStop(0.5, 'rgb(225,225,225)');
        grad.addColorStop(1.0, 'rgb(45,45,45)');
        ctx.fillStyle = grad;
        ctx.fillRect(x0, 0, ribW + 0.5, h);
      }
    } else if (mode === 'boucle') {
      for (let i = 0; i < 2600; i++) {
        const nx = kit.noise(i * 0.37, 1.3);
        const ny = kit.noise(2.7, i * 0.41);
        const cx = ((i * 73.13 + nx * 97) % w);
        const cy = ((i * 131.7 + ny * 89) % h);
        const rad = 2.0 + kit.noise(cx * 0.05, cy * 0.05) * 3.0;
        ctx.strokeStyle = i % 2 === 0 ? 'rgb(215,215,215)' : 'rgb(80,80,80)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 1.5);
        ctx.stroke();
      }
    } else if (mode === 'velvet') {
      for (let y = 0; y < h; y += 4) {
        for (let x = 0; x < w; x += 4) {
          const v = Math.round(105 + kit.noise(x * 0.08, y * 0.06) * 46);
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(x, y, 4, 4);
        }
      }
    } else {
      const step = 4;
      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          const checker = (((x / step) + (y / step)) % 2 === 0) ? 168 : 94;
          const jitter = Math.round((kit.noise(x * 0.08, y * 0.08) - 0.5) * 34);
          const v = clamp(checker + jitter, 40, 220);
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(x, y, step, step);
        }
      }
    }
  });
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3.2, 3.2);

  return { map, bumpMap };
}

function makeWoodTextures(THREE, kit, woodHex) {
  const base = new THREE.Color(woodHex);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = rgbStr(base, 1);
    ctx.fillRect(0, 0, w, h);

    const imgStep = 2;
    for (let y = 0; y < h; y += imgStep) {
      for (let x = 0; x < w; x += 4) {
        const nx = x / w;
        const ny = y / h;
        const warp = kit.noise(nx * 3.5, ny * 1.8) * 1.6 + kit.noise(nx * 9.0, ny * 3.2) * 0.35;
        const ring = Math.sin((nx * 14.0 + warp * 4.2 + Math.sin(ny * Math.PI * 2) * 0.6) * Math.PI);
        const grain = 0.5 + 0.5 * ring;
        const fine = kit.noise(nx * 46.0, ny * 6.5);
        const mul = 0.80 + grain * 0.24 + (fine - 0.5) * 0.08;
        ctx.fillStyle = rgbStr(base, mul, (grain - 0.5) * 0.02);
        ctx.fillRect(x, y, 4, imgStep);
      }
    }

    // Subtle fine wood vessel pores
    for (let i = 0; i < 420; i++) {
      const px = (kit.noise(i * 0.71, 4.2) * w * 1.3 + i * 29) % w;
      const py = (kit.noise(9.1, i * 0.53) * h * 1.3 + i * 53) % h;
      const len = 10 + kit.noise(px * 0.03, py * 0.03) * 28;
      ctx.fillStyle = rgbStr(base, 0.62);
      ctx.fillRect(px, py, 1.2, len);
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = 'rgb(128,128,128)';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 4) {
        const nx = x / w;
        const ny = y / h;
        const warp = kit.noise(nx * 3.5, ny * 1.8) * 1.6;
        const ring = 0.5 + 0.5 * Math.sin((nx * 14.0 + warp * 4.2) * Math.PI);
        const fine = kit.noise(nx * 42.0, ny * 7.0);
        const v = clamp(Math.round(96 + ring * 44 + (fine - 0.5) * 32), 40, 220);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 4, 3);
      }
    }
  });
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

function makeMetalBump(THREE, kit) {
  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = 'rgb(128,128,128)';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      const v = clamp(Math.round(114 + kit.noise(0.4, y * 0.35) * 28), 80, 175);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, w, 2);
    }
  });
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  return bumpMap;
}

function makeMaterialSet(THREE, kit, opts, variant) {
  const defaultPrimary = variant === 0 ? '#7f9988' : variant === 1 ? '#6e8ba0' : '#c77c69';
  const defaultWood = variant === 0 ? '#ba804d' : variant === 1 ? '#9d6a42' : '#8d5938';
  const defaultMetal = variant === 0 ? '#c8a86b' : variant === 1 ? '#454a52' : '#cda865';

  const primaryCol = new THREE.Color(opts.primary || defaultPrimary);
  const woodCol = new THREE.Color(opts.wood || defaultWood);
  const metalCol = new THREE.Color(opts.metal || defaultMetal);
  const style = opts.material || (variant === 2 ? 'boucle' : 'linen');

  const fabricTex = makeFabricTextures(THREE, kit, primaryCol, style);
  const woodTex = makeWoodTextures(THREE, kit, woodCol);
  const metalBump = makeMetalBump(THREE, kit);

  const sheenCol = primaryCol.clone().lerp(new THREE.Color('#ffffff'), 0.45);
  const pipingCol = primaryCol.clone().lerp(new THREE.Color('#fff4e8'), 0.16);
  const pipingSheen = pipingCol.clone().lerp(new THREE.Color('#ffffff'), 0.5);

  const cushion = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: fabricTex.map,
    bumpMap: fabricTex.bumpMap,
    bumpScale: style === 'corduroy' ? 0.0055 : style === 'boucle' ? 0.0045 : 0.0032,
    roughness: style === 'velvet' ? 0.86 : 0.93,
    metalness: 0.0,
    sheen: style === 'velvet' ? 0.95 : 0.78,
    sheenRoughness: style === 'velvet' ? 0.45 : 0.72,
    sheenColor: sheenCol
  });

  const piping = new THREE.MeshPhysicalMaterial({
    color: pipingCol,
    bumpMap: fabricTex.bumpMap,
    bumpScale: 0.0018,
    roughness: 0.88,
    metalness: 0.0,
    sheen: 0.85,
    sheenRoughness: 0.62,
    sheenColor: pipingSheen
  });

  const wood = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: woodTex.map,
    bumpMap: woodTex.bumpMap,
    bumpScale: 0.0018,
    roughness: 0.42,
    metalness: 0.0,
    clearcoat: 0.38,
    clearcoatRoughness: 0.30
  });

  const isDarkMetal = (metalCol.r + metalCol.g + metalCol.b) < 1.05;
  const metal = new THREE.MeshPhysicalMaterial({
    color: metalCol,
    bumpMap: metalBump,
    bumpScale: 0.0006,
    roughness: isDarkMetal ? 0.38 : 0.24,
    metalness: isDarkMetal ? 0.72 : 0.88,
    clearcoat: isDarkMetal ? 0.2 : 0.35,
    clearcoatRoughness: 0.22
  });

  const chrome = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#d8dce2'),
    bumpMap: metalBump,
    bumpScale: 0.0003,
    roughness: 0.16,
    metalness: 0.94,
    clearcoat: 0.4,
    clearcoatRoughness: 0.12
  });

  const darkRubber = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#2c2e33'),
    roughness: 0.76,
    metalness: 0.05,
    clearcoat: 0.08,
    clearcoatRoughness: 0.6
  });

  const felt = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#46423d'),
    roughness: 0.96,
    metalness: 0.0,
    sheen: 0.65,
    sheenColor: new THREE.Color('#7a736b')
  });

  return { cushion, piping, wood, metal, chrome, darkRubber, felt };
}

function tagMesh(mesh, slot) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.slot = slot;
  return mesh;
}

/**
 * Parallel-transport tapered tube along a CatmullRomCurve3.
 * Supports elliptical radii via radiusFn(t, angle), twist-free closed loops, and domed end caps.
 */
function buildTaperedTube(THREE, curve, segments, radialSegments, radiusFn, opts = {}) {
  const closed = !!opts.closed;
  const capStart = opts.capStart !== undefined ? opts.capStart : !closed;
  const capEnd = opts.capEnd !== undefined ? opts.capEnd : !closed;
  const capSteps = 3;

  const points = [];
  const tangents = [];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    points.push(curve.getPointAt(u));
    tangents.push(curve.getTangentAt(u).normalize());
  }

  // Parallel transport frames (Bishop frames)
  const normals = new Array(segments + 1);
  const binormals = new Array(segments + 1);

  const t0 = tangents[0];
  const ref = opts.upHint
    ? opts.upHint.clone().normalize()
    : (Math.abs(t0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0));
  if (Math.abs(t0.dot(ref)) > 0.98) {
    ref.set(0, 0, 1);
  }
  const n0 = new THREE.Vector3().crossVectors(t0, ref).normalize();
  const b0 = new THREE.Vector3().crossVectors(t0, n0).normalize();
  normals[0] = n0;
  binormals[0] = b0;

  const q = new THREE.Quaternion();
  for (let i = 1; i <= segments; i++) {
    q.setFromUnitVectors(tangents[i - 1], tangents[i]);
    const ni = normals[i - 1].clone().applyQuaternion(q);
    ni.addScaledVector(tangents[i], -ni.dot(tangents[i])).normalize();
    normals[i] = ni;
    binormals[i] = new THREE.Vector3().crossVectors(tangents[i], ni).normalize();
  }

  // Distribute closing twist evenly for seamless closed loops
  if (closed) {
    const dotN = clamp(normals[segments].dot(normals[0]), -1, 1);
    const crossN = new THREE.Vector3().crossVectors(normals[segments], normals[0]);
    const sign = crossN.dot(tangents[0]) >= 0 ? 1 : -1;
    const twist = Math.acos(dotN) * sign;
    for (let i = 1; i <= segments; i++) {
      const ang = twist * (i / segments);
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const ni = normals[i].clone().multiplyScalar(ca).addScaledVector(binormals[i], sa).normalize();
      normals[i] = ni;
      binormals[i] = new THREE.Vector3().crossVectors(tangents[i], ni).normalize();
    }
  }

  // Assemble ring descriptors (including optional rounded end caps)
  const rings = [];
  if (capStart) {
    const r0 = radiusFn(0, 0);
    const capLen = typeof r0 === 'number' ? r0 * 0.72 : 0.008;
    for (let c = capSteps; c >= 1; c--) {
      const phi = (c / capSteps) * (Math.PI * 0.5);
      const rScale = Math.max(0.002, Math.cos(phi));
      const offset = -Math.sin(phi) * capLen;
      rings.push({
        pos: points[0].clone().addScaledVector(tangents[0], offset),
        n: normals[0],
        b: binormals[0],
        u: 0,
        rScale
      });
    }
  }

  for (let i = 0; i <= segments; i++) {
    rings.push({
      pos: points[i],
      n: normals[i],
      b: binormals[i],
      u: i / segments,
      rScale: 1
    });
  }

  if (capEnd) {
    const r1 = radiusFn(1, 0);
    const capLen = typeof r1 === 'number' ? r1 * 0.72 : 0.008;
    for (let c = 1; c <= capSteps; c++) {
      const phi = (c / capSteps) * (Math.PI * 0.5);
      const rScale = Math.max(0.002, Math.cos(phi));
      const offset = Math.sin(phi) * capLen;
      rings.push({
        pos: points[segments].clone().addScaledVector(tangents[segments], offset),
        n: normals[segments],
        b: binormals[segments],
        u: 1,
        rScale
      });
    }
  }

  const ringCount = rings.length;
  const stride = radialSegments + 1;
  const positions = new Float32Array(ringCount * stride * 3);
  const uvs = new Float32Array(ringCount * stride * 2);

  let pIdx = 0;
  let uvIdx = 0;
  for (let i = 0; i < ringCount; i++) {
    const ring = rings[i];
    for (let j = 0; j <= radialSegments; j++) {
      const vFrac = j / radialSegments;
      const ang = vFrac * Math.PI * 2;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const rad = radiusFn(ring.u, ang) * ring.rScale;

      positions[pIdx++] = ring.pos.x + (ring.n.x * ca + ring.b.x * sa) * rad;
      positions[pIdx++] = ring.pos.y + (ring.n.y * ca + ring.b.y * sa) * rad;
      positions[pIdx++] = ring.pos.z + (ring.n.z * ca + ring.b.z * sa) * rad;

      uvs[uvIdx++] = ring.u * 2.5;
      uvs[uvIdx++] = vFrac;
    }
  }

  const indices = [];
  for (let i = 0; i < ringCount - 1; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = (i + 1) * stride + j;
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Conforming midpoint subdivision + 3D bending for ExtrudeGeometry so thin bevelled
 * shapes curve smoothly in 3D without faceting or T-junction cracks.
 */
function buildBentExtrude(THREE, shape, extrudeOpts, maxEdgeLen, bendFn) {
  const raw = new THREE.ExtrudeGeometry(shape, extrudeOpts);
  const posAttr = raw.getAttribute('position');

  // Weld raw vertices into indexed mesh first
  const verts = [];
  const vertMap = new Map();
  const keyOf = (x, y, z) => `${Math.round(x * 10000)},${Math.round(y * 10000)},${Math.round(z * 10000)}`;

  function addVert(x, y, z) {
    const k = keyOf(x, y, z);
    let idx = vertMap.get(k);
    if (idx === undefined) {
      idx = verts.length;
      verts.push([x, y, z]);
      vertMap.set(k, idx);
    }
    return idx;
  }

  let tris = [];
  if (raw.index) {
    const idxArr = raw.index.array;
    for (let i = 0; i < idxArr.length; i += 3) {
      const a = addVert(posAttr.getX(idxArr[i]), posAttr.getY(idxArr[i]), posAttr.getZ(idxArr[i]));
      const b = addVert(posAttr.getX(idxArr[i + 1]), posAttr.getY(idxArr[i + 1]), posAttr.getZ(idxArr[i + 1]));
      const c = addVert(posAttr.getX(idxArr[i + 2]), posAttr.getY(idxArr[i + 2]), posAttr.getZ(idxArr[i + 2]));
      if (a !== b && b !== c && c !== a) tris.push([a, b, c]);
    }
  } else {
    for (let i = 0; i < posAttr.count; i += 3) {
      const a = addVert(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      const b = addVert(posAttr.getX(i + 1), posAttr.getY(i + 1), posAttr.getZ(i + 1));
      const c = addVert(posAttr.getX(i + 2), posAttr.getY(i + 2), posAttr.getZ(i + 2));
      if (a !== b && b !== c && c !== a) tris.push([a, b, c]);
    }
  }
  raw.dispose();

  const maxLenSq = maxEdgeLen * maxEdgeLen;
  const edgeKey = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);

  for (let pass = 0; pass < 5; pass++) {
    const splitMap = new Map();
    for (let i = 0; i < tris.length; i++) {
      const [a, b, c] = tris[i];
      const edges = [[a, b], [b, c], [c, a]];
      for (let e = 0; e < 3; e++) {
        const [u, v] = edges[e];
        const ek = edgeKey(u, v);
        if (splitMap.has(ek)) continue;
        const pu = verts[u];
        const pv = verts[v];
        const dx = pu[0] - pv[0];
        const dy = pu[1] - pv[1];
        const dz = pu[2] - pv[2];
        if (dx * dx + dy * dy + dz * dz > maxLenSq) {
          const mid = addVert((pu[0] + pv[0]) * 0.5, (pu[1] + pv[1]) * 0.5, (pu[2] + pv[2]) * 0.5);
          splitMap.set(ek, mid);
        }
      }
    }
    if (splitMap.size === 0) break;

    const nextTris = [];
    for (let i = 0; i < tris.length; i++) {
      const [a, b, c] = tris[i];
      const mab = splitMap.get(edgeKey(a, b));
      const mbc = splitMap.get(edgeKey(b, c));
      const mca = splitMap.get(edgeKey(c, a));
      const count = (mab !== undefined ? 1 : 0) + (mbc !== undefined ? 1 : 0) + (mca !== undefined ? 1 : 0);

      if (count === 0) {
        nextTris.push([a, b, c]);
      } else if (count === 3) {
        nextTris.push([a, mab, mca], [mab, b, mbc], [mca, mbc, c], [mab, mbc, mca]);
      } else if (count === 1) {
        if (mab !== undefined) nextTris.push([a, mab, c], [mab, b, c]);
        else if (mbc !== undefined) nextTris.push([b, mbc, a], [mbc, c, a]);
        else nextTris.push([c, mca, b], [mca, a, b]);
      } else {
        // Two edges split
        if (mab === undefined) {
          nextTris.push([c, mca, mbc], [a, b, mbc], [a, mbc, mca]);
        } else if (mbc === undefined) {
          nextTris.push([a, mab, mca], [b, c, mca], [b, mca, mab]);
        } else {
          nextTris.push([b, mbc, mab], [c, a, mab], [c, mab, mbc]);
        }
      }
    }
    tris = nextTris;
  }

  // Compute unbent UVs and apply 3D bendFn
  const positions = new Float32Array(verts.length * 3);
  const uvs = new Float32Array(verts.length * 2);
  const tmp = new THREE.Vector3();

  for (let i = 0; i < verts.length; i++) {
    const [x, y, z] = verts[i];
    uvs[i * 2] = x * 2.1 + 0.5;
    uvs[i * 2 + 1] = y * 2.1 + 0.5;
    tmp.set(x, y, z);
    bendFn(tmp);
    positions[i * 3] = tmp.x;
    positions[i * 3 + 1] = tmp.y;
    positions[i * 3 + 2] = tmp.z;
  }

  const indices = new Uint32Array(tris.length * 3);
  for (let i = 0; i < tris.length; i++) {
    indices[i * 3] = tris[i][0];
    indices[i * 3 + 1] = tris[i][1];
    indices[i * 3 + 2] = tris[i][2];
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();
  return geo;
}

function buildLathe(THREE, pts, segs = 28) {
  const v2 = pts.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y));
  const geo = new THREE.LatheGeometry(v2, segs);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sculpted seat cushion from a dense SphereGeometry with superellipsoid squircle plan,
 * ergonomic body dip, waterfall front edge, seam grooves, azimuthal UVs, and fitted piping.
 */
function buildSeatCushion(THREE, kit, cfg, matCushion, matPiping) {
  const width = cfg.width || 0.46;
  const depth = cfg.depth || 0.44;
  const thickness = cfg.thickness || 0.068;
  const topY = cfg.topY !== undefined ? cfg.topY : 0.45;
  const dipDepth = cfg.dipDepth !== undefined ? cfg.dipDepth : 0.013;
  const backTaper = cfg.backTaper !== undefined ? cfg.backTaper : 0.09;
  const squircleP = cfg.squircleP !== undefined ? cfg.squircleP : 3.2;
  const waterfall = cfg.waterfall !== undefined ? cfg.waterfall : 0.010;
  const lowerPiping = cfg.lowerPiping !== undefined ? cfg.lowerPiping : true;
  const centerZ = cfg.centerZ || 0.0;
  const pipingRadius = cfg.pipingRadius || 0.0042;

  const centerY = topY - thickness * 0.5;
  const topLat = 0.48;
  const botLat = -0.48;

  function evalPoint(ux, uy, uz, out) {
    const r2d = Math.hypot(ux, uz);
    const theta = Math.atan2(uz, ux);
    const ca = Math.abs(Math.cos(theta));
    const sa = Math.abs(Math.sin(theta));
    const sqRaw = 1 / Math.pow(Math.pow(ca, squircleP) + Math.pow(sa, squircleP), 1 / squircleP);
    const sqBlend = 1 + (sqRaw - 1) * smoothstep(0.0, 0.35, r2d);

    const nx = ux * sqBlend;
    const nz = uz * sqBlend;

    const taperX = 1 - backTaper * smoothstep(-0.1, -1.0, nz) + 0.025 * smoothstep(0.2, 1.0, nz);

    // Subtle fabric seam tuck right at piping latitudes
    const topGroove = Math.exp(-Math.pow((uy - topLat) / 0.11, 2));
    const botGroove = lowerPiping ? Math.exp(-Math.pow((uy - botLat) / 0.11, 2)) : 0;
    const seamTuck = 1 - 0.016 * (topGroove + botGroove);

    let px = nx * (width * 0.5) * taperX * seamTuck;
    let pz = nz * (depth * 0.5) * seamTuck;

    // Plump vertical superellipsoid profile (flatter underside, dome top)
    const expY = uy >= 0 ? 0.54 : 0.62;
    let py = Math.sign(uy) * Math.pow(Math.abs(uy), expY) * (thickness * 0.5);

    // Slight inviting body dip on upper cushion surface
    const topMask = Math.pow(Math.max(0, uy), 0.72);
    const nzDip = nz + 0.07;
    const mainDip = dipDepth * Math.exp(-((nx / 0.60) * (nx / 0.60) + (nzDip / 0.56) * (nzDip / 0.56)));
    const thighL = Math.exp(-(((nx - 0.35) / 0.32) ** 2 + ((nz - 0.34) / 0.42) ** 2));
    const thighR = Math.exp(-(((nx + 0.35) / 0.32) ** 2 + ((nz - 0.34) / 0.42) ** 2));
    const thighDip = dipDepth * 0.22 * (thighL + thighR);
    // Gentle bolster lift near outer perimeter
    const bolster = dipDepth * 0.18 * smoothstep(0.55, 0.92, r2d) * (1 - smoothstep(0.92, 1.0, r2d));

    py += (-mainDip - thighDip + bolster) * topMask;

    // Soft waterfall curve along front edge (+z)
    const wf = smoothstep(0.55, 1.0, nz);
    py -= waterfall * wf * wf * (0.45 + 0.55 * Math.max(0, uy));

    // Tiny cozy hand-upholstered softness
    const micro = (kit.noise(px * 9.5 + 3.1, pz * 9.5 + 1.7) - 0.5) * 0.0018 * topMask;
    py += micro;

    out.set(px, py + centerY, pz + centerZ);
    return out;
  }

  const geo = new THREE.SphereGeometry(1, 64, 42);
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  const tmp = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);
    evalPoint(ux, uy, uz, tmp);
    pos.setXYZ(i, tmp.x, tmp.y, tmp.z);

    // Azimuthal equidistant UV projection from top center -> zero polar pinching on seat top
    const phi = Math.acos(clamp(uy, -1, 1));
    const theta = Math.atan2(uz, ux);
    uv.setXY(i, 0.5 + (phi / Math.PI) * Math.cos(theta) * 1.4, 0.5 + (phi / Math.PI) * Math.sin(theta) * 1.4);
  }
  geo.computeVertexNormals();

  const group = new THREE.Group();
  const cushionMesh = tagMesh(new THREE.Mesh(geo, matCushion), 'primary');
  group.add(cushionMesh);

  // Fitted perimeter piping cord(s)
  function addPipingRing(latY) {
    const ctrlPts = [];
    const nPts = 44;
    const rHoriz = Math.sqrt(1 - latY * latY);
    for (let i = 0; i < nPts; i++) {
      const ang = (i / nPts) * Math.PI * 2;
      const p = evalPoint(Math.cos(ang) * rHoriz, latY, Math.sin(ang) * rHoriz, new THREE.Vector3());
      // Nudge subtly outward so piping sits neatly proud in the seam groove
      const dx = p.x;
      const dz = p.z - centerZ;
      const dLen = Math.hypot(dx, dz) || 1;
      p.x += (dx / dLen) * (pipingRadius * 0.55);
      p.z += (dz / dLen) * (pipingRadius * 0.55);
      p.y += Math.sign(latY) * (pipingRadius * 0.25);
      ctrlPts.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(ctrlPts, true, 'centripetal');
    const pipeGeo = buildTaperedTube(THREE, curve, 96, 10, () => pipingRadius, { closed: true });
    group.add(tagMesh(new THREE.Mesh(pipeGeo, matPiping), 'accent'));
  }

  addPipingRing(topLat);
  if (lowerPiping) addPipingRing(botLat);

  return group;
}

/**
 * Sculpted curved backrest cushion shaped to cradle the sitter's back, with perimeter piping.
 */
function buildCurvedBackCushion(THREE, kit, cfg, matCushion, matPiping) {
  const width = cfg.width || 0.42;
  const height = cfg.height || 0.26;
  const thickness = cfg.thickness || 0.044;
  const bendRadius = cfg.bendRadius || 0.34;
  const centerY = cfg.centerY || 0.69;
  const centerZ = cfg.centerZ || -0.22;
  const recline = cfg.recline || 0.14;
  const lumbar = cfg.lumbar || 0.014;
  const pipingRadius = cfg.pipingRadius || 0.0038;
  const quilting = !!cfg.quilting;

  const bendCenterZ = centerZ + bendRadius;

  function evalBack(ux, uy, uz, out) {
    const p = 2.85;
    const scale = 1 / Math.pow(
      Math.pow(Math.abs(ux), p) + Math.pow(Math.abs(uy), p) + Math.pow(Math.abs(uz), p),
      1 / p
    );
    const sx = ux * scale;
    const sy = uy * scale;
    const sz = uz * scale;

    // Gentle ergonomic waist taper at bottom and graceful arched crown at top
    const waist = 1 - 0.10 * smoothstep(0.0, -1.0, sy) - 0.04 * smoothstep(0.5, 1.0, sy);
    const topArch = 0.016 * (1 - sx * sx) * smoothstep(-0.2, 1.0, sy);

    const xLocal = sx * (width * 0.5) * waist;
    const yLocal = sy * (height * 0.5) + topArch;

    // Plump front face (+z), slightly flatter back face (-z)
    let zLocal = sz * (thickness * 0.5);
    if (sz > 0) {
      // Subtle ergonomic lumbar contour & optional cozy horizontal channel crease
      const lumbarBump = lumbar * Math.exp(-Math.pow((sy + 0.25) / 0.48, 2)) * (1 - 0.45 * sx * sx);
      zLocal += lumbarBump * smoothstep(0.0, 0.5, sz);
      if (quilting) {
        const crease1 = Math.exp(-Math.pow((sy - 0.16) / 0.09, 2));
        const crease2 = Math.exp(-Math.pow((sy + 0.32) / 0.09, 2));
        zLocal -= 0.0045 * (crease1 + crease2) * (1 - 0.5 * Math.pow(Math.abs(sx), 3)) * smoothstep(0.1, 0.6, sz);
      }
      zLocal += (kit.noise(xLocal * 10 + 2.1, yLocal * 10 + 5.3) - 0.5) * 0.0014 * sz;
    } else {
      zLocal *= 0.72;
    }

    // Wrap smoothly around vertical body cylinder
    const ang = xLocal / bendRadius;
    const r = bendRadius - zLocal;
    const rx = r * Math.sin(ang);
    const rz = bendCenterZ - r * Math.cos(ang);

    // Subtle recline backward as height increases
    const dy = yLocal;
    const yFinal = centerY + dy * Math.cos(recline);
    const zFinal = rz - dy * Math.sin(recline);

    out.set(rx, yFinal, zFinal);
    return out;
  }

  const geo = new THREE.SphereGeometry(1, 56, 36);
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  const tmp = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);
    evalBack(ux, uy, uz, tmp);
    pos.setXYZ(i, tmp.x, tmp.y, tmp.z);

    // Smooth front-projected UVs with wrap
    uv.setXY(i, 0.5 + ux * 0.85, 0.5 + uy * 0.65 + (1 - Math.abs(uz)) * 0.08 * Math.sign(uy));
  }
  geo.computeVertexNormals();

  const group = new THREE.Group();
  group.add(tagMesh(new THREE.Mesh(geo, matCushion), 'primary'));

  // Perimeter piping seam around the curved backrest
  const pipePts = [];
  const nPts = 48;
  for (let i = 0; i < nPts; i++) {
    const ang = (i / nPts) * Math.PI * 2;
    const p = evalBack(Math.cos(ang) * 0.96, Math.sin(ang) * 0.96, 0.28, new THREE.Vector3());
    pipePts.push(p);
  }
  const pipeCurve = new THREE.CatmullRomCurve3(pipePts, true, 'centripetal');
  const pipeGeo = buildTaperedTube(THREE, pipeCurve, 96, 10, () => pipingRadius, { closed: true });
  group.add(tagMesh(new THREE.Mesh(pipeGeo, matPiping), 'accent'));

  return group;
}

/**
 * Helper to create an ergonomic backrest THREE.Shape drawn with bezierCurveTo.
 */
function makeBackShellShape(halfW, halfH, bottomTaper = 0.86, archH = 0.028) {
  const s = new THREE.Shape();
  const bw = halfW * bottomTaper;
  s.moveTo(-bw * 0.72, -halfH);
  s.bezierCurveTo(-bw * 1.04, -halfH, -halfW * 1.04, -halfH * 0.25, -halfW, halfH * 0.35);
  s.bezierCurveTo(-halfW * 0.98, halfH * 0.92, -halfW * 0.55, halfH + archH, 0, halfH + archH);
  s.bezierCurveTo(halfW * 0.55, halfH + archH, halfW * 0.98, halfH * 0.92, halfW, halfH * 0.35);
  s.bezierCurveTo(halfW * 1.04, -halfH * 0.25, bw * 1.04, -halfH, bw * 0.72, -halfH);
  s.bezierCurveTo(bw * 0.25, -halfH - 0.008, -bw * 0.25, -halfH - 0.008, -bw * 0.72, -halfH);
  return s;
}

/**
 * VARIANT 0: Bentwood Wooden Chair
 * Steam-bent curved plywood shell + inner upholstered back pad, sculpted dipped seat cushion
 * with piping, bentwood half-arm rails, splayed tapered wooden legs with brass ferrules.
 */
function buildVariant0Bentwood(THREE, kit, mats, body, base) {
  const seatGroup = new THREE.Group();
  seatGroup.name = 'seat';
  body.add(seatGroup);

  const backGroup = new THREE.Group();
  backGroup.name = 'back';
  body.add(backGroup);

  // 1. Sculpted dipped seat cushion (top surface at 0.45 m)
  const cushion = buildSeatCushion(THREE, kit, {
    width: 0.455,
    depth: 0.435,
    thickness: 0.056,
    topY: 0.45,
    dipDepth: 0.012,
    backTaper: 0.10,
    waterfall: 0.009,
    lowerPiping: true,
    centerZ: 0.015,
    pipingRadius: 0.004
  }, mats.cushion, mats.piping);
  seatGroup.add(cushion);

  // 2. Curved bentwood under-seat cradle pan (ExtrudeGeometry bent slightly to match cushion)
  const panShape = new THREE.Shape();
  const pw = 0.228;
  const pd = 0.215;
  panShape.moveTo(-pw * 0.72, -pd);
  panShape.bezierCurveTo(-pw * 1.02, -pd, -pw * 1.02, 0, -pw * 0.96, pd * 0.72);
  panShape.bezierCurveTo(-pw * 0.92, pd * 1.02, -pw * 0.45, pd * 1.03, 0, pd * 1.03);
  panShape.bezierCurveTo(pw * 0.45, pd * 1.03, pw * 0.92, pd * 1.02, pw * 0.96, pd * 0.72);
  panShape.bezierCurveTo(pw * 1.02, 0, pw * 1.02, -pd, pw * 0.72, -pd);
  panShape.bezierCurveTo(pw * 0.3, -pd * 1.03, -pw * 0.3, -pd * 1.03, -pw * 0.72, -pd);

  const panGeo = buildBentExtrude(THREE, panShape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 4,
    curveSegments: 24
  }, 0.045, (v) => {
    const x = v.x;
    const z = v.y;
    const t = v.z - 0.007;
    // Slight ergonomic cradle upward at sides and waterfall dip at front
    const sideLift = 0.011 * Math.pow(Math.abs(x) / pw, 2.2);
    const frontDrop = 0.008 * smoothstep(0.10, pd, z);
    v.set(x, 0.394 + t + sideLift - frontDrop, z + 0.015);
  });
  seatGroup.add(tagMesh(new THREE.Mesh(panGeo, mats.wood), 'wood'));

  // 3. Steam-bent curved plywood backrest shell (ExtrudeGeometry bent around body)
  const backRadius = 0.31;
  const backCenterY = 0.705;
  const backCenterZ = -0.228;
  const backRecline = 0.145;
  const bendCZ = backCenterZ + backRadius;

  const backShape = makeBackShellShape(0.245, 0.132, 0.88, 0.022);
  const backShellGeo = buildBentExtrude(THREE, backShape, {
    depth: 0.013,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 4,
    curveSegments: 28
  }, 0.032, (v) => {
    const xL = v.x;
    const yL = v.y;
    const zL = v.z - 0.0065;
    const lumbarZ = 0.009 * Math.cos((yL / 0.14) * Math.PI * 0.5);
    const ang = xL / backRadius;
    const r = backRadius - (zL + lumbarZ);
    const bx = r * Math.sin(ang);
    const bz = bendCZ - r * Math.cos(ang);
    v.set(bx, backCenterY + yL * Math.cos(backRecline), bz - yL * Math.sin(backRecline));
  });
  backGroup.add(tagMesh(new THREE.Mesh(backShellGeo, mats.wood), 'wood'));

  // 4. Sculpted inner upholstered backrest pad framed by the warm bentwood border
  const backPad = buildCurvedBackCushion(THREE, kit, {
    width: 0.405,
    height: 0.215,
    thickness: 0.030,
    bendRadius: backRadius - 0.016,
    centerY: backCenterY - 0.002,
    centerZ: backCenterZ + 0.019,
    recline: backRecline,
    lumbar: 0.011,
    pipingRadius: 0.0034
  }, mats.cushion, mats.piping);
  backGroup.add(backPad);

  // 5. Two sculptural steam-bent wooden back-spine supports + decorative brass cap bolts
  const boltGeo = buildLathe(THREE, [
    [0.0005, 0.0],
    [0.0095, 0.0],
    [0.0102, 0.0018],
    [0.0095, 0.0038],
    [0.0078, 0.0054],
    [0.0052, 0.0066],
    [0.0022, 0.0072],
    [0.0002, 0.0074]
  ], 18);

  for (const side of [-1, 1]) {
    const spineCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.095, 0.378, -0.02),
      new THREE.Vector3(side * 0.105, 0.382, -0.145),
      new THREE.Vector3(side * 0.112, 0.445, -0.218),
      new THREE.Vector3(side * 0.118, 0.565, -0.236),
      new THREE.Vector3(side * 0.122, 0.695, -0.228)
    ]);
    const spineGeo = buildTaperedTube(THREE, spineCurve, 36, 14, (t, a) => {
      const baseR = lerp(0.0155, 0.0115, t);
      return baseR * (1 + 0.24 * Math.cos(2 * a));
    });
    backGroup.add(tagMesh(new THREE.Mesh(spineGeo, mats.wood), 'wood'));

    // Brass decorative bolts on outer back of bentwood shell
    for (const by of [0.655, 0.725]) {
      const ang = (side * 0.122) / backRadius;
      const dy = by - backCenterY;
      const rOuter = backRadius + 0.008;
      const bx = rOuter * Math.sin(ang);
      const bz = bendCZ - rOuter * Math.cos(ang) - dy * Math.sin(backRecline);
      const bolt = tagMesh(new THREE.Mesh(boltGeo, mats.metal), 'metal');
      bolt.position.set(bx, by, bz);
      bolt.rotation.x = -Math.PI * 0.5 - backRecline;
      bolt.rotation.z = -ang;
      backGroup.add(bolt);
    }
  }

  // 6. Graceful desk-friendly steam-bent wooden half-armrests curving from back shell to seat side
  for (const side of [-1, 1]) {
    const armGroup = new THREE.Group();
    armGroup.name = side > 0 ? 'armL' : 'armR';

    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.218, 0.665, -0.142),
      new THREE.Vector3(side * 0.252, 0.618, -0.045),
      new THREE.Vector3(side * 0.258, 0.565, 0.075),
      new THREE.Vector3(side * 0.244, 0.485, 0.135),
      new THREE.Vector3(side * 0.215, 0.400, 0.105)
    ]);
    const armGeo = buildTaperedTube(THREE, armCurve, 36, 14, (t, a) => {
      const r = 0.0135 * (1 - 0.15 * Math.abs(t - 0.45));
      return r * (1 + 0.28 * Math.cos(2 * a));
    });
    armGroup.add(tagMesh(new THREE.Mesh(armGeo, mats.wood), 'wood'));
    body.add(armGroup);
  }

  // 7. Splayed tapered wooden legs with brass ferrules, felt glides, and sculpted under-seat stretcher
  const ferruleGeo = buildLathe(THREE, [
    [0.0112, 0.004],
    [0.0116, 0.008],
    [0.0121, 0.015],
    [0.0126, 0.023],
    [0.0131, 0.032],
    [0.0136, 0.042],
    [0.0139, 0.046],
    [0.0120, 0.047],
    [0.0115, 0.044],
    [0.0110, 0.038],
    [0.0106, 0.028],
    [0.0102, 0.018],
    [0.0100, 0.010],
    [0.0098, 0.006],
    [0.0050, 0.004],
    [0.0005, 0.004]
  ], 20);

  const glideGeo = buildLathe(THREE, [
    [0.0005, 0.0],
    [0.0105, 0.0],
    [0.0114, 0.0012],
    [0.0114, 0.0042],
    [0.0106, 0.0052],
    [0.0005, 0.0052]
  ], 18);

  const legSpecs = [
    { top: [-0.155, 0.392, 0.135], mid: [-0.188, 0.215, 0.175], bot: [-0.218, 0.004, 0.215] },
    { top: [0.155, 0.392, 0.135], mid: [0.188, 0.215, 0.175], bot: [0.218, 0.004, 0.215] },
    { top: [-0.148, 0.392, -0.115], mid: [-0.184, 0.215, -0.165], bot: [-0.216, 0.004, -0.212] },
    { top: [0.148, 0.392, -0.115], mid: [0.184, 0.215, -0.165], bot: [0.216, 0.004, -0.212] }
  ];

  for (const spec of legSpecs) {
    const pTop = new THREE.Vector3(...spec.top);
    const pMid = new THREE.Vector3(...spec.mid);
    const pBot = new THREE.Vector3(...spec.bot);
    const legCurve = new THREE.CatmullRomCurve3([pBot.clone().setY(0.036), pMid, pTop]);
    const legGeo = buildTaperedTube(THREE, legCurve, 26, 16, (t) => lerp(0.0132, 0.0205, Math.pow(t, 0.82)));
    base.add(tagMesh(new THREE.Mesh(legGeo, mats.wood), 'wood'));

    // Align brass ferrule along lower leg direction
    const lowerDir = pMid.clone().sub(pBot).normalize();
    const ferrule = tagMesh(new THREE.Mesh(ferruleGeo, mats.metal), 'metal');
    ferrule.position.copy(pBot);
    ferrule.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), lowerDir);
    base.add(ferrule);

    // Flat floor-contact felt glide at exact y = 0
    const glide = tagMesh(new THREE.Mesh(glideGeo, mats.felt), 'secondary');
    glide.position.set(pBot.x, 0, pBot.z);
    base.add(glide);
  }

  // Sculpted under-seat cross-frame rails connecting the 4 legs cleanly
  const railCurves = [
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.155, 0.376, 0.135),
      new THREE.Vector3(0, 0.372, 0.010),
      new THREE.Vector3(0.148, 0.376, -0.115)
    ]),
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.155, 0.376, 0.135),
      new THREE.Vector3(0, 0.372, 0.010),
      new THREE.Vector3(-0.148, 0.376, -0.115)
    ]),
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.185, 0.215, 0.174),
      new THREE.Vector3(-0.176, 0.222, 0.005),
      new THREE.Vector3(-0.183, 0.215, -0.163)
    ]),
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.185, 0.215, 0.174),
      new THREE.Vector3(0.176, 0.222, 0.005),
      new THREE.Vector3(0.183, 0.215, -0.163)
    ]),
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.176, 0.222, 0.005),
      new THREE.Vector3(0, 0.228, -0.015),
      new THREE.Vector3(0.176, 0.222, 0.005)
    ])
  ];

  railCurves.forEach((rc, idx) => {
    const rVal = idx < 2 ? 0.0145 : 0.0098;
    const rGeo = buildTaperedTube(THREE, rc, 20, 12, (t) => rVal * (1 + 0.12 * Math.sin(t * Math.PI)));
    base.add(tagMesh(new THREE.Mesh(rGeo, mats.wood), 'wood'));
  });
}

/**
 * VARIANT 1: Swivel Office Chair with Five-Star Base and Dual-Wheel Casters
 * Ergonomic curved cushioned backrest with outer shell, dipped piped seat cushion,
 * curved cantilever armrests with upholstered pads, gas-lift column, 5-star base & casters.
 */
function buildVariant1Swivel(THREE, kit, mats, body, base) {
  const seatGroup = new THREE.Group();
  seatGroup.name = 'seat';
  body.add(seatGroup);

  const backGroup = new THREE.Group();
  backGroup.name = 'back';
  body.add(backGroup);

  // 1. Sculpted dipped seat cushion (top at 0.45 m)
  const cushion = buildSeatCushion(THREE, kit, {
    width: 0.475,
    depth: 0.455,
    thickness: 0.068,
    topY: 0.45,
    dipDepth: 0.014,
    backTaper: 0.08,
    waterfall: 0.012,
    lowerPiping: true,
    centerZ: 0.02,
    pipingRadius: 0.0042
  }, mats.cushion, mats.piping);
  seatGroup.add(cushion);

  // 2. Sculpted under-seat shell & tilt-mechanism housing
  const underPanShape = new THREE.Shape();
  const upw = 0.228;
  const upd = 0.215;
  underPanShape.moveTo(-upw * 0.72, -upd);
  underPanShape.bezierCurveTo(-upw * 1.0, -upd, -upw * 1.0, 0, -upw * 0.95, upd * 0.7);
  underPanShape.bezierCurveTo(-upw * 0.9, upd * 1.0, -upw * 0.4, upd * 1.02, 0, upd * 1.02);
  underPanShape.bezierCurveTo(upw * 0.4, upd * 1.02, upw * 0.9, upd * 1.0, upw * 0.95, upd * 0.7);
  underPanShape.bezierCurveTo(upw * 1.0, 0, upw * 1.0, -upd, upw * 0.72, -upd);
  underPanShape.bezierCurveTo(upw * 0.3, -upd * 1.02, -upw * 0.3, -upd * 1.02, -upw * 0.72, -upd);

  const underPanGeo = buildBentExtrude(THREE, underPanShape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.005,
    bevelSegments: 4,
    curveSegments: 24
  }, 0.048, (v) => {
    const x = v.x;
    const z = v.y;
    const t = v.z - 0.007;
    const cup = 0.012 * Math.pow(Math.hypot(x / upw, z / upd), 2.0);
    v.set(x, 0.382 + t + cup * 0.7, z + 0.02);
  });
  seatGroup.add(tagMesh(new THREE.Mesh(underPanGeo, mats.wood), 'wood'));

  // Sculpted tilt-mechanism box beneath the seat
  const mechGeo = new THREE.SphereGeometry(1, 32, 24);
  const mPos = mechGeo.getAttribute('position');
  for (let i = 0; i < mPos.count; i++) {
    const ux = mPos.getX(i);
    const uy = mPos.getY(i);
    const uz = mPos.getZ(i);
    const p = 3.6;
    const sc = 1 / Math.pow(Math.pow(Math.abs(ux), p) + Math.pow(Math.abs(uy), p) + Math.pow(Math.abs(uz), p), 1 / p);
    mPos.setXYZ(i, ux * sc * 0.082, uy * sc * 0.028 + 0.362, uz * sc * 0.095 - 0.01);
  }
  mechGeo.computeVertexNormals();
  seatGroup.add(tagMesh(new THREE.Mesh(mechGeo, mats.metal), 'metal'));

  // Tilt-tension adjustment knob (LatheGeometry) at front of mechanism
  const knobGeo = buildLathe(THREE, [
    [0.0005, 0.0],
    [0.010, 0.0],
    [0.011, 0.012],
    [0.016, 0.016],
    [0.022, 0.020],
    [0.024, 0.026],
    [0.023, 0.036],
    [0.024, 0.044],
    [0.022, 0.050],
    [0.018, 0.054],
    [0.013, 0.056],
    [0.008, 0.057],
    [0.004, 0.0575],
    [0.002, 0.0578],
    [0.001, 0.058],
    [0.0005, 0.058]
  ], 20);
  const knob = tagMesh(new THREE.Mesh(knobGeo, mats.darkRubber), 'secondary');
  knob.position.set(0, 0.348, 0.058);
  knob.rotation.x = Math.PI * 0.72;
  seatGroup.add(knob);

  // Height-adjustment lever paddle on sitter's right side (-x)
  const leverCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.072, 0.358, 0.005),
    new THREE.Vector3(-0.145, 0.354, 0.012),
    new THREE.Vector3(-0.205, 0.358, 0.022)
  ]);
  const leverGeo = buildTaperedTube(THREE, leverCurve, 14, 10, () => 0.0048);
  seatGroup.add(tagMesh(new THREE.Mesh(leverGeo, mats.chrome), 'metal'));

  const paddleGeo = new THREE.SphereGeometry(1, 20, 16);
  const pp = paddleGeo.getAttribute('position');
  for (let i = 0; i < pp.count; i++) {
    const ux = pp.getX(i);
    const uy = pp.getY(i);
    const uz = pp.getZ(i);
    const sc = 1 / Math.pow(Math.pow(Math.abs(ux), 3.0) + Math.pow(Math.abs(uy), 3.0) + Math.pow(Math.abs(uz), 3.0), 1 / 3.0);
    pp.setXYZ(i, ux * sc * 0.032 - 0.222, uy * sc * 0.006 + 0.359, uz * sc * 0.018 + 0.025);
  }
  paddleGeo.computeVertexNormals();
  seatGroup.add(tagMesh(new THREE.Mesh(paddleGeo, mats.darkRubber), 'secondary'));

  // 3. Curved ergonomic backrest: warm sculpted outer shell + quilted inner cushion with piping
  const backRadius = 0.34;
  const backCenterY = 0.675;
  const backCenterZ = -0.225;
  const backRecline = 0.135;
  const bendCZ = backCenterZ + backRadius;

  const shellShape = makeBackShellShape(0.242, 0.175, 0.86, 0.026);
  const shellGeo = buildBentExtrude(THREE, shellShape, {
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.005,
    bevelSegments: 4,
    curveSegments: 28
  }, 0.035, (v) => {
    const xL = v.x;
    const yL = v.y;
    const zL = v.z - 0.006;
    const lumbarZ = 0.012 * Math.cos((yL / 0.18) * Math.PI * 0.5);
    const ang = xL / backRadius;
    const r = backRadius - (zL + lumbarZ);
    const bx = r * Math.sin(ang);
    const bz = bendCZ - r * Math.cos(ang);
    v.set(bx, backCenterY + yL * Math.cos(backRecline), bz - yL * Math.sin(backRecline));
  });
  backGroup.add(tagMesh(new THREE.Mesh(shellGeo, mats.wood), 'wood'));

  const backCushion = buildCurvedBackCushion(THREE, kit, {
    width: 0.445,
    height: 0.335,
    thickness: 0.044,
    bendRadius: backRadius - 0.014,
    centerY: backCenterY + 0.002,
    centerZ: backCenterZ + 0.020,
    recline: backRecline,
    lumbar: 0.015,
    pipingRadius: 0.004,
    quilting: true
  }, mats.cushion, mats.piping);
  backGroup.add(backCushion);

  // Curved J-bar structural metal spine connecting tilt mechanism to backrest shell
  const jSpineCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.358, -0.045),
    new THREE.Vector3(0, 0.355, -0.175),
    new THREE.Vector3(0, 0.395, -0.252),
    new THREE.Vector3(0, 0.495, -0.264),
    new THREE.Vector3(0, 0.635, -0.256)
  ]);
  const jSpineGeo = buildTaperedTube(THREE, jSpineCurve, 34, 16, (t, a) => {
    const baseR = lerp(0.022, 0.016, t);
    // Wide flat-oval cross-section
    const rx = baseR * 1.45;
    const ry = baseR * 0.62;
    return (rx * ry) / Math.hypot(ry * Math.cos(a), rx * Math.sin(a));
  });
  backGroup.add(tagMesh(new THREE.Mesh(jSpineGeo, mats.metal), 'metal'));

  // 4. Curved cantilever armrests with sculpted soft upholstered arm pads
  for (const side of [-1, 1]) {
    const armGroup = new THREE.Group();
    armGroup.name = side > 0 ? 'armL' : 'armR';

    const armFrameCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.145, 0.376, -0.01),
      new THREE.Vector3(side * 0.255, 0.388, -0.012),
      new THREE.Vector3(side * 0.278, 0.465, -0.028),
      new THREE.Vector3(side * 0.276, 0.585, -0.018),
      new THREE.Vector3(side * 0.272, 0.612, 0.065),
      new THREE.Vector3(side * 0.268, 0.608, 0.142)
    ]);
    const armFrameGeo = buildTaperedTube(THREE, armFrameCurve, 36, 14, (t, a) => {
      const r = lerp(0.014, 0.011, t);
      return r * (1 + 0.22 * Math.cos(2 * a));
    });
    armGroup.add(tagMesh(new THREE.Mesh(armFrameGeo, mats.metal), 'metal'));

    // Soft sculpted upholstered arm pad sitting atop the metal rail
    const padGeo = new THREE.SphereGeometry(1, 28, 20);
    const pPos = padGeo.getAttribute('position');
    const pUv = padGeo.getAttribute('uv');
    for (let i = 0; i < pPos.count; i++) {
      const ux = pPos.getX(i);
      const uy = pPos.getY(i);
      const uz = pPos.getZ(i);
      const sc = 1 / Math.pow(Math.pow(Math.abs(ux), 2.8) + Math.pow(Math.abs(uy), 2.8) + Math.pow(Math.abs(uz), 2.8), 1 / 2.8);
      const lx = ux * sc * 0.028;
      const ly = uy * sc * 0.014;
      const lz = uz * sc * 0.105;
      pPos.setXYZ(i, side * 0.271 + lx, 0.622 + ly, 0.056 + lz);
      pUv.setXY(i, 0.5 + ux * 0.35, 0.5 + uz * 0.8);
    }
    padGeo.computeVertexNormals();
    armGroup.add(tagMesh(new THREE.Mesh(padGeo, mats.cushion), 'primary'));
    body.add(armGroup);
  }

  // 5. Pneumatic gas-lift column & central 5-star hub (LatheGeometry, >= 20 points)
  const pistonGeo = buildLathe(THREE, [
    [0.0005, 0.245],
    [0.0155, 0.245],
    [0.0155, 0.348],
    [0.0190, 0.352],
    [0.0200, 0.362],
    [0.0190, 0.370],
    [0.0005, 0.370]
  ], 24);
  body.add(tagMesh(new THREE.Mesh(pistonGeo, mats.chrome), 'metal'));

  const columnOuterGeo = buildLathe(THREE, [
    [0.0005, 0.072],
    [0.024, 0.072],
    [0.026, 0.078],
    [0.027, 0.095],
    [0.044, 0.098],
    [0.048, 0.108],
    [0.046, 0.124],
    [0.036, 0.135],
    [0.028, 0.145],
    [0.0265, 0.175],
    [0.0260, 0.215],
    [0.0255, 0.242],
    [0.0245, 0.248],
    [0.0215, 0.252],
    [0.0180, 0.253],
    [0.0160, 0.253],
    [0.0160, 0.248],
    [0.0005, 0.248]
  ], 28);
  base.add(tagMesh(new THREE.Mesh(columnOuterGeo, mats.metal), 'metal'));

  // 6. Five-star sculpted tapered base legs + detailed dual-wheel hooded casters on y = 0
  const wheelRadius = 0.025;
  const wheelGeo = buildLathe(THREE, [
    [0.003, -0.0075],
    [0.014, -0.0075],
    [0.016, -0.0062],
    [0.021, -0.0062],
    [0.0235, -0.0072],
    [0.0250, -0.0052],
    [0.0252, -0.0020],
    [0.0252, 0.0020],
    [0.0250, 0.0052],
    [0.0235, 0.0072],
    [0.021, 0.0062],
    [0.016, 0.0062],
    [0.014, 0.0075],
    [0.003, 0.0075],
    [0.002, 0.0040],
    [0.002, -0.0040]
  ], 24);
  wheelGeo.rotateZ(Math.PI * 0.5);

  const hubcapGeo = buildLathe(THREE, [
    [0.0005, 0.0],
    [0.012, 0.0],
    [0.0125, 0.0018],
    [0.010, 0.0032],
    [0.006, 0.0038],
    [0.0005, 0.0040]
  ], 18);
  hubcapGeo.rotateZ(-Math.PI * 0.5);

  const stemGeo = buildLathe(THREE, [
    [0.0005, 0.036],
    [0.0075, 0.036],
    [0.0085, 0.044],
    [0.0085, 0.050],
    [0.0062, 0.052],
    [0.0060, 0.072],
    [0.0005, 0.072]
  ], 16);

  const socketGeo = buildLathe(THREE, [
    [0.0005, 0.062],
    [0.0145, 0.062],
    [0.0160, 0.066],
    [0.0162, 0.076],
    [0.0150, 0.084],
    [0.0100, 0.088],
    [0.0005, 0.088]
  ], 18);

  // Sculpted caster hood dome shielding the dual wheels
  const hoodGeo = new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.58);
  const hPos = hoodGeo.getAttribute('position');
  for (let i = 0; i < hPos.count; i++) {
    const ux = hPos.getX(i);
    const uy = hPos.getY(i);
    const uz = hPos.getZ(i);
    hPos.setXYZ(i, ux * 0.0245, uy * 0.0285 + 0.024, uz * 0.0295);
  }
  hoodGeo.computeVertexNormals();

  const armRadius = 0.285;
  const casterSwivelOffsets = [0.18, -0.26, 0.34, -0.15, 0.22];

  for (let k = 0; k < 5; k++) {
    const ang = (k / 5) * Math.PI * 2 + Math.PI * 0.1;
    const dx = Math.cos(ang);
    const dz = Math.sin(ang);

    const starCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(dx * 0.032, 0.116, dz * 0.032),
      new THREE.Vector3(dx * 0.115, 0.106, dz * 0.115),
      new THREE.Vector3(dx * 0.215, 0.090, dz * 0.215),
      new THREE.Vector3(dx * armRadius, 0.076, dz * armRadius)
    ]);

    const starArmGeo = buildTaperedTube(THREE, starCurve, 22, 14, (t, a) => {
      const rx = lerp(0.020, 0.013, t);
      const ry = lerp(0.015, 0.010, t);
      return (rx * ry) / Math.hypot(ry * Math.cos(a), rx * Math.sin(a));
    });
    base.add(tagMesh(new THREE.Mesh(starArmGeo, mats.metal), 'metal'));

    // Tip caster socket
    const tipX = dx * armRadius;
    const tipZ = dz * armRadius;
    const socket = tagMesh(new THREE.Mesh(socketGeo, mats.metal), 'metal');
    socket.position.set(tipX, 0, tipZ);
    base.add(socket);

    // Swivel caster assembly resting cleanly on y = 0
    const casterGroup = new THREE.Group();
    casterGroup.position.set(tipX, 0, tipZ);
    casterGroup.rotation.y = -ang + Math.PI * 0.5 + casterSwivelOffsets[k];

    casterGroup.add(tagMesh(new THREE.Mesh(stemGeo, mats.chrome), 'metal'));

    const trailZ = -0.013;
    const hood = tagMesh(new THREE.Mesh(hoodGeo, mats.metal), 'metal');
    hood.position.set(0, 0, trailZ);
    casterGroup.add(hood);

    // Axle connecting the two wheels
    const axleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.020, wheelRadius, trailZ),
      new THREE.Vector3(0.020, wheelRadius, trailZ)
    ]);
    const axleGeo = buildTaperedTube(THREE, axleCurve, 4, 10, () => 0.0045);
    casterGroup.add(tagMesh(new THREE.Mesh(axleGeo, mats.chrome), 'metal'));

    // Dual wheels (bottom touches y = 0.000 exactly)
    for (const wSide of [-1, 1]) {
      const wMesh = tagMesh(new THREE.Mesh(wheelGeo, mats.darkRubber), 'secondary');
      wMesh.position.set(wSide * 0.014, wheelRadius, trailZ);
      casterGroup.add(wMesh);

      const cap = tagMesh(new THREE.Mesh(hubcapGeo, mats.chrome), 'metal');
      cap.position.set(wSide * 0.021, wheelRadius, trailZ);
      if (wSide < 0) cap.rotation.y = Math.PI;
      casterGroup.add(cap);
    }

    base.add(casterGroup);
  }
}

/**
 * VARIANT 2: Cozy Soft Armchair
 * Continuous sculpted wraparound tub backrest & rolled armrests from one dense SphereGeometry,
 * subtle vertical channel tufting with covered buttons, tailored piping along all seams,
 * deep plump dipped seat cushion, upholstered apron, splayed turned wood legs with brass ferrules.
 */
function buildVariant2Armchair(THREE, kit, mats, body, base) {
  const seatGroup = new THREE.Group();
  seatGroup.name = 'seat';
  body.add(seatGroup);

  const backGroup = new THREE.Group();
  backGroup.name = 'back';
  body.add(backGroup);

  // 1. Deep plump sculpted seat cushion (top at 0.45 m) with double piping
  const cushion = buildSeatCushion(THREE, kit, {
    width: 0.482,
    depth: 0.468,
    thickness: 0.102,
    topY: 0.45,
    dipDepth: 0.015,
    backTaper: 0.06,
    squircleP: 3.4,
    waterfall: 0.011,
    lowerPiping: true,
    centerZ: 0.025,
    pipingRadius: 0.0046
  }, mats.cushion, mats.piping);
  seatGroup.add(cushion);

  // 2. Sculpted upholstered lower seat apron/skirt under cushion (y = 0.285 to 0.365)
  const apronGeo = new THREE.SphereGeometry(1, 56, 28);
  const aPos = apronGeo.getAttribute('position');
  const aUv = apronGeo.getAttribute('uv');
  for (let i = 0; i < aPos.count; i++) {
    const ux = aPos.getX(i);
    const uy = aPos.getY(i);
    const uz = aPos.getZ(i);
    const p = 3.8;
    const sc = 1 / Math.pow(Math.pow(Math.abs(ux), p) + Math.pow(Math.abs(uy), p) + Math.pow(Math.abs(uz), p), 1 / p);
    const sx = ux * sc;
    const sy = uy * sc;
    const sz = uz * sc;
    const taper = 1 - 0.05 * smoothstep(-0.2, -1.0, sz);
    aPos.setXYZ(i, sx * 0.278 * taper, sy * 0.044 + 0.328, sz * 0.258 + 0.018);
    aUv.setXY(i, 0.5 + sx * 1.4, 0.5 + sy * 0.4 + sz * 0.8);
  }
  apronGeo.computeVertexNormals();
  seatGroup.add(tagMesh(new THREE.Mesh(apronGeo, mats.cushion), 'primary'));

  // Lower wood plinth frame beneath the upholstered apron
  const plinthShape = new THREE.Shape();
  const plw = 0.248;
  const pld = 0.228;
  plinthShape.moveTo(-plw * 0.72, -pld);
  plinthShape.bezierCurveTo(-plw, -pld, -plw, 0, -plw * 0.96, pld * 0.72);
  plinthShape.bezierCurveTo(-plw * 0.92, pld, -plw * 0.4, pld, 0, pld);
  plinthShape.bezierCurveTo(plw * 0.4, pld, plw * 0.92, pld, plw * 0.96, pld * 0.72);
  plinthShape.bezierCurveTo(plw, 0, plw, -pld, plw * 0.72, -pld);
  plinthShape.bezierCurveTo(plw * 0.3, -pld, -plw * 0.3, -pld, -plw * 0.72, -pld);

  const plinthGeo = buildBentExtrude(THREE, plinthShape, {
    depth: 0.020,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 3,
    curveSegments: 20
  }, 0.06, (v) => {
    v.set(v.x, 0.272 + v.z, v.y + 0.018);
  });
  seatGroup.add(tagMesh(new THREE.Mesh(plinthGeo, mats.wood), 'wood'));

  // 3. ONE continuous sculpted wraparound tub backrest & soft rolled armrests
  // Mapped from a dense SphereGeometry(1, 80, 48) with positive Jacobian orientation
  function evalTubCenter(s) {
    const halfPi = Math.PI * 0.5;
    const sinS = Math.sin(s * halfPi);
    const cosS = Math.cos(s * halfPi);
    const cx = 0.278 * sinS * (1 + 0.03 * sinS * sinS);
    const cz = -0.236 + 0.435 * (1 - Math.pow(Math.max(0, cosS), 1.38));
    return { cx, cz };
  }

  function evalTubFrame(s) {
    const eps = 0.002;
    const p0 = evalTubCenter(clamp(s - eps, -1, 1));
    const p1 = evalTubCenter(clamp(s + eps, -1, 1));
    const c = evalTubCenter(s);
    const tx = p1.cx - p0.cx;
    const tz = p1.cz - p0.cz;
    const len = Math.hypot(tx, tz) || 1;
    // Outward horizontal normal (at s = 0, tangent is (+1, 0), outward normal is (0, -1) -> -z)
    const nx = tz / len;
    const nz = -tx / len;
    return { cx: c.cx, cz: c.cz, nx, nz };
  }

  function evalArmchairShell(ux, uy, uz, out) {
    const p = 2.75;
    const sc = 1 / Math.pow(
      Math.pow(Math.abs(ux), p) + Math.pow(Math.abs(uy), p) + Math.pow(Math.abs(uz), p),
      1 / p
    );
    const s = ux * sc;
    const v = uy * sc;
    // w = -uz so +uz points INWARD (-N, i.e., +z at back), preserving right-handed outward normals!
    const w = -uz * sc;

    const frame = evalTubFrame(s);
    const absS = Math.abs(s);

    // Smooth contour from tall curved backrest (0.84 m) sweeping seamlessly down to soft armrests (0.615 m)
    const backBell = Math.pow(Math.cos(Math.min(1, absS / 0.78) * Math.PI * 0.5), 1.55);
    const yBottom = 0.292;
    const yTop = 0.612 + 0.228 * backBell;

    // Gentle front droop at armrest tips
    const tipRound = 0.022 * smoothstep(0.86, 1.0, absS) * smoothstep(0.0, 1.0, v);
    const y = lerp(yBottom, yTop, (v + 1) * 0.5) - tipRound;

    // Ergonomic recline & welcoming outward flare toward the top rim
    const v01 = (v + 1) * 0.5;
    const flare = (0.022 + 0.044 * backBell) * Math.pow(v01, 1.45);

    // Wall thickness: plump rolled upper edge and thick cozy arms
    const topRoll = 0.008 * smoothstep(0.45, 0.95, v) * (1 - 0.5 * Math.abs(w));
    const halfThick = 0.044 + 0.008 * (1 - backBell) + topRoll;

    // Ergonomic lumbar cushion fullness & subtle vertical channel tufting on inner backrest (w < 0)
    let innerOffset = 0;
    if (w < 0) {
      const innerMask = Math.pow(-w, 0.65);
      const lumbar = 0.017 * Math.exp(-Math.pow((v + 0.14) / 0.48, 2)) * backBell;
      // 4 subtle vertical channel creases across the inner backrest
      const channelEnv = smoothstep(0.58, 0.36, absS) * smoothstep(-0.85, -0.45, v) * smoothstep(0.88, 0.55, v);
      const wave = Math.cos(s * Math.PI * 5.0);
      const flute = 0.0055 * (wave - 0.35) * channelEnv;
      innerOffset = -(lumbar + flute) * innerMask;
    }

    const noiseSoft = (kit.noise(s * 6.5 + 4.1, v * 5.2 + 2.3) - 0.5) * 0.0022;
    const radial = flare + w * halfThick + innerOffset + noiseSoft;

    out.set(frame.cx + frame.nx * radial, y, frame.cz + frame.nz * radial);
    return out;
  }

  const tubGeo = new THREE.SphereGeometry(1, 80, 48);
  const tPos = tubGeo.getAttribute('position');
  const tUv = tubGeo.getAttribute('uv');
  const tmp = new THREE.Vector3();

  for (let i = 0; i < tPos.count; i++) {
    const ux = tPos.getX(i);
    const uy = tPos.getY(i);
    const uz = tPos.getZ(i);
    evalArmchairShell(ux, uy, uz, tmp);
    tPos.setXYZ(i, tmp.x, tmp.y, tmp.z);
    tUv.setXY(i, 0.5 + ux * 2.3 - uz * 0.14, (tmp.y - 0.28) * 2.1);
  }
  tubGeo.computeVertexNormals();
  backGroup.add(tagMesh(new THREE.Mesh(tubGeo, mats.cushion), 'primary'));

  // Continuous tailored piping tracing the sweeping top-outer crest & front arm contours
  const crestPts = [];
  const nCrest = 54;
  for (let i = 0; i <= nCrest; i++) {
    const t = i / nCrest;
    let ux, uy, uz;
    if (t < 0.12) {
      // Right front arm vertical face going up
      const f = t / 0.12;
      ux = -0.94;
      uy = lerp(-0.78, 0.62, f);
      uz = -0.28;
    } else if (t > 0.88) {
      // Left front arm vertical face going down
      const f = (t - 0.88) / 0.12;
      ux = 0.94;
      uy = lerp(0.62, -0.78, f);
      uz = -0.28;
    } else {
      // Sweeping top crest from right arm around backrest crown to left arm
      const f = (t - 0.12) / 0.76;
      ux = lerp(-0.92, 0.92, f);
      uy = 0.78;
      uz = -0.45;
    }
    const norm = Math.hypot(ux, uy, uz);
    const pt = evalArmchairShell(ux / norm, uy / norm, uz / norm, new THREE.Vector3());
    crestPts.push(pt);
  }
  const crestCurve = new THREE.CatmullRomCurve3(crestPts, false, 'centripetal');
  const crestPipeGeo = buildTaperedTube(THREE, crestCurve, 110, 10, () => 0.0048);
  backGroup.add(tagMesh(new THREE.Mesh(crestPipeGeo, mats.piping), 'accent'));

  // Lower apron seam piping around front & sides of base
  const apronPipePts = [];
  for (let i = 0; i < 44; i++) {
    const ang = (i / 44) * Math.PI * 2;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const sc = 1 / Math.pow(Math.pow(Math.abs(ca), 3.8) + Math.pow(Math.abs(sa), 3.8), 1 / 3.8);
    const sx = ca * sc;
    const sz = sa * sc;
    const taper = 1 - 0.05 * smoothstep(-0.2, -1.0, sz);
    apronPipePts.push(new THREE.Vector3(sx * 0.278 * taper, 0.296, sz * 0.258 + 0.018));
  }
  const apronPipeCurve = new THREE.CatmullRomCurve3(apronPipePts, true, 'centripetal');
  const apronPipeGeo = buildTaperedTube(THREE, apronPipeCurve, 84, 9, () => 0.0044, { closed: true });
  seatGroup.add(tagMesh(new THREE.Mesh(apronPipeGeo, mats.piping), 'accent'));

  // Subtle fabric-covered tufted buttons nestled in the inner backrest pleats
  const buttonGeo = buildLathe(THREE, [
    [0.0005, 0.0],
    [0.0095, 0.0],
    [0.0108, 0.0020],
    [0.0105, 0.0045],
    [0.0085, 0.0066],
    [0.0052, 0.0078],
    [0.0022, 0.0082],
    [0.0005, 0.0084]
  ], 18);

  for (const bs of [-0.20, 0.0, 0.20]) {
    const ux = bs;
    const uy = 0.08;
    const uz = Math.sqrt(Math.max(0.01, 1 - ux * ux - uy * uy));
    const bPos = evalArmchairShell(ux, uy, uz, new THREE.Vector3());
    const frame = evalTubFrame(bs);
    const btn = tagMesh(new THREE.Mesh(buttonGeo, mats.piping), 'accent');
    btn.position.copy(bPos);
    const inward = new THREE.Vector3(-frame.nx, -0.14, -frame.nz).normalize();
    btn.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), inward);
    backGroup.add(btn);
  }

  // 4. Splayed turned hardwood mid-century legs (LatheGeometry) with brushed brass ferrules & glides
  const turnedLegGeo = buildLathe(THREE, [
    [0.0120, 0.044],
    [0.0124, 0.055],
    [0.0135, 0.080],
    [0.0150, 0.110],
    [0.0168, 0.145],
    [0.0185, 0.180],
    [0.0200, 0.215],
    [0.0212, 0.245],
    [0.0220, 0.268],
    [0.0224, 0.285],
    [0.0215, 0.292],
    [0.0160, 0.295],
    [0.0005, 0.295]
  ], 22);

  const brassFerruleGeo = buildLathe(THREE, [
    [0.0005, 0.004],
    [0.0102, 0.004],
    [0.0110, 0.008],
    [0.0114, 0.016],
    [0.0118, 0.026],
    [0.0122, 0.036],
    [0.0126, 0.046],
    [0.0130, 0.050],
    [0.0122, 0.052],
    [0.0115, 0.048],
    [0.0108, 0.034],
    [0.0102, 0.018],
    [0.0098, 0.008],
    [0.0005, 0.004]
  ], 20);

  const glideGeo = buildLathe(THREE, [
    [0.0005, 0.0],
    [0.0105, 0.0],
    [0.0112, 0.0014],
    [0.0112, 0.0044],
    [0.0102, 0.0054],
    [0.0005, 0.0054]
  ], 18);

  const legAnchors = [
    { top: [-0.185, 0.284, 0.185], bot: [-0.228, 0.004, 0.232] },
    { top: [0.185, 0.284, 0.185], bot: [0.228, 0.004, 0.232] },
    { top: [-0.176, 0.284, -0.158], bot: [-0.222, 0.004, -0.212] },
    { top: [0.176, 0.284, -0.158], bot: [0.222, 0.004, -0.212] }
  ];

  for (const anc of legAnchors) {
    const pTop = new THREE.Vector3(...anc.top);
    const pBot = new THREE.Vector3(...anc.bot);
    const dir = pTop.clone().sub(pBot);
    const len = dir.length();
    const axis = dir.clone().normalize();
    const qRot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);

    const legMesh = tagMesh(new THREE.Mesh(turnedLegGeo, mats.wood), 'wood');
    legMesh.position.copy(pBot);
    legMesh.quaternion.copy(qRot);
    legMesh.scale.y = len / 0.292;
    base.add(legMesh);

    const ferMesh = tagMesh(new THREE.Mesh(brassFerruleGeo, mats.metal), 'metal');
    ferMesh.position.copy(pBot);
    ferMesh.quaternion.copy(qRot);
    base.add(ferMesh);

    const glide = tagMesh(new THREE.Mesh(glideGeo, mats.felt), 'secondary');
    glide.position.set(pBot.x, 0, pBot.z);
    base.add(glide);
  }
}

export function build(THREE, opts = {}, kit) {
  const safeOpts = opts || {};
  const variant = clamp(Math.round(safeOpts.variant || 0), 0, 2);
  const mats = makeMaterialSet(THREE, kit, safeOpts, variant);

  const root = new THREE.Group();
  root.name = 'deskChair';
  root.userData.variant = variant;

  const base = new THREE.Group();
  base.name = 'base';
  root.add(base);

  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  if (variant === 0) {
    buildVariant0Bentwood(THREE, kit, mats, body, base);
  } else if (variant === 1) {
    buildVariant1Swivel(THREE, kit, mats, body, base);
  } else {
    buildVariant2Armchair(THREE, kit, mats, body, base);
  }

  return root;
}

export function idle(group, t) {
  if (!group) return;
  const body = group.getObjectByName('body');
  const seat = group.getObjectByName('seat');
  const variant = group.userData ? group.userData.variant : 0;

  if (variant === 1 && body) {
    // Gentle lazy swivel and subtle pneumatic tilt settle; base stays planted on floor
    body.rotation.y = Math.sin(t * 0.48) * 0.075;
    body.rotation.x = Math.sin(t * 0.96) * 0.005;
  } else if (seat) {
    // Ultra-subtle cozy cushion breath without disturbing floor contact
    seat.scale.y = 1 + Math.sin(t * 1.1) * 0.003;
  }
}
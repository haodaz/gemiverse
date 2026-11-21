export const META = {
  id: 'griffin_cub',
  name: 'Stylised Griffin Cub',
  kind: 'creature',
  footprint: [0.32, 0.45],
  variants: ['golden', 'snowy', 'russet'],
  note: 'Hero-quality sitting chibi griffin cub (~0.45 m long) with sculpted eagle head, hooked beak, feathered crest and folded wings, lion hindquarters, front talons, and curled tufted tail.'
};

const PALETTES = {
  golden: {
    fur: '#d49a52',
    furAccent: '#f2e8d5',
    eye: '#d97f1c',
    beak: '#e5a435',
    claw: '#2b1e18',
    blush: '#e98a7a'
  },
  snowy: {
    fur: '#ddd6c9',
    furAccent: '#f5f7fa',
    eye: '#479fd4',
    beak: '#d4a657',
    claw: '#2c303a',
    blush: '#e69ba4'
  },
  russet: {
    fur: '#b86839',
    furAccent: '#ebc48a',
    eye: '#3b9b5c',
    beak: '#d68c2b',
    claw: '#251713',
    blush: '#e27b68'
  }
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function parseRgb(THREE, input, fallback) {
  const c = new THREE.Color();
  try {
    c.set(input != null ? input : fallback);
  } catch (_) {
    c.set(fallback);
  }
  const hex = THREE.SRGBColorSpace ? c.getHex(THREE.SRGBColorSpace) : c.getHex();
  return {
    r: (hex >> 16) & 255,
    g: (hex >> 8) & 255,
    b: hex & 255
  };
}

function mixRgb(a, b, t) {
  const u = clamp(t, 0, 1);
  return {
    r: Math.round(a.r + (b.r - a.r) * u),
    g: Math.round(a.g + (b.g - a.g) * u),
    b: Math.round(a.b + (b.b - a.b) * u)
  };
}

function scaleRgb(c, f) {
  return {
    r: clamp(Math.round(c.r * f), 0, 255),
    g: clamp(Math.round(c.g * f), 0, 255),
    b: clamp(Math.round(c.b * f), 0, 255)
  };
}

function rgbStr(c, a) {
  if (a === undefined) return `rgb(${c.r},${c.g},${c.b})`;
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

function rgbToHex(c) {
  return (c.r << 16) | (c.g << 8) | c.b;
}

function makeColorFromRgb(THREE, c) {
  const col = new THREE.Color();
  if (col.setRGB && THREE.SRGBColorSpace) {
    col.setRGB(c.r / 255, c.g / 255, c.b / 255, THREE.SRGBColorSpace);
  } else {
    col.setHex(rgbToHex(c));
  }
  return col;
}

function setSlot(mesh, slot, castShadow = true) {
  mesh.userData.slot = slot;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

function sculptSphere(THREE, widthSegs, heightSegs, deformFn) {
  const geo = new THREE.SphereGeometry(1, widthSegs, heightSegs);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    deformFn(v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function makeTaperedTube(THREE, curve, radiusFn, tubularSegs, radialSegs, opts = {}) {
  const scaleN = opts.scaleN !== undefined ? opts.scaleN : 1.0;
  const scaleB = opts.scaleB !== undefined ? opts.scaleB : 1.0;
  const capStart = opts.capStart !== undefined ? opts.capStart : true;
  const capEnd = opts.capEnd !== undefined ? opts.capEnd : true;
  const capRoundStart = opts.capRoundStart !== undefined ? opts.capRoundStart : 0.6;
  const capRoundEnd = opts.capRoundEnd !== undefined ? opts.capRoundEnd : 0.6;

  const pts = [];
  const tangents = [];
  const normals = [];
  const binormals = [];

  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    pts.push(curve.getPoint(u));
    tangents.push(curve.getTangent(u).normalize());
  }

  const initUp = Math.abs(tangents[0].y) > 0.92
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  const b0 = new THREE.Vector3().crossVectors(tangents[0], initUp).normalize();
  const n0 = new THREE.Vector3().crossVectors(b0, tangents[0]).normalize();
  normals.push(n0);
  binormals.push(b0);

  const axis = new THREE.Vector3();
  for (let i = 1; i <= tubularSegs; i++) {
    const prevT = tangents[i - 1];
    const currT = tangents[i];
    const prevN = normals[i - 1].clone();
    axis.crossVectors(prevT, currT);
    const lenSq = axis.lengthSq();
    if (lenSq > 1e-10) {
      axis.normalize();
      const angle = Math.acos(clamp(prevT.dot(currT), -1, 1));
      prevN.applyAxisAngle(axis, angle);
    }
    prevN.addScaledVector(currT, -prevN.dot(currT)).normalize();
    const currB = new THREE.Vector3().crossVectors(currT, prevN).normalize();
    normals.push(prevN);
    binormals.push(currB);
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const stride = radialSegs + 1;

  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    const r = Math.max(1e-4, radiusFn(u));
    const p = pts[i];
    const n = normals[i];
    const b = binormals[i];
    for (let j = 0; j <= radialSegs; j++) {
      const vFrac = j / radialSegs;
      const theta = vFrac * Math.PI * 2;
      const cn = Math.cos(theta) * r * scaleN;
      const sb = Math.sin(theta) * r * scaleB;
      positions.push(
        p.x + n.x * cn + b.x * sb,
        p.y + n.y * cn + b.y * sb,
        p.z + n.z * cn + b.z * sb
      );
      uvs.push(vFrac, u);
    }
  }

  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = (i + 1) * stride + j;
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  if (capStart) {
    const r0 = Math.max(1e-4, radiusFn(0));
    const centerIdx = positions.length / 3;
    const p0 = pts[0];
    const t0 = tangents[0];
    positions.push(
      p0.x - t0.x * r0 * capRoundStart,
      p0.y - t0.y * r0 * capRoundStart,
      p0.z - t0.z * r0 * capRoundStart
    );
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(centerIdx, j + 1, j);
    }
  }

  if (capEnd) {
    const r1 = Math.max(1e-4, radiusFn(1));
    const centerIdx = positions.length / 3;
    const p1 = pts[tubularSegs];
    const t1 = tangents[tubularSegs];
    positions.push(
      p1.x + t1.x * r1 * capRoundEnd,
      p1.y + t1.y * r1 * capRoundEnd,
      p1.z + t1.z * r1 * capRoundEnd
    );
    uvs.push(0.5, 1);
    const ringStart = tubularSegs * stride;
    for (let j = 0; j < radialSegs; j++) {
      indices.push(centerIdx, ringStart + j, ringStart + j + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function makeCurvedFeather(THREE, cfg) {
  const L = cfg.length;
  const W = cfg.width;
  const T = cfg.thickness || 0.004;
  const bendZ = cfg.bendZ || 0;
  const bendX = cfg.bendX || 0;
  const cup = cfg.cup || 0.003;
  const twist = cfg.twist || 0;
  const asym = cfg.asym || 0;
  const tipPinch = cfg.tipPinch !== undefined ? cfg.tipPinch : 0.22;

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(
    W * (0.42 + asym), L * 0.14,
    W * (0.54 + asym * 0.6), L * 0.54,
    W * tipPinch, L * 0.88
  );
  shape.bezierCurveTo(
    W * (tipPinch * 0.45), L * 0.97,
    W * 0.04, L,
    0, L
  );
  shape.bezierCurveTo(
    -W * 0.04, L,
    -W * (tipPinch * 0.45), L * 0.97,
    -W * tipPinch, L * 0.88
  );
  shape.bezierCurveTo(
    -W * (0.54 - asym * 0.6), L * 0.54,
    -W * (0.42 - asym), L * 0.14,
    0, 0
  );

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: T,
    bevelEnabled: true,
    bevelThickness: T * 0.72,
    bevelSize: W * 0.07,
    bevelSegments: 3,
    curveSegments: 14
  });

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i) - T * 0.5;

    const t = clamp(y / L, 0, 1);
    const uNorm = clamp(x / (W * 1.15) + 0.5, 0, 1);
    uv.setXY(i, uNorm, t);

    // Taper thickness toward feather tip for crisp organic silhouette
    z *= (1 - 0.58 * t * t);

    // Cup across width and arch along length
    const xFrac = clamp(x / (W * 0.55), -1.2, 1.2);
    const zCurve = bendZ * t * t - cup * (xFrac * xFrac) * (0.25 + 0.75 * t);
    const xCurve = bendX * t * t;

    let nx = x + xCurve;
    let nz = z + zCurve;

    if (twist !== 0) {
      const ang = twist * t;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const rx = nx * ca - nz * sa;
      const rz = nx * sa + nz * ca;
      nx = rx;
      nz = rz;
    }

    pos.setXYZ(i, nx, y, nz);
  }

  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function buildTextures(THREE, kit, colors, variant) {
  const cream = { r: 249, g: 241, b: 226 };
  const darkFur = scaleRgb(colors.fur, 0.56);
  const midFur = colors.fur;
  const bellyFur = mixRgb(colors.fur, cream, 0.62);
  const spotFur = scaleRgb(colors.fur, 0.74);

  const featherBase = colors.furAccent;
  const featherTip = variant === 'snowy'
    ? mixRgb(featherBase, { r: 112, g: 120, b: 136 }, 0.44)
    : mixRgb(featherBase, scaleRgb(colors.fur, 0.58), 0.54);
  const featherShadow = mixRgb(featherBase, scaleRgb(colors.fur, 0.62), 0.28);

  // 1. Seamless Lion Body Fur Texture (Colour + Bump)
  const furMap = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const v = 1 - y / (h - 1); // 1 = top back, 0 = belly
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const ang = u * Math.PI * 2;
        const nx = Math.cos(ang);
        const ny = Math.sin(ang);

        const nCoarse = kit.noise(nx * 2.2 + 5.1, ny * 2.2 + v * 3.8);
        const nFine = kit.noise(nx * 10.5 + 1.3, ny * 10.5 + v * 16.0);

        // Dorsal darker, belly creamy
        const backWeight = smoothstep(0.45, 0.92, v);
        const bellyWeight = smoothstep(0.44, 0.08, v);

        let col = mixRgb(midFur, darkFur, backWeight * 0.48);
        col = mixRgb(col, bellyFur, bellyWeight * 0.85);

        // Front feathered chest blend around u = 0.25 (z = +1 on SphereGeometry)
        const frontDist = Math.abs(((u - 0.25 + 1.5) % 1) - 0.5);
        const chestBlend = smoothstep(0.22, 0.06, frontDist) * smoothstep(0.24, 0.65, v);
        const scallop = Math.sin(u * Math.PI * 36) * 0.04;
        const chestMask = smoothstep(0.18 + scallop, 0.48 + scallop, chestBlend);
        col = mixRgb(col, featherBase, chestMask * 0.92);

        // Subtle lion-cub rosettes on flanks and hindquarters
        const backFlank = smoothstep(0.12, 0.26, frontDist) * smoothstep(0.25, 0.72, v) * (1 - chestMask);
        const spotNoise = kit.noise(nx * 5.8 + 12.4, ny * 5.8 + v * 9.2);
        const spotMask = smoothstep(0.65, 0.77, spotNoise) * backFlank * 0.42;
        col = mixRgb(col, spotFur, spotMask);

        const shade = 0.92 + nCoarse * 0.10 + (nFine - 0.5) * 0.08;
        const idx = (y * w + x) * 4;
        d[idx] = clamp(Math.round(col.r * shade), 0, 255);
        d[idx + 1] = clamp(Math.round(col.g * shade), 0, 255);
        d[idx + 2] = clamp(Math.round(col.b * shade), 0, 255);
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Fine directional fur strokes
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 2400; i++) {
      const fx = ((i * 73.13) % 1) * w;
      const fy = ((i * 41.77 + Math.sin(i) * 0.3 + 1) % 1) * h;
      const len = 5 + (i % 7);
      const darkStroke = i % 3 === 0;
      ctx.strokeStyle = darkStroke
        ? rgbStr(darkFur, 0.14)
        : rgbStr(bellyFur, 0.16);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + ((i % 5) - 2) * 0.9, fy + len);
      ctx.stroke();
    }
  });
  furMap.colorSpace = THREE.SRGBColorSpace;
  furMap.wrapS = THREE.RepeatWrapping;

  const furBump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) {
      const fx = ((i * 61.37) % 1) * w;
      const fy = ((i * 29.83) % 1) * h;
      const bright = 105 + ((i * 19) % 55);
      ctx.strokeStyle = `rgb(${bright},${bright},${bright})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + ((i % 3) - 1) * 1.1, fy + 6 + (i % 5));
      ctx.stroke();
    }
  });
  furBump.wrapS = THREE.RepeatWrapping;

  // 2. Eagle Head & Down Plumage Texture
  const headMap = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const v = 1 - y / (h - 1);
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const ang = u * Math.PI * 2;
        const nx = Math.cos(ang);
        const ny = Math.sin(ang);

        const n1 = kit.noise(nx * 3.0 + 2.2, ny * 3.0 + v * 4.5);
        const n2 = kit.noise(nx * 14.0 + 7.1, ny * 14.0 + v * 18.0);

        const frontDist = Math.abs(((u - 0.25 + 1.5) % 1) - 0.5);
        const crownShade = smoothstep(0.60, 0.96, v) * 0.28;
        const napeShade = smoothstep(0.18, 0.42, frontDist) * smoothstep(0.25, 0.85, v) * 0.22;
        const faceBright = smoothstep(0.22, 0.04, frontDist) * smoothstep(0.25, 0.65, v) * 0.22;

        let col = mixRgb(featherBase, featherShadow, crownShade + napeShade);
        col = mixRgb(col, cream, faceBright);

        // Subtle snowy owl speckles on crown/nape for snowy variant
        if (variant === 'snowy') {
          const sp = kit.noise(nx * 11.0 + 3.4, ny * 11.0 + v * 15.0);
          const spMask = smoothstep(0.70, 0.82, sp) * (crownShade + napeShade) * 1.3;
          col = mixRgb(col, featherTip, clamp(spMask, 0, 0.55));
        }

        const shade = 0.94 + n1 * 0.08 + (n2 - 0.5) * 0.06;
        const idx = (y * w + x) * 4;
        d[idx] = clamp(Math.round(col.r * shade), 0, 255);
        d[idx + 1] = clamp(Math.round(col.g * shade), 0, 255);
        d[idx + 2] = clamp(Math.round(col.b * shade), 0, 255);
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Fine soft plumage scallops
    ctx.lineWidth = 1.2;
    for (let row = 0; row < 28; row++) {
      const ry = (row / 28) * h;
      const count = 26;
      for (let colIdx = 0; colIdx < count; colIdx++) {
        const rx = ((colIdx + (row % 2) * 0.5) / count) * w;
        ctx.strokeStyle = rgbStr(featherShadow, 0.14);
        ctx.beginPath();
        ctx.arc(rx, ry, 10, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
      }
    }
  });
  headMap.colorSpace = THREE.SRGBColorSpace;
  headMap.wrapS = THREE.RepeatWrapping;

  // 3. Individual Sculpted Feather Texture (Wings, Crest, Ears, Ruff)
  const featherMap = kit.canvasTexture(256, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, h, 0, 0); // bottom v=0 -> top v=1
    grad.addColorStop(0.0, rgbStr(mixRgb(featherBase, cream, 0.25)));
    grad.addColorStop(0.55, rgbStr(featherBase));
    grad.addColorStop(0.84, rgbStr(mixRgb(featherBase, featherTip, 0.55)));
    grad.addColorStop(1.0, rgbStr(featherTip));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Soft raptor barring bands near upper half
    for (let b = 0; b < 3; b++) {
      const by = h * (0.16 + b * 0.18);
      const bandGrad = ctx.createLinearGradient(0, by - 16, 0, by + 16);
      bandGrad.addColorStop(0, rgbStr(featherTip, 0));
      bandGrad.addColorStop(0.5, rgbStr(featherTip, variant === 'snowy' ? 0.34 : 0.20));
      bandGrad.addColorStop(1, rgbStr(featherTip, 0));
      ctx.fillStyle = bandGrad;
      ctx.fillRect(0, by - 16, w, 32);
    }

    // Angled feather barbs sweeping outward from central rachis
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 160; i++) {
      const y0 = (i / 160) * h;
      const alpha = 0.12 + (i % 3) * 0.04;
      ctx.strokeStyle = i % 2 === 0 ? rgbStr(featherShadow, alpha) : rgbStr(cream, alpha * 0.9);
      ctx.beginPath();
      ctx.moveTo(w * 0.5, y0);
      ctx.lineTo(w * 0.98, y0 - w * 0.32);
      ctx.moveTo(w * 0.5, y0);
      ctx.lineTo(w * 0.02, y0 - w * 0.32);
      ctx.stroke();
    }

    // Subtle central quill shaft
    const qGrad = ctx.createLinearGradient(w * 0.47, 0, w * 0.53, 0);
    qGrad.addColorStop(0, rgbStr(featherShadow, 0));
    qGrad.addColorStop(0.5, rgbStr(mixRgb(featherBase, cream, 0.55), 0.7));
    qGrad.addColorStop(1, rgbStr(featherShadow, 0));
    ctx.fillStyle = qGrad;
    ctx.fillRect(w * 0.47, 0, w * 0.06, h);
  });
  featherMap.colorSpace = THREE.SRGBColorSpace;

  const featherBump = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 120; i++) {
      const y0 = (i / 120) * h;
      ctx.strokeStyle = i % 2 === 0 ? '#a4a4a4' : '#5e5e5e';
      ctx.beginPath();
      ctx.moveTo(w * 0.5, y0);
      ctx.lineTo(w, y0 - w * 0.32);
      ctx.moveTo(w * 0.5, y0);
      ctx.lineTo(0, y0 - w * 0.32);
      ctx.stroke();
    }
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(w * 0.485, 0, w * 0.03, h);
  });

  // 4. Expressive Eye Iris Texture
  const irisMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const r = w * 0.48;

    const irisDark = scaleRgb(colors.eye, 0.34);
    const irisBright = mixRgb(colors.eye, { r: 255, g: 245, b: 210 }, 0.46);

    const bg = ctx.createRadialGradient(cx, cy, r * 0.25, cx, cy, r);
    bg.addColorStop(0.0, rgbStr(colors.eye));
    bg.addColorStop(0.68, rgbStr(colors.eye));
    bg.addColorStop(0.88, rgbStr(irisDark));
    bg.addColorStop(1.0, '#100c0d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Warm lower luminous crescent
    const glow = ctx.createRadialGradient(cx, cy + r * 0.32, r * 0.05, cx, cy + r * 0.28, r * 0.62);
    glow.addColorStop(0, rgbStr(irisBright, 0.85));
    glow.addColorStop(0.6, rgbStr(irisBright, 0.25));
    glow.addColorStop(1, rgbStr(irisBright, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Radial iris fibers
    for (let i = 0; i < 84; i++) {
      const ang = (i / 84) * Math.PI * 2;
      const inner = r * (0.40 + (i % 3) * 0.03);
      const outer = r * (0.85 + (i % 2) * 0.06);
      ctx.strokeStyle = i % 2 === 0 ? rgbStr(irisBright, 0.26) : rgbStr(irisDark, 0.32);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner);
      ctx.lineTo(cx + Math.cos(ang) * outer, cy + Math.sin(ang) * outer);
      ctx.stroke();
    }

    // Soft upper lid shadow across top of iris
    const topShad = ctx.createLinearGradient(0, cy - r, 0, cy + r * 0.1);
    topShad.addColorStop(0, 'rgba(12, 8, 14, 0.62)');
    topShad.addColorStop(0.55, 'rgba(12, 8, 14, 0.16)');
    topShad.addColorStop(1, 'rgba(12, 8, 14, 0)');
    ctx.fillStyle = topShad;
    ctx.fillRect(0, 0, w, h);

    // Deep glossy pupil
    const pupGrad = ctx.createRadialGradient(cx, cy, r * 0.34, cx, cy, r * 0.50);
    pupGrad.addColorStop(0, '#07060a');
    pupGrad.addColorStop(0.84, '#0c0a11');
    pupGrad.addColorStop(1, 'rgba(12, 10, 17, 0)');
    ctx.fillStyle = pupGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.50, 0, Math.PI * 2);
    ctx.fill();
  });
  irisMap.colorSpace = THREE.SRGBColorSpace;

  // 5. Beak Keratin Texture
  const beakMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const beakBase = mixRgb(colors.beak, { r: 255, g: 224, b: 145 }, 0.22);
    const beakTip = scaleRgb(colors.beak, 0.56);
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0.0, rgbStr(beakBase));
    grad.addColorStop(0.58, rgbStr(colors.beak));
    grad.addColorStop(1.0, rgbStr(beakTip));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.lineWidth = 1;
    for (let i = 0; i < 90; i++) {
      const sx = (i / 90) * w;
      ctx.strokeStyle = i % 2 === 0 ? rgbStr(beakTip, 0.12) : rgbStr(beakBase, 0.14);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx + ((i % 3) - 1) * 3, h);
      ctx.stroke();
    }
  });
  beakMap.colorSpace = THREE.SRGBColorSpace;

  // 6. Avian Foreleg Scale Texture (Tarsus & Toes)
  const scaleMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const base = mixRgb(colors.beak, { r: 220, g: 165, b: 78 }, 0.3);
    const groove = scaleRgb(base, 0.66);
    const hi = mixRgb(base, { r: 255, g: 235, b: 185 }, 0.35);

    ctx.fillStyle = rgbStr(base);
    ctx.fillRect(0, 0, w, h);

    const rows = 18;
    const cols = 10;
    const rh = h / rows;
    const cw = w / cols;
    for (let r = 0; r < rows + 1; r++) {
      for (let c = 0; c < cols + 1; c++) {
        const cx = (c + (r % 2) * 0.5) * cw;
        const cy = r * rh;
        ctx.fillStyle = rgbStr(hi, 0.28);
        ctx.beginPath();
        ctx.ellipse(cx, cy - rh * 0.12, cw * 0.42, rh * 0.36, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = rgbStr(groove, 0.48);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(cx, cy, cw * 0.46, rh * 0.44, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  });
  scaleMap.colorSpace = THREE.SRGBColorSpace;
  scaleMap.wrapS = THREE.RepeatWrapping;
  scaleMap.wrapT = THREE.RepeatWrapping;

  const scaleBump = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(0, 0, w, h);
    const rows = 14;
    const cols = 8;
    const rh = h / rows;
    const cw = w / cols;
    for (let r = 0; r < rows + 1; r++) {
      for (let c = 0; c < cols + 1; c++) {
        const cx = (c + (r % 2) * 0.5) * cw;
        const cy = r * rh;
        ctx.strokeStyle = '#383838';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(cx, cy, cw * 0.45, rh * 0.43, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  });
  scaleBump.wrapS = THREE.RepeatWrapping;
  scaleBump.wrapT = THREE.RepeatWrapping;

  // 7. Soft Rosy Cheek Blush
  const blushMap = kit.canvasTexture(128, 128, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 4, w * 0.5, h * 0.5, w * 0.48);
    grad.addColorStop(0.0, rgbStr(colors.blush, 0.72));
    grad.addColorStop(0.55, rgbStr(colors.blush, 0.28));
    grad.addColorStop(1.0, rgbStr(colors.blush, 0.0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  blushMap.colorSpace = THREE.SRGBColorSpace;

  return {
    furMap,
    furBump,
    headMap,
    featherMap,
    featherBump,
    irisMap,
    beakMap,
    scaleMap,
    scaleBump,
    blushMap
  };
}

function buildBodyGeo(THREE) {
  return sculptSphere(THREE, 56, 40, (v) => {
    const sx = v.x;
    const sy = v.y;
    const sz = v.z;

    // Base sitting cub torso proportions
    let x = sx * 0.088;
    let y = sy * 0.092;
    let z = sz * 0.138;

    // Sitting spine slope: lift chest forward-up, drop hindquarters softly
    y += sz * 0.044;

    // Plump lion hindquarters (sz < 0)
    const rumpMask = smoothstep(0.15, -0.85, sz);
    x *= 1 + 0.19 * rumpMask;
    y -= 0.012 * rumpMask * (1 - sy * 0.5);

    // Gentle feline waist tuck
    const waist = Math.exp(-Math.pow((sz + 0.14) / 0.34, 2));
    x *= 1 - 0.07 * waist * (0.4 + 0.6 * Math.abs(sx));

    // Noble puffed eagle chest (sz > 0.15)
    const chestMask = smoothstep(0.05, 0.88, sz);
    z += 0.024 * chestMask * (1 - 0.35 * sy * sy);
    x *= 1 + 0.06 * chestMask * smoothstep(-0.4, 0.3, sy);
    y += 0.012 * chestMask * smoothstep(-0.3, 0.5, sy);

    // Continuous sculpted neck column rising from upper-front torso
    const neckMask = smoothstep(0.22, 0.88, sy) * smoothstep(-0.18, 0.52, sz);
    y += 0.072 * neckMask;
    x *= 1 - 0.36 * neckMask;
    z += (0.048 - z) * 0.42 * neckMask;

    // Subtle dorsal spine groove along the middle back
    const backGroove = smoothstep(0.35, 0.85, sy) * smoothstep(0.2, -0.6, sz) * Math.exp(-Math.pow(sx / 0.24, 2));
    y -= 0.006 * backGroove;

    // Shift into world Y space
    y += 0.104;
    z -= 0.014;

    // Soft gravity settle on the floor (y = 0.002 minimum)
    const floorZone = 0.036;
    if (y < floorZone) {
      const depth = floorZone - y;
      const squished = 0.033 * Math.tanh(depth / 0.036);
      const padSpread = clamp(depth * 0.18, 0, 0.010);
      y = floorZone - squished;
      x *= 1 + padSpread * 2.2;
      z += (z > 0 ? 1 : -1) * padSpread * 0.4;
    }

    v.set(x, y, z);
  });
}

function buildHeadGeo(THREE) {
  return sculptSphere(THREE, 56, 40, (v) => {
    const sx = v.x;
    const sy = v.y;
    const sz = v.z;

    let x = sx * 0.069;
    let y = sy * 0.064;
    let z = sz * 0.067;

    // Refined gently domed forehead & rounded back cranium
    const crown = smoothstep(0.25, 0.95, sy);
    x *= 1 - 0.11 * crown;
    z += 0.007 * smoothstep(-0.05, -0.82, sz);

    // Fluffy feathery eagle cheeks
    const cheekY = Math.exp(-Math.pow((sy + 0.16) / 0.34, 2));
    const cheekSide = smoothstep(0.32, 0.88, Math.abs(sx));
    const cheekZ = smoothstep(-0.45, 0.35, sz);
    x += Math.sign(sx) * 0.015 * cheekY * cheekSide * cheekZ;
    z += 0.005 * cheekY * cheekSide * cheekZ;

    // Expressive gentle raptor brow arches over eyes
    const browY = Math.exp(-Math.pow((sy - 0.28) / 0.16, 2));
    const browX = smoothstep(0.14, 0.42, Math.abs(sx)) * smoothstep(0.78, 0.48, Math.abs(sx));
    const browZ = smoothstep(0.45, 0.88, sz);
    z += 0.007 * browY * browX * browZ;
    y += 0.003 * browY * browX * browZ;

    // Soft concave eye sockets so eyes nestle naturally on the surface
    const eyeLX = 0.54;
    const eyeY = 0.09;
    const eyeZ = 0.76;
    const dL = Math.hypot(sx - eyeLX, sy - eyeY, sz - eyeZ);
    const dR = Math.hypot(sx + eyeLX, sy - eyeY, sz - eyeZ);
    const socketD = Math.min(dL, dR);
    const socketIndent = smoothstep(0.36, 0.08, socketD);
    const rLen = Math.hypot(x, y, z) || 1;
    x -= (x / rLen) * 0.0075 * socketIndent;
    y -= (y / rLen) * 0.0075 * socketIndent;
    z -= (z / rLen) * 0.0075 * socketIndent;

    // Smooth forward face bridge transitioning into beak
    const bridge = smoothstep(0.62, 0.96, sz) * Math.exp(-Math.pow((sy + 0.06) / 0.32, 2)) * Math.exp(-Math.pow(sx / 0.34, 2));
    z += 0.011 * bridge;

    // Seamless feathered neck skirt overlapping deeply into the body neck
    const skirt = smoothstep(-0.42, -0.94, sy);
    y -= 0.042 * skirt;
    x *= 1 - 0.12 * skirt;
    z -= 0.006 * skirt;

    // Offset inside head group (pivot at neck base)
    v.set(x, y + 0.056, z + 0.006);
  });
}

function buildUpperBeakGeo(THREE) {
  return sculptSphere(THREE, 40, 28, (v) => {
    const sx = v.x;
    const sy = v.y;
    const sz = v.z;

    const t = clamp((sz + 1) * 0.5, 0, 1); // 0 = base in face, 1 = hooked tip
    const L = 0.062;
    const halfW = 0.0225 * Math.pow(1 - 0.87 * t, 0.82);
    const halfH = 0.0185 * Math.pow(1 - 0.72 * t, 0.75);

    // Subtle eagle ridge (culmen) on top, flattened concave tomium underneath
    let yLocal = sy * halfH;
    if (sy < 0) {
      yLocal *= 0.42;
      // Cute slight upward smile arch along sides of beak edge
      yLocal += 0.0028 * Math.sin(t * Math.PI) * smoothstep(0.2, 0.8, Math.abs(sx));
    }

    // Pinch width gently along upper dorsal crest for crisp hooked silhouette
    const ridgePinch = sy > 0 ? (1 - 0.34 * sy * smoothstep(0.15, 0.85, t)) : 1;
    const x = sx * halfW * ridgePinch;

    // Dramatic graceful eagle hook curve
    const archUp = 0.0045 * Math.sin(t * Math.PI * 0.85);
    const hookDrop = -0.0255 * Math.pow(t, 2.35);
    const z = t * L - 0.005 * Math.pow(t, 4.0);
    const y = yLocal + archUp + hookDrop;

    v.set(x, y, z);
  });
}

function buildLowerBeakGeo(THREE) {
  return sculptSphere(THREE, 28, 20, (v) => {
    const sx = v.x;
    const sy = v.y;
    const sz = v.z;

    const t = clamp((sz + 1) * 0.5, 0, 1);
    const L = 0.041;
    const halfW = 0.0165 * Math.pow(1 - 0.80 * t, 0.85);
    const halfH = 0.0105 * Math.pow(1 - 0.65 * t, 0.80);

    const x = sx * halfW;
    const y = sy * halfH * (sy > 0 ? 0.55 : 1.0) - 0.004 * t * t;
    const z = t * L;

    v.set(x, y, z);
  });
}

function buildCereGeo(THREE) {
  return sculptSphere(THREE, 28, 20, (v) => {
    const sx = v.x;
    const sy = v.y;
    const sz = v.z;

    const x = sx * 0.0215;
    let y = sy * 0.0145;
    const z = sz * 0.0155;

    // Subtle soft saddle dip along center top & flared sides
    y -= 0.0018 * Math.exp(-Math.pow(sx / 0.25, 2)) * smoothstep(0.1, 0.8, sy);
    if (sy < 0) y *= 0.45;

    v.set(x, y, z);
  });
}

function buildHaunchGeo(THREE, side) {
  return sculptSphere(THREE, 36, 28, (v) => {
    const sx = v.x;
    const sy = v.y;
    const sz = v.z;

    let x = sx * 0.044;
    let y = sy * 0.056;
    let z = sz * 0.068;

    // Folded sitting feline thigh silhouette: plump at rear-top, leaning forward-down to knee
    y -= sz * 0.016;
    const outerSide = side * sx > 0 ? 1 : 0;
    x *= 1 + 0.14 * outerSide * smoothstep(-0.3, 0.5, sy);

    // Knee protrusion at front-bottom
    const knee = smoothstep(0.35, 0.92, sz) * smoothstep(0.2, -0.6, sy);
    z += 0.014 * knee;
    y -= 0.008 * knee;

    // Soft underside flattening so the thigh sits solidly on the floor
    const yWorldApprox = y + 0.058;
    if (yWorldApprox < 0.022) {
      const d = 0.022 - yWorldApprox;
      y = 0.022 - 0.020 * Math.tanh(d / 0.022) - 0.058;
    }

    v.set(x, y, z);
  });
}

function buildHindPawGeo(THREE) {
  return sculptSphere(THREE, 30, 22, (v) => {
    const sx = v.x;
    const sy = v.y;
    const sz = v.z;

    let x = sx * 0.026;
    let y = sy * 0.016;
    let z = sz * 0.032;

    // Wider plush lion toe cushion at front
    const front = smoothstep(-0.1, 0.85, sz);
    x *= 1 + 0.18 * front;

    // Three subtle sculpted feline toe puffs across the front
    const toeWave = Math.cos(sx * Math.PI * 2.75);
    const toeMask = smoothstep(0.25, 0.88, sz) * smoothstep(-0.4, 0.45, sy);
    z += 0.0038 * Math.max(0, toeWave) * toeMask;
    y += 0.0018 * Math.max(0, toeWave) * toeMask;

    // Flat bottom resting cleanly on the floor
    if (sy < -0.25) {
      y = -0.0125 + (y + 0.016) * 0.22;
    }

    v.set(x, y, z);
  });
}

function buildWingCovertGeo(THREE, side) {
  return sculptSphere(THREE, 32, 24, (v) => {
    const sx = v.x;
    const sy = v.y;
    const sz = v.z;

    // Folded wing shoulder cushion hugging the flank
    const tBack = clamp((1 - sz) * 0.5, 0, 1); // 0 = front shoulder, 1 = rear covert edge
    let x = sx * 0.024 * (1 - 0.42 * tBack);
    let y = sy * 0.044 * (1 - 0.35 * tBack);
    let z = sz * 0.064;

    // Curve inward along the cub's body contour
    x -= side * (0.014 * tBack * tBack + 0.008 * sy * sy);
    // Slight graceful downward sweep toward back
    y -= 0.018 * tBack;

    // Flatten inner surface slightly so it hugs the torso cleanly
    if (sx * side < 0) {
      x *= 0.55;
    }

    v.set(x, y, z);
  });
}

function buildTailTuftCoreGeo(THREE) {
  return sculptSphere(THREE, 28, 20, (v) => {
    const sx = v.x;
    const sy = v.y;
    const sz = v.z;

    const t = clamp((sy + 1) * 0.5, 0, 1); // 0 = base on tail, 1 = flame tip
    const r = 0.025 * Math.sin(Math.pow(t, 0.62) * Math.PI * 0.94 + 0.14);
    const x = sx * r;
    const z = sz * r + 0.010 * t * t; // gentle curl
    const y = t * 0.072;

    v.set(x, y, z);
  });
}

function buildEyeGroup(THREE, side, mats) {
  const eyeGroup = new THREE.Group();
  eyeGroup.name = side > 0 ? 'eyeL' : 'eyeR';

  // 1. Dark glossy outer eyeball (slightly oblate so it sits snugly in the socket)
  const ballGeo = new THREE.SphereGeometry(0.0155, 28, 22);
  ballGeo.scale(0.96, 1.04, 0.68);
  const ball = setSlot(new THREE.Mesh(ballGeo, mats.eyeball), 'primary', false);
  eyeGroup.add(ball);

  // 2. Coloured iris dome seated cleanly on the front curvature
  const irisGeo = new THREE.SphereGeometry(0.0156, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.36);
  irisGeo.rotateX(Math.PI * 0.5);
  irisGeo.scale(0.92, 0.99, 0.68);
  // Planar front UV projection so the radial iris texture sits dead-center
  const pos = irisGeo.attributes.position;
  const uv = irisGeo.attributes.uv;
  const maxR = 0.0132;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    uv.setXY(i, clamp(px / (maxR * 2) + 0.5, 0, 1), clamp(py / (maxR * 2) + 0.5, 0, 1));
  }
  uv.needsUpdate = true;
  const iris = setSlot(new THREE.Mesh(irisGeo, mats.iris), 'eye', false);
  iris.position.z = 0.0005;
  eyeGroup.add(iris);

  // 3. Two glossy white catchlight highlights (upper-left & tiny lower-right)
  const hiBigGeo = new THREE.SphereGeometry(0.0036, 14, 12);
  hiBigGeo.scale(1.0, 1.08, 0.45);
  const hiBig = setSlot(new THREE.Mesh(hiBigGeo, mats.eyeHighlight), 'glow', false);
  hiBig.position.set(-0.0044, 0.0052, 0.0098);
  eyeGroup.add(hiBig);

  const hiSmallGeo = new THREE.SphereGeometry(0.0016, 12, 10);
  hiSmallGeo.scale(1.0, 1.0, 0.5);
  const hiSmall = setSlot(new THREE.Mesh(hiSmallGeo, mats.eyeHighlight), 'glow', false);
  hiSmall.position.set(0.0046, -0.0044, 0.0096);
  eyeGroup.add(hiSmall);

  // 4. Delicate curved upper lash / lid rim hugging the eye
  const lashCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.0135 * side, 0.0035, 0.0058),
    new THREE.Vector3(-0.0065 * side, 0.0138, 0.0068),
    new THREE.Vector3(0.0045 * side, 0.0148, 0.0062),
    new THREE.Vector3(0.0145 * side, 0.0072, 0.0044)
  ]);
  const lashGeo = makeTaperedTube(THREE, lashCurve, (u) => 0.0014 + 0.0014 * Math.sin(u * Math.PI), 18, 8);
  const lash = setSlot(new THREE.Mesh(lashGeo, mats.claw), 'primary', false);
  eyeGroup.add(lash);

  return eyeGroup;
}

function buildFrontLeg(THREE, side, raised, mats) {
  const arm = new THREE.Group();
  arm.name = side > 0 ? 'armL' : 'armR';

  // Local coordinates relative to shoulder pivot (±0.058, 0.155, 0.062)
  const upperPts = raised
    ? [
        new THREE.Vector3(-0.012 * side, 0.018, -0.012),
        new THREE.Vector3(0.004 * side, -0.018, 0.014),
        new THREE.Vector3(0.002 * side, -0.054, 0.044),
        new THREE.Vector3(-0.002 * side, -0.072, 0.064)
      ]
    : [
        new THREE.Vector3(-0.012 * side, 0.018, -0.012),
        new THREE.Vector3(0.002 * side, -0.024, 0.014),
        new THREE.Vector3(0.004 * side, -0.064, 0.032),
        new THREE.Vector3(0.004 * side, -0.088, 0.042)
      ];

  const upperCurve = new THREE.CatmullRomCurve3(upperPts);
  const upperGeo = makeTaperedTube(
    THREE,
    upperCurve,
    (u) => 0.034 * (1 - 0.56 * Math.pow(u, 1.15)),
    24,
    18
  );
  const upperMesh = setSlot(new THREE.Mesh(upperGeo, mats.headFeather), 'furAccent');
  arm.add(upperMesh);

  // Fluffy avian leg-feather cuff ("trousers") around the ankle transition
  const anklePos = upperPts[3];
  const cuffFeatherGeo = makeCurvedFeather(THREE, {
    length: 0.032,
    width: 0.016,
    thickness: 0.0032,
    bendZ: 0.005,
    cup: 0.0025
  });
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const f = setSlot(new THREE.Mesh(cuffFeatherGeo, mats.feather), 'furAccent');
    f.position.set(
      anklePos.x + Math.cos(ang) * 0.013,
      anklePos.y + 0.008,
      anklePos.z + Math.sin(ang) * 0.013
    );
    f.rotation.order = 'YXZ';
    f.rotation.y = -ang + Math.PI * 0.5;
    f.rotation.x = Math.PI - 0.28 + (raised ? -0.35 : 0);
    arm.add(f);
  }

  // Scaly bird tarsus (lower shank)
  const tarsusPts = raised
    ? [
        new THREE.Vector3(-0.002 * side, -0.064, 0.058),
        new THREE.Vector3(-0.005 * side, -0.084, 0.078),
        new THREE.Vector3(-0.008 * side, -0.098, 0.096)
      ]
    : [
        new THREE.Vector3(0.004 * side, -0.078, 0.038),
        new THREE.Vector3(0.005 * side, -0.114, 0.048),
        new THREE.Vector3(0.006 * side, -0.141, 0.060)
      ];
  const tarsusCurve = new THREE.CatmullRomCurve3(tarsusPts);
  const tarsusGeo = makeTaperedTube(
    THREE,
    tarsusCurve,
    (u) => 0.0135 - 0.0022 * Math.sin(u * Math.PI) + 0.0015 * u,
    18,
    14
  );
  const tarsusMesh = setSlot(new THREE.Mesh(tarsusGeo, mats.scales), 'accent');
  arm.add(tarsusMesh);

  // Foot pad + 4 avian toes (3 forward splayed + 1 rear hallux) + curved glossy talons
  const footCenter = tarsusPts[2];
  const padGeo = new THREE.SphereGeometry(0.0135, 16, 12);
  padGeo.scale(1.15, 0.65, 1.15);
  const padMesh = setSlot(new THREE.Mesh(padGeo, mats.scales), 'accent');
  padMesh.position.copy(footCenter);
  arm.add(padMesh);

  const toeDefs = [
    { yaw: -0.44 * side, len: 0.038, rad: 0.0064 },
    { yaw: 0.0, len: 0.045, rad: 0.0068 },
    { yaw: 0.44 * side, len: 0.037, rad: 0.0062 },
    { yaw: Math.PI, len: 0.025, rad: 0.0060 } // rear hallux
  ];

  for (let i = 0; i < toeDefs.length; i++) {
    const td = toeDefs[i];
    const dirX = Math.sin(td.yaw);
    const dirZ = Math.cos(td.yaw);
    const isRear = i === 3;

    let p0, p1, p2;
    if (raised) {
      // Softly curled playful toes hanging down slightly
      const curlDrop = isRear ? -0.014 : -0.022;
      p0 = footCenter.clone().add(new THREE.Vector3(dirX * 0.005, -0.002, dirZ * 0.005));
      p1 = footCenter.clone().add(new THREE.Vector3(dirX * td.len * 0.58, -0.005, dirZ * td.len * 0.58));
      p2 = footCenter.clone().add(new THREE.Vector3(dirX * td.len * 0.92, curlDrop, dirZ * td.len * 0.92));
    } else {
      // Firmly grounded talons resting on y = 0 (footCenter.y is -0.141 -> world 0.014)
      p0 = footCenter.clone().add(new THREE.Vector3(dirX * 0.005, -0.002, dirZ * 0.005));
      p1 = footCenter.clone().add(new THREE.Vector3(dirX * td.len * 0.55, -0.004, dirZ * td.len * 0.55));
      p2 = footCenter.clone().add(new THREE.Vector3(dirX * td.len, -0.0065, dirZ * td.len));
    }

    const toeCurve = new THREE.CatmullRomCurve3([p0, p1, p2]);
    const toeGeo = makeTaperedTube(
      THREE,
      toeCurve,
      (u) => td.rad * (1 - 0.30 * u) * (1 + 0.12 * Math.sin(u * Math.PI * 2)),
      14,
      10
    );
    arm.add(setSlot(new THREE.Mesh(toeGeo, mats.scales), 'accent'));

    // Glossy hooked raptor talon at toe tip
    const tTan = toeCurve.getTangent(1).normalize();
    const clawLen = isRear ? 0.014 : 0.0175;
    const c0 = p2.clone().addScaledVector(tTan, -0.002);
    const c1 = p2.clone().add(new THREE.Vector3(dirX * clawLen * 0.58, raised ? -0.009 : -0.001, dirZ * clawLen * 0.58));
    const c2 = p2.clone().add(new THREE.Vector3(dirX * clawLen * 0.92, raised ? -0.020 : -0.0068, dirZ * clawLen * 0.92));
    const clawCurve = new THREE.CatmullRomCurve3([c0, c1, c2]);
    const clawGeo = makeTaperedTube(
      THREE,
      clawCurve,
      (u) => td.rad * 0.68 * Math.pow(1 - 0.88 * u, 0.85),
      12,
      8,
      { capEnd: true, capRoundEnd: 0.9 }
    );
    arm.add(setSlot(new THREE.Mesh(clawGeo, mats.claw), 'primary'));
  }

  return arm;
}

function buildFoldedWing(THREE, side, mats) {
  const wing = new THREE.Group();
  wing.name = side > 0 ? 'wingL' : 'wingR';

  // 1. Sculpted wing shoulder covert cushion
  const covertGeo = buildWingCovertGeo(THREE, side);
  const covertMesh = setSlot(new THREE.Mesh(covertGeo, mats.headFeather), 'furAccent');
  covertMesh.position.set(0.010 * side, -0.006, -0.036);
  covertMesh.rotation.set(-0.18, -0.14 * side, -0.08 * side);
  wing.add(covertMesh);

  // 2. Layered secondary coverts (upper shingle row)
  const medCount = 5;
  for (let i = 0; i < medCount; i++) {
    const frac = i / (medCount - 1);
    const fGeo = makeCurvedFeather(THREE, {
      length: 0.072 + 0.020 * (1 - frac),
      width: 0.032 - 0.004 * frac,
      thickness: 0.0042,
      bendZ: -0.016 * side,
      bendX: -0.006 * frac,
      cup: 0.003 * side,
      asym: 0.06 * side
    });
    const fMesh = setSlot(new THREE.Mesh(fGeo, mats.feather), 'furAccent');
    fMesh.position.set(
      (0.022 - frac * 0.006) * side,
      0.010 - frac * 0.028,
      -0.018 - frac * 0.018
    );
    // Orient feather (+Y) sweeping backward (-Z) and slightly down (-Y), hugging the flank
    fMesh.rotation.order = 'YXZ';
    fMesh.rotation.y = (Math.PI * 0.5 - 0.14 - frac * 0.06) * side;
    fMesh.rotation.x = 0.04 * side;
    fMesh.rotation.z = (-Math.PI * 0.5 - 0.24 - frac * 0.16) * side;
    wing.add(fMesh);
  }

  // 3. Long graceful primary & secondary flight feathers tucked neatly back
  const priCount = 7;
  for (let i = 0; i < priCount; i++) {
    const frac = i / (priCount - 1);
    const len = 0.145 - frac * 0.048;
    const fGeo = makeCurvedFeather(THREE, {
      length: len,
      width: 0.031 - frac * 0.004,
      thickness: 0.0040,
      bendZ: -0.026 * side,
      bendX: -0.010 * (1 - frac),
      cup: 0.0032 * side,
      twist: 0.14 * side,
      asym: 0.08 * side
    });
    const fMesh = setSlot(new THREE.Mesh(fGeo, mats.feather), 'furAccent');
    fMesh.position.set(
      (0.018 - frac * 0.007) * side,
      0.002 - frac * 0.034,
      -0.040 - frac * 0.010
    );
    fMesh.rotation.order = 'YXZ';
    fMesh.rotation.y = (Math.PI * 0.5 - 0.18 - frac * 0.05) * side;
    fMesh.rotation.x = 0.03 * side;
    fMesh.rotation.z = (-Math.PI * 0.5 - 0.16 - frac * 0.19) * side;
    wing.add(fMesh);
  }

  return wing;
}

export function build(THREE, opts = {}, kit) {
  const variant = PALETTES[opts.variant] ? opts.variant : 'golden';
  const pal = PALETTES[variant];

  const colors = {
    fur: parseRgb(THREE, opts.fur, pal.fur),
    furAccent: parseRgb(THREE, opts.furAccent, pal.furAccent),
    eye: parseRgb(THREE, opts.eye, pal.eye),
    beak: parseRgb(THREE, opts.beak, pal.beak),
    claw: parseRgb(THREE, opts.claw, pal.claw),
    blush: parseRgb(THREE, null, pal.blush)
  };

  const tex = buildTextures(THREE, kit, colors, variant);

  const furSheen = makeColorFromRgb(THREE, mixRgb(colors.fur, { r: 255, g: 248, b: 235 }, 0.55));
  const featherSheen = makeColorFromRgb(THREE, mixRgb(colors.furAccent, { r: 255, g: 255, b: 255 }, 0.65));
  const tuftColor = makeColorFromRgb(THREE, scaleRgb(colors.fur, 0.58));
  const tuftSheen = makeColorFromRgb(THREE, mixRgb(colors.fur, { r: 255, g: 240, b: 215 }, 0.35));

  const mats = {
    fur: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: tex.furMap,
      bumpMap: tex.furBump,
      bumpScale: 0.0032,
      roughness: 0.91,
      metalness: 0.0,
      sheen: 0.85,
      sheenRoughness: 0.72,
      sheenColor: furSheen
    }),
    headFeather: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: tex.headMap,
      bumpMap: tex.furBump,
      bumpScale: 0.0024,
      roughness: 0.89,
      metalness: 0.0,
      sheen: 0.88,
      sheenRoughness: 0.68,
      sheenColor: featherSheen
    }),
    feather: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: tex.featherMap,
      bumpMap: tex.featherBump,
      bumpScale: 0.0035,
      roughness: 0.87,
      metalness: 0.0,
      sheen: 0.82,
      sheenRoughness: 0.65,
      sheenColor: featherSheen
    }),
    tailTuft: new THREE.MeshPhysicalMaterial({
      color: tuftColor,
      bumpMap: tex.furBump,
      bumpScale: 0.0038,
      roughness: 0.93,
      metalness: 0.0,
      sheen: 0.9,
      sheenRoughness: 0.74,
      sheenColor: tuftSheen
    }),
    beak: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: tex.beakMap,
      roughness: 0.22,
      metalness: 0.02,
      clearcoat: 0.85,
      clearcoatRoughness: 0.14
    }),
    cere: new THREE.MeshPhysicalMaterial({
      color: makeColorFromRgb(THREE, mixRgb(colors.beak, { r: 255, g: 220, b: 120 }, 0.28)),
      roughness: 0.38,
      metalness: 0.0,
      clearcoat: 0.45,
      clearcoatRoughness: 0.25
    }),
    scales: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: tex.scaleMap,
      bumpMap: tex.scaleBump,
      bumpScale: 0.0022,
      roughness: 0.52,
      metalness: 0.0,
      clearcoat: 0.22,
      clearcoatRoughness: 0.35
    }),
    claw: new THREE.MeshPhysicalMaterial({
      color: makeColorFromRgb(THREE, colors.claw),
      roughness: 0.16,
      metalness: 0.04,
      clearcoat: 0.95,
      clearcoatRoughness: 0.10
    }),
    eyeball: new THREE.MeshPhysicalMaterial({
      color: 0x0b0a10,
      roughness: 0.05,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04
    }),
    iris: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: tex.irisMap,
      roughness: 0.08,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05
    }),
    eyeHighlight: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.35,
      roughness: 0.05
    }),
    blush: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: tex.blushMap,
      transparent: true,
      opacity: 0.62,
      roughness: 0.95,
      depthWrite: false
    })
  };

  const root = new THREE.Group();
  root.name = 'griffin_cub';

  // === BODY GROUP (origin on floor so subtle breath scale stays grounded) ===
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  const torsoMesh = setSlot(new THREE.Mesh(buildBodyGeo(THREE), mats.fur), 'fur');
  body.add(torsoMesh);

  // Feathered chest ruff & neck mantle (layered sculpted curved plumage)
  const ruffGroup = new THREE.Group();
  body.add(ruffGroup);

  const upperRuffGeo = makeCurvedFeather(THREE, {
    length: 0.052,
    width: 0.028,
    thickness: 0.0042,
    bendZ: 0.011,
    cup: 0.0032
  });
  const lowerRuffGeo = makeCurvedFeather(THREE, {
    length: 0.058,
    width: 0.032,
    thickness: 0.0044,
    bendZ: 0.013,
    cup: 0.0036
  });

  // Lower chest plumage fan
  for (let i = 0; i < 9; i++) {
    const frac = (i / 8) * 2 - 1; // -1..1 across front chest
    const ang = frac * 1.18;
    const f = setSlot(new THREE.Mesh(lowerRuffGeo, mats.feather), 'furAccent');
    f.position.set(
      Math.sin(ang) * 0.072,
      0.168 - Math.abs(frac) * 0.012,
      0.044 + Math.cos(ang) * 0.068
    );
    f.rotation.order = 'YXZ';
    f.rotation.y = ang;
    f.rotation.x = Math.PI - 0.30 + Math.abs(frac) * 0.06;
    ruffGroup.add(f);
  }

  // Upper collar plumage ring (seamless bridge to head)
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    const isFront = Math.cos(ang) > -0.2;
    const f = setSlot(new THREE.Mesh(upperRuffGeo, mats.feather), 'furAccent');
    f.position.set(
      Math.sin(ang) * 0.058,
      0.205 - Math.cos(ang) * 0.008,
      0.048 + Math.cos(ang) * 0.054
    );
    f.rotation.order = 'YXZ';
    f.rotation.y = ang;
    f.rotation.x = Math.PI - (isFront ? 0.34 : 0.20);
    ruffGroup.add(f);
  }

  // === HEAD GROUP ===
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 0.228, 0.055);
  // Charming curious cub head tilt
  head.rotation.set(0.05, 0.13, 0.11);
  body.add(head);

  const headMesh = setSlot(new THREE.Mesh(buildHeadGeo(THREE), mats.headFeather), 'furAccent');
  head.add(headMesh);

  // Hooked eagle beak (upper + lower + waxy cere + nostrils + gentle mouth seam)
  const beakGroup = new THREE.Group();
  beakGroup.position.set(0, 0.046, 0.054);
  head.add(beakGroup);

  const upperBeak = setSlot(new THREE.Mesh(buildUpperBeakGeo(THREE), mats.beak), 'accent');
  beakGroup.add(upperBeak);

  const lowerBeak = setSlot(new THREE.Mesh(buildLowerBeakGeo(THREE), mats.beak), 'accent');
  lowerBeak.position.set(0, -0.0075, 0.003);
  beakGroup.add(lowerBeak);

  const cereMesh = setSlot(new THREE.Mesh(buildCereGeo(THREE), mats.cere), 'accent');
  cereMesh.position.set(0, 0.0082, 0.005);
  cereMesh.rotation.x = 0.24;
  beakGroup.add(cereMesh);

  // Subtle dark teardrop nostrils on either side of the cere
  const nostrilGeo = new THREE.SphereGeometry(0.0026, 12, 10);
  nostrilGeo.scale(0.65, 0.72, 1.45);
  for (const side of [-1, 1]) {
    const nostril = setSlot(new THREE.Mesh(nostrilGeo, mats.claw), 'primary', false);
    nostril.position.set(0.0112 * side, 0.0110, 0.0145);
    nostril.rotation.y = 0.38 * side;
    beakGroup.add(nostril);
  }

  // Gentle curved mouth parting seam line (tapered thin tube)
  const mouthCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.020, -0.0020, 0.007),
    new THREE.Vector3(-0.014, -0.0048, 0.022),
    new THREE.Vector3(0.0, -0.0052, 0.040),
    new THREE.Vector3(0.014, -0.0048, 0.022),
    new THREE.Vector3(0.020, -0.0020, 0.007)
  ]);
  const mouthGeo = makeTaperedTube(THREE, mouthCurve, (u) => 0.0010 + 0.0005 * Math.sin(u * Math.PI), 24, 8);
  beakGroup.add(setSlot(new THREE.Mesh(mouthGeo, mats.claw), 'primary', false));

  // Large expressive eyes (inset into sockets)
  const eyeL = buildEyeGroup(THREE, 1, mats);
  eyeL.position.set(0.0365, 0.062, 0.0525);
  eyeL.rotation.set(-0.06, 0.56, 0);
  head.add(eyeL);

  const eyeR = buildEyeGroup(THREE, -1, mats);
  eyeR.position.set(-0.0365, 0.062, 0.0525);
  eyeR.rotation.set(-0.06, -0.56, 0);
  head.add(eyeR);

  // Subtle curved cheek blush discs
  const blushGeo = new THREE.SphereGeometry(0.0165, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.42);
  blushGeo.rotateX(Math.PI * 0.5);
  blushGeo.scale(1.18, 0.78, 0.35);
  for (const side of [-1, 1]) {
    const blush = setSlot(new THREE.Mesh(blushGeo, mats.blush), 'skin', false);
    blush.position.set(0.049 * side, 0.044, 0.045);
    blush.rotation.set(0.10, 0.78 * side, 0);
    head.add(blush);
  }

  // Swept-back feathered ear tufts (earL, earR)
  const earMainGeo = makeCurvedFeather(THREE, {
    length: 0.078,
    width: 0.026,
    thickness: 0.0040,
    bendZ: -0.018,
    bendX: 0.008,
    cup: 0.0032
  });
  const earMidGeo = makeCurvedFeather(THREE, {
    length: 0.058,
    width: 0.022,
    thickness: 0.0036,
    bendZ: -0.014,
    bendX: 0.005,
    cup: 0.0026
  });
  const earFrontGeo = makeCurvedFeather(THREE, {
    length: 0.040,
    width: 0.019,
    thickness: 0.0032,
    bendZ: -0.009,
    cup: 0.0022
  });

  const ears = {};
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    ear.name = side > 0 ? 'earL' : 'earR';
    ear.position.set(0.046 * side, 0.098, 0.004);
    ear.rotation.set(-0.56, 0.18 * side, -0.58 * side);

    const m1 = setSlot(new THREE.Mesh(earMainGeo, mats.feather), 'furAccent');
    if (side < 0) m1.scale.x = -1;
    ear.add(m1);

    const m2 = setSlot(new THREE.Mesh(earMidGeo, mats.feather), 'furAccent');
    m2.position.set(-0.006 * side, -0.005, -0.007);
    m2.rotation.set(-0.14, 0.12 * side, -0.18 * side);
    if (side < 0) m2.scale.x = -1;
    ear.add(m2);

    const m3 = setSlot(new THREE.Mesh(earFrontGeo, mats.feather), 'furAccent');
    m3.position.set(0.004 * side, -0.006, 0.006);
    m3.rotation.set(0.16, -0.14 * side, 0.14 * side);
    if (side < 0) m3.scale.x = -1;
    ear.add(m3);

    head.add(ear);
    ears[ear.name] = ear;
  }

  // Royal central feathered crown crest
  const crestDefs = [
    { len: 0.056, w: 0.022, y: 0.112, z: 0.016, rx: -0.78, rz: 0.0 },
    { len: 0.066, w: 0.025, y: 0.114, z: -0.002, rx: -0.92, rz: 0.0 },
    { len: 0.058, w: 0.023, y: 0.106, z: -0.020, rx: -1.10, rz: 0.0 },
    { len: 0.048, w: 0.020, y: 0.108, z: 0.002, rx: -0.84, rz: -0.26, x: 0.015 },
    { len: 0.048, w: 0.020, y: 0.108, z: 0.002, rx: -0.84, rz: 0.26, x: -0.015 }
  ];
  for (const cd of crestDefs) {
    const cGeo = makeCurvedFeather(THREE, {
      length: cd.len,
      width: cd.w,
      thickness: 0.0036,
      bendZ: -0.015,
      cup: 0.0028
    });
    const cMesh = setSlot(new THREE.Mesh(cGeo, mats.feather), 'furAccent');
    cMesh.position.set(cd.x || 0, cd.y, cd.z);
    cMesh.rotation.set(cd.rx, 0, cd.rz);
    head.add(cMesh);
  }

  // Soft swept cheek-ruff feathers framing the face
  const cheekFeatherGeo = makeCurvedFeather(THREE, {
    length: 0.042,
    width: 0.019,
    thickness: 0.0032,
    bendZ: -0.010,
    cup: 0.0022
  });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const cf = setSlot(new THREE.Mesh(cheekFeatherGeo, mats.feather), 'furAccent');
      cf.position.set(0.066 * side, 0.042 - i * 0.011, 0.018 - i * 0.008);
      cf.rotation.order = 'YXZ';
      cf.rotation.y = (Math.PI * 0.5 - 0.18) * side;
      cf.rotation.z = (-Math.PI * 0.5 - 0.18 - i * 0.12) * side;
      head.add(cf);
    }
  }

  // === FOLDED WINGS (wingL, wingR) ===
  const wingL = buildFoldedWing(THREE, 1, mats);
  wingL.position.set(0.072, 0.168, 0.028);
  body.add(wingL);

  const wingR = buildFoldedWing(THREE, -1, mats);
  wingR.position.set(-0.072, 0.168, 0.028);
  body.add(wingR);

  // === FRONT EAGLE LEGS & TALONS (armL raised playfully, armR grounded) ===
  const armL = buildFrontLeg(THREE, 1, true, mats);
  armL.position.set(0.058, 0.155, 0.062);
  body.add(armL);

  const armR = buildFrontLeg(THREE, -1, false, mats);
  armR.position.set(-0.058, 0.155, 0.062);
  body.add(armR);

  // === LION HINDQUARTERS & HIND PAWS (legL, legR) ===
  const hindPawGeo = buildHindPawGeo(THREE);
  const hindClawCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.002, 0),
    new THREE.Vector3(0, 0.001, 0.006),
    new THREE.Vector3(0, -0.0035, 0.010)
  ]);
  const hindClawGeo = makeTaperedTube(THREE, hindClawCurve, (u) => 0.0026 * (1 - 0.85 * u), 8, 6);

  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.name = side > 0 ? 'legL' : 'legR';

    const haunch = setSlot(new THREE.Mesh(buildHaunchGeo(THREE, side), mats.fur), 'fur');
    haunch.position.set(0.068 * side, 0.058, -0.072);
    haunch.rotation.y = 0.22 * side;
    leg.add(haunch);

    const shinCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.072 * side, 0.042, -0.052),
      new THREE.Vector3(0.076 * side, 0.024, -0.016),
      new THREE.Vector3(0.075 * side, 0.015, 0.020)
    ]);
    const shinGeo = makeTaperedTube(THREE, shinCurve, (u) => 0.024 - 0.006 * u, 16, 14);
    leg.add(setSlot(new THREE.Mesh(shinGeo, mats.fur), 'fur'));

    const paw = setSlot(new THREE.Mesh(hindPawGeo, mats.fur), 'fur');
    paw.position.set(0.075 * side, 0.014, 0.032);
    paw.rotation.y = 0.16 * side;
    leg.add(paw);

    // Subtle tiny feline claws peeking from lion hind toes
    for (let c = -1; c <= 1; c++) {
      const hc = setSlot(new THREE.Mesh(hindClawGeo, mats.claw), 'primary');
      hc.position.set(c * 0.010, -0.004, 0.028 - Math.abs(c) * 0.003);
      paw.add(hc);
    }

    body.add(leg);
  }

  // === CURLED TUFTED LION TAIL (tail) ===
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(0, 0.048, -0.148);
  body.add(tail);

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 0.008, 0.028),      // deeply inside rump
    new THREE.Vector3(0.012, -0.028, -0.064),  // sweeps back near floor (world z ≈ -0.212)
    new THREE.Vector3(0.088, -0.031, -0.082),  // rear curve (world z ≈ -0.230, y ≈ 0.017)
    new THREE.Vector3(0.152, -0.028, -0.014),  // wraps cleanly around left haunch
    new THREE.Vector3(0.158, -0.014, 0.072),   // sweeps forward along side
    new THREE.Vector3(0.136, 0.026, 0.122)     // curls gracefully up at tip
  ]);
  const tailGeo = makeTaperedTube(
    THREE,
    tailCurve,
    (u) => 0.0185 * (1 - 0.44 * u) + 0.002 * Math.sin(u * Math.PI),
    42,
    14
  );
  tail.add(setSlot(new THREE.Mesh(tailGeo, mats.fur), 'fur'));

  // Fluffy lion tail tuft at the curled tip
  const tuftGroup = new THREE.Group();
  const tipPos = tailCurve.getPoint(1);
  const tipTan = tailCurve.getTangent(1).normalize();
  tuftGroup.position.copy(tipPos);
  tuftGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipTan);

  const tuftCore = setSlot(new THREE.Mesh(buildTailTuftCoreGeo(THREE), mats.tailTuft), 'secondary');
  tuftCore.position.y = -0.006;
  tuftGroup.add(tuftCore);

  const lockGeo = makeCurvedFeather(THREE, {
    length: 0.056,
    width: 0.020,
    thickness: 0.0038,
    bendZ: 0.012,
    cup: 0.003
  });
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    const lock = setSlot(new THREE.Mesh(lockGeo, mats.tailTuft), 'secondary');
    lock.position.set(Math.cos(ang) * 0.010, 0.004, Math.sin(ang) * 0.010);
    lock.rotation.order = 'YXZ';
    lock.rotation.y = -ang + Math.PI * 0.5;
    lock.rotation.x = 0.22;
    tuftGroup.add(lock);
  }
  tail.add(tuftGroup);

  // Subtle overall scale tuning so total length sits right around 0.45 m
  root.scale.setScalar(1.04);

  // Store animation references & base poses cleanly for stateless idle()
  root.userData.anim = {
    body,
    head,
    tail,
    wingL,
    wingR,
    armL,
    earL: ears.earL,
    earR: ears.earR,
    eyeL,
    eyeR,
    base: {
      headRot: [head.rotation.x, head.rotation.y, head.rotation.z],
      earLRot: [ears.earL.rotation.x, ears.earL.rotation.y, ears.earL.rotation.z],
      earRRot: [ears.earR.rotation.x, ears.earR.rotation.y, ears.earR.rotation.z],
      wingLRot: [wingL.rotation.x, wingL.rotation.y, wingL.rotation.z],
      wingRRot: [wingR.rotation.x, wingR.rotation.y, wingR.rotation.z],
      armLRot: [armL.rotation.x, armL.rotation.y, armL.rotation.z],
      tailRot: [tail.rotation.x, tail.rotation.y, tail.rotation.z]
    }
  };

  return root;
}

export function idle(group, t) {
  const anim = group.userData && group.userData.anim;
  if (!anim) return;

  const { body, head, tail, wingL, wingR, armL, earL, earR, eyeL, eyeR, base } = anim;

  // 1. Soft cozy breathing (pinned at y = 0)
  const breath = Math.sin(t * 2.05);
  body.scale.set(
    1 + breath * 0.009,
    1 + breath * 0.016,
    1 + breath * 0.007
  );

  // 2. Curious gentle head sway & breath nod
  head.rotation.set(
    base.headRot[0] + Math.sin(t * 2.05 - 0.55) * 0.024,
    base.headRot[1] + Math.sin(t * 0.72) * 0.095 + Math.sin(t * 0.31) * 0.04,
    base.headRot[2] + Math.sin(t * 0.54 + 0.9) * 0.055
  );

  // 3. Ear-tuft gentle sway + occasional cute flick
  const flickPhase = (t % 5.6);
  const flick = flickPhase < 0.28 ? Math.sin((flickPhase / 0.28) * Math.PI) * 0.16 : 0;
  const earSway = Math.sin(t * 1.3) * 0.03;
  earL.rotation.set(
    base.earLRot[0] + earSway,
    base.earLRot[1],
    base.earLRot[2] - flick
  );
  earR.rotation.set(
    base.earRRot[0] - earSway * 0.7,
    base.earRRot[1],
    base.earRRot[2] + flick * 0.45
  );

  // 4. Folded wings breathe & subtle cozy settle
  const wingBreath = breath * 0.022;
  wingL.rotation.set(
    base.wingLRot[0],
    base.wingLRot[1] - wingBreath * 0.8,
    base.wingLRot[2] + wingBreath
  );
  wingR.rotation.set(
    base.wingRRot[0],
    base.wingRRot[1] + wingBreath * 0.8,
    base.wingRRot[2] - wingBreath
  );

  // 5. Playfully raised left talon gentle bob
  armL.rotation.set(
    base.armLRot[0] + Math.sin(t * 1.42 + 0.4) * 0.058,
    base.armLRot[1] + Math.sin(t * 0.85) * 0.025,
    base.armLRot[2] + Math.sin(t * 1.42) * 0.022
  );

  // 6. Graceful feline tail sway
  tail.rotation.set(
    base.tailRot[0] + Math.sin(t * 1.12 + 0.8) * 0.022,
    base.tailRot[1] + Math.sin(t * 1.12) * 0.075 + Math.sin(t * 2.24) * 0.018,
    base.tailRot[2] + Math.sin(t * 1.12 + 1.2) * 0.028
  );

  // 7. Natural blink every ~4.2 seconds (with an occasional double-blink)
  const blinkCycle = 4.2;
  const cycleIdx = Math.floor(t / blinkCycle);
  const bt = t % blinkCycle;
  let eyeScaleY = 1.0;

  if (bt > 3.72 && bt < 3.90) {
    const p = (bt - 3.72) / 0.18;
    eyeScaleY = 1.0 - 0.92 * Math.sin(p * Math.PI);
  } else if (cycleIdx % 3 === 1 && bt > 3.96 && bt < 4.13) {
    const p = (bt - 3.96) / 0.17;
    eyeScaleY = 1.0 - 0.90 * Math.sin(p * Math.PI);
  }

  eyeL.scale.y = eyeScaleY;
  eyeR.scale.y = eyeScaleY;
}
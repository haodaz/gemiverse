export const META = {
  id: 'cozy-parakeet',
  name: 'Cozy Round Parakeet',
  kind: 'companion',
  footprint: [0.10, 0.12],
  variants: ['classic', 'pied', 'opaline', 'spangle'],
  note: 'Hero-quality stylised round parakeet perched on a turned wooden stand with a tiny seed cup, sculpted continuous head and body, layered curved bezier wing and tail feathers, and zygodactyl toes.'
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

function shiftColor(THREE, baseHex, dh, ds, dl) {
  const c = new THREE.Color(baseHex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  hsl.h = (hsl.h + dh + 1) % 1;
  hsl.s = clamp(hsl.s + ds, 0, 1);
  hsl.l = clamp(hsl.l + dl, 0, 1);
  c.setHSL(hsl.h, hsl.s, hsl.l);
  return c;
}

function colorToRgba(c, alpha = 1) {
  const r = Math.round(clamp(c.r, 0, 1) * 255);
  const g = Math.round(clamp(c.g, 0, 1) * 255);
  const b = Math.round(clamp(c.b, 0, 1) * 255);
  return alpha >= 0.999 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

function buildTaperedTube(THREE, points, radiusFn, tubularSegs = 20, radialSegs = 12, capStart = true, capEnd = true) {
  const curve = new THREE.CatmullRomCurve3(points);
  const positions = [];
  const uvs = [];
  const indices = [];

  const tangents = [];
  const pts = [];
  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    pts.push(curve.getPoint(u));
    tangents.push(curve.getTangent(u).normalize());
  }

  const normals = [];
  const binormals = [];
  const t0 = tangents[0];
  const upRef = Math.abs(t0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const n0 = new THREE.Vector3().crossVectors(t0, upRef).normalize();
  normals.push(n0);
  binormals.push(new THREE.Vector3().crossVectors(t0, n0).normalize());

  const q = new THREE.Quaternion();
  for (let i = 1; i <= tubularSegs; i++) {
    q.setFromUnitVectors(tangents[i - 1], tangents[i]);
    const ni = normals[i - 1].clone().applyQuaternion(q).normalize();
    const bi = new THREE.Vector3().crossVectors(tangents[i], ni).normalize();
    normals.push(ni);
    binormals.push(bi);
  }

  const ringStride = radialSegs + 1;
  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    const r = Math.max(0.00005, radiusFn(u));
    const p = pts[i];
    const N = normals[i];
    const B = binormals[i];
    for (let j = 0; j <= radialSegs; j++) {
      const v = j / radialSegs;
      const a = v * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const vx = p.x + r * (ca * N.x + sa * B.x);
      const vy = p.y + r * (ca * N.y + sa * B.y);
      const vz = p.z + r * (ca * N.z + sa * B.z);
      positions.push(vx, vy, vz);
      uvs.push(v, u);
    }
  }

  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * ringStride + j;
      const b = (i + 1) * ringStride + j;
      const c = (i + 1) * ringStride + (j + 1);
      const d = i * ringStride + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  if (capStart) {
    const r0 = Math.max(0.00005, radiusFn(0));
    const tip = pts[0].clone().addScaledVector(tangents[0], -r0 * 0.65);
    const centerIdx = positions.length / 3;
    positions.push(tip.x, tip.y, tip.z);
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(centerIdx, j + 1, j);
    }
  }

  if (capEnd) {
    const r1 = Math.max(0.00005, radiusFn(1));
    const tip = pts[tubularSegs].clone().addScaledVector(tangents[tubularSegs], r1 * 0.75);
    const centerIdx = positions.length / 3;
    positions.push(tip.x, tip.y, tip.z);
    uvs.push(0.5, 1);
    const base = tubularSegs * ringStride;
    for (let j = 0; j < radialSegs; j++) {
      indices.push(centerIdx, base + j, base + j + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildFeatherGeometry(THREE, cfg) {
  const {
    length = 0.032,
    width = 0.011,
    thickness = 0.0008,
    bevel = 0.00035,
    asymmetry = 0.14,
    arch = 0.0045,
    cup = 0.0012,
    twist = 0.0,
    tipRound = 0.42
  } = cfg;

  const wL = width * (0.5 - asymmetry * 0.5);
  const wR = width * (0.5 + asymmetry * 0.5);
  const tipX = -width * asymmetry * 0.18;

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-wL * 0.55, length * 0.09, -wL * 0.98, length * 0.24, -wL, length * 0.42);
  shape.bezierCurveTo(-wL * 1.01, length * 0.62, -wL * (0.72 + tipRound * 0.12), length * 0.84, -wL * (0.28 + tipRound * 0.2), length * 0.95);
  shape.bezierCurveTo(-wL * 0.10, length * 1.005, tipX - width * 0.04, length * 1.01, tipX, length);
  shape.bezierCurveTo(tipX + width * 0.06, length * 1.01, wR * 0.16, length * 1.005, wR * (0.30 + tipRound * 0.2), length * 0.95);
  shape.bezierCurveTo(wR * (0.74 + tipRound * 0.12), length * 0.84, wR * 1.02, length * 0.62, wR, length * 0.42);
  shape.bezierCurveTo(wR * 0.98, length * 0.24, wR * 0.55, length * 0.09, 0, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelSegments: 2,
    curveSegments: 9,
    steps: 1
  });

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const halfThick = thickness * 0.5;
  const halfW = Math.max(wL, wR) + bevel;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i) - halfThick;

    const v = clamp(y / length, 0, 1);
    const uNorm = clamp(x / halfW, -1, 1);

    // Normalized UVs across feather vane
    uv.setXY(i, clamp((x + wL) / (wL + wR), 0, 1), v);

    // Subtle twist around feather length axis
    if (twist !== 0) {
      const ang = twist * v;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const nx = x * ca - z * sa;
      const nz = x * sa + z * ca;
      x = nx;
      z = nz;
    }

    // Gentle longitudinal arch + slight arc-length foreshortening
    const bend = arch * (0.25 * v + 0.75 * v * v);
    z -= bend;
    y -= (arch * arch) / (2.2 * length) * v * v * v;

    // Subtle cross-sectional cupping
    const cupFactor = Math.sin(v * Math.PI);
    z -= cup * (uNorm * uNorm) * (0.25 + 0.75 * cupFactor);

    // Subtle central rachis shaft bump on dorsal face
    if (z > 0) {
      z += thickness * 0.28 * Math.exp(-uNorm * uNorm * 22) * (1 - v * 0.75);
    }

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function orientBasis(THREE, dirVec, outVec) {
  const Y = dirVec.clone().normalize();
  const X = new THREE.Vector3().crossVectors(Y, outVec).normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y).normalize();
  const mat = new THREE.Matrix4().makeBasis(X, Y, Z);
  return new THREE.Quaternion().setFromRotationMatrix(mat);
}

function makeBodyTextures(THREE, kit, palette, variant) {
  const colorTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    // Base vertical/dorsal-ventral gradient
    const baseCol = palette.fur;
    const bellyCol = palette.belly;
    const backCol = palette.furDeep;
    const accentDark = palette.darkBar;
    const creamCol = palette.cream;

    ctx.fillStyle = colorToRgba(baseCol);
    ctx.fillRect(0, 0, w, h);

    // Horizontal wrap shading: u=0.25 front (+Z), u=0.75 back (-Z)
    for (let x = 0; x < w; x += 2) {
      const u = x / w;
      const frontWeight = 0.5 + 0.5 * Math.cos((u - 0.25) * Math.PI * 2);
      const backWeight = 1 - frontWeight;

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      const topC = baseCol.clone().lerp(backCol, backWeight * 0.55);
      const midC = baseCol.clone().lerp(bellyCol, frontWeight * 0.52).lerp(backCol, backWeight * 0.35);
      const botC = bellyCol.clone().lerp(creamCol, frontWeight * 0.38);

      grad.addColorStop(0.0, colorToRgba(topC));
      grad.addColorStop(0.42, colorToRgba(midC));
      grad.addColorStop(0.85, colorToRgba(botC));
      grad.addColorStop(1.0, colorToRgba(botC));
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, 2, h);
    }

    // Variant-specific body markings
    if (variant === 'pied') {
      // Cozy warm cream-butter chest band and dappled pastel rump patch
      const chestGrad = ctx.createRadialGradient(w * 0.25, h * 0.54, w * 0.03, w * 0.25, h * 0.54, w * 0.22);
      chestGrad.addColorStop(0, colorToRgba(creamCol, 0.92));
      chestGrad.addColorStop(0.62, colorToRgba(creamCol, 0.72));
      chestGrad.addColorStop(1, colorToRgba(creamCol, 0));
      ctx.fillStyle = chestGrad;
      ctx.fillRect(0, 0, w, h);

      const napeGrad = ctx.createRadialGradient(w * 0.75, h * 0.22, w * 0.02, w * 0.75, h * 0.22, w * 0.14);
      napeGrad.addColorStop(0, colorToRgba(creamCol, 0.85));
      napeGrad.addColorStop(0.65, colorToRgba(creamCol, 0.35));
      napeGrad.addColorStop(1, colorToRgba(creamCol, 0));
      ctx.fillStyle = napeGrad;
      ctx.fillRect(0, 0, w, h);
    } else if (variant === 'opaline') {
      // Luminous pastel V-mantle down upper back + bright iridescent breast glow
      const vGrad = ctx.createRadialGradient(w * 0.75, h * 0.35, w * 0.02, w * 0.75, h * 0.35, w * 0.18);
      vGrad.addColorStop(0, colorToRgba(palette.furBright, 0.75));
      vGrad.addColorStop(1, colorToRgba(palette.furBright, 0));
      ctx.fillStyle = vGrad;
      ctx.fillRect(0, 0, w, h);
    } else if (variant === 'spangle') {
      // Soft pearlescent belly glow
      const pearlGrad = ctx.createRadialGradient(w * 0.25, h * 0.62, w * 0.04, w * 0.25, h * 0.62, w * 0.26);
      pearlGrad.addColorStop(0, colorToRgba(creamCol, 0.55));
      pearlGrad.addColorStop(1, colorToRgba(creamCol, 0));
      ctx.fillStyle = pearlGrad;
      ctx.fillRect(0, 0, w, h);
    }

    // Classic/variant shell bars across upper back & nape (around u=0.75, v=0.55..0.95 -> y=0.05..0.45)
    if (variant === 'classic' || variant === 'spangle' || variant === 'pied') {
      const barAlpha = variant === 'classic' ? 0.74 : variant === 'spangle' ? 0.36 : 0.24;
      const rows = variant === 'classic' ? 14 : 9;
      for (let r = 0; r < rows; r++) {
        const yBase = h * (0.07 + r * 0.026);
        const span = 0.24 - r * 0.004;
        const xStart = w * (0.75 - span);
        const xEnd = w * (0.75 + span);

        ctx.beginPath();
        for (let x = xStart; x <= xEnd; x += 4) {
          const t = (x - xStart) / (xEnd - xStart);
          const wave = Math.sin(t * Math.PI * 10 + r * 1.4) * 3.2;
          const archY = yBase + Math.pow(Math.abs(t - 0.5) * 2, 2) * 10 + wave;
          if (x === xStart) ctx.moveTo(x, archY);
          else ctx.lineTo(x, archY);
        }
        ctx.strokeStyle = colorToRgba(variant === 'spangle' ? creamCol : creamCol, barAlpha * 0.65);
        ctx.lineWidth = variant === 'classic' ? 4.4 : 3.2;
        ctx.stroke();

        ctx.strokeStyle = colorToRgba(accentDark, barAlpha);
        ctx.lineWidth = variant === 'classic' ? 2.1 : 1.35;
        ctx.stroke();
      }
    }

    // Fine downy feather flecks all across the body
    for (let i = 0; i < 2600; i++) {
      const n1 = kit.noise(i * 0.137, 1.7);
      const n2 = kit.noise(3.1, i * 0.193);
      const x = ((i * 73.13 + n1 * 90) % w);
      const y = ((i * 41.7 + n2 * 80) % h);
      const light = kit.noise(x * 0.04, y * 0.04) > 0.5;
      const strokeCol = light ? palette.furBright : palette.furDeep;
      const len = 5 + n1 * 7;
      ctx.strokeStyle = colorToRgba(strokeCol, 0.16 + n2 * 0.12);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + (n1 - 0.5) * 3, y + len * 0.5, x + (n2 - 0.5) * 2.5, y + len);
      ctx.stroke();
    }
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.ClampToEdgeWrapping;

  const bumpTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) {
      const n1 = kit.noise(i * 0.21, 5.2);
      const n2 = kit.noise(2.4, i * 0.17);
      const x = (i * 53.7 + n1 * 40) % w;
      const y = (i * 29.3 + n2 * 40) % h;
      const v = Math.round(112 + n1 * 42);
      ctx.strokeStyle = `rgb(${v},${v},${v})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (n2 - 0.5) * 2, y + 6 + n1 * 5);
      ctx.stroke();
    }
  });
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.ClampToEdgeWrapping;

  return { map: colorTex, bumpMap: bumpTex };
}

function makeHeadTextures(THREE, kit, palette, variant) {
  const colorTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const faceMaskCol = variant === 'opaline'
      ? palette.cream.clone().lerp(palette.furBright, 0.42)
      : palette.cream;

    // Base head plumage colour
    ctx.fillStyle = colorToRgba(palette.fur);
    ctx.fillRect(0, 0, w, h);

    // Richer back-of-head shading (u = 0.75)
    for (let x = 0; x < w; x += 2) {
      const u = x / w;
      const backW = 0.5 + 0.5 * Math.cos((u - 0.75) * Math.PI * 2);
      const c = palette.fur.clone().lerp(palette.furDeep, backW * 0.35);
      ctx.fillStyle = colorToRgba(c);
      ctx.fillRect(x, 0, 2, h);
    }

    // Cozy sunny parakeet face cap & cheek mask centered on front (u = 0.25, y = 0.42)
    const maskGrad = ctx.createRadialGradient(w * 0.25, h * 0.46, w * 0.04, w * 0.25, h * 0.47, w * 0.24);
    maskGrad.addColorStop(0.0, colorToRgba(faceMaskCol, 0.98));
    maskGrad.addColorStop(0.58, colorToRgba(faceMaskCol, 0.90));
    maskGrad.addColorStop(0.84, colorToRgba(faceMaskCol, 0.35));
    maskGrad.addColorStop(1.0, colorToRgba(faceMaskCol, 0));
    ctx.fillStyle = maskGrad;
    ctx.fillRect(0, 0, w, h);

    // Forehead crown cap brightness
    const crownGrad = ctx.createRadialGradient(w * 0.25, h * 0.24, w * 0.02, w * 0.25, h * 0.26, w * 0.16);
    crownGrad.addColorStop(0.0, colorToRgba(faceMaskCol, 0.95));
    crownGrad.addColorStop(0.7, colorToRgba(faceMaskCol, 0.45));
    crownGrad.addColorStop(1.0, colorToRgba(faceMaskCol, 0));
    ctx.fillStyle = crownGrad;
    ctx.fillRect(0, 0, w, h);

    // Fine wavy parakeet head stripes over top-back crown & nape
    if (variant !== 'pied') {
      const stripeRows = variant === 'classic' ? 15 : variant === 'spangle' ? 10 : 8;
      const stripeAlpha = variant === 'classic' ? 0.68 : variant === 'spangle' ? 0.26 : 0.22;
      const startY = variant === 'classic' ? 0.14 : 0.22;
      for (let r = 0; r < stripeRows; r++) {
        const yPos = h * (startY + r * 0.036);
        const span = 0.27 - Math.abs(r - 6) * 0.008;
        const x0 = w * (0.75 - span);
        const x1 = w * (0.75 + span);
        ctx.beginPath();
        for (let x = x0; x <= x1; x += 3) {
          const t = (x - x0) / (x1 - x0);
          const wave = Math.sin(t * Math.PI * 14 + r * 1.1) * 2.1;
          const y = yPos + Math.pow((t - 0.5) * 2, 2) * 14 + wave;
          if (x === x0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = colorToRgba(palette.darkBar, stripeAlpha);
        ctx.lineWidth = variant === 'classic' ? 1.85 : 1.2;
        ctx.stroke();
      }
    }

    // Cheek patches (iconic soft periwinkle-violet budgie cheek patches)
    const cheekCol = variant === 'spangle'
      ? palette.cheekPatch.clone().lerp(palette.cream, 0.35)
      : palette.cheekPatch;
    const drawCheekPatch = (cx, cy, tilt) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);
      const cg = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
      cg.addColorStop(0, colorToRgba(cheekCol, 0.82));
      cg.addColorStop(0.62, colorToRgba(cheekCol, 0.45));
      cg.addColorStop(1, colorToRgba(cheekCol, 0));
      ctx.fillStyle = cg;
      ctx.scale(1.35, 0.82);
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    drawCheekPatch(w * 0.145, h * 0.585, -0.35);
    drawCheekPatch(w * 0.355, h * 0.585, 0.35);

    // Subtle warm rosy blush discs just below the eyes for chibi charm
    const drawBlush = (cx, cy) => {
      const bg = ctx.createRadialGradient(cx, cy, 1, cx, cy, 18);
      bg.addColorStop(0, 'rgba(244, 152, 152, 0.38)');
      bg.addColorStop(0.65, 'rgba(244, 152, 152, 0.16)');
      bg.addColorStop(1, 'rgba(244, 152, 152, 0)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.fill();
    };
    drawBlush(w * 0.165, h * 0.545);
    drawBlush(w * 0.335, h * 0.545);

    // Adorable parakeet throat necklace spots on lower cheeks
    const spotCount = variant === 'pied' ? 2 : 3;
    const spotOffsets = [
      { du: 0.048, dv: 0.665, r: 5.5 },
      { du: 0.082, dv: 0.648, r: 6.2 },
      { du: 0.114, dv: 0.622, r: 5.0 }
    ];
    for (let s = 0; s < spotCount; s++) {
      const sp = spotOffsets[s];
      for (const sign of [-1, 1]) {
        const sx = w * (0.25 + sign * sp.du);
        const sy = h * sp.dv;
        if (variant === 'spangle') {
          ctx.strokeStyle = colorToRgba(palette.darkBar, 0.72);
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(sx, sy, sp.r, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          const sg = ctx.createRadialGradient(sx, sy, 1, sx, sy, sp.r);
          sg.addColorStop(0, colorToRgba(palette.darkBar, 0.88));
          sg.addColorStop(0.7, colorToRgba(palette.darkBar, 0.72));
          sg.addColorStop(1, colorToRgba(palette.darkBar, 0));
          ctx.fillStyle = sg;
          ctx.beginPath();
          ctx.arc(sx, sy, sp.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Soft micro downy feather strokes on head
    for (let i = 0; i < 1800; i++) {
      const n1 = kit.noise(i * 0.17, 4.1);
      const n2 = kit.noise(6.3, i * 0.13);
      const x = (i * 61.9 + n1 * 55) % w;
      const y = (i * 37.3 + n2 * 55) % h;
      const bright = n1 > 0.5;
      ctx.strokeStyle = bright ? 'rgba(255,255,255,0.12)' : 'rgba(20,30,35,0.08)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (n2 - 0.5) * 3, y + 4 + n1 * 4);
      ctx.stroke();
    }
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.ClampToEdgeWrapping;
  return colorTex;
}

function makeFeatherTextures(THREE, kit, palette, variant, isPrimary) {
  const colorTex = kit.canvasTexture(256, 512, (ctx, w, h) => {
    const base = isPrimary ? palette.wingPrimary : palette.wingCovert;
    const dark = palette.darkBar;
    const edge = palette.cream;
    const sheenWash = palette.fur;

    // Base longitudinal gradient (root at bottom y=h, tip at top y=0 because flipY=true -> v=1 at y=0)
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    if (variant === 'pied') {
      grad.addColorStop(0.0, colorToRgba(edge));
      grad.addColorStop(0.45, colorToRgba(base.clone().lerp(edge, 0.52)));
      grad.addColorStop(0.82, colorToRgba(base));
      grad.addColorStop(1.0, colorToRgba(edge));
    } else if (variant === 'opaline') {
      grad.addColorStop(0.0, colorToRgba(sheenWash));
      grad.addColorStop(0.50, colorToRgba(base.clone().lerp(sheenWash, 0.35)));
      grad.addColorStop(0.86, colorToRgba(dark));
      grad.addColorStop(1.0, colorToRgba(sheenWash.clone().lerp(edge, 0.5)));
    } else if (variant === 'spangle') {
      grad.addColorStop(0.0, colorToRgba(base.clone().lerp(edge, 0.45)));
      grad.addColorStop(0.55, colorToRgba(edge.clone().lerp(sheenWash, 0.25)));
      grad.addColorStop(0.88, colorToRgba(edge));
      grad.addColorStop(1.0, colorToRgba(edge));
    } else {
      // classic budgie scalloped wing feather
      grad.addColorStop(0.0, colorToRgba(base));
      grad.addColorStop(0.35, colorToRgba(dark.clone().lerp(base, 0.45)));
      grad.addColorStop(0.85, colorToRgba(dark));
      grad.addColorStop(1.0, colorToRgba(dark));
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Crisp scalloped / spangled outer feather border following the oval vane silhouette
    if (variant === 'classic' || variant === 'spangle' || variant === 'opaline') {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.48, w * 0.44, h * 0.45, 0, 0, Math.PI * 2);
      if (variant === 'spangle') {
        // Delicate luminous outer edge + fine dark pencil inner border
        ctx.strokeStyle = colorToRgba(dark, 0.85);
        ctx.lineWidth = isPrimary ? 10 : 12;
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(w * 0.5, h * 0.48, w * 0.47, h * 0.475, 0, 0, Math.PI * 2);
        ctx.strokeStyle = colorToRgba(edge, 0.95);
        ctx.lineWidth = isPrimary ? 11 : 14;
        ctx.stroke();
      } else if (variant === 'classic') {
        ctx.strokeStyle = colorToRgba(edge, isPrimary ? 0.72 : 0.92);
        ctx.lineWidth = isPrimary ? 18 : 28;
        ctx.stroke();
      } else if (variant === 'opaline') {
        ctx.strokeStyle = colorToRgba(sheenWash.clone().lerp(edge, 0.4), 0.75);
        ctx.lineWidth = isPrimary ? 14 : 20;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Directional fine feather barbs radiating upward and outward from central shaft
    const cx = w * 0.5;
    for (let i = 0; i < 160; i++) {
      const y = (i / 160) * h;
      const n = kit.noise(i * 0.31, isPrimary ? 9.1 : 3.4);
      ctx.strokeStyle = n > 0.5 ? 'rgba(255,255,255,0.16)' : 'rgba(10,18,24,0.16)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(0, y - 34 - n * 10);
      ctx.moveTo(cx, y);
      ctx.lineTo(w, y - 34 - n * 10);
      ctx.stroke();
    }

    // Central rachis shaft
    const shaftGrad = ctx.createLinearGradient(0, h, 0, 0);
    shaftGrad.addColorStop(0, colorToRgba(edge, 0.7));
    shaftGrad.addColorStop(0.85, colorToRgba(edge, 0.35));
    shaftGrad.addColorStop(1, colorToRgba(edge, 0.05));
    ctx.strokeStyle = shaftGrad;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(cx, h);
    ctx.lineTo(cx, 10);
    ctx.stroke();
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;

  const bumpTex = kit.canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    const cx = w * 0.5;
    for (let i = 0; i < 110; i++) {
      const y = (i / 110) * h;
      const v = i % 2 === 0 ? 155 : 105;
      ctx.strokeStyle = `rgb(${v},${v},${v})`;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(0, y - 22);
      ctx.moveTo(cx, y);
      ctx.lineTo(w, y - 22);
      ctx.stroke();
    }
    ctx.strokeStyle = '#d8d8d8';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(cx, h);
    ctx.lineTo(cx, 6);
    ctx.stroke();
  });

  return { map: colorTex, bumpMap: bumpTex };
}

function makeTailTexture(THREE, kit, palette, variant) {
  const tex = kit.canvasTexture(128, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    const tipCol = variant === 'pied'
      ? palette.cream.clone().lerp(palette.wingPrimary, 0.35)
      : palette.tailTip;
    grad.addColorStop(0.0, colorToRgba(palette.fur));
    grad.addColorStop(0.38, colorToRgba(palette.wingPrimary));
    grad.addColorStop(0.82, colorToRgba(tipCol));
    grad.addColorStop(1.0, colorToRgba(tipCol.clone().lerp(palette.darkBar, 0.25)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (variant === 'spangle') {
      ctx.strokeStyle = colorToRgba(palette.cream, 0.65);
      ctx.lineWidth = 10;
      ctx.strokeRect(4, 4, w - 8, h - 8);
    }

    const cx = w * 0.5;
    for (let i = 0; i < 180; i++) {
      const y = (i / 180) * h;
      const n = kit.noise(i * 0.29, 7.7);
      ctx.strokeStyle = n > 0.5 ? 'rgba(255,255,255,0.13)' : 'rgba(10,16,28,0.15)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(0, y - 26);
      ctx.moveTo(cx, y);
      ctx.lineTo(w, y - 26);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, h);
    ctx.lineTo(cx, 12);
    ctx.stroke();
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeIrisTexture(THREE, kit, eyeColor) {
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const outer = eyeColor.clone().multiplyScalar(0.45);
    const bright = eyeColor.clone().lerp(new THREE.Color('#fff1d2'), 0.35);

    const g = ctx.createRadialGradient(cx, cy, w * 0.12, cx, cy, w * 0.5);
    g.addColorStop(0.0, colorToRgba(outer));
    g.addColorStop(0.35, colorToRgba(bright));
    g.addColorStop(0.75, colorToRgba(eyeColor));
    g.addColorStop(1.0, colorToRgba(outer));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const n = kit.noise(Math.cos(a) * 4 + 5, Math.sin(a) * 4 + 5);
      ctx.strokeStyle = n > 0.5 ? 'rgba(255,248,220,0.22)' : 'rgba(20,12,8,0.22)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18);
      ctx.lineTo(cx + Math.cos(a) * 60, cy + Math.sin(a) * 60);
      ctx.stroke();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeWoodTextures(THREE, kit) {
  const colorTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#a47247';
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 4) {
        const nx = x / w;
        const ny = y / h;
        const warp = kit.noise(nx * 3.5, ny * 2.5) * 0.25;
        const ring = Math.sin((nx * 14 + warp * 9) * Math.PI * 2) * 0.5 + 0.5;
        const fine = kit.noise(nx * 28, ny * 6);
        const shade = ring * 0.65 + fine * 0.35;
        const r = Math.round(mix(124, 188, shade));
        const g = Math.round(mix(80, 136, shade));
        const b = Math.round(mix(48, 88, shade));
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, 4, 2);
      }
    }

    // Fine wood pores
    for (let i = 0; i < 600; i++) {
      const n1 = kit.noise(i * 0.19, 2.2);
      const n2 = kit.noise(8.1, i * 0.23);
      const x = (i * 89.3 + n1 * 70) % w;
      const y = (i * 47.1 + n2 * 70) % h;
      ctx.strokeStyle = 'rgba(72, 42, 22, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (n1 - 0.5) * 4, y + 10 + n2 * 14);
      ctx.stroke();
    }
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.RepeatWrapping;

  const bumpTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const nx = x / w;
        const ny = y / h;
        const warp = kit.noise(nx * 3.5, ny * 2.5) * 0.25;
        const ring = Math.sin((nx * 14 + warp * 9) * Math.PI * 2) * 0.5 + 0.5;
        const v = Math.round(108 + ring * 44);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
  });
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;

  return { map: colorTex, bumpMap: bumpTex };
}

function makeDishTexture(THREE, kit, accentCol) {
  const tex = kit.canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f2e8d9';
    ctx.fillRect(0, 0, w, h);

    // Subtle stoneware glaze speckles
    for (let i = 0; i < 420; i++) {
      const n1 = kit.noise(i * 0.27, 1.4);
      const n2 = kit.noise(4.5, i * 0.31);
      const x = (i * 43.7 + n1 * 30) % w;
      const y = (i * 19.3 + n2 * 25) % h;
      ctx.fillStyle = n1 > 0.5 ? 'rgba(132, 108, 86, 0.22)' : 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + n2 * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hand-painted cozy pastel stripe near rim
    ctx.fillStyle = colorToRgba(accentCol, 0.55);
    ctx.fillRect(0, h * 0.34, w, h * 0.10);
    ctx.fillStyle = colorToRgba(accentCol, 0.32);
    ctx.fillRect(0, h * 0.47, w, h * 0.035);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function buildSculptedBodyGeometry(THREE, kit) {
  const geo = new THREE.SphereGeometry(1, 56, 40);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    let x = nx * 0.0248;
    let y = ny * 0.0305;
    let z = nz * 0.0278;

    // Plump proud parakeet chest bulging forward & subtly full
    const chestMask = smoothstep(-0.15, 0.85, nz) * Math.exp(-Math.pow((ny - 0.04) / 0.62, 2));
    z += chestMask * 0.0072;
    x *= 1 + chestMask * 0.08;
    y += chestMask * 0.0014;

    // Sleek songbird back & teardrop tapered rump sloping down-back to tail socket
    const backMask = smoothstep(0.15, -0.82, nz);
    const rumpMask = backMask * smoothstep(0.45, -0.58, ny);
    z -= rumpMask * 0.0115;
    y -= rumpMask * 0.0095;
    x *= 1 - rumpMask * 0.38;

    // Subtle upper-back shoulder fullness for seamless wing attachment
    const shoulderMask = Math.exp(-Math.pow((ny - 0.25) / 0.42, 2)) * smoothstep(0.35, 0.95, Math.abs(nx));
    x *= 1 + shoulderMask * 0.06;

    // Softly flattened underside hovering just over the perch/thighs
    const bellyFlat = smoothstep(-0.45, -0.95, ny);
    y += bellyFlat * 0.0052;
    z += bellyFlat * 0.0022;

    // Plump neck collar rising slightly forward to accept the cocked head with deep overlap
    const neckMask = smoothstep(0.42, 0.96, ny);
    x *= 1 - neckMask * 0.22;
    z *= 1 - neckMask * 0.16;
    y += neckMask * 0.0055;
    z += neckMask * 0.0042;

    // Micro organic downy plumage undulation
    const fluff = (kit.noise(nx * 4.5 + 2.1, ny * 4.5 + nz * 3.2) - 0.5) * 0.00055;
    x += nx * fluff;
    y += ny * fluff;
    z += nz * fluff;

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function buildSculptedHeadGeometry(THREE, kit, eyeDirL, eyeDirR) {
  const geo = new THREE.SphereGeometry(1, 52, 36);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);
    v.set(nx, ny, nz).normalize();

    let x = nx * 0.0220;
    let y = ny * 0.0222;
    let z = nz * 0.0230;

    // Fluffy puffed parakeet cheeks (irresistible budgie silhouette!)
    const cheekMask = smoothstep(0.28, 0.88, Math.abs(nx))
      * Math.exp(-Math.pow((ny + 0.16) / 0.42, 2))
      * smoothstep(-0.45, 0.45, nz);
    x += Math.sign(nx) * cheekMask * 0.0036;
    z += cheekMask * 0.0022;
    y -= cheekMask * 0.0014;

    // High sweet rounded forehead & crown dome
    const crownMask = smoothstep(0.25, 0.92, ny) * smoothstep(-0.35, 0.65, nz);
    y += crownMask * 0.0026;
    z += crownMask * 0.0012;

    // Soft central crown crest fluff ridge
    const crestMask = Math.exp(-Math.pow(nx / 0.28, 2)) * smoothstep(0.55, 0.96, ny) * smoothstep(-0.2, 0.6, nz);
    y += crestMask * 0.0015;

    // Seamless flared neck base extending deeply into the body collar
    const neckMask = smoothstep(-0.28, -0.92, ny);
    y -= neckMask * 0.0068;
    x *= 1 + neckMask * 0.06;
    z -= neckMask * 0.0018;

    // Subtle snout/beak-base taper so cere & beak integrate organically
    const faceMound = Math.exp(-Math.pow(nx / 0.32, 2))
      * Math.exp(-Math.pow((ny + 0.08) / 0.34, 2))
      * smoothstep(0.45, 0.98, nz);
    z += faceMound * 0.0020;

    // Gentle sculpted eye sockets so glossy eyes sit snugly inset, never floating
    const dotL = v.dot(eyeDirL);
    const dotR = v.dot(eyeDirR);
    const socketL = smoothstep(0.86, 0.992, dotL);
    const socketR = smoothstep(0.86, 0.992, dotR);
    const indent = (socketL + socketR) * 0.0022;
    x -= nx * indent;
    y -= ny * indent;
    z -= nz * indent;

    // Delicate fluffy brow ridge just above each eye socket
    const browDirL = eyeDirL.clone().add(new THREE.Vector3(0, 0.28, 0.05)).normalize();
    const browDirR = eyeDirR.clone().add(new THREE.Vector3(0, 0.28, 0.05)).normalize();
    const brow = (smoothstep(0.90, 0.99, v.dot(browDirL)) + smoothstep(0.90, 0.99, v.dot(browDirR))) * 0.0009;
    x += nx * brow;
    y += ny * brow;
    z += nz * brow;

    // Micro downy feather texture
    const fluff = (kit.noise(nx * 5.2 + 1.3, ny * 5.2 + nz * 4.1) - 0.5) * 0.00042;
    x += nx * fluff;
    y += ny * fluff;
    z += nz * fluff;

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function buildUpperBeakGeometry(THREE) {
  const geo = new THREE.SphereGeometry(1, 32, 24);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    const t = clamp((nz + 0.65) / 1.65, 0, 1);
    const widthTaper = 1 - 0.80 * Math.pow(t, 1.35);
    const ridgePinch = 1 - 0.28 * smoothstep(0.15, 0.95, ny) * t;

    let x = nx * 0.0049 * widthTaper * ridgePinch;
    let y = ny * 0.0044 * (1 - 0.68 * Math.pow(t, 1.55));
    let z = nz * 0.0068;

    // Hooked parrot culmen curve sweeping gracefully downward & slightly inward at tip
    y -= 0.0074 * Math.pow(t, 1.85);
    z -= 0.0022 * Math.pow(t, 3.1);

    // Scoop the underside gently upward for a crisp hooked tomium edge
    if (ny < 0) {
      y += (-ny) * 0.0021 * Math.sin(t * Math.PI);
    }

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function buildLowerBeakGeometry(THREE) {
  const geo = new THREE.SphereGeometry(1, 24, 18);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    const t = clamp((nz + 0.6) / 1.6, 0, 1);
    const x = nx * 0.0038 * (1 - 0.55 * Math.pow(t, 1.4));
    let y = ny * 0.0028 * (1 - 0.35 * t);
    const z = nz * 0.0046;

    // Cupped scoop turning gently up at the blunt rounded chin tip
    y += 0.0008 * Math.pow(t, 1.8);
    if (ny > 0) {
      y -= ny * 0.0008 * smoothstep(0.1, 0.8, t);
    }

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function buildCereGeometry(THREE) {
  const geo = new THREE.SphereGeometry(1, 28, 20);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    let x = nx * 0.0048;
    let y = ny * 0.0025;
    let z = nz * 0.0030;

    // Soft double-cushion heart curve along upper beak bridge
    const centerDip = Math.exp(-Math.pow(nx / 0.24, 2));
    y -= centerDip * 0.00045 * smoothstep(-0.2, 0.8, ny);
    y -= Math.pow(Math.abs(nx), 1.8) * 0.00085;

    // Two tiny sculpted nostril indentations
    const dL = Math.hypot(nx - 0.44, ny - 0.12, nz - 0.82);
    const dR = Math.hypot(nx + 0.44, ny - 0.12, nz - 0.82);
    const pit = (smoothstep(0.24, 0.04, dL) + smoothstep(0.24, 0.04, dR)) * 0.00095;
    z -= pit;

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function buildWingShoulderGeometry(THREE, side) {
  const geo = new THREE.SphereGeometry(1, 28, 20);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    // Sculpted teardrop covert pad hugging the body flank
    let x = nx * 0.0072;
    let y = ny * 0.0155;
    let z = nz * 0.0195;

    const backTaper = smoothstep(0.2, -0.95, nz);
    y *= 1 - backTaper * 0.35;
    x *= 1 - backTaper * 0.42;
    y -= backTaper * 0.0065;

    // Flatten inner side against body and curve outer flank smoothly
    if (nx * side < 0) {
      x *= 0.42;
    } else {
      x += side * 0.0012 * Math.exp(-Math.pow(ny / 0.65, 2));
    }

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function buildStand(THREE, kit, palette) {
  const standGroup = new THREE.Group();
  standGroup.name = 'stand';

  const woodTex = makeWoodTextures(THREE, kit);
  const woodMat = new THREE.MeshPhysicalMaterial({
    map: woodTex.map,
    bumpMap: woodTex.bumpMap,
    bumpScale: 0.0006,
    roughness: 0.50,
    metalness: 0.0,
    clearcoat: 0.24,
    clearcoatRoughness: 0.42
  });

  const darkWoodMat = new THREE.MeshPhysicalMaterial({
    map: woodTex.map,
    bumpMap: woodTex.bumpMap,
    bumpScale: 0.0005,
    color: new THREE.Color('#805536'),
    roughness: 0.44,
    metalness: 0.0,
    clearcoat: 0.30,
    clearcoatRoughness: 0.36
  });

  // 1. Turned wooden base (26 profile points, floor y = 0)
  const basePts = [
    [0.0002, 0.0000],
    [0.0415, 0.0000],
    [0.0435, 0.0006],
    [0.0442, 0.0018],
    [0.0440, 0.0030],
    [0.0426, 0.0040],
    [0.0418, 0.0047],
    [0.0422, 0.0056],
    [0.0412, 0.0067],
    [0.0394, 0.0076],
    [0.0378, 0.0084],
    [0.0365, 0.0090],
    [0.0320, 0.0092],
    [0.0255, 0.0092],
    [0.0205, 0.0095],
    [0.0178, 0.0102],
    [0.0156, 0.0112],
    [0.0142, 0.0122],
    [0.0136, 0.0128],
    [0.0124, 0.0132],
    [0.0106, 0.0135],
    [0.0096, 0.0142],
    [0.0086, 0.0146],
    [0.0074, 0.0144],
    [0.0050, 0.0142],
    [0.0002, 0.0142]
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const baseGeo = new THREE.LatheGeometry(basePts, 40);
  const baseMesh = new THREE.Mesh(baseGeo, woodMat);
  baseMesh.userData.slot = 'primary';
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  standGroup.add(baseMesh);

  // 2. Turned wooden upright post (22 profile points)
  const postPts = [
    [0.0002, 0.0120],
    [0.0084, 0.0120],
    [0.0088, 0.0138],
    [0.0080, 0.0154],
    [0.0066, 0.0168],
    [0.0074, 0.0182],
    [0.0064, 0.0196],
    [0.0055, 0.0220],
    [0.0049, 0.0255],
    [0.0046, 0.0295],
    [0.0047, 0.0335],
    [0.0052, 0.0365],
    [0.0062, 0.0384],
    [0.0068, 0.0398],
    [0.0061, 0.0412],
    [0.0053, 0.0426],
    [0.0058, 0.0442],
    [0.0068, 0.0460],
    [0.0076, 0.0476],
    [0.0072, 0.0490],
    [0.0052, 0.0498],
    [0.0002, 0.0498]
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const postGeo = new THREE.LatheGeometry(postPts, 32);
  const postMesh = new THREE.Mesh(postGeo, darkWoodMat);
  postMesh.position.set(0, 0, 0.002);
  postMesh.userData.slot = 'primary';
  postMesh.castShadow = true;
  postMesh.receiveShadow = true;
  standGroup.add(postMesh);

  // 3. Turned wooden horizontal perch bar with acorn finials (28 profile points)
  const perchPts = [
    [0.0002, -0.0485],
    [0.0026, -0.0480],
    [0.0054, -0.0464],
    [0.0068, -0.0440],
    [0.0069, -0.0414],
    [0.0056, -0.0394],
    [0.0044, -0.0380],
    [0.0056, -0.0368],
    [0.0058, -0.0352],
    [0.0053, -0.0332],
    [0.0052, -0.0260],
    [0.0052, -0.0150],
    [0.0053, -0.0060],
    [0.0056, 0.0000],
    [0.0053, 0.0060],
    [0.0052, 0.0150],
    [0.0052, 0.0260],
    [0.0053, 0.0332],
    [0.0058, 0.0352],
    [0.0056, 0.0368],
    [0.0044, 0.0380],
    [0.0056, 0.0394],
    [0.0069, 0.0414],
    [0.0068, 0.0440],
    [0.0054, 0.0464],
    [0.0026, 0.0480],
    [0.0002, 0.0485]
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const perchGeo = new THREE.LatheGeometry(perchPts, 32);
  const perchMesh = new THREE.Mesh(perchGeo, woodMat);
  perchMesh.position.set(0, 0.052, 0.002);
  perchMesh.rotation.z = Math.PI * 0.5;
  perchMesh.userData.slot = 'primary';
  perchMesh.castShadow = true;
  perchMesh.receiveShadow = true;
  standGroup.add(perchMesh);

  // 4. Tiny cozy ceramic seed dish sitting on the wooden base terrace (22 profile points)
  const dishPts = [
    [0.0002, 0.0000],
    [0.0076, 0.0000],
    [0.0086, 0.0008],
    [0.0098, 0.0022],
    [0.0108, 0.0042],
    [0.0114, 0.0062],
    [0.0116, 0.0078],
    [0.0113, 0.0089],
    [0.0107, 0.0095],
    [0.0099, 0.0095],
    [0.0094, 0.0089],
    [0.0094, 0.0076],
    [0.0092, 0.0060],
    [0.0086, 0.0044],
    [0.0076, 0.0031],
    [0.0062, 0.0023],
    [0.0044, 0.0019],
    [0.0024, 0.0018],
    [0.0002, 0.0018]
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const dishTex = makeDishTexture(THREE, kit, palette.fur);
  const dishMat = new THREE.MeshPhysicalMaterial({
    map: dishTex,
    roughness: 0.24,
    metalness: 0.0,
    clearcoat: 0.72,
    clearcoatRoughness: 0.18
  });

  const dishGroup = new THREE.Group();
  dishGroup.position.set(0.0225, 0.0090, 0.0165);
  const dishMesh = new THREE.Mesh(new THREE.LatheGeometry(dishPts, 28), dishMat);
  dishMesh.userData.slot = 'accent';
  dishMesh.castShadow = true;
  dishMesh.receiveShadow = true;
  dishGroup.add(dishMesh);

  // Tiny millet seed mound + individual golden millet grains inside the ceramic cup
  const seedMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#dfc27c'),
    roughness: 0.65,
    metalness: 0.0,
    clearcoat: 0.12
  });
  const seedDarkMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#b68b4c'),
    roughness: 0.58,
    metalness: 0.0,
    clearcoat: 0.16
  });

  const moundGeo = new THREE.SphereGeometry(0.0082, 16, 12);
  moundGeo.scale(1.0, 0.34, 1.0);
  const mound = new THREE.Mesh(moundGeo, seedMat);
  mound.position.set(0, 0.0058, 0);
  mound.userData.slot = 'accent';
  dishGroup.add(mound);

  const grainGeo = new THREE.SphereGeometry(0.0014, 10, 8);
  grainGeo.scale(1.45, 0.85, 0.92);
  for (let i = 0; i < 16; i++) {
    const angle = i * 2.39996;
    const rad = Math.sqrt((i + 0.5) / 16) * 0.0066;
    const gx = Math.cos(angle) * rad;
    const gz = Math.sin(angle) * rad;
    const gy = 0.0074 + (1 - rad / 0.0072) * 0.0016;
    const grain = new THREE.Mesh(grainGeo, i % 3 === 0 ? seedDarkMat : seedMat);
    grain.position.set(gx, gy, gz);
    grain.rotation.set(kit.noise(i, 1) * 1.4, angle, kit.noise(2, i) * 1.2);
    grain.userData.slot = 'accent';
    dishGroup.add(grain);
  }

  standGroup.add(dishGroup);
  return standGroup;
}

function buildFootAndLeg(THREE, side, skinMat, clawMat, thighMat, perchY, perchZ, perchR) {
  const legGroup = new THREE.Group();
  legGroup.name = side > 0 ? 'legL' : 'legR';

  const footX = side > 0 ? 0.0114 : -0.0118;
  const footYaw = side > 0 ? -0.14 : 0.22;

  // Fluffy feathered thigh puff emerging seamlessly from belly
  const thighGeo = new THREE.SphereGeometry(1, 20, 16);
  const tPos = thighGeo.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    const nx = tPos.getX(i);
    const ny = tPos.getY(i);
    const nz = tPos.getZ(i);
    const taper = mix(0.55, 1.15, smoothstep(-1, 0.7, ny));
    tPos.setXYZ(i, nx * 0.0062 * taper, ny * 0.0086, nz * 0.0066 * taper);
  }
  thighGeo.computeVertexNormals();
  const thighMesh = new THREE.Mesh(thighGeo, thighMat);
  thighMesh.position.set(footX * 0.94, 0.0705, -0.0006);
  thighMesh.userData.slot = 'fur';
  thighMesh.castShadow = true;
  legGroup.add(thighMesh);

  // Tapered tarsus leg tube from thigh puff down to ankle pad atop perch
  const anklePos = new THREE.Vector3(footX, perchY + perchR + 0.0012, perchZ + 0.0002);
  const tarsusPts = [
    new THREE.Vector3(footX * 0.94, 0.0682, -0.0012),
    new THREE.Vector3(footX * 0.97, 0.0642, -0.0018),
    new THREE.Vector3(footX * 0.99, 0.0608, -0.0004),
    anklePos
  ];
  const tarsusGeo = buildTaperedTube(
    THREE,
    tarsusPts,
    (u) => mix(0.0021, 0.00165, u),
    12,
    10,
    true,
    true
  );
  const tarsusMesh = new THREE.Mesh(tarsusGeo, skinMat);
  tarsusMesh.userData.slot = 'skin';
  tarsusMesh.castShadow = true;
  legGroup.add(tarsusMesh);

  // Zygodactyl parakeet toes: 2 wrapping forward, 2 wrapping backward around the perch bar!
  const toeSpecs = [
    { dir: 1, splayX: side * 0.0026, maxAng: 1.88, rBase: 0.00142, rTip: 0.00095, clawArc: 0.44 },
    { dir: 1, splayX: -side * 0.0021, maxAng: 1.66, rBase: 0.00136, rTip: 0.00092, clawArc: 0.40 },
    { dir: -1, splayX: side * 0.0024, maxAng: 1.72, rBase: 0.00135, rTip: 0.00092, clawArc: 0.42 },
    { dir: -1, splayX: -side * 0.0019, maxAng: 1.48, rBase: 0.00128, rTip: 0.00088, clawArc: 0.36 }
  ];

  const wrapR = perchR + 0.00105;

  for (const spec of toeSpecs) {
    const toePts = [];
    const steps = 6;
    for (let s = 0; s <= steps; s++) {
      const f = s / steps;
      const ang = spec.dir * mix(0.08, spec.maxAng, f);
      const localX = spec.splayX * Math.pow(f, 0.72);
      const localZ = wrapR * Math.sin(ang);
      const localY = wrapR * Math.cos(ang);
      // Slight yaw around foot center
      const rx = localX * Math.cos(footYaw) + localZ * Math.sin(footYaw) * 0.28;
      toePts.push(new THREE.Vector3(footX + rx, perchY + localY, perchZ + localZ));
    }

    const toeGeo = buildTaperedTube(
      THREE,
      toePts,
      (u) => {
        const base = mix(spec.rBase, spec.rTip, u);
        // Subtle toe pad joint swells
        const pad = 1 + 0.08 * Math.sin(u * Math.PI * 3);
        return base * pad;
      },
      14,
      9,
      true,
      true
    );
    const toeMesh = new THREE.Mesh(toeGeo, skinMat);
    toeMesh.userData.slot = 'skin';
    toeMesh.castShadow = true;
    legGroup.add(toeMesh);

    // Tiny curved glossy claw continuing from toe tip and hugging wood
    const clawPts = [];
    const clawSteps = 4;
    for (let s = 0; s <= clawSteps; s++) {
      const f = s / clawSteps;
      const ang = spec.dir * (spec.maxAng + f * spec.clawArc);
      const rClaw = mix(wrapR, perchR + 0.00015, f);
      const localX = spec.splayX * (1 + f * 0.06);
      const localZ = rClaw * Math.sin(ang);
      const localY = rClaw * Math.cos(ang);
      const rx = localX * Math.cos(footYaw) + localZ * Math.sin(footYaw) * 0.28;
      clawPts.push(new THREE.Vector3(footX + rx, perchY + localY, perchZ + localZ));
    }
    const clawGeo = buildTaperedTube(
      THREE,
      clawPts,
      (u) => Math.max(0.00012, spec.rTip * 0.76 * (1 - u * 0.88)),
      8,
      7,
      false,
      true
    );
    const clawMesh = new THREE.Mesh(clawGeo, clawMat);
    clawMesh.userData.slot = 'secondary';
    legGroup.add(clawMesh);
  }

  return legGroup;
}

function buildEyeGroup(THREE, name, side, irisMat, eyeDarkMat, sparkleMat, browMat) {
  const eyeGroup = new THREE.Group();
  eyeGroup.name = name;

  // Layer 1: Dark glossy outer eyeball dome
  const ballGeo = new THREE.SphereGeometry(0.0050, 24, 18);
  ballGeo.scale(1.0, 1.04, 0.72);
  const ball = new THREE.Mesh(ballGeo, eyeDarkMat);
  eyeGroup.add(ball);

  // Layer 2: Coloured iris ring conforming to eyeball curvature (LatheGeometry ring)
  const irisPts = [];
  for (let i = 0; i <= 16; i++) {
    const f = i / 16;
    const r = mix(0.0029, 0.00445, f);
    const zCurve = Math.sqrt(Math.max(0.000001, 0.00505 * 0.00505 - r * r)) * 0.73;
    irisPts.push(new THREE.Vector2(r, zCurve));
  }
  const irisGeo = new THREE.LatheGeometry(irisPts, 28);
  irisGeo.rotateX(Math.PI * 0.5);
  // Planar front UVs for crisp radial iris texture
  const iPos = irisGeo.attributes.position;
  const iUv = irisGeo.attributes.uv;
  for (let i = 0; i < iPos.count; i++) {
    iUv.setXY(i, 0.5 + iPos.getX(i) / 0.0092, 0.5 + iPos.getY(i) / 0.0092);
  }
  const iris = new THREE.Mesh(irisGeo, irisMat);
  iris.userData.slot = 'eye';
  eyeGroup.add(iris);

  // Layer 3: Deep jet-black glossy pupil dome nestled cleanly in iris center
  const pupilGeo = new THREE.SphereGeometry(0.00315, 20, 16);
  pupilGeo.scale(1.0, 1.03, 0.55);
  const pupil = new THREE.Mesh(pupilGeo, eyeDarkMat);
  pupil.position.set(0, 0, 0.00225);
  eyeGroup.add(pupil);

  // Layer 4: Two crisp white catchlight highlight dots placed up and to one side
  const dotBigGeo = new THREE.SphereGeometry(0.00105, 12, 10);
  dotBigGeo.scale(1.0, 1.0, 0.45);
  const dotBig = new THREE.Mesh(dotBigGeo, sparkleMat);
  dotBig.position.set(-side * 0.00125, 0.00155, 0.00368);
  eyeGroup.add(dotBig);

  const dotSmallGeo = new THREE.SphereGeometry(0.00048, 10, 8);
  dotSmallGeo.scale(1.0, 1.0, 0.45);
  const dotSmall = new THREE.Mesh(dotSmallGeo, sparkleMat);
  dotSmall.position.set(side * 0.00115, -0.00125, 0.00362);
  eyeGroup.add(dotSmall);

  // Delicate feathery upper-eyelid rim tube so eye nests plushly into cheek feathers
  const lidPts = [];
  for (let i = 0; i <= 8; i++) {
    const a = mix(0.22, Math.PI - 0.22, i / 8);
    lidPts.push(new THREE.Vector3(Math.cos(a) * 0.0051, Math.sin(a) * 0.0052, 0.0008 + Math.sin(a) * 0.0007));
  }
  const lidGeo = buildTaperedTube(
    THREE,
    lidPts,
    (u) => 0.00072 * Math.sin(u * Math.PI) + 0.00025,
    12,
    8,
    true,
    true
  );
  const lidMesh = new THREE.Mesh(lidGeo, browMat);
  lidMesh.userData.slot = 'fur';
  eyeGroup.add(lidMesh);

  return eyeGroup;
}

function buildWingGroup(THREE, side, covertMat, primaryMat, shoulderMat) {
  const wingGroup = new THREE.Group();
  wingGroup.name = side > 0 ? 'wingL' : 'wingR';
  wingGroup.position.set(side * 0.0175, 0.0055, 0.0015);

  // Layer 0: Sculpted feathered shoulder/lesser-covert pad bridging body to feathers seamlessly
  const shoulderGeo = buildWingShoulderGeometry(THREE, side);
  const shoulderMesh = new THREE.Mesh(shoulderGeo, shoulderMat);
  shoulderMesh.position.set(side * 0.0035, 0.0025, -0.0025);
  shoulderMesh.rotation.set(-0.22, side * 0.08, -side * 0.12);
  shoulderMesh.userData.slot = 'fur';
  shoulderMesh.castShadow = true;
  shoulderMesh.receiveShadow = true;
  wingGroup.add(shoulderMesh);

  // Layer 1: Upper & Median Coverts (5 overlapping curved bezier feathers)
  const covertGeo = buildFeatherGeometry(THREE, {
    length: 0.0225,
    width: 0.0112,
    thickness: 0.00075,
    bevel: 0.00032,
    asymmetry: side * 0.12,
    arch: 0.0032,
    cup: 0.0009,
    tipRound: 0.58
  });

  for (let i = 0; i < 5; i++) {
    const f = i / 4;
    const feather = new THREE.Mesh(covertGeo, covertMat);
    feather.position.set(
      side * (0.0074 - f * 0.0018),
      0.0075 - f * 0.0032,
      0.0068 - f * 0.0046
    );
    const dir = new THREE.Vector3(-side * (0.12 + f * 0.10), -0.48 - f * 0.10, -0.86 + f * 0.04);
    const out = new THREE.Vector3(side * 0.92, 0.24 - f * 0.12, 0.22 - f * 0.14);
    feather.quaternion.copy(orientBasis(THREE, dir, out));
    feather.scale.set(0.92 + f * 0.10, 0.86 + f * 0.16, 1.0);
    feather.userData.slot = 'furAccent';
    feather.castShadow = true;
    feather.receiveShadow = true;
    wingGroup.add(feather);
  }

  // Layer 2: Secondary Flight Feathers (5 layered scalloped curved bezier feathers)
  const secGeo = buildFeatherGeometry(THREE, {
    length: 0.0325,
    width: 0.0114,
    thickness: 0.00075,
    bevel: 0.00032,
    asymmetry: side * 0.18,
    arch: 0.0048,
    cup: 0.0010,
    tipRound: 0.44
  });

  for (let i = 0; i < 5; i++) {
    const f = i / 4;
    const feather = new THREE.Mesh(secGeo, covertMat);
    feather.position.set(
      side * (0.0066 - f * 0.0022),
      0.0012 - f * 0.0034,
      0.0018 - f * 0.0048
    );
    const dir = new THREE.Vector3(-side * (0.18 + f * 0.08), -0.52 - f * 0.07, -0.83);
    const out = new THREE.Vector3(side * 0.90, 0.14 - f * 0.10, 0.14 - f * 0.14);
    feather.quaternion.copy(orientBasis(THREE, dir, out));
    feather.scale.set(0.95, 0.88 + f * 0.16, 1.0);
    feather.userData.slot = 'furAccent';
    feather.castShadow = true;
    feather.receiveShadow = true;
    wingGroup.add(feather);
  }

  // Layer 3: Sleek Primary Flight Feathers (5 longer curved tapered feathers converging over rump)
  const priGeo = buildFeatherGeometry(THREE, {
    length: 0.0445,
    width: 0.0102,
    thickness: 0.00072,
    bevel: 0.00028,
    asymmetry: side * 0.24,
    arch: 0.0064,
    cup: 0.0010,
    twist: -side * 0.08,
    tipRound: 0.26
  });

  for (let i = 0; i < 5; i++) {
    const f = i / 4;
    const feather = new THREE.Mesh(priGeo, primaryMat);
    feather.position.set(
      side * (0.0056 - f * 0.0024),
      -0.0042 - f * 0.0030,
      -0.0035 - f * 0.0042
    );
    const dir = new THREE.Vector3(-side * (0.28 + f * 0.05), -0.55 - f * 0.05, -0.78 - f * 0.03);
    const out = new THREE.Vector3(side * 0.84, 0.24 - f * 0.12, -0.10 - f * 0.10);
    feather.quaternion.copy(orientBasis(THREE, dir, out));
    feather.scale.set(1.0 - f * 0.10, 0.92 + f * 0.14, 1.0);
    feather.userData.slot = 'furAccent';
    feather.castShadow = true;
    feather.receiveShadow = true;
    wingGroup.add(feather);
  }

  return wingGroup;
}

function buildTailGroup(THREE, tailMat, covertMat) {
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tail';
  tailGroup.position.set(0, -0.0175, -0.0225);

  // Default streaming parakeet tail angle (clearing stand base cleanly)
  const baseRot = new THREE.Euler(-2.26, 0, 0);
  tailGroup.rotation.copy(baseRot);
  tailGroup.userData.baseRot = { x: baseRot.x, y: baseRot.y, z: baseRot.z };

  // Sculpted upper tail covert hood for seamless rump-to-tail transition
  const hoodGeo = new THREE.SphereGeometry(1, 22, 16);
  const hPos = hoodGeo.attributes.position;
  for (let i = 0; i < hPos.count; i++) {
    const nx = hPos.getX(i);
    const ny = hPos.getY(i);
    const nz = hPos.getZ(i);
    const taper = mix(1.0, 0.42, smoothstep(-0.3, 1.0, ny));
    hPos.setXYZ(i, nx * 0.0115 * taper, ny * 0.0145 + 0.006, nz * 0.0068 * taper);
  }
  hoodGeo.computeVertexNormals();
  const hoodMesh = new THREE.Mesh(hoodGeo, covertMat);
  hoodMesh.userData.slot = 'fur';
  hoodMesh.castShadow = true;
  tailGroup.add(hoodMesh);

  // Layered curved bezier tail feathers (rectrices): central pair longest, flanking fanned cleanly
  const featherSpecs = [
    { len: 0.064, w: 0.0094, xOff: -0.0012, zOff: 0.0012, fanZ: 0.035, arch: 0.0085, asym: -0.08 },
    { len: 0.062, w: 0.0092, xOff: 0.0014, zOff: 0.0005, fanZ: -0.04, arch: 0.0082, asym: 0.08 },
    { len: 0.052, w: 0.0088, xOff: -0.0036, zOff: -0.0003, fanZ: 0.13, arch: 0.0070, asym: -0.14 },
    { len: 0.052, w: 0.0088, xOff: 0.0036, zOff: -0.0006, fanZ: -0.13, arch: 0.0070, asym: 0.14 },
    { len: 0.039, w: 0.0082, xOff: -0.0055, zOff: -0.0013, fanZ: 0.22, arch: 0.0054, asym: -0.18 },
    { len: 0.039, w: 0.0082, xOff: 0.0055, zOff: -0.0015, fanZ: -0.22, arch: 0.0054, asym: 0.18 },
    { len: 0.031, w: 0.0096, xOff: 0.0, zOff: -0.0024, fanZ: 0.0, arch: 0.0040, asym: 0.0 }
  ];

  for (const sp of featherSpecs) {
    const fGeo = buildFeatherGeometry(THREE, {
      length: sp.len,
      width: sp.w,
      thickness: 0.00072,
      bevel: 0.00028,
      asymmetry: sp.asym,
      arch: sp.arch,
      cup: 0.0009,
      tipRound: 0.25
    });
    const mesh = new THREE.Mesh(fGeo, tailMat);
    mesh.position.set(sp.xOff, 0.001, sp.zOff);
    mesh.rotation.set(0.02, 0, sp.fanZ);
    mesh.userData.slot = 'furAccent';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    tailGroup.add(mesh);
  }

  return tailGroup;
}

export function build(THREE, opts = {}, kit) {
  const variant = META.variants.includes(opts.variant) ? opts.variant : 'classic';
  const furCol = new THREE.Color(opts.fur || '#68c3b3');
  const furAccentCol = opts.furAccent
    ? new THREE.Color(opts.furAccent)
    : shiftColor(THREE, furCol, 0.035, 0.06, -0.22);
  const eyeCol = new THREE.Color(opts.eye || '#c98a3b');

  const palette = {
    fur: furCol,
    furBright: shiftColor(THREE, furCol, -0.01, -0.05, 0.14),
    furDeep: shiftColor(THREE, furCol, 0.02, 0.05, -0.14),
    belly: shiftColor(THREE, furCol, -0.02, -0.14, 0.19),
    wingCovert: furAccentCol.clone(),
    wingPrimary: shiftColor(THREE, furAccentCol, 0.02, 0.04, -0.10),
    tailTip: shiftColor(THREE, furAccentCol, 0.045, 0.12, -0.14),
    darkBar: shiftColor(THREE, furAccentCol, 0.01, -0.08, -0.34),
    cream: new THREE.Color('#f7edd2'),
    cheekPatch: shiftColor(THREE, furAccentCol, 0.11, 0.22, 0.08)
  };

  const root = new THREE.Group();
  root.name = 'cozy-parakeet-root';

  // Build handcrafted turned wooden perch stand + tiny dorm seed dish
  const stand = buildStand(THREE, kit, palette);
  root.add(stand);

  // Materials
  const bodyMaps = makeBodyTextures(THREE, kit, palette, variant);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    map: bodyMaps.map,
    bumpMap: bodyMaps.bumpMap,
    bumpScale: 0.0007,
    roughness: 0.90,
    metalness: 0.0,
    sheen: 0.85,
    sheenRoughness: 0.68,
    sheenColor: palette.furBright
  });

  const headMap = makeHeadTextures(THREE, kit, palette, variant);
  const headMat = new THREE.MeshPhysicalMaterial({
    map: headMap,
    bumpMap: bodyMaps.bumpMap,
    bumpScale: 0.00055,
    roughness: 0.89,
    metalness: 0.0,
    sheen: 0.88,
    sheenRoughness: 0.64,
    sheenColor: palette.cream.clone().lerp(palette.furBright, 0.45)
  });

  const covertMaps = makeFeatherTextures(THREE, kit, palette, variant, false);
  const covertMat = new THREE.MeshPhysicalMaterial({
    map: covertMaps.map,
    bumpMap: covertMaps.bumpMap,
    bumpScale: 0.0008,
    roughness: 0.86,
    metalness: 0.0,
    sheen: 0.78,
    sheenRoughness: 0.62,
    sheenColor: palette.cream.clone().lerp(palette.furBright, 0.5)
  });

  const primaryMaps = makeFeatherTextures(THREE, kit, palette, variant, true);
  const primaryMat = new THREE.MeshPhysicalMaterial({
    map: primaryMaps.map,
    bumpMap: primaryMaps.bumpMap,
    bumpScale: 0.0008,
    roughness: 0.85,
    metalness: 0.0,
    sheen: 0.82,
    sheenRoughness: 0.56,
    sheenColor: palette.furBright
  });

  const tailMap = makeTailTexture(THREE, kit, palette, variant);
  const tailMat = new THREE.MeshPhysicalMaterial({
    map: tailMap,
    bumpMap: primaryMaps.bumpMap,
    bumpScale: 0.00075,
    roughness: 0.85,
    metalness: 0.0,
    sheen: 0.85,
    sheenRoughness: 0.55,
    sheenColor: palette.furBright
  });

  const beakMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ead7b2'),
    roughness: 0.22,
    metalness: 0.0,
    clearcoat: 0.85,
    clearcoatRoughness: 0.18
  });

  const lowerBeakMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#cbb690'),
    roughness: 0.28,
    metalness: 0.0,
    clearcoat: 0.72,
    clearcoatRoughness: 0.22
  });

  const cereMat = new THREE.MeshPhysicalMaterial({
    color: variant === 'pied' ? new THREE.Color('#e6b8b0') : new THREE.Color('#b9c6db'),
    roughness: 0.42,
    metalness: 0.0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.35
  });

  const mouthLineMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#3b2c24'),
    roughness: 0.55,
    metalness: 0.0
  });

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#d6a894'),
    bumpMap: bodyMaps.bumpMap,
    bumpScale: 0.0004,
    roughness: 0.58,
    metalness: 0.0,
    clearcoat: 0.14,
    clearcoatRoughness: 0.5
  });

  const clawMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#4a3c36'),
    roughness: 0.18,
    metalness: 0.0,
    clearcoat: 0.9,
    clearcoatRoughness: 0.14
  });

  const eyeDarkMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#0c0b10'),
    roughness: 0.05,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04
  });

  const irisMat = new THREE.MeshPhysicalMaterial({
    map: makeIrisTexture(THREE, kit, eyeCol),
    roughness: 0.16,
    metalness: 0.0,
    clearcoat: 0.92,
    clearcoatRoughness: 0.08
  });

  const sparkleMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffffff'),
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.65,
    roughness: 0.05,
    clearcoat: 1.0
  });

  const browMat = new THREE.MeshPhysicalMaterial({
    color: palette.cream.clone().lerp(palette.fur, 0.32),
    roughness: 0.90,
    sheen: 0.85,
    sheenColor: palette.cream
  });

  // Legs anchored securely onto the perch bar (y = 0.052, z = 0.002, r = 0.0052)
  const perchY = 0.052;
  const perchZ = 0.002;
  const perchR = 0.0052;
  const legL = buildFootAndLeg(THREE, 1, skinMat, clawMat, bodyMat, perchY, perchZ, perchR);
  const legR = buildFootAndLeg(THREE, -1, skinMat, clawMat, bodyMat, perchY, perchZ, perchR);
  root.add(legL);
  root.add(legR);

  // Main sculpted body group
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'body';
  bodyGroup.position.set(0, 0.0865, -0.0005);
  bodyGroup.userData.baseY = bodyGroup.position.y;
  root.add(bodyGroup);

  const bodyGeo = buildSculptedBodyGeometry(THREE, kit);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.userData.slot = 'fur';
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyGroup.add(bodyMesh);

  // Layered wings with subtle cozy pose asymmetry
  const wingL = buildWingGroup(THREE, 1, covertMat, primaryMat, bodyMat);
  const wingR = buildWingGroup(THREE, -1, covertMat, primaryMat, bodyMat);
  wingL.rotation.set(0.02, 0.02, 0.02);
  wingR.rotation.set(-0.02, -0.03, -0.04);
  wingL.userData.baseRot = { x: wingL.rotation.x, y: wingL.rotation.y, z: wingL.rotation.z };
  wingR.userData.baseRot = { x: wingR.rotation.x, y: wingR.rotation.y, z: wingR.rotation.z };
  bodyGroup.add(wingL);
  bodyGroup.add(wingR);

  // Layered streaming tail feathers
  const tailGroup = buildTailGroup(THREE, tailMat, bodyMat);
  bodyGroup.add(tailGroup);

  // Sculpted head group (deeply overlapping neck collar, charmingly cocked!)
  const headGroup = new THREE.Group();
  headGroup.name = 'head';
  headGroup.position.set(0, 0.0265, 0.0045);
  headGroup.rotation.set(0.06, 0.21, -0.24);
  headGroup.userData.baseRot = {
    x: headGroup.rotation.x,
    y: headGroup.rotation.y,
    z: headGroup.rotation.z
  };
  bodyGroup.add(headGroup);

  const eyeDirL = new THREE.Vector3(0.75, 0.14, 0.646).normalize();
  const eyeDirR = new THREE.Vector3(-0.75, 0.14, 0.646).normalize();

  const headCenter = new THREE.Vector3(0, 0.0175, 0.0010);
  const headGeo = buildSculptedHeadGeometry(THREE, kit, eyeDirL, eyeDirR);
  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.position.copy(headCenter);
  headMesh.userData.slot = 'fur';
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headGroup.add(headMesh);

  // Two tiny soft sculpted crown fluff wisps on the top of the head
  const wispGeo = buildFeatherGeometry(THREE, {
    length: 0.0072,
    width: 0.0036,
    thickness: 0.0005,
    bevel: 0.00022,
    asymmetry: 0.1,
    arch: 0.0024,
    cup: 0.0004,
    tipRound: 0.55
  });
  for (let i = 0; i < 2; i++) {
    const wisp = new THREE.Mesh(wispGeo, browMat);
    wisp.position.set(i === 0 ? -0.0012 : 0.0018, headCenter.y + 0.0215, headCenter.z + 0.0012 - i * 0.0032);
    wisp.rotation.set(-1.12 - i * 0.15, (i === 0 ? 0.18 : -0.22), (i === 0 ? 0.12 : -0.14));
    wisp.userData.slot = 'fur';
    headGroup.add(wisp);
  }

  // Expressive three-layer eyes nestled cleanly into the sculpted sockets
  const eyeL = buildEyeGroup(THREE, 'eyeL', 1, irisMat, eyeDarkMat, sparkleMat, browMat);
  eyeL.position.copy(headCenter).addScaledVector(eyeDirL, 0.0196);
  eyeL.lookAt(eyeL.position.clone().add(eyeDirL));
  headGroup.add(eyeL);

  const eyeR = buildEyeGroup(THREE, 'eyeR', -1, irisMat, eyeDarkMat, sparkleMat, browMat);
  eyeR.position.copy(headCenter).addScaledVector(eyeDirR, 0.0196);
  eyeR.lookAt(eyeR.position.clone().add(eyeDirR));
  headGroup.add(eyeR);

  // Sculpted cere, hooked upper beak, cupped lower beak & curved mouth seam
  const cereMesh = new THREE.Mesh(buildCereGeometry(THREE), cereMat);
  cereMesh.position.set(0, headCenter.y - 0.0012, headCenter.z + 0.0226);
  cereMesh.rotation.x = 0.16;
  cereMesh.userData.slot = 'skin';
  cereMesh.castShadow = true;
  headGroup.add(cereMesh);

  const upperBeak = new THREE.Mesh(buildUpperBeakGeometry(THREE), beakMat);
  upperBeak.position.set(0, headCenter.y - 0.0042, headCenter.z + 0.0230);
  upperBeak.userData.slot = 'secondary';
  upperBeak.castShadow = true;
  headGroup.add(upperBeak);

  const lowerBeak = new THREE.Mesh(buildLowerBeakGeometry(THREE), lowerBeakMat);
  lowerBeak.position.set(0, headCenter.y - 0.0076, headCenter.z + 0.0212);
  lowerBeak.rotation.x = 0.12;
  lowerBeak.userData.slot = 'secondary';
  headGroup.add(lowerBeak);

  // Curved mouth line tube along beak commissure
  const mouthPts = [
    new THREE.Vector3(-0.0038, headCenter.y - 0.0063, headCenter.z + 0.0218),
    new THREE.Vector3(-0.0022, headCenter.y - 0.0071, headCenter.z + 0.0246),
    new THREE.Vector3(0.0, headCenter.y - 0.0068, headCenter.z + 0.0260),
    new THREE.Vector3(0.0022, headCenter.y - 0.0071, headCenter.z + 0.0246),
    new THREE.Vector3(0.0038, headCenter.y - 0.0063, headCenter.z + 0.0218)
  ];
  const mouthGeo = buildTaperedTube(
    THREE,
    mouthPts,
    (u) => 0.00042 * Math.sin(u * Math.PI) + 0.00018,
    14,
    7,
    true,
    true
  );
  const mouthLine = new THREE.Mesh(mouthGeo, mouthLineMat);
  headGroup.add(mouthLine);

  return root;
}

export function idle(group, t) {
  if (!group) return;

  const body = group.getObjectByName('body');
  const head = group.getObjectByName('head');
  const tail = group.getObjectByName('tail');
  const wingL = group.getObjectByName('wingL');
  const wingR = group.getObjectByName('wingR');
  const eyeL = group.getObjectByName('eyeL');
  const eyeR = group.getObjectByName('eyeR');

  // Cozy songbird breathing pulse
  const breath = Math.sin(t * 2.5);
  if (body) {
    const baseY = body.userData.baseY !== undefined ? body.userData.baseY : body.position.y;
    body.position.y = baseY + breath * 0.00065;
    body.scale.set(
      1 + breath * 0.014,
      1 + breath * 0.018,
      1 + breath * 0.016
    );
  }

  // Curious cocked head sway & gentle attentive bob
  if (head && head.userData.baseRot) {
    const b = head.userData.baseRot;
    head.rotation.z = b.z + Math.sin(t * 1.15) * 0.075 + Math.sin(t * 0.48) * 0.045;
    head.rotation.y = b.y + Math.sin(t * 0.82 + 0.7) * 0.11;
    head.rotation.x = b.x + Math.sin(t * 1.9 - 0.3) * 0.035;
  }

  // Gentle balancing tail bob
  if (tail && tail.userData.baseRot) {
    const b = tail.userData.baseRot;
    tail.rotation.x = b.x + Math.sin(t * 2.5 - 0.6) * 0.038 + Math.sin(t * 1.05) * 0.025;
    tail.rotation.y = b.y + Math.sin(t * 0.85) * 0.022;
  }

  // Subtle wing breath settle & occasional tiny cozy feather ruffle
  const ruffleCycle = t % 6.2;
  const ruffle = ruffleCycle < 0.28 ? Math.sin((ruffleCycle / 0.28) * Math.PI * 2) * 0.035 : 0;
  if (wingL && wingL.userData.baseRot) {
    const b = wingL.userData.baseRot;
    wingL.rotation.z = b.z + breath * 0.014 + ruffle;
    wingL.rotation.x = b.x - breath * 0.008;
  }
  if (wingR && wingR.userData.baseRot) {
    const b = wingR.userData.baseRot;
    wingR.rotation.z = b.z - breath * 0.014 - ruffle;
    wingR.rotation.x = b.x - breath * 0.008;
  }

  // Natural periodic blink (with occasional cute double-blink)
  const blinkPeriod = 3.7;
  const cycle = t % blinkPeriod;
  let blink = 0;
  if (cycle < 0.14) {
    blink = Math.sin((cycle / 0.14) * Math.PI);
  } else if (Math.floor(t / blinkPeriod) % 3 === 1 && cycle > 0.22 && cycle < 0.35) {
    blink = Math.sin(((cycle - 0.22) / 0.13) * Math.PI);
  }
  const eyeScaleY = 1 - blink * 0.92;
  if (eyeL) eyeL.scale.y = eyeScaleY;
  if (eyeR) eyeR.scale.y = eyeScaleY;
}
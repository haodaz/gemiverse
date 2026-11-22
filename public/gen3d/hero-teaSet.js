export const META = {
  id: 'cozy-tea-tray',
  name: 'Cozy Tea Tray Set',
  kind: 'prop',
  footprint: [0.40, 0.29],
  variants: [
    { name: 'Matcha Cream', opts: { ceramic: '#f7e7c6', accent: '#a8e0c0', wood: '#c89462' } },
    { name: 'Sakura Milk', opts: { ceramic: '#faf0e6', accent: '#e8b4bc', wood: '#b88256' } },
    { name: 'Indigo Kiln', opts: { ceramic: '#ece4d5', accent: '#6d8fb8', wood: '#8a5d3b' } },
    { name: 'Hojicha Warm', opts: { ceramic: '#f2dec2', accent: '#c98e5b', wood: '#7a5234' } },
  ],
  note: 'Hand-thrown stoneware teapot, four yunomi cups with steeped tea, celadon tea caddy, bamboo chashaku scoop on a ceramic pebble rest, and woven linen mat on a joined wooden tray.',
};

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------
function parseHex(hex) {
  const s = (hex || '#ffffff').replace('#', '');
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s.padEnd(6, '0');
  const n = parseInt(full.slice(0, 6), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

function mixHex(c1, c2, t) {
  const a = parseHex(c1);
  const b = parseHex(c2);
  return toHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
}

function shadeHex(hex, factor) {
  const c = parseHex(hex);
  if (factor >= 0) {
    return toHex(c.r + (255 - c.r) * factor, c.g + (255 - c.g) * factor, c.b + (255 - c.b) * factor);
  }
  const f = 1 + factor;
  return toHex(c.r * f, c.g * f, c.b * f);
}

function rgba(hex, alpha) {
  const c = parseHex(hex);
  return `rgba(${c.r},${c.g},${c.b},${alpha})`;
}

// ---------------------------------------------------------------------------
// Procedural geometry builders
// ---------------------------------------------------------------------------

/**
 * Ring-by-ring tapered tube along a CatmullRomCurve3 with custom radius(t, angle).
 */
function createTaperedTubeGeometry(
  THREE,
  curve,
  tubularSegments,
  radialSegments,
  radiusFn,
  options = {}
) {
  const { capStart = false, capEnd = false, invert = false } = options;
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions = [];
  const uvs = [];
  const indices = [];

  const stride = radialSegments + 1;
  const tmp = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    const center = curve.getPointAt(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];

    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const angle = u * Math.PI * 2;
      const r = Math.max(0.00015, radiusFn(t, angle));
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      tmp.copy(center)
        .addScaledVector(N, cos * r)
        .addScaledVector(B, sin * r);

      positions.push(tmp.x, tmp.y, tmp.z);
      uvs.push(u, t);
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      if (invert) {
        indices.push(a, b, d, d, b, c);
      } else {
        indices.push(a, d, b, d, c, b);
      }
    }
  }

  if (capStart) {
    const cIdx = positions.length / 3;
    const p0 = curve.getPointAt(0);
    positions.push(p0.x, p0.y, p0.z);
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegments; j++) {
      if (invert) {
        indices.push(cIdx, j + 1, j);
      } else {
        indices.push(cIdx, j, j + 1);
      }
    }
  }

  if (capEnd) {
    const cIdx = positions.length / 3;
    const p1 = curve.getPointAt(1);
    const base = tubularSegments * stride;
    positions.push(p1.x, p1.y, p1.z);
    uvs.push(0.5, 1);
    for (let j = 0; j < radialSegments; j++) {
      if (invert) {
        indices.push(cIdx, base + j, base + j + 1);
      } else {
        indices.push(cIdx, base + j + 1, base + j);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Rotational lathe with normalized height UVs and optional periodic hand-thrown wobble.
 */
function createOrganicLathe(THREE, profilePairs, radialSegments, wobbleFn) {
  const pts = profilePairs.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y));
  const geo = new THREE.LatheGeometry(pts, radialSegments);

  let yMin = Infinity;
  let yMax = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].y < yMin) yMin = pts[i].y;
    if (pts[i].y > yMax) yMax = pts[i].y;
  }
  const ySpan = Math.max(0.0001, yMax - yMin);

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const r = Math.hypot(x, z);
    const yn = Math.max(0, Math.min(1, (y - yMin) / ySpan));

    if (wobbleFn && r > 0.001) {
      const ang = Math.atan2(z, x);
      const disp = wobbleFn(r, y, yn, ang);
      const scale = (r + disp.dr) / r;
      x *= scale;
      z *= scale;
      y += disp.dy;
      pos.setXYZ(i, x, y, z);
    }

    uv.setY(i, Math.max(0, Math.min(1, (y - yMin) / ySpan)));
  }

  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sculpt a dense sphere into a continuous organic form.
 */
function createSculptedForm(THREE, widthSegs, heightSegs, sculptFn) {
  const geo = new THREE.SphereGeometry(1, widthSegs, heightSegs);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    sculptFn(v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Rounded rectangle Shape (or Path) drawn with cubic bezierCurveTo corners.
 */
function makeRoundedRectShape(THREE, width, depth, radius, asPath = false) {
  const hw = width * 0.5;
  const hd = depth * 0.5;
  const r = Math.min(radius, hw * 0.9, hd * 0.9);
  const k = r * 0.55228475; // cubic bezier circle approximation

  const s = asPath ? new THREE.Path() : new THREE.Shape();
  s.moveTo(-hw + r, -hd);
  s.lineTo(hw - r, -hd);
  s.bezierCurveTo(hw - r + k, -hd, hw, -hd + r - k, hw, -hd + r);
  s.lineTo(hw, hd - r);
  s.bezierCurveTo(hw, hd - r + k, hw - r + k, hd, hw - r, hd);
  s.lineTo(-hw + r, hd);
  s.bezierCurveTo(-hw + r - k, hd, -hw, hd - r + k, -hw, hd - r);
  s.lineTo(-hw, -hd + r);
  s.bezierCurveTo(-hw, -hd + r - k, -hw + r - k, -hd, -hw + r, -hd);
  return s;
}

// ---------------------------------------------------------------------------
// Procedural CanvasTexture generators
// ---------------------------------------------------------------------------

function makeWoodTextures(THREE, kit, woodHex) {
  const darkWood = shadeHex(woodHex, -0.32);
  const deepGrain = shadeHex(woodHex, -0.48);
  const lightWood = shadeHex(woodHex, 0.16);

  const colorTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = woodHex;
    ctx.fillRect(0, 0, w, h);

    // Subtle 3-plank joinery warmth variation across tray depth
    const planks = [
      { y0: 0, y1: h * 0.34, tint: rgba(lightWood, 0.11) },
      { y0: h * 0.34, y1: h * 0.67, tint: rgba(darkWood, 0.06) },
      { y0: h * 0.67, y1: h, tint: rgba(lightWood, 0.08) },
    ];
    for (const p of planks) {
      ctx.fillStyle = p.tint;
      ctx.fillRect(0, p.y0, w, p.y1 - p.y0);
    }

    // Flowing organic wood grain rings
    for (let y = 0; y < h; y += 2) {
      const plankShift = y < h * 0.34 ? 0 : y < h * 0.67 ? 7.3 : 14.9;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const n1 = kit.noise(x * 0.008 + plankShift, y * 0.028);
        const n2 = kit.noise(x * 0.025 + 4.1, y * 0.09);
        const wave = Math.sin((y * 0.14 + n1 * 9.5 + n2 * 2.1));
        const yy = y + wave * 1.4;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      const band = Math.sin(y * 0.19 + kit.noise(2.4, y * 0.03) * 8.0);
      ctx.strokeStyle = band > 0.2 ? rgba(darkWood, 0.24) : rgba(lightWood, 0.14);
      ctx.lineWidth = band > 0.65 ? 2.2 : 1.2;
      ctx.stroke();
    }

    // Fine wood vessel pores
    for (let i = 0; i < 650; i++) {
      const px = kit.noise(i * 1.37, 2.1) * w;
      const py = kit.noise(3.9, i * 1.73) * h;
      const len = 8 + kit.noise(i * 0.7, 9.1) * 26;
      ctx.strokeStyle = rgba(deepGrain, 0.16);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + len, py + (kit.noise(px * 0.04, py * 0.04) - 0.5) * 2.5);
      ctx.stroke();
    }

    // Crisp subtle joinery seams between planks
    ctx.strokeStyle = rgba(deepGrain, 0.34);
    ctx.lineWidth = 1.4;
    for (const sy of [h * 0.34, h * 0.67]) {
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
      ctx.stroke();
    }

    // Soft cozy vignette darkening along outer rim edges
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.24, w * 0.5, h * 0.5, w * 0.66);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, rgba(deepGrain, 0.24));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.RepeatWrapping;

  const bumpTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      const v = Math.floor(115 + Math.sin(y * 0.22 + kit.noise(1.1, y * 0.04) * 7.5) * 20);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, w, 2);
    }
    for (let i = 0; i < 650; i++) {
      const px = kit.noise(i * 1.37, 2.1) * w;
      const py = kit.noise(3.9, i * 1.73) * h;
      const len = 8 + kit.noise(i * 0.7, 9.1) * 26;
      ctx.strokeStyle = 'rgba(70,70,70,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + len, py);
      ctx.stroke();
    }
  });
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;

  return { colorTex, bumpTex };
}

function makeCeramicBumpTexture(THREE, kit) {
  const bumpTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    // Gentle wheel-throwing rings
    for (let y = 0; y < h; y++) {
      const rib = Math.sin(y * 0.34) * 9 + (kit.noise(2.2, y * 0.09) - 0.5) * 10;
      const v = Math.max(0, Math.min(255, Math.round(128 + rib)));
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, w, 1);
    }
    // Fine stoneware clay speckles
    for (let i = 0; i < 420; i++) {
      const x = kit.noise(i * 1.91, 4.3) * w;
      const y = kit.noise(8.7, i * 2.17) * h;
      const r = 0.7 + kit.noise(i, i * 0.3) * 1.3;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(98,98,98,0.45)' : 'rgba(155,155,155,0.35)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;
  return bumpTex;
}

function makeCeramicTexture(THREE, kit, ceramicHex, accentHex, woodHex, style) {
  const clayFoot = mixHex(ceramicHex, mixHex(woodHex, '#7e5a3b', 0.55), 0.56);
  const speckleDark = shadeHex(clayFoot, -0.35);
  const accentPool = shadeHex(accentHex, -0.22);
  const accentLight = shadeHex(accentHex, 0.25);
  const creamLight = shadeHex(ceramicHex, 0.18);

  const tex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    if (style === 'caddy') {
      // Luminous celadon/accent glazed caddy body
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0.0, accentLight);
      grad.addColorStop(0.18, accentHex);
      grad.addColorStop(0.75, mixHex(accentHex, accentPool, 0.32));
      grad.addColorStop(0.91, accentPool);
      grad.addColorStop(0.93, clayFoot);
      grad.addColorStop(1.0, shadeHex(clayFoot, -0.14));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Subtle vertical glaze streaks
      for (let i = 0; i < 70; i++) {
        const x = (i / 70) * w;
        const n = kit.noise(i * 0.45, 3.1);
        ctx.fillStyle = n > 0.5 ? rgba(accentLight, 0.09) : rgba(accentPool, 0.08);
        ctx.fillRect(x, 0, w / 50, h * 0.9);
      }

      // Delicate kiln speckles
      for (let i = 0; i < 450; i++) {
        const sx = kit.noise(i * 2.13, 1.7) * w;
        const sy = kit.noise(5.3, i * 1.67) * h * 0.92;
        ctx.fillStyle = rgba(speckleDark, 0.22);
        ctx.beginPath();
        ctx.arc(sx, sy, 0.8 + kit.noise(i, 6.2) * 1.1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Handmade washi paper tea label centered at u = 0.5
      const lw = w * 0.22;
      const lh = h * 0.42;
      const lx = w * 0.5 - lw * 0.5;
      const ly = h * 0.30;
      ctx.fillStyle = rgba(creamLight, 0.95);
      ctx.fillRect(lx, ly, lw, lh);
      ctx.strokeStyle = rgba(accentPool, 0.65);
      ctx.lineWidth = 2.5;
      ctx.strokeRect(lx + 5, ly + 5, lw - 10, lh - 10);

      // Minimalist painted tea sprig on the label
      const cx = lx + lw * 0.5;
      const cy = ly + lh * 0.52;
      ctx.strokeStyle = shadeHex(accentHex, -0.45);
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 44);
      ctx.quadraticCurveTo(cx - 6, cy, cx + 4, cy - 42);
      ctx.stroke();

      const drawLeaf = (x, y, ang, rx, ry) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.fillStyle = rgba(shadeHex(accentHex, -0.32), 0.85);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      drawLeaf(cx - 12, cy + 8, -0.65, 13, 6);
      drawLeaf(cx + 13, cy - 10, 0.6, 13, 6);
      drawLeaf(cx - 10, cy - 26, -0.5, 10, 5);
      drawLeaf(cx + 5, cy - 46, 0.15, 7, 11);

      // Tiny vermilion hanko stamp square in corner of label
      ctx.fillStyle = '#c45b47';
      ctx.fillRect(lx + lw - 24, ly + lh - 26, 12, 12);
      return;
    }

    // Warm speckled stoneware ceramic base (teapot & cups)
    const baseGrad = ctx.createLinearGradient(0, 0, 0, h);
    baseGrad.addColorStop(0.0, creamLight);
    baseGrad.addColorStop(0.55, ceramicHex);
    baseGrad.addColorStop(0.86, mixHex(ceramicHex, clayFoot, 0.22));
    baseGrad.addColorStop(0.90, clayFoot);
    baseGrad.addColorStop(1.0, shadeHex(clayFoot, -0.15));
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle organic horizontal throwing bands
    for (let y = 0; y < h * 0.9; y += 3) {
      const wave = Math.sin(y * 0.16) * 0.5 + 0.5;
      ctx.fillStyle = rgba(clayFoot, 0.035 * wave);
      ctx.fillRect(0, y, w, 2);
    }

    // Dipped celadon/accent glaze band along the upper rim (periodic across u=0..1!)
    const dipBase = style === 'teapot' ? h * 0.22 : h * 0.24;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    for (let x = w; x >= 0; x -= 4) {
      const ang = (x / w) * Math.PI * 2;
      const drip =
        Math.sin(ang * 3 + 0.4) * 9 +
        Math.sin(ang * 5 - 1.1) * 5 +
        Math.pow(Math.max(0, Math.sin(ang * 2 + 1.2)), 4) * (style === 'cup' ? 22 : 12);
      ctx.lineTo(x, dipBase + drip);
    }
    ctx.closePath();

    const dipGrad = ctx.createLinearGradient(0, 0, 0, dipBase + 26);
    dipGrad.addColorStop(0.0, accentLight);
    dipGrad.addColorStop(0.55, accentHex);
    dipGrad.addColorStop(1.0, accentPool);
    ctx.fillStyle = dipGrad;
    ctx.fill();

    // Soft glaze-pool rim edge
    ctx.strokeStyle = rgba(accentPool, 0.55);
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const ang = (x / w) * Math.PI * 2;
      const drip =
        Math.sin(ang * 3 + 0.4) * 9 +
        Math.sin(ang * 5 - 1.1) * 5 +
        Math.pow(Math.max(0, Math.sin(ang * 2 + 1.2)), 4) * (style === 'cup' ? 22 : 12);
      const yy = dipBase + drip;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();

    // Hand-painted botanical leaf sprigs around the teapot belly or fine stripe on cups
    if (style === 'teapot') {
      const bandY = h * 0.44;
      ctx.strokeStyle = rgba(accentPool, 0.55);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 6) {
        const ang = (x / w) * Math.PI * 2;
        const yy = bandY + Math.sin(ang * 4) * 9;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();

      const count = 8;
      for (let i = 0; i < count; i++) {
        const lx = ((i + 0.5) / count) * w;
        const ang = (lx / w) * Math.PI * 2;
        const ly = bandY + Math.sin(ang * 4) * 9;
        const dir = i % 2 === 0 ? -1 : 1;

        ctx.save();
        ctx.translate(lx, ly + dir * 13);
        ctx.rotate(dir * 0.45);
        ctx.fillStyle = rgba(mixHex(accentHex, accentPool, 0.45), 0.82);
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 5.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = rgba(clayFoot, 0.65);
        ctx.beginPath();
        ctx.arc(lx + 15, ly - dir * 8, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (style === 'cup') {
      // Delicate kiln brush line around mid-lower cup
      ctx.strokeStyle = rgba(accentPool, 0.42);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 6) {
        const ang = (x / w) * Math.PI * 2;
        const yy = h * 0.56 + Math.sin(ang * 2) * 2.5;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // Iron-oxide stoneware speckles scattered naturally across entire piece
    for (let i = 0; i < 650; i++) {
      const sx = kit.noise(i * 1.71, 3.3) * w;
      const sy = kit.noise(7.1, i * 1.43) * h;
      const r = 0.7 + kit.noise(i * 0.5, 2.9) * 1.5;
      const alpha = sy > h * 0.88 ? 0.36 : 0.24;
      ctx.fillStyle = rgba(speckleDark, alpha);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeClothTextures(THREE, kit, ceramicHex, accentHex) {
  const linenBase = shadeHex(ceramicHex, 0.28);
  const threadDark = mixHex(ceramicHex, '#9d8a72', 0.35);
  const stripeMain = shadeHex(accentHex, -0.14);
  const stripeSoft = accentHex;

  const colorTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = linenBase;
    ctx.fillRect(0, 0, w, h);

    // Fine linen warp & weft weave
    for (let i = 0; i < w; i += 4) {
      const n = kit.noise(i * 0.08, 1.4);
      ctx.fillStyle = rgba(threadDark, 0.07 + n * 0.08);
      ctx.fillRect(i, 0, 2, h);
    }
    for (let j = 0; j < h; j += 4) {
      const n = kit.noise(3.7, j * 0.08);
      ctx.fillStyle = rgba(threadDark, 0.07 + n * 0.08);
      ctx.fillRect(0, j, w, 2);
    }

    // Cozy woven border stripes framing the cloth
    const drawFrame = (inset, lw, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
    };
    drawFrame(34, 14, rgba(stripeSoft, 0.75));
    drawFrame(56, 5, rgba(stripeMain, 0.8));

    // Running sashiko hem stitch dashes
    ctx.strokeStyle = rgba(shadeHex(ceramicHex, -0.32), 0.55);
    ctx.lineWidth = 2.4;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(18, 18, w - 36, h - 36);
    ctx.setLineDash([]);
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;

  const bumpTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const hi = ((x + y) / 4) % 2 === 0;
        ctx.fillStyle = hi ? '#a4a4a4' : '#5e5e5e';
        ctx.fillRect(x, y, 2, 2);
      }
    }
  });
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;
  bumpTex.repeat.set(3, 3);

  return { colorTex, bumpTex };
}

function makeBambooTextures(THREE, kit, woodHex, ceramicHex) {
  const base = mixHex(woodHex, ceramicHex, 0.48);
  const fiberDark = shadeHex(woodHex, -0.22);
  const nodeShade = shadeHex(woodHex, -0.38);

  const colorTex = kit.canvasTexture(512, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0.0, shadeHex(base, -0.06));
    grad.addColorStop(0.42, base);
    grad.addColorStop(0.50, mixHex(base, nodeShade, 0.35));
    grad.addColorStop(0.58, base);
    grad.addColorStop(1.0, shadeHex(base, 0.08));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Longitudinal bamboo vascular streaks
    for (let y = 0; y < h; y += 2) {
      const n = kit.noise(1.5, y * 0.16);
      ctx.fillStyle = rgba(fiberDark, 0.06 + n * 0.14);
      ctx.fillRect(0, y, w, 1.4);
    }

    // Subtle darkened ring at the central bamboo node
    const nodeGrad = ctx.createLinearGradient(w * 0.45, 0, w * 0.55, 0);
    nodeGrad.addColorStop(0, 'rgba(0,0,0,0)');
    nodeGrad.addColorStop(0.46, rgba(nodeShade, 0.45));
    nodeGrad.addColorStop(0.54, rgba(nodeShade, 0.52));
    nodeGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = nodeGrad;
    ctx.fillRect(w * 0.44, 0, w * 0.12, h);
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;

  const bumpTex = kit.canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      const v = Math.floor(110 + kit.noise(3.1, y * 0.2) * 36);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, w, 1.5);
    }
  });

  return { colorTex, bumpTex };
}

function makeTeaLiquidTexture(THREE, kit, accentHex) {
  const teaCenter = mixHex(accentHex, '#596b20', 0.68);
  const teaMid = mixHex(accentHex, '#8ba138', 0.56);
  const teaRim = mixHex(accentHex, '#c9d46e', 0.45);

  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const grad = ctx.createRadialGradient(cx, cy, w * 0.05, cx, cy, w * 0.5);
    grad.addColorStop(0.0, teaCenter);
    grad.addColorStop(0.65, teaMid);
    grad.addColorStop(1.0, teaRim);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle steeped tea swirl highlights
    ctx.strokeStyle = rgba(teaRim, 0.22);
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, 28 + i * 24, i * 1.7, i * 1.7 + 2.4);
      ctx.stroke();
    }

    // Two tiny steeped tea flecks
    ctx.fillStyle = rgba(shadeHex(teaCenter, -0.45), 0.7);
    ctx.beginPath();
    ctx.ellipse(cx + 18, cy - 12, 4, 1.8, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - 22, cy + 16, 3.2, 1.5, -0.4, 0, Math.PI * 2);
    ctx.fill();
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// Component builders
// ---------------------------------------------------------------------------

function buildWoodenTray(THREE, kit, woodMat, darkWoodMat) {
  const trayGroup = new THREE.Group();
  trayGroup.name = 'tray';

  const W = 0.40;
  const D = 0.29;
  const bedY = 0.016;

  // 1. Four sculpted low bun feet resting cleanly at Y = 0
  const footGeo = createSculptedForm(THREE, 28, 18, (v) => {
    v.x *= 0.022;
    v.z *= 0.017;
    // Flatten underside cleanly at y = 0, dome smoothly into tray underside up to 0.011
    const ny = (v.y + 1) * 0.5; // 0..1
    const flatBottom = ny < 0.18 ? 0 : (ny - 0.18) / 0.82;
    v.y = Math.pow(flatBottom, 0.78) * 0.0115;
    const taper = 0.86 + 0.18 * Math.sin(flatBottom * Math.PI);
    v.x *= taper;
    v.z *= taper;
  });

  const footPositions = [
    [-0.148, -0.102],
    [0.148, -0.102],
    [-0.148, 0.102],
    [0.148, 0.102],
  ];
  for (const [fx, fz] of footPositions) {
    const foot = new THREE.Mesh(footGeo, darkWoodMat);
    foot.position.set(fx, 0, fz);
    foot.castShadow = true;
    foot.receiveShadow = true;
    foot.userData.slot = 'secondary';
    trayGroup.add(foot);
  }

  // 2. Tray base board (ExtrudeGeometry from bezier rounded rect, mapped UV cleanly to XZ)
  const baseShape = makeRoundedRectShape(THREE, W - 0.012, D - 0.012, 0.028);
  const baseGeo = new THREE.ExtrudeGeometry(baseShape, {
    depth: 0.007,
    bevelEnabled: true,
    bevelThickness: 0.0015,
    bevelSize: 0.002,
    bevelSegments: 4,
    curveSegments: 24,
  });
  baseGeo.rotateX(-Math.PI / 2);
  // Normalize UVs across tray XZ so wood planks run naturally along X
  {
    const pos = baseGeo.attributes.position;
    const uv = baseGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      uv.setXY(i, (x + W * 0.5) / W, (z + D * 0.5) / D);
    }
    uv.needsUpdate = true;
  }
  const baseMesh = new THREE.Mesh(baseGeo, woodMat);
  baseMesh.position.y = bedY - 0.0085; // top surface sits precisely at bedY = 0.016
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  baseMesh.userData.slot = 'secondary';
  trayGroup.add(baseMesh);

  // 3. Sculpted outward-flared raised rim
  const rimOuter = makeRoundedRectShape(THREE, W - 0.008, D - 0.008, 0.032);
  const rimHole = makeRoundedRectShape(THREE, W - 0.036, D - 0.036, 0.022, true);
  rimOuter.holes.push(rimHole);

  const rimGeo = new THREE.ExtrudeGeometry(rimOuter, {
    depth: 0.019,
    steps: 4,
    bevelEnabled: true,
    bevelThickness: 0.0032,
    bevelSize: 0.0028,
    bevelSegments: 5,
    curveSegments: 24,
  });
  rimGeo.rotateX(-Math.PI / 2);
  {
    const pos = rimGeo.attributes.position;
    const uv = rimGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);
      const t = Math.max(0, Math.min(1, (y + 0.0032) / 0.0254));
      // Graceful outward lip flare toward top of rim
      const flare = 1 + 0.036 * Math.pow(t, 1.3);
      x *= flare;
      z *= flare;
      // Gentle ergonomic dip along front/back middle edges
      const dip = Math.cos((x / (W * 0.5)) * Math.PI * 0.5);
      if (t > 0.55) {
        y -= Math.max(0, dip) * 0.0014 * ((t - 0.55) / 0.45);
      }
      pos.setXYZ(i, x, y, z);
      uv.setXY(i, (x + W * 0.5) / W, (z + D * 0.5) / D);
    }
    pos.needsUpdate = true;
    uv.needsUpdate = true;
    rimGeo.computeVertexNormals();
  }
  const rimMesh = new THREE.Mesh(rimGeo, woodMat);
  rimMesh.position.y = 0.012; // overlaps base smoothly, top reaches ~0.034
  rimMesh.castShadow = true;
  rimMesh.receiveShadow = true;
  rimMesh.userData.slot = 'secondary';
  trayGroup.add(rimMesh);

  // 4. Pair of sculpted arched wooden side handles (tapered oval tubes)
  for (const side of [-1, 1]) {
    const xBase = side * (W * 0.482);
    const xOut = side * (W * 0.502);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(xBase, 0.024, -0.056),
      new THREE.Vector3(xOut, 0.041, -0.044),
      new THREE.Vector3(xOut + side * 0.004, 0.0475, 0),
      new THREE.Vector3(xOut, 0.041, 0.044),
      new THREE.Vector3(xBase, 0.024, 0.056),
    ]);
    const handleGeo = createTaperedTubeGeometry(
      THREE,
      curve,
      28,
      14,
      (t, ang) => {
        const swell = 1 - 0.16 * Math.sin(t * Math.PI);
        const oval = 0.85 + 0.24 * Math.abs(Math.cos(ang));
        return 0.0056 * swell * oval;
      },
      { capStart: true, capEnd: true }
    );
    const handle = new THREE.Mesh(handleGeo, darkWoodMat);
    handle.castShadow = true;
    handle.receiveShadow = true;
    handle.userData.slot = 'secondary';
    trayGroup.add(handle);
  }

  return trayGroup;
}

function buildLinenCloth(THREE, kit, clothMat) {
  const cw = 0.146;
  const cd = 0.132;
  const shape = makeRoundedRectShape(THREE, cw, cd, 0.012);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0018,
    bevelEnabled: true,
    bevelThickness: 0.0008,
    bevelSize: 0.0012,
    bevelSegments: 3,
    curveSegments: 20,
  });
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Keep center flat under teapot, gently wave outer hem corners
    const edgeDist = Math.max(Math.abs(x) / (cw * 0.5), Math.abs(z) / (cd * 0.5));
    const hemMask = Math.max(0, (edgeDist - 0.72) / 0.28);
    const ripple =
      (Math.sin(x * 48 + z * 26) * 0.00065 + Math.cos(z * 54 - x * 18) * 0.00055) *
      hemMask *
      hemMask;
    pos.setY(i, y + Math.max(0, ripple));
    uv.setXY(i, (x + cw * 0.5) / cw, (z + cd * 0.5) / cd);
  }
  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, clothMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.slot = 'accent';
  return mesh;
}

function buildTeapot(THREE, kit, potMat, accentCeramicMat, darkInteriorMat) {
  const group = new THREE.Group();
  group.name = 'teapot';

  // 1. Hand-thrown plump teapot body (26 profile points, full hollow gallery rim)
  const bodyProfile = [
    [0.0001, 0.0012],
    [0.025, 0.0012],
    [0.0275, 0.0],
    [0.0305, 0.0],
    [0.0315, 0.0038],
    [0.036, 0.0085],
    [0.0445, 0.016],
    [0.0512, 0.0265],
    [0.0538, 0.0375],
    [0.0528, 0.049],
    [0.0485, 0.059],
    [0.0415, 0.0672],
    [0.0338, 0.0725],
    [0.0302, 0.0752],
    [0.0314, 0.0785],
    [0.0308, 0.0808],
    [0.0285, 0.0812],
    [0.0268, 0.0792],
    [0.0262, 0.0745],
    [0.032, 0.068],
    [0.042, 0.055],
    [0.0455, 0.038],
    [0.041, 0.020],
    [0.028, 0.0085],
    [0.014, 0.0065],
    [0.0001, 0.0062],
  ];

  const bodyGeo = createOrganicLathe(THREE, bodyProfile, 48, (r, y, yn, ang) => {
    // Periodic gentle hand-thrown pottery character
    const nx = Math.cos(ang) * 1.4;
    const nz = Math.sin(ang) * 1.4;
    const micro = (kit.noise(nx + 2.1, nz + y * 24) - 0.5) * 0.0007;
    const rib = Math.sin(y * 290) * 0.00022 * Math.sin(yn * Math.PI);
    return { dr: micro + rib, dy: 0 };
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, potMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.userData.slot = 'primary';
  group.add(bodyMesh);

  // 2. Fitted domed lid (18 profile points)
  const lidProfile = [
    [0.0001, 0.0735],
    [0.0235, 0.0735],
    [0.0252, 0.0742],
    [0.0255, 0.0792],
    [0.0278, 0.0804],
    [0.0294, 0.0815],
    [0.0292, 0.0835],
    [0.0262, 0.0862],
    [0.0212, 0.0892],
    [0.0155, 0.0914],
    [0.0098, 0.0928],
    [0.0055, 0.0934],
    [0.0001, 0.0936],
  ];
  const lidGeo = createOrganicLathe(THREE, lidProfile, 44, (r, y, yn, ang) => ({
    dr: (kit.noise(Math.cos(ang) + 5.2, Math.sin(ang) + y * 20) - 0.5) * 0.0003,
    dy: 0,
  }));
  const lidMesh = new THREE.Mesh(lidGeo, accentCeramicMat);
  lidMesh.castShadow = true;
  lidMesh.receiveShadow = true;
  lidMesh.userData.slot = 'accent';
  group.add(lidMesh);

  // 3. Sculpted ceramic bud finial knob deeply overlapped into lid dome
  const knobGeo = createSculptedForm(THREE, 32, 22, (v) => {
    const t = (v.y + 1) * 0.5; // 0 (bottom) to 1 (top)
    // Pinch cleanly at neck (t ~ 0.25), plump round bud above, gently flattened crown
    const neckPinch = 0.55 + 0.58 * Math.sin(Math.pow(t, 0.72) * Math.PI);
    const bulge = t < 0.28 ? 0.58 + (0.28 - t) * 1.1 : neckPinch;
    const rad = 0.0088 * bulge;
    v.x *= rad;
    v.z *= rad;
    v.y = t * 0.0155 - 0.0025;
    if (t > 0.85) {
      v.y -= (t - 0.85) * 0.004;
    }
  });
  const knobMesh = new THREE.Mesh(knobGeo, potMat);
  knobMesh.position.y = 0.0915;
  knobMesh.castShadow = true;
  knobMesh.receiveShadow = true;
  knobMesh.userData.slot = 'primary';
  group.add(knobMesh);

  // Tiny steam vent pinhole on lid
  const ventGeo = new THREE.CylinderGeometry(0.0012, 0.0012, 0.002, 12);
  const ventMesh = new THREE.Mesh(ventGeo, darkInteriorMat);
  ventMesh.position.set(0.0125, 0.0912, 0.005);
  ventMesh.rotation.z = -0.25;
  ventMesh.userData.slot = 'secondary';
  group.add(ventMesh);

  // 4. Graceful S-curved tapered spout (outer wall + recessed hollow bore)
  const spoutCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.036, 0.029, 0),
    new THREE.Vector3(0.056, 0.034, 0),
    new THREE.Vector3(0.068, 0.050, 0),
    new THREE.Vector3(0.079, 0.065, 0),
    new THREE.Vector3(0.089, 0.0715, 0),
  ]);
  const spoutOuterGeo = createTaperedTubeGeometry(
    THREE,
    spoutCurve,
    30,
    18,
    (t, ang) => {
      // Wide flared root blending seamlessly into belly, slender curved tip
      const rootFlare = 0.0175 * Math.pow(1 - t, 2.2);
      const base = 0.0066 + 0.0052 * (1 - t) + rootFlare;
      // Subtle pouring lip pinch at top of spout tip
      const lip = t > 0.85 ? 1 + 0.08 * Math.cos(ang) * ((t - 0.85) / 0.15) : 1;
      return base * lip;
    }
  );
  const spoutOuter = new THREE.Mesh(spoutOuterGeo, potMat);
  spoutOuter.castShadow = true;
  spoutOuter.receiveShadow = true;
  spoutOuter.userData.slot = 'primary';
  group.add(spoutOuter);

  // Hollow inner spout bore near the tip so looking into spout shows ceramic thickness
  const boreCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.068, 0.050, 0),
    new THREE.Vector3(0.079, 0.065, 0),
    new THREE.Vector3(0.0892, 0.0716, 0),
  ]);
  const boreGeo = createTaperedTubeGeometry(
    THREE,
    boreCurve,
    12,
    16,
    (t) => 0.0052 * (1 - 0.08 * t),
    { capStart: true, invert: true }
  );
  const boreMesh = new THREE.Mesh(boreGeo, darkInteriorMat);
  boreMesh.userData.slot = 'secondary';
  group.add(boreMesh);

  // Smooth rounded spout rim torus joining outer spout and inner bore
  const tipTangent = spoutCurve.getTangentAt(1);
  const tipPos = spoutCurve.getPointAt(1);
  const spoutLipGeo = new THREE.TorusGeometry(0.0058, 0.00105, 10, 20);
  const spoutLip = new THREE.Mesh(spoutLipGeo, accentCeramicMat);
  spoutLip.position.copy(tipPos);
  spoutLip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tipTangent);
  spoutLip.castShadow = true;
  spoutLip.userData.slot = 'accent';
  group.add(spoutLip);

  // 5. Ergonomic ear-shaped curved handle (elliptical tapered tube with thumb-rest swell)
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.036, 0.061, 0),
    new THREE.Vector3(-0.062, 0.069, 0),
    new THREE.Vector3(-0.081, 0.058, 0),
    new THREE.Vector3(-0.082, 0.038, 0),
    new THREE.Vector3(-0.067, 0.023, 0),
    new THREE.Vector3(-0.040, 0.023, 0),
  ]);
  const handleGeo = createTaperedTubeGeometry(
    THREE,
    handleCurve,
    36,
    16,
    (t, ang) => {
      const endFlare = 1 + 0.36 * (Math.pow(1 - t, 3.2) + Math.pow(t, 3.2));
      const thumbSwell = 1 + 0.22 * Math.exp(-Math.pow((t - 0.24) / 0.11, 2));
      // Strap-like oval cross-section (wider horizontally, sleeker radially)
      const oval = 0.78 + 0.32 * Math.abs(Math.sin(ang));
      return 0.0054 * endFlare * thumbSwell * oval;
    },
    { capStart: true, capEnd: true }
  );
  const handleMesh = new THREE.Mesh(handleGeo, potMat);
  handleMesh.castShadow = true;
  handleMesh.receiveShadow = true;
  handleMesh.userData.slot = 'primary';
  group.add(handleMesh);

  // Store spout tip in local space for steam placement
  group.userData.spoutTipLocal = tipPos.clone();

  return group;
}

function buildTeacupGeometries(THREE, kit) {
  // 24-point yunomi cup profile with foot ring, plump belly, gently flared lip, hollow interior
  const cupProfile = [
    [0.0001, 0.0014],
    [0.0135, 0.0014],
    [0.0145, 0.0],
    [0.0168, 0.0],
    [0.0172, 0.0034],
    [0.0205, 0.0072],
    [0.0242, 0.014],
    [0.0258, 0.0225],
    [0.0256, 0.031],
    [0.0252, 0.038],
    [0.0262, 0.0428],
    [0.0260, 0.0446],
    [0.0244, 0.0450],
    [0.0232, 0.0434],
    [0.0226, 0.0375],
    [0.0228, 0.0295],
    [0.0224, 0.021],
    [0.0202, 0.0135],
    [0.0158, 0.0085],
    [0.0095, 0.0064],
    [0.0001, 0.0060],
  ];

  const cupGeo = createOrganicLathe(THREE, cupProfile, 40, (r, y, yn, ang) => {
    const micro = (kit.noise(Math.cos(ang) * 1.5 + 3.4, Math.sin(ang) * 1.5 + y * 30) - 0.5) * 0.00045;
    const rib = Math.sin(y * 340) * 0.00016 * Math.sin(yn * Math.PI);
    return { dr: micro + rib, dy: 0 };
  });

  // Concave tea meniscus surface sitting inside the cup at y ~ 0.0355
  const teaProfile = [];
  const teaR = 0.0227;
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const r = Math.max(0.0001, t * teaR);
    // Gentle capillary upward curve at the ceramic edge
    const meniscus = Math.pow(t, 4.5) * 0.0012;
    teaProfile.push([r, 0.0352 + meniscus]);
  }
  const teaGeo = createOrganicLathe(THREE, teaProfile, 32);
  // Radial top-down UVs for the brewed tea texture
  {
    const pos = teaGeo.attributes.position;
    const uv = teaGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) / (teaR * 2) + 0.5, pos.getZ(i) / (teaR * 2) + 0.5);
    }
    uv.needsUpdate = true;
  }

  return { cupGeo, teaGeo };
}

function buildTeaCaddy(THREE, kit, caddyMat, woodLidMat, ceramicKnobMat) {
  const group = new THREE.Group();
  group.name = 'caddy';

  // 1. Gently barrel-shaped celadon tea canister (22 profile points)
  const caddyProfile = [
    [0.0001, 0.0012],
    [0.024, 0.0012],
    [0.0265, 0.0],
    [0.0285, 0.0],
    [0.0298, 0.0045],
    [0.0322, 0.015],
    [0.0342, 0.032],
    [0.0348, 0.050],
    [0.0338, 0.066],
    [0.0308, 0.075],
    [0.0265, 0.0795],
    [0.0242, 0.0815],
    [0.0242, 0.0842],
    [0.0220, 0.0842],
    [0.0218, 0.076],
    [0.026, 0.068],
    [0.0001, 0.068],
  ];
  const bodyGeo = createOrganicLathe(THREE, caddyProfile, 44, (r, y, yn, ang) => ({
    dr: (kit.noise(Math.cos(ang) + 8.1, Math.sin(ang) + y * 22) - 0.5) * 0.00032,
    dy: 0,
  }));
  const bodyMesh = new THREE.Mesh(bodyGeo, caddyMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.userData.slot = 'accent';
  group.add(bodyMesh);

  // 2. Warm turned-wood snug overlapping lid (18 profile points)
  const lidProfile = [
    [0.0001, 0.0785],
    [0.0235, 0.0785],
    [0.0245, 0.0792],
    [0.0252, 0.0820],
    [0.0282, 0.0824],
    [0.0292, 0.0842],
    [0.0290, 0.0882],
    [0.0272, 0.0912],
    [0.0225, 0.0938],
    [0.0155, 0.0954],
    [0.0085, 0.0962],
    [0.0001, 0.0965],
  ];
  const lidGeo = createOrganicLathe(THREE, lidProfile, 44);
  const lidMesh = new THREE.Mesh(lidGeo, woodLidMat);
  lidMesh.castShadow = true;
  lidMesh.receiveShadow = true;
  lidMesh.userData.slot = 'secondary';
  group.add(lidMesh);

  // 3. Sculpted cream ceramic bead finial deeply seated into wooden lid
  const finialGeo = createSculptedForm(THREE, 28, 18, (v) => {
    const t = (v.y + 1) * 0.5;
    const rad = 0.0068 * (0.62 + 0.45 * Math.sin(t * Math.PI));
    v.x *= rad;
    v.z *= rad;
    v.y = t * 0.0105 - 0.002;
  });
  const finialMesh = new THREE.Mesh(finialGeo, ceramicKnobMat);
  finialMesh.position.y = 0.0955;
  finialMesh.castShadow = true;
  finialMesh.receiveShadow = true;
  finialMesh.userData.slot = 'primary';
  group.add(finialMesh);

  return group;
}

function buildBambooScoopAndRest(THREE, kit, bambooMat, pebbleMat, teaLeafMat) {
  const group = new THREE.Group();
  group.name = 'scoop';

  // 1. Ceramic river-pebble scoop rest (chashaku-oki) with sculpted concave saddle
  const restGeo = createSculptedForm(THREE, 48, 32, (v) => {
    // Elongated organic pebble sitting along Z (perpendicular to scoop along X)
    v.x *= 0.0115;
    v.z *= 0.021;
    const ny = (v.y + 1) * 0.5;
    // Flatten underside cleanly at y = 0
    const flatY = ny < 0.22 ? 0 : (ny - 0.22) / 0.78;
    let y = Math.pow(flatY, 0.75) * 0.0106;

    // Gentle saddle dip in center (along Z near 0) so the bamboo scoop nests cleanly
    const saddle = Math.exp(-Math.pow(v.z / 0.0085, 2));
    if (ny > 0.45) {
      y -= saddle * 0.0024 * ((ny - 0.45) / 0.55);
    }

    // Subtle organic pebble asymmetry
    const n = (kit.noise(v.x * 80 + 2.3, v.z * 80 + 4.7) - 0.5) * 0.0009;
    v.x += n;
    v.z += n * 0.7;
    v.y = Math.max(0, y);
  });
  const restMesh = new THREE.Mesh(restGeo, pebbleMat);
  restMesh.position.set(0.0, 0.0, 0.0);
  restMesh.castShadow = true;
  restMesh.receiveShadow = true;
  restMesh.userData.slot = 'accent';
  group.add(restMesh);

  // 2. Bamboo tea scoop (chashaku): side silhouette ExtrudeGeometry bent into cupped 3D spoon
  // Spine runs along X from -0.056 (tail resting on tray) to +0.056 (upturned curved bowl)
  const thickness = 0.0018;
  const scoopSide = new THREE.Shape();
  // Underside curve from tail (-0.056) -> node (0) -> neck (0.034) -> upturned hooked tip (0.056)
  scoopSide.moveTo(-0.056, 0.0004);
  scoopSide.bezierCurveTo(-0.032, 0.0046, -0.012, 0.0078, 0.0, 0.0083);
  scoopSide.bezierCurveTo(0.016, 0.0092, 0.032, 0.0102, 0.043, 0.0112);
  scoopSide.bezierCurveTo(0.050, 0.0124, 0.055, 0.0155, 0.057, 0.0195);
  // Rounded spoon lip tip
  scoopSide.bezierCurveTo(0.0576, 0.0205, 0.0562, 0.0212, 0.0552, 0.0202);
  // Top surface curve returning back to tail
  scoopSide.bezierCurveTo(0.053, 0.0168, 0.048, 0.0142, 0.042, 0.0131);
  scoopSide.bezierCurveTo(0.031, 0.0121, 0.016, 0.0111, 0.0, 0.0102);
  scoopSide.bezierCurveTo(-0.012, 0.0096, -0.032, 0.0064, -0.056, 0.0004 + thickness);
  scoopSide.closePath();

  const scoopGeo = new THREE.ExtrudeGeometry(scoopSide, {
    depth: 0.0086,
    steps: 8,
    bevelEnabled: true,
    bevelThickness: 0.00055,
    bevelSize: 0.00045,
    bevelSegments: 3,
    curveSegments: 28,
  });
  // Center Z around 0
  scoopGeo.translate(0, 0, -0.0043);

  // Displace vertices to taper width, flare & round spoon tip, cup trough, and raise bamboo node
  {
    const pos = scoopGeo.attributes.position;
    const uv = scoopGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      const u = Math.max(0, Math.min(1, (x + 0.056) / 0.113)); // 0 tail .. 1 tip
      const zNorm = Math.max(-1, Math.min(1, z / 0.00485)); // -1 .. +1 across width

      // Width profile: slender handle, gracefully widened spoon bowl, softly rounded tip
      let widthScale = 0.72 + 0.42 * Math.pow(u, 1.7);
      if (u > 0.88) {
        const tipT = (u - 0.88) / 0.12;
        widthScale *= Math.sqrt(Math.max(0.18, 1 - tipT * tipT * 0.78));
      }
      if (u < 0.07) {
        const tailT = (0.07 - u) / 0.07;
        widthScale *= 1 - tailT * tailT * 0.22;
      }

      // Characteristic bamboo node (fushi) bulge right around u = 0.49
      const nodeRing = Math.exp(-Math.pow((u - 0.495) / 0.028, 2));
      widthScale += nodeRing * 0.14;
      y += nodeRing * 0.00075;

      z *= widthScale;

      // Concave bamboo trough cupping (stronger in the spoon bowl!)
      const cupStrength = 0.0007 + 0.0017 * Math.pow(u, 2.2);
      y += zNorm * zNorm * cupStrength;

      pos.setXYZ(i, x, y, z);
      uv.setXY(i, u, zNorm * 0.5 + 0.5);
    }
    pos.needsUpdate = true;
    uv.needsUpdate = true;
    scoopGeo.computeVertexNormals();
  }

  const scoopMesh = new THREE.Mesh(scoopGeo, bambooMat);
  scoopMesh.castShadow = true;
  scoopMesh.receiveShadow = true;
  scoopMesh.userData.slot = 'secondary';
  group.add(scoopMesh);

  // 3. Cozy tiny pinch of steeped/loose matcha tea leaves nestled inside the curved scoop tip
  const pinchGeo = createSculptedForm(THREE, 24, 16, (v) => {
    const n = kit.noise(v.x * 4.5 + 1.2, v.z * 4.5 + 3.4);
    const bumpy = 0.82 + n * 0.36;
    v.x *= 0.0062 * bumpy;
    v.z *= 0.0038 * bumpy;
    v.y = (v.y < 0 ? v.y * 0.25 : v.y * 0.72) * 0.0032 * bumpy;
  });
  const pinchMesh = new THREE.Mesh(pinchGeo, teaLeafMat);
  pinchMesh.position.set(0.0445, 0.0144, 0);
  pinchMesh.rotation.z = 0.22;
  pinchMesh.castShadow = true;
  pinchMesh.userData.slot = 'accent';
  group.add(pinchMesh);

  return group;
}

function buildSteamWisp(THREE, steamMat, height, curlRadius, phaseOffset) {
  const pts = [];
  const segs = 7;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const angle = t * Math.PI * 2.1 + phaseOffset;
    const spread = Math.sin(t * Math.PI) * curlRadius * (0.65 + 0.55 * t);
    pts.push(new THREE.Vector3(Math.cos(angle) * spread, t * height, Math.sin(angle) * spread));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = createTaperedTubeGeometry(THREE, curve, 24, 10, (t, ang) => {
    const envelope = Math.sin(t * Math.PI);
    const ribbon = 0.45 + 0.55 * Math.abs(Math.cos(ang + t * 2.5));
    return 0.0042 * envelope * ribbon;
  });
  const mesh = new THREE.Mesh(geo, steamMat);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.slot = 'glow';
  return mesh;
}

// ---------------------------------------------------------------------------
// Main ES module exports
// ---------------------------------------------------------------------------

export function build(THREE, opts = {}, kit) {
  const palette = {
    ceramic: opts.ceramic || '#f7e7c6',
    accent: opts.accent || '#a8e0c0',
    wood: opts.wood || '#c89462',
  };

  const root = new THREE.Group();
  root.name = 'teaTrayDiorama';

  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  // --- Textures ---
  const woodTex = makeWoodTextures(THREE, kit, palette.wood);
  const ceramicBump = makeCeramicBumpTexture(THREE, kit);
  const teapotColor = makeCeramicTexture(THREE, kit, palette.ceramic, palette.accent, palette.wood, 'teapot');
  const cupColor = makeCeramicTexture(THREE, kit, palette.ceramic, palette.accent, palette.wood, 'cup');
  const caddyColor = makeCeramicTexture(THREE, kit, palette.ceramic, palette.accent, palette.wood, 'caddy');
  const clothTex = makeClothTextures(THREE, kit, palette.ceramic, palette.accent);
  const bambooTex = makeBambooTextures(THREE, kit, palette.wood, palette.ceramic);
  const teaLiquidTex = makeTeaLiquidTexture(THREE, kit, palette.accent);

  // --- Materials (MeshPhysicalMaterial) ---
  const woodMat = new THREE.MeshPhysicalMaterial({
    map: woodTex.colorTex,
    bumpMap: woodTex.bumpTex,
    bumpScale: 0.0012,
    roughness: 0.44,
    metalness: 0.0,
    clearcoat: 0.28,
    clearcoatRoughness: 0.36,
  });

  const darkWoodMat = new THREE.MeshPhysicalMaterial({
    map: woodTex.colorTex,
    bumpMap: woodTex.bumpTex,
    bumpScale: 0.0012,
    color: new THREE.Color(shadeHex(palette.wood, -0.14)),
    roughness: 0.42,
    metalness: 0.0,
    clearcoat: 0.32,
    clearcoatRoughness: 0.32,
  });

  const teapotMat = new THREE.MeshPhysicalMaterial({
    map: teapotColor,
    bumpMap: ceramicBump,
    bumpScale: 0.00055,
    roughness: 0.20,
    metalness: 0.0,
    clearcoat: 0.85,
    clearcoatRoughness: 0.14,
  });

  const cupMat = new THREE.MeshPhysicalMaterial({
    map: cupColor,
    bumpMap: ceramicBump,
    bumpScale: 0.0005,
    roughness: 0.19,
    metalness: 0.0,
    clearcoat: 0.86,
    clearcoatRoughness: 0.13,
  });

  const caddyMat = new THREE.MeshPhysicalMaterial({
    map: caddyColor,
    bumpMap: ceramicBump,
    bumpScale: 0.00045,
    roughness: 0.16,
    metalness: 0.0,
    clearcoat: 0.92,
    clearcoatRoughness: 0.10,
  });

  const accentCeramicMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(palette.accent),
    bumpMap: ceramicBump,
    bumpScale: 0.00045,
    roughness: 0.18,
    metalness: 0.0,
    clearcoat: 0.88,
    clearcoatRoughness: 0.12,
  });

  const creamKnobMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(palette.ceramic),
    bumpMap: ceramicBump,
    bumpScale: 0.0004,
    roughness: 0.20,
    metalness: 0.0,
    clearcoat: 0.84,
    clearcoatRoughness: 0.14,
  });

  const darkInteriorMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#2c241e'),
    roughness: 0.78,
    metalness: 0.0,
  });

  const clothMat = new THREE.MeshPhysicalMaterial({
    map: clothTex.colorTex,
    bumpMap: clothTex.bumpTex,
    bumpScale: 0.0014,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.85,
    sheenRoughness: 0.75,
    sheenColor: new THREE.Color(shadeHex(palette.ceramic, 0.35)),
  });

  const bambooMat = new THREE.MeshPhysicalMaterial({
    map: bambooTex.colorTex,
    bumpMap: bambooTex.bumpTex,
    bumpScale: 0.0008,
    roughness: 0.36,
    metalness: 0.0,
    clearcoat: 0.28,
    clearcoatRoughness: 0.30,
  });

  const teaLiquidMat = new THREE.MeshPhysicalMaterial({
    map: teaLiquidTex,
    roughness: 0.08,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    transparent: true,
    opacity: 0.92,
  });

  const teaLeafMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(mixHex(palette.accent, '#3c5a2b', 0.62)),
    roughness: 0.88,
    metalness: 0.0,
    sheen: 0.65,
    sheenColor: new THREE.Color(palette.accent),
  });

  const steamBaseMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#fffdf8'),
    emissive: new THREE.Color('#fff8ec'),
    emissiveIntensity: 0.35,
    roughness: 0.9,
    metalness: 0.0,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  });

  // --- Assemble cozy tea tray scene (bed top at Y = 0.016) ---
  const bedY = 0.016;

  // 1. Wooden tea tray
  const tray = buildWoodenTray(THREE, kit, woodMat, darkWoodMat);
  body.add(tray);

  // 2. Woven linen tea cloth beneath teapot
  const cloth = buildLinenCloth(THREE, kit, clothMat);
  cloth.position.set(-0.086, bedY + 0.0008, -0.022);
  cloth.rotation.y = 0.11;
  body.add(cloth);

  // 3. Small round ceramic teapot
  const teapot = buildTeapot(THREE, kit, teapotMat, accentCeramicMat, darkInteriorMat);
  teapot.position.set(-0.086, bedY + 0.0024, -0.024);
  teapot.rotation.y = -0.40; // Spout aims gently forward-right toward cups
  body.add(teapot);

  // 4. Four cozy yunomi teacups with steeped tea
  const cupsGroup = new THREE.Group();
  cupsGroup.name = 'cups';
  const { cupGeo, teaGeo } = buildTeacupGeometries(THREE, kit);

  const cupLayout = [
    { x: 0.018, z: 0.066, rot: 0.35 },
    { x: 0.084, z: 0.072, rot: 2.15 },
    { x: 0.052, z: 0.008, rot: 3.90 },
    { x: 0.124, z: 0.018, rot: 5.25 },
  ];

  for (let i = 0; i < cupLayout.length; i++) {
    const cfg = cupLayout[i];
    const cupHolder = new THREE.Group();
    cupHolder.name = `cup_${i}`;
    cupHolder.position.set(cfg.x, bedY, cfg.z);
    cupHolder.rotation.y = cfg.rot;

    const cupMesh = new THREE.Mesh(cupGeo, cupMat);
    cupMesh.castShadow = true;
    cupMesh.receiveShadow = true;
    cupMesh.userData.slot = 'primary';
    cupHolder.add(cupMesh);

    const teaMesh = new THREE.Mesh(teaGeo, teaLiquidMat);
    teaMesh.name = `tea_${i}`;
    teaMesh.receiveShadow = true;
    teaMesh.userData.slot = 'accent';
    cupHolder.add(teaMesh);

    cupsGroup.add(cupHolder);
  }
  body.add(cupsGroup);

  // 5. Celadon tea caddy with turned-wood lid
  const caddy = buildTeaCaddy(THREE, kit, caddyMat, darkWoodMat, creamKnobMat);
  caddy.position.set(0.096, bedY, -0.064);
  // Rotate so the painted washi label (at u = 0.5) faces gently toward the front-left 3/4 view
  caddy.rotation.y = Math.PI - 0.28;
  body.add(caddy);

  // 6. Bamboo scoop resting on sculpted ceramic pebble rest
  const scoopGroup = buildBambooScoopAndRest(THREE, kit, bambooMat, accentCeramicMat, teaLeafMat);
  scoopGroup.position.set(-0.092, bedY, 0.078);
  scoopGroup.rotation.y = 0.24;
  body.add(scoopGroup);

  // 7. Soft curling rising steam wisps (spout + two freshly poured cups)
  const steamGroup = new THREE.Group();
  steamGroup.name = 'steam';

  const spoutTipWorld = teapot.userData.spoutTipLocal
    .clone()
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), teapot.rotation.y)
    .add(teapot.position);

  const steamConfigs = [
    { pos: spoutTipWorld.clone().add(new THREE.Vector3(0.002, 0.004, 0.001)), h: 0.058, r: 0.0065, phase: 0.0 },
    { pos: new THREE.Vector3(cupLayout[0].x, bedY + 0.042, cupLayout[0].z), h: 0.050, r: 0.0055, phase: 2.1 },
    { pos: new THREE.Vector3(cupLayout[2].x, bedY + 0.042, cupLayout[2].z), h: 0.046, r: 0.0052, phase: 4.2 },
  ];

  for (let i = 0; i < steamConfigs.length; i++) {
    const sc = steamConfigs[i];
    const mat = steamBaseMat.clone();
    const wisp = buildSteamWisp(THREE, mat, sc.h, sc.r, sc.phase);
    wisp.name = `steam_${i}`;
    wisp.position.copy(sc.pos);
    wisp.userData.baseY = sc.pos.y;
    wisp.userData.phase = sc.phase;
    steamGroup.add(wisp);
  }
  body.add(steamGroup);

  return root;
}

export function idle(group, t) {
  if (!group) return;

  // Gently drift & breathe rising steam wisps from the freshly brewed tea
  const steam = group.getObjectByName('steam');
  if (steam) {
    for (let i = 0; i < steam.children.length; i++) {
      const wisp = steam.children[i];
      const phase = wisp.userData.phase || i * 2.1;
      const cycle = (t * 0.42 + phase * 0.35) % 1;
      const fade = Math.sin(cycle * Math.PI);

      wisp.position.y = (wisp.userData.baseY || 0.06) + cycle * 0.016;
      wisp.rotation.y = t * 0.45 + phase;
      wisp.rotation.z = Math.sin(t * 1.15 + phase) * 0.09;
      wisp.scale.set(0.85 + cycle * 0.32, 0.78 + fade * 0.34, 0.85 + cycle * 0.32);

      if (wisp.material) {
        wisp.material.opacity = 0.06 + fade * 0.20;
      }
    }
  }

  // Subtle warm surface shimmer on the tea inside the four cups
  const cups = group.getObjectByName('cups');
  if (cups) {
    for (let i = 0; i < cups.children.length; i++) {
      const tea = cups.children[i].getObjectByName(`tea_${i}`);
      if (tea) {
        tea.rotation.x = Math.sin(t * 1.3 + i * 1.4) * 0.008;
        tea.rotation.z = Math.cos(t * 1.05 + i * 1.9) * 0.008;
      }
    }
  }
}
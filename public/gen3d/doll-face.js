const HEAD_RX = 0.15;
const HEAD_RY = 0.155;
const HEAD_RZ = 0.145;
const HEAD_CY = 0.14;

const EYE_THETA = 0.4026;
const EYE_PHI = -0.1620;
const EYE_DTHETA = 0.62;
const EYE_DPHI = 0.56;

const PATCH_SIZE = 512;

const NAMED_COLORS = {
  black: [24, 20, 22],
  white: [250, 248, 246],
  brown: [110, 68, 44],
  saddlebrown: [139, 69, 19],
  sienna: [150, 82, 48],
  chocolate: [138, 76, 42],
  tan: [196, 154, 114],
  amber: [198, 130, 46],
  hazel: [142, 112, 62],
  gold: [212, 168, 62],
  blue: [74, 126, 188],
  navy: [44, 66, 116],
  teal: [54, 134, 140],
  cyan: [78, 174, 196],
  green: [74, 146, 94],
  emerald: [52, 146, 98],
  olive: [118, 126, 62],
  violet: [128, 86, 178],
  purple: [124, 74, 158],
  indigo: [76, 68, 146],
  pink: [226, 134, 152],
  rose: [212, 110, 128],
  coral: [232, 124, 112],
  peach: [240, 162, 140],
  red: [198, 66, 74],
  crimson: [176, 46, 64],
  maroon: [126, 42, 54],
  magenta: [196, 72, 136],
  grey: [126, 130, 138],
  gray: [126, 130, 138],
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpPt(p0, p1, t) {
  return [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t];
}

function parseColor(input, fallback = '#4a7cb5') {
  if (input && typeof input === 'object' && typeof input.r === 'number') {
    const scale = input.r <= 1 && input.g <= 1 && input.b <= 1 ? 255 : 1;
    return {
      r: clamp(Math.round(input.r * scale), 0, 255),
      g: clamp(Math.round(input.g * scale), 0, 255),
      b: clamp(Math.round(input.b * scale), 0, 255),
    };
  }
  if (typeof input === 'number' && Number.isFinite(input)) {
    const n = Math.floor(input) & 0xffffff;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  if (typeof input === 'string') {
    const s = input.trim().toLowerCase();
    if (NAMED_COLORS[s]) {
      const [r, g, b] = NAMED_COLORS[s];
      return { r, g, b };
    }
    if (s.startsWith('#')) {
      const hex = s.slice(1);
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16) || 0,
          g: parseInt(hex[1] + hex[1], 16) || 0,
          b: parseInt(hex[2] + hex[2], 16) || 0,
        };
      }
      if (hex.length >= 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16) || 0,
          g: parseInt(hex.slice(2, 4), 16) || 0,
          b: parseInt(hex.slice(4, 6), 16) || 0,
        };
      }
    }
    const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
    if (m) {
      return {
        r: clamp(Math.round(Number(m[1])), 0, 255),
        g: clamp(Math.round(Number(m[2])), 0, 255),
        b: clamp(Math.round(Number(m[3])), 0, 255),
      };
    }
  }
  return input === fallback ? { r: 74, g: 124, b: 181 } : parseColor(fallback, fallback);
}

function rgba(c, a = 1) {
  return `rgba(${c.r},${c.g},${c.b},${clamp(a, 0, 1).toFixed(4)})`;
}

function mixColor(a, b, t) {
  return {
    r: clamp(Math.round(lerp(a.r, b.r, t)), 0, 255),
    g: clamp(Math.round(lerp(a.g, b.g, t)), 0, 255),
    b: clamp(Math.round(lerp(a.b, b.b, t)), 0, 255),
  };
}

function lighten(c, amt) {
  return mixColor(c, { r: 255, g: 252, b: 248 }, amt);
}

function darken(c, amt) {
  return mixColor(c, { r: 16, g: 14, b: 22 }, amt);
}

function safeNoise(kit, x, y) {
  if (kit && typeof kit.noise === 'function') {
    return kit.noise(x, y);
  }
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function makeEllipsoidPatchGeometry(
  THREE,
  thetaCenter,
  phiCenter,
  dTheta,
  dPhi,
  offset,
  segU = 32,
  segV = 32,
  bulgeFn = null
) {
  const geo = new THREE.BufferGeometry();
  const cols = segU + 1;
  const rows = segV + 1;
  const positions = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);

  let pIdx = 0;
  let uvIdx = 0;

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    const phi = phiCenter + (v - 0.5) * dPhi;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);

    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const theta = thetaCenter + (u - 0.5) * dTheta;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      const extra = bulgeFn ? bulgeFn(u, v) : 0;
      const off = offset + extra;

      positions[pIdx++] = (HEAD_RX + off) * cosPhi * sinTheta;
      positions[pIdx++] = HEAD_CY + (HEAD_RY + off) * sinPhi;
      positions[pIdx++] = (HEAD_RZ + off) * cosPhi * cosTheta;

      uvs[uvIdx++] = u;
      uvs[uvIdx++] = v;
    }
  }

  const indices = [];
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * cols + iu;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function makeDynamicTexture(THREE, kit, size, drawFn, isColor = true) {
  let savedCtx = null;
  const tex = kit.canvasTexture(size, size, (ctx, w, h) => {
    savedCtx = ctx;
    drawFn(ctx, w, h);
  });
  if (isColor && THREE.SRGBColorSpace) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.anisotropy = 4;

  return {
    tex,
    redraw(fn) {
      const ctx = savedCtx || (tex.image && tex.image.getContext && tex.image.getContext('2d'));
      if (!ctx) return;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.restore();
      fn(ctx, size, size);
      tex.needsUpdate = true;
    },
  };
}

function makePaintMaterial(THREE, tex, roughness = 0.42, clearcoat = 0.08) {
  return new THREE.MeshPhysicalMaterial({
    map: tex,
    color: 0xffffff,
    transparent: true,
    roughness,
    metalness: 0.0,
    clearcoat,
    clearcoatRoughness: 0.25,
    depthWrite: false,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

function getEyeShapeSpec(eyeShape) {
  switch (eyeShape) {
    case 'almond':
      return {
        inner: [-174, 20],
        outer: [176, -8],
        top: [12, -138],
        bot: [6, 128],
        u1c1: [-142, -96],
        u1c2: [-66, -138],
        u2c1: [92, -138],
        u2c2: [152, -88],
        l1c1: [146, 86],
        l1c2: [86, 128],
        l2c1: [-76, 128],
        l2c2: [-140, 92],
        wingLift: -20,
      };
    case 'droopy':
      return {
        inner: [-168, 4],
        outer: [172, 42],
        top: [-14, -148],
        bot: [10, 138],
        u1c1: [-144, -108],
        u1c2: [-84, -148],
        u2c1: [76, -148],
        u2c2: [146, -66],
        l1c1: [142, 118],
        l1c2: [84, 138],
        l2c1: [-76, 138],
        l2c2: [-146, 94],
        wingLift: 12,
      };
    case 'upturned':
      return {
        inner: [-174, 34],
        outer: [176, -30],
        top: [24, -142],
        bot: [4, 130],
        u1c1: [-144, -84],
        u1c2: [-58, -142],
        u2c1: [98, -142],
        u2c2: [154, -98],
        l1c1: [150, 74],
        l1c2: [86, 130],
        l2c1: [-78, 130],
        l2c2: [-144, 104],
        wingLift: -32,
      };
    case 'round':
    default:
      return {
        inner: [-164, 22],
        outer: [166, 12],
        top: [6, -158],
        bot: [4, 144],
        u1c1: [-148, -110],
        u1c2: [-72, -158],
        u2c1: [88, -158],
        u2c2: [152, -102],
        l1c1: [144, 102],
        l1c2: [82, 144],
        l2c1: [-74, 144],
        l2c2: [-140, 108],
        wingLift: -12,
      };
  }
}

function getInterpolatedEyeContour(shape, blinkAmt, upperSquint = 0, lowerSquint = 0) {
  const meetY = (shape.inner[1] + shape.outer[1]) * 0.5 + 48;
  const closedMid = [2, meetY + 18];
  const cU1c1 = [lerp(shape.inner[0], closedMid[0], 0.35), lerp(shape.inner[1], closedMid[1], 0.55) + 8];
  const cU1c2 = [lerp(shape.inner[0], closedMid[0], 0.72), closedMid[1]];
  const cU2c1 = [lerp(closedMid[0], shape.outer[0], 0.28), closedMid[1]];
  const cU2c2 = [lerp(closedMid[0], shape.outer[0], 0.65), lerp(closedMid[1], shape.outer[1], 0.45) + 8];

  const bu = clamp(blinkAmt + upperSquint * (1 - blinkAmt), 0, 1);
  const bl = clamp(blinkAmt + lowerSquint * (1 - blinkAmt), 0, 1);

  return {
    inner: shape.inner,
    outer: shape.outer,
    top: lerpPt(shape.top, closedMid, bu),
    u1c1: lerpPt(shape.u1c1, cU1c1, bu),
    u1c2: lerpPt(shape.u1c2, cU1c2, bu),
    u2c1: lerpPt(shape.u2c1, cU2c1, bu),
    u2c2: lerpPt(shape.u2c2, cU2c2, bu),
    bot: lerpPt(shape.bot, closedMid, bl),
    l1c1: lerpPt(shape.l1c1, cU2c2, bl),
    l1c2: lerpPt(shape.l1c2, cU2c1, bl),
    l2c1: lerpPt(shape.l2c1, cU1c2, bl),
    l2c2: lerpPt(shape.l2c2, cU1c1, bl),
  };
}

function evalCubic(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const a = mt2 * mt;
  const b = 3 * mt2 * t;
  const c = 3 * mt * t2;
  const d = t2 * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

function sampleUpperCurve(contour, u) {
  if (u <= 0.5) {
    return evalCubic(contour.inner, contour.u1c1, contour.u1c2, contour.top, u * 2);
  }
  return evalCubic(contour.top, contour.u2c1, contour.u2c2, contour.outer, (u - 0.5) * 2);
}

function sampleLowerCurve(contour, u) {
  if (u <= 0.5) {
    return evalCubic(contour.inner, contour.l2c2, contour.l2c1, contour.bot, u * 2);
  }
  return evalCubic(contour.bot, contour.l1c2, contour.l1c1, contour.outer, (u - 0.5) * 2);
}

function traceEyeOpeningPath(ctx, contour) {
  ctx.beginPath();
  ctx.moveTo(contour.inner[0], contour.inner[1]);
  ctx.bezierCurveTo(
    contour.u1c1[0], contour.u1c1[1],
    contour.u1c2[0], contour.u1c2[1],
    contour.top[0], contour.top[1]
  );
  ctx.bezierCurveTo(
    contour.u2c1[0], contour.u2c1[1],
    contour.u2c2[0], contour.u2c2[1],
    contour.outer[0], contour.outer[1]
  );
  ctx.bezierCurveTo(
    contour.l1c1[0], contour.l1c1[1],
    contour.l1c2[0], contour.l1c2[1],
    contour.bot[0], contour.bot[1]
  );
  ctx.bezierCurveTo(
    contour.l2c1[0], contour.l2c1[1],
    contour.l2c2[0], contour.l2c2[1],
    contour.inner[0], contour.inner[1]
  );
  ctx.closePath();
}

function drawTaperedRibbon(ctx, pts, widthFn, normalSign = -1) {
  const n = pts.length;
  const upper = [];
  const lower = [];

  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(n - 1, i + 1)];
    let tx = next[0] - prev[0];
    let ty = next[1] - prev[1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const nx = -ty * normalSign;
    const ny = tx * normalSign;
    const w = widthFn(t);
    upper.push([pts[i][0] + nx * w * 0.78, pts[i][1] + ny * w * 0.78]);
    lower.push([pts[i][0] - nx * w * 0.22, pts[i][1] - ny * w * 0.22]);
  }

  ctx.beginPath();
  ctx.moveTo(upper[0][0], upper[0][1]);
  for (let i = 1; i < n; i++) {
    ctx.lineTo(upper[i][0], upper[i][1]);
  }
  for (let i = n - 1; i >= 0; i--) {
    ctx.lineTo(lower[i][0], lower[i][1]);
  }
  ctx.closePath();
  ctx.fill();
}

function drawTaperedLash(ctx, baseX, baseY, ctrlX, ctrlY, tipX, tipY, baseHalfW) {
  const dx = ctrlX - baseX;
  const dy = ctrlY - baseY;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  ctx.beginPath();
  ctx.moveTo(baseX + nx * baseHalfW, baseY + ny * baseHalfW);
  ctx.quadraticCurveTo(ctrlX + nx * baseHalfW * 0.35, ctrlY + ny * baseHalfW * 0.35, tipX, tipY);
  ctx.quadraticCurveTo(ctrlX - nx * baseHalfW * 0.35, ctrlY - ny * baseHalfW * 0.35, baseX - nx * baseHalfW, baseY - ny * baseHalfW);
  ctx.closePath();
  ctx.fill();
}

function drawEyePatch(ctx, w, h, state, side, kit) {
  const { eyeColor, browColor, eyeShape, lashes, expression, blinkAmt } = state;
  const shape = getEyeShapeSpec(eyeShape);
  const lidColor = mixColor(darken(browColor, 0.72), { r: 28, g: 20, b: 22 }, 0.55);
  const softShadowColor = mixColor(darken(browColor, 0.35), { r: 145, g: 92, b: 86 }, 0.6);

  ctx.save();
  ctx.translate(w * 0.5, h * 0.5);

  if (expression === 'happy') {
    ctx.save();
    ctx.scale(side, 1);

    // Warm cheerful under-arc cheek glow
    const glow = ctx.createRadialGradient(0, 44, 12, 0, 44, 150);
    glow.addColorStop(0, 'rgba(235, 142, 148, 0.22)');
    glow.addColorStop(1, 'rgba(235, 142, 148, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(0, 44, 155, 80, 0, 0, Math.PI * 2);
    ctx.fill();

    // Upward smiling arc
    const pts = [];
    const steps = 32;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = evalCubic([-152, 22], [-76, -86], [76, -88], [156, 16], t);
      pts.push(p);
    }

    // Soft airbrushed liner shadow
    ctx.fillStyle = rgba(softShadowColor, 0.24);
    drawTaperedRibbon(ctx, pts, (t) => 12 + Math.sin(t * Math.PI) * 16 + t * 5, 1);

    // Main happy arc
    ctx.fillStyle = rgba(lidColor, 0.94);
    drawTaperedRibbon(ctx, pts, (t) => {
      const arch = Math.sin(t * Math.PI);
      return 4.5 + arch * 14 + Math.pow(t, 1.5) * 6.5;
    }, 1);

    // Delicate happy outer lashes
    if (lashes) {
      ctx.fillStyle = rgba(lidColor, 0.9);
      const lashPositions = [0.70, 0.80, 0.89, 0.96];
      lashPositions.forEach((lt, idx) => {
        const p = evalCubic([-152, 22], [-76, -86], [76, -88], [156, 16], lt);
        const len = 26 + idx * 8;
        const ang = -0.35 + idx * 0.14;
        const tipX = p[0] + Math.cos(ang) * len;
        const tipY = p[1] + Math.sin(ang) * len - 10;
        const cX = p[0] + Math.cos(ang) * len * 0.55;
        const cY = p[1] + Math.sin(ang) * len * 0.45 - 2;
        drawTaperedLash(ctx, p[0], p[1], cX, cY, tipX, tipY, 3.8 + idx * 0.4);
      });
    }

    // Soft lid crease above happy arc
    ctx.strokeStyle = rgba(softShadowColor, 0.34);
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-110, -34);
    ctx.quadraticCurveTo(0, -104, 118, -36);
    ctx.stroke();

    ctx.restore();
    ctx.restore();
    return;
  }

  if (expression === 'asleep' || blinkAmt >= 0.985) {
    ctx.save();
    ctx.scale(side, 1);

    // Soft peaceful eyelid shadow above closed arc
    const lidGrad = ctx.createRadialGradient(0, -10, 20, 0, 8, 175);
    lidGrad.addColorStop(0, rgba(softShadowColor, 0.22));
    lidGrad.addColorStop(0.65, rgba(softShadowColor, 0.08));
    lidGrad.addColorStop(1, rgba(softShadowColor, 0));
    ctx.fillStyle = lidGrad;
    ctx.beginPath();
    ctx.ellipse(0, 6, 175, 110, 0, 0, Math.PI * 2);
    ctx.fill();

    // Closed downward arc
    const pts = [];
    const steps = 32;
    const p0 = [-154, 10];
    const p1 = [-72, 92];
    const p2 = [76, 94];
    const p3 = [158, 14];
    for (let i = 0; i <= steps; i++) {
      pts.push(evalCubic(p0, p1, p2, p3, i / steps));
    }

    ctx.fillStyle = rgba(softShadowColor, 0.25);
    drawTaperedRibbon(ctx, pts, (t) => 10 + Math.sin(t * Math.PI) * 12, -1);

    ctx.fillStyle = rgba(lidColor, 0.94);
    drawTaperedRibbon(ctx, pts, (t) => {
      const mid = Math.sin(t * Math.PI);
      return 4 + mid * 11 + Math.pow(t, 1.6) * 7;
    }, 1);

    // Delicate downward lashes
    if (lashes) {
      ctx.fillStyle = rgba(lidColor, 0.88);
      const lashTs = [0.35, 0.48, 0.60, 0.72, 0.83, 0.92, 0.98];
      lashTs.forEach((lt, idx) => {
        const p = evalCubic(p0, p1, p2, p3, lt);
        const len = 22 + idx * 5.2;
        const spread = 0.2 + (lt - 0.35) * 1.1;
        const tipX = p[0] + Math.sin(spread) * len;
        const tipY = p[1] + Math.cos(spread * 0.65) * len * 0.88;
        const cX = p[0] + Math.sin(spread) * len * 0.45;
        const cY = p[1] + Math.cos(spread * 0.65) * len * 0.52;
        drawTaperedLash(ctx, p[0], p[1], cX, cY, tipX, tipY, 3.2 + idx * 0.35);
      });
    }

    // Soft double-eyelid crease
    ctx.strokeStyle = rgba(softShadowColor, 0.3);
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-118, -32);
    ctx.quadraticCurveTo(4, -76, 126, -26);
    ctx.stroke();

    ctx.restore();
    ctx.restore();
    return;
  }

  // Open eye (awake, thinking, unsure, or mid-blink)
  let gazeScreenX = 0;
  let gazeScreenY = 0;
  let upperSquint = 0;
  let lowerSquint = 0;

  if (expression === 'thinking') {
    gazeScreenX = 32;
    gazeScreenY = -26;
    lowerSquint = 0.14;
  } else if (expression === 'unsure') {
    gazeScreenX = -18;
    gazeScreenY = 8;
    upperSquint = 0.08;
    lowerSquint = 0.06;
  }

  const contour = getInterpolatedEyeContour(shape, blinkAmt, upperSquint, lowerSquint);

  // 1. Subtle airbrushed socket shading outside eye opening (anatomical space)
  ctx.save();
  ctx.scale(side, 1);
  const orbGrad = ctx.createRadialGradient(0, -14, 90, 0, -14, 215);
  orbGrad.addColorStop(0, rgba(softShadowColor, 0.14));
  orbGrad.addColorStop(0.75, rgba(softShadowColor, 0.06));
  orbGrad.addColorStop(1, rgba(softShadowColor, 0));
  ctx.fillStyle = orbGrad;
  ctx.beginPath();
  ctx.ellipse(0, -8, 215, 195, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Clipped interior of the eye opening
  ctx.save();
  ctx.scale(side, 1);
  traceEyeOpeningPath(ctx, contour);
  ctx.clip();

  // Sclera base
  const scleraGrad = ctx.createRadialGradient(0, 6, 30, 0, 6, 185);
  scleraGrad.addColorStop(0, '#fcfaf8');
  scleraGrad.addColorStop(0.78, '#f6f2ef');
  scleraGrad.addColorStop(1, '#e7d9d8');
  ctx.fillStyle = scleraGrad;
  ctx.fillRect(-230, -230, 460, 460);

  // Soft upper-lid shadow cast onto sclera
  const upperScleraShadow = ctx.createLinearGradient(0, contour.top[1], 0, contour.top[1] + 128);
  upperScleraShadow.addColorStop(0, 'rgba(92, 96, 128, 0.44)');
  upperScleraShadow.addColorStop(0.45, 'rgba(116, 118, 146, 0.18)');
  upperScleraShadow.addColorStop(1, 'rgba(130, 130, 155, 0)');
  ctx.fillStyle = upperScleraShadow;
  ctx.fillRect(-230, contour.top[1] - 20, 460, 160);

  // Subtle lower rim ambient shading
  const lowerScleraShadow = ctx.createLinearGradient(0, contour.bot[1], 0, contour.bot[1] - 48);
  lowerScleraShadow.addColorStop(0, 'rgba(150, 126, 132, 0.22)');
  lowerScleraShadow.addColorStop(1, 'rgba(150, 126, 132, 0)');
  ctx.fillStyle = lowerScleraShadow;
  ctx.fillRect(-230, contour.bot[1] - 54, 460, 70);

  // Iris position in flipped anatomical space (so screen gaze aligns for both eyes)
  const icx = gazeScreenX * side;
  const icy = 4 + gazeScreenY;
  const irX = 112;
  const irY = 120;

  // Iris clipped region
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(icx, icy, irX, irY, 0, 0, Math.PI * 2);
  ctx.clip();

  // Radial iris base gradient (dark rim -> rich mid -> lighter centre)
  const irisGrad = ctx.createRadialGradient(icx, icy + 14, 14, icx, icy, irY * 1.03);
  irisGrad.addColorStop(0.0, rgba(lighten(eyeColor, 0.46), 1));
  irisGrad.addColorStop(0.42, rgba(eyeColor, 1));
  irisGrad.addColorStop(0.76, rgba(darken(eyeColor, 0.36), 1));
  irisGrad.addColorStop(0.92, rgba(darken(eyeColor, 0.68), 1));
  irisGrad.addColorStop(1.0, rgba(darken(eyeColor, 0.82), 1));
  ctx.fillStyle = irisGrad;
  ctx.fillRect(icx - irX - 10, icy - irY - 10, (irX + 10) * 2, (irY + 10) * 2);

  // Luminous lower-iris glass-eye bounce crescent
  const bounceGrad = ctx.createRadialGradient(icx, icy + 54, 6, icx, icy + 52, 82);
  bounceGrad.addColorStop(0.0, rgba(lighten(eyeColor, 0.72), 0.74));
  bounceGrad.addColorStop(0.55, rgba(lighten(eyeColor, 0.42), 0.32));
  bounceGrad.addColorStop(1.0, rgba(lighten(eyeColor, 0.2), 0));
  ctx.fillStyle = bounceGrad;
  ctx.beginPath();
  ctx.ellipse(icx, icy + 48, 86, 62, 0, 0, Math.PI * 2);
  ctx.fill();

  // Radial iris streaks
  const streakCount = 60;
  for (let i = 0; i < streakCount; i++) {
    const ang = (i / streakCount) * Math.PI * 2;
    const n1 = safeNoise(kit, i * 0.37, 2.3);
    const n2 = safeNoise(kit, i * 0.71, 5.1);
    const rStart = 0.36 + n1 * 0.14;
    const rEnd = 0.80 + n2 * 0.15;
    const isLight = i % 2 === 0;
    const col = isLight ? lighten(eyeColor, 0.55 + n1 * 0.2) : darken(eyeColor, 0.55 + n2 * 0.2);

    ctx.strokeStyle = rgba(col, isLight ? 0.28 + n1 * 0.18 : 0.24 + n2 * 0.18);
    ctx.lineWidth = 2.0 + n2 * 3.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(icx + Math.cos(ang) * irX * rStart, icy + Math.sin(ang) * irY * rStart);
    ctx.lineTo(icx + Math.cos(ang) * irX * rEnd, icy + Math.sin(ang) * irY * rEnd);
    ctx.stroke();
  }

  // Soft lighter starburst collar around pupil
  const collarGrad = ctx.createRadialGradient(icx, icy, 34, icx, icy, 66);
  collarGrad.addColorStop(0, rgba(lighten(eyeColor, 0.6), 0.36));
  collarGrad.addColorStop(0.65, rgba(lighten(eyeColor, 0.3), 0.12));
  collarGrad.addColorStop(1, rgba(eyeColor, 0));
  ctx.fillStyle = collarGrad;
  ctx.beginPath();
  ctx.ellipse(icx, icy, 68, 72, 0, 0, Math.PI * 2);
  ctx.fill();

  // Large velvety pupil
  const prX = 50;
  const prY = 56;
  const pupilCol = darken(eyeColor, 0.90);
  const pupilGrad = ctx.createRadialGradient(icx, icy, 8, icx, icy, prY * 1.08);
  pupilGrad.addColorStop(0.0, rgba(pupilCol, 0.98));
  pupilGrad.addColorStop(0.84, rgba(pupilCol, 0.95));
  pupilGrad.addColorStop(1.0, rgba(pupilCol, 0));
  ctx.fillStyle = pupilGrad;
  ctx.beginPath();
  ctx.ellipse(icx, icy, prX * 1.06, prY * 1.06, 0, 0, Math.PI * 2);
  ctx.fill();

  // Upper iris shadow under eyelid
  const irisShadow = ctx.createLinearGradient(icx, icy - irY, icx, icy + 18);
  irisShadow.addColorStop(0.0, 'rgba(14, 18, 34, 0.72)');
  irisShadow.addColorStop(0.42, 'rgba(18, 22, 42, 0.40)');
  irisShadow.addColorStop(0.78, 'rgba(20, 26, 48, 0.08)');
  irisShadow.addColorStop(1.0, 'rgba(20, 26, 48, 0)');
  ctx.fillStyle = irisShadow;
  ctx.fillRect(icx - irX - 10, icy - irY - 10, (irX + 10) * 2, irY + 34);

  // Dark limbal outer ring
  ctx.strokeStyle = rgba(darken(eyeColor, 0.78), 0.85);
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.ellipse(icx, icy, irX - 3, irY - 3, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore(); // end iris clip

  // 3. Crisp white highlights in UN-flipped screen space (still clipped to eye opening!)
  ctx.save();
  ctx.scale(side, 1); // un-flip back to screen coords
  const scx = gazeScreenX;
  const scy = 4 + gazeScreenY;

  // Big upper-left highlight + subtle glow
  const hl1Glow = ctx.createRadialGradient(scx - 46, scy - 44, 6, scx - 46, scy - 44, 34);
  hl1Glow.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
  hl1Glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = hl1Glow;
  ctx.beginPath();
  ctx.arc(scx - 46, scy - 44, 34, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(scx - 46, scy - 44, 26, 19, -0.42, 0, Math.PI * 2);
  ctx.fill();

  // Tiny accent sparkle beside big highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.beginPath();
  ctx.arc(scx - 66, scy - 16, 6.2, 0, Math.PI * 2);
  ctx.fill();

  // Small lower-right highlight
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(scx + 44, scy + 42, 11.5, 9.2, -0.32, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore(); // end un-flipped highlights
  ctx.restore(); // end eye-opening clip

  // 4. Eyelid lines, crease, and lashes (anatomical space)
  ctx.save();
  ctx.scale(side, 1);

  const steps = 36;
  const upperPts = [];
  const lowerPts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    upperPts.push(sampleUpperCurve(contour, t));
    lowerPts.push(sampleLowerCurve(contour, t));
  }

  // Subtle double-eyelid crease above upper lid
  const creaseLift = lerp(30, 14, blinkAmt);
  ctx.strokeStyle = rgba(softShadowColor, 0.36);
  ctx.lineWidth = 4.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 4; i <= steps - 3; i++) {
    const t = i / steps;
    const p = upperPts[i];
    const lift = creaseLift * (0.65 + 0.45 * Math.sin(t * Math.PI));
    if (i === 4) ctx.moveTo(p[0], p[1] - lift);
    else ctx.lineTo(p[0], p[1] - lift);
  }
  ctx.stroke();

  // Thin lower lid line
  ctx.fillStyle = rgba(mixColor(lidColor, softShadowColor, 0.45), 0.72);
  drawTaperedRibbon(ctx, lowerPts, (t) => {
    const mid = Math.sin(t * Math.PI);
    return 1.2 + mid * 4.4 + Math.pow(t, 2) * 2.4;
  }, 1);

  // Soft outer-lower lash wisps if lashes enabled
  if (lashes && blinkAmt < 0.65) {
    ctx.fillStyle = rgba(mixColor(lidColor, softShadowColor, 0.35), 0.56 * (1 - blinkAmt));
    const lowerLashTs = [0.64, 0.75, 0.86];
    lowerLashTs.forEach((lt, idx) => {
      const p = sampleLowerCurve(contour, lt);
      const len = 14 + idx * 4;
      const tipX = p[0] + len * (0.45 + idx * 0.14);
      const tipY = p[1] + len * 0.85;
      drawTaperedLash(ctx, p[0], p[1], p[0] + len * 0.25, p[1] + len * 0.45, tipX, tipY, 2.0);
    });
  }

  // Soft smudged eyeliner halo along upper lid
  ctx.fillStyle = rgba(softShadowColor, 0.24);
  drawTaperedRibbon(ctx, upperPts, (t) => 12 + Math.pow(t, 1.1) * 18 + Math.sin(t * Math.PI) * 10, -1);

  // Extend upper lid subtly into an outer wing
  const wingEnd = [
    contour.outer[0] + 18,
    contour.outer[1] + lerp(shape.wingLift * 0.45, 8, blinkAmt),
  ];
  const upperWithWing = upperPts.concat([
    [lerp(contour.outer[0], wingEnd[0], 0.55), lerp(contour.outer[1], wingEnd[1], 0.5)],
    wingEnd,
  ]);

  // Darker upper lid line that thickens outward
  ctx.fillStyle = rgba(lidColor, 0.96);
  drawTaperedRibbon(ctx, upperWithWing, (t) => {
    if (t > 0.94) {
      const w = (1 - (t - 0.94) / 0.06);
      return Math.max(1.5, 22 * w);
    }
    const arch = Math.sin(t * Math.PI);
    return 5.5 + arch * 11 + Math.pow(t, 1.35) * 14.5;
  }, -1);

  // Upper eyelashes as tapered strokes
  if (lashes) {
    ctx.fillStyle = rgba(lidColor, 0.92);
    const lashTs = [0.36, 0.47, 0.57, 0.67, 0.77, 0.86, 0.94];
    lashTs.forEach((lt, idx) => {
      const p = sampleUpperCurve(contour, lt);
      const pNext = sampleUpperCurve(contour, Math.min(1, lt + 0.02));
      const tx = pNext[0] - p[0];
      const ty = pNext[1] - p[1];
      const tLen = Math.hypot(tx, ty) || 1;
      // Outward-upward normal of upper lid
      let nx = ty / tLen;
      let ny = -tx / tLen;
      // Blend toward outward +x and slightly downward as blink closes
      const sweepX = lerp(nx * 0.55 + 0.68, 0.55 + lt * 0.35, blinkAmt);
      const sweepY = lerp(ny * 0.72 - 0.18 + shape.wingLift * 0.008, 0.55, blinkAmt);
      const sLen = Math.hypot(sweepX, sweepY) || 1;
      const dirX = sweepX / sLen;
      const dirY = sweepY / sLen;

      const lashLen = 22 + idx * 5.8 + (idx === lashTs.length - 1 ? 6 : 0);
      const cX = p[0] + dirX * lashLen * 0.52;
      const cY = p[1] + dirY * lashLen * 0.44 + lerp(5, -2, blinkAmt);
      const tipX = p[0] + dirX * lashLen;
      const tipY = p[1] + dirY * lashLen + lerp(-7, 6, blinkAmt);

      drawTaperedLash(ctx, p[0], p[1] - 4, cX, cY, tipX, tipY, 3.0 + idx * 0.38);
    });
  }

  ctx.restore();
  ctx.restore();
}

function drawEyeDomeAlphaMap(ctx, w, h, eyeShape, side) {
  const shape = getEyeShapeSpec(eyeShape);
  const contour = getInterpolatedEyeContour(shape, 0);

  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);

  ctx.translate(w * 0.5, h * 0.5);
  ctx.scale(side, 1);

  // Softly feathered white mask matching the eye opening scaled to dome patch bounds
  const scaleX = EYE_DTHETA / 0.48;
  const scaleY = EYE_DPHI / 0.44;
  ctx.scale(scaleX, scaleY);

  const layers = [
    { s: 1.03, a: 0.25 },
    { s: 0.98, a: 0.55 },
    { s: 0.92, a: 0.85 },
    { s: 0.86, a: 1.0 },
  ];
  for (const layer of layers) {
    ctx.save();
    ctx.scale(layer.s, layer.s);
    traceEyeOpeningPath(ctx, contour);
    ctx.fillStyle = `rgba(255,255,255,${layer.a})`;
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawBrowPatch(ctx, w, h, state, side, kit) {
  const { brow, browColor, expression } = state;

  let p0 = [-182, 22];
  let p1 = [-40, -34];
  let p2 = [76, -34];
  let p3 = [184, 16];

  if (brow === 'straight') {
    p0 = [-182, 10];
    p1 = [-46, -6];
    p2 = [68, -8];
    p3 = [184, 6];
  } else if (brow === 'arched') {
    p0 = [-184, 28];
    p1 = [-28, -46];
    p2 = [74, -56];
    p3 = [184, 12];
  }

  // Expression modifications
  if (expression === 'happy') {
    p0 = [p0[0], p0[1] - 12];
    p1 = [p1[0], p1[1] - 24];
    p2 = [p2[0], p2[1] - 26];
    p3 = [p3[0], p3[1] - 14];
  } else if (expression === 'asleep') {
    p0 = [p0[0], p0[1] + 16];
    p1 = [p1[0], p1[1] + 18];
    p2 = [p2[0], p2[1] + 18];
    p3 = [p3[0], p3[1] + 14];
  } else if (expression === 'thinking') {
    if (side > 0) {
      // One brow raised (doll's left / viewer's right)
      p0 = [p0[0], p0[1] - 22];
      p1 = [p1[0], p1[1] - 48];
      p2 = [p2[0], p2[1] - 54];
      p3 = [p3[0], p3[1] - 24];
    } else {
      // Other brow relaxed / slightly furrowed
      p0 = [p0[0], p0[1] + 22];
      p1 = [p1[0], p1[1] + 10];
      p2 = [p2[0], p2[1] + 4];
      p3 = [p3[0], p3[1] + 8];
    }
  } else if (expression === 'unsure') {
    // Both brows tilted worriedly: inner up, outer down
    p0 = [p0[0], p0[1] - 34];
    p1 = [p1[0], p1[1] - 8];
    p2 = [p2[0], p2[1] + 16];
    p3 = [p3[0], p3[1] + 34];
  }

  ctx.save();
  ctx.translate(w * 0.5, h * 0.5);
  ctx.scale(side, 1);

  const steps = 32;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    pts.push(evalCubic(p0, p1, p2, p3, i / steps));
  }

  // Soft wide under-wash
  ctx.fillStyle = rgba(lighten(browColor, 0.14), 0.24);
  drawTaperedRibbon(ctx, pts, (t) => {
    const start = Math.pow(Math.min(1, t / 0.14), 0.65);
    const tail = Math.pow(1 - t, 0.72);
    return 4 + 30 * start * tail;
  }, 1);

  // Main soft tapered brow body
  ctx.fillStyle = rgba(browColor, 0.80);
  drawTaperedRibbon(ctx, pts, (t) => {
    const start = Math.pow(Math.min(1, t / 0.12), 0.7);
    const tail = Math.pow(1 - t, 0.85);
    return 2.5 + 21 * start * tail;
  }, 1);

  // Fine painted brow hair strokes for face-up texture
  const hairCount = 24;
  ctx.lineCap = 'round';
  for (let i = 0; i < hairCount; i++) {
    const t = 0.05 + (i / (hairCount - 1)) * 0.88;
    const p = evalCubic(p0, p1, p2, p3, t);
    const pN = evalCubic(p0, p1, p2, p3, Math.min(1, t + 0.04));
    const dx = pN[0] - p[0];
    const dy = pN[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    const n = safeNoise(kit, i * 0.53, side * 3.1);
    const hairLen = (14 + n * 10) * (1 - t * 0.5);
    const spreadY = (n - 0.5) * 10 * (1 - t * 0.6);

    ctx.strokeStyle = rgba(i % 3 === 0 ? darken(browColor, 0.25) : browColor, 0.42 + n * 0.28);
    ctx.lineWidth = 2.4 + (1 - t) * 2.2;
    ctx.beginPath();
    ctx.moveTo(p[0] - (dx / len) * hairLen * 0.35, p[1] + spreadY + 3);
    ctx.lineTo(p[0] + (dx / len) * hairLen * 0.65, p[1] + spreadY - 4 + (dy / len) * hairLen * 0.4);
    ctx.stroke();
  }

  ctx.restore();
}

function drawNosePatch(ctx, w, h) {
  ctx.save();
  ctx.translate(w * 0.5, h * 0.5);

  // Tiny soft warm highlight on button nose tip
  const tipHL = ctx.createRadialGradient(0, -18, 4, 0, -18, 56);
  tipHL.addColorStop(0, 'rgba(255, 244, 238, 0.26)');
  tipHL.addColorStop(1, 'rgba(255, 244, 238, 0)');
  ctx.fillStyle = tipHL;
  ctx.beginPath();
  ctx.ellipse(0, -18, 56, 34, 0, 0, Math.PI * 2);
  ctx.fill();

  // Soft tiny crescent shadow directly beneath the nose tip
  const shadowGrad = ctx.createRadialGradient(0, 14, 4, 0, 14, 62);
  shadowGrad.addColorStop(0.0, 'rgba(148, 92, 86, 0.36)');
  shadowGrad.addColorStop(0.55, 'rgba(156, 100, 94, 0.16)');
  shadowGrad.addColorStop(1.0, 'rgba(156, 100, 94, 0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(0, 14, 62, 24, 0, 0, Math.PI * 2);
  ctx.fill();

  // Whisper-soft nostril dimple accents
  for (const sx of [-24, 24]) {
    const nGrad = ctx.createRadialGradient(sx, 14, 1, sx, 14, 16);
    nGrad.addColorStop(0, 'rgba(132, 78, 74, 0.26)');
    nGrad.addColorStop(1, 'rgba(132, 78, 74, 0)');
    ctx.fillStyle = nGrad;
    ctx.beginPath();
    ctx.ellipse(sx, 14, 16, 8, sx < 0 ? 0.2 : -0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawMouthPatch(ctx, w, h, state) {
  const { lipColor, expression } = state;
  const darkLine = darken(lipColor, 0.56);
  const softLip = lighten(lipColor, 0.18);
  const highlightCol = lighten(lipColor, 0.78);

  ctx.save();
  ctx.translate(w * 0.5, h * 0.5);

  if (expression === 'happy') {
    // Soft upper & lower lip rosy blush
    const glow = ctx.createRadialGradient(0, 6, 16, 0, 6, 150);
    glow.addColorStop(0, rgba(lipColor, 0.42));
    glow.addColorStop(0.65, rgba(softLip, 0.20));
    glow.addColorStop(1, rgba(softLip, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(0, 8, 150, 74, 0, 0, Math.PI * 2);
    ctx.fill();

    // Plump lower lip shape
    const lowerGrad = ctx.createRadialGradient(0, 32, 10, 0, 30, 96);
    lowerGrad.addColorStop(0, rgba(lipColor, 0.78));
    lowerGrad.addColorStop(0.68, rgba(lipColor, 0.45));
    lowerGrad.addColorStop(1, rgba(lipColor, 0));
    ctx.fillStyle = lowerGrad;
    ctx.beginPath();
    ctx.ellipse(0, 28, 96, 40, 0, 0, Math.PI * 2);
    ctx.fill();

    // Upper lip soft bow
    const upperGrad = ctx.createRadialGradient(0, -4, 8, 0, -4, 96);
    upperGrad.addColorStop(0, rgba(lipColor, 0.68));
    upperGrad.addColorStop(0.75, rgba(lipColor, 0.26));
    upperGrad.addColorStop(1, rgba(lipColor, 0));
    ctx.fillStyle = upperGrad;
    ctx.beginPath();
    ctx.ellipse(0, -2, 102, 28, 0, 0, Math.PI * 2);
    ctx.fill();

    // Darker smiling centre line
    const pts = [];
    for (let i = 0; i <= 28; i++) {
      pts.push(evalCubic([-128, -24], [-56, 26], [56, 26], [128, -24], i / 28));
    }
    ctx.fillStyle = rgba(darkLine, 0.90);
    drawTaperedRibbon(ctx, pts, (t) => 2.2 + Math.sin(t * Math.PI) * 7.5, 1);

    // Cute dimple dots at smile corners
    for (const sx of [-130, 130]) {
      const dg = ctx.createRadialGradient(sx, -24, 1, sx, -24, 14);
      dg.addColorStop(0, rgba(darkLine, 0.34));
      dg.addColorStop(1, rgba(darkLine, 0));
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.arc(sx, -24, 14, 0, Math.PI * 2);
      ctx.fill();
    }

    // Lighter lower-lip highlight
    const hlGrad = ctx.createRadialGradient(0, 36, 4, 0, 36, 52);
    hlGrad.addColorStop(0, rgba(highlightCol, 0.85));
    hlGrad.addColorStop(0.6, rgba(highlightCol, 0.35));
    hlGrad.addColorStop(1, rgba(highlightCol, 0));
    ctx.fillStyle = hlGrad;
    ctx.beginPath();
    ctx.ellipse(0, 36, 52, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
    ctx.beginPath();
    ctx.ellipse(-10, 34, 18, 5, -0.06, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    return;
  }

  if (expression === 'unsure') {
    // Soft lip tint following wavy line
    const baseGrad = ctx.createRadialGradient(0, 4, 14, 0, 4, 126);
    baseGrad.addColorStop(0, rgba(lipColor, 0.64));
    baseGrad.addColorStop(0.65, rgba(softLip, 0.28));
    baseGrad.addColorStop(1, rgba(softLip, 0));
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.ellipse(0, 4, 126, 52, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wavy centre line
    const pts = [];
    for (let i = 0; i <= 32; i++) {
      const t = i / 32;
      const x = lerp(-102, 102, t);
      const wave = Math.sin(t * Math.PI * 2.5 - 0.35) * 14 * Math.sin(t * Math.PI);
      pts.push([x, wave]);
    }
    ctx.fillStyle = rgba(darkLine, 0.88);
    drawTaperedRibbon(ctx, pts, (t) => 2.2 + Math.sin(t * Math.PI) * 5.8, 1);

    // Lower-lip highlight
    const hlGrad = ctx.createRadialGradient(6, 22, 3, 6, 22, 40);
    hlGrad.addColorStop(0, rgba(highlightCol, 0.78));
    hlGrad.addColorStop(1, rgba(highlightCol, 0));
    ctx.fillStyle = hlGrad;
    ctx.beginPath();
    ctx.ellipse(6, 22, 40, 12, -0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    return;
  }

  if (expression === 'thinking') {
    // Small pursed thoughtful mouth, subtly shifted
    ctx.translate(16, 4);

    const lipGrad = ctx.createRadialGradient(0, 4, 10, 0, 4, 86);
    lipGrad.addColorStop(0, rgba(lipColor, 0.72));
    lipGrad.addColorStop(0.62, rgba(softLip, 0.34));
    lipGrad.addColorStop(1, rgba(softLip, 0));
    ctx.fillStyle = lipGrad;
    ctx.beginPath();
    ctx.ellipse(0, 4, 86, 44, -0.05, 0, Math.PI * 2);
    ctx.fill();

    const pts = [];
    for (let i = 0; i <= 24; i++) {
      pts.push(evalCubic([-66, 6], [-22, -6], [24, -4], [64, -10], i / 24));
    }
    ctx.fillStyle = rgba(darkLine, 0.88);
    drawTaperedRibbon(ctx, pts, (t) => 2.2 + Math.sin(t * Math.PI) * 6.2, 1);

    const hlGrad = ctx.createRadialGradient(0, 18, 3, 0, 18, 34);
    hlGrad.addColorStop(0, rgba(highlightCol, 0.84));
    hlGrad.addColorStop(1, rgba(highlightCol, 0));
    ctx.fillStyle = hlGrad;
    ctx.beginPath();
    ctx.ellipse(0, 18, 34, 12, -0.05, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.ellipse(-6, 17, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    return;
  }

  // "awake" & "asleep": classic soft rosebud doll mouth
  const asleep = expression === 'asleep';
  const widthScale = asleep ? 0.82 : 1.0;

  // Soft chin shadow beneath lower lip
  const chinSh = ctx.createRadialGradient(0, 44, 6, 0, 44, 62 * widthScale);
  chinSh.addColorStop(0, 'rgba(145, 90, 88, 0.18)');
  chinSh.addColorStop(1, 'rgba(145, 90, 88, 0)');
  ctx.fillStyle = chinSh;
  ctx.beginPath();
  ctx.ellipse(0, 44, 62 * widthScale, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Soft outer lip airbrushed tint
  const outerTint = ctx.createRadialGradient(0, 4, 16, 0, 4, 122 * widthScale);
  outerTint.addColorStop(0, rgba(lipColor, asleep ? 0.48 : 0.56));
  outerTint.addColorStop(0.62, rgba(softLip, 0.24));
  outerTint.addColorStop(1, rgba(softLip, 0));
  ctx.fillStyle = outerTint;
  ctx.beginPath();
  ctx.ellipse(0, 4, 122 * widthScale, 54, 0, 0, Math.PI * 2);
  ctx.fill();

  // Upper lip Cupid's bow lobes
  for (const sx of [-26 * widthScale, 26 * widthScale]) {
    const uGrad = ctx.createRadialGradient(sx, -10, 4, sx, -10, 48 * widthScale);
    uGrad.addColorStop(0, rgba(lipColor, asleep ? 0.58 : 0.72));
    uGrad.addColorStop(0.7, rgba(lipColor, 0.24));
    uGrad.addColorStop(1, rgba(lipColor, 0));
    ctx.fillStyle = uGrad;
    ctx.beginPath();
    ctx.ellipse(sx, -10, 48 * widthScale, 22, sx < 0 ? -0.18 : 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Plump lower lip cushion
  const lGrad = ctx.createRadialGradient(0, 20, 8, 0, 20, 74 * widthScale);
  lGrad.addColorStop(0, rgba(lipColor, asleep ? 0.65 : 0.80));
  lGrad.addColorStop(0.68, rgba(lipColor, 0.36));
  lGrad.addColorStop(1, rgba(lipColor, 0));
  ctx.fillStyle = lGrad;
  ctx.beginPath();
  ctx.ellipse(0, 20, 74 * widthScale, 32, 0, 0, Math.PI * 2);
  ctx.fill();

  // Darker centre parting line
  const halfW = 104 * widthScale;
  const liftY = asleep ? 0 : -6;
  const pts = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    const p = t <= 0.5
      ? evalCubic([-halfW, liftY], [-halfW * 0.55, 7], [-halfW * 0.22, 1], [0, 5], t * 2)
      : evalCubic([0, 5], [halfW * 0.22, 1], [halfW * 0.55, 7], [halfW, liftY], (t - 0.5) * 2);
    pts.push(p);
  }
  ctx.fillStyle = rgba(darkLine, asleep ? 0.72 : 0.88);
  drawTaperedRibbon(ctx, pts, (t) => 1.8 + Math.sin(t * Math.PI) * (asleep ? 4.8 : 6.2), 1);

  // Subtle corner shadow dots
  for (const sx of [-halfW - 2, halfW + 2]) {
    const cg = ctx.createRadialGradient(sx, liftY, 1, sx, liftY, 12);
    cg.addColorStop(0, rgba(darkLine, asleep ? 0.2 : 0.32));
    cg.addColorStop(1, rgba(darkLine, 0));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(sx, liftY, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lighter lower-lip highlight
  const hlGrad = ctx.createRadialGradient(0, 24, 4, 0, 24, 44 * widthScale);
  hlGrad.addColorStop(0, rgba(highlightCol, asleep ? 0.68 : 0.86));
  hlGrad.addColorStop(0.6, rgba(highlightCol, 0.32));
  hlGrad.addColorStop(1, rgba(highlightCol, 0));
  ctx.fillStyle = hlGrad;
  ctx.beginPath();
  ctx.ellipse(0, 24, 44 * widthScale, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Soft glossy sheen on lower lip
  ctx.fillStyle = `rgba(255, 255, 255, ${asleep ? 0.32 : 0.52})`;
  ctx.beginPath();
  ctx.ellipse(-8 * widthScale, 22, 15 * widthScale, 4.5, -0.05, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBlushPatch(ctx, w, h, blushColor, intensity = 1) {
  ctx.save();
  ctx.translate(w * 0.5, h * 0.5);

  const peak = clamp(0.36 * intensity, 0, 0.55);
  const grad = ctx.createRadialGradient(0, 0, 12, 0, 0, 198);
  grad.addColorStop(0.0, rgba(blushColor, peak));
  grad.addColorStop(0.42, rgba(blushColor, peak * 0.66));
  grad.addColorStop(0.74, rgba(blushColor, peak * 0.22));
  grad.addColorStop(1.0, rgba(blushColor, 0));

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, 206, 156, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawFrecklesPatch(ctx, w, h, kit) {
  ctx.save();

  const warmBrown = { r: 150, g: 88, b: 58 };
  const deepBrown = { r: 126, g: 72, b: 48 };
  const total = 68;

  for (let i = 0; i < total; i++) {
    const n1 = safeNoise(kit, i * 1.13 + 0.7, 3.9);
    const n2 = safeNoise(kit, i * 2.41 + 4.1, 7.3);
    const n3 = safeNoise(kit, i * 0.89 + 9.2, 1.4);
    const n4 = safeNoise(kit, i * 3.17 + 2.5, 5.8);

    // Distribute organically across nose bridge and both cheeks
    let nx;
    if (i < 16) {
      // Nose bridge cluster
      nx = 0.5 + (n1 - 0.5) * 0.22;
    } else if (i % 2 === 0) {
      // Left cheek
      nx = 0.63 + (n1 - 0.35) * 0.36;
    } else {
      // Right cheek
      nx = 0.37 - (n1 - 0.35) * 0.36;
    }

    const ny = 0.48 + (n2 - 0.5) * 0.44 + Math.abs(nx - 0.5) * 0.16;
    const x = clamp(nx, 0.08, 0.92) * w;
    const y = clamp(ny, 0.16, 0.86) * h;
    const r = 2.6 + n3 * 4.2;
    const col = mixColor(warmBrown, deepBrown, n4);
    const alpha = 0.24 + n3 * 0.28;

    const dg = ctx.createRadialGradient(x, y, 0.4, x, y, r);
    dg.addColorStop(0.0, rgba(col, alpha));
    dg.addColorStop(0.65, rgba(col, alpha * 0.55));
    dg.addColorStop(1.0, rgba(col, 0));

    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.ellipse(x, y, r * (0.85 + n4 * 0.3), r * (0.8 + n1 * 0.25), n2 * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function updateEyeDomes(state) {
  const closed = state.expression === 'happy' || state.expression === 'asleep';
  const openFactor = closed ? 0 : Math.pow(1 - clamp(state.blinkAmt, 0, 1), 2);
  const visible = openFactor > 0.02;
  for (const dome of state.eyeDomes) {
    dome.visible = visible;
    dome.material.opacity = 0.72 * openFactor;
  }
}

export function buildFace(THREE, opts = {}, kit = {}) {
  const group = new THREE.Group();
  group.name = 'face';

  const eyeColor = parseColor(opts.eye, '#4a7cb5');
  const lipColor = parseColor(opts.lip, '#d97b84');
  const browColor = parseColor(opts.browColor || opts.hair, '#5a3d2b');
  const blushColor = mixColor(parseColor(opts.blushColor, '#f28b94'), lipColor, 0.22);

  const eyeShape = ['round', 'almond', 'droopy', 'upturned'].includes(opts.eyeShape)
    ? opts.eyeShape
    : 'round';
  const brow = ['soft', 'straight', 'arched'].includes(opts.brow)
    ? opts.brow
    : 'soft';
  const showBlush = opts.blush !== undefined ? Boolean(opts.blush) : true;
  const showFreckles = Boolean(opts.freckles);
  const showLashes = opts.lashes !== undefined ? Boolean(opts.lashes) : true;

  const state = {
    eyeColor,
    lipColor,
    browColor,
    blushColor,
    eyeShape,
    brow,
    lashes: showLashes,
    expression: 'awake',
    blinkAmt: 0,
    lastBlink: 0,
    kit,
    eyes: [],
    brows: [],
    eyeDomes: [],
    blushes: [],
    mouth: null,
  };

  // 1. Cheek Blush (renderOrder 1, offset 0.0040)
  if (showBlush) {
    for (const side of [1, -1]) {
      const dyn = makeDynamicTexture(THREE, kit, PATCH_SIZE, (ctx, w, h) => {
        drawBlushPatch(ctx, w, h, blushColor, 1.0);
      });
      const geo = makeEllipsoidPatchGeometry(
        THREE,
        side * 0.52,
        -0.37,
        0.50,
        0.36,
        0.0040,
        32,
        32
      );
      const mat = makePaintMaterial(THREE, dyn.tex, 0.62, 0.04);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = side > 0 ? 'blushL' : 'blushR';
      mesh.renderOrder = 1;
      mesh.userData.slot = 'blush';
      group.add(mesh);
      state.blushes.push({ dyn, mesh });
    }
  }

  // 2. Freckles (renderOrder 2, offset 0.0042)
  if (showFreckles) {
    const dyn = makeDynamicTexture(THREE, kit, PATCH_SIZE, (ctx, w, h) => {
      drawFrecklesPatch(ctx, w, h, kit);
    });
    const geo = makeEllipsoidPatchGeometry(
      THREE,
      0,
      -0.35,
      1.42,
      0.30,
      0.0042,
      36,
      32
    );
    const mat = makePaintMaterial(THREE, dyn.tex, 0.58, 0.04);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'freckles';
    mesh.renderOrder = 2;
    mesh.userData.slot = 'freckles';
    group.add(mesh);
  }

  // 3. Nose tip shadow (renderOrder 3, offset 0.0044)
  {
    const dyn = makeDynamicTexture(THREE, kit, PATCH_SIZE, (ctx, w, h) => {
      drawNosePatch(ctx, w, h);
    });
    const geo = makeEllipsoidPatchGeometry(
      THREE,
      0,
      -0.33,
      0.24,
      0.18,
      0.0044,
      32,
      32
    );
    const mat = makePaintMaterial(THREE, dyn.tex, 0.58, 0.04);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'nose';
    mesh.renderOrder = 3;
    mesh.userData.slot = 'nose';
    group.add(mesh);
  }

  // 4. Mouth (renderOrder 4, offset 0.0046)
  {
    const dyn = makeDynamicTexture(THREE, kit, PATCH_SIZE, (ctx, w, h) => {
      drawMouthPatch(ctx, w, h, state);
    });
    const geo = makeEllipsoidPatchGeometry(
      THREE,
      0,
      -0.58,
      0.44,
      0.28,
      0.0046,
      32,
      32
    );
    const mat = makePaintMaterial(THREE, dyn.tex, 0.28, 0.45);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'mouth';
    mesh.renderOrder = 4;
    mesh.userData.slot = 'lip';
    group.add(mesh);
    state.mouth = { dyn, mesh };
  }

  // 5. Painted Eyes & Clear Glossy Cornea Domes (renderOrder 5 & 7)
  for (const side of [1, -1]) {
    const dyn = makeDynamicTexture(THREE, kit, PATCH_SIZE, (ctx, w, h) => {
      drawEyePatch(ctx, w, h, state, side, kit);
    });
    const eyeGeo = makeEllipsoidPatchGeometry(
      THREE,
      side * EYE_THETA,
      EYE_PHI,
      EYE_DTHETA,
      EYE_DPHI,
      0.0048,
      32,
      32
    );
    const eyeMat = makePaintMaterial(THREE, dyn.tex, 0.22, 0.35);
    const eyeMesh = new THREE.Mesh(eyeGeo, eyeMat);
    eyeMesh.name = side > 0 ? 'eyeL' : 'eyeR';
    eyeMesh.renderOrder = 5;
    eyeMesh.userData.slot = 'eye';
    group.add(eyeMesh);
    state.eyes.push({ side, dyn, mesh: eyeMesh });

    // Separate clear glossy dome over each eye for a wet resin/glass look
    const domeGeo = makeEllipsoidPatchGeometry(
      THREE,
      side * EYE_THETA,
      EYE_PHI,
      0.48,
      0.44,
      0.0052,
      36,
      36,
      (u, v) => {
        const du = (u - 0.5) / 0.44;
        const dv = (v - 0.5) / 0.44;
        const r2 = du * du + dv * dv;
        return r2 < 1 ? 0.0042 * Math.pow(1 - r2, 1.35) : 0;
      }
    );
    const alphaMask = makeDynamicTexture(
      THREE,
      kit,
      256,
      (ctx, w, h) => {
        drawEyeDomeAlphaMap(ctx, w, h, eyeShape, side);
      },
      false
    );
    const domeMat = new THREE.MeshPhysicalMaterial({
      color: 0x000000,
      alphaMap: alphaMask.tex,
      transparent: true,
      opacity: 0.72,
      roughness: 0.025,
      metalness: 0.0,
      ior: 1.52,
      reflectivity: 1.0,
      specularIntensity: 1.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
    const domeMesh = new THREE.Mesh(domeGeo, domeMat);
    domeMesh.name = side > 0 ? 'eyeDomeL' : 'eyeDomeR';
    domeMesh.renderOrder = 7;
    domeMesh.userData.slot = 'eyeGloss';
    group.add(domeMesh);
    state.eyeDomes.push(domeMesh);
  }

  // 6. Eyebrows (renderOrder 6, offset 0.0048)
  for (const side of [1, -1]) {
    const dyn = makeDynamicTexture(THREE, kit, PATCH_SIZE, (ctx, w, h) => {
      drawBrowPatch(ctx, w, h, state, side, kit);
    });
    const browGeo = makeEllipsoidPatchGeometry(
      THREE,
      side * 0.39,
      0.165,
      0.54,
      0.28,
      0.0048,
      32,
      32
    );
    const browMat = makePaintMaterial(THREE, dyn.tex, 0.52, 0.06);
    const browMesh = new THREE.Mesh(browGeo, browMat);
    browMesh.name = side > 0 ? 'browL' : 'browR';
    browMesh.renderOrder = 6;
    browMesh.userData.slot = 'brow';
    group.add(browMesh);
    state.brows.push({ side, dyn, mesh: browMesh });
  }

  group.userData._faceState = state;
  return group;
}

export function setExpression(group, name) {
  const state = group && group.userData && group.userData._faceState;
  if (!state) return;

  const valid = ['awake', 'happy', 'asleep', 'thinking', 'unsure'];
  const expr = valid.includes(name) ? name : 'awake';

  state.expression = expr;
  state.blinkAmt = 0;
  state.lastBlink = 0;

  for (const eye of state.eyes) {
    eye.dyn.redraw((ctx, w, h) => drawEyePatch(ctx, w, h, state, eye.side, state.kit));
  }
  for (const brow of state.brows) {
    brow.dyn.redraw((ctx, w, h) => drawBrowPatch(ctx, w, h, state, brow.side, state.kit));
  }
  if (state.mouth) {
    state.mouth.dyn.redraw((ctx, w, h) => drawMouthPatch(ctx, w, h, state));
  }
  for (const b of state.blushes) {
    const intensity = expr === 'happy' ? 1.18 : 1.0;
    b.dyn.redraw((ctx, w, h) => drawBlushPatch(ctx, w, h, state.blushColor, intensity));
  }

  updateEyeDomes(state);
}

export function blink(group, t) {
  const state = group && group.userData && group.userData._faceState;
  if (!state) return;

  if (state.expression === 'asleep' || state.expression === 'happy') {
    if (state.lastBlink !== 0) {
      state.blinkAmt = 0;
      state.lastBlink = 0;
      updateEyeDomes(state);
    }
    return;
  }

  // Natural non-uniform blink intervals (seconds)
  const intervals = [3.8, 4.6, 3.2, 5.1, 3.9];
  const cycleLen = 20.6;
  const time = Number.isFinite(t) ? t : 0;
  let local = ((time % cycleLen) + cycleLen) % cycleLen;

  let elapsed = local;
  for (let i = 0; i < intervals.length; i++) {
    if (elapsed < intervals[i]) break;
    elapsed -= intervals[i];
  }

  const blinkStart = 2.4;
  const dt = elapsed - blinkStart;
  let b = 0;
  if (dt >= 0 && dt < 0.19) {
    if (dt < 0.065) {
      const u = dt / 0.065;
      b = u * u;
    } else if (dt < 0.095) {
      b = 1;
    } else {
      const u = (dt - 0.095) / 0.095;
      b = (1 - u) * (1 - u);
    }
  }

  const changed =
    Math.abs(b - state.lastBlink) > 0.015 ||
    (b === 0 && state.lastBlink !== 0) ||
    (b === 1 && state.lastBlink !== 1);

  if (!changed) return;

  state.blinkAmt = b;
  state.lastBlink = b;

  for (const eye of state.eyes) {
    eye.dyn.redraw((ctx, w, h) => drawEyePatch(ctx, w, h, state, eye.side, state.kit));
  }
  updateEyeDomes(state);
}
const FACE_W = 2048;
const FACE_H = 1024;
const LID_COLOR = "#3a2a26";

const WIDTH_KNOTS = [
  [-1.0, 0.66],
  [-0.9, 0.78],
  [-0.6, 0.98],
  [-0.25, 1.06],
  [0.35, 1.0],
  [1.0, 0.94],
];

const FRECKLE_PTS = [
  [-0.08, -0.22, 2.8, 0.42],
  [0.0, -0.21, 2.5, 0.36],
  [0.09, -0.23, 2.9, 0.42],
  [-0.24, -0.27, 3.3, 0.46],
  [-0.33, -0.25, 2.7, 0.38],
  [-0.38, -0.31, 3.6, 0.48],
  [-0.47, -0.28, 3.1, 0.42],
  [-0.53, -0.33, 2.6, 0.36],
  [-0.29, -0.33, 2.5, 0.38],
  [0.25, -0.26, 3.2, 0.45],
  [0.34, -0.24, 2.8, 0.40],
  [0.40, -0.31, 3.5, 0.48],
  [0.48, -0.27, 3.0, 0.40],
  [0.54, -0.33, 2.6, 0.35],
];

let instanceCounter = 0;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function buildPchip(knots) {
  const n = knots.length;
  const h = new Array(n - 1);
  const d = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    h[i] = knots[i + 1][0] - knots[i][0];
    d[i] = (knots[i + 1][1] - knots[i][1]) / h[i];
  }
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) {
      m[i] = 0;
    } else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  return function evalSpline(x) {
    if (x <= knots[0][0]) return knots[0][1];
    if (x >= knots[n - 1][0]) return knots[n - 1][1];
    let i = 0;
    while (i < n - 2 && x > knots[i + 1][0]) i++;
    const t = (x - knots[i][0]) / h[i];
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * knots[i][1] +
      (t3 - 2 * t2 + t) * h[i] * m[i] +
      (-2 * t3 + 3 * t2) * knots[i + 1][1] +
      (t3 - t2) * h[i] * m[i + 1]
    );
  };
}

const evalWidthProfile = buildPchip(WIDTH_KNOTS);

function colorToRgb(THREE, input, fallback) {
  let hex;
  try {
    hex = new THREE.Color(input !== undefined && input !== null ? input : fallback).getHex();
  } catch {
    hex = new THREE.Color(fallback).getHex();
  }
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) * 0.5;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgba(h, s, l, a = 1) {
  h = ((h % 1) + 1) % 1;
  s = clamp(s, 0, 1);
  l = clamp(l, 0, 1);
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    r = hue2rgb(h + 1 / 3);
    g = hue2rgb(h);
    b = hue2rgb(h - 1 / 3);
  }
  const R = Math.round(r * 255);
  const G = Math.round(g * 255);
  const B = Math.round(b * 255);
  return a >= 1 ? `rgb(${R},${G},${B})` : `rgba(${R},${G},${B},${a})`;
}

function rgbToRgba(rgb, a = 1) {
  return a >= 1
    ? `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
    : `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

function unitToCanvas(ux, uy, w, h) {
  const y = clamp(uy, -0.999, 0.999);
  const z = Math.sqrt(Math.max(0.0001, 1 - ux * ux - y * y));
  const theta = Math.acos(y);
  const phi = Math.atan2(z, -ux);
  const u = phi / (Math.PI * 2);
  const sinTheta = Math.max(0.22, Math.sin(theta));
  const pxY = h / Math.PI;
  const pxX = (w / (Math.PI * 2)) / sinTheta;
  return {
    cx: u * w,
    cy: (theta / Math.PI) * h,
    pxX,
    pxY,
  };
}

function buildHeadGeometry(THREE) {
  const geo = new THREE.SphereGeometry(1, 64, 48);
  const pos = geo.attributes.position;

  // Target overall dimensions: 0.31 wide, 0.30 tall, 0.28 deep
  const scaleX = 0.151;
  const scaleY = 0.15625;
  const scaleZ = 0.148;

  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);

    const wScale = evalWidthProfile(uy);
    const xOut = ux * wScale;

    // Smooth lower-half shortening (y < 0 multiplied by 0.92)
    const lowerBlend = smoothstep(0.12, -0.12, uy);
    const yOut = uy * (1 - 0.08 * lowerBlend);

    // Back full & round (z < 0 => 1.0); front flattened (0.86 strongest on y in [-0.5, 0.4])
    const bandLo = smoothstep(-0.85, -0.45, uy);
    const bandHi = 1 - smoothstep(0.35, 0.85, uy);
    const faceBand = bandLo * bandHi;
    const frontFactor = 0.93 - 0.07 * faceBand - 0.025 * faceBand * smoothstep(0.55, 1.0, uz);
    const frontBlend = smoothstep(0.0, 0.24, uz);
    let zOut = uz * (1 - frontBlend * (1 - frontFactor));

    if (uz > 0) {
      // Very slight forward swell of the cheeks around x = +-0.55, y = -0.3
      const dxC = Math.abs(ux) - 0.55;
      const dyC = uy + 0.30;
      const cheekD2 = (dxC * dxC) / (0.28 * 0.28) + (dyC * dyC) / (0.24 * 0.24);
      zOut += 0.04 * Math.exp(-cheekD2) * smoothstep(0.0, 0.35, uz);

      // Tiny nose bump within radius ~0.09 of (0, -0.18)
      if (uz > 0.5) {
        const rN = Math.hypot(ux, uy + 0.18);
        const rMax = 0.105;
        if (rN < rMax) {
          const bell = 0.5 * (1 + Math.cos(Math.PI * (rN / rMax)));
          zOut += 0.035 * bell * bell;
        }
      }
    }

    pos.setXYZ(i, xOut * scaleX, yOut * scaleY, zOut * scaleZ);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function buildEarGeometry(THREE, side) {
  const geo = new THREE.SphereGeometry(1, 20, 16);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    // Slightly wider at upper ear, gentle lobe taper below
    const lobeTaper = 0.88 + 0.16 * smoothstep(-0.9, 0.5, y);
    z *= lobeTaper;

    // Gentle inner ear fold on front-facing side
    if (z > 0.05) {
      const fx = x * side - 0.18;
      const fy = y + 0.04;
      const r2 = (fx * fx) / (0.48 * 0.48) + (fy * fy) / (0.58 * 0.58);
      const hollow = Math.exp(-r2 * 2.2) * smoothstep(0.05, 0.45, z);
      z -= 0.42 * hollow;

      // Small soft inner fold ridge
      const rx = x * side - 0.10;
      const ry = y + 0.12;
      const ridge = Math.exp(-((rx * rx) / 0.06 + (ry * ry) / 0.12)) * smoothstep(0.1, 0.5, z);
      z += 0.16 * ridge;
    }

    pos.setXYZ(i, x * 0.0115, y * 0.027, z * 0.0195);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function drawBlush(ctx, w, h, state) {
  if (!state.opts.blush) return;
  const alphaBoost = state.expression === "happy" ? 0.36 : 0.30;
  for (const side of [-1, 1]) {
    const p = unitToCanvas(side * 0.52, -0.33, w, h);
    const rx = 0.145 * p.pxX;
    const ry = 0.072 * p.pxY;
    ctx.save();
    ctx.translate(p.cx, p.cy);
    ctx.scale(1, ry / rx);
    const grad = ctx.createRadialGradient(0, 0, rx * 0.08, 0, 0, rx);
    grad.addColorStop(0, `rgba(240, 124, 134, ${alphaBoost})`);
    grad.addColorStop(0.55, `rgba(240, 124, 134, ${alphaBoost * 0.42})`);
    grad.addColorStop(1, "rgba(240, 124, 134, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawFreckles(ctx, w, h, state) {
  if (!state.opts.freckles) return;
  ctx.save();
  for (let i = 0; i < FRECKLE_PTS.length; i++) {
    const [fx, fy, rad, a] = FRECKLE_PTS[i];
    const p = unitToCanvas(fx, fy, w, h);
    ctx.fillStyle = `rgba(132, 82, 60, ${a})`;
    ctx.beginPath();
    ctx.ellipse(p.cx, p.cy, rad * 1.05, rad * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawNose(ctx, w, h) {
  const p = unitToCanvas(0, -0.22, w, h);
  const rx = 11.5;
  const ry = 7.5;
  ctx.save();
  ctx.translate(p.cx, p.cy);
  ctx.scale(1, ry / rx);
  const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, rx);
  grad.addColorStop(0, "rgba(74, 42, 34, 0.22)");
  grad.addColorStop(0.6, "rgba(74, 42, 34, 0.08)");
  grad.addColorStop(1, "rgba(74, 42, 34, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawClosedEyeArc(ctx, p, side, mode, lashes) {
  const rx = 0.205 * p.pxX;
  const ry = 0.24 * p.pxY;
  const innerX = -side * rx * 0.86;
  const outerX = side * rx * 0.96;

  ctx.save();
  ctx.translate(p.cx, p.cy);
  ctx.fillStyle = LID_COLOR;
  ctx.strokeStyle = LID_COLOR;
  ctx.lineCap = "round";

  if (mode === "happy") {
    // Thick cheerful upward arc
    const yBase = ry * 0.16;
    const peakY = -ry * 0.42;
    ctx.beginPath();
    ctx.moveTo(innerX, yBase + ry * 0.04);
    ctx.quadraticCurveTo(side * rx * 0.05, peakY - 12, outerX, yBase);
    ctx.quadraticCurveTo(side * rx * 0.05, peakY + 14, innerX, yBase + ry * 0.04);
    ctx.closePath();
    ctx.fill();

    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(innerX, yBase + ry * 0.04);
    ctx.quadraticCurveTo(side * rx * 0.05, peakY + 1, outerX, yBase);
    ctx.stroke();

    if (lashes) {
      drawLashFan(ctx, outerX, yBase, side, -0.35, 1.0);
    }
  } else {
    // Calm downward arc (asleep or blink)
    const yBase = ry * 0.02;
    const dipY = ry * 0.40;
    ctx.beginPath();
    ctx.moveTo(innerX, yBase - ry * 0.04);
    ctx.quadraticCurveTo(side * rx * 0.06, dipY + 10, outerX, yBase - ry * 0.02);
    ctx.quadraticCurveTo(side * rx * 0.06, dipY - 8, innerX, yBase - ry * 0.04);
    ctx.closePath();
    ctx.fill();

    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(innerX, yBase - ry * 0.04);
    ctx.quadraticCurveTo(side * rx * 0.06, dipY + 1, outerX, yBase - ry * 0.02);
    ctx.stroke();

    if (lashes) {
      drawLashFan(ctx, outerX, yBase - ry * 0.02, side, 0.35, 0.85);
    }
  }

  ctx.restore();
}

function drawLashFan(ctx, ox, oy, side, tilt, scale) {
  ctx.save();
  ctx.strokeStyle = LID_COLOR;
  ctx.lineCap = "round";
  const specs = [
    { dx: -side * 12, dy: -6, len: 22, ang: -0.58 + tilt, lw: 5.0 },
    { dx: -side * 4, dy: -2, len: 25, ang: -0.30 + tilt, lw: 5.2 },
    { dx: side * 2, dy: 4, len: 20, ang: -0.02 + tilt, lw: 4.4 },
  ];
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i];
    const x0 = ox + s.dx * scale;
    const y0 = oy + s.dy * scale;
    const ex = x0 + side * Math.cos(s.ang) * s.len * scale;
    const ey = y0 + Math.sin(s.ang) * s.len * scale;
    const cx = x0 + side * Math.cos(s.ang + 0.16) * s.len * 0.55 * scale;
    const cy = y0 + Math.sin(s.ang + 0.16) * s.len * 0.55 * scale;
    ctx.lineWidth = s.lw * scale;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.stroke();
  }
  ctx.restore();
}

function drawOpenEye(ctx, p, side, state) {
  const { eyeShape, lashes } = state.opts;
  const [eh, es, el] = state.eyeHsl;

  let wMul = 1.0;
  let hMul = 1.0;
  let innerY = 0.08;
  let outerY = 0.04;
  let archShift = 0.06;
  let lashTilt = -0.05;

  if (eyeShape === "almond") {
    wMul = 1.05;
    hMul = 0.87;
    innerY = 0.14;
    outerY = 0.02;
    archShift = 0.08;
    lashTilt = -0.15;
  } else if (eyeShape === "droopy") {
    wMul = 1.0;
    hMul = 0.96;
    innerY = 0.00;
    outerY = 0.24;
    archShift = -0.08;
    lashTilt = 0.22;
  } else if (eyeShape === "upturned") {
    wMul = 1.03;
    hMul = 0.92;
    innerY = 0.18;
    outerY = -0.14;
    archShift = 0.14;
    lashTilt = -0.32;
  }

  const rx = 0.21 * wMul * p.pxX;
  const ry = 0.25 * hMul * p.pxY;
  const innerX = -side * rx;
  const outerX = side * rx;
  const inY = innerY * ry;
  const outY = outerY * ry;

  // Control points for the upper lid curve
  const uCp1x = innerX + side * rx * 0.34;
  const uCp1y = -ry * 0.98;
  const uCp2x = outerX - side * rx * (0.30 - archShift);
  const uCp2y = -ry * 1.02 + outY * 0.22;

  // Lower aperture curve (no outline drawn here, only used to clip sclera & iris cleanly)
  const lCp1x = outerX - side * rx * 0.28;
  const lCp1y = ry * 1.04;
  const lCp2x = innerX + side * rx * 0.28;
  const lCp2y = ry * 1.04;

  const traceAperture = () => {
    ctx.beginPath();
    ctx.moveTo(innerX, inY);
    ctx.bezierCurveTo(uCp1x, uCp1y, uCp2x, uCp2y, outerX, outY);
    ctx.bezierCurveTo(lCp1x, lCp1y, lCp2x, lCp2y, innerX, inY);
    ctx.closePath();
  };

  ctx.save();
  ctx.translate(p.cx, p.cy);

  // 1. Clipped interior: off-white side sclera + luminous iris + pupil + crescent + highlights
  ctx.save();
  traceAperture();
  ctx.clip();

  // Soft off-white sclera (visible only as narrow left/right slivers)
  ctx.fillStyle = "#f7f3ee";
  ctx.fillRect(-rx * 1.2, -ry * 1.2, rx * 2.4, ry * 2.4);

  // Gentle shadow under upper lid across sclera
  const scleraShadow = ctx.createLinearGradient(0, -ry, 0, -ry * 0.25);
  scleraShadow.addColorStop(0, "rgba(72, 50, 44, 0.26)");
  scleraShadow.addColorStop(1, "rgba(72, 50, 44, 0)");
  ctx.fillStyle = scleraShadow;
  ctx.fillRect(-rx * 1.2, -ry * 1.1, rx * 2.4, ry * 1.0);

  // Iris position (shifted up & to one side when thinking)
  const shiftX = state.expression === "thinking" ? rx * 0.17 : 0;
  const shiftY = state.expression === "thinking" ? -ry * 0.14 : ry * 0.03;
  const irisRx = rx * 0.74;
  const irisRy = ry * 0.99;

  // Main iris tall rounded shape
  const irisGrad = ctx.createLinearGradient(0, shiftY - irisRy, 0, shiftY + irisRy);
  irisGrad.addColorStop(0.0, hslToRgba(eh, clamp(es * 1.06, 0, 1), clamp(el * 0.44, 0.05, 0.34)));
  irisGrad.addColorStop(0.42, hslToRgba(eh, es, el));
  irisGrad.addColorStop(0.80, hslToRgba(eh, clamp(es * 1.24 + 0.08, 0, 1), clamp(el * 1.36 + 0.11, 0.24, 0.80)));
  irisGrad.addColorStop(1.0, hslToRgba(eh, clamp(es * 1.15 + 0.06, 0, 1), clamp(el * 1.48 + 0.15, 0.30, 0.88)));

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(shiftX, shiftY, irisRx, irisRy, 0, 0, Math.PI * 2);
  ctx.fillStyle = irisGrad;
  ctx.fill();
  ctx.clip();

  // Soft inner iris rim (subtle depth, no black ring)
  ctx.strokeStyle = hslToRgba(eh, clamp(es * 1.1, 0, 1), clamp(el * 0.36, 0.04, 0.28), 0.42);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(shiftX, shiftY, irisRx - 1.5, irisRy - 1.5, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Pale glowing crescent along the bottom inside the iris
  const cresY = shiftY + irisRy * 0.56;
  const cresGrad = ctx.createRadialGradient(
    shiftX,
    shiftY + irisRy * 0.76,
    irisRx * 0.08,
    shiftX,
    shiftY + irisRy * 0.62,
    irisRx * 0.85
  );
  cresGrad.addColorStop(0, hslToRgba(eh, clamp(es * 0.9 + 0.05, 0, 1), clamp(el + 0.40, 0.76, 0.95), 0.72));
  cresGrad.addColorStop(0.6, hslToRgba(eh, clamp(es * 1.05, 0, 1), clamp(el + 0.26, 0.62, 0.90), 0.32));
  cresGrad.addColorStop(1, hslToRgba(eh, es, clamp(el + 0.2, 0.5, 0.9), 0));
  ctx.fillStyle = cresGrad;
  ctx.beginPath();
  ctx.ellipse(shiftX, cresY, irisRx * 0.78, irisRy * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();

  // Soft darker pupil in the upper middle
  const pupX = shiftX;
  const pupY = shiftY - irisRy * 0.08;
  const pupRx = irisRx * 0.45;
  const pupRy = irisRy * 0.48;
  ctx.save();
  ctx.translate(pupX, pupY);
  ctx.scale(1, pupRy / pupRx);
  const pupGrad = ctx.createRadialGradient(0, 0, pupRx * 0.15, 0, 0, pupRx);
  pupGrad.addColorStop(0, hslToRgba(eh, clamp(es * 0.8, 0, 1), clamp(el * 0.15, 0.03, 0.12), 0.88));
  pupGrad.addColorStop(0.62, hslToRgba(eh, clamp(es * 0.9, 0, 1), clamp(el * 0.22, 0.04, 0.18), 0.55));
  pupGrad.addColorStop(1, hslToRgba(eh, es, clamp(el * 0.35, 0.05, 0.25), 0));
  ctx.fillStyle = pupGrad;
  ctx.beginPath();
  ctx.arc(0, 0, pupRx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Soft cast shadow from upper lid onto top of iris
  const lidCast = ctx.createLinearGradient(0, -ry * 0.95, 0, -ry * 0.15);
  lidCast.addColorStop(0, "rgba(38, 22, 20, 0.34)");
  lidCast.addColorStop(1, "rgba(38, 22, 20, 0)");
  ctx.fillStyle = lidCast;
  ctx.fillRect(-rx * 1.2, -ry * 1.1, rx * 2.4, ry * 1.1);

  // Two pure white highlights: large upper-left, small lower-right
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.beginPath();
  ctx.ellipse(
    shiftX - irisRx * 0.30,
    shiftY - irisRy * 0.32,
    irisRx * 0.25,
    irisRy * 0.19,
    -0.35,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.beginPath();
  ctx.arc(shiftX + irisRx * 0.30, shiftY + irisRy * 0.28, irisRx * 0.105, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore(); // end iris clip
  ctx.restore(); // end aperture clip

  // 2. Dark brown upper lid arc ONLY (thick in middle & outer corner, thin at inner)
  const extOutX = outerX + side * rx * 0.09;
  const extOutY = outY + (eyeShape === "upturned" ? -ry * 0.07 : eyeShape === "droopy" ? ry * 0.06 : -ry * 0.02);

  ctx.fillStyle = LID_COLOR;
  ctx.beginPath();
  // Outer/top edge of upper lid
  ctx.moveTo(innerX - side * 2, inY - 2);
  ctx.bezierCurveTo(
    uCp1x,
    uCp1y - 12,
    uCp2x + side * 6,
    uCp2y - 15,
    extOutX,
    extOutY - 4
  );
  // Rounded thick outer tip
  ctx.quadraticCurveTo(extOutX + side * 4, extOutY + 5, outerX - side * 2, outY + 9);
  // Inner/bottom edge of upper lid returning thin to inner corner
  ctx.bezierCurveTo(
    uCp2x,
    uCp2y + 6,
    uCp1x,
    uCp1y + 4,
    innerX - side * 2,
    inY + 2.5
  );
  ctx.closePath();
  ctx.fill();

  // 3. Optional three small lashes at the outer corner
  if (lashes) {
    drawLashFan(ctx, outerX, outY, side, lashTilt, 1.0);
  }

  ctx.restore();
}

function drawEyes(ctx, w, h, state) {
  const closedMode =
    state.blinking || state.expression === "asleep"
      ? "closed"
      : state.expression === "happy"
      ? "happy"
      : null;

  for (const side of [-1, 1]) {
    const p = unitToCanvas(side * 0.40, -0.12, w, h);
    if (closedMode) {
      drawClosedEyeArc(ctx, p, side, closedMode, state.opts.lashes);
    } else {
      drawOpenEye(ctx, p, side, state);
    }
  }
}

function drawBrows(ctx, w, h, state) {
  const { brow } = state.opts;
  const color = rgbToRgba(state.browRgb, 0.85);
  const expr = state.expression;

  for (const side of [-1, 1]) {
    let yBase = 0.22;
    let innerDy = 0;
    let midDy = -0.022;
    let outerDy = 0.012;

    if (brow === "straight") {
      innerDy = 0.004;
      midDy = -0.005;
      outerDy = 0.002;
    } else if (brow === "arched") {
      innerDy = 0.014;
      midDy = -0.044;
      outerDy = 0.018;
    }

    if (expr === "happy") {
      yBase += 0.024;
      midDy -= 0.012;
    } else if (expr === "asleep") {
      yBase -= 0.022;
      midDy += 0.010;
    } else if (expr === "thinking") {
      if (side === 1) {
        yBase += 0.045;
        midDy -= 0.018;
      } else {
        yBase -= 0.012;
        midDy += 0.010;
      }
    } else if (expr === "unsure") {
      // Tilted up in the middle
      innerDy = -0.036;
      midDy = -0.004;
      outerDy = 0.030;
    }

    const p = unitToCanvas(side * 0.40, yBase, w, h);
    const halfW = 0.125 * p.pxX;
    const innerX = -side * halfW;
    const outerX = side * halfW;
    const midX = side * halfW * (brow === "arched" ? 0.20 : 0.06);

    ctx.save();
    ctx.translate(p.cx, p.cy);
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineWidth = 10.5;
    ctx.beginPath();
    ctx.moveTo(innerX, innerDy * p.pxY);
    ctx.quadraticCurveTo(midX, midDy * p.pxY, outerX, outerDy * p.pxY);
    ctx.stroke();
    ctx.restore();
  }
}

function drawMouth(ctx, w, h, state) {
  const p = unitToCanvas(0, -0.47, w, h);
  const expr = state.expression;
  const [lh, ls, ll] = state.lipHsl;
  const strokeCol = hslToRgba(lh, clamp(ls * 0.92, 0.15, 0.55), clamp(ll * 0.82, 0.24, 0.48), 0.92);

  ctx.save();
  ctx.translate(p.cx, p.cy);
  ctx.strokeStyle = strokeCol;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (expr === "happy") {
    // Open smile filled darker rose
    const halfW = 0.095 * p.pxX;
    const openH = 0.092 * p.pxY;
    const fillCol = hslToRgba(lh, clamp(ls * 1.05, 0.25, 0.62), clamp(ll * 0.62, 0.18, 0.36), 0.95);
    const tongueCol = hslToRgba(lh, clamp(ls * 1.1, 0.32, 0.70), clamp(ll * 1.18 + 0.08, 0.48, 0.72), 0.85);

    ctx.beginPath();
    ctx.moveTo(-halfW, -openH * 0.14);
    ctx.quadraticCurveTo(0, openH * 0.04, halfW, -openH * 0.14);
    ctx.bezierCurveTo(halfW * 0.82, openH * 0.95, -halfW * 0.82, openH * 0.95, -halfW, -openH * 0.14);
    ctx.closePath();

    ctx.save();
    ctx.fillStyle = fillCol;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = tongueCol;
    ctx.beginPath();
    ctx.ellipse(0, openH * 0.72, halfW * 0.62, openH * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.lineWidth = 5.5;
    ctx.stroke();
  } else if (expr === "thinking") {
    // Small flat mouth
    const halfW = 0.056 * p.pxX;
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(-halfW, 2);
    ctx.quadraticCurveTo(0, 0, halfW, -2);
    ctx.stroke();
  } else if (expr === "unsure") {
    // Small wavy mouth
    const halfW = 0.076 * p.pxX;
    const amp = 6.5;
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(-halfW, 2);
    ctx.bezierCurveTo(-halfW * 0.45, -amp, -halfW * 0.1, amp, 0, 0);
    ctx.bezierCurveTo(halfW * 0.1, -amp, halfW * 0.45, amp, halfW, -1);
    ctx.stroke();
  } else if (expr === "asleep") {
    // Small peaceful smile
    const halfW = 0.062 * p.pxX;
    ctx.lineWidth = 6.0;
    ctx.beginPath();
    ctx.moveTo(-halfW, -2);
    ctx.quadraticCurveTo(0, 7, halfW, -2);
    ctx.stroke();
  } else {
    // Awake: small curved smile ~0.16 wide, muted rose-brown, rounded ends
    const halfW = 0.08 * p.pxX;
    ctx.lineWidth = 6.8;
    ctx.beginPath();
    ctx.moveTo(-halfW, -4);
    ctx.quadraticCurveTo(0, 12, halfW, -4);
    ctx.stroke();

    // Very soft lower-lip tint
    ctx.fillStyle = hslToRgba(lh, ls, clamp(ll + 0.06, 0.35, 0.72), 0.16);
    ctx.beginPath();
    ctx.ellipse(0, 10, halfW * 0.48, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function redrawFace(state) {
  const { ctx, w, h, tex } = state;
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  drawBlush(ctx, w, h, state);
  drawFreckles(ctx, w, h, state);
  drawNose(ctx, w, h);
  drawEyes(ctx, w, h, state);
  drawBrows(ctx, w, h, state);
  drawMouth(ctx, w, h, state);
  if (tex) tex.needsUpdate = true;
}

function nextBlinkInterval(state) {
  state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return 3.0 + (state.rng / 4294967296) * 2.0;
}

export function buildHead(THREE, opts, kit) {
  const cfg = {
    skin: opts && opts.skin !== undefined ? opts.skin : "#f2d2be",
    eye: opts && opts.eye !== undefined ? opts.eye : "#4c78b8",
    eyeShape: (opts && opts.eyeShape) || "round",
    brow: (opts && opts.brow) || "soft",
    browColor: opts && opts.browColor !== undefined ? opts.browColor : "#4a352c",
    lip: opts && opts.lip !== undefined ? opts.lip : "#a45e58",
    blush: opts && opts.blush !== undefined ? Boolean(opts.blush) : true,
    freckles: Boolean(opts && opts.freckles),
    lashes: opts && opts.lashes !== undefined ? Boolean(opts.lashes) : true,
  };

  const group = new THREE.Group();
  group.name = "chibiHead";

  const headGeo = buildHeadGeometry(THREE);
  const skinColor = new THREE.Color(cfg.skin);
  const sheenColor = skinColor.clone().lerp(new THREE.Color(0xffffff), 0.35);

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: skinColor,
    roughness: 0.6,
    metalness: 0.0,
    sheen: 0.3,
    sheenRoughness: 0.65,
    sheenColor,
  });

  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.position.set(0, 0.14, 0);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  group.add(headMesh);

  // Short neck socket ring hidden under the chin only
  const socketGeo = new THREE.CylinderGeometry(0.036, 0.040, 0.022, 24);
  const socketMesh = new THREE.Mesh(socketGeo, skinMat);
  socketMesh.position.set(0, 0.012, -0.018);
  group.add(socketMesh);

  // Two small flattened ears with simple inner fold at unit x = +-1.0, y = -0.05
  for (const side of [-1, 1]) {
    const earGeo = buildEarGeometry(THREE, side);
    const earMesh = new THREE.Mesh(earGeo, skinMat);
    earMesh.position.set(side * 0.154, 0.132, -0.014);
    earMesh.rotation.set(0, -side * 0.28, -side * 0.10);
    earMesh.castShadow = true;
    earMesh.receiveShadow = true;
    group.add(earMesh);
  }

  // Color precomputation in sRGB space for exact iris / brow / lip rendering
  const eyeRgb = colorToRgb(THREE, cfg.eye, "#4c78b8");
  const browRgb = colorToRgb(THREE, cfg.browColor, "#4a352c");
  const lipRgb = colorToRgb(THREE, cfg.lip, "#a45e58");

  instanceCounter += 1;
  const seed =
    ((eyeRgb[0] * 73856093) ^
      (eyeRgb[1] * 19349663) ^
      (browRgb[2] * 83492791) ^
      (instanceCounter * 2654435761)) >>>
    0;

  const state = {
    opts: cfg,
    eyeHsl: rgbToHsl(eyeRgb[0], eyeRgb[1], eyeRgb[2]),
    browRgb,
    lipHsl: rgbToHsl(lipRgb[0], lipRgb[1], lipRgb[2]),
    expression: "awake",
    blinking: false,
    ctx: null,
    w: FACE_W,
    h: FACE_H,
    tex: null,
    rng: seed || 123456789,
    lastT: null,
    nextBlink: 0,
    blinkEnd: -1,
  };

  const faceTex = kit.canvasTexture(FACE_W, FACE_H, (ctx, w, h) => {
    state.ctx = ctx;
    state.w = w;
    state.h = h;
    redrawFace(state);
  });
  state.tex = faceTex;

  if ("SRGBColorSpace" in THREE) {
    faceTex.colorSpace = THREE.SRGBColorSpace;
  } else if ("sRGBEncoding" in THREE) {
    faceTex.encoding = THREE.sRGBEncoding;
  }
  faceTex.needsUpdate = true;

  const faceGeo = headGeo.clone();
  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTex,
    transparent: true,
    roughness: 1,
    metalness: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const faceMesh = new THREE.Mesh(faceGeo, faceMat);
  faceMesh.position.set(0, 0.14, 0);
  faceMesh.scale.setScalar(1.004);
  faceMesh.renderOrder = 2;
  faceMesh.castShadow = false;
  faceMesh.receiveShadow = false;
  group.add(faceMesh);

  group.userData._headState = state;
  return group;
}

export function setExpression(group, name) {
  const state = group && group.userData && group.userData._headState;
  if (!state) return;
  const valid =
    name === "awake" ||
    name === "happy" ||
    name === "asleep" ||
    name === "thinking" ||
    name === "unsure"
      ? name
      : "awake";

  const changed = state.expression !== valid || (state.blinking && (valid === "asleep" || valid === "happy"));
  state.expression = valid;
  if (valid === "asleep" || valid === "happy") {
    state.blinking = false;
  }
  if (changed) {
    redrawFace(state);
  }
}

export function blink(group, t) {
  const state = group && group.userData && group.userData._headState;
  if (!state || typeof t !== "number" || !Number.isFinite(t)) return;

  if (state.expression === "asleep" || state.expression === "happy") {
    if (state.blinking) {
      state.blinking = false;
      redrawFace(state);
    }
    return;
  }

  if (state.lastT === null || t < state.lastT - 0.5 || t > state.nextBlink + 10) {
    state.nextBlink = t + 1.4 + (nextBlinkInterval(state) - 3.0);
    state.blinkEnd = -1;
  }
  state.lastT = t;

  let wantBlink = false;
  if (t >= state.nextBlink) {
    if (state.blinkEnd < state.nextBlink) {
      state.blinkEnd = state.nextBlink + 0.12;
    }
    if (t < state.blinkEnd) {
      wantBlink = true;
    } else {
      state.nextBlink = t + nextBlinkInterval(state);
      state.blinkEnd = -1;
      wantBlink = false;
    }
  }

  if (wantBlink !== state.blinking) {
    state.blinking = wantBlink;
    redrawFace(state);
  }
}
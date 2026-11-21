const CANVAS_SIZE = 1024;
const CANVAS_METERS = 0.390;
const PX_PER_M = CANVAS_SIZE / CANVAS_METERS;

const HEAD_CENTER_Y = 0.14;
const HEAD_RX = 0.150 * 1.012;
const HEAD_RY = 0.155 * 1.012;
const HEAD_RZ = 0.145 * 1.012;

const EYE_LINE_Y = 0.125;
const EYE_OFFSET_X_M = 0.062;
const MOUTH_DROP_M = 0.040;

const EYE_CY = CANVAS_SIZE * 0.5;
const EYE_OFFSET_PX = (() => {
  const ny = (EYE_LINE_Y - HEAD_CENTER_Y) / HEAD_RY;
  const cosPhi = Math.sqrt(Math.max(0.01, 1 - ny * ny));
  const sinTheta = Math.min(0.99, EYE_OFFSET_X_M / (HEAD_RX * cosPhi));
  const theta = Math.asin(sinTheta);
  const avgHorizR = (HEAD_RX + HEAD_RZ) * 0.5;
  return (theta * avgHorizR / CANVAS_METERS) * CANVAS_SIZE;
})();
const MOUTH_CY = EYE_CY + MOUTH_DROP_M * PX_PER_M;
const NOSE_CY = EYE_CY + 0.019 * PX_PER_M;

const VALID_EXPRESSIONS = new Set(['awake', 'happy', 'asleep', 'thinking', 'unsure']);
const BLINK_CYCLE = 24.7;
const BLINK_STARTS = [3.6, 8.3, 11.5, 15.9, 19.8, 24.55];
const BLINK_DURATION = 0.12;

const FRECKLE_POINTS = [
  [-52, 16, 3.0, 0.44],
  [-36, 8, 3.4, 0.50],
  [-22, 19, 2.7, 0.42],
  [-9, 11, 2.8, 0.38],
  [10, 12, 2.9, 0.40],
  [24, 18, 2.6, 0.44],
  [37, 9, 3.3, 0.50],
  [51, 17, 3.0, 0.44],
];

function rgbaStr(color, alpha = 1) {
  const r = Math.round(Math.max(0, Math.min(1, color.r)) * 255);
  const g = Math.round(Math.max(0, Math.min(1, color.g)) * 255);
  const b = Math.round(Math.max(0, Math.min(1, color.b)) * 255);
  return `rgba(${r},${g},${b},${alpha})`;
}

function makePalette(THREE, cfg) {
  const eyeBase = new THREE.Color(cfg.eye);
  const hsl = { h: 0, s: 0, l: 0 };
  eyeBase.getHSL(hsl);

  const irisTop = new THREE.Color().setHSL(
    hsl.h,
    Math.min(1, hsl.s * 0.92 + 0.06),
    Math.max(0.09, hsl.l * 0.42)
  );
  const irisMid = new THREE.Color().setHSL(
    hsl.h,
    Math.min(1, hsl.s * 1.05 + 0.04),
    Math.max(0.16, Math.min(0.72, hsl.l * 0.88))
  );
  const irisBottom = new THREE.Color().setHSL(
    hsl.h,
    Math.min(1, hsl.s * 1.25 + 0.12),
    Math.min(0.86, hsl.l * 1.32 + 0.14)
  );
  const irisCrescent = new THREE.Color().setHSL(
    hsl.h,
    Math.min(1, hsl.s * 1.15 + 0.12),
    Math.min(0.94, hsl.l * 1.48 + 0.28)
  );
  const pupil = new THREE.Color().setHSL(
    hsl.h,
    Math.min(0.65, hsl.s * 0.65),
    Math.max(0.06, hsl.l * 0.20)
  );

  const browCol = new THREE.Color(cfg.browColor);
  const lidBase = new THREE.Color('#3b231b');
  const lidCol = lidBase.clone().lerp(browCol.clone().multiplyScalar(0.55), 0.25);

  const lipCol = new THREE.Color(cfg.lip);
  const lipHsl = { h: 0, s: 0, l: 0 };
  lipCol.getHSL(lipHsl);
  const mouthOpenFill = new THREE.Color().setHSL(
    lipHsl.h,
    Math.min(0.72, lipHsl.s * 1.15 + 0.14),
    Math.max(0.28, Math.min(0.46, lipHsl.l * 0.78))
  );
  const mouthTongue = new THREE.Color().setHSL(
    (lipHsl.h + 0.985) % 1,
    Math.min(0.78, lipHsl.s * 1.2 + 0.18),
    Math.min(0.76, lipHsl.l * 1.22 + 0.14)
  );
  const noseCol = new THREE.Color('#b6796b').lerp(lipCol, 0.3);

  return {
    irisTop,
    irisMid,
    irisBottom,
    irisCrescent,
    pupil,
    lidCol,
    browCol,
    lipCol,
    mouthOpenFill,
    mouthTongue,
    noseCol,
  };
}

function buildFacePatchGeometry(THREE) {
  const segU = 64;
  const segV = 48;
  const thetaMax = (75 * Math.PI) / 180;
  const phiMin = (-72 * Math.PI) / 180;
  const phiMax = (55 * Math.PI) / 180;

  const vertCount = (segU + 1) * (segV + 1);
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);

  let pIdx = 0;
  let uvIdx = 0;
  for (let j = 0; j <= segV; j++) {
    const tv = j / segV;
    const phi = phiMin + tv * (phiMax - phiMin);
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);
    const y = HEAD_CENTER_Y + HEAD_RY * sinPhi;
    const v = 0.5 + (y - EYE_LINE_Y) / CANVAS_METERS;

    for (let i = 0; i <= segU; i++) {
      const tu = i / segU;
      const theta = -thetaMax + tu * (2 * thetaMax);
      const x = HEAD_RX * cosPhi * Math.sin(theta);
      const z = HEAD_RZ * cosPhi * Math.cos(theta);

      positions[pIdx++] = x;
      positions[pIdx++] = y;
      positions[pIdx++] = z;

      uvs[uvIdx++] = tu;
      uvs[uvIdx++] = v;
    }
  }

  const indices = [];
  const row = segU + 1;
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function getEyeShapeParams(shape) {
  switch (shape) {
    case 'almond':
      return { rx: 95, ry: 96, innerY: 10, outerY: 2, topPeakX: 6, lidLift: -4 };
    case 'droopy':
      return { rx: 92, ry: 101, innerY: 2, outerY: 17, topPeakX: -6, lidLift: 10 };
    case 'upturned':
      return { rx: 93, ry: 99, innerY: 12, outerY: -12, topPeakX: 11, lidLift: -12 };
    case 'round':
    default:
      return { rx: 92, ry: 103, innerY: 6, outerY: 4, topPeakX: 4, lidLift: 0 };
  }
}

function traceEyeOpening(ctx, p) {
  const { rx, ry, innerY, outerY, topPeakX } = p;
  ctx.beginPath();
  ctx.moveTo(-rx, innerY);
  ctx.bezierCurveTo(-rx * 0.96, -ry * 0.72, topPeakX - rx * 0.56, -ry, topPeakX, -ry);
  ctx.bezierCurveTo(topPeakX + rx * 0.58, -ry, rx * 0.96, outerY - ry * 0.68, rx, outerY);
  ctx.bezierCurveTo(rx * 0.94, outerY + ry * 0.72, rx * 0.48, ry, 0, ry);
  ctx.bezierCurveTo(-rx * 0.48, ry, -rx * 0.94, innerY + ry * 0.72, -rx, innerY);
  ctx.closePath();
}

function drawShortLash(ctx, x0, y0, x1, y1, cx, cy, baseHalfW, color) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x0 + nx * baseHalfW, y0 + ny * baseHalfW);
  ctx.quadraticCurveTo(cx + nx * (baseHalfW * 0.35), cy + ny * (baseHalfW * 0.35), x1, y1);
  ctx.quadraticCurveTo(cx - nx * (baseHalfW * 0.35), cy - ny * (baseHalfW * 0.35), x0 - nx * baseHalfW, y0 - ny * baseHalfW);
  ctx.closePath();
  ctx.fill();
}

function drawEyeOpen(ctx, side, eyeCx, eyeCy, shape, palette, hasLashes, gazeX, gazeY) {
  const p = getEyeShapeParams(shape);
  const { rx, ry, innerY, outerY, topPeakX, lidLift } = p;

  ctx.save();
  ctx.translate(eyeCx, eyeCy);

  // Clipped sclera, iris, and highlights
  ctx.save();
  ctx.scale(side, 1);
  traceEyeOpening(ctx, p);
  ctx.clip();

  // Warm off-white sclera so pure white highlights stand out cleanly
  ctx.fillStyle = '#fbf8f6';
  ctx.fillRect(-rx - 12, -ry - 12, (rx + 12) * 2, (ry + 12) * 2);

  // Gentle shadow cast by upper lid across top of sclera
  const scleraShade = ctx.createLinearGradient(0, -ry, 0, -ry * 0.22);
  scleraShade.addColorStop(0, 'rgba(155, 142, 168, 0.28)');
  scleraShade.addColorStop(1, 'rgba(155, 142, 168, 0)');
  ctx.fillStyle = scleraShade;
  ctx.fillRect(-rx - 12, -ry - 12, (rx + 12) * 2, ry);

  // Iris fills most of the eye, leaving soft white visible at the sides
  const ix = gazeX * side;
  const iy = 4 + gazeY;
  const irisRx = rx * 0.76;
  const irisRy = ry * 0.89;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(ix, iy, irisRx, irisRy, 0, 0, Math.PI * 2);
  ctx.clip();

  const irisGrad = ctx.createLinearGradient(ix, iy - irisRy, ix, iy + irisRy);
  irisGrad.addColorStop(0.0, rgbaStr(palette.irisTop, 1));
  irisGrad.addColorStop(0.36, rgbaStr(palette.irisMid, 1));
  irisGrad.addColorStop(0.78, rgbaStr(palette.irisBottom, 1));
  irisGrad.addColorStop(1.0, rgbaStr(palette.irisBottom, 1));
  ctx.fillStyle = irisGrad;
  ctx.fillRect(ix - irisRx - 2, iy - irisRy - 2, irisRx * 2 + 4, irisRy * 2 + 4);

  // Upper iris depth band
  const upperShadow = ctx.createLinearGradient(ix, iy - irisRy, ix, iy - irisRy * 0.06);
  upperShadow.addColorStop(0, rgbaStr(palette.pupil, 0.50));
  upperShadow.addColorStop(1, rgbaStr(palette.pupil, 0));
  ctx.fillStyle = upperShadow;
  ctx.fillRect(ix - irisRx - 2, iy - irisRy - 2, irisRx * 2 + 4, irisRy * 1.05);

  // Soft darker pupil in upper middle
  ctx.save();
  ctx.translate(ix, iy - irisRy * 0.14);
  ctx.scale(1, 1.15);
  const pr = irisRx * 0.49;
  const pupilGrad = ctx.createRadialGradient(0, 0, pr * 0.16, 0, 0, pr);
  pupilGrad.addColorStop(0, rgbaStr(palette.pupil, 0.92));
  pupilGrad.addColorStop(0.55, rgbaStr(palette.pupil, 0.86));
  pupilGrad.addColorStop(1, rgbaStr(palette.pupil, 0));
  ctx.fillStyle = pupilGrad;
  ctx.beginPath();
  ctx.arc(0, 0, pr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Lighter luminous crescent along bottom of iris
  ctx.save();
  ctx.translate(ix, iy + irisRy * 0.50);
  ctx.scale(1.16, 0.72);
  const cr = irisRx * 0.76;
  const cresGrad = ctx.createRadialGradient(0, 0, cr * 0.06, 0, 0, cr);
  cresGrad.addColorStop(0, rgbaStr(palette.irisCrescent, 0.88));
  cresGrad.addColorStop(0.58, rgbaStr(palette.irisCrescent, 0.42));
  cresGrad.addColorStop(1, rgbaStr(palette.irisCrescent, 0));
  ctx.fillStyle = cresGrad;
  ctx.beginPath();
  ctx.arc(0, 0, cr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = rgbaStr(palette.irisCrescent, 0.70);
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(ix, iy + irisRy * 0.05, irisRx * 0.73, irisRy * 0.77, 0, 0.25 * Math.PI, 0.75 * Math.PI);
  ctx.stroke();
  ctx.restore();

  // Soft feathered iris perimeter (never a hard dark ring)
  ctx.save();
  ctx.translate(ix, iy);
  ctx.scale(1, irisRy / irisRx);
  const edgeGrad = ctx.createRadialGradient(0, 0, irisRx * 0.78, 0, 0, irisRx);
  edgeGrad.addColorStop(0, rgbaStr(palette.irisTop, 0));
  edgeGrad.addColorStop(1, rgbaStr(palette.irisTop, 0.30));
  ctx.fillStyle = edgeGrad;
  ctx.beginPath();
  ctx.arc(0, 0, irisRx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore(); // end iris clip

  // Un-mirror for consistent directional highlights (big upper-left, small lower-right)
  ctx.scale(side, 1);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
  ctx.beginPath();
  ctx.ellipse(-30 + gazeX * 0.55, -39 + gazeY * 0.55, 21.5, 19.5, -0.26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.arc(34 + gazeX * 0.55, 42 + gazeY * 0.55, 9.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore(); // end eye opening clip

  // Upper lid line, lashes, faint crease, and faint lower stroke
  ctx.save();
  ctx.scale(side, 1);

  const lidFill = rgbaStr(palette.lidCol, 0.98);
  ctx.fillStyle = lidFill;
  ctx.strokeStyle = lidFill;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-rx * 0.94, innerY - 8);
  ctx.bezierCurveTo(-rx * 0.88, -ry * 0.74, topPeakX - rx * 0.54, -ry + 2, topPeakX, -ry + 2);
  ctx.bezierCurveTo(topPeakX + rx * 0.56, -ry + 2, rx * 0.92, outerY - ry * 0.64, rx + 2, outerY + 6);
  ctx.quadraticCurveTo(rx + 12, outerY + 4, rx + 16, outerY - 4 + lidLift * 0.25);
  ctx.bezierCurveTo(rx * 1.05, outerY - ry * 0.78 - 10, topPeakX + rx * 0.62, -ry - 22, topPeakX, -ry - 18);
  ctx.bezierCurveTo(topPeakX - rx * 0.60, -ry - 15, -rx * 0.94, -ry * 0.78 - 5, -rx * 0.94, innerY - 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (hasLashes) {
    drawShortLash(
      ctx,
      rx * 0.96, outerY - 5,
      rx + 28, outerY - 12 + lidLift * 0.3,
      rx + 16, outerY - 5 + lidLift * 0.15,
      5.5,
      lidFill
    );
    drawShortLash(
      ctx,
      rx * 0.85, outerY - ry * 0.30,
      rx + 23, outerY - ry * 0.44 + lidLift * 0.2,
      rx + 10, outerY - ry * 0.33 + lidLift * 0.1,
      5.2,
      lidFill
    );
    drawShortLash(
      ctx,
      rx * 0.66, outerY - ry * 0.58,
      rx * 0.96, outerY - ry * 0.78 + lidLift * 0.15,
      rx * 0.84, outerY - ry * 0.64,
      4.6,
      lidFill
    );
  }

  // Delicate upper lid crease
  ctx.strokeStyle = rgbaStr(palette.lidCol, 0.24);
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-rx * 0.52, -ry * 0.88 - 18);
  ctx.quadraticCurveTo(topPeakX + 4, -ry - 32, rx * 0.62, outerY - ry * 0.82 - 14);
  ctx.stroke();

  // Faint short lower lid stroke
  ctx.strokeStyle = rgbaStr(palette.lidCol, 0.24);
  ctx.lineWidth = 3.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-rx * 0.28, ry + 3);
  ctx.quadraticCurveTo(0, ry + 8, rx * 0.28, ry + 3);
  ctx.stroke();

  ctx.restore();
  ctx.restore();
}

function drawEyeHappy(ctx, side, eyeCx, eyeCy, palette, hasLashes) {
  const lidFill = rgbaStr(palette.lidCol, 0.98);
  ctx.save();
  ctx.translate(eyeCx, eyeCy + 8);
  ctx.scale(side, 1);

  ctx.fillStyle = lidFill;
  ctx.strokeStyle = lidFill;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-78, 22);
  ctx.quadraticCurveTo(0, -48, 82, 20);
  ctx.quadraticCurveTo(4, -22, -78, 22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (hasLashes) {
    drawShortLash(ctx, 74, 14, 98, 4, 88, 12, 4.8, lidFill);
    drawShortLash(ctx, 56, -4, 80, -18, 70, -8, 4.4, lidFill);
  }

  ctx.restore();
}

function drawEyeClosed(ctx, side, eyeCx, eyeCy, palette, hasLashes) {
  const lidFill = rgbaStr(palette.lidCol, 0.96);
  ctx.save();
  ctx.translate(eyeCx, eyeCy + 14);
  ctx.scale(side, 1);

  ctx.fillStyle = lidFill;
  ctx.strokeStyle = lidFill;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-78, -14);
  ctx.quadraticCurveTo(2, 42, 82, -16);
  ctx.quadraticCurveTo(2, 22, -78, -14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (hasLashes) {
    drawShortLash(ctx, 74, -8, 98, -2, 87, -3, 4.4, lidFill);
    drawShortLash(ctx, 58, 4, 80, 16, 70, 12, 4.0, lidFill);
  }

  ctx.strokeStyle = rgbaStr(palette.lidCol, 0.20);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-46, -34);
  ctx.quadraticCurveTo(0, -24, 48, -34);
  ctx.stroke();

  ctx.restore();
}

function drawBrow(ctx, side, eyeCx, browStyle, expression, palette) {
  let yOff = 0;
  let innerY = 4;
  let ctrlX = 0;
  let ctrlY = -9;
  let outerY = 7;

  if (browStyle === 'straight') {
    innerY = 2;
    ctrlY = -2;
    outerY = 2;
  } else if (browStyle === 'arched') {
    innerY = 7;
    ctrlX = 10;
    ctrlY = -15;
    outerY = 6;
  }

  if (expression === 'happy') {
    yOff = -12;
    ctrlY -= 4;
  } else if (expression === 'asleep') {
    yOff = 14;
    ctrlY *= 0.45;
  } else if (expression === 'thinking') {
    if (side > 0) {
      yOff = -18;
      ctrlY -= 8;
      outerY -= 3;
    } else {
      yOff = 6;
      ctrlY *= 0.4;
    }
  } else if (expression === 'unsure') {
    yOff = -2;
    innerY -= 14;
    ctrlY = 0;
    outerY += 10;
  }

  ctx.save();
  ctx.translate(eyeCx, 356 + yOff);
  ctx.scale(side, 1);

  ctx.strokeStyle = rgbaStr(palette.browCol, 0.88);
  ctx.lineWidth = 8.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-44, innerY);
  ctx.quadraticCurveTo(ctrlX, ctrlY, 44, outerY);
  ctx.stroke();

  ctx.restore();
}

function drawBlush(ctx, centerX, centerY, alpha) {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(1.9, 1.0);
  const r = 44;
  const grad = ctx.createRadialGradient(0, 0, r * 0.08, 0, 0, r);
  grad.addColorStop(0, `rgba(255, 126, 142, ${alpha})`);
  grad.addColorStop(0.55, `rgba(255, 138, 152, ${alpha * 0.46})`);
  grad.addColorStop(1, 'rgba(255, 150, 165, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFreckles(ctx, palette) {
  const cx = CANVAS_SIZE * 0.5;
  for (let i = 0; i < FRECKLE_POINTS.length; i++) {
    const [dx, dy, r, a] = FRECKLE_POINTS[i];
    ctx.fillStyle = rgbaStr(palette.browCol, a * 0.78);
    ctx.beginPath();
    ctx.arc(cx + dx, NOSE_CY + dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawNose(ctx, palette) {
  const cx = CANVAS_SIZE * 0.5;
  ctx.fillStyle = rgbaStr(palette.noseCol, 0.56);
  ctx.beginPath();
  ctx.ellipse(cx, NOSE_CY, 4.2, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawMouth(ctx, expression, palette) {
  const cx = CANVAS_SIZE * 0.5;
  const cy = MOUTH_CY;
  const strokeCol = rgbaStr(palette.lipCol, 0.94);

  ctx.save();
  ctx.strokeStyle = strokeCol;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (expression === 'happy') {
    const w = 38;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - w, cy - 5);
    ctx.quadraticCurveTo(cx, cy - 1, cx + w, cy - 5);
    ctx.bezierCurveTo(cx + w * 0.88, cy + 40, cx - w * 0.88, cy + 40, cx - w, cy - 5);
    ctx.closePath();

    ctx.fillStyle = rgbaStr(palette.mouthOpenFill, 0.96);
    ctx.fill();

    ctx.save();
    ctx.clip();
    ctx.fillStyle = rgbaStr(palette.mouthTongue, 0.72);
    ctx.beginPath();
    ctx.ellipse(cx, cy + 30, w * 0.72, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.lineWidth = 4.6;
    ctx.stroke();
    ctx.restore();
  } else if (expression === 'asleep') {
    ctx.lineWidth = 4.6;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy + 2);
    ctx.quadraticCurveTo(cx, cy + 7, cx + 12, cy + 2);
    ctx.stroke();
  } else if (expression === 'thinking') {
    ctx.lineWidth = 5.2;
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy + 4);
    ctx.lineTo(cx + 26, cy + 2);
    ctx.stroke();
  } else if (expression === 'unsure') {
    ctx.lineWidth = 5.2;
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy + 5);
    ctx.bezierCurveTo(cx - 14, cy - 4, cx - 6, cy + 12, cx + 2, cy + 3);
    ctx.bezierCurveTo(cx + 10, cy - 5, cx + 18, cy + 10, cx + 26, cy + 2);
    ctx.stroke();
  } else {
    // Gentle anime chibi smile, ~0.022 m wide (58 px)
    ctx.lineWidth = 5.4;
    ctx.beginPath();
    ctx.moveTo(cx - 28, cy - 2);
    ctx.quadraticCurveTo(cx, cy + 14, cx + 28, cy - 2);
    ctx.stroke();
  }

  ctx.restore();
}

function renderFace(state) {
  const { ctx, width, height, cfg, palette, expression, isBlinking } = state;
  ctx.clearRect(0, 0, width, height);

  const cx = width * 0.5;
  const leftEyeX = cx - EYE_OFFSET_PX;
  const rightEyeX = cx + EYE_OFFSET_PX;

  if (cfg.blush) {
    const blushAlpha = expression === 'happy' ? 0.42 : 0.35;
    drawBlush(ctx, cx - EYE_OFFSET_PX - 54, EYE_CY + 124, blushAlpha);
    drawBlush(ctx, cx + EYE_OFFSET_PX + 54, EYE_CY + 124, blushAlpha);
  }

  if (cfg.freckles) {
    drawFreckles(ctx, palette);
  }

  drawNose(ctx, palette);
  drawMouth(ctx, expression, palette);

  const gazeX = expression === 'thinking' ? 20 : 0;
  const gazeY = expression === 'thinking' ? -18 : 0;

  const drawSingleEye = (side, ex) => {
    if (expression === 'happy') {
      drawEyeHappy(ctx, side, ex, EYE_CY, palette, cfg.lashes);
    } else if (expression === 'asleep' || isBlinking) {
      drawEyeClosed(ctx, side, ex, EYE_CY, palette, cfg.lashes);
    } else {
      drawEyeOpen(ctx, side, ex, EYE_CY, cfg.eyeShape, palette, cfg.lashes, gazeX, gazeY);
    }
  };

  drawSingleEye(-1, leftEyeX);
  drawSingleEye(1, rightEyeX);

  drawBrow(ctx, -1, leftEyeX, cfg.brow, expression, palette);
  drawBrow(ctx, 1, rightEyeX, cfg.brow, expression, palette);

  if (state.texture) {
    state.texture.needsUpdate = true;
  }
}

export function buildFace(THREE, opts, kit) {
  const cfg = {
    eye: (opts && opts.eye) || '#4e80c8',
    eyeShape: (opts && opts.eyeShape) || 'round',
    brow: (opts && opts.brow) || 'soft',
    browColor: (opts && opts.browColor) || '#593b2e',
    lip: (opts && opts.lip) || '#ad635d',
    blush: opts && opts.blush !== undefined ? Boolean(opts.blush) : true,
    freckles: Boolean(opts && opts.freckles),
    lashes: opts && opts.lashes !== undefined ? Boolean(opts.lashes) : true,
  };

  const palette = makePalette(THREE, cfg);
  const state = {
    ctx: null,
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    texture: null,
    cfg,
    palette,
    expression: 'awake',
    isBlinking: false,
  };

  const texture = kit.canvasTexture(CANVAS_SIZE, CANVAS_SIZE, (ctx, w, h) => {
    state.ctx = ctx;
    state.width = w;
    state.height = h;
    renderFace(state);
  });

  if (THREE.SRGBColorSpace && (!texture.colorSpace || texture.colorSpace === THREE.NoColorSpace)) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  texture.anisotropy = 4;
  state.texture = texture;

  const geometry = buildFacePatchGeometry(THREE);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 1,
    metalness: 0,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const faceMesh = new THREE.Mesh(geometry, material);
  faceMesh.name = 'facePatch';
  faceMesh.userData.slot = 'face';
  faceMesh.castShadow = false;
  faceMesh.receiveShadow = true;
  faceMesh.renderOrder = 2;

  const group = new THREE.Group();
  group.name = 'face';
  group.userData._faceState = state;
  group.add(faceMesh);

  return group;
}

export function setExpression(group, name) {
  const state = group && group.userData && group.userData._faceState;
  if (!state || !state.ctx) return;

  const next = VALID_EXPRESSIONS.has(name) ? name : 'awake';
  const changed = state.expression !== next;
  state.expression = next;

  if (next === 'happy' || next === 'asleep') {
    state.isBlinking = false;
  }

  if (changed) {
    renderFace(state);
  }
}

export function blink(group, t) {
  const state = group && group.userData && group.userData._faceState;
  if (!state || !state.ctx) return;

  if (state.expression === 'happy' || state.expression === 'asleep') {
    if (state.isBlinking) {
      state.isBlinking = false;
      renderFace(state);
    }
    return;
  }

  const time = Number.isFinite(t) ? t : 0;
  const cycleT = ((time % BLINK_CYCLE) + BLINK_CYCLE) % BLINK_CYCLE;
  let shouldBlink = false;
  for (let i = 0; i < BLINK_STARTS.length; i++) {
    const start = BLINK_STARTS[i];
    if (cycleT >= start && cycleT < start + BLINK_DURATION) {
      shouldBlink = true;
      break;
    }
  }

  if (shouldBlink !== state.isBlinking) {
    state.isBlinking = shouldBlink;
    renderFace(state);
  }
}
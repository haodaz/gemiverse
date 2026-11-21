export const META = {
  id: 'duckling',
  name: 'Stylised Duckling',
  kind: 'critter',
  footprint: [0.13, 0.17],
  variants: ['Yellow', 'Mallard', 'White'],
  note: 'Hero-quality chibi duckling (~0.2 m) mid-waddle with sculpted down, shaped bill, curved wings, webbed feet, and head tuft'
};

function smoothstep(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function toColor(THREE, input, fallback) {
  const c = new THREE.Color();
  try {
    if (input !== undefined && input !== null) {
      c.set(input);
      return c;
    }
  } catch (_) {}
  c.set(fallback);
  return c;
}

function colorToRgbCss(c, alpha = 1) {
  const r = Math.round(clamp(c.r, 0, 1) * 255);
  const g = Math.round(clamp(c.g, 0, 1) * 255);
  const b = Math.round(clamp(c.b, 0, 1) * 255);
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
}

function mixColors(THREE, c1, c2, t) {
  return c1.clone().lerp(c2, clamp(t, 0, 1));
}

function shiftLightness(THREE, c, deltaL, deltaS = 0, deltaH = 0) {
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const out = new THREE.Color();
  out.setHSL(
    (hsl.h + deltaH + 1) % 1,
    clamp(hsl.s + deltaS, 0, 1),
    clamp(hsl.l + deltaL, 0, 1)
  );
  return out;
}

function mirrorGeometryX(geo) {
  const g = geo.clone();
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, -pos.getX(i));
  }
  pos.needsUpdate = true;

  if (g.index) {
    const idx = g.index;
    for (let i = 0; i < idx.count; i += 3) {
      const b = idx.getX(i + 1);
      const c = idx.getX(i + 2);
      idx.setX(i + 1, c);
      idx.setX(i + 2, b);
    }
    idx.needsUpdate = true;
  } else {
    const attrs = Object.values(g.attributes);
    for (let a = 0; a < attrs.length; a++) {
      const attr = attrs[a];
      const itemSize = attr.itemSize;
      const tmp = new Float32Array(itemSize);
      for (let i = 0; i < attr.count; i += 3) {
        for (let k = 0; k < itemSize; k++) {
          tmp[k] = attr.array[(i + 1) * itemSize + k];
          attr.array[(i + 1) * itemSize + k] = attr.array[(i + 2) * itemSize + k];
          attr.array[(i + 2) * itemSize + k] = tmp[k];
        }
      }
      attr.needsUpdate = true;
    }
  }
  g.computeVertexNormals();
  return g;
}

function buildTaperedTube(THREE, curve, radialSegments, tubularSegments, radiusFn, options = {}) {
  const capStart = options.capStart !== false;
  const capEnd = options.capEnd !== false;
  const frames = curve.computeFrenetFrames(tubularSegments, false);

  const ringTs = [];
  const ringScales = [];
  const ringPts = [];
  const ringNs = [];
  const ringBs = [];

  function pushRing(t, pt, N, B, capMul) {
    const rVal = radiusFn(t);
    const rx = (typeof rVal === 'number' ? rVal : rVal.rx) * capMul;
    const ry = (typeof rVal === 'number' ? rVal : rVal.ry) * capMul;
    ringTs.push(t);
    ringScales.push([Math.max(1e-5, rx), Math.max(1e-5, ry)]);
    ringPts.push(pt);
    ringNs.push(N);
    ringBs.push(B);
  }

  if (capStart) {
    const p0 = curve.getPointAt(0);
    const t0 = frames.tangents[0];
    const r0 = radiusFn(0);
    const avgR0 = typeof r0 === 'number' ? r0 : (r0.rx + r0.ry) * 0.5;
    pushRing(0, p0.clone().addScaledVector(t0, -avgR0 * 0.65), frames.normals[0], frames.binormals[0], 0.02);
    pushRing(0, p0.clone().addScaledVector(t0, -avgR0 * 0.35), frames.normals[0], frames.binormals[0], 0.65);
  }

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    pushRing(t, curve.getPointAt(t), frames.normals[i], frames.binormals[i], 1.0);
  }

  if (capEnd) {
    const p1 = curve.getPointAt(1);
    const t1 = frames.tangents[tubularSegments];
    const r1 = radiusFn(1);
    const avgR1 = typeof r1 === 'number' ? r1 : (r1.rx + r1.ry) * 0.5;
    pushRing(1, p1.clone().addScaledVector(t1, avgR1 * 0.35), frames.normals[tubularSegments], frames.binormals[tubularSegments], 0.65);
    pushRing(1, p1.clone().addScaledVector(t1, avgR1 * 0.65), frames.normals[tubularSegments], frames.binormals[tubularSegments], 0.02);
  }

  const rings = ringPts.length;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i < rings; i++) {
    const P = ringPts[i];
    const N = ringNs[i];
    const B = ringBs[i];
    const [rx, ry] = ringScales[i];
    const vCoord = ringTs[i];

    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const ang = u * Math.PI * 2;
      const cos = -Math.cos(ang);
      const sin = Math.sin(ang);
      const vx = P.x + cos * rx * N.x + sin * ry * B.x;
      const vy = P.y + cos * rx * N.y + sin * ry * B.y;
      const vz = P.z + cos * rx * N.z + sin * ry * B.z;
      positions.push(vx, vy, vz);
      uvs.push(u, vCoord);
    }
  }

  const stride = radialSegments + 1;
  for (let i = 1; i < rings; i++) {
    for (let j = 1; j <= radialSegments; j++) {
      const a = stride * (i - 1) + (j - 1);
      const b = stride * i + (j - 1);
      const c = stride * i + j;
      const d = stride * (i - 1) + j;
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function makeFurTexture(THREE, kit, baseColor, variant, part) {
  const tex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const darkTone = variant === 2
      ? shiftLightness(THREE, baseColor, -0.06, 0.08, -0.01)
      : shiftLightness(THREE, baseColor, -0.14, 0.08, -0.025);
    const lightTone = variant === 2
      ? shiftLightness(THREE, baseColor, 0.03, -0.05, 0)
      : shiftLightness(THREE, baseColor, 0.14, -0.12, 0.01);
    const warmBelly = variant === 2
      ? shiftLightness(THREE, baseColor, -0.015, 0.12, -0.01)
      : shiftLightness(THREE, baseColor, 0.17, -0.16, 0.012);

    // Base dorsal-to-ventral gradient (y=0 in canvas is v=1 top/+Y, y=h is v=0 bottom/-Y)
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, colorToRgbCss(darkTone));
    grad.addColorStop(0.38, colorToRgbCss(baseColor));
    grad.addColorStop(0.75, colorToRgbCss(lightTone));
    grad.addColorStop(1.0, colorToRgbCss(warmBelly));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Lighter front chest / face area around u = 0.25 (+Z)
    const chestGrad = ctx.createRadialGradient(w * 0.25, h * 0.62, w * 0.03, w * 0.25, h * 0.60, w * 0.30);
    chestGrad.addColorStop(0.0, colorToRgbCss(warmBelly, 0.72));
    chestGrad.addColorStop(0.65, colorToRgbCss(lightTone, 0.28));
    chestGrad.addColorStop(1.0, colorToRgbCss(baseColor, 0.0));
    ctx.fillStyle = chestGrad;
    ctx.fillRect(0, 0, w, h);

    // Slightly warmer golden/ivory crown glow for yellow and white variants
    if (variant !== 1) {
      const backShade = ctx.createRadialGradient(w * 0.75, h * 0.30, w * 0.04, w * 0.75, h * 0.32, w * 0.32);
      backShade.addColorStop(0.0, colorToRgbCss(darkTone, variant === 2 ? 0.35 : 0.45));
      backShade.addColorStop(1.0, colorToRgbCss(darkTone, 0.0));
      ctx.fillStyle = backShade;
      ctx.fillRect(0, 0, w, h);
    }

    // Mallard duckling pattern (variant 1)
    if (variant === 1) {
      const brownDeep = mixColors(THREE, new THREE.Color('#3b2716'), baseColor, 0.12);
      const brownMid = mixColors(THREE, new THREE.Color('#5a3d22'), baseColor, 0.22);
      const spotCream = shiftLightness(THREE, baseColor, 0.20, -0.10, 0.01);

      if (part === 'head') {
        // Dark espresso-brown cap on top of head and back of nape
        for (let py = 0; py < h; py += 2) {
          const v = 1 - py / h;
          for (let px = 0; px < w; px += 2) {
            const u = px / w;
            const n = kit.noise(u * 14 + 3.1, v * 14 + 1.7);
            // Distance in u from +Z front (u=0.25)
            let duFront = Math.abs(u - 0.25);
            if (duFront > 0.5) duFront = 1 - duFront;
            // Crown cap sweeps lower toward the back nape (u ~ 0.75)
            const capEdge = 0.67 - 0.26 * smoothstep(0.10, 0.45, duFront) + (n - 0.5) * 0.07;
            let mask = smoothstep(capEdge - 0.04, capEdge + 0.05, v);

            // Signature mallard eye-stripe from bill through eye toward nape
            const eyeStripeV = 0.53 - 0.04 * smoothstep(0.05, 0.35, duFront) + (n - 0.5) * 0.025;
            const inStripeLon = smoothstep(0.05, 0.11, duFront) * (1 - smoothstep(0.32, 0.44, duFront));
            const stripeBand = Math.exp(-Math.pow((v - eyeStripeV) / 0.036, 2)) * inStripeLon;
            mask = Math.max(mask, stripeBand * 0.92);

            // Tiny cute dark cheek-dot below eye-stripe
            const dotDu = Math.abs(duFront - 0.22);
            const cheekDot = Math.exp(-(Math.pow(dotDu / 0.032, 2) + Math.pow((v - 0.42) / 0.022, 2)));
            mask = Math.max(mask, cheekDot * 0.65);

            if (mask > 0.02) {
              const mottled = mixColors(THREE, brownDeep, brownMid, kit.noise(u * 28, v * 28));
              ctx.fillStyle = colorToRgbCss(mottled, mask * 0.92);
              ctx.fillRect(px, py, 2, 2);
            }
          }
        }
      } else {
        // Mallard body: dark mottled brown back saddle + two iconic pale yellow back/rump spots
        for (let py = 0; py < h; py += 2) {
          const v = 1 - py / h;
          for (let px = 0; px < w; px += 2) {
            const u = px / w;
            const n = kit.noise(u * 12 + 5.2, v * 12 + 2.4);
            let duBack = Math.abs(u - 0.75);
            if (duBack > 0.5) duBack = 1 - duBack;

            // Back saddle mask
            const saddleV = 0.38 + 0.26 * smoothstep(0.18, 0.42, duBack) + (n - 0.5) * 0.08;
            let mask = smoothstep(saddleV - 0.06, saddleV + 0.06, v) * (1 - smoothstep(0.30, 0.46, duBack));
            // Also dark top of back near neck
            mask = Math.max(mask, smoothstep(0.76 + (n - 0.5) * 0.06, 0.86, v) * 0.85);

            // Cute pale yellow duckling spots on each side of the back/wings
            const spotU1 = Math.abs(duBack - 0.14);
            const spotUpper = Math.exp(-(Math.pow(spotU1 / 0.065, 2) + Math.pow((v - 0.66) / 0.055, 2)));
            const spotLower = Math.exp(-(Math.pow((duBack - 0.10) / 0.055, 2) + Math.pow((v - 0.50) / 0.048, 2)));
            const spotMask = Math.max(spotUpper, spotLower * 0.9);

            if (mask > 0.02) {
              const featherMottle = kit.noise(u * 32 + 1.3, v * 32 + 4.1);
              const c = mixColors(THREE, brownDeep, brownMid, featherMottle);
              const finalAlpha = clamp(mask * (1 - spotMask * 0.88), 0, 1) * 0.93;
              if (finalAlpha > 0.01) {
                ctx.fillStyle = colorToRgbCss(c, finalAlpha);
                ctx.fillRect(px, py, 2, 2);
              }
            }
            if (spotMask > 0.18) {
              ctx.fillStyle = colorToRgbCss(spotCream, (spotMask - 0.18) * 0.72);
              ctx.fillRect(px, py, 2, 2);
            }
          }
        }
      }
    }

    // Soft downy feather flecks over the entire surface
    ctx.lineCap = 'round';
    for (let i = 0; i < 2400; i++) {
      const rx = kit.noise(i * 0.37, 1.13);
      const ry = kit.noise(2.71, i * 0.53);
      const x = ((i * 73.13 + rx * 41) % w);
      const y = ((i * 191.7 + ry * 53) % h);
      const n = kit.noise(x * 0.045, y * 0.045);
      const len = 4 + n * 7;
      const angle = Math.PI * 0.5 + (n - 0.5) * 0.65;
      const bright = n > 0.52;
      const fleckCol = bright
        ? shiftLightness(THREE, baseColor, variant === 2 ? 0.04 : 0.16, -0.08, 0)
        : shiftLightness(THREE, baseColor, variant === 2 ? -0.07 : -0.13, 0.06, -0.01);
      ctx.strokeStyle = colorToRgbCss(fleckCol, variant === 2 ? 0.16 : 0.18);
      ctx.lineWidth = 0.8 + (1 - n) * 1.1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
      ctx.stroke();
    }
  });

  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeFurBumpTexture(THREE, kit) {
  const tex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);

    // Soft cloud down clumps
    for (let py = 0; py < h; py += 4) {
      for (let px = 0; px < w; px += 4) {
        const n = kit.noise(px * 0.04, py * 0.04) * 0.65 + kit.noise(px * 0.12, py * 0.12) * 0.35;
        const v = Math.round(100 + n * 55);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(px, py, 4, 4);
      }
    }

    // Directional fine downy strokes
    ctx.lineCap = 'round';
    for (let i = 0; i < 2800; i++) {
      const x = (i * 97.31 + kit.noise(i * 0.23, 3.7) * 60) % w;
      const y = (i * 157.9 + kit.noise(4.1, i * 0.41) * 60) % h;
      const n = kit.noise(x * 0.05, y * 0.05);
      const len = 4 + n * 7;
      const ang = Math.PI * 0.5 + (n - 0.5) * 0.55;
      const lum = n > 0.5 ? 215 : 65;
      ctx.strokeStyle = `rgba(${lum},${lum},${lum},0.22)`;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
  });

  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeAccentTexture(THREE, kit, accentColor, isFeet) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const deep = shiftLightness(THREE, accentColor, -0.12, 0.08, -0.015);
    const bright = shiftLightness(THREE, accentColor, 0.11, -0.05, 0.015);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, colorToRgbCss(bright));
    grad.addColorStop(0.55, colorToRgbCss(accentColor));
    grad.addColorStop(1.0, colorToRgbCss(deep));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle natural organic mottling & scale pebble grain
    for (let py = 0; py < h; py += 3) {
      for (let px = 0; px < w; px += 3) {
        const n1 = kit.noise(px * 0.05, py * 0.05);
        const n2 = kit.noise(px * 0.18 + 7.1, py * 0.18 + 2.3);
        const mix = isFeet ? (n1 * 0.5 + n2 * 0.5) : (n1 * 0.8 + n2 * 0.2);
        const col = mix > 0.5 ? bright : deep;
        const alpha = Math.abs(mix - 0.5) * (isFeet ? 0.34 : 0.22);
        ctx.fillStyle = colorToRgbCss(col, alpha);
        ctx.fillRect(px, py, 3, 3);
      }
    }

    if (isFeet) {
      // Soft transverse toe-scale bands
      ctx.strokeStyle = colorToRgbCss(deep, 0.18);
      ctx.lineWidth = 1.6;
      for (let y = 10; y < h; y += 14) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 16) {
          const wy = y + Math.sin(x * 0.08) * 2.2;
          if (x === 0) ctx.moveTo(x, wy);
          else ctx.lineTo(x, wy);
        }
        ctx.stroke();
      }
    }
  });

  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeAccentBumpTexture(THREE, kit) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    for (let py = 0; py < h; py += 2) {
      for (let px = 0; px < w; px += 2) {
        const n = kit.noise(px * 0.16, py * 0.16) * 0.65 + kit.noise(px * 0.06, py * 0.06) * 0.35;
        const v = Math.round(96 + n * 64);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(px, py, 2, 2);
      }
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeIrisTexture(THREE, kit, eyeColor) {
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    const darkRim = shiftLightness(THREE, eyeColor, -0.22, 0.10, 0);
    const warmGlow = shiftLightness(THREE, eyeColor, 0.18, 0.12, 0.025);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, colorToRgbCss(darkRim));
    grad.addColorStop(0.45, colorToRgbCss(eyeColor));
    grad.addColorStop(0.82, colorToRgbCss(warmGlow));
    grad.addColorStop(1.0, colorToRgbCss(darkRim));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle iris striation
    for (let x = 0; x < w; x += 2) {
      const n = kit.noise(x * 0.25, 2.5);
      ctx.fillStyle = colorToRgbCss(n > 0.5 ? warmGlow : darkRim, 0.24);
      ctx.fillRect(x, 0, 1.5, h);
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeBlushTexture(THREE, kit) {
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w * 0.5;
    const cy = h * 0.5;
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, w * 0.46);
    g.addColorStop(0.0, 'rgba(244, 134, 126, 0.68)');
    g.addColorStop(0.45, 'rgba(244, 146, 138, 0.36)');
    g.addColorStop(0.8, 'rgba(244, 160, 150, 0.08)');
    g.addColorStop(1.0, 'rgba(244, 160, 150, 0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function sculptBodyGeometry(THREE, kit) {
  const geo = new THREE.SphereGeometry(1, 64, 48);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    // Base plump teardrop duckling proportions
    let x = nx * 0.0435;
    let y = ny * 0.040;
    let z = nz * 0.059;

    // Plump forward-bulging downy breast
    const chestMask = Math.max(0, nz) * smoothstep(-0.65, 0.35, ny) * (1 - smoothstep(0.45, 0.92, ny));
    z += 0.0085 * chestMask;
    x *= 1 + 0.09 * Math.max(0, nz) * (1 - Math.abs(ny) * 0.5);

    // Softly flattened underside belly so weight feels cozy and grounded
    if (ny < -0.15) {
      const bellyT = smoothstep(-0.15, -0.95, ny);
      y += 0.0065 * bellyT;
      x *= 1 + 0.07 * bellyT;
    }

    // Upturned cute duckling rump & narrowing tail base
    if (nz < -0.05) {
      const backT = smoothstep(-0.05, -1.0, nz);
      y += 0.023 * Math.pow(backT, 1.55);
      x *= 1 - 0.38 * Math.pow(backT, 1.45);
      // Taper vertical thickness toward rump tip
      const rumpCenterY = 0.015 * Math.pow(backT, 1.4);
      y = rumpCenterY + (y - rumpCenterY) * (1 - 0.24 * Math.pow(backT, 1.6));
    }

    // Gentle avian S-curve dip across mid-back
    const backDip = Math.exp(-Math.pow((nz + 0.14) / 0.38, 2)) * smoothstep(0.18, 0.85, ny);
    y -= 0.0052 * backDip;

    // Rising shoulder-to-neck collar so the head nests seamlessly inside
    const neckMask = Math.exp(-(Math.pow(nx / 0.56, 2) + Math.pow((nz - 0.44) / 0.52, 2))) * smoothstep(0.12, 0.85, ny);
    y += 0.0145 * neckMask;
    z += 0.0065 * neckMask;

    // Subtle hip/drumstick down puffs on lower flanks where legs emerge
    const hipL = Math.exp(-(Math.pow((nx - 0.52) / 0.34, 2) + Math.pow((ny + 0.62) / 0.35, 2) + Math.pow((nz - 0.06) / 0.38, 2)));
    const hipR = Math.exp(-(Math.pow((nx + 0.52) / 0.34, 2) + Math.pow((ny + 0.62) / 0.35, 2) + Math.pow((nz + 0.08) / 0.38, 2)));
    const hipMask = hipL + hipR;
    y -= 0.0042 * hipMask;
    x += Math.sign(nx) * 0.0022 * hipMask;

    // Very soft organic downy micro-relief
    const fluff = (kit.noise(nx * 4.5 + 2.1, ny * 4.5 + nz * 4.5 + 3.4) - 0.5) * 0.0009;
    x += nx * fluff;
    y += ny * fluff;
    z += nz * fluff;

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function evalHeadPoint(nx, ny, nz, kit) {
  let x = nx * 0.039;
  let y = ny * 0.0375;
  let z = nz * 0.040;

  // Chubby soft cheeks
  const cheekMask = Math.exp(-(
    Math.pow((Math.abs(nx) - 0.72) / 0.44, 2) +
    Math.pow((ny + 0.18) / 0.46, 2) +
    Math.pow((nz - 0.22) / 0.58, 2)
  ));
  x += Math.sign(nx) * 0.0065 * cheekMask;
  z += 0.0028 * cheekMask;
  y -= 0.0022 * cheekMask;

  // Gentle tapered dome crown and cozy rounded forehead
  if (ny > 0.15) {
    const crownT = smoothstep(0.15, 0.95, ny);
    x *= 1 - 0.12 * crownT;
    z *= 1 - 0.06 * crownT;
  }
  const forehead = Math.exp(-(Math.pow(nx / 0.62, 2) + Math.pow((ny - 0.42) / 0.40, 2))) * smoothstep(0.15, 0.95, nz);
  z += 0.0032 * forehead;

  // Gentle eye socket pockets so eyes sit slightly inset, never floating
  const eyeSocket = Math.exp(-(
    Math.pow((Math.abs(nx) - 0.58) / 0.22, 2) +
    Math.pow((ny - 0.10) / 0.22, 2) +
    Math.pow((nz - 0.80) / 0.26, 2)
  ));
  x -= nx * 0.0025 * eyeSocket;
  y -= ny * 0.0025 * eyeSocket;
  z -= nz * 0.0025 * eyeSocket;

  // Subtle cute brow cushion just above eye sockets
  const brow = Math.exp(-(
    Math.pow((Math.abs(nx) - 0.50) / 0.26, 2) +
    Math.pow((ny - 0.34) / 0.16, 2) +
    Math.pow((nz - 0.78) / 0.28, 2)
  ));
  z += 0.0018 * brow;
  y += 0.0010 * brow;

  // Soft bill-root pad on lower front face
  const muzzlePad = Math.exp(-(
    Math.pow(nx / 0.42, 2) +
    Math.pow((ny + 0.24) / 0.28, 2)
  )) * smoothstep(0.45, 0.96, nz);
  z += 0.0024 * muzzlePad;

  // Deeply overlapping flared neck skirt at base of head for seamless join to body
  if (ny < -0.35) {
    const neckT = smoothstep(-0.35, -1.0, ny);
    y -= 0.015 * Math.pow(neckT, 1.3);
    x *= 1 + 0.14 * neckT;
    z *= 1 + 0.10 * neckT;
    z -= 0.004 * neckT;
  }

  // Subtle downy surface noise
  const fluff = (kit.noise(nx * 5.0 + 7.2, ny * 5.0 + nz * 5.0 + 1.5) - 0.5) * 0.0006;
  x += nx * fluff;
  y += ny * fluff;
  z += nz * fluff;

  // Shift up relative to neck pivot at y=0
  return [x, y + 0.025, z + 0.002];
}

function sculptHeadGeometry(THREE, kit) {
  const geo = new THREE.SphereGeometry(1, 64, 48);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = evalHeadPoint(pos.getX(i), pos.getY(i), pos.getZ(i), kit);
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function makeCheekBlushGeometry(THREE, kit, side) {
  // Curved patch projected right onto the sculpted cheek surface + 0.55 mm outward offset
  const segU = 12;
  const segV = 10;
  const positions = [];
  const uvs = [];
  const indices = [];

  // Center direction on cheek just below and behind the eye
  const centerTheta = Math.PI * 0.5 + 0.22; // slightly below equator
  const centerPhi = Math.PI * 0.5 - side * 0.88; // front-side cheek
  const spanTheta = 0.24;
  const spanPhi = 0.28;

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    const theta = centerTheta + (v - 0.5) * spanTheta;
    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const phi = centerPhi + (u - 0.5) * spanPhi;

      const nx = -Math.cos(phi) * Math.sin(theta);
      const ny = Math.cos(theta);
      const nz = Math.sin(phi) * Math.sin(theta);

      const [hx, hy, hz] = evalHeadPoint(nx, ny, nz, kit);
      const off = 0.00055;
      positions.push(hx + nx * off, hy + ny * off, hz + nz * off);
      uvs.push(u, 1 - v);
    }
  }

  const stride = segU + 1;
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * stride + iu;
      const b = (iv + 1) * stride + iu;
      const c = (iv + 1) * stride + iu + 1;
      const d = iv * stride + iu + 1;
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function sculptUpperBillGeometry(THREE) {
  const geo = new THREE.SphereGeometry(1, 48, 32);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    // t along bill length: 0 at base (embedded in head), 1 at front tip
    const t = (nz + 1) * 0.5;

    // Duckling spoon-width profile: slightly wider base, gentle waist, cute rounded paddle front
    const spoonWidth = 0.0128 * (0.94 + 0.14 * Math.sin(t * Math.PI * 0.92) - 0.12 * Math.pow(Math.max(0, t - 0.65) / 0.35, 2));
    let x = nx * spoonWidth;

    // Bill length
    let z = -0.007 + t * 0.032;

    // Upper bill arch + gentle concave bridge + cheerful subtle upturned tip
    const baseHeight = 0.0078 * (1 - 0.54 * smoothstep(0.05, 0.92, t));
    let y;
    if (ny >= 0) {
      y = ny * baseHeight;
      // Smooth duckling culmen scoop in middle
      y -= 0.0014 * Math.sin(t * Math.PI) * Math.pow(ny, 0.7);
      // Cute bill nail dome right at the front tip
      const nail = Math.exp(-(Math.pow(nx / 0.36, 2) + Math.pow((t - 0.90) / 0.12, 2))) * smoothstep(0.1, 0.7, ny);
      y += 0.00095 * nail;
      z += 0.0006 * nail;
    } else {
      // Gently concave underside that hugs the lower bill
      y = ny * 0.0022 * (1 - 0.45 * t);
    }

    // Cheerful smile curve along the bill rim
    const smileLift = 0.0022 * Math.pow(Math.max(0, t - 0.48) / 0.52, 1.8) + 0.0015 * Math.pow(1 - t, 1.6) * (1 - Math.abs(nx) * 0.5);
    y += smileLift;

    // Tiny oblique nostril dimples on upper-sides near base
    const nostril = Math.exp(-(
      Math.pow((Math.abs(nx) - 0.38) / 0.11, 2) +
      Math.pow((t - 0.36) / 0.075, 2)
    )) * smoothstep(0.25, 0.75, ny);
    y -= 0.0011 * nostril;

    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function sculptLowerBillGeometry(THREE) {
  const geo = new THREE.SphereGeometry(1, 36, 24);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    const t = (nz + 1) * 0.5;
    const width = 0.0108 * (0.95 + 0.08 * Math.sin(t * Math.PI));
    const x = nx * width;
    const z = -0.007 + t * 0.0295;

    let y = ny < 0
      ? ny * 0.0044 * (1 - 0.45 * t)
      : ny * 0.0016 * (1 - 0.4 * t);

    // Match the smile curve of the upper bill
    y -= 0.0020;
    y += 0.0021 * Math.pow(Math.max(0, t - 0.48) / 0.52, 1.8);
    y += 0.0011 * Math.pow(1 - t, 1.6);

    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function makeMouthLineGeometry(THREE) {
  // Subtle smiling parting line tucked cleanly between upper & lower bill
  const pts = [
    new THREE.Vector3(-0.0114, 0.0014, 0.0012),
    new THREE.Vector3(-0.0118, -0.0007, 0.0105),
    new THREE.Vector3(-0.0086, -0.0002, 0.0205),
    new THREE.Vector3(0.0, 0.0009, 0.0238),
    new THREE.Vector3(0.0086, -0.0002, 0.0205),
    new THREE.Vector3(0.0118, -0.0007, 0.0105),
    new THREE.Vector3(0.0114, 0.0014, 0.0012)
  ];
  const curve = new THREE.CatmullRomCurve3(pts);
  return buildTaperedTube(THREE, curve, 8, 28, (t) => {
    const endFade = Math.sin(t * Math.PI);
    return 0.00032 + 0.00030 * Math.pow(endFade, 0.6);
  });
}

function buildEyeGroup(THREE, irisMat, eyeballMat, highlightMat, side) {
  const eyeGroup = new THREE.Group();
  eyeGroup.name = side > 0 ? 'eyeL' : 'eyeR';

  // Layer 1: Dark glossy eyeball
  const ballGeo = new THREE.SphereGeometry(0.0078, 28, 20);
  ballGeo.scale(1.0, 1.07, 0.72);
  const ball = new THREE.Mesh(ballGeo, eyeballMat);
  eyeGroup.add(ball);

  // Layer 2: Coloured iris ring built with LatheGeometry (18 profile points) hugging the front curvature
  const lathePts = [];
  const rOuter = 0.0063;
  const rInner = 0.0041;
  const steps = 17;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    // Sweep smoothly across the curved iris ring profile
    const r = rInner + (rOuter - rInner) * Math.sin(f * Math.PI * 0.5);
    const normR = clamp(r / 0.0078, 0, 0.96);
    const zSurf = Math.sqrt(Math.max(0.01, 1 - normR * normR)) * 0.0078 * 0.72 + 0.00022;
    lathePts.push(new THREE.Vector2(r, zSurf));
  }
  const irisGeo = new THREE.LatheGeometry(lathePts, 28);
  irisGeo.rotateX(Math.PI / 2);
  irisGeo.scale(1.0, 1.07, 1.0);
  const iris = new THREE.Mesh(irisGeo, irisMat);
  iris.userData.slot = 'eye';
  eyeGroup.add(iris);

  // Deep dark glossy pupil dome sitting proud inside iris center
  const pupilGeo = new THREE.SphereGeometry(0.0044, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55);
  pupilGeo.rotateX(Math.PI / 2);
  pupilGeo.scale(1.0, 1.07, 0.45);
  const pupil = new THREE.Mesh(pupilGeo, eyeballMat);
  pupil.position.z = 0.00385;
  eyeGroup.add(pupil);

  // Layer 3: Two crisp white catchlight dots placed up and to one consistent light side
  const hi1Geo = new THREE.SphereGeometry(0.00175, 14, 10);
  hi1Geo.scale(1.05, 0.92, 0.42);
  const hi1 = new THREE.Mesh(hi1Geo, highlightMat);
  hi1.position.set(0.0019, 0.0025, 0.00545);
  hi1.rotation.set(-0.28, 0.24, 0.15);
  eyeGroup.add(hi1);

  const hi2Geo = new THREE.SphereGeometry(0.00085, 12, 8);
  hi2Geo.scale(1.0, 1.0, 0.45);
  const hi2 = new THREE.Mesh(hi2Geo, highlightMat);
  hi2.position.set(-0.0020, -0.0020, 0.00535);
  eyeGroup.add(hi2);

  return eyeGroup;
}

function buildHeadTuft(THREE, furMat) {
  const tuftGroup = new THREE.Group();

  const specs = [
    // Main playful curling central-right tuft
    {
      pts: [
        new THREE.Vector3(0.000, -0.004, 0.001),
        new THREE.Vector3(0.001, 0.006, 0.002),
        new THREE.Vector3(0.004, 0.015, 0.006),
        new THREE.Vector3(0.002, 0.021, 0.011)
      ],
      rx: 0.0036,
      ry: 0.0024
    },
    // Secondary back-left tuft
    {
      pts: [
        new THREE.Vector3(-0.002, -0.004, -0.002),
        new THREE.Vector3(-0.004, 0.005, -0.004),
        new THREE.Vector3(-0.007, 0.012, -0.006),
        new THREE.Vector3(-0.006, 0.016, -0.002)
      ],
      rx: 0.0030,
      ry: 0.0020
    },
    // Tiny cute forward wisp
    {
      pts: [
        new THREE.Vector3(0.002, -0.003, 0.004),
        new THREE.Vector3(0.003, 0.003, 0.008),
        new THREE.Vector3(0.001, 0.009, 0.013)
      ],
      rx: 0.0022,
      ry: 0.0016
    }
  ];

  for (let i = 0; i < specs.length; i++) {
    const s = specs[i];
    const curve = new THREE.CatmullRomCurve3(s.pts);
    const geo = buildTaperedTube(THREE, curve, 10, 18, (t) => {
      const env = Math.pow(1 - t, 0.85) * (0.65 + 0.55 * Math.sin(Math.min(1, t * 2.2) * Math.PI * 0.5));
      return { rx: s.rx * env, ry: s.ry * env };
    });
    const mesh = new THREE.Mesh(geo, furMat);
    mesh.userData.slot = 'fur';
    tuftGroup.add(mesh);
  }

  return tuftGroup;
}

function makeCurvedWingGeometry(THREE, isCovert) {
  // Drawn in 2D: +X sweeps backward toward tail, +Y is upward; extruded along Z then curved around body flank
  const shape = new THREE.Shape();
  if (!isCovert) {
    shape.moveTo(0.0, 0.013);
    shape.bezierCurveTo(0.014, 0.017, 0.032, 0.013, 0.044, 0.004);
    // Scalloped soft primary feather tip 1
    shape.bezierCurveTo(0.049, 0.001, 0.049, -0.005, 0.042, -0.006);
    // Scalloped feather tip 2
    shape.bezierCurveTo(0.043, -0.010, 0.038, -0.014, 0.031, -0.012);
    // Scalloped feather tip 3
    shape.bezierCurveTo(0.028, -0.016, 0.020, -0.018, 0.012, -0.015);
    // Plump rounded shoulder bottom
    shape.bezierCurveTo(0.002, -0.013, -0.006, -0.006, -0.005, 0.004);
    shape.bezierCurveTo(-0.005, 0.009, -0.002, 0.012, 0.0, 0.013);
  } else {
    shape.moveTo(0.001, 0.010);
    shape.bezierCurveTo(0.012, 0.012, 0.023, 0.008, 0.030, 0.001);
    shape.bezierCurveTo(0.032, -0.003, 0.027, -0.008, 0.020, -0.007);
    shape.bezierCurveTo(0.016, -0.011, 0.008, -0.010, 0.002, -0.006);
    shape.bezierCurveTo(-0.003, -0.003, -0.003, 0.008, 0.001, 0.010);
  }

  const extrudeSettings = {
    depth: isCovert ? 0.0028 : 0.0048,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 3,
    bevelSize: isCovert ? 0.0016 : 0.0026,
    bevelThickness: isCovert ? 0.0016 : 0.0026,
    curveSegments: 20
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  const pos = geo.attributes.position;

  // Map extruded (ex, ey, ez) into left-wing (+X side) coordinates and curve smoothly around body flank
  for (let i = 0; i < pos.count; i++) {
    const ex = pos.getX(i);
    const ey = pos.getY(i);
    const ez = pos.getZ(i) - extrudeSettings.depth * 0.5;

    const u = clamp((ex + 0.006) / 0.055, 0, 1);

    // Taper thickness smoothly from plump shoulder to soft thin trailing feather tips
    const thickScale = (1.15 - 0.65 * Math.pow(u, 0.9));
    let lx = ez * thickScale;
    let ly = ey;
    let lz = -ex; // trailing tips point backward (-Z)

    // Curve inward around the plump body flank along length & gently cup vertically
    const wrapArc = 0.012 * Math.sin(u * Math.PI * 0.85) - 0.0075 * Math.pow(u, 1.8);
    const verticalCup = -0.0045 * Math.pow(ey / 0.016, 2);
    lx += wrapArc + verticalCup + (isCovert ? 0.0024 : 0.0);

    // Subtle upward swoop at the trailing wingtips
    ly += 0.0045 * Math.pow(u, 1.9);

    pos.setXYZ(i, lx, ly, lz);
  }

  // Remap UVs smoothly so fur texture matches body flanks cleanly
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    uv.setXY(i, 0.55 - pz * 3.0 + px * 0.8, 0.55 + py * 5.0);
  }
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function buildTailGroup(THREE, furMat) {
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tail';

  // Sculpted continuous upturned tail base deeply nested into the body rump
  const stubGeo = new THREE.SphereGeometry(1, 36, 24);
  const pos = stubGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    const backT = clamp((-nz + 1) * 0.5, 0, 1); // 0 at front (in body), 1 at tail tip
    const taper = 1 - 0.68 * Math.pow(backT, 1.15);
    const x = nx * 0.022 * taper;
    const y = ny * 0.0155 * taper + 0.014 * Math.pow(backT, 1.45);
    const z = 0.010 - backT * 0.036;
    pos.setXYZ(i, x, y, z);
  }
  stubGeo.computeVertexNormals();
  const stub = new THREE.Mesh(stubGeo, furMat);
  stub.userData.slot = 'fur';
  tailGroup.add(stub);

  // Three curved extruded downy tail-tip feathers fanning slightly upward
  const featherShape = new THREE.Shape();
  featherShape.moveTo(0, 0);
  featherShape.bezierCurveTo(0.0055, 0.003, 0.0065, 0.014, 0.0, 0.021);
  featherShape.bezierCurveTo(-0.0065, 0.014, -0.0055, 0.003, 0, 0);

  const fGeo = new THREE.ExtrudeGeometry(featherShape, {
    depth: 0.0018,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 3,
    bevelSize: 0.0012,
    bevelThickness: 0.0012,
    curveSegments: 16
  });
  const fPos = fGeo.attributes.position;
  for (let i = 0; i < fPos.count; i++) {
    const ex = fPos.getX(i);
    const ey = fPos.getY(i);
    const ez = fPos.getZ(i) - 0.0009;
    const u = clamp(ey / 0.021, 0, 1);
    const lx = ex * (1 - 0.25 * u);
    const ly = ez * (1 - 0.45 * u) + 0.006 * Math.pow(u, 1.8);
    const lz = -ey;
    fPos.setXYZ(i, lx, ly, lz);
  }
  fGeo.computeVertexNormals();

  const configs = [
    { x: 0, y: 0.007, z: -0.012, ry: 0, rx: 0.22, s: 1.0 },
    { x: 0.0045, y: 0.005, z: -0.010, ry: -0.26, rx: 0.14, s: 0.85 },
    { x: -0.0045, y: 0.005, z: -0.010, ry: 0.26, rx: 0.14, s: 0.85 }
  ];
  for (let i = 0; i < configs.length; i++) {
    const c = configs[i];
    const m = new THREE.Mesh(fGeo, furMat);
    m.position.set(c.x, c.y, c.z);
    m.rotation.set(c.rx, c.ry, 0);
    m.scale.setScalar(c.s);
    m.userData.slot = 'fur';
    tailGroup.add(m);
  }

  return tailGroup;
}

function makeThighCuffGeometry(THREE, kit) {
  // Rotational downy feather cuff at top of leg built with LatheGeometry (18 profile points)
  const pts = [];
  const count = 18;
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    // t=0 bottom ankle flare, t=1 top embedded inside body
    const y = -0.008 + t * 0.020;
    const r = 0.0055 + 0.0095 * Math.sin(Math.pow(t, 0.72) * Math.PI * 0.88) + 0.0018 * Math.sin(t * Math.PI * 3) * (1 - t);
    pts.push(new THREE.Vector2(Math.max(0.001, r), y));
  }
  const geo = new THREE.LatheGeometry(pts, 28);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n = (kit.noise(x * 180 + 3.1, z * 180 + y * 120) - 0.5) * 0.0014;
    pos.setXYZ(i, x + n, y, z + n);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildWebbedFoot(THREE, footMat, clawMat, curled) {
  const footGroup = new THREE.Group();

  // Toe endpoints in XZ (with sole resting flat on y = 0)
  const toes = [
    { ang: -0.44, len: 0.031, rBase: 0.0033, rTip: 0.0020 },
    { ang: 0.0,   len: 0.036, rBase: 0.0036, rTip: 0.0022 },
    { ang: 0.45,  len: 0.0315, rBase: 0.0033, rTip: 0.0020 }
  ];

  // 1. Extruded scalloped webbing membrane drawn with bezierCurveTo
  const webShape = new THREE.Shape();
  // Start at rounded heel (-Y in 2D shape will map to -Z in 3D)
  webShape.moveTo(-0.0052, -0.0075);
  webShape.bezierCurveTo(-0.0068, -0.001, -0.0105, 0.011, Math.sin(toes[0].ang) * toes[0].len - 0.002, Math.cos(toes[0].ang) * toes[0].len - 0.002);
  // Left toe rounded tip
  webShape.bezierCurveTo(
    Math.sin(toes[0].ang) * (toes[0].len + 0.002), Math.cos(toes[0].ang) * (toes[0].len + 0.002),
    Math.sin(toes[0].ang) * toes[0].len + 0.003, Math.cos(toes[0].ang) * toes[0].len + 0.001,
    Math.sin(toes[0].ang) * (toes[0].len - 0.0015) + 0.003, Math.cos(toes[0].ang) * (toes[0].len - 0.0015)
  );
  // Scalloped concave web between toe 0 and toe 1
  webShape.bezierCurveTo(
    -0.0085, 0.0215,
    -0.0042, 0.0225,
    -0.0025, toes[1].len - 0.002
  );
  // Middle toe rounded tip
  webShape.bezierCurveTo(
    -0.0022, toes[1].len + 0.0022,
    0.0022, toes[1].len + 0.0022,
    0.0025, toes[1].len - 0.002
  );
  // Scalloped concave web between toe 1 and toe 2
  webShape.bezierCurveTo(
    0.0042, 0.0225,
    0.0085, 0.0215,
    Math.sin(toes[2].ang) * (toes[2].len - 0.0015) - 0.003, Math.cos(toes[2].ang) * (toes[2].len - 0.0015)
  );
  // Right toe rounded tip
  webShape.bezierCurveTo(
    Math.sin(toes[2].ang) * toes[2].len - 0.003, Math.cos(toes[2].ang) * toes[2].len + 0.001,
    Math.sin(toes[2].ang) * (toes[2].len + 0.002), Math.cos(toes[2].ang) * (toes[2].len + 0.002),
    Math.sin(toes[2].ang) * toes[2].len + 0.002, Math.cos(toes[2].ang) * toes[2].len - 0.002
  );
  // Outer edge back to heel
  webShape.bezierCurveTo(0.0105, 0.011, 0.0068, -0.001, 0.0052, -0.0075);
  webShape.bezierCurveTo(0.0035, -0.0105, -0.0035, -0.0105, -0.0052, -0.0075);

  const webDepth = 0.0016;
  const webBevel = 0.0011;
  const webGeo = new THREE.ExtrudeGeometry(webShape, {
    depth: webDepth,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 2,
    bevelSize: webBevel,
    bevelThickness: webBevel,
    curveSegments: 18
  });

  // Rotate so shape X->X, shape Y->Z, extrusion Z->Y, with flat bottom resting at y = 0
  const wPos = webGeo.attributes.position;
  for (let i = 0; i < wPos.count; i++) {
    const sx = wPos.getX(i);
    const sy = wPos.getY(i);
    const sz = wPos.getZ(i);

    const x = sx;
    const z = sy;
    let y = sz + webBevel; // bottom at y = 0, top at webDepth + 2*webBevel (~0.0038)

    // Thicken softly at heel/ankle base and thin gently across outer webbing
    const forwardT = clamp((z + 0.008) / 0.044, 0, 1);
    if (y > 0.0015) {
      y *= (1.18 - 0.42 * forwardT);
    }

    // For the mid-waddle raised foot, gently curl the toes downward
    if (curled) {
      const curlDrop = 0.0068 * Math.pow(Math.max(0, (z - 0.004) / 0.034), 1.85);
      y -= curlDrop;
    }

    wPos.setXYZ(i, x, y, z);
  }
  webGeo.computeVertexNormals();
  const webMesh = new THREE.Mesh(webGeo, footMat);
  webMesh.userData.slot = 'furAccent';
  footGroup.add(webMesh);

  // 2. Plump 3D tapered-tube toes embedded smoothly along the webbing + rounded claws
  for (let i = 0; i < toes.length; i++) {
    const toe = toes[i];
    const dx = Math.sin(toe.ang);
    const dz = Math.cos(toe.ang);

    const curlAt = (f) => curled ? -0.0068 * Math.pow(Math.max(0, (f * toe.len - 0.004) / 0.034), 1.85) : 0;

    const pts = [
      new THREE.Vector3(dx * 0.001, 0.0042, dz * 0.001),
      new THREE.Vector3(dx * toe.len * 0.35, 0.0034 + curlAt(0.35), dz * toe.len * 0.35),
      new THREE.Vector3(dx * toe.len * 0.72, 0.0028 + curlAt(0.72), dz * toe.len * 0.72),
      new THREE.Vector3(dx * (toe.len - 0.0005), 0.0022 + curlAt(1.0), dz * (toe.len - 0.0005))
    ];
    const toeCurve = new THREE.CatmullRomCurve3(pts);
    const toeGeo = buildTaperedTube(THREE, toeCurve, 12, 16, (t) => {
      const r = toe.rBase + (toe.rTip - toe.rBase) * t;
      // Slight gentle knuckle fullness in the middle of each toe
      const knuckle = 1 + 0.10 * Math.sin(t * Math.PI * 2) * (1 - t * 0.5);
      return { rx: r * 1.12 * knuckle, ry: r * 0.78 * knuckle };
    });
    const toeMesh = new THREE.Mesh(toeGeo, footMat);
    toeMesh.userData.slot = 'furAccent';
    footGroup.add(toeMesh);

    // Tiny glossy rounded toe nail at tip
    const tipEnd = pts[pts.length - 1];
    const nailCurve = new THREE.CatmullRomCurve3([
      tipEnd.clone().add(new THREE.Vector3(0, 0.0002, 0)),
      tipEnd.clone().add(new THREE.Vector3(dx * 0.0022, -0.0002, dz * 0.0022)),
      tipEnd.clone().add(new THREE.Vector3(dx * 0.0042, -0.0010, dz * 0.0042))
    ]);
    const nailGeo = buildTaperedTube(THREE, nailCurve, 8, 8, (t) => {
      const s = Math.max(0.15, 1 - t * 0.85);
      return { rx: 0.00145 * s, ry: 0.0010 * s };
    });
    const nailMesh = new THREE.Mesh(nailGeo, clawMat);
    nailMesh.userData.slot = 'furAccent';
    footGroup.add(nailMesh);
  }

  // 3. Cute tiny hind toe (hallux) on back of ankle
  const halluxCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.0075, -0.002),
    new THREE.Vector3(0, 0.0062, -0.0065),
    new THREE.Vector3(0, 0.0042, -0.0102)
  ]);
  const halluxGeo = buildTaperedTube(THREE, halluxCurve, 8, 8, (t) => 0.0019 * (1 - 0.55 * t));
  const halluxMesh = new THREE.Mesh(halluxGeo, footMat);
  halluxMesh.userData.slot = 'furAccent';
  footGroup.add(halluxMesh);

  return footGroup;
}

function buildLegAssembly(THREE, kit, furMat, footMat, clawMat, side, isRaised) {
  const legGroup = new THREE.Group();
  legGroup.name = side > 0 ? 'legL' : 'legR';

  // Downy thigh feather cuff deeply embedded in body hip
  const cuffGeo = makeThighCuffGeometry(THREE, kit);
  const cuff = new THREE.Mesh(cuffGeo, furMat);
  cuff.position.set(0, 0.002, 0);
  cuff.userData.slot = 'fur';
  legGroup.add(cuff);

  // Tapered leg shaft (tarsus) along a gentle avian S-curve
  const ankleY = isRaised ? -0.032 : -0.039;
  const ankleZ = isRaised ? 0.007 : 0.003;
  const legCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.006, 0.0),
    new THREE.Vector3(side * 0.001, ankleY * 0.35, -0.0035),
    new THREE.Vector3(side * 0.0015, ankleY * 0.72, ankleZ * 0.35),
    new THREE.Vector3(0, ankleY, ankleZ)
  ]);
  const legGeo = buildTaperedTube(THREE, legCurve, 14, 18, (t) => {
    // Plump upper thigh tapering to slender ankle with cute joint swell at base
    const taper = 0.0056 * (1 - 0.34 * smoothstep(0.0, 0.65, t));
    const ankleSwell = 0.0014 * Math.pow(smoothstep(0.72, 1.0, t), 1.4);
    return { rx: (taper + ankleSwell) * 0.96, ry: (taper + ankleSwell) * 1.06 };
  });
  const legShaft = new THREE.Mesh(legGeo, footMat);
  legShaft.userData.slot = 'furAccent';
  legGroup.add(legShaft);

  // Webbed foot seated cleanly at ankle
  const foot = buildWebbedFoot(THREE, footMat, clawMat, isRaised);
  foot.position.set(0, isRaised ? ankleY - 0.004 : -0.044, ankleZ);
  if (isRaised) {
    foot.rotation.set(0.24, -0.08, -0.04);
  } else {
    foot.rotation.set(0, 0.14, 0);
  }
  legGroup.add(foot);

  return legGroup;
}

export function build(THREE, opts = {}, kit) {
  const variant = Number.isInteger(opts.variant) ? clamp(opts.variant, 0, 2) : 0;

  // Curated cozy defaults per variant
  const defaultFur = ['#ffd347', '#e5be4c', '#f7f3e8'][variant];
  const defaultAccent = ['#f48224', '#bf7234', '#f69348'][variant];
  const defaultEye = ['#613619', '#563218', '#5c3c24'][variant];

  const furCol = toColor(THREE, opts.fur, defaultFur);
  const accentCol = toColor(THREE, opts.furAccent, defaultAccent);
  const eyeCol = toColor(THREE, opts.eye, defaultEye);

  // Procedural CanvasTextures
  const bodyFurTex = makeFurTexture(THREE, kit, furCol, variant, 'body');
  const headFurTex = variant === 1
    ? makeFurTexture(THREE, kit, furCol, variant, 'head')
    : bodyFurTex;
  const furBumpTex = makeFurBumpTexture(THREE, kit);

  const billTex = makeAccentTexture(THREE, kit, accentCol, false);
  const footTex = makeAccentTexture(THREE, kit, accentCol, true);
  const accentBumpTex = makeAccentBumpTexture(THREE, kit);

  const irisTex = makeIrisTexture(THREE, kit, eyeCol);
  const blushTex = makeBlushTexture(THREE, kit);

  // Materials (MeshPhysicalMaterial)
  const furSheen = shiftLightness(THREE, furCol, variant === 2 ? 0.04 : 0.22, -0.15, 0);
  const bodyFurMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: bodyFurTex,
    bumpMap: furBumpTex,
    bumpScale: 0.0012,
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.85,
    sheenRoughness: 0.65,
    sheenColor: furSheen
  });

  const headFurMat = variant === 1
    ? new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: headFurTex,
        bumpMap: furBumpTex,
        bumpScale: 0.0012,
        roughness: 0.92,
        metalness: 0.0,
        sheen: 0.85,
        sheenRoughness: 0.65,
        sheenColor: furSheen
      })
    : bodyFurMat;

  const billMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: billTex,
    bumpMap: accentBumpTex,
    bumpScale: 0.00025,
    roughness: 0.24,
    metalness: 0.0,
    clearcoat: 0.62,
    clearcoatRoughness: 0.20
  });

  const footMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: footTex,
    bumpMap: accentBumpTex,
    bumpScale: 0.00045,
    roughness: 0.36,
    metalness: 0.0,
    clearcoat: 0.34,
    clearcoatRoughness: 0.28
  });

  const clawMat = new THREE.MeshPhysicalMaterial({
    color: shiftLightness(THREE, accentCol, 0.16, -0.12, 0.01),
    roughness: 0.18,
    metalness: 0.0,
    clearcoat: 0.78,
    clearcoatRoughness: 0.12
  });

  const eyeballMat = new THREE.MeshPhysicalMaterial({
    color: 0x120d0a,
    roughness: 0.05,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03
  });

  const irisMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: irisTex,
    roughness: 0.12,
    metalness: 0.0,
    clearcoat: 0.95,
    clearcoatRoughness: 0.05
  });

  const highlightMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.45,
    roughness: 0.04,
    metalness: 0.0,
    clearcoat: 1.0
  });

  const mouthMat = new THREE.MeshPhysicalMaterial({
    color: shiftLightness(THREE, accentCol, -0.35, -0.15, -0.02),
    roughness: 0.55,
    metalness: 0.0
  });

  const blushMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: blushTex,
    transparent: true,
    opacity: variant === 1 ? 0.52 : 0.64,
    depthWrite: false,
    roughness: 0.95,
    metalness: 0.0
  });

  // Root group (origin at floor y = 0, facing +Z)
  const root = new THREE.Group();
  root.name = 'duckling';

  // --- BODY GROUP (plump sculpted torso + tail + wings + head) ---
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'body';
  bodyGroup.position.set(0, 0.077, -0.002);
  // Mid-waddle lean toward planted left foot (+X) with eager forward pitch
  bodyGroup.rotation.set(0.055, -0.07, 0.075);
  bodyGroup.userData.basePos = bodyGroup.position.clone();
  bodyGroup.userData.baseRot = bodyGroup.rotation.clone();
  root.add(bodyGroup);

  const bodyGeo = sculptBodyGeometry(THREE, kit);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyFurMat);
  bodyMesh.userData.slot = 'fur';
  bodyGroup.add(bodyMesh);

  // --- TAIL GROUP ---
  const tailGroup = buildTailGroup(THREE, bodyFurMat);
  tailGroup.position.set(0, 0.014, -0.050);
  tailGroup.rotation.set(0.24, 0.08, 0.04);
  tailGroup.userData.baseRot = tailGroup.rotation.clone();
  bodyGroup.add(tailGroup);

  // --- WINGS (wingL & wingR) ---
  const wingBladeGeoL = makeCurvedWingGeometry(THREE, false);
  const wingCovertGeoL = makeCurvedWingGeometry(THREE, true);
  const wingBladeGeoR = mirrorGeometryX(wingBladeGeoL);
  const wingCovertGeoR = mirrorGeometryX(wingCovertGeoL);

  const wingL = new THREE.Group();
  wingL.name = 'wingL';
  wingL.position.set(0.036, 0.005, 0.006);
  wingL.rotation.set(0.06, -0.14, 0.16);
  wingL.userData.baseRot = wingL.rotation.clone();
  const wMeshL = new THREE.Mesh(wingBladeGeoL, bodyFurMat);
  wMeshL.userData.slot = 'fur';
  const wCovL = new THREE.Mesh(wingCovertGeoL, bodyFurMat);
  wCovL.userData.slot = 'fur';
  wingL.add(wMeshL, wCovL);
  bodyGroup.add(wingL);

  const wingR = new THREE.Group();
  wingR.name = 'wingR';
  wingR.position.set(-0.036, 0.007, 0.004);
  // Slightly lifted outward on raised-foot side for cute mid-waddle balance
  wingR.rotation.set(-0.08, 0.24, -0.34);
  wingR.userData.baseRot = wingR.rotation.clone();
  const wMeshR = new THREE.Mesh(wingBladeGeoR, bodyFurMat);
  wMeshR.userData.slot = 'fur';
  const wCovR = new THREE.Mesh(wingCovertGeoR, bodyFurMat);
  wCovR.userData.slot = 'fur';
  wingR.add(wMeshR, wCovR);
  bodyGroup.add(wingR);

  // --- HEAD GROUP (sculpted head + bill + eyes + blush + head tuft) ---
  const headGroup = new THREE.Group();
  headGroup.name = 'head';
  headGroup.position.set(0, 0.044, 0.027);
  // Gentle curious counter-tilt for irresistible three-quarter silhouette
  headGroup.rotation.set(-0.05, 0.16, -0.13);
  headGroup.userData.baseRot = headGroup.rotation.clone();
  bodyGroup.add(headGroup);

  const headGeo = sculptHeadGeometry(THREE, kit);
  const headMesh = new THREE.Mesh(headGeo, headFurMat);
  headMesh.userData.slot = 'fur';
  headGroup.add(headMesh);

  // Shaped bill (upper bill + lower bill + curved smile tube)
  const billGroup = new THREE.Group();
  billGroup.name = 'bill';
  billGroup.position.set(0, 0.0155, 0.0355);
  billGroup.rotation.set(0.06, 0, 0);
  headGroup.add(billGroup);

  const upperBill = new THREE.Mesh(sculptUpperBillGeometry(THREE), billMat);
  upperBill.userData.slot = 'furAccent';
  billGroup.add(upperBill);

  const lowerBill = new THREE.Mesh(sculptLowerBillGeometry(THREE), billMat);
  lowerBill.userData.slot = 'furAccent';
  billGroup.add(lowerBill);

  const mouthLine = new THREE.Mesh(makeMouthLineGeometry(THREE), mouthMat);
  billGroup.add(mouthLine);

  // Three-layer expressive eyes nestled into sculpted sockets
  const eyeL = buildEyeGroup(THREE, irisMat, eyeballMat, highlightMat, 1);
  eyeL.position.set(0.0218, 0.0282, 0.0322);
  eyeL.rotation.set(-0.07, 0.56, 0);
  headGroup.add(eyeL);

  const eyeR = buildEyeGroup(THREE, irisMat, eyeballMat, highlightMat, -1);
  eyeR.position.set(-0.0218, 0.0282, 0.0322);
  eyeR.rotation.set(-0.07, -0.56, 0);
  headGroup.add(eyeR);

  // Soft cheek blush patches hugging exact cheek curvature
  const blushL = new THREE.Mesh(makeCheekBlushGeometry(THREE, kit, 1), blushMat);
  blushL.userData.slot = 'accent';
  headGroup.add(blushL);

  const blushR = new THREE.Mesh(makeCheekBlushGeometry(THREE, kit, -1), blushMat);
  blushR.userData.slot = 'accent';
  headGroup.add(blushR);

  // Playful head tuft sprouting from crown
  const tuft = buildHeadTuft(THREE, headFurMat);
  tuft.position.set(0.0, 0.059, 0.002);
  headGroup.add(tuft);

  // --- LEGS & WEBBED FEET (mid-waddle pose) ---
  // Planted left leg (+X): rests solidly on floor y = 0
  const legL = buildLegAssembly(THREE, kit, bodyFurMat, footMat, clawMat, 1, false);
  legL.position.set(0.022, 0.044, 0.005);
  legL.rotation.set(0, 0.05, 0);
  legL.userData.baseRot = legL.rotation.clone();
  root.add(legL);

  // Raised right leg (-X): mid-step waddle with gently curled webbed toes
  const legR = buildLegAssembly(THREE, kit, bodyFurMat, footMat, clawMat, -1, true);
  legR.position.set(-0.022, 0.045, -0.004);
  legR.rotation.set(-0.20, -0.10, 0.05);
  legR.userData.baseRot = legR.rotation.clone();
  root.add(legR);

  // Store animation references cleanly on root
  root.userData.parts = { body: bodyGroup, head: headGroup, tail: tailGroup, wingL, wingR, legL, legR, eyeL, eyeR };
  return root;
}

export function idle(group, t) {
  const p = group.userData.parts || {
    body: group.getObjectByName('body'),
    head: group.getObjectByName('head'),
    tail: group.getObjectByName('tail'),
    wingL: group.getObjectByName('wingL'),
    wingR: group.getObjectByName('wingR'),
    legR: group.getObjectByName('legR'),
    eyeL: group.getObjectByName('eyeL'),
    eyeR: group.getObjectByName('eyeR')
  };

  // Gentle cozy breathing & micro-waddle balance sway
  const breath = Math.sin(t * 2.4);
  const sway = Math.sin(t * 1.15);

  if (p.body) {
    const bp = p.body.userData.basePos;
    const br = p.body.userData.baseRot;
    if (bp) {
      p.body.position.y = bp.y + breath * 0.0014;
    }
    if (br) {
      p.body.rotation.x = br.x + breath * 0.015;
      p.body.rotation.z = br.z + sway * 0.022;
    }
    const sxz = 1 + breath * 0.012;
    const sy = 1 + breath * 0.016;
    p.body.scale.set(sxz, sy, sxz);
  }

  // Curious soft head sway & gentle nod
  if (p.head && p.head.userData.baseRot) {
    const hr = p.head.userData.baseRot;
    p.head.rotation.x = hr.x + Math.sin(t * 1.7 + 0.6) * 0.035;
    p.head.rotation.y = hr.y + Math.sin(t * 0.85) * 0.09;
    p.head.rotation.z = hr.z + Math.sin(t * 1.15 + 1.1) * 0.045;
  }

  // Playful intermittent duckling tail wag
  if (p.tail && p.tail.userData.baseRot) {
    const tr = p.tail.userData.baseRot;
    const wagBurst = Math.pow(Math.max(0, Math.sin(t * 0.72)), 4);
    p.tail.rotation.y = tr.y + Math.sin(t * 14.0) * 0.18 * wagBurst + Math.sin(t * 2.4) * 0.03;
    p.tail.rotation.x = tr.x + breath * 0.04 + Math.abs(Math.sin(t * 14.0)) * 0.04 * wagBurst;
  }

  // Soft breathing flutter on wings
  if (p.wingL && p.wingL.userData.baseRot) {
    const wr = p.wingL.userData.baseRot;
    p.wingL.rotation.z = wr.z + breath * 0.035 + Math.sin(t * 1.15) * 0.02;
  }
  if (p.wingR && p.wingR.userData.baseRot) {
    const wr = p.wingR.userData.baseRot;
    p.wingR.rotation.z = wr.z - breath * 0.055 - Math.sin(t * 1.15) * 0.03;
  }

  // Subtle balance bob on the raised mid-waddle foot (planted legL stays anchored on floor)
  if (p.legR && p.legR.userData.baseRot) {
    const lr = p.legR.userData.baseRot;
    p.legR.rotation.x = lr.x + Math.sin(t * 1.8 + 0.4) * 0.04;
  }

  // Natural blink every ~3.8 seconds by scaling eye groups on Y
  if (p.eyeL && p.eyeR) {
    const period = 3.8;
    const phase = ((t + 0.9) % period + period) % period;
    let blinkScale = 1.0;
    if (phase < 0.16) {
      const u = phase / 0.16;
      blinkScale = 1.0 - 0.92 * Math.sin(u * Math.PI);
    }
    p.eyeL.scale.y = blinkScale;
    p.eyeR.scale.y = blinkScale;
  }
}
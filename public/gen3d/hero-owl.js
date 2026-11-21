export const META = {
  id: 'cozy-owl',
  name: 'Perching Small Owl',
  kind: 'creature',
  footprint: [0.21, 0.14],
  variants: ['Tawny', 'Snowy', 'Barn'],
  note: 'Stylised 0.22 m small owl perched on a short mossy branch with sculpted plumage, layered breast feathers, folded wings, ear tufts, and expressive multi-layer eyes.'
};

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

function toColor(THREE, input, fallback) {
  if (input && input.isColor) return input.clone();
  if (typeof input === 'number' || (typeof input === 'string' && input.length > 0)) {
    try {
      return new THREE.Color(input);
    } catch (_) {
      return new THREE.Color(fallback);
    }
  }
  return new THREE.Color(fallback);
}

function colorCSS(c, alpha) {
  const r = Math.round(clamp(c.r, 0, 1) * 255);
  const g = Math.round(clamp(c.g, 0, 1) * 255);
  const b = Math.round(clamp(c.b, 0, 1) * 255);
  return alpha === undefined ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

function mixColor(THREE, a, b, t) {
  return a.clone().lerp(b, t);
}

function resolvePalette(THREE, opts) {
  const variant = clamp(Math.round(opts.variant ?? 0), 0, 2);
  const presets = [
    // 0: Tawny
    {
      fur: '#8a5738',
      furAccent: '#ead7bc',
      eye: '#bf7324',
      marking: '#422515',
      rim: '#59331e',
      beak: '#c79b52',
      cere: '#7d6044',
      claw: '#382e28',
      foot: '#b49573',
      blush: '#d9816f',
      wingTip: '#4a2b19',
      frost: '#a87552'
    },
    // 1: Snowy
    {
      fur: '#f1eee8',
      furAccent: '#fcfbf8',
      eye: '#e8b620',
      marking: '#484340',
      rim: '#d8d2c7',
      beak: '#38363a',
      cere: '#545054',
      claw: '#29272b',
      foot: '#d8d2c9',
      blush: '#e39e96',
      wingTip: '#4c4642',
      frost: '#ffffff'
    },
    // 2: Barn
    {
      fur: '#c48743',
      furAccent: '#f7f1e5',
      eye: '#3b2419',
      marking: '#523522',
      rim: '#945d2d',
      beak: '#dfc19d',
      cere: '#caa581',
      claw: '#544337',
      foot: '#c4a686',
      blush: '#df9182',
      wingTip: '#6b4728',
      frost: '#b5ada5'
    }
  ];

  const p = presets[variant];
  const fur = toColor(THREE, opts.fur, p.fur);
  const furAccent = toColor(THREE, opts.furAccent, p.furAccent);
  const eye = toColor(THREE, opts.eye, p.eye);
  const furDark = mixColor(THREE, fur, new THREE.Color(p.marking), variant === 1 ? 0.25 : 0.45);
  const furSheen = mixColor(THREE, fur, new THREE.Color('#ffffff'), 0.45);
  const accentSheen = mixColor(THREE, furAccent, new THREE.Color('#ffffff'), 0.55);

  return {
    variant,
    fur,
    furAccent,
    furDark,
    furSheen,
    accentSheen,
    eye,
    marking: new THREE.Color(p.marking),
    rim: new THREE.Color(p.rim),
    beak: new THREE.Color(p.beak),
    cere: new THREE.Color(p.cere),
    claw: new THREE.Color(p.claw),
    foot: new THREE.Color(p.foot),
    blush: new THREE.Color(p.blush),
    wingTip: new THREE.Color(p.wingTip),
    frost: new THREE.Color(p.frost)
  };
}

function sculptGeometry(THREE, geo, fn) {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    fn(v, i);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

function buildTaperedTube(THREE, curve, tubularSegs, radialSegs, radiusFn, options = {}) {
  const frames = curve.computeFrenetFrames(tubularSegs, false);
  const positions = [];
  const uvs = [];
  const indices = [];
  const profileFn = options.profileFn || null;
  const capStart = options.capStart ?? true;
  const capEnd = options.capEnd ?? true;
  const capRoundStart = options.capRoundStart ?? false;
  const capRoundEnd = options.capRoundEnd ?? false;
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const v = new THREE.Vector3();

  const rings = tubularSegs + 1;
  const cols = radialSegs + 1;

  for (let i = 0; i < rings; i++) {
    const u = i / tubularSegs;
    curve.getPointAt(u, P);
    N.copy(frames.normals[i]);
    B.copy(frames.binormals[i]);
    const baseR = Math.max(0.00015, radiusFn(u));

    for (let j = 0; j < cols; j++) {
      const vf = j / radialSegs;
      const theta = vf * Math.PI * 2;
      const r = profileFn ? Math.max(0.0001, profileFn(u, theta, baseR)) : baseR;
      const ct = Math.cos(theta);
      const st = Math.sin(theta);
      v.copy(P)
        .addScaledVector(N, ct * r)
        .addScaledVector(B, st * r);
      positions.push(v.x, v.y, v.z);
      uvs.push(u, vf);
    }
  }

  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * cols + j;
      const b = (i + 1) * cols + j;
      const c = (i + 1) * cols + (j + 1);
      const d = i * cols + (j + 1);
      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }

  if (capStart) {
    curve.getPointAt(0, P);
    const tip = P.clone();
    if (capRoundStart) {
      tip.addScaledVector(frames.tangents[0], -radiusFn(0) * 0.45);
    }
    const centerIdx = positions.length / 3;
    positions.push(tip.x, tip.y, tip.z);
    uvs.push(0, 0.5);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(centerIdx, j, j + 1);
    }
  }

  if (capEnd) {
    curve.getPointAt(1, P);
    const tip = P.clone();
    if (capRoundEnd) {
      tip.addScaledVector(frames.tangents[tubularSegs], radiusFn(1) * 0.45);
    }
    const centerIdx = positions.length / 3;
    positions.push(tip.x, tip.y, tip.z);
    uvs.push(1, 0.5);
    const baseRing = tubularSegs * cols;
    for (let j = 0; j < radialSegs; j++) {
      indices.push(centerIdx, baseRing + j + 1, baseRing + j);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildCurvedFeather(THREE, opts) {
  const len = opts.length ?? 0.04;
  const w = opts.width ?? 0.015;
  const thick = opts.thickness ?? 0.0014;
  const bendZ = opts.bendZ ?? 0.006;
  const cupZ = opts.cupZ ?? 0.0016;
  const sweepX = opts.sweepX ?? 0;
  const pointiness = opts.pointiness ?? 0.35;
  const hw = w * 0.5;

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(hw * 0.65, len * 0.08, hw * 1.05, len * 0.34, hw * 0.96, len * 0.62);
  shape.bezierCurveTo(hw * 0.88, len * 0.86, hw * (0.55 - pointiness * 0.35), len * 0.98, 0, len);
  shape.bezierCurveTo(-hw * (0.55 - pointiness * 0.35), len * 0.98, -hw * 0.88, len * 0.86, -hw * 0.96, len * 0.62);
  shape.bezierCurveTo(-hw * 1.05, len * 0.34, -hw * 0.65, len * 0.08, 0, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thick,
    bevelEnabled: true,
    bevelThickness: thick * 0.55,
    bevelSize: Math.min(w * 0.07, 0.0012),
    bevelSegments: 2,
    curveSegments: 10
  });

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i) - thick * 0.5;
    const ty = clamp(y / len, 0, 1);
    const tx = clamp(x / hw, -1, 1);
    const nx = x + sweepX * ty * ty;
    const nz = z + bendZ * (ty * ty) - cupZ * (1 - tx * tx) * Math.sin(ty * Math.PI);
    pos.setXYZ(i, nx, y, nz);
    uv.setXY(i, clamp(x / w + 0.5, 0, 1), ty);
  }
  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function buildCurvedLeaf(THREE, length, width) {
  const hw = width * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(hw * 0.9, length * 0.22, hw * 1.05, length * 0.62, 0, length);
  shape.bezierCurveTo(-hw * 1.05, length * 0.62, -hw * 0.9, length * 0.22, 0, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0008,
    bevelEnabled: true,
    bevelThickness: 0.0005,
    bevelSize: 0.0006,
    bevelSegments: 2,
    curveSegments: 10
  });

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i) - 0.0004;
    const ty = clamp(y / length, 0, 1);
    const tx = Math.abs(x) / Math.max(0.0001, hw);
    const curl = Math.sin(ty * Math.PI * 1.15) * length * 0.16 - ty * ty * length * 0.22;
    const fold = tx * width * 0.12 * Math.sin(ty * Math.PI);
    pos.setXYZ(i, x, y, z + curl + fold);
    uv.setXY(i, clamp(x / width + 0.5, 0, 1), ty);
  }
  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function buildFacialDiscGeo(THREE, variant) {
  // Continuous sculpted plush facial disc conforming cleanly to front of head
  const angSegs = 56;
  const radSegs = 14;
  const positions = [];
  const uvs = [];
  const indices = [];

  const isBarn = variant === 2;
  const rxBase = isBarn ? 0.044 : 0.046;
  const ryBase = isBarn ? 0.036 : 0.034;

  function contourScale(angle) {
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    if (isBarn) {
      // Heart-shaped Barn owl facial disc
      const topDip = Math.exp(-Math.pow((angle - Math.PI * 0.5) / 0.36, 2)) * 0.22;
      const chinPoint = Math.exp(-Math.pow((angle + Math.PI * 0.5) / 0.62, 2)) * 0.16;
      const upperCheek = Math.exp(-Math.pow((Math.abs(ca) - 0.78) / 0.4, 2)) * (sa > 0 ? 0.12 : 0.02);
      return 0.96 - topDip + chinPoint + upperCheek;
    }
    // Binocular figure-8 owl disc for Tawny / Snowy
    const topPinch = Math.exp(-Math.pow((angle - Math.PI * 0.5) / 0.42, 2)) * 0.14;
    const botPinch = Math.exp(-Math.pow((angle + Math.PI * 0.5) / 0.52, 2)) * 0.10;
    const sideLobe = Math.pow(Math.abs(ca), 1.6) * 0.08;
    return 0.98 - topPinch - botPinch + sideLobe;
  }

  for (let rIdx = 0; rIdx <= radSegs; rIdx++) {
    const rf = rIdx / radSegs;
    // Last 2 rings curl smoothly back into the head so edge is rounded plush, never paper-thin
    const tR = rf <= 0.86 ? rf / 0.86 : 1.0 - (rf - 0.86) * 0.35;
    const edgeBack = rf <= 0.86 ? 0 : Math.pow((rf - 0.86) / 0.14, 1.4) * 0.011;

    for (let aIdx = 0; aIdx <= angSegs; aIdx++) {
      const af = aIdx / angSegs;
      const angle = af * Math.PI * 2 - Math.PI;
      const scale = contourScale(angle);
      const x = Math.cos(angle) * rxBase * scale * tR;
      const y = Math.sin(angle) * ryBase * scale * tR;

      // Wrap smoothly around the sculpted head curvature
      const wrapZ = -(x * x) * 4.4 - (y * y) * 3.6;
      // Slight plush raised outer rim + subtle bridge down the nose + twin eye hollows
      const rimLip = Math.exp(-Math.pow((tR - 0.88) / 0.14, 2)) * (isBarn ? 0.0044 : 0.0032);
      const eyeDistL = Math.hypot(x - 0.020, y - 0.003);
      const eyeDistR = Math.hypot(x + 0.020, y - 0.003);
      const socket =
        -Math.exp(-Math.pow(eyeDistL / 0.015, 2)) * 0.0038 -
        Math.exp(-Math.pow(eyeDistR / 0.015, 2)) * 0.0038;
      const noseBridge = Math.exp(-Math.pow(x / 0.007, 2)) * Math.exp(-Math.pow((y - 0.003) / 0.018, 2)) * 0.0032;

      const z = 0.0065 + wrapZ + rimLip + socket + noseBridge - edgeBack;
      positions.push(x, y, z);
      uvs.push(clamp(0.5 + x / (rxBase * 2.2), 0, 1), clamp(0.5 + y / (ryBase * 2.2), 0, 1));
    }
  }

  const cols = angSegs + 1;
  for (let r = 0; r < radSegs; r++) {
    for (let a = 0; a < angSegs; a++) {
      const i0 = r * cols + a;
      const i1 = (r + 1) * cols + a;
      const i2 = (r + 1) * cols + (a + 1);
      const i3 = r * cols + (a + 1);
      indices.push(i0, i1, i3);
      indices.push(i1, i2, i3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildLegCuffGeo(THREE) {
  // Rotational feathered owl leg cuff ("trousers") built from 18-point LatheGeometry profile
  const profile = [
    [0.0055, 0.000],
    [0.0072, 0.0012],
    [0.0086, 0.0030],
    [0.0096, 0.0052],
    [0.0102, 0.0075],
    [0.0110, 0.0098],
    [0.0118, 0.0122],
    [0.0125, 0.0145],
    [0.0130, 0.0168],
    [0.0133, 0.0190],
    [0.0134, 0.0212],
    [0.0132, 0.0234],
    [0.0128, 0.0255],
    [0.0120, 0.0274],
    [0.0110, 0.0290],
    [0.0095, 0.0304],
    [0.0072, 0.0315],
    [0.0035, 0.0322]
  ];
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, 24);
  // Add gentle feathery scalloped ruffle around the lower hem
  sculptGeometry(THREE, geo, (v) => {
    const a = Math.atan2(v.z, v.x);
    const hem = smoothstep(0.014, 0.0, v.y);
    const ruffle = Math.sin(a * 7) * 0.0008 * hem;
    const len = Math.hypot(v.x, v.z);
    if (len > 0.0001) {
      v.x += (v.x / len) * ruffle;
      v.z += (v.z / len) * ruffle;
    }
    v.y -= Math.cos(a * 7) * 0.0009 * hem;
  });
  return geo;
}

function makePlumageTextures(THREE, kit, pal) {
  const { variant } = pal;

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    // Base coat: darker back (u ~ 0.75) to lighter warm belly (u ~ 0.25)
    const img = ctx.createImageData(w, h);
    const data = img.data;
    const backCol = variant === 1 ? pal.fur : mixColor(THREE, pal.fur, pal.furDark, 0.22);
    const bellyCol = pal.furAccent;
    const frostCol = pal.frost;

    for (let y = 0; y < h; y++) {
      const v = 1 - y / h; // 1 = top, 0 = bottom
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const frontDot = Math.cos((u - 0.25) * Math.PI * 2); // +1 front, -1 back
        const n1 = kit.noise(u * 10 + 1.3, v * 10 + 2.1);
        const n2 = kit.noise(u * 26 + 4.7, v * 26 + 8.3);
        const bellyMask = smoothstep(-0.08, 0.56, frontDot + (n1 - 0.5) * 0.22) * smoothstep(0.96, 0.62, v);

        let r = lerp(backCol.r, bellyCol.r, bellyMask);
        let g = lerp(backCol.g, bellyCol.g, bellyMask);
        let b = lerp(backCol.b, bellyCol.b, bellyMask);

        // Soft darker dorsal crown/shoulders
        const topShade = smoothstep(0.45, 0.95, v) * smoothstep(0.4, -0.4, frontDot);
        if (variant === 2) {
          // Barn owl pearl-grey frost on upper mantle/back
          const frostMask = topShade * (0.35 + 0.35 * n1);
          r = lerp(r, frostCol.r, frostMask);
          g = lerp(g, frostCol.g, frostMask);
          b = lerp(b, frostCol.b, frostMask);
        } else {
          const darken = topShade * (variant === 1 ? 0.05 : 0.16);
          r *= 1 - darken;
          g *= 1 - darken;
          b *= 1 - darken;
        }

        // Subtle warm under-belly shadow
        const under = smoothstep(0.24, 0.0, v) * 0.14;
        r *= 1 - under;
        g *= 1 - under;
        b *= 1 - under;

        // Fine organic plumage grain
        const grain = (n2 - 0.5) * 0.06;
        const idx = (y * w + x) * 4;
        data[idx] = clamp(Math.round((r + grain) * 255), 0, 255);
        data[idx + 1] = clamp(Math.round((g + grain) * 255), 0, 255);
        data[idx + 2] = clamp(Math.round((b + grain) * 255), 0, 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Layered scalloped feather rows & variant markings
    const rows = 26;
    const cols = 30;
    const cellW = w / cols;
    const cellH = h / rows;

    for (let row = 1; row < rows - 1; row++) {
      const v = 1 - row / rows;
      const offset = (row % 2) * (cellW * 0.5);
      for (let col = -1; col <= cols; col++) {
        const cx = col * cellW + offset;
        const cy = row * cellH;
        const u = ((cx / w) % 1 + 1) % 1;
        const frontDot = Math.cos((u - 0.25) * Math.PI * 2);
        const rnd = kit.noise(col * 1.7 + 3.1, row * 2.3 + 5.7);

        // Soft scalloped feather rim highlight/shadow
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, cellW * 0.56, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.strokeStyle =
          frontDot > 0.2
            ? colorCSS(pal.furDark, variant === 1 ? 0.07 : 0.13)
            : colorCSS(pal.furAccent, variant === 1 ? 0.22 : 0.18);
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // Fine vertical barb flecks inside feather
        ctx.strokeStyle =
          frontDot > 0.25
            ? colorCSS(pal.fur, variant === 1 ? 0.06 : 0.12)
            : colorCSS(pal.furDark, variant === 1 ? 0.09 : 0.18);
        ctx.lineWidth = 0.8;
        for (let b = -2; b <= 2; b++) {
          ctx.beginPath();
          ctx.moveTo(cx + b * 2.2, cy - cellH * 0.3);
          ctx.lineTo(cx + b * 2.6, cy + cellH * 0.42);
          ctx.stroke();
        }

        // Variant-specific markings
        if (variant === 0) {
          // Tawny: warm vertical teardrop flecks on chest, mottled dark dashes on back
          if (frontDot > 0.22 && v > 0.16 && v < 0.78 && rnd > 0.36) {
            ctx.fillStyle = colorCSS(pal.marking, 0.42 + rnd * 0.2);
            ctx.beginPath();
            ctx.ellipse(cx, cy + 2, cellW * 0.13, cellH * 0.36, 0, 0, Math.PI * 2);
            ctx.fill();
            // Delicate crossbar
            ctx.strokeStyle = colorCSS(pal.marking, 0.28);
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(cx - cellW * 0.26, cy + 2);
            ctx.lineTo(cx + cellW * 0.26, cy + 2);
            ctx.stroke();
          } else if (frontDot <= 0.15 && rnd > 0.32) {
            ctx.fillStyle = colorCSS(pal.marking, 0.30);
            ctx.beginPath();
            ctx.ellipse(cx, cy, cellW * 0.22, cellH * 0.28, (rnd - 0.5) * 0.4, 0, Math.PI * 2);
            ctx.fill();
            if (rnd > 0.65) {
              ctx.fillStyle = colorCSS(pal.furAccent, 0.35);
              ctx.beginPath();
              ctx.arc(cx + 2, cy + 3, 2.2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        } else if (variant === 1) {
          // Snowy: crisp charcoal crescent bars mostly on back, sides & lower flanks
          const snowyChance = frontDot < 0.1 ? 0.34 : frontDot < 0.45 && v < 0.52 ? 0.56 : 0.88;
          if (rnd > snowyChance && v > 0.14 && v < 0.90) {
            ctx.strokeStyle = colorCSS(pal.marking, 0.58 + (rnd - snowyChance) * 0.4);
            ctx.lineWidth = 2.4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(cx, cy - 1, cellW * 0.32, 0.22 * Math.PI, 0.78 * Math.PI);
            ctx.stroke();
          }
        } else {
          // Barn: tiny pearl-white & dark diamond flecks on golden back, sparse cinnamon dots on ivory chest
          if (frontDot < 0.08 && rnd > 0.38 && v > 0.16 && v < 0.88) {
            ctx.fillStyle = colorCSS(pal.marking, 0.52);
            ctx.beginPath();
            ctx.arc(cx, cy - 1.5, 2.0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,252,244,0.72)';
            ctx.beginPath();
            ctx.arc(cx, cy + 1.2, 1.8, 0, Math.PI * 2);
            ctx.fill();
          } else if (frontDot > 0.25 && rnd > 0.72 && v > 0.22 && v < 0.74) {
            ctx.fillStyle = colorCSS(pal.rim, 0.34);
            ctx.beginPath();
            ctx.arc(cx, cy + 1, 1.4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    }
  });
  if (THREE.SRGBColorSpace) map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;

  const bumpMap = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    const rows = 26;
    const cols = 30;
    const cellW = w / cols;
    const cellH = h / rows;
    for (let row = 0; row < rows; row++) {
      const offset = (row % 2) * (cellW * 0.5);
      for (let col = -1; col <= cols; col++) {
        const cx = col * cellW + offset;
        const cy = row * cellH;
        const g = ctx.createRadialGradient(cx, cy - 2, 1, cx, cy, cellW * 0.65);
        g.addColorStop(0, 'rgba(215,215,215,0.45)');
        g.addColorStop(0.75, 'rgba(135,135,135,0.2)');
        g.addColorStop(1, 'rgba(65,65,65,0.55)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, cellW * 0.6, 0, Math.PI);
        ctx.fill();
      }
    }
  });
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;

  return { map, bumpMap };
}

function makeFacialDiscTextures(THREE, kit, pal) {
  const { variant } = pal;

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const inner = variant === 0 ? mixColor(THREE, pal.furAccent, pal.fur, 0.16) : pal.furAccent;
    const outer = variant === 2 ? pal.rim : variant === 0 ? pal.rim : mixColor(THREE, pal.furAccent, pal.furDark, 0.12);

    const grad = ctx.createRadialGradient(cx, cy, w * 0.05, cx, cy, w * 0.49);
    grad.addColorStop(0, colorCSS(inner));
    grad.addColorStop(0.68, colorCSS(pal.furAccent));
    grad.addColorStop(0.86, colorCSS(mixColor(THREE, pal.furAccent, outer, variant === 1 ? 0.35 : 0.65)));
    grad.addColorStop(1, colorCSS(outer));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Radiating silky facial-disc feathers fanning from left & right eye centers
    const centers = [
      [w * 0.34, h * 0.47],
      [w * 0.66, h * 0.47]
    ];
    for (const [ex, ey] of centers) {
      for (let i = 0; i < 160; i++) {
        const a = (i / 160) * Math.PI * 2;
        const n = kit.noise(Math.cos(a) * 4 + ex * 0.01, Math.sin(a) * 4 + ey * 0.01);
        const r0 = 26 + n * 14;
        const r1 = 155 + n * 48;
        ctx.strokeStyle =
          i % 3 === 0
            ? colorCSS(pal.furAccent, 0.42)
            : colorCSS(variant === 1 ? pal.furDark : pal.rim, variant === 1 ? 0.1 : 0.2);
        ctx.lineWidth = 1.2 + (i % 2) * 0.7;
        ctx.beginPath();
        ctx.moveTo(ex + Math.cos(a) * r0, ey + Math.sin(a) * r0);
        ctx.lineTo(ex + Math.cos(a) * r1, ey + Math.sin(a) * r1);
        ctx.stroke();
      }
    }

    // Soft velvety dark rim framing the facial disc border
    const rimGrad = ctx.createRadialGradient(cx, cy, w * 0.36, cx, cy, w * 0.5);
    rimGrad.addColorStop(0, 'rgba(0,0,0,0)');
    rimGrad.addColorStop(0.75, colorCSS(outer, variant === 2 ? 0.52 : variant === 0 ? 0.38 : 0.14));
    rimGrad.addColorStop(1, colorCSS(outer, variant === 2 ? 0.85 : variant === 0 ? 0.68 : 0.25));
    ctx.fillStyle = rimGrad;
    ctx.fillRect(0, 0, w, h);

    // Soft chestnut/cinnamon inner shadow right around the beak bridge for Barn/Tawny
    if (variant !== 1) {
      const bridgeGrad = ctx.createRadialGradient(cx, cy + 8, 2, cx, cy + 8, 56);
      bridgeGrad.addColorStop(0, colorCSS(pal.rim, variant === 2 ? 0.26 : 0.18));
      bridgeGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bridgeGrad;
      ctx.fillRect(0, 0, w, h);
    }
  });
  if (THREE.SRGBColorSpace) map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    const centers = [
      [w * 0.34, h * 0.47],
      [w * 0.66, h * 0.47]
    ];
    for (const [ex, ey] of centers) {
      for (let i = 0; i < 120; i++) {
        const a = (i / 120) * Math.PI * 2;
        ctx.strokeStyle = i % 2 === 0 ? 'rgba(220,220,220,0.45)' : 'rgba(60,60,60,0.45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(ex + Math.cos(a) * 14, ey + Math.sin(a) * 14);
        ctx.lineTo(ex + Math.cos(a) * 115, ey + Math.sin(a) * 115);
        ctx.stroke();
      }
    }
  });

  return { map, bumpMap };
}

function makeFeatherTextures(THREE, kit, pal, isBreast) {
  const { variant } = pal;
  const baseCol = isBreast ? pal.furAccent : pal.fur;
  const tipCol = isBreast
    ? mixColor(THREE, pal.furAccent, pal.fur, variant === 1 ? 0.08 : 0.22)
    : variant === 2
      ? pal.frost
      : pal.wingTip;

  const map = kit.canvasTexture(256, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, h, 0, 0); // bottom (base v=0) to top (tip v=1)
    grad.addColorStop(0, colorCSS(mixColor(THREE, baseCol, pal.furDark, 0.18)));
    grad.addColorStop(0.55, colorCSS(baseCol));
    grad.addColorStop(0.88, colorCSS(mixColor(THREE, baseCol, tipCol, 0.55)));
    grad.addColorStop(1, colorCSS(tipCol));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Owl barring bands on wing/tail feathers
    if (!isBreast) {
      const bandCount = variant === 1 ? 4 : 5;
      for (let i = 0; i < bandCount; i++) {
        const by = h * (0.14 + i * 0.17);
        const bh = h * (variant === 1 ? 0.055 : 0.075);
        ctx.fillStyle = colorCSS(pal.marking, variant === 1 ? 0.52 : variant === 2 ? 0.26 : 0.38);
        ctx.beginPath();
        ctx.moveTo(0, by + 10);
        ctx.quadraticCurveTo(w * 0.5, by - 14, w, by + 10);
        ctx.lineTo(w, by + bh + 10);
        ctx.quadraticCurveTo(w * 0.5, by + bh - 14, 0, by + bh + 10);
        ctx.closePath();
        ctx.fill();
      }
      // Subtle pale scalloped tip edge
      ctx.fillStyle = colorCSS(pal.furAccent, variant === 2 ? 0.45 : 0.28);
      ctx.fillRect(0, 0, w, h * 0.06);
    } else if (variant === 0) {
      // Soft tawny teardrop streak down breast feather center
      ctx.fillStyle = colorCSS(pal.marking, 0.28);
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.44, w * 0.12, h * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (variant === 1) {
      // Subtle snowy crescent near breast tip
      ctx.strokeStyle = colorCSS(pal.marking, 0.24);
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.34, w * 0.26, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    }

    // Angled feather barbs radiating from central rachis
    const midX = w * 0.5;
    for (let y = 12; y < h; y += 4) {
      const n = kit.noise(y * 0.08, 2.3);
      ctx.strokeStyle =
        n > 0.5
          ? colorCSS(pal.furAccent, isBreast ? 0.22 : 0.16)
          : colorCSS(pal.marking, isBreast ? 0.1 : 0.18);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(midX, y);
      ctx.lineTo(0, y - 34);
      ctx.moveTo(midX, y);
      ctx.lineTo(w, y - 34);
      ctx.stroke();
    }

    // Central shaft (rachis)
    const shaft = ctx.createLinearGradient(0, h, 0, 0);
    shaft.addColorStop(0, colorCSS(pal.furAccent, 0.55));
    shaft.addColorStop(1, colorCSS(pal.furDark, 0.35));
    ctx.strokeStyle = shaft;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(midX, h);
    ctx.lineTo(midX, 8);
    ctx.stroke();
  });
  if (THREE.SRGBColorSpace) map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = kit.canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#7c7c7c';
    ctx.fillRect(0, 0, w, h);
    const midX = w * 0.5;
    for (let y = 6; y < h; y += 3) {
      ctx.strokeStyle = y % 6 === 0 ? 'rgba(210,210,210,0.45)' : 'rgba(55,55,55,0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(midX, y);
      ctx.lineTo(0, y - 20);
      ctx.moveTo(midX, y);
      ctx.lineTo(w, y - 20);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(245,245,245,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(midX, h);
    ctx.lineTo(midX, 4);
    ctx.stroke();
  });

  return { map, bumpMap };
}

function makeIrisTexture(THREE, kit, eyeCol, variant) {
  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const maxR = w * 0.49;

    const bright = mixColor(THREE, eyeCol, new THREE.Color('#fff1be'), variant === 2 ? 0.25 : 0.42);
    const deep = mixColor(THREE, eyeCol, new THREE.Color('#0c0705'), 0.65);

    const grad = ctx.createRadialGradient(cx, cy, maxR * 0.22, cx, cy, maxR);
    grad.addColorStop(0, colorCSS(bright));
    grad.addColorStop(0.55, colorCSS(eyeCol));
    grad.addColorStop(0.84, colorCSS(deep));
    grad.addColorStop(1, '#0c090a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Radial iris fibres
    for (let i = 0; i < 140; i++) {
      const a = (i / 140) * Math.PI * 2;
      const n = kit.noise(Math.cos(a) * 3 + 4.1, Math.sin(a) * 3 + 2.7);
      ctx.strokeStyle = i % 2 === 0 ? colorCSS(bright, 0.28 + n * 0.22) : colorCSS(deep, 0.35);
      ctx.lineWidth = 1.2 + n * 1.4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * maxR * 0.28, cy + Math.sin(a) * maxR * 0.28);
      ctx.lineTo(cx + Math.cos(a) * maxR * (0.78 + n * 0.14), cy + Math.sin(a) * maxR * (0.78 + n * 0.14));
      ctx.stroke();
    }

    // Crisp dark limbal ring around the outer iris border
    ctx.strokeStyle = 'rgba(10, 7, 8, 0.88)';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 0.94, 0, Math.PI * 2);
    ctx.stroke();
  });
  if (THREE.SRGBColorSpace) map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function makeBlushTexture(THREE, kit, blushCol) {
  const map = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 2, w * 0.5, h * 0.5, w * 0.48);
    g.addColorStop(0, colorCSS(blushCol, 0.36));
    g.addColorStop(0.55, colorCSS(blushCol, 0.18));
    g.addColorStop(1, colorCSS(blushCol, 0.0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  if (THREE.SRGBColorSpace) map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function makeBarkTextures(THREE, kit) {
  const map = kit.canvasTexture(512, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      const v = y / h;
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const grain = kit.noise(u * 9 + 1.1, v * 34 + 3.2);
        const ridge = kit.noise(u * 22 + 5.4, v * 62 + 1.8);
        const mossN = kit.noise(u * 6 + 9.2, v * 7 + 4.1);
        const t = grain * 0.65 + ridge * 0.35;
        let r = lerp(58, 118, t);
        let g = lerp(42, 86, t);
        let b = lerp(31, 62, t);

        // Cozy soft woodland moss patches
        const mossMask = smoothstep(0.64, 0.78, mossN) * smoothstep(0.12, 0.35, v) * smoothstep(0.88, 0.65, v);
        r = lerp(r, 94, mossMask * 0.65);
        g = lerp(g, 118, mossMask * 0.65);
        b = lerp(b, 70, mossMask * 0.65);

        const idx = (y * w + x) * 4;
        data[idx] = clamp(Math.round(r), 0, 255);
        data[idx + 1] = clamp(Math.round(g), 0, 255);
        data[idx + 2] = clamp(Math.round(b), 0, 255);
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  if (THREE.SRGBColorSpace) map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(512, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
      const v = y / h;
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const val = kit.noise(u * 9 + 1.1, v * 34 + 3.2) * 0.6 + kit.noise(u * 26 + 5.4, v * 68 + 1.8) * 0.4;
        const c = clamp(Math.round(val * 255), 0, 255);
        const idx = (y * w + x) * 4;
        data[idx] = c;
        data[idx + 1] = c;
        data[idx + 2] = c;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

function makeWoodEndTexture(THREE, kit) {
  const map = kit.canvasTexture(128, 128, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    ctx.fillStyle = '#c9a67c';
    ctx.fillRect(0, 0, w, h);
    for (let r = 56; r >= 6; r -= 5) {
      ctx.strokeStyle = r % 10 === 0 ? 'rgba(110,74,45,0.45)' : 'rgba(155,112,72,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        const wob = (kit.noise(Math.cos(a) * 2 + r * 0.1, Math.sin(a) * 2) - 0.5) * 4;
        const px = cx + Math.cos(a) * (r + wob);
        const py = cy + Math.sin(a) * (r + wob);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.strokeStyle = '#4e3726';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, 58, 0, Math.PI * 2);
    ctx.stroke();
  });
  if (THREE.SRGBColorSpace) map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function buildBranch(THREE, kit, mats) {
  const branchGroup = new THREE.Group();
  branchGroup.name = 'branch';

  const mainCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.095, 0.017, 0.010),
    new THREE.Vector3(-0.048, 0.021, 0.003),
    new THREE.Vector3(0.0, 0.0225, 0.0),
    new THREE.Vector3(0.052, 0.020, -0.004),
    new THREE.Vector3(0.094, 0.0155, -0.011)
  ]);

  const branchGeo = buildTaperedTube(
    THREE,
    mainCurve,
    40,
    20,
    (u) => lerp(0.017, 0.0145, u) + Math.sin(u * Math.PI) * 0.0065,
    {
      capStart: false,
      capEnd: false,
      profileFn: (u, theta, r) => {
        const bump =
          (kit.noise(u * 8 + 1.7, Math.cos(theta) * 1.4 + 2.5) - 0.5) * 0.0024 +
          (kit.noise(u * 14 + 6.1, Math.sin(theta) * 1.4 + 5.2) - 0.5) * 0.0014;
        return r + bump;
      }
    }
  );

  // Gently flatten the underside onto Y = 0 so the perch rests with grounded weight
  sculptGeometry(THREE, branchGeo, (v) => {
    if (v.y < 0.0045) {
      v.y = Math.max(0, v.y * smoothstep(-0.004, 0.0045, v.y));
    }
  });

  const branchMesh = new THREE.Mesh(branchGeo, mats.bark);
  branchMesh.userData.slot = 'secondary';
  branchMesh.castShadow = true;
  branchMesh.receiveShadow = true;
  branchGroup.add(branchMesh);

  // Textured wood-ring cut caps on both branch ends
  for (const endU of [0, 1]) {
    const pt = mainCurve.getPointAt(endU);
    const tan = mainCurve.getTangentAt(endU);
    const r = endU === 0 ? 0.0168 : 0.0142;
    const capGeo = new THREE.CircleGeometry(r, 20);
    const cap = new THREE.Mesh(capGeo, mats.woodEnd);
    cap.userData.slot = 'secondary';
    cap.position.copy(pt);
    const dir = endU === 0 ? tan.clone().negate() : tan.clone();
    cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    branchGroup.add(cap);
  }

  // Forked side twig rising gracefully on the right side (+X)
  const twigCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.056, 0.024, -0.004),
    new THREE.Vector3(0.074, 0.036, 0.001),
    new THREE.Vector3(0.091, 0.050, 0.007),
    new THREE.Vector3(0.103, 0.060, 0.010)
  ]);
  const twigGeo = buildTaperedTube(THREE, twigCurve, 18, 10, (u) => lerp(0.0062, 0.0018, u), {
    capStart: true,
    capEnd: true,
    capRoundEnd: true
  });
  const twigMesh = new THREE.Mesh(twigGeo, mats.bark);
  twigMesh.userData.slot = 'secondary';
  twigMesh.castShadow = true;
  branchGroup.add(twigMesh);

  // Two small curved leaves on the twig for cozy dorm-diorama charm
  const leafGeo = buildCurvedLeaf(THREE, 0.025, 0.014);
  const leafSpecs = [
    { pos: [0.090, 0.049, 0.007], rot: [-0.45, 0.35, -0.78], scale: 1.0 },
    { pos: [0.099, 0.057, 0.009], rot: [-0.25, -0.4, -0.35], scale: 0.78 }
  ];
  for (const ls of leafSpecs) {
    const leaf = new THREE.Mesh(leafGeo, mats.leaf);
    leaf.userData.slot = 'primary';
    leaf.position.set(ls.pos[0], ls.pos[1], ls.pos[2]);
    leaf.rotation.set(ls.rot[0], ls.rot[1], ls.rot[2]);
    leaf.scale.setScalar(ls.scale);
    leaf.castShadow = true;
    branchGroup.add(leaf);
  }

  return branchGroup;
}

function buildLeg(THREE, side, mats, legCuffGeo) {
  const legGroup = new THREE.Group();
  legGroup.name = side > 0 ? 'legL' : 'legR';
  legGroup.position.set(side * 0.020, 0.045, 0.002);

  // Fluffy LatheGeometry feathered leg cuff tucked up into belly
  const cuff = new THREE.Mesh(legCuffGeo, mats.accentPlumage);
  cuff.userData.slot = 'furAccent';
  cuff.position.set(0, -0.002, -0.001);
  cuff.castShadow = true;
  legGroup.add(cuff);

  // 3 front toes + 1 rear toe wrapping naturally around the perch diameter
  const toeSpecs = [
    { yaw: -0.34 * side, len: 0.024, front: true },
    { yaw: 0.04 * side, len: 0.027, front: true },
    { yaw: 0.42 * side, len: 0.023, front: true },
    { yaw: 0.0, len: 0.019, front: false }
  ];

  for (const ts of toeSpecs) {
    const dirZ = ts.front ? 1 : -1;
    const sinY = Math.sin(ts.yaw);
    const cosY = Math.cos(ts.yaw);

    const p0 = new THREE.Vector3(0, 0.001, dirZ * 0.002);
    const p1 = new THREE.Vector3(sinY * ts.len * 0.42, 0.0005, dirZ * cosY * ts.len * 0.48);
    const p2 = new THREE.Vector3(sinY * ts.len * 0.80, -0.0065, dirZ * cosY * ts.len * 0.88);
    const p3 = new THREE.Vector3(sinY * ts.len * 0.94, -0.0145, dirZ * cosY * ts.len * 0.96);

    const toeCurve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
    const toeGeo = buildTaperedTube(THREE, toeCurve, 12, 8, (u) => lerp(0.0042, 0.0023, u), {
      capStart: true,
      capEnd: true,
      capRoundEnd: true
    });
    const toeMesh = new THREE.Mesh(toeGeo, mats.foot);
    toeMesh.userData.slot = 'skin';
    toeMesh.castShadow = true;
    legGroup.add(toeMesh);

    // Curved glossy talon extending seamlessly from toe tip, gripping the bark
    const c1 = p3.clone().add(new THREE.Vector3(sinY * 0.0012, -0.0042, dirZ * cosY * 0.0008));
    const c2 = p3.clone().add(new THREE.Vector3(sinY * 0.0004, -0.0075, -dirZ * cosY * 0.0026));
    const clawCurve = new THREE.CatmullRomCurve3([p3, c1, c2]);
    const clawGeo = buildTaperedTube(THREE, clawCurve, 8, 7, (u) => lerp(0.0020, 0.00025, u), {
      capStart: false,
      capEnd: true
    });
    const clawMesh = new THREE.Mesh(clawGeo, mats.claw);
    clawMesh.userData.slot = 'accent';
    legGroup.add(clawMesh);
  }

  return legGroup;
}

function buildBody(THREE, mats) {
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'body';
  bodyGroup.position.set(0, 0.048, 0.0);

  // Continuous sculpted pear-teardrop owl torso (56 x 40 segments)
  const torsoGeo = new THREE.SphereGeometry(0.050, 56, 40);
  sculptGeometry(THREE, torsoGeo, (v) => {
    const ny = clamp(v.y / 0.050, -1, 1); // -1 bottom, +1 top
    // Stretch vertically into plush upright perched owl body
    let y = (ny + 1) * 0.054 - 0.003; // local y in [-0.003, 0.105]
    const hT = clamp((y + 0.003) / 0.108, 0, 1); // 0 bottom, 1 top

    // Pear fullness: widest around belly (hT ~ 0.36), gently tapering up to neck (hT ~ 0.90)
    const widthProfile = 1.0 + Math.sin(hT * Math.PI) * 0.12 - smoothstep(0.45, 1.0, hT) * 0.32;
    let x = v.x * 1.02 * widthProfile;

    // Plump rounded chest in front (+Z), sleeker sloping back (-Z)
    let z = v.z * widthProfile;
    if (z > 0) {
      const chestBulge = Math.exp(-Math.pow((hT - 0.44) / 0.34, 2)) * 0.011;
      z = z * 0.98 + chestBulge * smoothstep(0, 0.03, z);
    } else {
      const rumpSlope = Math.exp(-Math.pow((hT - 0.24) / 0.28, 2)) * 0.008;
      z = z * 0.92 - rumpSlope * smoothstep(0, 0.03, -z);
    }

    // Subtle underside contour resting cozily over the branch
    if (hT < 0.16) {
      const press = smoothstep(0.16, 0.0, hT) * Math.exp(-Math.pow(z / 0.028, 2));
      y += press * 0.0035;
    }

    // Gentle subtle scalloped breast contour relief
    if (z > 0.018 && hT > 0.18 && hT < 0.80) {
      const wave = Math.sin(hT * 28 + Math.cos(x * 95) * 0.7) * 0.00055;
      z += wave * smoothstep(0.018, 0.036, z);
    }

    v.set(x, y, z);
  });

  const torsoMesh = new THREE.Mesh(torsoGeo, mats.plumage);
  torsoMesh.userData.slot = 'fur';
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  bodyGroup.add(torsoMesh);

  // Layered sculpted breast feathers shingled naturally over the chest
  const breastFeatherGeo = buildCurvedFeather(THREE, 0.022, 0.017, 0.0014, {
    bendZ: -0.0032,
    cupZ: 0.0016,
    pointiness: 0.12
  });
  const breastRows = [
    { y: 0.072, rZ: 0.0445, rX: 0.039, count: 5, span: 0.78, pitch: 0.34, scale: 0.92 },
    { y: 0.056, rZ: 0.0515, rX: 0.046, count: 6, span: 0.88, pitch: 0.16, scale: 1.05 },
    { y: 0.039, rZ: 0.0515, rX: 0.047, count: 5, span: 0.76, pitch: -0.10, scale: 1.02 }
  ];

  for (const row of breastRows) {
    for (let i = 0; i < row.count; i++) {
      const t = row.count === 1 ? 0 : (i / (row.count - 1)) * 2 - 1;
      const angle = t * row.span;
      const feather = new THREE.Mesh(breastFeatherGeo, mats.breastFeather);
      feather.userData.slot = 'furAccent';
      // Position base slightly tucked into chest surface so tip fans downward cleanly
      const fx = Math.sin(angle) * row.rX;
      const fz = Math.cos(angle) * row.rZ;
      feather.position.set(fx, row.y, fz);
      // Point feather tip downward (+Y of feather rotated ~PI around X) and follow chest curve
      feather.rotation.order = 'YXZ';
      feather.rotation.y = angle;
      feather.rotation.x = Math.PI - row.pitch;
      feather.rotation.z = -t * 0.08;
      feather.scale.setScalar(row.scale * (1.0 - Math.abs(t) * 0.12));
      feather.castShadow = true;
      bodyGroup.add(feather);
    }
  }

  return bodyGroup;
}

function buildWing(THREE, side, mats) {
  const wingGroup = new THREE.Group();
  wingGroup.name = side > 0 ? 'wingL' : 'wingR';
  wingGroup.position.set(side * 0.043, 0.077, -0.003);

  // Subtle organic asymmetry between left and right folded wings
  wingGroup.rotation.set(0.08, side * -0.06, side * (side > 0 ? 0.03 : 0.065));

  // 1. Sculpted wing shoulder mantle wrapping smoothly onto the upper body flank
  const mantleGeo = new THREE.SphereGeometry(0.032, 32, 24);
  sculptGeometry(THREE, mantleGeo, (v) => {
    const nx = v.x / 0.032;
    const ny = v.y / 0.032;
    const nz = v.z / 0.032;
    // Flatten into curved teardrop shield hugging the body side
    let x = v.x * 0.34;
    let y = v.y * 1.18 - 0.015;
    let z = v.z * 0.92 - 0.004;
    // Curve inward toward the torso along its length and depth
    const curveIn = (ny * ny * 0.008 + nz * nz * 0.007) * side;
    x -= curveIn;
    // Taper gently at the bottom trailing edge
    const botTaper = smoothstep(-0.95, 0.3, ny);
    z *= 0.65 + 0.35 * botTaper;
    // Keep inner side slightly concave so it seats deeply with zero gap
    if (nx * side < 0) x *= 0.55;
    v.set(x, y, z);
  });
  const mantle = new THREE.Mesh(mantleGeo, mats.plumage);
  mantle.userData.slot = 'fur';
  mantle.castShadow = true;
  mantle.receiveShadow = true;
  wingGroup.add(mantle);

  // 2. Two overlapping tiers of curved wing covert feathers
  const covertGeo = buildCurvedFeather(THREE, 0.032, 0.016, 0.0016, {
    bendZ: 0.0055,
    cupZ: 0.0018,
    sweepX: side * -0.002,
    pointiness: 0.22
  });
  const covertRows = [
    { y: -0.006, zStart: 0.016, zEnd: -0.016, xOff: 0.0095, count: 4, scale: 0.88, pitch: 0.24 },
    { y: -0.020, zStart: 0.014, zEnd: -0.020, xOff: 0.0102, count: 5, scale: 1.0, pitch: 0.34 }
  ];

  for (const row of covertRows) {
    for (let i = 0; i < row.count; i++) {
      const t = i / (row.count - 1);
      const f = new THREE.Mesh(covertGeo, mats.wingFeather);
      f.userData.slot = 'fur';
      const z = lerp(row.zStart, row.zEnd, t);
      const x = side * (row.xOff - Math.abs(t - 0.35) * 0.003);
      f.position.set(x, row.y - t * 0.005, z);
      f.rotation.order = 'YXZ';
      // Outward face of feather points along +X (for L) or -X (for R), tip slopes down and back
      f.rotation.y = side * (Math.PI * 0.5 - 0.14 + t * 0.28);
      f.rotation.x = Math.PI - row.pitch - t * 0.14;
      f.rotation.z = side * (-0.18 - t * 0.10);
      f.scale.setScalar(row.scale * (0.94 + Math.sin(t * Math.PI) * 0.12));
      f.castShadow = true;
      wingGroup.add(f);
    }
  }

  // 3. Longer folded primary & secondary flight feathers curving neatly toward rump
  const primaryGeo = buildCurvedFeather(THREE, 0.056, 0.0155, 0.0016, {
    bendZ: 0.0105,
    cupZ: 0.0015,
    sweepX: side * -0.004,
    pointiness: 0.48
  });

  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const f = new THREE.Mesh(primaryGeo, mats.wingFeather);
    f.userData.slot = 'fur';
    f.position.set(
      side * (0.0085 - t * 0.0032),
      -0.022 - t * 0.004,
      0.006 - t * 0.022
    );
    f.rotation.order = 'YXZ';
    f.rotation.y = side * (Math.PI * 0.5 + 0.08 + t * 0.36);
    f.rotation.x = Math.PI - 0.52 - t * 0.08;
    f.rotation.z = side * (-0.28 - t * 0.12);
    f.scale.set(0.95 - t * 0.12, 1.04 - t * 0.12, 1.0);
    f.castShadow = true;
    wingGroup.add(f);
  }

  return wingGroup;
}

function buildTail(THREE, mats) {
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tail';
  tailGroup.position.set(0.0, 0.015, -0.036);
  tailGroup.rotation.set(0.56, 0.05, 0.0);

  const tailFeatherGeo = buildCurvedFeather(THREE, 0.056, 0.016, 0.0016, {
    bendZ: -0.006,
    cupZ: 0.0014,
    pointiness: 0.28
  });

  const count = 7;
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1)) * 2 - 1; // -1..+1
    const f = new THREE.Mesh(tailFeatherGeo, mats.wingFeather);
    f.userData.slot = 'fur';
    f.position.set(t * 0.015, -Math.abs(t) * 0.002, -Math.abs(t) * 0.003);
    f.rotation.order = 'YXZ';
    // Tip points downward (-Y in local space) and fans cleanly
    f.rotation.x = Math.PI;
    f.rotation.z = t * 0.25;
    f.rotation.y = t * 0.16;
    const lenScale = 1.04 - Math.abs(t) * 0.14;
    f.scale.set(0.95, lenScale, 1.0);
    f.castShadow = true;
    tailGroup.add(f);
  }

  return tailGroup;
}

function buildEye(THREE, side, mats) {
  const eyeGroup = new THREE.Group();
  eyeGroup.name = side > 0 ? 'eyeL' : 'eyeR';
  eyeGroup.position.set(side * 0.0205, 0.0325, 0.0355);
  eyeGroup.rotation.set(-0.04, side * 0.17, 0);

  const r = 0.0138;
  const zSquash = 0.64;

  // Layer 1: Coloured glossy iris eyeball with clean planar front UVs
  const irisGeo = new THREE.SphereGeometry(r, 28, 20);
  const pos = irisGeo.attributes.position;
  const uv = irisGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    pos.setZ(i, z * zSquash);
    uv.setXY(i, clamp(0.5 + x / (r * 2.02), 0, 1), clamp(0.5 + y / (r * 2.02), 0, 1));
  }
  pos.needsUpdate = true;
  uv.needsUpdate = true;
  irisGeo.computeVertexNormals();

  const irisMesh = new THREE.Mesh(irisGeo, mats.iris);
  irisMesh.userData.slot = 'eye';
  eyeGroup.add(irisMesh);

  // Layer 2: Deep glossy black pupil dome resting flush on the front of the iris
  const pupilArc = mats.variant === 2 ? 0.88 : mats.variant === 0 ? 0.78 : 0.68;
  const pupilGeo = new THREE.SphereGeometry(r * 1.022, 24, 14, 0, Math.PI * 2, 0, pupilArc);
  pupilGeo.rotateX(Math.PI * 0.5); // pole faces +Z
  sculptGeometry(THREE, pupilGeo, (v) => {
    v.z *= zSquash;
  });
  const pupilMesh = new THREE.Mesh(pupilGeo, mats.pupil);
  pupilMesh.userData.slot = 'eye';
  eyeGroup.add(pupilMesh);

  // Layer 3: Crisp dual catchlight highlight dots placed up and to one side (consistent light direction)
  const hiMainGeo = new THREE.SphereGeometry(0.0028, 12, 10);
  const hiMain = new THREE.Mesh(hiMainGeo, mats.highlight);
  hiMain.userData.slot = 'eye';
  hiMain.position.set(-0.0044, 0.0048, r * zSquash * 0.88);
  hiMain.scale.set(1.0, 1.0, 0.45);
  eyeGroup.add(hiMain);

  const hiSubGeo = new THREE.SphereGeometry(0.00125, 10, 8);
  const hiSub = new THREE.Mesh(hiSubGeo, mats.highlight);
  hiSub.userData.slot = 'eye';
  hiSub.position.set(0.0043, -0.0040, r * zSquash * 0.87);
  hiSub.scale.set(1.0, 1.0, 0.45);
  eyeGroup.add(hiSub);

  return eyeGroup;
}

function buildEarTuft(THREE, side, mats, variant) {
  const earGroup = new THREE.Group();
  earGroup.name = side > 0 ? 'earL' : 'earR';
  earGroup.position.set(side * 0.030, 0.059, 0.007);

  // Variant-tuned silhouette: jaunty Tawny tufts, plush swept Snowy, sleek Barn crown plumes
  const lenMain = variant === 0 ? 0.032 : variant === 1 ? 0.024 : 0.021;
  const spreadZ = variant === 0 ? -0.44 : variant === 1 ? -0.62 : -0.78;
  // Subtle playful asymmetry (one ear tuft perked slightly higher)
  const asym = side > 0 ? 0.06 : -0.03;
  earGroup.rotation.set(-0.22, side * -0.18, side * (spreadZ + asym));

  const mainGeo = buildCurvedFeather(THREE, lenMain, 0.013, 0.0016, {
    bendZ: -0.0045,
    cupZ: 0.0016,
    sweepX: side * 0.0025,
    pointiness: 0.45
  });
  const mainPlume = new THREE.Mesh(mainGeo, mats.wingFeather);
  mainPlume.userData.slot = 'fur';
  mainPlume.castShadow = true;
  earGroup.add(mainPlume);

  // Soft lighter inner ear-tuft plume
  const innerGeo = buildCurvedFeather(THREE, lenMain * 0.74, 0.0095, 0.0013, {
    bendZ: -0.003,
    cupZ: 0.0012,
    sweepX: side * 0.0012,
    pointiness: 0.35
  });
  const innerPlume = new THREE.Mesh(innerGeo, mats.breastFeather);
  innerPlume.userData.slot = 'furAccent';
  innerPlume.position.set(side * -0.0022, -0.001, 0.0022);
  innerPlume.rotation.set(0.06, side * 0.14, side * 0.10);
  earGroup.add(innerPlume);

  // Flanking outer plume for rich feathery silhouette
  const outerPlume = new THREE.Mesh(innerGeo, mats.wingFeather);
  outerPlume.userData.slot = 'fur';
  outerPlume.position.set(side * 0.0028, -0.002, -0.0018);
  outerPlume.rotation.set(-0.08, side * -0.16, side * -0.14);
  outerPlume.scale.setScalar(0.88);
  outerPlume.castShadow = true;
  earGroup.add(outerPlume);

  return earGroup;
}

function buildHead(THREE, mats, variant) {
  const headGroup = new THREE.Group();
  headGroup.name = 'head';
  // Overlaps deeply with upper body torso for zero visible seam during tilt/sway
  headGroup.position.set(0, 0.087, 0.004);
  // Gentle curious three-quarter head pose
  headGroup.rotation.set(0.05, 0.13, -0.095);

  // 1. Continuous sculpted wide stylised owl cranium (56 x 40 segments)
  const craniumGeo = new THREE.SphereGeometry(0.048, 56, 40);
  sculptGeometry(THREE, craniumGeo, (v) => {
    const nx = v.x / 0.048;
    const ny = v.y / 0.048;
    const nz = v.z / 0.048;

    let x = v.x * 1.12;
    let y = v.y * 0.88 + 0.031;
    let z = v.z * 0.94;

    // Fluffy wide owl cheeks around lower sides
    const cheek = Math.exp(-Math.pow((ny + 0.25) / 0.45, 2)) * Math.abs(nx);
    x *= 1.0 + cheek * 0.07;

    // Gentle flattening of the front facial plane + subtle crown dip
    if (nz > 0.25) {
      z -= Math.pow(nz - 0.25, 1.5) * 0.006;
    }
    if (ny > 0.55) {
      const crownDip = Math.exp(-Math.pow(nx / 0.35, 2)) * (ny - 0.55) * 0.004;
      y -= crownDip;
    }

    // Recessed eye sockets so large eyes sit nestled in the surface
    if (nz > 0.2) {
      const dL = Math.hypot(x - 0.0205, y - 0.0325);
      const dR = Math.hypot(x + 0.0205, y - 0.0325);
      const indent =
        Math.exp(-Math.pow(dL / 0.0155, 2)) * 0.0065 +
        Math.exp(-Math.pow(dR / 0.0155, 2)) * 0.0065;
      z -= indent * smoothstep(0.2, 0.65, nz);
    }

    // Flared seamless neck feather skirt wrapping down into upper chest
    if (ny < -0.42) {
      const skirt = smoothstep(-0.42, -1.0, ny);
      y -= skirt * 0.009;
      x *= 1.0 - skirt * 0.14;
      z *= 1.0 - skirt * 0.12;
    }

    v.set(x, y, z);
  });

  const cranium = new THREE.Mesh(craniumGeo, mats.plumage);
  cranium.userData.slot = 'fur';
  cranium.castShadow = true;
  cranium.receiveShadow = true;
  headGroup.add(cranium);

  // 2. Sculpted continuous plush facial disc nestled on front of head
  const discGeo = buildFacialDiscGeo(THREE, variant);
  const discMesh = new THREE.Mesh(discGeo, mats.facialDisc);
  discMesh.userData.slot = 'furAccent';
  discMesh.position.set(0, 0.0305, 0.0375);
  discMesh.receiveShadow = true;
  headGroup.add(discMesh);

  // 3. Soft feathered eyebrow / lore plumes framing the upper eyes
  const browGeo = buildCurvedFeather(THREE, 0.024, 0.009, 0.0014, {
    bendZ: -0.0045,
    cupZ: 0.0012,
    pointiness: 0.35
  });
  for (const side of [1, -1]) {
    const brow = new THREE.Mesh(browGeo, mats.breastFeather);
    brow.userData.slot = 'furAccent';
    brow.position.set(side * 0.006, 0.039, 0.0415);
    brow.rotation.order = 'YXZ';
    brow.rotation.y = side * 0.24;
    brow.rotation.z = side * -1.02;
    brow.rotation.x = 0.14;
    headGroup.add(brow);

    // Sculpted eyelid feather collar seating the eyeball snugly into the socket
    const rimPts = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      rimPts.push(new THREE.Vector3(Math.cos(a) * 0.0142, Math.sin(a) * 0.0140, Math.sin(a) * 0.0012));
    }
    const rimCurve = new THREE.CatmullRomCurve3(rimPts, true);
    const rimGeo = buildTaperedTube(
      THREE,
      rimCurve,
      24,
      8,
      (u) => 0.0016 + Math.max(0, Math.sin(u * Math.PI * 2)) * 0.0011,
      { capStart: false, capEnd: false }
    );
    const rimMesh = new THREE.Mesh(rimGeo, mats.accentPlumage);
    rimMesh.userData.slot = 'furAccent';
    rimMesh.position.set(side * 0.0205, 0.0325, 0.0395);
    rimMesh.rotation.set(-0.04, side * 0.17, 0);
    headGroup.add(rimMesh);

    // Big glossy multi-layer eye
    headGroup.add(buildEye(THREE, side, mats));

    // Subtle soft blush disc conforming to lower facial disc cheek
    const blushGeo = new THREE.PlaneGeometry(0.017, 0.011, 6, 4);
    sculptGeometry(THREE, blushGeo, (v) => {
      v.z -= (v.x * v.x) * 8.0 + (v.y * v.y) * 5.0;
    });
    const blush = new THREE.Mesh(blushGeo, mats.blush);
    blush.userData.slot = 'skin';
    blush.position.set(side * 0.0285, 0.0165, 0.0378);
    blush.rotation.set(0.10, side * 0.34, side * -0.10);
    headGroup.add(blush);

    // Ear tufts
    headGroup.add(buildEarTuft(THREE, side, mats, variant));
  }

  // 4. Sculpted hooked curved owl beak + soft cere + subtle mouth line
  const beakGeo = new THREE.SphereGeometry(0.0085, 28, 20);
  sculptGeometry(THREE, beakGeo, (v) => {
    const nx = v.x / 0.0085;
    const ny = v.y / 0.0085;
    const nz = v.z / 0.0085;
    const f = clamp((nz + 1) * 0.5, 0, 1); // 0 base, 1 tip
    // Narrow sharply toward hooked tip with a crisp upper ridge (culmen)
    const taper = Math.pow(1 - f * 0.88, 0.9);
    const x = v.x * 0.72 * taper;
    const ridge = ny > 0 ? (1 - Math.abs(nx)) * 0.0022 * (1 - f * 0.5) : 0;
    const hookDrop = Math.pow(f, 1.85) * 0.0115;
    const y = v.y * 0.78 * (0.45 + 0.55 * taper) + ridge - hookDrop;
    const z = f * 0.0165 - 0.003;
    v.set(x, y, z);
  });
  const beakMesh = new THREE.Mesh(beakGeo, mats.beak);
  beakMesh.userData.slot = 'accent';
  beakMesh.position.set(0, 0.0255, 0.0415);
  beakMesh.castShadow = true;
  headGroup.add(beakMesh);

  // Soft cere bridge at top base of beak
  const cereGeo = new THREE.SphereGeometry(0.0046, 16, 12);
  sculptGeometry(THREE, cereGeo, (v) => {
    v.x *= 1.15;
    v.y *= 0.65;
    v.z *= 0.72;
  });
  const cere = new THREE.Mesh(cereGeo, mats.cere);
  cere.userData.slot = 'skin';
  cere.position.set(0, 0.0290, 0.0425);
  headGroup.add(cere);

  // Delicate curved beak commissure / cozy smile tube nestled under upper beak
  const mouthCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.0042, 0.0218, 0.0432),
    new THREE.Vector3(-0.0018, 0.0204, 0.0456),
    new THREE.Vector3(0.0, 0.0200, 0.0462),
    new THREE.Vector3(0.0018, 0.0204, 0.0456),
    new THREE.Vector3(0.0042, 0.0218, 0.0432)
  ]);
  const mouthGeo = buildTaperedTube(
    THREE,
    mouthCurve,
    12,
    6,
    (u) => 0.00045 + Math.sin(u * Math.PI) * 0.00035,
    { capStart: true, capEnd: true }
  );
  const mouthLine = new THREE.Mesh(mouthGeo, mats.claw);
  mouthLine.userData.slot = 'accent';
  headGroup.add(mouthLine);

  return headGroup;
}

function storeBaseTransform(obj) {
  if (!obj) return;
  obj.userData._basePos = obj.position.clone();
  obj.userData._baseRot = obj.rotation.clone();
  obj.userData._baseScale = obj.scale.clone();
}

export function build(THREE, opts = {}, kit) {
  const pal = resolvePalette(THREE, opts);

  const plumageTex = makePlumageTextures(THREE, kit, pal);
  const facialTex = makeFacialDiscTextures(THREE, kit, pal);
  const wingFeatherTex = makeFeatherTextures(THREE, kit, pal, false);
  const breastFeatherTex = makeFeatherTextures(THREE, kit, pal, true);
  const irisTex = makeIrisTexture(THREE, kit, pal.eye, pal.variant);
  const blushTex = makeBlushTexture(THREE, kit, pal.blush);
  const barkTex = makeBarkTextures(THREE, kit);
  const woodEndTex = makeWoodEndTexture(THREE, kit);

  const mats = {
    variant: pal.variant,
    plumage: new THREE.MeshPhysicalMaterial({
      map: plumageTex.map,
      bumpMap: plumageTex.bumpMap,
      bumpScale: 0.0016,
      roughness: 0.92,
      metalness: 0.0,
      sheen: 0.85,
      sheenRoughness: 0.72,
      sheenColor: pal.furSheen
    }),
    accentPlumage: new THREE.MeshPhysicalMaterial({
      color: pal.furAccent,
      bumpMap: plumageTex.bumpMap,
      bumpScale: 0.0012,
      roughness: 0.93,
      metalness: 0.0,
      sheen: 0.9,
      sheenRoughness: 0.68,
      sheenColor: pal.accentSheen
    }),
    facialDisc: new THREE.MeshPhysicalMaterial({
      map: facialTex.map,
      bumpMap: facialTex.bumpMap,
      bumpScale: 0.0014,
      roughness: 0.91,
      metalness: 0.0,
      sheen: 0.92,
      sheenRoughness: 0.65,
      sheenColor: pal.accentSheen
    }),
    wingFeather: new THREE.MeshPhysicalMaterial({
      map: wingFeatherTex.map,
      bumpMap: wingFeatherTex.bumpMap,
      bumpScale: 0.0012,
      roughness: 0.89,
      metalness: 0.0,
      sheen: 0.8,
      sheenRoughness: 0.7,
      sheenColor: pal.furSheen
    }),
    breastFeather: new THREE.MeshPhysicalMaterial({
      map: breastFeatherTex.map,
      bumpMap: breastFeatherTex.bumpMap,
      bumpScale: 0.0010,
      roughness: 0.92,
      metalness: 0.0,
      sheen: 0.88,
      sheenRoughness: 0.66,
      sheenColor: pal.accentSheen
    }),
    iris: new THREE.MeshPhysicalMaterial({
      map: irisTex,
      roughness: 0.07,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04
    }),
    pupil: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#09070a'),
      roughness: 0.04,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03
    }),
    highlight: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.85,
      roughness: 0.05,
      clearcoat: 1.0
    }),
    beak: new THREE.MeshPhysicalMaterial({
      color: pal.beak,
      roughness: 0.22,
      metalness: 0.02,
      clearcoat: 0.85,
      clearcoatRoughness: 0.14
    }),
    cere: new THREE.MeshPhysicalMaterial({
      color: pal.cere,
      roughness: 0.78,
      metalness: 0.0
    }),
    foot: new THREE.MeshPhysicalMaterial({
      color: pal.foot,
      roughness: 0.82,
      metalness: 0.0,
      bumpMap: barkTex.bumpMap,
      bumpScale: 0.0005
    }),
    claw: new THREE.MeshPhysicalMaterial({
      color: pal.claw,
      roughness: 0.18,
      metalness: 0.04,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1
    }),
    blush: new THREE.MeshPhysicalMaterial({
      map: blushTex,
      transparent: true,
      depthWrite: false,
      roughness: 0.95,
      metalness: 0.0
    }),
    bark: new THREE.MeshPhysicalMaterial({
      map: barkTex.map,
      bumpMap: barkTex.bumpMap,
      bumpScale: 0.0028,
      roughness: 0.94,
      metalness: 0.0
    }),
    woodEnd: new THREE.MeshPhysicalMaterial({
      map: woodEndTex,
      roughness: 0.88,
      metalness: 0.0
    }),
    leaf: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#6f8c54'),
      roughness: 0.68,
      metalness: 0.0,
      sheen: 0.45,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color('#b6cc8f')
    })
  };

  const root = new THREE.Group();
  root.name = 'cozy-owl';

  // Perch branch resting firmly on Y = 0
  root.add(buildBranch(THREE, kit, mats));

  // Legs & talons gripping the branch
  const legCuffGeo = buildLegCuffGeo(THREE);
  const legL = buildLeg(THREE, 1, mats, legCuffGeo);
  const legR = buildLeg(THREE, -1, mats, legCuffGeo);
  root.add(legL, legR);

  // Sculpted body with layered breast feathers, folded wings, tail, and head
  const body = buildBody(THREE, mats);
  const wingL = buildWing(THREE, 1, mats);
  const wingR = buildWing(THREE, -1, mats);
  const tail = buildTail(THREE, mats);
  const head = buildHead(THREE, mats, pal.variant);

  body.add(wingL, wingR, tail, head);
  root.add(body);

  // Cache resting poses for smooth non-destructive animation in idle()
  const animTargets = [
    body,
    head,
    tail,
    wingL,
    wingR,
    legL,
    legR,
    head.getObjectByName('earL'),
    head.getObjectByName('earR'),
    head.getObjectByName('eyeL'),
    head.getObjectByName('eyeR')
  ];
  for (const obj of animTargets) storeBaseTransform(obj);

  return root;
}

export function idle(group, t) {
  if (!group) return;
  let refs = group.userData._animRefs;
  if (!refs) {
    refs = {
      body: group.getObjectByName('body'),
      head: group.getObjectByName('head'),
      tail: group.getObjectByName('tail'),
      wingL: group.getObjectByName('wingL'),
      wingR: group.getObjectByName('wingR'),
      earL: group.getObjectByName('earL'),
      earR: group.getObjectByName('earR'),
      eyeL: group.getObjectByName('eyeL'),
      eyeR: group.getObjectByName('eyeR')
    };
    group.userData._animRefs = refs;
  }

  // Calm rhythmic breathing
  const breath = Math.sin(t * 2.05);
  if (refs.body && refs.body.userData._baseScale) {
    const bs = refs.body.userData._baseScale;
    refs.body.scale.set(
      bs.x * (1 + breath * 0.016),
      bs.y * (1 + breath * 0.020),
      bs.z * (1 + breath * 0.018)
    );
  }

  // Gentle curious head sway & micro-tilt
  const swayY = Math.sin(t * 0.62) * 0.095 + Math.sin(t * 1.41) * 0.028;
  const swayZ = Math.sin(t * 0.48 + 0.8) * 0.055;
  const swayX = Math.sin(t * 0.85 + 0.4) * 0.025 + breath * 0.012;
  if (refs.head && refs.head.userData._baseRot) {
    const br = refs.head.userData._baseRot;
    refs.head.rotation.set(br.x + swayX, br.y + swayY, br.z + swayZ);
  }

  // Subtle follow-through ear tuft perk
  const earPerk = Math.sin(t * 0.48 + 0.25) * 0.05 + Math.sin(t * 2.05 - 0.4) * 0.022;
  if (refs.earL && refs.earL.userData._baseRot) {
    const br = refs.earL.userData._baseRot;
    refs.earL.rotation.z = br.z + earPerk;
  }
  if (refs.earR && refs.earR.userData._baseRot) {
    const br = refs.earR.userData._baseRot;
    refs.earR.rotation.z = br.z - earPerk * 0.85;
  }

  // Gentle folded wing breathing settle
  if (refs.wingL && refs.wingL.userData._baseRot) {
    const br = refs.wingL.userData._baseRot;
    refs.wingL.rotation.z = br.z + breath * 0.016;
  }
  if (refs.wingR && refs.wingR.userData._baseRot) {
    const br = refs.wingR.userData._baseRot;
    refs.wingR.rotation.z = br.z - breath * 0.016;
  }

  // Slow tail balance bob
  if (refs.tail && refs.tail.userData._baseRot) {
    const br = refs.tail.userData._baseRot;
    refs.tail.rotation.x = br.x + Math.sin(t * 1.05 - 0.5) * 0.028;
  }

  // Periodic natural blink (with occasional double-blink)
  const blinkCycle = ((t % 4.2) + 4.2) % 4.2;
  const doubleCycle = ((t % 12.6) + 12.6) % 12.6;
  let blinkAmt = 0;
  if (blinkCycle > 3.98) {
    const p = (blinkCycle - 3.98) / 0.22;
    blinkAmt = Math.sin(p * Math.PI);
  } else if (doubleCycle > 0.16 && doubleCycle < 0.36) {
    const p = (doubleCycle - 0.16) / 0.20;
    blinkAmt = Math.sin(p * Math.PI);
  }
  const eyeScaleY = lerp(1.0, 0.06, blinkAmt);
  if (refs.eyeL && refs.eyeL.userData._baseScale) {
    refs.eyeL.scale.y = refs.eyeL.userData._baseScale.y * eyeScaleY;
  }
  if (refs.eyeR && refs.eyeR.userData._baseScale) {
    refs.eyeR.scale.y = refs.eyeR.userData._baseScale.y * eyeScaleY;
  }
}
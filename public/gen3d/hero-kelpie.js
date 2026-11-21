export const META = {
  id: 'kelpie-foal',
  name: 'Kelpie Foal',
  kind: 'creature',
  footprint: [0.26, 0.48],
  variants: ['Sea Green', 'Deep Blue', 'Pearl'],
  note: 'Stylised chibi water-horse foal (~0.5 m tall) with breaking-wave mane, translucent fin fetlocks, fish-fin tail, and wet clearcoat sheen.'
};

const VARIANT_PRESETS = [
  {
    fur: '#4ca69a',
    furAccent: '#1b7a8e',
    eye: '#f2a93b',
    hoof: '#2d575e',
    innerEar: '#d8b4b8',
    blush: '#e88b92',
    foam: '#e6fbf8'
  },
  {
    fur: '#2f5a8f',
    furAccent: '#1a95ba',
    eye: '#6df0e6',
    hoof: '#1b2f4d',
    innerEar: '#a9b4d8',
    blush: '#d67fa6',
    foam: '#dff7ff'
  },
  {
    fur: '#dde7ea',
    furAccent: '#7dc0d4',
    eye: '#7c6ef0',
    hoof: '#adbac8',
    innerEar: '#e8c8d2',
    blush: '#ef9cab',
    foam: '#ffffff'
  }
];

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function resolvePalette(THREE, opts) {
  const o = opts || {};
  const variantIdx = clamp(Math.floor(o.variant ?? 0), 0, VARIANT_PRESETS.length - 1);
  const base = VARIANT_PRESETS[variantIdx];

  const fur = new THREE.Color(o.fur || base.fur);
  const furAccent = new THREE.Color(o.furAccent || base.furAccent);
  const eye = new THREE.Color(o.eye || base.eye);
  const hoof = new THREE.Color(base.hoof);
  const innerEar = new THREE.Color(base.innerEar);
  const blush = new THREE.Color(base.blush);
  const foam = new THREE.Color(base.foam);

  if (o.fur) {
    hoof.copy(fur).multiplyScalar(0.48);
    innerEar.copy(fur).lerp(new THREE.Color('#efb7c0'), 0.65);
  }

  const furDark = fur.clone().multiplyScalar(0.62);
  const furLight = fur.clone().lerp(new THREE.Color('#eefaf8'), 0.58);
  const furMuzzle = fur.clone().lerp(new THREE.Color('#f4fbfa'), 0.42);
  const furAccentDeep = furAccent.clone().multiplyScalar(0.64);
  const furAccentLight = furAccent.clone().lerp(foam, 0.55);
  const sheen = fur.clone().lerp(new THREE.Color('#ffffff'), 0.65);
  const glow = furAccent.clone().lerp(foam, 0.72);

  return {
    variantIdx,
    fur,
    furDark,
    furLight,
    furMuzzle,
    furAccent,
    furAccentDeep,
    furAccentLight,
    eye,
    hoof,
    innerEar,
    blush,
    foam,
    sheen,
    glow
  };
}

function colHex(c) {
  return '#' + c.getHexString();
}

function rgbaStr(c, a) {
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  return `rgba(${r},${g},${b},${a})`;
}

// ---------------------------------------------------------------------------
// Procedural Canvas Textures (using kit.canvasTexture & kit.noise)
// ---------------------------------------------------------------------------

function createBodyTextures(THREE, kit, pal) {
  const colorTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, colHex(pal.furDark));
    grad.addColorStop(0.24, colHex(pal.fur));
    grad.addColorStop(0.60, colHex(pal.fur));
    grad.addColorStop(0.80, colHex(pal.furLight));
    grad.addColorStop(1.0, colHex(pal.furLight));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle organic aquatic mottling & caustics using kit.noise
    for (let y = 0; y < h; y += 6) {
      const vn = y / h;
      for (let x = 0; x < w; x += 6) {
        const un = x / w;
        const n1 = kit.noise(un * 9.0, vn * 7.0);
        const n2 = kit.noise(un * 20.0 + 13.4, vn * 18.0 + 4.1);
        const n = n1 * 0.65 + n2 * 0.35;
        if (vn > 0.12 && vn < 0.72) {
          if (n > 0.62) {
            ctx.fillStyle = rgbaStr(pal.furLight, (n - 0.62) * 0.55);
            ctx.fillRect(x, y, 7, 7);
          } else if (n < 0.36) {
            ctx.fillStyle = rgbaStr(pal.furDark, (0.36 - n) * 0.45);
            ctx.fillRect(x, y, 7, 7);
          }
        }
      }
    }

    // Soft sea-foal dapples along flanks and rump
    for (let i = 0; i < 64; i++) {
      const fx = kit.noise(i * 1.73, 3.11);
      const fy = 0.22 + kit.noise(i * 2.19, 7.43) * 0.44;
      const rad = 5 + kit.noise(i * 4.31, 1.9) * 14;
      const cx = fx * w;
      const cy = fy * h;
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      rg.addColorStop(0.0, rgbaStr(pal.foam, 0.34));
      rg.addColorStop(0.55, rgbaStr(pal.furLight, 0.16));
      rg.addColorStop(1.0, rgbaStr(pal.furLight, 0.0));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rad * 1.25, rad * 0.85, 0.15, 0, Math.PI * 2);
      ctx.fill();
    }

    // Delicate iridescent scale shimmer band near the hindquarters/flank
    ctx.strokeStyle = rgbaStr(pal.furAccentLight, 0.22);
    ctx.lineWidth = 1.2;
    for (let row = 0; row < 14; row++) {
      const y = h * (0.28 + row * 0.032);
      const offset = (row % 2) * 10;
      for (let col = 0; col < 26; col++) {
        const x = col * 20 + offset;
        const mask = kit.noise(col * 0.35 + 2.1, row * 0.4 + 5.7);
        if (mask > 0.52) {
          ctx.beginPath();
          ctx.arc(x, y, 9, 0.15 * Math.PI, 0.85 * Math.PI);
          ctx.stroke();
        }
      }
    }
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.ClampToEdgeWrapping;

  const bumpTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const n = kit.noise((x / w) * 28, (y / h) * 28);
        const v = Math.round(112 + n * 32);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 4, 4);
      }
    }
    // Subtle pearlescent scale micro-relief
    ctx.strokeStyle = 'rgba(215,215,215,0.28)';
    ctx.lineWidth = 1.4;
    for (let row = 0; row < 18; row++) {
      const y = h * (0.24 + row * 0.028);
      const off = (row % 2) * 9;
      for (let col = 0; col < 29; col++) {
        const x = col * 18 + off;
        const m = kit.noise(col * 0.3, row * 0.35);
        if (m > 0.48) {
          ctx.beginPath();
          ctx.arc(x, y, 8, 0.15 * Math.PI, 0.85 * Math.PI);
          ctx.stroke();
        }
      }
    }
  });
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.ClampToEdgeWrapping;

  return { map: colorTex, bumpMap: bumpTex };
}

function createHeadTexture(THREE, kit, pal) {
  const tex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    // Base coat gradient top-to-bottom
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, colHex(pal.furDark));
    grad.addColorStop(0.28, colHex(pal.fur));
    grad.addColorStop(0.68, colHex(pal.fur));
    grad.addColorStop(1.0, colHex(pal.furLight));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle organic noise flecks
    for (let y = 0; y < h; y += 6) {
      for (let x = 0; x < w; x += 6) {
        const n = kit.noise((x / w) * 14, (y / h) * 14);
        if (n > 0.64) {
          ctx.fillStyle = rgbaStr(pal.furLight, (n - 0.64) * 0.35);
          ctx.fillRect(x, y, 6, 6);
        }
      }
    }

    // On SphereGeometry, +Z faces u = 0.25 (since x = -r cos(phi) sin(theta), z = r sin(phi) sin(theta), phi=u*2pi -> sin(pi/2)=1 at u=0.25)
    // Wait: Three.js SphereGeometry default: phiStart = 0, x = -cos(phi)*sin(theta), z = sin(phi)*sin(theta).
    // So +Z is at phi = pi/2 => u = 0.25!
    const muzzleX = w * 0.25;
    const muzzleY = h * 0.56;
    const mg = ctx.createRadialGradient(muzzleX, muzzleY, 10, muzzleX, muzzleY, w * 0.15);
    mg.addColorStop(0.0, rgbaStr(pal.furMuzzle, 0.92));
    mg.addColorStop(0.55, rgbaStr(pal.furMuzzle, 0.45));
    mg.addColorStop(1.0, rgbaStr(pal.furMuzzle, 0.0));
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.ellipse(muzzleX, muzzleY, w * 0.15, h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Soft sea-foam crescent blaze on the forehead (+Z, upper half)
    const blazeY = h * 0.34;
    const bg = ctx.createRadialGradient(muzzleX, blazeY, 2, muzzleX, blazeY, w * 0.045);
    bg.addColorStop(0.0, rgbaStr(pal.foam, 0.62));
    bg.addColorStop(0.55, rgbaStr(pal.furLight, 0.25));
    bg.addColorStop(1.0, rgbaStr(pal.furLight, 0.0));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(muzzleX, blazeY, w * 0.032, h * 0.068, 0, 0, Math.PI * 2);
    ctx.fill();

    // Soft dark nostril recesses on +/-X side of u = 0.25
    const nosOffsets = [-0.048, 0.048];
    for (const du of nosOffsets) {
      const nx = w * (0.25 + du);
      const ny = h * 0.51;
      const ng = ctx.createRadialGradient(nx, ny, 1, nx, ny, 11);
      ng.addColorStop(0.0, rgbaStr(pal.furDark, 0.85));
      ng.addColorStop(0.55, rgbaStr(pal.furDark, 0.35));
      ng.addColorStop(1.0, rgbaStr(pal.furDark, 0.0));
      ctx.fillStyle = ng;
      ctx.beginPath();
      ctx.ellipse(nx, ny, 10, 7, du < 0 ? -0.35 : 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function createWaveManeTextures(THREE, kit, pal) {
  const colorTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    // v=1 (canvas y=0) is breaking crest tip -> frothy seafoam white
    // v=0 (canvas y=h) is root -> deep aquatic furAccent
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, colHex(pal.foam));
    grad.addColorStop(0.18, colHex(pal.furAccentLight));
    grad.addColorStop(0.55, colHex(pal.furAccent));
    grad.addColorStop(1.0, colHex(pal.furAccentDeep));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Flowing water-curl ribbons and seafoam streaks
    for (let i = 0; i < 48; i++) {
      const y0 = (i / 48) * h;
      ctx.strokeStyle = i < 16 ? rgbaStr(pal.foam, 0.55) : rgbaStr(pal.furAccentLight, 0.30);
      ctx.lineWidth = i < 14 ? 4.5 : 2.5;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 16) {
        const wave = Math.sin((x / w) * Math.PI * 2.5 + i * 0.4) * 14
          + (kit.noise(x * 0.015, i * 0.25) - 0.5) * 18;
        if (x === 0) ctx.moveTo(x, y0 + wave);
        else ctx.lineTo(x, y0 + wave);
      }
      ctx.stroke();
    }

    // Seafoam bubbles near the breaking crest
    for (let i = 0; i < 70; i++) {
      const bx = kit.noise(i * 3.1, 1.7) * w;
      const by = Math.pow(kit.noise(i * 1.9, 6.3), 1.7) * h * 0.42;
      const r = 2.5 + kit.noise(i * 5.7, 2.9) * 8.5;
      const bg = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      bg.addColorStop(0.0, rgbaStr(pal.foam, 0.85));
      bg.addColorStop(0.7, rgbaStr(pal.foam, 0.35));
      bg.addColorStop(1.0, rgbaStr(pal.foam, 0.0));
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.ClampToEdgeWrapping;
  colorTex.wrapT = THREE.ClampToEdgeWrapping;

  const bumpTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 36; i++) {
      const y0 = (i / 36) * h;
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(215,215,215,0.55)' : 'rgba(55,55,55,0.45)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 12) {
        const dy = Math.sin((x / w) * Math.PI * 2.2 + i * 0.35) * 9;
        if (x === 0) ctx.moveTo(x, y0 + dy);
        else ctx.lineTo(x, y0 + dy);
      }
      ctx.stroke();
    }
  });
  bumpTex.wrapS = THREE.ClampToEdgeWrapping;
  bumpTex.wrapT = THREE.ClampToEdgeWrapping;

  return { map: colorTex, bumpMap: bumpTex };
}

function createFinTextures(THREE, kit, pal) {
  const colorTex = kit.canvasTexture(512, 512, (ctx, w, h) => {
    // u (x=0 -> w): root -> delicate translucent outer tip
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0.0, colHex(pal.furAccentDeep));
    grad.addColorStop(0.30, colHex(pal.furAccent));
    grad.addColorStop(0.72, colHex(pal.furAccentLight));
    grad.addColorStop(1.0, colHex(pal.foam));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Iridescent shimmer bands
    for (let i = 0; i < 24; i++) {
      const y = (i / 24) * h;
      const g = ctx.createLinearGradient(0, y, w, y);
      g.addColorStop(0.0, rgbaStr(pal.furAccentDeep, 0.35));
      g.addColorStop(0.5, rgbaStr(pal.foam, 0.25));
      g.addColorStop(1.0, rgbaStr(pal.foam, 0.55));
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.5 + (y - h * 0.5) * 0.35);
      ctx.quadraticCurveTo(w * 0.5, y + Math.sin(i * 0.8) * 10, w, y);
      ctx.stroke();
    }

    // Crisp translucent fin rays
    for (let i = 0; i < 34; i++) {
      const t = i / 33;
      const yStart = h * (0.28 + t * 0.44);
      const yEnd = t * h;
      ctx.strokeStyle = i % 2 === 0 ? rgbaStr(pal.foam, 0.46) : rgbaStr(pal.furAccentDeep, 0.24);
      ctx.lineWidth = i % 3 === 0 ? 2.4 : 1.3;
      ctx.beginPath();
      ctx.moveTo(0, yStart);
      ctx.quadraticCurveTo(w * 0.48, mix(yStart, yEnd, 0.52), w, yEnd);
      ctx.stroke();
    }
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.ClampToEdgeWrapping;
  colorTex.wrapT = THREE.ClampToEdgeWrapping;

  const bumpTex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#7c7c7c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) {
      const t = i / 29;
      const yStart = h * (0.28 + t * 0.44);
      const yEnd = t * h;
      ctx.strokeStyle = 'rgba(235,235,235,0.75)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, yStart);
      ctx.quadraticCurveTo(w * 0.48, mix(yStart, yEnd, 0.52), w, yEnd);
      ctx.stroke();
    }
  });
  bumpTex.wrapS = THREE.ClampToEdgeWrapping;
  bumpTex.wrapT = THREE.ClampToEdgeWrapping;

  return { map: colorTex, bumpMap: bumpTex };
}

function createEyeIrisTexture(THREE, kit, pal) {
  const tex = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const r = w * 0.48;

    const irisDeep = pal.eye.clone().multiplyScalar(0.36);
    const irisBright = pal.eye.clone().lerp(new THREE.Color('#ffffff'), 0.48);

    // Outer dark eye background
    ctx.fillStyle = '#0c121c';
    ctx.fillRect(0, 0, w, h);

    // Iris disc
    const rg = ctx.createRadialGradient(cx, cy + r * 0.14, r * 0.15, cx, cy, r);
    rg.addColorStop(0.0, colHex(irisBright));
    rg.addColorStop(0.55, colHex(pal.eye));
    rg.addColorStop(0.84, colHex(irisDeep));
    rg.addColorStop(1.0, '#0a1019');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Delicate radiating iris fibers
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const n = kit.noise(Math.cos(a) * 3 + 5, Math.sin(a) * 3 + 5);
      ctx.strokeStyle = n > 0.5 ? rgbaStr(irisBright, 0.35) : rgbaStr(irisDeep, 0.35);
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.38, cy + Math.sin(a) * r * 0.38);
      ctx.lineTo(cx + Math.cos(a) * r * 0.88, cy + Math.sin(a) * r * 0.88);
      ctx.stroke();
    }

    // Luminous lower-crescent chibi glow
    const lg = ctx.createRadialGradient(cx, cy + r * 0.42, 2, cx, cy + r * 0.42, r * 0.46);
    lg.addColorStop(0.0, rgbaStr(irisBright, 0.85));
    lg.addColorStop(0.65, rgbaStr(pal.eye, 0.25));
    lg.addColorStop(1.0, rgbaStr(pal.eye, 0.0));
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.36, r * 0.46, 0, Math.PI * 2);
    ctx.fill();

    // Soft upper shadow from brow
    const ug = ctx.createLinearGradient(0, cy - r, 0, cy + r * 0.1);
    ug.addColorStop(0.0, 'rgba(8,12,20,0.72)');
    ug.addColorStop(0.65, 'rgba(8,12,20,0.18)');
    ug.addColorStop(1.0, 'rgba(8,12,20,0.0)');
    ctx.fillStyle = ug;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Deep glossy pupil
    ctx.fillStyle = '#070a10';
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.02, r * 0.42, r * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBlushTexture(THREE, kit, pal) {
  const tex = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const rg = ctx.createRadialGradient(w * 0.5, h * 0.5, 2, w * 0.5, h * 0.5, w * 0.48);
    rg.addColorStop(0.0, rgbaStr(pal.blush, 0.58));
    rg.addColorStop(0.55, rgbaStr(pal.blush, 0.24));
    rg.addColorStop(1.0, rgbaStr(pal.blush, 0.0));
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// Geometry Helpers
// ---------------------------------------------------------------------------

function createTaperedTube(THREE, points, radiusFn, tubularSegs, radialSegs, opts) {
  const o = opts || {};
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
  const aspectFn = o.aspectFn || (() => ({ sx: 1, sy: 1 }));
  const capStart = o.capStart ?? true;
  const capEnd = o.capEnd ?? true;

  const framesT = [];
  const framesN = [];
  const framesB = [];

  const t0 = curve.getTangent(0).normalize();
  let ref = o.upRef ? o.upRef.clone().normalize() : new THREE.Vector3(0, 1, 0);
  if (Math.abs(t0.dot(ref)) > 0.92) {
    ref = new THREE.Vector3(1, 0, 0);
  }
  const n0 = new THREE.Vector3().crossVectors(ref, t0).normalize();
  const b0 = new THREE.Vector3().crossVectors(t0, n0).normalize();

  framesT.push(t0);
  framesN.push(n0);
  framesB.push(b0);

  const q = new THREE.Quaternion();
  for (let i = 1; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    const ti = curve.getTangent(u).normalize();
    q.setFromUnitVectors(framesT[i - 1], ti);
    const ni = framesN[i - 1].clone().applyQuaternion(q);
    ni.addScaledVector(ti, -ni.dot(ti)).normalize();
    const bi = new THREE.Vector3().crossVectors(ti, ni).normalize();
    framesT.push(ti);
    framesN.push(ni);
    framesB.push(bi);
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const stride = radialSegs + 1;

  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs;
    const c = curve.getPoint(u);
    const r = Math.max(0.0005, radiusFn(u));
    const asp = aspectFn(u);
    const N = framesN[i];
    const B = framesB[i];

    for (let j = 0; j <= radialSegs; j++) {
      const v = j / radialSegs;
      const theta = v * Math.PI * 2;
      const ct = Math.cos(theta) * r * asp.sx;
      const st = Math.sin(theta) * r * asp.sy;
      positions.push(
        c.x + N.x * ct + B.x * st,
        c.y + N.y * ct + B.y * st,
        c.z + N.z * ct + B.z * st
      );
      uvs.push(v, 1.0 - u);
    }
  }

  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const b = i * stride + j + 1;
      const c = (i + 1) * stride + j + 1;
      const d = (i + 1) * stride + j;
      indices.push(a, b, c, a, c, d);
    }
  }

  if (capStart) {
    const c0 = curve.getPoint(0);
    const r0 = radiusFn(0);
    const tip = c0.clone().addScaledVector(framesT[0], -r0 * 0.45);
    const centerIdx = positions.length / 3;
    positions.push(tip.x, tip.y, tip.z);
    uvs.push(0.5, 1.0);
    for (let j = 0; j < radialSegs; j++) {
      indices.push(centerIdx, j + 1, j);
    }
  }

  if (capEnd) {
    const c1 = curve.getPoint(1);
    const r1 = radiusFn(1);
    const tip = c1.clone().addScaledVector(framesT[tubularSegs], r1 * 0.45);
    const centerIdx = positions.length / 3;
    positions.push(tip.x, tip.y, tip.z);
    uvs.push(0.5, 0.0);
    const base = tubularSegs * stride;
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

// Continuous sculpted foal torso (chest, withers, back dip, soft belly, rump/tail transition)
function createSculptedBody(THREE) {
  const geo = new THREE.SphereGeometry(1, 64, 44);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    let x = nx * 0.072;
    let y = ny * 0.068;
    let z = nz * 0.146;

    // Gentle saddle dip in mid-back
    const backDip = Math.exp(-Math.pow((nz + 0.05) / 0.34, 2)) * smoothstep(0.15, 0.9, ny);
    y -= 0.011 * backDip;

    // Subtle withers rise behind the neck junction
    const withers = Math.exp(-Math.pow((nz - 0.44) / 0.28, 2)) * smoothstep(0.2, 0.95, ny);
    y += 0.014 * withers;

    // Broad cozy foal chest/brisket in front
    const chest = smoothstep(0.25, 0.95, nz);
    x *= 1.0 + 0.08 * chest * (1.0 - Math.abs(ny) * 0.5);
    y -= 0.008 * chest * smoothstep(0.1, -0.8, ny);
    z += 0.008 * chest * Math.exp(-Math.pow((ny + 0.15) / 0.55, 2));

    // Rounded plump croup/haunches tapering gracefully into the tail dock
    const rump = smoothstep(-0.15, -0.72, nz) * (1.0 - smoothstep(-0.72, -1.0, nz) * 0.55);
    x *= 1.0 + 0.11 * rump * Math.exp(-Math.pow((ny + 0.05) / 0.65, 2));
    y += 0.010 * Math.exp(-Math.pow((nz + 0.56) / 0.30, 2)) * smoothstep(0.1, 0.9, ny);

    // Taper smoothly toward the tail dock at very back (-z)
    const tailPinch = smoothstep(-0.68, -1.0, nz);
    x *= 1.0 - 0.32 * tailPinch;
    y = mix(y, y * 0.66 + 0.018, tailPinch);

    // Slight waist narrowing & soft flank tuck-up underneath
    const waist = Math.exp(-Math.pow((nz + 0.14) / 0.34, 2));
    x *= 1.0 - 0.06 * waist;
    const flankTuck = Math.exp(-Math.pow((nz + 0.38) / 0.28, 2)) * smoothstep(-0.1, -0.95, ny);
    y += 0.012 * flankTuck;

    // Softly flattened underside belly
    if (ny < -0.55) {
      const flat = smoothstep(-0.55, -1.0, ny);
      y += 0.007 * flat;
    }

    // Subtle shoulder swell for seamless front-leg blend
    const shoulder = Math.exp(-Math.pow((nz - 0.56) / 0.24, 2)) * Math.exp(-Math.pow((ny + 0.15) / 0.45, 2));
    x *= 1.0 + 0.06 * shoulder;

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

// Parametric sculpting function shared between head mesh and surface-attached facial features
function sculptHeadPoint(nx, ny, nz, out) {
  const muzzleMask = smoothstep(0.36, 0.96, nz) * smoothstep(0.62, -0.08, ny);
  const muzzleForward = smoothstep(0.42, 0.98, nz) * smoothstep(0.58, -0.15, ny);

  const taperX = 1.0 - 0.52 * Math.pow(muzzleMask, 0.88)
    + 0.055 * Math.exp(-Math.pow((muzzleMask - 0.88) / 0.16, 2));
  const taperY = 1.0 - 0.48 * Math.pow(muzzleMask, 0.88)
    + 0.045 * Math.exp(-Math.pow((muzzleMask - 0.88) / 0.16, 2));

  let x = nx * 0.066 * taperX;
  let y = ny * 0.064 * taperY;
  let z = nz * 0.068;

  // Plush chibi cranium dome
  const crown = smoothstep(0.25, 0.95, ny) * smoothstep(0.65, -0.4, nz);
  y += 0.006 * crown;

  // Gentle narrowing at back of poll
  const backPoll = smoothstep(-0.25, -1.0, nz);
  x *= 1.0 - 0.10 * backPoll;

  // Cute rounded equine cheeks / jowl
  const cheek = Math.exp(-Math.pow((ny + 0.20) / 0.36, 2))
    * Math.exp(-Math.pow((nz - 0.06) / 0.40, 2));
  x *= 1.0 + 0.15 * cheek;
  y -= 0.005 * cheek;

  // Smooth continuous muzzle extrusion forward & slightly down
  z += 0.066 * Math.pow(muzzleForward, 1.05);
  y -= 0.028 * Math.pow(muzzleMask, 1.06);

  // Sweet dished foal bridge of the nose
  const bridgeDish = Math.exp(-Math.pow((muzzleMask - 0.52) / 0.24, 2))
    * smoothstep(0.02, 0.52, ny);
  y -= 0.006 * bridgeDish;

  // Softly rounded nose plane (avoid pointy tip)
  const noseTip = smoothstep(0.91, 1.0, nz) * smoothstep(0.35, -0.35, ny);
  z -= 0.007 * noseTip;

  // Soft chin pad beneath muzzle
  const chin = smoothstep(0.68, 0.96, nz) * smoothstep(-0.18, -0.68, ny);
  y -= 0.003 * chin;
  z -= 0.004 * chin;

  // Sculpted eye socket concavities so eyes sit slightly inset
  const anx = Math.abs(nx);
  const dEye = Math.hypot(anx - 0.74, ny - 0.14, nz - 0.66);
  const eyeSocket = Math.exp(-Math.pow(dEye / 0.20, 2));
  x -= Math.sign(nx || 1) * 0.0055 * eyeSocket;
  y -= 0.0010 * eyeSocket;
  z -= 0.0045 * eyeSocket;

  // Soft expressive brow arch above each eye
  const dBrow = Math.hypot(anx - 0.56, ny - 0.42, nz - 0.71);
  const brow = Math.exp(-Math.pow(dBrow / 0.21, 2));
  x += Math.sign(nx || 1) * 0.0022 * brow;
  y += 0.0032 * brow;
  z += 0.0028 * brow;

  // Flared velvety nostril wings & recessed teardrop hollows
  const dNos = Math.hypot(anx - 0.28, ny + 0.02, nz - 0.96);
  const nosFlare = Math.exp(-Math.pow((dNos - 0.10) / 0.055, 2));
  const nosHollow = Math.exp(-Math.pow(dNos / 0.058, 2));
  x += Math.sign(nx || 1) * (0.0028 * nosFlare - 0.0032 * nosHollow);
  y += 0.0014 * nosFlare - 0.0012 * nosHollow;
  z += 0.0018 * nosFlare - 0.0048 * nosHollow;

  // Clean throatlatch tuck underneath for seamless neck merge
  const throat = smoothstep(-0.35, -0.95, ny) * smoothstep(0.35, -0.35, nz);
  y += 0.006 * throat;

  out.set(x, y, z);
  return out;
}

function getHeadSurfaceFrame(THREE, nx, ny, nz) {
  const len = Math.hypot(nx, ny, nz) || 1;
  const u = new THREE.Vector3(nx / len, ny / len, nz / len);
  const p = sculptHeadPoint(u.x, u.y, u.z, new THREE.Vector3());

  const upRef = Math.abs(u.y) < 0.92 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const t1 = new THREE.Vector3().crossVectors(upRef, u).normalize();
  const t2 = new THREE.Vector3().crossVectors(u, t1).normalize();

  const eps = 0.015;
  const u1 = u.clone().addScaledVector(t1, eps).normalize();
  const u2 = u.clone().addScaledVector(t2, eps).normalize();
  const p1 = sculptHeadPoint(u1.x, u1.y, u1.z, new THREE.Vector3());
  const p2 = sculptHeadPoint(u2.x, u2.y, u2.z, new THREE.Vector3());

  const d1 = p1.sub(p);
  const d2 = p2.sub(p);
  const normal = new THREE.Vector3().crossVectors(d1, d2).normalize();
  if (normal.dot(u) < 0) normal.negate();

  return { position: p, normal };
}

function createSculptedHead(THREE) {
  const geo = new THREE.SphereGeometry(1, 64, 48);
  const pos = geo.attributes.position;
  const tmp = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    sculptHeadPoint(pos.getX(i), pos.getY(i), pos.getZ(i), tmp);
    pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
  }

  geo.computeVertexNormals();
  return geo;
}

// Rotational stylized equine hoof via LatheGeometry (20 profile points)
function createHoofGeometry(THREE) {
  const pts = [];
  const profile = [
    [0.000, 0.0005],
    [0.008, 0.0008],
    [0.015, 0.0002],
    [0.0205, 0.0000],
    [0.0225, 0.0012],
    [0.0230, 0.0038],
    [0.0226, 0.0072],
    [0.0218, 0.0108],
    [0.0208, 0.0145],
    [0.0196, 0.0182],
    [0.0185, 0.0216],
    [0.0176, 0.0246],
    [0.0172, 0.0268],
    [0.0175, 0.0285],
    [0.0168, 0.0302],
    [0.0152, 0.0315],
    [0.0130, 0.0322],
    [0.0096, 0.0325],
    [0.0052, 0.0326],
    [0.000, 0.0326]
  ];
  for (const [r, y] of profile) {
    pts.push(new THREE.Vector2(r, y));
  }

  const geo = new THREE.LatheGeometry(pts, 24);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);
    // Slightly elongate toe (+z) and narrow heel (-z) for equine hoof silhouette
    if (z > 0) {
      z *= 1.16;
    } else {
      z *= 0.90;
    }
    x *= 0.94;
    // Slight forward slope along front hoof wall
    z += (0.032 - y) * 0.14;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Expressive cupped kelpie ear (ExtrudeGeometry + bezierCurveTo + bevel + 3D cupping bend)
function createEarGeometries(THREE, side) {
  function buildCuppedShape(scale, thickness, zOffset) {
    const s = new THREE.Shape();
    s.moveTo(-0.016 * scale, 0.0);
    // Inner edge rising smoothly to alert horse ear tip
    s.bezierCurveTo(
      -0.024 * scale, 0.020 * scale,
      -0.016 * scale, 0.050 * scale,
      0.002 * scale, 0.068 * scale
    );
    // Outer edge with delicate aquatic fin-scallop contour
    s.bezierCurveTo(
      0.018 * scale, 0.052 * scale,
      0.026 * scale, 0.034 * scale,
      0.022 * scale, 0.022 * scale
    );
    s.bezierCurveTo(
      0.027 * scale, 0.015 * scale,
      0.022 * scale, 0.004 * scale,
      0.014 * scale, 0.0
    );
    s.bezierCurveTo(
      0.005 * scale, -0.004 * scale,
      -0.008 * scale, -0.004 * scale,
      -0.016 * scale, 0.0
    );

    const geo = new THREE.ExtrudeGeometry(s, {
      steps: 2,
      depth: thickness,
      bevelEnabled: true,
      bevelThickness: thickness * 0.45,
      bevelSize: 0.0022 * scale,
      bevelSegments: 3,
      curveSegments: 18
    });

    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const w = Math.max(0.0001, bb.max.x - bb.min.x);
    const h = Math.max(0.0001, bb.max.y - bb.min.y);
    const cz = (bb.min.z + bb.max.z) * 0.5;

    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i) - cz;

      const u = (x - bb.min.x) / w;
      const v = (y - bb.min.y) / h;
      uv.setXY(i, u, v);

      // Mirror cleanly for left/right ear
      x *= side;

      // Cup around vertical axis (concave forward toward +z)
      const xn = (u - 0.5) * 2.0;
      const cup = (xn * xn) * 0.011 * (1.0 - v * 0.45);
      // Gentle forward hook toward tip
      const forwardCurve = Math.pow(v, 1.8) * 0.010;
      // Taper thickness smoothly toward the tip
      z *= mix(1.0, 0.42, v);

      pos.setXYZ(i, x, y, z + cup + forwardCurve + zOffset);
    }
    geo.computeVertexNormals();
    return geo;
  }

  return {
    outer: buildCuppedShape(1.0, 0.0048, 0.0),
    inner: buildCuppedShape(0.68, 0.0020, 0.0036)
  };
}

// Breaking-wave mane lock: curled bezier ribbon with bevel + 3D barrel-wave curl
function createWaveLockGeometry(THREE, cfg) {
  const len = cfg.len ?? 0.095;
  const hgt = cfg.height ?? 0.056;
  const thick = cfg.thick ?? 0.0075;
  const curlSide = cfg.curlSide ?? 1;
  const curlAmt = cfg.curlAmt ?? 0.022;
  const twist = cfg.twist ?? 0.012;

  const s = new THREE.Shape();
  // Start at rear root of the wave
  s.moveTo(-len * 0.34, 0.0);
  // Sweeping rising back of the wave arching up and over into a curling breaking hook
  s.bezierCurveTo(
    -len * 0.28, hgt * 0.72,
    len * 0.04, hgt * 1.18,
    len * 0.56, hgt * 0.96
  );
  // Curling wave lip hooking forward & down
  s.bezierCurveTo(
    len * 0.84, hgt * 0.84,
    len * 0.96, hgt * 0.46,
    len * 0.72, hgt * 0.34
  );
  // Inner hollow barrel curl returning under the lip
  s.bezierCurveTo(
    len * 0.56, hgt * 0.32,
    len * 0.58, hgt * 0.58,
    len * 0.38, hgt * 0.62
  );
  // Secondary frothy wave sub-curl along the hollow
  s.bezierCurveTo(
    len * 0.16, hgt * 0.64,
    len * 0.12, hgt * 0.34,
    len * 0.30, hgt * 0.22
  );
  // Sweeping gracefully down to front root
  s.bezierCurveTo(
    len * 0.16, hgt * 0.14,
    len * 0.04, hgt * 0.06,
    len * 0.14, 0.0
  );
  s.bezierCurveTo(
    0.0, -hgt * 0.06,
    -len * 0.20, -hgt * 0.06,
    -len * 0.34, 0.0
  );

  const geo = new THREE.ExtrudeGeometry(s, {
    steps: 2,
    depth: thick,
    bevelEnabled: true,
    bevelThickness: thick * 0.45,
    bevelSize: thick * 0.38,
    bevelSegments: 3,
    curveSegments: 20
  });

  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const bw = Math.max(0.0001, bb.max.x - bb.min.x);
  const bh = Math.max(0.0001, bb.max.y - bb.min.y);
  const cz = (bb.min.z + bb.max.z) * 0.5;

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i) - cz;

    const u = clamp((x - bb.min.x) / bw, 0, 1);
    const v = clamp((y - bb.min.y) / bh, 0, 1);

    // Map seafoam crest toward upper arch and curling hook tip
    const foamV = clamp(v * 0.78 + smoothstep(0.50, 1.0, u) * 0.42, 0, 1);
    uv.setXY(i, u, foamV);

    // Taper thickness smoothly toward breaking crest & hook tip
    z *= mix(1.15, 0.36, foamV);

    // 3D barrel-wave lateral arch & gentle spiral curl
    const arch = Math.pow(v, 1.45) * curlAmt * curlSide
      + Math.sin(u * Math.PI) * twist * curlSide * v;
    const tipWhip = Math.pow(smoothstep(0.55, 1.0, u), 1.6) * curlAmt * 0.55 * curlSide;

    pos.setXYZ(i, x, y, z + arch + tipWhip);
  }

  geo.computeVertexNormals();
  return geo;
}

// Translucent scalloped fish fin (ExtrudeGeometry + bezierCurveTo + bevel + S-wave & fin-ray relief)
function createFishFinGeometry(THREE, cfg) {
  const len = cfg.len ?? 0.14;
  const span = cfg.span ?? 0.085;
  const thick = cfg.thick ?? 0.0026;
  const waveAmp = cfg.waveAmp ?? 0.016;
  const wavePhase = cfg.wavePhase ?? 0.0;
  const sweepY = cfg.sweepY ?? 0.025;

  const s = new THREE.Shape();
  s.moveTo(0.0, -span * 0.14);
  // Sweeping leading spine of the fin
  s.bezierCurveTo(
    len * 0.35, -span * 0.24 + sweepY * 0.2,
    len * 0.76, -span * 0.16 + sweepY * 0.8,
    len * 1.02, sweepY
  );
  // Flowing scalloped trailing edge (betta / veiltail silhouette)
  s.bezierCurveTo(
    len * 0.94, span * 0.22 + sweepY * 0.65,
    len * 0.80, span * 0.20 + sweepY * 0.45,
    len * 0.86, span * 0.40 + sweepY * 0.35
  );
  s.bezierCurveTo(
    len * 0.72, span * 0.56 + sweepY * 0.2,
    len * 0.54, span * 0.48,
    len * 0.50, span * 0.62
  );
  s.bezierCurveTo(
    len * 0.30, span * 0.66,
    len * 0.14, span * 0.36,
    0.0, span * 0.14
  );
  s.lineTo(0.0, -span * 0.14);

  const geo = new THREE.ExtrudeGeometry(s, {
    steps: 1,
    depth: thick,
    bevelEnabled: true,
    bevelThickness: thick * 0.45,
    bevelSize: 0.0014,
    bevelSegments: 2,
    curveSegments: 20
  });

  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const bw = Math.max(0.0001, bb.max.x - bb.min.x);
  const bh = Math.max(0.0001, bb.max.y - bb.min.y);
  const cz = (bb.min.z + bb.max.z) * 0.5;

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i) - cz;

    const u = clamp((x - bb.min.x) / bw, 0, 1);
    const v = clamp((y - bb.min.y) / bh, 0, 1);
    uv.setXY(i, u, v);

    // Taper delicate translucent edge
    z *= mix(1.15, 0.28, Math.pow(u, 0.85));

    // Flowing underwater S-wave undulation
    const swave = Math.sin(u * Math.PI * 1.65 + v * 2.1 + wavePhase) * waveAmp * Math.pow(u, 1.15);
    // Subtle fluted fin-ray relief
    const rays = Math.sin(v * Math.PI * 16.0) * 0.0012 * u * (1.0 - u * 0.25);

    pos.setXYZ(i, x, y, z + swave + rays);
  }

  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Main Builder
// ---------------------------------------------------------------------------

export function build(THREE, opts, kit) {
  const pal = resolvePalette(THREE, opts);
  const root = new THREE.Group();
  root.name = 'kelpieFoal';

  // Procedural painted textures
  const bodyTex = createBodyTextures(THREE, kit, pal);
  const headMap = createHeadTexture(THREE, kit, pal);
  const waveTex = createWaveManeTextures(THREE, kit, pal);
  const finTex = createFinTextures(THREE, kit, pal);
  const irisMap = createEyeIrisTexture(THREE, kit, pal);
  const blushMap = createBlushTexture(THREE, kit, pal);

  // Materials (MeshPhysicalMaterial with wet clearcoat sheen)
  const wetCoatMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: bodyTex.map,
    bumpMap: bodyTex.bumpMap,
    bumpScale: 0.0022,
    roughness: 0.42,
    metalness: 0.02,
    sheen: 0.68,
    sheenRoughness: 0.55,
    sheenColor: pal.sheen,
    clearcoat: 0.88,
    clearcoatRoughness: 0.11,
    iridescence: 0.22,
    iridescenceIOR: 1.33
  });

  const headCoatMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: headMap,
    bumpMap: bodyTex.bumpMap,
    bumpScale: 0.0014,
    roughness: 0.44,
    metalness: 0.02,
    sheen: 0.72,
    sheenRoughness: 0.58,
    sheenColor: pal.sheen,
    clearcoat: 0.82,
    clearcoatRoughness: 0.13,
    iridescence: 0.18,
    iridescenceIOR: 1.33
  });

  const innerEarMat = new THREE.MeshPhysicalMaterial({
    color: pal.innerEar,
    roughness: 0.86,
    metalness: 0.0,
    sheen: 0.75,
    sheenColor: pal.foam,
    clearcoat: 0.25,
    clearcoatRoughness: 0.35
  });

  const waveManeMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: waveTex.map,
    bumpMap: waveTex.bumpMap,
    bumpScale: 0.0032,
    roughness: 0.18,
    metalness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    sheen: 0.55,
    sheenColor: pal.foam,
    iridescence: 0.45,
    iridescenceIOR: 1.34,
    transparent: true,
    opacity: 0.93
  });

  const translucentFinMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: finTex.map,
    bumpMap: finTex.bumpMap,
    bumpScale: 0.0026,
    roughness: 0.14,
    metalness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.07,
    iridescence: 0.75,
    iridescenceIOR: 1.36,
    emissive: pal.furAccent,
    emissiveIntensity: 0.22,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const hoofMat = new THREE.MeshPhysicalMaterial({
    color: pal.hoof,
    roughness: 0.22,
    metalness: 0.06,
    clearcoat: 0.92,
    clearcoatRoughness: 0.10,
    iridescence: 0.35,
    iridescenceIOR: 1.4
  });

  const eyeBaseMat = new THREE.MeshPhysicalMaterial({
    color: 0x0c1320,
    roughness: 0.04,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02
  });

  const eyeIrisMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: irisMap,
    roughness: 0.06,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    emissive: pal.eye,
    emissiveIntensity: 0.28
  });

  const highlightMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.85,
    roughness: 0.05,
    clearcoat: 1.0
  });

  const darkAccentMat = new THREE.MeshPhysicalMaterial({
    color: pal.furDark.clone().multiplyScalar(0.55),
    roughness: 0.35,
    clearcoat: 0.65
  });

  const blushMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: blushMap,
    transparent: true,
    opacity: 0.75,
    roughness: 0.78,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1
  });

  const seaPearlMat = new THREE.MeshPhysicalMaterial({
    color: pal.foam,
    emissive: pal.glow,
    emissiveIntensity: 1.45,
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04
  });

  function tagMesh(mesh, slot) {
    mesh.userData.slot = slot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // -------------------------------------------------------------------------
  // 1. BODY & ARCHED NECK & BREAKING-WAVE MANE
  // -------------------------------------------------------------------------
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'body';
  bodyGroup.position.set(0, 0.256, -0.015);
  root.add(bodyGroup);

  const bodyMesh = tagMesh(new THREE.Mesh(createSculptedBody(THREE), wetCoatMat), 'fur');
  bodyGroup.add(bodyMesh);

  // Sculpted tapered curved neck overlapping deeply into both chest/withers and head
  const neckPoints = [
    new THREE.Vector3(0, 0.008, 0.058),
    new THREE.Vector3(0, 0.052, 0.104),
    new THREE.Vector3(0, 0.102, 0.130),
    new THREE.Vector3(0, 0.148, 0.141)
  ];
  const neckGeo = createTaperedTube(
    THREE,
    neckPoints,
    (u) => mix(0.054, 0.035, Math.pow(u, 0.82)),
    26,
    24,
    {
      upRef: new THREE.Vector3(1, 0, 0),
      aspectFn: (u) => ({ sx: mix(1.14, 1.04, u), sy: mix(0.84, 0.92, u) }),
      capStart: true,
      capEnd: true
    }
  );
  const neckMesh = tagMesh(new THREE.Mesh(neckGeo, wetCoatMat), 'fur');
  bodyGroup.add(neckMesh);

  // Breaking-wave mane ribbons cascading along the neck crest
  const neckManeSpecs = [
    { pos: [0.002, 0.138, 0.104], rot: [0.22, -Math.PI * 0.5 + 0.16, 0.14], len: 0.108, height: 0.062, thick: 0.0072, curlSide: 1, curlAmt: 0.026, twist: 0.012 },
    { pos: [-0.006, 0.114, 0.088], rot: [0.34, -Math.PI * 0.5 - 0.18, -0.16], len: 0.100, height: 0.056, thick: 0.0068, curlSide: -1, curlAmt: 0.024, twist: 0.010 },
    { pos: [0.008, 0.086, 0.068], rot: [0.50, -Math.PI * 0.5 + 0.22, 0.18], len: 0.094, height: 0.052, thick: 0.0065, curlSide: 1, curlAmt: 0.022, twist: 0.010 },
    { pos: [-0.008, 0.066, 0.052], rot: [0.64, -Math.PI * 0.5 - 0.24, -0.15], len: 0.082, height: 0.044, thick: 0.0058, curlSide: -1, curlAmt: 0.018, twist: 0.009 },
    { pos: [0.012, 0.048, 0.036], rot: [0.76, -Math.PI * 0.5 + 0.28, 0.22], len: 0.072, height: 0.038, thick: 0.0052, curlSide: 1, curlAmt: 0.016, twist: 0.008 },
    { pos: [-0.002, 0.038, 0.016], rot: [0.88, -Math.PI * 0.5 - 0.10, -0.06], len: 0.064, height: 0.032, thick: 0.0048, curlSide: -1, curlAmt: 0.013, twist: 0.006 }
  ];

  for (const spec of neckManeSpecs) {
    const waveGeo = createWaveLockGeometry(THREE, spec);
    const waveMesh = tagMesh(new THREE.Mesh(waveGeo, waveManeMat), 'furAccent');
    waveMesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    waveMesh.rotation.set(spec.rot[0], spec.rot[1], spec.rot[2]);
    bodyGroup.add(waveMesh);
  }

  // Luminous sea-foam water droplets nestled along the breaking wave crests
  const pearlGeo = new THREE.SphereGeometry(1, 12, 10);
  const neckPearls = [
    [0.026, 0.194, 0.088, 0.0048],
    [-0.028, 0.168, 0.056, 0.0040],
    [0.034, 0.138, 0.044, 0.0038],
    [-0.026, 0.105, 0.024, 0.0034],
    [0.030, 0.082, 0.010, 0.0030],
    [0.014, 0.178, 0.050, 0.0028]
  ];
  for (const [px, py, pz, pr] of neckPearls) {
    const pm = tagMesh(new THREE.Mesh(pearlGeo, seaPearlMat), 'glow');
    pm.position.set(px, py, pz);
    pm.scale.set(pr, pr * 1.18, pr);
    bodyGroup.add(pm);
  }

  // -------------------------------------------------------------------------
  // 2. HEAD, FACE, EARS & BREAKING-WAVE FORELOCK
  // -------------------------------------------------------------------------
  const headGroup = new THREE.Group();
  headGroup.name = 'head';
  headGroup.position.set(0, 0.396, 0.124);
  headGroup.rotation.set(0.16, 0.16, -0.09);
  root.add(headGroup);

  const headCenterOffset = new THREE.Vector3(0, 0.012, 0.008);
  const headCore = new THREE.Group();
  headCore.position.copy(headCenterOffset);
  headGroup.add(headCore);

  const headMesh = tagMesh(new THREE.Mesh(createSculptedHead(THREE), headCoatMat), 'fur');
  headCore.add(headMesh);

  // Three-layer expressive chibi eyes + upper eyelash rim
  const eyeBaseGeo = new THREE.SphereGeometry(0.0185, 24, 18);
  const irisGeo = new THREE.SphereGeometry(0.0189, 26, 18, 0, Math.PI * 2, 0, 0.72);
  irisGeo.rotateX(Math.PI * 0.5);
  const hiMainGeo = new THREE.SphereGeometry(0.0043, 14, 10);
  const hiSubGeo = new THREE.SphereGeometry(0.0020, 12, 8);

  const lashPoints = [
    new THREE.Vector3(-0.0175, 0.004, 0.0045),
    new THREE.Vector3(-0.010, 0.0165, 0.0085),
    new THREE.Vector3(0.002, 0.0202, 0.0096),
    new THREE.Vector3(0.0145, 0.0150, 0.0082),
    new THREE.Vector3(0.0215, 0.0085, 0.0040)
  ];
  const lashGeo = createTaperedTube(
    THREE,
    lashPoints,
    (u) => 0.0018 * Math.sin(u * Math.PI * 0.85 + 0.15) + 0.0005,
    14,
    8,
    { capStart: true, capEnd: true }
  );

  for (const side of [-1, 1]) {
    const eyeGroup = new THREE.Group();
    eyeGroup.name = side < 0 ? 'eyeL' : 'eyeR';

    const surf = getHeadSurfaceFrame(THREE, side * 0.74, 0.14, 0.66);
    const zAxis = surf.normal.clone();
    // Keep eye local +Y aligned upward, +X horizontal tangent
    const xAxis = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), zAxis).normalize();
    const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
    const rotMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

    // Inset slightly into the sculpted eye socket so it never floats
    eyeGroup.position.copy(surf.position).addScaledVector(zAxis, -0.0018);
    eyeGroup.quaternion.setFromRotationMatrix(rotMat);

    // Layer 1: Dark glossy eye base with clearcoat
    const sclera = tagMesh(new THREE.Mesh(eyeBaseGeo, eyeBaseMat), 'accent');
    sclera.scale.set(0.96, 1.10, 0.56);
    sclera.castShadow = false;
    eyeGroup.add(sclera);

    // Layer 2: Coloured luminous iris ring
    const iris = tagMesh(new THREE.Mesh(irisGeo, eyeIrisMat), 'eye');
    iris.scale.set(0.96, 1.10, 0.56);
    iris.castShadow = false;
    eyeGroup.add(iris);

    // Layer 3: Two crisp white specular highlight dots (consistent light direction up & right)
    const hlShiftX = side < 0 ? 0.0050 : 0.0046;
    const hi1 = tagMesh(new THREE.Mesh(hiMainGeo, highlightMat), 'glow');
    hi1.position.set(hlShiftX, 0.0074, 0.0102);
    hi1.scale.set(1.0, 1.0, 0.45);
    hi1.castShadow = false;
    eyeGroup.add(hi1);

    const hi2 = tagMesh(new THREE.Mesh(hiSubGeo, highlightMat), 'glow');
    hi2.position.set(-hlShiftX * 0.92, -0.0062, 0.0098);
    hi2.scale.set(1.0, 1.0, 0.45);
    hi2.castShadow = false;
    eyeGroup.add(hi2);

    // Cute curved upper eyelash rim
    const lash = tagMesh(new THREE.Mesh(lashGeo, darkAccentMat), 'accent');
    if (side > 0) lash.scale.x = -1;
    lash.castShadow = false;
    eyeGroup.add(lash);

    headCore.add(eyeGroup);
  }

  // Subtle blush discs conforming neatly to each cheek below the eye
  const blushGeo = new THREE.CircleGeometry(0.0165, 20);
  for (const side of [-1, 1]) {
    const surf = getHeadSurfaceFrame(THREE, side * 0.72, -0.14, 0.68);
    const zAxis = surf.normal.clone();
    const xAxis = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), zAxis).normalize();
    const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
    const rotMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

    const blush = tagMesh(new THREE.Mesh(blushGeo, blushMat), 'skin');
    blush.position.copy(surf.position).addScaledVector(zAxis, 0.0008);
    blush.quaternion.setFromRotationMatrix(rotMat);
    blush.scale.set(1.18, 0.76, 1.0);
    blush.castShadow = false;
    headCore.add(blush);
  }

  // Gentle curved smile mouth line made from a thin tapered tube hugging the lower muzzle
  const mouthPts = [];
  const mouthDirs = [
    [-0.28, -0.22, 0.93],
    [-0.14, -0.28, 0.95],
    [0.0, -0.25, 0.97],
    [0.14, -0.28, 0.95],
    [0.28, -0.22, 0.93]
  ];
  for (const [mx, my, mz] of mouthDirs) {
    const s = getHeadSurfaceFrame(THREE, mx, my, mz);
    mouthPts.push(s.position.addScaledVector(s.normal, 0.0004));
  }
  const mouthGeo = createTaperedTube(
    THREE,
    mouthPts,
    (u) => 0.0014 * Math.sin(u * Math.PI) + 0.0005,
    18,
    8,
    { capStart: true, capEnd: true }
  );
  const mouthMesh = tagMesh(new THREE.Mesh(mouthGeo, darkAccentMat), 'accent');
  mouthMesh.castShadow = false;
  headCore.add(mouthMesh);

  // Expressive cupped kelpie ears with soft inner-ear colour
  for (const side of [-1, 1]) {
    const earGroup = new THREE.Group();
    earGroup.name = side < 0 ? 'earL' : 'earR';
    earGroup.position.set(side * 0.036, 0.052, -0.012);
    // Slight playful asymmetry: left ear perked slightly higher, right tilted inquisitively
    earGroup.rotation.set(
      side < 0 ? 0.14 : 0.22,
      side * 0.34,
      side < 0 ? 0.36 : -0.48
    );

    const geos = createEarGeometries(THREE, side);
    const outerEar = tagMesh(new THREE.Mesh(geos.outer, wetCoatMat), 'fur');
    const innerEar = tagMesh(new THREE.Mesh(geos.inner, innerEarMat), 'skin');
    innerEar.position.set(0, 0.006, 0);
    innerEar.castShadow = false;

    earGroup.add(outerEar);
    earGroup.add(innerEar);
    headCore.add(earGroup);
  }

  // Breaking-wave forelock curling playfully across the forehead between the ears
  const forelock1 = tagMesh(
    new THREE.Mesh(
      createWaveLockGeometry(THREE, {
        len: 0.082,
        height: 0.048,
        thick: 0.0064,
        curlSide: 1,
        curlAmt: 0.022,
        twist: 0.010
      }),
      waveManeMat
    ),
    'furAccent'
  );
  forelock1.position.set(-0.004, 0.056, 0.018);
  forelock1.rotation.set(0.28, -Math.PI * 0.5 + 0.42, 0.22);
  headCore.add(forelock1);

  const forelock2 = tagMesh(
    new THREE.Mesh(
      createWaveLockGeometry(THREE, {
        len: 0.062,
        height: 0.036,
        thick: 0.0052,
        curlSide: -1,
        curlAmt: 0.016,
        twist: 0.008
      }),
      waveManeMat
    ),
    'furAccent'
  );
  forelock2.position.set(0.012, 0.052, 0.010);
  forelock2.rotation.set(0.18, -Math.PI * 0.5 - 0.38, -0.26);
  headCore.add(forelock2);

  // Two tiny glistening droplets near the forelock wave crest
  const fPearl1 = tagMesh(new THREE.Mesh(pearlGeo, seaPearlMat), 'glow');
  fPearl1.position.set(0.018, 0.088, 0.066);
  fPearl1.scale.set(0.0038, 0.0044, 0.0038);
  headCore.add(fPearl1);

  const fPearl2 = tagMesh(new THREE.Mesh(pearlGeo, seaPearlMat), 'glow');
  fPearl2.position.set(-0.014, 0.094, 0.042);
  fPearl2.scale.set(0.0028, 0.0032, 0.0028);
  headCore.add(fPearl2);

  // -------------------------------------------------------------------------
  // 3. FOUR TAPERED LIMBS, HOOVES & FIN-LIKE FETLOCKS
  // -------------------------------------------------------------------------
  const sharedHoofGeo = createHoofGeometry(THREE);
  const sharedFetlockFinGeo = createFishFinGeometry(THREE, {
    len: 0.054,
    span: 0.040,
    thick: 0.0018,
    waveAmp: 0.006,
    wavePhase: 0.4,
    sweepY: -0.008
  });

  function buildLeg(cfg) {
    const legGroup = new THREE.Group();
    legGroup.name = cfg.name;
    legGroup.position.set(cfg.pivot[0], cfg.pivot[1], cfg.pivot[2]);

    const pts = cfg.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    const legGeo = createTaperedTube(
      THREE,
      pts,
      (u) => {
        // Organic equine leg taper: full upper shoulder/thigh -> slender cannon -> gentle fetlock swell -> trim pastern
        const base = mix(cfg.topRadius, 0.0135, Math.pow(u, 0.62));
        const knee = Math.exp(-Math.pow((u - 0.46) / 0.09, 2)) * 0.0024;
        const fetlock = Math.exp(-Math.pow((u - 0.78) / 0.075, 2)) * 0.0026;
        return base + knee + fetlock;
      },
      26,
      18,
      {
        upRef: new THREE.Vector3(1, 0, 0),
        aspectFn: (u) => ({ sx: mix(1.16, 1.0, u), sy: mix(0.92, 0.98, u) }),
        capStart: true,
        capEnd: true
      }
    );
    const legMesh = tagMesh(new THREE.Mesh(legGeo, wetCoatMat), 'fur');
    legGroup.add(legMesh);

    // Hoof
    const hoof = tagMesh(new THREE.Mesh(sharedHoofGeo, hoofMat), 'secondary');
    hoof.position.set(cfg.hoofPos[0], cfg.hoofPos[1], cfg.hoofPos[2]);
    if (cfg.hoofRot) {
      hoof.rotation.set(cfg.hoofRot[0], cfg.hoofRot[1], cfg.hoofRot[2]);
    }
    legGroup.add(hoof);

    // Pair of translucent scalloped fin-like fetlocks sweeping back behind the fetlock joint
    for (const fSide of [-1, 1]) {
      const fin = tagMesh(new THREE.Mesh(sharedFetlockFinGeo, translucentFinMat), 'furAccent');
      fin.position.set(
        cfg.fetlockPos[0] + fSide * 0.005,
        cfg.fetlockPos[1],
        cfg.fetlockPos[2]
      );
      fin.rotation.set(
        cfg.fetlockTilt ?? 0.25,
        Math.PI * 0.5 + fSide * 0.34,
        -0.36
      );
      fin.scale.set(1.0, fSide < 0 ? 0.94 : 1.06, fSide);
      fin.castShadow = false;
      legGroup.add(fin);
    }

    root.add(legGroup);
    return legGroup;
  }

  // Front-left leg (armL): grounded firmly at y = 0
  buildLeg({
    name: 'armL',
    pivot: [-0.048, 0.254, 0.068],
    topRadius: 0.036,
    points: [
      [0.004, 0.018, -0.004],
      [-0.004, -0.050, 0.010],
      [-0.005, -0.116, 0.014],
      [-0.006, -0.190, 0.008],
      [-0.006, -0.232, 0.022]
    ],
    hoofPos: [-0.006, -0.254, 0.024],
    hoofRot: [0, -0.06, 0],
    fetlockPos: [-0.006, -0.194, 0.002],
    fetlockTilt: 0.24
  });

  // Front-right leg (armR): playfully raised & bent at knee for asymmetric charm!
  buildLeg({
    name: 'armR',
    pivot: [0.048, 0.254, 0.068],
    topRadius: 0.036,
    points: [
      [-0.004, 0.018, -0.004],
      [0.006, -0.036, 0.034],
      [0.012, -0.082, 0.072],
      [0.014, -0.148, 0.050],
      [0.015, -0.178, 0.036]
    ],
    hoofPos: [0.015, -0.194, 0.024],
    hoofRot: [0.62, 0.14, -0.08],
    fetlockPos: [0.014, -0.152, 0.042],
    fetlockTilt: 0.65
  });

  // Hind-left leg (legL): grounded firmly at y = 0
  buildLeg({
    name: 'legL',
    pivot: [-0.050, 0.252, -0.092],
    topRadius: 0.042,
    points: [
      [0.005, 0.018, 0.008],
      [-0.007, -0.048, 0.008],
      [-0.008, -0.122, -0.032],
      [-0.008, -0.192, -0.026],
      [-0.008, -0.230, -0.008]
    ],
    hoofPos: [-0.008, -0.252, -0.006],
    hoofRot: [0, -0.08, 0],
    fetlockPos: [-0.008, -0.196, -0.032],
    fetlockTilt: 0.26
  });

  // Hind-right leg (legR): grounded firmly at y = 0, slight natural stride offset
  buildLeg({
    name: 'legR',
    pivot: [0.050, 0.252, -0.088],
    topRadius: 0.042,
    points: [
      [-0.005, 0.018, 0.008],
      [0.007, -0.048, 0.016],
      [0.007, -0.120, -0.018],
      [0.007, -0.192, -0.014],
      [0.007, -0.230, 0.004]
    ],
    hoofPos: [0.007, -0.252, 0.006],
    hoofRot: [0, 0.08, 0],
    fetlockPos: [0.007, -0.196, -0.020],
    fetlockTilt: 0.26
  });

  // -------------------------------------------------------------------------
  // 4. AQUATIC TAIL THAT BECOMES A TRANSLUCENT FISH FIN
  // -------------------------------------------------------------------------
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tail';
  tailGroup.position.set(0, 0.278, -0.136);
  root.add(tailGroup);

  const tailPts = [
    new THREE.Vector3(0.0, 0.0, 0.022),
    new THREE.Vector3(0.006, 0.004, -0.040),
    new THREE.Vector3(0.028, -0.030, -0.102),
    new THREE.Vector3(0.056, -0.068, -0.160),
    new THREE.Vector3(0.074, -0.082, -0.208)
  ];
  const tailStemGeo = createTaperedTube(
    THREE,
    tailPts,
    (u) => mix(0.030, 0.0105, Math.pow(u, 0.78)),
    28,
    18,
    {
      upRef: new THREE.Vector3(0, 1, 0),
      aspectFn: (u) => ({ sx: mix(1.0, 0.72, u), sy: mix(1.0, 1.32, u) }),
      capStart: true,
      capEnd: true
    }
  );
  const tailStem = tagMesh(new THREE.Mesh(tailStemGeo, wetCoatMat), 'fur');
  tailGroup.add(tailStem);

  // Delicate translucent dorsal ridge fin running along the upper curve of the tail stem
  const dorsalFinGeo = createFishFinGeometry(THREE, {
    len: 0.135,
    span: 0.042,
    thick: 0.0018,
    waveAmp: 0.008,
    wavePhase: 0.6,
    sweepY: 0.014
  });
  const dorsalFin = tagMesh(new THREE.Mesh(dorsalFinGeo, translucentFinMat), 'furAccent');
  dorsalFin.position.set(0.016, -0.006, -0.058);
  dorsalFin.rotation.set(0.28, Math.PI * 0.5 + 0.34, 0.32);
  dorsalFin.castShadow = false;
  tailGroup.add(dorsalFin);

  // Translucent caudal fish-fin fan at the tail tip (animated independently for liquid flutter)
  const tailFinGroup = new THREE.Group();
  tailFinGroup.name = 'tailFin';
  tailFinGroup.position.set(0.070, -0.078, -0.200);
  tailFinGroup.rotation.set(-0.22, Math.PI * 0.5 + 0.36, -0.12);
  tailGroup.add(tailFinGroup);

  const upperLobeGeo = createFishFinGeometry(THREE, {
    len: 0.155,
    span: 0.095,
    thick: 0.0024,
    waveAmp: 0.018,
    wavePhase: 0.2,
    sweepY: 0.042
  });
  const upperLobe = tagMesh(new THREE.Mesh(upperLobeGeo, translucentFinMat), 'furAccent');
  upperLobe.rotation.set(0.10, 0.06, 0.24);
  upperLobe.castShadow = false;
  tailFinGroup.add(upperLobe);

  const lowerLobeGeo = createFishFinGeometry(THREE, {
    len: 0.145,
    span: 0.088,
    thick: 0.0024,
    waveAmp: 0.016,
    wavePhase: 2.1,
    sweepY: -0.036
  });
  const lowerLobe = tagMesh(new THREE.Mesh(lowerLobeGeo, translucentFinMat), 'furAccent');
  lowerLobe.scale.y = -1;
  lowerLobe.rotation.set(-0.10, -0.08, -0.20);
  lowerLobe.castShadow = false;
  tailFinGroup.add(lowerLobe);

  const centerVeilGeo = createFishFinGeometry(THREE, {
    len: 0.118,
    span: 0.072,
    thick: 0.0020,
    waveAmp: 0.014,
    wavePhase: 1.15,
    sweepY: 0.004
  });
  const centerVeil = tagMesh(new THREE.Mesh(centerVeilGeo, translucentFinMat), 'furAccent');
  centerVeil.rotation.set(0.0, 0.04, 0.0);
  centerVeil.castShadow = false;
  tailFinGroup.add(centerVeil);

  // Subtle luminous droplets near the tail fin
  const tPearl1 = tagMesh(new THREE.Mesh(pearlGeo, seaPearlMat), 'glow');
  tPearl1.position.set(0.115, 0.056, 0.018);
  tPearl1.scale.set(0.0034, 0.0034, 0.0034);
  tailFinGroup.add(tPearl1);

  const tPearl2 = tagMesh(new THREE.Mesh(pearlGeo, seaPearlMat), 'glow');
  tPearl2.position.set(0.095, -0.046, -0.014);
  tPearl2.scale.set(0.0028, 0.0028, 0.0028);
  tailFinGroup.add(tPearl2);

  // Store rest pose for drift-free idle animation
  const earL = root.getObjectByName('earL');
  const earR = root.getObjectByName('earR');
  const armR = root.getObjectByName('armR');
  root.userData._idleBase = {
    bodyY: bodyGroup.position.y,
    headPos: headGroup.position.clone(),
    headRot: headGroup.rotation.clone(),
    earLRot: earL ? earL.rotation.clone() : null,
    earRRot: earR ? earR.rotation.clone() : null,
    tailY: tailGroup.position.y,
    tailRot: tailGroup.rotation.clone(),
    tailFinRot: tailFinGroup.rotation.clone(),
    armRRot: armR ? armR.rotation.clone() : null
  };

  return root;
}

// ---------------------------------------------------------------------------
// Idle Animation
// ---------------------------------------------------------------------------

export function idle(group, t) {
  const base = group.userData._idleBase;
  if (!base) return;

  const body = group.getObjectByName('body');
  const head = group.getObjectByName('head');
  const tail = group.getObjectByName('tail');
  const tailFin = group.getObjectByName('tailFin');
  const earL = group.getObjectByName('earL');
  const earR = group.getObjectByName('earR');
  const eyeL = group.getObjectByName('eyeL');
  const eyeR = group.getObjectByName('eyeR');
  const armR = group.getObjectByName('armR');

  // Soft cozy breathing (grounded legs remain planted at y = 0)
  const breath = Math.sin(t * 2.1);
  if (body) {
    body.scale.set(1.0 + breath * 0.012, 1.0 + breath * 0.016, 1.0 + breath * 0.008);
    body.position.y = base.bodyY + breath * 0.0022;
  }

  // Gentle curious head sway & breath bob
  if (head) {
    head.position.y = base.headPos.y + breath * 0.0028;
    head.rotation.x = base.headRot.x + Math.sin(t * 1.15) * 0.045 + breath * 0.012;
    head.rotation.y = base.headRot.y + Math.sin(t * 0.72) * 0.085;
    head.rotation.z = base.headRot.z + Math.cos(t * 0.88) * 0.042;
  }

  // Expressive independent ear twitches
  if (earL && base.earLRot) {
    const twitchL = Math.pow(Math.max(0, Math.sin(t * 0.9 + 0.4)), 14) * 0.16;
    earL.rotation.z = base.earLRot.z + Math.sin(t * 1.6) * 0.04 + twitchL;
    earL.rotation.x = base.earLRot.x + Math.cos(t * 1.3) * 0.03;
  }
  if (earR && base.earRRot) {
    const twitchR = Math.pow(Math.max(0, Math.sin(t * 0.75 + 2.6)), 16) * 0.18;
    earR.rotation.z = base.earRRot.z - Math.sin(t * 1.45 + 1.1) * 0.045 - twitchR;
    earR.rotation.x = base.earRRot.x + Math.sin(t * 1.1 + 0.7) * 0.03;
  }

  // Flowing underwater-style tail & caudal fin undulation
  if (tail) {
    tail.position.y = base.tailY + breath * 0.0020;
    tail.rotation.y = base.tailRot.y + Math.sin(t * 1.65) * 0.14;
    tail.rotation.x = base.tailRot.x + Math.sin(t * 1.1 + 0.8) * 0.045;
    tail.rotation.z = base.tailRot.z + Math.cos(t * 1.65) * 0.055;
  }
  if (tailFin && base.tailFinRot) {
    tailFin.rotation.y = base.tailFinRot.y + Math.sin(t * 1.65 - 0.95) * 0.20;
    tailFin.rotation.z = base.tailFinRot.z + Math.cos(t * 1.65 - 0.6) * 0.08;
  }

  // Playful raised front hoof subtle hover
  if (armR && base.armRRot) {
    armR.rotation.x = base.armRRot.x + Math.sin(t * 1.85) * 0.055;
    armR.rotation.z = base.armRRot.z + Math.cos(t * 1.2) * 0.025;
  }

  // Natural blink every ~3.8 seconds by scaling eye groups on Y
  const blinkCycle = t % 3.8;
  let eyeScaleY = 1.0;
  if (blinkCycle > 3.55 && blinkCycle < 3.74) {
    const u = (blinkCycle - 3.55) / 0.19;
    const closed = Math.sin(u * Math.PI);
    eyeScaleY = 1.0 - closed * 0.92;
  }
  if (eyeL) eyeL.scale.y = eyeScaleY;
  if (eyeR) eyeR.scale.y = eyeScaleY;
}
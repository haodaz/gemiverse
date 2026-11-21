export const META = {
  id: 'young-kirin',
  name: 'Young Kirin',
  kind: 'creature',
  footprint: [0.24, 0.44],
  variants: ['Jade', 'Gold', 'Azure'],
  note: 'Stylised young qilin (~0.5 m tall) with painted scales, a single branched antler-horn, flowing silk mane, tufted tail, and glowing flame-tufted cloven hooves.'
};

const PALETTES = [
  {
    // 0: Jade
    fur: '#58af97',
    belly: '#eef2e2',
    furAccent: '#f5edd6',
    eye: '#d69728',
    glow: '#7cf8d2',
    horn: '#ead8a4',
    hoof: '#3a4a46',
    innerEar: '#e8b5ac',
    blush: '#ef9c94',
    nose: '#363d3c'
  },
  {
    // 1: Gold
    fur: '#dd9f3c',
    belly: '#fbf2dc',
    furAccent: '#fff6df',
    eye: '#2f8b76',
    glow: '#ffbe52',
    horn: '#f4e6bf',
    hoof: '#533e2c',
    innerEar: '#efc0ab',
    blush: '#f19c87',
    nose: '#473428'
  },
  {
    // 2: Azure
    fur: '#5386c6',
    belly: '#edf2fa',
    furAccent: '#ebf1fb',
    eye: '#df804f',
    glow: '#7dd4ff',
    horn: '#dde8f6',
    hoof: '#323e54',
    innerEar: '#dab4c7',
    blush: '#e99eb6',
    nose: '#333b4a'
  }
];

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function mixColorHex(THREE, hexA, hexB, t) {
  const c = new THREE.Color(hexA);
  c.lerp(new THREE.Color(hexB), clamp(t, 0, 1));
  return '#' + c.getHexString();
}

function shiftColorHex(THREE, hex, dh, ds, dl) {
  const c = new THREE.Color(hex);
  c.offsetHSL(dh, ds, dl);
  return '#' + c.getHexString();
}

function rgba(THREE, hex, a) {
  const c = new THREE.Color(hex);
  const r = Math.round(clamp(c.r, 0, 1) * 255);
  const g = Math.round(clamp(c.g, 0, 1) * 255);
  const b = Math.round(clamp(c.b, 0, 1) * 255);
  return `rgba(${r},${g},${b},${clamp(a, 0, 1).toFixed(3)})`;
}

function resolvePalette(THREE, opts) {
  const o = opts || {};
  const idx = clamp(Math.round(o.variant ?? 0), 0, PALETTES.length - 1);
  const base = PALETTES[idx];
  const fur = o.fur || base.fur;
  const furAccent = o.furAccent || base.furAccent;
  const eye = o.eye || base.eye;
  const glow = o.glow || base.glow;
  const belly = o.fur ? mixColorHex(THREE, fur, '#f8f5ea', 0.78) : base.belly;
  return {
    fur,
    belly,
    furAccent,
    eye,
    glow,
    horn: base.horn,
    hoof: base.hoof,
    innerEar: base.innerEar,
    blush: base.blush,
    nose: base.nose
  };
}

// ============================================================================
// Procedural Canvas Textures
// ============================================================================

function makeScaleCoatTextures(THREE, kit, pal) {
  const darkBack = shiftColorHex(THREE, pal.fur, -0.02, 0.08, -0.14);
  const midFur = pal.fur;
  const lightRim = mixColorHex(THREE, pal.fur, '#ffffff', 0.38);
  const shadowRim = shiftColorHex(THREE, pal.fur, -0.01, 0.06, -0.24);
  const belly = pal.belly;

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    // Base vertical gradient: y=0 is top of canvas -> v=1 (spine), y=h -> v=0 (belly)
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, darkBack);
    grad.addColorStop(0.24, midFur);
    grad.addColorStop(0.56, mixColorHex(THREE, midFur, belly, 0.25));
    grad.addColorStop(0.74, mixColorHex(THREE, midFur, belly, 0.85));
    grad.addColorStop(1.0, belly);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Soft organic coat mottling (periodic horizontally for seamless wrap)
    for (let y = 0; y < h; y += 6) {
      for (let x = 0; x < w; x += 6) {
        const ang = (x / w) * Math.PI * 2;
        const n = kit.noise(Math.cos(ang) * 3.0 + 5.2, Math.sin(ang) * 3.0 + (y / h) * 6.0);
        if (n > 0.56) {
          ctx.fillStyle = rgba(THREE, lightRim, (n - 0.56) * 0.26);
          ctx.fillRect(x, y, 7, 7);
        } else if (n < 0.44) {
          ctx.fillStyle = rgba(THREE, shadowRim, (0.44 - n) * 0.22);
          ctx.fillRect(x, y, 7, 7);
        }
      }
    }

    // Overlapping painted scalloped kirin scales over back & upper flanks (y: 0.04h .. 0.64h)
    const cols = 28;
    const rows = 18;
    const cellW = w / cols;
    const cellH = (h * 0.62) / rows;
    for (let r = 0; r < rows; r++) {
      const cy = h * 0.03 + r * cellH;
      const vFrac = cy / h; // 0 = spine, 1 = belly
      const fade = smoothstep(0.66, 0.42, vFrac) * smoothstep(0.0, 0.08, vFrac);
      if (fade <= 0.02) continue;
      const rowOffset = (r % 2) * (cellW * 0.5);
      for (let c = -1; c <= cols + 1; c++) {
        const cx = c * cellW + rowOffset;
        const ang = ((cx % w + w) % w) / w * Math.PI * 2;
        const n = kit.noise(Math.cos(ang) * 4.5 + 11.3, Math.sin(ang) * 4.5 + r * 0.7);
        const rx = cellW * 0.56;
        const ry = cellH * 0.78;

        // Subtle shadow crescent underneath each scale
        ctx.beginPath();
        ctx.ellipse(cx, cy + ry * 0.14, rx * 1.02, ry * 0.96, 0, 0.12 * Math.PI, 0.88 * Math.PI);
        ctx.strokeStyle = rgba(THREE, shadowRim, 0.42 * fade);
        ctx.lineWidth = 2.0;
        ctx.stroke();

        // Scale body fill with subtle iridescence
        const scaleTint = n > 0.52 ? mixColorHex(THREE, midFur, lightRim, (n - 0.52) * 0.7) : mixColorHex(THREE, midFur, darkBack, (0.52 - n) * 0.6);
        const sg = ctx.createRadialGradient(cx, cy - ry * 0.15, rx * 0.1, cx, cy + ry * 0.1, rx * 1.1);
        sg.addColorStop(0.0, rgba(THREE, scaleTint, 0.46 * fade));
        sg.addColorStop(0.75, rgba(THREE, darkBack, 0.22 * fade));
        sg.addColorStop(1.0, rgba(THREE, lightRim, 0.36 * fade));
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0.02 * Math.PI, 0.98 * Math.PI);
        ctx.fillStyle = sg;
        ctx.fill();

        // Painted luminous scale rim highlight
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx * 0.95, ry * 0.92, 0, 0.16 * Math.PI, 0.84 * Math.PI);
        ctx.strokeStyle = rgba(THREE, lightRim, (0.35 + n * 0.35) * fade);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // Gentle young-fawn pale dapples along the upper flanks
    for (let i = 0; i < 36; i++) {
      const fx = kit.noise(i * 1.37, 3.1) * w;
      const fy = (0.18 + kit.noise(i * 2.13, 9.7) * 0.34) * h;
      const rad = 2.5 + kit.noise(i * 4.1, 1.9) * 3.8;
      const dg = ctx.createRadialGradient(fx, fy, 0, fx, fy, rad);
      dg.addColorStop(0, rgba(THREE, belly, 0.42));
      dg.addColorStop(1, rgba(THREE, belly, 0));
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.arc(fx, fy, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // Soft velvety coat flecks across entire hide
    for (let i = 0; i < 900; i++) {
      const fx = kit.noise(i * 0.73, 17.4) * w;
      const fy = kit.noise(29.1, i * 0.89) * h;
      ctx.strokeStyle = i % 2 === 0 ? rgba(THREE, '#ffffff', 0.07) : rgba(THREE, shadowRim, 0.07);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + 3, fy + 2);
      ctx.stroke();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;

  const bumpMap = kit.canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = 'rgb(128,128,128)';
    ctx.fillRect(0, 0, w, h);

    const cols = 28;
    const rows = 18;
    const cellW = w / cols;
    const cellH = (h * 0.62) / rows;
    for (let r = 0; r < rows; r++) {
      const cy = h * 0.03 + r * cellH;
      const vFrac = cy / h;
      const fade = smoothstep(0.66, 0.42, vFrac) * smoothstep(0.0, 0.08, vFrac);
      if (fade <= 0.02) continue;
      const rowOffset = (r % 2) * (cellW * 0.5);
      for (let c = -1; c <= cols + 1; c++) {
        const cx = c * cellW + rowOffset;
        const rx = cellW * 0.55;
        const ry = cellH * 0.76;
        const bg = ctx.createRadialGradient(cx, cy - ry * 0.1, rx * 0.08, cx, cy, rx);
        bg.addColorStop(0, `rgba(235,235,235,${(0.75 * fade).toFixed(3)})`);
        bg.addColorStop(0.78, `rgba(170,170,170,${(0.55 * fade).toFixed(3)})`);
        bg.addColorStop(1, `rgba(55,55,55,${(0.7 * fade).toFixed(3)})`);
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0.02 * Math.PI, 0.98 * Math.PI);
        ctx.fill();
      }
    }
  });
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;

  return { map, bumpMap };
}

function makeHeadTextures(THREE, kit, pal) {
  const crown = shiftColorHex(THREE, pal.fur, -0.015, 0.06, -0.08);
  const mid = pal.fur;
  const light = mixColorHex(THREE, pal.fur, pal.belly, 0.55);
  const belly = pal.belly;
  const scaleHi = mixColorHex(THREE, pal.fur, '#ffffff', 0.45);

  const map = kit.canvasTexture(512, 512, (ctx, w, h) => {
    // SphereGeometry: u=0.25 is +z (muzzle front), y=0 is +y (crown), y=h is -y (chin)
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, crown);
    grad.addColorStop(0.42, mid);
    grad.addColorStop(0.68, light);
    grad.addColorStop(1.0, belly);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Soft pale fawn muzzle & cheek mask centered at u=0.25 (x = w*0.25), lower front
    const mx = w * 0.25;
    const my = h * 0.62;
    const mg = ctx.createRadialGradient(mx, my, w * 0.02, mx, my, w * 0.22);
    mg.addColorStop(0.0, rgba(THREE, belly, 0.92));
    mg.addColorStop(0.55, rgba(THREE, belly, 0.55));
    mg.addColorStop(1.0, rgba(THREE, belly, 0.0));
    ctx.fillStyle = mg;
    ctx.fillRect(0, 0, w, h);

    // Delicate dorsal nose-bridge stripe extending slightly toward nose
    const bg = ctx.createLinearGradient(mx, h * 0.12, mx, h * 0.56);
    bg.addColorStop(0.0, rgba(THREE, crown, 0.7));
    bg.addColorStop(0.7, rgba(THREE, mid, 0.55));
    bg.addColorStop(1.0, rgba(THREE, mid, 0.0));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(mx, h * 0.36, w * 0.055, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle pearlescent forehead scales near the horn root (u=0.25, y=0.14..0.34)
    for (let r = 0; r < 5; r++) {
      const count = 4 + r;
      for (let c = 0; c < count; c++) {
        const cx = mx + (c - (count - 1) * 0.5) * 14;
        const cy = h * 0.16 + r * 11;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 7.5, 6.2, 0, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.strokeStyle = rgba(THREE, scaleHi, 0.36 * (1 - r / 6));
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // Delicate velvet fur strokes
    for (let i = 0; i < 1100; i++) {
      const fx = kit.noise(i * 0.61, 5.7) * w;
      const fy = kit.noise(14.3, i * 0.79) * h;
      ctx.strokeStyle = i % 2 === 0 ? rgba(THREE, '#ffffff', 0.08) : rgba(THREE, crown, 0.07);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + 2, fy + 3.5);
      ctx.stroke();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = 'rgb(128,128,128)';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 800; i++) {
      const fx = kit.noise(i * 0.83, 2.3) * w;
      const fy = kit.noise(9.1, i * 0.67) * h;
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(180,180,180,0.28)' : 'rgba(90,90,90,0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + 1.5, fy + 4);
      ctx.stroke();
    }
  });
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;

  return { map, bumpMap };
}

function makeManeTextures(THREE, kit, pal) {
  const rootTint = mixColorHex(THREE, pal.furAccent, pal.fur, 0.24);
  const midSilk = pal.furAccent;
  const tipLight = mixColorHex(THREE, pal.furAccent, '#ffffff', 0.45);
  const shade = shiftColorHex(THREE, pal.furAccent, 0, 0.05, -0.14);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    // Tube UV: u along length (x: 0 root -> w tip), v around circumference (y)
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0.0, rootTint);
    grad.addColorStop(0.45, midSilk);
    grad.addColorStop(1.0, tipLight);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < h; y += 3) {
      const n = kit.noise(y * 0.18, 4.2);
      ctx.strokeStyle = n > 0.5 ? rgba(THREE, tipLight, (n - 0.5) * 0.7) : rgba(THREE, shade, (0.5 - n) * 0.55);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 32; x <= w; x += 32) {
        ctx.lineTo(x, y + (kit.noise(x * 0.02, y * 0.08) - 0.5) * 3.5);
      }
      ctx.stroke();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = 'rgb(128,128,128)';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) {
      const v = Math.round(90 + kit.noise(y * 0.25, 11.1) * 115);
      ctx.strokeStyle = `rgb(${v},${v},${v})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  });
  bumpMap.wrapS = THREE.ClampToEdgeWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

function makeHornTextures(THREE, kit, pal) {
  const baseCol = shiftColorHex(THREE, pal.horn, 0, 0.05, -0.14);
  const midCol = pal.horn;
  const tipCol = mixColorHex(THREE, pal.horn, pal.glow, 0.35);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0.0, baseCol);
    grad.addColorStop(0.65, midCol);
    grad.addColorStop(1.0, tipCol);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Longitudinal antler ridges
    for (let y = 0; y < h; y += 5) {
      const n = kit.noise(y * 0.2, 6.4);
      ctx.strokeStyle = n > 0.5 ? rgba(THREE, '#ffffff', 0.2) : rgba(THREE, baseCol, 0.32);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    // Subtle growth rings near the base
    for (let i = 0; i < 6; i++) {
      const rx = 12 + i * 11;
      ctx.strokeStyle = rgba(THREE, baseCol, 0.25 * (1 - i / 7));
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.lineTo(rx, h);
      ctx.stroke();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bumpMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = 'rgb(128,128,128)';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 6) {
      const v = Math.round(95 + kit.noise(y * 0.3, 1.5) * 95);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, w, 3);
    }
  });
  bumpMap.wrapT = THREE.RepeatWrapping;

  const emissiveMap = kit.canvasTexture(256, 64, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0.0, '#000000');
    grad.addColorStop(0.62, '#000000');
    grad.addColorStop(0.88, rgba(THREE, pal.glow, 0.55));
    grad.addColorStop(1.0, pal.glow);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  emissiveMap.colorSpace = THREE.SRGBColorSpace;

  return { map, bumpMap, emissiveMap };
}

function makeFlameTextures(THREE, kit, pal) {
  const baseCol = mixColorHex(THREE, pal.furAccent, pal.glow, 0.42);
  const midCol = pal.glow;
  const tipCol = mixColorHex(THREE, pal.glow, '#ffffff', 0.72);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    // v=0 is bottom (y=h), v=1 is tip (y=0)
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0.0, baseCol);
    grad.addColorStop(0.45, midCol);
    grad.addColorStop(0.88, tipCol);
    grad.addColorStop(1.0, '#ffffff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Wispy painterly flame streaks
    for (let i = 0; i < 24; i++) {
      const sx = (i / 24) * w;
      ctx.strokeStyle = i % 2 === 0 ? rgba(THREE, '#ffffff', 0.24) : rgba(THREE, midCol, 0.28);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(sx, h);
      ctx.bezierCurveTo(sx + 10, h * 0.65, sx - 12, h * 0.35, sx + 4, 0);
      ctx.stroke();
    }
  });
  map.colorSpace = THREE.SRGBColorSpace;

  const emissiveMap = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0.0, mixColorHex(THREE, '#000000', pal.glow, 0.35));
    grad.addColorStop(0.35, pal.glow);
    grad.addColorStop(0.85, tipCol);
    grad.addColorStop(1.0, '#ffffff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  emissiveMap.colorSpace = THREE.SRGBColorSpace;

  return { map, emissiveMap };
}

function makeIrisTexture(THREE, kit, pal) {
  const outerLimb = shiftColorHex(THREE, pal.eye, 0, 0.1, -0.34);
  const midIris = pal.eye;
  const innerGlow = mixColorHex(THREE, pal.eye, '#fff7dc', 0.68);
  const darkUpper = shiftColorHex(THREE, pal.eye, -0.02, 0.05, -0.22);

  const map = kit.canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const r = w * 0.48;

    ctx.fillStyle = '#14151c';
    ctx.fillRect(0, 0, w, h);

    // Base iris disc
    const bg = ctx.createRadialGradient(cx, cy + r * 0.1, r * 0.12, cx, cy, r);
    bg.addColorStop(0.0, midIris);
    bg.addColorStop(0.72, midIris);
    bg.addColorStop(0.88, outerLimb);
    bg.addColorStop(1.0, '#14151c');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Soft upper shadow inside iris for soulful depth
    const ug = ctx.createLinearGradient(cx, cy - r, cx, cy + r * 0.25);
    ug.addColorStop(0.0, rgba(THREE, '#12131c', 0.72));
    ug.addColorStop(0.55, rgba(THREE, darkUpper, 0.28));
    ug.addColorStop(1.0, rgba(THREE, darkUpper, 0.0));
    ctx.fillStyle = ug;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
    ctx.fill();

    // Luminous lower crescent glow
    const lg = ctx.createRadialGradient(cx, cy + r * 0.44, r * 0.04, cx, cy + r * 0.36, r * 0.56);
    lg.addColorStop(0.0, rgba(THREE, innerGlow, 0.92));
    lg.addColorStop(0.55, rgba(THREE, innerGlow, 0.4));
    lg.addColorStop(1.0, rgba(THREE, innerGlow, 0.0));
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2);
    ctx.fill();

    // Radial iris fibers
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const n = kit.noise(Math.cos(a) * 3 + 5, Math.sin(a) * 3 + 5);
      ctx.strokeStyle = n > 0.5 ? rgba(THREE, innerGlow, 0.24) : rgba(THREE, outerLimb, 0.22);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.36, cy + Math.sin(a) * r * 0.36);
      ctx.lineTo(cx + Math.cos(a) * r * 0.88, cy + Math.sin(a) * r * 0.88);
      ctx.stroke();
    }

    // Soft deep pupil
    const pg = ctx.createRadialGradient(cx, cy - r * 0.04, r * 0.24, cx, cy - r * 0.04, r * 0.44);
    pg.addColorStop(0.0, '#0b0c12');
    pg.addColorStop(0.8, '#10111a');
    pg.addColorStop(1.0, rgba(THREE, '#10111a', 0.0));
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.04, r * 0.44, 0, Math.PI * 2);
    ctx.fill();
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function makeBlushTexture(THREE, kit, pal) {
  const map = kit.canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 2, w * 0.5, h * 0.5, w * 0.48);
    g.addColorStop(0.0, rgba(THREE, pal.blush, 0.58));
    g.addColorStop(0.55, rgba(THREE, pal.blush, 0.24));
    g.addColorStop(1.0, rgba(THREE, pal.blush, 0.0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

// ============================================================================
// Geometry Builders
// ============================================================================

/**
 * Parallel-transport tapered tube along a CatmullRomCurve3.
 * Supports custom radiusFn(u), optional cross-section shaping sectionFn(angle, u) -> { rx, ry },
 * smooth end caps, and seam-free averaged normals.
 */
function makeTaperedTube(THREE, curve, options) {
  const tubularSegments = options.tubularSegments || 24;
  const radialSegments = options.radialSegments || 14;
  const radiusFn = options.radiusFn || (() => 0.01);
  const sectionFn = options.sectionFn || null;
  const capStart = options.capStart !== false;
  const capEnd = options.capEnd !== false;

  const pts = [];
  const tangents = [];
  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments;
    pts.push(curve.getPoint(u));
    tangents.push(curve.getTangent(u).normalize());
  }

  // Parallel-transport (Bishop) frames to avoid Frenet twist flips
  const normals = [];
  const binormals = [];
  const initUp = Math.abs(tangents[0].y) < 0.92 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const b0 = new THREE.Vector3().crossVectors(tangents[0], initUp).normalize();
  const n0 = new THREE.Vector3().crossVectors(b0, tangents[0]).normalize();
  normals.push(n0);
  binormals.push(b0);

  const axis = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  for (let i = 1; i <= tubularSegments; i++) {
    const prevT = tangents[i - 1];
    const currT = tangents[i];
    const n = normals[i - 1].clone();
    axis.crossVectors(prevT, currT);
    const len = axis.length();
    if (len > 1e-6) {
      axis.divideScalar(len);
      const angle = Math.acos(clamp(prevT.dot(currT), -1, 1));
      quat.setFromAxisAngle(axis, angle);
      n.applyQuaternion(quat);
    }
    // Re-orthogonalize
    n.addScaledVector(currT, -n.dot(currT)).normalize();
    const b = new THREE.Vector3().crossVectors(currT, n).normalize();
    normals.push(n);
    binormals.push(b);
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const ringStride = radialSegments + 1;
  const vTmp = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments;
    const p = pts[i];
    const N = normals[i];
    const B = binormals[i];
    const baseR = Math.max(0.0002, radiusFn(u));
    for (let j = 0; j <= radialSegments; j++) {
      const v = j / radialSegments;
      const theta = v * Math.PI * 2;
      let rx = baseR;
      let ry = baseR;
      if (sectionFn) {
        const s = sectionFn(theta, u, baseR);
        rx = s.rx;
        ry = s.ry;
      }
      const c = Math.cos(theta);
      const s = Math.sin(theta);
      vTmp.copy(p).addScaledVector(N, c * rx).addScaledVector(B, s * ry);
      positions.push(vTmp.x, vTmp.y, vTmp.z);
      uvs.push(u, v);
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * ringStride + j;
      const b = (i + 1) * ringStride + j;
      const c = (i + 1) * ringStride + (j + 1);
      const d = i * ringStride + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  if (capStart) {
    const centerIdx = positions.length / 3;
    const p0 = pts[0];
    positions.push(p0.x, p0.y, p0.z);
    uvs.push(0, 0.5);
    for (let j = 0; j < radialSegments; j++) {
      indices.push(centerIdx, j + 1, j);
    }
  }

  if (capEnd) {
    const centerIdx = positions.length / 3;
    const pEnd = pts[tubularSegments];
    positions.push(pEnd.x, pEnd.y, pEnd.z);
    uvs.push(1, 0.5);
    const lastRing = tubularSegments * ringStride;
    for (let j = 0; j < radialSegments; j++) {
      indices.push(centerIdx, lastRing + j, lastRing + j + 1);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  // Stitch seam normals between j=0 and j=radialSegments
  const nAttr = geom.attributes.normal;
  for (let i = 0; i <= tubularSegments; i++) {
    const i0 = i * ringStride;
    const i1 = i * ringStride + radialSegments;
    const nx = nAttr.getX(i0) + nAttr.getX(i1);
    const ny = nAttr.getY(i0) + nAttr.getY(i1);
    const nz = nAttr.getZ(i0) + nAttr.getZ(i1);
    const l = Math.hypot(nx, ny, nz) || 1;
    nAttr.setXYZ(i0, nx / l, ny / l, nz / l);
    nAttr.setXYZ(i1, nx / l, ny / l, nz / l);
  }
  nAttr.needsUpdate = true;
  return geom;
}

function normalizeExtrudeUVs(geom) {
  geom.computeBoundingBox();
  const bb = geom.boundingBox;
  const dx = Math.max(1e-5, bb.max.x - bb.min.x);
  const dy = Math.max(1e-5, bb.max.y - bb.min.y);
  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getX(i) - bb.min.x) / dx;
    const v = (pos.getY(i) - bb.min.y) / dy;
    uv.setXY(i, clamp(u, 0, 1), clamp(v, 0, 1));
  }
  uv.needsUpdate = true;
}

/**
 * Continuous sculpted deer-like torso (one dense SphereGeometry 56x40 displaced organically).
 */
function sculptBodyGeometry(THREE) {
  const geom = new THREE.SphereGeometry(1, 56, 40);
  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    // Base elongated deer-fawn torso proportions
    let z = nz * 0.118;

    // Width profile along z: fuller haunches & chest, slender waist
    const haunchW = Math.exp(-Math.pow((nz + 0.56) / 0.36, 2));
    const chestW = Math.exp(-Math.pow((nz - 0.52) / 0.36, 2));
    const waistW = Math.exp(-Math.pow((nz + 0.04) / 0.34, 2));
    let rx = 0.050 + 0.013 * haunchW + 0.011 * chestW - 0.007 * waistW;
    // Slightly narrower toward the spine for refined deer silhouette
    rx *= 1.0 - 0.14 * Math.max(0, ny) - 0.08 * Math.max(0, -ny);
    let x = nx * rx;

    // Height profile along y
    let ry = 0.053;
    let y = ny * ry;

    // Gentle deer back dip around mid-spine, lifted withers and rounded rump
    const backMask = smoothstep(-0.1, 0.7, ny);
    const swayBack = Math.exp(-Math.pow((nz - 0.02) / 0.38, 2));
    const withers = Math.exp(-Math.pow((nz - 0.56) / 0.34, 2));
    const rump = Math.exp(-Math.pow((nz + 0.60) / 0.36, 2));
    y += backMask * (-0.0075 * swayBack + 0.011 * withers + 0.0075 * rump);

    // Deeper rounded chest keel in front, tucked-up athletic fawn belly in back
    const bellyMask = smoothstep(0.1, -0.7, ny);
    const chestKeel = Math.exp(-Math.pow((nz - 0.54) / 0.42, 2));
    const bellyTuck = Math.exp(-Math.pow((nz + 0.32) / 0.38, 2));
    y += bellyMask * (-0.011 * chestKeel + 0.010 * bellyTuck);

    // Subtle underside flattening so torso reads grounded and soft
    if (ny < -0.5) {
      y += (-0.5 - ny) * 0.007;
    }

    // Smooth forward chest breast swell
    const breast = Math.exp(-Math.pow((nz - 0.85) / 0.35, 2)) * Math.exp(-Math.pow((ny + 0.05) / 0.55, 2));
    z += 0.009 * breast;

    // Slight natural spine arch forward-upward
    y += 0.005 * nz;

    pos.setXYZ(i, x, y, z);
  }

  geom.computeVertexNormals();
  return geom;
}

/**
 * Pure vertex displacement evaluator for the continuous sculpted head + muzzle + cheeks + eye sockets.
 * Reused to place eyes, nose, mouth, blush, ears, and horn directly on the exact sculpted surface.
 */
function evalHeadPoint(nx, ny, nz, out) {
  let x = nx * 0.0475;
  let y = ny * 0.0465;
  let z = nz * 0.0495;

  // Slightly fuller rounded back cranium (cute chibi balance)
  const occiput = smoothstep(0.1, -0.85, nz) * Math.exp(-Math.pow((ny - 0.1) / 0.75, 2));
  z -= 0.005 * occiput;
  x *= 1.0 + 0.04 * occiput;

  // Softly domed forehead & brow ridge
  const brow = Math.exp(-Math.pow((ny - 0.44) / 0.34, 2)) * Math.exp(-Math.pow((nz - 0.62) / 0.38, 2));
  z += 0.0045 * brow;
  y += 0.003 * brow;

  // Tapered gentle deer muzzle projecting along +z
  const muzzleForward = smoothstep(0.28, 0.96, nz);
  const muzzleVert = Math.exp(-Math.pow((ny + 0.18) / 0.50, 2));
  const muzzleHoriz = Math.exp(-Math.pow(nx / 0.62, 2));
  const muzzleMask = muzzleForward * muzzleVert;

  // Project snout forward
  z += 0.036 * muzzleMask * muzzleHoriz;
  // Subtle gentle downward tilt of muzzle tip
  y -= 0.0075 * muzzleForward * smoothstep(0.15, -0.55, ny) * muzzleHoriz;
  // Taper muzzle smoothly in width so it feels like a delicate fawn snout
  const narrow = 0.43 * smoothstep(0.36, 0.98, nz) * Math.exp(-Math.pow((ny + 0.16) / 0.62, 2));
  x *= 1.0 - narrow;
  // Softly taper muzzle height near tip
  if (nz > 0.45 && ny > -0.35 && ny < 0.25) {
    const bridgeStop = smoothstep(0.45, 0.9, nz) * Math.exp(-Math.pow((ny - 0.12) / 0.22, 2));
    y -= 0.0045 * bridgeStop;
  }

  // Plush rounded chibi cheeks
  const cheek =
    Math.exp(-Math.pow((Math.abs(nx) - 0.70) / 0.34, 2)) *
    Math.exp(-Math.pow((ny + 0.22) / 0.34, 2)) *
    Math.exp(-Math.pow((nz - 0.18) / 0.46, 2));
  x += Math.sign(nx || 1) * 0.0085 * cheek;
  y -= 0.0025 * cheek;

  // Gentle chin / underside jaw smoothing
  if (ny < -0.45) {
    const jaw = smoothstep(-0.45, -0.95, ny);
    y += 0.0065 * jaw;
    x *= 1.0 - 0.12 * jaw;
  }

  // Subtle recessed eye sockets so glossy eyes sit nestled in the face
  const ex = 0.56;
  const ey = 0.03;
  const ez = 0.80;
  const eLen = Math.hypot(ex, ey, ez);
  const enx = ex / eLen;
  const eny = ey / eLen;
  const enz = ez / eLen;
  const dotL = nx * enx + ny * eny + nz * enz;
  const dotR = nx * -enx + ny * eny + nz * enz;
  const socketL = Math.exp(-Math.pow((1 - dotL) / 0.042, 2));
  const socketR = Math.exp(-Math.pow((1 - dotR) / 0.042, 2));
  const socket = Math.max(socketL, socketR);
  x -= nx * 0.0052 * socket;
  y -= ny * 0.0052 * socket;
  z -= nz * 0.0052 * socket;

  out.set(x, y, z);
  return out;
}

function sculptHeadGeometry(THREE) {
  const geom = new THREE.SphereGeometry(1, 56, 40);
  const pos = geom.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    evalHeadPoint(pos.getX(i), pos.getY(i), pos.getZ(i), v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geom.computeVertexNormals();
  return geom;
}

/**
 * Cloven deer hoof built from LatheGeometry (18 profile points), then vertex-sculpted
 * to carve the characteristic cloven cleft down the front and underside.
 * Sole rests flat at y = 0.
 */
function makeClovenHoofGeometry(THREE) {
  const pts = [];
  const profile = [
    [0.0001, 0.0000],
    [0.0085, 0.0000],
    [0.0128, 0.0004],
    [0.0138, 0.0018],
    [0.0136, 0.0040],
    [0.0131, 0.0065],
    [0.0126, 0.0092],
    [0.0121, 0.0120],
    [0.0117, 0.0148],
    [0.0114, 0.0175],
    [0.0115, 0.0198],
    [0.0121, 0.0218],
    [0.0123, 0.0234],
    [0.0116, 0.0246],
    [0.0102, 0.0252],
    [0.0075, 0.0254],
    [0.0038, 0.0254],
    [0.0001, 0.0254]
  ];
  for (let i = 0; i < profile.length; i++) {
    pts.push(new THREE.Vector2(profile[i][0], profile[i][1]));
  }
  const geom = new THREE.LatheGeometry(pts, 24);
  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const hFrac = clamp(y / 0.0254, 0, 1);

    // Elongate forward into a refined sloped deer toe
    if (z > 0) {
      z *= 1.32 - 0.28 * hFrac;
    } else {
      z *= 0.88;
    }
    // Slight forward slant of hoof wall toward the bottom
    z += (1 - hFrac) * 0.0028;

    // Carve distinct cloven cleft along front & lower edge around x = 0
    const cleftX = Math.exp(-Math.pow(x / 0.0032, 2));
    const frontMask = smoothstep(-0.001, 0.008, z);
    const heightMask = smoothstep(0.92, 0.15, hFrac);
    const cleft = cleftX * frontMask * heightMask;
    z -= 0.0062 * cleft;

    // Slight twin-toe fullness on either side of the cleft
    const lobe = Math.exp(-Math.pow((Math.abs(x) - 0.0065) / 0.0045, 2)) * frontMask * heightMask;
    z += 0.0018 * lobe;
    x += Math.sign(x || 1) * 0.0009 * lobe;

    // Keep bottom flat on y = 0
    if (y < 0.0006) y = 0;

    pos.setXYZ(i, x, y, z);
  }

  geom.computeVertexNormals();
  return geom;
}

/**
 * Horn coronet burr collar using LatheGeometry (18 profile points) with pearled edge sculpting.
 */
function makeCoronetGeometry(THREE) {
  const profile = [
    [0.0060, 0.0000],
    [0.0110, 0.0003],
    [0.0132, 0.0014],
    [0.0142, 0.0028],
    [0.0145, 0.0042],
    [0.0138, 0.0056],
    [0.0128, 0.0068],
    [0.0134, 0.0080],
    [0.0130, 0.0092],
    [0.0118, 0.0102],
    [0.0106, 0.0112],
    [0.0102, 0.0124],
    [0.0098, 0.0136],
    [0.0093, 0.0148],
    [0.0086, 0.0158],
    [0.0076, 0.0165],
    [0.0062, 0.0168],
    [0.0045, 0.0168]
  ];
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const geom = new THREE.LatheGeometry(pts, 24);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ang = Math.atan2(z, x);
    const pearl = 1 + 0.08 * Math.sin(ang * 8) * smoothstep(0.0, 0.006, y) * smoothstep(0.016, 0.007, y);
    pos.setXYZ(i, x * pearl, y, z * pearl);
  }
  geom.computeVertexNormals();
  return geom;
}

/**
 * Curved leaf-like deer ear built with ExtrudeGeometry + bezierCurveTo + bevel,
 * then cupped and arched organically by vertex displacement.
 */
function makeEarGeometry(THREE, scale, isInner) {
  const s = scale || 1;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.016 * s, 0.006 * s, 0.024 * s, 0.026 * s, 0.016 * s, 0.052 * s);
  shape.bezierCurveTo(0.011 * s, 0.068 * s, 0.004 * s, 0.078 * s, 0.0, 0.083 * s);
  shape.bezierCurveTo(-0.004 * s, 0.078 * s, -0.011 * s, 0.068 * s, -0.016 * s, 0.052 * s);
  shape.bezierCurveTo(-0.024 * s, 0.026 * s, -0.016 * s, 0.006 * s, 0, 0);

  const depth = isInner ? 0.0012 : 0.0036;
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: isInner ? 0.0007 : 0.0022,
    bevelSize: isInner ? 0.0008 : 0.0018,
    bevelSegments: 3,
    curveSegments: 16
  });
  geom.translate(0, 0, -depth * 0.5);
  normalizeExtrudeUVs(geom);

  // Cup and bend the ear gracefully so it is organically curved, never flat
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const hFrac = clamp(y / (0.083 * s), 0, 1);
    const wNorm = x / (0.022 * s);

    // Concave ear cup facing +z (outer rims curve forward, center recesses back)
    const cup = (1 - smoothstep(0.65, 1.0, hFrac)) * 0.0095 * (wNorm * wNorm - 0.55);
    // Gentle graceful backward arch & slight tip flick
    const arch = -0.010 * hFrac * hFrac + 0.004 * Math.sin(hFrac * Math.PI);
    // Slight narrowing/pinch right at ear root for seamless skull attachment
    const rootPinch = 0.72 + 0.28 * smoothstep(0.0, 0.24, hFrac);

    x *= rootPinch;
    z += cup + arch;
    // Slight taper in thickness toward the delicate ear tip
    if (!isInner) {
      const zScale = 1.0 - 0.45 * hFrac;
      z = (z - (cup + arch)) * zScale + (cup + arch);
    }

    pos.setXYZ(i, x, y, z);
  }

  geom.computeVertexNormals();
  return geom;
}

/**
 * Flame-shaped glowing ankle tuft built with ExtrudeGeometry + bezierCurveTo + bevel,
 * then bent organically along a fiery upward/backward S-curl.
 */
function makeFlameWispGeometry(THREE, height, width, curlBack, sideCurve) {
  const h = height;
  const w = width;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(w * 0.85, h * 0.14, w * 0.95, h * 0.42, w * 0.35, h * 0.68);
  shape.bezierCurveTo(w * 0.12, h * 0.80, w * 0.18, h * 0.92, 0.0, h);
  shape.bezierCurveTo(-w * 0.26, h * 0.86, -w * 0.22, h * 0.66, -w * 0.52, h * 0.48);
  shape.bezierCurveTo(-w * 0.92, h * 0.26, -w * 0.65, h * 0.08, 0, 0);

  const depth = 0.0018;
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.0012,
    bevelSize: 0.0010,
    bevelSegments: 2,
    curveSegments: 14
  });
  geom.translate(0, 0, -depth * 0.5);
  normalizeExtrudeUVs(geom);

  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const t = clamp(y / h, 0, 1);
    const wNorm = x / Math.max(1e-4, w);

    // Flame bends backward (-z) and curls upward with an organic S-wave
    const sweepZ = -curlBack * (Math.pow(t, 1.35) - 0.22 * Math.sin(t * Math.PI));
    const swayX = sideCurve * Math.pow(t, 1.4) + 0.0022 * Math.sin(t * Math.PI * 1.6);
    // Gentle concave cup around the ankle
    const cupZ = 0.0032 * (wNorm * wNorm) * (1 - t * 0.6);

    x += swayX;
    z = z * (1 - 0.55 * t) + sweepZ + cupZ;

    pos.setXYZ(i, x, y, z);
  }

  geom.computeVertexNormals();
  return geom;
}

/**
 * Curved iris cap matching the oblate dark glossy eyeball curvature so there is zero clipping.
 */
function makeIrisCapGeometry(THREE, radius, zSquash) {
  const geom = new THREE.SphereGeometry(radius, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.43);
  geom.rotateX(Math.PI * 0.5);
  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  const maxR = radius * Math.sin(Math.PI * 0.43);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i) * zSquash;
    pos.setXYZ(i, x, y, z);
    uv.setXY(i, 0.5 + x / (2 * maxR), 0.5 + y / (2 * maxR));
  }
  geom.computeVertexNormals();
  return geom;
}

// ============================================================================
// Sub-assembly Builders
// ============================================================================

function buildEyeGroup(THREE, sideSign, mats) {
  const g = new THREE.Group();
  g.name = sideSign > 0 ? 'eyeL' : 'eyeR';

  // 1. Dark glossy sclera/eyeball dome
  const ballGeom = new THREE.SphereGeometry(0.0138, 24, 18);
  ballGeom.scale(1.0, 1.06, 0.62);
  const ballMesh = new THREE.Mesh(ballGeom, mats.eyeDark);
  ballMesh.userData.slot = 'eye';
  g.add(ballMesh);

  // 2. Colored stylized iris ring / jewel dome hugging eyeball curvature
  const irisGeom = makeIrisCapGeometry(THREE, 0.0142, 0.635);
  const irisMesh = new THREE.Mesh(irisGeom, mats.iris);
  irisMesh.scale.set(0.84, 0.88, 1.0);
  irisMesh.position.z = 0.0005;
  irisMesh.userData.slot = 'eye';
  g.add(irisMesh);

  // 3. Two crisp white catchlight dots placed consistently up and to one side
  const hiBigGeom = new THREE.SphereGeometry(0.0029, 12, 10);
  hiBigGeom.scale(1.1, 0.92, 0.45);
  const hiBig = new THREE.Mesh(hiBigGeom, mats.eyeHighlight);
  hiBig.position.set(0.0038, 0.0046, 0.0082);
  hiBig.userData.slot = 'eye';
  g.add(hiBig);

  const hiSmallGeom = new THREE.SphereGeometry(0.0014, 10, 8);
  hiSmallGeom.scale(1.0, 1.0, 0.45);
  const hiSmall = new THREE.Mesh(hiSmallGeom, mats.eyeHighlight);
  hiSmall.position.set(-0.0034, -0.0040, 0.0080);
  hiSmall.userData.slot = 'eye';
  g.add(hiSmall);

  // 4. Delicate sculpted upper eyelid lash arch with soft outer flick
  const s = sideSign; // +1 for left eye (+x outer), -1 for right eye (-x outer)
  const lashPts = [
    new THREE.Vector3(-s * 0.0115, 0.0025, 0.0045),
    new THREE.Vector3(-s * 0.0050, 0.0112, 0.0062),
    new THREE.Vector3(s * 0.0045, 0.0118, 0.0058),
    new THREE.Vector3(s * 0.0122, 0.0058, 0.0038),
    new THREE.Vector3(s * 0.0156, 0.0082, 0.0012)
  ];
  const lashCurve = new THREE.CatmullRomCurve3(lashPts);
  const lashGeom = makeTaperedTube(THREE, lashCurve, {
    tubularSegments: 16,
    radialSegments: 8,
    radiusFn: (u) => 0.0007 + 0.0011 * Math.sin(u * Math.PI) * (1 - 0.35 * u)
  });
  const lashMesh = new THREE.Mesh(lashGeom, mats.nose);
  lashMesh.userData.slot = 'skin';
  g.add(lashMesh);

  return g;
}

function buildBranchedHorn(THREE, mats) {
  const hornGroup = new THREE.Group();
  hornGroup.name = 'horn';

  // Lathe coronet burr at forehead base
  const coronetMesh = new THREE.Mesh(makeCoronetGeometry(THREE), mats.horn);
  coronetMesh.userData.slot = 'accent';
  coronetMesh.castShadow = true;
  hornGroup.add(coronetMesh);

  // Main central sweeping antler beam
  const mainCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 0.004, 0.0),
    new THREE.Vector3(0.001, 0.032, 0.004),
    new THREE.Vector3(-0.002, 0.068, -0.005),
    new THREE.Vector3(0.002, 0.102, -0.014),
    new THREE.Vector3(0.005, 0.128, -0.008)
  ]);
  const mainGeom = makeTaperedTube(THREE, mainCurve, {
    tubularSegments: 24,
    radialSegments: 14,
    radiusFn: (u) => 0.0092 * Math.pow(1 - u * 0.80, 1.15),
    sectionFn: (ang, u, r) => {
      const flute = 1 + 0.06 * Math.cos(ang * 5 + u * 2.5) * (1 - u * 0.6);
      return { rx: r * flute, ry: r * flute * 1.06 };
    }
  });
  const mainMesh = new THREE.Mesh(mainGeom, mats.horn);
  mainMesh.userData.slot = 'accent';
  mainMesh.castShadow = true;
  hornGroup.add(mainMesh);

  // Forward-sweeping lower brow tine
  const pBrow = mainCurve.getPoint(0.28);
  const browCurve = new THREE.CatmullRomCurve3([
    pBrow.clone().add(new THREE.Vector3(0, -0.002, -0.002)),
    pBrow.clone().add(new THREE.Vector3(-0.003, 0.011, 0.014)),
    pBrow.clone().add(new THREE.Vector3(-0.004, 0.028, 0.022)),
    pBrow.clone().add(new THREE.Vector3(-0.002, 0.044, 0.019))
  ]);
  const browMesh = new THREE.Mesh(
    makeTaperedTube(THREE, browCurve, {
      tubularSegments: 14,
      radialSegments: 10,
      radiusFn: (u) => 0.0052 * Math.pow(1 - u * 0.78, 1.1)
    }),
    mats.horn
  );
  browMesh.userData.slot = 'accent';
  browMesh.castShadow = true;
  hornGroup.add(browMesh);

  // Left upper branching tine
  const pLeft = mainCurve.getPoint(0.56);
  const leftTineCurve = new THREE.CatmullRomCurve3([
    pLeft.clone().add(new THREE.Vector3(-0.001, -0.002, 0)),
    pLeft.clone().add(new THREE.Vector3(0.015, 0.012, 0.004)),
    pLeft.clone().add(new THREE.Vector3(0.028, 0.030, 0.002)),
    pLeft.clone().add(new THREE.Vector3(0.031, 0.048, -0.003))
  ]);
  const leftTine = new THREE.Mesh(
    makeTaperedTube(THREE, leftTineCurve, {
      tubularSegments: 14,
      radialSegments: 10,
      radiusFn: (u) => 0.0048 * Math.pow(1 - u * 0.78, 1.1)
    }),
    mats.horn
  );
  leftTine.userData.slot = 'accent';
  leftTine.castShadow = true;
  hornGroup.add(leftTine);

  // Right upper branching tine (slightly higher for graceful organic asymmetry)
  const pRight = mainCurve.getPoint(0.68);
  const rightTineCurve = new THREE.CatmullRomCurve3([
    pRight.clone().add(new THREE.Vector3(0.001, -0.002, 0)),
    pRight.clone().add(new THREE.Vector3(-0.013, 0.010, -0.004)),
    pRight.clone().add(new THREE.Vector3(-0.023, 0.026, -0.007)),
    pRight.clone().add(new THREE.Vector3(-0.024, 0.040, -0.005))
  ]);
  const rightTine = new THREE.Mesh(
    makeTaperedTube(THREE, rightTineCurve, {
      tubularSegments: 14,
      radialSegments: 10,
      radiusFn: (u) => 0.0044 * Math.pow(1 - u * 0.78, 1.1)
    }),
    mats.horn
  );
  rightTine.userData.slot = 'accent';
  rightTine.castShadow = true;
  hornGroup.add(rightTine);

  return hornGroup;
}

function buildAnkleFlames(THREE, mats, flameGeoms) {
  const g = new THREE.Group();

  // Main rear-sweeping glowing flame tuft
  const mainFlame = new THREE.Mesh(flameGeoms.main, mats.flame);
  mainFlame.position.set(0, 0.0, -0.0085);
  mainFlame.rotation.x = -0.18;
  mainFlame.userData.slot = 'glow';
  g.add(mainFlame);

  // Left flanking flame wisp
  const leftFlame = new THREE.Mesh(flameGeoms.sideL, mats.flame);
  leftFlame.position.set(0.0082, 0.001, -0.0045);
  leftFlame.rotation.set(-0.12, 0.58, -0.16);
  leftFlame.userData.slot = 'glow';
  g.add(leftFlame);

  // Right flanking flame wisp
  const rightFlame = new THREE.Mesh(flameGeoms.sideR, mats.flame);
  rightFlame.position.set(-0.0082, 0.001, -0.0045);
  rightFlame.rotation.set(-0.12, -0.58, 0.16);
  rightFlame.userData.slot = 'glow';
  g.add(rightFlame);

  return g;
}

function buildLeg(THREE, config, mats, hoofGeom, flameGeoms) {
  const legGroup = new THREE.Group();
  legGroup.name = config.name;
  legGroup.position.copy(config.pivot);

  const curve = new THREE.CatmullRomCurve3(config.points);
  const legGeom = makeTaperedTube(THREE, curve, {
    tubularSegments: 22,
    radialSegments: 16,
    radiusFn: (u) => {
      // Wide shoulder/thigh top deeply overlapped in body, graceful fawn taper, subtle knee & fetlock swell
      const topFlare = config.topRadius * Math.pow(1 - u, 1.7) * 0.72;
      const baseTaper = 0.0145 - 0.0046 * smoothstep(0.05, 0.85, u);
      const kneeBulge = 0.0020 * Math.exp(-Math.pow((u - config.jointU) / 0.11, 2));
      const fetlock = 0.0022 * Math.exp(-Math.pow((u - 0.90) / 0.08, 2));
      return topFlare + baseTaper + kneeBulge + fetlock;
    },
    sectionFn: (ang, u, r) => {
      // Slightly deeper front-to-back at upper thigh/shoulder
      const oval = 1 + 0.16 * (1 - u);
      return { rx: r * 0.94, ry: r * oval };
    }
  });
  const legMesh = new THREE.Mesh(legGeom, mats.coat);
  legMesh.userData.slot = 'fur';
  legMesh.castShadow = true;
  legMesh.receiveShadow = true;
  legGroup.add(legMesh);

  // Attach cloven hoof cleanly at bottom of leg
  const hoofMesh = new THREE.Mesh(hoofGeom, mats.hoof);
  hoofMesh.userData.slot = 'secondary';
  hoofMesh.castShadow = true;
  hoofMesh.receiveShadow = true;
  hoofMesh.position.copy(config.hoofPos);
  if (config.hoofRot) {
    hoofMesh.rotation.copy(config.hoofRot);
  }
  legGroup.add(hoofMesh);

  // Attach glowing flame-shaped ankle tufts right above the hoof coronet
  const flames = buildAnkleFlames(THREE, mats, flameGeoms);
  flames.position.copy(config.flamePos);
  if (config.flameRot) {
    flames.rotation.copy(config.flameRot);
  }
  legGroup.add(flames);

  return legGroup;
}

function buildManeLock(THREE, pts, baseR, flatRatio, mat) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const geom = makeTaperedTube(THREE, curve, {
    tubularSegments: 16,
    radialSegments: 10,
    radiusFn: (u) => {
      const env = Math.sin(Math.pow(u, 0.55) * Math.PI);
      const rootSupport = 0.45 * (1 - smoothstep(0.0, 0.28, u));
      return Math.max(0.0007, baseR * (0.12 + 0.88 * env + rootSupport * 0.55) * (1 - 0.15 * u));
    },
    sectionFn: (ang, u, r) => ({ rx: r, ry: r * flatRatio })
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.userData.slot = 'furAccent';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildHeadAssembly(THREE, mats) {
  const headGroup = new THREE.Group();
  headGroup.name = 'head';

  // Continuous sculpted head + muzzle + cheeks + eye sockets
  const headMesh = new THREE.Mesh(sculptHeadGeometry(THREE), mats.head);
  headMesh.userData.slot = 'fur';
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headGroup.add(headMesh);

  // Helper to orient a feature flush on the head surface with local +Y pointing vertically
  const surfacePos = new THREE.Vector3();
  const matBasis = new THREE.Matrix4();
  const worldUp = new THREE.Vector3(0, 1, 0);

  // Large 3-layer expressive eyes slightly inset into sculpted sockets
  for (const side of [1, -1]) {
    const dir = new THREE.Vector3(side * 0.56, 0.03, 0.80).normalize();
    evalHeadPoint(dir.x, dir.y, dir.z, surfacePos);

    // Gaze direction blended gently forward so the kirin has an engaging 3/4 look
    const forward = new THREE.Vector3(side * 0.48, 0.02, 0.88).normalize();
    const right = new THREE.Vector3().crossVectors(worldUp, forward).normalize();
    const up = new THREE.Vector3().crossVectors(forward, right).normalize();
    matBasis.makeBasis(right, up, forward);

    const eye = buildEyeGroup(THREE, side, mats);
    eye.position.copy(surfacePos).addScaledVector(forward, -0.0028);
    eye.quaternion.setFromRotationMatrix(matBasis);
    headGroup.add(eye);
  }

  // Soft blush discs curving gently onto cheeks below outer eye corners
  const blushGeom = new THREE.CircleGeometry(0.0115, 20);
  for (const side of [1, -1]) {
    const bDir = new THREE.Vector3(side * 0.68, -0.22, 0.66).normalize();
    evalHeadPoint(bDir.x, bDir.y, bDir.z, surfacePos);
    const bFwd = new THREE.Vector3(side * 0.62, -0.18, 0.76).normalize();
    const bRight = new THREE.Vector3().crossVectors(worldUp, bFwd).normalize();
    const bUp = new THREE.Vector3().crossVectors(bFwd, bRight).normalize();
    matBasis.makeBasis(bRight, bUp, bFwd);

    const blush = new THREE.Mesh(blushGeom, mats.blush);
    blush.scale.set(1.22, 0.78, 1.0);
    blush.position.copy(surfacePos).addScaledVector(bFwd, 0.0012);
    blush.quaternion.setFromRotationMatrix(matBasis);
    blush.userData.slot = 'skin';
    headGroup.add(blush);
  }

  // Sculpted dark glossy fawn nose sitting snugly on tip of muzzle
  const noseDir = new THREE.Vector3(0, -0.17, 0.985).normalize();
  evalHeadPoint(noseDir.x, noseDir.y, noseDir.z, surfacePos);
  const noseGeom = new THREE.SphereGeometry(0.0072, 20, 14);
  const nPos = noseGeom.attributes.position;
  for (let i = 0; i < nPos.count; i++) {
    let x = nPos.getX(i);
    let y = nPos.getY(i);
    let z = nPos.getZ(i);
    // Heart/shield deer nose shape: wider on top, tapered gently toward bottom philtrum
    const wMod = 1.18 + 0.25 * (y / 0.0072);
    x *= wMod;
    y *= 0.76;
    z *= 0.72;
    // Tiny nostril indentations on left/right sides
    const nost = Math.exp(-Math.pow((Math.abs(x) - 0.0048) / 0.0022, 2)) * Math.exp(-Math.pow((y + 0.0005) / 0.0024, 2));
    z -= 0.0012 * nost * (z > 0 ? 1 : 0);
    nPos.setXYZ(i, x, y, z);
  }
  noseGeom.computeVertexNormals();
  const noseMesh = new THREE.Mesh(noseGeom, mats.nose);
  noseMesh.position.copy(surfacePos).add(new THREE.Vector3(0, 0.0012, 0.0012));
  noseMesh.rotation.x = 0.14;
  noseMesh.userData.slot = 'skin';
  headGroup.add(noseMesh);

  // Curved gentle serene mouth line made from thin tapered tubes
  const mCenter = surfacePos.clone().add(new THREE.Vector3(0, -0.0105, -0.0045));
  // Vertical philtrum
  const philCurve = new THREE.CatmullRomCurve3([
    surfacePos.clone().add(new THREE.Vector3(0, -0.0032, -0.0008)),
    surfacePos.clone().add(new THREE.Vector3(0, -0.0072, -0.0024)),
    mCenter.clone()
  ]);
  const philMesh = new THREE.Mesh(
    makeTaperedTube(THREE, philCurve, { tubularSegments: 8, radialSegments: 6, radiusFn: () => 0.00105 }),
    mats.nose
  );
  philMesh.userData.slot = 'skin';
  headGroup.add(philMesh);

  // Left & right gentle smile arcs
  for (const side of [1, -1]) {
    const smileCurve = new THREE.CatmullRomCurve3([
      mCenter.clone(),
      mCenter.clone().add(new THREE.Vector3(side * 0.0052, -0.0020, -0.0015)),
      mCenter.clone().add(new THREE.Vector3(side * 0.0112, -0.0008, -0.0048)),
      mCenter.clone().add(new THREE.Vector3(side * 0.0155, 0.0020, -0.0092))
    ]);
    const smileMesh = new THREE.Mesh(
      makeTaperedTube(THREE, smileCurve, {
        tubularSegments: 12,
        radialSegments: 6,
        radiusFn: (u) => 0.00115 * (1 - 0.35 * u)
      }),
      mats.nose
    );
    smileMesh.userData.slot = 'skin';
    headGroup.add(smileMesh);
  }

  // Delicate kirin whiskers curving gracefully from muzzle sides
  for (const side of [1, -1]) {
    const wBase = surfacePos.clone().add(new THREE.Vector3(side * 0.014, -0.006, -0.011));
    const longWhisker = new THREE.CatmullRomCurve3([
      wBase.clone(),
      wBase.clone().add(new THREE.Vector3(side * 0.018, -0.004, 0.006)),
      wBase.clone().add(new THREE.Vector3(side * 0.036, -0.011, -0.006)),
      wBase.clone().add(new THREE.Vector3(side * 0.045, -0.003, -0.022))
    ]);
    const wMesh1 = new THREE.Mesh(
      makeTaperedTube(THREE, longWhisker, {
        tubularSegments: 16,
        radialSegments: 6,
        radiusFn: (u) => 0.0013 * (1 - 0.72 * u)
      }),
      mats.mane
    );
    wMesh1.userData.slot = 'furAccent';
    headGroup.add(wMesh1);

    const shortWhisker = new THREE.CatmullRomCurve3([
      wBase.clone().add(new THREE.Vector3(0, -0.003, -0.002)),
      wBase.clone().add(new THREE.Vector3(side * 0.014, -0.009, 0.001)),
      wBase.clone().add(new THREE.Vector3(side * 0.028, -0.016, -0.011))
    ]);
    const wMesh2 = new THREE.Mesh(
      makeTaperedTube(THREE, shortWhisker, {
        tubularSegments: 12,
        radialSegments: 6,
        radiusFn: (u) => 0.0010 * (1 - 0.74 * u)
      }),
      mats.mane
    );
    wMesh2.userData.slot = 'furAccent';
    headGroup.add(wMesh2);
  }

  // Ears ("earL" and "earR") — extruded with bezierCurveTo, bevelled & cupped
  const outerEarGeom = makeEarGeometry(THREE, 1.0, false);
  const innerEarGeom = makeEarGeometry(THREE, 0.78, true);

  for (const side of [1, -1]) {
    const earGroup = new THREE.Group();
    earGroup.name = side > 0 ? 'earL' : 'earR';
    earGroup.position.set(side * 0.031, 0.028, -0.010);
    earGroup.rotation.set(-0.22, side * 0.42, -side * 0.62);

    const outerMesh = new THREE.Mesh(outerEarGeom, mats.coat);
    outerMesh.userData.slot = 'fur';
    outerMesh.castShadow = true;
    earGroup.add(outerMesh);

    const innerMesh = new THREE.Mesh(innerEarGeom, mats.innerEar);
    innerMesh.position.set(0, 0.007, 0.0028);
    innerMesh.userData.slot = 'skin';
    earGroup.add(innerMesh);

    // Small fluffy inner ear-base tuft
    const earTuft = buildManeLock(
      THREE,
      [
        new THREE.Vector3(-side * 0.003, 0.006, 0.004),
        new THREE.Vector3(side * 0.003, 0.016, 0.007),
        new THREE.Vector3(side * 0.006, 0.027, 0.004)
      ],
      0.0042,
      0.65,
      mats.mane
    );
    earGroup.add(earTuft);

    headGroup.add(earGroup);
  }

  // Single branched antler-horn on forehead ("horn")
  const horn = buildBranchedHorn(THREE, mats);
  horn.position.set(0, 0.034, 0.022);
  horn.rotation.set(-0.28, 0.04, 0.02);
  headGroup.add(horn);

  // Soft crown tuft curling behind the horn base & plush cheek tufts
  const crownTufts = [
    [
      new THREE.Vector3(0.0, 0.036, 0.010),
      new THREE.Vector3(0.006, 0.052, -0.014),
      new THREE.Vector3(0.010, 0.045, -0.044),
      new THREE.Vector3(0.006, 0.026, -0.062)
    ],
    [
      new THREE.Vector3(-0.010, 0.034, 0.008),
      new THREE.Vector3(-0.018, 0.046, -0.016),
      new THREE.Vector3(-0.022, 0.034, -0.044)
    ],
    [
      new THREE.Vector3(0.012, 0.033, 0.006),
      new THREE.Vector3(0.022, 0.043, -0.018),
      new THREE.Vector3(0.024, 0.028, -0.045)
    ]
  ];
  for (const pts of crownTufts) {
    headGroup.add(buildManeLock(THREE, pts, 0.0095, 0.72, mats.mane));
  }

  for (const side of [1, -1]) {
    const cheekTuft = buildManeLock(
      THREE,
      [
        new THREE.Vector3(side * 0.038, -0.014, 0.002),
        new THREE.Vector3(side * 0.048, -0.022, -0.016),
        new THREE.Vector3(side * 0.040, -0.032, -0.036)
      ],
      0.0075,
      0.68,
      mats.mane
    );
    headGroup.add(cheekTuft);
  }

  return headGroup;
}

function buildBodyAndMane(THREE, mats) {
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'body';
  bodyGroup.position.set(0, 0.205, 0);

  // Continuous sculpted deer torso
  const torsoMesh = new THREE.Mesh(sculptBodyGeometry(THREE), mats.coat);
  torsoMesh.userData.slot = 'fur';
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  bodyGroup.add(torsoMesh);

  // Graceful S-curved tapered neck deeply embedded into shoulders and chest
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.006, 0.062),
    new THREE.Vector3(0, 0.034, 0.088),
    new THREE.Vector3(0, 0.082, 0.106),
    new THREE.Vector3(0, 0.126, 0.112)
  ]);
  const neckGeom = makeTaperedTube(THREE, neckCurve, {
    tubularSegments: 20,
    radialSegments: 18,
    radiusFn: (u) => 0.043 * (1 - 0.36 * smoothstep(0.0, 0.85, u)) + 0.004 * Math.exp(-Math.pow(u / 0.25, 2)),
    sectionFn: (ang, u, r) => ({ rx: r * 0.90, ry: r * 1.04 })
  });
  const neckMesh = new THREE.Mesh(neckGeom, mats.coat);
  neckMesh.userData.slot = 'fur';
  neckMesh.castShadow = true;
  neckMesh.receiveShadow = true;
  bodyGroup.add(neckMesh);

  // Flowing cascading silk mane locks along dorsal neck & shoulders
  const dorsalLocks = [
    {
      r: 0.0125,
      pts: [
        new THREE.Vector3(0.0, 0.115, 0.085),
        new THREE.Vector3(-0.008, 0.095, 0.056),
        new THREE.Vector3(-0.014, 0.064, 0.032),
        new THREE.Vector3(-0.010, 0.044, 0.006)
      ]
    },
    {
      r: 0.0115,
      pts: [
        new THREE.Vector3(0.012, 0.108, 0.082),
        new THREE.Vector3(0.024, 0.082, 0.058),
        new THREE.Vector3(0.028, 0.050, 0.038),
        new THREE.Vector3(0.022, 0.030, 0.018)
      ]
    },
    {
      r: 0.0118,
      pts: [
        new THREE.Vector3(-0.012, 0.106, 0.082),
        new THREE.Vector3(-0.028, 0.080, 0.056),
        new THREE.Vector3(-0.034, 0.048, 0.032),
        new THREE.Vector3(-0.026, 0.026, 0.008)
      ]
    },
    {
      r: 0.0112,
      pts: [
        new THREE.Vector3(0.002, 0.086, 0.068),
        new THREE.Vector3(-0.005, 0.066, 0.034),
        new THREE.Vector3(-0.012, 0.052, -0.002),
        new THREE.Vector3(-0.004, 0.048, -0.028)
      ]
    },
    {
      r: 0.0102,
      pts: [
        new THREE.Vector3(0.018, 0.078, 0.068),
        new THREE.Vector3(0.036, 0.050, 0.046),
        new THREE.Vector3(0.042, 0.020, 0.026),
        new THREE.Vector3(0.035, 0.002, 0.012)
      ]
    },
    {
      r: 0.0105,
      pts: [
        new THREE.Vector3(-0.018, 0.076, 0.068),
        new THREE.Vector3(-0.038, 0.048, 0.046),
        new THREE.Vector3(-0.044, 0.018, 0.022),
        new THREE.Vector3(-0.036, 0.000, 0.004)
      ]
    },
    {
      r: 0.0095,
      pts: [
        new THREE.Vector3(0.008, 0.060, 0.050),
        new THREE.Vector3(0.016, 0.050, 0.018),
        new THREE.Vector3(0.014, 0.048, -0.016)
      ]
    }
  ];
  for (const lock of dorsalLocks) {
    bodyGroup.add(buildManeLock(THREE, lock.pts, lock.r, 0.68, mats.mane));
  }

  // Plush royal chest ruff locks framing the neck-to-chest transition
  const chestLocks = [
    {
      r: 0.0125,
      pts: [
        new THREE.Vector3(0.0, 0.042, 0.112),
        new THREE.Vector3(0.0, 0.008, 0.128),
        new THREE.Vector3(0.0, -0.024, 0.124),
        new THREE.Vector3(0.0, -0.042, 0.106)
      ]
    },
    {
      r: 0.0110,
      pts: [
        new THREE.Vector3(0.018, 0.046, 0.104),
        new THREE.Vector3(0.030, 0.016, 0.118),
        new THREE.Vector3(0.028, -0.016, 0.112),
        new THREE.Vector3(0.018, -0.032, 0.096)
      ]
    },
    {
      r: 0.0110,
      pts: [
        new THREE.Vector3(-0.018, 0.046, 0.104),
        new THREE.Vector3(-0.030, 0.016, 0.118),
        new THREE.Vector3(-0.028, -0.016, 0.112),
        new THREE.Vector3(-0.018, -0.032, 0.096)
      ]
    },
    {
      r: 0.0095,
      pts: [
        new THREE.Vector3(0.030, 0.040, 0.092),
        new THREE.Vector3(0.044, 0.012, 0.098),
        new THREE.Vector3(0.042, -0.014, 0.088)
      ]
    },
    {
      r: 0.0095,
      pts: [
        new THREE.Vector3(-0.030, 0.040, 0.092),
        new THREE.Vector3(-0.044, 0.012, 0.098),
        new THREE.Vector3(-0.042, -0.014, 0.088)
      ]
    }
  ];
  for (const lock of chestLocks) {
    bodyGroup.add(buildManeLock(THREE, lock.pts, lock.r, 0.74, mats.mane));
  }

  return bodyGroup;
}

function buildTailAssembly(THREE, mats) {
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tail';
  tailGroup.position.set(0, 0.222, -0.106);

  // Expressive S-curved slender tail stalk sweeping out and curling gently to the right (-x)
  const stalkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 0.0, 0.014),
    new THREE.Vector3(-0.004, -0.012, -0.024),
    new THREE.Vector3(-0.016, -0.016, -0.062),
    new THREE.Vector3(-0.028, 0.008, -0.088),
    new THREE.Vector3(-0.022, 0.040, -0.092)
  ]);
  const stalkGeom = makeTaperedTube(THREE, stalkCurve, {
    tubularSegments: 22,
    radialSegments: 12,
    radiusFn: (u) => 0.0135 * Math.pow(1 - u * 0.62, 1.1)
  });
  const stalkMesh = new THREE.Mesh(stalkGeom, mats.coat);
  stalkMesh.userData.slot = 'fur';
  stalkMesh.castShadow = true;
  tailGroup.add(stalkMesh);

  // Lush painted cloud-plume tail tuft at the curled tip
  const tip = stalkCurve.getPoint(0.92);
  const plumeDefs = [
    {
      r: 0.0165,
      pts: [
        tip.clone().add(new THREE.Vector3(0, -0.006, 0.004)),
        tip.clone().add(new THREE.Vector3(-0.002, 0.024, -0.010)),
        tip.clone().add(new THREE.Vector3(0.006, 0.056, -0.004)),
        tip.clone().add(new THREE.Vector3(0.014, 0.072, 0.016))
      ]
    },
    {
      r: 0.0140,
      pts: [
        tip.clone().add(new THREE.Vector3(-0.006, -0.004, -0.004)),
        tip.clone().add(new THREE.Vector3(-0.022, 0.016, -0.022)),
        tip.clone().add(new THREE.Vector3(-0.026, 0.046, -0.026)),
        tip.clone().add(new THREE.Vector3(-0.016, 0.062, -0.012))
      ]
    },
    {
      r: 0.0138,
      pts: [
        tip.clone().add(new THREE.Vector3(0.006, -0.002, 0.002)),
        tip.clone().add(new THREE.Vector3(0.020, 0.022, 0.002)),
        tip.clone().add(new THREE.Vector3(0.026, 0.048, 0.014)),
        tip.clone().add(new THREE.Vector3(0.018, 0.060, 0.028))
      ]
    },
    {
      r: 0.0122,
      pts: [
        tip.clone().add(new THREE.Vector3(-0.002, -0.012, -0.008)),
        tip.clone().add(new THREE.Vector3(-0.012, -0.004, -0.036)),
        tip.clone().add(new THREE.Vector3(-0.014, 0.020, -0.048)),
        tip.clone().add(new THREE.Vector3(-0.006, 0.038, -0.042))
      ]
    },
    {
      r: 0.0115,
      pts: [
        tip.clone().add(new THREE.Vector3(0.008, -0.008, -0.006)),
        tip.clone().add(new THREE.Vector3(0.022, 0.006, -0.024)),
        tip.clone().add(new THREE.Vector3(0.024, 0.030, -0.028))
      ]
    },
    {
      r: 0.0105,
      pts: [
        tip.clone().add(new THREE.Vector3(-0.010, 0.002, 0.004)),
        tip.clone().add(new THREE.Vector3(-0.024, 0.026, 0.008)),
        tip.clone().add(new THREE.Vector3(-0.018, 0.048, 0.022))
      ]
    }
  ];
  for (const def of plumeDefs) {
    tailGroup.add(buildManeLock(THREE, def.pts, def.r, 0.72, mats.mane));
  }

  return tailGroup;
}

// ============================================================================
// Public Module Exports
// ============================================================================

export function build(THREE, opts, kit) {
  const pal = resolvePalette(THREE, opts);

  // Generate painted CanvasTextures from resolved palette
  const coatTex = makeScaleCoatTextures(THREE, kit, pal);
  const headTex = makeHeadTextures(THREE, kit, pal);
  const maneTex = makeManeTextures(THREE, kit, pal);
  const hornTex = makeHornTextures(THREE, kit, pal);
  const flameTex = makeFlameTextures(THREE, kit, pal);
  const irisTex = makeIrisTexture(THREE, kit, pal);
  const blushTex = makeBlushTexture(THREE, kit, pal);

  // Curated MeshPhysicalMaterial set
  const furSheen = new THREE.Color(mixColorHex(THREE, pal.fur, '#ffffff', 0.45));
  const maneSheen = new THREE.Color(mixColorHex(THREE, pal.furAccent, '#ffffff', 0.6));
  const innerEarSheen = new THREE.Color(mixColorHex(THREE, pal.innerEar, '#ffffff', 0.45));

  const mats = {
    coat: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: coatTex.map,
      bumpMap: coatTex.bumpMap,
      bumpScale: 0.0024,
      roughness: 0.88,
      metalness: 0.0,
      sheen: 0.82,
      sheenRoughness: 0.62,
      sheenColor: furSheen
    }),
    head: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: headTex.map,
      bumpMap: headTex.bumpMap,
      bumpScale: 0.0014,
      roughness: 0.89,
      metalness: 0.0,
      sheen: 0.84,
      sheenRoughness: 0.65,
      sheenColor: furSheen
    }),
    mane: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: maneTex.map,
      bumpMap: maneTex.bumpMap,
      bumpScale: 0.0018,
      roughness: 0.86,
      metalness: 0.0,
      sheen: 0.92,
      sheenRoughness: 0.55,
      sheenColor: maneSheen
    }),
    innerEar: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(pal.innerEar),
      roughness: 0.92,
      metalness: 0.0,
      sheen: 0.72,
      sheenRoughness: 0.72,
      sheenColor: innerEarSheen
    }),
    horn: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: hornTex.map,
      bumpMap: hornTex.bumpMap,
      bumpScale: 0.0016,
      emissive: new THREE.Color(pal.glow),
      emissiveMap: hornTex.emissiveMap,
      emissiveIntensity: 0.35,
      roughness: 0.22,
      metalness: 0.04,
      clearcoat: 0.92,
      clearcoatRoughness: 0.12
    }),
    hoof: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(pal.hoof),
      roughness: 0.24,
      metalness: 0.06,
      clearcoat: 0.88,
      clearcoatRoughness: 0.14
    }),
    flame: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: flameTex.map,
      emissive: new THREE.Color(pal.glow),
      emissiveMap: flameTex.emissiveMap,
      emissiveIntensity: 1.52,
      roughness: 0.42,
      metalness: 0.0,
      sheen: 0.65,
      sheenColor: new THREE.Color(pal.glow)
    }),
    eyeDark: new THREE.MeshPhysicalMaterial({
      color: 0x12131a,
      roughness: 0.05,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03
    }),
    iris: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: irisTex,
      roughness: 0.10,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05
    }),
    eyeHighlight: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.55,
      roughness: 0.05,
      clearcoat: 1.0
    }),
    nose: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(pal.nose),
      roughness: 0.24,
      metalness: 0.0,
      clearcoat: 0.78,
      clearcoatRoughness: 0.16
    }),
    blush: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: blushTex,
      transparent: true,
      depthWrite: false,
      roughness: 0.92,
      polygonOffset: true,
      polygonOffsetFactor: -1
    })
  };

  const root = new THREE.Group();
  root.name = 'young-kirin';

  // 1. Body, integrated neck, and flowing silk mane
  const body = buildBodyAndMane(THREE, mats);
  root.add(body);

  // 2. Sculpted head + gentle expressive face + ears + single branched antler-horn
  const head = buildHeadAssembly(THREE, mats);
  head.position.set(0.0, 0.342, 0.114);
  // Gentle curious 3/4 tilt & slight turn
  head.rotation.set(0.05, 0.16, -0.075);
  root.add(head);

  // 3. Curled tufted tail
  const tail = buildTailAssembly(THREE, mats);
  root.add(tail);

  // 4. Shared cloven hoof & glowing ankle flame geometries
  const hoofGeom = makeClovenHoofGeometry(THREE);
  const flameGeoms = {
    main: makeFlameWispGeometry(THREE, 0.044, 0.0125, 0.022, 0.0),
    sideL: makeFlameWispGeometry(THREE, 0.031, 0.0095, 0.015, 0.006),
    sideR: makeFlameWispGeometry(THREE, 0.031, 0.0095, 0.015, -0.006)
  };

  // Front-right leg ("armR") — firmly grounded at y = 0
  const armRPivot = new THREE.Vector3(-0.037, 0.194, 0.068);
  const armRFloorY = -armRPivot.y;
  const armR = buildLeg(
    THREE,
    {
      name: 'armR',
      pivot: armRPivot,
      topRadius: 0.027,
      jointU: 0.48,
      points: [
        new THREE.Vector3(0.008, 0.014, -0.006),
        new THREE.Vector3(-0.004, -0.042, 0.004),
        new THREE.Vector3(-0.007, -0.094, 0.007),
        new THREE.Vector3(-0.006, -0.146, 0.003),
        new THREE.Vector3(-0.006, armRFloorY + 0.032, 0.011),
        new THREE.Vector3(-0.006, armRFloorY + 0.019, 0.015)
      ],
      hoofPos: new THREE.Vector3(-0.006, armRFloorY, 0.015),
      flamePos: new THREE.Vector3(-0.006, armRFloorY + 0.024, 0.013)
    },
    mats,
    hoofGeom,
    flameGeoms
  );
  root.add(armR);

  // Front-left leg ("armL") — gracefully raised in a gentle stepping pose
  const armLPivot = new THREE.Vector3(0.037, 0.194, 0.068);
  const armL = buildLeg(
    THREE,
    {
      name: 'armL',
      pivot: armLPivot,
      topRadius: 0.027,
      jointU: 0.46,
      points: [
        new THREE.Vector3(-0.008, 0.014, -0.006),
        new THREE.Vector3(0.005, -0.036, 0.022),
        new THREE.Vector3(0.008, -0.074, 0.048),
        new THREE.Vector3(0.007, -0.118, 0.034),
        new THREE.Vector3(0.006, -0.138, 0.026)
      ],
      hoofPos: new THREE.Vector3(0.006, -0.155, 0.022),
      hoofRot: new THREE.Euler(0.46, 0.06, 0),
      flamePos: new THREE.Vector3(0.006, -0.132, 0.026),
      flameRot: new THREE.Euler(0.35, 0.06, 0)
    },
    mats,
    hoofGeom,
    flameGeoms
  );
  root.add(armL);

  // Hind-right leg ("legR") — firmly grounded at y = 0 with deer hock curve
  const legRPivot = new THREE.Vector3(-0.039, 0.200, -0.070);
  const legRFloorY = -legRPivot.y;
  const legR = buildLeg(
    THREE,
    {
      name: 'legR',
      pivot: legRPivot,
      topRadius: 0.031,
      jointU: 0.50,
      points: [
        new THREE.Vector3(0.010, 0.014, 0.010),
        new THREE.Vector3(-0.003, -0.040, 0.014),
        new THREE.Vector3(-0.006, -0.095, -0.022),
        new THREE.Vector3(-0.005, -0.150, -0.010),
        new THREE.Vector3(-0.005, legRFloorY + 0.032, 0.002),
        new THREE.Vector3(-0.005, legRFloorY + 0.019, 0.006)
      ],
      hoofPos: new THREE.Vector3(-0.005, legRFloorY, 0.006),
      flamePos: new THREE.Vector3(-0.005, legRFloorY + 0.024, 0.004)
    },
    mats,
    hoofGeom,
    flameGeoms
  );
  root.add(legR);

  // Hind-left leg ("legL") — firmly grounded at y = 0, slightly stepped back for natural balance
  const legLPivot = new THREE.Vector3(0.039, 0.200, -0.070);
  const legLFloorY = -legLPivot.y;
  const legL = buildLeg(
    THREE,
    {
      name: 'legL',
      pivot: legLPivot,
      topRadius: 0.031,
      jointU: 0.50,
      points: [
        new THREE.Vector3(-0.010, 0.014, 0.010),
        new THREE.Vector3(0.003, -0.040, 0.008),
        new THREE.Vector3(0.006, -0.095, -0.032),
        new THREE.Vector3(0.005, -0.150, -0.022),
        new THREE.Vector3(0.005, legLFloorY + 0.032, -0.010),
        new THREE.Vector3(0.005, legLFloorY + 0.019, -0.006)
      ],
      hoofPos: new THREE.Vector3(0.005, legLFloorY, -0.006),
      flamePos: new THREE.Vector3(0.005, legLFloorY + 0.024, -0.008)
    },
    mats,
    hoofGeom,
    flameGeoms
  );
  root.add(legL);

  // Cache animation references and rest poses cleanly in userData
  const earL = head.getObjectByName('earL');
  const earR = head.getObjectByName('earR');
  const eyeL = head.getObjectByName('eyeL');
  const eyeR = head.getObjectByName('eyeR');

  root.userData.anim = {
    body,
    head,
    tail,
    earL,
    earR,
    eyeL,
    eyeR,
    armL,
    flameMat: mats.flame,
    bodyBaseY: body.position.y,
    headBasePos: head.position.clone(),
    headBaseRot: head.rotation.clone(),
    tailBaseRot: tail.rotation.clone(),
    earLBaseRot: earL ? earL.rotation.clone() : null,
    earRBaseRot: earR ? earR.rotation.clone() : null,
    armLBaseRot: armL.rotation.clone()
  };

  return root;
}

export function idle(group, t) {
  const a = group && group.userData && group.userData.anim;
  if (!a) return;

  // 1. Gentle rhythmic breathing
  const breath = Math.sin(t * 1.85);
  a.body.scale.set(1 + breath * 0.011, 1 + breath * 0.014, 1 + breath * 0.007);
  a.body.position.y = a.bodyBaseY + breath * 0.0022;

  // 2. Soft curious head sway riding smoothly with breath
  a.head.position.set(
    a.headBasePos.x + Math.sin(t * 0.75) * 0.002,
    a.headBasePos.y + breath * 0.0030,
    a.headBasePos.z + breath * 0.0012
  );
  a.head.rotation.set(
    a.headBaseRot.x + Math.sin(t * 1.15) * 0.032 + breath * 0.012,
    a.headBaseRot.y + Math.sin(t * 0.68) * 0.075,
    a.headBaseRot.z + Math.sin(t * 0.92 + 0.8) * 0.042
  );

  // 3. Expressive ear sway + occasional gentle deer ear flick
  const flickCycle = (t * 0.19) % 1;
  const flick = flickCycle > 0.88 ? Math.sin(((flickCycle - 0.88) / 0.12) * Math.PI) : 0;
  if (a.earL && a.earLBaseRot) {
    a.earL.rotation.z = a.earLBaseRot.z + Math.sin(t * 1.45) * 0.045 - flick * 0.16;
    a.earL.rotation.x = a.earLBaseRot.x + Math.sin(t * 1.1 + 0.5) * 0.03;
  }
  if (a.earR && a.earRBaseRot) {
    a.earR.rotation.z = a.earRBaseRot.z - Math.sin(t * 1.45 + 0.4) * 0.045;
    a.earR.rotation.x = a.earRBaseRot.x + Math.sin(t * 1.1 + 1.1) * 0.03;
  }

  // 4. Flowing tail sway
  a.tail.rotation.set(
    a.tailBaseRot.x + Math.sin(t * 1.65) * 0.065,
    a.tailBaseRot.y + Math.sin(t * 1.25) * 0.13 + Math.sin(t * 2.5) * 0.03,
    a.tailBaseRot.z + Math.cos(t * 1.25) * 0.05
  );

  // 5. Poised gentle hover on raised front-left leg
  a.armL.rotation.x = a.armLBaseRot.x + Math.sin(t * 1.85 - 0.6) * 0.045;

  // 6. Natural blink every ~4.1 seconds by scaling eye groups on Y
  const blinkPeriod = 4.1;
  const phase = t % blinkPeriod;
  let eyeScaleY = 1.0;
  if (phase > blinkPeriod - 0.18) {
    const p = (phase - (blinkPeriod - 0.18)) / 0.18;
    const closed = Math.sin(p * Math.PI);
    eyeScaleY = 1.0 - 0.92 * closed * closed;
  }
  if (a.eyeL) a.eyeL.scale.y = eyeScaleY;
  if (a.eyeR) a.eyeR.scale.y = eyeScaleY;

  // 7. Cozy warm ember pulse on glowing ankle flame tufts
  if (a.flameMat) {
    a.flameMat.emissiveIntensity = 1.50 + 0.20 * Math.sin(t * 2.6) + 0.06 * Math.sin(t * 5.7);
  }
}